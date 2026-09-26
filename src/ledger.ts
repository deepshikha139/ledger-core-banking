import type { Account, Day, LedgerEntry } from "./types.js";
import { assertSafeInteger } from "./money.js";

export class Ledger {
  readonly #accounts = new Map<string, Account>();
  readonly #entries: LedgerEntry[] = [];
  readonly #entryIds = new Set<string>();

  constructor(accounts: readonly Account[]) {
    for (const account of accounts) {
      assertSafeInteger(account.openingBalance, `opening balance of ${account.id}`);
      this.#accounts.set(account.id, account);
    }
  }

  /** Returns the account, or throws if it doesn't exist. */
  account(accountId: string): Account {
    const account = this.#accounts.get(accountId);
    if (!account) {
      throw new Error(`Unknown account: ${accountId}`);
    }
    return account;
  }

  accounts(): readonly Account[] {
    return [...this.#accounts.values()];
  }

  /** The only way money enters the ledger. Validates, freezes, appends. */
  append(entry: LedgerEntry): void {
    this.account(entry.accountId); // throws if the account is unknown
    assertSafeInteger(entry.amount, `amount of ${entry.entryId}`);

    if (this.#entryIds.has(entry.entryId)) {
      throw new Error(`Duplicate entry id: ${entry.entryId}`);
    }
    if (entry.reversesEntryId !== undefined && !this.#entryIds.has(entry.reversesEntryId)) {
      throw new Error(`${entry.entryId} reverses unknown entry ${entry.reversesEntryId}`);
    }

    this.#entryIds.add(entry.entryId);
    this.#entries.push(Object.freeze({ ...entry }));
  }

  /** A copy of all entries, in the order they were appended. */
  entries(): readonly LedgerEntry[] {
    return [...this.#entries];
  }

  /**
   * Closing balance of a value day: opening balance + every entry with
   * valueDay ≤ day. The optional `include` filter lets callers leave some
   * entries out (fees.ts uses it to ignore a day's own fee).
   */
  balanceAsOf(
    accountId: string,
    day: Day,
    include: (entry: LedgerEntry) => boolean = () => true,
  ): number {
    let balance = this.account(accountId).openingBalance;
    for (const entry of this.#entries) {
      if (entry.accountId === accountId && entry.valueDay <= day && include(entry)) {
        balance += entry.amount;
      }
    }
    assertSafeInteger(balance, "balance");
    return balance;
  }

  /** True if some entry already reverses the given entry. */
  isReversed(entryId: string): boolean {
    return this.#entries.some((entry) => entry.reversesEntryId === entryId);
  }
}