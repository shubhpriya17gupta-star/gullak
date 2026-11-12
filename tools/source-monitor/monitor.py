"""Regulatory source monitor (prototype).

Reads OFFICIAL syndication feeds and SEBI listing pages, compares them with the last
saved state, scores items for relevance to this project, and writes a review report.

It NEVER edits the source registry, the methodology docs or any production content.
A human reads the report, verifies the primary document, then updates the registry.

Feeds used (published by the sources for syndication; polite polling, once per run):
  SEBI  https://www.sebi.gov.in/sebirss.xml                (press releases, circulars, orders)
  NSE   https://nsearchives.nseindia.com/content/RSS/Circulars.xml
  BSE   https://www.bseindia.com/data/xml/notices.xml
SEBI listing pages (HTML; read only to detect new regulation/master-circular versions):
  regulations (ssid=3), master circulars (ssid=6), circulars (ssid=7)

Not used: any NSE/BSE/SEBI page behind scraping prohibitions. NSE's terms prohibit
systematic automated collection from the website; the RSS feeds are offered for subscription.
Confirm with the exchanges in writing before widening this (see docs/research).

Usage:  python monitor.py [--state state.json] [--report report.md] [--registry ../../docs/research/source-registry.seed.json]
Exit code 0 = ran; 2 = at least one source failed (never read as "no change").
"""
import argparse, datetime as dt, hashlib, json, re, sys, time, urllib.request, xml.etree.ElementTree as ET

UA = "IndianInvestorEduMonitor/0.1 (+contact: set-your-email-here; read-only, daily)"

FEEDS = {
    "SEBI": "https://www.sebi.gov.in/sebirss.xml",
    "NSE": "https://nsearchives.nseindia.com/content/RSS/Circulars.xml",
    "BSE": "https://www.bseindia.com/data/xml/notices.xml",
}
LISTINGS = {
    "SEBI-regulations": "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=3&smid=0",
    "SEBI-master-circulars": "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=6&smid=0",
    "SEBI-circulars": "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0",
}

# (weight, regex). Higher total = more likely to affect this project. Tunable; reviewed by a human.
RELEVANCE = [
    (5, r"investment advis"), (5, r"research analyst"), (4, r"financial planning"),
    (4, r"risk profil|suitability|riskometer|risk-o-meter"), (4, r"artificial intelligence|\bAI\b"),
    (4, r"educat|investor awareness|jagrook|saa.?thi"), (4, r"price data|market data|data sharing"),
    (3, r"intermediaries\)? regulations|association|prohibited activit|finfluenc|unregistered"),
    (3, r"advertis|dark pattern|disclaimer"), (3, r"past (risk|performance)|parrva|performance claim"),
    (3, r"digital platform|specified digital"), (2, r"mutual fund|scheme"),
    (2, r"calculator|index|nifty|sensex"), (2, r"data protection|dpdp|privacy|cyber"),
    (1, r"circular|regulations|master circular"),
]
NOISE = re.compile(r"(final order|interim order|adjudication|settlement order|surveillance|GSM|ASM|"
                   r"futures and options contract|lot size|corporate action|holiday)", re.I)


def get(url, tries=2):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001 - reported, never swallowed silently
            last = e
            time.sleep(3)
    raise RuntimeError(f"{url}: {last}")


def parse_rss(text):
    root = ET.fromstring(text.lstrip("﻿").strip())
    for it in root.iter("item"):
        yield {
            "title": re.sub(r"\s+", " ", (it.findtext("title") or "")).strip(),
            "link": (it.findtext("link") or "").strip(),
            "date": (it.findtext("pubDate") or "").strip(),
        }


def parse_listing(html):
    out = []
    for m in re.finditer(r'(?s)<td>([A-Z][a-z]{2} \d{2}, \d{4})</td>.*?<a href="([^"]+)"[^>]*title="([^"]+)"', html):
        out.append({"title": m.group(3).strip(), "link": m.group(2), "date": m.group(1)})
    if not out:  # regulations page uses a different row layout
        for m in re.finditer(r'<a href="(https://www\.sebi\.gov\.in/legal/regulations/[^"]+)"[^>]*title="([^"]+)"', html):
            out.append({"title": m.group(2).strip(), "link": m.group(1), "date": ""})
    return out


def score(title):
    return sum(w for w, rx in RELEVANCE if re.search(rx, title, re.I))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default="state.json")
    ap.add_argument("--report", default="report.md")
    ap.add_argument("--registry", default=None)
    ap.add_argument("--min-score", type=int, default=5)
    a = ap.parse_args()

    try:
        state = json.load(open(a.state, encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        state = {"seen": {}, "first_run": True}
    seen = state["seen"]
    first = state.get("first_run", False)

    items, failures = [], []
    for name, url in FEEDS.items():
        try:
            items += [dict(i, source=name) for i in parse_rss(get(url))]
        except Exception as e:  # noqa: BLE001
            failures.append((name, str(e)))
    for name, url in LISTINGS.items():
        try:
            items += [dict(i, source=name) for i in parse_listing(get(url))]
            time.sleep(4)
        except Exception as e:  # noqa: BLE001
            failures.append((name, str(e)))

    new = []
    for i in items:
        key = hashlib.sha256((i["source"] + "|" + i["link"]).encode()).hexdigest()[:16]
        if key in seen:
            continue
        seen[key] = {"title": i["title"], "first_seen": dt.date.today().isoformat()}
        i["score"] = score(i["title"])
        i["noise"] = bool(NOISE.search(i["title"]))
        new.append(i)

    relevant = sorted([i for i in new if i["score"] >= a.min_score and not i["noise"]], key=lambda x: -x["score"])
    # registry cross-check: which registry entries might be affected
    reg_note = ""
    if a.registry:
        try:
            reg = json.load(open(a.registry, encoding="utf-8"))
            reg_note = f"Registry last verified: {reg.get('registry_last_verified')} ({len(reg['sources'])} entries)."
        except Exception as e:  # noqa: BLE001
            reg_note = f"Registry could not be read: {e}"

    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    L = [f"# Source monitor report - {now}", "", reg_note, "",
         "**This report only lists candidates. Nothing has been changed. A human must read the primary document, "
         "then update the registry and any affected explanation or calculation.**", ""]
    if failures:
        L += ["## Sources that FAILED (not the same as 'no change')", ""] + [f"- {n}: {e}" for n, e in failures] + [""]
    if first:
        L += [f"_First run: {len(new)} existing items recorded as the baseline. The list below is a one-time triage "
              "of what is currently published, not a list of new changes._", ""]
    L += [f"## Candidates for review ({len(relevant)} of {len(new)} new items; score >= {a.min_score})", "",
          "| Score | Source | Date | Title | Link |", "|---|---|---|---|---|"]
    for i in relevant:
        L.append(f"| {i['score']} | {i['source']} | {i['date']} | {i['title'][:140].replace('|','/')} | {i['link']} |")
    L += ["", f"Skipped as low relevance/noise: {len(new) - len(relevant)} items.", ""]
    open(a.report, "w", encoding="utf-8").write("\n".join(L))

    state["first_run"] = False
    state["last_run"] = now
    json.dump(state, open(a.state, "w", encoding="utf-8"), indent=1)
    print(f"{len(items)} items fetched, {len(new)} new, {len(relevant)} flagged, {len(failures)} source failures")
    return 2 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
