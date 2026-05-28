import type { Config } from '@netlify/functions';
import { FieldValue, json, requireAuth } from './_shared/github';
import { db } from './_shared/github';

export default async (request: Request, context: Parameters<typeof requireAuth>[1]) => requireAuth(request, context, async (_request, _context, uid) => {
  await db.collection('members').doc(uid).set({
    github: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return json({ ok: true });
});

export const config: Config = {
  path: '/api/github/disconnect',
  method: ['POST'],
};
