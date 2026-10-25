import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Compass, Library, Heart } from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';

export default function MobileNav() {
  const location = useLocation();
  const { likedSongs } = useLibrary();

  const links = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/library', label: 'Library', icon: Library },
    { to: '/liked', label: 'Liked', icon: Heart, badge: likedSongs.length }
  ];

  return (
    <nav className="mobile-nav-bar mobile-only" style={{ userSelect: 'none' }}>
      {links.map(({ to, label, icon: Icon, badge }) => {
        const isActive = location.pathname === to;
        return (
          <NavLink
            key={to}
            to={to}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              height: '100%',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.675rem',
              fontWeight: isActive ? 700 : 500,
              position: 'relative'
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={19} style={{ color: isActive ? 'var(--accent-solid)' : 'currentColor' }} />
              {badge !== undefined && badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-6px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-solid)'
                  }}
                />
              )}
            </div>
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
