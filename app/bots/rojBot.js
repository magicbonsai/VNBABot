const { postRojTweet, postSmithyTweet } = require("../helpers/tweetHelper");
const { sheetIds } = require("../helpers/sheetHelper");
const fetch = require("node-fetch");
const generatePlayer = require("../helpers/playerGenerator");
require("dotenv").config();

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(
  "1INS-TKERe24QAyJCkhkhWBQK4eAWF8RVffhN1BZNRtA"
);
const rwc = require("random-weighted-choice");
const faker = require("faker");
faker.setLocale("en");

const playerTypes = ["guard", "wing", "big"];


function runRoj(setTweet) {
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();

    const sheets = doc.sheetsById;
    const news = sheets[sheetIds.news];
    const players = sheets[sheetIds.players];
    const rojUpdates = sheets[sheetIds.updates];
    
    // Using environmentVariables to set valid teams for tweets (maybe this should be sheets) (AZ)
    const validTeams = (process.env.VALID_TEAMS || []).split(',');


    const getVNBANewsWeights = news.getRows().then(rows => {
      return rows.map(row => {
        return {
          id: row.event,
          weight: parseInt(row.prob)
        };
      });
    });

    getVNBANewsWeights.then(newsWeights => {
      players.getRows().then(playerRows => {
        const filteredPlayers = playerRows.filter(
          player => validTeams.includes(player.Team)
        );

        const chosenNum = randomFloor(filteredPlayers.length - 1);
        const chosenNumTwo = randomFloor(filteredPlayers.length - 1);
        const chosen = filteredPlayers[chosenNum];
        const chosenTwo = filteredPlayers[chosenNumTwo];
        const result = setTweet || rwc(newsWeights);
        const status = newsRoulette(result, chosen, chosenTwo, rojUpdates);
        status.then(toPost => {
          process.env.ENVIRONMENT === "DEVELOPMENT"
            ? console.log(toPost)
            : postRojTweet(toPost);
        });
      });
    });
  })();
}

const rojEvents = {
  // Injuries

  Flu: {
    valid: true,
    fn: function(player) {
      // logic goes here
      return `It appears that ${
        player.Name
      } has been ill with the flu an will now miss the next ${upToNum(2)} games.`;
    }
  },

  "Torn ACL": {
    valid: true,
    fn: function(player) {
      return `BREAKING: ${player.Name} of the ${player.Team} has tragically suffered a torn ACL and is now expected to sit out the rest of the season.\
      The ${player.Team} organization will work with ${player.Name} during the remainder of his season in rehab.`;
    }
  },

  "Back Spasms": {
    valid: true,
    fn: function(player) {
      return `BREAKING: ${player.Name} of the ${
        player.Team
      } has reportedly been dealing with back spasms and is expected to miss the next ${upToNum(
        3
      )} games as he recovers.`;
    }
  },

  "Missed Practice": {
    valid: true,
    fn: function(player) {
      return `${player.Name} of the ${
        player.Team
      } has reportedly missed the last ${
        player.Team
      } practice session and has been internally suspended for ${upToNum(
        2
      )} games by the ${player.Team} organization.`;
    }
  },

  "Failed Drug Test": {
    valid: true,
    fn: function(player) {
      return `BREAKING: ${player.Name} of the ${
        player.Team
      } has reportedly tested positive for PEDs and has been suspended by the NBA for ${upToNum(
        4
      )} games by the VNBA.`;
    }
  },

  concussion: {
    valid: true,
    fn: function(player) {
    return `${player.Name} of the ${
      player.Team
    } has been placed in the VNBA concussion protocal and is expected to miss the next ${upToNum(
      3
    )} games as he recovers.`;
  }
},

  "Sore Hamstring": {
    valid: true,
    fn: function(player) {
      return `${player.Name} of the ${
        player.Team
      } has been been suffering from a sore hamstring and is ruled out of games for the next ${upToNum(
        2
      )} games as he recovers.`;
    }
  },

  childbirth: {
    valid: true,
    fn: function(player) {
      return `Congratulations to ${player.Name} of the ${
        player.Team
      } for the birth of his ${chooseOne(["son", "daughter"])}. ${
        player.Name
      } will take the next ${upToNum(2)} games off to be with his child.`;
    }
  },

  // New FA

  "New FA": {
    valid: true,
    fn: function() {
    
      return `${faker.name.firstName(
        0
      )} ${faker.name.lastName()}, who has been playing basketball in the country of\
      ${faker.address.country()}, has officially declared for the VNBA season ${process.env.SEASON + 1} draft.`;
    }
  },

  // Draft Prospect 

  draft: {
    valid: true,
    fn: async function() {
      const type = chooseOne(playerTypes) || playerTypes[0];
      const player = await generatePlayer(type, true);
      const { height, weight, name } = player || {};
      return `Standing at ${height} and weighing ${weight} pounds, ${name}, a ${type} has declared for the VNBA ${process.env.SEASON + 1} draft. `;
    }
  },

  meme: {
    valid: true,
    fn: function() {
      return `${faker.name.firstName(
        0
      )} ${faker.name.lastName()}, from the MEME-League, has officially declared that he will be entering the VNBA as a free agent.`;
    }
  },

  // Boosts

  boost: {
    valid: true,
    fn: function(player) {
      return `Interesting development, ${player.Name} of the ${
        player.Team
      } has been putting in extra work at the gym to improve his ${randomTrait()}. (+5)`;
    }
  },

  badge: {
    valid: true,
    fn: function(player) {
      return `According to sources, ${player.Name} of the ${
        player.Team
      } has been aiming to earn a role within his team. The role? ${randomBadge()}.`;
    }
  },

  hotzone: {
    valid: true,
    fn: function(player) {
      return `According to sources, ${player.Name} of the ${player.Team} has been shooting hot under this zone: ${randomHotZone()}`
    }
  },

  // Miscellaneous

  "Trade Request": {
    valid: true,
    fn: function(player) {
      return `BREAKING: ${player.Name} of the ${
        player.Team
      } has reportedly been unhappy with the ${
        player.Team
      } organization for some time now and has now formally requested a trade to a new team. The ${
        player.Team
      } are expected to move ${player.Name} within the next ${upToNum(6)} games.`;
    }
  },

  number: {
    valid: true,
    fn: function(player) {
      return `I'm hearing that ${player.Name} of the ${
        player.Team
      } has decided to change his Jersey number to ${randomFloor(99)}.`;
    }
  },

  budget: {
    valid: true,
    fn: function(player) {
      return `With some sly budgeting, the ${
        player.Team
      } have managed to find an extra ${upToNum(5)} dollars for this season.`;
    }
  },

  hotspot: {
    valid: true,
    fn: function(player) {
      return `I'm hearing from sources that the ${player.Team} have become the VNBA's hotspot for free agents. Must be a great place to play!`;
    }
  },

  growth: {
    valid: true,
    fn: function(player) {
      return `In a shocking turn of events, ${player.Name} of the ${player.Team} apparently grown an inch since entering the VNBA!`;
    }
  },

  // Inconsequential

  advice:{ 
    valid: false,
    fn: async function(player) {
      return `Yesterday I sat down with ${player.Name} of the ${
        player.Team
      } and he shared a few words of wisdom: ${await fetch(
        "https://api.adviceslip.com/advice"
      )
        .then(response => response.json())
        .then(obj => obj.slip.advice)} Well said ${player.Name}.`;
    }
  },

  saoty: {
    valid: false,
    fn: function(player) {
      return `Standing at ${player.Height} tall, and weighing ${player.Weight} pounds,\
      ${player.Name} has been named Maxim's Sexiest VNBA Player of the Year. Congratulations to him and his beautiful face.`;
    }
  },

  interview: { 
    valid: false,
    fn: async function(player) {
      return `The ${player.Team}, ${
        player.Name
      }'s postgame statement: ${await fetch(
        "https://sports-autogen.herokuapp.com/gen"
      )
        .then(response => response.json())
        .then(obj => obj)}.`;
    }
  },

  activity: {
    valid: false,
    fn: async function(player) {
      return `Yesterday on the RojPod I got to learn more about the personal life of the ${
        player.Team
      }' ${player.Name}. He said that when he's not on the court, ${
        player.Name
      } is using his time to '${await fetch(
        "http://www.boredapi.com/api/activity/"
      )
        .then(response => response.json())
        .then(obj => obj.activity)}'. What an interesting guy!`;
    }
  },

  meal: {
    valid: false,
    fn: async function(player) {
      return `Last night on the RojPod I got to learn more about the diet of the ${
        player.Team
      }' ${
        player.Name
      }. He said his secret to a fit body was one meal: '${await fetch(
        "https://www.themealdb.com/api/json/v1/1/random.php"
      )
        .then(response => response.json())
        .then(
          obj => obj.meals[0].strMeal
        )}'. He says that some days, it's all he eats!`;
    }
  },

  friend: {
    valid: false,
    fn: function(player, playerTwo) {
      return `In an interview with ${player.Name} of the ${player.Team}, I asked if there was anyone in the league that he considers a true friend. 
      '${playerTwo.Name} is my boy, we've been close ever since the first time we played. I can safetly say that he is my closest friend`;
    }
  },

  cause: {
    valid: false,
    fn: function(player, playerTwo) {
      return `${player.Name} and ${
        playerTwo.Name
      } are two players lending their voices to one important cause: ${randomCause()}.`;
    }
  },

  compliment: {
    valid: false,
    fn: async function(player, playerTwo) {
      //todo
    }
  },

  enemy: {
    valid: false,
    fn: async function(player, playerTwo) {
      return `In a league where emotions flare, ${player.Name} of the ${
        player.Team
      } had a few words for ${playerTwo.Name} of the ${
        playerTwo.Team
      }: '${await fetch(
        "https://insult.mattbas.org/api/insult.json"
      )
        .then(response => response.json())
        .then(obj => obj.insult)}'`;
    }
  }
};

async function newsRoulette(event, player, playerTwo, rojUpdatesSheet) {
  let quote = "no news today";
  const {valid, fn} = rojEvents[event];
  const date = new Date().toLocaleString().split(",")[0];
  quote = fn(player, playerTwo);

  if (process.env.ENVIRONMENT !== "DEVELOPMENT" && !!valid) {
    await rojUpdatesSheet.addRow({
      Date: date,
      Player: player.Name,
      Team: player.Team,
      Event: event,
      Tweet: quote
    });
  }

  return quote;
}

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
    "Three Right",
  ];

  return chooseOne(zones);
};

const randomTrait = () => {
  const traits = [
    "Finishing",
    "Shooting",
    "Playmaking",
    "Handles",
    "Post Game",
    "Stocks",
    "Defense",
    "Rebounding",
    "Athleticism",
    "Conditioning",
    "Strength",
    "Consistency",
    "Weight"
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
    "Post Spinner",
    "Drop Stepper",
    "Putback Boss",
    "Backdown Finisher",
    "Consistent Finisher",
    "Contact Finisher",
    "Cross-keyer",
    "Deep Hooker",
    "Pick Roller",
    "Fancy Feet",
    "Fastbreak Finisher",
    "Giant Slayer",
    "Pro Touch",
    "ShowTime",
    "Slithery Finisher",
    "Catch and Shooter",
    "Corner Specialist",
    "Difficult Shooter",
    "Pick Popper",
    "Clutch",
    "Deadeye",
    "Deep Fade",
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
    "Downhill Starter",
    "Dream Shaker",
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
    "Lighning Relexes",
    "Moving Truck",
    "Off Ball Pest",
    "Pogo Stick",
    "Post Move Lock",
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

module.exports = runRoj;
