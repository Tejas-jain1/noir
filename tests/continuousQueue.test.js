import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getUpcomingQueueCount,
  shouldReplenishQueue,
  filterEligibleRecommendationTracks,
  appendQueueTrack,
  getNextQueuedTrack,
  isRadioTrack
} from '../src/services/playbackUtils.js';

import {
  createRecommendationContext,
  rankRecommendationCandidates,
  buildAutoplaySearchTiers
} from '../src/services/recommendationEngine.js';

test('getUpcomingQueueCount calculates remaining upcoming tracks correctly', () => {
  const queue = [
    { id: '1', title: 'Song 1' },
    { id: '2', title: 'Song 2' },
    { id: '3', title: 'Song 3' },
    { id: '4', title: 'Song 4' },
    { id: '5', title: 'Song 5' }
  ];

  // At index 0 (Song 1 playing), there are 4 upcoming tracks (2, 3, 4, 5)
  assert.equal(getUpcomingQueueCount(queue, 0), 4);

  // At index 2 (Song 3 playing), there are 2 upcoming tracks (4, 5)
  assert.equal(getUpcomingQueueCount(queue, 2), 2);

  // At index 4 (last track playing), there are 0 upcoming tracks
  assert.equal(getUpcomingQueueCount(queue, 4), 0);

  // Edge cases: empty or single track
  assert.equal(getUpcomingQueueCount([], 0), 0);
  assert.equal(getUpcomingQueueCount([{ id: '1' }], 0), 0);
});

test('shouldReplenishQueue triggers replenishment only when conditions are met', () => {
  const queue = [{ id: '1' }, { id: '2' }, { id: '3' }];

  // Autoplay ON, not radio, upcoming count is 2, target is 5 -> should replenish
  assert.equal(
    shouldReplenishQueue({
      queue,
      queueIndex: 0,
      targetBuffer: 5,
      autoplayEnabled: true,
      isRadio: false
    }),
    true
  );

  // When targetBuffer is 2 and upcoming count is 2 -> buffer full, no replenish
  assert.equal(
    shouldReplenishQueue({
      queue,
      queueIndex: 0,
      targetBuffer: 2,
      autoplayEnabled: true,
      isRadio: false
    }),
    false
  );

  // Autoplay OFF -> MUST NOT replenish
  assert.equal(
    shouldReplenishQueue({
      queue,
      queueIndex: 0,
      targetBuffer: 5,
      autoplayEnabled: false,
      isRadio: false
    }),
    false
  );

  // Radio Mode active -> MUST NOT replenish normal queue
  assert.equal(
    shouldReplenishQueue({
      queue,
      queueIndex: 0,
      targetBuffer: 5,
      autoplayEnabled: true,
      isRadio: true
    }),
    false
  );
});

test('filterEligibleRecommendationTracks filters duplicates, current track, recent, skipped, and radio stations', () => {
  const currentTrack = { id: 'seed_1', saavnId: 's_seed_1', title: 'Bairi Piya', artist: 'Shreya Ghoshal' };
  const queue = [
    currentTrack,
    { id: 'q_2', title: 'Dola Re Dola', artist: 'Kavita Krishnamurthy' },
    { id: 'manual_user_track', title: 'Chalka Chalka Re', artist: 'Richa Sharma' }
  ];
  const recentlyPlayed = [{ id: 'recent_1', title: 'Barso Re', artist: 'Shreya Ghoshal' }];
  const skippedTracks = [{ id: 'skipped_1', title: 'Silsila Ye Chahaat Ka', artist: 'Shreya Ghoshal' }];

  const candidates = [
    // Duplicate of current track (same ID)
    { id: 'seed_1', title: 'Bairi Piya', artist: 'Shreya Ghoshal' },
    // Duplicate of current track (same normalized title with variation)
    { id: 'diff_id', title: 'Bairi Piya (Original Soundtrack)', artist: 'Shreya Ghoshal' },
    // Duplicate of track already in queue
    { id: 'q_2', title: 'Dola Re Dola', artist: 'Kavita Krishnamurthy' },
    // Duplicate of recently played
    { id: 'recent_1', title: 'Barso Re', artist: 'Shreya Ghoshal' },
    // Duplicate of skipped track
    { id: 'skipped_1', title: 'Silsila Ye Chahaat Ka', artist: 'Shreya Ghoshal' },
    // Radio station track (must be rejected!)
    { id: 'jfKfPfyJRdk', title: 'synthwave radio 🌌 - chill beats', isRadio: true },
    // Valid new candidate 1
    { id: 'new_1', title: 'Jaadu Hai Nasha Hai', artist: 'Shreya Ghoshal' },
    // Valid new candidate 2
    { id: 'new_2', title: 'Hamesha Tumko Chaha', artist: 'Kavita Krishnamurthy' },
    // Duplicate inside the candidates batch itself
    { id: 'new_1', title: 'Jaadu Hai Nasha Hai', artist: 'Shreya Ghoshal' }
  ];

  const eligible = filterEligibleRecommendationTracks(candidates, {
    queue,
    currentTrack,
    recentlyPlayed,
    skippedTracks
  });

  const eligibleIds = eligible.map(t => t.id);
  assert.deepEqual(eligibleIds, ['new_1', 'new_2']);
});

test('Continuous queue replenishment simulation across 10 consecutive tracks', () => {
  // Scenario:
  // User starts an album/playlist with initial queue of 7 tracks.
  // Initial upcoming = 6. Target buffer = 6.
  // User adds 1 manual track ("User Favorite") at position 4.
  // As playback progresses through 10 consecutive tracks, every time a track finishes:
  // - Upcoming count drops to 5
  // - Replenishment automatically appends 1 new track to the end
  // - Upcoming count is restored to 6
  // - The user's manually queued track is never displaced or overwritten

  let queue = [
    { id: 't1', title: 'Track 1', audioUrl: 'https://cdn/1.mp4' },
    { id: 't2', title: 'Track 2', audioUrl: 'https://cdn/2.mp4' },
    { id: 't3', title: 'Track 3', audioUrl: 'https://cdn/3.mp4' },
    { id: 'user_fav', title: 'User Favorite Track', audioUrl: 'https://cdn/fav.mp4', isManual: true },
    { id: 't4', title: 'Track 4', audioUrl: 'https://cdn/4.mp4' },
    { id: 't5', title: 'Track 5', audioUrl: 'https://cdn/5.mp4' },
    { id: 't6', title: 'Track 6', audioUrl: 'https://cdn/6.mp4' }
  ];

  let queueIndex = 0;
  const initialUpcoming = getUpcomingQueueCount(queue, queueIndex);
  assert.equal(initialUpcoming, 6);
  const targetBuffer = initialUpcoming; // 6

  // Pool of high quality recommendations that would be returned by JioSaavn
  const recommendationCatalog = [
    { id: 'rec_1', title: 'Recommendation 1', audioUrl: 'https://cdn/rec1.mp4' },
    { id: 'rec_2', title: 'Recommendation 2', audioUrl: 'https://cdn/rec2.mp4' },
    { id: 'rec_3', title: 'Recommendation 3', audioUrl: 'https://cdn/rec3.mp4' },
    { id: 'rec_4', title: 'Recommendation 4', audioUrl: 'https://cdn/rec4.mp4' },
    { id: 'rec_5', title: 'Recommendation 5', audioUrl: 'https://cdn/rec5.mp4' },
    { id: 'rec_6', title: 'Recommendation 6', audioUrl: 'https://cdn/rec6.mp4' },
    { id: 'rec_7', title: 'Recommendation 7', audioUrl: 'https://cdn/rec7.mp4' },
    { id: 'rec_8', title: 'Recommendation 8', audioUrl: 'https://cdn/rec8.mp4' },
    { id: 'rec_9', title: 'Recommendation 9', audioUrl: 'https://cdn/rec9.mp4' },
    { id: 'rec_10', title: 'Recommendation 10', audioUrl: 'https://cdn/rec10.mp4' }
  ];

  let pool = [...recommendationCatalog];
  const playedHistory = [];

  // Simulate 10 consecutive track advancements
  for (let step = 0; step < 10; step++) {
    const currentTrack = queue[queueIndex];
    playedHistory.push(currentTrack.id);

    // Verify next track in queue exists and is pre-resolvable
    const nextQueued = getNextQueuedTrack(queue, queueIndex);
    assert.ok(nextQueued, `Step ${step}: Next track in queue must exist`);

    // Verify manual track is intact at its original relative position
    assert.ok(queue.some(t => t.id === 'user_fav'), `Step ${step}: Manual track must never be dropped`);

    // Advance to next track (simulates onEnded synchronous continuation)
    queueIndex += 1;

    // Check replenishment trigger (Spotify-style continuous queue)
    const upcomingCount = getUpcomingQueueCount(queue, queueIndex);
    if (shouldReplenishQueue({ queue, queueIndex, targetBuffer, autoplayEnabled: true, isRadio: false })) {
      const needed = targetBuffer - upcomingCount;
      const candidates = filterEligibleRecommendationTracks(pool, {
        queue,
        currentTrack: queue[queueIndex],
        recentlyPlayed: playedHistory.map(id => ({ id }))
      });
      const toAdd = candidates.slice(0, needed);
      queue = [...queue, ...toAdd];
      pool = pool.filter(t => !toAdd.some(added => added.id === t.id));
    }

    // After replenishment, the upcoming buffer is maintained at the target buffer count
    const restoredUpcoming = getUpcomingQueueCount(queue, queueIndex);
    assert.equal(
      restoredUpcoming,
      targetBuffer,
      `Step ${step}: Upcoming count must be replenished to ${targetBuffer}`
    );
  }

  // 10 tracks were played consecutively
  assert.equal(playedHistory.length, 10);
  // Manual track was played in its exact sequence
  assert.ok(playedHistory.includes('user_fav'), 'Manually queued track was played');
  assert.equal(playedHistory[3], 'user_fav', 'Manual track was played at its exact position');
  // No radio tracks ever entered
  assert.equal(queue.some(isRadioTrack), false, 'No radio tracks entered the continuous queue');
});

test('Continuous queue stops replenishing when Autoplay is turned OFF', () => {
  const queue = [
    { id: '1', title: 'Song 1' },
    { id: '2', title: 'Song 2' },
    { id: '3', title: 'Song 3' }
  ];

  let queueIndex = 0;
  const targetBuffer = 5;

  // When autoplayEnabled is false, shouldReplenishQueue returns false
  const shouldReplenish = shouldReplenishQueue({
    queue,
    queueIndex,
    targetBuffer,
    autoplayEnabled: false,
    isRadio: false
  });
  assert.equal(shouldReplenish, false);

  // Moving forward with Autoplay OFF does not append new tracks
  queueIndex = 1;
  assert.equal(getUpcomingQueueCount(queue, queueIndex), 1);
  assert.equal(shouldReplenishQueue({ queue, queueIndex, targetBuffer, autoplayEnabled: false, isRadio: false }), false);

  queueIndex = 2;
  assert.equal(getUpcomingQueueCount(queue, queueIndex), 0);
  assert.equal(shouldReplenishQueue({ queue, queueIndex, targetBuffer, autoplayEnabled: false, isRadio: false }), false);
});
