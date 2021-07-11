const Discord = require("discord.js");
const CronJob = require("cron").CronJob;
const robin = require("roundrobin");
const _ = require("lodash");
const scrape = require("./app/helpers/boxScraper");
const rosterCheckCommand = require("./app/helpers/rosterChecker");
const { generatePlayer, runBatch } = require("./app/helpers/playerGenerator");
const retirementCheck = require("./app/helpers/retirementCheck");

require("dotenv").config();
const client = new Discord.Client();

const { help: docs, devHelp: devDocs } = require("./docs/help.js");

const runRoj = require("./app/bots/rojBot");
const { postRojTweet, postSmithyTweet } = require("./app/helpers/tweetHelper");

const runRojWithIndexCheck = (teams, index) => {
  if(!teams[index]) {
    return;
  }
  return runRoj(teams[index])
};

// Main switch statement for commands
const dedueCommand = (prompt, msg) => {
  const words = prompt.split(" ");

  // Runs slots using a server's custom emojis
  switch (words[0].toLowerCase()) {
    case "tweet":
      runRoj(words[1], words[2]);
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
      generatePlayer(words[1], words[2]);
      if (process.env.environment === "PRODUCTION") {
        msg.author.send("Generating a new player data.");
      } else {
        console.log("Generating a player data");
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
      retirementCheck();
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

let teams = process.env.VALID_TEAMS.split(',');

const preJob = new CronJob("0 14 * * *", function() {
  console.log('teams value', teams);
  teams = _.shuffle(process.env.VALID_TEAMS.split(','));
});

const job = new CronJob("0 15 * * *", function() {
  if (!!process.env.DAILY_TWEETS) {
    console.log('teams value', teams);
    runRoj(teams[0]);
    runRojWithIndexCheck(teams, 0);
  }
});

const job_two = new CronJob("10 15 * * *", function() {
  if (!!process.env.DAILY_TWEETS) {
    console.log('teams value', teams);
    runRoj(teams[1]);
    runRojWithIndexCheck(teams, 1);
  }
});

const job_three = new CronJob("20 15 * * *", function() {
  if (!!process.env.DAILY_TWEETS) {
    console.log('teams value', teams);
    runRojWithIndexCheck(teams, 2);
  }
});

const job_four = new CronJob("30 15 * * *", function() {
  if (!!process.env.DAILY_TWEETS) {
    console.log('teams value', teams);
    runRojWithIndexCheck(teams, 3);
  }
});

const job_five = new CronJob("40 15 * * *", function() {
  if (!!process.env.DAILY_TWEETS) {
    console.log('teams value', teams);
    runRojWithIndexCheck(teams, 4);
  }
});

const job_six = new CronJob("50 15 * * *", function() {
  if (!!process.env.DAILY_TWEETS) {
    console.log('teams value', teams);
    runRojWithIndexCheck(teams, 5);
  }
});

const job_seven = new CronJob("0 16 * * *", function() {
  if (!!process.env.DAILY_TWEETS) {
    console.log('teams value', teams);
    runRojWithIndexCheck(teams, 6);
  }
});

const job_eight = new CronJob("10 16 * * *", function() {
  if (!!process.env.DAILY_TWEETS) {
    console.log('teams value', teams);
    runRoj('FA');
  }
});

preJob.start();
job.start();
job_two.start();
job_three.start();
job_four.start();
job_five.start();
job_six.start();
job_seven.start();
job_eight.start();
