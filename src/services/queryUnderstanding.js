/**
 * Query Understanding & Intent Parsing for NOIR Music Search
 * Interprets user intent to rank and categorize search results accurately.
 */

const CATEGORY_KEYWORDS = {
  bollywood: ['bollywood', 'filmi', 'hindi movie'],
  romantic: ['romantic', 'love', 'ishq', 'pyaar', 'romance'],
  sad: ['sad', 'dard', 'emotional', 'breakup', 'crying', 'heartbroken'],
  party: ['party', 'dance', 'club', 'dj', 'celebration', 'bhangra'],
  punjabi: ['punjabi', 'punjab'],
  lofi: ['lo-fi', 'lofi', 'chill', 'sleep', 'relax', 'study', 'focus'],
  workout: ['workout', 'gym', 'fitness', 'motivation', 'running', 'exercise'],
  devotional: ['devotional', 'bhakti', 'bhajan', 'aarti', 'spiritual', 'krishna', 'shiva'],
  classical: ['classical', 'instrumental', 'ragas', 'sitar', 'flute'],
  hiphop: ['hip-hop', 'hiphop', 'rap', 'desi hip hop', 'trap', 'drill'],
  english: ['english', 'pop', 'international', 'billboard']
};

export function parseSearchQuery(query = '') {
  if (!query || typeof query !== 'string') {
    return {
      rawQuery: '',
      normalizedQuery: '',
      cleanQuery: '',
      intent: 'all',
      isArtistQuery: false,
      isAlbumQuery: false,
      isPlaylistQuery: false,
      isSongQuery: false,
      detectedCategory: null,
      hasModifier: false
    };
  }

  // 1. Normalize query
  const rawQuery = query;
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const lower = normalizedQuery.toLowerCase();

  let intent = 'all';
  let cleanQuery = normalizedQuery;
  let isArtistQuery = false;
  let isAlbumQuery = false;
  let isPlaylistQuery = false;
  let isSongQuery = false;
  let detectedCategory = null;

  // 2. Check for Category / Mood intent first (e.g. "Hindi sad songs", "Punjabi party songs", "lo-fi music")
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      detectedCategory = catName;
      intent = 'category';
      break;
    }
  }

  // 3. Check for Album Intent (e.g. "Taylor Swift albums", "albums by Arijit Singh")
  if (/\b(albums?\s*by|albums?|eps?|full album)\b/i.test(lower)) {
    intent = 'albums';
    isAlbumQuery = true;
    cleanQuery = normalizedQuery
      .replace(/\b(albums?\s*by|albums?|full album)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || normalizedQuery;
  }
  // 4. Check for Playlist Intent (e.g. "AP Dhillon playlists", "Hindi sad playlists")
  else if (/\b(playlists?\s*by|playlists?|mixes?|collections?)\b/i.test(lower)) {
    intent = 'playlists';
    isPlaylistQuery = true;
    cleanQuery = normalizedQuery
      .replace(/\b(playlists?\s*by|playlists?|mixes?|collections?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || normalizedQuery;
  }
  // 5. Check for "songs by [Artist]"
  else if (/\b(songs?\s*by|tracks?\s*by)\b/i.test(lower)) {
    intent = 'songs';
    isSongQuery = true;
    cleanQuery = normalizedQuery
      .replace(/\b(songs?\s*by|tracks?\s*by)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || normalizedQuery;
  }
  // 6. Check for Artist Intent (e.g. "singer Arijit Singh", "Arijit Singh artist")
  else if (/\b(singers?|artists?)\b/i.test(lower)) {
    intent = 'artists';
    isArtistQuery = true;
    cleanQuery = normalizedQuery
      .replace(/\b(singers?|artists?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || normalizedQuery;
  }

  // For general category queries like "Hindi sad songs", keep the original query for search so Saavn's curated collections match
  if (detectedCategory && !isAlbumQuery && !isPlaylistQuery && !isSongQuery && !isArtistQuery) {
    cleanQuery = normalizedQuery;
  }

  const hasModifier = isAlbumQuery || isPlaylistQuery || isArtistQuery || isSongQuery || Boolean(detectedCategory);

  return {
    rawQuery,
    normalizedQuery,
    cleanQuery: cleanQuery || normalizedQuery,
    intent,
    isArtistQuery,
    isAlbumQuery,
    isPlaylistQuery,
    isSongQuery,
    detectedCategory,
    hasModifier
  };
}
