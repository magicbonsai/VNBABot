const { CHANNEL_IDS } = require('../../consts');
//GET requests

//POST requests

// takes in a channel title + message content to post a message to a specific channel on the discord server.
// Must be curried w/ the discord client in question first.

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

module.exports = { postToChannelWith };