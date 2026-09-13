import { Song, LoopMode } from '../types';
import { AlbumArt } from './AlbumArt';
import { GlassButton, IconFavorites, IconMinimize } from '@knp-org/liquid-glass-ui';
import { PlaybackControls, VolumeControl } from './PlaybackControls';
import { SeekSlider } from './PlayerSlider';

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
    onOpenPill: () => void;
    pillBusy: boolean;
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

export function PlayerBar(props: PlayerBarProps) {
    const { currentSong, isFavorite, onToggleFavorite, onOpenPlayerPage } = props;
    return <div data-player-controls data-player-bar className="luma-player-bar">
        <div className="luma-now-playing">
            <GlassButton variant="ghost" type="button" className="luma-open-player" onClick={onOpenPlayerPage} disabled={!currentSong} aria-label={currentSong ? `Open player for ${currentSong.title || 'current track'}` : 'Select a song to play'}>
                {currentSong && <AlbumArt song={currentSong} className="w-12 h-12 rounded-xl flex-shrink-0" />}
                <span className="min-w-0">
                    <span className="block truncate font-medium">{currentSong?.title || (currentSong ? 'Unknown Title' : 'Select a song to play')}</span>
                    {currentSong && <span className="block truncate text-sm luma-muted">{currentSong.artist || 'Unknown Artist'}</span>}
                </span>
            </GlassButton>
            <GlassButton type="button" shape="circle" variant={(isFavorite) ? 'secondary' : 'ghost'} className="luma-icon-button" aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'} title={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={isFavorite} disabled={!currentSong} onClick={onToggleFavorite}><IconFavorites size={20} fill={isFavorite ? 'currentColor' : 'none'} /></GlassButton>
            <GlassButton type="button" variant="ghost" shape="circle" className="luma-icon-button" aria-label="Open floating pill player" title="Floating pill player" disabled={props.pillBusy} onClick={props.onOpenPill}><IconMinimize size={18} /></GlassButton>
        </div>
        <div className="luma-bar-center">
            <PlaybackControls {...props} compact disabled={!currentSong} duration={currentSong?.duration_seconds || 0} />
            <SeekSlider key={currentSong?.path} value={props.currentTime} duration={currentSong?.duration_seconds || 0} onSeek={props.onSeek} />
        </div>
        <div className="luma-bar-volume"><VolumeControl volume={props.volume} onVolumeChange={props.onVolumeChange} /></div>
    </div>;
}
