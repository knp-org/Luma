import { useState } from 'react';
import { Song, LoopMode } from '../types';
import { AlbumArt } from './AlbumArt';
import { SleepTimerMenu } from './SleepTimerMenu';
import { 
    GlassButton, 
    GlassSlider,
    GlassTooltip,
    IconShuffle,
    IconSeekBackward,
    IconPrevTrack,
    IconPlay,
    IconPause,
    IconNextTrack,
    IconSeekForward,
    IconLoop,
    IconTimer,
    IconVolumeMute,
    IconVolumeLow,
    IconVolumeHigh,
    IconFavorites
} from '@knp-org/liquid-glass-ui';

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
                        <GlassButton variant="ghost"
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                            className={`p-2 transition-colors ${isFavorite ? 'text-red-500' : 'text-white/20 hover:text-white'}`}
                        >
                            <IconFavorites fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isFavorite ? "0" : "2"} />
                        </GlassButton>
                    </div>
                ) : (
                    <div className="text-white/20 text-sm font-light">Select a song to play</div>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                    {/* Shuffle */}
                    <GlassTooltip text={isShuffle ? "Shuffle On" : "Shuffle Off"}>
                        <GlassButton
                            variant="ghost"
                            onClick={onToggleShuffle}
                            className={`!w-9 !h-9 !rounded-full flex items-center justify-center transition-colors ${isShuffle ? '!bg-white/20 !text-white' : '!text-white/40 hover:!bg-white/10'}`}
                        >
                            <IconShuffle variant={isShuffle ? 'on' : 'off'} />
                        </GlassButton>
                    </GlassTooltip>

                    {/* Seek Backward */}
                    <GlassTooltip text="Seek -10s">
                        <GlassButton
                            variant="ghost"
                            onClick={onSeekBackward}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <IconSeekBackward />
                        </GlassButton>
                    </GlassTooltip>

                    {/* Previous */}
                    <GlassTooltip text="Previous Track">
                        <GlassButton
                            variant="ghost"
                            onClick={onPrevTrack}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <IconPrevTrack />
                        </GlassButton>
                    </GlassTooltip>

                    {/* Play/Pause */}
                    <GlassTooltip text={isPlaying ? "Pause" : "Play"}>
                        <GlassButton
                            variant="primary"
                            shape="circle"
                            size="lg"
                            onClick={onTogglePlay}
                            className="!w-12 !h-12 hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-white/10"
                        >
                            {isPlaying ? (
                                <IconPause />
                            ) : (
                                <IconPlay />
                            )}
                        </GlassButton>
                    </GlassTooltip>

                    {/* Next */}
                    <GlassTooltip text="Next Track">
                        <GlassButton
                            variant="ghost"
                            onClick={onNextTrack}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <IconNextTrack />
                        </GlassButton>
                    </GlassTooltip>

                    {/* Seek Forward */}
                    <GlassTooltip text="Seek +10s">
                        <GlassButton
                            variant="ghost"
                            onClick={onSeekForward}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <IconSeekForward />
                        </GlassButton>
                    </GlassTooltip>

                    {/* Loop / Repeat */}
                    <GlassTooltip text={loopMode === 'off' ? "Repeat Off" : loopMode === 'all' ? "Repeat All" : "Repeat Current Track"}>
                        <GlassButton
                            variant="ghost"
                            onClick={onToggleLoop}
                            className={`!w-9 !h-9 !rounded-full flex items-center justify-center transition-all relative ${loopMode !== 'off' ? '!bg-white/20 !text-white' : '!text-white/30 hover:!bg-white/5'}`}
                        >
                            <IconLoop variant={loopMode} size={18} />
                        </GlassButton>
                    </GlassTooltip>

                    {/* Sleep Timer */}
                    <div className="relative">
                        <GlassTooltip text="Sleep Timer">
                            <GlassButton
                                variant="ghost"
                                onClick={() => setShowSleepMenu(!showSleepMenu)}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors relative ${sleepTimer?.active || showSleepMenu ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                            >
                                <IconTimer />
                                {/* Active Indicator */}
                                {sleepTimer?.active && (
                                    <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div>
                                )}
                            </GlassButton>
                        </GlassTooltip>

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
                    <div className="flex-1 px-2">
                        <GlassSlider
                            min={0}
                            max={currentSong ? currentSong.duration_seconds : 100}
                            value={currentTime}
                            shimmer={true}
                            onChange={(e) => {
                                if (currentSong) {
                                    onSeek(Number(e.target.value));
                                }
                            }}
                            className="w-full"
                        />
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
                <GlassButton
                    variant="ghost"
                    onClick={handleMuteToggle}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                    {volume === 0 ? (
                        <IconVolumeMute />
                    ) : volume < 0.5 ? (
                        <IconVolumeLow />
                    ) : (
                        <IconVolumeHigh />
                    )}
                </GlassButton>
                <div className="w-24 px-1">
                    <GlassSlider
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        onChange={(e) => onVolumeChange(Number(e.target.value))}
                        className="w-full"
                    />
                </div>
            </div>
        </div>
    );
}
