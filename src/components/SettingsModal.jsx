import React from 'react';
import { useLibrary } from '../context/LibraryContext';
import { useTheme } from '../context/ThemeContext';
import { Settings, X, Sun, Moon, User, LogIn, LogOut, Sparkles, Check } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, onOpenAuth }) {
  const { user, signOut, openInterestPicker } = useLibrary();
  const { toggleTheme, isDark } = useTheme();

  if (!isOpen) return null;

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  return (
    <div
      className="settings-modal-overlay"
      onClick={onClose}
    >
      <div
        className="settings-modal-card animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={20} style={{ color: 'var(--text-primary)' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Settings</h3>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Settings"
            style={{
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'color var(--transition-fast)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="settings-modal-body">
          
          {/* 1. Profile Section */}
          <section>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Profile
            </label>

            {user ? (
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-solid)',
                        color: 'var(--accent-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {userInitial}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: '0.925rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.675rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--accent-subtle)',
                      color: 'var(--accent-solid)',
                      flexShrink: 0
                    }}
                  >
                    Active
                  </span>
                </div>

                {/* Music Preferences & Sign Out Actions */}
                <div className="settings-actions-row">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openInterestPicker();
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'border-color var(--transition-fast)'
                    }}
                  >
                    <Sparkles size={14} style={{ color: 'var(--accent-solid)', flexShrink: 0 }} />
                    <span>Music Preferences</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => signOut()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '9px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <User size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.925rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Guest User
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.4 }}>
                      Sign in to sync your playlists and liked music
                    </p>
                  </div>
                </div>

                <div className="settings-actions-row">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenAuth) onOpenAuth();
                      else onClose();
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--accent-solid)',
                      color: 'var(--accent-text)',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <LogIn size={15} />
                    <span>Sign In / Register</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openInterestPicker();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Sparkles size={14} style={{ color: 'var(--accent-solid)' }} />
                    <span>Preferences</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 2. Interface Theme Section */}
          <section>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Interface Theme
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  if (!isDark) toggleTheme();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isDark ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
                  border: `2px solid ${isDark ? 'var(--accent-solid)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Moon size={16} />
                <span>Dark Theme</span>
                {isDark && (
                  <Check size={14} style={{ color: 'var(--accent-solid)', marginLeft: '2px' }} />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isDark) toggleTheme();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: !isDark ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
                  border: `2px solid ${!isDark ? 'var(--accent-solid)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Sun size={16} />
                <span>Light Theme</span>
                {!isDark && (
                  <Check size={14} style={{ color: 'var(--accent-solid)', marginLeft: '2px' }} />
                )}
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
