import test from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../src/services/storage.js';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

test('autoplay preferences, skips, liked songs, playlists, and listening history stay scoped per account', () => {
  const aliceTrack = { id: 'alice-song', title: 'Alice Song', artist: 'Alice Artist' };
  const bobTrack = { id: 'bob-song', title: 'Bob Song', artist: 'Bob Artist' };

  storage.saveRecentlyPlayed([aliceTrack], 'alice');
  storage.saveRecentlyPlayed([bobTrack], 'bob');
  storage.saveLikedSongs([aliceTrack], 'alice');
  storage.savePlaylists([{ id: 'alice-playlist', tracks: [aliceTrack] }], 'alice');
  storage.addSkippedTrack(aliceTrack, 'alice');
  storage.saveAutoplayEnabled(false, 'alice');

  assert.deepEqual(storage.getRecentlyPlayed('alice'), [aliceTrack]);
  assert.deepEqual(storage.getRecentlyPlayed('bob'), [bobTrack]);
  assert.deepEqual(storage.getRecentlyPlayed('guest'), []);
  assert.deepEqual(storage.getLikedSongs('bob'), []);
  assert.deepEqual(storage.getPlaylists('bob'), []);
  assert.deepEqual(storage.getSkippedTracks('bob'), []);
  assert.equal(storage.getAutoplayEnabled('alice'), false);
  assert.equal(storage.getAutoplayEnabled('bob'), true);
});

test('signed-in preference reads do not fall back to guest preferences', () => {
  storage.saveUserPreferences('guest', { genres: ['lo-fi'], artists: [] });
  storage.saveUserPreferences('alice', { genres: ['rap'], artists: [] });

  assert.deepEqual(storage.getUserPreferences('alice', false), { genres: ['rap'], artists: [] });
  assert.equal(storage.getUserPreferences('bob', false), null);
  assert.deepEqual(storage.getUserPreferences('guest'), { genres: ['lo-fi'], artists: [] });
});
