import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Music, 
  User, 
  Disc, 
  Play, 
  History, 
  X, 
  ArrowRight, 
  Sparkles, 
  Loader2,
  TrendingUp
} from 'lucide-react';

const DEFAULT_TRENDING = [
  'Arijit Singh',
  'Lo-Fi Chill',
  'The Weeknd',
  'Diljit Dosanjh',
  'Sidhu Moose Wala',
  'Bollywood Romantic',
  'AP Dhillon',
  'Hip-Hop Beats'
];

export default function SearchSuggestions({
  query,
  suggestions,
  isOpen,
  isLoading,
  onClose,
  onSelectSong,
  onSelectQuery,
  recentSearches = [],
  onRemoveRecent,
  onClearRecent,
  userInterests = null
}) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
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

  // Reset keyboard selected index when query or open changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, isOpen]);

  const hasQuery = Boolean(query && query.trim());
  const songs = suggestions?.songs || [];
  const artists = suggestions?.artists || [];
  const albums = suggestions?.albums || [];
  const topquery = suggestions?.topquery || [];
  const topMatch = topquery[0] || songs[0] || null;

  // Flatten actionable items for keyboard navigation
  const flatItems = [];
  if (hasQuery) {
    if (topMatch) flatItems.push({ type: 'top', data: topMatch });
    songs.forEach(s => flatItems.push({ type: 'song', data: s }));
    artists.forEach(a => flatItems.push({ type: 'artist', data: a }));
    albums.forEach(al => flatItems.push({ type: 'album', data: al }));
  }

  const handleItemClick = (item) => {
    if (!item) return;
    if (item.type === 'song') {
      if (onSelectSong) onSelectSong(item.data);
      onClose();
    } else if (item.type === 'artist') {
      navigate(`/artist/${encodeURIComponent(item.data.name || item.data.title)}`);
      onClose();
    } else if (item.type === 'album') {
      navigate(`/album/${item.data.id}`);
      onClose();
    } else if (item.type === 'top') {
      if (item.data.type === 'artist') {
        navigate(`/artist/${encodeURIComponent(item.data.title || item.data.name)}`);
      } else if (item.data.type === 'album') {
        navigate(`/album/${item.data.id}`);
      } else if (onSelectSong) {
        onSelectSong(item.data);
      } else if (onSelectQuery) {
        onSelectQuery(item.data.title);
      }
      onClose();
    }
  };

  // Handle keyboard navigation (Hook declared BEFORE any early return!)
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen || flatItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % flatItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + flatItems.length) % flatItems.length);
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
          e.preventDefault();
          const item = flatItems[selectedIndex];
          handleItemClick(item);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatItems.length, selectedIndex]);

  // ALL HOOKS CALLED ABOVE - early return is now completely safe!
  if (!isOpen) return null;

  // Personalized trending chips if user has saved interests
  const personalizedChips = (userInterests?.artists?.length || userInterests?.genres?.length)
    ? [...(userInterests.artists || []), ...(userInterests.genres || [])].slice(0, 8)
    : DEFAULT_TRENDING;

  return (
    <div
      ref={containerRef}
      className="search-suggestions-dropdown"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        right: 0,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
        zIndex: 100,
        overflow: 'hidden',
        maxHeight: '480px',
        overflowY: 'auto',
        animation: 'fadeIn 0.15s ease-out',
        backdropFilter: 'blur(16px)'
      }}
    >
      {/* ─── EMPTY QUERY: Recent Searches & Recommendations ─── */}
      {!hasQuery && (
        <div style={{ padding: '16px' }}>
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={13} />
                  Recent Searches
                </span>
                {onClearRecent && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearRecent();
                    }}
                    style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    className="hover-underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {recentSearches.slice(0, 5).map((q) => (
                  <div
                    key={q}
                    onClick={() => {
                      if (onSelectQuery) onSelectQuery(q);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="dropdown-hover-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {q}
                      </span>
                    </div>

                    {onRemoveRecent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecent(q);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Remove"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended / Trending Vibes & Artists */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              {userInterests?.genres?.length ? (
                <Sparkles size={13} style={{ color: 'var(--accent-solid)' }} />
              ) : (
                <TrendingUp size={13} style={{ color: 'var(--accent-solid)' }} />
              )}
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                {userInterests?.genres?.length ? 'Recommended for Your Vibe' : 'Trending Searches'}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {personalizedChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    if (onSelectQuery) onSelectQuery(chip);
                    onClose();
                  }}
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all var(--transition-fast)'
                  }}
                  className="chip-hover-effect"
                >
                  <Search size={12} style={{ color: 'var(--text-muted)' }} />
                  <span>{chip}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── ACTIVE QUERY: Typo-Tolerant Suggestions ─── */}
      {hasQuery && (
        <div>
          {isLoading && !suggestions && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: 'var(--text-muted)', gap: '8px' }}>
              <Loader2 size={16} className="brand-logo-spin" />
              <span style={{ fontSize: '0.85rem' }}>Finding matches...</span>
            </div>
          )}

          {/* Top Result / Did You Mean Card */}
          {topMatch && (
            <div
              onClick={() => handleItemClick({ type: 'top', data: topMatch })}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'var(--bg-card)',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)'
              }}
              className="dropdown-hover-item"
            >
              <img
                src={topMatch.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&auto=format&fit=crop&q=80'}
                alt={topMatch.title}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: topMatch.type === 'artist' ? '50%' : 'var(--radius-md)',
                  objectFit: 'cover',
                  flexShrink: 0
                }}
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&auto=format&fit=crop&q=80';
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--accent-subtle)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    Top Match
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {topMatch.title}
                </div>
                {topMatch.subtitle && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {topMatch.subtitle}
                  </div>
                )}
              </div>

              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-solid)',
                  color: 'var(--accent-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Play size={14} fill="currentColor" style={{ marginLeft: '1px' }} />
              </div>
            </div>
          )}

          {/* Songs List */}
          {songs.length > 0 && (
            <div style={{ padding: '6px 0', borderBottom: (artists.length > 0 || albums.length > 0) ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ padding: '6px 16px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Songs
              </div>
              {songs.slice(0, 4).map((song) => (
                <div
                  key={song.id}
                  onClick={() => handleItemClick({ type: 'song', data: song })}
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)'
                  }}
                  className="dropdown-hover-item"
                >
                  <img
                    src={song.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'}
                    alt={song.title}
                    style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
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
                  <Music size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}

          {/* Artists List */}
          {artists.length > 0 && (
            <div style={{ padding: '6px 0', borderBottom: albums.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ padding: '6px 16px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Artists
              </div>
              {artists.slice(0, 3).map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => handleItemClick({ type: 'artist', data: artist })}
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)'
                  }}
                  className="dropdown-hover-item"
                >
                  <img
                    src={artist.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'}
                    alt={artist.name}
                    style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
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
                  <User size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}

          {/* View All Search Results Footer */}
          <div
            onClick={() => {
              if (onSelectQuery) onSelectQuery(query);
              onClose();
            }}
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface)',
              cursor: 'pointer',
              borderTop: '1px solid var(--border-subtle)'
            }}
            className="dropdown-hover-item"
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              See all results for "{query}"
            </span>
            <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
          </div>
        </div>
      )}
    </div>
  );
}
