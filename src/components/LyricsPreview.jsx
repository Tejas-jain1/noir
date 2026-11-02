import React, { useRef, useEffect, memo } from 'react';
import { Music2, Loader2, Sparkles } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

/**
 * Calculates 3D curved perspective styling based on distance from the active line.
 * Creates an Apple Music & Spotify-inspired cylindrical curved lyrics viewport.
 */
function get3DLineStyle(distance, isActive) {
  if (isActive) {
    return {
      transform: 'perspective(800px) rotateX(0deg) translateZ(26px) scale(1.12)',
      opacity: 1,
      filter: 'blur(0px)',
      color: '#ffffff',
      fontSize: 'clamp(1.22rem, 3.6vw, 1.55rem)',
      fontWeight: 850,
      textShadow: '0 0 28px rgba(255, 255, 255, 0.42), 0 2px 10px rgba(0, 0, 0, 0.65)',
      zIndex: 10
    };
  }

  const absDist = Math.abs(distance);

  // Curved perspective: lines above tilt backwards, lines below tilt backwards
  const rotX = distance < 0 ? Math.max(-26, distance * 6.5) : Math.min(26, distance * 6.5);
  // Recede into 3D Z-plane
  const transZ = Math.max(-85, -absDist * 18);
  // Scale down gradually
  const scale = Math.max(0.76, 1 - absDist * 0.055);
  // Opacity falloff
  const opacity = absDist === 1 ? 0.62 : absDist === 2 ? 0.38 : absDist === 3 ? 0.22 : 0.12;
  // Gradual subtle blur
  const blurAmount = absDist === 1 ? 'blur(0.6px)' : absDist === 2 ? 'blur(1.6px)' : `blur(${Math.min(3.5, absDist * 0.9)}px)`;

  return {
    transform: `perspective(800px) rotateX(${rotX}deg) translateZ(${transZ}px) scale(${scale})`,
    opacity,
    filter: blurAmount,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 'clamp(1.02rem, 2.8vw, 1.25rem)',
    fontWeight: 600,
    textShadow: 'none',
    zIndex: Math.max(1, 10 - absDist)
  };
}

function LyricsPreviewComponent({
  lyricsData,
  lyricsLoading = false,
  activeLyricIndex = -1,
  seekTo = () => {},
  onOpenAmbient = null,
  currentTrack: propTrack = null,
  className = '',
  style = {}
}) {
  const { currentTrack: contextTrack } = usePlayer();
  const currentTrack = propTrack || contextTrack;

  const lyricsContainerRef = useRef(null);
  const activeLineRef = useRef(null);
  const isUserInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef(null);

  // Pause auto-scroll briefly when the user manually scrolls or touches the lyrics
  const handleUserInteraction = () => {
    isUserInteractingRef.current = true;
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    };
  }, []);

  // Reset scroll to top when new lyrics data loads for a track
  useEffect(() => {
    isUserInteractingRef.current = false;
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [lyricsData]);

  // Smoothly scroll active line to center of lyrics container ONLY.
  // NEVER calls scrollIntoView() which causes the parent page/modal to jump.
  useEffect(() => {
    const container = lyricsContainerRef.current;
    const activeLine = activeLineRef.current;
    if (!container || !activeLine || isUserInteractingRef.current) return;

    try {
      const containerRect = container.getBoundingClientRect();
      const lineRect = activeLine.getBoundingClientRect();

      // Measure position of active line relative to container's visible bounds
      const lineCenterInContainer = (lineRect.top - containerRect.top) + (lineRect.height / 2);
      const containerCenter = container.clientHeight / 2;
      const delta = lineCenterInContainer - containerCenter;

      // Only scroll the internal lyrics container
      container.scrollTo({
        top: container.scrollTop + delta,
        behavior: 'smooth'
      });
    } catch {
      // Safe fallback for environments without DOM rects
      if (typeof container.scrollTop === 'number' && typeof activeLine.offsetTop === 'number') {
        container.scrollTop = activeLine.offsetTop - (container.clientHeight / 2) + (activeLine.clientHeight / 2);
      }
    }
  }, [activeLyricIndex]);

  const handleLineClick = (time) => {
    isUserInteractingRef.current = false;
    seekTo(time);
  };

  const hasSynced = Array.isArray(lyricsData?.syncedLyrics) && lyricsData.syncedLyrics.length > 0;
  const hasPlain = !hasSynced && Boolean(lyricsData?.plainLyrics);

  return (
    <div
      className={`spotify-lyrics-card cinematic-3d-lyrics-container ${className}`.trim()}
      style={{
        width: '100%',
        borderRadius: '24px',
        backgroundColor: '#0c0c0e',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        marginTop: '16px',
        ...style
      }}
    >
      {/* 1. Dark Heavily Blurred Album Artwork Ambient Background */}
      {currentTrack?.thumbnail && (
        <div
          className="lyrics-ambient-backdrop"
          style={{
            position: 'absolute',
            inset: '-25px',
            backgroundImage: `url(${currentTrack.thumbnail})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(52px) brightness(0.22) saturate(130%)',
            opacity: 0.88,
            transform: 'scale(1.15)',
            pointerEvents: 'none',
            zIndex: 0,
            transition: 'background-image 0.6s ease-in-out'
          }}
        />
      )}

      {/* 2. Radial Vignette & Charcoal Overlay */}
      <div
        className="lyrics-vignette-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(16, 16, 20, 0.38) 0%, rgba(8, 8, 10, 0.94) 100%)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* 3. Header: "Lyrics preview", Badges & Ambient Action */}
      <div
        className="spotify-lyrics-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          userSelect: 'none',
          position: 'relative',
          zIndex: 3
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3
            className="spotify-lyrics-title"
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: '#ffffff',
              margin: 0
            }}
          >
            Lyrics preview
          </h3>

          {hasSynced ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--accent-solid)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-solid)'
                }}
              />
              Synced
            </span>
          ) : hasPlain ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.68rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)'
              }}
            >
              Plain text
            </span>
          ) : null}
        </div>

        {onOpenAmbient && (
          <button
            type="button"
            onClick={onOpenAmbient}
            title="Open Immersive Ambient Lyrics"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '4px 10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Sparkles size={12} style={{ color: 'var(--accent-solid)' }} />
            <span>Ambient</span>
          </button>
        )}
      </div>

      {/* 4. Body: 3D Curved Perspective Stage / Plain lyrics / Loading / Unavailable */}
      {lyricsLoading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '220px',
            gap: '12px',
            color: 'var(--text-muted)',
            position: 'relative',
            zIndex: 2
          }}
        >
          <Loader2 size={24} className="brand-logo-spin" style={{ color: 'var(--accent-solid)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Syncing lyrics...</span>
        </div>
      ) : hasSynced ? (
        <div
          ref={lyricsContainerRef}
          className="spotify-lyrics-scroll cinematic-3d-stage"
          onWheel={handleUserInteraction}
          onTouchStart={handleUserInteraction}
          onPointerDown={handleUserInteraction}
          style={{
            height: '350px',
            maxHeight: '380px',
            overflowY: 'auto',
            scrollBehavior: 'smooth',
            perspective: '800px',
            perspectiveOrigin: '50% 50%',
            WebkitPerspective: '800px',
            WebkitPerspectiveOrigin: '50% 50%',
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '18px',
            paddingTop: '155px',
            paddingBottom: '155px',
            paddingLeft: '14px',
            paddingRight: '14px',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            position: 'relative',
            zIndex: 2,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {lyricsData.syncedLyrics.map((line, idx) => {
            const isActive = idx === activeLyricIndex;
            const distance = activeLyricIndex === -1 ? 0 : idx - activeLyricIndex;
            const line3DStyle = get3DLineStyle(distance, isActive);

            return (
              <p
                key={`lyric-${idx}-${line.time}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => handleLineClick(line.time)}
                className={`spotify-lyric-line cinematic-3d-line ${isActive ? 'active' : ''}`}
                style={{
                  margin: 0,
                  lineHeight: 1.45,
                  textAlign: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.38s ease, filter 0.38s ease, color 0.38s ease',
                  willChange: 'transform, opacity, filter',
                  transformOrigin: 'center center',
                  maxWidth: '92%',
                  wordBreak: 'break-word',
                  boxSizing: 'border-box',
                  ...line3DStyle
                }}
                title={`Seek to ${line.text}`}
              >
                {line.text}
              </p>
            );
          })}
        </div>
      ) : hasPlain ? (
        <div
          ref={lyricsContainerRef}
          className="spotify-lyrics-scroll"
          onWheel={handleUserInteraction}
          onTouchStart={handleUserInteraction}
          onPointerDown={handleUserInteraction}
          style={{
            maxHeight: '320px',
            overflowY: 'auto',
            padding: '20px 14px 28px',
            textAlign: 'center',
            whiteSpace: 'pre-line',
            fontSize: '1.08rem',
            lineHeight: 2.1,
            color: 'rgba(255, 255, 255, 0.82)',
            fontWeight: 600,
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
            position: 'relative',
            zIndex: 2
          }}
        >
          {lyricsData.plainLyrics}
        </div>
      ) : (
        /* Clean "Lyrics unavailable" state */
        <div
          className="spotify-lyrics-empty"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 16px',
            textAlign: 'center',
            gap: '8px',
            color: 'var(--text-muted)',
            position: 'relative',
            zIndex: 2
          }}
        >
          <Music2 size={32} strokeWidth={1.5} style={{ opacity: 0.6, marginBottom: '4px' }} />
          <h4
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: '#ffffff'
            }}
          >
            Lyrics unavailable
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              maxWidth: '260px',
              lineHeight: 1.45
            }}
          >
            We couldn't find lyrics for this song.
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(LyricsPreviewComponent);
