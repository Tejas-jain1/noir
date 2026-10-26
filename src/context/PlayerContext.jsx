import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLibrary } from './LibraryContext';
import { MOCK_TRACKS } from '../services/mockCatalog';
import { 
  updateMediaSessionMetadata, 
  setMediaSessionActionHandlers, 
  setMediaSessionPlaybackState, 
  updateMediaSessionPositionState 
} from '../services/mediaSession';
import { useWakeLock } from '../hooks/useWakeLock';
import { fetchLyricsForTrack, findCurrentLyricIndex } from '../services/lyricsService';
import { supabaseService } from '../services/supabaseClient';
import { offlineStorage } from '../services/offlineStorage';
import { saavnApi } from '../services/saavnApi';

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
  const [preShuffleQueue, setPreShuffleQueue] = useState(null);
  const [repeatMode, setRepeatMode] = useState('all'); // 'off' | 'all' | 'one'
  const [queue, setQueue] = useState(() => MOCK_TRACKS.slice(0, 10));
  const [queueIndex, setQueueIndex] = useState(0);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);

  // Synchronized Lyrics State
  const [lyricsData, setLyricsData] = useState(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  // Screen Wake Lock Hook during active playback
  useWakeLock(isPlaying);

  // References
  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const stateRef = useRef({ currentTrack, queue, queueIndex, repeatMode, shuffle, preShuffleQueue });
  const nextTrackRef = useRef(null);
  const prevTrackRef = useRef(null);
  const seekToRef = useRef(null);

  // Keep stateRef updated for callbacks
  useEffect(() => {
    stateRef.current = { currentTrack, queue, queueIndex, repeatMode, shuffle, preShuffleQueue };
  }, [currentTrack, queue, queueIndex, repeatMode, shuffle, preShuffleQueue]);

  // Initialize native HTML5 Audio Element for direct 320kbps CDN playback
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTime = () => {
      if (audio.currentTime !== undefined && !isNaN(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleDur = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(Math.round(audio.duration));
      }
    };

    const handleEnd = () => {
      const { repeatMode } = stateRef.current;
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else if (nextTrackRef.current) {
        nextTrackRef.current();
      }
    };

    const handleWait = () => setIsBuffering(true);
    const handlePlay = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const handlePause = () => setIsPlaying(false);
    const handleErr = (e) => {
      console.warn('Native audio element error:', e);
      setIsBuffering(false);
    };

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('loadedmetadata', handleDur);
    audio.addEventListener('ended', handleEnd);
    audio.addEventListener('waiting', handleWait);
    audio.addEventListener('playing', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleErr);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('loadedmetadata', handleDur);
      audio.removeEventListener('ended', handleEnd);
      audio.removeEventListener('waiting', handleWait);
      audio.removeEventListener('playing', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleErr);
    };
  }, []);

  // Load lyrics whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }

    let isMounted = true;
    setLyricsLoading(true);

    fetchLyricsForTrack(currentTrack.title, currentTrack.artist, currentTrack.duration)
      .then((res) => {
        if (isMounted) {
          setLyricsData(res.success ? res.lyrics : null);
          setLyricsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLyricsData(null);
          setLyricsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.duration]);

  // Calculate active synchronized lyric line via binary search
  const activeLyricIndex = lyricsData?.syncedLyrics
    ? findCurrentLyricIndex(lyricsData.syncedLyrics, currentTime)
    : -1;

  // Core Play Track Function (Primary: JioSaavn 320kbps CDN stream)
  const playTrack = useCallback((track, newQueue = null) => {
    if (!track || !track.id) return;

    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 200);
    addToRecent(track);

    // Record listening history to Supabase (if signed in) or IndexedDB
    supabaseService.getCurrentUser().then((user) => {
      if (user) {
        supabaseService.recordHistory(track, user.id);
      }
    });

    if (newQueue && Array.isArray(newQueue)) {
      setQueue(newQueue);
      setPreShuffleQueue(null);
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

    const startNativeAudio = (url) => {
      if (audioRef.current) {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
          try { ytPlayerRef.current.pauseVideo(); } catch {}
        }
        audioRef.current.src = url;
        audioRef.current.currentTime = 0;
        audioRef.current.volume = volume / 100;
        audioRef.current.muted = isMuted;
        audioRef.current.play().catch(e => console.warn('Audio playback prevented by autoplay policy:', e));
        setIsPlaying(true);
      }
    };

    if (track.audioUrl) {
      startNativeAudio(track.audioUrl);
    } else {
      // Resolve 320kbps CDN stream from JioSaavn
      saavnApi.resolveAudioUrl(track).then((resolvedUrl) => {
        if (resolvedUrl) {
          startNativeAudio(resolvedUrl);
        } else if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
          ytPlayerRef.current.loadVideoById(track.id);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        } else {
          setIsPlaying(true);
        }
      });
    }
  }, [addToRecent, isMuted, volume]);

  // Next Track Logic
  const nextTrack = useCallback(() => {
    const { queue, queueIndex, repeatMode } = stateRef.current;
    if (!queue || queue.length === 0) return;

    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    const next = queue[nextIndex];
    if (next) {
      setQueueIndex(nextIndex);
      playTrack(next);
    }
  }, [playTrack]);

  // Seek Function
  const seekTo = useCallback((seconds) => {
    setCurrentTime(seconds);
    if (audioRef.current && audioRef.current.src) {
      try {
        audioRef.current.currentTime = seconds;
      } catch (e) {
        console.error('Error seeking audio:', e);
      }
    } else if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      try {
        ytPlayerRef.current.seekTo(seconds, true);
      } catch (e) {
        console.error('Error seeking:', e);
      }
    }
    updateMediaSessionPositionState({ duration, position: seconds });
  }, [duration]);

  // Previous Track
  const prevTrack = useCallback(() => {
    if (currentTime > 3) {
      seekTo(0);
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
  }, [currentTime, playTrack, seekTo]);

  // Keep refs updated for event listeners & Media Session
  useEffect(() => {
    nextTrackRef.current = nextTrack;
    prevTrackRef.current = prevTrack;
    seekToRef.current = seekTo;
  }, [nextTrack, prevTrack, seekTo]);

  // Media Session API Setup
  useEffect(() => {
    if (currentTrack) {
      updateMediaSessionMetadata(currentTrack);
      setMediaSessionActionHandlers({
        play: () => togglePlay(),
        pause: () => pause(),
        previousTrack: () => prevTrackRef.current && prevTrackRef.current(),
        nextTrack: () => nextTrackRef.current && nextTrackRef.current(),
        seekTo: (details) => {
          if (details.seekTime !== undefined && seekToRef.current) {
            seekToRef.current(details.seekTime);
          }
        },
        seekBackward: (details) => {
          const offset = details.seekOffset || 10;
          if (seekToRef.current) seekToRef.current(Math.max(0, currentTime - offset));
        },
        seekForward: (details) => {
          const offset = details.seekOffset || 10;
          if (seekToRef.current) seekToRef.current(Math.min(duration, currentTime + offset));
        }
      });
    }
  }, [currentTrack]);

  // Update Media Session Playback State
  useEffect(() => {
    setMediaSessionPlaybackState(isPlaying ? 'playing' : 'paused');
    updateMediaSessionPositionState({ duration, position: currentTime });
  }, [isPlaying, duration, currentTime]);

  // YouTube Player Event Handlers
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

  const handlePlayerStateChange = useCallback((event) => {
    const state = event.data;
    if (state === YT_STATE.PLAYING) {
      setIsPlaying(true);
      setIsBuffering(false);
      try {
        const dur = ytPlayerRef.current?.getDuration();
        if (dur && dur > 0) setDuration(dur);
      } catch {
        // Ignored
      }
    } else if (state === YT_STATE.PAUSED) {
      setIsPlaying(false);
      setIsBuffering(false);
    } else if (state === YT_STATE.BUFFERING) {
      setIsBuffering(true);
    } else if (state === YT_STATE.ENDED) {
      handleTrackEnded();
    }
  }, [handleTrackEnded]);

  const handlePlayerError = useCallback((event) => {
    const errorCode = event.data;
    setIsPlaying(false);
    setIsBuffering(false);

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
  }, [showToast]);

  // Load YouTube IFrame API Script
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
          } catch {
            // Ignored
          }
        }
      }, 400);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    if (audioRef.current && audioRef.current.src) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(e => console.warn('Play prevented:', e));
        setIsPlaying(true);
      }
      return;
    }
    if (!ytPlayerRef.current) return;
    try {
      if (isPlaying) {
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('Error toggling play/pause:', e);
    }
  }, [isPlaying]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {
        // Ignored
      }
    }
    setIsPlaying(false);
  }, []);

  const setVolumeLevel = useCallback((val) => {
    const level = Math.max(0, Math.min(100, Number(val)));
    setVolume(level);
    setIsMuted(level === 0);
    if (audioRef.current) {
      audioRef.current.volume = level / 100;
      audioRef.current.muted = level === 0;
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try {
        ytPlayerRef.current.setVolume(level);
        if (level > 0 && ytPlayerRef.current.isMuted()) {
          ytPlayerRef.current.unMute();
        }
      } catch {
        // Ignored
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.muted = newMuted;
    }
    if (ytPlayerRef.current) {
      try {
        if (newMuted) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(volume || 50);
        }
      } catch {
        // Ignored
      }
    }
  }, [isMuted, volume]);

  // Fisher-Yates shuffle with pre-shuffle restoration
  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const willShuffle = !prev;
      if (willShuffle) {
        // Save current queue order snapshot
        setPreShuffleQueue([...queue]);
        // Shuffle queue keeping currently playing track at top
        const remaining = queue.filter((_, i) => i !== queueIndex);
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = remaining[i];
          remaining[i] = remaining[j];
          remaining[j] = temp;
        }
        const newQueue = currentTrack ? [currentTrack, ...remaining] : remaining;
        setQueue(newQueue);
        setQueueIndex(0);
        showToast('Shuffle enabled', 'info');
      } else {
        // Restore pre-shuffle queue order
        if (preShuffleQueue && preShuffleQueue.length > 0) {
          const currentId = currentTrack?.id;
          const restoredIndex = preShuffleQueue.findIndex(t => t.id === currentId);
          setQueue(preShuffleQueue);
          setQueueIndex(restoredIndex !== -1 ? restoredIndex : 0);
          setPreShuffleQueue(null);
        }
        showToast('Shuffle disabled', 'info');
      }
      return willShuffle;
    });
  }, [queue, queueIndex, currentTrack, preShuffleQueue, showToast]);

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

  const reorderQueue = useCallback((fromIndex, toIndex) => {
    setQueue((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }, []);

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
        lyricsData,
        lyricsLoading,
        showLyrics,
        setShowLyrics,
        activeLyricIndex,
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
        clearQueue,
        reorderQueue
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
