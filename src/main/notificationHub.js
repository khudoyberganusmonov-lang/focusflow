const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { app, Notification, dialog } = require('electron');
const soundPlayer = require('./soundPlayer');
const settingsService = require('./settingsService');
const {
  SOUND_KEYS,
  defaultNotificationSounds,
  getBlockedAppNotification,
  resolveBlockedAppSoundKey,
} = require('../shared/notificationSoundCatalog.cjs');

const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.aiff', '.aif', '.caf', '.aac']);

/** Asosiy kalit topilmasa, shu zaxira fayllar sinanadi */
const SOUND_KEY_ALIASES = {
  focusStarted: ['focusStarted', 'taskStarted'],
  sessionEnd: ['sessionEnd', 'taskEnded'],
  sedentaryWarn: ['sedentaryWarn', 'breakModeApproach5'],
};

function soundsDir() {
  return path.join(app.getPath('userData'), 'notification-sounds');
}

function ensureSoundsDir() {
  const dir = soundsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function soundKeysToTry(soundKey) {
  const aliases = SOUND_KEY_ALIASES[soundKey];
  if (!aliases) return [soundKey];
  return [...new Set([soundKey, ...aliases])];
}

function getSoundPath(soundKey) {
  const sounds = settingsService.getSettings().notificationSounds || {};

  for (const key of soundKeysToTry(soundKey)) {
    const raw = sounds[key];
    const fromSettings = typeof raw === 'string' ? raw.trim() : '';
    if (fromSettings && fs.existsSync(fromSettings)) return fromSettings;

    try {
      const fallback = path.join(soundsDir(), `${key}.mp3`);
      if (fs.existsSync(fallback)) return fallback;
    } catch {
      /* app not ready */
    }
  }

  return '';
}

function playSound(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    if (soundPlayer.playSound(filePath)) return;
  } catch (err) {
    console.warn('[notificationHub] howler:', err.message);
  }
  try {
    if (process.platform === 'darwin') {
      spawn('afplay', [filePath], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'win32') {
      spawn(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `(New-Object Media.SoundPlayer '${filePath.replace(/'/g, "''")}').PlaySync()`,
        ],
        { detached: true, stdio: 'ignore' }
      ).unref();
    } else {
      spawn('paplay', [filePath], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (err) {
    console.warn('[notificationHub] play:', err.message);
  }
}

/**
 * @param {{ soundKey: string, notifyKey?: string|null, title: string, body: string }} opts
 */
function show(opts) {
  const { soundKey, notifyKey, title, body } = opts;
  const notifyEnabled =
    !notifyKey || settingsService.shouldNotify(notifyKey);

  const custom = getSoundPath(soundKey);
  const hasCustom = Boolean(custom);

  // Ovoz: fayl bo‘lsa har doim (bildirishnoma o‘chiq bo‘lsa ham)
  if (hasCustom) {
    playSound(custom);
  } else {
    console.warn('[notificationHub] ovoz topilmadi:', soundKey);
  }

  if (!notifyEnabled) return;

  if (Notification.isSupported()) {
    new Notification({
      title: title || 'FocusFlow',
      body: body || '',
      silent: hasCustom,
    }).show();
  }
}

function showWithNotifier(notifier, opts) {
  const { soundKey, notifyKey, title, body, icon } = opts;
  if (notifyKey && !settingsService.shouldNotify(notifyKey)) return;

  const custom = getSoundPath(soundKey);
  const hasCustom = Boolean(custom);

  if (notifier?.notify) {
    notifier.notify({
      title: title || 'FocusFlow',
      message: body || '',
      icon,
      sound: hasCustom ? false : true,
    });
  } else {
    show({ soundKey, notifyKey: null, title, body });
    return;
  }

  if (hasCustom) playSound(custom);
}

/**
 * @param {string} matchTarget — tanlash uchun (ilova nomi / domen)
 * @param {{ isSite?: boolean, label?: string }} [opts]
 */
function showBlockedApp(matchTarget, opts = {}) {
  const { soundKey, title, body } = getBlockedAppNotification(matchTarget, opts);
  show({
    soundKey,
    notifyKey: 'blockedApp',
    title,
    body,
  });
}

async function pickSoundFile(soundKey) {
  if (!SOUND_KEYS.includes(soundKey)) {
    return { ok: false, error: 'Noma\'lum ovoz turi' };
  }

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Bildirishnoma ovozini tanlang',
    properties: ['openFile'],
    filters: [
      {
        name: 'Audio',
        extensions: ['mp3', 'wav', 'm4a', 'aiff', 'aif', 'caf', 'aac'],
      },
    ],
  });

  if (canceled || !filePaths?.[0]) {
    return { ok: false, canceled: true };
  }

  const src = filePaths[0];
  const ext = path.extname(src).toLowerCase();
  if (!AUDIO_EXT.has(ext)) {
    return { ok: false, error: 'Faqat audio fayl (mp3, wav, m4a, …)' };
  }

  ensureSoundsDir();
  const dest = path.join(soundsDir(), `${soundKey}${ext}`);
  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    return { ok: false, error: err.message || 'Nusxa olish xatosi' };
  }

  settingsService.set(`notificationSounds.${soundKey}`, dest);
  return { ok: true, path: dest };
}

function clearSound(soundKey) {
  if (!SOUND_KEYS.includes(soundKey)) return { ok: false };
  const current = getSoundPath(soundKey);
  settingsService.set(`notificationSounds.${soundKey}`, '');
  if (current && current.startsWith(soundsDir())) {
    try {
      fs.unlinkSync(current);
    } catch {
      /* ignore */
    }
  }
  return { ok: true };
}

function testSound(soundKey) {
  const p = getSoundPath(soundKey);
  if (!p) return { ok: false, error: 'Ovoz tanlanmagan' };
  playSound(p);
  return { ok: true };
}

module.exports = {
  SOUND_KEYS,
  soundsDir,
  show,
  showWithNotifier,
  showBlockedApp,
  playSound,
  getSoundPath,
  pickSoundFile,
  clearSound,
  testSound,
  resolveBlockedAppSoundKey,
  defaultNotificationSounds,
};
