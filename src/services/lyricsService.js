/**
 * Multi-Provider Synchronized & Plain-Text Lyrics Service for NOIR
 *
 * Configured Providers:
 * 1. LRCLIB API (Primary for synchronized LRC lyrics with millisecond accuracy & plain text)
 * 2. JioSaavn Official Lyrics API (Catalog-direct official plain-text lyrics for Indian music)
 * 3. Lyrics.ovh API (Fallback plain-text lyrics for international & pop tracks)
 */

import { saavnApi } from './saavnApi.js';

// In-memory cache for fetched lyrics with 30-minute TTL
const lyricsCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_SIZE = 150;

/**
 * Normalizes title and extracts candidate artists for multi-provider matching
 */
export function cleanTrackMetadata(rawTitle = '', rawArtist = '') {
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();

  // Decode common HTML entities
  title = title
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  artist = artist
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');

  // Strip YouTube channel suffixes like " - Topic", "VEVO", "Official"
  artist = artist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/\s*(?:Official\s*(?:Music\s*)?(?:Channel|Page)?|Channel|Music|Records|Entertainment|Films|Company|Studios)$/i, '')
    .trim();

  // Strip pipes: "Song Title | Movie | Artist"
  if (title.includes('|')) {
    const parts = title.split(/\s*\|\s*/);
    title = parts[0].trim();
  }

  // Handle "Artist - Song Title"
  const dashMatch = title.match(/^(.+?)\s+[-–—:]\s+(.+)$/);
  if (dashMatch) {
    const left = dashMatch[1].trim();
    const right = dashMatch[2].trim();
    const normArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normLeft = left.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!normArtist || normArtist === 'youtube' || normLeft.includes(normArtist) || normArtist.includes(normLeft)) {
      artist = left;
      title = right;
    }
  }

  // Preserve base title before removing brackets
  const baseTitle = title;

  // Remove common YouTube noise brackets
  title = title.replace(/[([{]\s*(?:official\s+)?(?:music\s+)?(?:video|audio|visualizer|visuals|lyrical?(?:\s+video)?|lyrics|hd|4k|8k|hq|mv|remastered?|live)\s*[)\]}]/gi, '');
  title = title.replace(/[([{]\s*(?:original\s+(?:version|mix|audio)|full\s+(?:song|video|audio)|video\s+song|audio\s+song)\s*[)\]}]/gi, '');
  title = title.replace(/[([{]\s*(?:from|in|soundtrack|ost)\s+["“'«]?[^()[\]{}]+?["”'»]?\s*[)\]}]/gi, '');
  title = title.replace(/[([{]\s*(?:feat\.?|ft\.?|featuring)\s+[^)\]}]+[)\]}]/gi, '');
  title = title.replace(/\s*(?:feat\.?|ft\.?|featuring)\s+[\w\s&,.-]+/gi, '');

  // Strip inline noise words
  title = title.replace(/\b(?:full\s+song|full\s+audio|full\s+video|video\s+song|audio\s+song|lyric\s+video|lyrical\s+video)\b/gi, '');
  // Remove any leftover empty brackets
  title = title.replace(/\s*[({\[][\s_.-]*[)}\]]/g, '');
  title = title.replace(/["“”]/g, '').replace(/\s{2,}/g, ' ').trim();

  // Decompose composite artist string into individual artist candidates
  // e.g. "Pritam, Arijit Singh, Amitabh Bhattacharya" -> ["Arijit Singh", "Pritam", "Pritam, Arijit Singh"]
  const rawSplit = artist.split(/\s*(?:,|&|\/|;|\s+x\s+|\s+with\s+|\s+feat\.?\s+|\s+ft\.?\s+)\s*/i);
  const candidatesSet = new Set();

  for (const part of rawSplit) {
    const cleanPart = part.replace(/[()[\]{}]/g, '').trim();
    if (cleanPart && cleanPart.length > 1) {
      candidatesSet.add(cleanPart);
    }
  }

  const artistCandidates = Array.from(candidatesSet);
  const primaryArtist = artistCandidates[0] || artist;

  // Alternate titles to try if primary stripped title misses
  const alternateTitles = [title];
  if (baseTitle !== title && baseTitle.trim()) {
    alternateTitles.push(baseTitle.trim());
  }

  return {
    trackName: title,
    artistName: artist,
    primaryArtist,
    artistCandidates: artistCandidates.length > 0 ? artistCandidates : [artist],
    alternateTitles
  };
}

/**
 * Parses LRC formatted text: [mm:ss.xx] lyrics text
 * Returns sorted array of { time: number (seconds), text: string }
 */
export function parseLrc(lrcContent) {
  if (!lrcContent || typeof lrcContent !== 'string') return [];

  const lines = lrcContent.split('\n');
  const result = [];
  const tagRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  let globalOffsetSeconds = 0;

  // Check for [offset:+/-ms] tag
  for (const rawLine of lines) {
    const offsetMatch = rawLine.trim().match(/^\[offset:\s*([+-]?\d+)\s*\]/i);
    if (offsetMatch) {
      globalOffsetSeconds = parseInt(offsetMatch[1], 10) / 1000;
      break;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const timestamps = [];
    let match;
    tagRegex.lastIndex = 0;

    while ((match = tagRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fractionStr = match[3] || '0';
      const fraction = fractionStr.length === 3 ? parseInt(fractionStr, 10) / 1000 : parseInt(fractionStr, 10) / 100;
      timestamps.push(minutes * 60 + seconds + fraction + globalOffsetSeconds);
    }

    if (timestamps.length === 0) continue;

    const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();

    for (const time of timestamps) {
      result.push({ time: Math.max(0, time), text });
    }
  }

  result.sort((a, b) => a.time - b.time);

  // Filter out leading empty lines and deduplicate
  const sanitized = [];
  for (let i = 0; i < result.length; i++) {
    const curr = result[i];
    if (!curr.text && sanitized.length === 0) continue;

    const prev = sanitized[sanitized.length - 1];
    if (prev && Math.abs(prev.time - curr.time) < 0.05 && prev.text === curr.text) {
      continue;
    }
    sanitized.push(curr);
  }

  return sanitized;
}

/**
 * Binary search to find current active lyric index for currentTime in seconds
 */
export function findCurrentLyricIndex(syncedLyrics, currentTime) {
  if (!syncedLyrics || !syncedLyrics.length || currentTime < syncedLyrics[0].time) {
    return -1;
  }

  let low = 0;
  let high = syncedLyrics.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (syncedLyrics[mid].time <= currentTime) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return candidate;
}

/**
 * Provider 1: LRCLIB (Synchronized & Plain Lyrics)
 */
async function fetchFromLrclib(title, artistCandidates, durationSeconds = 0) {
  const customHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'NOIR-Music-Player/1.0 (https://github.com/Tejas-jain1/noir)'
  };

  // 1. Direct GET endpoints across candidate artists
  for (const candidateArtist of artistCandidates) {
    try {
      const getParams = new URLSearchParams({
        track_name: title,
        artist_name: candidateArtist
      });

      const response = await fetch(`https://lrclib.net/api/get?${getParams.toString()}`, {
        headers: customHeaders
      });

      if (response.ok) {
        const data = await response.json();
        // Validate duration tolerance (30 seconds) if duration is provided
        if (durationSeconds > 0 && data.duration > 0 && Math.abs(data.duration - durationSeconds) > 30) {
          continue; // Mismatched remix/teaser
        }
        if (data.syncedLyrics || data.plainLyrics) {
          return {
            source: 'lrclib',
            trackName: data.trackName || title,
            artistName: data.artistName || candidateArtist,
            albumName: data.albumName || '',
            duration: data.duration || durationSeconds,
            instrumental: Boolean(data.instrumental),
            syncedLyrics: data.syncedLyrics ? parseLrc(data.syncedLyrics) : null,
            rawSyncedLyrics: data.syncedLyrics || null,
            plainLyrics: data.plainLyrics || null
          };
        }
      }
    } catch {
      // Continue to next candidate or search endpoint
    }
  }

  // 2. Structured search endpoint: search?track_name=...&artist_name=...
  const primaryArtist = artistCandidates[0] || '';
  try {
    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: primaryArtist
    });

    const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`, {
      headers: customHeaders
    });

    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        // Find best match with duration tolerance and synced lyrics priority
        const validResults = results.filter(r => {
          if (durationSeconds > 0 && r.duration > 0) {
            return Math.abs(r.duration - durationSeconds) <= 25;
          }
          return true;
        });

        const pool = validResults.length > 0 ? validResults : results;
        const best = pool.find(r => r.syncedLyrics) || pool[0];

        if (best && (best.syncedLyrics || best.plainLyrics)) {
          return {
            source: 'lrclib',
            trackName: best.trackName || title,
            artistName: best.artistName || primaryArtist,
            albumName: best.albumName || '',
            duration: best.duration || durationSeconds,
            instrumental: Boolean(best.instrumental),
            syncedLyrics: best.syncedLyrics ? parseLrc(best.syncedLyrics) : null,
            rawSyncedLyrics: best.syncedLyrics || null,
            plainLyrics: best.plainLyrics || null
          };
        }
      }
    }
  } catch {
    // Continue to fallback providers
  }

  return null;
}

/**
 * Provider 2: JioSaavn Official Lyrics (Plain Text)
 */
async function fetchFromJioSaavn(track, title, primaryArtist) {
  // 1. Direct ID lookup if track came from JioSaavn
  const targetId = track?.lyricsId || track?.saavnId || track?.id;
  if (targetId && !String(targetId).startsWith('yt-')) {
    try {
      const saavnResult = await saavnApi.getLyrics(targetId);
      if (saavnResult && saavnResult.plainLyrics) {
        return {
          source: 'jiosaavn',
          trackName: title,
          artistName: primaryArtist,
          albumName: track?.album || '',
          duration: track?.duration || 0,
          instrumental: false,
          syncedLyrics: null,
          rawSyncedLyrics: null,
          plainLyrics: saavnResult.plainLyrics
        };
      }
    } catch {
      // Continue to search
    }
  }

  // 2. Search JioSaavn catalog by Title + Artist
  try {
    const searchRes = await saavnApi.search(`${title} ${primaryArtist}`, { pageSize: 3 });
    if (searchRes && Array.isArray(searchRes.results) && searchRes.results.length > 0) {
      const candidate = searchRes.results[0];
      const candidateId = candidate.lyricsId || candidate.saavnId || candidate.id;
      if (candidateId) {
        const saavnResult = await saavnApi.getLyrics(candidateId);
        if (saavnResult && saavnResult.plainLyrics) {
          return {
            source: 'jiosaavn',
            trackName: candidate.title || title,
            artistName: candidate.artist || primaryArtist,
            albumName: candidate.album || '',
            duration: candidate.duration || 0,
            instrumental: false,
            syncedLyrics: null,
            rawSyncedLyrics: null,
            plainLyrics: saavnResult.plainLyrics
          };
        }
      }
    }
  } catch {
    // Continue to next provider
  }

  return null;
}

/**
 * Provider 3: Lyrics.ovh (Plain Text for International & Pop Tracks)
 */
async function fetchFromLyricsOvh(title, artistCandidates) {
  for (const candidateArtist of artistCandidates.slice(0, 2)) {
    try {
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(candidateArtist)}/${encodeURIComponent(title)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.lyrics && typeof data.lyrics === 'string' && data.lyrics.trim().length > 30) {
          // Remove header artifacts like "[version romanisée]" or intro notes
          const cleanedLyrics = data.lyrics
            .replace(/^\[[^\]]+\]\s*/i, '')
            .trim();

          return {
            source: 'lyrics.ovh',
            trackName: title,
            artistName: candidateArtist,
            albumName: '',
            duration: 0,
            instrumental: false,
            syncedLyrics: null,
            rawSyncedLyrics: null,
            plainLyrics: cleanedLyrics
          };
        }
      }
    } catch {
      // Continue to next
    }
  }

  return null;
}

/**
 * Fetches lyrics for a track using multi-provider fallback:
 * 1. LRCLIB (Synchronized LRC & Plain)
 * 2. JioSaavn Official (Plain Text)
 * 3. Lyrics.ovh (Plain Text)
 */
export async function fetchLyricsForTrack(trackOrTitle, maybeArtist = '', maybeDuration = 0) {
  let track = {};
  if (typeof trackOrTitle === 'object' && trackOrTitle !== null) {
    track = { ...trackOrTitle };
  } else {
    track = {
      title: trackOrTitle || '',
      artist: maybeArtist || '',
      duration: maybeDuration || 0
    };
  }

  const { trackName, primaryArtist, artistCandidates } = cleanTrackMetadata(track.title, track.artist);
  const durationSeconds = Number(track.duration) || 0;

  if (!trackName) {
    return { success: false, notFound: true, message: 'Track title is missing' };
  }

  const cacheKey = `${trackName.toLowerCase()}:${primaryArtist.toLowerCase()}`;

  // Check in-memory cache
  const cached = lyricsCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    // Step 1: Query LRCLIB for Synchronized LRC & Plain lyrics
    const lrclibResult = await fetchFromLrclib(trackName, artistCandidates, durationSeconds);

    // If synchronized lyrics found, return immediately!
    if (lrclibResult && lrclibResult.syncedLyrics && lrclibResult.syncedLyrics.length > 0) {
      const responseData = { success: true, lyrics: lrclibResult };
      setCacheEntry(cacheKey, responseData);
      return responseData;
    }

    // Step 2: Query JioSaavn Official Lyrics for Indian / catalog tracks
    const saavnResult = await fetchFromJioSaavn(track, trackName, primaryArtist);
    if (saavnResult && saavnResult.plainLyrics) {
      const responseData = { success: true, lyrics: saavnResult };
      setCacheEntry(cacheKey, responseData);
      return responseData;
    }

    // If LRCLIB had plain lyrics, return them now
    if (lrclibResult && lrclibResult.plainLyrics) {
      const responseData = { success: true, lyrics: lrclibResult };
      setCacheEntry(cacheKey, responseData);
      return responseData;
    }

    // Step 3: Query Lyrics.ovh for International / English / Pop tracks
    const ovhResult = await fetchFromLyricsOvh(trackName, artistCandidates);
    if (ovhResult && ovhResult.plainLyrics) {
      const responseData = { success: true, lyrics: ovhResult };
      setCacheEntry(cacheKey, responseData);
      return responseData;
    }

    // No lyrics available from any provider
    const notFoundData = {
      success: false,
      notFound: true,
      message: 'Lyrics not found from any configured provider'
    };
    setCacheEntry(cacheKey, notFoundData);
    return notFoundData;

  } catch (err) {
    return {
      success: false,
      notFound: false,
      message: err instanceof Error ? err.message : 'Failed to fetch lyrics'
    };
  }
}

function setCacheEntry(key, result) {
  if (lyricsCache.size >= MAX_CACHE_SIZE) {
    const oldest = lyricsCache.keys().next().value;
    lyricsCache.delete(oldest);
  }
  lyricsCache.set(key, { result, ts: Date.now() });
}
