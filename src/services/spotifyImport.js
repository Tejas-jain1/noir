import { parseSpotifyPlaylistId } from './spotifyPlaylistUtils.js';
import { storage } from './storage.js';
import { offlineStorage } from './offlineStorage.js';
import { supabaseService } from './supabaseClient.js';

export { parseSpotifyPlaylistId };

export function isSpotifyPlaylistUrl(input) {
  if (!input || typeof input !== 'string') return false;
  const val = input.trim();
  return (
    val.includes('open.spotify.com/playlist') ||
    val.includes('spotify.com/embed/playlist') ||
    val.startsWith('spotify:playlist:') ||
    Boolean(parseSpotifyPlaylistId(val))
  );
}

/**
 * Extracts public Spotify playlist metadata & tracks via zero-API-key embed scraper.
 * Tries local /api/spotify-import first in browser, then embed scraper fallback.
 */
export async function fetchSpotifyPlaylist(urlOrId) {
  const input = String(urlOrId || '').trim();
  if (!input) {
    throw new Error('Please enter a Spotify playlist URL or ID.');
  }

  const pid = parseSpotifyPlaylistId(input) || (input.match(/playlist[/:]+([a-zA-Z0-9]+)/)?.[1]) || input.split('?')[0].split('/').pop();
  if (!pid) {
    throw new Error('Could not identify a valid Spotify playlist ID.');
  }

  // 1. Primary in browser: Server endpoint /api/spotify-import?url=...
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/spotify-import?url=${encodeURIComponent(input)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.playlist && Array.isArray(data.results) && data.results.length > 0) {
          return data;
        }
        if (data && data.error) {
          throw new Error(data.error);
        }
      }
    } catch (apiError) {
      console.warn('[SpotifyImport] Local API request failed, trying client scraper fallback:', apiError);
    }
  }

  // 2. Direct embed scraper (works in Node.js test environment, or via CORS proxy in browser)
  try {
    const embedUrl = `https://open.spotify.com/embed/playlist/${pid}`;
    let res;
    if (typeof window === 'undefined') {
      res = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
    } else {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(embedUrl)}`;
      res = await fetch(proxyUrl);
    }

    if (!res.ok) throw new Error('Could not fetch Spotify embed page.');

    const html = await res.text();
    const mJson = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (!mJson) throw new Error('Make sure the Spotify playlist is public.');

    const data = JSON.parse(mJson[1]);
    const entity = data?.props?.pageProps?.state?.data?.entity;
    if (!entity) throw new Error('Playlist entity not found. Make sure the playlist is public.');

    const title = entity.name || 'Imported Spotify Playlist';
    const coverSources = entity.coverArt?.sources || [];
    const cover = coverSources.length > 0 ? coverSources[coverSources.length - 1].url : '';
    const rawTracks = entity.trackList || [];

    const tracks = rawTracks.map((t, idx) => {
      const durSec = Math.round((t.duration || 0) / 1000) || 210;
      const minutes = Math.floor(durSec / 60);
      const seconds = durSec % 60;
      const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      const trackId = t.id || (t.uri ? t.uri.split(':').pop() : '') || `idx_${idx}`;

      return {
        id: `sp_${trackId}`,
        spotifyId: trackId,
        spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : '',
        title: t.title || 'Untitled Track',
        artist: t.subtitle || t.artist || 'Unknown Artist',
        album: entity.name || 'Spotify Playlist',
        thumbnail: cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        cover: cover,
        duration: durSec,
        durationFormatted: durationFormatted,
        audioPreviewUrl: t.audioPreview?.url || null,
        isPlayable: t.isPlayable !== false,
        source: 'spotify_import'
      };
    });

    return {
      success: true,
      playlist: {
        id: pid,
        title,
        description: entity.description || '',
        cover,
        trackCount: tracks.length,
        tracks,
        source: 'spotify_import'
      },
      results: tracks
    };
  } catch (fallbackError) {
    throw new Error(fallbackError.message || 'Failed to import Spotify playlist. Please ensure the link is public.');
  }
}

/**
 * Handshake: Imports the Spotify playlist, sets the player queue, begins streaming Track #1,
 * saves to the user's library, and navigates to the playlist view.
 */
export async function importAndStreamSpotify(urlOrId, { playTrack, importSpotifyPlaylist, setPlaylists, showToast, navigate, user } = {}) {
  const data = await fetchSpotifyPlaylist(urlOrId);
  if (!data || !data.success || !data.playlist || !data.results || data.results.length === 0) {
    throw new Error(data?.error || 'Failed to import. Make sure the playlist is public.');
  }

  const playlistId = 'sp-' + data.playlist.id;
  const newPlaylist = {
    id: playlistId,
    spotifyPlaylistId: data.playlist.id,
    name: data.playlist.title,
    description: data.playlist.description || `Imported Spotify playlist (${data.results.length} songs)`,
    coverUrl: data.playlist.cover,
    thumbnail: data.playlist.cover,
    cover: data.playlist.cover,
    createdAt: new Date().toISOString(),
    trackCount: data.results.length,
    totalTrackCount: data.results.length,
    matchedTrackCount: data.results.length,
    unmatchedTrackCount: 0,
    unavailableTrackCount: 0,
    tracks: data.results,
    source: 'spotify_import',
    sourceType: 'spotify',
    sourceUrl: `https://open.spotify.com/playlist/${data.playlist.id}`
  };

  // 1. Save to library playlists
  if (typeof importSpotifyPlaylist === 'function') {
    await importSpotifyPlaylist(newPlaylist, data.results);
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

  // 2. Handshake with player: set queue, set queueIndex = 0, start playing Track #1
  if (typeof playTrack === 'function' && data.results.length > 0) {
    playTrack(data.results[0], data.results);
  }

  // 3. Render playlist view
  if (typeof navigate === 'function') {
    navigate(`/playlist/${playlistId}`);
  }

  // 4. Toast notification
  if (typeof showToast === 'function') {
    showToast(`Saved "${data.playlist.title}" (${data.results.length} songs) to Library & streaming now!`, 'success', 4500);
  }

  return { playlist: newPlaylist, results: data.results };
}

export const spotifyImport = {
  fetchSpotifyPlaylist,
  importAndStreamSpotify,
  parseSpotifyPlaylistId,
  isSpotifyPlaylistUrl,
  hasOAuthCallback: () => false,
  getClientId: () => '',
  isConnected: () => false,
  getPendingPlaylistId: () => '',
  clearPendingPlaylistId: () => {},
  savePendingPlaylistId: () => {}
};

export default spotifyImport;
