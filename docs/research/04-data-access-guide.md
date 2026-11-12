# 04 — Data Access Guide (Moneycontrol, NSE, BSE) and Update Workflow

**Date:** 2 Nov 2026. **Status:** action list for the product owner. Not legal advice.

## 1. What I can and cannot do

| Source | What I verified | Consequence |
|---|---|---|
| **Moneycontrol** | Blocks automated requests and my in-app browser (403 / edge error). I could not read its terms or robots file | I will not scrape or work around the block. With **your** written permission or licence, the integration can be built. Steps in §2 |
| **NSE website** | Terms prohibit "systematic or automated data collection (scraping, mining, extraction, harvesting)" and copying, republishing or hyperlinking content without prior written permission | No scraping of NSE pages or its undocumented JSON endpoints |
| **NSE RSS feeds** | NSE publishes `Circulars.xml` and about 20 other feeds for subscription, linked from its RSS page | Used by the monitor: **once a day, headline and link only**. Still ask NSE to confirm in writing (§3) |
| **BSE notices feed** | `bseindia.com/data/xml/notices.xml` is published for RSS readers. BSE terms not yet read | Same approach. Read the BSE terms first |
| **SEBI** | RSS (`sebirss.xml`) is published by SEBI; listing pages are public. SEBI's server blocks rapid requests | Monitor reads gently (a few requests, seconds apart, once a day) |

**Two different uses:** (a) *regulatory monitoring* (headlines and links, to alert a human) is low-risk and built. (b) *Market data shown to users* (index levels, returns, prices) is a data licence question and is **not** built until you hold a licence.

## 2. Using Moneycontrol — what you need to do

1. In your normal browser, open the Terms of Use (footer of moneycontrol.com) and look for clauses on: copying or reproducing content, automated access, linking/framing, commercial use.
2. Write to Moneycontrol / Network18 (use the "Contact us" or advertising/partnership email in the footer). Suggested text:
   > We are building a free, non-commercial investor-education website for beginners in India. We would like permission to (1) link to Moneycontrol educational articles, and/or (2) display [specific data, e.g. index levels or glossary definitions] with attribution. Please tell us whether a licence, API or widget programme exists, the fees and the permitted uses. We do not give investment advice and will not redistribute data to third parties.
3. Keep the reply (email or licence PDF). Send it to me and I will record it in the registry as the legal basis and build an adapter limited to what the licence allows.
4. **Until then:** the site may contain ordinary outbound links (a link to a public page is not copying), but no Moneycontrol text, numbers or charts.

Things that need no permission and can be used now: SEBI's investor-education material (check its reuse terms), your own original explanations, and the user's own inputs.

## 3. Asking NSE and BSE
- **NSE Indices** (index values, TRI history): the niftyindices.com *Index Licensing / Data Subscription* pages list licence routes and authorised data vendors. Ask for a quote for a free educational site displaying historical TRI-derived ranges.
- **NSE feeds:** ask `data` / website contact: "May we poll the published RSS feeds once daily to alert our compliance reviewer? We store only titles and links."
- **BSE:** same request for the notices feed, and the Sensex index licence (Asia Index) if Sensex data is wanted.

## 4. How the update workflow works (what is real today)

```
daily/weekly run -> tools/source-monitor/monitor.py
   reads: SEBI RSS + 3 SEBI listing pages + NSE Circulars RSS + BSE Notices RSS
   writes: report.md (candidates scored by relevance)  + state.json (what has been seen)
   never writes: the registry, methodology or any website content
human reviewer -> opens the primary document -> decides
   -> updates source-registry.json (status, sha256, last_verified_at, verified_by)
   -> updates affected methodology/explanations via a normal reviewed change
```

- The website footer may say "Sources last verified on <registry date>". It must **not** say "monitored continuously".
- A failed source is reported as a failure, never as "no change".
- Scoring is keyword based and tunable. The first run produced 7 candidates from 128 items, and also flagged an enforcement notice that mentions "unregistered" (a false positive). A human review step is expected.
- Next step to automate: run the script on a schedule (GitHub Action or Windows Task Scheduler) and open an issue with the report. Say if you want this set up.

## 5. Findings recorded from the first run (2 Nov 2026)
See `tools/source-monitor/report.md`. No new SEBI instruments affecting the IA Regulations were found beyond those in 01 §2.2a. Re-check the RA amendment effective 9 Nov 2026.
