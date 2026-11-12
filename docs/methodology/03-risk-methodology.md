# 03 — Risk Assessment Methodology (Module 2)

**Version:** 0.1 (draft for review). **Date:** 2 Nov 2026

> **Status of this methodology.** This is the project's **own educational methodology**. It is **not** a SEBI category, score or approved questionnaire, and it is not a suitability assessment. The weights and bands are design choices that have **not** been empirically calibrated. The classification never leads to a product, allocation or "you should" statement.

## 1. Design benchmark
SEBI IA Regulation 16 binds only registered advisers, but it is the best Indian statement of what a fair risk-profiling process looks like (01 §2.1, **[P]**). We adopt it voluntarily:

| Reg 16 element | How this methodology meets it |
|---|---|
| Collect age, objective/horizon, income, existing investments, risk appetite, liabilities | Income, EMIs, savings and investments come from Module 1. Horizon is C5. Tolerance is T1–T4. Objective is O1. Age is **not collected**: it adds privacy cost, and horizon captures its main effect. Counsel to confirm |
| Assess **capacity** to absorb loss | Capacity score (§3), computed mostly from objective inputs |
| Distinguish **unwilling vs. unable** to bear loss | Separate tolerance score (§4) vs. capacity score (§3). Conflicts flagged (§7) |
| Don't give inappropriate weight to single answers | Equal weights within each dimension. The only overrides are the capacity caps in §3.2, which are disclosed |
| Tools fit for purpose; limitations identified | §9 limitations are shown on the result screen |
| Clear questions, no leading questions or double negatives | Plain-English review checklist (§8). Answer options are presented in a neutral order |
| Communicate the profile | The result screen shows the scores, the binding dimension, every contributing answer, and conflicts |
| Update periodically | The result shows its date and a "redo if your situation changes" prompt. Nothing is stored |

## 2. Three dimensions, never merged into one number

| Dimension | Question it answers | Basis |
|---|---|---|
| **Risk capacity** | How much loss can you *afford*? | Mostly computed from Module 1 inputs |
| **Risk tolerance** | How much uncertainty are you *comfortable* with? | Self-reported (psychometric) |
| **Risk requirement** | How much growth does your goal *need*? | Calculated (F9) |

Plus an **informational knowledge & experience** check (§6). It produces flags but does not change the classification.

## 3. Risk capacity (0–100)
Each item is scored 0–4. Capacity = mean of the item scores × 25.

| ID | Item | Source | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|---|---|
| C1 | Emergency coverage C (F2), months | computed | < 1 | 1 to < 3 | 3 to < 6 | 6 to < 12 | ≥ 12 |
| C2 | EMIs ÷ income (L/I) | computed | ≥ 50% | 40–50% | 30–40% | 15–30% | < 15% |
| C3 | Surplus ÷ income (S/I) | computed | ≤ 0% | 0–10% | 10–20% | 20–35% | > 35% |
| C4 | "How predictable is your monthly income over the next 12 months?" | self | Not at all | Slightly | Moderately | Mostly | Fully |
| C5 | "When might you need this money back?" | self | < 1 yr | 1–3 yrs | 3–5 yrs | 5–10 yrs | > 10 yrs |
| C6 | PV ÷ (SV + INV), i.e. this amount's share of non-emergency savings and investments | computed | > 75% | 50–75% | 25–50% | 10–25% | < 10% |
| C7 | "If this money lost a quarter of its value and took years to recover, how much would that affect your essential spending, EMIs or near-term plans?" | self | Severely | Significantly | Moderately | Slightly | Not at all |

Edge rules:
- I = 0 → C2 = 0 and C3 = 0.
- E + L = 0 → C1 is scored as 4 only if ES > 0, otherwise 0.
- SV + INV = 0 → C6 = 0, and flag "this amount would be all your non-emergency money".
- Lower interval bounds are inclusive.

### 3.1 Why these bands
They are **design parameters**, chosen to spread typical inputs across the scale. **No authoritative Indian source sets these thresholds**, and the UI says so. They will be reviewed after expert input. They are never shown to the user as targets ("you should have X months").

### 3.2 Capacity caps (disclosed overrides)
If **any** of these is true, capacity is capped at 39 (the top of the Conservative band), and the reason is shown:
- S < 0 (monthly deficit)
- C < 1 month (when E + L > 0)
- horizon < 1 year (C5 = 0)

Rationale: in each case a market loss could directly hit essentials or a near-term need. This is the one place we deliberately give a single answer extra weight, and it is disclosed.

## 4. Risk tolerance (0–100)
Mean of the scored items × 25. T4 is excluded when not applicable.

| ID | Question | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|---|
| T1 | "Imagine your investment fell by 20% within a few months. What would you most likely do?" | Sell all of it | Sell some of it | Keep it, but feel very uneasy | Keep it and wait | Add more, if I could afford to |
| T2 | "Which statement fits you best?" | I can't accept any fall in value | I can accept small, short falls | I can accept moderate falls for some growth | I can accept large falls for more long-term growth | I can accept very large falls for the most long-term growth |
| T3 | "What is the largest one-year fall you could live with without changing your plans?" | 0% | Up to 5% | Up to 15% | Up to 30% | More than 30% |
| T4 | "Have you held an investment that fell in value? What did you do?" | Sold quickly | Sold part | Held, but it was stressful | Held calmly | Added more |
|  | *T4 option:* "I have never held an investment that fell" | **not scored** (so inexperience doesn't count as low tolerance) | | | | |

The numbers in T1–T3 are **hypothetical prompts**, not market statistics.

## 5. Risk requirement
- Inputs: goal amount G (future ₹), PV, horizon t (Module 3), and the user's three scenario rates.
- Output: `r_req` (F9), nominal and real (F8, using the inflation value the user entered).
- Comparison is **only against the user's own assumptions**:
  - "Your goal needs about X% a year."
  - It is then placed relative to the user's own rates: within your lower rate / between your lower and moderate rates / between your moderate and higher rates / above your highest rate.
- **Not mapped to a risk band.** That would need licensed historical return data and a validated mapping, and neither exists (01 §8).

## 6. Knowledge & experience (informational; does not change the classification)
- **K1 Products used** (multi-select): none; bank deposits / small savings; mutual funds; listed shares; derivatives (F&O).
- **K2 Three factual questions**, scored 0–3:
  1. "₹1,000 rises 10%, then falls 10%. It's now worth…": ₹1,000 / **₹990** / ₹1,010.
  2. "Your money grows 5% a year and prices rise 6% a year. What you can buy with it…": **falls** / stays the same / rises.
  3. "A diversified fund guarantees you can't lose money": True / **False**.

  After the user answers, each question shows a short explanation.

## 7. Classification and conflicts
- **Classification score** = `min(capacity, tolerance)`. You should not take more risk than you can afford, *or* more than you are comfortable with. This is a documented design choice, not a regulatory rule.
- **Educational bands:** 0–39 **Conservative**, 40–69 **Moderate**, 70–100 **Growth-oriented**.
- The display shows both scores, which one was binding, and every item's contribution.

| Flag | Condition | Message (draft) |
|---|---|---|
| X1 | Tolerance band > capacity band | "You're comfortable with more ups and downs than your current finances may be able to absorb." |
| X2 | Capacity band > tolerance band | "Your finances could absorb more fluctuation than you're comfortable with. Comfort matters too." |
| X3 | r_req > the user's highest scenario rate | "Your goal needs more growth than even your highest assumption. You could revisit the goal, the timeline or the amount." |
| X4 | O1 = growth/maximum growth and class = Conservative | "Your stated objective and your assessed profile point in different directions." |
| X5 | Tolerance ≥ 70 and K2 ≤ 1 | "You're comfortable with risk, but a few basics may be worth reviewing first." Links to education |
| X6 | C5 ≤ 1 (≤ 3 yrs) and O1 = growth/maximum growth | "Growth-focused goals usually face more ups and downs over short periods." Wording to be checked against a source before launch, or removed |
| X7 | Capacity cap applied (§3.2) | States which cap applied and why |

**O1 (objective, unscored):** "What's the main aim for this money?" Options: Protect it / Mostly stability, some growth / Balance / Mostly growth / Maximum growth.

## 8. Question-wording checklist (applied before launch)
- Plain words, under 25 words, no double negatives, no jargon without a tooltip.
- Neutral option order, with no option framed as "correct" (except K2, which is a factual quiz).
- Hindi and other language versions to be reviewed by a native speaker, not machine-translated alone.
- Usability test with at least 5 first-time investors. Record any confusion and revise.

## 9. Limitations (shown on the result screen)
1. Weights and bands have not been empirically calibrated.
2. Self-reported answers can differ from real behaviour in an actual downturn.
3. The result reflects one moment in time and the inputs given.
4. Age, dependants, insurance cover and health are not collected (a privacy-minimising choice), so they are not reflected.
5. This is **not** a suitability assessment and **not** advice about any product.

## 10. Test plan
- Unit tests for each item's banding, including every boundary (e.g. C1 at exactly 1, 3, 6 and 12 months).
- The caps trigger exactly under the §3.2 conditions.
- T4 "never held" is excluded from the mean, not scored as 0.
- `min()` binding-dimension reporting is correct, including ties.
- Every conflict flag has a positive and a negative test case.
- Snapshot tests of the full "why" explanation object for 6 personas (documented in the test fixtures).
