const _ = require("lodash");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { CHANNEL_IDS } = require("../../consts");
const { sheetIds } = require("./sheetHelper");
const {
  randomAttribute,
  randomBadge,
  randomHotZone,
  toKeysWithCappedValues,
  toKeysWithMinValues
} = require("../bots/consts");
const rwc = require("random-weighted-choice");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);

const TEAM_INDEX = 6;
const CONTRACT_INDEX = 10;
const AGE_INDEX = 11;
const PRIOR_TEAM_INDEX = 31;
const DATA_INDEX = 22;
const CHANGES_INDEX = 39;

const offSeasonPaperWork = discordClient => {
  (async () => {
    discordClient.channels.cache
      .get(CHANNEL_IDS["tech-stuff"])
      .send("OffSeason processing in progress.");
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const playerSheet = sheets[sheetIds.players];
    const teamAssetsSheet = sheets[sheetIds.teamAssets];
    const teamAssetsRows = await teamAssetsSheet.getRows();
    const validTeams = await teamAssetsSheet.getRows().then(rows => {
      return rows
        .filter(row => row.Frozen === "FALSE" && row.Real === "TRUE")
        .map(row => {
          return row.Team;
        });
    });
    const playerRows = await playerSheet.getRows();
    const filteredRows = playerRows.filter(
      row =>
        !row["Retiring?"] && [...validTeams, "FA", "Rookie"].includes(row.Team)
    );

    discordClient.channels.cache
      .get(CHANNEL_IDS["tech-stuff"])
      .send("Performing Offseason Decline/Boosts");

    const playerChanges = {};
    filteredRows.forEach(playerRow => {
      const playerAge = parseInt(playerRow["Age"]);
      if (playerAge > 4) {
        playerChanges[playerRow.Name] = declinePlayer(playerRow, 25);
      } else {
        switch (playerAge) {
          case 0:
          case 1:
            playerChanges[playerRow.Name] = boostPlayer(playerRow, 60);
            break;
          case 2:
            playerChanges[playerRow.Name] = boostPlayer(playerRow, 30);
            break;
          case 3:
          case 4:
            playerChanges[playerRow.Name] = boostPlayer(playerRow, 15);
            break;
          default:
            break;
        }
      }
    });

    discordClient.channels.cache
      .get(CHANNEL_IDS["tech-stuff"])
      .send("Updating Contracts and Ages...");
    await playerSheet.loadCells();
    await filteredRows.reduce(async (memo, currentValue = {}) => {
      const acc = await memo;
      const {
        Name,
        ["Prior Team"]: priorTeam,
        ["Contract Length"]: contractLength = "0",
        Age = "0",
        Team
      } = currentValue;
      const rowIdxToUpdate = playerRows.findIndex(row => row.Name === Name) + 1;
      let newPriorTeam = priorTeam;
      let newTeam = Team;
      let newAge = Age;
      let newContractLength = contractLength || "0";
      if (_.clamp(parseInt(contractLength || "0") - 1, 0, 3) == 0) {
        newPriorTeam = Team;
        newTeam = "FA";
      }
      newContractLength = _.clamp(parseInt(contractLength || "0") - 1, 0, 3);
      newAge = parseInt(Age) + 1;
      console.log("foo", Name, Age, priorTeam, contractLength);
      console.log("numbers", newTeam, newPriorTeam, newAge, newContractLength);
      // Team cell
      playerSheet.getCell(rowIdxToUpdate, TEAM_INDEX).value = newTeam;
      // Contract Length
      playerSheet.getCell(rowIdxToUpdate, CONTRACT_INDEX).value =
        newContractLength;
      // Age
      playerSheet.getCell(rowIdxToUpdate, AGE_INDEX).value = newAge;
      // Prior Team
      playerSheet.getCell(rowIdxToUpdate, PRIOR_TEAM_INDEX).value =
        newPriorTeam;
      // Boosts/Decline
      if (playerChanges[Name]) {
        playerSheet.getCell(rowIdxToUpdate, DATA_INDEX).value =
          playerChanges[Name].data;

        playerSheet.getCell(rowIdxToUpdate, CHANGES_INDEX).value =
          playerChanges[Name].changes;
      }

      return [...acc, currentValue];
    }, []);
    await playerSheet.saveUpdatedCells();
    discordClient.channels.cache
      .get(CHANNEL_IDS["tech-stuff"])
      .send("Updating Contracts and Ages Complete.");
    // const retirementMentorships = await playerSheet.getRows().then(
    //   rows => rows.filter(row => row["Retiring?"] && [...validTeams, 'FA'].includes(row.Team))
    // )
    // console.log('retirementrows', retirementMentorships.map(player => player.Name));
    // discordClient.channels.cache.get(CHANNEL_IDS["tech-stuff"]).send("Updating Retirement Mentorships...");
    // await retirementMentorships.reduce(
    //   async (memo, currentValue) => {
    //     const acc = await memo;
    //     await doc.loadInfo();
    //     await teamAssetsSheet.loadCells();
    //     const { Name, Team, ["Contract Length"]: contractLength  } = currentValue;
    //     if (_.clamp(parseInt(contractLength) - 1, 0, 3) == 0) {
    //       return acc
    //     }
    //     const rowIdxToUpdate = teamAssetsRows.findIndex(row => row.Team == Team) + 1;
    //     const colIdxToUpdate = 44;
    //     let cellToUpdate = teamAssetsSheet.getCell(rowIdxToUpdate, colIdxToUpdate);
    //     const oldValue = cellToUpdate.value || "";
    //     let newValue = [ ...oldValue.split(','), Name].filter(value => !!value);
    //     if (_.clamp(parseInt(currentValue["Contract Length"]) - 1, 0, 3) == 2) {
    //       newValue = [...newValue, Name];
    //     }
    //     cellToUpdate.value = newValue.join(',');
    //     await teamAssetsSheet.saveUpdatedCells();
    //     return acc;
    //   },
    //   []
    // );
    // discordClient.channels.cache.get(CHANNEL_IDS["tech-stuff"]).send("Retirement Mentorships complete.");
    discordClient.channels.cache
      .get(CHANNEL_IDS["tech-stuff"])
      .send("OffSeason processing complete.");
    return;
  })();
};

const boostPlayer = (player, numBoosts) => {
  const playerData = [...JSON.parse(player["Data"])];
  const playerChanges = {};

  const updateWeights = [
    {
      id: "ATTRIBUTES",
      weight: 200
    },
    {
      id: "BADGES",
      weight: 174
    },
    {
      id: "HOTZONE",
      weight: 10
    },
    {
      id: "VITALS",
      weight: 4
    }
  ];

  const playerCats = {
    ATTRIBUTES: playerData.find(tab => tab.tab === "ATTRIBUTES").data,
    HOTZONE: playerData.find(tab => tab.tab === "HOTZONE").data,
    BADGES: playerData.find(tab => tab.tab === "BADGES").data,
    VITALS: playerData.find(tab => tab.tab === "VITALS").data
  };

  for (let i = 0; i < numBoosts; i++) {
    const chosenBoost = rwc(updateWeights);

    switch (chosenBoost) {
      case "ATTRIBUTES":
        const cappedAttrKeys = toKeysWithCappedValues(
          player,
          "ATTRIBUTES",
          playerData
        );
        const { key: attrKey } = randomAttribute(cappedAttrKeys);

        playerCats.ATTRIBUTES[attrKey] = _.clamp(
          parseInt(playerCats.ATTRIBUTES[attrKey]) + 15,
          0,
          222
        );
        playerChanges[attrKey] = !!playerChanges[attrKey]
          ? playerChanges[attrKey] + 5
          : 5;
        break;
      case "BADGES":
        const cappedBadgeKeys = toKeysWithCappedValues(
          player,
          "BADGES",
          playerData
        );
        const { key: badgeKey } = randomBadge(cappedBadgeKeys);
        if (badgeKey === "None") {
          break;
        }
        playerCats.BADGES[badgeKey] = parseInt(playerCats.BADGES[badgeKey]) + 1;
        playerChanges[badgeKey] = !!playerChanges[badgeKey]
          ? playerChanges[badgeKey] + 1
          : 1;
        break;
      case "HOTZONE":
        const cappedHotzoneKeys = toKeysWithCappedValues(
          player,
          "HOTZONE",
          playerData
        );
        const { key: hotZoneKey } = randomHotZone(cappedHotzoneKeys);

        playerCats.HOTZONE[hotZoneKey] =
          parseInt(playerCats.HOTZONE[hotZoneKey]) + 1;
        playerChanges[hotZoneKey] = !!playerChanges[hotZoneKey]
          ? playerChanges[hotZoneKey] + 1
          : 1;
        break;
      case "VITALS":
        const vitalsKey = _.sample(["HEIGHT_CM", "WEIGHT_LBS"]);
        if (vitalsKey === "HEIGHT_CM") {
          playerCats.VITALS["HEIGHT_CM"] =
            parseInt(playerCats.VITALS["HEIGHT_CM"]) + 3;
          playerCats.VITALS["WINGSPAN_CM"] =
            parseInt(playerCats.VITALS["WINGSPAN_CM"]) + 3;
          playerChanges["HEIGHT_CM"] = !!playerChanges["HEIGHT_CM"]
            ? playerChanges["HEIGHT_CM"] + 3
            : 3;
        } else {
          playerCats.VITALS["WEIGHT_LBS"] =
            parseInt(playerCats.VITALS["WEIGHT_LBS"]) + 15;
          playerChanges["WEIGHT_LBS"] = !!playerChanges["WEIGHT_LBS"]
            ? playerChanges["WEIGHT_LBS"] + 15
            : 15;
        }

        break;
      default:
        break;
    }
  }

  return {
    data: JSON.stringify(playerData),
    changes: JSON.stringify(playerChanges)
  };
};

const declinePlayer = (player, numBoosts) => {
  const playerData = [...JSON.parse(player["Data"])];
  const playerChanges = {};

  const updateWeights = [
    {
      id: "ATTRIBUTES",
      weight: 200
    },
    {
      id: "BADGES",
      weight: 174
    },
    {
      id: "HOTZONE",
      weight: 24
    }
  ];
  const playerCats = {
    ATTRIBUTES: playerData.find(tab => tab.tab === "ATTRIBUTES").data,
    HOTZONE: playerData.find(tab => tab.tab === "HOTZONE").data,
    BADGES: playerData.find(tab => tab.tab === "BADGES").data,
    VITALS: playerData.find(tab => tab.tab === "VITALS").data
  };

  for (let i = 0; i < numBoosts; i++) {
    const chosenBoost = rwc(updateWeights);

    switch (chosenBoost) {
      case "ATTRIBUTES":
        const minAttrKeys = toKeysWithMinValues(
          player,
          "ATTRIBUTES",
          playerData
        );
        const { key: attrKey } = randomAttribute(minAttrKeys);

        playerCats.ATTRIBUTES[attrKey] = _.clamp(
          parseInt(playerCats.ATTRIBUTES[attrKey]) - 15,
          0,
          222
        );
        playerChanges[attrKey] = !!playerChanges[attrKey]
          ? playerChanges[attrKey] - 5
          : -5;
        break;
      case "BADGES":
        const minBadgeKeys = toKeysWithMinValues(player, "BADGES", playerData);
        const { key: badgeKey } = randomBadge(minBadgeKeys);
        if (badgeKey === "None") {
          break;
        }

        playerCats.BADGES[badgeKey] = parseInt(playerCats.BADGES[badgeKey]) - 1;
        playerChanges[badgeKey] = !!playerChanges[badgeKey]
          ? playerChanges[badgeKey] - 1
          : -1;
        break;
      case "HOTZONE":
        const minHotzoneKeys = toKeysWithMinValues(
          player,
          "HOTZONE",
          playerData
        );
        const { key: hotZoneKey } = randomHotZone(minHotzoneKeys);

        playerCats.HOTZONE[hotZoneKey] =
          parseInt(playerCats.HOTZONE[hotZoneKey]) - 1;
        playerChanges[hotZoneKey] = !!playerChanges[hotZoneKey]
          ? playerChanges[hotZoneKey] - 1
          : -1;
        break;
      default:
        break;
    }
  }

  return {
    data: JSON.stringify(playerData),
    changes: JSON.stringify(playerChanges)
  };
};

module.exports = { offSeasonPaperWork };
