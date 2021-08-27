const { postRojTweet, postSmithyTweet } = require("../helpers/tweetHelper");
const { sheetIds } = require("../helpers/sheetHelper");
const { rojEvents, dLeagueEvents } = require("./consts");
const fetch = require("node-fetch");
const _ = require("lodash");
const generatePlayer = require("../helpers/playerGenerator");
require("dotenv").config();

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
const rwc = require("random-weighted-choice");
const faker = require("faker");
faker.setLocale("en");

const playerTypes = ["guard", "wing", "big"];

function runRoj(team, setTweet) {
  const validTeams = (process.env.VALID_TEAMS || []).split(",");
  const teamToUse = team ? team : _.sample(validTeams);
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();

    const sheets = doc.sheetsById;
    const news = sheets[sheetIds.news];
    const players = sheets[sheetIds.players];
    const retiredPlayers = sheets[sheetIds.retiredPlayers];

    const rojUpdates = sheets[sheetIds.updates];
    const trainingRegime = sheets[sheetIds.trainingRegime];

    // Using environmentVariables to set valid teams for tweets (maybe this should be sheets) (AZ)

    const getVNBANewsWeights = news.getRows().then(rows => {
      return rows.map(row => {
        return {
          id: row.event,
          weight: parseInt(row.prob)
        };
      });
    });

    const getFANewsWeights = news.getRows().then(rows => {
      return rows
        .filter(row => {
          return row.isBoost;
        })
        .map(row => {
          return {
            id: row.event,
            weight: parseInt(row.prob)
          };
        });
    });

    players.getRows().then(playerRows => {
      const teamPlayers = playerRows.filter(
        player => player.Team === teamToUse
      );
      const faPlayers = playerRows.filter(player => player.Team === "FA");
      const weights = [
        {
          id: "team",
          weight: teamPlayers.length
        },
        {
          id: "fa",
          weight: 13 - teamPlayers.length
        }
      ];
      const { playersToUse, getNewsWeights } =
        rwc(weights) === "team"
          ? {
              playersToUse: teamPlayers,
              getNewsWeights: getVNBANewsWeights
            }
          : {
              playersToUse: faPlayers,
              getNewsWeights: getFANewsWeights
            };

      getNewsWeights.then(newsWeights => {
        retiredPlayers.getRows().then(retiredRows => {
          const chosenPlayer = _.sample(playersToUse);
          const chosenPlayerTwo = _.sample(playersToUse);
          const chosenRetiree = _.sample(retiredRows);
          const result = setTweet || rwc(newsWeights);
          const status = newsRoulette(
            result,
            chosenPlayer,
            chosenPlayerTwo,
            chosenRetiree,
            rojUpdates,
            trainingRegime
          );
          status.then(toPost => {
            if (process.env.ENVIRONMENT === "PRODUCTION") {
              postRojTweet(toPost);
            }
            console.log(toPost);
          });
        })
      });
    });
  })();
}

const runDLeague = () => {
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();

    const sheets = doc.sheetsById;
    const dLeagueEvents = sheets[sheetIds.dLeague];
    const players = sheets[sheetIds.players];
    const retiredPlayers = sheets[sheetIds.retiredPlayers];


    const rojUpdates = sheets[sheetIds.updates]; 

    const playerRows = await players.getRows();
    const retiredPlayers = await retiredPlayers.getRows();
    const dLeagueWeights = await dLeagueEvents.getRows().map(rows => {
      return rows.map(row => {
        return {
          id: row.event,
          weight: parseInt(row.prob)
        };
      });
    });

    const event = rwc(dLeagueWeights);
    
    const playersToUse = playerRows.filter(player => !!player["D League"]);
    const chosenPlayer = _.sample(playersToUse);
    const retiree = _.sample(retiredPlayers);

    const status = dLeagueRoulette(event, chosenPlayer, retiree, rojUpdates);
    status.then(toPost => {
      if (process.env.ENVIRONMENT === "PRODUCTION") {
        postRojTweet(toPost);
      }
      console.log(toPost);
    });

  })();
};

async function dLeagueRoulette(event, player, retiree, rojUpdatesSheet) {
  const { fn } = dLeagueEvents[event];
  const date = new Date().toLocaleString().split(",")[0];
  const quote = fn({player, retiree});
  quote = fn(player, playerTwo, retiree);
    if (process.env.ENVIRONMENT !== "DEVELOPMENT") {
      await rojUpdatesSheet.addRow({
        Date: date,
        Player: player.Name,
        "Current Team": `=VLOOKUP("${player.Name}", 'Player List'!$A$1:$P, 6, FALSE)`,
        Team: player.Team,
        Event: event,
        Tweet: quote
      });
    }
  return quote;
};

async function newsRoulette(event, player, playerTwo, retiree, rojUpdatesSheet) {
  let quote = "no news today";
  const { valid, fn } = rojEvents[event];
  const date = new Date().toLocaleString().split(",")[0];
  quote = fn(player, playerTwo, retiree);
    if (process.env.ENVIRONMENT !== "DEVELOPMENT" && !!valid) {
      await rojUpdatesSheet.addRow({
        Date: date,
        Player: player.Name,
        "Current Team": `=VLOOKUP("${player.Name}", 'Player List'!$A$1:$P, 6, FALSE)`,
        Team: player.Team,
        Event: event,
        Tweet: quote
      });
    }
  return quote;
};

const upToNum = num => {
  return Math.ceil(Math.random() * num);
};

const randomFloor = num => {
  return Math.floor(Math.random() * num);
};

const randomHotZone = () => {
  const zones = [
    "Under Basket",
    "Close Left",
    "Close Middle",
    "Close Right",
    "Mid Left",
    "Mid Left-Center",
    "Mid Center",
    "Mid Right-Center",
    "Mid Right",
    "Three Left",
    "Three Left-Center",
    "Three Middle",
    "Three Right-Center",
    "Three Right"
  ];

  return chooseOne(zones);
};

const randomTrait = () => {
  const traits = [
    {
      id: "Finishing",
      value: 5
    },
    {
      id: "Shooting",
      value: 5
    },
    {
      id: "Playmaking",
      value: 5
    },
    {
      id: "Handles",
      value: 5
    },
    {
      id: "Post Game",
      value: 5
    },
    {
      id: "Stocks",
      value: 5
    },
    {
      id: "Defense",
      value: 5
    },
    {
      id: "Rebounding",
      value: 5
    },
    {
      id: "Athleticism",
      value: 5
    },
    {
      id: "Conditioning",
      value: 5
    },
    {
      id: "Strength",
      value: 5
    },
    {
      id: "Strength",
      value: 5
    },
    {
      id: "Weight",
      value: 10
    },
  ];

  return chooseOne(traits);
};

const randomBadge = () => {
  const badges = [
    "Extremely Confident",
    "Enforcer",
    "Unpredictable",
    "Alpha Dog",
    "Team Player",
    "Acrobat",
    "Tear Dropper",
    "Relentless Finisher",
    "Post Spin Technician",
    "Drop Stepper",
    "Putback Boss",
    "Backdown Punisher",
    "Consistent Finisher",
    "Contact Finisher",
    "Cross-key Scorer",
    "Deep Hooker",
    "Pick and Roller",
    "Fancy Footwork",
    "Fastbreak Finisher",
    "Giant Slayer",
    "Pro Touch",
    "ShowTime",
    "Slithery Finisher",
    "Catch and Shooter",
    "Corner Specialist",
    "Difficult Shots",
    "Pick and Popper",
    "Clutch Shooter",
    "Deadeye",
    "Deep Fades",
    "Flexible Release",
    "Green Machine",
    "Hot Zone Hunter",
    "Hot Starter",
    "Ice In Veins",
    "Pump Faker",
    "Quick Draw",
    "Range Extender",
    "Slippery Off Ball",
    "Steady Shooter",
    "Tireless Shooter",
    "Volume Shooter",
    "Ankle Breaker",
    "Flashy Passer",
    "Break Starter",
    "Lob City Passer",
    "Dimer",
    "Bail Out",
    "Downhill",
    "Dream Shake",
    "Handles for Days",
    "Needle Threader",
    "Pass Faker",
    "Quick First Stepper",
    "Space Creator",
    "Stop & Go",
    "Tight Handles",
    "Unpluckable",
    "Floor General",
    "Pick Pocket",
    "Rim Protector",
    "Pick Dodger",
    "Chase Down Artist",
    "Clamps",
    "Defensive Leader",
    "Heart Crusher",
    "Interceptor",
    "Intimidator",
    "Moving Truck",
    "Off Ball Pest",
    "Pogo Stick",
    "Post Move Lockdown",
    "Tireless Defender",
    "Trapper",
    "Lob City Finisher",
    "Brick Wall",
    "Box",
    "Rebound Chaser",
    "Worm"
  ];

  return chooseOne(badges);
};

const randomCause = () => {
  const causes = [
    "Black Lives Matter",
    "LGBT Rights",
    "Education Reform",
    "Voting",
    "Cancer Research",
    "Affordable Healthcare",
    "Prison Reform",
    "Homelessness"
  ];

  return chooseOne(causes);
};

const chooseOne = choices => {
  return choices[Math.floor(Math.random() * choices.length)];
};

module.exports = { runRoj, runDLeague };
