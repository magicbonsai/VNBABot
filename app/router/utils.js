const { updateJSON } = require('../bots/rojBot');

const bulkUpdateJSON = (data, attributeKeys, tendencyKeys, badgeKeys) => {
  const dataWithUpdatedAttr = attributeKeys.reduce((acc, curr) => {
    return updateJSON("ATTRIBUTES", acc, curr);
  }, data);
  const dataWithUpdatedTendency = tendencyKeys.reduce((acc, curr) => {
    return updateJSON("TENDENCIES", acc, curr);
  }, dataWithUpdatedAttr);
  const dataWithUpdatedBadges = badgeKeys.reduce((acc, curr) => {
    return updateJSON("BADGES", acc, curr);
  }, dataWithUpdatedTendency);
  return dataWithUpdatedBadges;
};

module.exports = { bulkUpdateJSON };