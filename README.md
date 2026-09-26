# ledger-core-banking
A banking ledger system built in TypeScript that handles accounts, backdated transactions, overdraft fees, interest, and card authorizations.
# Ledger Core Banking

An in-memory account ledger core in TypeScript. It replays the six-day event stream from the brief and prints, for each day: closing balances, fee assessments, authorization states and errors.

No database, no UI, no web server — just the ledger logic, a report and tests.

## Requirements

- Node.js **20.6 or newer** (built and tested on Node 24)

## How to run

```bash
npm install          # install dev tools (TypeScript, tsx)
npm start            # replay the events and print the day-by-day report
npm test             # run all tests (all should pass)
npm run test:failing # run the ONE deliberately failing test
npm run typecheck    # check types, no output means no errors
```

## How to read the output

Each day looks like this (Day 5 shown):

```
==================== DAY 5 ====================
Events processed: E7, E8

Closing balances:
  ACC-001  ledger -230.00 AED  | holds 0.00 AED  | available -230.00 AED
    restated Day 2: 250.00 AED -> -395.00 AED
    ...
Fee assessments:
  ACC-001 Day 2: ASSESSED -25.00 AED  (Day 2 closing without its own fee: -370.00 AED)
  ...
Authorization states:
  Auth-B (E8, ACC-001): DECLINED - requested 90.00 AED (available after hold would be -245.00 AED)

Errors:
  none
```

- **Events processed:** the events handled that day, in list order.
- **Note:** printed when an event arrives late (E10 is dated Day 5 but arrives after Day 6 starts).
- **Closing balances:** for each account, the **ledger** balance (money that really moved), **holds** (money blocked by approved authorizations) and **available** (ledger minus holds).
- **restated Day X:** a past day's balance changed because of a backdated entry, a fee or a reversal. It shows old -> new.
- **Fee assessments:** `ASSESSED` = fee charged, `REVERSED` = fee refunded with a new entry. The number in brackets is that day's balance *without its own fee*, which is the number that decided it.
- **Authorization states:** every authorization and its status (APPROVED, DECLINED, SETTLED), with the number that decided it.
- **Errors:** events that were rejected. No money moved for them.
- **Interest capitalized** (Day 6 only): each day's rounded interest, and the total paid.

## Key results

- Auth-Z is rejected (no authorization exists).
- E7 (backdated to Day 2) causes **three** overdraft fees: Days 2, 4 and 5.
- Auth-B is **declined**: available would be -245.00 AED.
- E9 reverses E7, and all three fees are refunded with new entries. Nothing is deleted.
- Final balances: **ACC-001 466.03 AED**, **ACC-002 10.008 BHD**.

## Project structure

```
src/
  money.ts           integer money, rounding, exact splitting
  types.ts           shapes of events, entries, authorizations, errors
  ledger.ts          append-only entries, balance by value day
  authorizations.ts  approve/decline, settle, reject
  fees.ts            end-of-day overdraft fees and refunds
  interest.ts        daily interest, paid once on Day 6
  scenario.ts        the brief's accounts and events, as data
  engine.ts          replays events day by day
  report.ts          prints the results
  run.ts             entry point for npm start
test/
  *.test.ts          one file per module, plus the full scenario
  design-limits/     the one deliberately failing test
```

## Documents

- **AMBIGUITIES.md** — 20 unclear points in the brief and how I resolved each one
- **REJECTED.md** — acceptance criteria I refused, and approaches I dropped
- **NUMBERS.md** — every constant, and why that value
- **ARCHITECTURE.md** — design, trade-offs and production concerns (also submitted as a PDF)
- **WORKLOG.md** — what I did and when

## AI use

AI (Claude) was used for explanations and code drafts, as the brief allows. I traced the numbers by hand, made the design decisions myself, and checked all output against my trace.