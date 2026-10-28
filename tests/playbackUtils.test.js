import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendQueueTrack,
  buildTrackSearchQuery,
  createSingleTrackQueue,
  getNextQueuedTrack,
  getNextRepeatMode,
  getPreviousQueueIndex,
  normalizeTrackTitle,
  pickAutoplayCandidate,
  searchForAutoplayCandidate,
  shuffleQueuePreservingCurrent
} from '../src/services/playbackUtils.js';

test('search playback starts with only the selected result', () => {
  const selected = { id: 'selected', title: 'Khat' };
  const otherSearchVersion = { id: 'version', title: 'Khat' };

  assert.deepEqual(createSingleTrackQueue(selected), [selected]);
  assert.notDeepEqual(createSingleTrackQueue(selected), [selected, otherSearchVersion]);
  assert.deepEqual(createSingleTrackQueue(null), []);
});

test('stream lookup builds a useful query with incomplete metadata', () => {
  assert.equal(buildTrackSearchQuery({ title: 'Track Name', artist: 'Artist Name' }), 'Track Name Artist Name');
  assert.equal(buildTrackSearchQuery({ title: 'Track Name' }), 'Track Name');
  assert.equal(buildTrackSearchQuery({ artist: 'Artist Name' }), '');
  assert.equal(buildTrackSearchQuery(null), '');
});

test('playlist and album queues return the next item in their original order', () => {
  const first = { id: 'first' };
  const second = { id: 'second' };
  const third = { id: 'third' };
  const queue = [first, second, third];

  assert.equal(getNextQueuedTrack(queue, 0), second);
  assert.equal(getNextQueuedTrack(queue, 1), third);
  assert.equal(getNextQueuedTrack(queue, 2), null);
  assert.equal(getNextQueuedTrack([], 0), null);
  assert.deepEqual(appendQueueTrack([first], second), [first, second]);
  assert.equal(getNextQueuedTrack(appendQueueTrack([first], second), 0), second);
});

test('previous navigation moves backward and wraps to the last queued track', () => {
  const queue = [{ id: 'first' }, { id: 'second' }, { id: 'third' }];
  assert.equal(getPreviousQueueIndex(queue, 2), 1);
  assert.equal(getPreviousQueueIndex(queue, 0), 2);
  assert.equal(getPreviousQueueIndex([], 0), -1);
});

test('shuffle keeps the current track first and retains every queued track once', () => {
  const queue = [{ id: 'first' }, { id: 'current' }, { id: 'third' }, { id: 'fourth' }];
  const current = queue[1];
  const shuffled = shuffleQueuePreservingCurrent(queue, current, 1, () => 0.5);

  assert.equal(shuffled[0], current);
  assert.deepEqual(new Set(shuffled.map(track => track.id)), new Set(queue.map(track => track.id)));
  assert.equal(shuffled.length, queue.length);
});

test('repeat mode cycles through off, all, one, and off', () => {
  assert.equal(getNextRepeatMode('off'), 'all');
  assert.equal(getNextRepeatMode('all'), 'one');
  assert.equal(getNextRepeatMode('one'), 'off');
});

test('normalized titles ignore case, accents, punctuation, and version labels in brackets', () => {
  assert.equal(normalizeTrackTitle('Khát! (Lofi Version)'), 'khat');
  assert.equal(normalizeTrackTitle('Khat [Remastered]'), 'khat');
});

test('autoplay filters the current title, queue tracks, recent tracks, and missing titles', () => {
  const current = { id: 'current', title: 'Khat' };
  const alternatives = [
    { id: 'same-title', title: 'KHÁT (Original Version)' },
    { id: 'queued', title: 'Already in queue' },
    { id: 'recent', title: 'Recently played' },
    { id: 'missing-title' },
    { id: 'valid', title: 'A different song' }
  ];

  const picked = pickAutoplayCandidate(alternatives, {
    currentTrack: current,
    queue: [{ id: 'current' }, { id: 'queued' }],
    recentlyPlayed: [{ id: 'recent' }],
    random: () => 0
  });

  assert.equal(picked.id, 'valid');
});

test('autoplay safely returns no candidate for empty or invalid recommendation lists', () => {
  assert.equal(pickAutoplayCandidate([], { currentTrack: { title: 'Khat' } }), null);
  assert.equal(pickAutoplayCandidate(null), null);
  assert.equal(pickAutoplayCandidate([{ id: 'missing-title' }]), null);
  assert.equal(
    pickAutoplayCandidate([{ id: 'same', title: 'Khat [Remix]' }], {
      currentTrack: { id: 'current', title: 'Khat' }
    }),
    null
  );
});

test('a failed recommendation search returns no candidate and reports the error', async () => {
  const error = new Error('network unavailable');
  let reportedError = null;
  const picked = await searchForAutoplayCandidate(
    async () => { throw error; },
    'artist songs',
    { currentTrack: { id: 'current', title: 'Khat' } },
    caught => { reportedError = caught; }
  );

  assert.equal(picked, null);
  assert.equal(reportedError, error);
});

test('a malformed recommendation response is treated as empty', async () => {
  assert.equal(await searchForAutoplayCandidate(async () => null, 'artist songs'), null);
  assert.equal(await searchForAutoplayCandidate(async () => ({}), 'artist songs'), null);
});

test('autoplay selection clamps invalid random values and picks a valid recommendation', () => {
  const tracks = [
    { id: 'first', title: 'First song' },
    { id: 'second', title: 'Second song' }
  ];

  assert.equal(pickAutoplayCandidate(tracks, { random: () => 1 }).id, 'second');
  assert.equal(pickAutoplayCandidate(tracks, { random: () => Number.NaN }).id, 'first');
});
