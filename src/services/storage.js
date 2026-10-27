// Local storage helper for persisting library, playlists, settings, recent searches, and user preferences

const KEYS = {
  LIKED_SONGS: 'noir_liked_songs',
  PLAYLISTS: 'noir_playlists',
  RECENTLY_PLAYED: 'noir_recently_played',
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
  getLikedSongs: () => {
    try {
      const data = localStorage.getItem(KEYS.LIKED_SONGS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading liked songs from localStorage', e);
      return [];
    }
  },

  saveLikedSongs: (songs) => {
    try {
      localStorage.setItem(KEYS.LIKED_SONGS, JSON.stringify(songs));
    } catch (e) {
      console.error('Error saving liked songs', e);
    }
  },

  getPlaylists: () => {
    try {
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

  savePlaylists: (playlists) => {
    try {
      localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch (e) {
      console.error('Error saving playlists', e);
    }
  },

  getRecentlyPlayed: () => {
    try {
      const data = localStorage.getItem(KEYS.RECENTLY_PLAYED);
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
        localStorage.setItem(KEYS.RECENTLY_PLAYED, JSON.stringify(sanitized));
      }
      return sanitized;
    } catch (e) {
      console.error('Error reading recently played', e);
      return [];
    }
  },

  saveRecentlyPlayed: (tracks) => {
    try {
      localStorage.setItem(KEYS.RECENTLY_PLAYED, JSON.stringify(tracks));
    } catch (e) {
      console.error('Error saving recently played', e);
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
  getUserPreferences: (userId = 'guest') => {
    try {
      const key = `${KEYS.USER_PREFERENCES}_${userId}`;
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
      // Fallback to guest preferences if specific user not found yet
      if (userId !== 'guest') {
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
      if (userId !== 'guest') {
        // Also keep sync in guest key so it persists across logouts if needed
        localStorage.setItem(`${KEYS.USER_PREFERENCES}_guest`, JSON.stringify(preferences));
      }
    } catch (e) {
      console.error('Error saving user preferences', e);
    }
  }
};
