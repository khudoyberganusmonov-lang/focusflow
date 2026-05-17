const { app, dialog } = require('electron');

let autoUpdater = null;
let initDone = false;

function getUpdater() {
  if (autoUpdater !== null) return autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch {
    autoUpdater = false;
  }
  return autoUpdater;
}

function init() {
  const updater = getUpdater();
  if (!updater || initDone) return;
  initDone = true;

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;

  updater.on('update-available', (info) => {
    console.log('[updater] available:', info?.version);
  });

  updater.on('update-not-available', () => {
    console.log('[updater] current');
  });

  updater.on('error', (err) => {
    console.warn('[updater]', err?.message || err);
  });

  updater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'FocusFlow yangilandi',
        message: 'Yangi versiya yuklandi. O‘rnatish uchun ilovani qayta ishga tushiring.',
        buttons: ['Hozir qayta ishga tushirish', 'Keyinroq'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          updater.quitAndInstall(false, true);
        }
      })
      .catch(() => {});
  });
}

/**
 * @param {{ manual?: boolean }} [opts]
 */
async function checkForUpdates(opts = {}) {
  const manual = opts.manual === true;
  const updater = getUpdater();

  if (!updater) {
    return { ok: false, message: 'electron-updater o‘rnatilmagan' };
  }

  if (!app.isPackaged) {
    return {
      ok: true,
      status: 'dev',
      message: manual
        ? 'Dev rejimida avtomatik yangilash yo‘q. DMG build qiling.'
        : 'dev',
    };
  }

  init();

  try {
    const result = await updater.checkForUpdates();
    const ver = result?.updateInfo?.version;

    if (ver && ver !== app.getVersion()) {
      await updater.downloadUpdate();
      return {
        ok: true,
        status: 'downloading',
        version: ver,
        message: `Yangi versiya ${ver} yuklanmoqda…`,
      };
    }

    return {
      ok: true,
      status: 'current',
      message: manual ? 'Siz eng so‘nggi versiyadasiz.' : 'current',
    };
  } catch (err) {
    return {
      ok: false,
      status: 'error',
      message: err?.message || 'Yangilashni tekshirib bo‘lmadi',
    };
  }
}

module.exports = {
  init,
  checkForUpdates,
};
