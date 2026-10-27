// Local storage helper for persisting library, playlists, settings, recent searches, and user preferences

const KEYS = {
  LIKED_SONGS: 'noir_liked_songs',
  PLAYLISTS: 'noir_playlists',
  RECENTLY_PLAYED: 'noir_recently_played',
  SETTINGS: 'noir_settings',
  QUEUE: 'noir_saved_queue',
  RECENT_SEARCHES: 'noir_recent_searches',
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
      return data ? JSON.parse(data) : [];
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
