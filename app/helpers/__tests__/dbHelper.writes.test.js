/**
 * Tests for the player rich-data write adapter (loadPlayersWithData,
 * savePlayerKey, addTeamCash). The mutating tests run inside a transaction that
 * is rolled back, so production data is never actually changed. No-ops without
 * DATABASE_URL.
 */
const test = require("node:test");
const assert = require("node:assert");
const { eq, and } = require("drizzle-orm");

const {
  getDb,
  getCurrentSeasonId,
  loadPlayersWithData,
  savePlayerKey,
  addTeamCash,
  getValidTeams,
} = require("../dbHelper");

const hasDb = !!process.env.DATABASE_URL;

test("loadPlayersWithData reconstructs the old Data blob", async () => {
  if (!hasDb) return;
  const ps = await loadPlayersWithData({ teamStatuses: ["ROSTERED"] });
  assert.ok(ps.length > 0, "should return rostered players");
  const p = ps.find(
    (x) => x.Data.find((t) => t.tab === "ATTRIBUTES" && Object.keys(t.data).length)
  );
  assert.ok(p, "some player has attributes");
  assert.deepStrictEqual(
    p.Data.map((t) => t.tab),
    ["VITALS", "ATTRIBUTES", "BADGES", "HOTZONE", "TENDENCIES"]
  );
  assert.ok(p.Name && p.Team && p.playerSeasonId, "carries Name/Team/playerSeasonId");
});

test("savePlayerKey + addTeamCash mutate the right stores, then roll back", async () => {
  if (!hasDb) return;
  const { db, schema } = getDb();
  const sid = await getCurrentSeasonId();
  const ps = await loadPlayersWithData({ teamStatuses: ["ROSTERED"] });
  const p = ps.find(
    (x) => x.Data.find((t) => t.tab === "ATTRIBUTES").data["3PT_SHOT"] != null
  );
  assert.ok(p, "need a player with a 3PT_SHOT attribute");
  const before = Number(p.Data.find((t) => t.tab === "ATTRIBUTES").data["3PT_SHOT"]);
  const team = (await getValidTeams())[0];

  let insideRan = false;
  await assert.rejects(
    db.transaction(async (tx) => {
      await savePlayerKey(p.playerSeasonId, "ATTRIBUTES", "3PT_SHOT", 111, tx);
      await savePlayerKey(p.playerSeasonId, "BADGES", "CLAMPS", 4, tx);
      await addTeamCash(team.teamId, -3, { seasonId: sid, exec: tx });

      const a = await tx
        .select({ v: schema.playerAttributes.value })
        .from(schema.playerAttributes)
        .where(
          and(
            eq(schema.playerAttributes.playerSeasonId, p.playerSeasonId),
            eq(schema.playerAttributes.attrCode, "3PT_SHOT")
          )
        );
      assert.strictEqual(Number(a[0].v), 111, "attribute updated inside tx");

      const b = await tx
        .select({ badges: schema.playerSeasons.badges })
        .from(schema.playerSeasons)
        .where(eq(schema.playerSeasons.id, p.playerSeasonId));
      assert.strictEqual(Number(b[0].badges.CLAMPS), 4, "badge set inside tx");

      insideRan = true;
      throw new Error("ROLLBACK_SENTINEL");
    }),
    /ROLLBACK_SENTINEL/
  );
  assert.ok(insideRan, "transaction body executed");

  const after = (await loadPlayersWithData({ teamStatuses: ["ROSTERED"] })).find(
    (x) => x.playerSeasonId === p.playerSeasonId
  );
  assert.strictEqual(
    Number(after.Data.find((t) => t.tab === "ATTRIBUTES").data["3PT_SHOT"]),
    before,
    "3PT_SHOT was rolled back (prod untouched)"
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
