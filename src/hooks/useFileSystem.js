import { useState, useEffect, useCallback } from 'react';

export function useFileSystem() {
    const [currentPath, setCurrentPath] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [specialFolders, setSpecialFolders] = useState([]);
    const [drives, setDrives] = useState([]);
    const [cloudDrives, setCloudDrives] = useState([]);
    const [navigationHistory, setNavigationHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [clipboard, setClipboard] = useState(null); // { action: 'cut'|'copy', items: [] }

    // Initialize on mount
    useEffect(() => {
        async function init() {
            try {
                if (window.electronAPI) {
                    const [initialPath, folders, driveList, cloudList] = await Promise.all([
                        window.electronAPI.getInitialPath(),
                        window.electronAPI.getSpecialFolders(),
                        window.electronAPI.getDrives(),
                        window.electronAPI.rclone.getMounted(),
                    ]);

                    setSpecialFolders(folders);
                    setDrives(driveList);
                    if (Array.isArray(cloudList)) {
                        setCloudDrives(cloudList);
                    }

                    // Navigate to initial path (thispc:// for Windows, home for others)
                    navigateToPath(initialPath, true);
                } else {
                    // Running in browser (dev mode without Electron)
                    setError('Electron API not available. Run with Electron for full functionality.');
                    setLoading(false);
                }
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        }

        init();

        // Listen for drive changes
        if (window.electronAPI?.onDrivesUpdated) {
            const unsubscribe = window.electronAPI.onDrivesUpdated((data) => {
                if (data.drives) {
                    setDrives(data.drives);
                }
                if (data.rcloneMounts) {
                    setCloudDrives(data.rcloneMounts);
                }
            });

            return () => {
                unsubscribe();
            };
        }
    }, []);

    const navigateToPath = useCallback(async (path, isInitial = false) => {
        if (!window.electronAPI) return;

        setLoading(true);
        setError(null);

        try {
            let result;

            // Handle special "This PC" path
            if (path === 'thispc://') {
                result = await window.electronAPI.getThisPCView();
            } else {
                result = await window.electronAPI.readDirectory(path);
            }

            if (result.success) {
                setItems(result.items);
                setCurrentPath(result.path);

                // Update history
                if (!isInitial) {
                    setNavigationHistory((prev) => {
                        const newHistory = prev.slice(0, historyIndex + 1);
                        newHistory.push(result.path);
                        return newHistory;
                    });
                    setHistoryIndex((prev) => prev + 1);
                } else {
                    setNavigationHistory([path]);
                    setHistoryIndex(0);
                }
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [historyIndex]);

    const navigateTo = useCallback((path) => {
        navigateToPath(path);
    }, [navigateToPath]);

    const navigateBack = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const path = history[newIndex];
            setHistoryIndex(newIndex);

            // Navigate without adding to history
            setLoading(true);
            window.electronAPI.readDirectory(path).then((result) => {
                if (result.success) {
                    setItems(result.items);
                    setCurrentPath(result.path);
                }
                setLoading(false);
            });
        }
    }, [history, historyIndex]);

    const navigateForward = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const path = history[newIndex];
            setHistoryIndex(newIndex);

            // Navigate without adding to history
            setLoading(true);
            window.electronAPI.readDirectory(path).then((result) => {
                if (result.success) {
                    setItems(result.items);
                    setCurrentPath(result.path);
                }
                setLoading(false);
            });
        }
    }, [history, historyIndex]);

    const navigateUp = useCallback(() => {
        if (!currentPath) return;

        // Get parent directory
        const separator = currentPath.includes('\\') ? '\\' : '/';
        const parts = currentPath.split(separator).filter(Boolean);

        if (parts.length > 1) {
            parts.pop();
            let parentPath = parts.join(separator);

            // Handle Windows drive letters
            if (currentPath.includes('\\') && !parentPath.includes('\\')) {
                parentPath += '\\';
            } else if (currentPath.startsWith('/')) {
                parentPath = '/' + parentPath;
            }

            navigateTo(parentPath);
        } else if (currentPath.startsWith('/') && currentPath !== '/') {
            navigateTo('/');
        }
    }, [currentPath, navigateTo]);

    const openFile = useCallback(async (item) => {
        if (!window.electronAPI) return;

        if (item.isDirectory) {
            navigateTo(item.path);
        } else {
            await window.electronAPI.openFile(item.path);
        }
    }, [navigateTo]);

    const openWith = useCallback(async (item) => {
        if (!window.electronAPI) return;
        await window.electronAPI.openWith(item.path);
    }, []);

    const refresh = useCallback(async () => {
        if (currentPath) {
            navigateToPath(currentPath, true);
        }
        // Also refresh drives/cloud drives
        if (window.electronAPI) {
            const driveList = await window.electronAPI.getDrives();
            setDrives(driveList);
            const cloudList = await window.electronAPI.rclone.getMounted();
            if (Array.isArray(cloudList)) setCloudDrives(cloudList);
        }
    }, [currentPath, navigateToPath]);

    // File operations
    const deleteItem = useCallback(async (item) => {
        if (!window.electronAPI) return { success: false };

        // Single item delete
        const confirmed = await window.electronAPI.confirmDelete(1, item.isDirectory);
        if (!confirmed) return { success: false, cancelled: true };

        const result = await window.electronAPI.deleteItem(item.path);
        if (result.success) {
            refresh();
        }
        return result;
    }, [refresh]);

    const deleteItems = useCallback(async (itemsToDelete) => {
        if (!window.electronAPI || !itemsToDelete.length) return { success: false };

        const count = itemsToDelete.length;
        const isMulti = count > 1;
        // If single, check if it is a directory for the message phrasing
        const isFolder = !isMulti && itemsToDelete[0].isDirectory;

        const confirmed = await window.electronAPI.confirmDelete(count, isFolder);
        if (!confirmed) return { success: false, cancelled: true };

        // Delete all
        const results = [];
        for (const item of itemsToDelete) {
            const res = await window.electronAPI.deleteItem(item.path);
            results.push(res);
        }

        // If any succeeded, refresh
        if (results.some(r => r.success)) {
            refresh();
        }

        return { success: results.every(r => r.success) };
    }, [refresh]);

    const renameItem = useCallback(async (item, newName) => {
        if (!window.electronAPI) return { success: false };

        const result = await window.electronAPI.renameFile(item.path, newName);
        if (result.success) {
            refresh();
        }
        return result;
    }, [refresh]);

    const createFolder = useCallback(async (folderName) => {
        if (!window.electronAPI || !currentPath) return { success: false };

        const result = await window.electronAPI.createFolder(currentPath, folderName);
        if (result.success) {
            refresh();
        }
        return result;
    }, [currentPath, refresh]);

    const createFile = useCallback(async (fileName) => {
        if (!window.electronAPI || !currentPath) return { success: false };

        const result = await window.electronAPI.createFile(currentPath, fileName);
        if (result.success) {
            refresh();
        }
        return result;
    }, [currentPath, refresh]);

    const showContextMenu = useCallback(async (menuType, item) => {
        if (!window.electronAPI) return null;
        return await window.electronAPI.showContextMenu(menuType, item?.path || currentPath);
    }, [currentPath]);

    const copyToClipboard = useCallback((items, action = 'copy') => {
        setClipboard({ action, items });
    }, []);

    const pasteFromClipboard = useCallback(async () => {
        if (!window.electronAPI || !currentPath) return { success: false };
        const result = await window.electronAPI.clipboardPaste(currentPath);
        if (result.success) {
            refresh();
            setClipboard(null); // Clear local clipboard state too as main process clears it
        }
        return result;
    }, [currentPath, refresh]);

    return {
        currentPath,
        items,
        loading,
        error,
        specialFolders,
        drives,
        navigateTo,
        navigateBack,
        navigateForward,
        navigateUp,
        canGoBack: historyIndex > 0,
        canGoForward: historyIndex < history.length - 1,
        canGoUp: currentPath && currentPath !== '/' && !currentPath.match(/^[A-Z]:\\?$/),
        openFile,
        refresh,
        deleteItem,
        renameItem,
        createFolder,
        createFile,
        copyToClipboard,
        pasteFromClipboard,
        showContextMenu,
        clipboard,
        openWith,
        deleteItems,
        cloudDrives,
    };
}
