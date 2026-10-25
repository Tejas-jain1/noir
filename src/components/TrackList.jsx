import React from 'react';
import TrackRow from './TrackRow';
import { Music, Clock } from 'lucide-react';

export default function TrackList({ 
  tracks = [], 
  playlistId = null, 
  onRemoveFromPlaylist = null,
  onOpenAddToPlaylist = null,
  emptyMessage = "No tracks found."
}) {
  if (!tracks || tracks.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          color: 'var(--text-muted)',
          gap: '12px'
        }}
      >
        <Music size={40} strokeWidth={1.5} />
        <p style={{ fontSize: '0.95rem' }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
      {/* Table Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px minmax(180px, 2fr) minmax(120px, 1fr) 90px 48px',
          alignItems: 'center',
          padding: '8px 12px',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '4px',
          gap: '12px'
        }}
      >
        <div style={{ textAlign: 'center' }}>#</div>
        <div>Title</div>
        <div className="desktop-only">Album</div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          <Clock size={13} />
        </div>
        <div />
      </div>

      {/* Rows */}
      {tracks.map((track, idx) => (
        <TrackRow
          key={`${track.id}-${idx}`}
          track={track}
          index={idx}
          playlistId={playlistId}
          onRemoveFromPlaylist={onRemoveFromPlaylist}
          onOpenAddToPlaylist={onOpenAddToPlaylist}
        />
      ))}
    </div>
  );
}
