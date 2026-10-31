import test from 'node:test';
import assert from 'node:assert/strict';
import { scrapeSpotifyPlaylist } from '../api/spotify-import.js';
import { parseSpotifyPlaylistId, isSpotifyPlaylistUrl } from '../src/services/spotifyImport.js';

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
