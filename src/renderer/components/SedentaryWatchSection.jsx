import { useEffect, useState } from 'react';

const WARN_MINUTE_OPTIONS = Array.from({ length: 36 }, (_, i) => (i + 1) * 5);

function normalizeWarnMinutes(value) {
  const n = Number(value) || 60;
  const snapped = Math.round(n / 5) * 5;
  return Math.max(5, Math.min(180, snapped));
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
        className={`absolute top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-[left] duration-200 ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export default function SedentaryWatchSection({ settings, lang, patch }) {
  const sw = settings.sedentaryWatch || {};
  const [status, setStatus] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await window.focusflow.projects.getAll();
        if (!cancelled) setProjects(list || []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let unsubSedentary = () => {};
    let unsubFocus = () => {};
    (async () => {
      try {
        const s = await window.focusflow.sedentary.getStatus();
        setStatus(s);
      } catch {
        /* ignore */
      }
      unsubSedentary = window.focusflow.sedentary.onStatus((data) => setStatus(data));
      unsubFocus = window.focusflow.focus.onStateChange?.(() => {
        void window.focusflow.sedentary.getStatus().then(setStatus);
      });
    })();
    return () => {
      unsubSedentary();
      unsubFocus?.();
    };
  }, [sw.enabled, sw.testMode, sw.projectId]);

  const enabled = sw.enabled === true;
  const testMode = sw.testMode === true;
  const warnMin = normalizeWarnMinutes(sw.warnAfterMinutes);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await window.focusflow.sedentary.test();
      setTestResult(r);
      const s = await window.focusflow.sedentary.getStatus();
      setStatus(s);
    } catch (err) {
      setTestResult({
        ok: false,
        error: err?.message || String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mb-[22px]">
      <SectionHeader lang={lang} />
      <div className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:border-white/10 dark:bg-[#2C2C2E]">
        <SettingsRow border>
          <WatchLabel lang={lang} />
          <IosToggle
            on={enabled}
            onChange={(v) => patch('sedentaryWatch.enabled', v)}
          />
        </SettingsRow>

        {enabled ? (
          <>
            <ProjectLinkRow
              lang={lang}
              projects={projects}
              projectId={sw.projectId}
              patch={patch}
            />
            <WarnAfterRow lang={lang} warnMin={warnMin} patch={patch} />

            <SettingsRow border>
              <LabelText
                title={lang === 'uz' ? 'Sinov rejimi' : 'Test mode'}
                sub={
                  lang === 'uz'
                    ? 'MediaPipe ishlayotganini tekshirish'
                    : 'Check if MediaPipe works'
                }
              />
              <IosToggle
                on={testMode}
                onChange={(v) => patch('sedentaryWatch.testMode', v)}
              />
            </SettingsRow>

            {testMode ? (
              <TestModePanel
                lang={lang}
                status={status}
                testResult={testResult}
                testing={testing}
                onRunTest={runTest}
              />
            ) : null}

            <SedentaryStats lang={lang} status={status} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({ lang }) {
  return (
    <div className="mx-1 mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.6)]">
      <span className="text-sm normal-case tracking-normal">📷</span>
      <span>{lang === 'uz' ? 'O‘tirish nazorati' : 'Sitting watch'}</span>
    </div>
  );
}

function SettingsRow({ children, border }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3.5 ${
        border ? 'border-b border-[#E5E5EA] dark:border-white/10' : ''
      }`}
    >
      {children}
    </div>
  );
}

function WatchLabel({ lang }) {
  return (
    <LabelText
      title={lang === 'uz' ? 'Web-kamera kuzatuvi' : 'Webcam watch'}
      sub={
        lang === 'uz'
          ? 'MediaPipe yuz + tana. Video saqlanmaydi, faqat shu Macda.'
          : 'MediaPipe face + pose. No video saved, local only.'
      }
    />
  );
}

function LabelText({ title, sub }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[13px] font-medium text-[#1D1D1F] dark:text-white">{title}</div>
      {sub ? (
        <div className="mt-0.5 text-[11px] text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.55)]">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function ProjectLinkRow({ lang, projects, projectId, patch }) {
  const value = projectId != null && projectId !== '' ? String(projectId) : '';

  return (
    <SettingsRow border>
      <LabelText
        title={lang === 'uz' ? 'Loyiha' : 'Project'}
        sub={
          lang === 'uz'
            ? 'Faqat shu loyiha focusida kamera ishlaydi'
            : 'Camera runs only during focus on this project'
        }
      />
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          patch('sedentaryWatch.projectId', v ? Number(v) : null);
        }}
        className="max-w-[52%] truncate rounded-lg border border-[#E5E5EA] bg-white px-2 py-1 text-[13px] dark:border-white/10 dark:bg-[#1C1C1E]"
      >
        <option value="">{lang === 'uz' ? 'Tanlang…' : 'Select…'}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </SettingsRow>
  );
}

function WarnAfterRow({ lang, warnMin, patch }) {
  return (
    <SettingsRow border>
      <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-white">
        {lang === 'uz' ? 'Ogohlantirish' : 'Warn after'}
      </span>
      <select
        value={warnMin}
        onChange={(e) =>
          patch('sedentaryWatch.warnAfterMinutes', Number(e.target.value))
        }
        className="max-h-48 rounded-lg border border-[#E5E5EA] bg-white px-2 py-1 text-[13px] dark:border-white/10 dark:bg-[#1C1C1E]"
      >
        {WARN_MINUTE_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m} {lang === 'uz' ? 'daq' : 'min'}
          </option>
        ))}
      </select>
    </SettingsRow>
  );
}

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
        ok
          ? 'bg-[rgba(48,182,80,0.12)] text-[#1F8A3A]'
          : 'bg-[rgba(255,59,48,0.12)] text-[#D70015]'
      }`}
    >
      {ok ? '✓' : '✕'} {label}
    </span>
  );
}

function TestModePanel({ lang, status, testResult, testing, onRunTest }) {
  const pluginOk =
    testResult?.mediapipeLoaded ??
    (status?.cameraOk &&
      (status?.engine === 'mediapipe' || status?.engine === 'mediapipe+pose'));
  const faceOk = testResult?.present ?? status?.present;

  return (
    <div className="space-y-2.5 border-b border-[#E5E5EA] bg-[rgba(120,120,128,0.06)] px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
      <div className="text-[12px] font-medium text-[#1D1D1F] dark:text-white">
        {lang === 'uz' ? 'MediaPipe sinovi' : 'MediaPipe test'}
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusPill
          ok={Boolean(pluginOk)}
          label={
            lang === 'uz'
              ? pluginOk
                ? 'Plagin ishlayapti'
                : 'Plagin ishlamayapti'
              : pluginOk
                ? 'Plugin OK'
                : 'Plugin fail'
          }
        />
        {testResult ? (
          <StatusPill
            ok={Boolean(faceOk)}
            label={
              lang === 'uz'
                ? faceOk
                  ? `Yuz topildi (${testResult.faceCount ?? 1})`
                  : 'Yuz topilmadi'
                : faceOk
                  ? `Face found (${testResult.faceCount ?? 1})`
                  : 'No face'
            }
          />
        ) : null}
      </div>

      {status?.engine ? (
        <p className="text-[11px] text-[rgba(60,60,67,0.7)] dark:text-[rgba(235,235,245,0.55)]">
          {lang === 'uz' ? 'Dvigatel:' : 'Engine:'}{' '}
          <span className="font-mono">{status.engine}</span>
        </p>
      ) : null}

      {testResult?.error ? (
        <p className="text-[11px] text-[#D70015]">{testResult.error}</p>
      ) : null}

      <button
        type="button"
        disabled={testing}
        onClick={onRunTest}
        className="rounded-lg bg-[#007AFF] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
      >
        {testing
          ? lang === 'uz'
            ? 'Tekshirilmoqda…'
            : 'Testing…'
          : lang === 'uz'
            ? 'Hozir sinash'
            : 'Run test now'}
      </button>

      <p className="text-[10px] text-[rgba(60,60,67,0.55)] dark:text-[rgba(235,235,245,0.45)]">
        {lang === 'uz'
          ? 'Kameraga qarang. Sinov ogohlantirish vaqti hisobiga ta’sir qilmaydi.'
          : 'Look at the camera. Test does not affect sitting timers.'}
      </p>
    </div>
  );
}

function SedentaryStats({ lang, status }) {
  return (
    <div className="space-y-1.5 px-4 py-3.5 text-[12px] text-[rgba(60,60,67,0.85)] dark:text-[rgba(235,235,245,0.75)]">
      {status?.projectName ? (
        <p>
          {lang === 'uz' ? 'Bog‘langan loyiha:' : 'Linked project:'}{' '}
          <span className="font-semibold text-[#1D1D1F] dark:text-white">
            {status.projectName}
          </span>
        </p>
      ) : null}
      {status?.waitingForFocus ? (
        <p className="text-[#007AFF]">
          {lang === 'uz'
            ? `«${status.projectName || 'Loyiha'}» focusini boshlang — kamera shunda yoqiladi.`
            : `Start focus on «${status.projectName || 'project'}» to activate the camera.`}
          {status.focusProjectName &&
          status.focusProjectName !== status.projectName ? (
            <span className="block mt-1 text-[rgba(60,60,67,0.7)] dark:text-[rgba(235,235,245,0.55)]">
              {lang === 'uz' ? 'Hozirgi focus:' : 'Current focus:'}{' '}
              {status.focusProjectName}
            </span>
          ) : null}
        </p>
      ) : null}
      {status?.focusWatching ? (
        <p className="font-medium text-[#1F8A3A]">
          {lang === 'uz' ? 'Focus faol — kuzatuv ishlayapti' : 'Focus active — watching'}
        </p>
      ) : null}
      {status?.activeAppName ? (
        <p>
          {lang === 'uz' ? 'Oldidagi ilova:' : 'Front app:'}{' '}
          <span className="font-semibold text-[#1D1D1F] dark:text-white">
            {status.activeAppName}
          </span>
          {status.activeAppMatches ? (
            <span className="text-[#1F8A3A]">
              {' '}
              · {lang === 'uz' ? 'loyihaga mos' : 'matches project'}
            </span>
          ) : (
            <span className="text-[rgba(60,60,67,0.6)]">
              {' '}
              · {lang === 'uz' ? 'boshqa ilova' : 'other app'}
            </span>
          )}
        </p>
      ) : null}
      {status?.cameraError ? (
        <p className="text-[#D70015]">{status.cameraError}</p>
      ) : null}
      <p>
        {lang === 'uz' ? 'Hozir kamerada:' : 'At desk now:'}{' '}
        <span className="font-semibold text-[#1D1D1F] dark:text-white">
          {status?.present
            ? lang === 'uz'
              ? 'Ha'
              : 'Yes'
            : lang === 'uz'
              ? 'Yo‘q'
              : 'No'}
        </span>
      </p>
      <p>
        {lang === 'uz' ? 'Shu o‘tirish:' : 'Current sitting:'}{' '}
        <span className="font-semibold tabular-nums text-[#1D1D1F] dark:text-white">
          {status?.sittingMinutes ?? 0} {lang === 'uz' ? 'daq' : 'min'}
        </span>
        {status?.focusWatching &&
        status?.remainingMinutes != null &&
        status.present ? (
          <span className="text-[rgba(60,60,67,0.6)] dark:text-[rgba(235,235,245,0.55)]">
            {' '}
            · {lang === 'uz' ? 'ogohlantirishgacha' : 'until warn'}{' '}
            {status.remainingMinutes} {lang === 'uz' ? 'daq' : 'min'}
          </span>
        ) : null}
      </p>
      <p>
        {lang === 'uz' ? 'Bugun jami o‘tirish:' : 'Today sitting total:'}{' '}
        <span className="font-semibold tabular-nums text-[#1D1D1F] dark:text-white">
          {status?.todayMinutes ?? 0} {lang === 'uz' ? 'daq' : 'min'}
        </span>
      </p>
    </div>
  );
}
