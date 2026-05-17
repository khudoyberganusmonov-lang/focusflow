export default function FocusTimer({ focusState, onPause, onResume, onStop }) {
  if (!focusState) return null;

  const mins = Math.floor(focusState.remainingSeconds / 60);
  const secs = focusState.remainingSeconds % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-6 px-8 max-w-md w-full">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse-dot" />
          <span className="text-sm text-light-dim dark:text-dark-dim">
            {focusState.projectName}
          </span>
        </div>

        <p className="text-7xl font-light tabular-nums tracking-tight">{display}</p>

        {focusState.pomodoroLabel && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {focusState.pomodoroLabel}
          </p>
        )}
        {focusState.overallRemainingSeconds != null && (
          <p className="text-xs text-light-dim dark:text-dark-dim tabular-nums">
            Jami qolgan:{' '}
            {String(Math.floor(focusState.overallRemainingSeconds / 60)).padStart(2, '0')}:
            {String(focusState.overallRemainingSeconds % 60).padStart(2, '0')}
          </p>
        )}

        {focusState.scheduleMeta?.label && (
          <p className="text-center text-sm text-light-dim dark:text-dark-dim px-4 max-w-sm">
            {focusState.scheduleMeta.label}
          </p>
        )}

        {focusState.taskTitle && (
          <p className="text-center text-lg font-medium text-light-accent dark:text-dark-accent px-4 py-2 rounded-xl bg-light-accent/10 dark:bg-dark-accent/15">
            {focusState.taskTitle}
            {focusState.scheduledNow && (
              <span className="block text-xs font-normal text-emerald-600 dark:text-emerald-400 mt-1">
                Hozir aktiv
              </span>
            )}
          </p>
        )}

        <div className="flex gap-3 mt-4">
          {focusState.paused ? (
            <button
              type="button"
              onClick={onResume}
              className="px-8 py-3 rounded-full bg-light-accent dark:bg-dark-accent text-white font-medium transition-all duration-200 hover:opacity-90"
            >
              Davom etish
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="px-8 py-3 rounded-full bg-black/5 dark:bg-white/10 font-medium transition-all duration-200 hover:bg-black/10 dark:hover:bg-white/15"
            >
              Pauza
            </button>
          )}
          <button
            type="button"
            onClick={onStop}
            className="px-8 py-3 rounded-full text-red-500 font-medium transition-all duration-200 hover:bg-red-500/10"
          >
            To'xtatish
          </button>
        </div>
      </div>
    </div>
  );
}
