const { getDb } = require('./database');
const { normalizeDomain } = require('./hostsManager');

function dedupeBlockDomains() {
  const db = getDb();
  if (!db) return;
  db.prepare(
    `DELETE FROM block_domains
     WHERE id NOT IN (
       SELECT MIN(id) FROM block_domains GROUP BY domain, project_id
     )`
  ).run();
}

function dedupeDomainRows(rows) {
  const byDomain = new Map();
  for (const row of rows) {
    const key = String(row.domain || '').toLowerCase();
    if (!key) continue;
    const existing = byDomain.get(key);
    if (!existing) {
      byDomain.set(key, row);
      continue;
    }
    if (row.project_id != null && existing.project_id == null) {
      byDomain.set(key, row);
    }
  }
  return Array.from(byDomain.values()).sort((a, b) =>
    a.domain.localeCompare(b.domain)
  );
}

function migrateBlockTables() {
  const db = getDb();
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS block_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      domain TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

  `);

  dedupeBlockDomains();

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_block_domains_global
      ON block_domains(domain) WHERE project_id IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_block_domains_project
      ON block_domains(project_id, domain) WHERE project_id IS NOT NULL;
  `);

  db.exec(`

    CREATE TABLE IF NOT EXISTS block_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      pattern TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS block_apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      app_name TEXT NOT NULL,
      process_name TEXT NOT NULL,
      is_blocked INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, process_name)
    );

    CREATE TABLE IF NOT EXISTS block_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const legacy = db.prepare('SELECT url FROM blocked_sites').all();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO block_domains (project_id, domain) VALUES (NULL, ?)'
  );
  for (const row of legacy) {
    insert.run(normalizeDomain(row.url));
  }

  dedupeBlockDomains();

  const tg = db
    .prepare(
      'SELECT id FROM block_apps WHERE process_name = ? AND project_id IS NULL'
    )
    .get('Telegram');
  if (!tg) {
    db.prepare(
      'INSERT INTO block_apps (project_id, app_name, process_name, is_blocked) VALUES (NULL, ?, ?, 0)'
    ).run('Telegram', 'Telegram');
  }

  // Global rows are catalog only — blocking is per-project (block_apps.project_id).
  db.prepare('UPDATE block_apps SET is_blocked = 0 WHERE project_id IS NULL').run();

  ensureScheduleColumns(db);
}

function ensureScheduleColumns(db) {
  const cols = new Set(
    db.prepare('PRAGMA table_info(block_schedules)').all().map((c) => c.name)
  );
  if (!cols.has('schedule_type')) {
    db.exec(
      `ALTER TABLE block_schedules ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'website'`
    );
  }
  if (!cols.has('app_name')) {
    db.exec(`ALTER TABLE block_schedules ADD COLUMN app_name TEXT`);
  }
  if (!cols.has('project_id')) {
    db.exec(`ALTER TABLE block_schedules ADD COLUMN project_id INTEGER`);
  }
}

function mapScheduleRow(row) {
  if (!row) return row;
  return {
    ...row,
    type: row.schedule_type || 'website',
    days: JSON.parse(row.days || '[1,2,3,4,5]'),
  };
}

function getDomains(projectId = null) {
  const db = getDb();
  let rows;
  if (projectId) {
    rows = db
      .prepare(
        `SELECT * FROM block_domains
         WHERE project_id IS NULL OR project_id = ?
         ORDER BY domain`
      )
      .all(projectId);
  } else {
    rows = db
      .prepare('SELECT * FROM block_domains WHERE project_id IS NULL ORDER BY domain')
      .all();
  }
  return dedupeDomainRows(rows);
}

function getProjectDomainsOnly(projectId) {
  const db = getDb();
  if (!db || projectId == null) return [];
  const pid = Number(projectId);
  if (!Number.isFinite(pid)) return [];
  return db
    .prepare('SELECT * FROM block_domains WHERE project_id = ? ORDER BY domain')
    .all(pid);
}

function addDomain(domain, projectId = null) {
  const db = getDb();
  if (!db) throw new Error('Database not available');
  const d = normalizeDomain(domain);
  if (!d) throw new Error('Invalid domain');

  const pid =
    projectId != null && projectId !== '' ? Number(projectId) : null;
  const scopedProjectId = pid != null && Number.isFinite(pid) ? pid : null;

  const existing = scopedProjectId
    ? db
        .prepare(
          'SELECT * FROM block_domains WHERE domain = ? AND project_id = ?'
        )
        .get(d, scopedProjectId)
    : db
        .prepare('SELECT * FROM block_domains WHERE domain = ? AND project_id IS NULL')
        .get(d);

  if (existing) {
    return existing;
  }

  const result = db
    .prepare('INSERT INTO block_domains (project_id, domain) VALUES (?, ?)')
    .run(scopedProjectId, d);

  const row = db
    .prepare('SELECT * FROM block_domains WHERE id = ?')
    .get(result.lastInsertRowid);

  syncProjectBlockList(scopedProjectId);
  return row || { id: result.lastInsertRowid, project_id: scopedProjectId, domain: d };
}

function removeDomain(id) {
  const row = getDb().prepare('SELECT * FROM block_domains WHERE id = ?').get(id);
  getDb().prepare('DELETE FROM block_domains WHERE id = ?').run(id);
  if (row) syncProjectBlockList(row.project_id);
}

function getExceptions(projectId = null) {
  const db = getDb();
  if (projectId) {
    return db
      .prepare(
        `SELECT * FROM block_exceptions
         WHERE project_id IS NULL OR project_id = ?
         ORDER BY pattern`
      )
      .all(projectId);
  }
  return db
    .prepare(
      'SELECT * FROM block_exceptions WHERE project_id IS NULL ORDER BY pattern'
    )
    .all();
}

function addException(pattern, projectId = null) {
  const p = String(pattern).trim().toLowerCase();
  if (!p) throw new Error('Invalid pattern');
  const r = getDb()
    .prepare('INSERT INTO block_exceptions (project_id, pattern) VALUES (?, ?)')
    .run(projectId, p);
  return { id: r.lastInsertRowid, project_id: projectId, pattern: p };
}

function removeException(id) {
  getDb().prepare('DELETE FROM block_exceptions WHERE id = ?').run(id);
}

function getApps(projectId = null) {
  const db = getDb();
  if (projectId) {
    return db
      .prepare(
        `SELECT * FROM block_apps
         WHERE project_id IS NULL OR project_id = ?
         ORDER BY app_name`
      )
      .all(projectId);
  }
  return db
    .prepare('SELECT * FROM block_apps WHERE project_id IS NULL ORDER BY app_name')
    .all();
}

function setAppBlocked(appName, processName, blocked, projectId = null) {
  const db = getDb();
  const existing = db
    .prepare(
      'SELECT * FROM block_apps WHERE project_id IS ? AND process_name = ?'
    )
    .get(projectId, processName);

  if (existing) {
    db.prepare('UPDATE block_apps SET is_blocked = ? WHERE id = ?').run(
      blocked ? 1 : 0,
      existing.id
    );
    return { ...existing, is_blocked: blocked ? 1 : 0 };
  }

  const r = db
    .prepare(
      'INSERT INTO block_apps (project_id, app_name, process_name, is_blocked) VALUES (?, ?, ?, ?)'
    )
    .run(projectId, appName, processName, blocked ? 1 : 0);
  return {
    id: r.lastInsertRowid,
    project_id: projectId,
    app_name: appName,
    process_name: processName,
    is_blocked: blocked ? 1 : 0,
  };
}

/** Only apps the user explicitly enabled for this project (block_apps.project_id). */
function getBlockedAppsForSession(projectId) {
  if (projectId == null) return [];
  const rows = getDb()
    .prepare(
      `SELECT * FROM block_apps
       WHERE project_id = ? AND is_blocked = 1`
    )
    .all(projectId);
  return rows;
}

function normalizeScheduleTime(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    return `${h24[1].padStart(2, '0')}:${h24[2]}`;
  }
  const h12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (h12) {
    let h = parseInt(h12[1], 10);
    const min = h12[2];
    const pm = h12[3].toUpperCase() === 'PM';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  return s;
}

function getSchedules(filterType = null) {
  const db = getDb();
  if (!db) return [];
  const rows = db
    .prepare('SELECT * FROM block_schedules ORDER BY schedule_type, domain')
    .all()
    .map(mapScheduleRow);
  if (!filterType) return rows;
  return rows.filter((s) => s.type === filterType);
}

function addSchedule(data) {
  const db = getDb();
  if (!db) throw new Error('Database not available');
  const scheduleType = data.type === 'app' ? 'app' : 'website';
  let domain;
  let appName = null;
  const projectId =
    data.project_id != null
      ? data.project_id
      : data.projectId != null
        ? data.projectId
        : null;

  if (scheduleType === 'app') {
    domain = String(data.process_name || data.domain || '').trim();
    appName = String(data.app_name || '').trim() || domain;
    if (!domain) throw new Error('Invalid app');
  } else {
    domain = normalizeDomain(data.domain);
    if (!domain) throw new Error('Invalid domain');
  }

  const startTime = normalizeScheduleTime(data.start_time) || '09:00';
  const endTime = normalizeScheduleTime(data.end_time) || '18:00';
  const daysJson = JSON.stringify(data.days || [1, 2, 3, 4, 5]);
  const r = db
    .prepare(
      `INSERT INTO block_schedules (
         domain, start_time, end_time, days, enabled, schedule_type, app_name, project_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      domain,
      startTime,
      endTime,
      daysJson,
      data.enabled !== false ? 1 : 0,
      scheduleType,
      appName,
      projectId
    );
  const row = db
    .prepare('SELECT * FROM block_schedules WHERE id = ?')
    .get(r.lastInsertRowid);
  return mapScheduleRow(row);
}

function removeSchedule(id) {
  getDb().prepare('DELETE FROM block_schedules WHERE id = ?').run(id);
}

function syncProjectBlockList(projectId) {
  if (!projectId) return;
  const domains = getProjectDomainsOnly(projectId).map((d) => d.domain);
  getDb()
    .prepare('UPDATE projects SET block_list = ? WHERE id = ?')
    .run(JSON.stringify(domains), projectId);
}

function getEffectiveDomains(projectId) {
  const db = getDb();
  const global = db
    .prepare('SELECT domain FROM block_domains WHERE project_id IS NULL')
    .all()
    .map((r) => r.domain);

  let project = [];
  if (projectId) {
    const row = db.prepare('SELECT block_list FROM projects WHERE id = ?').get(projectId);
    if (row) {
      try {
        project = JSON.parse(row.block_list || '[]');
      } catch {
        project = [];
      }
    }
    const extra = db
      .prepare('SELECT domain FROM block_domains WHERE project_id = ?')
      .all(projectId)
      .map((r) => r.domain);
    project = [...project, ...extra];
  }

  const { getActiveScheduledWebsiteDomains } = require('./scheduleManager');
  const scheduled = getActiveScheduledWebsiteDomains();

  const set = new Set();
  for (const d of [...global, ...project, ...scheduled]) {
    const n = normalizeDomain(d);
    if (n) set.add(n);
  }
  return Array.from(set);
}

function getEffectiveExceptions(projectId) {
  const db = getDb();
  const rows = projectId
    ? db
        .prepare(
          `SELECT pattern FROM block_exceptions
           WHERE project_id IS NULL OR project_id = ?`
        )
        .all(projectId)
    : db
        .prepare('SELECT pattern FROM block_exceptions WHERE project_id IS NULL')
        .all();
  return rows.map((r) => r.pattern);
}

module.exports = {
  migrateBlockTables,
  getDomains,
  getProjectDomainsOnly,
  addDomain,
  removeDomain,
  getExceptions,
  addException,
  removeException,
  getApps,
  setAppBlocked,
  getBlockedAppsForSession,
  getSchedules,
  addSchedule,
  removeSchedule,
  syncProjectBlockList,
  getEffectiveDomains,
  getEffectiveExceptions,
};
