import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useLibrary } from '../context/LibraryContext';
import { 
  Home, 
  Search, 
  Compass, 
  Library, 
  Heart, 
  Clock, 
  PlusCircle, 
  Music2, 
  Disc,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ 
  isCollapsed = false, 
  setIsCollapsed = () => {}, 
  onOpenCreatePlaylist,
  onNavigate = null,
  className = ''
}) {
  const { playlists, likedSongs } = useLibrary();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLinkClick = (to) => {
    navigate(to);
    if (onNavigate) onNavigate();
  };

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/library', label: 'Your Library', icon: Library },
    { to: '/liked', label: 'Liked Songs', icon: Heart, badge: likedSongs.length },
    { to: '/recent', label: 'Recently Played', icon: Clock }
  ];

  return (
    <aside
      className={className}
      style={{
        width: isCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'width var(--transition-normal)',
        position: 'relative',
        zIndex: 20,
        userSelect: 'none'
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: 'var(--navbar-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          padding: isCollapsed ? '0 12px' : '0 24px',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div
          onClick={() => handleLinkClick('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer'
          }}
        >
          {/* Custom geometric logo */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-solid)',
              color: 'var(--accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Disc size={20} className="brand-logo-spin" />
          </div>

          {!isCollapsed && (
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)'
                }}
              >
                NOIR
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginTop: '-3px'
                }}
              >
                SOUNDSCAPE
              </span>
            </div>
          )}
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="desktop-only"
          style={{
            color: 'var(--text-secondary)',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--accent-subtle)'
          }}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Main Navigation */}
      <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navLinks.map(({ to, label, icon: Icon, badge }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={() => {
                if (onNavigate) onNavigate();
              }}
              title={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: isCollapsed ? '12px' : '10px 14px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-surface-hover)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                transition: 'all var(--transition-fast)'
              }}
            >
              <Icon size={19} style={{ color: isActive ? 'var(--accent-solid)' : 'currentColor', flexShrink: 0 }} />
              
              {!isCollapsed && (
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
              )}

              {!isCollapsed && badge !== undefined && badge > 0 && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--accent-badge)',
                    color: 'var(--text-primary)',
                    fontWeight: 600
                  }}
                >
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 16px 12px' }} />

      {/* Playlists Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 12px' }}>
        {!isCollapsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)'
            }}
          >
            <span>Playlists</span>
            <button
              onClick={() => {
                if (onOpenCreatePlaylist) onOpenCreatePlaylist();
                if (onNavigate) onNavigate();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
              title="Create new playlist"
            >
              <PlusCircle size={15} />
            </button>
          </div>
        )}

        {/* Scrollable list of user playlists */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            paddingRight: '4px'
          }}
        >
          {playlists.map((pl) => {
            const isPlActive = location.pathname === `/playlist/${pl.id}`;
            const count = pl.tracks ? pl.tracks.length : (pl.trackIds ? pl.trackIds.length : 0);

            return (
              <NavLink
                key={pl.id}
                to={`/playlist/${pl.id}`}
                onClick={() => {
                  if (onNavigate) onNavigate();
                }}
                title={pl.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: isCollapsed ? '10px' : '9px 12px',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: 'var(--radius-sm)',
                  color: isPlActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: isPlActive ? 'var(--bg-surface-hover)' : 'transparent',
                  fontSize: '0.84rem',
                  fontWeight: isPlActive ? 600 : 400,
                  transition: 'background var(--transition-fast)'
                }}
              >
                <Music2 size={16} style={{ color: isPlActive ? 'var(--accent-solid)' : 'var(--text-muted)', flexShrink: 0 }} />
                {!isCollapsed && (
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pl.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {count} {count === 1 ? 'song' : 'songs'}
                    </div>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Quick Create Playlist Footer Button */}
      {isCollapsed ? (
        <div style={{ padding: '12px', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => {
              if (onOpenCreatePlaylist) onOpenCreatePlaylist();
              if (onNavigate) onNavigate();
            }}
            style={{
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-solid)',
              color: 'var(--accent-text)'
            }}
            title="Create Playlist"
          >
            <PlusCircle size={20} />
          </button>
        </div>
      ) : (
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => {
              if (onOpenCreatePlaylist) onOpenCreatePlaylist();
              if (onNavigate) onNavigate();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all var(--transition-fast)'
            }}
          >
            <PlusCircle size={17} />
            <span>New Playlist</span>
          </button>
        </div>
      )}
    </aside>
  );
}
