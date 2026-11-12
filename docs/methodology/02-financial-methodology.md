# 02 — Financial Methodology (Calculation Engine Specification)

**Version:** 0.1 (draft for review). **Date:** 2 Nov 2026. **Companion:** [01-research-and-feasibility.md](../research/01-research-and-feasibility.md)

This document is the contract for `packages/calc-engine`. Every number the website displays must come from a formula defined here, computed by deterministic, tested code. The AI layer never computes or alters any number.

## 1. Engine principles
1. **Pure functions.** No I/O, no randomness, no clock. The same inputs always give the same outputs.
2. **Decimal arithmetic.** Use `decimal.js` with precision ≥ 34 significant digits. JavaScript floating-point numbers are never used for money.
3. **Round only for display.** Full precision is carried internally. Display rules: ₹ to the nearest rupee (rounding half-up) on summary cards, ₹ to paise in tables, rates to 2 decimal places in %.
4. **Traceable results.** Every function returns `{ value, formulaId, inputs, assumptions[], warnings[] }`. The dashboard renders "how was this calculated?" from that object.
5. **Validated inputs.** Invalid input throws a typed `InputError` with a user-readable message. Values are never silently coerced.
6. **Verification gate.** A formula is marked `verified: true` only when all its golden vectors (§5) pass in CI. The UI refuses to render any unverified formula's output as a result.
7. **Nominal vs. real.** Every value carries a `basis: "nominal" | "real"` tag, and the UI labels it.

## 2. Input domains

| Symbol | Meaning | Unit | Allowed range | Notes |
|---|---|---|---|---|
| `I` | Monthly take-home income | ₹/month | 0 ≤ I ≤ 10¹⁰ | Up to 2 decimals |
| `E` | Monthly essential expenses | ₹/month | 0 ≤ E ≤ 10¹⁰ | |
| `L` | Monthly EMIs / fixed obligations | ₹/month | 0 ≤ L ≤ 10¹⁰ | |
| `ES` | Emergency savings | ₹ | 0 ≤ ES ≤ 10¹² | Kept separate from `SV` |
| `SV` | Other savings (excluding emergency savings) | ₹ | 0 ≤ SV ≤ 10¹² | |
| `INV` | Existing investments (current value) | ₹ | 0 ≤ INV ≤ 10¹² | |
| `T` | User's own emergency target | months | optional; 0 < T ≤ 60 | The app never pre-fills it |
| `PV` | One-time amount considered for investing | ₹ | 0 < PV ≤ 10¹² | |
| `t` | Horizon | whole years | 1 ≤ t ≤ 50 | Fractional years not supported in v1 |
| `r` | Assumed annual return (nominal) | decimal | −0.99 ≤ r ≤ 0.50 | `r > −1` is a mathematical requirement. The 0.50 cap is a **sanity bound**, not a market claim |
| `π` | Assumed annual inflation | decimal | −0.10 ≤ π ≤ 0.50 | Reference value offered: 0.04 (policy target, see 01 §3) |
| `d` | Hypothetical fall | decimal | 0 ≤ d ≤ 1 | |
| `G` | Goal amount (future, nominal) | ₹ | 0 < G ≤ 10¹³ | |

These upper bounds only guard against input mistakes. They are not financial assumptions.

## 3. Formulas

### F1: Monthly surplus
`S = I − E − L`
- **Principle:** arithmetic identity.
- **Output:** ₹/month. It may be negative; a negative S is shown as a monthly *deficit*, with no further judgement.
- **Edge cases:** I = 0 is valid (S ≤ 0).

### F2: Emergency coverage
`C = ES / (E + L)` (months)
- **Principle:** arithmetic; the number of months the reserve would pay for essentials plus EMIs.
- **Edge case:** `E + L = 0` → C is undefined and is shown as "n/a (no monthly essentials/EMIs entered)".
- **No target is implied.** SEBI's investor material recommends an emergency fund but gives no number of months (01 §2.4).

### F3: Shortfall against the user's own target (optional)
`SF = max(0, T·(E + L) − ES)`
- Computed only if the user entered T. Labelled "against the target you set".

### F4: Lump-sum future value
`FV = PV · (1 + r)^t`
- **Principle:** compound interest with annual compounding at a constant rate, and no withdrawals, costs or taxes.
- **Variables:** see §2.
- **Edge cases:** r = 0 → FV = PV. Negative r (> −1) → FV < PV. Integer t only.
- **Horizon in months or days:** the user may enter the horizon as years (1 to 50), months (1 to 600) or days (1 to 18,250). Let `W` be the whole years and `f` the leftover fraction of a year: months → `W = ⌊m ÷ 12⌋`, `f = (m mod 12) ÷ 12`; days → `W = ⌊d ÷ 365⌋`, `f = (d mod 365) ÷ 365` (a year is taken as 365 days). Whole years compound once a year as above; the leftover earns the rate as **simple interest** for that fraction: `FV = PV · (1 + r)^W · (1 + r·f)`. The real value divides by `(1 + π)^W · (1 + π·f)`. The simple-interest comparison in F6 uses `t = W + f`. For F9 with a part-year, the required rate is the `r` that solves `PV · (1 + r)^W · (1 + r·f) = G` (found numerically); with `f = 0` it is the closed form. All of this is exact in paise (BigInt) except F9 and CAGR, which are shown as percentages. Tests: `tools/tests/horizon.test.js`.

### F5: Year-wise breakdown
For k = 1..t: `V_k = PV · (1 + r)^k`, gain to date `V_k − PV`, gain in year k `V_k − V_{k−1}` (with V₀ = PV).
- The final row must equal F4 exactly (asserted in tests).

### F6: Gain and compounding effect
- Estimated gain/loss: `GL = FV − PV`
- Simple-interest comparison: `SI = PV · (1 + r·t)`
- **Compounding effect:** `CE = FV − SI`. This is the part of the gain that comes from earning returns on returns.
- Edge: for r < 0 the "compounding effect" is reported but labelled, since compounding then *reduces* the loss relative to simple interest.

### F7: CAGR
`CAGR = (FV / PV)^(1/t) − 1`
- **Principle:** definition of the compound annual growth rate.
- **Domain:** PV > 0, FV ≥ 0, t > 0. FV = 0 → CAGR = −100%.
- **Use:** shown to confirm that a projection's CAGR equals the assumed r (a consistency check), and for any licensed historical series later.

### F8: Real (inflation-adjusted) return and value
- Real rate: `r_real = (1 + r) / (1 + π) − 1` (Fisher relation; the exact form, **not** the approximation `r − π`).
- Real value in today's rupees: `FV_real = FV / (1 + π)^t`.
- The UI always shows nominal and real side by side, labelled.

### F9: Required return (risk requirement, used by Module 2)
`r_req = (G / PV)^(1/t) − 1`
- **Principle:** inverse of F4.
- r_req ≤ 0 means the goal is already reached in nominal terms at a 0% return.
- Real version: `(1 + r_req)/(1 + π) − 1`.

### F10: Hypothetical downside illustration
- Immediate fall: `PV · (1 − d)`
- Fall at the end of the horizon: `FV · (1 − d)`
- Labelled **hypothetical**. The d values are chosen by the user. Suggested presets are −10%, −25%, −40%, presented as round illustrative numbers, **not** historical events.

### F11: Recovery gain (breakeven after a fall)
`RG = L / (1 − L)`, where `L` is the fall as a fraction (0 ≤ L < 1).
- **Principle:** a fall to `(1 − L)` of the starting value must grow by `1/(1 − L) − 1` to return to the start. The gain is measured on the smaller remaining amount, so it is always larger than the fall.
- **From amounts:** with starting amount `O` and current value `C` (0 < C ≤ O): `L = (O − C)/O`, `RG = (O − C)/C`, rupees needed = `O − C`. When amounts are entered, `RG` is computed from the amounts directly, not from a rounded `L`.
- **Edge cases:** L = 0 → RG = 0. L = 1 (C = 0) → recovery is impossible: no gain can restore a value of zero (never shown as a number). L > 1, negative, non-numeric → `InputError`. C > O is a gain, not a fall → not a recovery case.
- **Display:** percentages to 2 decimals (rounded half-up). Percent input is accepted to 2 decimals, from 0 up to 99.99.

### F12: Years to recover at an assumed rate (optional, builds on F4 and F11)
Smallest whole `k` such that `(1 + r)^k ≥ O / C`, tested with exact integer arithmetic: `(10000 + bp)^k · C ≥ O · 10000^k`. A decimal estimate `ln(O/C) / ln(1 + r)` is shown beside it.
- **Edge cases:** r ≤ 0 → never recovers at that rate (no number). The search stops at 1,000 years and reports "more than 1,000 years".
- **Meaning:** arithmetic only. It assumes returns resume at a steady rate after the fall. It is not a statement about how markets behave, and recovery is never promised.

### F13: Cost of one stock trade (contract-note charges and tax, equity delivery on NSE)
Applies to one buy and one sell of listed equity shares held as delivery on NSE. Each side is worked out the way a broker's contract note shows it. The rates below were checked on 6 Nov 2026 against a broker's published charges page, and they reproduce, to the paisa, the two contract notes supplied by the product owner (buy ₹1,997.40 → pay ₹2,005.37; sell ₹2,198.60 → receive ₹2,190.62).
- `buy value = buy price × quantity`; `sell value = sell price × quantity` (prices to 2 decimals; whole shares).
- **Per side**, with `V` the side's value and `n` its executed orders (assumed equal, each `V ÷ n`):
  - Brokerage per order = `min(2.5% × (V ÷ n), max(min(0.1% × (V ÷ n), ₹20), ₹5))`; side brokerage = `n × per order`. Equivalent to the supplied rule: if 2.5% of the order value ≤ ₹5, brokerage = 2.5% of the value; otherwise max(min(0.1% × value, ₹20), ₹5). One broker plan (matches a discount broker's help page), not a regulated rate. The 2.5% ceiling matches exchange bye-laws (secondary sources only).
  - Exchange transaction charges = 0.00307% × V (NSE equity cash). The NSE circular was not retrieved; BSE differs.
  - SEBI turnover fee = ₹10 per crore = 0.0001% × V. NSE IPFT = ₹0.01 per crore = 0.0000001% × V.
  - GST = 18% × (brokerage + exchange charges + SEBI fee + IPFT), as itemised on the contract notes.
  - STT = 0.1% × V on the buy side and on the sell side (delivery), **rounded to the nearest rupee**.
  - Stamp duty = 0.015% × V on the **buy side only**, **rounded to the nearest rupee** (per a law-firm note on the Indian Stamp (Collection of Stamp-Duty through Stock Exchanges, Clearing Corporations and Depositories) Rules, 2019; matches ₹0.00 on the ₹1,997.40 buy).
  - Exchange, SEBI, IPFT and GST are rounded half-up to the paisa.
  - `you pay = buy value + buy-side charges`; `you receive = sell value − sell-side charges`.
- `profit after all charges = you receive − you pay`.
- **Taxable gain** = `sell value − buy value − (all charges except STT)`. STT is not deductible when computing capital gains; brokerage, exchange charges, SEBI fee, IPFT, GST and stamp duty are treated as costs of buying and selling. (To be confirmed by a chartered accountant.)
- **Tax applies only if the taxable gain > 0.** Held 12 months or less → short-term, rate 20%. Held more than 12 months → long-term, rate 12.5%. `tax = rate × taxable gain`, rounded half-up to the paisa; `cess = 4% × tax`, on the rounded tax.
- `you keep = profit after all charges − tax − cess`. `total cost of the trade = all charges + tax + cess`.
- **Break-even sell price** = smallest price (to the paisa) at which `you receive ≥ you pay`. Sell-side charges rise with the sell value, so it is found by stepping up from `you pay ÷ quantity` until stable.
- **Explicitly not included:** depository (DP) charges on a sale (billed separately per stock, broker-specific), BSE trades, intraday trades (different STT; taxed as business income), surcharge, the annual long-term gains exemption (₹1.25 lakh under current law, **not applied, so long-term tax can be overstated**), loss set-off and carry-forward, other broker plans.
- **Scope:** the 20% and 12.5% rates are for listed equity shares where STT is paid. Other assets differ.

### F14: Investment return (absolute, not annualised)
`return % = [(current value − investment) / investment] × 100`
- **Principle:** the gain or loss as a share of the amount invested, over the whole holding period.
- **Domain:** investment > 0. A negative result is a loss; −100% means the value is zero.
- **Not annualised:** it ignores how long the money was held. For a yearly rate over several years use F7 (CAGR).
- **Use:** shown on the home page, and computed on the Planner results for each assumption: `return % = gain ÷ amount × 100`, exact on paise, rounded half up to 0.01%.

## 4. Scenario methodology

### 4.1 v1 (now): user-defined scenarios
- The user enters three rates: lower, moderate, higher. They **must** be in ascending order, otherwise the app shows a validation message.
- **No defaults are pre-filled.** A banner explains that the platform does not yet hold a licensed historical dataset, so it will not suggest rates.
- Each scenario runs F4–F8 and F10.

### 4.2 Future (only after a data licence): historically derived ranges
Activated only when a licensed Nifty 50 TRI (or equivalent) series is available and this section has been reviewed:
1. Data: monthly TRI closing values, with the licensed source and date range recorded.
2. For a horizon of t years, compute every rolling t-year CAGR (F7) from each month-end start date.
3. Lower / moderate / higher = **P10 / P50 / P90** of that distribution.
4. Display: the sample period, the number of windows, and the facts that windows overlap (so they are not independent), that the past does not predict the future, and that an index is not directly investable (costs and tracking difference).
5. This feeds the defaults only. The user can still override them, and overrides are labelled.

## 5. Golden test vectors
These were computed independently with Python `decimal` (prec = 40), separately from the TypeScript implementation, and spot-checked by hand.

| ID | Formula | Inputs | Expected |
|---|---|---|---|
| G1 | F4 | PV 1,00,000; r 12%; t 10 | **3,10,584.82** |
| G2 | F4 | PV 50,000; r 0%; t 7 | 50,000.00 |
| G3 | F4 | PV 1,00,000; r −5%; t 3 | 85,737.50 |
| G4 | F4 | PV 2,50,000; r 8%; t 1 | 2,70,000.00 |
| G5 | F5 | PV 1,00,000; r 10%; k = 1..5 | 1,10,000.00; 1,21,000.00; 1,33,100.00; 1,46,410.00; 1,61,051.00 |
| G6 | F7 | 1,00,000 → 2,00,000; t 5 | 0.148698 (14.87%) |
| G7 | F7 | 1,00,000 → 1,00,000; t 4 | 0.000000 |
| G8 | F8 | r 12%; π 4% | 0.076923 (7.69%) |
| G9 | F8 | FV of G1; π 4%; t 10 | 2,09,819.98 |
| G10 | F9 | G 5,00,000; PV 1,00,000; t 15 | 0.113264 (11.33%) |
| G11 | F10 | PV 3,00,000; d 25% | 2,25,000.00 |
| G12 | F1 | I 80,000; E 45,000; L 15,000 | 20,000 |
| G13 | F2 | ES 2,40,000; E 45,000; L 15,000 | 4.00 months |
| G14 | F4 | PV 1; r 7.2%; t 10 | 2.0042 (rule-of-72 sanity check) |
| G15 | F11 | L = 10% | 11.11% |
| G16 | F11 | L = 25% | 33.33% |
| G17 | F11 | L = 40% | 66.67% |
| G18 | F11 | L = 50% | 100.00% |
| G19 | F11 | L = 90% | 900.00% |
| G20 | F11 | O ₹1,00,000; C ₹75,000 | RG 33.33%; ₹25,000 needed |
| G21 | F12 | L = 25%; r = 10% | 4 whole years (1.1³ = 1.331 < 1.3333; 1.1⁴ = 1.4641) |
| G22 | F12 | L = 50%; r = 50% | 2 whole years (1.5¹ = 1.5 < 2; 1.5² = 2.25) |
| G23 | F12 | L = 25%; r = 0% | never |
| G24 | F13 | short-term profit: buy ₹500, sell ₹600, qty 100, orders 1+1, short-term | charges ₹169.32; profit after charges ₹9,830.68; taxable ₹9,940.68; tax ₹1,988.14; cess ₹79.53; keep ₹7,763.01; total cost ₹2,236.99 |
| G25 | F13 | long-term profit: buy ₹500, sell ₹600, qty 100, orders 1+1, long-term | charges ₹169.32; profit after charges ₹9,830.68; tax ₹1,242.59; cess ₹49.70; keep ₹8,538.39; total cost ₹1,461.61 |
| G26 | F13 | loss: buy ₹600, sell ₹500, qty 100, orders 1+1, short-term | charges ₹170.32; profit after charges −₹10,170.32; tax ₹0.00; cess ₹0.00; keep −₹10,170.32; total cost ₹170.32 |
| G27 | F13 | charges exceed profit: buy ₹500, sell ₹500.2, qty 100, orders 1+1, short-term | charges ₹158.96; profit after charges −₹138.96; tax ₹0.00; cess ₹0.00; keep −₹138.96; total cost ₹158.96 |
| G28 | F13 | partial fills (3 buy + 2 sell orders): buy ₹250.55, sell ₹310.4, qty 1000, orders 3+2, long-term | charges ₹737.98; profit after charges ₹59,112.02; tax ₹7,459.13; cess ₹298.37; keep ₹51,354.52; total cost ₹8,495.48 |
| G29 | F13 | small orders: buy ₹500, sell ₹600, qty 10, orders 1+1, short-term | charges ₹25.39; profit after charges ₹974.61; tax ₹197.12; cess ₹7.88; keep ₹769.61; total cost ₹230.39 |
| G30 | F13 | tiny orders (2.5% brokerage limit; STT and stamp round to ₹0): buy ₹100, sell ₹150, qty 1, orders 1+1, short-term | charges ₹7.38; profit after charges ₹42.62; tax ₹8.52; cess ₹0.34; keep ₹33.76; total cost ₹16.24 |
| G31 | F13 | mid orders: buy ₹1,000, sell ₹1,100, qty 10, orders 1+1, short-term | charges ₹48.57; profit after charges ₹951.43; tax ₹194.49; cess ₹7.78; keep ₹749.16; total cost ₹250.84 |
| G32 | F13 | the two supplied contract notes as one trade: buy ₹1,997.40, sell ₹2,198.60, qty 1, orders 1+1, short-term | you pay ₹2,005.37; you receive ₹2,190.62; charges ₹15.95; profit after charges ₹185.25; taxable ₹189.25; tax ₹37.85; cess ₹1.51; keep ₹145.89 |

Script: [golden_vectors.py](golden_vectors.py) (moves to `packages/calc-engine/golden/` during the build so CI can regenerate and diff the vectors).

## 6. Test plan (per formula)
- **Normal cases:** the golden vectors above.
- **Boundary cases:** r = 0; r = −0.99; r = 0.50; t = 1; t = 50; PV at its minimum and maximum; E + L = 0; d = 0 and d = 1; G = PV.
- **Invalid inputs:** negative money; t = 0, non-integer or > 50; r ≤ −1 or > 0.5; NaN, Infinity, empty string, or text in a numeric field; scenarios not in ascending order. Each must produce an `InputError`, never a number.
- **Property tests (fast-check):**
  - FV is monotonic in r and in t (for r > 0).
  - F7(F4(PV, r, t)) = r within 1e-20.
  - F9 inverts F4.
  - Real value ≤ nominal value when π > 0.
  - The last row of F5 equals F4.
- **Cross-check:** golden vectors are regenerated by the Python script in CI and must match the TypeScript output to the paisa (rates to 1e-9).
- **Cross-check against SEBI's public calculator:** manual spot-check of F4 against investor.sebi.gov.in "Standard Compound Interest" for 3 cases, recorded with date. This confirms convention only and is not used as authority.

## 7. Explicitly excluded (v1)
SIP and any recurring contributions; contribution step-ups; XIRR; withdrawals; fund expense ratios; brokerage; STT; stamp duty; exit loads; GST; capital-gains tax; currency effects. Every result card lists "Not included: costs, charges and taxes".

## 8. Mandatory result disclaimer (draft wording, based on SEBI's calculator disclaimer)
> These figures are illustrations based only on the numbers and rates you entered. They are not predictions, not guaranteed, and not investment advice. Markets do not have a fixed or predictable rate of return, and you can lose money. Costs, charges and taxes are not included.
