import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { offlineStorage } from '../services/offlineStorage';
import { supabaseService, isSupabaseConfigured } from '../services/supabaseClient';
import { notifyAdminOnAuth } from '../services/adminNotification';

const LibraryContext = createContext();
const LEGACY_HISTORY_IDS = new Set(['4NRXx6U8ABQ', 'Th4EkOPb2qY', '5NV6Rdv1a3I', 'H5v3kku4y6Q', 'd5gxZ5r0qSY']);

const sanitizeHistory = (tracks) => (Array.isArray(tracks) ? tracks : []).filter(track =>
  track && track.id && !LEGACY_HISTORY_IDS.has(track.id) &&
  track.title !== 'Blinding Lights' && track.title !== 'Get Lucky'
);

const refreshSpotifyPlaylistCounts = (playlist) => {
  if (playlist?.sourceType !== 'spotify' || !Array.isArray(playlist.tracks)) return playlist;
  const counts = playlist.tracks.reduce((result, track) => {
    if (track.matchStatus === 'unmatched') result.unmatched += 1;
    else if (track.matchStatus === 'unavailable') result.unavailable += 1;
    else result.matched += 1;
    return result;
  }, { matched: 0, unmatched: 0, unavailable: 0 });
  return {
    ...playlist,
    totalTrackCount: playlist.tracks.length,
    matchedTrackCount: counts.matched,
    unmatchedTrackCount: counts.unmatched,
    unavailableTrackCount: counts.unavailable
  };
};

export function LibraryProvider({ children }) {
  const [user, setUser] = useState(null);
  const [likedSongs, setLikedSongs] = useState(() => storage.getLikedSongs());
  const [playlists, setPlaylists] = useState(() => storage.getPlaylists());
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => storage.getRecentlyPlayed('guest'));
  const [libraryOwnerId, setLibraryOwnerId] = useState(null);
  const [settings, setSettings] = useState(() => storage.getSettings());
  const [userPreferences, setUserPreferences] = useState(() => storage.getUserPreferences('guest'));
  const [isInterestPickerOpen, setIsInterestPickerOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Toast notification dispatcher
  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Initialize Supabase Auth listener & IndexedDB data hydration
  useEffect(() => {
    let isMounted = true;
    let authEventSeen = false;
    let loadVersion = 0;

    const loadLibraryForUser = async (currentUser) => {
      const version = ++loadVersion;
      setUser(currentUser);
      setLibraryOwnerId(null);

      if (currentUser) {
        const [cloudLikes, cloudPlaylists, cloudPrefs, cloudHistory] = await Promise.all([
          supabaseService.loadLikedSongs(currentUser.id),
          supabaseService.loadPlaylists(currentUser.id),
          supabaseService.loadUserPreferences(currentUser.id),
          supabaseService.loadHistory(currentUser.id)
        ]);
        if (!isMounted || version !== loadVersion) return;

        setLikedSongs(cloudLikes);
        setPlaylists(cloudPlaylists);
        setUserPreferences(cloudPrefs);
        setRecentlyPlayed(sanitizeHistory(cloudHistory));
        setLibraryOwnerId(currentUser.id);
        if (!cloudPrefs || !cloudPrefs.onboarding_completed) setIsInterestPickerOpen(true);
        return;
      }

      const [offlineLikes, offlinePlaylists, offlineHistory] = await Promise.all([
        offlineStorage.getLikedSongs(),
        offlineStorage.getPlaylists(),
        offlineStorage.getHistory()
      ]);
      if (!isMounted || version !== loadVersion) return;

      const localGuestHistory = storage.getRecentlyPlayed('guest');
      const guestHistory = sanitizeHistory(localGuestHistory.length ? localGuestHistory : offlineHistory);
      setLikedSongs(Array.isArray(offlineLikes) ? offlineLikes : []);
      setPlaylists(Array.isArray(offlinePlaylists) ? offlinePlaylists : []);
      setRecentlyPlayed(guestHistory);
      setUserPreferences(storage.getUserPreferences('guest'));
      setLibraryOwnerId('guest');
      storage.saveRecentlyPlayed(guestHistory, 'guest');
      if (guestHistory.length !== offlineHistory.length) offlineStorage.setHistory(guestHistory);
    };

    // Initial session load and auth changes share one versioned loader so a stale account response cannot replace the active user's history.
    supabaseService.getCurrentUser().then(currentUser => {
      if (!authEventSeen) return loadLibraryForUser(currentUser);
      return undefined;
    }).catch(() => {
      if (!authEventSeen) return loadLibraryForUser(null);
      return undefined;
    });

    const { data: { subscription } } = supabaseService.onAuthStateChange(async (event, session) => {
      authEventSeen = true;
      const activeUser = session?.user || null;
      if (activeUser && event === 'SIGNED_IN') notifyAdminOnAuth(activeUser, 'Signed In');
      await loadLibraryForUser(activeUser);
      if (activeUser && isMounted) showToast(`Signed in as ${activeUser.email}`, 'success');
    });

    return () => {
      isMounted = false;
      loadVersion += 1;
      subscription?.unsubscribe();
    };
  }, [showToast]);

  // Liked Songs Management
  const isLiked = useCallback((trackId) => {
    return likedSongs.some(track => track.id === trackId);
  }, [likedSongs]);

  const toggleLike = useCallback((track) => {
    if (!track || !track.id) return;
    setLikedSongs(prev => {
      const exists = prev.some(t => t.id === track.id);
      let updated;
      if (exists) {
        updated = prev.filter(t => t.id !== track.id);
        showToast(`Removed "${track.title}" from Liked Songs`, 'info');
      } else {
        updated = [track, ...prev];
        showToast(`Added "${track.title}" to Liked Songs`, 'success');
      }
      const ownerId = user?.id || 'guest';
      storage.saveLikedSongs(updated, ownerId);
      if (ownerId === 'guest') offlineStorage.setLikedSongs(updated);

      if (user) {
        supabaseService.toggleLikeTrack(track, !exists, user.id);
      }

      return updated;
    });
  }, [user, showToast]);

  // Playlist Management
  const createPlaylist = useCallback((name, description = '') => {
    const newPlaylist = {
      id: 'pl-' + Date.now(),
      name: name.trim() || 'My Playlist #' + (playlists.length + 1),
      description: description.trim(),
      createdAt: new Date().toISOString(),
      tracks: []
    };

    setPlaylists(prev => {
      const updated = [newPlaylist, ...prev];
      const ownerId = user?.id || 'guest';
      storage.savePlaylists(updated, ownerId);
      if (ownerId === 'guest') offlineStorage.setPlaylists(updated);

      if (user) {
        supabaseService.savePlaylist(newPlaylist, user.id);
      }

      return updated;
    });

    showToast(`Created playlist "${newPlaylist.name}"`, 'success');
    return newPlaylist;
  }, [playlists.length, user, showToast]);

  const importSpotifyPlaylist = useCallback(async (playlist, tracks) => {
    const playlistId = playlist.id || ('sp-' + (playlist.spotifyPlaylistId || Date.now()));
    const savedPlaylist = {
      id: playlistId,
      spotifyPlaylistId: playlist.spotifyPlaylistId || playlist.id,
      name: playlist.name || 'Imported Spotify Playlist',
      description: playlist.description || `Imported from Spotify (${tracks?.length || 0} tracks)`,
      coverUrl: playlist.coverUrl || playlist.cover || '',
      thumbnail: playlist.coverUrl || playlist.cover || '',
      createdAt: new Date().toISOString(),
      trackCount: tracks?.length || 0,
      totalTrackCount: tracks?.length || 0,
      matchedTrackCount: tracks?.length || 0,
      unmatchedTrackCount: 0,
      unavailableTrackCount: 0,
      tracks: tracks || [],
      source: 'spotify_import',
      sourceType: 'spotify',
      sourceUrl: playlist.sourceUrl || `https://open.spotify.com/playlist/${playlist.spotifyPlaylistId || ''}`
    };

    setPlaylists(prev => {
      const updated = [savedPlaylist, ...prev.filter(item => (
        item.id !== savedPlaylist.id && item.spotifyPlaylistId !== savedPlaylist.spotifyPlaylistId
      ))];
      const ownerId = user?.id || 'guest';
      storage.savePlaylists(updated, ownerId);
      if (ownerId === 'guest') offlineStorage.setPlaylists(updated);
      if (user?.id) {
        try { supabaseService.savePlaylist(savedPlaylist, user.id); } catch {}
      }
      return updated;
    });

    return savedPlaylist;
  }, [user]);

  const updatePlaylist = useCallback((id, updates) => {
    setPlaylists(prev => {
      const updated = prev.map(pl => {
        if (pl.id === id) {
          const mod = refreshSpotifyPlaylistCounts({ ...pl, ...updates });
          if (user) supabaseService.savePlaylist(mod, user.id);
          return mod;
        }
        return pl;
      });
      const ownerId = user?.id || 'guest';
      storage.savePlaylists(updated, ownerId);
      if (ownerId === 'guest') offlineStorage.setPlaylists(updated);
      return updated;
    });
    showToast('Playlist updated', 'success');
  }, [user, showToast]);

  const deletePlaylist = useCallback((id) => {
    setPlaylists(prev => {
      const target = prev.find(p => p.id === id);
      const updated = prev.filter(pl => pl.id !== id);
      const ownerId = user?.id || 'guest';
      storage.savePlaylists(updated, ownerId);
      if (ownerId === 'guest') offlineStorage.setPlaylists(updated);
      if (user) supabaseService.deletePlaylist(id, user.id);
      if (target) showToast(`Deleted playlist "${target.name}"`, 'info');
      return updated;
    });
  }, [user, showToast]);

  const addTrackToPlaylist = useCallback((playlistId, track) => {
    if (!track) return;
    setPlaylists(prev => {
      const updated = prev.map(pl => {
        if (pl.id === playlistId) {
          const currentTracks = pl.tracks || [];
          if (currentTracks.some(t => t.id === track.id)) {
            showToast(`"${track.title}" is already in "${pl.name}"`, 'info');
            return pl;
          }
          showToast(`Added "${track.title}" to "${pl.name}"`, 'success');
          const mod = refreshSpotifyPlaylistCounts({
            ...pl,
            tracks: [...currentTracks, track]
          });
          if (user) supabaseService.savePlaylist(mod, user.id);
          return mod;
        }
        return pl;
      });
      const ownerId = user?.id || 'guest';
      storage.savePlaylists(updated, ownerId);
      if (ownerId === 'guest') offlineStorage.setPlaylists(updated);
      return updated;
    });
  }, [user, showToast]);

  const removeTrackFromPlaylist = useCallback((playlistId, trackId) => {
    setPlaylists(prev => {
      const updated = prev.map(pl => {
        if (pl.id === playlistId) {
          const mod = refreshSpotifyPlaylistCounts({
            ...pl,
            tracks: (pl.tracks || []).filter(t => t.id !== trackId)
          });
          if (user) supabaseService.savePlaylist(mod, user.id);
          return mod;
        }
        return pl;
      });
      const ownerId = user?.id || 'guest';
      storage.savePlaylists(updated, ownerId);
      if (ownerId === 'guest') offlineStorage.setPlaylists(updated);
      return updated;
    });
    showToast('Removed track from playlist', 'info');
  }, [user, showToast]);

  // Recently Played Management
  const addToRecent = useCallback((track) => {
    if (!track || !track.id) return;
    const historyUserId = user?.id || 'guest';
    const baseHistory = libraryOwnerId === historyUserId ? recentlyPlayed : storage.getRecentlyPlayed(historyUserId);
    setLibraryOwnerId(historyUserId);
    setRecentlyPlayed(prev => {
      const source = libraryOwnerId === historyUserId ? prev : baseHistory;
      const filtered = source.filter(t => t.id !== track.id);
      const updated = [track, ...filtered].slice(0, 30);
      storage.saveRecentlyPlayed(updated, historyUserId);
      if (historyUserId === 'guest') offlineStorage.setHistory(updated);
      return updated;
    });
  }, [user, libraryOwnerId, recentlyPlayed]);

  const clearRecentlyPlayed = useCallback(() => {
    const historyUserId = user?.id || 'guest';
    setRecentlyPlayed([]);
    setLibraryOwnerId(historyUserId);
    storage.saveRecentlyPlayed([], historyUserId);
    if (historyUserId === 'guest') offlineStorage.setHistory([]);
    else supabaseService.clearHistory(historyUserId);
    showToast('Listening history cleared', 'info');
  }, [user, showToast]);

  // Settings Management
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      storage.saveSettings(updated);
      return updated;
    });
    showToast('Settings saved', 'success');
  }, [showToast]);

  // User Music Preferences Management
  const savePreferences = useCallback(async (newPrefs) => {
    setUserPreferences(newPrefs);
    const userId = user?.id || 'guest';
    await supabaseService.saveUserPreferences(userId, newPrefs);
  }, [user]);

  // Auth Sign Out
  const signOut = useCallback(async () => {
    try {
      await supabaseService.signOut();
      setUser(null);
      showToast('Signed out successfully', 'info');
    } catch (err) {
      showToast('Failed to sign out', 'error');
    }
  }, [showToast]);

  return (
    <LibraryContext.Provider
      value={{
        user,
        signOut,
        isSupabaseConfigured,
        likedSongs,
        playlists,
        recentlyPlayed,
        libraryOwnerId,
        settings,
        userPreferences,
        saveUserPreferences: savePreferences,
        isInterestPickerOpen,
        setIsInterestPickerOpen,
        openInterestPicker: () => setIsInterestPickerOpen(true),
        toasts,
        showToast,
        removeToast,
        isLiked,
        toggleLike,
        createPlaylist,
        importSpotifyPlaylist,
        updatePlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        addToRecent,
        clearRecentlyPlayed,
        updateSettings
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
