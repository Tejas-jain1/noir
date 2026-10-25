/**
 * Synchronized Lyrics Service for NOIR
 * Integrates with LRCLIB API (open, high-precision, free synchronized lyrics)
 * Parses standard LRC timestamps with millisecond accuracy and provides binary search line lookup.
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

  // Remove common YouTube noise brackets
  title = title.replace(/[\(\[\{]\s*(?:official\s+)?(?:music\s+)?(?:video|audio|visualizer|visuals|lyric\s+video|lyrics|hd|4k|8k|hq|mv|remastered?|live)\s*[\)\]\}]/gi, '');
  title = title.replace(/[\(\[\{]\s*(?:original\s+(?:version|mix|audio)|full\s+(?:song|video|audio)|video\s+song|audio\s+song)\s*[\)\]\}]/gi, '');
  title = title.replace(/[\(\[\{]\s*(?:from|in|soundtrack|ost)\s+["“'«]?[^()\[\]{}]+?["”'»]?\s*[\)\]\}]/gi, '');
  title = title.replace(/[\(\[\{]\s*(?:feat\.?|ft\.?|featuring)\s+[^)\]}]+[\)\]\}]/gi, '');
  title = title.replace(/\s*(?:feat\.?|ft\.?|featuring)\s+[\w\s&,.-]+/gi, '');

  // Strip inline noise words
  title = title.replace(/\b(?:full\s+song|full\s+audio|full\s+video|video\s+song|audio\s+song|lyric\s+video|lyrical\s+video)\b/gi, '');
  title = title.replace(/["“"”]/g, '').replace(/\s{2,}/g, ' ').trim();

  return { trackName: title, artistName: artist };
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

// In-memory cache for fetched lyrics
const lyricsCache = new Map();

/**
 * Fetches lyrics for a track using LRCLIB API with automatic title/artist sanitization
 */
export async function fetchLyricsForTrack(title, artist, durationSeconds = 0) {
  const { trackName, artistName } = cleanTrackMetadata(title, artist);
  const cacheKey = `${trackName.toLowerCase()}:${artistName.toLowerCase()}:${Math.round(durationSeconds)}`;

  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey);
  }

  try {
    // 1. Direct match endpoint
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName
    });
    if (durationSeconds > 0) {
      params.set('duration', Math.round(durationSeconds).toString());
    }

    let response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);

    if (!response.ok) {
      // 2. Fallback search endpoint
      const searchParams = new URLSearchParams({
        q: `${trackName} ${artistName}`
      });
      response = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`);
      if (response.ok) {
        const searchResults = await response.json();
        if (Array.isArray(searchResults) && searchResults.length > 0) {
          // Find first result with synced lyrics
          const bestMatch = searchResults.find(r => r.syncedLyrics) || searchResults[0];
          const resultData = formatLyricsResult(bestMatch, trackName, artistName);
          lyricsCache.set(cacheKey, resultData);
          return resultData;
        }
      }
      const notFoundData = { success: false, notFound: true, message: 'Lyrics not found' };
      lyricsCache.set(cacheKey, notFoundData);
      return notFoundData;
    }

    const data = await response.json();
    const resultData = formatLyricsResult(data, trackName, artistName);
    lyricsCache.set(cacheKey, resultData);
    return resultData;
  } catch (error) {
    return {
      success: false,
      notFound: false,
      message: error instanceof Error ? error.message : 'Failed to fetch lyrics'
    };
  }
}

function formatLyricsResult(data, trackName, artistName) {
  if (!data) return { success: false, notFound: true, message: 'Lyrics not found' };

  const syncedLines = data.syncedLyrics ? parseLrc(data.syncedLyrics) : null;

  return {
    success: true,
    lyrics: {
      trackName: data.trackName || trackName,
      artistName: data.artistName || artistName,
      albumName: data.albumName,
      duration: data.duration,
      instrumental: Boolean(data.instrumental),
      plainLyrics: data.plainLyrics || null,
      syncedLyrics: syncedLines,
      rawSyncedLyrics: data.syncedLyrics || null,
      source: 'lrclib'
    }
  };
}
