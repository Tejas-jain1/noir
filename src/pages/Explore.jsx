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
    <div style={{ padding: '24px 32px 80px', display: 'flex', flexDirection: 'column', gap: '36px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      {/* Page Title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Compass size={24} />
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Explore Genres & Moods</h1>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
          Curated musical textures crafted for monochrome aesthetics
        </p>
      </div>

      {/* Mood Showcase Banners */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {MOODS.map((mood, idx) => (
          <div
            key={mood.name}
            onClick={() => setSelectedGenre(mood.query)}
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--bg-secondary)',
              border: `1px solid ${selectedGenre === mood.query ? 'var(--accent-solid)' : 'var(--border-medium)'}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '140px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform var(--transition-fast), border-color var(--transition-fast)'
            }}
          >
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                Mood 0{idx + 1}
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '6px 0 4px' }}>
                {mood.name}
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {mood.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Genre Filter Pills */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
          {EXPLORE_GENRES.map(genre => {
            const isActive = selectedGenre === genre.id;
            return (
              <button
                key={genre.id}
                onClick={() => setSelectedGenre(genre.id)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isActive ? 'var(--accent-solid)' : 'var(--bg-card)',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--accent-solid)' : 'var(--border-subtle)'}`,
                  fontSize: '0.825rem',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            {selectedGenre === 'all' ? 'All Soundscapes' : `Filtered: ${selectedGenre.toUpperCase()}`}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {filteredTracks.length} tracks
          </span>
        </div>

        <div
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
