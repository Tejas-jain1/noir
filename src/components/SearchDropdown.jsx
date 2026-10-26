import React, { useEffect, useRef } from 'react';
import { 
  Play, 
  Search, 
  Clock, 
  X, 
  Disc, 
  User, 
  Music, 
  ArrowRight, 
  TrendingUp, 
  Loader2,
  Sparkles
} from 'lucide-react';

// Popular trending topics / artists for search landing state
export const POPULAR_SEARCHES = [
  'The Weeknd',
  'Dua Lipa',
  'Coldplay',
  'Arijit Singh',
  'Taylor Swift',
  'Billie Eilish',
  'Kendrick Lamar',
  'Daft Punk',
  'Synthwave'
];

// Highlights matching query text inside title/subtitle
export function HighlightMatch({ text = '', query = '' }) {
  if (!query || !query.trim() || !text) {
    return <span>{text}</span>;
  }

  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = String(text).split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={i}
            style={{
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              padding: '0 2px',
              borderRadius: '2px'
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default function SearchDropdown({
  isOpen,
  query,
  suggestions,
  loading,
  recentSearches = [],
  onRemoveRecent,
  onClearRecent,
  onSelectSong,
  onSelectArtist,
  onSelectAlbum,
  onSelectQuery,
  activeIndex = -1,
  onHoverIndex,
  dropdownRef
}) {
  const activeItemRef = useRef(null);

  // Automatically scroll active item into view during keyboard navigation
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  const hasQuery = Boolean(query && query.trim());
  const { songs = [], artists = [], albums = [], topResult = null } = suggestions || {};
  const hasResults = (songs.length > 0 || artists.length > 0 || albums.length > 0 || Boolean(topResult));

  // Running index tracker to map each rendered item to a single flat index
  let currentIndexTracker = 0;

  return (
    <div
      ref={dropdownRef}
      className="search-dropdown-menu"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        right: 0,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        maxHeight: 'min(72vh, 520px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 1000,
        padding: '10px 0',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      {/* 1. Empty Query Landing State: Recent Searches & Trending Topics */}
      {!hasQuery && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Recent Searches */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 16px 8px',
                borderBottom: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Recent Searches
                </span>
              </div>
              {recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClearRecent();
                  }}
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'color var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  Clear all
                </button>
              )}
            </div>

            {recentSearches.length === 0 ? (
              <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No recent searches. Try searching for a song, artist, or album.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentSearches.map((item) => {
                  const thisIndex = currentIndexTracker++;
                  const isActive = activeIndex === thisIndex;

                  return (
                    <div
                      key={item.id}
                      ref={isActive ? activeItemRef : null}
                      onClick={() => {
                        if (item.type === 'song' && item.track) {
                          onSelectSong(item.track);
                        } else if (item.type === 'artist') {
                          onSelectArtist({ name: item.title, id: item.id });
                        } else if (item.type === 'album') {
                          onSelectAlbum({ title: item.title, id: item.id });
                        } else {
                          onSelectQuery(item.query || item.title);
                        }
                      }}
                      onMouseEnter={() => onHoverIndex && onHoverIndex(thisIndex)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                        transition: 'background var(--transition-fast)',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt=""
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: item.type === 'artist' ? '50%' : 'var(--radius-sm)',
                              objectFit: 'cover',
                              flexShrink: 0,
                              backgroundColor: 'var(--bg-card)'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: item.type === 'artist' ? '50%' : 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-card)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted)',
                              flexShrink: 0
                            }}
                          >
                            {item.type === 'artist' ? <User size={16} /> : item.type === 'album' ? <Disc size={16} /> : item.type === 'song' ? <Music size={16} /> : <Search size={16} />}
                          </div>
                        )}

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {item.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {item.subtitle || (item.type === 'artist' ? 'Artist' : item.type === 'album' ? 'Album' : 'Song')}
                          </div>
                        </div>
                      </div>

                      {/* Remove single item button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemoveRecent(item.id);
                        }}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          padding: 0,
                          flexShrink: 0,
                          transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--text-primary)';
                          e.currentTarget.style.backgroundColor = 'var(--border-subtle)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Remove from history"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trending Searches */}
          <div style={{ padding: '0 16px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <TrendingUp size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Trending Searches
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {POPULAR_SEARCHES.map((tag) => {
                const thisIndex = currentIndexTracker++;
                const isActive = activeIndex === thisIndex;

                return (
                  <button
                    key={tag}
                    type="button"
                    ref={isActive ? activeItemRef : null}
                    onClick={() => onSelectQuery(tag)}
                    onMouseEnter={() => onHoverIndex && onHoverIndex(thisIndex)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isActive ? 'var(--accent-solid)' : 'var(--bg-card)',
                      color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. Active Query State: Top Result, Songs, Artists, Albums */}
      {hasQuery && (
        <div>
          {/* Subtle Loading indicator */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px 10px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <Loader2 size={13} className="brand-logo-spin" />
              <span>Searching music catalog...</span>
            </div>
          )}

          {/* Empty Result */}
          {!loading && !hasResults && (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Search size={32} strokeWidth={1.5} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No results found for "{query}"
              </div>
              <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                Please check your spelling or search for another song, artist, or album.
              </p>
            </div>
          )}

          {/* Top Result Card */}
          {topResult && (
            <div style={{ padding: '4px 16px 12px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Top Result
              </div>
              {(() => {
                const thisIndex = currentIndexTracker++;
                const isActive = activeIndex === thisIndex;

                return (
                  <div
                    ref={isActive ? activeItemRef : null}
                    onClick={() => {
                      if (topResult.type === 'artist') {
                        onSelectArtist({ name: topResult.title, id: topResult.id });
                      } else if (topResult.type === 'album') {
                        onSelectAlbum({ title: topResult.title, id: topResult.id });
                      } else {
                        onSelectSong(topResult);
                      }
                    }}
                    onMouseEnter={() => onHoverIndex && onHoverIndex(thisIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'var(--accent-subtle)' : 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <img
                      src={topResult.thumbnail}
                      alt={topResult.title}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: topResult.type === 'artist' ? '50%' : 'var(--radius-sm)',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        <HighlightMatch text={topResult.title} query={query} />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '4px'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--accent-solid)',
                            color: 'var(--accent-text)',
                            textTransform: 'uppercase'
                          }}
                        >
                          {topResult.type || 'Result'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {topResult.subtitle}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-solid)',
                        color: 'var(--accent-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {topResult.type === 'artist' ? <User size={16} /> : topResult.type === 'album' ? <Disc size={16} /> : <Play size={16} fill="currentColor" />}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Songs Section */}
          {songs.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 16px 4px' }}>
                Songs
              </div>
              {songs.map((song) => {
                const thisIndex = currentIndexTracker++;
                const isActive = activeIndex === thisIndex;

                return (
                  <div
                    key={song.id}
                    ref={isActive ? activeItemRef : null}
                    onClick={() => onSelectSong(song)}
                    onMouseEnter={() => onHoverIndex && onHoverIndex(thisIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                      transition: 'background var(--transition-fast)',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                        <img
                          src={song.thumbnail}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: 'var(--radius-sm)',
                            objectFit: 'cover'
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          <HighlightMatch text={song.title} query={query} />
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          <HighlightMatch text={song.artist} query={query} />
                          {song.album && <span style={{ opacity: 0.6 }}> • {song.album}</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      {song.durationFormatted && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {song.durationFormatted}
                        </span>
                      )}
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-primary)',
                          backgroundColor: isActive ? 'var(--accent-solid)' : 'transparent'
                        }}
                      >
                        <Play size={13} fill="currentColor" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Artists Section */}
          {artists.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 16px 4px' }}>
                Artists
              </div>
              {artists.map((artist) => {
                const thisIndex = currentIndexTracker++;
                const isActive = activeIndex === thisIndex;

                return (
                  <div
                    key={artist.id}
                    ref={isActive ? activeItemRef : null}
                    onClick={() => onSelectArtist(artist)}
                    onMouseEnter={() => onHoverIndex && onHoverIndex(thisIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                  >
                    <img
                      src={artist.thumbnail}
                      alt={artist.name}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        <HighlightMatch text={artist.name} query={query} />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {artist.role || 'Artist'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Albums Section */}
          {albums.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 16px 4px' }}>
                Albums
              </div>
              {albums.map((album) => {
                const thisIndex = currentIndexTracker++;
                const isActive = activeIndex === thisIndex;

                return (
                  <div
                    key={album.id}
                    ref={isActive ? activeItemRef : null}
                    onClick={() => onSelectAlbum(album)}
                    onMouseEnter={() => onHoverIndex && onHoverIndex(thisIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                  >
                    <img
                      src={album.thumbnail}
                      alt={album.title}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-sm)',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        <HighlightMatch text={album.title} query={query} />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Album {album.artist ? `• ${album.artist}` : ''} {album.year ? `(${album.year})` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* See all results footer */}
          {(() => {
            const thisIndex = currentIndexTracker++;
            const isActive = activeIndex === thisIndex;

            return (
              <div
                ref={isActive ? activeItemRef : null}
                onClick={() => onSelectQuery(query)}
                onMouseEnter={() => onHoverIndex && onHoverIndex(thisIndex)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderTop: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  transition: 'background var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={15} style={{ color: 'var(--text-muted)' }} />
                  <span>See all results for "{query}"</span>
                </div>
                <ArrowRight size={15} style={{ color: 'var(--text-muted)' }} />
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
