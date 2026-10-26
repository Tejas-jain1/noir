// JioSaavn CDN Audio & Comprehensive Music Discovery API Service
import CryptoJS from 'crypto-js';
import { MOCK_TRACKS, searchMockCatalog } from './mockCatalog.js';
import { parseSearchQuery } from './queryUnderstanding.js';

const DES_KEY = '38346591';
const JIOSAAVN_PROXY_PATH = '/api/saavn';
const JIOSAAVN_DIRECT_URL = 'https://www.jiosaavn.com/api.php';

// In-memory LRU cache for search results and suggestions
const searchCache = new Map();
const suggestionCache = new Map();
const MAX_CACHE_SIZE = 120;

// Decodes HTML entities returned by API (e.g. &amp;, &#39;, &quot;)
export function decodeHtml(html) {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    try {
      const txt = document.createElement('textarea');
      txt.innerHTML = html;
      return txt.value;
    } catch {
      // Fallback
    }
  }
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&copy;/g, '©');
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

  // High quality artwork: replace 150x150 or 50x50 with 500x500
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
  } else if (moreInfo.singers) {
    artist = moreInfo.singers;
  } else if (moreInfo.primary_artists) {
    artist = moreInfo.primary_artists;
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
  const encryptedUrl = moreInfo.encrypted_media_url || item.encrypted_media_url;
  const audioUrl = decryptMediaUrl(encryptedUrl);

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
    year: item.year || moreInfo.release_date || moreInfo.year || '',
    playCount: item.play_count || ''
  };
}

// Formats an Artist result from JioSaavn
export function formatSaavnArtist(item) {
  if (!item) return null;
  let thumbnail = (item.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
  if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
    thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  }

  return {
    id: item.id,
    name: decodeHtml(item.name || item.title || 'Unknown Artist'),
    role: decodeHtml(item.role || item.description || 'Artist'),
    thumbnail,
    permaUrl: item.perma_url || '',
    type: 'artist'
  };
}

// Formats an Album result from JioSaavn
export function formatSaavnAlbum(item) {
  if (!item) return null;
  const moreInfo = item.more_info || {};

  let thumbnail = (item.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
  if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
    thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  }

  const artist = item.subtitle || moreInfo.music || moreInfo.artistMap?.primary_artists?.[0]?.name || 'Featured Artist';

  return {
    id: item.id,
    title: decodeHtml(item.title || item.name || 'Unknown Album'),
    artist: decodeHtml(artist),
    year: item.year || moreInfo.year || '',
    songCount: moreInfo.song_count || item.list_count || '',
    language: item.language || moreInfo.language || '',
    thumbnail,
    permaUrl: item.perma_url || '',
    type: 'album'
  };
}

// Formats a Playlist result from JioSaavn
export function formatSaavnPlaylist(item) {
  if (!item) return null;
  const moreInfo = item.more_info || {};

  let thumbnail = (item.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
  if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
    thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  }

  const curator = moreInfo.firstname
    ? `${moreInfo.firstname} ${moreInfo.lastname || ''}`.trim()
    : 'JioSaavn Editor';

  return {
    id: item.id,
    title: decodeHtml(item.title || item.name || 'Unknown Playlist'),
    subtitle: decodeHtml(item.subtitle || ''),
    songCount: moreInfo.song_count || item.list_count || (item.subtitle?.includes('Song') ? item.subtitle : ''),
    curator: decodeHtml(curator),
    language: moreInfo.language || '',
    thumbnail,
    permaUrl: item.perma_url || '',
    type: 'playlist'
  };
}

// Fetch helper with multi-tier proxy, fallback, and abort signal support
async function fetchSaavnQuery(paramsString, signal = null) {
  // 1. Try proxied endpoint (Vite dev proxy or Vercel production rewrite)
  try {
    const res = await fetch(`${JIOSAAVN_PROXY_PATH}?${paramsString}`, { signal });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // Continue to fallback
  }

  // 2. Try direct fetch (if CORS allowed)
  try {
    const res = await fetch(`${JIOSAAVN_DIRECT_URL}?${paramsString}`, {
      signal,
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // Continue to fallback
  }

  // 3. Try AllOrigins CORS proxy fallback
  try {
    const targetUrl = `${JIOSAAVN_DIRECT_URL}?${paramsString}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('AllOrigins fallback failed:', err);
  }

  return null;
}

export const saavnApi = {
  // Search tracks using JioSaavn CDN
  searchSongs: async (query, page = 1, count = 20, signal = null) => {
    if (!query || !query.trim()) return [];
    try {
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query.trim())}&n=${count}&p=${page}`;
      const data = await fetchSaavnQuery(params, signal);
      if (data && data.results && data.results.length > 0) {
        return data.results.map(formatSaavnTrack).filter(t => Boolean(t && t.audioUrl));
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('JioSaavn searchSongs failed:', err);
    }
    return [];
  },

  // Search Artists using JioSaavn
  searchArtists: async (query, page = 1, count = 10, signal = null) => {
    if (!query || !query.trim()) return [];
    try {
      const params = `__call=search.getArtistResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query.trim())}&n=${count}&p=${page}`;
      const data = await fetchSaavnQuery(params, signal);
      if (data && data.results && data.results.length > 0) {
        return data.results.map(formatSaavnArtist).filter(Boolean);
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('JioSaavn searchArtists failed:', err);
    }
    return [];
  },

  // Search Albums using JioSaavn
  searchAlbums: async (query, page = 1, count = 10, signal = null) => {
    if (!query || !query.trim()) return [];
    try {
      const params = `__call=search.getAlbumResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query.trim())}&n=${count}&p=${page}`;
      const data = await fetchSaavnQuery(params, signal);
      if (data && data.results && data.results.length > 0) {
        return data.results.map(formatSaavnAlbum).filter(Boolean);
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('JioSaavn searchAlbums failed:', err);
    }
    return [];
  },

  // Search Playlists using JioSaavn
  searchPlaylists: async (query, page = 1, count = 10, signal = null) => {
    if (!query || !query.trim()) return [];
    try {
      const params = `__call=search.getPlaylistResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query.trim())}&n=${count}&p=${page}`;
      const data = await fetchSaavnQuery(params, signal);
      if (data && data.results && data.results.length > 0) {
        return data.results.map(formatSaavnPlaylist).filter(Boolean);
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('JioSaavn searchPlaylists failed:', err);
    }
    return [];
  },

  // Get full Album Details including track listing with 320kbps CDN stream URLs
  getAlbumDetails: async (albumId, signal = null) => {
    if (!albumId) return null;
    try {
      const params = `__call=content.getAlbumDetails&albumid=${encodeURIComponent(albumId)}&_format=json&_marker=0&api_version=4&ctx=web6dot0`;
      const data = await fetchSaavnQuery(params, signal);
      if (data) {
        const rawTracks = data.list || data.songs || [];
        const tracks = rawTracks.map(formatSaavnTrack).filter(Boolean);
        const albumMeta = formatSaavnAlbum(data);
        return {
          ...albumMeta,
          tracks
        };
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Failed to fetch album details:', albumId, err);
    }
    return null;
  },

  // Get full Playlist Details including track listing with 320kbps CDN stream URLs
  getPlaylistDetails: async (listId, signal = null) => {
    if (!listId) return null;
    try {
      const params = `__call=playlist.getDetails&listid=${encodeURIComponent(listId)}&_format=json&_marker=0&api_version=4&ctx=web6dot0`;
      const data = await fetchSaavnQuery(params, signal);
      if (data) {
        const rawTracks = data.list || data.songs || [];
        const tracks = rawTracks.map(formatSaavnTrack).filter(Boolean);
        const playlistMeta = formatSaavnPlaylist(data);
        return {
          ...playlistMeta,
          tracks
        };
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Failed to fetch playlist details:', listId, err);
    }
    return null;
  },

  // Get full Artist Details including top songs and albums
  getArtistDetails: async (artistId, signal = null) => {
    if (!artistId) return null;
    try {
      const params = `__call=artist.getArtistPageDetails&artistId=${encodeURIComponent(artistId)}&n_song=20&n_album=10&_format=json&_marker=0&api_version=4&ctx=web6dot0`;
      const data = await fetchSaavnQuery(params, signal);
      if (data) {
        const topSongs = (data.topSongs || data.songs || []).map(formatSaavnTrack).filter(Boolean);
        const topAlbums = (data.topAlbums || data.albums || []).map(formatSaavnAlbum).filter(Boolean);
        const artistMeta = formatSaavnArtist(data);
        return {
          ...artistMeta,
          topSongs,
          topAlbums
        };
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Failed to fetch artist details:', artistId, err);
    }
    return null;
  },

  // Get full Song details by JioSaavn song id
  getSongDetails: async (id, signal = null) => {
    if (!id) return null;
    try {
      const params = `__call=song.getDetails&pids=${encodeURIComponent(id)}&_format=json`;
      const data = await fetchSaavnQuery(params, signal);
      if (data) {
        const raw = data[id] || Object.values(data)[0];
        if (raw) {
          return formatSaavnTrack(raw);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Failed to fetch song details for ID:', id, err);
      }
    }
    return null;
  },

  // Spotify/YouTube Music-style live autocomplete suggestions
  getSuggestions: async (query, signal = null) => {
    if (!query || !query.trim()) {
      return { songs: [], artists: [], albums: [], playlists: [], topResult: null, query: '' };
    }

    const trimmed = query.trim();
    const cacheKey = trimmed.toLowerCase();
    if (suggestionCache.has(cacheKey)) {
      return suggestionCache.get(cacheKey);
    }

    try {
      const params = `__call=autocomplete.get&_format=json&_marker=0&api_version=4&ctx=web6dot0&query=${encodeURIComponent(trimmed)}`;
      const data = await fetchSaavnQuery(params, signal);

      if (!data) {
        return { songs: [], artists: [], albums: [], playlists: [], topResult: null, query: trimmed };
      }

      // Map Songs (deduplicate)
      const seenSongs = new Set();
      const songs = (data.songs?.data || [])
        .map(s => {
          const moreInfo = s.more_info || {};
          let thumbnail = (s.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
          if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
            thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
          }
          const artist = moreInfo.primary_artists || (s.description ? s.description.split('·')[0].trim() : 'Unknown Artist');
          const album = moreInfo.album || (s.description && s.description.includes('·') ? s.description.split('·')[1].trim() : '');
          const durationSec = parseInt(moreInfo.duration || 0, 10);

          return {
            id: s.id,
            title: decodeHtml(s.title || s.song || 'Unknown Song'),
            artist: decodeHtml(artist),
            album: decodeHtml(album),
            thumbnail,
            duration: durationSec,
            durationFormatted: durationSec > 0 ? formatTime(durationSec) : '',
            type: 'song',
            raw: s
          };
        })
        .filter(s => {
          const key = `${s.title.toLowerCase()}--${s.artist.toLowerCase()}`;
          if (seenSongs.has(key)) return false;
          seenSongs.add(key);
          return true;
        });

      // Map Artists
      const seenArtists = new Set();
      const artists = (data.artists?.data || [])
        .map(a => {
          let thumbnail = (a.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
          if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
            thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
          }
          return {
            id: a.id,
            name: decodeHtml(a.title || 'Artist'),
            role: decodeHtml(a.description || a.extra || 'Artist'),
            thumbnail,
            type: 'artist'
          };
        })
        .filter(a => {
          const key = a.name.toLowerCase();
          if (seenArtists.has(key)) return false;
          seenArtists.add(key);
          return true;
        });

      // Map Albums
      const seenAlbums = new Set();
      const albums = (data.albums?.data || [])
        .map(alb => {
          let thumbnail = (alb.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
          if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
            thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
          }
          const artist = alb.more_info?.music || (alb.description ? alb.description.split('·').pop().trim() : '');
          return {
            id: alb.id,
            title: decodeHtml(alb.title || 'Album'),
            artist: decodeHtml(artist),
            year: alb.more_info?.year || '',
            thumbnail,
            type: 'album'
          };
        })
        .filter(alb => {
          const key = `${alb.title.toLowerCase()}--${alb.artist.toLowerCase()}`;
          if (seenAlbums.has(key)) return false;
          seenAlbums.add(key);
          return true;
        });

      // Top Result determination
      let topResult = null;
      if (data.topquery?.data?.[0]) {
        const top = data.topquery.data[0];
        let thumbnail = (top.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
        if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
          thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
        }
        topResult = {
          id: top.id,
          title: decodeHtml(top.title || ''),
          subtitle: decodeHtml(top.description || top.extra || (top.type === 'artist' ? 'Artist' : top.type === 'album' ? 'Album' : 'Song')),
          type: top.type || (top.description?.toLowerCase().includes('artist') ? 'artist' : 'song'),
          thumbnail,
          raw: top
        };
      } else if (songs.length > 0) {
        topResult = {
          id: songs[0].id,
          title: songs[0].title,
          subtitle: songs[0].artist,
          type: 'song',
          thumbnail: songs[0].thumbnail,
          raw: songs[0]
        };
      }

      const result = {
        songs: songs.slice(0, 5),
        artists: artists.slice(0, 4),
        albums: albums.slice(0, 4),
        topResult,
        query: trimmed
      };

      if (suggestionCache.size >= MAX_CACHE_SIZE) {
        const first = suggestionCache.keys().next().value;
        suggestionCache.delete(first);
      }
      suggestionCache.set(cacheKey, result);
      return result;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('JioSaavn suggestion query failed:', err);
      }
      return { songs: [], artists: [], albums: [], playlists: [], topResult: null, query: trimmed };
    }
  },

  // Comprehensive multi-category search with query understanding & intent ranking
  searchComprehensive: async (query, signal = null) => {
    if (!query || !query.trim()) {
      return {
        query: '',
        parsed: parseSearchQuery(''),
        topResult: null,
        songs: MOCK_TRACKS,
        artists: [],
        albums: [],
        playlists: [],
        source: 'curated',
        hasKey: true
      };
    }

    const trimmed = query.trim();
    const parsed = parseSearchQuery(trimmed);
    const targetQuery = parsed.cleanQuery || trimmed;
    const cacheKey = `${trimmed.toLowerCase()}--${parsed.intent}`;

    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }

    try {
      // Fetch multi-category results in parallel for fast response
      const [songsRes, artistsRes, albumsRes, playlistsRes] = await Promise.allSettled([
        saavnApi.searchSongs(targetQuery, 1, 25, signal),
        saavnApi.searchArtists(targetQuery, 1, 8, signal),
        saavnApi.searchAlbums(targetQuery, 1, 8, signal),
        saavnApi.searchPlaylists(targetQuery, 1, 8, signal)
      ]);

      const songs = songsRes.status === 'fulfilled' ? songsRes.value : [];
      const artists = artistsRes.status === 'fulfilled' ? artistsRes.value : [];
      const albums = albumsRes.status === 'fulfilled' ? albumsRes.value : [];
      const playlists = playlistsRes.status === 'fulfilled' ? playlistsRes.value : [];

      // Determine Top Result with intelligent intent matching
      let topResult = null;
      const lowerQuery = targetQuery.toLowerCase();

      if (parsed.isAlbumQuery && albums.length > 0) {
        topResult = { ...albums[0], resultType: 'album' };
      } else if (parsed.isPlaylistQuery && playlists.length > 0) {
        topResult = { ...playlists[0], resultType: 'playlist' };
      } else if (artists.length > 0 && (
        parsed.isArtistQuery ||
        artists[0].name.toLowerCase() === lowerQuery ||
        artists[0].name.toLowerCase().startsWith(lowerQuery)
      )) {
        topResult = { ...artists[0], resultType: 'artist', subtitle: artists[0].role || 'Artist' };
      } else if (songs.length > 0) {
        // Find exact title match if exists
        const exactSong = songs.find(s => s.title.toLowerCase() === lowerQuery);
        topResult = { ...(exactSong || songs[0]), resultType: 'song', subtitle: (exactSong || songs[0]).artist };
      } else if (albums.length > 0) {
        topResult = { ...albums[0], resultType: 'album' };
      } else if (playlists.length > 0) {
        topResult = { ...playlists[0], resultType: 'playlist' };
      } else if (artists.length > 0) {
        topResult = { ...artists[0], resultType: 'artist' };
      }

      const outcome = {
        query: trimmed,
        parsed,
        topResult,
        songs,
        artists,
        albums,
        playlists,
        source: 'saavn_cdn',
        hasKey: true
      };

      if (searchCache.size >= MAX_CACHE_SIZE) {
        const first = searchCache.keys().next().value;
        searchCache.delete(first);
      }
      searchCache.set(cacheKey, outcome);

      return outcome;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Comprehensive search error, falling back to catalog:', err);
    }

    // Fallback if network drops
    const filtered = searchMockCatalog(trimmed);
    return {
      query: trimmed,
      parsed,
      topResult: filtered[0] ? { ...filtered[0], resultType: 'song', subtitle: filtered[0].artist } : null,
      songs: filtered,
      artists: [],
      albums: [],
      playlists: [],
      source: 'curated',
      hasKey: true
    };
  },

  // Search tracks using JioSaavn CDN (standard backward-compatible method)
  search: async (query, signal = null) => {
    if (!query || !query.trim()) {
      return {
        results: MOCK_TRACKS,
        source: 'curated',
        hasKey: true
      };
    }

    try {
      const tracks = await saavnApi.searchSongs(query, 1, 25, signal);
      if (tracks && tracks.length > 0) {
        return {
          results: tracks,
          source: 'saavn_cdn',
          hasKey: true
        };
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('JioSaavn search query failed, using mock catalog fallback:', err);
    }

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
      const tracks = await saavnApi.searchSongs('trending top hits bollywood pop', 1, 20);
      if (tracks && tracks.length > 0) {
        return tracks;
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

    // 1. Try direct song details if valid ID
    if (track.id && !track.id.startsWith('mock') && !track.id.startsWith('saavn-')) {
      const details = await saavnApi.getSongDetails(track.id);
      if (details && details.audioUrl) {
        track.audioUrl = details.audioUrl;
        return details.audioUrl;
      }
    }

    // 2. Fall back to search
    try {
      const searchQuery = `${track.title} ${track.artist}`.trim();
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(searchQuery)}&n=5`;
      const data = await fetchSaavnQuery(params);

      if (data && data.results && data.results.length > 0) {
        const matched = data.results.find(s => s.more_info?.encrypted_media_url || s.encrypted_media_url) || data.results[0];
        const audioUrl = decryptMediaUrl(matched.more_info?.encrypted_media_url || matched.encrypted_media_url);
        if (audioUrl) {
          track.audioUrl = audioUrl;
          return audioUrl;
        }
      }
    } catch (err) {
      console.warn('Failed to resolve Saavn audio stream for track:', track.title, err);
    }

    return null;
  }
};

// Export as youtubeApi for seamless backward compatibility
export const youtubeApi = saavnApi;
