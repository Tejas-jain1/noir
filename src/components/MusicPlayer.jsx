import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { formatTime } from '../services/youtubeApi';
import AmbientMode from './AmbientMode';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Heart,
  ListMusic,
  ListPlus,
  PlusCircle,
  Sparkles,
  Mic2,
  MoreHorizontal,
  Loader2
} from 'lucide-react';

export default function MusicPlayer({ onOpenQueue, onOpenAddToPlaylist }) {
  const {
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
    togglePlay,
    seekTo,
    nextTrack,
    prevTrack,
    setVolumeLevel,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    addToQueue,
    isMobilePlayerOpen,
    setIsMobilePlayerOpen,
    showLyrics,
    setShowLyrics
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAmbientOpen, setIsAmbientOpen] = useState(false);

  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  // Sync scrubValue with currentTime when not user-scrubbing
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  // Click outside to close floating 3-dots popover menu
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isMenuOpen]);

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? (scrubValue / duration) * 100 : 0;

  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value);
    setScrubValue(val);
    seekTo(val);
  };

  const handleSeekCommit = (e) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
    setIsScrubbing(false);
  };

  return (
    <>
      <footer
        className="music-player-grid floating-player-dock"
        style={{
          position: 'relative',
          zIndex: 30,
          userSelect: 'none'
        }}
      >
        {/* Slim progress bar line at top for mobile mini-player */}
        <div
          className="mobile-only"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2.5px',
            backgroundColor: 'var(--border-subtle)',
            overflow: 'hidden',
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: 'var(--accent-solid)',
              transition: 'width 0.2s linear'
            }}
          />
        </div>

        {/* ========================================================
            1. Track Info (Left on Desktop & Left on Mobile)
            ======================================================== */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: 0,
            overflow: 'hidden',
            flex: 1,
            cursor: 'pointer'
          }}
          onClick={() => setIsMobilePlayerOpen(true)}
        >
          <div
            className="mini-player-art"
            style={{
              position: 'relative',
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              overflow: 'hidden',
              flexShrink: 0,
              backgroundColor: 'var(--bg-surface)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
            }}
            title="Click to expand player"
          >
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80';
              }}
            />

            {isBuffering && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}
              >
                <Loader2 size={16} className="brand-logo-spin" />
              </div>
            )}
          </div>

          <div style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.01em'
              }}
              title={currentTrack.title}
            >
              {currentTrack.title}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '1px'
              }}
              title={currentTrack.artist}
            >
              {currentTrack.artist}
            </div>
          </div>

          {/* Desktop Like Heart Button */}
          <button
            className="desktop-only"
            onClick={(e) => {
              e.stopPropagation();
              toggleLike(currentTrack);
            }}
            style={{
              color: liked ? 'var(--accent-solid)' : 'var(--text-muted)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer',
              transition: 'transform var(--transition-fast), color var(--transition-fast)'
            }}
            title={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* ========================================================
            Mobile Mini-Player Action Controls (Right on Mobile only)
            ======================================================== */}
        <div
          className="mobile-only mini-player-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Like Button */}
          <button
            onClick={() => toggleLike(currentTrack)}
            style={{
              color: liked ? 'var(--accent-solid)' : 'var(--text-muted)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={liked ? 'Unlike' : 'Like'}
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          </button>

          {/* Play / Pause Circular Button */}
          <button
            onClick={togglePlay}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-solid)',
              color: 'var(--accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
            )}
          </button>

          {/* Next Track Button */}
          <button
            onClick={nextTrack}
            style={{
              color: 'var(--text-primary)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Next Track"
          >
            <SkipForward size={18} />
          </button>

          {/* Mobile 3-Dots More Options Button */}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            style={{
              color: isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="More Options"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        {/* ========================================================
            2. Controls & Seek Bar (Center on Desktop)
            ======================================================== */}
        <div
          className="desktop-only"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            maxWidth: '560px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          {/* Playback Controls Row: SkipBack, Play/Pause, SkipForward */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Previous Track */}
            <button
              onClick={prevTrack}
              style={{
                color: 'var(--text-secondary)',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'color var(--transition-fast)'
              }}
              title="Previous"
            >
              <SkipBack size={19} />
            </button>

            {/* Play / Pause Circular Button */}
            <button
              onClick={togglePlay}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(147, 51, 234, 0.35)',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)'
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" style={{ marginLeft: '2px' }} />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={nextTrack}
              style={{
                color: 'var(--text-secondary)',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'color var(--transition-fast)'
              }}
              title="Next"
            >
              <SkipForward size={19} />
            </button>
          </div>

          {/* Seek Bar & Timestamps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <span
              style={{
                fontSize: '0.725rem',
                color: 'var(--text-muted)',
                width: '36px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {formatTime(scrubValue)}
            </span>

            {/* Range Slider Scrubber */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.5}
                value={scrubValue}
                onChange={handleSeekChange}
                onMouseUp={handleSeekCommit}
                onTouchEnd={handleSeekCommit}
                className="player-seek-slider"
                style={{
                  width: '100%',
                  background: `linear-gradient(to right, var(--accent-solid) 0%, var(--accent-solid) ${progressPercent}%, var(--border-medium) ${progressPercent}%, var(--border-medium) 100%)`
                }}
              />
            </div>

            <span
              style={{
                fontSize: '0.725rem',
                color: 'var(--text-muted)',
                width: '36px',
                textAlign: 'left',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* ========================================================
            3. Right Actions: Volume, [Lyrics] Pill, [···] Popover Menu
            ======================================================== */}
        <div
          className="desktop-only"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            position: 'relative'
          }}
        >
          {/* Equalizer Visualizer Indicator */}
          <div
            className={`audio-visualizer ${isPlaying ? 'is-playing' : ''}`}
            style={{ marginRight: '4px' }}
            title="Audio visualizer"
          >
            <span />
            <span />
            <span />
          </div>

          {/* Volume Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleMute}
              style={{
                color: 'var(--text-secondary)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={18} />
              ) : volume < 50 ? (
                <Volume1 size={18} />
              ) : (
                <Volume2 size={18} />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolumeLevel(e.target.value)}
              className="player-volume-slider"
              style={{
                width: '80px',
                background: `linear-gradient(to right, var(--accent-solid) 0%, var(--accent-solid) ${isMuted ? 0 : volume}%, var(--border-medium) ${isMuted ? 0 : volume}%, var(--border-medium) 100%)`
              }}
              title={`Volume: ${isMuted ? 0 : volume}%`}
            />
          </div>

          {/* [🎵 Lyrics] Pill Button */}
          <button
            onClick={() => {
              setShowLyrics(true);
              setIsMobilePlayerOpen(true);
            }}
            className="player-lyrics-pill"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            title="Synchronized Lyrics & Full Player"
          >
            <Mic2 size={14} style={{ color: 'var(--accent-solid)' }} />
            <span>Lyrics</span>
          </button>

          {/* [···] 3-Dots More Options Button */}
          <button
            ref={menuButtonRef}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="player-more-btn"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isMenuOpen ? 'var(--bg-surface)' : 'transparent',
              border: '1px solid',
              borderColor: isMenuOpen ? 'var(--border-medium)' : 'transparent',
              color: isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            title="More Options"
            aria-label="More Options"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>

        {/* ========================================================
            Floating Popover Context Menu ([···] Menu)
            ======================================================== */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="player-context-popover"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              right: '16px',
              width: '230px',
              backgroundColor: 'var(--bg-card)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-medium)',
              borderRadius: '16px',
              padding: '6px',
              boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              zIndex: 1000,
              animation: 'menuSlideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            {/* 1. Lyrics & Full Player */}
            <button
              onClick={() => {
                setShowLyrics(true);
                setIsMobilePlayerOpen(true);
                setIsMenuOpen(false);
              }}
              className="popover-item"
            >
              <Mic2 size={16} style={{ color: 'var(--accent-solid)' }} />
              <span>Lyrics & Full Player</span>
            </button>

            {/* 2. Ambient Mode */}
            <button
              onClick={() => {
                setIsAmbientOpen(true);
                setIsMenuOpen(false);
              }}
              className="popover-item"
            >
              <Sparkles size={16} style={{ color: 'var(--accent-solid)' }} />
              <span>Ambient Mode</span>
            </button>

            {/* Divider */}
            <div className="popover-divider" />

            {/* 3. Add to Playlist */}
            <button
              onClick={() => {
                if (onOpenAddToPlaylist) {
                  onOpenAddToPlaylist(currentTrack);
                }
                setIsMenuOpen(false);
              }}
              className="popover-item"
            >
              <PlusCircle size={16} />
              <span>Add to playlist</span>
            </button>

            {/* 4. Add to Queue */}
            <button
              onClick={() => {
                addToQueue(currentTrack);
                setIsMenuOpen(false);
              }}
              className="popover-item"
            >
              <ListPlus size={16} />
              <span>Add to queue</span>
            </button>

            {/* Divider */}
            <div className="popover-divider" />

            {/* 5. Shuffle: On / Off */}
            <button
              onClick={() => {
                toggleShuffle();
              }}
              className="popover-item"
              style={{
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shuffle
                  size={16}
                  style={{
                    color: shuffle ? 'var(--accent-solid)' : 'inherit'
                  }}
                />
                <span>Shuffle</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: shuffle ? 'var(--accent-solid)' : 'var(--bg-surface)',
                  color: shuffle ? 'var(--accent-text)' : 'var(--text-muted)'
                }}
              >
                {shuffle ? 'On' : 'Off'}
              </span>
            </button>

            {/* 6. Repeat: Off / All / One */}
            <button
              onClick={() => {
                cycleRepeat();
              }}
              className="popover-item"
              style={{
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {repeatMode === 'one' ? (
                  <Repeat1
                    size={16}
                    style={{
                      color: 'var(--accent-solid)'
                    }}
                  />
                ) : (
                  <Repeat
                    size={16}
                    style={{
                      color: repeatMode !== 'off' ? 'var(--accent-solid)' : 'inherit'
                    }}
                  />
                )}
                <span>Repeat</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: repeatMode !== 'off' ? 'var(--accent-solid)' : 'var(--bg-surface)',
                  color: repeatMode !== 'off' ? 'var(--accent-text)' : 'var(--text-muted)',
                  textTransform: 'capitalize'
                }}
              >
                {repeatMode}
              </span>
            </button>

            {/* Divider */}
            <div className="popover-divider" />

            {/* 7. Queue (count) */}
            <button
              onClick={() => {
                if (onOpenQueue) onOpenQueue();
                setIsMenuOpen(false);
              }}
              className="popover-item"
              style={{
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ListMusic size={16} />
                <span>Queue</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)'
                }}
              >
                {queue?.length || 0}
              </span>
            </button>
          </div>
        )}
      </footer>

      {/* Fullscreen Immersive Ambient Mode Overlay */}
      <AmbientMode
        isOpen={isAmbientOpen}
        onClose={() => setIsAmbientOpen(false)}
      />
    </>
  );
}
