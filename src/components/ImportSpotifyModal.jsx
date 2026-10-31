import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, ExternalLink, LoaderCircle, Music2, X } from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { saavnApi } from '../services/saavnApi';
import { findSpotifyPlaylistMatch } from '../services/spotifyPlaylistMatcher';
import { spotifyImport } from '../services/spotifyImport';

const getErrorMessage = (error) => error instanceof Error ? error.message : 'Spotify could not be reached. Please try again.';

export default function ImportSpotifyModal({ isOpen, onClose, onImported }) {
  const { createPlaylist, showToast } = useLibrary();
  const [clientId, setClientId] = useState(() => spotifyImport.getClientId());
  const [clientIdSaved, setClientIdSaved] = useState(() => Boolean(spotifyImport.getClientId()));
  const [isConnected, setIsConnected] = useState(() => spotifyImport.isConnected());
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistError, setPlaylistError] = useState('');
  const [importingId, setImportingId] = useState('');
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    setPlaylistError('');
    try {
      const nextPlaylists = await spotifyImport.getPlaylists();
      setPlaylists(nextPlaylists);
    } catch (requestError) {
      setPlaylistError(getErrorMessage(requestError));
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;

    const handleSpotifySession = async () => {
      if (spotifyImport.hasOAuthCallback() || spotifyImport.isCompletingOAuthCallback()) {
        setError('');
        setConnected(false);
        try {
          await spotifyImport.completeOAuthCallback();
          if (!active) return;
          setIsConnected(true);
          setConnected(true);
          await loadPlaylists();
        } catch (callbackError) {
          if (active) setError(getErrorMessage(callbackError));
        }
      } else if (spotifyImport.isConnected()) {
        setIsConnected(true);
        await loadPlaylists();
      }
    };

    handleSpotifySession();
    return () => { active = false; };
  }, [isOpen, loadPlaylists]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setError('');
    try {
      const savedId = spotifyImport.saveClientId(clientId);
      setClientId(savedId);
      setClientIdSaved(true);
      await spotifyImport.connect();
    } catch (connectError) {
      setError(getErrorMessage(connectError));
    }
  };

  const handleDisconnect = () => {
    spotifyImport.disconnect();
    setIsConnected(false);
    setConnected(false);
    setPlaylists([]);
    setPlaylistError('');
    setError('');
  };

  const handleImport = async (playlist) => {
    if (!playlist?.id || importingId) return;
    setError('');
    setImportingId(playlist.id);

    try {
      const spotifyTracks = await spotifyImport.getPlaylistItems(playlist.id);
      if (spotifyTracks.length === 0) {
        setError('This playlist does not have any importable songs.');
        return;
      }

      setImportProgress({ done: 0, total: spotifyTracks.length });
      const matchedTracks = Array(spotifyTracks.length).fill(null);
      const queryCache = new Map();
      let nextIndex = 0;
      let completedCount = 0;

      const worker = async () => {
        while (nextIndex < spotifyTracks.length) {
          const index = nextIndex;
          nextIndex += 1;
          const sourceTrack = spotifyTracks[index];
          const query = [sourceTrack.title, ...sourceTrack.artists].filter(Boolean).join(' ').trim();

          try {
            let searchPromise = queryCache.get(query.toLowerCase());
            if (!searchPromise) {
              searchPromise = saavnApi.search(query);
              queryCache.set(query.toLowerCase(), searchPromise);
            }
            const response = await searchPromise;
            const candidates = response?.source === 'saavn_cdn' && Array.isArray(response.results)
              ? response.results.filter(track => track?.audioUrl && track?.id && track?.title)
              : [];
            matchedTracks[index] = findSpotifyPlaylistMatch(sourceTrack, candidates);
          } catch (searchError) {
            console.warn(`Could not find a NOIR catalog match for "${sourceTrack.title}":`, searchError);
          }

          completedCount += 1;
          setImportProgress({ done: completedCount, total: spotifyTracks.length });
        }
      };

      await Promise.all(Array.from({ length: Math.min(3, spotifyTracks.length) }, worker));
      const playableTracks = matchedTracks.filter(Boolean);
      if (playableTracks.length === 0) {
        setError('NOIR could not find playable catalog matches for this playlist. Try another playlist or try again later.');
        return;
      }

      const playlistName = `Spotify · ${playlist.name}`;
      const description = `Imported from Spotify · ${playableTracks.length} of ${spotifyTracks.length} tracks matched`;
      const createdPlaylist = createPlaylist(playlistName, description, playableTracks);
      showToast(
        playableTracks.length === spotifyTracks.length
          ? `Imported ${playableTracks.length} songs from Spotify`
          : `Imported ${playableTracks.length} of ${spotifyTracks.length} Spotify songs`,
        playableTracks.length === spotifyTracks.length ? 'success' : 'info'
      );
      if (createdPlaylist?.id) onImported?.(createdPlaylist.id);
    } catch (importError) {
      setError(getErrorMessage(importError));
    } finally {
      setImportingId('');
      setImportProgress({ done: 0, total: 0 });
    }
  };

  return (
    <div className="spotify-import-backdrop" role="presentation" onClick={importingId ? undefined : onClose}>
      <section
        className="spotify-import-modal animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotify-import-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="spotify-import-modal-header">
          <div className="spotify-import-heading">
            <span className="spotify-import-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M6.8 9.1c3.7-1.1 7.8-.6 10.8 1.4M7.7 12.2c3.1-.9 6.4-.4 9 1.2M8.5 15.1c2.4-.6 4.9-.2 6.9 1" /></svg>
            </span>
            <div>
              <h2 id="spotify-import-title">Import from Spotify</h2>
              <p>Bring a playlist into your NOIR library</p>
            </div>
          </div>
          <button type="button" className="spotify-import-close" onClick={onClose} disabled={Boolean(importingId)} aria-label="Close import dialog">
            <X size={20} />
          </button>
        </header>

        <div className="spotify-import-content">
          {!clientIdSaved ? (
            <div className="spotify-import-setup">
              <p>Connect securely with Spotify to choose one of your playlists. NOIR will match the songs to its playable catalog and keep their order.</p>
              <label htmlFor="spotify-client-id">Spotify app Client ID</label>
              <input
                id="spotify-client-id"
                type="text"
                autoComplete="off"
                value={clientId}
                onChange={event => setClientId(event.target.value)}
                placeholder="Paste Client ID"
              />
              <p className="spotify-import-help">Create an app in Spotify Developer Dashboard, then add this exact redirect URI to its settings:</p>
              <code className="spotify-import-redirect-uri">{spotifyImport.getRedirectUri()}</code>
              <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="spotify-import-dashboard-link">
                Open Spotify Developer Dashboard <ExternalLink size={14} />
              </a>
              <button className="spotify-import-primary" type="button" onClick={handleConnect} disabled={!clientId.trim()}>
                Connect with Spotify
              </button>
            </div>
          ) : !isConnected ? (
            <div className="spotify-import-connect">
              <p>Sign in with Spotify and choose from your playlists. NOIR only requests permission to read playlists you own or collaborate on.</p>
              <button className="spotify-import-primary" type="button" onClick={handleConnect}>
                Connect with Spotify
              </button>
              <button className="spotify-import-text-button" type="button" onClick={() => setClientIdSaved(false)}>Change Spotify app</button>
            </div>
          ) : (
            <div className="spotify-import-library">
              <div className="spotify-import-library-heading">
                <span><Check size={15} /> {connected ? 'Spotify connected' : 'Choose a playlist'}</span>
                <div>
                  <button type="button" onClick={loadPlaylists} disabled={loadingPlaylists || Boolean(importingId)}>
                    {loadingPlaylists ? 'Loading…' : 'Refresh'}
                  </button>
                  <button type="button" onClick={handleDisconnect} disabled={Boolean(importingId)}>Disconnect</button>
                </div>
              </div>
              {loadingPlaylists ? (
                <div className="spotify-import-loading" role="status"><LoaderCircle size={20} className="spotify-import-spinner" /> Loading your playlists…</div>
              ) : playlistError ? (
                <div className="spotify-import-inline-error" role="alert"><AlertCircle size={17} />{playlistError}<button type="button" onClick={loadPlaylists}>Try again</button></div>
              ) : playlists.length === 0 ? (
                <div className="spotify-import-empty"><Music2 size={22} /><span>No importable playlists found. NOIR can import playlists you own or collaborate on.</span></div>
              ) : (
                <div className="spotify-import-playlists">
                  {playlists.map(playlist => (
                    <div className="spotify-import-playlist" key={playlist.id}>
                      <span className="spotify-import-playlist-art"><Music2 size={18} /></span>
                      <span className="spotify-import-playlist-info">
                        <strong title={playlist.name}>{playlist.name}</strong>
                <span>{Number(playlist.items?.total ?? playlist.tracks?.total) || 0} songs</span>
                      </span>
                      <button type="button" onClick={() => handleImport(playlist)} disabled={Boolean(importingId)}>
                        {importingId === playlist.id ? <><LoaderCircle size={14} className="spotify-import-spinner" />{importProgress.total ? `${importProgress.done}/${importProgress.total}` : 'Loading'}</> : 'Import'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <div className="spotify-import-error" role="alert"><AlertCircle size={17} />{error}</div>}
        </div>
      </section>
    </div>
  );
}
