import React, { useState } from 'react';
import { Play, ListMusic, ListPlus, Loader2 } from 'lucide-react';

export default function PlaylistCard({ playlist, onPlayPlaylist, onAddPlaylistToQueue, isLoading = false }) {
  const [isHovered, setIsHovered] = useState(false);

  if (!playlist) return null;

  const handleClick = () => {
    if (onPlayPlaylist) {
      onPlayPlaylist(playlist);
    }
  };

  return (
    <div
      className="playlist-discovery-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        padding: '14px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: 'pointer',
        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast)',
        transform: isHovered ? 'translateY(-4px)' : 'none',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'none'
      }}
    >
      {/* Artwork Container */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1/1',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        <img
          src={playlist.thumbnail}
          alt={playlist.title}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.4s ease',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)'
          }}
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
          }}
        />

        {/* Floating Actions */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all var(--transition-fast)'
          }}
        >
          {onAddPlaylistToQueue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddPlaylistToQueue(playlist);
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                boxShadow: 'var(--shadow-sm)'
              }}
              title="Add playlist to queue"
            >
              <ListPlus size={16} />
            </button>
          )}

          {onPlayPlaylist && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayPlaylist(playlist);
              }}
              disabled={isLoading}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-md)'
              }}
              title={`Play ${playlist.title}`}
            >
              {isLoading ? (
                <Loader2 size={18} className="brand-logo-spin" />
              ) : (
                <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Playlist Info */}
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
        <h4
          style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            margin: 0,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={playlist.title}
        >
          {playlist.title}
        </h4>

        <p
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={playlist.curator || 'JioSaavn Curated'}
        >
          {playlist.curator ? `By ${playlist.curator}` : 'Curated Playlist'}
        </p>

        {playlist.songCount && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {playlist.songCount} {playlist.songCount === '1' ? 'track' : 'tracks'}
          </span>
        )}
      </div>
    </div>
  );
}
