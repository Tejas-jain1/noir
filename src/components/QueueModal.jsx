import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { X, Trash2, Play, ListX } from 'lucide-react';

export default function QueueModal({ isOpen, onClose }) {
  const { 
    currentTrack, 
    queue, 
    queueIndex, 
    playTrack, 
    removeFromQueue, 
    clearQueue,
    isPlaying 
  } = usePlayer();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-overlay)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          height: '100%',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Play Queue</h3>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              {queue.length} {queue.length === 1 ? 'track' : 'tracks'} in lineup
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
                title="Clear queue"
              >
                <ListX size={14} />
                <span>Clear</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                color: 'var(--text-secondary)',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Now Playing Section */}
          {currentTrack && (
            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '10px'
                }}
              >
                Now Playing
              </span>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-medium)'
                }}
              >
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover'
                  }}
                />

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: 'var(--accent-solid)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {currentTrack.title}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                    {currentTrack.artist}
                  </div>
                </div>

                <div className={`audio-visualizer ${isPlaying ? 'is-playing' : ''}`}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          {/* Up Next List */}
          <div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '10px'
              }}
            >
              Up Next
            </span>

            {queue.length <= 1 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem'
                }}
              >
                Queue is empty. Add songs from Search or Explore!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {queue.map((track, idx) => {
                  if (track.id === currentTrack?.id && idx === queueIndex) return null;

                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      <button
                        onClick={() => playTrack(track)}
                        style={{
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px'
                        }}
                        title="Play now"
                      >
                        <Play size={15} />
                      </button>

                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-sm)',
                          objectFit: 'cover'
                        }}
                      />

                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {track.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {track.artist}
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromQueue(idx)}
                        style={{
                          color: 'var(--text-muted)',
                          padding: '6px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Remove from queue"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
