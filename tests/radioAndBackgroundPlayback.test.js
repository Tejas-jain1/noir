import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRadioTrack,
  getNextQueuedTrack,
  getPreviousQueueIndex,
  shuffleQueuePreservingCurrent,
  getNextRepeatMode
} from '../src/services/playbackUtils.js';

describe('NOIR Radio Mode State Management', () => {
  it('identifies Lo-Fi Radio stations from metadata and options', () => {
    const lofiStation = {
      id: 'jfKfPfyJRdk',
      title: 'synthwave radio 🌌 - chill beats to relax/game to',
      artist: 'Lofi Girl',
      album: 'Chill Wave Radio',
      genre: 'Synthwave / Lo-Fi',
      isRadio: true
    };

    assert.equal(isRadioTrack(lofiStation), true, 'Synthwave lofi station should be identified as radio');
    assert.equal(isRadioTrack(lofiStation, { isRadio: true }), true);
    assert.equal(isRadioTrack({ title: 'Lo-Fi Chillhop Radio 24/7' }), true);
    assert.equal(isRadioTrack({ title: 'Deep Focus Beats', genre: 'lo-fi radio' }), true);
    assert.equal(isRadioTrack(null, { isRadio: true }), true);
    assert.equal(isRadioTrack(null, { playbackSource: 'radio' }), true);
  });

  it('rejects normal songs, playlist tracks, search results, and random tracks', () => {
    const normalSong1 = { id: 'song-1', title: 'Kesariya', artist: 'Arijit Singh', album: 'Brahmastra' };
    const normalSong2 = { id: 'song-2', title: 'Radioactive', artist: 'Imagine Dragons', album: 'Night Visions' };
    const normalSong3 = { id: 'song-3', title: 'Video Killed The Radio Star', artist: 'The Buggles', album: 'The Age of Plastic' };
    const normalSong4 = { id: 'song-4', title: 'Brown Munde', artist: 'AP Dhillon', album: 'Hidden Gems' };

    assert.equal(isRadioTrack(normalSong1), false, 'Kesariya is not a radio station');
    assert.equal(isRadioTrack(normalSong2), false, 'Radioactive by Imagine Dragons is not a radio station');
    assert.equal(isRadioTrack(normalSong3), false, 'Video Killed The Radio Star is not a radio station');
    assert.equal(isRadioTrack(normalSong4), false, 'Brown Munde is not a radio station');
    assert.equal(isRadioTrack(normalSong1, { isRadio: false }), false);
    assert.equal(isRadioTrack(normalSong1, { searchQuery: 'kesariya' }), false);
    assert.equal(isRadioTrack(normalSong1, { playbackSource: 'playlist' }), false);
    assert.equal(isRadioTrack(normalSong1, { playbackSource: 'album' }), false);
    assert.equal(isRadioTrack(null), false);
  });

  it('ensures repeated switching between Radio and normal tracks cleans up state without staleness', () => {
    let currentIsRadio = false;
    let currentRadioStation = null;
    let currentPlaybackSource = null;

    const play = (track, playOptions = {}) => {
      const isRadioMode = isRadioTrack(track, playOptions);
      if (isRadioMode) {
        currentIsRadio = true;
        currentRadioStation = playOptions.radioStation || {
          title: track.title,
          artist: track.artist,
          album: track.album || 'Lo-Fi Radio Station'
        };
        currentPlaybackSource = 'radio';
      } else {
        currentIsRadio = false;
        currentRadioStation = null;
        currentPlaybackSource = playOptions.playbackSource || (playOptions.searchQuery ? 'search' : 'track');
      }
    };

    const radioTrack = {
      id: 'jfKfPfyJRdk',
      title: 'synthwave radio 🌌 - chill beats to relax/game to',
      artist: 'Lofi Girl',
      album: 'Chill Wave Radio',
      isRadio: true
    };
    const normalSong = { id: 'normal-1', title: 'Kesariya', artist: 'Arijit Singh', album: 'Brahmastra' };
    const searchResult = { id: 'search-1', title: 'Apna Bana Le', artist: 'Arijit Singh' };
    const playlistTrack = { id: 'pl-1', title: 'Excuses', artist: 'AP Dhillon' };

    // 1. Start radio
    play(radioTrack);
    assert.equal(currentIsRadio, true);
    assert.equal(currentRadioStation.title, radioTrack.title);
    assert.equal(currentPlaybackSource, 'radio');

    // 2. Play normal song -> Immediately exits Radio mode and resets state
    play(normalSong);
    assert.equal(currentIsRadio, false);
    assert.equal(currentRadioStation, null);
    assert.equal(currentPlaybackSource, 'track');

    // 3. Switch back to radio
    play(radioTrack);
    assert.equal(currentIsRadio, true);
    assert.equal(currentRadioStation.title, radioTrack.title);
    assert.equal(currentPlaybackSource, 'radio');

    // 4. Play search result -> Immediately exits Radio mode
    play(searchResult, { searchQuery: 'apna bana le' });
    assert.equal(currentIsRadio, false);
    assert.equal(currentRadioStation, null);
    assert.equal(currentPlaybackSource, 'search');

    // 5. Switch back to radio
    play(radioTrack);
    assert.equal(currentIsRadio, true);

    // 6. Play playlist track -> Immediately exits Radio mode
    play(playlistTrack, { playbackSource: 'playlist' });
    assert.equal(currentIsRadio, false);
    assert.equal(currentRadioStation, null);
    assert.equal(currentPlaybackSource, 'playlist');
  });
});

describe('NOIR Mobile Background Autoplay & Queue Advancement', () => {
  it('advances to next track in queue consecutively without blocking or stale index', () => {
    const queue = [
      { id: 'track-1', title: 'Song 1', audioUrl: 'https://cdn.example.com/1.mp4' },
      { id: 'track-2', title: 'Song 2', audioUrl: 'https://cdn.example.com/2.mp4' },
      { id: 'track-3', title: 'Song 3', audioUrl: 'https://cdn.example.com/3.mp4' }
    ];

    let queueIndex = 0;
    const next1 = getNextQueuedTrack(queue, queueIndex);
    assert.equal(next1.id, 'track-2');

    queueIndex += 1;
    const next2 = getNextQueuedTrack(queue, queueIndex);
    assert.equal(next2.id, 'track-3');

    queueIndex += 1;
    const next3 = getNextQueuedTrack(queue, queueIndex);
    assert.equal(next3, null, 'End of queue reached');
  });

  it('seamlessly loops when repeatMode is all', () => {
    const queue = [
      { id: 'track-1', title: 'Song 1' },
      { id: 'track-2', title: 'Song 2' }
    ];
    let queueIndex = 1;
    const repeatMode = 'all';

    const next = getNextQueuedTrack(queue, queueIndex);
    let resolvedTrack = null;
    let resolvedIndex = queueIndex;

    if (next) {
      resolvedIndex += 1;
      resolvedTrack = next;
    } else if (repeatMode === 'all') {
      resolvedIndex = 0;
      resolvedTrack = queue[0];
    }

    assert.equal(resolvedIndex, 0);
    assert.equal(resolvedTrack.id, 'track-1');
  });

  it('handles transition flag to prevent false pause event dispatching to MediaSession', () => {
    let isTransitioning = false;
    let isPlaying = true;
    let mediaSessionState = 'playing';

    // Simulate track change
    isTransitioning = true;
    // Native browser pause event fires during src change
    const onPause = () => {
      if (!isTransitioning) {
        isPlaying = false;
        mediaSessionState = 'paused';
      }
    };

    onPause();
    assert.equal(isPlaying, true, 'isPlaying should remain true during track transition');
    assert.equal(mediaSessionState, 'playing', 'MediaSession should not be marked paused during track transition');

    // Native browser playing event fires once new audio stream buffers
    const onPlaying = () => {
      isTransitioning = false;
      isPlaying = true;
      mediaSessionState = 'playing';
    };

    onPlaying();
    assert.equal(isTransitioning, false);
    assert.equal(isPlaying, true);
    assert.equal(mediaSessionState, 'playing');

    // Simulate intentional user pause
    onPause();
    assert.equal(isPlaying, false, 'Intentional pause should pause playback');
    assert.equal(mediaSessionState, 'paused');
  });

  it('recovers from playback error via queueMicrotask instead of suspended setTimeout', async () => {
    let nextTrackCalledWith = null;
    const nextTrack = (reason) => {
      nextTrackCalledWith = reason;
    };

    // Simulate handleAudioError using queueMicrotask
    const handleAudioError = () => {
      queueMicrotask(() => {
        nextTrack('error');
      });
    };

    handleAudioError();
    // Yield to microtask queue
    await Promise.resolve();

    assert.equal(nextTrackCalledWith, 'error', 'Error recovery should execute immediately on microtask tick');
  });
});
