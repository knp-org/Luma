import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Playlist, UsePlaylistsProps } from "../models";
import { useModal } from "./useModal";

export function usePlaylists({ currentSong }: UsePlaylistsProps) {
  const { showAlert } = useModal();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const updates = useRef(Promise.resolve());
  const loadPlaylists = useCallback(async () => {
    let result = await invoke<Playlist[]>("get_playlists");
    if (!result.find((playlist) => playlist.name === "Favorites")) {
      try {
        await invoke("create_playlist", { name: "Favorites" });
      } catch (e) {
        if (!String(e).includes("already exists")) throw e;
      }
      result = await invoke<Playlist[]>("get_playlists");
    }
    setPlaylists(result);
  }, []);
  useEffect(() => {
    const refresh = () => {
      void loadPlaylists().catch(console.error);
    };
    refresh();
    window.addEventListener("playlists-changed", refresh);
    return () => window.removeEventListener("playlists-changed", refresh);
  }, [loadPlaylists]);
  useEffect(() => {
    const outside = () => setMenuOpenFor(null);
    window.addEventListener("click", outside);
    return () => window.removeEventListener("click", outside);
  }, []);
  function addToPlaylist(
    playlistName: string,
    songPath: string,
    keepOpen = false,
  ) {
    const task = updates.current
      .then(async () => {
        const latest = await invoke<Playlist[]>("get_playlists");
        const playlist = latest.find(
          (playlist) => playlist.name === playlistName,
        );
        if (!playlist) await invoke("create_playlist", { name: playlistName });
        await invoke(
          playlist?.tracks.includes(songPath)
            ? "remove_from_playlist"
            : "add_to_playlist",
          { playlistName, songPath },
        );
        await loadPlaylists();
        if (!keepOpen) setMenuOpenFor(null);
      })
      .catch((error) => {
        void showAlert(`Failed to update playlist: ${error}`, "Error");
      });
    updates.current = task;
    return task;
  }
  async function deletePlaylist(playlistName: string) {
    try {
      await invoke("delete_playlist", { playlistName });
      await loadPlaylists();
    } catch (error) {
      void showAlert(`Failed to delete playlist: ${error}`, "Error");
    }
  }
  async function handleToggleFavorite() {
    if (currentSong) await addToPlaylist("Favorites", currentSong.path, true);
  }
  const isFavorite =
    !!currentSong &&
    !!playlists
      .find((playlist) => playlist.name === "Favorites")
      ?.tracks.includes(currentSong.path);
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
