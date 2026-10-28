import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { saavnApi, youtubeApi } from '../services/saavnApi';
import { storage } from '../services/storage';
import { createSingleTrackQueue } from '../services/playbackUtils';
import TrackList from '../components/TrackList';
import SearchSuggestions from '../components/SearchSuggestions';
import { 
  Search, 
  Loader2, 
  Play, 
  AlertCircle, 
  Music, 
  PlusCircle, 
  CheckCircle2, 
  ArrowLeft, 
  X 
} from 'lucide-react';

export default function SearchPage({ onOpenSettings, onOpenAddToPlaylist }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInfo, setSearchInfo] = useState(null);

  // Recent searched/played tracks (Spotify style)
  const [recentTracks, setRecentTracks] = useState(() => storage.getRecentSearchTracks());

  // Suggestions dropdown state
  const [suggestions, setSuggestions] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => storage.getRecentSearches());

  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { userPreferences, likedSongs, isLiked, toggleLike } = useLibrary();

  const debounceSuggestTimerRef = useRef(null);

  // Keep query in sync with URL
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
  }, [searchParams]);

  // Load initial recents from trending if storage has none
  useEffect(() => {
    if (recentTracks.length === 0) {
      youtubeApi.getTrending().then((trending) => {
        if (Array.isArray(trending) && trending.length > 0) {
          const initial = trending.slice(0, 10);
          setRecentTracks(initial);
          initial.forEach(t => storage.addRecentSearchTrack(t));
        }
      }).catch(() => {});
    }
  }, [recentTracks.length]);

  // Rank / personalize search results according to user's saved interests & liked songs
  const personalizeTracks = (tracks) => {
    if (!tracks || tracks.length === 0) return tracks;

    const prefArtists = (userPreferences?.artists || []).map(a => a.toLowerCase());
    const prefGenres = (userPreferences?.genres || []).map(g => g.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const likedArtistNames = (likedSongs || []).map(t => (t.artist || '').toLowerCase());

    if (prefArtists.length === 0 && prefGenres.length === 0 && likedArtistNames.length === 0) {
      return tracks;
    }

    return [...tracks].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      const artistA = (a.artist || '').toLowerCase();
      const artistB = (b.artist || '').toLowerCase();
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();

      // Preferred artist boost (+15)
      if (prefArtists.some(pa => artistA.includes(pa) || pa.includes(artistA))) scoreA += 15;
      if (prefArtists.some(pb => artistB.includes(pb) || pb.includes(artistB))) scoreB += 15;

      // Liked artist boost (+10)
      if (likedArtistNames.some(la => artistA.includes(la))) scoreA += 10;
      if (likedArtistNames.some(lb => artistB.includes(lb))) scoreB += 10;

      // Genre match boost (+8)
      prefGenres.forEach(genre => {
        if (titleA.includes(genre) || (a.album && a.album.toLowerCase().includes(genre))) scoreA += 8;
        if (titleB.includes(genre) || (b.album && b.album.toLowerCase().includes(genre))) scoreB += 8;
      });

      return scoreB - scoreA;
    });
  };

  // Debounced search effect (only runs when query has text)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const data = await saavnApi.search(query.trim());
        const sorted = personalizeTracks(data.results || []);
        setResults(sorted);
        setSearchInfo(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, userPreferences, likedSongs]);

  // Live autocomplete suggestions for typo tolerance
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions(null);
      setIsSuggestLoading(false);
      return;
    }

    setIsSuggestLoading(true);
    if (debounceSuggestTimerRef.current) clearTimeout(debounceSuggestTimerRef.current);

    debounceSuggestTimerRef.current = setTimeout(async () => {
      try {
        const data = await saavnApi.getAutocomplete(query.trim());
        setSuggestions(data);
      } catch (err) {
        console.warn('Autocomplete fetch error:', err);
      } finally {
        setIsSuggestLoading(false);
      }
    }, 180);

    return () => {
      if (debounceSuggestTimerRef.current) clearTimeout(debounceSuggestTimerRef.current);
    };
  }, [query]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsDropdownOpen(true);
    if (val.trim()) {
      setSearchParams({ q: val });
    } else {
      setSearchParams({});
    }
  };

  const handleSuggestionClick = (s) => {
    setQuery(s);
    setSearchParams({ q: s });
    storage.addRecentSearch(s);
    setRecentSearches(storage.getRecentSearches());
    setIsDropdownOpen(false);
  };

  const handleSelectSongFromDropdown = async (song) => {
    setIsDropdownOpen(false);
    if (!song) return;

    storage.addRecentSearch(song.title);
    setRecentSearches(storage.getRecentSearches());
    const updated = storage.addRecentSearchTrack(song);
    setRecentTracks(updated);

    if (song.audioUrl) {
      playTrack(song, createSingleTrackQueue(song), { searchQuery: query });
      return;
    }

    try {
      const full = await saavnApi.getSongDetails(song.id);
      if (full && full.audioUrl) {
        storage.addRecentSearchTrack(full);
        playTrack(full, createSingleTrackQueue(full), { searchQuery: query });
        return;
      }
    } catch {
      // Fallback
    }

    setQuery(song.title);
    setSearchParams({ q: song.title });
  };

  const handlePlayRecent = (track) => {
    const updated = storage.addRecentSearchTrack(track);
    setRecentTracks(updated);
    playTrack(track, createSingleTrackQueue(track), { searchQuery: query });
  };

  const handleRemoveRecentTrack = (trackId) => {
    const updated = storage.removeRecentSearchTrack(trackId);
    setRecentTracks(updated);
  };

  const handleClearAllRecents = () => {
    const cleared = storage.clearRecentSearchTracks();
    setRecentTracks(cleared);
  };

  const topResult = results[0];
  const isTopPlaying = topResult && currentTrack?.id === topResult.id && isPlaying;

  return (
    <div className="page-container">
      {/* 1. Search Header Input with Back Arrow (matching Spotify layout) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '640px' }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            padding: '8px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
          title="Back"
        >
          <ArrowLeft size={22} />
        </button>

        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsDropdownOpen(true);
              setRecentSearches(storage.getRecentSearches());
            }}
            placeholder="What do you want to listen to?"
            autoFocus
            style={{
              width: '100%',
              height: '46px',
              padding: query.trim() ? '0 44px 0 46px' : '0 18px 0 46px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          />

          {loading ? (
            <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 2 }}>
              <Loader2 size={18} className="brand-logo-spin" />
            </div>
          ) : query.trim() ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchParams({});
                setSuggestions(null);
              }}
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                zIndex: 2
              }}
              title="Clear search"
            >
              <X size={18} />
            </button>
          ) : null}

          {/* Smart Typo-Tolerant Suggestions Dropdown */}
          <SearchSuggestions
            query={query}
            suggestions={suggestions}
            isOpen={isDropdownOpen}
            isLoading={isSuggestLoading}
            onClose={() => setIsDropdownOpen(false)}
            onSelectSong={handleSelectSongFromDropdown}
            onSelectQuery={handleSuggestionClick}
            recentSearches={recentSearches}
            onRemoveRecent={(q) => setRecentSearches(storage.removeRecentSearch(q))}
            onClearRecent={() => setRecentSearches(storage.clearRecentSearches())}
            userInterests={userPreferences}
          />
        </div>
      </div>

      {/* 2. Recents Section: Rendered when search query is empty (Exactly matching user's Spotify screenshot) */}
      {!query.trim() && (
        <section style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Recents
            </h2>
            {recentTracks.length > 0 && (
              <button
                onClick={handleClearAllRecents}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            )}
          </div>

          {recentTracks.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Music size={40} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.9rem', margin: 0 }}>No recent searches</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentTracks.map((track) => {
                const liked = isLiked(track.id);
                const isCurrent = currentTrack?.id === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayRecent(track)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      gap: '12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)'
                    }}
                  >
                    {/* Left: Thumbnail & Song Metadata */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '4px',
                          objectFit: 'cover',
                          flexShrink: 0,
                          backgroundColor: 'var(--bg-surface)'
                        }}
                      />
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: isCurrent ? 'var(--accent-solid)' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {track.title}
                        </h4>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          Song • {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Right: Plus (+) / Checkmark (✓) and Remove (✕) */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => toggleLike(track)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: liked ? '#1ed760' : 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform var(--transition-fast)'
                        }}
                        title={liked ? 'Saved to Liked Songs' : 'Save to Liked Songs'}
                      >
                        {liked ? (
                          <CheckCircle2 size={21} fill="#1ed760" color="#000" />
                        ) : (
                          <PlusCircle size={21} />
                        )}
                      </button>

                      <button
                        onClick={() => handleRemoveRecentTrack(track.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Remove from recents"
                      >
                        <X size={19} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 3. Active Search Results: Shown only when user has typed a query */}
      {query.trim() && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Result Card if available */}
          {topResult && (
            <div className="search-top-result-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>Top Result</h3>
                <div
                  className="search-top-result-card"
                  onClick={() => {
                    const updated = storage.addRecentSearchTrack(topResult);
                    setRecentTracks(updated);
                    if (currentTrack?.id === topResult.id) togglePlay();
                    else playTrack(topResult, createSingleTrackQueue(topResult), { searchQuery: query });
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
                        const updated = storage.addRecentSearchTrack(topResult);
                        setRecentTracks(updated);
                        if (currentTrack?.id === topResult.id) togglePlay();
                        else playTrack(topResult, createSingleTrackQueue(topResult), { searchQuery: query });
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
                      <Play size={20} fill="currentColor" style={{ marginLeft: isTopPlaying ? 0 : '2px' }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Songs List */}
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>
              Songs
            </h3>

            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '10px', border: '1px solid var(--border-subtle)' }}>
              <TrackList
                tracks={results}
                onOpenAddToPlaylist={onOpenAddToPlaylist}
                onTrackPlay={(track) => playTrack(track, createSingleTrackQueue(track), { searchQuery: query })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
