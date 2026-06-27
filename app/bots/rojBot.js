const { CHANNEL_IDS } = require("../../consts");
const { rojEvents, tabMap } = require("./consts");
const _ = require("lodash");
const rwc = require("random-weighted-choice");
const faker = require("faker");
require("dotenv").config();

const {
  loadPlayersWithData,
  getValidTeams,
  getMiscRows,
  savePlayerKey,
  addTeamCash,
  appendMiscRow,
} = require("../helpers/dbHelper");

faker.setLocale("en");

// Pure transform on the old Data blob (unchanged from the Sheets version): apply
// a clamped delta to one key on one tab and return the new blob string. Used to
// compute the new value; the DB write happens in updatePlayerObject.
const updateJSON = (tabKey, data, updateKey = {}) => {
  if (_.isEmpty(updateKey)) {
    return data;
  }
  const { key, value } = updateKey;
  const { multiplier = 1, upperBound } = tabMap[tabKey] || {};
  const valuesFromJSON = JSON.parse(data);
  const selectedTab = valuesFromJSON.find((page) => page.tab === tabKey);
  const selectedIndex = valuesFromJSON.findIndex((page) => page.tab === tabKey);
  let newData = selectedTab.data;
  const currentKey = selectedTab.data[key] === "NaN" ? 0 : selectedTab.data[key];
  const newKeyValue = parseInt(currentKey) + value * multiplier;

  const clampedNewValue = _.clamp(newKeyValue, 0, upperBound);
  newData[key] = `${clampedNewValue}`;

  return JSON.stringify([
    ...valuesFromJSON.slice(0, selectedIndex),
    { module: "PLAYER", tab: tabKey, data: newData },
    ...valuesFromJSON.slice(selectedIndex + 1),
  ]);
};

// Builds a JSON description of recent changes (pure; reused by the Request Queue
// writers). Resolve the team to a real value before writing, never a =VLOOKUP.
const createChangeListJSON = (type, updateKey, existingJSON = "{}") => {
  const valueAsJSON = !!existingJSON ? JSON.parse(existingJSON) : JSON.parse("{}");
  const updateObject = { STATS: { [type]: [updateKey] } };
  const mergedObject = _.mergeWith(valueAsJSON, updateObject, (objValue, srcValue) => {
    if (_.isArray(objValue)) {
      return objValue.concat(srcValue);
    }
  });
  return JSON.stringify(mergedObject);
};

// Apply a single rich-data mutation to a player and persist it. `playerRow` is a
// loadPlayersWithData() row (carries playerSeasonId + the Data blob). Computes the
// clamped value via updateJSON, writes just that key, and refreshes the in-memory
// blob so later events in the same run see the change.
async function updatePlayerObject(playerRow, type, updateKey) {
  const newBlobStr = updateJSON(type, JSON.stringify(playerRow.Data), updateKey);
  const newBlob = JSON.parse(newBlobStr);
  const tab = newBlob.find((p) => p.tab === type);
  const newValue = parseInt(tab.data[updateKey.key]);
  if (Number.isNaN(newValue)) {
    console.warn(`updatePlayerObject: skipping NaN write for ${playerRow.Name} ${type}.${updateKey.key}`);
    return;
  }
  await savePlayerKey(playerRow.playerSeasonId, type, updateKey.key, newValue);
  playerRow.Data = newBlob; // keep local copy fresh across multiple events
}

// Team-asset change (ASSETS/Cash). Only Cash is driven by events today.
async function updateAssets(playerRow, type, updateKey) {
  const { key, value } = updateKey;
  if (key !== "Cash") {
    console.warn(`updateAssets: unsupported asset key "${key}" — skipped`);
    return;
  }
  if (!playerRow.teamId) return; // FA has no team to credit
  await addTeamCash(playerRow.teamId, value);
}

// A streamer task that can't be applied via the player JSON (height/wingspan).
// Kept as a raw "Roj Updates" append for now (team resolved to a real value).
async function addManualTask(playerRow, type, updateKey) {
  const { key, value: { infoString } = {} } = updateKey;
  await appendMiscRow("updates", {
    Date: new Date().toLocaleString().split(",")[0],
    Player: playerRow.Name,
    "Current Team": playerRow.Team,
    Team: playerRow.Team,
    Event: key,
    Tweet: infoString,
  });
}

const updateFunctionMap = {
  MANUAL: addManualTask,
  ATTRIBUTES: updatePlayerObject,
  HOTZONE: updatePlayerObject,
  BADGES: updatePlayerObject,
  TENDENCIES: updatePlayerObject,
  ASSETS: updateAssets,
};

// Run one event. Flavor events that return a plain string (no mutation) are
// handled gracefully instead of crashing the run (the Sheets version would throw).
async function runEvent(playerRowsToUse, weights) {
  const eventId = rwc(weights);
  const { fn, selectionFn = _.sample } = rojEvents[eventId] || {};
  if (!fn) return { messageString: "" };
  const playerRowToUse = selectionFn(playerRowsToUse);
  if (!playerRowToUse) return { messageString: "" };
  const result = fn(playerRowToUse);
  if (!result || typeof result !== "object" || !result.type) {
    return {
      team: playerRowToUse.Team,
      name: playerRowToUse.Name,
      messageString: typeof result === "string" ? result : "",
    };
  }
  const { type, updateKey, messageString } = result;
  const updateFunction = updateFunctionMap[type];
  if (updateFunction) await updateFunction(playerRowToUse, type, updateKey);
  return { team: playerRowToUse.Team, name: playerRowToUse.Name, messageString };
}

async function runDevEvent(playerRowToUse, weights) {
  const eventId = rwc(weights);
  const { fn } = rojEvents[eventId] || {};
  if (!fn) return { messageString: "" };
  const result = fn(playerRowToUse);
  if (!result || typeof result !== "object" || !result.type) {
    return { team: playerRowToUse.Team, name: playerRowToUse.Name, messageString: typeof result === "string" ? result : "" };
  }
  const { type, updateKey, messageString } = result;
  const updateFunction = updateFunctionMap[type];
  if (updateFunction) await updateFunction(playerRowToUse, type, updateKey);
  return { team: playerRowToUse.Team, name: playerRowToUse.Name, messageString };
}

async function runDeclineEvent(playerRowToUse, weights) {
  const eventId = rwc(weights);
  const { fn } = rojEvents[eventId] || {};
  if (!fn) return { messageString: "" };
  const result = fn(playerRowToUse, true);
  if (!result || typeof result !== "object" || !result.type) {
    return { team: playerRowToUse.Team, name: playerRowToUse.Name, messageString: typeof result === "string" ? result : "" };
  }
  const { type, updateKey, messageString } = result;
  updateKey.value = updateKey.value * -1;
  const updateFunction = updateFunctionMap[type];
  if (updateFunction) await updateFunction(playerRowToUse, type, updateKey);
  return {
    team: playerRowToUse.Team,
    name: playerRowToUse.Name,
    messageString: `${playerRowToUse.Name} ${updateKey.key} ${updateKey.value}`,
  };
}

const toWeights = (weights, faWeights) => (team) =>
  team === "FA" ? faWeights : weights;

// Event probabilities used to live in the "News" tab (event/prob/isBoost). That
// data isn't in the DB yet, so we read it from misc_sheet_rows when present and
// otherwise fall back to these defaults. Only events that return a mutation
// object are weighted (flavor/string events are driven elsewhere).
const DEFAULT_NEWS_WEIGHTS = [
  { id: "boost", weight: 0.4 },
  { id: "badge", weight: 0.2 },
  { id: "hotzone", weight: 0.15 },
  { id: "budget", weight: 0.1 },
  { id: "growth", weight: 0.075 },
  { id: "wingspan", weight: 0.075 },
];
const isBoostId = (id) => ["boost", "badge", "hotzone"].includes(id);

async function loadEventWeights() {
  const rows = await getMiscRows("news");
  if (rows.length) {
    const all = rows
      .map((r) => ({ id: r.event, weight: parseFloat(r.prob), isBoost: r.isBoost }))
      .filter((w) => w.id && !Number.isNaN(w.weight));
    return {
      all: all.map(({ id, weight }) => ({ id, weight })),
      boost: all.filter((w) => w.isBoost).map(({ id, weight }) => ({ id, weight })),
    };
  }
  console.warn("rojBot: no News event weights in DB — using DEFAULT_NEWS_WEIGHTS");
  return {
    all: DEFAULT_NEWS_WEIGHTS,
    boost: DEFAULT_NEWS_WEIGHTS.filter((w) => isBoostId(w.id)),
  };
}

const today = () => new Date().toLocaleString().split(",")[0];

const sendReport = (discordClient, headline, allUpdates) => {
  const messages = [
    `${headline} for ${today()}:\n\n`,
    ...allUpdates.map(({ team, messages }) => `\nReport for the **${team}**:\n${messages.join("")}\n\n`),
  ];
  messages.forEach((message) =>
    discordClient.channels.cache.get(CHANNEL_IDS.updates).send(message)
  );
  const payload = `${headline} for ${today()}:\n\n`.concat(
    allUpdates.map(({ team, messages }) => `\nReport for the **${team}**:\n${messages.join("")}\n`).join("")
  );
  return payload;
};

// Twice-weekly news report: N random events per team (+ FA).
const runReportWith = (discordClient) => async (numberOfEvents = 3) => {
  const [playerRows, validTeams, weightsObj] = await Promise.all([
    loadPlayersWithData(),
    getValidTeams(),
    loadEventWeights(),
  ]);
  const weightsByTeam = toWeights(weightsObj.all, weightsObj.boost);
  const allTeams = [..._.shuffle(validTeams.map((t) => t.name)), "FA"];

  const allUpdates = [];
  for (const team of allTeams) {
    const playerRowsToUse = playerRows.filter((p) => p.Team === team);
    if (!playerRowsToUse.length) {
      allUpdates.push({ team, messages: [] });
      continue;
    }
    const arrayOfResults = [];
    for (let i = 0; i < numberOfEvents; i++) {
      const { messageString } = await runEvent(playerRowsToUse, weightsByTeam(team));
      if (messageString) arrayOfResults.push(`${messageString}\n`);
    }
    allUpdates.push({ team, messages: arrayOfResults });
  }

  const payload = sendReport(discordClient, "Here is the Twice-Weekly report", allUpdates);
  await appendMiscRow("reportArchive", { Date: today(), Content: payload });
};

// Youth development report: age-scaled boosts for players under 5.
const runDevReportWith = (discordClient) => async (isWeekend) => {
  const [playerRows, validTeams, weightsObj] = await Promise.all([
    loadPlayersWithData(),
    getValidTeams(),
    loadEventWeights(),
  ]);
  const weightsByTeam = toWeights(weightsObj.all, weightsObj.boost);
  const allTeams = [..._.shuffle(validTeams.map((t) => t.name)), "FA"];
  const numberOfRuns = { 1: 2, 2: 1, 3: isWeekend ? 1 : 0, 4: isWeekend ? 0 : 1 };

  const allUpdates = [];
  for (const team of allTeams) {
    const playerRowsToUse = playerRows.filter(
      (p) => p.Team === team && parseInt(p.Age) < 5
    );
    const arrayOfResults = [];
    for (const playerRow of playerRowsToUse) {
      const runs = numberOfRuns[parseInt(playerRow.Age)] || 0;
      for (let i = 0; i < runs; i++) {
        const { messageString } = await runDevEvent(playerRow, weightsByTeam(team));
        if (messageString) arrayOfResults.push(`${messageString}\n`);
      }
    }
    allUpdates.push({ team, messages: arrayOfResults });
  }

  const payload = sendReport(discordClient, "Here is the Twice-Weekly report", allUpdates);
  await appendMiscRow("reportArchive", { Date: today(), Content: payload });
};

// Decline report: attribute/badge declines for players over 5.
const runDeclineReportWith = (discordClient) => async () => {
  const [playerRows, validTeams, weightsObj] = await Promise.all([
    loadPlayersWithData(),
    getValidTeams(),
    loadEventWeights(),
  ]);
  // Only decline-capable events that return a mutation object.
  const declineWeights = weightsObj.all.filter((w) => ["boost", "badge"].includes(w.id));
  const allTeams = [..._.shuffle(validTeams.map((t) => t.name)), "FA"];

  const allUpdates = [];
  for (const team of allTeams) {
    const playerRowsToUse = playerRows.filter(
      (p) => p.Team === team && parseInt(p.Age) > 5
    );
    const arrayOfResults = [];
    for (const playerRow of playerRowsToUse) {
      for (let i = 0; i < 25; i++) {
        const { messageString } = await runDeclineEvent(playerRow, declineWeights);
        if (messageString) arrayOfResults.push(`${messageString}\n`);
      }
    }
    allUpdates.push({ team, messages: arrayOfResults });
  }

  const payload = sendReport(discordClient, "Here is the Decline report", allUpdates);
  await appendMiscRow("reportArchive", { Date: today(), Content: payload });
};

// Cap athleticism attributes by player height.
const capSpeed = async (player) => {
  const vitals = player.Data.find((page) => page.tab === "VITALS").data;
  const attributes = player.Data.find((page) => page.tab === "ATTRIBUTES").data;
  const playerHeight = parseInt(vitals.HEIGHT_CM);
  const athleticismKeys = ["SPEED", "SPEED_WITH_BALL", "ACCELERATION"];

  const playerHeightInInches = Math.round(playerHeight / 2.54);
  const baseHeightInInches = 79;
  const baseAthleticismAttr = 88 - 25;
  const capDiff = baseHeightInInches - playerHeightInInches;
  const maxAthleticismValue = (baseAthleticismAttr + capDiff) * 3;
  const maxAthleticismAttr = baseAthleticismAttr + capDiff + 25;

  for (const aKey of athleticismKeys) {
    const attrValue = parseInt(attributes[aKey]);
    const attr = attrValue / 3 + 25;
    if (attrValue > maxAthleticismValue) {
      const athDiff = maxAthleticismAttr - attr;
      await updatePlayerObject(player, "ATTRIBUTES", { key: aKey, value: athDiff });
    }
  }
};

const capSpeedWithHeight = () => {
  return (async function main() {
    const players = await loadPlayersWithData();
    for (const playerRow of players) {
      await capSpeed(playerRow);
    }
    console.log("athleticism capped");
  })();
};

// Replace "NaN" tendency values with a random 1-99 value.
const fixNanValue = async (player) => {
  const tendenciesTab = player.Data.find((page) => page.tab === "TENDENCIES");
  const tendencies = tendenciesTab ? tendenciesTab.data : {};
  for (const tkey of _.keys(tendencies)) {
    if (tendencies[tkey] === "NaN") {
      await updatePlayerObject(player, "TENDENCIES", { key: tkey, value: _.random(1, 99) });
    }
  }
};

const fixNanValues = () => {
  return (async function main() {
    const players = await loadPlayersWithData();
    for (const playerRow of players) {
      await fixNanValue(playerRow);
    }
    console.log("NaN fixed");
  })();
};

module.exports = {
  runReportWith,
  runDevReportWith,
  runDeclineReportWith,
  createChangeListJSON,
  capSpeedWithHeight,
  fixNanValues,
  updateJSON,
  updatePlayerObject,
};
