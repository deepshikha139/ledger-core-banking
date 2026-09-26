import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { replay } from "../src/engine.js";
import { formatReport } from "../src/report.js";
import { ACCOUNTS, EVENTS, LAST_DAY } from "../src/scenario.js";

const output = formatReport(replay(ACCOUNTS, EVENTS, LAST_DAY));

describe("report output", () => {
  it("prints a section for each of the 6 days", () => {
    for (let day = 1; day <= 6; day++) {
      assert.ok(output.includes(`DAY ${day} `), `missing Day ${day}`);
    }
  });

  it("shows the Auth-Z error", () => {
    assert.ok(output.includes("E6 (ACC-001) UNKNOWN_AUTHORIZATION"));
  });

  it("shows Auth-B declined with the deciding number", () => {
    assert.ok(output.includes("Auth-B (E8, ACC-001): DECLINED"));
    assert.ok(output.includes("-245.00 AED"));
  });

  it("shows the restated Day 2 balance", () => {
    assert.ok(output.includes("restated Day 2: 250.00 AED -> -395.00 AED"));
  });

  it("shows final balances with interest", () => {
    assert.ok(output.includes("ledger 466.03 AED"));
    assert.ok(output.includes("ledger 10.008 BHD"));
  });
});