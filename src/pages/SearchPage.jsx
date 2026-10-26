import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { saavnApi } from '../services/saavnApi';
import TrackList from '../components/TrackList';
import SearchTopResult from '../components/SearchTopResult';
import ArtistCard from '../components/ArtistCard';
import AlbumCard from '../components/AlbumCard';
import PlaylistCard from '../components/PlaylistCard';
import SearchDropdown from '../components/SearchDropdown';
import { 
  Search, 
  Loader2, 
  Music, 
  Sparkles, 
  ArrowUpDown, 
  ChevronRight, 
  X,
  Compass
} from 'lucide-react';

const CATEGORIES = [
  'Bollywood Hits',
  'Hindi Romantic',
  'Punjabi Beats',
  'English Pop',
  'Sad Songs',
  'Party Hits',
  'Workout Energy',
  'Lo-fi Chill',
  'Devotional',
  'Hip-Hop',
  'Classical'
];

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'songs', label: 'Songs' },
  { id: 'artists', label: 'Artists' },
  { id: 'albums', label: 'Albums' },
  { id: 'playlists', label: 'Playlists' }
];

export default function SearchPage({ onOpenSettings, onOpenAddToPlaylist }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';
  const initialTab = searchParams.get('tab') || 'all';

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sortOption, setSortOption] = useState('relevance');
  const [loading, setLoading] = useState(false);
  const [loadingAlbumId, setLoadingAlbumId] = useState(null);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Search Results State
  const [searchData, setSearchData] = useState({
    query: '',
    parsed: null,
    topResult: null,
    songs: [],
    artists: [],
    albums: [],
    playlists: [],
    source: 'saavn_cdn'
  });

  const { playTrack, currentTrack, addTracksToQueue } = usePlayer();
  const { showToast } = useLibrary();
  const inputContainerRef = useRef(null);

  // Sync state with URL params
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const tab = searchParams.get('tab') || 'all';
    setQuery(q);
    setActiveTab(tab);
  }, [searchParams]);

  // Main debounced search effect using JioSaavn multi-category API
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await saavnApi.searchComprehensive(query.trim(), controller.signal);
        if (!isCancelled) {
          setSearchData(data);

          // If query has strong intent (e.g. "Taylor Swift albums") and user hasn't explicitly picked a sub-tab:
          if (data.parsed?.isAlbumQuery && activeTab === 'all' && (!searchParams.get('tab'))) {
            // Keep on 'all' to show album top result, or let user browse tabs
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('JioSaavn search error:', err);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }, query.trim() ? 320 : 0);

    return () => {
      isCancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  // Autocomplete suggestions effect
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions(null);
      setIsDropdownOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await saavnApi.getSuggestions(query.trim(), controller.signal);
        setSuggestions(res);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions(null);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  // Update query in URL & state
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim()) {
      setSearchParams({ q: val, tab: activeTab });
      setIsDropdownOpen(true);
    } else {
      setSearchParams(activeTab !== 'all' ? { tab: activeTab } : {});
      setIsDropdownOpen(false);
    }
  };

  const handleClearInput = () => {
    setQuery('');
    setSearchParams(activeTab !== 'all' ? { tab: activeTab } : {});
    setIsDropdownOpen(false);
  };

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (query.trim()) {
      setSearchParams({ q: query.trim(), tab: tabId });
    } else {
      setSearchParams(tabId !== 'all' ? { tab: tabId } : {});
    }
  };

  const handleSelectCategory = (cat) => {
    setQuery(cat);
    setActiveTab('all');
    setSearchParams({ q: cat, tab: 'all' });
    setIsDropdownOpen(false);
  };

  const handleSelectSuggestionQuery = (suggestedText) => {
    setQuery(suggestedText);
    setSearchParams({ q: suggestedText, tab: activeTab });
    setIsDropdownOpen(false);
  };

  const handleSelectSongFromDropdown = (track) => {
    setIsDropdownOpen(false);
    playTrack(track, searchData.songs);
  };

  // Play an entire Album: fetches complete tracks decrypted from JioSaavn CDN and loads into player queue
  const handlePlayAlbum = async (album) => {
    if (!album) return;
    setLoadingAlbumId(album.id);
    try {
      const details = await saavnApi.getAlbumDetails(album.id);
      if (details && details.tracks && details.tracks.length > 0) {
        playTrack(details.tracks[0], details.tracks);
        showToast(`Playing album "${album.title}"`, 'success');
      } else {
        showToast(`No playable tracks found for album "${album.title}"`, 'error');
      }
    } catch (err) {
      console.error('Error playing album:', err);
      showToast(`Unable to load album "${album.title}"`, 'error');
    } finally {
      setLoadingAlbumId(null);
    }
  };

  // Add all Album tracks to Queue
  const handleAddAlbumToQueue = async (album) => {
    if (!album) return;
    try {
      const details = await saavnApi.getAlbumDetails(album.id);
      if (details && details.tracks && details.tracks.length > 0) {
        addTracksToQueue(details.tracks, album.title);
      } else {
        showToast(`No tracks available for "${album.title}"`, 'error');
      }
    } catch (err) {
      showToast(`Unable to add album tracks to queue`, 'error');
    }
  };

  // Play an entire Playlist: fetches complete decrypted tracks and begins playback
  const handlePlayPlaylist = async (playlist) => {
    if (!playlist) return;
    setLoadingPlaylistId(playlist.id);
    try {
      const details = await saavnApi.getPlaylistDetails(playlist.id);
      if (details && details.tracks && details.tracks.length > 0) {
        playTrack(details.tracks[0], details.tracks);
        showToast(`Playing playlist "${playlist.title}"`, 'success');
      } else {
        showToast(`No playable tracks in "${playlist.title}"`, 'error');
      }
    } catch (err) {
      console.error('Error playing playlist:', err);
      showToast(`Unable to load playlist "${playlist.title}"`, 'error');
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  // Add all Playlist tracks to Queue
  const handleAddPlaylistToQueue = async (playlist) => {
    if (!playlist) return;
    try {
      const details = await saavnApi.getPlaylistDetails(playlist.id);
      if (details && details.tracks && details.tracks.length > 0) {
        addTracksToQueue(details.tracks, playlist.title);
      } else {
        showToast(`No tracks available for "${playlist.title}"`, 'error');
      }
    } catch (err) {
      showToast(`Unable to add playlist tracks to queue`, 'error');
    }
  };

  // Play an Artist: plays their top matching songs
  const handlePlayArtist = (artist) => {
    if (searchData.songs && searchData.songs.length > 0) {
      playTrack(searchData.songs[0], searchData.songs);
      showToast(`Playing ${artist.name}`, 'success');
    } else {
      navigate(`/artist/${encodeURIComponent(artist.name)}`);
    }
  };

  // Sorted views for dedicated tabs
  const sortedSongs = useMemo(() => {
    const list = [...searchData.songs];
    if (sortOption === 'duration-desc') {
      return list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }
    if (sortOption === 'duration-asc') {
      return list.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    }
    if (sortOption === 'title-asc') {
      return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    return list;
  }, [searchData.songs, sortOption]);

  const sortedAlbums = useMemo(() => {
    const list = [...searchData.albums];
    if (sortOption === 'year-desc') {
      return list.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
    }
    if (sortOption === 'year-asc') {
      return list.sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
    }
    return list;
  }, [searchData.albums, sortOption]);

  const totalResultsCount = (
    searchData.songs.length +
    searchData.artists.length +
    searchData.albums.length +
    searchData.playlists.length
  );

  return (
    <div className="page-container" style={{ position: 'relative' }}>
      {/* 1. Primary Search Bar & Autocomplete */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '720px' }} ref={inputContainerRef}>
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                setIsDropdownOpen(false);
              }
            }}
            placeholder="Search songs, artists, albums, or playlists on JioSaavn..."
            autoFocus={!initialQuery}
            style={{
              width: '100%',
              height: '50px',
              padding: '0 44px 0 48px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.975rem',
              boxShadow: 'var(--shadow-sm)',
              outline: 'none',
              transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)'
            }}
          />

          <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {loading && (
              <Loader2 size={18} className="brand-logo-spin" style={{ color: 'var(--text-muted)' }} />
            )}
            {query && !loading && (
              <button
                onClick={handleClearInput}
                style={{
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Live Autocomplete Suggestions Dropdown */}
        <SearchDropdown
          suggestions={suggestions}
          isOpen={isDropdownOpen}
          onClose={() => setIsDropdownOpen(false)}
          onSelectSong={handleSelectSongFromDropdown}
          onSelectQuery={handleSelectSuggestionQuery}
        />
      </div>

      {/* 2. YouTube Music-Style Category Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div className="search-pill-list">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            let countLabel = '';
            if (query.trim()) {
              if (tab.id === 'songs' && searchData.songs.length > 0) countLabel = ` (${searchData.songs.length})`;
              if (tab.id === 'artists' && searchData.artists.length > 0) countLabel = ` (${searchData.artists.length})`;
              if (tab.id === 'albums' && searchData.albums.length > 0) countLabel = ` (${searchData.albums.length})`;
              if (tab.id === 'playlists' && searchData.playlists.length > 0) countLabel = ` (${searchData.playlists.length})`;
            }

            return (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`search-tab-button ${isActive ? 'is-active' : ''}`}
              >
                {tab.label}{countLabel}
              </button>
            );
          })}
        </div>

        {/* Sorting options when in dedicated Songs or Albums tab */}
        {activeTab === 'songs' && searchData.songs.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              <option value="relevance">Relevance</option>
              <option value="duration-desc">Duration (Longest)</option>
              <option value="duration-asc">Duration (Shortest)</option>
              <option value="title-asc">Title (A - Z)</option>
            </select>
          </div>
        )}

        {activeTab === 'albums' && searchData.albums.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              <option value="relevance">Relevance</option>
              <option value="year-desc">Release Year (Newest)</option>
              <option value="year-asc">Release Year (Oldest)</option>
            </select>
          </div>
        )}
      </div>

      {/* 3. Quick Genre & Mood Discovery Pills */}
      <div className="search-pill-list" style={{ marginTop: '-4px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
          Discover:
        </span>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleSelectCategory(cat)}
            style={{
              fontSize: '0.75rem',
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: query.toLowerCase().includes(cat.toLowerCase().split(' ')[0]) ? 'var(--accent-subtle)' : 'var(--bg-surface)',
              border: `1px solid ${query.toLowerCase().includes(cat.toLowerCase().split(' ')[0]) ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
              color: 'var(--text-secondary)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 4. Intent Badge (when smart query understanding detects mood, artist, or album keywords) */}
      {searchData.parsed && searchData.parsed.hasModifier && query.trim() && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)'
          }}
        >
          <Sparkles size={14} style={{ color: 'var(--accent-solid)' }} />
          <span>
            {searchData.parsed.isAlbumQuery && `Showing albums for "${searchData.parsed.cleanQuery}"`}
            {searchData.parsed.isArtistQuery && `Prioritizing artist results for "${searchData.parsed.cleanQuery}"`}
            {searchData.parsed.isPlaylistQuery && `Showing playlists for "${searchData.parsed.cleanQuery}"`}
            {searchData.parsed.detectedCategory && `Curating music matching mood: ${searchData.parsed.detectedCategory.toUpperCase()}`}
          </span>
        </div>
      )}

      {/* 5. Main Content Area */}
      {loading && totalResultsCount === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-muted)', gap: '14px' }}>
          <Loader2 size={30} className="brand-logo-spin" />
          <span style={{ fontSize: '0.95rem' }}>Searching JioSaavn music catalog...</span>
        </div>
      ) : totalResultsCount === 0 && query.trim() ? (
        /* Empty State */
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <Music size={52} strokeWidth={1.5} />
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
            No results found for "{query}"
          </h3>
          <p style={{ fontSize: '0.875rem', maxWidth: '420px', margin: 0 }}>
            Try checking for typos, searching by a different artist or song name, or browse one of the music categories above.
          </p>
        </div>
      ) : (
        /* Render Selected Tab View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* TAB: ALL */}
          {activeTab === 'all' && (
            <>
              {/* A. Top Result Card (Song, Artist, Album, or Playlist) */}
              {query.trim() && searchData.topResult && (
                <section>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '14px' }}>
                    Top Result
                  </h3>
                  <SearchTopResult
                    result={searchData.topResult}
                    allSongs={searchData.songs}
                    onPlayAlbum={handlePlayAlbum}
                    onPlayPlaylist={handlePlayPlaylist}
                  />
                </section>
              )}

              {/* B. Songs Section (Top 5 tracks) */}
              {searchData.songs.length > 0 && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                      Songs
                    </h3>
                    {searchData.songs.length > 5 && (
                      <button
                        onClick={() => handleSelectTab('songs')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <span>See all songs ({searchData.songs.length})</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: '10px', border: '1px solid var(--border-subtle)' }}>
                    <TrackList
                      tracks={searchData.songs.slice(0, 5)}
                      onOpenAddToPlaylist={onOpenAddToPlaylist}
                    />
                  </div>
                </section>
              )}

              {/* C. Artists Section */}
              {searchData.artists.length > 0 && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                      Artists
                    </h3>
                    {searchData.artists.length > 4 && (
                      <button
                        onClick={() => handleSelectTab('artists')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <span>See all artists ({searchData.artists.length})</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>

                  <div className="search-discovery-grid">
                    {searchData.artists.slice(0, 4).map((artist) => (
                      <ArtistCard
                        key={artist.id}
                        artist={artist}
                        onPlayArtist={handlePlayArtist}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* D. Albums Section */}
              {searchData.albums.length > 0 && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                      Albums
                    </h3>
                    {searchData.albums.length > 4 && (
                      <button
                        onClick={() => handleSelectTab('albums')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <span>See all albums ({searchData.albums.length})</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>

                  <div className="search-discovery-grid">
                    {searchData.albums.slice(0, 4).map((album) => (
                      <AlbumCard
                        key={album.id}
                        album={album}
                        onPlayAlbum={handlePlayAlbum}
                        onAddAlbumToQueue={handleAddAlbumToQueue}
                        isLoading={loadingAlbumId === album.id}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* E. Playlists Section */}
              {searchData.playlists.length > 0 && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                      Featured Playlists
                    </h3>
                    {searchData.playlists.length > 4 && (
                      <button
                        onClick={() => handleSelectTab('playlists')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <span>See all playlists ({searchData.playlists.length})</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>

                  <div className="search-discovery-grid">
                    {searchData.playlists.slice(0, 4).map((playlist) => (
                      <PlaylistCard
                        key={playlist.id}
                        playlist={playlist}
                        onPlayPlaylist={handlePlayPlaylist}
                        onAddPlaylistToQueue={handleAddPlaylistToQueue}
                        isLoading={loadingPlaylistId === playlist.id}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* TAB: SONGS */}
          {activeTab === 'songs' && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Songs ({sortedSongs.length})
                </h3>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
                <TrackList
                  tracks={sortedSongs}
                  onOpenAddToPlaylist={onOpenAddToPlaylist}
                  emptyMessage={`No songs found matching "${query}".`}
                />
              </div>
            </section>
          )}

          {/* TAB: ARTISTS */}
          {activeTab === 'artists' && (
            <section>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>
                Artists ({searchData.artists.length})
              </h3>

              {searchData.artists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  No matching artists found for "{query}".
                </div>
              ) : (
                <div className="search-discovery-grid">
                  {searchData.artists.map((artist) => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      onPlayArtist={handlePlayArtist}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB: ALBUMS */}
          {activeTab === 'albums' && (
            <section>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>
                Albums ({sortedAlbums.length})
              </h3>

              {sortedAlbums.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  No matching albums found for "{query}".
                </div>
              ) : (
                <div className="search-discovery-grid">
                  {sortedAlbums.map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onPlayAlbum={handlePlayAlbum}
                      onAddAlbumToQueue={handleAddAlbumToQueue}
                      isLoading={loadingAlbumId === album.id}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB: PLAYLISTS */}
          {activeTab === 'playlists' && (
            <section>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>
                Playlists ({searchData.playlists.length})
              </h3>

              {searchData.playlists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  No matching playlists found for "{query}".
                </div>
              ) : (
                <div className="search-discovery-grid">
                  {searchData.playlists.map((playlist) => (
                    <PlaylistCard
                      key={playlist.id}
                      playlist={playlist}
                      onPlayPlaylist={handlePlayPlaylist}
                      onAddPlaylistToQueue={handleAddPlaylistToQueue}
                      isLoading={loadingPlaylistId === playlist.id}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      )}
    </div>
  );
}
