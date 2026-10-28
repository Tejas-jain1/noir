/**
 * Supabase Client & Backend Sync for NOIR
 * Connects to user's personal Supabase database for authentication, playlists, liked songs, listening history, and user preferences.
 * Operates in dual-mode: when credentials are not configured, gracefully falls back to IndexedDB/localStorage.
 */
import { createClient } from '@supabase/supabase-js';
import { offlineStorage } from './offlineStorage';
import { storage } from './storage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ucqaqzyhuukdeqcpzonp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_w-nXagqf0mv8AHUed9K-9A_JA-5M1Np';

const _configured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder')
);

export const isSupabaseConfigured = () => _configured;

export const supabase = _configured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

export const supabaseService = {
  isConfigured: _configured,

  // Auth APIs
  async getCurrentUser() {
    if (!supabase) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user || null;
    } catch {
      return null;
    }
  },

  async signUp(email, password, displayName = '') {
    if (!supabase) throw new Error('Supabase is not configured. Please add your credentials in Settings.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase is not configured. Please add your credentials in Settings.');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signInWithGoogle() {
    if (!supabase) throw new Error('Supabase is not configured. Please add your credentials in Settings.');
    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo
      }
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  onAuthStateChange(callback) {
    if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
    return supabase.auth.onAuthStateChange(callback);
  },

  // Playlists Cloud Sync
  async loadPlaylists(userId) {
    if (!userId) return await offlineStorage.getPlaylists();
    if (!supabase) return storage.getPlaylists(userId);

    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('*, playlist_tracks(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped = data.map((pl) => ({
          id: pl.id,
          name: pl.name,
          description: pl.description || '',
          coverUrl: pl.cover_url || null,
          createdAt: pl.created_at,
          tracks: (pl.playlist_tracks || [])
            .sort((a, b) => a.position - b.position)
            .map((t) => ({
              id: t.track_id,
              title: t.title,
              artist: t.artist,
              thumbnail: t.artwork,
              duration: t.duration,
              durationFormatted: t.duration ? `${Math.floor(t.duration / 60)}:${String(t.duration % 60).padStart(2, '0')}` : '3:30'
            }))
        }));
        storage.savePlaylists(mapped, userId);
        if (userId === 'guest') await offlineStorage.setPlaylists(mapped);
        return mapped;
      }
      return storage.getPlaylists(userId);
    } catch (err) {
      console.warn('[Supabase] Failed to fetch account playlists, using that account\'s local cache:', err);
      return storage.getPlaylists(userId);
    }
  },

  async savePlaylist(playlist, userId) {
    if (!supabase || !userId) {
      return;
    }

    try {
      await supabase.from('playlists').upsert({
        id: playlist.id,
        user_id: userId,
        name: playlist.name,
        description: playlist.description || '',
        cover_url: playlist.coverUrl || null,
        created_at: playlist.createdAt || new Date().toISOString()
      });

      if (Array.isArray(playlist.tracks)) {
        await supabase.from('playlist_tracks').delete().eq('playlist_id', playlist.id);
        if (playlist.tracks.length > 0) {
          const rows = playlist.tracks.map((t, idx) => ({
            playlist_id: playlist.id,
            track_id: t.id,
            position: idx,
            title: t.title || '',
            artist: t.artist || '',
            artwork: t.thumbnail || '',
            duration: t.duration || 0
          }));
          await supabase.from('playlist_tracks').insert(rows);
        }
      }
    } catch (err) {
      console.warn('[Supabase] Failed to save cloud playlist:', err);
    }
  },

  async deletePlaylist(playlistId, userId) {
    if (!supabase || !userId) return;
    try {
      await supabase.from('playlists').delete().eq('id', playlistId).eq('user_id', userId);
    } catch (err) {
      console.warn('[Supabase] Failed to delete cloud playlist:', err);
    }
  },

  // Liked Tracks Cloud Sync
  async loadLikedSongs(userId) {
    if (!userId) return await offlineStorage.getLikedSongs();
    if (!supabase) return storage.getLikedSongs(userId);

    try {
      const { data, error } = await supabase
        .from('liked_tracks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped = data.map((t) => ({
          id: t.track_id,
          title: t.title,
          artist: t.artist,
          thumbnail: t.artwork,
          duration: t.duration,
          durationFormatted: t.duration ? `${Math.floor(t.duration / 60)}:${String(t.duration % 60).padStart(2, '0')}` : '3:30'
        }));
        storage.saveLikedSongs(mapped, userId);
        if (userId === 'guest') await offlineStorage.setLikedSongs(mapped);
        return mapped;
      }
      return storage.getLikedSongs(userId);
    } catch (err) {
      console.warn('[Supabase] Failed to load account liked tracks, using that account\'s local cache:', err);
      return storage.getLikedSongs(userId);
    }
  },

  async toggleLikeTrack(track, isLiked, userId) {
    if (!supabase || !userId) return;
    try {
      if (isLiked) {
        await supabase.from('liked_tracks').upsert({
          user_id: userId,
          track_id: track.id,
          title: track.title || '',
          artist: track.artist || '',
          artwork: track.thumbnail || '',
          duration: track.duration || 0
        });
      } else {
        await supabase.from('liked_tracks').delete().eq('user_id', userId).eq('track_id', track.id);
      }
    } catch (err) {
      console.warn('[Supabase] Failed to toggle cloud like:', err);
    }
  },

  // Listening History Cloud Sync
  async recordHistory(track, userId) {
    if (!supabase || !userId || !track) return;
    try {
      await supabase.from('listening_history').insert({
        user_id: userId,
        track_id: track.id,
        title: track.title || '',
        artist: track.artist || '',
        artwork: track.thumbnail || '',
        duration: track.duration || 0,
        played_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[Supabase] Failed to log listening history:', err);
    }
  },

  async loadHistory(userId) {
    if (!userId) return storage.getRecentlyPlayed('guest');
    if (!supabase) return storage.getRecentlyPlayed(userId);

    try {
      const { data, error } = await supabase
        .from('listening_history')
        .select('track_id, title, artist, artwork, duration, played_at')
        .eq('user_id', userId)
        .order('played_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      const tracks = (data || []).map(item => ({
        id: item.track_id,
        title: item.title || '',
        artist: item.artist || '',
        thumbnail: item.artwork || '',
        duration: item.duration || 0,
        durationFormatted: item.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : '3:30',
        playedAt: item.played_at || ''
      })).filter(track => track.id && track.title);

      storage.saveRecentlyPlayed(tracks, userId);
      return tracks;
    } catch (err) {
      console.warn('[Supabase] Failed to fetch account listening history, using that account\'s local cache:', err);
      return storage.getRecentlyPlayed(userId);
    }
  },

  async clearHistory(userId) {
    if (!supabase || !userId) return;
    try {
      const { error } = await supabase.from('listening_history').delete().eq('user_id', userId);
      if (error) throw error;
    } catch (err) {
      console.warn('[Supabase] Failed to clear account listening history:', err);
    }
  },

  // User Preferences Cloud Sync
  async loadUserPreferences(userId) {
    // 1. Check local storage first for fast response
    const local = storage.getUserPreferences(userId, false);
    if (!supabase || !userId) return local;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        const prefs = {
          genres: data.genres || [],
          artists: data.artists || [],
          onboarding_completed: Boolean(data.onboarding_completed),
          updated_at: data.updated_at
        };
        storage.saveUserPreferences(userId, prefs);
        return prefs;
      }
    } catch (err) {
      console.warn('[Supabase] Failed to load user preferences, using local store:', err);
    }
    return local;
  },

  async saveUserPreferences(userId, preferences) {
    if (!preferences) return;
    // Always persist to local storage
    storage.saveUserPreferences(userId, preferences);

    if (!supabase || !userId) return;

    try {
      await supabase.from('user_preferences').upsert({
        user_id: userId,
        genres: preferences.genres || [],
        artists: preferences.artists || [],
        onboarding_completed: Boolean(preferences.onboarding_completed),
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[Supabase] Failed to save user preferences to cloud:', err);
    }
  }
};
