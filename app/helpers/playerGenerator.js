const { GoogleSpreadsheet } = require("google-spreadsheet");
const rwc = require('random-weighted-choice');
const rn = require('random-normal');
const faker = require("faker");
faker.setLocale("en");

// attribute formula
// 0 - 222
// (0 - 74) * 3, 25 -> 99 for nba2k stat 
// => (stat - 25) * 3


function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
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

const keys = ["DRIVING_LAYUP", "POST_FADEAWAY", "POST_HOOK", "POST_MOVES", "DRAW_FOUL", "SHOT_CLOSE", "MID-RANGE_SHOT", "3PT_SHOT", "FREE_THROW", "BALL_CONTROL", "PASSING_IQ", "PASSING_ACCURACY", "OFFENSIVE_REBOUND", "STANDING_DUNK", "DRIVING_DUNK", "SHOT_IQ", "PASSING_VISION", "HANDS", "DEFENSIVE_REBOUND", "INTERIOR_DEFENSE", "PERIMETER_DEFENSE", "BLOCK", "STEAL", "SHOT_CONTEST", "REACTION_TIME", "ON-BALL_DEFENSE_IQ", "LATERAL_QUICKNESS", "SPEED", "SPEED_WITH_BALL", "ACCELERATION", "VERTICAL", "STRENGTH", "STAMINA", "HUSTLE", "HEAD_DURABILITY", "NECK_DURABILITY", "BACK_DURABILITY", "LEFT_SHOULDER_DURABILITY", "RIGHT_SHOULDER_DURABILITY", "LEFT_ELBOW_DURABILITY", "RIGHT_ELBOW_DURABILITY", "LEFT_HIP_DURABILITY", "RIGHT_HIP_DURABILITY", "LEFT_KNEE_DURABILITY", "RIGHT_KNEE_DURABILITY", "LEFT_ANKLE_DURABILITY", "RIGHT_ANKLE_DURABILITY", "LEFT_FOOT_DURABILITY", "RIGHT_FOOT_DURABILITY", "MISC_DURABILITY", "PASS_PERCEPTION", "DEFENSIVE_CONSISTENCY", "HELP_DEFENSIVE_IQ", "OFFENSIVE_CONSISTENCY", "PICK_AND_ROLL_DEFENSIVE_IQ", "INTANGIBLES", "POTENTIAL", "EMOTION_ABILITY"]
const badges = ["ACROBAT", "TEAR_DROPPER", "RELENTLESS_FINISHER", "POST_SPIN_TECHNICIAN", "DROP-STEPPER", "PUTBACK_BOSS", "BACKDOWN_PUNISHER", "CONSISTENT_FINISHER", "CONTACT_FINISHER", "CROSS-KEY_SCORER", "DEEP_HOOKS", "PICK_ROLLER", "FANCY_FOOTWORK", "FASTBREAK_FINISHER", "GIANT_SLAYER", "PRO_TOUCH", "SHOWTIME", "SLITHERY_FINISHER", "CATCH_SHOOT", "CORNER_SPECIALIST", "DIFFICULT_SHOTS", "PICK_POPPER", "CLUTCH_SHOOTER", "DEADEYE", "DEEP_FADES", "FLEXIBLE_RELEASE", "GREEN_MACHINE", "HOT_ZONE_HUNTER", "HOT_START", "ICE_IN_VEINS", "PUMP_FAKE_MAESTRO", "QUICK_DRAW", "RANGE_EXTENDER", "SLIPPERY_OFF-BALL", "STEADY_SHOOTER", "TIRELESS_SCORER", "VOLUME_SHOOTER", "ANKLE_BREAKER", "FLASHY_PASSER", "BREAK_STARTER", "LOB_CITY_PASSER", "DIMER", "BAIL_OUT", "DOWNHILL", "DREAM_SHAKE", "HANDLES_FOR_DAYS", "NEEDLE_THREADER", "PASS_FAKE_MAESTRO", "QUICK_FIRST_STEP", "SPACE_CREATOR", "STOP_GO", "TIGHT_HANDLES", "UNPLUCKABLE", "FLOOR_GENERAL", "PICK_POCKET", "RIM_PROTECTOR", "PICK_DODGER", "CHASE_DOWN_ARTIST", "CLAMPS", "DEFENSIVE_STOPPER", "HEART_CRUSHER", "INTERCEPTOR", "INTIMIDATOR", "LIGHTNING_REFLEXES", "MOVING_TRUCK", "OFF-BALL_PEST", "POGO_STICK", "POST_MOVE_LOCKDOWN", "TIRELESS_DEFENDER", "TRAPPER", "LOB_CITY_FINISHER", "BRICK_WALL", "BOX", "REBOUND_CHASER", "WORM"];
const personalityBadges = ["ALPHA_DOG", "ENFORCER", "RESERVED", "FRIENDLY", "TEAM_PLAYER", "EXTREMELY_CONFIDENT", "HIGH_WORK_ETHIC", "LEGENDARY_WORK_ETHIC", "KEEP_IT_REAL", "PAT_MY_BACK", "EXPRESSIVE", "UNPREDICTABLE", "LAID_BACK", "MEDIA_RINGMASTER", "WARM_WEATHER_FAN", "FINANCE_SAVVY", "CAREER_GYM_ELIMINATOR", "ON_COURT_COACH", ];

function generateAttributes() {
    // const out = R("../r_scripts/stat_sim.R").callSync();
    // console.log('out', out);
    // 11 numbers from 80 - 100, 9 num from 70 to 100, 7 num from 60 to 100, 5 num from 50 to 100, 4 num from 40 to 90, 3 from 30 to 80
    let foo = [];
    for ( let step = 0; step < 13; step++ ) {
        foo.push(getRandomInt(80, 99))
    }
    for ( let step = 0; step < 13; step++ ) {
        foo.push(getRandomInt(70, 99))
    }
    for ( let step = 0; step < 11; step++ ) {
        foo.push(getRandomInt(60, 99))
    }
    for ( let step = 0; step < 8; step++ ) {
        foo.push(getRandomInt(50, 99))
    }
    for ( let step = 0; step < 7; step++ ) {
        foo.push(getRandomInt(40, 89))
    }
    for ( let step = 0; step < 6; step++ ) {
        foo.push(getRandomInt(30, 79))
    }
    shuffle(foo);
    const bar = foo.map(num => (num - 25) * 3);
    let result = {};
    keys.forEach((key, index) => result[key] = `${bar[index]}`);
    const data = {
        module: "PLAYER",
        tab: "ATTRIBUTES",
        data: result,
    };
    return data;
};

const weights = [
    {
        id: "0",
        weight: 0.67, 
    },
    {
        id: "1",
        weight: 0.15, 
    },
    {
        id: "2",
        weight: 0.1, 
    },
    {
        id: "3",
        weight: 0.05, 
    },
    {
        id: "4",
        weight: 0.03, 
    },
];

const personalityWeights = [
    {
        id: "0",
        weight: 0.67,
    },
    {
        id: "1",
        weight: 0.33
    }
];

function generateBadges() {
    let result = {}
    personalityBadges.forEach(key => result[key] = rwc(personalityWeights));
    badges.forEach(key => result[key] = rwc(weights));

    const data = {
        module: "PLAYER",
        tab: "BADGES",
        data: result,
    }

    return data;
};

const classes = {
    guard:{
        height: 191,
        weight: 195,
        hDeviation: 5,
        wDeviation: 15,
    }, 
    wing: {
        height: 201,
        weight: 215,
        hDeviation: 7,
        wDeviation: 20,
    },
    big: {
        height: 211,
        weight: 255,
        hDeviation: 5,
        wDeviation: 25,

    },
};

// class = guard, wing, big
function generateClass(playerType) {
    const {
        height,
        weight,
        hDeviation,
        wDeviation,
    } = classes[playerType] || classes.wing;
    const genHeight = rn({ mean: height, dev: hDeviation });
    const genWeight = Math.floor(rn({ mean: weight, dev: wDeviation }));

    const data = {
        module: "PLAYER",
        tab: "VITALS",
        data: {
            HEIGHT_CM: `${Math.floor(genHeight)}`,
            WEIGHT_LBS: `${genWeight}`,
        }
    }
    return ({
        genHeight,
        genWeight,
        data,
    });
};

function toFtInFromCm(value) {
    const totalLength = Math.floor(value / 2.54);
    const ft = Math.floor(totalLength / 12);
    const inches = totalLength % 12;
    return `${ft}'${inches}"`;
};

function generatePlayer(playerType) {
    // 526907503 Generated Players sheetid
    const doc = new GoogleSpreadsheet(
        "1INS-TKERe24QAyJCkhkhWBQK4eAWF8RVffhN1BZNRtA"
      );
    (async function main() {
        await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
        });
        await doc.loadInfo();
        const sheets = doc.sheetsById;
        const sheet = sheets[526907503];
        const attributes = generateAttributes();
        const badges = generateBadges();
        const name = `${faker.name.firstName(0)} ${faker.name.lastName()}`;
        const { genHeight, genWeight, data: vitals } = generateClass(playerType)
        const player = [vitals, attributes, badges];
        JSON.stringify(player);
        (async () => {
            await sheet.addRow({Name: name, Position: playerType, Height: toFtInFromCm(genHeight), Weight: genWeight, Values: JSON.stringify(player) });
        })(); 
    })();
}

module.exports = generatePlayer;