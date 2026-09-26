import type { Currency } from "./money.js";

/** A business day in the window (1–6). */
export type Day = number;

export interface Account {
  readonly id: string;
  readonly currency: Currency;
  /** Opening balance in minor units. */
  readonly openingBalance: number;
}

// ─── Input events: what arrives in the stream. Never mutated. ───

interface EventBase {
  /** Event id from the brief, e.g. "E7". */
  readonly id: string;
  readonly accountId: string;
  /** Clock 1: the day the system receives the event. Drives decisions. */
  readonly bookedDay: Day;
  /** Clock 2: the day the money counts for balances. Drives balances. */
  readonly valueDay: Day;
}

export interface CreditEvent extends EventBase {
  readonly type: "CREDIT";
  /** Positive amount in minor units. */
  readonly amount: number;
  /** Post as this many instalments that sum exactly to `amount` (default 1). */
  readonly instalments?: number;
}

export interface DebitEvent extends EventBase {
  readonly type: "DEBIT";
  /** Positive amount in minor units (the ledger records it as negative). */
  readonly amount: number;
}

export interface AuthorizationEvent extends EventBase {
  readonly type: "AUTHORIZATION";
  readonly authId: string;
  /** Amount to hold, in minor units. */
  readonly amount: number;
}

export interface SettlementEvent extends EventBase {
  readonly type: "SETTLEMENT";
  readonly authId: string;
  /** Final amount to move, in minor units. */
  readonly amount: number;
}

export interface ReversalEvent extends EventBase {
  readonly type: "REVERSAL";
  /** The event whose money movement is cancelled, e.g. "E7". */
  readonly reversesEventId: string;
}

/** Any event in the stream. `type` tells TypeScript which one it is. */
export type StreamEvent =
  | CreditEvent
  | DebitEvent
  | AuthorizationEvent
  | SettlementEvent
  | ReversalEvent;

// ─── Ledger entries: money that actually moved. Append-only. ───

export type EntryKind =
  | "CREDIT"
  | "DEBIT"
  | "SETTLEMENT"
  | "REVERSAL"
  | "OVERDRAFT_FEE"
  | "FEE_REVERSAL"
  | "INTEREST";

export interface LedgerEntry {
  /** Unique id, e.g. "E1", "E10-2", "FEE-ACC-001-D2". */
  readonly entryId: string;
  readonly accountId: string;
  readonly kind: EntryKind;
  /** Signed minor units: positive = money in, negative = money out. */
  readonly amount: number;
  readonly valueDay: Day;
  readonly bookedDay: Day;
  /** The input event that caused this entry. Fees and interest have none. */
  readonly sourceEventId?: string;
  /** For REVERSAL and FEE_REVERSAL: the entry being cancelled. */
  readonly reversesEntryId?: string;
}

// ─── Authorizations: derived state, rebuilt from events. ───

export type AuthStatus = "APPROVED" | "DECLINED" | "SETTLED";

export interface Authorization {
  readonly authId: string;
  readonly accountId: string;
  /** The event that requested it, e.g. "E3". */
  readonly eventId: string;
  /** Amount held (or requested, if declined), in minor units. */
  readonly amount: number;
  readonly decidedOnDay: Day;
  readonly status: AuthStatus;
  readonly settledAmount?: number;
  readonly settledOnDay?: Day;
}

// ─── Errors: events that could not be applied. Recorded, never hidden. ───

export type ErrorCode =
  | "UNKNOWN_AUTHORIZATION"
  | "AUTHORIZATION_NOT_ACTIVE"
  | "REVERSAL_TARGET_NOT_FOUND"
  | "ALREADY_REVERSED";

export interface ProcessingError {
  readonly day: Day;
  readonly eventId: string;
  readonly accountId: string;
  readonly code: ErrorCode;
  readonly message: string;
}