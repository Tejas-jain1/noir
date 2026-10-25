/**
 * IndexedDB Offline Storage Service for NOIR
 * Provides persistent offline database for Liked Songs, Playlists, and Listening History.
 * Automatically falls back to localStorage if IndexedDB is not supported.
 */

const DB_NAME = 'noir_offline_db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('liked_songs')) {
        db.createObjectStore('liked_songs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTx(storeName, mode, callback) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);

      tx.oncomplete = () => {
        resolve(request ? request.result : true);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.debug(`[offlineStorage] IndexedDB tx failed on ${storeName}:`, err);
    return null;
  }
}

export const offlineStorage = {
  // Liked Songs
  async getLikedSongs() {
    const res = await runTx('liked_songs', 'readonly', (store) => store.getAll());
    if (Array.isArray(res)) return res;
    try {
      const fallback = localStorage.getItem('noir_liked_songs');
      return fallback ? JSON.parse(fallback) : [];
    } catch {
      return [];
    }
  },

  async setLikedSongs(songs) {
    await runTx('liked_songs', 'readwrite', (store) => {
      store.clear();
      songs.forEach((song) => store.put(song));
    });
    try {
      localStorage.setItem('noir_liked_songs', JSON.stringify(songs));
    } catch {}
  },

  // Playlists
  async getPlaylists() {
    const res = await runTx('playlists', 'readonly', (store) => store.getAll());
    if (Array.isArray(res)) return res;
    try {
      const fallback = localStorage.getItem('noir_playlists');
      return fallback ? JSON.parse(fallback) : [];
    } catch {
      return [];
    }
  },

  async setPlaylists(playlists) {
    await runTx('playlists', 'readwrite', (store) => {
      store.clear();
      playlists.forEach((pl) => store.put(pl));
    });
    try {
      localStorage.setItem('noir_playlists', JSON.stringify(playlists));
    } catch {}
  },

  // Listening History
  async getHistory() {
    const res = await runTx('history', 'readonly', (store) => store.getAll());
    if (Array.isArray(res)) return res;
    try {
      const fallback = localStorage.getItem('noir_recently_played');
      return fallback ? JSON.parse(fallback) : [];
    } catch {
      return [];
    }
  },

  async setHistory(history) {
    await runTx('history', 'readwrite', (store) => {
      store.clear();
      history.forEach((h) => store.put(h));
    });
    try {
      localStorage.setItem('noir_recently_played', JSON.stringify(history));
    } catch {}
  }
};
