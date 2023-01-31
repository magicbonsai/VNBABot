// const twit = require("twitter-lite");
const { TwitterApi } = require("twitter-api-v2");
const rojConfig = require("../../creds/rojConfig.js");
const smithyConfig = require("../../creds/smithyConfig.js");
const roj = new TwitterApi(rojConfig.bearerToken);
const smithy = new TwitterApi(smithyConfig);
const _ = require("lodash");
const { createCanvas, Image, loadImage } = require("canvas");

const { twitterAccounts } = require("./consts");
const fetch = require("node-fetch");
const { MessageAttachment, MessageEmbed } = require("discord.js");

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

const drawTweet = async (tweet, player, team) => {
  const width = 300;
  const height = 300;

  // Instantiate the canvas object
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");

  const circle = {
    x: 100,
    y: 100,
    radius: 100
  };

  context.beginPath();
  context.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2, true);
  context.closePath();
  context.clip();

  const imgToUse = player.Image ?? team.Logo;
  const avatar = await loadImage(imgToUse);

  // Compute aspectration
  const aspect = avatar.height / avatar.width;
  // Math.max is ued to have cover effect use Math.min for contain
  const hsx = circle.radius * Math.max(1 / aspect, 1);
  const hsy = circle.radius * Math.max(aspect, 1);
  // x - hsl and y - hsy centers the image
  context.drawImage(
    avatar,
    avatar.width / 2 - 50,
    avatar.height / 20,
    avatar.width / 2.5,
    avatar.height / 2.5,
    circle.x - hsx,
    circle.y - hsy,
    hsx * 2,
    hsy * 2
  );

  const buffer = canvas.toBuffer("image/png");

  return buffer;
};

const toHandle = str => {
  const newHandle = str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  return "@" + newHandle;
};

const getRedditRandom = async () => {
  const randSubs = [
    "r/aww",
    "r/nbamemes",
    "r/nba",
    "r/meirl",
    "user/pjkenk2/m/nbateams",
    "r/hmmm",
    "r/CatastrophicFailure",
    "r/mademesmile",
    "r/birbs",
    "r/foodporn",
    "r/unexpected",
    "r/mildlyinteresting",
    "r/eyebleach",
    "r/AbsoluteUnits",
    "r/gifs"
  ];

  const getSubreddit = () => {
    const selectedReddit = _.sample(randSubs);
    return fetch(`https://reddit.com/${selectedReddit}/hot.json?limit=100`, {
      method: "GET" // *GET, POST, PUT, DELETE, etc.
    })
      .then(response => response.json())
      .catch(error => {
        console.log(`Sorry, this subreddit cannot be found.`);
      });
  };
  const response = await getSubreddit();
  const filteredResponse = response.data.children.filter(
    r => r.data.post_hint === "image"
  );

  const postNumber = Math.floor(Math.random() * filteredResponse.length);
  return _.get(filteredResponse, [postNumber, "data", "url"]);
};

const getUserID = async player => {
  console.log(player);
  const user = await roj.v2.userByUsername(player);

  return user.data.id;
};

const getRandomTweet = async (channel, playerRows, teamRows) => {
  const selectedPlayer = _.sample(playerRows);
  const selectedTwitter = _.sample(twitterAccounts);
  const playerTeam = teamRows.find(r => r.Team === selectedPlayer.Team);

  try {
    const userId = await getUserID(selectedTwitter);
    const tweetsOfPlayer = await roj.v2.userTimeline(userId, {
      expansions: ["attachments.media_keys"],
      exclude: ["replies", "retweets"]
    });

    await tweetsOfPlayer.fetchLast(90);

    const selectedTweet = _.sample(tweetsOfPlayer.tweets);
    const splitTweet = selectedTweet.text.split(" ");
    const newTweet = [];
    let imgUrl = null;

    for (let i of splitTweet) {
      if (i.charAt(0) === "@") {
        const randPlayer = _.sample(playerRows).Name;
        newTweet.push(
          `[${toHandle(
            randPlayer
          )}](http://thevnba.com/player/${randPlayer.Name.replaceAll(
            " ",
            "_"
          )})`
        );
      } else if (i.charAt(0) === "#") {
        newTweet.push(
          `[${i}](https://letmegooglethat.com/?q=${i.substring(1)})`
        );
      } else if (i === "&amp;") {
        newTweet.push("&");
      } else if (i.includes("t.co")) {
        if (!imgUrl) {
          imgUrl = await getRedditRandom();
        }
      } else {
        newTweet.push(i);
      }
    }

    const propic = await drawTweet(
      newTweet.join(" "),
      selectedPlayer,
      playerTeam
    );

    const file = new MessageAttachment(propic, "propic.png");

    const discTweet = new MessageEmbed()
      .setColor(playerTeam["Primary Color"])
      .setTitle(toHandle(selectedPlayer.Name))
      .setURL(
        `http://thevnba.com/player/${selectedPlayer.Name.replaceAll(" ", "_")}`
      )
      .setDescription(newTweet.join(" "))
      .setThumbnail("attachment://propic.png")
      .setTimestamp()
      .setFooter({ text: playerTeam.Team, iconURL: playerTeam.Logo })
      .setImage(imgUrl);

    if (imgUrl) {
      discTweet.setImage(imgUrl);
    }

    channel.send({ embeds: [discTweet], files: [file] });
  } catch (e) {
    console.log(e);
  }
};

module.exports = { postRojTweet, postSmithyTweet, getUserID, getRandomTweet };
