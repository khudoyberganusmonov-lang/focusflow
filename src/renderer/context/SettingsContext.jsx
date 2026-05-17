import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { t as translate } from '../i18n';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [version, setVersion] = useState('1.0.0');

  const load = useCallback(async () => {
    if (!window.focusflow?.settings?.get) return;
    const [s, v] = await Promise.all([
      window.focusflow.settings.get(),
      window.focusflow.app.getVersion?.() || { version: '1.0.0' },
    ]);
    setSettings(s);
    setVersion(v?.version || '1.0.0');
  }, []);

  useEffect(() => {
    load();
    const unsub = window.focusflow?.settings?.onChange?.((s) => {
      setSettings(s);
    });
    return () => unsub?.();
  }, [load]);

  const updateSetting = useCallback(async (key, value) => {
    const next = await window.focusflow.settings.set(key, value);
    setSettings(next);
    return next;
  }, []);

  const lang = settings?.language || 'uz';

  const t = useCallback((key) => translate(lang, key), [lang]);

  const value = useMemo(
    () => ({
      settings,
      version,
      lang,
      t,
      load,
      updateSetting,
      setSettings,
    }),
    [settings, version, lang, t, load, updateSetting]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
