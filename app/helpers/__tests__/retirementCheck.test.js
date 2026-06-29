/**
 * Integration test for the ported retirementCheck. It now (1) announces the
 * rolled retiree set, (2) marks each retiree RETIRED in the DB, and (3) locks
 * the season so a re-run can't retire more players. The mutating run is wrapped
 * in a transaction that is ROLLED BACK, so production data is never changed.
 * No-ops without DATABASE_URL.
 */
const test = require("node:test");
const assert = require("node:assert");
const { eq, and, inArray } = require("drizzle-orm");

// Require at top so @youmkim/vnba-db's dotenv.config() loads the bot's .env first.
const retirementCheck = require("../retirementCheck");
const { getDb, getCurrentSeasonId, getSeasonFlag, setSeasonFlag } = require("../dbHelper");
const hasDb = !!process.env.DATABASE_URL;

const RETIREMENT_FLAG = "retirementProcessed";

// Collect every message the bot would post.
function stubClient() {
  const sentMessages = [];
  return {
    sentMessages,
    channels: {
      cache: {
        get() {
          return { send: (msg) => sentMessages.push(msg) };
        },
      },
    },
  };
}

test("retires the rolled set, locks the season, and is idempotent (rolled back)", async () => {
  if (!hasDb) return;
  const { db, schema } = getDb();
  const sid = await getCurrentSeasonId();
  const flagBefore = await getSeasonFlag(RETIREMENT_FLAG, { seasonId: sid });

  let insideRan = false;
  await assert.rejects(
    db.transaction(async (tx) => {
      // Force "not yet processed" within this tx, regardless of prod state.
      await setSeasonFlag(RETIREMENT_FLAG, false, { seasonId: sid, exec: tx });

      // First run: announce + retire + lock, all on the injected tx.
      const client1 = stubClient();
      const res1 = await retirementCheck(client1, { exec: tx, seasonId: sid });
      assert.strictEqual(res1.alreadyProcessed, false, "first run processes");
      assert.ok(
        client1.sentMessages.some((m) =>
          /retiring before the start of the next VNBA season/.test(m)
        ),
        "announces the retiree list"
      );

      // The season is locked inside the same tx.
      assert.strictEqual(
        await getSeasonFlag(RETIREMENT_FLAG, { seasonId: sid, exec: tx }),
        true,
        "season locked as processed"
      );

      // Each rolled retiree is actually RETIRED and off their team.
      if (res1.retiredIds.length) {
        const rows = await tx
          .select({
            id: schema.playerSeasons.id,
            status: schema.playerSeasons.teamStatus,
            teamId: schema.playerSeasons.teamId,
          })
          .from(schema.playerSeasons)
          .where(inArray(schema.playerSeasons.id, res1.retiredIds));
        assert.strictEqual(rows.length, res1.retiredIds.length, "all retirees found");
        for (const r of rows) {
          assert.strictEqual(r.status, "RETIRED", `ps ${r.id} is RETIRED`);
          assert.strictEqual(r.teamId, null, `ps ${r.id} left its team`);
        }
      }

      // Second run: the lock makes it a no-op that retires nobody.
      const client2 = stubClient();
      const res2 = await retirementCheck(client2, { exec: tx, seasonId: sid });
      assert.strictEqual(res2.alreadyProcessed, true, "second run is a no-op");
      assert.deepStrictEqual(res2.retiredIds, [], "second run retires nobody");
      assert.ok(
        client2.sentMessages.some((m) => /already been processed/.test(m)),
        "second run announces it was already processed"
      );

      insideRan = true;
      throw new Error("ROLLBACK_SENTINEL");
    }),
    /ROLLBACK_SENTINEL/
  );
  assert.ok(insideRan, "transaction body executed");

  // Prod is untouched: the lock we set was rolled back to its prior value.
  assert.strictEqual(
    await getSeasonFlag(RETIREMENT_FLAG, { seasonId: sid }),
    flagBefore,
    "season lock unchanged in prod (rolled back)"
  );
});

test.after(async () => {
  if (!hasDb) return;
  try {
    const { db } = getDb();
    const pool = db.$client || (db.session && db.session.client);
    if (pool && pool.end) await pool.end();
  } catch (_) {
    /* best effort */
  }
});
