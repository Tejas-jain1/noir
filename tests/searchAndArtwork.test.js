import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSaavnTrack, saavnApi } from '../src/services/saavnApi.js';
import { 
  getDeterministicTrackId, 
  getHighResArtworkUrl, 
  extractOfficialArtwork,
  getArtworkCacheKey,
  ArtworkCache,
  getTrackFallbackArtwork,
  getArtistFallbackAvatar,
  NOIR_TRACK_ARTWORK_FALLBACK, 
  NOIR_ARTIST_AVATAR_FALLBACK,
  extractOriginalFilmOrAlbum,
  isCompilationAlbum,
  cleanCanonicalTrackTitle
} from '../src/services/artworkUtils.js';
import { MOCK_TRACKS, POPULAR_ARTISTS } from '../src/services/mockCatalog.js';
import { FEATURED_ARTISTS_POOL, diversifyFeedByArtwork } from '../src/services/homeRecommendations.js';

describe('NOIR Search Coverage & Correct Song Artwork', () => {
  it('generates deterministic stable track IDs without Math.random()', () => {
    const item1 = {
      id: 'song123',
      title: 'Jhol',
      primary_artists: 'Maanu'
    };
    const id1 = getDeterministicTrackId(item1);
    assert.equal(id1, 'song123');

    // Without item.id, must be 100% deterministic from metadata
    const itemWithoutIdA = {
      title: 'Alfaaz',
      song: 'Alfaaz',
      primary_artists: 'Abhijay Sharma',
      album: 'Izhaar'
    };
    const itemWithoutIdB = {
      title: 'Alfaaz',
      song: 'Alfaaz',
      primary_artists: 'Abhijay Sharma',
      album: 'Izhaar'
    };

    const idA = getDeterministicTrackId(itemWithoutIdA);
    const idB = getDeterministicTrackId(itemWithoutIdB);
    assert.ok(idA.startsWith('saavn-track-'));
    assert.equal(idA, idB, 'Track IDs for same metadata must be identical across renders');
  });

  it('extracts real original artwork and upgrades to 500x500 high-res CDN URL', () => {
    const rawCdnUrl = 'http://c.saavncdn.com/935/Jhol-Different-Version-Urdu-2025-150x150.jpg';
    const upgraded = getHighResArtworkUrl(rawCdnUrl);
    assert.equal(upgraded, 'https://c.saavncdn.com/935/Jhol-Different-Version-Urdu-2025-500x500.jpg');

    const raw50Url = 'https://c.saavncdn.com/023/Alfaaz-Punjabi-2000-50x50.jpg';
    const upgraded50 = getHighResArtworkUrl(raw50Url);
    assert.equal(upgraded50, 'https://c.saavncdn.com/023/Alfaaz-Punjabi-2000-500x500.jpg');
  });

  it('rejects default and empty placeholders without injecting generic photos', () => {
    assert.equal(getHighResArtworkUrl(''), null);
    assert.equal(getHighResArtworkUrl(null), null);
    assert.equal(getHighResArtworkUrl('https://c.saavncdn.com/default.jpg'), null);
    assert.equal(getHighResArtworkUrl('https://c.saavncdn.com/artists/artist_150x150.png'), null);
    assert.equal(getHighResArtworkUrl('https://www.jiosaavn.com/_i/3.0/artist-default-music.png'), null);
    assert.equal(getHighResArtworkUrl('https://www.jiosaavn.com/_i/3.0/album-default-music.png'), null);

    const trackWithNoImage = formatSaavnTrack({
      id: 'test-no-img',
      song: 'Mystery Song',
      primary_artists: 'Ghost Artist',
      image: 'default'
    });

    assert.equal(trackWithNoImage.thumbnail, '', 'Never inject generic Unsplash photo when artwork is default');
    assert.ok(!trackWithNoImage.thumbnail.includes('unsplash'), 'Must not contain Unsplash URL');
  });

  it('extractOfficialArtwork checks image hierarchy without returning placeholders', () => {
    // When item.image is a default placeholder but more_info has album_image
    const itemWithFallback = {
      id: 'track-fb-1',
      image: 'https://www.jiosaavn.com/_i/3.0/album-default-music.png',
      more_info: {
        album_image: 'https://c.saavncdn.com/475/Dhurandhar-Hindi-2025-150x150.jpg'
      }
    };
    const extracted = extractOfficialArtwork(itemWithFallback);
    assert.equal(extracted, 'https://c.saavncdn.com/475/Dhurandhar-Hindi-2025-500x500.jpg');

    // When both are empty
    assert.equal(extractOfficialArtwork({}), '');
  });

  it('getArtworkCacheKey generates unique keys based on track identity, album, and image', () => {
    const key1 = getArtworkCacheKey({ id: 'track-1', albumId: 'alb-1', thumbnail: 'https://c.saavncdn.com/1.jpg' });
    const key2 = getArtworkCacheKey({ id: 'track-2', albumId: 'alb-1', thumbnail: 'https://c.saavncdn.com/1.jpg' });
    const key3 = getArtworkCacheKey({ id: 'track-1', albumId: 'alb-2', thumbnail: 'https://c.saavncdn.com/2.jpg' });

    assert.notEqual(key1, key2, 'Distinct tracks must have different cache keys');
    assert.notEqual(key1, key3, 'Different album/image must change cache key');
    assert.equal(key1, getArtworkCacheKey({ id: 'track-1', albumId: 'alb-1', thumbnail: 'https://c.saavncdn.com/1.jpg' }), 'Identical input must produce identical key');
  });

  it('ArtworkCache caches valid URLs and tracks broken images', () => {
    const testKey = 'test_track_123';
    const testUrl = 'https://c.saavncdn.com/475/test-500x500.jpg';

    ArtworkCache.set(testKey, testUrl);
    assert.equal(ArtworkCache.get(testKey), testUrl);

    ArtworkCache.markBroken(testUrl);
    assert.equal(ArtworkCache.isBroken(testUrl), true);
    assert.equal(ArtworkCache.isBroken('https://c.saavncdn.com/valid.jpg'), false);
  });

  it('generates distinct dynamic SVG initial fallbacks for different songs and artists', () => {
    const svgTumHiHo = getTrackFallbackArtwork('Tum Hi Ho', 'Arijit Singh');
    const svgKesariya = getTrackFallbackArtwork('Kesariya', 'Arijit Singh');
    const svgDhurandhar = getTrackFallbackArtwork('Dhurandhar', 'Shashwat');

    assert.ok(svgTumHiHo.startsWith('data:image/svg+xml,'));
    assert.ok(svgTumHiHo.includes('%3ET%3C/text%3E'), 'Tum Hi Ho must display T');
    assert.ok(svgKesariya.includes('%3EK%3C/text%3E'), 'Kesariya must display K');
    assert.ok(svgDhurandhar.includes('%3ED%3C/text%3E'), 'Dhurandhar must display D');
    assert.notEqual(svgTumHiHo, svgKesariya, 'Different tracks must not have identical fallback SVGs');

    const artistA = getArtistFallbackAvatar('Arijit Singh');
    const artistD = getArtistFallbackAvatar('Diljit Dosanjh');
    assert.ok(artistA.includes('%3EA%3C/text%3E'));
    assert.ok(artistD.includes('%3ED%3C/text%3E'));
    assert.notEqual(artistA, artistD);
  });

  it('formats real JioSaavn items preserving original artwork and 320kbps audio', () => {
    const mockSaavnItem = {
      id: '2fvrfX9_',
      title: 'Jhol (Different Version)',
      subtitle: 'Mahin 31 ft. Alayna - Jhol (Different Version)',
      image: 'https://c.saavncdn.com/935/Jhol-Different-Version-Urdu-2025-20250609185707-150x150.jpg',
      language: 'urdu',
      year: '2025',
      more_info: {
        album: 'Jhol (Different Version)',
        encrypted_media_url: 'ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDynNIiq31ieAWRdMWpjxwQxtFMVO1xwhOAQ4HcwNIVEtp0gs8CgoeCORw7tS9a8Gtq',
        duration: '219',
        artistMap: {
          primary_artists: [{ id: '11439975', name: 'Mahin 31' }]
        }
      }
    };

    const formatted = formatSaavnTrack(mockSaavnItem);
    assert.equal(formatted.id, '2fvrfX9_');
    assert.equal(formatted.title, 'Jhol (Different Version)');
    assert.equal(formatted.artist, 'Mahin 31');
    assert.equal(formatted.thumbnail, 'https://c.saavncdn.com/935/Jhol-Different-Version-Urdu-2025-20250609185707-500x500.jpg');
    assert.ok(formatted.audioUrl.startsWith('https://aac.saavncdn.com/'), 'Audio stream must be valid 320kbps CDN URL');
    assert.ok(formatted.audioUrl.endsWith('_320.mp4'));
  });

  it('provides valid self-contained SVG fallback data URIs in NOIR aesthetic', () => {
    assert.ok(NOIR_TRACK_ARTWORK_FALLBACK.startsWith('data:image/svg+xml,'));
    assert.ok(NOIR_ARTIST_AVATAR_FALLBACK.startsWith('data:image/svg+xml,'));

    // Check that SVG defines square viewBox for 1:1 aspect ratio
    assert.ok(NOIR_TRACK_ARTWORK_FALLBACK.includes("viewBox='0 0 100 100'"));
    assert.ok(NOIR_ARTIST_AVATAR_FALLBACK.includes("viewBox='0 0 100 100'"));
  });

  it('supports pagination parameters in saavnApi.search', async () => {
    const emptyRes = await saavnApi.search('');
    assert.deepEqual(emptyRes.results, []);
    assert.equal(emptyRes.total, 0);
    assert.equal(emptyRes.page, 1);
    assert.equal(emptyRes.hasMore, false);
  });

  it('diversifyFeedByArtwork prevents multiple tracks from the same album from clustering in front', () => {
    const testTracks = [
      { id: '1', title: 'Song 1', album: 'Best of 2025', thumbnail: 'https://c.saavncdn.com/best.jpg' },
      { id: '2', title: 'Song 2', album: 'Best of 2025', thumbnail: 'https://c.saavncdn.com/best.jpg' },
      { id: '3', title: 'Song 3', album: 'Best of 2025', thumbnail: 'https://c.saavncdn.com/best.jpg' },
      { id: '4', title: 'Song 4', album: 'Best of 2025', thumbnail: 'https://c.saavncdn.com/best.jpg' },
      { id: '5', title: 'Song 5', album: 'Other Album A', thumbnail: 'https://c.saavncdn.com/other1.jpg' },
      { id: '6', title: 'Song 6', album: 'Other Album B', thumbnail: 'https://c.saavncdn.com/other2.jpg' },
      { id: '7', title: 'Song 7', album: 'Other Album C', thumbnail: 'https://c.saavncdn.com/other3.jpg' }
    ];

    const diversified = diversifyFeedByArtwork(testTracks, { maxPerAlbum: 2 });
    assert.equal(diversified.length, testTracks.length, 'Must preserve all tracks');

    // First 5 tracks must not have more than 2 from 'Best of 2025'
    const top5BestCount = diversified.slice(0, 5).filter(t => t.album === 'Best of 2025').length;
    assert.ok(top5BestCount <= 2, `Expected at most 2 tracks from Best of 2025 in top 5, got ${top5BestCount}`);
  });

  it('verifies MOCK_TRACKS and POPULAR_ARTISTS contain zero Unsplash URLs', () => {
    for (const track of MOCK_TRACKS) {
      assert.ok(!track.thumbnail.includes('unsplash.com'), `Mock track ${track.title} must not use Unsplash photo`);
      assert.ok(track.thumbnail.startsWith('https://c.saavncdn.com/'), `Mock track ${track.title} must use official JioSaavn CDN URL`);
    }

    for (const artist of POPULAR_ARTISTS) {
      assert.ok(!artist.image.includes('unsplash.com'), `Popular artist ${artist.name} must not use Unsplash photo`);
      assert.ok(artist.image.startsWith('https://c.saavncdn.com/'), `Popular artist ${artist.name} must use official JioSaavn CDN URL`);
    }
  });

  it('verifies FEATURED_ARTISTS_POOL contains zero Unsplash URLs and uses official CDN portraits', () => {
    assert.equal(FEATURED_ARTISTS_POOL.length, 15);
    for (const artist of FEATURED_ARTISTS_POOL) {
      assert.ok(!artist.image.includes('unsplash.com'), `Featured artist ${artist.name} must not use Unsplash photo`);
      assert.ok(artist.image.startsWith('https://c.saavncdn.com/artists/'), `Featured artist ${artist.name} must use official JioSaavn portrait`);
    }
  });
  it('extractOriginalFilmOrAlbum accurately extracts film names from title tags', () => {
    assert.equal(extractOriginalFilmOrAlbum('Darkhaast (From "Shivaay")'), 'Shivaay');
    assert.equal(extractOriginalFilmOrAlbum('Darkhaast (From "Shivaay") (feat. Arijit Singh, Sunidhi Chauhan)'), 'Shivaay');
    assert.equal(extractOriginalFilmOrAlbum('Tum Hi Ho (From "Aashiqui 2")'), 'Aashiqui 2');
    assert.equal(extractOriginalFilmOrAlbum('Channa Mereya (From Ae Dil Hai Mushkil)'), 'Ae Dil Hai Mushkil');
    assert.equal(extractOriginalFilmOrAlbum('Tere Hawaale [From "Laal Singh Chaddha"]'), 'Laal Singh Chaddha');
    assert.equal(extractOriginalFilmOrAlbum('Apna Bana Le'), null);
    assert.equal(cleanCanonicalTrackTitle('Darkhaast (From "Shivaay")'), 'Darkhaast');
    assert.equal(cleanCanonicalTrackTitle('Tum Hi Ho (From "Aashiqui 2")'), 'Tum Hi Ho');
  });

  it('isCompilationAlbum detects repackaged compilation albums vs original film releases', () => {
    assert.equal(isCompilationAlbum('World Music Day - Best Of Bollywood Hits', 'Darkhaast (From "Shivaay")'), true);
    assert.equal(isCompilationAlbum('Arijit Romantic Hits', 'Darkhaast (From "Shivaay")'), true);
    assert.equal(isCompilationAlbum('Shivaay', 'Darkhaast (From "Shivaay")'), false);
    assert.equal(isCompilationAlbum('Romantic Classics Hits', 'Apna Bana Le'), true);
    assert.equal(isCompilationAlbum('Bhediya', 'Apna Bana Le'), false);
  });

  it('regression: Darkhaast compilation track resolves canonical Shivaay album artwork for player', async () => {
    // 1. Raw API response shape as returned by JioSaavn for yZxYu9ei
    const rawApiItem = {
      id: 'yZxYu9ei',
      song: 'Darkhaast (From "Shivaay")',
      album: 'World Music Day - Best Of Bollywood Hits',
      albumid: '77211919',
      image: 'https://c.saavncdn.com/179/World-Music-Day-Best-Of-Bollywood-Hits-Hindi-2026-20260622111029-150x150.jpg',
      duration: '374',
      primary_artists: 'Sayeed Quadri, Mithoon, Sunidhi Chauhan, Arijit Singh',
      encrypted_media_url: 'dummy'
    };

    // 2. Initial format yields the raw API compilation artwork
    const formatted = formatSaavnTrack(rawApiItem);
    assert.equal(formatted.title, 'Darkhaast (From "Shivaay")');
    assert.equal(formatted.artist, 'Sayeed Quadri, Mithoon, Sunidhi Chauhan, Arijit Singh');
    assert.equal(formatted.duration, 374);
    assert.equal(formatted.durationFormatted, '6:14');

    // 3. Resolve canonical artwork mapping
    const resolved = await saavnApi.resolveCanonicalArtwork(formatted);
    assert.ok(resolved, 'Canonical artwork must be resolved');
    assert.equal(resolved.album, 'Shivaay', 'Canonical album must be Shivaay instead of compilation');
    assert.equal(
      resolved.thumbnail,
      'https://c.saavncdn.com/550/Shivaay4-Hindi-2016-500x500.jpg',
      'Canonical thumbnail must be the authentic Shivaay album artwork'
    );

    // 4. Verify getSongDetails automatically returns canonical Shivaay album artwork
    const fullTrack = await saavnApi.getSongDetails('yZxYu9ei');
    assert.ok(fullTrack);
    assert.equal(fullTrack.album, 'Shivaay');
    assert.equal(fullTrack.thumbnail, 'https://c.saavncdn.com/550/Shivaay4-Hindi-2016-500x500.jpg');

    // 5. Verify the player receives the exact official artwork URL
    const playerTrackState = {
      ...fullTrack,
      thumbnail: resolved.thumbnail,
      album: resolved.album
    };
    assert.equal(playerTrackState.thumbnail, 'https://c.saavncdn.com/550/Shivaay4-Hindi-2016-500x500.jpg');
    assert.ok(!playerTrackState.thumbnail.includes('World-Music-Day'), 'Player must never show compilation cover');
  });
});
