#!/usr/bin/env node
/**
 * FocusFlow ishlamayotgan bo'lsa va DB da faol focus bo'lsa — ilovani qayta ochadi.
 * hosts-guard.js ichidan chaqiriladi.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

const DB_PATH = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'focusflow',
  'focusflow.db'
);
const RELAUNCH_JSON = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'focusflow',
  'relaunch.json'
);
const RELAUNCH_STATE = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'focusflow',
  'relaunch-state.json'
);

const MAX_RELAUNCHS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 4_000;

function readJson(p, fb) {
  try {
    if (!fs.existsSync(p)) return fb;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fb;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function isFocusFlowRunning() {
  const patterns = [
    'FocusFlow',
    'FocusFlow.app/Contents/MacOS/FocusFlow',
  ];
  for (const pat of patterns) {
    try {
      execSync(`pgrep -f ${JSON.stringify(pat)}`, { stdio: 'ignore' });
      return true;
    } catch {
      /* not running */
    }
  }
  return false;
}

function hasActiveFocusSession() {
  if (!fs.existsSync(DB_PATH)) return false;
  try {
    const { createRequire } = require('module');
    const Database = createRequire(
      path.join(__dirname, '../package.json')
    )('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true });
    const row = db
      .prepare(
        `SELECT id, expected_end_at FROM focus_sessions
         WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
      )
      .get();
    db.close();
    if (!row) return false;
    if (row.expected_end_at) {
      const end = new Date(row.expected_end_at).getTime();
      if (Date.now() >= end) return false;
    }
    return true;
  } catch (err) {
    console.warn('[focus-relaunch] db:', err.message);
    return false;
  }
}

function canRelaunch() {
  const meta = readJson(RELAUNCH_JSON, {});
  if (meta.autoRelaunch === false) return false;
  if (meta.relaunchAllowed !== true) return false;

  const state = readJson(RELAUNCH_STATE, {
    windowStart: Date.now(),
    count: 0,
    lastRelaunchAt: 0,
  });
  const now = Date.now();
  if (now - state.windowStart > WINDOW_MS) {
    state.windowStart = now;
    state.count = 0;
  }
  if (state.count >= MAX_RELAUNCHS) return false;
  if (now - (state.lastRelaunchAt || 0) < MIN_GAP_MS) return false;
  return true;
}

function recordRelaunch() {
  const state = readJson(RELAUNCH_STATE, {
    windowStart: Date.now(),
    count: 0,
    lastRelaunchAt: 0,
  });
  state.count = (state.count || 0) + 1;
  state.lastRelaunchAt = Date.now();
  writeJson(RELAUNCH_STATE, state);
}

function spawnFromMeta(meta) {
  if (meta.packaged && meta.openArgs?.length) {
    spawn(meta.openArgs[0], meta.openArgs.slice(1), {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }
  if (meta.dev?.electronPath && meta.dev?.appRoot) {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    spawn(meta.dev.electronPath, meta.dev.args || ['.'], {
      cwd: meta.dev.appRoot,
      detached: true,
      stdio: 'ignore',
      env,
    }).unref();
    return;
  }
  spawn('open', ['-a', meta.appName || 'FocusFlow'], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

function tryRelaunchFocusApp() {
  if (isFocusFlowRunning()) return false;
  if (!hasActiveFocusSession()) return false;
  if (!canRelaunch()) return false;

  const meta = readJson(RELAUNCH_JSON, null);
  if (!meta) {
    console.warn('[focus-relaunch] relaunch.json yo‘q');
    return false;
  }

  console.log('[focus-relaunch] Focus faol — ilova qayta ochilmoqda');
  spawnFromMeta(meta);
  recordRelaunch();
  return true;
}

module.exports = { tryRelaunchFocusApp };

if (require.main === module) {
  tryRelaunchFocusApp();
}
