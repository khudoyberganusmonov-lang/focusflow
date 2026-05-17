import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';
import { Card, CardLabel, V, chartTooltipProps } from './vaqtTheme';
import { useVaqtColors } from '../../context/VaqtColorsContext';

function Ring({ score, stroke, track }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg width={92} height={92} viewBox="0 0 92 92">
      <circle cx={46} cy={46} r={r} fill="none" stroke={track} strokeWidth={10} />
      <circle
        cx={46}
        cy={46}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 46 46)"
      />
    </svg>
  );
}

export default function VaqtProductivity({ stats }) {
  const { categoryMeta } = useVaqtColors();
  const score = stats.productivityScore || 0;
  const prodColor = categoryMeta.productive.color;
  const prodBg = categoryMeta.productive.bg;
  const maxWk = Math.max(...stats.productiveWeekday.map((d) => d.score), 1);
  const maxHr = Math.max(...stats.productiveHours.map((d) => d.score), 1);
  const totals = stats.categoryTotals || {};

  return (
    <Card
      padding={18}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 220px) 1fr 1fr',
        gap: 22,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <CardLabel>Mahsuldorlik</CardLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
          <Ring score={score} stroke={prodColor} track={prodBg} />
          <div>
            <div
              style={{
                fontSize: 38,
                fontWeight: 700,
                color: prodColor,
                letterSpacing: -1.2,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {score}
              <span style={{ fontSize: 22, opacity: 0.55 }}>%</span>
            </div>
            <div style={{ fontSize: 11.5, color: prodColor, fontWeight: 600, marginTop: 4 }}>
              {stats.tasksCompleted} vazifa bajarildi
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(categoryMeta).map(([key, meta]) => {
            const sec = totals[key] || 0;
            if (sec <= 0) return null;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: meta.color,
                  }}
                />
                <span style={{ fontSize: 12, color: V.text, flex: 1 }}>{meta.label}</span>
                <span style={{ fontSize: 11.5, color: V.label }}>
                  {Math.round(sec / 60)} daq
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <CardLabel>Faol kunlar (mahsuldor)</CardLabel>
        <div style={{ height: 110, marginTop: 6 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.productiveWeekday}
              margin={{ top: 6, right: 4, bottom: 0, left: -28 }}
            >
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10.5, fill: V.dim }}
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                cursor={{ fill: 'rgba(34,197,94,0.06)' }}
                {...chartTooltipProps}
                formatter={(v) => [`${v}%`, 'Mahsuldor']}
              />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {stats.productiveWeekday.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.score === maxWk ? prodColor : prodBg}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <CardLabel>Faol soatlar (mahsuldor)</CardLabel>
        <div style={{ height: 110, marginTop: 6 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.productiveHours}
              margin={{ top: 6, right: 4, bottom: 0, left: -28 }}
              barCategoryGap={1}
            >
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                ticks={[9, 12, 15, 18]}
                tick={{ fontSize: 10.5, fill: V.dim }}
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                cursor={{ fill: 'rgba(34,197,94,0.06)' }}
                {...chartTooltipProps}
                formatter={(v) => [`${v}%`, 'Mahsuldor']}
              />
              <Bar dataKey="score" radius={[2, 2, 0, 0]}>
                {stats.productiveHours.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.score >= maxHr * 0.85 ? prodColor : prodBg}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
