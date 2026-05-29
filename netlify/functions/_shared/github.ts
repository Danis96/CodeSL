import type { Config, Context } from '@netlify/functions';
import { createHmac, createPrivateKey, createSign, timingSafeEqual } from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const requiredEnv = [
  'GITHUB_APP_ID',
  'GITHUB_APP_SLUG',
  'GITHUB_PRIVATE_KEY',
  'GITHUB_WEBHOOK_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;

function getEnv(name: (typeof requiredEnv)[number]) {
  const value = Netlify.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function normalizePrivateKey(raw: string) {
  const trimmed = raw.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  const withNewlines = unquoted
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n');

  // Support base64-encoded PEM secrets in env vars.
  if (!withNewlines.includes('BEGIN') && !withNewlines.includes('\n')) {
    try {
      const decoded = Buffer.from(withNewlines, 'base64').toString('utf8').trim();
      if (decoded.includes('BEGIN')) {
        return decoded;
      }
    } catch {
      // Ignore decode errors and fall back to the original value.
    }
  }

  return withNewlines;
}

function summarizePrivateKey(raw: string) {
  const lines = raw.split('\n').filter(Boolean);
  return {
    length: raw.length,
    lineCount: lines.length,
    firstLine: lines[0] || '',
    lastLine: lines.at(-1) || '',
    hasBegin: raw.includes('BEGIN'),
  };
}

function getSigningKey(raw: string) {
  const normalized = normalizePrivateKey(raw);

  if (normalized.includes('BEGIN')) {
    return createPrivateKey({ key: normalized, format: 'pem' });
  }

  const decoded = Buffer.from(normalized, 'base64');

  const asText = decoded.toString('utf8').trim();
  if (asText.includes('BEGIN')) {
    return createPrivateKey({ key: asText, format: 'pem' });
  }

  try {
    return createPrivateKey({ key: decoded, format: 'der', type: 'pkcs8' });
  } catch {
    return createPrivateKey({ key: decoded, format: 'der', type: 'pkcs1' });
  }
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: getEnv('FIREBASE_PROJECT_ID'),
      clientEmail: getEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: normalizePrivateKey(getEnv('FIREBASE_PRIVATE_KEY')),
    }),
    projectId: getEnv('FIREBASE_PROJECT_ID'),
  });
}

const adminApp = getAdminApp();
const adminAuth = getAuth(adminApp);
const db = getFirestore(adminApp);

type AuthedHandler = (request: Request, context: Context, uid: string) => Promise<Response>;

export const jsonHeaders = {
  'Content-Type': 'application/json',
};

export async function requireAuth(request: Request, context: Context, handler: AuthedHandler) {
  try {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

    if (!token) {
      return json({ error: 'Missing authorization token' }, 401);
    }

    const decoded = await adminAuth.verifyIdToken(token);
    return handler(request, context, decoded.uid);
  } catch (error) {
    console.error(error);
    return json({ error: 'Unauthorized' }, 401);
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function toBase64Url(input: string) {
  return Buffer.from(input).toString('base64url');
}

function createGitHubAppJwt() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${toBase64Url(JSON.stringify({
    iat: now - 60,
    exp: now + 540,
    iss: getEnv('GITHUB_APP_ID'),
  }))}`;
  const rawKey = getEnv('GITHUB_PRIVATE_KEY');
  let signingKey;

  try {
    signingKey = getSigningKey(rawKey);
  } catch (error) {
    throw new Error(
      `Unable to parse GITHUB_PRIVATE_KEY: ${JSON.stringify(summarizePrivateKey(normalizePrivateKey(rawKey)))}`,
      { cause: error },
    );
  }

  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .end()
    .sign(signingKey, 'base64url');
  return `${unsigned}.${signature}`;
}

export async function githubRequest<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: init.method || 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${init.token || createGitHubAppJwt()}`,
      'User-Agent': 'slave-netlify-github',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export async function getInstallationToken(installationId: number) {
  const response = await githubRequest<{ token: string }>(`/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
  });
  return response.token;
}

type GitHubInstallationConnection = {
  installationId: number;
  accountLogin: string;
  accountType: string;
  status: 'connected' | 'pending';
  installedAt: string;
};

export async function requireGitHubConnection(uid: string) {
  const memberSnapshot = await db.collection('members').doc(uid).get();
  const github = memberSnapshot.data()?.github as Record<string, unknown> | undefined;

  if (!github) {
    throw new Error('GitHub not connected');
  }

  const installations = Array.isArray(github.installations)
    ? github.installations
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        installationId: typeof item.installationId === 'number' ? item.installationId : 0,
        accountLogin: typeof item.accountLogin === 'string' ? item.accountLogin : '',
        accountType: typeof item.accountType === 'string' ? item.accountType : '',
        status: item.status === 'pending' ? 'pending' : 'connected',
        installedAt: typeof item.installedAt === 'string' ? item.installedAt : '',
      }))
      .filter((item) => item.installationId > 0)
    : [];

  if (installations.length === 0 && typeof github.installationId === 'number') {
    installations.push({
      installationId: github.installationId,
      accountLogin: typeof github.accountLogin === 'string' ? github.accountLogin : '',
      accountType: typeof github.accountType === 'string' ? github.accountType : '',
      status: github.status === 'pending' ? 'pending' : 'connected',
      installedAt: typeof github.installedAt === 'string' ? github.installedAt : '',
    });
  }

  if (installations.length === 0) {
    throw new Error('GitHub not connected');
  }

  const primaryInstallation = installations[installations.length - 1];
  return {
    installationId: primaryInstallation.installationId,
    accountLogin: primaryInstallation.accountLogin,
    accountType: primaryInstallation.accountType,
    installations,
  };
}

function normalizePriority(labels: Array<{ name: string }>) {
  const names = labels.map((label) => label.name.toLowerCase());
  if (names.some((name) => name.includes('critical') || name === 'p0')) return 'Critical';
  if (names.some((name) => name.includes('high') || name === 'p1')) return 'High';
  if (names.some((name) => name.includes('low') || name === 'p3')) return 'Low';
  return 'Medium';
}

function normalizeType(labels: Array<{ name: string }>) {
  const names = labels.map((label) => label.name.toLowerCase());
  if (names.some((name) => name.includes('bug') || name.includes('fix'))) return 'Bug';
  if (names.some((name) => name.includes('feature') || name.includes('enhancement'))) return 'Feature';
  if (names.some((name) => name.includes('improvement') || name.includes('refactor'))) return 'Improvement';
  return 'Task';
}

function normalizeStatus(issue: { state: string }) {
  return issue.state === 'closed' ? 'Done' : 'Todo';
}

export function buildRepoMetadata(installationId: number, repository: Record<string, any>) {
  return {
    installationId,
    repositoryId: repository.id,
    owner: repository.owner.login,
    name: repository.name,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch || '',
    htmlUrl: repository.html_url,
    visibility: repository.visibility || (repository.private ? 'private' : 'public'),
    syncedAt: new Date().toISOString(),
  };
}

async function ensureEpicForMilestone(projectId: string, milestone?: Record<string, any> | null) {
  if (!milestone?.id) {
    return null;
  }

  const snapshot = await db
    .collection('epics')
    .where('projectId', '==', projectId)
    .where('githubMilestoneId', '==', milestone.id)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const existing = snapshot.docs[0];
    await existing.ref.set({
      title: milestone.title,
      description: milestone.description || '',
      endDate: milestone.due_on || '',
      githubMilestoneId: milestone.id,
      githubHtmlUrl: milestone.html_url || '',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return existing.id;
  }

  const created = await db.collection('epics').add({
    title: milestone.title,
    description: milestone.description || '',
    color: '#62ffbf',
    taskCount: 0,
    completedTaskCount: 0,
    startDate: new Date().toISOString(),
    endDate: milestone.due_on || '',
    projectId,
    createdAt: FieldValue.serverTimestamp(),
    githubMilestoneId: milestone.id,
    githubHtmlUrl: milestone.html_url || '',
  });

  return created.id;
}

export async function upsertIssueTask(input: {
  project: FirebaseFirestore.DocumentSnapshot;
  issue: Record<string, any>;
  installationId: number;
}) {
  const { project, issue, installationId } = input;
  const milestoneEpicId = await ensureEpicForMilestone(project.id, issue.milestone);
  const existingSnapshot = await db
    .collection('tasks')
    .where('projectId', '==', project.id)
    .where('github.issueId', '==', issue.id)
    .limit(1)
    .get();

  const labels = Array.isArray(issue.labels) ? issue.labels.filter((label) => typeof label?.name === 'string') : [];
  const existingTask = existingSnapshot.empty ? null : existingSnapshot.docs[0];
  const payload = {
    projectId: project.id,
    title: issue.title,
    description: issue.body || '',
    type: normalizeType(labels),
    priority: normalizePriority(labels),
    status: normalizeStatus(issue),
    order: existingTask?.data()?.order || issue.number,
    epicOrder: existingTask?.data()?.epicOrder || 0,
    epicId: milestoneEpicId || '',
    tags: labels.map((label: { name: string }) => label.name),
    estimation: existingTask?.data()?.estimation || 0,
    dueDate: issue.milestone?.due_on || '',
    assigneeId: existingTask?.data()?.assigneeId || '',
    comments: issue.comments || 0,
    attachments: existingTask?.data()?.attachments || 0,
    accentColor: existingTask?.data()?.accentColor || project.data()?.gradientFrom || '#7C5CFF',
    updatedAt: FieldValue.serverTimestamp(),
    github: {
      installationId,
      repositoryId: project.data()?.github.repositoryId,
      repositoryFullName: project.data()?.github.fullName,
      issueId: issue.id,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      state: issue.state,
      labels: labels.map((label: { name: string }) => label.name),
      milestoneId: issue.milestone?.id || null,
      milestoneTitle: issue.milestone?.title || '',
      assigneeLogins: Array.isArray(issue.assignees) ? issue.assignees.map((assignee: { login: string }) => assignee.login).filter(Boolean) : [],
      linkedPullRequests: existingTask?.data()?.github?.linkedPullRequests || [],
      linkedCommits: existingTask?.data()?.github?.linkedCommits || [],
      syncedAt: new Date().toISOString(),
    },
  };

  if (existingTask) {
    await existingTask.ref.set(payload, { merge: true });
    return { id: existingTask.id, created: false };
  }

  const created = await db.collection('tasks').add({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: created.id, created: true };
}

export async function writeGitHubActivity(input: { projectId: string; taskId?: string; action: string; target: string }) {
  await db.collection('activities').add({
    userId: 'github',
    action: input.action,
    target: input.target,
    timestamp: FieldValue.serverTimestamp(),
    type: input.taskId ? 'task' : 'project',
    projectId: input.projectId,
    taskId: input.taskId || null,
    source: 'github',
  });
}

export async function syncProjectIssuesInternal(projectId: string) {
  const project = await db.collection('projects').doc(projectId).get();
  const github = project.data()?.github;

  if (!project.exists || !github?.installationId || !github?.repositoryId) {
    throw new Error('Project has no GitHub repository');
  }

  const token = await getInstallationToken(github.installationId);
  const importedIssueResults: Array<{ id: string; created: boolean }> = [];
  let page = 1;

  while (true) {
    const issues = await githubRequest<Array<Record<string, any>>>(`/repos/${github.fullName}/issues?state=all&per_page=100&page=${page}`, {
      token,
    });

    const filteredIssues = issues.filter((issue) => !issue.pull_request);
    for (const issue of filteredIssues) {
      const result = await upsertIssueTask({
        project,
        issue,
        installationId: github.installationId,
      });
      importedIssueResults.push(result);
      await writeGitHubActivity({
        projectId,
        taskId: result.id,
        action: result.created ? 'imported GitHub issue' : 'synced GitHub issue',
        target: issue.title,
      });
    }

    if (issues.length < 100) {
      break;
    }
    page += 1;
  }

  await project.ref.set({
    github: {
      ...github,
      syncedAt: new Date().toISOString(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return importedIssueResults.length;
}

export function extractIssueNumbers(...inputs: Array<string | undefined>) {
  const values = inputs.filter(Boolean).join('\n');
  const matches = values.match(/#(\d+)/g) || [];
  return [...new Set(matches.map((match) => Number(match.slice(1))).filter(Boolean))];
}

export function addPullRequestLink(existingLinks: Array<Record<string, any>> | undefined, pullRequest: Record<string, any>) {
  const next = Array.isArray(existingLinks) ? [...existingLinks] : [];
  const filtered = next.filter((item) => item.id !== pullRequest.id);
  filtered.unshift(pullRequest);
  return filtered.slice(0, 10);
}

export function addCommitLinks(existingLinks: Array<Record<string, any>> | undefined, commits: Array<Record<string, any>>) {
  const next = Array.isArray(existingLinks) ? [...existingLinks] : [];
  for (const commit of commits) {
    if (next.some((item) => item.sha === commit.sha)) {
      continue;
    }
    next.unshift(commit);
  }
  return next.slice(0, 20);
}

export async function getProjectByRepositoryId(repositoryId: number) {
  const snapshot = await db.collection('projects').where('github.repositoryId', '==', repositoryId).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}

export function getGitHubAppSlug() {
  return getEnv('GITHUB_APP_SLUG');
}

export function verifyWebhookSignature(body: string, signature: string | null) {
  if (!signature) {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', getEnv('GITHUB_WEBHOOK_SECRET')).update(body).digest('hex')}`;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export { db, FieldValue };

export const postConfig: Config = {
  method: ['POST'],
};
