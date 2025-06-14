const { GoogleSpreadsheet } = require("google-spreadsheet");
const rwc = require("random-weighted-choice");
const rn = require("random-normal");
const _ = require("lodash");
const faker = require("faker");
faker.setLocale("en");
const { sheetIds } = require("./sheetHelper");
const { tendencyDictionary, toIsoTendencies } = require("./tendencyDictionary");
const { hotzones: hotzoneKeys } = require("../bots/consts");

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
  // "RELENTLESS_FINISHER",
  // "POST_SPIN_TECHNICIAN",
  "DROP-STEPPER",
  "PUTBACK_BOSS",
  "BACKDOWN_PUNISHER",
  "CONSISTENT_FINISHER",
  "CONTACT_FINISHER",
  // "CROSS-KEY_SCORER",
  "DEEP_HOOKS",
  // "PICK_ROLLER",
  // "FANCY_FOOTWORK",
  // "FASTBREAK_FINISHER",
  "GIANT_SLAYER",
  // "PRO_TOUCH",
  // "SHOWTIME",
  // "SLITHERY_FINISHER",
  "CATCH_SHOOT",
  // "CORNER_SPECIALIST",
  "DIFFICULT_SHOTS",
  // "PICK_POPPER",
  // "CLUTCH_SHOOTER",
  "DEADEYE",
  "DEEP_FADES",
  // "FLEXIBLE_RELEASE",
  // "GREEN_MACHINE",
  // "HOT_ZONE_HUNTER",
  // "HOT_START",
  // "ICE_IN_VEINS",
  // "PUMP_FAKE_MAESTRO",
  // "QUICK_DRAW",
  "RANGE_EXTENDER",
  "SLIPPERY_OFF-BALL",
  // "STEADY_SHOOTER",
  // "TIRELESS_SCORER",
  // "VOLUME_SHOOTER",
  "ANKLE_BREAKER",
  // "FLASHY_PASSER",
  "BREAK_STARTER",
  // "LOB_CITY_PASSER",
  "DIMER",
  "BAIL_OUT",
  // "DOWNHILL",
  // "DREAM_SHAKE",
  "HANDLES_FOR_DAYS",
  "NEEDLE_THREADER",
  // "PASS_FAKE_MAESTRO",
  "QUICK_FIRST_STEP",
  // "SPACE_CREATOR",
  // "STOP_GO",
  "TIGHT_HANDLES",
  "UNPLUCKABLE",
  // "FLOOR_GENERAL",
  "PICK_POCKET",
  "RIM_PROTECTOR",
  "PICK_DODGER",
  "CHASE_DOWN_ARTIST",
  "CLAMPS",
  // "DEFENSIVE_STOPPER",
  // "HEART_CRUSHER",
  "INTERCEPTOR",
  "INTIMIDATOR",
  // "LIGHTNING_REFLEXES",
  // "MOVING_TRUCK",
  "OFF-BALL_PEST",
  "POGO_STICK",
  "POST_MOVE_LOCKDOWN",
  // "TIRELESS_DEFENDER",
  "TRAPPER",
  "LOB_CITY_FINISHER",
  "BRICK_WALL",
  "BOX",
  "REBOUND_CHASER"
  // "WORM"
]; //75
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
  const { data: attributeData } = attributes;
  const { data: badgeData } = badges;
  const { data: hotzoneData } = hotzones;
  const parsedAttributeData = Object.keys(attributeData).reduce((acc, key) => {
    return {
      ...acc,
      [key]: parseInt(attributeData[key]) / 3 + 25
    };
  }, {});
  const parsedBadgeData = Object.keys(badgeData).reduce((acc, key) => {
    return {
      ...acc,
      [key]: parseInt(badgeData[key])
    };
  }, {});
  const parsedHotzoneData = Object.keys(hotzoneData).reduce((acc, key) => {
    return {
      ...acc,
      [key]: parseInt(hotzoneData[key])
    };
  }, {});
  const newTendencies = Object.keys(tendencyDictionary).reduce((acc, key) => {
    return {
      ...acc,
      [key]: tendencyDictionary[key](
        parsedAttributeData,
        parsedBadgeData,
        parsedHotzoneData
      )
    };
  }, {});
  const isoTendencies = toIsoTendencies();
  const newTendenciesWithIso = {
    ...newTendencies,
    ...isoTendencies
  };
  return {
    data: {
      module: "PLAYER",
      tab: "TENDENCIES",
      data: newTendenciesWithIso
    }
  };
};

const generateHotzones = () => {
  const hotzones = Object.keys(hotzoneKeys).reduce((acc, key) => {
    return {
      ...acc,
      [key]: `${_.random(0, 2)}`
    };
  }, {});
  return {
    data: {
      module: "PLAYER",
      tab: "HOTZONE",
      data: hotzones
    }
  };
};

const bigKeysForBias = [
  "SPEED",
  "ACCELERATION",
  "SPEED_WITH_BALL",
  "BALL_CONTROL"
];

const guardKeysForBias = [
  "3PT_SHOT",
  "DRAW_FOUL",
  "FREE_THROW",
  "BALL_CONTROL",
  "PASSING_IQ",
  "PASSING_ACCURACY",
  "PASSING_VISION",
  "SPEED",
  "SPEED_WITH_BALL",
  "ACCELERATION"
];

const initialBiasedDelta = (data, delta, keys) => {
  const { data: initData } = data;
  let newAttributes = initData;

  const attrDelta = keys.map(key => ({
    key,
    value: deltas[delta] * _.random(1, 10) * 3
  }));

  attrDelta.forEach(({ key, value }) => {
    newAttributes[key] = `${_.clamp(
      parseInt(newAttributes[key]) + value,
      45,
      222
    )}`;
  });

  // make speed faster than speed w/ball
  const speed = newAttributes["SPEED"];
  const speedBall = newAttributes["SPEED_WITH_BALL"];
  if (
    parseInt(newAttributes["SPEED"]) <
    parseInt(newAttributes["SPEED_WITH_BALL"])
  ) {
    newAttributes["SPEED"] = speedBall;
    newAttributes["SPEED_WITH_BALL"] = speed;
  }

  return {
    newValues: {
      module: "PLAYER",
      tab: "ATTRIBUTES",
      data: newAttributes
    },
    attrDelta,
    attributeTotal: getAttributeTotal(newAttributes)
  };
};

function generateAttributes(playerType) {
  const initDeltaKeys =
    playerType == "guard" ? guardKeysForBias : bigKeysForBias;
  const initDelta = playerType == "guard" ? "up" : "down";

  // 58 41
  // 11 numbers from 80 - 100, 9 num from 70 to 100, 7 num from 60 to 100, 5 num from 50 to 100, 4 num from 40 to 90, 3 from 30 to 80
  let values = [];
  let injuryValues = [];
  // attributes
  // WIP: rework how values are instantiated
  for (let step = 0; step < 10; step++) {
    values.push(_.random(80, 99));
  }
  for (let step = 0; step < 9; step++) {
    values.push(_.random(70, 99));
  }
  for (let step = 0; step < 8; step++) {
    values.push(_.random(60, 99));
  }
  for (let step = 0; step < 6; step++) {
    values.push(_.random(50, 99));
  }
  for (let step = 0; step < 5; step++) {
    values.push(_.random(40, 89));
  }
  for (let step = 0; step < 2; step++) {
    values.push(_.random(30, 79));
  }
  // durability
  for (let step = 0; step < 12; step++) {
    injuryValues.push(_.random(30, 99));
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
  if (playerType == "wing") {
    return {
      data,
      attributeTotal: getAttributeTotal(result)
    };
  }
  const { newValues, attrDelta, attributeTotal } = initialBiasedDelta(
    data,
    initDelta,
    initDeltaKeys
  );
  return {
    data: newValues,
    attrDelta,
    attributeTotal
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
    weight: 0.65
  },
  {
    id: "1",
    weight: 0.17
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
    weight: 0.08
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

const letterMapping = {
  g: "guard",
  w: "wing",
  b: "big"
};

const classes = {
  guard: {
    height: 191,
    weight: 195,
    hDeviation: 5,
    wDeviation: 15
  },
  wing: {
    height: 201,
    weight: 225,
    hDeviation: 3,
    wDeviation: 20
  },
  big: {
    height: 209,
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
  const randomPosition = chooseOne(playerTypeNames[playerType]);
  const positions = splitOnce(randomPosition, "/");
  const firstPosition = getPosition(positions[0]);
  const secondPosition = getPosition(positions[1]);

  const data = {
    module: "PLAYER",
    tab: "VITALS",
    data: {
      HEIGHT_CM: `${Math.floor(genHeight)}`,
      WEIGHT_LBS: `${genWeight}`,
      WINGSPAN_CM: `${Math.round(
        ((genWingspan / 100) * 0.2 + 0.94) * genHeight
      )}`,
      POSITION: firstPosition,
      SECONDARY_POSITION: secondPosition
    }
  };
  return {
    genHeight,
    genWeight,
    genWingspan,
    randomPosition,
    data
  };
}

function splitOnce(s, on) {
  [first, ...rest] = s.split(on);
  return [first, rest.length > 0 ? rest.join(on) : null];
}

function toFtInFromCm(value) {
  const totalLength = Math.floor(value / 2.54);
  const ft = Math.floor(totalLength / 12);
  const inches = totalLength % 12;
  return `${ft}'${inches}"`;
}

const getPosition = pos => {
  switch (pos) {
    case "PG":
      return "0";
    case "SG":
      return "1";
    case "SF":
      return "2";
    case "PF":
      return "3";
    case "C":
      return "4";
    case null:
      return "5";
  }
};

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

// for a delta, return an rwc

const toMappedKeyWeights = (keys, typeKeys = [], direction) => {
  // base case for wings
  if (!typeKeys.length) {
    return keys.map(key => {
      return {
        id: key,
        weight: 1
      };
    });
  }
  const modifier = direction == "up" ? 2 : -2;
  const mappedKeys = keys.map(key => {
    if (typeKeys.includes(key)) {
      return {
        id: key,
        weight: 4 + modifier
      };
    }
    return {
      id: key,
      weight: 4
    };
  });
  return mappedKeys;
};

const updateValues = (name, values, delta) => {
  const valuesFromJSON = JSON.parse(values);
  const vitalsTab = valuesFromJSON.find(page => page.tab === "VITALS");
  const attributesTab = valuesFromJSON.find(page => page.tab === "ATTRIBUTES");
  const badgesTab = valuesFromJSON.find(page => page.tab === "BADGES");
  const hotzoneTab = valuesFromJSON.find(page => page.tab === "HOTZONE");

  const firstName = splitOnce(name, " ")[0];
  const lastName = splitOnce(name, " ")[1];

  let newAttributes = attributesTab.data;
  let newBadges = badgesTab.data;
  const filteredBadgeKeys = badges.filter(badge => badgesTab.data[badge] > 0);
  const attrDelta = _.sampleSize(keys, 5).map(key => ({
    key,
    value: deltas[delta] * _.random(3, 12) * 3
  }));

  const badgeKeys = delta == "up" ? badges : filteredBadgeKeys;
  const badgeSampleSize = delta == "up" ? 5 : 1;
  const badgeDelta = _.sampleSize(badgeKeys, badgeSampleSize).map(key => ({
    key,
    value: deltas[delta]
  }));
  attrDelta.forEach(({ key, value }) => {
    newAttributes[key] = `${_.clamp(
      parseInt(newAttributes[key]) + value,
      45,
      222
    )}`;
  });
  badgeDelta.forEach(({ key, value }) => {
    newBadges[key] = `${_.clamp(parseInt(newBadges[key]) + value, 0, 4)}`;
  });
  const { data: newTendencies } = generateTendencies(
    { data: newAttributes },
    { data: badgesTab.data },
    hotzoneTab
  );

  newAttributes["STAMINA"] = _.random(90, 222);

  const newValues = [
    {
      module: "PLAYER",
      tab: "VITALS",
      data: {
        FIRSTNAME: firstName,
        LASTNAME: lastName,
        ...vitalsTab.data
      }
    },
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
    }
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
  if (!targetOverall) {
    return "neutral";
  }
  const difference = targetOverall - overall;
  if (Math.abs(difference) < 69) return "neutral";
  if (difference > 0) return "up";
  if (difference < 0) return "down";
  return "error";
}

function toDeltaString(valueDelta) {
  const valueDeltaToUse = valueDelta || [];
  return valueDeltaToUse
    .map(({ key, value }) => `${key}: ${value}`)
    .join(",  ");
}

function runBatch(batchNum) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
  const { generatedPlayers: genPlayersId, players: playerListId } = sheetIds;
  return (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const genPlayers = sheets[genPlayersId];
    const playerListSheet = sheets[playerListId];
    const playersToBatch = genPlayers.getRows().then(rows => {
      return rows.filter(row => {
        // return row.Batch === batchNum && !row.IgnoreBatch;
        return !row.IgnoreBatch;
      });
    });
    playersToBatch.then(rows => {
      // newRows.every(row => row.delta == "neutral");
      let newRows = rows;
      while (!newRows.every(row => row.PrevDelta == "neutral")) {
        newRows = newRows.map(row => {
          const data = row.Values;
          const name = row.Name;
          const delta = toDelta(row.AttributeTotal, row.TargetAttributeTotal);
          // const rowOverall = delta == "neutral" ? row.Overall : "";
          const { newValues, attrDelta, attributeTotal, badgeTotal } =
            updateValues(name, data, delta) || {};
          return {
            ...row,
            AttributeTotal: attributeTotal,
            BadgeTotal: badgeTotal,
            Values: JSON.stringify(newValues),
            Batch: delta == "neutral" ? row.Batch : parseInt(row.Batch) + 1,
            PrevDelta: delta,
            DeltaValues:
              delta == "neutral"
                ? row.DeltaValues
                : `${row.DeltaValues}, ${toDeltaString(attrDelta)}}`
          };
        });
      }
      const playerListRows = newRows.map(row => {
        const { Name, Height, Weight, AttributeTotal, Position, Role, Values } =
          row;
        return {
          Name,
          Height,
          Weight,
          Team: "Rookie",
          AttributeTotal,
          Position,
          Type: Role,
          Data: Values,
          Age: "0"
        };
      });
      return (async () => {
        await genPlayers.addRows(newRows);
        await playerListSheet.addRows(playerListRows);
      })();
    });
  })();
}

// typeString is of gwb
function generatePlayers(typeString) {
  if (!typeString) return;
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
  const { generatedPlayers: genPlayersId } = sheetIds;
  return (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const generatedPlayersSheet = sheets[genPlayersId];
    const rowsToAdd = await typeString.split("").map(char => {
      const playerType = letterMapping[char];
      const {
        data: attributes,
        attributeTotal,
        attrDelta: initAttrDelta
      } = generateAttributes(playerType);
      const { data: badges, badgeTotal } = generateBadges();
      const { data: hotzones } = generateHotzones();
      const initDeltaValues = toDeltaString(initAttrDelta);
      const name = `${faker.name.firstName(0)} ${faker.name.lastName()}`;
      const {
        genHeight,
        genWeight,
        genWingspan,
        data: vitals,
        randomPosition
      } = generateClass(playerType);
      const formattedHeight = toFtInFromCm(genHeight);
      const formattedWingSpan = toFtInFromCm(
        ((genWingspan / 100) * 0.2 + 0.94) * genHeight
      );
      // const biasedAttributes = positionBias(playerType, attributes);
      const { data: tendencies } = generateTendencies(
        attributes,
        badges,
        hotzones
      );
      const player = [vitals, attributes, tendencies, hotzones, badges];
      console.log(vitals);
      return {
        Name: name,
        AttributeTotal: attributeTotal,
        BadgeTotal: badgeTotal,
        Position: randomPosition,
        Height: formattedHeight,
        Weight: genWeight,
        Wingspan: formattedWingSpan,
        WingspanNo: genWingspan,
        Values: JSON.stringify(player),
        DeltaValues: initDeltaValues,
        Role: playerType,
        Level: 1,
        Batch: 0,
        PrevDelta: "N/A",
        DeltaValues: "N/A"
      };
    });
    (async () => {
      await generatedPlayersSheet.addRows(rowsToAdd);
    })();
    console.log(`${rowsToAdd.length} players generated.`);
    return rowsToAdd;
  })();
}

module.exports = { generatePlayers, runBatch };
