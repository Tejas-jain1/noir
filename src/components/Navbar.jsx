import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLibrary } from '../context/LibraryContext';
import { 
  Sun, 
  Moon, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  Disc, 
  LogOut, 
  LogIn,
  Sparkles 
} from 'lucide-react';

export default function Navbar({ onOpenSettings, onToggleMobileMenu, onOpenAuth }) {
  const { toggleTheme, isDark } = useTheme();
  const { user, signOut, openInterestPicker } = useLibrary();
  const navigate = useNavigate();

  const [showUserMenu, setShowUserMenu] = useState(false);

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
        position: 'sticky',
        top: 0,
        zIndex: 15
      }}
    >
      {/* Left: Mobile hamburger & History Navigation + Mobile Brand Name */}
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
            backgroundColor: 'var(--accent-subtle)',
            border: 'none',
            cursor: 'pointer'
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
              cursor: 'pointer',
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
              cursor: 'pointer',
              transition: 'background var(--transition-fast)'
            }}
            title="Go forward"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Mobile Brand Name: Placed on left next to hamburger to prevent collision */}
        <div
          onClick={() => navigate('/')}
          className="navbar-brand-link mobile-only"
          style={{ marginLeft: '2px' }}
          title="NOIR - Home"
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-solid)',
              color: 'var(--accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            <Disc size={14} />
          </div>
          <span className="navbar-brand-title">
            NOIR
          </span>
        </div>
      </div>

      {/* Desktop Brand Name: Mathematically centered in navbar */}
      <div
        onClick={() => navigate('/')}
        className="navbar-brand-link desktop-only"
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}
        title="NOIR - Home"
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-solid)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-xs)'
          }}
        >
          <Disc size={16} />
        </div>
        <span className="navbar-brand-title">
          NOIR
        </span>
      </div>

      {/* Right: Theme Toggle, Settings & Profile */}
      <div className="navbar-right-actions">
        {/* Working Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="navbar-icon-btn"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="navbar-icon-btn"
          title="Application Settings"
        >
          <Settings size={16} />
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
                padding: '3px 8px 3px 3px',
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
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-solid)',
                  color: 'var(--accent-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
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
                border: 'none',
                cursor: 'pointer',
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
                  border: 'none',
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
                  border: 'none',
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
