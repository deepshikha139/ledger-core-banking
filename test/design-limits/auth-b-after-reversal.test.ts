import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { replay } from "../../src/engine.js";
import { ACCOUNTS, EVENTS, LAST_DAY } from "../../src/scenario.js";

describe("Design limit: authorization decisions are never revisited", () => {
  it("Auth-B should be approvable once E7 (the only reason it was declined) is reversed", () => {
    const result = replay(ACCOUNTS, EVENTS, LAST_DAY);
    const authB = result.authorizations.get("Auth-B");

    // WHAT HAPPENED
    // Day 5: E7 (-620.00, value Day 2) arrives, then Auth-B asks to hold 90.00.
    // Available after hold = -155.00 - 90.00 = -245.00, so Auth-B is DECLINED.
    // Day 6: E9 reverses E7. E7 was wrong all along.

    // On the final, corrected history, Day 5 closes at 465.00 with no holds,
    // so Auth-B would have had 465.00 - 90.00 = 375.00 available. This passes:
    const finalDay5 = result.ledger.balanceAsOf("ACC-001", 5);
    assert.equal(finalDay5 - 9000, 37500);

    // THE FAILING ASSERTION
    // Auth-B is still DECLINED, because decisions are point-in-time and are
    // never re-run (Invariant D). This line fails:
    assert.equal(
        authB?.status,
        "APPROVED",
        "Auth-B is still DECLINED: decisions are never revisited after a reversal (see comments)",
    );

    // WHAT IT REVEALS
    // 1. A customer was refused a payment because of a posting that was later
    //    reversed as wrong. Balances and fees were corrected; the decline was not.
    // 2. The system cannot even tell which declines were caused by E7: an
    //    authorization stores the deciding number (availableAfterHold), but not
    //    which ledger entries produced it. So nothing can flag Auth-B for review.
    // 3. Fees got a remedy (fee reversal). Declines have none: no notification,
    //    no link, no review queue.
    //
    // WHY I KEEP THE DESIGN ANYWAY
    // - A card authorization is answered in real time. The merchant was already
    //   told "no" on Day 5; approving it on Day 6 would change nothing real.
    // - Re-running past decisions would make history unstable: replaying the same
    //   events could "change its mind" about what the system told people.
    //
    // WHAT PRODUCTION WOULD ADD
    // - Store, with each decision, the ledger entries its balance was based on.
    // - When a reversal lands, find declines whose deciding balance included the
    //   reversed entry, and send them to an operations review queue.
    // - Limit how far back a value date may reach, to shrink this window.
  });
});