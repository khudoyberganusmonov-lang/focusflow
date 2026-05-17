const fs = require('fs');
const path = require('path');
const { app, nativeTheme } = require('electron');
const { getDb, isDatabaseReady } = require('./database');

const CONFIG_KEY = 'app_config';
const KEY_ANTHROPIC = 'anthropic_api_key';
const KEY_OPENAI = 'openai_api_key';
const KEY_DAILY_GREETING = 'daily_greeting_shown_date';

const DEFAULTS = {
  anthropicApiKey: '',
  openaiApiKey: '',
  language: 'uz',
  theme: 'system',
  focusDuration: 25,
  todayAutoSchedule: false,
  focusGuard: {
    /** Force Quit dan keyin ilovani qayta ochish */
    autoRelaunch: true,
  },
  sedentaryWatch: {
    enabled: false,
    /** Faqat shu loyiha focusida kamera ishlaydi */
    projectId: null,
    warnAfterMinutes: 60,
    checkIntervalSeconds: 20,
    awayResetMinutes: 3,
    testMode: false,
  },
  shortBreak: 5,
  longBreak: 15,
  notifications: {
    focusCoach: true,
    taskReminders: true,
    sessionEnd: true,
    blockedApp: true,
  },
  notificationSounds: (() => {
    try {
      return require('../shared/notificationSoundCatalog.cjs').defaultNotificationSounds();
    } catch {
      return {};
    }
  })(),
  aiFeatures: {
    morningGreeting: true,
    eveningSummary: true,
    taskSuggestions: true,
    focusCoach: true,
    focusCoachInterval: 25,
    sessionAnalysis: true,
    dayPlan: true,
  },
  blocker: {
    strength: 'strict',
    killDelay: 2,
    checkInterval: 2,
  },
  vaqtCategoryColors: null,
};

const STRENGTH_PRESETS = {
  soft: { killDelay: 999999, checkInterval: 2 },
  moderate: { killDelay: 10, checkInterval: 2 },
  strict: { killDelay: 2, checkInterval: 2 },
};

let cache = null;

function dbReady() {
  return isDatabaseReady();
}

function readSettingRow(key) {
  if (!dbReady()) return null;
  try {
    const row = getDb()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key);
    return row?.value ?? null;
  } catch (err) {
    console.warn('[settings] read failed:', key, err.message);
    return null;
  }
}

function writeSettingRow(key, value) {
  if (!dbReady()) return;
  try {
    getDb()
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(key, value ?? '');
  } catch (err) {
    console.warn('[settings] write failed:', key, err.message);
  }
}

function readConfigFromDb() {
  const raw = readSettingRow(CONFIG_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfigToDb(configWithoutKeys) {
  writeSettingRow(CONFIG_KEY, JSON.stringify(configWithoutKeys));
}

function stripKeys(obj) {
  const { anthropicApiKey, openaiApiKey, ...rest } = obj;
  return rest;
}

function assembleSettings() {
  const config = readConfigFromDb();
  const merged = deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), config);
  merged.anthropicApiKey = readSettingRow(KEY_ANTHROPIC) || '';
  merged.openaiApiKey = readSettingRow(KEY_OPENAI) || '';
  return merged;
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source || {})) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      out[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

function setByPath(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function persist(settings) {
  cache = { ...settings };
  if (!dbReady()) return;
  writeSettingRow(KEY_ANTHROPIC, settings.anthropicApiKey || '');
  writeSettingRow(KEY_OPENAI, settings.openaiApiKey || '');
  writeConfigToDb(stripKeys(settings));
}

function migrateFromJsonFile() {
  try {
    const file = path.join(app.getPath('userData'), 'settings.json');
    if (!fs.existsSync(file)) return;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const merged = deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), raw);
    persist(merged);
    fs.renameSync(file, `${file}.migrated`);
  } catch (err) {
    console.warn('[settings] JSON migration skipped:', err.message);
  }
}

function load() {
  if (cache) return cache;
  if (!dbReady()) {
    cache = JSON.parse(JSON.stringify(DEFAULTS));
    return cache;
  }
  cache = assembleSettings();
  return cache;
}

function getSettings() {
  if (!dbReady()) return load();
  cache = assembleSettings();
  return cache;
}

function set(key, value) {
  const current = getSettings();
  if (key === 'anthropicApiKey') {
    current.anthropicApiKey = value;
  } else if (key === 'openaiApiKey') {
    current.openaiApiKey = value;
  } else if (key.includes('.')) {
    setByPath(current, key, value);
  } else {
    current[key] = value;
  }
  if (key === 'blocker.strength' || key === 'blocker') {
    applyBlockerStrength(current.blocker?.strength || 'strict', current);
  }
  if (key === 'theme') {
    applyTheme(value);
  }
  persist(current);
  notifySettingsChanged();
  if (String(key).startsWith('focusGuard')) {
    try {
      require('./relaunchService').syncFromSettings();
    } catch (err) {
      console.warn('[settings] focusGuard:', err.message);
    }
  }
  if (String(key).startsWith('sedentaryWatch')) {
    try {
      require('./sedentaryMonitor').refreshFromSettings();
    } catch (err) {
      console.warn('[settings] sedentaryWatch:', err.message);
    }
  }
  return getSettings();
}

function setAll(partial) {
  const current = deepMerge(getSettings(), partial);
  if (partial.blocker?.strength) {
    applyBlockerStrength(partial.blocker.strength, current);
  } else if (partial.blocker) {
    applyBlockerStrength(current.blocker.strength, current);
  }
  if (partial.theme) {
    applyTheme(partial.theme);
  }
  persist(current);
  notifySettingsChanged();
  if (partial.focusGuard) {
    try {
      require('./relaunchService').syncFromSettings();
    } catch (err) {
      console.warn('[settings] focusGuard:', err.message);
    }
  }
  if (partial.sedentaryWatch) {
    try {
      require('./sedentaryMonitor').refreshFromSettings();
    } catch (err) {
      console.warn('[settings] sedentaryWatch:', err.message);
    }
  }
  return getSettings();
}

function applyBlockerStrength(strength, settings = null) {
  const preset = STRENGTH_PRESETS[strength] || STRENGTH_PRESETS.strict;
  const s = settings || getSettings();
  if (!s.blocker) s.blocker = { ...DEFAULTS.blocker };
  s.blocker.strength = strength;
  s.blocker.killDelay = preset.killDelay;
  s.blocker.checkInterval = preset.checkInterval;
  return s;
}

function applyTheme(theme) {
  const mode = theme || getSettings().theme || 'system';
  nativeTheme.themeSource =
    mode === 'light' || mode === 'dark' ? mode : 'system';
}

function shouldNotify(type) {
  const n = getSettings().notifications || {};
  return n[type] !== false;
}

function getAiFeatures() {
  const s = getSettings();
  const defaults = DEFAULTS.aiFeatures;
  return deepMerge(JSON.parse(JSON.stringify(defaults)), s.aiFeatures || {});
}

function isAiFeatureEnabled(key) {
  const features = getAiFeatures();
  return features[key] !== false;
}

function getFocusCoachIntervalMinutes() {
  const interval = Number(getAiFeatures().focusCoachInterval) || 25;
  if ([15, 25, 45].includes(interval)) return interval;
  return 25;
}

function todayDateStr() {
  return new Date().toISOString().split('T')[0];
}

function getDailyGreetingShownDate() {
  return readSettingRow(KEY_DAILY_GREETING) || '';
}

function wasDailyGreetingShownToday() {
  return getDailyGreetingShownDate() === todayDateStr();
}

function markDailyGreetingShownToday() {
  writeSettingRow(KEY_DAILY_GREETING, todayDateStr());
}

function getAnthropicApiKey() {
  if (dbReady()) {
    const key = (readSettingRow(KEY_ANTHROPIC) || '').trim();
    if (key) return key;
  }
  const s = cache || load();
  const fromCache = (s.anthropicApiKey || '').trim();
  return fromCache || null;
}

function getOpenaiApiKey() {
  if (!dbReady()) return null;
  const key = (readSettingRow(KEY_OPENAI) || '').trim();
  return key || null;
}

function hasAnthropicApiKey() {
  const key = getAnthropicApiKey();
  if (key) return true;
  const s = cache || load();
  return Boolean((s.anthropicApiKey || '').trim());
}

function maskForRenderer(s) {
  return {
    ...s,
    anthropicApiKey: s.anthropicApiKey ? '••••••••' : '',
    openaiApiKey: s.openaiApiKey ? '••••••••' : '',
    hasAnthropicApiKey: Boolean(s.anthropicApiKey),
    hasOpenaiApiKey: Boolean(s.openaiApiKey),
  };
}

function notifySettingsChanged() {
  try {
    const { BrowserWindow } = require('electron');
    const masked = maskForRenderer(getSettings());
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('settings:changed', masked);
      }
    }
    nativeTheme.emit?.('updated');
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('theme:changed');
      }
    }
  } catch {
    /* app not ready */
  }
}

async function testApiKey(type, key) {
  const trimmed = (key || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'API key bo\'sh' };
  }

  if (type === 'anthropic') {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: trimmed });
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Anthropic xatolik' };
    }
  }

  if (type === 'openai') {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { ok: false, error: body || `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'OpenAI xatolik' };
    }
  }

  return { ok: false, error: 'Noma\'lum API turi' };
}

function init() {
  try {
    if (!dbReady()) {
      cache = load();
      applyBlockerStrength(cache.blocker?.strength || 'strict', cache);
      applyTheme(cache.theme);
      return;
    }
    migrateFromJsonFile();
    cache = assembleSettings();
    applyBlockerStrength(cache.blocker?.strength || 'strict', cache);
    persist(cache);
    applyTheme(cache.theme);
  } catch (err) {
    console.error('[settings] init failed:', err.message);
    cache = JSON.parse(JSON.stringify(DEFAULTS));
    applyTheme(cache.theme);
  }
}

module.exports = {
  DEFAULTS,
  init,
  getSettings,
  set,
  setAll,
  applyTheme,
  applyBlockerStrength,
  shouldNotify,
  getAiFeatures,
  isAiFeatureEnabled,
  getFocusCoachIntervalMinutes,
  getAnthropicApiKey,
  getOpenaiApiKey,
  hasAnthropicApiKey,
  getDailyGreetingShownDate,
  wasDailyGreetingShownToday,
  markDailyGreetingShownToday,
  testApiKey,
  maskForRenderer,
};
