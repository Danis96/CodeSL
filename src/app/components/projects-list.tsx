import { useState } from 'react';
import { Search, Plus, Grid3X3, List, Calendar, ArrowUpRight, Clock, CheckSquare, Github } from 'lucide-react';
import { useWorkspace } from '../data/workspace-context';
import CreateProjectModal from './create-project-modal';

interface ProjectsListProps {
  onProjectClick: (id: string) => void;
}

const pColors: Record<string, { bg: string; text: string }> = {
  Critical: { bg: 'rgba(197,255,98,0.18)', text: '#c5ff62' },
  High: { bg: 'rgba(154,255,114,0.18)', text: '#9aff72' },
  Medium: { bg: 'rgba(120,247,184,0.18)', text: '#78f7b8' },
  Low: { bg: 'rgba(94,213,100,0.18)', text: '#5ed564' },
};

const sColors: Record<string, { bg: string; text: string }> = {
  Active: { bg: 'rgba(94,213,100,0.14)', text: '#74ff7d' },
  'On Hold': { bg: 'rgba(120,247,184,0.14)', text: '#78f7b8' },
  Completed: { bg: 'rgba(98,255,191,0.14)', text: '#62ffbf' },
  Planning: { bg: 'rgba(139,255,119,0.14)', text: '#8bff77' },
};

export default function ProjectsList({ onProjectClick }: ProjectsListProps) {
  const { projects, members } = useWorkspace();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');

  const filtered = projects.filter((p) =>
    (p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())) &&
    (filterPriority === 'All' || p.priority === filterPriority)
  );

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex flex-wrap items-center gap-3 px-6 py-4 shrink-0"
        style={{ background: 'rgba(5,8,5,0.88)', borderBottom: '1px solid rgba(121,255,102,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <div>
          <h1 className="matrix-title" style={{ color: '#8cff5a', fontSize: '18px', fontWeight: 800, letterSpacing: '0.08em' }}>PROJECTS</h1>
          <p className="matrix-muted" style={{ fontSize: '12px' }}>{projects.length} total · {projects.filter(p => p.status === 'Active').length} active</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="matrix-input flex items-center gap-2 rounded-xl px-3" style={{ height: '38px', width: '220px' }}>
            <Search size={13} style={{ color: '#5e7f58' }} />
            <input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent outline-none" style={{ color: '#e2ffd8', fontSize: '13px' }} />
          </div>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-xl px-3 outline-none cursor-pointer"
            style={{ background: 'rgba(8,18,8,0.92)', border: '1px solid rgba(121,255,102,0.12)', color: '#c7eac1', fontSize: '12px', height: '38px', colorScheme: 'dark' }}
          >
            {['All', 'Critical', 'High', 'Medium', 'Low'].map(o => <option key={o}>{o}</option>)}
          </select>

          <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(8,18,8,0.92)', border: '1px solid rgba(121,255,102,0.12)' }}>
            {(['grid', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className="flex items-center justify-center transition-all" style={{ width: '38px', height: '38px', background: view === v ? 'rgba(121,255,102,0.14)' : 'transparent', color: view === v ? '#8cff5a' : '#89bd80' }}>
                {v === 'grid' ? <Grid3X3 size={14} /> : <List size={14} />}
              </button>
            ))}
          </div>

          <button onClick={() => setShowCreate(true)} className="matrix-button flex items-center gap-2 rounded-xl px-4 transition-all hover:opacity-90 active:scale-95" style={{ fontSize: '13px', fontWeight: 600, height: '38px' }}>
            <Plus size={14} />New Project
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
        {view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.length === 0 && (
              <div className="matrix-panel rounded-2xl p-6 matrix-muted" style={{ fontSize: '13px' }}>
                No projects match current filters.
              </div>
            )}
            {filtered.map((project) => {
              const { bg: pBg, text: pText } = pColors[project.priority];
              const { bg: sBg, text: sText } = sColors[project.status];
              return (
                <div
                  key={project.id}
                  onClick={() => onProjectClick(project.id)}
                  className="matrix-panel rounded-2xl overflow-hidden cursor-pointer transition-all hover:translate-y-[-2px]"
                >
                  {/* Gradient header */}
                  <div className="relative h-24 flex items-end px-5 pb-3" style={{ background: `linear-gradient(135deg, ${project.gradientFrom} 0%, ${project.gradientTo} 100%)` }}>
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(209,255,203,0.32) 0%, transparent 60%)' }} />
                    <div className="flex items-center justify-between w-full relative z-10">
                      <span className="rounded-full px-2.5 py-0.5" style={{ background: 'rgba(4,16,4,0.48)', color: 'rgba(245,255,240,0.92)', fontSize: '10px', fontWeight: 600 }}>{project.epicCount} Epics</span>
                      <span className="rounded-full px-2.5 py-0.5" style={{ background: sBg, color: sText, fontSize: '10px', fontWeight: 700 }}>{project.status}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '14px', fontWeight: 700 }}>{project.title}</h3>
                        {project.github && (
                          <div className="flex items-center gap-1 mt-1" style={{ color: '#89bd80', fontSize: '10px' }}>
                            <Github size={10} />
                            <span>{project.github.fullName}</span>
                          </div>
                        )}
                      </div>
                      <span className="ml-2 shrink-0 rounded-full px-2 py-0.5" style={{ background: pBg, color: pText, fontSize: '10px', fontWeight: 700 }}>{project.priority}</span>
                    </div>
                    <p className="mb-4 matrix-copy" style={{ fontSize: '12px', lineHeight: '1.6', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', opacity: 0.82 }}>{project.description}</p>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="matrix-muted" style={{ fontSize: '11px' }}>{project.completedTaskCount}/{project.taskCount} tasks</span>
                        <span style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 700 }}>{project.progress}%</span>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ height: '4px', background: 'rgba(121,255,102,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${project.gradientFrom}, ${project.gradientTo})` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {project.memberIds.slice(0, 4).map((mid) => {
                          const m = members.find((x) => x.id === mid);
                          return m ? (
                            <div key={m.id} className="flex items-center justify-center rounded-full text-white" title={m.name} style={{ width: '26px', height: '26px', background: m.color, border: '2px solid #0a140a', fontSize: '9px', fontWeight: 700 }}>
                              {m.initials[0]}
                            </div>
                          ) : null;
                        })}
                      </div>
                      <div className="flex items-center gap-1" style={{ color: '#5e7f58' }}>
                        <Calendar size={11} />
                        <span style={{ fontSize: '11px' }}>{project.dueDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setShowCreate(true)}
              className="matrix-panel-soft rounded-2xl flex flex-col items-center justify-center gap-3 transition-all"
              style={{ minHeight: '200px', border: '1px dashed rgba(121,255,102,0.16)' }}
            >
              <div className="flex items-center justify-center rounded-2xl" style={{ width: '44px', height: '44px', background: 'rgba(121,255,102,0.12)' }}>
                <Plus size={20} style={{ color: '#8cff5a' }} />
              </div>
              <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 600 }}>New Project</div>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="matrix-panel rounded-2xl p-6 matrix-muted" style={{ fontSize: '13px' }}>
                No projects match current filters.
              </div>
            )}
            {filtered.map((project) => (
              <div
                key={project.id}
                onClick={() => onProjectClick(project.id)}
                className="matrix-panel flex items-center gap-5 rounded-2xl px-5 py-4 cursor-pointer transition-all"
              >
                <div className="rounded-xl flex items-center justify-center text-white shrink-0" style={{ width: '44px', height: '44px', background: `linear-gradient(135deg, ${project.gradientFrom}, ${project.gradientTo})`, fontSize: '16px', fontWeight: 800 }}>
                  {project.title[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>{project.title}</h3>
                  <p className="truncate matrix-copy" style={{ fontSize: '12px', opacity: 0.82 }}>{project.description}</p>
                  {project.github && (
                    <div className="flex items-center gap-1 mt-1" style={{ color: '#89bd80', fontSize: '10px' }}>
                      <Github size={10} />
                      <span>{project.github.fullName}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <div className="hidden md:flex items-center gap-1.5" style={{ color: '#5e7f58' }}>
                    <CheckSquare size={12} />
                    <span style={{ fontSize: '12px' }}>{project.completedTaskCount}/{project.taskCount}</span>
                  </div>
                  <div className="hidden lg:flex items-center gap-1.5" style={{ color: '#5e7f58' }}>
                    <Clock size={12} />
                    <span style={{ fontSize: '12px' }}>{project.dueDate}</span>
                  </div>
                  <div className="flex -space-x-2">
                    {project.memberIds.slice(0, 3).map((mid) => {
                      const m = members.find((x) => x.id === mid);
                      return m ? <div key={m.id} className="flex items-center justify-center rounded-full text-white" style={{ width: '24px', height: '24px', background: m.color, border: '2px solid #0a140a', fontSize: '8px', fontWeight: 700 }}>{m.initials[0]}</div> : null;
                    })}
                  </div>
                  <span className="rounded-full px-2.5 py-0.5" style={{ background: pColors[project.priority].bg, color: pColors[project.priority].text, fontSize: '10px', fontWeight: 700 }}>{project.priority}</span>
                  <div style={{ width: '70px' }}>
                    <div className="rounded-full overflow-hidden" style={{ height: '3px', background: 'rgba(121,255,102,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${project.gradientFrom}, ${project.gradientTo})` }} />
                    </div>
                    <span className="matrix-muted" style={{ fontSize: '10px' }}>{project.progress}%</span>
                  </div>
                  <ArrowUpRight size={15} style={{ color: '#5e7f58' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} />}
    </div>
  );
}
