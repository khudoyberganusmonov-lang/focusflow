/** Normalize to HH:mm (24h) for storage/display, or '' if empty. */
export function normalizeTime24h(value) {
  if (value == null || value === '') return '';
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
  if (!h24) return '';
  const h = Math.min(23, Math.max(0, parseInt(h24[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(h24[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Parse HH:mm (24h) to minutes since midnight */
export function parseTimeToMinutes(value) {
  const normalized = normalizeTime24h(value);
  if (!normalized) return null;
  const m = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export const taskTimeInputClassName =
  'w-full mt-1 rounded-lg border border-[#E5E5EA] dark:border-white/15 bg-white dark:bg-[#2C2C2E] text-[14px] tabular-nums outline-none focus:ring-2 focus:ring-light-accent/30 dark:focus:ring-dark-accent/30 [font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif] [color-scheme:light] dark:[color-scheme:dark]';

export const taskTimeInputStyle = {
  padding: '6px 10px',
  fontVariantNumeric: 'tabular-nums',
  WebkitAppearance: 'none',
  appearance: 'none',
};

export function formatTaskTimeRange(task) {
  const start = normalizeTime24h(task?.start_time);
  const end = normalizeTime24h(task?.end_time);
  if (!start || !end) return null;
  return `${start} - ${end}`;
}

export function isTaskActiveNow(task, date = new Date()) {
  if (!task?.start_time || !task?.end_time) return false;
  const start = parseTimeToMinutes(task.start_time);
  const end = parseTimeToMinutes(task.end_time);
  if (start == null || end == null) return false;
  const now = nowMinutes(date);
  if (start <= end) {
    return now >= start && now < end;
  }
  return now >= start || now < end;
}

export function sortTasksByStartTime(tasks) {
  return [...tasks].sort((a, b) => {
    const aStart = parseTimeToMinutes(a.start_time);
    const bStart = parseTimeToMinutes(b.start_time);
    if (aStart == null && bStart == null) return (a.sort_order || 0) - (b.sort_order || 0);
    if (aStart == null) return 1;
    if (bStart == null) return -1;
    if (aStart !== bStart) return aStart - bStart;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}
