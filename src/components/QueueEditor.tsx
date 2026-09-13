import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Song } from "../models";
import { GlassButton, GlassInput } from "@knp-org/liquid-glass-ui";

export interface QueueEditorProps {
  queue: Song[];
  currentIndex: number;
  onPlayIndex: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onSaved: () => Promise<void>;
}
export function QueueEditor({
  queue,
  currentIndex,
  onPlayIndex,
  onMove,
  onRemove,
  onSaved,
}: QueueEditorProps) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <form
        className="p-3 space-y-2 border-b border-white/10"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setMessage("");
          try {
            await invoke("save_queue_playlist", {
              name: name.trim(),
              tracks: queue.map((song) => song.path),
            });
            await onSaved();
            setName("");
            setMessage("Playlist saved.");
          } catch (error) {
            setMessage(String(error));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="flex gap-2">
          <GlassInput
            aria-label="Playlist name for queue"
            className="min-w-0 flex-1"
            placeholder="Save queue as…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <GlassButton
            type="submit"
            disabled={!name.trim() || !queue.length || saving}
          >
            Save
          </GlassButton>
        </div>
        {message && (
          <p role="status" className="text-xs text-white/70">
            {message}
          </p>
        )}
      </form>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {!queue.length && (
          <p className="p-5 text-sm text-white/50">
            Your queue is empty. Add tracks from a song’s menu.
          </p>
        )}
        {queue.map((song, index) => (
          <div
            key={`${song.path}-${index}`}
            draggable
            onDragStart={() => setDragging(index)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging !== null) onMove(dragging, index);
              setDragging(null);
            }}
            className={`rounded-lg p-2 border ${index === currentIndex ? "border-white/30 bg-white/10" : "border-transparent hover:bg-white/5"}`}
          >
            <button
              className="w-full text-left text-sm truncate"
              onClick={() => onPlayIndex(index)}
              disabled={song.missing}
              title={song.path}
            >
              {index + 1}. {song.title || song.path.split("/").pop()}
              {song.missing ? " (unavailable)" : ""}
            </button>
            <div className="flex items-center gap-1 mt-1">
              <span className="flex-1 min-w-0 text-xs truncate text-white/40">
                {song.artist || "Unknown artist"}
              </span>
              <button
                className="p-2 disabled:opacity-20"
                aria-label={`Move ${song.title} up`}
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
              >
                ↑
              </button>
              <button
                className="p-2 disabled:opacity-20"
                aria-label={`Move ${song.title} down`}
                disabled={index === queue.length - 1}
                onClick={() => onMove(index, index + 1)}
              >
                ↓
              </button>
              <button
                className="p-2 text-white/50"
                aria-label={`Remove ${song.title} from queue`}
                onClick={() => onRemove(index)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
