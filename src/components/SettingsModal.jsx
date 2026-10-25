import React, { useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { useTheme } from '../context/ThemeContext';
import { X, Key, Sun, Moon, Trash2, Check, ExternalLink, Info } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSettings } = useLibrary();
  const { toggleTheme, isDark } = useTheme();

  const [apiKeyInput, setApiKeyInput] = useState(settings.apiKey || '');
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    updateSettings({ apiKey: apiKeyInput.trim() });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to reset all playlists and saved liked songs? This cannot be undone.')) {
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
          {/* YouTube API Key Setting */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                YouTube Data API v3 Key
              </label>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'underline'
                }}
              >
                <span>Get a Free Key</span>
                <ExternalLink size={12} />
              </a>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
              Enter your Google Cloud YouTube Data API v3 key for live music searching. If omitted or quota is exceeded, NOIR uses the authentic internal curated catalog automatically.
            </p>

            <form onSubmit={handleSaveApiKey} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  flex: 1,
                  height: '40px',
                  padding: '0 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '0 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-solid)',
                  color: 'var(--accent-text)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isSaved ? <Check size={16} /> : null}
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>
            </form>
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
              Playback utilizes the official <strong>YouTube IFrame Player API</strong> in compliance with YouTube terms. Audio is never ripped or extracted. Playlists & liked tracks are stored locally in your browser.
            </div>
          </div>

          {/* Danger Zone */}
          <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Data Management
            </label>
            <button
              onClick={handleClearData}
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
                fontWeight: 600
              }}
            >
              <Trash2 size={16} />
              <span>Reset Local Playlists & Liked Songs</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
