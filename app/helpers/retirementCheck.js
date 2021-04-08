const _ = require("lodash");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const rwc = require('random-weighted-choice');
const { sheetIds } = require("./sheetHelper");
const { postRojTweet } = require("./tweetHelper")

const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEETS_KEY
);

const weightsFive = [
    {
        id: "yes",
        weight: 0.2
    },
    {
        id: "no",
        weight: 0.8,
    }
];

const weightsSix = [
    {
        id: "yes",
        weight: 0.5
    },
    {
        id: "no",
        weight: 0.5,
    }
];

const weightsSeven = [
    {
        id: "yes",
        weight: 0.8
    },
    {
        id: "no",
        weight: 0.2,
    }
];


function retirementCalculator() {
    (async function main() {
      await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      });
      await doc.loadInfo();
      const validTeams = [...(process.env.VALID_TEAMS || []).split(','), 'FA'];
      const sheets = doc.sheetsById;
      const rawStats = sheets[sheetIds.rawStats];
      const players = sheets[sheetIds.players];
      await rawStats.loadHeaderRow();
  
      players.getRows().then(playerRows => {
        const playersToCheck = playerRows.filter(player => {
          const { Age, Team } = player;
          return parseInt(Age) > 4 && validTeams.includes(Team);
        });
        const retiredPlayers = playersToCheck.filter(({ Age }) => {
            switch(parseInt(Age)) {
                case 5:
                    return rwc(weightsFive) === "yes"
                case 6:
                    return rwc(weightsSix) === "yes"
                case 7:
                default:
                    return rwc(weightsSeven) == "yes"
            }
        });
        const retirementTweet = `These players will be retiring before the start of the next VNBA season: ${retiredPlayers.map(({ Name }) => Name).join(', ')}.  We hope the best of these players in their retirements.`
        if(process.env.ENVIRONMENT === "PRODUCTION") {
            postRojTweet(retirementTweet)
        }
        console.log(retirementTweet);
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
  }

module.exports = retirementCalculator;
