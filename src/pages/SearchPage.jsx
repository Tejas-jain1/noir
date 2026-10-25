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
    <div style={{ padding: '24px 32px 80px', display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      {/* Search Header Input */}
      <div>
        <div style={{ position: 'relative', maxWidth: '640px' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search songs, artists, or keywords..."
            autoFocus
            style={{
              width: '100%',
              height: '52px',
              padding: '0 20px 0 52px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          />
          {loading && (
            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="brand-logo-spin" />
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontWeight: 600 }}>Try:</span>
          {SUGGESTIONS.map((tag) => (
            <button
              key={tag}
              onClick={() => handleSuggestionClick(tag)}
              style={{
                fontSize: '0.775rem',
                padding: '4px 12px',
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
            padding: '12px 18px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              {searchInfo.error || 'YouTube API search limit reached. Showing matching curated audio catalog.'}
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
          >
            <Key size={14} />
            <span>Configure Key</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Top Result Card (if there is a query) */}
          {query.trim() && topResult && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '14px' }}>Top Result</h3>
                <div
                  onClick={() => {
                    if (currentTrack?.id === topResult.id) togglePlay();
                    else playTrack(topResult, results);
                  }}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '24px',
                    border: '1px solid var(--border-medium)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <img
                    src={topResult.thumbnail}
                    alt={topResult.title}
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: 'var(--radius-md)',
                      objectFit: 'cover'
                    }}
                  />

                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 4px', lineHeight: 1.2 }}>
                      {topResult.title}
                    </h2>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {topResult.artist} • <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-subtle)' }}>Song</span>
                    </span>
                  </div>

                  <div style={{ position: 'absolute', bottom: '24px', right: '24px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentTrack?.id === topResult.id) togglePlay();
                        else playTrack(topResult, results);
                      }}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-solid)',
                        color: 'var(--accent-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-md)'
                      }}
                    >
                      <Play size={22} fill="currentColor" style={{ marginLeft: isTopPlaying ? 0 : '2px' }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Songs List */}
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '14px' }}>
              {query.trim() ? 'Songs' : 'All Catalog Tracks'}
            </h3>

            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px', border: '1px solid var(--border-subtle)' }}>
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
