export const V = {
  pageBg: '#f4f4f6',
  shellBg: '#fbfbfd',
  cardBg: '#ffffff',
  cardBorder: '#e6e6e9',
  text: '#1f1f23',
  dim: '#8a8a93',
  label: '#7d7d85',
  sidebarBg: '#f4f4f6',
  sidebarBorder: '#e3e3e7',
  accent: '#2563eb',
  accentLight: '#bfdbfe',
  green: '#16a34a',
  greenLight: '#86efac',
};

export const tooltipStyle = {
  background: '#1f1f23',
  border: 'none',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 11.5,
  color: '#fff',
  boxShadow: '0 4px 16px rgba(0,0,0,0.16)',
};

/** Recharts needs label/item styles — contentStyle alone leaves dark text */
export const chartTooltipProps = {
  contentStyle: tooltipStyle,
  labelStyle: { color: '#ffffff', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: '#e8e8ed' },
};

export function Card({ children, style = {}, padding = 18 }) {
  return (
    <div
      style={{
        background: V.cardBg,
        border: `1px solid ${V.cardBorder}`,
        borderRadius: 10,
        padding,
        boxShadow: '0 1px 0 rgba(16, 24, 40, 0.02)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardLabel({ children, style = {} }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        color: V.dim,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
