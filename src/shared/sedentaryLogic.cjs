function normalizeWarnMinutes(value) {
  const n = Number(value) || 60;
  const snapped = Math.round(n / 5) * 5;
  return Math.max(5, Math.min(180, snapped));
}

function normalizeProjectId(raw) {
  if (raw == null || raw === '') return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function shouldWatchForFocus({ enabled, projectId, focus }) {
  if (!enabled) return false;
  const linkedId = normalizeProjectId(projectId);
  if (!linkedId) return false;
  if (!focus) return false;
  if (focus.paused) return false;
  return Number(focus.projectId) === linkedId;
}

function countsAsSitting({ present, activeAppName, activeAppMatches }) {
  return Boolean(present && (activeAppMatches || !activeAppName));
}

function appMatchesProject(appName, projectName) {
  if (!appName || !projectName) return false;
  const app = String(appName).toLowerCase();
  const name = String(projectName).toLowerCase();

  if (name.includes('ae') && /after effects|adobe/.test(app)) return true;

  const tokens = name.split(/[\s\-–—]+/).filter((t) => t.length >= 2);
  return tokens.some((t) => app.includes(t));
}

module.exports = {
  normalizeWarnMinutes,
  normalizeProjectId,
  shouldWatchForFocus,
  countsAsSitting,
  appMatchesProject,
};
