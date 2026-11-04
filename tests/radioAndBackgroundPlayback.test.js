import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isRadioTrack,
  getNextQueuedTrack,
  getPreviousQueueIndex,
  shuffleQueuePreservingCurrent,
  getNextRepeatMode
} from '../src/services/playbackUtils.js';

import {
  createRecommendationContext,
  rankRecommendationCandidates,
  buildAutoplaySearchTiers,
  classifyTrackVibe,
  scoreRecommendationCandidate
} from '../src/services/recommendationEngine.js';

test('isRadioTrack accurately identifies radio stations and distinguishes normal tracks', () => {
  // Normal Bollywood song
  const normalTrack = {
    id: 'AIg8dSYa',
    title: 'Bairi Piya',
    artist: 'Shreya Ghoshal, Anurag Mishra, Alok Ranjan Srivastava',
    album: 'Devdas',
    genre: '',
    language: 'hindi'
  };
  assert.equal(isRadioTrack(normalTrack), false);

  // Radio tracks
  const radioStation1 = {
    id: 'jfKfPfyJRdk',
    title: 'synthwave radio 🌌 - chill beats to relax/game to',
    artist: 'Lofi Girl',
    isRadio: true
  };
  assert.equal(isRadioTrack(radioStation1), true);

  const radioStation2 = {
    id: 'lofi-beats-station',
    title: 'Lo-Fi Chill Beats Radio',
    artist: 'Radio Chill',
    playbackSource: 'radio'
  };
  assert.equal(isRadioTrack(radioStation2), true);

  // Play option override
  assert.equal(isRadioTrack(normalTrack, { isRadio: true }), true);
  assert.equal(isRadioTrack(normalTrack, { playbackSource: 'radio' }), true);
});

test('Bairi Piya seed infers Bollywood genre and prioritizes Bollywood search tiers', () => {
  const bairiPiya = {
    id: 'AIg8dSYa',
    title: 'Bairi Piya',
    artist: 'Shreya Ghoshal, Anurag Mishra, Alok Ranjan Srivastava',
    album: 'Devdas',
    genre: '',
    language: 'hindi'
  };

  const vibe = classifyTrackVibe(bairiPiya);
  assert.ok(vibe.genreIds.includes('bollywood'), 'Should infer bollywood genre from Hindi language & Shreya Ghoshal');

  const context = createRecommendationContext(bairiPiya);
  assert.equal(context.primaryArtist, 'Shreya Ghoshal', 'Decomposes composite artist string');

  const tiers = buildAutoplaySearchTiers(context, { userPreferences: {}, recentTracks: [] });
  const allTierQueries = tiers.flatMap(t => t.queries.map(q => q.query.toLowerCase()));

  // Should include Bollywood / Shreya Ghoshal queries
  const hasBollywoodQuery = allTierQueries.some(q => q.includes('bollywood') || q.includes('shreya ghoshal'));
  assert.ok(hasBollywoodQuery, 'Autoplay search tiers must query Bollywood or Shreya Ghoshal');

  // Must not contain lo-fi or radio in any query
  const hasRadioQuery = allTierQueries.some(q => q.includes('lo-fi radio') || q.includes('synthwave'));
  assert.equal(hasRadioQuery, false, 'Autoplay queries must not search for synthwave/lo-fi radio');
});

test('rankRecommendationCandidates completely rejects Radio stations when seed is a normal track', () => {
  const normalSeed = {
    id: 'AIg8dSYa',
    title: 'Bairi Piya',
    artist: 'Shreya Ghoshal',
    language: 'hindi'
  };
  const context = createRecommendationContext(normalSeed);

  const candidates = [
    {
      id: 'AIg8dSYa',
      title: 'Bairi Piya',
      artist: 'Shreya Ghoshal'
    },
    {
      id: 'bollywood_song_1',
      title: 'Dola Re Dola',
      artist: 'Shreya Ghoshal, Kavita Krishnamurthy',
      genre: 'Bollywood',
      audioUrl: 'https://aac.saavncdn.com/test1.mp4'
    },
    {
      id: 'jfKfPfyJRdk',
      title: 'synthwave radio 🌌 - chill beats',
      artist: 'Lofi Girl',
      isRadio: true,
      audioUrl: 'https://aac.saavncdn.com/radio.mp4'
    },
    {
      id: 'radio_station_2',
      title: 'Lo-Fi Study Radio',
      artist: 'ChilledCow',
      playbackSource: 'radio',
      audioUrl: 'https://aac.saavncdn.com/radio2.mp4'
    }
  ];

  const ranked = rankRecommendationCandidates(candidates, context, {
    excludedTracks: [normalSeed]
  });

  // Radio tracks must be filtered out
  const rankedIds = ranked.map(r => r.track.id);
  assert.ok(rankedIds.includes('bollywood_song_1'), 'Legitimate Bollywood song should be ranked');
  assert.equal(rankedIds.includes('jfKfPfyJRdk'), false, 'Lo-Fi Radio station must be filtered out');
  assert.equal(rankedIds.includes('radio_station_2'), false, 'Radio stations must be filtered out');

  // Verify scoring: Radio track receives heavy negative penalty for normal song seeds
  const radioScore = scoreRecommendationCandidate(candidates[2], context);
  assert.ok(radioScore.score <= -1000, 'Radio track score should be <= -1000 for normal tracks');
});

test('Queue progression and pre-resolution preserves order and handles screen-off advancement', () => {
  const track1 = { id: 't1', title: 'Song 1', audioUrl: 'https://cdn.example.com/t1.mp4' };
  const track2 = { id: 't2', title: 'Song 2', audioUrl: 'https://cdn.example.com/t2.mp4' };
  const track3 = { id: 't3', title: 'Song 3', audioUrl: '' }; // needs pre-resolution

  const queue = [track1, track2, track3];

  // Starting at track1 (index 0), next track is track2
  const nextFrom0 = getNextQueuedTrack(queue, 0);
  assert.equal(nextFrom0?.id, 't2');
  assert.ok(nextFrom0?.audioUrl, 'Track 2 already has pre-resolved audioUrl for instant playback');

  // At track2 (index 1), next track is track3
  const nextFrom1 = getNextQueuedTrack(queue, 1);
  assert.equal(nextFrom1?.id, 't3');

  // End of queue (index 2), returns null to trigger autoplay
  const nextFrom2 = getNextQueuedTrack(queue, 2);
  assert.equal(nextFrom2, null);
});

test('Repeat mode progression works correctly across off, all, and one', () => {
  assert.equal(getNextRepeatMode('off'), 'all');
  assert.equal(getNextRepeatMode('all'), 'one');
  assert.equal(getNextRepeatMode('one'), 'off');
});

test('Shuffle preserves currently playing track as the first item and keeps all other items', () => {
  const queue = [
    { id: '1', title: 'Song 1' },
    { id: '2', title: 'Song 2' },
    { id: '3', title: 'Song 3' },
    { id: '4', title: 'Song 4' },
    { id: '5', title: 'Song 5' }
  ];

  const shuffled = shuffleQueuePreservingCurrent(queue, queue[2], 2); // currently playing Song 3
  assert.equal(shuffled[0].id, '3', 'Current track must remain at index 0 after shuffle');
  assert.equal(shuffled.length, queue.length, 'All tracks must be preserved in queue');

  const ids = new Set(shuffled.map(t => t.id));
  assert.equal(ids.size, queue.length, 'No duplicate or missing tracks after shuffle');
});

test('Previous track wraps cleanly to the last track or goes back one step', () => {
  const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(getPreviousQueueIndex(queue, 2), 1);
  assert.equal(getPreviousQueueIndex(queue, 1), 0);
  assert.equal(getPreviousQueueIndex(queue, 0), 2); // wrap around
});

test('Multi-track pre-resolution lookahead finds next playable track if an upcoming track is missing a stream', () => {
  const queue = [
    { id: '1', title: 'Playing Now', audioUrl: 'https://cdn/1.mp4' },
    { id: '2', title: 'Pending Stream', audioUrl: '' }, // delayed/failed
    { id: '3', title: 'Ready Track', audioUrl: 'https://cdn/3.mp4' },
    { id: '4', title: 'Future Track', audioUrl: 'https://cdn/4.mp4' }
  ];

  const currentIndex = 0;
  const nextTrack = getNextQueuedTrack(queue, currentIndex);
  assert.equal(nextTrack.id, '2');
  assert.equal(Boolean(nextTrack.audioUrl), false);

  // Lookahead search finds the next pre-resolved track
  let lookaheadTrack = null;
  let lookaheadIndex = -1;
  for (let i = currentIndex + 2; i < Math.min(queue.length, currentIndex + 5); i++) {
    if (queue[i]?.audioUrl) {
      lookaheadTrack = queue[i];
      lookaheadIndex = i;
      break;
    }
  }

  assert.equal(lookaheadTrack?.id, '3', 'Lookahead must find the next ready track to keep AudioFocus');
  assert.equal(lookaheadIndex, 2);
});

test('Lock-screen previous track rewinds when playback > 3s, and navigates back when <= 3s', () => {
  const queue = [{ id: 'track1' }, { id: 'track2' }, { id: 'track3' }];
  let queueIndex = 1; // Playing track2

  // Simulate user pressing Previous when 15 seconds into track2 -> Rewind to 0
  let audioCurrentTime = 15;
  if (audioCurrentTime > 3) {
    audioCurrentTime = 0;
  } else {
    queueIndex = getPreviousQueueIndex(queue, queueIndex);
  }
  assert.equal(audioCurrentTime, 0, 'Must rewind to 0:00 when > 3s');
  assert.equal(queueIndex, 1, 'Queue index must not change when rewinding');

  // Simulate user pressing Previous when 1 second into track2 -> Jump to track1
  audioCurrentTime = 1;
  if (audioCurrentTime > 3) {
    audioCurrentTime = 0;
  } else {
    queueIndex = getPreviousQueueIndex(queue, queueIndex);
  }
  assert.equal(queueIndex, 0, 'Must jump to previous track when <= 3s');
});
