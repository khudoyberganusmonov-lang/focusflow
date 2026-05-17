const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { app } = require('electron');
const settingsService = require('./settingsService');

const RELAUNCH_FILE = 'relaunch.json';
const RELAUNCH_STATE_FILE = 'relaunch-state.json';
/** Fokus paytida qayta ochish tekshiruvi (soniya) */
const RELAUNCH_POLL_SECONDS = 5;
const MAX_RELAUNCHS_PER_WINDOW = 8;
const RELAUNCH_WINDOW_MS = 10 * 60 * 1000;
const MIN_RELAUNCH_GAP_MS = 4_000;

const RELAUNCH_AGENT_LABEL = 'com.powerfx.focusflow.focus-relaunch';
const RELAUNCH_AGENT_PLIST = 'com.powerfx.focusflow.focus-relaunch.plist';

function userDataPath(name) {
  return path.join(app.getPath('userData'), name);
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function isAutoRelaunchEnabled() {
  const fg = settingsService.getSettings().focusGuard || {};
  return fg.autoRelaunch !== false;
}

function writeRelaunchMetadata() {
  const meta = {
    updatedAt: new Date().toISOString(),
    packaged: app.isPackaged,
    appName: app.getName?.() || 'FocusFlow',
    autoRelaunch: isAutoRelaunchEnabled(),
  };

  if (app.isPackaged) {
    try {
      meta.execPath = process.execPath;
      meta.appBundle =
        path.dirname(path.dirname(path.dirname(process.execPath))) || null;
    } catch {
      /* ignore */
    }
    meta.openArgs = ['open', '-a', meta.appName];
  } else {
    meta.openArgs = null;
    meta.dev = {
      electronPath: process.execPath,
      appRoot: app.getAppPath(),
      args: ['.'],
    };
  }

  writeJson(userDataPath(RELAUNCH_FILE), meta);
  return meta;
}

function clearRelaunchIntent() {
  const meta = readJson(userDataPath(RELAUNCH_FILE), {});
  meta.relaunchAllowed = false;
  meta.clearedAt = new Date().toISOString();
  writeJson(userDataPath(RELAUNCH_FILE), meta);
}

function setRelaunchAllowed(allowed) {
  const meta = readJson(userDataPath(RELAUNCH_FILE), {}) || {};
  meta.relaunchAllowed = allowed === true;
  meta.updatedAt = new Date().toISOString();
  if (allowed) {
    writeJson(userDataPath(RELAUNCH_STATE_FILE), {
      windowStart: Date.now(),
      count: 0,
      lastRelaunchAt: 0,
    });
  }
  writeJson(userDataPath(RELAUNCH_FILE), meta);
}

function canRelaunchNow() {
  if (!isAutoRelaunchEnabled()) return false;
  const meta = readJson(userDataPath(RELAUNCH_FILE), {});
  if (meta.relaunchAllowed !== true) return false;

  const state = readJson(userDataPath(RELAUNCH_STATE_FILE), {
    windowStart: Date.now(),
    count: 0,
    lastRelaunchAt: 0,
  });

  const now = Date.now();
  if (now - state.windowStart > RELAUNCH_WINDOW_MS) {
    state.windowStart = now;
    state.count = 0;
  }
  if (state.count >= MAX_RELAUNCHS_PER_WINDOW) return false;
  if (now - (state.lastRelaunchAt || 0) < MIN_RELAUNCH_GAP_MS) return false;

  return true;
}

function recordRelaunchAttempt() {
  const state = readJson(userDataPath(RELAUNCH_STATE_FILE), {
    windowStart: Date.now(),
    count: 0,
    lastRelaunchAt: 0,
  });
  state.count = (state.count || 0) + 1;
  state.lastRelaunchAt = Date.now();
  writeJson(userDataPath(RELAUNCH_STATE_FILE), state);
}

function spawnRelaunchFromMetadata(meta) {
  if (!meta) return false;

  if (meta.packaged && meta.openArgs?.length) {
    spawn(meta.openArgs[0], meta.openArgs.slice(1), {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return true;
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
    return true;
  }

  spawn('open', ['-a', meta.appName || 'FocusFlow'], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  return true;
}

function getRelaunchScriptPath() {
  return path.join(app.getAppPath(), 'scripts', 'focus-relaunch.js');
}

function getRelaunchAgentPlistContent() {
  const appRoot = app.getAppPath();
  const scriptPath = getRelaunchScriptPath();
  const electronPath = process.execPath;
  const logDir = app.getPath('userData');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${RELAUNCH_AGENT_LABEL}</string>
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
  <integer>${RELAUNCH_POLL_SECONDS}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(logDir, 'focus-relaunch.log')}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(logDir, 'focus-relaunch.err.log')}</string>
</dict>
</plist>
`;
}

function isRelaunchAgentLoaded() {
  try {
    execFileSync(
      'launchctl',
      ['print', `gui/${process.getuid()}/${RELAUNCH_AGENT_LABEL}`],
      { stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}

function installRelaunchLaunchAgent() {
  if (process.platform !== 'darwin' || !app.isPackaged) return { ok: false };

  try {
    const plistDir = path.join(process.env.HOME, 'Library/LaunchAgents');
    const plistPath = path.join(plistDir, RELAUNCH_AGENT_PLIST);
    const plistContent = getRelaunchAgentPlistContent();
    fs.mkdirSync(plistDir, { recursive: true });

    const matches =
      fs.existsSync(plistPath) &&
      fs.readFileSync(plistPath, 'utf8') === plistContent;
    const loaded = isRelaunchAgentLoaded();

    if (!matches) fs.writeFileSync(plistPath, plistContent, 'utf8');

    if (loaded && matches) {
      return { ok: true, skipped: true };
    }

    if (loaded) {
      try {
        execFileSync('launchctl', ['bootout', `gui/${process.getuid()}`, plistPath], {
          stdio: 'ignore',
        });
      } catch {
        /* ignore */
      }
    }

    execFileSync('launchctl', ['bootstrap', `gui/${process.getuid()}`, plistPath], {
      stdio: 'pipe',
    });
    execFileSync('launchctl', ['enable', `gui/${process.getuid()}/${RELAUNCH_AGENT_LABEL}`], {
      stdio: 'ignore',
    });
    console.log('[relaunch] fast LaunchAgent:', RELAUNCH_POLL_SECONDS, 's');
    return { ok: true };
  } catch (err) {
    console.warn('[relaunch] LaunchAgent install:', err.message);
    return { ok: false, error: err.message };
  }
}

function uninstallRelaunchLaunchAgent() {
  if (process.platform !== 'darwin') return;
  const plistPath = path.join(
    process.env.HOME,
    'Library/LaunchAgents',
    RELAUNCH_AGENT_PLIST
  );
  if (!fs.existsSync(plistPath)) return;
  try {
    execFileSync('launchctl', ['bootout', `gui/${process.getuid()}`, plistPath], {
      stdio: 'ignore',
    });
  } catch {
    /* ignore */
  }
}

function spawnImmediateRelaunchCheck() {
  const script = getRelaunchScriptPath();
  if (!fs.existsSync(script)) return;
  spawn(process.execPath, [script], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      FOCUSFLOW_APP_ROOT: app.getAppPath(),
    },
  }).unref();
}

let devGuardChild = null;

function startDevGuardWatch() {
  if (app.isPackaged || devGuardChild) return;

  const script = path.join(app.getAppPath(), 'scripts', 'hosts-guard.js');
  if (!fs.existsSync(script)) return;

  devGuardChild = spawn(
    process.execPath,
    [script, '--watch', '--fast-relaunch'],
    {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        FOCUSFLOW_APP_ROOT: app.getAppPath(),
        FOCUSFLOW_RELAUNCH_POLL_SEC: String(RELAUNCH_POLL_SECONDS),
      },
    }
  );
  devGuardChild.unref();
  spawnImmediateRelaunchCheck();
  console.log(`[relaunch] dev watch (relaunch ${RELAUNCH_POLL_SECONDS}s)`);
}

function stopDevGuardWatch() {
  if (!devGuardChild?.pid) return;
  try {
    process.kill(devGuardChild.pid, 'SIGTERM');
  } catch {
    /* ignore */
  }
  devGuardChild = null;
}

function onFocusSessionStarted() {
  writeRelaunchMetadata();
  setRelaunchAllowed(true);

  try {
    const focusPersistence = require('./focusSessionPersistence');
    focusPersistence.installLaunchAgent();
    installRelaunchLaunchAgent();
    spawnImmediateRelaunchCheck();
  } catch (err) {
    console.warn('[relaunch] LaunchAgent:', err.message);
  }

  if (!app.isPackaged) {
    startDevGuardWatch();
  }
}

function onFocusSessionEnded() {
  setRelaunchAllowed(false);
  uninstallRelaunchLaunchAgent();
  if (!app.isPackaged) {
    stopDevGuardWatch();
  }
}

function syncFromSettings() {
  const meta = readJson(userDataPath(RELAUNCH_FILE), {}) || {};
  meta.autoRelaunch = isAutoRelaunchEnabled();
  meta.updatedAt = new Date().toISOString();
  if (!meta.autoRelaunch) {
    meta.relaunchAllowed = false;
  }
  writeJson(userDataPath(RELAUNCH_FILE), meta);
}

module.exports = {
  writeRelaunchMetadata,
  setRelaunchAllowed,
  clearRelaunchIntent,
  isAutoRelaunchEnabled,
  canRelaunchNow,
  recordRelaunchAttempt,
  spawnRelaunchFromMetadata,
  getRelaunchMetadataPath: () => userDataPath(RELAUNCH_FILE),
  onFocusSessionStarted,
  onFocusSessionEnded,
  syncFromSettings,
  RELAUNCH_POLL_SECONDS,
};
