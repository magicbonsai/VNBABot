const { CHANNEL_IDS } = require("../../consts");
const _ = require("lodash");
const { createChangeListJSON } = require("../bots/rojBot");
const {
  getFreeAgentsWithOffers,
  getTeamDictionary,
  signFreeAgent,
  appendMiscRow,
} = require("./dbHelper");

const today = () => new Date().toLocaleString().split(",")[0];

const toContractLength = (cash) => {
  if (cash < 15) return 1;
  if (cash < 40) return 2;
  return 3;
};

// Run a round of Free Agency: pick up to N free agents that carry a contract
// offer and sign each (move to the offered team, set contract + a fresh random
// loyalty, debit the team's cash). Each signing is one atomic transaction now,
// instead of the old non-transactional player.save() + Team Assets cell edit.
const signFAsWith = (discordClient) => (numOfSignings = 10) => {
  return (async function main() {
    console.log("numSignings", numOfSignings);
    const fas = await getFreeAgentsWithOffers();
    const candidates = fas.filter((f) => f.contractOffer && f.contractOffer.Team);
    const signedRows = _.sampleSize(candidates, numOfSignings);

    if (!signedRows.length) {
      return discordClient.channels.cache
        .get(CHANNEL_IDS.transactions)
        .send("Apparently, no one was given an offer on this round of Free Agency.");
    }

    const dict = await getTeamDictionary();
    const allSignings = [];
    for (const fa of signedRows) {
      const offer = fa.contractOffer; // already a JSONB object
      const { Team: newTeam, Cash, Minutes } = offer;
      const newTeamId = dict.byName.get(String(newTeam).toLowerCase());
      if (!newTeamId) {
        console.warn(`signFA: could not resolve team "${newTeam}" for ${fa.fullName}`);
        continue;
      }
      const newLoyalty = _.random(1, 10);
      const contractLength = toContractLength(parseInt(Cash));

      await signFreeAgent(fa.playerSeasonId, {
        teamId: newTeamId,
        salary: Cash,
        contractLength,
        loyalty: newLoyalty,
        contractOffer: { ...offer, Loyalty: newLoyalty },
      });

      // Streamer record — kept minimal (team resolved to a real value).
      await appendMiscRow("requestQueue", {
        Date: today(),
        Player: fa.fullName,
        Team: newTeam,
        Description: createChangeListJSON("TEAM", newTeam),
      });

      console.log("signed", fa.fullName, "->", newTeam);
      allSignings.push({ player: fa.fullName, team: newTeam, cash: Cash, minutes: Minutes, contractLength });
    }

    const messages = allSignings.map(
      ({ player, team, cash, minutes, contractLength }) =>
        `\nThe **${team}** have signed **${player}** to a ${contractLength} season contract worth ${cash} Cash and ${minutes} minutes. \n`
    );
    messages.forEach((message) =>
      discordClient.channels.cache.get(CHANNEL_IDS.transactions).send(message)
    );
    await appendMiscRow("reportArchive", { Date: today(), Content: messages.join("") });
  })();
};

module.exports = { signFAsWith };
