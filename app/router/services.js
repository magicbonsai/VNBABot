const { CHANNEL_IDS } = require('../../consts');
require("dotenv").config();
const { sheetIds, colIdx } = require("../helpers/sheetHelper");
const _ = require("lodash");

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
const { createChangeListJSON } = require('../bots/rojBot');
const { bulkUpdateJSON } = require('./utils');
//GET requests

//POST requests

// takes in a channel title + message content to post a message to a specific channel on the discord server.
// Must be curried w/ the discord client in question first.
// API:
// {
//   channelTitle: String,
//   value: String,
// }

const postToChannelWith = discordClient => (req, res) => {
  if(!req.body.channelTitle) {
    return res.status(400).send({
      success: 'false',
      message: 'channelTitle is required'
    });
  } else if(!req.body.value) {
    return res.status(400).send({
      success: 'false',
      message: 'value is required'
    });
  }
  discordClient.channels.get(CHANNEL_IDS[req.body.channelTitle]).send(req.body.value);
  return res.status(201).send({
    success: 'true',
    message: `Message posted successfully to ${req.body.channelTitle}`,
  })
}

// takes in a team name (no capitalization) and message content to post a messge to a discord user via the tagged role.
// Curry w/ the discord client.
// API:
// {
//   teamName: String,
//   value: String
// }
const postToTeamWith = discordClient => (req, res) => {
  if (!req.body.teamName) {
    return res.status(400).send({
      success: 'false',
      message: 'teamName is required'
    });
  } else if (!req.body.value) {
    return res.status(400).send({
      success: 'false',
      message: 'value is required'
    });
  }
  const { 
    body: {
      teamName,
      value
    } = {}
  } = req;
  // Apparently sending a message unprompted to all members with a certain role
  // may be a little against discord's api usage but for now this is good
  // without having to keep a list of discord user ids (AZ)
  const guild = discordClient.guilds.find(guild => guild.id == process.env.SERVER_ID);
  const role = guild.roles.find(role => role.name === teamName);
  if (!role) {
    return res.status(400).send({
      success: 'false',
      message: `${teamName} is not a valid team name.`
    });
  }
  const membersWithRole = guild.roles.get(role.id).members;
  membersWithRole.forEach(member => member.user.send(value));
  return res.status(201).send({
    success: 'true',
    message: `Message posted successfully to members with role: ${teamName}`,
  })
};

// Take in an array of objects, of which the object is such:
// 
// {
//   Name: string,
//   Attributes: array [ { key: string, value: num }, etc],
//   Badges: array [ { key: string, value: num }, etc],
//   Tendencies: array [ { key: string, value: num }, etc]
// }
//  value in each key should be the delta, not the complete updated value, i.e. 3PT_SHOT: 5, means increase 3pt by 5
//
// and updates each player
// API:
// {
//   value: [ objects ]
// }

const updatePlayers = (req, res) => {
  if (!req.body.value) {
    return res.status(400).send({
      success: 'false',
      message: 'value is required'
    });
  } 
  const { 
    body: {
      value: updateObjects,
    } = {}
  } = req;
  (async () => {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    await updateObjects.reduce(
      async (memo, currentValue) => {
        const acc = await memo;
        await doc.loadInfo();
        const sheets = doc.sheetsById;
        const playerSheet = sheets[sheetIds.players];
        const playerRows = await playerSheet.getRows();
        const requestQueue = sheets[sheetIds.requestQueue];
        const requestQueueRows = await requestQueue.getRows();
        const {
          Name: playerName,
          Attributes,
          Tendencies,
          Badges,
          Vitals  
        } = currentValue;
        let playerRowToUpdate = playerRows.find(row => row.Name === playerName);
        const { Data: oldData } = playerRowToUpdate || {};
        const newJSON = bulkUpdateJSON(oldData, Attributes, Tendencies, Badges, Vitals);
        playerRowToUpdate["Data"] = newJSON;
        await playerRowToUpdate.save();
      
        //updating the request queue
        const requestRowToUpdate = requestQueueRows.find(
          row => row.Player === playerName && !row["Done?"]
        );
        if (requestRowToUpdate) {
          const { Description: existingJSON } = requestRowToUpdate;
          const changeListJSON = createChangeListJSON("TRAINING", {Attributes, Tendencies, Badges}, existingJSON);
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
            Description: createChangeListJSON("TRAINING", {Attributes, Tendencies, Badges}),
            Data: newJSON,
            "Done?": undefined
          };
          await requestQueue.addRow(newRow);
        }
      },
      {}
    );
    return res.status(201).send({
      success: 'true',
      message: `Bulk update successful.`,
    })
  })();
};

module.exports = { postToChannelWith, postToTeamWith, updatePlayers };