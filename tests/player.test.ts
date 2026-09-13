import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { usePlayer, PlaybackStatus } from "../src/hooks/usePlayer";
import { Song } from "../src/models";
import { invoke } from "@tauri-apps/api/core";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const songs: Song[] = ["A", "B", "C"].map((path) => ({
  path,
  title: path,
  duration_seconds: 120,
  file_size_bytes: 1,
  has_album_art: false,
}));
let status: PlaybackStatus;
let serial: number;
const api = vi.mocked(invoke);
beforeEach(() => {
  serial = 0;
  status = {
    path: null,
    generation: 0,
    position_secs: 0,
    finished: true,
    paused: true,
  };
  api.mockReset();
  api.mockImplementation(async (command, args: any) => {
    if (command === "play_track")
      status = {
        path: args.path,
        generation: ++serial,
        position_secs: args.seconds || 0,
        paused: args.paused || false,
        finished: false,
      };
    if (command === "seek_track")
      status = { ...status, generation: ++serial, position_secs: args.seconds };
    if (command === "toggle_playback")
      status = { ...status, paused: !status.paused };
    if (command === "stop_playback")
      status = { ...status, paused: true, finished: true };
    return { ...status } as any;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const setup = () => renderHook(() => usePlayer({ songs, seekInterval: 10 }));
describe("playback controls", () => {
  test("manual Next advances in repeat-one, including accidental click arguments", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.playSong(songs[0]);
    });
    act(() => result.current.setLoopMode("one"));
    await act(async () => {
      await result.current.nextTrack({ type: "click" } as unknown as boolean);
    });
    expect(result.current.currentSong?.path).toBe("B");
  });
  test("playback failure leaves the previous track and play count intact", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.playSong(songs[0]);
    });
    api.mockImplementationOnce(async () => {
      throw new Error("Cannot decode B");
    });
    await act(async () => {
      await result.current.playSong(songs[1]);
    });
    expect(result.current.currentSong?.path).toBe("A");
    expect(result.current.error).toContain("Cannot decode B");
    expect(
      api.mock.calls.filter(([name]) => name === "increment_play_count"),
    ).toHaveLength(1);
  });
  test("rapid Next requests advance sequentially", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.playSong(songs[0]);
    });
    await act(async () => {
      await Promise.all([
        result.current.nextTrack(),
        result.current.nextTrack(),
      ]);
    });
    expect(result.current.currentSong?.path).toBe("C");
  });
  test("selection retains collection order and Next follows it", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.playSong(songs[2], [songs[2], songs[0]]);
    });
    await act(async () => {
      await result.current.nextTrack();
    });
    expect(result.current.queue.map((song) => song.path)).toEqual(["C", "A"]);
    expect(result.current.currentSong?.path).toBe("A");
  });
  test("moving and removing tracks preserves the active queue entry", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.playSong(songs[1]);
    });
    act(() => result.current.moveQueue(0, 2));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentSong?.path).toBe("B");
    await act(async () => {
      await result.current.removeFromQueue(1);
    });
    expect(result.current.currentSong?.path).toBe("B");
  });
  test("paused seek retains pause state and reports the requested position", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.playSong(songs[0]);
    });
    await act(async () => {
      await result.current.togglePlay();
    });
    await act(async () => {
      await result.current.seekTo(65.5);
    });
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(65.5);
  });
  test("automatic audio transition updates song identity without restarting the decoder", async () => {
    vi.useFakeTimers();
    const { result } = setup();
    await act(async () => {
      await result.current.playSong(songs[0]);
    });
    status = {
      path: "B",
      generation: 2,
      position_secs: 0.2,
      paused: false,
      finished: false,
    };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.currentSong?.path).toBe("B");
    expect(
      api.mock.calls.filter(([name]) => name === "play_track"),
    ).toHaveLength(1);
  });
});
