const _ = require("lodash");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { CHANNEL_IDS } = require("../../consts");

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);

const offSeasonPaperWork = discordClient => {
  (async () => {
    discordClient.channels.get(CHANNEL_IDS[tech-stuff]).send("OffSeason processing in progress.");
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const playerSheet = sheets[sheetIds.players];
    const teamAssetsSheet = sheets[sheetIds.teamAssets];
    const teamAssetsRows = awaitTeamAssetsSheet.getRows();
    const validTeams = await teamAssetsSheet.getRows().then(rows => {
      return rows
        .filter(row => row.Frozen === "FALSE" && row.Real === "TRUE")
        .map(row => {
          return row.Team;
        });
    });
    const modifiedRows = await playerSheet.getRows().then(
      rows => {
        const filteredRows = rows.filter(row => !row["Retiring?"] && [...validTeams, 'FA'].includes(row.Team));
        await filteredRows.reduce(
          async (memo, currentValue = {}) => {
            const acc = await memo;
              if (_.clamp(parseInt(currentValue["Contract Length"]) - 1, 0, 3) == 0) {
                currentValue["Prior Team"] = currentValue["Team"];
                currentValue["Team"] = "FA"
              }
              currentValue["Contract Length"] = _.clamp(parseInt(currentValue["Contract Length"]) - 1, 0, 3);
              currentValue["Age"] = parseInt(currentValue["Age"]) + 1;
              await currentValue.save();
              return [
                ...acc,
                currentValue,
              ];
          },
          []
        );
      }
    );
    const retirementMentorships = await playerSheet.getRows().then(
      rows => {
        const filteredRows = rows.filter(row => row["Retiring?"] && [...validTeams, 'FA'].includes(row.Team));
        await filteredRows.reduce(
          async (memo, currentValue) => {
            const acc = await memo;
            const { Name, Team, ["Contract Length"]: contractLength  } = currentValue;
            if (_.clamp(parseInt(currentValue["Contract Length"]) - 1, 0, 3) == 0) {
              return [
                ...acc
              ]
            }
            const rowIdxToUpdate = teamAssetsRows.findIndex(row => row.Team == Team) + 1;
            const colIdxToUpdate = 45;
            await teamAssetsSheet.loadCells();
            let cellToUpdate = teamAssetsSheet.getCell(rowIdxToUpdate, colIdxToUpdate);
            const oldValue = cellToUpdate.value;
            let newValue = oldValue.split(',').push(Name);
            if (_.clamp(parseInt(currentValue["Contract Length"]) - 1, 0, 3) == 2) {
              newValue.push(Name);
            }
            cellToUpdate.value = newValue.join(',');
            await teamAssetsSheet.saveUpdatedCells();
          },
          []
        )
      }
    )
    discordClient.channels.get(CHANNEL_IDS[tech-stuff]).send("OffSeason processing complete.");
    return modifiedRows.filter(row => row.Team == "FA").map(row => row.Name);
  })();
};


module.exports = { offSeasonPaperWork };