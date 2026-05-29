import type { Config } from '@netlify/functions';
import { FieldValue, githubRequest, json, requireAuth } from './_shared/github';
import { db } from './_shared/github';

export default async (request: Request, context: Parameters<typeof requireAuth>[1]) => requireAuth(request, context, async (_request, _context, uid) => {
  const { installationId } = await request.json() as { installationId?: number };

  if (!installationId) {
    return json({ error: 'installationId required' }, 400);
  }

  const installation = await githubRequest<Record<string, any>>(`/app/installations/${installationId}`);
  const memberRef = db.collection('members').doc(uid);
  const memberSnapshot = await memberRef.get();
  const existingGitHub = memberSnapshot.data()?.github as Record<string, unknown> | undefined;
  const existingInstallations = Array.isArray(existingGitHub?.installations)
    ? existingGitHub.installations.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    : [];
  const installedAt = new Date().toISOString();
  const nextInstallation = {
    installationId,
    accountLogin: installation.account?.login || '',
    accountType: installation.account?.type || '',
    status: 'connected',
    installedAt,
  };
  const dedupedInstallations = existingInstallations
    .filter((item) => item.installationId !== installationId);
  dedupedInstallations.push(nextInstallation);

  await memberRef.set({
    github: {
      ...existingGitHub,
      installationId: nextInstallation.installationId,
      accountLogin: nextInstallation.accountLogin,
      accountType: nextInstallation.accountType,
      status: 'connected',
      installedAt,
      installations: dedupedInstallations,
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return json({ ok: true });
});

export const config: Config = {
  path: '/api/github/complete-installation',
  method: ['POST'],
};
