import React, { useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { useNavigate } from 'react-router-dom';
import { Library, Plus, Heart, Music2 } from 'lucide-react';

export default function LibraryPage({ onOpenCreatePlaylist }) {
  const { playlists, likedSongs } = useLibrary();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all'); // 'all' | 'playlists' | 'liked'

  return (
    <div className="page-container">
      {/* Title & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Library size={22} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Your Library</h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            All your saved collections, playlists, and favorite songs
          </p>
        </div>

        <button
          onClick={onOpenCreatePlaylist}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--accent-solid)',
            color: 'var(--accent-text)',
            fontSize: '0.825rem',
            fontWeight: 600
          }}
        >
          <Plus size={16} />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {['all', 'playlists', 'liked'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: filter === tab ? 'var(--accent-solid)' : 'var(--bg-card)',
              color: filter === tab ? 'var(--accent-text)' : 'var(--text-secondary)',
              border: `1px solid ${filter === tab ? 'var(--accent-solid)' : 'var(--border-subtle)'}`,
              fontSize: '0.775rem',
              fontWeight: 600,
              textTransform: 'capitalize'
            }}
          >
            {tab === 'liked' ? 'Liked Songs' : tab}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="cards-grid">
        {/* Liked Songs Special Card */}
        {(filter === 'all' || filter === 'liked') && (
          <div
            onClick={() => navigate('/liked')}
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-hover) 100%)',
              border: '1px solid var(--border-medium)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '190px',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Heart size={20} fill="currentColor" />
            </div>

            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px' }}>
                Liked Songs
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                {likedSongs.length} {likedSongs.length === 1 ? 'track' : 'tracks'} saved
              </p>
            </div>
          </div>
        )}

        {/* User Playlists */}
        {(filter === 'all' || filter === 'playlists') && playlists.map((pl) => {
          const songCount = pl.tracks ? pl.tracks.length : (pl.trackIds ? pl.trackIds.length : 0);

          return (
            <div
              key={pl.id}
              onClick={() => navigate(`/playlist/${pl.id}`)}
              style={{
                padding: '18px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '190px',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)'
                }}
              >
                <Music2 size={22} />
              </div>

              <div>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    margin: '0 0 4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={pl.name}
                >
                  {pl.name}
                </h3>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {pl.description || `${songCount} songs`}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  {songCount} {songCount === 1 ? 'song' : 'songs'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
