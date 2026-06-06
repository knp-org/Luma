#!/bin/bash

# Luma GitHub Release Installer for Linux
# Fetches and installs the latest release package from GitHub.

set -e

REPO="knp-org/Luma"
API_URL="https://api.github.com/repos/$REPO/releases/latest"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}${BOLD}[SUCCESS]${NC} ${GREEN}$1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}${BOLD}[ERROR]${NC} ${RED}$1${NC}"; }

echo -e "${BLUE}${BOLD}"
echo "============================================="
echo "   Luma Music Player - GitHub Installer      "
echo "============================================="
echo -e "${NC}"

if ! command -v curl &> /dev/null; then
    log_error "curl is required to download the release. Please install curl and try again."
    exit 1
fi

# Detect system package format
PKG_TYPE=""
if command -v dpkg &> /dev/null; then
    PKG_TYPE="deb"
    PKG_EXT="\.deb$"
elif command -v rpm &> /dev/null; then
    PKG_TYPE="rpm"
    PKG_EXT="\.rpm$"
else
    PKG_TYPE="appimage"
    PKG_EXT="\.AppImage$"
fi

log_info "Detected system packaging preference: ${BOLD}$PKG_TYPE${NC}"
log_info "Fetching latest release information from GitHub..."

# Fetch release info parsing JSON with grep to avoid jq dependency
DOWNLOAD_URL=$(curl -sL $API_URL | grep -o "https://github.com/$REPO/releases/download/[^\"]*" | grep -i "$PKG_EXT" | head -n 1)

# Fallback to AppImage if native package not found
if [ -z "$DOWNLOAD_URL" ] && [ "$PKG_TYPE" != "appimage" ]; then
    log_warn "No $PKG_TYPE package found in the latest release. Falling back to universal AppImage..."
    PKG_TYPE="appimage"
    PKG_EXT="\.AppImage$"
    DOWNLOAD_URL=$(curl -sL $API_URL | grep -o "https://github.com/$REPO/releases/download/[^\"]*" | grep -i "$PKG_EXT" | head -n 1)
fi

if [ -z "$DOWNLOAD_URL" ]; then
    log_error "Could not find a suitable release package for your system on GitHub."
    echo "Please visit https://github.com/$REPO/releases and download manually."
    exit 1
fi

FILENAME=$(basename "$DOWNLOAD_URL")
TMP_DIR=$(mktemp -d)
TMP_FILE="$TMP_DIR/$FILENAME"

log_info "Found latest package: ${BOLD}$FILENAME${NC}"

log_info "Downloading $FILENAME from GitHub..."
curl -L --progress-bar "$DOWNLOAD_URL" -o "$TMP_FILE"

# Perform installation based on package type
if [ "$PKG_TYPE" = "deb" ]; then
    log_info "Installing Debian package..."
    if command -v sudo &> /dev/null; then
        sudo apt-get update || true
        sudo dpkg -i "$TMP_FILE" || sudo apt-get install -f -y
    else
        su -c "apt-get update && dpkg -i '$TMP_FILE' || apt-get install -f -y"
    fi
    log_success "Luma has been successfully installed via Debian package!"

elif [ "$PKG_TYPE" = "rpm" ]; then
    log_info "Installing RPM package..."
    if command -v dnf &> /dev/null; then
        sudo dnf install -y "$TMP_FILE"
    elif command -v yum &> /dev/null; then
        sudo yum install -y "$TMP_FILE"
    else
        sudo rpm -i "$TMP_FILE"
    fi
    log_success "Luma has been successfully installed via RPM package!"

elif [ "$PKG_TYPE" = "appimage" ]; then
    log_info "Installing AppImage (Portable Desktop Integration)..."
    
    BIN_DIR="$HOME/.local/bin"
    ICON_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"
    APP_DIR="$HOME/.local/share/applications"
    
    mkdir -p "$BIN_DIR"
    mkdir -p "$ICON_DIR"
    mkdir -p "$APP_DIR"
    
    DEST_APPIMAGE="$BIN_DIR/luma"
    cp "$TMP_FILE" "$DEST_APPIMAGE"
    chmod +x "$DEST_APPIMAGE"
    log_info "Installed AppImage to $DEST_APPIMAGE"
    
    # Download app icon directly from GitHub
    DEST_ICON="$ICON_DIR/luma.png"
    ICON_URL="https://raw.githubusercontent.com/$REPO/main/src-tauri/icons/128x128.png"
    log_info "Downloading app icon..."
    curl -sL "$ICON_URL" -o "$DEST_ICON" || true
    
    DESKTOP_FILE="$APP_DIR/luma.desktop"
    cat > "$DESKTOP_FILE" << EOL
[Desktop Entry]
Type=Application
Name=Luma
Comment=Luma Music Player
Exec=$DEST_APPIMAGE
Icon=luma
Terminal=false
Categories=AudioVideo;Audio;Music;Player;
StartupWMClass=luma
EOL
    chmod +x "$DESKTOP_FILE"
    log_info "Created desktop shortcut at $DESKTOP_FILE"
    
    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$APP_DIR" &> /dev/null || true
    fi
    if command -v gtk-update-icon-cache &> /dev/null; then
        gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" &> /dev/null || true
    fi
    
    log_success "Luma has been successfully installed as an AppImage with desktop integration!"
    echo "Make sure $BIN_DIR is in your PATH."
fi

# Cleanup
rm -rf "$TMP_DIR"
log_info "Temporary files cleaned up."
