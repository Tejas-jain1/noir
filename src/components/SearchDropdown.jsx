import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Music, User, Disc, ArrowRight } from 'lucide-react';

export default function SearchDropdown({
  suggestions,
  isOpen,
  onClose,
  onSelectSong,
  onSelectQuery
}) {
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !suggestions) return null;

  const { songs = [], artists = [], albums = [], topResult } = suggestions;
  const hasResults = (songs.length > 0 || artists.length > 0 || albums.length > 0 || topResult);

  if (!hasResults) return null;

  return (
    <div
      ref={dropdownRef}
      className="search-autocomplete-dropdown"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        right: 0,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        zIndex: 100,
        overflow: 'hidden',
        maxHeight: '420px',
        overflowY: 'auto'
      }}
    >
      {/* Top Match */}
      {topResult && (
        <div
          onClick={() => {
            if (topResult.type === 'artist' || topResult.role) {
              navigate(`/artist/${encodeURIComponent(topResult.title)}`);
            } else if (topResult.type === 'album') {
              navigate(`/album/${topResult.id}`);
            } else if (onSelectSong && topResult.raw) {
              onSelectSong(topResult.raw);
            } else if (onSelectQuery) {
              onSelectQuery(topResult.title);
            }
            onClose();
          }}
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
            cursor: 'pointer',
            transition: 'background var(--transition-fast)'
          }}
        >
          <img
            src={topResult.thumbnail}
            alt={topResult.title}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: topResult.type === 'artist' ? '50%' : 'var(--radius-sm)',
              objectFit: 'cover'
            }}
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80';
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', padding: '1px 6px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-subtle)' }}>
                {topResult.type || 'Top Match'}
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {topResult.title}
            </div>
            {topResult.subtitle && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {topResult.subtitle}
              </div>
            )}
          </div>
          <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
      )}

      {/* Songs Section */}
      {songs.length > 0 && (
        <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ padding: '4px 16px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            Songs
          </div>
          {songs.map((song) => (
            <div
              key={song.id}
              onClick={() => {
                if (onSelectSong) onSelectSong(song);
                onClose();
              }}
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)'
              }}
              className="dropdown-item-hover"
            >
              <img
                src={song.thumbnail}
                alt={song.title}
                style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80';
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {song.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {song.artist}
                </div>
              </div>
              <Music size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Artists Section */}
      {artists.length > 0 && (
        <div style={{ padding: '8px 0', borderBottom: albums.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
          <div style={{ padding: '4px 16px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            Artists
          </div>
          {artists.map((artist) => (
            <div
              key={artist.id}
              onClick={() => {
                navigate(`/artist/${encodeURIComponent(artist.name)}`);
                onClose();
              }}
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)'
              }}
              className="dropdown-item-hover"
            >
              <img
                src={artist.thumbnail}
                alt={artist.name}
                style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80';
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {artist.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {artist.role || 'Artist'}
                </div>
              </div>
              <User size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Albums Section */}
      {albums.length > 0 && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ padding: '4px 16px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            Albums
          </div>
          {albums.map((album) => (
            <div
              key={album.id}
              onClick={() => {
                navigate(`/album/${album.id}`);
                onClose();
              }}
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)'
              }}
              className="dropdown-item-hover"
            >
              <img
                src={album.thumbnail}
                alt={album.title}
                style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80';
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {album.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {album.artist} {album.year ? `• ${album.year}` : ''}
                </div>
              </div>
              <Disc size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
