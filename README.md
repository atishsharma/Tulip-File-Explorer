# 🌷. Tulip File Explorer

## Designed with ❤️ by **Atish Ak Sharma**.

A modern, fast, and beautiful file explorer built with **React**, **Electron**, and **Vite**.
<img src="https://raw.githubusercontent.com/atishsharma/Tulip-File-Explorer/main/src/assets/logo.png" style="max-width:100%; width:170px;" />
## ✨ Features

- **Standard File Operations**: Open, Cut, Copy, Paste, Delete (to Trash), Rename, New Folder, New File.
- **Glassmorphism UI**: Stunning, responsive interface aimed at replicating the feel of modern iOS/Windows 11 design.
- **Dual Application Modes**: Seamlessly switch between **Light** and **Dark** themes.
- **Preview Panel**: Instant preview for Images, Videos, Audio, PDFs, and Code files with syntax highlighting.
- **Rich Thumbnails**: High-performance thumbnail generation for images and videos with caching.
- **Advanced Sorting & Grouping**:
  - Sort by Name, Date, Size, Type.
  - Group by Type, Date, Size (Windows-style grouping).
- **Navigation**: Full history support (Back, Forward, Up), Breadcrumbs, and Quick Access sidebar.
- **Keyboard Shortcuts**:
  - `Ctrl + C` / `Ctrl + V` / `Ctrl + X` for clipboard operations.
  - `Delete` for deleting items.
  - `F2` to Rename.
  - `Alt + Enter` for Properties.
  - `Ctrl + A` to Select All.
  - `Shift + Arrow Keys` for range selection.
- **Cross-Platform**: Builds for Windows, Linux (AppImage), and macOS.

## 🛠 Tech Stack

- **Frontend**: React.js 18 (Vite 5)
- **Backend/Shell**: Electron 28
- **Styling**: Pure CSS (Variables, Glassmorphism) - No CSS frameworks used!
- **State Management**: React Hooks
- **Build Tool**: Electron Builder

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### 📝 Release Notes

 First Release : 09 January 2026
 Version : 1.4.3
 Available for : Windows, Linux, macOS
Download : https://github.com/atishsharma/Tulip-File-Explorer/releases

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

### Building for Production

To create a distributable (exe/dmg/AppImage):

```bash
npm run dist
```

Build artifacts will be stored in the `dist` directory.

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
├── dist/            # Build artifacts
└── public/          # Public static assets
```

## 📝 License

This project is licensed under the **MIT License**.
