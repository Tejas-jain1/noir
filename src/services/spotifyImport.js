import { 
  parseSpotifyPlaylistId, 
  parseSpotifyUrl, 
  findSpotifySaavnMatch, 
  createImportedSpotifyTrack, 
  countSpotifyImportResults 
} from './spotifyPlaylistUtils.js';
import { saavnApi } from './saavnApi.js';
import { storage } from './storage.js';
import { offlineStorage } from './offlineStorage.js';
import { supabaseService } from './supabaseClient.js';

export { parseSpotifyPlaylistId, parseSpotifyUrl };

/**
 * Checks if the string is any valid Spotify link (playlist, album, or track)
 */
export function isSpotifyUrl(input) {
  if (!input || typeof input !== 'string') return false;
  const val = input.trim();
  return (
    val.includes('open.spotify.com/playlist') ||
    val.includes('open.spotify.com/album') ||
    val.includes('open.spotify.com/track') ||
    val.includes('spotify.com/embed') ||
    val.startsWith('spotify:playlist:') ||
    val.startsWith('spotify:album:') ||
    val.startsWith('spotify:track:') ||
    Boolean(parseSpotifyUrl(val))
  );
}

/**
 * Backwards-compatible alias for existing playlist checks
 */
export function isSpotifyPlaylistUrl(input) {
  return isSpotifyUrl(input);
}

/**
 * Extracts public Spotify metadata & tracks for playlists, albums, or single tracks.
 * In browser: queries the official backend API endpoint (/api/spotify-import).
 * In Node.js / test environment: invokes the Spotify entity fetcher directly.
 */
export async function fetchSpotifyPlaylist(urlOrId) {
  const input = String(urlOrId || '').trim();
  if (!input) {
    throw new Error('Please enter a Spotify playlist, album, or track link or ID.');
  }

  const parsed = parseSpotifyUrl(input);
  if (!parsed) {
    throw new Error('Could not identify a valid Spotify playlist, album, or track link.');
  }

  // 1. Primary in browser: Server endpoint /api/spotify-import?url=...
  if (typeof window !== 'undefined') {
    let res;
    try {
      res = await fetch(`/api/spotify-import?url=${encodeURIComponent(input)}`);
    } catch (networkError) {
      throw new Error('Network connection error. Please check your internet connection.');
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server returned an invalid response (${res.status}). Please try again later.`);
    }

    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Failed to import Spotify link (${res.status}). Please verify the link is public.`);
    }

    if (!data.playlist || !Array.isArray(data.results) || data.results.length === 0) {
      throw new Error('No tracks found in this Spotify link. Please check that it is public and contains music.');
    }

    return data;
  }

  // 2. Direct fetch in Node.js test environment
  const { fetchSpotifyEntityData } = await import('../../api/spotify-import.js');
  const entityData = await fetchSpotifyEntityData(input);
  return {
    success: true,
    entityType: entityData.entityType,
    playlist: {
      id: entityData.id,
      title: entityData.title,
      description: entityData.description,
      cover: entityData.cover,
      trackCount: entityData.trackCount,
      tracks: entityData.tracks,
      source: 'spotify_import',
      sourceType: 'spotify',
      sourceUrl: entityData.sourceUrl
    },
    results: entityData.tracks
  };
}

/**
 * Imports a Spotify playlist, album, or track into NOIR:
 * 1. Extracts accurate Spotify metadata.
 * 2. Matches each track against NOIR's JioSaavn catalog with title, artist, and duration checks.
 * 3. Keeps missing/unmatched tracks in the playlist marked as unavailable without breaking playback.
 * 4. Saves the complete playlist to the user's Library and Supabase.
 * 5. Plays the first playable track and navigates to the playlist view.
 */
export async function importAndStreamSpotify(urlOrId, { 
  playTrack, 
  importSpotifyPlaylist, 
  setPlaylists, 
  showToast, 
  navigate, 
  user,
  onProgress
} = {}) {
  // 1. Fetch metadata from Spotify
  onProgress?.('Fetching metadata from Spotify...');
  const data = await fetchSpotifyPlaylist(urlOrId);
  if (!data || !data.success || !data.playlist || !data.results || data.results.length === 0) {
    throw new Error(data?.error || 'Failed to import. Make sure the Spotify link is public.');
  }

  const rawTracks = data.results;
  onProgress?.(`Matching ${rawTracks.length} tracks with NOIR catalog...`);

  // 2. Deduplicate raw tracks by Spotify ID or normalized title + artist
  const seenKeys = new Set();
  const uniqueRawTracks = [];
  for (const track of rawTracks) {
    const key = track.spotifyId || `${track.title}::${track.artist}`.toLowerCase().trim();
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRawTracks.push(track);
    }
  }

  // 3. Match each track against NOIR's music catalog
  const processedTracks = [];
  const batchSize = 4;
  for (let i = 0; i < uniqueRawTracks.length; i += batchSize) {
    const batch = uniqueRawTracks.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (sourceTrack, batchIdx) => {
        const overallIndex = i + batchIdx;
        const searchQuery = `${sourceTrack.title} ${sourceTrack.artist}`.trim();
        let match = null;

        try {
          const searchData = await saavnApi.search(searchQuery, { page: 1, pageSize: 15 });
          const candidates = searchData?.results || [];
          match = findSpotifySaavnMatch(sourceTrack, candidates);
        } catch (err) {
          console.warn(`[SpotifyImport] Search match failed for "${searchQuery}":`, err.message);
        }

        return createImportedSpotifyTrack(sourceTrack, match, overallIndex, data.playlist.cover);
      })
    );
    processedTracks.push(...batchResults);
    onProgress?.(`Matched ${Math.min(i + batchSize, uniqueRawTracks.length)} of ${uniqueRawTracks.length} tracks...`);
  }

  // 4. Calculate summary counts
  const counts = countSpotifyImportResults(processedTracks);

  // 5. Build playlist entity
  const playlistId = 'sp-' + data.playlist.id;
  const newPlaylist = {
    id: playlistId,
    spotifyPlaylistId: data.playlist.id,
    name: data.playlist.title,
    description: data.playlist.description || `Imported Spotify ${data.entityType || 'playlist'} (${processedTracks.length} songs)`,
    coverUrl: data.playlist.cover,
    thumbnail: data.playlist.cover,
    cover: data.playlist.cover,
    createdAt: new Date().toISOString(),
    trackCount: processedTracks.length,
    totalTrackCount: processedTracks.length,
    matchedTrackCount: counts.matched,
    unmatchedTrackCount: counts.unmatched,
    unavailableTrackCount: counts.unavailable,
    tracks: processedTracks,
    source: 'spotify_import',
    sourceType: 'spotify',
    sourceUrl: data.playlist.sourceUrl || `https://open.spotify.com/playlist/${data.playlist.id}`
  };

  // 6. Save to library playlists and Supabase
  onProgress?.('Saving playlist to your Library...');
  if (typeof importSpotifyPlaylist === 'function') {
    await importSpotifyPlaylist(newPlaylist, processedTracks);
  } else if (typeof setPlaylists === 'function') {
    setPlaylists(prev => {
      const filtered = Array.isArray(prev) ? prev.filter(p => p.id !== playlistId && p.spotifyPlaylistId !== data.playlist.id) : [];
      const updated = [newPlaylist, ...filtered];
      const ownerId = user?.id || 'guest';
      storage.savePlaylists(updated, ownerId);
      if (ownerId === 'guest') offlineStorage.setPlaylists(updated);
      if (user?.id) {
        try { supabaseService.savePlaylist(newPlaylist, user.id); } catch {}
      }
      return updated;
    });
  } else {
    const ownerId = user?.id || 'guest';
    const existing = storage.getPlaylists(ownerId);
    const updated = [newPlaylist, ...existing.filter(p => p.id !== playlistId && p.spotifyPlaylistId !== data.playlist.id)];
    storage.savePlaylists(updated, ownerId);
    if (ownerId === 'guest') offlineStorage.setPlaylists(updated);
    if (user?.id) {
      try { supabaseService.savePlaylist(newPlaylist, user.id); } catch {}
    }
  }

  // 7. Handshake with player: Play first matched playable track with playable queue
  const playableTracks = processedTracks.filter(t => t.isPlayable && t.matchStatus === 'matched');
  if (typeof playTrack === 'function' && playableTracks.length > 0) {
    playTrack(playableTracks[0], playableTracks);
  }

  // 8. Render playlist view
  if (typeof navigate === 'function') {
    navigate(`/playlist/${playlistId}`);
  }

  // 9. Inform user with accurate feedback
  if (typeof showToast === 'function') {
    if (counts.unmatched > 0) {
      showToast(
        `Imported "${data.playlist.title}" (${counts.matched} playable, ${counts.unmatched} missing from catalog).`,
        'info',
        5000
      );
    } else {
      showToast(
        `Saved "${data.playlist.title}" (${counts.matched} songs) & playing now!`,
        'success',
        4500
      );
    }
  }

  return { playlist: newPlaylist, results: processedTracks, counts };
}

export const spotifyImport = {
  fetchSpotifyPlaylist,
  importAndStreamSpotify,
  parseSpotifyPlaylistId,
  parseSpotifyUrl,
  isSpotifyUrl,
  isSpotifyPlaylistUrl,
  hasOAuthCallback: () => false,
  getClientId: () => '',
  isConnected: () => false,
  getPendingPlaylistId: () => '',
  clearPendingPlaylistId: () => {},
  savePendingPlaylistId: () => {}
};

export default spotifyImport;
