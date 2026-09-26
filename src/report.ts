import type { DayResult, ReplayResult } from "./engine.js";
import type { Authorization } from "./types.js";
import { formatMinor } from "./money.js";
import { OVERDRAFT_FEE } from "./fees.js";

/** Formats minor units with the account's own currency and precision. */
type Money = (minor: number, accountId: string) => string;

export function formatReport(result: ReplayResult): string {
  const currencyOf = new Map(result.ledger.accounts().map((a) => [a.id, a.currency] as const));

  const money: Money = (minor, accountId) => {
    const currency = currencyOf.get(accountId);
    if (!currency) {
      throw new Error(`Unknown account: ${accountId}`);
    }
    return `${formatMinor(minor, currency)} ${currency}`;
  };

  return result.days.flatMap((day) => formatDay(day, money)).join("\n");
}

function formatDay(day: DayResult, money: Money): string[] {
  const lines: string[] = [
    "",
    `==================== DAY ${day.day} ====================`,
    `Events processed: ${day.eventIds.length > 0 ? day.eventIds.join(", ") : "none"}`,
  ];
  for (const note of day.notes) {
    lines.push(`Note: ${note}`);
  }

  lines.push("", "Closing balances:");
  for (const a of day.accounts) {
    lines.push(
      `  ${a.accountId}  ledger ${money(a.closingBalance, a.accountId)}` +
        `  | holds ${money(a.activeHolds, a.accountId)}` +
        `  | available ${money(a.availableBalance, a.accountId)}`,
    );
    for (const r of a.restatements) {
      lines.push(
        `    restated Day ${r.day}: ${money(r.previous, a.accountId)} -> ${money(r.current, a.accountId)}`,
      );
    }
  }

  lines.push("", "Fee assessments:");
  if (day.fees.length === 0) {
    lines.push("  none");
  }
  for (const f of day.fees) {
    const amount = f.action === "ASSESSED" ? money(-OVERDRAFT_FEE, f.accountId) : `+${money(OVERDRAFT_FEE, f.accountId)}`;
    lines.push(
      `  ${f.accountId} Day ${f.forDay}: ${f.action} ${amount}` +
        `  (Day ${f.forDay} closing without its own fee: ${money(f.balanceWithoutOwnFee, f.accountId)})`,
    );
  }

  lines.push("", "Authorization states:");
  if (day.authorizations.length === 0) {
    lines.push("  none");
  }
  for (const auth of day.authorizations) {
    lines.push(describeAuthorization(auth, money));
  }

  lines.push("", "Errors:");
  if (day.errors.length === 0) {
    lines.push("  none");
  }
  for (const e of day.errors) {
    lines.push(`  ${e.eventId} (${e.accountId}) ${e.code}: ${e.message}`);
  }

  if (day.interest.length > 0) {
    lines.push("", "Interest capitalized:");
    for (const i of day.interest) {
      const daily = i.accruals.map((a) => money(a.accrual, i.accountId).split(" ")[0]).join(" + ");
      lines.push(`  ${i.accountId}: ${daily} = ${money(i.total, i.accountId)} (credited, value Day ${day.day})`);
    }
  }

  return lines;
}

function describeAuthorization(auth: Authorization, money: Money): string {
  const base = `  ${auth.authId} (${auth.eventId}, ${auth.accountId}): ${auth.status}`;
  const held = money(auth.amount, auth.accountId);
  const available = money(auth.availableAfterHold, auth.accountId);

  switch (auth.status) {
    case "APPROVED":
      return `${base} - hold ${held} active (available after hold: ${available})`;
    case "DECLINED":
      return `${base} - requested ${held} (available after hold would be ${available})`;
    case "SETTLED": {
      const settled = auth.settledAmount === undefined ? "?" : money(auth.settledAmount, auth.accountId);
      return `${base} - settled ${settled} on Day ${auth.settledOnDay}; full hold of ${held} released`;
    }
  }
}