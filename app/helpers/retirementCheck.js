const _ = require("lodash");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const rwc = require('random-weighted-choice');
const { sheetIds } = require("./sheetHelper");

const doc = new GoogleSpreadsheet(
  "1INS-TKERe24QAyJCkhkhWBQK4eAWF8RVffhN1BZNRtA"
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
      const sheets = doc.sheetsById;
      const rawStats = sheets[sheetIds.rawStats];
      const players = sheets[sheetIds.players];
      await rawStats.loadHeaderRow();
  
      players.getRows().then(playerRows => {
        const playersToCheck = playerRows.filter(({ Age }) => {
          return Age !== 'RETIRED' && parseInt(Age) > 4;
        });
        console.log('playersToCheck', playersToCheck);
      });
    })();
  }

module.exports = retirementCalculator;
