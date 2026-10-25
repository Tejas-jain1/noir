import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { X, Tv } from 'lucide-react';

export default function YouTubeContainer() {
  const { isVideoVisible, setIsVideoVisible, currentTrack } = usePlayer();

  return (
    <div
      style={{
        position: 'fixed',
        right: '24px',
        bottom: isVideoVisible ? '106px' : '-9999px',
        width: isVideoVisible ? '340px' : '200px',
        height: isVideoVisible ? '192px' : '200px',
        opacity: isVideoVisible ? 1 : 0.001,
        pointerEvents: isVideoVisible ? 'auto' : 'none',
        zIndex: isVideoVisible ? 100 : -10,
        backgroundColor: '#000000',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Video Header Controls when visible */}
      {isVideoVisible && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            backgroundColor: 'rgba(10, 10, 12, 0.95)',
            borderBottom: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '0.75rem',
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <Tv size={13} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentTrack?.title || 'YouTube Player'}
            </span>
          </div>

          <button
            onClick={() => setIsVideoVisible(false)}
            style={{
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
              borderRadius: '4px'
            }}
            title="Minimize video player"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* The official YouTube IFrame mount target */}
      <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        <div id="noir-yt-player-iframe" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
