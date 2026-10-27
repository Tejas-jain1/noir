import React, { useRef, useEffect } from 'react';
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
  Share2,
  Mic2,
  Music2,
  Loader2
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
    lyricsData,
    lyricsLoading,
    showLyrics,
    setShowLyrics,
    activeLyricIndex
  } = usePlayer();

  const { isLiked, toggleLike, showToast } = useLibrary();
  const lyricsContainerRef = useRef(null);
  const activeLineRef = useRef(null);

  // Auto-scroll to active lyric line
  useEffect(() => {
    if (showLyrics && activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeLyricIndex, showLyrics]);

  if (!isMobilePlayerOpen || !currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${currentTrack.id}`);
      showToast('Track link copied to clipboard!', 'success');
    }
  };

  const hasSyncedLyrics = lyricsData?.syncedLyrics && lyricsData.syncedLyrics.length > 0;

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
            {currentTrack.album || 'NOIR Soundscape'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            style={{
              color: showLyrics ? 'var(--accent-solid)' : 'var(--text-secondary)',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: showLyrics ? 'var(--accent-subtle)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--transition-fast)'
            }}
            title={showLyrics ? 'Show Artwork' : 'Show Synchronized Lyrics'}
          >
            <Mic2 size={18} />
          </button>

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
      </div>

      {/* Main Body */}
      <div
        style={{
          flex: 1,
          maxWidth: '520px',
          width: '100%',
          margin: '0 auto',
          padding: '24px 20px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '24px',
          boxBox: 'border-box'
        }}
      >
        {/* Center: Flip between Cover Art and Synchronized Lyrics */}
        {showLyrics ? (
          <div
            ref={lyricsContainerRef}
            style={{
              width: '100%',
              height: 'min(44vh, 380px)',
              margin: '0 auto',
              borderRadius: 'var(--radius-xl)',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              padding: '28px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: 'var(--shadow-md)',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            {lyricsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="brand-logo-spin" />
                <span style={{ fontSize: '0.85rem' }}>Fetching synchronized lyrics...</span>
              </div>
            ) : hasSyncedLyrics ? (
              lyricsData.syncedLyrics.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                return (
                  <p
                    key={`${line.time}-${idx}`}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => seekTo(line.time)}
                    style={{
                      margin: 0,
                      fontSize: isActive ? '1.25rem' : '0.95rem',
                      fontWeight: isActive ? 800 : 500,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      opacity: isActive ? 1 : 0.6,
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      lineHeight: 1.4,
                      textAlign: 'center'
                    }}
                  >
                    {line.text}
                  </p>
                );
              })
            ) : lyricsData?.plainLyrics ? (
              <div style={{ textAlign: 'center', whiteSpace: 'pre-line', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {lyricsData.plainLyrics}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                <Music2 size={36} strokeWidth={1.5} />
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>No synchronized lyrics available</p>
                <span style={{ fontSize: '0.75rem', maxWidth: '280px' }}>Lyrics are sourced from the global open LRCLIB database.</span>
              </div>
            )}
          </div>
        ) : (
          /* Large Cover Art with Vinyl Record effect */
          <div
            style={{
              width: '100%',
              maxWidth: '360px',
              maxHeight: 'min(42vh, 360px)',
              aspectRatio: '1/1',
              margin: '0 auto',
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
        )}

        {/* Track Info & Like */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: '1.4rem',
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
                fontSize: '0.95rem',
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

        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
          <button
            onClick={toggleShuffle}
            style={{
              color: shuffle ? 'var(--accent-solid)' : 'var(--text-muted)',
              padding: '10px',
              display: 'flex',
              alignItems: 'center'
            }}
            title={shuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
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
            title="Previous Track"
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
            title={isPlaying ? 'Pause' : 'Play'}
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
            title="Next Track"
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
            title={`Repeat mode: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
          </button>
        </div>

        {/* Secondary controls: Lyrics toggle, Video toggle & Volume */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowLyrics(!showLyrics)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: showLyrics ? 'var(--accent-solid)' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: showLyrics ? 'var(--accent-subtle)' : 'transparent'
              }}
            >
              <Mic2 size={16} />
              <span>{showLyrics ? 'Artwork' : 'Lyrics'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={toggleMute} style={{ color: 'var(--text-secondary)', display: 'flex' }}>
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolumeLevel(e.target.value)}
              style={{ width: '80px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
