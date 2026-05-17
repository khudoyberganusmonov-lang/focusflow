import { V } from './vaqtTheme';
import { fmtHM } from '../../utils/vaqtFormat';

function CategoryRow({ color, name, minutes, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: 'calc(100% - 16px)',
        height: 26,
        margin: '0 8px',
        padding: '0 8px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        background: selected ? 'rgba(0,0,0,0.05)' : 'transparent',
        fontSize: 12.5,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15)',
        }}
      />
      <span
        style={{
          flex: 1,
          color: V.text,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontSize: 11.5,
          color: V.label,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtHM(minutes * 60)}
      </span>
    </button>
  );
}

export default function VaqtSidebar({ categories, selectedId, onSelect }) {
  const totalM = categories.reduce((s, c) => s + (c.minutes || 0), 0);

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        height: '100%',
        background: V.sidebarBg,
        borderRight: `1px solid ${V.sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: 11,
          }}
        >
          FF
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: V.text }}>Loyihalar</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        <button
          type="button"
          onClick={() => onSelect(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: 'calc(100% - 16px)',
            height: 28,
            margin: '4px 8px',
            padding: '0 8px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: selectedId == null ? 'rgba(59,130,246,0.14)' : 'transparent',
            color: selectedId == null ? '#1d4ed8' : V.text,
            fontSize: 13,
            fontWeight: selectedId == null ? 600 : 500,
            fontFamily: 'inherit',
          }}
        >
          <span style={{ flex: 1 }}>Barchasi</span>
          <span style={{ fontSize: 11, color: V.label }}>{fmtHM(totalM * 60)}</span>
        </button>

        <div
          style={{
            padding: '12px 16px 4px',
            fontSize: 10.5,
            fontWeight: 700,
            color: V.label,
            textTransform: 'uppercase',
            letterSpacing: 0.7,
          }}
        >
          Loyihalar
        </div>

        {categories.map((c) => (
          <CategoryRow
            key={c.id}
            color={c.color}
            name={c.name}
            minutes={c.minutes}
            selected={selectedId === c.id}
            onClick={() => onSelect(c.id === selectedId ? null : c.id)}
          />
        ))}
      </div>

      <div
        style={{
          padding: '10px 16px',
          borderTop: `1px solid ${V.sidebarBorder}`,
          fontSize: 11,
          color: V.dim,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#22c55e',
          }}
        />
        Kuzatilmoqda
      </div>
    </aside>
  );
}
