import type { Day } from "./types.js";
import type { Ledger } from "./ledger.js";
import { assertSafeInteger, divideHalfUp } from "./money.js";

/** 0.04% per day, written as whole numbers: 4 out of every 10,000. */
export const DAILY_RATE_PARTS = 4;
export const RATE_DIVISOR = 10_000;

/** One day's interest on a closing balance, in minor units. */
export function dailyAccrual(closingBalance: number): number {
  if (closingBalance <= 0) {
    return 0; // the brief: positive balances only
  }
  const scaled = closingBalance * DAILY_RATE_PARTS;
  assertSafeInteger(scaled, "interest calculation");
  return divideHalfUp(scaled, RATE_DIVISOR);
}

export interface Accrual {
  readonly day: Day;
  readonly closingBalance: number;
  readonly accrual: number;
}

export interface InterestResult {
  readonly accountId: string;
  readonly accruals: readonly Accrual[];
  readonly total: number;
  /** Missing when the total is zero (nothing to credit). */
  readonly entryId?: string;
}

/**
 * Calculates every day's accrual from the FINAL corrected history, then
 * credits the total once, with value day = lastDay. Call this only after
 * all events and fees for the window are done.
 */
export function capitalizeInterest(
  ledger: Ledger,
  accountId: string,
  lastDay: Day,
  bookedDay: Day,
): InterestResult {
  const alreadyPaid = ledger
    .entries()
    .some((entry) => entry.accountId === accountId && entry.kind === "INTEREST");
  if (alreadyPaid) {
    throw new Error(`Interest already capitalized for ${accountId}`);
  }

  // Accrue first, before the credit exists, so interest never earns interest.
  const accruals: Accrual[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const closingBalance = ledger.balanceAsOf(accountId, day);
    accruals.push({ day, closingBalance, accrual: dailyAccrual(closingBalance) });
  }

  const total = accruals.reduce((sum, a) => sum + a.accrual, 0);
  if (total === 0) {
    return { accountId, accruals, total };
  }

  const entryId = `INT-${accountId}`;
  ledger.append({
    entryId,
    accountId,
    kind: "INTEREST",
    amount: total,
    valueDay: lastDay,
    bookedDay,
  });
  return { accountId, accruals, total, entryId };
}