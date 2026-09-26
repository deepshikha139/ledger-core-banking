import type { Day, LedgerEntry } from "./types.js";
import type { Ledger } from "./ledger.js";
import { toMinor } from "./money.js";

/** Overdraft fee from the brief: AED 25.00, in minor units (2500). */
export const OVERDRAFT_FEE = toMinor("25.00", "AED");

export interface FeeChange {
  readonly accountId: string;
  /** The value day the fee belongs to. */
  readonly forDay: Day;
  readonly action: "ASSESSED" | "REVERSED";
  readonly entryId: string;
  /** That day's closing balance, excluding its own fee: the number that decided it. */
  readonly balanceWithoutOwnFee: number;
}

/** True for a fee or fee reversal that belongs to this account and day. */
function isOwnFeeEntry(entry: LedgerEntry, accountId: string, day: Day): boolean {
  return (
    entry.accountId === accountId &&
    entry.valueDay === day &&
    (entry.kind === "OVERDRAFT_FEE" || entry.kind === "FEE_REVERSAL")
  );
}

export function reconcileOverdraftFees(
  ledger: Ledger,
  accountId: string,
  throughDay: Day,
  bookedDay: Day,
): FeeChange[] {
  const changes: FeeChange[] = [];

  // Oldest first, so an earlier fee is already in place when a later day is checked.
  for (let day = 1; day <= throughDay; day++) {
    const balance = ledger.balanceAsOf(
      accountId,
      day,
      (entry) => !isOwnFeeEntry(entry, accountId, day),
    );

    const feesForDay = ledger
      .entries()
      .filter(
        (entry) =>
          entry.kind === "OVERDRAFT_FEE" &&
          entry.accountId === accountId &&
          entry.valueDay === day,
      );
    const activeFee = feesForDay.find((fee) => !ledger.isReversed(fee.entryId));

    if (balance < 0 && !activeFee) {
      if (ledger.account(accountId).currency !== "AED") {
        throw new Error(`Overdraft fee is defined only in AED; ${accountId} is not AED`);
      }
      // The counter keeps ids unique if a day is charged, refunded, then charged again.
      const entryId = `FEE-${accountId}-D${day}-${feesForDay.length + 1}`;
      ledger.append({
        entryId,
        accountId,
        kind: "OVERDRAFT_FEE",
        amount: -OVERDRAFT_FEE,
        valueDay: day,
        bookedDay,
      });
      changes.push({ accountId, forDay: day, action: "ASSESSED", entryId, balanceWithoutOwnFee: balance });
    } else if (balance >= 0 && activeFee) {
      const entryId = `${activeFee.entryId}-REV`;
      ledger.append({
        entryId,
        accountId,
        kind: "FEE_REVERSAL",
        amount: -activeFee.amount,
        valueDay: day,
        bookedDay,
        reversesEntryId: activeFee.entryId,
      });
      changes.push({ accountId, forDay: day, action: "REVERSED", entryId, balanceWithoutOwnFee: balance });
    }
  }

  return changes;
}