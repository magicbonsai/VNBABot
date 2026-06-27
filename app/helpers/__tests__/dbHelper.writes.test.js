/**
 * Tests for the player rich-data write adapter (loadPlayersWithData,
 * savePlayerKey, addTeamCash). The mutating tests run inside a transaction that
 * is rolled back, so production data is never actually changed. No-ops without
 * DATABASE_URL.
 */
const test = require("node:test");
const assert = require("node:assert");
const { eq, and, sql } = require("drizzle-orm");

const {
  getDb,
  getCurrentSeasonId,
  loadPlayersWithData,
  savePlayerKey,
  addTeamCash,
  getValidTeams,
  signFreeAgent,
  createRookie,
  saveTrikov,
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

test("signFreeAgent moves the player to the team + debits cash atomically (rolled back)", async () => {
  if (!hasDb) return;
  const { db, schema } = getDb();
  const sid = await getCurrentSeasonId();
  const team = (await getValidTeams())[0];
  const cashBefore = team.cash;
  const ps = await loadPlayersWithData({ teamStatuses: ["ROSTERED"] });
  const p = ps.find((x) => x.teamId !== team.teamId);
  assert.ok(p, "need a player not already on the target team");

  let insideRan = false;
  await assert.rejects(
    db.transaction(async (tx) => {
      await signFreeAgent(p.playerSeasonId, {
        teamId: team.teamId,
        salary: 5,
        contractLength: 1,
        loyalty: 7,
        contractOffer: { Team: team.name, Cash: "5" },
        seasonId: sid,
        exec: tx,
      });

      const row = await tx
        .select({
          teamId: schema.playerSeasons.teamId,
          status: schema.playerSeasons.teamStatus,
          signed: schema.playerSeasons.signed,
        })
        .from(schema.playerSeasons)
        .where(eq(schema.playerSeasons.id, p.playerSeasonId));
      assert.strictEqual(String(row[0].teamId), String(team.teamId), "moved to team");
      assert.strictEqual(row[0].status, "ROSTERED", "status ROSTERED");
      assert.strictEqual(row[0].signed, true, "signed flag set");

      const cashRow = await tx
        .select({ cash: schema.teamSeasons.cash })
        .from(schema.teamSeasons)
        .where(
          and(
            eq(schema.teamSeasons.seasonId, sid),
            eq(schema.teamSeasons.teamId, team.teamId)
          )
        );
      assert.strictEqual(Number(cashRow[0].cash), cashBefore - 5, "cash debited by 5");

      insideRan = true;
      throw new Error("ROLLBACK_SENTINEL");
    }),
    /ROLLBACK_SENTINEL/
  );
  assert.ok(insideRan, "transaction body executed");

  // confirm prod unchanged
  const teamAfter = (await getValidTeams()).find((t) => t.teamId === team.teamId);
  assert.strictEqual(teamAfter.cash, cashBefore, "team cash rolled back");
});

test("createRookie creates player + ROOKIE season + attributes (rolled back)", async () => {
  if (!hasDb) return;
  const { db, schema } = getDb();
  const name = "Zztest Rookie Qwerty";
  const blob = [
    { module: "PLAYER", tab: "VITALS", data: { POSITION: "0", HEIGHT_CM: "190" } },
    { module: "PLAYER", tab: "ATTRIBUTES", data: { "3PT_SHOT": "150", SPEED: "180" } },
    { module: "PLAYER", tab: "BADGES", data: { CLAMPS: "2" } },
    { module: "PLAYER", tab: "HOTZONE", data: { LEFT_3: "1" } },
    { module: "PLAYER", tab: "TENDENCIES", data: { SHOT_TENDENCY: "50" } },
  ];
  const staged = { Name: name, Values: JSON.stringify(blob) };

  let insideRan = false;
  await assert.rejects(
    db.transaction(async (tx) => {
      const r = await createRookie(staged, { exec: tx });
      assert.strictEqual(r.skipped, false, "should create a new rookie");

      const ps = await tx
        .select({ status: schema.playerSeasons.teamStatus, age: schema.playerSeasons.age, tendencies: schema.playerSeasons.tendencies })
        .from(schema.playerSeasons)
        .where(eq(schema.playerSeasons.id, r.playerSeasonId));
      assert.strictEqual(ps[0].status, "ROOKIE", "season is ROOKIE");
      assert.strictEqual(Number(ps[0].age), 0, "age 0");
      assert.strictEqual(Number(ps[0].tendencies.SHOT_TENDENCY), 50, "tendencies set");

      const attrs = await tx
        .select({ code: schema.playerAttributes.attrCode, value: schema.playerAttributes.value })
        .from(schema.playerAttributes)
        .where(eq(schema.playerAttributes.playerSeasonId, r.playerSeasonId));
      assert.ok(attrs.length >= 2, "attributes written");

      insideRan = true;
      throw new Error("ROLLBACK_SENTINEL");
    }),
    /ROLLBACK_SENTINEL/
  );
  assert.ok(insideRan, "transaction body executed");

  // confirm no leftover player identity in prod
  const after = await db
    .select({ id: schema.players.id })
    .from(schema.players)
    .where(sql`lower(${schema.players.fullName}) = lower(${name})`);
  assert.strictEqual(after.length, 0, "rookie identity rolled back");
});

test("saveTrikov writes trikov_value + trikov_detail (rolled back)", async () => {
  if (!hasDb) return;
  const { db, schema } = getDb();
  const p = (await loadPlayersWithData({ teamStatuses: ["ROSTERED"] }))[0];

  let insideRan = false;
  await assert.rejects(
    db.transaction(async (tx) => {
      await saveTrikov(p.playerSeasonId, { value: 42.5, detail: { model1: 10, neighbors: "X, Y" } }, { exec: tx });
      const row = await tx
        .select({ v: schema.playerSeasons.trikovValue, d: schema.playerSeasons.trikovDetail })
        .from(schema.playerSeasons)
        .where(eq(schema.playerSeasons.id, p.playerSeasonId));
      assert.strictEqual(Number(row[0].v), 42.5, "trikov_value set");
      assert.strictEqual(row[0].d.neighbors, "X, Y", "trikov_detail set");
      insideRan = true;
      throw new Error("ROLLBACK_SENTINEL");
    }),
    /ROLLBACK_SENTINEL/
  );
  assert.ok(insideRan, "transaction body executed");
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
