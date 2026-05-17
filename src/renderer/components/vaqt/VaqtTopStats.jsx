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
import { fmtHour, fmtTotal } from '../../utils/vaqtFormat';

function StatTotal({ stats }) {
  const { h, m } = fmtTotal(stats.totalSeconds);
  const avgH = (stats.avgPerDaySeconds / 3600).toFixed(1);

  return (
    <Card padding={16} style={{ display: 'flex', flexDirection: 'column' }}>
      <CardLabel>Jami vaqt</CardLabel>
      <div
        style={{
          fontSize: 38,
          fontWeight: 700,
          color: V.accent,
          letterSpacing: -1.2,
          lineHeight: 1,
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {h}
        <span style={{ fontSize: 22, fontWeight: 600, color: '#60a5fa' }}>s</span> {String(m).padStart(2, '0')}
        <span style={{ fontSize: 22, fontWeight: 600, color: '#60a5fa' }}>daq</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: V.label }}>
        {stats.dayCount} kun · o&apos;rtacha <b style={{ color: V.text }}>{avgH}s</b>/kun
      </div>
      {stats.changePct != null && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 14,
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: stats.changePct >= 0 ? '#22c55e' : '#dc2626',
              fontWeight: 600,
            }}
          >
            {stats.changePct >= 0 ? '▲' : '▼'} {Math.abs(stats.changePct)}%
          </span>
          <span style={{ fontSize: 11, color: V.dim }}>oldingi davrga nisbatan</span>
        </div>
      )}
    </Card>
  );
}

function StatWeekdays({ weekdayHours }) {
  const max = Math.max(...weekdayHours.map((d) => d.hours), 0.1);
  return (
    <Card padding={16}>
      <CardLabel>Faol kunlar</CardLabel>
      <div style={{ height: 110, marginTop: 6 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekdayHours} margin={{ top: 6, right: 4, bottom: 0, left: -28 }}>
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10.5, fill: V.dim }}
            />
            <YAxis hide domain={[0, max * 1.1]} />
            <Tooltip
              cursor={{ fill: 'rgba(59,130,246,0.06)' }}
              {...chartTooltipProps}
              formatter={(v) => [`${v}s`, 'Kuzatilgan']}
            />
            <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
              {weekdayHours.map((d, i) => (
                <Cell key={i} fill={d.hours === max ? V.accent : V.accentLight} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function StatHours({ hourlyMinutes }) {
  const max = Math.max(...hourlyMinutes.map((d) => d.minutes), 1);
  return (
    <Card padding={16}>
      <CardLabel>Faol soatlar</CardLabel>
      <div style={{ height: 110, marginTop: 6 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={hourlyMinutes}
            margin={{ top: 6, right: 4, bottom: 0, left: -28 }}
            barCategoryGap={1}
          >
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              ticks={[0, 6, 12, 18, 23]}
              tickFormatter={(h) => fmtHour(h)}
              tick={{ fontSize: 10.5, fill: V.dim }}
            />
            <YAxis hide domain={[0, max * 1.1]} />
            <Tooltip
              cursor={{ fill: 'rgba(59,130,246,0.06)' }}
              {...chartTooltipProps}
              labelFormatter={(h) => fmtHour(h)}
              formatter={(v) => [`${Math.round(v)} daq`, 'Kuzatilgan']}
            />
            <Bar dataKey="minutes" radius={[2, 2, 0, 0]}>
              {hourlyMinutes.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.minutes > max * 0.65 ? V.accent : V.accentLight}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function StatPerWeek({ projectsPerWeek, projectColors }) {
  const categories = projectColors || [];
  return (
    <Card padding={16}>
      <CardLabel>Loyiha · hafta</CardLabel>
      <div style={{ height: 110, marginTop: 6 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={projectsPerWeek} margin={{ top: 6, right: 4, bottom: 0, left: -28 }}>
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: V.dim }}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              {...chartTooltipProps}
              formatter={(v, n) => {
                const cat = categories.find((c) => `p_${c.id}` === n);
                return [`${v}s`, cat ? cat.name : n];
              }}
            />
            {categories.map((c, i) => (
              <Bar
                key={c.id}
                dataKey={`p_${c.id}`}
                stackId="s"
                fill={c.color}
                radius={i === categories.length - 1 ? [3, 3, 0, 0] : 0}
              />
            ))}
            {projectsPerWeek.some((r) => r.p_unassigned > 0) && (
              <Bar dataKey="p_unassigned" stackId="s" fill="#94a3b8" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 10px',
          marginTop: 8,
        }}
      >
        {categories.slice(0, 5).map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: c.color,
              }}
            />
            <span style={{ fontSize: 10.5, color: V.label }}>{c.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function VaqtTopStats({ stats }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 12,
      }}
    >
      <StatTotal stats={stats} />
      <StatWeekdays weekdayHours={stats.weekdayHours} />
      <StatHours hourlyMinutes={stats.hourlyMinutes} />
      <StatPerWeek
        projectsPerWeek={stats.projectsPerWeek}
        projectColors={stats.projectColors}
      />
    </div>
  );
}
