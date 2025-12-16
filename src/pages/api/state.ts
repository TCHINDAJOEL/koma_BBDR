import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { ApplicationState } from '@/types/schema';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApplicationState | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Paramètre pour forcer le rechargement (bypass cache)
    const forceReload = req.query.reload === 'true';
    if (forceReload) {
      storage.invalidateCache('all');
    }

    const state = await storage.loadState();

    // Ajouter des headers pour empêcher le cache navigateur
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json(state);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur lors du chargement de l\'état' });
  }
}
