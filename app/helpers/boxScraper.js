const fs = require("fs");
const path = require("path");
const youtubedl = require("youtube-dl-exec");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");
const sharp = require("sharp");
// const { createWorker, createScheduler } = require("tesseract.js");
const tesseract = require("node-tesseract-ocr");
const { sheetIds } = require("./sheetHelper");
const _ = require("lodash");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const distance = require("set-distance");
const cliProgress = require("cli-progress");
const heapdump = require("heapdump");
const os = require("os");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

sharp.cache(false);

const count = 50;
const timestamps = [];
const startPositionPercent = 1;
const endPositionPercent = 95;
const addPercent = (endPositionPercent - startPositionPercent) / (count - 1);
let i = 0;

const rectangles = [
  { key: "NAME", left: 0, top: 0, width: 400, height: 125 }, // name
  { left: 500, top: 0, width: 125, height: 125 }, // min
  { left: 655, top: 0, width: 125, height: 125 }, // points
  { left: 850, top: 0, width: 125, height: 125 }, // reb
  { left: 1000, top: 0, width: 125, height: 125 }, // ast
  { left: 1115, top: 0, width: 125, height: 125 }, // stl
  { left: 1330, top: 0, width: 125, height: 125 }, // blk
  { left: 1490, top: 0, width: 125, height: 125 }, // tov
  { left: 1600, top: 0, width: 75, height: 125 }, // fg
  { left: 1660, top: 0, width: 100, height: 125 }, // fga
  { left: 1770, top: 0, width: 75, height: 125 }, // 3pt
  { left: 1835, top: 0, width: 75, height: 125 }, // 3pta
  { left: 1925, top: 0, width: 75, height: 125 }, // ft
  { left: 2000, top: 0, width: 75, height: 125 }, // fta
  { left: 2125, top: 0, width: 75, height: 125 }, // oreb
  { left: 2280, top: 0, width: 125, height: 125 }, // foul
  { left: 2410, top: 0, width: 150, height: 125 }, // +-
  { left: 2590, top: 0, width: 125, height: 125 }, // prf
  { left: 2760, top: 0, width: 125, height: 125 } // dnk
];

if (!timestamps.length) {
  let i = 0;
  while (i < count) {
    timestamps.push(`${startPositionPercent + addPercent * i}%`);
    i = i + 1;
  }
}

// helper functions

function nameToPlayerKey(fullname) {
  const splitname = fullname.split(" ");
  splitname[0] = splitname[0].charAt(0) + ".";
  return splitname.join("");
}

function intialToPlayerKey(fullname) {
  const initial = fullname.split(".")[0];
  const lastName = fullname.split(" ").slice(1);

  return _.concat(initial, ".", lastName).join("");
}

function playerKeyToInitial(key) {
  const splitKey = key.split(".");
  const initial = splitKey[0];
  const lastName = splitKey[1];

  return _.concat(initial, ". ", lastName).join("");
}

function nameToInitial(fullname) {
  const splitname = fullname.split(" ");
  splitname[0] = splitname[0].charAt(0) + ".";
  return splitname.join(" ");
}

function getMostCommon(arr) {
  return arr
    .sort(
      (a, b) =>
        arr.filter(v => v === a).length - arr.filter(v => v === b).length
    )
    .pop();
}

function validateNumber(num, stripNegative = true) {
  if (!num) {
    return false;
  }

  const newNum = stripNegative ? num.replace("-", "") : num;

  if (newNum == "n" || newNum == "N") return "11";
  if (newNum == "B") return "8";

  return isNaN(newNum) ? false : newNum;
}

function validateName(playerName) {
  const strArr = playerName.split("");
  const newName = [];
  let prevChar = false;
  for (let i = 0; i < strArr.length; i++) {
    switch (strArr[i]) {
      case "0":
        newName.push("O");
        break;
      case "l":
        if (i === 0) {
          newName.push("I");
        } else {
          newName.push(strArr[i]);
        }
        break;
      default:
        newName.push(strArr[i]);
        break;
    }
    prevChar = strArr[i];
  }
  return newName.join("");
}

// This isn't working synchronously
// iterate through all team rows and find the most similar name;
function returnMostCommonKey(playerName, players) {
  if (!playerName) {
    return "";
  }
  let highestMeasure = 0;
  let result = "";
  for (const player of players) {
    const { Name } = player;
    const nameKey = nameToPlayerKey(Name);
    const measure = new distance.Jaccard(
      playerName.split(""),
      nameKey.split("")
    ).getCoefficient();
    if (measure > highestMeasure) {
      highestMeasure = measure;
      result = nameKey;
    }
  }
  if (highestMeasure < 0.5) {
    return "";
  }
  return result;
}

function updateRawStats(data, gameId, team1, team2) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const rawStats = sheets[sheetIds.rawStats];
    const players = sheets[sheetIds.players];
    await rawStats.loadHeaderRow();

    const statsLength = await rawStats.getRows().then(rows => rows.length);
    players.getRows().then(async function (playerRows) {
      const playerTable = {};
      playerRows.forEach(player => {
        playerTable[nameToPlayerKey(player.Name)] = player;
      });
      const scrapedData = {};
      const filteredRowsByTeam = playerRows.filter(pr =>
        [team1, team2].includes(pr.Team)
      );
      data.forEach((player = {}) => {
        const sdKey = returnMostCommonKey(player.Player, filteredRowsByTeam);
        if (!!playerTable[sdKey]) {
          if (!scrapedData[sdKey]) {
            scrapedData[sdKey] = {};
          }
          _.mergeWith(scrapedData[sdKey], player, (objValue, srcValue) => {
            return objValue || srcValue;
          });
        }
      });

      const rowsToAdd = [];

      _.keys(scrapedData)
        .filter(playerKey => scrapedData[playerKey].Minutes)
        .forEach(playerKey => {
          const playerVal = playerTable[playerKey] || {};
          rowsToAdd.push({
            ...scrapedData[playerKey],
            Player: playerKeyToInitial(playerKey),
            Team:
              playerVal.Role === "13" ||
              playerVal.Team === "FA" ||
              playerVal.Team === "Rookie"
                ? playerVal["Other Team"].toUpperCase()
                : playerVal.Team.toUpperCase(),
            "Game Id": gameId
          });
        });

      let orderedRowsToAdd = _.sortBy(rowsToAdd, x => x.Team);
      orderedRowsToAdd.forEach((item, index) => {
        const rowNum = statsLength + index + 2;
        item[
          "Valid Number of points"
        ] = `=IF(($J${rowNum} - $L${rowNum}) * 2 + ($L${rowNum} * 3) + $N${rowNum} = $D${rowNum}, "YES", "NO" )`;
        item[
          "Valid Stat line"
        ] = `=AND($J${rowNum} <=$K${rowNum}, $L${rowNum} <= $M${rowNum}, $N${rowNum} <= $O${rowNum})`;
        item["Valid PRF"] = `=($D${rowNum} + 2*$F${rowNum}) <= $S${rowNum}`;
        item["Valid Rebounds"] = `=$P${rowNum} <= $E${rowNum}`;
        item["Valid Minutes"] = `=$C${rowNum} <= 48`;
      });

      (async () => {
        if (process.env.environment === "DEVELOPMENT") {
          await console.log("rojRowsToAdd", orderedRowsToAdd);
        }
        await rawStats.addRows(orderedRowsToAdd, { insert: true });
      })();
    });

    fs.rmdir("screenshots", { recursive: true }, err => {
      if (err) {
        throw err;
      }

      console.log("Upload Completed!");
    });
  })();
}

// scraper functions

function takeScreenshots(video, videoLink) {
  ffmpeg(video)
    .on("start", () => {
      if (i < 1) {
        console.log(`start taking screenshots`);
      }
    })
    .on("end", () => {
      i = i + 1;
      console.log(`taken screenshot: ${i}`);

      if (i < count) {
        takeScreenshots(video, videoLink);
      }

      if (i >= count) {
        fs.unlink("myvideo.mp4", err => {
          if (err) throw err;
          console.log("Video Deleted");
        });
        processImages(videoLink);
      }
    })
    .screenshots(
      {
        count: 1,
        timemarks: [timestamps[i]],
        filename: `%b-${i + 1}.jpg`
      },
      path.join(path.dirname(video), `screenshots`)
    );
}
async function processImages(videoLink) {
  let counter = 0;
  await fs.readdir("screenshots", (err, files) => {
    if (!fs.existsSync("screenshots/processed")) {
      fs.mkdirSync("screenshots/processed");
    }
    files.forEach(file => {
      const image = sharp(`screenshots/${file}`);
      const imgOne = image.clone();
      const imgTwo = image.clone();
      const imgThree = image.clone();

      imgOne
        .resize({ width: 3840, height: 2160 })
        .extract({ left: 230, top: 1500, width: 2900, height: 150 });

      imgTwo
        .resize({ width: 3840, height: 2160 })
        .extract({ left: 230, top: 1630, width: 2900, height: 150 });

      imgThree
        .resize({ width: 3840, height: 2160 })
        .extract({ left: 230, top: 1760, width: 2900, height: 150 });

      const images = [imgOne, imgTwo, imgThree];

      images.forEach((img, index) => {
        const imgClone = img.clone();
        imgClone
          .raw()
          .toBuffer({ resolveWithObject: true })
          .then(({ data, info }) => {
            const pixelArray = new Uint8ClampedArray(data);
            const { width, height, channels } = info;
            const offset = channels * (width * 50 + 350);
            const red = pixelArray[offset];
            if (red < 100) {
              img
                .normalize()
                .greyscale()
                .negate()
                .linear(3, -(128 * 3) + 128)
                .sharpen()
                .toFile(
                  `screenshots/processed/${index + 1}-${file}`,
                  (err, info) => {
                    counter++;
                    if (counter >= count * 3) {
                      console.log("Processing Images...");
                      // TODO: this should eventually be removed
                      tessImages(videoLink);
                    }
                  }
                );
            } else {
              img
                .normalize()
                .greyscale()
                .linear(50, -(128 * 50) + 128)
                .toFile(
                  `screenshots/processed/${index + 1}-${file}`,
                  (err, info) => {
                    counter++;
                    if (counter >= count * 3) {
                      console.log("Processing Images...");
                      // TODO: this should eventually be removed
                      tessImages(videoLink);
                    }
                  }
                );
            }

            // data is a Buffer of length (width * height * channels)
            // containing 8-bit RGB(A) pixel data.
          });
      });
    });
  });
}

function removeChars(inputString) {
  var regex = new RegExp("[^-a-zA-Z0-9. ]", "g");
  return inputString.replace(regex, "");
}

function removeLetters(inputString) {
  var regex = new RegExp("[^0-9 ]", "g");
  return inputString
    .replaceAll("O", "0")
    .replaceAll("Z", "2")
    .replace(regex, "");
}

function findMode(arr) {
  var map = {};
  for (var i = 0; i < arr.length; i++) {
    if (map[arr[i]] === undefined) {
      map[arr[i]] = 0;
    }
    map[arr[i]] += 1;
  }
  var greatestFreq = 0;
  var mode;
  for (var prop in map) {
    if (map[prop] > greatestFreq) {
      greatestFreq = map[prop];
      mode = prop;
    }
  }
  return mode;
}

async function tessImages(videoLink) {
  fs.readdir("screenshots/processed", (err, files) => {
    return (async () => {
      filesDir = files.map(file => `screenshots/processed/${file}`);
      const results = await tesseract.recognize(filesDir, {
        // rectangle: rect,
        dpi: 96,
        oem: 3,
        psm: 6,
        lang: "eng"
      });
      const splitResults = results.split(/\r?\n/);
      const sanitizedResults = splitResults
        .map(result => {
          const reverseResult = removeChars(result).split(" ").reverse();

          if (reverseResult.length > 15) {
            const lastName = reverseResult
              .slice(15, reverseResult.length - 1)
              .reverse()
              .join(" ");
            const initialName = [reverseResult.slice(-1), lastName].join(" ");
            return [initialName, ...reverseResult.slice(0, 15).reverse()];
          } else {
            return null;
          }
        })
        .filter(element => {
          return element !== null;
        });

      const statlines = sanitizedResults.map(sr => {
        return sr.length === 16
          ? {
              Player: sr[0],
              Minutes: sr[1],
              Points: sr[2],
              Rebounds: sr[3],
              Assists: sr[4],
              Steals: sr[5],
              Blocks: sr[6],
              Turnovers: sr[7],
              "FG Made": sr[8].split("-")[0],
              "FG Taken": sr[8].split("-")[1],
              "3PT Made": sr[9].split("-")[0],
              "3PT Taken": sr[9].split("-")[0],
              "FT Made": sr[10].split("-")[0],
              "FT Taken": sr[10].split("-")[0],
              "Offensive Rebounds": sr[11],
              Fouls: sr[12],
              "+/-": sr[13],
              "Points Responsible For": sr[14],
              Dunks: sr[15]
            }
          : null;
      });

      const playersObj = {};
      for (sl of statlines.filter(element => {
        return element !== null && element.Minutes !== "DNP";
      })) {
        if (!playersObj[sl.Player]) {
          playersObj[sl.Player] = {
            Player: [],
            Minutes: [],
            Points: [],
            Rebounds: [],
            Assists: [],
            Steals: [],
            Blocks: [],
            Turnovers: [],
            "FG Made": [],
            "FG Taken": [],
            "3PT Made": [],
            "3PT Taken": [],
            "FT Made": [],
            "FT Taken": [],
            "Offensive Rebounds": [],
            Fouls: [],
            "+/-": [],
            "Points Responsible For": [],
            Dunks: []
          };
        }

        for (key of _.keys(sl)) {
          playersObj[sl.Player][key].push(sl[key]);
        }
      }

      const modePlayersArray = _.values(playersObj).map(po => {
        const poCopy = { ...po };

        _.keys(poCopy).forEach(k => {
          poCopy[k] =
            k === "Player"
              ? findMode(poCopy[k])
              : removeLetters(findMode(poCopy[k]));
        });

        return poCopy;
      });

      updateRawGameStats(modePlayersArray, videoLink);
    })();
  });
}

function updateRawGameStats(data, gameId) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_KEY);
  (async function main() {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
    await doc.loadInfo();
    const sheets = doc.sheetsById;
    const rawStats = sheets[sheetIds.rawStats];
    const players = sheets[sheetIds.players];
    await rawStats.loadHeaderRow();

    const statsLength = await rawStats.getRows().then(rows => rows.length);
    players.getRows().then(async function (playerRows) {
      const rowsToAdd = [];
      const playerNames = playerRows.map(p => nameToInitial(p.Name));
      const filteredData = data.filter(player =>
        playerNames.includes(player.Player)
      );

      filteredData.forEach(fdPlayer => {
        const playerVal = _.find(
          playerRows,
          pr => nameToInitial(pr.Name) === fdPlayer.Player
        );

        rowsToAdd.push({
          ...fdPlayer,
          Team:
            playerVal.Role === "13" ||
            playerVal.Team === "FA" ||
            playerVal.Team === "Rookie"
              ? playerVal["Other Team"].toUpperCase()
              : playerVal.Team.toUpperCase(),
          "Game Id": gameId
        });
      });

      let orderedRowsToAdd = _.sortBy(rowsToAdd, x => x.Team);
      orderedRowsToAdd.forEach((item, index) => {
        const rowNum = statsLength + index + 2;
        item[
          "Valid Number of points"
        ] = `=IF(($J${rowNum} - $L${rowNum}) * 2 + ($L${rowNum} * 3) + $N${rowNum} = $D${rowNum}, "YES", "NO" )`;
        item[
          "Valid Stat line"
        ] = `=AND($J${rowNum} <=$K${rowNum}, $L${rowNum} <= $M${rowNum}, $N${rowNum} <= $O${rowNum})`;
        item["Valid PRF"] = `=($D${rowNum} + 2*$F${rowNum}) <= $S${rowNum}`;
        item["Valid Rebounds"] = `=$P${rowNum} <= $E${rowNum}`;
        item["Valid Minutes"] = `=$C${rowNum} <= 48`;
      });

      (async () => {
        await console.log("rojRowsToAdd", orderedRowsToAdd);

        await rawStats.addRows(orderedRowsToAdd, { insert: true });
      })();
    });

    fs.rmdir("screenshots", { recursive: true }, err => {
      if (err) {
        throw err;
      }

      console.log("Upload Completed!");
    });
  })();
}

// main function
async function scrape(videoLink) {
  // hook in discord bot for messages
  if (fs.existsSync("screenshots")) {
    fs.rmdirSync("screenshots", { recursive: true });
  }

  youtubedl(videoLink, {
    output: "myvideo.mp4",
    noWarnings: true,
    noCallHome: true,
    noCheckCertificate: true,
    preferFreeFormats: true,
    youtubeSkipDashManifest: true
  }).then(output => {
    console.log(output);
    takeScreenshots("myvideo.mp4", videoLink);
  });
}

module.exports = scrape;
