const { GoogleSpreadsheet } = require("google-spreadsheet");
const rwc = require("random-weighted-choice");
const rn = require("random-normal");
const _ = require("lodash");
const faker = require("faker");
faker.setLocale("en");
const { sheetIds } = require("./sheetHelper");
const tendencyDictionary = require('./tendencyDictionary');
const { hotzones: hotzoneKeys } = require('../bots/consts');

// NBA2k attribute formula to be readable by the 2ktools
// 0 - 222
// (0 - 74) * 3, 25 -> 99 for nba2k stat
// => (stat - 25) * 3

function shuffle(array) {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

// 16 injury keys
// random 5 keys from keys
// parse keys, get value, increase/decrease by percentage value
// update values

const injuryKeys = [
  "HEAD_DURABILITY",
  "NECK_DURABILITY",
  "BACK_DURABILITY",
  "LEFT_SHOULDER_DURABILITY",
  "RIGHT_SHOULDER_DURABILITY",
  "LEFT_ELBOW_DURABILITY",
  "RIGHT_ELBOW_DURABILITY",
  "LEFT_HIP_DURABILITY",
  "RIGHT_HIP_DURABILITY",
  "LEFT_KNEE_DURABILITY",
  "RIGHT_KNEE_DURABILITY",
  "LEFT_ANKLE_DURABILITY",
  "RIGHT_ANKLE_DURABILITY",
  "LEFT_FOOT_DURABILITY",
  "RIGHT_FOOT_DURABILITY",
  "MISC_DURABILITY"
];
const keys = [
  "DRIVING_LAYUP",
  "POST_FADEAWAY",
  "POST_HOOK",
  "POST_MOVES",
  "DRAW_FOUL",
  "SHOT_CLOSE",
  "MID-RANGE_SHOT",
  "3PT_SHOT",
  "FREE_THROW",
  "BALL_CONTROL",
  "PASSING_IQ",
  "PASSING_ACCURACY",
  "OFFENSIVE_REBOUND",
  "STANDING_DUNK",
  "DRIVING_DUNK",
  "SHOT_IQ",
  "PASSING_VISION",
  "HANDS",
  "DEFENSIVE_REBOUND",
  "INTERIOR_DEFENSE",
  "PERIMETER_DEFENSE",
  "BLOCK",
  "STEAL",
  "SHOT_CONTEST",
  "REACTION_TIME",
  "ON-BALL_DEFENSE_IQ",
  "LATERAL_QUICKNESS",
  "SPEED",
  "SPEED_WITH_BALL",
  "ACCELERATION",
  "VERTICAL",
  "STRENGTH",
  "STAMINA",
  "HUSTLE",
  "PASS_PERCEPTION",
  "DEFENSIVE_CONSISTENCY",
  "HELP_DEFENSIVE_IQ",
  "OFFENSIVE_CONSISTENCY",
  "PICK_AND_ROLL_DEFENSIVE_IQ",
  "INTANGIBLES",
  "EMOTION_ABILITY"
];
const guardKeys = [
  "DRIVING_LAYUP",
  "MID-RANGE_SHOT",
  "3PT_SHOT",
  "DRAW_FOUL",
  "FREE_THROW",
  "BALL_CONTROL",
  "PASSING_IQ",
  "PASSING_ACCURACY",
  "PASSING_VISION",
  "PERIMETER_DEFENSE",
  "STEAL",
  "SPEED",
  "SPEED_WITH_BALL"
];
const bigKeys = [
  "SHOT_CLOSE",
  "POST_FADEAWAY",
  "POST_HOOK",
  "POST_MOVES",
  "OFFENSIVE_REBOUND",
  "STANDING_DUNK",
  "DRIVING_DUNK",
  "HANDS",
  "DEFENSIVE_REBOUND",
  "INTERIOR_DEFENSE",
  "BLOCK",
  "VERTICAL",
  "STRENGTH"
];
const badges = [
  "ACROBAT",
  "TEAR_DROPPER",
  "RELENTLESS_FINISHER",
  "POST_SPIN_TECHNICIAN",
  "DROP-STEPPER",
  "PUTBACK_BOSS",
  "BACKDOWN_PUNISHER",
  "CONSISTENT_FINISHER",
  "CONTACT_FINISHER",
  "CROSS-KEY_SCORER",
  "DEEP_HOOKS",
  "PICK_ROLLER",
  "FANCY_FOOTWORK",
  "FASTBREAK_FINISHER",
  "GIANT_SLAYER",
  "PRO_TOUCH",
  "SHOWTIME",
  "SLITHERY_FINISHER",
  "CATCH_SHOOT",
  "CORNER_SPECIALIST",
  "DIFFICULT_SHOTS",
  "PICK_POPPER",
  "CLUTCH_SHOOTER",
  "DEADEYE",
  "DEEP_FADES",
  "FLEXIBLE_RELEASE",
  "GREEN_MACHINE",
  "HOT_ZONE_HUNTER",
  "HOT_START",
  "ICE_IN_VEINS",
  "PUMP_FAKE_MAESTRO",
  "QUICK_DRAW",
  "RANGE_EXTENDER",
  "SLIPPERY_OFF-BALL",
  "STEADY_SHOOTER",
  "TIRELESS_SCORER",
  "VOLUME_SHOOTER",
  "ANKLE_BREAKER",
  "FLASHY_PASSER",
  "BREAK_STARTER",
  "LOB_CITY_PASSER",
  "DIMER",
  "BAIL_OUT",
  "DOWNHILL",
  "DREAM_SHAKE",
  "HANDLES_FOR_DAYS",
  "NEEDLE_THREADER",
  "PASS_FAKE_MAESTRO",
  "QUICK_FIRST_STEP",
  "SPACE_CREATOR",
  "STOP_GO",
  "TIGHT_HANDLES",
  "UNPLUCKABLE",
  "FLOOR_GENERAL",
  "PICK_POCKET",
  "RIM_PROTECTOR",
  "PICK_DODGER",
  "CHASE_DOWN_ARTIST",
  "CLAMPS",
  "DEFENSIVE_STOPPER",
  "HEART_CRUSHER",
  "INTERCEPTOR",
  "INTIMIDATOR",
  "LIGHTNING_REFLEXES",
  "MOVING_TRUCK",
  "OFF-BALL_PEST",
  "POGO_STICK",
  "POST_MOVE_LOCKDOWN",
  "TIRELESS_DEFENDER",
  "TRAPPER",
  "LOB_CITY_FINISHER",
  "BRICK_WALL",
  "BOX",
  "REBOUND_CHASER",
  "WORM"
];
// WIP: remove controverersial badges in future discussion
const personalityBadges = [
  "ALPHA_DOG",
  "ENFORCER",
  "RESERVED",
  "FRIENDLY",
  "TEAM_PLAYER",
  "EXTREMELY_CONFIDENT",
  "HIGH_WORK_ETHIC",
  "LEGENDARY_WORK_ETHIC",
  "KEEP_IT_REAL",
  "PAT_MY_BACK",
  "EXPRESSIVE",
  "UNPREDICTABLE",
  "LAID_BACK",
  "MEDIA_RINGMASTER",
  "WARM_WEATHER_FAN",
  "FINANCE_SAVVY",
  "CAREER_GYM_ELIMINATOR",
  "ON_COURT_COACH"
];

const getAttributeTotal = data => {
  return Object.values(data).reduce((acc, curr) => acc + parseInt(curr), 0);
};

const getBadgeTotal = data => {
  const filteredBadges = Object.keys(data)
    .filter(key => badges.includes(key))
    .reduce((obj, key) => {
      return {
        ...obj,
        [key]: data[key]
      };
    }, {});
  return Object.values(filteredBadges).reduce(
    (acc, curr) => acc + parseInt(curr),
    0
  );
};

const generateTendencies = (attributes, badges, hotzones) => {
  const {
    data: attributeData
  } = attributes;
  const {
    data: badgeData
  } = badges;
  const {
    data: hotzoneData
  } = hotzones;
  const parsedAttributeData = Object.keys(attributeData).reduce((acc, key) => {
    return ({
      ...acc,
      [key]: (parseInt(attributeData[key]) / 3) + 25
    })
  }, {});
  const parsedBadgeData = Object.keys(badgeData).reduce((acc, key) => {
    return ({
      ...acc,
      [key]: parseInt(badgeData[key])
    })
  }, {});
  const parsedHotzoneData = Object.keys(hotzoneData).reduce((acc, key) => {
    return ({
      ...acc,
      [key]: parseInt(hotzoneData[key])
    })
  }, {});
  console.log('red', parsedAttributeData)
  const newTendencies = Object.keys(tendencyDictionary).reduce((acc, key) => {
    return ({
      ...acc,
      [key]: tendencyDictionary[key](parsedAttributeData, parsedBadgeData, parsedHotzoneData)
    });
  }, {});
  return ({
    data: {
      module: "PLAYER",
      tab: "TENDENCIES",
      data: newTendencies
    }
  })
};

const generateHotzones = () => {
  const hotzones = Object.keys(hotzoneKeys).reduce((acc, key) => {
    return ({
      ...acc,
      [key]: `${_.random(0, 2)}`
    });
  }, {});
  console.log('bar', hotzones);
  return {
    data: {
      module: "PLAYER",
      tab: "HOTZONE",
      data: hotzones,
    }
  };
};

function generateAttributes() {
  // 58 41
  // 11 numbers from 80 - 100, 9 num from 70 to 100, 7 num from 60 to 100, 5 num from 50 to 100, 4 num from 40 to 90, 3 from 30 to 80
  let values = [];
  let injuryValues = [];
  // attributes
  // WIP: rework how values are instantiated
  for (let step = 0; step < 11; step++) {
    values.push(getRandomInt(80, 99));
  }
  for (let step = 0; step < 10; step++) {
    values.push(getRandomInt(70, 99));
  }
  for (let step = 0; step < 8; step++) {
    values.push(getRandomInt(60, 99));
  }
  for (let step = 0; step < 5; step++) {
    values.push(getRandomInt(50, 99));
  }
  for (let step = 0; step < 4; step++) {
    values.push(getRandomInt(40, 89));
  }
  for (let step = 0; step < 3; step++) {
    values.push(getRandomInt(30, 79));
  }
  // durability
  for (let step = 0; step < 12; step++) {
    injuryValues.push(getRandomInt(30, 99));
  }
  shuffle(values);
  shuffle(injuryValues);
  const mappedValues = values.map(num => (num - 25) * 3);
  let result = {};
  keys.forEach((key, index) => (result[key] = `${mappedValues[index]}`));
  // injuryKeys.forEach((key, index) => result[key] = `${injuryValues[index]}`);
  const data = {
    module: "PLAYER",
    tab: "ATTRIBUTES",
    data: result
  };
  return {
    data,
    attributeTotal: getAttributeTotal(result)
  };
}

function positionBias(position, attributes) {
  const newAttributes = _.cloneDeep(attributes);
  const gks = [...guardKeys];
  const bks = [...bigKeys];
  if (position === "guard") {
    gks.forEach((gk, idx) => {
      const correspondingBigAttr = bks[idx];
      if (
        parseInt(attributes.data[gk]) <
        parseInt(attributes.data[correspondingBigAttr])
      ) {
        if (Math.random() < 0.75) {
          newAttributes.data[gk] = attributes.data[correspondingBigAttr];
          newAttributes.data[correspondingBigAttr] = attributes.data[gk];
        }
      }
    });
  } else if (position === "big") {
    bks.forEach((bk, idx) => {
      const correspondingGuardAttr = gks[idx];
      if (
        parseInt(attributes.data[bk]) <
        parseInt(attributes.data[correspondingGuardAttr])
      ) {
        if (Math.random() < 0.75) {
          newAttributes.data[bk] = attributes.data[correspondingGuardAttr];
          newAttributes.data[correspondingGuardAttr] = attributes.data[bk];
        }
      }
    });
  }

  return newAttributes;
}

const weights = [
  {
    id: "0",
    weight: 0.67
  },
  {
    id: "1",
    weight: 0.15
  },
  {
    id: "2",
    weight: 0.1
  },
  {
    id: "3",
    weight: 0.05
  },
  {
    id: "4",
    weight: 0.03
  }
];

const personalityWeights = [
  {
    id: "0",
    weight: 0.92
  },
  {
    id: "1",
    weight: 0.8
  }
];

function generateBadges() {
  let result = {};
  personalityBadges.forEach(key => (result[key] = rwc(personalityWeights)));
  badges.forEach(key => (result[key] = rwc(weights)));

  const data = {
    module: "PLAYER",
    tab: "BADGES",
    data: result
  };

  return {
    data,
    badgeTotal: getBadgeTotal(result)
  };
}

const classes = {
  guard: {
    height: 191,
    weight: 195,
    hDeviation: 5,
    wDeviation: 15
  },
  wing: {
    height: 203,
    weight: 215,
    hDeviation: 5,
    wDeviation: 20
  },
  big: {
    height: 211,
    weight: 255,
    hDeviation: 5,
    wDeviation: 25
  }
};

// class = guard, wing, big
function generateClass(playerType) {
  const { height, weight, hDeviation, wDeviation } =
    classes[playerType] || classes.wing;
  const genHeight = rn({ mean: height, dev: hDeviation });
  const genWeight = Math.floor(rn({ mean: weight, dev: wDeviation }));
  // wingspan numbers 0.94 to 1.14 ratio to height, mean is 1.04, stdev 0.0333333333
  // const genWingspan = _.clamp(rn({ mean: 1.04, dev: 0.05}), 0.94, 1.14) * genHeight;
  // wingspan numbers from 0 to 100, mean 50, stdev 15
  const genWingspan = _.clamp(rn({ mean: 55, dev: 15 }), 0, 100);

  const data = {
    module: "PLAYER",
    tab: "VITALS",
    data: {
      HEIGHT_CM: `${Math.floor(genHeight)}`,
      WEIGHT_LBS: `${genWeight}`
    }
  };
  return {
    genHeight,
    genWeight,
    genWingspan,
    data
  };
}

function toFtInFromCm(value) {
  const totalLength = Math.floor(value / 2.54);
  const ft = Math.floor(totalLength / 12);
  const inches = totalLength % 12;
  return `${ft}'${inches}"`;
}

const playerTypeNames = {
  guard: ["PG", "SG", "PG/SG"],
  wing: ["SF", "PF", "SG", "SG/SF", "SF/PF"],
  big: ["PF", "C", "PF/C", "C/PF"]
};

const chooseOne = choices => {
  return choices[Math.floor(Math.random() * choices.length)];
};

function getRandomArbitrary(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}
// delta = up, add values, delta = down, subtract, delta = neutral, do nothing
const deltas = {
  up: 1,
  down: -1,
  neutral: 0
};

const updateValues = (values, delta) => {
  const valuesFromJSON = JSON.parse(values);
  const vitalsTab = valuesFromJSON.find(page => page.tab === "VITALS");
  const attributesTab = valuesFromJSON.find(page => page.tab === "ATTRIBUTES");
  const badgesTab = valuesFromJSON.find(page => page.tab === "BADGES");
  const hotzoneTab = valuesFromJSON.find(page => page.tab === "HOTZONE");
  let newAttributes = attributesTab.data;
  let newBadges = badgesTab.data;
  const filteredBadgeKeys = badges.filter(badge => badgesTab.data[badge] > 0);
  const attrDelta = _.sampleSize(keys, 5).map(key => ({
    key,
    value: deltas[delta] * getRandomArbitrary(15, 45)
  }));
  const badgeKeys = delta == "up" ? badges : filteredBadgeKeys;
  const badgeSampleSize = delta == "up" ? 5 : 3;
  const badgeDelta = _.sampleSize(badgeKeys, badgeSampleSize).map(key => ({
    key,
    value: deltas[delta]
  }));
  attrDelta.forEach(({ key, value }) => {
    newAttributes[key] = `${_.clamp(
      parseInt(newAttributes[key]) + value,
      0,
      222
    )}`;
  });
  badgeDelta.forEach(({ key, value }) => {
    newBadges[key] = `${_.clamp(parseInt(newBadges[key]) + value, 0, 4)}`;
  });
  const { data: newTendencies } = generateTendencies({ data: newAttributes}, { data: newBadges }, hotzoneTab);
  const newValues = [
    vitalsTab,
    {
      module: "PLAYER",
      tab: "ATTRIBUTES",
      data: newAttributes
    },
    newTendencies,
    hotzoneTab,
    {
      module: "PLAYER",
      tab: "BADGES",
      data: newBadges
    },
  ];
  return {
    newValues,
    attrDelta,
    badgeDelta,
    attributeTotal: getAttributeTotal(newAttributes),
    badgeTotal: getBadgeTotal(newBadges)
  };
};

function toDelta(overall, targetOverall) {
  const difference = targetOverall - overall;
  if (Math.abs(difference) < 1) return "neutral";
  if (difference > 0) return "up";
  if (difference < 0) return "down";
  return "error";
}

function toDeltaString(valueDelta) {
  return valueDelta.map(({ key, value }) => `${key}: ${value}`).join(",  ");
}

function runBatch(batchNum) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
  const { generatedPlayers: genPlayersId } = sheetIds;
  return (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const genPlayers = sheets[genPlayersId];
    const playersToBatch = genPlayers.getRows().then(rows => {
      return rows.filter(row => {
        return row.Batch === batchNum && !row.IgnoreBatch;
      });
    });
    playersToBatch.then(rows => {
      const newRows = rows.map(row => {
        const data = row.Values;
        const delta = toDelta(row.Overall, row.TargetOverall);
        const rowOverall = delta == "neutral" ? row.Overall : "";
        console.log("foo", delta);
        const { newValues, attrDelta, badgeDelta, attributeTotal, badgeTotal } =
          updateValues(data, delta) || {};
        return {
          ...row,
          Overall: rowOverall,
          AttributeTotal: attributeTotal,
          BadgeTotal: badgeTotal,
          Values: JSON.stringify(newValues),
          Batch: parseInt(row.Batch) + 1,
          PrevDelta: delta,
          DeltaValues: `${toDeltaString(attrDelta)}; ${toDeltaString(
            badgeDelta
          )}`
        };
      });
      return (async () => {
        await genPlayers.addRows(newRows);
      })();
    });
  })();
}

function generatePlayer(
  playerType = chooseOne(["guard", "wing", "big"]),
  overall,
  addToSheet
) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
  const { players: playersId, generatedPlayers: genPlayersId } = sheetIds;
  return (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const generatedPlayersSheet = sheets[genPlayersId];
    const playersSheet = sheets[playersId];
    const { data: attributes, attributeTotal } = generateAttributes();
    const { data: badges, badgeTotal } = generateBadges();
    const { data: hotzones, } = generateHotzones();
    console.log('hotzones', hotzones);
    const name = `${faker.name.firstName(0)} ${faker.name.lastName()}`;
    const { genHeight, genWeight, genWingspan, data: vitals } = generateClass(
      playerType
    );
    const formattedHeight = toFtInFromCm(genHeight);
    const formattedWingSpan = toFtInFromCm(
      ((genWingspan / 100) * 0.2 + 0.94) * genHeight
    );
    const biasedAttributes = positionBias(playerType, attributes);
    const { data: tendencies } = generateTendencies(biasedAttributes, badges, hotzones);
    const player = [vitals, biasedAttributes, tendencies, hotzones, badges];
    const randomPosition = chooseOne(playerTypeNames[playerType]);
    (async () => {
      await generatedPlayersSheet.addRow({
        Name: name,
        AttributeTotal: attributeTotal,
        BadgeTotal: badgeTotal,
        Position: randomPosition,
        Height: formattedHeight,
        Weight: genWeight,
        Wingspan: formattedWingSpan,
        TargetOverall: overall,
        WingspanNo: genWingspan,
        Values: JSON.stringify(player),
        Role: playerType,
        Level: 1,
        Batch: 0,
        PrevDelta: "N/A",
        DeltaValues: "N/A"
      });
      if (!!addToSheet) {
        await playersSheet.addRow({
          Name: name,
          Position: randomPosition,
          Height: formattedHeight,
          Weight: genWeight,
          Team: "Rookie",
          Age: "0"
        });
      }
    })();
    return {
      height: formattedHeight,
      weight: genWeight,
      wingspan: genWingspan,
      name
    };
  })();
}

module.exports = { generatePlayer, runBatch };
