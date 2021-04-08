const _ = require("lodash");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { sheetIds } = require("./sheetHelper");

const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEETS_KEY
);

function rosterCheckCommand(msg = {}) {
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const timeSheet = sheets[sheetIds.rosterCheckIn];
    let lastEntry = {};
    timeSheet.getRows().then((entries) => {
      entries.every((entry) => {
        lastEntry = entry;
        const { date, checkinTime } = entry;
        if (!checkinTime || !date) {
          return false;
        }
        return true;
      });
      const { name, date, username, rosterName, checkoutTime, checkinTime } = lastEntry;
      const message = `The last individual to check out the roster was ${name}(${username}) at ${checkoutTime} on ${date}. `
      const checkInMsg = !!checkinTime 
        ? `They last checked the roster in at ${checkinTime}.` 
        : "It does not look like they checked it back in yet.  You should check in with them to see if they are done."
      msg.reply(message + checkInMsg);
    });
  })();
}

module.exports = rosterCheckCommand;
