const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    // File system operations
    getHomePath: () => ipcRenderer.invoke('fs:get-home-path'),
    getSpecialFolders: () => ipcRenderer.invoke('fs:get-special-folders'),
    getDrives: () => ipcRenderer.invoke('fs:get-drives'),
    readDirectory: (path) => ipcRenderer.invoke('fs:read-directory', path),
    openFile: (path) => ipcRenderer.invoke('fs:open-file', path),
    getFileInfo: (path) => ipcRenderer.invoke('fs:get-file-info', path),

    // Thumbnails and previews
    getThumbnail: (path, size) => ipcRenderer.invoke('fs:get-thumbnail', path, size),
    readFilePreview: (path, maxBytes) => ipcRenderer.invoke('fs:read-file-preview', path, maxBytes),

    // Metadata
    getImageMetadata: (path) => ipcRenderer.invoke('fs:get-image-metadata', path),
    getVideoMetadata: (path) => ipcRenderer.invoke('fs:get-video-metadata', path),

    // File Operations
    readDirectory: (path) => ipcRenderer.invoke('fs:read-directory', path),
    createFolder: (path, name) => ipcRenderer.invoke('fs:create-folder', path, name),
    createFile: (path, name) => ipcRenderer.invoke('fs:create-file', path, name),
    renameItem: (path, newName) => ipcRenderer.invoke('fs:rename-file', path, newName),
    deleteItem: (path) => ipcRenderer.invoke('fs:delete-file', path),
    confirmDelete: (count, isFolder) => ipcRenderer.invoke('fs:confirm-delete', count, isFolder),
    openWith: (path) => ipcRenderer.invoke('fs:open-with', path),
    showInFolder: (path) => ipcRenderer.invoke('fs:show-in-folder', path),

    // Clipboard operations
    clipboardCopy: (paths) => ipcRenderer.invoke('clipboard:copy', paths),
    clipboardCut: (paths) => ipcRenderer.invoke('clipboard:cut', paths),
    clipboardPaste: (destinationPath) => ipcRenderer.invoke('clipboard:paste', destinationPath),
    clipboardGetStatus: () => ipcRenderer.invoke('clipboard:get-status'),

    // Zip operations
    zipFile: (path) => ipcRenderer.invoke('fs:zip-file', path),
    openArchiveManager: (path) => ipcRenderer.invoke('fs:open-archive-manager', path),

    // Context menu
    showContextMenu: (menuType, itemPath) => ipcRenderer.invoke('show-context-menu', menuType, itemPath),

    // Rclone
    rclone: {
        checkInstalled: () => ipcRenderer.invoke('rclone:check-installed'),
        listRemotes: () => ipcRenderer.invoke('rclone:list-remotes'),
        mount: (remoteName, remoteType) => ipcRenderer.invoke('rclone:mount', remoteName, remoteType),
        unmount: (remoteName) => ipcRenderer.invoke('rclone:unmount', remoteName),
        getMounted: () => ipcRenderer.invoke('rclone:get-mounted'),
        openConfig: () => ipcRenderer.invoke('rclone:open-config')
    },
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    onDrivesChanged: (callback) => {
        const subscription = (event) => callback();
        ipcRenderer.on('drives-changed', subscription);
        return () => ipcRenderer.removeListener('drives-changed', subscription);
    },
    onDrivesUpdated: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('drives-updated', subscription);
        return () => ipcRenderer.removeListener('drives-updated', subscription);
    }
});
