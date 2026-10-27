import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { youtubeApi } from '../services/youtubeApi';
import { POPULAR_ARTISTS, MOCK_TRACKS } from '../services/mockCatalog';
import TrackList from '../components/TrackList';
import MusicCard from '../components/MusicCard';
import { Play, Shuffle, CheckCircle, Users, Disc, ChevronLeft, Heart } from 'lucide-react';

export default function ArtistPage({ onOpenAddToPlaylist }) {
  const { name } = useParams();
  const navigate = useNavigate();
  const { playTrack, toggleShuffle } = usePlayer();
  const { isLiked, showToast } = useLibrary();

  const decodedName = decodeURIComponent(name || '');
  const [isFollowing, setIsFollowing] = useState(false);
  const [artistTracks, setArtistTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Match known artist details from mock or fallback
  const artistMeta = POPULAR_ARTISTS.find(
    (a) => a.name.toLowerCase() === decodedName.toLowerCase()
  ) || {
    id: `artist-${decodedName.toLowerCase().replace(/\s+/g, '-')}`,
    name: decodedName,
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    monthlyListeners: '2.4M monthly listeners',
    genre: 'Contemporary / Alternative'
  };

  useEffect(() => {
    let isMounted = true;
    async function loadArtistTracks() {
      setLoading(true);
      try {
        const res = await youtubeApi.search(`${decodedName} audio songs`);
        if (isMounted) {
          if (res.results && res.results.length > 0) {
            setArtistTracks(res.results);
          } else {
            // Filter catalog tracks
            const catalogMatches = MOCK_TRACKS.filter(t => 
              t.artist.toLowerCase().includes(decodedName.toLowerCase())
            );
            setArtistTracks(catalogMatches.length > 0 ? catalogMatches : MOCK_TRACKS.slice(0, 8));
          }
        }
      } catch {
        if (isMounted) {
          setArtistTracks(MOCK_TRACKS.slice(0, 8));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadArtistTracks();
    return () => { isMounted = false; };
  }, [decodedName]);

  const handlePlayAll = () => {
    if (artistTracks.length > 0) {
      playTrack(artistTracks[0], artistTracks);
    }
  };

  const handleShuffleAll = () => {
    if (artistTracks.length > 0) {
      const shuffled = [...artistTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
      toggleShuffle();
    }
  };

  const handleFollowToggle = () => {
    setIsFollowing(!isFollowing);
    showToast(isFollowing ? `Unfollowed ${decodedName}` : `Following ${decodedName}`, 'info');
  };

  return (
    <div className="page-container">
      {/* Back Button */}
      <div>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          <ChevronLeft size={16} />
          <span>Back</span>
        </button>
      </div>

      {/* Artist Hero Banner */}
      <section
        className="playlist-header-banner"
        style={{
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          padding: '36px',
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div
          className="playlist-header-artwork"
          style={{
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: 'var(--shadow-md)',
            border: '2px solid var(--border-medium)'
          }}
        >
          <img
            src={artistMeta.image}
            alt={artistMeta.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
            }}
          />
        </div>

        <div className="playlist-header-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={15} style={{ color: 'var(--accent-solid)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Verified Artist
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
            {artistMeta.name}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Users size={14} />
            <span>{artistMeta.monthlyListeners}</span>
            <span>•</span>
            <span>{artistMeta.genre || 'Soundscape Artist'}</span>
          </div>
        </div>
      </section>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <button
          onClick={handlePlayAll}
          disabled={artistTracks.length === 0}
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
          title="Play All"
        >
          <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
        </button>

        <button
          onClick={handleShuffleAll}
          disabled={artistTracks.length === 0}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: 600
          }}
        >
          <Shuffle size={16} />
          <span>Shuffle</span>
        </button>

        <button
          onClick={handleFollowToggle}
          style={{
            padding: '10px 22px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isFollowing ? 'var(--bg-surface)' : 'transparent',
            border: `1px solid ${isFollowing ? 'var(--border-strong)' : 'var(--border-medium)'}`,
            color: isFollowing ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '0.85rem',
            fontWeight: 600
          }}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>

      {/* Top Tracks Section */}
      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '14px' }}>
          Popular Releases
        </h2>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
          <TrackList
            tracks={artistTracks}
            onOpenAddToPlaylist={onOpenAddToPlaylist}
            emptyMessage={`No tracks found for ${artistMeta.name}.`}
          />
        </div>
      </section>

      {/* Other Artists You Might Enjoy */}
      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '14px' }}>
          Similar Soundscapes
        </h2>

        <div className="artists-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
          {POPULAR_ARTISTS.filter(a => a.name.toLowerCase() !== decodedName.toLowerCase()).slice(0, 5).map((a) => (
            <div
              key={a.id}
              className="artist-card"
              onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}`)}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer'
              }}
            >
              <img
                src={a.image}
                alt={a.name}
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }}
              />
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 2px' }}>{a.name}</h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.monthlyListeners}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
