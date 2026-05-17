import { normalizeTime24h } from '../utils/taskTime';

export default function TaskPomodoroFields({
  enabled,
  onEnabledChange,
  workMinutes,
  onWorkMinutesChange,
  breakMinutes,
  onBreakMinutesChange,
  startTime,
  endTime,
}) {
  const hasWindow =
    Boolean(normalizeTime24h(startTime)) && Boolean(normalizeTime24h(endTime));

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-2.5 space-y-2 mb-3">
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(enabled)}
          disabled={!hasWindow}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="rounded mt-0.5"
        />
        <span>
          <span className="font-medium text-xs">Pomodoro rejimi</span>
          <span className="block text-[11px] text-light-dim dark:text-dark-dim mt-0.5">
            {hasWindow ? (
              <>
                Belgilangan vaqt oralig&apos;ida ish / dam olish tsikllari. Dam olishda
                Mac qulflanadi.
                <span className="block mt-1 tabular-nums text-light-accent dark:text-dark-accent">
                  {normalizeTime24h(startTime)} – {normalizeTime24h(endTime)}
                </span>
              </>
            ) : (
              'Pomodoro uchun boshlanish va tugash vaqtini to‘ldiring (masalan 20:00 va 23:00).'
            )}
          </span>
        </span>
      </label>

      {enabled && hasWindow && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <label className="block text-xs text-light-dim">
            Ish (daqiqa)
            <input
              type="number"
              min={1}
              max={180}
              value={workMinutes}
              onChange={(e) => onWorkMinutesChange(Number(e.target.value) || 25)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm tabular-nums"
            />
          </label>
          <label className="block text-xs text-light-dim">
            Dam olish (daqiqa)
            <input
              type="number"
              min={1}
              max={60}
              value={breakMinutes}
              onChange={(e) => onBreakMinutesChange(Number(e.target.value) || 5)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm tabular-nums"
            />
          </label>
        </div>
      )}
    </div>
  );
}
