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
  const guild = discordClient.get_guild(process.env.SERVER_ID);
  const roleName = guild.roles.find((role = {}) => role.name.toLowerCase() == teamName );
  if (!roleName) {
    return res.status(400).send({
      success: 'false',
      message: `${teanName} is not a valid team name.`
    });
  }
  const filteredMembersOfTeam = guild.members.filter(member => member.role == roleName);
  filteredMembersOfTeam.forEach(member => member.user.send(value));
  return res.status(201).send({
    success: 'true',
    message: `Message posted successfully to members of the ${teamName}`,
  })
};

module.exports = { postToChannelWith, postToTeamWith };