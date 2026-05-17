const dayjs = require('dayjs');

/** Mahalliy kun kaliti YYYY-MM-DD */
function localDateKey(d = undefined) {
  return dayjs(d).format('YYYY-MM-DD');
}

function formatMinutesUz(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  return `${m} daq`;
}

module.exports = {
  dayjs,
  localDateKey,
  formatMinutesUz,
};
