const twit = require("twitter-lite");

const { GoogleSpreadsheet } = require("google-spreadsheet");
const rojConfig = require("../../creds/rojConfig.js");
const smithyConfig = require("../../creds/smithyConfig.js");
const roj = new twit(rojConfig);
const smithy = new twit(smithyConfig);

// Helper methods

const splitter = (str, l) => {
  let strs = [];
  while (str.length > l) {
    let pos = str.substring(0, l).lastIndexOf(" ");
    pos = pos <= 0 ? l : pos;
    strs.push(str.substring(0, pos));
    let i = str.indexOf(" ", pos) + 1;
    if (i < pos || i > pos + l) i = pos;
    str = str.substring(i);
  }
  strs.push(str);
  return strs;
};

async function tweetThread(thread, twitterClient) {
  let lastTweetID = "";
  let idx = 1;
  for (const status of thread) {
    const tweet = await twitterClient.post("statuses/update", {
      status: status + (thread.length == 1 ? "" : ` (${idx}/${thread.length})`),
      in_reply_to_status_id: lastTweetID,
      auto_populate_reply_metadata: true
    });
    lastTweetID = tweet.id_str;
    idx = idx + 1;
  }
}

// Methods

const postRojTweet = content => {
  const splitTweets = splitter(content, 275);
  tweetThread(splitTweets, roj).catch(console.error);
};

const postSmithyTweet = content => {
  const splitTweets = splitter(content, 275);
  tweetThread(splitTweets, smithy).catch(console.error);
};

module.exports = { postRojTweet, postSmithyTweet };
