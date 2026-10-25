import React, { useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import TrackList from '../components/TrackList';
import { Heart, Play, Shuffle, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LikedSongs({ onOpenAddToPlaylist }) {
  const { likedSongs } = useLibrary();
  const { playTrack, toggleShuffle } = usePlayer();
  const navigate = useNavigate();

  const [filterQuery, setFilterQuery] = useState('');

  const filteredSongs = likedSongs.filter(track =>
    track.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const totalDuration = likedSongs.reduce((acc, t) => acc + (t.duration || 180), 0);
  const totalMinutes = Math.floor(totalDuration / 60);

  const handlePlayAll = () => {
    if (likedSongs.length > 0) {
      playTrack(likedSongs[0], likedSongs);
    }
  };

  const handleShuffleAll = () => {
    if (likedSongs.length > 0) {
      const shuffled = [...likedSongs].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
      toggleShuffle();
    }
  };

  return (
    <div className="page-container">
      {/* Hero Header */}
      <div
        className="playlist-header-banner"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '28px',
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
            width: '140px',
            height: '140px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--accent-solid)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            flexShrink: 0
          }}
        >
          <Heart size={64} fill="currentColor" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
            Playlist
          </span>
          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 800, margin: 0 }}>
            Liked Songs
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>You</span>
            <span>•</span>
            <span>{likedSongs.length} {likedSongs.length === 1 ? 'song' : 'songs'}</span>
            {totalMinutes > 0 && (
              <>
                <span>•</span>
                <span>about {totalMinutes} min</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Controls & Search Within */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handlePlayAll}
            disabled={likedSongs.length === 0}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-solid)',
              color: 'var(--accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
              opacity: likedSongs.length === 0 ? 0.5 : 1,
              cursor: likedSongs.length === 0 ? 'not-allowed' : 'pointer'
            }}
            title="Play All"
          >
            <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
          </button>

          <button
            onClick={handleShuffleAll}
            disabled={likedSongs.length === 0}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              opacity: likedSongs.length === 0 ? 0.5 : 1
            }}
          >
            <Shuffle size={16} />
            <span>Shuffle</span>
          </button>
        </div>

        {likedSongs.length > 0 && (
          <div className="banner-search-wrapper" style={{ position: 'relative', width: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search in liked songs..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 12px 0 34px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem'
              }}
            />
          </div>
        )}
      </div>

      {/* Track List */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
        {likedSongs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <Heart size={48} strokeWidth={1.5} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Songs you like will appear here</h3>
            <p style={{ fontSize: '0.875rem', maxWidth: '360px', margin: 0 }}>
              Save tracks by tapping the heart icon anywhere in the app to curate your personal favorites collection.
            </p>
            <button
              onClick={() => navigate('/search')}
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
              Explore Music
            </button>
          </div>
        ) : (
          <TrackList
            tracks={filteredSongs}
            onOpenAddToPlaylist={onOpenAddToPlaylist}
            emptyMessage={filterQuery ? `No liked songs match "${filterQuery}".` : "No liked songs found."}
          />
        )}
      </div>
    </div>
  );
}
