/**
 * Integration test for the ported retirementCheck (reads the current-season
 * roster from the DB and announces retirees to Discord). Stubs the Discord
 * client and asserts a message is produced. No-ops without DATABASE_URL.
 */
const test = require("node:test");
const assert = require("node:assert");

// Require at top so @youmkim/vnba-db's dotenv.config() loads the bot's .env first.
const retirementCheck = require("../retirementCheck");
const { getDb } = require("../dbHelper");
const hasDb = !!process.env.DATABASE_URL;

test("announces retirees built from the current-season roster", async () => {
  if (!hasDb) return; // no DB configured — nothing to assert
  let sent = null;
  let channelId = null;
  const stubClient = {
    channels: {
      cache: {
        get(id) {
          channelId = id;
          return { send: (msg) => { sent = msg; } };
        },
      },
    },
  };

  await retirementCheck(stubClient);

  assert.ok(typeof sent === "string", "should send a message");
  assert.match(sent, /retiring before the start of the next VNBA season/);
  assert.ok(channelId, "should target a channel");
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
