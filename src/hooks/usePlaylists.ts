import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Playlist, UsePlaylistsProps, UsePlaylistsReturn } from "../models";
import { useModal } from "./useModal";

export function usePlaylists({ currentSong }: UsePlaylistsProps): UsePlaylistsReturn {
    const { showAlert } = useModal();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

    const isFavorite = currentSong
        ? playlists.find(p => p.name === "Favorites")?.tracks.includes(currentSong.path) || false
        : false;

    useEffect(() => {
        loadPlaylists();
    }, []);

    useEffect(() => {
        const handleClickOutside = () => {
            if (menuOpenFor) {
                setMenuOpenFor(null);
            }
        };
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, [menuOpenFor]);

    async function loadPlaylists() {
        try {
            let result = await invoke<Playlist[]>("get_playlists");
            if (!result.find(p => p.name === "Favorites")) {
                await invoke("create_playlist", { name: "Favorites" });
                result = await invoke<Playlist[]>("get_playlists");
            }
            setPlaylists(result);
        } catch (e) {
            console.error(e);
        }
    }

    async function addToPlaylist(playlistName: string, songPath: string, keepOpen = false) {
        try {
            const playlist = playlists.find(p => p.name === playlistName);
            const isAdded = playlist?.tracks.includes(songPath);

            if (isAdded) {
                await invoke("remove_from_playlist", { playlistName, songPath });
            } else {
                try {
                    await invoke("add_to_playlist", { playlistName, songPath });
                } catch (e: any) {
                    if (typeof e === 'string' && e.includes("Playlist not found")) {
                        await invoke("create_playlist", { name: playlistName });
                        await invoke("add_to_playlist", { playlistName, songPath });
                    } else {
                        throw e;
                    }
                }
            }

            await loadPlaylists();
            if (!keepOpen) {
                setMenuOpenFor(null);
            }
        } catch (e) {
            showAlert("Failed to update playlist: " + e, "Error");
        }
    }

    async function deletePlaylist(playlistName: string) {
        try {
            await invoke("delete_playlist", { playlistName });
            await loadPlaylists();
            if (menuOpenFor) {
                setMenuOpenFor(null);
            }
        } catch (e) {
            showAlert("Failed to delete playlist: " + e, "Error");
        }
    }

    async function handleToggleFavorite() {
        if (currentSong) {
            await addToPlaylist("Favorites", currentSong.path, true);
        }
    }

    return {
        playlists,
        loadPlaylists,
        addToPlaylist,
        deletePlaylist,
        isFavorite,
        handleToggleFavorite,
        menuOpenFor,
        setMenuOpenFor,
    };
}
