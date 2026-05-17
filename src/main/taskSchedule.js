const notificationHub = require('./notificationHub');
const { getDb } = require('./database');
const { normalizeTime24h } = require('./timeFormat');
const { taskShowsOnDate } = require('./taskRepeat');
const {
  shouldFireApproachNotify,
  soundKeyForApproach,
  soundKeyForScheduleEnd,
} = require('./taskScheduleSounds');

/** Minutes before start_time to send Bildirishnoma */
const APPROACH_MINUTES = [15, 5, 0];

/** @type {Map<number, Set<number>>} taskId -> thresholds already notified today */
const notifyState = new Map();

/** @type {Set<number>} task ids that received schedule-end notification today */
const endNotifyState = new Set();

/** @type {Map<string, NodeJS.Timeout>} */
const approachTimers = new Map();

let lastNotifyDate = null;

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

function formatMinutesAsTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function todayStr(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function hasSchedule(task) {
  return Boolean(normalizeTime24h(task?.start_time) && normalizeTime24h(task?.end_time));
}

function isTaskActiveAt(task, date = new Date()) {
  const start = parseTimeToMinutes(task.start_time);
  const end = parseTimeToMinutes(task.end_time);
  if (start == null || end == null) return false;
  const now = nowMinutes(date);
  if (start <= end) {
    return now >= start && now < end;
  }
  return now >= start || now < end;
}

function minutesUntilTaskStart(task, date = new Date()) {
  const start = parseTimeToMinutes(task.start_time);
  if (start == null) return null;
  const now = nowMinutes(date);
  let diff = start - now;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/** Minutes until start today; null if start already passed today */
function minutesUntilStartToday(task, date = new Date()) {
  const start = parseTimeToMinutes(task.start_time);
  if (start == null) return null;
  const diff = start - nowMinutes(date);
  return diff >= 0 ? diff : null;
}

function minutesLeftInTask(task, date = new Date()) {
  if (!hasSchedule(task)) return null;
  const end = parseTimeToMinutes(task.end_time);
  if (end == null) return null;
  const now = nowMinutes(date);
  let diff = end - now;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function sortTasksByStartTime(tasks) {
  return [...tasks].sort((a, b) => {
    const aStart = parseTimeToMinutes(a.start_time);
    const bStart = parseTimeToMinutes(b.start_time);
    if (aStart == null && bStart == null) return (a.sort_order || 0) - (b.sort_order || 0);
    if (aStart == null) return 1;
    if (bStart == null) return -1;
    if (aStart !== bStart) return aStart - bStart;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

function isTaskNotifiableToday(task, today) {
  if (task.status === 'done' || task.status === 'someday') return false;
  return taskShowsOnDate(task, today);
}

function getNotifiableTasks(db, today) {
  return db
    .prepare(
      `SELECT id, title, start_time, end_time, status, due_date, category FROM tasks
       WHERE status != 'done'
         AND start_time IS NOT NULL AND trim(start_time) != ''
         AND (
           status = 'today'
           OR due_date = ?
           OR (due_date IS NULL AND status NOT IN ('someday'))
         )`
    )
    .all(today);
}

function getScheduledTasksForProject(projectId, date = new Date()) {
  const db = getDb();
  if (!db || !projectId) return [];

  const today = todayStr(date);
  const rows = db
    .prepare(
      `SELECT * FROM tasks
       WHERE project_id = ? AND status != 'done'
         AND start_time IS NOT NULL AND start_time != ''
         AND end_time IS NOT NULL AND end_time != ''
         AND (status = 'today' OR due_date = ? OR due_date IS NULL)`
    )
    .all(projectId, today);

  return rows.map((r) => ({
    ...r,
    tags: JSON.parse(r.tags || '[]'),
  }));
}

function pickActiveScheduledTask(projectId, date = new Date()) {
  const tasks = getScheduledTasksForProject(projectId, date);
  return tasks.find((t) => isTaskActiveAt(t, date)) || null;
}

function buildFocusScheduleMeta(task, date = new Date()) {
  if (!task || !hasSchedule(task)) return null;
  const left = minutesLeftInTask(task, date);
  return {
    start_time: normalizeTime24h(task.start_time),
    end_time: normalizeTime24h(task.end_time),
    minutesLeftInSlot: left,
    label: `${task.title} — ${task.start_time}-${task.end_time}${
      left != null ? ` (${left} min qoldi)` : ''
    }`,
  };
}

function notifyTask(title, body, soundKey = 'taskReminders') {
  notificationHub.show({
    soundKey,
    notifyKey: 'taskReminders',
    title: 'FocusFlow',
    body: `${title}: ${body}`,
  });
}

function buildApproachBody(task, minutesLeft) {
  const time = normalizeTime24h(task.start_time);
  if (minutesLeft === 0) {
    return `Vaqti boshlandi (${time})`;
  }
  return `${minutesLeft} daqiqadan keyin boshlanadi (${time})`;
}

function markNotified(taskId, threshold) {
  const state = notifyState.get(taskId) || new Set();
  state.add(threshold);
  notifyState.set(taskId, state);
}

function wasNotified(taskId, threshold) {
  return notifyState.get(taskId)?.has(threshold) ?? false;
}

function fireApproachNotification(task, threshold, minutesLeft) {
  if (wasNotified(task.id, threshold)) return;
  if (!shouldFireApproachNotify(task, threshold)) {
    markNotified(task.id, threshold);
    return;
  }
  const left = minutesLeft ?? threshold;
  const soundKey = soundKeyForApproach(task, threshold);
  notifyTask(task.title, buildApproachBody(task, left), soundKey);
  markNotified(task.id, threshold);
}

function buildScheduleEndBody(task) {
  const end = normalizeTime24h(task.end_time);
  return `Vaqt tugadi (${end})`;
}

function fireScheduleEndNotification(task) {
  if (endNotifyState.has(task.id)) return;
  endNotifyState.add(task.id);
  const soundKey = soundKeyForScheduleEnd(task);
  notifyTask(task.title, buildScheduleEndBody(task), soundKey);
}

function shouldFireThreshold(until, threshold) {
  if (until == null) return false;
  if (threshold === 0) return until === 0;
  if (threshold === 15) return until <= 15 && until > 5;
  if (threshold === 5) return until <= 5 && until > 0;
  return until <= threshold;
}

function clearApproachTimers() {
  for (const timer of approachTimers.values()) {
    clearTimeout(timer);
  }
  approachTimers.clear();
}

function msUntilThreshold(startMin, minutesBefore, now = new Date()) {
  const targetMin = startMin - minutesBefore;
  const diffMin = targetMin - nowMinutes(now);
  if (diffMin < 0) return null;
  return diffMin * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds();
}

function scheduleApproachTimersForTask(task) {
  const start = parseTimeToMinutes(task.start_time);
  if (start == null) return;

  for (const threshold of APPROACH_MINUTES) {
    const key = `${task.id}-${threshold}`;
    if (approachTimers.has(key)) {
      clearTimeout(approachTimers.get(key));
      approachTimers.delete(key);
    }
    if (wasNotified(task.id, threshold)) continue;

    const ms = msUntilThreshold(start, threshold);
    if (ms == null || ms > 24 * 60 * 60 * 1000) continue;

    const timer = setTimeout(() => {
      approachTimers.delete(key);
      fireApproachNotification(task, threshold, threshold);
    }, Math.min(ms, 2147483647));

    approachTimers.set(key, timer);
  }
}

function maybeResetDailyNotifyState() {
  const today = todayStr();
  if (lastNotifyDate === today) return;
  notifyState.clear();
  endNotifyState.clear();
  clearApproachTimers();
  lastNotifyDate = today;
}

function pruneNotifyState(activeIds) {
  const ids = new Set(activeIds);
  for (const id of notifyState.keys()) {
    if (!ids.has(id)) notifyState.delete(id);
  }
  for (const id of endNotifyState) {
    if (!ids.has(id)) endNotifyState.delete(id);
  }
}

function checkTaskScheduleNotifications() {
  const db = getDb();
  if (!db) return;

  maybeResetDailyNotifyState();

  const today = todayStr();
  const now = new Date();
  const rows = getNotifiableTasks(db, today);
  const activeIds = [];

  for (const task of rows) {
    if (!isTaskNotifiableToday(task, today)) continue;
    activeIds.push(task.id);

    const until = minutesUntilStartToday(task, now);
    if (until == null) continue;

    for (const threshold of APPROACH_MINUTES) {
      if (wasNotified(task.id, threshold)) continue;
      if (shouldFireThreshold(until, threshold)) {
        fireApproachNotification(task, threshold, until);
      }
    }

    if (hasSchedule(task) && isTaskActiveAt(task, now)) {
      const left = minutesLeftInTask(task, now);
      if (left === 0) {
        fireScheduleEndNotification(task);
      }
    }
  }

  pruneNotifyState(activeIds);
}

function refreshTaskScheduleNotifications() {
  const db = getDb();
  if (!db) return;

  maybeResetDailyNotifyState();
  clearApproachTimers();

  const today = todayStr();
  const rows = getNotifiableTasks(db, today);

  for (const task of rows) {
    if (!isTaskNotifiableToday(task, today)) continue;
    scheduleApproachTimersForTask(task);
  }

  checkTaskScheduleNotifications();
}

function clearNotifyStateForTask(taskId) {
  notifyState.delete(taskId);
  endNotifyState.delete(taskId);
  for (const key of approachTimers.keys()) {
    if (key.startsWith(`${taskId}-`)) {
      clearTimeout(approachTimers.get(key));
      approachTimers.delete(key);
    }
  }
}

function requestNotificationPermission() {
  const { Notification } = require('electron');
  if (!Notification.isSupported()) return;
  if (typeof Notification.requestPermission === 'function') {
    Notification.requestPermission().catch(() => {});
  }
}

module.exports = {
  parseTimeToMinutes,
  formatMinutesAsTime,
  hasSchedule,
  isTaskActiveAt,
  minutesUntilTaskStart,
  minutesLeftInTask,
  sortTasksByStartTime,
  getScheduledTasksForProject,
  pickActiveScheduledTask,
  buildFocusScheduleMeta,
  checkTaskScheduleNotifications,
  refreshTaskScheduleNotifications,
  clearNotifyStateForTask,
  requestNotificationPermission,
};
