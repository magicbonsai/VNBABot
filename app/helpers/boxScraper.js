const fs = require("fs");
const path = require("path");
// const youtubedl = require("youtube-dl");
const youtubedl = require("youtube-dl-exec");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");
const sharp = require("sharp");
const { createWorker, createScheduler } = require("tesseract.js");
const { sheetIds } = require("./sheetHelper");
const _ = require("lodash");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const distance = require("set-distance");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

sharp.cache(false);

const count = 50;
const timestamps = [];
const startPositionPercent = 1;
const endPositionPercent = 99;
const addPercent = (endPositionPercent - startPositionPercent) / (count - 1);
let i = 0;
const scheduler = createScheduler();
const scheduler2 = createScheduler();
const worker1 = createWorker();
const worker2 = createWorker();
// const worker3 = createWorker();
// const worker4 = createWorker();
const worker5 = createWorker();
const worker6 = createWorker();
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

function takeScreenshots(video, videoLink, team1, team2) {
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
        takeScreenshots(video, videoLink, team1, team2);
      }

      if (i >= count) {
        fs.unlink("myvideo.mp4", err => {
          if (err) throw err;
          console.log("Video Deleted");
        });
        processImages(videoLink, team1, team2);
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

async function processImages(videoLink, team1, team2) {
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
        .extract({ left: 230, top: 1630, width: 2900, height: 150 })
        .normalize()
        .greyscale()
        .negate()
        .linear(1.5, -(128 * 1.5) + 128);

      imgTwo
        .resize({ width: 3840, height: 2160 })
        .extract({ left: 230, top: 1630, width: 2900, height: 150 })
        .normalize()
        .greyscale()
        .negate()
        .linear(1.5, -(128 * 1.5) + 128);

      imgThree
        .resize({ width: 3840, height: 2160 })
        .extract({ left: 230, top: 1630, width: 2900, height: 150 })
        .normalize()
        .greyscale()
        .negate()
        .linear(1.5, -(128 * 1.5) + 128);

      const images = [imgOne, imgTwo, imgThree];

      images.forEach((img, index) => {
        // img
        //   .clone()
        //   .raw()
        //   .toBuffer({ resolveWithObject: true })
        //   .then(({ data, info }) => {
        //     const pixelArray = new Uint8ClampedArray(data);
        //     const { width, height, channels } = info;
        //     const offset = channels * (width * 100 + 700);
        //     const red = pixelArray[offset];
        //     const green = pixelArray[offset + 1];
        //     const blue = pixelArray[offset + 2];
        //     console.log(red);
        //     if (red > 200) {
        //       img.negate();
        //     }

        //     // data is a Buffer of length (width * height * channels)
        //     // containing 8-bit RGB(A) pixel data.
        //   });

        img.toFile(
          `screenshots/processed/${index + 1}-${file}`,
          (err, info) => {
            counter++;
            if (counter >= count * 3) {
              console.log("Processing Images...");
              // TODO: this should eventually be removed
              tessImages(videoLink, team1, team2);
              return true;
            }
          }
        );
      });
      // TODO See if screenshots can be deleted w/o timing issue after processing (AZ)
      // fs.unlinkSync(`screenshots/${file}`, err => {
      //   if(err){
      //     console.error(err)
      //     return
      //   }
      // });
    });
  });
}

async function tessImages(videoLink, team1, team2) {
  fs.readdir("screenshots/processed", (err, files) => {
    return (async () => {
      await worker1.load();
      await worker2.load();
      await worker1.loadLanguage("eng");
      await worker2.loadLanguage("eng");
      await worker1.initialize("eng");
      await worker2.initialize("eng");
      await worker1.setParameters({
        tessedit_char_whitelist: "DNP0123456789.-"
      });
      await worker2.setParameters({
        tessedit_char_whitelist: "DNP0123456789.-"
      });

      // await worker3.load();
      // await worker4.load();
      // await worker3.loadLanguage("eng");
      // await worker4.loadLanguage("eng");
      // await worker3.initialize("eng");
      // await worker4.initialize("eng");
      // await worker3.setParameters({
      //   tessedit_char_whitelist: "DNP0123456789.-"
      // });
      // await worker4.setParameters({
      //   tessedit_char_whitelist: "DNP0123456789.-"
      // });

      await worker5.load();
      await worker6.load();
      await worker5.loadLanguage("eng");
      await worker6.loadLanguage("eng");
      await worker5.initialize("eng");
      await worker6.initialize("eng");
      await worker5.setParameters({
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmonpqrstuvwxyz.- "
      });
      await worker6.setParameters({
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmonpqrstuvwxyz.- "
      });

      scheduler.addWorker(worker1);
      scheduler.addWorker(worker2);
      // scheduler.addWorker(worker3);
      // scheduler.addWorker(worker4);

      scheduler2.addWorker(worker5);
      scheduler2.addWorker(worker6);

      const results = await Promise.all(
        files.map(file => {
          return Promise.all(
            rectangles.map(rect => {
              const { key } = rect;
              if (key === "NAME") {
                return scheduler2.addJob(
                  "recognize",
                  `screenshots/processed/${file}`,
                  {
                    rectangle: rect
                  }
                );
              } else {
                return scheduler.addJob(
                  "recognize",
                  `screenshots/processed/${file}`,
                  {
                    rectangle: rect
                  }
                );
              }
            })
          );
        })
      );

      const data = results.map(fileResult =>
        fileResult.map(res => res.data.text)
      );

      const splitData = data.map(file =>
        file.map(column => {
          return column.split("\n");
        })
      );

      const transposed = splitData.map(file => {
        return file[0].map((_, colIndex) => {
          return file.map(row => {
            return row[colIndex];
          });
        });
      });

      const headers = [
        "Player",
        "Minutes",
        "Points",
        "Rebounds",
        "Assists",
        "Steals",
        "Blocks",
        "Turnovers",
        "FG Made",
        "FG Taken",
        "3PT Made",
        "3PT Taken",
        "FT Made",
        "FT Taken",
        "Offensive Rebounds",
        "Fouls",
        "+/-",
        "Points Responsible For",
        "Dunks"
      ];

      const players = [].concat.apply([], transposed).map(player =>
        Object.assign(
          ...headers.map((k, i) => ({
            [k]:
              i === 0
                ? validateName(player[i])
                : validateNumber(player[i], i !== 16)
          }))
        )
      );
      updateRawStats(players, videoLink, team1, team2);

      await scheduler.terminate(); // It also terminates all workers.
      await scheduler2.terminate();
    })();
  });
}

// main function
async function scrape(videoLink, team1, team2) {
  // hook in discord bot for messages

  youtubedl(videoLink, {
    output: "myvideo.mp4",
    noWarnings: true,
    noCallHome: true,
    noCheckCertificate: true,
    preferFreeFormats: true,
    youtubeSkipDashManifest: true
  }).then(output => {
    console.log(output);
    takeScreenshots("myvideo.mp4", videoLink, team1, team2);
  });
}

module.exports = scrape;
