# Luma

Luma is a music player application built with Tauri, React, and TypeScript.

## Prerequisites

Before setting up the project, ensure you have the following installed:

- Node.js (LTS version recommended)
- Rust and Cargo (latest stable version)
- System dependencies for Tauri on Linux:
  - `libwebkit2gtk-4.0-dev` (or `libwebkit2gtk-4.1-dev`)
  - `build-essential`
  - `curl`
  - `wget`
  - `file`
  - `libssl-dev`
  - `libgtk-3-dev`
  - `libayatana-appindicator3-dev`
  - `librsvg2-dev`

## Installation

1.  Clone the repository.
2.  Navigate to the project directory.
3.  Install the dependencies:

    ```bash
    npm install
    ```

## Development

To run the application in development mode with hot-reloading:

```bash
npm run dev
```

This command will start the Vite server and the Tauri window.

## Building

To build the application for production:

```bash
npm run build
```

This will compile the React frontend and the Rust backend, producing a release build.

### Packaging

To build specific package formats for Linux, use the following commands:

-   **Debian Package (.deb)**:
    ```bash
    npm run build:deb
    ```

-   **AppImage**:
    ```bash
    npm run build:appimage
    ```

-   **RPM Package**:
    ```bash
    npm run build:rpm
    ```

-   **All Packages (using npx)**:
    ```bash
    npx tauri build
    ```
    This command builds the application for all targets defined in `tauri.conf.json`.

### Build Output

After the build process completes, the generated packages can be found in the following directories:

-   **Debian Package**: `src-tauri/target/release/bundle/deb/`
-   **AppImage**: `src-tauri/target/release/bundle/appimage/`
-   **RPM Package**: `src-tauri/target/release/bundle/rpm/`

## Project Structure

-   `src/`: Frontend React source code.
-   `src-tauri/`: Backend Rust source code and Tauri configuration.
-   `dist/`: Output directory for the frontend build.
