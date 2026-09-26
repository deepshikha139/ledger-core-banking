import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Ledger } from "../src/ledger.js";
import { capitalizeInterest, dailyAccrual } from "../src/interest.js";

const accounts = [
  { id: "ACC-001", currency: "AED" as const, openingBalance: 0 },
  { id: "ACC-002", currency: "BHD" as const, openingBalance: 0 },
];

/**
 * ACC-001 final history after all events. Fees and fee reversals are left
 * out because they cancel to zero on every day (tested in fees.test.ts).
 */
function finalAcc001(): Ledger {
  const ledger = new Ledger(accounts);
  const add = (entryId: string, amount: number, valueDay: number, bookedDay: number, reversesEntryId?: string) =>
    ledger.append({
      entryId,
      accountId: "ACC-001",
      kind: reversesEntryId ? "REVERSAL" : amount >= 0 ? "CREDIT" : "DEBIT",
      amount,
      valueDay,
      bookedDay,
      ...(reversesEntryId ? { reversesEntryId } : {}),
    });
  add("E1", 120000, 1, 1);
  add("E2", -95000, 1, 1);
  add("E4", 40000, 3, 3);
  add("E5", -18500, 4, 4);
  add("E7", -62000, 2, 5);
  add("E9", 62000, 2, 6, "E7");
  return ledger;
}

describe("dailyAccrual", () => {
  it("250.00 AED earns exactly 0.10", () => {
    assert.equal(dailyAccrual(25000), 10);
  });

  it("465.00 AED earns 0.186, rounded half-up to 0.19", () => {
    assert.equal(dailyAccrual(46500), 19);
  });

  it("10.000 BHD earns exactly 0.004", () => {
    assert.equal(dailyAccrual(10000), 4);
  });

  it("zero and negative balances earn nothing", () => {
    assert.equal(dailyAccrual(0), 0);
    assert.equal(dailyAccrual(-39500), 0);
  });
});

describe("capitalizeInterest", () => {
  it("accrues on the final history and credits 1.03 AED once on Day 6", () => {
    const ledger = finalAcc001();
    const result = capitalizeInterest(ledger, "ACC-001", 6, 6);

    assert.deepEqual(result.accruals.map((a) => a.accrual), [10, 10, 26, 19, 19, 19]);
    assert.equal(result.total, 103);
    assert.equal(ledger.balanceAsOf("ACC-001", 6), 46603); // 465.00 + 1.03
  });

  it("the rounded daily accruals sum exactly to the credited total", () => {
    const ledger = finalAcc001();
    const result = capitalizeInterest(ledger, "ACC-001", 6, 6);
    const sum = result.accruals.reduce((s, a) => s + a.accrual, 0);
    const credited = ledger.entries().find((e) => e.kind === "INTEREST")?.amount;
    assert.equal(sum, credited);
  });

  it("interest does not earn interest: Day 6 accrual uses the balance before the credit", () => {
    const ledger = finalAcc001();
    const result = capitalizeInterest(ledger, "ACC-001", 6, 6);
    assert.equal(result.accruals[5]?.closingBalance, 46500);
  });

  it("BHD account with the E10 instalments earns 0.008 BHD", () => {
    const ledger = new Ledger(accounts);
    [3333, 3333, 3334].forEach((amount, i) =>
      ledger.append({ entryId: `E10-${i + 1}`, accountId: "ACC-002", kind: "CREDIT", amount, valueDay: 5, bookedDay: 6 }),
    );
    const result = capitalizeInterest(ledger, "ACC-002", 6, 6);
    assert.deepEqual(result.accruals.map((a) => a.accrual), [0, 0, 0, 0, 4, 4]);
    assert.equal(ledger.balanceAsOf("ACC-002", 6), 10008);
  });

  it("posts no entry when there is nothing to pay", () => {
    const ledger = new Ledger(accounts);
    const result = capitalizeInterest(ledger, "ACC-001", 6, 6);
    assert.equal(result.total, 0);
    assert.equal(result.entryId, undefined);
    assert.equal(ledger.entries().length, 0);
  });

  it("refuses to capitalize twice", () => {
    const ledger = finalAcc001();
    capitalizeInterest(ledger, "ACC-001", 6, 6);
    assert.throws(() => capitalizeInterest(ledger, "ACC-001", 6, 6));
  });
});