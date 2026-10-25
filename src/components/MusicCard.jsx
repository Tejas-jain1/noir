import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { Play, Pause, Heart, MoreVertical, ListPlus, FolderPlus, User, Disc } from 'lucide-react';

export default function MusicCard({ track, onOpenAddToPlaylist }) {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayer();
  const { isLiked, toggleLike } = useLibrary();

  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const isThisPlaying = isCurrent && isPlaying;
  const liked = isLiked(track.id);

  const handleCardClick = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track);
    }
  };

  return (
    <div
      className="music-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'transform var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast)',
        transform: isHovered ? 'translateY(-4px)' : 'none',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'none',
        cursor: 'pointer'
      }}
      onClick={handleCardClick}
    >
      {/* Thumbnail Container */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1/1',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        <img
          src={track.thumbnail}
          alt={track.title}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.4s ease',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)'
          }}
          onError={(e) => {
            // Fallback image if thumbnail fails
            e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
          }}
        />

        {/* Audio Visualizer Badge if currently active */}
        {isCurrent && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
              padding: '6px 8px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <div className={`audio-visualizer ${isThisPlaying ? 'is-playing' : ''}`}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {/* Floating Play Button */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            opacity: (isHovered || isThisPlaying) ? 1 : 0,
            transform: (isHovered || isThisPlaying) ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all var(--transition-fast)'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
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
              boxShadow: 'var(--shadow-md)',
              transition: 'transform var(--transition-fast)'
            }}
            title={isThisPlaying ? 'Pause' : 'Play'}
          >
            {isThisPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />}
          </button>
        </div>
      </div>

      {/* Info & Metadata */}
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
          <h4
            style={{
              fontSize: '0.925rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: isCurrent ? 'var(--accent-solid)' : 'var(--text-primary)',
              flex: 1,
              minWidth: 0
            }}
            title={track.title}
          >
            {track.title}
          </h4>

          {/* Card Context Menu Trigger */}
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                color: 'var(--text-muted)',
                padding: '2px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="More options"
            >
              <MoreVertical size={16} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '6px',
                  minWidth: '160px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <button
                  onClick={() => {
                    addToQueue(track);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <ListPlus size={15} />
                  <span>Add to Queue</span>
                </button>

                <button
                  onClick={() => {
                    if (onOpenAddToPlaylist) onOpenAddToPlaylist(track);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <FolderPlus size={15} />
                  <span>Add to Playlist</span>
                </button>

                <button
                  onClick={() => {
                    toggleLike(track);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    color: liked ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textAlign: 'left'
                  }}
                >
                  <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
                  <span>{liked ? 'Unlike' : 'Like'}</span>
                </button>

                <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    navigate(`/artist/${encodeURIComponent(track.artist)}`);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <User size={15} />
                  <span>View Artist</span>
                </button>

                <button
                  onClick={() => {
                    const albumId = track.album ? track.album.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'featured';
                    navigate(`/album/${albumId}`);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <Disc size={15} />
                  <span>View Album</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <p
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/artist/${encodeURIComponent(track.artist)}`);
          }}
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: 0,
            cursor: 'pointer'
          }}
          title={track.artist}
        >
          {track.artist}
        </p>

        {track.durationFormatted && (
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {track.durationFormatted}
          </span>
        )}
      </div>
    </div>
  );
}
