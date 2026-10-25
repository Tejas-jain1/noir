import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { youtubeApi } from '../services/youtubeApi';
import { MOCK_TRACKS, POPULAR_ARTISTS } from '../services/mockCatalog';
import MusicCard from '../components/MusicCard';
import { Play, Flame, Sparkles, Radio, Users, ChevronRight, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Home({ onOpenAddToPlaylist }) {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { recentlyPlayed, isLiked, toggleLike } = useLibrary();
  const navigate = useNavigate();

  const [trendingTracks, setTrendingTracks] = useState([]);

  // Load trending music
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const trending = await youtubeApi.getTrending();
        if (isMounted) {
          setTrendingTracks(trending);
        }
      } catch {
        if (isMounted) setTrendingTracks(MOCK_TRACKS);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  const heroTrack = trendingTracks[0] || MOCK_TRACKS[0];
  const isHeroPlaying = currentTrack?.id === heroTrack.id && isPlaying;
  const isHeroLiked = isLiked(heroTrack.id);

  return (
    <div style={{ padding: '24px 32px 80px', display: 'flex', flexDirection: 'column', gap: '40px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      {/* 1. Hero Spotlight Banner */}
      <section
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
        <div style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-subtle)', width: 'fit-content' }}>
            <Sparkles size={14} style={{ color: 'var(--accent-solid)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Spotlight Release
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', fontWeight: 800, lineHeight: 1.15 }}>
            {heroTrack.title}
          </h1>

          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
            {heroTrack.artist} • {heroTrack.album || 'Featured Single'}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px' }}>
            <button
              onClick={() => {
                if (currentTrack?.id === heroTrack.id) togglePlay();
                else playTrack(heroTrack, trendingTracks);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 28px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--accent-text)',
                fontWeight: 700,
                fontSize: '0.95rem',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform var(--transition-fast)'
              }}
            >
              <Play size={18} fill="currentColor" />
              <span>{isHeroPlaying ? 'Pause' : 'Play Now'}</span>
            </button>

            <button
              onClick={() => toggleLike(heroTrack)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                color: isHeroLiked ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
            >
              <Heart size={18} fill={isHeroLiked ? 'currentColor' : 'none'} />
              <span>{isHeroLiked ? 'Saved' : 'Like'}</span>
            </button>
          </div>
        </div>

        {/* Hero Artwork */}
        <div style={{ height: '100%', minHeight: '260px', maxHeight: '340px', position: 'relative', overflow: 'hidden' }}>
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

      {/* 2. Recently Played Quick Grid (if any) */}
      {recentlyPlayed.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Recently Played</span>
            </h2>
            <button
              onClick={() => navigate('/recent')}
              style={{ fontSize: '0.825rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>View All</span>
              <ChevronRight size={15} />
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px'
            }}
          >
            {recentlyPlayed.slice(0, 5).map((track) => (
              <MusicCard
                key={track.id}
                track={track}
                onOpenAddToPlaylist={onOpenAddToPlaylist}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. Trending Now */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={20} />
              <span>Trending Music</span>
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              The most streamed music tracks worldwide right now
            </p>
          </div>
          <button
            onClick={() => navigate('/explore')}
            style={{ fontSize: '0.825rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Explore More</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px'
          }}
        >
          {(trendingTracks.length > 0 ? trendingTracks : MOCK_TRACKS).slice(0, 10).map((track) => (
            <MusicCard
              key={track.id}
              track={track}
              onOpenAddToPlaylist={onOpenAddToPlaylist}
            />
          ))}
        </div>
      </section>

      {/* 4. Popular Artists */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} />
              <span>Popular Artists</span>
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Leading icons across alternative, pop, indie, and electronic
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '18px'
          }}
        >
          {POPULAR_ARTISTS.map((artist) => (
            <div
              key={artist.id}
              onClick={() => navigate(`/search?q=${encodeURIComponent(artist.name)}`)}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
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
                style={{
                  width: '110px',
                  height: '110px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: '12px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 4px' }}>
                {artist.name}
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {artist.monthlyListeners} monthly listeners
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Recommended Soundscapes */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={20} />
              <span>Recommended For You</span>
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Selected based on sonic texture, tempo, and modern production
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px'
          }}
        >
          {MOCK_TRACKS.slice(6, 14).map((track) => (
            <MusicCard
              key={track.id}
              track={track}
              onOpenAddToPlaylist={onOpenAddToPlaylist}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
