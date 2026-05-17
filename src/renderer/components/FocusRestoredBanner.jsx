export default function FocusRestoredBanner({ onDismiss }) {
  return (
    <div
      role="status"
      className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-100"
    >
      <span className="text-sm font-medium">Fokus davom etyapti</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-amber-800/80 dark:text-amber-200/80 hover:underline"
        >
          Yopish
        </button>
      )}
    </div>
  );
}
