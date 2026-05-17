import AppIcon from './AppIcon';

function iconSrcForApp(app) {
  if (app.icon) return app.icon;
  if (app.bundlePath && window.focusflow?.apps?.getIconUrl) {
    return window.focusflow.apps.getIconUrl(app.bundlePath);
  }
  return null;
}

export default function InstalledAppsList({
  apps,
  loading,
  search,
  onSearchChange,
  searchPlaceholder = 'Ilova qidirish...',
  emptyMessage = 'Ilova topilmadi',
  renderAction,
  maxHeightClass = 'max-h-[min(420px,50vh)]',
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="relative mb-3 shrink-0">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-dim dark:text-dark-dim"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M10.5 10.5L14 14"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-black/5 bg-black/5 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-light-accent dark:border-white/10 dark:bg-white/10 dark:focus:ring-dark-accent"
        />
        {!loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-light-dim dark:text-dark-dim">
            {apps.length}
          </span>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-light-dim dark:text-dark-dim">
          Ilovalar yuklanmoqda…
        </p>
      ) : apps.length === 0 ? (
        <p className="py-8 text-center text-sm text-light-dim dark:text-dark-dim">
          {emptyMessage}
        </p>
      ) : (
        <ul className={`space-y-0.5 overflow-y-auto ${maxHeightClass} pr-0.5`}>
          {apps.map((app) => (
            <li
              key={app.bundlePath || app.process_name}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <AppIcon
                src={iconSrcForApp(app)}
                name={app.app_name}
                size={32}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{app.app_name}</span>
              {renderAction?.(app)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
