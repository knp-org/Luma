import { Song } from './Song';
export interface UsePlayerProps { songs: Song[]; seekInterval: number }
export type UsePlayerReturn = ReturnType<typeof import('../hooks/usePlayer').usePlayer>;
