const generatePlayer = require("../helpers/playerGenerator");
const fetch = require("node-fetch");
const rwc = require("random-weighted-choice");
const _ = require("lodash");
require("dotenv").config();

const playerTypes = ["guard", "wing", "big"];

const choosePlayerByAge = players => {
  const playerToWeightMap = players.map(player => {
    return ({
      id: player.Name,
      weight: (1 / player.Age)
    })
  })
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
      const datem = randomAttribute();
      const {
        key,
        data: {
          name,
          value
        } = {},
      } = datem;
      const messageString =  `Interesting development, ${player.Name} of the ${
        player.Team
      } has been putting in extra work at the gym to improve his ${name}. (+${value})`; 
      return ({
        type: 'ATTRIBUTES',
        updateKey: {
          key,
          value,
        },
        messageString,
      });
    },
    selectionFn: choosePlayerByAge
  },

  badge: {
    valid: true,
    fn: function(player) {
      const datem = randomBadge();
      const {
        key,
        data: {
          name,
          value
        } = {},
      } = datem;
      const messageString =  `According to sources, ${player.Name} of the ${
        player.Team
      } has been aiming to earn a role within his team. The role? ${name}.`;
      return ({
        type: 'BADGES',
        updateKey: {
          key,
          value,
        },
        messageString,
      });
    },
    selectionFn: choosePlayerByAge
  },

  hotzone: {
    valid: true,
    fn: function(player) {
      const datem = randomHotZone();
      const {
        key,
        data: {
          name,
          value,
        } = {}
      } = datem;
      const messageString =  `According to sources, ${player.Name} of the ${
        player.Team
      } has been shooting hot under this zone: ${name}`;
      return ({
        type: 'HOTZONE',
        updateKey: {
          key,
          value,
        },
        messageString,
      })
    },
    selectionFn: players => {
      const playerToWeightMap = players.map(player => {
        return ({
          id: player.Name,
          weight: (1 / player.Age)
        })
      })
      const playerId = rwc(playerToWeightMap);
      return players.find(player => player.Name === playerId);
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
    },
    selectionFn: choosePlayerByAge
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
      } are expected to move ${player.Name} within the next ${_.random(1,
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
        _.random(1,3)
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
      const value = _.random(1,3);
      const messageString = `With some sly budgeting, the ${
        player.Team
      } have managed to find an extra ${value} dollars for this season.`;
      return ({
        type: 'ASSETS',
        updateKey: {
          key: 'Cash',
          value
        },
        messageString
      })
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
      const messageString = `In a shocking turn of events, ${player.Name} of the ${player.Team} apparently grown an inch since entering the VNBA!`;
      return ({
        type: 'MANUAL',
        updateKey: {
          key: 'height',
          value: player.Name,
          infoString: 'Increase player height by 1 inch.'
        },
        messageString,
      })
    },
    selectionFn: choosePlayerByAge
  },

  wingspan: {
    valid: true,
    fn: function(player) {
      const messageString = `Incredibly shocking news, ${player.Name} of the ${player.Team} has reportedly seen a remarkable increase to his wingspan! Astonishing!`
      return ({
        type: 'MANUAL',
        updateKey: {
          key: 'wingspan',
          value: player.Name,
          infoString: '(+5 on the wingspan slider in player body)'
        },
        messageString
      })
    },
    selectionFn: choosePlayerByAge
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

const injuryEvents = {
// Injuries

  Flu: {
    valid: true,
    fn: function(player) {
      // logic goes here
      return `It appears that ${
        player.Name
      } has been ill with the flu an will now miss the next ${_.random(
        1, 2
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
      } has reportedly been dealing with back spasms and is expected to miss the next ${_.random(1,3)} games as he recovers.`;
    }
  },

  "Missed Practice": {
    valid: true,
    fn: function(player) {
      return `${player.Name} of the ${
        player.Team
      } has reportedly missed the last ${
        player.Team
      } practice session and has been internally suspended for ${_.random(1,2)} games by the ${player.Team} organization.`;
    }
  },

  "Failed Drug Test": {
    valid: true,
    fn: function(player) {
      return `BREAKING: ${player.Name} of the ${
        player.Team
      } has reportedly tested positive for PEDs and has been suspended by the NBA for ${_.random(1,4)} games by the VNBA.`;
    }
  },

  concussion: {
    valid: true,
    fn: function(player) {
      return `${player.Name} of the ${
        player.Team
      } has been placed in the VNBA concussion protocal and is expected to miss the next ${_.random(1,
        3
      )} games as he recovers.`;
    }
  },

  "Sore Hamstring": {
    valid: true,
    fn: function(player) {
      return `${player.Name} of the ${
        player.Team
      } has been been suffering from a sore hamstring and is ruled out of games for the next ${_.random(1,
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
      } will take the next ${_.random(1,2)} games off to be with his child.`;
    }
  },

}

const dLeagueEvents = {
  boost: {
    valid: true,
    fn: function({player}) {
      const { id, value } = randomTrait();
      return `Reporting from the D League: ${player.Name} of the ${
        player.Team
      } has been putting in extra work at the gym to improve his ${id}. (+${value})`;
    }
  },

  badge: {
    valid: true,
    fn: function({player}) {
      return `Reporting from the D League: ${player.Name} of the ${
        player.Team
      } has been aiming to earn a role within his team. The role? ${randomBadge()}.`;
    }
  },

  hotzone: {
    valid: true,
    fn: function({player}) {
      return `Reporting from the D League: ${player.Name} of the ${
        player.Team
      } has been shooting hot under this zone: ${randomHotZone()}`;
    }
  },

  signaturepackage: {
    valid: true,
    fn: function({player, playerTwo, retiree}) {
      return `Reporting from the D League: it sounds like ${player.Name} of the ${
        player.Team
      } has been reaching out to retired player ${
        retiree.Name
      } to potentially rework his ${_.sample(['shooting form', 'layup package', 'dribbling package'])}.`
    }
  },

  retiredbadge: {
    valid: true,
    fn: function({player, playerTwo, retiree}) {
      return `Reporting from the D League: retired player ${retiree.Name} has reportedly been mentoring ${
        player.Name
      } of the ${
        player.Team
      } in one of their Hall of Fame worthy skills. (+1 badge level from the retired players HOF badges)`
    }
  },
  growth: {
    valid: true,
    fn: function({player}) {
      return `In a shocking turn of events, ${player.Name} of the ${player.Team} apparently grown an inch whilst in the D League!`;
    }
  },

  wingspan: {
    valid: true,
    fn: function({player}) {
      return `Incredibly shocking news from the D League, ${player.Name} of the ${player.Team} has reportedly seen a remarkable increase to his wingspan! Astonishing! (+5 on the wingspan slider in player body)`
    }
  },
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
    LATERAL_QUICKNESS: {
      name: "Lateral Quickness",
      value: 5
    },
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
    },
    INTANGIBLES: {
      name: "Intangibles",
      value: 5
    }
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
      name: "Acrobat",
      desc:
        "Spin, half-spin, hop step, euro-step, cradle, reverse, and change shot layup attempts receive a significant boost.",
      value: 1
    },
    BACKDOWN_PUNISHER: {
      name: "Backdown Punisher",
      desc:
        "Allows players to have more success than normal when backing down a defender in the paint.",
      value: 1
    },
    CONSISTENT_FINISHER: {
      name: "Consistent Finisher",
      desc:
        "Penalties for mis-timed layups are reduced, allowing players to make layups more consistently.",
      value: 1
    },
    CONTACT_FINISHER: {
      name: "Contact Finisher",
      desc:
        "Slashers who play below the rim finish contact layups more successfully while dunkers are able to pull off more contact dunks.",
      value: 1
    },
    "CROSS-KEY_SCORER": {
      name: "Cross-Key Scorer",
      desc:
        "Boosts the ability to make running hooks, layups, or close range pull-ups while driving across the paint.",
      value: 1
    },
    DEEP_HOOKS: {
      name: "Deep Hooks",
      desc:
        "Post hooks taken far from the basket receive less of a distance penalty than normal.",
      value: 1
    },
    "DROP-STEPPER": {
      name: "Dropstepper",
      desc:
        "Allows for more success when attempting post dropsteps and hop steps, in addition to protecting the ball better, while performing these moves in the post.",
      value: 1
    },
    FANCY_FOOTWORK: {
      name: "Fancy Footwork",
      desc:
        " players get past defenders more efficiently when performing euro, cradle, hop step, spin, and half-spin gathers.",
      value: 1
    },
    FASTBREAK_FINISHER: {
      name: "Fastbreak Finisher",
      desc:
        "Gives an additional boost to a player’s takeover meter when successfully dunking on a fastbreak.",
      value: 1
    },
    GIANT_SLAYER: {
      name: "Giant Slayer",
      desc:
        "Boosts the shot percentage for a layup attempt when mismatched against a taller defender and reduces the possibility of getting blocked.",
      value: 1
    },
    LOB_CITY_FINISHER: {
      name: "Lob City Finisher",
      desc:
        "Improves a player’s ability to successfully finish an alley-oop layup or dunk. The shot must be taken before the receiver lands.",
      value: 1
    },
    PICK_ROLLER: {
      name: "Pick and Roller",
      desc:
        "When rolling off the pick and roll, a shot boost is applied if the layup or dunk attempt comes within a few seconds after catching the pass.",
      value: 1
    },
    PRO_TOUCH: {
      name: "Pro Touch",
      desc:
        "Gives an extra shot boost for having slightly early, slightly late, or excellent shot timing on layups.",
      value: 1
    },
    PUTBACK_BOSS: {
      name: "Putback Boss",
      desc:
        "Boosts the shot attributes of a player that attempts a putback layup or dunk right after getting an offensive rebound.",
      value: 1
    },
    RELENTLESS_FINISHER: {
      name: "Relentless Finisher",
      desc:
        "Improves a player’s ability to take a lot of contact by reducing the energy lost when attacking the rim for contact shots.",
      value: 1
    },
    SHOWTIME: {
      name: "Showtime",
      desc:
        "Gives an additional boost to a player’s takeover meter and his teammates, when successfully completing an and-1 or flashy dunk.",
      value: 1
    },
    SLITHERY_FINISHER: {
      name: "Slithery Finisher",
      desc:
        "Increases a player’s ability to slide through traffic and avoid contact during gathers and finishes at the rim.",
      value: 1
    },
    TEAR_DROPPER: {
      name: "Tear Dropper",
      desc: "Improves a player’s ability to known down floaters and runners.",
      value: 1
    }
  },
  Shooting: {
    CATCH_SHOOT: {
      name: "Catch & Shoot",
      desc:
        "For a short time after receiving a pass, the receiver’s outside shooting attributes get a significant boost.",
      value: 1
    },
    CLUTCH_SHOOTER: {
      name: "Clutch Shooter",
      desc:
        "Shot attempts that occur during the final moments of the 4th quarter, or in any overtime period, receive a large boost.",
      value: 1
    },
    CORNER_SPECIALIST: {
      name: "Corner Specialist",
      desc:
        "Deep mid-range or 3pt shots taken along the baseline of the court receive a boost, whether it is off the dribble or off the catch.",
      value: 1
    },
    DEADEYE: {
      name: "Deadeye",
      desc:
        "Jump shots taken with a defender closing out receive less of a penalty from a shot contest. This includes both mid-range and 3pt shots.",
      value: 1
    },
    DEEP_FADES: {
      name: "Deep Fades",
      desc:
        "Post fadeaways taken far from the basket receive less of a distance penalty than normal.",
      value: 1
    },
    DIFFICULT_SHOTS: {
      name: "Difficult Shots",
      desc:
        "Boosts your player’s ability to make shots off the dribble, in addition to boosting your player’s ability to make moving shots.",
      value: 1
    },
    FLEXIBLE_RELEASE: {
      name: "Flexible Release",
      desc:
        "Shot timing penalties for jump shots are reduced, making it easier to knock down attempts even when releasing early or late.",
      value: 1
    },
    GREEN_MACHINE: {
      name: "Green Machine",
      desc:
        "Gives an additional shot boost when consecutively achieving excellent releases on jump shots. ",
      value: 1
    },
    HOT_START: {
      name: "Hot Start",
      desc:
        "For every made shot from the beginning of the game, players receives a shot attribute bonus that lasts until the first missed shot attempt",
      value: 1
    },
    HOT_ZONE_HUNTER: {
      name: "Hot Zone Hunter",
      desc: "Shots that are taken in a player’s hot zone(s) are given a boost",
      value: 1
    },
    ICE_IN_VEINS: {
      name: "Ice in Veins",
      desc:
        "Free throws taken in the second half of close games or overtime periods are given a boost. Also, the timing window for free throws becomes larger.",
      value: 1
    },
    PICK_POPPER: {
      name: "Pick & Popper",
      desc:
        "Shot attempts that come after setting a screen are given a boost if the shot happens far enough from the rim and within a few seconds after the screen has been set.",
      value: 1
    },
    PUMP_FAKE_MAESTRO: {
      name: "Pump Fake Maestro",
      desc:
        "Shortens the timer that determines how long after a pump fake a player can shoot without incurring a shot percentage penalty.",
      value: 1
    },
    QUICK_DRAW: {
      name: "Quick Draw",
      desc:
        "The higher the badge level, the faster a player will be able to release all jump shots.",
      value: 1
    },
    RANGE_EXTENDER: {
      name: "Range Extender",
      desc:
        "Adds extra distance to a player’s given shot range for both mid-range and 3pt shots.",
      value: 1
    },
    "SLIPPERY_OFF-BALL": {
      name: "Slippery Off-Ball",
      desc:
        "When attempting to get open off screens, the player more effectively navigates through traffic.",
      value: 1
    },
    STEADY_SHOOTER: {
      name: "Steady Shooter",
      desc:
        "Shot attempts that are contested receive less of a penalty, however shot attempts that are open do not receive as much of a bonus.",
      value: 1
    },
    TIRELESS_SCORER: {
      name: "Tireless Shooter",
      desc:
        "Shot attributes on jump shots suffer a smaller penalty than normal when tired.",
      value: 1
    },
    VOLUME_SHOOTER: {
      name: "Volume Shooter",
      desc:
        "After a player has taken a small handful of shots, an additional boost to shot attributes is given for ever subsequent shot, whether it’s a make or a miss.",
      value: 1
    }
  },
  Playmaking: {
    ANKLE_BREAKER: {
      name: "Ankle Breaker",
      desc:
        "Improves the likelihood of freezing or dropping a defender during dribble moves, especially stepback moves or certain chains of dribble moves.",
      value: 1
    },
    BAIL_OUT: {
      name: "Bail Out",
      desc:
        "Increases the chances of a successful and accurate pass out of a jumpshot or layup while mid-air.",
      value: 1
    },
    BREAK_STARTER: {
      name: "Break Starter",
      desc:
        "Allows rebounders to throw more effective deep outlet passes shortly following a defensive rebound.",
      value: 1
    },
    DIMER: {
      name: "Dimer",
      desc:
        "Gives a shooting boost to receivers in catch-and-shoot oppurtunities.",
      value: 1
    },
    DOWNHILL: {
      name: "Downhill",
      desc:
        " Increases your player’s speed with ball rating on fastbreak opportunities",
      value: 1
    },
    DREAM_SHAKE: {
      name: "Dream Shake",
      desc:
        "Increases the chances that a defender falls for a pump fake in the post. In addition, your player’s shooting attributes increase after post moves or pump fakes.",
      value: 1
    },
    FLASHY_PASSER: {
      name: "Flashy Passer",
      desc:
        "Gives a Takeover boost to the passer and receiver after following a made shot off a flashy pass.",
      value: 1
    },
    FLOOR_GENERAL: {
      name: "Floor General",
      desc: "Boosts your teammates’ offensive attributes when on the floor.",
      value: 1
    },
    HANDLES_FOR_DAYS: {
      name: "Handles For Days",
      desc:
        "Allows playmakers and dribbling builds to lose less stamina when chaining dribble moves.",
      value: 1
    },
    LOB_CITY_PASSER: {
      name: "Lob City Passer",
      desc:
        "Increases the chances of a successful alley-oop pass and finish. It boosts both your player’s passing attribute and the finishing attributes of your receiver.",
      value: 1
    },
    NEEDLE_THREADER: {
      name: "Needle Threader",
      desc:
        "Increases the success of tough passes between defenders. When activated, this badge will boost your passing attributes and help deliver a crisp pass.",
      value: 1
    },
    PASS_FAKE_MAESTRO: {
      name: "Pass Fake Maestro",
      desc:
        "Increases the effectiveness of fake passes by making them quicker and tighter.",
      value: 1
    },
    POST_SPIN_TECHNICIAN: {
      name: "Post Spin Technician",
      desc: "Boosts a player’s post spin or post drive",
      value: 1
    },
    QUICK_FIRST_STEP: {
      name: "Quick First Step",
      desc:
        "Allows players to get more explosive first steps out of the triple threat or size up.",
      value: 1
    },
    SPACE_CREATOR: {
      name: "Space Creator",
      desc:
        "Boosts your player’s ability to create space from a defender on a step back move or shot.",
      value: 1
    },
    STOP_GO: {
      name: "Stop & Go",
      desc:
        "Allows ball handlers to quickly stop-and-go while dribbling. You also get unique launch animations on stop-and-gos with this badge.",
      value: 1
    },
    TIGHT_HANDLES: {
      name: "Tight Handles",
      desc: "Boosts your player’s ball handling in one-on-one situations.",
      value: 1
    },
    UNPLUCKABLE: {
      name: "Unpluckable",
      desc:
        "Makes it more difficult for defenders to steal the ball from your player.",
      value: 1
    }
  },
  "Defense/Rebounding": {
    BOX: {
      name: "Box",
      desc:
        "Strengthens a player’s ability to effectively box out opponents in anticipation of a rebound.",
      value: 1
    },
    BRICK_WALL: {
      name: "Brick Wall",
      desc:
        "This badge makes it tougher for a defense to get through or around screens. Players hit by contact from a brick wall lose more energy than normal.",
      value: 1
    },
    CHASE_DOWN_ARTIST: {
      name: "Chase Down Artist",
      desc:
        "Boosts the speed and leaping ability of a player when he is chasing down an offensive player in anticipation of a block attempt.",
      value: 1
    },
    CLAMPS: {
      name: "Clamps",
      desc:
        "Defenders have access to quicker cut off moves and are more successful when bumping or hip riding riding the ball handler.",
      value: 1
    },
    DEFENSIVE_STOPPER: {
      name: "Defensive Leader",
      desc:
        "Lifts the defensive ability of teammates when on the court. Also, at the Hall of Fame level, can see potential shot percentages of opposing players.",
      value: 1
    },
    HEART_CRUSHER: {
      name: "Heart Crusher",
      desc:
        "After successfully blocking or stealing the ball from an opponent, an additional penalty is given to the opposing player’s takeover meter.",
      value: 1
    },
    INTERCEPTOR: {
      name: "Interceptor",
      desc:
        "The frequency of successfully tipped or intercepted passes greatly increases.",
      value: 1
    },
    INTIMIDATOR: {
      name: "Intimidator",
      desc:
        "Offensive players have less success shooting when contested by players with this badge. Also boosts the shot defense rating when tightly guarding an opponent.",
      value: 1
    },
    LIGHTNING_REFLEXES: {
      name: "Lightning Reflexes",
      desc:
        "Gives the defender an advantage to read where the ball handler is going in the Read and React System.",
      value: 1
    },
    MOVING_TRUCK: {
      name: "Moving Truck",
      desc:
        "Players are more effective pushing opponents out of the post while playing defense.",
      value: 1
    },
    "OFF-BALL_PEST": {
      name: "Off Ball Pest",
      desc:
        "Makes players more difficult to get past when playing off-ball, as they can grab and hold their matchup and don’t get their ankles broken as often.",
      value: 1
    },
    PICK_DODGER: {
      name: "Pick Dodger",
      desc:
        "Improves a player’s ability to navigate through and round screens while on defense.",
      value: 1
    },
    PICK_POCKET: {
      name: "Pick Pocket",
      desc:
        "Increases the chances of a steal and reduces the chances of a foul when attempting to strip the ball from a ball handler. Also improves the chances of successful layup strips.",
      value: 1
    },
    POGO_STICK: {
      name: "Pogo Stick",
      desc:
        "Allows players to quickly go back for another block attempt upon landing.",
      value: 1
    },
    POST_MOVE_LOCKDOWN: {
      name: "Post Move Lockdown",
      desc:
        "Increases the chances of a defender preventing an offensive post move from succeeding.",
      value: 1
    },
    REBOUND_CHASER: {
      name: "Rebound Chaser",
      desc:
        "Improves a player’s ability to track down rebounds from farther distances than normal.",
      value: 1
    },
    RIM_PROTECTOR: {
      name: "Rim Protector",
      desc:
        "Improves player’s ability to block shots, unlocks special animations and gives a boost to the Takeover meter for the blocker and blocker’s teammates following a block.",
      value: 1
    },
    TIRELESS_DEFENDER: {
      name: "Tireless Defender",
      desc:
        "Allows defenders to play defense more aggressively without losing energy at the same rate as a normal player.",
      value: 1
    },
    TRAPPER: {
      name: "Trapper",
      desc:
        "When trapping offensive players, defenders are more effective at forcing pickups and turnovers than normal.",
      value: 1
    },
    WORM: {
      name: "Worm",
      desc:
        "When boxed out, rebounders have more success swimming around and getting into successful rebound position.",
      value: 1
    }
  },
};

const hotzones = {
  "3_LEFT-CENTER": {
    name: '3 Left-Center',
    value: 1
  },
  "3_RIGHT-CENTER": {
    name: '3 Right-Center',
    value: 1
  },
  CENTER_3: {
    name: '3 Center',
    value: 1
  },
  CLOSE_LEFT: {
    name: 'Close Left',
    value: 1
  },
  CLOSE_MIDDLE: {
    name: 'Close Middle',
    value: 1
  },
  CLOSE_RIGHT: {
    name: 'Close Right',
    value: 1
  },
  LEFT_3: {
    name: '3 Left',
    value: 1
  },
  "MID-RANGE_LEFT": {
    name: 'Mid-Range Left',
    value: 1
  },
  "MID-RANGE_LEFT_CENTER": {
    name: 'Mid-Range Left-Center',
    value: 1
  },
  "MID-RANGE_RIGHT": {
    name: 'Mid-Range Right',
    value: 1
  },
  "MID-RANGE_RIGHT_CENTER": {
    name: 'Mid-Range Right-Center',
    value: 1
  },
  MID_CENTER: {
    name: 'Mid-Range Center',
    value: 1
  },
  RIGHT_3: {
    name: '3 Right',
    value: 1
  },
  UNDER_BASKET: {
    name: 'Under Basket',
    value: 1
  }
};

const randomAttribute = () => {
  const categoryKey = _.sample(Object.keys(attributes));
  const attributeKey = _.sample(Object.keys(attributes[categoryKey]));
  return ({
    key: attributeKey,
    data: attributes[categoryKey][attributeKey]
  });
};

const randomBadge = () => {
  const categoryKey = _.sample(Object.keys(badges));
  const badgeKey = _.sample(Object.keys(badges[categoryKey]));
  return ({
    key: badgeKey,
    data: badges[categoryKey][badgeKey]
  });
};

const randomHotZone = () => {
  const key = _.sample(Object.keys(hotzones));
  return ({
    key,
    data: hotzones[key]
  })
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

module.exports = { rojEvents, dLeagueEvents, injuryEvents, randomCause, randomBadge, randomHotZone, };