import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Play } from 'lucide-react';

export default function ArtistCard({ artist, onPlayArtist }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  if (!artist) return null;

  const handleClick = () => {
    navigate(`/artist/${encodeURIComponent(artist.name)}`);
  };

  return (
    <div
      className="artist-discovery-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        padding: '18px 14px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast)',
        transform: isHovered ? 'translateY(-4px)' : 'none',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'none'
      }}
    >
      {/* Circular Avatar Container */}
      <div
        style={{
          width: '110px',
          height: '110px',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-sm)',
          border: '2px solid var(--border-medium)',
          marginBottom: '12px'
        }}
      >
        <img
          src={artist.thumbnail}
          alt={artist.name}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.4s ease',
            transform: isHovered ? 'scale(1.08)' : 'scale(1)'
          }}
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
          }}
        />

        {/* Hover Play Button Overlay */}
        {onPlayArtist && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isHovered ? 1 : 0,
              transition: 'opacity var(--transition-fast)'
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayArtist(artist);
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-md)'
              }}
              title={`Play ${artist.name}`}
            >
              <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
            </button>
          </div>
        )}
      </div>

      {/* Artist Name & Role */}
      <h4
        style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          margin: '0 0 4px',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '100%'
        }}
        title={artist.name}
      >
        {artist.name}
      </h4>

      <span
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textTransform: 'capitalize',
          fontWeight: 500
        }}
      >
        {artist.role || 'Artist'}
      </span>
    </div>
  );
}
