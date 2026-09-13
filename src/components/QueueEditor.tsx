import { useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Song } from "../models";
import { GlassButton, GlassInput, GlassCard, IconMoreVertical, IconChevronUp, IconChevronDown, IconX } from "@knp-org/liquid-glass-ui";
import { useQueueDrag } from "../hooks/useQueueDrag";

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
  const list = useRef<HTMLDivElement>(null);
  const startDrag = useQueueDrag(list, queue, onMove);
  const entries = useMemo(() => {
    const occurrences = new Map<string, number>();
    return queue.map(song => {
      const occurrence = occurrences.get(song.path) ?? 0;
      occurrences.set(song.path, occurrence + 1);
      return { song, key: JSON.stringify([song.path, occurrence]) };
    });
  }, [queue]);
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <form
        className="p-3 space-y-2 border-b border-white/10 shrink-0"
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
            containerClassName="min-w-0 flex-1 max-w-sm"
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
      <div ref={list} className="luma-queue-list" aria-label="Queue tracks" role="list">
        {!queue.length && (
          <p className="p-5 text-sm text-white/65">
            Your queue is empty. Add tracks from a song’s menu.
          </p>
        )}
        {entries.map(({ song, key }, index) => (
          <GlassCard
            key={key}
            data-queue-row={index}
            data-current={index === currentIndex}
            role="listitem"
            className="luma-queue-row"
          >
            <GlassButton variant="ghost" type="button" shape="circle" size="sm"
              className="luma-queue-drag"
              aria-label={`Drag ${song.title || 'track'} to reorder`}
              title="Drag to reorder; use the arrow buttons to move one position"
              disabled={queue.length < 2}
              onPointerDown={event => startDrag(event, index)}
            ><IconMoreVertical size={18} /></GlassButton>
            <GlassButton variant="ghost" type="button"
              className="luma-queue-track text-sm"
              onClick={() => onPlayIndex(index)}
              disabled={song.missing}
              title={song.path}
            >
              <span className="min-w-0">
                <span className="block truncate">{index + 1}. {song.title || song.path.split("/").pop()}
                {song.missing ? " (unavailable)" : ""}</span>
                <span className="block truncate text-xs text-white/65">{song.artist || "Unknown artist"}</span>
              </span>
            </GlassButton>
            <div className="luma-queue-actions">
              <GlassButton variant="ghost" type="button" shape="circle" size="sm"
                aria-label={`Move ${song.title} up`}
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
              >
                <IconChevronUp size={16} />
              </GlassButton>
              <GlassButton variant="ghost" type="button" shape="circle" size="sm"
                aria-label={`Move ${song.title} down`}
                disabled={index === queue.length - 1}
                onClick={() => onMove(index, index + 1)}
              >
                <IconChevronDown size={16} />
              </GlassButton>
              <GlassButton variant="ghost" type="button" shape="circle" size="sm"
                aria-label={`Remove ${song.title} from queue`}
                onClick={() => onRemove(index)}
              >
                <IconX size={16} />
              </GlassButton>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
