// JioSaavn CDN Audio & Metadata API Service
import CryptoJS from 'crypto-js';
import { MOCK_TRACKS, searchMockCatalog } from './mockCatalog';

const DES_KEY = '38346591';
const JIOSAAVN_PROXY_PATH = '/api/saavn';
const JIOSAAVN_DIRECT_URL = 'https://www.jiosaavn.com/api.php';

// In-memory cache for fast auto-complete suggestions
const suggestionsCache = new Map();
const SUGGESTIONS_CACHE_MAX = 60;
const SUGGESTIONS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Decodes HTML entities returned by API (e.g. &amp;, &#39;, &quot;)
export function decodeHtml(html) {
  if (!html) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

// Parses duration to seconds
export function formatTime(seconds) {
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

// Decrypts JioSaavn encrypted media stream URL into high-quality direct CDN URL (320kbps)
export function decryptMediaUrl(encryptedUrl) {
  if (!encryptedUrl) return null;
  try {
    const decrypted = CryptoJS.DES.decrypt(
      {
        ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl)
      },
      CryptoJS.enc.Utf8.parse(DES_KEY),
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    const rawUrl = decrypted.toString(CryptoJS.enc.Utf8);
    if (!rawUrl || !rawUrl.startsWith('http')) return null;

    // Upgrade to 320kbps high definition audio if available
    return rawUrl.replace('_96.mp4', '_320.mp4').replace('_160.mp4', '_320.mp4');
  } catch (err) {
    console.warn('Failed to decrypt JioSaavn CDN URL:', err);
    return null;
  }
}

// Formats a raw JioSaavn song object into NOIR's standard track structure
export function formatSaavnTrack(item) {
  if (!item) return null;
  const moreInfo = item.more_info || {};

  // High quality artwork: replace 150x150 with 500x500
  let thumbnail = (item.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
  if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
    thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  }

  // Extract artist name
  let artist = '';
  if (moreInfo.artistMap?.primary_artists?.length > 0) {
    artist = moreInfo.artistMap.primary_artists.map(a => a.name).join(', ');
  } else if (item.singers) {
    artist = item.singers;
  } else if (item.subtitle) {
    artist = item.subtitle.split('-')[0].trim();
  } else {
    artist = 'Unknown Artist';
  }

  // Album name
  const album = moreInfo.album || item.album || (item.subtitle && item.subtitle.includes('-') ? item.subtitle.split('-')[1].trim() : 'Single');

  // Duration
  const durationSec = parseInt(moreInfo.duration || item.duration || 210, 10);
  const minutes = Math.floor(durationSec / 60);
  const remainingSec = durationSec % 60;
  const durationFormatted = `${minutes}:${remainingSec < 10 ? '0' : ''}${remainingSec}`;

  // Decrypt 320kbps CDN audio stream URL
  const audioUrl = decryptMediaUrl(moreInfo.encrypted_media_url);

  // Clean title
  const title = decodeHtml(item.song || item.title || 'Unknown Title');

  return {
    id: item.id || `saavn-${Math.random().toString(36).substring(2, 9)}`,
    title,
    artist: decodeHtml(artist),
    album: decodeHtml(album),
    thumbnail,
    duration: durationSec,
    durationFormatted,
    audioUrl, // Direct 320kbps CDN stream from aac.saavncdn.com
    source: 'saavn_cdn',
    year: item.year || moreInfo.release_date || '',
    playCount: item.play_count || ''
  };
}

// Fetch helper with multi-tier proxy & fallback
async function fetchSaavnQuery(paramsString) {
  // 1. Try proxied endpoint (Vite dev proxy or Vercel production rewrite)
  try {
    const res = await fetch(`${JIOSAAVN_PROXY_PATH}?${paramsString}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Continue to fallback
  }

  // 2. Try direct fetch (if CORS allowed)
  try {
    const res = await fetch(`${JIOSAAVN_DIRECT_URL}?${paramsString}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Continue to fallback
  }

  // 3. Try AllOrigins CORS proxy fallback
  try {
    const targetUrl = `${JIOSAAVN_DIRECT_URL}?${paramsString}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('AllOrigins fallback failed:', err);
  }

  return null;
}

export const saavnApi = {
  // Search tracks using JioSaavn CDN
  search: async (query) => {
    if (!query || !query.trim()) {
      return {
        results: MOCK_TRACKS,
        source: 'curated',
        hasKey: true
      };
    }

    try {
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query.trim())}&n=30&p=1`;
      const data = await fetchSaavnQuery(params);

      if (data && data.results && data.results.length > 0) {
        const tracks = data.results
          .map(formatSaavnTrack)
          .filter(t => Boolean(t && t.audioUrl));

        if (tracks.length > 0) {
          return {
            results: tracks,
            source: 'saavn_cdn',
            hasKey: true
          };
        }
      }
    } catch (err) {
      console.warn('JioSaavn search query failed, using mock catalog fallback:', err);
    }

    // Fallback to internal catalog if network issues occur
    const filtered = searchMockCatalog(query);
    return {
      results: filtered,
      source: 'curated',
      hasKey: true
    };
  },

  // Get Top Trending Songs directly from Saavn CDN
  getTrending: async () => {
    try {
      // Query top trending hits from Saavn
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=trending%20top%20hits&n=20`;
      const data = await fetchSaavnQuery(params);

      if (data && data.results && data.results.length > 0) {
        const tracks = data.results
          .map(formatSaavnTrack)
          .filter(t => Boolean(t && t.audioUrl));

        if (tracks.length > 0) {
          return tracks;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch trending from Saavn, using curated catalog:', err);
    }

    return MOCK_TRACKS;
  },

  // Resolve direct 320kbps CDN audio stream for any track (e.g. from mock catalog or playlist)
  resolveAudioUrl: async (track) => {
    if (!track) return null;
    if (track.audioUrl) return track.audioUrl;

    try {
      const searchQuery = `${track.title} ${track.artist}`.trim();
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(searchQuery)}&n=5`;
      const data = await fetchSaavnQuery(params);

      if (data && data.results && data.results.length > 0) {
        const matched = data.results.find(s => s.more_info?.encrypted_media_url) || data.results[0];
        const audioUrl = decryptMediaUrl(matched.more_info?.encrypted_media_url);
        if (audioUrl) {
          track.audioUrl = audioUrl;
          return audioUrl;
        }
      }
    } catch (err) {
      console.warn('Failed to resolve Saavn audio stream for track:', track.title, err);
    }

    return null;
  },

  // Get full song details by song ID (pid) with decrypted 320kbps audioUrl
  getSongDetails: async (songId) => {
    if (!songId) return null;
    try {
      const params = `__call=song.getDetails&_format=json&pids=${encodeURIComponent(songId)}`;
      const data = await fetchSaavnQuery(params);
      if (data && data[songId]) {
        return formatSaavnTrack(data[songId]);
      }
    } catch (err) {
      console.warn('Failed to fetch song details for:', songId, err);
    }
    return null;
  },

  // Autocomplete / Live suggestions with typo & fuzzy matching
  getAutocomplete: async (query) => {
    if (!query || !query.trim()) return null;
    const cleanKey = query.trim().toLowerCase();

    // Check cache
    const cached = suggestionsCache.get(cleanKey);
    if (cached && Date.now() - cached.ts < SUGGESTIONS_CACHE_TTL) {
      return cached.data;
    }

    try {
      const params = `__call=autocomplete.get&_format=json&_marker=0&ctx=web6dot0&query=${encodeURIComponent(cleanKey)}`;
      const data = await fetchSaavnQuery(params);

      if (!data) return null;

      const formatted = {
        topquery: (data.topquery?.data || []).map(item => ({
          id: item.id,
          title: decodeHtml(item.title || ''),
          subtitle: decodeHtml(item.description || item.subtitle || item.extra || ''),
          image: (item.image || '').replace('50x50', '150x150'),
          type: item.type || 'song',
          url: item.url || ''
        })),
        songs: (data.songs?.data || []).map(item => ({
          id: item.id,
          title: decodeHtml(item.title || ''),
          artist: decodeHtml(item.more_info?.primary_artists || item.description || item.subtitle || 'Artist'),
          album: decodeHtml(item.album || ''),
          image: (item.image || '').replace('50x50', '150x150'),
          type: 'song'
        })),
        artists: (data.artists?.data || []).map(item => ({
          id: item.id,
          name: decodeHtml(item.title || item.name || ''),
          role: decodeHtml(item.description || item.extra || 'Artist'),
          image: (item.image || '').replace('50x50', '150x150'),
          type: 'artist'
        })),
        albums: (data.albums?.data || []).map(item => ({
          id: item.id,
          title: decodeHtml(item.title || ''),
          artist: decodeHtml(item.music || item.description || ''),
          year: item.more_info?.year || '',
          image: (item.image || '').replace('50x50', '150x150'),
          type: 'album'
        }))
      };

      // Manage cache size
      if (suggestionsCache.size >= SUGGESTIONS_CACHE_MAX) {
        const oldestKey = suggestionsCache.keys().next().value;
        suggestionsCache.delete(oldestKey);
      }
      suggestionsCache.set(cleanKey, { data: formatted, ts: Date.now() });

      return formatted;
    } catch (err) {
      console.warn('Failed to fetch autocomplete suggestions:', err);
      return null;
    }
  }
};

// Also export as youtubeApi for seamless backward compatibility
export const youtubeApi = saavnApi;
