import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { saavnApi } from '../services/saavnApi';
import { MOCK_TRACKS } from '../services/mockCatalog';
import TrackList from '../components/TrackList';
import { Play, Shuffle, Plus, ChevronLeft, Disc, Loader2 } from 'lucide-react';

export default function AlbumPage({ onOpenAddToPlaylist }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playTrack, toggleShuffle, addTracksToQueue } = usePlayer();
  const { showToast } = useLibrary();

  const decodedId = decodeURIComponent(id || '');
  const [albumMeta, setAlbumMeta] = useState(null);
  const [albumTracks, setAlbumTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadAlbum() {
      setLoading(true);
      try {
        // Try direct album details if id is numeric or valid saavn id
        const details = await saavnApi.getAlbumDetails(decodedId);
        if (isMounted && details && details.tracks && details.tracks.length > 0) {
          setAlbumMeta(details);
          setAlbumTracks(details.tracks);
          setLoading(false);
          return;
        }

        // Try searching album by name
        const albums = await saavnApi.searchAlbums(decodedId, 1, 1);
        if (albums && albums.length > 0) {
          const matchedDetails = await saavnApi.getAlbumDetails(albums[0].id);
          if (isMounted && matchedDetails && matchedDetails.tracks && matchedDetails.tracks.length > 0) {
            setAlbumMeta(matchedDetails);
            setAlbumTracks(matchedDetails.tracks);
            setLoading(false);
            return;
          }
        }

        // Search songs as fallback
        const songs = await saavnApi.searchSongs(`${decodedId} album`, 1, 15);
        if (isMounted) {
          if (songs && songs.length > 0) {
            setAlbumMeta({
              id: decodedId,
              title: decodedId,
              artist: songs[0]?.artist || 'Various Artists',
              thumbnail: songs[0]?.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
              year: songs[0]?.year || ''
            });
            setAlbumTracks(songs);
          } else {
            // Mock fallback
            const match = MOCK_TRACKS.find(t => (t.album && t.album.toLowerCase() === decodedId.toLowerCase()) || t.id === decodedId) || MOCK_TRACKS[0];
            setAlbumMeta({
              id: decodedId,
              title: match?.album || decodedId,
              artist: match?.artist || 'Featured Artist',
              thumbnail: match?.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'
            });
            setAlbumTracks(MOCK_TRACKS.slice(0, 8));
          }
        }
      } catch (err) {
        if (isMounted) {
          setAlbumTracks(MOCK_TRACKS.slice(0, 6));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAlbum();
    return () => { isMounted = false; };
  }, [decodedId]);

  const albumTitle = albumMeta?.title || decodedId;
  const albumArtist = albumMeta?.artist || 'Featured Artist';
  const albumArtwork = albumMeta?.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';

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

  const handleAddAllToQueue = () => {
    if (albumTracks.length > 0 && addTracksToQueue) {
      addTracksToQueue(albumTracks, albumTitle);
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
            borderRadius: 'var(--radius-sm)'
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
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border-medium)'
          }}
        >
          <img
            src={albumArtwork}
            alt={albumTitle}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
            }}
          />
        </div>

        <div className="playlist-header-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
            Album {albumMeta?.year ? `• ${albumMeta.year}` : ''}
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
            <span>•</span>
            <span>{albumTracks.length} tracks</span>
            {totalMinutes > 0 && (
              <>
                <span>•</span>
                <span>{totalMinutes} min</span>
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
            boxShadow: 'var(--shadow-sm)'
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
            fontWeight: 600
          }}
        >
          <Shuffle size={16} />
          <span>Shuffle</span>
        </button>

        <button
          onClick={handleAddAllToQueue}
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
            fontWeight: 600
          }}
        >
          <Plus size={16} />
          <span>Add to Queue</span>
        </button>
      </div>

      {/* Album Tracks Section */}
      <section>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', gap: '10px' }}>
              <Loader2 size={24} className="brand-logo-spin" />
              <span>Loading album tracks...</span>
            </div>
          ) : (
            <TrackList
              tracks={albumTracks}
              onOpenAddToPlaylist={onOpenAddToPlaylist}
              emptyMessage={`No tracks found for ${albumTitle}.`}
            />
          )}
        </div>
      </section>
    </div>
  );
}
