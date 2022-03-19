const { postRojTweet, postSmithyTweet } = require("../helpers/tweetHelper");
const { sheetIds , colIdx} = require("../helpers/sheetHelper");
const { CHANNEL_IDS } = require("../../consts");
const { rojEvents, tabMap } = require("./consts");
const _ = require("lodash");
require("dotenv").config();

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
const rwc = require("random-weighted-choice");
const faker = require("faker");
faker.setLocale("en");

const updateJSON = (tabKey, data, updateKey = {}) => {
  const { key, value } = updateKey;
  const { multiplier = 1, upperBound } = tabMap[tabKey] || {};
  const valuesFromJSON = JSON.parse(data);
  const selectedTab = valuesFromJSON.find(page => page.tab === tabKey);
  const selectedIndex = valuesFromJSON.findIndex(page => page.tab === tabKey);
  let newData = selectedTab.data;
  const newKeyValue = parseInt(selectedTab.data[key]) + value * multiplier;
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

// create a JSON description object that shows what got updated on a player recently.
// Right now all it does it show the weight of the value in question, in the future
// I should probably augment it to show new and old values.

const createChangeListJSON = (type, updateKey, existingJSON = "{}") => {
  const valueAsJSON = !!existingJSON
    ? JSON.parse(existingJSON)
    : JSON.parse("{}");
  const updateObject = {
    STATS: {
      [type]: [updateKey]
    }
  };
  const mergedObject = _.mergeWith(
    valueAsJSON,
    updateObject,
    (objValue, srcValue) => {
      if (_.isArray(objValue)) {
        return objValue.concat(srcValue);
      }
    }
  );
  return JSON.stringify(mergedObject);
};

//API format: (playerRow, sheets, type, updateKey)
// sheets provided must be the most up to date local

async function updatePlayerObject(playerRow, doc, type, updateKey) {
  const { Name: playerName } = playerRow;
  await doc.loadInfo();
  const sheets = doc.sheetsById;
  const requestQueue = sheets[sheetIds.requestQueue];
  const players = sheets[sheetIds.players];
  const playerRows = await players.getRows();
  const requestQueueRows = await requestQueue.getRows();
  // updating the player list
  // Find the most update to date info on the player
  let playerRowToUpdate = playerRows.find(row => row.Name === playerName);
  const { Team, Data: oldData } = playerRowToUpdate || {};
  const newJSON = updateJSON(type, oldData, updateKey);
  playerRowToUpdate["Data"] = newJSON;
  await playerRowToUpdate.save();

  //updating the request queue
  const requestRowToUpdate = requestQueueRows.find(
    row => row.Player === playerName && !row["Done?"]
  );
  if (requestRowToUpdate) {
    const { Description: existingJSON } = requestRowToUpdate;
    const changeListJSON = createChangeListJSON(type, updateKey, existingJSON);
    // There is an existing row so update the data that already exists
    requestRowToUpdate["Date"] = new Date().toLocaleString().split(",")[0];
    requestRowToUpdate["Data"] = newJSON;
    requestRowToUpdate["Team"] = `=VLOOKUP("${playerName}", 'Player List'!$A$1:$R, 7, FALSE)`;
    requestRowToUpdate["Description"] = changeListJSON;
    await requestRowToUpdate.save();
  } else {
    // push up a new Row
    const newRow = {
      Date: new Date().toLocaleString().split(",")[0],
      Player: playerName,
      Team: `=VLOOKUP("${playerName}", 'Player List'!$A$1:$R, 7, FALSE)`,
      Description: createChangeListJSON(type, updateKey),
      Data: newJSON,
      "Done?": undefined
    };
    await requestQueue.addRow(newRow);
  }
  return;
}

async function updateAssets(playerRow, doc, type, updateKey) {
  const { Team } = playerRow;
  const { key, value } = updateKey;
  await doc.loadInfo();
  const sheets = doc.sheetsById;
  const teamAssetsSheet = sheets[sheetIds.teamAssets];
  const teamAssetsRows = await teamAssetsSheet.getRows();

  //sheets header takes up one row so we increment index by one
  const rowIdxToUpdate = teamAssetsRows.findIndex(row => row.Team == Team) + 1;
  const colIdxToUpdate = colIdx[type][key];

  await teamAssetsSheet.loadCells();
  const cellToUpdate = teamAssetsSheet.getCell(rowIdxToUpdate, colIdxToUpdate);
  const oldValue = parseInt(cellToUpdate.value);
  const newValue = oldValue + value;

  cellToUpdate.value = newValue;
  console.log(key, Team, oldValue, newValue);
  await teamAssetsSheet.saveUpdatedCells(); 
  return;
}

// Add a task for streamers to do on players or other things that can't be done easily through the player JSON

async function addManualTask(playerRow, doc, type, updateKey) {
  const { Name, Team } = playerRow;
  const { key, value: { infoString } = {} } = updateKey;
  await doc.loadInfo();
  const sheets = doc.sheetsById;
  const rojUpdatesSheet = sheets[sheetIds.updates];

  await rojUpdatesSheet.addRow({
    Date: new Date().toLocaleString().split(",")[0],
    Player: Name,
    "Current Team": `=VLOOKUP("${Name}", 'Player List'!$A$1:$P, 7, FALSE)`,
    Team: Team,
    Event: key,
    Tweet: infoString
  });
}

//API format for all updateFunctions: (playerRow, doc, type, updateKey)

const updateFunctionMap = {
  MANUAL: addManualTask,
  ATTRIBUTES: updatePlayerObject,
  HOTZONE: updatePlayerObject,
  BADGES: updatePlayerObject,
  ASSETS: updateAssets
};

async function runEvent(playerRowsToUse, weights, doc) {
  const eventId = rwc(weights);
  const { fn, selectionFn = _.sample } = rojEvents[eventId] || {};
  const playerRowToUse = selectionFn(playerRowsToUse);
  const { type, updateKey, messageString } = fn(playerRowToUse);
  console.log("result", type, updateKey, playerRowToUse.Name);
  const updateFunction = updateFunctionMap[type];
  await updateFunction(playerRowToUse, doc, type, updateKey);
  return {
    team: playerRowToUse.Team,
    name: playerRowToUse.Name,
    messageString
  };
}

const toWeights = (weights, faWeights) => team => {
  switch (team) {
    case "FA":
      return faWeights;
    default:
      return weights;
  }
};

const runReportWith =
  discordClient =>
  (numberOfEvents = 3, forceTeam) => {
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
      const archive = sheets[sheetIds.reportArchive];

      const playerRows = await players.getRows();
      const validTeams = await assets.getRows().then(rows => {
        return rows
          .filter(row => row.Frozen === "FALSE")
          .map(row => {
            return row.Team;
          });
      });
      const weights = await events.getRows().then(rows => {
        return rows.map(row => {
          return {
            id: row.event,
            weight: parseFloat(row.prob)
          };
        });
      });

      const faWeights = await events.getRows().then(rows => {
        return rows
          .filter(row => row.isBoost)
          .map(row => {
            return {
              id: row.event,
              weight: parseFloat(row.prob)
            };
          });
      });

      const weightsByTeam = toWeights(weights, faWeights);

      //for all valid teams run a set of events

      // allUpdates = {
      //   team_name: [array of messages]
      //   ...etc
      // }
      const shuffledTeams = _.shuffle(validTeams);
      const allTeams = [...shuffledTeams, "FA"];

      const allUpdates = await allTeams.reduce(
        async (memo, currentValue) => {
          const acc = await memo;
          // we need to refresh the local copy of the doc after every iteration of the loop.
          const playerRowsToUse = playerRows.filter(
            player => player.Team === currentValue
          );
          console.log('Team', currentValue);
          let arrayOfResults = [];
          for (i = 0; i < numberOfEvents; i++) {
            const {
              messageString
              // pass the doc all the way up to the updateFunction
            } = await runEvent(
              playerRowsToUse,
              weightsByTeam(currentValue),
              doc
            );
            // the updateFunction will use the relevant function
            // and also update the relevant sheets (hopefully)
            arrayOfResults = [...arrayOfResults, `${messageString}\n`];
          }
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

      console.log("allUpdates", allUpdates);

      const fullDiscordMessageMap = [
        `Here is the Twice-Weekly report for ${new Date().toLocaleString().split(",")[0]}:\n\n`,
        ...allUpdates
        .map(value => {
          const { team, messages } = value;
          const allMessages = messages.join('');
          return `\nReport for the **${team}**:\n${allMessages}\n\n`;
        })
      ]

      const payload = allUpdates
        .map(value => {
          const { team, messages } = value;
          const allMessages = messages.join("");
          return `\nReport for the **${team}**:\n${allMessages}\n`;
        })
        .join("");

      const fullPayload = `Here is the Twice-Weekly report for ${
        new Date().toLocaleString().split(",")[0]
      }:\n\n`.concat(payload);

      fullDiscordMessageMap.forEach(message => discordClient.channels.get(CHANNEL_IDS.updates).send(message));

      await archive.addRow({
        Date: new Date().toLocaleString().split(",")[0],
        Content: fullPayload
      });
    })();
  };

module.exports = { runReportWith, createChangeListJSON };
