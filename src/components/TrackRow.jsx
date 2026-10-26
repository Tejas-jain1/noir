import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { Play, Pause, Heart, MoreHorizontal, Trash2, ListPlus, FolderPlus } from 'lucide-react';

export default function TrackRow({ 
  track, 
  index, 
  playlistId = null, 
  onRemoveFromPlaylist = null,
  onOpenAddToPlaylist = null 
}) {
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayer();
  const { isLiked, toggleLike } = useLibrary();

  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const isThisPlaying = isCurrent && isPlaying;
  const liked = isLiked(track.id);

  const handlePlayToggle = (e) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track);
    }
  };

  return (
    <div
      className="track-row-grid"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
      onClick={() => {
        if (!isCurrent) playTrack(track);
        else togglePlay();
      }}
      style={{
        backgroundColor: isCurrent ? 'var(--bg-surface-hover)' : isHovered ? 'var(--bg-surface)' : 'transparent',
        border: '1px solid',
        borderColor: isCurrent ? 'var(--border-medium)' : 'transparent',
        cursor: 'pointer'
      }}
    >
      {/* 1. Index or Play icon or Visualizer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isHovered ? (
          <button
            onClick={handlePlayToggle}
            style={{
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isThisPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
        ) : isCurrent ? (
          <div className={`audio-visualizer ${isThisPlaying ? 'is-playing' : ''}`}>
            <span />
            <span />
            <span />
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>
            {index + 1}
          </span>
        )}
      </div>

      {/* 2. Title & Artist & Thumbnail */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', minWidth: 0 }}>
        <img
          src={track.thumbnail}
          alt={track.title}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            objectFit: 'cover',
            flexShrink: 0,
            backgroundColor: 'var(--bg-surface)'
          }}
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80';
          }}
        />

        <div style={{ overflow: 'hidden', minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              color: isCurrent ? 'var(--accent-solid)' : 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '0.875rem'
            }}
            title={track.title}
          >
            {track.title}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title={track.artist}
          >
            <span>{track.artist}</span>
            {track.source === 'audius' && (
              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-subtle)', color: 'var(--accent-solid)', fontWeight: 700, flexShrink: 0 }}>
                HTML5
              </span>
            )}
            {track.source === 'supabase' && (
              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-subtle)', color: 'var(--accent-solid)', fontWeight: 700, flexShrink: 0 }}>
                Cloud
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Album / Genre (Desktop only) */}
      <div
        className="desktop-only"
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {track.album || track.genre || 'Single'}
      </div>

      {/* 4. Duration & Like Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(track);
          }}
          style={{
            color: liked ? 'var(--text-primary)' : 'var(--text-muted)',
            opacity: liked || isHovered ? 1 : 0.6,
            display: 'flex',
            alignItems: 'center',
            padding: '4px'
          }}
          title={liked ? 'Unlike' : 'Like'}
        >
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
        </button>

        <span className="track-duration-text" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
          {track.durationFormatted || '3:30'}
        </span>
      </div>

      {/* 5. Options Menu */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            color: 'var(--text-muted)',
            padding: '4px',
            borderRadius: '4px',
            opacity: isHovered || showMenu ? 1 : 0.7
          }}
        >
          <MoreHorizontal size={16} />
        </button>

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
              minWidth: '170px',
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

            {onOpenAddToPlaylist && (
              <button
                onClick={() => {
                  onOpenAddToPlaylist(track);
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
            )}

            {playlistId && onRemoveFromPlaylist && (
              <button
                onClick={() => {
                  onRemoveFromPlaylist(playlistId, track.id);
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
                <Trash2 size={15} />
                <span>Remove from Playlist</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
