/** ISO weekday: 1 = Dushanba … 7 = Yakshanba */
function jsDayToIso(date = new Date()) {
  const d = date instanceof Date ? date.getDay() : new Date(`${date}T12:00:00`).getDay();
  return d === 0 ? 7 : d;
}

function parseRepeatDays(raw) {
  if (raw == null || raw === '') return null;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const days = [...new Set(arr.map(Number).filter((n) => n >= 1 && n <= 7))].sort(
      (a, b) => a - b
    );
    return days.length ? days : null;
  } catch {
    return null;
  }
}

function stringifyRepeatDays(days) {
  const parsed = parseRepeatDays(days);
  return parsed ? JSON.stringify(parsed) : null;
}

function taskShowsOnDate(task, dateStr) {
  const repeat = parseRepeatDays(task?.repeat_days);
  if (repeat) {
    return repeat.includes(jsDayToIso(new Date(`${dateStr}T12:00:00`)));
  }
  return task?.status === 'today' || task?.due_date === dateStr;
}

module.exports = {
  jsDayToIso,
  parseRepeatDays,
  stringifyRepeatDays,
  taskShowsOnDate,
};
