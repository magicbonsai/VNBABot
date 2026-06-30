/**
 * Unit tests for rojBot's pure value-computation (updateJSON) — the clamp/
 * multiplier logic at the heart of every player mutation. No DB needed.
 */
const test = require("node:test");
const assert = require("node:assert");
const { updateJSON } = require("../rojBot");
const { getDb } = require("../../helpers/dbHelper");

const blob = (attrs, tab = "ATTRIBUTES") =>
  JSON.stringify([
    { module: "PLAYER", tab: "VITALS", data: { HEIGHT_CM: 200 } },
    { module: "PLAYER", tab, data: attrs },
  ]);

const attrData = (json) =>
  JSON.parse(json).find((t) => t.tab === "ATTRIBUTES").data;

test("applies the *3 ATTRIBUTES multiplier and clamps to 222", () => {
  // 220 + 5*3 = 235 -> clamped to 222
  const out = updateJSON("ATTRIBUTES", blob({ "3PT_SHOT": 220 }), { key: "3PT_SHOT", value: 5 });
  assert.strictEqual(attrData(out)["3PT_SHOT"], "222");
});

test("clamps at the 0 lower bound on a negative (decline) delta", () => {
  // 2 + (-5)*3 = -13 -> clamped to 0
  const out = updateJSON("ATTRIBUTES", blob({ SPEED: 2 }), { key: "SPEED", value: -5 });
  assert.strictEqual(attrData(out)["SPEED"], "0");
});

test('treats a "NaN" value as 0 before applying the delta', () => {
  // 0 + 10*3 = 30
  const out = updateJSON("ATTRIBUTES", blob({ SPEED: "NaN" }), { key: "SPEED", value: 10 });
  assert.strictEqual(attrData(out)["SPEED"], "30");
});

test("BADGES use a *1 multiplier and clamp to 5", () => {
  const out = updateJSON("BADGES", blob({ CLAMPS: 5 }, "BADGES"), { key: "CLAMPS", value: 3 });
  assert.strictEqual(JSON.parse(out).find((t) => t.tab === "BADGES").data["CLAMPS"], "5");
});

test("returns data unchanged when updateKey is empty", () => {
  const b = blob({ SPEED: 100 });
  assert.strictEqual(updateJSON("ATTRIBUTES", b, {}), b);
});

// dbHelper (required transitively) opens a pg Pool at import; close it so the
// runner can exit.
test.after(async () => {
  try {
    const { db } = getDb();
    const pool = db.$client || (db.session && db.session.client);
    if (pool && pool.end) await pool.end();
  } catch (_) {
    /* best effort */
  }
});
