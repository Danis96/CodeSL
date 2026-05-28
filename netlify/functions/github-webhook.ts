import type { Config } from '@netlify/functions';
import {
  FieldValue,
  addCommitLinks,
  addPullRequestLink,
  db,
  extractIssueNumbers,
  getProjectByRepositoryId,
  json,
  upsertIssueTask,
  verifyWebhookSignature,
  writeGitHubActivity,
} from './_shared/github';

export default async (request: Request) => {
  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return json({ error: 'Invalid signature' }, 401);
  }

  const payload = JSON.parse(rawBody) as Record<string, any>;
  const eventName = request.headers.get('x-github-event');

  if (!payload?.repository?.id) {
    return new Response('Ignored', { status: 200 });
  }

  const project = await getProjectByRepositoryId(payload.repository.id);
  if (!project) {
    return new Response('No linked project', { status: 200 });
  }

  if (eventName === 'issues' && payload.issue && !payload.issue.pull_request) {
    const result = await upsertIssueTask({
      project,
      issue: payload.issue,
      installationId: payload.installation?.id || project.data()?.github.installationId,
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
    const commitsByIssue = new Map<number, Array<Record<string, any>>>();

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
      ...project.data()?.github,
      syncedAt: new Date().toISOString(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return new Response('ok', { status: 200 });
};

export const config: Config = {
  path: '/api/github/webhook',
  method: ['POST'],
};
