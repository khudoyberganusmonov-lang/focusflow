const { getDb } = require('./database');
const { isUnproductive } = require('./tracker');

const DAY_LABELS = ['Yak', 'Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha'];
const WEEKDAY_SHORT = ['Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha', 'Yak'];

const PROJECT_COLORS = [
  '#3b82f6',
  '#a855f7',
  '#06b6d4',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#6366f1',
  '#94a3b8',
];

const PRODUCTIVE_APP_RE =
  /cursor|visual studio|vs code|code|xcode|figma|sketch|terminal|iterm|after effects|premiere|photoshop|illustrator|blender|unity|unreal|notion|linear/i;

const DISTRACTING_APP_RE =
  /telegram|instagram|twitter|x\.com|facebook|tiktok|netflix|spotify|messages|whatsapp|discord|slack|mail|youtube|safari|chrome|arc|brave/i;

function presetToRange(preset, anchorDate) {
  const anchor = anchorDate || new Date().toISOString().split('T')[0];
  const d = new Date(`${anchor}T12:00:00`);
  const today = d.toISOString().split('T')[0];

  if (preset === 'day') {
    return { start: today, end: today, preset: 'day', anchor: today };
  }
  if (preset === 'week') {
    const start = new Date(d);
    start.setDate(start.getDate() - 6);
    return {
      start: start.toISOString().split('T')[0],
      end: today,
      preset: 'week',
      anchor: today,
    };
  }
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  return {
    start: start.toISOString().split('T')[0],
    end: today,
    preset: 'month',
    anchor: today,
  };
}

function colorForIndex(i) {
  return PROJECT_COLORS[i % PROJECT_COLORS.length];
}

function colorForName(name, index) {
  const row = String(name || '');
  if (row.includes('CEP') || row.includes('Video')) return '#f59e0b';
  if (/design|figma/i.test(row)) return '#a855f7';
  if (/code|dev/i.test(row)) return '#06b6d4';
  return colorForIndex(index);
}

function categorizeEntry(entry) {
  if (entry.unproductive || isUnproductive(entry.url)) return 'distracting';
  const app = String(entry.app_name || '').toLowerCase();
  if (PRODUCTIVE_APP_RE.test(app)) return 'productive';
  if (DISTRACTING_APP_RE.test(app) && !/github|stackoverflow|developer/i.test(entry.window_title || '')) {
    return 'distracting';
  }
  return 'neutral';
}

function formatWeekLabel(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });
}

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString('uz-UZ', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function emptyVaqtStats(preset, anchor) {
  return {
    preset,
    anchorDate: anchor,
    range: presetToRange(preset, anchor),
    totalSeconds: 0,
    dayCount: 1,
    avgPerDaySeconds: 0,
    changePct: null,
    weekdayHours: WEEKDAY_SHORT.map((day) => ({ day, hours: 0 })),
    hourlyMinutes: Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: 0 })),
    weekLabels: [],
    projectsPerWeek: [],
    categories: [],
    productivityScore: 0,
    productiveWeekday: WEEKDAY_SHORT.map((day) => ({ day, score: 0 })),
    productiveHours: Array.from({ length: 24 }, (_, hour) => ({ hour, score: 0 })),
    apps: [],
    projects: [],
    timeline: [],
    focusSeconds: 0,
    tasksCompleted: 0,
    pausedReason: null,
    categoryTotals: { productive: 0, distracting: 0, neutral: 0 },
  };
}

function getVaqtStats(preset = 'day', anchorDate, pausedReason = null, filterProjectId = null) {
  const db = getDb();
  const range = presetToRange(preset, anchorDate);
  if (!db) return { ...emptyVaqtStats(preset, range.anchor), pausedReason };

  let timeEntries = db
    .prepare(
      `SELECT te.*, p.name as project_name, p.color as project_color
       FROM time_entries te
       LEFT JOIN projects p ON p.id = te.project_id
       WHERE date(te.started_at) BETWEEN ? AND ?
       ORDER BY te.started_at ASC`
    )
    .all(range.start, range.end)
    .map((e) => ({
      ...e,
      unproductive: isUnproductive(e.url),
      category: categorizeEntry(e),
    }));

  let focusSessions = db
    .prepare(
      `SELECT fs.*, p.name as project_name, p.color as project_color
       FROM focus_sessions fs
       JOIN projects p ON p.id = fs.project_id
       WHERE date(fs.started_at) BETWEEN ? AND ? AND fs.duration > 0`
    )
    .all(range.start, range.end);

  const allEntries = timeEntries;
  const allFocusSessions = focusSessions;

  if (filterProjectId != null && filterProjectId !== '') {
    const pid = Number(filterProjectId);
    timeEntries = timeEntries.filter((e) => e.project_id === pid);
    focusSessions = focusSessions.filter((f) => f.project_id === pid);
  }

  const tasksCompleted = db
    .prepare(
      `SELECT COUNT(*) as c FROM tasks
       WHERE status = 'done' AND date(completed_at) BETWEEN ? AND ?`
    )
    .get(range.start, range.end).c;

  const projects = db
    .prepare(
      `SELECT p.id, p.name, p.color FROM projects p
       JOIN areas a ON a.id = p.area_id
       ORDER BY p.id`
    )
    .all();

  const totalSeconds = timeEntries.reduce((s, e) => s + (e.duration || 0), 0);
  const focusSeconds = focusSessions.reduce((s, f) => s + (f.duration || 0), 0);

  const startD = new Date(`${range.start}T12:00:00`);
  const endD = new Date(`${range.end}T12:00:00`);
  const dayCount = Math.max(
    1,
    Math.round((endD - startD) / 86400000) + 1
  );

  const categoryTotals = { productive: 0, distracting: 0, neutral: 0 };
  for (const e of timeEntries) {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.duration || 0);
  }
  for (const f of focusSessions) {
    categoryTotals.productive += f.duration || 0;
  }

  const trackedForScore = totalSeconds + focusSeconds;
  const productivityScore =
    trackedForScore > 0
      ? Math.round((categoryTotals.productive / trackedForScore) * 100)
      : 0;

  const categories = projects
    .map((p, i) => {
      let seconds = 0;
      for (const e of allEntries) {
        if (e.project_id === p.id) seconds += e.duration || 0;
      }
      for (const f of allFocusSessions) {
        if (f.project_id === p.id) seconds += f.duration || 0;
      }
      return {
        id: String(p.id),
        name: p.name,
        color: p.color || colorForName(p.name, i),
        minutes: Math.round(seconds / 60),
        seconds,
      };
    })
    .filter((c) => c.seconds > 0);

  const byWeekday = {};
  for (const label of WEEKDAY_SHORT) byWeekday[label] = 0;
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: 0 }));
  const byDay = {};
  const byProjectWeek = {};
  const byApp = {};
  const byProject = {};
  const productiveByWeekday = {};
  const productiveByHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    productive: 0,
    total: 0,
  }));

  for (const e of timeEntries) {
    const dur = e.duration || 0;
    if (dur <= 0) continue;
    const started = new Date(e.started_at);
    const dayKey = e.started_at.split('T')[0];
    const wd = WEEKDAY_SHORT[(started.getDay() + 6) % 7];
    byWeekday[wd] = (byWeekday[wd] || 0) + dur;
    byHour[started.getHours()].minutes += dur / 60;
    byDay[dayKey] = (byDay[dayKey] || 0) + dur;

    const weekKey = getWeekStart(dayKey);
    if (!byProjectWeek[weekKey]) byProjectWeek[weekKey] = {};
    const pk = e.project_id || 'unassigned';
    byProjectWeek[weekKey][pk] = (byProjectWeek[weekKey][pk] || 0) + dur;

    byApp[e.app_name] = byApp[e.app_name] || {
      name: e.app_name,
      seconds: 0,
      category: e.category,
    };
    byApp[e.app_name].seconds += dur;

    const projKey = e.project_id || 'unassigned';
    if (!byProject[projKey]) {
      byProject[projKey] = {
        id: projKey,
        name: e.project_name || 'Tayinlanmagan',
        color: e.project_color,
        seconds: 0,
        entries: [],
      };
    }
    byProject[projKey].seconds += dur;
    byProject[projKey].entries.push(e);

    productiveByWeekday[wd] = productiveByWeekday[wd] || { productive: 0, total: 0 };
    productiveByWeekday[wd].total += dur;
    if (e.category === 'productive') productiveByWeekday[wd].productive += dur;

    const h = started.getHours();
    productiveByHour[h].total += dur;
    if (e.category === 'productive') productiveByHour[h].productive += dur;
  }

  for (const f of focusSessions) {
    const dur = f.duration || 0;
    const started = new Date(f.started_at);
    const dayKey = f.started_at.split('T')[0];
    const wd = WEEKDAY_SHORT[(started.getDay() + 6) % 7];
    byWeekday[wd] = (byWeekday[wd] || 0) + dur;
    byHour[started.getHours()].minutes += dur / 60;
    byDay[dayKey] = (byDay[dayKey] || 0) + dur;

    const weekKey = getWeekStart(dayKey);
    if (!byProjectWeek[weekKey]) byProjectWeek[weekKey] = {};
    byProjectWeek[weekKey][f.project_id] =
      (byProjectWeek[weekKey][f.project_id] || 0) + dur;

    if (!byProject[f.project_id]) {
      byProject[f.project_id] = {
        id: f.project_id,
        name: f.project_name,
        color: f.project_color,
        seconds: 0,
        entries: [],
        focusSessions: [],
      };
    }
    byProject[f.project_id].seconds += dur;
    byProject[f.project_id].focusSessions = byProject[f.project_id].focusSessions || [];
    byProject[f.project_id].focusSessions.push(f);

    productiveByWeekday[wd] = productiveByWeekday[wd] || { productive: 0, total: 0 };
    productiveByWeekday[wd].total += dur;
    productiveByWeekday[wd].productive += dur;

    const h = started.getHours();
    productiveByHour[h].total += dur;
    productiveByHour[h].productive += dur;
  }

  const weekdayHours = WEEKDAY_SHORT.map((day) => ({
    day,
    hours: Math.round(((byWeekday[day] || 0) / 3600) * 10) / 10,
  }));

  const productiveWeekday = WEEKDAY_SHORT.map((day) => {
    const row = productiveByWeekday[day] || { productive: 0, total: 0 };
    const score = row.total > 0 ? Math.round((row.productive / row.total) * 100) : 0;
    return { day, score };
  });

  const productiveHours = productiveByHour.map((row) => ({
    hour: row.hour,
    score: row.total > 0 ? Math.round((row.productive / row.total) * 100) : 0,
  }));

  const weekLabels = [];
  const projectsPerWeek = [];
  let cursor = new Date(`${range.start}T12:00:00`);
  const endCursor = new Date(`${range.end}T12:00:00`);
  while (cursor <= endCursor) {
    const dayKey = cursor.toISOString().split('T')[0];
    const wk = getWeekStart(dayKey);
    if (!weekLabels.includes(wk)) {
      weekLabels.push(wk);
      const row = { week: formatWeekLabel(wk) };
      for (const p of projects) {
        row[`p_${p.id}`] = Math.round(
          ((byProjectWeek[wk]?.[p.id] || 0) / 3600) * 10
        ) / 10;
      }
      const unassigned = byProjectWeek[wk]?.unassigned || 0;
      if (unassigned > 0) {
        row.p_unassigned = Math.round((unassigned / 3600) * 10) / 10;
      }
      projectsPerWeek.push(row);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const apps = Object.values(byApp)
    .sort((a, b) => b.seconds - a.seconds)
    .map((a, i) => ({
      name: a.name,
      seconds: a.seconds,
      minutes: Math.round(a.seconds / 60),
      color: colorForIndex(i),
      category: a.category,
    }));

  const projectList = buildProjectTree(projects, byProject, focusSessions);

  const timeline = buildTimeline(timeEntries, range);

  let changePct = null;
  if (preset === 'week' || preset === 'month') {
    const prior = getPriorPeriodTotal(db, preset, range);
    if (prior > 0) {
      changePct = Math.round(((totalSeconds - prior) / prior) * 100);
    }
  }

  return {
    preset,
    anchorDate: range.anchor,
    range,
    totalSeconds: totalSeconds + focusSeconds,
    trackedSeconds: totalSeconds,
    focusSeconds,
    dayCount,
    avgPerDaySeconds: Math.floor((totalSeconds + focusSeconds) / dayCount),
    changePct,
    weekdayHours,
    hourlyMinutes: byHour,
    weekLabels,
    projectsPerWeek,
    categories,
    productivityScore,
    productiveWeekday,
    productiveHours,
    apps,
    projects: projectList,
    timeline,
    tasksCompleted,
    pausedReason,
    categoryTotals,
    projectColors: projects.map((p, i) => ({
      id: String(p.id),
      name: p.name,
      color: p.color || colorForName(p.name, i),
    })),
  };
}

function getWeekStart(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getPriorPeriodTotal(db, preset, range) {
  const start = new Date(`${range.start}T12:00:00`);
  const end = new Date(`${range.end}T12:00:00`);
  const days = Math.round((end - start) / 86400000) + 1;
  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - days + 1);
  const ps = priorStart.toISOString().split('T')[0];
  const pe = priorEnd.toISOString().split('T')[0];
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(duration), 0) as s FROM time_entries
       WHERE date(started_at) BETWEEN ? AND ?`
    )
    .get(ps, pe);
  const focus = db
    .prepare(
      `SELECT COALESCE(SUM(duration), 0) as s FROM focus_sessions
       WHERE date(started_at) BETWEEN ? AND ?`
    )
    .get(ps, pe);
  return (row?.s || 0) + (focus?.s || 0);
}

function buildProjectTree(projects, byProject, focusSessions) {
  const list = [];

  for (const p of projects) {
    const bucket = byProject[p.id];
    if (!bucket || bucket.seconds <= 0) continue;

    const children = groupEntriesIntoTasks(bucket.entries || [], bucket.focusSessions || []);
    list.push({
      id: String(p.id),
      name: p.name,
      color: p.color || colorForName(p.name, list.length),
      minutes: Math.round(bucket.seconds / 60),
      seconds: bucket.seconds,
      children,
    });
  }

  const unassigned = byProject.unassigned;
  if (unassigned?.seconds > 0) {
    list.push({
      id: 'unassigned',
      name: 'Tayinlanmagan',
      color: '#94a3b8',
      minutes: Math.round(unassigned.seconds / 60),
      seconds: unassigned.seconds,
      children: groupEntriesIntoTasks(unassigned.entries || [], []),
    });
  }

  return list.sort((a, b) => b.seconds - a.seconds);
}

function groupEntriesIntoTasks(entries, focusSessions) {
  const groups = new Map();

  for (const f of focusSessions) {
    const key = 'focus';
    if (!groups.has(key)) {
      groups.set(key, {
        id: `focus-${f.id}`,
        name: 'Fokus sessiyasi',
        minutes: 0,
        entries: [],
      });
    }
    const g = groups.get(key);
    g.minutes += Math.round((f.duration || 0) / 60);
    g.entries.push({
      id: `fs-${f.id}`,
      title: f.project_name || 'Fokus',
      when: formatWhen(f.started_at),
      minutes: Math.round((f.duration || 0) / 60),
      seconds: f.duration || 0,
      type: 'focus',
    });
  }

  for (const e of entries) {
    const title = (e.window_title || e.app_name || 'Nomaʼlum').trim();
    const key = title.slice(0, 80) || e.app_name;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `task-${e.id}`,
        name: title.length > 48 ? `${title.slice(0, 45)}…` : title,
        minutes: 0,
        entries: [],
      });
    }
    const g = groups.get(key);
    g.minutes += Math.round((e.duration || 0) / 60);
    g.entries.push({
      id: e.id,
      title: e.app_name,
      when: formatWhen(e.started_at),
      minutes: Math.max(1, Math.round((e.duration || 0) / 60)),
      seconds: e.duration || 0,
      type: 'entry',
      app_name: e.app_name,
      category: e.category,
    });
  }

  return Array.from(groups.values())
    .sort((a, b) => b.minutes - a.minutes)
    .map((g) => ({
      ...g,
      minutes: g.entries.reduce((s, e) => s + e.minutes, 0) || g.minutes,
    }));
}

function buildTimeline(entries, range) {
  const dayStart = new Date(`${range.start}T00:00:00`).getTime();
  const dayEnd = new Date(`${range.end}T23:59:59`).getTime();
  const span = Math.max(dayEnd - dayStart, 1);

  return entries
    .filter((e) => (e.duration || 0) > 0)
    .map((e) => {
      const start = new Date(e.started_at).getTime();
      const end = e.ended_at
        ? new Date(e.ended_at).getTime()
        : start + (e.duration || 0) * 1000;
      const leftPct = Math.max(0, ((start - dayStart) / span) * 100);
      const widthPct = Math.max(0.4, ((end - start) / span) * 100);
      return {
        id: e.id,
        app_name: e.app_name,
        window_title: e.window_title,
        started_at: e.started_at,
        ended_at: e.ended_at,
        duration: e.duration,
        project_name: e.project_name,
        category: e.category,
        leftPct,
        widthPct,
        label: new Date(e.started_at).toLocaleTimeString('uz-UZ', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    });
}

module.exports = { getVaqtStats, categorizeEntry, presetToRange };
