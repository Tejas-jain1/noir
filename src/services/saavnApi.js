// JioSaavn CDN Audio & Metadata API Service
import CryptoJS from 'crypto-js';
import { searchMockCatalog } from './mockCatalog.js';
import { buildTrackSearchQuery } from './playbackUtils.js';
import { 
  getDeterministicTrackId, 
  getHighResArtworkUrl, 
  extractOfficialArtwork, 
  getArtworkCacheKey, 
  ArtworkCache,
  extractOriginalFilmOrAlbum,
  isCompilationAlbum,
  cleanCanonicalTrackTitle
} from './artworkUtils.js';

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
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '...');
}

// Formats duration seconds into mm:ss
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const formatTime = formatDuration;

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

  // Extract real original artwork from song and album metadata; upgrade to 500x500 CDN quality
  const thumbnail = extractOfficialArtwork(item);

  // Cache artwork mapping by identity
  if (thumbnail) {
    ArtworkCache.set(getArtworkCacheKey(item), thumbnail);
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

  // Check if original film soundtrack artwork is available or cached for compilation repackages
  let finalAlbum = decodeHtml(album);
  let finalThumbnail = thumbnail;
  let finalAlbumId = moreInfo.album_id || item.album_id || item.albumid || '';

  const originalFilm = extractOriginalFilmOrAlbum(title);
  if (originalFilm && isCompilationAlbum(album, title)) {
    const filmKey = `canonical_art__${originalFilm.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const cachedFilm = ArtworkCache.get(filmKey);
    if (cachedFilm) {
      if (typeof cachedFilm === 'string') {
        finalThumbnail = cachedFilm;
        finalAlbum = originalFilm;
      } else if (cachedFilm?.thumbnail || cachedFilm?.url) {
        finalThumbnail = cachedFilm.thumbnail || cachedFilm.url;
        finalAlbum = cachedFilm.album || originalFilm;
        if (cachedFilm.albumId) finalAlbumId = cachedFilm.albumId;
      }
    }
  }

  return {
    id: getDeterministicTrackId(item),
    saavnId: item.id || moreInfo.id || '',
    hasLyrics: moreInfo.has_lyrics === 'true' || item.has_lyrics === 'true',
    lyricsId: moreInfo.lyrics_id || item.lyrics_id || item.id || '',
    title,
    artist: decodeHtml(artist),
    album: finalAlbum,
    thumbnail: finalThumbnail,
    canonicalAlbum: originalFilm || null,
    duration: durationSec,
    durationFormatted,
    audioUrl, // Direct 320kbps CDN stream from aac.saavncdn.com
    source: 'saavn_cdn',
    genre: decodeHtml(moreInfo.genre || item.genre || moreInfo.primary_genre || ''),
    mood: decodeHtml(moreInfo.mood || item.mood || ''),
    energy: moreInfo.energy ?? item.energy ?? null,
    language: decodeHtml(item.language || moreInfo.language || ''),
    tags: Array.isArray(moreInfo.tags) ? moreInfo.tags.map(decodeHtml) : [],
    albumId: finalAlbumId,
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
      // Continue to next fallback
    }
  }

  // 2. Direct browser or Node.js fetch (works directly if CORS permitted or in Node)
  try {
    const directUrl = `${JIOSAAVN_DIRECT_URL}?${paramsString}`;
    const res = await fetch(directUrl, cacheOptions);
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
  // Search tracks using JioSaavn CDN with multi-tier coverage, spell check, and artist matching
  search: async (query, { forceRefresh = false, page = 1, pageSize = 30 } = {}) => {
    if (!query || !query.trim()) {
      return {
        results: [],
        total: 0,
        page: 1,
        hasMore: false,
        source: 'curated',
        hasKey: true
      };
    }

    const cleanQuery = query.trim();
    const requestedPage = Math.max(1, Math.floor(Number(page) || 1));

    try {
      // 1. Primary track search request
      const primaryParams = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(cleanQuery)}&n=40&p=${requestedPage}`;
      const primaryPromise = fetchSaavnQuery(primaryParams, { forceRefresh });

      // On page 1, execute supplementary multi-dimensional queries in parallel
      let secondaryPromises = [];
      if (requestedPage === 1) {
        // Autocomplete provides spell-correction, artist identification, and top queries
        const autoParams = `__call=autocomplete.get&_format=json&_marker=0&ctx=web6dot0&query=${encodeURIComponent(cleanQuery.toLowerCase())}`;
        secondaryPromises.push(fetchSaavnQuery(autoParams, { forceRefresh }).catch(() => null));

        // If query does not already contain "song", query cleanQuery + " songs"
        // This is crucial for artist names (e.g. "Alfaaz") to surface their popular tracks
        const isSongQuery = /\b(songs?|track|music)\b/i.test(cleanQuery);
        if (!isSongQuery) {
          const songParams = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(cleanQuery + ' songs')}&n=30&p=1`;
          secondaryPromises.push(fetchSaavnQuery(songParams, { forceRefresh }).catch(() => null));
        }
      }

      const [primaryData, ...secondaryResults] = await Promise.all([primaryPromise, ...secondaryPromises]);

      const candidateRawItems = [];
      let totalCount = primaryData?.total ? parseInt(primaryData.total, 10) : 0;

      if (primaryData && Array.isArray(primaryData.results)) {
        candidateRawItems.push(...primaryData.results);
      }

      if (requestedPage === 1) {
        const autoData = secondaryResults[0];
        const songsData = secondaryResults[1];

        if (autoData) {
          const topQuery = autoData.topquery?.data?.[0];
          // If autocomplete suggested a corrected spelling or alias
          if (topQuery && topQuery.title && topQuery.title.toLowerCase() !== cleanQuery.toLowerCase()) {
            const correctedQuery = topQuery.title;
            const correctedParams = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(correctedQuery)}&n=30&p=1`;
            const correctedData = await fetchSaavnQuery(correctedParams, { forceRefresh }).catch(() => null);
            if (correctedData && Array.isArray(correctedData.results)) {
              candidateRawItems.push(...correctedData.results);
            }
          }

          // If topquery or first artist match in autocomplete is an artist entity, fetch their top songs
          const artistMatch = (topQuery?.type === 'artist' ? topQuery : null) || autoData.artists?.data?.[0];
          if (artistMatch && artistMatch.id) {
            try {
              const artistParams = `__call=artist.getArtistPageDetails&_format=json&artistId=${encodeURIComponent(artistMatch.id)}&n=20`;
              const artistData = await fetchSaavnQuery(artistParams, { forceRefresh });
              const artistSongs = artistData?.topSongs?.songs;
              if (Array.isArray(artistSongs)) {
                candidateRawItems.push(...artistSongs);
              }
            } catch {
              // Ignore artist page errors
            }
          }
        }

        if (songsData && Array.isArray(songsData.results)) {
          candidateRawItems.push(...songsData.results);
        }
      }

      // Format tracks and filter for playable streams
      const formattedTracks = candidateRawItems
        .map(formatSaavnTrack)
        .filter(t => Boolean(t && t.audioUrl));

      if (formattedTracks.length > 0) {
        // Deduplicate tracks by stable ID and normalized title+artist signature
        // Sort so tracks from original studio albums/soundtracks rank above compilation repackages
        const seenIds = new Set();
        const seenSignatures = new Set();
        const deduped = [];

        const sortedTracks = [...formattedTracks].sort((a, b) => {
          const aComp = isCompilationAlbum(a.album, a.title);
          const bComp = isCompilationAlbum(b.album, b.title);
          if (aComp !== bComp) return aComp ? 1 : -1;
          return 0;
        });

        for (const track of sortedTracks) {
          if (!track.id || seenIds.has(track.id)) continue;

          // Normalize title and primary artist
          const normTitle = cleanCanonicalTrackTitle(track.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const normArtist = (track.artist || '').split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const sig = `${normTitle}__${normArtist}`;

          if (seenSignatures.has(sig)) continue;

          seenIds.add(track.id);
          seenSignatures.add(sig);
          deduped.push(track);
        }

        // Pre-resolve canonical artwork for the top tracks if they are from compilations
        if (requestedPage === 1 && deduped.length > 0) {
          const topBatch = deduped.slice(0, 8);
          await Promise.all(topBatch.map(async (track) => {
            if (isCompilationAlbum(track.album, track.title) || extractOriginalFilmOrAlbum(track.title)) {
              try {
                const canonical = await saavnApi.resolveCanonicalArtwork(track);
                if (canonical?.thumbnail) {
                  track.thumbnail = canonical.thumbnail;
                  if (canonical.album) track.album = canonical.album;
                  if (canonical.albumId) track.albumId = canonical.albumId;
                }
              } catch {
                // Ignore resolution error
              }
            }
          }));
        }

        const hasMore = totalCount > requestedPage * pageSize || (primaryData?.results?.length || 0) >= 40;

        return {
          results: deduped,
          total: Math.max(totalCount, deduped.length),
          page: requestedPage,
          hasMore,
          source: 'saavn_cdn',
          hasKey: true
        };
      }
    } catch (err) {
      console.warn('JioSaavn search query failed, using mock catalog fallback:', err);
    }

    // Fallback to internal catalog if network issues occur
    const filtered = searchMockCatalog(cleanQuery);
    return {
      results: filtered,
      total: filtered.length,
      page: 1,
      hasMore: false,
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
            .filter(track => track?.id && track.title && track.audioUrl);

          if (tracks.length > 0) {
            return {
              results: tracks,
              total: tracks.length,
              page: 1,
              hasMore: true,
              source: 'saavn_cdn',
              hasKey: true
            };
          }
        }
      }

      // Secondary trend: query top Hindi songs
      const trendingQuery = requestedPage === 2 ? 'latest bollywood hits' : 'top hindi songs';
      const searchRes = await saavnApi.search(trendingQuery, { forceRefresh, page: requestedPage });
      if (searchRes && searchRes.results?.length > 0) {
        return searchRes;
      }
    } catch (err) {
      console.warn('Failed to fetch trending from Saavn, using mock catalog:', err);
    }

    return {
      results: searchMockCatalog(''),
      total: 10,
      page: 1,
      hasMore: false,
      source: 'curated',
      hasKey: true
    };
  },

  // Dynamically resolves audio stream URL if missing on the track
  resolveAudioUrl: async (track) => {
    if (!track) return null;
    if (track.audioUrl) return track.audioUrl;

    try {
      // 1. Direct song details fetch if saavnId exists
      if (track.saavnId && !String(track.saavnId).startsWith('saavn-0.')) {
        const details = await saavnApi.getSongDetails(track.saavnId);
        if (details?.audioUrl) {
          track.audioUrl = details.audioUrl;
          return details.audioUrl;
        }
      }

      // 2. Query search by title and artist
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

  // Get full song details by song ID (pid) with decrypted 320kbps audioUrl and canonical artwork
  getSongDetails: async (songId) => {
    if (!songId) return null;
    try {
      const params = `__call=song.getDetails&_format=json&pids=${encodeURIComponent(songId)}`;
      const data = await fetchSaavnQuery(params);
      const raw = data?.[songId] || data?.songs?.[0];
      if (raw) {
        const track = formatSaavnTrack(raw);
        if (track && (isCompilationAlbum(track.album, track.title) || extractOriginalFilmOrAlbum(track.title))) {
          try {
            const canonical = await saavnApi.resolveCanonicalArtwork(track);
            if (canonical?.thumbnail) {
              track.thumbnail = canonical.thumbnail;
              if (canonical.album) track.album = canonical.album;
              if (canonical.albumId) track.albumId = canonical.albumId;
            }
          } catch {
            // Ignore error
          }
        }
        return track;
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
      } catch {
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
          image: getHighResArtworkUrl(item.image) || '',
          type: item.type || 'song',
          url: item.url || ''
        })),
        songs: (data.songs?.data || []).map(item => {
          const songTitle = decodeHtml(item.title || '');
          const songAlbum = decodeHtml(item.album || '');
          let songImage = getHighResArtworkUrl(item.image) || '';
          const originalFilm = extractOriginalFilmOrAlbum(songTitle);
          if (originalFilm && isCompilationAlbum(songAlbum, songTitle)) {
            const filmKey = `canonical_art__${originalFilm.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            const cached = ArtworkCache.get(filmKey);
            if (cached) {
              songImage = typeof cached === 'string' ? cached : (cached.thumbnail || cached.url || songImage);
            }
          }
          return {
            id: item.id,
            title: songTitle,
            artist: decodeHtml(item.more_info?.primary_artists || item.description || item.subtitle || 'Artist'),
            album: (originalFilm && isCompilationAlbum(songAlbum, songTitle)) ? originalFilm : songAlbum,
            image: songImage,
            type: 'song'
          };
        }),
        artists: (data.artists?.data || []).map(item => ({
          id: item.id,
          name: decodeHtml(item.title || item.name || ''),
          role: decodeHtml(item.description || item.extra || 'Artist'),
          image: getHighResArtworkUrl(item.image) || '',
          url: item.url || '',
          type: 'artist'
        })),
        albums: (data.albums?.data || []).map(item => ({
          id: item.id,
          title: decodeHtml(item.title || ''),
          artist: decodeHtml(item.music || item.description || ''),
          year: item.more_info?.year || '',
          image: getHighResArtworkUrl(item.image) || '',
          trackIds: String(item.more_info?.song_pids || '').split(',').map(id => id.trim()).filter(Boolean),
          type: 'album'
        })),
        playlists: (data.playlists?.data || []).map(item => ({
          id: item.id,
          title: decodeHtml(item.title || ''),
          description: decodeHtml(item.description || item.subtitle || ''),
          image: getHighResArtworkUrl(item.image) || '',
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

  // Get full album details by ID or album title with authentic 500x500 cover and playable tracks
  getAlbumDetails: async (albumIdOrQuery, { forceRefresh = false } = {}) => {
    if (!albumIdOrQuery) return null;
    const cleanQuery = decodeHtml(String(albumIdOrQuery).trim());

    // 1. If numeric or direct JioSaavn album ID
    const isDirectId = /^\d+$/.test(cleanQuery) || cleanQuery.endsWith('_');
    if (isDirectId) {
      try {
        const params = `__call=content.getAlbumDetails&_format=json&albumid=${encodeURIComponent(cleanQuery)}`;
        const data = await fetchSaavnQuery(params, { forceRefresh });
        if (data && (Array.isArray(data.songs) || Array.isArray(data.list))) {
          const rawSongs = data.songs || data.list || [];
          const tracks = rawSongs.map(formatSaavnTrack).filter(t => Boolean(t && t.audioUrl));
          const highResCover = getHighResArtworkUrl(data.image) || tracks[0]?.thumbnail || '';
          return {
            id: data.albumid || cleanQuery,
            title: decodeHtml(data.title || data.name || cleanQuery),
            artist: decodeHtml(data.primary_artists || data.artist || (tracks[0]?.artist) || 'Various Artists'),
            image: highResCover,
            year: data.year || data.release_date || (tracks[0]?.year) || '',
            tracks,
            source: 'saavn_cdn'
          };
        }
      } catch (err) {
        console.warn('Failed direct album id fetch:', cleanQuery, err);
      }
    }

    // 2. Search album by title
    try {
      const searchTitle = cleanQuery.replace(/[-_]+/g, ' ');
      const searchParams = `__call=search.getAlbumResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(searchTitle)}&n=5`;
      const searchData = await fetchSaavnQuery(searchParams, { forceRefresh });

      const firstAlbum = searchData?.results?.[0];
      if (firstAlbum && firstAlbum.id) {
        const detailParams = `__call=content.getAlbumDetails&_format=json&albumid=${encodeURIComponent(firstAlbum.id)}`;
        const detailData = await fetchSaavnQuery(detailParams, { forceRefresh });
        if (detailData && (Array.isArray(detailData.songs) || Array.isArray(detailData.list))) {
          const rawSongs = detailData.songs || detailData.list || [];
          const tracks = rawSongs.map(formatSaavnTrack).filter(t => Boolean(t && t.audioUrl));
          const highResCover = getHighResArtworkUrl(detailData.image || firstAlbum.image) || tracks[0]?.thumbnail || '';
          return {
            id: detailData.albumid || firstAlbum.id,
            title: decodeHtml(detailData.title || detailData.name || firstAlbum.title || cleanQuery),
            artist: decodeHtml(detailData.primary_artists || firstAlbum.more_info?.music || (tracks[0]?.artist) || 'Various Artists'),
            image: highResCover,
            year: detailData.year || firstAlbum.more_info?.year || (tracks[0]?.year) || '',
            tracks,
            source: 'saavn_cdn'
          };
        }
      }

      // 3. Fallback: search tracks matching album query
      const songParams = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(searchTitle + ' album')}&n=30`;
      const songData = await fetchSaavnQuery(songParams, { forceRefresh });
      if (songData && Array.isArray(songData.results) && songData.results.length > 0) {
        const tracks = songData.results.map(formatSaavnTrack).filter(t => Boolean(t && t.audioUrl));
        const matchingTracks = tracks.filter(t => 
          t.album && t.album.toLowerCase().includes(searchTitle.toLowerCase())
        );
        const finalTracks = matchingTracks.length > 0 ? matchingTracks : tracks.slice(0, 10);
        const albumCover = finalTracks[0]?.thumbnail || '';
        return {
          id: `saavn-album-${cleanQuery.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          title: cleanQuery,
          artist: finalTracks[0]?.artist || 'Various Artists',
          image: albumCover,
          year: finalTracks[0]?.year || '',
          tracks: finalTracks,
          source: 'saavn_cdn'
        };
      }
    } catch (err) {
      console.warn('Failed album search fetch:', cleanQuery, err);
    }

    return null;
  },

  // Resolves official original album artwork and metadata for tracks that belong to compilation albums
  resolveCanonicalArtwork: async (track) => {
    if (!track) return null;
    const title = track.title || track.song || '';
    const albumName = track.album || track.more_info?.album || '';
    const originalFilm = extractOriginalFilmOrAlbum(title);
    const isComp = isCompilationAlbum(albumName, title);

    if (!originalFilm && !isComp) {
      return {
        thumbnail: track.thumbnail || extractOfficialArtwork(track),
        album: albumName,
        albumId: track.albumId || ''
      };
    }

    const targetKey = originalFilm || cleanCanonicalTrackTitle(title) || title;
    const cacheKey = `canonical_art__${targetKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const cached = ArtworkCache.get(cacheKey);
    if (cached) {
      const thumb = typeof cached === 'string' ? cached : (cached.thumbnail || cached.url || cached.image);
      const alb = typeof cached === 'string' ? (originalFilm || albumName) : (cached.album || originalFilm || albumName);
      const albId = typeof cached === 'object' && cached?.albumId ? cached.albumId : (track.albumId || '');
      return { thumbnail: thumb, album: alb, albumId: albId };
    }

    try {
      // 1. If an original film was specified in title (e.g. Shivaay for Darkhaast)
      if (originalFilm) {
        const albumDetails = await saavnApi.getAlbumDetails(originalFilm);
        if (albumDetails && albumDetails.image) {
          const res = {
            thumbnail: albumDetails.image,
            album: albumDetails.title || originalFilm,
            albumId: albumDetails.id || ''
          };
          ArtworkCache.set(cacheKey, res);
          return res;
        }
      }

      // 2. Search album details for the clean song title (e.g. "Apna Bana Le" finds album "Bhediya")
      const cleanTitle = cleanCanonicalTrackTitle(title);
      if (cleanTitle) {
        const albumDetails = await saavnApi.getAlbumDetails(cleanTitle);
        if (albumDetails && albumDetails.image && !isCompilationAlbum(albumDetails.title)) {
          const res = {
            thumbnail: albumDetails.image,
            album: albumDetails.title,
            albumId: albumDetails.id || ''
          };
          ArtworkCache.set(cacheKey, res);
          return res;
        }
      }
    } catch (err) {
      console.warn('Failed to resolve canonical artwork:', err);
    }

    return {
      thumbnail: track.thumbnail || extractOfficialArtwork(track),
      album: albumName,
      albumId: track.albumId || ''
    };
  },

  // Get full verified artist details by name or ID with official portrait and verified top tracks
  getArtistDetails: async (artistNameOrId, { forceRefresh = false } = {}) => {
    if (!artistNameOrId) return null;
    const cleanName = decodeHtml(String(artistNameOrId).trim());

    try {
      // 1. Search artist to get verified artist ID and official portrait
      const searchParams = `__call=search.getArtistResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(cleanName)}&n=5`;
      const searchData = await fetchSaavnQuery(searchParams, { forceRefresh });

      const artistMatch = searchData?.results?.find(a => 
        a.name && a.name.toLowerCase() === cleanName.toLowerCase()
      ) || searchData?.results?.[0];

      const artistId = artistMatch?.id;
      let artistPortrait = getHighResArtworkUrl(artistMatch?.image) || '';

      // 2. Fetch full artist page details
      if (artistId) {
        const detailParams = `__call=artist.getArtistPageDetails&_format=json&artistId=${encodeURIComponent(artistId)}&n=25`;
        const detailData = await fetchSaavnQuery(detailParams, { forceRefresh });

        if (detailData) {
          const detailPortrait = getHighResArtworkUrl(detailData.image);
          if (detailPortrait) artistPortrait = detailPortrait;

          const rawSongs = detailData.topSongs?.songs || detailData.topSongs || [];
          const tracks = Array.isArray(rawSongs)
            ? rawSongs.map(formatSaavnTrack).filter(t => Boolean(t && t.audioUrl))
            : [];

          const followerCount = detailData.follower_count 
            ? `${(Number(detailData.follower_count) / 1000000).toFixed(1)}M monthly listeners`
            : 'Verified Artist';

          return {
            id: artistId,
            name: decodeHtml(detailData.name || artistMatch.name || cleanName),
            image: artistPortrait,
            monthlyListeners: followerCount,
            genre: decodeHtml(detailData.dominantType || detailData.dominantLanguage || 'Artist'),
            bio: decodeHtml(detailData.bio || ''),
            tracks,
            source: 'saavn_cdn'
          };
        }
      }

      // 3. Fallback: search top songs for the artist
      const songRes = await saavnApi.search(`${cleanName} songs`, { forceRefresh, page: 1 });
      const tracks = Array.isArray(songRes?.results) ? songRes.results : [];
      return {
        id: `artist-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: cleanName,
        image: artistPortrait,
        monthlyListeners: 'Verified Artist',
        genre: tracks[0]?.genre || 'Contemporary',
        bio: '',
        tracks,
        source: 'saavn_cdn'
      };
    } catch (err) {
      console.warn('Failed to fetch artist details for:', cleanName, err);
    }

    return null;
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
        image: getHighResArtworkUrl(data.image) || (data.image || '').replace('150x150', '500x500'),
        tracks: data.list.map(formatSaavnTrack).filter(track => track?.id && track.title && track.audioUrl),
        source: 'saavn_cdn'
      };
    } catch (err) {
      console.warn('Failed to fetch Saavn playlist details:', playlistId, err);
      return null;
    }
  },

  // Fetch official lyrics from JioSaavn catalog
  getLyrics: async (lyricsId) => {
    if (!lyricsId) return null;
    try {
      const cleanId = String(lyricsId).replace(/^saavn-track-/, '');
      const params = `__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(cleanId)}&ctx=web6dot0&_format=json`;
      const data = await fetchSaavnQuery(params);
      if (data && data.lyrics && data.status !== 'failure') {
        const plainLyrics = decodeHtml(data.lyrics)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        return {
          plainLyrics,
          copyright: data.lyrics_copyright || 'Lyrics powered by JioSaavn',
          snippet: data.snippet || ''
        };
      }
      return null;
    } catch (err) {
      console.warn('Failed to fetch JioSaavn lyrics:', lyricsId, err);
      return null;
    }
  }
};

// Also export as youtubeApi for seamless backward compatibility
export const youtubeApi = saavnApi;
