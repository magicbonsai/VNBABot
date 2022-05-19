const _ = require("lodash");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { CHANNEL_IDS } = require("../../consts");
const { sheetIds } = require("./sheetHelper");

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);

const TEAM_INDEX = 6;
const CONTRACT_INDEX = 10;
const AGE_INDEX = 11;
const PRIOR_TEAM_INDEX = 31;

const offSeasonPaperWork = discordClient => {
  (async () => {
    discordClient.channels.cache.get(CHANNEL_IDS["tech-stuff"]).send("OffSeason processing in progress.");
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const playerSheet = sheets[sheetIds.players];
    const teamAssetsSheet = sheets[sheetIds.teamAssets];
    const teamAssetsRows = await teamAssetsSheet.getRows();
    const validTeams = await teamAssetsSheet.getRows().then(rows => {
      return rows
        .filter(row => row.Frozen === "FALSE" && row.Real === "TRUE")
        .map(row => {
          return row.Team;
        });
    });
    const playerRows = await playerSheet.getRows();
    const filteredRows = await playerSheet.getRows().then(
      rows =>  rows.filter(row => !row["Retiring?"] && [...validTeams, 'FA'].includes(row.Team))   
    );
    discordClient.channels.cache.get(CHANNEL_IDS["tech-stuff"]).send("Updating Contracts and Ages...");
    await playerSheet.loadCells();
    await filteredRows.reduce(
      async (memo, currentValue = {}) => {
        const acc = await memo;
        const {
          Name,
          ["Prior Team"]: priorTeam,
          ["Contract Length"]: contractLength = "0",
          Age = "0",
          Team,
        } = currentValue;
        const rowIdxToUpdate = playerRows.findIndex(row => row.Name === Name) + 1;
        let newPriorTeam = priorTeam;
        let newTeam = Team;
        let newAge = Age;
        let newContractLength = contractLength;
        if (_.clamp(parseInt(contractLength) - 1, 0, 3) == 0) {
          newPriorTeam = Team;
          newTeam = "FA";
        }
        newContractLength = _.clamp(parseInt(contractLength) - 1, 0, 3);
        newAge = parseInt(Age) + 1;
        console.log('foo', Name, Age, priorTeam, contractLength,);
        console.log('numbers', newTeam, newPriorTeam, newAge, newContractLength);
        // Team cell
        playerSheet.getCell(rowIdxToUpdate, TEAM_INDEX).value = newTeam;
        // Contract Length
        playerSheet.getCell(rowIdxToUpdate, CONTRACT_INDEX).value = newContractLength;
        // Age
        playerSheet.getCell(rowIdxToUpdate, AGE_INDEX).value = newAge;
        // Prior Team
        playerSheet.getCell(rowIdxToUpdate, PRIOR_TEAM_INDEX).value = newPriorTeam;
        
        return [
          ...acc,
          currentValue,
        ];
      },
      []
    );
    await playerSheet.saveUpdatedCells();
    discordClient.channels.cache.get(CHANNEL_IDS["tech-stuff"]).send("Updating Contracts and Ages Complete.");
    const retirementMentorships = await playerSheet.getRows().then(
      rows => rows.filter(row => row["Retiring?"] && [...validTeams, 'FA'].includes(row.Team))
    )
    console.log('retirementrows', retirementMentorships.map(player => player.Name));
    discordClient.channels.cache.get(CHANNEL_IDS["tech-stuff"]).send("Updating Retirement Mentorships...");
    await retirementMentorships.reduce(
      async (memo, currentValue) => {
        const acc = await memo;
        await doc.loadInfo();
        await teamAssetsSheet.loadCells();
        const { Name, Team, ["Contract Length"]: contractLength  } = currentValue;
        if (_.clamp(parseInt(contractLength) - 1, 0, 3) == 0) {
          return acc
        }
        const rowIdxToUpdate = teamAssetsRows.findIndex(row => row.Team == Team) + 1;
        const colIdxToUpdate = 44;
        let cellToUpdate = teamAssetsSheet.getCell(rowIdxToUpdate, colIdxToUpdate);
        const oldValue = cellToUpdate.value || "";
        let newValue = [ ...oldValue.split(','), Name].filter(value => !!value);
        if (_.clamp(parseInt(currentValue["Contract Length"]) - 1, 0, 3) == 2) {
          newValue = [...newValue, Name];
        }
        cellToUpdate.value = newValue.join(',');
        await teamAssetsSheet.saveUpdatedCells();
        return acc;
      },
      []
    );
    discordClient.channels.cache.get(CHANNEL_IDS["tech-stuff"]).send("Retirement Mentorships complete.");
    discordClient.channels.cache.get(CHANNEL_IDS["tech-stuff"]).send("OffSeason processing complete.");
    return;
  })();
};


module.exports = { offSeasonPaperWork };