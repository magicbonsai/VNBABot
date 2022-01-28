const _ = require('lodash');
const rn = require("random-normal");
const { badges: badgeKeys } = require('../bots/consts');

const toRandomValue = (stat, low, high) => {
  return _.random(low*stat, high*stat);
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

const log2 = (num) => Math.log(num) / Math.log(2);

const toTendencyRNormal = ({attrKeys = [], badgeKeys = [], hotzoneKey, meanScalar = 1}) => (attributes, badges, hotzones) => {
  const attrAverage = attrKeys.reduce((acc, key) => {
    return acc + attributes[key];
  }, 0) / attrKeys.length;

  const badgeKeysSum = badgeKeys.reduce((acc, key) => {
    return acc + badges[key];
  });

  const {
    [hotzoneKey]: hotzone = 1,
  } = hotzones;
  const hotzonescalar = hotzone - 1; // -1 to 1 scale;
  const timesToSample = Math.floor(log2(badgeKeysSum));
  let sampledValues = [];
  for(i = 0; i < timesToSample; i++) {
    sampledValues.push(_.clamp(rn({ mean: (attrAverage + 15) * meanScalar, sd: (attrAverage - 20) * 0.2})), 0, 100);
  };
  const maxValue = _.max(sampledValues);

  return _.clamp(maxValue + (hotzonescalar * 25), 0, 100);
};
const toHotzoneTendency = (key, attributeKey) => (attributes, badges, hotzones) => {
  const {
    [attributeKey]: attr = 0,
  } = attributes;
  const {
    [key]: hotzoneKey,
  } = hotzones;
  const {
    ["HOT_ZONE_HUNTER"]: hotZoneHunter,
  } = badges;
  // hotzone value ranges from -1 to 1, scaling to 1 to 3;
  const adjustedHotzone = hotzoneKey + 2;
  return _.clamp(toRandomValue(attr, 0.2, 0.4) + toRandomValue(adjustedHotzone, 5, 15) + toRandomValue(hotZoneHunter, 1, 4));
  return _.clamp(rn({ mean: attr, dev: 4}), 0, 99);
};

const tendencyDictionary = {
  "STEP_THROUGH_SHOT_TENDENCY": toTendencyRNormal({
    attrKeys: ["SHOT_CLOSE", "MID-RANGE_SHOT", "3PT_SHOT", "SHOT_IQ"],
    badgeKeys: ["PUMP_FAKE_MAESTRO", ],
    meanScalar: 0.6,
  }),
  "SHOT_UNDER_BASKET_TENDENCY": toHotzoneTendency("UNDER_BASKET"),
  "SHOT_CLOSE_TENDENCY":  toTendencyRNormal({
    attrKeys: ["SHOT_CLOSE", "STANDING_DUNK", "SHOT_IQ"],
    badgeKeys: ["PUMP_FAKE_MAESTRO", "GIANT_SLAYER", ""],
  }),
  "SHOT_CLOSE_LEFT_TENDENCY": toHotzoneTendency("CLOSE_LEFT", "SHOT_CLOSE"),
  "SHOT_CLOSE_MIDDLE_TENDENCY": toHotzoneTendency("CLOSE_MIDDLE", "SHOT_CLOSE"),
  "SHOT_CLOSE_RIGHT_TENDENCY": toHotzoneTendency("CLOSE_RIGHT", "SHOT_CLOSE"),
  "SHOT_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT"],
    badgeKeys: ["FLEXIBLE_RELEASE", "QUICK_DRAW"],
  }),
  "SPOT_UP_SHOT_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT"],
    badgeKeys: ["CATCH_SHOOT", "PICK_POPPER", "SLIPPERY_OFF-BALL"],
  }),
  "OFF_SCREEN_SHOT_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "QUICK_DRAW", "DIFFICULT_SHOTS"],
  }),
  "SHOT_MID_LEFT_TENDENCY": toHotzoneTendency("MID_RANGE_LEFT", "MID-RANGE_SHOT"),
  "SHOT_MID_LEFT-CENTER_TENDENCY": toHotzoneTendency("MID_RANGE_LEFT_CENTER", "MID-RANGE_SHOT"),
  "SHOT_MID_CENTER_TENDENCY": toHotzoneTendency("MID_CENTER", "MID-RANGE_SHOT"),
  "SHOT_MID_RIGHT-CENTER_TENDENCY": toHotzoneTendency("MID_RANGE_RIGHT_CENTER", "MID-RANGE_SHOT"),
  "SHOT_MID_RIGHT_TENDENCY": toHotzoneTendency("MID_RANGE_RIGHT", "MID-RANGE_SHOT"),
  "SHOT_THREE_TENDENCY": toTendencyRNormal({
    attrKeys: ["3PT_SHOT"],
    badgeKeys: ["FLEXIBLE_RELEASE", "QUICK_DRAW", "RANGE_EXTENDER"],
  }),
  "SPOT_UP_SHOT_THREE_TENDENCY": toTendencyRNormal({
    attrKeys: ["3PT_SHOT"],
    badgeKeys: ["CATCH_SHOOT", "PICK_POPPER", "SLIPPERY_OFF-BALL"],
  }),
  "OFF_SCREEN_SHOT_THREE_TENDENCY": toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "QUICK_DRAW", "RANGE_EXTENDER", "DIFFICULT_SHOTS"],
  }),
  "SHOT_THREE_LEFT_TENDENCY": toHotzoneTendency("LEFT_3", "3PT_SHOT"),
  "SHOT_THREE_LEFT-CENTER_TENDENCY": toHotzoneTendency("3_LEFT-CENTER", "3PT_SHOT"),
  "SHOT_THREE_CENTER_TENDENCY": toHotzoneTendency("CENTER_3", "3PT_SHOT"),
  "SHOT_THREE_RIGHT-CENTER_TENDENCY": toHotzoneTendency("3_RIGHT-CENTER", "3PT_SHOT"),
  "SHOT_THREE_RIGHT_TENDENCY": toHotzoneTendency("RIGHT_3", "3PT_SHOT"),
  "CONTESTED_JUMPER_THREE_TENDENCY": toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "QUICK_DRAW", "STEADY_SHOOTER", "DEAD_EYE"],
    meanScalar: 0.4
  }),
  "CONTESTED_JUMPER_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "QUICK_DRAW", "STEADY_SHOOTER", "DEAD_EYE"],
    meanScalar: 0.4
  }),
  "STEPBACK_JUMPER_THREE_TENDENCY": toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "DIFFICULT_SHOTS", "SPACE_CREATOR"],
    meanScalar: 0.4
  }),
  "STEPBACK_JUMPER_MID-RANGE_TENDENCY": toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "DIFFICULT_SHOTS", "SPACE_CREATOR"],
    meanScalar: 0.4
  }),
  "SPIN_JUMPER_TENDENCY":  toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT","3PT_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "DIFFICULT_SHOTS", "SPACE_CREATOR"],
    meanScalar: 0.4
  }),
  "TRANSITION_PULL_UP_THREE_TENDENCY": toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "DIFFICULT_SHOTS", "SPACE_CREATOR"],
    meanScalar: 0.3
  }),
  "DRIVE_PULL_UP_THREE_TENDENCY":  toTendencyRNormal({
    attrKeys: ["3PT_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "DIFFICULT_SHOTS", "SPACE_CREATOR"],
    meanScalar: 0.3
  }),
  "DRIVE_PULL_UP_MID-RANGE_TENDENCY":  toTendencyRNormal({
    attrKeys: ["MID-RANGE_SHOT", "SHOT_IQ"],
    badgeKeys: ["FLEXIBLE_RELEASE", "DIFFICULT_SHOTS", "SPACE_CREATOR"],
    meanScalar: 0.3
  }),
  "USE_GLASS_TENDENCY": () => _.random(1,99),
  "DRIVING_LAYUP_TENDENCY": "10",
  "STANDING_DUNK_TENDENCY": "75",
  "DRIVING_DUNK_TENDENCY": "75",
  "FLASHY_DUNK_TENDENCY": "15",
  "ALLEY-OOP_TENDENCY": "50",
  "PUTBACK_TENDENCY": "35",
  "CRASH_TENDENCY": "5",
  "SPIN_LAYUP_TENDENCY": "0",
  "HOP_STEP_LAYUP_TENDENCY": "0",
  "EURO_STEP_LAYUP_TENDENCY": "0",
  "FLOATER_TENDENCY": "20",
  "TRIPLE_THREAT_PUMP_FAKE_TENDENCY": "95",
  "TRIPLE_THREAT_JAB_STEP_TENDENCY": "95",
  "TRIPLE_THREAT_IDLE_TENDENCY": "0",
  "TRIPLE_THREAT_SHOOT_TENDENCY": "40",
  "SETUP_WITH_SIZEUP_TENDENCY": "5",
  "SETUP_WITH_HESITATION_TENDENCY": "5",
  "NO_SETUP_DRIBBLE_TENDENCY": "0",
  "DRIVE_TENDENCY": "50",
  "SPOT_UP_DRIVE_TENDENCY": "55",
  "OFF_SCREEN_DRIVE_TENDENCY": "55",
  "DRIVE_RIGHT_TENDENCY": "75",
  "DRIVE_CROSSOVER_TENDENCY": toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: ["ANKLE_BREAKER", "STOP_GO", "SPACE_CREATOR", "TIGHT_HANDLES", "UNPLUCKABLE"],
  }),
  "DRIVE_SPIN_TENDENCY":  toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: ["ANKLE_BREAKER", "STOP_GO", "SPACE_CREATOR", "TIGHT_HANDLES", "UNPLUCKABLE"],
  }),
  "DRIVING_STEP_BACK_TENDENCY":  toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: ["ANKLE_BREAKER", "STOP_GO", "SPACE_CREATOR", "TIGHT_HANDLES", "UNPLUCKABLE"],
  }),
  "DRIVING_HALF_SPIN_TENDENCY":  toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: ["ANKLE_BREAKER", "STOP_GO", "SPACE_CREATOR", "TIGHT_HANDLES", "UNPLUCKABLE"],
  }),
  "DRIVING_DOUBLE_CROSSOVER_TENDENCY":  toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: ["ANKLE_BREAKER", "STOP_GO", "SPACE_CREATOR", "TIGHT_HANDLES", "UNPLUCKABLE"],
  }),
  "DRIVING_BEHIND_THE_BACK_TENDENCY":  toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: ["ANKLE_BREAKER", "STOP_GO", "SPACE_CREATOR", "TIGHT_HANDLES", "UNPLUCKABLE"],
  }),
  "DRIVING_DRIBBLE_HESITATION_TENDENCY":  toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: ["ANKLE_BREAKER", "STOP_GO", "SPACE_CREATOR", "TIGHT_HANDLES", "UNPLUCKABLE"],
  }),
  "DRIVING_IN_AND_OUT_TENDENCY":  toTendencyRNormal({
    attrKeys: ["BALL_CONTROL", "SPEED_WITH_BALL", "ACCELERATION"],
    badgeKeys: ["ANKLE_BREAKER", "STOP_GO", "SPACE_CREATOR", "TIGHT_HANDLES", "UNPLUCKABLE"],
  }),
  "NO_DRIVING_DRIBBLE_MOVE_TENDENCY": "99",
  "ATTACK_STRONG_ON_DRIVE_TENDENCY":  toTendencyRNormal({
    attrKeys: ["DRIVING_LAYUP", "DRIVING_DUNK", "SHOT_IQ"],
    badgeKeys: ["PRO_TOUCH", "GIANT_SLAYER", "CONTACT_FINISHER", "CONSISTENT_FINISHER", "SLITHERY_FINISHER"],
  }),
  "DISH_TO_OPEN_MAN_TENDENCY": toTendencyRNormal({
    attrKeys: ["PASSING_IQ", "PASSING_VISION", "PASSING_ACCURACY"],
    badgeKeys: ["DIMER", "NEEDLE_THREADER", "BAIL_OUT"],
  }),
  "FLASHY_PASS_TENDENCY": toTendencyRNormal({
    attrKeys: ["PASSING_IQ", "PASSING_VISION", "PASSING_ACCURACY"],
    badgeKeys: ["DIMER", "NEEDLE_THREADER", "FLASHY_PASSER"],
  }),
  "ALLEY-OOP_PASS_TENDENCY": toTendencyRNormal({
    attrKeys: ["PASSING_IQ", "PASSING_VISION", "PASSING_ACCURACY"],
    badgeKeys: ["DIMER", "NEEDLE_THREADER", "LOB_CITY_PASSER"],
  }),
  "POST_UP_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_MOVES", "POST_FADEAWAY", "POST_HOOK"],
    badgeKeys: [],
  }),
  "POST_SHIMMY_SHOT_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_MOVES"],
    badgeKeys: ["DREAM_SHAKE"],
  }),
  "POST_FACE_UP_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_MOVES"],
    badgeKeys: ["QUICK_FIRST_STEP", "DREAM_SHAKE"],
  }),
  "POST_BACK_DOWN_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_MOVES", "POST_FADEAWAY"],
    badgeKeys: ["DREAM_SHAKE"],
  }),
  "POST_AGGRESSIVE_BACKDOWN_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_MOVES"],
    badgeKeys: ["BACKDOWN_PUNISHER"],
  }),
  "SHOOT_FROM_POST_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_HOOK", "POST_FADEAWAY", "SHOT_IQ"],
    badgeKeys: ["DEEP_HOOKS", "DEEP_FADES"],
  }),
  "POST_HOOK_LEFT_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_HOOK"],
    badgeKeys: ["DEEP_HOOKS"],
  }),
  "POST_HOOK_RIGHT_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_HOOK"],
    badgeKeys: ["DEEP_HOOKS"],
  }),
  "POST_FADE_LEFT_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_FADEAWAY"],
    badgeKeys: ["DEEP_FADES"],
  }),
  "POST_FADE_RIGHT_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_FADEAWAY"],
    badgeKeys: ["DEEP_FADES"],
  }),
  "POST_UP_AND_UNDER_TENDENCY": toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "SHOT_CLOSE"],
    badgeKeys: ["DROP-STEPPER", "DREAM_SHAKE", "PUMP_FAKE_MAESTRO"],
  }),
  "POST_HOP_SHOT_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_HOOK", "MID-RANGE_SHOT"],
    badgeKeys: ["DIFFICULT_SHOTS", "SPACE_CREATOR"],
  }),
  "POST_STEP_BACK_SHOT_TENDENCY": toTendencyRNormal({
    attrKeys: ["POST_FADEAWAY", "MID-RANGE_SHOT"],
    badgeKeys: ["DEEP_FADES", "DIFFICULT_SHOTS", "SPACE_CREATOR"],
  }),
  "POST_DRIVE_TENDENCY": toTendencyRNormal({
    attrKeys: ["STRENGTH"],
    badgeKeys: ["POST_SPIN_TECHNICIAN"],
  }),
  "POST_SPIN_TENDENCY": toTendencyRNormal({
    attrKeys: ["ACCELERATION"],
    badgeKeys: ["POST_SPIN_TECHNICIAN"],
  }),
  "POST_DROP_STEP_TENDENCY": toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "SHOT_CLOSE"],
    badgeKeys: ["DROP-STEPPER"],
  }),
  "POST_HOP_STEP_TENDENCY": toTendencyRNormal({
    attrKeys: ["SHOT_IQ", "SHOT_CLOSE"],
    badgeKeys: ["DROP-STEPPER"],
  }),
  "SHOT_TENDENCY": () => {
    return _.random(0,99);
  },
  "TOUCHES_TENDENCY": () => {
    return _.random(0,99);
  },
  "ROLL_VS._POP_TENDENCY": (attributes, badges) => {
    const {
      ["3PT_SHOT"]: threePoint,
    } = attributes;
    const {
      ["PICK_ROLLER"]: pickRoller,
      ["PICK_POPPER"]: pickPopper,
      ["CATCH_SHOOT"]: catchShoot,
    } = badges;
    return _.clamp(
      _.random(35,65) + _.random(0.1 * threePoint, 0.2 * threePoint) + _.random(1*pickPopper, 2* pickPopper) + _.random(1*catchShoot, 2*catchShoot) - _.random(4*pickRoller, 6*pickRoller), 
      0, 
      99
    );
  },
  "TRANSITION_SPOT_UP_TENDENCY": (attributes, badges) => {
    const {
      ["3PT_SHOT"]: threePoint,
    } = attributes;
    const {
      ["CATCH_SHOOT"]: catchShoot,
      ["DEADEYE"]: deadEye,
    } = badges;
    return _.clamp(_.random(30,60) + _.random(0.1 * threePoint, 0.2 * threePoint) + _.random(catchShoot, catchShoot*3) + _.random(deadEye, deadEye*2),0,99);
  },
  "ISO_VS._ELITE_DEFENDER_TENDENCY": () => {
    return _.random(0,99);
  },
  "ISO_VS._GOOD_DEFENDER_TENDENCY": () => {
    return _.random(0,99);
  },
  "ISO_VS._AVERAGE_DEFENDER_TENDENCY": () => {
    return _.random(0,99);
  },
  "ISO_VS._POOR_DEFENDER_TENDENCY": () => {
    return _.random(0,99);
  },
  "PLAY_DISCIPLINE_TENDENCY": () => {
    return _.random(5,99);
  },
  "PASS_INTERCEPTION_TENDENCY": (attributes, badges) => {
    const {
      ["PASS_PERCEPTION"]: passPerception,
    } = attributes;
    const {
      INTERCEPTOR,
    } = badges;
    return _.clamp(toRandomValue(passPerception, 0.5, 0.7) + toRandomValue(INTERCEPTOR, 1, 3), 0, 99);
  },
  "TAKE_CHARGE_TENDENCY": () => {
    return 0;
  },
  "ON-BALL_STEAL_TENDENCY": (attributes, badges) => {
    const {
      STEAL
    } = attributes;
    const {
      ["PICK_POCKET"]: pickPocket
    } = badges;
    return _.clamp(toRandomValue(STEAL, 0.5, 0.7) + toRandomValue(pickPocket, 2, 5), 0, 99);
  },
  "CONTEST_SHOT_TENDENCY": (attributes, badges) => {
    const {
      ["INTERIOR_DEFENSE"]: interiorDefense,
      ["PERIMETER_DEFENSE"]: perimeterDefense,
      ["LATERAL_QUICKNESS"]: latQ,
    } = attributes;
    const {
      INTIMIDATOR
    } = badges;
    return _.clamp(toRandomValue(interiorDefense, 0.1, 0.3) + toRandomValue(perimeterDefense, 0.1, 0.3) + toRandomValue(latQ, 0.1, 0.2) + toRandomValue(INTIMIDATOR, 2, 4), 0,99);
  },
  "BLOCK_SHOT_TENDENCY": (attributes, badges) => {
    const {
      BLOCK
    } = attributes;
    const {
      ["RIM_PROTECTOR"]: rimProtector
      //pogo stick
      // chasedown artist
    } = badges;
    return _.clamp(toRandomValue(BLOCK, 0.5, 0.7) + toRandomValue(rimProtector, 2, 5), 0, 99);
  },
  "FOUL_TENDENCY": (attributes, badges) => {
    const {
      ["INTERIOR_DEFENSE"]: id,
      ["PERIMETER_DEFENSE"]: pd,
    } = attributes;
    const {
      ENFORCER
    } = badges;
    return _.clamp(toRandomValue(99 - id, 0.2, 0.3) + toRandomValue(99 - pd, 0.1, 0.2) + toRandomValue(ENFORCER, 0, 3), 0, 99);
  },
  "HARD_FOUL_TENDENCY": (attributes, badges) => {
    const {
      ["INTERIOR_DEFENSE"]: id,
      ["PERIMETER_DEFENSE"]: pd,
    } = attributes;
    const {
      ENFORCER
    } = badges;
    return _.clamp(toRandomValue(99 - id, 0.1, 0.2) + toRandomValue(99 - pd, 0.0, 0.2) + toRandomValue(ENFORCER, 0, 4), 0, 99);
  }
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

module.exports = tendencyDictionary;