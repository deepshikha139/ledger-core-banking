# Ambiguities

Each entry: what the brief leaves unclear → options considered → what I chose → why.
Draft written before coding; refined during the build.

## 1. Which balance does an authorization decision use?
- **Unclear:** events have two dates: when they are booked (arrive) and their value date. A later backdated entry can change an earlier day's balance.
- **Options:** (a) decide using what is known at that moment in the stream; (b) re-evaluate past decisions when history changes.
- **Chosen:** (a). Decisions are point-in-time and never re-evaluated.
- **Why:** a real system can only decide on what it knows. Auth-A was correctly approved on Day 2 even though E7 later makes Day 2 negative. Balances can be restated; decisions cannot.

## 2. When are overdraft fees assessed?
- **Unclear:** the brief defines the condition (closing balance negative) but not when the check runs.
- **Options:** (a) after every event; (b) once per day, at end of day.
- **Chosen:** (b), an end-of-day batch.
- **Why:** matches how banks run fees, and criterion 1 ("evaluated at end of Day 5, before any fee is assessed") only makes sense if fees come after the day's events.

## 3. Do backdated entries trigger fees on past days?
- **Unclear:** E7 arrives on Day 5 but belongs to Day 2.
- **Chosen:** yes. At each end of day, every past day is re-checked, oldest first. At most one fee per account per value day.
- **Why:** the rule defines the closing balance as all entries with value_date ≤ that day, so a late entry does change that day.

## 4. "Booked with value_date equal to the day assessed" — which day?
- **Options:** (a) the day the check runs; (b) the day whose balance was negative.
- **Chosen:** (b). A fee for Day 2's negative balance has value date Day 2, even if detected on Day 5.
- **Why:** the fee then belongs to the day that caused it and flows correctly into later days' balances.

## 5. Does a day's own fee count when checking that day?
- **Chosen:** no. When checking day d, use all entries up to d, including earlier days' fees, but excluding day d's own fee.
- **Why:** otherwise the fee could keep the day negative and block its own reversal. Earlier fees must still count (Day 2's fee lowers Day 3).

## 6. What happens to a fee when its day becomes positive again?
- **Unclear:** E9 reverses E7, so Day 2 is no longer negative. The brief doesn't say whether the fee stays.
- **Options:** (a) keep the fee; (b) delete it; (c) append a fee reversal.
- **Chosen:** (c).
- **Why:** the fee's condition is no longer true, so keeping it is unfair; deleting it breaks the append-only rule. A reversal entry fixes the balance and keeps the full history.

## 7. Partial settlement (185.00 against a 200.00 hold)
- **Options:** (a) release the full hold; (b) keep 15.00 held for later settlements.
- **Chosen:** (a).
- **Why:** one settlement closes the authorization. Keeping 15.00 blocked with nothing to settle it would trap the customer's money.

## 8. Settlement with no matching authorization (Auth-Z)
- **Options:** (a) reject and log an error; (b) "force post" it, as card networks sometimes allow.
- **Chosen:** (a). No money moves; the rejection is recorded as an error.
- **Why:** no proof the customer approved the payment. Rejected is not ignored: in production it would go to an exceptions queue for manual review.

## 9. "Three equal instalments" of BHD 10.000
- **Unclear:** 10.000 / 3 cannot be split equally at 3 decimals.
- **Chosen:** 3.333 + 3.333 + 3.334; the extra 0.001 goes to the **last** instalment. (**confirm**)
- **Why:** the parts must add up to exactly 10.000. Three equal parts of 3.334 would create 0.002 BHD from nothing.

## 10. Which balances does interest use?
- **Options:** (a) balances as known at the end of each day; (b) the final corrected history after all events.
- **Chosen:** (b). All six daily accruals are calculated at the end of Day 6.
- **Why:** interest is only credited on Day 6, so the final truth is available. Paying interest on a temporary state (e.g. Day 2 at -370.00) that was later reversed would be wrong.

## 11. Interest details
- Negative balance days earn zero (not negative interest).
- The capitalized credit does not itself earn interest.
- The capitalized total is defined as the sum of the rounded daily accruals, so it matches exactly with no remainder.

## 12. Rounding mode
- **Chosen:** half-up (e.g. 0.186 → 0.19).
- **Why:** interest only applies to positive balances, so half-up is simple and easy to explain. Half-even was considered (see NUMBERS.md).

## 13. E10 (Day 5) is listed after E9 (Day 6)
- **Unclear:** the brief says "replayed in this order", but the dates go backwards.
- **Options:** (a) follow list order; (b) sort by date.
- **Chosen:** (a), and the clock is not moved backwards. E10 is processed during Day 6 but keeps its Day 5 value date.
- **Effect:** ACC-002's Day 5 closing is reported as 0.000 at end of Day 5, then restated to 10.000 at end of Day 6. Only ACC-002 is affected; final balances are the same either way.

## 14. What does "closing balance per day" mean in the output?
- **Unclear:** a day's balance can change after it was first reported.
- **Chosen:** print each day's closing balance as known at that end of day, plus "restated" lines when a past day changes.
- **Why:** shows both what the system knew and the corrected truth, which criterion 1 requires.

## 15. Overdraft fee on the BHD account
- **Unclear:** the fee is AED 25.00; ACC-002 is in BHD.
- **Chosen:** not handled, because ACC-002 never goes negative in this window.
- **Production:** would need a rule (a BHD fee amount or an FX conversion policy). Listed as a simplification.