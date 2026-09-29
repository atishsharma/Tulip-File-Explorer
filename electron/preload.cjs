const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    // App info
    getAppVersion: () => ipcRenderer.invoke('app:get-version'),
    getPlatform: () => ipcRenderer.invoke('get-platform'),

    // File system
    getSpecialFolders: () => ipcRenderer.invoke('fs:get-special-folders'),
    getDrives: () => ipcRenderer.invoke('fs:get-drives'),
    getInitialPath: () => ipcRenderer.invoke('fs:get-initial-path'),
    getThisPCView: () => ipcRenderer.invoke('fs:get-thispc-view'),
    readDirectory: (path) => ipcRenderer.invoke('fs:read-directory', path),
    openFile: (path) => ipcRenderer.invoke('fs:open-file', path),
    getContentInfo: (path) => ipcRenderer.invoke('fs:get-content-info', path),
    calculateFolderStats: (path) => ipcRenderer.invoke('fs:calculate-folder-stats', path),
    cancelFolderStats: (path) => ipcRenderer.invoke('fs:cancel-folder-stats', path),
    setHiddenAttribute: (path, hide) => ipcRenderer.invoke('fs:set-hidden-attribute', path, hide),

    // Thumbnails and previews
    getThumbnail: (path, size) => ipcRenderer.invoke('fs:get-thumbnail', path, size),
    readFilePreview: (path, maxBytes) => ipcRenderer.invoke('fs:read-file-preview', path, maxBytes),

    // Metadata
    getImageMetadata: (path) => ipcRenderer.invoke('fs:get-image-metadata', path),
    getVideoMetadata: (path) => ipcRenderer.invoke('fs:get-video-metadata', path),

    // File operations
    createFolder: (path, name) => ipcRenderer.invoke('fs:create-folder', path, name),
    createFile: (path, name) => ipcRenderer.invoke('fs:create-file', path, name),
    renameItem: (path, newName) => ipcRenderer.invoke('fs:rename-file', path, newName),
    deleteItem: (path) => ipcRenderer.invoke('fs:delete-file', path),
    confirmDelete: (names, isFolder) => ipcRenderer.invoke('fs:confirm-delete', names, isFolder),
    showInFolder: (path) => ipcRenderer.invoke('fs:show-in-folder', path),
    zipFile: (path) => ipcRenderer.invoke('fs:zip-file', path),

    // Clipboard
    clipboardCopy: (paths) => ipcRenderer.invoke('clipboard:copy', paths),
    clipboardCut: (paths) => ipcRenderer.invoke('clipboard:cut', paths),
    clipboardPaste: (destinationPath) => ipcRenderer.invoke('clipboard:paste', destinationPath),
    clipboardGetStatus: () => ipcRenderer.invoke('clipboard:get-status'),
    onClipboardChanged: (callback) => subscribe('clipboard-changed', callback),

    // Context menu
    showContextMenu: (menuType, itemPath) => ipcRenderer.invoke('show-context-menu', menuType, itemPath),

    // Rclone
    rclone: {
        checkInstalled: () => ipcRenderer.invoke('rclone:check-installed'),
        listRemotes: () => ipcRenderer.invoke('rclone:list-remotes'),
        mount: (remoteName, remoteType) => ipcRenderer.invoke('rclone:mount', remoteName, remoteType),
        unmount: (remoteName) => ipcRenderer.invoke('rclone:unmount', remoteName),
        getMounted: () => ipcRenderer.invoke('rclone:get-mounted'),
        openConfig: () => ipcRenderer.invoke('rclone:open-config'),
    },

    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    onDrivesUpdated: (callback) => subscribe('drives-updated', callback),
});
