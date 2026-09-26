# Architecture & Trade-offs

The ledger core replays a list of events and prints balances, fees, authorization states and errors for each day. It has no database, clock or network, so the same events always give the same result. Each rule lives in its own file (money, ledger, authorizations, fees, interest). The engine only puts events in order, and the report only prints.

## 1. Append-only at scale

**What breaks first:** working out balances. Every balance is calculated by reading **all entries of all accounts**. At the end of each day, the fee check and the report do this again for **every past day**. With 100x more entries and 100x more accounts, the end of day becomes about 10,000x slower.

**What keeps growing:**
- the list of entries (never deleted, by design);
- old authorizations (settled and declined ones are never cleared);
- the fee check, which always starts again from Day 1.

**Cheapest fix:** when an entry is added, also add it to a **running total for that account and day**. A balance then adds up a few daily totals instead of reading every entry. Only `ledger.ts` changes; every other file stays the same. Later, **locking old days** would stop checks from going back to Day 1 every time.

## 2. Value-dated entries in production

A backdated entry changes the past. In this project, one late debit changed four earlier days, caused three fees and a declined authorization, and was then reversed.

**What this means for the bank:**
- Customers already saw the old balances, so statements must be corrected and explained.
- Fees and interest change later; wrong fees must be refunded.
- The accounting books for past days may already be closed and need correcting.
- Decisions made on wrong information (like a decline) cannot be undone.

**What it means for a UAE regulator:**
- Fees must be fair (Central Bank of the UAE consumer protection rules). A fee caused by the bank's own mistake should be refunded.
- There must be a full record of who made each backdated entry, when and why.
- Anti-money-laundering checks must be able to see backdated entries.
- Reports already sent for past dates may need correcting.

**One control before going live: two-person approval (maker-checker).** Any entry dated before today needs a second person to approve it, with a reason. It cannot go back further than a set limit.

## 3. Authorization lifecycle

Apart from a matching settlement, an authorization in my model can end in only **two** ways:

| How it ends | Real-life example | What happens now | What should happen |
|---|---|---|---|
| **Declined** | Card declined at a shop because there isn't enough money. | Saved as declined, with the number that decided it. Never checked again. | Remember which entries caused the decline. If one is later reversed, send it for review and tell the customer. |
| **Never ends** | Hotel pre-authorization that is never charged. | The hold stays forever and blocks the customer's money. | Expire the hold after a set number of days. A settlement that arrives later goes to a review queue. |

A **failed settlement does not end** an authorization; the hold stays active. For a settlement bigger than the hold (like a tip), allow a small extra amount by shop type. For a settlement from the wrong account, reject it and raise an alert. For a duplicate settlement, reject it and match it to the original.

**Not supported yet:** the shop cancelling the authorization, charging in several parts, or the account being closed while a hold is active.

## 4. What I cut and why

| What I cut | The risk it leaves for later |
|---|---|
| No database (memory only) | A crash loses everything unless the events are saved. |
| One event at a time | Two payments at the same moment could both be approved. |
| No duplicate check on incoming events | The same payment sent twice could be posted twice. |
| No authorization expiry | Holds can block money forever. |
| No extra allowed on settlements | Normal tips would be rejected. |
| No overdraft limit | A balance can go negative without limit. |
| Fee only in AED | A negative BHD account would stop with an error. |
| Days are numbers, not dates | No weekends, holidays or time zones. |
| Simple daily interest rate | No rate changes or Islamic profit products. |
| Balances found by reading every entry | Slow at scale (section 1). |
| No "who did this" on entries | No audit trail (section 2). |
