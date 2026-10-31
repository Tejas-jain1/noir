import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getHomeRecommendations, 
  rotateHomeSession, 
  clearHomeFeedCache 
} from '../src/services/homeRecommendations.js';

test('simulated user accounts receive distinct recommendations based on preferences & history', async () => {
  const sessionSeed = 'e2e_test_' + Date.now();

  // User 1: Punjabi music lover
  const punjabiUserFeed = await getHomeRecommendations({
    userId: 'user-punjabi',
    userPreferences: { genres: ['punjabi'], artists: ['Diljit Dosanjh'] },
    likedSongs: [{ id: 'pj-1', title: 'Lover', artist: 'Diljit Dosanjh', genre: 'punjabi', audioUrl: 'https://cdn/pj1.mp4' }],
    forceRefresh: true,
    sessionSeed
  });

  // User 2: Pop / Alternative lover
  const popUserFeed = await getHomeRecommendations({
    userId: 'user-pop',
    userPreferences: { genres: ['pop'], artists: ['Billie Eilish'] },
    likedSongs: [{ id: 'pop-1', title: 'Bad Guy', artist: 'Billie Eilish', genre: 'pop', audioUrl: 'https://cdn/pop1.mp4' }],
    forceRefresh: true,
    sessionSeed
  });

  // Verify both users received valid, playable tracks
  assert.ok(punjabiUserFeed.recommendedTracks.length > 0, 'Punjabi user got recommendations');
  assert.ok(popUserFeed.recommendedTracks.length > 0, 'Pop user got recommendations');

  // Verify top artist in Popular Artists matches their preferences
  assert.equal(punjabiUserFeed.popularArtists[0].name, 'Diljit Dosanjh');
  assert.equal(popUserFeed.popularArtists[0].name, 'Billie Eilish');

  // Verify distinct recommendations
  const punjabiIds = new Set(punjabiUserFeed.recommendedTracks.map(t => t.id));
  const popIds = new Set(popUserFeed.recommendedTracks.map(t => t.id));
  
  // They should not have identical recommendation sets
  const overlap = [...punjabiIds].filter(id => popIds.has(id));
  assert.ok(overlap.length < punjabiIds.size, 'Personalized feeds are distinct between accounts');
});

test('session rotation generates a new seed and rotates recommendations', async () => {
  clearHomeFeedCache('guest');
  
  // Session 1
  const session1 = await getHomeRecommendations({
    userId: 'guest',
    forceRefresh: true
  });

  // Rotate session (simulate logging in or starting a new session)
  const { sessionSeed: newSeed, rotationIndex: newIndex } = rotateHomeSession();
  
  // Session 2
  const session2 = await getHomeRecommendations({
    userId: 'guest',
    forceRefresh: true,
    sessionSeed: newSeed
  });

  assert.notEqual(session1.sessionSeed, session2.sessionSeed);
  assert.equal(session2.rotationIndex, newIndex);
});
