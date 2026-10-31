import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { saavnApi } from '../services/saavnApi';
import { 
  getHomeRecommendations, 
  rotateHomeSession, 
  clearHomeFeedCache 
} from '../services/homeRecommendations';
import MusicCard from '../components/MusicCard';
import { 
  Play, 
  Pause, 
  Flame, 
  Sparkles, 
  Radio, 
  Users, 
  ChevronRight, 
  Heart, 
  RotateCw, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Home({ onOpenAddToPlaylist }) {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { 
    user, 
    isLiked, 
    toggleLike, 
    userPreferences, 
    likedSongs, 
    recentlyPlayed, 
    libraryOwnerId 
  } = useLibrary();
  const navigate = useNavigate();

  const [feedData, setFeedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [loadingArtist, setLoadingArtist] = useState(null);

  // Active identity scoped to logged-in user or guest
  const activeUserId = user?.id || libraryOwnerId || 'guest';

  // Load home recommendations
  const loadHomeFeed = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setIsRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await getHomeRecommendations({
        userId: activeUserId,
        userPreferences,
        likedSongs,
        recentlyPlayed,
        forceRefresh
      });

      setFeedData(data);
    } catch (err) {
      console.warn('Failed to load Home recommendations:', err);
      setError('Unable to load music recommendations. Please check your network.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeUserId, userPreferences, likedSongs, recentlyPlayed]);

  // Fetch whenever active user identity or preferences change
  useEffect(() => {
    loadHomeFeed(false);
  }, [loadHomeFeed]);

  // Manual rotation & fresh discovery trigger
  const handleRefresh = useCallback(() => {
    rotateHomeSession();
    clearHomeFeedCache(activeUserId);
    loadHomeFeed(true);
  }, [activeUserId, loadHomeFeed]);

  // Quick play for artist card
  const handlePlayArtist = useCallback(async (artist) => {
    if (!artist?.name) return;
    try {
      setLoadingArtist(artist.name);
      const res = await saavnApi.search(`${artist.name} hits`);
      if (res?.results && res.results.length > 0) {
        playTrack(res.results[0], res.results);
      } else {
        navigate(`/artist/${encodeURIComponent(artist.name)}`);
      }
    } catch (err) {
      console.warn('Failed to play artist songs:', err);
      navigate(`/artist/${encodeURIComponent(artist.name)}`);
    } finally {
      setLoadingArtist(null);
    }
  }, [navigate, playTrack]);

  const trendingTracks = feedData?.trendingTracks || [];
  const newReleases = feedData?.newReleases || [];
  const recommendedTracks = feedData?.recommendedTracks || [];
  const popularArtists = feedData?.popularArtists || [];
  const heroTrack = feedData?.heroTrack || recommendedTracks[0] || trendingTracks[0] || null;

  const isHeroPlaying = heroTrack && currentTrack?.id === heroTrack.id && isPlaying;
  const isHeroLiked = heroTrack ? isLiked(heroTrack.id) : false;

  // Personalized subtitle description
  const recommendationSubtitle = useMemo(() => {
    if (userPreferences?.artists?.length > 0 && userPreferences?.genres?.length > 0) {
      return `Curated for your love of ${userPreferences.artists[0]} and ${userPreferences.genres[0]}`;
    }
    if (userPreferences?.artists?.length > 0) {
      return `Spotlighting sounds inspired by ${userPreferences.artists[0]}`;
    }
    if (userPreferences?.genres?.length > 0) {
      return `Selected based on your ${userPreferences.genres[0]} preference`;
    }
    if (likedSongs?.length > 0) {
      return `Tuned to your recent liked tracks and favorite listening vibes`;
    }
    return 'Curated based on sonic texture, tempo, and modern production';
  }, [userPreferences, likedSongs]);

  // Reusable card skeleton loader
  const renderCardSkeletons = (count = 5) => (
    <div
      className="mobile-cards-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '16px'
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
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
          <div 
            style={{ 
              width: '100%', 
              aspectRatio: '1/1', 
              borderRadius: 'var(--radius-md)', 
              backgroundColor: 'var(--bg-surface)',
              animation: 'pulse 1.5s infinite ease-in-out'
            }} 
          />
          <div style={{ height: '14px', width: '70%', backgroundColor: 'var(--bg-surface)', borderRadius: '4px' }} />
          <div style={{ height: '10px', width: '45%', backgroundColor: 'var(--bg-surface)', borderRadius: '4px' }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="page-container">
      {/* Home Header with Quick Session Refresh */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '8px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {user ? `Welcome back, ${user.email?.split('@')[0]}` : 'Discover Music'}
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '2px 0 0', letterSpacing: '-0.02em' }}>
            {user ? 'Personalized For You' : 'Fresh Music & Radio'}
          </h1>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          title="Refresh recommendations & rotate feed"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: isRefreshing || loading ? 'not-allowed' : 'pointer',
            transition: 'background var(--transition-fast), transform var(--transition-fast)'
          }}
        >
          <RotateCw 
            size={14} 
            style={{ 
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              transform: isRefreshing ? 'rotate(360deg)' : 'none'
            }} 
          />
          <span>{isRefreshing ? 'Refreshing...' : 'Discover Fresh'}</span>
        </button>
      </div>

      {/* Error State Banner */}
      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            backgroundColor: 'rgba(255, 68, 68, 0.08)',
            border: '1px solid rgba(255, 68, 68, 0.25)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '20px',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} style={{ color: '#ff4444' }} />
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadHomeFeed(true)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Hero Spotlight Banner */}
      {loading && !heroTrack ? (
        <section
          style={{
            borderRadius: 'var(--radius-xl)',
            minHeight: '260px',
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
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Loading live music recommendations...</span>
          </div>
        </section>
      ) : heroTrack ? (
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
                Featured Spotlight
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
                type="button"
                onClick={() => {
                  if (currentTrack?.id === heroTrack.id) togglePlay();
                  else {
                    const heroQueue = [heroTrack, ...recommendedTracks, ...trendingTracks].filter(
                      (t, idx, arr) => arr.findIndex(x => x.id === t.id) === idx
                    );
                    playTrack(heroTrack, heroQueue);
                  }
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
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'transform var(--transition-fast)'
                }}
              >
                {isHeroPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                <span>{isHeroPlaying ? 'Pause' : 'Play Now'}</span>
              </button>

              <button
                type="button"
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
                  fontSize: '0.85rem',
                  cursor: 'pointer'
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
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';
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
      ) : null}

      {/* 2. Trending Now */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Flame size={20} />
              <span>Trending Now</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              The most streamed music tracks worldwide right now
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            style={{ 
              fontSize: '0.825rem', 
              color: 'var(--text-muted)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <span>Explore All</span>
            <ChevronRight size={15} />
          </button>
        </div>

        {loading && trendingTracks.length === 0 ? (
          renderCardSkeletons(5)
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
                playQueue={trendingTracks}
                onOpenAddToPlaylist={onOpenAddToPlaylist}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3. New Releases */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Sparkles size={20} />
              <span>New Releases</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Fresh music drops, albums, and singles from top record labels
            </p>
          </div>
        </div>

        {loading && newReleases.length === 0 ? (
          renderCardSkeletons(5)
        ) : (
          <div
            className="mobile-cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px'
            }}
          >
            {newReleases.slice(0, 10).map((track) => (
              <MusicCard
                key={track.id}
                track={track}
                playQueue={newReleases}
                onOpenAddToPlaylist={onOpenAddToPlaylist}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Recommended For You */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Radio size={20} />
              <span>Recommended For You</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {recommendationSubtitle}
            </p>
          </div>
        </div>

        {loading && recommendedTracks.length === 0 ? (
          renderCardSkeletons(5)
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
                playQueue={recommendedTracks}
                onOpenAddToPlaylist={onOpenAddToPlaylist}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. Popular Artists */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Users size={20} />
              <span>Popular Artists</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Leading icons across alternative, pop, indie, and electronic
            </p>
          </div>
        </div>

        {loading && popularArtists.length === 0 ? (
          <div
            className="artists-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '14px'
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{ width: '84px', height: '84px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)' }} />
                <div style={{ height: '12px', width: '60%', backgroundColor: 'var(--bg-surface)', borderRadius: '4px' }} />
                <div style={{ height: '10px', width: '40%', backgroundColor: 'var(--bg-surface)', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="artists-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '14px'
            }}
          >
            {popularArtists.map((artist) => {
              const isThisArtistLoading = loadingArtist === artist.name;
              return (
                <div
                  key={artist.id || artist.name}
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
                    position: 'relative',
                    transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
                  }}
                >
                  <div style={{ position: 'relative', width: '84px', height: '84px', marginBottom: '10px' }}>
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
                        fontSize: '1.5rem'
                      }}
                    >
                      {artist.name.charAt(0)}
                    </div>

                    {/* Quick Play Button for Artist */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayArtist(artist);
                      }}
                      disabled={isThisArtistLoading}
                      title={`Play ${artist.name}`}
                      style={{
                        position: 'absolute',
                        bottom: '0',
                        right: '0',
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-solid)',
                        color: 'var(--accent-text)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        cursor: 'pointer',
                        transition: 'transform var(--transition-fast)'
                      }}
                    >
                      {isThisArtistLoading ? (
                        <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Play size={13} fill="currentColor" />
                      )}
                    </button>
                  </div>

                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 2px' }}>
                    {artist.name}
                  </h4>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    {artist.monthlyListeners || 'Artist'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. Recently Played */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Clock size={20} />
              <span>Recently Played</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Jump back into your recent listening flow
            </p>
          </div>
          {recentlyPlayed && recentlyPlayed.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/recently-played')}
              style={{ 
                fontSize: '0.825rem', 
                color: 'var(--text-muted)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <span>View All</span>
              <ChevronRight size={15} />
            </button>
          )}
        </div>

        {recentlyPlayed && recentlyPlayed.length > 0 ? (
          <div
            className="mobile-cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px'
            }}
          >
            {recentlyPlayed.slice(0, 10).map((track) => (
              <MusicCard
                key={track.id}
                track={track}
                playQueue={recentlyPlayed}
                onOpenAddToPlaylist={onOpenAddToPlaylist}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.875rem'
            }}
          >
            <span>No recently played tracks yet. Play any track above to begin your listening history.</span>
          </div>
        )}
      </section>
    </div>
  );
}
