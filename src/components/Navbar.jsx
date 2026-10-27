import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { saavnApi } from '../services/saavnApi';
import { storage } from '../services/storage';
import SearchSuggestions from './SearchSuggestions';
import { 
  Search, 
  Sun, 
  Moon, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  Disc, 
  LogOut, 
  LogIn,
  Sparkles,
  X
} from 'lucide-react';

export default function Navbar({ onOpenSettings, onToggleMobileMenu, onOpenAuth }) {
  const { toggleTheme, isDark } = useTheme();
  const { user, signOut, userPreferences, openInterestPicker } = useLibrary();
  const { playTrack } = usePlayer();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => storage.getRecentSearches());

  const isSearchPage = location.pathname === '/search';
  const debounceTimerRef = useRef(null);

  // Sync search input if URL has search param
  useEffect(() => {
    if (isSearchPage) {
      const params = new URLSearchParams(location.search);
      const q = params.get('q') || '';
      setSearchQuery(q);
    }
  }, [location.search, isSearchPage]);

  // Live typo-tolerant suggestions debounce effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions(null);
      setIsSuggestLoading(false);
      return;
    }

    setIsSuggestLoading(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await saavnApi.getAutocomplete(searchQuery.trim());
        setSuggestions(data);
      } catch (err) {
        console.warn('Navbar autocomplete fetch error:', err);
      } finally {
        setIsSuggestLoading(false);
      }
    }, 220);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setIsDropdownOpen(false);
    if (searchQuery.trim()) {
      storage.addRecentSearch(searchQuery.trim());
      setRecentSearches(storage.getRecentSearches());
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const handleSelectSong = async (song) => {
    setIsDropdownOpen(false);
    if (!song) return;

    // Save title to recent searches
    storage.addRecentSearch(song.title);
    setRecentSearches(storage.getRecentSearches());

    // If already has direct audio stream
    if (song.audioUrl) {
      playTrack(song);
      return;
    }

    // Resolve 320kbps stream via songDetails or search
    try {
      const full = await saavnApi.getSongDetails(song.id);
      if (full && full.audioUrl) {
        playTrack(full);
        return;
      }
    } catch {
      // Fallback
    }

    // Otherwise navigate to search for it
    navigate(`/search?q=${encodeURIComponent(song.title)}`);
  };

  const handleSelectQuery = (queryText) => {
    setIsDropdownOpen(false);
    setSearchQuery(queryText);
    storage.addRecentSearch(queryText);
    setRecentSearches(storage.getRecentSearches());
    navigate(`/search?q=${encodeURIComponent(queryText)}`);
  };

  const handleRemoveRecent = (queryText) => {
    const updated = storage.removeRecentSearch(queryText);
    setRecentSearches(updated);
  };

  const handleClearRecent = () => {
    const updated = storage.clearRecentSearches();
    setRecentSearches(updated);
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

      {/* Center: Search input with smart live suggestions */}
      <form
        onSubmit={handleSearchSubmit}
        style={{
          flex: 1,
          maxWidth: '460px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          minWidth: 0
        }}
      >
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '12px',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            zIndex: 2
          }}
        />
        <input
          type="text"
          className="navbar-search-input"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => {
            setIsDropdownOpen(true);
            setRecentSearches(storage.getRecentSearches());
          }}
          placeholder="Search songs, artists..."
          style={{
            width: '100%',
            height: '38px',
            padding: searchQuery.trim() ? '0 34px 0 36px' : '0 14px 0 36px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            transition: 'border-color var(--transition-fast), background var(--transition-fast)'
          }}
        />

        {searchQuery.trim() && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSuggestions(null);
            }}
            style={{
              position: 'absolute',
              right: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              zIndex: 2
            }}
            title="Clear"
          >
            <X size={15} />
          </button>
        )}

        {/* Floating Typo-Tolerant Auto-Complete Dropdown */}
        <SearchSuggestions
          query={searchQuery}
          suggestions={suggestions}
          isOpen={isDropdownOpen}
          isLoading={isSuggestLoading}
          onClose={() => setIsDropdownOpen(false)}
          onSelectSong={handleSelectSong}
          onSelectQuery={handleSelectQuery}
          recentSearches={recentSearches}
          onRemoveRecent={handleRemoveRecent}
          onClearRecent={handleClearRecent}
          userInterests={userPreferences}
        />
      </form>

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
          title="Application Settings"
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
                minWidth: '190px',
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

              {/* Music Interests / Personalization Button */}
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  openInterestPicker();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--accent-solid)' }} />
                <span>Music Interests</span>
              </button>

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
