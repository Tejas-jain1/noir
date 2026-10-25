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
  ListMusic,
  Tv,
  Maximize2,
  Loader2
} from 'lucide-react';

export default function MusicPlayer({ onOpenQueue }) {
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
    togglePlay,
    seekTo,
    nextTrack,
    prevTrack,
    setVolumeLevel,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    isVideoVisible,
    setIsVideoVisible,
    setIsMobilePlayerOpen
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  // Sync scrubValue with currentTime when not user-scrubbing
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? (scrubValue / duration) * 100 : 0;

  const handleSeekChange = (e) => {
    setIsScrubbing(true);
    setScrubValue(parseFloat(e.target.value));
  };

  const handleSeekCommit = (e) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
    setIsScrubbing(false);
  };

  return (
    <footer
      className="music-player-grid"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        position: 'relative',
        zIndex: 30,
        boxShadow: 'var(--shadow-player)',
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
          overflow: 'hidden'
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

      {/* 1. Track Info (Left on Desktop, Left on Mobile) */}
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
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            flexShrink: 0,
            backgroundColor: 'var(--bg-surface)'
          }}
          title="Click to view full player"
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
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={currentTrack.title}
          >
            {currentTrack.title}
          </div>
          <div
            style={{
              fontSize: '0.725rem',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={currentTrack.artist}
          >
            {currentTrack.artist}
          </div>
        </div>

        {/* Desktop Like Heart */}
        <button
          className="desktop-only"
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(currentTrack);
          }}
          style={{
            color: liked ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'transform var(--transition-fast)'
          }}
          title={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Mobile Mini-Player Action Controls (Right on Mobile only) */}
      <div 
        className="mobile-only mini-player-actions"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          flexShrink: 0
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Like Button */}
        <button
          onClick={() => toggleLike(currentTrack)}
          style={{
            color: liked ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={liked ? 'Unlike' : 'Like'}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>

        {/* Play / Pause Button */}
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
      </div>

      {/* 2. Controls & Scrubber (Center on Desktop) */}
      <div 
        className="desktop-only"
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '6px', 
          maxWidth: '640px', 
          margin: '0 auto', 
          width: '100%' 
        }}
      >
        {/* Playback Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          {/* Shuffle Button */}
          <button
            onClick={toggleShuffle}
            style={{
              color: shuffle ? 'var(--accent-solid)' : 'var(--text-muted)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              position: 'relative'
            }}
            title={shuffle ? 'Shuffle is ON' : 'Shuffle is OFF'}
          >
            <Shuffle size={17} />
            {shuffle && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-solid)'
                }}
              />
            )}
          </button>

          {/* Previous Track */}
          <button
            onClick={prevTrack}
            style={{
              color: 'var(--text-primary)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Previous"
          >
            <SkipBack size={19} />
          </button>

          {/* Play / Pause Primary Button */}
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
              boxShadow: 'var(--shadow-sm)',
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
              color: 'var(--text-primary)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Next"
          >
            <SkipForward size={19} />
          </button>

          {/* Repeat Mode */}
          <button
            onClick={cycleRepeat}
            style={{
              color: repeatMode !== 'off' ? 'var(--accent-solid)' : 'var(--text-muted)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              position: 'relative'
            }}
            title={`Repeat mode: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
            {repeatMode !== 'off' && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-solid)'
                }}
              />
            )}
          </button>
        </div>

        {/* Progress Bar & Timestamps */}
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

          {/* Custom Styled Slider */}
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

      {/* 3. Extras & Volume (Right on Desktop) */}
      <div 
        className="desktop-only"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end', 
          gap: '14px' 
        }}
      >
        {/* Equalizer Visualizer Indicator */}
        <div className={`audio-visualizer ${isPlaying ? 'is-playing' : ''}`} style={{ marginRight: '6px' }} title="Frequency visualizer">
          <span />
          <span />
          <span />
        </div>

        {/* Video Mode Toggle (Compliant YouTube Video PiP) */}
        <button
          onClick={() => setIsVideoVisible(!isVideoVisible)}
          style={{
            color: isVideoVisible ? 'var(--accent-solid)' : 'var(--text-muted)',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: isVideoVisible ? 'var(--accent-subtle)' : 'transparent'
          }}
          title={isVideoVisible ? 'Hide YouTube video' : 'Show YouTube video'}
        >
          <Tv size={17} />
        </button>

        {/* Queue Drawer Button */}
        <button
          onClick={onOpenQueue}
          style={{
            color: 'var(--text-secondary)',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Play Queue"
        >
          <ListMusic size={19} />
        </button>

        {/* Volume Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleMute}
            style={{
              color: 'var(--text-secondary)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
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
            style={{
              width: '84px',
              background: `linear-gradient(to right, var(--accent-solid) 0%, var(--accent-solid) ${isMuted ? 0 : volume}%, var(--border-medium) ${isMuted ? 0 : volume}%, var(--border-medium) 100%)`
            }}
            title={`Volume: ${isMuted ? 0 : volume}%`}
          />
        </div>

        {/* Fullscreen Expander */}
        <button
          onClick={() => setIsMobilePlayerOpen(true)}
          style={{
            color: 'var(--text-secondary)',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Full player"
        >
          <Maximize2 size={17} />
        </button>
      </div>
    </footer>
  );
}
