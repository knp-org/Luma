// LRC Lyrics Parser and Types

export interface LyricLine {
    time: number; // Time in seconds
    text: string;
}

export interface ParsedLyrics {
    lines: LyricLine[];
    isSynced: boolean;
}

/**
 * Parse LRC format lyrics into structured lines with timestamps.
 * Supports formats like:
 * [00:12.34]Line text
 * [00:12]Line text
 * [0:12.34]Line text
 */
export function parseLyrics(lyrics: string): ParsedLyrics {
    const lines: LyricLine[] = [];
    const lrcRegex = /^\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\](.*)$/;

    let hasSyncedLines = false;

    const rawLines = lyrics.split('\n');

    for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = trimmed.match(lrcRegex);

        if (match) {
            hasSyncedLines = true;
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
            const text = match[4].trim();

            const time = minutes * 60 + seconds + milliseconds / 1000;

            if (text) {
                lines.push({ time, text });
            }
        } else {
            // Non-timestamped line - treat as unsynchronized lyric
            // Only add if we haven't seen any synced lines yet
            if (!hasSyncedLines) {
                lines.push({ time: -1, text: trimmed });
            }
        }
    }

    // Sort by time for synced lyrics
    if (hasSyncedLines) {
        lines.sort((a, b) => a.time - b.time);
    }

    return {
        lines,
        isSynced: hasSyncedLines
    };
}

/**
 * Find the index of the current lyric line based on playback time.
 * Returns -1 if no line is currently active.
 */
export function getCurrentLineIndex(lines: LyricLine[], currentTime: number): number {
    if (lines.length === 0) return -1;

    let currentIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= currentTime) {
            currentIndex = i;
        } else {
            break;
        }
    }

    return currentIndex;
}
