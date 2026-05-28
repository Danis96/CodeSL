export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Backlog' | 'Todo' | 'In Progress' | 'Test' | 'Done' | 'Released';
export type TaskType = 'Feature' | 'Bug' | 'Improvement' | 'Task';
export type MemberRole = 'Owner' | 'Admin' | 'Member' | 'Viewer';
export type ProjectStatus = 'Active' | 'On Hold' | 'Completed' | 'Planning';
export type ActivitySource = 'manual' | 'github';

export interface GitHubConnection {
  installationId: number;
  accountLogin: string;
  accountType: string;
  status: 'connected' | 'pending';
  installedAt: string;
}

export interface GitHubRepositoryMetadata {
  installationId: number;
  repositoryId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
  visibility: string;
  syncedAt: string;
}

export interface GitHubPullRequestLink {
  id: number;
  number: number;
  title: string;
  url: string;
  state: string;
  merged: boolean;
  headRefName: string;
  updatedAt: string;
}

export interface GitHubCommitLink {
  sha: string;
  message: string;
  url: string;
  authorName: string;
  committedAt: string;
}

export interface GitHubIssueMetadata {
  installationId: number;
  repositoryId: number;
  repositoryFullName: string;
  issueId: number;
  issueNumber: number;
  issueUrl: string;
  state: string;
  labels: string[];
  milestoneId?: number;
  milestoneTitle?: string;
  assigneeLogins: string[];
  linkedPullRequests: GitHubPullRequestLink[];
  linkedCommits: GitHubCommitLink[];
  syncedAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  initials: string;
  color: string;
  joinedAt: string;
  github?: GitHubConnection;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  color: string;
  taskCount: number;
  completedTaskCount: number;
  startDate: string;
  endDate: string;
  projectId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: Priority;
  status: TaskStatus;
  order: number;
  epicOrder: number;
  epicId?: string;
  tags: string[];
  estimation: number;
  dueDate: string;
  assigneeId: string;
  projectId: string;
  comments: number;
  attachments: number;
  accentColor: string;
  createdAt: string;
  updatedAt: string;
  github?: GitHubIssueMetadata;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  progress: number;
  memberIds: string[];
  taskCount: number;
  completedTaskCount: number;
  dueDate: string;
  startDate: string;
  priority: Priority;
  gradientFrom: string;
  gradientTo: string;
  status: ProjectStatus;
  epicCount: number;
  createdAt: string;
  updatedAt: string;
  github?: GitHubRepositoryMetadata;
}

export interface Activity {
  id: string;
  userId: string;
  action: string;
  target: string;
  timestamp: string;
  type: 'task' | 'project' | 'comment' | 'member';
  projectId?: string;
  taskId?: string;
  epicId?: string;
  source?: ActivitySource;
}

const palette = ['#FF4D3D', '#7C5CFF', '#4DA3FF', '#37D67A', '#F8C14A', '#FF5DA0', '#06D6A0', '#FF6A3D'];

function hashCode(input: string) {
  return input.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
}

export function getInitials(name: string) {
  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
}

export function getProfileColor(seed: string) {
  return palette[hashCode(seed) % palette.length];
}

export function buildMemberProfile(input: {
  id: string;
  name: string;
  email: string;
  role?: string;
  color?: string;
  joinedAt?: string;
  github?: GitHubConnection;
}): Member {
  const name = input.name || input.email || 'Workspace User';

  return {
    id: input.id,
    name,
    email: input.email,
    role: (input.role as MemberRole) || 'Member',
    initials: getInitials(name),
    color: input.color || getProfileColor(input.id || input.email || name),
    joinedAt: input.joinedAt || new Date().toISOString(),
    github: input.github,
  };
}

export function toDateString(value: unknown) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  return '';
}

export function sortByDateDesc<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return [...items].sort((a, b) => {
    const left = typeof a[key] === 'string' ? Date.parse(a[key] as string) || 0 : 0;
    const right = typeof b[key] === 'string' ? Date.parse(b[key] as string) || 0 : 0;
    return right - left;
  });
}

export function buildChartData(tasks: Task[], projects: Project[]) {
  const countDone = (task: Task) => task.status === 'Done' || task.status === 'Released';
  const now = new Date();
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const parseTaskDate = (value: string) => {
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : new Date(time);
  };

  const weeklyDays = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index)));
    return {
      key: date.toISOString().slice(0, 10),
      day: weekdayFormatter.format(date),
    };
  });

  const monthlyBuckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      month: monthFormatter.format(date),
    };
  });

  return {
    weeklyTasks: weeklyDays.map(({ key, day }) => ({
      day,
      completed: tasks.filter((task) => countDone(task) && task.updatedAt.slice(0, 10) === key).length,
      created: tasks.filter((task) => task.createdAt.slice(0, 10) === key).length,
    })),
    tasksByType: [
      { name: 'Feature', value: tasks.filter((task) => task.type === 'Feature').length, color: '#7C5CFF' },
      { name: 'Bug', value: tasks.filter((task) => task.type === 'Bug').length, color: '#FF4D3D' },
      { name: 'Improvement', value: tasks.filter((task) => task.type === 'Improvement').length, color: '#4DA3FF' },
      { name: 'Task', value: tasks.filter((task) => task.type === 'Task').length, color: '#06D6A0' },
    ].filter((item) => item.value > 0),
    tasksByPriority: [
      { priority: 'Critical', count: tasks.filter((task) => task.priority === 'Critical').length, color: '#FF4D4D' },
      { priority: 'High', count: tasks.filter((task) => task.priority === 'High').length, color: '#FF6A3D' },
      { priority: 'Medium', count: tasks.filter((task) => task.priority === 'Medium').length, color: '#F8C14A' },
      { priority: 'Low', count: tasks.filter((task) => task.priority === 'Low').length, color: '#37D67A' },
    ],
    tasksByProject: projects.map((project) => ({
      project: project.title,
      count: tasks.filter((task) => task.projectId === project.id).length,
      color: project.gradientFrom,
    })).filter((item) => item.count > 0),
    monthlyTasks: monthlyBuckets.map(({ key, month }) => ({
      month,
      completed: tasks.filter((task) => countDone(task) && task.updatedAt.startsWith(key)).length,
      created: tasks.filter((task) => task.createdAt.startsWith(key)).length,
    })),
    overdueTasks: tasks.filter((task) => {
      const dueDate = parseTaskDate(task.dueDate);
      return dueDate && dueDate.getTime() < now.getTime() && !countDone(task);
    }).length,
    dueSoonTasks: tasks.filter((task) => {
      const dueDate = parseTaskDate(task.dueDate);
      if (!dueDate || countDone(task)) {
        return false;
      }

      const diff = startOfDay(dueDate).getTime() - startOfDay(now).getTime();
      return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
    }).length,
  };
}
