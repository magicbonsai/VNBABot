const { updateJSON } = require('../bots/rojBot');


// Assumes the keys arrays have these as items: { key: string, value: number }

const bulkUpdateJSON = (data, attributeKeys = [], tendencyKeys = [], badgeKeys = [], vitalsKeys = []) => {
  const dataWithUpdatedAttr = attributeKeys.reduce((acc, curr) => {
    return updateJSON("ATTRIBUTES", acc, curr);
  }, data);
  const dataWithUpdatedTendency = tendencyKeys.reduce((acc, curr) => {
    return updateJSON("TENDENCIES", acc, curr);
  }, dataWithUpdatedAttr);
  const dataWithUpdatedBadges = badgeKeys.reduce((acc, curr) => {
    return updateJSON("BADGES", acc, curr);
  }, dataWithUpdatedTendency);
  const dataWithUpdatedVitals = vitalsKeys.reduce((acc, curr) => {
    return updateJSON("VITALS", acc, curr);
  }, dataWithUpdatedBadges);
  return dataWithUpdatedVitals;
};

module.exports = { bulkUpdateJSON };