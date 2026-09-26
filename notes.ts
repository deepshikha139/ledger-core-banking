// The Timeline (Day 1 to Day 6 Event Stream)

//Day 1
// E1 (Credit): ACC-001 gets a deposit of AED 1,200.00. (Ledger is now +1,200).
// E2 (Debit): ACC-001 spends AED 950.00. (Ledger drops to +250).


// Day 2
// E3 (Authorization): ACC-001 gets a card hold ("Auth-A") for AED 200.00. (Ledger stays at +250, but available balance drops by 200).
// An authorization is approved only if the account's available balance (ledger balance minus active holds) remains at or above zero after the hold is applied
// 250.00 − 200.00 = 50.00, 50.00 ≥ 0, so approved

// Day 3
// E4 (Credit): ACC-001 gets another deposit of AED 400.00. (Ledger rises to +650).


// Day 4
// E5 (Settlement): Auth-A officially settles for AED 185.00. Money finally leaves the ledger. (Ledger drops to +465).
// E6 (Settlement): An unknown Auth-Z tries to settle for AED 180.00, but there was never any authorization called Auth-Z! This is an error and must be rejected.


// Day 5
// E7 (Debit): ACC-001 spends AED 620.00, but with a value_date of Day 2! (Value-dating means "pretend this transaction happened back on Day 2").
// Because of this backdating, Day 2's closing balance retroactively drops from +250 to $-370.00$, triggering an overdraft fee on Day 2.
// E8 (Authorization): ACC-001 gets a new hold ("Auth-B") for AED 90.00. It is never settled.
// E10 (Credit): ACC-002 (the BHD account) receives a BHD 10.000 deposit split into three equal installments.


// Day 6
// E9 (Reversal): ACC-001 completely reverses event E7 (the AED 620 debit).Because E7 is reversed, Day 2's balance goes back to normal,
// wiping out that retroactive overdraft fee!End of Day 6: All daily interest earned over the 6 days is calculated, rounded cleanly, and added to the accounts.