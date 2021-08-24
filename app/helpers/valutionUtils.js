

//util functions to get params

// get cash value of a draft pick
const pickToCash = (picks, assetValueParams) => {
  return;
};

const getAssetValues = (teamAssetSheet) => {
  return;
};

// get player stats from last two seasons
const getMergedPlayerStats = (currentSeasonLeagueLeaders, prevSeasonLeagueLeaders, playerListSheetRows, minuteThreshold = 8) => {
  return;
};

const normalizeStats = (mergedPlayerStats, categoryValues, corThreshold = 0.8) => {
  return;
}

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
const getAssetStatValues = (categoryValues, playerScores, teamAssets, assetValueParams) => {
  return;
};

const getPlayerAttributes = (playerListSheetRows) => {
  return;
};

// valuation functions

//

const tradeFinder = (assetValues, assetsToTrade, sourceTeam, destTeam, categoryValues, winBy = 5, winMax = 10, cashCap = 33, maxIters = 100) => {
  return;
};

// 

const randomTrade = (assetValues, sourceTeam, destTeams, categoryValues, winBy = 5, winMax = 10) => {
  return;
};

const evaluateTrade = (assetValues, assetsToTrade, assetsToGet, CategoryValues, winBy = 5, winMax = 10) => {
  return;
};

// playersOfInterest should just be for now an array of player name strings?

const getPlayerComparisons = (assetValues, playerAttributes, playersOfInterest = [], typeWeight = 4, overallWeight = 3) => {
  return;
};


module.exports = { 
  pickToCash, 
  getAssetValues, 
  getMergedPlayerStats, 
  normalizeStats, 
  getParameters,
  getPlayerStatScores,
  getAssetValueParam,
  getAssetStatValues,
  getPlayerAttributes,
  tradeFinder,
  randomTrade,
  evaluateTrade,
  getPlayerComparisons   
}; 