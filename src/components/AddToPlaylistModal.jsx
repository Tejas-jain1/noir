import React from 'react';
import { useLibrary } from '../context/LibraryContext';
import { X, FolderPlus, Plus, Music2, Check } from 'lucide-react';

export default function AddToPlaylistModal({ track, isOpen, onClose, onOpenCreatePlaylist }) {
  const { playlists, addTrackToPlaylist } = useLibrary();

  if (!isOpen || !track) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-overlay)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderPlus size={20} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Add to Playlist</h3>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-secondary)', padding: '4px', borderRadius: '50%', display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Selected Track Preview */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <img
            src={track.thumbnail}
            alt={track.title}
            style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
          />
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {track.title}
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {track.artist}
            </div>
          </div>
        </div>

        {/* Playlists List */}
        <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => {
              onClose();
              if (onOpenCreatePlaylist) onOpenCreatePlaylist();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px dashed var(--border-strong)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontWeight: 600
            }}
          >
            <Plus size={18} />
            <span>Create New Playlist</span>
          </button>

          {playlists.map((pl) => {
            const hasTrack = (pl.tracks || []).some(t => t.id === track.id);

            return (
              <button
                key={pl.id}
                onClick={() => {
                  addTrackToPlaylist(pl.id, track);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  transition: 'background var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <Music2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pl.name}
                  </span>
                </div>

                {hasTrack ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Check size={14} /> Added
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {(pl.tracks || []).length} songs
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
