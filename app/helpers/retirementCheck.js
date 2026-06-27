const rwc = require("random-weighted-choice");
const { CHANNEL_IDS } = require("../../consts");
const { getPlayerSeasons } = require("./dbHelper");

const weightsFive = [
  {
    id: "yes",
    weight: 0.2
  },
  {
    id: "no",
    weight: 0.8
  }
];

const weightsSix = [
  {
    id: "yes",
    weight: 0.5
  },
  {
    id: "no",
    weight: 0.5
  }
];

const weightsSeven = [
  {
    id: "yes",
    weight: 0.8
  },
  {
    id: "no",
    weight: 0.2
  }
];

// Candidates are every non-retired player older than 5 in the current season,
// each rolled 50/50 to retire. (The original read Team Assets "valid teams" and
// the Raw Game Stats header but never used either — dropped as dead code.)
const retirementCalculator = (discordClient) => {
  return (async function main() {
    const roster = await getPlayerSeasons();
    const playersToCheck = roster.filter(
      (p) => p.teamStatus !== "RETIRED" && p.age != null && p.age > 5
    );
    const retiredPlayers = playersToCheck.filter(() => rwc(weightsSix) === "yes");
    const retirementMessage = `These players will be retiring before the start of the next VNBA season: ${retiredPlayers
      .map((p) => p.fullName)
      .join(", ")}.  We hope the best of these players in their retirements.`;
    console.log("retirementMessage", retirementMessage);
    discordClient.channels.cache
      .get(CHANNEL_IDS.announcements)
      .send(retirementMessage);
    // WIP (intentionally disabled, as in the original): when enabled, mark each
    // retiree's current player_season as team_status = 'RETIRED'.
    // await db.update(playerSeasons).set({ teamStatus: "RETIRED" }) ... per retiree.
  })();
};

module.exports = retirementCalculator;
