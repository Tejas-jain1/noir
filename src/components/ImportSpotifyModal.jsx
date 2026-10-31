import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { importAndStreamSpotify } from '../services/spotifyImport';
import { X, Loader2, Music2, AlertCircle, Sparkles } from 'lucide-react';

export default function ImportSpotifyModal({
  isOpen,
  initialUrl = '',
  onClose,
  onImported
}) {
  const [url, setUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const { importSpotifyPlaylist, setPlaylists, showToast, user } = useLibrary();

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl || '');
      setError('');
      setIsLoading(false);
      setStatusText('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialUrl]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const targetUrl = url.trim();
    if (!targetUrl) {
      setError('Please paste a Spotify playlist link or ID.');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatusText('Extracting playlist tracks from Spotify...');

    try {
      setStatusText('Setting up queue & 320kbps audio streams...');
      const result = await importAndStreamSpotify(targetUrl, {
        playTrack,
        importSpotifyPlaylist,
        setPlaylists,
        showToast,
        navigate,
        user
      });

      if (onImported && result?.playlist?.id) {
        onImported(result.playlist.id);
      }
      onClose();
    } catch (err) {
      console.error('Spotify import error:', err);
      setError(err.message || 'Failed to import playlist. Please check the URL and make sure it is public.');
      setIsLoading(false);
      setStatusText('');
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => { if (!isLoading) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        className="spotify-import-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'linear-gradient(145deg, #18181c 0%, #101014 100%)',
          border: '1px solid rgba(29, 185, 84, 0.35)',
          borderRadius: '24px',
          padding: '28px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(29, 185, 84, 0.15)',
          color: '#ffffff',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Close (Esc)"
        >
          <X size={18} />
        </button>

        {/* Header with Spotify Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: '#1DB954',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 6px 18px rgba(29, 185, 84, 0.45)'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#000000">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.562.207.855zm1.225-2.724c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.849-.106-.974-.517-.125-.413.108-.849.52-.974 3.632-1.102 8.147-.568 11.234 1.328.366.226.48.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.493.15-1.016-.13-1.165-.624-.15-.493.13-1.016.624-1.165 3.532-1.073 9.404-.866 13.115 1.338.445.264.59.838.327 1.282-.264.443-.838.59-1.282.324z"/>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
              Import Spotify Playlist
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#A1A1AA', margin: '4px 0 0' }}>
              Instant extraction & high-quality 320kbps playback
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          <label
            htmlFor="spotify-playlist-url-input"
            style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '8px'
            }}
          >
            Spotify Playlist Link or ID
          </label>

          <div style={{ position: 'relative', width: '100%' }}>
            <input
              id="spotify-playlist-url-input"
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError('');
              }}
              disabled={isLoading}
              placeholder="https://open.spotify.com/playlist/..."
              style={{
                width: '100%',
                padding: '12px 16px',
                paddingRight: url ? '38px' : '16px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: error ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: '0.92rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease'
              }}
            />
            {url && !isLoading && (
              <button
                type="button"
                onClick={() => setUrl('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick instructions / features */}
          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(29, 185, 84, 0.08)',
              border: '1px solid rgba(29, 185, 84, 0.2)',
              fontSize: '0.78rem',
              color: '#d1d5db',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={16} style={{ color: '#1DB954', flexShrink: 0 }} />
            <span>
              Works with any public Spotify link. Zero setup or API keys needed.
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Status Text when Loading */}
          {isLoading && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e4e4e7',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <Loader2 size={18} className="brand-logo-spin" style={{ color: '#1DB954', flexShrink: 0 }} />
              <span>{statusText || 'Processing Spotify playlist...'}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '22px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              style={{
                flex: 1.5,
                padding: '12px 20px',
                borderRadius: '9999px',
                backgroundColor: '#1DB954',
                color: '#000000',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: (isLoading || !url.trim()) ? 'not-allowed' : 'pointer',
                opacity: (isLoading || !url.trim()) ? 0.6 : 1,
                boxShadow: '0 4px 16px rgba(29, 185, 84, 0.4)',
                transition: 'transform 0.15s ease, opacity 0.15s ease'
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="brand-logo-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Music2 size={18} />
                  <span>Import & Stream</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
