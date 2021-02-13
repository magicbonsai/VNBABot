const Discord = require("discord.js");
const CronJob = require("cron").CronJob;
const robin = require("roundrobin");
const scrape = require("./app/helpers/boxScraper");
const rosterCheckCommand = require("./app/helpers/rosterChecker");
const generatePlayer = require("./app/helpers/playerGenerator");

require("dotenv").config();
const client = new Discord.Client();

const { help: docs, devHelp: devDocs } = require("./docs/help.js");

const runRoj = require("./app/bots/rojBot");
const { postRojTweet, postSmithyTweet } = require("./app/helpers/tweetHelper");

// Main switch statement for commands
const dedueCommand = (prompt, msg) => {

  const words = prompt.split(" ");

  // Runs slots using a server's custom emojis
  switch (words[0].toLowerCase()) {
    case "tweet":
      runRoj(words[1]);
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

    case "vnbahelp":
      msg.react(`✉`);
      if(process.env.environment === "DEVELOPMENT") {
        msg.author.send(devDocs)
      }
      else {
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
      if(process.env.environment === "PRODUCTION") {
        msg.author.send("Generating a new player data.");
      } else {
        console.log("Generating a player data");
      }
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

const job = new CronJob("0 15 * * *", function() {
  //will run at 11:00 AM everyday
  if(!!process.env.DAILY_TWEETS) {
    runRoj();
  }
});

const job_two = new CronJob("0 17 * * *", function() {
  //will run at 2:00 PM everyday
  if(!!process.env.DAILY_TWEETS) {
    runRoj();
  }
});

const job_three = new CronJob("0 19 * * *", function() {
  //will run at 2:00 PM everyday
  if(!!process.env.DAILY_TWEETS) {
    runRoj();
  }
});

job.start();
job_two.start();
job_three.start();
