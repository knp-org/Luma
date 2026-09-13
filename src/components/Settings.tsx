import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { AppSettings, Song } from "../models";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassHeading,
  GlassProgress,
} from "@knp-org/liquid-glass-ui";

interface SettingsProps {
  settings: AppSettings;
  songs: Song[];
  onSave: (settings: AppSettings) => Promise<void>;
  scanMusic: () => Promise<void>;
  onClearCache: () => Promise<void>;
  onLocate: (oldPath: string, newPath: string) => Promise<void>;
  loading: boolean;
  warnings: string[];
  progress: { current: number; total: number } | null;
  cacheSize: number;
}
export function Settings({
  settings,
  songs,
  onSave,
  scanMusic,
  onClearCache,
  onLocate,
  loading,
  warnings,
  progress,
  cacheSize,
}: SettingsProps) {
  const [draft, setDraft] = useState(settings);
  const [folders, setFolders] = useState(settings.music_directories.join("\n"));
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [locations, setLocations] = useState<Record<string, string>>({});
  useEffect(() => {
    setDraft(settings);
    setFolders(settings.music_directories.join("\n"));
  }, [settings]);
  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  const updateAudio = (
    key: keyof AppSettings["audio"],
    value: boolean | number,
  ) =>
    setDraft((current) => ({
      ...current,
      audio: { ...current.audio, [key]: value },
    }));
  return (
    <div className="p-6 max-w-3xl mx-auto w-full space-y-5 pb-32 overflow-x-hidden">
      <div className="flex items-center justify-between gap-4">
        <GlassHeading as="h1" className="text-2xl">
          Settings
        </GlassHeading>
        <GlassButton
          variant="primary"
          disabled={busy || loading}
          onClick={() =>
            run(
              () =>
                onSave({
                  ...draft,
                  music_directories: folders
                    .split("\n")
                    .filter((path) => path.trim()),
                }),
              "Settings saved. Library refreshed.",
            )
          }
        >
          {busy ? "Saving…" : "Save settings"}
        </GlassButton>
      </div>
      {message && (
        <p role="status" className="text-sm text-white/80">
          {message}
        </p>
      )}
      <GlassCard className="p-5 space-y-3">
        <label htmlFor="music-folders" className="block font-medium">
          Music folders
        </label>
        <p className="text-sm text-white/50">
          One full folder path per line. Subfolders are included.
        </p>
        <textarea
          id="music-folders"
          value={folders}
          onChange={(e) => setFolders(e.target.value)}
          rows={4}
          className="w-full rounded-lg bg-black/30 border border-white/20 p-3 text-sm"
          placeholder="/home/you/Music"
        />
        <label className="flex gap-2 items-center text-sm">
          <input
            type="checkbox"
            checked={draft.watch_library}
            onChange={(e) =>
              setDraft({ ...draft, watch_library: e.target.checked })
            }
          />{" "}
          Automatically update the library when files change
        </label>
        <div className="flex gap-3 items-center flex-wrap">
          <GlassButton
            disabled={busy || loading}
            onClick={() => run(scanMusic, "Library refreshed.")}
          >
            {loading ? "Scanning…" : "Sync saved folders"}
          </GlassButton>
          <GlassButton
            disabled={busy || loading}
            onClick={() => run(onClearCache, "Cache rebuilt.")}
          >
            Rebuild cache ({(cacheSize / 1024 / 1024).toFixed(1)} MB)
          </GlassButton>
        </div>
        {loading && progress && progress.total > 0 && (
          <GlassProgress
            progress={Math.round((progress.current / progress.total) * 100)}
          />
        )}
        {warnings.length > 0 && (
          <details className="text-sm text-amber-200">
            <summary>{warnings.length} scan warning(s)</summary>
            <ul className="mt-2 max-h-44 overflow-auto">
              {warnings.map((warning, index) => (
                <li key={index} className="break-all mb-2">
                  {warning}
                </li>
              ))}
            </ul>
          </details>
        )}
      </GlassCard>
      <GlassCard className="p-5 space-y-4">
        <GlassHeading as="h2" className="text-lg">
          Playback
        </GlassHeading>
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={draft.audio.gapless}
            onChange={(e) => updateAudio("gapless", e.target.checked)}
          />{" "}
          Gapless playback
        </label>
        <label className="block text-sm">
          Crossfade:{" "}
          {draft.audio.crossfade_seconds === 0
            ? "Off"
            : `${draft.audio.crossfade_seconds} seconds`}
          <input
            aria-label="Crossfade seconds"
            type="range"
            min="0"
            max="12"
            step="1"
            value={draft.audio.crossfade_seconds}
            onChange={(e) =>
              updateAudio("crossfade_seconds", Number(e.target.value))
            }
            className="block w-full mt-2"
          />
        </label>
        <p className="text-xs text-white/50">
          Crossfade overlaps the end and start of adjacent tracks. Set it to Off
          for uninterrupted album transitions without overlap.
        </p>
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={draft.audio.replay_gain}
            onChange={(e) => updateAudio("replay_gain", e.target.checked)}
          />{" "}
          Normalize volume using ReplayGain track tags
        </label>
        <p className="text-xs text-white/50">
          Tracks without ReplayGain tags keep their original level. Peak tags
          prevent amplification beyond full scale.
        </p>
        <label className="flex justify-between items-center text-sm">
          Seek interval
          <select
            value={draft.seek_interval}
            onChange={(e) =>
              setDraft({ ...draft, seek_interval: Number(e.target.value) })
            }
            className="bg-neutral-900 rounded p-2"
          >
            {[5, 10, 15, 30].map((value) => (
              <option key={value} value={value}>
                {value} seconds
              </option>
            ))}
          </select>
        </label>
      </GlassCard>
      <GlassCard className="p-5 space-y-4">
        <div className="flex justify-between items-center">
          <GlassHeading as="h2" className="text-lg">
            Equalizer
          </GlassHeading>
          <GlassButton
            onClick={() =>
              setDraft({
                ...draft,
                audio: { ...draft.audio, eq_low: 0, eq_mid: 0, eq_high: 0 },
              })
            }
          >
            Reset
          </GlassButton>
        </div>
        {(
          [
            ["eq_low", "Bass"],
            ["eq_mid", "Midrange"],
            ["eq_high", "Treble"],
          ] as const
        ).map(([key, label]) => (
          <label className="block text-sm" key={key}>
            {label}: {draft.audio[key] > 0 ? "+" : ""}
            {draft.audio[key]} dB
            <input
              aria-label={label}
              type="range"
              min="-12"
              max="12"
              step="1"
              value={draft.audio[key]}
              onChange={(e) => updateAudio(key, Number(e.target.value))}
              className="block w-full mt-2"
            />
          </label>
        ))}
        <p className="text-xs text-white/50">
          Boosts reserve headroom to reduce clipping.
        </p>
      </GlassCard>
      {songs.some((song) => song.missing) && (
        <GlassCard className="p-5 space-y-3">
          <GlassHeading as="h2" className="text-lg">
            Locate missing tracks
          </GlassHeading>
          <p className="text-sm text-white/50">
            Reconnect the drive and sync, or enter the file’s new path. Playlist
            references and listening history will follow it.
          </p>
          {songs
            .filter((song) => song.missing)
            .map((song) => (
              <div
                key={song.path}
                className="space-y-2 border-t border-white/10 pt-3"
              >
                <p className="text-sm break-all">
                  {song.title || song.path}
                  <span className="block text-xs text-white/40">
                    {song.path}
                  </span>
                </p>
                <div className="flex gap-2">
                  <GlassInput
                    aria-label={`New path for ${song.title}`}
                    value={locations[song.path] || ""}
                    onChange={(e) =>
                      setLocations({
                        ...locations,
                        [song.path]: e.target.value,
                      })
                    }
                    placeholder="New full file path"
                    className="flex-1 min-w-0"
                  />
                  <GlassButton
                    disabled={busy || !locations[song.path]?.trim()}
                    onClick={() =>
                      run(
                        () => onLocate(song.path, locations[song.path]),
                        "Track located. Playlist references updated.",
                      )
                    }
                  >
                    Locate
                  </GlassButton>
                </div>
              </div>
            ))}
        </GlassCard>
      )}
      <p className="text-center text-xs text-white/30">
        Luma {version && `v${version}`}
      </p>
    </div>
  );
}
