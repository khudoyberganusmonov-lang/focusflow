const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { execFileSync } = require('child_process');
const { getDb, isDatabaseReady } = require('./database');

const LAUNCH_AGENT_LABEL = 'com.powerfx.focusflow.hosts-guard';
const LAUNCH_AGENT_PLIST = 'com.powerfx.focusflow.hosts-guard.plist';

function getAppRoot() {
  if (app?.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(__dirname, '../..');
}

function getGuardScriptPath() {
  if (app?.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'hosts-guard.js');
    if (fs.existsSync(bundled)) return bundled;
  }
  return path.join(getAppRoot(), 'scripts', 'hosts-guard.js');
}

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw || '');
  } catch {
    return fallback;
  }
}

function computeRemainingSeconds(snapshot) {
  if (!snapshot?.startedAt) return 0;
  const started = new Date(snapshot.startedAt).getTime();
  let pauseMs = snapshot.accumulatedPause || 0;
  if (snapshot.paused && snapshot.pausedAt) {
    pauseMs += Date.now() - snapshot.pausedAt;
  }
  const elapsed = Math.floor((Date.now() - started - pauseMs) / 1000);
  return Math.max(0, (snapshot.totalSeconds || 0) - elapsed);
}

function buildSnapshot(focusState) {
  return {
    projectId: focusState.projectId,
    projectName: focusState.projectName,
    taskId: focusState.taskId,
    taskTitle: focusState.taskTitle,
    taskIcon: focusState.taskIcon,
    taskCategory: focusState.taskCategory,
    categoryLabel: focusState.categoryLabel,
    fullscreenLock: Boolean(focusState.fullscreenLock),
    taskLockMode: focusState.taskLockMode,
    pomodoro: focusState.pomodoro || null,
    pomodoroLabel: focusState.pomodoroLabel || null,
    overallRemainingSeconds: focusState.overallRemainingSeconds ?? null,
    startedAt: focusState.startedAt,
    totalSeconds: focusState.totalSeconds,
    accumulatedPause: focusState.accumulatedPause || 0,
    paused: Boolean(focusState.paused),
    pausedAt: focusState.pausedAt || null,
    stopLock: focusState.stopLock || null,
    hostsAuthOk: focusState.hostsAuthOk,
    hostsActive: focusState.hostsActive,
    hostsDomainCount: focusState.hostsDomainCount,
  };
}

function expectedEndFromFocusState(focusState) {
  const remaining = focusState.remainingSeconds ?? computeRemainingSeconds(buildSnapshot(focusState));
  return new Date(Date.now() + remaining * 1000).toISOString();
}

function getActiveRow(db) {
  return db
    .prepare(
      `SELECT fs.*, p.name as project_name, p.stop_lock_type, p.stop_lock_timer_minutes,
              p.stop_lock_password
       FROM focus_sessions fs
       JOIN projects p ON p.id = fs.project_id
       WHERE fs.is_active = 1
       ORDER BY fs.id DESC
       LIMIT 1`
    )
    .get();
}

function activateSession(sessionId, focusState, blockedSites) {
  const db = getDb();
  if (!db || !sessionId || !focusState) return;

  const sites = JSON.stringify(blockedSites || []);
  const snapshot = JSON.stringify(buildSnapshot(focusState));
  const expectedEnd = expectedEndFromFocusState(focusState);

  db.prepare(
    `UPDATE focus_sessions SET
      is_active = 1,
      expected_end_at = ?,
      blocked_sites = ?,
      persist_snapshot = ?
     WHERE id = ?`
  ).run(expectedEnd, sites, snapshot, sessionId);
}

function syncSession(focusState, blockedSites) {
  const db = getDb();
  if (!db || !focusState?.sessionId) return;

  const sites = JSON.stringify(blockedSites || []);
  const snapshot = JSON.stringify(buildSnapshot(focusState));
  const expectedEnd = expectedEndFromFocusState(focusState);

  db.prepare(
    `UPDATE focus_sessions SET
      expected_end_at = ?,
      blocked_sites = ?,
      persist_snapshot = ?
     WHERE id = ? AND is_active = 1`
  ).run(expectedEnd, sites, snapshot, focusState.sessionId);
}

function deactivateSession(sessionId, endedAt, duration) {
  const db = getDb();
  if (!db || !sessionId) return;

  db.prepare(
    `UPDATE focus_sessions SET
      is_active = 0,
      expected_end_at = NULL,
      ended_at = COALESCE(ended_at, ?),
      duration = CASE WHEN duration > 0 THEN duration ELSE ? END
     WHERE id = ?`
  ).run(endedAt || new Date().toISOString(), duration || 0, sessionId);
}

function finalizeExpiredRow(row) {
  const db = getDb();
  if (!db || !row) return;

  const snapshot = parseJson(row.persist_snapshot, {});
  const started = new Date(snapshot.startedAt || row.started_at).getTime();
  const duration = Math.max(
    0,
    Math.floor((Date.now() - started - (snapshot.accumulatedPause || 0)) / 1000)
  );

  deactivateSession(row.id, new Date().toISOString(), duration);
}

function rowToFocusState(row) {
  const snapshot = parseJson(row.persist_snapshot, {});
  let remainingSeconds = computeRemainingSeconds(snapshot);

  if (snapshot.pomodoro?.enabled) {
    try {
      const pomodoroCycle = require('./pomodoroCycle');
      remainingSeconds = pomodoroCycle.getPhaseRemainingSeconds(snapshot.pomodoro);
      snapshot.fullscreenLock = snapshot.pomodoro.phase === 'break';
    } catch {
      /* keep computed */
    }
  }

  if (remainingSeconds <= 0) {
    return null;
  }

  return {
    sessionId: row.id,
    projectId: snapshot.projectId ?? row.project_id,
    projectName: snapshot.projectName || row.project_name,
    taskId: snapshot.taskId ?? null,
    taskTitle: snapshot.taskTitle ?? null,
    taskIcon: snapshot.taskIcon ?? null,
    taskCategory: snapshot.taskCategory ?? null,
    categoryLabel: snapshot.categoryLabel ?? null,
    fullscreenLock: Boolean(snapshot.fullscreenLock),
    taskLockMode: snapshot.taskLockMode || 'none',
    pomodoro: snapshot.pomodoro || null,
    pomodoroLabel: snapshot.pomodoroLabel || null,
    overallRemainingSeconds: snapshot.overallRemainingSeconds ?? null,
    startedAt: snapshot.startedAt || row.started_at,
    totalSeconds: snapshot.totalSeconds || 0,
    remainingSeconds,
    paused: Boolean(snapshot.paused),
    pausedAt: snapshot.pausedAt || null,
    accumulatedPause: snapshot.accumulatedPause || 0,
    hostsAuthOk: snapshot.hostsAuthOk ?? false,
    hostsActive: true,
    hostsDomainCount: snapshot.hostsDomainCount ?? 0,
    stopLock: snapshot.stopLock || {
      type: row.stop_lock_type || 'timer',
      timerMinutes: row.stop_lock_timer_minutes ?? 5,
      password: row.stop_lock_password || 'TOXTAMAN',
    },
    restored: true,
  };
}

function getPersistedHostsForRow(row) {
  return parseJson(row.blocked_sites, []);
}

function getLaunchAgentPlistContent() {
  const appRoot = getAppRoot();
  const scriptPath = getGuardScriptPath();
  const electronPath = process.execPath;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${electronPath}</string>
    <string>${scriptPath}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ELECTRON_RUN_AS_NODE</key>
    <string>1</string>
    <key>FOCUSFLOW_APP_ROOT</key>
    <string>${appRoot}</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>${appRoot}</string>
  <key>StartInterval</key>
  <integer>30</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${path.join(app.getPath('userData'), 'hosts-guard.log')}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(app.getPath('userData'), 'hosts-guard.err.log')}</string>
</dict>
</plist>
`;
}

function isLaunchAgentLoaded() {
  try {
    execFileSync(
      'launchctl',
      ['print', `gui/${process.getuid()}/${LAUNCH_AGENT_LABEL}`],
      { stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}

function installLaunchAgent() {
  if (process.platform !== 'darwin') return { ok: false, reason: 'not_macos' };
  if (!app.isPackaged) {
    console.log('[focusPersistence] LaunchAgent skipped (dev mode)');
    return { ok: false, reason: 'dev_mode' };
  }

  try {
    const plistDir = path.join(process.env.HOME, 'Library/LaunchAgents');
    const plistPath = path.join(plistDir, LAUNCH_AGENT_PLIST);
    const plistContent = getLaunchAgentPlistContent();
    fs.mkdirSync(plistDir, { recursive: true });

    const plistExists = fs.existsSync(plistPath);
    const plistMatches =
      plistExists && fs.readFileSync(plistPath, 'utf8') === plistContent;
    const loaded = isLaunchAgentLoaded();

    if (plistMatches && loaded) {
      console.log('[focusPersistence] LaunchAgent already installed');
      return { ok: true, skipped: true, path: plistPath };
    }

    if (!plistMatches) {
      fs.writeFileSync(plistPath, plistContent, 'utf8');
    }

    if (loaded) {
      try {
        execFileSync('launchctl', ['bootout', `gui/${process.getuid()}`, plistPath], {
          stdio: 'ignore',
        });
      } catch {
        /* not loaded */
      }
    }

    execFileSync('launchctl', ['bootstrap', `gui/${process.getuid()}`, plistPath], {
      stdio: 'pipe',
    });
    execFileSync('launchctl', ['enable', `gui/${process.getuid()}/${LAUNCH_AGENT_LABEL}`], {
      stdio: 'ignore',
    });

    console.log('[focusPersistence] LaunchAgent installed:', plistPath);
    return { ok: true, path: plistPath };
  } catch (err) {
    console.warn('[focusPersistence] LaunchAgent install failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * @returns {{ focusState: object|null, expired: boolean, notify: boolean }}
 */
function loadActivePersistedSession() {
  if (!isDatabaseReady()) {
    return { focusState: null, expired: false, notify: false };
  }

  const db = getDb();
  const row = getActiveRow(db);
  if (!row) {
    return { focusState: null, expired: false, notify: false };
  }

  const now = Date.now();
  const expectedEnd = row.expected_end_at
    ? new Date(row.expected_end_at).getTime()
    : 0;

  if (expectedEnd > 0 && now >= expectedEnd) {
    finalizeExpiredRow(row);
    return { focusState: null, expired: true, notify: false };
  }

  const focusState = rowToFocusState(row);
  if (!focusState) {
    finalizeExpiredRow(row);
    return { focusState: null, expired: true, notify: false };
  }

  return {
    focusState,
    blockedSites: getPersistedHostsForRow(row),
    expired: false,
    notify: true,
  };
}

module.exports = {
  activateSession,
  syncSession,
  deactivateSession,
  loadActivePersistedSession,
  installLaunchAgent,
  getPersistedHostsForRow,
  finalizeExpiredRow,
};
