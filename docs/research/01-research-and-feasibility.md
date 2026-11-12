# 01 — Research & Technical Feasibility

**Project:** Indian Beginner Investment & Financial Planning Platform (working name)
**Version:** 0.1 (draft for review). **Prepared:** 2 Nov 2026. **Research database last verified:** 2 Nov 2026
**Status:** This is not legal advice. Every regulatory conclusion here must be reviewed by a qualified Indian securities lawyer before public launch.

## How to read this document

Every claim carries a verification tag:

| Tag | Meaning |
|---|---|
| **[P]** | Checked against the primary/official text (sebi.gov.in, investor.sebi.gov.in, niftyindices.com) on 2 Nov 2026 |
| **[R]** | Cited in an official secondary document (e.g. an RBI speech citing a gazette notification), but the primary text itself was not read |
| **[S]** | Secondary sources only (law-firm notes, news). This is a lead, not a fact, and must be verified before it is relied on |
| **[U]** | Unverified, or no source could be accessed |

Regulations are paraphrased with clause references rather than reproduced. Always read the linked primary text.

---

## 0. Scope decisions already made (by the product owner)

| Decision | Effect |
|---|---|
| Platform is **free**, with no ads, referrals, broker/AMC tie-ups or other revenue | Lowest regulatory exposure (see §4). Not an automatic exemption |
| **No SIP / monthly-contribution calculator** | Module 3 projects a **one-time (lump-sum)** amount only. SIP, step-up SIP, annuity maths and XIRR are out of scope |
| **No post-allocation remainder, no "manageable?" verdict** | Module 1 outputs only the monthly surplus, emergency coverage (in months), and an optional shortfall against a target **the user enters** |
| **No app-supplied emergency-fund target** | No authoritative Indian source gives a number of months (see §3.4) |
| Stack: TypeScript + Next.js monorepo, calculations run **in the browser** | No financial inputs leave the user's device (see §7) |

---

## 1. Financial concepts identified

Each concept gets a plain-language tooltip in the UI. Wording is finalised in the UI phase.

| Concept | Plain-language meaning | Used in |
|---|---|---|
| Monthly income | Money you receive in a typical month after tax | M1 |
| Essential expenses | Spending you can't easily cut: rent, food, utilities, insurance premiums, school fees | M1 |
| EMI / obligations | Fixed monthly loan repayments and similar commitments | M1, M2 |
| Monthly surplus | What's left each month after essentials and EMIs | M1, M5 |
| Emergency savings | Money kept aside, easy to access, for unexpected events. It is **not** investment money | M1, M2 |
| Emergency coverage | How many months of essentials + EMIs your emergency savings would pay for | M1, M2 |
| Savings vs. emergency reserve vs. market investment | Three separate pots. The platform never assumes any pot should be invested | M1, M5 |
| Lump sum | A single, one-time amount invested at the start | M3 |
| Compounding | Earning returns on previous returns | M3 |
| Assumed annual return | A rate **you** choose for illustration. It is not a prediction or a guarantee | M3 |
| CAGR | The single yearly growth rate that turns a start value into an end value over a period | M3 |
| Nominal vs. real return | Nominal is the headline growth. Real is growth after inflation, i.e. what the money can actually buy | M3, M5 |
| Inflation (CPI) | The general rise in prices, measured by the Consumer Price Index | M3 |
| Risk capacity | How much loss you can **afford** without hurting essentials or goals (objective) | M2 |
| Risk tolerance | How **comfortable** you are with ups and downs (psychological) | M2 |
| Risk requirement | How much growth your goal **needs** (arithmetic) | M2 |
| Drawdown / downside | A fall in value from a previous level | M3, M5 |
| Market index; price index vs. Total Return Index (TRI) | A basket that tracks a market segment. TRI also counts dividends reinvested; a price index does not | M4 |
| Investment horizon | How long you plan to leave this money invested | M2, M3 |

---

## 2. Applicable SEBI regulations and documents

### 2.1 SEBI (Investment Advisers) Regulations, 2013 ("IA Regs") **[P]**
- **Source:** [SEBI listing, "Last amended on November 25, 2025"](https://www.sebi.gov.in/legal/regulations/nov-2025/securities-and-exchange-board-of-india-investment-advisers-regulations-2013-and-securities-last-amended-on-november-25-2025-_98246.html). The consolidated PDF (43 pp., "Amended upto November 25, 2025") is linked from that page.
- **Amendment history** (from the consolidated text) **[P]**: 2016, 2020 (w.e.f. 30-09-2020), 2021 (×3), 2023 (several), 26-04-2024, **16-12-2024** (Second Amendment 2024, No. SEBI/LAD-NRO/GN/2024/219), **10-02-2025** (Investor Charter amendment), **07-08-2025** (No. …/GN/2025/253), **25-11-2025** (Second Amendment 2025, No. …/GN/2025/278).

Clauses relevant to this project **[P]**:

| Clause | Gist (paraphrased) | Why it matters here |
|---|---|---|
| Reg 2(1)(g) "consideration" | Any economic benefit, **including non-cash**, received **or receivable** for giving investment advice | "Free" does not settle the question if any benefit (e.g. data, future monetisation) is received or receivable |
| Reg 2(1)(h) "financial planning" | Analysing a client's current financial situation, identifying goals, and developing and recommending strategies to reach them | Modules 1, 2 and 5 together resemble the first two limbs |
| Reg 2(1)(l) "investment advice" | Advice on investing in / dealing in **securities** and on portfolios of securities, by any means, for the client's benefit; **includes financial planning**. Since 16-12-2024 the words "and investment products" have been **omitted** | Narrower than before; whether stand-alone "financial planning" with no securities is still caught is a question for counsel (Q1) |
| Proviso 1 to 2(1)(l) | Advice through newspapers, magazines, or any electronic/broadcast/telecom medium **widely available to the public** is not investment advice | Whether a personalised, interactive web tool counts as "widely available to the public" is untested (Q2) |
| Proviso 2 to 2(1)(l) | "Trading calls" are not investment advice (inserted 16-12-2024) | Not relevant; we give no calls |
| Reg 2(1)(m) "investment adviser" | A person who, **for consideration**, is **engaged in the business** of giving investment advice, or holds themselves out as an adviser | Free plus no holding-out lowers risk; no "adviser" wording in branding |
| Reg 3(1) | No one may act as, or hold out as, an IA without registration | |
| Reg 4(a) | Exemption: good-faith general comments on market/economic trends that **do not specify particular securities or investment products** | Our output is personalised, so this exemption may not fit (Q3) |
| Reg 15(14) | A **registered** IA using AI tools is solely responsible for data security and for advice based on AI output (inserted 16-12-2024) | Binds only registered IAs. We adopt it voluntarily as a design principle for the AI layer |
| Reg 16 Risk profiling | IA must collect age, objectives/horizon, income, existing investments, risk appetite, liabilities. It must have a process that assesses capacity to absorb loss and **willingness vs. ability**, interprets answers without inappropriate weight, uses tools that are fit for purpose with limitations mitigated, keeps questionnaires clear with no leading questions or double negatives, communicates the profile, and updates it periodically | Binds only registered IAs. We adopt it as the **design benchmark** for Module 2 (see 03-risk-methodology.md) |
| Reg 17 Suitability | Investments advised must suit the risk profile, under a documented selection process | We **do not** select or suggest investments, so this is out of scope by design |

### 2.2 Association with persons engaged in prohibited activities **[P]**
- **SEBI (Intermediaries) (Amendment) Regulations, 2024**, published 29-08-2024, inserted **Reg 16A** (and parallel provisions in the SECC and DP Regulations) **[P via circular]**.
- **Circular** SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2025/11, **29 Jan 2025, updated 8 May 2026** ([SEBI page](https://www.sebi.gov.in/legal/circulars/jan-2025/details-clarifications-on-provisions-related-to-association-of-persons-regulated-by-the-board-miis-and-their-agents-with-persons-engaged-in-prohibited-activities_91356.html)) **[P]**:
  - SEBI-regulated persons (brokers, AMCs, MF distributors, etc.) may not associate with anyone who (i) gives advice or recommendations on securities without SEBI registration/permission, or (ii) makes any claim of returns or performance on securities, express or **implied**, without SEBI permission.
  - "Association" includes money or money's worth, **client referral**, **interaction of IT systems**, and sharing of client information.
  - A person "engaged solely in investor education" is outside the restriction, provided they do neither (i) nor (ii).
  - FAQ 8 (as modified) says such a person must not use market price data **of the preceding 30 days** to name any security (including by code name) in a way that indicates future price, advice or recommendation.
- **Circular** HO/47/17/12(11)2025-MRD-POD3/I/11107/2026, **8 May 2026**, "Norms for sharing and usage of price data for educational purposes" ([SEBI page](https://www.sebi.gov.in/legal/circulars/may-2026/norms-for-sharing-and-usage-of-price-data-for-educational-purposes_101293.html)) **[P]**:
  - Replaces the earlier **three-month** lag (Jan 2025) with a **30-day lag** for both sharing and usage of price data for education.
  - Applicable **w.e.f. 1 July 2026**. (The FAQ footnote says "with effect from May 8, 2026"; this is a minor internal inconsistency in SEBI's documents. Both dates have passed.)
  - ⚠ The planning draft cited the three-month rule. **That rule is superseded.** This is exactly the kind of change the source registry (§9) exists to catch.

**What this means for us:**
1. Using a **broker's market-data API** would be an "interaction of IT systems" association. If SEBI ever regarded us as doing (i) or (ii), the broker would be in breach, so brokers have a strong reason to refuse. **Avoid broker APIs.**
2. To stay "solely education": never name securities alongside data less than 30 days old, never indicate future prices, never make return claims.
3. The free, no-tie-up model avoids "association" entirely.

### 2.2a 2026 updates (added 2 Nov 2026; all **[P]**, read from sebi.gov.in PDFs)

| Item | What changed / what it says | Effect on us |
|---|---|---|
| **IA Regulations**: no 2026 amendment | SEBI's listing still shows "last amended 25 Nov 2025" as of 2 Nov 2026. Law-firm commentary suggests a later amendment on accredited investors is pending **[S]**. The monitor (§9) watches for it | The Nov 2025 text in §2.1 is still the current text |
| **IA Master Circular, 6 Feb 2026** (HO/38/12/11(2)2026-MIRSD-POD/I/4300/2026, 99 pp.) supersedes 27 Jun 2025 | Para (xi): "investment advice" under Reg 2(1)(l) means advice on **securities under SEBI's purview** only. Financial planning may also cover non-SEBI products, with a client declaration that SEBI offers no recourse for those. Also: IAs may not offer free trials of advice without risk profiling, and must disclose AI use | **Helps Q1**: the regulator itself ties "investment advice" to SEBI-regulated securities. It does not settle whether a tool with no securities is "financial planning" outside registration. Counsel still needed |
| **Intermediaries Regs, 2008, amended up to 10 Oct 2026** | Amendments: 16 Apr 2026 (SEBI/LAD-NRO/GN/2026/300) and **10 Oct 2026** (…/GN/2026/323). Reg **16A** now has a proviso: it does **not** apply to association through a **"specified digital platform"**. Explanation 4 keeps the carve-out for **investor education** providers that do neither prohibited activity. **Reg 16C** (AI responsibility, from 10 Feb 2025) and Chapter **IIIC** (past risk/return claims must be PaRRVA-verified) are in force | Our "education-only, no association" posture stands. A new "specified digital platform" route exists for platforms SEBI designates; we have no need for it |
| **Common Advertisement Code** (Intermediaries Regs, Ch. IIID, regs 16G-16N; inserted by the Second Amendment 2026, **w.e.f. 8 Apr 2027**) | Applies to **regulated entities** (brokers, IAs, RAs, MFs, AMCs, PMs…). Requires sources and dates beside statistics/charts, disclosure of examples as "not a recommendation", bans dark patterns and inducements. Educational/informational communication is not an "advertisement" if branding is minimal and there is no call-to-action | Not binding on us. **Adopted voluntarily** as UI rules: source and date beside every chart, no dark patterns, no inducements, no promotional calls-to-action |
| **Research Analysts Regs, 2014, amended up to 10 Oct 2026** | Amendment (SEBI/LAD-NRO/GN/2026/321) **w.e.f. 9 Nov 2026**. Text of the change not yet analysed | Not relevant unless we publish research. Re-check after 9 Nov |
| Circular 23 Oct 2026, call records of institutional clients (RAs) | RA compliance only | Not relevant |
| Circular 1 Oct 2026 (Project Jagrook) | Brokers must show SEBI investor-awareness messages on websites/apps from 5 Oct 2026 (this includes from 1 Nov 2026) | Not binding on us. We may link to SEBI's investor site (investor.sebi.gov.in) |
| PaRRVA enrolment extension, 3 Aug 2026 | For registered IAs/RAs | Context only |

### 2.3 Other SEBI documents

| Document | Finding | Tag |
|---|---|---|
| Master Circular for IAs, 27 Jun 2025 (…/CIR/2025/94) | **Superseded** by the 6 Feb 2026 Master Circular (see §2.2a) | [P] |
| IA guidelines circular 8 Jan 2025 (…/2025/003); MITC circular 17 Feb 2025 (…/2025/19); Investor Charter circular 2 Jun 2025 (…/2025/80) | IA-facing obligations, including risk profiling before service | [S] |
| SEBI (Research Analysts) Regulations, 2014 (amended up to 10 Oct 2026) | Relevant only if we published research or recommendations on securities, which we do not. See §2.2a | [P] |
| PaRRVA (past risk-return verification), circular 4 Apr 2025 (…/2025/51), pilot Dec 2025 | For registered entities' performance claims. Context only: SEBI treats unverified return claims as a serious concern | [S] |
| SEBI F&O studies (FY25 ≈ 91% of individual traders loss-making; a later study covers FY26) | Optional risk-awareness content. Quote only from the SEBI PDF | [S] |

### 2.4 SEBI investor-education material (used as precedent and wording benchmark) **[P]**
- SEBI's own investor website runs **public calculators**, including Standard Compound Interest, Inflation, Future Value, SIP, Goal Planner, Asset Allocation and Financial Health Check ([index](https://investor.sebi.gov.in/calculators/index.html)). Each carries a disclaimer: the calculators are for illustration only, do not represent actual returns, and the stock market has no fixed or predictable rate of return. **We adopt equivalent disclaimer wording.**
- SEBI's "Money matters" page ([link](https://investor.sebi.gov.in/moneymatters-inc-exp.html)) advises budgeting, prioritising basic needs and keeping an emergency fund, but gives **no number of months**. This supports our decision to show coverage descriptively rather than set a target.

---

## 3. Data sources and access permissions

| Source | What we would want | Access status | Decision |
|---|---|---|---|
| **Moneycontrol** | Historical index levels, glossary content | Site returns **403/edge error** to automated requests and to the in-app browser. **Terms of use could not be read** [U]. No official public API found [S] | **Not used.** No scraping. **Owner action:** read the Moneycontrol terms in a normal browser and, if needed, write to Moneycontrol/Network18 for a data/content licence. Until a written licence exists, nothing from Moneycontrol appears on the site |
| **NSE Indices** (niftyindices.com): Nifty 50 / TRI history | Historical TRI series to derive scenario ranges and historical drawdowns | Terms of use **[P]**: no material may be copied, reproduced, republished or distributed without **prior written permission**; **no automated data collection** (scraping, mining, harvesting) without written consent. The site offers *Index Licensing*, *Data Subscription* and *Authorised Data Vendors* | **Licence required** before any Nifty-derived number is shown or used. Owner action: contact NSE Indices or an authorised vendor |
| BSE / Asia Index (Sensex) | Same | Not checked [U] | Same approach as NSE |
| Broker APIs (e.g. trading-platform data APIs) | Live/delayed prices | Technically available, but creates an "association" (§2.2) | **Avoid** |
| Third-party copies (Kaggle, blogs, GitHub mirrors) | — | Not licensed by the index owner | **Never used** |
| CPI inflation series (MOSPI / RBI DBIE / data.gov.in) | Historical inflation, for real-return context | Licence terms not yet checked [U] | Check the terms; until then use only the official target below |
| **Inflation target** | A labelled reference value for the inflation input | Gazette S.O.1580(E), 25 Mar 2026: CPI target 4% with a 2–6% band, 1 Apr 2026–31 Mar 2031, under RBI Act s.45ZA **[R]** (cited in RBI speeches; gazette text not yet read) | Offer **4% as a labelled, editable reference**, clearly described as a policy *target*, not a forecast |

### 3a. Rates used by the trade-cost calculator (checked 4 Nov 2026)
Only the figures supplied by the product owner are used. Verification status of each:

| Figure | Status | Source |
|---|---|---|
| ₹20 per executed order | **Supplied; not independently verified.** Brokers' plans differ, so the user's own broker contract note governs | Product owner |
| GST 18% | **Supplied; [S] only.** Secondary sources agree 18% applies to brokerage (SAC 997152). No CBIC notification was retrieved | Product owner; secondary sources |
| Short-term gains 20% (listed equity, STT paid) | **[P]** CBDT FAQ on Budget 2024 (Section 111A, up from 15% to 20%); the Income-tax Act 2025 First Schedule lists the same rate under section 196 [R] | [PIB, CBDT FAQs](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2036604&reg=48&lang=2); incometaxindia.gov.in (not fetchable directly; confirmed via search snippet) |
| Long-term gains 12.5% | **[P]** same FAQ (Section 112A, up from 10%); Income-tax Act 2025 section 198 [R] | same |
| Holding period for long-term | **[P]** one year for all listed assets | same FAQ |
| Health and education cess 4% | **[P]** 4% on income-tax plus surcharge | [incometaxindia.gov.in tax rates](https://www.incometaxindia.gov.in/w/tax-rates%E2%80%8B) |
| Annual long-term exemption ₹1.25 lakh | **[P]** exists (same FAQ) but **not applied**, because only the supplied figures are used | same FAQ |

Open: the primary Income-tax Act 2025 text (sections 196 and 198) returned HTTP 403 to automated access; the section numbers and rates were seen only in search snippets of the official site. A chartered accountant should confirm before launch.

**Module 4 feasibility (v1):** no live or delayed market data is feasible without a licence. Module 4 v1 will show:
- the data-source registry
- each source's licence status
- "Data unavailable — licence pending" states, instead of any number
- the adapter interface, ready for a licensed provider

---

## 4. Regulatory analysis: could the platform be "investment advice"?

| Module | Resemblance to regulated activity | Residual risk | Design mitigation |
|---|---|---|---|
| M1 Budget | First limb of "financial planning" (analysing the current financial situation) | Low–Medium | Descriptive arithmetic only. No target, verdict or recommendation |
| M2 Risk assessment | Mirrors IA Reg 16 risk profiling | **Medium–High** | Labelled **educational, own methodology, not SEBI's**. No product, allocation or "you should" output. Methodology published |
| M3 Outcome calculator | Generic compound-growth tool. SEBI itself publishes equivalents | Low | User-entered rates only. No default returns. SEBI-style disclaimer |
| M4 Market data | Possible "claim of returns" if historical returns are presented persuasively | Low–Medium | Licensed data only. Neutral presentation. No security names alongside data under 30 days old |
| M5 Dashboard | Synthesis of situation + goals + risk is the closest to "financial planning" | **Medium–High** | No strategies recommended. Every result traced to an input or formula. Explicit "this is not advice" framing |

Factors in our favour: no consideration received (Reg 2(1)(g)); not "engaged in the business"; no holding-out as an adviser; no securities named; no recommendations; publicly accessible tool. None of these is a safe harbour on its own.

---

## 5. Financial formulas required

Summary only. Full definitions, variables, edge cases and test vectors are in [02-financial-methodology.md](../methodology/02-financial-methodology.md).

| # | Formula | Principle |
|---|---|---|
| F1 | Monthly surplus `S = I − E − L` | Arithmetic |
| F2 | Emergency coverage `C = ES / (E + L)` months | Arithmetic |
| F3 | Optional shortfall `max(0, T·(E+L) − ES)`, where T is entered by the user | Arithmetic |
| F4 | Lump-sum future value `FV = PV·(1+r)^t` (annual compounding) | Compound interest |
| F5 | Year-wise value `V_k = PV·(1+r)^k` | Compound interest |
| F6 | Gain/loss `FV − PV`; compounding effect `FV − PV·(1+r·t)` (vs. simple interest) | Definition |
| F7 | CAGR `(FV/PV)^(1/t) − 1` | Definition |
| F8 | Real rate `(1+r)/(1+π) − 1`; real value `FV/(1+π)^t` | Fisher relation |
| F9 | Required return `(Target/PV)^(1/t) − 1` | Inverse of F4 |
| F10 | Hypothetical downside `PV·(1−d)` and `FV·(1−d)` | Definition |

**Costs and taxes:** excluded from all v1 calculations and listed as excluded on every result. Examples: fund expense ratios, brokerage, STT, stamp duty, exit loads, GST, capital-gains tax. Tax law is reported as having moved to the Income-tax Act, 2025 from 1 Apr 2026, with listed-equity LTCG at 12.5% above ₹1.25 lakh and STCG at 20% **[S]**. Section numbering under the new Act is inconsistent across sources [U]. Tax may be **explained** later, after verification, but will not be calculated in v1.

---

## 6. Assumptions and limitations
1. Returns are **user-chosen constants** compounded annually. Real markets do not return a constant rate, and the order of returns matters.
2. There are **no default scenario returns**. Deriving a defensible low/moderate/high range needs a licensed historical TRI series (method: P10/P50/P90 of rolling N-year CAGRs, defined in 02-methodology). Until then all three rates come from the user.
3. Downside illustrations are **hypothetical** user-chosen percentages, not historical events.
4. Inflation is a single constant. The 4% reference is a policy target, not a forecast.
5. All amounts are nominal ₹ unless labelled "real".
6. No costs or taxes (§5).
7. Risk-assessment weights and bands are **design choices** (03-methodology). They have not been empirically calibrated or validated against outcomes.
8. Results depend entirely on the accuracy of the user's inputs.

## 7. Privacy and security approach
- All calculations run client-side. **No accounts, no server-side storage of financial inputs, no analytics on input values.**
- No browser storage of inputs by default. An optional "remember on this device" setting may be considered later, off by default.
- DPDP Rules 2025 were notified about 13–14 Nov 2025, with most obligations reported to apply about 18 months later (around May 2027) **[S]**. Collecting no personal data keeps exposure minimal. A privacy notice is still published. Verify against the MeitY gazette.
- Strict Content-Security-Policy, no third-party scripts on calculator pages, dependency audit in CI.

## 8. Areas where authoritative information is unavailable
1. **Moneycontrol terms of use and data licensing:** inaccessible to us. Owner must check.
2. **NSE Indices licence cost and permitted uses:** requires direct contact.
3. **Whether a free, personalised, interactive tool falls within "investment advice"** under the current IA Regs: no SEBI guidance found that addresses this directly. Counsel.
4. **An authoritative Indian emergency-fund norm:** none found on SEBI's investor site.
5. **An official mapping from risk score to return expectations:** none exists. SEBI's Riskometer applies to MF schemes, not to investors.
6. **Contents of the 6 Feb 2026 IA Master Circular and the 10 Oct 2026 RA amendment:** not yet reviewed.
7. Gazette text of S.O.1580(E) (inflation target): not read directly.

## 9. Source monitoring: what can honestly be built
- **Feasible now:** a version-controlled registry ([source-registry.seed.json](source-registry.seed.json)) plus a scheduled job that re-fetches each registry URL and SEBI listing page, compares the "last amended" text and the content hash, and **opens an issue for a human**. It never edits rules or production content.
- **Not claimed:** "continuous" or "real-time" monitoring. The UI shows only "Sources last verified on <date>" from the registry.
- **Limitation:** SEBI pages sometimes time out or change layout, so a failed check is reported as "check failed". It is never treated as "no change".

## 10. Feasibility summary

| Category | Items |
|---|---|
| **Can build reliably now** | Calculation engine F1–F10 with tests; Module 1; Module 3 (user-entered scenarios); Module 2 questionnaire and scoring (as an educational tool); Module 5 dashboard; source registry and monitor job; disclaimers; privacy-first architecture |
| **Needs external permission** | Any Nifty/Sensex history (NSE Indices / Asia Index licence); any Moneycontrol content or data (written licence); CPI series (terms check) |
| **Needs legal review before launch** | Q1–Q6 below |
| **Cannot be verified at present** | Scenario defaults; historical drawdown figures; risk-band calibration; emergency-fund norm |

## 11. Questions for Indian securities-law counsel
1. Since the 16-12-2024 amendment, "investment advice" refers to **securities** and "includes financial planning". Is a tool that analyses a user's finances and goals but never refers to any security within Reg 2(1)(l)?
2. Does a free, personalised, interactive web tool fall within the public-media proviso to Reg 2(1)(l)?
3. Does Reg 4(a) apply, or does personalisation take the tool out of it?
4. With no fees, ads or referrals, could anything count as "consideration" ("non-cash", "receivable")? For example, future monetisation plans, donations, or grants.
5. Does an educational risk classification (Conservative / Moderate / Growth-oriented) with no product suggestion amount to risk profiling as part of advice?
6. Would displaying licensed historical index returns, or deriving scenario ranges from them, be an implied "claim of returns" under Intermediaries Reg 16A? Does that matter if no regulated entity is associated with us?
7. Do any IT Act / DPDP obligations apply if no personal data leaves the browser?

## 12. Open-items checklist

| Owner | Item |
|---|---|
| Product owner | Read the Moneycontrol terms; decide whether to request a licence |
| Product owner | Contact NSE Indices / an authorised vendor for a TRI licence quote |
| Product owner | Engage securities-law counsel with §4 and §11 |
| Engineering | Analyse the RA amendment effective 9 Nov 2026 once it is in force; re-run the monitor weekly |
| Engineering | Read the S.O.1580(E) gazette text; upgrade the inflation row to [P] |
| Engineering | Check CPI data licence terms (MOSPI / RBI DBIE / data.gov.in) |
| Engineering | Verify DPDP Rules dates against the MeitY gazette |

## 13. Sources consulted (accessed 1–2 Nov 2026)
**Primary [P]**
- SEBI IA Regs consolidated text (amended up to 25-11-2025): see the §2.1 link
- SEBI circular SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2025/11 (29-01-2025, updated 08-05-2026): see the §2.2 link
- SEBI circular HO/47/17/12(11)2025-MRD-POD3/I/11107/2026 (08-05-2026): see the §2.2 link
- SEBI regulations listing: <https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=3>
- SEBI investor calculators: <https://investor.sebi.gov.in/calculators/index.html>
- SEBI "Money matters": <https://investor.sebi.gov.in/moneymatters-inc-exp.html>
- NSE Indices terms of use: <https://www.niftyindices.com/terms-of-use>

**Official secondary [R]**
- RBI speech "Inflation Targeting in India: The Past, The Present and The Future" (May 2026), citing S.O.1580(E): <https://rbidocs.rbi.org.in/rdocs/Speeches/PDFs/ITNCAER05052026D577FDFF9E9D4BA7913E41BAD5F00A93.PDF>

**Secondary leads [S]** (not relied on as authority)
- Mondaq: IA Second Amendment Regulations 2024 — <https://www.mondaq.com/india/securities/1616712/>
- taxguru: SEBI IA guidelines / MITC — <https://taxguru.in/sebi/sebi-issues-guidelines-investment-advisers-mitc.html>
- Business Standard: SEBI launches PaRRVA (8 Dec 2025) — <https://www.business-standard.com/markets/news/sebi-launches-return-verification-framework-parrva-to-curb-fake-performance-claims-125120800842_1.html>
- Business Standard: F&O losses FY25 study (7 Jul 2025) — <https://www.business-standard.com/markets/news/net-losses-of-traders-in-fo-widens-in-fy25-sebi-study-125070701221_1.html>
- YourStory: DPDP Rules 2025 rollout (Nov 2025) — <https://yourstory.com/2025/11/digital-personal-data-protection-dpdp-rules-2025-rollout-over-18-months>
- Business Today: inflation target retained (25 Mar 2026) — <https://www.businesstoday.in/latest/economy/story/govt-retains-inflation-target-at-4-with-2-6-band-for-next-five-years-522390-2026-03-25>
- studycafe: capital gains under the Income-tax Act 2025 — <https://studycafe.in/overview-of-new-capital-gains-tax-structure-under-income-tax-act-2025-416536.html>

**Rejected as unreliable or unlicensed:** Moneycontrol scraper packages and how-to guides; Kaggle/Baselight index datasets; third-party TRI downloads; UPSC current-affairs sites; the 2013 un-amended copy of the IA Regs on icmai.in.
