const sheetIds = {
  players: "0",
  news: "1628701177",
  updates: "1780169714",
  rawStats: "1840998490",
  rosterCheckIn: "319174534",
  generatedPlayers: "526907503",
  availableCoaches: "916390755",
  trainingRegime: "33721000",
  retiredPlayers: "242746550",
  teamAssets: "395261312",
  requestQueue: "770847722",
  reportArchive: "832018399",
  globalVars: "1159560836",
  schedule: "1115239568"
};

//TODO Fill this out in the future if needed
const colIdx = {
  "ASSETS":{
    "Frozen":1,
    "Cash": 2,
    "Cash Next Season": 3,
    "Mentorships": 45,
  }
};

module.exports = { sheetIds, colIdx };
