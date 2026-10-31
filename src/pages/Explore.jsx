import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  Disc3,
  Flame,
  Music2,
  Play,
  Radio,
  Sparkles,
  Users
} from 'lucide-react';
import MusicCard from '../components/MusicCard';
import ImportFromSpotifyButton from '../components/ImportFromSpotifyButton';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { normalizeTrackTitle } from '../services/playbackUtils';
import { saavnApi } from '../services/saavnApi';

const normalizeLabel = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeExploreTrackTitle = (title) => normalizeTrackTitle(String(title || '')
  .replace(/\b(?:duet|female|male|trending|new|alternate|alternative)\s+version\s*$/i, ' '));
const hasTrackIdentity = (track) => Boolean(track?.id && typeof track.title === 'string' && track.title.trim());

const getPlayableTracks = (response) => response?.source === 'saavn_cdn' && Array.isArray(response.results)
  ? response.results.filter(track => hasTrackIdentity(track) && track.audioUrl)
  : [];

const uniqueTracks = (tracks) => {
  const seen = new Set();
  return tracks.filter(track => {
    if (!hasTrackIdentity(track) || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
};

const filterFreshTracks = (tracks, previouslyShown) => {
  const seenIds = new Set((previouslyShown || []).map(track => track?.id).filter(Boolean));
  const seenTitles = new Set((previouslyShown || []).map(track => normalizeExploreTrackTitle(track?.title)).filter(Boolean));

  return uniqueTracks(tracks).filter(track => {
    const title = normalizeExploreTrackTitle(track.title);
    if (seenIds.has(track.id) || !title || seenTitles.has(title)) return false;
    seenIds.add(track.id);
    seenTitles.add(title);
    return true;
  });
};

const collectFreshTracks = async (initialTracks, loadPage, previouslyShown, startPage, minimumCount) => {
  const freshTracks = [];
  for (let offset = 0; offset < 4 && freshTracks.length < minimumCount; offset += 1) {
    let candidates = initialTracks;
    if (offset > 0) {
      try {
        candidates = await loadPage(startPage + offset);
      } catch {
        candidates = [];
      }
    }
    const remaining = minimumCount - freshTracks.length;
    freshTracks.push(...filterFreshTracks(candidates, [...previouslyShown, ...freshTracks]).slice(0, remaining));
  }
  return freshTracks;
};

const trackYear = (track) => {
  const match = String(track?.releaseDate || track?.year || '').match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : 0;
};

const sortRecentTracks = (tracks) => {
  const unique = uniqueTracks(tracks);
  const withDates = unique.some(track => trackYear(track) > 0);
  if (!withDates) return unique;
  return unique.sort((a, b) => trackYear(b) - trackYear(a));
};

const buildAlbumCards = (tracks) => {
  const albums = new Map();
  for (const track of uniqueTracks(tracks)) {
    const title = String(track.album || '').trim();
    const key = normalizeLabel(title);
    if (!title || !key || ['single', 'unknownalbum'].includes(key)) continue;
    const album = albums.get(key) || {
      id: key,
      title,
      artist: track.artist || 'Various Artists',
      image: track.thumbnail || '',
      year: track.year || '',
      tracks: []
    };
    if (!album.tracks.some(item => item.id === track.id)) album.tracks.push(track);
    albums.set(key, album);
  }
  return [...albums.values()].slice(0, 12);
};

const artistsFromTracks = (tracks) => {
  const artists = new Map();
  for (const track of uniqueTracks(tracks)) {
    const name = String(track.artist || '').split(',')[0].trim();
    const key = normalizeLabel(name);
    if (name && key && !artists.has(key)) {
      artists.set(key, { id: key, name, image: track.thumbnail || '', role: 'Artist' });
    }
  }
  return [...artists.values()].slice(0, 10);
};

function SectionHeading({ icon, title, subtitle, action }) {
  return (
    <div className="explore-section-heading">
      <div>
        <h2>{icon}<span>{title}</span></h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function SectionMessage({ loading, error, emptyText, onRetry }) {
  if (loading) {
    return (
      <div className="explore-track-rail" aria-label="Loading music">
        {[0, 1, 2, 3, 4].map(index => (
          <div className="explore-skeleton-card" key={index} aria-hidden="true">
            <div className="explore-skeleton-art" />
            <div className="explore-skeleton-line" />
            <div className="explore-skeleton-line short" />
          </div>
        ))}
      </div>
    );
  }

  if (!error) return <div className="explore-empty" role="status">{emptyText}</div>;
  return (
    <div className="explore-empty" role="status">
      <span>{error}</span>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

function TrackRail({ title, subtitle, icon, tracks, loading, error, emptyText, onRetry, onOpenAddToPlaylist }) {
  return (
    <section className="explore-section">
      <SectionHeading icon={icon} title={title} subtitle={subtitle} />
      {tracks.length > 0 ? (
        <div className="explore-track-rail">
          {tracks.map(track => (
            <div className="explore-track-card" key={track.id}>
              <MusicCard track={track} playQueue={tracks} onOpenAddToPlaylist={onOpenAddToPlaylist} />
            </div>
          ))}
        </div>
      ) : (
        <SectionMessage loading={loading} error={error} emptyText={emptyText} onRetry={onRetry} />
      )}
    </section>
  );
}

function ArtworkFallback({ children, visible = false }) {
  return <span className="explore-artwork-fallback" style={{ display: visible ? 'flex' : 'none' }} aria-hidden="true">{children}</span>;
}

function handleArtworkError(event) {
  event.currentTarget.style.display = 'none';
  const fallback = event.currentTarget.nextElementSibling;
  if (fallback?.classList.contains('explore-artwork-fallback')) fallback.style.display = 'flex';
}

export default function Explore({ onOpenAddToPlaylist, onOpenSpotifyImport }) {
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const { playlists: savedPlaylists = [], showToast } = useLibrary();
  const feedRequestRef = useRef(0);
  const shownFeedTracksRef = useRef([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sectionErrors, setSectionErrors] = useState({});
  const [trendingTracks, setTrendingTracks] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [popularArtists, setPopularArtists] = useState([]);
  const [featuredAlbums, setFeaturedAlbums] = useState([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [openingPlaylistId, setOpeningPlaylistId] = useState('');

  useEffect(() => {
    let active = true;
    const requestId = ++feedRequestRef.current;
    const loadExploreData = async () => {
      setLoading(true);
      setSectionErrors({});
      setTrendingTracks([]);
      setNewReleases([]);
      setPopularArtists([]);
      setFeaturedAlbums([]);
      setFeaturedPlaylists([]);
      const currentYear = new Date().getFullYear();
      const forceRefresh = reloadKey > 0;
      const page = reloadKey + 1;
      const results = await Promise.allSettled([
        saavnApi.getTrending({ forceRefresh, page }),
        saavnApi.search(`latest songs ${currentYear}`, { forceRefresh, page }),
        saavnApi.getAutocomplete('top artists', { forceRefresh }),
        saavnApi.getAutocomplete('trending', { forceRefresh })
      ]);
      if (!active || requestId !== feedRequestRef.current) return;

      const nextErrors = {};
      const [trendingResult, releaseResult, artistsResult, playlistsResult] = results;

      const liveTrending = trendingResult.status === 'fulfilled' && Array.isArray(trendingResult.value)
        ? uniqueTracks(trendingResult.value.filter(track => track?.source === 'saavn_cdn' && track.audioUrl))
        : [];
      if (trendingResult.status === 'rejected' || liveTrending.length === 0) nextErrors.trending = 'Trending music could not be loaded.';
      const previousTracks = shownFeedTracksRef.current;
      const nextTrending = forceRefresh
        ? await collectFreshTracks(
          liveTrending,
          pageNumber => saavnApi.getTrending({ forceRefresh: true, page: pageNumber }),
          previousTracks,
          page,
          12
        )
        : liveTrending;
      if (!active || requestId !== feedRequestRef.current) return;
      setTrendingTracks(nextTrending);

      const latestResponse = releaseResult.status === 'fulfilled' ? releaseResult.value : null;
      const latestTracks = sortRecentTracks(getPlayableTracks(latestResponse));
      const recentTracks = latestTracks.filter(track => !trackYear(track) || trackYear(track) >= currentYear - 2);
      const releaseCandidates = recentTracks.length >= 4 ? recentTracks : latestTracks;
      const nextReleases = forceRefresh
        ? await collectFreshTracks(
          releaseCandidates,
          async pageNumber => {
            const response = await saavnApi.search(`latest songs ${currentYear}`, { forceRefresh: true, page: pageNumber });
            const pageTracks = sortRecentTracks(getPlayableTracks(response));
            const recentPageTracks = pageTracks.filter(track => !trackYear(track) || trackYear(track) >= currentYear - 2);
            return recentPageTracks.length >= 4 ? recentPageTracks : pageTracks;
          },
          [...previousTracks, ...nextTrending],
          page,
          8
        )
        : releaseCandidates.slice(0, 16);
      if (!active || requestId !== feedRequestRef.current) return;
      setNewReleases(nextReleases);
      shownFeedTracksRef.current = uniqueTracks(forceRefresh
        ? [...shownFeedTracksRef.current, ...nextTrending, ...nextReleases]
        : [...nextTrending, ...nextReleases]);
      if (releaseResult.status === 'rejected' || !latestResponse || latestResponse.source !== 'saavn_cdn') {
        nextErrors.releases = 'New releases are unavailable right now.';
      }

      const artistsResponse = artistsResult.status === 'fulfilled' ? artistsResult.value : null;
      const apiArtists = (artistsResponse?.artists || [])
        .filter(artist => artist?.id && artist?.name)
        .filter((artist, index, list) => list.findIndex(item => normalizeLabel(item.name) === normalizeLabel(artist.name)) === index)
        .slice(0, 10);
      setPopularArtists(apiArtists.length > 0 ? apiArtists : artistsFromTracks([...liveTrending, ...latestTracks]));
      if (artistsResult.status === 'rejected' || !artistsResponse) nextErrors.artists = 'Popular artists could not be loaded.';

      const playlistsResponse = playlistsResult.status === 'fulfilled' ? playlistsResult.value : null;
      const apiAlbums = (playlistsResponse?.albums || [])
        .filter(album => album?.id && album?.title && Array.isArray(album.trackIds) && album.trackIds.length > 0)
        .filter(album => !['releases', 'unknownalbum'].includes(normalizeLabel(album.title)))
        .slice(0, 8);
      setFeaturedAlbums(apiAlbums);
      const apiPlaylists = (playlistsResponse?.playlists || [])
        .filter(playlist => playlist?.id && playlist?.title)
        .filter((playlist, index, list) => list.findIndex(item => item.id === playlist.id) === index)
        .slice(0, 6);
      setFeaturedPlaylists(apiPlaylists);
      if (playlistsResult.status === 'rejected' || !playlistsResponse || apiPlaylists.length === 0) {
        nextErrors.playlists = 'Featured playlists could not be loaded.';
      }

      setSectionErrors(nextErrors);
      setLoading(false);
    };

    loadExploreData();
    return () => { active = false; };
  }, [reloadKey]);

  const albums = useMemo(() => {
    const liveAlbumCards = featuredAlbums.map(album => ({ ...album, key: `saavn-${album.id}`, tracks: [] }));
    const trackAlbumCards = buildAlbumCards([...newReleases, ...trendingTracks]);
    const seen = new Set(liveAlbumCards.map(album => normalizeLabel(album.title)));
    return [...liveAlbumCards, ...trackAlbumCards.filter(album => !seen.has(normalizeLabel(album.title)))].slice(0, 12);
  }, [featuredAlbums, newReleases, trendingTracks]);
  const allSongs = useMemo(() => uniqueTracks([...newReleases, ...trendingTracks]), [newReleases, trendingTracks]);
  const actualSavedPlaylists = savedPlaylists.filter(playlist => Array.isArray(playlist?.tracks) && playlist.tracks.length > 0);

  const handleFeaturedPlaylistClick = async (playlist) => {
    setOpeningPlaylistId(playlist.id);
    try {
      const details = await saavnApi.getPlaylistDetails(playlist.id);
      const tracks = uniqueTracks(details?.tracks || []);
      if (tracks.length > 0) {
        playTrack(tracks[0], tracks);
        showToast(`Playing ${details.title || playlist.title}`, 'success');
      } else if (!details) {
        showToast('This playlist could not be loaded', 'error');
      } else {
        showToast(`No playable tracks are available in ${playlist.title}`, 'info');
      }
    } catch (error) {
      console.warn(`Failed to open playlist "${playlist.title}":`, error);
      showToast('This playlist could not be loaded', 'error');
    } finally {
      setOpeningPlaylistId('');
    }
  };

  const handleAlbumClick = async (album) => {
    if (!album.trackIds?.length) {
      if (album.tracks?.length) playTrack(album.tracks[0], album.tracks);
      else showToast(`No playable songs are available for ${album.title}`, 'info');
      return;
    }

    setOpeningPlaylistId(`album-${album.id}`);
    try {
      const tracks = uniqueTracks(await saavnApi.getAlbumTracks(album.trackIds));
      if (tracks.length > 0) {
        playTrack(tracks[0], tracks);
        showToast(`Playing ${album.title}`, 'success');
      } else if (album.tracks?.length) {
        playTrack(album.tracks[0], album.tracks);
      } else {
        showToast(`No playable songs are available for ${album.title}`, 'info');
      }
    } catch (error) {
      console.warn(`Failed to load album "${album.title}":`, error);
      showToast(`This album could not be loaded`, 'error');
    } finally {
      setOpeningPlaylistId('');
    }
  };

  const reloadExplore = () => {
    setLoading(true);
    setSectionErrors({});
    setReloadKey(key => key + 1);
  };

  return (
    <div className="page-container explore-page">
      <header className="explore-page-header">
        <div className="explore-page-title">
          <span className="explore-page-icon"><Compass size={22} /></span>
          <div>
            <p className="explore-eyebrow">NOIR DISCOVERY</p>
            <h1>Explore music</h1>
            <p>Find your next favorite in what’s moving, new, and worth another listen.</p>
          </div>
        </div>
        <div className="explore-page-actions">
          <ImportFromSpotifyButton onClick={onOpenSpotifyImport} />
          <button className="explore-refresh-button" type="button" onClick={reloadExplore} disabled={loading}>
            <Radio size={16} />
            <span>{loading ? 'Refreshing' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      <TrackRail
        title="Trending now"
        subtitle={reloadKey === 0 ? 'Live chart favorites from Saavn' : 'Fresh catalog results from Saavn'}
        icon={<Flame size={19} />}
        tracks={trendingTracks}
        loading={loading}
        error={sectionErrors.trending}
        emptyText="No trending tracks are available right now."
        onRetry={reloadExplore}
        onOpenAddToPlaylist={onOpenAddToPlaylist}
      />

      <TrackRail
        title="New releases"
        subtitle="Recent songs surfaced by the live catalog"
        icon={<Sparkles size={19} />}
        tracks={newReleases}
        loading={loading}
        error={sectionErrors.releases}
        emptyText="No new releases are available right now."
        onRetry={reloadExplore}
        onOpenAddToPlaylist={onOpenAddToPlaylist}
      />

      <section className="explore-section">
        <SectionHeading icon={<Users size={19} />} title="Popular artists" subtitle="Artists surfaced by Saavn’s live catalog" />
        {loading ? (
          <div className="explore-entity-rail" aria-label="Loading artists">
            {[0, 1, 2, 3, 4, 5].map(index => <div className="explore-artist-skeleton" key={index}><div /><span /><span /></div>)}
          </div>
        ) : popularArtists.length > 0 ? (
          <div className="explore-entity-rail">
            {popularArtists.map(artist => (
              <button
                className="explore-artist-card"
                key={artist.id}
                type="button"
                onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                aria-label={`Explore ${artist.name}`}
              >
                <span className="explore-artist-artwork">
                  {artist.image ? <><img src={artist.image} alt="" loading="lazy" onError={handleArtworkError} /><ArtworkFallback><Users size={24} /></ArtworkFallback></> : <ArtworkFallback visible><Users size={24} /></ArtworkFallback>}
                </span>
                <strong>{artist.name}</strong>
                <span>{artist.role || 'Artist'}</span>
              </button>
            ))}
          </div>
        ) : (
          <SectionMessage error={sectionErrors.artists} emptyText="Artist discovery is empty right now." onRetry={reloadExplore} />
        )}
      </section>

      <section className="explore-section">
        <SectionHeading icon={<Disc3 size={19} />} title="Albums to explore" subtitle="Albums grouped from live songs and chart results" />
        {loading ? (
          <div className="explore-entity-rail" aria-label="Loading albums">
            {[0, 1, 2, 3, 4].map(index => <div className="explore-entity-skeleton" key={index}><div /><span /><span /></div>)}
          </div>
        ) : albums.length > 0 ? (
          <div className="explore-entity-rail">
            {albums.map(album => (
              <button
                className="explore-album-card"
                key={album.key || album.id}
                type="button"
                onClick={() => handleAlbumClick(album)}
                disabled={openingPlaylistId === `album-${album.id}`}
                aria-label={`Play ${album.title} by ${album.artist}`}
              >
                <span className="explore-entity-artwork">
                  {album.image ? <><img src={album.image} alt="" loading="lazy" onError={handleArtworkError} /><ArtworkFallback><Disc3 size={25} /></ArtworkFallback></> : <ArtworkFallback visible><Disc3 size={25} /></ArtworkFallback>}
                  <span className="explore-play-overlay">
                    {openingPlaylistId === `album-${album.id}` ? <span className="explore-mini-spinner" /> : <Play size={18} fill="currentColor" />}
                  </span>
                </span>
                <strong>{album.title}</strong>
                <span>{album.artist}{album.year ? ` · ${album.year}` : ''}</span>
              </button>
            ))}
          </div>
        ) : (
          <SectionMessage emptyText="Albums will appear here when the live catalog returns music." />
        )}
      </section>

      <section className="explore-section">
        <SectionHeading icon={<Music2 size={19} />} title="Featured playlists" subtitle="Live Saavn playlists and your saved collections" />
        {loading ? (
          <div className="explore-entity-rail" aria-label="Loading playlists">
            {[0, 1, 2, 3, 4].map(index => <div className="explore-entity-skeleton" key={index}><div /><span /><span /></div>)}
          </div>
        ) : featuredPlaylists.length > 0 || actualSavedPlaylists.length > 0 ? (
          <div className="explore-entity-rail">
            {featuredPlaylists.map(playlist => (
              <button
                className="explore-playlist-card"
                key={`saavn-${playlist.id}`}
                type="button"
                onClick={() => handleFeaturedPlaylistClick(playlist)}
                disabled={openingPlaylistId === playlist.id}
                aria-label={`Play playlist ${playlist.title}`}
              >
                <span className="explore-entity-artwork">
                  {playlist.image ? <><img src={playlist.image} alt="" loading="lazy" onError={handleArtworkError} /><ArtworkFallback><Music2 size={25} /></ArtworkFallback></> : <ArtworkFallback visible><Music2 size={25} /></ArtworkFallback>}
                  <span className="explore-play-overlay">
                    {openingPlaylistId === playlist.id ? <span className="explore-mini-spinner" /> : <Play size={18} fill="currentColor" />}
                  </span>
                </span>
                <strong>{playlist.title}</strong>
                <span>{playlist.description || 'Featured on Saavn'}</span>
              </button>
            ))}
            {actualSavedPlaylists.map(playlist => (
              <button
                className="explore-playlist-card"
                key={`local-${playlist.id}`}
                type="button"
                onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.id)}`)}
                aria-label={`Open playlist ${playlist.name}`}
              >
                <span className="explore-entity-artwork">
                  {playlist.coverUrl || playlist.tracks?.[0]?.thumbnail
                    ? <><img src={playlist.coverUrl || playlist.tracks[0].thumbnail} alt="" loading="lazy" onError={handleArtworkError} /><ArtworkFallback><Music2 size={25} /></ArtworkFallback></>
                    : <ArtworkFallback visible><Music2 size={25} /></ArtworkFallback>}
                  <span className="explore-play-overlay"><ArrowRight size={18} /></span>
                </span>
                <strong>{playlist.name}</strong>
                <span>Your playlist</span>
              </button>
            ))}
          </div>
        ) : (
          <SectionMessage error={sectionErrors.playlists} emptyText="No featured or saved playlists are available right now." onRetry={reloadExplore} />
        )}
      </section>

      {!loading && allSongs.length === 0 && Object.values(sectionErrors).some(Boolean) && (
        <div className="explore-page-empty" role="status">
          <Music2 size={22} />
          <p>Live discovery is having trouble connecting. Refresh to try loading the feed again.</p>
          <button type="button" onClick={reloadExplore}>Retry discovery</button>
        </div>
      )}
    </div>
  );
}
