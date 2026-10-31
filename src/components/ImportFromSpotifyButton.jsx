import React from 'react';
export default function ImportFromSpotifyButton({ onClick }) {
  return (
    <button className="spotify-import-button" type="button" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M6.8 9.1c3.7-1.1 7.8-.6 10.8 1.4M7.7 12.2c3.1-.9 6.4-.4 9 1.2M8.5 15.1c2.4-.6 4.9-.2 6.9 1" fill="none" stroke="var(--bg-primary)" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
      <span>Import from Spotify</span>
    </button>
  );
}
