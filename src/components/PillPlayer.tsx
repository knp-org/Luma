import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { GlassButton, GlassCard, IconMaximize, IconMusicNote, IconNextTrack, IconPause, IconPlay, IconPrevTrack, IconSeekBackward, IconSeekForward } from '@knp-org/liquid-glass-ui';
import { AlbumArt } from './AlbumArt';
import type { Song } from '../models';

interface PillPlayerProps {
    song: Song | null;
    isPlaying: boolean;
    busy: boolean;
    error: string;
    onRestore: () => void;
    onTogglePlay: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onSeekBackward: () => void;
    onSeekForward: () => void;
}

export function PillPlayer(props: PillPlayerProps) {
    const [dragError, setDragError] = useState('');
    useEffect(() => {
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); props.onRestore(); }
        };
        window.addEventListener('keydown', escape);
        return () => window.removeEventListener('keydown', escape);
    }, [props.onRestore]);
    const message = props.error || dragError;
    return <div className="luma-app luma-pill-shell" data-player-controls>
        <GlassCard className="luma-pill" role="region" aria-label="Floating player">
            <div className="luma-pill-drag" title="Drag to move the player"
                onPointerDown={event => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    setDragError('');
                    void getCurrentWindow().startDragging().catch(error => setDragError(String(error)));
                }}>
                {props.song
                    ? <AlbumArt song={props.song} className="luma-pill-art" />
                    : <span className="luma-pill-art"><IconMusicNote size={22} /></span>}
                <span className="luma-pill-name" title={message || props.song?.title || 'Select a song in the player'} role={message ? 'status' : undefined}>
                    {message || props.song?.title || 'No track selected'}
                </span>
            </div>
            <div className="luma-pill-controls" role="group" aria-label="Playback controls">
                <GlassButton type="button" variant="ghost" shape="circle" size="sm" aria-label="Previous track" title="Previous track" disabled={!props.song} onClick={props.onPrevious}><IconPrevTrack size={18} /></GlassButton>
                <GlassButton type="button" variant="ghost" shape="circle" size="sm" aria-label="Seek backward" title="Seek backward" disabled={!props.song} onClick={props.onSeekBackward}><IconSeekBackward size={16} /></GlassButton>
                <GlassButton type="button" variant="primary" shape="circle" className="luma-pill-play" aria-label={props.isPlaying ? 'Pause' : 'Play'} title={props.isPlaying ? 'Pause' : 'Play'} disabled={!props.song} onClick={props.onTogglePlay}>{props.isPlaying ? <IconPause size={21} /> : <IconPlay size={21} />}</GlassButton>
                <GlassButton type="button" variant="ghost" shape="circle" size="sm" aria-label="Seek forward" title="Seek forward" disabled={!props.song} onClick={props.onSeekForward}><IconSeekForward size={16} /></GlassButton>
                <GlassButton type="button" variant="ghost" shape="circle" size="sm" aria-label="Next track" title="Next track" disabled={!props.song} onClick={props.onNext}><IconNextTrack size={18} /></GlassButton>
            </div>
            <GlassButton type="button" variant="ghost" shape="circle" size="sm" aria-label="Restore full player" title="Restore full player (Esc)" disabled={props.busy} onClick={props.onRestore}><IconMaximize size={16} /></GlassButton>
        </GlassCard>
    </div>;
}
