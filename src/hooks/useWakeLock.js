import { useEffect, useRef } from 'react';

/**
 * Screen Wake Lock hook for NOIR
 * Prevents device screen from turning off during active music playback.
 */
export function useWakeLock(enabled = false) {
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let isSubscribed = true;

    async function requestLock() {
      try {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          const lock = await navigator.wakeLock.request('screen');
          if (!isSubscribed) {
            await lock.release();
            return;
          }
          wakeLockRef.current = lock;
          lock.addEventListener('release', () => {
            if (wakeLockRef.current === lock) {
              wakeLockRef.current = null;
            }
          });
        }
      } catch (err) {
        console.debug('[useWakeLock] Wake Lock request not granted:', err);
      }
    }

    requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);
}
