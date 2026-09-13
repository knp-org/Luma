import { describe, test, expect } from "vitest";
import { nextIndex, moveQueueItem } from "../src/utils/queue";
import { smartSongs } from "../src/utils/smartPlaylists";
import { Song } from "../src/models";
const songs: Song[] = ["A", "B", "C"].map((path, i) => ({
  path,
  title: path,
  duration_seconds: 60,
  file_size_bytes: 1,
  has_album_art: false,
  added_at: i + 1,
  genre: i === 2 ? "Jazz" : "Rock",
  year: 1990 + i * 10,
}));
describe("queue selection", () => {
  test("natural end stops without repeat but manual Next wraps", () => {
    expect(nextIndex(songs, 2, "off", false, true)).toBe(-1);
    expect(nextIndex(songs, 2, "off", false, false)).toBe(0);
  });
  test("missing files are skipped and an entirely missing queue stops", () => {
    expect(
      nextIndex(
        [songs[0], { ...songs[1], missing: true }, songs[2]],
        0,
        "off",
        false,
      ),
    ).toBe(2);
    expect(
      nextIndex(
        songs.map((song) => ({ ...song, missing: true })),
        0,
        "all",
        true,
      ),
    ).toBe(-1);
  });
  test("duplicate paths still preserve the actual playing entry on reorder", () => {
    expect(moveQueueItem([songs[0], songs[1], songs[0]], 2, 2, 0).current).toBe(
      0,
    );
  });
});
describe("smart playlists", () => {
  test("recent, most played and never played use distinct orderings", () => {
    const counts = { A: 3, C: 10 };
    expect(
      smartSongs(songs, counts, { name: "", mode: "recent" }).map(
        (s) => s.path,
      ),
    ).toEqual(["C", "B", "A"]);
    expect(
      smartSongs(songs, counts, { name: "", mode: "most" }).map((s) => s.path),
    ).toEqual(["C", "A"]);
    expect(
      smartSongs(songs, counts, { name: "", mode: "never" }).map((s) => s.path),
    ).toEqual(["B"]);
  });
  test("combines genre and year filters without changing the library", () => {
    expect(
      smartSongs(
        songs,
        {},
        {
          name: "",
          mode: "filter",
          genre: "rock",
          yearFrom: 2000,
          yearTo: 2010,
        },
      ).map((s) => s.path),
    ).toEqual(["B"]);
    expect(songs[0].path).toBe("A");
  });
});
