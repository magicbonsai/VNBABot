const { sheetIds, colIdx } = require("./sheetHelper");
const { CHANNEL_IDS } = require("../../consts");
const _ = require("lodash");
require("dotenv").config();

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
const { createChangeListJSON } = require('../bots/rojBot');

const toContractLength = (cash) => {
  if(cash < 15) return 1;
  if(cash < 40) return 2;
  return 3;
};

const signFAsWith = discordClient => (numOfSignings = 10) => {
  (async function main () {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    console.log('numSignings', numOfSignings);
    const sheets = doc.sheetsById;
    const playerSheet = sheets[sheetIds.players];
    const archive = sheets[sheetIds.reportArchive];

    const signedRows = await playerSheet.getRows().then(
      rows => {
        const filteredRows = rows.filter(row => {
          const {
            Team,
            ["Contract Offer"]: contractOffer  
          } = row;
          // don't look at any row w/o a contractOffer json
          if (!contractOffer) return false;
          const fullOffer = JSON.parse(contractOffer);
          return Team == "FA" && !!fullOffer
        });
        return _.sampleSize(filteredRows, numOfSignings);
      }
    );

    // If there are no signed rows, then no one put down offers during this round

    if (!signedRows.length) {
      return discordClient.channels.cache.get(CHANNEL_IDS.transactions).send("Apparently, no one was given an offer on this round of Free Agency."); 
    }
    //get all FA rows w/ contracts: filter by contract row and team row
    //randomly select 10 or numOfSignings w/ lodash.sampleSize

    //Change Team name to winning contract offer

    const allSignings = await signedRows.reduce(
      async (memo, currentValue = {}) => {
        const acc = await memo;
        await doc.loadInfo();
        const sheets = doc.sheetsById;
        const playerSheet = sheets[sheetIds.players];
        const teamAssetsSheet = sheets[sheetIds.teamAssets];
        const teamAssetsRows = await teamAssetsSheet.getRows();      
        const playerRows = await playerSheet.getRows();
        const requestQueue = sheets[sheetIds.requestQueue];
        const requestQueueRows = await requestQueue.getRows();

        const {
          Name: playerName,
          ["Contract Offer"]: contractOffer,
        } = currentValue;

        const contractJson = JSON.parse(contractOffer);

        const {
          Team: newTeam,
          Cash,
          Minutes,
        } = contractJson;

        // Update the player Row with the new team + contract length

        let playerRowToUpdate =  playerRows.find(row => row.Name === playerName);
        const {
          Data
        } = playerRowToUpdate;
        const newLoyalty = _.random(1, 10);
        playerRowToUpdate["Team"] = newTeam;
        playerRowToUpdate["Salary"] = Cash;
        playerRowToUpdate["Contract Length"] = toContractLength(parseInt(Cash));
        playerRowToUpdate["Loyalty"] = newLoyalty;
        playerRowToUpdate["Contract Offer"] = JSON.stringify({
          ...contractJson,
          Loyalty: newLoyalty
        });
        console.log('newRow', playerName, newTeam);
        await playerRowToUpdate.save();

        // Update the request rows so the player is in the correct tab for Streamers

        const requestRowToUpdate = requestQueueRows.find(
          row => row.Player === playerName && !row["Done?"]
        );
        if (requestRowToUpdate) {
          const { Description: existingJSON } = requestRowToUpdate;
          const changeListJSON = createChangeListJSON("TEAM", newTeam, existingJSON);
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
            Description: createChangeListJSON("TEAM", newTeam),
            "Done?": undefined
          };
          await requestQueue.addRow(newRow);
        }

        // update team Assets cash 
        const rowIdxToUpdate = teamAssetsRows.findIndex(row => row.Team == newTeam) + 1;
        const colIdxToUpdate = colIdx["ASSETS"]["Cash"];

        await teamAssetsSheet.loadCells();
        const cellToUpdate = teamAssetsSheet.getCell(rowIdxToUpdate, colIdxToUpdate);
        const oldValue = parseInt(cellToUpdate.value);
        const newValue = oldValue - parseInt(Cash);

        cellToUpdate.value = newValue;
        console.log('newTeamCash', newTeam, oldValue, newValue);
        await teamAssetsSheet.saveUpdatedCells(); 

        // return relevant info to parse into a discord message
        return [
          ...acc,
          {
            player: playerName,
            team: newTeam,
            cash: Cash,
            minutes: Minutes,
            contractLength: toContractLength(parseInt(Cash))
          }
        ]; 
      },
      []
    );

    const fullDiscordMessageMap = allSignings.map(({ player, team, cash, minutes, contractLength }) => {
      return `\nThe **${team}** have signed **${player}** to a ${contractLength} season contract worth ${cash} Cash and ${minutes} minutes. \n`
    });

    // send a discord msg to the channel
    fullDiscordMessageMap.forEach(message => discordClient.channels.get(CHANNEL_IDS.transactions).send(message));

    // for safety purposes, save a row to the archive
    
    await archive.addRow({
      Date: new Date().toLocaleString().split(",")[0],
      Content: fullDiscordMessageMap.join(""),
    })
    
  })();
};

module.exports = { signFAsWith };