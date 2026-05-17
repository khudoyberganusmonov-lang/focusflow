const CATEGORY_LABELS = {
  ishlash: 'Ishlash',
  dam_olish: 'Dam olish',
  sport: 'Sport',
  kino: 'Kino / seriallar',
  uy_ishlari: 'Uy ishlari',
  namoz: "Namoz o'qish",
  oquv: "O'qish",
  boshqa: 'Boshqa',
};

const CATEGORY_ICONS = {
  ishlash: '💼',
  dam_olish: '🛋️',
  sport: '🏃',
  kino: '🎬',
  uy_ishlari: '🏠',
  namoz: '🕌',
  oquv: '📚',
  boshqa: '✨',
};

function parseBlockedApps(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function parseBlockedSites(raw) {
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Mac qulfi: faqat vazifa yoki loyiha checkboxi (kategoriya avtomatik emas). */
function shouldMacLock(task, project) {
  if (!task) return Boolean(project?.mac_lock);
  if (task.lock_mac) return true;
  if (project?.mac_lock) return true;
  return false;
}

function durationSecondsFromTaskTimes(startTime, endTime) {
  const { normalizeTime24h } = require('./timeFormat');
  const start = normalizeTime24h(startTime);
  const end = normalizeTime24h(endTime);
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return Math.max(60, (endMin - startMin) * 60);
}

function enrichTaskRow(row, project = null) {
  if (!row) return null;
  const category = row.category || 'boshqa';
  const savedIcon = row.icon && String(row.icon).trim();
  return {
    ...row,
    category,
    icon: savedIcon || CATEGORY_ICONS[category] || '✨',
    blocked_apps: parseBlockedApps(row.blocked_apps),
    blocked_sites: parseBlockedSites(row.blocked_sites),
    lock_mac: Boolean(row.lock_mac) || row.lock_mode === 'fullscreen',
    macLock: shouldMacLock(
      { lock_mac: row.lock_mac, lock_mode: row.lock_mode },
      project
    ),
  };
}

module.exports = {
  parseBlockedApps,
  parseBlockedSites,
  shouldMacLock,
  durationSecondsFromTaskTimes,
  enrichTaskRow,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
};
