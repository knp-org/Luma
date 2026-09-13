import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Song } from "../models";
import { SmartRule, smartSongs } from "../utils/smartPlaylists";
import { GlassButton, GlassInput, GlassCard, GlassSelect, GlassText } from "@knp-org/liquid-glass-ui";
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
      <p className="text-xs text-white/65">
        These collections update as your library and listening history change.
        Recent and most played show up to 100 tracks.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rules.map(({ rule, tracks }, index) => (
          <GlassCard key={index} className="p-3">
            <div className="font-medium text-sm">{rule.name}</div>
            <div className="text-xs text-white/65 mb-2">
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
        <GlassCard className="luma-smart-playlist-editor">
          <GlassText variant="muted" className="mb-4">
            Give your playlist a name, then choose optional filters.
          </GlassText>
          <form
            className="luma-smart-playlist-form"
            aria-label="Create a smart playlist"
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
              label="Name"
              containerClassName="luma-smart-playlist-wide"
              aria-label="Smart playlist name"
              placeholder="e.g. Evening jazz"
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
              required
            />
            <GlassInput
              label="Genre (optional)"
              containerClassName="luma-smart-playlist-wide"
              aria-label="Genre filter"
              placeholder="Any genre"
              value={rule.genre || ""}
              onChange={(e) => setRule({ ...rule, genre: e.target.value })}
            />
            <GlassInput
              label="From year"
              aria-label="Start year"
              type="number"
              min="1"
              max="9999"
              placeholder="Any"
              value={rule.yearFrom || ""}
              onChange={(e) =>
                setRule({
                  ...rule,
                  yearFrom: Number(e.target.value) || undefined,
                })
              }
            />
            <GlassInput
              label="To year"
              aria-label="End year"
              type="number"
              min="1"
              max="9999"
              placeholder="Any"
              value={rule.yearTo || ""}
              onChange={(e) =>
                setRule({ ...rule, yearTo: Number(e.target.value) || undefined })
              }
            />
            <GlassSelect
              label="Listening filter"
              containerClassName="luma-smart-playlist-wide"
              value={rule.mode}
              onChange={(value) => setRule({ ...rule, mode: value as SmartRule["mode"] })}
              options={[
                { value: 'filter', label: 'All matching tracks' },
                { value: 'never', label: 'Never played' },
                { value: 'most', label: 'Most played' },
                { value: 'recent', label: 'Recently added' },
              ]}
            />
            <div className="luma-smart-playlist-actions">
              <GlassButton type="submit" variant="primary">Create smart playlist</GlassButton>
            </div>
          </form>
        </GlassCard>
      </details>
      {message && (
        <p role="status" className="text-sm text-amber-200">
          {message}
        </p>
      )}
    </section>
  );
}
