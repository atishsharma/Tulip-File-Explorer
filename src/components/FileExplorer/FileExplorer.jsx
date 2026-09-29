import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Breadcrumb from '../Breadcrumb/Breadcrumb';
import FileItem from '../FileItem/FileItem';
import ThisPC from '../ThisPC/ThisPC';
import { useModal } from '../../hooks/useModal';
import { calendarDaysAgo, formatFileSize } from '../../utils/formatters';
import { THIS_PC, splitPath } from '../../utils/paths';
import { LineIcon } from '../../utils/fileIcons';
import { readStorage, writeStorage } from '../../utils/storage';
import './FileExplorer.css';

const SORT_OPTIONS = [
    { id: 'name', label: 'Name' },
    { id: 'date', label: 'Date Modified' },
    { id: 'size', label: 'Size' },
    { id: 'type', label: 'Type' },
];

const GROUP_OPTIONS = [
    { id: 'none', label: 'None' },
    { id: 'type', label: 'Type' },
    { id: 'date', label: 'Date Modified' },
    { id: 'size', label: 'Size' },
];

const cssEscape = (value) => (window.CSS?.escape ? window.CSS.escape(value) : value.replace(/["\\]/g, '\\$&'));

function FileExplorer({
    currentPath,
    items,
    loading,
    error,
    onNavigate,
    onNavigateBack,
    onNavigateForward,
    onNavigateUp,
    canGoBack,
    canGoForward,
    canGoUp,
    onOpenFile,
    onRefresh,
    onRenameItem,
    onCreateFolder,
    onCreateFile,
    onShowContextMenu,
    onSelectItem,
    onShowProperties,
    clipboardStatus,
    onPaste,
    onDeleteItems,
    specialFolders = [],
    cloudDrives = [],
    searchQuery = '',
    onSearch,
    shortcutsEnabled = true,
    headerEnd = null,
    onAddCloudDrive,
    preview = null,
}) {
    const [viewMode, setViewMode] = useState(() => (readStorage('tulip-view-mode', 'grid') === 'list' ? 'list' : 'grid'));
    const [showHidden, setShowHidden] = useState(false);
    const [renameItem, setRenameItem] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [pendingRenamePath, setPendingRenamePath] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [groupBy, setGroupBy] = useState('none');
    const [thumbnailSize, setThumbnailSize] = useState(() => {
        const saved = Number(readStorage('tulip-icon-size', 96));
        return saved >= 48 && saved <= 256 ? saved : 96;
    });

    // Remember layout choices between sessions
    useEffect(() => {
        writeStorage('tulip-view-mode', viewMode);
    }, [viewMode]);
    useEffect(() => {
        writeStorage('tulip-icon-size', thumbnailSize);
    }, [thumbnailSize]);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showGroupMenu, setShowGroupMenu] = useState(false);
    const [showSizeMenu, setShowSizeMenu] = useState(false);

    // Multi-select state (array of paths) and the anchor used for Shift range selection
    const [selectedItems, setSelectedItems] = useState([]);
    const anchorRef = useRef(null);

    // Drag selection state
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null);
    const contentRef = useRef(null);

    // Focus state for keyboard navigation
    const [focusedItem, setFocusedItem] = useState(null);

    const isThisPC = currentPath === THIS_PC;

    const cancelRename = useCallback(() => {
        setRenameItem(null);
        setRenameValue('');
    }, []);
    const renameDialogRef = useModal(!!renameItem, cancelRename);

    const startRename = useCallback((item) => {
        if (!item) return;
        setRenameItem(item);
        setRenameValue(item.name);
    }, []);

    // Open the rename dialog for an item created a moment ago, once it shows up in the listing
    if (pendingRenamePath) {
        const created = items.find((i) => i.path === pendingRenamePath);
        if (created) {
            setPendingRenamePath(null);
            setSelectedItems([created.path]);
            setFocusedItem(created.path);
            startRename(created);
        }
    }

    // Drag selection handlers
    useEffect(() => {
        if (!isSelecting) return undefined;

        const handleMouseMove = (e) => {
            if (!selectionStart) return;

            const box = {
                left: Math.min(selectionStart.x, e.clientX),
                top: Math.min(selectionStart.y, e.clientY),
                width: Math.abs(e.clientX - selectionStart.x),
                height: Math.abs(e.clientY - selectionStart.y),
            };
            setSelectionBox(box);

            const newSelected = [];
            contentRef.current?.querySelectorAll('[data-path]').forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.left < box.left + box.width && rect.right > box.left &&
                    rect.top < box.top + box.height && rect.bottom > box.top) {
                    newSelected.push(el.getAttribute('data-path'));
                }
            });

            if (e.ctrlKey || e.metaKey) {
                setSelectedItems((prev) => Array.from(new Set([...prev, ...newSelected])));
            } else {
                setSelectedItems(newSelected);
            }
        };

        const handleMouseUp = () => {
            setIsSelecting(false);
            setSelectionStart(null);
            setSelectionBox(null);
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isSelecting, selectionStart]);

    // Clear selection when path changes
    const [selectionPath, setSelectionPath] = useState(currentPath);
    if (selectionPath !== currentPath) {
        setSelectionPath(currentPath);
        setSelectedItems([]);
        setFocusedItem(null);
        setIsSelecting(false);
        setSelectionBox(null);
    }
    useEffect(() => {
        anchorRef.current = null;
        onSelectItem?.(null);
    }, [currentPath, onSelectItem]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClick = () => {
            setShowSortMenu(false);
            setShowGroupMenu(false);
            setShowSizeMenu(false);
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // Filter and sort items
    const processedItems = useMemo(() => {
        let filtered = showHidden ? items : items.filter((item) => !item.isHidden);

        if (searchQuery && searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter((item) => item.name.toLowerCase().includes(lowerQuery));
        }

        return [...filtered].sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;

            let comparison;
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name, undefined, { numeric: true });
                    break;
                case 'date':
                    // Ascending = oldest first
                    comparison = new Date(a.modified || 0) - new Date(b.modified || 0);
                    break;
                case 'size':
                    comparison = (a.size || 0) - (b.size || 0);
                    break;
                case 'type':
                    comparison = (a.extension || '').localeCompare(b.extension || '');
                    break;
                default:
                    comparison = 0;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [items, showHidden, sortBy, sortOrder, searchQuery]);

    const itemsForPaths = useCallback(
        (paths) => items.filter((i) => paths.includes(i.path)),
        [items],
    );

    const selectOnly = useCallback((item) => {
        setSelectedItems(item ? [item.path] : []);
        setFocusedItem(item ? item.path : null);
        anchorRef.current = item ? item.path : null;
        onSelectItem?.(item || null);
    }, [onSelectItem]);

    const handleCreate = useCallback(async (kind) => {
        const result = kind === 'folder' ? await onCreateFolder?.() : await onCreateFile?.();
        if (result?.success && result.path) setPendingRenamePath(result.path);
    }, [onCreateFolder, onCreateFile]);

    // Keyboard shortcuts and navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!shortcutsEnabled || renameItem) return;
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

            const mod = e.ctrlKey || e.metaKey;

            // Navigation shortcuts work everywhere, including This PC
            if ((e.altKey && e.key === 'ArrowLeft') || (e.key === 'Backspace' && !mod)) {
                e.preventDefault();
                onNavigateBack?.();
                return;
            }
            if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                onNavigateForward?.();
                return;
            }
            if (e.altKey && e.key === 'ArrowUp') {
                e.preventDefault();
                onNavigateUp?.();
                return;
            }
            if (e.key === 'F5' || (mod && e.key === 'r')) {
                e.preventDefault();
                onRefresh?.();
                return;
            }
            if (isThisPC) return;

            const selectedObjects = itemsForPaths(selectedItems);
            const focusedObject = processedItems.find((i) => i.path === focusedItem)
                || (selectedObjects.length === 1 ? selectedObjects[0] : null);
            const currentIndex = focusedItem ? processedItems.findIndex((i) => i.path === focusedItem) : -1;

            if (e.key === 'Escape') {
                selectOnly(null);
                setSelectionBox(null);
                setIsSelecting(false);
            } else if (mod && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                // Select what is visible (respects search and hidden-file filter)
                setSelectedItems(processedItems.map((item) => item.path));
                if (processedItems.length > 0) {
                    const last = processedItems[processedItems.length - 1];
                    onSelectItem?.(last);
                    setFocusedItem(last.path);
                }
            } else if (e.key === 'Delete') {
                e.preventDefault();
                if (selectedObjects.length > 0) onDeleteItems?.(selectedObjects);
            } else if (mod && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                if (selectedItems.length > 0) window.electronAPI?.clipboardCopy(selectedItems);
            } else if (mod && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                if (selectedItems.length > 0) window.electronAPI?.clipboardCut(selectedItems);
            } else if (mod && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                onPaste?.();
            } else if (e.key === 'F2') {
                e.preventDefault();
                if (focusedObject) startRename(focusedObject);
            } else if (e.altKey && e.key === 'Enter') {
                e.preventDefault();
                if (focusedObject) onShowProperties?.(focusedObject);
            } else if (e.key === 'Enter') {
                // Buttons handle Enter themselves; only act when focus is elsewhere
                if (e.target.closest?.('[data-path]')) return;
                e.preventDefault();
                if (focusedObject) onOpenFile?.(focusedObject);
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                if (processedItems.length === 0) return;

                const gridEl = contentRef.current?.querySelector('.file-grid');
                const gridCols = viewMode === 'grid'
                    ? Math.max(1, Math.floor((gridEl?.offsetWidth || 0) / (thumbnailSize + 32 + 8)))
                    : 1;
                const maxIndex = processedItems.length - 1;
                let nextIndex = 0;
                if (currentIndex !== -1) {
                    if (e.key === 'ArrowRight') nextIndex = Math.min(currentIndex + 1, maxIndex);
                    else if (e.key === 'ArrowLeft') nextIndex = Math.max(currentIndex - 1, 0);
                    else if (e.key === 'ArrowDown') nextIndex = Math.min(currentIndex + gridCols, maxIndex);
                    else nextIndex = Math.max(currentIndex - gridCols, 0);
                }

                const nextItem = processedItems[nextIndex];
                setFocusedItem(nextItem.path);

                if (e.shiftKey) {
                    const anchorIndex = processedItems.findIndex((i) => i.path === anchorRef.current);
                    const anchor = anchorIndex !== -1 ? anchorIndex : nextIndex;
                    if (anchorIndex === -1) anchorRef.current = nextItem.path;
                    const range = processedItems
                        .slice(Math.min(anchor, nextIndex), Math.max(anchor, nextIndex) + 1)
                        .map((i) => i.path);
                    setSelectedItems(range);
                } else if (!mod) {
                    setSelectedItems([nextItem.path]);
                    anchorRef.current = nextItem.path;
                    onSelectItem?.(nextItem);
                }

                requestAnimationFrame(() => {
                    const el = contentRef.current?.querySelector(`[data-path="${cssEscape(nextItem.path)}"]`);
                    el?.scrollIntoView({ block: 'nearest' });
                    el?.focus({ preventScroll: true });
                });
            } else if (e.key === ' ' && mod) {
                e.preventDefault();
                if (focusedItem) {
                    setSelectedItems((prev) => (prev.includes(focusedItem)
                        ? prev.filter((p) => p !== focusedItem)
                        : [...prev, focusedItem]));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcutsEnabled, renameItem, isThisPC, itemsForPaths, selectedItems, processedItems, focusedItem,
        viewMode, thumbnailSize, onSelectItem, onDeleteItems, onPaste, onOpenFile, onShowProperties,
        onNavigateBack, onNavigateForward, onNavigateUp, onRefresh, selectOnly, startRename]);

    // Group items
    const groupedItems = useMemo(() => {
        if (groupBy === 'none') {
            return { 'All Files': processedItems };
        }

        const groups = {};
        const now = new Date();

        processedItems.forEach((item) => {
            let groupKey;

            switch (groupBy) {
                case 'type':
                    if (item.isDirectory) {
                        groupKey = 'Folders';
                    } else {
                        const ext = (item.extension || '').toLowerCase();
                        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) groupKey = 'Images';
                        else if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.webm'].includes(ext)) groupKey = 'Videos';
                        else if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].includes(ext)) groupKey = 'Audio';
                        else if (['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt'].includes(ext)) groupKey = 'Documents';
                        else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) groupKey = 'Archives';
                        else groupKey = 'Other';
                    }
                    break;
                case 'date': {
                    if (!item.modified) {
                        groupKey = 'Unknown';
                        break;
                    }
                    const days = calendarDaysAgo(new Date(item.modified), now);
                    if (days < 0) groupKey = 'Future';
                    else if (days === 0) groupKey = 'Today';
                    else if (days === 1) groupKey = 'Yesterday';
                    else if (days < 7) groupKey = 'This Week';
                    else if (days < 30) groupKey = 'This Month';
                    else if (days < 365) groupKey = 'This Year';
                    else groupKey = 'Older';
                    break;
                }
                case 'size': {
                    const size = item.size || 0;
                    if (item.isDirectory) groupKey = 'Folders';
                    else if (size === 0) groupKey = 'Empty';
                    else if (size < 1024) groupKey = 'Tiny (< 1 KB)';
                    else if (size < 1024 * 1024) groupKey = 'Small (< 1 MB)';
                    else if (size < 100 * 1024 * 1024) groupKey = 'Medium (< 100 MB)';
                    else if (size < 1024 * 1024 * 1024) groupKey = 'Large (< 1 GB)';
                    else groupKey = 'Huge (> 1 GB)';
                    break;
                }
                default:
                    groupKey = 'All';
            }

            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(item);
        });

        return groups;
    }, [processedItems, groupBy]);

    const handleSelect = useCallback((item, e) => {
        setFocusedItem(item.path);

        if (e?.ctrlKey || e?.metaKey) {
            setSelectedItems((prev) => (prev.includes(item.path)
                ? prev.filter((p) => p !== item.path)
                : [...prev, item.path]));
            anchorRef.current = item.path;
        } else if (e?.shiftKey && anchorRef.current) {
            const anchorIndex = processedItems.findIndex((i) => i.path === anchorRef.current);
            const currentIndex = processedItems.findIndex((i) => i.path === item.path);
            if (anchorIndex === -1) {
                setSelectedItems([item.path]);
                anchorRef.current = item.path;
            } else {
                setSelectedItems(processedItems
                    .slice(Math.min(anchorIndex, currentIndex), Math.max(anchorIndex, currentIndex) + 1)
                    .map((i) => i.path));
            }
        } else {
            setSelectedItems([item.path]);
            anchorRef.current = item.path;
        }
        onSelectItem?.(item);
    }, [processedItems, onSelectItem]);

    const handleContextMenu = useCallback(async (e, item) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.electronAPI) return;

        // Right-clicking inside the selection acts on the whole selection;
        // right-clicking anything else acts on that item alone (and selects it)
        let targets = [];
        if (item) {
            if (selectedItems.includes(item.path)) {
                targets = selectedItems;
                setFocusedItem(item.path);
            } else {
                targets = [item.path];
                selectOnly(item);
            }
        }

        const menuType = item ? (item.isDirectory ? 'folder' : 'file') : 'background';
        const action = await onShowContextMenu?.(menuType, item);
        if (!action) return;

        switch (action) {
            case 'open':
                onOpenFile?.(item);
                break;
            case 'cut':
                if (targets.length > 0) await window.electronAPI.clipboardCut(targets);
                break;
            case 'copy':
                if (targets.length > 0) await window.electronAPI.clipboardCopy(targets);
                break;
            case 'delete':
                if (targets.length > 0) onDeleteItems?.(itemsForPaths(targets));
                break;
            case 'rename':
                startRename(item);
                break;
            case 'new-folder':
                handleCreate('folder');
                break;
            case 'new-file':
                handleCreate('file');
                break;
            case 'paste':
                onPaste?.();
                break;
            case 'refresh':
                onRefresh?.();
                break;
            default:
                break;
        }
    }, [selectedItems, selectOnly, onShowContextMenu, onOpenFile, onDeleteItems, itemsForPaths,
        startRename, handleCreate, onPaste, onRefresh]);

    const handleBackgroundContextMenu = (e) => {
        if (e.target.closest('[data-path]') || isThisPC) return;
        selectOnly(null);
        handleContextMenu(e, null);
    };

    const handleMouseDown = useCallback((e) => {
        // Only left click on background
        if (e.button !== 0 || isThisPC) return;
        if (e.target.closest('[data-path]') || e.target.closest('.toolbar-btn') || e.target.closest('.preview-panel') ||
            e.target.closest('.dropdown-wrapper') || e.target.closest('.rename-dialog') || e.target.closest('button')) {
            return;
        }

        setIsSelecting(true);
        setSelectionStart({ x: e.clientX, y: e.clientY });
        setSelectionBox({ left: e.clientX, top: e.clientY, width: 0, height: 0 });

        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            selectOnly(null);
        }
        document.body.style.userSelect = 'none';
    }, [isThisPC, selectOnly]);

    const renameSubmitting = useRef(false);
    const handleRenameSubmit = async (e) => {
        e.preventDefault();
        if (renameSubmitting.current) return;
        const target = renameItem;
        const value = renameValue.trim();
        if (target && value && value !== target.name) {
            renameSubmitting.current = true;
            try {
                const result = await onRenameItem?.(target, value);
                // Keep the dialog open on failure so the name can be corrected
                if (result && !result.success) return;
            } finally {
                renameSubmitting.current = false;
            }
        }
        cancelRename();
    };

    // Preselect the name without its extension, like other file managers
    const handleRenameFocus = (e) => {
        const dot = renameItem && !renameItem.isDirectory ? renameValue.lastIndexOf('.') : -1;
        e.target.setSelectionRange(0, dot > 0 ? dot : renameValue.length);
    };

    const toggleSort = (newSortBy) => {
        if (sortBy === newSortBy) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('asc');
        }
        setShowSortMenu(false);
    };

    const renderFileItems = (itemList) => {
        if (viewMode === 'grid') {
            return (
                <div className="file-grid" role="listbox" aria-multiselectable="true" style={{ '--thumb-size': `${thumbnailSize}px` }}>
                    {itemList.map((item) => (
                        <FileItem
                            key={item.path}
                            item={item}
                            viewMode="grid"
                            onOpen={onOpenFile}
                            selected={selectedItems.includes(item.path)}
                            onSelect={handleSelect}
                            onContextMenu={handleContextMenu}
                            thumbnailSize={thumbnailSize}
                            clipboardStatus={clipboardStatus}
                            focused={focusedItem === item.path}
                        />
                    ))}
                </div>
            );
        }
        return (
            <table className="file-table" aria-multiselectable="true">
                <thead>
                    <tr>
                        {[['name', 'Name'], ['type', 'Type'], ['size', 'Size'], ['date', 'Modified']].map(([id, label]) => (
                            <th
                                key={id}
                                className={`table-header ${id === 'size' ? 'size-header' : ''}`}
                                onClick={() => toggleSort(id)}
                                aria-sort={sortBy === id ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                                {label} {sortBy === id && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {itemList.map((item) => (
                        <FileItem
                            key={item.path}
                            item={item}
                            viewMode="list"
                            onOpen={onOpenFile}
                            selected={selectedItems.includes(item.path)}
                            onSelect={handleSelect}
                            onContextMenu={handleContextMenu}
                            thumbnailSize={32}
                            clipboardStatus={clipboardStatus}
                            focused={focusedItem === item.path}
                        />
                    ))}
                </tbody>
            </table>
        );
    };

    const folderTitle = isThisPC ? '' : (splitPath(currentPath).pop()?.name || currentPath || '');
    const sortLabel = SORT_OPTIONS.find((o) => o.id === sortBy)?.label || 'Name';
    const groupLabel = GROUP_OPTIONS.find((o) => o.id === groupBy)?.label;
    const selectedSize = selectedItems.length > 0
        ? itemsForPaths(selectedItems).reduce((sum, i) => sum + (i.isDirectory ? 0 : (i.size || 0)), 0)
        : 0;

    return (
        <main className="file-explorer">
            {/* Window header: navigation, path, search, view options and window controls */}
            <header className="explorer-header">
                <div className="header-nav">
                    <button className="icon-btn" onClick={onNavigateBack} disabled={!canGoBack} title="Back (Alt+Left)" aria-label="Back">
                        <LineIcon name="back" strokeWidth={2} />
                    </button>
                    <button className="icon-btn" onClick={onNavigateForward} disabled={!canGoForward} title="Forward (Alt+Right)" aria-label="Forward">
                        <LineIcon name="forward" strokeWidth={2} />
                    </button>
                    <button className="icon-btn" onClick={onNavigateUp} disabled={!canGoUp} title="Up (Alt+Up)" aria-label="Up">
                        <LineIcon name="up" strokeWidth={2} />
                    </button>
                    <button className="icon-btn" onClick={() => onRefresh?.()} title="Refresh (F5)" aria-label="Refresh">
                        <LineIcon name="refresh" />
                    </button>
                </div>

                <Breadcrumb currentPath={currentPath} onNavigate={onNavigate} />

                <label className={`header-search ${isThisPC ? 'disabled' : ''}`}>
                    <LineIcon name="search" size={16} strokeWidth={2} />
                    <input
                        type="search"
                        placeholder={isThisPC ? 'Open a folder to search' : `Search ${folderTitle || 'folder'}`}
                        aria-label="Search this folder"
                        value={searchQuery}
                        onChange={(e) => onSearch(e.target.value)}
                        disabled={isThisPC}
                    />
                </label>

                <div className="header-tools">
                    <div className="segmented" role="group" aria-label="View">
                        <button
                            className={viewMode === 'grid' ? 'active' : ''}
                            onClick={() => setViewMode('grid')}
                            title="Grid view"
                            aria-label="Grid view"
                            aria-pressed={viewMode === 'grid'}
                        >
                            <LineIcon name="grid" size={16} strokeWidth={2} />
                        </button>
                        <button
                            className={viewMode === 'list' ? 'active' : ''}
                            onClick={() => setViewMode('list')}
                            title="List view"
                            aria-label="List view"
                            aria-pressed={viewMode === 'list'}
                        >
                            <LineIcon name="list" size={16} strokeWidth={2} />
                        </button>
                    </div>

                    <div className="dropdown-wrapper">
                        <button
                            className={`icon-btn ${showSortMenu ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowSortMenu(!showSortMenu);
                                setShowGroupMenu(false);
                                setShowSizeMenu(false);
                            }}
                            title="Sort by"
                            aria-label="Sort by"
                            aria-haspopup="menu"
                            aria-expanded={showSortMenu}
                        >
                            <LineIcon name="sort" />
                        </button>
                        {showSortMenu && (
                            <div className="dropdown-menu" role="menu">
                                <div className="dropdown-header">Sort by</div>
                                {SORT_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        role="menuitemradio"
                                        aria-checked={sortBy === opt.id}
                                        className={`dropdown-item ${sortBy === opt.id ? 'active' : ''}`}
                                        onClick={() => toggleSort(opt.id)}
                                    >
                                        <span>{opt.label}</span>
                                        {sortBy === opt.id && <span className="sort-arrow">{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="dropdown-wrapper">
                        <button
                            className={`icon-btn ${groupBy !== 'none' || showGroupMenu ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowGroupMenu(!showGroupMenu);
                                setShowSortMenu(false);
                                setShowSizeMenu(false);
                            }}
                            title="Group by"
                            aria-label="Group by"
                            aria-haspopup="menu"
                            aria-expanded={showGroupMenu}
                        >
                            <LineIcon name="group" />
                        </button>
                        {showGroupMenu && (
                            <div className="dropdown-menu" role="menu">
                                <div className="dropdown-header">Group by</div>
                                {GROUP_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        role="menuitemradio"
                                        aria-checked={groupBy === opt.id}
                                        className={`dropdown-item ${groupBy === opt.id ? 'active' : ''}`}
                                        onClick={() => { setGroupBy(opt.id); setShowGroupMenu(false); }}
                                    >
                                        <span>{opt.label}</span>
                                        {groupBy === opt.id && <LineIcon name="check" size={14} strokeWidth={2.2} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {viewMode === 'grid' && (
                        <div className="dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
                            <button
                                className={`icon-btn ${showSizeMenu ? 'active' : ''}`}
                                onClick={() => { setShowSizeMenu(!showSizeMenu); setShowSortMenu(false); setShowGroupMenu(false); }}
                                title="Icon size"
                                aria-label="Icon size"
                                aria-haspopup="dialog"
                                aria-expanded={showSizeMenu}
                            >
                                <LineIcon name="size" />
                            </button>
                            {showSizeMenu && (
                                <div className="dropdown-menu size-dropdown">
                                    <div className="dropdown-header">Icon size</div>
                                    <div className="size-slider-container">
                                        <input
                                            type="range"
                                            min="48"
                                            max="256"
                                            value={thumbnailSize}
                                            onChange={(e) => setThumbnailSize(Number(e.target.value))}
                                            className="size-slider"
                                            aria-label="Icon size"
                                        />
                                        <span className="size-label">{thumbnailSize}px</span>
                                    </div>
                                    <div className="size-presets">
                                        {[['S', 56], ['M', 96], ['L', 128], ['XL', 176], ['XXL', 256]].map(([label, value]) => (
                                            <button
                                                key={label}
                                                className={thumbnailSize === value ? 'active' : ''}
                                                onClick={() => setThumbnailSize(value)}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        className={`icon-btn ${showHidden ? 'active' : ''}`}
                        onClick={() => setShowHidden(!showHidden)}
                        title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
                        aria-label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
                        aria-pressed={showHidden}
                    >
                        <LineIcon name={showHidden ? 'eye' : 'eyeOff'} />
                    </button>
                </div>

                {headerEnd}
            </header>

            <div className="explorer-body">
                <section className="explorer-pane" aria-label="Files">
                    {!isThisPC && !loading && !error && (
                        <div className="pane-title">
                            <h1 className="truncate">{searchQuery ? 'Search results' : folderTitle}</h1>
                            <span className="pane-meta">
                                {searchQuery
                                    ? `${processedItems.length} result${processedItems.length !== 1 ? 's' : ''} for “${searchQuery}”`
                                    : `Sorted by ${sortLabel}${groupBy !== 'none' ? ` · Grouped by ${groupLabel}` : ''}`}
                            </span>
                        </div>
                    )}

                    <div
                        className="explorer-content"
                        ref={contentRef}
                        onContextMenu={handleBackgroundContextMenu}
                        onMouseDown={handleMouseDown}
                    >
                        {selectionBox && (
                            <div
                                className="selection-box"
                                style={{
                                    left: selectionBox.left,
                                    top: selectionBox.top,
                                    width: selectionBox.width,
                                    height: selectionBox.height,
                                }}
                            />
                        )}

                        {loading ? (
                            <div className="explorer-state">
                                <div className="spinner"></div>
                                <span>Loading…</span>
                            </div>
                        ) : error ? (
                            <div className="explorer-state" role="alert">
                                <span className="state-icon danger"><LineIcon name="alert" size={28} /></span>
                                <h3>Unable to open this folder</h3>
                                <p>{error}</p>
                                <button className="btn btn-secondary" onClick={() => onRefresh?.()}>Try again</button>
                            </div>
                        ) : isThisPC ? (
                            <ThisPC
                                items={items}
                                cloudDrives={cloudDrives}
                                onNavigate={onNavigate}
                                viewMode={viewMode}
                                onShowContextMenu={onShowContextMenu}
                                onShowProperties={onShowProperties}
                                onRefresh={() => onRefresh?.()}
                                onAddCloudDrive={onAddCloudDrive}
                                specialFolders={specialFolders}
                            />
                        ) : processedItems.length === 0 ? (
                            <div className="explorer-state">
                                <span className="state-icon"><LineIcon name={searchQuery ? 'search' : 'folder'} size={28} /></span>
                                <h3>{searchQuery ? 'No matching items' : 'This folder is empty'}</h3>
                                <p>{searchQuery ? 'Try a different search term' : 'Right-click to create a new file or folder'}</p>
                            </div>
                        ) : groupBy === 'none' ? (
                            renderFileItems(processedItems)
                        ) : (
                            <div className="grouped-view">
                                {Object.entries(groupedItems).map(([groupName, groupItems]) => (
                                    groupItems.length > 0 && (
                                        <div key={groupName} className="file-group">
                                            <div className="group-header">
                                                <span className="group-name">{groupName}</span>
                                                <span className="group-count">{groupItems.length}</span>
                                            </div>
                                            <div className="group-content">
                                                {renderFileItems(groupItems)}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>

                    {!isThisPC && (
                        <footer className="explorer-statusbar">
                            <span>{processedItems.length} item{processedItems.length !== 1 ? 's' : ''}</span>
                            {selectedItems.length > 0 && (
                                <span className="selection-status">
                                    {selectedItems.length} selected{selectedSize > 0 ? ` · ${formatFileSize(selectedSize)}` : ''}
                                </span>
                            )}
                            {clipboardStatus?.count > 0 && (
                                <span className="clipboard-status">
                                    {clipboardStatus.count} {clipboardStatus.action === 'cut' ? 'to move' : 'on clipboard'}
                                </span>
                            )}
                        </footer>
                    )}
                </section>

                {preview}
            </div>

            {/* Rename Dialog */}
            {renameItem && (
                <div className="overlay" onClick={cancelRename}>
                    <form
                        ref={renameDialogRef}
                        className="rename-dialog dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="rename-dialog-title"
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={handleRenameSubmit}
                    >
                        <h3 id="rename-dialog-title">Rename</h3>
                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onFocus={handleRenameFocus}
                            autoFocus
                            className="rename-input"
                            aria-label="New name"
                        />
                        <div className="rename-actions">
                            <button type="button" className="btn btn-secondary" onClick={cancelRename}>Cancel</button>
                            <button type="submit" className="btn btn-primary">Rename</button>
                        </div>
                    </form>
                </div>
            )}
        </main>
    );
}

export default FileExplorer;
