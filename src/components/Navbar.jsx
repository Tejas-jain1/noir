import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { saavnApi } from '../services/saavnApi';
import { storage } from '../services/storage';
import SearchDropdown, { POPULAR_SEARCHES } from './SearchDropdown';
import { 
  Search, 
  Sun, 
  Moon, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Menu,
  ShieldCheck,
  Disc,
  LogOut,
  LogIn,
  X,
  Loader2
} from 'lucide-react';

export default function Navbar({ onOpenSettings, onToggleMobileMenu, onOpenAuth }) {
  const { toggleTheme, isDark } = useTheme();
  const { user, signOut } = useLibrary();
  const { playTrack } = usePlayer();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState({ songs: [], artists: [], albums: [], topResult: null });
  const [recentSearches, setRecentSearches] = useState(() => storage.getRecentSearches());
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isSearchPage = location.pathname === '/search';

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Sync recent searches on storage change or window focus
  useEffect(() => {
    const handleStorage = () => {
      setRecentSearches(storage.getRecentSearches());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Debounced live suggestions fetching (300ms)
  useEffect(() => {
    if (!isDropdownOpen) return;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSuggestions({ songs: [], artists: [], albums: [], topResult: null });
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const data = await saavnApi.getSuggestions(trimmed, controller.signal);
        setSuggestions(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Live suggestion fetch error:', err);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isDropdownOpen]);

  // Handlers for selections
  const handleSelectSong = (song) => {
    const trackObj = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album || 'Single',
      thumbnail: song.thumbnail,
      duration: song.duration,
      durationFormatted: song.durationFormatted,
      audioUrl: song.audioUrl || null
    };

    const updated = storage.addRecentSearch({
      id: song.id,
      type: 'song',
      title: song.title,
      subtitle: `Song • ${song.artist}`,
      thumbnail: song.thumbnail,
      track: trackObj
    });
    setRecentSearches(updated);

    playTrack(trackObj);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleSelectArtist = (artist) => {
    const updated = storage.addRecentSearch({
      id: artist.id,
      type: 'artist',
      title: artist.name,
      subtitle: 'Artist',
      thumbnail: artist.thumbnail
    });
    setRecentSearches(updated);

    navigate(`/artist/${encodeURIComponent(artist.name)}`);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleSelectAlbum = (album) => {
    const updated = storage.addRecentSearch({
      id: album.id,
      type: 'album',
      title: album.title,
      subtitle: `Album • ${album.artist || ''}`.trim(),
      thumbnail: album.thumbnail
    });
    setRecentSearches(updated);

    navigate(`/album/${encodeURIComponent(album.title)}`);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleSelectQuery = (queryText) => {
    const trimmed = (queryText || searchQuery).trim();
    if (trimmed) {
      const updated = storage.addRecentSearch({
        id: `query-${trimmed.toLowerCase()}`,
        type: 'query',
        title: trimmed,
        subtitle: 'Search query',
        query: trimmed
      });
      setRecentSearches(updated);
      setSearchQuery(trimmed);
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/search');
    }
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleRemoveRecent = (id) => {
    const updated = storage.removeRecentSearch(id);
    setRecentSearches(updated);
  };

  const handleClearRecent = () => {
    const updated = storage.clearRecentSearches();
    setRecentSearches(updated);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsDropdownOpen(true);
        e.preventDefault();
      }
      return;
    }

    const hasQuery = Boolean(searchQuery && searchQuery.trim());
    const items = !hasQuery
      ? [
          ...recentSearches.map(item => ({
            action: () => {
              if (item.type === 'song' && item.track) handleSelectSong(item.track);
              else if (item.type === 'artist') handleSelectArtist({ name: item.title, id: item.id });
              else if (item.type === 'album') handleSelectAlbum({ title: item.title, id: item.id });
              else handleSelectQuery(item.query || item.title);
            }
          })),
          ...POPULAR_SEARCHES.map(tag => ({
            action: () => handleSelectQuery(tag)
          }))
        ]
      : [
          ...(suggestions.topResult ? [{
            action: () => {
              const top = suggestions.topResult;
              if (top.type === 'artist') handleSelectArtist({ name: top.title, id: top.id });
              else if (top.type === 'album') handleSelectAlbum({ title: top.title, id: top.id });
              else handleSelectSong(top);
            }
          }] : []),
          ...(suggestions.songs || []).map(song => ({
            action: () => handleSelectSong(song)
          })),
          ...(suggestions.artists || []).map(artist => ({
            action: () => handleSelectArtist(artist)
          })),
          ...(suggestions.albums || []).map(album => ({
            action: () => handleSelectAlbum(album)
          })),
          {
            action: () => handleSelectQuery(searchQuery)
          }
        ];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length === 0) return;
      setActiveIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      setActiveIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        items[activeIndex].action();
      } else if (searchQuery.trim()) {
        handleSelectQuery(searchQuery);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsDropdownOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    handleSelectQuery(searchQuery);
  };

  return (
    <header
      className="navbar-header"
      style={{
        height: 'var(--navbar-height)',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 15
      }}
    >
      {/* Left: Mobile hamburger & History Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={onToggleMobileMenu}
          className="mobile-only"
          style={{
            padding: '7px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-subtle)'
          }}
          title="Open menu"
        >
          <Menu size={19} />
        </button>

        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => window.history.back()}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background var(--transition-fast)'
            }}
            title="Go back"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={() => window.history.forward()}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background var(--transition-fast)'
            }}
            title="Go forward"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Small screen mobile logo */}
        <div 
          onClick={() => navigate('/')}
          className="mobile-only" 
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-solid)',
              color: 'var(--accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Disc size={15} />
          </div>
          <span className="navbar-logo-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.04em' }}>
            NOIR
          </span>
        </div>
      </div>

      {/* Center: Live Search input with Spotify Dropdown */}
      <div
        ref={searchContainerRef}
        style={{
          flex: 1,
          maxWidth: '460px',
          position: 'relative',
          minWidth: 0
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%'
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              color: 'var(--text-muted)',
              pointerEvents: 'none'
            }}
          />
          <input
            ref={inputRef}
            type="text"
            className="navbar-search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              setIsDropdownOpen(true);
              setRecentSearches(storage.getRecentSearches());
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, artists, albums..."
            style={{
              width: '100%',
              height: '38px',
              padding: '0 36px 0 36px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              transition: 'border-color var(--transition-fast), background var(--transition-fast)'
            }}
          />

          {/* Right indicator: Spinner or Clear Button */}
          <div
            style={{
              position: 'absolute',
              right: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {loadingSuggestions && (
              <Loader2 size={14} className="brand-logo-spin" style={{ color: 'var(--text-muted)' }} />
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions({ songs: [], artists: [], albums: [], topResult: null });
                  setActiveIndex(-1);
                  if (inputRef.current) inputRef.current.focus();
                }}
                style={{
                  padding: '4px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'color var(--transition-fast)'
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </form>

        {/* Responsive Spotify Search Dropdown */}
        <SearchDropdown
          isOpen={isDropdownOpen}
          query={searchQuery}
          suggestions={suggestions}
          loading={loadingSuggestions}
          recentSearches={recentSearches}
          onRemoveRecent={handleRemoveRecent}
          onClearRecent={handleClearRecent}
          onSelectSong={handleSelectSong}
          onSelectArtist={handleSelectArtist}
          onSelectAlbum={handleSelectAlbum}
          onSelectQuery={handleSelectQuery}
          activeIndex={activeIndex}
          onHoverIndex={setActiveIndex}
        />
      </div>

      {/* Right: Theme Toggle, Settings & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Working Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform var(--transition-fast), background var(--transition-fast)'
          }}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform var(--transition-fast)'
          }}
          title="Application Settings & YouTube API"
        >
          <Settings size={17} />
        </button>

        {/* User Profile Pill / Auth Button */}
        <div style={{ position: 'relative' }}>
          {user ? (
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px 4px 4px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)'
              }}
              title={`Logged in as ${user.email}`}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-solid)',
                  color: 'var(--accent-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                {(user.email?.[0] || 'U').toUpperCase()}
              </div>
              <span className="desktop-only" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'}
              </span>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--accent-text)',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'opacity var(--transition-fast)'
              }}
              title="Sign in with Supabase"
            >
              <LogIn size={14} />
              <span className="desktop-only">Sign In</span>
            </button>
          )}

          {/* User Menu Dropdown */}
          {user && showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-lg)',
                padding: '8px',
                minWidth: '180px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signed in as</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  signOut();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
