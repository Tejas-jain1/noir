/**
 * Media Session API Service for NOIR
 * Provides OS-level lock screen, headphone, and keyboard media controls
 * Works across desktop (Windows, macOS, Linux) and mobile (Android, iOS Safari).
 */

export function isMediaSessionSupported() {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

export function updateMediaSessionMetadata(track) {
  if (!isMediaSessionSupported() || !track) return;

  const artwork = [];
  if (track.thumbnail) {
    try {
      const src = typeof track.thumbnail === 'string' && track.thumbnail.startsWith('http')
        ? track.thumbnail
        : (typeof window !== 'undefined' && track.thumbnail ? new URL(track.thumbnail, window.location.origin).href : '');

      if (src) {
        artwork.push(
          { src, sizes: '96x96' },
          { src, sizes: '128x128' },
          { src, sizes: '192x192' },
          { src, sizes: '256x256' },
          { src, sizes: '384x384' },
          { src, sizes: '512x512' }
        );
      }
    } catch {
      // Ignore artwork URL parse errors
    }
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Untitled Track',
      artist: track.artist || 'NOIR Soundscape',
      album: track.album || 'NOIR',
      artwork
    });
  } catch (err) {
    console.debug('[MediaSession] Metadata update error:', err);
  }
}

export function setMediaSessionActionHandlers(handlers = {}) {
  if (!isMediaSessionSupported()) return;

  const actions = [
    ['play', handlers.play],
    ['pause', handlers.pause],
    ['stop', handlers.stop],
    ['previoustrack', handlers.previousTrack],
    ['nexttrack', handlers.nextTrack],
    ['seekto', handlers.seekTo],
    ['seekbackward', handlers.seekBackward],
    ['seekforward', handlers.seekForward]
  ];

  for (const [action, handler] of actions) {
    try {
      if (typeof handler === 'function') {
        navigator.mediaSession.setActionHandler(action, handler);
      } else {
        navigator.mediaSession.setActionHandler(action, null);
      }
    } catch {
      // Action might not be supported on all browser engines — ignore safely
    }
  }
}

export function setMediaSessionPlaybackState(state) {
  if (!isMediaSessionSupported()) return;
  try {
    if (navigator.mediaSession.playbackState !== state) {
      navigator.mediaSession.playbackState = state; // 'playing' | 'paused' | 'none'
    }
  } catch {
    // Ignore
  }
}

export function updateMediaSessionPositionState({ duration = 0, position = 0, playbackRate = 1 }) {
  if (!isMediaSessionSupported() || !('setPositionState' in navigator.mediaSession)) return;

  try {
    const validDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    if (validDuration > 0) {
      const validPosition = Number.isFinite(position)
        ? Math.max(0, Math.min(validDuration, position))
        : 0;
      navigator.mediaSession.setPositionState({
        duration: validDuration,
        position: validPosition,
        playbackRate: playbackRate > 0 ? playbackRate : 1
      });
    }
  } catch (err) {
    // Chromium throws TypeError if position > duration or playbackState is 'none'
    console.debug('[MediaSession] setPositionState ignored:', err);
  }
}
