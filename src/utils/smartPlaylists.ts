import { Song } from "../models";
export interface SmartRule {
  name: string;
  mode: "recent" | "never" | "most" | "filter";
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
}
export function smartSongs(
  songs: Song[],
  counts: Record<string, number>,
  rule: SmartRule,
): Song[] {
  return songs
    .filter((song) => {
      if (song.missing) return false;
      if (
        rule.genre &&
        !song.genre?.toLowerCase().includes(rule.genre.toLowerCase())
      )
        return false;
      if (rule.yearFrom && (!song.year || song.year < rule.yearFrom))
        return false;
      if (rule.yearTo && (!song.year || song.year > rule.yearTo)) return false;
      return rule.mode !== "never" || !counts[song.path];
    })
    .filter((song) => rule.mode !== "most" || (counts[song.path] || 0) > 0)
    .sort((a, b) =>
      rule.mode === "recent"
        ? (b.added_at || 0) - (a.added_at || 0)
        : rule.mode === "most"
          ? (counts[b.path] || 0) - (counts[a.path] || 0)
          : (a.title || a.path).localeCompare(b.title || b.path),
    )
    .slice(0, rule.mode === "recent" || rule.mode === "most" ? 100 : undefined);
}
