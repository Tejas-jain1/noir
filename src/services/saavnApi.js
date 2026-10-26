// JioSaavn CDN Audio & Metadata API Service
import CryptoJS from 'crypto-js';
import { MOCK_TRACKS, searchMockCatalog } from './mockCatalog';

const DES_KEY = '38346591';
const JIOSAAVN_PROXY_PATH = '/api/saavn';
const JIOSAAVN_DIRECT_URL = 'https://www.jiosaavn.com/api.php';

// Decodes HTML entities returned by API (e.g. &amp;, &#39;, &quot;)
export function decodeHtml(html) {
  if (!html) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

// Parses duration to seconds
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Decrypts JioSaavn encrypted media stream URL into high-quality direct CDN URL (320kbps)
export function decryptMediaUrl(encryptedUrl) {
  if (!encryptedUrl) return null;
  try {
    const decrypted = CryptoJS.DES.decrypt(
      {
        ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl)
      },
      CryptoJS.enc.Utf8.parse(DES_KEY),
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    const rawUrl = decrypted.toString(CryptoJS.enc.Utf8);
    if (!rawUrl || !rawUrl.startsWith('http')) return null;

    // Upgrade to 320kbps high definition audio if available
    return rawUrl.replace('_96.mp4', '_320.mp4').replace('_160.mp4', '_320.mp4');
  } catch (err) {
    console.warn('Failed to decrypt JioSaavn CDN URL:', err);
    return null;
  }
}

// Formats a raw JioSaavn song object into NOIR's standard track structure
export function formatSaavnTrack(item) {
  if (!item) return null;
  const moreInfo = item.more_info || {};

  // High quality artwork: replace 150x150 with 500x500
  let thumbnail = (item.image || '').replace('150x150', '500x500').replace('50x50', '500x500');
  if (!thumbnail || thumbnail.includes('default') || thumbnail.trim() === '') {
    thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  }

  // Extract artist name
  let artist = '';
  if (moreInfo.artistMap?.primary_artists?.length > 0) {
    artist = moreInfo.artistMap.primary_artists.map(a => a.name).join(', ');
  } else if (item.singers) {
    artist = item.singers;
  } else if (item.subtitle) {
    artist = item.subtitle.split('-')[0].trim();
  } else {
    artist = 'Unknown Artist';
  }

  // Album name
  const album = moreInfo.album || item.album || (item.subtitle && item.subtitle.includes('-') ? item.subtitle.split('-')[1].trim() : 'Single');

  // Duration
  const durationSec = parseInt(moreInfo.duration || item.duration || 210, 10);
  const minutes = Math.floor(durationSec / 60);
  const remainingSec = durationSec % 60;
  const durationFormatted = `${minutes}:${remainingSec < 10 ? '0' : ''}${remainingSec}`;

  // Decrypt 320kbps CDN audio stream URL
  const audioUrl = decryptMediaUrl(moreInfo.encrypted_media_url);

  // Clean title
  const title = decodeHtml(item.song || item.title || 'Unknown Title');

  return {
    id: item.id || `saavn-${Math.random().toString(36).substring(2, 9)}`,
    title,
    artist: decodeHtml(artist),
    album: decodeHtml(album),
    thumbnail,
    duration: durationSec,
    durationFormatted,
    audioUrl, // Direct 320kbps CDN stream from aac.saavncdn.com
    source: 'saavn_cdn',
    year: item.year || moreInfo.release_date || '',
    playCount: item.play_count || ''
  };
}

// Fetch helper with multi-tier proxy & fallback
async function fetchSaavnQuery(paramsString) {
  // 1. Try proxied endpoint (Vite dev proxy or Vercel production rewrite)
  try {
    const res = await fetch(`${JIOSAAVN_PROXY_PATH}?${paramsString}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Continue to fallback
  }

  // 2. Try direct fetch (if CORS allowed)
  try {
    const res = await fetch(`${JIOSAAVN_DIRECT_URL}?${paramsString}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Continue to fallback
  }

  // 3. Try AllOrigins CORS proxy fallback
  try {
    const targetUrl = `${JIOSAAVN_DIRECT_URL}?${paramsString}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('AllOrigins fallback failed:', err);
  }

  return null;
}

export const saavnApi = {
  // Search tracks using JioSaavn CDN
  search: async (query) => {
    if (!query || !query.trim()) {
      return {
        results: MOCK_TRACKS,
        source: 'curated',
        hasKey: true
      };
    }

    try {
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query.trim())}&n=25&p=1`;
      const data = await fetchSaavnQuery(params);

      if (data && data.results && data.results.length > 0) {
        const tracks = data.results
          .map(formatSaavnTrack)
          .filter(t => Boolean(t && t.audioUrl));

        if (tracks.length > 0) {
          return {
            results: tracks,
            source: 'saavn_cdn',
            hasKey: true
          };
        }
      }
    } catch (err) {
      console.warn('JioSaavn search query failed, using mock catalog fallback:', err);
    }

    // Fallback to internal catalog if network issues occur
    const filtered = searchMockCatalog(query);
    return {
      results: filtered,
      source: 'curated',
      hasKey: true
    };
  },

  // Get Top Trending Songs directly from Saavn CDN
  getTrending: async () => {
    try {
      // Query top trending hits from Saavn
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=trending%20top%20hits&n=20`;
      const data = await fetchSaavnQuery(params);

      if (data && data.results && data.results.length > 0) {
        const tracks = data.results
          .map(formatSaavnTrack)
          .filter(t => Boolean(t && t.audioUrl));

        if (tracks.length > 0) {
          return tracks;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch trending from Saavn, using curated catalog:', err);
    }

    return MOCK_TRACKS;
  },

  // Resolve direct 320kbps CDN audio stream for any track (e.g. from mock catalog or playlist)
  resolveAudioUrl: async (track) => {
    if (!track) return null;
    if (track.audioUrl) return track.audioUrl;

    try {
      const searchQuery = `${track.title} ${track.artist}`.trim();
      const params = `__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(searchQuery)}&n=5`;
      const data = await fetchSaavnQuery(params);

      if (data && data.results && data.results.length > 0) {
        const matched = data.results.find(s => s.more_info?.encrypted_media_url) || data.results[0];
        const audioUrl = decryptMediaUrl(matched.more_info?.encrypted_media_url);
        if (audioUrl) {
          track.audioUrl = audioUrl;
          return audioUrl;
        }
      }
    } catch (err) {
      console.warn('Failed to resolve Saavn audio stream for track:', track.title, err);
    }

    return null;
  }
};

// Also export as youtubeApi for seamless backward compatibility
export const youtubeApi = saavnApi;
