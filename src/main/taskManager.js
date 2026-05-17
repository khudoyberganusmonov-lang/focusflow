const { getDb } = require('./database');
const { normalizeTime24h } = require('./timeFormat');
const notifier = require('node-notifier');
const path = require('path');
const settingsService = require('./settingsService');
const { sortTasksByStartTime } = require('./taskSchedule');
const {
  parseRepeatDays,
  stringifyRepeatDays,
  taskShowsOnDate,
} = require('./taskRepeat');

function withDb(fn, fallback = []) {
  const db = getDb();
  if (!db) return fallback;
  try {
    return fn(db);
  } catch (err) {
    console.warn('[taskManager]', err.message);
    return fallback;
  }
}

function parseTags(tags) {
  if (Array.isArray(tags)) return JSON.stringify(tags);
  if (typeof tags === 'string') return tags;
  return '[]';
}

function parseBlockedApps(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function stringifyBlockedApps(apps) {
  if (!apps || !Array.isArray(apps) || apps.length === 0) return '[]';
  return JSON.stringify(
    apps
      .map((a) => ({
        app_name: a.app_name || '',
        process_name: a.process_name || '',
      }))
      .filter((a) => a.process_name)
  );
}

function parseBlockedSites(raw) {
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

function stringifyBlockedSites(sites) {
  const list = parseBlockedSites(sites);
  return list.length ? JSON.stringify(list) : '[]';
}

function toLockMac(value, lockMode) {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  if (lockMode === 'fullscreen' || lockMode === 'mac') return 1;
  return 0;
}

function rowToTask(row) {
  if (!row) return null;
  const task = {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
  };
  if (task.start_time) task.start_time = normalizeTime24h(task.start_time);
  if (task.end_time) task.end_time = normalizeTime24h(task.end_time);
  task.repeat_days = parseRepeatDays(task.repeat_days);
  task.blocked_apps = parseBlockedApps(task.blocked_apps);
  task.blocked_sites = parseBlockedSites(task.blocked_sites);
  task.category = task.category || 'boshqa';
  const { CATEGORY_ICONS } = require('./taskMeta');
  const savedIcon = task.icon && String(task.icon).trim();
  task.icon = savedIcon || CATEGORY_ICONS[task.category] || '✨';
  task.lock_mac = Boolean(task.lock_mac) || toLockMac(null, task.lock_mode);
  task.lock_mode = task.lock_mode || 'inherit';
  task.pomodoro_enabled = Boolean(task.pomodoro_enabled);
  task.pomodoro_work_minutes = Number(task.pomodoro_work_minutes) || 25;
  task.pomodoro_break_minutes = Number(task.pomodoro_break_minutes) || 5;
  return task;
}

function taskQuery(extraWhere = '', params = []) {
  return `
    SELECT t.*, p.name as project_name, p.color as project_color,
           a.name as area_name, a.color as area_color
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN areas a ON a.id = COALESCE(t.area_id, p.area_id)
    ${extraWhere}
  `;
}

// Areas
function getAreas() {
  return getDb()
    .prepare('SELECT * FROM areas ORDER BY sort_order, id')
    .all();
}

function createArea(data) {
  const r = getDb()
    .prepare(
      'INSERT INTO areas (name, color, icon, sort_order) VALUES (?, ?, ?, ?)'
    )
    .run(
      data.name,
      data.color || '#007AFF',
      data.icon || '📁',
      data.sort_order ?? 0
    );
  return { id: r.lastInsertRowid, ...data };
}

function updateArea(data) {
  getDb()
    .prepare(
      'UPDATE areas SET name = ?, color = ?, icon = ?, sort_order = ? WHERE id = ?'
    )
    .run(data.name, data.color, data.icon, data.sort_order ?? 0, data.id);
  return data;
}

// Projects
function getProjects() {
  return getDb()
    .prepare(
      `SELECT p.*, a.name as area_name
       FROM projects p JOIN areas a ON a.id = p.area_id ORDER BY p.id`
    )
    .all()
    .map((p) => ({
      ...p,
      block_list: JSON.parse(p.block_list || '[]'),
    }));
}

function createProject(data) {
  const r = getDb()
    .prepare(
      `INSERT INTO projects (area_id, name, color, icon, block_list, focus_duration, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.area_id,
      data.name,
      data.color || '#007AFF',
      data.icon || '',
      JSON.stringify(data.block_list || []),
      data.focus_duration || 60,
      data.deadline || null
    );
  return { id: r.lastInsertRowid, ...data };
}

function updateProject(data) {
  getDb()
    .prepare(
      `UPDATE projects SET area_id=?, name=?, color=?, icon=?, block_list=?, focus_duration=?, deadline=? WHERE id=?`
    )
    .run(
      data.area_id,
      data.name,
      data.color,
      data.icon || '',
      JSON.stringify(data.block_list || []),
      data.focus_duration,
      data.deadline,
      data.id
    );
  return data;
}

// Tasks
function getAllTasks() {
  return withDb((db) => {
    const rows = db
      .prepare(
        taskQuery(`WHERE t.status != 'done' ORDER BY t.sort_order, t.priority`)
      )
      .all();
    return rows.map(rowToTask);
  });
}

function getTodayTasks() {
  const today = new Date().toISOString().split('T')[0];
  return withDb((db) => {
    const rows = db
      .prepare(
        taskQuery(
          `WHERE t.status != 'done' AND (
            t.status = 'today'
            OR t.due_date = ?
            OR (t.repeat_days IS NOT NULL AND t.repeat_days != '' AND t.repeat_days != '[]')
          )`
        )
      )
      .all(today);
    return sortTasksByStartTime(
      rows.map(rowToTask).filter((t) => taskShowsOnDate(t, today))
    );
  });
}

function getUpcoming() {
  const today = new Date().toISOString().split('T')[0];
  const week = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const rows = getDb()
    .prepare(
      taskQuery(
        `WHERE t.status NOT IN ('done', 'someday') AND t.due_date > ? AND t.due_date <= ?
         ORDER BY t.due_date, t.priority`
      )
    )
    .all(today, week);
  return rows.map(rowToTask);
}

function getTasksByStatus(status) {
  const rows = getDb()
    .prepare(taskQuery(`WHERE t.status = ?`))
    .all(status);
  return sortTasksByStartTime(rows.map(rowToTask));
}

function getTasksByProject(projectId) {
  const rows = getDb()
    .prepare(taskQuery(`WHERE t.project_id = ?`))
    .all(projectId);
  return sortTasksByStartTime(rows.map(rowToTask));
}

function getTask(id) {
  return rowToTask(
    getDb().prepare(taskQuery('WHERE t.id = ?')).get(id)
  );
}

function createTask(data) {
  const db = getDb();
  let area_id = data.area_id;
  if (!area_id && data.project_id) {
    const p = db.prepare('SELECT area_id FROM projects WHERE id = ?').get(data.project_id);
    area_id = p?.area_id;
  }
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM tasks WHERE status = ?')
    .get(data.status || 'inbox').m;

  const r = db
    .prepare(
      `INSERT INTO tasks (project_id, area_id, title, notes, status, priority, due_date, reminder_at, tags, sort_order, start_time, end_time, repeat_days, category, icon, blocked_apps, blocked_sites, lock_mode, lock_mac, pomodoro_enabled, pomodoro_work_minutes, pomodoro_break_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.project_id || null,
      area_id || null,
      data.title,
      data.notes || '',
      data.status || 'inbox',
      data.priority ?? 2,
      data.due_date || null,
      data.reminder_at || null,
      parseTags(data.tags),
      data.sort_order ?? maxOrder + 1,
      normalizeTime24h(data.start_time) || null,
      normalizeTime24h(data.end_time) || null,
      stringifyRepeatDays(data.repeat_days),
      data.category || 'boshqa',
      data.icon != null && String(data.icon).trim()
        ? String(data.icon).trim()
        : require('./taskMeta').CATEGORY_ICONS[data.category || 'boshqa'] || '✨',
      stringifyBlockedApps(data.blocked_apps),
      stringifyBlockedSites(data.blocked_sites),
      data.lock_mode || 'inherit',
      toLockMac(data.lock_mac, data.lock_mode),
      data.pomodoro_enabled ? 1 : 0,
      Math.max(1, Number(data.pomodoro_work_minutes) || 25),
      Math.max(1, Number(data.pomodoro_break_minutes) || 5)
    );

  const task = getTask(r.lastInsertRowid);
  if (task?.reminder_at) scheduleReminder(task);
  syncTaskScheduleNotifications();
  return task;
}

function updateTask(data) {
  const completed_at =
    data.status === 'done'
      ? data.completed_at || new Date().toISOString()
      : null;

  getDb()
    .prepare(
      `UPDATE tasks SET project_id=?, area_id=?, title=?, notes=?, status=?, priority=?,
       due_date=?, reminder_at=?, tags=?, sort_order=?, start_time=?, end_time=?, repeat_days=?, category=?, icon=?, blocked_apps=?, blocked_sites=?, lock_mode=?, lock_mac=?, pomodoro_enabled=?, pomodoro_work_minutes=?, pomodoro_break_minutes=?, completed_at=? WHERE id=?`
    )
    .run(
      data.project_id || null,
      data.area_id || null,
      data.title,
      data.notes || '',
      data.status,
      data.priority ?? 2,
      data.due_date || null,
      data.reminder_at || null,
      parseTags(data.tags),
      data.sort_order ?? 0,
      normalizeTime24h(data.start_time) || null,
      normalizeTime24h(data.end_time) || null,
      stringifyRepeatDays(data.repeat_days),
      data.category || 'boshqa',
      data.icon != null && String(data.icon).trim()
        ? String(data.icon).trim()
        : require('./taskMeta').CATEGORY_ICONS[data.category || 'boshqa'] || '✨',
      stringifyBlockedApps(data.blocked_apps),
      stringifyBlockedSites(data.blocked_sites),
      data.lock_mode || 'inherit',
      toLockMac(data.lock_mac, data.lock_mode),
      data.pomodoro_enabled ? 1 : 0,
      Math.max(1, Number(data.pomodoro_work_minutes) || 25),
      Math.max(1, Number(data.pomodoro_break_minutes) || 5),
      completed_at,
      data.id
    );

  const task = getTask(data.id);
  if (task?.reminder_at) scheduleReminder(task);
  syncTaskScheduleNotifications();
  return task;
}

function syncTaskScheduleNotifications() {
  try {
    require('./taskSchedule').refreshTaskScheduleNotifications();
  } catch (err) {
    console.warn('[taskManager] schedule notifications:', err.message);
  }
}

function deleteTask(id) {
  getDb().prepare('DELETE FROM checklists WHERE task_id = ?').run(id);
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
  try {
    const taskSchedule = require('./taskSchedule');
    taskSchedule.clearNotifyStateForTask(id);
    taskSchedule.refreshTaskScheduleNotifications();
  } catch (err) {
    console.warn('[taskManager] clear schedule notify:', err.message);
  }
}

function completeTask(id) {
  const task = getTask(id);
  if (!task) return null;
  const updated = updateTask({ ...task, status: 'done' });
  if (updated) {
    try {
      const notificationHub = require('./notificationHub');
      const { soundKeyForScheduleEnd } = require('./taskScheduleSounds');
      const hasSlot = Boolean(task.start_time && task.end_time);
      notificationHub.show({
        soundKey: hasSlot ? soundKeyForScheduleEnd(task) : 'taskEnded',
        notifyKey: 'taskReminders',
        title: 'FocusFlow',
        body: `${task.title}: vazifa bajarildi`,
      });
    } catch (err) {
      console.warn('[taskManager] complete notify:', err.message);
    }
  }
  return updated;
}

function reorderTasks(orderedIds) {
  const stmt = getDb().prepare('UPDATE tasks SET sort_order = ? WHERE id = ?');
  orderedIds.forEach((id, i) => stmt.run(i, id));
}

// Checklists
function getChecklist(taskId) {
  return getDb()
    .prepare('SELECT * FROM checklists WHERE task_id = ? ORDER BY sort_order, id')
    .all(taskId);
}

function addChecklistItem(taskId, title) {
  const max = getDb()
    .prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM checklists WHERE task_id=?')
    .get(taskId).m;
  const r = getDb()
    .prepare(
      'INSERT INTO checklists (task_id, title, sort_order) VALUES (?, ?, ?)'
    )
    .run(taskId, title, max + 1);
  return { id: r.lastInsertRowid, task_id: taskId, title, done: 0 };
}

function toggleChecklistItem(id) {
  const item = getDb().prepare('SELECT * FROM checklists WHERE id = ?').get(id);
  if (!item) return null;
  const done = item.done ? 0 : 1;
  getDb().prepare('UPDATE checklists SET done = ? WHERE id = ?').run(done, id);
  return { ...item, done };
}

function deleteChecklistItem(id) {
  getDb().prepare('DELETE FROM checklists WHERE id = ?').run(id);
}

// Reminders
const reminderTimers = new Map();

function scheduleReminder(task) {
  if (reminderTimers.has(task.id)) {
    clearTimeout(reminderTimers.get(task.id));
    reminderTimers.delete(task.id);
  }
  if (!task.reminder_at) return;

  const at = new Date(task.reminder_at).getTime();
  const delay = at - Date.now();
  if (delay <= 0) return;

  const timer = setTimeout(() => {
    const notificationHub = require('./notificationHub');
    notificationHub.showWithNotifier(notifier, {
      soundKey: 'taskApproach5',
      notifyKey: 'taskReminders',
      title: 'FocusFlow eslatma',
      body: task.title,
      icon: path.join(__dirname, '../../assets/tray-icon.png'),
    });
    reminderTimers.delete(task.id);
  }, Math.min(delay, 2147483647));

  reminderTimers.set(task.id, timer);
}

function getMorningSummary() {
  const today = new Date().toISOString().split('T')[0];
  return withDb(
    (db) => {
      const taskCount = db
        .prepare(
          `SELECT COUNT(*) as c FROM tasks WHERE status != 'done' AND (status='today' OR due_date=?)`
        )
        .get(today).c;

      const tracked = db
        .prepare(
          `SELECT COALESCE(SUM(duration),0) as s FROM time_entries WHERE date(started_at)=?`
        )
        .get(today).s;

      let blocked = 0;
      try {
        blocked = db.prepare('SELECT COUNT(*) as c FROM block_domains').get().c;
      } catch {
        /* block tables may not exist yet */
      }

      return { taskCount, trackedSeconds: tracked, blockedSites: blocked };
    },
    { taskCount: 0, trackedSeconds: 0, blockedSites: 0 }
  );
}

module.exports = {
  getAreas,
  createArea,
  updateArea,
  getProjects,
  createProject,
  updateProject,
  getAllTasks,
  getTodayTasks,
  getUpcoming,
  getTasksByStatus,
  getTasksByProject,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reorderTasks,
  getChecklist,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  scheduleReminder,
  getMorningSummary,
};
