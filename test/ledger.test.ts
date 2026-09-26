import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Ledger } from "../src/ledger.js";
import type { LedgerEntry } from "../src/types.js";

const accounts = [
  { id: "ACC-001", currency: "AED" as const, openingBalance: 0 },
];

function entry(
  entryId: string,
  amount: number,
  valueDay: number,
  bookedDay = valueDay,
): LedgerEntry {
  return {
    entryId,
    accountId: "ACC-001",
    kind: amount >= 0 ? "CREDIT" : "DEBIT",
    amount,
    valueDay,
    bookedDay,
  };
}

describe("Ledger.balanceAsOf", () => {
  it("returns the opening balance when there are no entries", () => {
    const ledger = new Ledger(accounts);
    assert.equal(ledger.balanceAsOf("ACC-001", 1), 0);
  });

  it("sums entries up to and including the value day", () => {
    const ledger = new Ledger(accounts);
    ledger.append(entry("E1", 120000, 1));
    ledger.append(entry("E2", -95000, 1));
    assert.equal(ledger.balanceAsOf("ACC-001", 1), 25000);
  });

  it("a backdated entry changes its value day and every later day, not earlier days", () => {
    const ledger = new Ledger(accounts);
    ledger.append(entry("E1", 120000, 1));
    ledger.append(entry("E2", -95000, 1));
    ledger.append(entry("E4", 40000, 3));
    ledger.append(entry("E7", -62000, 2, 5)); // booked Day 5, value Day 2

    assert.equal(ledger.balanceAsOf("ACC-001", 1), 25000);  // unchanged
    assert.equal(ledger.balanceAsOf("ACC-001", 2), -37000); // 250 - 620
    assert.equal(ledger.balanceAsOf("ACC-001", 3), 3000);   // -370 + 400
  });

  it("the include filter leaves chosen entries out", () => {
    const ledger = new Ledger(accounts);
    ledger.append(entry("E1", 120000, 1));
    ledger.append(entry("E2", -95000, 1));
    const withoutE2 = ledger.balanceAsOf("ACC-001", 1, (e) => e.entryId !== "E2");
    assert.equal(withoutE2, 120000);
  });
});

describe("Ledger.append", () => {
  it("rejects a duplicate entry id", () => {
    const ledger = new Ledger(accounts);
    ledger.append(entry("E1", 120000, 1));
    assert.throws(() => ledger.append(entry("E1", 100, 1)));
  });

  it("rejects an entry for an unknown account", () => {
    const ledger = new Ledger(accounts);
    assert.throws(() => ledger.append({ ...entry("X1", 100, 1), accountId: "ACC-999" }));
  });

  it("rejects a reversal of an entry that does not exist", () => {
    const ledger = new Ledger(accounts);
    assert.throws(() =>
      ledger.append({ ...entry("R1", 100, 1), kind: "REVERSAL", reversesEntryId: "NOPE" }),
    );
  });

  it("stores entries frozen, so they cannot be changed at runtime", () => {
    const ledger = new Ledger(accounts);
    ledger.append(entry("E1", 120000, 1));
    const stored = ledger.entries()[0] as { amount: number };
    assert.throws(() => {
      stored.amount = 0;
    });
  });
});

describe("Ledger.isReversed", () => {
  it("is true only once a reversal entry points at the original", () => {
    const ledger = new Ledger(accounts);
    ledger.append(entry("E7", -62000, 2, 5));
    assert.equal(ledger.isReversed("E7"), false);
    ledger.append({ ...entry("E9", 62000, 2, 6), kind: "REVERSAL", reversesEntryId: "E7" });
    assert.equal(ledger.isReversed("E7"), true);
  });
});