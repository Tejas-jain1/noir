export async function scrapeSpotifyPlaylist(inputStr) {
  if (!inputStr || typeof inputStr !== 'string') {
    throw new Error('Please provide a valid Spotify playlist URL or ID.');
  }

  const match = inputStr.match(/playlist[/:]+([a-zA-Z0-9]+)/);
  const pid = match ? match[1] : inputStr.trim().split('?')[0].split('/').pop();

  if (!pid) {
    throw new Error('Could not parse Spotify playlist ID.');
  }

  const embedUrl = `https://open.spotify.com/embed/playlist/${pid}`;
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`Spotify embed page error (status ${response.status}). Make sure the playlist is public.`);
  }

  const html = await response.text();
  const mJson = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!mJson) {
    throw new Error('Unable to extract Spotify metadata. Please verify that the playlist is public.');
  }

  let data;
  try {
    data = JSON.parse(mJson[1]);
  } catch (err) {
    throw new Error('Failed to parse Spotify embed JSON data.');
  }

  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity) {
    throw new Error('Spotify playlist entity not found. Make sure the playlist is public.');
  }

  const title = entity.name || 'Imported Spotify Playlist';
  const coverSources = entity.coverArt?.sources || [];
  const cover = coverSources.length > 0 ? coverSources[coverSources.length - 1].url : '';
  const rawTracks = entity.trackList || [];

  const tracks = rawTracks.map((t, idx) => {
    const durSec = Math.round((t.duration || 0) / 1000) || 210;
    const minutes = Math.floor(durSec / 60);
    const seconds = durSec % 60;
    const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    const trackId = t.id || (t.uri ? t.uri.split(':').pop() : '') || `idx_${idx}`;

    return {
      id: `sp_${trackId}`,
      spotifyId: trackId,
      spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : '',
      title: t.title || 'Untitled Track',
      artist: t.subtitle || t.artist || 'Unknown Artist',
      album: entity.name || 'Spotify Playlist',
      thumbnail: cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
      cover: cover,
      duration: durSec,
      durationFormatted: durationFormatted,
      audioPreviewUrl: t.audioPreview?.url || null,
      isPlayable: t.isPlayable !== false,
      source: 'spotify_import'
    };
  });

  return {
    id: pid,
    title,
    description: entity.description || '',
    cover,
    trackCount: tracks.length,
    tracks
  };
}

export default async function handler(req, res) {
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    if (res.status) res.status(200).end();
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
      const errPayload = { success: false, error: 'Missing "url" parameter in query string.' };
      if (res.status) res.status(400).json(errPayload);
      else {
        res.statusCode = 400;
        res.setHeader?.('Content-Type', 'application/json');
        res.end(JSON.stringify(errPayload));
      }
      return;
    }

    const playlistData = await scrapeSpotifyPlaylist(inputUrl);
    const successPayload = {
      success: true,
      playlist: {
        id: playlistData.id,
        title: playlistData.title,
        description: playlistData.description,
        cover: playlistData.cover,
        trackCount: playlistData.trackCount,
        tracks: playlistData.tracks,
        source: 'spotify_import'
      },
      results: playlistData.tracks
    };

    if (res.status) {
      res.status(200).json(successPayload);
    } else {
      res.statusCode = 200;
      res.setHeader?.('Content-Type', 'application/json');
      res.end(JSON.stringify(successPayload));
    }
  } catch (err) {
    const errPayload = {
      success: false,
      error: err.message || 'Failed to import Spotify playlist'
    };
    if (res.status) {
      res.status(500).json(errPayload);
    } else {
      res.statusCode = 500;
      res.setHeader?.('Content-Type', 'application/json');
      res.end(JSON.stringify(errPayload));
    }
  }
}
