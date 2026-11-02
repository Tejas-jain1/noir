import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { saavnApi } from '../services/saavnApi';
import { FEATURED_ARTISTS_POOL } from '../services/homeRecommendations';
import { MOCK_TRACKS } from '../services/mockCatalog';
import TrackList from '../components/TrackList';
import { Play, Shuffle, CheckCircle, Users, ChevronLeft } from 'lucide-react';
import { getArtistFallbackAvatar, handleArtworkError } from '../services/artworkUtils';

export default function ArtistPage({ onOpenAddToPlaylist }) {
  const { name } = useParams();
  const navigate = useNavigate();
  const { playTrack, toggleShuffle } = usePlayer();
  const { showToast } = useLibrary();

  const decodedName = decodeURIComponent(name || '').trim();
  const [isFollowing, setIsFollowing] = useState(false);
  const [artistTracks, setArtistTracks] = useState([]);
  const [artistMeta, setArtistMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadArtistData() {
      setLoading(true);
      try {
        // First check featured pool for verified details
        const poolMatch = FEATURED_ARTISTS_POOL.find(
          a => a.name.toLowerCase() === decodedName.toLowerCase()
        );

        const details = await saavnApi.getArtistDetails(decodedName);
        if (isMounted && details) {
          setArtistMeta({
            id: details.id,
            name: details.name,
            image: details.image || poolMatch?.image || getArtistFallbackAvatar(details.name),
            monthlyListeners: details.monthlyListeners || poolMatch?.monthlyListeners || 'Verified Artist',
            genre: details.genre || poolMatch?.genre || 'Contemporary',
            bio: details.bio || ''
          });

          if (Array.isArray(details.tracks) && details.tracks.length > 0) {
            setArtistTracks(details.tracks);
          } else {
            // Search songs as fallback
            const songRes = await saavnApi.search(`${decodedName} songs`);
            if (isMounted) setArtistTracks(songRes?.results || []);
          }
          return;
        }

        // Mock fallback if API fails
        const catalogMatches = MOCK_TRACKS.filter(t => 
          t.artist.toLowerCase().includes(decodedName.toLowerCase())
        );

        if (isMounted) {
          setArtistMeta({
            id: `artist-${decodedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: decodedName,
            image: poolMatch?.image || getArtistFallbackAvatar(decodedName),
            monthlyListeners: poolMatch?.monthlyListeners || 'Verified Artist',
            genre: poolMatch?.genre || 'Contemporary'
          });
          setArtistTracks(catalogMatches);
        }
      } catch (err) {
        console.warn('Failed to load artist details:', decodedName, err);
        if (isMounted) {
          setArtistMeta({
            id: `artist-${decodedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: decodedName,
            image: getArtistFallbackAvatar(decodedName),
            monthlyListeners: 'Verified Artist',
            genre: 'Contemporary'
          });
          setArtistTracks([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadArtistData();
    return () => { isMounted = false; };
  }, [decodedName]);

  const artistName = artistMeta?.name || decodedName;
  const artistPortrait = artistMeta?.image || getArtistFallbackAvatar(artistName);

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
    showToast(isFollowing ? `Unfollowed ${artistName}` : `Following ${artistName}`, 'info');
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
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer'
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
            border: '2px solid var(--border-medium)',
            backgroundColor: 'var(--bg-surface)'
          }}
        >
          <img
            src={artistPortrait}
            alt={artistName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => handleArtworkError(e, getArtistFallbackAvatar(artistName))}
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
            {artistName}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Users size={14} />
            <span>{artistMeta?.monthlyListeners || 'Verified Artist'}</span>
            <span>•</span>
            <span>{artistMeta?.genre || 'Contemporary'}</span>
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
            boxShadow: 'var(--shadow-sm)',
            border: 'none',
            cursor: artistTracks.length === 0 ? 'not-allowed' : 'pointer'
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
            fontWeight: 600,
            cursor: artistTracks.length === 0 ? 'not-allowed' : 'pointer'
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
            fontWeight: 600,
            cursor: 'pointer'
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
            emptyMessage={loading ? 'Loading artist catalog...' : `No tracks found for ${artistName}.`}
          />
        </div>
      </section>

      {/* Other Artists You Might Enjoy */}
      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '14px' }}>
          Similar Soundscapes
        </h2>

        <div className="artists-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
          {FEATURED_ARTISTS_POOL.filter(a => a.name.toLowerCase() !== decodedName.toLowerCase()).slice(0, 6).map((a) => (
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
                onError={(e) => handleArtworkError(e, getArtistFallbackAvatar(a.name))}
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
