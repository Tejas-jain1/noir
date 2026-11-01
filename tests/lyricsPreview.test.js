import test from 'node:test';
import assert from 'node:assert/strict';
import { findCurrentLyricIndex, parseLrc } from '../src/services/lyricsService.js';

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
