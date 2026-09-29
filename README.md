# 🌷 Tulip File Explorer

Learn More at https://atishaksharma.com/tulip 

### Designed with ❤️ by **Atish Ak Sharma**.

<img src="https://raw.githubusercontent.com/atishsharma/Tulip-File-Explorer/main/src/assets/logo1.png" style="max-width:100%; width:170px;" /> 

A modern, fast, and beautiful file explorer built with **React**, **Electron**, and **Vite**.


## ✨ Features

- **Standard File Operations**: Open, Cut, Copy, Paste, Delete (to Trash), Rename, New Folder, New File, Compress to ZIP.
- **Safe by default**: never overwrites existing files on rename, create or paste (conflicts get a "name (2)" suffix).
- **Glass design language**: Frosted translucent panels, Figtree type, line icons and colour-coded file badges, tuned for both light and dark (turn transparency off in Settings for solid surfaces).
- **Themes**: Light, Dark and Match system, with eight accent colours (Tulip Rose by default).
- **Preview Panel**: Images, video, audio and plain-text/code files (first 50 KB). PDFs and other types open in their default app.
- **Thumbnails**: Cached image thumbnails. Video thumbnails on Windows/macOS via the OS; on Linux when `ffmpeg` is installed.
- **Advanced Sorting & Grouping**:
  - Sort by Name, Date, Size, Type.
  - Group by Type, Date, Size (Windows-style grouping).
- **Navigation**: Full history (Back, Forward, Up), editable breadcrumbs, Quick Access sidebar.
- **Cloud Drives**: Mount rclone remotes (Google Drive, OneDrive, Dropbox, …); mounts are restored on next launch.
- **Keyboard Shortcuts**:
  - `Ctrl + C` / `Ctrl + X` / `Ctrl + V` for clipboard operations (also interoperates with the OS file clipboard on Linux).
  - `Delete` to move to Trash.
  - `F2` to Rename, `Alt + Enter` for Properties, `Enter` to open.
  - `Ctrl + A` to Select All, `Shift + Arrow Keys` / `Shift + Click` for range selection.
  - `Alt + ←` / `Backspace` Back, `Alt + →` Forward, `Alt + ↑` Up, `F5` Refresh.
- **Cross-Platform**: Builds for Windows (zip), macOS (zip) and Linux (deb, AppImage, tar.gz), all with the Tulip app icon. The tar.gz includes `install-desktop-entry.sh` to add Tulip to your app menu.

## 🛠 Tech Stack

- **Frontend**: React.js 18 (Vite 8)
- **Backend/Shell**: Electron 44
- **Styling**: Pure CSS design tokens (light/dark, accent presets, glass) — no CSS frameworks
- **State Management**: React Hooks
- **Build Tool**: Electron Builder

## 🚀 Getting Started

### Prerequisites

- Node.js 22.12 or higher
- npm or yarn
- WinFsp For Rclone Mount On Windows
- Rclone For Cloud Drives
- Optional: FFmpeg (`ffprobe`/`ffmpeg`) for video details and Linux video thumbnails

### 📝 Release Notes
 - First Release : 09 January 2026
 - Version : 1.6.1
 - Available for : Windows, Linux, macOS
 - Download : https://github.com/atishsharma/Tulip-File-Explorer/releases

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/atishsharma/Tulip-File-Explorer.git
    cd Tulip-File-Explorer
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run in development mode:
    ```bash
    npm run electron:dev
    ```

### Checks

```bash
npm run lint   # ESLint
npm test       # Vitest unit tests
npm run check  # lint + test + build
npm run icons  # regenerate every app icon from src/assets/logo1.png
```

### Building for Production

To create distributables (zip / deb / AppImage / tar.gz):

```bash
npm run dist
```

Packaged apps are written to the `release` directory (`dist` holds the compiled renderer).

## 📦 Project Structure

```
Tulip-File-Explorer/
├── electron/        # Main process (main.cjs, preload.cjs) & File System Logic
├── src/
│   ├── components/  # React components (FileExplorer, Sidebar, PreviewPanel, etc.)
│   ├── hooks/       # Custom hooks (useFileSystem, useTheme)
│   ├── utils/       # Helper functions and Icon mappings
│   ├── assets/      # Static assets
│   ├── App.jsx      # Main layout
│   └── main.jsx     # Entry point
├── tests/           # Vitest unit tests
├── dist/            # Compiled renderer (vite build)
├── release/         # Packaged apps (electron-builder)
└── public/          # Public static assets
```

## 📝 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE).
