import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { replay, type DayResult } from "../src/engine.js";
import { ACCOUNTS, EVENTS, LAST_DAY } from "../src/scenario.js";

const result = replay(ACCOUNTS, EVENTS, LAST_DAY);

function day(n: number): DayResult {
  const found = result.days.find((d) => d.day === n);
  if (!found) throw new Error(`No result for Day ${n}`);
  return found;
}

function acc(n: number, accountId: string) {
  const found = day(n).accounts.find((a) => a.accountId === accountId);
  if (!found) throw new Error(`No ${accountId} on Day ${n}`);
  return found;
}

function authStatus(n: number, authId: string) {
  return day(n).authorizations.find((a) => a.authId === authId);
}

describe("Scenario replay — ACC-001, day by day", () => {
  it("Day 1: closing 250.00", () => {
    assert.equal(acc(1, "ACC-001").closingBalance, 25000);
  });

  it("Day 2: Auth-A approved; ledger 250.00, available 50.00", () => {
    assert.equal(authStatus(2, "Auth-A")?.status, "APPROVED");
    assert.equal(acc(2, "ACC-001").closingBalance, 25000);
    assert.equal(acc(2, "ACC-001").availableBalance, 5000);
  });

  it("Day 3: ledger 650.00, available 450.00", () => {
    assert.equal(acc(3, "ACC-001").closingBalance, 65000);
    assert.equal(acc(3, "ACC-001").availableBalance, 45000);
  });

  it("Day 4: Auth-A settled for 185.00, whole hold released; Auth-Z rejected", () => {
    assert.equal(authStatus(4, "Auth-A")?.status, "SETTLED");
    assert.equal(acc(4, "ACC-001").closingBalance, 46500);
    assert.equal(acc(4, "ACC-001").activeHolds, 0);
    assert.deepEqual(day(4).errors.map((e) => [e.eventId, e.code]), [["E6", "UNKNOWN_AUTHORIZATION"]]);
  });

  it("Day 5: Day 2 before any fee is -370.00 (criterion 1 holds)", () => {
    const day2Fee = day(5).fees.find((f) => f.accountId === "ACC-001" && f.forDay === 2);
    assert.equal(day2Fee?.balanceWithoutOwnFee, -37000);
  });

  it("Day 5: Auth-B declined, available would have been -245.00", () => {
    const authB = authStatus(5, "Auth-B");
    assert.equal(authB?.status, "DECLINED");
    assert.equal(authB?.availableAfterHold, -24500);
  });

  it("Day 5: E7 triggers three fees (Days 2, 4, 5), not one", () => {
    assert.deepEqual(
      day(5).fees.filter((f) => f.accountId === "ACC-001").map((f) => [f.forDay, f.action]),
      [[2, "ASSESSED"], [4, "ASSESSED"], [5, "ASSESSED"]],
    );
    assert.equal(acc(5, "ACC-001").closingBalance, -23000);
  });

  it("Day 5: past days are restated", () => {
    assert.deepEqual(
      acc(5, "ACC-001").restatements.map((r) => [r.day, r.previous, r.current]),
      [[2, 25000, -39500], [3, 65000, 500], [4, 46500, -20500]],
    );
  });

  it("Day 6: E9 reverses E7 and all three fees are refunded by new entries", () => {
    assert.deepEqual(
      day(6).fees.filter((f) => f.accountId === "ACC-001").map((f) => [f.forDay, f.action]),
      [[2, "REVERSED"], [4, "REVERSED"], [5, "REVERSED"]],
    );
  });

  it("Day 6: interest 1.03 capitalized; closing 466.03", () => {
    const interest = day(6).interest.find((i) => i.accountId === "ACC-001");
    assert.equal(interest?.total, 103);
    assert.equal(acc(6, "ACC-001").closingBalance, 46603);
  });

  it("Auth-B stays declined after E9 — a decision is never re-run", () => {
    assert.equal(authStatus(6, "Auth-B")?.status, "DECLINED");
  });
});

describe("Scenario replay — ACC-002", () => {
  it("Day 5 is reported as 0.000 because E10 has not arrived yet", () => {
    assert.equal(acc(5, "ACC-002").closingBalance, 0);
  });

  it("Day 6: E10 arrives late, is noted, and Day 5 is restated to 10.000", () => {
    assert.ok(day(6).notes.some((n) => n.startsWith("E10")));
    assert.deepEqual(
      acc(6, "ACC-002").restatements.map((r) => [r.day, r.previous, r.current]),
      [[5, 0, 10000]],
    );
  });

  it("E10 is posted as 3.333 + 3.333 + 3.334", () => {
    const parts = result.ledger.entries().filter((e) => e.sourceEventId === "E10").map((e) => e.amount);
    assert.deepEqual(parts, [3333, 3333, 3334]);
  });

  it("Day 6: interest 0.008 capitalized; closing 10.008", () => {
    assert.equal(acc(6, "ACC-002").closingBalance, 10008);
  });
});

describe("Invariants", () => {
  it("A: replay never changes the input events", () => {
    const before = JSON.stringify(EVENTS);
    replay(ACCOUNTS, EVENTS, LAST_DAY);
    assert.equal(JSON.stringify(EVENTS), before);
  });

  it("B: the same events always give exactly the same result", () => {
    const again = replay(ACCOUNTS, EVENTS, LAST_DAY);
    assert.equal(JSON.stringify(again.days), JSON.stringify(result.days));
    assert.deepEqual(again.ledger.entries(), result.ledger.entries());
  });

  it("append-only: every fee and every fee reversal is still in the ledger", () => {
    const kinds = result.ledger.entries().map((e) => e.kind);
    assert.equal(kinds.filter((k) => k === "OVERDRAFT_FEE").length, 3);
    assert.equal(kinds.filter((k) => k === "FEE_REVERSAL").length, 3);
  });
});