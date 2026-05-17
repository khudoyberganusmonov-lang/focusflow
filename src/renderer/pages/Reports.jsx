import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatDuration } from '../utils/format';

const PRESETS = [
  { id: 'today', label: 'Bugun' },
  { id: 'week', label: 'Bu hafta' },
  { id: 'month', label: 'Bu oy' },
];

export default function Reports() {
  const [preset, setPreset] = useState('week');
  const [data, setData] = useState(null);

  const load = async () => {
    const report = await window.focusflow.reports.get({ preset });
    setData(report);
  };

  useEffect(() => {
    load();
  }, [preset]);

  const exportCsv = async () => {
    const csv = await window.focusflow.reports.exportCsv({ preset });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `focusflow-${preset}.csv`;
    a.click();
  };

  const chartData =
    data?.stackedByDay?.map((d) => {
      const row = { date: d.date.slice(5) };
      for (const [k, v] of Object.entries(d)) {
        if (k !== 'date' && k !== 'total') row[k] = Math.round(v / 60);
      }
      return row;
    }) || [];

  const projectKeys =
    chartData[0] ?
      Object.keys(chartData[0]).filter((k) => k !== 'date')
    : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-5 pt-12 pb-3 shrink-0 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hisobot</h1>
        <button
          type="button"
          onClick={exportCsv}
          className="text-sm text-light-accent dark:text-dark-accent font-medium"
        >
          CSV eksport
        </button>
      </header>

      <div className="px-5 flex gap-2 mb-4 shrink-0">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              preset === p.id
                ? 'bg-light-accent dark:bg-dark-accent text-white'
                : 'bg-black/5 dark:bg-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Card
            label="Fokus vaqti"
            value={formatDuration(data?.totalFocusSeconds || 0)}
          />
          <Card label="Vazifalar" value={String(data?.tasksDone || 0)} />
          <Card
            label="Eng samarali soat"
            value={data ? `${data.productiveHour}:00` : '—'}
          />
          <Card
            label="Streak"
            value={`${data?.streak || 0} kun`}
            sub=">2s fokus"
          />
        </div>

        <div className="p-4 rounded-2xl bg-light-accent/10 dark:bg-dark-accent/15">
          <p className="text-sm font-medium">Samaradorlik balli</p>
          <p className="text-3xl font-bold text-light-accent dark:text-dark-accent">
            {data?.productivityScore ?? 0}
            <span className="text-lg font-normal text-light-dim">/100</span>
          </p>
        </div>

        {chartData.length > 0 && projectKeys.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase text-light-dim mb-2">
              Kunlik vaqt (loyiha)
            </h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {projectKeys.slice(0, 5).map((k, i) => (
                    <Bar
                      key={k}
                      dataKey={k}
                      stackId="a"
                      fill={['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#5856D6'][i]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold uppercase text-light-dim mb-2">
            Top 10 ilovalar
          </h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.topApps?.map((a) => ({
                  name: a.name.slice(0, 12),
                  min: Math.round(a.seconds / 60),
                }))}
                layout="vertical"
              >
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="min" fill="#5856D6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ label, value, sub }) {
  return (
    <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]">
      <p className="text-[10px] uppercase text-light-dim">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-light-dim">{sub}</p>}
    </div>
  );
}
