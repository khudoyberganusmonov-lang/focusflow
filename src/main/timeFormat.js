/** Normalize to HH:mm (24h) for SQLite storage, or null if empty/invalid. */
function normalizeTime24h(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();

  const h12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (h12) {
    let h = parseInt(h12[1], 10);
    const m = parseInt(h12[2], 10);
    const pm = h12[3].toUpperCase() === 'PM';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!h24) return null;
  const h = Math.min(23, Math.max(0, parseInt(h24[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(h24[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

module.exports = { normalizeTime24h };
