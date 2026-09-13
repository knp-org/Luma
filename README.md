# Luma

![Luma App Screenshot](assets/app-screenshot.png)

Luma is a local music player built with Tauri, React, TypeScript, and Rust.

## Features

- Browse and search music by album and genre; playback follows the selected collection.
- Create playlists, mark favorites, and save the current queue as a playlist.
- Add tracks to the queue or play them next; drag to reorder, use the move buttons, or remove entries.
- Dynamic smart playlists: recently added, never played, most played, and saved genre/year filters.
- Multiple music folders, automatic file watching, incremental scans, and missing-track recovery.
- Gapless playback, optional 0–12 second crossfade, ReplayGain track normalization, and a three-band equalizer.
- Linux MPRIS integration for desktop playback controls, media keys, seeking, and volume.
- Embedded, custom, and synchronized lyrics, with optional online lookup.
- Metadata editing, listening statistics, sleep timer, and saved queue/position/volume.
- Live monochrome spectrum bars below the album art, with an on/off button in the full player.

## Development

Use Node.js 22.12 or newer and stable Rust. On Debian/Ubuntu, install the native dependencies:

```bash
sudo apt install build-essential libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libasound2-dev libdbus-1-dev patchelf rpm
npm ci
npm run tauri -- dev
```

`npm run dev` starts the frontend server only. Native playback and library commands require the Tauri app.

The UI library is pinned to a built package in `vendor/`; a sibling checkout and private repository credentials are unnecessary. See [vendor/README.md](vendor/README.md) for its version, source commit, checksum, and update procedure.

## Usage

In **Settings**, enter one full music-folder path per line and save. Automatic updates debounce filesystem changes and reuse unchanged metadata. Scan warnings are shown in Settings. Missing files stay in the library and are skipped during queue advancement. Reconnect their drive and sync, or use **Locate missing tracks** to update file paths in playlists, saved lyrics, and listening history.

A song’s menu provides **Play next** and **Add to queue**. Open **Queue** from the sidebar or the full player to reorder, remove, or save tracks. Smart playlists appear on the Playlists page; their rules stay dynamic, while saving a queue creates a regular playlist snapshot.

In the full player, the **Visualizer** button turns the monochrome spectrum bars below the album art on or off. The app remembers this preference. Visuals follow the decoded audio, EQ, crossfade, and player volume. They settle when paused or muted, suspend while the window is hidden, and update less often with reduced motion enabled. They require native playback in the Tauri app.

Audio settings apply when saved. Crossfade takes precedence over gapless transitions when its duration is above zero. ReplayGain uses existing track gain/peak tags; untagged tracks retain their original level. EQ boosts reserve headroom. The continuous transition engine mixes stereo at 48 kHz; it does not provide bit-perfect output or automatic loudness analysis. Unsupported or unavailable files show playback errors without incrementing their play counts.

Desktop media controls require a running Linux session D-Bus. If it is unavailable, in-app controls remain usable. The online lyrics action sends the selected track’s title, artist, album, and duration to LRCLIB and has a 15-second timeout.

Library and Favorites lists render only visible rows plus a small buffer. Artwork requests share an LRU cache capped at 256 entries and approximately 32 MiB of retained strings. Full-resolution artwork currently displayed by components also consumes memory outside that cache.

Playback persistence migrates the previous saved state automatically. Queue changes are saved separately from small five-second position checkpoints; matching revisions prevent restoring a position against a different queue after an interrupted save. The monochrome visualizer draws at most 60 frames per second, reuses its gradients, and precomputes frequency bands. The folder watcher scans changed files or subfolders and falls back to a full scan after event loss or drive changes.

## Validation

```bash
npm test
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

Frontend regressions cover player controls, collection queues, smart playlists, metadata IPC, bounded list rendering, artwork cache eviction, and playback checkpoint migration. Rust tests exercise sample-level transitions and ReplayGain, real WAV metadata/cache round trips, corrupt-file scanning, overlapping folders, and disconnected-drive recovery. These tests use temporary files and require no sound device.

## Packaging

```bash
npm run build:deb
npm run build:appimage
npm run build:rpm
npm run build:all
```

`npm run build` compiles the frontend. The packaging commands compile the frontend and Rust backend and place installers in `src-tauri/target/release/bundle/`. CI runs both regression suites and installs frontend dependencies from the lockfile.

## Install a release

```bash
curl -sL https://raw.githubusercontent.com/knp-org/Luma/main/install_release.sh | bash
```
