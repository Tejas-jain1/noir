import { normalizeTrackTitle } from './playbackUtils.js';

const GENRES = {
  'hip-hop': {
    label: 'Hip-hop',
    aliases: ['hip-hop', 'hip hop', 'hiphop', 'rap', 'trap', 'drill', 'grime', 'boom bap'],
    searches: ['hip-hop rap songs', 'trap songs', 'drill songs'],
    related: ['r&b', 'reggae']
  },
  'r&b': {
    label: 'R&B',
    aliases: ['r&b', 'rnb', 'rhythm and blues', 'soul', 'neo-soul', 'neosoul'],
    searches: ['r&b soul songs', 'neo-soul songs'],
    related: ['hip-hop', 'pop']
  },
  electronic: {
    label: 'Electronic',
    aliases: ['electronic', 'edm', 'dance music', 'house', 'techno', 'trance', 'dubstep', 'electro', 'drum and bass', 'dnb'],
    searches: ['electronic dance music', 'EDM songs', 'house music'],
    related: ['pop', 'hip-hop']
  },
  'lo-fi': {
    label: 'Lo-fi',
    aliases: ['lo-fi', 'lofi', 'chillhop', 'downtempo', 'study beats'],
    searches: ['lo-fi chillhop beats', 'downtempo songs'],
    related: ['ambient', 'r&b']
  },
  ambient: {
    label: 'Ambient',
    aliases: ['ambient', 'new age', 'soundscape'],
    searches: ['ambient relaxing music'],
    related: ['lo-fi', 'classical']
  },
  pop: {
    label: 'Pop',
    aliases: ['pop', 'synth-pop', 'synthpop', 'dance-pop', 'indie pop'],
    searches: ['pop songs', 'indie pop songs'],
    related: ['r&b', 'electronic', 'rock']
  },
  rock: {
    label: 'Rock',
    aliases: ['rock', 'alternative rock', 'alt rock', 'indie rock', 'punk'],
    searches: ['rock songs', 'alternative rock songs'],
    related: ['pop', 'metal']
  },
  metal: {
    label: 'Metal',
    aliases: ['metal', 'heavy metal', 'metalcore'],
    searches: ['metal songs', 'heavy metal songs'],
    related: ['rock']
  },
  jazz: {
    label: 'Jazz',
    aliases: ['jazz', 'smooth jazz', 'bebop'],
    searches: ['jazz songs', 'smooth jazz'],
    related: ['r&b', 'classical']
  },
  classical: {
    label: 'Classical',
    aliases: ['classical', 'orchestral', 'instrumental'],
    searches: ['classical instrumental music'],
    related: ['ambient', 'jazz']
  },
  country: {
    label: 'Country',
    aliases: ['country', 'bluegrass'],
    searches: ['country songs'],
    related: ['folk', 'rock']
  },
  folk: {
    label: 'Folk',
    aliases: ['folk', 'singer songwriter', 'acoustic folk'],
    searches: ['folk acoustic songs'],
    related: ['country', 'pop']
  },
  reggae: {
    label: 'Reggae',
    aliases: ['reggae', 'dancehall', 'ska'],
    searches: ['reggae songs', 'dancehall songs'],
    related: ['hip-hop', 'r&b']
  },
  latin: {
    label: 'Latin',
    aliases: ['latin', 'reggaeton', 'salsa', 'bachata'],
    searches: ['latin songs', 'reggaeton songs'],
    related: ['pop', 'electronic']
  },
  bollywood: {
    label: 'Bollywood',
    aliases: ['bollywood', 'hindi film', 'hindi soundtrack'],
    searches: ['Bollywood songs', 'Hindi film songs'],
    related: ['pop', 'r&b']
  },
  punjabi: {
    label: 'Punjabi',
    aliases: ['punjabi', 'bhangra'],
    searches: ['Punjabi songs', 'Punjabi pop'],
    related: ['hip-hop', 'pop']
  },
  'k-pop': {
    label: 'K-pop',
    aliases: ['k-pop', 'kpop', 'korean pop'],
    searches: ['K-pop songs'],
    related: ['pop', 'electronic']
  }
};

const MOODS = {
  sad: {
    label: 'Sad / emotional',
    aliases: ['sad', 'emotional', 'heartbreak', 'heartbroken', 'melancholy', 'melancholic', 'slow', 'lonely', 'pain', 'dard', 'bewafa', 'judaai', 'tanha'],
    searches: ['sad emotional heartbreak slow songs', 'melancholic songs']
  },
  romantic: {
    label: 'Romantic',
    aliases: ['romantic', 'romance', 'love song', 'love songs', 'lover', 'ishq', 'pyaar', 'pyar', 'mohabbat'],
    searches: ['romantic love songs', 'love songs']
  },
  energetic: {
    label: 'Energetic / party',
    aliases: ['party', 'energetic', 'high energy', 'dance', 'club', 'workout', 'celebration'],
    searches: ['energetic party dance songs', 'club dance music']
  },
  chill: {
    label: 'Chill / relaxing',
    aliases: ['chill', 'relaxing', 'relax', 'calm', 'mellow', 'lo-fi', 'lofi', 'sleep', 'peaceful'],
    searches: ['chill relaxing lo-fi songs', 'calm mellow songs']
  },
  happy: {
    label: 'Upbeat / happy',
    aliases: ['happy', 'feel good', 'upbeat', 'joyful', 'cheerful'],
    searches: ['happy feel-good upbeat songs']
  }
};

const ENERGY_TERMS = {
  low: ['low', 'calm', 'slow', 'relaxed', 'chill', 'soft'],
  medium: ['medium', 'moderate'],
  high: ['high', 'energetic', 'upbeat', 'intense', 'party']
};

const normalizeMusicText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const includesPhrase = (text, phrase) => {
  const haystack = ` ${normalizeMusicText(text)} `;
  const needle = ` ${normalizeMusicText(phrase)} `;
  return needle !== '  ' && haystack.includes(needle);
};

const addSignal = (signals, id, source) => {
  if (!id) return;
  const current = signals.get(id);
  const rank = { metadata: 4, query: 3, inferred: 2 };
  if (!current || rank[source] > rank[current.source]) signals.set(id, { id, source });
};

const collectGenreSignals = (track, searchQuery = '') => {
  const signals = new Map();
  const rawGenres = [track?.genre, track?.primaryGenre, track?.genres, track?.tags]
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter(value => typeof value === 'string' && value.trim());

  for (const value of rawGenres) {
    const known = Object.keys(GENRES).filter(id => GENRES[id].aliases.some(alias => includesPhrase(value, alias)));
    if (known.length > 0) known.forEach(id => addSignal(signals, id, 'metadata'));
    else {
      value.split(/[,/|;]+/).map(normalizeMusicText).filter(Boolean)
        .forEach(id => addSignal(signals, id, 'metadata'));
    }
  }

  for (const [id, definition] of Object.entries(GENRES)) {
    if (definition.aliases.some(alias => includesPhrase(searchQuery, alias))) addSignal(signals, id, 'query');
  }

  const descriptiveText = `${track?.title || ''} ${track?.album || ''}`;
  for (const [id, definition] of Object.entries(GENRES)) {
    if (definition.aliases.some(alias => includesPhrase(descriptiveText, alias))) addSignal(signals, id, 'inferred');
  }

  return [...signals.values()];
};

const collectMoodSignals = (track, searchQuery = '') => {
  const signals = new Map();
  const explicitMoods = [track?.mood, track?.moods, track?.genre, track?.genres, track?.tags]
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter(value => typeof value === 'string' && value.trim());

  for (const value of explicitMoods) {
    for (const [id, definition] of Object.entries(MOODS)) {
      if (definition.aliases.some(alias => includesPhrase(value, alias))) addSignal(signals, id, 'metadata');
    }
  }

  for (const [id, definition] of Object.entries(MOODS)) {
    if (definition.aliases.some(alias => includesPhrase(searchQuery, alias))) addSignal(signals, id, 'query');
  }

  const descriptiveText = `${track?.title || ''} ${track?.album || ''}`;
  for (const [id, definition] of Object.entries(MOODS)) {
    if (definition.aliases.some(alias => includesPhrase(descriptiveText, alias))) addSignal(signals, id, 'inferred');
  }

  return [...signals.values()];
};

const inferEnergy = (track, genres, moods) => {
  const raw = track?.energy ?? track?.energyLevel;
  const numeric = Number(raw);
  if (raw !== undefined && raw !== null && raw !== '' && Number.isFinite(numeric)) {
    return { level: numeric >= 0.67 ? 'high' : numeric <= 0.33 ? 'low' : 'medium', source: 'metadata' };
  }
  if (typeof raw === 'string') {
    const level = Object.entries(ENERGY_TERMS)
      .find(([, terms]) => terms.some(term => includesPhrase(raw, term)))?.[0];
    if (level) return { level, source: 'metadata' };
  }
  if (moods.some(signal => signal.id === 'energetic' || signal.id === 'happy')) return { level: 'high', source: 'inferred' };
  if (moods.some(signal => signal.id === 'sad' || signal.id === 'chill')) return { level: 'low', source: 'inferred' };
  if (genres.some(signal => ['lo-fi', 'ambient', 'classical'].includes(signal.id))) return { level: 'low', source: 'inferred' };
  if (genres.some(signal => signal.id === 'electronic')) return { level: 'high', source: 'inferred' };
  return { level: 'unknown', source: 'unknown' };
};

export const classifyTrackVibe = (track = {}, searchQuery = '') => {
  const genres = collectGenreSignals(track, searchQuery);
  const moods = collectMoodSignals(track, searchQuery);
  return {
    genres,
    moods,
    genreIds: genres.map(signal => signal.id),
    moodIds: moods.map(signal => signal.id),
    energy: inferEnergy(track, genres, moods),
    language: typeof track.language === 'string' ? track.language.trim().toLowerCase() : '',
    artist: typeof track.artist === 'string' ? track.artist.trim() : '',
    title: typeof track.title === 'string' ? track.title.trim() : '',
    album: typeof track.album === 'string' ? track.album.trim() : ''
  };
};

export const createRecommendationContext = (track, searchQuery = '') => {
  const vibe = classifyTrackVibe(track, searchQuery);
  return {
    ...vibe,
    seedTrackId: track?.id || null,
    searchQuery: String(searchQuery || '').trim(),
    source: searchQuery ? 'track-and-search-context' : 'track-metadata'
  };
};

const genreSearchTerms = (genreId) => GENRES[genreId]?.searches || [`${genreId} songs`];
const moodSearchTerms = (moodId) => MOODS[moodId]?.searches || [`${moodId} songs`];
const moodQuery = (moodIds) => moodIds.length > 0 ? moodSearchTerms(moodIds[0])[0] : '';

const makeQuery = (query, genreIds = [], moodIds = []) => ({
  query: query.trim(),
  genreIds,
  moodIds
});

export const getRelatedGenreIds = (genreIds = []) => [...new Set(
  genreIds.flatMap(id => GENRES[id]?.related || [])
)];

const uniqueQueries = (queries) => {
  const seen = new Set();
  return queries.filter(item => {
    const key = normalizeMusicText(item.query);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildAutoplaySearchTiers = (context, { userPreferences = {}, recentTracks = [] } = {}) => {
  const genreIds = context?.genreIds || context?.genres?.map(signal => signal.id) || [];
  const moodIds = context?.moodIds || context?.moods?.map(signal => signal.id) || [];
  const primaryGenre = genreIds[0];
  const primaryMood = moodIds[0];
  const sameVibeQueries = [];

  if (primaryGenre) {
    const baseTerms = genreSearchTerms(primaryGenre);
    sameVibeQueries.push(...baseTerms.slice(0, 2).map(query => makeQuery(query, genreIds, [])));
    if (primaryMood) {
      sameVibeQueries.push(makeQuery(`${GENRES[primaryGenre]?.label || primaryGenre} ${moodQuery([primaryMood])}`, genreIds, moodIds));
    }
  } else if (primaryMood) {
    sameVibeQueries.push(...moodSearchTerms(primaryMood).map(query => makeQuery(query, [], moodIds)));
  }

  const relatedIds = getRelatedGenreIds(genreIds);
  const relatedQueries = relatedIds.slice(0, 4).flatMap(id => {
    const base = genreSearchTerms(id).slice(0, 1).map(query => makeQuery(
      primaryMood ? `${query} ${moodQuery([primaryMood])}` : query,
      [id],
      primaryMood ? moodIds : []
    ));
    return base;
  });

  const vibeSuffix = [
    primaryGenre ? GENRES[primaryGenre]?.label || primaryGenre : '',
    primaryMood ? moodQuery([primaryMood]) : ''
  ].filter(Boolean).join(' ');
  const artistQueries = [];
  const addArtistQuery = (artist) => {
    if (typeof artist !== 'string' || !artist.trim()) return;
    artistQueries.push(makeQuery(`${artist.trim()} ${vibeSuffix || 'songs'}`, genreIds, moodIds));
  };
  addArtistQuery(context?.artist);
  (userPreferences?.artists || []).slice(0, 3).forEach(addArtistQuery);
  (recentTracks || []).slice(0, 10)
    .filter(track => track?.artist && track.artist.toLowerCase() !== context?.artist?.toLowerCase())
    .slice(0, 2)
    .forEach(track => addArtistQuery(track.artist));

  if (!primaryGenre && !primaryMood) {
    (userPreferences?.genres || []).slice(0, 3).forEach(genre => {
      const signals = classifyTrackVibe({ genre });
      const id = signals.genreIds[0];
      if (id) artistQueries.push(makeQuery(genreSearchTerms(id)[0], [id], []));
    });
  }

  return [
    { id: 'same-vibe', queries: uniqueQueries(sameVibeQueries) },
    { id: 'related-genres', queries: uniqueQueries(relatedQueries) },
    { id: 'artist-style', queries: uniqueQueries(artistQueries) },
    { id: 'broader', queries: [] }
  ];
};

const isRelatedGenre = (target, candidate) =>
  (GENRES[target]?.related || []).includes(candidate) || (GENRES[candidate]?.related || []).includes(target);

const artistMatches = (left = '', right = '') => {
  const a = normalizeMusicText(left);
  const b = normalizeMusicText(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
};

const sourceWeight = (source) => source === 'metadata' ? 1 : source === 'query' ? 0.75 : 0.6;

export const scoreRecommendationCandidate = (track, context, {
  retrievedFor = {},
  userPreferences = {},
  likedTracks = [],
  recentTracks = []
} = {}) => {
  const candidate = classifyTrackVibe(track);
  const targetGenres = context?.genreIds || context?.genres?.map(signal => signal.id) || [];
  const targetMoods = context?.moodIds || context?.moods?.map(signal => signal.id) || [];
  const targetGenreSignals = context?.genres || [];
  const targetMoodSignals = context?.moods || [];
  let score = 0;
  let genreMatch = false;
  let relatedGenreMatch = false;
  let moodMatch = false;
  let queryGenreMatch = false;
  let queryMoodMatch = false;
  let moodConflict = false;
  const artistMatch = artistMatches(context?.artist, track?.artist);

  for (const target of targetGenres) {
    const targetSignal = targetGenreSignals.find(signal => signal.id === target);
    for (const found of candidate.genres) {
      if (found.id === target) {
        genreMatch = true;
        score += Math.round(66 * sourceWeight(found.source) * sourceWeight(targetSignal?.source || 'metadata'));
      } else if (isRelatedGenre(target, found.id)) {
        relatedGenreMatch = true;
        score += Math.round(38 * sourceWeight(found.source));
      }
    }
  }

  for (const target of targetMoods) {
    const targetSignal = targetMoodSignals.find(signal => signal.id === target);
    const found = candidate.moods.find(signal => signal.id === target);
    if (found) {
      moodMatch = true;
      score += Math.round(54 * sourceWeight(found.source) * sourceWeight(targetSignal?.source || 'metadata'));
    } else if (candidate.moods.length > 0) {
      moodConflict = true;
      score -= 14;
    }
  }

  const queryGenreIds = retrievedFor.genreIds || [];
  for (const target of targetGenres) {
    if (queryGenreIds.includes(target)) {
      queryGenreMatch = true;
      score += 24;
    } else if (queryGenreIds.some(id => isRelatedGenre(target, id))) {
      relatedGenreMatch = true;
      score += 14;
    }
  }
  if (targetGenres.length === 0 && queryGenreIds.length > 0) {
    // With no reliable seed genre, a user-selected genre search can anchor
    // recommendations without pretending that the seed itself was classified.
    queryGenreMatch = true;
    score += 20;
  }
  if (targetMoods.some(id => (retrievedFor.moodIds || []).includes(id))) {
    queryMoodMatch = true;
    score += 20;
  }

  const genreConflict = targetGenres.length > 0 && candidate.genres.length > 0 && !genreMatch && !relatedGenreMatch;
  if (genreConflict) score -= 25;
  if (artistMatch) score += 20;
  if (context?.album && candidate.album && normalizeMusicText(context.album) === normalizeMusicText(candidate.album)) score += 6;

  if (context?.energy?.level && context.energy.level !== 'unknown' && candidate.energy.level !== 'unknown') {
    if (context.energy.level === candidate.energy.level) score += 12;
    else if ((context.energy.level === 'high' && candidate.energy.level === 'low') || (context.energy.level === 'low' && candidate.energy.level === 'high')) score -= 12;
  }

  if (context?.language && candidate.language) score += context.language === candidate.language ? 8 : -8;

  const preferenceVibe = classifyTrackVibe({ genres: userPreferences?.genres || [] });
  if (preferenceVibe.genreIds.some(id => candidate.genreIds.includes(id))) score += 7;
  if ((userPreferences?.artists || []).some(artist => artistMatches(artist, track?.artist))) score += 8;

  const hasVibeMatch = genreMatch || relatedGenreMatch || moodMatch || queryGenreMatch || queryMoodMatch;
  if (likedTracks.some(liked => liked?.id === track?.id) && (hasVibeMatch || targetGenres.length + targetMoods.length === 0)) score += 12;
  if (recentTracks.some(recent => artistMatches(recent?.artist, track?.artist)) && (hasVibeMatch || targetGenres.length + targetMoods.length === 0)) score += 8;
  if (track?.audioUrl) score += 8;
  else if (track?.artist) score += 2;

  return {
    track,
    score,
    genreMatch,
    relatedGenreMatch,
    moodMatch,
    queryGenreMatch,
    queryMoodMatch,
    artistMatch,
    genreConflict,
    moodConflict,
    hasVibeMatch,
    verifiedGenreMatch: genreMatch && candidate.genres.some(signal => signal.source === 'metadata'),
    verifiedMoodMatch: moodMatch && candidate.moods.some(signal => signal.source === 'metadata')
  };
};

export const rankRecommendationCandidates = (candidates, context, options = {}) => {
  const excludedTracks = [
    ...(options.excludedTracks || []),
    ...(options.skippedTracks || [])
  ];
  const excludedIds = new Set(excludedTracks.map(track => track?.id).filter(Boolean));
  const excludedTitles = new Set([
    context?.title,
    ...excludedTracks.map(track => track?.title)
  ].map(normalizeTrackTitle).filter(Boolean));
  const ranked = (Array.isArray(candidates) ? candidates : [])
    .map(entry => entry?.track ? entry : { track: entry, retrievedFor: {} })
    .filter(({ track }) => Boolean(
      track?.id &&
      typeof track.title === 'string' &&
      track.title.trim() &&
      !excludedIds.has(track.id) &&
      !excludedTitles.has(normalizeTrackTitle(track.title))
    ))
    .map(entry => ({
      ...scoreRecommendationCandidate(entry.track, context, { ...options, retrievedFor: entry.retrievedFor }),
      retrievedFor: entry.retrievedFor
    }))
    .sort((a, b) => b.score - a.score);

  const unique = [];
  const seenIds = new Set();
  const seenTitles = new Set();
  for (const result of ranked) {
    const title = normalizeTrackTitle(result.track.title);
    if (seenIds.has(result.track.id) || seenTitles.has(title)) continue;
    seenIds.add(result.track.id);
    seenTitles.add(title);
    unique.push(result);
  }
  return unique;
};

export const selectRecommendationForTier = (ranked, tierId, context) => {
  const hasStrongVibe = Boolean(context?.genreIds?.length || context?.moodIds?.length || context?.genres?.length || context?.moods?.length);
  return (ranked || []).find(result => {
    if (result.genreConflict || result.moodConflict) return false;
    if (tierId === 'same-vibe') return result.score >= 28 && result.hasVibeMatch;
    if (tierId === 'related-genres') return result.score >= 22 && (result.genreMatch || result.relatedGenreMatch || result.moodMatch || result.queryGenreMatch || result.queryMoodMatch);
    if (tierId === 'artist-style') return result.score >= (hasStrongVibe ? 27 : 12) && (result.hasVibeMatch || result.genreMatch || result.moodMatch || result.artistMatch || (!hasStrongVibe && result.score >= 12));
    if (tierId === 'broader') return hasStrongVibe
      ? result.verifiedGenreMatch || result.verifiedMoodMatch || result.relatedGenreMatch
      : result.score >= 10;
    return false;
  }) || null;
};

export const getRealPlayableSaavnTracks = (response) =>
  response?.source === 'saavn_cdn' && Array.isArray(response.results)
    ? response.results.filter(track => track?.id && track?.title && track?.audioUrl)
    : [];

export const getRecommendationVibeLabel = (context) => {
  const labels = [
    ...(context?.genres || []).map(signal => `${GENRES[signal.id]?.label || signal.id}${signal.source === 'metadata' ? '' : ' (inferred)'}`),
    ...(context?.moods || []).map(signal => `${MOODS[signal.id]?.label || signal.id}${signal.source === 'metadata' ? '' : ' (inferred)'}`)
  ];
  return labels.join(' · ');
};

export const getGenreDefinitions = () => GENRES;
export const getMoodDefinitions = () => MOODS;
