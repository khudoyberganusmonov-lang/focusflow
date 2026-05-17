const NOTIFICATION_SOUND_CATALOG = require('./notificationSoundCatalog.data.json');

const SOUND_KEYS = NOTIFICATION_SOUND_CATALOG.map((d) => d.key);

function defaultNotificationSounds() {
  return Object.fromEntries(SOUND_KEYS.map((k) => [k, '']));
}

/** App nomi, process yoki domen (youtube.com) bo‘yicha ovoz kaliti */
function resolveBlockedAppSoundKey(target) {
  const n = String(target || '').toLowerCase();
  if (
    n.includes('youtube') ||
    n.includes('youtu.be') ||
    n.includes('ytimg') ||
    n.includes('googlevideo')
  ) {
    return 'blockedYoutube';
  }
  if (n.includes('telegram') || n.includes('t.me') || n.includes('tdesktop')) {
    return 'blockedTelegram';
  }
  if (
    n.includes('chrome') ||
    n.includes('chromium') ||
    n.includes('brave') ||
    n.includes('edg/')
  ) {
    return 'blockedChrome';
  }
  return 'blockedApp';
}

/** @type {Record<string, { title: string, bodyApp: string, bodySite?: (host: string) => string }>} */
const BLOCKED_APP_NOTIFICATIONS = {
  blockedYoutube: {
    title: 'YouTube bloklandi',
    bodyApp: 'Fokus vaqti — video ko‘rish mumkin emas.',
    bodySite: (host) => `${host} fokus paytida yopiq. YouTube ochilmaydi.`,
  },
  blockedTelegram: {
    title: 'Telegram bloklandi',
    bodyApp:
      'Fokus paytida Telegram ochilmaydi. Xabarlarni sessiya tugagach ko‘rasiz.',
    bodySite: (host) =>
      `Telegram (${host}) fokus paytida bloklangan. Hozir vazifaga qayting.`,
  },
  blockedChrome: {
    title: 'Google Chrome bloklandi',
    bodyApp:
      'Fokus paytida Chrome ishlatilmaydi. Brauzer yopildi — vazifangizni davom eting.',
    bodySite: (host) => `${host} Chrome orqali ochilmaydi (fokus rejimi).`,
  },
  blockedApp: {
    title: 'FocusFlow — bloklandi',
    bodyApp: 'Bu ilova fokus paytida bloklangan.',
    bodySite: (host) => `${host} fokus paytida bloklangan.`,
  },
};

/**
 * @param {string} target — ilova nomi, process yoki domen
 * @param {{ isSite?: boolean, label?: string }} [opts]
 */
function getBlockedAppNotification(target, opts = {}) {
  const soundKey = resolveBlockedAppSoundKey(target);
  const def =
    BLOCKED_APP_NOTIFICATIONS[soundKey] || BLOCKED_APP_NOTIFICATIONS.blockedApp;
  const label = String(opts.label || target || 'Ilova').trim();

  if (opts.isSite) {
    const host = String(target || '')
      .replace(/^www\./, '')
      .split('/')[0];
    const body = def.bodySite
      ? def.bodySite(host)
      : BLOCKED_APP_NOTIFICATIONS.blockedApp.bodySite(host);
    return { soundKey, title: def.title, body };
  }

  let body = def.bodyApp;
  if (soundKey === 'blockedApp' && label) {
    body = `${label} fokus paytida bloklandi.`;
  }

  return { soundKey, title: def.title, body };
}

function isDamOlishCategory(category) {
  return category === 'dam_olish';
}

function isUyIshlariCategory(category) {
  return category === 'uy_ishlari';
}

function isSportCategory(category) {
  return category === 'sport';
}

module.exports = {
  NOTIFICATION_SOUND_CATALOG,
  SOUND_KEYS,
  defaultNotificationSounds,
  resolveBlockedAppSoundKey,
  getBlockedAppNotification,
  BLOCKED_APP_NOTIFICATIONS,
  isDamOlishCategory,
  isUyIshlariCategory,
  isSportCategory,
};
