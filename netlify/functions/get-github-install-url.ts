import type { Config } from '@netlify/functions';
import { getGitHubAppSlug, json, requireAuth } from './_shared/github';

export default async (request: Request, context: Parameters<typeof requireAuth>[1]) => requireAuth(request, context, async () => {
  return json({ url: `https://github.com/apps/${getGitHubAppSlug()}/installations/new` });
});

export const config: Config = {
  path: '/api/github/install-url',
  method: ['GET'],
};
