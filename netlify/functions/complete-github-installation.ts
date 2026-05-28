import type { Config } from '@netlify/functions';
import { FieldValue, githubRequest, json, requireAuth } from './_shared/github';
import { db } from './_shared/github';

export default async (request: Request, context: Parameters<typeof requireAuth>[1]) => requireAuth(request, context, async (_request, _context, uid) => {
  const { installationId } = await request.json() as { installationId?: number };

  if (!installationId) {
    return json({ error: 'installationId required' }, 400);
  }

  const installation = await githubRequest<Record<string, any>>(`/app/installations/${installationId}`);

  await db.collection('members').doc(uid).set({
    github: {
      installationId,
      accountLogin: installation.account?.login || '',
      accountType: installation.account?.type || '',
      status: 'connected',
      installedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return json({ ok: true });
});

export const config: Config = {
  path: '/api/github/complete-installation',
  method: ['POST'],
};
