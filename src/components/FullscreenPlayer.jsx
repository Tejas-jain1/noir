import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { formatTime } from '../services/youtubeApi';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Volume2,
  VolumeX,
  Tv,
  Share2
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
    togglePlay,
    seekTo,
    nextTrack,
    prevTrack,
    setVolumeLevel,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    isMobilePlayerOpen,
    setIsMobilePlayerOpen,
    isVideoVisible,
    setIsVideoVisible
  } = usePlayer();

  const { isLiked, toggleLike, showToast } = useLibrary();

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflowY: 'auto'
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <button
          onClick={() => setIsMobilePlayerOpen(false)}
          style={{
            color: 'var(--text-primary)',
            padding: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Minimize player"
        >
          <ChevronDown size={22} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
            Playing From
          </span>
          <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
            {currentTrack.album || 'Noir Soundscape'}
          </div>
        </div>

        <button
          onClick={handleShare}
          style={{
            color: 'var(--text-secondary)',
            padding: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Share song"
        >
          <Share2 size={18} />
        </button>
      </div>

      {/* Main Body */}
      <div
        style={{
          flex: 1,
          maxWidth: '520px',
          width: '100%',
          margin: '0 auto',
          padding: '24px 24px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '28px'
        }}
      >
        {/* Large Cover Art with Vinyl Record effect */}
        <div
          style={{
            width: '100%',
            aspectRatio: '1/1',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            position: 'relative',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)'
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
          />

          {/* Overlay Visualizer */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div className={`audio-visualizer ${isPlaying ? 'is-playing' : ''}`}>
              <span />
              <span />
              <span />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ffffff' }}>
              {isPlaying ? 'NOW PLAYING' : 'PAUSED'}
            </span>
          </div>
        </div>

        {/* Track Info & Like */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ overflow: 'hidden' }}>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: '4px'
              }}
              title={currentTrack.title}
            >
              {currentTrack.title}
            </h2>
            <p
              style={{
                fontSize: '1rem',
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
            onClick={() => toggleLike(currentTrack)}
            style={{
              color: liked ? 'var(--text-primary)' : 'var(--text-muted)',
              padding: '12px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Heart size={22} fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Scrubber Progress Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            style={{
              width: '100%',
              background: `linear-gradient(to right, var(--accent-solid) 0%, var(--accent-solid) ${progressPercent}%, var(--border-medium) ${progressPercent}%, var(--border-medium) 100%)`
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
          <button
            onClick={toggleShuffle}
            style={{
              color: shuffle ? 'var(--accent-solid)' : 'var(--text-muted)',
              padding: '10px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Shuffle size={20} />
          </button>

          <button
            onClick={prevTrack}
            style={{
              color: 'var(--text-primary)',
              padding: '10px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <SkipBack size={26} />
          </button>

          <button
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
              boxShadow: 'var(--shadow-md)'
            }}
          >
            {isPlaying ? (
              <Pause size={28} fill="currentColor" />
            ) : (
              <Play size={28} fill="currentColor" style={{ marginLeft: '3px' }} />
            )}
          </button>

          <button
            onClick={nextTrack}
            style={{
              color: 'var(--text-primary)',
              padding: '10px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <SkipForward size={26} />
          </button>

          <button
            onClick={cycleRepeat}
            style={{
              color: repeatMode !== 'off' ? 'var(--accent-solid)' : 'var(--text-muted)',
              padding: '10px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
          </button>
        </div>

        {/* Secondary controls: Video toggle & Volume */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <button
            onClick={() => setIsVideoVisible(!isVideoVisible)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: isVideoVisible ? 'var(--accent-solid)' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <Tv size={18} />
            <span>{isVideoVisible ? 'Hide Video' : 'Watch Video'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={toggleMute} style={{ color: 'var(--text-secondary)', display: 'flex' }}>
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolumeLevel(e.target.value)}
              style={{ width: '90px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
