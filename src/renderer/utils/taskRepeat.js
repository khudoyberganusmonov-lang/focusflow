export const WEEKDAYS = [
  { id: 1, label: 'Du', full: 'Dushanba' },
  { id: 2, label: 'Se', full: 'Seshanba' },
  { id: 3, label: 'Cho', full: 'Chorshanba' },
  { id: 4, label: 'Pay', full: 'Payshanba' },
  { id: 5, label: 'Ju', full: 'Juma' },
  { id: 6, label: 'Sha', full: 'Shanba' },
  { id: 7, label: 'Yak', full: 'Yakshanba' },
];

export function normalizeRepeatDays(days) {
  if (!Array.isArray(days) || days.length === 0) return [];
  return [...new Set(days.map(Number).filter((n) => n >= 1 && n <= 7))].sort(
    (a, b) => a - b
  );
}

export function formatRepeatDaysLabel(days) {
  const d = normalizeRepeatDays(days);
  if (!d.length) return '';
  if (d.length === 7) return 'Har kuni';
  return d
    .map((id) => WEEKDAYS.find((w) => w.id === id)?.label)
    .filter(Boolean)
    .join(', ');
}
