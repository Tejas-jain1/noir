import { normalizeTrackTitle } from './playbackUtils';

const normalizeWords = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\b(feat|ft)\b.*$/i, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const getTitleSimilarity = (left, right) => {
  const normalizedLeft = normalizeTrackTitle(left);
  const normalizedRight = normalizeTrackTitle(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftWords = new Set(normalizeWords(left).split(/\s+/).filter(Boolean));
  const rightWords = new Set(normalizeWords(right).split(/\s+/).filter(Boolean));
  const intersection = [...leftWords].filter(word => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return union > 0 ? intersection / union : 0;
};

const getArtistSimilarity = (sourceArtists, candidateArtist) => {
  const source = (Array.isArray(sourceArtists) ? sourceArtists : [])
    .map(normalizeWords)
    .filter(Boolean);
  const candidate = normalizeWords(candidateArtist);
  if (source.length === 0 || !candidate) return 0;
  if (source.some(artist => artist === candidate || candidate.includes(artist) || artist.includes(candidate))) return 1;
  const sourceWords = new Set(source.flatMap(artist => artist.split(/\s+/)));
  const candidateWords = new Set(candidate.split(/\s+/));
  const overlap = [...sourceWords].filter(word => candidateWords.has(word)).length;
  return overlap ? overlap / Math.max(sourceWords.size, candidateWords.size) : 0;
};

export const findSpotifyPlaylistMatch = (spotifyTrack, candidates) => {
  const sourceTitle = String(spotifyTrack?.title || '').trim();
  if (!sourceTitle || !Array.isArray(candidates)) return null;

  let bestMatch = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (!candidate?.id || !candidate?.audioUrl || !candidate?.title) continue;
    const titleSimilarity = getTitleSimilarity(sourceTitle, candidate.title);
    const artistSimilarity = getArtistSimilarity(spotifyTrack.artists, candidate.artist);
    const score = titleSimilarity * 0.82 + artistSimilarity * 0.18;
    const titleIsStrong = titleSimilarity >= 0.7;
    const artistIsStrong = artistSimilarity > 0 || titleSimilarity >= 0.92;
    if (titleIsStrong && artistIsStrong && score >= 0.72 && score > bestScore) {
      bestMatch = candidate;
      bestScore = score;
    }
  }
  return bestMatch;
};
