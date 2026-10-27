import React from 'react';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import TrackList from '../components/TrackList';
import { Clock, Play, Music, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RecentlyPlayed({ onOpenAddToPlaylist }) {
  const { recentlyPlayed, clearRecentlyPlayed } = useLibrary();
  const { playTrack } = usePlayer();
  const navigate = useNavigate();

  const handlePlayAll = () => {
    if (recentlyPlayed.length > 0) {
      playTrack(recentlyPlayed[0], recentlyPlayed);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div
        className="playlist-header-banner"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '36px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-md)',
          flexWrap: 'wrap'
        }}
      >
        <div
          className="playlist-header-artwork"
          style={{
            width: '120px',
            height: '120px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            flexShrink: 0
          }}
        >
          <Clock size={52} />
        </div>

        <div className="playlist-header-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
            Listening History
          </span>
          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800, margin: 0 }}>
            Recently Played
          </h1>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {recentlyPlayed.length} {recentlyPlayed.length === 1 ? 'track' : 'tracks'} listened to recently
          </div>
        </div>
      </div>

      {/* Action Controls */}
      {recentlyPlayed.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <button
            onClick={handlePlayAll}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-solid)',
              color: 'var(--accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}
            title="Play all history"
          >
            <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
          </button>

          <button
            onClick={clearRecentlyPlayed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            title="Clear listening history"
          >
            <Trash2 size={15} />
            <span>Clear History</span>
          </button>
        </div>
      )}

      {/* Track List */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
        {recentlyPlayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <Music size={48} strokeWidth={1.5} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>No listening history yet</h3>
            <p style={{ fontSize: '0.875rem', maxWidth: '360px', margin: 0 }}>
              Tracks you play will be automatically remembered here so you can easily jump back into your groove.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                marginTop: '10px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--accent-text)',
                fontWeight: 600,
                fontSize: '0.875rem'
              }}
            >
              Browse Home
            </button>
          </div>
        ) : (
          <TrackList
            tracks={recentlyPlayed}
            onOpenAddToPlaylist={onOpenAddToPlaylist}
          />
        )}
      </div>
    </div>
  );
}
