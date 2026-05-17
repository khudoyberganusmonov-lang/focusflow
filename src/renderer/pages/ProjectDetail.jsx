import { useEffect, useState } from 'react';
import TaskCard from '../components/TaskCard';
import AddTaskForm from '../components/AddTaskForm';
import { formatProjectFocusMeta } from '../utils/projectLock';

export default function ProjectDetail({
  project,
  onBack,
  onStartFocus,
  focusState,
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);

  const load = async () => {
    setLoading(true);
    const list = await window.focusflow.tasks.getByProject(project.id);
    setTasks(list.filter((t) => t.status !== 'done'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [project.id]);

  const handleToggle = async (id) => {
    await window.focusflow.tasks.toggle(id);
    load();
  };

  const handleAddTask = async (data) => {
    await window.focusflow.tasks.create({
      project_id: project.id,
      ...data,
      status: 'todo',
    });
    load();
  };

  const handleStartFocus = () => {
    const taskId = selectedTaskId || tasks[0]?.id || null;
    onStartFocus({ projectId: project.id, taskId });
  };

  return (
    <div className="flex flex-col h-full relative">
      <header className="px-5 pt-12 pb-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-light-accent dark:text-dark-accent mb-2 hover:opacity-80"
        >
          ← Orqaga
        </button>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <h1 className="text-2xl font-semibold">{project.name}</h1>
        </div>
        <p className="text-sm text-light-dim dark:text-dark-dim mt-1">
          {formatProjectFocusMeta(project)}
        </p>
        {project.block_list?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.block_list.map((site) => (
              <span
                key={site}
                className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500"
              >
                🚫 {site}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="px-5 pb-2 flex items-center justify-between shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-light-dim dark:text-dark-dim">
          Vazifalar
        </h2>
        <button
          type="button"
          onClick={() => setShowAddTask(true)}
          className="w-8 h-8 rounded-full bg-light-accent dark:bg-dark-accent text-white text-lg leading-none flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
          aria-label="Vazifa qo'shish"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-28">
        {loading ? (
          <p className="text-sm text-light-dim text-center py-8">Yuklanmoqda...</p>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-light-dim dark:text-dark-dim">
            <p className="text-sm mb-3">Vazifa yo'q</p>
            <button
              type="button"
              onClick={() => setShowAddTask(true)}
              className="text-sm text-light-accent dark:text-dark-accent font-medium"
            >
              + Birinchi vazifani qo'shing
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className="cursor-pointer"
              >
                <TaskCard
                  task={{
                    ...task,
                    project_name: project.name,
                    project_color: project.color,
                  }}
                  onToggle={handleToggle}
                  highlighted={
                    selectedTaskId === task.id ||
                    focusState?.taskId === task.id
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {!focusState && (
        <div className="absolute bottom-4 left-0 right-0 px-5">
          <button
            type="button"
            onClick={handleStartFocus}
            className="w-full py-3.5 rounded-2xl bg-light-accent dark:bg-dark-accent text-white font-semibold text-base shadow-lg shadow-blue-500/25 hover:opacity-95 active:scale-[0.98] transition-all"
          >
            Fokus boshlash
          </button>
        </div>
      )}

      <AddTaskForm
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSubmit={handleAddTask}
        projectName={project.name}
      />
    </div>
  );
}
