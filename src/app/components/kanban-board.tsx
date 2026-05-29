import { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Filter, SortAsc, UserPlus, ChevronDown, Clock, MessageSquare, Paperclip, X,
} from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from 'sonner';
import type {
  Priority, Task, TaskStatus, TaskType,
} from '../data/mock-data';
import { useWorkspace } from '../data/workspace-context';
import TaskModal from './task-modal';

interface KanbanBoardProps {
  projectId: string;
}

interface DragTaskItem {
  type: 'TASK';
  taskId: string;
  fromStatus: TaskStatus;
  currentStatus: TaskStatus;
  currentIndex: number;
}

interface CreateTaskDraft {
  title: string;
  description: string;
  priority: Priority;
  type: TaskType;
  estimation: string;
}

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'Backlog', label: 'BACKLOG', color: '#5e7f58' },
  { id: 'Todo', label: 'TODO', color: '#62ffbf' },
  { id: 'In Progress', label: 'IN PROGRESS', color: '#8bff77' },
  { id: 'Test', label: 'TEST', color: '#78f7b8' },
  { id: 'Done', label: 'DONE', color: '#5ed564' },
  { id: 'Released', label: 'RELEASED', color: '#74ff7d' },
];

const sortOptions = ['Manual', 'Priority', 'Due Date', 'Title'] as const;
type SortOption = (typeof sortOptions)[number];

const priorityRank: Record<Priority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const priorityMap: Record<Priority, { color: string; label: string }> = {
  Critical: { color: '#c5ff62', label: 'Critical' },
  High: { color: '#9aff72', label: 'High' },
  Medium: { color: '#78f7b8', label: 'Medium' },
  Low: { color: '#5ed564', label: 'Low' },
};

const typeIconMap: Record<TaskType, string> = {
  Feature: '✦',
  Bug: '◆',
  Improvement: '▲',
  Task: '●',
};

const emptyDraft = (): CreateTaskDraft => ({
  title: '',
  description: '',
  priority: 'Medium',
  type: 'Task',
  estimation: '',
});

function reorderTaskList(tasks: Task[], taskId: string, toStatus: TaskStatus, toIndex: number) {
  const movingTask = tasks.find((task) => task.id === taskId);
  if (!movingTask) {
    return tasks;
  }

  const remaining = tasks.filter((task) => task.id !== taskId);
  const sourceStatus = movingTask.status;
  const destinationColumn = remaining
    .filter((task) => task.status === toStatus)
    .sort((left, right) => left.order - right.order);
  const boundedIndex = Math.max(0, Math.min(toIndex, destinationColumn.length));
  destinationColumn.splice(boundedIndex, 0, { ...movingTask, status: toStatus });

  const sourceOrder = new Map(
    remaining
      .filter((task) => task.status === sourceStatus)
      .sort((left, right) => left.order - right.order)
      .map((task, index) => [task.id, index]),
  );
  const destinationOrder = new Map(destinationColumn.map((task, index) => [task.id, index]));

  return remaining.map((task) => {
    if (task.status === sourceStatus) {
      return { ...task, order: sourceOrder.get(task.id) ?? task.order };
    }

    if (task.status === toStatus) {
      return { ...task, order: destinationOrder.get(task.id) ?? task.order };
    }

    return task;
  }).concat(
    destinationColumn
      .filter((task) => task.id === movingTask.id)
      .map((task) => ({ ...task, order: destinationOrder.get(task.id) ?? task.order })),
  );
}

export default function KanbanBoard({ projectId }: KanbanBoardProps) {
  const {
    projects, tasks, members, epics, createTask, reorderTasks, inviteProjectMember, deleteProject,
  } = useWorkspace();
  const project = projects.find((p) => p.id === projectId) || projects[0];
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'All'>('All');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | 'All'>('All');
  const [sortBy, setSortBy] = useState<SortOption>('Manual');
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createColumn, setCreateColumn] = useState<TaskStatus>('Backlog');
  const [draft, setDraft] = useState<CreateTaskDraft>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [savingMove, setSavingMove] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  useEffect(() => {
    const projectTasks = tasks
      .filter((task) => task.projectId === projectId)
      .sort((left, right) => {
        if (left.status !== right.status) {
          return left.status.localeCompare(right.status);
        }

        if (left.order !== right.order) {
          return left.order - right.order;
        }

        return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      });
    setLocalTasks(projectTasks);
  }, [projectId, tasks]);

  const projectMembers = useMemo(
    () => project?.memberIds.map((id) => members.find((m) => m.id === id)).filter(Boolean) ?? [],
    [members, project],
  );

  const filteredTasks = useMemo(() => {
    const source = localTasks.filter((task) => {
      if (search) {
        const query = search.toLowerCase();
        const haystack = `${task.title} ${task.description} ${task.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (selectedPriority !== 'All' && task.priority !== selectedPriority) {
        return false;
      }

      if (selectedAssigneeId !== 'All' && task.assigneeId !== selectedAssigneeId) {
        return false;
      }

      return true;
    });

    return source;
  }, [localTasks, search, selectedAssigneeId, selectedPriority]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: '#050805', color: '#5e7f58', fontSize: '13px' }}>
        Create a project to unlock the kanban board.
      </div>
    );
  }

  const sortTasks = (items: Task[]) => {
    const next = [...items];
    next.sort((left, right) => {
      if (sortBy === 'Priority') {
        return priorityRank[left.priority] - priorityRank[right.priority] || left.order - right.order;
      }

      if (sortBy === 'Due Date') {
        const leftDate = left.dueDate ? Date.parse(left.dueDate) : Number.MAX_SAFE_INTEGER;
        const rightDate = right.dueDate ? Date.parse(right.dueDate) : Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate || left.order - right.order;
      }

      if (sortBy === 'Title') {
        return left.title.localeCompare(right.title) || left.order - right.order;
      }

      return left.order - right.order;
    });
    return next;
  };

  const getColumnTasks = (status: TaskStatus) => sortTasks(filteredTasks.filter((task) => task.status === status));

  const previewTaskMove = (taskId: string, toStatus: TaskStatus, toIndex: number) => {
    setLocalTasks((current) => reorderTaskList(current, taskId, toStatus, toIndex));
  };

  const handleDropTask = async (taskId: string, fromStatus: TaskStatus, toStatus: TaskStatus, toIndex: number) => {
    if (sortBy !== 'Manual') {
      toast.info('Switch sort to Manual for drag reorder.');
      return;
    }

    const nextLocalTasks = reorderTaskList(localTasks, taskId, toStatus, toIndex);
    setLocalTasks(nextLocalTasks);
    setSavingMove(true);

    try {
      await Promise.all(
        [...new Set<TaskStatus>([fromStatus, toStatus])].map(async (status) => {
          const orderedIds = nextLocalTasks
            .filter((item) => item.status === status)
            .sort((left, right) => left.order - right.order)
            .map((item) => item.id);
          await reorderTasks(
            project.id,
            status,
            orderedIds,
            status === toStatus ? { movedTaskId: taskId, fromStatus } : undefined,
          );
        }),
      );
    } catch (error) {
      console.error(error);
      toast.error('Task move failed.');
      setLocalTasks(tasks.filter((item) => item.projectId === project.id));
    } finally {
      setSavingMove(false);
    }
  };

  const openCreateTask = (status: TaskStatus) => {
    setCreateColumn(status);
    setDraft(emptyDraft());
    setShowCreateModal(true);
  };

  const handleCreateTask = async () => {
    const title = draft.title.trim();
    if (!title) {
      toast.error('Task title required.');
      return;
    }

    setCreating(true);

    try {
      await createTask({
        projectId: project.id,
        status: createColumn,
        title,
        description: draft.description,
        priority: draft.priority,
        type: draft.type,
        estimation: Number(draft.estimation) || 0,
        accentColor: project.gradientFrom,
      });
      setShowCreateModal(false);
      setDraft(emptyDraft());
      toast.success('Task added.');
    } catch (error) {
      console.error(error);
      toast.error('Task create failed.');
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      toast.error('Email required.');
      return;
    }

    setInviting(true);

    try {
      const result = await inviteProjectMember(project.id, email);

      if (result === 'already-member') {
        toast.info('Member already on project.');
        return;
      }

      if (result === 'member-not-found') {
        toast.error('No workspace member with that email.');
        return;
      }

      toast.success('Member invited to project.');
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (error) {
      console.error(error);
      toast.error('Invite failed.');
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteProject = async () => {
    const confirmed = window.confirm(`Delete "${project.title}" and all linked tasks, epics, and project activity?`);
    if (!confirmed) {
      return;
    }

    setDeletingProject(true);

    try {
      await deleteProject(project.id);
      toast.success('Project deleted.');
    } catch (error) {
      console.error(error);
      toast.error('Project delete failed.');
    } finally {
      setDeletingProject(false);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full">
        <div
          className="relative overflow-hidden shrink-0"
          style={{
            background: `linear-gradient(135deg,
              ${project.gradientFrom}dd 0%,
              ${project.gradientTo}88 60%,
              rgba(4,16,4,0.96) 100%)`,
            minHeight: '180px',
          }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${project.gradientFrom}33 0%, transparent 70%)`,
              top: '-100px',
              right: '-80px',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: `linear-gradient(rgba(209,255,203,0.15) 1px, transparent 1px),
                linear-gradient(90deg, rgba(209,255,203,0.15) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative z-10 px-6 pt-5 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="rounded-full px-2.5 py-0.5"
                    style={{ background: 'rgba(4,16,4,0.42)', color: 'rgba(245,255,240,0.84)', fontSize: '10px', fontWeight: 600, backdropFilter: 'blur(8px)' }}
                  >
                    {project.status.toUpperCase()}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5"
                    style={{ background: 'rgba(4,16,4,0.42)', color: 'rgba(245,255,240,0.84)', fontSize: '10px', fontWeight: 600, backdropFilter: 'blur(8px)' }}
                  >
                    {project.priority.toUpperCase()}
                  </span>
                </div>
                <h1 className="matrix-title" style={{ color: '#ebffe5', fontSize: '24px', fontWeight: 800, letterSpacing: '0.05em', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
                  {project.title}
                </h1>
                <p style={{ color: 'rgba(235,255,229,0.76)', fontSize: '13px', marginTop: '4px', maxWidth: '500px' }}>
                  {project.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="flex -space-x-2">
                  {projectMembers.map((m) => (
                    <div
                      key={m.id}
                      title={m.name}
                    className="flex items-center justify-center rounded-full text-white"
                    style={{
                        width: '34px', height: '34px', background: m.color, border: '2px solid rgba(4,16,4,0.5)', fontSize: '11px', fontWeight: 700, boxShadow: `0 0 8px ${m.color}60`,
                      }}
                    >
                      {m.initials[0]}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all hover:opacity-80"
                  style={{
                    background: 'rgba(4,16,4,0.32)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(209,255,203,0.16)',
                    color: '#ebffe5',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  <UserPlus size={13} />
                  Invite
                </button>
                <button
                  onClick={() => void handleDeleteProject()}
                  disabled={deletingProject}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all hover:opacity-80"
                  style={{
                    background: 'rgba(4,16,4,0.32)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(209,255,203,0.16)',
                    color: '#ebffe5',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  <X size={13} />
                  {deletingProject ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <span style={{ color: 'rgba(235,255,229,0.7)', fontSize: '12px' }}>
                Due {project.dueDate || 'TBD'}
              </span>
              <span style={{ color: 'rgba(235,255,229,0.7)', fontSize: '12px' }}>
                {project.completedTaskCount}/{project.taskCount} tasks
              </span>
              <div className="flex items-center gap-2 ml-2">
                <div className="rounded-full overflow-hidden" style={{ height: '4px', width: '100px', background: 'rgba(4,16,4,0.34)' }}>
                  <div className="h-full rounded-full" style={{ width: `${project.progress}%`, background: 'rgba(235,255,229,0.76)' }} />
                </div>
                <span style={{ color: 'rgba(235,255,229,0.84)', fontSize: '12px', fontWeight: 700 }}>{project.progress}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 shrink-0" style={{ background: 'rgba(5,8,5,0.88)', borderBottom: '1px solid rgba(121,255,102,0.12)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', height: '36px', width: '220px' }}>
            <Search size={13} style={{ color: '#5e7f58' }} />
            <input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none"
              style={{ color: '#ebffe5', fontSize: '13px' }}
            />
          </div>

          <ToolbarSelect
            icon={<Filter size={13} />}
            label={`Priority: ${selectedPriority}`}
            value={selectedPriority}
            options={['All', 'Critical', 'High', 'Medium', 'Low']}
            onChange={(value) => setSelectedPriority(value as Priority | 'All')}
          />

          <ToolbarSelect
            icon={<UserPlus size={13} />}
            label={selectedAssigneeId === 'All' ? 'Assignee: All' : `Assignee: ${members.find((member) => member.id === selectedAssigneeId)?.initials || 'All'}`}
            value={selectedAssigneeId}
            options={['All', ...projectMembers.map((member) => member.id)]}
            renderOption={(value) => value === 'All' ? 'All assignees' : members.find((member) => member.id === value)?.name || value}
            onChange={(value) => setSelectedAssigneeId(value)}
          />

          <ToolbarSelect
            icon={<SortAsc size={13} />}
            label={`Sort: ${sortBy}`}
            value={sortBy}
            options={[...sortOptions]}
            onChange={(value) => setSortBy(value as SortOption)}
          />

          <div className="ml-auto flex items-center gap-2" style={{ color: savingMove ? '#78f7b8' : '#5e7f58', fontSize: '12px' }}>
            {savingMove ? 'Saving move...' : sortBy === 'Manual' ? 'Drag active' : 'Manual sort for drag'}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 p-5 h-full" style={{ minWidth: 'max-content', alignItems: 'flex-start' }}>
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={getColumnTasks(col.id)}
                dragEnabled={sortBy === 'Manual'}
                onTaskClick={setSelectedTask}
                onCreateTask={() => openCreateTask(col.id)}
                onHoverTask={previewTaskMove}
                onDropTask={handleDropTask}
              />
            ))}
          </div>
        </div>

        {selectedTask && (
          <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
        )}

        {showCreateModal && (
          <CreateTaskModal
            column={createColumn}
            draft={draft}
            creating={creating}
            onClose={() => setShowCreateModal(false)}
            onChange={setDraft}
            onSubmit={() => void handleCreateTask()}
          />
        )}

        {showInviteModal && (
          <InviteMemberModal
            inviteEmail={inviteEmail}
            inviting={inviting}
            members={projectMembers}
            onEmailChange={setInviteEmail}
            onClose={() => setShowInviteModal(false)}
            onSubmit={() => void handleInvite()}
          />
        )}
      </div>
    </DndProvider>
  );
}

function ToolbarSelect({
  icon,
  label,
  value,
  options,
  onChange,
  renderOption,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  renderOption?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-xl px-3 transition-all hover:opacity-80"
        style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#89bd80', fontSize: '12px', height: '36px' }}
      >
        {icon}
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-30 min-w-[180px] overflow-hidden rounded-xl" style={{ background: '#0d180d', border: '1px solid rgba(121,255,102,0.14)', boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}>
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left transition-all hover:bg-white/5"
              style={{ color: option === value ? '#ebffe5' : '#89bd80', fontSize: '12px', background: option === value ? 'rgba(121,255,102,0.08)' : 'transparent' }}
            >
              {renderOption ? renderOption(option) : option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  column,
  tasks,
  dragEnabled,
  onTaskClick,
  onCreateTask,
  onHoverTask,
  onDropTask,
}: {
  column: { id: TaskStatus; label: string; color: string };
  tasks: Task[];
  dragEnabled: boolean;
  onTaskClick: (task: Task) => void;
  onCreateTask: () => void;
  onHoverTask: (taskId: string, toStatus: TaskStatus, toIndex: number) => void;
  onDropTask: (taskId: string, fromStatus: TaskStatus, toStatus: TaskStatus, toIndex: number) => Promise<void>;
}) {
  const { members, epics } = useWorkspace();
  const [{ isOver, canDrop }, drop] = useDrop<DragTaskItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: 'TASK',
    canDrop: () => dragEnabled,
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }

      void onDropTask(item.taskId, item.fromStatus, column.id, tasks.length);
      item.fromStatus = column.id;
      item.currentStatus = column.id;
      item.currentIndex = tasks.length;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  }), [column.id, dragEnabled, onDropTask, tasks.length]);

  return (
    <div
      ref={drop}
      className="flex flex-col rounded-2xl shrink-0 overflow-hidden transition-all"
      style={{
        width: '272px',
        background: isOver && canDrop ? '#102010' : '#071007',
        border: `1px solid ${isOver && canDrop ? `${column.color}99` : 'rgba(121,255,102,0.08)'}`,
        boxShadow: isOver && canDrop ? `0 18px 50px ${column.color}22` : 'none',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: `1.5px solid ${column.color}50` }}>
        <div className="flex items-center gap-2">
          <div className="rounded-full" style={{ width: '7px', height: '7px', background: column.color }} />
          <span style={{ color: column.color, fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px' }}>
            {column.label}
          </span>
          <span className="flex items-center justify-center rounded-full" style={{ minWidth: '18px', height: '18px', padding: '0 4px', background: `${column.color}18`, color: column.color, fontSize: '10px', fontWeight: 700 }}>
            {tasks.length}
          </span>
        </div>
        <button style={{ color: '#5e7f58' }} onClick={onCreateTask}>
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        {tasks.map((task, index) => (
          <KanbanTaskCard
            key={task.id}
            task={task}
            index={index}
            columnId={column.id}
            dragEnabled={dragEnabled}
            members={members}
            epics={epics}
            onClick={() => onTaskClick(task)}
            onHoverTask={onHoverTask}
            onDropTask={onDropTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 rounded-xl transition-all" style={{ border: `1px dashed ${isOver && canDrop ? `${column.color}99` : 'rgba(121,255,102,0.08)'}` }}>
            <span style={{ color: '#5e7f58', fontSize: '12px' }}>{dragEnabled ? 'Drop task here' : 'No tasks'}</span>
          </div>
        )}
      </div>

      <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(121,255,102,0.08)' }}>
        <button
          onClick={onCreateTask}
          className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all hover:opacity-70"
          style={{ background: 'rgba(121,255,102,0.04)', border: '1px dashed rgba(121,255,102,0.12)', color: '#5e7f58', fontSize: '12px' }}
        >
          <Plus size={12} />
          Add task
        </button>
      </div>
    </div>
  );
}

function KanbanTaskCard({
  task,
  index,
  columnId,
  dragEnabled,
  onClick,
  onHoverTask,
  onDropTask,
  members,
  epics,
}: {
  task: Task;
  index: number;
  columnId: TaskStatus;
  dragEnabled: boolean;
  onClick: () => void;
  onHoverTask: (taskId: string, toStatus: TaskStatus, toIndex: number) => void;
  onDropTask: (taskId: string, fromStatus: TaskStatus, toStatus: TaskStatus, toIndex: number) => Promise<void>;
  members: ReturnType<typeof useWorkspace>['members'];
  epics: ReturnType<typeof useWorkspace>['epics'];
}) {
  const assignee = members.find((m) => m.id === task.assigneeId);
  const epic = epics.find((e) => e.id === task.epicId);
  const pm = priorityMap[task.priority];

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TASK',
    canDrag: dragEnabled,
    item: {
      type: 'TASK',
      taskId: task.id,
      fromStatus: columnId,
      currentStatus: columnId,
      currentIndex: index,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [columnId, dragEnabled, task.id]);

  const [{ isOver }, drop] = useDrop<DragTaskItem, void, { isOver: boolean }>(() => ({
    accept: 'TASK',
    canDrop: (item) => dragEnabled && (item.taskId !== task.id || item.fromStatus !== columnId),
    hover: (item, monitor) => {
      if (!monitor.isOver({ shallow: true }) || item.taskId === task.id) {
        return;
      }

      if (item.currentStatus === columnId && item.currentIndex === index) {
        return;
      }

      onHoverTask(item.taskId, columnId, index);
      item.currentStatus = columnId;
      item.currentIndex = index;
    },
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }

      void onDropTask(item.taskId, item.fromStatus, columnId, index);
      item.fromStatus = columnId;
      item.currentStatus = columnId;
      item.currentIndex = index;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }), [columnId, dragEnabled, index, onDropTask, onHoverTask, task.id]);

  return (
    <div
      ref={(node) => {
        drag(drop(node));
      }}
      onClick={onClick}
      className="rounded-xl overflow-hidden cursor-pointer group transition-all"
      style={{
        background: '#0a140a',
        border: `1px solid ${isOver ? `${task.accentColor}88` : 'rgba(121,255,102,0.08)'}`,
        boxShadow: isDragging ? `0 24px 50px ${task.accentColor}33` : isOver ? `0 12px 30px ${task.accentColor}1f` : '0 2px 12px rgba(0,0,0,0.3)',
        transform: isDragging ? 'rotate(2deg) scale(1.03)' : isOver ? 'translateY(-4px)' : 'translateY(0)',
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          height: '72px',
          background: `linear-gradient(135deg, ${task.accentColor}cc 0%, ${task.accentColor}55 100%)`,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div
          className="absolute"
          style={{
            width: '80px', height: '80px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(235,255,229,0.16) 0%, transparent 70%)', top: '-30px', right: '-20px', pointerEvents: 'none',
          }}
        />
        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-1.5 rounded-lg"
            style={{
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              padding: '3px 8px',
              color: 'rgba(235,255,229,0.95)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.3px',
            }}
          >
            <span style={{ fontSize: '9px' }}>{typeIconMap[task.type]}</span>
            {task.type.toUpperCase()}
          </span>
          <span
            className="rounded-lg"
            style={{
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              padding: '3px 8px',
              color: pm.color,
              fontSize: '9px',
              fontWeight: 700,
            }}
          >
            {task.priority}
          </span>
        </div>

        {epic && (
          <div>
            <span
              className="rounded-md"
              style={{
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
                padding: '2px 6px',
                color: 'rgba(245,255,240,0.84)',
                fontSize: '9px',
                fontWeight: 600,
              }}
            >
              {epic.title}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '12px' }}>
        <h4 style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 600, lineHeight: '1.4', marginBottom: '4px' }}>
          {task.title}
        </h4>
        <p
          style={{
            color: '#c7eac1',
            fontSize: '11px',
            lineHeight: '1.5',
            marginBottom: '10px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {task.description || 'No description yet.'}
        </p>

        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  background: 'rgba(121,255,102,0.08)',
                  borderRadius: '5px',
                  padding: '2px 6px',
                  color: '#89bd80',
                  fontSize: '9px',
                  fontWeight: 500,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1" style={{ color: '#5e7f58' }}>
              <Clock size={10} />
              <span style={{ fontSize: '10px' }}>{task.estimation}h</span>
            </div>
            <div className="flex items-center gap-1" style={{ color: '#5e7f58' }}>
              <MessageSquare size={10} />
              <span style={{ fontSize: '10px' }}>{task.comments}</span>
            </div>
            {task.attachments > 0 && (
              <div className="flex items-center gap-1" style={{ color: '#5e7f58' }}>
                <Paperclip size={10} />
                <span style={{ fontSize: '10px' }}>{task.attachments}</span>
              </div>
            )}
          </div>
          {assignee && (
            <div
              className="flex items-center justify-center rounded-full text-white"
              title={assignee.name}
              style={{
                width: '22px', height: '22px', background: assignee.color, fontSize: '8px', fontWeight: 700, boxShadow: `0 0 6px ${assignee.color}60`,
              }}
            >
              {assignee.initials[0]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTaskModal({
  column,
  draft,
  creating,
  onClose,
  onChange,
  onSubmit,
}: {
  column: TaskStatus;
  draft: CreateTaskDraft;
  creating: boolean;
  onClose: () => void;
  onChange: (value: CreateTaskDraft) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)' }} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-[520px] overflow-hidden rounded-[24px]" style={{ background: '#0a140a', border: '1px solid rgba(121,255,102,0.14)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(121,255,102,0.08)' }}>
          <div>
            <div className="matrix-title" style={{ color: '#5e7f58', fontSize: '11px', letterSpacing: '0.08em' }}>New task</div>
            <div style={{ color: '#ebffe5', fontSize: '16px', fontWeight: 700 }}>Add to {column}</div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(121,255,102,0.06)', color: '#89bd80' }}>
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label style={{ color: '#89bd80', fontSize: '12px' }}>Title</label>
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              className="mt-2 w-full rounded-xl px-4 py-3 outline-none"
              style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#ebffe5', fontSize: '14px' }}
              placeholder="Ship task create flow"
            />
          </div>

          <div>
            <label style={{ color: '#89bd80', fontSize: '12px' }}>Description</label>
            <textarea
              value={draft.description}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              className="mt-2 w-full rounded-xl px-4 py-3 outline-none resize-none"
              style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#ebffe5', fontSize: '14px' }}
              rows={4}
              placeholder="Short task context"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InlineSelect
              label="Priority"
              value={draft.priority}
              options={['Critical', 'High', 'Medium', 'Low']}
              onChange={(value) => onChange({ ...draft, priority: value as Priority })}
            />
            <InlineSelect
              label="Type"
              value={draft.type}
              options={['Task', 'Feature', 'Bug', 'Improvement']}
              onChange={(value) => onChange({ ...draft, type: value as TaskType })}
            />
          </div>

          <div>
            <label style={{ color: '#89bd80', fontSize: '12px' }}>Estimation (hours)</label>
            <input
              value={draft.estimation}
              onChange={(event) => onChange({ ...draft, estimation: event.target.value })}
              inputMode="numeric"
              className="mt-2 w-full rounded-xl px-4 py-3 outline-none"
              style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#ebffe5', fontSize: '14px' }}
              placeholder="4"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(121,255,102,0.08)' }}>
          <button onClick={onClose} className="rounded-xl px-4 py-2.5" style={{ background: 'rgba(121,255,102,0.06)', color: '#89bd80', fontSize: '13px' }}>
            Cancel
          </button>
          <button onClick={onSubmit} className="rounded-xl px-4 py-2.5" style={{ background: 'linear-gradient(135deg, rgba(120,255,99,0.16) 0%, rgba(72,168,66,0.26) 100%)', border: '1px solid rgba(121,255,102,0.18)', color: '#e8ffe1', fontSize: '13px', fontWeight: 700, boxShadow: '0 0 24px rgba(90,255,90,0.12)' }}>
            {creating ? 'Adding...' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteMemberModal({
  inviteEmail,
  inviting,
  members,
  onEmailChange,
  onClose,
  onSubmit,
}: {
  inviteEmail: string;
  inviting: boolean;
  members: Array<{ id: string; name: string; email: string; initials: string; color: string }>;
  onEmailChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)' }} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-[520px] overflow-hidden rounded-[24px]" style={{ background: '#0a140a', border: '1px solid rgba(121,255,102,0.14)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(121,255,102,0.08)' }}>
          <div>
            <div className="matrix-title" style={{ color: '#5e7f58', fontSize: '11px', letterSpacing: '0.08em' }}>Project invite</div>
            <div style={{ color: '#ebffe5', fontSize: '16px', fontWeight: 700 }}>Add member by email</div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(121,255,102,0.06)', color: '#89bd80' }}>
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label style={{ color: '#89bd80', fontSize: '12px' }}>Workspace member email</label>
            <input
              autoFocus
              value={inviteEmail}
              onChange={(event) => onEmailChange(event.target.value)}
              type="email"
              className="mt-2 w-full rounded-xl px-4 py-3 outline-none"
              style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#ebffe5', fontSize: '14px' }}
              placeholder="colleague@example.com"
            />
            <p style={{ color: '#5e7f58', fontSize: '12px', marginTop: '8px' }}>
              Adds existing workspace member to this project.
            </p>
          </div>

          <div>
            <div style={{ color: '#89bd80', fontSize: '12px', marginBottom: '10px' }}>Current project members</div>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 rounded-full px-3 py-2"
                  style={{ background: 'rgba(121,255,102,0.06)', border: '1px solid rgba(121,255,102,0.12)' }}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: member.color, fontSize: '10px', fontWeight: 700 }}>
                    {member.initials[0]}
                  </div>
                  <span style={{ color: '#ebffe5', fontSize: '12px' }}>{member.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(121,255,102,0.08)' }}>
          <button onClick={onClose} className="rounded-xl px-4 py-2.5" style={{ background: 'rgba(121,255,102,0.06)', color: '#89bd80', fontSize: '13px' }}>
            Cancel
          </button>
          <button onClick={onSubmit} className="rounded-xl px-4 py-2.5" style={{ background: 'linear-gradient(135deg, rgba(120,255,99,0.16) 0%, rgba(72,168,66,0.26) 100%)', border: '1px solid rgba(121,255,102,0.18)', color: '#e8ffe1', fontSize: '13px', fontWeight: 700, boxShadow: '0 0 24px rgba(90,255,90,0.12)' }}>
            {inviting ? 'Inviting...' : 'Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label style={{ color: '#89bd80', fontSize: '12px' }}>{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl px-4 py-3 outline-none"
        style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#ebffe5', fontSize: '14px' }}
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}
