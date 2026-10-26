/**
 * Supabase Audio Storage Service for NOIR
 *
 * Allows users to stream their own audio files (MP3, M4A, FLAC, WAV) stored in
 * their personal Supabase Storage bucket ('tracks').
 * Uses direct HTML5 Audio streaming with HTTP 206 byte-range seeking.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const DEFAULT_BUCKET = 'tracks';
const DEFAULT_AUDIO_COVER = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80';

export const supabaseAudioService = {
  isConfigured() {
    return isSupabaseConfigured && Boolean(supabase);
  },

  /**
   * Lists audio files in user's Supabase Storage bucket
   */
  async listTracks(bucketName = DEFAULT_BUCKET) {
    if (!this.isConfigured()) return [];

    try {
      const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list('', {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        console.warn('[SupabaseAudio] Failed to list storage tracks:', error.message);
        return [];
      }

      const audioExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac'];
      const audioFiles = (files || []).filter(f => 
        f.name && audioExtensions.some(ext => f.name.toLowerCase().endsWith(ext))
      );

      return audioFiles.map((file, index) => {
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(file.name);

        // Derive artist and title from file name e.g. "Artist - Title.mp3"
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        let artist = 'My Library';
        let title = cleanName;

        if (cleanName.includes(' - ')) {
          const parts = cleanName.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        const estDuration = file.metadata?.duration || 210;

        return {
          id: `supabase-${file.id || index}-${encodeURIComponent(file.name)}`,
          rawId: file.id || file.name,
          title,
          artist,
          album: 'Cloud Storage',
          thumbnail: DEFAULT_AUDIO_COVER,
          duration: estDuration,
          durationFormatted: formatTime(estDuration),
          streamUrl: publicUrl,
          source: 'supabase',
          fileSize: file.metadata?.size || file.size || 0,
          isStreamable: true
        };
      });
    } catch (err) {
      console.warn('[SupabaseAudio] Storage read error:', err?.message || err);
      return [];
    }
  },

  /**
   * Upload an audio file to Supabase Storage
   */
  async uploadTrack(file, bucketName = DEFAULT_BUCKET) {
    if (!this.isConfigured()) throw new Error('Supabase is not configured.');
    if (!file) throw new Error('No file provided.');

    const filePath = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;
    return data;
  }
};
