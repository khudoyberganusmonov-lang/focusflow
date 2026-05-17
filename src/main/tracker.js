const { execa } = require('execa');
const { getDb } = require('./database');

const INTERVAL_MS = 10_000;
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const UNPRODUCTIVE_HOSTS = ['youtube.com', 'instagram.com', 't.me'];

let intervalId = null;
let currentEntry = null;
let trackingEnabled = false;
let focusProjectId = null;
let lastActivityAt = Date.now();
let pausedReason = null;

function normalizeHost(url) {
  if (!url) return null;
  try {
    const u = url.includes('://') ? new URL(url) : new URL(`https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function isUnproductive(url) {
  const host = normalizeHost(url);
  if (!host) return false;
  return UNPRODUCTIVE_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`)
  );
}

function getUnproductiveHosts() {
  return [...UNPRODUCTIVE_HOSTS];
}

async function runOsascript(script) {
  const { stdout } = await execa('osascript', ['-e', script], {
    timeout: 8000,
    reject: false,
  });
  return (stdout || '').trim();
}

async function isScreenLocked() {
  try {
    const out = await runOsascript(
      'tell application "System Events" to return (get running of screen saver preferences)'
    );
    if (out === 'true') return true;
    const { stdout } = await execa(
      'python3',
      [
        '-c',
        `import Quartz; d=Quartz.CGSessionCopyCurrentDictionary(); print(d.get('CGSSessionScreenIsLocked', 0) if d else 0)`,
      ],
      { reject: false, timeout: 3000 }
    );
    return stdout.trim() === '1';
  } catch {
    return false;
  }
}

async function getIdleSeconds() {
  try {
    const out = await runOsascript(
      'tell application "System Events" to return idle time of (get properties of (first process whose frontmost is true))'
    );
    const n = parseFloat(out);
    if (!Number.isNaN(n)) return n;
  } catch {
    /* fallback */
  }
  try {
    const { stdout } = await execa(
      'ioreg',
      ['-c', 'IOHIDSystem'],
      { reject: false, timeout: 3000 }
    );
    const m = stdout.match(/HIDIdleTime\s*=\s*(\d+)/);
    if (m) return parseInt(m[1], 10) / 1_000_000_000;
  } catch {
    /* ignore */
  }
  return (Date.now() - lastActivityAt) / 1000;
}

async function getActiveWindow() {
  const script = `
    tell application "System Events"
      set frontApp to name of first application process whose frontmost is true
      set frontTitle to ""
      try
        tell process frontApp
          if (count of windows) > 0 then
            set frontTitle to name of front window
          end if
        end tell
      end try
      return frontApp & "|||" & frontTitle
    end tell
  `;
  const raw = await runOsascript(script);
  if (!raw) return null;
  const [app_name, window_title] = raw.split('|||');
  let url = null;

  const browsers = {
    Safari: 'tell application "Safari" to return URL of current tab of front window',
    'Google Chrome':
      'tell application "Google Chrome" to return URL of active tab of front window',
    Arc: 'tell application "Arc" to return URL of active tab of front window',
    'Brave Browser':
      'tell application "Brave Browser" to return URL of active tab of front window',
  };

  if (browsers[app_name]) {
    try {
      url = (await runOsascript(browsers[app_name])) || null;
    } catch {
      url = null;
    }
  }

  return {
    app_name: app_name || 'Unknown',
    window_title: window_title || '',
    url,
  };
}

function matchProjectId(active, db) {
  if (focusProjectId) return focusProjectId;
  if (!db) return null;

  let projects = [];
  try {
    projects = db
      .prepare('SELECT id, name, block_list FROM projects')
      .all();
  } catch {
    return null;
  }

  const appLower = (active.app_name || '').toLowerCase();
  const titleLower = (active.window_title || '').toLowerCase();
  const urlHost = normalizeHost(active.url);

  for (const p of projects) {
    let blocks = [];
    try {
      blocks = JSON.parse(p.block_list || '[]');
    } catch {
      blocks = [];
    }
    const nameLower = p.name.toLowerCase();
    if (appLower.includes(nameLower) || titleLower.includes(nameLower)) {
      return p.id;
    }
    for (const domain of blocks) {
      const d = normalizeHost(domain);
      if (urlHost && d && (urlHost === d || urlHost.endsWith(`.${d}`))) {
        return p.id;
      }
    }
  }

  const devApps = ['cursor', 'code', 'xcode', 'after effects', 'premiere', 'figma'];
  if (devApps.some((d) => appLower.includes(d))) {
    const ish = projects.find((p) => p.name.includes('CEP') || p.name.includes('Video'));
    if (ish) return ish.id;
  }

  return null;
}

function closeCurrentEntry() {
  if (!currentEntry) return;
  const db = getDb();
  if (!db) {
    currentEntry = null;
    return;
  }
  const ended = new Date().toISOString();
  const started = new Date(currentEntry.started_at);
  const duration = Math.max(
    0,
    Math.floor((Date.now() - started.getTime()) / 1000)
  );
  db.prepare(
    `UPDATE time_entries SET ended_at = ?, duration = ? WHERE id = ?`
  ).run(ended, duration, currentEntry.id);
  currentEntry = null;
}

async function tick() {
  if (!trackingEnabled) return;

  const locked = await isScreenLocked();
  const idleSec = await getIdleSeconds();
  const idle = idleSec * 1000 >= IDLE_THRESHOLD_MS;

  if (locked || idle) {
    pausedReason = locked ? 'locked' : 'idle';
    closeCurrentEntry();
    return;
  }
  pausedReason = null;

  const active = await getActiveWindow();
  if (!active) {
    closeCurrentEntry();
    return;
  }

  lastActivityAt = Date.now();
  const db = getDb();
  if (!db) return;
  const projectId = matchProjectId(active, db);
  const now = new Date().toISOString();

  if (
    currentEntry &&
    currentEntry.app_name === active.app_name &&
    currentEntry.window_title === active.window_title &&
    (currentEntry.url || '') === (active.url || '') &&
    currentEntry.project_id === projectId
  ) {
    return;
  }

  closeCurrentEntry();

  const result = db
    .prepare(
      `INSERT INTO time_entries (app_name, window_title, url, started_at, project_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      active.app_name,
      active.window_title,
      active.url,
      now,
      projectId
    );

  currentEntry = {
    id: result.lastInsertRowid,
    app_name: active.app_name,
    window_title: active.window_title,
    url: active.url,
    project_id: projectId,
    started_at: now,
  };
}

function startTracking(projectId = null) {
  trackingEnabled = true;
  if (projectId) focusProjectId = projectId;
  if (intervalId) return;
  void tick().catch((err) => console.warn('[tracker] tick:', err.message));
  intervalId = setInterval(() => {
    void tick().catch((err) => console.warn('[tracker] tick:', err.message));
  }, INTERVAL_MS);
}

function stopTracking() {
  trackingEnabled = false;
  focusProjectId = null;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  closeCurrentEntry();
}

function setFocusProject(projectId) {
  focusProjectId = projectId;
}

function clearFocusProject() {
  focusProjectId = null;
}

function emptyStats(date) {
  const d = date || new Date().toISOString().split('T')[0];
  return {
    date: d,
    totalSeconds: 0,
    entries: [],
    byApp: [],
    bySite: [],
    byProject: [],
    byHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, seconds: 0 })),
    pausedReason,
  };
}

function getTimeEntries(date) {
  const db = getDb();
  if (!db) return [];
  const d = date || new Date().toISOString().split('T')[0];
  try {
    return db
    .prepare(
      `SELECT te.*, p.name as project_name, p.color as project_color
       FROM time_entries te
       LEFT JOIN projects p ON p.id = te.project_id
       WHERE date(te.started_at) = ?
       ORDER BY te.started_at ASC`
    )
      .all(d)
      .map((e) => ({ ...e, unproductive: isUnproductive(e.url) }));
  } catch (err) {
    console.warn('[tracker] getTimeEntries:', err.message);
    return [];
  }
}

function getTodayStats(date) {
  const db = getDb();
  if (!db) return emptyStats(date);
  const entries = getTimeEntries(date);
  const byApp = {};
  const bySite = {};
  const byProject = {};
  const byHour = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    seconds: 0,
  }));

  for (const e of entries) {
    const dur = e.duration || 0;
    if (dur <= 0) continue;

    byApp[e.app_name] = (byApp[e.app_name] || 0) + dur;

    const host = normalizeHost(e.url);
    if (host) bySite[host] = (bySite[host] || 0) + dur;

    const pk = e.project_name || 'Tayinlanmagan';
    byProject[pk] = (byProject[pk] || 0) + dur;

    const h = new Date(e.started_at).getHours();
    byHour[h].seconds += dur;
  }

  const totalSeconds = entries.reduce((s, e) => s + (e.duration || 0), 0);

  return {
    date: date || new Date().toISOString().split('T')[0],
    totalSeconds,
    entries,
    byApp: Object.entries(byApp)
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
    bySite: Object.entries(bySite)
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
    byProject: Object.entries(byProject)
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
    byHour,
    pausedReason,
  };
}

function assignEntryProject(entryId, projectId) {
  const db = getDb();
  if (!db) return;
  try {
    db.prepare('UPDATE time_entries SET project_id = ? WHERE id = ?')
      .run(projectId, entryId);
  } catch (err) {
    console.warn('[tracker] assignEntryProject:', err.message);
  }
}

function createManualEntry(data) {
  const db = getDb();
  if (!db) return null;
  const r = db
    .prepare(
      `INSERT INTO time_entries (app_name, window_title, url, started_at, ended_at, duration, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.app_name || 'Manual',
      data.window_title || '',
      data.url || null,
      data.started_at,
      data.ended_at,
      data.duration,
      data.project_id || null
    );
  return { id: r.lastInsertRowid, ...data };
}

module.exports = {
  startTracking,
  stopTracking,
  setFocusProject,
  clearFocusProject,
  getTimeEntries,
  getTodayStats,
  assignEntryProject,
  createManualEntry,
  isUnproductive,
  getUnproductiveHosts,
};
