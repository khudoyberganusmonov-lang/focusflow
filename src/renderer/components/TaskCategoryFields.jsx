import { useMemo, useState } from 'react';
import { useInstalledApps } from '../hooks/useInstalledApps';
import AppFolderPicker from './AppFolderPicker';
import {
  TASK_CATEGORIES,
  EXTRA_TASK_ICONS,
  getCategoryById,
} from '../constants/taskCategories';

function normalizeBlockedApps(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => ({
      app_name: a.app_name || a.name || '',
      process_name: a.process_name || a.processName || '',
    }))
    .filter((a) => a.process_name);
}

function normalizeSites(list) {
  if (!Array.isArray(list)) return [];
  return list.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

export default function TaskCategoryFields({
  category,
  onCategoryChange,
  icon,
  onIconChange,
  blockedApps,
  onBlockedAppsChange,
  blockedSites,
  onBlockedSitesChange,
  lockMac,
  onLockMacChange,
  projectMacLock = false,
  lockMacDisabled = false,
}) {
  const { apps, filtered, loading, search, setSearch } = useInstalledApps();
  const cat = getCategoryById(category);
  const selected = useMemo(() => normalizeBlockedApps(blockedApps), [blockedApps]);
  const sites = useMemo(() => normalizeSites(blockedSites), [blockedSites]);
  const selectedSet = useMemo(
    () => new Set(selected.map((a) => a.process_name)),
    [selected]
  );
  const [siteInput, setSiteInput] = useState('');

  const toggleApp = (app) => {
    const pn = app.process_name;
    if (selectedSet.has(pn)) {
      onBlockedAppsChange(selected.filter((a) => a.process_name !== pn));
    } else {
      onBlockedAppsChange([
        ...selected,
        { app_name: app.app_name, process_name: pn },
      ]);
    }
  };

  const selectCategory = (catId) => {
    const c = getCategoryById(catId);
    onCategoryChange(catId);
    onIconChange(c.icon);
  };

  const addSite = (e) => {
    e?.preventDefault?.();
    const raw = siteInput.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!raw || sites.includes(raw)) return;
    onBlockedSitesChange([...sites, raw]);
    setSiteInput('');
  };

  const commitSiteInput = () => {
    const raw = siteInput.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!raw || sites.includes(raw)) return;
    onBlockedSitesChange([...sites, raw]);
    setSiteInput('');
  };

  const removeSite = (domain) => {
    onBlockedSitesChange(sites.filter((s) => s !== domain));
  };

  const iconOptions = useMemo(() => {
    const list = [cat.icon, ...EXTRA_TASK_ICONS.filter((e) => e !== cat.icon)];
    return list.map((em, idx) => ({ em, key: `${em}-${idx}` }));
  }, [cat.icon]);

  return (
    <div className="space-y-3 mb-3">
      <div>
        <span className="block text-xs text-light-dim dark:text-dark-dim mb-1.5">
          Kategoriya
        </span>
        <div className="flex flex-wrap gap-1.5">
          {TASK_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCategory(c.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                category === c.id
                  ? 'border-transparent text-white'
                  : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 text-light-dim'
              }`}
              style={
                category === c.id ? { backgroundColor: c.color } : undefined
              }
            >
              <span>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-xs text-light-dim dark:text-dark-dim mb-1.5">
          Ikonka
        </span>
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1 rounded-xl bg-black/5 dark:bg-white/5">
          {iconOptions.map(({ em, key }) => (
            <button
              key={key}
              type="button"
              onClick={() => onIconChange(em)}
              className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center ${
                icon === em
                  ? 'ring-2 ring-light-accent bg-white dark:bg-[#3a3a3c]'
                  : 'hover:bg-black/5'
              }`}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      <label
        className={`flex items-start gap-2 text-sm rounded-xl border border-black/10 dark:border-white/10 px-3 py-2.5 ${
          lockMacDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <input
          type="checkbox"
          checked={Boolean(lockMac)}
          disabled={lockMacDisabled}
          onChange={(e) => onLockMacChange(e.target.checked)}
          className="rounded mt-0.5"
        />
        <span>
          <span className="font-medium">Macni qulflash</span>
          <span className="block text-[11px] text-light-dim dark:text-dark-dim mt-0.5">
            {lockMacDisabled
              ? 'Pomodoro rejimida dam olishda Mac avtomatik qulflanadi.'
              : "Fokus paytida to'liq ekran qulfi — vaqt tugaguncha ochib bo'lmaydi."}
            {projectMacLock && !lockMacDisabled && (
              <span className="block text-violet-600 dark:text-violet-300 mt-1">
                Loyihada ham Mac qulfi yoqilgan.
              </span>
            )}
          </span>
        </span>
      </label>

      <div>
        <span className="block text-xs text-light-dim dark:text-dark-dim mb-1">
          Bloklanadigan saytlar
        </span>
        <form onSubmit={addSite} className="flex gap-2 mb-2">
          <input
            type="text"
            value={siteInput}
            onChange={(e) => setSiteInput(e.target.value)}
            onBlur={commitSiteInput}
            placeholder="youtube.com"
            className="flex-1 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-xl bg-black/10 dark:bg-white/15 text-xs font-medium"
          >
            Qo&apos;shish
          </button>
        </form>
        {sites.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {sites.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10"
              >
                {d}
                <button
                  type="button"
                  onClick={() => removeSite(d)}
                  className="opacity-60 hover:opacity-100"
                  aria-label={`${d} olib tashlash`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <span className="block text-xs text-light-dim dark:text-dark-dim mb-1">
          Bloklanadigan ilovalar (papkalar bo&apos;yicha)
        </span>
        <AppFolderPicker
          apps={search.trim() ? filtered : apps}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          selectedSet={selectedSet}
          onToggle={toggleApp}
          maxHeightClass="max-h-40"
        />
      </div>
    </div>
  );
}
