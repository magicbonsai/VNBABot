const help =
  "```This is the VNBA Bot.  Here's what I can do:\n\n\
  $roj [message] (dms only): Send a tweet via the VNBA Roj account\n\
  $vnba [message] (dms only): Send a tweet via the VNBA Smithy account\n\
  $scrape [video url] (2K box scores only): Run the box score scraper on a NBA2K20 box score\n\
  $robin: Create a round robin tournament format\n\
  $checkroster: Return the last individual who checked the roster out\n\
  $generateplayer: create player data to import into nba2k20\n\
```";

const devHelp = 
  "```This is the VNBA Bot (Development).  Here's what I can do:\n\n\
  $tweet [team, tweetType]: run an random Roj tweet\n\
  $roj [message] (dms only): Send a tweet via the VNBA Roj account\n\
  $vnba [message] (dms only): Send a tweet via the VNBA Smithy account\n\
  $scrape [video url] (2K box scores only): Run the box score scraper on a NBA2K20 box score\n\
  $robin: Create a round robin tournament format\n\
  $checkroster: Return the last individual who checked the roster out\n\
  $generateplayer: create player data to import into nba2k20\n\
```";

module.exports = { help, devHelp };
