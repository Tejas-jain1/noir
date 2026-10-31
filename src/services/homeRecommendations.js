// Dynamic Home Recommendations & Feed Rotation Service
import { saavnApi } from './saavnApi.js';
import { 
  classifyTrackVibe, 
  createRecommendationContext, 
  rankRecommendationCandidates 
} from './recommendationEngine.js';
import { normalizeTrackTitle } from './playbackUtils.js';

const CACHE_PREFIX = 'noir_home_feed_';
const SESSION_SEED_KEY = 'noir_home_session_seed';
const ROTATION_INDEX_KEY = 'noir_home_rotation_index';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// In-memory store for test and SSR environments
const memoryCache = new Map();
let memorySessionSeed = null;
let memoryRotationIndex = 0;

// Curated verified artist directory with high-definition JioSaavn CDN portraits & listeners
export const FEATURED_ARTISTS_POOL = [
  { id: 'art-arijit', name: 'Arijit Singh', monthlyListeners: '52.7M', genre: 'Bollywood / Romantic', image: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_150x150.jpg' },
  { id: 'art-diljit', name: 'Diljit Dosanjh', monthlyListeners: '31.4M', genre: 'Punjabi / Pop', image: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_150x150.jpg' },
  { id: 'art-ap-dhillon', name: 'AP Dhillon', monthlyListeners: '22.8M', genre: 'Punjabi / Hip-Hop', image: 'https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_150x150.jpg' },
  { id: 'art-taylor-swift', name: 'Taylor Swift', monthlyListeners: '98.5M', genre: 'Pop / Country', image: 'https://c.saavncdn.com/artists/Taylor_Swift_003_20200226074119_150x150.jpg' },
  { id: 'art-the-weeknd', name: 'The Weeknd', monthlyListeners: '112.4M', genre: 'R&B / Synthwave', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80' },
  { id: 'art-sidhu', name: 'Sidhu Moose Wala', monthlyListeners: '26.9M', genre: 'Punjabi / Hip-Hop', image: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_004_20250617183705_150x150.jpg' },
  { id: 'art-shreya', name: 'Shreya Ghoshal', monthlyListeners: '38.2M', genre: 'Bollywood / Classical', image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_007_20241101074144_150x150.jpg' },
  { id: 'art-pritam', name: 'Pritam', monthlyListeners: '44.1M', genre: 'Bollywood / Composer', image: 'https://c.saavncdn.com/artists/Pritam_Chakraborty-20170711073326_150x150.jpg' },
  { id: 'art-billie', name: 'Billie Eilish', monthlyListeners: '104.9M', genre: 'Alt-Pop / Indie', image: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_150x150.jpg' },
  { id: 'art-dua-lipa', name: 'Dua Lipa', monthlyListeners: '88.1M', genre: 'Dance-Pop', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80' },
  { id: 'art-anuv-jain', name: 'Anuv Jain', monthlyListeners: '18.6M', genre: 'Indie / Acoustic', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80' },
  { id: 'art-atif-aslam', name: 'Atif Aslam', monthlyListeners: '35.2M', genre: 'Sufi / Romantic', image: 'https://c.saavncdn.com/artists/Atif_Aslam_500x500.jpg' },
  { id: 'art-karan-aujla', name: 'Karan Aujla', monthlyListeners: '21.5M', genre: 'Punjabi / Rap', image: 'https://c.saavncdn.com/artists/Karan_Aujla_002_20230818073541_150x150.jpg' },
  { id: 'art-badshah', name: 'Badshah', monthlyListeners: '29.4M', genre: 'Commercial / Hip-Hop', image: 'https://c.saavncdn.com/artists/Badshah_005_20230609074026_150x150.jpg' },
  { id: 'art-coldplay', name: 'Coldplay', monthlyListeners: '84.3M', genre: 'Alt-Rock / Pop', image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&auto=format&fit=crop&q=80' }
];

// Curated guest vibe search discovery pools rotated across sessions
const GUEST_DISCOVERY_SEEDS = [
  { query: 'bollywood hits', genre: 'bollywood', mood: 'romantic', label: 'Bollywood Hits' },
  { query: 'lo-fi chillhop beats', genre: 'lo-fi', mood: 'chill', label: 'Lo-Fi Soundscapes' },
  { query: 'top hits 2025', genre: 'pop', mood: 'happy', label: 'Global Hits' },
  { query: 'indie pop songs', genre: 'pop', mood: 'chill', label: 'Indie Vibes' },
  { query: 'punjabi pop hits', genre: 'punjabi', mood: 'energetic', label: 'Punjabi Superhits' },
  { query: 'electronic dance music', genre: 'electronic', mood: 'energetic', label: 'Electronic & Dance' }
];

// Rotating query pools for New Releases
const NEW_RELEASES_QUERIES = [
  'new songs 2025',
  'latest hindi songs',
  'latest hits',
  'new pop songs',
  'new punjabi releases',
  'top songs 2025'
];

// Helper: parse release year
const parseYear = (track) => {
  const match = String(track?.year || track?.releaseDate || '').match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : 0;
};

// Helper: Deduplicate tracks by id and title
export const deduplicateTracks = (tracks = [], excludeTracks = []) => {
  const seenIds = new Set((excludeTracks || []).map(t => t?.id).filter(Boolean));
  const seenTitles = new Set((excludeTracks || []).map(t => normalizeTrackTitle(t?.title)).filter(Boolean));
  const unique = [];

  for (const track of tracks || []) {
    if (!track || !track.id || !track.title || !track.audioUrl) continue;
    const titleNorm = normalizeTrackTitle(track.title);
    if (seenIds.has(track.id) || seenTitles.has(titleNorm)) continue;
    seenIds.add(track.id);
    seenTitles.add(titleNorm);
    unique.push(track);
  }
  return unique;
};

// Session seed & rotation index management
export function getHomeSessionSeed() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      let seed = sessionStorage.getItem(SESSION_SEED_KEY);
      if (!seed) {
        seed = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        sessionStorage.setItem(SESSION_SEED_KEY, seed);
      }
      return seed;
    }
  } catch {}
  if (!memorySessionSeed) {
    memorySessionSeed = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  return memorySessionSeed;
}

export function getHomeRotationIndex() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = sessionStorage.getItem(ROTATION_INDEX_KEY);
      if (stored !== null && !isNaN(Number(stored))) {
        return parseInt(stored, 10);
      }
    }
  } catch {}
  return memoryRotationIndex;
}

export function rotateHomeSession() {
  const nextIndex = (getHomeRotationIndex() + 1) % 12;
  const nextSeed = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(ROTATION_INDEX_KEY, String(nextIndex));
      sessionStorage.setItem(SESSION_SEED_KEY, nextSeed);
    }
  } catch {}

  memoryRotationIndex = nextIndex;
  memorySessionSeed = nextSeed;
  return { sessionSeed: nextSeed, rotationIndex: nextIndex };
}

// Scoped cache reader/writer
function readCache(userId, sessionSeed) {
  const key = `${CACHE_PREFIX}${userId || 'guest'}_${sessionSeed}`;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          return parsed.data;
        }
      }
    }
  } catch {}
  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
    return mem.data;
  }
  return null;
}

function writeCache(userId, sessionSeed, data) {
  const key = `${CACHE_PREFIX}${userId || 'guest'}_${sessionSeed}`;
  const record = { timestamp: Date.now(), data };
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(key, JSON.stringify(record));
    }
  } catch {}
  memoryCache.set(key, record);
}

export function clearHomeFeedCache(userId) {
  const prefix = `${CACHE_PREFIX}${userId || 'guest'}`;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(prefix)) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    }
  } catch {}
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) memoryCache.delete(k);
  }
}

// 1. Fetch Trending Songs
async function fetchTrendingSongs(rotationIndex, forceRefresh) {
  try {
    // Alternate between chart top 50, page 2, and trending queries based on rotationIndex
    const mode = rotationIndex % 3;
    if (mode === 0) {
      const tracks = await saavnApi.getTrending({ forceRefresh, page: 1 });
      if (Array.isArray(tracks) && tracks.length > 0) return tracks;
    } else if (mode === 1) {
      const tracks = await saavnApi.getTrending({ forceRefresh, page: 2 });
      if (Array.isArray(tracks) && tracks.length > 0) return tracks;
    }
    
    // Mode 2: Search trending hits
    const query = (rotationIndex % 2 === 0) ? 'trending superhits' : 'viral top hits';
    const res = await saavnApi.search(query, { forceRefresh, page: (rotationIndex % 2) + 1 });
    if (Array.isArray(res?.results) && res.results.length > 0) {
      return res.results;
    }
    // Fallback to official chart
    return await saavnApi.getTrending({ forceRefresh, page: 1 });
  } catch (err) {
    console.warn('Failed to fetch trending songs:', err);
    return [];
  }
}

// 2. Fetch New Releases
async function fetchNewReleases(rotationIndex, forceRefresh, excludeTracks = []) {
  try {
    const queryIndex = rotationIndex % NEW_RELEASES_QUERIES.length;
    const query = NEW_RELEASES_QUERIES[queryIndex];
    const res = await saavnApi.search(query, { forceRefresh, page: 1 });
    const candidates = Array.isArray(res?.results) ? res.results : [];

    // Sort by newest release year first, then deduplicate
    const sorted = [...candidates].sort((a, b) => parseYear(b) - parseYear(a));
    return deduplicateTracks(sorted, excludeTracks).slice(0, 15);
  } catch (err) {
    console.warn('Failed to fetch new releases:', err);
    return [];
  }
}

// 3. Fetch Personalized Recommendations
async function fetchPersonalizedRecommendations({
  userPreferences,
  likedSongs = [],
  recentlyPlayed = [],
  rotationIndex,
  forceRefresh,
  excludeTracks = []
}) {
  try {
    // Extract user profile signals
    const prefArtists = Array.isArray(userPreferences?.artists) ? userPreferences.artists : [];
    const prefGenres = Array.isArray(userPreferences?.genres) ? userPreferences.genres : [];

    // Tally artist frequency from history & liked
    const artistScores = new Map();
    [...likedSongs, ...recentlyPlayed].forEach(t => {
      const name = String(t?.artist || '').split(',')[0].trim();
      if (name) {
        artistScores.set(name, (artistScores.get(name) || 0) + 1);
      }
    });

    const topListenedArtists = [...artistScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    // Build candidate search queries
    const queries = [];

    // Top artist queries (rotated by session)
    const combinedArtists = [...new Set([...prefArtists, ...topListenedArtists])];
    if (combinedArtists.length > 0) {
      const artistIndex = rotationIndex % combinedArtists.length;
      queries.push(`${combinedArtists[artistIndex]} hits`);
      if (combinedArtists.length > 1) {
        const nextArtist = combinedArtists[(artistIndex + 1) % combinedArtists.length];
        queries.push(`${nextArtist} top songs`);
      }
    }

    // Top genre queries (rotated by session)
    if (prefGenres.length > 0) {
      const genreIndex = rotationIndex % prefGenres.length;
      queries.push(`${prefGenres[genreIndex]} songs`);
    }

    // If user has liked songs, pick a seed track to infer vibe
    let seedTrack = null;
    if (likedSongs.length > 0) {
      const seedIndex = rotationIndex % likedSongs.length;
      seedTrack = likedSongs[seedIndex];
    } else if (recentlyPlayed.length > 0) {
      const seedIndex = rotationIndex % recentlyPlayed.length;
      seedTrack = recentlyPlayed[seedIndex];
    }

    // Guest or no-history fallback: use curated rotating discovery seeds
    if (queries.length === 0) {
      const seed1 = GUEST_DISCOVERY_SEEDS[rotationIndex % GUEST_DISCOVERY_SEEDS.length];
      const seed2 = GUEST_DISCOVERY_SEEDS[(rotationIndex + 1) % GUEST_DISCOVERY_SEEDS.length];
      queries.push(seed1.query);
      queries.push(seed2.query);
    }

    // Fetch candidate pools from JioSaavn API in parallel
    const searchPromises = queries.slice(0, 3).map(q => 
      saavnApi.search(q, { forceRefresh, page: 1 })
    );
    const searchResults = await Promise.all(searchPromises);
    const candidateTracks = searchResults.flatMap(res => res?.results || []);

    // Create reference context
    const context = createRecommendationContext(
      seedTrack || { title: queries[0], genre: prefGenres[0] || '' },
      queries[0]
    );

    // Rank candidates using recommendation engine scoring
    const rankedResults = rankRecommendationCandidates(candidateTracks, context, {
      userPreferences,
      likedTracks: likedSongs,
      recentTracks: recentlyPlayed,
      excludedTracks: excludeTracks
    });

    const rankedTracks = rankedResults.map(r => r.track);
    const unique = deduplicateTracks(rankedTracks, excludeTracks);

    if (unique.length > 0) {
      return unique.slice(0, 15);
    }

    // Safe fallback if ranking produced empty list: return deduplicated candidate pool
    return deduplicateTracks(candidateTracks, excludeTracks).slice(0, 15);
  } catch (err) {
    console.warn('Failed to fetch personalized recommendations:', err);
    return [];
  }
}

// 4. Assemble dynamic popular artists feed
export function buildPopularArtistsFeed({
  userPreferences,
  likedSongs = [],
  recentlyPlayed = [],
  rotationIndex = 0
}) {
  const result = [];
  const seenNames = new Set();

  const addArtist = (artistObj) => {
    if (!artistObj || !artistObj.name) return;
    const norm = artistObj.name.toLowerCase().trim();
    if (seenNames.has(norm)) return;
    seenNames.add(norm);
    result.push(artistObj);
  };

  // 1. User preferred artists first
  const prefArtists = userPreferences?.artists || [];
  for (const name of prefArtists) {
    const known = FEATURED_ARTISTS_POOL.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (known) {
      addArtist(known);
    } else {
      // Create personalized artist entry with matched image if available
      const trackWithImage = [...likedSongs, ...recentlyPlayed].find(
        t => t.artist?.toLowerCase().includes(name.toLowerCase())
      );
      addArtist({
        id: `art-custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        monthlyListeners: 'Favorite Artist',
        genre: 'User Preferred',
        image: trackWithImage?.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'
      });
    }
  }

  // 2. Top listened artists from history
  for (const track of [...likedSongs, ...recentlyPlayed]) {
    const name = String(track?.artist || '').split(',')[0].trim();
    if (name && !seenNames.has(name.toLowerCase())) {
      const known = FEATURED_ARTISTS_POOL.find(a => a.name.toLowerCase() === name.toLowerCase());
      if (known) addArtist(known);
    }
  }

  // 3. Fill with rotated artists from the verified pool
  const poolLen = FEATURED_ARTISTS_POOL.length;
  const offset = rotationIndex % poolLen;
  for (let i = 0; i < poolLen && result.length < 10; i++) {
    const candidate = FEATURED_ARTISTS_POOL[(offset + i) % poolLen];
    addArtist(candidate);
  }

  return result.slice(0, 8);
}

// Main orchestrator: get complete home recommendations feed
export async function getHomeRecommendations({
  userId = 'guest',
  userPreferences = null,
  likedSongs = [],
  recentlyPlayed = [],
  forceRefresh = false,
  sessionSeed = null
} = {}) {
  const activeSeed = sessionSeed || getHomeSessionSeed();
  const rotationIndex = getHomeRotationIndex();

  // 1. Check cache first unless forceRefresh is true
  if (!forceRefresh) {
    const cached = readCache(userId, activeSeed);
    if (cached) {
      return { ...cached, source: 'cache' };
    }
  }

  // 2. Fetch Trending Songs
  const rawTrending = await fetchTrendingSongs(rotationIndex, forceRefresh);
  const trendingTracks = deduplicateTracks(rawTrending).slice(0, 15);

  // 3. Fetch New Releases (excluding trending tracks to avoid duplicates)
  const newReleases = await fetchNewReleases(rotationIndex, forceRefresh, trendingTracks);

  // 4. Fetch Personalized Recommendations (excluding trending and new release tracks)
  const excludedSoFar = [...trendingTracks, ...newReleases];
  const recommendedTracks = await fetchPersonalizedRecommendations({
    userPreferences,
    likedSongs,
    recentlyPlayed,
    rotationIndex,
    forceRefresh,
    excludeTracks: excludedSoFar
  });

  // 5. Popular Artists
  const popularArtists = buildPopularArtistsFeed({
    userPreferences,
    likedSongs,
    recentlyPlayed,
    rotationIndex
  });

  // 6. Select Spotlight Hero Track
  // Priority: Recommended track #1 -> New Releases #1 -> Trending #1
  const heroTrack = recommendedTracks[0] || newReleases[0] || trendingTracks[0] || null;

  const feedData = {
    heroTrack,
    trendingTracks,
    newReleases,
    recommendedTracks,
    popularArtists,
    source: 'network',
    sessionSeed: activeSeed,
    rotationIndex
  };

  // Save to scoped cache
  writeCache(userId, activeSeed, feedData);

  return feedData;
}
