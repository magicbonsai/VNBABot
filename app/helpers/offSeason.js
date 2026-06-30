const _ = require("lodash");
const { CHANNEL_IDS } = require("../../consts");
const {
  randomAttribute,
  randomBadge,
  randomHotZone,
  toKeysWithCappedValues,
  toKeysWithMinValues,
} = require("../bots/consts");
const rwc = require("random-weighted-choice");
const {
  getDb,
  getValidTeams,
  loadPlayersWithData,
  savePlayerBlob,
  updatePlayerSeasonFields,
} = require("./dbHelper");

// Annual offseason batch: age every active player up a year, roll their contract
// down (0 -> Free Agent), and apply age-scaled boosts (young) or declines (old).
// Each player's changes are persisted in one transaction.
const offSeasonPaperWork = (discordClient) => {
  return (async () => {
    const tech = (m) =>
      discordClient.channels.cache.get(CHANNEL_IDS["tech-stuff"]).send(m);
    tech("OffSeason processing in progress.");

    const validTeams = await getValidTeams();
    const allowed = new Set([...validTeams.map((t) => t.name), "FA", "Rookie"]);
    const players = await loadPlayersWithData();
    const filtered = players.filter((p) => !p.Retiring && allowed.has(p.Team));

    tech("Performing Offseason Decline/Boosts");
    const playerChanges = {};
    filtered.forEach((p) => {
      const age = parseInt(p.Age);
      if (age > 4) playerChanges[p.Name] = declinePlayer(p, 25);
      else if (age <= 1) playerChanges[p.Name] = boostPlayer(p, 60);
      else if (age === 2) playerChanges[p.Name] = boostPlayer(p, 30);
      else if (age === 3 || age === 4) playerChanges[p.Name] = boostPlayer(p, 15);
    });

    tech("Updating Contracts and Ages...");
    const { db } = getDb();
    for (const p of filtered) {
      const contractLength = parseInt(p.ContractLength || 0);
      const newContractLength = _.clamp(contractLength - 1, 0, 3);
      const goesToFA = newContractLength === 0;
      const newAge = parseInt(p.Age) + 1;
      const change = playerChanges[p.Name];

      await db.transaction(async (tx) => {
        const fields = { age: newAge, contractLength: newContractLength };
        if (goesToFA) {
          fields.teamStatus = "FA";
          fields.priorTeamId = p.teamId ?? null;
          fields.teamId = null;
        }
        await updatePlayerSeasonFields(p.playerSeasonId, fields, { exec: tx });
        if (change) await savePlayerBlob(p.playerSeasonId, change.blob, { exec: tx });
      });
    }

    tech("Updating Contracts and Ages Complete.");
    // Note: the old per-row "Changes" summary cell has no DB home and is dropped
    // (the actual mutated values are persisted above).
    tech("OffSeason processing complete.");
  })();
};

const boostPlayer = (player, numBoosts) => {
  const playerData = _.cloneDeep(player.Data); // deep copy so we don't mutate the loaded row
  const playerChanges = {};

  const updateWeights = [
    { id: "ATTRIBUTES", weight: 200 },
    { id: "BADGES", weight: 174 },
    { id: "HOTZONE", weight: 10 },
    { id: "VITALS", weight: 4 },
  ];

  const playerCats = {
    ATTRIBUTES: playerData.find((tab) => tab.tab === "ATTRIBUTES").data,
    HOTZONE: playerData.find((tab) => tab.tab === "HOTZONE").data,
    BADGES: playerData.find((tab) => tab.tab === "BADGES").data,
    VITALS: playerData.find((tab) => tab.tab === "VITALS").data,
  };

  for (let i = 0; i < numBoosts; i++) {
    const chosenBoost = rwc(updateWeights);
    switch (chosenBoost) {
      case "ATTRIBUTES": {
        const cappedAttrKeys = toKeysWithCappedValues(player, "ATTRIBUTES", playerData);
        const { key: attrKey } = randomAttribute(cappedAttrKeys);
        playerCats.ATTRIBUTES[attrKey] = _.clamp(parseInt(playerCats.ATTRIBUTES[attrKey]) + 15, 0, 222);
        playerChanges[attrKey] = playerChanges[attrKey] ? playerChanges[attrKey] + 5 : 5;
        break;
      }
      case "BADGES": {
        const cappedBadgeKeys = toKeysWithCappedValues(player, "BADGES", playerData);
        const { key: badgeKey } = randomBadge(cappedBadgeKeys);
        if (badgeKey === "None") break;
        playerCats.BADGES[badgeKey] = parseInt(playerCats.BADGES[badgeKey]) + 1;
        playerChanges[badgeKey] = playerChanges[badgeKey] ? playerChanges[badgeKey] + 1 : 1;
        break;
      }
      case "HOTZONE": {
        const cappedHotzoneKeys = toKeysWithCappedValues(player, "HOTZONE", playerData);
        const { key: hotZoneKey } = randomHotZone(cappedHotzoneKeys);
        playerCats.HOTZONE[hotZoneKey] = parseInt(playerCats.HOTZONE[hotZoneKey]) + 1;
        playerChanges[hotZoneKey] = playerChanges[hotZoneKey] ? playerChanges[hotZoneKey] + 1 : 1;
        break;
      }
      case "VITALS": {
        const vitalsKey = _.sample(["HEIGHT_CM", "WEIGHT_LBS"]);
        if (vitalsKey === "HEIGHT_CM") {
          playerCats.VITALS["HEIGHT_CM"] = parseInt(playerCats.VITALS["HEIGHT_CM"]) + 3;
          playerCats.VITALS["WINGSPAN_CM"] = parseInt(playerCats.VITALS["WINGSPAN_CM"]) + 3;
          playerChanges["HEIGHT_CM"] = playerChanges["HEIGHT_CM"] ? playerChanges["HEIGHT_CM"] + 3 : 3;
        } else {
          playerCats.VITALS["WEIGHT_LBS"] = parseInt(playerCats.VITALS["WEIGHT_LBS"]) + 15;
          playerChanges["WEIGHT_LBS"] = playerChanges["WEIGHT_LBS"] ? playerChanges["WEIGHT_LBS"] + 15 : 15;
        }
        break;
      }
      default:
        break;
    }
  }

  return { blob: playerData, changes: playerChanges };
};

const declinePlayer = (player, numBoosts) => {
  const playerData = _.cloneDeep(player.Data);
  const playerChanges = {};

  const updateWeights = [
    { id: "ATTRIBUTES", weight: 200 },
    { id: "BADGES", weight: 174 },
    { id: "HOTZONE", weight: 24 },
  ];

  const playerCats = {
    ATTRIBUTES: playerData.find((tab) => tab.tab === "ATTRIBUTES").data,
    HOTZONE: playerData.find((tab) => tab.tab === "HOTZONE").data,
    BADGES: playerData.find((tab) => tab.tab === "BADGES").data,
    VITALS: playerData.find((tab) => tab.tab === "VITALS").data,
  };

  for (let i = 0; i < numBoosts; i++) {
    const chosenBoost = rwc(updateWeights);
    switch (chosenBoost) {
      case "ATTRIBUTES": {
        const minAttrKeys = toKeysWithMinValues(player, "ATTRIBUTES", playerData);
        const { key: attrKey } = randomAttribute(minAttrKeys);
        playerCats.ATTRIBUTES[attrKey] = _.clamp(parseInt(playerCats.ATTRIBUTES[attrKey]) - 15, 0, 222);
        playerChanges[attrKey] = playerChanges[attrKey] ? playerChanges[attrKey] - 5 : -5;
        break;
      }
      case "BADGES": {
        const minBadgeKeys = toKeysWithMinValues(player, "BADGES", playerData);
        const { key: badgeKey } = randomBadge(minBadgeKeys);
        if (badgeKey === "None") break;
        playerCats.BADGES[badgeKey] = parseInt(playerCats.BADGES[badgeKey]) - 1;
        playerChanges[badgeKey] = playerChanges[badgeKey] ? playerChanges[badgeKey] - 1 : -1;
        break;
      }
      case "HOTZONE": {
        const minHotzoneKeys = toKeysWithMinValues(player, "HOTZONE", playerData);
        const { key: hotZoneKey } = randomHotZone(minHotzoneKeys);
        playerCats.HOTZONE[hotZoneKey] = parseInt(playerCats.HOTZONE[hotZoneKey]) - 1;
        playerChanges[hotZoneKey] = playerChanges[hotZoneKey] ? playerChanges[hotZoneKey] - 1 : -1;
        break;
      }
      default:
        break;
    }
  }

  return { blob: playerData, changes: playerChanges };
};

module.exports = { offSeasonPaperWork };
