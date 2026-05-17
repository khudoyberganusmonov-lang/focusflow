export default function MenuBar({ focusState, onStopRequest }) {
  if (!focusState) return null;

  const mins = Math.floor(focusState.remainingSeconds / 60);
  const secs = focusState.remainingSeconds % 60;
  const time = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const locked =
    focusState.fullscreenLock && focusState.remainingSeconds > 0;

  if (locked) {
    return (
      <div
        className="no-drag fixed top-3 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-600/90 text-white text-xs font-medium pointer-events-none"
        aria-live="polite"
      >
        <span>{focusState.taskIcon || '🔒'}</span>
        <span>{time} — qulflangan</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onStopRequest}
      className="no-drag fixed top-3 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-xs font-medium hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
    >
      <span>🔴</span>
      <span>
        {focusState.projectName} — {time}
      </span>
    </button>
  );
}
