const help =
  "```This is the VNBA Bot.  Here's what I can do:\n\n\
  $roj [message] (dms only): Send a tweet via the VNBA Roj account\n\
  $vnba [message] (dms only): Send a tweet via the VNBA Smithy account\n\
  $scrape [video url] (2K box scores only): Run the box score scraper on a NBA2K20 box score\n\
  $generateplayers [string]: create player data to import into nba2k20 using a string of characters (ex: gwb = guard wing big)\n\
  $generatecoach: create a new coach.\n\
  $rumor [string]: send an anonymous message to the #rumors channel on discord.\n\
  $signfa [number]: OFFSEASON: sign n number of players during the anonymous free agency period\n\
  $retirement: OFFSEASON: check which players retire for next season\n\
  $offseason: OFFSEASON: Advance contracts, salaries, and player ages for next season\n\
  $r-s: Run Tri-Kov Knn analysis on player stats.\n\
  $forceinjury [string]: run the injury report.  Add an argument to force an injury 100%\n\
  $removeinjury: run the remove injury job. \n\
```";

const devHelp = 
  "```This is the VNBA Bot (Development).  Here's what I can do:\n\n\
  $roj [message] (dms only): Send a tweet via the VNBA Roj account\n\
  $vnba [message] (dms only): Send a tweet via the VNBA Smithy account\n\
  $scrape [video url] (2K box scores only): Run the box score scraper on a NBA2K20 box score\n\
  $generateplayers [string]: create player data to import into nba2k20 using a string of characters (ex: gwb = guard wing big)\n\
  $generatecoach: create a new coach.\n\
  $rumor [string]: send an anonymous message to the #rumors channel on discord.\n\
  $signfa [number]: OFFSEASON: sign n number of players during the anonymous free agency period\n\
  $retirement: OFFSEASON: check which players retire for next season\n\
  $offseason: OFFSEASON: Advance contracts, salaries, and player ages for next season\n\
  $r-s: Run Tri-Kov Knn analysis on player stats.\n\
  $forceinjury [string]: run the injury report.  Add an argument to force an injury 100%\n\
  $removeinjury: run the remove injury job. \n\
```";

const serviceHelp = 
  "``` Here are all the services.  Please type $servicehelp [nameOfService] to see detailed api information.\n\n\
  toChannel\n\
  toTeam\n\
  updatePlayers\n\
  ```";

const serviceDocs = {
  tochannel: 
    "``` /roj/post/toChannel: post a message to a specific channel on the VNBA discord.\n\n\
    API:\n\
    {\n\
      channelTitle: String,\n\
      value: String\n\
    }\n\
    ```",
  toteam:
    "``` /roj/post/toTeam: takes in a team name (no capitalization) and message content to post a messge to a discord user via the tagged role.\n\n\
    API:\n\
    {\n\
      teamName: String,\n\
      value: String\n\
    }\n\
    ```",
  updateplayers:
    "``` /roj/post/updatePlayers: Take in an array of objects.\n\n\
    API:\n\
      value: Array [\n\
        {\n\
          Name: String,\n\
          value: array [ { key: string, value: num }, etc]\n\
          value: array [ { key: string, value: num }, etc]\n\
          value: array [ { key: string, value: num }, etc]\n\
        }\n\
      ]\n\
    ```", 
}

module.exports = { help, devHelp, serviceHelp, serviceDocs };
