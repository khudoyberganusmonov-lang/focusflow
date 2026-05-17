export default function DailyGreetingCard({ greeting, onDismiss }) {
  if (!greeting?.content) return null;

  const isMorning = greeting.type === 'morning';

  return (
    <div
      className={`mx-5 mb-3 flex gap-3 p-4 rounded-2xl border ${
        isMorning
          ? 'bg-sky-500/12 dark:bg-sky-500/15 border-sky-500/20'
          : 'bg-violet-500/15 dark:bg-violet-900/30 border-violet-500/25'
      }`}
    >
      <span
        className={`shrink-0 text-lg leading-none mt-0.5 ${
          isMorning ? 'text-sky-600 dark:text-sky-400' : 'text-violet-600 dark:text-violet-300'
        }`}
        aria-hidden
      >
        ✦
      </span>
      <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap min-w-0">
        {greeting.content}
      </p>
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

