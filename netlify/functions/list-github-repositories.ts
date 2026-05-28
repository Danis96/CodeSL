import type { Config } from '@netlify/functions';
import { getInstallationToken, githubRequest, json, requireAuth, requireGitHubConnection } from './_shared/github';
import { db } from './_shared/github';

export default async (request: Request, context: Parameters<typeof requireAuth>[1]) => requireAuth(request, context, async (_request, _context, uid) => {
  const github = await requireGitHubConnection(uid);
  const token = await getInstallationToken(github.installationId);
  const response = await githubRequest<{ repositories: Array<Record<string, any>> }>('/installation/repositories?per_page=100', {
    token,
  });
  const projectSnapshot = await db.collection('projects').where('github.installationId', '==', github.installationId).get();
  const importedByRepoId = new Map(projectSnapshot.docs.map((project) => [project.data().github.repositoryId, project.id]));

  return json({
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
  });
});

export const config: Config = {
  path: '/api/github/repositories',
  method: ['GET'],
};
