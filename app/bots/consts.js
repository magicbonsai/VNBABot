const generatePlayer = require("../helpers/playerGenerator");
const fetch = require("node-fetch");
const _ = require("lodash");
require("dotenv").config();

const playerTypes = ["guard", "wing", "big"];

const rojEvents = {
  // Injuries

  Flu: {
    valid: true,
    fn: function(player) {
      // logic goes here
      return `It appears that ${
        player.Name
      } has been ill with the flu an will now miss the next ${upToNum(
        2
      )} games.`;
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
      ${faker.address.country()}, has officially declared for the VNBA season ${process
        .env.SEASON + 1} draft.`;
    }
  },

  // Draft Prospect

  draft: {
    valid: false,
    fn: async function() {
      const type = chooseOne(playerTypes) || playerTypes[0];
      const player = await generatePlayer(type, true);
      const { height, weight, wingspan, name } = player || {};
      return `Standing at ${height} with a wingspan of ${wingspan}, and weighing ${weight} pounds, ${name}, a ${type} has declared for the VNBA season ${process.env.SEASON} draft. `;
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
      const { id, value } = randomTrait();
      return `Interesting development, ${player.Name} of the ${
        player.Team
      } has been putting in extra work at the gym to improve his ${id}. (+${value})`;
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
      return `According to sources, ${player.Name} of the ${
        player.Team
      } has been shooting hot under this zone: ${randomHotZone()}`;
    }
  },

  signaturepackage: {
    valid: true,
    fn: function(player, playerTwo, retiree) {
      return `It sounds like ${player.Name} of the ${
        player.Team
      } has been reaching out to retired player ${
        retiree.Name
      } to potentially rework his ${_.sample(['shooting form', 'layup package', 'dribbling package'])}.`
    }
  },

  retiredbadge: {
    valid: true,
    fn: function(player, playerTwo, retiree) {
      return `Retired player ${retiree.Name} has reportedly been mentoring ${
        player.Name
      } of the ${
        player.Team
      } in one of their Hall of Fame worthy skills. (+1 badge level from the retired players HOF badges)`
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
      } are expected to move ${player.Name} within the next ${upToNum(
        3
      )} games.`;
    }
  },

  "Player Dispute": {
    valid: true,
    fn: function(player, playerTwo) {
      return `BREAKING: ${
        player.Name
      } and ${
        playerTwo.Name
      } of the ${
        player.Team
      } have reportedly cited irreconcilable differences with each other and will refuse to play within the next ${
        upToNum(3)
      } games unless one or the other is traded before that deadline.`;
    },
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

  wingspan: {
    valid: true,
    fn: function(player) {
      return `Incredibly shocking news, ${player.Name} of the ${player.Team} has reportedly seen a remarkable increase to his wingspan! Astonishing! (+5 on the wingspan slider in player body)`
    }
  },

  // Inconsequential

  advice: {
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
      }: '${await fetch("https://insult.mattbas.org/api/insult.json")
        .then(response => response.json())
        .then(obj => obj.insult)}'`;
    }
  }
};

const dLeagueEvents = {
  boost: {
    valid: true,
    fn: function({player}) {
      const { id, value } = randomTrait();
      return `Interesting development, ${player.Name} of the ${
        player.Team
      } has been putting in extra work at the gym to improve his ${id}. (+${value})`;
    }
  },

  badge: {
    valid: true,
    fn: function({player}) {
      return `According to sources, ${player.Name} of the ${
        player.Team
      } has been aiming to earn a role within his team. The role? ${randomBadge()}.`;
    }
  },

  hotzone: {
    valid: true,
    fn: function({player}) {
      return `According to sources, ${player.Name} of the ${
        player.Team
      } has been shooting hot under this zone: ${randomHotZone()}`;
    }
  },

  signaturepackage: {
    valid: true,
    fn: function({player, playerTwo, retiree}) {
      return `It sounds like ${player.Name} of the ${
        player.Team
      } has been reaching out to retired player ${
        retiree.Name
      } to potentially rework his ${_.sample(['shooting form', 'layup package', 'dribbling package'])}.`
    }
  },

  retiredbadge: {
    valid: true,
    fn: function({player, playerTwo, retiree}) {
      return `Retired player ${retiree.Name} has reportedly been mentoring ${
        player.Name
      } of the ${
        player.Team
      } in one of their Hall of Fame worthy skills. (+1 badge level from the retired players HOF badges)`
    }
  },
  growth: {
    valid: true,
    fn: function({player}) {
      return `In a shocking turn of events, ${player.Name} of the ${player.Team} apparently grown an inch since entering the VNBA!`;
    }
  },

  wingspan: {
    valid: true,
    fn: function({player}) {
      return `Incredibly shocking news, ${player.Name} of the ${player.Team} has reportedly seen a remarkable increase to his wingspan! Astonishing! (+5 on the wingspan slider in player body)`
    }
  },
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

module.exports = { rojEvents, dLeagueEvents, randomCause, randomBadge, randomHotZone, randomTrait, };