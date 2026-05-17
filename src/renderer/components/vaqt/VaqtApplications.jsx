import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, V } from './vaqtTheme';
import { fmtHM, fmtHMShort } from '../../utils/vaqtFormat';
import { useVaqtColors } from '../../context/VaqtColorsContext';
import AppRowIcon from './AppRowIcon';

export default function VaqtApplications({ apps }) {
  const { categoryMeta } = useVaqtColors();
  const sorted = [...(apps || [])].sort((a, b) => b.seconds - a.seconds);
  const total = sorted.reduce((s, a) => s + a.seconds, 0);
  const [hover, setHover] = useState(null);
  const focus = hover != null ? sorted[hover] : null;

  return (
    <Card padding={18} style={{ display: 'flex', flexDirection: 'column', minHeight: 380 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: V.text }}>Ilovalar</div>
        <div style={{ fontSize: 11.5, color: V.label }}>
          {sorted.length} ta · {fmtHM(total)}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '170px 1fr',
          gap: 18,
          flex: 1,
          alignItems: 'stretch',
        }}
      >
        <div style={{ position: 'relative', height: 170, alignSelf: 'center' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sorted}
                dataKey="seconds"
                nameKey="name"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={1.2}
                stroke="none"
                onMouseEnter={(_, i) => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {sorted.map((a, i) => (
                  <Cell
                    key={a.name}
                    fill={a.color}
                    opacity={hover == null || hover === i ? 1 : 0.4}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            {focus ? (
              <>
                <AppRowIcon name={focus.name} size={26} />
                <div
                  style={{
                    fontSize: 11.5,
                    color: V.label,
                    marginTop: 4,
                    maxWidth: 80,
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {focus.name}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: V.text }}>
                  {fmtHM(focus.seconds)}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: V.text,
                    letterSpacing: -0.6,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtHM(total)}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: V.dim,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginTop: 2,
                  }}
                >
                  jami
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'auto' }}>
          {sorted.map((a, i) => {
            const pct = total > 0 ? (a.seconds / total) * 100 : 0;
            const meta = categoryMeta[a.category] || categoryMeta.neutral;
            const focused = hover === i;
            return (
              <div
                key={a.name}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr 70px 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '6px 6px',
                  borderRadius: 5,
                  background: focused ? 'rgba(0,0,0,0.04)' : 'transparent',
                }}
              >
                <AppRowIcon name={a.name} size={22} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: V.text,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.name}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: meta.color,
                      fontWeight: 600,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: '#f1f1f4',
                    borderRadius: 99,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: a.color,
                      borderRadius: 99,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: V.text,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 500,
                  }}
                >
                  {fmtHMShort(a.seconds)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
