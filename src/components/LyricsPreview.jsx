import React, { useRef, useEffect } from 'react';
import { Music2, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

export default function LyricsPreview({
  lyricsData,
  lyricsLoading = false,
  activeLyricIndex = -1,
  seekTo = () => {},
  onOpenAmbient = null,
  className = '',
  style = {}
}) {
  const lyricsContainerRef = useRef(null);
  const activeLineRef = useRef(null);

  // Smoothly scroll active line to center of lyrics container
  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeLyricIndex]);

  const hasSynced = Array.isArray(lyricsData?.syncedLyrics) && lyricsData.syncedLyrics.length > 0;
  const hasPlain = !hasSynced && Boolean(lyricsData?.plainLyrics);

  return (
    <div
      className={`spotify-lyrics-card ${className}`.trim()}
      style={{
        width: '100%',
        borderRadius: '22px',
        background: 'linear-gradient(180deg, #18181b 0%, #101012 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.45)',
        padding: '22px 20px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        marginTop: '16px',
        ...style
      }}
    >
      {/* 1. Header: "Lyrics preview" */}
      <div
        className="spotify-lyrics-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3
            className="spotify-lyrics-title"
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              margin: 0
            }}
          >
            Lyrics preview
          </h3>

          {hasSynced && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--accent-solid)',
                backgroundColor: 'var(--accent-subtle)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)'
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
          )}
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
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '4px 10px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Sparkles size={12} style={{ color: 'var(--accent-solid)' }} />
            <span>Ambient</span>
          </button>
        )}
      </div>

      {/* 2. Body: Synchronized lines / Plain lyrics / Loading / Unavailable */}
      {lyricsLoading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '180px',
            gap: '12px',
            color: 'var(--text-muted)'
          }}
        >
          <Loader2 size={24} className="brand-logo-spin" style={{ color: 'var(--accent-solid)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Syncing lyrics...</span>
        </div>
      ) : hasSynced ? (
        <div
          ref={lyricsContainerRef}
          className="spotify-lyrics-scroll"
          style={{
            maxHeight: '320px',
            overflowY: 'auto',
            scrollBehavior: 'smooth',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '12px 4px 28px',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 85%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 85%, transparent 100%)'
          }}
        >
          {lyricsData.syncedLyrics.map((line, idx) => {
            const isActive = idx === activeLyricIndex;
            const isPast = activeLyricIndex !== -1 && idx < activeLyricIndex;

            return (
              <p
                key={`${line.time}-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => seekTo(line.time)}
                className={`spotify-lyric-line ${isActive ? 'active' : ''}`}
                style={{
                  margin: 0,
                  fontSize: isActive ? 'clamp(1.15rem, 3.2vw, 1.35rem)' : 'clamp(1.02rem, 2.8vw, 1.18rem)',
                  fontWeight: isActive ? 800 : 700,
                  lineHeight: 1.45,
                  color: isActive ? '#ffffff' : isPast ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.55)',
                  opacity: isActive ? 1 : isPast ? 0.45 : 0.65,
                  cursor: 'pointer',
                  transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isActive ? 'scale(1.02)' : 'scale(1)',
                  transformOrigin: 'left center',
                  textShadow: isActive ? '0 0 18px rgba(255, 255, 255, 0.25)' : 'none',
                  textAlign: 'left',
                  userSelect: 'none'
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
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '12px 4px 20px',
            textAlign: 'left',
            whiteSpace: 'pre-line',
            fontSize: '1.05rem',
            lineHeight: 1.8,
            color: 'var(--text-secondary)',
            fontWeight: 600,
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 85%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 85%, transparent 100%)'
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
            padding: '36px 16px',
            textAlign: 'center',
            gap: '8px',
            color: 'var(--text-muted)'
          }}
        >
          <Music2 size={30} strokeWidth={1.5} style={{ opacity: 0.6, marginBottom: '4px' }} />
          <h4
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-primary)'
            }}
          >
            Lyrics unavailable
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              maxWidth: '260px',
              lineHeight: 1.4
            }}
          >
            We couldn't find synchronized lyrics for this song.
          </p>
        </div>
      )}
    </div>
  );
}
