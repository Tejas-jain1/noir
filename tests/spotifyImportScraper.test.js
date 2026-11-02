import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  scrapeSpotifyPlaylist, 
  fetchSpotifyEntityData, 
  parseSpotifyUrl 
} from '../api/spotify-import.js';
import { 
  parseSpotifyPlaylistId, 
  isSpotifyUrl, 
  isSpotifyPlaylistUrl, 
  importAndStreamSpotify,
  fetchSpotifyPlaylist
} from '../src/services/spotifyImport.js';
import { 
  findSpotifySaavnMatch, 
  createImportedSpotifyTrack, 
  countSpotifyImportResults 
} from '../src/services/spotifyPlaylistUtils.js';

test('isSpotifyUrl and isSpotifyPlaylistUrl identify playlists, albums, and tracks', () => {
  assert.equal(isSpotifyUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), true);
  assert.equal(isSpotifyUrl('https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa'), true);
  assert.equal(isSpotifyUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'), true);
  assert.equal(isSpotifyUrl('https://open.spotify.com/intl-in/album/4m2880jivSbbyEGAKfITCa?si=abc'), true);
  assert.equal(isSpotifyUrl('spotify:album:4m2880jivSbbyEGAKfITCa'), true);
  assert.equal(isSpotifyUrl('spotify:track:4cOdK2wGLETKBW3PvgPWqT'), true);
  assert.equal(isSpotifyUrl('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'), true);
  assert.equal(isSpotifyUrl('37i9dQZF1DXcBWIGoYBM5M'), true);
  assert.equal(isSpotifyUrl('https://youtube.com/watch?v=123'), false);
  assert.equal(isSpotifyUrl('https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), false);
  assert.equal(isSpotifyUrl('random search query'), false);
  assert.equal(isSpotifyUrl(''), false);
});

test('parseSpotifyUrl extracts correct entity type and ID', () => {
  const parsedTrack = parseSpotifyUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=xyz');
  assert.deepEqual(parsedTrack, { type: 'track', id: '4cOdK2wGLETKBW3PvgPWqT' });

  const parsedAlbum = parseSpotifyUrl('https://open.spotify.com/intl-es/album/4m2880jivSbbyEGAKfITCa');
  assert.deepEqual(parsedAlbum, { type: 'album', id: '4m2880jivSbbyEGAKfITCa' });

  const parsedPlaylist = parseSpotifyUrl('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M');
  assert.deepEqual(parsedPlaylist, { type: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' });

  assert.equal(parseSpotifyUrl('https://example.com/track/4cOdK2wGLETKBW3PvgPWqT'), null);
});

test('fetchSpotifyEntityData extracts Spotify album metadata and all track items', async () => {
  const result = await fetchSpotifyEntityData('https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa');
  assert.ok(result);
  assert.equal(result.entityType, 'album');
  assert.equal(result.id, '4m2880jivSbbyEGAKfITCa');
  assert.equal(result.title, 'Random Access Memories');
  assert.ok(result.cover && result.cover.startsWith('http'), 'Album must have high-res cover artwork');
  assert.equal(result.tracks.length, 13);
  assert.equal(result.trackCount, 13);

  const firstTrack = result.tracks[0];
  assert.equal(firstTrack.title, 'Give Life Back to Music');
  assert.ok(firstTrack.artist.includes('Daft Punk'));
  assert.ok(firstTrack.duration > 0);
  assert.ok(firstTrack.thumbnail);
  assert.ok(firstTrack.spotifyUrl.includes('0dEIca2nhcxDUV8C5QkPYb'));
});

test('fetchSpotifyEntityData extracts single Spotify track accurately', async () => {
  const result = await fetchSpotifyEntityData('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
  assert.ok(result);
  assert.equal(result.entityType, 'track');
  assert.equal(result.id, '4cOdK2wGLETKBW3PvgPWqT');
  assert.equal(result.title, 'Never Gonna Give You Up');
  assert.equal(result.tracks.length, 1);
  assert.ok(result.cover);

  const track = result.tracks[0];
  assert.equal(track.title, 'Never Gonna Give You Up');
  assert.equal(track.artist, 'Rick Astley');
  assert.equal(track.duration, 214);
  assert.equal(track.durationFormatted, '3:34');
});

test('scrapeSpotifyPlaylist preserves backwards-compatibility for playlists', async () => {
  const result = await scrapeSpotifyPlaylist('37i9dQZF1DXcBWIGoYBM5M');
  assert.ok(result);
  assert.equal(result.id, '37i9dQZF1DXcBWIGoYBM5M');
  assert.ok(result.title.length > 0);
  assert.ok(result.tracks.length > 0);
  assert.ok(result.trackCount > 0);

  const firstTrack = result.tracks[0];
  assert.ok(firstTrack.id.startsWith('sp_'));
  assert.ok(firstTrack.title);
  assert.ok(firstTrack.artist);
  assert.equal(firstTrack.source, 'spotify_import');
  assert.equal(typeof firstTrack.duration, 'number');
});

test('import missing songs: correctly marks catalog-unavailable songs as unplayable without silent replacement', () => {
  const availableSpotifyTrack = {
    spotifyTrackId: 'sp-1',
    title: 'Never Gonna Give You Up',
    artists: ['Rick Astley'],
    album: 'Whenever You Need Somebody',
    duration: 213,
    artwork: 'https://cover.example/astley.jpg'
  };

  const missingSpotifyTrack = {
    spotifyTrackId: 'sp-missing-99',
    title: 'Obscure Independent B-Side',
    artists: ['Underground Indie Band'],
    album: 'Rare Demo Tape 1994',
    duration: 175,
    artwork: 'https://cover.example/indie.jpg'
  };

  const candidatesInCatalog = [
    {
      id: 'saavn-rick-1',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      duration: 214,
      audioUrl: 'https://cdn.example/astley.mp4',
      source: 'saavn_cdn'
    },
    // Completely unrelated track that must never be falsely matched
    {
      id: 'saavn-unrelated',
      title: 'Unrelated Bollywood Song',
      artist: 'Different Artist',
      duration: 250,
      audioUrl: 'https://cdn.example/unrelated.mp4',
      source: 'saavn_cdn'
    }
  ];

  // Match available track
  const match1 = findSpotifySaavnMatch(availableSpotifyTrack, candidatesInCatalog);
  assert.ok(match1, 'Available track must find match');
  assert.equal(match1.id, 'saavn-rick-1');

  const processed1 = createImportedSpotifyTrack(availableSpotifyTrack, match1, 0, 'fallback.jpg');
  assert.equal(processed1.matchStatus, 'matched');
  assert.equal(processed1.isPlayable, true);
  assert.equal(processed1.catalogTrackId, 'saavn-rick-1');
  assert.equal(processed1.audioUrl, 'https://cdn.example/astley.mp4');

  // Match missing track
  const match2 = findSpotifySaavnMatch(missingSpotifyTrack, candidatesInCatalog);
  assert.equal(match2, null, 'Missing track must NOT match unrelated candidate');

  const processed2 = createImportedSpotifyTrack(missingSpotifyTrack, match2, 1, 'fallback.jpg');
  assert.equal(processed2.matchStatus, 'unmatched', 'Must mark as unmatched');
  assert.equal(processed2.isPlayable, false, 'Must be unplayable');
  assert.equal(processed2.catalogTrackId, '', 'Must not assign fake catalog ID');
  assert.equal(processed2.audioUrl, '', 'Must not assign fake audio URL');
  assert.equal(processed2.title, 'Obscure Independent B-Side', 'Must retain original Spotify title');
  assert.equal(processed2.artist, 'Underground Indie Band', 'Must retain original Spotify artist');
  assert.equal(processed2.album, 'Rare Demo Tape 1994', 'Must retain original Spotify album');
  assert.equal(processed2.thumbnail, 'https://cover.example/indie.jpg', 'Must retain original Spotify artwork');
  assert.equal(processed2.unavailableReason, 'Not found in NOIR catalog');

  const counts = countSpotifyImportResults([processed1, processed2]);
  assert.deepEqual(counts, { matched: 1, unmatched: 1, unavailable: 0 });
});

test('handles invalid Spotify URLs with meaningful error messages instead of generic Failed to fetch', async () => {
  await assert.rejects(
    fetchSpotifyPlaylist('https://open.spotify.com/invalid/xyz'),
    /valid Spotify playlist, album, or track/i
  );

  await assert.rejects(
    fetchSpotifyPlaylist(''),
    /Please enter a Spotify/i
  );
});

test('importAndStreamSpotify imports single track link and sets queue cleanly', async () => {
  let savedPlaylist = null;
  let playedTrack = null;
  let playedQueue = null;
  let navigatedTo = null;
  let toastMessage = null;

  const mockImportPlaylist = async (playlist, tracks) => {
    savedPlaylist = { ...playlist, tracks };
    return savedPlaylist;
  };

  const mockPlayTrack = (track, queue) => {
    playedTrack = track;
    playedQueue = queue;
  };

  const mockNavigate = (path) => {
    navigatedTo = path;
  };

  const mockShowToast = (msg) => {
    toastMessage = msg;
  };

  const result = await importAndStreamSpotify('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', {
    playTrack: mockPlayTrack,
    importSpotifyPlaylist: mockImportPlaylist,
    showToast: mockShowToast,
    navigate: mockNavigate
  });

  assert.ok(result);
  assert.ok(result.playlist);
  assert.equal(result.results.length, 1);
  assert.equal(savedPlaylist?.id, result.playlist.id);
  assert.equal(savedPlaylist?.tracks?.length, 1);
  assert.equal(navigatedTo, `/playlist/${result.playlist.id}`);
  assert.ok(toastMessage);
});
