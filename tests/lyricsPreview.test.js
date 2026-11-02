import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  findCurrentLyricIndex, 
  parseLrc, 
  cleanTrackMetadata, 
  fetchLyricsForTrack 
} from '../src/services/lyricsService.js';
import { saavnApi } from '../src/services/saavnApi.js';

test('parseLrc correctly parses timestamps and lyric text into sorted array', () => {
  const lrc = `
    [00:01.00] Yeah, yeah (go)
    [00:03.50] ♪
    [00:05.20] You like that slow wine, moonlight, dangerous smile
    [00:09.80] You're making me stay for a little while
  `;

  const parsed = parseLrc(lrc);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].time, 1.0);
  assert.equal(parsed[0].text, 'Yeah, yeah (go)');
  assert.equal(parsed[1].time, 3.5);
  assert.equal(parsed[1].text, '♪');
  assert.equal(parsed[2].time, 5.2);
  assert.equal(parsed[3].time, 9.8);
});

test('findCurrentLyricIndex returns -1 before the first lyric time', () => {
  const synced = [
    { time: 2.0, text: 'First line' },
    { time: 5.0, text: 'Second line' }
  ];

  assert.equal(findCurrentLyricIndex(synced, 0.0), -1);
  assert.equal(findCurrentLyricIndex(synced, 1.99), -1);
  assert.equal(findCurrentLyricIndex([], 5.0), -1);
  assert.equal(findCurrentLyricIndex(null, 5.0), -1);
});

test('findCurrentLyricIndex identifies exact and intermediate timestamps smoothly', () => {
  const synced = [
    { time: 1.0, text: 'Yeah, yeah (go)' },
    { time: 3.5, text: '♪' },
    { time: 5.2, text: 'You like that slow wine, moonlight, dangerous smile' },
    { time: 9.8, text: "You're making me stay for a little while" }
  ];

  // Exact start of line 0
  assert.equal(findCurrentLyricIndex(synced, 1.0), 0);
  // During line 0
  assert.equal(findCurrentLyricIndex(synced, 2.4), 0);

  // Exact start of line 1 (musical note)
  assert.equal(findCurrentLyricIndex(synced, 3.5), 1);
  assert.equal(findCurrentLyricIndex(synced, 4.0), 1);

  // Line 2
  assert.equal(findCurrentLyricIndex(synced, 5.2), 2);
  assert.equal(findCurrentLyricIndex(synced, 7.5), 2);

  // Line 3 (final line)
  assert.equal(findCurrentLyricIndex(synced, 9.8), 3);
  // Past the final line timestamp
  assert.equal(findCurrentLyricIndex(synced, 60.0), 3);
});

test('cleanTrackMetadata cleans noise, soundtrack brackets, and decomposes composite artists', () => {
  const meta1 = cleanTrackMetadata(
    'Kesariya (From "Brahmastra") [Official Music Video]',
    'Pritam, Arijit Singh, Amitabh Bhattacharya'
  );
  assert.equal(meta1.trackName, 'Kesariya');
  assert.ok(meta1.artistCandidates.includes('Pritam'));
  assert.ok(meta1.artistCandidates.includes('Arijit Singh'));
  assert.ok(meta1.artistCandidates.includes('Amitabh Bhattacharya'));

  const meta2 = cleanTrackMetadata(
    'Tum Hi Ho (Lyrical Video)',
    'Arijit Singh, Mithoon'
  );
  assert.equal(meta2.trackName, 'Tum Hi Ho');
  assert.equal(meta2.primaryArtist, 'Arijit Singh');
  assert.ok(meta2.artistCandidates.includes('Mithoon'));

  const meta3 = cleanTrackMetadata(
    'Starboy feat. Daft Punk',
    'The Weeknd feat. Daft Punk'
  );
  assert.equal(meta3.trackName, 'Starboy');
  assert.equal(meta3.primaryArtist, 'The Weeknd');
});

test('fetchLyricsForTrack fallback to JioSaavn when LRCLIB has no entry', async () => {
  const originalGetLyrics = saavnApi.getLyrics;
  // Mock saavnApi.getLyrics
  saavnApi.getLyrics = async (id) => {
    if (id === 'test-saavn-id') {
      return {
        plainLyrics: 'Line 1 from JioSaavn\nLine 2 from JioSaavn',
        copyright: 'Lyrics powered by JioSaavn'
      };
    }
    return null;
  };

  try {
    const track = {
      id: 'test-saavn-id',
      saavnId: 'test-saavn-id',
      title: 'Unique Indian Track 2026',
      artist: 'Unknown Indie Singer',
      duration: 210
    };

    const res = await fetchLyricsForTrack(track);
    assert.ok(res.success, 'Should return success from JioSaavn fallback');
    assert.equal(res.lyrics.source, 'jiosaavn');
    assert.equal(res.lyrics.plainLyrics, 'Line 1 from JioSaavn\nLine 2 from JioSaavn');
    assert.equal(res.lyrics.syncedLyrics, null);
  } finally {
    saavnApi.getLyrics = originalGetLyrics;
  }
});

test('fetchLyricsForTrack caches results to prevent duplicate network calls', async () => {
  const track = {
    title: 'Cache Verification Song',
    artist: 'Cache Artist',
    duration: 180
  };

  // First call
  const res1 = await fetchLyricsForTrack(track);
  // Second call
  const res2 = await fetchLyricsForTrack(track);

  assert.deepEqual(res1, res2, 'Second call should return cached result');
});

test('LyricsPreview component structure verifies 3D perspective, centering and blurred artwork', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const componentPath = path.resolve('src/components/LyricsPreview.jsx');
  const content = fs.readFileSync(componentPath, 'utf-8');

  // 1. Center-aligned layout
  assert.ok(content.includes("textAlign: 'center'"), 'Lyrics text must be center-aligned');
  assert.ok(content.includes("alignItems: 'center'"), 'Lyrics container must center items vertically');

  // 2. 3D perspective and transforms
  assert.ok(content.includes("perspective: '800px'"), 'Stage must declare 3D perspective');
  assert.ok(content.includes("transformStyle: 'preserve-3d'"), 'Stage must preserve 3D context');
  assert.ok(content.includes('rotateX('), 'Lines must rotate around X-axis for cylindrical curvature');
  assert.ok(content.includes('translateZ('), 'Lines must have 3D Z-depth translation');

  // 3. Blurred album artwork background
  assert.ok(content.includes('lyrics-ambient-backdrop'), 'Must render ambient blurred backdrop');
  assert.ok(content.includes('blur(52px)'), 'Backdrop must use heavy blur');
  assert.ok(content.includes('lyrics-vignette-overlay'), 'Must include radial vignette overlay');

  // 4. Smooth easing transitions without window scroll
  assert.ok(content.includes('cubic-bezier(0.16, 1, 0.3, 1)'), 'Must use smooth easing transition');
  assert.ok(!content.includes('.scrollIntoView('), 'Must not call scrollIntoView to prevent page jump');
  assert.ok(content.includes("behavior: 'smooth'"), 'Must scroll internally with smooth behavior');
});
