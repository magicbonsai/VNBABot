const _ = require("lodash");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const rwc = require("random-weighted-choice");
const { sheetIds } = require("./sheetHelper");
const { CHANNEL_IDS } = require("../../consts");

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

const retirementCalculator = discordClient => {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();

    const sheets = doc.sheetsById;
    const teamAssetsSheet = sheets[sheetIds.teamAssets];
    const rawStats = sheets[sheetIds.rawStats];
    const players = sheets[sheetIds.players];
    const validTeams = await teamAssetsSheet.getRows().then(rows => {
      return rows
        .filter(row => row.Frozen === "FALSE" && row.Real === "TRUE")
        .map(row => {
          return row.Team;
        });
    });
    await rawStats.loadHeaderRow();

    players.getRows().then(playerRows => {
      const playersToCheck = playerRows.filter(player => {
        const { Age, Team } = player;
        return parseInt(Age) > 5;
      });
      const retiredPlayers = playersToCheck.filter(() => {
        return rwc(weightsSix) === "yes";
      });
      const retirementMessage = `These players will be retiring before the start of the next VNBA season: ${retiredPlayers
        .map(({ Name }) => Name)
        .join(", ")}.  We hope the best of these players in their retirements.`;
      console.log("retirementMessage", retirementMessage);
      discordClient.channels.cache
        .get(CHANNEL_IDS.announcements)
        .send(retirementMessage);
      // WIP get row updating to work
      // const rowsToUpdate = retiredPlayers.forEach(row => {
      //   row.Team = "RETIRED"
      // });
      // console.log('test', rowsToUpdate);
      // (async () => {
      //   if (process.env.environment === "PRODUCTION") {
      //     await rowsToUpdate.forEach(row => row.save());
      //   }
      // })();
    });
  })();
};

module.exports = retirementCalculator;
