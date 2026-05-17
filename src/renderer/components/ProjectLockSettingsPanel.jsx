import { LOCK_OPTIONS, formatLockBadge } from '../utils/projectLock';

export default function ProjectLockSettingsPanel({
  projectId,
  selectedProject,
  lockType,
  lockTimerMinutes,
  lockPassword,
  lockSaving,
  onLockTypeChange,
  onTimerMinutesChange,
  onPasswordChange,
  onSave,
}) {
  if (!projectId) {
    return (
      <p className="text-sm text-light-dim dark:text-dark-dim py-8 text-center">
        Fokus qulfi uchun loyihani tanlang (global emas)
      </p>
    );
  }

  return (
    <>
      {selectedProject && (
        <div className="mb-4 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
          <p className="font-medium text-sm">{selectedProject.name}</p>
          <p className="text-xs text-light-dim dark:text-dark-dim mt-0.5">
            {selectedProject.use_focus_duration
              ? `Fokus: ${selectedProject.focus_duration} daqiqa`
              : 'Fokus vaqti: vazifa jadvalidan'}
            {formatLockBadge(selectedProject) && (
              <> | {formatLockBadge(selectedProject)}</>
            )}
          </p>
        </div>
      )}

      <p className="text-xs text-light-dim dark:text-dark-dim mb-3">
        &quot;To&apos;xtatish&quot; bosilganda qo&apos;llanadi
      </p>

      <div className="space-y-2 mb-4">
        {LOCK_OPTIONS.map((opt) => {
          const selected = lockType === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onLockTypeChange(opt.id)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                selected
                  ? 'border-light-accent dark:border-dark-accent bg-light-accent/8 dark:bg-dark-accent/10 shadow-sm'
                  : 'border-black/5 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] hover:border-black/10 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    selected
                      ? 'border-light-accent dark:border-dark-accent'
                      : 'border-black/20 dark:border-white/30'
                  }`}
                >
                  {selected && (
                    <span className="w-2 h-2 rounded-full bg-light-accent dark:bg-dark-accent" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm flex items-center gap-2">
                    {opt.label}
                    {opt.default && (
                      <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-light-dim">
                        standart
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-light-dim dark:text-dark-dim mt-0.5 leading-relaxed">
                    {opt.description}
                  </p>

                  {selected && opt.id === 'timer' && (
                    <label
                      className="block mt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs text-light-dim dark:text-dark-dim">
                        Daqiqa
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={lockTimerMinutes}
                        onChange={(e) => onTimerMinutesChange(e.target.value)}
                        className="mt-1 w-24 px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-sm tabular-nums"
                      />
                    </label>
                  )}

                  {selected && opt.id === 'password' && (
                    <label
                      className="block mt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs text-light-dim dark:text-dark-dim">
                        Maxsus so&apos;z
                      </span>
                      <input
                        type="text"
                        value={lockPassword}
                        onChange={(e) =>
                          onPasswordChange(e.target.value.toUpperCase())
                        }
                        placeholder="TOXTAMAN"
                        className="mt-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-sm uppercase tracking-wider"
                      />
                    </label>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={lockSaving}
        className="w-full py-3 rounded-xl bg-light-accent dark:bg-dark-accent text-white font-medium disabled:opacity-50"
      >
        {lockSaving ? 'Saqlanmoqda…' : 'Saqlash'}
      </button>
    </>
  );
}
