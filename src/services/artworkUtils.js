// Reusable NOIR artwork utilities and deterministic fallbacks
// Ensures no generic photos of unrelated artists/microphones are ever shown.

export const NOIR_TRACK_ARTWORK_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100%25' height='100%25' fill='%2318181b'/%3E%3Ccircle cx='50' cy='50' r='38' stroke='%2327272a' stroke-width='4' fill='none'/%3E%3Ccircle cx='50' cy='50' r='14' fill='%2327272a'/%3E%3Cpath d='M47 38v16l12-8z' fill='%2371717a'/%3E%3C/svg%3E";

export const NOIR_ARTIST_AVATAR_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100%25' height='100%25' fill='%2318181b'/%3E%3Ccircle cx='50' cy='38' r='20' fill='%2327272a'/%3E%3Cpath d='M20 86c0-16.5 13.5-30 30-30s30 13.5 30 30' fill='%2327272a'/%3E%3C/svg%3E";

/**
 * Normalizes an artwork URL to highest available CDN resolution (500x500)
 * and guarantees HTTPS protocol. Returns null if missing or placeholder.
 */
export function getHighResArtworkUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.includes('default') || trimmed.includes('artist_150x150.png')) {
    return null;
  }
  return trimmed
    .replace(/^http:\/\//i, 'https://')
    .replace('150x150', '500x500')
    .replace('50x50', '500x500');
}

/**
 * Handle image loading error cleanly on an <img> element without triggering loops
 * or showing broken image icons.
 */
export function handleArtworkError(event, fallback = NOIR_TRACK_ARTWORK_FALLBACK) {
  if (!event || !event.currentTarget) return;
  event.currentTarget.onerror = null;
  event.currentTarget.src = fallback;
}

/**
 * Deterministic stable track ID generator when API doesn't provide an ID
 */
export function getDeterministicTrackId(item) {
  if (item?.id && String(item.id).trim() && !String(item.id).startsWith('saavn-0.')) {
    return String(item.id).trim();
  }
  const permaUrl = item?.perma_url || '';
  const title = item?.song || item?.title || '';
  const artist = item?.primary_artists || item?.singers || (typeof item?.more_info?.primary_artists === 'string' ? item.more_info.primary_artists : '') || '';
  const album = item?.album || item?.more_info?.album || '';
  const rawKey = `${permaUrl}__${title}__${artist}__${album}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = ((hash << 5) - hash) + rawKey.charCodeAt(i);
    hash |= 0;
  }
  return `saavn-track-${Math.abs(hash).toString(36)}`;
}
