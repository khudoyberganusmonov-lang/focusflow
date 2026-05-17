const { BrowserWindow, Notification } = require('electron');
const { getDb, isDatabaseReady } = require('./database');
const { safeHandle } = require('./safeIpc');
const blocker = require('./blocker');
const {
  startFocusBlocking,
  restorePersistedBlocking,
  stopFocusBlocking,
  setActiveSessionId,
  getStatus,
  applyHostsBlockForSession,
  refreshScheduleBlocks,
} = blocker;
const taskSchedule = require('./taskSchedule');
const focusPersistence = require('./focusSessionPersistence');
const tracker = require('./tracker');
const taskManager = require('./taskManager');
const projectService = require('./projectService');
const reportsService = require('./reportsService');
const { showSessionSummary } = require('./focusSummary');
const ai = require('./ai');
const aiService = require('./aiService');
const settingsService = require('./settingsService');
const appBlocker = require('./appBlocker');
const notifier = require('node-notifier');

let focusState = null;
let onFocusStateChange = null;
let focusCoachTimer = null;
let focusCoachTickCount = 0;
let endingFocusSession = false;

const AI_ERROR = aiService.ERROR_MSG;
const AI_NO_KEY = aiService.NO_KEY_MSG;

function aiKeyMissingResponse() {
  return { error: true, content: AI_NO_KEY, message: AI_NO_KEY, reason: 'no_api_key' };
}

function dbOrNull(channel) {
  const db = getDb();
  if (!db && channel) {
    console.warn(`[ipc] ${channel}: database not available`);
  }
  return db;
}

function broadcastAiEvent(channel, payload) {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function clearFocusCoachTimer() {
  if (focusCoachTimer) {
    clearInterval(focusCoachTimer);
    focusCoachTimer = null;
  }
  focusCoachTickCount = 0;
}

function getFocusElapsedMinutes() {
  if (!focusState) return 0;
  const started = new Date(focusState.startedAt).getTime();
  const elapsedSec = Math.floor(
    (Date.now() - started - (focusState.accumulatedPause || 0)) / 1000
  );
  return Math.floor(elapsedSec / 60);
}

async function runFocusCoach() {
  if (!focusState || focusState.paused) return;
  if (!settingsService.isAiFeatureEnabled('focusCoach')) return;

  const sessionMinutes = getFocusElapsedMinutes();
  const db = dbOrNull('runFocusCoach');
  const started = focusState.startedAt;
  const ended = new Date().toISOString();

  let completedTasks = [];
  let blockedAttempts = 0;
  if (db) {
    try {
      completedTasks = db
        .prepare(
          `SELECT t.title FROM tasks t
           WHERE t.status = 'done' AND t.completed_at >= ? AND t.completed_at <= ?`
        )
        .all(started, ended);
      blockedAttempts =
        db
          .prepare(
            'SELECT distractions_blocked FROM focus_session_stats WHERE session_id = ?'
          )
          .get(focusState.sessionId)?.distractions_blocked || 0;
    } catch (err) {
      console.error('[ipc] runFocusCoach db:', err.message);
    }
  }

  if (!settingsService.hasAnthropicApiKey()) {
    return;
  }

  try {
    const result = await aiService.focusCoach(
      sessionMinutes,
      focusState.projectName,
      completedTasks,
      blockedAttempts
    );

    if (result.error) return;

    const payload = {
      message: result.message,
      suggestBreak: result.suggestBreak,
      sessionMinutes,
    };

    broadcastAiEvent('ai:focusCoach', payload);

    const notificationHub = require('./notificationHub');
    notificationHub.showWithNotifier(notifier, {
      soundKey: 'focusCoach',
      notifyKey: 'focusCoach',
      title: 'FocusFlow — Fokus maslahat',
      body: result.message,
    });
  } catch (err) {
    console.error('[ipc] focusCoach', err.message);
  }
}

function startFocusCoachTimer() {
  clearFocusCoachTimer();
  if (!settingsService.isAiFeatureEnabled('focusCoach')) return;
  const mins = settingsService.getFocusCoachIntervalMinutes();
  const COACH_MS = mins * 60 * 1000;
  focusCoachTimer = setInterval(() => {
    focusCoachTickCount += 1;
    runFocusCoach();
  }, COACH_MS);
}

function gatherPlanDayPayload() {
  const db = dbOrNull('gatherPlanDayPayload');
  if (!db) {
    return { projects: [], timeEntries: [], completedTasks: [] };
  }
  const today = new Date().toISOString().split('T')[0];

  const projects = db
    .prepare(
      `SELECT p.*, a.name as area_name FROM projects p
       JOIN areas a ON a.id = p.area_id ORDER BY p.id`
    )
    .all()
    .map((p) => ({
      ...p,
      block_list: JSON.parse(p.block_list || '[]'),
    }));

  const timeEntries = tracker.getTimeEntries(today);

  const completedTasks = db
    .prepare(
      `SELECT t.*, p.name as project_name FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.status = 'done' AND date(t.completed_at) = date('now', 'localtime')`
    )
    .all();

  return { projects, timeEntries, completedTasks };
}

function gatherSuggestTasksPayload(projectId) {
  const db = dbOrNull('gatherSuggestTasksPayload');
  if (!db) return null;
  const today = new Date().toISOString().split('T')[0];
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;

  const existingTasks = taskManager.getTasksByProject(projectId).filter(
    (t) => t.status !== 'done'
  );

  const timeTracked = db
    .prepare(
      `SELECT COALESCE(SUM(duration), 0) as s FROM time_entries
       WHERE project_id = ? AND date(started_at) = date('now', 'localtime')`
    )
    .get(projectId).s;

  return {
    projectName: project.name,
    existingTasks,
    timeTracked,
    projectId: project.id,
  };
}

function setFocusStateChangeCallback(cb) {
  onFocusStateChange = cb;
}

function broadcastFocusState() {
  try {
    require('./sedentaryMonitor').onFocusSessionChanged(focusState);
  } catch (err) {
    console.warn('[ipc] sedentary focus sync:', err.message);
  }
  if (onFocusStateChange) onFocusStateChange(focusState);
  try {
    const focusKiosk = require('./focusKiosk');
    focusKiosk.syncFocusKiosk(focusState);
  } catch (err) {
    console.warn('[ipc] focus kiosk sync:', err.message);
  }
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) {
      win.webContents.send('focus:state', focusState);
    }
  }
}

function getFocusState() {
  return focusState;
}

function requestFocusStop() {
  if (!focusState) return;
  try {
    if (require('./focusKiosk').shouldUseKiosk(focusState)) return;
  } catch {
    if (focusState.fullscreenLock && focusState.remainingSeconds > 0) return;
  }
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) {
      win.webContents.send('focus:request-stop');
    }
  }
}

async function endFocusSession() {
  if (!focusState || endingFocusSession) return null;
  endingFocusSession = true;

  const ended = {
    ...focusState,
    duration: Math.floor(
      (Date.now() - new Date(focusState.startedAt).getTime() - focusState.accumulatedPause) /
        1000
    ),
  };
  focusState = null;
  broadcastFocusState();

  try {
    try {
      require('./focusKiosk').deactivateMacLockSession();
    } catch (err) {
      console.warn('[ipc] focus kiosk deactivate:', err.message);
    }
    clearFocusCoachTimer();
    stopFocusBlocking();
    tracker.clearFocusProject();

    try {
      require('./relaunchService').onFocusSessionEnded();
    } catch (err) {
      console.warn('[ipc] relaunchService:', err.message);
    }

    const db = dbOrNull('endFocusSession');
    let tasksCompleted = 0;
    let distractions = 0;

    if (db) {
      try {
        focusPersistence.deactivateSession(
          ended.sessionId,
          new Date().toISOString(),
          ended.duration
        );
        db.prepare(
          `UPDATE focus_sessions SET ended_at = ?, duration = ? WHERE id = ?`
        ).run(new Date().toISOString(), ended.duration, ended.sessionId);

        const started = ended.startedAt;
        const endedAt = new Date().toISOString();
        tasksCompleted =
          db
            .prepare(
              `SELECT COUNT(*) as c FROM tasks
               WHERE status = 'done' AND completed_at >= ? AND completed_at <= ?`
            )
            .get(started, endedAt).c || 0;

        distractions =
          db
            .prepare(
              'SELECT distractions_blocked FROM focus_session_stats WHERE session_id = ?'
            )
            .get(ended.sessionId)?.distractions_blocked || 0;
      } catch (err) {
        console.error('[ipc] endFocusSession db:', err.message);
      }
    }

    const summary = showSessionSummary(ended);

    if (
      settingsService.hasAnthropicApiKey() &&
      settingsService.isAiFeatureEnabled('sessionAnalysis')
    ) {
      try {
        const weekly = isDatabaseReady()
          ? reportsService.getReportData('week')
          : {};
        const aiResult = await aiService.analyzeProductivity({
          ...weekly,
          sessionFocus: {
            projectName: ended.projectName,
            durationMinutes: Math.floor(ended.duration / 60),
            tasksCompleted,
            distractionsBlocked: distractions,
          },
        });
        if (aiResult && !aiResult.error) {
          summary.aiInsights = aiResult.insights;
        } else if (aiResult?.error) {
          summary.aiInsights = AI_ERROR;
        }
      } catch (err) {
        console.error('[ipc] endFocusSession ai:', err.message);
        summary.aiInsights = AI_ERROR;
      }
    }

    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send('focus:summary', summary);
      }
    }

    return { ...ended, summary };
  } catch (err) {
    console.error('[ipc] endFocusSession:', err.message);
    return null;
  } finally {
    endingFocusSession = false;
  }
}

function applyFocusScheduledTask() {
  if (!focusState?.projectId) return;

  const active = taskSchedule.pickActiveScheduledTask(focusState.projectId);
  if (active) {
    if (focusState.taskId !== active.id) {
      focusState.taskId = active.id;
      focusState.taskTitle = active.title;
    }
    focusState.scheduledNow = true;
    focusState.scheduleMeta = taskSchedule.buildFocusScheduleMeta(active);
  } else {
    focusState.scheduledNow = false;
    focusState.scheduleMeta = null;
  }
}

function applyPomodoroPhaseChange(result) {
  const pomodoroCycle = require('./pomodoroCycle');
  const focusKiosk = require('./focusKiosk');

  focusState.pomodoro = result.pomo;
  focusState.remainingSeconds = result.phaseRemaining;
  focusState.fullscreenLock = result.pomo.phase === 'break';
  focusState.taskLockMode = focusState.fullscreenLock ? 'fullscreen' : 'none';
  focusState.pomodoroLabel = pomodoroCycle.buildPhaseLabel(result.pomo);
  focusState.overallRemainingSeconds = result.overallLeft ?? null;

  const notificationHub = require('./notificationHub');

  if (result.newPhase === 'break') {
    focusKiosk.activateMacLockSession(focusState, { systemLock: true });
    notificationHub.show({
      soundKey: 'pomodoroBreak',
      notifyKey: 'sessionEnd',
      title: 'FocusFlow — Dam olish',
      body: `${result.pomo.breakMinutes} daqiqa dam oling. Mac qulflandi.`,
    });
  } else if (result.newPhase === 'work') {
    focusKiosk.deactivateMacLockSession();
    focusKiosk.resetSystemLockFlag();
    notificationHub.show({
      soundKey: 'pomodoroWork',
      notifyKey: 'sessionEnd',
      title: 'FocusFlow — Ishlash',
      body: `Tsikl ${result.pomo.cycle}. Yana ${result.pomo.workMinutes} daqiqa ish.`,
    });
  }
}

function tickFocusPomodoro() {
  const pomodoroCycle = require('./pomodoroCycle');
  const result = pomodoroCycle.tickPomodoro(focusState.pomodoro);

  if (result.ended) {
    void endFocusSession();
    return null;
  }

  if (result.phaseChanged) {
    applyPomodoroPhaseChange(result);
  } else {
    focusState.pomodoro = result.pomo;
    focusState.remainingSeconds = result.phaseRemaining;
    focusState.pomodoroLabel = pomodoroCycle.buildPhaseLabel(result.pomo);
    focusState.overallRemainingSeconds = result.overallLeft ?? null;
    focusState.fullscreenLock = result.pomo.phase === 'break';
  }

  applyFocusScheduledTask();
  focusPersistence.syncSession(focusState, getStatus().domains);
  broadcastFocusState();
  return focusState;
}

function tickFocus() {
  if (!focusState || focusState.paused) return focusState;

  if (focusState.pomodoro?.enabled) {
    return tickFocusPomodoro();
  }

  const started = new Date(focusState.startedAt).getTime();
  const elapsed = Math.floor(
    (Date.now() - started - focusState.accumulatedPause) / 1000
  );
  focusState.remainingSeconds = Math.max(0, focusState.totalSeconds - elapsed);

  if (focusState.remainingSeconds <= 0) {
    void endFocusSession();
    return null;
  }

  applyFocusScheduledTask();
  focusPersistence.syncSession(focusState, getStatus().domains);
  broadcastFocusState();
  return focusState;
}

async function restorePersistedFocusIfNeeded() {
  const { focusState: restored, blockedSites, notify, expired } =
    focusPersistence.loadActivePersistedSession();

  if (!restored) {
    if (expired) {
      try {
        const hostsManager = require('./hostsManager');
        hostsManager.deactivateHostsLock();
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  const hostsResult = await restorePersistedBlocking(
    restored.projectId,
    blockedSites,
    restored.sessionId,
    restored.taskId
  );
  restored.hostsAuthOk = hostsResult.hostsAuthOk;
  restored.hostsActive = hostsResult.hostsActive;
  restored.hostsDomainCount = hostsResult.hostsDomainCount;

  focusState = restored;
  applyFocusScheduledTask();
  tracker.setFocusProject(restored.projectId);
  focusPersistence.syncSession(focusState, blockedSites || getStatus().domains);

  try {
    require('./relaunchService').onFocusSessionStarted();
  } catch (err) {
    console.warn('[ipc] relaunchService:', err.message);
  }

  broadcastFocusState();

  if (notify) {
    const notificationHub = require('./notificationHub');
    notificationHub.show({
      soundKey: 'sessionEnd',
      notifyKey: null,
      title: 'FocusFlow',
      body: 'Fokus davom etyapti',
    });
  }

  if (!restored.paused) {
    startFocusCoachTimer();
  }

  if (restored.fullscreenLock) {
    try {
      require('./focusKiosk').activateMacLockSession(restored, {
        systemLock: false,
      });
    } catch (err) {
      console.warn('[ipc] focus kiosk restore:', err.message);
    }
  }

  return focusState;
}

function persistFocusStateBeforeQuit() {
  if (!focusState?.sessionId) return;
  const domains = getStatus().domains;
  focusPersistence.syncSession(focusState, domains);
  focusPersistence.activateSession(focusState.sessionId, focusState, domains);
}

async function startFocusSession({ projectId, taskId, durationMinutes } = {}) {
  const db = dbOrNull('focus:start');
  if (!db) return { error: true, message: 'Database not available' };
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('Project not found');

  const {
    enrichTaskRow,
    shouldMacLock,
    durationSecondsFromTaskTimes,
    CATEGORY_LABELS,
  } = require('./taskMeta');

  let task = null;
  if (taskId) {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    task = enrichTaskRow(row, project);
  } else {
    const scheduled = taskSchedule.pickActiveScheduledTask(projectId);
    if (scheduled) task = enrichTaskRow(scheduled, project);
  }

  const pomodoroCycle = require('./pomodoroCycle');
  const pomodoroEnabled = task && pomodoroCycle.isPomodoroTask(task);
  const pomodoro = pomodoroEnabled ? pomodoroCycle.createPomodoroState(task) : null;
  const fullscreenLock = pomodoroEnabled ? false : shouldMacLock(task, project);

  const hostsBlock = await startFocusBlocking(projectId, task?.id || null);
  tracker.setFocusProject(projectId);

  const startedAt = new Date().toISOString();
  const sessionResult = db
    .prepare('INSERT INTO focus_sessions (project_id, started_at) VALUES (?, ?)')
    .run(projectId, startedAt);

  setActiveSessionId(sessionResult.lastInsertRowid);
  db.prepare(
    'INSERT OR IGNORE INTO focus_session_stats (session_id, distractions_blocked) VALUES (?, 0)'
  ).run(sessionResult.lastInsertRowid);

  const settings = settingsService.getSettings();
  const fromSchedule = task
    ? durationSecondsFromTaskTimes(task.start_time, task.end_time)
    : null;
  let defaultMins =
    durationMinutes || settings.focusDuration || 25;
  if (project.use_focus_duration) {
    defaultMins =
      durationMinutes ||
      project.focus_duration ||
      settings.focusDuration ||
      25;
  }
  const totalSeconds = fromSchedule || defaultMins * 60;
  const phaseRemaining = pomodoro
    ? pomodoro.phaseDurationSeconds
    : totalSeconds;

  focusState = {
    sessionId: sessionResult.lastInsertRowid,
    projectId: project.id,
    projectName: project.name,
    taskId: task?.id || null,
    taskTitle: task?.title || null,
    taskIcon: task?.icon || null,
    taskCategory: task?.category || null,
    categoryLabel: task ? CATEGORY_LABELS[task.category] || task.category : null,
    pomodoro,
    pomodoroLabel: pomodoro ? pomodoroCycle.buildPhaseLabel(pomodoro) : null,
    overallRemainingSeconds: pomodoro
      ? pomodoroCycle.getOverallRemainingSeconds(pomodoro)
      : null,
    fullscreenLock,
    taskLockMode: fullscreenLock ? 'fullscreen' : 'none',
    startedAt,
    totalSeconds,
    remainingSeconds: phaseRemaining,
    paused: false,
    pausedAt: null,
    accumulatedPause: 0,
    hostsAuthOk: hostsBlock?.hostsAuthOk ?? false,
    hostsActive: hostsBlock?.hostsActive ?? false,
    hostsDomainCount: hostsBlock?.hostsDomainCount ?? 0,
    stopLock: {
      type: project.stop_lock_type || 'timer',
      timerMinutes: project.stop_lock_timer_minutes ?? 5,
      password: project.stop_lock_password || 'TOXTAMAN',
    },
  };

  applyFocusScheduledTask();
  focusPersistence.activateSession(
    sessionResult.lastInsertRowid,
    focusState,
    getStatus().domains
  );

  try {
    require('./relaunchService').onFocusSessionStarted();
  } catch (err) {
    console.warn('[ipc] relaunchService:', err.message);
  }

  broadcastFocusState();
  startFocusCoachTimer();

  const notificationHub = require('./notificationHub');
  const {
    isUyIshlariCategory,
    isSportCategory,
  } = require('../shared/notificationSoundCatalog.cjs');
  const { isLongBreakSlot } = require('./taskScheduleSounds');

  if (fullscreenLock) {
    try {
      require('./focusKiosk').activateMacLockSession(focusState, {
        systemLock: true,
      });
    } catch (err) {
      console.warn('[ipc] mac lock activate:', err.message);
    }
  }

  let startSoundKey = 'focusStarted';
  let startTitle = 'Fokus boshlandi';
  let startBody = task
    ? `${task.title} — fokus rejimi yoqildi.`
    : `${project.name} loyihasida fokus boshlandi.`;

  if (pomodoro) {
    startSoundKey = 'pomodoroWork';
    startTitle = 'Pomodoro — ishlash';
    startBody = `${task.title}: ${pomodoro.workMinutes} daqiqa ish bosqichi.`;
  } else if (fullscreenLock && task && isUyIshlariCategory(task.category)) {
    startSoundKey = 'macLockUyIshlari';
    startTitle = 'Uy ishlari — fokus';
    startBody = 'Kompiyuter qulflandi. Vazifaga fokus qiling.';
  } else if (fullscreenLock && task && isSportCategory(task.category)) {
    startSoundKey = 'macLockSport';
    startTitle = 'Sport — fokus';
    startBody = 'Kompiyuter qulflandi. Mashq vaqtiga eʼtibor bering.';
  } else if (fullscreenLock && task && isLongBreakSlot(task)) {
    startSoundKey = 'longBreakStarted';
    startTitle = 'Uzoq dam olish boshlandi';
    startBody = `${task.title}: dam olish rejimi.`;
  }

  notificationHub.show({
    soundKey: startSoundKey,
    notifyKey: 'sessionEnd',
    title: `FocusFlow — ${startTitle}`,
    body: startBody,
  });

  return focusState;
}

function registerIpc() {
  safeHandle(
    'areas:getAll',
    () => {
      const db = dbOrNull('areas:getAll');
      if (!db) return [];
      return db.prepare('SELECT * FROM areas ORDER BY id').all();
    },
    []
  );

  safeHandle('areas:create', (_, data) => {
    const result = projectService.saveArea(data);
    if (result?.error) return null;
    return result.area;
  });

  safeHandle('areas:update', (_, data) => projectService.saveArea(data));

  safeHandle('areas:delete', (_, id) => projectService.deleteArea(id));

  safeHandle(
    'projects:getAll',
    () => {
      const db = dbOrNull('projects:getAll');
      if (!db) return [];
      return db
        .prepare(
          `SELECT p.*, a.name as area_name
           FROM projects p
           JOIN areas a ON a.id = p.area_id
           ORDER BY p.id`
        )
        .all()
        .map((p) => ({
          ...p,
          block_list: JSON.parse(p.block_list || '[]'),
        }));
    },
    []
  );

  safeHandle('projects:create', (_, data) => {
    const db = dbOrNull('projects:create');
    if (!db) return null;
    const r = db
      .prepare(
        `INSERT INTO projects (
          area_id, name, color, block_list, focus_duration,
          stop_lock_type, stop_lock_timer_minutes, stop_lock_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.area_id,
        data.name,
        data.color || '#007AFF',
        JSON.stringify(data.block_list || []),
        data.focus_duration || 60,
        data.stop_lock_type || 'timer',
        data.stop_lock_timer_minutes ?? 5,
        data.stop_lock_password || 'TOXTAMAN'
      );
    return { id: r.lastInsertRowid, ...data };
  });

  safeHandle('projects:update', (_, data) => {
    const result = projectService.saveProject(data);
    if (result?.error) return data;
    return result.project || data;
  });

  safeHandle('projects:getOne', (_, id) => projectService.getProjectDetail(id));

  safeHandle('projects:save', (_, data) => projectService.saveProject(data));

  safeHandle('projects:delete', (_, id) => projectService.deleteProject(id));

  safeHandle('tasks:getAll', () => taskManager.getAllTasks());

  safeHandle('focus:start', async (_, payload) => startFocusSession(payload));

  safeHandle('focus:pause', () => {
    if (!focusState || focusState.paused) return focusState;
    try {
      if (require('./focusKiosk').shouldUseKiosk(focusState)) return focusState;
    } catch {
      if (focusState.fullscreenLock) return focusState;
    }
    focusState.paused = true;
    focusState.pausedAt = Date.now();
    focusPersistence.syncSession(focusState, getStatus().domains);
    broadcastFocusState();
    return focusState;
  });

  safeHandle('focus:resume', () => {
    if (!focusState || !focusState.paused) return focusState;
    focusState.accumulatedPause += Date.now() - focusState.pausedAt;
    focusState.paused = false;
    focusState.pausedAt = null;
    focusPersistence.syncSession(focusState, getStatus().domains);
    broadcastFocusState();
    return focusState;
  });

  safeHandle('focus:stop', () => {
    try {
      if (require('./focusKiosk').shouldUseKiosk(focusState)) return focusState;
    } catch {
      if (focusState?.fullscreenLock && focusState.remainingSeconds > 0) {
        return focusState;
      }
    }
    return endFocusSession();
  });

  safeHandle('focus:request-stop', () => {
    requestFocusStop();
    return { ok: true };
  });

  safeHandle('focus:getState', () => focusState);

  safeHandle('focus:tick', () => tickFocus());

  safeHandle('tracker:start', (_, projectId) => {
    tracker.startTracking(projectId || null);
    return { ok: true };
  });

  safeHandle('tracker:stop', () => {
    tracker.stopTracking();
    return { ok: true };
  });

  safeHandle('tracker:getEntries', (_, date) => tracker.getTimeEntries(date));

  safeHandle('tracker:getTodayStats', (_, date) => tracker.getTodayStats(date));

  safeHandle('tracker:getVaqtStats', (_, { preset, date, projectId } = {}) => {
    const vaqtStats = require('./vaqtStats');
    const todayStats = tracker.getTodayStats(date);
    return vaqtStats.getVaqtStats(
      preset || 'day',
      date,
      todayStats?.pausedReason ?? null,
      projectId ?? null
    );
  });

  safeHandle('time:getToday', (_, date) => tracker.getTimeEntries(date));

  safeHandle('time:assignProject', (_, { entryId, projectId }) => {
    tracker.assignEntryProject(entryId, projectId);
    return { entryId, projectId };
  });

  safeHandle('time:createManual', (_, data) => tracker.createManualEntry(data));

  safeHandle('time:getUnassigned', (_, date) => {
    const d = date || new Date().toISOString().split('T')[0];
    return tracker
      .getTimeEntries(d)
      .filter((e) => !e.project_id);
  });

  safeHandle('tasks:morningSummary', () => taskManager.getMorningSummary());

  safeHandle('tasks:getToday', () => taskManager.getTodayTasks());

  safeHandle('tasks:getUpcoming', () => taskManager.getUpcoming());

  safeHandle('tasks:getByStatus', (_, status) =>
    taskManager.getTasksByStatus(status)
  );

  safeHandle('tasks:getByProject', (_, projectId) =>
    taskManager.getTasksByProject(projectId)
  );

  safeHandle('tasks:getOne', (_, id) => taskManager.getTask(id));

  safeHandle('tasks:create', (_, data) => taskManager.createTask(data));

  safeHandle('tasks:update', (_, data) => taskManager.updateTask(data));

  safeHandle('tasks:delete', (_, id) => {
    taskManager.deleteTask(id);
    return { ok: true };
  });

  safeHandle('tasks:complete', (_, id) => taskManager.completeTask(id));

  safeHandle('tasks:reorder', (_, orderedIds) => {
    taskManager.reorderTasks(orderedIds);
    return { ok: true };
  });

  safeHandle('tasks:toggle', (_, id) => {
    const task = taskManager.getTask(id);
    if (!task) return null;
    if (task.status === 'done') {
      return taskManager.updateTask({ ...task, status: 'today' });
    }
    return taskManager.completeTask(id);
  });

  safeHandle('checklist:get', (_, taskId) => taskManager.getChecklist(taskId));

  safeHandle('checklist:add', (_, { taskId, title }) =>
    taskManager.addChecklistItem(taskId, title)
  );

  safeHandle('checklist:toggle', (_, id) => taskManager.toggleChecklistItem(id));

  safeHandle('checklist:delete', (_, id) => {
    taskManager.deleteChecklistItem(id);
    return { ok: true };
  });

  safeHandle('reports:get', (_, { preset, start, end }) =>
    reportsService.getReportData(preset, start, end)
  );

  safeHandle('reports:exportCsv', (_, { preset, start, end }) =>
    reportsService.exportCsv(preset, start, end)
  );

  safeHandle(
    'blocked:getAll',
    () => {
      const db = dbOrNull('blocked:getAll');
      if (!db) return [];
      return db.prepare('SELECT * FROM blocked_sites ORDER BY url').all();
    },
    []
  );

  const store = require('./blockerStore');
  const blocker = require('./blocker');
  const { listInstalledApps } = require('./appBlocker');

  safeHandle('blocker:requestAdmin', async () => {
    console.log('[ipc] blocker:requestAdmin: invoked');
    try {
      const hostsManager = require('./hostsManager');
      console.log('[ipc] blocker:requestAdmin: calling setupSudoers()');
      const result = hostsManager.setupSudoers();
      console.log('[ipc] blocker:requestAdmin: setupSudoers result:', result);
      if (result.ok) {
        console.log('[ipc] blocker:requestAdmin: applying hosts block for session');
        blocker.applyHostsBlockForSession();
      }
      const status = blocker.getStatus();
      console.log('[ipc] blocker:requestAdmin: status after setup:', status);
      return { ...result, adminOk: status.adminOk };
    } catch (err) {
      console.error('[ipc] blocker:requestAdmin: error:', err);
      return { ok: false, error: err.message };
    }
  });

  safeHandle('blocker:getStatus', () => blocker.getStatus());

  safeHandle('blocker:getConfig', (_, projectId) => {
    const pid =
      projectId != null && projectId !== ''
        ? Number(projectId)
        : null;
    const scopedPid = pid != null && Number.isFinite(pid) ? pid : null;

    const domains = scopedPid
      ? store.getProjectDomainsOnly(scopedPid)
      : store.getDomains(null);
    const schedules = store.getSchedules();

    console.log('[ipc] blocker:getConfig project:', scopedPid, 'domains:', domains.length, 'schedules:', schedules.length);

    return {
      domains,
      exceptions: store.getExceptions(scopedPid),
      apps: store.getApps(scopedPid),
      schedules,
    };
  });

  safeHandle('blocker:addDomain', (_, { domain, projectId }) => {
    const pid =
      projectId != null && projectId !== ''
        ? Number(projectId)
        : null;
    const scopedPid = pid != null && Number.isFinite(pid) ? pid : null;

    console.log('[ipc] blocker:addDomain', domain, 'project:', scopedPid);
    const row = store.addDomain(domain, scopedPid);
    console.log('[ipc] blocker:addDomain saved:', row);

    const status = getStatus();
    if (status.sessionLock) {
      applyHostsBlockForSession();
    } else {
      refreshScheduleBlocks();
    }
    return row;
  });

  safeHandle('blocker:removeDomain', (_, id) => {
    store.removeDomain(id);
    const status = getStatus();
    if (status.sessionLock) {
      applyHostsBlockForSession();
    } else {
      refreshScheduleBlocks();
    }
    return { ok: true };
  });

  safeHandle('blocker:addException', (_, { pattern, projectId }) =>
    store.addException(pattern, projectId || null)
  );

  safeHandle('blocker:removeException', (_, id) => store.removeException(id));

  safeHandle('blocker:listApps', () => {
    try {
      return listInstalledApps();
    } catch (err) {
      console.warn('[ipc] blocker:listApps:', err.message);
      return [];
    }
  });

  const appsCatalog = require('./appsCatalog');
  safeHandle('apps:list', () => {
    try {
      return appsCatalog.listInstalledApps();
    } catch (err) {
      console.warn('[ipc] apps:list:', err.message);
      return [];
    }
  });
  safeHandle('apps:resolveBundlePath', (_, appName) => {
    try {
      const row = appsCatalog.findAppRow(appName);
      return row?.bundlePath || null;
    } catch (err) {
      console.warn('[ipc] apps:resolveBundlePath:', err.message);
      return null;
    }
  });

  safeHandle('apps:getIcon', async (_, appName) => {
    try {
      const row = appsCatalog.findAppRow(appName);
      if (!row?.bundlePath) return null;
      const { iconUrlForBundle } = require('./iconProtocol');
      return iconUrlForBundle(row.bundlePath);
    } catch (err) {
      console.warn('[ipc] apps:getIcon:', err.message);
      return null;
    }
  });

  safeHandle('blocker:setAppBlocked', (_, data) =>
    store.setAppBlocked(
      data.app_name,
      data.process_name,
      data.blocked,
      data.projectId ?? null
    )
  );

  safeHandle('blocker:getSchedules', (_, filterType) => store.getSchedules(filterType || null), []);

  safeHandle('blocker:addSchedule', (_, data) => {
    console.log(
      '[ipc] blocker:addSchedule',
      data?.type,
      data?.domain || data?.process_name,
      data?.start_time,
      data?.end_time
    );
    const row = store.addSchedule(data);
    console.log('[ipc] blocker:addSchedule saved:', row);
    refreshScheduleBlocks();
    return row;
  }, null);

  safeHandle('blocker:removeSchedule', (_, id) => {
    store.removeSchedule(id);
    refreshScheduleBlocks();
    return { ok: true };
  });

  safeHandle('blocker:syncProjectDomains', (_, projectId) => {
    const domains = store.getProjectDomainsOnly(projectId);
    const db = dbOrNull('blocker:syncProjectDomains');
    if (db) {
      db.prepare('UPDATE projects SET block_list = ? WHERE id = ?')
        .run(JSON.stringify(domains.map((d) => d.domain)), projectId);
    }
    return domains;
  });

  safeHandle('ai:suggestTasks', async (_, { projectId }) => {
    if (!settingsService.hasAnthropicApiKey()) {
      return { error: true, tasks: [], message: AI_NO_KEY };
    }
    if (!settingsService.isAiFeatureEnabled('taskSuggestions')) {
      return { error: true, tasks: [], message: 'disabled', disabled: true };
    }
    try {
      const payload = gatherSuggestTasksPayload(projectId);
      if (!payload) return { error: true, tasks: [], message: AI_ERROR };
      const result = await aiService.suggestTasks(
        payload.projectName,
        payload.existingTasks,
        payload.timeTracked
      );
      if (result === null) {
        return { error: true, tasks: [], message: AI_NO_KEY };
      }
      return { ...result, projectId: payload.projectId };
    } catch {
      return { error: true, tasks: [], message: AI_ERROR };
    }
  });

  safeHandle('ai:planDay', async () => {
    if (!settingsService.hasAnthropicApiKey()) {
      return { error: true, plan: AI_NO_KEY, message: AI_NO_KEY };
    }
    if (!settingsService.isAiFeatureEnabled('dayPlan')) {
      return { error: true, plan: '', message: 'disabled', disabled: true };
    }
    try {
      const data = gatherPlanDayPayload();
      const result = await aiService.planDay(
        data.projects,
        data.timeEntries,
        data.completedTasks
      );
      if (result === null) {
        return { error: true, plan: AI_NO_KEY, message: AI_NO_KEY };
      }
      return result;
    } catch {
      return { error: true, plan: AI_ERROR, message: AI_ERROR };
    }
  });

  safeHandle('ai:analyzeVaqt', async (_, { stats, period } = {}) => {
    if (!settingsService.hasAnthropicApiKey()) {
      return { error: true, message: AI_NO_KEY, analysis: null };
    }
    if (!settingsService.isAiFeatureEnabled('sessionAnalysis')) {
      return { error: true, message: 'disabled', disabled: true, analysis: null };
    }
    try {
      const result = await aiService.analyzeVaqt(stats, period || 'bugun');
      if (result === null) {
        return { error: true, message: AI_NO_KEY, analysis: null };
      }
      return result;
    } catch {
      return { error: true, message: AI_ERROR, analysis: null };
    }
  });

  safeHandle('ai:analyzeProductivity', async (_, weeklyStats) => {
    if (!settingsService.hasAnthropicApiKey()) {
      return { error: true, insights: AI_NO_KEY, message: AI_NO_KEY };
    }
    if (!settingsService.isAiFeatureEnabled('sessionAnalysis')) {
      return { error: true, insights: '', message: 'disabled', disabled: true };
    }
    try {
      const result = await aiService.analyzeProductivity(
        weeklyStats || reportsService.getReportData('week')
      );
      if (result === null) {
        return { error: true, insights: AI_NO_KEY, message: AI_NO_KEY };
      }
      return result;
    } catch {
      return { error: true, insights: AI_ERROR, message: AI_ERROR };
    }
  });

  safeHandle('ai:focusCoach', async (_, data) => {
    if (!settingsService.hasAnthropicApiKey()) {
      return { error: true, message: AI_NO_KEY, suggestBreak: false };
    }
    if (!settingsService.isAiFeatureEnabled('focusCoach')) {
      return { error: true, message: 'disabled', suggestBreak: false, disabled: true };
    }
    try {
      const result = await aiService.focusCoach(
        data?.sessionMinutes ?? 0,
        data?.project ?? '',
        data?.completedTasks ?? [],
        data?.blockedAttempts ?? 0
      );
      if (result === null) {
        return { error: true, message: AI_NO_KEY, suggestBreak: false };
      }
      return result;
    } catch {
      return { error: true, message: AI_ERROR, suggestBreak: false };
    }
  });

  safeHandle('ai:chat', async (event, { messages, context, stream }) => {
    if (!settingsService.hasAnthropicApiKey()) {
      if (stream && !event.sender.isDestroyed()) {
        event.sender.send('ai:chat-chunk', { type: 'error', text: AI_NO_KEY });
      }
      return aiKeyMissingResponse();
    }

    const ctx = {
      ...aiService.gatherTodayContext(),
      activeProjectId: focusState?.projectId || context?.activeProjectId,
      ...context,
    };

    if (stream) {
      try {
        let full = '';
        const streamResult = await aiService.chatStream(messages, ctx, (chunk) => {
          if (chunk.type === 'delta') full += chunk.text;
          if (!event.sender.isDestroyed()) {
            event.sender.send('ai:chat-chunk', chunk);
          }
        });
        if (streamResult === null) return aiKeyMissingResponse();
        if (streamResult?.error) {
          return { error: true, content: streamResult.content || AI_ERROR };
        }
        return { error: false, content: full || streamResult.content };
      } catch {
        return { error: true, content: AI_ERROR };
      }
    }

    try {
      const result = await aiService.chat(messages, ctx);
      if (result === null) return aiKeyMissingResponse();
      return result;
    } catch {
      return { error: true, content: AI_ERROR };
    }
  });

  safeHandle('ai:morningGreeting', async () => {
    if (!settingsService.hasAnthropicApiKey()) {
      return { error: true, content: null };
    }
    try {
      return await ai.getMorningGreeting();
    } catch {
      return { error: true, content: null };
    }
  });

  safeHandle('ai:eveningSummary', async () => {
    if (!settingsService.hasAnthropicApiKey()) {
      return { error: true, content: null };
    }
    try {
      return await ai.getEveningSummary();
    } catch {
      return { error: true, content: null };
    }
  });

  safeHandle('ai:getDailyGreeting', async () => {
    if (!settingsService.hasAnthropicApiKey()) {
      return { show: false };
    }
    if (settingsService.wasDailyGreetingShownToday()) {
      return { show: false };
    }

    const hour = new Date().getHours();
    const type = hour < 18 ? 'morning' : 'evening';

    if (type === 'morning' && !settingsService.isAiFeatureEnabled('morningGreeting')) {
      return { show: false };
    }
    if (type === 'evening' && !settingsService.isAiFeatureEnabled('eveningSummary')) {
      return { show: false };
    }

    try {
      const result =
        type === 'morning'
          ? await ai.getMorningGreeting()
          : await ai.getEveningSummary();

      if (!result || result.error || !result.content?.trim()) {
        return { show: false, error: true };
      }

      settingsService.markDailyGreetingShownToday();
      return {
        show: true,
        type,
        content: result.content.trim(),
      };
    } catch (err) {
      console.error('[ipc] ai:getDailyGreeting:', err.message);
      return { show: false, error: true };
    }
  });

  safeHandle('app:getTheme', () => {
    const { nativeTheme } = require('electron');
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  safeHandle('settings:get', () =>
    settingsService.maskForRenderer(settingsService.getSettings())
  );

  safeHandle('settings:getRaw', () => settingsService.getSettings());

  safeHandle('settings:set', (_, { key, value }) => {
    if (key === 'anthropicApiKey' || key === 'openaiApiKey') {
      if (value === '••••••••' || value === undefined) {
        return settingsService.getSettings();
      }
    }
    const updated = settingsService.set(key, value);
    if (key === 'blocker.strength') {
      settingsService.applyBlockerStrength(value);
    }
    if (key.startsWith('blocker')) {
      appBlocker.refreshFromSettings();
    }
    return settingsService.maskForRenderer(updated);
  });

  safeHandle('settings:setAll', (_, partial) => {
    const clean = { ...partial };
    if (clean.anthropicApiKey === '••••••••') delete clean.anthropicApiKey;
    if (clean.openaiApiKey === '••••••••') delete clean.openaiApiKey;
    const updated = settingsService.setAll(clean);
    appBlocker.refreshFromSettings();
    return settingsService.maskForRenderer(updated);
  });

  safeHandle('settings:testApiKey', async (_, { type, key }) => {
    try {
      let testKey = (key || '').trim();
      if (!testKey || testKey === '••••••••') {
        const s = settingsService.getSettings();
        testKey =
          type === 'anthropic'
            ? (s.anthropicApiKey || '').trim()
            : (s.openaiApiKey || '').trim();
      }
      return await settingsService.testApiKey(type, testKey);
    } catch (err) {
      return { ok: false, error: err.message || 'Test failed' };
    }
  });

  safeHandle('app:getVersion', () => {
    const pkg = require('../../package.json');
    return { version: pkg.version, name: pkg.name };
  });

  safeHandle('app:checkForUpdates', async () => {
    try {
      return await require('./updateService').checkForUpdates({ manual: true });
    } catch (err) {
      return { ok: false, message: err.message || 'Xato' };
    }
  });

  const notificationHub = require('./notificationHub');

  safeHandle('notifications:pickSound', async (_, soundKey) =>
    notificationHub.pickSoundFile(soundKey)
  );

  safeHandle('notifications:clearSound', (_, soundKey) =>
    notificationHub.clearSound(soundKey)
  );

  safeHandle('notifications:testSound', (_, soundKey) =>
    notificationHub.testSound(soundKey)
  );

  const sedentaryMonitor = require('./sedentaryMonitor');

  safeHandle('sedentary:getStatus', () => sedentaryMonitor.getStatus());

  safeHandle('sedentary:start', () => sedentaryMonitor.start());

  safeHandle('sedentary:stop', () => sedentaryMonitor.stop());

  safeHandle('sedentary:test', () => sedentaryMonitor.runTest());
}

module.exports = {
  registerIpc,
  setFocusStateChangeCallback,
  getFocusState,
  startFocusSession,
  endFocusSession,
  requestFocusStop,
  tickFocus,
  broadcastFocusState,
  restorePersistedFocusIfNeeded,
  persistFocusStateBeforeQuit,
};
