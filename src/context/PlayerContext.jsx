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
import { saavnApi } from '../services/saavnApi';

const PlayerContext = createContext();

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
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);

  // Synchronized Lyrics State
  const [lyricsData, setLyricsData] = useState(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  // Screen Wake Lock Hook during active playback
  useWakeLock(isPlaying);

  // References
  const audioRef = useRef(null);
  const stateRef = useRef({ currentTrack, queue, queueIndex, repeatMode, shuffle, preShuffleQueue });
  const nextTrackRef = useRef(null);
  const prevTrackRef = useRef(null);
  const seekToRef = useRef(null);

  // Keep stateRef updated for callbacks
  useEffect(() => {
    stateRef.current = { currentTrack, queue, queueIndex, repeatMode, shuffle, preShuffleQueue };
  }, [currentTrack, queue, queueIndex, repeatMode, shuffle, preShuffleQueue]);

  // Load synchronized lyrics whenever currentTrack changes
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

  // Handle Track Ended Logic
  const handleTrackEnded = useCallback(() => {
    const { repeatMode } = stateRef.current;
    if (repeatMode === 'one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } else if (nextTrackRef.current) {
      nextTrackRef.current();
    }
  }, []);

  // Handle Audio Error
  const handleAudioError = useCallback(() => {
    setIsBuffering(false);
    setIsPlaying(false);
    const track = stateRef.current.currentTrack;
    showToast(`Playback error for "${track?.title || 'current track'}". Playing next...`, 'error', 3500);
    setTimeout(() => {
      if (nextTrackRef.current) nextTrackRef.current();
    }, 1200);
  }, [showToast]);

  // Safe Audio Playback Trigger
  const startAudioPlayback = useCallback((audioUrl) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      setIsBuffering(false);
      setIsPlaying(false);
      return;
    }

    try {
      if (audio.src !== audioUrl) {
        audio.src = audioUrl;
      }
      audio.currentTime = 0;
      audio.volume = isMuted ? 0 : volume / 100;
      audio.muted = isMuted;

      const promise = audio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
          })
          .catch((err) => {
            setIsBuffering(false);
            if (err.name === 'NotAllowedError') {
              setIsPlaying(false);
              console.warn('Playback deferred until user interaction.');
            } else if (err.name !== 'AbortError') {
              console.warn('Audio play request failed:', err);
              setIsPlaying(false);
            }
          });
      }
    } catch (e) {
      console.error('Audio play error:', e);
      setIsBuffering(false);
      setIsPlaying(false);
    }
  }, [isMuted, volume]);

  // Core Play Track Function
  const playTrack = useCallback((track, newQueue = null) => {
    if (!track) return;

    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 200);
    setIsBuffering(true);
    addToRecent(track);

    // Record listening history to Supabase (if signed in)
    supabaseService.getCurrentUser().then((user) => {
      if (user) {
        supabaseService.recordHistory(track, user.id);
      }
    });

    // Queue updates
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

    // Direct playback if audioUrl exists
    if (track.audioUrl) {
      startAudioPlayback(track.audioUrl);
    } else {
      // Dynamically resolve 320kbps CDN stream from JioSaavn
      saavnApi.resolveAudioUrl(track).then((resolvedUrl) => {
        if (resolvedUrl) {
          track.audioUrl = resolvedUrl;
          startAudioPlayback(resolvedUrl);
        } else {
          setIsBuffering(false);
          setIsPlaying(false);
          showToast(`Stream currently unavailable for "${track.title}"`, 'error');
          setTimeout(() => {
            if (nextTrackRef.current) nextTrackRef.current();
          }, 1200);
        }
      });
    }
  }, [addToRecent, startAudioPlayback, showToast]);

  // Next Track Logic
  const nextTrack = useCallback(() => {
    const { queue, queueIndex, repeatMode } = stateRef.current;
    if (!queue || queue.length === 0) return;

    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        if (audioRef.current) audioRef.current.pause();
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

  // Previous Track
  const prevTrack = useCallback(() => {
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
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
    if (isNaN(seconds)) return;
    const clamped = Math.max(0, Math.min(duration, seconds));
    setCurrentTime(clamped);

    const audio = audioRef.current;
    if (audio) {
      try {
        audio.currentTime = clamped;
      } catch (e) {
        console.error('Error seeking audio:', e);
      }
    }
    updateMediaSessionPositionState({ duration, position: clamped });
  }, [duration]);

  // Toggle Play / Pause
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // If audio element has no source yet, trigger playback of current track
    if (!audio.src) {
      playTrack(currentTrack);
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setIsBuffering(true);
      const promise = audio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
          })
          .catch((err) => {
            console.warn('Resume play prevented:', err);
            setIsBuffering(false);
            setIsPlaying(false);
          });
      }
    }
  }, [isPlaying, currentTrack, playTrack]);

  // Pause
  const pause = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
    }
    setIsPlaying(false);
  }, []);

  // Volume & Mute Controls
  const setVolumeLevel = useCallback((val) => {
    const level = Math.max(0, Math.min(100, Number(val)));
    setVolume(level);
    setIsMuted(level === 0);
    if (audioRef.current) {
      audioRef.current.volume = level / 100;
      audioRef.current.muted = level === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.muted = newMuted;
      audioRef.current.volume = newMuted ? 0 : (volume || 80) / 100;
    }
  }, [isMuted, volume]);

  // Keep refs updated for event listeners & Media Session
  useEffect(() => {
    nextTrackRef.current = nextTrack;
    prevTrackRef.current = prevTrack;
    seekToRef.current = seekTo;
  }, [nextTrack, prevTrack, seekTo]);

  // Media Session API Setup for Lock Screen / Notification Center
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

  // Fisher-Yates shuffle with pre-shuffle restoration
  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const willShuffle = !prev;
      if (willShuffle) {
        setPreShuffleQueue([...queue]);
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

  const addTracksToQueue = useCallback((tracks, label = '') => {
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) return;
    setQueue(prev => [...prev, ...tracks]);
    showToast(`Added ${tracks.length} track${tracks.length > 1 ? 's' : ''}${label ? ` from "${label}"` : ''} to queue`, 'success');
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
        addTracksToQueue,
        removeFromQueue,
        clearQueue,
        reorderQueue
      }}
    >
      {children}
      <audio
        ref={audioRef}
        id="noir-audio-element"
        preload="auto"
        style={{ display: 'none' }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          if (t !== undefined && !isNaN(t)) {
            setCurrentTime(t);
          }
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && !isNaN(d) && d > 0) {
            setDuration(Math.round(d));
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={handleTrackEnded}
        onError={handleAudioError}
      />
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
