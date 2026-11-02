import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { saavnApi } from '../services/saavnApi';
import { MOCK_TRACKS } from '../services/mockCatalog';
import TrackList from '../components/TrackList';
import { Play, Shuffle, ChevronLeft, Disc } from 'lucide-react';
import { getTrackFallbackArtwork, handleArtworkError } from '../services/artworkUtils';

export default function AlbumPage({ onOpenAddToPlaylist }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playTrack, toggleShuffle } = usePlayer();

  const decodedId = decodeURIComponent(id || '').trim();
  const [albumMeta, setAlbumMeta] = useState(null);
  const [albumTracks, setAlbumTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadAlbumData() {
      setLoading(true);
      try {
        const details = await saavnApi.getAlbumDetails(decodedId);
        if (isMounted && details && Array.isArray(details.tracks) && details.tracks.length > 0) {
          setAlbumMeta({
            id: details.id,
            title: details.title,
            artist: details.artist,
            artwork: details.image,
            year: details.year
          });
          setAlbumTracks(details.tracks);
          return;
        }

        // Check if query matches a known track in mock catalog
        const cleanLower = decodedId.toLowerCase().replace(/[-_]+/g, ' ');
        const mockMatches = MOCK_TRACKS.filter(t => 
          (t.album && t.album.toLowerCase().includes(cleanLower)) ||
          t.title.toLowerCase().includes(cleanLower) ||
          t.id === decodedId
        );

        if (isMounted) {
          if (mockMatches.length > 0) {
            const first = mockMatches[0];
            setAlbumMeta({
              id: decodedId,
              title: first.album || decodedId,
              artist: first.artist || 'Featured Artist',
              artwork: first.thumbnail,
              year: first.releaseYear || ''
            });
            setAlbumTracks(mockMatches);
          } else {
            // Clean fallback using the requested ID without fabricating unrelated album
            setAlbumMeta({
              id: decodedId,
              title: decodedId.replace(/[-_]+/g, ' '),
              artist: 'Featured Artist',
              artwork: '',
              year: ''
            });
            setAlbumTracks([]);
          }
        }
      } catch (err) {
        console.warn('Failed to load album data for:', decodedId, err);
        if (isMounted) {
          setAlbumMeta({
            id: decodedId,
            title: decodedId.replace(/[-_]+/g, ' '),
            artist: 'Featured Artist',
            artwork: '',
            year: ''
          });
          setAlbumTracks([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAlbumData();
    return () => { isMounted = false; };
  }, [decodedId]);

  const albumTitle = albumMeta?.title || decodedId.replace(/[-_]+/g, ' ') || 'Album';
  const albumArtist = albumMeta?.artist || 'Featured Artist';
  const albumArtwork = albumMeta?.artwork || getTrackFallbackArtwork(albumTitle, albumArtist);

  const totalDuration = albumTracks.reduce((acc, t) => acc + (t.duration || 200), 0);
  const totalMinutes = Math.floor(totalDuration / 60);

  const handlePlayAll = () => {
    if (albumTracks.length > 0) {
      playTrack(albumTracks[0], albumTracks);
    }
  };

  const handleShuffleAll = () => {
    if (albumTracks.length > 0) {
      const shuffled = [...albumTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
      toggleShuffle();
    }
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

      {/* Album Header Banner */}
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
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border-medium)',
            backgroundColor: 'var(--bg-surface)'
          }}
        >
          <img
            src={albumArtwork}
            alt={albumTitle}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => handleArtworkError(e, getTrackFallbackArtwork(albumTitle, albumArtist))}
          />
        </div>

        <div className="playlist-header-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
            Studio Album
          </span>

          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
            {albumTitle}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            <span
              onClick={() => navigate(`/artist/${encodeURIComponent(albumArtist)}`)}
              style={{ fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {albumArtist}
            </span>
            {albumTracks.length > 0 && (
              <>
                <span>•</span>
                <span>{albumTracks.length} {albumTracks.length === 1 ? 'track' : 'tracks'}</span>
              </>
            )}
            {totalMinutes > 0 && (
              <>
                <span>•</span>
                <span>{totalMinutes} min</span>
              </>
            )}
            {albumMeta?.year && (
              <>
                <span>•</span>
                <span>{albumMeta.year}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <button
          onClick={handlePlayAll}
          disabled={albumTracks.length === 0}
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
            cursor: albumTracks.length === 0 ? 'not-allowed' : 'pointer'
          }}
          title="Play Album"
        >
          <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
        </button>

        <button
          onClick={handleShuffleAll}
          disabled={albumTracks.length === 0}
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
            cursor: albumTracks.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          <Shuffle size={16} />
          <span>Shuffle</span>
        </button>
      </div>

      {/* Album Tracks Section */}
      <section>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
          <TrackList
            tracks={albumTracks}
            onOpenAddToPlaylist={onOpenAddToPlaylist}
            emptyMessage={loading ? 'Loading album tracks...' : `No tracks found for ${albumTitle}.`}
          />
        </div>
      </section>
    </div>
  );
}
