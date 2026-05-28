import type { Config } from '@netlify/functions';
import { json, requireAuth, syncProjectIssuesInternal } from './_shared/github';

export default async (request: Request, context: Parameters<typeof requireAuth>[1]) => requireAuth(request, context, async () => {
  const { projectId } = await request.json() as { projectId?: string };

  if (!projectId) {
    return json({ error: 'projectId required' }, 400);
  }

  const imported = await syncProjectIssuesInternal(projectId);
  return json({ imported });
});

export const config: Config = {
  path: '/api/github/sync-project',
  method: ['POST'],
};
