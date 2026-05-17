import { useEffect, useState, useCallback, useRef } from 'react';
import TaskCard from '../components/TaskCard';
import TaskTimeField from '../components/TaskTimeField';
import TaskWeekdayPicker from '../components/TaskWeekdayPicker';
import TaskCategoryFields from '../components/TaskCategoryFields';
import TaskPomodoroFields from '../components/TaskPomodoroFields';
import {
  sortTasksByStartTime,
  isTaskActiveNow,
  normalizeTime24h,
} from '../utils/taskTime';
import { normalizeRepeatDays } from '../utils/taskRepeat';

const SECTIONS = [
  { id: 'inbox', label: 'Kiruvchi' },
  { id: 'today', label: 'Bugun' },
  { id: 'upcoming', label: 'Yaqinlashib' },
  { id: 'someday', label: 'Bir kun' },
  { id: 'projects', label: 'Loyihalar' },
];

const PRIORITY_COLORS = { 1: 'bg-red-500', 2: 'bg-orange-400', 3: 'bg-yellow-400' };

export default function Tasks({ onStartFocus, focusState }) {
  const [section, setSection] = useState('today');
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [quickAdd, setQuickAdd] = useState(false);
  const startTimeRef = useRef(null);
  const endTimeRef = useRef(null);

  const loadTasks = useCallback(async () => {
    let list = [];
    if (section === 'today') list = await window.focusflow.tasks.getToday();
    else if (section === 'upcoming') list = await window.focusflow.tasks.getUpcoming();
    else if (section === 'projects' && selectedProject) {
      list = await window.focusflow.tasks.getByProject(selectedProject);
    } else if (section !== 'projects') {
      list = await window.focusflow.tasks.getByStatus(section);
    }
    setTasks(sortTasksByStartTime(list));
  }, [section, selectedProject]);

  useEffect(() => {
    window.focusflow.projects.getAll().then(setProjects);
    window.focusflow.areas.getAll().then(setAreas);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (selectedTask) {
      window.focusflow.checklist.get(selectedTask.id).then(setChecklist);
    }
  }, [selectedTask]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && selectedTask) {
        e.preventDefault();
        handleComplete(selectedTask.id);
      }
      if (e.key === 'n' && !e.metaKey) {
        setQuickAdd(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedTask]);

  const handleComplete = async (id) => {
    await window.focusflow.tasks.complete(id);
    if (selectedTask?.id === id) setSelectedTask(null);
    loadTasks();
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await window.focusflow.tasks.create({
      title: newTitle.trim(),
      status: section === 'projects' ? 'today' : section,
      project_id: selectedProject || projects[0]?.id,
      due_date:
        section === 'today'
          ? new Date().toISOString().split('T')[0]
          : null,
    });
    setNewTitle('');
    setQuickAdd(false);
    loadTasks();
  };

  const saveTask = async (updates) => {
    await window.focusflow.tasks.update({ ...selectedTask, ...updates });
    const t = await window.focusflow.tasks.getOne(selectedTask.id);
    setSelectedTask(t);
    loadTasks();
  };

  const updateTaskTime = (field, value) => {
    if (!selectedTask) return;
    const normalized = normalizeTime24h(value);
    setSelectedTask({ ...selectedTask, [field]: normalized });
    saveTask({
      start_time:
        field === 'start_time' ? normalized || null : normalizeTime24h(selectedTask.start_time) || null,
      end_time:
        field === 'end_time' ? normalized || null : normalizeTime24h(selectedTask.end_time) || null,
    });
  };

  const grouped =
    section === 'today'
      ? tasks.reduce((acc, t) => {
          const k = t.project_name || 'Boshqa';
          if (!acc[k]) acc[k] = [];
          acc[k].push(t);
          return acc;
        }, {})
      : null;

  const groupedSorted = grouped
    ? Object.fromEntries(
        Object.entries(grouped).map(([k, items]) => [k, sortTasksByStartTime(items)])
      )
    : null;

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-44 shrink-0 border-r border-black/5 dark:border-white/10 pt-12 overflow-y-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSection(s.id);
              setSelectedProject(null);
            }}
            className={`w-full text-left px-4 py-2 text-sm ${
              section === s.id
                ? 'bg-light-accent/10 text-light-accent dark:text-dark-accent font-medium'
                : 'text-light-dim hover:bg-black/5'
            }`}
          >
            {s.label}
          </button>
        ))}
        {section === 'projects' && (
          <div className="mt-2 border-t border-black/5 pt-2">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProject(p.id)}
                className={`w-full text-left px-4 py-1.5 text-xs truncate ${
                  selectedProject === p.id ? 'text-light-accent font-medium' : ''
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-4 pt-12 pb-2 flex items-center justify-between shrink-0">
          <h1 className="text-xl font-semibold">Vazifalar</h1>
          <button
            type="button"
            onClick={() => setQuickAdd(true)}
            className="w-8 h-8 rounded-full bg-light-accent dark:bg-dark-accent text-white text-lg"
          >
            +
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {quickAdd && (
            <form onSubmit={handleQuickAdd} className="mb-3 flex gap-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Yangi vazifa..."
                className="flex-1 px-3 py-2 rounded-xl bg-black/5 text-sm"
              />
              <button type="submit" className="px-3 py-2 rounded-xl bg-light-accent text-white text-sm">
                OK
              </button>
            </form>
          )}

          {groupedSorted ? (
            Object.entries(groupedSorted).map(([name, items]) => (
              <section key={name} className="mb-4">
                <h2 className="text-xs uppercase text-light-dim px-2 mb-1">{name}</h2>
                {items.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`mb-0.5 cursor-pointer rounded-xl transition-opacity ${
                      selectedTask?.id === task.id ? 'ring-1 ring-light-accent' : ''
                    } ${task._completing ? 'opacity-40' : ''}`}
                  >
                    <TaskCard
                      task={task}
                      onToggle={handleComplete}
                      scheduleActive={isTaskActiveNow(task)}
                    />
                  </div>
                ))}
              </section>
            ))
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`mb-0.5 cursor-pointer rounded-xl ${
                  selectedTask?.id === task.id ? 'ring-1 ring-light-accent' : ''
                }`}
              >
                <TaskCard
                  task={task}
                  onToggle={handleComplete}
                  scheduleActive={isTaskActiveNow(task)}
                />
              </div>
            ))
          )}

          {tasks.length === 0 && (
            <p className="text-center text-sm text-light-dim py-8">Vazifa yo&apos;q</p>
          )}
        </div>
      </div>

      {selectedTask && (
        <aside className="w-64 shrink-0 border-l border-black/5 dark:border-white/10 pt-12 px-4 overflow-y-auto hidden md:block">
          <input
            value={selectedTask.title}
            onChange={(e) => setSelectedTask({ ...selectedTask, title: e.target.value })}
            onBlur={() => saveTask({ title: selectedTask.title })}
            className="w-full text-lg font-semibold bg-transparent outline-none mb-3"
          />
          <textarea
            value={selectedTask.notes || ''}
            onChange={(e) => setSelectedTask({ ...selectedTask, notes: e.target.value })}
            onBlur={() => saveTask({ notes: selectedTask.notes })}
            placeholder="Eslatmalar..."
            className="w-full h-24 text-sm bg-black/5 dark:bg-white/10 rounded-xl p-2 mb-3 resize-none"
          />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <TaskTimeField
              ref={startTimeRef}
              id="task-detail-start"
              label="Boshlanish"
              value={selectedTask.start_time}
              onChange={(v) => updateTaskTime('start_time', v)}
            />
            <TaskTimeField
              ref={endTimeRef}
              id="task-detail-end"
              label="Tugash"
              value={selectedTask.end_time}
              onChange={(v) => updateTaskTime('end_time', v)}
            />
          </div>
          <TaskWeekdayPicker
            value={selectedTask.repeat_days || []}
            onChange={(days) => {
              const normalized = normalizeRepeatDays(days);
              setSelectedTask({ ...selectedTask, repeat_days: normalized });
              saveTask({
                repeat_days: normalized.length ? normalized : null,
                due_date: normalized.length ? null : selectedTask.due_date,
              });
            }}
          />
          <TaskCategoryFields
            category={selectedTask.category || 'boshqa'}
            onCategoryChange={(cat) => {
              setSelectedTask({ ...selectedTask, category: cat });
              saveTask({ category: cat });
            }}
            icon={selectedTask.icon || '✨'}
            onIconChange={(ic) => {
              setSelectedTask({ ...selectedTask, icon: ic });
              saveTask({ icon: ic });
            }}
            blockedApps={selectedTask.blocked_apps || []}
            onBlockedAppsChange={(apps) => {
              setSelectedTask({ ...selectedTask, blocked_apps: apps });
              saveTask({ blocked_apps: apps });
            }}
            blockedSites={selectedTask.blocked_sites || []}
            onBlockedSitesChange={(sites) => {
              setSelectedTask({ ...selectedTask, blocked_sites: sites });
              saveTask({ blocked_sites: sites });
            }}
            lockMac={Boolean(selectedTask.lock_mac)}
            onLockMacChange={(v) => {
              setSelectedTask({ ...selectedTask, lock_mac: v });
              saveTask({ lock_mac: v ? 1 : 0 });
            }}
            projectMacLock={Boolean(
              projects.find((p) => p.id === selectedTask.project_id)?.mac_lock
            )}
            lockMacDisabled={Boolean(selectedTask.pomodoro_enabled)}
          />
          <TaskPomodoroFields
            enabled={Boolean(selectedTask.pomodoro_enabled)}
            onEnabledChange={(v) => {
              setSelectedTask({ ...selectedTask, pomodoro_enabled: v });
              saveTask({ pomodoro_enabled: v ? 1 : 0, lock_mac: v ? 0 : selectedTask.lock_mac });
            }}
            workMinutes={selectedTask.pomodoro_work_minutes ?? 25}
            onWorkMinutesChange={(n) => {
              setSelectedTask({ ...selectedTask, pomodoro_work_minutes: n });
              saveTask({ pomodoro_work_minutes: n });
            }}
            breakMinutes={selectedTask.pomodoro_break_minutes ?? 5}
            onBreakMinutesChange={(n) => {
              setSelectedTask({ ...selectedTask, pomodoro_break_minutes: n });
              saveTask({ pomodoro_break_minutes: n });
            }}
            startTime={selectedTask.start_time}
            endTime={selectedTask.end_time}
          />
          <label className="text-xs text-light-dim">Prioritet (Cmd+1/2/3)</label>
          <div className="flex gap-2 my-2">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => saveTask({ priority: p })}
                className={`w-6 h-6 rounded-full ${PRIORITY_COLORS[p]} ${
                  selectedTask.priority === p ? 'ring-2 ring-offset-2 ring-black/30' : 'opacity-50'
                }`}
              />
            ))}
          </div>
          <h3 className="text-xs font-semibold uppercase text-light-dim mt-4 mb-2">
            Checklist
          </h3>
          {checklist.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm mb-1">
              <input
                type="checkbox"
                checked={!!c.done}
                onChange={() => window.focusflow.checklist.toggle(c.id).then(() => window.focusflow.checklist.get(selectedTask.id).then(setChecklist))}
              />
              <span className={c.done ? 'line-through text-light-dim' : ''}>{c.title}</span>
            </label>
          ))}
          {selectedTask.project_id && onStartFocus && (
            <button
              type="button"
              onClick={() =>
                onStartFocus({
                  projectId: selectedTask.project_id,
                  taskId: selectedTask.id,
                })
              }
              className="mt-4 w-full py-2.5 rounded-xl bg-light-accent text-white text-sm font-medium"
            >
              Fokus boshlash
            </button>
          )}
        </aside>
      )}

    </div>
  );
}
