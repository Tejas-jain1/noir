import React, { useState, useEffect, useRef } from 'react';
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
  Maximize2,
  Minimize2,
  Loader2,
  Music2,
  MoreVertical,
  RotateCw,
  ArrowLeft
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
    lyricsData,
    lyricsLoading,
    activeLyricIndex
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [forcePortrait, setForcePortrait] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const lyricsContainerRef = useRef(null);
  const activeLineRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null);

  // Close 3-dots menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(e.target)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isMenuOpen]);

  // Sync scrubValue with currentTime
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  // Smoothly scroll active lyric to vertical center
  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeLyricIndex]);

  // Handle ESC and Spacebar shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, togglePlay]);

  // Auto-hide controls after inactivity for cinema experience
  const handleMouseMove = () => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, []);

  // Fullscreen / Landscape toggle
  const toggleFullscreenMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => {
        setIsFullscreen(true);
        try {
          window.screen.orientation?.lock?.('landscape').catch(() => {});
        } catch {}
      }).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  if (!isOpen || !currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? (scrubValue / duration) * 100 : 0;
  const hasSyncedLyrics = lyricsData?.syncedLyrics && lyricsData.syncedLyrics.length > 0;
  const hasPlainLyrics = !hasSyncedLyrics && Boolean(lyricsData?.plainLyrics);

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
    <div
      className={`ambient-mode-overlay ${forcePortrait ? 'disable-mobile-rotation' : ''}`}
      onMouseMove={handleMouseMove}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        backgroundColor: '#0a0a0c',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        userSelect: 'none',
        animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* ─── 1. Moody Dynamic Blurred Ambient Backdrop ─── */}
      <div
        className="ambient-backdrop-image"
        style={{
          position: 'absolute',
          inset: '-20px',
          backgroundImage: `url(${currentTrack.thumbnail})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(90px) brightness(0.28) saturate(180%)',
          transform: 'scale(1.15)',
          zIndex: 0,
          pointerEvents: 'none',
          transition: 'background-image 0.8s ease'
        }}
      />
      <div
        className="ambient-backdrop-vignette"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(14, 14, 18, 0.35) 0%, rgba(6, 6, 8, 0.88) 85%)',
          zIndex: 1,
          pointerEvents: 'none'
        }}
      />

      {/* ─── 2. Top Navigation Bar (3-Dots, Fullscreen & Exit) ─── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 32px',
          zIndex: 10,
          position: 'relative',
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 0.35s ease'
        }}
      >
        {/* Left: 3-Dots More Options Button & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            ref={menuBtnRef}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            style={{
              background: isMenuOpen ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(16px)',
              transition: 'all 0.2s ease'
            }}
            title="Options Menu"
          >
            <MoreVertical size={18} />
          </button>

          {/* 3-Dots Dropdown Menu */}
          {isMenuOpen && (
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: '220px',
                backgroundColor: 'rgba(18, 18, 24, 0.94)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '16px',
                padding: '6px',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.75)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                animation: 'fadeIn 0.15s ease-out'
              }}
            >
              {/* Back to normal mode */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onClose();
                }}
                className="ambient-menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#ffffff',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease'
                }}
              >
                <ArrowLeft size={16} style={{ color: 'var(--accent-solid, #a855f7)' }} />
                <span>Back to normal mode</span>
              </button>

              <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)', margin: '2px 6px' }} />

              {/* Rotate Orientation */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setForcePortrait((prev) => !prev);
                }}
                className="ambient-menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '0.86rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease'
                }}
              >
                <RotateCw size={16} />
                <span>{forcePortrait ? 'Horizontal View' : 'Vertical View'}</span>
              </button>

              {/* Fullscreen toggle */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  toggleFullscreenMode();
                }}
                className="ambient-menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '0.86rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease'
                }}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Rotate 90° Horizontal Toggle Button */}
          <button
            onClick={() => setForcePortrait((prev) => !prev)}
            style={{
              background: forcePortrait ? 'var(--accent-solid, #a855f7)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(16px)',
              transition: 'all 0.2s ease'
            }}
            title={forcePortrait ? 'Rotate to Horizontal' : 'Rotate to Vertical'}
          >
            <RotateCw size={17} />
          </button>

          {/* Fullscreen / Rotate Screen Button */}
          <button
            onClick={toggleFullscreenMode}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(16px)'
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Landscape Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(16px)'
            }}
            title="Exit Ambient Mode (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* ─── 3. Horizontal Cinema Split Stage (Artwork on Left, Synchronized Lyrics on Right) ─── */}
      <main
        className="ambient-cinema-stage"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0 40px',
          gap: 'clamp(36px, 6vw, 84px)',
          zIndex: 5,
          position: 'relative',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {/* LEFT COLUMN: Song Artwork & Details */}
        <div
          className="ambient-artwork-column"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '16px',
            flexShrink: 0,
            maxWidth: '420px',
            width: 'clamp(220px, 30vw, 380px)',
            position: 'relative'
          }}
        >
          {/* Cover Container with Dynamic Halo Glow & 3D Float */}
          <div
            className="ambient-cover-container"
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1/1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* 1. Pulsing Ambient Halo Aura behind artwork */}
            <div
              className="ambient-art-halo"
              style={{
                position: 'absolute',
                inset: '-16px',
                borderRadius: '36px',
                background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.6) 0%, rgba(59, 130, 246, 0.25) 45%, transparent 75%)',
                filter: 'blur(30px)',
                opacity: isPlaying ? 0.85 : 0.35,
                zIndex: 0,
                animation: isPlaying ? 'artHaloBreathe 4s ease-in-out infinite alternate' : 'none',
                pointerEvents: 'none'
              }}
            />

            {/* 2. Rotating Luminous Color Orbit */}
            <div
              className="ambient-art-orbit"
              style={{
                position: 'absolute',
                inset: '-4px',
                borderRadius: '26px',
                background: 'conic-gradient(from 0deg, var(--accent-solid, #a855f7), #3b82f6, #ec4899, var(--accent-solid, #a855f7))',
                opacity: isPlaying ? 0.35 : 0.1,
                filter: 'blur(8px)',
                zIndex: 0,
                animation: isPlaying ? 'spin 14s linear infinite' : 'none',
                pointerEvents: 'none'
              }}
            />

            {/* 3. 3D Floating Cover Art */}
            <div
              className="ambient-cover-wrapper"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '24px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                backgroundColor: '#18181c',
                position: 'relative',
                zIndex: 2,
                animation: isPlaying ? 'art3dFloat 6s ease-in-out infinite alternate' : 'none',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 35px rgba(168, 85, 247, 0.25)'
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
                  e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';
                }}
              />
            </div>
          </div>

          {/* Track Info & Like */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: '12px'
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                style={{
                  fontSize: 'clamp(1.25rem, 2.2vw, 1.75rem)',
                  fontWeight: 700,
                  margin: 0,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '-0.02em',
                  textShadow: '0 2px 10px rgba(0,0,0,0.6)'
                }}
                title={currentTrack.title}
              >
                {currentTrack.title}
              </h2>
              <p
                style={{
                  fontSize: 'clamp(0.9rem, 1.5vw, 1.1rem)',
                  color: 'rgba(255, 255, 255, 0.65)',
                  margin: '4px 0 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={currentTrack.artist}
              >
                {currentTrack.artist}
              </p>
            </div>

            <button
              onClick={() => toggleLike(currentTrack)}
              style={{
                color: liked ? 'var(--accent-solid, #a855f7)' : 'rgba(255, 255, 255, 0.5)',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(12px)',
                flexShrink: 0
              }}
              title={liked ? 'Remove from Liked' : 'Save to Liked'}
            >
              <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: 3D Spatial Animated Synchronized Lyrics */}
        <div
          ref={lyricsContainerRef}
          className="ambient-lyrics-column"
          style={{
            flex: 1,
            height: 'min(560px, 75vh)',
            overflowY: 'auto',
            position: 'relative',
            perspective: '1200px',
            perspectiveOrigin: 'center center',
            transformStyle: 'preserve-3d',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {lyricsLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                height: '100%',
                gap: '14px',
                color: 'rgba(255, 255, 255, 0.5)'
              }}
            >
              <Loader2 size={28} className="brand-logo-spin" style={{ color: 'var(--accent-solid, #a855f7)' }} />
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Syncing lyrics...</span>
            </div>
          ) : hasSyncedLyrics ? (
            <div
              style={{
                paddingTop: '200px',
                paddingBottom: '200px',
                display: 'flex',
                flexDirection: 'column',
                gap: '28px',
                transformStyle: 'preserve-3d'
              }}
            >
              {lyricsData.syncedLyrics.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                const dist = activeLyricIndex >= 0 ? Math.abs(idx - activeLyricIndex) : 1;
                const isPast = idx < activeLyricIndex;

                let zTranslate = 0;
                let scale = 1;
                let blur = 0;
                let opacity = 0.4;
                let rotateX = 0;

                if (isActive) {
                  zTranslate = 36;
                  scale = 1.06;
                  blur = 0;
                  opacity = 1;
                  rotateX = 0;
                } else if (dist === 1) {
                  zTranslate = 8;
                  scale = 0.98;
                  blur = 0.6;
                  opacity = 0.55;
                  rotateX = isPast ? 3 : -3;
                } else if (dist === 2) {
                  zTranslate = -18;
                  scale = 0.92;
                  blur = 1.8;
                  opacity = 0.32;
                  rotateX = isPast ? 6 : -6;
                } else {
                  zTranslate = -45;
                  scale = 0.86;
                  blur = 3.2;
                  opacity = 0.14;
                  rotateX = isPast ? 8 : -8;
                }

                return (
                  <p
                    key={`${line.time}-${idx}`}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => seekTo(line.time)}
                    style={{
                      margin: 0,
                      fontSize: isActive
                        ? 'clamp(1.5rem, 3vw, 2.35rem)'
                        : 'clamp(1.15rem, 2.1vw, 1.65rem)',
                      fontWeight: isActive ? 800 : 600,
                      color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                      lineHeight: 1.35,
                      letterSpacing: '-0.02em',
                      cursor: 'pointer',
                      transform: `perspective(1000px) translateZ(${zTranslate}px) scale(${scale}) rotateX(${rotateX}deg)`,
                      transformOrigin: 'left center',
                      filter: `blur(${blur}px)`,
                      opacity,
                      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      textShadow: isActive
                        ? '0 0 28px rgba(255, 255, 255, 0.55), 0 0 60px rgba(168, 85, 247, 0.3), 0 2px 10px rgba(0,0,0,0.9)'
                        : 'none'
                    }}
                    className={`ambient-lyric-line ${isActive ? 'is-active-3d' : ''}`}
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          ) : hasPlainLyrics ? (
            <div
              style={{
                padding: '40px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                whiteSpace: 'pre-line',
                fontSize: 'clamp(1.1rem, 2vw, 1.45rem)',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.75)',
                lineHeight: 1.8
              }}
            >
              {lyricsData.plainLyrics}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                height: '100%',
                gap: '12px',
                color: 'rgba(255, 255, 255, 0.5)'
              }}
            >
              <Music2 size={36} strokeWidth={1.5} style={{ color: 'var(--accent-solid, #a855f7)' }} />
              <h3 style={{ fontSize: '1.3rem', margin: 0, color: '#ffffff' }}>Instrumental / No Lyrics Available</h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.55)' }}>
                Enjoy the ambient soundscape and music vibes.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ─── 4. Sleek Floating Bottom Controls Dock ─── */}
      <footer
        style={{
          width: '100%',
          maxWidth: '780px',
          margin: '0 auto 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 24px',
          borderRadius: '24px',
          backgroundColor: 'rgba(18, 18, 24, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          zIndex: 10,
          position: 'relative',
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 0.35s ease'
        }}
      >
        {/* Scrubber & Timestamps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255, 255, 255, 0.65)',
              fontVariantNumeric: 'tabular-nums',
              width: '36px',
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
                height: '4px',
                borderRadius: '9999px',
                appearance: 'none',
                WebkitAppearance: 'none',
                outline: 'none',
                cursor: 'pointer',
                background: `linear-gradient(to right, var(--accent-solid, #a855f7) 0%, var(--accent-solid, #a855f7) ${progressPercent}%, rgba(255, 255, 255, 0.2) ${progressPercent}%, rgba(255, 255, 255, 0.2) 100%)`
              }}
            />
          </div>

          <span
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255, 255, 255, 0.65)',
              fontVariantNumeric: 'tabular-nums',
              width: '36px',
              textAlign: 'left'
            }}
          >
            {formatTime(duration)}
          </span>
        </div>

        {/* Playback Controls & Volume */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '0 8px'
          }}
        >
          {/* Shuffle Button */}
          <button
            onClick={toggleShuffle}
            style={{
              color: shuffle ? 'var(--accent-solid, #a855f7)' : 'rgba(255, 255, 255, 0.55)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              position: 'relative'
            }}
            title={shuffle ? 'Shuffle is ON' : 'Shuffle is OFF'}
          >
            <Shuffle size={17} />
          </button>

          {/* Center Track Buttons: Prev, Play/Pause, Next */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <button
              onClick={prevTrack}
              style={{
                color: '#ffffff',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              title="Previous Track"
            >
              <SkipBack size={21} />
            </button>

            <button
              onClick={togglePlay}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.16)',
                border: '1px solid rgba(255, 255, 255, 0.28)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.15s ease'
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={20} fill="#ffffff" />
              ) : (
                <Play size={20} fill="#ffffff" style={{ marginLeft: '2px' }} />
              )}
            </button>

            <button
              onClick={nextTrack}
              style={{
                color: '#ffffff',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              title="Next Track"
            >
              <SkipForward size={21} />
            </button>
          </div>

          {/* Repeat Mode */}
          <button
            onClick={cycleRepeat}
            style={{
              color: repeatMode !== 'off' ? 'var(--accent-solid, #a855f7)' : 'rgba(255, 255, 255, 0.55)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}
            title={`Repeat mode: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
          </button>

          {/* Volume Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleMute}
              style={{
                color: 'rgba(255, 255, 255, 0.65)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={16} />
              ) : volume < 50 ? (
                <Volume1 size={16} />
              ) : (
                <Volume2 size={16} />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolumeLevel(e.target.value)}
              style={{
                width: '74px',
                height: '3px',
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
        </div>
      </footer>
    </div>
  );
}
