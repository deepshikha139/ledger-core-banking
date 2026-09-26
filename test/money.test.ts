import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toMinor,
  formatMinor,
  divideHalfUp,
  splitExactly,
} from "../src/money.js";

describe("toMinor", () => {
  it("parses AED with 2 decimals into minor units", () => {
    assert.equal(toMinor("1200.00", "AED"), 120000);
    assert.equal(toMinor("25", "AED"), 2500);
  });

  it("parses BHD with 3 decimals into minor units", () => {
    assert.equal(toMinor("10.000", "BHD"), 10000);
  });

  it("parses negative amounts", () => {
    assert.equal(toMinor("-370.00", "AED"), -37000);
  });

  it("rejects more decimals than the currency allows (no silent rounding)", () => {
    assert.throws(() => toMinor("1.005", "AED"));
  });

  it("rejects text that is not a number", () => {
    assert.throws(() => toMinor("abc", "AED"));
  });
});

describe("formatMinor", () => {
  it("formats AED with 2 decimals", () => {
    assert.equal(formatMinor(120000, "AED"), "1200.00");
    assert.equal(formatMinor(5, "AED"), "0.05");
    assert.equal(formatMinor(0, "AED"), "0.00");
  });

  it("formats negative amounts", () => {
    assert.equal(formatMinor(-37000, "AED"), "-370.00");
  });

  it("formats BHD with 3 decimals", () => {
    assert.equal(formatMinor(3334, "BHD"), "3.334");
  });
});

describe("divideHalfUp", () => {
  it("rounds down below .5", () => {
    assert.equal(divideHalfUp(184999, 10000), 18); // 18.4999 → 18
  });

  it("rounds up at exactly .5", () => {
    assert.equal(divideHalfUp(185000, 10000), 19); // 18.5 → 19
  });

  it("rounds up above .5 (465.00 AED × 0.04% = 0.186 → 0.19)", () => {
    // 46500 minor units × 4 basis points = 186000; ÷ 10000 = 18.6 → 19 (AED 0.19)
    assert.equal(divideHalfUp(46500 * 4, 10000), 19);
  });

  it("is exact when there is no remainder (250.00 AED × 0.04% = 0.10)", () => {
    assert.equal(divideHalfUp(25000 * 4, 10000), 10);
  });

  it("refuses negative numerators", () => {
    assert.throws(() => divideHalfUp(-100, 10000));
  });
});

describe("splitExactly", () => {
  it("splits BHD 10.000 into three parts that sum exactly (E10)", () => {
    const parts = splitExactly(10000, 3);
    assert.deepEqual(parts, [3333, 3333, 3334]);
    assert.equal(parts.reduce((a, b) => a + b, 0), 10000);
  });

  it("gives equal parts when there is no remainder", () => {
    assert.deepEqual(splitExactly(10000, 2), [5000, 5000]);
  });

  it("spreads a remainder of 2 across the last two parts", () => {
    assert.deepEqual(splitExactly(11, 3), [3, 4, 4]);
  });
});