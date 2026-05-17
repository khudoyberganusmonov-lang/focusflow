import { useEffect, useState } from 'react';
import { LOCK_OPTIONS } from '../utils/projectLock';
import { useInstalledApps } from '../hooks/useInstalledApps';
import AppIcon from './AppIcon';

const PROJECT_COLORS = [
  '#007AFF',
  '#5856D6',
  '#FF9500',
  '#FF3B30',
  '#34C759',
  '#AF52DE',
  '#FF2D55',
  '#5AC8FA',
];

const emptyForm = (areas) => ({
  name: '',
  area_id: areas[0]?.id ?? '',
  color: '#007AFF',
  focus_duration: 60,
  use_focus_duration: false,
  domains: [],
  blockedProcessNames: new Set(),
  stop_lock_type: 'timer',
  stop_lock_timer_minutes: 5,
  stop_lock_password: 'TOXTAMAN',
  mac_lock: false,
});

export default function ProjectFormModal({ open, projectId, areas, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm(areas));
  const [domainInput, setDomainInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const {
    filtered: installedApps,
    loading: appsLoading,
    search: appSearch,
    setSearch: setAppSearch,
  } = useInstalledApps();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (projectId) {
          const detail = await window.focusflow.projects.getOne(projectId);
          if (cancelled || !detail) return;
          const blocked = new Set(
            (detail.blockedApps || []).map((a) => a.process_name)
          );
          setForm({
            name: detail.name || '',
            area_id: detail.area_id,
            color: detail.color || '#007AFF',
            focus_duration: detail.focus_duration || 60,
            use_focus_duration: detail.use_focus_duration !== 0,
            domains: detail.domains?.length
              ? [...detail.domains]
              : detail.block_list || [],
            blockedProcessNames: blocked,
            stop_lock_type: detail.stop_lock_type || 'timer',
            stop_lock_timer_minutes: detail.stop_lock_timer_minutes ?? 5,
            stop_lock_password: detail.stop_lock_password || 'TOXTAMAN',
            mac_lock: Boolean(detail.mac_lock),
          });
        } else {
          setForm(emptyForm(areas));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, areas]);

  if (!open) return null;

  const addDomain = (e) => {
    e?.preventDefault?.();
    const d = domainInput.trim().toLowerCase();
    if (!d || form.domains.includes(d)) return;
    setForm((f) => ({ ...f, domains: [...f.domains, d] }));
    setDomainInput('');
  };

  const removeDomain = (domain) => {
    setForm((f) => ({
      ...f,
      domains: f.domains.filter((x) => x !== domain),
    }));
  };

  const toggleApp = (processName) => {
    setForm((f) => {
      const next = new Set(f.blockedProcessNames);
      if (next.has(processName)) next.delete(processName);
      else next.add(processName);
      return { ...f, blockedProcessNames: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.area_id || saving) return;
    setSaving(true);
    try {
      const blockedApps = installedApps
        .filter((app) => form.blockedProcessNames.has(app.process_name))
        .map((app) => ({
          app_name: app.app_name,
          process_name: app.process_name,
        }));

      await onSave({
        id: projectId || undefined,
        area_id: form.area_id,
        name: form.name.trim(),
        color: form.color,
        focus_duration: Number(form.focus_duration) || 60,
        use_focus_duration: Boolean(form.use_focus_duration),
        domains: form.domains,
        blockedApps,
        stop_lock_type: form.stop_lock_type,
        stop_lock_timer_minutes: Number(form.stop_lock_timer_minutes) || 5,
        stop_lock_password: form.stop_lock_password || 'TOXTAMAN',
        mac_lock: Boolean(form.mac_lock),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="p-5 border-b border-black/5 dark:border-white/10 shrink-0">
          <h3 className="text-lg font-semibold">
            {projectId ? 'Loyihani tahrirlash' : 'Yangi loyiha'}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {loading ? (
            <p className="text-sm text-light-dim text-center py-8">Yuklanmoqda…</p>
          ) : (
            <>
              <label className="block">
                <span className="text-xs text-light-dim">Nomi</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                  required
                />
              </label>

              <label className="block">
                <span className="text-xs text-light-dim">Area</span>
                <select
                  value={form.area_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, area_id: Number(e.target.value) }))
                  }
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-xs text-light-dim">Rang</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-full border-2 ${
                        form.color === c
                          ? 'border-black/40 dark:border-white'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer rounded-xl border border-black/10 dark:border-white/10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={Boolean(form.mac_lock)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mac_lock: e.target.checked }))
                  }
                  className="rounded mt-0.5"
                />
                <span>
                  <span className="font-medium text-xs">Macni qulflash (loyiha)</span>
                  <span className="block text-[11px] text-light-dim mt-0.5">
                    Ushbu loyihadagi barcha vazifalar fokusda Mac qulfini yoqadi
                    (vazifada alohida o&apos;chirish mumkin).
                  </span>
                </span>
              </label>

              <div className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-2.5 space-y-2">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.use_focus_duration)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        use_focus_duration: e.target.checked,
                      }))
                    }
                    className="rounded mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-xs">
                      Loyiha fokus davomiyligi
                    </span>
                    <span className="block text-[11px] text-light-dim mt-0.5">
                      O&apos;chirilsa, fokus vaqti vazifaning boshlanish/tugash
                      vaqtidan olinadi (yoki umumiy sozlamadan).
                    </span>
                  </span>
                </label>
                {form.use_focus_duration && (
                  <label className="block">
                    <span className="text-xs text-light-dim">
                      Fokus davomiyligi (daqiqa)
                    </span>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={form.focus_duration}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, focus_duration: e.target.value }))
                      }
                      className="mt-1 w-24 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm tabular-nums"
                    />
                  </label>
                )}
              </div>

              <div>
                <span className="text-xs text-light-dim">Bloklangan saytlar</span>
                <div className="mt-1 flex gap-2">
                  <input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="youtube.com"
                    className="flex-1 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addDomain(e);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addDomain}
                    className="px-3 py-2 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-xs font-medium"
                  >
                    Qo&apos;shish
                  </button>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {form.domains.map((d) => (
                    <li
                      key={d}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-xs"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => removeDomain(d)}
                        className="text-red-500"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-xs text-light-dim">Bloklangan ilovalar</span>
                <input
                  type="search"
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  placeholder="Ilova qidirish…"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                />
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1 border border-black/5 dark:border-white/10 rounded-xl p-2">
                  {appsLoading ? (
                    <p className="text-xs text-light-dim p-2">Yuklanmoqda…</p>
                  ) : (
                    installedApps.slice(0, 80).map((app) => (
                      <label
                        key={app.process_name}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.blockedProcessNames.has(app.process_name)}
                          onChange={() => toggleApp(app.process_name)}
                        />
                        <AppIcon
                          src={
                            app.icon ||
                            (app.bundlePath &&
                              window.focusflow?.apps?.getIconUrl?.(app.bundlePath))
                          }
                          name={app.app_name}
                          size={20}
                        />
                        <span className="text-xs truncate">{app.app_name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs text-light-dim">Fokus qulfi</span>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {LOCK_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, stop_lock_type: opt.id }))
                      }
                      className={`px-2 py-2 rounded-lg text-xs font-medium ${
                        form.stop_lock_type === opt.id
                          ? 'bg-light-accent dark:bg-dark-accent text-white'
                          : 'bg-black/5 dark:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.stop_lock_type === 'timer' && (
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={form.stop_lock_timer_minutes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        stop_lock_timer_minutes: e.target.value,
                      }))
                    }
                    className="mt-2 w-20 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                  />
                )}
                {form.stop_lock_type === 'password' && (
                  <input
                    value={form.stop_lock_password}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        stop_lock_password: e.target.value.toUpperCase(),
                      }))
                    }
                    className="mt-2 w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm uppercase"
                    placeholder="TOXTAMAN"
                  />
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-black/5 dark:border-white/10 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm font-medium"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="flex-1 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </form>
    </div>
  );
}
