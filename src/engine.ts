import type {
  Account,
  Authorization,
  Day,
  ProcessingError,
  ReversalEvent,
  StreamEvent,
} from "./types.js";
import type { Currency } from "./money.js";
import { splitExactly } from "./money.js";
import { Ledger } from "./ledger.js";
import { AuthorizationBook } from "./authorizations.js";
import { reconcileOverdraftFees, type FeeChange } from "./fees.js";
import { capitalizeInterest, type InterestResult } from "./interest.js";

export interface Restatement {
  readonly day: Day;
  readonly previous: number;
  readonly current: number;
}

export interface AccountDaySnapshot {
  readonly accountId: string;
  readonly currency: Currency;
  readonly closingBalance: number;
  readonly activeHolds: number;
  readonly availableBalance: number;
  /** Past days whose closing balance changed since we last reported them. */
  readonly restatements: readonly Restatement[];
}

export interface DayResult {
  readonly day: Day;
  readonly eventIds: readonly string[];
  readonly notes: readonly string[];
  readonly errors: readonly ProcessingError[];
  readonly fees: readonly FeeChange[];
  readonly authorizations: readonly Authorization[];
  readonly accounts: readonly AccountDaySnapshot[];
  readonly interest: readonly InterestResult[];
}

export interface ReplayResult {
  readonly days: readonly DayResult[];
  readonly ledger: Ledger;
  readonly authorizations: AuthorizationBook;
}

interface DayWork {
  eventIds: string[];
  notes: string[];
  errors: ProcessingError[];
}

const emptyWork = (): DayWork => ({ eventIds: [], notes: [], errors: [] });

export function replay(
  accounts: readonly Account[],
  events: readonly StreamEvent[],
  lastDay: Day,
): ReplayResult {
  const ledger = new Ledger(accounts);
  const book = new AuthorizationBook();
  const days: DayResult[] = [];

  /** The closing balance we last reported, per account and per day. */
  const reported = new Map<string, Map<Day, number>>();

  let currentDay: Day = 1;
  let work = emptyWork();

  function snapshot(account: Account, day: Day): AccountDaySnapshot {
    let history = reported.get(account.id);
    if (!history) {
      history = new Map();
      reported.set(account.id, history);
    }

    const restatements: Restatement[] = [];
    for (let past = 1; past < day; past++) {
      const previous = history.get(past);
      const current = ledger.balanceAsOf(account.id, past);
      if (previous !== undefined && previous !== current) {
        restatements.push({ day: past, previous, current });
      }
      history.set(past, current);
    }

    const closingBalance = ledger.balanceAsOf(account.id, day);
    history.set(day, closingBalance);
    const activeHolds = book.activeHolds(account.id);

    return {
      accountId: account.id,
      currency: account.currency,
      closingBalance,
      activeHolds,
      availableBalance: closingBalance - activeHolds,
      restatements,
    };
  }

  function closeDay(day: Day): void {
    const fees = accounts.flatMap((account) =>
      reconcileOverdraftFees(ledger, account.id, day, day),
    );
    const interest =
      day === lastDay
        ? accounts.map((account) => capitalizeInterest(ledger, account.id, day, day))
        : [];

    days.push({
      day,
      eventIds: work.eventIds,
      notes: work.notes,
      errors: work.errors,
      fees,
      authorizations: book.all(),
      accounts: accounts.map((account) => snapshot(account, day)),
      interest,
    });
    work = emptyWork();
  }

  for (const event of events) {
    if (event.bookedDay > lastDay) {
      throw new Error(`${event.id} is booked on Day ${event.bookedDay}, after the window ends`);
    }

    while (event.bookedDay > currentDay) {
      closeDay(currentDay);
      currentDay++;
    }

    if (event.bookedDay < currentDay) {
      work.notes.push(
        `${event.id} is dated Day ${event.bookedDay} but arrived after Day ${currentDay} began: ` +
          `processed on Day ${currentDay}, value date stays Day ${event.valueDay}.`,
      );
    }

    work.eventIds.push(event.id);
    const error = applyEvent(ledger, book, event, currentDay);
    if (error) {
      work.errors.push(error);
    }
  }

  while (currentDay <= lastDay) {
    closeDay(currentDay);
    currentDay++;
  }

  return { days, ledger, authorizations: book };
}

/**
 * Applies one event on the day it is actually processed. The event itself is
 * never changed: a copy stamped with the processing day is passed on.
 */
function applyEvent(
  ledger: Ledger,
  book: AuthorizationBook,
  event: StreamEvent,
  day: Day,
): ProcessingError | undefined {
  switch (event.type) {
    case "CREDIT": {
      const parts = splitExactly(event.amount, event.instalments ?? 1);
      parts.forEach((amount, i) =>
        ledger.append({
          entryId: parts.length === 1 ? event.id : `${event.id}-${i + 1}`,
          accountId: event.accountId,
          kind: "CREDIT",
          amount,
          valueDay: event.valueDay,
          bookedDay: day,
          sourceEventId: event.id,
        }),
      );
      return undefined;
    }

    case "DEBIT":
      ledger.append({
        entryId: event.id,
        accountId: event.accountId,
        kind: "DEBIT",
        amount: -event.amount,
        valueDay: event.valueDay,
        bookedDay: day,
        sourceEventId: event.id,
      });
      return undefined;

    case "AUTHORIZATION":
      book.request(ledger, { ...event, bookedDay: day });
      return undefined;

    case "SETTLEMENT":
      return book.settle(ledger, { ...event, bookedDay: day });

    case "REVERSAL":
      return reverse(ledger, event, day);

    default: {
      // If a new event type is added and not handled above, this line won't compile.
      const unhandled: never = event;
      throw new Error(`Unhandled event: ${JSON.stringify(unhandled)}`);
    }
  }
}

/** Cancels every entry an earlier event created, by appending opposite entries. */
function reverse(ledger: Ledger, event: ReversalEvent, day: Day): ProcessingError | undefined {
  const originals = ledger
    .entries()
    .filter(
      (entry) =>
        entry.sourceEventId === event.reversesEventId &&
        entry.accountId === event.accountId &&
        entry.kind !== "REVERSAL",
    );

  if (originals.length === 0) {
    return {
      day,
      eventId: event.id,
      accountId: event.accountId,
      code: "REVERSAL_TARGET_NOT_FOUND",
      message: `${event.id} reverses ${event.reversesEventId}, which moved no money on this account. Nothing reversed.`,
    };
  }

  if (originals.some((entry) => ledger.isReversed(entry.entryId))) {
    return {
      day,
      eventId: event.id,
      accountId: event.accountId,
      code: "ALREADY_REVERSED",
      message: `${event.reversesEventId} was already reversed. Nothing reversed.`,
    };
  }

  originals.forEach((original, i) =>
    ledger.append({
      entryId: originals.length === 1 ? event.id : `${event.id}-${i + 1}`,
      accountId: event.accountId,
      kind: "REVERSAL",
      amount: -original.amount,
      valueDay: event.valueDay,
      bookedDay: day,
      sourceEventId: event.id,
      reversesEntryId: original.entryId,
    }),
  );
  return undefined;
}