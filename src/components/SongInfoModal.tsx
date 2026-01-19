import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Song } from '../types';
import { AlbumArt } from './AlbumArt';

interface SongInfoModalProps {
    song: Song;
    onClose: () => void;
    onSongUpdate?: (updatedSong: Song) => void;
}

export function SongInfoModal({ song, onClose, onSongUpdate }: SongInfoModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(song.title || "");
    const [editedArtist, setEditedArtist] = useState(song.artist || "");
    const [editedAlbum, setEditedAlbum] = useState(song.album || "");
    const [editedGenre, setEditedGenre] = useState(song.genre || "");
    const [editedYear, setEditedYear] = useState(song.year?.toString() || "");
    const [editedTrack, setEditedTrack] = useState(song.track_number?.toString() || "");
    const [isSaving, setIsSaving] = useState(false);

    async function handleSave() {
        setIsSaving(true);
        try {
            const yearNum = editedYear ? parseInt(editedYear) || null : null;
            const trackNum = editedTrack ? parseInt(editedTrack) || null : null;

            await invoke("update_song_metadata", {
                path: song.path,
                title: editedTitle,
                artist: editedArtist,
                album: editedAlbum,
                genre: editedGenre,
                year: yearNum,
                track_number: trackNum
            });

            if (onSongUpdate) {
                onSongUpdate({
                    ...song,
                    title: editedTitle,
                    artist: editedArtist,
                    album: editedAlbum,
                    genre: editedGenre,
                    year: yearNum || undefined,
                    track_number: trackNum || undefined
                });
            }

            onClose();
        } catch (e) {
            console.error("Failed to save metadata", e);
            alert("Failed to save changes: " + e);
        }
        setIsSaving(false);
    }

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with album art */}
                <div className="relative h-64 bg-neutral-950 flex items-center justify-center overflow-hidden border-b border-white/5">
                    {/* Blurred background version */}
                    <div className="absolute inset-0 opacity-30 blur-2xl scale-125 pointer-events-none">
                        <AlbumArt
                            song={song}
                            className="w-full h-full"
                        />
                    </div>

                    {/* Centered square art */}
                    <div className="relative z-10 w-40 h-40 shadow-2xl rounded-xl overflow-hidden border border-white/10 group">
                        <AlbumArt
                            song={song}
                            className="w-full h-full"
                            placeholderContent={<div className="text-6xl">💿</div>}
                            useOriginal={true}
                        />
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent pointer-events-none"></div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all z-20"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                    </button>

                    {/* Edit Toggle (only if not editing) */}
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-2 text-white/70 hover:text-white transition-all z-20 text-sm font-medium"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                            </svg>
                            Edit Tags
                        </button>
                    )}
                </div>

                {/* Metadata */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hidden">
                    {isEditing ? (
                        <div className="space-y-4">
                            {/* Reuse input style */}
                            {(() => {
                                const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20";
                                const labelClass = "text-xs font-mono uppercase text-white/40 block mb-1";
                                return (
                                    <>
                                        <div>
                                            <label className={labelClass}>Title</label>
                                            <input
                                                type="text"
                                                value={editedTitle}
                                                onChange={(e) => setEditedTitle(e.target.value)}
                                                className={inputClass}
                                                placeholder="Song Title"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClass}>Artist</label>
                                                <input
                                                    type="text"
                                                    value={editedArtist}
                                                    onChange={(e) => setEditedArtist(e.target.value)}
                                                    className={inputClass}
                                                    placeholder="Artist Name"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Album</label>
                                                <input
                                                    type="text"
                                                    value={editedAlbum}
                                                    onChange={(e) => setEditedAlbum(e.target.value)}
                                                    className={inputClass}
                                                    placeholder="Album Name"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="col-span-1">
                                                <label className={labelClass}>Track #</label>
                                                <input
                                                    type="text"
                                                    value={editedTrack}
                                                    onChange={(e) => setEditedTrack(e.target.value.replace(/\D/g, ''))}
                                                    className={inputClass}
                                                    placeholder="1"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className={labelClass}>Year</label>
                                                <input
                                                    type="text"
                                                    value={editedYear}
                                                    onChange={(e) => setEditedYear(e.target.value.replace(/\D/g, ''))}
                                                    className={inputClass}
                                                    placeholder="2024"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className={labelClass}>Genre</label>
                                                <input
                                                    type="text"
                                                    value={editedGenre}
                                                    onChange={(e) => setEditedGenre(e.target.value)}
                                                    className={inputClass}
                                                    placeholder="Pop"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-4 border-t border-white/5">
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 transition-colors text-sm font-medium"
                                                disabled={isSaving}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="flex-1 py-2.5 bg-white hover:bg-white/90 rounded-xl text-black font-bold transition-all text-sm shadow-lg shadow-white/5"
                                                disabled={isSaving}
                                            >
                                                {isSaving ? "Saving..." : "Save Changes"}
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    ) : (
                        <>
                            <div>
                                <h2 className="text-2xl font-bold text-white leading-tight">{song.title || "Unknown Title"}</h2>
                                <p className="text-white/50 text-lg">{song.artist || "Unknown Artist"}</p>
                            </div>

                            <div className="space-y-2 text-sm pt-2">
                                <InfoRow label="Album" value={song.album || "—"} />
                                <InfoRow label="Genre" value={song.genre || "—"} />
                                <InfoRow label="Track #" value={song.track_number?.toString() || "—"} />
                                <InfoRow label="Year" value={song.year?.toString() || "—"} />
                                <InfoRow
                                    label="Duration"
                                    value={`${Math.floor(song.duration_seconds / 60)}:${String(song.duration_seconds % 60).padStart(2, '0')}`}
                                    mono
                                />

                                {/* Technical Info Group */}
                                <div className="pt-4 mt-2 border-t border-white/10">
                                    <div className="text-white/30 font-mono uppercase text-xs mb-3">Technical Info</div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        <InfoRow label="Bitrate" value={song.bitrate ? `${song.bitrate} kbps` : "—"} mono compact />
                                        <InfoRow label="Sample Rate" value={song.sample_rate ? `${song.sample_rate} Hz` : "—"} mono compact />
                                        <InfoRow label="Bit Depth" value={song.bits_per_sample ? `${song.bits_per_sample}-bit` : "—"} mono compact />
                                        <InfoRow label="Channels" value={song.channels ? (song.channels === 1 ? "Mono" : song.channels === 2 ? "Stereo" : `${song.channels} ch`) : "—"} mono compact />
                                    </div>
                                    <div className="mt-2">
                                        <InfoRow
                                            label="File Size"
                                            value={song.file_size_bytes > 1048576
                                                ? `${(song.file_size_bytes / 1048576).toFixed(2)} MB`
                                                : `${(song.file_size_bytes / 1024).toFixed(2)} KB`
                                            }
                                            mono
                                        />
                                    </div>
                                </div>

                                {/* File Path */}
                                <div className="pt-2 mt-4 border-t border-white/10">
                                    <span className="text-white/30 font-mono uppercase text-xs block mb-1">File Path</span>
                                    <span className="text-white/40 text-xs break-all font-mono leading-relaxed select-text">{song.path}</span>
                                </div>
                            </div>
                        </>
                    )}

                    {!isEditing && (
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 bg-white/10 hover:bg-white/15 rounded-xl text-white/80 hover:text-white transition-colors text-sm font-medium mt-4"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value, mono, compact }: { label: string; value: string; mono?: boolean, compact?: boolean }) {
    return (
        <div className={`flex justify-between border-b border-white/5 ${compact ? 'pb-1' : 'pb-2'}`}>
            <span className="text-white/40 font-mono uppercase text-xs">{label}</span>
            <span className={`text-white/80 ${mono ? 'font-mono' : ''} ${compact ? 'text-xs' : 'text-sm'}`}>{value}</span>
        </div>
    );
}
