// Spotify Import Service & API Endpoint
// Supports official Spotify Web API authentication with Client Credentials grant,
// as well as public embed & oEmbed metadata extraction for zero-friction imports.
// Supports Spotify playlists, albums, and individual tracks.

export const NOIR_TRACK_ARTWORK_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100%25' height='100%25' fill='%2318181b'/%3E%3Ccircle cx='50' cy='50' r='38' stroke='%2327272a' stroke-width='4' fill='none'/%3E%3Ccircle cx='50' cy='50' r='14' fill='%2327272a'/%3E%3Cpath d='M47 38v16l12-8z' fill='%2371717a'/%3E%3C/svg%3E";

let cachedSpotifyToken = null;
let tokenExpiresAt = 0;

/**
 * Parses any Spotify URL, URI, or ID and identifies its entity type and canonical ID
 */
export function parseSpotifyUrl(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  // URI match: spotify:playlist:xxx, spotify:album:xxx, spotify:track:xxx
  const uriMatch = input.match(/^spotify:(playlist|album|track):([a-zA-Z0-9]{10,40})$/i);
  if (uriMatch) {
    return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
  }

  // If full web URL, strictly enforce valid Spotify hostname
  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      const hostname = url.hostname.toLowerCase();
      if (!['open.spotify.com', 'www.spotify.com', 'spotify.com'].includes(hostname)) {
        return null;
      }
      const segments = url.pathname.split('/').filter(Boolean);
      const entityIndex = segments.findIndex(s => ['playlist', 'album', 'track'].includes(s.toLowerCase()));
      if (entityIndex >= 0 && segments[entityIndex + 1]) {
        const type = segments[entityIndex].toLowerCase();
        const id = segments[entityIndex + 1].split('?')[0].split('#')[0];
        if (/^[a-zA-Z0-9]{10,40}$/.test(id)) {
          return { type, id };
        }
      }
    } catch {}
    return null;
  }

  // Bare ID (default to playlist if 10-40 alphanumeric chars)
  if (/^[a-zA-Z0-9]{10,40}$/.test(input)) {
    return { type: 'playlist', id: input };
  }

  return null;
}

function extractCoverImage(entity) {
  if (Array.isArray(entity?.images) && entity.images.length > 0) {
    const sorted = [...entity.images].sort((a, b) => (b.width || 0) - (a.width || 0));
    return sorted[0].url;
  }
  if (entity?.coverArt?.sources?.length > 0) {
    return entity.coverArt.sources[entity.coverArt.sources.length - 1].url;
  }
  if (Array.isArray(entity?.visualIdentity?.image) && entity.visualIdentity.image.length > 0) {
    const images = [...entity.visualIdentity.image].sort((a, b) => (b.maxWidth || 0) - (a.maxWidth || 0));
    return images[0].url;
  }
  return '';
}

/**
 * Obtains an official Spotify Web API access token via Client Credentials grant if configured
 */
export async function getSpotifyApiToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedSpotifyToken && Date.now() < tokenExpiresAt) {
    return cachedSpotifyToken;
  }

  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenRes.ok) return null;
    const data = await tokenRes.json();
    if (data?.access_token) {
      cachedSpotifyToken = data.access_token;
      tokenExpiresAt = Date.now() + Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000;
      return cachedSpotifyToken;
    }
  } catch (err) {
    console.warn('[SpotifyAPI] Token request failed, falling back to public extraction:', err.message);
  }
  return null;
}

/**
 * Fetches official Spotify metadata and tracks using Spotify's Web API with pagination
 */
async function fetchWithOfficialSpotifyApi(type, id, token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  };

  if (type === 'track') {
    const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, { headers });
    if (!res.ok) {
      if (res.status === 404) throw new Error('Spotify track not found (404). Please verify the link.');
      if (res.status === 429) throw new Error('Spotify rate limit reached (429). Please wait a moment and try again.');
      throw new Error(`Spotify track request failed (${res.status}).`);
    }
    const track = await res.json();
    const cover = track.album?.images?.[0]?.url || '';
    const durSec = Math.round((track.duration_ms || 0) / 1000) || 210;
    const minutes = Math.floor(durSec / 60);
    const seconds = durSec % 60;
    const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    const artistNames = (track.artists || []).map(a => a.name).filter(Boolean);
    const artist = artistNames.join(', ') || 'Unknown Artist';

    const formattedTrack = {
      id: `sp_${id}`,
      spotifyId: id,
      spotifyTrackId: id,
      spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${id}`,
      title: track.name || 'Untitled Track',
      artist,
      artists: artistNames.length > 0 ? artistNames : [artist],
      album: track.album?.name || 'Spotify Single',
      thumbnail: cover || NOIR_TRACK_ARTWORK_FALLBACK,
      cover,
      artwork: cover,
      duration: durSec,
      durationMs: track.duration_ms || (durSec * 1000),
      durationFormatted,
      isrc: track.external_ids?.isrc || null,
      audioPreviewUrl: track.preview_url || null,
      isPlayable: true,
      source: 'spotify_import'
    };

    return {
      id,
      entityType: 'track',
      title: track.name,
      description: `Single by ${artist}`,
      cover,
      trackCount: 1,
      tracks: [formattedTrack],
      source: 'spotify_import',
      sourceType: 'spotify',
      sourceUrl: `https://open.spotify.com/track/${id}`
    };
  }

  if (type === 'album') {
    const res = await fetch(`https://api.spotify.com/v1/albums/${id}`, { headers });
    if (!res.ok) {
      if (res.status === 404) throw new Error('Spotify album not found (404). Please verify the link.');
      if (res.status === 429) throw new Error('Spotify rate limit reached (429). Please wait a moment and try again.');
      throw new Error(`Spotify album request failed (${res.status}).`);
    }
    const album = await res.json();
    const cover = album.images?.[0]?.url || '';
    const albumArtist = (album.artists || []).map(a => a.name).join(', ') || 'Artist';

    let rawTracks = album.tracks?.items || [];
    let nextUrl = album.tracks?.next;
    const maxTracks = 500;

    // Follow pagination for large albums
    while (nextUrl && rawTracks.length < maxTracks) {
      try {
        const nextRes = await fetch(nextUrl, { headers });
        if (!nextRes.ok) break;
        const pageData = await nextRes.json();
        if (Array.isArray(pageData.items)) {
          rawTracks.push(...pageData.items);
        }
        nextUrl = pageData.next;
      } catch {
        break;
      }
    }

    const tracks = rawTracks.map((t, idx) => {
      const durSec = Math.round((t.duration_ms || 0) / 1000) || 210;
      const minutes = Math.floor(durSec / 60);
      const seconds = durSec % 60;
      const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      const trackId = t.id || `idx_${idx}`;
      const artistNames = (t.artists || []).map(a => a.name).filter(Boolean);
      const artist = artistNames.join(', ') || albumArtist;

      return {
        id: `sp_${trackId}`,
        spotifyId: trackId,
        spotifyTrackId: trackId,
        spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${trackId}`,
        title: t.name || 'Untitled Track',
        artist,
        artists: artistNames.length > 0 ? artistNames : [artist],
        album: album.name,
        thumbnail: cover || NOIR_TRACK_ARTWORK_FALLBACK,
        cover,
        artwork: cover,
        duration: durSec,
        durationMs: t.duration_ms || (durSec * 1000),
        durationFormatted,
        isrc: t.external_ids?.isrc || null,
        audioPreviewUrl: t.preview_url || null,
        isPlayable: true,
        source: 'spotify_import'
      };
    });

    return {
      id,
      entityType: 'album',
      title: album.name,
      description: `Album by ${albumArtist}`,
      cover,
      trackCount: tracks.length,
      tracks,
      source: 'spotify_import',
      sourceType: 'spotify',
      sourceUrl: `https://open.spotify.com/album/${id}`
    };
  }

  // Playlist
  const res = await fetch(`https://api.spotify.com/v1/playlists/${id}`, { headers });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Spotify playlist not found (404). Please verify the link.');
    if (res.status === 403) throw new Error('Spotify playlist is private. Make sure the playlist is public.');
    if (res.status === 429) throw new Error('Spotify rate limit reached (429). Please wait a moment and try again.');
    throw new Error(`Spotify playlist request failed (${res.status}).`);
  }

  const playlist = await res.json();
  const cover = playlist.images?.[0]?.url || '';
  let rawItems = playlist.tracks?.items || [];
  let nextUrl = playlist.tracks?.next;
  const maxTracks = 500;

  // Follow pagination for large playlists
  while (nextUrl && rawItems.length < maxTracks) {
    try {
      const nextRes = await fetch(nextUrl, { headers });
      if (!nextRes.ok) break;
      const pageData = await nextRes.json();
      if (Array.isArray(pageData.items)) {
        rawItems.push(...pageData.items);
      }
      nextUrl = pageData.next;
    } catch {
      break;
    }
  }

  const tracks = rawItems
    .map(entry => entry.track || entry.item || entry)
    .filter(t => t && t.name)
    .map((t, idx) => {
      const durSec = Math.round((t.duration_ms || 0) / 1000) || 210;
      const minutes = Math.floor(durSec / 60);
      const seconds = durSec % 60;
      const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      const trackId = t.id || `idx_${idx}`;
      const artistNames = (t.artists || []).map(a => a.name).filter(Boolean);
      const artist = artistNames.join(', ') || 'Unknown Artist';
      const trackCover = t.album?.images?.[0]?.url || cover;

      return {
        id: `sp_${trackId}`,
        spotifyId: trackId,
        spotifyTrackId: trackId,
        spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${trackId}`,
        title: t.name || 'Untitled Track',
        artist,
        artists: artistNames.length > 0 ? artistNames : [artist],
        album: t.album?.name || playlist.name,
        thumbnail: trackCover || NOIR_TRACK_ARTWORK_FALLBACK,
        cover: trackCover,
        artwork: trackCover,
        duration: durSec,
        durationMs: t.duration_ms || (durSec * 1000),
        durationFormatted,
        isrc: t.external_ids?.isrc || null,
        audioPreviewUrl: t.preview_url || null,
        isPlayable: true,
        source: 'spotify_import'
      };
    });

  return {
    id,
    entityType: 'playlist',
    title: playlist.name || 'Spotify Playlist',
    description: playlist.description || '',
    cover,
    trackCount: tracks.length,
    tracks,
    source: 'spotify_import',
    sourceType: 'spotify',
    sourceUrl: `https://open.spotify.com/playlist/${id}`
  };
}

/**
 * Public embed & oEmbed metadata extractor.
 * Provides resilient, zero-API-key imports for public playlists, albums, and tracks.
 */
async function fetchSpotifyEmbedData(type, id) {
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error(`Spotify ${type} not found (404). Please verify the link.`);
    if (response.status === 403) throw new Error(`Spotify ${type} is private or restricted. Make sure it is public.`);
    throw new Error(`Spotify embed page error (${response.status}). Make sure the content is public.`);
  }

  const html = await response.text();
  const mJson = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!mJson) {
    // Attempt oEmbed API fallback
    try {
      const oembedRes = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/${type}/${id}`);
      if (oembedRes.ok) {
        const odata = await oembedRes.json();
        return {
          id,
          entityType: type,
          title: odata.title || 'Spotify Music',
          description: '',
          cover: odata.thumbnail_url || '',
          trackCount: 1,
          tracks: [{
            id: `sp_${id}`,
            spotifyId: id,
            spotifyTrackId: id,
            spotifyUrl: `https://open.spotify.com/${type}/${id}`,
            title: odata.title || 'Spotify Track',
            artist: 'Spotify Artist',
            artists: ['Spotify Artist'],
            album: odata.title || 'Spotify Music',
            thumbnail: odata.thumbnail_url || NOIR_TRACK_ARTWORK_FALLBACK,
            cover: odata.thumbnail_url || '',
            artwork: odata.thumbnail_url || '',
            duration: 210,
            durationMs: 210000,
            durationFormatted: '3:30',
            source: 'spotify_import',
            isPlayable: true
          }],
          source: 'spotify_import',
          sourceType: 'spotify',
          sourceUrl: `https://open.spotify.com/${type}/${id}`
        };
      }
    } catch {}

    throw new Error(`Unable to extract Spotify ${type} metadata. Please verify that the link is public.`);
  }

  let data;
  try {
    data = JSON.parse(mJson[1]);
  } catch {
    throw new Error('Failed to parse Spotify embed data.');
  }

  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity) {
    throw new Error(`Spotify ${type} entity not found. Make sure the content is public.`);
  }

  const cover = extractCoverImage(entity);
  let tracks = [];
  let title = entity.name || entity.title || 'Spotify Import';
  let description = entity.description || '';

  if (type === 'track') {
    const durSec = Math.round((entity.duration || 0) / 1000) || 210;
    const minutes = Math.floor(durSec / 60);
    const seconds = durSec % 60;
    const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    const artistNames = Array.isArray(entity.artists) ? entity.artists.map(a => a.name).filter(Boolean) : [];
    const artist = artistNames.join(', ') || entity.subtitle || 'Artist';

    tracks = [{
      id: `sp_${id}`,
      spotifyId: id,
      spotifyTrackId: id,
      spotifyUrl: `https://open.spotify.com/track/${id}`,
      title: entity.title || entity.name || 'Untitled Track',
      artist,
      artists: artistNames.length > 0 ? artistNames : [artist],
      album: entity.name || 'Spotify Single',
      thumbnail: cover || NOIR_TRACK_ARTWORK_FALLBACK,
      cover,
      artwork: cover,
      duration: durSec,
      durationMs: entity.duration || (durSec * 1000),
      durationFormatted,
      audioPreviewUrl: entity.audioPreview?.url || null,
      isPlayable: entity.isPlayable !== false,
      source: 'spotify_import'
    }];

    description = `Single by ${artist}`;
  } else if (type === 'album') {
    const rawTracks = entity.trackList || [];
    const albumArtist = entity.subtitle || (Array.isArray(entity.artists) ? entity.artists.map(a => a.name).join(', ') : 'Artist');
    description = description || `Album by ${albumArtist}`;

    tracks = rawTracks.map((t, idx) => {
      const durSec = Math.round((t.duration || 0) / 1000) || 210;
      const minutes = Math.floor(durSec / 60);
      const seconds = durSec % 60;
      const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      const trackId = t.id || (t.uri ? t.uri.split(':').pop() : '') || `idx_${idx}`;
      const artist = t.subtitle || albumArtist;

      return {
        id: `sp_${trackId}`,
        spotifyId: trackId,
        spotifyTrackId: trackId,
        spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : '',
        title: t.title || 'Untitled Track',
        artist,
        artists: [artist],
        album: title,
        thumbnail: cover || NOIR_TRACK_ARTWORK_FALLBACK,
        cover,
        artwork: cover,
        duration: durSec,
        durationMs: t.duration || (durSec * 1000),
        durationFormatted,
        audioPreviewUrl: t.audioPreview?.url || null,
        isPlayable: t.isPlayable !== false,
        source: 'spotify_import'
      };
    });
  } else {
    // Playlist
    const rawTracks = entity.trackList || [];
    tracks = rawTracks.map((t, idx) => {
      const durSec = Math.round((t.duration || 0) / 1000) || 210;
      const minutes = Math.floor(durSec / 60);
      const seconds = durSec % 60;
      const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      const trackId = t.id || (t.uri ? t.uri.split(':').pop() : '') || `idx_${idx}`;
      const artist = t.subtitle || t.artist || 'Unknown Artist';

      return {
        id: `sp_${trackId}`,
        spotifyId: trackId,
        spotifyTrackId: trackId,
        spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : '',
        title: t.title || 'Untitled Track',
        artist,
        artists: [artist],
        album: entity.name || 'Spotify Playlist',
        thumbnail: cover || NOIR_TRACK_ARTWORK_FALLBACK,
        cover,
        artwork: cover,
        duration: durSec,
        durationMs: t.duration || (durSec * 1000),
        durationFormatted,
        audioPreviewUrl: t.audioPreview?.url || null,
        isPlayable: t.isPlayable !== false,
        source: 'spotify_import'
      };
    });
  }

  return {
    id,
    entityType: type,
    title,
    description,
    cover,
    trackCount: tracks.length,
    tracks,
    source: 'spotify_import',
    sourceType: 'spotify',
    sourceUrl: `https://open.spotify.com/${type}/${id}`
  };
}

/**
 * Unified Spotify metadata and track extractor.
 * Tries official Spotify Web API first if credentials are configured;
 * falls back automatically to public embed extraction.
 */
export async function fetchSpotifyEntityData(inputStr) {
  const parsed = parseSpotifyUrl(inputStr);
  if (!parsed) {
    throw new Error('Please enter a valid Spotify playlist, album, or track link or ID.');
  }

  const { type, id } = parsed;

  // 1. Try official Spotify Web API if client credentials are configured
  const token = await getSpotifyApiToken();
  if (token) {
    try {
      const officialData = await fetchWithOfficialSpotifyApi(type, id, token);
      if (officialData && officialData.tracks?.length > 0) {
        return officialData;
      }
    } catch (err) {
      console.warn('[SpotifyAPI] Official API call failed, falling back to public extraction:', err.message);
    }
  }

  // 2. Fallback to public embed extraction
  return fetchSpotifyEmbedData(type, id);
}

function sendJsonResponse(res, statusCode, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(payload);
  } else {
    res.statusCode = statusCode;
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(JSON.stringify(payload));
  }
}

/**
 * Backwards-compatible export for existing playlist tests & callers
 */
export async function scrapeSpotifyPlaylist(inputStr) {
  return fetchSpotifyEntityData(inputStr);
}

/**
 * API handler compatible with Vite dev server middleware and Vercel serverless functions
 */
export default async function handler(req, res) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') res.status(200).end();
    else { res.statusCode = 200; res.end(); }
    return;
  }

  try {
    let inputUrl = '';
    if (req.query?.url) {
      inputUrl = req.query.url;
    } else if (typeof req.url === 'string') {
      try {
        const parsed = new URL(req.url, 'http://localhost');
        inputUrl = parsed.searchParams.get('url') || '';
      } catch {}
    }

    if (!inputUrl) {
      sendJsonResponse(res, 400, { success: false, error: 'Missing "url" parameter in query string.' });
      return;
    }

    const entityData = await fetchSpotifyEntityData(inputUrl);
    const successPayload = {
      success: true,
      entityType: entityData.entityType,
      playlist: {
        id: entityData.id,
        title: entityData.title,
        description: entityData.description,
        cover: entityData.cover,
        trackCount: entityData.trackCount,
        tracks: entityData.tracks,
        source: 'spotify_import',
        sourceType: 'spotify',
        sourceUrl: entityData.sourceUrl
      },
      results: entityData.tracks
    };

    sendJsonResponse(res, 200, successPayload);
  } catch (err) {
    sendJsonResponse(res, 400, {
      success: false,
      error: err.message || 'Failed to import Spotify link. Please verify it is public.'
    });
  }
}
