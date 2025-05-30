const _ = require("lodash");
const rn = require("random-normal");
const { badges: badgeKeys } = require("../bots/consts");

const toRandomValue = (stat, low, high) => {
  return _.random(low * stat, high * stat);
};

// attribute-badge association to a tendency
// 3pt shot and deadeye => contest 3 tendency
// driving layup, pro touch, consistent finisher, etc => drivinh layup tendency

// shooting attributes, badges,
// deadeye 3, flexible release 2, quick draw 1, difficult shots 1
// attribute 3pt
// shot 3 tendency
// take the totals
// 7
// attribute 80 3pt
//
// attribute maps to a exponential-esque distribution to create a mean of normal distribution
//

// sample a log base 2, badge total, Rnormal,

const log2 = num => Math.log(num) / Math.log(2);

const toTendencyRNormal =
  ({
    attrKeys = [],
    badgeKeys = [],
    hotzoneKey,
    meanDelta = 15,
    meanScalar = 1
  }) =>
  (attributes, badges, hotzones) => {
    const attrAverage =
      attrKeys.reduce((acc, key) => {
        return acc + attributes[key];
      }, 0) / attrKeys.length;

    const badgeKeysSum = badgeKeys.reduce((acc, key) => {
      return acc + (badges[key] || 0);
    }, 1);
    const { [hotzoneKey]: hotzone = 0 } = hotzones;
    const hotzonescalar = hotzone - 1;
    const timesToSample = Math.floor(log2(badgeKeysSum)) + 1;
    let sampledValues = [];
    const mean = _.clamp(attrAverage - meanDelta, 0, 100) * meanScalar;
    const stdev = (attrAverage - 20) * 0.2;
    for (i = 0; i < timesToSample; i++) {
      sampledValues.push(rn({ mean: mean, dev: stdev }));
    }
    const maxValue = _.max(sampledValues);
    const filteredValues = sampledValues.filter(value => {
      if (value < 100 || value > 0) {
        return true;
      }
      return false;
    });
    if (!filteredValues.length) {
      return `${Math.floor(_.clamp(maxValue + hotzonescalar * 20, 0, 100))}`;
    }
    return `${Math.floor(
      _.clamp(_.max(filteredValues) + hotzonescalar * 10, 0, 100)
    )}`;
  };

const toTendencyRNormalInverse =
  ({
    attrKeys = [],
    badgeKeys = [],
    hotzoneKey,
    meanDelta = 15,
    meanScalar = 1
  }) =>
  (attributes, badges, hotzones) => {
    return `${
      100 -
      parseInt(
        toTendencyRNormal({
          attrKeys,
          badgeKeys,
          hotzoneKey,
          meanDelta,
          meanScalar
        })(attributes, badges, hotzones)
      )
    }`;
  };

const tendencyDictionary = {
  STEP_THROUGH_SHOT_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_CLOSE", "MID-RANGE_SHOT", "3PT_SHOT", "SHOT_IQ"],
    badgeKeys: ["PUMP_FAKE_MAESTRO"],
    meanScalar: 0.6
  }),
  SHOT_UNDER_BASKET_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_CLOSE", "STANDING_DUNK"],
    badgeKeys: ["HOT_ZONE_HUNTER", "CROSS-KEY_SCORER", "GIANT_SLAYER"],
    hotzoneKey: "UNDER_BASKET"
  }),
  SHOT_CLOSE_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_CLOSE", "STANDING_DUNK", "SHOT_IQ"],
    badgeKeys: ["PUMP_FAKE_MAESTRO", "GIANT_SLAYER"]
  }),
  SHOT_CLOSE_LEFT_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_CLOSE"],
    badgeKeys: ["HOT_ZONE_HUNTER", "CROSS-KEY_SCORER", "GREEN_MACHINE"],
    hotzoneKey: "CLOSE_LEFT"
  }),
  SHOT_CLOSE_MIDDLE_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_CLOSE"],
    badgeKeys: ["HOT_ZONE_HUNTER", "CROSS-KEY_SCORER", "GREEN_MACHINE"],
    hotzoneKey: "CLOSE_MIDDLE"
  }),
  SHOT_CLOSE_RIGHT_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_CLOSE"],
    badgeKeys: ["HOT_ZONE_HUNTER", "CROSS-KEY_SCORER", "GREEN_MACHINE"],
    hotzoneKey: "CLOSE_RIGHT"
  }),
  "SHOT_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "QUICK_DRAW",
      "CLUTCH_SHOOTER",
      "GREEN_MACHINE",
      "HOT_ZONE_HUNTER"
    ]
  }),
  "SPOT_UP_SHOT_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "HANDS"],
    badgeKeys: ["CATCH_SHOOT", "PICK_POPPER", "SLIPPERY_OFF-BALL"]
  }),
  "OFF_SCREEN_SHOT_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "QUICK_DRAW", "DIFFICULT_SHOTS"]
  }),
  SHOT_MID_LEFT_TENDENCY: toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT"],
    badgeKeys: ["HOT_ZONE_HUNTER", "GREEN_MACHINE", "CORNER_SPECIALIST"],
    hotzoneKey: "MID_RANGE_LEFT"
  }),
  "SHOT_MID_LEFT-CENTER_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT"],
    badgeKeys: ["HOT_ZONE_HUNTER", "GREEN_MACHINE"],
    hotzoneKey: "MID_RANGE_LEFT_CENTER"
  }),
  SHOT_MID_CENTER_TENDENCY: toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT"],
    badgeKeys: ["HOT_ZONE_HUNTER", "GREEN_MACHINE"],
    hotzoneKey: "MID_CENTER"
  }),
  "SHOT_MID_RIGHT-CENTER_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT"],
    badgeKeys: ["HOT_ZONE_HUNTER", "GREEN_MACHINE"],
    hotzoneKey: "MID_RANGE_RIGHT_CENTER"
  }),
  SHOT_MID_RIGHT_TENDENCY: toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT"],
    badgeKeys: ["HOT_ZONE_HUNTER", "GREEN_MACHINE", "CORNER_SPECIALIST"],
    hotzoneKey: "MID_RANGE_RIGHT"
  }),
  SHOT_THREE_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "QUICK_DRAW",
      "RANGE_EXTENDER",
      "CLUTCH_SHOOTER",
      "GREEN_MACHINE",
      "HOT_ZONE_HUNTER"
    ]
  }),
  SPOT_UP_SHOT_THREE_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "HANDS"],
    badgeKeys: ["CATCH_SHOOT", "PICK_POPPER", "SLIPPERY_OFF-BALL"]
  }),
  OFF_SCREEN_SHOT_THREE_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "QUICK_DRAW",
      "RANGE_EXTENDER",
      "DIFFICULT_SHOTS"
    ]
  }),
  SHOT_THREE_LEFT_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT"],
    badgeKeys: [
      "HOT_ZONE_HUNTER",
      "GREEN_MACHINE",
      "RANGE_EXTENDER",
      "CORNER_SPECIALIST"
    ],
    hotzoneKey: "LEFT_3"
  }),
  "SHOT_THREE_LEFT-CENTER_TENDENCY": toTendencyRNormal({
    attrKeys: ["3PT_SHOT"],
    badgeKeys: ["HOT_ZONE_HUNTER", "GREEN_MACHINE", "RANGE_EXTENDER"],
    hotzoneKey: "3_LEFT-CENTER"
  }),
  SHOT_THREE_CENTER_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT"],
    badgeKeys: ["HOT_ZONE_HUNTER", "GREEN_MACHINE", "RANGE_EXTENDER"],
    hotzoneKey: "CENTER_3"
  }),
  "SHOT_THREE_RIGHT-CENTER_TENDENCY": toTendencyRNormal({
    attrKeys: ["3PT_SHOT"],
    badgeKeys: ["HOT_ZONE_HUNTER", "GREEN_MACHINE", "RANGE_EXTENDER"],
    hotzoneKey: "3_RIGHT-CENTER"
  }),
  SHOT_THREE_RIGHT_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT"],
    badgeKeys: [
      "HOT_ZONE_HUNTER",
      "GREEN_MACHINE",
      "RANGE_EXTENDER",
      "CORNER_SPECIALIST"
    ],
    hotzoneKey: "RIGHT_3"
  }),
  CONTESTED_JUMPER_THREE_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ", "INTANGIBLES"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "QUICK_DRAW",
      "STEADY_SHOOTER",
      "DEADEYE",
      "SLIPPERY_OFF-BALL"
    ],
    meanScalar: 0.6,
    meanDelta: 20
  }),
  "CONTESTED_JUMPER_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "SHOT_IQ", "INTANGIBLES"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "QUICK_DRAW",
      "STEADY_SHOOTER",
      "DEADEYE",
      "SLIPPERY_OFF-BALL"
    ],
    meanScalar: 0.6,
    meanDelta: 20
  }),
  STEPBACK_JUMPER_THREE_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "DIFFICULT_SHOTS",
      "SPACE_CREATOR",
      "DEADEYE",
      "STEADY_SHOOTER"
    ],
    meanScalar: 0.6,
    meanDelta: 20
  }),
  "STEPBACK_JUMPER_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "SHOT_IQ"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "DIFFICULT_SHOTS",
      "SPACE_CREATOR",
      "DEADEYE",
      "STEADY_SHOOTER"
    ],
    meanScalar: 0.7,
    meanDelta: 20
  }),
  SPIN_JUMPER_TENDENCY: toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "3PT_SHOT", "SHOT_IQ"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "DIFFICULT_SHOTS",
      "SPACE_CREATOR",
      "DEADEYE",
      "STEADY_SHOOTER",
      "SHOWTIME"
    ],
    meanScalar: 0.6,
    meanDelta: 20
  }),
  TRANSITION_PULL_UP_THREE_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "DIFFICULT_SHOTS",
      "SPACE_CREATOR",
      "DEADEYE",
      "STEADY_SHOOTER",
      "SHOWTIME"
    ],
    meanScalar: 0.5,
    meanDelta: 20
  }),
  DRIVE_PULL_UP_THREE_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "DIFFICULT_SHOTS",
      "SPACE_CREATOR",
      "DEADEYE",
      "STEADY_SHOOTER"
    ],
    meanScalar: 0.5,
    meanDelta: 20
  }),
  "DRIVE_PULL_UP_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "SHOT_IQ"],
    badgeKeys: [
      "FLEXIBLE_RELEASE",
      "DIFFICULT_SHOTS",
      "SPACE_CREATOR",
      "DEADEYE",
      "STEADY_SHOOTER"
    ],
    meanScalar: 0.7,
    meanDelta: 20
  }),
  USE_GLASS_TENDENCY: () => _.random(1, 99),
  DRIVING_LAYUP_TENDENCY: toTendencyRNormal({
    attrKeys: ["DRIVING_LAYUP", "DRIVING_DUNK", "DRAW_FOUL"],
    badgeKeys: [
      "PRO_TOUCH",
      "CONSISTENT_FINISHER",
      "RELENTLESS_FINISHER",
      "GIANT_SLAYER",
      "SLITHERY_FINISHER"
    ],
    meanDelta: 5
  }),
  STANDING_DUNK_TENDENCY: toTendencyRNormal({
    attrKeys: ["STANDING_DUNK", "STRENGTH", "VERTICAL"],
    badgeKeys: ["CONTACT_FINISHER"],
    meanDelta: 5
  }),
  DRIVING_DUNK_TENDENCY: toTendencyRNormal({
    attrKeys: ["DRIVING_DUNK", "STRENGTH", "DRAW_FOUL"],
    badgeKeys: ["CONTACT_FINISHER", "RELENTLESS_FINISHER", "SLITHERY_FINISHER"],
    meanDelta: 5
  }),
  FLASHY_DUNK_TENDENCY: () => _.random(0, 99),
  "ALLEY-OOP_TENDENCY": toTendencyRNormal({
    attrKeys: ["DRIVING_DUNK", "SPEED", "STANDING_DUNK", "ACCELERATION"],
    badgeKeys: ["LOB_CITY_FINISHER", "SLIPPERY_OFF-BALL", "PICK_ROLLER"]
  }),
  PUTBACK_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_CLOSE", "OFFENSIVE_REBOUND", "STANDING_DUNK"],
    badgeKeys: ["BOX", "WORM", "REBOUND_CHASER", "PUTBACK_BOSS"]
  }),
  CRASH_TENDENCY: () => `${_.random(0, 40)}`,
  SPIN_LAYUP_TENDENCY: toTendencyRNormal({
    attrKeys: ["DRIVING_LAYUP", "BALL_CONTROL", "ACCELERATION"],
    badgeKeys: ["FANCY_FOOTWORK", "ACROBAT"]
  }),
  HOP_STEP_LAYUP_TENDENCY: toTendencyRNormal({
    attrKeys: ["DRIVING_LAYUP", "BALL_CONTROL", "ACCELERATION"],
    badgeKeys: ["FANCY_FOOTWORK", "ACROBAT"]
  }),
  EURO_STEP_LAYUP_TENDENCY: toTendencyRNormal({
    attrKeys: ["DRIVING_LAYUP", "BALL_CONTROL", "ACCELERATION"],
    badgeKeys: ["FANCY_FOOTWORK", "ACROBAT"]
  }),
  FLOATER_TENDENCY: toTendencyRNormal({
    attrKeys: ["DRIVING_LAYUP", "SHOT_CLOSE", "MID-RANGE_SHOT"],
    badgeKeys: ["TEAR_DROPPER", "CROSS-KEY_SCORER", "STEADY_SHOOTER"]
  }),
  TRIPLE_THREAT_PUMP_FAKE_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "ACCELERATION", "PASSING_IQ", "PASSING_VISION"],
    badgeKeys: ["PUMP_FAKE_MAESTRO", "PASS_FAKE_MAESTRO", "QUICK_FIRST_STEP"]
  }),
  TRIPLE_THREAT_JAB_STEP_TENDENCY: toTendencyRNormal({
    attrKeys: [
      "SHOT_IQ",
      "ACCELERATION",
      "BALL_CONTROL",
      "MID-RANGE_SHOT",
      "3PT_SHOT"
    ],
    badgeKeys: ["QUICK_FIRST_STEP", "FLOOR_GENERAL", "QUICK_DRAW"]
  }),
  TRIPLE_THREAT_IDLE_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "OFFENSIVE_CONSISTENCY"],
    badgeKeys: ["QUICK_FIRST_STEP", "FLOOR_GENERAL"]
  }),
  TRIPLE_THREAT_SHOOT_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "3PT_SHOT", "MID-RANGE_SHOT", "SHOT_CLOSE"],
    badgeKeys: ["PUMP_FAKE_MAESTRO", "STEADY_SHOOTER", "QUICK_DRAW"]
  }),
  SETUP_WITH_SIZEUP_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "OFFENSIVE_CONSISTENCY"],
    badgeKeys: ["QUICK_FIRST_STEP", "TIGHT_HANDLES", "FLOOR_GENERAL"]
  }),
  SETUP_WITH_HESITATION_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "3PT_SHOT", "MID-RANGE_SHOT"],
    badgeKeys: ["QUICK_FIRST_STEP", "STOP_GO", "SPACE_CREATOR"]
  }),
  NO_SETUP_DRIBBLE_TENDENCY: toTendencyRNormal({
    attrKeys: ["SPEED_WITH_BALL", "BALL_CONTROL"],
    badgeKeys: ["QUICK_FIRST_STEP", "TIGHT_HANDLES", "UNPLUCKABLE"]
  }),
  DRIVE_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: ["QUICK_FIRST_STEP", "TIGHT_HANDLES", "UNPLUCKABLE"]
  }),
  SPOT_UP_DRIVE_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION", "HANDS"],
    badgeKeys: ["QUICK_FIRST_STEP", "TIGHT_HANDLES", "UNPLUCKABLE"]
  }),
  OFF_SCREEN_DRIVE_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION", "SHOT_IQ"],
    badgeKeys: ["QUICK_FIRST_STEP", "TIGHT_HANDLES", "UNPLUCKABLE"]
  }),
  DRIVE_RIGHT_TENDENCY: () => _.random(0, 99),
  DRIVE_CROSSOVER_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: [
      "ANKLE_BREAKER",
      "STOP_GO",
      "SPACE_CREATOR",
      "TIGHT_HANDLES",
      "UNPLUCKABLE",
      "HANDLES_FOR_DAYS"
    ]
  }),
  DRIVE_SPIN_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: [
      "ANKLE_BREAKER",
      "STOP_GO",
      "SPACE_CREATOR",
      "TIGHT_HANDLES",
      "UNPLUCKABLE",
      "HANDLES_FOR_DAYS"
    ]
  }),
  DRIVING_STEP_BACK_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: [
      "ANKLE_BREAKER",
      "STOP_GO",
      "SPACE_CREATOR",
      "TIGHT_HANDLES",
      "UNPLUCKABLE",
      "HANDLES_FOR_DAYS"
    ]
  }),
  DRIVING_HALF_SPIN_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: [
      "ANKLE_BREAKER",
      "STOP_GO",
      "SPACE_CREATOR",
      "TIGHT_HANDLES",
      "UNPLUCKABLE",
      "HANDLES_FOR_DAYS"
    ]
  }),
  DRIVING_DOUBLE_CROSSOVER_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: [
      "ANKLE_BREAKER",
      "STOP_GO",
      "SPACE_CREATOR",
      "TIGHT_HANDLES",
      "UNPLUCKABLE",
      "HANDLES_FOR_DAYS"
    ]
  }),
  DRIVING_BEHIND_THE_BACK_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: [
      "ANKLE_BREAKER",
      "STOP_GO",
      "SPACE_CREATOR",
      "TIGHT_HANDLES",
      "UNPLUCKABLE",
      "HANDLES_FOR_DAYS"
    ]
  }),
  DRIVING_DRIBBLE_HESITATION_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: [
      "ANKLE_BREAKER",
      "STOP_GO",
      "SPACE_CREATOR",
      "TIGHT_HANDLES",
      "UNPLUCKABLE",
      "HANDLES_FOR_DAYS"
    ]
  }),
  DRIVING_IN_AND_OUT_TENDENCY: toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: [
      "ANKLE_BREAKER",
      "STOP_GO",
      "SPACE_CREATOR",
      "TIGHT_HANDLES",
      "UNPLUCKABLE",
      "HANDLES_FOR_DAYS"
    ]
  }),
  NO_DRIVING_DRIBBLE_MOVE_TENDENCY: toTendencyRNormalInverse({
    attrKeys: ["BALL_CONTROL"],
    badgeKeys: [
      "ANKLE_BREAKER",
      "STOP_GO",
      "SPACE_CREATOR",
      "TIGHT_HANDLES",
      "UNPLUCKABLE",
      "HANDLES_FOR_DAYS"
    ],
    meanDelta: 35
  }),
  ATTACK_STRONG_ON_DRIVE_TENDENCY: toTendencyRNormal({
    attrKeys: ["DRIVING_LAYUP", "DRIVING_DUNK", "SHOT_IQ"],
    badgeKeys: [
      "PRO_TOUCH",
      "GIANT_SLAYER",
      "CONTACT_FINISHER",
      "CONSISTENT_FINISHER",
      "SLITHERY_FINISHER",
      "SHOWTIME"
    ]
  }),
  DISH_TO_OPEN_MAN_TENDENCY: toTendencyRNormal({
    attrKeys: ["PASSING_IQ", "PASSING_VISION", "PASSING_ACCURACY"],
    badgeKeys: ["DIMER", "NEEDLE_THREADER", "BAIL_OUT"]
  }),
  FLASHY_PASS_TENDENCY: toTendencyRNormal({
    attrKeys: ["PASSING_IQ", "PASSING_VISION", "PASSING_ACCURACY"],
    badgeKeys: ["DIMER", "NEEDLE_THREADER", "FLASHY_PASSER", "SHOWTIME"]
  }),
  "ALLEY-OOP_PASS_TENDENCY": toTendencyRNormal({
    attrKeys: ["PASSING_IQ", "PASSING_VISION", "PASSING_ACCURACY"],
    badgeKeys: ["DIMER", "NEEDLE_THREADER", "LOB_CITY_PASSER", "FLASHY_PASSER"]
  }),
  POST_UP_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_MOVES", "POST_FADEAWAY", "POST_HOOK"],
    badgeKeys: ["BACKDOWN_PUNISHER", "DROP-STEPPER", "DREAM_SHAKE"]
  }),
  POST_SHIMMY_SHOT_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_MOVES"],
    badgeKeys: ["DREAM_SHAKE"]
  }),
  POST_FACE_UP_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_MOVES", "ACCELERATION"],
    badgeKeys: ["QUICK_FIRST_STEP", "DREAM_SHAKE"]
  }),
  POST_BACK_DOWN_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_MOVES", "POST_FADEAWAY", "STRENGTH"],
    badgeKeys: ["DREAM_SHAKE", "BACKDOWN_PUNISHER", "DROP-STEPPER"]
  }),
  POST_AGGRESSIVE_BACKDOWN_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_MOVES", "STRENGTH"],
    badgeKeys: ["BACKDOWN_PUNISHER", "DROP-STEPPER"]
  }),
  SHOOT_FROM_POST_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_HOOK", "POST_FADEAWAY", "SHOT_IQ"],
    badgeKeys: ["DEEP_HOOKS", "DEEP_FADES"]
  }),
  POST_HOOK_LEFT_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_HOOK"],
    badgeKeys: ["DEEP_HOOKS"]
  }),
  POST_HOOK_RIGHT_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_HOOK"],
    badgeKeys: ["DEEP_HOOKS"]
  }),
  POST_FADE_LEFT_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_FADEAWAY"],
    badgeKeys: ["DEEP_FADES"]
  }),
  POST_FADE_RIGHT_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_FADEAWAY"],
    badgeKeys: ["DEEP_FADES"]
  }),
  POST_UP_AND_UNDER_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "SHOT_CLOSE"],
    badgeKeys: ["DROP-STEPPER", "DREAM_SHAKE", "PUMP_FAKE_MAESTRO"]
  }),
  POST_HOP_SHOT_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_HOOK", "MID-RANGE_SHOT"],
    badgeKeys: ["DIFFICULT_SHOTS", "SPACE_CREATOR"]
  }),
  POST_STEP_BACK_SHOT_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_FADEAWAY", "MID-RANGE_SHOT"],
    badgeKeys: ["DEEP_FADES", "DIFFICULT_SHOTS", "SPACE_CREATOR"]
  }),
  POST_DRIVE_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_MOVES", "STRENGTH"],
    badgeKeys: ["POST_SPIN_TECHNICIAN"]
  }),
  POST_SPIN_TENDENCY: toTendencyRNormal({
    attrKeys: ["POST_MOVES", "ACCELERATION"],
    badgeKeys: ["POST_SPIN_TECHNICIAN"]
  }),
  POST_DROP_STEP_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "SHOT_CLOSE"],
    badgeKeys: ["DROP-STEPPER"]
  }),
  POST_HOP_STEP_TENDENCY: toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "SHOT_CLOSE"],
    badgeKeys: ["DROP-STEPPER"]
  }),
  SHOT_TENDENCY: toTendencyRNormal({
    attrKeys: [
      "SHOT_IQ",
      "SHOT_CLOSE",
      "3PT_SHOT",
      "MID-RANGE_SHOT",
      "POST_FADEAWAY",
      "POST_HOOK",
      "DRIVING_LAYUP",
      "DRIVING_DUNK"
    ],
    badgeKeys: ["FLOOR_GENERAL", "GREEN_MACHINE", "SHOWTIME", "HOT_START"]
  }),
  TOUCHES_TENDENCY: () => {
    return `${_.random(0, 99)}`;
  },
  "ROLL_VS._POP_TENDENCY": (attributes, badges) => {
    const { ["3PT_SHOT"]: threePoint } = attributes;
    const {
      ["PICK_ROLLER"]: pickRoller,
      ["PICK_POPPER"]: pickPopper,
      ["CATCH_SHOOT"]: catchShoot
    } = badges;
    const result = _.clamp(
      _.random(35, 65) +
        _.random(0.1 * threePoint, 0.2 * threePoint) +
        _.random(1 * pickPopper, 2 * pickPopper) +
        _.random(1 * catchShoot, 2 * catchShoot) -
        _.random(4 * pickRoller, 6 * pickRoller),
      0,
      99
    );
    return `${result}`;
  },
  TRANSITION_SPOT_UP_TENDENCY: toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "MID-RANGE_SHOT"],
    badgeKeys: ["CATCH_SHOOT", "SLIPPERY_OFF-BALL"]
  }),
  // "ISO_VS._ELITE_DEFENDER_TENDENCY": () => {
  //   return `${_.random(0,99)}`;
  // },
  // "ISO_VS._GOOD_DEFENDER_TENDENCY": () => {
  //   return `${_.random(0,99)}`;
  // },
  // "ISO_VS._AVERAGE_DEFENDER_TENDENCY": () => {
  //   return `${_.random(0,99)}`;
  // },
  // "ISO_VS._POOR_DEFENDER_TENDENCY": () => {
  //   return `${_.random(0,99)}`;
  // },
  PLAY_DISCIPLINE_TENDENCY: () => {
    return `${_.random(0, 99)}`;
  },
  PASS_INTERCEPTION_TENDENCY: toTendencyRNormal({
    attrKeys: ["PASS_PERCEPTION"],
    badgeKeys: ["INTERCEPTOR", "HEART_CRUSHER"]
  }),
  TAKE_CHARGE_TENDENCY: () => {
    return "0";
  },
  "ON-BALL_STEAL_TENDENCY": toTendencyRNormal({
    attrKeys: ["STEAL"],
    badgeKeys: ["PICK_POCKET", "HEART_CRUSHER"],
    meanDelta: 10
  }),
  CONTEST_SHOT_TENDENCY: toTendencyRNormal({
    attrKeys: ["INTERIOR_DEFENSE", "PERIMETER_DEFENSE", "LATERAL_QUICKNESS"],
    badgeKeys: ["INTIMIDATOR", "CLAMPS", "TIRELESS_DEFENDER"],
    meanDelta: 5
  }),
  BLOCK_SHOT_TENDENCY: toTendencyRNormal({
    attrKeys: ["BLOCK"],
    badgeKeys: [
      "RIM_PROTECTOR",
      "POGO_STICK",
      "CHASE_DOWN_ARTIST",
      "HEART_CRUSHER"
    ],
    meanDelta: 10
  }),
  FOUL_TENDENCY: toTendencyRNormalInverse({
    attrKeys: ["INTERIOR_DEFENSE", "PERIMETER_DEFENSE", "LATERAL_QUICKNESS"],
    badgeKeys: ["INTIMIDATOR", "CLAMPS"],
    meanScalar: 0.6
  }),
  HARD_FOUL_TENDENCY: toTendencyRNormalInverse({
    attrKeys: ["INTERIOR_DEFENSE", "PERIMETER_DEFENSE", "LATERAL_QUICKNESS"],
    badgeKeys: ["INTIMIDATOR", "CLAMPS"]
  })
};

const isoTendenciesOnly = [
  "ISO_VS._ELITE_DEFENDER_TENDENCY",
  "ISO_VS._GOOD_DEFENDER_TENDENCY",
  "ISO_VS._AVERAGE_DEFENDER_TENDENCY",
  "ISO_VS._POOR_DEFENDER_TENDENCY"
];

const toIsoTendencies = () => {
  const arrayofTendencyValues = [];
  for (i = 0; i < 4; i++) {
    arrayofTendencyValues.push(
      Math.floor(_.clamp(rn({ mean: 25, dev: 15 }), 0, 100))
    );
  }
  const sortedValues = _.sortBy(arrayofTendencyValues);
  const result = isoTendenciesOnly.reduce((acc, key, index) => {
    return {
      ...acc,
      [key]: `${sortedValues[index]}`
    };
  }, {});
  return result;
};

/**
 * TENDENCY: {
 *  attributes: {
 *    attr1: {
 *      upper: 0.2
 *      lower: 0.1
 *      delta: -1
 *    }
 *    attr2: {
 *    }
 *
 *  }
 *  badges: {
 *    badge1: {
 *      upper: 4
 *      lower: 1
 *      delta: 1
 *    }
 *  }
 * }
 */

module.exports = { tendencyDictionary, toIsoTendencies };
