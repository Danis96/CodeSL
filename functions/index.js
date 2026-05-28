'use strict';

const crypto = require('node:crypto');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');

admin.initializeApp();

const db = admin.firestore();

const GITHUB_APP_ID = defineString('GITHUB_APP_ID');
const GITHUB_APP_SLUG = defineString('GITHUB_APP_SLUG');
const GITHUB_PRIVATE_KEY = defineSecret('GITHUB_PRIVATE_KEY');
const GITHUB_WEBHOOK_SECRET = defineSecret('GITHUB_WEBHOOK_SECRET');

function getPrivateKey() {
  return GITHUB_PRIVATE_KEY.value().replace(/\\n/g, '\n');
}

function toBase64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function createGitHubAppJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({
    iat: now - 60,
    exp: now + 540,
    iss: GITHUB_APP_ID.value(),
  }));
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).end().sign(getPrivateKey(), 'base64url');
  return `${unsigned}.${signature}`;
}

async function githubRequest(path, { method = 'GET', authMode = 'app', token, body } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token || createGitHubAppJwt()}`,
    'User-Agent': 'slave-github-integration',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub ${authMode} request failed: ${response.status} ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function getInstallationToken(installationId) {
  const response = await githubRequest(`/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    authMode: 'app',
  });
  return response.token;
}

async function requireGitHubConnection(uid) {
  const memberSnapshot = await db.collection('members').doc(uid).get();
  const github = memberSnapshot.data()?.github;

  if (!github?.installationId) {
    throw new HttpsError('failed-precondition', 'GitHub not connected.');
  }

  return github;
}

function normalizePriority(labels) {
  const names = labels.map((label) => label.name.toLowerCase());

  if (names.some((name) => name.includes('critical') || name === 'p0')) {
    return 'Critical';
  }
  if (names.some((name) => name.includes('high') || name === 'p1')) {
    return 'High';
  }
  if (names.some((name) => name.includes('low') || name === 'p3')) {
    return 'Low';
  }

  return 'Medium';
}

function normalizeType(labels) {
  const names = labels.map((label) => label.name.toLowerCase());

  if (names.some((name) => name.includes('bug') || name.includes('fix'))) {
    return 'Bug';
  }
  if (names.some((name) => name.includes('feature') || name.includes('enhancement'))) {
    return 'Feature';
  }
  if (names.some((name) => name.includes('improvement') || name.includes('refactor'))) {
    return 'Improvement';
  }

  return 'Task';
}

function normalizeStatus(issue) {
  if (issue.state === 'closed') {
    return 'Done';
  }

  return 'Todo';
}

function buildRepoMetadata(installationId, repository) {
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

async function ensureEpicForMilestone(projectId, milestone) {
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

async function upsertIssueTask({ project, issue, installationId }) {
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
    tags: labels.map((label) => label.name),
    estimation: existingTask?.data()?.estimation || 0,
    dueDate: issue.milestone?.due_on || '',
    assigneeId: existingTask?.data()?.assigneeId || '',
    comments: issue.comments || 0,
    attachments: existingTask?.data()?.attachments || 0,
    accentColor: existingTask?.data()?.accentColor || project.data().gradientFrom || '#7C5CFF',
    updatedAt: FieldValue.serverTimestamp(),
    github: {
      installationId,
      repositoryId: project.data().github.repositoryId,
      repositoryFullName: project.data().github.fullName,
      issueId: issue.id,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      state: issue.state,
      labels: labels.map((label) => label.name),
      milestoneId: issue.milestone?.id || null,
      milestoneTitle: issue.milestone?.title || '',
      assigneeLogins: Array.isArray(issue.assignees) ? issue.assignees.map((assignee) => assignee.login).filter(Boolean) : [],
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

async function writeGitHubActivity({ projectId, taskId, action, target }) {
  await db.collection('activities').add({
    userId: 'github',
    action,
    target,
    timestamp: FieldValue.serverTimestamp(),
    type: taskId ? 'task' : 'project',
    projectId,
    taskId: taskId || null,
    source: 'github',
  });
}

async function syncProjectIssuesInternal(projectId) {
  const project = await db.collection('projects').doc(projectId).get();
  const github = project.data()?.github;

  if (!project.exists || !github?.installationId || !github?.repositoryId) {
    throw new HttpsError('failed-precondition', 'Project has no GitHub repository.');
  }

  const token = await getInstallationToken(github.installationId);
  const importedIssueResults = [];
  let page = 1;

  while (true) {
    const issues = await githubRequest(`/repos/${github.fullName}/issues?state=all&per_page=100&page=${page}`, {
      authMode: 'installation',
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

function extractIssueNumbers(...inputs) {
  const values = inputs.filter(Boolean).join('\n');
  const matches = values.match(/#(\d+)/g) || [];
  return [...new Set(matches.map((match) => Number(match.slice(1))).filter(Boolean))];
}

function addPullRequestLink(existingLinks, pullRequest) {
  const next = Array.isArray(existingLinks) ? [...existingLinks] : [];
  const filtered = next.filter((item) => item.id !== pullRequest.id);
  filtered.unshift(pullRequest);
  return filtered.slice(0, 10);
}

function addCommitLinks(existingLinks, commits) {
  const next = Array.isArray(existingLinks) ? [...existingLinks] : [];
  for (const commit of commits) {
    if (next.some((item) => item.sha === commit.sha)) {
      continue;
    }
    next.unshift(commit);
  }
  return next.slice(0, 20);
}

async function getProjectByRepositoryId(repositoryId) {
  const snapshot = await db.collection('projects').where('github.repositoryId', '==', repositoryId).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}

exports.getGitHubInstallUrl = onCall({ secrets: [GITHUB_PRIVATE_KEY] }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }

  return { url: `https://github.com/apps/${GITHUB_APP_SLUG.value()}/installations/new` };
});

exports.completeGitHubInstallation = onCall({ secrets: [GITHUB_PRIVATE_KEY] }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }

  const installationId = Number(request.data?.installationId);
  if (!installationId) {
    throw new HttpsError('invalid-argument', 'installationId required.');
  }

  const installation = await githubRequest(`/app/installations/${installationId}`, {
    authMode: 'app',
  });

  await db.collection('members').doc(request.auth.uid).set({
    github: {
      installationId,
      accountLogin: installation.account?.login || '',
      accountType: installation.account?.type || '',
      status: 'connected',
      installedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

exports.disconnectGitHub = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }

  await db.collection('members').doc(request.auth.uid).set({
    github: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

exports.listGitHubRepositories = onCall({ secrets: [GITHUB_PRIVATE_KEY] }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }

  const github = await requireGitHubConnection(request.auth.uid);
  const token = await getInstallationToken(github.installationId);
  const response = await githubRequest('/installation/repositories?per_page=100', {
    authMode: 'installation',
    token,
  });
  const projectSnapshot = await db.collection('projects').where('github.installationId', '==', github.installationId).get();
  const importedByRepoId = new Map(projectSnapshot.docs.map((project) => [project.data().github.repositoryId, project.id]));

  return {
    repositories: response.repositories.map((repository) => ({
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      owner: repository.owner.login,
      defaultBranch: repository.default_branch || '',
      htmlUrl: repository.html_url,
      visibility: repository.visibility || (repository.private ? 'private' : 'public'),
      openIssuesCount: repository.open_issues_count || 0,
      alreadyImportedProjectId: importedByRepoId.get(repository.id) || '',
    })),
  };
});

exports.importGitHubRepository = onCall({ secrets: [GITHUB_PRIVATE_KEY] }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }

  const repositoryId = Number(request.data?.repositoryId);
  const requestedProjectId = typeof request.data?.projectId === 'string' ? request.data.projectId : '';
  if (!repositoryId) {
    throw new HttpsError('invalid-argument', 'repositoryId required.');
  }

  const github = await requireGitHubConnection(request.auth.uid);
  const token = await getInstallationToken(github.installationId);
  const repository = await githubRequest(`/repositories/${repositoryId}`, {
    authMode: 'installation',
    token,
  });
  const repoMetadata = buildRepoMetadata(github.installationId, repository);

  let projectRef;
  let created = false;

  if (requestedProjectId) {
    projectRef = db.collection('projects').doc(requestedProjectId);
    await projectRef.set({
      github: repoMetadata,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } else {
    projectRef = await db.collection('projects').add({
      title: repository.name,
      description: repository.description || `Imported from ${repository.full_name}`,
      progress: 0,
      memberIds: [request.auth.uid],
      taskCount: 0,
      completedTaskCount: 0,
      dueDate: '',
      startDate: new Date().toISOString(),
      priority: 'Medium',
      gradientFrom: '#121f12',
      gradientTo: '#2e5d2e',
      status: 'Active',
      epicCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      github: repoMetadata,
    });
    created = true;
  }

  await writeGitHubActivity({
    projectId: projectRef.id,
    action: 'linked GitHub repository',
    target: repository.full_name,
  });

  const imported = await syncProjectIssuesInternal(projectRef.id);

  return {
    projectId: projectRef.id,
    created,
    imported,
  };
});

exports.syncGitHubProject = onCall({ secrets: [GITHUB_PRIVATE_KEY] }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }

  const projectId = typeof request.data?.projectId === 'string' ? request.data.projectId : '';
  if (!projectId) {
    throw new HttpsError('invalid-argument', 'projectId required.');
  }

  const imported = await syncProjectIssuesInternal(projectId);
  return { imported };
});

exports.githubWebhook = onRequest({ secrets: [GITHUB_WEBHOOK_SECRET, GITHUB_PRIVATE_KEY] }, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).send('Method not allowed');
    return;
  }

  const signature = request.get('x-hub-signature-256') || '';
  const expected = `sha256=${crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET.value()).update(request.rawBody).digest('hex')}`;

  if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    response.status(401).send('Invalid signature');
    return;
  }

  const eventName = request.get('x-github-event');
  const payload = request.body;

  if (!payload?.repository?.id) {
    response.status(200).send('Ignored');
    return;
  }

  const project = await getProjectByRepositoryId(payload.repository.id);
  if (!project) {
    response.status(200).send('No linked project');
    return;
  }

  if (eventName === 'issues' && payload.issue && !payload.issue.pull_request) {
    const result = await upsertIssueTask({
      project,
      issue: payload.issue,
      installationId: payload.installation?.id || project.data().github.installationId,
    });
    await writeGitHubActivity({
      projectId: project.id,
      taskId: result.id,
      action: `github issue ${payload.action}`,
      target: payload.issue.title,
    });
  }

  if (eventName === 'pull_request' && payload.pull_request) {
    const issueNumbers = extractIssueNumbers(
      payload.pull_request.title,
      payload.pull_request.body,
      payload.pull_request.head?.ref,
    );

    for (const issueNumber of issueNumbers) {
      const snapshot = await db
        .collection('tasks')
        .where('projectId', '==', project.id)
        .where('github.issueNumber', '==', issueNumber)
        .limit(1)
        .get();

      if (snapshot.empty) {
        continue;
      }

      const task = snapshot.docs[0];
      const taskGithub = task.data().github || {};
      await task.ref.set({
        github: {
          ...taskGithub,
          linkedPullRequests: addPullRequestLink(taskGithub.linkedPullRequests, {
            id: payload.pull_request.id,
            number: payload.pull_request.number,
            title: payload.pull_request.title,
            url: payload.pull_request.html_url,
            state: payload.pull_request.state,
            merged: Boolean(payload.pull_request.merged),
            headRefName: payload.pull_request.head?.ref || '',
            updatedAt: payload.pull_request.updated_at || new Date().toISOString(),
          }),
          syncedAt: new Date().toISOString(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      await writeGitHubActivity({
        projectId: project.id,
        taskId: task.id,
        action: `github pull request ${payload.action}`,
        target: payload.pull_request.title,
      });
    }
  }

  if (eventName === 'push' && Array.isArray(payload.commits)) {
    const commitsByIssue = new Map();

    for (const commit of payload.commits) {
      const issueNumbers = extractIssueNumbers(commit.message);
      for (const issueNumber of issueNumbers) {
        const current = commitsByIssue.get(issueNumber) || [];
        current.push({
          sha: commit.id,
          message: commit.message.split('\n')[0],
          url: commit.url,
          authorName: commit.author?.name || '',
          committedAt: commit.timestamp || new Date().toISOString(),
        });
        commitsByIssue.set(issueNumber, current);
      }
    }

    for (const [issueNumber, commits] of commitsByIssue.entries()) {
      const snapshot = await db
        .collection('tasks')
        .where('projectId', '==', project.id)
        .where('github.issueNumber', '==', issueNumber)
        .limit(1)
        .get();

      if (snapshot.empty) {
        continue;
      }

      const task = snapshot.docs[0];
      const taskGithub = task.data().github || {};
      await task.ref.set({
        github: {
          ...taskGithub,
          linkedCommits: addCommitLinks(taskGithub.linkedCommits, commits),
          syncedAt: new Date().toISOString(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      await writeGitHubActivity({
        projectId: project.id,
        taskId: task.id,
        action: 'github push linked commit',
        target: commits[0].message,
      });
    }
  }

  await project.ref.set({
    github: {
      ...project.data().github,
      syncedAt: new Date().toISOString(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  response.status(200).send('ok');
});
