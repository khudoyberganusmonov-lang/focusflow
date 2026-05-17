import { WEEKDAYS, normalizeRepeatDays } from '../utils/taskRepeat';

export default function TaskWeekdayPicker({ value = [], onChange }) {
  const selected = normalizeRepeatDays(value);

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((d) => d !== id)
      : [...selected, id].sort((a, b) => a - b);
    onChange(next);
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs text-light-dim dark:text-dark-dim">
          Hafta kunlari (takrorlash)
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onChange([1, 2, 3, 4, 5, 6, 7])}
            className="text-[11px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-light-dim hover:text-light-accent dark:hover:text-dark-accent"
          >
            Har kuni
          </button>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-light-dim"
            >
              Tozalash
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((d) => {
          const on = selected.includes(d.id);
          return (
            <button
              key={d.id}
              type="button"
              title={d.full}
              onClick={() => toggle(d.id)}
              className={`min-w-[36px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                on
                  ? 'bg-light-accent dark:bg-dark-accent text-white'
                  : 'bg-black/5 dark:bg-white/10 text-light-dim dark:text-dark-dim hover:bg-black/10'
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && selected.length < 7 && (
        <p className="text-[11px] text-light-dim dark:text-dark-dim mt-1.5">
          Tanlangan kunlarda ko&apos;rinadi:{' '}
          {selected.map((id) => WEEKDAYS.find((w) => w.id === id)?.label).join(', ')}
        </p>
      )}
    </div>
  );
}
