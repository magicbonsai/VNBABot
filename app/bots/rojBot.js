const { postRojTweet, postSmithyTweet } = require("../helpers/tweetHelper");
const { sheetIds } = require("../helpers/sheetHelper");
const { rojEvents, dLeagueEvents } = require("./consts");
const _ = require("lodash");
require("dotenv").config();

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
const rwc = require("random-weighted-choice");
const faker = require("faker");
faker.setLocale("en");


function runRoj(team, setTweet) {
  const validTeams = (process.env.VALID_TEAMS || []).split(",");
  const teamToUse = team ? team : _.sample(validTeams);
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();

    const sheets = doc.sheetsById;
    const news = sheets[sheetIds.news];
    const players = sheets[sheetIds.players];
    const retiredPlayers = sheets[sheetIds.retiredPlayers];

    const rojUpdates = sheets[sheetIds.updates];
    const trainingRegime = sheets[sheetIds.trainingRegime];

    // Using environmentVariables to set valid teams for tweets (maybe this should be sheets) (AZ)

    const getVNBANewsWeights = news.getRows().then(rows => {
      return rows.map(row => {
        return {
          id: row.event,
          weight: parseFloat(row.prob)
        };
      });
    });

    const getFANewsWeights = news.getRows().then(rows => {
      return rows
        .filter(row => {
          return row.isBoost;
        })
        .map(row => {
          return {
            id: row.event,
            weight: parseFloat(row.prob)
          };
        });
    });

    players.getRows().then(playerRows => {
      const teamPlayers = playerRows.filter(
        player => player.Team === teamToUse
      );
      const faPlayers = playerRows.filter(player => player.Team === "FA");
      const weights = [
        {
          id: "team",
          weight: teamPlayers.length
        },
        {
          id: "fa",
          weight: 13 - teamPlayers.length
        }
      ];
      const { playersToUse, getNewsWeights } =
        rwc(weights) === "team"
          ? {
              playersToUse: teamPlayers.filter(player => !player["D League"]),
              getNewsWeights: getVNBANewsWeights
            }
          : {
              playersToUse: faPlayers,
              getNewsWeights: getFANewsWeights
            };

      getNewsWeights.then(newsWeights => {
        retiredPlayers.getRows().then(retiredRows => {
          const chosenPlayer = _.sample(playersToUse);
          const chosenPlayerTwo = _.sample(playersToUse);
          const chosenRetiree = _.sample(retiredRows);
          const result = setTweet || rwc(newsWeights);
          const status = newsRoulette(
            result,
            chosenPlayer,
            chosenPlayerTwo,
            chosenRetiree,
            rojUpdates,
            trainingRegime
          );
          status.then(toPost => {
            if (process.env.ENVIRONMENT === "PRODUCTION") {
              postRojTweet(toPost);
            }
            console.log(toPost);
          });
        })
      });
    });
  })();
}

const runReport = () => {
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();

    const sheets = doc.sheetsById;
    const assets = sheets[sheetIds.teamAssets];
    const events = sheets[sheetIds.news];
    const players = sheets[sheetIds.players];
    const retiredPlayerSheet = sheets[sheetIds.retiredPlayers];


    const rojUpdates = sheets[sheetIds.updates]; 

    const playerRows = await players.getRows();
    const validTeams = await assets.getsRows().then(rows => {
      return rows.filter(row => !row.Frozen).map(
        row => {
          return row.Team
        }
      )
    });
    const retiredPlayerRows = await retiredPlayerSheet.getRows();
    const weights = await events.getRows().then(rows => {
      return rows.map(row => {
        return {
          id: row.event,
          weight: parseFloat(row.prob)
        };
      });
    });
    //for all valid teams run a set of events

    const event = rwc(dLeagueWeights);
    
    const chosenPlayer = _.sample(playersToUse);
    const retiree = _.sample(retiredPlayerRows);

    const status = dLeagueRoulette(event, chosenPlayer, retiree, rojUpdates);
    status.then(toPost => {
      if (process.env.ENVIRONMENT === "PRODUCTION") {
        postRojTweet(toPost);
      }
      console.log(toPost);
    });

  })();
}; 


const runDLeague = () => {
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();

    const sheets = doc.sheetsById;
    const dLeagueEvents = sheets[sheetIds.dLeague];
    const players = sheets[sheetIds.players];
    const retiredPlayerSheet = sheets[sheetIds.retiredPlayers];


    const rojUpdates = sheets[sheetIds.updates]; 

    const playerRows = await players.getRows();
    const retiredPlayerRows = await retiredPlayerSheet.getRows();
    const dLeagueWeights = await dLeagueEvents.getRows().then(rows => {
      return rows.map(row => {
        return {
          id: row.event,
          weight: parseFloat(row.prob)
        };
      });
    });

    const event = rwc(dLeagueWeights);
    
    const playersToUse = playerRows.filter(player => !!player["D League"]);
    const chosenPlayer = _.sample(playersToUse);
    const retiree = _.sample(retiredPlayerRows);

    const status = dLeagueRoulette(event, chosenPlayer, retiree, rojUpdates);
    status.then(toPost => {
      if (process.env.ENVIRONMENT === "PRODUCTION") {
        postRojTweet(toPost);
      }
      console.log(toPost);
    });

  })();
};

async function dLeagueRoulette(event, player, retiree, rojUpdatesSheet) {
  const { fn } = dLeagueEvents[event];
  const date = new Date().toLocaleString().split(",")[0];
  const quote = fn({player, retiree});
  if (process.env.ENVIRONMENT !== "DEVELOPMENT") {
    await rojUpdatesSheet.addRow({
      Date: date,
      Player: player.Name,
      "Current Team": `=VLOOKUP("${player.Name}", 'Player List'!$A$1:$P, 6, FALSE)`,
      Team: player.Team,
      Event: event,
      Tweet: quote
    });
  }
  return quote;
};

async function newsRoulette(event, player, playerTwo, retiree, rojUpdatesSheet) {
  let quote = "no news today";
  const { valid, fn } = rojEvents[event];
  const date = new Date().toLocaleString().split(",")[0];
  quote = fn(player, playerTwo, retiree);
    if (process.env.ENVIRONMENT !== "DEVELOPMENT" && !!valid) {
      await rojUpdatesSheet.addRow({
        Date: date,
        Player: player.Name,
        "Current Team": `=VLOOKUP("${player.Name}", 'Player List'!$A$1:$P, 6, FALSE)`,
        Team: player.Team,
        Event: event,
        Tweet: quote
      });
    }
  return quote;
};

const chooseOne = choices => {
  return choices[Math.floor(Math.random() * choices.length)];
};

module.exports = { runRoj, runDLeague };
