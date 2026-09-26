import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Ledger } from "../src/ledger.js";
import { reconcileOverdraftFees, OVERDRAFT_FEE } from "../src/fees.js";
import type { EntryKind } from "../src/types.js";

const accounts = [
  { id: "ACC-001", currency: "AED" as const, openingBalance: 0 },
  { id: "ACC-002", currency: "BHD" as const, openingBalance: 0 },
];

function add(
  ledger: Ledger,
  entryId: string,
  amount: number,
  valueDay: number,
  bookedDay: number,
  kind: EntryKind = amount >= 0 ? "CREDIT" : "DEBIT",
  reversesEntryId?: string,
): void {
  ledger.append({
    entryId,
    accountId: "ACC-001",
    kind,
    amount,
    valueDay,
    bookedDay,
    ...(reversesEntryId ? { reversesEntryId } : {}),
  });
}

/** ACC-001 as known at end of Day 5: E1, E2, E4, E5, then backdated E7. */
function ledgerAtEndOfDay5(): Ledger {
  const ledger = new Ledger(accounts);
  add(ledger, "E1", 120000, 1, 1);
  add(ledger, "E2", -95000, 1, 1);
  add(ledger, "E4", 40000, 3, 3);
  add(ledger, "E5", -18500, 4, 4, "SETTLEMENT");
  add(ledger, "E7", -62000, 2, 5); // booked Day 5, value Day 2
  return ledger;
}

describe("reconcileOverdraftFees", () => {
  it("the fee constant is AED 25.00", () => {
    assert.equal(OVERDRAFT_FEE, 2500);
  });

  it("charges nothing when every day is non-negative", () => {
    const ledger = new Ledger(accounts);
    add(ledger, "E1", 120000, 1, 1);
    assert.deepEqual(reconcileOverdraftFees(ledger, "ACC-001", 1, 1), []);
  });

  it("charges nothing at exactly zero (the rule says negative)", () => {
    const ledger = new Ledger(accounts);
    add(ledger, "E1", 100, 1, 1);
    add(ledger, "E2", -100, 1, 1);
    assert.deepEqual(reconcileOverdraftFees(ledger, "ACC-001", 1, 1), []);
  });

  it("E7 causes fees on Days 2, 4 and 5 — not exactly one", () => {
    const ledger = ledgerAtEndOfDay5();
    const changes = reconcileOverdraftFees(ledger, "ACC-001", 5, 5);

    assert.deepEqual(
      changes.map((c) => [c.forDay, c.action, c.balanceWithoutOwnFee]),
      [
        [2, "ASSESSED", -37000], // 250.00 - 620.00
        [4, "ASSESSED", -18000], // 5.00 - 185.00 (Day 3 was 5.00 after Day 2's fee)
        [5, "ASSESSED", -20500], // Day 4 closing incl. its fee
      ],
    );

    assert.equal(ledger.balanceAsOf("ACC-001", 2), -39500);
    assert.equal(ledger.balanceAsOf("ACC-001", 3), 500);   // positive: no fee
    assert.equal(ledger.balanceAsOf("ACC-001", 4), -20500);
    assert.equal(ledger.balanceAsOf("ACC-001", 5), -23000);
  });

  it("fees carry the negative day as value day and the detection day as booked day", () => {
    const ledger = ledgerAtEndOfDay5();
    reconcileOverdraftFees(ledger, "ACC-001", 5, 5);
    const day2Fee = ledger.entries().find((e) => e.kind === "OVERDRAFT_FEE" && e.valueDay === 2);
    assert.equal(day2Fee?.bookedDay, 5);
  });

  it("is idempotent: running twice does not charge twice", () => {
    const ledger = ledgerAtEndOfDay5();
    reconcileOverdraftFees(ledger, "ACC-001", 5, 5);
    const second = reconcileOverdraftFees(ledger, "ACC-001", 5, 5);
    assert.deepEqual(second, []);
  });

  it("after E9 reverses E7, all three fees are reversed by new entries, not deleted", () => {
    const ledger = ledgerAtEndOfDay5();
    reconcileOverdraftFees(ledger, "ACC-001", 5, 5);
    add(ledger, "E9", 62000, 2, 6, "REVERSAL", "E7");

    const changes = reconcileOverdraftFees(ledger, "ACC-001", 6, 6);

    assert.deepEqual(
      changes.map((c) => [c.forDay, c.action]),
      [[2, "REVERSED"], [4, "REVERSED"], [5, "REVERSED"]],
    );
    assert.equal(ledger.balanceAsOf("ACC-001", 2), 25000);
    assert.equal(ledger.balanceAsOf("ACC-001", 6), 46500);
    // Append-only: the 3 fees and 3 fee reversals all remain in the ledger.
    assert.equal(ledger.entries().filter((e) => e.kind === "OVERDRAFT_FEE").length, 3);
    assert.equal(ledger.entries().filter((e) => e.kind === "FEE_REVERSAL").length, 3);
  });

  it("refuses to charge a non-AED account (fee currency undefined)", () => {
    const ledger = new Ledger(accounts);
    ledger.append({ entryId: "B1", accountId: "ACC-002", kind: "DEBIT", amount: -1, valueDay: 1, bookedDay: 1 });
    assert.throws(() => reconcileOverdraftFees(ledger, "ACC-002", 1, 1));
  });
});