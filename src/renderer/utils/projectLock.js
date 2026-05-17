export const LOCK_OPTIONS = [
  {
    id: 'none',
    label: "Yo'q",
    description: "Istalgan vaqt to'xtatish mumkin",
  },
  {
    id: 'timer',
    label: 'Vaqt',
    description: "X daqiqa o'tguncha to'xtatib bo'lmaydi",
    default: true,
  },
  {
    id: 'delay',
    label: 'Kechikish',
    description: "To'xtatishdan 30 soniya oldin ogohlantirish",
  },
  {
    id: 'password',
    label: 'Parol',
    description: "To'xtatish uchun maxsus so'z kiriting",
  },
];

/** @returns {string|null} Badge text or null when no lock */
export function formatLockBadge(project) {
  if (!project) return null;
  const type = project.stop_lock_type || 'timer';
  switch (type) {
    case 'none':
      return null;
    case 'timer':
      return `🔒 Vaqt qulfi: ${project.stop_lock_timer_minutes ?? 5} min`;
    case 'delay':
      return '🔒 Kechikish qulfi: 30 sek';
    case 'password':
      return '🔒 Parol qulfi';
    default:
      return null;
  }
}

export function formatProjectFocusMeta(project) {
  const focus = `Fokus: ${project.focus_duration} daqiqa`;
  const lock = formatLockBadge(project);
  return lock ? `${focus} | ${lock}` : focus;
}
