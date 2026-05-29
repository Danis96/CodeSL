import { useMemo, useState } from 'react';
import {
  Search, Bell, Plus, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  FolderKanban, ArrowRight, ChevronRight, Layers, Users, Activity as ActivityIcon,
} from 'lucide-react';
import { useWorkspace } from '../data/workspace-context';
import type { Page } from '../App';
import type { Task } from '../data/mock-data';
import CreateProjectModal from './create-project-modal';
import TaskModal from './task-modal';

interface DashboardProps {
  onProjectClick: (id: string) => void;
  onNavigate: (page: Page) => void;
}

const pColors: Record<string, string> = {
  Critical: '#c5ff62',
  High: '#9aff72',
  Medium: '#78f7b8',
  Low: '#5ed564',
};

export default function Dashboard({ onProjectClick, onNavigate }: DashboardProps) {
  const { projects, tasks, members, activities, currentUser } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const query = search.trim().toLowerCase();
  const activeTasks = tasks.filter((t) => t.status === 'In Progress').length;
  const completedTasks = tasks.filter((t) => t.status === 'Done' || t.status === 'Released').length;
  const inProgress = tasks.filter((t) => t.status === 'In Progress' || t.status === 'Test').length;
  const overdue = tasks.filter((t) => t.dueDate && Date.parse(t.dueDate) < Date.now() && t.status !== 'Done' && t.status !== 'Released').length;
  const myTasks = currentUser ? tasks.filter((t) => t.assigneeId === currentUser.id).slice(0, 5) : [];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const filteredProjects = useMemo(() => (
    query
      ? projects.filter((project) => `${project.title} ${project.description}`.toLowerCase().includes(query))
      : projects
  ), [projects, query]);

  const filteredMyTasks = useMemo(() => (
    query
      ? myTasks.filter((task) => `${task.title} ${task.description} ${task.tags.join(' ')}`.toLowerCase().includes(query))
      : myTasks
  ), [myTasks, query]);

  const filteredActivities = useMemo(() => (
    query
      ? activities.filter((activity) => {
        if (activity.visibility === 'system') {
          return false;
        }
        const member = members.find((item) => item.id === activity.userId);
        return `${activity.target} ${activity.action} ${member?.name || ''}`.toLowerCase().includes(query);
      })
      : activities.filter((activity) => activity.visibility !== 'system')
  ), [activities, members, query]);

  const searchProjects = filteredProjects.slice(0, 3);
  const searchTasks = useMemo(() => (
    query
      ? tasks.filter((task) => `${task.title} ${task.description} ${task.tags.join(' ')}`.toLowerCase().includes(query)).slice(0, 4)
      : []
  ), [query, tasks]);
  const searchMembers = useMemo(() => (
    query
      ? members.filter((member) => `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(query)).slice(0, 3)
      : []
  ), [members, query]);

  const hasSearchResults = query.length > 0;
  const resultCount = searchProjects.length + searchTasks.length + searchMembers.length;

  return (
    <div className="flex flex-col h-full">
      <header
        className="flex items-center gap-4 px-6 shrink-0"
        style={{ background: 'rgba(5,8,5,0.88)', borderBottom: '1px solid rgba(121,255,102,0.12)', height: '60px', backdropFilter: 'blur(12px)' }}
      >
        <div
          className="matrix-input flex items-center gap-2 rounded-xl px-4"
          style={{ height: '38px', width: '380px', maxWidth: '100%' }}
        >
          <Search size={14} style={{ color: '#5e7f58', flexShrink: 0 }} />
          <input
            placeholder="Search tasks, projects, members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ color: '#e2ffd8', fontSize: '13px' }}
          />
          <kbd className="hidden rounded-md px-1.5 py-0.5 sm:block" style={{ background: 'rgba(121,255,102,0.07)', color: '#5e7f58', fontSize: '10px', fontFamily: 'inherit' }}>
            {resultCount}
          </kbd>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => onNavigate('stats')}
            className="relative flex items-center justify-center rounded-xl transition-all hover:opacity-80"
            style={{ width: '38px', height: '38px', background: 'rgba(8,18,8,0.88)', border: '1px solid rgba(121,255,102,0.12)', color: '#89bd80' }}
          >
            <Bell size={15} />
            <span className="absolute rounded-full" style={{ width: '7px', height: '7px', background: '#8cff5a', top: '9px', right: '9px', boxShadow: '0 0 10px rgba(140,255,90,0.5)' }} />
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className="flex items-center justify-center rounded-full cursor-pointer hover:opacity-80 transition-all text-white"
            style={{ width: '34px', height: '34px', background: currentUser?.color || '#3f5a3f', fontSize: '12px', fontWeight: 700, boxShadow: `0 0 12px ${currentUser?.color || '#3f5a3f'}40` }}
          >
            {currentUser?.initials || 'U'}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20 md:pb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="matrix-kicker" style={{ fontSize: '12px', marginBottom: '10px' }}>
              [workspace.status]
            </div>
            <h1 className="matrix-title" style={{ color: '#8cff5a', fontSize: '24px', fontWeight: 700, letterSpacing: '0.05em' }}>
              SYSTEM_OVERVIEW
            </h1>
            <p className="matrix-copy" style={{ fontSize: '14px', marginTop: '8px', maxWidth: '720px', lineHeight: 1.7 }}>
              {greeting}, {currentUser?.name.split(' ')[0] || 'operator'}. <span style={{ color: '#9aff72', fontWeight: 600 }}>{activeTasks} active tasks</span> across {projects.length} live projects. Readability first, noise second.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="matrix-button hidden items-center gap-2 rounded-xl px-4 py-2.5 transition-all hover:opacity-90 active:scale-95 md:flex"
            style={{ fontSize: '13px', fontWeight: 600 }}
          >
            <Plus size={15} />
            New Project
          </button>
        </div>

        {hasSearchResults && (
          <div className="matrix-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="matrix-title" style={{ color: '#cdefc6', fontSize: '13px', fontWeight: 700 }}>Search Results</h2>
                <p className="matrix-muted" style={{ fontSize: '12px', marginTop: '4px' }}>{resultCount} matches for "{search.trim()}"</p>
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <SearchGroup title="Projects" icon={FolderKanban} count={searchProjects.length}>
                {searchProjects.length === 0 ? (
                  <EmptyResult label="No project match." />
                ) : searchProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onProjectClick(project.id)}
                    className="w-full rounded-xl p-3 text-left transition-all hover:opacity-80"
                    style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.1)' }}
                  >
                    <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '11px', fontWeight: 700 }}>{project.title}</div>
                    <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '4px' }}>{project.progress}% complete</div>
                  </button>
                ))}
              </SearchGroup>
              <SearchGroup title="Tasks" icon={Layers} count={searchTasks.length}>
                {searchTasks.length === 0 ? (
                  <EmptyResult label="No task match." />
                ) : searchTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="w-full rounded-xl p-3 text-left transition-all hover:opacity-80"
                    style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.1)' }}
                  >
                    <div style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 600 }}>{task.title}</div>
                    <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '4px' }}>{task.status} · {task.priority}</div>
                  </button>
                ))}
              </SearchGroup>
              <SearchGroup title="Members" icon={Users} count={searchMembers.length}>
                {searchMembers.length === 0 ? (
                  <EmptyResult label="No member match." />
                ) : searchMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => onNavigate('members')}
                    className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all hover:opacity-80"
                    style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.1)' }}
                  >
                    <div className="flex items-center justify-center rounded-full text-white" style={{ width: '28px', height: '28px', background: member.color, fontSize: '10px', fontWeight: 700 }}>
                      {member.initials}
                    </div>
                    <div>
                      <div style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 600 }}>{member.name}</div>
                      <div className="matrix-muted" style={{ fontSize: '11px' }}>{member.role}</div>
                    </div>
                  </button>
                ))}
              </SearchGroup>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Projects', value: projects.length, icon: FolderKanban, color: '#8bff77', bg: 'rgba(139,255,119,0.12)', page: 'projects' as Page },
            { label: 'Active Tasks', value: activeTasks, icon: TrendingUp, color: '#62ffbf', bg: 'rgba(98,255,191,0.12)', page: 'projects' as Page },
            { label: 'Completed', value: completedTasks, icon: CheckCircle2, color: '#74ff7d', bg: 'rgba(116,255,125,0.12)', page: 'stats' as Page },
            { label: 'In Progress', value: inProgress, icon: Clock, color: '#78f7b8', bg: 'rgba(120,247,184,0.12)', page: 'projects' as Page },
            { label: 'Overdue', value: overdue, icon: AlertTriangle, color: '#c5ff62', bg: 'rgba(197,255,98,0.12)', page: 'stats' as Page },
          ].map(({ label, value, icon: Icon, color, bg, page }) => (
            <button
              key={label}
              onClick={() => onNavigate(page)}
              className="matrix-panel rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center rounded-xl" style={{ width: '40px', height: '40px', background: bg }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <ArrowRight size={12} style={{ color: '#5e7f58' }} />
              </div>
              <div className="matrix-title" style={{ color: '#e8ffe1', fontSize: '24px', fontWeight: 700, lineHeight: 1 }}>{String(value).padStart(2, '0')}</div>
              <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '6px' }}>{label}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="matrix-title" style={{ color: '#cdefc6', fontSize: '14px', fontWeight: 700 }}>Project Stream</h2>
              <button onClick={() => onNavigate('projects')} className="flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: '#8cff5a', fontSize: '13px', fontWeight: 500 }}>
                View all<ChevronRight size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {filteredProjects.length === 0 && (
                <div className="matrix-panel rounded-2xl p-6" style={{ color: '#5e7f58', fontSize: '13px' }}>
                  {hasSearchResults ? 'No projects match current search.' : 'No projects yet. Create first one to start syncing Firestore data.'}
                </div>
              )}
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onProjectClick(project.id)}
                  className="matrix-panel rounded-2xl overflow-hidden cursor-pointer transition-all hover:translate-y-[-1px]"
                >
                  <div style={{ height: '3px', background: `linear-gradient(90deg, ${project.gradientFrom} 0%, ${project.gradientTo} 100%)` }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ width: '36px', height: '36px', background: `linear-gradient(135deg, ${project.gradientFrom} 0%, ${project.gradientTo} 100%)`, fontSize: '14px', fontWeight: 800, boxShadow: `0 0 18px ${project.gradientFrom}25` }}
                        >
                          {project.title[0]}
                        </div>
                        <div>
                          <h3 className="matrix-title" style={{ color: '#e2ffd8', fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em' }}>{project.title}</h3>
                          <p className="truncate matrix-copy" style={{ fontSize: '12px', maxWidth: '260px', opacity: 0.82 }}>{project.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded-full px-2.5 py-0.5" style={{ background: `${pColors[project.priority]}18`, color: pColors[project.priority], fontSize: '10px', fontWeight: 700 }}>
                          {project.priority}
                        </span>
                        <ArrowRight size={14} style={{ color: '#5e7f58' }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="matrix-muted" style={{ fontSize: '11px' }}>{project.completedTaskCount}/{project.taskCount} tasks</span>
                          <span style={{ color: '#e2ffd8', fontSize: '11px', fontWeight: 700 }}>{project.progress}%</span>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ height: '4px', background: 'rgba(121,255,102,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${project.gradientFrom}, ${project.gradientTo})` }} />
                        </div>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onNavigate('members');
                        }}
                        className="flex -space-x-2 shrink-0"
                      >
                        {project.memberIds.slice(0, 4).map((mid) => {
                          const m = members.find((x) => x.id === mid);
                          return m ? (
                            <div key={m.id} className="flex items-center justify-center rounded-full text-white" style={{ width: '22px', height: '22px', background: m.color, border: '2px solid #0a140a', fontSize: '8px', fontWeight: 700 }}>
                              {m.initials[0]}
                            </div>
                          ) : null;
                        })}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="matrix-panel rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(121,255,102,0.1)' }}>
                <h2 className="matrix-title" style={{ color: '#cdefc6', fontSize: '12px', fontWeight: 700 }}>Assigned Queue</h2>
                <button
                  onClick={() => onNavigate('projects')}
                  className="rounded-full px-2 py-0.5"
                  style={{ background: 'rgba(121,255,102,0.12)', color: '#8cff5a', fontSize: '11px', fontWeight: 700 }}
                >
                  {filteredMyTasks.length}
                </button>
              </div>
              <div>
                {filteredMyTasks.length === 0 && <div className="px-5 py-4 matrix-muted" style={{ fontSize: '12px' }}>{hasSearchResults ? 'No task match in your queue.' : 'No assigned tasks yet.'}</div>}
                {filteredMyTasks.map((task, i) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:opacity-80 cursor-pointer transition-opacity text-left"
                    style={{ borderBottom: i < filteredMyTasks.length - 1 ? '1px solid rgba(121,255,102,0.06)' : 'none' }}
                  >
                    <div className="rounded-full shrink-0" style={{ width: '8px', height: '8px', background: task.accentColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate matrix-copy" style={{ fontSize: '12px', fontWeight: 500 }}>{task.title}</div>
                      <div className="matrix-muted" style={{ fontSize: '10px' }}>{task.dueDate || task.status}</div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5" style={{ background: `${pColors[task.priority]}18`, color: pColors[task.priority], fontSize: '9px', fontWeight: 700 }}>
                      {task.priority}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="matrix-panel rounded-2xl overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(121,255,102,0.1)' }}>
                <h2 className="matrix-title" style={{ color: '#cdefc6', fontSize: '12px', fontWeight: 700 }}>Signal Log</h2>
              </div>
              <div className="p-4 space-y-3">
                {filteredActivities.length === 0 && <div className="matrix-muted" style={{ fontSize: '12px' }}>{hasSearchResults ? 'No activity match.' : 'No recent activity yet.'}</div>}
                {filteredActivities.slice(0, 5).map((act) => {
                  const member = members.find((m) => m.id === act.userId);
                  return (
                    <button
                      key={act.id}
                      onClick={() => {
                        if (act.projectId) {
                          onProjectClick(act.projectId);
                          return;
                        }
                        onNavigate('stats');
                      }}
                      className="w-full flex items-start gap-3 text-left"
                    >
                      <div
                        className="flex items-center justify-center rounded-full text-white shrink-0"
                        style={{ width: '26px', height: '26px', background: member?.color || '#3f5a3f', fontSize: '9px', fontWeight: 700, marginTop: '2px' }}
                      >
                        {member?.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="matrix-copy" style={{ fontSize: '12px', lineHeight: '1.65' }}>
                          <span style={{ color: '#ebffe5', fontWeight: 600 }}>{member?.name.split(' ')[0]}</span>
                          {' '}{act.action}{' '}
                          <span style={{ color: '#c7eac1' }}>{act.target}</span>
                        </p>
                        <span className="matrix-muted" style={{ fontSize: '10px' }}>{act.timestamp}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} />}
      {selectedTask && <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}

function SearchGroup({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof FolderKanban;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#081208', border: '1px solid rgba(121,255,102,0.08)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={13} style={{ color: '#8cff5a' }} />
          <span className="matrix-title" style={{ color: '#ebffe5', fontSize: '11px', fontWeight: 700 }}>{title}</span>
        </div>
        <span className="matrix-muted" style={{ fontSize: '11px' }}>{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyResult({ label }: { label: string }) {
  return <div className="matrix-muted" style={{ fontSize: '12px' }}>{label}</div>;
}
