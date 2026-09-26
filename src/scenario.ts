import type { Account, StreamEvent } from "./types.js";
import { toMinor } from "./money.js";

export const LAST_DAY = 6;

export const ACCOUNTS: readonly Account[] = [
  { id: "ACC-001", currency: "AED", openingBalance: toMinor("0.00", "AED") },
  { id: "ACC-002", currency: "BHD", openingBalance: toMinor("0.000", "BHD") },
];

/** Replayed in exactly this order (the brief's order, not sorted by date). */
export const EVENTS: readonly StreamEvent[] = [
  { id: "E1", type: "CREDIT", accountId: "ACC-001", amount: toMinor("1200.00", "AED"), bookedDay: 1, valueDay: 1 },
  { id: "E2", type: "DEBIT", accountId: "ACC-001", amount: toMinor("950.00", "AED"), bookedDay: 1, valueDay: 1 },
  { id: "E3", type: "AUTHORIZATION", accountId: "ACC-001", authId: "Auth-A", amount: toMinor("200.00", "AED"), bookedDay: 2, valueDay: 2 },
  { id: "E4", type: "CREDIT", accountId: "ACC-001", amount: toMinor("400.00", "AED"), bookedDay: 3, valueDay: 3 },
  { id: "E5", type: "SETTLEMENT", accountId: "ACC-001", authId: "Auth-A", amount: toMinor("185.00", "AED"), bookedDay: 4, valueDay: 4 },
  { id: "E6", type: "SETTLEMENT", accountId: "ACC-001", authId: "Auth-Z", amount: toMinor("180.00", "AED"), bookedDay: 4, valueDay: 4 },
  { id: "E7", type: "DEBIT", accountId: "ACC-001", amount: toMinor("620.00", "AED"), bookedDay: 5, valueDay: 2 },
  { id: "E8", type: "AUTHORIZATION", accountId: "ACC-001", authId: "Auth-B", amount: toMinor("90.00", "AED"), bookedDay: 5, valueDay: 5 },
  { id: "E9", type: "REVERSAL", accountId: "ACC-001", reversesEventId: "E7", bookedDay: 6, valueDay: 2 },
  { id: "E10", type: "CREDIT", accountId: "ACC-002", amount: toMinor("10.000", "BHD"), instalments: 3, bookedDay: 5, valueDay: 5 },
];