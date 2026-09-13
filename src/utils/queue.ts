import { Song, LoopMode } from "../models";

export function nextIndex(
  queue: Song[],
  current: number,
  loop: LoopMode,
  shuffle: boolean,
  auto = false,
  random = Math.random,
): number {
  if (!queue.length) return -1;
  const playable = queue
    .map((song, index) => ({ song, index }))
    .filter(({ song }) => !song.missing)
    .map(({ index }) => index);
  if (!playable.length) return -1;
  if (auto && loop === "one" && playable.includes(current)) return current;
  if (shuffle) {
    const choices = playable.filter((index) => index !== current);
    return choices.length
      ? choices[Math.floor(random() * choices.length)]
      : playable[0];
  }
  const next = playable.find((index) => index > current);
  return next ?? (auto && loop === "off" ? -1 : playable[0]);
}
export function moveQueueItem(
  queue: Song[],
  current: number,
  from: number,
  to: number,
) {
  if (from < 0 || to < 0 || from >= queue.length || to >= queue.length)
    return { queue, current };
  const indexed = queue.map((song, index) => ({ song, index }));
  indexed.splice(to, 0, indexed.splice(from, 1)[0]);
  return {
    queue: indexed.map((item) => item.song),
    current: indexed.findIndex((item) => item.index === current),
  };
}
