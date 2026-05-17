import { useEffect, useState } from 'react';
import ProjectDetail from './ProjectDetail';
import { formatProjectFocusMeta } from '../utils/projectLock';

export default function Projects({ onStartFocus, focusState }) {
  const [areas, setAreas] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  const load = async () => {
    const [a, p] = await Promise.all([
      window.focusflow.areas.getAll(),
      window.focusflow.projects.getAll(),
    ]);
    setAreas(a);
    setProjects(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (selectedProject) {
    const project =
      projects.find((p) => p.id === selectedProject.id) || selectedProject;
    return (
      <ProjectDetail
        project={project}
        onBack={() => setSelectedProject(null)}
        onStartFocus={onStartFocus}
        focusState={focusState}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-light-dim dark:text-dark-dim text-sm pt-12">
        Yuklanmoqda...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-5 pt-12 pb-3 shrink-0">
        <h1 className="text-2xl font-semibold">Loyihalar</h1>
        <p className="text-sm text-light-dim dark:text-dark-dim mt-0.5">
          Loyihani tanlang
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        {areas.map((area) => {
          const areaProjects = projects.filter((p) => p.area_id === area.id);
          return (
            <section key={area.id}>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: area.color }}
                />
                {area.name}
              </h2>
              <div className="space-y-2">
                {areaProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProject(project)}
                    className="w-full text-left p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5 transition-all duration-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{project.name}</h3>
                        <p className="text-xs text-light-dim dark:text-dark-dim mt-1">
                          {formatProjectFocusMeta(project)}
                        </p>
                      </div>
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                    </div>
                    {project.block_list?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {project.block_list.map((site) => (
                          <span
                            key={site}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400"
                          >
                            🚫 {site}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
                {areaProjects.length === 0 && (
                  <p className="text-xs text-light-dim dark:text-dark-dim pl-1">
                    Loyiha yo'q
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
