export const isRadioTrack = (track, options = {}) => {
  if (options && (options.isRadio === true || options.playbackSource === 'radio')) return true;
  if (options && options.isRadio === false) return false;
  if (!track) return false;
  if (track.isRadio === true || track.playbackSource === 'radio' || track.type === 'radio') return true;
  if (track.isRadio === false) return false;

  const title = String(track.title || '').toLowerCase();
  const artist = String(track.artist || '').toLowerCase();
  const album = String(track.album || '').toLowerCase();
  const genre = String(track.genre || '').toLowerCase();

  // Explicit check for Lo-Fi Radio station patterns
  if (
    title.includes('radio') &&
    (title.includes('lofi') ||
      title.includes('lo-fi') ||
      title.includes('chill') ||
      title.includes('synthwave') ||
      artist.includes('lofi') ||
      album.includes('radio'))
  ) {
    return true;
  }

  if (genre.includes('radio') || (genre.includes('lo-fi') && title.includes('radio'))) {
    return true;
  }

  return false;
};

export const normalizeTrackTitle = (title = '') => String(title ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
  .replace(/\b(?:original|remix|remastered|re-mastered|live|acoustic|unplugged|cover|reprise|slowed|sped up|speed up|nightcore|radio edit|extended mix|lofi mix)\s*(?:version|mix|edit)?\s*$/i, ' ')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export const createSingleTrackQueue = (track) => track ? [track] : [];

export const buildTrackSearchQuery = (track) => {
  const title = typeof track?.title === 'string' ? track.title.trim() : '';
  if (!title) return '';
  const artist = typeof track.artist === 'string' ? track.artist.trim() : '';
  return [title, artist].filter(Boolean).join(' ');
};

export const appendQueueTrack = (queue, track) => [...(Array.isArray(queue) ? queue : []), track];

export const getNextQueuedTrack = (queue, queueIndex) => {
  const nextIndex = queueIndex + 1;
  return Array.isArray(queue) && nextIndex >= 0 && nextIndex < queue.length
    ? queue[nextIndex] || null
    : null;
};

export const getPreviousQueueIndex = (queue, queueIndex) => {
  if (!Array.isArray(queue) || queue.length === 0) return -1;
  return queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
};

export const shuffleQueuePreservingCurrent = (queue, currentTrack, queueIndex, random = Math.random) => {
  const remaining = Array.isArray(queue) ? queue.filter((_, index) => index !== queueIndex) : [];
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const randomValue = Number(random());
    const safeRandomValue = Number.isFinite(randomValue)
      ? Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON)
      : 0;
    const swapIndex = Math.floor(safeRandomValue * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }
  return currentTrack ? [currentTrack, ...remaining] : remaining;
};

export const getNextRepeatMode = (mode) => {
  if (mode === 'off') return 'all';
  if (mode === 'all') return 'one';
  return 'off';
};

export const pickAutoplayCandidate = (
  tracks,
  { currentTrack, queue = [], recentlyPlayed = [], random = Math.random } = {}
) => {
  const currentTitle = normalizeTrackTitle(currentTrack?.title);
  const queuedTracks = Array.isArray(queue) ? queue : [];
  const recentTracks = Array.isArray(recentlyPlayed) ? recentlyPlayed : [];
  const excludedIds = new Set(
    [...queuedTracks, ...recentTracks]
      .map(track => track?.id)
      .filter(Boolean)
  );

  const candidates = (Array.isArray(tracks) ? tracks : []).filter(track => {
    const normalizedTitle = normalizeTrackTitle(track?.title);
    return Boolean(
      track?.id &&
      typeof track.title === 'string' &&
      track.title.trim() &&
      normalizedTitle &&
      track.id !== currentTrack?.id &&
      !excludedIds.has(track.id) &&
      (!currentTitle || normalizedTitle !== currentTitle)
    );
  });

  if (candidates.length === 0) return null;

  const randomValue = Number(random());
  const safeRandomValue = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON)
    : 0;
  return candidates[Math.floor(safeRandomValue * candidates.length)] || null;
};

export const searchForAutoplayCandidate = async (search, query, options, onError = null) => {
  if (typeof search !== 'function' || !query) return null;
  try {
    const response = await search(query);
    return pickAutoplayCandidate(response?.results, options);
  } catch (error) {
    if (onError) onError(error);
    return null;
  }
};
