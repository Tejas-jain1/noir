import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Music, 
  User, 
  Disc, 
  Play, 
  History, 
  X, 
  ArrowUpRight, 
  Loader2,
  Sparkles,
  ListMusic
} from 'lucide-react';
import { 
  getTrackFallbackArtwork, 
  getArtistFallbackAvatar, 
  handleArtworkError 
} from '../services/artworkUtils';
import { 
  buildIntelligentSuggestions, 
  TRENDING_SEARCH_PILLS 
} from '../services/searchSuggestionService';

/**
 * Highlights the query characters within suggested phrases for clear visual feedback
 */
function renderHighlightedText(text = '', query = '') {
  if (!query || !text) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    return <span>{text}</span>;
  }
  const prefix = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const suffix = text.slice(idx + query.length);

  return (
    <span>
      {prefix && <span style={{ color: 'var(--text-secondary)' }}>{prefix}</span>}
      <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{match}</strong>
      {suffix && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{suffix}</span>}
    </span>
  );
}

export default function SearchSuggestions({
  query = '',
  suggestions = null,
  isOpen = false,
  isLoading = false,
  onClose,
  onSelectSong,
  onSelectQuery,
  recentSearches = [],
  onRemoveRecent,
  onClearRecent,
  userInterests = null
}) {
  const containerRef = useRef(null);
  const selectedItemRef = useRef(null);
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const cleanQuery = String(query || '').trim();
  const hasQuery = Boolean(cleanQuery);

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

  // Reset keyboard selected index when query changes or dropdown opens/closes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, isOpen]);

  // Build Spotify-style intelligent suggestions from live catalog data
  const suggestionData = useMemo(() => {
    return buildIntelligentSuggestions({
      query: cleanQuery,
      suggestions,
      recentSearches,
      userInterests
    });
  }, [cleanQuery, suggestions, recentSearches, userInterests]);

  const {
    hasMatches,
    isTypo,
    correctedQuery,
    topResult,
    phraseSuggestions,
    songSuggestions,
    artistSuggestions,
    albumSuggestions,
    playlistSuggestions,
    trendingPills
  } = suggestionData;

  // Flatten actionable items for unified keyboard navigation (ArrowUp, ArrowDown, Enter)
  const flatItems = useMemo(() => {
    const items = [];
    if (!hasQuery) {
      // Empty input: Recent search items + quick trending pills
      (recentSearches || []).slice(0, 8).forEach(r => items.push({ type: 'recent', data: r }));
      (trendingPills || []).slice(0, 8).forEach(pill => items.push({ type: 'phrase', data: pill }));
      return items;
    }

    if (isTypo && correctedQuery) {
      items.push({ type: 'correction', data: correctedQuery });
    }

    if (topResult) {
      items.push({ type: 'top', data: topResult });
    }

    phraseSuggestions.forEach(p => items.push({ type: 'phrase', data: p.text }));
    songSuggestions.forEach(s => items.push({ type: 'song', data: s }));
    artistSuggestions.forEach(a => items.push({ type: 'artist', data: a }));
    albumSuggestions.forEach(al => items.push({ type: 'album', data: al }));
    playlistSuggestions.forEach(pl => items.push({ type: 'playlist', data: pl }));

    return items;
  }, [
    hasQuery, 
    recentSearches, 
    trendingPills, 
    isTypo, 
    correctedQuery, 
    topResult, 
    phraseSuggestions, 
    songSuggestions, 
    artistSuggestions, 
    albumSuggestions, 
    playlistSuggestions
  ]);

  const handleItemClick = (item) => {
    if (!item) return;

    if (item.type === 'phrase' || item.type === 'recent' || item.type === 'correction') {
      if (onSelectQuery) onSelectQuery(item.data);
      onClose();
    } else if (item.type === 'top') {
      const entity = item.data;
      if (entity.type === 'artist') {
        navigate(`/artist/${encodeURIComponent(entity.title)}`);
      } else if (entity.type === 'album') {
        navigate(`/album/${encodeURIComponent(entity.id || entity.title)}`);
      } else if (entity.type === 'playlist') {
        if (onSelectQuery) onSelectQuery(entity.title);
      } else if (entity.type === 'song') {
        if (onSelectSong) onSelectSong(entity);
      }
      onClose();
    } else if (item.type === 'song') {
      if (onSelectSong) onSelectSong(item.data);
      onClose();
    } else if (item.type === 'artist') {
      navigate(`/artist/${encodeURIComponent(item.data.name || item.data.title)}`);
      onClose();
    } else if (item.type === 'album') {
      navigate(`/album/${encodeURIComponent(item.data.id || item.data.title)}`);
      onClose();
    } else if (item.type === 'playlist') {
      if (onSelectQuery) onSelectQuery(item.data.title);
      onClose();
    }
  };

  // Keyboard navigation handler
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < flatItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : flatItems.length - 1));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
          e.preventDefault();
          handleItemClick(flatItems[selectedIndex]);
        } else if (hasQuery) {
          if (onSelectQuery) onSelectQuery(cleanQuery);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatItems, selectedIndex, hasQuery, cleanQuery, onSelectQuery, onClose]);

  // Scroll active keyboard item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

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
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.65)',
        zIndex: 100,
        overflow: 'hidden',
        maxHeight: '520px',
        overflowY: 'auto',
        animation: 'fadeIn 0.15s ease-out',
        backdropFilter: 'blur(24px)'
      }}
    >
      {/* ─── 1. EMPTY QUERY STATE: Recent Searches & Trending Shortcuts ─── */}
      {!hasQuery && (
        <div style={{ padding: '8px 0' }}>
          {recentSearches.length > 0 ? (
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 18px 6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)'
                }}
              >
                <span>Recent Searches</span>
                {onClearRecent && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearRecent();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                    className="hover-underline"
                  >
                    Clear history
                  </button>
                )}
              </div>

              {recentSearches.slice(0, 6).map((term, idx) => {
                const itemIndex = flatItems.findIndex(fi => fi.type === 'recent' && fi.data === term);
                const isSelected = selectedIndex === itemIndex;

                return (
                  <div
                    key={term + idx}
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => {
                      if (onSelectQuery) onSelectQuery(term);
                      onClose();
                    }}
                    style={{
                      padding: '10px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: '12px',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="dropdown-hover-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <History size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {term}
                      </span>
                    </div>

                    {onRemoveRecent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecent(term);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '50%'
                        }}
                        title="Remove search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Trending & Quick Explore Shortcuts */}
          <div style={{ padding: '12px 18px 8px' }}>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={13} style={{ color: 'var(--text-muted)' }} />
              <span>Trending & Recommended Searches</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {trendingPills.map((pill) => (
                <button
                  key={pill}
                  onClick={() => {
                    if (onSelectQuery) onSelectQuery(pill);
                    onClose();
                  }}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  className="dropdown-hover-item"
                >
                  <Search size={12} style={{ color: 'var(--text-muted)' }} />
                  <span>{pill}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. ACTIVE QUERY STATE: Spotify-Style Intelligent Suggestions ─── */}
      {hasQuery && (
        <div>
          {/* Loading Indicator */}
          {isLoading && !suggestions && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 18px', color: 'var(--text-muted)', gap: '10px' }}>
              <Loader2 size={16} className="brand-logo-spin" />
              <span style={{ fontSize: '0.85rem' }}>Finding matches for "{cleanQuery}"...</span>
            </div>
          )}

          {/* Spell Correction / Did You Mean Banner */}
          {isTypo && correctedQuery && (
            <div
              onClick={() => {
                if (onSelectQuery) onSelectQuery(correctedQuery);
                onClose();
              }}
              style={{
                padding: '10px 18px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '0.88rem'
              }}
              className="dropdown-hover-item"
            >
              <Sparkles size={15} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Did you mean:</span>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{correctedQuery}</strong>
            </div>
          )}

          {/* Top Result / Best Match Card */}
          {topResult && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px', paddingLeft: '4px' }}>
                Top Match
              </div>

              {(() => {
                const itemIndex = flatItems.findIndex(fi => fi.type === 'top');
                const isSelected = selectedIndex === itemIndex;
                const isArtist = topResult.type === 'artist';

                return (
                  <div
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => handleItemClick({ type: 'top', data: topResult })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
                      cursor: 'pointer',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="dropdown-hover-item"
                  >
                    <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
                      <img
                        src={topResult.image || (isArtist ? getArtistFallbackAvatar(topResult.title) : getTrackFallbackArtwork(topResult.title))}
                        alt=""
                        loading="lazy"
                        onError={(e) => handleArtworkError(e, isArtist ? getArtistFallbackAvatar(topResult.title) : getTrackFallbackArtwork(topResult.title))}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: isArtist ? '50%' : 'var(--radius-sm)',
                          backgroundColor: '#18181b'
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {topResult.title}
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          {topResult.type}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {topResult.subtitle}
                      </div>
                    </div>

                    <ArrowUpRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                );
              })()}
            </div>
          )}

          {/* Intelligent Search Phrases (Catalog & Intent-Driven) */}
          {phraseSuggestions.length > 0 && (
            <div style={{ padding: '6px 0', borderBottom: (songSuggestions.length > 0 || artistSuggestions.length > 0) ? '1px solid var(--border-subtle)' : 'none' }}>
              {phraseSuggestions.map((phrase, idx) => {
                const itemIndex = flatItems.findIndex(fi => fi.type === 'phrase' && fi.data === phrase.text);
                const isSelected = selectedIndex === itemIndex;

                return (
                  <div
                    key={phrase.text + idx}
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => {
                      if (onSelectQuery) onSelectQuery(phrase.text);
                      onClose();
                    }}
                    style={{
                      padding: '10px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: '12px',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="dropdown-hover-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      {phrase.isRecent ? (
                        <History size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      ) : (
                        <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {renderHighlightedText(phrase.text, cleanQuery)}
                      </span>
                    </div>

                    <ArrowUpRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Songs List */}
          {songSuggestions.length > 0 && (
            <div style={{ padding: '6px 0', borderBottom: artistSuggestions.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ padding: '8px 18px 4px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Songs
              </div>

              {songSuggestions.map((song) => {
                const itemIndex = flatItems.findIndex(fi => fi.type === 'song' && fi.data.id === song.id);
                const isSelected = selectedIndex === itemIndex;

                return (
                  <div
                    key={song.id}
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => {
                      if (onSelectSong) onSelectSong(song);
                      onClose();
                    }}
                    style={{
                      padding: '8px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: '12px',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="dropdown-hover-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                        <img
                          src={song.image || getTrackFallbackArtwork(song.title, song.artist)}
                          alt=""
                          loading="lazy"
                          onError={(e) => handleArtworkError(e, getTrackFallbackArtwork(song.title, song.artist))}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: '#18181b'
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {song.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {song.artist || 'Unknown Artist'}
                        </div>
                      </div>
                    </div>

                    <Play size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Artists List */}
          {artistSuggestions.length > 0 && (
            <div style={{ padding: '6px 0', borderBottom: (albumSuggestions.length > 0 || playlistSuggestions.length > 0) ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ padding: '8px 18px 4px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Artists
              </div>

              {artistSuggestions.map((artist) => {
                const itemIndex = flatItems.findIndex(fi => fi.type === 'artist' && fi.data.id === artist.id);
                const isSelected = selectedIndex === itemIndex;

                return (
                  <div
                    key={artist.id}
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => {
                      navigate(`/artist/${encodeURIComponent(artist.name || artist.title)}`);
                      onClose();
                    }}
                    style={{
                      padding: '8px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: '12px',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="dropdown-hover-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                        <img
                          src={artist.image || getArtistFallbackAvatar(artist.name || artist.title)}
                          alt=""
                          loading="lazy"
                          onError={(e) => handleArtworkError(e, getArtistFallbackAvatar(artist.name || artist.title))}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '50%',
                            backgroundColor: '#18181b'
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {artist.name || artist.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Artist
                        </div>
                      </div>
                    </div>

                    <ArrowUpRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Albums & Playlists */}
          {(albumSuggestions.length > 0 || playlistSuggestions.length > 0) && (
            <div style={{ padding: '6px 0' }}>
              <div style={{ padding: '8px 18px 4px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Albums & Playlists
              </div>

              {albumSuggestions.map((album) => {
                const itemIndex = flatItems.findIndex(fi => fi.type === 'album' && fi.data.id === album.id);
                const isSelected = selectedIndex === itemIndex;

                return (
                  <div
                    key={album.id}
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => {
                      navigate(`/album/${encodeURIComponent(album.id || album.title)}`);
                      onClose();
                    }}
                    style={{
                      padding: '8px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: '12px',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="dropdown-hover-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                        <img
                          src={album.image || getTrackFallbackArtwork(album.title, album.artist)}
                          alt=""
                          loading="lazy"
                          onError={(e) => handleArtworkError(e, getTrackFallbackArtwork(album.title, album.artist))}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: '#18181b'
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {album.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Album {album.artist ? `• ${album.artist}` : ''}
                        </div>
                      </div>
                    </div>

                    <Disc size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                );
              })}

              {playlistSuggestions.map((pl) => {
                const itemIndex = flatItems.findIndex(fi => fi.type === 'playlist' && fi.data.id === pl.id);
                const isSelected = selectedIndex === itemIndex;

                return (
                  <div
                    key={pl.id}
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => {
                      if (onSelectQuery) onSelectQuery(pl.title);
                      onClose();
                    }}
                    style={{
                      padding: '8px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: '12px',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="dropdown-hover-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                        <img
                          src={pl.image || getTrackFallbackArtwork(pl.title, 'Playlist')}
                          alt=""
                          loading="lazy"
                          onError={(e) => handleArtworkError(e, getTrackFallbackArtwork(pl.title, 'Playlist'))}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: '#18181b'
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pl.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Playlist
                        </div>
                      </div>
                    </div>

                    <ListMusic size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !hasMatches && cleanQuery.length >= 2 && (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}
              >
                <Search size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No results found for "{cleanQuery}"
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '280px', margin: '0 auto' }}>
                Check your spelling or try searching for an artist, song title, album, or mood.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
