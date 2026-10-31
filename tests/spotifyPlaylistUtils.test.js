import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectSpotifyPlaylistPages,
  countSpotifyImportResults,
  createImportedSpotifyTrack,
  findSpotifySaavnMatch,
  formatSpotifyDuration,
  parseSpotifyPlaylistId,
  spotifyPlaylistItemToTrack
} from '../src/services/spotifyPlaylistUtils.js';

const saavnTrack = {
  id: 'saavn-123',
  title: 'Gehra Hua',
  artist: 'Arijit Singh',
  audioUrl: 'https://cdn.example/audio.mp4',
  source: 'saavn_cdn'
};

test('parses Spotify playlist URLs, URIs, and IDs while rejecting unrelated URLs', () => {
  const playlistId = '37i9dQZF1DXcBWIGoYBM5M';
  assert.equal(parseSpotifyPlaylistId(`https://open.spotify.com/playlist/${playlistId}?si=abc`), playlistId);
  assert.equal(parseSpotifyPlaylistId(`https://open.spotify.com/intl-in/playlist/${playlistId}`), playlistId);
  assert.equal(parseSpotifyPlaylistId(`spotify:playlist:${playlistId}`), playlistId);
  assert.equal(parseSpotifyPlaylistId(playlistId), playlistId);
  assert.equal(parseSpotifyPlaylistId('https://example.com/playlist/' + playlistId), '');
  assert.equal(parseSpotifyPlaylistId(''), '');
});

test('formats missing and valid track durations safely', () => {
  assert.equal(formatSpotifyDuration(0), '0:00');
  assert.equal(formatSpotifyDuration(185000), '3:05');
});

test('follows every Spotify playlist page and preserves order', async () => {
  const playlistId = '37i9dQZF1DXcBWIGoYBM5M';
  const calls = [];
  const result = await collectSpotifyPlaylistPages(playlistId, async (url) => {
    calls.push(url);
    const offset = Number(new URL(url).searchParams.get('offset') || 0);
    if (offset === 0) {
      return {
        total: 3,
        items: [{ id: 'one' }, { id: 'two' }],
        next: `https://api.spotify.com/v1/playlists/${playlistId}/items?offset=2&limit=50`
      };
    }
    return { total: 3, items: [{ id: 'three' }], next: null };
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(result.items.map(item => item.id), ['one', 'two', 'three']);
  assert.equal(result.total, 3);
});

test('rejects an incomplete or cross-origin Spotify pagination response', async () => {
  const playlistId = '37i9dQZF1DXcBWIGoYBM5M';
  await assert.rejects(
    collectSpotifyPlaylistPages(playlistId, async () => ({ total: 2, items: [{ id: 'one' }], next: null })),
    /only 1 of 2/
  );
  await assert.rejects(
    collectSpotifyPlaylistPages(playlistId, async () => ({ total: 1, items: [], next: 'https://example.com/items' })),
    /invalid playlist page link/
  );
});

test('matches a Spotify track only to a playable JioSaavn title and artist match', () => {
  assert.equal(findSpotifySaavnMatch({ title: 'Gehra Hua', artists: ['Arijit Singh'] }, [saavnTrack]), saavnTrack);
  assert.equal(findSpotifySaavnMatch({ title: 'Gehra Hua', artists: ['Unrelated Artist'] }, [saavnTrack]), null);
  assert.equal(findSpotifySaavnMatch({ title: 'Gehra Hua', artists: ['Arijit Singh'] }, [{ ...saavnTrack, audioUrl: '' }]), null);
  assert.equal(findSpotifySaavnMatch({ title: 'Gehra Hua', artists: ['Arijit Singh'] }, [{ ...saavnTrack, source: 'curated' }]), null);
});

test('keeps matched, unmatched, and unavailable Spotify entries in their original metadata form', () => {
  const matched = createImportedSpotifyTrack({
    id: 'spotify-123', title: 'Gehra Hua', artists: ['Arijit Singh'], album: 'Film Album', durationMs: 185000
  }, saavnTrack, 0, 'cover.jpg');
  const unmatched = createImportedSpotifyTrack({
    id: 'spotify-456', title: 'Unknown Track', artists: ['Unknown Artist'], album: 'Album'
  }, null, 1);
  const unavailable = createImportedSpotifyTrack({ id: '', title: '', artists: [], unavailable: true }, null, 2, 'playlist.jpg');

  assert.equal(matched.id, 'spotify:spotify-123:1');
  assert.equal(matched.catalogTrackId, saavnTrack.id);
  assert.equal(matched.matchStatus, 'matched');
  assert.equal(matched.isPlayable, true);
  assert.equal(matched.album, 'Film Album');
  assert.equal(matched.audioUrl, saavnTrack.audioUrl);
  assert.equal(unmatched.matchStatus, 'unmatched');
  assert.equal(unmatched.isPlayable, false);
  assert.equal(unmatched.id, 'spotify:spotify-456:2');
  assert.equal(unavailable.matchStatus, 'unavailable');
  assert.equal(unavailable.thumbnail, 'playlist.jpg');
  assert.deepEqual(countSpotifyImportResults([matched, unmatched, unavailable]), {
    matched: 1,
    unmatched: 1,
    unavailable: 1
  });
});

test('assigns separate playlist-item identities while retaining the matched catalog ID', () => {
  const spotifyTrack = {
    id: 'spotify-repeat', title: 'Gehra Hua', artists: ['Arijit Singh'], album: 'Album', durationMs: 120000
  };
  const first = createImportedSpotifyTrack(spotifyTrack, saavnTrack, 0);
  const second = createImportedSpotifyTrack(spotifyTrack, saavnTrack, 1);
  assert.notEqual(first.id, second.id);
  assert.equal(first.catalogTrackId, saavnTrack.id);
  assert.equal(second.catalogTrackId, saavnTrack.id);
});

test('marks local files and episodes unavailable while preserving their available metadata', () => {
  const local = spotifyPlaylistItemToTrack({
    is_local: true,
    item: { type: 'track', name: 'Local Song', id: null, artists: [{ name: 'Artist' }], duration_ms: 90000 }
  }, 0);
  const episode = spotifyPlaylistItemToTrack({
    item: { type: 'episode', id: 'episode-1', name: 'Interview', show: { name: 'Show', images: [{ url: 'cover.jpg' }] } }
  }, 1);

  assert.equal(local.unavailable, true);
  assert.equal(local.title, 'Local Song');
  assert.equal(episode.unavailable, true);
  assert.equal(episode.album, 'Show');
  assert.equal(episode.artwork, 'cover.jpg');
  assert.equal(episode.spotifyUrl, 'https://open.spotify.com/episode/episode-1');
});
