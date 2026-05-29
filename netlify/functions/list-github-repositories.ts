import type { Config } from '@netlify/functions';
import { getInstallationToken, githubRequest, json, requireAuth, requireGitHubConnection } from './_shared/github';
import { db } from './_shared/github';

export default async (request: Request, context: Parameters<typeof requireAuth>[1]) => requireAuth(request, context, async (_request, _context, uid) => {
  const github = await requireGitHubConnection(uid);
  const repositories = new Map<number, Record<string, any> & { installationId: number; installationAccountLogin: string }>();

  for (const installation of github.installations) {
    const token = await getInstallationToken(installation.installationId);
    const response = await githubRequest<{ repositories: Array<Record<string, any>> }>('/installation/repositories?per_page=100', {
      token,
    });

    response.repositories.forEach((repository) => {
      repositories.set(repository.id, {
        ...repository,
        installationId: installation.installationId,
        installationAccountLogin: installation.accountLogin,
      });
    });
  }

  const projectSnapshot = await db.collection('projects').get();
  const importedByRepoId = new Map(projectSnapshot.docs.map((project) => [project.data().github.repositoryId, project.id]));

  return json({
    repositories: Array.from(repositories.values())
      .sort((left, right) => left.full_name.localeCompare(right.full_name))
      .map((repository) => ({
      id: repository.id,
      installationId: repository.installationId,
      installationAccountLogin: repository.installationAccountLogin,
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
