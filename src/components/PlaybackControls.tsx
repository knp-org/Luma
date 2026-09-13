import { useEffect, useId, useRef, useState } from 'react';
import { GlassButton, GlassCard, IconShuffle, IconPrevTrack, IconPlay, IconPause, IconNextTrack, IconLoop, IconSeekBackward, IconSeekForward, IconTimer, IconMoreVertical, IconVolumeMute, IconVolumeLow, IconVolumeHigh } from '@knp-org/liquid-glass-ui';
import type { LoopMode } from '../types';
import { SleepTimerMenu } from './SleepTimerMenu';
import { PlayerSlider } from './PlayerSlider';

export function VolumeControl({ volume, onVolumeChange }: { volume: number; onVolumeChange: (value: number) => void }) {
    const previous = useRef(0.5);
    return <div className="luma-volume">
        <GlassButton type="button" shape="circle" variant={(volume === 0) ? 'secondary' : 'ghost'} className="luma-icon-button" aria-label={volume > 0 ? 'Mute' : 'Unmute'} title={volume > 0 ? 'Mute' : 'Unmute'} aria-pressed={volume === 0} onClick={() => {
            if (volume > 0) { previous.current = volume; onVolumeChange(0); }
            else onVolumeChange(previous.current);
        }}>{volume === 0 ? <IconVolumeMute size={18} /> : volume < 0.5 ? <IconVolumeLow size={18} /> : <IconVolumeHigh size={18} />}</GlassButton>
        <PlayerSlider label="Volume" max={1} step={0.01} value={volume} onChange={onVolumeChange} formatValue={value => `${Math.round(value * 100)}%`} />
    </div>;
}
export interface PlaybackControlsProps {
    isPlaying: boolean; isShuffle: boolean; loopMode: LoopMode;
    onPrevTrack: () => void; onNextTrack: () => void; onTogglePlay: () => void;
    onToggleShuffle: () => void; onToggleLoop: () => void;
    onSeekForward: () => void; onSeekBackward: () => void;
    volume: number; onVolumeChange: (volume: number) => void;
    sleepTimer: { active: boolean; endTime: number; action: 'stop' | 'quit'; originalDuration?: number } | null;
    onSetSleepTimer: (minutes: number, action: 'stop' | 'quit') => void; onCancelSleepTimer: () => void;
}
export function PlaybackControls(props: PlaybackControlsProps & { compact?: boolean; disabled?: boolean; duration: number; currentTime: number }) {
    const { compact = false, disabled = false } = props;
    const [more, setMore] = useState(false);
    const [timer, setTimer] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const id = useId();
    useEffect(() => {
        if (!more && !timer) return;
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault(); event.stopImmediatePropagation();
            if (timer) { setTimer(false); root.current?.querySelector<HTMLButtonElement>('[aria-label="Sleep timer"]')?.focus(); }
            else { setMore(false); root.current?.querySelector<HTMLButtonElement>('[aria-label="More playback controls"]')?.focus(); }
        };
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) { setMore(false); setTimer(false); }
        };
        window.addEventListener('keydown', escape, true);
        document.addEventListener('pointerdown', outside);
        return () => { window.removeEventListener('keydown', escape, true); document.removeEventListener('pointerdown', outside); };
    }, [more, timer]);
    const SecondaryContainer = compact ? GlassCard : 'div';
    return <div ref={root} className={`luma-playback-controls ${compact ? 'luma-playback-controls--compact' : ''}`}>
        <div className="luma-transport" role="group" aria-label="Playback controls">
            {compact && <GlassButton type="button" shape="circle" variant={(props.isShuffle) ? 'secondary' : 'ghost'} className="luma-icon-button" aria-label={props.isShuffle ? 'Shuffle on' : 'Shuffle off'} title={props.isShuffle ? 'Shuffle on' : 'Shuffle off'} aria-pressed={props.isShuffle} disabled={disabled} onClick={props.onToggleShuffle}><IconShuffle size={20} variant={props.isShuffle ? 'on' : 'off'} /></GlassButton>}
            <GlassButton type="button" shape="circle" variant="ghost" className="luma-icon-button" aria-label="Previous track" title="Previous track" disabled={disabled} onClick={props.onPrevTrack}><IconPrevTrack size={26} /></GlassButton>
            {!compact && <GlassButton type="button" shape="circle" variant="ghost" className="luma-icon-button" aria-label="Seek backward" title="Seek backward" disabled={disabled} onClick={props.onSeekBackward}><IconSeekBackward size={20} /></GlassButton>}
            <GlassButton type="button" shape="circle" variant="primary" className="luma-icon-button luma-play-button" aria-label={props.isPlaying ? 'Pause' : 'Play'} title={props.isPlaying ? 'Pause' : 'Play'} disabled={disabled} onClick={props.onTogglePlay}>{props.isPlaying ? <IconPause size={28} /> : <IconPlay size={28} />}</GlassButton>
            {!compact && <GlassButton type="button" shape="circle" variant="ghost" className="luma-icon-button" aria-label="Seek forward" title="Seek forward" disabled={disabled} onClick={props.onSeekForward}><IconSeekForward size={20} /></GlassButton>}
            <GlassButton type="button" shape="circle" variant="ghost" className="luma-icon-button" aria-label="Next track" title="Next track" disabled={disabled} onClick={props.onNextTrack}><IconNextTrack size={26} /></GlassButton>
            {compact && <GlassButton type="button" shape="circle" variant={(props.loopMode !== 'off') ? 'secondary' : 'ghost'} className="luma-icon-button" aria-label={`Repeat ${props.loopMode === 'one' ? 'current track' : props.loopMode}`} title={`Repeat ${props.loopMode === 'one' ? 'current track' : props.loopMode}`} aria-pressed={props.loopMode !== 'off'} disabled={disabled} onClick={props.onToggleLoop}><IconLoop size={20} variant={props.loopMode} /></GlassButton>}
            {compact && <GlassButton type="button" shape="circle" variant={(more) ? 'secondary' : 'ghost'} className="luma-icon-button" aria-label="More playback controls" title="More playback controls" aria-expanded={more} aria-controls={more ? id : undefined} onClick={() => { setMore(!more); setTimer(false); }}><IconMoreVertical size={18} /></GlassButton>}
        </div>
        {(!compact || more) && <SecondaryContainer id={id} className="luma-secondary-controls" role="group" aria-label="Additional playback controls">
            {compact
                ? <GlassButton type="button" shape="circle" variant="ghost" className="luma-icon-button" aria-label="Seek backward" title="Seek backward" disabled={disabled} onClick={props.onSeekBackward}><IconSeekBackward size={20} /></GlassButton>
                : <GlassButton type="button" shape="circle" variant={(props.isShuffle) ? 'secondary' : 'ghost'} className="luma-icon-button" aria-label={props.isShuffle ? 'Shuffle on' : 'Shuffle off'} title={props.isShuffle ? 'Shuffle on' : 'Shuffle off'} aria-pressed={props.isShuffle} disabled={disabled} onClick={props.onToggleShuffle}><IconShuffle size={20} variant={props.isShuffle ? 'on' : 'off'} /></GlassButton>}
            <GlassButton type="button" shape="circle" variant={(Boolean(props.sleepTimer?.active)) || (timer) ? 'secondary' : 'ghost'} className="luma-icon-button" aria-label="Sleep timer" title="Sleep timer" aria-expanded={timer} aria-pressed={Boolean(props.sleepTimer?.active)} onClick={() => setTimer(!timer)}><IconTimer size={20} />{props.sleepTimer?.active && <span className="luma-status-dot" />}</GlassButton>
            {compact
                ? <GlassButton type="button" shape="circle" variant="ghost" className="luma-icon-button" aria-label="Seek forward" title="Seek forward" disabled={disabled} onClick={props.onSeekForward}><IconSeekForward size={20} /></GlassButton>
                : <GlassButton type="button" shape="circle" variant={(props.loopMode !== 'off') ? 'secondary' : 'ghost'} className="luma-icon-button" aria-label={`Repeat ${props.loopMode === 'one' ? 'current track' : props.loopMode}`} title={`Repeat ${props.loopMode === 'one' ? 'current track' : props.loopMode}`} aria-pressed={props.loopMode !== 'off'} disabled={disabled} onClick={props.onToggleLoop}><IconLoop size={20} variant={props.loopMode} /></GlassButton>}
            <div className={compact ? 'luma-compact-volume' : ''}><VolumeControl volume={props.volume} onVolumeChange={props.onVolumeChange} /></div>
        </SecondaryContainer>}
        {timer && <SleepTimerMenu onClose={() => setTimer(false)} onSetTimer={props.onSetSleepTimer} activeTimer={props.sleepTimer} onCancelTimer={props.onCancelSleepTimer} currentSongDuration={props.duration} currentTime={props.currentTime} className="luma-sleep-popover" />}
    </div>;
}
