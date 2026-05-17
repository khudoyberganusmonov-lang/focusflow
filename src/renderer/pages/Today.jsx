import { useEffect, useState, useMemo } from 'react';
import TaskCard from '../components/TaskCard';
import AddTaskForm from '../components/AddTaskForm';
import { formatDuration } from '../utils/format';
import { sortTasksByStartTime, isTaskActiveNow } from '../utils/taskTime';
import { useSettings } from '../context/SettingsContext';
import DailyGreetingCard from '../components/DailyGreetingCard';

export default function Today({
  onStartFocus,
  focusState,
  dailyGreeting,
  onDismissDailyGreeting,
}) {
  const { t, settings } = useSettings();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [addProjectId, setAddProjectId] = useState(null);
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [todayTasks, allProjects, morning] = await Promise.all([
      window.focusflow.tasks.getToday(),
      window.focusflow.projects.getAll(),
      window.focusflow.tasks.morningSummary(),
    ]);
    setTasks(todayTasks);
    setProjects(allProjects);
    setSummary(morning);
    if (!addProjectId && allProjects[0]) setAddProjectId(allProjects[0].id);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (settings?.todayAutoSchedule != null) {
      setAutoSchedule(Boolean(settings.todayAutoSchedule));
    }
  }, [settings?.todayAutoSchedule]);

  const handleAutoScheduleChange = async (checked) => {
    setAutoSchedule(checked);
    if (window.focusflow?.settings?.setAll) {
      await window.focusflow.settings.setAll({ todayAutoSchedule: checked });
    }
  };

  const loadAiSuggestions = async () => {
    if (
      !settings?.hasAnthropicApiKey ||
      settings?.aiFeatures?.taskSuggestions === false ||
      !window.focusflow?.ai?.suggestTasks
    ) {
      return;
    }
    const projectId =
      tasks[0]?.project_id || focusState?.projectId || projects[0]?.id;
    if (!projectId) return;

    setAiSuggestionsLoading(true);
    try {
      const res = await window.focusflow.ai.suggestTasks(projectId);
      if (res && !res.error && res.tasks?.length) {
        setAiSuggestions(res.tasks.slice(0, 3).map((t) => ({ ...t, projectId })));
      } else {
        setAiSuggestions([]);
      }
    } catch {
      setAiSuggestions([]);
    } finally {
      setAiSuggestionsLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      const key = task.project_id;
      if (!map[key]) {
        map[key] = {
          project_id: task.project_id,
          project_name: task.project_name,
          project_color: task.project_color,
          tasks: [],
        };
      }
      map[key].tasks.push(task);
    }
    for (const g of Object.values(map)) {
      g.tasks = sortTasksByStartTime(g.tasks);
    }
    return Object.values(map);
  }, [tasks]);

  const handleToggle = async (id) => {
    await window.focusflow.tasks.toggle(id);
    load();
  };

  const handleStartFocus = () => {
    const task = tasks.find((t) => t.id === selectedTaskId) || tasks[0];
    if (task) {
      onStartFocus({ projectId: task.project_id, taskId: task.id });
      return;
    }
    const project = projects[0];
    if (project) onStartFocus({ projectId: project.id });
  };

  const openAddTask = (projectId) => {
    setEditingTask(null);
    setAddProjectId(projectId || projects[0]?.id);
    setShowAddTask(true);
  };

  const openEditTask = (task, e) => {
    e?.stopPropagation?.();
    setEditingTask(task);
    setAddProjectId(task.project_id || projects[0]?.id);
    setShowAddTask(true);
  };

  const closeTaskForm = () => {
    setShowAddTask(false);
    setEditingTask(null);
  };

  const handleSaveTask = async (data) => {
    const pid = addProjectId || projects[0]?.id;
    if (!pid) return;
    if (editingTask) {
      await window.focusflow.tasks.update({
        ...editingTask,
        ...data,
        project_id: pid,
      });
    } else {
      await window.focusflow.tasks.create({
        project_id: pid,
        ...data,
        status: 'today',
      });
    }
    closeTaskForm();
    load();
  };

  const addAiSuggestion = async (suggestion) => {
    const projectId = suggestion.projectId || projects[0]?.id;
    if (!projectId) return;
    await window.focusflow.tasks.create({
      project_id: projectId,
      title: suggestion.title,
      status: 'today',
      priority: 2,
    });
    setAiSuggestions((prev) => prev.filter((s) => s.title !== suggestion.title));
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-light-dim text-sm pt-12">
        {t('today.loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <header className="px-5 pt-12 pb-3 shrink-0">
        <h1 className="text-2xl font-semibold">{t('today.title')}</h1>
        <p className="text-sm text-light-dim dark:text-dark-dim mt-0.5">
          {new Date().toLocaleDateString('uz-UZ', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </header>

      {dailyGreeting && (
        <DailyGreetingCard
          greeting={dailyGreeting}
          onDismiss={onDismissDailyGreeting}
        />
      )}

      {summary && (
        <div className="mx-5 mb-4 p-4 rounded-2xl bg-light-accent/10 dark:bg-dark-accent/15 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold">{summary.taskCount}</p>
            <p className="text-[10px] text-light-dim">vazifa</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {formatDuration(summary.trackedSeconds)}
            </p>
            <p className="text-[10px] text-light-dim">kuzatilgan</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{summary.blockedSites}</p>
            <p className="text-[10px] text-light-dim">blok sayt</p>
          </div>
        </div>
      )}

      <div className="mx-5 mb-3 p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20">
        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={autoSchedule}
            onChange={(e) => handleAutoScheduleChange(e.target.checked)}
            className="rounded mt-0.5"
          />
          <span>
            <span className="font-medium">Vazifalar avtomatik ishlaydi</span>
            <span className="block text-[11px] text-light-dim dark:text-dark-dim mt-0.5">
              Vaqt kelganda tegishli vazifaga fokus boshlanadi (dam olish — Mac
              qulfi, ishlash — oddiy fokus).
            </span>
          </span>
        </label>
      </div>

      <div className="px-5 pb-2 flex justify-end">
        <button
          type="button"
          onClick={() => openAddTask()}
          className="w-9 h-9 rounded-full bg-light-accent dark:bg-dark-accent text-white text-xl flex items-center justify-center"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-28">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-light-dim">
            <p className="text-sm mb-3">Bugun hech narsa yo&apos;q</p>
            <button
              type="button"
              onClick={() => openAddTask()}
              className="text-sm text-light-accent font-medium"
            >
              + Vazifa qo&apos;shish
            </button>
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.project_id} className="mb-5">
              <div className="flex items-center justify-between px-2 mb-2">
                <h2 className="text-xs font-semibold uppercase text-light-dim">
                  {group.project_name}
                </h2>
                <button
                  type="button"
                  onClick={() => openAddTask(group.project_id)}
                  className="text-light-accent text-lg"
                >
                  +
                </button>
              </div>
              <div className="space-y-0.5">
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    onDoubleClick={(e) => openEditTask(task, e)}
                    className="cursor-pointer group relative"
                  >
                    <TaskCard
                      task={task}
                      onToggle={handleToggle}
                      highlighted={
                        selectedTaskId === task.id ||
                        focusState?.taskId === task.id
                      }
                      scheduleActive={
                        focusState?.scheduledNow && focusState?.taskId === task.id
                          ? true
                          : isTaskActiveNow(task)
                      }
                    />
                    <button
                      type="button"
                      onClick={(e) => openEditTask(task, e)}
                      className="absolute right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[10px] px-2 py-1 rounded-lg bg-black/10 dark:bg-white/15 font-medium z-10"
                    >
                      Tahrir
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {settings?.hasAnthropicApiKey && settings?.aiFeatures?.taskSuggestions !== false && (
          <section className="mt-6 px-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase text-light-dim">
                {t('today.aiSuggestions')}
              </h2>
              <button
                type="button"
                disabled={aiSuggestionsLoading || !projects.length}
                onClick={loadAiSuggestions}
                className="text-xs px-3 py-1 rounded-lg bg-light-accent dark:bg-dark-accent text-white disabled:opacity-50"
              >
                {aiSuggestionsLoading ? 'Yuklanmoqda...' : 'Tavsiya olish'}
              </button>
            </div>
            {aiSuggestionsLoading ? (
              <p className="text-xs text-light-dim px-2">Yuklanmoqda...</p>
            ) : aiSuggestions.length > 0 ? (
              <div className="space-y-2">
                {aiSuggestions.map((s, i) => (
                  <div
                    key={`${s.title}-${i}`}
                    className="flex items-center gap-2 p-3 rounded-xl bg-light-accent/5 dark:bg-dark-accent/10"
                  >
                    <p className="flex-1 text-sm">{s.title}</p>
                    <button
                      type="button"
                      onClick={() => addAiSuggestion(s)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-light-accent dark:bg-dark-accent text-white shrink-0"
                    >
                      {t('today.add')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-light-dim px-2">
                Tavsiyalar uchun &quot;Tavsiya olish&quot; tugmasini bosing.
              </p>
            )}
          </section>
        )}
      </div>

      {!focusState && projects.length > 0 && (
        <div className="absolute bottom-4 left-0 right-0 px-5">
          <button
            type="button"
            onClick={handleStartFocus}
            className="w-full py-3.5 rounded-2xl bg-light-accent dark:bg-dark-accent text-white font-semibold shadow-lg"
          >
            {t('today.startFocus')}
          </button>
        </div>
      )}

      <AddTaskForm
        open={showAddTask}
        onClose={closeTaskForm}
        onSubmit={handleSaveTask}
        projects={projects}
        projectId={addProjectId}
        onProjectChange={setAddProjectId}
        initialValues={editingTask}
        formTitle={editingTask ? 'Vazifani tahrirlash' : 'Yangi vazifa'}
        submitLabel={editingTask ? 'Saqlash' : "Qo'shish"}
      />
    </div>
  );
}
