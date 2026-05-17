import { V } from './vaqtTheme';
import { useVaqtColors } from '../../context/VaqtColorsContext';

const ICONS = {
  clock: '⏱',
  target: '🎯',
  zap: '⚡',
  alert: '⚠️',
  trend: '📈',
  check: '✓',
  coffee: '☕',
  monitor: '💻',
};

function scoreColor(score) {
  if (score >= 75) return '#16a34a';
  if (score >= 50) return '#2563eb';
  if (score >= 30) return '#ea580c';
  return '#dc2626';
}

export default function VaqtAiInsights({ analysis, onClose }) {
  const { categoryMeta } = useVaqtColors();

  if (!analysis) return null;

  const plainText =
    typeof analysis === 'string'
      ? analysis
      : !analysis.headline && analysis.insights
        ? analysis.insights
        : null;

  if (plainText) {
    return (
      <div
        style={{
          background: V.cardBg,
          border: `1px solid ${V.cardBorder}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Header onClose={onClose} />
        <p style={{ fontSize: 13, color: V.text, lineHeight: 1.55 }}>{plainText}</p>
      </div>
    );
  }

  const score = Number(analysis.score) || 0;
  const highlights = Array.isArray(analysis.highlights) ? analysis.highlights : [];
  const tips = Array.isArray(analysis.tips) ? analysis.tips : [];
  const categoryNotes = Array.isArray(analysis.categoryNotes) ? analysis.categoryNotes : [];

  return (
    <div
      style={{
        background: V.cardBg,
        border: `1px solid ${V.cardBorder}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
          color: '#fff',
        }}
      >
        <Header onClose={onClose} light />
        <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45, margin: '10px 0 14px' }}>
          {analysis.headline}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {score}
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Mahsuldorlik
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{analysis.scoreLabel || 'Baholash'}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {highlights.length > 0 && (
          <Section title="Asosiy">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 10,
              }}
            >
              {highlights.map((item, i) => (
                <InsightCard
                  key={i}
                  icon={ICONS[item.icon] || '💡'}
                  title={item.title}
                  text={item.text}
                  accent={scoreColor(score)}
                />
              ))}
            </div>
          </Section>
        )}

        {categoryNotes.length > 0 && (
          <Section title="Kategoriyalar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categoryNotes.map((row, i) => {
                const meta = categoryMeta[row.key] || categoryMeta.neutral;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      padding: 10,
                      borderRadius: 8,
                      background: meta.bg,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: meta.color,
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 12.5, color: V.text, lineHeight: 1.45 }}>
                      {row.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {tips.length > 0 && (
          <Section title="Tavsiyalar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tips.map((tip, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${V.cardBorder}`,
                    background: '#fafafa',
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {ICONS[tip.icon] || '💡'}
                  </span>
                  <span style={{ fontSize: 12.5, color: V.text, lineHeight: 1.45 }}>{tip.text}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Header({ onClose, light }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          opacity: light ? 0.9 : 1,
          color: light ? '#fff' : V.dim,
        }}
      >
        Claude tahlili
      </span>
      <button
        type="button"
        onClick={onClose}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: light ? '#fff' : V.accent,
          background: light ? 'rgba(255,255,255,0.15)' : 'transparent',
          border: 'none',
          borderRadius: 6,
          padding: light ? '4px 10px' : 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Yopish
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: V.dim,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function InsightCard({ icon, title, text, accent }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${V.cardBorder}`,
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${accent}18`,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <div>
          {title ? (
            <div style={{ fontSize: 12, fontWeight: 700, color: V.text, marginBottom: 4 }}>{title}</div>
          ) : null}
          <p style={{ fontSize: 12, color: V.label, lineHeight: 1.45, margin: 0 }}>{text}</p>
        </div>
      </div>
    </div>
  );
}
