/**
 * Cache helper pour gérer l'invalidation du cache après import/export
 */

const CACHE_VERSION_KEY = 'koma_data_version';

/**
 * Met à jour la version du cache (appelé après import/export)
 */
export function updateCacheVersion(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CACHE_VERSION_KEY, Date.now().toString());
  }
}

/**
 * Récupère la version actuelle du cache
 */
export function getCacheVersion(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(CACHE_VERSION_KEY) || '0';
  }
  return '0';
}

/**
 * Construit une URL avec le cache busting
 * IMPORTANT: Ajoute automatiquement le trailing slash requis par Next.js
 */
export function buildApiUrl(baseUrl: string, forceReload = false): string {
  const version = getCacheVersion();

  // S'assurer que l'URL a un trailing slash (requis par next.config.js)
  let url = baseUrl;
  if (!url.endsWith('/') && !url.includes('?')) {
    url = url + '/';
  }

  const separator = url.includes('?') ? '&' : '?';

  if (forceReload) {
    return `${url}${separator}reload=true&_v=${version}`;
  }

  return `${url}${separator}_v=${version}`;
}

/**
 * Fetch avec cache busting automatique
 */
export async function fetchWithCacheBusting(url: string, options?: RequestInit): Promise<Response> {
  const urlWithVersion = buildApiUrl(url);
  return fetch(urlWithVersion, options);
}
