import React from 'react';
import TrackRow from './TrackRow';
import { Music, Clock } from 'lucide-react';

export default function TrackList({ 
  tracks = [], 
  playlistId = null, 
  onRemoveFromPlaylist = null,
  onOpenAddToPlaylist = null,
  onTrackPlay = null,
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
      <div className="track-table-header">
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
          onTrackPlay={onTrackPlay}
        />
      ))}
    </div>
  );
}
