import NOTIFICATION_SOUND_CATALOG from '../../shared/notificationSoundCatalog.data.json';

const USER_SOUND_KEYS = new Set([
  'taskApproach5',
  'taskStarted',
  'taskEnded',
  'breakModeApproach5',
  'pomodoroBreak',
  'blockedYoutube',
  'blockedTelegram',
  'blockedChrome',
  'blockedApp',
  'pomodoroWork',
  'macLockUyIshlari',
  'macLockSport',
  'breakModeEnded',
  'longBreakStarted',
  'longBreakEnded',
  'sedentaryWarn',
]);

function basename(p) {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

function SoundRow({ soundKey, label, fileHint, soundPath, notifyOn, lang, onRefresh }) {
  const hasFile = Boolean(soundPath);

  const pick = async () => {
    const res = await window.focusflow.notifications.pickSound(soundKey);
    if (res?.ok) onRefresh();
  };

  const test = async () => {
    const res = await window.focusflow.notifications.testSound(soundKey);
    if (!res?.ok && res?.error) window.alert(res.error);
  };

  const clear = async () => {
    await window.focusflow.notifications.clearSound(soundKey);
    onRefresh();
  };

  return (
    <div
      className={`flex flex-col gap-2 border-b border-[#E5E5EA] px-4 py-3 last:border-b-0 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between ${
        !notifyOn ? 'opacity-60' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {fileHint ? (
          <div className="text-[10px] text-light-dim/80 dark:text-dark-dim/80 mt-0.5 font-mono">
            {fileHint}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <span
          className={`max-w-[120px] truncate text-[11px] ${
            hasFile
              ? 'text-light-accent dark:text-dark-accent'
              : 'text-light-dim dark:text-dark-dim'
          }`}
          title={soundPath || (lang === 'uz' ? 'Standart ovoz' : 'Default sound')}
        >
          {hasFile ? basename(soundPath) : lang === 'uz' ? 'Standart' : 'Default'}
        </span>
        <button
          type="button"
          onClick={pick}
          className="rounded-lg bg-black/5 px-2.5 py-1 text-[11px] font-medium dark:bg-white/10"
        >
          {lang === 'uz' ? 'Tanlash' : 'Choose'}
        </button>
        {hasFile ? (
          <>
            <button
              type="button"
              onClick={test}
              className="rounded-lg bg-light-accent/15 px-2.5 py-1 text-[11px] font-medium text-light-accent dark:bg-dark-accent/20 dark:text-dark-accent"
            >
              {lang === 'uz' ? 'Sinash' : 'Test'}
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-lg px-2 py-1 text-[11px] text-light-dim dark:text-dark-dim"
            >
              ✕
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function NotificationSoundsSection({ settings, lang, onRefresh }) {
  const sounds = settings.notificationSounds || {};
  const notif = settings.notifications || {};

  const rows = NOTIFICATION_SOUND_CATALOG.filter((d) => USER_SOUND_KEYS.has(d.key));

  return (
    <div className="mt-2 rounded-xl border border-dashed border-[#E5E5EA] dark:border-white/15 overflow-hidden">
      <div className="px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.03]">
        <p className="text-xs font-semibold text-light-text dark:text-dark-text">
          {lang === 'uz' ? 'Bildirishnoma ovozlari (15 ta)' : 'Notification sounds (15)'}
        </p>
        <p className="text-[11px] text-light-dim dark:text-dark-dim mt-0.5">
          {lang === 'uz'
            ? 'Har bir qator uchun mp3/wav/m4a tanlang.'
            : 'Pick audio per row.'}
        </p>
      </div>
      {rows.map((def) => (
        <SoundRow
          key={def.key}
          soundKey={def.key}
          label={lang === 'uz' ? def.labelUz : def.labelEn}
          fileHint={def.fileHint}
          soundPath={sounds[def.key]}
          notifyOn={notif[def.notifyKey] !== false}
          lang={lang}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
