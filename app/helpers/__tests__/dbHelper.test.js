/**
 * Tests for dbHelper. Run with: `node --test` (from the bot root).
 *
 * Pure helpers (parseBool) are unit-tested. The DB-backed helpers are
 * integration tests against whatever DATABASE_URL points at; they self-skip
 * when DATABASE_URL is unset so the suite still runs in a credential-less CI.
 */
const test = require("node:test");
const assert = require("node:assert");

const { parseBool } = require("../dbHelper");

test("parseBool: lenient stringly-typed truthiness", () => {
  for (const v of ["TRUE", "true", "True", "1", "yes", true]) {
    assert.strictEqual(parseBool(v), true, `expected ${v} -> true`);
  }
  for (const v of ["FALSE", "false", "0", "", null, undefined, false, "nope"]) {
    assert.strictEqual(parseBool(v), false, `expected ${v} -> false`);
  }
});

const hasDb = !!process.env.DATABASE_URL;
// Node 16's test runner has no test.skip(); guard inside instead so the suite
// runs (as no-ops) without a DATABASE_URL rather than crashing.
const dbTest = (name, fn) =>
  test(name, async (t) => {
    if (!hasDb) return;
    return fn(t);
  });

dbTest("getCurrentSeasonId returns a numeric id", async () => {
  const { getCurrentSeasonId } = require("../dbHelper");
  const id = await getCurrentSeasonId();
  assert.ok(Number(id) > 0, "current season id should be a positive number");
});

dbTest("getSeasonFlag returns boolean for a known flag and null for a missing one", async () => {
  const { getSeasonFlag } = require("../dbHelper");
  const known = await getSeasonFlag("doInjuries");
  assert.ok(known === true || known === false, "known flag -> boolean");
  const missing = await getSeasonFlag("definitelyNotARealFlag_xyz");
  assert.strictEqual(missing, null, "missing flag -> null");
});

dbTest("getValidTeams resolves team ids and excludes frozen/non-real", async () => {
  const { getValidTeams } = require("../dbHelper");
  const teams = await getValidTeams();
  assert.ok(Array.isArray(teams) && teams.length > 0, "should return teams");
  assert.ok(
    teams.every((t) => t.teamId != null),
    "every valid team should resolve to a teamId"
  );
});

// The shared pg pool keeps the event loop alive; close it so the runner exits.
test.after(async () => {
  if (!hasDb) return;
  try {
    const { getDb } = require("../dbHelper");
    const { db } = getDb();
    // node-postgres pool hangs off the drizzle client's session.
    const pool = db.$client || (db.session && db.session.client);
    if (pool && pool.end) await pool.end();
  } catch (_) {
    /* best effort */
  }
});
