export function fmtHM(seconds) {
  const mins = Math.round((seconds || 0) / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function fmtHMShort(seconds) {
  const mins = Math.round((seconds || 0) / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function fmtHour(h) {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export function fmtTotal(seconds) {
  const h = Math.floor((seconds || 0) / 3600);
  const m = Math.floor(((seconds || 0) % 3600) / 60);
  return { h, m };
}

export const CATEGORY_META = {
  productive: {
    label: 'Produktiv',
    color: '#16a34a',
    bg: '#dcfce7',
  },
  distracting: {
    label: "Chalg'ituvchi",
    color: '#dc2626',
    bg: '#fee2e2',
  },
  neutral: {
    label: 'Neytral',
    color: '#64748b',
    bg: '#f1f5f9',
  },
};

export const DEFAULT_VAQT_CATEGORY_COLORS = {
  productive: { color: '#16a34a', bg: '#dcfce7' },
  distracting: { color: '#dc2626', bg: '#fee2e2' },
  neutral: { color: '#64748b', bg: '#f1f5f9' },
};

/** Light background tint from a hex color */
export function tintBg(hex) {
  if (!hex || typeof hex !== 'string') return '#f1f5f9';
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#f1f5f9';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c) => Math.round(c * 0.18 + 255 * 0.82);
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export function mergeCategoryMeta(saved) {
  const meta = JSON.parse(JSON.stringify(CATEGORY_META));
  if (!saved || typeof saved !== 'object') return meta;
  for (const key of Object.keys(meta)) {
    const custom = saved[key];
    if (!custom?.color) continue;
    meta[key].color = custom.color;
    meta[key].bg = custom.bg || tintBg(custom.color);
  }
  return meta;
}
