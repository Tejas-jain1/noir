import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, ArrowRight, User, Disc, ListMusic, Plus, Heart } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';

export default function SearchTopResult({
  result,
  allSongs = [],
  onPlayAlbum,
  onPlayPlaylist
}) {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayer();
  const { isLiked, toggleLike } = useLibrary();

  if (!result) return null;

  const type = result.resultType || result.type || 'song';
  const isCurrentSong = type === 'song' && currentTrack?.id === result.id;
  const isCurrentPlaying = isCurrentSong && isPlaying;
  const liked = type === 'song' && isLiked(result.id);

  const handlePrimaryClick = () => {
    if (type === 'artist') {
      navigate(`/artist/${encodeURIComponent(result.name || result.title)}`);
    } else if (type === 'album') {
      if (onPlayAlbum) onPlayAlbum(result);
      else navigate(`/album/${result.id}`);
    } else if (type === 'playlist') {
      if (onPlayPlaylist) onPlayPlaylist(result);
    } else {
      // Song
      if (isCurrentSong) {
        togglePlay();
      } else {
        playTrack(result, allSongs);
      }
    }
  };

  const getBadgeText = () => {
    switch (type) {
      case 'artist': return 'Artist';
      case 'album': return 'Album';
      case 'playlist': return 'Playlist';
      default: return 'Top Result • Song';
    }
  };

  const isArtist = type === 'artist';

  return (
    <div
      className="search-top-result-card"
      onClick={handlePrimaryClick}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast)',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: 0, flex: 1 }}>
        {/* Artwork */}
        <div
          style={{
            width: '100px',
            height: '100px',
            borderRadius: isArtist ? '50%' : 'var(--radius-lg)',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)'
          }}
        >
          <img
            src={result.thumbnail}
            alt={result.title || result.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
            }}
          />
        </div>

        {/* Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--text-primary)',
              width: 'fit-content'
            }}
          >
            {getBadgeText()}
          </span>

          <h2
            style={{
              fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={result.title || result.name}
          >
            {result.title || result.name}
          </h2>

          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {type === 'song' && (
              <>
                <span>{result.artist}</span>
                {result.album && <span> • {result.album}</span>}
                {result.durationFormatted && <span> • {result.durationFormatted}</span>}
              </>
            )}
            {type === 'artist' && (
              <span>{result.role || 'Featured Artist'}</span>
            )}
            {type === 'album' && (
              <>
                <span>{result.artist}</span>
                {result.year && <span> • {result.year}</span>}
                {result.songCount && <span> • {result.songCount} songs</span>}
              </>
            )}
            {type === 'playlist' && (
              <>
                <span>{result.curator ? `By ${result.curator}` : 'Curated Playlist'}</span>
                {result.songCount && <span> • {result.songCount} songs</span>}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {type === 'song' && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLike(result);
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: liked ? 'var(--accent-solid)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform var(--transition-fast)'
              }}
              title={liked ? 'Liked' : 'Like song'}
            >
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                addToQueue(result);
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Add to Queue"
            >
              <Plus size={18} />
            </button>
          </>
        )}

        {type === 'artist' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/artist/${encodeURIComponent(result.name || result.title)}`);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}
          >
            <span>Explore</span>
            <ArrowRight size={15} />
          </button>
        )}

        {type === 'album' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/album/${result.id}`);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}
          >
            <span>View Album</span>
            <ArrowRight size={15} />
          </button>
        )}

        {/* Primary Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrimaryClick();
          }}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-solid)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            transition: 'transform var(--transition-fast)'
          }}
          title={isCurrentPlaying ? 'Pause' : 'Play'}
        >
          {isCurrentPlaying ? (
            <Pause size={22} fill="currentColor" />
          ) : (
            <Play size={22} fill="currentColor" style={{ marginLeft: isArtist ? 0 : '2px' }} />
          )}
        </button>
      </div>
    </div>
  );
}
