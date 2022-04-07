const { sheetIds, colIdx } = require("./sheetHelper");
const { CHANNEL_IDS } = require("../../consts");
const { INJURIES } = require("./consts");
const rwc = require('random-weighted-choice');
const _ = require("lodash");
require("dotenv").config();

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
const { createChangeListJSON } = require('../bots/rojBot');

const generateFutureDate = (days) => {
  let d = new Date();
  d.setDate(d.getDate() + days);
  console.log('newDate', d, days, d.toLocaleString());
  return d.toLocaleString().split(",")[0];
};

// I hate this
const updateVitals = (data, id) => {
  const valuesFromJSON = JSON.parse(data);
  const selectedTab = valuesFromJSON.find(page => page.tab === "VITALS");
  const selectedIndex = valuesFromJSON.findIndex(page => page.tab === "VITALS");
  let newData = selectedTab.data;
  newData["INJURY1TYPE"] = id;

  return JSON.stringify([
    ...valuesFromJSON.slice(0, selectedIndex),
    {
      module: "PLAYER",
      tab: "VITALS",
      data: newData
    },
    ...valuesFromJSON.slice(selectedIndex + 1)
  ]);
};

const weights = [
  {
    id: 'y',
    weight: 0.1,
  },
  {
    id: 'n',
    weight: 0.9
  }
];

// use rowUpdates here

const generateInjuriesWith = discordClient => (forceInjury) => {
  console.log('injury report fired', forceInjury);
  (async () => {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const playerSheet = sheets[sheetIds.players];
    const requestQueueSheet = sheets[sheetIds.requestQueue];
    const teamAssetsSheet = sheets[sheetIds.teamAssets];
    const archive = sheets[sheetIds.reportArchive];
    if(rwc(weights) == 'n' && !forceInjury) {
      console.log('no injury today', weights);
      return;
    }
    console.log('injury today');
    const requestQueueRows = await requestQueueSheet.getRows();

    const validTeams = await teamAssetsSheet.getRows().then(rows => {
      return rows
        .filter(row => row.Frozen === "FALSE")
        .map(row => {
          return row.Team;
        });
    });
    const playerRowToUpdate = await playerSheet.getRows().then(rows => {
      return _.sample(rows.filter(row => !row.Status && validTeams.includes(row.Team)));
    });
    const injury = _.sample(INJURIES);
    console.log('this player got injured: ', playerRowToUpdate.Name, injury.Name, injury.id);
    const {
      id,
      Name: injuryName,
      DurationMin,
      DurationMax,
      AffectedLow,
      AffectedHigh,
      DNP,
    } = injury;

    const injuryDuration = _.random(DurationMin, DurationMax);
    const newInjuryDate = generateFutureDate(injuryDuration);

    const {
      Name: playerName,
      Data: oldData
    } = playerRowToUpdate || {};
    const newJSON = updateVitals(oldData, id);
    const statusObj = {
      Name: injuryName,
      Duration: newInjuryDate,
      AffectedLow,
      AffectedHigh,
      DNP,
    };
    // JSON.stringify
    playerRowToUpdate["Data"] = newJSON;
    playerRowToUpdate["Status"] = JSON.stringify(statusObj);
    await playerRowToUpdate.save();
    //updating the request queue
    const requestRowToUpdate = requestQueueRows.find(
      row => row.Player === playerName && !row["Done?"]
    );
    if (requestRowToUpdate) {
      const { Description: existingJSON } = requestRowToUpdate;
      const changeListJSON = createChangeListJSON("INJURY", {injuryName, id}, existingJSON);
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
        Description: createChangeListJSON("INJURY", {injuryName, id}),
        Data: newJSON,
        "Done?": undefined
      };
      await requestQueueSheet.addRow(newRow);
    } 

    const dnpMessage = `What's severely affected is his ${AffectedHigh}.  It is recommended to bench this player until they recover.`
    const message = `${playerName} has suffered an injury: ${injuryName} for ${injuryDuration} days.  He will recover on ${newInjuryDate}. 
      \n The injury minorly affects his ${AffectedLow}.  ${DNP ? dnpMessage : ''}`;
     

    discordClient.channels.get(CHANNEL_IDS.updates).send(message)

    await archive.addRow({
      Date: new Date().toLocaleString().split(",")[0],
      Content: message,
    });

    console.log('injury report finished');
  })();
}; 

// use Cell Updates to batch clear all injuries?

const removeInjuries = () => {
  console.log('remove injury fired');
  (async () => {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const playerSheet = sheets[sheetIds.players];
    const dateToCompare = new Date().toLocaleDateString().split(",")[0];
    const filteredRows = await playerSheet.getRows().then(rows => {
      return rows.filter(row => {
        const {
          Status 
        } = row;
        if (!Status) return;
        const {
          Duration,
        } = JSON.parse(Status);
        return Duration == dateToCompare;
      });
    });
    await filteredRows.reduce(
      async (memo, currentValue = {}) => {
        const acc = await memo;
        await doc.loadInfo();
        const sheets = doc.sheetsById;
        const playerSheet = sheets[sheetIds.players];
        const playerRows = await playerSheet.getRows();
        const requestQueue = sheets[sheetIds.requestQueue];
        const requestQueueRows = await requestQueue.getRows();
        const {
          Name: playerName
        } = currentValue;

        let playerRowToUpdate =  playerRows.find(row => row.Name === playerName);
        const {
          Data: oldData
        } = playerRowToUpdate;
        const newJSON = updateVitals(oldData, "0");

        playerRowToUpdate["Status"] = "";
        playerRowToUpdate["Data"] = newJSON;
        await playerRowToUpdate.save();

        // Update the request rows so the player is in the correct tab for Streamers

        const requestRowToUpdate = requestQueueRows.find(
          row => row.Player === playerName && !row["Done?"]
        );
        if (requestRowToUpdate) {
          const { Description: existingJSON } = requestRowToUpdate;
          const changeListJSON = createChangeListJSON("INJURY", 'Healthy', existingJSON);
          // There is an existing row so update the data that already exists
          requestRowToUpdate["Date"] = new Date().toLocaleString().split(",")[0];
          requestRowToUpdate["Team"] = `=VLOOKUP("${playerName}", 'Player List'!$A$1:$R, 7, FALSE)`;
          requestRowToUpdate["Description"] = changeListJSON;
          await requestRowToUpdate.save();
        } else {
          // push up a new Row
          const newRow = {
            Date: new Date().toLocaleString().split(",")[0],
            Player: playerName,
            Team: `=VLOOKUP("${playerName}", 'Player List'!$A$1:$R, 7, FALSE)`,
            Data: Data,
            Description: createChangeListJSON("INJURY", 'Healthy'),
            "Done?": undefined
          };
          await requestQueue.addRow(newRow);
        }

      },
      {}
    );
    console.log('remove injury finished');
  })();
};

module.exports = {generateInjuriesWith, removeInjuries}