import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  addDoc,
  writeBatch,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import type {
  Activity,
  Epic,
  GitHubConnection,
  Member,
  Priority,
  Project,
  ProjectStatus,
  TaskComment,
  Task,
  TaskStatus,
  TaskType,
} from './mock-data';
import {
  buildMemberProfile,
  isForwardTaskStatusChange,
  sortByDateDesc,
  toDateString,
} from './mock-data';

interface CreateProjectInput {
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
  priority: Priority;
  gradientFrom: string;
  gradientTo: string;
}

interface CreateEpicInput {
  title: string;
  description: string;
  color: string;
  projectId: string;
  endDate?: string;
}

interface UpdateEpicInput {
  title?: string;
  description?: string;
  color?: string;
  projectId?: string;
  endDate?: string;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  order?: number;
  estimation?: number;
  epicId?: string;
  epicOrder?: number;
  dueDate?: string;
  tags?: string[];
}

interface CreateTaskInput {
  projectId: string;
  status: TaskStatus;
  title: string;
  description?: string;
  priority?: Priority;
  type?: TaskType;
  epicId?: string;
  dueDate?: string;
  estimation?: number;
  tags?: string[];
  assigneeId?: string;
  accentColor?: string;
}

interface WorkspaceContextValue {
  authUser: User | null;
  currentUser: Member | null;
  members: Member[];
  projects: Project[];
  tasks: Task[];
  taskComments: TaskComment[];
  epics: Epic[];
  activities: Activity[];
  loading: boolean;
  authLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentUserProfile: (data: { name: string; email: string }) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  createEpic: (input: CreateEpicInput) => Promise<void>;
  updateEpic: (epicId: string, input: UpdateEpicInput) => Promise<void>;
  deleteEpic: (epicId: string) => Promise<void>;
  assignTasksToEpic: (epicId: string, taskIds: string[]) => Promise<void>;
  removeTaskFromEpic: (taskId: string) => Promise<void>;
  reorderEpicTasks: (epicId: string, orderedTaskIds: string[]) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addTaskComment: (taskId: string, body: string) => Promise<void>;
  deleteTaskComment: (commentId: string) => Promise<void>;
  reorderTasks: (
    projectId: string,
    status: TaskStatus,
    orderedTaskIds: string[],
    moveMeta?: { movedTaskId: string; fromStatus: TaskStatus }
  ) => Promise<void>;
  inviteProjectMember: (projectId: string, email: string) => Promise<'invited' | 'already-member' | 'member-not-found'>;
  getGitHubInstallUrl: () => Promise<string>;
  completeGitHubInstallation: (installationId: number) => Promise<void>;
  disconnectGitHub: () => Promise<void>;
  listGitHubRepositories: () => Promise<GitHubRepositoryOption[]>;
  importGitHubRepository: (input: ImportGitHubRepositoryInput) => Promise<{ projectId: string; created: boolean }>;
  syncGitHubProject: (projectId: string) => Promise<{ imported: number }>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const CONTRIBUTION_COOLDOWN_MS = 60 * 60 * 1000;

export interface GitHubRepositoryOption {
  id: number;
  installationId: number;
  installationAccountLogin: string;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  htmlUrl: string;
  visibility: string;
  openIssuesCount: number;
  alreadyImportedProjectId?: string;
}

interface ImportGitHubRepositoryInput {
  repositoryId: number;
  installationId: number;
  projectId?: string;
}

async function netlifyGitHubRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!auth.currentUser) {
    throw new Error('Authentication required');
  }

  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function mapMember(id: string, data: Record<string, unknown>): Member {
  return buildMemberProfile({
    id,
    name: typeof data.name === 'string' ? data.name : '',
    email: typeof data.email === 'string' ? data.email : '',
    role: typeof data.role === 'string' ? data.role : 'Member',
    color: typeof data.color === 'string' ? data.color : undefined,
    joinedAt: toDateString(data.joinedAt),
    github: mapGitHubConnection(data.github),
  });
}

function mapProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled Project',
    description: typeof data.description === 'string' ? data.description : '',
    progress: typeof data.progress === 'number' ? data.progress : 0,
    memberIds: Array.isArray(data.memberIds) ? data.memberIds.filter((x): x is string => typeof x === 'string') : [],
    taskCount: typeof data.taskCount === 'number' ? data.taskCount : 0,
    completedTaskCount: typeof data.completedTaskCount === 'number' ? data.completedTaskCount : 0,
    dueDate: toDateString(data.dueDate),
    startDate: toDateString(data.startDate),
    priority: (typeof data.priority === 'string' ? data.priority : 'Medium') as Priority,
    gradientFrom: typeof data.gradientFrom === 'string' ? data.gradientFrom : '#7C5CFF',
    gradientTo: typeof data.gradientTo === 'string' ? data.gradientTo : '#4F46E5',
    status: (typeof data.status === 'string' ? data.status : 'Active') as ProjectStatus,
    epicCount: typeof data.epicCount === 'number' ? data.epicCount : 0,
    createdAt: toDateString(data.createdAt),
    updatedAt: toDateString(data.updatedAt),
    github: mapProjectGitHub(data.github),
  };
}

function mapEpic(id: string, data: Record<string, unknown>): Epic {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled Epic',
    description: typeof data.description === 'string' ? data.description : '',
    color: typeof data.color === 'string' ? data.color : '#7C5CFF',
    taskCount: typeof data.taskCount === 'number' ? data.taskCount : 0,
    completedTaskCount: typeof data.completedTaskCount === 'number' ? data.completedTaskCount : 0,
    startDate: toDateString(data.startDate),
    endDate: toDateString(data.endDate),
    projectId: typeof data.projectId === 'string' ? data.projectId : '',
    createdAt: toDateString(data.createdAt),
  };
}

function mapTask(id: string, data: Record<string, unknown>): Task {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled Task',
    description: typeof data.description === 'string' ? data.description : '',
    type: (typeof data.type === 'string' ? data.type : 'Task') as TaskType,
    priority: (typeof data.priority === 'string' ? data.priority : 'Medium') as Priority,
    status: (typeof data.status === 'string' ? data.status : 'Backlog') as TaskStatus,
    order: typeof data.order === 'number' ? data.order : 0,
    epicOrder: typeof data.epicOrder === 'number' ? data.epicOrder : 0,
    epicId: typeof data.epicId === 'string' ? data.epicId : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((x): x is string => typeof x === 'string') : [],
    estimation: typeof data.estimation === 'number' ? data.estimation : 0,
    dueDate: toDateString(data.dueDate),
    assigneeId: typeof data.assigneeId === 'string' ? data.assigneeId : '',
    projectId: typeof data.projectId === 'string' ? data.projectId : '',
    comments: typeof data.comments === 'number' ? data.comments : 0,
    attachments: typeof data.attachments === 'number' ? data.attachments : 0,
    accentColor: typeof data.accentColor === 'string' ? data.accentColor : '#7C5CFF',
    createdAt: toDateString(data.createdAt),
    updatedAt: toDateString(data.updatedAt),
    github: mapTaskGitHub(data.github),
  };
}

function mapTaskComment(id: string, data: Record<string, unknown>): TaskComment {
  return {
    id,
    taskId: typeof data.taskId === 'string' ? data.taskId : '',
    projectId: typeof data.projectId === 'string' ? data.projectId : '',
    authorId: typeof data.authorId === 'string' ? data.authorId : '',
    body: typeof data.body === 'string' ? data.body : '',
    createdAt: toDateString(data.createdAt),
    updatedAt: toDateString(data.updatedAt),
  };
}

function mapActivity(id: string, data: Record<string, unknown>): Activity {
  return {
    id,
    userId: typeof data.userId === 'string' ? data.userId : '',
    action: typeof data.action === 'string' ? data.action : 'updated',
    target: typeof data.target === 'string' ? data.target : 'workspace',
    timestamp: toDateString(data.timestamp),
    type: (typeof data.type === 'string' ? data.type : 'project') as Activity['type'],
    projectId: typeof data.projectId === 'string' ? data.projectId : undefined,
    taskId: typeof data.taskId === 'string' ? data.taskId : undefined,
    epicId: typeof data.epicId === 'string' ? data.epicId : undefined,
    source: typeof data.source === 'string' ? (data.source as Activity['source']) : 'manual',
    fromStatus: typeof data.fromStatus === 'string' ? (data.fromStatus as TaskStatus) : undefined,
    toStatus: typeof data.toStatus === 'string' ? (data.toStatus as TaskStatus) : undefined,
    qualifiesContribution: Boolean(data.qualifiesContribution),
    visibility: data.visibility === 'system' ? 'system' : 'feed',
  };
}

function mapGitHubConnection(value: unknown): GitHubConnection | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const data = value as Record<string, unknown>;

  if (typeof data.installationId !== 'number') {
    return undefined;
  }

  const installations = Array.isArray(data.installations)
    ? data.installations
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        installationId: typeof item.installationId === 'number' ? item.installationId : 0,
        accountLogin: typeof item.accountLogin === 'string' ? item.accountLogin : '',
        accountType: typeof item.accountType === 'string' ? item.accountType : '',
        status: item.status === 'pending' ? 'pending' : 'connected',
        installedAt: toDateString(item.installedAt),
      }))
      .filter((item) => item.installationId > 0)
    : [];

  return {
    installationId: data.installationId,
    accountLogin: typeof data.accountLogin === 'string' ? data.accountLogin : '',
    accountType: typeof data.accountType === 'string' ? data.accountType : '',
    status: data.status === 'pending' ? 'pending' : 'connected',
    installedAt: toDateString(data.installedAt),
    installations: installations.length > 0
      ? installations
      : [{
        installationId: data.installationId,
        accountLogin: typeof data.accountLogin === 'string' ? data.accountLogin : '',
        accountType: typeof data.accountType === 'string' ? data.accountType : '',
        status: data.status === 'pending' ? 'pending' : 'connected',
        installedAt: toDateString(data.installedAt),
      }],
  };
}

function mapProjectGitHub(value: unknown): Project['github'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const data = value as Record<string, unknown>;

  if (typeof data.repositoryId !== 'number') {
    return undefined;
  }

  return {
    installationId: typeof data.installationId === 'number' ? data.installationId : 0,
    repositoryId: data.repositoryId,
    owner: typeof data.owner === 'string' ? data.owner : '',
    name: typeof data.name === 'string' ? data.name : '',
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    defaultBranch: typeof data.defaultBranch === 'string' ? data.defaultBranch : '',
    htmlUrl: typeof data.htmlUrl === 'string' ? data.htmlUrl : '',
    visibility: typeof data.visibility === 'string' ? data.visibility : '',
    syncedAt: toDateString(data.syncedAt),
  };
}

function mapTaskGitHub(value: unknown): Task['github'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const data = value as Record<string, unknown>;

  if (typeof data.issueId !== 'number' || typeof data.issueNumber !== 'number') {
    return undefined;
  }

  return {
    installationId: typeof data.installationId === 'number' ? data.installationId : 0,
    repositoryId: typeof data.repositoryId === 'number' ? data.repositoryId : 0,
    repositoryFullName: typeof data.repositoryFullName === 'string' ? data.repositoryFullName : '',
    issueId: data.issueId,
    issueNumber: data.issueNumber,
    issueUrl: typeof data.issueUrl === 'string' ? data.issueUrl : '',
    state: typeof data.state === 'string' ? data.state : 'open',
    labels: Array.isArray(data.labels) ? data.labels.filter((item): item is string => typeof item === 'string') : [],
    milestoneId: typeof data.milestoneId === 'number' ? data.milestoneId : undefined,
    milestoneTitle: typeof data.milestoneTitle === 'string' ? data.milestoneTitle : undefined,
    assigneeLogins: Array.isArray(data.assigneeLogins) ? data.assigneeLogins.filter((item): item is string => typeof item === 'string') : [],
    linkedPullRequests: Array.isArray(data.linkedPullRequests)
      ? data.linkedPullRequests
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          id: typeof item.id === 'number' ? item.id : 0,
          number: typeof item.number === 'number' ? item.number : 0,
          title: typeof item.title === 'string' ? item.title : '',
          url: typeof item.url === 'string' ? item.url : '',
          state: typeof item.state === 'string' ? item.state : '',
          merged: Boolean(item.merged),
          headRefName: typeof item.headRefName === 'string' ? item.headRefName : '',
          updatedAt: toDateString(item.updatedAt),
        }))
      : [],
    linkedCommits: Array.isArray(data.linkedCommits)
      ? data.linkedCommits
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          sha: typeof item.sha === 'string' ? item.sha : '',
          message: typeof item.message === 'string' ? item.message : '',
          url: typeof item.url === 'string' ? item.url : '',
          authorName: typeof item.authorName === 'string' ? item.authorName : '',
          committedAt: toDateString(item.committedAt),
        }))
      : [],
    syncedAt: toDateString(data.syncedAt),
  };
}

async function ensureMemberProfile(user: User, fallbackName?: string) {
  const memberRef = doc(db, 'members', user.uid);
  const existing = await getDoc(memberRef);
  const profile = buildMemberProfile({
    id: user.uid,
    name: user.displayName || fallbackName || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    role: existing.data()?.role ?? 'Owner',
    color: existing.data()?.color,
    joinedAt: existing.data()?.joinedAt ? toDateString(existing.data()?.joinedAt) : new Date().toISOString(),
  });

  await setDoc(
    memberRef,
    {
      ...profile,
      joinedAt: existing.data()?.joinedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);

      if (user) {
        await ensureMemberProfile(user);
      } else {
        setCurrentUser(null);
        setMembers([]);
        setProjects([]);
        setTasks([]);
        setTaskComments([]);
        setEpics([]);
        setActivities([]);
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!authUser) {
      return undefined;
    }

    setLoading(true);

    const unsubscribers = [
      onSnapshot(collection(db, 'members'), (snapshot) => {
        const next = snapshot.docs.map((item) => mapMember(item.id, item.data()));
        setMembers(sortByDateDesc(next, 'joinedAt'));
        setCurrentUser(next.find((member) => member.id === authUser.uid) ?? null);
      }),
      onSnapshot(collection(db, 'projects'), (snapshot) => {
        const next = snapshot.docs.map((item) => mapProject(item.id, item.data()));
        setProjects(sortByDateDesc(next, 'updatedAt'));
      }),
      onSnapshot(collection(db, 'tasks'), (snapshot) => {
        const next = snapshot.docs.map((item) => mapTask(item.id, item.data()));
        setTasks(sortByDateDesc(next, 'updatedAt'));
      }),
      onSnapshot(collection(db, 'taskComments'), (snapshot) => {
        const next = snapshot.docs.map((item) => mapTaskComment(item.id, item.data()));
        setTaskComments(sortByDateDesc(next, 'createdAt'));
      }),
      onSnapshot(collection(db, 'epics'), (snapshot) => {
        const next = snapshot.docs.map((item) => mapEpic(item.id, item.data()));
        setEpics(sortByDateDesc(next, 'createdAt'));
      }),
      onSnapshot(collection(db, 'activities'), (snapshot) => {
        const next = snapshot.docs.map((item) => mapActivity(item.id, item.data()));
        setActivities(sortByDateDesc(next, 'timestamp'));
        setLoading(false);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [authUser]);

  const hydratedProjects = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const completedTaskCount = projectTasks.filter((task) => task.status === 'Done' || task.status === 'Released').length;
      const taskCount = projectTasks.length;
      const epicCount = epics.filter((epic) => epic.projectId === project.id).length;

      return {
        ...project,
        taskCount,
        completedTaskCount,
        epicCount,
        progress: taskCount ? Math.round((completedTaskCount / taskCount) * 100) : 0,
      };
    });
  }, [epics, projects, tasks]);

  const hydratedEpics = useMemo(() => {
    return epics.map((epic) => {
      const epicTasks = tasks.filter((task) => task.epicId === epic.id);
      const completedTaskCount = epicTasks.filter((task) => task.status === 'Done' || task.status === 'Released').length;

      return {
        ...epic,
        taskCount: epicTasks.length,
        completedTaskCount,
      };
    });
  }, [epics, tasks]);

  const recordTaskContributionMove = async (task: Task, fromStatus: TaskStatus, toStatus: TaskStatus) => {
    if (!authUser || !isForwardTaskStatusChange(fromStatus, toStatus)) {
      return;
    }

    const latestCountedMove = activities.find((activity) => (
      activity.taskId === task.id
      && activity.qualifiesContribution
      && activity.type === 'task'
      && activity.timestamp
    ));

    const latestMoveTime = latestCountedMove?.timestamp ? Date.parse(latestCountedMove.timestamp) : Number.NaN;
    const now = Date.now();

    if (!Number.isNaN(latestMoveTime) && now - latestMoveTime < CONTRIBUTION_COOLDOWN_MS) {
      return;
    }

    await addDoc(collection(db, 'activities'), {
      userId: authUser.uid,
      action: 'counted move',
      target: task.title,
      type: 'task',
      timestamp: serverTimestamp(),
      projectId: task.projectId,
      taskId: task.id,
      source: 'manual',
      fromStatus,
      toStatus,
      qualifiesContribution: true,
      visibility: 'system',
    });
  };

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      authUser,
      currentUser,
      members,
      projects: hydratedProjects,
      tasks,
      taskComments,
      epics: hydratedEpics,
      activities,
      loading,
      authLoading,
      async signInWithEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signUpWithEmail(name, email, password) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        await ensureMemberProfile(credential.user, name);
      },
      async signInWithGoogle() {
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        const credential = await signInWithPopup(auth, googleProvider);
        await ensureMemberProfile(credential.user);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email);
      },
      async logout() {
        await signOut(auth);
      },
      async updateCurrentUserProfile(data) {
        if (!auth.currentUser) {
          return;
        }

        if (data.name !== auth.currentUser.displayName) {
          await updateProfile(auth.currentUser, { displayName: data.name });
        }

        await updateDoc(doc(db, 'members', auth.currentUser.uid), {
          name: data.name,
          email: data.email,
          updatedAt: serverTimestamp(),
        });
      },
      async createProject(input) {
        if (!auth.currentUser) {
          return;
        }

        const projectRef = await addDoc(collection(db, 'projects'), {
          ...input,
          progress: 0,
          memberIds: [auth.currentUser.uid],
          taskCount: 0,
          completedTaskCount: 0,
          status: 'Active',
          epicCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await addDoc(collection(db, 'activities'), {
          userId: auth.currentUser.uid,
          action: 'created project',
          target: input.title,
          type: 'project',
          timestamp: serverTimestamp(),
          projectId: projectRef.id,
        });
      },
      async deleteProject(projectId) {
        const project = projects.find((item) => item.id === projectId);
        if (!project) {
          return;
        }

        const batch = writeBatch(db);
        const projectTasks = tasks.filter((task) => task.projectId === projectId);
        const projectTaskComments = taskComments.filter((comment) => comment.projectId === projectId);
        const projectEpics = epics.filter((epic) => epic.projectId === projectId);
        const projectActivities = activities.filter((activity) => activity.projectId === projectId);

        projectTasks.forEach((task) => {
          batch.delete(doc(db, 'tasks', task.id));
        });

        projectTaskComments.forEach((comment) => {
          batch.delete(doc(db, 'taskComments', comment.id));
        });

        projectEpics.forEach((epic) => {
          batch.delete(doc(db, 'epics', epic.id));
        });

        projectActivities.forEach((activity) => {
          batch.delete(doc(db, 'activities', activity.id));
        });

        batch.delete(doc(db, 'projects', projectId));
        await batch.commit();
      },
      async createEpic(input) {
        if (!auth.currentUser) {
          return;
        }

        await addDoc(collection(db, 'epics'), {
          ...input,
          taskCount: 0,
          completedTaskCount: 0,
          startDate: new Date().toISOString(),
          endDate: input.endDate || '',
          createdAt: serverTimestamp(),
        });

        const project = projects.find((item) => item.id === input.projectId);
        if (project) {
          await updateDoc(doc(db, 'projects', project.id), {
            epicCount: project.epicCount + 1,
            updatedAt: serverTimestamp(),
          });
        }
      },
      async updateEpic(epicId, input) {
        await updateDoc(doc(db, 'epics', epicId), {
          ...input,
          updatedAt: serverTimestamp(),
        });
      },
      async deleteEpic(epicId) {
        const epic = epics.find((item) => item.id === epicId);
        if (!epic) {
          return;
        }

        const batch = writeBatch(db);

        tasks
          .filter((task) => task.epicId === epicId)
          .forEach((task) => {
            batch.update(doc(db, 'tasks', task.id), {
              epicId: '',
              epicOrder: 0,
              updatedAt: serverTimestamp(),
            });
          });

        batch.delete(doc(db, 'epics', epicId));
        await batch.commit();

        const project = projects.find((item) => item.id === epic.projectId);
        if (project) {
          await updateDoc(doc(db, 'projects', epic.projectId), {
            epicCount: Math.max(project.epicCount - 1, 0),
            updatedAt: serverTimestamp(),
          });
        }
      },
      async assignTasksToEpic(epicId, taskIds) {
        const batch = writeBatch(db);
        const nextEpicOrder = tasks
          .filter((task) => task.epicId === epicId)
          .sort((left, right) => left.epicOrder - right.epicOrder)
          .at(-1)?.epicOrder ?? -1;

        taskIds.forEach((taskId, index) => {
          batch.update(doc(db, 'tasks', taskId), {
            epicId,
            epicOrder: nextEpicOrder + index + 1,
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      },
      async removeTaskFromEpic(taskId) {
        await updateDoc(doc(db, 'tasks', taskId), {
          epicId: '',
          epicOrder: 0,
          updatedAt: serverTimestamp(),
        });
      },
      async reorderEpicTasks(epicId, orderedTaskIds) {
        const batch = writeBatch(db);

        orderedTaskIds.forEach((taskId, index) => {
          batch.update(doc(db, 'tasks', taskId), {
            epicId,
            epicOrder: index,
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      },
      async createTask(input) {
        if (!auth.currentUser) {
          return;
        }

        const project = projects.find((item) => item.id === input.projectId);
        if (!project) {
          return;
        }

        const statusTasks = tasks
          .filter((item) => item.projectId === input.projectId && item.status === input.status)
          .sort((left, right) => left.order - right.order);
        const nextOrder = statusTasks.length > 0 ? statusTasks[statusTasks.length - 1].order + 1 : 0;

        await addDoc(collection(db, 'tasks'), {
          projectId: input.projectId,
          title: input.title.trim(),
          description: input.description?.trim() || '',
          type: input.type || 'Task',
          priority: input.priority || 'Medium',
          status: input.status,
          order: nextOrder,
          epicOrder: 0,
          epicId: input.epicId || '',
          tags: input.tags || [],
          estimation: input.estimation || 0,
          dueDate: input.dueDate || '',
          assigneeId: input.assigneeId || auth.currentUser.uid,
          comments: 0,
          attachments: 0,
          accentColor: input.accentColor || project.gradientFrom,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'projects', input.projectId), {
          taskCount: project.taskCount + 1,
          updatedAt: serverTimestamp(),
        });
      },
      async updateTask(taskId, input) {
        const task = tasks.find((item) => item.id === taskId);
        await updateDoc(doc(db, 'tasks', taskId), {
          ...input,
          updatedAt: serverTimestamp(),
        });

        if (task && input.status && input.status !== task.status) {
          await recordTaskContributionMove(task, task.status, input.status);
        }
      },
      async deleteTask(taskId) {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) {
          return;
        }

        const batch = writeBatch(db);
        batch.delete(doc(db, 'tasks', taskId));

        taskComments
          .filter((comment) => comment.taskId === taskId)
          .forEach((comment) => {
            batch.delete(doc(db, 'taskComments', comment.id));
          });

        await batch.commit();

        const project = projects.find((item) => item.id === task.projectId);
        if (project) {
          await updateDoc(doc(db, 'projects', task.projectId), {
            taskCount: Math.max(project.taskCount - 1, 0),
            updatedAt: serverTimestamp(),
          });
        }
      },
      async addTaskComment(taskId, body) {
        if (!auth.currentUser) {
          return;
        }

        const task = tasks.find((item) => item.id === taskId);
        const message = body.trim();
        if (!task || !message) {
          return;
        }

        await addDoc(collection(db, 'taskComments'), {
          taskId,
          projectId: task.projectId,
          authorId: auth.currentUser.uid,
          body: message,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'tasks', taskId), {
          comments: task.comments + 1,
          updatedAt: serverTimestamp(),
        });

        await addDoc(collection(db, 'activities'), {
          userId: auth.currentUser.uid,
          action: 'commented on task',
          target: task.title,
          type: 'comment',
          timestamp: serverTimestamp(),
          projectId: task.projectId,
          taskId,
          visibility: 'feed',
        });
      },
      async deleteTaskComment(commentId) {
        const comment = taskComments.find((item) => item.id === commentId);
        if (!comment) {
          return;
        }

        await deleteDoc(doc(db, 'taskComments', commentId));

        const task = tasks.find((item) => item.id === comment.taskId);
        if (task) {
          await updateDoc(doc(db, 'tasks', task.id), {
            comments: Math.max(task.comments - 1, 0),
            updatedAt: serverTimestamp(),
          });
        }
      },
      async reorderTasks(projectId, status, orderedTaskIds, moveMeta) {
        const batch = writeBatch(db);

        orderedTaskIds.forEach((taskId, index) => {
          batch.update(doc(db, 'tasks', taskId), {
            projectId,
            status,
            order: index,
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();

        if (moveMeta) {
          const movedTask = tasks.find((item) => item.id === moveMeta.movedTaskId);
          if (movedTask) {
            await recordTaskContributionMove(movedTask, moveMeta.fromStatus, status);
          }
        }
      },
      async inviteProjectMember(projectId, email) {
        const normalizedEmail = email.trim().toLowerCase();
        const project = projects.find((item) => item.id === projectId);
        const member = members.find((item) => item.email.trim().toLowerCase() === normalizedEmail);

        if (!project || !normalizedEmail) {
          return 'member-not-found';
        }

        if (!member) {
          return 'member-not-found';
        }

        if (project.memberIds.includes(member.id)) {
          return 'already-member';
        }

        await updateDoc(doc(db, 'projects', projectId), {
          memberIds: [...project.memberIds, member.id],
          updatedAt: serverTimestamp(),
        });

        if (auth.currentUser) {
          await addDoc(collection(db, 'activities'), {
            userId: auth.currentUser.uid,
            action: 'invited member',
            target: member.name,
            type: 'member',
            timestamp: serverTimestamp(),
            projectId,
          });
        }

        return 'invited';
      },
      async getGitHubInstallUrl() {
        const response = await netlifyGitHubRequest<{ url: string }>('/api/github/install-url');
        return response.url;
      },
      async completeGitHubInstallation(installationId) {
        await netlifyGitHubRequest<{ ok: boolean }>('/api/github/complete-installation', {
          method: 'POST',
          body: JSON.stringify({ installationId }),
        });
      },
      async disconnectGitHub() {
        await netlifyGitHubRequest<{ ok: boolean }>('/api/github/disconnect', {
          method: 'POST',
          body: JSON.stringify({}),
        });
      },
      async listGitHubRepositories() {
        const response = await netlifyGitHubRequest<{ repositories: GitHubRepositoryOption[] }>('/api/github/repositories');
        return response.repositories;
      },
      async importGitHubRepository(input) {
        return netlifyGitHubRequest<{ projectId: string; created: boolean }>('/api/github/import-repository', {
          method: 'POST',
          body: JSON.stringify(input),
        });
      },
      async syncGitHubProject(projectId) {
        return netlifyGitHubRequest<{ imported: number }>('/api/github/sync-project', {
          method: 'POST',
          body: JSON.stringify({ projectId }),
        });
      },
    }),
    [
      activities,
      authLoading,
      authUser,
      currentUser,
      epics,
      hydratedEpics,
      hydratedProjects,
      loading,
      members,
      projects,
      taskComments,
      recordTaskContributionMove,
      tasks,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }

  return context;
}
