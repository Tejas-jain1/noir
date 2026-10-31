import { normalizeTrackTitle } from './playbackUtils.js';

const normalizeText = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\b(?:feat|ft)\.?\b.*$/i, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const tokenSimilarity = (left, right) => {
  const leftWords = new Set(normalizeText(left).split(/\s+/).filter(Boolean));
  const rightWords = new Set(normalizeText(right).split(/\s+/).filter(Boolean));
  if (!leftWords.size || !rightWords.size) return 0;
  const intersection = [...leftWords].filter(word => rightWords.has(word)).length;
  return intersection / new Set([...leftWords, ...rightWords]).size;
};

const artistSimilarity = (sourceArtists, candidateArtist) => {
  const source = (Array.isArray(sourceArtists) ? sourceArtists : [sourceArtists])
    .map(normalizeText)
    .filter(Boolean);
  const candidate = normalizeText(candidateArtist);
  if (!source.length || !candidate) return 0;
  if (source.some(name => name === candidate || candidate.includes(name) || name.includes(candidate))) return 1;
  return Math.max(0, ...source.map(name => tokenSimilarity(name, candidate)));
};

export const parseSpotifyPlaylistId = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';

  const uriMatch = input.match(/^spotify:playlist:([a-zA-Z0-9]{10,40})$/i);
  if (uriMatch) return uriMatch[1];

  const bareMatch = input.match(/^([a-zA-Z0-9]{10,40})(?:[?#].*)?$/);
  if (bareMatch) return bareMatch[1];

  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    if (!['open.spotify.com', 'www.spotify.com', 'spotify.com'].includes(hostname)) return '';
    const segments = url.pathname.split('/').filter(Boolean);
    const playlistIndex = segments.findIndex(segment => segment.toLowerCase() === 'playlist');
    const id = playlistIndex >= 0 ? segments[playlistIndex + 1] : '';
    return /^[a-zA-Z0-9]{10,40}$/.test(id || '') ? id : '';
  } catch {
    return '';
  }
};

export const formatSpotifyDuration = (durationMs) => {
  const seconds = Math.max(0, Math.floor((Number(durationMs) || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export const collectSpotifyPlaylistPages = async (playlistId, fetchPage) => {
  const id = String(playlistId || '').trim();
  if (!/^[a-zA-Z0-9]{10,40}$/.test(id)) throw new Error('A valid Spotify playlist ID is required.');
  if (typeof fetchPage !== 'function') throw new Error('A Spotify page loader is required.');

  const apiOrigin = 'https://api.spotify.com';
  const expectedPath = `/v1/playlists/${encodeURIComponent(id)}/items`;
  let nextUrl = new URL(expectedPath, apiOrigin);
  nextUrl.searchParams.set('limit', '50');
  nextUrl.searchParams.set('additional_types', 'track,episode');
  const seenUrls = new Set();
  const items = [];
  let total = null;

  while (nextUrl) {
    const href = nextUrl.toString();
    if (nextUrl.origin !== apiOrigin || nextUrl.pathname !== expectedPath) {
      throw new Error('Spotify returned an invalid playlist page link.');
    }
    if (seenUrls.has(href)) throw new Error('Spotify returned a repeated playlist page.');
    seenUrls.add(href);

    const page = await fetchPage(href);
    if (!page || !Array.isArray(page.items)) throw new Error('Spotify returned an invalid playlist page.');
    if (total === null && Number.isFinite(Number(page.total))) total = Math.max(0, Number(page.total));
    items.push(...page.items);
    nextUrl = page.next ? new URL(page.next, apiOrigin) : null;
  }

  if (total !== null && items.length < total) {
    throw new Error(`Spotify returned only ${items.length} of ${total} playlist items. Try again later.`);
  }

  return { items, total: total ?? items.length };
};

export const findSpotifySaavnMatch = (spotifyTrack, candidates) => {
  const title = String(spotifyTrack?.title || '').trim();
  const artists = Array.isArray(spotifyTrack?.artists) ? spotifyTrack.artists : [];
  if (!title || artists.length === 0 || !Array.isArray(candidates)) return null;

  const normalizedTitle = normalizeTrackTitle(title);
  if (!normalizedTitle) return null;

  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (!candidate?.id || !candidate?.audioUrl || candidate.source !== 'saavn_cdn' || !candidate?.title) continue;
    const candidateTitle = normalizeTrackTitle(candidate.title);
    if (!candidateTitle) continue;
    const titleScore = candidateTitle === normalizedTitle ? 1 : tokenSimilarity(title, candidate.title);
    const artistScore = artistSimilarity(artists, candidate.artist);
    const score = titleScore * 0.72 + artistScore * 0.28;
    if (titleScore >= 0.72 && artistScore >= 0.45 && score >= 0.70 && score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
};

export const spotifyPlaylistItemToTrack = (entry, index, playlistArtwork = '') => {
  const item = entry?.item || entry?.track || null;
  if (!item) {
    return {
      spotifyTrackId: '', title: '', artists: [], album: '', artwork: playlistArtwork,
      durationMs: 0, spotifyUrl: '', unavailable: true,
      unavailableReason: 'This item was removed or is no longer available on Spotify.'
    };
  }

  const itemType = item.type || (Array.isArray(item.artists) ? 'track' : 'unknown');
  const image = item.album?.images?.find(source => source?.url)?.url ||
    item.show?.images?.find(source => source?.url)?.url || playlistArtwork;
  const isUnsupported = itemType !== 'track';
  const isLocal = Boolean(entry?.is_local || item.is_local);
  return {
    spotifyTrackId: String(item.id || item.linked_from?.id || ''),
    title: String(item.name || ''),
    artists: (Array.isArray(item.artists) ? item.artists : [])
      .map(artist => artist?.name)
      .filter(Boolean),
    album: String(item.album?.name || item.show?.name || ''),
    artwork: image,
    durationMs: Math.max(0, Number(item.duration_ms) || 0),
    spotifyUrl: String(item.external_urls?.spotify || (item.id ? `https://open.spotify.com/${itemType}/${item.id}` : '')),
    unavailable: isUnsupported || isLocal,
    unavailableReason: isUnsupported
      ? 'This playlist item is not a music track supported by NOIR.'
      : isLocal
        ? 'Spotify local files cannot be imported through the Web API.'
        : ''
  };
};

export const createImportedSpotifyTrack = (sourceTrack, match, position, fallbackArtwork = '') => {
  const source = sourceTrack || {};
  const spotifyId = String(source.spotifyTrackId || source.id || '').trim();
  const title = String(source.title || '').trim();
  const artists = Array.isArray(source.artists) ? source.artists.filter(Boolean) : [];
  const artist = artists.join(', ');
  const durationMs = Math.max(0, Number(source.durationMs) || 0);
  const artwork = source.artwork || fallbackArtwork || '';
  const isUnavailable = Boolean(source.unavailable || !title || !artist);
  const status = isUnavailable ? 'unavailable' : match ? 'matched' : 'unmatched';

  return {
    id: `spotify:${spotifyId || 'item'}:${position + 1}`,
    title: title || 'Unavailable Spotify track',
    artist: artist || 'Track metadata unavailable',
    album: String(source.album || ''),
    thumbnail: artwork,
    duration: Math.floor(durationMs / 1000),
    durationMs,
    durationFormatted: formatSpotifyDuration(durationMs),
    spotifyTrackId: spotifyId,
    spotifyUrl: String(source.spotifyUrl || ''),
    matchStatus: status,
    isPlayable: status === 'matched',
    catalogTrackId: match?.id || '',
    unavailableReason: isUnavailable ? String(source.unavailableReason || 'Spotify did not provide usable track metadata.') : '',
    saavnTitle: match?.title || '',
    saavnArtist: match?.artist || '',
    source: 'spotify_import',
    audioUrl: match?.audioUrl || ''
  };
};

export const countSpotifyImportResults = (tracks) => (Array.isArray(tracks) ? tracks : []).reduce((counts, track) => {
  const status = track?.matchStatus;
  if (status === 'matched') counts.matched += 1;
  else if (status === 'unavailable') counts.unavailable += 1;
  else counts.unmatched += 1;
  return counts;
}, { matched: 0, unmatched: 0, unavailable: 0 });
