const path = require('path');
const { BrowserWindow, ipcMain, systemPreferences } = require('electron');
const settingsService = require('./settingsService');
const notificationHub = require('./notificationHub');
const { getMediaPipePaths } = require('./mediapipePaths');
const { localDateKey } = require('../shared/dateUtils.cjs');
const { countsAsSitting } = require('../shared/sedentaryLogic.cjs');
const activeWindowService = require('./activeWindowService');

let cameraWindow = null;
let started = false;

const state = {
  present: false,
  cameraOk: false,
  cameraError: null,
  /** Ketma-ket o'tirish (soniya) */
  sittingSeconds: 0,
  /** Bugun jami o'tirish (soniya) */
  todaySeconds: 0,
  todayKey: null,
  warnedThisStint: false,
  awaySince: null,
  engine: null,
  activeAppName: null,
  activeAppMatches: false,
};

let pendingTestResolve = null;
let lastFocusWatchKey = null;

function getFocusState() {
  try {
    return require('./ipc').getFocusState();
  } catch {
    return null;
  }
}

function normalizeProjectId(raw) {
  if (raw == null || raw === '') return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getProjectName(projectId) {
  if (!projectId) return null;
  try {
    const { getDb, isDatabaseReady } = require('./database');
    if (!isDatabaseReady()) return null;
    const row = getDb()
      .prepare('SELECT name FROM projects WHERE id = ?')
      .get(projectId);
    return row?.name || null;
  } catch {
    return null;
  }
}

function shouldWatchForFocus(focusState = getFocusState()) {
  const cfg = getWatchSettings();
  if (!cfg.enabled) return false;
  const linkedId = cfg.projectId;
  if (!linkedId) return false;
  if (!focusState) return false;
  if (focusState.paused) return false;
  return Number(focusState.projectId) === linkedId;
}

function focusWatchKey(focusState = getFocusState()) {
  const cfg = getWatchSettings();
  if (!cfg.enabled) return 'off';
  const linkedId = cfg.projectId;
  if (!linkedId) return 'no-project';
  if (!focusState) return 'idle';
  if (focusState.paused) return `paused:${focusState.projectId}`;
  if (Number(focusState.projectId) === linkedId) return `active:${linkedId}`;
  return `other:${focusState.projectId}`;
}

function todayKey() {
  return localDateKey();
}

async function refreshActiveWindow() {
  const cfg = getWatchSettings();
  if (!cfg.enabled || !shouldWatchForFocus()) {
    state.activeAppName = null;
    state.activeAppMatches = false;
    return;
  }
  const win = await activeWindowService.getActiveWindow();
  const linkedName = getProjectName(cfg.projectId);
  state.activeAppName = win?.appName || null;
  state.activeAppMatches = activeWindowService.appMatchesProject(
    state.activeAppName,
    linkedName
  );
}

function getWatchSettings() {
  const s = settingsService.getSettings().sedentaryWatch || {};
  return {
    enabled: s.enabled === true,
    warnAfterMinutes: Math.max(5, Math.min(180, Number(s.warnAfterMinutes) || 60)),
    testMode: s.testMode === true,
    checkIntervalSeconds: Math.max(10, Math.min(60, Number(s.checkIntervalSeconds) || 20)),
    awayResetMinutes: Math.max(1, Math.min(30, Number(s.awayResetMinutes) || 3)),
    projectId: normalizeProjectId(s.projectId),
  };
}

function resetTodayIfNeeded() {
  const key = todayKey();
  if (state.todayKey !== key) {
    state.todayKey = key;
    state.todaySeconds = 0;
  }
}

function broadcastStatus() {
  const payload = getStatus();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win !== cameraWindow) {
      win.webContents.send('sedentary:status', payload);
    }
  }
}

function getStatus() {
  const cfg = getWatchSettings();
  const focus = getFocusState();
  const linkedId = cfg.projectId;
  const linkedName = getProjectName(linkedId);
  const focusWatching = shouldWatchForFocus(focus);
  resetTodayIfNeeded();
  return {
    enabled: cfg.enabled && started,
    projectId: linkedId,
    projectName: linkedName,
    focusWatching,
    focusProjectName: focus?.projectName || null,
    waitingForFocus:
      cfg.enabled && linkedId && !focusWatching,
    cameraOk: state.cameraOk,
    cameraError: state.cameraError,
    present: state.present,
    sittingMinutes: Math.floor(state.sittingSeconds / 60),
    sittingSeconds: state.sittingSeconds,
    todayMinutes: Math.floor(state.todaySeconds / 60),
    todaySeconds: state.todaySeconds,
    warnAfterMinutes: cfg.warnAfterMinutes,
    remainingMinutes: Math.max(
      0,
      cfg.warnAfterMinutes - Math.floor(state.sittingSeconds / 60)
    ),
    engine: state.engine,
    testMode: cfg.testMode,
    activeAppName: state.activeAppName,
    activeAppMatches: state.activeAppMatches,
  };
}

async function ensureCameraPermission() {
  if (process.platform !== 'darwin') return true;
  try {
    const status = systemPreferences.getMediaAccessStatus('camera');
    if (status === 'granted') return true;
    if (status === 'denied') return false;
    return systemPreferences.askForMediaAccess('camera');
  } catch {
    return true;
  }
}

function createCameraWindow() {
  if (cameraWindow && !cameraWindow.isDestroyed()) return cameraWindow;

  cameraWindow = new BrowserWindow({
    show: false,
    width: 320,
    height: 240,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  cameraWindow.on('closed', () => {
    cameraWindow = null;
    started = false;
  });

  cameraWindow.loadFile(path.join(__dirname, 'sedentary-camera.html'));
  return cameraWindow;
}

async function onPresence({ present }) {
  const cfg = getWatchSettings();
  state.present = Boolean(present);

  if (!cfg.enabled) {
    broadcastStatus();
    return;
  }

  if (!shouldWatchForFocus()) {
    broadcastStatus();
    return;
  }

  await refreshActiveWindow();

  const interval = cfg.checkIntervalSeconds;
  resetTodayIfNeeded();

  const sitting =
    countsAsSitting({
      present: state.present,
      activeAppName: state.activeAppName,
      activeAppMatches: state.activeAppMatches,
    });

  if (sitting) {
    state.sittingSeconds += interval;
    state.todaySeconds += interval;
    state.awaySince = null;

    const warnAfterSec = cfg.warnAfterMinutes * 60;
    if (state.sittingSeconds >= warnAfterSec && !state.warnedThisStint) {
      state.warnedThisStint = true;
      const mins = Math.floor(state.sittingSeconds / 60);
      notificationHub.show({
        soundKey: 'sedentaryWarn',
        notifyKey: 'taskReminders',
        title: 'FocusFlow — O‘tiring!',
        body: `Siz ${mins} daqiqadan beri kompyuterda o‘tirgansiz. Qani rohatlaning va harakatlaning.`,
      });
    }
  } else {
    if (!state.awaySince) state.awaySince = Date.now();
    const awayMs = cfg.awayResetMinutes * 60 * 1000;
    if (Date.now() - state.awaySince >= awayMs) {
      state.sittingSeconds = 0;
      state.warnedThisStint = false;
    }
  }

  broadcastStatus();
}

function registerIpc() {
  ipcMain.removeAllListeners('sedentary:presence');
  ipcMain.removeAllListeners('sedentary:camera-ready');

  ipcMain.on('sedentary:presence', (_, payload) => {
    if (payload?.engine) state.engine = payload.engine;
    void onPresence(payload || {});
  });

  ipcMain.on('sedentary:camera-ready', (_, payload) => {
    state.cameraOk = Boolean(payload?.ok);
    state.cameraError = payload?.ok ? null : payload?.error || 'Kamera xatosi';
    if (payload?.engine) state.engine = payload.engine;
    broadcastStatus();
  });

  ipcMain.removeAllListeners('sedentary:test-result');
  ipcMain.on('sedentary:test-result', (_, payload) => {
    if (pendingTestResolve) {
      pendingTestResolve(payload || {});
      pendingTestResolve = null;
    }
  });
}

function waitForCameraReady(ms = 15000) {
  if (state.cameraOk) return Promise.resolve(true);
  return new Promise((resolve) => {
    const deadline = Date.now() + ms;
    const tick = () => {
      if (state.cameraOk || state.cameraError) {
        resolve(state.cameraOk);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function bootCameraWindow() {
  const allowed = await ensureCameraPermission();
  if (!allowed) {
    state.cameraOk = false;
    state.cameraError =
      'Kamera ruxsati berilmagan. Tizim sozlamalarida FocusFlow uchun kamerani yoqing.';
    return false;
  }

  registerIpc();
  const win = createCameraWindow();

  await new Promise((resolve) => {
    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', resolve);
    } else {
      resolve();
    }
  });

  const mp = getMediaPipePaths();
  if (!mp) {
    state.cameraOk = false;
    state.cameraError =
      'MediaPipe o‘rnatilmagan. Terminalda: npm run mediapipe:setup';
    return false;
  }

  const cfg = getWatchSettings();
  win.webContents.send('sedentary:start', {
    intervalSec: cfg.checkIntervalSeconds,
    wasmPath: mp.wasmPath,
    faceModelPath: mp.faceModelPath,
    modelPath: mp.modelPath,
    poseModelPath: mp.poseModelPath,
  });

  started = true;
  state.cameraError = null;
  return waitForCameraReady();
}

async function start() {
  const cfg = getWatchSettings();
  if (!cfg.enabled) {
    await stop();
    return getStatus();
  }

  if (!cfg.projectId) {
    await stop();
    state.cameraError =
      'Loyihani tanlang — kamera faqat shu loyiha focusida ishlaydi.';
    broadcastStatus();
    return getStatus();
  }

  if (!shouldWatchForFocus()) {
    await stop();
    broadcastStatus();
    return getStatus();
  }

  if (started && state.cameraOk) return getStatus();

  const ok = await bootCameraWindow();
  if (!ok && state.cameraError) {
    broadcastStatus();
    return getStatus();
  }

  broadcastStatus();
  return getStatus();
}

async function stop() {
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    cameraWindow.webContents.send('sedentary:stop');
    cameraWindow.close();
  }
  cameraWindow = null;
  started = false;
  state.present = false;
  state.sittingSeconds = 0;
  state.warnedThisStint = false;
  state.awaySince = null;
  broadcastStatus();
  return getStatus();
}

async function refreshFromSettings() {
  lastFocusWatchKey = null;
  const cfg = getWatchSettings();
  if (!cfg.enabled) return stop();
  if (shouldWatchForFocus()) return start();
  return stop();
}

async function onFocusSessionChanged(focusState) {
  const key = focusWatchKey(focusState);
  if (key === lastFocusWatchKey) {
    broadcastStatus();
    return;
  }
  lastFocusWatchKey = key;

  const cfg = getWatchSettings();
  if (!cfg.enabled) {
    broadcastStatus();
    return;
  }

  if (shouldWatchForFocus(focusState)) {
    await start();
    await refreshActiveWindow();
  } else {
    await stop();
  }
  broadcastStatus();
}

async function runTest() {
  const mp = getMediaPipePaths();
  if (!mp) {
    return {
      ok: false,
      mediapipeInstalled: false,
      error: 'MediaPipe topilmadi. npm run mediapipe:setup',
    };
  }

  const wasRunning = started && state.cameraOk;
  if (!wasRunning) {
    const booted = await bootCameraWindow();
    if (!booted) {
      return {
        ok: false,
        mediapipeInstalled: true,
        cameraOk: false,
        error: state.cameraError || 'Kamera ishga tushmadi',
      };
    }
  }

  if (!cameraWindow || cameraWindow.isDestroyed()) {
    return { ok: false, error: 'Kamera oynasi yo‘q' };
  }

  const result = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (pendingTestResolve) pendingTestResolve = null;
      resolve({
        ok: false,
        error: 'Sinov vaqti tugadi (10 s). Kameraga qarang.',
      });
    }, 10000);

    pendingTestResolve = (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    };

    cameraWindow.webContents.send('sedentary:test');
  });

  const cfg = getWatchSettings();
  if (!wasRunning && !cfg.enabled) {
    await stop();
  }

  broadcastStatus();

  return {
    ok: Boolean(result?.ok),
    mediapipeInstalled: true,
    mediapipeLoaded: state.cameraOk,
    engine: result?.engine || state.engine || 'mediapipe',
    present: Boolean(result?.present),
    faceCount: result?.faceCount ?? 0,
    cameraOk: state.cameraOk,
    cameraError: state.cameraError,
    error: result?.error || null,
    testedAt: new Date().toISOString(),
  };
}

function init() {
  registerIpc();
  lastFocusWatchKey = null;
  if (shouldWatchForFocus()) {
    void start();
  }
}

module.exports = {
  init,
  start,
  stop,
  refreshFromSettings,
  onFocusSessionChanged,
  getStatus,
  runTest,
};
