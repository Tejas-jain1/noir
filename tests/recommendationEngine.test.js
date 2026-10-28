import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAutoplaySearchTiers,
  classifyTrackVibe,
  createRecommendationContext,
  getRealPlayableSaavnTracks,
  getRecommendationVibeLabel,
  rankRecommendationCandidates,
  scoreRecommendationCandidate,
  selectRecommendationForTier
} from '../src/services/recommendationEngine.js';

test('track classification prefers real genre, mood, energy, and language metadata', () => {
  const vibe = classifyTrackVibe({
    title: 'A title without mood words',
    genre: 'Hip-Hop / Rap',
    mood: 'Sad',
    energy: 0.2,
    language: 'Hindi'
  });

  assert.deepEqual(vibe.genreIds, ['hip-hop']);
  assert.equal(vibe.genres[0].source, 'metadata');
  assert.deepEqual(vibe.moodIds, ['sad']);
  assert.equal(vibe.moods[0].source, 'metadata');
  assert.equal(vibe.energy.level, 'low');
  assert.equal(vibe.energy.source, 'metadata');
  assert.equal(vibe.language, 'hindi');
});

test('missing mood metadata stays unknown unless cautious title or query clues exist', () => {
  const unknown = createRecommendationContext({ title: 'A title without mood words', artist: 'Artist' });
  const inferred = createRecommendationContext({ title: 'Tanha Raat', artist: 'Artist' });
  const searched = createRecommendationContext({ title: 'Track Name', artist: 'Artist' }, 'sad rap song');

  assert.deepEqual(unknown.moodIds, []);
  assert.equal(inferred.moods[0].id, 'sad');
  assert.equal(inferred.moods[0].source, 'inferred');
  assert.deepEqual(searched.genreIds, ['hip-hop']);
  assert.equal(searched.genres[0].source, 'query');
  assert.equal(searched.moods[0].source, 'query');
  assert.match(getRecommendationVibeLabel(inferred), /inferred/);
});

test('genre and mood matches score above unrelated trending-style tracks', () => {
  const context = createRecommendationContext({
    id: 'seed', title: 'Seed Track', artist: 'Seed Artist', genre: 'Rap', mood: 'Sad', energy: 'low', language: 'Hindi'
  });
  const matching = {
    id: 'match', title: 'Another Track', artist: 'Other Artist', genre: 'Hip-Hop', mood: 'Sad', energy: 'low', language: 'Hindi', audioUrl: 'https://audio.test/match.mp4'
  };
  const unrelated = {
    id: 'unrelated', title: 'Love Party', artist: 'Other Artist', genre: 'Pop', mood: 'Romantic', energy: 'high', language: 'Hindi', audioUrl: 'https://audio.test/unrelated.mp4'
  };

  const matchingScore = scoreRecommendationCandidate(matching, context).score;
  const unrelatedScore = scoreRecommendationCandidate(unrelated, context).score;
  assert.ok(matchingScore > unrelatedScore);

  const unrelatedRanked = rankRecommendationCandidates([unrelated], context);
  assert.equal(selectRecommendationForTier(unrelatedRanked, 'broader', context), null);
});

test('a rap seed rejects unrelated romantic pop even when the candidate shares its mood clue', () => {
  const context = createRecommendationContext({
    id: 'seed', title: 'Seed Track', artist: 'Seed Artist', genre: 'Rap', mood: 'Sad'
  });
  const unrelated = {
    id: 'pop-love', title: 'Love Song', artist: 'Other Artist', genre: 'Romantic Pop', mood: 'Romantic',
    audioUrl: 'https://audio.test/pop-love.mp4'
  };
  const ranked = rankRecommendationCandidates([unrelated], context);

  assert.equal(ranked[0].genreConflict, true);
  assert.equal(ranked[0].moodConflict, true);
  for (const tier of ['same-vibe', 'related-genres', 'artist-style', 'broader']) {
    assert.equal(selectRecommendationForTier(ranked, tier, context), null);
  }
});

test('related genres are considered before artist-style and broad fallback searches', () => {
  const context = createRecommendationContext({ id: 'seed', title: 'Seed', genre: 'Rap', artist: 'Seed Artist' }, 'rap song');
  const tiers = buildAutoplaySearchTiers(context, { userPreferences: { artists: ['Favorite Artist'] } });

  assert.deepEqual(tiers.map(tier => tier.id), ['same-vibe', 'related-genres', 'artist-style', 'broader']);
  assert.ok(tiers[0].queries.some(query => query.genreIds.includes('hip-hop')));
  assert.ok(tiers[1].queries.length > 0);

  const related = { id: 'rnb', title: 'Soul Song', artist: 'Soul Artist', genre: 'R&B', audioUrl: 'https://audio.test/soul.mp4' };
  const relatedRanked = rankRecommendationCandidates(tiers[1].queries.map(query => ({ track: related, retrievedFor: query })), context);
  assert.ok(selectRecommendationForTier(relatedRanked, 'related-genres', context));
});

test('search-query evidence can recover a match when the provider omits genre metadata', () => {
  const context = createRecommendationContext({ id: 'seed', title: 'Seed', artist: 'Artist' }, 'rap song');
  const candidate = { id: 'api-result', title: 'Different Track', artist: 'Another Artist', audioUrl: 'https://audio.test/track.mp4' };
  const ranked = rankRecommendationCandidates([{
    track: candidate,
    retrievedFor: { genreIds: ['hip-hop'], moodIds: [] }
  }], context);

  assert.equal(ranked[0].hasVibeMatch, true);
  assert.equal(selectRecommendationForTier(ranked, 'same-vibe', context).track, candidate);
});

test('user genre preferences can anchor autoplay when the seed has no usable genre metadata', () => {
  const context = createRecommendationContext({ id: 'seed', title: 'Unknown Track' });
  const tier = buildAutoplaySearchTiers(context, { userPreferences: { genres: ['Hip-hop'] } })
    .find(item => item.id === 'artist-style');
  const candidate = { id: 'rap-result', title: 'A Rap Track', audioUrl: 'https://audio.test/rap.mp4' };
  const ranked = rankRecommendationCandidates([{
    track: candidate,
    retrievedFor: tier.queries[0]
  }], context);

  assert.equal(ranked[0].queryGenreMatch, true);
  assert.equal(selectRecommendationForTier(ranked, 'artist-style', context).track, candidate);
});

test('duplicate normalized titles, queue tracks, recent tracks, and skipped tracks are excluded', () => {
  const context = createRecommendationContext({ id: 'seed', title: 'Seed', genre: 'Rap' });
  const tracks = [
    { id: 'remix', title: 'Khat - Remix', genre: 'Rap', audioUrl: 'https://audio.test/remix.mp4' },
    { id: 'same-title', title: 'KHAT (Original Version)', genre: 'Rap', audioUrl: 'https://audio.test/original.mp4' },
    { id: 'queued', title: 'Queued Track', genre: 'Rap', audioUrl: 'https://audio.test/queued.mp4' },
    { id: 'recent', title: 'Recent Track', genre: 'Rap', audioUrl: 'https://audio.test/recent.mp4' },
    { id: 'skipped', title: 'Skipped Track', genre: 'Rap', audioUrl: 'https://audio.test/skipped.mp4' },
    { id: 'valid', title: 'New Track', genre: 'Rap', audioUrl: 'https://audio.test/new.mp4' }
  ];
  const ranked = rankRecommendationCandidates(tracks, context, {
    excludedTracks: [{ id: 'queued', title: 'Queued Track' }, { id: 'recent', title: 'Recent Track' }],
    skippedTracks: [{ id: 'skipped', title: 'Skipped Track' }]
  });

  assert.deepEqual(ranked.map(result => result.track.id), ['remix', 'valid']);
});

test('only real Saavn API results with stream URLs enter radio search candidates', () => {
  assert.deepEqual(getRealPlayableSaavnTracks({
    source: 'curated', results: [{ id: 'mock', title: 'Mock', audioUrl: 'https://audio.test/mock.mp4' }]
  }), []);
  assert.deepEqual(getRealPlayableSaavnTracks({
    source: 'saavn_cdn', results: [{ id: 'no-stream', title: 'No stream' }]
  }), []);
  assert.equal(getRealPlayableSaavnTracks({
    source: 'saavn_cdn', results: [{ id: 'real', title: 'Real Track', audioUrl: 'https://audio.test/real.mp4' }]
  })[0].id, 'real');
});

test('empty recommendations and API-failure-shaped results safely produce no autoplay selection', () => {
  const context = createRecommendationContext({ id: 'seed', title: 'Seed', genre: 'Rap' });
  assert.equal(selectRecommendationForTier([], 'same-vibe', context), null);
  assert.deepEqual(getRealPlayableSaavnTracks(null), []);
  assert.deepEqual(getRealPlayableSaavnTracks({ source: 'saavn_cdn', results: null }), []);
});
