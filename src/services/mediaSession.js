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

  const artwork = track.thumbnail
    ? [
        { src: track.thumbnail, sizes: '96x96', type: 'image/jpeg' },
        { src: track.thumbnail, sizes: '128x128', type: 'image/jpeg' },
        { src: track.thumbnail, sizes: '192x192', type: 'image/jpeg' },
        { src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
        { src: track.thumbnail, sizes: '384x384', type: 'image/jpeg' },
        { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }
      ]
    : [];

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
    ['previoustrack', handlers.previousTrack],
    ['nexttrack', handlers.nextTrack],
    ['seekto', handlers.seekTo],
    ['seekbackward', handlers.seekBackward],
    ['seekforward', handlers.seekForward]
  ];

  for (const [action, handler] of actions) {
    try {
      if (handler) {
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
    navigator.mediaSession.playbackState = state; // 'playing' | 'paused' | 'none'
  } catch {
    // Ignore
  }
}

export function updateMediaSessionPositionState({ duration = 0, position = 0, playbackRate = 1 }) {
  if (!isMediaSessionSupported() || !('setPositionState' in navigator.mediaSession)) return;

  try {
    const validDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    if (validDuration > 0) {
      const validPosition = Number.isFinite(position) ? Math.max(0, Math.min(validDuration, position)) : 0;
      navigator.mediaSession.setPositionState({
        duration: validDuration,
        position: validPosition,
        playbackRate: playbackRate > 0 ? playbackRate : 1
      });
    }
  } catch {
    // Position state might throw if position > duration during seek transitions
  }
}
