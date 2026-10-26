// Local storage helper for persisting library, playlists, and settings

const KEYS = {
  LIKED_SONGS: 'noir_liked_songs',
  PLAYLISTS: 'noir_playlists',
  RECENTLY_PLAYED: 'noir_recently_played',
  SETTINGS: 'noir_settings',
  QUEUE: 'noir_saved_queue'
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
  }
};
