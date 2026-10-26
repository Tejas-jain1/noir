import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { saavnApi, youtubeApi } from '../services/saavnApi';
import { storage } from '../services/storage';
import TrackList from '../components/TrackList';
import SearchDropdown, { POPULAR_SEARCHES } from '../components/SearchDropdown';
import { 
  Search, 
  Loader2, 
  Play, 
  Pause,
  Key, 
  AlertCircle, 
  Music, 
  Clock, 
  X, 
  TrendingUp, 
  User, 
  Disc,
  ArrowRight
} from 'lucide-react';

export default function SearchPage({ onOpenSettings, onOpenAddToPlaylist }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInfo, setSearchInfo] = useState(null);
  const [recentSearches, setRecentSearches] = useState(() => storage.getRecentSearches());

  // Live dropdown states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState({ songs: [], artists: [], albums: [], topResult: null });
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  // Keep query in sync with URL
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
  }, [searchParams]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Sync recent searches from storage
  useEffect(() => {
    const handleStorage = () => setRecentSearches(storage.getRecentSearches());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Debounced search query for full page results (300ms)
  useEffect(() => {
    if (!query.trim()) {
      setLoading(true);
      youtubeApi.search('').then(res => {
        setResults(res.results || []);
        setSearchInfo(res);
        setLoading(false);
      });
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const data = await youtubeApi.search(query.trim());
        setResults(data.results || []);
        setSearchInfo(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  // Debounced live suggestions fetching (300ms)
  useEffect(() => {
    if (!isDropdownOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions({ songs: [], artists: [], albums: [], topResult: null });
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const data = await saavnApi.getSuggestions(trimmed, controller.signal);
        setSuggestions(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Autocomplete fetch error:', err);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isDropdownOpen]);

  // Selections
  const handleSelectSong = (song) => {
    const trackObj = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album || 'Single',
      thumbnail: song.thumbnail,
      duration: song.duration,
      durationFormatted: song.durationFormatted,
      audioUrl: song.audioUrl || null
    };

    const updated = storage.addRecentSearch({
      id: song.id,
      type: 'song',
      title: song.title,
      subtitle: `Song • ${song.artist}`,
      thumbnail: song.thumbnail,
      track: trackObj
    });
    setRecentSearches(updated);

    playTrack(trackObj);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleSelectArtist = (artist) => {
    const updated = storage.addRecentSearch({
      id: artist.id,
      type: 'artist',
      title: artist.name,
      subtitle: 'Artist',
      thumbnail: artist.thumbnail
    });
    setRecentSearches(updated);

    navigate(`/artist/${encodeURIComponent(artist.name)}`);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleSelectAlbum = (album) => {
    const updated = storage.addRecentSearch({
      id: album.id,
      type: 'album',
      title: album.title,
      subtitle: `Album • ${album.artist || ''}`.trim(),
      thumbnail: album.thumbnail
    });
    setRecentSearches(updated);

    navigate(`/album/${encodeURIComponent(album.title)}`);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleSelectQuery = (queryText) => {
    const trimmed = (queryText || query).trim();
    if (trimmed) {
      const updated = storage.addRecentSearch({
        id: `query-${trimmed.toLowerCase()}`,
        type: 'query',
        title: trimmed,
        subtitle: 'Search query',
        query: trimmed
      });
      setRecentSearches(updated);
      setQuery(trimmed);
      setSearchParams({ q: trimmed });
    } else {
      setQuery('');
      setSearchParams({});
    }
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleRemoveRecent = (id) => {
    const updated = storage.removeRecentSearch(id);
    setRecentSearches(updated);
  };

  const handleClearRecent = () => {
    const updated = storage.clearRecentSearches();
    setRecentSearches(updated);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsDropdownOpen(true);
    setActiveIndex(-1);
    if (val.trim()) {
      setSearchParams({ q: val });
    } else {
      setSearchParams({});
    }
  };

  const handleKeyDown = (e) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsDropdownOpen(true);
        e.preventDefault();
      }
      return;
    }

    const hasQuery = Boolean(query && query.trim());
    const items = !hasQuery
      ? [
          ...recentSearches.map(item => ({
            action: () => {
              if (item.type === 'song' && item.track) handleSelectSong(item.track);
              else if (item.type === 'artist') handleSelectArtist({ name: item.title, id: item.id });
              else if (item.type === 'album') handleSelectAlbum({ title: item.title, id: item.id });
              else handleSelectQuery(item.query || item.title);
            }
          })),
          ...POPULAR_SEARCHES.map(tag => ({
            action: () => handleSelectQuery(tag)
          }))
        ]
      : [
          ...(suggestions.topResult ? [{
            action: () => {
              const top = suggestions.topResult;
              if (top.type === 'artist') handleSelectArtist({ name: top.title, id: top.id });
              else if (top.type === 'album') handleSelectAlbum({ title: top.title, id: top.id });
              else handleSelectSong(top);
            }
          }] : []),
          ...(suggestions.songs || []).map(song => ({
            action: () => handleSelectSong(song)
          })),
          ...(suggestions.artists || []).map(artist => ({
            action: () => handleSelectArtist(artist)
          })),
          ...(suggestions.albums || []).map(album => ({
            action: () => handleSelectAlbum(album)
          })),
          {
            action: () => handleSelectQuery(query)
          }
        ];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length === 0) return;
      setActiveIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      setActiveIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        items[activeIndex].action();
      } else if (query.trim()) {
        handleSelectQuery(query);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsDropdownOpen(false);
      setActiveIndex(-1);
    }
  };

  const topResult = results[0];
  const isTopPlaying = topResult && currentTrack?.id === topResult.id && isPlaying;

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Search Header Input with Spotify Dropdown */}
      <div>
        <div
          ref={searchContainerRef}
          style={{ position: 'relative', maxWidth: '640px' }}
        >
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsDropdownOpen(true);
              setRecentSearches(storage.getRecentSearches());
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, artists, or keywords..."
            autoFocus
            style={{
              width: '100%',
              height: '48px',
              padding: '0 44px 0 46px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              boxShadow: 'var(--shadow-sm)',
              transition: 'border-color var(--transition-fast)'
            }}
          />

          <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {(loading || loadingSuggestions) && (
              <Loader2 size={18} className="brand-logo-spin" style={{ color: 'var(--text-muted)' }} />
            )}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSearchParams({});
                  setActiveIndex(-1);
                  if (inputRef.current) inputRef.current.focus();
                }}
                style={{
                  padding: '4px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          <SearchDropdown
            isOpen={isDropdownOpen}
            query={query}
            suggestions={suggestions}
            loading={loadingSuggestions}
            recentSearches={recentSearches}
            onRemoveRecent={handleRemoveRecent}
            onClearRecent={handleClearRecent}
            onSelectSong={handleSelectSong}
            onSelectArtist={handleSelectArtist}
            onSelectAlbum={handleSelectAlbum}
            onSelectQuery={handleSelectQuery}
            activeIndex={activeIndex}
            onHoverIndex={setActiveIndex}
          />
        </div>

        {/* Suggestion Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Try:</span>
          {POPULAR_SEARCHES.map((tag) => (
            <button
              key={tag}
              onClick={() => handleSelectQuery(tag)}
              style={{
                fontSize: '0.75rem',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-subtle)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Notice Banner if Fallback or Missing Key */}
      {searchInfo && searchInfo.source === 'fallback' && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {searchInfo.error || 'YouTube API search limit reached. Showing matching curated audio catalog.'}
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
          >
            <Key size={13} />
            <span>Settings</span>
          </button>
        </div>
      )}

      {/* Landing State: Recent Searches Grid when query is empty */}
      {!query.trim() && recentSearches.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: 'var(--text-muted)' }} />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Recent Searches</h2>
            </div>
            <button
              onClick={handleClearRecent}
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Clear all
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '14px'
            }}
          >
            {recentSearches.slice(0, 6).map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.type === 'song' && item.track) handleSelectSong(item.track);
                  else if (item.type === 'artist') handleSelectArtist({ name: item.title, id: item.id });
                  else if (item.type === 'album') handleSelectAlbum({ title: item.title, id: item.id });
                  else handleSelectQuery(item.query || item.title);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background var(--transition-fast), transform var(--transition-fast)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-subtle)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: item.type === 'artist' ? '50%' : 'var(--radius-sm)',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: item.type === 'artist' ? '50%' : 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      flexShrink: 0
                    }}
                  >
                    {item.type === 'artist' ? <User size={18} /> : item.type === 'album' ? <Disc size={18} /> : <Music size={18} />}
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
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {item.subtitle || (item.type === 'artist' ? 'Artist' : item.type === 'album' ? 'Album' : 'Song')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveRecent(item.id);
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
                    flexShrink: 0
                  }}
                  title="Remove from history"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Search Results */}
      {loading && results.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', gap: '10px' }}>
          <Loader2 size={24} className="brand-logo-spin" />
          <span>Searching audio catalog...</span>
        </div>
      ) : results.length === 0 && query.trim() ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Music size={48} strokeWidth={1.5} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>No results found for "{query}"</h3>
          <p style={{ fontSize: '0.875rem' }}>Please try searching by artist, title, or try one of the suggestions above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Result Card (if there is a query) */}
          {query.trim() && topResult && (
            <div className="search-top-result-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>Top Result</h3>
                <div
                  className="search-top-result-card"
                  onClick={() => {
                    if (currentTrack?.id === topResult.id) togglePlay();
                    else {
                      handleSelectSong(topResult);
                      playTrack(topResult, results);
                    }
                  }}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '20px',
                    border: '1px solid var(--border-medium)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <img
                    src={topResult.thumbnail}
                    alt={topResult.title}
                    style={{
                      width: '84px',
                      height: '84px',
                      borderRadius: 'var(--radius-md)',
                      objectFit: 'cover'
                    }}
                  />

                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', lineHeight: 1.2 }}>
                      {topResult.title}
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {topResult.artist} • <span style={{ textTransform: 'uppercase', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-subtle)' }}>Song</span>
                    </span>
                  </div>

                  <div style={{ position: 'absolute', bottom: '20px', right: '20px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentTrack?.id === topResult.id) togglePlay();
                        else {
                          handleSelectSong(topResult);
                          playTrack(topResult, results);
                        }
                      }}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-solid)',
                        color: 'var(--accent-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-md)'
                      }}
                    >
                      {isTopPlaying ? (
                        <Pause size={20} fill="currentColor" />
                      ) : (
                        <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Songs List */}
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>
              {query.trim() ? 'Songs' : 'All Catalog Tracks'}
            </h3>

            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '10px', border: '1px solid var(--border-subtle)' }}>
              <TrackList
                tracks={results}
                onOpenAddToPlaylist={onOpenAddToPlaylist}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
