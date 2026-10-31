import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { getTrackById } from '../services/mockCatalog';
import TrackList from '../components/TrackList';
import { SpotifyMark } from '../components/ImportSpotifyButton';
import { Music2, Play, Shuffle, Edit2, Trash2, Check, X } from 'lucide-react';

export default function PlaylistDetail({ onOpenAddToPlaylist }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playlists, updatePlaylist, deletePlaylist, removeTrackFromPlaylist } = useLibrary();
  const { playTrack, toggleShuffle } = usePlayer();

  const playlist = playlists.find(p => p.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist?.name || '');
  const [editDesc, setEditDesc] = useState(playlist?.description || '');

  if (!playlist) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2>Playlist not found</h2>
        <button
          onClick={() => navigate('/library')}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--accent-solid)',
            color: 'var(--accent-text)',
            fontWeight: 600
          }}
        >
          Return to Library
        </button>
      </div>
    );
  }

  let tracks = playlist.tracks || [];
  if (tracks.length === 0 && playlist.trackIds && playlist.trackIds.length > 0) {
    tracks = playlist.trackIds.map(tid => getTrackById(tid)).filter(Boolean);
  }

  const playableTracks = tracks.filter(track => track.isPlayable !== false && !['unmatched', 'unavailable'].includes(track.matchStatus));
  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMinutes = Math.floor(totalDuration / 60);

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    updatePlaylist(playlist.id, {
      name: editName.trim(),
      description: editDesc.trim()
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the playlist "${playlist.name}"?`)) {
      deletePlaylist(playlist.id);
      navigate('/library');
    }
  };

  const handlePlayAll = () => {
    if (playableTracks.length > 0) {
      playTrack(playableTracks[0], playableTracks);
    }
  };

  const handleShuffleAll = () => {
    if (playableTracks.length > 0) {
      const shuffled = [...playableTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
      toggleShuffle();
    }
  };

  return (
    <div className="page-container">
      {/* Header Banner */}
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
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0
          }}
        >
          {playlist.coverUrl ? <img src={playlist.coverUrl} alt={`${playlist.name} cover`} style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} /> : <Music2 size={64} />}
        </div>

        <div className="playlist-header-content" style={{ flex: 1, minWidth: '240px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
            {playlist.sourceType === 'spotify' ? 'Imported Spotify playlist' : 'Playlist'}
          </span>

          {isEditing ? (
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)'
                }}
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Playlist description"
                rows={2}
                style={{
                  fontSize: '0.85rem',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                  resize: 'none'
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-solid)',
                    color: 'var(--accent-text)',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  <Check size={14} />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem'
                  }}
                >
                  <X size={14} />
                  <span>Cancel</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', fontWeight: 800, margin: '4px 0 6px' }}>
                {playlist.name}
              </h1>
              {playlist.description && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.4 }}>
                  {playlist.description}
                </p>
              )}
              {playlist.sourceType === 'spotify' && playlist.sourceUrl && (
                <a className="spotify-attribution-link playlist-spotify-attribution" href={playlist.sourceUrl} target="_blank" rel="noreferrer">
                  <SpotifyMark size={16} />
                  <span>Open playlist on Spotify</span>
                </a>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{playlist.sourceType === 'spotify' ? (playlist.ownerName || 'Spotify collection') : 'Personal Collection'}</span>
                <span>•</span>
                <span>{playlist.totalTrackCount || tracks.length} {playlist.totalTrackCount === 1 ? 'song' : 'songs'}</span>
                {totalMinutes > 0 && (
                  <>
                    <span>•</span>
                    <span>about {totalMinutes} min</span>
                  </>
                )}
              </div>
              {playlist.sourceType === 'spotify' && (
                <p className="spotify-import-results" style={{ marginTop: '8px' }}>
                  {playlist.matchedTrackCount || 0} playable · {playlist.unmatchedTrackCount || 0} unmatched · {playlist.unavailableTrackCount || 0} unavailable
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handlePlayAll}
            disabled={playableTracks.length === 0}
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
              opacity: playableTracks.length === 0 ? 0.5 : 1,
              cursor: playableTracks.length === 0 ? 'not-allowed' : 'pointer'
            }}
            title="Play All"
          >
            <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
          </button>

          <button
            onClick={handleShuffleAll}
            disabled={playableTracks.length === 0}
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
              opacity: playableTracks.length === 0 ? 0.5 : 1
            }}
          >
            <Shuffle size={16} />
            <span>Shuffle</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              setEditName(playlist.name);
              setEditDesc(playlist.description || '');
              setIsEditing(!isEditing);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </button>

          <button
            onClick={handleDelete}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Tracks Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
        {tracks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <Music2 size={48} strokeWidth={1.5} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>This playlist is empty</h3>
            <p style={{ fontSize: '0.875rem', maxWidth: '360px', margin: 0 }}>
              Add songs from Search, Home, or Explore using the "Add to Playlist" option on any track.
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
              Search Songs
            </button>
          </div>
        ) : (
          <TrackList
            tracks={tracks}
            playlistId={playlist.id}
            onRemoveFromPlaylist={removeTrackFromPlaylist}
            onOpenAddToPlaylist={onOpenAddToPlaylist}
            onTrackPlay={track => {
              if (track.isPlayable === false || ['unmatched', 'unavailable'].includes(track.matchStatus)) return;
              playTrack(track, playableTracks);
            }}
          />
        )}
      </div>
    </div>
  );
}
