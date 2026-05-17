import { useEffect, useMemo, useState } from 'react';

const DELAY_SECONDS = 30;

function getFocusElapsedMs(focusState) {
  if (!focusState?.startedAt) return 0;
  const pauseMs = focusState.paused
    ? focusState.accumulatedPause + (Date.now() - focusState.pausedAt)
    : focusState.accumulatedPause || 0;
  return Date.now() - new Date(focusState.startedAt).getTime() - pauseMs;
}

function formatCountdown(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const LOCK_LABELS = {
  none: "Qulf yo'q — istalgan vaqtda to'xtatish",
  timer: 'Vaqt qulfi',
  delay: '30 soniya kechikish',
  password: 'Parol qulfi',
};

export default function FocusStopLockModal({
  focusState,
  quitPending = false,
  onCancel,
  onConfirmStop,
}) {
  const lock = focusState?.stopLock || { type: 'timer', timerMinutes: 5, password: 'TOXTAMAN' };
  const lockType = lock.type || 'timer';

  const [passwordInput, setPasswordInput] = useState('');
  const [delayRemaining, setDelayRemaining] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (lockType !== 'timer') return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [lockType]);

  useEffect(() => {
    if (delayRemaining === null) return undefined;
    if (delayRemaining <= 0) {
      onConfirmStop();
      return undefined;
    }
    const id = setTimeout(() => setDelayRemaining((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [delayRemaining, onConfirmStop]);

  const timerStatus = useMemo(() => {
    if (lockType !== 'timer') return { ready: true, remainingSec: 0 };
    const requiredSec = (lock.timerMinutes ?? 5) * 60;
    const elapsedSec = Math.floor(getFocusElapsedMs(focusState) / 1000);
    const remainingSec = Math.max(0, requiredSec - elapsedSec);
    return { ready: remainingSec <= 0, remainingSec };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockType, lock.timerMinutes, focusState, tick]);

  const passwordOk =
    lockType !== 'password' ||
    passwordInput.trim().toUpperCase() === (lock.password || 'TOXTAMAN').toUpperCase();

  const handleConfirm = () => {
    if (lockType === 'delay' && delayRemaining === null) {
      setDelayRemaining(DELAY_SECONDS);
      return;
    }
    if (lockType === 'timer' && !timerStatus.ready) return;
    if (lockType === 'password' && !passwordOk) return;
    if (delayRemaining !== null) return;
    onConfirmStop();
  };

  const handleCancel = () => {
    if (delayRemaining !== null) {
      setDelayRemaining(null);
      return;
    }
    onCancel();
  };

  const lockDescription = () => {
    switch (lockType) {
      case 'none':
        return "Fokusni darhol to'xtatishingiz mumkin.";
      case 'timer':
        if (timerStatus.ready) {
          return `Minimal ${lock.timerMinutes ?? 5} daqiqa fokus bajarildi. Tasdiqlang.`;
        }
        return `${lock.timerMinutes ?? 5} daqiqa kutishingiz kerak — yana ${formatCountdown(timerStatus.remainingSec)}`;
      case 'delay':
        if (delayRemaining !== null) {
          return `To'xtatish ${delayRemaining} soniyadan keyin — bekor qilish mumkin`;
        }
        return "Tasdiqlangandan keyin 30 soniya kutasiz; shu vaqt ichida bekor qilishingiz mumkin.";
      case 'password':
        return `"${lock.password || 'TOXTAMAN'}" so'zini yozing`;
      default:
        return '';
    }
  };

  const confirmDisabled =
    (lockType === 'timer' && !timerStatus.ready && delayRemaining === null) ||
    (lockType === 'password' && !passwordOk && delayRemaining === null);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleCancel}
    >
      <div
        className="mx-4 p-6 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-xl max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-1">
          {quitPending
            ? 'Chiqish uchun fokusni tugating'
            : "Fokusni to'xtatmoqchimisiz?"}
        </h2>
        <p className="text-xs text-light-dim dark:text-dark-dim mb-4">
          {quitPending
            ? "Qulf tekshiruvidan o'tgach, fokus tugaydi va ilova yopiladi."
            : focusState?.projectName}
        </p>

        <div className="mb-4 px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10">
          <p className="text-xs font-semibold uppercase text-light-dim dark:text-dark-dim mb-1">
            {LOCK_LABELS[lockType] || lockType}
          </p>
          <p className="text-sm">{lockDescription()}</p>
          {lockType === 'timer' && !timerStatus.ready && (
            <p className="text-2xl font-light tabular-nums mt-2 text-center">
              {formatCountdown(timerStatus.remainingSec)}
            </p>
          )}
          {lockType === 'delay' && delayRemaining !== null && (
            <p className="text-2xl font-light tabular-nums mt-2 text-center text-red-500">
              {delayRemaining}s
            </p>
          )}
        </div>

        {lockType === 'password' && delayRemaining === null && (
          <input
            type="text"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder={lock.password || 'TOXTAMAN'}
            className="w-full mb-4 px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent uppercase tracking-wider"
            autoFocus
          />
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-3 rounded-xl bg-black/5 dark:bg-white/10 font-medium"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {lockType === 'delay' && delayRemaining !== null
              ? "To'xtatilmoqda…"
              : 'Tasdiqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
