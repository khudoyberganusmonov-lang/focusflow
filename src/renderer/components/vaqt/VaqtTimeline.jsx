import { useState } from 'react';
import { Card, CardLabel, V } from './vaqtTheme';
import { fmtHM } from '../../utils/vaqtFormat';
import { useVaqtColors } from '../../context/VaqtColorsContext';

export default function VaqtTimeline({ timeline }) {
  const { categoryMeta } = useVaqtColors();
  const [selected, setSelected] = useState(null);
  const items = timeline || [];

  return (
    <>
      <Card padding={18}>
        <CardLabel>Timeline</CardLabel>
        <p style={{ fontSize: 11.5, color: V.dim, marginBottom: 12 }}>
          Blokni bosing — tafsilotlar
        </p>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: V.dim, textAlign: 'center', padding: 24 }}>
            Bugun yozuvlar yo&apos;q
          </p>
        ) : (
          <div
            style={{
              position: 'relative',
              height: 56,
              background: '#f1f1f4',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {items.map((block) => (
              <button
                key={block.id}
                type="button"
                title={`${block.app_name} · ${block.label}`}
                onClick={() => setSelected(block)}
                style={{
                  position: 'absolute',
                  left: `${block.leftPct}%`,
                  width: `${Math.max(block.widthPct, 0.5)}%`,
                  top: 8,
                  bottom: 8,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: (categoryMeta[block.category] || categoryMeta.neutral).color,
                  opacity: selected?.id === block.id ? 1 : 0.85,
                  boxShadow:
                    selected?.id === block.id
                      ? '0 0 0 2px #fff, 0 0 0 3px #2563eb'
                      : 'none',
                  minWidth: 3,
                }}
              />
            ))}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            fontSize: 10,
            color: V.dim,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </Card>

      {selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
          onClick={() => setSelected(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSelected(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(400px, 92vw)',
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: V.text, marginBottom: 8 }}>
              {selected.app_name}
            </h3>
            <p style={{ fontSize: 13, color: V.label, marginBottom: 4 }}>
              {selected.window_title || '—'}
            </p>
            <p style={{ fontSize: 12, color: V.dim, marginBottom: 12 }}>
              {selected.label}
              {selected.project_name ? ` · ${selected.project_name}` : ''}
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: V.text }}>
              {fmtHM(selected.duration)}
            </p>
            <span
              style={{
                display: 'inline-block',
                marginTop: 8,
                fontSize: 11,
                fontWeight: 600,
                color: (categoryMeta[selected.category] || categoryMeta.neutral).color,
              }}
            >
              {(categoryMeta[selected.category] || categoryMeta.neutral).label}
            </span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '10px',
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
              Yopish
            </button>
          </div>
        </div>
      )}
    </>
  );
}
