import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { PlayerProvider } from './context/PlayerContext';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import MusicPlayer from './components/MusicPlayer';
import MobileNav from './components/MobileNav';
import FullscreenPlayer from './components/FullscreenPlayer';
import QueueModal from './components/QueueModal';
import SettingsModal from './components/SettingsModal';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import ToastContainer from './components/ToastContainer';
import InterestPickerModal from './components/InterestPickerModal';
import ImportSpotifyModal from './components/ImportSpotifyModal';
import { spotifyImport } from './services/spotifyImport';

import Home from './pages/Home';
import SearchPage from './pages/SearchPage';
import Explore from './pages/Explore';
import LibraryPage from './pages/Library';
import LikedSongs from './pages/LikedSongs';
import RecentlyPlayed from './pages/RecentlyPlayed';
import PlaylistDetail from './pages/PlaylistDetail';
import ArtistPage from './pages/ArtistPage';
import AlbumPage from './pages/AlbumPage';
import AuthModal from './components/AuthModal';

import { X } from 'lucide-react';
import './App.css';

function MainLayout() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSpotifyImportOpen, setIsSpotifyImportOpen] = useState(() => spotifyImport.hasOAuthCallback());
  const [spotifyImportSession, setSpotifyImportSession] = useState(0);
  const [spotifyImportPrefill, setSpotifyImportPrefill] = useState('');
  const [reopenSpotifyImportAfterAuth, setReopenSpotifyImportAfterAuth] = useState(false);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState(null);

  const {
    isInterestPickerOpen,
    setIsInterestPickerOpen,
    user,
    libraryOwnerId,
    isSupabaseConfigured,
    importSpotifyPlaylist,
    showToast
  } = useLibrary();

  const handleOpenSpotifyImport = (url = '') => {
    setSpotifyImportPrefill(url);
    setSpotifyImportSession(session => session + 1);
    setIsSpotifyImportOpen(true);
  };

  const handleRequireSignInForImport = (url = '') => {
    setSpotifyImportPrefill(url);
    setSpotifyImportSession(session => session + 1);
    setReopenSpotifyImportAfterAuth(true);
    setIsSpotifyImportOpen(false);
    setIsAuthOpen(true);
  };

  const handleCloseAuth = () => {
    setIsAuthOpen(false);
    if (reopenSpotifyImportAfterAuth) {
      setReopenSpotifyImportAfterAuth(false);
      setIsSpotifyImportOpen(true);
    }
  };

  const handleOpenAddToPlaylist = (track) => {
    setAddToPlaylistTrack(track);
  };

  return (
    <div className="app-container">
      {/* 1. Desktop & Tablet Sidebar */}
      <Sidebar
        className="desktop-sidebar"
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
      />

      {/* 2. Mobile Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div
          className="mobile-drawer-overlay mobile-only"
          onClick={() => setIsMobileDrawerOpen(false)}
        >
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px 0' }}>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                style={{ color: 'var(--text-secondary)', padding: '6px' }}
                title="Close drawer"
              >
                <X size={22} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Sidebar
                className="mobile-sidebar"
                isCollapsed={false}
                setIsCollapsed={() => {}}
                onNavigate={() => setIsMobileDrawerOpen(false)}
                onOpenCreatePlaylist={() => {
                  setIsMobileDrawerOpen(false);
                  setIsCreatePlaylistOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Body */}
      <div className="main-wrapper">
        <Navbar
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleMobileMenu={() => setIsMobileDrawerOpen(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
        />

        <main className="content-scrollable">
          <Routes>
            <Route path="/" element={<Home onOpenAddToPlaylist={handleOpenAddToPlaylist} />} />
            <Route path="/search" element={<SearchPage onOpenSettings={() => setIsSettingsOpen(true)} onOpenAddToPlaylist={handleOpenAddToPlaylist} onOpenSpotifyImport={handleOpenSpotifyImport} />} />
            <Route path="/explore" element={<Explore onOpenAddToPlaylist={handleOpenAddToPlaylist} onOpenSpotifyImport={handleOpenSpotifyImport} />} />
            <Route path="/library" element={<LibraryPage onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)} onOpenSpotifyImport={handleOpenSpotifyImport} />} />
            <Route path="/liked" element={<LikedSongs onOpenAddToPlaylist={handleOpenAddToPlaylist} />} />
            <Route path="/recent" element={<RecentlyPlayed onOpenAddToPlaylist={handleOpenAddToPlaylist} />} />
            <Route path="/playlist/:id" element={<PlaylistDetail onOpenAddToPlaylist={handleOpenAddToPlaylist} />} />
            <Route path="/artist/:name" element={<ArtistPage onOpenAddToPlaylist={handleOpenAddToPlaylist} />} />
            <Route path="/album/:id" element={<AlbumPage onOpenAddToPlaylist={handleOpenAddToPlaylist} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* 4. Persistent Music Player (Desktop full footer bar / Mobile mini-player) */}
        <MusicPlayer
          onOpenQueue={() => setIsQueueOpen(true)}
          onOpenAddToPlaylist={handleOpenAddToPlaylist}
        />

        {/* 5. Mobile Bottom Tab Navigation */}
        <MobileNav />
      </div>

      {/* 6. Expandable Fullscreen / Mobile Player Sheet */}
      <FullscreenPlayer />

      {/* 7. Modals & Notifications */}
      <QueueModal
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenAuth={() => {
          setIsSettingsOpen(false);
          setIsAuthOpen(true);
        }}
      />

      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
      />

      <AddToPlaylistModal
        track={addToPlaylistTrack}
        isOpen={Boolean(addToPlaylistTrack)}
        onClose={() => setAddToPlaylistTrack(null)}
        onOpenCreatePlaylist={() => {
          setAddToPlaylistTrack(null);
          setIsCreatePlaylistOpen(true);
        }}
      />

      <ToastContainer />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={handleCloseAuth}
      />

      <ImportSpotifyModal
        key={spotifyImportSession}
        isOpen={isSpotifyImportOpen}
        initialUrl={spotifyImportPrefill}
        user={user}
        libraryReady={Boolean(user?.id && libraryOwnerId === user.id)}
        isSupabaseConfigured={isSupabaseConfigured}
        importSpotifyPlaylist={importSpotifyPlaylist}
        showToast={showToast}
        onClose={() => setIsSpotifyImportOpen(false)}
        onRequireSignIn={handleRequireSignInForImport}
        onImported={(playlistId) => {
          setIsSpotifyImportOpen(false);
          navigate(`/playlist/${encodeURIComponent(playlistId)}`);
        }}
      />

      <InterestPickerModal
        isOpen={isInterestPickerOpen}
        onClose={() => setIsInterestPickerOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <LibraryProvider>
          <PlayerProvider>
            <MainLayout />
          </PlayerProvider>
        </LibraryProvider>
      </ThemeProvider>
    </Router>
  );
}
