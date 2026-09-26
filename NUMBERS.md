# Numbers

Every constant in the code, why it has that value, and why not half of it.
**Given** = from the brief. **Chosen** = my decision.

## Money

| Constant | Value | Given / Chosen | Why this value, not half |
|---|---|---|---|
| AED decimals | 2 (1 AED = 100 fils) | Given | With 1 decimal, amounts like 0.05 or 0.19 (interest) could not be stored. |
| BHD decimals | 3 (1 BHD = 1,000 fils) | Given | Half (1–2 decimals) would lose the 0.004 BHD daily interest and the 3.333 split. |
| Money type | Whole numbers of fils | Chosen | Decimals like 0.1 + 0.2 are not exact in JavaScript. Whole numbers are always exact. |
| Largest safe amount | 9,007,199,254,740,991 fils | JavaScript limit | Above this, whole numbers stop being exact. The code throws an error instead of going wrong silently. About 90 trillion AED, far above anything here. |

## Fees

| Constant | Value | Given / Chosen | Why this value, not half |
|---|---|---|---|
| Overdraft fee | 2,500 fils (AED 25.00) | Given | Half (12.50) would break a non-negotiable rule. |
| Fees per account per day | 1 | Given | Enforced by checking for an unrefunded fee before charging. |
| When a fee is charged | Balance **below** 0 | Given | Exactly 0.00 is not negative, so no fee. Tested. |
| Checked days | Every day from Day 1 to today | Chosen | A backdated entry can make any past day negative. Checking only half the days could miss fees. |

## Interest

| Constant | Value | Given / Chosen | Why this value, not half |
|---|---|---|---|
| Daily rate | 4 / 10,000 (= 0.04%) | Given | Half (2 / 10,000 = 0.02%) would halve all interest. |
| Divisor | 10,000 | Chosen | 0.04% written with whole numbers only. 10,000 is the smallest divisor that keeps the top number whole (4). With half (5,000) the top number would be 2, the same rate but less clear, since 10,000 matches "percent of a percent". |
| Rounding | Half-up (0.5 and above goes up) | Chosen | Simple to explain, and interest is only paid on positive balances. Half-even gives the same result here: no daily amount lands exactly on .5. |
| Payout | Once, end of Day 6 | Given | Paying in two halves would break "a single credit". |
| Interest on negative days | 0 | Given | Only positive balances earn interest. |

## Authorizations and settlements

| Constant | Value | Given / Chosen | Why this value, not half |
|---|---|---|---|
| Approval line | Available after hold **at or above** 0 | Given | Exactly 0.00 is approved. Tested. |
| Hold released on settlement | 100% (the whole hold) | Chosen | Auth-A held 200.00 and settled 185.00. Releasing only part would leave 15.00 blocked with nothing left to settle it. |
| Extra allowed above the hold | 0 | Chosen | Any extra needs a limit the brief doesn't give. Money only moves if it was approved (AMBIGUITIES entry 16). |

## Instalments and days

| Constant | Value | Given / Chosen | Why this value, not half |
|---|---|---|---|
| E10 instalments | 3 | Given | Split 3.333 + 3.333 + 3.334 so the total is exactly 10.000. |
| Where the extra fils goes | Last instalment | Chosen | Any position works as long as the total is exact. "Last" is simple to explain. |
| Window | Day 1 to Day 6 | Given | Interest and fee checks run over all six days. |

## Key results these constants produce

| Result | Value |
|---|---|
| Day 2 before any fee (end of Day 5) | -370.00 AED |
| Auth-B available after hold | -245.00 AED (declined) |
| Fees caused by E7 | 3 (Days 2, 4, 5), all refunded after E9 |
| ACC-001 interest | 0.10 + 0.10 + 0.26 + 0.19 + 0.19 + 0.19 = 1.03 AED |
| ACC-001 final balance | 466.03 AED |
| ACC-002 interest | 0.004 + 0.004 = 0.008 BHD |
| ACC-002 final balance | 10.008 BHD |