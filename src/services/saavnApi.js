// JioSaavn CDN Audio & Metadata API Service
import CryptoJS from 'crypto-js';
import { searchMockCatalog } from './mockCatalog.js';
import { buildTrackSearchQuery } from './playbackUtils.js';

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
  if (typeof document !== 'undefined') {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }
  return String(html)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
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
  const moreInfo = item.more_info || (item.encrypted_media_url ? {
    encrypted_media_url: item.encrypted_media_url,
    album_id: item.album_id || item.albumid,
    primary_artists: item.primary_artists,
    release_date: item.release_date,
    genre: item.genre,
    mood: item.mood,
    energy: item.energy,
    tags: item.tags
  } : {});

  // High quality artwork: replace 150x150 with 500x500
  let thumbnail = (item.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
  if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
    thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  }

  // Extract artist name
  let artist = '';
  if (Array.isArray(moreInfo.artistMap?.primary_artists) && moreInfo.artistMap.primary_artists.length > 0) {
    artist = moreInfo.artistMap.primary_artists.map(a => a.name).join(', ');
  } else if (typeof moreInfo.primary_artists === 'string' && moreInfo.primary_artists.trim()) {
    artist = moreInfo.primary_artists;
  } else if (typeof item.primary_artists === 'string' && item.primary_artists.trim()) {
    artist = item.primary_artists;
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
  const audioUrl = decryptMediaUrl(moreInfo.encrypted_media_url || item.encrypted_media_url);

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
    genre: decodeHtml(moreInfo.genre || item.genre || moreInfo.primary_genre || ''),
    mood: decodeHtml(moreInfo.mood || item.mood || ''),
    energy: moreInfo.energy ?? item.energy ?? null,
    language: decodeHtml(item.language || moreInfo.language || ''),
    tags: Array.isArray(moreInfo.tags) ? moreInfo.tags.map(decodeHtml) : [],
    albumId: moreInfo.album_id || item.album_id || item.albumid || '',
    releaseDate: moreInfo.release_date || item.release_date || '',
    year: item.year || moreInfo.release_date || '',
    playCount: item.play_count || ''
  };
}

// Fetch helper with multi-tier proxy & fallback
async function fetchSaavnQuery(paramsString, { forceRefresh = false } = {}) {
  const cacheOptions = forceRefresh ? { cache: 'no-store' } : undefined;

  // 1. Try proxied endpoint (Vite dev proxy or Vercel production rewrite)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`${JIOSAAVN_PROXY_PATH}?${paramsString}`, cacheOptions);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // Continue to fallback
    }
  }

  // 2. Try direct fetch (if CORS allowed)
  try {
    const res = await fetch(`${JIOSAAVN_DIRECT_URL}?${paramsString}`, {
      headers: { 'Accept': 'application/json' },
      ...cacheOptions
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
    const res = await fetch(proxyUrl, cacheOptions);
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
  search: async (query, { forceRefresh = false, page = 1 } = {}) => {
    if (!query || !query.trim()) {
      return {
        results: [],
        source: 'curated',
        hasKey: true
      };
    }

    try {
      const requestedPage = Math.max(1, Math.floor(Number(page) || 1));
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query.trim())}&n=30&p=${requestedPage}`;
      const data = await fetchSaavnQuery(params, { forceRefresh });

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
  getTrending: async ({ forceRefresh = false, page = 1 } = {}) => {
    const requestedPage = Math.max(1, Math.floor(Number(page) || 1));
    try {
      // Keep the official chart for the initial feed; subsequent refreshes use
      // real paginated Saavn search results so the visible songs can change.
      if (requestedPage === 1) {
        const chartParams = `__call=playlist.getDetails&_format=json&listid=1134543272&api_version=4&ctx=web6dot0`;
        const chartData = await fetchSaavnQuery(chartParams, { forceRefresh });

        if (chartData && Array.isArray(chartData.list) && chartData.list.length > 0) {
          const tracks = chartData.list
            .map(formatSaavnTrack)
            .filter(t => Boolean(t && t.audioUrl));

          if (tracks.length > 0) {
            return tracks;
          }
        }
      }

      // Search another real catalog page on refresh rather than repeating the same chart.
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=trending%20top%20hits&n=25&p=${requestedPage}`;
      const data = await fetchSaavnQuery(params, { forceRefresh });

      if (data && data.results && data.results.length > 0) {
        const tracks = data.results
          .map(formatSaavnTrack)
          .filter(t => Boolean(t && t.audioUrl));

        if (tracks.length > 0) {
          return tracks;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch trending from Saavn:', err);
    }

    return [];
  },

  // Resolve direct 320kbps CDN audio stream for any track (e.g. from mock catalog or playlist)
  resolveAudioUrl: async (track) => {
    if (!track) return null;
    if (track.audioUrl) return track.audioUrl;

    try {
      if (track.source === 'spotify_import' && track.matchStatus === 'matched' && (track.catalogTrackId || (track.id && !track.id.startsWith('sp_')))) {
        const catalogTrack = await saavnApi.getSongDetails(track.catalogTrackId || track.id);
        if (catalogTrack?.audioUrl) {
          track.audioUrl = catalogTrack.audioUrl;
          return catalogTrack.audioUrl;
        }
      }

      const searchQuery = buildTrackSearchQuery(track);
      if (searchQuery) {
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
      }

      // Fallback to audioPreviewUrl if available
      if (track.audioPreviewUrl) {
        track.audioUrl = track.audioPreviewUrl;
        return track.audioPreviewUrl;
      }
    } catch (err) {
      console.warn('Failed to resolve Saavn audio stream for track:', track.title, err);
      if (track.audioPreviewUrl) {
        track.audioUrl = track.audioPreviewUrl;
        return track.audioPreviewUrl;
      }
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

  getAlbumTracks: async (trackIds = []) => {
    const ids = [...new Set((Array.isArray(trackIds) ? trackIds : [])
      .map(id => String(id || '').trim())
      .filter(Boolean))];
    if (ids.length === 0) return [];

    const chunks = [];
    for (let index = 0; index < ids.length; index += 15) chunks.push(ids.slice(index, index + 15));
    const responses = await Promise.all(chunks.map(async chunk => {
      try {
        const params = `__call=song.getDetails&_format=json&pids=${encodeURIComponent(chunk.join(','))}`;
        return await fetchSaavnQuery(params);
      } catch (err) {
        console.warn('Failed to fetch Saavn album tracks:', err);
        return null;
      }
    }));

    const tracksById = new Map();
    responses.forEach(response => {
      if (!response || typeof response !== 'object') return;
      Object.entries(response).forEach(([id, item]) => {
        const track = formatSaavnTrack(item);
        if (track?.id && track.title && track.audioUrl) tracksById.set(String(id), track);
      });
    });
    return ids.map(id => tracksById.get(id)).filter(Boolean);
  },

  // Autocomplete / Live suggestions with typo & fuzzy matching
  getAutocomplete: async (query, { forceRefresh = false } = {}) => {
    if (!query || !query.trim()) return null;
    const cleanKey = query.trim().toLowerCase();

    // Check cache
    const cached = suggestionsCache.get(cleanKey);
    if (!forceRefresh && cached && Date.now() - cached.ts < SUGGESTIONS_CACHE_TTL) {
      return cached.data;
    }
    if (forceRefresh) suggestionsCache.delete(cleanKey);

    try {
      const params = `__call=autocomplete.get&_format=json&_marker=0&ctx=web6dot0&query=${encodeURIComponent(cleanKey)}`;
      const data = await fetchSaavnQuery(params, { forceRefresh });

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
          url: item.url || '',
          type: 'artist'
        })),
        albums: (data.albums?.data || []).map(item => ({
          id: item.id,
          title: decodeHtml(item.title || ''),
          artist: decodeHtml(item.music || item.description || ''),
          year: item.more_info?.year || '',
          image: (item.image || '').replace('50x50', '150x150'),
          trackIds: String(item.more_info?.song_pids || '').split(',').map(id => id.trim()).filter(Boolean),
          type: 'album'
        })),
        playlists: (data.playlists?.data || []).map(item => ({
          id: item.id,
          title: decodeHtml(item.title || ''),
          description: decodeHtml(item.description || item.subtitle || ''),
          image: (item.image || '').replace('50x50', '500x500'),
          url: item.url || '',
          type: 'playlist'
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
  },

  getPlaylistDetails: async (playlistId) => {
    if (!playlistId) return null;
    try {
      const params = `__call=playlist.getDetails&_format=json&listid=${encodeURIComponent(playlistId)}&api_version=4&ctx=web6dot0`;
      const data = await fetchSaavnQuery(params);
      if (!data || !Array.isArray(data.list)) return null;

      return {
        id: data.id || playlistId,
        title: decodeHtml(data.title || data.name || 'Playlist'),
        description: decodeHtml(data.header_desc || data.subtitle || ''),
        image: (data.image || '').replace('150x150', '500x500'),
        tracks: data.list.map(formatSaavnTrack).filter(track => track?.id && track.title && track.audioUrl),
        source: 'saavn_cdn'
      };
    } catch (err) {
      console.warn('Failed to fetch Saavn playlist details:', playlistId, err);
      return null;
    }
  }
};

// Also export as youtubeApi for seamless backward compatibility
export const youtubeApi = saavnApi;
