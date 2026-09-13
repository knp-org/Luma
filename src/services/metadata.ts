import { invoke } from "@tauri-apps/api/core";
export interface MetadataUpdate {
  path: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: number | null;
  trackNumber: number | null;
}
export async function updateSongMetadata(
  metadata: MetadataUpdate,
): Promise<void> {
  await invoke("update_song_metadata", { ...metadata });
}
