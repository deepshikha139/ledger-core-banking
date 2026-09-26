# Worklog

## 2026-09-25
### 02:00PM–04:00PM — Read brief, clarified concepts
- Read Part 1 and Part 2.
- Built a cheat sheet with AI help; corrected my understanding of value dates vs booked dates and point-in-time decisions.
- Decision: no frontend, since the brief says "no UI".

## 2026-09-26
### 01:00AM–02:00AM — Repo setup and installation troubleshooting
- Created the repo, initialized Node, and installed TypeScript.
- Set up `tsconfig.json` with strict mode turned on.
- Added the test script using Node's built-in test runner (`node --import tsx --test`).
- Created empty markdown files for documentation (`WORKLOG.md`, `NUMBERS.md`, `AMBIGUITIES.md`, `REJECTED.md`, `ARCHITECTURE.md`).

**Why TypeScript and node:test**
- TypeScript helps catch bugs early and keeps data types clear, which matters when dealing with financial amounts and ledger states.
- Node's native test runner (`node:test`) keeps things simple and lightweight, with no extra testing libraries.

### 11:00AM–12:00PM — Hand-trace of ACC-001 (Days 1–4)
- Traced ledger, holds and available balance by hand, day by day, before writing any code.
- Auth-A approved on Day 2 (available after hold = 50.00).
- Auth-A settled for 185.00 against a 200.00 hold; decided to release the full hold.
- Decided to reject Auth-Z (no matching authorization) and log it as an error, considered force post` as the alternative.
- Worked out that Auth-B (Day 5) is declined: after E7, available would be -245.00.

### 12:00PM–01:00PM — Design decisions locked (before coding)
- Reviewed design options with AI help, challenged them, and made the final calls myself.
- Locked 6 decisions: end-of-day fee re-check of past days, fee reversal as a new entry, interest on final corrected history, integer minor units with half-up rounding, strict list order for replay, daily output with restatements.
- Locked 4 invariants: events never change, replay is deterministic, derived state can be rebuilt from events, decisions are point-in-time.
- Found that E10 (Day 5) is listed after E9 (Day 6); decided not to move the clock backwards.
- Drafted AMBIGUITIES.md with every decision so far.

### 04:00PM–04:30PM — Add Logics and test cases
- Added money.ts for calculation related logic and added test cases for that
- Added lodger.ts file and to capture money movement and added test cases

### 04:30PM–04:40PM — Authorizations
- Added `authorizations.ts` with tests: approve or decline holds, settle, reject unknown settlements.
- Added `availableAfterHold` to each authorization, to record the number that decided it.
- Tested the boundaries: exactly 0 available is approved, below 0 is declined.
- Decision: a settlement bigger than the hold is rejected (AMBIGUITIES entry 16). Same reason as Auth-Z: money only moves if it was approved.

### 04:40–04:50PM — Overdraft fees
- Changed the build order: fees and interest before the engine, so the engine is written once.
- Added `fees.ts` with tests: end-of-day check of every past day, oldest first.
- Tests confirm E7 causes fees on Days 2, 4 and 5, not just one. Day 3 escapes at +5.00.
- Tests confirm that after E9, all three fees are refunded with new entries; nothing is deleted.

### 04:50PM–05:00PM — Interest
- Added `interest.ts` with tests: daily interest on final balances, rounded each day, paid once on Day 6.
- ACC-001 earns 1.03 AED (closing 466.03). ACC-002 earns 0.008 BHD (closing 10.008).
- Daily amounts are added up before the credit is posted, so interest never earns interest.

### 08:00PM–08:10PM — Scenario data and replay engine
- Added `scenario.ts`: the brief's accounts and E1–E10, written as data.
- Added `engine.ts`: replays events in list order, closes each day (fees → interest on last day → snapshot), reports restated past days.
- Late events (E10) are processed on the day they arrive; the clock never goes back.
- Added `scenario.test.ts`: every number from my hand-trace is now checked by a test.
- Added `engine.test.ts`: cases the brief doesn't show (double reversal, event after the window, late authorization).
- All tests pass. Confirmed: Auth-B declined (-245.00), E7 causes 3 fees, final ACC-001 466.03, ACC-002 10.008.

### 08:10PM–08:20PM — Added report + run script
- Added `report.ts`
- Run Scripts
- output matches
- fixed currency in error messages".

### 08:20PM–08:30PM — Printed report and run script
- Added `report.ts` (formats results as text) and `run.ts` (`npm start` prints the report).
- Output shows, per day: closing balances, holds, available, restated past days, fees, authorization states, errors, and interest on Day 6.
- Checked the full output against my hand-trace: every number matches.
- Fixed error messages to show the currency (e.g. "180.00 AED").
- Used plain ASCII characters so the output looks the same in any terminal.

### 08:30–08:45 — Deliberately failing test
- Chose a design limit to expose: Auth-B stays declined even after E9 reverses E7.
- Added `test/design-limits/auth-b-after-reversal.test.ts`, with comments on what it reveals, why I keep the design, and what production would add.
- Kept it in its own folder with its own script (`npm run test:failing`), so `npm test` stays green.