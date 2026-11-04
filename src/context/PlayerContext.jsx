import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLibrary } from './LibraryContext';
import { storage } from '../services/storage';
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
import { isCompilationAlbum, extractOriginalFilmOrAlbum } from '../services/artworkUtils';
import {
  buildAutoplaySearchTiers,
  createRecommendationContext,
  getRealPlayableSaavnTracks,
  getRecommendationVibeLabel,
  rankRecommendationCandidates,
  selectRecommendationForTier
} from '../services/recommendationEngine';
import {
  appendQueueTrack,
  getNextQueuedTrack,
  isRadioTrack,
  getNextRepeatMode,
  getPreviousQueueIndex,
  shuffleQueuePreservingCurrent,
  getUpcomingQueueCount,
  shouldReplenishQueue,
  filterEligibleRecommendationTracks,
  normalizeTrackTitle
} from '../services/playbackUtils';

// Module-level cache for resolved CDN audio URLs to guarantee immediate lookup during background transitions
const resolvedAudioUrlCache = new Map();

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
  const {
    addToRecent,
    showToast,
    likedSongs,
    userPreferences,
    playlists,
    recentlyPlayed,
    libraryOwnerId,
    user
  } = useLibrary();
  const activeUserId = user?.id;

  // Playback state
  const [currentTrack, setCurrentTrack] = useState(() => {
    try {
      const recent = storage.getRecentlyPlayed();
      return recent && recent.length > 0 ? recent[0] : null;
    } catch {
      return null;
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => {
    try {
      const recent = storage.getRecentlyPlayed();
      return recent && recent[0]?.duration ? recent[0].duration : 0;
    } catch {
      return 0;
    }
  });
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [preShuffleQueue, setPreShuffleQueue] = useState(null);
  const [repeatMode, setRepeatMode] = useState('all'); // 'off' | 'all' | 'one'
  const [queue, setQueue] = useState(() => {
    try {
      const recent = storage.getRecentlyPlayed();
      return recent && recent.length > 0 ? recent : [];
    } catch {
      return [];
    }
  });
  const [queueIndex, setQueueIndex] = useState(0);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [recommendationContext, setRecommendationContext] = useState(null);
  const [autoplayEnabled, setAutoplayEnabled] = useState(() => storage.getAutoplayEnabled('guest'));

  // Dedicated Radio Mode & Station state
  const [isRadio, setIsRadio] = useState(() => {
    try {
      const recent = storage.getRecentlyPlayed();
      return recent && recent.length > 0 ? isRadioTrack(recent[0]) : false;
    } catch {
      return false;
    }
  });
  const [radioStation, setRadioStation] = useState(() => {
    try {
      const recent = storage.getRecentlyPlayed();
      const track = recent && recent.length > 0 ? recent[0] : null;
      return track && isRadioTrack(track)
        ? { title: track.title, artist: track.artist, album: track.album || 'Lo-Fi Radio Station' }
        : null;
    } catch {
      return null;
    }
  });
  const [playbackSource, setPlaybackSource] = useState('track');

  useEffect(() => {
    setAutoplayEnabled(storage.getAutoplayEnabled(user?.id || 'guest'));
  }, [user?.id]);

  // Synchronized Lyrics State
  const [lyricsData, setLyricsData] = useState(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  // Screen Wake Lock Hook during active playback
  useWakeLock(isPlaying);

  // References
  const audioRef = useRef(null);
  const isTransitioningTrackRef = useRef(false);
  const isPrefetchingAutoplayRef = useRef(false);
  const targetBufferRef = useRef(5);
  const isReplenishingQueueRef = useRef(false);
  const recommendationPoolRef = useRef([]);
  const activeReplenishTrackIdRef = useRef(null);
  const queryTierIndexRef = useRef(0);
  const replenishFailCountRef = useRef(0);
  const userIdRef = useRef(user?.id || 'guest');
  const stateRef = useRef({
    currentTrack,
    queue,
    queueIndex,
    repeatMode,
    shuffle,
    preShuffleQueue,
    isRadio,
    radioStation,
    playbackSource,
    autoplayEnabled
  });
  const playTrackRef = useRef(null);
  const nextTrackRef = useRef(null);
  const prevTrackRef = useRef(null);
  const seekToRef = useRef(null);

  // Keep stateRef updated for callbacks
  useEffect(() => {
    stateRef.current = {
      currentTrack,
      queue,
      queueIndex,
      repeatMode,
      shuffle,
      preShuffleQueue,
      isRadio,
      radioStation,
      playbackSource,
      autoplayEnabled
    };
  }, [currentTrack, queue, queueIndex, repeatMode, shuffle, preShuffleQueue, isRadio, radioStation, playbackSource, autoplayEnabled]);

  useEffect(() => {
    userIdRef.current = user?.id || 'guest';
  }, [user?.id]);

  // Load synchronized lyrics whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }

    let isMounted = true;
    setLyricsLoading(true);

    fetchLyricsForTrack(currentTrack)
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
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.duration, currentTrack?.album]);

  // Calculate active synchronized lyric line via binary search
  const activeLyricIndex = lyricsData?.syncedLyrics
    ? findCurrentLyricIndex(lyricsData.syncedLyrics, currentTime)
    : -1;

  // Handle Audio Error: immediate microtask recovery prevents frozen setTimeout on locked mobile devices
  const handleAudioError = useCallback(() => {
    setIsBuffering(false);
    isTransitioningTrackRef.current = false;
    const track = stateRef.current.currentTrack;
    showToast(`Playback error for "${track?.title || 'current track'}". Playing next...`, 'error', 3000);
    queueMicrotask(() => {
      if (nextTrackRef.current) nextTrackRef.current('error');
    });
  }, [showToast]);

  // Safe Audio Playback Trigger
  const startAudioPlayback = useCallback((audioUrl) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      isTransitioningTrackRef.current = false;
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
            isTransitioningTrackRef.current = false;
            setIsPlaying(true);
            setIsBuffering(false);
            setMediaSessionPlaybackState('playing');
          })
          .catch((err) => {
            setIsBuffering(false);
            if (err.name === 'NotAllowedError') {
              isTransitioningTrackRef.current = false;
              setIsPlaying(false);
              setMediaSessionPlaybackState('paused');
              console.warn('Playback deferred until user interaction.');
            } else if (err.name !== 'AbortError') {
              isTransitioningTrackRef.current = false;
              console.warn('Audio play request failed:', err);
              setIsPlaying(false);
              setMediaSessionPlaybackState('paused');
            }
          });
      }
    } catch (e) {
      console.error('Audio play error:', e);
      isTransitioningTrackRef.current = false;
      setIsBuffering(false);
      setIsPlaying(false);
      setMediaSessionPlaybackState('paused');
    }
  }, [isMuted, volume]);

  // Core Play Track Function
  const playTrack = useCallback((track, newQueue = null, playOptions = {}) => {
    if (!track) return;

    // 1. Radio Mode State Determination & Queue Isolation
    const isRadioMode = isRadioTrack(track, playOptions);
    if (isRadioMode) {
      setIsRadio(true);
      setRadioStation(playOptions.radioStation || {
        title: track.title,
        artist: track.artist,
        album: track.album || 'Lo-Fi Radio Station'
      });
      setPlaybackSource('radio');
    } else {
      // Immediately exit Radio mode, reset station metadata and source when playing a normal song
      setIsRadio(false);
      setRadioStation(null);
      setPlaybackSource(playOptions.playbackSource || (playOptions.searchQuery ? 'search' : 'track'));
    }

    isTransitioningTrackRef.current = true;

    // Synchronously update stateRef so any background event immediately sees active track
    stateRef.current.currentTrack = track;
    if (playOptions.explicitQueueIndex !== undefined) {
      stateRef.current.queueIndex = playOptions.explicitQueueIndex;
    }

    if (!playOptions.preserveRecommendationContext) {
      setRecommendationContext(createRecommendationContext(track, playOptions.searchQuery || ''));
    }

    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 200);
    setIsBuffering(true);
    addToRecent(track);

    // Keep MediaSession updated immediately with current track to maintain OS notification
    updateMediaSessionMetadata(track);
    setMediaSessionPlaybackState('playing');

    // Use the account active when playback started so an auth switch cannot
    // attribute this track to a different user's listening history.
    if (activeUserId) supabaseService.recordHistory(track, activeUserId);

    // Automatically resolve canonical album artwork if track belongs to a compilation
    if (isCompilationAlbum(track.album, track.title) || extractOriginalFilmOrAlbum(track.title)) {
      saavnApi.resolveCanonicalArtwork(track).then((resolved) => {
        if (resolved && resolved.thumbnail && resolved.thumbnail !== track.thumbnail) {
          track.thumbnail = resolved.thumbnail;
          if (resolved.album) track.album = resolved.album;
          if (resolved.albumId) track.albumId = resolved.albumId;

          setCurrentTrack(prev => {
            if (!prev || (prev.id !== track.id && prev.saavnId !== track.saavnId)) return prev;
            return {
              ...prev,
              thumbnail: resolved.thumbnail,
              album: resolved.album || prev.album,
              albumId: resolved.albumId || prev.albumId
            };
          });

          setQueue(prevQueue => prevQueue.map(item => {
            if (item.id === track.id || item.saavnId === track.saavnId) {
              return {
                ...item,
                thumbnail: resolved.thumbnail,
                album: resolved.album || item.album,
                albumId: resolved.albumId || item.albumId
              };
            }
            return item;
          }));

          addToRecent(track);
        }
      }).catch(() => {});
    }

    // Continuous Queue Target Buffer & Replenish Refs Initialization
    if (track.id !== activeReplenishTrackIdRef.current) {
      activeReplenishTrackIdRef.current = track.id;
      queryTierIndexRef.current = 0;
      replenishFailCountRef.current = 0;
      recommendationPoolRef.current = [];
    }

    // Queue updates with Radio/Normal Queue Isolation
    if (playOptions.explicitQueueIndex !== undefined) {
      setQueueIndex(playOptions.explicitQueueIndex);
      if (newQueue && Array.isArray(newQueue)) {
        // Normal music queues must never contain radio stations
        const sanitized = isRadioMode ? newQueue : newQueue.filter(t => !isRadioTrack(t));
        setQueue(sanitized);
        setPreShuffleQueue(null);
        targetBufferRef.current = Math.max(5, sanitized.length - 1 - playOptions.explicitQueueIndex);
      }
    } else if (newQueue && Array.isArray(newQueue)) {
      const sanitized = isRadioMode ? newQueue : newQueue.filter(t => !isRadioTrack(t));
      setQueue(sanitized);
      setPreShuffleQueue(null);
      const index = sanitized.findIndex(t => t.id === track.id);
      const targetIdx = index !== -1 ? index : 0;
      setQueueIndex(targetIdx);
      targetBufferRef.current = Math.max(5, sanitized.length - 1 - targetIdx);
    } else {
      setQueue(prev => {
        // If switching from radio to normal song, completely reset queue to current track
        if (!isRadioMode && prev.some(isRadioTrack)) {
          setQueueIndex(0);
          targetBufferRef.current = 5;
          return [track];
        }
        const existingIdx = prev.findIndex(t => t.id === track.id);
        if (existingIdx !== -1) {
          setQueueIndex(existingIdx);
          targetBufferRef.current = Math.max(5, prev.length - 1 - existingIdx);
          return prev;
        }
        const newQueue = [...prev, track];
        setQueueIndex(prev.length);
        targetBufferRef.current = Math.max(5, newQueue.length - 1 - prev.length);
        return newQueue;
      });
    }

    // Direct playback if audioUrl exists
    const existingUrl = track.audioUrl || resolvedAudioUrlCache.get(track.id) || (track.saavnId && resolvedAudioUrlCache.get(track.saavnId));
    if (existingUrl) {
      track.audioUrl = existingUrl;
      resolvedAudioUrlCache.set(track.id, existingUrl);
      if (track.saavnId) resolvedAudioUrlCache.set(track.saavnId, existingUrl);
      startAudioPlayback(existingUrl);
    } else {
      // Dynamically resolve 320kbps CDN stream from JioSaavn
      saavnApi.resolveAudioUrl(track).then((resolvedUrl) => {
        if (resolvedUrl) {
          track.audioUrl = resolvedUrl;
          resolvedAudioUrlCache.set(track.id, resolvedUrl);
          if (track.saavnId) resolvedAudioUrlCache.set(track.saavnId, resolvedUrl);
          startAudioPlayback(resolvedUrl);
        } else {
          isTransitioningTrackRef.current = false;
          setIsBuffering(false);
          setIsPlaying(false);
          showToast(`Stream currently unavailable for "${track.title}"`, 'error');
          queueMicrotask(() => {
            if (nextTrackRef.current) nextTrackRef.current('error');
          });
        }
      }).catch((err) => {
        console.warn('[MediaSession] Audio stream resolution failed:', err);
        isTransitioningTrackRef.current = false;
        setIsBuffering(false);
        setIsPlaying(false);
        queueMicrotask(() => {
          if (nextTrackRef.current) nextTrackRef.current('error');
        });
      });
    }
  }, [addToRecent, startAudioPlayback, showToast, activeUserId]);

  // Start Lo-Fi Radio station with explicit isolated radio state
  const playRadio = useCallback((stationOrTrack = null, stationQueue = null) => {
    const radioTrack = stationOrTrack || {
      id: 'jfKfPfyJRdk',
      title: 'synthwave radio 🌌 - chill beats to relax/game to',
      artist: 'Lofi Girl',
      album: 'Chill Wave Radio',
      duration: 3600,
      genre: 'Synthwave / Lo-Fi',
      audioUrl: 'https://aac.saavncdn.com/080/707ac927188f2f31ee89b38b66df8cd0_320.mp4',
      thumbnail: 'https://c.saavncdn.com/674/Synthwave-Radio-Retrowave-Unknown-2025-20251001074509-500x500.jpg',
      isRadio: true
    };
    playTrack(radioTrack, stationQueue || [radioTrack], {
      isRadio: true,
      playbackSource: 'radio',
      radioStation: {
        title: radioTrack.title,
        artist: radioTrack.artist,
        album: radioTrack.album || 'Lo-Fi Radio Station'
      }
    });
  }, [playTrack]);

  // Choose a radio-style recommendation without changing the active vibe context.
  const playPersonalizedNextTrack = useCallback(async () => {
    const cur = stateRef.current.currentTrack;
    const { queue = [] } = stateRef.current;
    const profileId = user?.id || 'guest';
    const profileReady = libraryOwnerId === profileId;
    const history = profileReady ? (recentlyPlayed || []) : [];
    const recentHistory = history.slice(0, 12);
    const preferences = profileReady ? (userPreferences || {}) : {};
    const liked = profileReady ? (likedSongs || []) : [];
    const savedPlaylists = profileReady ? (playlists || []) : [];
    const context = recommendationContext || createRecommendationContext(cur);
    const skippedTracks = storage.getSkippedTracks(profileId);
    const excludedTracks = [...queue, ...recentHistory];
    const rankingOptions = {
      excludedTracks,
      skippedTracks,
      userPreferences: preferences,
      likedTracks: liked,
      recentTracks: history
    };
    const vibeLabel = getRecommendationVibeLabel(context);
    const isSeedRadio = isRadioTrack(cur);
    const localCandidates = [
      ...liked,
      ...history,
      ...savedPlaylists.flatMap(playlist => Array.isArray(playlist?.tracks) ? playlist.tracks : [])
    ].filter(track => track?.id && track?.title && (track.audioUrl || track.artist) && (isSeedRadio || !isRadioTrack(track)))
      .map(track => ({ track, retrievedFor: {} }));

    const playRecommendation = (track, label) => {
      if (!track) return false;
      if (stateRef.current.currentTrack?.id !== cur?.id || userIdRef.current !== profileId) return false;
      const nextQueue = appendQueueTrack(queue, track);
      const vibeText = vibeLabel ? ` for ${vibeLabel}` : '';
      showToast(`Playing next${vibeText} (${label}): "${track.title}"`, 'info', 3000);
      playTrack(track, nextQueue, { preserveRecommendationContext: true });
      return true;
    };

    const tiers = buildAutoplaySearchTiers(context, {
      userPreferences: preferences,
      recentTracks: history
    });
    for (const tier of tiers.filter(item => item.id !== 'broader')) {
      if (stateRef.current.currentTrack?.id !== cur?.id || userIdRef.current !== profileId) return false;
      const batches = await Promise.all(tier.queries.map(async query => {
        try {
          const response = await saavnApi.search(query.query);
          return getRealPlayableSaavnTracks(response).map(track => ({ track, retrievedFor: query }));
        } catch (err) {
          console.warn(`Failed to search ${tier.id} autoplay recommendations for "${query.query}":`, err);
          return [];
        }
      }));
      if (stateRef.current.currentTrack?.id !== cur?.id || userIdRef.current !== profileId) return false;
      const ranked = rankRecommendationCandidates([...localCandidates, ...batches.flat()], context, rankingOptions);
      const selected = selectRecommendationForTier(ranked, tier.id, context);
      if (selected) return playRecommendation(selected.track, tier.id.replace('-', ' '));
    }

    // Trending is a final fallback and must still match a classified strong vibe.
    try {
      const trending = await saavnApi.getTrending();
      if (stateRef.current.currentTrack?.id !== cur?.id || userIdRef.current !== profileId) return false;
      const realTrending = (trending || []).filter(track => track?.source === 'saavn_cdn' && track.audioUrl && (isSeedRadio || !isRadioTrack(track)));
      const rankedTrending = rankRecommendationCandidates(realTrending, context, rankingOptions);
      const selectedTrending = selectRecommendationForTier(rankedTrending, 'broader', context);
      if (selectedTrending) return playRecommendation(selectedTrending.track, 'trending fallback');
    } catch (err) {
      console.warn('Failed to fetch trending autoplay recommendation:', err);
    }
    return false;
  }, [libraryOwnerId, likedSongs, userPreferences, playlists, recentlyPlayed, recommendationContext, user?.id, playTrack, showToast]);

  // Next Track Logic: Synchronous execution on lock-screen controls guarantees zero gap
  const nextTrack = useCallback(async (reason = 'manual') => {
    const { queue, queueIndex, repeatMode, currentTrack: activeTrack } = stateRef.current;
    if (!queue || queue.length === 0) return;
    if (reason === 'manual' && activeTrack?.id) {
      storage.addSkippedTrack(activeTrack, user?.id || 'guest');
    }

    const next = getNextQueuedTrack(queue, queueIndex);
    if (next) {
      const nextIndex = queueIndex + 1;
      isTransitioningTrackRef.current = true;

      // Update stateRef immediately to avoid stale closures during rapid lock-screen taps
      stateRef.current.queueIndex = nextIndex;
      stateRef.current.currentTrack = next;

      setQueueIndex(nextIndex);
      setCurrentTrack(next);
      setCurrentTime(0);
      setDuration(next.duration || 200);

      const audioUrl = next.audioUrl || resolvedAudioUrlCache.get(next.id) || (next.saavnId && resolvedAudioUrlCache.get(next.saavnId));
      const audio = audioRef.current;

      if (audioUrl && audio) {
        next.audioUrl = audioUrl;
        audio.src = audioUrl;
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => console.warn('[MediaSession] Next track play warning:', err));
        }
        updateMediaSessionMetadata(next);
        setMediaSessionPlaybackState('playing');
        updateMediaSessionPositionState({ duration: next.duration || 200, position: 0 });
        addToRecent(next);
        if (activeUserId) supabaseService.recordHistory(next, activeUserId);
      } else {
        playTrack(next, queue, {
          explicitQueueIndex: nextIndex,
          isRadio: isRadioTrack(next),
          playbackSource: isRadioTrack(next) ? 'radio' : 'track'
        });
      }
    } else {
      // Reached end of queue: continue playing from personalized autoplay if enabled
      const playedPersonalized = autoplayEnabled ? await playPersonalizedNextTrack() : false;
      if (stateRef.current.currentTrack?.id !== activeTrack?.id) return;
      if (!playedPersonalized) {
        if (repeatMode === 'all') {
          stateRef.current.queueIndex = 0;
          stateRef.current.currentTrack = queue[0];
          setQueueIndex(0);
          isTransitioningTrackRef.current = true;
          playTrack(queue[0], queue, {
            explicitQueueIndex: 0,
            isRadio: isRadioTrack(queue[0]),
            playbackSource: isRadioTrack(queue[0]) ? 'radio' : 'track'
          });
        } else {
          isTransitioningTrackRef.current = false;
          if (audioRef.current) audioRef.current.pause();
          setIsPlaying(false);
          setMediaSessionPlaybackState('paused');
        }
      }
    }
  }, [autoplayEnabled, user?.id, playTrack, playPersonalizedNextTrack, addToRecent, activeUserId]);

  // Handle Track Ended Logic: Synchronous chaining ensures unbroken background playback on locked mobile devices
  const handleTrackEnded = useCallback(() => {
    const { queue, queueIndex, repeatMode } = stateRef.current;
    const audio = audioRef.current;
    if (!audio) return;

    // 1. Repeat One
    if (repeatMode === 'one') {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => console.warn('[MediaSession] Repeat one play error:', err));
      }
      return;
    }

    // 2. Next track in queue: Synchronous continuation guarantees AudioFocus is kept on Android Screen OFF
    const next = getNextQueuedTrack(queue, queueIndex);
    if (next) {
      const nextIndex = queueIndex + 1;
      isTransitioningTrackRef.current = true;

      // Update stateRef immediately to avoid stale closures during background track advance
      stateRef.current.queueIndex = nextIndex;
      stateRef.current.currentTrack = next;

      setQueueIndex(nextIndex);
      setCurrentTrack(next);
      setCurrentTime(0);
      setDuration(next.duration || 200);

      const resolvedUrl = next.audioUrl || resolvedAudioUrlCache.get(next.id) || (next.saavnId && resolvedAudioUrlCache.get(next.saavnId));

      if (resolvedUrl) {
        next.audioUrl = resolvedUrl;
        audio.src = resolvedUrl;
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[MediaSession] Background play continuation warning:', err);
          });
        }
        updateMediaSessionMetadata(next);
        setMediaSessionPlaybackState('playing');
        updateMediaSessionPositionState({ duration: next.duration || 200, position: 0 });
        addToRecent(next);
        if (activeUserId) supabaseService.recordHistory(next, activeUserId);
        return;
      }

      // Lookahead fallback: find next pre-resolved track if this track is delayed
      let lookaheadIndex = -1;
      for (let i = nextIndex + 1; i < Math.min(queue.length, nextIndex + 5); i++) {
        const candidate = queue[i];
        const candidateUrl = candidate?.audioUrl || resolvedAudioUrlCache.get(candidate?.id) || (candidate?.saavnId && resolvedAudioUrlCache.get(candidate?.saavnId));
        if (candidateUrl) {
          lookaheadIndex = i;
          break;
        }
      }

      if (lookaheadIndex !== -1) {
        const readyTrack = queue[lookaheadIndex];
        stateRef.current.queueIndex = lookaheadIndex;
        stateRef.current.currentTrack = readyTrack;
        setQueueIndex(lookaheadIndex);
        setCurrentTrack(readyTrack);
        const readyUrl = readyTrack.audioUrl || resolvedAudioUrlCache.get(readyTrack.id) || (readyTrack.saavnId && resolvedAudioUrlCache.get(readyTrack.saavnId));
        readyTrack.audioUrl = readyUrl;
        audio.src = readyUrl;
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => console.warn('[MediaSession] Lookahead play warning:', err));
        }
        updateMediaSessionMetadata(readyTrack);
        setMediaSessionPlaybackState('playing');
        updateMediaSessionPositionState({ duration: readyTrack.duration || 200, position: 0 });
        addToRecent(readyTrack);
        if (activeUserId) supabaseService.recordHistory(readyTrack, activeUserId);
        return;
      }

      // If audioUrl is not yet resolved, delegate to playTrack with explicit queue index
      playTrack(next, queue, { explicitQueueIndex: nextIndex });
      return;
    }

    // 3. Queue ended -> Autoplay or Repeat All
    if (nextTrackRef.current) {
      nextTrackRef.current('ended');
    }
  }, [playTrack, addToRecent, activeUserId]);

  // Previous Track: checks physical audio element position to avoid stale React closures
  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    const currentAudioTime = audio ? audio.currentTime : 0;

    // If more than 3 seconds in, rewind to beginning
    if (currentAudioTime > 3 && audio) {
      audio.currentTime = 0;
      setCurrentTime(0);
      updateMediaSessionPositionState({ duration: stateRef.current.currentTrack?.duration || 200, position: 0 });
      return;
    }

    const { queue, queueIndex } = stateRef.current;
    if (!queue || queue.length === 0) return;

    const prevIndex = getPreviousQueueIndex(queue, queueIndex);
    const prev = queue[prevIndex];
    if (prev) {
      // Update stateRef immediately to avoid stale closures during rapid lock-screen taps
      stateRef.current.queueIndex = prevIndex;
      stateRef.current.currentTrack = prev;

      setQueueIndex(prevIndex);
      isTransitioningTrackRef.current = true;
      playTrack(prev, queue, {
        explicitQueueIndex: prevIndex,
        isRadio: isRadioTrack(prev),
        playbackSource: isRadioTrack(prev) ? 'radio' : 'track'
      });
    }
  }, [playTrack]);

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
    if (!audio || !currentTrack) return;

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
    playTrackRef.current = playTrack;
    nextTrackRef.current = nextTrack;
    prevTrackRef.current = prevTrack;
    seekToRef.current = seekTo;
  }, [playTrack, nextTrack, prevTrack, seekTo]);

  // 1. Proactively pre-resolve stream URLs for upcoming tracks in the queue (5-track rolling lookahead buffer)
  // Ensures seamless synchronous transition when current track ends on mobile screen-off.
  useEffect(() => {
    if (!currentTrack || !queue || queue.length === 0) return;
    let isMounted = true;

    // Resolve up to 5 upcoming tracks in queue ahead of time
    const upcomingWindow = queue.slice(queueIndex + 1, queueIndex + 6);
    for (const upcomingItem of upcomingWindow) {
      if (!upcomingItem || upcomingItem.audioUrl || resolvedAudioUrlCache.has(upcomingItem.id)) continue;

      saavnApi.resolveAudioUrl(upcomingItem).then((resolvedUrl) => {
        if (isMounted && resolvedUrl) {
          upcomingItem.audioUrl = resolvedUrl;
          resolvedAudioUrlCache.set(upcomingItem.id, resolvedUrl);
          if (upcomingItem.saavnId) resolvedAudioUrlCache.set(upcomingItem.saavnId, resolvedUrl);
          setQueue((prevQueue) =>
            prevQueue.map((item) =>
              item.id === upcomingItem.id ? { ...item, audioUrl: resolvedUrl } : item
            )
          );
        }
      }).catch(() => {});
    }

    return () => { isMounted = false; };
  }, [currentTrack?.id, queueIndex, queue]);

  // 2. Spotify-Style Continuous Queue / Infinite Autoplay Replenisher
  // Whenever a track moves from "UP NEXT" to "NOW PLAYING", automatically fetches and appends
  // a new relevant track to maintain the queue buffer in real time without waiting for queue to empty.
  useEffect(() => {
    if (!autoplayEnabled || isRadio || isReplenishingQueueRef.current) return;
    if (!currentTrack || !currentTrack.id || isRadioTrack(currentTrack)) return;

    const targetBuffer = targetBufferRef.current || 5;
    const upcomingCount = getUpcomingQueueCount(queue, queueIndex);

    if (upcomingCount >= targetBuffer) return;
    if (replenishFailCountRef.current >= 3) return;

    const needed = targetBuffer - upcomingCount;
    let isCancelled = false;

    const replenish = async () => {
      isReplenishingQueueRef.current = true;
      try {
        const skipped = storage.getSkippedTracks(user?.id || 'guest');
        const rankingContext = recommendationContext || createRecommendationContext(currentTrack);

        // A. Check recommendation pool first
        const validFromPool = filterEligibleRecommendationTracks(recommendationPoolRef.current, {
          queue,
          currentTrack,
          recentlyPlayed,
          skippedTracks: skipped
        });

        if (validFromPool.length > 0) {
          const toAdd = validFromPool.slice(0, needed);
          recommendationPoolRef.current = validFromPool.slice(needed);
          if (!isCancelled && toAdd.length > 0) {
            setQueue(prev => {
              const existingIds = new Set(prev.flatMap(t => [t.id, t.saavnId]).filter(Boolean));
              const existingTitles = new Set(prev.map(t => normalizeTrackTitle(t.title)).filter(Boolean));
              const uniqueToAdd = toAdd.filter(t => !existingIds.has(t.id) && !existingTitles.has(normalizeTrackTitle(t.title)));
              return uniqueToAdd.length > 0 ? [...prev, ...uniqueToAdd] : prev;
            });
            replenishFailCountRef.current = 0;
          }
          isReplenishingQueueRef.current = false;
          return;
        }

        // B. Fetch next recommendations from JioSaavn using context and search tiers
        const tiers = buildAutoplaySearchTiers(rankingContext, {
          userPreferences: userPreferences || {},
          recentTracks: recentlyPlayed || []
        });

        const allQueries = tiers.flatMap(t => t.queries).filter(q => q && q.query);
        if (allQueries.length === 0) {
          replenishFailCountRef.current += 1;
          isReplenishingQueueRef.current = false;
          return;
        }

        const queryObj = allQueries[queryTierIndexRef.current % allQueries.length];
        queryTierIndexRef.current += 1;

        const searchRes = await saavnApi.search(queryObj.query);
        if (isCancelled) return;

        const playable = getRealPlayableSaavnTracks(searchRes);
        const ranked = rankRecommendationCandidates(playable, rankingContext, {
          excludedTracks: [...queue, ...(recentlyPlayed || [])],
          skippedTracks: skipped,
          userPreferences: userPreferences || {}
        });

        const eligible = filterEligibleRecommendationTracks(
          ranked.filter(r => r.score > 0 && !isRadioTrack(r.track)).map(r => r.track),
          { queue, currentTrack, recentlyPlayed, skippedTracks: skipped }
        );

        if (eligible.length > 0) {
          const toAdd = eligible.slice(0, needed);
          recommendationPoolRef.current = eligible.slice(needed);
          if (!isCancelled && toAdd.length > 0) {
            setQueue(prev => {
              const existingIds = new Set(prev.flatMap(t => [t.id, t.saavnId]).filter(Boolean));
              const existingTitles = new Set(prev.map(t => normalizeTrackTitle(t.title)).filter(Boolean));
              const uniqueToAdd = toAdd.filter(t => !existingIds.has(t.id) && !existingTitles.has(normalizeTrackTitle(t.title)));
              return uniqueToAdd.length > 0 ? [...prev, ...uniqueToAdd] : prev;
            });
            replenishFailCountRef.current = 0;
          }
        } else {
          replenishFailCountRef.current += 1;
        }
      } catch (err) {
        console.warn('Continuous queue replenish warning:', err);
        replenishFailCountRef.current += 1;
      } finally {
        isReplenishingQueueRef.current = false;
      }
    };

    replenish();

    return () => {
      isCancelled = true;
    };
  }, [
    currentTrack?.id,
    queueIndex,
    queue.length,
    autoplayEnabled,
    isRadio,
    recommendationContext,
    user?.id,
    userPreferences,
    recentlyPlayed
  ]);

  // Media Session API: Action handlers registered ONCE on mount with stable delegates
  // Prevents Android NotificationManager from dropping action bindings or freezing when screen is OFF.
  useEffect(() => {
    setMediaSessionActionHandlers({
      play: () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.src && audio.src !== 'about:blank') {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              setIsPlaying(true);
              setMediaSessionPlaybackState('playing');
            }).catch((err) => {
              console.error('[MediaSession] Lock-screen play failed:', err);
              setIsPlaying(false);
              setMediaSessionPlaybackState('paused');
            });
          }
        } else if (stateRef.current.currentTrack) {
          if (playTrackRef.current) {
            playTrackRef.current(stateRef.current.currentTrack);
          }
        }
      },
      pause: () => {
        const audio = audioRef.current;
        if (audio) {
          try {
            audio.pause();
          } catch (err) {
            console.error('[MediaSession] Lock-screen pause error:', err);
          }
        }
        setIsPlaying(false);
        setMediaSessionPlaybackState('paused');
      },
      stop: () => {
        const audio = audioRef.current;
        if (audio) {
          try { audio.pause(); } catch {}
        }
        setIsPlaying(false);
        setMediaSessionPlaybackState('none');
      },
      previousTrack: () => {
        if (prevTrackRef.current) prevTrackRef.current();
      },
      nextTrack: () => {
        if (nextTrackRef.current) nextTrackRef.current('media-session-lockscreen');
      },
      seekTo: (details) => {
        if (details && typeof details.seekTime === 'number' && seekToRef.current) {
          seekToRef.current(details.seekTime);
        }
      },
      seekBackward: (details) => {
        const audio = audioRef.current;
        const currentPos = audio ? audio.currentTime : 0;
        const offset = details?.seekOffset || 10;
        if (seekToRef.current) seekToRef.current(Math.max(0, currentPos - offset));
      },
      seekForward: (details) => {
        const audio = audioRef.current;
        const currentPos = audio ? audio.currentTime : 0;
        const trackDuration = audio?.duration || stateRef.current.currentTrack?.duration || 200;
        const offset = details?.seekOffset || 10;
        if (seekToRef.current) seekToRef.current(Math.min(trackDuration, currentPos + offset));
      }
    });
  }, []);

  // Update Media Session Metadata when current track changes
  useEffect(() => {
    if (currentTrack) {
      updateMediaSessionMetadata(currentTrack);
      updateMediaSessionPositionState({ duration: currentTrack.duration || 200, position: 0 });
    }
  }, [currentTrack]);

  // Update Media Session Playback State
  useEffect(() => {
    setMediaSessionPlaybackState(isPlaying ? 'playing' : 'paused');
  }, [isPlaying]);

  // Fisher-Yates shuffle with pre-shuffle restoration
  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const willShuffle = !prev;
      if (willShuffle) {
        setPreShuffleQueue([...queue]);
        const newQueue = shuffleQueuePreservingCurrent(queue, currentTrack, queueIndex);
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
      const nextMode = getNextRepeatMode(prev);
      const message = nextMode === 'all'
        ? 'Repeat all tracks'
        : nextMode === 'one'
          ? 'Repeat current track'
          : 'Repeat off';
      showToast(message, 'info');
      return nextMode;
    });
  }, [showToast]);

  const toggleAutoplay = useCallback(() => {
    const profileId = user?.id || 'guest';
    setAutoplayEnabled(previous => {
      const next = !previous;
      storage.saveAutoplayEnabled(next, profileId);
      showToast(`Autoplay ${next ? 'enabled' : 'disabled'}`, 'info');
      return next;
    });
  }, [user?.id, showToast]);

  const addToQueue = useCallback((track) => {
    if (!track) return;
    setQueue(prev => appendQueueTrack(prev, track));
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
        isRadio,
        radioStation,
        playbackSource,
        playRadio,
        recommendationContext,
        autoplayEnabled,
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
        toggleAutoplay,
        addToQueue,
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
            updateMediaSessionPositionState({ duration: Math.round(d), position: 0 });
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => {
          isTransitioningTrackRef.current = false;
          setIsBuffering(false);
          setIsPlaying(true);
          setMediaSessionPlaybackState('playing');
        }}
        onPause={(e) => {
          if (!isTransitioningTrackRef.current && !e.currentTarget.ended) {
            setIsPlaying(false);
            setMediaSessionPlaybackState('paused');
          }
        }}
        onSeeked={(e) => {
          const d = e.currentTarget.duration || duration || 200;
          const p = e.currentTarget.currentTime || 0;
          updateMediaSessionPositionState({ duration: d, position: p });
        }}
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
