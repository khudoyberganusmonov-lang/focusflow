const { normalizeTime24h } = require('./timeFormat');
const { parseTimeToMinutes } = require('./taskSchedule');

function getWindowEndMs(task, refDate = new Date()) {
  const end = normalizeTime24h(task?.end_time);
  const start = normalizeTime24h(task?.start_time);
  if (!end) return null;
  const endMin = parseTimeToMinutes(end);
  if (endMin == null) return null;
  const d = new Date(refDate);
  d.setSeconds(0, 0);
  d.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
  const startMin = start ? parseTimeToMinutes(start) : null;
  if (startMin != null && endMin <= startMin) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

function isPomodoroTask(task) {
  return Boolean(
    task?.pomodoro_enabled &&
      normalizeTime24h(task?.start_time) &&
      normalizeTime24h(task?.end_time)
  );
}

function createPomodoroState(task) {
  const workMinutes = Math.max(1, Math.min(180, Number(task.pomodoro_work_minutes) || 25));
  const breakMinutes = Math.max(1, Math.min(60, Number(task.pomodoro_break_minutes) || 5));
  const now = Date.now();
  return {
    enabled: true,
    workMinutes,
    breakMinutes,
    phase: 'work',
    phaseStartedAt: now,
    phaseDurationSeconds: workMinutes * 60,
    cycle: 1,
    windowEndMs: getWindowEndMs(task),
  };
}

function getPhaseRemainingSeconds(pomo, now = Date.now()) {
  if (!pomo?.enabled) return 0;
  const elapsed = Math.floor((now - pomo.phaseStartedAt) / 1000);
  return Math.max(0, pomo.phaseDurationSeconds - elapsed);
}

function getOverallRemainingSeconds(pomo, now = Date.now()) {
  if (!pomo?.windowEndMs) return null;
  return Math.max(0, Math.floor((pomo.windowEndMs - now) / 1000));
}

function buildPhaseLabel(pomo) {
  if (!pomo?.enabled) return null;
  if (pomo.phase === 'break') {
    return `Dam olish (${pomo.breakMinutes} daq)`;
  }
  return `Ishlash · tsikl ${pomo.cycle || 1}`;
}

function tickPomodoro(pomo, now = Date.now()) {
  if (!pomo?.enabled) {
    return { pomo, phaseRemaining: 0, phaseChanged: false, ended: false };
  }

  const overallLeft = getOverallRemainingSeconds(pomo, now);
  if (overallLeft != null && overallLeft <= 0) {
    return { pomo, phaseRemaining: 0, phaseChanged: false, ended: true, overallLeft: 0 };
  }

  const phaseRemaining = getPhaseRemainingSeconds(pomo, now);
  if (phaseRemaining > 0) {
    return { pomo, phaseRemaining, phaseChanged: false, ended: false, overallLeft };
  }

  if (pomo.phase === 'work') {
    const next = {
      ...pomo,
      phase: 'break',
      phaseStartedAt: now,
      phaseDurationSeconds: pomo.breakMinutes * 60,
    };
    return {
      pomo: next,
      phaseRemaining: next.phaseDurationSeconds,
      phaseChanged: true,
      ended: false,
      overallLeft,
      newPhase: 'break',
    };
  }

  const next = {
    ...pomo,
    phase: 'work',
    phaseStartedAt: now,
    phaseDurationSeconds: pomo.workMinutes * 60,
    cycle: (pomo.cycle || 1) + 1,
  };
  return {
    pomo: next,
    phaseRemaining: next.phaseDurationSeconds,
    phaseChanged: true,
    ended: false,
    overallLeft,
    newPhase: 'work',
  };
}

module.exports = {
  isPomodoroTask,
  createPomodoroState,
  getPhaseRemainingSeconds,
  getOverallRemainingSeconds,
  buildPhaseLabel,
  tickPomodoro,
};
