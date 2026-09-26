import type {
  Authorization,
  AuthorizationEvent,
  ProcessingError,
  SettlementEvent,
} from "./types.js";
import type { Ledger } from "./ledger.js";
import { formatMinor } from "./money.js";

export class AuthorizationBook {
  readonly #auths = new Map<string, Authorization>();

  get(authId: string): Authorization | undefined {
    return this.#auths.get(authId);
  }

  all(): readonly Authorization[] {
    return [...this.#auths.values()];
  }

  /** Sum of holds that are approved and not yet settled. */
  activeHolds(accountId: string): number {
    let total = 0;
    for (const auth of this.#auths.values()) {
      if (auth.accountId === accountId && auth.status === "APPROVED") {
        total += auth.amount;
      }
    }
    return total;
  }

  /**
   * Rule: approve only if available (ledger − active holds) stays ≥ 0
   * after this hold. "Ledger" = entries with valueDay ≤ the booked day,
   * as known right now.
   */
  request(ledger: Ledger, event: AuthorizationEvent): Authorization {
    if (this.#auths.has(event.authId)) {
      throw new Error(`Duplicate authorization id: ${event.authId}`);
    }

    const ledgerBalance = ledger.balanceAsOf(event.accountId, event.bookedDay);
    const availableAfterHold =
      ledgerBalance - this.activeHolds(event.accountId) - event.amount;

    const auth: Authorization = {
      authId: event.authId,
      accountId: event.accountId,
      eventId: event.id,
      amount: event.amount,
      decidedOnDay: event.bookedDay,
      availableAfterHold,
      status: availableAfterHold >= 0 ? "APPROVED" : "DECLINED",
    };
    this.#auths.set(event.authId, auth);
    return auth;
  }

  /**
   * Settles an approved hold: moves the final amount and releases the
   * whole hold. Returns an error (and moves no money) if the authorization
   * is unknown, belongs to another account, is no longer active, or the
   * settlement is larger than the approved hold.
   */
  settle(ledger: Ledger, event: SettlementEvent): ProcessingError | undefined {
    const auth = this.#auths.get(event.authId);
    const currency = ledger.account(event.accountId).currency;

    if (!auth || auth.accountId !== event.accountId) {
      return {
        day: event.bookedDay,
        eventId: event.id,
        accountId: event.accountId,
        code: "UNKNOWN_AUTHORIZATION",
        message: `Settlement of ${formatMinor(event.amount, currency)} rejected: no authorization ${event.authId} on this account. No funds moved.`,
      };
    }

    if (auth.status !== "APPROVED") {
      return {
        day: event.bookedDay,
        eventId: event.id,
        accountId: event.accountId,
        code: "AUTHORIZATION_NOT_ACTIVE",
        message: `Settlement rejected: ${event.authId} is ${auth.status}. No funds moved.`,
      };
    }

    if (event.amount > auth.amount) {
      return {
        day: event.bookedDay,
        eventId: event.id,
        accountId: event.accountId,
        code: "SETTLEMENT_EXCEEDS_HOLD",
        message: `Settlement of ${formatMinor(event.amount, currency)} exceeds hold of ${formatMinor(auth.amount, currency)} for ${event.authId}. No funds moved.`,
      };
    }

    ledger.append({
      entryId: event.id,
      accountId: event.accountId,
      kind: "SETTLEMENT",
      amount: -event.amount,
      valueDay: event.valueDay,
      bookedDay: event.bookedDay,
      sourceEventId: event.id,
    });

    // Replace, don't edit: the old record is swapped for a new SETTLED one.
    this.#auths.set(auth.authId, {
      ...auth,
      status: "SETTLED",
      settledAmount: event.amount,
      settledOnDay: event.bookedDay,
    });
    return undefined;
  }
}