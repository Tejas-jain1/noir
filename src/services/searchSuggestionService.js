// Intelligent Search Suggestions & Autocomplete Engine
// Generates contextual, catalog-driven suggestions based on artist names, song titles,
// albums, playlists, moods/genres, user search history, and typo corrections.

import { decodeHtml } from './saavnApi.js';

export const INTENT_PREFIX_EXPANSIONS = {
  'sa': 'sad',
  'sad': 'sad',
  'par': 'party',
  'part': 'party',
  'party': 'party',
  'rom': 'romantic',
  'roman': 'romantic',
  'romantic': 'romantic',
  'lof': 'lofi',
  'lofi': 'lofi',
  'play': 'playlist',
  'playl': 'playlist',
  'playlist': 'playlist',
  'alb': 'album',
  'albu': 'album',
  'album': 'album',
  'punj': 'punjabi',
  'punja': 'punjabi',
  'punjabi': 'punjabi',
  'hin': 'hindi',
  'hind': 'hindi',
  'hindi': 'hindi',
  'rem': 'remix',
  'remix': 'remix'
};

export const TRENDING_SEARCH_PILLS = [
  'Arijit Singh',
  'Kesariya',
  'Hindi Sad Songs',
  'Punjabi Party',
  'AP Dhillon',
  'Lo-Fi',
  'Taylor Swift',
  'Bollywood Romantic'
];

/**
 * Detects trailing partial intent keywords (e.g. "hindi sa" -> "hindi sad")
 */
export function expandQueryIntent(query = '') {
  if (!query || typeof query !== 'string') return '';
  const trimmed = query.trim();
  const words = trimmed.split(/\s+/);
  if (words.length >= 1) {
    const lastWord = words[words.length - 1].toLowerCase();
    if (INTENT_PREFIX_EXPANSIONS[lastWord] && INTENT_PREFIX_EXPANSIONS[lastWord] !== lastWord) {
      const expandedWords = [...words.slice(0, -1), INTENT_PREFIX_EXPANSIONS[lastWord]];
      return expandedWords.join(' ');
    }
  }
  return trimmed;
}

/**
 * Builds Spotify-style intelligent autocomplete suggestions from JioSaavn catalog results,
 * intent analysis, typo tolerance, and recent search history.
 */
export function buildIntelligentSuggestions({
  query = '',
  suggestions = null,
  recentSearches = [],
  userInterests = null
}) {
  const cleanQ = String(query || '').trim();
  if (!cleanQ) {
    const hasRecents = Array.isArray(recentSearches) && recentSearches.length > 0;
    return {
      hasMatches: hasRecents || TRENDING_SEARCH_PILLS.length > 0,
      isTypo: false,
      correctedQuery: null,
      topResult: null,
      phraseSuggestions: [],
      songSuggestions: [],
      artistSuggestions: [],
      albumSuggestions: [],
      playlistSuggestions: [],
      trendingPills: TRENDING_SEARCH_PILLS
    };
  }

  const qLower = cleanQ.toLowerCase();
  const qWords = qLower.split(/\s+/).filter(Boolean);
  const expandedQ = expandQueryIntent(cleanQ);
  const expandedLower = expandedQ.toLowerCase();

  // Normalize suggestion lists supporting both raw JioSaavn and formatted arrays
  const topqueryList = Array.isArray(suggestions?.topquery)
    ? suggestions.topquery
    : (Array.isArray(suggestions?.topquery?.data) ? suggestions.topquery.data : []);
  const topQueryRaw = topqueryList[0];

  const songsRaw = Array.isArray(suggestions?.songs)
    ? suggestions.songs
    : (Array.isArray(suggestions?.songs?.data) ? suggestions.songs.data : []);

  const artistsRaw = Array.isArray(suggestions?.artists)
    ? suggestions.artists
    : (Array.isArray(suggestions?.artists?.data) ? suggestions.artists.data : []);

  const albumsRaw = Array.isArray(suggestions?.albums)
    ? suggestions.albums
    : (Array.isArray(suggestions?.albums?.data) ? suggestions.albums.data : []);

  const playlistsRaw = Array.isArray(suggestions?.playlists)
    ? suggestions.playlists
    : (Array.isArray(suggestions?.playlists?.data) ? suggestions.playlists.data : []);

  // Determine Top Entity Result & Typo Tolerance
  let topResult = null;
  let isTypo = false;
  let correctedQuery = null;

  if (topQueryRaw && (topQueryRaw.title || topQueryRaw.name)) {
    const titleClean = decodeHtml(topQueryRaw.title || topQueryRaw.name);
    const titleLower = titleClean.toLowerCase();
    
    // Check if user made a typo (e.g. "arjit" -> "Arijit Singh")
    if (cleanQ.length >= 3 && titleLower !== qLower && !titleLower.startsWith(qLower)) {
      isTypo = true;
      correctedQuery = titleClean;
    }

    topResult = {
      id: topQueryRaw.id,
      title: titleClean,
      subtitle: decodeHtml(topQueryRaw.subtitle || topQueryRaw.description || (topQueryRaw.type === 'artist' ? 'Artist' : 'Top Match')),
      type: topQueryRaw.type || 'song',
      image: topQueryRaw.image || '',
      url: topQueryRaw.url || ''
    };
  }

  // Detect query intents
  const isPlaylistIntent = /\b(playlist|playlists)\b/i.test(qLower) || /\b(playlist|playlists)\b/i.test(expandedLower);
  const isAlbumIntent = /\b(album|albums)\b/i.test(qLower) || /\b(album|albums)\b/i.test(expandedLower);
  const isSongIntent = /\b(song|songs|track|tracks|music)\b/i.test(qLower);
  const isMoodOrGenreIntent = /\b(sad|party|romantic|love|lofi|chill|workout|gym|bhajan|devotional|dance|remix|mashup|hindi|punjabi|english|bhojpuri|tamil|telugu)\b/i.test(expandedLower);

  const phraseMap = new Map();

  function addPhrase(text, type = 'query', meta = {}) {
    if (!text || typeof text !== 'string') return;
    const clean = decodeHtml(text).replace(/\s*\([^)]*\)/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!clean || clean.length < 2) return;
    const key = clean.toLowerCase();
    if (phraseMap.has(key)) return;
    phraseMap.set(key, { text: clean, type, ...meta });
  }

  // 1. User's recent searches matching current query
  if (Array.isArray(recentSearches)) {
    recentSearches.forEach(recent => {
      if (typeof recent === 'string') {
        const recLower = recent.toLowerCase().trim();
        if (recLower.includes(qLower) && recLower !== qLower) {
          addPhrase(recent, 'recent', { isRecent: true });
        }
      }
    });
  }

  // 2. Spell correction if typo detected (e.g. "arjit" -> "Arijit Singh")
  if (correctedQuery) {
    addPhrase(correctedQuery, 'correction', { isCorrection: true });
  }

  // 3. Natural Expanded Intent Phrases (e.g. "hindi sa" -> "hindi sad songs", "hindi sad playlists")
  if (isMoodOrGenreIntent || isPlaylistIntent) {
    if (expandedLower !== qLower) {
      if (!isSongIntent) addPhrase(`${expandedQ} songs`, 'query');
      addPhrase(`${expandedQ} playlists`, 'query');
    } else if (qWords.length >= 2 && !isSongIntent && !isPlaylistIntent) {
      addPhrase(`${cleanQ} songs`, 'query');
      addPhrase(`${cleanQ} playlists`, 'query');
    }

    // Matching catalog playlists
    playlistsRaw.forEach(p => {
      if (!p.title) return;
      const pTitle = decodeHtml(p.title);
      const pLower = pTitle.toLowerCase();
      if (qWords.some(w => pLower.includes(w)) || pLower.includes('sad') || pLower.includes('party')) {
        addPhrase(pTitle, 'playlist');
      }
    });
  }

  // 4. Top Entity phrase completions
  if (topResult) {
    const entityTitle = topResult.title;
    addPhrase(entityTitle, topResult.type);

    if (topResult.type === 'artist') {
      addPhrase(`${entityTitle} songs`, 'query');
      addPhrase(`${entityTitle} albums`, 'query');
      if (isPlaylistIntent || /playlist/i.test(qLower)) {
        addPhrase(`${entityTitle} playlists`, 'query');
      }
    } else if (topResult.type === 'song') {
      const artistCandidate = topQueryRaw.singer || 
        topQueryRaw.artist ||
        topQueryRaw.more_info?.primary_artists || 
        topResult.subtitle?.split('-')[0]?.replace(/^(?:Song by|by)\s+/i, '').trim();
      const primaryArtist = (artistCandidate || '').split(',')[0]?.trim();
      if (primaryArtist && !entityTitle.toLowerCase().includes(primaryArtist.toLowerCase())) {
        addPhrase(`${entityTitle} ${primaryArtist}`, 'query');
      }
    }
  }

  // 5. Album intent (e.g. "taylor swift albums")
  if (isAlbumIntent && albumsRaw.length > 0) {
    albumsRaw.slice(0, 3).forEach(al => {
      if (al.title) addPhrase(decodeHtml(al.title), 'album');
    });
  }

  // 6. Song titles with artist
  songsRaw.slice(0, 4).forEach(s => {
    if (!s.title) return;
    const cleanSongTitle = decodeHtml(s.title).replace(/\s*\([^)]*\)/g, '').trim();
    addPhrase(cleanSongTitle, 'song');
    const artist = s.artist?.split(',')?.[0]?.trim() || 
                   s.singer?.split(',')?.[0]?.trim() || 
                   s.more_info?.primary_artists?.split(',')?.[0]?.trim();
    if (artist && !cleanSongTitle.toLowerCase().includes(artist.toLowerCase())) {
      addPhrase(`${cleanSongTitle} ${artist}`, 'query');
    }
  });

  // 7. General albums & playlists if space remaining
  playlistsRaw.slice(0, 3).forEach(p => {
    if (p.title) addPhrase(decodeHtml(p.title), 'playlist');
  });

  albumsRaw.slice(0, 3).forEach(al => {
    if (al.title) addPhrase(decodeHtml(al.title), 'album');
  });

  const phraseSuggestions = Array.from(phraseMap.values()).slice(0, 5);
  const songSuggestions = songsRaw.slice(0, 4);
  const artistSuggestions = artistsRaw.slice(0, 3).map(a => ({
    ...a,
    title: a.title || a.name || 'Artist'
  }));
  const albumSuggestions = albumsRaw.slice(0, 3);
  const playlistSuggestions = playlistsRaw.slice(0, 3);

  const hasMatches = Boolean(
    phraseSuggestions.length > 0 ||
    songSuggestions.length > 0 ||
    artistSuggestions.length > 0 ||
    albumSuggestions.length > 0 ||
    playlistSuggestions.length > 0 ||
    topResult
  );

  return {
    hasMatches,
    isTypo,
    correctedQuery,
    topResult,
    phraseSuggestions,
    songSuggestions,
    artistSuggestions,
    albumSuggestions,
    playlistSuggestions,
    trendingPills: TRENDING_SEARCH_PILLS
  };
}
