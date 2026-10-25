import React, { createContext, useContext, useState, useCallback } from 'react';
import { storage } from '../services/storage';

const LibraryContext = createContext();

export function LibraryProvider({ children }) {
  const [likedSongs, setLikedSongs] = useState(() => storage.getLikedSongs());
  const [playlists, setPlaylists] = useState(() => storage.getPlaylists());
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => storage.getRecentlyPlayed());
  const [settings, setSettings] = useState(() => storage.getSettings());
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
      return updated;
    });
  }, [showToast]);

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
      return updated;
    });

    showToast(`Created playlist "${newPlaylist.name}"`, 'success');
    return newPlaylist;
  }, [playlists.length, showToast]);

  const updatePlaylist = useCallback((id, updates) => {
    setPlaylists(prev => {
      const updated = prev.map(pl => pl.id === id ? { ...pl, ...updates } : pl);
      storage.savePlaylists(updated);
      return updated;
    });
    showToast('Playlist updated', 'success');
  }, [showToast]);

  const deletePlaylist = useCallback((id) => {
    setPlaylists(prev => {
      const target = prev.find(p => p.id === id);
      const updated = prev.filter(pl => pl.id !== id);
      storage.savePlaylists(updated);
      if (target) showToast(`Deleted playlist "${target.name}"`, 'info');
      return updated;
    });
  }, [showToast]);

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
          return {
            ...pl,
            tracks: [...currentTracks, track]
          };
        }
        return pl;
      });
      storage.savePlaylists(updated);
      return updated;
    });
  }, [showToast]);

  const removeTrackFromPlaylist = useCallback((playlistId, trackId) => {
    setPlaylists(prev => {
      const updated = prev.map(pl => {
        if (pl.id === playlistId) {
          return {
            ...pl,
            tracks: (pl.tracks || []).filter(t => t.id !== trackId)
          };
        }
        return pl;
      });
      storage.savePlaylists(updated);
      return updated;
    });
    showToast('Removed track from playlist', 'info');
  }, [showToast]);

  // Recently Played Management
  const addToRecent = useCallback((track) => {
    if (!track || !track.id) return;
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      const updated = [track, ...filtered].slice(0, 30);
      storage.saveRecentlyPlayed(updated);
      return updated;
    });
  }, []);

  // Settings Management
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      storage.saveSettings(updated);
      return updated;
    });
    showToast('Settings saved', 'success');
  }, [showToast]);

  return (
    <LibraryContext.Provider
      value={{
        likedSongs,
        playlists,
        recentlyPlayed,
        settings,
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
