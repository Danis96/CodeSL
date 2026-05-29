import { useMemo, useState } from 'react';
import { X, Paperclip, Clock, Calendar, User, Layers, Hash, Send, ChevronDown, Github, GitPullRequest, GitCommit, ExternalLink, Trash2 } from 'lucide-react';
import type { Task, Priority, TaskStatus, TaskType } from '../data/mock-data';
import { useWorkspace } from '../data/workspace-context';
import { toast } from 'sonner';

interface TaskModalProps {
  task: Task;
  onClose: () => void;
}

const pColors: Record<Priority, { bg: string; text: string }> = {
  Critical: { bg: 'rgba(197,255,98,0.15)', text: '#c5ff62' },
  High: { bg: 'rgba(154,255,114,0.15)', text: '#9aff72' },
  Medium: { bg: 'rgba(120,247,184,0.15)', text: '#78f7b8' },
  Low: { bg: 'rgba(94,213,100,0.15)', text: '#5ed564' },
};

const sColors: Record<TaskStatus, { bg: string; text: string }> = {
  Backlog: { bg: 'rgba(121,255,102,0.1)', text: '#89bd80' },
  Todo: { bg: 'rgba(98,255,191,0.15)', text: '#62ffbf' },
  'In Progress': { bg: 'rgba(139,255,119,0.15)', text: '#8bff77' },
  Test: { bg: 'rgba(120,247,184,0.15)', text: '#78f7b8' },
  Done: { bg: 'rgba(94,213,100,0.15)', text: '#5ed564' },
  Released: { bg: 'rgba(116,255,125,0.15)', text: '#74ff7d' },
};

const tColors: Record<TaskType, { bg: string; text: string }> = {
  Feature: { bg: 'rgba(139,255,119,0.15)', text: '#8bff77' },
  Bug: { bg: 'rgba(197,255,98,0.15)', text: '#c5ff62' },
  Improvement: { bg: 'rgba(98,255,191,0.15)', text: '#62ffbf' },
  Task: { bg: 'rgba(116,255,125,0.15)', text: '#74ff7d' },
};

export default function TaskModal({ task, onClose }: TaskModalProps) {
  const {
    members, epics, tasks, taskComments, updateTask, deleteTask, addTaskComment, deleteTaskComment,
  } = useWorkspace();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [estimation, setEstimation] = useState(String(task.estimation));
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [selectedEpicId, setSelectedEpicId] = useState(task.epicId || '');
  const [tags, setTags] = useState(task.tags);
  const [tagDraft, setTagDraft] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const assignee = members.find((m) => m.id === task.assigneeId);
  const projectEpics = epics.filter((e) => e.projectId === task.projectId);
  const selectedEpic = projectEpics.find((e) => e.id === selectedEpicId);
  const tc = tColors[task.type];
  const comments = useMemo(
    () => taskComments
      .filter((item) => item.taskId === task.id)
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    [task.id, taskComments],
  );

  const addTag = () => {
    const nextTag = tagDraft.trim();
    if (!nextTag) {
      return;
    }

    const normalized = nextTag.toLowerCase();
    if (tags.some((tag) => tag.toLowerCase() === normalized)) {
      setTagDraft('');
      return;
    }

    setTags((current) => [...current, nextTag]);
    setTagDraft('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
  };

  const handleCommentSubmit = async () => {
    const message = comment.trim();
    if (!message) {
      return;
    }

    setCommenting(true);
    try {
      await addTaskComment(task.id, message);
      setComment('');
    } catch (error) {
      console.error(error);
      toast.error('Comment save failed.');
    } finally {
      setCommenting(false);
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    setDeletingCommentId(commentId);
    try {
      await deleteTaskComment(commentId);
    } catch (error) {
      console.error(error);
      toast.error('Comment delete failed.');
    } finally {
      setDeletingCommentId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex overflow-hidden"
        style={{ maxWidth: '880px', maxHeight: '90vh', background: '#0a140a', border: '1px solid rgba(121,255,102,0.14)', borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}
      >
        {/* Left panel */}
        <div className="flex-1 overflow-y-auto" style={{ minWidth: 0 }}>
          {/* Colored top strip using task accent color */}
          <div style={{ height: '4px', background: task.accentColor }} />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ background: '#0a140a', borderBottom: '1px solid rgba(121,255,102,0.08)' }}>
            <div className="flex items-center gap-3">
              <span className="rounded-lg px-2.5 py-1" style={{ background: tc.bg, color: tc.text, fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>
                {task.type.toUpperCase()}
              </span>
              <span className="matrix-muted" style={{ fontSize: '12px' }}>#{task.id.replace('t', 'SLV-')}</span>
            </div>
            <button onClick={onClose} className="flex items-center justify-center rounded-xl transition-all hover:opacity-70" style={{ width: '32px', height: '32px', background: 'rgba(121,255,102,0.06)', color: '#89bd80' }}>
              <X size={15} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Title */}
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent outline-none resize-none"
              style={{ color: '#ebffe5', fontSize: '20px', fontWeight: 700, lineHeight: '1.4', letterSpacing: '-0.3px' }}
              rows={2}
            />

            {/* Status & Priority chips */}
            <div className="flex flex-wrap gap-2">
              <SelectChip label={status} bg={sColors[status].bg} color={sColors[status].text} options={['Backlog', 'Todo', 'In Progress', 'Test', 'Done', 'Released']} onChange={(v) => setStatus(v as TaskStatus)} />
              <SelectChip label={priority} bg={pColors[priority].bg} color={pColors[priority].text} options={['Critical', 'High', 'Medium', 'Low']} onChange={(v) => setPriority(v as Priority)} />
              {selectedEpic && (
                <span className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: selectedEpic.color + '22', fontSize: '11px', color: selectedEpic.color, fontWeight: 500 }}>
                  <Layers size={10} />{selectedEpic.title}
                </span>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="matrix-title" style={{ color: '#5e7f58', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-2 rounded-xl p-4 outline-none resize-none transition-all"
                style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#c7eac1', fontSize: '14px', lineHeight: '1.6' }}
                rows={4}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(140,255,90,0.3)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(121,255,102,0.12)')}
              />
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
              <Detail icon={<User size={12} />} label="Assignee">
                {assignee && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center rounded-full text-white" style={{ width: '20px', height: '20px', background: assignee.color, fontSize: '8px', fontWeight: 700 }}>{assignee.initials}</div>
                    <span style={{ color: '#ebffe5', fontSize: '13px' }}>{assignee.name}</span>
                  </div>
                )}
              </Detail>
              <Detail icon={<Calendar size={12} />} label="Due Date">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-transparent outline-none"
                  style={{ color: '#ebffe5', fontSize: '13px', colorScheme: 'dark' }}
                />
              </Detail>
              <Detail icon={<Clock size={12} />} label="Estimation">
                <input
                  value={estimation}
                  onChange={(e) => setEstimation(e.target.value)}
                  inputMode="numeric"
                  className="w-full bg-transparent outline-none"
                  style={{ color: '#ebffe5', fontSize: '13px' }}
                />
              </Detail>
              <Detail icon={<Layers size={12} />} label="Epic">
                <select
                  value={selectedEpicId}
                  onChange={(e) => setSelectedEpicId(e.target.value)}
                  className="w-full bg-transparent outline-none"
                  style={{ color: '#ebffe5', fontSize: '13px', colorScheme: 'dark' }}
                >
                  <option value="">No epic</option>
                  {projectEpics.map((projectEpic) => (
                    <option key={projectEpic.id} value={projectEpic.id}>{projectEpic.title}</option>
                  ))}
                </select>
              </Detail>
              <Detail icon={<Hash size={12} />} label="Tags">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="rounded-md px-2 py-0.5 transition-opacity hover:opacity-75"
                        style={{ background: 'rgba(121,255,102,0.08)', color: '#89bd80', fontSize: '10px' }}
                        title="Remove tag"
                      >
                        {tag} ×
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Create tag"
                      className="w-full bg-transparent outline-none"
                      style={{ color: '#ebffe5', fontSize: '13px' }}
                    />
                    <button type="button" onClick={addTag} className="rounded-lg px-2 py-1 transition-opacity hover:opacity-80" style={{ background: 'rgba(121,255,102,0.08)', color: '#8cff5a', fontSize: '11px', fontWeight: 600 }}>
                      Add
                    </button>
                  </div>
                </div>
              </Detail>
            </div>

            {task.github && (
              <div className="rounded-2xl p-4" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Github size={13} style={{ color: '#8cff5a' }} />
                  <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '11px', fontWeight: 700 }}>
                    GitHub Issue #{task.github.issueNumber}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <Detail icon={<Hash size={12} />} label="Repository">
                    <span style={{ color: '#ebffe5', fontSize: '13px' }}>{task.github.repositoryFullName}</span>
                  </Detail>
                  <Detail icon={<Calendar size={12} />} label="State">
                    <span style={{ color: '#ebffe5', fontSize: '13px', textTransform: 'capitalize' }}>{task.github.state}</span>
                  </Detail>
                </div>
                <a href={task.github.issueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2" style={{ color: '#8cff5a', fontSize: '12px' }}>
                  <ExternalLink size={12} />
                  Open issue
                </a>
              </div>
            )}

            {task.github && (task.github.linkedPullRequests.length > 0 || task.github.linkedCommits.length > 0) && (
              <div className="rounded-2xl p-4" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
                <div className="matrix-title mb-3" style={{ color: '#ebffe5', fontSize: '11px', fontWeight: 700 }}>Linked Code</div>
                <div className="space-y-3">
                  {task.github.linkedPullRequests.map((pullRequest) => (
                    <a key={pullRequest.id} href={pullRequest.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-xl px-3 py-3" style={{ background: '#081108', border: '1px solid rgba(121,255,102,0.08)' }}>
                      <div className="flex items-start gap-2">
                        <GitPullRequest size={13} style={{ color: '#62ffbf', marginTop: '2px' }} />
                        <div>
                          <div style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 600 }}>PR #{pullRequest.number} · {pullRequest.title}</div>
                          <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                            {pullRequest.headRefName} · {pullRequest.merged ? 'merged' : pullRequest.state}
                          </div>
                        </div>
                      </div>
                      <ExternalLink size={12} style={{ color: '#89bd80', marginTop: '3px' }} />
                    </a>
                  ))}
                  {task.github.linkedCommits.map((commit) => (
                    <a key={commit.sha} href={commit.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-xl px-3 py-3" style={{ background: '#081108', border: '1px solid rgba(121,255,102,0.08)' }}>
                      <div className="flex items-start gap-2">
                        <GitCommit size={13} style={{ color: '#8bff77', marginTop: '2px' }} />
                        <div>
                          <div style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 600 }}>{commit.message}</div>
                          <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                            {commit.sha.slice(0, 7)} · {commit.authorName || 'unknown'}
                          </div>
                        </div>
                      </div>
                      <ExternalLink size={12} style={{ color: '#89bd80', marginTop: '3px' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {task.attachments > 0 && (
              <div>
                <label className="matrix-title" style={{ color: '#5e7f58', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>Attachments ({task.attachments})</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {Array.from({ length: task.attachments }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer hover:opacity-70 transition-opacity" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
                      <Paperclip size={12} style={{ color: '#89bd80' }} />
                      <span style={{ color: '#89bd80', fontSize: '12px' }}>file-{i + 1}.png</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="overflow-y-auto" style={{ width: '290px', background: '#071007', borderLeft: '1px solid rgba(121,255,102,0.08)', flexShrink: 0 }}>
          <div className="px-5 py-4 sticky top-0" style={{ background: '#071007', borderBottom: '1px solid rgba(121,255,102,0.08)' }}>
            <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 700 }}>Comments</h3>
          </div>

          <div className="p-5 space-y-4">
            {comments.length === 0 ? (
              <div className="matrix-muted" style={{ fontSize: '12px' }}>
                No comments yet.
              </div>
            ) : (
              comments.map((item) => {
                const author = members.find((member) => member.id === item.authorId);
                return (
                  <div key={item.id} className="rounded-2xl p-3" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center justify-center rounded-full text-white" style={{ width: '20px', height: '20px', background: author?.color || '#3f5a3f', fontSize: '8px', fontWeight: 700 }}>
                          {author?.initials || 'U'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 600 }}>{author?.name || 'Unknown user'}</div>
                          <div className="matrix-muted" style={{ fontSize: '10px' }}>{formatCommentDate(item.createdAt)}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCommentDelete(item.id)}
                        disabled={deletingCommentId === item.id}
                        className="rounded-lg p-1 transition-opacity hover:opacity-75 disabled:opacity-40"
                        style={{ color: '#89bd80', background: 'rgba(121,255,102,0.06)' }}
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div style={{ color: '#c7eac1', fontSize: '12px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{item.body}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Comment input */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
              <input
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleCommentSubmit();
                  }
                }}
                className="flex-1 bg-transparent outline-none"
                style={{ color: '#ebffe5', fontSize: '13px' }}
              />
              <button type="button" onClick={() => void handleCommentSubmit()} disabled={commenting} className="hover:opacity-70 transition-opacity disabled:opacity-40" style={{ color: '#8cff5a' }}><Send size={13} /></button>
            </div>

            <button
              onClick={async () => {
                setDeleting(true);
                await deleteTask(task.id);
                setDeleting(false);
                onClose();
              }}
              className="w-full rounded-xl py-3 mb-3 transition-all hover:opacity-90"
              style={{ background: 'rgba(121,255,102,0.08)', color: '#8cff5a', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(121,255,102,0.14)' }}
            >
              {deleting ? 'Deleting...' : 'Delete Task'}
            </button>
            <button
              onClick={async () => {
                setSaving(true);
                const nextOrder = status === task.status
                  ? task.order
                  : tasks.filter((item) => item.projectId === task.projectId && item.status === status).length;
                const nextEpicOrder = selectedEpicId
                  ? selectedEpicId === (task.epicId || '')
                    ? task.epicOrder
                    : tasks.filter((item) => item.epicId === selectedEpicId).length
                  : 0;
                await updateTask(task.id, {
                  title,
                  description,
                  priority,
                  status,
                  order: nextOrder,
                  estimation: Number(estimation) || 0,
                  dueDate,
                  tags,
                  epicId: selectedEpicId,
                  epicOrder: nextEpicOrder,
                });
                setSaving(false);
                onClose();
              }}
              disabled={deleting}
              className="w-full rounded-xl py-3 transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, rgba(120,255,99,0.16) 0%, rgba(72,168,66,0.26) 100%)', border: '1px solid rgba(121,255,102,0.18)', color: '#e8ffe1', fontSize: '13px', fontWeight: 600, boxShadow: '0 0 24px rgba(90,255,90,0.12)' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectChip({ label, bg, color, options, onChange }: { label: string; bg: string; color: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 rounded-full px-3 py-1 transition-opacity hover:opacity-80" style={{ background: bg, color, fontSize: '12px', fontWeight: 600 }}>
        {label}<ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-8 left-0 z-50 rounded-xl overflow-hidden" style={{ background: '#0d180d', border: '1px solid rgba(121,255,102,0.14)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', minWidth: '140px' }}>
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className="w-full text-left px-3 py-2 transition-all hover:bg-white/5" style={{ color: opt === label ? color : '#89bd80', fontSize: '13px', background: opt === label ? bg : 'transparent' }}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: '#5e7f58' }}>
        {icon}
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function toDateInputValue(value: string) {
  if (!value) {
    return '';
  }

  return value.includes('T') ? value.slice(0, 10) : value;
}

function formatCommentDate(value: string) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    return 'Just now';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}
