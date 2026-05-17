import { useEffect, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import SettingsProjectsSection from '../components/SettingsProjectsSection';
import NotificationSoundsSection from '../components/NotificationSoundsSection';
import SedentaryWatchSection from '../components/SedentaryWatchSection';

const ACCENT = '#007AFF';

function EyeIcon({ hidden }) {
  if (hidden) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[rgba(60,60,67,0.6)]">
        <path
          d="M2 8c1.5-3 3.5-4.5 6-4.5S12.5 5 14 8c-1.5 3-3.5 4.5-6 4.5S3.5 11 2 8z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2.5 13.5L13.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[rgba(60,60,67,0.6)]">
      <path
        d="M2 8c1.5-3 3.5-4.5 6-4.5S12.5 5 14 8c-1.5 3-3.5 4.5-6 4.5S3.5 11 2 8z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function StatusBadge({ status, t }) {
  if (status === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgba(48,182,80,0.12)] px-2.5 py-1 text-xs font-semibold text-[#1F8A3A]">
        <span className="text-[11px]">✓</span> {t('settings.connected')}
      </span>
    );
  }
  if (status === false) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgba(255,59,48,0.12)] px-2.5 py-1 text-xs font-semibold text-[#D70015]">
        <span className="text-[11px]">✕</span> {t('settings.error')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgba(120,120,128,0.12)] px-2.5 py-1 text-xs font-semibold text-[rgba(60,60,67,0.6)]">
      {t('settings.notTested')}
    </span>
  );
}

function Section({ icon, title, children, id }) {
  return (
    <div className="mb-[22px]" id={id}>
      <div className="flex items-center gap-2 mx-1 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.6px] text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.6)]">
        <span className="text-sm normal-case tracking-normal">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:border-white/10 dark:bg-[#2C2C2E]">
        {children}
      </div>
    </div>
  );
}

function Row({ children, last }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 min-h-[44px] px-4 py-3.5 ${
        last ? '' : 'border-b border-[#E5E5EA] dark:border-white/10'
      }`}
    >
      {children}
    </div>
  );
}

function RowLabel({ title, sub }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[13px] font-medium text-[#1D1D1F] dark:text-white">{title}</div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.55)]">
          {sub}
        </div>
      )}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-[9px] bg-[rgba(120,120,128,0.12)] p-0.5 dark:bg-white/10">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 rounded-[7px] border-none px-3.5 py-1.5 text-[13px] leading-snug transition-all duration-150 ${
              active
                ? 'bg-white font-semibold text-[#1D1D1F] shadow-[0_3px_8px_rgba(0,0,0,0.06),0_3px_1px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-[#3A3A3C] dark:text-white'
                : 'bg-transparent font-medium text-[#1D1D1F] dark:text-white/80'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function IosToggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full border-none p-0 transition-colors duration-200 ${
        on ? 'bg-[#34C759]' : 'bg-[rgba(120,120,128,0.20)]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-[left] duration-200 ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function Slider({ min, max, value, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative flex h-7 w-[200px] shrink-0 items-center sm:w-[260px]">
      <div className="absolute inset-x-0 h-1 rounded-sm bg-[rgba(120,120,128,0.20)]" />
      <div
        className="absolute left-0 h-1 rounded-sm bg-[#007AFF]"
        style={{ width: `${pct}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 m-0 h-7 w-full cursor-pointer opacity-0"
      />
      <div
        className="pointer-events-none absolute h-7 w-7 rounded-full bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.10),0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.06)]"
        style={{ left: `calc(${pct}% - 14px)` }}
      />
    </div>
  );
}

function SliderGroup({ value, unit, children }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3.5">
      {children}
      <div className="min-w-[76px] text-right text-[13px] font-semibold tabular-nums text-[#1D1D1F] dark:text-white">
        {value}{' '}
        <span className="font-normal text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.55)]">
          {unit}
        </span>
      </div>
    </div>
  );
}

function ApiKeyRow({
  label,
  placeholder,
  value,
  onChange,
  onSave,
  onTest,
  testResult,
  verifying,
  saveLabel,
  testLabel,
  t,
  last,
}) {
  const [show, setShow] = useState(false);

  return (
    <div
      className={`px-4 py-3.5 ${last ? '' : 'border-b border-[#E5E5EA] dark:border-white/10'}`}
    >
      <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white mb-2">{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-7 min-w-0 flex-[1_1_200px] items-center rounded-[7px] border border-[#E5E5EA] bg-white pl-2.5 pr-1 dark:border-white/15 dark:bg-[#1C1C1E]">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-[#1D1D1F] outline-none dark:text-white placeholder:text-[rgba(60,60,67,0.4)]"
            style={{ letterSpacing: show ? 'normal' : '0.12em' }}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="flex h-6 w-6 shrink-0 items-center justify-center border-none bg-transparent"
            title={show ? 'Hide' : 'Show'}
          >
            <EyeIcon hidden={show} />
          </button>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="h-7 shrink-0 rounded-[7px] border-none bg-[#007AFF] px-3.5 text-xs font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.06)] hover:bg-[#0066d6]"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={verifying}
          className="h-7 shrink-0 rounded-[7px] border-none bg-[#30B650] px-3.5 text-xs font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:cursor-wait disabled:bg-[#86C99A]"
        >
          {verifying ? t('settings.verifying') : testLabel}
        </button>
        <StatusBadge status={testResult} t={t} />
      </div>
    </div>
  );
}

function BlockerCard({ title, desc, detail, icon, accentColor, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[132px] flex-1 flex-col gap-2 rounded-[10px] text-left font-sans transition-all duration-150 ${
        selected
          ? 'border-2 border-[#007AFF] bg-[rgba(0,122,255,0.04)] p-[15px] dark:bg-[rgba(0,122,255,0.12)]'
          : 'border border-[#E5E5EA] bg-white p-4 dark:border-white/10 dark:bg-[#2C2C2E]'
      }`}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg"
        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
      >
        {icon}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-[#1D1D1F] dark:text-white">{title}</span>
        {selected && (
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#007AFF] text-[11px] font-bold text-white">
            ✓
          </span>
        )}
      </div>
      <p className="text-xs leading-snug text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.55)]">
        {desc}
      </p>
      <p className="mt-auto text-[11px] font-medium text-[rgba(60,60,67,0.4)] dark:text-[rgba(235,235,245,0.4)]">
        {detail}
      </p>
    </button>
  );
}

function LinkRow({ icon, label, sub }) {
  return (
    <button
      type="button"
      className="group flex flex-1 items-center gap-2.5 border-none bg-transparent px-3.5 py-3 text-left hover:bg-[rgba(0,122,255,0.06)] dark:hover:bg-white/5"
    >
      <span className="text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-[#1D1D1F] dark:text-white">{label}</div>
        <div className="mt-0.5 text-[11px] text-[rgba(60,60,67,0.6)]">{sub}</div>
      </div>
      <span className="text-xs text-[rgba(60,60,67,0.4)]">›</span>
    </button>
  );
}

function blockerToUi(strength) {
  if (strength === 'moderate') return 'medium';
  if (strength === 'strict') return 'hard';
  return strength || 'hard';
}

function uiToBlocker(ui) {
  if (ui === 'medium') return 'moderate';
  if (ui === 'hard') return 'strict';
  return ui;
}

export default function Settings() {
  const { settings, version, t, updateSetting, setSettings } = useSettings();
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicSaved, setAnthropicSaved] = useState(false);
  const [openaiSaved, setOpenaiSaved] = useState(false);
  const [anthropicTest, setAnthropicTest] = useState(null);
  const [openaiTest, setOpenaiTest] = useState(null);
  const [anthropicVerifying, setAnthropicVerifying] = useState(false);
  const [openaiVerifying, setOpenaiVerifying] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setAnthropicSaved(!!settings.anthropicApiKey && settings.anthropicApiKey.includes('•'));
    setOpenaiSaved(!!settings.openaiApiKey && settings.openaiApiKey.includes('•'));
  }, [settings]);

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F5F5F7] pt-12 text-sm text-[rgba(60,60,67,0.6)] dark:bg-[#1C1C1E]">
        …
      </div>
    );
  }

  const saveAnthropic = async () => {
    if (!anthropicKey.trim()) return;
    await updateSetting('anthropicApiKey', anthropicKey.trim());
    setAnthropicKey('');
    setAnthropicSaved(true);
    setAnthropicTest(null);
  };

  const saveOpenai = async () => {
    if (!openaiKey.trim()) return;
    await updateSetting('openaiApiKey', openaiKey.trim());
    setOpenaiKey('');
    setOpenaiSaved(true);
    setOpenaiTest(null);
  };

  const testAnthropic = async () => {
    setAnthropicVerifying(true);
    setAnthropicTest(null);
    try {
      const res = await window.focusflow.settings.testApiKey('anthropic', anthropicKey);
      setAnthropicTest(res.ok);
    } catch {
      setAnthropicTest(false);
    } finally {
      setAnthropicVerifying(false);
    }
  };

  const testOpenai = async () => {
    setOpenaiVerifying(true);
    setOpenaiTest(null);
    try {
      const res = await window.focusflow.settings.testApiKey('openai', openaiKey);
      setOpenaiTest(res.ok);
    } catch {
      setOpenaiTest(false);
    } finally {
      setOpenaiVerifying(false);
    }
  };

  const patch = async (key, value) => {
    const next = await updateSetting(key, value);
    setSettings(next);
  };

  const patchNotif = async (key, value) => {
    await patch(`notifications.${key}`, value);
  };

  const patchAi = async (key, value) => {
    await patch(`aiFeatures.${key}`, value);
  };

  const ai = settings.aiFeatures || {};
  const hasApiKey = Boolean(settings.hasAnthropicApiKey);
  const coachOn = ai.focusCoach !== false;

  const blockerUi = blockerToUi(settings.blocker?.strength);
  const lang = settings.language || 'uz';

  const blockerCards =
    lang === 'en'
      ? [
          {
            id: 'soft',
            title: t('settings.soft'),
            desc: 'Blocks websites only. Apps stay open.',
            detail: 'Website block',
            icon: '🌱',
            color: '#34C759',
          },
          {
            id: 'medium',
            title: t('settings.moderate'),
            desc: 'Websites + apps close after 10 seconds.',
            detail: 'Website + app (10s)',
            icon: '⚖️',
            color: '#FF9500',
          },
          {
            id: 'hard',
            title: t('settings.strict'),
            desc: 'Websites + apps close after 2 seconds.',
            detail: 'Website + app (2s)',
            icon: '🛡️',
            color: ACCENT,
          },
        ]
      : [
          {
            id: 'soft',
            title: t('settings.soft'),
            desc: 'Faqat veb-saytlarni bloklaydi. Ilovalar ochiq qoladi.',
            detail: 'Vebsayt bloki',
            icon: '🌱',
            color: '#34C759',
          },
          {
            id: 'medium',
            title: t('settings.moderate'),
            desc: "Vebsaytlar + ilovalar 10 soniyadan keyin yopiladi.",
            detail: 'Vebsayt + ilova (10s)',
            icon: '⚖️',
            color: '#FF9500',
          },
          {
            id: 'hard',
            title: t('settings.strict'),
            desc: 'Vebsaytlar + ilovalar 2 soniyadan keyin tezkor yopiladi.',
            detail: 'Vebsayt + ilova (2s)',
            icon: '🛡️',
            color: ACCENT,
          },
        ];

  return (
    <div className="flex h-full flex-col bg-[#F5F5F7] dark:bg-[#1C1C1E]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-5 pb-10 pt-7 sm:px-8">
          <header className="mb-7">
            <h1 className="m-0 text-[28px] font-bold tracking-[-0.4px] text-[#1D1D1F] dark:text-white">
              {t('settings.title')}
            </h1>
            <p className="mt-1 text-[13px] text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.55)]">
              {t('settings.subtitle')}
            </p>
          </header>

          <Section icon="📁" title="Loyihalar">
            <SettingsProjectsSection />
          </Section>

          <Section icon="🤖" title={t('settings.ai')} id="ai-api-keys">
            <ApiKeyRow
              label={t('settings.anthropicKey')}
              placeholder={anthropicSaved ? t('settings.saved') : 'sk-ant-...'}
              value={anthropicKey}
              onChange={setAnthropicKey}
              onSave={saveAnthropic}
              onTest={testAnthropic}
              testResult={anthropicTest}
              verifying={anthropicVerifying}
              saveLabel={t('settings.save')}
              testLabel={t('settings.test')}
              t={t}
              last={false}
            />
            <ApiKeyRow
              label={t('settings.openaiKey')}
              placeholder={openaiSaved ? t('settings.saved') : 'sk-proj-...'}
              value={openaiKey}
              onChange={setOpenaiKey}
              onSave={saveOpenai}
              onTest={testOpenai}
              testResult={openaiTest}
              verifying={openaiVerifying}
              saveLabel={t('settings.save')}
              testLabel={t('settings.test')}
              t={t}
              last
            />
            <div className="flex flex-col gap-0 border-t border-[#E5E5EA] bg-[#FAFAFC] dark:border-white/10 dark:bg-[#252527]">
              <div className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] text-[rgba(60,60,67,0.4)]">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                  <path
                    d="M8 5v3.5M8 11v.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span>
                  {t('settings.apiHint')}{' '}
                  <button
                    type="button"
                    className="border-none bg-transparent p-0 font-medium text-[#007AFF]"
                    onClick={() =>
                      window.open?.('https://console.anthropic.com')
                    }
                  >
                    console.anthropic.com
                  </button>
                </span>
              </div>
              <div className="flex items-center gap-1.5 border-t border-[#E5E5EA] px-4 py-2.5 text-[11px] text-[rgba(60,60,67,0.4)] dark:border-white/10">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                  <path
                    d="M8 5v3.5M8 11v.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span>
                  {t('settings.apiHintOpenai')}{' '}
                  <button
                    type="button"
                    className="border-none bg-transparent p-0 font-medium text-[#007AFF]"
                    onClick={() =>
                      window.open?.('https://platform.openai.com/api-keys')
                    }
                  >
                    platform.openai.com
                  </button>
                </span>
              </div>
            </div>
          </Section>

          <Section icon="✦" title={t('settings.aiFeatures')}>
            {!hasApiKey && (
              <div className="border-b border-[#E5E5EA] bg-amber-500/10 px-4 py-3 dark:border-white/10">
                <p className="text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
                  {t('settings.aiNoKeyWarning')}{' '}
                  <button
                    type="button"
                    className="font-semibold text-[#007AFF] underline-offset-2 hover:underline"
                    onClick={() =>
                      document
                        .getElementById('ai-api-keys')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  >
                    {t('settings.aiGoToKey')}
                  </button>
                </p>
              </div>
            )}
            <Row>
              <RowLabel title={t('settings.aiMorning')} sub={t('settings.aiMorningDesc')} />
              <IosToggle
                on={ai.morningGreeting !== false}
                onChange={(v) => patchAi('morningGreeting', v)}
              />
            </Row>
            <Row>
              <RowLabel title={t('settings.aiEvening')} sub={t('settings.aiEveningDesc')} />
              <IosToggle
                on={ai.eveningSummary !== false}
                onChange={(v) => patchAi('eveningSummary', v)}
              />
            </Row>
            <Row>
              <RowLabel title={t('settings.aiTasks')} sub={t('settings.aiTasksDesc')} />
              <IosToggle
                on={ai.taskSuggestions !== false}
                onChange={(v) => patchAi('taskSuggestions', v)}
              />
            </Row>
            <Row>
              <RowLabel title={t('settings.aiCoach')} sub={t('settings.aiCoachDesc')} />
              <IosToggle
                on={coachOn}
                onChange={(v) => patchAi('focusCoach', v)}
              />
            </Row>
            {coachOn && (
              <Row>
                <RowLabel title={t('settings.aiCoachInterval')} />
                <Segmented
                  value={String(ai.focusCoachInterval ?? 25)}
                  onChange={(v) => patchAi('focusCoachInterval', Number(v))}
                  options={[
                    { value: '15', label: `15 ${t('settings.min')}` },
                    { value: '25', label: `25 ${t('settings.min')}` },
                    { value: '45', label: `45 ${t('settings.min')}` },
                  ]}
                />
              </Row>
            )}
            <Row>
              <RowLabel title={t('settings.aiSession')} sub={t('settings.aiSessionDesc')} />
              <IosToggle
                on={ai.sessionAnalysis !== false}
                onChange={(v) => patchAi('sessionAnalysis', v)}
              />
            </Row>
            <Row last>
              <RowLabel title={t('settings.aiDayPlan')} sub={t('settings.aiDayPlanDesc')} />
              <IosToggle
                on={ai.dayPlan !== false}
                onChange={(v) => patchAi('dayPlan', v)}
              />
            </Row>
          </Section>

          <Section icon="🎨" title={t('settings.interface')}>
            <Row>
              <RowLabel title={t('settings.language')} sub="Interface language" />
              <Segmented
                value={settings.language}
                onChange={(v) => patch('language', v)}
                options={[
                  { value: 'uz', label: t('settings.langUz') },
                  { value: 'en', label: t('settings.langEn') },
                ]}
              />
            </Row>
            <Row last>
              <RowLabel title={t('settings.theme')} sub="Appearance" />
              <Segmented
                value={settings.theme}
                onChange={(v) => patch('theme', v)}
                options={[
                  { value: 'light', label: t('settings.themeLight'), icon: '☀️' },
                  { value: 'dark', label: t('settings.themeDark'), icon: '🌙' },
                  { value: 'system', label: t('settings.themeSystem'), icon: '💻' },
                ]}
              />
            </Row>
          </Section>

          <Section icon="⏱" title={t('settings.focusSession')}>
            <Row>
              <RowLabel
                title={lang === 'uz' ? 'Focus' : 'Focus'}
                sub={
                  lang === 'uz'
                    ? 'Diqqat sessiyasi davomiyligi'
                    : 'Focus session duration'
                }
              />
              <SliderGroup value={settings.focusDuration} unit={t('settings.min')}>
                <Slider
                  min={15}
                  max={120}
                  value={settings.focusDuration}
                  onChange={(v) => patch('focusDuration', v)}
                />
              </SliderGroup>
            </Row>
            <Row>
              <RowLabel
                title={t('settings.shortBreak')}
                sub={
                  lang === 'uz'
                    ? 'Sessiyalar orasidagi tanaffus'
                    : 'Break between sessions'
                }
              />
              <SliderGroup value={settings.shortBreak} unit={t('settings.min')}>
                <Slider
                  min={5}
                  max={30}
                  value={settings.shortBreak}
                  onChange={(v) => patch('shortBreak', v)}
                />
              </SliderGroup>
            </Row>
            <Row last>
              <RowLabel
                title={t('settings.longBreak')}
                sub={lang === 'uz' ? '4 sessiyadan keyin' : 'After 4 sessions'}
              />
              <SliderGroup value={settings.longBreak} unit={t('settings.min')}>
                <Slider
                  min={15}
                  max={60}
                  value={settings.longBreak}
                  onChange={(v) => patch('longBreak', v)}
                />
              </SliderGroup>
            </Row>
          </Section>

          <Section icon="🔔" title={t('settings.notifications')}>
            <Row>
              <RowLabel
                title={t('settings.notifyCoach')}
                sub={
                  lang === 'uz'
                    ? 'AI yordamchidan maslahatlar'
                    : 'Tips from AI assistant'
                }
              />
              <IosToggle
                on={settings.notifications?.focusCoach !== false}
                onChange={(v) => patchNotif('focusCoach', v)}
              />
            </Row>
            <Row>
              <RowLabel
                title={t('settings.notifyTasks')}
                sub={
                  lang === 'uz'
                    ? 'Belgilangan vaqtda eslatish'
                    : 'Remind at scheduled time'
                }
              />
              <IosToggle
                on={settings.notifications?.taskReminders !== false}
                onChange={(v) => patchNotif('taskReminders', v)}
              />
            </Row>
            <Row>
              <RowLabel
                title={t('settings.notifySession')}
                sub={
                  lang === 'uz'
                    ? 'Focus yoki tanaffus tugaganda'
                    : 'When focus or break ends'
                }
              />
              <IosToggle
                on={settings.notifications?.sessionEnd !== false}
                onChange={(v) => patchNotif('sessionEnd', v)}
              />
            </Row>
            <Row last>
              <RowLabel
                title={t('settings.notifyBlocked')}
                sub={
                  lang === 'uz'
                    ? "Bloklangan ilovaga urinish"
                    : 'Blocked app attempt'
                }
              />
              <IosToggle
                on={settings.notifications?.blockedApp !== false}
                onChange={(v) => patchNotif('blockedApp', v)}
              />
            </Row>
            <div className="px-3 pb-3">
              <NotificationSoundsSection
                settings={settings}
                lang={lang}
                onRefresh={async () => {
                  const next = await window.focusflow.settings.get();
                  setSettings(next);
                }}
              />
            </div>
          </Section>

          <SedentaryWatchSection settings={settings} lang={lang} patch={patch} />

          <Section
            icon="🛡️"
            title={lang === 'uz' ? 'Fokus himoyasi' : 'Focus guard'}
          >
            <Row last>
              <RowLabel
                title={
                  lang === 'uz'
                    ? 'Force Quit dan qayta ochish'
                    : 'Relaunch after Force Quit'
                }
                sub={
                  lang === 'uz'
                    ? 'Fokus paytida ilova o‘chirilsa ~5 soniyada qayta ochiladi'
                    : 'During focus, relaunch app if force quit (~5s)'
                }
              />
              <IosToggle
                on={settings.focusGuard?.autoRelaunch !== false}
                onChange={(v) => patch('focusGuard.autoRelaunch', v)}
              />
            </Row>
          </Section>

          <Section icon="🔒" title={t('settings.blocker')}>
            <div className="flex flex-col gap-2.5 p-3 sm:flex-row">
              {blockerCards.map((card) => (
                <BlockerCard
                  key={card.id}
                  title={card.title}
                  desc={card.desc}
                  detail={card.detail}
                  icon={card.icon}
                  accentColor={card.color}
                  selected={blockerUi === card.id}
                  onClick={() => patch('blocker.strength', uiToBlocker(card.id))}
                />
              ))}
            </div>
          </Section>

          <Section icon="ℹ️" title={t('settings.about')}>
            <div className="flex flex-wrap items-center gap-3.5 px-4 py-[18px]">
              <div
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-white shadow-[0_4px_12px_rgba(0,122,255,0.25)]"
                style={{
                  background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                }}
              >
                F
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-[#1D1D1F] dark:text-white">
                  FocusFlow
                </div>
                <div className="mt-0.5 text-xs text-[rgba(60,60,67,0.6)]">
                  {t('settings.versionLabel')} {version} · Power FX Studios
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await window.focusflow.app.checkForUpdates?.();
                  if (res?.message) window.alert(res.message);
                }}
                className="h-7 shrink-0 rounded-[7px] border-none bg-[rgba(120,120,128,0.12)] px-3 text-xs font-semibold text-[#1D1D1F] dark:bg-white/10 dark:text-white"
              >
                {t('settings.checkUpdate')}
              </button>
            </div>
            <div className="flex border-t border-[#E5E5EA] dark:border-white/10">
              <LinkRow icon="📖" label={t('settings.docs')} sub="Docs" />
              <div className="w-px bg-[#E5E5EA] dark:bg-white/10" />
              <LinkRow icon="💬" label={t('settings.support')} sub="Support" />
              <div className="w-px bg-[#E5E5EA] dark:bg-white/10" />
              <LinkRow icon="⭐" label={t('settings.rate')} sub="Rate" />
            </div>
          </Section>

          <p className="mt-2 text-center text-[11px] text-[rgba(60,60,67,0.4)] dark:text-[rgba(235,235,245,0.4)]">
            {t('settings.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}

