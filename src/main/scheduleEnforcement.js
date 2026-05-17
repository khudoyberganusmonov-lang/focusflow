const { normalizeDomain } = require('./hostsManager');

const PROTECTED_PROCESS_NAMES = new Set([
  'Electron',
  'FocusFlow',
  'node',
  'vite',
  'esbuild',
]);

function parseDays(daysJson) {
  try {
    const d = JSON.parse(daysJson || '[1,2,3,4,5,6,7]');
    return Array.isArray(d) ? d : [1, 2, 3, 4, 5, 6, 7];
  } catch {
    return [1, 2, 3, 4, 5, 6, 7];
  }
}

function timeToMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function scheduleTypeOf(schedule) {
  return schedule.schedule_type || schedule.type || 'website';
}

function isScheduleActive(schedule, now = new Date()) {
  if (!schedule.enabled) return false;
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const days = parseDays(schedule.days);
  if (!days.includes(day)) return false;

  const mins = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(schedule.start_time);
  const end = timeToMinutes(schedule.end_time);

  if (start <= end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

function loadEnabledSchedules(db) {
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM block_schedules WHERE enabled = 1').all();
  } catch {
    return [];
  }
}

function getActiveWebsiteDomains(db, now = new Date()) {
  const domains = [];
  for (const s of loadEnabledSchedules(db)) {
    if (scheduleTypeOf(s) !== 'website') continue;
    if (!isScheduleActive(s, now)) continue;
    const d = normalizeDomain(s.domain);
    if (d) domains.push(d);
  }
  return [...new Set(domains)];
}

function getActiveAppProcessNames(db, now = new Date()) {
  const names = [];
  for (const s of loadEnabledSchedules(db)) {
    if (scheduleTypeOf(s) !== 'app') continue;
    if (!isScheduleActive(s, now)) continue;
    const processName = String(s.domain || '').trim();
    if (!processName || PROTECTED_PROCESS_NAMES.has(processName)) continue;
    names.push(processName);
  }
  return [...new Set(names)];
}

module.exports = {
  PROTECTED_PROCESS_NAMES,
  parseDays,
  isScheduleActive,
  scheduleTypeOf,
  getActiveWebsiteDomains,
  getActiveAppProcessNames,
};
