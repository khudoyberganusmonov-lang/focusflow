export default function FocusCoachCard({ coach, onDismiss }) {
  if (!coach?.message) return null;

  return (
    <div className="mx-5 mb-3 flex gap-3 p-4 rounded-2xl border border-light-accent/25 dark:border-dark-accent/30 bg-light-accent/10 dark:bg-dark-accent/15">
      <span
        className="shrink-0 text-lg leading-none mt-0.5 text-light-accent dark:text-dark-accent"
        aria-hidden
      >
        ✦
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase text-light-dim dark:text-dark-dim mb-1">
          Fokus maslahat
        </p>
        <p className="text-sm leading-relaxed">{coach.message}</p>
        {coach.suggestBreak && (
          <p className="text-xs text-light-accent dark:text-dark-accent mt-1.5">
            Tanaffus tavsiya etiladi
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-light-dim hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Yopish"
      >
        ×
      </button>
    </div>
  );
}
