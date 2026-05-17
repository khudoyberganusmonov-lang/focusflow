const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  nativeTheme,
  shell,
  ipcMain,
  dialog,
} = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const {
  registerIconScheme,
  registerIconProtocol,
} = require('./iconProtocol');

registerIconScheme();

const isDev = !app.isPackaged;

process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err);
  try {
    require('./errorReporting').captureException(err);
  } catch {
    /* ignore */
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason);
  try {
    require('./errorReporting').captureException(
      reason instanceof Error ? reason : new Error(String(reason))
    );
  } catch {
    /* ignore */
  }
});
let mainWindow = null;
let tray = null;
let focusInterval = null;
let ipcModule = null;
let tracker = null;
let initBlocker = null;
let releaseSessionOnAppExit = null;
let quitAfterFocusEnd = false;
let isQuitting = false;
let quitDialogShowing = false;

function isFocusActive() {
  try {
    if (ipcModule?.getFocusState?.()) return true;
    const { loadActivePersistedSession } = require('./focusSessionPersistence');
    const { focusState: persisted } = loadActivePersistedSession();
    return Boolean(persisted);
  } catch {
    return false;
  }
}

function persistFocusStateBeforeQuit() {
  try {
    const ipc = ipcModule || loadRuntimeModules();
    ipc.persistFocusStateBeforeQuit?.();
  } catch (err) {
    console.warn('[main] persistFocusStateBeforeQuit:', err.message);
  }
}

function runBeforeQuitCleanup() {
  try {
    tracker?.stopTracking();
  } catch (err) {
    console.warn('[main] tracker.stopTracking:', err.message);
  }
  if (focusInterval) clearInterval(focusInterval);
  try {
    releaseSessionOnAppExit?.();
  } catch (err) {
    console.warn('[main] releaseSessionOnAppExit:', err.message);
  }
}

function performAppQuit() {
  if (isQuitting) return;
  isQuitting = true;
  quitAfterFocusEnd = false;
  runBeforeQuitCleanup();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners('close');
    mainWindow.destroy();
  }
  app.quit();
}

async function showFocusQuitDialog() {
  if (quitDialogShowing) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  quitDialogShowing = true;
  try {
    mainWindow.show();
    mainWindow.focus();

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Fokus sessiyasi aktiv',
      message: 'Fokus sessiyasi aktiv!',
      detail: "To'xtatish uchun avval fokusni tugating.",
      buttons: ['Fokusga qaytish', 'Baribir chiqish'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });

    if (response === 1) {
      quitAfterFocusEnd = true;
      try {
        const ipc = loadRuntimeModules();
        ipc.requestFocusStop();
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:quit-after-lock');
        }
      } catch (err) {
        console.error('[main] quit-after-lock:', err.message);
        quitAfterFocusEnd = false;
      }
    }
  } finally {
    quitDialogShowing = false;
  }
}

function loadRuntimeModules() {
  if (!ipcModule) {
    ipcModule = require('./ipc');
    tracker = require('./tracker');
    const blocker = require('./blocker');
    initBlocker = blocker.initBlocker;
    releaseSessionOnAppExit = blocker.releaseSessionOnAppExit;
  }
  return ipcModule;
}

process.on('SIGTERM', () => {
  console.log('[main] SIGTERM blocked');
});

process.on('SIGINT', () => {
  if (isFocusActive()) {
    console.log('[main] SIGINT blocked - focus active');
    return;
  }
  if (!isQuitting) {
    isQuitting = true;
    runBeforeQuitCleanup();
    app.quit();
  }
});

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getTrayIcon() {
  try {
    const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      return icon.resize({ width: 18, height: 18 });
    }
  } catch (err) {
    console.warn('[main] tray icon load failed:', err.message);
  }
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFklEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC'
  );
}

function updateTray() {
  if (!tray || !ipcModule) return;
  try {
    const state = ipcModule.getFocusState();
    if (state) {
      const prefix = state.paused ? '⏸' : '🔴';
      tray.setTitle(
        `${prefix} ${state.projectName} — ${formatTime(state.remainingSeconds)}`
      );
    } else {
      tray.setTitle('');
    }
  } catch (err) {
    console.warn('[main] updateTray:', err.message);
  }
}

function buildTrayMenu() {
  const ipc = loadRuntimeModules();
  const state = ipc.getFocusState();
  const items = [];

  if (state) {
    if (state.taskTitle) {
      items.push({ label: `Vazifa: ${state.taskTitle}`, enabled: false });
    }
    const inBreakLock =
      state.fullscreenLock ||
      (state.pomodoro?.enabled && state.pomodoro?.phase === 'break');
    if (!inBreakLock || state.remainingSeconds <= 0) {
      items.push({
        label: "Fokusni to'xtatish",
        click: () => {
          try {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
            ipc.requestFocusStop();
          } catch (err) {
            console.error('[main] tray stop focus:', err.message);
          }
        },
      });
    }
    items.push({ type: 'separator' });
  }

  items.push({
    label: 'FocusFlow ochish',
    click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    },
  });

  if (!state) {
    items.push({ type: 'separator' });
    items.push({
      label: 'Chiqish',
      click: () => performAppQuit(),
    });
  }

  return Menu.buildFromTemplate(items);
}

function createTray() {
  try {
    tray = new Tray(getTrayIcon());
    tray.setToolTip('FocusFlow');
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('[main] createTray failed:', err.message);
    tray = null;
  }
}

function setupFocusTicker() {
  const ipc = loadRuntimeModules();
  if (focusInterval) clearInterval(focusInterval);
  focusInterval = setInterval(() => {
    try {
      const state = ipc.getFocusState();
      if (!state) {
        clearInterval(focusInterval);
        focusInterval = null;
        return;
      }
      ipc.tickFocus();
      updateTray();
      tray?.setContextMenu(buildTrayMenu());
    } catch (err) {
      console.warn('[main] focus ticker:', err.message);
    }
  }, 1000);
}

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 900,
      height: 600,
      minWidth: 700,
      minHeight: 500,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1C1C1E' : '#FFFFFF',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      show: false,
    });

    if (isDev) {
      mainWindow.loadURL('http://localhost:5173').catch((err) => {
        console.error('[main] loadURL failed:', err.message);
      });
    } else {
      mainWindow
        .loadFile(path.join(__dirname, '../../dist/index.html'))
        .catch((err) => {
          console.error('[main] loadFile failed:', err.message);
        });
    }

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
      try {
        const state = ipcModule?.getFocusState?.();
        if (state && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('focus:state', state);
        }
      } catch {
        /* ignore */
      }
    });

    mainWindow.on('close', (e) => {
      if (isQuitting) return;
      try {
        const { isFocusKioskActive } = require('./focusKiosk');
        if (isFocusKioskActive()) {
          e.preventDefault();
          mainWindow.show();
          mainWindow.focus();
          return;
        }
      } catch {
        /* ignore */
      }
      if (process.platform === 'darwin') {
        e.preventDefault();
        mainWindow.hide();
      } else if (isFocusActive()) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    nativeTheme.on('updated', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setBackgroundColor(
          nativeTheme.shouldUseDarkColors ? '#1C1C1E' : '#FFFFFF'
        );
        mainWindow.webContents.send('theme:changed');
      }
    });
  } catch (err) {
    console.error('[main] createWindow failed:', err.message);
  }
}

function applyMac24HourTimePreference() {
  if (process.platform !== 'darwin') return;
  execFile(
    'defaults',
    ['write', 'NSGlobalDomain', 'AppleICUForce24HourTime', '-bool', 'true'],
    (err) => {
      if (err) {
        console.warn('[main] AppleICUForce24HourTime:', err.message);
      }
    }
  );
}

async function bootstrap() {
  applyMac24HourTimePreference();

  try {
    require('./errorReporting').init();
  } catch (err) {
    console.warn('[main] errorReporting:', err.message);
  }

  const { initDatabase, isDatabaseReady, getDatabaseError } = require('./database');

  try {
    await registerIconProtocol();
    console.log('[main] App icon protocol registered');
  } catch (err) {
    console.error('[main] icon protocol failed:', err.message);
  }

  try {
    const dbResult = initDatabase();
    if (!dbResult.ok) {
      console.warn('[main] Database unavailable:', dbResult.error || getDatabaseError());
    } else {
      console.log('[main] Database ready:', isDatabaseReady());
    }
  } catch (err) {
    console.error('[main] initDatabase threw:', err.message);
  }

  try {
    const settingsService = require('./settingsService');
    settingsService.init();
    console.log('[main] Settings initialized');
  } catch (err) {
    console.error('[main] settingsService.init failed:', err.message);
  }

  let ipc;
  try {
    ipc = loadRuntimeModules();
    console.log('[main] IPC modules loaded');
  } catch (err) {
    console.error('[main] loadRuntimeModules failed:', err.message);
    ipc = null;
  }

  try {
    initBlocker();
    console.log('[main] Blocker initialized');
  } catch (err) {
    console.error('[main] initBlocker failed:', err.message);
  }

  try {
    ipc?.registerIpc();
    let focusTickerActive = false;
    ipc?.setFocusStateChangeCallback((state) => {
      updateTray();
      if (tray) tray.setContextMenu(buildTrayMenu());
      if (state && !focusTickerActive) {
        focusTickerActive = true;
        setupFocusTicker();
      } else if (!state) {
        focusTickerActive = false;
        if (focusInterval) {
          clearInterval(focusInterval);
          focusInterval = null;
        }
      }
    });
    console.log('[main] IPC registered');
  } catch (err) {
    console.error('[main] registerIpc failed:', err.message);
  }

  try {
    const restored = await ipc?.restorePersistedFocusIfNeeded?.();
    if (restored) {
      console.log('[main] Restored active focus session (hosts + app poller)');
    }
  } catch (err) {
    console.error('[main] restorePersistedFocus failed:', err.message);
  }

  if (!isDev) {
    try {
      const focusPersistence = require('./focusSessionPersistence');
      focusPersistence.installLaunchAgent();
    } catch (err) {
      console.warn('[main] LaunchAgent install:', err.message);
    }
  }

  try {
    require('./soundPlayer').init();
  } catch (err) {
    console.warn('[main] soundPlayer:', err.message);
  }

  try {
    require('./relaunchService').writeRelaunchMetadata();
  } catch (err) {
    console.warn('[main] relaunchService:', err.message);
  }

  try {
    require('./sedentaryMonitor').init();
    console.log('[main] Sedentary watch initialized');
  } catch (err) {
    console.warn('[main] sedentaryMonitor:', err.message);
  }

  if (!isDev) {
    try {
      const updateService = require('./updateService');
      updateService.init();
      void updateService.checkForUpdates({ manual: false });
    } catch (err) {
      console.warn('[main] updateService:', err.message);
    }
  }

  createWindow();
  createTray();

  try {
    const state = ipc?.getFocusState?.();
    if (state) {
      updateTray();
      if (tray) tray.setContextMenu(buildTrayMenu());
      setupFocusTicker();
    }
  } catch (err) {
    console.warn('[main] post-restore tray setup:', err.message);
  }

  ipcMain.handle('app:quit', () => {
    performAppQuit();
    return { ok: true };
  });

  ipcMain.handle('app:cancel-quit', () => {
    quitAfterFocusEnd = false;
    return { ok: true };
  });

  ipcMain.handle('app:is-quit-pending', () => ({
    pending: quitAfterFocusEnd,
  }));

  const startTrackerDeferred = () => {
    try {
      const tr = tracker || require('./tracker');
      tr.startTracking();
      console.log('[main] Tracker started');
    } catch (err) {
      console.error('[main] tracker.startTracking failed:', err.message);
    }
  };

  if (mainWindow) {
    mainWindow.once('ready-to-show', () => {
      setTimeout(startTrackerDeferred, 2000);
    });
  } else {
    setTimeout(startTrackerDeferred, 2000);
  }

  try {
    const taskSchedule = require('./taskSchedule');
    taskSchedule.requestNotificationPermission();
    taskSchedule.refreshTaskScheduleNotifications();
    setInterval(() => {
      try {
        taskSchedule.checkTaskScheduleNotifications();
      } catch (err) {
        console.warn('[main] task schedule notify:', err.message);
      }
      try {
        const taskAutoRunner = require('./taskAutoRunner');
        const ipc = ipcModule || loadRuntimeModules();
        taskAutoRunner.runTodayAutoSchedule(ipc);
      } catch (err) {
        console.warn('[main] today auto schedule:', err.message);
      }
    }, 30_000);
  } catch (err) {
    console.warn('[main] task schedule notifier:', err.message);
  }
}

app.whenReady().then(() => bootstrap()).catch((err) => {
  console.error('[main] bootstrap failed:', err);
  createWindow();
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});

app.on('before-quit', (event) => {
  persistFocusStateBeforeQuit();

  if (isQuitting) {
    runBeforeQuitCleanup();
    return;
  }

  if (isFocusActive()) {
    event.preventDefault();
    console.log('[main] before-quit blocked - focus active');
    setImmediate(() => {
      void showFocusQuitDialog();
    });
    return;
  }

  isQuitting = true;
  runBeforeQuitCleanup();
});

ipcMain.on('tray:stop-focus', () => {
  try {
    const ipc = loadRuntimeModules();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    ipc.requestFocusStop();
  } catch (err) {
    console.error('[main] tray:stop-focus handler:', err.message);
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err);
  // do NOT exit — keep the app running after unexpected main-process errors
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason);
});
