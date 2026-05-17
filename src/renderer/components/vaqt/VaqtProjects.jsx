import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, V } from './vaqtTheme';
import { fmtHM } from '../../utils/vaqtFormat';

function Caret({ open, small }) {
  const s = small ? 8 : 9;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 10 10"
      style={{
        transform: open ? 'rotate(90deg)' : 'rotate(0)',
        transition: 'transform 120ms ease',
        flexShrink: 0,
      }}
    >
      <path d="M3 2l4 3-4 3z" fill="#8a8a93" />
    </svg>
  );
}

function EntryRow({ entry }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 90px',
        alignItems: 'center',
        padding: '5px 6px 5px 50px',
        borderBottom: '1px solid #f6f6f8',
        background: '#fdfdfe',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#cdcdd3',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12.5,
            color: V.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.title}
        </span>
        <span style={{ fontSize: 11, color: V.dim, fontVariantNumeric: 'tabular-nums' }}>
          {entry.when}
        </span>
      </div>
      <div />
      <div
        style={{
          textAlign: 'right',
          fontSize: 11.5,
          color: V.label,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {entry.minutes} daq
      </div>
    </div>
  );
}

function TaskGroup({ task, open, onToggle }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '16px 1fr 80px 90px',
          gap: 8,
          alignItems: 'center',
          width: '100%',
          padding: '6px 6px 6px 28px',
          border: 'none',
          borderBottom: '1px solid #f0f0f3',
          background: open ? '#fafafb' : 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <Caret open={open} small />
        <span
          style={{
            fontSize: 12.5,
            color: V.text,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.name}
        </span>
        <div />
        <span
          style={{
            textAlign: 'right',
            fontSize: 11.5,
            color: V.label,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {task.minutes} daq
        </span>
      </button>
      {open && task.entries?.map((e) => <EntryRow key={e.id} entry={e} />)}
    </div>
  );
}

function ProjectRow({ project, expanded, onToggle, openTasks, onToggleTask }) {
  const open = expanded.has(project.id);
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(project.id)}
        style={{
          display: 'grid',
          gridTemplateColumns: '16px 12px 1fr 80px 90px',
          gap: 8,
          alignItems: 'center',
          width: '100%',
          padding: '7px 6px',
          border: 'none',
          borderBottom: '1px solid #ececef',
          background: open ? '#f8f8fa' : 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <Caret open={open} />
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: project.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, color: V.text, fontWeight: 600 }}>{project.name}</span>
        <div />
        <span
          style={{
            textAlign: 'right',
            fontSize: 12,
            color: V.text,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtHM(project.seconds)}
        </span>
      </button>
      {open &&
        project.children?.map((task) => (
          <TaskGroup
            key={task.id}
            task={task}
            open={openTasks.has(task.id)}
            onToggle={() => onToggleTask(task.id)}
          />
        ))}
    </div>
  );
}

export default function VaqtProjects({ projects, filterProjectId }) {
  const filtered =
    filterProjectId != null
      ? projects.filter((p) => p.id === filterProjectId)
      : projects;
  const total = filtered.reduce((s, p) => s + p.seconds, 0);
  const [expanded, setExpanded] = useState(() => new Set());
  const [openTasks, setOpenTasks] = useState(() => new Set());
  const [hover, setHover] = useState(null);

  const toggleProject = (id) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTask = (id) => {
    setOpenTasks((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card padding={18} style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: V.text }}>
          Loyihalar va vaqt yozuvlari
        </div>
        <div style={{ fontSize: 11.5, color: V.label }}>
          {filtered.length} loyiha · {fmtHM(total)}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: 18,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ position: 'sticky', top: 0, paddingTop: 6 }}>
          <div style={{ position: 'relative', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={filtered}
                  dataKey="seconds"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={86}
                  paddingAngle={1.4}
                  stroke="none"
                  onMouseEnter={(_, i) => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {filtered.map((p, i) => (
                    <Cell
                      key={p.id}
                      fill={p.color}
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
                textAlign: 'center',
              }}
            >
              {hover != null ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: filtered[hover].color,
                      marginBottom: 4,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: V.label,
                      maxWidth: 110,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {filtered[hover].name}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: V.text }}>
                    {fmtHM(filtered[hover].seconds)}
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
                    kuzatilgan
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          {filtered.length === 0 && (
            <p style={{ fontSize: 13, color: V.dim, padding: 16, textAlign: 'center' }}>
              Ma&apos;lumot yo&apos;q
            </p>
          )}
          {filtered.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              expanded={expanded}
              onToggle={toggleProject}
              openTasks={openTasks}
              onToggleTask={toggleTask}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
