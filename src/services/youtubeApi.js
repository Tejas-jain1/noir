// YouTube Data API v3 service with resilient fallback

import { MOCK_TRACKS, searchMockCatalog } from './mockCatalog';
import { storage } from './storage';

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

// Decodes HTML entities returned by YouTube API (e.g. &amp;, &#39;, &quot;)
function decodeHtml(html) {
  if (!html) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

// Parses ISO 8601 duration string (e.g. PT3M45S) into seconds
function parseIsoDuration(isoDuration) {
  if (!isoDuration) return 180;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 180;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

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

export const youtubeApi = {
  getApiKey: () => {
    const settings = storage.getSettings();
    return settings.apiKey || import.meta.env.VITE_YOUTUBE_API_KEY || '';
  },

  search: async (query, customKey = null) => {
    const apiKey = customKey || youtubeApi.getApiKey();

    if (!query || !query.trim()) {
      return {
        results: MOCK_TRACKS,
        source: 'curated',
        hasKey: Boolean(apiKey)
      };
    }

    // If no API key is provided, search our rich catalog
    if (!apiKey) {
      const filtered = searchMockCatalog(query);
      return {
        results: filtered,
        source: 'mock',
        hasKey: false,
        message: 'Searching in-built curated music catalog. Add a YouTube API Key in Settings to search the full YouTube music library!'
      };
    }

    try {
      const url = `${YOUTUBE_SEARCH_URL}?part=snippet&maxResults=20&q=${encodeURIComponent(query + ' music audio')}&type=video&videoCategoryId=10&key=${apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const reason = errorData.error?.errors?.[0]?.reason || response.statusText;
        console.warn(`YouTube API returned ${response.status}: ${reason}. Falling back to internal catalog.`);
        
        const fallbackResults = searchMockCatalog(query);
        return {
          results: fallbackResults,
          source: 'fallback',
          hasKey: true,
          error: `YouTube API quota limit reached or key is invalid (${reason}). Showing catalog matches.`,
          fallback: true
        };
      }

      const data = await response.json();
      const videoIds = data.items.map(item => item.id.videoId).filter(Boolean);

      // Optionally fetch durations for richer UX
      let durationMap = {};
      if (videoIds.length > 0) {
        try {
          const detailsUrl = `${YOUTUBE_VIDEOS_URL}?part=contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`;
          const detailsRes = await fetch(detailsUrl);
          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            detailsData.items?.forEach(v => {
              durationMap[v.id] = {
                duration: parseIsoDuration(v.contentDetails?.duration),
                viewCount: v.statistics?.viewCount
              };
            });
          }
        } catch {
          // Duration fallback
        }
      }

      const tracks = data.items
        .filter(item => item.id?.videoId)
        .map(item => {
          const videoId = item.id.videoId;
          const details = durationMap[videoId] || {};
          const duration = details.duration || 210;
          const rawTitle = decodeHtml(item.snippet.title);
          
          // Split artist and track name if formatted like "Artist - Title"
          let artist = decodeHtml(item.snippet.channelTitle);
          let title = rawTitle;
          if (rawTitle.includes(' - ')) {
            const parts = rawTitle.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
          }

          // Clean up common YouTube video title clutter
          title = title.replace(/\s*[([](Official\s*(Video|Music Video|Audio|Lyric Video|HD|4K)?)[)\]]/gi, '').trim();

          return {
            id: videoId,
            title: title || rawTitle,
            artist: artist,
            channelTitle: decodeHtml(item.snippet.channelTitle),
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            duration: duration,
            durationFormatted: formatTime(duration),
            publishedAt: item.snippet.publishedAt,
            source: 'youtube'
          };
        });

      return {
        results: tracks,
        source: 'youtube',
        hasKey: true
      };
    } catch (err) {
      console.error('YouTube search network error:', err);
      return {
        results: searchMockCatalog(query),
        source: 'fallback',
        hasKey: true,
        error: 'Network error communicating with YouTube. Showing curated tracks.',
        fallback: true
      };
    }
  },

  getTrending: async (customKey = null) => {
    const apiKey = customKey || youtubeApi.getApiKey();

    if (!apiKey) {
      return MOCK_TRACKS;
    }

    try {
      const url = `${YOUTUBE_VIDEOS_URL}?part=snippet,contentDetails,statistics&chart=mostPopular&regionCode=US&videoCategoryId=10&maxResults=16&key=${apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return MOCK_TRACKS;
      }

      const data = await response.json();
      return (data.items || []).map(item => {
        const duration = parseIsoDuration(item.contentDetails?.duration);
        const rawTitle = decodeHtml(item.snippet.title);
        let artist = decodeHtml(item.snippet.channelTitle);
        let title = rawTitle;
        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }
        title = title.replace(/\s*[([](Official\s*(Video|Music Video|Audio|Lyric Video|HD|4K)?)[)\]]/gi, '').trim();

        return {
          id: item.id,
          title: title || rawTitle,
          artist: artist,
          channelTitle: decodeHtml(item.snippet.channelTitle),
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
          duration: duration,
          durationFormatted: formatTime(duration),
          source: 'youtube'
        };
      });
    } catch {
      return MOCK_TRACKS;
    }
  }
};
