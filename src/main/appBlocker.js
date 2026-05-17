const { execa } = require('execa');
const notificationHub = require('./notificationHub');
const settingsService = require('./settingsService');

let pollInterval = null;
let blockedApps = [];
let sessionActive = false;
let tickInProgress = false;
/** @type {Map<string, boolean>} notified for current "open" of each app */
let openSessionNotified = new Map();
/** @type {Map<string, number>} first seen running (ms) */
let openSince = new Map();
let onAppBlockedCallback = null;

function setOnAppBlocked(cb) {
  onAppBlockedCallback = cb;
}

function appKey(app) {
  return `${app.app_name || ''}|${app.process_name || ''}`;
}

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getCheckNames(app) {
  return [...new Set([app.app_name, app.process_name].filter(Boolean))];
}

function getBlockerSettings() {
  const s = settingsService.getSettings();
  return s.blocker || { strength: 'strict', killDelay: 2, checkInterval: 2 };
}

function isAppKillEnabled() {
  return getBlockerSettings().strength !== 'soft';
}

async function isProcessRunning(name) {
  if (!name) return false;
  const { exitCode } = await execa('pgrep', ['-x', name], {
    reject: false,
    stdio: 'ignore',
  });
  return exitCode === 0;
}

async function isAnyRunning(app) {
  const names = getCheckNames(app);
  for (const name of names) {
    if (await isProcessRunning(name)) return true;
  }
  return false;
}

async function killByName(name) {
  if (!name) return;
  const escaped = escapeAppleScriptString(name);
  await Promise.all([
    execa('osascript', ['-e', `quit app "${escaped}"`], {
      reject: false,
      stdio: 'ignore',
      timeout: 5000,
    }),
    execa('pkill', ['-9', '-x', name], { reject: false, stdio: 'ignore' }),
    execa('killall', ['-9', name], { reject: false, stdio: 'ignore' }),
  ]);
}

/**
 * Force-quit if running past killDelay. Kills every call after delay; notifies at most once per reopen.
 */
async function forceQuitApp(app, { trackNotify = true } = {}) {
  const key = appKey(app);
  const running = await isAnyRunning(app);

  if (!running) {
    if (trackNotify) {
      openSessionNotified.delete(key);
      openSince.delete(key);
    }
    return { wasRunning: false, shouldNotify: false };
  }

  const { killDelay } = getBlockerSettings();
  const now = Date.now();
  if (!openSince.has(key)) openSince.set(key, now);
  const elapsedSec = (now - openSince.get(key)) / 1000;
  if (elapsedSec < killDelay) {
    return { wasRunning: true, shouldNotify: false };
  }

  const names = getCheckNames(app);
  await Promise.all(names.map((name) => killByName(name)));

  const shouldNotify =
    trackNotify && !openSessionNotified.get(key);
  if (trackNotify && shouldNotify) {
    openSessionNotified.set(key, true);
  }

  return { wasRunning: true, shouldNotify };
}

function notifyBlocked(app) {
  const label = [app.app_name, app.process_name].filter(Boolean).join(' ') ||
    app.process_name ||
    app.app_name ||
    'Ilova';
  notificationHub.showBlockedApp(
    `${label}|${app.process_name || ''}|${app.app_name || ''}`,
    { label }
  );
}

async function tick() {
  if (!sessionActive || blockedApps.length === 0 || tickInProgress) return;
  if (!isAppKillEnabled()) return;

  tickInProgress = true;
  try {
    for (const app of blockedApps) {
      const { wasRunning, shouldNotify } = await forceQuitApp(app);
      if (!wasRunning || !shouldNotify) continue;
      notifyBlocked(app);
      onAppBlockedCallback?.();
    }
  } finally {
    tickInProgress = false;
  }
}

function restartPollInterval() {
  if (!sessionActive) return;
  const { checkInterval } = getBlockerSettings();
  const ms = Math.max(1, checkInterval) * 1000;
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => void tick(), ms);
}

function startAppBlocking(apps) {
  blockedApps = apps || [];
  sessionActive = true;
  openSessionNotified.clear();
  openSince.clear();
  if (!isAppKillEnabled()) return;
  void tick();
  restartPollInterval();
}

function stopAppBlocking() {
  sessionActive = false;
  blockedApps = [];
  openSessionNotified.clear();
  openSince.clear();
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function refreshFromSettings() {
  openSince.clear();
  if (sessionActive && isAppKillEnabled()) {
    restartPollInterval();
  } else if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

const { listInstalledApps, getIconForAppName } = require('./appsCatalog');

module.exports = {
  startAppBlocking,
  stopAppBlocking,
  listInstalledApps,
  getIconForAppName,
  setOnAppBlocked,
  refreshFromSettings,
};
