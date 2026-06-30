const { CHANNEL_IDS } = require("../../consts");
const { INJURIES } = require("./consts");
const rwc = require("random-weighted-choice");
const _ = require("lodash");
const { createChangeListJSON } = require("../bots/rojBot");
const {
  getValidTeams,
  getPlayerSeasons,
  addInjury,
  getActiveInjuries,
  clearInjury,
  countTeamGamesSince,
  appendMiscRow,
} = require("./dbHelper");

const today = () => new Date().toLocaleString().split(",")[0];
// ISO date offset by N days, for the date-typed injuries.started_date column.
const isoDate = (days = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const weights = [
  { id: "y", weight: 0.2 },
  { id: "n", weight: 0.8 },
];

// 20% chance (or forced) to injure one healthy player on a valid team. Records
// it in the injuries table + sets the player_season status (was: stuffing JSON
// into Player List Status/Data and a VITALS INJURY1DAY field).
const generateInjuriesWith = (discordClient) => (forceInjury) => {
  console.log("injury report fired", forceInjury);
  return (async () => {
    if (rwc(weights) === "n" && !forceInjury) {
      console.log("no injury today");
      return;
    }
    const validTeams = await getValidTeams();
    const teamIds = validTeams.map((t) => t.teamId).filter((x) => x != null);
    const roster = await getPlayerSeasons({ teamIds, teamStatuses: ["ROSTERED"] });
    const healthy = roster.filter((p) => !p.status || p.status === "HEALTHY");
    const player = _.sample(healthy);
    if (!player) {
      console.log("no healthy player available to injure");
      return;
    }

    const injury = _.sample(INJURIES);
    const { id, Name: injuryName, DurationMin, DurationMax, AffectedLow, AffectedHigh, DNP } = injury;
    const injuryDuration = _.random(DurationMin, DurationMax);
    const statusObj = {
      Name: injuryName,
      DateInjured: today(),
      Duration: injuryDuration,
      AffectedLow,
      AffectedHigh,
      DNP,
      id,
    };
    console.log("injured:", player.fullName, injuryName, id);

    await addInjury(player.playerSeasonId, {
      injuryName,
      durationGames: injuryDuration,
      dnp: DNP,
      startedDate: isoDate(0),
      raw: statusObj, // AffectedLow/High are attribute-name strings — keep them here
    });

    // Streamer record — kept minimal as a raw Request Queue append (team resolved
    // to a real name instead of the old =VLOOKUP formula).
    await appendMiscRow("requestQueue", {
      Date: today(),
      Player: player.fullName,
      Team: player.teamName,
      Description: createChangeListJSON("INJURY", { injuryName, id }),
      Data: JSON.stringify(statusObj),
    });

    const dnpMessage = `What's severely affected is his ${AffectedHigh}.  It is recommended to bench this player until they recover.`;
    const message = `${player.fullName} has suffered an injury: ${injuryName} for ${injuryDuration} games.
      \n The injury minorly affects his ${AffectedLow}.  ${DNP ? dnpMessage : ""}`;
    discordClient.channels.cache.get(CHANNEL_IDS.updates).send(message);
    await appendMiscRow("reportArchive", { Date: today(), Content: message });
    console.log("injury report finished");
  })();
};

// Clear injuries whose team has played enough games since the injury started.
// (Was: parsing Player List Status JSON + counting Schedule rows. Now uses the
// injuries table + the games table.) Season-done auto-clear is simplified — with
// no games in the offseason, injuries persist until games are played.
const removeInjuries = () => {
  console.log("remove injury fired");
  return (async () => {
    const active = await getActiveInjuries();
    for (const inj of active) {
      const gamesPlayed = await countTeamGamesSince(inj.teamId, inj.startedDate);
      const duration = inj.durationGames || 0;
      if (gamesPlayed >= duration) {
        await clearInjury(inj.injuryId, inj.playerSeasonId);
        console.log("cleared injury", inj.playerName, `${gamesPlayed} >= ${duration}`);
      }
    }
    console.log("remove injury finished");
  })();
};

module.exports = { generateInjuriesWith, removeInjuries };
