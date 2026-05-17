/** @typedef {{ id: string, label: string, icon: string, lockMode: 'none'|'apps'|'fullscreen', color: string, suggestApps?: string[] }} TaskCategory */

/** @type {TaskCategory[]} */
export const TASK_CATEGORIES = [
  {
    id: 'ishlash',
    label: 'Ishlash',
    icon: '💼',
    lockMode: 'none',
    color: '#2563eb',
    suggestApps: ['Safari', 'Google Chrome', 'Telegram', 'Slack', 'Messages'],
  },
  {
    id: 'dam_olish',
    label: 'Dam olish',
    icon: '🛋️',
    lockMode: 'none',
    color: '#7c3aed',
  },
  {
    id: 'sport',
    label: 'Sport',
    icon: '🏃',
    lockMode: 'none',
    color: '#16a34a',
  },
  {
    id: 'kino',
    label: 'Kino / seriallar',
    icon: '🎬',
    lockMode: 'none',
    color: '#dc2626',
    suggestApps: ['Safari', 'Google Chrome', 'Telegram', 'Netflix'],
  },
  {
    id: 'uy_ishlari',
    label: 'Uy ishlari',
    icon: '🏠',
    lockMode: 'none',
    color: '#ea580c',
  },
  {
    id: 'namoz',
    label: "Namoz o'qish",
    icon: '🕌',
    lockMode: 'none',
    color: '#0891b2',
  },
  {
    id: 'oquv',
    label: "O'qish",
    icon: '📚',
    lockMode: 'none',
    color: '#9333ea',
    suggestApps: ['Safari', 'Telegram', 'Messages', 'Discord'],
  },
  {
    id: 'boshqa',
    label: 'Boshqa',
    icon: '✨',
    lockMode: 'none',
    color: '#64748b',
  },
];

export const EXTRA_TASK_ICONS = [
  '💼', '🛋️', '🏃', '🎬', '🏠', '🕌', '📚', '✨', '🎯', '☕', '🧘', '🎧',
  '📝', '💻', '🍳', '🚶', '📖', '🎮', '🛠️', '💡', '🌙', '☀️', '❤️',
];

export function getCategoryById(id) {
  return TASK_CATEGORIES.find((c) => c.id === id) || TASK_CATEGORIES.find((c) => c.id === 'boshqa');
}

export function resolveTaskLockMode(categoryId, explicitMode) {
  if (explicitMode && explicitMode !== 'inherit') return explicitMode;
  return getCategoryById(categoryId)?.lockMode || 'none';
}
