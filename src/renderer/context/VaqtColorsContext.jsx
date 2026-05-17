import { createContext, useCallback, useContext, useMemo } from 'react';
import { useSettings } from './SettingsContext';
import {
  DEFAULT_VAQT_CATEGORY_COLORS,
  mergeCategoryMeta,
  tintBg,
} from '../utils/vaqtFormat';

const VaqtColorsContext = createContext(null);

export function VaqtColorsProvider({ children }) {
  const { settings, updateSetting } = useSettings();

  const categoryMeta = useMemo(
    () => mergeCategoryMeta(settings?.vaqtCategoryColors),
    [settings?.vaqtCategoryColors]
  );

  const setCategoryColor = useCallback(
    async (key, color) => {
      const prev = settings?.vaqtCategoryColors || {};
      const next = { ...DEFAULT_VAQT_CATEGORY_COLORS, ...prev };
      next[key] = { color, bg: tintBg(color) };
      await updateSetting('vaqtCategoryColors', next);
    },
    [settings?.vaqtCategoryColors, updateSetting]
  );

  const resetColors = useCallback(async () => {
    await updateSetting('vaqtCategoryColors', null);
  }, [updateSetting]);

  return (
    <VaqtColorsContext.Provider value={{ categoryMeta, setCategoryColor, resetColors }}>
      {children}
    </VaqtColorsContext.Provider>
  );
}

export function useVaqtColors() {
  const ctx = useContext(VaqtColorsContext);
  if (!ctx) {
    return {
      categoryMeta: mergeCategoryMeta(null),
      setCategoryColor: async () => {},
      resetColors: async () => {},
    };
  }
  return ctx;
}
