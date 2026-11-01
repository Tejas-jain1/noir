import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSaavnTrack, saavnApi } from '../src/services/saavnApi.js';
import { 
  getDeterministicTrackId, 
  getHighResArtworkUrl, 
  NOIR_TRACK_ARTWORK_FALLBACK, 
  NOIR_ARTIST_AVATAR_FALLBACK 
} from '../src/services/artworkUtils.js';

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

    const trackWithNoImage = formatSaavnTrack({
      id: 'test-no-img',
      song: 'Mystery Song',
      primary_artists: 'Ghost Artist',
      image: 'default'
    });

    assert.equal(trackWithNoImage.thumbnail, '', 'Never inject generic Unsplash photo when artwork is default');
    assert.ok(!trackWithNoImage.thumbnail.includes('unsplash'), 'Must not contain Unsplash URL');
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
    // Calling search with empty query returns structured empty response
    const emptyRes = await saavnApi.search('');
    assert.deepEqual(emptyRes.results, []);
    assert.equal(emptyRes.total, 0);
    assert.equal(emptyRes.page, 1);
    assert.equal(emptyRes.hasMore, false);
  });
});
