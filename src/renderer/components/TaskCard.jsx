import { formatTaskTimeRange, isTaskActiveNow } from '../utils/taskTime';
import { formatRepeatDaysLabel } from '../utils/taskRepeat';
import { getCategoryById } from '../constants/taskCategories';

const PRIORITY_COLORS = {
  1: 'bg-red-500',
  2: 'bg-orange-400',
  3: 'bg-yellow-400',
};

export default function TaskCard({
  task,
  onToggle,
  highlighted,
  scheduleActive,
}) {
  const timeRange = formatTaskTimeRange(task);
  const repeatLabel = formatRepeatDaysLabel(task.repeat_days);
  const isNow = scheduleActive ?? isTaskActiveNow(task);
  const cat = getCategoryById(task.category);
  const taskIcon = task.icon || cat?.icon;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease ${
        highlighted || isNow
          ? 'bg-light-accent/10 dark:bg-dark-accent/20 ring-1 ring-light-accent dark:ring-dark-accent'
          : 'hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task.id);
        }}
        className="w-5 h-5 rounded-full border-2 border-light-dim dark:border-dark-dim flex items-center justify-center shrink-0 hover:border-light-accent dark:hover:border-dark-accent transition-colors duration-200"
        aria-label="Bajarildi"
      />
      {taskIcon && (
        <span className="text-lg shrink-0 pointer-events-none" aria-hidden>
          {taskIcon}
        </span>
      )}
      <div className="flex-1 min-w-0 pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{task.title}</p>
          {isNow && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 shrink-0">
              Hozir aktiv
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {timeRange && (
            <span className="text-[11px] text-light-dim dark:text-dark-dim tabular-nums">
              {timeRange}
            </span>
          )}
          {repeatLabel && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-light-dim">
              {repeatLabel}
            </span>
          )}
          {task.project_name && (
            <span
              className="inline-block text-[11px] px-2 py-0.5 rounded-full text-white/90"
              style={{ backgroundColor: task.project_color || '#8E8E93' }}
            >
              {task.project_name}
            </span>
          )}
        </div>
      </div>
      <span
        className={`w-2 h-2 rounded-full shrink-0 pointer-events-none ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS[2]}`}
        title={`Prioritet ${task.priority}`}
      />
    </div>
  );
}
