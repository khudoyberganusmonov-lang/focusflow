import { useState } from 'react';
import { useVaqtColors } from '../../context/VaqtColorsContext';
import { V } from './vaqtTheme';

const PRESETS = ['#16a34a', '#2563eb', '#dc2626', '#ea580c', '#9333ea', '#64748b', '#0891b2', '#ca8a04'];

export default function VaqtColorEditor() {
  const { categoryMeta, setCategoryColor, resetColors } = useVaqtColors();
  const [open, setOpen] = useState(false);

  return (
    <div className="no-drag relative" style={{ position: 'relative', zIndex: 80 }}>
      <button
        type="button"
        className="no-drag"
        onClick={() => setOpen((o) => !o)}
        title="Kategoriya ranglari"
        style={{
          height: 28,
          padding: '0 10px',
          borderRadius: 6,
          border: `1px solid ${V.cardBorder}`,
          background: '#fff',
          fontSize: 12,
          fontWeight: 600,
          color: V.text,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ display: 'flex', gap: 3 }}>
          {Object.values(categoryMeta).map((m) => (
            <span
              key={m.label}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: m.color,
              }}
            />
          ))}
        </span>
        Ranglar
      </button>

      {open && (
        <>
          <button
            type="button"
            className="no-drag"
            aria-label="Yopish"
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 90,
              border: 'none',
              background: 'transparent',
              cursor: 'default',
            }}
          />
          <div
            className="no-drag"
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 6px)',
              zIndex: 100,
              width: 260,
              padding: 14,
              borderRadius: 10,
              background: '#fff',
              border: `1px solid ${V.cardBorder}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: V.text,
                marginBottom: 10,
              }}
            >
              Kategoriya ranglari
            </div>

            {Object.entries(categoryMeta).map(([key, meta]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: V.text }}>
                    {meta.label}
                  </span>
                  <input
                    type="color"
                    value={meta.color}
                    onChange={(e) => setCategoryColor(key, e.target.value)}
                    style={{
                      width: 28,
                      height: 28,
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoryColor(key, c)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border:
                          meta.color === c ? `2px solid ${V.accent}` : '1px solid #e5e5ea',
                        background: c,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                resetColors();
                setOpen(false);
              }}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '7px 0',
                borderRadius: 6,
                border: `1px solid ${V.cardBorder}`,
                background: '#f8f8fa',
                fontSize: 11.5,
                fontWeight: 600,
                color: V.dim,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Standart ranglar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
