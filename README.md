# VNBABot

VNBAbot is a discord bot. It handles box score generation from clips of NBA2k20 box scores, automated tweet generation for a twitter bot, and other minor tasks.

Currently it is also set up to be a minor backend to allow some communciation between the discord bot and the official VNBA website.

## Usage
  $help: Return help docs for VNBABot \
  $tweet: run an automated Roj tweet \
  $roj [message] (dms only): Send a tweet via the VNBA Roj account \
  $vnba [message] (dms only): Send a tweet via the VNBA Smithy account \
  $scrape [video url] (2K box scores only): Run the box score scraper on a NBA2K20 box score \
  $robin: Create a round robin tournament format \
  $checkroster: return the last individual who checked out the roster, and whether they have checked it back in or not. \

## Installation Instructions

Clone this repository into your workspace.
Create an .env file in the root folder of the project, and add in all the Environment variables available on the Heroku configuration variables.
run `yarn` in your terminal to install all the modules.
run `npm start` to start the bot locally.