import { useState, useEffect, useRef, useMemo } from 'react';
import TaskTimeField from './TaskTimeField';
import TaskWeekdayPicker from './TaskWeekdayPicker';
import TaskCategoryFields from './TaskCategoryFields';
import TaskPomodoroFields from './TaskPomodoroFields';
import { normalizeTime24h } from '../utils/taskTime';
import { normalizeRepeatDays } from '../utils/taskRepeat';
import { getCategoryById } from '../constants/taskCategories';

export default function AddTaskForm({
  open,
  onClose,
  onSubmit,
  projectName,
  projects = [],
  projectId,
  onProjectChange,
  initialValues = null,
  title: formTitle = 'Yangi vazifa',
  submitLabel = "Qo'shish",
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);
  const [dueToday, setDueToday] = useState(true);
  const [repeatDays, setRepeatDays] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState('boshqa');
  const [icon, setIcon] = useState('✨');
  const [blockedApps, setBlockedApps] = useState([]);
  const [blockedSites, setBlockedSites] = useState([]);
  const [lockMac, setLockMac] = useState(false);
  const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
  const [pomodoroWork, setPomodoroWork] = useState(25);
  const [pomodoroBreak, setPomodoroBreak] = useState(5);
  const [saving, setSaving] = useState(false);
  const startTimeRef = useRef(null);
  const endTimeRef = useRef(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  // Faqat forma ochilganda yoki boshqa vazifa tahrirlanganda to'ldiriladi —
  // initialValues obyekt referensi o'zgasa ham yozayotgan ma'lumot o'chmaydi.
  useEffect(() => {
    if (!open) return;
    if (initialValues?.id) {
      const today = new Date().toISOString().split('T')[0];
      setTitle(initialValues.title || '');
      setPriority(initialValues.priority ?? 2);
      setDueToday(
        initialValues.dueToday ??
          (initialValues.due_date === today || !initialValues.due_date)
      );
      setRepeatDays(normalizeRepeatDays(initialValues.repeat_days || []));
      setStartTime(normalizeTime24h(initialValues.start_time || ''));
      setEndTime(normalizeTime24h(initialValues.end_time || ''));
      const cat = initialValues.category || 'boshqa';
      setCategory(cat);
      setIcon(
        initialValues.icon || getCategoryById(cat)?.icon || '✨'
      );
      setBlockedApps(initialValues.blocked_apps || []);
      setBlockedSites(initialValues.blocked_sites || []);
      setLockMac(Boolean(initialValues.lock_mac));
      setPomodoroEnabled(Boolean(initialValues.pomodoro_enabled));
      setPomodoroWork(initialValues.pomodoro_work_minutes ?? 25);
      setPomodoroBreak(initialValues.pomodoro_break_minutes ?? 5);
    } else {
      setTitle('');
      setPriority(2);
      setDueToday(true);
      setRepeatDays([]);
      setStartTime('');
      setEndTime('');
      setCategory('boshqa');
      setIcon('✨');
      setBlockedApps([]);
      setBlockedSites([]);
      setLockMac(false);
      setPomodoroEnabled(false);
      setPomodoroWork(25);
      setPomodoroBreak(5);
    }
  }, [open, initialValues?.id]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    if (!projectId && projects.length > 0) return;

    const start =
      startTimeRef.current?.commit?.() ?? normalizeTime24h(startTime);
    const end = endTimeRef.current?.commit?.() ?? normalizeTime24h(endTime);
    const days = normalizeRepeatDays(repeatDays);
    const today = new Date().toISOString().split('T')[0];

    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        priority: Number(priority),
        due_date: days.length > 0 ? null : dueToday ? today : null,
        repeat_days: days.length > 0 ? days : null,
        start_time: start || null,
        end_time: end || null,
        category,
        icon,
        blocked_apps: blockedApps,
        blocked_sites: blockedSites,
        lock_mac: pomodoroEnabled ? 0 : lockMac ? 1 : 0,
        pomodoro_enabled: pomodoroEnabled ? 1 : 0,
        pomodoro_work_minutes: pomodoroWork,
        pomodoro_break_minutes: pomodoroBreak,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const showProjectPicker = projects.length > 0 && onProjectChange;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 dark:bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <form
        className="w-full max-w-md mx-4 p-5 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-xl border border-black/10 dark:border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="text-lg font-semibold mb-1">{formTitle}</h3>
        {showProjectPicker ? (
          <>
            <label className="block text-xs text-light-dim dark:text-dark-dim mb-1">
              Loyiha
            </label>
            <select
              value={projectId || ''}
              onChange={(e) => onProjectChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm mb-3"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          projectName && (
            <p className="text-xs text-light-dim dark:text-dark-dim mb-4">
              {projectName}
            </p>
          )
        )}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vazifa nomi..."
          autoFocus
          className="w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent mb-3"
        />
        <div className="grid grid-cols-2 gap-2 mb-3">
          <TaskTimeField
            ref={startTimeRef}
            id="task-start-time"
            label="Boshlanish (ixtiyoriy)"
            value={startTime}
            onChange={setStartTime}
            syncToParent
          />
          <TaskTimeField
            ref={endTimeRef}
            id="task-end-time"
            label="Tugash (ixtiyoriy)"
            value={endTime}
            onChange={setEndTime}
            syncToParent
          />
        </div>
        <TaskPomodoroFields
          enabled={pomodoroEnabled}
          onEnabledChange={(v) => {
            setPomodoroEnabled(v);
            if (v) setLockMac(false);
          }}
          workMinutes={pomodoroWork}
          onWorkMinutesChange={setPomodoroWork}
          breakMinutes={pomodoroBreak}
          onBreakMinutesChange={setPomodoroBreak}
          startTime={startTime}
          endTime={endTime}
        />
        <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dueToday}
            disabled={repeatDays.length > 0}
            onChange={(e) => setDueToday(e.target.checked)}
            className="rounded"
          />
          <span className={repeatDays.length > 0 ? 'opacity-50' : ''}>
            Bugungi muddat (bir marta)
          </span>
        </label>
        <TaskWeekdayPicker value={repeatDays} onChange={setRepeatDays} />
        <TaskCategoryFields
          category={category}
          onCategoryChange={setCategory}
          icon={icon}
          onIconChange={setIcon}
          blockedApps={blockedApps}
          onBlockedAppsChange={setBlockedApps}
          blockedSites={blockedSites}
          onBlockedSitesChange={setBlockedSites}
          lockMac={lockMac}
          onLockMacChange={setLockMac}
          projectMacLock={Boolean(selectedProject?.mac_lock)}
          lockMacDisabled={pomodoroEnabled}
        />
        <label className="block text-xs text-light-dim dark:text-dark-dim mb-1">
          Prioritet
        </label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm mb-4"
        >
          <option value={1}>Yuqori</option>
          <option value={2}>O&apos;rta</option>
          <option value={3}>Past</option>
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm font-medium"
          >
            Bekor
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving || (projects.length > 0 && !projectId)}
            className="flex-1 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-medium disabled:opacity-40"
          >
            {saving ? '...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
