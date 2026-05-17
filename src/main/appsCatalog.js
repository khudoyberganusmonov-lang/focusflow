const fs = require('fs');
const path = require('path');
const { app, nativeImage } = require('electron');

const APP_DIRS = [
  '/Applications',
  '/System/Applications',
  '/System/Applications/Utilities',
];

const DIR_PRIORITY = {
  '/Applications': 0,
  '/System/Applications': 1,
  '/System/Applications/Utilities': 2,
};

const iconCache = new Map();
let appsCache = null;
let appsCacheTime = 0;
const APPS_CACHE_MS = 60_000;

/** Serialize native getFileIcon calls — parallel calls can SIGTRAP on macOS. */
let iconFetchChain = Promise.resolve();

function queueIconFetch(task) {
  const run = iconFetchChain.then(() => task()).catch(() => null);
  iconFetchChain = run.then(() => undefined, () => undefined);
  return run;
}

function isValidAppEntry(name) {
  if (!name.endsWith('.app')) return false;
  if (name.startsWith('.')) return false;
  return true;
}

function scanAppDirectories() {
  const byKey = new Map();

  for (const dir of APP_DIRS) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    const priority = DIR_PRIORITY[dir] ?? 99;

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.name.endsWith('.app')) continue;
      if (!isValidAppEntry(entry.name)) continue;

      const bundlePath = path.join(dir, entry.name);
      try {
        if (!fs.statSync(bundlePath).isDirectory()) continue;
      } catch {
        continue;
      }

      const appName = entry.name.replace(/\.app$/, '');
      const key = appName.toLowerCase();
      const existing = byKey.get(key);

      if (!existing || priority < existing.priority) {
        byKey.set(key, {
          app_name: appName,
          process_name: appName,
          bundlePath,
          priority,
        });
      }
    }
  }

  return Array.from(byKey.values())
    .map(({ app_name, process_name, bundlePath }) => ({
      app_name,
      process_name,
      bundlePath,
      icon: null,
    }))
    .sort((a, b) => a.app_name.localeCompare(b.app_name, 'uz'));
}

function getAppsList() {
  const now = Date.now();
  if (!appsCache || now - appsCacheTime > APPS_CACHE_MS) {
    appsCache = scanAppDirectories();
    appsCacheTime = now;
  }
  return appsCache;
}

/** Fast list for UI — no native icons (load per-app via getIconForAppName). */
function listInstalledApps() {
  return getAppsList();
}

const pngCache = new Map();

async function getIconPngBuffer(bundlePath) {
  if (!bundlePath) return null;
  if (pngCache.has(bundlePath)) {
    return pngCache.get(bundlePath);
  }

  return queueIconFetch(async () => {
    if (pngCache.has(bundlePath)) {
      return pngCache.get(bundlePath);
    }
    try {
      const image = await app.getFileIcon(bundlePath, { size: 'normal' });
      if (!image || image.isEmpty()) {
        pngCache.set(bundlePath, null);
        iconCache.set(bundlePath, null);
        return null;
      }
      const resized = image.resize({ width: 32, height: 32 });
      const png = resized.toPNG();
      if (!png || !png.length) {
        pngCache.set(bundlePath, null);
        iconCache.set(bundlePath, null);
        return null;
      }
      pngCache.set(bundlePath, png);
      iconCache.set(
        bundlePath,
        `data:image/png;base64,${png.toString('base64')}`
      );
      return png;
    } catch (err) {
      console.warn('[appsCatalog] getFileIcon failed:', bundlePath, err.message);
      pngCache.set(bundlePath, null);
      iconCache.set(bundlePath, null);
      return null;
    }
  });
}

async function getIconDataUrl(bundlePath) {
  if (!bundlePath) return null;
  if (iconCache.has(bundlePath)) {
    return iconCache.get(bundlePath);
  }
  const png = await getIconPngBuffer(bundlePath);
  if (!png) return null;
  return iconCache.get(bundlePath) || null;
}

/** @deprecated Prefer listInstalledApps + lazy getIconForAppName */
async function listInstalledAppsWithIcons() {
  const apps = getAppsList();
  const result = [];
  for (const row of apps) {
    const icon = await getIconDataUrl(row.bundlePath);
    result.push({ ...row, icon });
  }
  return result;
}

function findAppRow(appName) {
  if (!appName) return null;
  const key = String(appName).toLowerCase().trim();
  const list = getAppsList();

  let row = list.find(
    (a) =>
      a.app_name.toLowerCase() === key ||
      a.process_name.toLowerCase() === key
  );
  if (row) return row;

  row = list.find(
    (a) =>
      a.app_name.toLowerCase().includes(key) ||
      key.includes(a.app_name.toLowerCase()) ||
      a.process_name.toLowerCase().includes(key) ||
      key.includes(a.process_name.toLowerCase())
  );
  if (row) return row;

  const noSpaces = key.replace(/\s+/g, '');
  return (
    list.find((a) => a.app_name.toLowerCase().replace(/\s+/g, '') === noSpaces) ||
    null
  );
}

async function getIconForAppName(appName) {
  const appRow = findAppRow(appName);
  if (!appRow) return null;
  return getIconDataUrl(appRow.bundlePath);
}

function clearAppsCache() {
  appsCache = null;
  appsCacheTime = 0;
  iconCache.clear();
  pngCache.clear();
}

module.exports = {
  APP_DIRS,
  scanAppDirectories,
  getAppsList,
  listInstalledApps,
  listInstalledAppsWithIcons,
  getIconPngBuffer,
  getIconDataUrl,
  getIconForAppName,
  findAppRow,
  clearAppsCache,
};
