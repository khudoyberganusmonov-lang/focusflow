import { useCallback, useEffect, useState } from 'react';
import VaqtSidebar from '../components/vaqt/VaqtSidebar';
import VaqtTopStats from '../components/vaqt/VaqtTopStats';
import VaqtProductivity from '../components/vaqt/VaqtProductivity';
import VaqtApplications from '../components/vaqt/VaqtApplications';
import VaqtProjects from '../components/vaqt/VaqtProjects';
import VaqtTimeline from '../components/vaqt/VaqtTimeline';
import VaqtColorEditor from '../components/vaqt/VaqtColorEditor';
import VaqtAiInsights from '../components/vaqt/VaqtAiInsights';
import { V } from '../components/vaqt/vaqtTheme';
import { VaqtColorsProvider } from '../context/VaqtColorsContext';

const PERIODS = [
  { id: 'day', label: 'Bugun' },
  { id: 'week', label: 'Hafta' },
  { id: 'month', label: 'Oy' },
];

function reviewDismissKey() {
  return `vaqt-review-${new Date().toISOString().split('T')[0]}`;
}

function periodLabel(period) {
  if (period === 'week') return 'hafta';
  if (period === 'month') return 'oy';
  return 'bugun';
}

function buildVaqtAiPayload(stats, period) {
  return {
    period,
    totalSeconds: stats.totalSeconds,
    focusSeconds: stats.focusSeconds,
    productivityScore: stats.productivityScore,
    tasksCompleted: stats.tasksCompleted,
    categoryTotals: stats.categoryTotals,
    apps: (stats.apps || []).slice(0, 12).map((a) => ({
      name: a.name,
      seconds: a.seconds,
      category: a.category,
    })),
    productiveHours: stats.productiveHours,
    productiveWeekday: stats.productiveWeekday,
  };
}

function errorAnalysis(message, score = 0) {
  return {
    headline: 'AI tahlil',
    score,
    scoreLabel: '—',
    highlights: [{ icon: 'alert', title: 'Diqqat', text: message }],
    tips: [],
    categoryNotes: [],
  };
}

function TimeTrackerContent() {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterProjectId, setFilterProjectId] = useState(null);
  const [idleDismissed, setIdleDismissed] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(
    () => localStorage.getItem(reviewDismissKey()) === '1'
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.focusflow.tracker.getVaqtStats({
        preset: period,
        date,
        projectId: filterProjectId,
      });
      setStats(data);
    } catch (err) {
      console.error('[Vaqt] load failed:', err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [period, date, filterProjectId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  const showIdle =
    !idleDismissed && stats?.pausedReason === 'idle' && period === 'day';

  const hour = new Date().getHours();
  const showDailyReview =
    hour >= 18 &&
    !reviewDismissed &&
    period === 'day' &&
    date === new Date().toISOString().split('T')[0];

  const requestAiAnalysis = async (label) => {
    if (!stats) return;
    if (!window.focusflow?.ai?.analyzeVaqt) {
      setAiAnalysis(
        errorAnalysis("Ilovani qayta ishga tushiring — yangi versiya kerak.")
      );
      return;
    }

    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const payload = buildVaqtAiPayload(stats, label);
      const res = await window.focusflow.ai.analyzeVaqt(payload, label);

      if (res?.analysis?.headline) {
        setAiAnalysis(res.analysis);
      } else if (res?.error) {
        const msg = res.disabled
          ? "Sozlamalar → AI → «Sessiya tahlili» yoqing."
          : res.message || "Anthropic API kalitini Sozlamalarda kiriting.";
        setAiAnalysis(errorAnalysis(msg, stats.productivityScore || 0));
      } else {
        setAiAnalysis(
          errorAnalysis('Tahlil javobi kelmedi. API kalitini tekshiring.', stats.productivityScore || 0)
        );
      }
    } catch (err) {
      setAiAnalysis(errorAnalysis(err?.message || 'Xatolik yuz berdi.'));
    } finally {
      setAiLoading(false);
    }
  };

  const runAiSummary = () => requestAiAnalysis(periodLabel(period));
  const runEveningReview = () => requestAiAnalysis('bugungi kun');

  const dismissReview = () => {
    localStorage.setItem(reviewDismissKey(), '1');
    setReviewDismissed(true);
  };

  return (
    <div
      className="flex h-full min-h-0 no-drag"
      style={{ background: V.pageBg, fontFamily: 'inherit' }}
    >
      <VaqtSidebar
        categories={stats?.categories || []}
        selectedId={filterProjectId}
        onSelect={setFilterProjectId}
      />

      <div className="flex flex-1 flex-col min-w-0" style={{ background: V.shellBg }}>
        <header
          className="no-drag relative z-[70] shrink-0"
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            borderBottom: `1px solid ${V.sidebarBorder}`,
            background: V.shellBg,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: V.text, letterSpacing: -0.2 }}>
            Vaqt
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: V.dim }}>
              ⏱ Kuzatuv
            </span>
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 3,
              borderRadius: 8,
              background: '#ececef',
            }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: period === p.id ? '#fff' : 'transparent',
                  color: period === p.id ? V.accent : V.text,
                  boxShadow: period === p.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 6,
              border: `1px solid #d8d8de`,
              background: '#fff',
              fontSize: 12.5,
              color: V.text,
              fontFamily: 'inherit',
            }}
          />

          <VaqtColorEditor />

          <button
            type="button"
            onClick={runAiSummary}
            disabled={aiLoading || !stats}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 6,
              border: 'none',
              background: V.accent,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: aiLoading || !stats ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: aiLoading || !stats ? 0.7 : 1,
            }}
          >
            {aiLoading ? 'Tahlil…' : 'AI Summary'}
          </button>
        </header>

        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {loading && !stats && (
            <p style={{ fontSize: 13, color: V.dim, textAlign: 'center', padding: 40 }}>
              Yuklanmoqda…
            </p>
          )}

          {stats && (
            <>
              <VaqtTopStats stats={stats} />

              <VaqtProductivity stats={stats} />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.35fr',
                  gap: 12,
                  alignItems: 'stretch',
                }}
              >
                <VaqtApplications apps={stats.apps} />
                <VaqtProjects projects={stats.projects} filterProjectId={filterProjectId} />
              </div>

              {period === 'day' && <VaqtTimeline timeline={stats.timeline} />}

              {showDailyReview && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
                    borderRadius: 10,
                    padding: 18,
                    color: '#fff',
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                    Kunlik ko&apos;rib chiqish
                  </div>
                  <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
                    Soat 18:00 dan keyin — bugungi ish kuningizni Claude bilan tahlil qiling.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={runEveningReview}
                      disabled={aiLoading}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#fff',
                        color: V.accent,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Tahlilni boshlash
                    </button>
                    <button
                      type="button"
                      onClick={dismissReview}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.35)',
                        background: 'transparent',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Keyinroq
                    </button>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>

      {aiLoading && (
        <div
          className="no-drag"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
          role="status"
          aria-live="polite"
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '20px 28px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: V.text, margin: 0 }}>
              Claude tahlil qilmoqda…
            </p>
          </div>
        </div>
      )}

      {aiAnalysis && !aiLoading && (
        <div
          className="no-drag"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '72px 16px 24px',
            background: 'rgba(0,0,0,0.45)',
            overflowY: 'auto',
          }}
          role="presentation"
          onClick={() => setAiAnalysis(null)}
        >
          <div
            style={{ width: 'min(640px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <VaqtAiInsights analysis={aiAnalysis} onClose={() => setAiAnalysis(null)} />
          </div>
        </div>
      )}

      {showIdle && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: 'min(380px, 90vw)',
              background: '#fff',
              borderRadius: 12,
              padding: 22,
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: V.text, marginBottom: 8 }}>
              Nofaol holat
            </h3>
            <p style={{ fontSize: 13, color: V.label, lineHeight: 1.5, marginBottom: 16 }}>
              5 daqiqadan ortiq harakat yo&apos;q — vaqt yozuvi to&apos;xtatildi. Qayta ishlashni
              boshlasangiz, kuzatuv davom etadi.
            </p>
            <button
              type="button"
              onClick={() => setIdleDismissed(true)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: 'none',
                background: V.accent,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Tushundim
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TimeTracker() {
  return (
    <VaqtColorsProvider>
      <TimeTrackerContent />
    </VaqtColorsProvider>
  );
}
