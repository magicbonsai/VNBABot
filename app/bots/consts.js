const generatePlayer = require("../helpers/playerGenerator");
const fetch = require("node-fetch");
const rwc = require("random-weighted-choice");
const _ = require("lodash");
const { parse } = require("dotenv");
const { keys } = require("lodash");
require("dotenv").config();

const playerTypes = ["guard", "wing", "big"];

// we need to add a multiplier to certain changes
// attributes are actually stored as a value from 25 - 222, where
// 3 points = 1 attribute point in the game itself.

// upperBound will constrain changes to the maximum the key allows.

const tabMap = {
  ATTRIBUTES: {
    multiplier: 3,
    upperBound: 222,
    lowerBound: 0
  },
  BADGES: {
    multiplier: 1,
    upperBound: 5,
    lowerBound: 0
  },
  HOTZONE: {
    multiplier: 1,
    upperBound: 2,
    lowerBound: 0
  },
  TENDENCIES: {
    multiplier: 1,
    upperBound: 100,
    lowerBound: 0
  },
  VITALS: {
    multipler: 1,
    upperBound: 350,
    lowerBound: 150
  }
};

// Return a list of keys on a data Tab that have hit the maximum or minimum value.
const toKeysWithCappedValues = (playerRow, tabKey, specificData) => {
  const { Data } = playerRow;
  const { upperBound } = tabMap[tabKey] || {};
  const valuesFromJSON = specificData ?? JSON.parse(Data);
  const selectedTab = valuesFromJSON.find(page => page.tab === tabKey);
  const vitals = valuesFromJSON.find(page => page.tab === "VITALS").data;
  const data = selectedTab.data;

  const playerHeightInInches = Math.round(vitals["HEIGHT_CM"] / 2.54);
  const baseHeightInInches = 79;
  const baseAthleticismAttr = 88;
  const capDiff = baseHeightInInches - playerHeightInInches;
  const maxAthleticismValue = (baseAthleticismAttr + capDiff - 25) * 3;

  const athleticismCaps = {
    SPEED: maxAthleticismValue,
    SPEED_WITH_BALL: maxAthleticismValue,
    ACCELERATION: maxAthleticismValue
  };

  const heightBadgeFilters = ["GIANT_SLAYER"];

  return Object.entries(data).reduce((acc, curr) => {
    const [key, value] = curr;
    if (
      Object.keys(athleticismCaps).includes(key) &&
      parseInt(value) >= maxAthleticismValue
    ) {
      return [...acc, key];
    } else if (playerHeightInInches > 75 && heightBadgeFilters.includes(key)) {
      return [...acc, key];
    } else if (parseInt(value) == upperBound) {
      return [...acc, key];
    } else {
      return acc;
    }
  }, []);
};

const toKeysWithMinValues = (playerRow, tabKey, specificData) => {
  const { Data } = playerRow;
  const { lowerBound } = tabMap[tabKey] || {};
  const valuesFromJSON = specificData ?? JSON.parse(Data);
  const selectedTab = valuesFromJSON.find(page => page.tab === tabKey);
  const data = selectedTab.data;
  return Object.entries(data).reduce((acc, curr) => {
    const [key, value] = curr;
    if (parseInt(value) == lowerBound) {
      return [...acc, key];
    } else {
      return acc;
    }
  }, []);
};

const choosePlayerByAge = players => {
  const playerToWeightMap = players.map(player => {
    return {
      id: player.Name,
      weight: 1 / player.Age
    };
  });
  const playerId = rwc(playerToWeightMap);
  return players.find(player => player.Name === playerId);
};

// TODO: For all development events and injury events remap everything to return
// an {
//   updateKey
//   messageString
// }
// Map all the other events to also at least return an object w/ messageString for parity

const rojEvents = {
  // New FA

  "New FA": {
    valid: true,
    fn: function () {
      return `${faker.name.firstName(
        0
      )} ${faker.name.lastName()}, who has been playing basketball in the country of\
      ${faker.address.country()}, has officially declared for the VNBA season ${
        process.env.SEASON + 1
      } draft.`;
    }
  },

  // Draft Prospect

  draft: {
    valid: false,
    fn: async function () {
      const type = chooseOne(playerTypes) || playerTypes[0];
      const player = await generatePlayer(type, true);
      const { height, weight, wingspan, name } = player || {};
      return `Standing at ${height} with a wingspan of ${wingspan}, and weighing ${weight} pounds, ${name}, a ${type} has declared for the VNBA season ${process.env.SEASON} draft. `;
    }
  },

  meme: {
    valid: true,
    fn: function () {
      return `${faker.name.firstName(
        0
      )} ${faker.name.lastName()}, from the MEME-League, has officially declared that he will be entering the VNBA as a free agent.`;
    }
  },

  // Boosts

  boost: {
    valid: true,
    fn: function (player, isDecline) {
      const keysToFilter = isDecline
        ? toKeysWithMinValues(player, "ATTRIBUTES")
        : toKeysWithCappedValues(player, "ATTRIBUTES");
      const datem = randomAttribute(keysToFilter);
      // const datem = randomAttributeWithoutFilter();
      const { key, data: { name, value } = {} } = datem;
      const messageString = `**${
        player.Name
      }** ${boostEvents()} (${name} +${value})`;
      return {
        type: "ATTRIBUTES",
        updateKey: {
          key,
          value
        },
        messageString
      };
    },
    selectionFn: choosePlayerByAge
  },

  badge: {
    valid: true,
    fn: function (player, isDecline) {
      const keysToFilter = isDecline
        ? toKeysWithMinValues(player, "BADGES")
        : toKeysWithCappedValues(player, "BADGES");
      const datem = randomBadge(keysToFilter);
      // const datem = randomBadgeWithoutFilter();
      const { key, data: { name, value } = {} } = datem;
      const messageString = `**${player.Name}** ${boostEvents()} (${name} +1).`;
      return {
        type: "BADGES",
        updateKey: {
          key,
          value
        },
        messageString
      };
    },
    selectionFn: choosePlayerByAge
  },

  hotzone: {
    valid: true,
    fn: function (player, isDecline) {
      const keysToFilter = isDecline
        ? toKeysWithMinValues(player, "HOTZONE")
        : toKeysWithCappedValues(player, "HOTZONE");
      const datem = randomHotZone(keysToFilter);
      // const datem = randomHotZoneWithoutFilter();
      const { key, data: { name, value } = {} } = datem;
      const messageString = `**${player.Name}** has been shooting hot under this zone: ${name}`;
      return {
        type: "HOTZONE",
        updateKey: {
          key,
          value
        },
        messageString
      };
    },
    selectionFn: players => {
      const playerToWeightMap = players.map(player => {
        return {
          id: player.Name,
          weight: 1 / player.Age
        };
      });
      const playerId = rwc(playerToWeightMap);
      return players.find(player => player.Name === playerId);
    }
  },

  signaturepackage: {
    valid: true,
    fn: function (player, playerTwo, retiree) {
      return `It sounds like ${player.Name} of the ${
        player.Team
      } has been reaching out to retired player ${
        retiree.Name
      } to potentially rework his ${_.sample([
        "shooting form",
        "layup package",
        "dribbling package"
      ])}.`;
    }
  },

  retiredbadge: {
    valid: true,
    fn: function (player, playerTwo, retiree) {
      return `Retired player ${retiree.Name} has reportedly been mentoring ${player.Name} of the ${player.Team} in one of their Hall of Fame worthy skills. (+1 badge level from the retired players HOF badges)`;
    },
    selectionFn: choosePlayerByAge
  },

  // Miscellaneous

  "Trade Request": {
    valid: true,
    fn: function (player) {
      return `BREAKING: ${player.Name} of the ${
        player.Team
      } has reportedly been unhappy with the ${
        player.Team
      } organization for some time now and has now formally requested a trade to a new team. The ${
        player.Team
      } are expected to move ${player.Name} within the next ${_.random(
        1,
        3
      )} games.`;
    }
  },

  "Player Dispute": {
    valid: true,
    fn: function (player, playerTwo) {
      return `BREAKING: ${player.Name} and ${playerTwo.Name} of the ${
        player.Team
      } have reportedly cited irreconcilable differences with each other and will refuse to play within the next ${_.random(
        1,
        3
      )} games unless one or the other is traded before that deadline.`;
    }
  },

  number: {
    valid: true,
    fn: function (player) {
      return `I'm hearing that ${player.Name} of the ${
        player.Team
      } has decided to change his Jersey number to ${randomFloor(99)}.`;
    }
  },

  budget: {
    valid: true,
    fn: function (player) {
      const value = _.random(1, 3);
      const messageString = `With some sly budgeting, the ${player.Team} have managed to find an extra ${value} dollars for this season.`;
      return {
        type: "ASSETS",
        updateKey: {
          key: "Cash",
          value
        },
        messageString
      };
    }
  },

  hotspot: {
    valid: true,
    fn: function (player) {
      return `I'm hearing from sources that the ${player.Team} have become the VNBA's hotspot for free agents. Must be a great place to play!`;
    }
  },

  growth: {
    valid: true,
    fn: function (player) {
      const messageString = `In a shocking turn of events, **${player.Name}** apparently grown an inch since entering the VNBA!`;
      return {
        type: "MANUAL",
        updateKey: {
          key: "height",
          value: {
            name: player.Name,
            infoString: "Increase player height by 1 inch."
          }
        },
        messageString
      };
    },
    selectionFn: choosePlayerByAge
  },

  wingspan: {
    valid: true,
    fn: function (player) {
      const messageString = `Incredibly shocking news, **${player.Name}** has reportedly seen a remarkable increase to his wingspan! Astonishing!`;
      return {
        type: "MANUAL",
        updateKey: {
          key: "wingspan",
          value: {
            name: player.Name,
            infoString: "(+5 on the wingspan slider in player body)"
          }
        },
        messageString
      };
    },
    selectionFn: choosePlayerByAge
  },

  // Inconsequential

  advice: {
    valid: false,
    fn: async function (player) {
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
    fn: function (player) {
      return `Standing at ${player.Height} tall, and weighing ${player.Weight} pounds,\
      ${player.Name} has been named Maxim's Sexiest VNBA Player of the Year. Congratulations to him and his beautiful face.`;
    }
  },

  interview: {
    valid: false,
    fn: async function (player) {
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
    fn: async function (player) {
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
    fn: async function (player) {
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
    fn: function (player, playerTwo) {
      return `In an interview with ${player.Name} of the ${player.Team}, I asked if there was anyone in the league that he considers a true friend. 
      '${playerTwo.Name} is my boy, we've been close ever since the first time we played. I can safetly say that he is my closest friend`;
    }
  },

  cause: {
    valid: false,
    fn: function (player, playerTwo) {
      return `${player.Name} and ${
        playerTwo.Name
      } are two players lending their voices to one important cause: ${randomCause()}.`;
    }
  },

  compliment: {
    valid: false,
    fn: async function (player, playerTwo) {
      //todo
    }
  },

  enemy: {
    valid: false,
    fn: async function (player, playerTwo) {
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

const injuryEvents = {
  // Injuries

  Flu: {
    valid: true,
    fn: function (player) {
      // logic goes here
      return `It appears that ${
        player.Name
      } has been ill with the flu an will now miss the next ${_.random(
        1,
        2
      )} games.`;
    }
  },

  "Torn ACL": {
    valid: true,
    fn: function (player) {
      return `BREAKING: ${player.Name} of the ${player.Team} has tragically suffered a torn ACL and is now expected to sit out the rest of the season.\
      The ${player.Team} organization will work with ${player.Name} during the remainder of his season in rehab.`;
    }
  },

  "Back Spasms": {
    valid: true,
    fn: function (player) {
      return `BREAKING: ${player.Name} of the ${
        player.Team
      } has reportedly been dealing with back spasms and is expected to miss the next ${_.random(
        1,
        3
      )} games as he recovers.`;
    }
  },

  "Missed Practice": {
    valid: true,
    fn: function (player) {
      return `${player.Name} of the ${
        player.Team
      } has reportedly missed the last ${
        player.Team
      } practice session and has been internally suspended for ${_.random(
        1,
        2
      )} games by the ${player.Team} organization.`;
    }
  },

  "Failed Drug Test": {
    valid: true,
    fn: function (player) {
      return `BREAKING: ${player.Name} of the ${
        player.Team
      } has reportedly tested positive for PEDs and has been suspended by the NBA for ${_.random(
        1,
        4
      )} games by the VNBA.`;
    }
  },

  concussion: {
    valid: true,
    fn: function (player) {
      return `${player.Name} of the ${
        player.Team
      } has been placed in the VNBA concussion protocal and is expected to miss the next ${_.random(
        1,
        3
      )} games as he recovers.`;
    }
  },

  "Sore Hamstring": {
    valid: true,
    fn: function (player) {
      return `${player.Name} of the ${
        player.Team
      } has been been suffering from a sore hamstring and is ruled out of games for the next ${_.random(
        1,
        2
      )} games as he recovers.`;
    }
  },

  childbirth: {
    valid: true,
    fn: function (player) {
      return `Congratulations to ${player.Name} of the ${
        player.Team
      } for the birth of his ${chooseOne(["son", "daughter"])}. ${
        player.Name
      } will take the next ${_.random(1, 2)} games off to be with his child.`;
    }
  }
};

const attributes = {
  Shooting: {
    SHOT_CLOSE: {
      name: "Close Shot",
      value: 5
    },
    "MID-RANGE_SHOT": {
      name: "Mid-Range Shot",
      value: 5
    },
    "3PT_SHOT": {
      name: "Three-Point Shot",
      value: 5
    },
    FREE_THROW: {
      name: "Free Throw",
      value: 5
    },
    SHOT_IQ: {
      name: "Shot IQ",
      value: 5
    }
  },
  Finishing: {
    DRIVING_LAYUP: {
      name: "Layup",
      value: 5
    },
    STANDING_DUNK: {
      name: "Standing Dunk",
      value: 5
    },
    DRIVING_DUNK: {
      name: "Driving Dunk",
      value: 5
    },
    DRAW_FOUL: {
      name: "Draw Foul",
      value: 5
    },
    HANDS: {
      name: "Hands",
      value: 5
    },
    BALL_CONTROL: {
      name: "Ball Handle",
      value: 5
    }
  },
  "Post Game": {
    POST_MOVES: {
      name: "Post Moves",
      value: 5
    },
    POST_FADEAWAY: {
      name: "Post Fadeaway",
      value: 5
    },
    POST_HOOK: {
      name: "Post Hook",
      value: 5
    }
  },
  Defense: {
    INTERIOR_DEFENSE: {
      name: "Interior Defense",
      value: 5
    },
    PERIMETER_DEFENSE: {
      name: "Perimeter Defense",
      value: 5
    },
    STEAL: {
      name: "Steal",
      value: 5
    },
    BLOCK: {
      name: "Block",
      value: 5
    },
    PASS_PERCEPTION: {
      name: "Pass Perception",
      value: 5
    },
    HELP_DEFENSIVE_IQ: {
      name: "Help Defense IQ",
      value: 5
    }
  },
  Athleticism: {
    SPEED: {
      name: "Speed",
      value: 5
    },
    ACCELERATION: {
      name: "Acceleration",
      value: 5
    },
    SPEED_WITH_BALL: {
      name: "Speed with Ball",
      value: 5
    },
    // LATERAL_QUICKNESS: {
    //   name: "Lateral Quickness",
    //   value: 5
    // },
    VERTICAL: {
      name: "Vertical",
      value: 5
    },
    STRENGTH: {
      name: "Strength",
      value: 5
    }
  },
  Playmaking: {
    PASSING_ACCURACY: {
      name: "Pass Accuracy",
      value: 5
    },
    PASSING_IQ: {
      name: "Pass IQ",
      value: 5
    },
    PASSING_VISION: {
      name: "Pass Vision",
      value: 5
    }
  },
  Rebounding: {
    OFFENSIVE_REBOUND: {
      name: "Offensive Rebounding",
      value: 5
    },
    DEFENSIVE_REBOUND: {
      name: "Defensive Rebounding",
      value: 5
    }
  },
  Mental: {
    HUSTLE: {
      name: "Hustle",
      value: 5
    },
    OFFENSIVE_CONSISTENCY: {
      name: "Offensive Consistency",
      value: 5
    },
    DEFENSIVE_CONSISTENCY: {
      name: "Defensive Consistency",
      value: 5
    }
    // INTANGIBLES: {
    //   name: "Intangibles",
    //   value: 5
    // }
  },
  Conditioning: {
    STAMINA: {
      name: "Stamina",
      value: 5
    }
  }
};

const badges = {
  Finishing: {
    ACROBAT: {
      name: "Layup Mixmaster",
      desc: "Increases the ability to finish an alley-oop from a teammate, or putback a finish off an offensive rebound",
      value: 1
    },
    BACKDOWN_PUNISHER: {
      name: "Post Powerhouse",
      desc: "Strengthens a player's ability at backing down defenders and moving them with dropsteps.",
      value: 1
    },
    CONSISTENT_FINISHER: {
      name: "Physical Finisher",
      desc: "Improves a player's ability to battle through contact and convert contact layups.",
      value: 1
    },
    CONTACT_FINISHER: {
      name: "Posterizer",
      desc: "Increases the chances of throwing down a dunk on your defender",
      value: 1
    },
    // "CROSS-KEY_SCORER": {
    //   name: "Cross-Key Scorer",
    //   desc:
    //     "Boosts the ability to make running hooks, layups, or close range pull-ups while driving across the paint.",
    //   value: 0
    // },
    DEEP_HOOKS: {
      name: "Hook Specialist",
      desc: "Improves a player's ability to make post hooks",
      value: 1
    },
    "DROP-STEPPER": {
      name: "Post Up Poet",
      desc: "Raises the chances of faking or getting by the defender, as well as scoring, when performing moves in the post.",
      value: 1
    },
    // FANCY_FOOTWORK: {
    //   name: "Fancy Footwork",
    //   desc:
    //     " players get past defenders more efficiently when performing euro, cradle, hop step, spin, and half-spin gathers.",
    //   value: 0
    // },
    // FASTBREAK_FINISHER: {
    //   name: "Fastbreak Finisher",
    //   desc:
    //     "Gives an additional boost to a player’s takeover meter when successfully dunking on a fastbreak.",
    //   value: 0
    // },
    LOB_CITY_FINISHER: {
      name: "Aerial Wizard",
      desc: "Increases the ability to finish an alley-oop from a teammate, or putback a finish off an offensive rebound",
      value: 1
    },
    // PICK_ROLLER: {
    //   name: "Pick and Roller",
    //   desc:
    //     "When rolling off the pick and roll, a shot boost is applied if the layup or dunk attempt comes within a few seconds after catching the pass.",
    //   value: 0
    // },
    // PRO_TOUCH: {
    //   name: "Pro Touch",
    //   desc:
    //     "Gives an extra shot boost for having slightly early, slightly late, or excellent shot timing on layups.",
    //   value: 0
    // },
    // POST_SPIN_TECHNICIAN: {
    //   name: "Post Up Poet",
    //   desc:
    //     "Raises the chances of faking or getting by the defender, as well as scoring, when performing moves in the post.",
    //   value: 0
    // },
    PUTBACK_BOSS: {
      name: "Aerial Wizard",
      desc: "Increases the ability to finish an alley-oop from a teammate, or putback a finish off an offensive rebound",
      value: 1
    },
    // RELENTLESS_FINISHER: {
    //   name: "Relentless Finisher",
    //   desc:
    //     "Improves a player’s ability to take a lot of contact by reducing the energy lost when attacking the rim for contact shots.",
    //   value: 0
    // },
    // SHOWTIME: {
    //   name: "Showtime",
    //   desc:
    //     "Gives an additional boost to a player’s takeover meter and his teammates, when successfully completing an and-1 or flashy dunk.",
    //   value: 0
    // },
    // SLITHERY_FINISHER: {
    //   name: "Slithery Finisher",
    //   desc:
    //     "Increases a player’s ability to slide through traffic and avoid contact during gathers and finishes at the rim.",
    //   value: 0
    // },
    TEAR_DROPPER: {
      name: "Float Game",
      desc: "Improves a player's ability to make floaters",
      value: 1
    }
  },
  Shooting: {
    CATCH_SHOOT: {
      name: "Set Shot Specialist",
      desc: "Specialist	Boosts chances of knocking down stand-still jump shots.",
      value: 1
    },
    // CLUTCH_SHOOTER: {
    //   name: "Clutch Shooter",
    //   desc:
    //     "Shot attempts that occur during the final moments of the 4th quarter, or in any overtime period, receive a large boost.",
    //   value: 0
    // },
    // CORNER_SPECIALIST: {
    //   name: "Corner Specialist",
    //   desc:
    //     "Deep mid-range or 3pt shots taken along the baseline of the court receive a boost, whether it is off the dribble or off the catch.",
    //   value: 0
    // },
    DEADEYE: {
      name: "Deadeye",
      desc: "Jump shots taken with a defender closing out receive less of a penalty from a shot contest. This includes both mid-range and 3pt shots.",
      value: 1
    },
    DEEP_FADES: {
      name: "Post Fade Phenom",
      desc: "Improves a player's ability to make post fades and hop shots",
      value: 1
    },
    DIFFICULT_SHOTS: {
      name: "Shifty Shooter",
      desc: "Improves a player's ability to successfully make off-the-dribble, high-difficulty jump shots.",
      value: 1
    },
    // FLEXIBLE_RELEASE: {
    //   name: "Flexible Release",
    //   desc:
    //     "Shot timing penalties for jump shots are reduced, making it easier to knock down attempts even when releasing early or late.",
    //   value: 0
    // },
    // GREEN_MACHINE: {
    //   name: "Green Machine",
    //   desc:
    //     "Gives an additional shot boost when consecutively achieving excellent releases on jump shots. ",
    //   value: 0
    // },
    // HOT_START: {
    //   name: "Hot Start",
    //   desc:
    //     "For every made shot from the beginning of the game, players receives a shot attribute bonus that lasts until the first missed shot attempt",
    //   value: 0
    // },
    // HOT_ZONE_HUNTER: {
    //   name: "Hot Zone Hunter",
    //   desc: "Shots that are taken in a player’s hot zone(s) are given a boost",
    //   value: 0
    // },
    // ICE_IN_VEINS: {
    //   name: "Ice in Veins",
    //   desc:
    //     "Free throws taken in the second half of close games or overtime periods are given a boost. Also, the timing window for free throws becomes larger.",
    //   value: 0
    // },
    GIANT_SLAYER: {
      name: "Mini Marksman",
      desc: "Elevates the likelihood of making shots over taller defenders.",
      value: 1
    },
    // PICK_POPPER: {
    //   name: "Pick & Popper",
    //   desc:
    //     "Shot attempts that come after setting a screen are given a boost if the shot happens far enough from the rim and within a few seconds after the screen has been set.",
    //   value: 0
    // },
    // PUMP_FAKE_MAESTRO: {
    //   name: "Pump Fake Maestro",
    //   desc:
    //     "Shortens the timer that determines how long after a pump fake a player can shoot without incurring a shot percentage penalty.",
    //   value: 0
    // },
    // QUICK_DRAW: {
    //   name: "Quick Draw",
    //   desc:
    //     "The higher the badge level, the faster a player will be able to release all jump shots.",
    //   value: 0
    // },
    RANGE_EXTENDER: {
      name: "Limitless Range",
      desc: "Extends the range from which a player can shoot three-pointers effectively from deep",
      value: 1
    },
    "SLIPPERY_OFF-BALL": {
      name: "Slippery Off-Ball",
      desc: "When attempting to get open off screens, the player more effectively navigates through traffic",
      value: 1
    }
    // STEADY_SHOOTER: {
    //   name: "Steady Shooter",
    //   desc:
    //     "Shot attempts that are contested receive less of a penalty, however shot attempts that are open do not receive as much of a bonus.",
    //   value: 0
    // },
    // TIRELESS_SCORER: {
    //   name: "Tireless Shooter",
    //   desc:
    //     "Shot attributes on jump shots suffer a smaller penalty than normal when tired.",
    //   value: 0
    // },
    // VOLUME_SHOOTER: {
    //   name: "Volume Shooter",
    //   desc:
    //     "After a player has taken a small handful of shots, an additional boost to shot attributes is given for ever subsequent shot, whether it’s a make or a miss.",
    //   value: 0
    // }
  },
  Playmaking: {
    ANKLE_BREAKER: {
      name: "Ankle Assassin",
      desc: "Improves the likelihood of freezing or dropping a defender during dribble moves, especially stepback moves or certain chains of dribble moves.",
      value: 1
    },
    BAIL_OUT: {
      name: "Bail Out",
      desc: "Increases the chances of a successful and accurate pass out of a jumpshot or layup while mid-air.",
      value: 1
    },
    BREAK_STARTER: {
      name: "Break Starter",
      desc: "Allows rebounders to throw more effective deep outlet passes shortly following a defensive rebound.",
      value: 1
    },
    DIMER: {
      name: "Dimer",
      desc: "Gives a shooting boost to receivers in catch-and-shoot oppurtunities.",
      value: 1
    },
    // DOWNHILL: {
    //   name: "Downhill",
    //   desc:
    //     " Increases your player’s speed with ball rating on fastbreak opportunities",
    //   value: 0
    // },
    // DREAM_SHAKE: {
    //   name: "Dream Shake",
    //   desc:
    //     "Increases the chances that a defender falls for a pump fake in the post. In addition, your player’s shooting attributes increase after post moves or pump fakes.",
    //   value: 0
    // },
    // FLASHY_PASSER: {
    //   name: "Flashy Passer",
    //   desc:
    //     "Gives a Takeover boost to the passer and receiver after following a made shot off a flashy pass.",
    //   value: 0
    // },
    // FLOOR_GENERAL: {
    //   name: "Floor General",
    //   desc: "Boosts your teammates’ offensive attributes when on the floor.",
    //   value: 0
    // },
    HANDLES_FOR_DAYS: {
      name: "Handles For Days",
      desc: "Allows playmakers and dribbling builds to lose less stamina when chaining dribble moves.",
      value: 1
    },
    // LOB_CITY_PASSER: {
    //   name: "Lob City Passer",
    //   desc:
    //     "Increases the chances of a successful alley-oop pass and finish. It boosts both your player’s passing attribute and the finishing attributes of your receiver.",
    //   value: 0
    // },
    NEEDLE_THREADER: {
      name: "Versatile Visionary",
      desc: "Improves a player's ability to thread and fit tight passes, including alley-oops, quickly and on time.",
      value: 1
    },
    // PASS_FAKE_MAESTRO: {
    //   name: "Pass Fake Maestro",
    //   desc:
    //     "Increases the effectiveness of fake passes by making them quicker and tighter.",
    //   value: 0
    // },
    QUICK_FIRST_STEP: {
      name: "Lightning Launch",
      desc: "Speeds up launches when attacking from the perimeter.",
      value: 1
    },
    // SPACE_CREATOR: {
    //   name: "Space Creator",
    //   desc:
    //     "Boosts your player’s ability to create space from a defender on a step back move or shot.",
    //   value: 0
    // },
    // STOP_GO: {
    //   name: "Stop & Go",
    //   desc:
    //     "Allows ball handlers to quickly stop-and-go while dribbling. You also get unique launch animations on stop-and-gos with this badge.",
    //   value: 0
    // },
    TIGHT_HANDLES: {
      name: "Strong Handle",
      desc: "Reduces the likelihood of being bothered by defenders when dribbling.",
      value: 1
    },
    UNPLUCKABLE: {
      name: "Unpluckable",
      desc: "Makes it more difficult for defenders to steal the ball from your player.",
      value: 1
    }
  },
  "Defense/Rebounding": {
    BOX: {
      name: "Boxout Beast",
      desc: "Improves a player's ability to box out and fight for good rebounding position",
      value: 1
    },
    BRICK_WALL: {
      name: "Brick Wall",
      desc: "This badge makes it tougher for a defense to get through or around screens. Players hit by contact from a brick wall lose more energy than normal.",
      value: 1
    },
    CHASE_DOWN_ARTIST: {
      name: "High Flying Denier",
      desc: "Boosts the speed and leaping ability of a player when he is chasing down an offensive player in anticipation of a block attempt.",
      value: 1
    },
    CLAMPS: {
      name: "Challenger",
      desc: "Improves the effectiveness of well-timed contests against perimeter shooters",
      value: 1
    },
    // DEFENSIVE_STOPPER: {
    //   name: "Defensive Leader",
    //   desc:
    //     "Lifts the defensive ability of teammates when on the court. Also, at the Hall of Fame level, can see potential shot percentages of opposing players.",
    //   value: 0
    // },
    // HEART_CRUSHER: {
    //   name: "Heart Crusher",
    //   desc:
    //     "After successfully blocking or stealing the ball from an opponent, an additional penalty is given to the opposing player’s takeover meter.",
    //   value: 0
    // },
    INTERCEPTOR: {
      name: "Interceptor",
      desc: "The frequency of successfully tipped or intercepted passes greatly increases.",
      value: 1
    },
    INTIMIDATOR: {
      name: "Immovable Enforcer",
      desc: "Improves a defensive player's strength when defending ball handlers and finishers",
      value: 1
    },
    // LIGHTNING_REFLEXES: {
    //   name: "Lightning Reflexes",
    //   desc:
    //     "Gives the defender an advantage to read where the ball handler is going in the Read and React System.",
    //   value: 0
    // },
    // MOVING_TRUCK: {
    //   name: "Moving Truck",
    //   desc:
    //     "Players are more effective pushing opponents out of the post while playing defense.",
    //   value: 0
    // },
    "OFF-BALL_PEST": {
      name: "Off-Ball Pest",
      desc: "Makes players more difficult to get past when playing off-ball, as they can grab and hold their matchup and don’t get their ankles broken as often.",
      value: 1
    },
    PICK_DODGER: {
      name: "Pick Dodger",
      desc: "Improves a player’s ability to navigate through and round screens while on defense.",
      value: 1
    },
    PICK_POCKET: {
      name: "Glove",
      desc: "	Increases the ability to successfully steal from ball-handlers, or strip layup attempts",
      value: 1
    },
    POGO_STICK: {
      name: "Pogo Stick",
      desc: "Allows players to quickly go back for another block attempt upon landing.",
      value: 0
    },
    POST_MOVE_LOCKDOWN: {
      name: "Post Lockdown",
      desc: "Strengthens a player's ability to effectively defend moves in the post, with an increased chance at stripping the opponent",
      value: 1
    },
    REBOUND_CHASER: {
      name: "Rebound Chaser",
      desc: "Improves a player’s ability to track down rebounds from farther distances than normal.",
      value: 1
    },
    RIM_PROTECTOR: {
      name: "Paint Patroller",
      desc: "Increases a player's ability to block or contest shots at the rim.",
      value: 1
    },
    // TIRELESS_DEFENDER: {
    //   name: "Tireless Defender",
    //   desc:
    //     "Allows defenders to play defense more aggressively without losing energy at the same rate as a normal player.",
    //   value: 0
    // },
    TRAPPER: {
      name: "On-Ball Menace",
      desc: "Hounds and bodies up while defending on the perimeter.",
      value: 1
    }
    // WORM: {
    //   name: "Worm",
    //   desc:
    //     "When boxed out, rebounders have more success swimming around and getting into successful rebound position.",
    //   value: 0
    // }
  }
};

const hotzones = {
  "3_LEFT-CENTER": {
    name: "3 Left-Center",
    value: 1
  },
  "3_RIGHT-CENTER": {
    name: "3 Right-Center",
    value: 1
  },
  CENTER_3: {
    name: "3 Center",
    value: 1
  },
  CLOSE_LEFT: {
    name: "Close Left",
    value: 1
  },
  CLOSE_MIDDLE: {
    name: "Close Middle",
    value: 1
  },
  CLOSE_RIGHT: {
    name: "Close Right",
    value: 1
  },
  LEFT_3: {
    name: "3 Left",
    value: 1
  },
  "MID-RANGE_LEFT": {
    name: "Mid-Range Left",
    value: 1
  },
  "MID-RANGE_LEFT_CENTER": {
    name: "Mid-Range Left-Center",
    value: 1
  },
  "MID-RANGE_RIGHT": {
    name: "Mid-Range Right",
    value: 1
  },
  "MID-RANGE_RIGHT_CENTER": {
    name: "Mid-Range Right-Center",
    value: 1
  },
  MID_CENTER: {
    name: "Mid-Range Center",
    value: 1
  },
  RIGHT_3: {
    name: "3 Right",
    value: 1
  },
  UNDER_BASKET: {
    name: "Under Basket",
    value: 1
  }
};

const reducedAttrKeys = Object.keys(attributes).reduce((acc, key) => {
  const attrKeys = Object.keys(attributes[key]);
  return [...acc, ...attrKeys];
}, []);

const reducedBadgeKeys = Object.keys(badges).reduce((acc, key) => {
  const badgeKeys = Object.keys(badges[key]);
  return [...acc, ...badgeKeys];
}, []);

const randomAttribute = (keysToFilter = []) => {
  const filteredKeys = reducedAttrKeys.filter(
    key => !keysToFilter.includes(key)
  );
  const attributeKey = _.sample(filteredKeys);
  const categoryKey = Object.keys(attributes).find(key => {
    const attrKeys = Object.keys(attributes[key]);
    if (attrKeys.includes(attributeKey)) {
      return true;
    }
  });
  return {
    key: attributeKey,
    data: attributes[categoryKey][attributeKey]
  };
};

const randomAttributeWithoutFilter = () => {
  const categoryKey = _.sample(Object.keys(attributes));
  const attributeKey = _.sample(Object.keys(attributes[categoryKey]));
  return {
    key: attributeKey,
    data: attributes[categoryKey][attributeKey]
  };
};

const randomBadge = (keysToFilter = []) => {
  const filteredKeys = reducedBadgeKeys.filter(
    key => !keysToFilter.includes(key)
  );
  if (!filteredKeys.length) {
    return { key: "None" };
  }
  const badgeKey = _.sample(filteredKeys);
  const categoryKey = Object.keys(badges).find(key => {
    const badgeKeys = Object.keys(badges[key]);
    if (badgeKeys.includes(badgeKey)) {
      return true;
    }
  });

  return {
    key: badgeKey,
    data: badges[categoryKey][badgeKey]
  };
};

const randomBadgeWithoutFilter = () => {
  const categoryKey = _.sample(Object.keys(badges));
  const badgeKey = _.sample(Object.keys(badges[categoryKey]));
  return {
    key: badgeKey,
    data: badges[categoryKey][badgeKey]
  };
};

const randomHotZone = (keysToFilter = []) => {
  const filteredKeys = Object.keys(hotzones).filter(
    key => !keysToFilter.includes(key)
  );
  const key = _.sample(filteredKeys);
  return {
    key,
    data: hotzones[key]
  };
};

const randomHotZoneWithoutFilter = () => {
  const key = _.sample(Object.keys(hotzones));
  return {
    key,
    data: hotzones[key]
  };
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

const boostEvents = () => {
  const bEvents = [
    "put up extra shots at the gym.",
    "benched a new record in the weight room.",
    "was the earliest in the gym, and the latest out. What dedication!",
    "discovered the meaning of Christmas.",
    "discovered the meaning of Hanukkah.",
    "found God.",
    "got really into charity work.",
    "adopted a dog.",
    "punched Steven Segal in the face.",
    "donated plasma to help those less fortunate.",
    "ran a new record mile.",
    "saved some children from a burning building.",
    "adopted a cat.",
    "performed an extra set of drills with the coach.",
    "gave an inspiring speech to his fellow teammates.",
    "ended systematic racism.",
    "just sorta took a personal day to improve his own mental health.",
    "won a dance competition.",
    "won Monopoly for the first time.",
    "tended to his garden.",
    "ate his vegetables, all of them.",
    "volunteered to help the homeless in his city.",
    "became an activist in getting others to vote.",
    "used his social media prescence to get others to donate to a good cause.",
    "opened a school in his city.",
    "opened a library in his city.",
    "just worked really hard this week.",
    "put in some extra effort during scrims.",
    "finally watched Lord of the Rings, the extended version.",
    "donated shoes to kids in need.",
    "learned how to dribble with his off hand.",
    "helped assist with the birth of a child.",
    "took his vitamins.",
    "did some leg raises.",
    "did a pushup.",
    "learned how to ride a bike.",
    "solved the conflict between Israel and Palestine.",
    "invented a new way to practice dribble moves.",
    "met Lebron.",
    "tended to some goats.",
    "met MJ.",
    "was just an awesome teammate really.",
    "bribed Alex.",
    "failed to bribe Stan and got really angry so he got better at balling.",
    "got real swole real fast.",
    "learned how to cook.",
    "slept in for the first time.",
    "took acting lessons.",
    "sang the national anthem at the game.",
    "learned how to flop correctly.",
    "got over his fear of flying.",
    "killed it on the dance floor",
    "put the weights back in the weight room.",
    "opened up an orphanage.",
    "did a few jumping jacks.",
    "stretched before practice today.",
    "decided to get his shit together.",
    "got some inspiring words from Coach.",
    "found love in a hopeless place.",
    "just chilled out a bit.",
    "ate a really good sandwich.",
    "read a book.",
    "repaired his car.",
    "gave 110% today.",
    "ate an apple a day and became the enemy of all doctors.",
    "revitalized interest in modern day literature.",
    "won a game of league of legends for the first time.",
    "quit playing league of legends.",
    "streamed on twitch.",
    "won first place in his virtual basketball league, the VVNBA.",
    "broke the internet (in a good way).",
    "missed practice 3 days in a row.",
    "got up to watch the sunrise.",
    "got up just in time to watch the sunset.",
    "did all the exercise.",
    "gave at least 50% today.",
    "tipped well at the local pizzeria.",
    "did a visualization session of winning the championship.",
    "met some GOATS.",
    "had a productive morning.",
    "wrote a novel.",
    "got up early and made his bed too.",
    "diD nOt wRitE TerRiBLe meMEs.",
    "had a salad instead of a burger.",
    "invested in the stock market.",
    "moisturized.",
    "did not accidentally reveal the existence of a shadow society to his friends.",
    "won a drinking contest.",
    "tripped over nothing, but no one was watching so he never tripped in the first place.",
    "ordered a new armchair.",
    `caught a shiny pokemon in Pokemon ${_.sample([
      "Brilliant Diamond",
      "Shining Pearl",
      "Omega Ruby",
      "Alpha Sapphire",
      "Sword",
      "Shield"
    ])}.`,
    "ran at least three miles.",
    "bought a pound of potatos.",
    "sat on a bench with a box of chocolates to wait for the bus.",
    "went on a very enthusiastic walk.",
    "trained really hard and raised his power level above 9000.",
    "learned how to drive manual.",
    "got a new houseplant.",
    "learned about the true meaning of friendship.",
    "had to get back to the past to defeat a great evil.",
    "visited the city of Townsville.",
    "learned about the most efficient way to kill a vampire.",
    "crushed an arch-nemesis w/ a steamroller.",
    "had too much all-you-can-eat sushi.",
    "Added 'Decorative Fruit Bouquet Making' to his resume.",
    "was as swift as a coursing river in practice.",
    "ate an orange to avoid scurvy.",
    "missed every shot in shoot-around.",
    "juggled chainsaws and didn't lose a finger."
  ];

  return chooseOne(bEvents);
};

module.exports = {
  rojEvents,
  injuryEvents,
  tabMap,
  hotzones,
  attributes,
  badges,
  randomAttribute,
  randomBadge,
  randomHotZone,
  toKeysWithCappedValues,
  toKeysWithMinValues
};
