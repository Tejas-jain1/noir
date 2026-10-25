import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLibrary } from './LibraryContext';
import { MOCK_TRACKS } from '../services/mockCatalog';

const PlayerContext = createContext();

// YouTube IFrame Player API State Enums
const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5
};

// Continuous silent audio data URI for mobile background wake-lock bridge
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export function PlayerProvider({ children }) {
  const { addToRecent, showToast } = useLibrary();

  // Playback state
  const [currentTrack, setCurrentTrack] = useState(() => MOCK_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(MOCK_TRACKS[0]?.duration || 200);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('all'); // 'off' | 'all' | 'one'
  const [queue, setQueue] = useState(() => MOCK_TRACKS.slice(0, 10));
  const [queueIndex, setQueueIndex] = useState(0);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);

  // References
  const ytPlayerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const silentAudioRef = useRef(null);
  const stateRef = useRef({ currentTrack, queue, queueIndex, repeatMode, shuffle, isPlaying });
  const nextTrackRef = useRef(null);
  const prevTrackRef = useRef(null);
  const togglePlayRef = useRef(null);
  const seekToRef = useRef(null);

  // Keep stateRef updated for callbacks
  useEffect(() => {
    stateRef.current = { currentTrack, queue, queueIndex, repeatMode, shuffle, isPlaying };
  }, [currentTrack, queue, queueIndex, repeatMode, shuffle, isPlaying]);

  // Initialize background audio heartbeat bridge
  useEffect(() => {
    const audio = new Audio(SILENT_AUDIO_URI);
    audio.loop = true;
    audio.preload = 'auto';
    silentAudioRef.current = audio;

    return () => {
      try {
        audio.pause();
        audio.src = '';
      } catch {}
    };
  }, []);

  // Helper to start/stop silent audio wake bridge
  const syncAudioBridge = useCallback((playing) => {
    if (!silentAudioRef.current) return;
    if (playing) {
      silentAudioRef.current.play().catch(() => {
        // Autoplay policy: will start on next user gesture
      });
    } else {
      silentAudioRef.current.pause();
    }
  }, []);

  // Core Play Track Function
  const playTrack = useCallback((track, newQueue = null) => {
    if (!track || !track.id) return;

    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 200);
    addToRecent(track);
    syncAudioBridge(true);

    if (newQueue && Array.isArray(newQueue)) {
      setQueue(newQueue);
      const index = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(index !== -1 ? index : 0);
    } else {
      setQueue(prev => {
        const existingIdx = prev.findIndex(t => t.id === track.id);
        if (existingIdx !== -1) {
          setQueueIndex(existingIdx);
          return prev;
        }
        setQueueIndex(prev.length);
        return [...prev, track];
      });
    }

    if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
      try {
        ytPlayerRef.current.loadVideoById(track.id);
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      } catch (err) {
        console.error('Failed to load video in YouTube player:', err);
      }
    } else {
      setIsPlaying(true);
    }
  }, [addToRecent, syncAudioBridge]);

  // Next Track Logic
  const nextTrack = useCallback(() => {
    const { queue, queueIndex, shuffle, repeatMode } = stateRef.current;
    if (!queue || queue.length === 0) return;

    let nextIndex;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
      if (queue.length > 1 && nextIndex === queueIndex) {
        nextIndex = (nextIndex + 1) % queue.length;
      }
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          setIsPlaying(false);
          syncAudioBridge(false);
          return;
        }
      }
    }

    const next = queue[nextIndex];
    if (next) {
      setQueueIndex(nextIndex);
      playTrack(next);
    }
  }, [playTrack, syncAudioBridge]);

  // Previous Track Logic
  const prevTrack = useCallback(() => {
    if (currentTime > 3) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        ytPlayerRef.current.seekTo(0, true);
        setCurrentTime(0);
      }
      return;
    }

    const { queue, queueIndex } = stateRef.current;
    if (!queue || queue.length === 0) return;

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    const prev = queue[prevIndex];
    if (prev) {
      setQueueIndex(prevIndex);
      playTrack(prev);
    }
  }, [currentTime, playTrack]);

  // Seek Function
  const seekTo = useCallback((seconds) => {
    setCurrentTime(seconds);
    if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      try {
        ytPlayerRef.current.seekTo(seconds, true);
      } catch (e) {
        console.error('Error seeking:', e);
      }
    }
  }, []);

  // Toggle Play / Pause
  const togglePlay = useCallback(() => {
    if (!ytPlayerRef.current) return;
    try {
      if (isPlaying) {
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
        syncAudioBridge(false);
      } else {
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
        syncAudioBridge(true);
      }
    } catch (e) {
      console.error('Error toggling play/pause:', e);
    }
  }, [isPlaying, syncAudioBridge]);

  // Keep callback refs updated for lock screen and event handlers
  useEffect(() => {
    nextTrackRef.current = nextTrack;
    prevTrackRef.current = prevTrack;
    togglePlayRef.current = togglePlay;
    seekToRef.current = seekTo;
  }, [nextTrack, prevTrack, togglePlay, seekTo]);

  // Track Ended Handler
  const handleTrackEnded = useCallback(() => {
    const { repeatMode } = stateRef.current;
    if (repeatMode === 'one') {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        ytPlayerRef.current.seekTo(0, true);
        ytPlayerRef.current.playVideo();
      }
    } else if (nextTrackRef.current) {
      nextTrackRef.current();
    }
  }, []);

  // Player State Change
  const handlePlayerStateChange = useCallback((event) => {
    const state = event.data;
    if (state === YT_STATE.PLAYING) {
      setIsPlaying(true);
      setIsBuffering(false);
      syncAudioBridge(true);
      try {
        const dur = ytPlayerRef.current?.getDuration();
        if (dur && dur > 0) setDuration(dur);
      } catch {}
    } else if (state === YT_STATE.PAUSED) {
      setIsPlaying(false);
      setIsBuffering(false);
      syncAudioBridge(false);
    } else if (state === YT_STATE.BUFFERING) {
      setIsBuffering(true);
    } else if (state === YT_STATE.ENDED) {
      handleTrackEnded();
    }
  }, [handleTrackEnded, syncAudioBridge]);

  // Error Handler
  const handlePlayerError = useCallback((event) => {
    const errorCode = event.data;
    setIsPlaying(false);
    setIsBuffering(false);
    syncAudioBridge(false);

    let message = 'Playback error occurred.';
    if (errorCode === 101 || errorCode === 150) {
      message = 'Video restricted by owner for embedded playback. Auto-playing next track...';
    } else if (errorCode === 100) {
      message = 'Track not found or removed. Auto-playing next track...';
    } else if (errorCode === 2) {
      message = 'Invalid video ID parameter.';
    }

    showToast(message, 'error', 4000);

    setTimeout(() => {
      if (nextTrackRef.current) nextTrackRef.current();
    }, 1500);
  }, [showToast, syncAudioBridge]);

  // Mobile Lock Screen & Notification Shade (MediaSession API)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'NOIR Soundscape',
        artwork: [
          { src: currentTrack.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        if (togglePlayRef.current) togglePlayRef.current();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (togglePlayRef.current) togglePlayRef.current();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (prevTrackRef.current) prevTrackRef.current();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (nextTrackRef.current) nextTrackRef.current();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && seekToRef.current) {
          seekToRef.current(details.seekTime);
        }
      });
    } catch (e) {
      console.warn('MediaSession registration error:', e);
    }
  }, [currentTrack, isPlaying]);

  // Mobile Background & Screen-Off Visibility Recovery Handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Device locked or browser switched to background
        if (stateRef.current.isPlaying) {
          // Re-assert silent audio bridge to prevent OS audio session termination
          if (silentAudioRef.current && silentAudioRef.current.paused) {
            silentAudioRef.current.play().catch(() => {});
          }

          // Mobile browsers like Chrome on Android pause video iframes when the screen turns off.
          // We immediately request playVideo() to keep audio playback going.
          setTimeout(() => {
            if (stateRef.current.isPlaying && ytPlayerRef.current) {
              try {
                ytPlayerRef.current.playVideo();
              } catch {}
            }
          }, 250);
        }
      } else {
        // Screen turned back on or user returned to app
        if (stateRef.current.isPlaying && ytPlayerRef.current) {
          try {
            ytPlayerRef.current.playVideo();
          } catch {}
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Load YouTube IFrame API Script with Mobile playsinline
  useEffect(() => {
    let isMounted = true;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;
      if (ytPlayerRef.current) return;

      try {
        ytPlayerRef.current = new window.YT.Player('noir-yt-player-iframe', {
          height: '100%',
          width: '100%',
          videoId: currentTrack?.id || '4NRXx6U8ABQ',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1, // Crucial for mobile background & non-fullscreen playback
            enablejsapi: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onReady: (event) => {
              if (!isMounted) return;
              event.target.setVolume(80);
            },
            onStateChange: handlePlayerStateChange,
            onError: handlePlayerError
          }
        });
      } catch (err) {
        console.error('Failed to initialize YouTube Player:', err);
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      window.onYouTubeIframeAPIReady = initPlayer;
      document.body.appendChild(tag);
    } else if (window.YT && window.YT.Player) {
      initPlayer();
    }

    return () => {
      isMounted = false;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [currentTrack?.id, handlePlayerError, handlePlayerStateChange]);

  // Poll current playback time while playing
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          try {
            const current = ytPlayerRef.current.getCurrentTime();
            const dur = ytPlayerRef.current.getDuration();
            if (current !== undefined && !isNaN(current)) {
              setCurrentTime(current);
            }
            if (dur && !isNaN(dur) && dur > 0) {
              setDuration(dur);
            }
          } catch {}
        }
      }, 400);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying]);

  const pause = useCallback(() => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {}
    }
    setIsPlaying(false);
    syncAudioBridge(false);
  }, [syncAudioBridge]);

  const setVolumeLevel = useCallback((val) => {
    const level = Math.max(0, Math.min(100, Number(val)));
    setVolume(level);
    setIsMuted(level === 0);
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try {
        ytPlayerRef.current.setVolume(level);
        if (level > 0 && ytPlayerRef.current.isMuted()) {
          ytPlayerRef.current.unMute();
        }
      } catch {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!ytPlayerRef.current) return;
    try {
      if (isMuted) {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(volume || 50);
        setIsMuted(false);
      } else {
        ytPlayerRef.current.mute();
        setIsMuted(true);
      }
    } catch {}
  }, [isMuted, volume]);

  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      const next = !prev;
      showToast(next ? 'Shuffle enabled' : 'Shuffle disabled', 'info');
      return next;
    });
  }, [showToast]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'off') {
        showToast('Repeat all tracks', 'info');
        return 'all';
      }
      if (prev === 'all') {
        showToast('Repeat current track', 'info');
        return 'one';
      }
      showToast('Repeat off', 'info');
      return 'off';
    });
  }, [showToast]);

  const addToQueue = useCallback((track) => {
    if (!track) return;
    setQueue(prev => [...prev, track]);
    showToast(`Added "${track.title}" to queue`, 'success');
  }, [showToast]);

  const removeFromQueue = useCallback((index) => {
    setQueue(prev => {
      const updated = prev.filter((_, i) => i !== index);
      showToast('Removed from queue', 'info');
      return updated;
    });
  }, [showToast]);

  const clearQueue = useCallback(() => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setQueueIndex(0);
    } else {
      setQueue([]);
      setQueueIndex(0);
    }
    showToast('Queue cleared', 'info');
  }, [currentTrack, showToast]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        volume,
        isMuted,
        shuffle,
        repeatMode,
        queue,
        queueIndex,
        isVideoVisible,
        setIsVideoVisible,
        isMobilePlayerOpen,
        setIsMobilePlayerOpen,
        playTrack,
        togglePlay,
        pause,
        seekTo,
        nextTrack,
        prevTrack,
        setVolumeLevel,
        toggleMute,
        toggleShuffle,
        cycleRepeat,
        addToQueue,
        removeFromQueue,
        clearQueue
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
