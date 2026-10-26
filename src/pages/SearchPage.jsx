import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { youtubeApi } from '../services/youtubeApi';
import TrackList from '../components/TrackList';
import { Search, Loader2, Play, Key, AlertCircle, Music } from 'lucide-react';

const SUGGESTIONS = [
  'The Weeknd',
  'Dua Lipa',
  'Billie Eilish',
  'Kendrick Lamar',
  'Synthwave',
  'Arijit Singh',
  'Coldplay',
  'Lofi Girl',
  'Daft Punk'
];

export default function SearchPage({ onOpenSettings, onOpenAddToPlaylist }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInfo, setSearchInfo] = useState(null);

  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  // Keep query in sync with URL
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
  }, [searchParams]);

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      setLoading(true);
      youtubeApi.search('').then(res => {
        setResults(res.results);
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
    }, 350);

    return () => clearTimeout(handler);
  }, [query]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim()) {
      setSearchParams({ q: val });
    } else {
      setSearchParams({});
    }
  };

  const handleSuggestionClick = (s) => {
    setQuery(s);
    setSearchParams({ q: s });
  };

  const topResult = results[0];
  const isTopPlaying = topResult && currentTrack?.id === topResult.id && isPlaying;

  return (
    <div className="page-container">
      {/* Search Header Input */}
      <div>
        <div style={{ position: 'relative', maxWidth: '640px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search songs, artists, or keywords..."
            autoFocus
            style={{
              width: '100%',
              height: '48px',
              padding: '0 16px 0 46px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          />
          {loading && (
            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Loader2 size={18} className="brand-logo-spin" />
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Try:</span>
          {SUGGESTIONS.map((tag) => (
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
                transition: 'all var(--transition-fast)'
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
