# Worklog

## 2026-09-25
### 02:00- 04:00 — Read brief, clarified concepts
- Read Part 1 and Part 2.
- Built a cheat sheet with AI help; corrected my understanding of value dates vs booked dates and point-in-time decisions.
- Decision: no frontend, since the brief says "no UI".

## 2026-09-26
### 01:00–02:00 — Repo setup and other installation troubleshots
  - Created the repo, initialized Node, and installed TypeScript.
  - Set up `tsconfig.json` with strict mode turned on.
  - Added the test script using Node's built-in test runner (`node --import tsx --test`).
  - Created empty markdown files for documentation (`WORKLOG.md`, `NUMBERS.md`, `AMBIGUITIES.md`, `REJECTED.md`, `ARCHITECTURE.md`).

### Why TypeScript and node:test
  - TypeScript helps catch bugs early and keeps data types clear, which is super important when dealing with financial amounts and ledger states.
  - Using Node's native test runner (`node:test`) keeps things simple and lightweight without needing to install extra heavy testing libraries.