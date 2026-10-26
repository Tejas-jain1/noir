/**
 * Audius Music API Service for NOIR
 *
 * Provides official, authorized music search, trending tracks, and 320kbps MP3 stream resolution
 * without API extraction or web scraping.
 * Fully compatible with HTML5 Audio Element and background mobile playback.
 */

// Format duration seconds to mm:ss
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const AUDIUS_BASE_URL = 'https://api.audius.co/v1';
const FALLBACK_DISCOVERY_NODES = [
  'https://api.audius.co',
  'https://discoveryprovider.audius.co',
  'https://audius-discovery-1.altego.net'
];

const DEFAULT_THUMBNAIL = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';

// In-memory response cache
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

export function getAudiusAppName() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUDIUS_APP_NAME) {
      return import.meta.env.VITE_AUDIUS_APP_NAME;
    }
  } catch {
    // Fallback if import.meta is not available
  }
  return 'NOIR_MUSIC_PLAYER';
}

/**
 * Normalizes an Audius raw track object into NOIR's canonical track schema
 */
export function normalizeAudiusTrack(track) {
  if (!track || !track.id) return null;

  // Best artwork resolution
  const artwork = track.artwork?.['480x480'] || 
                  track.artwork?.['150x150'] || 
                  track.artwork?.['1000x1000'] || 
                  DEFAULT_THUMBNAIL;

  const durationSec = Math.round(Number(track.duration) || 180);
  const appName = getAudiusAppName();

  return {
    id: `audius-${track.id}`,
    rawId: track.id,
    title: track.title || 'Untitled Track',
    artist: track.user?.name || track.user?.handle || 'Audius Artist',
    artistHandle: track.user?.handle || '',
    album: track.genre || 'Audius Original',
    genre: track.genre || 'Electronic',
    thumbnail: artwork,
    duration: durationSec,
    durationFormatted: formatTime(durationSec),
    streamUrl: `${AUDIUS_BASE_URL}/tracks/${track.id}/stream?app_name=${encodeURIComponent(appName)}`,
    source: 'audius',
    isStreamable: track.is_streamable !== false,
    playCount: track.play_count || 0,
    favoriteCount: track.favorite_count || 0
  };
}

export const audiusService = {
  /**
   * Search tracks on Audius
   */
  async search(query, limit = 20) {
    const trimmed = query?.trim();
    if (!trimmed) return [];

    const cacheKey = `search:${trimmed.toLowerCase()}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const appName = getAudiusAppName();
    const url = `${AUDIUS_BASE_URL}/tracks/search?query=${encodeURIComponent(trimmed)}&app_name=${encodeURIComponent(appName)}&limit=${limit}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Audius API returned HTTP ${res.status}`);
      const json = await res.json();
      const tracks = (json.data || [])
        .filter(t => t && t.is_streamable !== false)
        .map(normalizeAudiusTrack)
        .filter(Boolean);

      setCache(cacheKey, tracks);
      return tracks;
    } catch (err) {
      console.warn('[AudiusService] Search error:', err?.message || err);
      return [];
    }
  },

  /**
   * Fetch Trending Tracks on Audius
   */
  async getTrending(genre = null, limit = 20) {
    const cacheKey = `trending:${genre || 'all'}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const appName = getAudiusAppName();
    const params = new URLSearchParams({
      app_name: appName,
      limit: String(limit)
    });
    if (genre && genre !== 'all') {
      params.set('genre', genre);
    }

    const url = `${AUDIUS_BASE_URL}/tracks/trending?${params.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Audius API returned HTTP ${res.status}`);
      const json = await res.json();
      const tracks = (json.data || [])
        .filter(t => t && t.is_streamable !== false)
        .map(normalizeAudiusTrack)
        .filter(Boolean);

      setCache(cacheKey, tracks);
      return tracks;
    } catch (err) {
      console.warn('[AudiusService] Trending fetch error:', err?.message || err);
      return [];
    }
  },

  /**
   * Get direct stream URL for a track ID
   */
  getStreamUrl(trackId) {
    const cleanId = String(trackId).replace(/^audius-/, '');
    const appName = getAudiusAppName();
    return `${AUDIUS_BASE_URL}/tracks/${cleanId}/stream?app_name=${encodeURIComponent(appName)}`;
  }
};
