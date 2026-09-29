import { useState, useEffect, useCallback, useRef } from 'react';
import { THIS_PC, getParentPath, isRootPath } from '../utils/paths';

const noop = () => {};

export function useFileSystem({ notify = noop } = {}) {
    const [currentPath, setCurrentPath] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [specialFolders, setSpecialFolders] = useState([]);
    const [drives, setDrives] = useState([]);
    const [cloudDrives, setCloudDrives] = useState([]);
    const [history, setHistory] = useState({ entries: [], index: -1 });

    // Refs give async callbacks the latest values without re-creating them
    const currentPathRef = useRef('');
    const historyRef = useRef(history);
    const requestIdRef = useRef(0);
    const notifyRef = useRef(notify);

    useEffect(() => {
        historyRef.current = history;
    }, [history]);

    useEffect(() => {
        notifyRef.current = notify;
    }, [notify]);

    /**
     * Load a folder. Only the most recent request may update state, so a slow folder
     * can never overwrite one the user navigated to afterwards.
     * Returns the result, or null if a newer request superseded this one.
     */
    const loadPath = useCallback(async (path, { silent = false } = {}) => {
        if (!window.electronAPI) return null;
        const requestId = ++requestIdRef.current;
        if (!silent) {
            setLoading(true);
            setError(null);
        }

        let result;
        try {
            result = path === THIS_PC
                ? await window.electronAPI.getThisPCView()
                : await window.electronAPI.readDirectory(path);
        } catch (err) {
            result = { success: false, error: err.message };
        }

        if (requestId !== requestIdRef.current) return null;

        if (result.success) {
            setItems(result.items);
            setCurrentPath(result.path);
            currentPathRef.current = result.path;
            setError(null);
        } else if (!silent) {
            setError(result.error || 'Unable to open folder');
        }
        if (!silent) setLoading(false);
        return result;
    }, []);

    const navigateTo = useCallback(async (path) => {
        const result = await loadPath(path);
        if (result?.success) {
            setHistory((prev) => {
                if (prev.entries[prev.index] === result.path) return prev;
                const entries = [...prev.entries.slice(0, prev.index + 1), result.path];
                return { entries, index: entries.length - 1 };
            });
        }
        return result;
    }, [loadPath]);

    const goToHistoryIndex = useCallback(async (index) => {
        const { entries } = historyRef.current;
        if (index < 0 || index >= entries.length) return;
        const result = await loadPath(entries[index]);
        if (result?.success) {
            setHistory((prev) => ({ ...prev, index }));
        }
    }, [loadPath]);

    const navigateBack = useCallback(() => goToHistoryIndex(historyRef.current.index - 1), [goToHistoryIndex]);
    const navigateForward = useCallback(() => goToHistoryIndex(historyRef.current.index + 1), [goToHistoryIndex]);

    const navigateUp = useCallback(() => {
        const parent = getParentPath(currentPathRef.current);
        if (parent) navigateTo(parent);
    }, [navigateTo]);

    const refreshDrives = useCallback(async () => {
        if (!window.electronAPI) return;
        try {
            const [driveList, cloudList] = await Promise.all([
                window.electronAPI.getDrives(),
                window.electronAPI.rclone.getMounted(),
            ]);
            setDrives(driveList);
            if (Array.isArray(cloudList)) setCloudDrives(cloudList);
        } catch (err) {
            console.error('Failed to refresh drives:', err);
        }
    }, []);

    /**
     * Reload the current folder without touching navigation history.
     */
    const refresh = useCallback(async ({ silent = false } = {}) => {
        const path = currentPathRef.current;
        const tasks = [refreshDrives()];
        if (path) tasks.push(loadPath(path, { silent }));
        await Promise.all(tasks);
    }, [loadPath, refreshDrives]);

    // Initialize on mount and subscribe to drive updates pushed by the main process
    useEffect(() => {
        if (!window.electronAPI) {
            // Running in a plain browser (vite dev without Electron)
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError('Electron API not available. Run with Electron for full functionality.');
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        (async () => {
            try {
                const [initialPath, folders] = await Promise.all([
                    window.electronAPI.getInitialPath(),
                    window.electronAPI.getSpecialFolders(),
                ]);
                if (cancelled) return;
                setSpecialFolders(folders);
                refreshDrives();
                const result = await loadPath(initialPath);
                if (result?.success && !cancelled) {
                    setHistory({ entries: [result.path], index: 0 });
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                }
            }
        })();

        const unsubscribe = window.electronAPI.onDrivesUpdated((data) => {
            if (data.drives) setDrives(data.drives);
            if (data.rcloneMounts) setCloudDrives(data.rcloneMounts);
            // Keep "This PC" in sync without a visible reload
            if (currentPathRef.current === THIS_PC) loadPath(THIS_PC, { silent: true });
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [loadPath, refreshDrives]);

    const openFile = useCallback(async (item) => {
        if (!window.electronAPI || !item) return;
        if (item.isDirectory) {
            navigateTo(item.path);
            return;
        }
        const result = await window.electronAPI.openFile(item.path);
        if (result && !result.success) {
            notifyRef.current(`Couldn't open "${item.name}": ${result.error}`, 'error');
        }
    }, [navigateTo]);

    const deleteItems = useCallback(async (itemsToDelete) => {
        if (!window.electronAPI || !itemsToDelete?.length) return { success: false };

        const isFolder = itemsToDelete.length === 1 && itemsToDelete[0].isDirectory;
        const confirmed = await window.electronAPI.confirmDelete(itemsToDelete.map((i) => i.name), isFolder);
        if (!confirmed) return { success: false, cancelled: true };

        const failures = [];
        for (const item of itemsToDelete) {
            const res = await window.electronAPI.deleteItem(item.path);
            if (!res.success) failures.push(`${item.name}: ${res.error}`);
        }

        if (failures.length) notifyRef.current(`Couldn't delete:\n${failures.join('\n')}`, 'error');
        if (failures.length < itemsToDelete.length) refresh({ silent: true });
        return { success: failures.length === 0 };
    }, [refresh]);

    const deleteItem = useCallback((item) => deleteItems([item]), [deleteItems]);

    const renameItem = useCallback(async (item, newName) => {
        if (!window.electronAPI) return { success: false };
        const result = await window.electronAPI.renameItem(item.path, newName);
        if (result.success) {
            refresh({ silent: true });
        } else {
            notifyRef.current(`Couldn't rename "${item.name}": ${result.error}`, 'error');
        }
        return result;
    }, [refresh]);

    const createEntry = useCallback(async (kind, name) => {
        const path = currentPathRef.current;
        if (!window.electronAPI || !path || path === THIS_PC) return { success: false };
        const result = kind === 'folder'
            ? await window.electronAPI.createFolder(path, name)
            : await window.electronAPI.createFile(path, name);
        if (result.success) {
            await refresh({ silent: true });
        } else {
            notifyRef.current(`Couldn't create ${kind}: ${result.error}`, 'error');
        }
        return result;
    }, [refresh]);

    const createFolder = useCallback((name = 'New Folder') => createEntry('folder', name), [createEntry]);
    const createFile = useCallback((name = 'New Text Document.txt') => createEntry('file', name), [createEntry]);

    const showContextMenu = useCallback(async (menuType, item) => {
        if (!window.electronAPI) return null;
        return window.electronAPI.showContextMenu(menuType, item?.path || currentPathRef.current);
    }, []);

    const pasteFromClipboard = useCallback(async () => {
        const path = currentPathRef.current;
        if (!window.electronAPI || !path || path === THIS_PC) return { success: false };
        const result = await window.electronAPI.clipboardPaste(path);
        if (result.results?.some((r) => r.success && !r.skipped)) {
            refresh({ silent: true });
        }
        if (!result.success && result.error) {
            notifyRef.current(`Paste failed:\n${result.error}`, 'error');
        }
        return result;
    }, [refresh]);

    return {
        currentPath,
        items,
        loading,
        error,
        specialFolders,
        drives,
        cloudDrives,
        navigateTo,
        navigateBack,
        navigateForward,
        navigateUp,
        canGoBack: history.index > 0,
        canGoForward: history.index < history.entries.length - 1,
        canGoUp: !!currentPath && !isRootPath(currentPath),
        openFile,
        refresh,
        deleteItem,
        deleteItems,
        renameItem,
        createFolder,
        createFile,
        pasteFromClipboard,
        showContextMenu,
    };
}
