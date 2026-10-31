import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getHomeRecommendations, 
  rotateHomeSession, 
  getHomeSessionSeed, 
  getHomeRotationIndex,
  buildPopularArtistsFeed,
  deduplicateTracks,
  clearHomeFeedCache
} from '../src/services/homeRecommendations.js';

test('deduplicateTracks removes duplicates by id and normalized title', () => {
  const tracks = [
    { id: '1', title: 'Song One', audioUrl: 'https://cdn/1.mp4' },
    { id: '2', title: 'Song Two', audioUrl: 'https://cdn/2.mp4' },
    { id: '1', title: 'Song One (Duplicate ID)', audioUrl: 'https://cdn/1.mp4' },
    { id: '3', title: 'Song One', audioUrl: 'https://cdn/3.mp4' }, // Duplicate title
    { id: '4', title: 'Song Four' }, // Missing audioUrl
    { id: '5', title: '', audioUrl: 'https://cdn/5.mp4' } // Missing title
  ];
  const excluded = [{ id: '99', title: 'Song Two' }];

  const result = deduplicateTracks(tracks, excluded);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
});

test('buildPopularArtistsFeed prioritizes user preferred artists and history', () => {
  const userPreferences = { artists: ['Arijit Singh', 'Taylor Swift'] };
  const likedSongs = [{ artist: 'Diljit Dosanjh' }];

  const artists = buildPopularArtistsFeed({
    userPreferences,
    likedSongs,
    recentlyPlayed: [],
    rotationIndex: 0
  });

  assert.ok(artists.length >= 5);
  // Preferred artists must come first
  assert.equal(artists[0].name, 'Arijit Singh');
  assert.equal(artists[1].name, 'Taylor Swift');
  // Followed by liked artists
  assert.equal(artists[2].name, 'Diljit Dosanjh');
});

test('buildPopularArtistsFeed generates custom entry for unlisted favorite artist', () => {
  const userPreferences = { artists: ['Rare Indie Artist'] };
  const artists = buildPopularArtistsFeed({
    userPreferences,
    rotationIndex: 0
  });

  const custom = artists.find(a => a.name === 'Rare Indie Artist');
  assert.ok(custom, 'Custom artist was included');
  assert.equal(custom.monthlyListeners, 'Favorite Artist');
});

test('rotateHomeSession generates new session seed and increments rotation index', () => {
  const initialIndex = getHomeRotationIndex();
  const { sessionSeed, rotationIndex } = rotateHomeSession();

  assert.ok(sessionSeed.startsWith('session_'));
  assert.equal(rotationIndex, (initialIndex + 1) % 12);
  assert.equal(getHomeSessionSeed(), sessionSeed);
  assert.equal(getHomeRotationIndex(), rotationIndex);
});

test('getHomeRecommendations caches results per user and session seed', async () => {
  clearHomeFeedCache('user-test-1');
  const sessionSeed = 'test_session_' + Date.now();

  const firstCall = await getHomeRecommendations({
    userId: 'user-test-1',
    userPreferences: { genres: ['bollywood'], artists: ['Arijit Singh'] },
    forceRefresh: false,
    sessionSeed
  });

  assert.ok(firstCall);
  assert.ok(Array.isArray(firstCall.trendingTracks));
  assert.ok(Array.isArray(firstCall.newReleases));
  assert.ok(Array.isArray(firstCall.recommendedTracks));
  assert.equal(firstCall.source, 'network');

  // Second call with same user and session seed should hit cache immediately
  const secondCall = await getHomeRecommendations({
    userId: 'user-test-1',
    userPreferences: { genres: ['bollywood'], artists: ['Arijit Singh'] },
    forceRefresh: false,
    sessionSeed
  });

  assert.equal(secondCall.source, 'cache');
  assert.equal(secondCall.trendingTracks.length, firstCall.trendingTracks.length);
  assert.equal(secondCall.sessionSeed, sessionSeed);
});

test('multi-user isolation: different users maintain separate caches and personalized feeds', async () => {
  clearHomeFeedCache('alice-user');
  clearHomeFeedCache('bob-user');
  const sessionSeed = 'iso_session_' + Date.now();

  // Alice likes Bollywood & Arijit Singh
  const aliceFeed = await getHomeRecommendations({
    userId: 'alice-user',
    userPreferences: { genres: ['bollywood'], artists: ['Arijit Singh'] },
    likedSongs: [{ id: 'al-1', title: 'Tum Hi Ho', artist: 'Arijit Singh', audioUrl: 'https://cdn/al.mp4' }],
    forceRefresh: true,
    sessionSeed
  });

  // Bob likes Electronic & The Weeknd
  const bobFeed = await getHomeRecommendations({
    userId: 'bob-user',
    userPreferences: { genres: ['electronic'], artists: ['The Weeknd'] },
    likedSongs: [{ id: 'bob-1', title: 'Starboy', artist: 'The Weeknd', audioUrl: 'https://cdn/bob.mp4' }],
    forceRefresh: true,
    sessionSeed
  });

  assert.ok(aliceFeed);
  assert.ok(bobFeed);

  // Popular artists for Alice should lead with Arijit Singh
  assert.equal(aliceFeed.popularArtists[0].name, 'Arijit Singh');
  // Popular artists for Bob should lead with The Weeknd
  assert.equal(bobFeed.popularArtists[0].name, 'The Weeknd');

  // Verify all tracks have valid stream audioUrl
  for (const t of [...aliceFeed.trendingTracks, ...aliceFeed.newReleases, ...aliceFeed.recommendedTracks]) {
    assert.ok(t.id, 'Track has id');
    assert.ok(t.title, 'Track has title');
    assert.ok(t.audioUrl, 'Track has direct audio stream');
  }
});
