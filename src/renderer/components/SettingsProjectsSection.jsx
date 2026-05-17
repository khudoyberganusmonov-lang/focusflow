import { useCallback, useEffect, useState } from 'react';
import ProjectFormModal from './ProjectFormModal';
import AreaFormModal from './AreaFormModal';
import ConfirmDialog from './ConfirmDialog';

function innerButtonClass() {
  return 'w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-black/10 dark:hover:bg-white/10';
}

export default function SettingsProjectsSection() {
  const [projects, setProjects] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [projectModal, setProjectModal] = useState(null);
  const [areaModal, setAreaModal] = useState(null);
  const [deleteProject, setDeleteProject] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        window.focusflow.projects.getAll(),
        window.focusflow.areas.getAll(),
      ]);
      setProjects(p || []);
      setAreas(a || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveProject = async (data) => {
    const res = await window.focusflow.projects.save(data);
    if (res?.error) throw new Error(res.message);
    await load();
  };

  const handleDeleteProject = async () => {
    if (!deleteProject) return;
    await window.focusflow.projects.delete(deleteProject.id);
    setDeleteProject(null);
    await load();
  };

  const handleSaveArea = async (data) => {
    if (data.id) {
      await window.focusflow.areas.update(data);
    } else {
      await window.focusflow.areas.create(data);
    }
    await load();
  };

  const handleDeleteArea = async (area) => {
    const res = await window.focusflow.areas.delete(area.id);
    if (res?.error === true && res.message === 'has_projects') {
      window.alert(
        `Bu areada ${res.count} ta loyiha bor. Avval loyihalarni o'chiring yoki ko'chiring.`
      );
      return;
    }
    await load();
  };

  return (
    <>
      <div className="px-4 py-3 border-b border-[#E5E5EA] dark:border-white/10">
        <button
          type="button"
          onClick={() => setProjectModal('new')}
          disabled={!areas.length}
          className="w-full py-2.5 rounded-xl bg-[#007AFF] text-white text-sm font-semibold disabled:opacity-40"
        >
          + Yangi loyiha
        </button>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-sm text-center text-[rgba(60,60,67,0.6)]">
          Yuklanmoqda…
        </p>
      ) : projects.length === 0 ? (
        <p className="px-4 py-6 text-sm text-center text-[rgba(60,60,67,0.6)]">
          Loyiha yo&apos;q
        </p>
      ) : (
        <ul>
          {projects.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i < projects.length - 1
                  ? 'border-b border-[#E5E5EA] dark:border-white/10'
                  : ''
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-white truncate">
                  {p.name}
                </p>
                <p className="text-[11px] text-[rgba(60,60,67,0.6)] truncate">
                  {p.area_name}
                </p>
              </div>
              <button
                type="button"
                className={innerButtonClass()}
                onClick={() => setProjectModal(p.id)}
                aria-label="Tahrirlash"
              >
                ✏️
              </button>
              <button
                type="button"
                className={innerButtonClass()}
                onClick={() => setDeleteProject(p)}
                aria-label="O'chirish"
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[#E5E5EA] dark:border-white/10 mt-2">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[rgba(60,60,67,0.6)]">
            Arealar
          </span>
          <button
            type="button"
            onClick={() => setAreaModal('new')}
            className="text-xs font-medium text-[#007AFF]"
          >
            + Yangi area
          </button>
        </div>
        {areas.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-[rgba(60,60,67,0.6)]">Area yo&apos;q</p>
        ) : (
          <ul className="pb-2">
            {areas.map((a, i) => (
              <li
                key={a.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  i < areas.length - 1
                    ? 'border-b border-[#E5E5EA] dark:border-white/10'
                    : ''
                }`}
              >
                <span className="text-lg">{a.icon || '📁'}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: a.color }}
                />
                <span className="flex-1 text-sm font-medium truncate">{a.name}</span>
                <button
                  type="button"
                  className={innerButtonClass()}
                  onClick={() => setAreaModal(a)}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className={innerButtonClass()}
                  onClick={() => handleDeleteArea(a)}
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProjectFormModal
        open={projectModal !== null}
        projectId={projectModal === 'new' ? null : projectModal}
        areas={areas}
        onClose={() => setProjectModal(null)}
        onSave={handleSaveProject}
      />

      <AreaFormModal
        open={areaModal !== null}
        area={areaModal === 'new' ? null : areaModal}
        onClose={() => setAreaModal(null)}
        onSave={handleSaveArea}
      />

      <ConfirmDialog
        open={Boolean(deleteProject)}
        message={
          deleteProject
            ? `${deleteProject.name} loyihasini o'chirasizmi?\nBarcha vazifalar ham o'chiriladi.`
            : ''
        }
        onCancel={() => setDeleteProject(null)}
        onConfirm={handleDeleteProject}
      />
    </>
  );
}
