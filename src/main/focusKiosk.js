const { execFile } = require('child_process');
const fs = require('fs');
const { app, BrowserWindow, powerMonitor } = require('electron');

const CGSessionPaths = [
  '/System/Library/CoreServices/Menu Extras/User.account.menu/Contents/Resources/CGSession',
  '/System/Library/CoreServices/Menu Extras/UserAccount.menu/Contents/Resources/CGSession',
];

let kioskActive = false;
let savedWindowState = null;
let systemLockDone = false;
let blurHandler = null;
let unlockHandler = null;
let kioskWin = null;

function getMainWindow() {
  const wins = BrowserWindow.getAllWindows();
  return wins.find((w) => !w.isDestroyed()) || null;
}

function runExec(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, (err) => resolve(!err));
  });
}

/** macOS login screen / display sleep — haqiqiy tizim qulfi. */
function resetSystemLockFlag() {
  systemLockDone = false;
}

async function lockMacOS() {
  if (process.platform !== 'darwin') return false;
  if (systemLockDone) return true;

  const cgPath = CGSessionPaths.find((p) => fs.existsSync(p));
  if (cgPath) {
    const ok = await runExec(cgPath, ['-suspend']);
    if (ok) {
      systemLockDone = true;
      return true;
    }
  }

  const slept = await runExec('/usr/bin/pmset', ['displaysleepnow']);
  if (slept) {
    systemLockDone = true;
    return true;
  }

  const scripted = await runExec('/usr/bin/osascript', [
    '-e',
    'tell application "System Events" to keystroke "q" using {control down, command down}',
  ]);
  if (scripted) systemLockDone = true;
  return scripted;
}

function applyFocusKioskMode(win, enabled) {
  if (!win || win.isDestroyed()) return;

  if (enabled) {
    if (kioskActive) {
      win.show();
      win.focus();
      return;
    }

    savedWindowState = {
      bounds: win.getBounds(),
      fullScreen: win.isFullScreen(),
      kiosk: win.isKiosk(),
    };
    kioskActive = true;

    if (process.platform === 'darwin' && app.dock?.hide) {
      app.dock.hide();
    }

    win.setFullScreenable(true);
    win.setMinimizable(false);
    win.setMaximizable(false);
    win.setClosable(false);
    win.setAlwaysOnTop(true, 'screen-saver', 1);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setFullScreen(true);
    win.setKiosk(true);
    win.show();
    win.focus();

    kioskWin = win;
    blurHandler = () => {
      if (!kioskActive || win.isDestroyed()) return;
      setImmediate(() => {
        if (!kioskActive || win.isDestroyed()) return;
        win.show();
        win.focus();
      });
    };
    win.on('blur', blurHandler);

    if (!unlockHandler) {
      unlockHandler = () => {
        if (!kioskActive || !kioskWin || kioskWin.isDestroyed()) return;
        kioskWin.show();
        kioskWin.focus();
        kioskWin.setFullScreen(true);
      };
      powerMonitor.on('unlock-screen', unlockHandler);
    }
  } else {
    if (!kioskActive) return;
    kioskActive = false;
    systemLockDone = false;

    if (blurHandler && !win.isDestroyed()) {
      win.removeListener('blur', blurHandler);
    }
    blurHandler = null;
    kioskWin = null;

    win.setKiosk(false);
    win.setAlwaysOnTop(false);
    win.setVisibleOnAllWorkspaces(false);
    win.setMinimizable(true);
    win.setMaximizable(true);
    win.setClosable(true);

    if (win.isFullScreen()) {
      win.setFullScreen(false);
    }

    if (savedWindowState?.bounds) {
      try {
        win.setBounds(savedWindowState.bounds);
      } catch {
        /* ignore */
      }
    }
    savedWindowState = null;

    if (process.platform === 'darwin' && app.dock?.show) {
      app.dock.show();
    }
  }
}

function shouldUseKiosk(focusState) {
  if (!focusState || (focusState.remainingSeconds ?? 0) <= 0) return false;
  if (focusState.pomodoro?.enabled) {
    return focusState.pomodoro.phase === 'break';
  }
  return Boolean(focusState.fullscreenLock);
}

function syncFocusKiosk(focusState) {
  const win = getMainWindow();
  if (!win) return;
  applyFocusKioskMode(win, shouldUseKiosk(focusState));
}

async function activateMacLockSession(focusState) {
  if (!shouldUseKiosk(focusState)) return;
  resetSystemLockFlag();
  syncFocusKiosk(focusState);
  const win = getMainWindow();
  if (!win) {
    setTimeout(() => lockMacOS(), 400);
    return;
  }
  const triggerLock = () => {
    setTimeout(() => lockMacOS(), 350);
  };
  if (win.isVisible()) {
    triggerLock();
  } else {
    win.once('show', triggerLock);
    win.show();
  }
}

function deactivateMacLockSession() {
  syncFocusKiosk(null);
}

function isFocusKioskActive() {
  return kioskActive;
}

module.exports = {
  lockMacOS,
  resetSystemLockFlag,
  applyFocusKioskMode,
  syncFocusKiosk,
  activateMacLockSession,
  deactivateMacLockSession,
  isFocusKioskActive,
  shouldUseKiosk,
};
