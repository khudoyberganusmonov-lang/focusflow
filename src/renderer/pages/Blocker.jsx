import { useEffect, useState, useCallback, useMemo } from 'react';
import InstalledAppsList from '../components/InstalledAppsList';
import { useInstalledApps } from '../hooks/useInstalledApps';
import ProjectLockSettingsPanel from '../components/ProjectLockSettingsPanel';

const TABS = [
  { id: 'websites', label: 'Websites' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'apps', label: 'Apps' },
  { id: 'lock', label: 'Fokus qulfi' },
];

const DAY_LABELS = ['Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha', 'Yak'];

const DEFAULT_SCHEDULE_TIMES = {
  start_time: '09:00',
  end_time: '18:00',
  days: [1, 2, 3, 4, 5],
};

function ScheduleJadvalPanel({ title, schedules, formatRow, onRemove, children }) {
  return (
    <section className="mt-8 pt-6 border-t border-black/5 dark:border-white/10">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
      <ul className="space-y-1 mt-4">
        {schedules.length === 0 && (
          <li className="text-sm text-light-dim py-3 text-center">Jadval yo&apos;q</li>
        )}
        {schedules.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]"
          >
            <span className="text-sm">{formatRow(s)}</span>
            <button
              type="button"
              onClick={() => onRemove(s.id)}
              className="text-xs text-red-500 hover:underline shrink-0"
            >
              O&apos;chirish
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function uniqByDomain(rows) {
  const seen = new Set();
  return (rows || []).filter((row) => {
    const key = String(row.domain || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveProjectId(id) {
  if (id == null || id === '') return null;
  const n = Number(id);
  return Number.isNaN(n) ? null : n;
}

export default function Blocker() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(null);
  const [tab, setTab] = useState('websites');
  const [domains, setDomains] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [apps, setApps] = useState([]);
  const {
    filtered: installedApps,
    loading: appsLoading,
    search: appSearch,
    setSearch: setAppSearch,
  } = useInstalledApps();
  const [schedules, setSchedules] = useState([]);
  const [domainInput, setDomainInput] = useState('');
  const [exceptionInput, setExceptionInput] = useState('');
  const [adminOk, setAdminOk] = useState(null);
  const [status, setStatus] = useState(null);
  const [websiteScheduleForm, setWebsiteScheduleForm] = useState({
    domain: 'youtube.com',
    ...DEFAULT_SCHEDULE_TIMES,
  });
  const [appScheduleForm, setAppScheduleForm] = useState({
    process_name: '',
    ...DEFAULT_SCHEDULE_TIMES,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [lockType, setLockType] = useState('timer');
  const [lockTimerMinutes, setLockTimerMinutes] = useState(5);
  const [lockPassword, setLockPassword] = useState('TOXTAMAN');
  const [lockSaving, setLockSaving] = useState(false);

  const loadDomains = useCallback(async (pidOverride) => {
    const pid =
      pidOverride !== undefined ? resolveProjectId(pidOverride) : resolveProjectId(projectId);

    console.log('[blocker] loading sites for project:', pid);

    const config = await window.focusflow.blocker.getConfig(pid);
    const sites = uniqByDomain(config?.domains || []);
    console.log('[blocker] sites loaded:', sites);

    setDomains(sites);
    setExceptions(config?.exceptions || []);
    setApps(config?.apps || []);
  }, [projectId]);

  const loadSchedules = useCallback(async () => {
    try {
      const list = await window.focusflow.blocker.getSchedules();
      console.log('[blocker] schedules loaded:', list);
      setSchedules(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('[blocker] loadSchedules failed:', err);
      setSchedules([]);
    }
  }, []);

  const loadBlockerStatus = useCallback(async () => {
    const st = await window.focusflow.blocker.getStatus();
    setStatus(st);
    setAdminOk(Boolean(st?.adminOk));
  }, []);

  useEffect(() => {
    window.focusflow.projects.getAll().then((projs) => {
      setProjects(projs);
      if (projs.length > 0 && projectId === null) {
        setProjectId(projs[0].id);
      }
    });
    loadBlockerStatus();
  }, [loadBlockerStatus]);

  useEffect(() => {
    if (projectId == null && projects.length === 0) return;
    if (tab === 'websites') {
      loadDomains();
    }
  }, [tab, projectId, projects.length, loadDomains]);

  useEffect(() => {
    if (tab === 'websites' || tab === 'apps') {
      loadSchedules();
    }
  }, [tab, loadSchedules]);

  const selectedProject = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (!selectedProject) return;
    setLockType(selectedProject.stop_lock_type || 'timer');
    setLockTimerMinutes(selectedProject.stop_lock_timer_minutes ?? 5);
    setLockPassword(selectedProject.stop_lock_password || 'TOXTAMAN');
  }, [selectedProject?.id, selectedProject?.stop_lock_type, selectedProject?.stop_lock_timer_minutes, selectedProject?.stop_lock_password]);

  const saveLockSettings = async () => {
    if (!selectedProject) return;
    setLockSaving(true);
    try {
      await window.focusflow.projects.update({
        ...selectedProject,
        stop_lock_type: lockType,
        stop_lock_timer_minutes: Number(lockTimerMinutes) || 5,
        stop_lock_password: lockPassword.trim() || 'TOXTAMAN',
      });
      await loadDomains();
    } finally {
      setLockSaving(false);
    }
  };

  const handleRequestAdmin = async () => {
    console.log('[Blocker] requestAdmin: clicked');
    try {
      const res = await window.focusflow.blocker.requestAdmin();
      console.log('[Blocker] requestAdmin: IPC response', res);
      const ok = res.ok === true || res.adminOk === true;
      setAdminOk(ok);
      await loadDomains();
      await loadBlockerStatus();
      const st = await window.focusflow.blocker.getStatus();
      console.log('[Blocker] requestAdmin: status after load', st);
      setAdminOk(Boolean(st?.adminOk));
    } catch (err) {
      console.error('[Blocker] requestAdmin: error', err);
      setAdminOk(false);
    }
  };

  const addDomain = async (e) => {
    e.preventDefault();
    const domain = domainInput.trim();
    if (!domain) return;

    const pid = resolveProjectId(projectId);
    console.log('[blocker] adding site:', domain, 'project:', pid);

    try {
      const row = await window.focusflow.blocker.addDomain({
        domain,
        projectId: pid,
      });
      console.log('[blocker] addDomain result:', row);
      setDomainInput('');
      await loadDomains(pid);
    } catch (err) {
      console.error('[blocker] addDomain failed:', err);
    }
  };

  const removeDomain = async (id) => {
    const pid = resolveProjectId(projectId);
    await window.focusflow.blocker.removeDomain(id);
    await loadDomains(pid);
  };

  const addException = async (e) => {
    e.preventDefault();
    if (!exceptionInput.trim()) return;
    await window.focusflow.blocker.addException({
      pattern: exceptionInput.trim(),
      projectId: projectId || null,
    });
    setExceptionInput('');
    await loadDomains();
  };

  const toggleApp = async (app, blocked) => {
    if (!projectId) return;
    const row = await window.focusflow.blocker.setAppBlocked({
      app_name: app.app_name,
      process_name: app.process_name,
      blocked,
      projectId,
    });
    setApps((prev) => {
      const filtered = prev.filter(
        (a) =>
          !(
            a.process_name === app.process_name &&
            a.project_id === projectId
          )
      );
      if (row) return [...filtered, row];
      return filtered;
    });
  };

  const isAppBlocked = (processName) => {
    if (!projectId) return false;
    const row = apps.find(
      (a) =>
        a.project_id === projectId &&
        a.process_name === processName &&
        a.is_blocked
    );
    return Boolean(row);
  };

  const websiteSchedules = useMemo(
    () => schedules.filter((s) => s.type !== 'app'),
    [schedules]
  );
  const appSchedules = useMemo(
    () => schedules.filter((s) => s.type === 'app'),
    [schedules]
  );

  const checkedAppsForSchedule = useMemo(
    () =>
      apps.filter(
        (a) =>
          a.project_id === projectId && a.is_blocked && a.process_name
      ),
    [apps, projectId]
  );

  useEffect(() => {
    if (!checkedAppsForSchedule.length) return;
    const stillValid = checkedAppsForSchedule.some(
      (a) => a.process_name === appScheduleForm.process_name
    );
    if (!stillValid) {
      setAppScheduleForm((f) => ({
        ...f,
        process_name: checkedAppsForSchedule[0].process_name,
      }));
    }
  }, [checkedAppsForSchedule, appScheduleForm.process_name]);

  const addWebsiteSchedule = async (e) => {
    e.preventDefault();
    if (scheduleSaving) return;
    const domain = websiteScheduleForm.domain.trim();
    if (!domain) return;

    setScheduleSaving(true);
    try {
      await window.focusflow.blocker.addSchedule({
        type: 'website',
        domain,
        start_time: websiteScheduleForm.start_time,
        end_time: websiteScheduleForm.end_time,
        days: websiteScheduleForm.days,
      });
      await loadSchedules();
    } catch (err) {
      console.error('[blocker] addWebsiteSchedule failed:', err);
    } finally {
      setScheduleSaving(false);
    }
  };

  const addAppSchedule = async (e) => {
    e.preventDefault();
    if (scheduleSaving || !projectId) return;
    const selected = checkedAppsForSchedule.find(
      (a) => a.process_name === appScheduleForm.process_name
    );
    if (!selected) return;

    setScheduleSaving(true);
    try {
      await window.focusflow.blocker.addSchedule({
        type: 'app',
        process_name: selected.process_name,
        app_name: selected.app_name,
        projectId,
        start_time: appScheduleForm.start_time,
        end_time: appScheduleForm.end_time,
        days: appScheduleForm.days,
      });
      await loadSchedules();
    } catch (err) {
      console.error('[blocker] addAppSchedule failed:', err);
    } finally {
      setScheduleSaving(false);
    }
  };

  const removeSchedule = async (id) => {
    await window.focusflow.blocker.removeSchedule(id);
    await loadSchedules();
  };

  const formatScheduleDays = (days) => {
    const list = Array.isArray(days) ? days : [];
    return list.map((d) => DAY_LABELS[d - 1]).filter(Boolean).join(',');
  };

  const formatScheduleRow = (s) => {
    const label = s.type === 'app' ? s.app_name || s.domain : s.domain;
    const days = formatScheduleDays(s.days);
    return `${label} — ${s.start_time}-${s.end_time}${days ? ` — ${days}` : ''}`;
  };

  const toggleWebsiteDay = (d) => {
    setWebsiteScheduleForm((f) => {
      const days = f.days.includes(d)
        ? f.days.filter((x) => x !== d)
        : [...f.days, d].sort();
      return { ...f, days };
    });
  };

  const toggleAppDay = (d) => {
    setAppScheduleForm((f) => {
      const days = f.days.includes(d)
        ? f.days.filter((x) => x !== d)
        : [...f.days, d].sort();
      return { ...f, days };
    });
  };

  const scheduleDayButtons = (selectedDays, onToggle) => (
    <div className="flex gap-1 flex-wrap">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onToggle(d)}
          className={`w-8 h-8 rounded-full text-xs font-medium ${
            selectedDays.includes(d)
              ? 'bg-light-accent dark:bg-dark-accent text-white'
              : 'bg-black/5 dark:bg-white/10'
          }`}
        >
          {DAY_LABELS[d - 1]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-5 pt-12 pb-3 shrink-0">
        <h1 className="text-2xl font-semibold">Bloklash</h1>
        <p className="text-sm text-light-dim dark:text-dark-dim mt-0.5">
          Cold Turkey uslubida — /etc/hosts + ilovalar
        </p>
      </header>

      <div className="px-5 pb-3 flex flex-wrap gap-2 items-center shrink-0">
        <select
          value={projectId ?? ''}
          onChange={(e) =>
            setProjectId(
              e.target.value === '' ? null : Number(e.target.value)
            )
          }
          className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
        >
          <option value="">Global (barcha loyihalar)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleRequestAdmin}
          className="px-3 py-2 rounded-xl text-xs font-medium bg-black/5 dark:bg-white/10 hover:bg-black/10"
        >
          {adminOk ? '✓ Admin' : 'Admin ruxsat'}
        </button>
      </div>

      <div
        className={`mx-5 mb-2 px-3 py-2 rounded-xl text-xs font-medium ${
          adminOk
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-500/10 text-red-600 dark:text-red-400'
        }`}
      >
        {adminOk
          ? 'Admin ruxsat berilgan — saytlar bloklanadi'
          : 'Admin ruxsat berilmagan — saytlar bloklanmaydi'}
      </div>

      {status?.sessionLock && (
        <div className="mx-5 mb-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium">
          🔒 Fokus bloklash faol — vaqt tugaguncha o&apos;chmaydi
        </div>
      )}

      <div className="px-5 flex gap-1 border-b border-black/5 dark:border-white/10 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent'
                : 'border-transparent text-light-dim dark:text-dark-dim'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === 'websites' && (
          <>
            <form onSubmit={addDomain} className="flex gap-2 mb-4">
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="youtube.com"
                className="flex-1 px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-medium"
              >
                Qo&apos;shish
              </button>
            </form>
            <p className="text-xs text-light-dim dark:text-dark-dim mb-3">
              {resolveProjectId(projectId)
                ? `Loyiha: ${selectedProject?.name || projectId} — faqat shu loyiha saytlari`
                : 'Global rejim — barcha loyihalar uchun umumiy saytlar'}
              {' · '}
              youtube.com, www., m. (hosts)
            </p>
            <ul className="space-y-1">
              {domains.length === 0 && (
                <li className="text-sm text-light-dim py-4 text-center">
                  Bloklangan sayt yo&apos;q
                </li>
              )}
              {domains.map((d) => (
                <li
                  key={d.id ?? d.domain}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]"
                >
                  <span className="text-sm font-medium">
                    {d.domain}
                    {d.project_id ? (
                      <span className="ml-2 text-[10px] text-light-dim">loyiha</span>
                    ) : (
                      <span className="ml-2 text-[10px] text-light-dim">global</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDomain(d.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    O&apos;chirish
                  </button>
                </li>
              ))}
            </ul>

            <ScheduleJadvalPanel
              title="Jadval"
              schedules={websiteSchedules}
              formatRow={formatScheduleRow}
              onRemove={removeSchedule}
            >
              <form onSubmit={addWebsiteSchedule} className="space-y-3">
                <input
                  type="text"
                  value={websiteScheduleForm.domain}
                  onChange={(e) =>
                    setWebsiteScheduleForm((f) => ({ ...f, domain: e.target.value }))
                  }
                  placeholder="youtube.com"
                  className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={websiteScheduleForm.start_time}
                    onChange={(e) =>
                      setWebsiteScheduleForm((f) => ({
                        ...f,
                        start_time: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                  />
                  <input
                    type="time"
                    value={websiteScheduleForm.end_time}
                    onChange={(e) =>
                      setWebsiteScheduleForm((f) => ({
                        ...f,
                        end_time: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                  />
                </div>
                {scheduleDayButtons(websiteScheduleForm.days, toggleWebsiteDay)}
                <button
                  type="submit"
                  disabled={scheduleSaving}
                  className="w-full py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-medium disabled:opacity-50"
                >
                  Jadval qo&apos;shish
                </button>
              </form>
            </ScheduleJadvalPanel>
          </>
        )}

        {tab === 'lock' && (
          <ProjectLockSettingsPanel
            projectId={projectId}
            selectedProject={selectedProject}
            lockType={lockType}
            lockTimerMinutes={lockTimerMinutes}
            lockPassword={lockPassword}
            lockSaving={lockSaving}
            onLockTypeChange={setLockType}
            onTimerMinutesChange={setLockTimerMinutes}
            onPasswordChange={setLockPassword}
            onSave={saveLockSettings}
          />
        )}

        {tab === 'exceptions' && (
          <>
            <form onSubmit={addException} className="flex gap-2 mb-4">
              <input
                type="text"
                value={exceptionInput}
                onChange={(e) => setExceptionInput(e.target.value)}
                placeholder="youtube.com/channel/learning"
                className="flex-1 px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm outline-none focus:ring-2 focus:ring-light-accent"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-medium"
              >
                Qo&apos;shish
              </button>
            </form>
            <p className="text-xs text-light-dim dark:text-dark-dim mb-3">
              Istisno: bu URL bloklanmaydi (path bo&apos;yicha)
            </p>
            <ul className="space-y-1">
              {exceptions.length === 0 && (
                <li className="text-sm text-light-dim py-4 text-center">
                  Istisno yo&apos;q
                </li>
              )}
              {exceptions.map((ex) => (
                <li
                  key={ex.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-green-500/10"
                >
                  <span className="text-sm truncate pr-2">{ex.pattern}</span>
                  <button
                    type="button"
                    onClick={() => {
                      window.focusflow.blocker
                        .removeException(ex.id)
                        .then(() => loadDomains());
                    }}
                    className="text-xs text-red-500 shrink-0"
                  >
                    O&apos;chirish
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'apps' && (
          <>
            {!projectId ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                Ilovalarni bloklash uchun yuqoridan loyihani tanlang.
              </p>
            ) : (
              <p className="text-xs text-light-dim dark:text-dark-dim mb-3">
                Fokus paytida bloklangan ilovalar yopiladi
              </p>
            )}
            <InstalledAppsList
              apps={installedApps}
              loading={appsLoading}
              search={appSearch}
              onSearchChange={setAppSearch}
              searchPlaceholder="Ilova qidirish..."
              emptyMessage={
                appSearch.trim()
                  ? "Qidiruv bo'yicha ilova topilmadi"
                  : "Ilova topilmadi"
              }
              renderAction={(app) => {
                const blocked = isAppBlocked(app.process_name);
                return (
                  <label
                    htmlFor={`app-${app.process_name}`}
                    className="flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      id={`app-${app.process_name}`}
                      checked={blocked}
                      disabled={!projectId}
                      onChange={(e) => toggleApp(app, e.target.checked)}
                      className="h-4 w-4 rounded accent-[#007AFF]"
                      aria-label={`${app.app_name} bloklash`}
                    />
                    {blocked && (
                      <span className="text-emerald-600 dark:text-emerald-400 text-sm">
                        ✓
                      </span>
                    )}
                  </label>
                );
              }}
            />

            <ScheduleJadvalPanel
              title="Jadval"
              schedules={appSchedules}
              formatRow={formatScheduleRow}
              onRemove={removeSchedule}
            >
              {!projectId ? (
                <p className="text-xs text-light-dim dark:text-dark-dim mb-3">
                  Jadval uchun avval loyihani tanlang va ilovani belgilang.
                </p>
              ) : checkedAppsForSchedule.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                  Jadval qo&apos;shish uchun kamida bitta ilovani belgilang.
                </p>
              ) : (
                <form onSubmit={addAppSchedule} className="space-y-3">
                  <select
                    value={appScheduleForm.process_name}
                    onChange={(e) =>
                      setAppScheduleForm((f) => ({
                        ...f,
                        process_name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                  >
                    {checkedAppsForSchedule.map((a) => (
                      <option key={a.process_name} value={a.process_name}>
                        {a.app_name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={appScheduleForm.start_time}
                      onChange={(e) =>
                        setAppScheduleForm((f) => ({
                          ...f,
                          start_time: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                    />
                    <input
                      type="time"
                      value={appScheduleForm.end_time}
                      onChange={(e) =>
                        setAppScheduleForm((f) => ({
                          ...f,
                          end_time: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm"
                    />
                  </div>
                  {scheduleDayButtons(appScheduleForm.days, toggleAppDay)}
                  <button
                    type="submit"
                    disabled={scheduleSaving || checkedAppsForSchedule.length === 0}
                    className="w-full py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-medium disabled:opacity-50"
                  >
                    Jadval qo&apos;shish
                  </button>
                </form>
              )}
            </ScheduleJadvalPanel>
          </>
        )}

      </div>
    </div>
  );
}
