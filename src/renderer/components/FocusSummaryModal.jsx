import { useSettings } from '../context/SettingsContext';

export default function FocusSummaryModal({ summary, onClose }) {
  const { t } = useSettings();
  if (!summary) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="mx-4 p-6 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-xl max-w-sm w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-2">{t('focus.ended')}</h2>
        <p className="text-sm text-light-dim dark:text-dark-dim mb-4">
          {summary.projectName}
        </p>
        <div className="space-y-2 text-sm mb-4">
          <p>⏱ {summary.durationMinutes} daqiqa fokus</p>
          <p>✅ {summary.tasksCompleted} vazifa bajarildi</p>
          <p>🛡 {summary.distractionsBlocked} chalg&apos;itish bloklandi</p>
        </div>
        {summary.aiInsights && (
          <div className="mb-6 p-3 rounded-xl bg-light-accent/10 dark:bg-dark-accent/15">
            <p className="text-xs font-semibold uppercase text-light-dim mb-2">
              {t('focus.aiAnalysis')}
            </p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {summary.aiInsights}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-light-accent dark:bg-dark-accent text-white font-medium"
        >
          {t('focus.close')}
        </button>
      </div>
    </div>
  );
}
