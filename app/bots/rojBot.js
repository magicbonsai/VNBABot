const { postRojTweet, postSmithyTweet } = require("../helpers/tweetHelper");
const { sheetIds } = require("../helpers/sheetHelper");
const { CHANNEL_IDS } = require('../../consts');
const { rojEvents, dLeagueEvents } = require("./consts");
const _ = require("lodash");
require("dotenv").config();

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
const rwc = require("random-weighted-choice");
const faker = require("faker");
faker.setLocale("en");

// we need to add a multiplier to certain changes
// attributes are actually stored as a value from 25 - 222, where 
// 3 points = 1 attribute point in the game itself.

// upperBound will constrain changes to the maximum the key allows.

const tabMap = {
  ATTRIBUTE: {
    multiplier: 3,
    upperBound: 222,
  },
  BADGE: {
    multiplier: 1,
    upperBound: 4
  },
  HOTZONE: {
    multiplier: 1,
    upperBound: 2,
  }
};

const updateJSON = (tabKey, data, updateKey = {}) => {
  const {
    key,
    value
  } = updateKey;
  const {
    multiplier = 1,
    upperBound
  } = tabMap[tabKey];
  const valuesFromJSON = JSON.parse(data);
  const selectedTab = valuesFromJSON.find(page => page.tab === tabKey);
  const selectedIndex = valuesFromJSON.findIndex(page => page.Tab === tabKey);
  let newData = selectedTab.data;
  newData[key] = `${_.clamp(
    parseInt(newData[key]) + (value * multiplier),
    0,
    upperBound
  )}`;

  return JSON.stringify([
    ...valuesFromJSON.slice(0, selectedIndex),
    {
      module: "PLAYER",
      tab: tabKey,
      data: newData
    },
    ...valuesFromJSON.slice(selectedIndex +1)
  ]);
};

//API format: (playerRow, sheets, type, updateKey)

async function updatePlayerObject (playerRow, sheets, type, updateKey) {
  console.log('playerRow', playerRow);
  const {
    Data: oldData,
    Name: playerName,
    Team,
  } = playerRow;
  const newJSON = updateJSON(type, oldData, updateKey);
  const requestQueue = sheets[sheetIds.requestQueue];
  const players = sheets[sheetIds.players];
  const playerRows = await players.getRows();
  const requestQueueRows = await requestQueue.getRows();

  // updating the player list
  const playerRowToUpdate = playerRows.find(row => row.Name === playerName);
  playerRowToUpdate[Data] = newJSON;
  await playerRowToUpdate.save();

  //updating the request queue
  const requestRowToUpdate = requestQueueRows.find(row => 
    ((row.Player === playerName) && (!row["Done?"])));
  if(requestRowToUpdate) {
    // There is an existing row so update the data that already exists
    requestRowToUpdate["Date"] = new Date().toLocaleString().split(",")[0];
    requestRowToUpdate[Data] = newJSON;
    // requestRowToUpdate["Done?"] = undefined;
    await requestRowToUpdate.save();
  } else {
    // push up a new Row
    await requestQueue.addRow({
      Date: new Date().toLocaleString().split(",")[0],
      Player: playerName,
      Team,
      Description: "{}",
      Data: newJSON,
      "Done?": undefined
    })
  }
  
};


async function updateAssets (playerRow, sheets, type, updateKey) {
  const {
    Team,
  } = playerRow;
  const teamAssetsSheet = sheets[sheetIds.teamAssets];
};

const runEvent = (playerRowsToUse, weights) => {
  const eventId = rwc(weights);
  const {
    fn,
    selectionFn = _.sample,
  } = rojEvents[eventId] || {};
  const playerRowToUse = selectionFn(playerRowsToUse);
  const {
    type,
    updateKey,
    messageString
  } = fn(playerRowToUse);
  const updateFunction = updateFunctionMap[type];
  updateFunction(playerRowToUse, sheets, type, updateKey);
  return {
    team: playerRowToUse.Team,
    name: playerToUse.Name,
    messageString
  }
};

const runReportWith = (discordClient) => (forceTeam, numberOfEvents = 5) => {
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

    const rojUpdates = sheets[sheetIds.updates]; 
    const requestQueue = sheets[sheetIds.requestQueue];

    const playerRows = await players.getRows();
    const validTeams = await assets.getsRows().then(rows => {
      return rows.filter(row => !row.Frozen).map(
        row => {
          return row.Team
        }
      )
    });
    const weights = await events.getRows().then(rows => {
      return rows.map(row => {
        return {
          id: row.event,
          weight: parseFloat(row.prob)
        };
      });
    });

    //for all valid teams run a set of events

    // allUpdates = {
    //   team_name: [array of messages]
    //   ...etc
    // }

    const shuffledTeams = _.shuffle(validTeams);

    const allUpdates = validTeams.reduce(
      (acc, currentValue) => {
        const playerRowsToUse = playerRows.filter(player => player.Team === currentValue );
        let arrayOfResults = []
        for (i = 0; i < numberOfEvents; i++) {
          const {
            messageString
          } = runEvent(playerRowsToUse, weights);
          // the updateFunction will use the relevant function
          // and also update the relevant sheets (hopefully)
          arrayOfResults = [...arrayOfResults, `${messageString}\n`];
        };
        return [
          ...acc,
          {
            team: currentValue,
            messages:arrayOfResults
          }
        ];
      },
      []
    );
    
    const payload = allUpdates.map(value => {
      const {
        team,
        messages 
      } = value;
      const allMessages = messages.join();
      return `${allMessages}\n`;
    }).join();
    
    discordClient.channels.get(CHANNEL_IDS['updates']).send(payload);

  })();
}; 

//API format: (playerRow, sheets, type, updateKey)

const updateFunctionMap = {
  MANUAL: () => {},
  ATTRIBUTE: updatePlayerObject,
  HOTZONE: updatePlayerObject,
  BADGE: updatePlayerObject,
  ASSETS: () => {},
}


// Deprecated functions

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
