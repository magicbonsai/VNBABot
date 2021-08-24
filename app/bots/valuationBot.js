require("dotenv").config();
const _ = require("lodash");
const { sheetIds } = require("../helpers/sheetHelper");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
const prevSeasonDoc = new GoogleSpreadsheet(process.env.PREV_SEASON_KEY);

const runValuationBot = (functionToUse, params = {}) => {
  const validTeams = (process.env.VALID_TEAMS || []).split(",");
  (async () => {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    await prevSeasonDoc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await prevSeasonDoc.loadInfo();
    const sheets = doc.sheetsById;
    const prevSheets = prevSeasonDoc.sheetsById;

    const teamAssets = sheets[sheetIds.teamAssets];
    const playerList = sheets[sheetIds.playerList];
    const botCategoryValues = sheets[sheetIds.botCategoryValues];
    const leagueLeaders = sheets[sheetIds.leagueLeaders];
    const prevLeagueLeaders = prevSheets[sheetIds.leagueLeaders];

    const teamAssetsRows = await teamAssets.getRows();
    const playerListRows = await playerList.getRows();
    const botCategoryValuesRows = await botCategoryValues.getRows();
    const leagueLeadersRows = await leagueLeaders.getRows();
    const prevLeagueLeadersRows = await prevLeagueLeaders.getRows();
  })();
};

module.exports = runValuationBot;