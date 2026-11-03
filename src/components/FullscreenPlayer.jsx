import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { formatTime } from '../services/youtubeApi';
import LyricsPreview from './LyricsPreview';
import AmbientMode from './AmbientMode';
import { getTrackFallbackArtwork, handleArtworkError } from '../services/artworkUtils';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Radio,
  Repeat,
  Repeat1,
  Heart,
  Volume2,
  VolumeX,
  Share2,
  Sparkles
} from 'lucide-react';

export default function FullscreenPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    autoplayEnabled,
    togglePlay,
    seekTo,
    nextTrack,
    prevTrack,
    setVolumeLevel,
    toggleMute,
    toggleShuffle,
    toggleAutoplay,
    cycleRepeat,
    isMobilePlayerOpen,
    setIsMobilePlayerOpen,
    lyricsData,
    lyricsLoading,
    activeLyricIndex
  } = usePlayer();

  const { isLiked, toggleLike, showToast } = useLibrary();
  const [isAmbientOpen, setIsAmbientOpen] = useState(false);

  if (!isMobilePlayerOpen || !currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${currentTrack.id}`);
      showToast('Track link copied to clipboard!', 'success');
    }
  };

  return (
    <>
      <div
        className="fullscreen-player-modal"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            position: 'sticky',
            top: 0,
            backgroundColor: 'rgba(9, 9, 11, 0.95)',
            backdropFilter: 'blur(16px)',
            zIndex: 10
          }}
        >
          <button
            type="button"
            onClick={() => setIsMobilePlayerOpen(false)}
            style={{
              color: 'var(--text-primary)',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Minimize player"
          >
            <ChevronDown size={22} />
          </button>

          <div style={{ textAlign: 'center', minWidth: 0, padding: '0 12px' }}>
            <span
              style={{
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                fontWeight: 600,
                display: 'block'
              }}
            >
              Playing From
            </span>
            <div
              style={{
                fontWeight: 700,
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '240px'
              }}
            >
              {currentTrack.album || currentTrack.title || 'NOIR Soundscape'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleShare}
              style={{
                color: 'var(--text-secondary)',
                padding: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Share song"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div
          style={{
            flex: 1,
            maxWidth: '520px',
            width: '100%',
            margin: '0 auto',
            padding: '16px 20px 48px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxSizing: 'border-box'
          }}
        >
          {/* 1. Large Cover Art */}
          <div
            style={{
              width: '100%',
              maxWidth: '340px',
              maxHeight: 'min(38vh, 340px)',
              aspectRatio: '1/1',
              margin: '0 auto',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 16px 38px rgba(0, 0, 0, 0.55)',
              position: 'relative',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)'
            }}
          >
            <img
              src={currentTrack.thumbnail || getTrackFallbackArtwork(currentTrack.title, currentTrack.artist)}
              alt={currentTrack.title}
              onError={(e) => handleArtworkError(e, getTrackFallbackArtwork(currentTrack.title, currentTrack.artist))}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />

            {/* Overlay Visualizer Badge */}
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <div className={`audio-visualizer ${isPlaying ? 'is-playing' : ''}`}>
                <span />
                <span />
                <span />
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em' }}>
                {isPlaying ? 'NOW PLAYING' : 'PAUSED'}
              </span>
            </div>
          </div>

          {/* 2. Track Info & Like */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  fontSize: 'clamp(1.2rem, 3.5vw, 1.45rem)',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: '0 0 4px',
                  color: 'var(--text-primary)'
                }}
                title={currentTrack.title}
              >
                {currentTrack.title}
              </h2>
              <p
                style={{
                  fontSize: '0.925rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: 0
                }}
              >
                {currentTrack.artist}
              </p>
            </div>

            <button
              type="button"
              onClick={() => toggleLike(currentTrack)}
              style={{
                color: liked ? 'var(--accent-solid)' : 'var(--text-muted)',
                padding: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer'
              }}
              title={liked ? 'Remove from Liked' : 'Save to Liked Songs'}
            >
              <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* 3. Scrubber Progress Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
                background: `linear-gradient(to right, var(--accent-solid) 0%, var(--accent-solid) ${progressPercent}%, var(--border-medium) ${progressPercent}%, var(--border-medium) 100%)`
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* 4. Main Playback Controls */}
          <div
            className="fullscreen-player-controls"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 4px'
            }}
          >
            <button
              type="button"
              onClick={toggleShuffle}
              style={{
                color: shuffle ? 'var(--accent-solid)' : 'var(--text-muted)',
                padding: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title={shuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
            >
              <Shuffle size={20} />
            </button>

            <button
              type="button"
              onClick={prevTrack}
              style={{
                color: 'var(--text-primary)',
                padding: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Previous Track"
            >
              <SkipBack size={26} />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(255, 255, 255, 0.15)',
                border: 'none',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)'
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" style={{ marginLeft: '3px' }} />
              )}
            </button>

            <button
              type="button"
              onClick={nextTrack}
              style={{
                color: 'var(--text-primary)',
                padding: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Next Track"
            >
              <SkipForward size={26} />
            </button>

            <button
              type="button"
              onClick={cycleRepeat}
              style={{
                color: repeatMode !== 'off' ? 'var(--accent-solid)' : 'var(--text-muted)',
                padding: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
          </div>

          {/* 5. Sub-Controls: Ambient Mode, Autoplay, Volume */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsAmbientOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
                title="Open Ambient Mode"
              >
                <Sparkles size={15} style={{ color: 'var(--accent-solid)' }} />
                <span>Ambient</span>
              </button>

              <button
                type="button"
                onClick={toggleAutoplay}
                aria-label={`Autoplay ${autoplayEnabled ? 'on' : 'off'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: autoplayEnabled ? 'var(--accent-solid)' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
                title={`Autoplay ${autoplayEnabled ? 'on' : 'off'}`}
              >
                <Radio size={14} />
                <span>Radio</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={toggleMute}
                style={{ color: 'var(--text-secondary)', display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}
                title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolumeLevel(e.target.value)}
                style={{ width: '74px', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* 6. Spotify-Inspired Always-Visible Synchronized Lyrics Preview Panel */}
          <LyricsPreview
            lyricsData={lyricsData}
            lyricsLoading={lyricsLoading}
            activeLyricIndex={activeLyricIndex}
            seekTo={seekTo}
            onOpenAmbient={() => setIsAmbientOpen(true)}
          />
        </div>
      </div>

      {/* Ambient Cinema Mode */}
      {isAmbientOpen && (
        <AmbientMode isOpen={isAmbientOpen} onClose={() => setIsAmbientOpen(false)} />
      )}
    </>
  );
}
