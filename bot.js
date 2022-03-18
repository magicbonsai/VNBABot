const { Client } = require("discord.js");
const CronJob = require("cron").CronJob;
const robin = require("roundrobin");
const _ = require("lodash");
const scrape = require("./app/helpers/boxScraper");
const rosterCheckCommand = require("./app/helpers/rosterChecker");
const { generatePlayer, runBatch } = require("./app/helpers/playerGenerator");
const { generateCoach } = require("./app/helpers/coachGenerator");
const retirementCheck = require("./app/helpers/retirementCheck");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const router = express.Router();
const { postToChannelWith, postToTeamWith } = require("./app/router/services");
const { signFAs } = requre("./app/helpers/freeAgencySigner");
require("dotenv").config();
const client = new Client({
  intents: ["GUILDS", "GUILD_MEMBERS"],
  fetchAllMembers: true
});

const { help: docs, devHelp: devDocs } = require("./docs/help.js");

const { runReportWith } = require("./app/bots/rojBot");
const { postRojTweet, postSmithyTweet } = require("./app/helpers/tweetHelper");
const R = require("./custom-r-script");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const runReport = runReportWith(client);

// Router + Express Setup

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post("/roj/post/toChannel", postToChannelWith(client));
router.post("/roj/post/toTeam", postToTeamWith(client));

const PORT = process.env.PORT || 8081;

app.use("/", router);

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});

// Main discord bot setup

// Main switch statement for commands
const dedueCommand = (prompt, msg) => {
  const words = prompt.split(" ");

  // Runs slots using a server's custom emojis
  switch (words[0].toLowerCase()) {
    case "report":
      runReport(parseInt(words[1]));
      break;
    case "signfa": 
      signFAs(parseInt(words[1]));
      break;
    case "r-s":
      triKovAnalysis();
      break;
    case "smithy":
      if (msg.channel.type == "dm") {
        msg.reply("Posting on Smithy twitter!");
        const tweet = words.slice(1).join(" ");
        postSmithyTweet(tweet);
      }
      break;

    case "roj":
      if (msg.channel.type == "dm") {
        msg.reply("Posting on Roj twitter!");
        const tweet = words.slice(1).join(" ");
        postRojTweet(tweet);
      }
      break;

    case "scrape":
      // Temporarily turning off scraping in prod
      if (process.env.environment === "DEVELOPMENT") {
        scrape(words[1]);
      }
      // scrape(words[1]);
      break;

    case "help":
      msg.react(`✉`);
      if (process.env.environment === "DEVELOPMENT") {
        msg.author.send(devDocs);
      } else {
        msg.author.send(docs);
      }
      break;

    case "robin":
      const schedule = robin(7, [
        "Dallas Mavericks",
        "Toronto Raptors",
        "Indiana Pacers",
        "Denver Nuggets",
        "Golden State Warriors",
        "Los Angeles Lakers",
        "Washington Wizards"
      ]);

      console.log(schedule.flat(2));
      break;

    case "checkroster":
      rosterCheckCommand(msg);
      break;

    case "generateplayer":
      generatePlayer(words[1], words[2], words[3]);
      if (process.env.environment === "PRODUCTION") {
        msg.author.send("Generating a new player data.");
      } else {
        console.log("Generating a player data");
      }
      break;

    case "generatecoach":
      generateCoach();
      if (process.env.environment === "PRODUCTION") {
        msg.author.send("Generating a new coach.");
      } else {
        console.log("Generating a new coach");
      }
      break;

    case "runbatch":
      runBatch(words[1]);
      if (process.env.environment === "PRODUCTION") {
        msg.author.send(`Running batch No. ${words[1]}`);
      } else {
        console.log(`Running batch No. ${words[1]}`);
      }
      break;
    // TODO: Figure out a DRY solution for this prod/dev stuff
    case "retirement":
      retirementCheck(client);
      break;

    default:
  }
};

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
  const { author, content } = msg;

  if (author.bot) return;

  if (content.charAt(0) === "$") {
    dedueCommand(content.substr(1), msg);
  }
});

//Main bot loop

client.login(process.env.BOT_TOKEN);

/**
 * TODO: Augment this cronjob for the bot to do more daily tasks like:
 * - decrease the duration of an injury on a player
 * - ??
 * - (AZ)
 */
const preJob = new CronJob("0 14 * * *", function () {
  // validTeams = (async function main() {
  //   const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
  //   await doc.useServiceAccountAuth({
  //     client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  //     private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
  //   });
  //   await doc.loadInfo();
  //   const sheets = doc.sheetsByTitle;
  //   const teamAssets = sheets["Team Assets"];
  //   const teamAssetsRows = await teamAssets.getRows();
  //   console.log('am I here')
  // })();
});

const WednesdayJob = new CronJob("0 16 * * 3", function () {
  runReport(3);
});

const WednesdayJob2 = new CronJob("15 16 * * 3", function () {
  runReport(3);
});

const SaturdayJob = new CronJob("0 16 * * 6", function () {
  runReport(3);
});

const SaturdayJob2 = new CronJob("15 16 * * 6", function () {
  runReport(3);
});

const dailyInjuryReportJob = new CronJob("0 16 * * *", function () {});

//some sort of trade request tracker

const trikovJob = new CronJob("0 13 * * *", function () {
  triKovAnalysis();
});

preJob.start();
trikovJob.start();
WednesdayJob.start();
WednesdayJob2.start();
SaturdayJob.start();
SaturdayJob2.start();

const triKovAnalysis = () => {
  R("ex-sync.R")
    .data({})
    .call({ warn: -1 }, (err, d) => {
      (async function main() {
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
        await doc.useServiceAccountAuth({
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
        });

        await doc.loadInfo();

        const sheets = doc.sheetsByTitle;
        const players = sheets["Player List"];
        const teamAssets = sheets["Team Assets"];

        const teamAssetsRows = await teamAssets.getRows();
        const playerListRows = await players.getRows();

        const cashValues = {};
        const knnCashValues = {};

        for (let i = 0; i < d[0].length; i++) {
          cashValues[d[0][i].Name] = [d[0][i], d[2][i], d[4][i]];
        }

        for (let i = 0; i < d[1].length; i++) {
          knnCashValues[d[1][i].Player] = [d[1][i], d[3][i], d[5][i]];
        }

        await players.loadCells();
        await teamAssets.loadCells();

        playerListRows.forEach(row => {
          players.getCell(row.rowNumber - 1, 23).value = cashValues[row.Name]
            ? _.mean(cashValues[row.Name].map(cr => cr.Cash_Value))
            : knnCashValues[row.Name]
            ? _.mean(knnCashValues[row.Name].map(knn => knn.continuous_target))
            : 0;

          players.getCell(row.rowNumber - 1, 27).value = cashValues[row.Name]
            ? cashValues[row.Name][0].Cash_Value
            : knnCashValues[row.Name]
            ? knnCashValues[row.Name][0].continuous_target
            : 0;

          players.getCell(row.rowNumber - 1, 28).value = cashValues[row.Name]
            ? cashValues[row.Name][1].Cash_Value
            : knnCashValues[row.Name]
            ? knnCashValues[row.Name][1].continuous_target
            : 0;

          players.getCell(row.rowNumber - 1, 29).value = cashValues[row.Name]
            ? cashValues[row.Name][2].Cash_Value
            : knnCashValues[row.Name]
            ? knnCashValues[row.Name][2].continuous_target
            : 0;

          players.getCell(row.rowNumber - 1, 30).value = knnCashValues[row.Name]
            ? _.uniq([
                knnCashValues[row.Name][0]["neighbor1"],
                knnCashValues[row.Name][1]["neighbor1"],
                knnCashValues[row.Name][2]["neighbor1"]
              ]).join(", ")
            : 0;
        });

        teamAssetsRows.forEach(row => {
          const picks = row["Draft Picks"]
            .split(", ")
            .map(str => str.replace(/\s+/g, ""));

          const miscPicks = row["Misc Draft Picks"]
            .split(", ")
            .map(str => str.replace(/\s+/g, ""));

          teamAssets.getCell(row.rowNumber - 1, 6).value = picks
            .map(pick => {
              return cashValues[pick] ? _.mean(cashValues[pick].map(cr => cr.Cash_Value)) : 0;
            })
            .join(", ");

          teamAssets.getCell(row.rowNumber - 1, 7).value = miscPicks
            .map(pick => {
              return cashValues[pick] ? _.mean(cashValues[pick].map(cr => cr.Cash_Value)) : 0;
            })
            .join(", ");
        });

        await players.saveUpdatedCells();
        await teamAssets.saveUpdatedCells();
      })();
    });
};
