import { useState } from 'react';
import { Song, LoopMode } from '../types';
import { AlbumArt } from './AlbumArt';
import { SleepTimerMenu } from './SleepTimerMenu';

interface PlayerBarProps {
    currentSong: Song | null;
    currentTime: number;
    isPlaying: boolean;
    isShuffle: boolean;
    onPrevTrack: () => void;
    onNextTrack: () => void;
    onTogglePlay: () => void;
    onToggleShuffle: () => void;
    onSeekForward: () => void;
    onSeekBackward: () => void;
    onSeek: (time: number) => void;
    onOpenPlayerPage: () => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
    loopMode: LoopMode;
    onToggleLoop: () => void;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    sleepTimer: {
        active: boolean;
        endTime: number;
        action: 'stop' | 'quit';
        originalDuration?: number;
    } | null;
    onSetSleepTimer: (minutes: number, action: 'stop' | 'quit') => void;
    onCancelSleepTimer: () => void;
}

export function PlayerBar({
    currentSong,
    currentTime,
    isPlaying,
    isShuffle,
    onPrevTrack,
    onNextTrack,
    onTogglePlay,
    onToggleShuffle,
    onSeekForward,
    onSeekBackward,
    onSeek,
    onOpenPlayerPage,
    volume,
    onVolumeChange,
    loopMode,
    onToggleLoop,
    isFavorite,
    onToggleFavorite,
    sleepTimer,
    onSetSleepTimer,
    onCancelSleepTimer,
}: PlayerBarProps) {
    const [prevVolume, setPrevVolume] = useState(0.5);
    const [showSleepMenu, setShowSleepMenu] = useState(false);

    const handleMuteToggle = () => {
        if (volume > 0) {
            setPrevVolume(volume);
            onVolumeChange(0);
        } else {
            onVolumeChange(prevVolume > 0 ? prevVolume : 0.5);
        }
    };

    return (
        <div className="h-24 bg-white/5 backdrop-blur-3xl border-t border-white/10 grid grid-cols-3 items-center px-8 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
            {/* Info - Click to open player page */}
            <div className="min-w-0 flex items-center gap-4">
                {currentSong ? (
                    <div
                        onClick={onOpenPlayerPage}
                        className="flex items-center gap-4 cursor-pointer group w-full"
                    >
                        <AlbumArt
                            song={currentSong}
                            className="w-14 h-14 rounded-lg shadow-lg border border-white/10 group-hover:scale-105 group-hover:shadow-xl transition-all flex-shrink-0"
                            placeholderContent={<div className="text-2xl">💿</div>}
                        />

                        <div className="min-w-0 flex-1">
                            <div className="font-medium text-white truncate group-hover:text-white transition-colors">{currentSong.title || "Unknown Title"}</div>
                            <div className="text-sm text-white/40 truncate group-hover:text-white/60 transition-colors">{currentSong.artist || "Unknown Artist"}</div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                            className={`p-2 transition-colors ${isFavorite ? 'text-red-500' : 'text-white/20 hover:text-white'}`}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isFavorite ? "0" : "2"}>
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <div className="text-white/20 text-sm font-light">Select a song to play</div>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-4">
                    {/* Shuffle */}
                    <button
                        onClick={onToggleShuffle}
                        className={`p-2 transition-colors ${isShuffle ? 'text-white' : 'text-white/40 hover:text-white'}`}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                        </svg>
                    </button>

                    {/* Seek Backward */}
                    <button
                        onClick={onSeekBackward}
                        className="p-1 text-white/40 hover:text-white transition-colors"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
                        </svg>
                    </button>

                    {/* Previous */}
                    <button
                        onClick={onPrevTrack}
                        className="p-2 text-white/40 hover:text-white transition-colors"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
                        </svg>
                    </button>

                    {/* Play/Pause */}
                    <button
                        onClick={onTogglePlay}
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[0_0_25px_rgba(255,255,255,0.3)]">
                        {isPlaying ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7L8 5z" />
                            </svg>
                        )}
                    </button>

                    {/* Next */}
                    <button
                        onClick={onNextTrack}
                        className="p-2 text-white/40 hover:text-white transition-colors"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                        </svg>
                    </button>

                    {/* Seek Forward */}
                    <button
                        onClick={onSeekForward}
                        className="p-1 text-white/40 hover:text-white transition-colors"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                        </svg>
                    </button>

                    {/* Loop */}
                    <button
                        onClick={onToggleLoop}
                        className={`p-2 transition-colors relative ${loopMode !== 'off' ? 'text-white' : 'text-white/40 hover:text-white'}`}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                        </svg>
                        {loopMode === 'one' && (
                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold bg-black/50 rounded-full w-3 h-3 flex items-center justify-center">1</span>
                        )}
                    </button>

                    {/* Sleep Timer */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSleepMenu(!showSleepMenu)}
                            className={`p-2 transition-colors relative ${sleepTimer?.active || showSleepMenu ? 'text-white' : 'text-white/40 hover:text-white'}`}
                            title="Sleep Timer"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                            </svg>
                            {/* Active Indicator */}
                            {sleepTimer?.active && (
                                <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div>
                            )}
                        </button>

                        {showSleepMenu && (
                            <SleepTimerMenu
                                onClose={() => setShowSleepMenu(false)}
                                onSetTimer={onSetSleepTimer}
                                activeTimer={sleepTimer}
                                onCancelTimer={onCancelSleepTimer}
                                currentSongDuration={currentSong?.duration_seconds}
                                currentTime={currentTime}
                            />
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full max-w-lg flex items-center gap-3">
                    {/* Current Time */}
                    <span className="text-xs text-white/40 font-mono w-10 text-right">
                        {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime) % 60).padStart(2, '0')}
                    </span>

                    {/* Progress Track */}
                    <div
                        className="flex-1 group relative cursor-pointer py-2"
                        onClick={(e) => {
                            if (!currentSong) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const percent = (e.clientX - rect.left) / rect.width;
                            onSeek(percent * currentSong.duration_seconds);
                        }}
                    >
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden group-hover:h-2 transition-all duration-200">
                            <div
                                className="h-full bg-gradient-to-r from-white/60 to-white rounded-full relative transition-all duration-300"
                                style={{
                                    width: currentSong ? `${(currentTime / currentSong.duration_seconds) * 100}%` : '0%'
                                }}
                            >
                                {/* Glow effect */}
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
                            </div>
                        </div>
                    </div>

                    {/* Total Time */}
                    <span className="text-xs text-white/40 font-mono w-10">
                        {currentSong ? `${Math.floor(currentSong.duration_seconds / 60)}:${String(currentSong.duration_seconds % 60).padStart(2, '0')}` : '0:00'}
                    </span>
                </div>
            </div>

            {/* Volume */}
            <div
                className="flex justify-end items-center gap-3 group/volume"
                onWheel={(e) => {
                    const delta = e.deltaY > 0 ? -0.05 : 0.05;
                    onVolumeChange(volume + delta);
                }}
            >
                <button
                    onClick={handleMuteToggle}
                    className="text-white/40 hover:text-white transition-colors"
                >
                    {volume === 0 ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                        </svg>
                    ) : volume < 0.5 ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        </svg>
                    )}
                </button>
                <div
                    className="w-24 h-1 bg-white/10 rounded-full group hover:h-2 transition-all duration-200 cursor-pointer relative"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percent = (e.clientX - rect.left) / rect.width;
                        onVolumeChange(percent);
                    }}
                >
                    <div
                        className="h-full bg-white/50 rounded-full hover:bg-white/80 transition-colors absolute left-0 top-0"
                        style={{ width: `${volume * 100}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
}
