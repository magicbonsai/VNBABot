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
  ATTRIBUTES: {
    multiplier: 3,
    upperBound: 222,
  },
  BADGES: {
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
  } = tabMap[tabKey] || {};
  const valuesFromJSON = JSON.parse(data);
  const selectedTab = valuesFromJSON.find(page => page.tab === tabKey);
  const selectedIndex = valuesFromJSON.findIndex(page => page.tab === tabKey);
  let newData = selectedTab.data;
  const newKeyValue = parseInt(selectedTab.data[key]) + (value * multiplier);
  const clampedNewValue = _.clamp(newKeyValue, 0, upperBound);
  newData[key] = `${clampedNewValue}`;

  return JSON.stringify([
    ...valuesFromJSON.slice(0, selectedIndex),
    {
      module: "PLAYER",
      tab: tabKey,
      data: newData
    },
    ...valuesFromJSON.slice(selectedIndex + 1)
  ]);
};


//API format: (playerRow, sheets, type, updateKey)
// sheets provided must be the most up to date local

const createChangeListJSON = (type, updateKey, existingJSON = '{}') => {
  const valueAsJSON = !!existingJSON ? JSON.parse(existingJSON) : JSON.parse('{}');
  const updateObject = {
    STATS: {
      [type]: [updateKey]
    }
  };
  const mergedObject = _.mergeWith(valueAsJSON, updateObject, (objValue, srcValue) => {
    if(_.isArray(objValue)) {
      return objValue.concat(srcValue);
    }
  });
  return JSON.stringify(mergedObject);
};

async function updatePlayerObject (playerRow, doc, type, updateKey) {
  const {
    Name: playerName,
  } = playerRow;
  await doc.loadInfo();
  const sheets = doc.sheetsById;
  const requestQueue = sheets[sheetIds.requestQueue];
  const players = sheets[sheetIds.players];
  const playerRows = await players.getRows();
  const requestQueueRows = await requestQueue.getRows();
  // updating the player list
  // Find the most update to date info on the player
  let playerRowToUpdate = playerRows.find(row => row.Name === playerName);
  const {
    Team,
    Data: oldData,
  } = playerRowToUpdate || {}
  const newJSON = updateJSON(type, oldData, updateKey);
  playerRowToUpdate["Data"] = newJSON;
  await playerRowToUpdate.save();

  //updating the request queue
  const requestRowToUpdate = requestQueueRows.find(row => 
    ((row.Player === playerName) && (!row["Done?"])));
  if(requestRowToUpdate) {
    const {
      Description: existingJSON
    } = requestRowToUpdate;
    const changeListJSON = createChangeListJSON(type, updateKey, existingJSON);
    // There is an existing row so update the data that already exists
    requestRowToUpdate["Date"] = new Date().toLocaleString().split(",")[0];
    requestRowToUpdate["Data"] = newJSON;
    requestRowToUpdate["Description"] = changeListJSON;
    await requestRowToUpdate.save();
  } else {
    // push up a new Row
    const newRow = {
      Date: new Date().toLocaleString().split(",")[0],
      Player: playerName,
      Team,
      Description: createChangeListJSON(type, updateKey),
      Data: newJSON,
      "Done?": undefined
    };
    await requestQueue.addRow(newRow);
  }
  return;
};


async function updateAssets (playerRow, doc, type, updateKey) {
  const {
    Team,
  } = playerRow;
  const {
    key,
    value 
  } = updateKey;
  await doc.loadInfo();
  const sheets = doc.sheetsById;
  const teamAssetsSheet = sheets[sheetIds.teamAssets];
  const teamAssetsRows = await teamAssetsSheet.getRows();

  let rowToUpdate = teamAssetsRows.find(row => row.Team === Team);
  const oldValue = parseInt(rowToUpdate[key]);
  const newValue = oldValue + value;

  rowToUpdate[key] = newValue; 
  console.log('cashRow', rowToUpdate.Team, oldValue, newValue )
  // await rowToUpdate.save();
  return;
};

async function addManualTask (playerRow, doc, type, updateKey) {
  const {
    Name,
    Team
  } = playerRow;
  const {
    key,
  } = updateKey;
  await doc.loadInfo();
  const sheets = doc.sheetsById;
  const rojUpdatesSheet = sheets[sheetIds.updates];

  await rojUpdatesSheet.addRow({
    Date: date,
    Player: Name,
    "Current Team": `=VLOOKUP("${player.Name}", 'Player List'!$A$1:$P, 6, FALSE)`,
    Team: Team,
    Event: key,
    Tweet: "Manually update this value"
  });
};

//API format for all updateFunctions: (playerRow, doc, type, updateKey)

const updateFunctionMap = {
  MANUAL: addManualTask,
  ATTRIBUTES: updatePlayerObject,
  HOTZONE: updatePlayerObject,
  BADGES: updatePlayerObject,
  ASSETS: updateAssets,
}


async function runEvent (playerRowsToUse, weights, doc) {
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
  console.log('result', type, updateKey);
  const updateFunction = updateFunctionMap[type];
  await updateFunction(playerRowToUse, doc, type, updateKey);
  return {
    team: playerRowToUse.Team,
    name: playerRowToUse.Name,
    messageString
  }
};

const runReportWith = (discordClient) => (forceTeam, numberOfEvents = 4) => {
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

    const playerRows = await players.getRows();
    const validTeams = await assets.getRows().then(rows => {
      return rows.filter(row => row.Frozen === 'FALSE').map(
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
    console.log('validTeams', validTeams)

    const shuffledTeams = _.shuffle(['Celtics']);

    const allUpdates = await shuffledTeams.reduce(
      async (memo, currentValue) => {
        const acc = await memo;
        // we need to refresh the local copy of the doc after every iteration of the loop.
        const playerRowsToUse = playerRows.filter(player => player.Team === currentValue );
        let arrayOfResults = []
        for (i = 0; i < numberOfEvents; i++) {
          const {
            messageString
            // pass the doc all the way up to the updateFunction
          }= await runEvent(playerRowsToUse, weights, doc);
          // the updateFunction will use the relevant function
          // and also update the relevant sheets (hopefully)
          arrayOfResults = [...arrayOfResults, `${messageString}\n`];
        };
        return [
          ...acc,
          {
            team: currentValue,
            messages: arrayOfResults
          }
        ];
      },
      []
    );


    console.log('allUpdates', allUpdates);

    const payload = allUpdates.map(value => {
      const {
        team,
        messages 
      } = value;
      const allMessages = messages.join();
      return `${allMessages}\n`;
    }).join();
    
    // discordClient.channels.get(CHANNEL_IDS.updates).send(payload);

  })();
}; 

// Deprecated functions

// function runRoj(team, setTweet) {
//   const validTeams = (process.env.VALID_TEAMS || []).split(",");
//   const teamToUse = team ? team : _.sample(validTeams);
//   (async function main() {
//     await doc.useServiceAccountAuth({
//       client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
//       private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
//     });
//     await doc.loadInfo();

//     const sheets = doc.sheetsById;
//     const news = sheets[sheetIds.news];
//     const players = sheets[sheetIds.players];
//     const retiredPlayers = sheets[sheetIds.retiredPlayers];

//     const rojUpdates = sheets[sheetIds.updates];
//     const trainingRegime = sheets[sheetIds.trainingRegime];

//     // Using environmentVariables to set valid teams for tweets (maybe this should be sheets) (AZ)

//     const getVNBANewsWeights = news.getRows().then(rows => {
//       return rows.map(row => {
//         return {
//           id: row.event,
//           weight: parseFloat(row.prob)
//         };
//       });
//     });

//     const getFANewsWeights = news.getRows().then(rows => {
//       return rows
//         .filter(row => {
//           return row.isBoost;
//         })
//         .map(row => {
//           return {
//             id: row.event,
//             weight: parseFloat(row.prob)
//           };
//         });
//     });

//     players.getRows().then(playerRows => {
//       const teamPlayers = playerRows.filter(
//         player => player.Team === teamToUse
//       );
//       const faPlayers = playerRows.filter(player => player.Team === "FA");
//       const weights = [
//         {
//           id: "team",
//           weight: teamPlayers.length
//         },
//         {
//           id: "fa",
//           weight: 13 - teamPlayers.length
//         }
//       ];
//       const { playersToUse, getNewsWeights } =
//         rwc(weights) === "team"
//           ? {
//               playersToUse: teamPlayers.filter(player => !player["D League"]),
//               getNewsWeights: getVNBANewsWeights
//             }
//           : {
//               playersToUse: faPlayers,
//               getNewsWeights: getFANewsWeights
//             };

//       getNewsWeights.then(newsWeights => {
//         retiredPlayers.getRows().then(retiredRows => {
//           const chosenPlayer = _.sample(playersToUse);
//           const chosenPlayerTwo = _.sample(playersToUse);
//           const chosenRetiree = _.sample(retiredRows);
//           const result = setTweet || rwc(newsWeights);
//           const status = newsRoulette(
//             result,
//             chosenPlayer,
//             chosenPlayerTwo,
//             chosenRetiree,
//             rojUpdates,
//             trainingRegime
//           );
//           status.then(toPost => {
//             if (process.env.ENVIRONMENT === "PRODUCTION") {
//               postRojTweet(toPost);
//             }
//             console.log(toPost);
//           });
//         })
//       });
//     });
//   })();
// }

// const runDLeague = () => {
//   (async function main() {
//     await doc.useServiceAccountAuth({
//       client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
//       private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
//     });
//     await doc.loadInfo();

//     const sheets = doc.sheetsById;
//     const dLeagueEvents = sheets[sheetIds.dLeague];
//     const players = sheets[sheetIds.players];
//     const retiredPlayerSheet = sheets[sheetIds.retiredPlayers];


//     const rojUpdates = sheets[sheetIds.updates]; 

//     const playerRows = await players.getRows();
//     const retiredPlayerRows = await retiredPlayerSheet.getRows();
//     const dLeagueWeights = await dLeagueEvents.getRows().then(rows => {
//       return rows.map(row => {
//         return {
//           id: row.event,
//           weight: parseFloat(row.prob)
//         };
//       });
//     });

//     const event = rwc(dLeagueWeights);
    
//     const playersToUse = playerRows.filter(player => !!player["D League"]);
//     const chosenPlayer = _.sample(playersToUse);
//     const retiree = _.sample(retiredPlayerRows);

//     const status = dLeagueRoulette(event, chosenPlayer, retiree, rojUpdates);
//     status.then(toPost => {
//       if (process.env.ENVIRONMENT === "PRODUCTION") {
//         postRojTweet(toPost);
//       }
//       console.log(toPost);
//     });

//   })();
// };

// async function dLeagueRoulette(event, player, retiree, rojUpdatesSheet) {
//   const { fn } = dLeagueEvents[event];
//   const date = new Date().toLocaleString().split(",")[0];
//   const quote = fn({player, retiree});
//   if (process.env.ENVIRONMENT !== "DEVELOPMENT") {
//     await rojUpdatesSheet.addRow({
//       Date: date,
//       Player: player.Name,
//       "Current Team": `=VLOOKUP("${player.Name}", 'Player List'!$A$1:$P, 6, FALSE)`,
//       Team: player.Team,
//       Event: event,
//       Tweet: quote
//     });
//   }
//   return quote;
// };

// async function newsRoulette(event, player, playerTwo, retiree, rojUpdatesSheet) {
//   let quote = "no news today";
//   const { valid, fn } = rojEvents[event];
//   const date = new Date().toLocaleString().split(",")[0];
//   quote = fn(player, playerTwo, retiree);
//     if (process.env.ENVIRONMENT !== "DEVELOPMENT" && !!valid) {
//       await rojUpdatesSheet.addRow({
//         Date: date,
//         Player: player.Name,
//         "Current Team": `=VLOOKUP("${player.Name}", 'Player List'!$A$1:$P, 6, FALSE)`,
//         Team: player.Team,
//         Event: event,
//         Tweet: quote
//       });
//     }
//   return quote;
// };

// const chooseOne = choices => {
//   return choices[Math.floor(Math.random() * choices.length)];
// };

module.exports = { runReportWith };
