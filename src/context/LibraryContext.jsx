import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { offlineStorage } from '../services/offlineStorage';
import { supabaseService, isSupabaseConfigured } from '../services/supabaseClient';
import { notifyAdminOnAuth } from '../services/adminNotification';

const LibraryContext = createContext();

export function LibraryProvider({ children }) {
  const [user, setUser] = useState(null);
  const [likedSongs, setLikedSongs] = useState(() => storage.getLikedSongs());
  const [playlists, setPlaylists] = useState(() => storage.getPlaylists());
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => storage.getRecentlyPlayed());
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
    // 1. Initial hydration from IndexedDB
    offlineStorage.getLikedSongs().then(cached => {
      if (Array.isArray(cached) && cached.length > 0) setLikedSongs(cached);
    });
    offlineStorage.getPlaylists().then(cached => {
      if (Array.isArray(cached) && cached.length > 0) setPlaylists(cached);
    });
    offlineStorage.getHistory().then(cached => {
      if (Array.isArray(cached) && cached.length > 0) {
        const legacyIds = new Set(['4NRXx6U8ABQ', 'Th4EkOPb2qY', '5NV6Rdv1a3I', 'H5v3kku4y6Q', 'd5gxZ5r0qSY']);
        const sanitized = cached.filter(t => 
          t && t.id && 
          !legacyIds.has(t.id) && 
          t.title !== 'Blinding Lights' && 
          t.title !== 'Get Lucky'
        );
        setRecentlyPlayed(sanitized);
        if (sanitized.length !== cached.length) {
          offlineStorage.setHistory(sanitized);
        }
      }
    });

    // 2. Supabase Auth state observer
    supabaseService.getCurrentUser().then(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        supabaseService.loadLikedSongs(currentUser.id).then(setLikedSongs);
        supabaseService.loadPlaylists(currentUser.id).then(setPlaylists);
        const prefs = await supabaseService.loadUserPreferences(currentUser.id);
        setUserPreferences(prefs);
        if (!prefs || !prefs.onboarding_completed) {
          setIsInterestPickerOpen(true);
        }
      }
    });

    const { data: { subscription } } = supabaseService.onAuthStateChange(async (_event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        if (_event === 'SIGNED_IN') {
          notifyAdminOnAuth(u, 'Signed In');
        }
        const cloudLikes = await supabaseService.loadLikedSongs(u.id);
        const cloudPlaylists = await supabaseService.loadPlaylists(u.id);
        const cloudPrefs = await supabaseService.loadUserPreferences(u.id);
        setLikedSongs(cloudLikes);
        setPlaylists(cloudPlaylists);
        setUserPreferences(cloudPrefs);

        // Prompt new user for music interests if not completed
        if (!cloudPrefs || !cloudPrefs.onboarding_completed) {
          setIsInterestPickerOpen(true);
        }

        showToast(`Signed in as ${u.email}`, 'success');
      } else {
        const offlineLikes = await offlineStorage.getLikedSongs();
        const offlinePls = await offlineStorage.getPlaylists();
        setLikedSongs(offlineLikes);
        setPlaylists(offlinePls);
        const guestPrefs = storage.getUserPreferences('guest');
        setUserPreferences(guestPrefs);
      }
    });

    return () => {
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
      storage.saveLikedSongs(updated);
      offlineStorage.setLikedSongs(updated);

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
      storage.savePlaylists(updated);
      offlineStorage.setPlaylists(updated);

      if (user) {
        supabaseService.savePlaylist(newPlaylist, user.id);
      }

      return updated;
    });

    showToast(`Created playlist "${newPlaylist.name}"`, 'success');
    return newPlaylist;
  }, [playlists.length, user, showToast]);

  const updatePlaylist = useCallback((id, updates) => {
    setPlaylists(prev => {
      const updated = prev.map(pl => {
        if (pl.id === id) {
          const mod = { ...pl, ...updates };
          if (user) supabaseService.savePlaylist(mod, user.id);
          return mod;
        }
        return pl;
      });
      storage.savePlaylists(updated);
      offlineStorage.setPlaylists(updated);
      return updated;
    });
    showToast('Playlist updated', 'success');
  }, [user, showToast]);

  const deletePlaylist = useCallback((id) => {
    setPlaylists(prev => {
      const target = prev.find(p => p.id === id);
      const updated = prev.filter(pl => pl.id !== id);
      storage.savePlaylists(updated);
      offlineStorage.setPlaylists(updated);
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
          const mod = {
            ...pl,
            tracks: [...currentTracks, track]
          };
          if (user) supabaseService.savePlaylist(mod, user.id);
          return mod;
        }
        return pl;
      });
      storage.savePlaylists(updated);
      offlineStorage.setPlaylists(updated);
      return updated;
    });
  }, [user, showToast]);

  const removeTrackFromPlaylist = useCallback((playlistId, trackId) => {
    setPlaylists(prev => {
      const updated = prev.map(pl => {
        if (pl.id === playlistId) {
          const mod = {
            ...pl,
            tracks: (pl.tracks || []).filter(t => t.id !== trackId)
          };
          if (user) supabaseService.savePlaylist(mod, user.id);
          return mod;
        }
        return pl;
      });
      storage.savePlaylists(updated);
      offlineStorage.setPlaylists(updated);
      return updated;
    });
    showToast('Removed track from playlist', 'info');
  }, [user, showToast]);

  // Recently Played Management
  const addToRecent = useCallback((track) => {
    if (!track || !track.id) return;
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      const updated = [track, ...filtered].slice(0, 30);
      storage.saveRecentlyPlayed(updated);
      offlineStorage.setHistory(updated);
      return updated;
    });
  }, []);

  const clearRecentlyPlayed = useCallback(() => {
    setRecentlyPlayed([]);
    storage.saveRecentlyPlayed([]);
    offlineStorage.setHistory([]);
    showToast('Listening history cleared', 'info');
  }, [showToast]);

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
