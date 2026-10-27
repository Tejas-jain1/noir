import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { formatTime } from '../services/youtubeApi';
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
  X,
  Mic2,
  Sparkles
} from 'lucide-react';

export default function AmbientMode({ isOpen, onClose }) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    togglePlay,
    seekTo,
    nextTrack,
    prevTrack,
    setVolumeLevel,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    setShowLyrics,
    setIsMobilePlayerOpen
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  // Handle ESC key to exit Ambient Mode
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentTrack) return null;

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

  const handleOpenLyrics = () => {
    onClose();
    setShowLyrics(true);
    setIsMobilePlayerOpen(true);
  };

  return (
    <div
      className="ambient-mode-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2500,
        backgroundColor: '#070709',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '28px 24px',
        overflow: 'hidden',
        userSelect: 'none',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* Dynamic Animated Ambient Glow Backdrop */}
      <div
        className="ambient-backdrop-glow"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 0
        }}
      >
        {/* Pulsing Central Aura */}
        <div
          style={{
            position: 'absolute',
            top: '42%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '650px',
            height: '650px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-solid, #9333ea) 0%, rgba(147, 51, 234, 0.25) 40%, transparent 70%)',
            filter: 'blur(70px)',
            opacity: isPlaying ? 0.45 : 0.2,
            transition: 'opacity 1s ease',
            animation: isPlaying ? 'ambientPulse 6s ease-in-out infinite alternate' : 'none'
          }}
        />
        {/* Secondary Ambient Accent Blob */}
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '15%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
            filter: 'blur(80px)',
            opacity: 0.35
          }}
        />
      </div>

      {/* Top Bar: Brand Badge & Close Button */}
      <header
        style={{
          width: '100%',
          maxWidth: '1100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 2,
          position: 'relative'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(12px)',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.9)'
          }}
        >
          <Sparkles size={14} style={{ color: 'var(--accent-solid, #a855f7)' }} />
          <span>Ambient Mode</span>
        </div>

        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(12px)'
          }}
          title="Exit Ambient Mode (Esc)"
          aria-label="Exit Ambient Mode"
        >
          <X size={20} />
        </button>
      </header>

      {/* Center Stage: Rotating Vinyl Disc */}
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          zIndex: 2,
          position: 'relative',
          width: '100%',
          padding: '16px 0'
        }}
      >
        <div
          className="vinyl-wrapper"
          style={{
            position: 'relative',
            width: 'min(360px, 68vw)',
            height: 'min(360px, 68vw)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 60px rgba(147, 51, 234, 0.25)'
          }}
        >
          {/* Vinyl Disc Body with Grooves */}
          <div
            className="vinyl-disc"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundColor: '#0d0d10',
              backgroundImage: `
                radial-gradient(circle at center, transparent 42%, rgba(255, 255, 255, 0.04) 43%, transparent 44%),
                radial-gradient(circle at center, transparent 52%, rgba(255, 255, 255, 0.03) 53%, transparent 54%),
                radial-gradient(circle at center, transparent 63%, rgba(255, 255, 255, 0.04) 64%, transparent 65%),
                radial-gradient(circle at center, transparent 75%, rgba(255, 255, 255, 0.03) 76%, transparent 77%),
                radial-gradient(circle at center, transparent 86%, rgba(255, 255, 255, 0.04) 87%, transparent 88%)
              `,
              boxShadow: 'inset 0 0 0 2px rgba(255, 255, 255, 0.1), inset 0 0 40px rgba(0, 0, 0, 0.9)',
              animation: 'vinylSpin 18s linear infinite',
              animationPlayState: isPlaying ? 'running' : 'paused'
            }}
          >
            {/* Glossy Conic Reflection */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: `conic-gradient(
                  from 45deg,
                  rgba(255, 255, 255, 0.08) 0deg,
                  transparent 30deg,
                  transparent 150deg,
                  rgba(255, 255, 255, 0.08) 180deg,
                  transparent 210deg,
                  transparent 330deg,
                  rgba(255, 255, 255, 0.08) 360deg
                )`,
                pointerEvents: 'none'
              }}
            />

            {/* Inner Center Label (Album Art) */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '42%',
                height: '42%',
                borderRadius: '50%',
                overflow: 'hidden',
                boxShadow: '0 0 0 3px #1a1a20, 0 4px 16px rgba(0,0,0,0.7)',
                backgroundColor: '#1f1f25'
              }}
            >
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
                }}
              />
              {/* Spindle Center Hole */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: '#070709',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: 'inset 0 0 4px rgba(0,0,0,0.9)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Track Title, Artist, & Like Button */}
        <div
          style={{
            marginTop: '28px',
            textAlign: 'center',
            maxWidth: '520px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%'
            }}
          >
            <h1
              style={{
                fontSize: 'clamp(1.2rem, 3.5vw, 1.75rem)',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '85%'
              }}
              title={currentTrack.title}
            >
              {currentTrack.title}
            </h1>
            <button
              onClick={() => toggleLike(currentTrack)}
              style={{
                color: liked ? 'var(--accent-solid, #a855f7)' : 'rgba(255, 255, 255, 0.5)',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s ease'
              }}
              title={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
            >
              <Heart size={22} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>

          <p
            style={{
              fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
              color: 'rgba(255, 255, 255, 0.65)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '90%'
            }}
            title={currentTrack.artist}
          >
            {currentTrack.artist}
          </p>
        </div>
      </main>

      {/* Bottom Area: Scrubber & Playback Controls */}
      <footer
        style={{
          width: '100%',
          maxWidth: '680px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          zIndex: 2,
          position: 'relative'
        }}
      >
        {/* Progress Bar & Timestamps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
          <span
            style={{
              fontSize: '0.8rem',
              color: 'rgba(255, 255, 255, 0.6)',
              fontVariantNumeric: 'tabular-nums',
              width: '38px',
              textAlign: 'right'
            }}
          >
            {formatTime(scrubValue)}
          </span>

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
              style={{
                width: '100%',
                height: '5px',
                borderRadius: '9999px',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                background: `linear-gradient(to right, var(--accent-solid, #a855f7) 0%, var(--accent-solid, #a855f7) ${progressPercent}%, rgba(255, 255, 255, 0.2) ${progressPercent}%, rgba(255, 255, 255, 0.2) 100%)`
              }}
            />
          </div>

          <span
            style={{
              fontSize: '0.8rem',
              color: 'rgba(255, 255, 255, 0.6)',
              fontVariantNumeric: 'tabular-nums',
              width: '38px',
              textAlign: 'left'
            }}
          >
            {formatTime(duration)}
          </span>
        </div>

        {/* Primary Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
          {/* Shuffle Button */}
          <button
            onClick={toggleShuffle}
            style={{
              color: shuffle ? 'var(--accent-solid, #a855f7)' : 'rgba(255, 255, 255, 0.55)',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative'
            }}
            title={shuffle ? 'Shuffle is ON' : 'Shuffle is OFF'}
          >
            <Shuffle size={19} />
            {shuffle && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '3px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '3.5px',
                  height: '3.5px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-solid, #a855f7)'
                }}
              />
            )}
          </button>

          {/* Previous Track */}
          <button
            onClick={prevTrack}
            style={{
              color: '#ffffff',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Previous track"
          >
            <SkipBack size={24} />
          </button>

          {/* Large Center Play / Pause Button */}
          <button
            onClick={togglePlay}
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-solid, #a855f7)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(168, 85, 247, 0.4)',
              cursor: 'pointer',
              transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" style={{ marginLeft: '3px' }} />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            style={{
              color: '#ffffff',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Next track"
          >
            <SkipForward size={24} />
          </button>

          {/* Repeat Mode */}
          <button
            onClick={cycleRepeat}
            style={{
              color: repeatMode !== 'off' ? 'var(--accent-solid, #a855f7)' : 'rgba(255, 255, 255, 0.55)',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative'
            }}
            title={`Repeat mode: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}
            {repeatMode !== 'off' && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '3px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '3.5px',
                  height: '3.5px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-solid, #a855f7)'
                }}
              />
            )}
          </button>
        </div>

        {/* Secondary Row: Volume and Lyrics Shortcut */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            width: '100%',
            marginTop: '4px'
          }}
        >
          {/* Volume Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleMute}
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={17} />
              ) : volume < 50 ? (
                <Volume1 size={17} />
              ) : (
                <Volume2 size={17} />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolumeLevel(e.target.value)}
              style={{
                width: '80px',
                height: '4px',
                borderRadius: '9999px',
                appearance: 'none',
                WebkitAppearance: 'none',
                outline: 'none',
                cursor: 'pointer',
                background: `linear-gradient(to right, #ffffff 0%, #ffffff ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.25) ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.25) 100%)`
              }}
              title={`Volume: ${isMuted ? 0 : volume}%`}
            />
          </div>

          {/* Synchronized Lyrics Button */}
          <button
            onClick={handleOpenLyrics}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              backdropFilter: 'blur(10px)'
            }}
            title="View Synchronized Lyrics"
          >
            <Mic2 size={14} />
            <span>Lyrics</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
