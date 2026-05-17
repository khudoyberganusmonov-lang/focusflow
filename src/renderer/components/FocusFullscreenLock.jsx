import { getCategoryById } from '../constants/taskCategories';

export default function FocusFullscreenLock({ focusState }) {
  if (!focusState) return null;

  const mins = Math.floor(focusState.remainingSeconds / 60);
  const secs = focusState.remainingSeconds % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const progress =
    focusState.totalSeconds > 0
      ? 1 - focusState.remainingSeconds / focusState.totalSeconds
      : 0;
  const icon = focusState.taskIcon || getCategoryById(focusState.taskCategory)?.icon || '🔒';
  const isPomodoroBreak = focusState.pomodoro?.enabled && focusState.pomodoro?.phase === 'break';
  const label = isPomodoroBreak
    ? 'Dam olish'
    : focusState.categoryLabel ||
      getCategoryById(focusState.taskCategory)?.label ||
      focusState.taskTitle ||
      'Fokus';

  const circumference = 2 * Math.PI * 88;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81] text-white">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(99,102,241,0.4), transparent 50%), radial-gradient(circle at 70% 80%, rgba(168,85,247,0.35), transparent 45%)',
        }}
      />
      <div className="relative flex flex-col items-center gap-6 px-8 max-w-lg w-full">
        <span className="text-6xl drop-shadow-lg" aria-hidden>
          {icon}
        </span>
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-violet-200/80 mb-1">
            Mac qulflangan
          </p>
          <h1 className="text-2xl font-semibold">{label}</h1>
          {focusState.taskTitle && focusState.taskTitle !== label && (
            <p className="text-sm text-violet-200/70 mt-1">{focusState.taskTitle}</p>
          )}
        </div>

        <div className="relative w-52 h-52">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="10"
            />
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke="url(#lockGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
            <defs>
              <linearGradient id="lockGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          <p className="absolute inset-0 flex items-center justify-center text-5xl font-light tabular-nums tracking-tight">
            {display}
          </p>
        </div>

        <p className="text-center text-sm text-violet-100/80 max-w-xs leading-relaxed">
          {isPomodoroBreak
            ? 'Pomodoro dam olishi. Mac tizim qulfi yoqilgan — vaqt tugaguncha ishga qaytasiz.'
            : "Mac tizim qulfi yoqildi — parol bilan qayta kirsangiz ham vaqt tugaguncha chiqib bo'lmaydi."}
        </p>
        <p className="text-xs text-violet-300/50">{focusState.projectName}</p>
      </div>
    </div>
  );
}
