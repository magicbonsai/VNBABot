const { pick } = require("lodash");

//util functions to get params

// get cash value of a draft pick
const pickToCash = (picks, assetValueParams) => {
  return;
};

//assume height is x'y"
const toHeightInInches = height => {
  const rex = /^(\d+)'(\d+)''$/;
  const match = rex.exec(height);
  console.log(match);
  let ft = 0;
  let inches = 0;
  if (match) {
    ft = parseInt(match[1], 10);
    inches = parseInt(match[2], 10);
    console.log(ft);
    console.log(inches);
  }

  const fullHeightInInches = ft * 12 + inches;
  return fullHeightInInches;
};

const nameToInitial = fullname => {
  const splitname = fullname.split(" ");
  splitname[0] = splitname[0].charAt(0) + ".";
  return splitname.join(" ");
};

const getAssetValues = teamAssetsRows => {
  const meaningfulKeys = [
    "Team",
    "Frozen",
    "Cash",
    "Cash Next Season",
    "Draft Picks",
    "Record"
  ];
  return teamAssetsRows.map(row => pick(row, meaningfulKeys));
};

const getPlayerListRows = playerListRows => {
  return playerListRows.map(row => {
    const { Name } = row;
    const nameKey = nameToInitial(Name);
    return { ...row, Player: nameKey };
  });
};

const toAdjustedOverall = (overall, position) => {
  if (position == "PG" || position == "C") {
    return overall + 3;
  }
  if (position == "SG") return overall + 2;
  return overall;
};

// get player stats from last two seasons
const getMergedPlayerStats = (
  currentSeasonLeagueLeaders,
  prevSeasonLeagueLeaders,
  playerListSheetRows,
  minuteThreshold = 8
) => {
  const playerListObject = Object.assign(
    {},
    ...playerListSheetRows.map(item => ({ [nameToInitial(item.Name)]: item }))
  );
  const concatArr = currentSeasonLeagueLeaders
    .slice(2)
    .concat(prevSeasonLeagueLeaders.slice(2));
  const fullPlayerStats = concatArr.map(playerStat => {
    if (!playerStat.Player || !playerListObject[playerStat.Player]) return;
    console.log(playerStat["Player"]);
    const playerInfo = playerListObject[playerStat.Player];
    const {
      Player,
      Name,
      Team,
      Height,
      Weight,
      ["Contract Length"]: contractLength,
      Position,
      Overall,
      Salary,
      Age,
      Type
    } = playerInfo;
    const heightInInches = toHeightInInches(Height);
    const salaryInt = parseInt(Salary);
    const adjustedOverall = toAdjustedOverall(parseInt(Overall), Position);

    const adjustedPlayerRow = {
      ...playerInfo,
      Height: heightInInches,
      Salary: salaryInt,
      AdjustedOverall: adjustedOverall
    };

    return adjustedPlayerRow;
  });

  return fullPlayerStats.filter(Boolean);
};

const normalizeStats = (
  mergedPlayerStats,
  categoryValues,
  corThreshold = 0.8
) => {
  return;
};

//grab parameters given valuation stats;

const getParameters = (categoryValues, normalizedStats) => {
  return;
};

const getPlayerStatScores = (playerStats, nomralizedStats, parameters) => {
  return;
};

// get cash value
const getAssetValueParam = (playerScores, playerListSheetRows) => {
  return;
};

// get player stat scores w/ cash
const getAssetStatValues = (
  categoryValues,
  playerScores,
  teamAssets,
  assetValueParams
) => {
  return;
};

const getPlayerAttributes = playerListSheetRows => {
  return;
};

// valuation functions

//

const tradeFinder = (
  assetValues,
  assetsToTrade,
  sourceTeam,
  destTeam,
  categoryValues,
  winBy = 5,
  winMax = 10,
  cashCap = 33,
  maxIters = 100
) => {
  return;
};

//

const randomTrade = (
  assetValues,
  sourceTeam,
  destTeams,
  categoryValues,
  winBy = 5,
  winMax = 10
) => {
  return;
};

const evaluateTrade = (
  assetValues,
  assetsToTrade,
  assetsToGet,
  categoryValues,
  winBy = 5,
  winMax = 10
) => {
  return;
};

// playersOfInterest should just be for now an array of player name strings?

const getPlayerComparisons = (
  assetValues,
  playerAttributes,
  playersOfInterest = [],
  typeWeight = 4,
  overallWeight = 3
) => {
  return;
};

module.exports = {
  pickToCash,
  getAssetValues,
  getMergedPlayerStats,
  normalizeStats,
  getParameters,
  getPlayerListRows,
  getPlayerStatScores,
  getAssetValueParam,
  getAssetStatValues,
  getPlayerAttributes,
  tradeFinder,
  randomTrade,
  evaluateTrade,
  getPlayerComparisons
};
