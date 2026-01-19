#!/bin/bash

# Luma Installation Script for Linux (Debian/Ubuntu based)

set -e

echo "Starting Luma installation..."

# 1. Install System Dependencies
echo "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# 2. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js (LTS recommended) and try again."
    exit 1
fi

# 3. Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "Rust/Cargo is not installed. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# 4. Install Project Dependencies
echo "Installing project dependencies..."
npm install

# 5. Build the Project (Debian Package)
echo "Building the application..."
npm run build:deb

# 6. Install the Package
DEB_FILE=$(find src-tauri/target/release/bundle/deb/ -name "*.deb" | head -n 1)

if [ -z "$DEB_FILE" ]; then
    echo "Error: .deb file not found after build."
    exit 1
fi

echo "Installing generated package: $DEB_FILE"
sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y

echo "Installation complete! You can now run 'luma' from your terminal or application menu."
