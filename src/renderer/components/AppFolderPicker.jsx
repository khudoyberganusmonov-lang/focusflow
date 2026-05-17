import { useMemo, useState } from 'react';
import InstalledAppsList from './InstalledAppsList';

const FOLDERS = [
  {
    id: 'applications',
    label: 'Applications',
    match: (bp) =>
      bp.startsWith('/Applications/') && !bp.includes('/Utilities/'),
  },
  {
    id: 'system',
    label: 'System',
    match: (bp) =>
      bp.startsWith('/System/Applications/') && !bp.includes('/Utilities/'),
  },
  {
    id: 'utilities',
    label: 'Utilities',
    match: (bp) => bp.includes('/Utilities/'),
  },
  {
    id: 'other',
    label: 'Boshqa',
    match: () => true,
  },
];

function folderForBundle(bundlePath = '') {
  const bp = bundlePath || '';
  for (const f of FOLDERS) {
    if (f.id === 'other') continue;
    if (f.match(bp)) return f.id;
  }
  return 'other';
}

export default function AppFolderPicker({
  apps,
  loading,
  search,
  onSearchChange,
  selectedSet,
  onToggle,
  maxHeightClass = 'max-h-44',
}) {
  const [openFolder, setOpenFolder] = useState('applications');

  const grouped = useMemo(() => {
    const map = Object.fromEntries(FOLDERS.map((f) => [f.id, []]));
    for (const app of apps) {
      const fid = folderForBundle(app.bundlePath);
      map[fid].push(app);
    }
    return map;
  }, [apps]);

  const folderApps = grouped[openFolder] || [];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {FOLDERS.map((f) => {
          const count = grouped[f.id]?.length || 0;
          if (count === 0 && f.id !== 'applications') return null;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setOpenFolder(f.id)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${
                openFolder === f.id
                  ? 'bg-light-accent dark:bg-dark-accent text-white'
                  : 'bg-black/5 dark:bg-white/10 text-light-dim'
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>
      <InstalledAppsList
        apps={folderApps}
        loading={loading}
        search={search}
        onSearchChange={onSearchChange}
        maxHeightClass={maxHeightClass}
        renderAction={(app) => (
          <input
            type="checkbox"
            checked={selectedSet.has(app.process_name)}
            onChange={() => onToggle(app)}
            className="rounded"
            aria-label={`${app.app_name} bloklash`}
          />
        )}
      />
    </div>
  );
}
