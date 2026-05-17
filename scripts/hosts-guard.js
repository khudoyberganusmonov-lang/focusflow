#!/usr/bin/env node
/**
 * LaunchAgent / dev watcher: restores /etc/hosts and kills blocked apps
 * while a persisted focus session is active (works when FocusFlow is closed).
 *
 * Production: hosts-guard LaunchAgent 30s; focus-relaunch LaunchAgent 5s (fokus paytida)
 * Dev: npm run guard — relaunch 5s, hosts 30s (--watch --fast-relaunch)
 */
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { createRequire } = require('module');

const fs = require('fs');
const appRoot = process.env.FOCUSFLOW_APP_ROOT
  ? path.resolve(process.env.FOCUSFLOW_APP_ROOT)
  : path.join(__dirname, '..');
const asarPkg = path.join(appRoot, 'app.asar', 'package.json');
const pkgPath = fs.existsSync(asarPkg)
  ? asarPkg
  : path.join(appRoot, 'package.json');
const appRequire = createRequire(pkgPath);
const Database = appRequire('better-sqlite3');
const hostsManager = appRequire('./src/main/hostsManager');
const scheduleEnforcement = appRequire('./src/main/scheduleEnforcement');

const DB_PATH = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'focusflow',
  'focusflow.db'
);

const MARKER = '# >>>> FocusFlow BLOCK';
const WATCH_INTERVAL_MS = 30_000;
const RELAUNCH_INTERVAL_MS = Number(process.env.FOCUSFLOW_RELAUNCH_POLL_SEC || 5) * 1000;

const PROTECTED_PROCESS_NAMES = new Set([
  'Electron',
  'FocusFlow',
  'node',
  'vite',
  'esbuild',
]);

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw || '');
  } catch {
    return fallback;
  }
}

function hostsNeedRestore(domains) {
  if (!domains?.length) return false;
  const current = hostsManager.readHostsSafe();
  if (!current.includes(MARKER)) return true;
  for (const d of domains) {
    if (!current.includes(d)) return true;
  }
  return false;
}

function finalizeExpired(db, row) {
  const snapshot = parseJson(row.persist_snapshot, {});
  const started = new Date(snapshot.startedAt || row.started_at).getTime();
  const duration = Math.max(
    0,
    Math.floor((Date.now() - started - (snapshot.accumulatedPause || 0)) / 1000)
  );

  db.prepare(
    `UPDATE focus_sessions SET
      is_active = 0,
      expected_end_at = NULL,
      ended_at = COALESCE(ended_at, datetime('now')),
      duration = CASE WHEN duration > 0 THEN duration ELSE ? END
     WHERE id = ?`
  ).run(duration, row.id);

  try {
    hostsManager.deactivateHostsLock();
  } catch {
    /* sudo may be unavailable */
  }
}

function ensureFocusSessionColumns(db) {
  const cols = new Set(
    db.prepare('PRAGMA table_info(focus_sessions)').all().map((c) => c.name)
  );
  if (!cols.has('is_active')) {
    db.exec(
      `ALTER TABLE focus_sessions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0`
    );
  }
  if (!cols.has('expected_end_at')) {
    db.exec(`ALTER TABLE focus_sessions ADD COLUMN expected_end_at TEXT`);
  }
  if (!cols.has('blocked_sites')) {
    db.exec(
      `ALTER TABLE focus_sessions ADD COLUMN blocked_sites TEXT NOT NULL DEFAULT '[]'`
    );
  }
  if (!cols.has('persist_snapshot')) {
    db.exec(
      `ALTER TABLE focus_sessions ADD COLUMN persist_snapshot TEXT NOT NULL DEFAULT '{}'`
    );
  }
}

function openDatabase() {
  const db = new Database(DB_PATH, { readonly: false });
  db.pragma('foreign_keys = ON');
  ensureFocusSessionColumns(db);
  return db;
}

function getBlockedProcessNames(db, projectId) {
  if (projectId == null) return [];
  const rows = db
    .prepare(
      `SELECT process_name FROM block_apps
       WHERE project_id = ? AND is_blocked = 1`
    )
    .all(projectId);
  const names = new Set();
  for (const row of rows) {
    const name = String(row.process_name || '').trim();
    if (!name || PROTECTED_PROCESS_NAMES.has(name)) continue;
    names.add(name);
  }
  return Array.from(names);
}

function killBlockedApps(processNames, projectId) {
  for (const processName of processNames) {
    try {
      console.log('[hosts-guard] killing:', processName, '(project', projectId + ')');
      execSync(`killall ${JSON.stringify(processName)}`, { stdio: 'ignore' });
    } catch (err) {
      if (err.status !== 1) {
        console.warn('[hosts-guard] killall failed:', processName, err.message);
      }
    }
  }
}

function restoreHostsIfNeeded(domains) {
  if (!domains.length) return;
  if (!hostsNeedRestore(domains)) return;
  try {
    hostsManager.activateHostsLock(domains, () => {
      hostsManager.restoreIfTampered();
    });
    hostsManager.syncHostsIfNeeded();
  } catch (err) {
    console.error('[hosts-guard] hosts restore:', err.message);
  }
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

function applyScheduledWebsiteHosts(db) {
  const domains = scheduleEnforcement.getActiveWebsiteDomains(db);
  if (domains.length) {
    restoreHostsIfNeeded(domains);
    return;
  }
  try {
    hostsManager.deactivateHostsLock();
  } catch {
    /* sudo may be unavailable */
  }
}

function applyScheduledAppKills(db) {
  const processNames = scheduleEnforcement.getActiveAppProcessNames(db);
  killBlockedApps(processNames, 'schedule');
}

function tryRelaunchFocusApp() {
  try {
    const relaunch = require('./focus-relaunch.js');
    relaunch.tryRelaunchFocusApp();
  } catch (err) {
    console.warn('[hosts-guard] focus-relaunch:', err.message);
  }
}

function runGuardTick(db) {
  ensureScheduleColumns(db);

  tryRelaunchFocusApp();

  const row = db
    .prepare(
      `SELECT id, project_id, started_at, expected_end_at, blocked_sites, persist_snapshot
       FROM focus_sessions
       WHERE is_active = 1
       ORDER BY id DESC
       LIMIT 1`
    )
    .get();

  if (!row) {
    applyScheduledWebsiteHosts(db);
    applyScheduledAppKills(db);
    return;
  }

  const now = Date.now();
  const expectedEnd = row.expected_end_at
    ? new Date(row.expected_end_at).getTime()
    : 0;

  if (expectedEnd > 0 && now >= expectedEnd) {
    finalizeExpired(db, row);
    applyScheduledWebsiteHosts(db);
    applyScheduledAppKills(db);
    return;
  }

  const sessionDomains = parseJson(row.blocked_sites, []);
  const scheduledDomains = scheduleEnforcement.getActiveWebsiteDomains(db);
  const domains = [...new Set([...sessionDomains, ...scheduledDomains])];
  restoreHostsIfNeeded(domains);

  const processNames = getBlockedProcessNames(db, row.project_id);
  const scheduledApps = scheduleEnforcement.getActiveAppProcessNames(db);
  killBlockedApps([...new Set([...processNames, ...scheduledApps])], row.project_id);
}

function runOnce() {
  let db;
  try {
    db = openDatabase();
    runGuardTick(db);
  } catch (err) {
    console.error('[hosts-guard]', err.message);
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}

function runWatch(fastRelaunch) {
  const relaunchMs = fastRelaunch ? RELAUNCH_INTERVAL_MS : WATCH_INTERVAL_MS;
  console.log(
    `[hosts-guard] watch — relaunch ${relaunchMs / 1000}s, hosts ${WATCH_INTERVAL_MS / 1000}s`
  );

  const relaunchTick = () => {
    tryRelaunchFocusApp();
  };

  const hostsTick = () => {
    try {
      const db = openDatabase();
      try {
        const row = db
          .prepare(
            `SELECT id FROM focus_sessions WHERE is_active = 1 LIMIT 1`
          )
          .get();
        if (row) {
          runGuardTick(db);
        } else {
          applyScheduledWebsiteHosts(db);
          applyScheduledAppKills(db);
        }
      } finally {
        db.close();
      }
    } catch (err) {
      console.error('[hosts-guard]', err.message);
    }
  };

  relaunchTick();
  if (fastRelaunch) {
    hostsTick();
    setInterval(relaunchTick, relaunchMs);
    setInterval(hostsTick, WATCH_INTERVAL_MS);
  } else {
    const tick = () => {
      relaunchTick();
      hostsTick();
    };
    tick();
    setInterval(tick, WATCH_INTERVAL_MS);
  }
}

const isWatch = process.argv.includes('--watch');
const fastRelaunch = process.argv.includes('--fast-relaunch');

if (isWatch) {
  runWatch(fastRelaunch);
} else {
  runOnce();
}
