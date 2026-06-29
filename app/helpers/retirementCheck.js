const rwc = require("random-weighted-choice");
const { CHANNEL_IDS } = require("../../consts");
const {
  getDb,
  getCurrentSeasonId,
  getSeasonFlag,
  setSeasonFlag,
  getPlayerSeasons,
  retirePlayers,
  parseBool,
} = require("./dbHelper");

// Per-season lock: set once retirement has been processed so a second
// `$retirement` that season can't re-roll and retire MORE players. To re-run a
// season on purpose, clear/false this flag in season_flags.
const RETIREMENT_FLAG = "retirementProcessed";

const weightsSix = [
  {
    id: "yes",
    weight: 0.5,
  },
  {
    id: "no",
    weight: 0.5,
  },
];

// Candidates are every non-retired player older than 5 in the current season,
// each rolled 50/50 to retire. The rolled set is BOTH announced and persisted
// (team_status -> 'RETIRED') in one run, then the season is locked. (The original
// read Team Assets "valid teams" and the Raw Game Stats header but never used
// either — dropped as dead code.)
const retirementCalculator = (discordClient, { exec, seasonId: seasonIdArg } = {}) => {
  return (async function main() {
    const announce = (m) =>
      discordClient.channels.cache.get(CHANNEL_IDS.announcements).send(m);

    const seasonId = seasonIdArg || (await getCurrentSeasonId());

    // Safeguard / idempotency: only process retirement once per season.
    const alreadyProcessed = parseBool(
      await getSeasonFlag(RETIREMENT_FLAG, { seasonId, exec })
    );
    if (alreadyProcessed) {
      const msg =
        "Retirement has already been processed for this season — no players were retired.";
      console.log(msg);
      announce(msg);
      return { alreadyProcessed: true, retired: [], retiredIds: [] };
    }

    const roster = await getPlayerSeasons({ seasonId });
    const playersToCheck = roster.filter(
      (p) => p.teamStatus !== "RETIRED" && p.age != null && p.age > 5
    );
    const retiredPlayers = playersToCheck.filter(() => rwc(weightsSix) === "yes");
    const retirementMessage = `These players will be retiring before the start of the next VNBA season: ${retiredPlayers
      .map((p) => p.fullName)
      .join(", ")}.  We hope the best of these players in their retirements.`;
    console.log("retirementMessage", retirementMessage);

    // Persist the rolled set + lock the season in ONE transaction (so a failure
    // can't leave players retired without the lock, or vice versa). Even when
    // nobody rolls "yes" we still set the flag — the season has been processed.
    const run = async (tx) => {
      await retirePlayers(
        retiredPlayers.map((p) => p.playerSeasonId),
        { exec: tx }
      );
      await setSeasonFlag(RETIREMENT_FLAG, true, { seasonId, exec: tx });
    };
    if (exec) {
      await run(exec); // caller owns the transaction (tests roll back)
    } else {
      const { db } = getDb();
      await db.transaction(run);
    }

    // Announce only after the write committed, so we never report a retirement
    // that didn't persist.
    announce(retirementMessage);
    return {
      alreadyProcessed: false,
      retired: retiredPlayers.map((p) => p.fullName),
      retiredIds: retiredPlayers.map((p) => p.playerSeasonId),
    };
  })();
};

module.exports = retirementCalculator;
