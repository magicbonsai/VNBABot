const Discord = require("discord.js");
const client = new Discord.Client();
const Pokedex = require("pokedex-promise-v2");
const P = new Pokedex();
const fetch = require("node-fetch");
const _ = require("lodash");
const queue = new Map();
const regression = require("js-regression");
//const twit = require("twit");
const twit = require("twitter-lite");
const robin = require("roundrobin");
const scrape = require("./app/helpers/boxScraper");

require("dotenv").config();

const docs = require("./docs/help.js");

const runRoj = require("./app/bots/rojBot");
const { postRojTweet, postSmithyTweet } = require("./app/helpers/tweetHelper");

function pluck(array, key) {
  return array.map(o => o[key]);
}

// Main switch statement for commands
const dedueCommand = (prompt, msg) => {
  const guild = msg.guild;
  const channels = {
    apexCasual: "602549249720451091"
  };
  const emojis = !!guild
    ? msg.guild.emojis.map(emoji => {
        return `<:${emoji.name}:${emoji.id}>`;
      })
    : [];

  const words = prompt.split(" ");
  const serverQueue = !!guild ? queue.get(msg.guild.id) : 0;

  // Runs slots using a server's custom emojis
  switch (words[0].toLowerCase()) {
    case "owstats":
      const dps = [
        "tracer",
        "hanzo",
        "mccree",
        "soldier76",
        "mei",
        "pharah",
        "symmetra",
        "reaper",
        "ashe",
        "bastion",
        "junkrat",
        "doomfist",
        "torbjorn",
        "widowmaker",
        "sombra",
        "genji"
      ];
      const tanks = [
        "dva",
        "reinhardt",
        "orisa",
        "wrecking_ball",
        "winston",
        "zarya",
        "sigma",
        "roadhog"
      ];
      const healers = [
        "ana",
        "baptiste",
        "brigitte",
        "lucio",
        "mercy",
        "moira",
        "zenyatta"
      ];
      const getOWStats = () => {
        return fetch(`https://owapi.net/api/v3/u/${words[1]}/heroes`, {
          method: "GET" // *GET, POST, PUT, DELETE, etc.
        })
          .then(response => response.json())
          .catch(error => {
            msg.channel.send(`Sorry, couldn't find a profile for ${words[1]}`);
          });
      };

      getOWStats().then(stats => {
        const playtimes = stats.us.heroes.playtime.competitive;
        const heroStats = stats.us.heroes.stats.competitive;
        let sortableHeroes = [];
        const data = [];
        for (let hero in heroStats) {
          const rolling_average = heroStats[hero].rolling_average_stats;
          const general_stats = heroStats[hero].general_stats;
          if (!!general_stats.win_percentage && playtimes[hero] > 0.05) {
            data.push([
              rolling_average.eliminations || 0,
              rolling_average.damage_blocked || 0,
              rolling_average.time_spent_on_fire || 0,
              rolling_average.hero_damage_done || 0,
              rolling_average.healing_done || 0,
              rolling_average.final_blows || 0,
              rolling_average.objective_kills || 0,
              rolling_average.objective_time || 0,
              -1 * (rolling_average.deaths || 0),
              rolling_average.solo_kills || 0,
              rolling_average.barrier_damage_done || 0,
              rolling_average.critical_hits || 0,
              rolling_average.offensive_assists || 0,
              rolling_average.defensive_assists || 0,
              general_stats.win_percentage || 0
            ]);
          }
        }

        const owregression = new regression.LinearRegression({
          alpha: 0.001, //
          iterations: 5,
          lambda: 1.0
        });
        const model = owregression.fit(data);

        for (let hero in heroStats) {
          const rolling_average = heroStats[hero].rolling_average_stats;
          const general_stats = heroStats[hero].general_stats;
          if (!!general_stats.win_percentage && playtimes[hero] > 0.05) {
            sortableHeroes.push([
              hero,
              owregression.transform([
                rolling_average.eliminations || 0,
                rolling_average.damage_blocked || 0,
                rolling_average.time_spent_on_fire || 0,
                rolling_average.hero_damage_done || 0,
                rolling_average.healing_done || 0,
                rolling_average.final_blows || 0,
                rolling_average.objective_kills || 0,
                rolling_average.objective_time || 0,
                -1 * (rolling_average.deaths || 0),
                rolling_average.solo_kills || 0,
                rolling_average.barrier_damage_done || 0,
                rolling_average.critical_hits || 0,
                rolling_average.offensive_assists || 0,
                rolling_average.defensive_assists || 0
              ]),
              playtimes[hero]
            ]);
          }
        }

        sortableHeroes.sort(function(a, b) {
          return b[1] - a[1];
        });

        const dpsRank = sortableHeroes.filter(hero => dps.includes(hero[0]));
        const tankRank = sortableHeroes.filter(hero => tanks.includes(hero[0]));
        const healerRank = sortableHeroes.filter(hero =>
          healers.includes(hero[0])
        );

        const sortablePlaytimes = [...sortableHeroes];
        sortablePlaytimes.sort(function(a, b) {
          return b[2] - a[2];
        });

        const underrated = [...sortableHeroes];
        underrated.sort(function(a, b) {
          return (
            Math.pow(b[1] / sortableHeroes[0][1], 1) /
              Math.pow(b[2] / sortablePlaytimes[0][2], 0.1) -
            Math.pow(a[1] / sortableHeroes[0][1], 1) /
              Math.pow(a[2] / sortablePlaytimes[0][2], 0.1)
          );
        });

        msg.channel.send(
          `Your **top played** heroes for this season are:\n1. ${sortablePlaytimes[0][0] ||
            "Not enough playtime..."}\n2. ${sortablePlaytimes[1][0] ||
            "Not enough playtime..."}\n3. ${sortablePlaytimes[2][0] ||
            "Not enough playtime..."}\n`
        );
        if (dpsRank.length > 2) {
          msg.channel.send(
            `Your most valuable **DPS** heroes in the past 10 games are:\n1: ${dpsRank[0][0] ||
              "Not enough playtime..."}\n2: ${dpsRank[1][0] ||
              "Not enough playtime..."}\n3 ${dpsRank[2][0] ||
              "Not enough playtime..."}`
          );
        }
        if (tankRank.length > 2) {
          msg.channel.send(
            `Your most valuable **Tank** heroes in the past 10 games are:\n1: ${tankRank[0][0] ||
              "Not enough playtime..."}\n2: ${tankRank[1][0] ||
              "Not enough playtime..."}\n3 ${tankRank[2][0] ||
              "Not enough playtime..."}`
          );
        }
        if (healerRank.length > 2) {
          msg.channel.send(
            `Your most valuable **Support** heroes in the past 10 games are:\n1: ${healerRank[0][0] ||
              "Not enough playtime..."}\n2: ${healerRank[1][0] ||
              "Not enough playtime..."}\n3 ${healerRank[2][0] ||
              "Not enough playtime..."}`
          );
        }

        msg.channel.send(
          `I recommend playing more ${underrated[0][0]}, ${underrated[1][0]}, and ${underrated[2][0]}\n
          `
        );

        msg.channel.send(
          `I recommend playing less ${underrated[underrated.length - 1][0]}, ${
            underrated[underrated.length - 2][0]
          }, and ${underrated[underrated.length - 3][0]}
          `
        );
      });

      break;
    case "slots":
      const roll1 = Math.floor(Math.random() * emojis.length);
      const roll2 = Math.floor(Math.random() * emojis.length);
      const roll3 = Math.floor(Math.random() * emojis.length);
      const win = roll1 === roll2 && roll1 === roll3;
      msg.channel.send(
        `**${msg.author.username}** rolled the slots: \n **[** ${
          emojis[roll1]
        } ${emojis[roll2]} ${emojis[roll3]} **]** \n and ${
          win ? "won!" : "lost..."
        }`
      );
      break;

    // Breaks Apex Casual into squads of 3
    case "squads": {
      const members = client.channels
        .find(channel => channel.id === channels["apexCasual"])
        .members.map(user => user.user.username);

      shuffle(members);
      let list = "";
      let counter = 1;

      while (members.length) {
        list = list.concat(`Squad ${counter}: ${members.splice(0, 3)} \n`);
        counter = counter + 1;
      }
      msg.channel.send(list);
      break;
    }

    // Returns a random pokemon using PokeAPI
    case "pokemon":
      let pokeNumber = Math.floor(Math.random() * 807);
      if (msg.author.username === "nil") {
        pokenumber = 569;
      }
      P.getPokemonByName(pokeNumber, function(response, error) {
        // with callback
        if (!error) {
          const attachment = new Discord.Attachment(
            response.sprites.front_default
          );
          msg.channel.send(`A wild ${response.name} appeared!`);
          msg.channel.send(attachment);
        } else {
          console.log(error);
        }
      });
      break;

    // Returns a random waifu from WaifuLabs
    case "waifu":
      const fetchWaifu = data => {
        return fetch("https://api.waifulabs.com/generate", {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        }).then(response => response.json());
      };

      fetchWaifu({ step: 0 }).then(waifus => {
        let waifuNumber = Math.floor(Math.random() * waifus.newGirls.length);
        const attachment = new Discord.Attachment(
          base64ToPNG(waifus.newGirls[waifuNumber].image)
        );
        msg.channel.send(attachment);
      });
      break;

    // Grabs a summary of ow stats
    case "owstats-old":
      const getStats = () => {
        return fetch(`https://owapi.net/api/v3/u/${words[1]}/heroes`, {
          method: "GET" // *GET, POST, PUT, DELETE, etc.
        })
          .then(response => response.json())
          .catch(error => {
            msg.channel.send(`Sorry, couldn't find a profile for ${words[1]}`);
          });
      };

      getStats().then(stats => {
        const playtimes = stats.us.heroes.playtime.competitive;
        const heroStats = stats.us.heroes.stats.competitive;
        let sortablePlaytimes = [];
        let sortableHeroes = [];
        for (let hero in playtimes) {
          sortablePlaytimes.push([hero, playtimes[hero]]);
        }
        for (let hero in heroStats) {
          sortableHeroes.push([hero, heroStats[hero]]);
        }

        sortablePlaytimes.sort(function(a, b) {
          return b[1] - a[1];
        });

        sortableHeroes.sort(function(a, b) {
          return (
            b[1].rolling_average_stats.time_spent_on_fire ||
            0 - a[1].rolling_average_stats.time_spent_on_fire ||
            0
          );
        });

        let hiddenHeroes = [];

        for (let hero in heroStats) {
          const rolling_average = heroStats[hero].rolling_average_stats;
          const heroValue =
            Math.pow(
              1 +
                (rolling_average.eliminations || 0) / 10 +
                (rolling_average.damage_blocked || 0) / 30000 +
                (rolling_average.time_spent_on_fire || 0) * 2 +
                (rolling_average.hero_damage_done || 0) / 10000 +
                (rolling_average.healing_done || 0) / 7500,
              5
            ) /
            (playtimes[hero] + 50);
          if (playtimes[hero] > 0.05) {
            hiddenHeroes.push([hero, heroValue]);
          }
        }

        hiddenHeroes.sort(function(a, b) {
          return b[1] - a[1];
        });

        msg.channel.send(
          `Your **top played** heroes for this season are:\n1. ${sortablePlaytimes[0][0]}\n2. ${sortablePlaytimes[1][0]}\n3. ${sortablePlaytimes[2][0]}\n`
        );

        msg.channel.send(
          `Your **most valuable** heroes in the past 10 games are:\n1. ${sortableHeroes[0][0]}\n2. ${sortableHeroes[1][0]}\n3. ${sortableHeroes[2][0]}`
        );

        msg.channel.send(
          `I recommend playing more ${hiddenHeroes[0][0]} and less ${
            hiddenHeroes[hiddenHeroes.length - 1][0]
          }`
        );
      });
      break;

    case "snap":
      const guildMembers = msg.guild.members.array();
      const chosenOne =
        guildMembers[Math.floor(Math.random() * guildMembers.length)];
      const name = chosenOne.user.nickname || chosenOne.user.username;
      msg.channel.send(
        `**${name}** has been chosen as a sacrifice.\nI'm sorry, little one.`
      );
      msg.channel.send(`**${name}** doesn't feel so good...`);
      msg.channel.send(
        new Discord.Attachment(
          "https://thumbs.gfycat.com/FantasticFreeArcticseal-max-1mb.gif"
        )
      );
      break;

    case "play":
      execute(msg, serverQueue);
      break;

    case "skip":
      skip(msg, serverQueue);
      break;

    case "stop":
      stop(msg, serverQueue);
      break;

    // reddit cases

    case "reddit":
      getRedditRandom(words[1], msg);
      break;

    case "aww":
      getRedditRandom("aww", msg);
      break;

    case "unit":
      getRedditRandom("AbsoluteUnits", msg);
      break;

    case "pup":
      getRedditRandom("rarepuppers", msg);
      break;

    case "bleach":
      getRedditRandom("eyebleach", msg);
      break;

    case "cozy":
      getRedditRandom("cozyplaces", msg);
      break;

    case "meirl":
      getRedditRandom("meirl", msg);
      break;

    case "haiku":
      getRedditRandom("youtubehaiku", msg);
      break;

    case "huh":
      getRedditRandom("mildlyinteresting", msg);
      break;

    case "unexpected":
      getRedditRandom("unexpected", msg);
      break;

    case "gif":
      getRedditRandom("gifs", msg);
      break;

    case "yum":
      getRedditRandom("foodporn", msg);
      break;

    case "animu":
      getRedditRandom("animegifs", msg);
      break;

    case "whoa":
      getRedditRandom("whoadude", msg);
      break;

    case "scream":
      getRedditRandom("perfectlycutscreams", msg);
      break;

    case "ohno":
      getRedditRandom("CatastrophicFailure", msg);
      break;

    case "smile":
      getRedditRandom("mademesmile", msg);
      break;

    case "nba":
      getRedditRandom("nba", msg);
      break;

    case "hmmm":
      getRedditRandom("hmmm", msg);
      break;

    case "birb":
      getRedditRandom("birbs", msg);
      break;

    // end reddit cases

    case "fs":
      getFsUpdate();
      break;

    case "tweet":
      runRoj(words[1]);
      break;

    case "vnba":
      if (msg.channel.type == "dm") {
        msg.reply("Posting on twitter!");
        const tweet = words.slice(1).join(" ");
        postSmithyTweet(tweet);
      }
      break;

    case "roj":
      if (msg.channel.type == "dm") {
        msg.reply("Posting on twitter!");
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
      msg.author.send(docs);
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

client.on("guildMemberAdd", member => {
  const channel = member.guild.channels.find(ch => ch.name === "general");
  if (!channel) return;
  channel.send(
    `Welcome to the server, ${member}. We hope you have a good time. Furthermore I am a man of Duscar.`
  );
});

client.login(process.env.BOT_TOKEN);

// helpers

const shuffle = array => {
  array.sort(() => Math.random() - 0.5);
};

const base64ToPNG = data => {
  return Buffer.from(data, "base64");
};

const getRedditRandom = (subreddit, message) => {
  const getSubreddit = sub => {
    return fetch(`https://reddit.com/r/${sub}/hot.json?limit=100`, {
      method: "GET" // *GET, POST, PUT, DELETE, etc.
    })
      .then(response => response.json())
      .catch(error => {
        message.channel.send(`Sorry, this subreddit cannot be found.`);
      });
  };

  const postNumber = Math.floor(Math.random() * 100);
  const borkNumber = Math.floor(Math.random() * 4);

  const borks = ["bork bork bork!", "woof!", "bork!", "Wan wan wan!"];
  getSubreddit(subreddit).then(response => {
    message.channel.send(borks[borkNumber]);
    message.channel.send(
      _.get(response, `data.children[${postNumber}].data.url`)
    );
  });
};

const CronJob = require("cron").CronJob;

const fs = {
  hanyu: {
    link: "http://www.isuresults.com/bios/isufs00010967.htm",
    date: false,
    name: "Yuzuru Hanyu"
  },
  china_pair: {
    link: "http://www.isuresults.com/bios/isufs00012227.htm",
    date: false,
    name: "China Pair (Wenjing Sui, Cong Han)"
  }
};

const getFsUpdate = () => {
  Object.keys(fs).forEach(key => {
    fetch(fs[key].link).then(response => {
      console.log(response.headers.get("Last-Modified"));
      const lastModified = response.headers.get("Last-Modified");
      if (!!fs[key].date && lastModified != fs[key].date) {
        client.users
          .get("165910708578418688")
          .send(
            `The ISUResults page for ${fs[key].name} has been updated. Please go to ${fs[key].link} for all the latest info.`
          );
      }
      fs[key].date = lastModified;
    });
  });
};

const job = new CronJob("0 15 * * *", function() {
  //will run at 11:00 AM everyday
  runRoj();
});

const job_two = new CronJob("0 18 * * *", function() {
  //will run at 2:00 PM everyday
  runRoj();
});

const job_fs = new CronJob("*/10 * * * *", function() {
  //will run every 30 min
  console.log("checking for skater updates");
  getFsUpdate();
});

job.start();
job_two.start();
job_fs.start();
