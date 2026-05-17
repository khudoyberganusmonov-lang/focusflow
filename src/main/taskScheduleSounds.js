const settingsService = require('./settingsService');
const { isDamOlishCategory } = require('../shared/notificationSoundCatalog.cjs');
const { normalizeTime24h } = require('./timeFormat');

function parseTimeToMinutes(value) {
  const normalized = normalizeTime24h(value);
  if (!normalized) return null;
  const m = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function scheduledSlotMinutes(task) {
  const start = parseTimeToMinutes(task.start_time);
  const end = parseTimeToMinutes(task.end_time);
  if (start == null || end == null) return null;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

function isLongBreakSlot(task) {
  const mins = scheduledSlotMinutes(task);
  if (mins == null) return false;
  const longBreak = Number(settingsService.getSettings().longBreak) || 15;
  return isDamOlishCategory(task.category) && mins >= longBreak;
}

function shouldFireApproachNotify(task, threshold) {
  if (threshold !== 0) return true;
  if (isDamOlishCategory(task.category) && !isLongBreakSlot(task)) {
    return false;
  }
  return true;
}

function soundKeyForApproach(task, threshold) {
  if (threshold === 5) {
    return isDamOlishCategory(task.category)
      ? 'breakModeApproach5'
      : 'taskApproach5';
  }
  if (threshold === 15) return 'taskApproach15';
  if (threshold === 0) {
    if (isDamOlishCategory(task.category) && isLongBreakSlot(task)) {
      return 'longBreakStarted';
    }
    return 'taskStarted';
  }
  return 'taskReminders';
}

function soundKeyForScheduleEnd(task) {
  if (isDamOlishCategory(task.category)) {
    return isLongBreakSlot(task) ? 'longBreakEnded' : 'breakModeEnded';
  }
  return 'taskEnded';
}

module.exports = {
  scheduledSlotMinutes,
  isLongBreakSlot,
  shouldFireApproachNotify,
  soundKeyForApproach,
  soundKeyForScheduleEnd,
};
