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
- Decided to reject Auth-Z (no matching authorization) and log it as an error, considered force post as the alternative.
- Worked out that Auth-B (Day 5) is declined: after E7, available would be -245.00.

### 12:00PM–01:00PM — Design decisions locked (before coding)
- Reviewed design options with AI help, challenged them, and made the final calls myself.
- Locked 6 decisions: end-of-day fee re-check of past days, fee reversal as a new entry, interest on final corrected history, integer minor units with half-up rounding, strict list order for replay, daily output with restatements.
- Locked 4 invariants: events never change, replay is deterministic, derived state can be rebuilt from events, decisions are point-in-time.
- Found that E10 (Day 5) is listed after E9 (Day 6); decided not to move the clock backwards.
- Drafted AMBIGUITIES.md with every decision so far.