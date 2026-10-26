import React, { useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { useTheme } from '../context/ThemeContext';
import { X, Key, Sun, Moon, Trash2, Check, ExternalLink, Info, Database, Cloud, RefreshCw } from 'lucide-react';
import { offlineStorage } from '../services/offlineStorage';
import { isSupabaseConfigured } from '../services/supabaseClient';

export default function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSettings, user } = useLibrary();
  const { toggleTheme, isDark } = useTheme();

  const [apiKeyInput, setApiKeyInput] = useState(settings.apiKey || '');
  const [isSaved, setIsSaved] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  if (!isOpen) return null;

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    updateSettings({ apiKey: apiKeyInput.trim() });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to reset all playlists and cached data? This cannot be undone.')) {
      setIsClearing(true);
      try {
        await offlineStorage.clear();
      } catch (e) {
        console.error('IndexedDB clear error', e);
      }
      localStorage.removeItem('noir_liked_songs');
      localStorage.removeItem('noir_playlists');
      localStorage.removeItem('noir_recently_played');
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-overlay)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Key size={20} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Settings & API Config</h3>
          </div>

          <button
            onClick={onClose}
            style={{
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Audio Engine & Metadata Provider */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Music Engine: JioSaavn CDN Audio</span>
              </label>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-solid)'
                }}
              >
                Active • 320kbps
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
              NOIR is connected to the high-speed <strong>JioSaavn CDN Engine</strong>. Streaming operates at up to 320kbps CD-quality audio directly via native HTML5 audio with reliable mobile background playback and zero API quotas.
            </p>
          </section>

          {/* Theme Preference */}
          <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Interface Theme
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isDark ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
                  border: `2px solid ${isDark ? 'var(--accent-solid)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <Moon size={16} />
                <span>Dark Theme</span>
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
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: !isDark ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
                  border: `2px solid ${!isDark ? 'var(--accent-solid)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <Sun size={16} />
                <span>Light Theme</span>
              </button>
            </div>
          </section>

          {/* Cloud Database & Offline Storage Status */}
          <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Cloud Sync & Database
            </label>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cloud size={16} style={{ color: isSupabaseConfigured() ? 'var(--accent-solid)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                    {isSupabaseConfigured() ? 'Supabase Cloud: Connected' : 'Storage Engine: IndexedDB Local'}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isSupabaseConfigured() ? 'var(--accent-subtle)' : 'var(--bg-card)',
                    color: isSupabaseConfigured() ? 'var(--accent-solid)' : 'var(--text-muted)'
                  }}
                >
                  {isSupabaseConfigured() ? 'Synced' : 'Offline Mode'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {isSupabaseConfigured()
                  ? (user ? `Synchronizing library & history to user account: ${user.email}` : 'Supabase configured. Sign in via navbar to sync playlists and liked songs.')
                  : 'Library, playlists, and history are preserved in offline browser IndexedDB storage. Add VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY to .env for multi-device sync.'}
              </p>
            </div>
          </section>

          {/* Compliance & Storage Notice */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '12px'
            }}
          >
            <Info size={18} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Audio streams directly in 320kbps CD-quality via high-speed CDNs with native lock-screen controls. Synchronized lyrics are provided via LRCLIB.
            </div>
          </div>

          {/* Danger Zone */}
          <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Data Management
            </label>
            <button
              onClick={handleClearData}
              disabled={isClearing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isClearing ? <RefreshCw size={16} className="spin" /> : <Trash2 size={16} />}
              <span>{isClearing ? 'Clearing Storage...' : 'Reset Local Storage & IndexedDB Cache'}</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
