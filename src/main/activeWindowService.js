const { appMatchesProject } = require('../shared/sedentaryLogic.cjs');

let activeWinModule = null;

function loadModule() {
  if (activeWinModule !== null) return activeWinModule;
  try {
    activeWinModule = require('active-win');
  } catch (err) {
    console.warn('[activeWindow] load:', err.message);
    activeWinModule = false;
  }
  return activeWinModule;
}

/**
 * @returns {Promise<{ title: string, appName: string, bundleId: string|null }|null>}
 */
async function getActiveWindow() {
  const mod = loadModule();
  if (!mod) return null;
  try {
    const win = await mod({
      accessibilityPermission: true,
      screenRecordingPermission: false,
    });
    if (!win) return null;
    const appName =
      win.owner?.name || win.app || win.title || '';
    return {
      title: win.title || '',
      appName: String(appName),
      bundleId: win.owner?.bundleId || null,
    };
  } catch (err) {
    console.warn('[activeWindow] get:', err.message);
    return null;
  }
}

module.exports = {
  getActiveWindow,
  appMatchesProject,
};
