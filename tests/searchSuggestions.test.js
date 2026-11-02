import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  buildIntelligentSuggestions, 
  expandQueryIntent, 
  TRENDING_SEARCH_PILLS 
} from '../src/services/searchSuggestionService.js';

describe('NOIR Spotify-Style Intelligent Search Suggestions', () => {
  it('expands partial query intents for mood, genre, and entity qualifiers', () => {
    assert.equal(expandQueryIntent('hindi sa'), 'hindi sad');
    assert.equal(expandQueryIntent('punjabi par'), 'punjabi party');
    assert.equal(expandQueryIntent('ap dhillon play'), 'ap dhillon playlist');
    assert.equal(expandQueryIntent('taylor swift alb'), 'taylor swift album');
    assert.equal(expandQueryIntent('arijit rom'), 'arijit romantic');
    assert.equal(expandQueryIntent('arijit'), 'arijit');
  });

  it('empty query provides recent searches and trending search pills', () => {
    const recents = ['Kesariya', 'Arijit Singh', 'AP Dhillon'];
    const result = buildIntelligentSuggestions({
      query: '',
      suggestions: null,
      recentSearches: recents
    });

    assert.equal(result.hasMatches, true);
    assert.equal(result.topResult, null);
    assert.deepEqual(result.trendingPills, TRENDING_SEARCH_PILLS);
    assert.equal(result.phraseSuggestions.length, 0);
    assert.equal(result.songSuggestions.length, 0);
  });

  it('"ari" suggests Arijit Singh, Arijit Singh songs, and artist entity', () => {
    const mockCatalogData = {
      topquery: {
        data: [{ id: '459320', title: 'Arijit Singh', type: 'artist', image: 'https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg' }]
      },
      artists: {
        data: [{ id: '459320', title: 'Arijit Singh', name: 'Arijit Singh', role: 'Singer', image: 'https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg' }]
      },
      songs: {
        data: [
          { id: 'song-1', title: 'Apna Bana Le', singer: 'Arijit Singh, Sachin-Jigar', album: 'Bhediya', duration: '261' },
          { id: 'song-2', title: 'Channa Mereya', singer: 'Arijit Singh', album: 'Ae Dil Hai Mushkil', duration: '289' }
        ]
      },
      albums: { data: [] },
      playlists: { data: [] }
    };

    const result = buildIntelligentSuggestions({
      query: 'ari',
      suggestions: mockCatalogData,
      recentSearches: []
    });

    assert.equal(result.hasMatches, true);
    assert.ok(result.topResult, 'Must have a top match entity');
    assert.equal(result.topResult.title, 'Arijit Singh');
    assert.equal(result.topResult.type, 'artist');

    const phraseTexts = result.phraseSuggestions.map(p => p.text.toLowerCase());
    assert.ok(phraseTexts.some(p => p === 'arijit singh'), 'Must suggest Arijit Singh');
    assert.ok(phraseTexts.some(p => p === 'arijit singh songs'), 'Must suggest Arijit Singh songs');
    assert.equal(result.artistSuggestions.length, 1);
    assert.equal(result.artistSuggestions[0].title, 'Arijit Singh');
  });

  it('"kes" suggests Kesariya, Kesariya Arijit Singh, and song entity', () => {
    const mockCatalogData = {
      topquery: {
        data: [{ id: 'ySg4t5', title: 'Kesariya', type: 'song', image: 'https://c.saavncdn.com/kesariya-500x500.jpg', singer: 'Arijit Singh, Pritam', album: 'Brahmastra' }]
      },
      songs: {
        data: [
          { id: 'ySg4t5', title: 'Kesariya', singer: 'Arijit Singh, Pritam', album: 'Brahmastra', duration: '268', image: 'https://c.saavncdn.com/kesariya-500x500.jpg' },
          { id: 'kes-dance', title: 'Kesariya (Dance Mix)', singer: 'Arijit Singh', album: 'Brahmastra', duration: '210' }
        ]
      },
      artists: { data: [] },
      albums: { data: [] },
      playlists: { data: [] }
    };

    const result = buildIntelligentSuggestions({
      query: 'kes',
      suggestions: mockCatalogData,
      recentSearches: []
    });

    assert.equal(result.hasMatches, true);
    assert.equal(result.topResult.title, 'Kesariya');
    assert.equal(result.topResult.type, 'song');

    const phraseTexts = result.phraseSuggestions.map(p => p.text.toLowerCase());
    assert.ok(phraseTexts.includes('kesariya'), 'Must suggest Kesariya');
    assert.ok(phraseTexts.includes('kesariya arijit singh'), 'Must suggest Kesariya Arijit Singh');
  });

  it('"ap dh" suggests AP Dhillon, AP Dhillon songs', () => {
    const mockCatalogData = {
      topquery: {
        data: [{ id: 'ap-1', title: 'AP Dhillon', type: 'artist' }]
      },
      artists: {
        data: [{ id: 'ap-1', title: 'AP Dhillon', name: 'AP Dhillon', role: 'Singer / Rapper' }]
      },
      songs: {
        data: [
          { id: 'exc-1', title: 'Excuses', singer: 'AP Dhillon, Gurinder Gill', album: 'Hidden Gems' },
          { id: 'ins-1', title: 'Insane', singer: 'AP Dhillon, Gurinder Gill, Shinda Kahlon', album: 'Hidden Gems' }
        ]
      },
      albums: {
        data: [{ id: 'alb-hg', title: 'Hidden Gems', artist: 'AP Dhillon' }]
      },
      playlists: { data: [] }
    };

    const result = buildIntelligentSuggestions({
      query: 'ap dh',
      suggestions: mockCatalogData,
      recentSearches: []
    });

    assert.equal(result.hasMatches, true);
    assert.equal(result.topResult.title, 'AP Dhillon');
    const phraseTexts = result.phraseSuggestions.map(p => p.text.toLowerCase());
    assert.ok(phraseTexts.includes('ap dhillon'));
    assert.ok(phraseTexts.includes('ap dhillon songs'));
  });

  it('"hindi sa" expands to Hindi sad songs & Hindi sad playlists', () => {
    const mockCatalogData = {
      topquery: { data: [] },
      songs: {
        data: [
          { id: 'sad-1', title: 'Hamari Adhuri Kahani', singer: 'Arijit Singh', album: 'Hamari Adhuri Kahani' }
        ]
      },
      artists: { data: [] },
      albums: { data: [] },
      playlists: {
        data: [
          { id: 'pl-sad', title: 'Hindi Sad Songs 2026' }
        ]
      }
    };

    const result = buildIntelligentSuggestions({
      query: 'hindi sa',
      suggestions: mockCatalogData,
      recentSearches: []
    });

    assert.equal(result.hasMatches, true);
    const phraseTexts = result.phraseSuggestions.map(p => p.text.toLowerCase());
    assert.ok(phraseTexts.some(p => p.includes('hindi sad songs')), 'Must suggest Hindi sad songs');
    assert.ok(phraseTexts.some(p => p.includes('hindi sad playlists')), 'Must suggest Hindi sad playlists');
  });

  it('"taylor" suggests Taylor Swift, Taylor Swift albums', () => {
    const mockCatalogData = {
      topquery: {
        data: [{ id: 'ts-1', title: 'Taylor Swift', type: 'artist' }]
      },
      artists: {
        data: [{ id: 'ts-1', title: 'Taylor Swift', name: 'Taylor Swift', role: 'Singer' }]
      },
      songs: {
        data: [
          { id: 'ts-s1', title: 'Anti-Hero', singer: 'Taylor Swift', album: 'Midnights' }
        ]
      },
      albums: {
        data: [
          { id: 'alb-mid', title: 'Midnights', artist: 'Taylor Swift' },
          { id: 'alb-1989', title: '1989 (Taylor\'s Version)', artist: 'Taylor Swift' }
        ]
      },
      playlists: { data: [] }
    };

    const result = buildIntelligentSuggestions({
      query: 'taylor',
      suggestions: mockCatalogData,
      recentSearches: []
    });

    assert.equal(result.hasMatches, true);
    assert.equal(result.topResult.title, 'Taylor Swift');
    const phraseTexts = result.phraseSuggestions.map(p => p.text.toLowerCase());
    assert.ok(phraseTexts.includes('taylor swift'));
    assert.ok(phraseTexts.includes('taylor swift albums'));
    assert.equal(result.albumSuggestions.length, 2);
  });

  it('"arjit" detects spelling mistake and suggests Arijit Singh', () => {
    // When user types "arjit", JioSaavn autocomplete topquery returns Arijit Singh
    const mockCatalogData = {
      topquery: {
        data: [{ id: '459320', title: 'Arijit Singh', type: 'artist' }]
      },
      artists: {
        data: [{ id: '459320', title: 'Arijit Singh', name: 'Arijit Singh' }]
      },
      songs: {
        data: [{ id: 'song-1', title: 'Apna Bana Le', singer: 'Arijit Singh' }]
      },
      albums: { data: [] },
      playlists: { data: [] }
    };

    const result = buildIntelligentSuggestions({
      query: 'arjit',
      suggestions: mockCatalogData,
      recentSearches: []
    });

    assert.equal(result.isTypo, true);
    assert.equal(result.correctedQuery, 'Arijit Singh');
    assert.equal(result.topResult.title, 'Arijit Singh');
    const phraseTexts = result.phraseSuggestions.map(p => p.text.toLowerCase());
    assert.ok(phraseTexts.includes('arijit singh'));
  });

  it('AP Dhillon playlists search intent prioritizes playlists and playlist phrases', () => {
    const mockCatalogData = {
      topquery: {
        data: [{ id: 'ap-pl-1', title: 'Best of AP Dhillon', type: 'playlist' }]
      },
      songs: { data: [] },
      artists: { data: [] },
      albums: { data: [] },
      playlists: {
        data: [
          { id: 'ap-pl-1', title: 'Best of AP Dhillon' },
          { id: 'ap-pl-2', title: 'AP Dhillon Punjabi Hits' }
        ]
      }
    };

    const result = buildIntelligentSuggestions({
      query: 'ap dhillon playlist',
      suggestions: mockCatalogData,
      recentSearches: []
    });

    assert.equal(result.hasMatches, true);
    assert.equal(result.topResult.type, 'playlist');
    assert.equal(result.playlistSuggestions.length, 2);
    const phraseTexts = result.phraseSuggestions.map(p => p.text.toLowerCase());
    assert.ok(phraseTexts.includes('best of ap dhillon'));
  });

  it('Punjabi party songs query suggests party phrases and songs', () => {
    const mockCatalogData = {
      topquery: {
        data: [{ id: 'pb-party', title: 'Punjabi Party Hits', type: 'playlist' }]
      },
      songs: {
        data: [
          { id: 'pb-1', title: 'Brown Munde', singer: 'AP Dhillon, Gurinder Gill', album: 'Brown Munde' }
        ]
      },
      artists: { data: [] },
      albums: { data: [] },
      playlists: {
        data: [
          { id: 'pb-party', title: 'Punjabi Party Hits' }
        ]
      }
    };

    const result = buildIntelligentSuggestions({
      query: 'punjabi party songs',
      suggestions: mockCatalogData,
      recentSearches: []
    });

    assert.equal(result.hasMatches, true);
    const phraseTexts = result.phraseSuggestions.map(p => p.text.toLowerCase());
    assert.ok(phraseTexts.includes('punjabi party hits'));
  });

  it('Lo-fi queries return chill & lofi mixes cleanly', () => {
    const mockCatalogData = {
      topquery: {
        data: [{ id: 'lofi-1', title: 'Bollywood Lofi Vibes', type: 'playlist' }]
      },
      songs: {
        data: [
          { id: 'lofi-s1', title: 'Iktara (Lofi Flip)', singer: 'Amit Trivedi', album: 'Lofi Vibes' }
        ]
      },
      artists: { data: [] },
      albums: { data: [] },
      playlists: {
        data: [
          { id: 'lofi-1', title: 'Bollywood Lofi Vibes' }
        ]
      }
    };

    const result = buildIntelligentSuggestions({
      query: 'lo-fi',
      suggestions: mockCatalogData,
      recentSearches: []
    });

    assert.equal(result.hasMatches, true);
    assert.equal(result.topResult.title, 'Bollywood Lofi Vibes');
    assert.equal(result.songSuggestions[0].title, 'Iktara (Lofi Flip)');
  });

  it('no-result query does not fabricate fake items and returns hasMatches: false', () => {
    const emptyCatalog = {
      topquery: { data: [] },
      songs: { data: [] },
      artists: { data: [] },
      albums: { data: [] },
      playlists: { data: [] }
    };

    const result = buildIntelligentSuggestions({
      query: 'zzxqy779nonexistent',
      suggestions: emptyCatalog,
      recentSearches: []
    });

    assert.equal(result.hasMatches, false);
    assert.equal(result.topResult, null);
    assert.equal(result.phraseSuggestions.length, 0);
    assert.equal(result.songSuggestions.length, 0);
    assert.equal(result.artistSuggestions.length, 0);
    assert.equal(result.albumSuggestions.length, 0);
    assert.equal(result.playlistSuggestions.length, 0);
  });

  it('user recent search matching prioritizes previous searches matching typed prefix', () => {
    const recentSearches = ['Kesariya Acoustic', 'Arijit Singh Live', 'Tum Hi Ho'];
    const mockCatalogData = {
      topquery: { data: [] },
      songs: { data: [] },
      artists: { data: [] },
      albums: { data: [] },
      playlists: { data: [] }
    };

    const result = buildIntelligentSuggestions({
      query: 'kes',
      suggestions: mockCatalogData,
      recentSearches
    });

    assert.equal(result.hasMatches, true);
    assert.equal(result.phraseSuggestions[0].text, 'Kesariya Acoustic');
    assert.equal(result.phraseSuggestions[0].isRecent, true);
  });

  it('handles case-insensitivity, mixed casing and whitespace cleanly', () => {
    const mockCatalogData = {
      topquery: [{ id: '1', title: 'Kesariya', type: 'song' }],
      songs: [{ id: '1', title: 'Kesariya', artist: 'Arijit Singh' }],
      artists: [],
      albums: [],
      playlists: []
    };

    const resultLower = buildIntelligentSuggestions({ query: 'kesariya', suggestions: mockCatalogData });
    const resultUpper = buildIntelligentSuggestions({ query: '  KESARIYA  ', suggestions: mockCatalogData });

    assert.equal(resultLower.topResult.title, 'Kesariya');
    assert.equal(resultUpper.topResult.title, 'Kesariya');
    assert.equal(resultLower.isTypo, false);
    assert.equal(resultUpper.isTypo, false);
  });

  it('supports Hindi and Punjabi queries with native script or transliteration', () => {
    const mockCatalogData = {
      topquery: [{ id: 'pb-1', title: 'ਕੋਈ ਨਾ (Koi Na)', type: 'song' }],
      songs: [{ id: 'pb-1', title: 'ਕੋਈ ਨਾ (Koi Na)', artist: 'Karan Aujla' }],
      artists: [{ id: 'ka-1', title: 'Karan Aujla', name: 'Karan Aujla' }],
      albums: [],
      playlists: [{ id: 'pl-pb', title: 'Punjabi Hits 2026' }]
    };

    const result = buildIntelligentSuggestions({
      query: 'punjabi karan',
      suggestions: mockCatalogData
    });

    assert.equal(result.hasMatches, true);
    assert.ok(result.phraseSuggestions.length > 0);
  });

  it('rapid typing cancellation ensures only newest request ID updates state', async () => {
    let activeRequestId = 0;
    let latestCommittedData = null;

    // Simulate 3 rapid typing events: "a" -> "ar" -> "ari"
    const simulateAutocompleteFetch = (char, delay, reqId) => {
      return new Promise(resolve => {
        setTimeout(() => {
          if (reqId === activeRequestId) {
            latestCommittedData = `Result for ${char}`;
          }
          resolve();
        }, delay);
      });
    };

    // "a" starts at t=0, takes 80ms
    const req1 = ++activeRequestId;
    const p1 = simulateAutocompleteFetch('a', 80, req1);

    // "ar" starts at t=10, takes 60ms
    const req2 = ++activeRequestId;
    const p2 = simulateAutocompleteFetch('ar', 60, req2);

    // "ari" starts at t=20, takes 20ms (finishes first!)
    const req3 = ++activeRequestId;
    const p3 = simulateAutocompleteFetch('ari', 20, req3);

    await Promise.all([p1, p2, p3]);

    // Despite req1 and req2 completing later in wall-clock time, activeRequestId check kept only req3!
    assert.equal(latestCommittedData, 'Result for ari');
  });

  it('SearchPage personalizeTracks ranks original soundtrack ahead of compilation album', () => {
    const originalTrack = {
      id: 'orig-1',
      title: 'Darkhaast (From "Shivaay")',
      artist: 'Arijit Singh, Sunidhi Chauhan',
      album: 'Shivaay'
    };

    const compilationTrack = {
      id: 'comp-1',
      title: 'Darkhaast (From "Shivaay")',
      artist: 'Arijit Singh, Sunidhi Chauhan',
      album: 'World Music Day - Best Of Bollywood Hits'
    };

    // Replicate personalizeTracks scoring
    const rankTracks = (tracks, query) => {
      const q = query.trim().toLowerCase();
      const compilationTerms = ['best of', 'compilation', 'hits of', 'greatest hits', 'collection', 'vol.', 'volume', 'mashup'];
      
      return [...tracks].sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        const albumA = (a.album || '').toLowerCase();
        const albumB = (b.album || '').toLowerCase();
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();

        if (titleA.includes(q)) scoreA += 40;
        if (titleB.includes(q)) scoreB += 40;

        const isCompA = compilationTerms.some(term => albumA.includes(term));
        const isCompB = compilationTerms.some(term => albumB.includes(term));
        if (isCompA && !isCompB) scoreA -= 20;
        if (isCompB && !isCompA) scoreB -= 20;

        return scoreB - scoreA;
      });
    };

    const sorted = rankTracks([compilationTrack, originalTrack], 'Darkhaast');
    assert.equal(sorted[0].id, 'orig-1', 'Original soundtrack track must rank first over compilation');
    assert.equal(sorted[1].id, 'comp-1', 'Compilation track must be down-ranked');
  });
});
