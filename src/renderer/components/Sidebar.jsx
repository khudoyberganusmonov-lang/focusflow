import { useSettings } from '../context/SettingsContext';

export default function Sidebar({ activeTab, onTabChange }) {
  const { t } = useSettings();

  const tabs = [
    { id: 'today', label: t('nav.today'), icon: '☀️' },
    { id: 'tasks', label: t('nav.tasks'), icon: '✓' },
    { id: 'time', label: t('nav.time'), icon: '⏱' },
    { id: 'blocker', label: t('nav.blocker'), icon: '🛡' },
    { id: 'ai', label: t('nav.ai'), icon: '🤖' },
    { id: 'settings', label: t('nav.settings'), icon: '⚙️' },
  ];

  return (
    <nav className="no-drag px-0.5 py-2 flex justify-around">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-all duration-200 min-w-0 ${
            activeTab === tab.id
              ? 'text-light-accent dark:text-dark-accent'
              : 'text-light-dim dark:text-dark-dim'
          }`}
        >
          <span className="text-sm leading-none">{tab.icon}</span>
          <span className="text-[8px] font-medium truncate max-w-[52px]">
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
