import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { saavnApi, youtubeApi } from '../services/saavnApi';
import { storage } from '../services/storage';
import TrackList from '../components/TrackList';
import SearchSuggestions from '../components/SearchSuggestions';
import { Search, Loader2, Play, Key, AlertCircle, Music, Sparkles, X } from 'lucide-react';

const DEFAULT_SUGGESTIONS = [
  'The Weeknd',
  'Arijit Singh',
  'Lo-Fi Chill',
  'Dua Lipa',
  'Billie Eilish',
  'Diljit Dosanjh',
  'Kendrick Lamar',
  'Sidhu Moose Wala',
  'Synthwave'
];

export default function SearchPage({ onOpenSettings, onOpenAddToPlaylist }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInfo, setSearchInfo] = useState(null);

  // Suggestions dropdown state
  const [suggestions, setSuggestions] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => storage.getRecentSearches());

  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { userPreferences, likedSongs } = useLibrary();

  const debounceSuggestTimerRef = useRef(null);

  // Keep query in sync with URL
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
  }, [searchParams]);

  // Rank / personalize results according to user's saved interests & liked songs
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

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      setLoading(true);
      // If user has preferred vibe or artist, load personalized recommendations
      const initialKeyword = userPreferences?.genres?.[0] || userPreferences?.artists?.[0] || '';
      const fetchPromise = initialKeyword
        ? saavnApi.search(`${initialKeyword} hits`)
        : youtubeApi.search('');

      fetchPromise.then(res => {
        const sorted = personalizeTracks(res.results || []);
        setResults(sorted);
        setSearchInfo(res);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
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
    }, 320);

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
    }, 200);

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

    if (song.audioUrl) {
      playTrack(song);
      return;
    }

    try {
      const full = await saavnApi.getSongDetails(song.id);
      if (full && full.audioUrl) {
        playTrack(full);
        return;
      }
    } catch {
      // Fallback
    }

    setQuery(song.title);
    setSearchParams({ q: song.title });
  };

  // Personalized tags combining user interests & liked songs
  const personalizedTags = (userPreferences?.artists?.length || userPreferences?.genres?.length)
    ? [...(userPreferences.genres || []), ...(userPreferences.artists || [])].slice(0, 9)
    : DEFAULT_SUGGESTIONS;

  const topResult = results[0];
  const isTopPlaying = topResult && currentTrack?.id === topResult.id && isPlaying;

  // Typo check: did the query differ from the topResult title?
  const isCorrectedTypo = query.trim() && topResult && 
    topResult.title.toLowerCase() !== query.trim().toLowerCase() &&
    !query.trim().toLowerCase().includes(topResult.title.toLowerCase().slice(0, 4));

  return (
    <div className="page-container">
      {/* Search Header Input with Smart Dropdown */}
      <div>
        <div style={{ position: 'relative', maxWidth: '640px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 2 }} />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsDropdownOpen(true);
              setRecentSearches(storage.getRecentSearches());
            }}
            placeholder="Search songs, artists, or keywords (e.g. kesariya, lofi, arijiit)..."
            autoFocus
            style={{
              width: '100%',
              height: '48px',
              padding: '0 46px 0 46px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          />
          {loading ? (
            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 2 }}>
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
                right: '16px',
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

        {/* Suggestion Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            {userPreferences?.genres?.length ? <Sparkles size={12} style={{ color: 'var(--accent-solid)' }} /> : null}
            {userPreferences?.genres?.length ? 'For You:' : 'Try:'}
          </span>
          {personalizedTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleSuggestionClick(tag)}
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                transition: 'all var(--transition-fast)',
                cursor: 'pointer'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-Corrected Typo Feedback Banner if applicable */}
      {query.trim() && topResult && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <span>Top match for</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>"{query}"</span>:
          <span style={{ color: 'var(--accent-solid)', fontWeight: 600 }}>{topResult.title} by {topResult.artist}</span>
        </div>
      )}

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
              {searchInfo.error || 'Showing matching curated audio catalog.'}
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

      {/* Search Results */}
      {loading && results.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', gap: '10px' }}>
          <Loader2 size={24} className="brand-logo-spin" />
          <span>Searching audio catalog...</span>
        </div>
      ) : results.length === 0 ? (
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
                    else playTrack(topResult, results);
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
                        else playTrack(topResult, results);
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
              {query.trim() 
                ? 'Songs' 
                : (userPreferences?.genres?.length ? 'Recommended For You' : 'All Catalog Tracks')
              }
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
