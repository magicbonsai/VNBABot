const { sheetIds, colIdx } = require("./sheetHelper");
const { CHANNEL_IDS } = require("../../consts");
const _ = require("lodash");
require("dotenv").config();

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
const { createChangeListJSON } = require('../bots/rojBot');

const generateFutureDate = (days) => {
  const d = new Date();
  const newDate = d.setDate(d.getDate() + days);
  return newDate.toLocaleString().split(",")[0];
};

// use rowUpdates here

const generateInjuries = discordClient => (params) => {
  (async () => {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
  })();
}; 

// use Cell Updates to batch clear all injuries

const removeInjuries = () => {
  (async () => {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
  })
};