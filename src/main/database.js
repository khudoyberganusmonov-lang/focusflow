const path = require('path');
const { app } = require('electron');

let db = null;
let dbError = null;
let Database = null;

function loadSqliteModule() {
  if (Database) return Database;
  try {
    Database = require('better-sqlite3');
    return Database;
  } catch (err) {
    dbError = err;
    console.error('[database] better-sqlite3 load failed:', err.message);
    console.error(
      '[database] Run: ./node_modules/.bin/electron-rebuild -f -w better-sqlite3'
    );
    return null;
  }
}

function getDbPath() {
  const userData = app.getPath('userData');
  return path.join(userData, 'focusflow.db');
}

function isDatabaseReady() {
  return Boolean(db);
}

function getDatabaseError() {
  return dbError;
}

function columnExists(table, column) {
  if (!db) return false;
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    return cols.some((c) => c.name === column);
  } catch {
    return false;
  }
}

function migrateSchema() {
  if (!db) return;

  if (!columnExists('areas', 'icon')) {
    db.exec(`ALTER TABLE areas ADD COLUMN icon TEXT DEFAULT '📁'`);
  }
  if (!columnExists('areas', 'sort_order')) {
    db.exec(`ALTER TABLE areas ADD COLUMN sort_order INTEGER DEFAULT 0`);
  }
  if (!columnExists('projects', 'icon')) {
    db.exec(`ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT ''`);
  }
  if (!columnExists('projects', 'deadline')) {
    db.exec(`ALTER TABLE projects ADD COLUMN deadline TEXT`);
  }
  if (!columnExists('projects', 'stop_lock_type')) {
    db.exec(
      `ALTER TABLE projects ADD COLUMN stop_lock_type TEXT NOT NULL DEFAULT 'timer'`
    );
  }
  if (!columnExists('projects', 'stop_lock_timer_minutes')) {
    db.exec(
      `ALTER TABLE projects ADD COLUMN stop_lock_timer_minutes INTEGER NOT NULL DEFAULT 5`
    );
  }
  if (!columnExists('projects', 'stop_lock_password')) {
    db.exec(
      `ALTER TABLE projects ADD COLUMN stop_lock_password TEXT NOT NULL DEFAULT 'TOXTAMAN'`
    );
  }
  if (!columnExists('tasks', 'area_id')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN area_id INTEGER`);
  }
  if (!columnExists('tasks', 'reminder_at')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN reminder_at TEXT`);
  }
  if (!columnExists('tasks', 'tags')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]'`);
  }
  if (!columnExists('tasks', 'sort_order')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0`);
  }
  if (!columnExists('tasks', 'start_time')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN start_time TEXT`);
  }
  if (!columnExists('tasks', 'end_time')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN end_time TEXT`);
  }
  if (!columnExists('tasks', 'repeat_days')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN repeat_days TEXT`);
  }
  if (!columnExists('tasks', 'category')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'boshqa'`);
  }
  if (!columnExists('tasks', 'icon')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN icon TEXT DEFAULT '✨'`);
  }
  if (!columnExists('tasks', 'blocked_apps')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN blocked_apps TEXT DEFAULT '[]'`);
  }
  if (!columnExists('tasks', 'lock_mode')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN lock_mode TEXT DEFAULT 'inherit'`);
  }
  if (!columnExists('tasks', 'lock_mac')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN lock_mac INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columnExists('tasks', 'blocked_sites')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN blocked_sites TEXT DEFAULT '[]'`);
  }
  if (!columnExists('tasks', 'pomodoro_enabled')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN pomodoro_enabled INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columnExists('tasks', 'pomodoro_work_minutes')) {
    db.exec(
      `ALTER TABLE tasks ADD COLUMN pomodoro_work_minutes INTEGER NOT NULL DEFAULT 25`
    );
  }
  if (!columnExists('tasks', 'pomodoro_break_minutes')) {
    db.exec(
      `ALTER TABLE tasks ADD COLUMN pomodoro_break_minutes INTEGER NOT NULL DEFAULT 5`
    );
  }
  if (!columnExists('projects', 'mac_lock')) {
    db.exec(`ALTER TABLE projects ADD COLUMN mac_lock INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columnExists('projects', 'use_focus_duration')) {
    db.exec(
      `ALTER TABLE projects ADD COLUMN use_focus_duration INTEGER NOT NULL DEFAULT 1`
    );
  }
  if (!columnExists('focus_sessions', 'is_active')) {
    db.exec(
      `ALTER TABLE focus_sessions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0`
    );
  }
  if (!columnExists('focus_sessions', 'expected_end_at')) {
    db.exec(`ALTER TABLE focus_sessions ADD COLUMN expected_end_at TEXT`);
  }
  if (!columnExists('focus_sessions', 'blocked_sites')) {
    db.exec(
      `ALTER TABLE focus_sessions ADD COLUMN blocked_sites TEXT NOT NULL DEFAULT '[]'`
    );
  }
  if (!columnExists('focus_sessions', 'persist_snapshot')) {
    db.exec(
      `ALTER TABLE focus_sessions ADD COLUMN persist_snapshot TEXT NOT NULL DEFAULT '{}'`
    );
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS focus_session_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      distractions_blocked INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
    );
  `);

  try {
    db.prepare(
      `UPDATE tasks SET status = 'today' WHERE status = 'todo' AND due_date = date('now', 'localtime')`
    ).run();
    db.prepare(
      `UPDATE tasks SET status = 'inbox' WHERE status = 'todo' AND (due_date IS NULL OR due_date = '')`
    ).run();
    db.prepare(
      `UPDATE tasks SET status = 'upcoming' WHERE status = 'todo' AND due_date > date('now', 'localtime')`
    ).run();
    db.prepare(`UPDATE tasks SET status = 'done' WHERE status = 'done'`).run();
  } catch (err) {
    console.warn('[database] task status migration skipped:', err.message);
  }
}

function seedDefaultData() {
  if (!db) return;
  try {
    const areaCount = db.prepare('SELECT COUNT(*) as c FROM areas').get().c;
    if (areaCount > 0) return;

    const insertArea = db.prepare(
      'INSERT INTO areas (name, color, icon, sort_order) VALUES (?, ?, ?, ?)'
    );
    const ish = insertArea.run('💼 Ish', '#007AFF', '💼', 0).lastInsertRowid;
    insertArea.run('👤 Shaxsiy', '#34C759', '👤', 1);
    insertArea.run('🏥 Salomatlik', '#FF3B30', '🏥', 2);

    const insertProject = db.prepare(
      'INSERT INTO projects (area_id, name, color, block_list, focus_duration) VALUES (?, ?, ?, ?, ?)'
    );

    insertProject.run(
      ish,
      'VideoHive Pack',
      '#5856D6',
      JSON.stringify(['youtube.com', 'instagram.com', 't.me']),
      90
    );
    insertProject.run(
      ish,
      'CEP Extension',
      '#FF9500',
      JSON.stringify(['youtube.com', 't.me']),
      60
    );
    insertProject.run(
      ish,
      'Freepik Assets',
      '#AF52DE',
      JSON.stringify(['youtube.com', 'instagram.com']),
      90
    );

    const today = new Date().toISOString().split('T')[0];
    const projects = db.prepare('SELECT id, name FROM projects').all();
    const insertTask = db.prepare(
      `INSERT INTO tasks (project_id, title, status, priority, due_date)
       VALUES (?, ?, 'today', ?, ?)`
    );
    if (projects[0]) {
      insertTask.run(projects[0].id, 'Pack preview render', 1, today);
      insertTask.run(projects[0].id, 'Thumbnail dizayn', 2, today);
    }
    if (projects[1]) {
      insertTask.run(projects[1].id, 'Panel UI tuzatish', 2, today);
    }
  } catch (err) {
    console.warn('[database] seed skipped:', err.message);
  }
}

function initDatabase() {
  dbError = null;
  if (db) return { ok: true };

  const Sqlite = loadSqliteModule();
  if (!Sqlite) {
    return { ok: false, error: dbError?.message || 'better-sqlite3 unavailable' };
  }

  try {
    const dbPath = getDbPath();
    db = new Sqlite(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#007AFF',
        icon TEXT DEFAULT '📁',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        area_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#007AFF',
        icon TEXT DEFAULT '',
        block_list TEXT DEFAULT '[]',
        focus_duration INTEGER NOT NULL DEFAULT 60,
        stop_lock_type TEXT NOT NULL DEFAULT 'timer',
        stop_lock_timer_minutes INTEGER NOT NULL DEFAULT 5,
        stop_lock_password TEXT NOT NULL DEFAULT 'TOXTAMAN',
        deadline TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        area_id INTEGER,
        title TEXT NOT NULL,
        notes TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'inbox',
        priority INTEGER NOT NULL DEFAULT 2,
        due_date TEXT,
        reminder_at TEXT,
        tags TEXT DEFAULT '[]',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS focus_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration INTEGER DEFAULT 0,
        tasks_completed INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT,
        window_title TEXT,
        url TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration INTEGER DEFAULT 0,
        project_id INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS blocked_sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      );
    `);

    migrateSchema();
    seedDefaultData();
    return { ok: true };
  } catch (err) {
    dbError = err;
    console.error('[database] init failed:', err.message);
    try {
      db?.close();
    } catch {
      /* ignore */
    }
    db = null;
    return { ok: false, error: err.message };
  }
}

function getDb() {
  return db;
}

module.exports = {
  initDatabase,
  getDb,
  getDbPath,
  isDatabaseReady,
  getDatabaseError,
};
