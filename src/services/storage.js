// Local storage helper for persisting library, playlists, settings, recent searches, and user preferences

const KEYS = {
  LIKED_SONGS: 'noir_liked_songs',
  PLAYLISTS: 'noir_playlists',
  RECENTLY_PLAYED: 'noir_recently_played',
  SKIPPED_TRACKS: 'noir_skipped_tracks',
  AUTOPLAY: 'noir_autoplay_enabled',
  SETTINGS: 'noir_settings',
  QUEUE: 'noir_saved_queue',
  RECENT_SEARCHES: 'noir_recent_searches',
  RECENT_SEARCH_TRACKS: 'noir_recent_search_tracks',
  USER_PREFERENCES: 'noir_user_preferences'
};

const DEFAULT_PLAYLISTS = [
  {
    id: 'pl-monochrome-focus',
    name: 'Monochrome Focus',
    description: 'Deep focus soundscapes, lo-fi beats, and instrumental cadence.',
    createdAt: new Date().toISOString(),
    trackIds: ['jfKfPfyJRdk', 'RxabLA7UQ9k', 'wXhTHyIgQ_U']
  },
  {
    id: 'pl-midnight-groove',
    name: 'Midnight Groove',
    description: 'Late night pop, synthwave, and rhythm for evening drives.',
    createdAt: new Date().toISOString(),
    trackIds: ['4NRXx6U8ABQ', 'Th4EkOPb2qY', '5NV6Rdv1a3I', 'H5v3kku4y6Q']
  },
  {
    id: 'pl-timeless-anthems',
    name: 'Timeless Anthems',
    description: 'Iconic records that defined generations of music history.',
    createdAt: new Date().toISOString(),
    trackIds: ['fJ9rUzIMcZQ', 'Zi_XLOBDo_Y', 'dvgZkm1xWPE', 'bpOSxM0TFV8']
  }
];

export const storage = {
  getLikedSongs: (userId = 'guest') => {
    try {
      const scopedKey = `${KEYS.LIKED_SONGS}_${userId}`;
      const data = localStorage.getItem(scopedKey) || (userId === 'guest' ? localStorage.getItem(KEYS.LIKED_SONGS) : null);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading liked songs from localStorage', e);
      return [];
    }
  },

  saveLikedSongs: (songs, userId = 'guest') => {
    try {
      localStorage.setItem(`${KEYS.LIKED_SONGS}_${userId}`, JSON.stringify(songs));
      if (userId === 'guest') localStorage.setItem(KEYS.LIKED_SONGS, JSON.stringify(songs));
    } catch (e) {
      console.error('Error saving liked songs', e);
    }
  },

  getPlaylists: (userId = 'guest') => {
    try {
      if (userId !== 'guest') {
        const scoped = localStorage.getItem(`${KEYS.PLAYLISTS}_${userId}`);
        return scoped ? JSON.parse(scoped) : [];
      }
      const data = localStorage.getItem(KEYS.PLAYLISTS);
      if (!data) {
        // Initialize default playlists on first run
        localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(DEFAULT_PLAYLISTS));
        return DEFAULT_PLAYLISTS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading playlists', e);
      return DEFAULT_PLAYLISTS;
    }
  },

  savePlaylists: (playlists, userId = 'guest') => {
    try {
      localStorage.setItem(`${KEYS.PLAYLISTS}_${userId}`, JSON.stringify(playlists));
      if (userId === 'guest') localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch (e) {
      console.error('Error saving playlists', e);
    }
  },

  getRecentlyPlayed: (userId = 'guest') => {
    try {
      const scopedKey = `${KEYS.RECENTLY_PLAYED}_${userId}`;
      const data = localStorage.getItem(scopedKey) || (userId === 'guest' ? localStorage.getItem(KEYS.RECENTLY_PLAYED) : null);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // Automatically sanitize legacy mock songs (Blinding Lights, Get Lucky, etc.)
      const legacyIds = new Set(['4NRXx6U8ABQ', 'Th4EkOPb2qY', '5NV6Rdv1a3I', 'H5v3kku4y6Q', 'd5gxZ5r0qSY']);
      const sanitized = parsed.filter(t => 
        t && t.id && 
        !legacyIds.has(t.id) && 
        t.title !== 'Blinding Lights' && 
        t.title !== 'Get Lucky'
      );
      if (sanitized.length !== parsed.length) {
        localStorage.setItem(scopedKey, JSON.stringify(sanitized));
        if (userId === 'guest') localStorage.setItem(KEYS.RECENTLY_PLAYED, JSON.stringify(sanitized));
      }
      return sanitized;
    } catch (e) {
      console.error('Error reading recently played', e);
      return [];
    }
  },

  saveRecentlyPlayed: (tracks, userId = 'guest') => {
    try {
      localStorage.setItem(`${KEYS.RECENTLY_PLAYED}_${userId}`, JSON.stringify(tracks));
      if (userId === 'guest') localStorage.setItem(KEYS.RECENTLY_PLAYED, JSON.stringify(tracks));
    } catch (e) {
      console.error('Error saving recently played', e);
    }
  },

  getSkippedTracks: (userId = 'guest') => {
    try {
      const data = localStorage.getItem(`${KEYS.SKIPPED_TRACKS}_${userId}`);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  addSkippedTrack: (track, userId = 'guest') => {
    if (!track?.id) return [];
    const current = storage.getSkippedTracks(userId);
    const updated = [track, ...current.filter(item => item?.id !== track.id)].slice(0, 50);
    try {
      localStorage.setItem(`${KEYS.SKIPPED_TRACKS}_${userId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving skipped tracks', e);
    }
    return updated;
  },

  getAutoplayEnabled: (userId = 'guest') => {
    try {
      const value = localStorage.getItem(`${KEYS.AUTOPLAY}_${userId}`);
      return value === null ? true : value === 'true';
    } catch {
      return true;
    }
  },

  saveAutoplayEnabled: (enabled, userId = 'guest') => {
    try {
      localStorage.setItem(`${KEYS.AUTOPLAY}_${userId}`, String(Boolean(enabled)));
    } catch (e) {
      console.error('Error saving autoplay setting', e);
    }
  },

  getSettings: () => {
    try {
      const data = localStorage.getItem(KEYS.SETTINGS);
      return data ? JSON.parse(data) : {
        theme: 'dark',
        apiKey: '',
        volume: 75,
        videoEnabled: false
      };
    } catch {
      return { theme: 'dark', apiKey: '', volume: 75, videoEnabled: false };
    }
  },

  saveSettings: (settings) => {
    try {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings', e);
    }
  },

  // Recent Searches
  getRecentSearches: () => {
    try {
      const data = localStorage.getItem(KEYS.RECENT_SEARCHES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addRecentSearch: (query) => {
    if (!query || !query.trim()) return [];
    try {
      const current = storage.getRecentSearches();
      const filtered = current.filter(q => q.toLowerCase() !== query.trim().toLowerCase());
      const updated = [query.trim(), ...filtered].slice(0, 10);
      localStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error adding recent search', e);
      return [];
    }
  },

  removeRecentSearch: (query) => {
    try {
      const current = storage.getRecentSearches();
      const updated = current.filter(q => q !== query);
      localStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  },

  clearRecentSearches: () => {
    try {
      localStorage.removeItem(KEYS.RECENT_SEARCHES);
      return [];
    } catch {
      return [];
    }
  },

  // Recent Search Track Objects (Spotify style)
  getRecentSearchTracks: () => {
    try {
      const data = localStorage.getItem(KEYS.RECENT_SEARCH_TRACKS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Fallback to recently played tracks
      const played = storage.getRecentlyPlayed();
      return Array.isArray(played) ? played : [];
    } catch {
      return [];
    }
  },

  addRecentSearchTrack: (track) => {
    if (!track || !track.id) return [];
    try {
      const current = storage.getRecentSearchTracks();
      const filtered = current.filter(t => t.id !== track.id && t.title !== track.title);
      const updated = [track, ...filtered].slice(0, 20);
      localStorage.setItem(KEYS.RECENT_SEARCH_TRACKS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error adding recent search track', e);
      return [];
    }
  },

  removeRecentSearchTrack: (trackId) => {
    try {
      const current = storage.getRecentSearchTracks();
      const updated = current.filter(t => t.id !== trackId);
      localStorage.setItem(KEYS.RECENT_SEARCH_TRACKS, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  },

  clearRecentSearchTracks: () => {
    try {
      localStorage.removeItem(KEYS.RECENT_SEARCH_TRACKS);
      return [];
    } catch {
      return [];
    }
  },

  // User Preferences (Interests: genres, favorite artists, etc.)
  getUserPreferences: (userId = 'guest', fallbackToGuest = true) => {
    try {
      const key = `${KEYS.USER_PREFERENCES}_${userId}`;
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
      // Fallback to guest preferences if specific user not found yet
      if (userId !== 'guest' && fallbackToGuest) {
        const guestData = localStorage.getItem(`${KEYS.USER_PREFERENCES}_guest`);
        if (guestData) return JSON.parse(guestData);
      }
      return null;
    } catch {
      return null;
    }
  },

  saveUserPreferences: (userId = 'guest', preferences) => {
    try {
      const key = `${KEYS.USER_PREFERENCES}_${userId}`;
      localStorage.setItem(key, JSON.stringify(preferences));
    } catch (e) {
      console.error('Error saving user preferences', e);
    }
  }
};
