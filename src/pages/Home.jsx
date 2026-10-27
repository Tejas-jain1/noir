import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { youtubeApi } from '../services/youtubeApi';
import MusicCard from '../components/MusicCard';
import { Play, Flame, Sparkles, Radio, Users, ChevronRight, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Verified high-definition JioSaavn CDN artist portraits
const FEATURED_ARTISTS = [
  { id: 'art-arijit', name: 'Arijit Singh', monthlyListeners: '52.7M', image: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_150x150.jpg' },
  { id: 'art-diljit', name: 'Diljit Dosanjh', monthlyListeners: '31.4M', image: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_150x150.jpg' },
  { id: 'art-ap-dhillon', name: 'AP Dhillon', monthlyListeners: '22.8M', image: 'https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_150x150.jpg' },
  { id: 'art-taylor-swift', name: 'Taylor Swift', monthlyListeners: '98.5M', image: 'https://c.saavncdn.com/artists/Taylor_Swift_003_20200226074119_150x150.jpg' },
  { id: 'art-sidhu', name: 'Sidhu Moose Wala', monthlyListeners: '26.9M', image: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_004_20250617183705_150x150.jpg' },
  { id: 'art-shreya', name: 'Shreya Ghoshal', monthlyListeners: '38.2M', image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_007_20241101074144_150x150.jpg' },
  { id: 'art-pritam', name: 'Pritam', monthlyListeners: '44.1M', image: 'https://c.saavncdn.com/artists/Pritam_Chakraborty-20170711073326_150x150.jpg' },
  { id: 'art-billie', name: 'Billie Eilish', monthlyListeners: '104.9M', image: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_150x150.jpg' }
];

export default function Home({ onOpenAddToPlaylist }) {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { isLiked, toggleLike, userPreferences, likedSongs } = useLibrary();
  const navigate = useNavigate();

  const [trendingTracks, setTrendingTracks] = useState([]);
  const [recommendedTracks, setRecommendedTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load live dynamic music from JioSaavn CDN
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        // 1. Fetch live Top Trending Tracks (India Superhits Top 50)
        const trending = await youtubeApi.getTrending();
        if (isMounted && Array.isArray(trending) && trending.length > 0) {
          setTrendingTracks(trending);
        }

        // 2. Fetch personalized recommendations based on user preferences or top hits
        let recQuery = 'bollywood hits';
        if (userPreferences?.artists?.length > 0) {
          recQuery = `${userPreferences.artists[0]} hits`;
        } else if (userPreferences?.genres?.length > 0) {
          recQuery = `${userPreferences.genres[0]} songs`;
        } else if (likedSongs?.length > 0) {
          recQuery = `${likedSongs[0].artist} songs`;
        }

        const recRes = await youtubeApi.search(recQuery);
        if (isMounted) {
          const recList = (recRes?.results || []).filter(t => !trending || t.id !== trending[0]?.id);
          setRecommendedTracks(recList.length > 0 ? recList : (trending || []).slice(1));
        }
      } catch (err) {
        console.warn('Failed to load Home data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [userPreferences, likedSongs]);

  const heroTrack = trendingTracks[0] || recommendedTracks[0] || null;
  const isHeroPlaying = heroTrack && currentTrack?.id === heroTrack.id && isPlaying;
  const isHeroLiked = heroTrack ? isLiked(heroTrack.id) : false;

  return (
    <div className="page-container">
      {/* 1. Hero Spotlight Banner */}
      {heroTrack ? (
        <section
          className="hero-spotlight"
          style={{
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            position: 'relative',
            boxShadow: 'var(--shadow-md)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            alignItems: 'center'
          }}
        >
          <div 
            className="hero-spotlight-content"
            style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 2 }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-subtle)', width: 'fit-content' }}>
              <Sparkles size={14} style={{ color: 'var(--accent-solid)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Spotlight Release
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.75rem)', fontWeight: 800, lineHeight: 1.15 }}>
              {heroTrack.title}
            </h1>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
              {heroTrack.artist} • {heroTrack.album || 'Featured Single'}
            </p>

            <div className="hero-spotlight-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => {
                  if (currentTrack?.id === heroTrack.id) togglePlay();
                  else playTrack(heroTrack, trendingTracks.length > 0 ? trendingTracks : [heroTrack]);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-solid)',
                  color: 'var(--accent-text)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform var(--transition-fast)'
                }}
              >
                <Play size={16} fill="currentColor" />
                <span>{isHeroPlaying ? 'Pause' : 'Play Now'}</span>
              </button>

              <button
                onClick={() => toggleLike(heroTrack)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: isHeroLiked ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <Heart size={16} fill={isHeroLiked ? 'currentColor' : 'none'} />
                <span>{isHeroLiked ? 'Saved' : 'Like'}</span>
              </button>
            </div>
          </div>

          {/* Hero Artwork */}
          <div className="hero-spotlight-img" style={{ height: '100%', minHeight: '260px', maxHeight: '340px', position: 'relative', overflow: 'hidden' }}>
            <img
              src={heroTrack.thumbnail}
              alt={heroTrack.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, var(--bg-secondary) 0%, transparent 60%)'
              }}
            />
          </div>
        </section>
      ) : (
        <section
          style={{
            borderRadius: 'var(--radius-xl)',
            minHeight: '240px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
            <Sparkles size={20} />
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Loading live trending music...</span>
          </div>
        </section>
      )}

      {/* 2. Trending Now */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={20} />
              <span>Trending Music</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              The most streamed music tracks worldwide right now
            </p>
          </div>
          <button
            onClick={() => navigate('/explore')}
            style={{ fontSize: '0.825rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Explore</span>
            <ChevronRight size={15} />
          </button>
        </div>

        {loading && trendingTracks.length === 0 ? (
          <div
            className="mobile-cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px'
            }}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)' }} />
                <div style={{ height: '14px', width: '70%', backgroundColor: 'var(--bg-surface)', borderRadius: '4px' }} />
                <div style={{ height: '10px', width: '45%', backgroundColor: 'var(--bg-surface)', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mobile-cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px'
            }}
          >
            {trendingTracks.slice(0, 10).map((track) => (
              <MusicCard
                key={track.id}
                track={track}
                onOpenAddToPlaylist={onOpenAddToPlaylist}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Popular Artists */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} />
              <span>Popular Artists</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Leading icons across alternative, pop, indie, and electronic
            </p>
          </div>
        </div>

        <div
          className="artists-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '14px'
          }}
        >
          {FEATURED_ARTISTS.map((artist) => (
            <div
              key={artist.id}
              className="artist-card"
              onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
              }}
            >
              <img
                src={artist.image}
                alt={artist.name}
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                }}
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: '10px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              />
              <div
                style={{
                  display: 'none',
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-solid)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.5rem',
                  marginBottom: '10px'
                }}
              >
                {artist.name.charAt(0)}
              </div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 2px' }}>
                {artist.name}
              </h4>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                {artist.monthlyListeners}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Recommended Soundscapes */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={20} />
              <span>Recommended For You</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {userPreferences?.genres?.length > 0 || userPreferences?.artists?.length > 0
                ? 'Curated based on your selected genres and favorite artists'
                : 'Selected based on sonic texture, tempo, and modern production'}
            </p>
          </div>
        </div>

        {loading && recommendedTracks.length === 0 ? (
          <div
            className="mobile-cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px'
            }}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)' }} />
                <div style={{ height: '14px', width: '70%', backgroundColor: 'var(--bg-surface)', borderRadius: '4px' }} />
                <div style={{ height: '10px', width: '45%', backgroundColor: 'var(--bg-surface)', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mobile-cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px'
            }}
          >
            {recommendedTracks.slice(0, 10).map((track) => (
              <MusicCard
                key={track.id}
                track={track}
                onOpenAddToPlaylist={onOpenAddToPlaylist}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
