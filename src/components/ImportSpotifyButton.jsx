import React from 'react';

export function SpotifyMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1DB954" />
      <path d="M6.7 9c3.8-1.1 8.2-.5 11.1 1.5M7.6 12.2c3.2-.9 6.6-.4 9.3 1.3M8.5 15.2c2.4-.7 5-.3 7.1 1" fill="none" stroke="#07140b" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function ImportSpotifyButton({ onClick, compact = false }) {
  return (
    <button
      className={`spotify-import-cta${compact ? ' compact' : ''}`}
      type="button"
      onClick={onClick}
    >
      <span className="spotify-import-button-icon" aria-hidden="true">
        <SpotifyMark size={20} />
      </span>
      <span>Import from Spotify</span>
    </button>
  );
}
