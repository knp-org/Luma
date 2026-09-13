import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { MobileNavigation } from "./components/Sidebar";
import { QueueEditor } from "./components/QueueEditor";
import { PillPlayer } from "./components/PillPlayer";
import { usePillMode } from "./hooks/usePillMode";
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
  Titlebar,
} from "./components";
import { GlassButton, GlassModal, GlassAlert, GlassHeading} from "@knp-org/liquid-glass-ui";

type View = "library" | "albums" | "playlists" | "settings" | "genres" | "favorites" | "analytics" | "queue";

function App() {
  // View State
  const [currentView, setCurrentView] = useState<View>("library");
  const [showPlayerPage, setShowPlayerPage] = useState(false);
  const [infoSong, setInfoSong] = useState<Song | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<{ endTime: number, action: 'stop' | 'quit', originalDuration: number } | null>(null);
  const pill = usePillMode();

  useEffect(() => {
    document.documentElement.dataset.pillMode = String(pill.active);
    return () => { delete document.documentElement.dataset.pillMode; };
  }, [pill.active]);

  // Handle Window Close
  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      if (await pill.leave()) setShowExitConfirm(true);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [pill.leave]);


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
    settings,
    warnings,
    locateMissing,
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
    playIndex,
    addToQueue,
    moveQueue,
    removeFromQueue,
    stop,
    error,
    clearError,
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
  } = usePlayer({ songs, seekInterval: settings.seek_interval });

  // Playlists Hook
  const {
    playlists,
    loadPlaylists,
    addToPlaylist,
    isFavorite,
    handleToggleFavorite,
    menuOpenFor,
    setMenuOpenFor,
  } = usePlaylists({ currentSong });

  const favoriteSongs = useMemo(() => {
    const paths = new Set(playlists.find(playlist => playlist.name === "Favorites")?.tracks ?? []);
    return songs.filter(song => paths.has(song.path));
  }, [songs, playlists]);

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

  const controls = useRef({ isPlaying, togglePlay, nextTrack, prevTrack, stop, seekTo, currentTime, handleVolumeChange, handleConfirmExit });
  controls.current = { isPlaying, togglePlay, nextTrack, prevTrack, stop, seekTo, currentTime, handleVolumeChange, handleConfirmExit };
  useEffect(() => {
    if (!sleepTimer) return;
    const timeout = window.setTimeout(() => {
      setSleepTimer(null);
      const current = controls.current;
      if (sleepTimer.action === 'quit') void current.handleConfirmExit();
      else if (current.isPlaying) void current.togglePlay();
    }, Math.max(0, sleepTimer.endTime - Date.now()));
    return () => clearTimeout(timeout);
  }, [sleepTimer]);

  useEffect(() => {
    const subscription = listen<{ action: string; value: number }>('media-control', ({ payload }) => {
      const current = controls.current;
      switch (payload.action) {
        case 'play': if (!current.isPlaying) void current.togglePlay(); break;
        case 'pause': if (current.isPlaying) void current.togglePlay(); break;
        case 'toggle': void current.togglePlay(); break;
        case 'next': void current.nextTrack(); break;
        case 'previous': void current.prevTrack(); break;
        case 'stop': void current.stop(); break;
        case 'seek': void current.seekTo(payload.value); break;
        case 'seekBy': void current.seekTo(current.currentTime + payload.value); break;
        case 'volume': void current.handleVolumeChange(payload.value); break;
        case 'quit': setShowExitConfirm(true); break;
      }
    });
    return () => { subscription.then(unlisten => unlisten()).catch(console.error); };
  }, []);
  useEffect(() => {
    void invoke('update_media', { state: {
      title: currentSong?.title || currentSong?.path.split('/').pop() || null,
      artist: currentSong?.artist || null, album: currentSong?.album || null,
      duration: currentSong?.duration_seconds || 0, position: currentTime, playing: isPlaying, volume,
    } }).catch(console.error);
  }, [currentSong, Math.floor(currentTime), isPlaying, volume]);

  useEffect(() => {
    const relocated = (event: Event) => {
      const { oldPath, song } = (event as CustomEvent<{ oldPath: string; song: Song }>).detail;
      setQueue(queue => queue.map(item => item.path === oldPath ? song : item));
    };
    window.addEventListener('song-relocated', relocated);
    return () => window.removeEventListener('song-relocated', relocated);
  }, []);
  useEffect(() => {
    if (!songs.length) return;
    const byPath = new Map(songs.map(song => [song.path, song]));
    setQueue(queue => queue.map(song => byPath.get(song.path) ?? song));
  }, [songs]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && (focused.matches('input, textarea, select, button, [contenteditable="true"]') || focused.closest('[role="dialog"]'))) {
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

  const restoreFullPlayer = useCallback(async () => {
    if (await pill.leave()) setShowPlayerPage(Boolean(currentSong));
  }, [pill.leave, currentSong]);

  return (<>
    {pill.active && <PillPlayer song={currentSong} isPlaying={isPlaying} busy={pill.busy}
      error={pill.error || error || ''} onRestore={restoreFullPlayer}
      onTogglePlay={togglePlay} onPrevious={prevTrack} onNext={nextTrack}
      onSeekBackward={seekBackward} onSeekForward={seekForward} />}
    <div className="luma-app flex flex-col h-screen w-screen bg-neutral-950 text-white font-sans overflow-hidden selection:bg-white/30"
      style={pill.active ? { display: 'none' } : undefined} inert={pill.active || undefined}>
      <Titlebar />

      {/* Full-Screen Player Page */}
      {showPlayerPage && currentSong && !pill.active && (
        <PlayerPage
          currentSong={currentSong}
          currentTime={currentTime}
          isPlaying={isPlaying}
          isShuffle={isShuffle}
          onClose={() => {
            setShowPlayerPage(false);
            requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.luma-open-player')?.focus());
          }}
          onOpenPill={() => { void pill.enter(); }}
          pillBusy={pill.busy}
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
          onPlayIndex={playIndex}
          onMoveQueue={moveQueue}
          onRemoveQueue={removeFromQueue}
          onQueueSaved={loadPlaylists}
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
          volume={volume}
          onVolumeChange={handleVolumeChange}
        />
      )}

      {/* Glassmorphic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 -z-10"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-white/10 to-transparent rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-15%] w-[50%] h-[50%] bg-gradient-to-tl from-white/5 to-transparent rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-white/3 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden" inert={showPlayerPage && currentSong ? true : undefined}>
        {/* Sidebar */}
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />

        {/* View Content */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-sm -z-10"></div>

          <MobileNavigation currentView={currentView} onViewChange={setCurrentView} />
          {currentView === 'queue' && <div className="flex flex-col flex-1 min-h-0"><GlassHeading as="h1" className="text-2xl font-bold p-4 shrink-0">Queue · {queue.length} tracks</GlassHeading><QueueEditor queue={queue} currentIndex={currentIndex} onPlayIndex={playIndex} onMove={moveQueue} onRemove={removeFromQueue} onSaved={loadPlaylists} /></div>}
          {currentView === "settings" && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden">
              <Settings
                settings={settings}
                songs={songs}
                warnings={warnings}
                onLocate={locateMissing}
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
              <Playlists songs={songs} playlists={playlists} onRefresh={loadPlaylists} onPlayPlaylist={handlePlayPlaylist} />
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
              title="Favorites"
              emptyMessage="No favorite songs yet."
              showSyncButton={false}
              songs={favoriteSongs}
              loading={loading}
              currentSong={currentSong}
              isPlaying={isPlaying}
              playlists={playlists}
              menuOpenFor={menuOpenFor}
              onPlaySong={playSong}
              onQueue={addToQueue}
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
              onQueue={addToQueue}
              onMenuToggle={setMenuOpenFor}
              onAddToPlaylist={addToPlaylist}
              onShowSongInfo={setInfoSong}
              onGoToSettings={() => setCurrentView("settings")}
            />
          )}
        </main>
      </div>

      {/* Player Bar */}
      <div inert={showPlayerPage && currentSong ? true : undefined} className="luma-player-bar-shell">
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
        onOpenPill={() => { void pill.enter(); }}
        pillBusy={pill.busy}
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
      </div>

      {(error || pill.error) && <div className="fixed bottom-28 left-4 right-4 z-[4000]"><GlassAlert variant="error"><div className="flex gap-4 items-center"><span className="flex-1 text-sm">{pill.error || error}</span><GlassButton onClick={() => { clearError(); pill.clearError(); }}>Dismiss</GlassButton></div></GlassAlert></div>}
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
      <GlassModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        title="Exit Luma?"
        surfaceOpacity={0.97}
        className="!max-w-sm"
        footer={
          <div className="flex justify-end gap-3">
            <GlassButton variant="secondary" onClick={() => setShowExitConfirm(false)} autoFocus>
              Cancel
            </GlassButton>
            <GlassButton variant="danger" onClick={handleConfirmExit}>
              Exit
            </GlassButton>
          </div>
        }
      >
        <span className="text-sm text-white/70">
          Playback will stop and your current queue is saved. Are you sure you want to exit?
        </span>
      </GlassModal>
    </div>
  </>);
}

export default App;
