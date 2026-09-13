import { test, expect, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { updateSongMetadata } from "../src/services/metadata";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
test("metadata crosses the Tauri boundary with trackNumber, including explicit removal", async () => {
  const fields = {
    path: "/music/song.wav",
    title: "Song",
    artist: "Artist",
    album: "Album",
    genre: "Jazz",
    year: 2000,
  };
  await updateSongMetadata({ ...fields, trackNumber: 7 });
  expect(invoke).toHaveBeenLastCalledWith("update_song_metadata", {
    ...fields,
    trackNumber: 7,
  });
  await updateSongMetadata({ ...fields, trackNumber: null });
  expect(invoke).toHaveBeenLastCalledWith("update_song_metadata", {
    ...fields,
    trackNumber: null,
  });
});
