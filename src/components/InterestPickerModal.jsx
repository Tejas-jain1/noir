import React, { useState, useEffect } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { 
  Sparkles, 
  Check, 
  X, 
  Music, 
  User, 
  Compass, 
  Heart,
  ChevronRight
} from 'lucide-react';

const GENRES = [
  { id: 'lofi', name: 'Lo-Fi & Chill', icon: '🎧' },
  { id: 'rap', name: 'Hip-Hop & Rap', icon: '🎤' },
  { id: 'bollywood', name: 'Bollywood Hits', icon: '✨' },
  { id: 'punjabi', name: 'Punjabi & Desi', icon: '🔥' },
  { id: 'pop', name: 'Pop & Chartbusters', icon: '🌟' },
  { id: 'indie', name: 'Indie & Acoustic', icon: '🎸' },
  { id: 'edm', name: 'EDM & Dance', icon: '⚡' },
  { id: 'rnb', name: 'R&B & Soul', icon: '🎷' },
  { id: 'romantic', name: 'Romantic & Love', icon: '💖' },
  { id: 'sad', name: 'Sad & Melancholy', icon: '🌧️' },
  { id: 'rock', name: 'Rock & Metal', icon: '🎸' },
  { id: 'devotional', name: 'Devotional & Sufi', icon: '🪔' }
];

// Verified high-definition JioSaavn CDN artist portraits (all HTTP 200 OK verified)
const ARTISTS = [
  { name: 'Arijit Singh', image: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_150x150.jpg' },
  { name: 'The Weeknd', image: 'https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_150x150.jpg' },
  { name: 'Diljit Dosanjh', image: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_150x150.jpg' },
  { name: 'AP Dhillon', image: 'https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_150x150.jpg' },
  { name: 'Taylor Swift', image: 'https://c.saavncdn.com/artists/Taylor_Swift_003_20200226074119_150x150.jpg' },
  { name: 'Sidhu Moose Wala', image: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_004_20250617183705_150x150.jpg' },
  { name: 'Kendrick Lamar', image: 'https://c.saavncdn.com/artists/Kendrick_Lamar_150x150.jpg' },
  { name: 'Drake', image: 'https://c.saavncdn.com/artists/Drake_006_20260520062317_150x150.jpg' },
  { name: 'Shreya Ghoshal', image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_007_20241101074144_150x150.jpg' },
  { name: 'Pritam', image: 'https://c.saavncdn.com/artists/Pritam_Chakraborty-20170711073326_150x150.jpg' },
  { name: 'Dua Lipa', image: 'https://c.saavncdn.com/artists/Dua_Lipa_004_20231120090922_150x150.jpg' },
  { name: 'Atif Aslam', image: 'https://c.saavncdn.com/artists/Atif_Aslam_150x150.jpg' },
  { name: 'Billie Eilish', image: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_150x150.jpg' },
  { name: 'Anuv Jain', image: 'https://c.saavncdn.com/artists/Anuv_Jain_001_20231206073013_150x150.jpg' },
  { name: 'Coldplay', image: 'https://c.saavncdn.com/artists/Coldplay_002_20241003070447_150x150.jpg' },
  { name: 'Divine', image: 'https://c.saavncdn.com/artists/DIVINE_006_20250911071442_150x150.jpg' }
];

export default function InterestPickerModal({ isOpen, onClose }) {
  const { user, userPreferences, saveUserPreferences, showToast } = useLibrary();

  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedArtists, setSelectedArtists] = useState([]);
  const [activeTab, setActiveTab] = useState('genres'); // 'genres' | 'artists'

  // Hydrate initial selection from existing preferences
  useEffect(() => {
    if (userPreferences) {
      if (Array.isArray(userPreferences.genres)) setSelectedGenres(userPreferences.genres);
      if (Array.isArray(userPreferences.artists)) setSelectedArtists(userPreferences.artists);
    }
  }, [userPreferences]);

  if (!isOpen) return null;

  const toggleGenre = (genreName) => {
    setSelectedGenres(prev => 
      prev.includes(genreName) ? prev.filter(g => g !== genreName) : [...prev, genreName]
    );
  };

  const toggleArtist = (artistName) => {
    setSelectedArtists(prev => 
      prev.includes(artistName) ? prev.filter(a => a !== artistName) : [...prev, artistName]
    );
  };

  const totalSelected = selectedGenres.length + selectedArtists.length;

  const handleSave = async () => {
    const updated = {
      genres: selectedGenres,
      artists: selectedArtists,
      onboarding_completed: true,
      updated_at: new Date().toISOString()
    };
    await saveUserPreferences(updated);
    showToast('Your music vibe is saved! Search & recommendations updated.', 'success');
    onClose();
  };

  const handleSkip = async () => {
    const updated = {
      genres: selectedGenres.length > 0 ? selectedGenres : ['Lo-Fi & Chill', 'Bollywood Hits'],
      artists: selectedArtists.length > 0 ? selectedArtists : ['Arijit Singh', 'The Weeknd'],
      onboarding_completed: true,
      updated_at: new Date().toISOString()
    };
    await saveUserPreferences(updated);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Modal Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-solid)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Personalize Your Sound
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                Choose music genres & artists you love for custom recommendations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', padding: '12px 24px 0', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('genres')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'genres' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'genres' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderBottom: activeTab === 'genres' ? '2px solid var(--accent-solid)' : '2px solid transparent',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Compass size={15} />
            <span>Genres & Vibes ({selectedGenres.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('artists')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'artists' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'artists' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderBottom: activeTab === 'artists' ? '2px solid var(--accent-solid)' : '2px solid transparent',
              transition: 'all var(--transition-fast)'
            }}
          >
            <User size={15} />
            <span>Favorite Artists ({selectedArtists.length})</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', maxHeight: '380px' }}>
          {activeTab === 'genres' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {GENRES.map((g) => {
                const isSelected = selectedGenres.includes(g.name);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGenre(g.name)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: isSelected ? 'var(--accent-solid)' : 'var(--bg-card)',
                      color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)',
                      border: isSelected ? '1px solid var(--accent-solid)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{g.icon}</span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {g.name}
                    </span>
                    {isSelected && <Check size={14} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
              {ARTISTS.map((artist) => {
                const isSelected = selectedArtists.includes(artist.name);
                return (
                  <button
                    key={artist.name}
                    onClick={() => toggleArtist(artist.name)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: isSelected ? '2px solid var(--accent-solid)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      }}
                    >
                      <img
                        src={artist.image}
                        alt={artist.name}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) {
                            e.target.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                      <div
                        style={{
                          display: 'none',
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-solid)',
                          color: 'var(--accent-text)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}
                      >
                        {artist.name[0]}
                      </div>
                    </div>

                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {artist.name}
                    </span>

                    {isSelected && (
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-solid)',
                          color: 'var(--accent-text)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Check size={11} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-surface)' }}>
          <button
            onClick={handleSkip}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Skip for now
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {totalSelected > 0 ? `${totalSelected} selected` : 'Select at least 1'}
            </span>

            <button
              onClick={handleSave}
              disabled={totalSelected === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 20px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: totalSelected > 0 ? 'var(--accent-solid)' : 'var(--bg-card)',
                color: totalSelected > 0 ? 'var(--accent-text)' : 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 700,
                border: 'none',
                cursor: totalSelected > 0 ? 'pointer' : 'not-allowed',
                boxShadow: totalSelected > 0 ? 'var(--shadow-md)' : 'none',
                transition: 'all var(--transition-fast)'
              }}
            >
              <span>Save & Continue</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
