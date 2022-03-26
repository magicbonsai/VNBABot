const { CHANNEL_IDS } = require('../../consts');
require("dotenv").config();
//GET requests

//POST requests

// takes in a channel title + message content to post a message to a specific channel on the discord server.
// Must be curried w/ the discord client in question first.
// API:
// {
//   channelTitle: String,
//   value: String,
// }

const postToChannelWith = discordClient => (req, res) => {
  if(!req.body.channelTitle) {
    return res.status(400).send({
      success: 'false',
      message: 'channelTitle is required'
    });
  } else if(!req.body.value) {
    return res.status(400).send({
      success: 'false',
      message: 'value is required'
    });
  }
  discordClient.channels.get(CHANNEL_IDS[req.body.channelTitle]).send(req.body.value);
  return res.status(201).send({
    success: 'true',
    message: `Message posted successfully to ${req.body.channelTitle}`,
  })
}

// takes in a team name (no capitalization) and message content to post a messge to a discord user via the tagged role.
// Curry w/ the discord client.
// API:
// {
//   teamName: String,
//   value: String
// }
const postToTeamWith = discordClient => (req, res) => {
  if (!req.body.teamName) {
    return res.status(400).send({
      success: 'false',
      message: 'teamName is required'
    });
  } else if (!req.body.value) {
    return res.status(400).send({
      success: 'false',
      message: 'value is required'
    });
  }
  const { 
    body: {
      teamName,
      value
    } = {}
  } = req;
  // Apparently sending a message unprompted to all members with a certain role
  // may be a little against discord's api usage but for now this is good
  // without having to keep a list of discord user ids (AZ)
  const guild = discordClient.guilds.find(guild => guild.id == process.env.SERVER_ID);
  const role = guild.roles.find(role => role.name === teamName);
  if (!role) {
    return res.status(400).send({
      success: 'false',
      message: `${teamName} is not a valid team name.`
    });
  }
  const membersWithRole = guild.roles.get(role.id).members;
  membersWithRole.forEach(member => member.user.send(value));
  return res.status(201).send({
    success: 'true',
    message: `Message posted successfully to members with role: ${teamName}`,
  })
};

// Take in an array of objects, of which the object is such:
// 
// {
//   Name: string,
//   Attributes: array [ { key: value }, etc],
//   Badges: array [ { key: value }, etc],
//   Tendencies: array [ { key: value }, etc]
// }
// and updates each player
// API:
// {
//   value: [ objects ]
// }

const updatePlayers = (req, res) => {
  if (!req.body.value) {
    return res.status(400).send({
      success: 'false',
      message: 'value is required'
    });
  } 

};

module.exports = { postToChannelWith, postToTeamWith, updatePlayers };