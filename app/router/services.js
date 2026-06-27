const { CHANNEL_IDS } = require("../../consts");
require("dotenv").config();
const { createChangeListJSON } = require("../bots/rojBot");
const { bulkUpdateJSON } = require("./utils");
const {
  loadPlayersWithData,
  savePlayerBlob,
  appendMiscRow,
} = require("../helpers/dbHelper");

const today = () => new Date().toLocaleString().split(",")[0];

//POST requests

// Post a message to a specific channel. Curry with the discord client.
// API: { channelTitle: String, value: String }
const postToChannelWith = (discordClient) => (req, res) => {
  if (!req.body.channelTitle) {
    return res.status(400).send({ success: "false", message: "channelTitle is required" });
  } else if (!req.body.value) {
    return res.status(400).send({ success: "false", message: "value is required" });
  }
  discordClient.channels.cache.get(CHANNEL_IDS[req.body.channelTitle]).send(req.body.value);
  return res.status(201).send({
    success: "true",
    message: `Message posted successfully to ${req.body.channelTitle}`,
  });
};

// DM all members with a team's role. Curry with the discord client.
// API: { teamName: String, value: String }
const postToTeamWith = (discordClient) => (req, res) => {
  if (!req.body.teamName) {
    return res.status(400).send({ success: "false", message: "teamName is required" });
  } else if (!req.body.value) {
    return res.status(400).send({ success: "false", message: "value is required" });
  }
  const { body: { teamName, value } = {} } = req;
  const guild = discordClient.guilds.cache.find((guild) => guild.id == process.env.SERVER_ID);
  const role = guild.roles.cache.find((role) => role.name === teamName);
  if (!role) {
    return res.status(400).send({ success: "false", message: `${teamName} is not a valid team name.` });
  }
  console.log(role.id, role.name);
  guild.members.fetch();
  const membersWithRole = guild.members.cache.filter((member) =>
    member.roles.cache.find((x) => x == role.id)
  );
  membersWithRole.forEach((member) => member.user.send(value));
  return res.status(201).send({
    success: "true",
    message: `Message posted successfully to members with role: ${teamName}`,
  });
};

// Apply training deltas to many players. Each entry is:
//   { Name, Attributes:[{key,value}], Tendencies:[...], Badges:[...], Vitals:[...] }
// where each value is a DELTA (not the final value). The migration plan flags
// this stat write as the split-brain hard-gate — it now writes the DB only.
// API: { value: [ entries ] }
const updatePlayers = (req, res) => {
  if (!req.body.value) {
    return res.status(400).send({ success: "false", message: "value is required" });
  }
  const { body: { value: updateObjects } = {} } = req;
  (async () => {
    try {
      const players = await loadPlayersWithData();
      const byName = new Map(players.map((p) => [p.Name, p]));
      const missing = [];
      for (const obj of updateObjects) {
        const { Name, Attributes, Tendencies, Badges, Vitals } = obj;
        const player = byName.get(Name);
        if (!player) {
          missing.push(Name);
          continue;
        }
        const newBlob = JSON.parse(
          bulkUpdateJSON(JSON.stringify(player.Data), Attributes, Tendencies, Badges, Vitals)
        );
        await savePlayerBlob(player.playerSeasonId, newBlob);
        await appendMiscRow("requestQueue", {
          Date: today(),
          Player: Name,
          Team: player.Team,
          Description: createChangeListJSON("TRAINING", { Attributes, Tendencies, Badges, Vitals }),
        });
      }
      return res.status(201).send({
        success: "true",
        message: "Bulk update successful.",
        ...(missing.length ? { skipped: missing } : {}),
      });
    } catch (err) {
      console.error("updatePlayers failed", err);
      return res.status(500).send({ success: "false", message: err.message });
    }
  })();
};

module.exports = { postToChannelWith, postToTeamWith, updatePlayers };
