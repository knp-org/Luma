import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import { Song } from "./models";
import { usePlayer, usePlaylists, useLibrary, usePlaybackPersistence } from "./hooks";

// Components
import {
  Settings,
  Playlists,
  Albums,
  Genres,
  Sidebar,
  Library,
  PlayerBar,
  PlayerPage,
  SongInfoModal,
  Analytics,
} from "./components";

type View = "library" | "albums" | "playlists" | "settings" | "genres" | "favorites" | "analytics";

function App() {
  // View State
  const [currentView, setCurrentView] = useState<View>("library");
  const [showPlayerPage, setShowPlayerPage] = useState(false);
  const [infoSong, setInfoSong] = useState<Song | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<{ endTime: number, action: 'stop' | 'quit', originalDuration: number } | null>(null);

  // Handle Window Close
  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      setShowExitConfirm(true);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);


  // Wait, I need access to `handleConfirmExit` and playback controls.
  // I will check `usePlayer` content first in next step. For now I will hold off on this chunk.

  const handleConfirmExit = async () => {
    try {
      // Race saveState with a 1-second timeout
      await Promise.race([
        saveState(),
        new Promise((resolve) => setTimeout(resolve, 1000))
      ]);
    } catch (e) {
      console.error("Error saving state during exit:", e);
    }
    await exit(0);
  };

  // Library Hook
  const {
    songs,
    setSongs,
    loading,
    path,
    seekInterval,
    syncProgress,
    cacheSize,
    scanMusic,
    handleClearCache,
    saveSettings,
  } = useLibrary();

  // Player Hook
  const {
    queue,
    setQueue,
    currentIndex,
    setCurrentIndex,
    currentSong,
    isPlaying,
    currentTime,
    setCurrentTime,
    volume,
    setVolume,
    isShuffle,
    setIsShuffle,
    loopMode,
    setLoopMode,
    playTrackInternal,
    playSong,
    togglePlay,
    toggleShuffle,
    toggleLoop,
    nextTrack,
    prevTrack,
    seekTo,
    seekForward,
    seekBackward,
    handleVolumeChange,
    handlePlayPlaylist,
  } = usePlayer({ songs, seekInterval });

  // Playlists Hook
  const {
    playlists,
    addToPlaylist,
    isFavorite,
    handleToggleFavorite,
    menuOpenFor,
    setMenuOpenFor,
  } = usePlaylists({ currentSong });

  // Playback Persistence Hook
  const { saveState } = usePlaybackPersistence({
    queue,
    currentIndex,
    currentTime,
    volume,
    isShuffle,
    loopMode,
    isPlaying,
    setQueue,
    setCurrentIndex,
    setCurrentTime,
    setVolume,
    setIsShuffle,
    setLoopMode,
  });

  // Handle Sleep Timer
  useEffect(() => {
    if (!sleepTimer) return;

    const interval = setInterval(() => {
      if (Date.now() >= sleepTimer.endTime) {
        setSleepTimer(null);
        if (sleepTimer.action === 'stop') {
          if (isPlaying) {
            togglePlay();
          }
        } else if (sleepTimer.action === 'quit') {
          handleConfirmExit();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimer, isPlaying, togglePlay]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          seekForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBackward();
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(volume + 0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(volume - 0.05);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekForward, seekBackward, handleVolumeChange, volume]);

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-white font-sans overflow-hidden selection:bg-white/30">

      {/* Full-Screen Player Page */}
      {showPlayerPage && currentSong && (
        <PlayerPage
          currentSong={currentSong}
          currentTime={currentTime}
          isPlaying={isPlaying}
          isShuffle={isShuffle}
          onClose={() => setShowPlayerPage(false)}
          onPrevTrack={prevTrack}
          onNextTrack={nextTrack}
          onTogglePlay={togglePlay}
          onToggleShuffle={toggleShuffle}
          onSeek={seekTo}
          onSeekForward={seekForward}
          onSeekBackward={seekBackward}
          loopMode={loopMode}
          onToggleLoop={toggleLoop}
          queue={queue}
          currentIndex={currentIndex}
          onPlayIndex={async (index) => {
            setCurrentIndex(index);
            await playTrackInternal(queue[index].path);
          }}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          sleepTimer={sleepTimer ? {
            active: true,
            endTime: sleepTimer.endTime,
            action: sleepTimer.action,
            originalDuration: sleepTimer.originalDuration
          } : null}
          onSetSleepTimer={(minutes, action) => {
            setSleepTimer({
              endTime: Date.now() + minutes * 60 * 1000,
              action,
              originalDuration: minutes
            });
          }}
          onCancelSleepTimer={() => setSleepTimer(null)}
        />
      )}

      {/* Glassmorphic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 -z-10"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-white/10 to-transparent rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-15%] w-[50%] h-[50%] bg-gradient-to-tl from-white/5 to-transparent rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-white/3 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />

        {/* View Content */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-sm -z-10"></div>

          {currentView === "settings" && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden">
              <Settings
                path={path}
                seekInterval={seekInterval}
                onSave={saveSettings}
                scanMusic={() => scanMusic()}
                onClearCache={handleClearCache}
                loading={loading}
                progress={syncProgress}
                cacheSize={cacheSize}
              />
            </div>
          )}

          {currentView === "playlists" && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden">
              <Playlists songs={songs} onPlayPlaylist={handlePlayPlaylist} />
            </div>
          )}

          {currentView === "albums" && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden">
              <Albums songs={songs} onPlaySong={playSong} />
            </div>
          )}

          {currentView === "genres" && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden">
              <Genres songs={songs} onPlaySong={playSong} />
            </div>
          )}

          {currentView === "analytics" && (
            <Analytics songs={songs} onPlaySong={playSong} />
          )}

          {currentView === "favorites" && (
            <Library
              songs={songs.filter(s => playlists.find(p => p.name === "Favorites")?.tracks.includes(s.path))}
              loading={loading}
              currentSong={currentSong}
              isPlaying={isPlaying}
              playlists={playlists}
              menuOpenFor={menuOpenFor}
              onPlaySong={playSong}
              onMenuToggle={setMenuOpenFor}
              onAddToPlaylist={addToPlaylist}
              onShowSongInfo={setInfoSong}
              onGoToSettings={() => setCurrentView("settings")}
            />
          )}

          {currentView === "library" && (
            <Library
              songs={songs}
              loading={loading}
              currentSong={currentSong}
              isPlaying={isPlaying}
              playlists={playlists}
              menuOpenFor={menuOpenFor}
              onPlaySong={playSong}
              onMenuToggle={setMenuOpenFor}
              onAddToPlaylist={addToPlaylist}
              onShowSongInfo={setInfoSong}
              onGoToSettings={() => setCurrentView("settings")}
            />
          )}
        </main>
      </div>

      {/* Player Bar */}
      <PlayerBar
        currentSong={currentSong}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onPrevTrack={prevTrack}
        onNextTrack={nextTrack}
        onTogglePlay={togglePlay}
        onToggleShuffle={toggleShuffle}
        onSeekForward={seekForward}
        onSeekBackward={seekBackward}
        onSeek={seekTo}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        isShuffle={isShuffle}
        onOpenPlayerPage={() => setShowPlayerPage(true)}
        loopMode={loopMode}
        onToggleLoop={toggleLoop}
        isFavorite={isFavorite}
        onToggleFavorite={handleToggleFavorite}
        sleepTimer={sleepTimer ? {
          active: true,
          endTime: sleepTimer.endTime,
          action: sleepTimer.action,
          originalDuration: sleepTimer.originalDuration
        } : null}
        onSetSleepTimer={(minutes, action) => {
          setSleepTimer({
            endTime: Date.now() + minutes * 60 * 1000,
            action,
            originalDuration: minutes
          });
        }}
        onCancelSleepTimer={() => setSleepTimer(null)}
      />

      {/* SongInfoModal */}
      {infoSong && (
        <SongInfoModal
          song={infoSong}
          onClose={() => setInfoSong(null)}
          onSongUpdate={(updatedSong) => {
            setSongs(prevSongs => prevSongs.map(s => s.path === updatedSong.path ? updatedSong : s));
            setQueue(prevQueue => prevQueue.map(s => s.path === updatedSong.path ? updatedSong : s));
          }}
        />
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-6">Exit Luma?</h3>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
                autoFocus
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExit}
                className="px-4 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
