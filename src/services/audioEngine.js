/**
 * HTML5 Audio Engine for NOIR
 *
 * Implements a persistent, resilient HTMLAudioElement controller.
 * Reuses a single persistent Audio instance to guarantee background playback continuity on iOS Safari and Android Chrome.
 * Features an adaptive watchdog timer with automatic reload recovery for stalled network pipelines.
 */

class AudioEngine {
  constructor() {
    this.element = typeof window !== 'undefined' ? new Audio() : null;
    if (this.element) {
      this.element.preload = 'auto';
    }
    this.currentSource = null;
    this.cleanupListeners = null;
    this.watchdogTimer = null;
    this.lastBufferedTime = 0;
    this.hasRetried = false;
    this.currentCallbacks = null;
    this.hasSource = false;
  }

  static WATCHDOG_TIMEOUT_MS = 15000;

  clearWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  startWatchdog(callbacks) {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      if (this.hasSource && this.element && this.element.readyState < 2) {
        console.warn('[AudioEngine] Playback stalled or failed to buffer within 15s');
        if (!this.hasRetried && this.currentSource) {
          this.attemptRecovery(callbacks);
          return;
        }
        this.clearWatchdog();
        callbacks?.onError?.('The audio stream stalled and could not load.');
      }
    }, AudioEngine.WATCHDOG_TIMEOUT_MS);
  }

  attemptRecovery(callbacks) {
    if (!this.currentSource || !this.element) return;
    this.hasRetried = true;
    console.info('[AudioEngine] Attempting stream fast-reload recovery...');
    const separator = this.currentSource.includes('?') ? '&' : '?';
    const cacheBustUrl = `${this.currentSource}${separator}retry_cb=${Date.now()}`;

    this.element.src = cacheBustUrl;
    this.element.load();
    this.startWatchdog(callbacks);

    this.element.play().catch((err) => {
      console.debug('[AudioEngine] Recovery resume caught:', err?.message || err);
    });
  }

  getBufferedTime() {
    if (!this.element) return 0;
    const range = this.element.buffered;
    return range.length ? range.end(range.length - 1) : 0;
  }

  load(sourceUrl, callbacks = {}) {
    if (!this.element) return;
    if (!sourceUrl) {
      throw new Error('[AudioEngine] An audio stream URL is required.');
    }

    this.cleanup();
    this.currentSource = sourceUrl;
    this.hasRetried = false;
    this.lastBufferedTime = 0;
    this.currentCallbacks = callbacks;

    this.element.src = sourceUrl;
    this.element.load();
    this.hasSource = true;
    callbacks.onLoading?.();

    this.startWatchdog(callbacks);

    const onLoadedMetadata = () => {
      callbacks.onReady?.(this.element.duration || 0);
    };

    const onCanPlay = () => {
      this.clearWatchdog();
    };

    const onTimeUpdate = () => {
      callbacks.onProgress?.(
        this.element.currentTime || 0,
        this.element.duration || 0,
        this.getBufferedTime()
      );
    };

    const onProgress = () => {
      const buffered = this.getBufferedTime();
      if (buffered > this.lastBufferedTime + 0.25) {
        this.lastBufferedTime = buffered;
        if (this.element.readyState < 2) {
          this.startWatchdog(callbacks);
        }
      }
      callbacks.onProgress?.(
        this.element.currentTime || 0,
        this.element.duration || 0,
        buffered
      );
    };

    const onWaiting = () => {
      callbacks.onLoading?.();
    };

    const onPlaying = () => {
      this.clearWatchdog();
      callbacks.onPlaying?.();
    };

    const onPause = () => {
      callbacks.onPaused?.();
    };

    const onEnded = () => {
      this.clearWatchdog();
      callbacks.onEnded?.();
    };

    const onError = () => {
      console.error('[AudioEngine] HTMLAudioElement error event', {
        code: this.element.error?.code,
        message: this.element.error?.message,
        source: this.currentSource
      });

      if (!this.hasRetried && this.currentSource) {
        this.attemptRecovery(callbacks);
        return;
      }

      this.clearWatchdog();
      callbacks.onError?.('Failed to stream audio file.');
    };

    this.element.addEventListener('loadedmetadata', onLoadedMetadata);
    this.element.addEventListener('canplay', onCanPlay);
    this.element.addEventListener('timeupdate', onTimeUpdate);
    this.element.addEventListener('progress', onProgress);
    this.element.addEventListener('waiting', onWaiting);
    this.element.addEventListener('playing', onPlaying);
    this.element.addEventListener('pause', onPause);
    this.element.addEventListener('ended', onEnded);
    this.element.addEventListener('error', onError);

    this.cleanupListeners = () => {
      this.clearWatchdog();
      this.element.removeEventListener('loadedmetadata', onLoadedMetadata);
      this.element.removeEventListener('canplay', onCanPlay);
      this.element.removeEventListener('timeupdate', onTimeUpdate);
      this.element.removeEventListener('progress', onProgress);
      this.element.removeEventListener('waiting', onWaiting);
      this.element.removeEventListener('playing', onPlaying);
      this.element.removeEventListener('pause', onPause);
      this.element.removeEventListener('ended', onEnded);
      this.element.removeEventListener('error', onError);
    };
  }

  async play() {
    if (!this.element || !this.hasSource) return;
    try {
      await this.element.play();
    } catch (err) {
      // In iOS Safari/Chrome, play() may throw NotAllowedError if not triggered directly by user gesture
      console.warn('[AudioEngine] Play request caught:', err?.message || err);
      throw err;
    }
  }

  pause() {
    if (this.element && this.hasSource) {
      this.element.pause();
    }
  }

  seek(seconds) {
    if (!this.element || !this.hasSource) return;
    const target = Math.max(0, Math.min(this.element.duration || 0, seconds));
    this.element.currentTime = target;
  }

  setVolume(volumePercent) {
    if (!this.element) return;
    const vol = Math.max(0, Math.min(100, Number(volumePercent))) / 100;
    this.element.volume = vol;
  }

  setMuted(muted) {
    if (!this.element) return;
    this.element.muted = Boolean(muted);
  }

  cleanup() {
    this.clearWatchdog();
    if (this.cleanupListeners) {
      this.cleanupListeners();
      this.cleanupListeners = null;
    }
    this.currentCallbacks = null;
  }

  stop() {
    this.cleanup();
    if (this.element) {
      this.element.pause();
      this.element.removeAttribute('src');
      this.element.load();
    }
    this.currentSource = null;
    this.hasSource = false;
  }
}

// Single persistent AudioEngine instance across application lifetime
export const audioEngine = new AudioEngine();
