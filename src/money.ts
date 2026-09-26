/**
 * money.ts — all money arithmetic lives here.
 *
 * Amounts are stored as integers in the currency's minor unit
 * (AED: 1/100, BHD: 1/1000). Floating-point numbers never hold money.
 * Decimals appear only when formatting for output.
 */

export type Currency = "AED" | "BHD";

/** Decimal places per currency, as given in the brief. */
export const SCALE: Record<Currency, number> = {
  AED: 2,
  BHD: 3,
};

/** How many minor units make one major unit (AED → 100, BHD → 1000). */
export function minorPerMajor(currency: Currency): number {
  return 10 ** SCALE[currency];
}

/** Throws if a value is not a whole number that JavaScript can store exactly. */
export function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer, got ${value}`);
  }
}

/**
 * Parses a decimal string like "1200.00" into minor units (120000).
 * Uses string parsing, never parseFloat, so no precision is lost.
 * Rejects more decimals than the currency allows instead of silently rounding.
 */
export function toMinor(amount: string, currency: Currency): number {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) {
    throw new Error(`Invalid amount: "${amount}"`);
  }

  const [, sign, whole = "0", fraction = ""] = match;
  const scale = SCALE[currency];
  if (fraction.length > scale) {
    throw new Error(`${currency} allows ${scale} decimals, got "${amount}"`);
  }

  const minor =
    Number(whole) * minorPerMajor(currency) + Number(fraction.padEnd(scale, "0"));
  const result = sign ? -minor : minor;
  assertSafeInteger(result, "amount");
  return result;
}

/** Formats minor units for display: (120000, AED) → "1200.00", (-37000, AED) → "-370.00". */
export function formatMinor(minor: number, currency: Currency): string {
  assertSafeInteger(minor, "amount");
  const unit = minorPerMajor(currency);
  const abs = Math.abs(minor);
  const whole = (abs - (abs % unit)) / unit;
  const fraction = String(abs % unit).padStart(SCALE[currency], "0");
  const sign = minor < 0 ? "-" : "";
  return `${sign}${whole}.${fraction}`;
}

/**
 * Divides two integers and rounds half-up (exactly .5 goes up).
 * Only non-negative numerators are allowed: interest never applies to
 * negative balances, and "half-up" is ambiguous for negatives.
 * Example: divideHalfUp(186000, 10000) → 18.6 → 19.
 */
export function divideHalfUp(numerator: number, denominator: number): number {
  assertSafeInteger(numerator, "numerator");
  assertSafeInteger(denominator, "denominator");
  if (numerator < 0) {
    throw new Error("divideHalfUp only supports non-negative numerators");
  }
  if (denominator <= 0) {
    throw new Error("denominator must be positive");
  }

  const remainder = numerator % denominator;
  const quotient = (numerator - remainder) / denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}

/**
 * Splits a total into `parts` whole-number pieces that add up exactly.
 * Leftover minor units go to the last pieces, one each.
 * Example: splitExactly(10000, 3) → [3333, 3333, 3334].
 */
export function splitExactly(total: number, parts: number): number[] {
  assertSafeInteger(total, "total");
  if (total < 0) {
    throw new Error("total must be non-negative");
  }
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error("parts must be a positive integer");
  }

  const remainder = total % parts;
  const base = (total - remainder) / parts;
  return Array.from({ length: parts }, (_, i) =>
    i >= parts - remainder ? base + 1 : base,
  );
}