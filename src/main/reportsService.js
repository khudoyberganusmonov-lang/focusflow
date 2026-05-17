const { getDb } = require('./database');

function dateRange(preset, customStart, customEnd) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (preset === 'today') {
    return { start: today, end: today };
  }
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { start: d.toISOString().split('T')[0], end: today };
  }
  if (preset === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: d.toISOString().split('T')[0], end: today };
  }
  return { start: customStart || today, end: customEnd || today };
}

const EMPTY_REPORT = {
  focusSessions: [],
  totalFocusSeconds: 0,
  totalFocusMinutes: 0,
  tasksCompleted: 0,
  timeByProject: [],
  timeByApp: [],
  productivityScore: null,
  distractionsBlocked: 0,
};

function getReportData(preset = 'week', customStart, customEnd) {
  const db = getDb();
  if (!db) return { ...EMPTY_REPORT };

  const { start, end } = dateRange(preset, customStart, customEnd);

  const focusSessions = db
    .prepare(
      `SELECT fs.*, p.name as project_name, p.color as project_color
       FROM focus_sessions fs
       JOIN projects p ON p.id = fs.project_id
       WHERE date(fs.started_at) BETWEEN ? AND ?
       ORDER BY fs.started_at`
    )
    .all(start, end);

  const totalFocusSeconds = focusSessions.reduce(
    (s, f) => s + (f.duration || 0),
    0
  );

  const tasksDone = db
    .prepare(
      `SELECT COUNT(*) as c FROM tasks
       WHERE status = 'done' AND date(completed_at) BETWEEN ? AND ?`
    )
    .get(start, end).c;

  const timeEntries = db
    .prepare(
      `SELECT te.*, p.name as project_name
       FROM time_entries te
       LEFT JOIN projects p ON p.id = te.project_id
       WHERE date(te.started_at) BETWEEN ? AND ?`
    )
    .all(start, end);

  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, seconds: 0 }));
  const byDay = {};
  const byProject = {};
  const byApp = {};

  for (const e of timeEntries) {
    const dur = e.duration || 0;
    if (dur <= 0) continue;
    const day = e.started_at.split('T')[0];
    byDay[day] = (byDay[day] || 0) + dur;
    byHour[new Date(e.started_at).getHours()].seconds += dur;
    const pk = e.project_name || 'Boshqa';
    byProject[pk] = (byProject[pk] || 0) + dur;
    byApp[e.app_name] = (byApp[e.app_name] || 0) + dur;
  }

  const productiveHour = byHour.reduce(
    (best, h) => (h.seconds > best.seconds ? h : best),
    { hour: 0, seconds: 0 }
  );

  const topProject = Object.entries(byProject).sort((a, b) => b[1] - a[1])[0];

  const days = [];
  let d = new Date(start);
  const endD = new Date(end);
  while (d <= endD) {
    const key = d.toISOString().split('T')[0];
    days.push({ date: key, seconds: byDay[key] || 0 });
    d.setDate(d.getDate() + 1);
  }

  const stackedByDay = days.map((day) => {
    const dayEntries = timeEntries.filter(
      (e) => e.started_at.startsWith(day.date) && (e.duration || 0) > 0
    );
    const projects = {};
    for (const e of dayEntries) {
      const pk = e.project_name || 'Boshqa';
      projects[pk] = (projects[pk] || 0) + (e.duration || 0);
    }
    return { date: day.date, ...projects, total: day.seconds };
  });

  const topApps = Object.entries(byApp)
    .map(([name, seconds]) => ({ name, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10);

  const focusHours = totalFocusSeconds / 3600;
  const taskScore = Math.min(tasksDone * 10, 40);
  const focusScore = Math.min(focusHours * 15, 40);
  const timeScore = Math.min((timeEntries.length > 0 ? 20 : 0), 20);
  const productivityScore = Math.round(taskScore + focusScore + timeScore);

  const streak = computeStreak(db);

  const distractions = db
    .prepare(
      `SELECT COALESCE(SUM(distractions_blocked),0) as c
       FROM focus_session_stats fss
       JOIN focus_sessions fs ON fs.id = fss.session_id
       WHERE date(fs.started_at) BETWEEN ? AND ?`
    )
    .get(start, end).c;

  return {
    range: { start, end, preset },
    totalFocusSeconds,
    tasksDone,
    productiveHour: productiveHour.hour,
    topProject: topProject ? { name: topProject[0], seconds: topProject[1] } : null,
    byHour,
    stackedByDay,
    topApps,
    productivityScore,
    streak,
    distractionsBlocked: distractions,
    focusSessions,
  };
}

function computeStreak(db) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().split('T')[0];
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(duration),0) as s FROM focus_sessions WHERE date(started_at)=?`
      )
      .get(key);
    if ((row?.s || 0) >= 7200) streak++;
    else break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function exportCsv(preset, customStart, customEnd) {
  const data = getReportData(preset, customStart, customEnd);
  const lines = [
    'Sana,Loyiha,App,Davomiylik (soniya)',
    ...data.focusSessions.map(
      (f) =>
        `${f.started_at.split('T')[0]},${f.project_name},Focus,${f.duration || 0}`
    ),
  ];
  return lines.join('\n');
}

module.exports = { getReportData, exportCsv, dateRange };
