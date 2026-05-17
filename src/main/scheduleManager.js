const { getDb } = require('./database');
const {
  isScheduleActive,
  getActiveWebsiteDomains,
  getActiveAppProcessNames,
} = require('./scheduleEnforcement');

let checkInterval = null;
let onScheduleChange = null;

function getActiveScheduledWebsiteDomains() {
  const db = getDb();
  if (!db) return [];
  return getActiveWebsiteDomains(db);
}

function getActiveScheduledAppProcesses() {
  const db = getDb();
  if (!db) return [];
  return getActiveAppProcessNames(db);
}

/** @deprecated use getActiveScheduledWebsiteDomains — only website schedules affect hosts */
function getActiveScheduledDomains() {
  return getActiveScheduledWebsiteDomains();
}

function startScheduleWatcher(callback) {
  onScheduleChange = callback;
  if (checkInterval) clearInterval(checkInterval);
  const tick = () => {
    onScheduleChange?.();
  };
  checkInterval = setInterval(tick, 60_000);
  tick();
}

function stopScheduleWatcher() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  onScheduleChange = null;
}

module.exports = {
  getActiveScheduledDomains,
  getActiveScheduledWebsiteDomains,
  getActiveScheduledAppProcesses,
  isScheduleActive,
  startScheduleWatcher,
  stopScheduleWatcher,
};
