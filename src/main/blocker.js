const { exec } = require('child_process');
const { execa } = require('execa');
const { session } = require('electron');
const notificationHub = require('./notificationHub');
const hostsManager = require('./hostsManager');
const appBlocker = require('./appBlocker');
const store = require('./blockerStore');
const {
  getActiveScheduledWebsiteDomains,
  getActiveScheduledAppProcesses,
  startScheduleWatcher,
} = require('./scheduleManager');
const { incrementDistractions } = require('./focusSummary');

let activeSessionId = null;

let sessionLock = false;
let currentProjectId = null;
let currentTaskId = null;
let hostsOnlyDomains = [];
let partialRules = [];
let filterRegistered = false;
let scheduleActive = false;
let appKillInterval = null;
let scheduleAppKillInterval = null;

/** @type {Map<string, number>} host -> last notify ms */
const siteBlockNotifyAt = new Map();

/** @type {Map<string, number>} processName -> last notify ms */
const appKillNotifyAt = new Map();

const APP_KILL_INTERVAL_MS = 10_000;
const SITE_NOTIFY_COOLDOWN_MS = 45_000;
const APP_KILL_NOTIFY_COOLDOWN_MS = 45_000;
const SCHEDULE_APP_KILL_INTERVAL_MS = 30_000;

/** Never terminate FocusFlow, dev tooling, or the Electron runtime. */
const PROTECTED_PROCESS_NAMES = new Set([
  'Electron',
  'FocusFlow',
  'node',
  'vite',
  'esbuild',
]);

function resolveKillProcessNames(projectId, taskId = currentTaskId) {
  const names = new Set();
  const apps = store.getBlockedAppsForSession(projectId);
  for (const app of apps) {
    const processName = String(app.process_name || '').trim();
    if (!processName || PROTECTED_PROCESS_NAMES.has(processName)) continue;
    names.add(processName);
  }
  if (taskId) {
    try {
      const { getDb } = require('./database');
      const { parseBlockedApps } = require('./taskMeta');
      const db = getDb();
      if (db) {
        const row = db.prepare('SELECT blocked_apps FROM tasks WHERE id = ?').get(taskId);
        for (const a of parseBlockedApps(row?.blocked_apps)) {
          const pn = String(a.process_name || '').trim();
          if (pn && !PROTECTED_PROCESS_NAMES.has(pn)) names.add(pn);
        }
      }
    } catch (err) {
      console.warn('[blocker] task blocked_apps:', err.message);
    }
  }
  return Array.from(names);
}

async function isProcessRunning(name) {
  if (!name) return false;
  for (const flag of ['-x', '-f']) {
    const { exitCode } = await execa('pgrep', [flag, name], {
      reject: false,
      stdio: 'ignore',
    });
    if (exitCode === 0) return true;
  }
  return false;
}

async function killBlockedAppsForSession() {
  if (!sessionLock || currentProjectId == null) return;

  const processNames = resolveKillProcessNames(currentProjectId, currentTaskId);
  if (processNames.length === 0) return;

  for (const processName of processNames) {
    const running = await isProcessRunning(processName);
    if (!running) continue;

    console.log('[blocker] killing:', processName, '(project', currentProjectId + ')');

    const key = String(processName).toLowerCase();
    const now = Date.now();
    const last = appKillNotifyAt.get(key);
    if (!last || now - last >= APP_KILL_NOTIFY_COOLDOWN_MS) {
      appKillNotifyAt.set(key, now);
      try {
        notificationHub.showBlockedApp(processName, { label: processName });
      } catch (err) {
        console.warn('[blocker] kill notify:', err.message);
      }
    }

    await execa('killall', [processName], { reject: false, stdio: 'ignore' });
  }
}

function startAppKillPoller() {
  stopAppKillPoller();
  void killBlockedAppsForSession();
  appKillInterval = setInterval(
    () => void killBlockedAppsForSession(),
    APP_KILL_INTERVAL_MS
  );
}

function stopAppKillPoller() {
  if (appKillInterval) {
    clearInterval(appKillInterval);
    appKillInterval = null;
  }
}

function killScheduledApps() {
  const processNames = getActiveScheduledAppProcesses();
  if (processNames.length === 0) return;

  for (const processName of processNames) {
    console.log('[blocker] schedule kill:', processName);
    exec(`killall "${String(processName).replace(/"/g, '\\"')}"`, (err) => {
      if (err && err.code !== 1) {
        console.warn('[blocker] schedule killall failed:', processName, err.message);
      }
    });
  }
}

function startScheduleAppKillPoller() {
  if (scheduleAppKillInterval) return;
  killScheduledApps();
  scheduleAppKillInterval = setInterval(
    killScheduledApps,
    SCHEDULE_APP_KILL_INTERVAL_MS
  );
}

function stopScheduleAppKillPoller() {
  if (scheduleAppKillInterval) {
    clearInterval(scheduleAppKillInterval);
    scheduleAppKillInterval = null;
  }
}

function normalizeHost(url) {
  try {
    const u = url.includes('://') ? new URL(url) : new URL(`https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return String(url).replace(/^www\./, '').toLowerCase();
  }
}

function splitDomainsByExceptions(domains, exceptions) {
  const hostsBlock = [];
  const partial = [];

  for (const domain of domains) {
    const base = hostsManager.normalizeDomain(domain);
    const related = exceptions.filter(
      (ex) => ex.includes(base) || base.includes(hostsManager.normalizeDomain(ex.split('/')[0]))
    );
    if (related.length === 0) {
      hostsBlock.push(base);
    } else {
      partial.push({ domain: base, allowedPatterns: related });
    }
  }
  return { hostsBlock, partial };
}

function urlAllowed(url, exceptions) {
  const lower = url.toLowerCase();
  return exceptions.some((ex) => lower.includes(ex.toLowerCase()));
}

function collectBlockedAppsForSession(projectId, taskId = null) {
  const out = [];
  const seen = new Set();

  const add = (app) => {
    const pn = String(app.process_name || app.app_name || '').trim();
    const an = String(app.app_name || pn).trim();
    if (!pn || PROTECTED_PROCESS_NAMES.has(pn)) return;
    const key = `${an}|${pn}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ app_name: an, process_name: pn });
  };

  if (projectId != null) {
    for (const app of store.getBlockedAppsForSession(projectId)) add(app);
  }

  if (taskId) {
    try {
      const { getDb } = require('./database');
      const { parseBlockedApps } = require('./taskMeta');
      const db = getDb();
      if (db) {
        const row = db
          .prepare('SELECT blocked_apps FROM tasks WHERE id = ?')
          .get(taskId);
        for (const a of parseBlockedApps(row?.blocked_apps)) add(a);
      }
    } catch (err) {
      console.warn('[blocker] task blocked_apps collect:', err.message);
    }
  }

  return out;
}

function startSessionAppBlocking(projectId, taskId = null) {
  const apps = collectBlockedAppsForSession(projectId, taskId);
  if (apps.length > 0) {
    appBlocker.startAppBlocking(apps);
  } else {
    appBlocker.stopAppBlocking();
  }
}

function clearSiteBlockNotifyState() {
  siteBlockNotifyAt.clear();
  appKillNotifyAt.clear();
}

function maybeNotifySiteBlocked(url) {
  const host = normalizeHost(url);
  if (!host) return;

  const now = Date.now();
  const last = siteBlockNotifyAt.get(host);
  if (last && now - last < SITE_NOTIFY_COOLDOWN_MS) return;
  siteBlockNotifyAt.set(host, now);

  notificationHub.showBlockedApp(host, { isSite: true });
  recordDistraction();
}

function urlBlockedByPartial(url) {
  try {
    const lower = url.toLowerCase();
    for (const rule of partialRules) {
      if (!lower.includes(rule.domain)) continue;
      const allowed = rule.allowedPatterns.some((p) => lower.includes(p.toLowerCase()));
      if (!allowed) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function registerWebFilter() {
  if (filterRegistered) return;
  const ses = session.defaultSession;

  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (!sessionLock && !scheduleActive) {
      callback({ cancel: false });
      return;
    }

    const url = details.url;
    const exceptions = store.getEffectiveExceptions(currentProjectId);

    if (urlAllowed(url, exceptions)) {
      callback({ cancel: false });
      return;
    }

    if (urlBlockedByPartial(url)) {
      maybeNotifySiteBlocked(url);
      callback({ cancel: true });
      return;
    }

    try {
      const host = normalizeHost(url);
      const blocked = hostsOnlyDomains.some(
        (d) => host === d || host.endsWith(`.${d}`)
      );
      if (blocked) {
        maybeNotifySiteBlocked(url);
        callback({ cancel: true });
        return;
      }
    } catch {
      /* ignore */
    }

    callback({ cancel: false });
  });

  filterRegistered = true;
}

function recordDistraction() {
  if (activeSessionId) incrementDistractions(activeSessionId);
}

function onHostsTampered() {
  recordDistraction();
  notificationHub.show({
    soundKey: 'blockedApp',
    notifyKey: 'blockedApp',
    title: 'FocusFlow',
    body: "/etc/hosts o'zgartirildi — bloklar qayta tiklandi",
  });
}

function setActiveSessionId(sessionId) {
  activeSessionId = sessionId;
  appBlocker.setOnAppBlocked(recordDistraction);
}

function writeHostsBlock(domains) {
  hostsManager.activateHostsLock(domains, onHostsTampered);
  hostsManager.syncHostsIfNeeded();
}

async function applyBlocking(domains, exceptions, projectId, taskId = null) {
  registerWebFilter();
  const { hostsBlock, partial } = splitDomainsByExceptions(domains, exceptions);
  hostsOnlyDomains = hostsBlock;
  partialRules = partial;
  currentProjectId = projectId;
  currentTaskId = taskId || null;

  if (hostsBlock.length > 0) {
    writeHostsBlock(hostsBlock);
  }

  startAppKillPoller();
  startSessionAppBlocking(projectId, taskId);
}

/** App exit / hide — stop in-process pollers only; keep /etc/hosts blocking. */
function releaseSessionOnAppExit() {
  stopAppKillPoller();
  appBlocker.stopAppBlocking();
  clearSiteBlockNotifyState();
  enforceScheduledBlocks();
}

function clearBlocking() {
  sessionLock = false;
  currentProjectId = null;
  currentTaskId = null;
  hostsOnlyDomains = [];
  partialRules = [];
  stopAppKillPoller();
  hostsManager.deactivateHostsLock();
  appBlocker.stopAppBlocking();
  clearSiteBlockNotifyState();
  enforceScheduledBlocks();
}

function refreshScheduleWebsiteBlocks() {
  if (sessionLock) return;
  const scheduled = getActiveScheduledWebsiteDomains();
  if (scheduled.length === 0) {
    scheduleActive = false;
    hostsManager.deactivateHostsLock();
    return;
  }
  scheduleActive = true;
  const exceptions = store.getEffectiveExceptions(null);
  const { hostsBlock, partial } = splitDomainsByExceptions(scheduled, exceptions);
  hostsOnlyDomains = hostsBlock;
  partialRules = partial;
  if (hostsBlock.length > 0) {
    try {
      hostsManager.activateHostsLock(hostsBlock, onHostsTampered);
    } catch {
      scheduleActive = false;
    }
  }
}

function enforceScheduledBlocks() {
  const scheduledApps = getActiveScheduledAppProcesses();
  if (scheduledApps.length > 0) {
    startScheduleAppKillPoller();
  } else {
    stopScheduleAppKillPoller();
  }
  refreshScheduleWebsiteBlocks();
}

function refreshScheduleBlocks() {
  enforceScheduledBlocks();
}

async function restorePersistedBlocking(projectId, blockedSites, sessionId, taskId = null) {
  const domains = store.getEffectiveDomains(projectId);
  const exceptions = store.getEffectiveExceptions(projectId);
  const { hostsBlock } = splitDomainsByExceptions(domains, exceptions);
  const sitesToBlock =
    blockedSites?.length > 0 ? blockedSites : hostsBlock;

  sessionLock = true;
  currentProjectId = projectId;
  currentTaskId = taskId || null;
  setActiveSessionId(sessionId);
  hostsOnlyDomains = sitesToBlock;
  partialRules = [];

  registerWebFilter();
  if (sitesToBlock.length > 0) {
    writeHostsBlock(sitesToBlock);
  }
  startAppKillPoller();
  startSessionAppBlocking(projectId, taskId);

  return {
    hostsAuthOk: hostsManager.isAdminAuthenticated(),
    hostsActive: hostsManager.readHostsSafe().includes('# >>>> FocusFlow BLOCK'),
    hostsDomainCount: sitesToBlock.length,
  };
}

function getTaskBlockedSites(taskId) {
  if (!taskId) return [];
  try {
    const { getDb } = require('./database');
    const { parseBlockedSites } = require('./taskMeta');
    const db = getDb();
    if (!db) return [];
    const row = db.prepare('SELECT blocked_sites FROM tasks WHERE id = ?').get(taskId);
    return parseBlockedSites(row?.blocked_sites);
  } catch (err) {
    console.warn('[blocker] task blocked_sites:', err.message);
    return [];
  }
}

async function startFocusBlocking(projectId, taskId = null) {
  const baseDomains = store.getEffectiveDomains(projectId);
  const taskSites = getTaskBlockedSites(taskId);
  const domains = [...baseDomains];
  for (const d of taskSites) {
    if (d && !domains.includes(d)) domains.push(d);
  }
  const exceptions = store.getEffectiveExceptions(projectId);
  const { hostsBlock } = splitDomainsByExceptions(domains, exceptions);

  sessionLock = true;
  await applyBlocking(domains, exceptions, projectId, taskId);

  return {
    hostsAuthOk: hostsManager.isAdminAuthenticated(),
    hostsActive: hostsManager.readHostsSafe().includes('# >>>> FocusFlow BLOCK'),
    hostsDomainCount: hostsBlock.length,
  };
}

function stopFocusBlocking() {
  sessionLock = false;
  activeSessionId = null;
  stopAppKillPoller();
  appBlocker.setOnAppBlocked(null);
  hostsManager.deactivateHostsLock();
  appBlocker.stopAppBlocking();
  clearSiteBlockNotifyState();
  enforceScheduledBlocks();
}

function initBlocker() {
  try {
    store.migrateBlockTables();
  } catch (err) {
    console.error('[blocker] migrateBlockTables failed:', err.message);
  }
  try {
    startScheduleWatcher(() => {
      enforceScheduledBlocks();
    });
  } catch (err) {
    console.error('[blocker] startScheduleWatcher failed:', err.message);
  }
}

function applyHostsBlockForSession() {
  if (sessionLock && hostsOnlyDomains.length > 0) {
    writeHostsBlock(hostsOnlyDomains);
  }
}

function getStatus() {
  const adminOk = hostsManager.isAdminAuthenticated();
  const hostsActive = hostsManager.readHostsSafe().includes('# >>>> FocusFlow BLOCK');
  return {
    sessionLock,
    hostsActive,
    hostsRepairNeeded: hostsManager.needsSystemHostsRepair(),
    adminOk,
    hostsBlockingReady: adminOk && (hostsActive || hostsOnlyDomains.length === 0),
    domains: hostsOnlyDomains,
    projectId: currentProjectId,
  };
}

module.exports = {
  initBlocker,
  startFocusBlocking,
  restorePersistedBlocking,
  stopFocusBlocking,
  clearBlocking,
  releaseSessionOnAppExit,
  applyHostsBlockForSession,
  getStatus,
  refreshScheduleBlocks,
  setActiveSessionId,
  recordDistraction,
};
