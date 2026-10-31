import test from 'node:test';
import assert from 'node:assert/strict';
import { scrapeSpotifyPlaylist } from '../api/spotify-import.js';
import { parseSpotifyPlaylistId, isSpotifyPlaylistUrl, importAndStreamSpotify } from '../src/services/spotifyImport.js';

test('isSpotifyPlaylistUrl correctly identifies Spotify playlist links', () => {
  assert.equal(isSpotifyPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), true);
  assert.equal(isSpotifyPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=123'), true);
  assert.equal(isSpotifyPlaylistUrl('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'), true);
  assert.equal(isSpotifyPlaylistUrl('37i9dQZF1DXcBWIGoYBM5M'), true);
  assert.equal(isSpotifyPlaylistUrl('https://youtube.com/watch?v=123'), false);
  assert.equal(isSpotifyPlaylistUrl('random search query'), false);
  assert.equal(isSpotifyPlaylistUrl(''), false);
});

test('parseSpotifyPlaylistId extracts playlist IDs accurately', () => {
  assert.equal(parseSpotifyPlaylistId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc'), '37i9dQZF1DXcBWIGoYBM5M');
  assert.equal(parseSpotifyPlaylistId('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'), '37i9dQZF1DXcBWIGoYBM5M');
  assert.equal(parseSpotifyPlaylistId('37i9dQZF1DXcBWIGoYBM5M'), '37i9dQZF1DXcBWIGoYBM5M');
});

test('scrapeSpotifyPlaylist extracts real track metadata from embed page', async () => {
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

test('importAndStreamSpotify saves playlist to library and initiates playback', async () => {
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

  const result = await importAndStreamSpotify('37i9dQZF1DXcBWIGoYBM5M', {
    playTrack: mockPlayTrack,
    importSpotifyPlaylist: mockImportPlaylist,
    showToast: mockShowToast,
    navigate: mockNavigate
  });

  assert.ok(result);
  assert.ok(result.playlist);
  assert.ok(result.results.length > 0);
  assert.equal(savedPlaylist?.id, result.playlist.id);
  assert.equal(savedPlaylist?.tracks?.length, result.results.length);
  assert.equal(playedTrack?.id, result.results[0].id);
  assert.equal(playedQueue?.length, result.results.length);
  assert.equal(navigatedTo, `/playlist/${result.playlist.id}`);
  assert.ok(toastMessage);
});
