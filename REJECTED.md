# Rejected

## Part A: Acceptance criteria

I checked all 8 criteria against my hand-trace and my code. **4 are wrong and refused (2, 6, 7, 8).** 4 are correct and accepted (1, 3, 4, 5); they are listed at the end so the check is complete.

### Refused: Criterion 2 — "E7 causes exactly one overdraft fee, on Day 2"

**Why it is wrong:** E7 causes **three** fees, not one.

E7 is dated Day 2, so it lowers Day 2 **and every day after it**:

| Day | Closing balance after E7 (before that day's own fee) | Fee? |
|---|---|---|
| Day 2 | 250.00 - 620.00 = **-370.00** | Yes |
| Day 3 | -370.00 - 25.00 (Day 2 fee) + 400.00 = **+5.00** | No |
| Day 4 | 5.00 - 185.00 = **-180.00** | Yes |
| Day 5 | -180.00 - 25.00 (Day 4 fee) = **-205.00** | Yes |

Also, no fee can be "assessed on Day 2": the system only learns about E7 on Day 5. The fee is **detected** on Day 5 and **belongs to** Day 2 (value date Day 2).

**Proof:** `test/fees.test.ts` and `test/scenario.test.ts` ("E7 triggers three fees").

### Refused: Criterion 6 — "After E9, all balances and fees return to their pre-E7 values"

**Why it is wrong:** some things can never "return", because the ledger is append-only and decisions are final.

- **Fees are not removed.** The three fees stay in the ledger. E9 only makes them wrong, so the system adds three **fee refunds** (new entries). The net effect is zero, but six fee records now exist that did not exist before E7.
- **Auth-B stays declined.** It was declined on Day 5 because of E7. That answer was already given; E9 cannot undo it.
- **History keeps the wrong numbers.** The Day 5 report showed -230.00. That report happened and stays in the history; later reports show the corrected value as a restatement.
- **Balances only come back because of my choice.** The final balances do match a world without E7, but only because I chose to refund the fees (AMBIGUITIES entry 6). If fees were kept, the balances would stay 75.00 lower.

**Proof:** `test/scenario.test.ts` (fees and refunds both in the ledger; Auth-B still declined on Day 6) and the deliberately failing test in `test/design-limits/`.

### Refused: Criterion 7 — "The three BHD instalments must each be BHD 3.334"

**Why it is wrong:** 3 x 3.334 = **10.002**, not 10.000. That would create 0.002 BHD out of nothing.

BHD has 3 decimals, so 10.000 cannot be split into three equal parts. The only split that adds up exactly is **3.333 + 3.333 + 3.334**. The extra 0.001 goes to the last instalment (AMBIGUITIES entry 9).

**Proof:** `test/money.test.ts` and `test/scenario.test.ts` ("E10 is posted as 3.333 + 3.333 + 3.334").

### Refused: Criterion 8 — "If the rounded daily accruals do not sum to the capitalized total, the remainder is discarded"

**Why it is wrong:** it contradicts a non-negotiable rule, which says the rounded daily accruals **must** add up exactly to the capitalized total. Discarding a remainder would mean they don't.

In my design the problem cannot happen: each day's interest is rounded first, and the capitalized total is simply **the sum of those rounded amounts**. There is no remainder to discard.

ACC-001: 0.10 + 0.10 + 0.26 + 0.19 + 0.19 + 0.19 = **1.03**, exactly.

**Proof:** `test/interest.test.ts` ("the rounded daily accruals sum exactly to the credited total").

### Accepted criteria (checked, correct)

- **Criterion 1** (Day 2 is -370.00 at end of Day 5, before fees): correct. 250.00 - 620.00 = -370.00. The fee line in the Day 5 output shows it.
- **Criterion 3** (Auth-A's settlement must be accepted): correct. Auth-A was approved on Day 2 (available 50.00), and 185.00 is within the 200.00 hold.
- **Criterion 4** (unknown settlements rejected, no money moves): correct, and applied to Auth-Z. I considered "force posting" it, as card networks sometimes do, but chose to reject it (AMBIGUITIES entry 8).
- **Criterion 5** (if Auth-B is approved, its hold lowers available, not ledger): correct as a rule, and tested. In this stream Auth-B is **declined** (available would be -245.00), so the condition never happens.

## Part B: Approaches abandoned during the build

| What I first did or planned | Why I dropped it |
|---|---|
| **My first reading of the brief** (kept in `notes.ts`): one fee on Day 2, Auth-B approved, three equal instalments, the fee "wiped out" after E9. | The hand-trace proved all four wrong: three fees, Auth-B declined, an unequal split, and refunds instead of deletions. |
| **Building a frontend.** | The brief says "no UI". It would add work and more to defend, for no marks. |
| **Accepting settlements bigger than the hold.** The first version of `authorizations.ts` did this. | Changed to reject, to stay consistent with Auth-Z: money only moves if it was approved (AMBIGUITIES entry 16). |
| **Checking fees after every event.** | Chose an end-of-day check instead, matching how banks work and how criterion 1 is worded (AMBIGUITIES entry 2). |
| **Interest on balances "as known" each day.** | Chose the final corrected history, so no interest is paid or skipped because of a state that was later reversed (AMBIGUITIES entry 10). |
| **Sorting events by date.** | The brief says "replayed in this order". Kept list order and treated E10 as a late arrival (AMBIGUITIES entry 13). |
| **One `endOfDay.ts` for both fees and interest.** | Kept two files: they are different rules that run at different times (every day vs. once). |
| **Writing the engine before fees and interest.** | Changed the order, so the engine was written once, complete. |
| **Keeping the failing test in the main suite.** | Moved it to `test/design-limits/` so `npm test` stays green and the failure is shown on purpose. |