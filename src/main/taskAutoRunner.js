const taskManager = require('./taskManager');
const settingsService = require('./settingsService');
const { isTaskActiveAt } = require('./taskSchedule');

let lastHandledTaskId = null;
let switching = false;

function pickActiveTaskNow(date = new Date()) {
  const tasks = taskManager.getTodayTasks();
  const active = tasks.filter(
    (t) =>
      t.start_time &&
      t.end_time &&
      isTaskActiveAt(
        {
          start_time: t.start_time,
          end_time: t.end_time,
        },
        date
      )
  );
  if (!active.length) return null;
  active.sort((a, b) => {
    const pa = a.priority ?? 2;
    const pb = b.priority ?? 2;
    if (pa !== pb) return pa - pb;
    return String(a.start_time).localeCompare(String(b.start_time));
  });
  return active[0];
}

async function runTodayAutoSchedule(ipcApi) {
  if (!settingsService.getSettings().todayAutoSchedule) return;
  if (switching) return;

  const active = pickActiveTaskNow();
  if (!active) {
    lastHandledTaskId = null;
    return;
  }

  const focus = ipcApi.getFocusState?.();
  if (focus?.taskId === active.id) {
    lastHandledTaskId = active.id;
    return;
  }

  if (focus && focus.taskId !== active.id) {
    switching = true;
    try {
      await ipcApi.endFocusSession?.();
    } finally {
      switching = false;
    }
  }

  if (ipcApi.getFocusState?.()) return;

  if (lastHandledTaskId === active.id) return;

  switching = true;
  try {
    await ipcApi.startFocusSession?.({
      projectId: active.project_id,
      taskId: active.id,
    });
    lastHandledTaskId = active.id;
  } catch (err) {
    console.warn('[taskAutoRunner]', err.message);
  } finally {
    switching = false;
  }
}

module.exports = {
  pickActiveTaskNow,
  runTodayAutoSchedule,
};
