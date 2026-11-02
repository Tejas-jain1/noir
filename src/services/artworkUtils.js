// Reusable NOIR artwork utilities, deterministic fallbacks, and identity-aware caching.
// Ensures authentic official provider artwork is preserved and no generic posters are reused.

export const NOIR_TRACK_ARTWORK_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100%25' height='100%25' fill='%2318181b'/%3E%3Ccircle cx='50' cy='50' r='38' stroke='%2327272a' stroke-width='4' fill='none'/%3E%3Ccircle cx='50' cy='50' r='14' fill='%2327272a'/%3E%3Cpath d='M47 38v16l12-8z' fill='%2371717a'/%3E%3C/svg%3E";

export const NOIR_ARTIST_AVATAR_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100%25' height='100%25' fill='%2318181b'/%3E%3Ccircle cx='50' cy='38' r='20' fill='%2327272a'/%3E%3Cpath d='M20 86c0-16.5 13.5-30 30-30s30 13.5 30 30' fill='%2327272a'/%3E%3C/svg%3E";

/**
 * Generates a deterministic, sleek monochrome vector SVG with the track's initial letter
 * and vinyl soundwave ring. Distinct for every song rather than reusing one generic poster.
 */
export function getTrackFallbackArtwork(title = '', artist = '') {
  const cleanTitle = String(title || '').trim();
  const cleanArtist = String(artist || '').trim();
  const initial = (cleanTitle.charAt(0) || cleanArtist.charAt(0) || '♪').toUpperCase();
  const safeChar = initial.replace(/[^A-Z0-9]/i, '♪');
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='100%25' height='100%25' fill='%23141416'/%3E%3Ccircle cx='100' cy='100' r='75' stroke='%2327272a' stroke-width='4' fill='none' stroke-dasharray='4 4'/%3E%3Ccircle cx='100' cy='100' r='30' fill='%23222226'/%3E%3Ctext x='100' y='111' font-family='system-ui, -apple-system, sans-serif' font-size='32' font-weight='700' fill='%23a1a1aa' text-anchor='middle'%3E${encodeURIComponent(safeChar)}%3C/text%3E%3C/svg%3E`;
}

/**
 * Generates a deterministic, sleek monochrome vector SVG for artists with their initial.
 */
export function getArtistFallbackAvatar(name = '') {
  const cleanName = String(name || '').trim();
  const initial = (cleanName.charAt(0) || 'A').toUpperCase();
  const safeChar = initial.replace(/[^A-Z0-9]/i, 'A');
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='100%25' height='100%25' fill='%2318181b'/%3E%3Ccircle cx='100' cy='80' r='42' fill='%2327272a'/%3E%3Cpath d='M40 180c0-33 27-60 60-60s60 27 60 60' fill='%2327272a'/%3E%3Ctext x='100' y='92' font-family='system-ui, -apple-system, sans-serif' font-size='36' font-weight='700' fill='%23e4e4e7' text-anchor='middle'%3E${encodeURIComponent(safeChar)}%3C/text%3E%3C/svg%3E`;
}

/**
 * Normalizes an artwork URL to highest available CDN resolution (500x500)
 * and guarantees HTTPS protocol. Returns null if missing or placeholder.
 */
export function getHighResArtworkUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.replace(/&amp;/g, '&').trim();
  if (
    !trimmed || 
    trimmed.includes('default') || 
    trimmed.includes('artist_150x150.png') ||
    trimmed.includes('artist-default') ||
    trimmed.includes('album-default')
  ) {
    return null;
  }
  return trimmed
    .replace(/^http:\/\//i, 'https://')
    .replace('150x150', '500x500')
    .replace('50x50', '500x500');
}

/**
 * Inspects all possible image fields in a JioSaavn response item
 * and extracts the authentic high-resolution artwork URL.
 */
export function extractOfficialArtwork(item) {
  if (!item) return '';
  const moreInfo = item.more_info || {};
  const candidates = [
    item.image,
    moreInfo.image,
    item.album_image,
    moreInfo.album_image,
    moreInfo.album_url
  ];

  for (const candidate of candidates) {
    const highRes = getHighResArtworkUrl(candidate);
    if (highRes) return highRes;
  }
  return '';
}

/**
 * Creates a unique cache key based on track/album identity and image URL.
 */
export function getArtworkCacheKey(item) {
  if (!item) return 'artwork:unknown';
  const id = String(item.id || item.saavnId || '').trim();
  const albumId = String(item.albumId || item.album_id || item.albumid || item.album || '').trim();
  const rawUrl = String(item.thumbnail || item.image || '').trim();
  return `art_${id}__${albumId}__${rawUrl}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

// In-memory artwork cache + broken image registry with TTL
const artworkMemoryCache = new Map();
const brokenImagesSet = new Set();
const ARTWORK_CACHE_MAX = 500;
const ARTWORK_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const ArtworkCache = {
  get(key) {
    if (!key) return null;
    const entry = artworkMemoryCache.get(key);
    if (entry && Date.now() - entry.ts < ARTWORK_CACHE_TTL) {
      return entry.val !== undefined ? entry.val : entry.url;
    }
    return null;
  },

  set(key, val) {
    if (!key || !val) return;
    if (artworkMemoryCache.size >= ARTWORK_CACHE_MAX) {
      const oldestKey = artworkMemoryCache.keys().next().value;
      artworkMemoryCache.delete(oldestKey);
    }
    const url = typeof val === 'string' ? val : (val.url || val.thumbnail || '');
    artworkMemoryCache.set(key, { val, url, ts: Date.now() });
  },

  markBroken(url) {
    if (url && typeof url === 'string') {
      brokenImagesSet.add(url.trim());
    }
  },

  isBroken(url) {
    if (!url || typeof url !== 'string') return true;
    return brokenImagesSet.has(url.trim());
  }
};

/**
 * Extracts the canonical film or soundtrack name if the song title contains
 * markers like '(From "Film")', '[From "Film"]', '(feat. X From "Film")', etc.
 */
export function extractOriginalFilmOrAlbum(title = '') {
  if (!title || typeof title !== 'string') return null;
  // Match '(From "Film")', '[From "Film"]', '(From Film)', '(feat. X From "Film")', etc.
  const match = title.match(/[([\[](?:(?:feat\.?|ft\.?)[^)"'\u201c\u201d\u2018\u2019\]]*\s+)?from\s+["'\u201c\u2018]?([^)"'\u201d\u2019\]]+)["'\u201d\u2019]?[)\]]/i);
  if (match && match[1]) {
    const film = match[1].trim();
    if (film && film.length > 1) return film;
  }
  return null;
}

/**
 * Determines whether an album is a marketing compilation, festive repackage,
 * or collection rather than the artist or film's original studio release.
 */
export function isCompilationAlbum(album = '', title = '') {
  const albumStr = String(album || '').trim();
  if (!albumStr) return false;

  const originalFilm = extractOriginalFilmOrAlbum(title);
  if (originalFilm) {
    const normAlbum = albumStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normFilm = originalFilm.toLowerCase().replace(/[^a-z0-9]/g, '');
    // If the album is distinct from the film name explicitly mentioned in the title,
    // the track was repackaged onto a compilation/collection.
    if (normAlbum && normFilm && !normAlbum.includes(normFilm) && !normFilm.includes(normAlbum)) {
      return true;
    }
  }

  const compilationPattern = /\b(?:best\s+of|hits\s+of|top\s+(?:bollywood\s+)?hits|romantic\s+(?:classics\s+)?hits|collection\s+of|collection|classics?\s+hits|bollywood\s+hits|world\s+music\s+day|valentines?|anniversary|celebration|mashup|remix\s+collection|winter\s+diaries|heartbeats|trending\s+love|thodi\s+dhoop|super\s+hits|greatest\s+hits|love\s+hits|romantic\s+collection)\b/i;
  return compilationPattern.test(albumStr);
}

/**
 * Strips compilation subtitles and film markers to retrieve the pure canonical song title.
 */
export function cleanCanonicalTrackTitle(title = '') {
  if (!title || typeof title !== 'string') return '';
  return title
    .replace(/[([\[](?:(?:feat\.?|ft\.?)[^)"'\u201c\u201d\u2018\u2019\]]*\s+)?from\s+["'\u201c\u2018]?[^)"'\u201d\u2019\]]+["'\u201d\u2019]?[)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Handle image loading error cleanly on an <img> element without triggering loops
 * or showing broken image icons. Uses deterministic dynamic SVG fallback.
 */
export function handleArtworkError(event, fallback = null) {
  if (!event || !event.currentTarget) return;
  const img = event.currentTarget;
  img.onerror = null; // Prevent loop
  if (img.src) ArtworkCache.markBroken(img.src);
  const alt = img.getAttribute('alt') || '';
  img.src = fallback || getTrackFallbackArtwork(alt);
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
