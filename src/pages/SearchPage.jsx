import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { saavnApi, youtubeApi } from '../services/saavnApi';
import { storage } from '../services/storage';
import { createSingleTrackQueue } from '../services/playbackUtils';
import { parseSpotifyPlaylistId } from '../services/spotifyPlaylistUtils';
import TrackList from '../components/TrackList';
import SearchSuggestions from '../components/SearchSuggestions';
import { importAndStreamSpotify } from '../services/spotifyImport';
import { NOIR_TRACK_ARTWORK_FALLBACK, getTrackFallbackArtwork, handleArtworkError } from '../services/artworkUtils';
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

export default function SearchPage({ onOpenSettings, onOpenAddToPlaylist, onOpenSpotifyImport }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInfo, setSearchInfo] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Recent searched/played tracks (Spotify style)
  const [recentTracks, setRecentTracks] = useState(() => storage.getRecentSearchTracks());

  // Suggestions dropdown state
  const [suggestions, setSuggestions] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => storage.getRecentSearches());

  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { userPreferences, likedSongs, isLiked, toggleLike, importSpotifyPlaylist, setPlaylists, showToast, user } = useLibrary();

  const debounceSuggestTimerRef = useRef(null);
  const suggestRequestIdRef = useRef(0);

  const handleSpotifyAutoImport = async (rawUrl) => {
    try {
      showToast?.('Detected Spotify playlist! Importing...', 'info', 3000);
      await importAndStreamSpotify(rawUrl, {
        playTrack,
        importSpotifyPlaylist,
        setPlaylists,
        showToast,
        navigate,
        user
      });
    } catch (err) {
      console.warn('Auto-import failed, opening import modal:', err);
      onOpenSpotifyImport?.(rawUrl);
    }
  };

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

  // Rank search results prioritizing query match with gentle personalization tie-breakers
  const personalizeTracks = (tracks, activeQuery = query) => {
    if (!tracks || tracks.length === 0) return tracks;

    const q = (activeQuery || '').trim().toLowerCase();
    const qTokens = q.split(/\s+/).filter(Boolean);

    const prefArtists = (userPreferences?.artists || []).map(a => a.toLowerCase());
    const prefGenres = (userPreferences?.genres || []).map(g => g.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const likedArtistNames = (likedSongs || []).map(t => (t.artist || '').toLowerCase());

    return [...tracks].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      const artistA = (a.artist || '').toLowerCase();
      const artistB = (b.artist || '').toLowerCase();
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      const albumA = (a.album || '').toLowerCase();
      const albumB = (b.album || '').toLowerCase();

      if (q) {
        // 1. Exact title match gets highest relevance (+100)
        if (titleA === q) scoreA += 100;
        else if (titleA.startsWith(q)) scoreA += 70;
        else if (titleA.includes(q)) scoreA += 40;

        if (titleB === q) scoreB += 100;
        else if (titleB.startsWith(q)) scoreB += 70;
        else if (titleB.includes(q)) scoreB += 40;

        // 2. Exact or primary artist match (+85)
        const primaryArtistA = artistA.split(',')[0].trim();
        const primaryArtistB = artistB.split(',')[0].trim();
        if (artistA === q || primaryArtistA === q) scoreA += 85;
        else if (artistA.startsWith(q)) scoreA += 60;
        else if (artistA.includes(q)) scoreA += 45;

        if (artistB === q || primaryArtistB === q) scoreB += 85;
        else if (artistB.startsWith(q)) scoreB += 60;
        else if (artistB.includes(q)) scoreB += 45;

        // 3. Album match (+15)
        if (albumA.includes(q)) scoreA += 15;
        if (albumB.includes(q)) scoreB += 15;

        // 4. Token matches
        if (qTokens.length > 1) {
          const matchedA = qTokens.filter(t => titleA.includes(t) || artistA.includes(t)).length;
          const matchedB = qTokens.filter(t => titleB.includes(t) || artistB.includes(t)).length;
          scoreA += (matchedA / qTokens.length) * 25;
          scoreB += (matchedB / qTokens.length) * 25;
        }

        // 5. Down-rank compilation albums so original soundtrack/studio releases rank first
        const compilationTerms = ['best of', 'compilation', 'hits of', 'greatest hits', 'collection', 'vol.', 'volume', 'mashup'];
        const isCompA = compilationTerms.some(term => albumA.includes(term));
        const isCompB = compilationTerms.some(term => albumB.includes(term));
        if (isCompA && !isCompB) scoreA -= 20;
        if (isCompB && !isCompA) scoreB -= 20;
      }

      // Small personalization tie-breakers (capped so query relevance always leads)
      if (prefArtists.some(pa => artistA.includes(pa))) scoreA += 8;
      if (prefArtists.some(pb => artistB.includes(pb))) scoreB += 8;

      if (likedArtistNames.some(la => artistA.includes(la))) scoreA += 5;
      if (likedArtistNames.some(lb => artistB.includes(lb))) scoreB += 5;

      prefGenres.forEach(genre => {
        if (titleA.includes(genre) || albumA.includes(genre)) scoreA += 3;
        if (titleB.includes(genre) || albumB.includes(genre)) scoreB += 3;
      });

      return scoreB - scoreA;
    });
  };

  // Debounced search effect (only runs when query has text)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      setHasMore(false);
      setPage(1);
      return;
    }

    setLoading(true);
    setPage(1);
    const handler = setTimeout(async () => {
      try {
        const data = await saavnApi.search(query.trim(), { page: 1 });
        const sorted = personalizeTracks(data.results || [], query.trim());
        setResults(sorted);
        setSearchInfo(data);
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(handler);
  }, [query, userPreferences, likedSongs]);

  // Load more paginated results
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !query.trim()) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await saavnApi.search(query.trim(), { page: nextPage });
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        const sortedNew = personalizeTracks(data.results, query.trim());
        setResults(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const uniqueNew = sortedNew.filter(t => !existingIds.has(t.id));
          return [...prev, ...uniqueNew];
        });
        setPage(nextPage);
        setHasMore(Boolean(data.hasMore));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Failed to load more results:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // Live autocomplete suggestions with stale request cancellation
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      suggestRequestIdRef.current += 1;
      setSuggestions(null);
      setIsSuggestLoading(false);
      return;
    }

    setIsSuggestLoading(true);
    if (debounceSuggestTimerRef.current) clearTimeout(debounceSuggestTimerRef.current);

    const requestId = ++suggestRequestIdRef.current;

    debounceSuggestTimerRef.current = setTimeout(async () => {
      try {
        const data = await saavnApi.getAutocomplete(trimmed);
        if (suggestRequestIdRef.current === requestId) {
          setSuggestions(data);
        }
      } catch (err) {
        if (suggestRequestIdRef.current === requestId) {
          console.warn('Autocomplete fetch error:', err);
        }
      } finally {
        if (suggestRequestIdRef.current === requestId) {
          setIsSuggestLoading(false);
        }
      }
    }, 200);

    return () => {
      if (debounceSuggestTimerRef.current) clearTimeout(debounceSuggestTimerRef.current);
    };
  }, [query]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (
      val.includes('open.spotify.com/playlist') ||
      val.startsWith('spotify:playlist:') ||
      val.includes('spotify.com/embed/playlist')
    ) {
      setQuery('');
      setSearchParams({});
      setIsDropdownOpen(false);
      handleSpotifyAutoImport(val.trim());
      return;
    }
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
            id="search-input"
            className="search-input"
            type="text"
            value={query}
            onChange={handleInputChange}
            onPaste={(event) => {
              const pastedValue = event.clipboardData?.getData('text')?.trim() || '';
              if (
                pastedValue.includes('open.spotify.com/playlist') ||
                pastedValue.startsWith('spotify:playlist:') ||
                pastedValue.includes('spotify.com/embed/playlist') ||
                parseSpotifyPlaylistId(pastedValue)
              ) {
                event.preventDefault();
                setQuery('');
                setSearchParams({});
                setIsDropdownOpen(false);
                handleSpotifyAutoImport(pastedValue);
              }
            }}
            onClick={() => {
              setIsDropdownOpen(true);
              setRecentSearches(storage.getRecentSearches());
            }}
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

      {/* Recents Section: Rendered when search query is empty (matching Spotify layout) */}
      {!query.trim() && (
        <section style={{ marginTop: '20px' }}>
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
                        src={track.thumbnail || getTrackFallbackArtwork(track.title, track.artist)}
                        alt={track.title}
                        onError={(e) => handleArtworkError(e, getTrackFallbackArtwork(track.title, track.artist))}
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
          {/* Empty state: clear and unambiguous when search returns no tracks */}
          {!loading && results.length === 0 ? (
            <div
              style={{
                padding: '64px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'var(--text-muted)'
              }}
            >
              <Music size={44} strokeWidth={1.5} style={{ opacity: 0.4, marginBottom: '4px' }} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                No results found for &ldquo;{query}&rdquo;
              </h3>
              <p style={{ margin: 0, fontSize: '0.88rem', maxWidth: '420px', lineHeight: 1.5 }}>
                Please check your spelling, try searching for the artist or album name, or browse popular tracks.
              </p>
            </div>
          ) : (
            <>
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
                        src={topResult.thumbnail || getTrackFallbackArtwork(topResult.title, topResult.artist)}
                        alt={topResult.title}
                        onError={(e) => handleArtworkError(e, getTrackFallbackArtwork(topResult.title, topResult.artist))}
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

                  {/* Pagination: Load More Button */}
                  {hasMore && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 8px' }}>
                      <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        style={{
                          padding: '10px 24px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-medium)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          cursor: loadingMore ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background var(--transition-fast)'
                        }}
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 size={16} className="brand-logo-spin" />
                            <span>Loading more...</span>
                          </>
                        ) : (
                          <span>Load more songs</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
