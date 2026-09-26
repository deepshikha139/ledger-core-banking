import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Ledger } from "../src/ledger.js";
import { AuthorizationBook } from "../src/authorizations.js";
import type { AuthorizationEvent, SettlementEvent } from "../src/types.js";

const accounts = [
  { id: "ACC-001", currency: "AED" as const, openingBalance: 0 },
  { id: "ACC-002", currency: "BHD" as const, openingBalance: 0 },
];

/** Ledger with ACC-001 at 250.00 on Day 1 (E1 + E2). */
function ledgerAt250(): Ledger {
  const ledger = new Ledger(accounts);
  ledger.append({ entryId: "E1", accountId: "ACC-001", kind: "CREDIT", amount: 120000, valueDay: 1, bookedDay: 1 });
  ledger.append({ entryId: "E2", accountId: "ACC-001", kind: "DEBIT", amount: -95000, valueDay: 1, bookedDay: 1 });
  return ledger;
}

function auth(id: string, authId: string, amount: number, day: number): AuthorizationEvent {
  return { id, type: "AUTHORIZATION", accountId: "ACC-001", authId, amount, bookedDay: day, valueDay: day };
}

function settlement(id: string, authId: string, amount: number, day: number, accountId = "ACC-001"): SettlementEvent {
  return { id, type: "SETTLEMENT", accountId, authId, amount, bookedDay: day, valueDay: day };
}

describe("AuthorizationBook.request", () => {
  it("approves when available after the hold stays at or above zero (Auth-A)", () => {
    const book = new AuthorizationBook();
    const result = book.request(ledgerAt250(), auth("E3", "Auth-A", 20000, 2));
    assert.equal(result.status, "APPROVED");
    assert.equal(result.availableAfterHold, 5000); // 250.00 - 200.00 = 50.00
  });

  it("approves at exactly zero (the rule says 'at or above')", () => {
    const book = new AuthorizationBook();
    const result = book.request(ledgerAt250(), auth("X1", "Auth-X", 25000, 2));
    assert.equal(result.status, "APPROVED");
    assert.equal(result.availableAfterHold, 0);
  });

  it("declines when available would go below zero", () => {
    const book = new AuthorizationBook();
    const result = book.request(ledgerAt250(), auth("X1", "Auth-X", 25001, 2));
    assert.equal(result.status, "DECLINED");
  });

  it("a hold reduces available balance but not ledger balance", () => {
    const ledger = ledgerAt250();
    const book = new AuthorizationBook();
    book.request(ledger, auth("E3", "Auth-A", 20000, 2));
    assert.equal(ledger.balanceAsOf("ACC-001", 2), 25000); // ledger unchanged
    assert.equal(book.activeHolds("ACC-001"), 20000);      // available = 50.00
  });

  it("ignores entries whose value day is still in the future", () => {
    const ledger = ledgerAt250();
    ledger.append({ entryId: "F1", accountId: "ACC-001", kind: "CREDIT", amount: 100000, valueDay: 3, bookedDay: 2 });
    const book = new AuthorizationBook();
    const result = book.request(ledger, auth("X1", "Auth-X", 30000, 2));
    assert.equal(result.status, "DECLINED"); // only 250.00 counts on Day 2
  });
});

describe("AuthorizationBook.settle", () => {
  it("settles for less than the hold: moves 185.00 and releases the whole 200.00 hold", () => {
    const ledger = ledgerAt250();
    const book = new AuthorizationBook();
    book.request(ledger, auth("E3", "Auth-A", 20000, 2));

    const error = book.settle(ledger, settlement("E5", "Auth-A", 18500, 4));

    assert.equal(error, undefined);
    assert.equal(ledger.balanceAsOf("ACC-001", 4), 6500); // 250.00 - 185.00
    assert.equal(book.activeHolds("ACC-001"), 0);
    assert.equal(book.get("Auth-A")?.status, "SETTLED");
    assert.equal(book.get("Auth-A")?.settledAmount, 18500);
  });

  it("settles for exactly the hold amount (boundary)", () => {
    const ledger = ledgerAt250();
    const book = new AuthorizationBook();
    book.request(ledger, auth("E3", "Auth-A", 20000, 2));

    const error = book.settle(ledger, settlement("E5", "Auth-A", 20000, 4));

    assert.equal(error, undefined);
    assert.equal(book.get("Auth-A")?.status, "SETTLED");
  });

  it("rejects a settlement larger than the hold and moves no money", () => {
    const ledger = ledgerAt250();
    const book = new AuthorizationBook();
    book.request(ledger, auth("E3", "Auth-A", 20000, 2));
    const before = ledger.entries().length;

    const error = book.settle(ledger, settlement("E5", "Auth-A", 20001, 4));

    assert.equal(error?.code, "SETTLEMENT_EXCEEDS_HOLD");
    assert.equal(ledger.entries().length, before);
    assert.equal(book.get("Auth-A")?.status, "APPROVED"); // hold stays active
  });

  it("rejects a settlement with no authorization and moves no money (Auth-Z)", () => {
    const ledger = ledgerAt250();
    const book = new AuthorizationBook();
    const before = ledger.entries().length;

    const error = book.settle(ledger, settlement("E6", "Auth-Z", 18000, 4));

    assert.equal(error?.code, "UNKNOWN_AUTHORIZATION");
    assert.equal(ledger.entries().length, before);
    assert.equal(ledger.balanceAsOf("ACC-001", 4), 25000);
  });

  it("rejects settling a declined authorization", () => {
    const ledger = ledgerAt250();
    const book = new AuthorizationBook();
    book.request(ledger, auth("X1", "Auth-X", 99999, 2));
    const error = book.settle(ledger, settlement("X2", "Auth-X", 100, 3));
    assert.equal(error?.code, "AUTHORIZATION_NOT_ACTIVE");
  });

  it("rejects settling the same authorization twice", () => {
    const ledger = ledgerAt250();
    const book = new AuthorizationBook();
    book.request(ledger, auth("E3", "Auth-A", 20000, 2));
    book.settle(ledger, settlement("E5", "Auth-A", 18500, 4));
    const second = book.settle(ledger, settlement("X9", "Auth-A", 100, 4));
    assert.equal(second?.code, "AUTHORIZATION_NOT_ACTIVE");
  });

  it("rejects a settlement from a different account", () => {
    const ledger = ledgerAt250();
    const book = new AuthorizationBook();
    book.request(ledger, auth("E3", "Auth-A", 20000, 2));
    const error = book.settle(ledger, settlement("X3", "Auth-A", 100, 3, "ACC-002"));
    assert.equal(error?.code, "UNKNOWN_AUTHORIZATION");
  });
});