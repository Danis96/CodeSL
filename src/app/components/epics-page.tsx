import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Layers, CheckCircle2, Circle, Sparkles, Calendar, Pencil, Trash2, ArrowRight, Link2, X, Grip,
} from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from 'sonner';
import type { Epic, Task } from '../data/mock-data';
import { useWorkspace } from '../data/workspace-context';

type ModalMode = 'create' | 'edit';

interface EpicDraft {
  title: string;
  description: string;
  color: string;
  projectId: string;
  endDate: string;
}

interface DragTaskItem {
  type: 'EPIC_TASK';
  taskId: string;
  source: 'available' | 'linked';
  currentIndex?: number;
}

const epicPalette = [
  { color: '#00E5FF', glow: '#0EA5E9', label: 'Ion' },
  { color: '#9BFF66', glow: '#65A30D', label: 'Lime Pulse' },
  { color: '#FF8A00', glow: '#EA580C', label: 'Solar' },
  { color: '#FF4FD8', glow: '#DB2777', label: 'Neon Bloom' },
  { color: '#6EE7B7', glow: '#059669', label: 'Mint Grid' },
  { color: '#FFD84D', glow: '#CA8A04', label: 'Signal' },
];

const emptyDraft = (projectId = ''): EpicDraft => ({
  title: '',
  description: '',
  color: epicPalette[0].color,
  projectId,
  endDate: '',
});

export default function EpicsPage() {
  const {
    epics,
    tasks,
    projects,
    createEpic,
    updateEpic,
    deleteEpic,
    assignTasksToEpic,
    removeTaskFromEpic,
    reorderEpicTasks,
  } = useWorkspace();
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<ModalMode>('create');
  const [activeEpicId, setActiveEpicId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EpicDraft>(emptyDraft(projects[0]?.id || ''));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activeEpic = epics.find((epic) => epic.id === activeEpicId) || null;

  const openCreate = () => {
    setMode('create');
    setActiveEpicId(null);
    setDraft(emptyDraft(projects[0]?.id || ''));
    setShowModal(true);
  };

  const openEdit = (epic: Epic) => {
    setMode('edit');
    setActiveEpicId(epic.id);
    setDraft({
      title: epic.title,
      description: epic.description,
      color: epic.color,
      projectId: epic.projectId,
      endDate: epic.endDate ? epic.endDate.slice(0, 10) : '',
    });
    setShowModal(true);
  };

  const handleSaveEpic = async () => {
    if (!draft.title.trim() || !draft.projectId) {
      toast.error('Epic title and project required.');
      return;
    }

    setSaving(true);

    try {
      if (mode === 'create') {
        await createEpic({
          title: draft.title.trim(),
          description: draft.description.trim(),
          color: draft.color,
          projectId: draft.projectId,
          endDate: draft.endDate,
        });
        toast.success('Epic created.');
      } else if (activeEpic) {
        await updateEpic(activeEpic.id, {
          title: draft.title.trim(),
          description: draft.description.trim(),
          color: draft.color,
          projectId: draft.projectId,
          endDate: draft.endDate,
        });
        toast.success('Epic updated.');
      }

      setShowModal(false);
    } catch (error) {
      console.error(error);
      toast.error('Epic save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEpic = async () => {
    if (!activeEpic) {
      return;
    }

    setDeleting(true);

    try {
      await deleteEpic(activeEpic.id);
      toast.success('Epic deleted.');
      setShowModal(false);
    } catch (error) {
      console.error(error);
      toast.error('Epic delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-6 py-4 shrink-0" style={{ background: 'rgba(5,8,5,0.88)', borderBottom: '1px solid rgba(121,255,102,0.12)', backdropFilter: 'blur(12px)' }}>
          <div>
            <h1 className="matrix-title" style={{ color: '#8cff5a', fontSize: '18px', fontWeight: 800, letterSpacing: '0.08em' }}>EPICS</h1>
            <p className="matrix-muted" style={{ fontSize: '12px' }}>{epics.length} epics · Strategy layer above tasks</p>
          </div>
          <button onClick={openCreate} className="ml-auto flex items-center gap-2 rounded-xl px-4 transition-all hover:opacity-90 active:scale-95" style={{ background: 'linear-gradient(135deg, rgba(120,255,99,0.16), rgba(72,168,66,0.26))', border: '1px solid rgba(121,255,102,0.18)', color: '#e8ffe1', fontSize: '13px', fontWeight: 700, height: '38px', boxShadow: '0 0 24px rgba(90,255,90,0.12)' }}>
            <Plus size={14} />
            Create Epic
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {epics.length === 0 && (
              <div className="matrix-panel rounded-[28px] p-6 matrix-muted" style={{ fontSize: '13px' }}>
                No epics yet. Create first one, then wire tasks into it.
              </div>
            )}

            {epics.map((epic) => {
              const project = projects.find((item) => item.id === epic.projectId);
              const epicTasks = tasks
                .filter((task) => task.epicId === epic.id)
                .sort((left, right) => left.epicOrder - right.epicOrder || left.createdAt.localeCompare(right.createdAt));
              const progress = epic.taskCount > 0 ? Math.round((epic.completedTaskCount / epic.taskCount) * 100) : 0;

              return (
                <button
                  key={epic.id}
                  onClick={() => openEdit(epic)}
                  className="group overflow-hidden rounded-[28px] text-left transition-all hover:translate-y-[-4px]"
                  style={{ background: '#0a140a', border: '1px solid rgba(121,255,102,0.1)', boxShadow: `0 20px 50px ${epic.color}18` }}
                >
                  <div
                    className="relative px-5 pb-5 pt-4"
                    style={{ background: `linear-gradient(135deg, ${epic.color}26 0%, rgba(15,15,15,0.1) 60%)` }}
                  >
                    <div className="absolute right-0 top-0 h-32 w-32 rounded-full" style={{ background: `radial-gradient(circle, ${epic.color}30 0%, transparent 70%)`, transform: 'translate(26px, -24px)' }} />
                    <div className="flex items-start justify-between mb-4 relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${epic.color}22`, border: `1px solid ${epic.color}44` }}>
                        <Sparkles size={18} style={{ color: epic.color }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full px-2.5 py-1" style={{ background: `${epic.color}20`, color: epic.color, fontSize: '11px', fontWeight: 700 }}>
                          {progress}%
                        </span>
                        <div className="rounded-full px-2.5 py-1" style={{ background: 'rgba(4,16,4,0.38)', color: '#ebffe5', fontSize: '11px', fontWeight: 600 }}>
                          {project?.title || 'Project'}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 flex items-center gap-2 relative">
                      <span className="rounded-full px-2.5 py-1" style={{ background: `linear-gradient(135deg, ${epic.color}28, rgba(121,255,102,0.03))`, color: epic.color, fontSize: '10px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                        Epic Lane
                      </span>
                    </div>

                    <h3 className="matrix-title mb-2 relative" style={{ color: '#ebffe5', fontSize: '17px', fontWeight: 800 }}>
                      {epic.title}
                    </h3>
                    <p className="mb-5 relative matrix-copy" style={{ fontSize: '12px', lineHeight: '1.6', minHeight: '40px', opacity: 0.84 }}>
                      {epic.description || 'No epic brief yet.'}
                    </p>

                    <div className="mb-5 rounded-full overflow-hidden relative" style={{ height: '6px', background: 'rgba(121,255,102,0.08)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${epic.color}, #ebffe5)` }} />
                    </div>

                    <div className="space-y-2 relative">
                      {epicTasks.slice(0, 3).map((task) => {
                        const done = task.status === 'Done' || task.status === 'Released';
                        return (
                          <div key={task.id} className="flex items-center gap-2 rounded-2xl px-3 py-2 transition-all group-hover:translate-x-1" style={{ background: 'rgba(121,255,102,0.06)' }}>
                            {done ? <CheckCircle2 size={12} style={{ color: '#37D67A', flexShrink: 0 }} /> : <Circle size={12} style={{ color: epic.color, flexShrink: 0 }} />}
                            <span style={{ color: done ? '#5e7f58' : '#ebffe5', fontSize: '12px', textDecoration: done ? 'line-through' : 'none' }}>
                              {task.title}
                            </span>
                          </div>
                        );
                      })}
                      {epicTasks.length > 3 && (
                        <div className="flex items-center gap-2" style={{ color: '#5e7f58', fontSize: '11px' }}>
                          <ArrowRight size={12} />
                          +{epicTasks.length - 3} more linked tasks
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between pt-4 relative" style={{ borderTop: '1px solid rgba(121,255,102,0.08)' }}>
                      <span className="matrix-copy" style={{ fontSize: '12px' }}>{epic.completedTaskCount}/{epic.taskCount} tasks</span>
                      <span className="flex items-center gap-1.5" style={{ color: '#5e7f58', fontSize: '11px' }}>
                        <Calendar size={11} />
                        {epic.endDate ? `Due ${epic.endDate.slice(0, 10)}` : 'No due date'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            <button onClick={openCreate} className="matrix-panel-soft rounded-[28px] flex flex-col items-center justify-center gap-3 transition-all" style={{ minHeight: '260px', border: '1px dashed rgba(121,255,102,0.14)' }}>
              <div className="flex items-center justify-center rounded-2xl" style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, rgba(121,255,102,0.18), rgba(98,255,191,0.18))' }}>
                <Plus size={22} style={{ color: '#ebffe5' }} />
              </div>
              <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>Create Epic</div>
              <div className="matrix-muted" style={{ fontSize: '12px' }}>Roadmap, theme, initiative</div>
            </button>
          </div>
        </div>

        {showModal && (
          <EpicComposerModal
            mode={mode}
            draft={draft}
            saving={saving}
            deleting={deleting}
            activeEpic={activeEpic}
            projects={projects}
            tasks={tasks}
            onChange={setDraft}
            onClose={() => setShowModal(false)}
            onSave={() => void handleSaveEpic()}
            onDelete={mode === 'edit' ? () => void handleDeleteEpic() : undefined}
            onAssignTask={async (taskId) => {
              if (!activeEpic) {
                return;
              }

              await assignTasksToEpic(activeEpic.id, [taskId]);
              toast.success('Task linked to epic.');
            }}
            onRemoveTask={async (taskId) => {
              await removeTaskFromEpic(taskId);
              toast.success('Task removed from epic.');
            }}
            onReorderTasks={async (orderedTaskIds) => {
              if (!activeEpic) {
                return;
              }

              await reorderEpicTasks(activeEpic.id, orderedTaskIds);
            }}
          />
        )}
      </div>
    </DndProvider>
  );
}

function EpicComposerModal({
  mode,
  draft,
  saving,
  deleting,
  activeEpic,
  projects,
  tasks,
  onChange,
  onClose,
  onSave,
  onDelete,
  onAssignTask,
  onRemoveTask,
  onReorderTasks,
}: {
  mode: ModalMode;
  draft: EpicDraft;
  saving: boolean;
  deleting: boolean;
  activeEpic: Epic | null;
  projects: ReturnType<typeof useWorkspace>['projects'];
  tasks: ReturnType<typeof useWorkspace>['tasks'];
  onChange: (value: EpicDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onAssignTask: (taskId: string) => Promise<void>;
  onRemoveTask: (taskId: string) => Promise<void>;
  onReorderTasks: (orderedTaskIds: string[]) => Promise<void>;
}) {
  const projectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === draft.projectId),
    [draft.projectId, tasks],
  );
  const linkedTasks = useMemo(
    () => activeEpic
      ? projectTasks
        .filter((task) => task.epicId === activeEpic.id)
        .sort((left, right) => left.epicOrder - right.epicOrder || left.createdAt.localeCompare(right.createdAt))
      : [],
    [activeEpic, projectTasks],
  );
  const [linkedPreview, setLinkedPreview] = useState<Task[]>(linkedTasks);

  useEffect(() => {
    setLinkedPreview(linkedTasks);
  }, [linkedTasks]);

  const availableTasks = useMemo(
    () => projectTasks.filter((task) => !task.epicId || task.epicId === ''),
    [projectTasks],
  );
  const selectedPalette = epicPalette.find((item) => item.color === draft.color) || epicPalette[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)' }} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full overflow-hidden rounded-[30px]" style={{ maxWidth: '1180px', maxHeight: '92vh', background: '#0a140a', border: '1px solid rgba(121,255,102,0.14)', boxShadow: `0 50px 120px ${draft.color}22` }}>
        <div
          className="relative overflow-hidden px-6 pb-6 pt-5"
          style={{ background: `linear-gradient(135deg, ${draft.color}30 0%, rgba(4,16,4,0.96) 62%)` }}
        >
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full" style={{ background: `radial-gradient(circle, ${draft.color}38 0%, transparent 70%)`, transform: 'translate(48px, -46px)' }} />
          <div className="flex items-start justify-between gap-4 relative">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full px-3 py-1" style={{ background: `${draft.color}22`, color: draft.color, fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  {mode === 'create' ? 'New Epic' : 'Edit Epic'}
                </span>
                <span className="rounded-full px-3 py-1" style={{ background: 'rgba(4,16,4,0.38)', color: '#ebffe5', fontSize: '10px', fontWeight: 700 }}>
                  {selectedPalette.label}
                </span>
              </div>
              <h2 className="matrix-title" style={{ color: '#ebffe5', fontSize: '24px', fontWeight: 800, letterSpacing: '0.05em' }}>
                {draft.title || 'Epic Composer'}
              </h2>
              <p style={{ color: 'rgba(235,255,229,0.76)', fontSize: '13px', marginTop: '6px' }}>
                Strategy-colored layer, separate from task accents. Build initiative first, wire tasks after.
              </p>
            </div>
            <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(4,16,4,0.32)', color: '#ebffe5', border: '1px solid rgba(121,255,102,0.14)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] overflow-y-auto" style={{ maxHeight: 'calc(92vh - 120px)' }}>
          <div className="border-r p-6 space-y-5" style={{ borderColor: 'rgba(121,255,102,0.08)' }}>
            <Field label="Project">
              <select
                value={draft.projectId}
                onChange={(event) => onChange({ ...draft, projectId: event.target.value })}
                className="w-full rounded-2xl px-4 py-3 outline-none"
                style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#ebffe5', fontSize: '14px', colorScheme: 'dark' }}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
            </Field>

            <Field label="Epic Title">
              <input
                value={draft.title}
                onChange={(event) => onChange({ ...draft, title: event.target.value })}
                className="w-full rounded-2xl px-4 py-3 outline-none"
                style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#ebffe5', fontSize: '14px' }}
                placeholder="Acquisition Flywheel"
              />
            </Field>

            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(event) => onChange({ ...draft, description: event.target.value })}
                className="w-full rounded-2xl px-4 py-3 outline-none resize-none"
                style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#ebffe5', fontSize: '14px', lineHeight: '1.6' }}
                rows={5}
                placeholder="Why this initiative matters, what outcome it owns, what tasks feed it."
              />
            </Field>

            <Field label="Epic Palette">
              <div className="grid grid-cols-3 gap-3">
                {epicPalette.map((palette) => (
                  <button
                    key={palette.color}
                    onClick={() => onChange({ ...draft, color: palette.color })}
                    className="rounded-[22px] p-3 text-left transition-all hover:translate-y-[-2px]"
                    style={{
                      background: `linear-gradient(135deg, ${palette.color}24, rgba(121,255,102,0.03))`,
                      border: `1px solid ${draft.color === palette.color ? `${palette.color}88` : 'rgba(121,255,102,0.12)'}`,
                      boxShadow: draft.color === palette.color ? `0 14px 28px ${palette.color}22` : 'none',
                    }}
                  >
                    <div className="mb-2 h-8 rounded-2xl" style={{ background: `linear-gradient(135deg, ${palette.color}, ${palette.glow})` }} />
                    <div style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 700 }}>{palette.label}</div>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Due Date">
              <input
                type="date"
                value={draft.endDate}
                onChange={(event) => onChange({ ...draft, endDate: event.target.value })}
                className="w-full rounded-2xl px-4 py-3 outline-none"
                style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#ebffe5', fontSize: '14px', colorScheme: 'dark' }}
              />
            </Field>

            <div className="flex gap-3 pt-3">
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3"
                  style={{ background: 'rgba(121,255,102,0.08)', color: '#8cff5a', border: '1px solid rgba(121,255,102,0.14)', fontSize: '13px', fontWeight: 700 }}
                >
                  <Trash2 size={14} />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              <button onClick={onClose} className="flex-1 rounded-2xl py-3" style={{ background: '#0b150b', color: '#89bd80', border: '1px solid rgba(121,255,102,0.12)', fontSize: '13px', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={onSave} className="flex-1 rounded-2xl py-3" style={{ background: `linear-gradient(135deg, ${draft.color}, ${selectedPalette.glow})`, color: '#041004', boxShadow: `0 14px 30px ${draft.color}30`, fontSize: '13px', fontWeight: 800 }}>
                {saving ? 'Saving...' : mode === 'create' ? 'Create Epic' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '14px', fontWeight: 800 }}>Task Flow Linker</h3>
                <p className="matrix-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                  Drag loose tasks into epic lane. Pull them back out if scope changes.
                </p>
              </div>
              {activeEpic && (
                <div className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: `${draft.color}16`, color: draft.color, fontSize: '12px', fontWeight: 700 }}>
                  <Link2 size={13} />
                  {linkedPreview.length} linked
                </div>
              )}
            </div>

            {mode === 'create' ? (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px]" style={{ background: 'rgba(121,255,102,0.04)', border: '1px dashed rgba(121,255,102,0.12)', color: '#5e7f58', fontSize: '13px' }}>
                Save epic first. Then task linker unlocks.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-5">
                <TaskPoolPanel title="Available Tasks" subtitle="Drag from here" tasks={availableTasks} accent="#5e7f58" emptyLabel="No loose tasks in this project.">
                  {availableTasks.map((task) => (
                    <LinkableTaskCard key={task.id} task={task} accent="#5e7f58" />
                  ))}
                </TaskPoolPanel>

                <EpicLanePanel
                  epicColor={draft.color}
                  linkedTasks={linkedPreview}
                  onAssignTask={onAssignTask}
                  onRemoveTask={onRemoveTask}
                  onPreviewReorder={(taskId, toIndex) => {
                    setLinkedPreview((current) => {
                      const fromIndex = current.findIndex((task) => task.id === taskId);
                      if (fromIndex === -1 || fromIndex === toIndex) {
                        return current;
                      }

                      const next = [...current];
                      const [moving] = next.splice(fromIndex, 1);
                      next.splice(toIndex, 0, moving);
                      return next;
                    });
                  }}
                  onCommitReorder={async () => {
                    await onReorderTasks(linkedPreview.map((task) => task.id));
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="matrix-title block mb-2" style={{ color: '#5e7f58', fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TaskPoolPanel({
  title,
  subtitle,
  tasks,
  accent,
  emptyLabel,
  children,
}: {
  title: string;
  subtitle: string;
  tasks: Task[];
  accent: string;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] p-4" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.1)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 800 }}>{title}</div>
          <div className="matrix-muted" style={{ fontSize: '12px', marginTop: '2px' }}>{subtitle}</div>
        </div>
        <div className="rounded-full px-2.5 py-1" style={{ background: 'rgba(121,255,102,0.06)', color: accent, fontSize: '11px', fontWeight: 700 }}>
          {tasks.length}
        </div>
      </div>
      <div className="space-y-3 min-h-[360px]">
        {tasks.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center rounded-[24px]" style={{ background: 'rgba(121,255,102,0.04)', border: '1px dashed rgba(121,255,102,0.12)', color: '#5e7f58', fontSize: '12px' }}>
            {emptyLabel}
          </div>
        ) : children}
      </div>
    </div>
  );
}

function EpicLanePanel({
  epicColor,
  linkedTasks,
  onAssignTask,
  onRemoveTask,
  onPreviewReorder,
  onCommitReorder,
}: {
  epicColor: string;
  linkedTasks: Task[];
  onAssignTask: (taskId: string) => Promise<void>;
  onRemoveTask: (taskId: string) => Promise<void>;
  onPreviewReorder: (taskId: string, toIndex: number) => void;
  onCommitReorder: () => Promise<void>;
}) {
  const [{ isOver }, drop] = useDrop<DragTaskItem, void, { isOver: boolean }>(() => ({
    accept: 'EPIC_TASK',
    drop: (item) => {
      if (item.source === 'available') {
        void onAssignTask(item.taskId);
        return;
      }

      void onCommitReorder();
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [onAssignTask]);

  return (
    <div
      ref={drop}
      className="rounded-[28px] p-4 transition-all"
      style={{
        background: `linear-gradient(180deg, ${isOver ? `${epicColor}18` : 'rgba(121,255,102,0.03)'}, rgba(121,255,102,0.03))`,
        border: `1px solid ${isOver ? `${epicColor}88` : 'rgba(121,255,102,0.1)'}`,
        boxShadow: isOver ? `0 20px 50px ${epicColor}24` : 'none',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 800 }}>Epic Lane</div>
          <div className="matrix-muted" style={{ fontSize: '12px', marginTop: '2px' }}>Drop tasks into the stream</div>
        </div>
        <div className="rounded-full px-2.5 py-1" style={{ background: `${epicColor}18`, color: epicColor, fontSize: '11px', fontWeight: 700 }}>
          {linkedTasks.length}
        </div>
      </div>

      <div className="space-y-3 min-h-[360px]">
        {linkedTasks.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center rounded-[24px] transition-all" style={{ background: `${epicColor}10`, border: `1px dashed ${epicColor}44`, color: epicColor, fontSize: '13px', fontWeight: 700 }}>
            Drop tasks here to connect them
          </div>
        ) : (
          linkedTasks.map((task, index) => (
            <LinkedEpicTaskCard
              key={task.id}
              task={task}
              index={index}
              epicColor={epicColor}
              onPreviewReorder={onPreviewReorder}
              onCommitReorder={onCommitReorder}
              onRemoveTask={onRemoveTask}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LinkableTaskCard({ task, accent }: { task: Task; accent: string }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'EPIC_TASK',
    item: { type: 'EPIC_TASK', taskId: task.id, source: 'available' },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [task.id]);

  return (
    <div
      ref={drag}
      className="rounded-[24px] p-4 transition-all"
      style={{
        background: '#0a140a',
        border: '1px solid rgba(121,255,102,0.1)',
        boxShadow: isDragging ? `0 18px 40px ${accent}28` : '0 8px 20px rgba(0,0,0,0.25)',
        opacity: isDragging ? 0.55 : 1,
        transform: isDragging ? 'rotate(2deg) scale(1.02)' : 'translateY(0)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl" style={{ background: 'rgba(121,255,102,0.06)', color: accent }}>
          <Layers size={14} />
        </div>
        <div className="rounded-full px-2 py-1" style={{ background: 'rgba(121,255,102,0.06)', color: '#89bd80', fontSize: '10px', fontWeight: 700 }}>
          {task.status}
        </div>
      </div>
      <div style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>{task.title}</div>
      <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '4px' }}>{task.estimation}h · drag to link</div>
    </div>
  );
}

function LinkedEpicTaskCard({
  task,
  index,
  epicColor,
  onPreviewReorder,
  onCommitReorder,
  onRemoveTask,
}: {
  task: Task;
  index: number;
  epicColor: string;
  onPreviewReorder: (taskId: string, toIndex: number) => void;
  onCommitReorder: () => Promise<void>;
  onRemoveTask: (taskId: string) => Promise<void>;
}) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'EPIC_TASK',
    item: {
      type: 'EPIC_TASK',
      taskId: task.id,
      source: 'linked',
      currentIndex: index,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [index, task.id]);

  const [{ isOver }, drop] = useDrop<DragTaskItem, void, { isOver: boolean }>(() => ({
    accept: 'EPIC_TASK',
    hover: (item, monitor) => {
      if (item.source !== 'linked' || item.taskId === task.id || !monitor.isOver({ shallow: true })) {
        return;
      }

      if (item.currentIndex === index) {
        return;
      }

      onPreviewReorder(item.taskId, index);
      item.currentIndex = index;
    },
    drop: (item) => {
      if (item.source === 'linked') {
        void onCommitReorder();
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }), [index, onCommitReorder, onPreviewReorder, task.id]);

  return (
    <div
      ref={(node) => {
        drag(drop(node));
      }}
      className="rounded-[24px] p-[1px] transition-all hover:translate-x-1"
      style={{
        background: `linear-gradient(135deg, ${epicColor}, rgba(121,255,102,0.08))`,
        opacity: isDragging ? 0.55 : 1,
        transform: isDragging ? 'rotate(1deg) scale(1.01)' : isOver ? 'translateX(6px)' : 'translateX(0)',
        boxShadow: isOver ? `0 16px 34px ${epicColor}22` : 'none',
      }}
    >
      <div className="flex items-center gap-3 rounded-[23px] px-4 py-3" style={{ background: '#0b150b' }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl" style={{ background: `${epicColor}18`, color: epicColor }}>
          <Grip size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>{task.title}</div>
          <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            Node {index + 1} · {task.status}
          </div>
        </div>
        <button
          onClick={() => void onRemoveTask(task.id)}
          className="rounded-xl px-3 py-2 transition-all hover:opacity-80"
          style={{ background: 'rgba(121,255,102,0.06)', color: '#89bd80', fontSize: '11px', fontWeight: 700 }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
