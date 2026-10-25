# NOIR — Modern Monochrome Music Streaming

![NOIR Black & White Soundscape](https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80)

**NOIR** is a Spotify-inspired, responsive music streaming web application built with a premium, minimalist **Black & White** aesthetic. Powered by **React 19**, **Vite**, and compliant **YouTube IFrame Player API playback**, NOIR features a distinct visual identity, real music search, persistent global playback, queue orchestration, custom playlist curation, and seamless theme switching.

---

## 🌟 Key Features

### 1. Minimalist Black & White Design System
- **Dark Mode (Default):** Deep void black background (`#0a0a0c`), charcoal surfaces (`#141418`), crisp white typography, and subtle border hierarchy.
- **Light Mode:** High-key studio white background (`#f8f9fa`), paper-white cards, pitch-black typography, and soft depth shadows.
- **Theme Toggle:** Instant mode switching with smooth CSS transitions across all surfaces and components.
- **Micro-Interactions:** Subtle card hover lifts, animated play triggers, and active track equalizer frequency bars.

### 2. Compliant YouTube Playback Engine
- Utilizes the official **YouTube IFrame Player API** (`https://www.youtube.com/iframe_api`).
- **No unauthorized audio stream extraction or downloading**.
- Auto-handles playback states (Playing, Paused, Buffering, Ended).
- **Graceful Error Handling:** Automatically detects restricted embeds (codes 101/150) or unavailable tracks (code 100), presents toast alerts to the user, and auto-advances to the next playable track in queue.
- **Picture-in-Picture / Video Toggle:** Watch official YouTube music videos in an embedded floating container or keep it in sleek audio-only mode.

### 3. Persistent Bottom Music Player
- Remains active and uninterrupted across all page routes and views.
- **Controls:** Play/Pause, Next Track, Previous Track, Repeat (Off / Repeat All / Repeat One), and Shuffle.
- **Seekable Progress Bar:** Smooth scrubbing with dynamic track position formatting (`mm:ss`).
- **Volume & Mute:** Custom volume range slider with mute toggle and volume level memory.
- **Queue Management:** Slide-out drawer to view upcoming tracks, remove individual items, or clear queue.
- **Expandable Fullscreen Player:** Tap album art or the expand icon to reveal an immersive full-screen player with high-resolution artwork and sound visualizer.

### 4. Search Experience with Real Metadata
- Search by song title, artist, or keywords with a 350ms debounce mechanism to prevent quota waste.
- Fetches real-time music results from the YouTube Data API v3 when a key is provided.
- **Resilient Fallback:** Includes an authentic built-in curated catalog of verified hit records (The Weeknd, Dua Lipa, Kendrick Lamar, Billie Eilish, Daft Punk, Arijit Singh, Coldplay, Lofi Girl, and more) so the app works 100% out of the box even without an API key or when quota is exceeded.

### 5. Library, Playlists & Local Persistence
- **Liked Songs:** Single-click heart toggle to save and manage favorite tracks.
- **Custom Playlists:** Create, rename, edit description, and delete playlists.
- **Add / Remove Tracks:** Add any track to any playlist via the context menu.
- **Recently Played:** Automatically records and updates your listening history.
- **Local Persistence:** Structured via `localStorage` with a clean schema ready for future backend/database migration.

### 6. Mobile & Tablet Responsive
- **Desktop:** Full sidebar with playlist navigation, top navbar, main content, and bottom player.
- **Tablet / Mobile:** Collapses into a sleek bottom navigation bar, slide-out drawer menu, and full-screen bottom-sheet player.

---

## 🛠️ Tech Stack

- **Framework:** [React 19](https://react.dev/) (Functional Components & Hooks)
- **Bundler & Dev Server:** [Vite](https://vitejs.dev/)
- **Routing:** [React Router v7](https://reactrouter.com/) (HashRouter for reliable single-page navigation without 404s)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Styling:** Modular CSS with CSS Variables & modern responsive flex/grid layouts
- **Audio / Video Playback:** Official YouTube IFrame Player API
- **Data Source:** YouTube Data API v3 + Curated Music Catalog

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or newer recommended, tested on v24)
- npm (v9 or newer)

### 1. Installation
Clone or navigate to the project directory:
```bash
cd c:\Users\ADMIN\OneDrive\Desktop\gannaa
npm install
```

### 2. Environment Configuration (Optional)
The application works immediately out of the box using verified music tracks with real YouTube IDs. To enable dynamic search across the entire YouTube library:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and set your YouTube Data API v3 key:
   ```env
   VITE_YOUTUBE_API_KEY=your_google_cloud_youtube_api_key_here
   ```
> **Tip:** You can also configure or change your YouTube API key at runtime directly inside the application by clicking the **Settings (gear icon)** in the top navigation bar!

### 3. Run Development Server
```bash
npm run dev
```
Open your browser at the displayed local URL (typically `http://localhost:5173/`).

### 4. Build for Production
```bash
npm run build
```
The optimized production bundle will be generated in the `dist/` directory.

---

## 📁 Project Architecture

```
gannaa/
├── index.html                   # HTML entry point with fonts & metadata
├── vite.config.js               # Vite configuration
├── package.json                 # Project dependencies & scripts
├── .env.example                 # Environment variables template
├── public/                      # Static assets
└── src/
    ├── main.jsx                 # React root renderer
    ├── App.jsx                  # Main application layout, routers & modals
    ├── App.css                  # Responsive layout & breakpoint styles
    ├── index.css                # Black & White design system variables & animations
    ├── context/
    │   ├── ThemeContext.jsx     # Dark / Light theme toggle & localStorage sync
    │   ├── PlayerContext.jsx    # YouTube IFrame playback engine & controls
    │   └── LibraryContext.jsx   # Liked songs, playlists & notification dispatcher
    ├── services/
    │   ├── storage.js           # LocalStorage persistence layer
    │   ├── youtubeApi.js        # YouTube Data API v3 fetcher & ISO parser
    │   └── mockCatalog.js       # Curated real music catalog with verified video IDs
    ├── components/
    │   ├── Sidebar.jsx          # Desktop navigation & playlist listing
    │   ├── Navbar.jsx           # Top search bar, theme toggle, profile & settings
    │   ├── MusicPlayer.jsx      # Persistent bottom audio player & scrubber
    │   ├── FullscreenPlayer.jsx # Expandable full-screen mobile player sheet
    │   ├── YouTubeContainer.jsx # Compliant YouTube IFrame mount & PiP video card
    │   ├── MusicCard.jsx        # Grid track card with hover play & options
    │   ├── TrackRow.jsx         # Table track row with equalizer bars & actions
    │   ├── TrackList.jsx        # Reusable track table with headers
    │   ├── QueueModal.jsx       # Slide-out lineup manager
    │   ├── SettingsModal.jsx    # API key setup & theme preferences modal
    │   ├── CreatePlaylistModal.jsx # Playlist creation modal
    │   ├── AddToPlaylistModal.jsx  # Track assignment modal
    │   ├── MobileNav.jsx        # Bottom bar navigation for mobile screens
    │   └── ToastContainer.jsx   # Feedback notification toasts
    └── pages/
        ├── Home.jsx             # Hero spotlight, trending music & top artists
        ├── SearchPage.jsx       # Debounced search & top result highlight
        ├── Explore.jsx          # Genre filter pills & mood soundscapes
        ├── Library.jsx          # Saved playlists & liked songs hub
        ├── LikedSongs.jsx       # Liked songs collection & shuffle controls
        ├── RecentlyPlayed.jsx   # Playback history
        └── PlaylistDetail.jsx   # Dynamic playlist route with edit & song removal
```

---

## 🔒 Compliance & Known Limitations

1. **YouTube Terms of Service Compliance:**
   - Audio is streamed using the official YouTube IFrame Player API.
   - The application does **not** extract, rip, or download YouTube audio streams.
   - The YouTube player is mounted to the DOM and can be viewed via the video toggle button.
2. **Video Embed Restrictions:**
   - Some record labels or copyright holders restrict third-party iframe embedding (error code 150/101). NOIR gracefully detects this, alerts the user, and auto-advances to the next track.
3. **Autoplay Policies:**
   - Modern browsers (Chrome, Safari, Edge) enforce autoplay restrictions requiring user interaction before unmuted audio playback begins.
4. **Local Storage:**
   - User playlists and liked songs are saved in browser `localStorage`. This provides instant offline persistence without requiring a backend server, but does not provide multi-device sync.
