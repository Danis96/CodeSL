import type { Config } from '@netlify/functions';
import {
  FieldValue,
  buildRepoMetadata,
  getInstallationToken,
  githubRequest,
  json,
  requireAuth,
  requireGitHubConnection,
  syncProjectIssuesInternal,
  writeGitHubActivity,
} from './_shared/github';
import { db } from './_shared/github';

export default async (request: Request, context: Parameters<typeof requireAuth>[1]) => requireAuth(request, context, async (_request, _context, uid) => {
  const { repositoryId, projectId, installationId } = await request.json() as { repositoryId?: number; projectId?: string; installationId?: number };

  if (!repositoryId) {
    return json({ error: 'repositoryId required' }, 400);
  }

  const github = await requireGitHubConnection(uid);
  const resolvedInstallationId = installationId || github.installationId;
  const hasInstallation = github.installations.some((installation) => installation.installationId === resolvedInstallationId);

  if (!hasInstallation) {
    return json({ error: 'installationId is not connected for this user' }, 400);
  }

  const token = await getInstallationToken(resolvedInstallationId);
  const repository = await githubRequest<Record<string, any>>(`/repositories/${repositoryId}`, { token });
  const repoMetadata = buildRepoMetadata(resolvedInstallationId, repository);

  let projectRef;
  let created = false;

  if (projectId) {
    projectRef = db.collection('projects').doc(projectId);
    await projectRef.set({
      github: repoMetadata,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } else {
    projectRef = await db.collection('projects').add({
      title: repository.name,
      description: repository.description || `Imported from ${repository.full_name}`,
      progress: 0,
      memberIds: [uid],
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

  await syncProjectIssuesInternal(projectRef.id);

  return json({
    projectId: projectRef.id,
    created,
  });
});

export const config: Config = {
  path: '/api/github/import-repository',
  method: ['POST'],
};
