import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Song, LoopMode, UsePlayerProps } from "../models";
import { nextIndex, moveQueueItem } from "../utils/queue";

export interface PlaybackStatus {
  path: string | null;
  generation: number;
  position_secs: number;
  finished: boolean;
  paused: boolean;
}
export function usePlayer({ songs, seekInterval }: UsePlayerProps) {
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>("off");
  const [volume, setVolume] = useState(0.5);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const trackLoadedRef = useRef(false);
  const knownGeneration = useRef(0);
  const planned = useRef(-1);
  const pending = useRef(0);
  const chain = useRef(Promise.resolve());
  const latest = useRef({
    queue,
    currentIndex,
    isPlaying,
    currentTime,
    isShuffle,
    loopMode,
    volume,
  });
  latest.current = {
    queue,
    currentIndex,
    isPlaying,
    currentTime,
    isShuffle,
    loopMode,
    volume,
  };
  const currentSong = queue[currentIndex] || null;

  function enqueue(action: () => Promise<void>): Promise<void> {
    pending.current++;
    const task = chain.current
      .then(action)
      .catch((e) => {
        setError(String(e));
      })
      .finally(() => {
        pending.current--;
      });
    chain.current = task;
    return task;
  }
  function countPlay(path: string) {
    invoke("increment_play_count", { path })
      .then(() => window.dispatchEvent(new Event("play-stats-changed")))
      .catch((e) => setError(`Could not save listening history: ${e}`));
  }
  function applyStatus(status: PlaybackStatus) {
    latest.current = {
      ...latest.current,
      isPlaying: !status.paused && !status.finished,
      currentTime: status.position_secs,
    };
    knownGeneration.current = status.generation;
    setGeneration(status.generation);
    setCurrentTime(status.position_secs);
    setIsPlaying(!status.paused && !status.finished);
    trackLoadedRef.current = !!status.path && !status.finished;
  }
  async function start(
    track: Song,
    index: number,
    context: Song[],
    seconds = 0,
    paused = false,
    count = true,
  ) {
    if (track.missing)
      throw new Error(
        "This file is unavailable. Locate it in Settings or reconnect its drive.",
      );
    const status = await invoke<PlaybackStatus>("play_track", {
      path: track.path,
      seconds,
      paused,
    });
    latest.current = {
      ...latest.current,
      queue: context,
      currentIndex: index,
      currentTime: seconds,
      isPlaying: !paused,
    };
    setQueue(context);
    setCurrentIndex(index);
    applyStatus(status);
    setError(null);
    if (count) countPlay(track.path);
  }
  function playSong(song: Song, context = songs) {
    return enqueue(async () => {
      const index = context.findIndex((item) => item.path === song.path);
      await start(song, index < 0 ? 0 : index, index < 0 ? [song] : context);
    });
  }
  function playIndex(index: number) {
    return enqueue(async () => {
      const state = latest.current;
      if (state.queue[index])
        await start(state.queue[index], index, state.queue);
    });
  }
  function playTrackInternal(path: string) {
    const state = latest.current;
    const index = state.queue.findIndex((song) => song.path === path);
    return playIndex(index);
  }
  function togglePlay() {
    return enqueue(async () => {
      const state = latest.current;
      const song = state.queue[state.currentIndex];
      if (!song) return;
      if (!trackLoadedRef.current)
        await start(
          song,
          state.currentIndex,
          state.queue,
          state.currentTime,
          false,
          false,
        );
      else applyStatus(await invoke<PlaybackStatus>("toggle_playback"));
    });
  }
  function stop() {
    return enqueue(async () => {
      applyStatus(await invoke<PlaybackStatus>("stop_playback"));
      setCurrentTime(0);
    });
  }
  function nextTrack(auto = false) {
    return enqueue(async () => {
      const state = latest.current;
      const index = nextIndex(
        state.queue,
        state.currentIndex,
        state.loopMode,
        state.isShuffle,
        auto === true,
      );
      if (index < 0) {
        applyStatus(await invoke<PlaybackStatus>("stop_playback"));
        setCurrentTime(0);
        return;
      }
      await start(state.queue[index], index, state.queue);
    });
  }
  function prevTrack() {
    return enqueue(async () => {
      const state = latest.current;
      const before = state.queue
        .map((_, i) => i)
        .filter((i) => !state.queue[i].missing && i < state.currentIndex);
      const index =
        before.at(-1) ?? state.queue.findLastIndex((song) => !song.missing);
      if (index >= 0) await start(state.queue[index], index, state.queue);
    });
  }
  function seekTo(seconds: number) {
    return enqueue(async () => {
      const state = latest.current;
      const song = state.queue[state.currentIndex];
      if (!song || !Number.isFinite(seconds)) return;
      const position = Math.max(
        0,
        Math.min(seconds, song.duration_seconds || seconds),
      );
      if (!trackLoadedRef.current) {
        setCurrentTime(position);
        return;
      }
      applyStatus(
        await invoke<PlaybackStatus>("seek_track", { seconds: position }),
      );
    });
  }
  function handleVolumeChange(value: number) {
    return enqueue(async () => {
      const volume = Math.max(0, Math.min(value, 1));
      await invoke("set_player_volume", { volume });
      setVolume(volume);
    });
  }
  function handlePlayPlaylist(context: Song[], index = 0, shuffle = false) {
    return enqueue(async () => {
      if (!context.length) return;
      const playable = context
        .map((song, i) => ({ song, i }))
        .filter(({ song }) => !song.missing);
      if (!playable.length)
        throw new Error("No available tracks in this collection.");
      if (shuffle)
        index = playable[Math.floor(Math.random() * playable.length)].i;
      if (!context[index] || context[index].missing) index = playable[0].i;
      await start(context[index], index, context);
      setIsShuffle(shuffle);
    });
  }
  function addToQueue(song: Song, next = false) {
    const state = latest.current;
    const copy = [...state.queue];
    copy.splice(
      next ? Math.max(0, state.currentIndex + 1) : copy.length,
      0,
      song,
    );
    const index = state.currentIndex < 0 ? 0 : state.currentIndex;
    latest.current = { ...state, queue: copy, currentIndex: index };
    setQueue(copy);
    setCurrentIndex(index);
  }
  function moveQueue(from: number, to: number) {
    const state = latest.current;
    const result = moveQueueItem(state.queue, state.currentIndex, from, to);
    latest.current = {
      ...state,
      queue: result.queue,
      currentIndex: result.current,
    };
    setQueue(result.queue);
    setCurrentIndex(result.current);
  }
  function removeFromQueue(index: number) {
    return enqueue(async () => {
      const state = latest.current;
      if (!state.queue[index]) return;
      const remaining = state.queue.filter((_, i) => i !== index);
      if (index === state.currentIndex) {
        const next = nextIndex(
          remaining,
          Math.min(index, remaining.length) - 1,
          "all",
          false,
        );
        if (next >= 0)
          await start(remaining[next], next, remaining, 0, !state.isPlaying);
        else {
          applyStatus(await invoke<PlaybackStatus>("stop_playback"));
          latest.current = {
            ...latest.current,
            queue: remaining,
            currentIndex: -1,
            currentTime: 0,
          };
          setQueue(remaining);
          setCurrentIndex(-1);
          setCurrentTime(0);
        }
      } else {
        const current =
          state.currentIndex - (index < state.currentIndex ? 1 : 0);
        latest.current = { ...state, queue: remaining, currentIndex: current };
        setQueue(remaining);
        setCurrentIndex(current);
      }
    });
  }
  // Preload a concrete next track. Shuffle uses the same choice for the transition.
  useEffect(() => {
    if (!trackLoadedRef.current || !generation) return;
    const index = nextIndex(queue, currentIndex, loopMode, isShuffle, true);
    planned.current = index;
    let active = true;
    void enqueue(async () => {
      if (!active) return;
      await invoke("preload_track", {
        path: index >= 0 ? queue[index].path : null,
        generation,
      });
    });
    return () => {
      active = false;
    };
  }, [queue, currentIndex, loopMode, isShuffle, generation]);

  useEffect(() => {
    let active = true,
      polling = false;
    const timer = window.setInterval(async () => {
      if (pending.current || polling || !trackLoadedRef.current) return;
      polling = true;
      try {
        const status = await invoke<PlaybackStatus>("get_playback_status");
        if (
          !active ||
          pending.current ||
          status.generation < knownGeneration.current
        )
          return;
        if (status.generation !== knownGeneration.current) {
          const state = latest.current;
          const next = planned.current;
          const index =
            state.queue[next]?.path === status.path
              ? next
              : state.queue.findIndex((song) => song.path === status.path);
          if (index >= 0) {
            setCurrentIndex(index);
            latest.current = { ...state, currentIndex: index };
            if (status.path) countPlay(status.path);
          }
        }
        applyStatus(status);
        if (status.finished && !status.paused) void nextTrack(true);
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        polling = false;
      }
    }, 250);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return {
    queue,
    setQueue,
    currentIndex,
    setCurrentIndex,
    currentSong,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    volume,
    setVolume,
    isShuffle,
    setIsShuffle,
    loopMode,
    setLoopMode,
    trackLoadedRef,
    playTrackInternal,
    playSong,
    playIndex,
    togglePlay,
    stop,
    toggleShuffle: () => setIsShuffle((value) => !value),
    toggleLoop: () =>
      setLoopMode((value) =>
        value === "off" ? "all" : value === "all" ? "one" : "off",
      ),
    nextTrack,
    prevTrack,
    seekTo,
    seekForward: () => seekTo(latest.current.currentTime + seekInterval),
    seekBackward: () => seekTo(latest.current.currentTime - seekInterval),
    handleVolumeChange,
    handlePlayPlaylist,
    addToQueue,
    moveQueue,
    removeFromQueue,
    error,
    clearError: () => setError(null),
  };
}
