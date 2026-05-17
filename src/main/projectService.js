const { getDb } = require('./database');
const store = require('./blockerStore');

function parseBlockList(raw) {
  try {
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

function getProjectDetail(projectId) {
  const db = getDb();
  if (!db) return null;
  const row = db
    .prepare(
      `SELECT p.*, a.name as area_name
       FROM projects p
       JOIN areas a ON a.id = p.area_id
       WHERE p.id = ?`
    )
    .get(projectId);
  if (!row) return null;

  const domains = store.getProjectDomainsOnly(projectId).map((d) => d.domain);
  const blockedApps = db
    .prepare(
      `SELECT app_name, process_name FROM block_apps
       WHERE project_id = ? AND is_blocked = 1`
    )
    .all(projectId);

  return {
    ...row,
    block_list: parseBlockList(row.block_list),
    domains,
    blockedApps,
  };
}

function replaceProjectDomains(projectId, domains) {
  const db = getDb();
  db.prepare('DELETE FROM block_domains WHERE project_id = ?').run(projectId);
  for (const domain of domains || []) {
    const d = String(domain).trim();
    if (d) store.addDomain(d, projectId);
  }
  store.syncProjectBlockList(projectId);
}

function replaceProjectBlockedApps(projectId, blockedApps) {
  const db = getDb();
  db.prepare('DELETE FROM block_apps WHERE project_id = ?').run(projectId);
  for (const app of blockedApps || []) {
    if (!app?.process_name) continue;
    store.setAppBlocked(
      app.app_name || app.process_name,
      app.process_name,
      true,
      projectId
    );
  }
}

function saveProject(data) {
  const db = getDb();
  if (!db) return { error: true, message: 'Database not available' };

  const payload = {
    area_id: data.area_id,
    name: String(data.name || '').trim(),
    color: data.color || '#007AFF',
    focus_duration: Number(data.focus_duration) || 60,
    use_focus_duration: data.use_focus_duration ? 1 : 0,
    stop_lock_type: data.stop_lock_type || 'timer',
    stop_lock_timer_minutes: Number(data.stop_lock_timer_minutes) || 5,
    stop_lock_password: data.stop_lock_password || 'TOXTAMAN',
    mac_lock: data.mac_lock ? 1 : 0,
    domains: data.domains || [],
    blockedApps: data.blockedApps || [],
  };

  if (!payload.name) return { error: true, message: 'Name required' };
  if (!payload.area_id) return { error: true, message: 'Area required' };

  let projectId = data.id;

  if (projectId) {
    db.prepare(
      `UPDATE projects SET
        area_id = ?, name = ?, color = ?, focus_duration = ?,
        stop_lock_type = ?, stop_lock_timer_minutes = ?, stop_lock_password = ?,
        mac_lock = ?, use_focus_duration = ?
       WHERE id = ?`
    ).run(
      payload.area_id,
      payload.name,
      payload.color,
      payload.focus_duration,
      payload.stop_lock_type,
      payload.stop_lock_timer_minutes,
      payload.stop_lock_password,
      payload.mac_lock,
      payload.use_focus_duration,
      projectId
    );
  } else {
    const r = db
      .prepare(
        `INSERT INTO projects (
          area_id, name, color, block_list, focus_duration,
          stop_lock_type, stop_lock_timer_minutes, stop_lock_password, mac_lock,
          use_focus_duration
        ) VALUES (?, ?, ?, '[]', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        payload.area_id,
        payload.name,
        payload.color,
        payload.focus_duration,
        payload.stop_lock_type,
        payload.stop_lock_timer_minutes,
        payload.stop_lock_password,
        payload.mac_lock,
        payload.use_focus_duration
      );
    projectId = r.lastInsertRowid;
  }

  replaceProjectDomains(projectId, payload.domains);
  replaceProjectBlockedApps(projectId, payload.blockedApps);

  return { ok: true, project: getProjectDetail(projectId) };
}

function deleteProject(projectId) {
  const db = getDb();
  if (!db) return { error: true, message: 'Database not available' };

  const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(projectId);
  if (!project) return { error: true, message: 'Not found' };

  db.prepare('DELETE FROM block_domains WHERE project_id = ?').run(projectId);
  db.prepare('DELETE FROM block_apps WHERE project_id = ?').run(projectId);
  db.prepare('DELETE FROM block_exceptions WHERE project_id = ?').run(projectId);
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

  return { ok: true, name: project.name };
}

function saveArea(data) {
  const db = getDb();
  if (!db) return { error: true, message: 'Database not available' };

  const name = String(data.name || '').trim();
  const color = data.color || '#007AFF';
  const icon = data.icon || '📁';

  if (!name) return { error: true, message: 'Name required' };

  if (data.id) {
    db.prepare('UPDATE areas SET name = ?, color = ?, icon = ? WHERE id = ?').run(
      name,
      color,
      icon,
      data.id
    );
    return { ok: true, area: db.prepare('SELECT * FROM areas WHERE id = ?').get(data.id) };
  }

  const maxOrder =
    db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM areas').get().m || 0;
  const r = db
    .prepare(
      'INSERT INTO areas (name, color, icon, sort_order) VALUES (?, ?, ?, ?)'
    )
    .run(name, color, icon, maxOrder + 1);
  return {
    ok: true,
    area: db.prepare('SELECT * FROM areas WHERE id = ?').get(r.lastInsertRowid),
  };
}

function deleteArea(areaId) {
  const db = getDb();
  if (!db) return { error: true, message: 'Database not available' };

  const count =
    db.prepare('SELECT COUNT(*) as c FROM projects WHERE area_id = ?').get(areaId).c || 0;
  if (count > 0) {
    return { error: true, message: 'has_projects', count };
  }

  db.prepare('DELETE FROM areas WHERE id = ?').run(areaId);
  return { ok: true };
}

module.exports = {
  getProjectDetail,
  saveProject,
  deleteProject,
  saveArea,
  deleteArea,
};
