import React, { useState } from 'react';
import { MOCK_TRACKS, EXPLORE_GENRES } from '../services/mockCatalog';
import MusicCard from '../components/MusicCard';
import { Compass } from 'lucide-react';

const MOODS = [
  { name: 'Late Night Vibe', desc: 'Dark, melodic synthwave and midnight soul', query: 'synthwave' },
  { name: 'Deep Focus', desc: 'Instrumental cadence, lo-fi, and acoustic calm', query: 'lofi' },
  { name: 'High Energy', desc: 'Punchy bass, hip-hop rhythm, and stadium anthems', query: 'hiphop' },
  { name: 'Pure Melancholy', desc: 'Gentle vocals, piano reverbs, and indie acoustics', query: 'rock' }
];

export default function Explore({ onOpenAddToPlaylist }) {
  const [selectedGenre, setSelectedGenre] = useState('all');

  const filteredTracks = selectedGenre === 'all'
    ? MOCK_TRACKS
    : MOCK_TRACKS.filter(t => t.genre.toLowerCase().includes(selectedGenre) || (t.album && t.album.toLowerCase().includes(selectedGenre)));

  return (
    <div className="page-container">
      {/* Page Title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Compass size={22} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Explore Genres & Moods</h1>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          Curated musical textures crafted for monochrome aesthetics
        </p>
      </div>

      {/* Mood Showcase Banners */}
      <div className="explore-moods-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {MOODS.map((mood, idx) => (
          <div
            key={mood.name}
            onClick={() => setSelectedGenre(mood.query)}
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-secondary)',
              border: `1px solid ${selectedGenre === mood.query ? 'var(--accent-solid)' : 'var(--border-medium)'}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '120px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform var(--transition-fast), border-color var(--transition-fast)'
            }}
          >
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                Mood 0{idx + 1}
              </span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '4px 0 2px' }}>
                {mood.name}
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {mood.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Genre Filter Pills */}
      <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
        <div className="explore-pills-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'none', width: '100%', maxWidth: '100%', minWidth: 0 }}>
          {EXPLORE_GENRES.map(genre => {
            const isActive = selectedGenre === genre.id;
            return (
              <button
                key={genre.id}
                onClick={() => setSelectedGenre(genre.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isActive ? 'var(--accent-solid)' : 'var(--bg-card)',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--accent-solid)' : 'var(--border-subtle)'}`,
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {genre.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Track Grid */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {selectedGenre === 'all' ? 'All Soundscapes' : `Filtered: ${selectedGenre.toUpperCase()}`}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {filteredTracks.length} tracks
          </span>
        </div>

        <div
          className="mobile-cards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px'
          }}
        >
          {filteredTracks.map(track => (
            <MusicCard
              key={track.id}
              track={track}
              onOpenAddToPlaylist={onOpenAddToPlaylist}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
