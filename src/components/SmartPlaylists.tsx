import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Song } from "../models";
import { SmartRule, smartSongs } from "../utils/smartPlaylists";
import { GlassButton, GlassInput, GlassCard } from "@knp-org/liquid-glass-ui";
const builtins: SmartRule[] = [
  { name: "Recently added", mode: "recent" },
  { name: "Never played", mode: "never" },
  { name: "Most played", mode: "most" },
];
const storageKey = "luma-smart-playlists";
export function SmartPlaylists({
  songs,
  onPlay,
}: {
  songs: Song[];
  onPlay: (songs: Song[]) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<SmartRule[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(value)
        ? value.filter(
            (rule) =>
              rule &&
              typeof rule.name === "string" &&
              ["recent", "never", "most", "filter"].includes(rule.mode),
          )
        : [];
    } catch {
      return [];
    }
  });
  const [rule, setRule] = useState<SmartRule>({ name: "", mode: "filter" });
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () =>
      invoke<{ path: string; count: number }[]>("get_play_stats")
        .then((stats) => {
          if (active)
            setCounts(
              Object.fromEntries(stats.map((item) => [item.path, item.count])),
            );
        })
        .catch((error) => {
          if (active) setMessage(String(error));
        });
    void refresh();
    window.addEventListener("play-stats-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("play-stats-changed", refresh);
    };
  }, []);
  const rules = useMemo(
    () =>
      [...builtins, ...saved].map((rule) => ({
        rule,
        tracks: smartSongs(songs, counts, rule),
      })),
    [songs, counts, saved],
  );
  function persist(next: SmartRule[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(next);
      setMessage("");
    } catch (e) {
      setMessage(String(e));
    }
  }
  return (
    <section className="mb-6 space-y-3">
      <h2 className="text-lg font-semibold">Smart playlists</h2>
      <p className="text-xs text-white/50">
        These collections update as your library and listening history change.
        Recent and most played show up to 100 tracks.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rules.map(({ rule, tracks }, index) => (
          <GlassCard key={index} className="p-3">
            <div className="font-medium text-sm">{rule.name}</div>
            <div className="text-xs text-white/40 mb-2">
              {tracks.length} tracks
            </div>
            <div className="flex gap-2">
              <GlassButton
                disabled={!tracks.length}
                onClick={() => onPlay(tracks)}
              >
                Play
              </GlassButton>
              {index >= builtins.length && (
                <GlassButton
                  aria-label={`Delete ${rule.name}`}
                  onClick={() =>
                    persist(
                      saved.filter((_, i) => i !== index - builtins.length),
                    )
                  }
                >
                  ×
                </GlassButton>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-white/70">
          Create a smart playlist
        </summary>
        <form
          className="mt-3 flex gap-2 flex-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rule.name.trim()) return;
            if (rule.yearFrom && rule.yearTo && rule.yearFrom > rule.yearTo) {
              setMessage("Start year must be before the end year.");
              return;
            }
            persist([...saved, { ...rule, name: rule.name.trim() }]);
            setRule({ name: "", mode: "filter" });
          }}
        >
          <GlassInput
            aria-label="Smart playlist name"
            placeholder="Name"
            value={rule.name}
            onChange={(e) => setRule({ ...rule, name: e.target.value })}
            required
          />
          <GlassInput
            aria-label="Genre filter"
            placeholder="Genre (optional)"
            value={rule.genre || ""}
            onChange={(e) => setRule({ ...rule, genre: e.target.value })}
          />
          <GlassInput
            aria-label="Start year"
            type="number"
            min="1"
            max="9999"
            placeholder="From year"
            value={rule.yearFrom || ""}
            onChange={(e) =>
              setRule({
                ...rule,
                yearFrom: Number(e.target.value) || undefined,
              })
            }
          />
          <GlassInput
            aria-label="End year"
            type="number"
            min="1"
            max="9999"
            placeholder="To year"
            value={rule.yearTo || ""}
            onChange={(e) =>
              setRule({ ...rule, yearTo: Number(e.target.value) || undefined })
            }
          />
          <select
            aria-label="Listening filter"
            className="bg-neutral-900 rounded p-2"
            value={rule.mode}
            onChange={(e) =>
              setRule({ ...rule, mode: e.target.value as SmartRule["mode"] })
            }
          >
            <option value="filter">All matching tracks</option>
            <option value="never">Never played</option>
            <option value="most">Most played</option>
            <option value="recent">Recently added</option>
          </select>
          <GlassButton type="submit">Save rule</GlassButton>
        </form>
      </details>
      {message && (
        <p role="status" className="text-sm text-amber-200">
          {message}
        </p>
      )}
    </section>
  );
}
