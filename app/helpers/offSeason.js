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
    const modifiedRows = await playerSheet.getRows().then(
      rows => {
        await rows.reduce(
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
    discordClient.channels.get(CHANNEL_IDS[tech-stuff]).send("OffSeason processing complete.");
    return modifiedRows.filter(row => row.Team == "FA").map(row => row.Name);
  })();
};


module.exports = { offSeasonPaperWork };