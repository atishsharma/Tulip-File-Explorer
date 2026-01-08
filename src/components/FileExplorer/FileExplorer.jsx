import { useState, useCallback, useMemo, useEffect } from 'react';
import Breadcrumb from '../Breadcrumb/Breadcrumb';
import FileItem from '../FileItem/FileItem';
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
    onDeleteItem,
    onRenameItem,
    onCreateFolder,
    onCreateFile,
    onShowContextMenu,
    selectedItem,
    onSelectItem,
    onShowProperties,
    clipboardStatus,
    onOpenWith,
    onPaste,
    onDeleteItems,
}) {
    const [viewMode, setViewMode] = useState('grid');
    const [showHidden, setShowHidden] = useState(false);
    const [renameItem, setRenameItem] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [groupBy, setGroupBy] = useState('none');
    const [thumbnailSize, setThumbnailSize] = useState(160);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showGroupMenu, setShowGroupMenu] = useState(false);
    const [showSizeMenu, setShowSizeMenu] = useState(false);

    // Multi-select state
    const [selectedItems, setSelectedItems] = useState([]);

    // Drag selection state
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null);

    // Focus state for keyboard navigation
    const [focusedItem, setFocusedItem] = useState(null);

    // Update focused item when selection changes (if single select)
    useEffect(() => {
        if (selectedItems.length === 1) {
            setFocusedItem(selectedItems[0]);
        }
    }, [selectedItems]);

    // Drag selection handlers
    useEffect(() => {
        if (!isSelecting) return;

        const handleMouseMove = (e) => {
            if (!selectionStart) return;

            const currentX = e.clientX;
            const currentY = e.clientY;

            const box = {
                left: Math.min(selectionStart.x, currentX),
                top: Math.min(selectionStart.y, currentY),
                width: Math.abs(currentX - selectionStart.x),
                height: Math.abs(currentY - selectionStart.y)
            };

            setSelectionBox(box);

            // Calculate intersection
            const items = document.querySelectorAll('[data-path]');
            const newSelected = [];

            items.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.left < box.left + box.width &&
                    rect.right > box.left &&
                    rect.top < box.top + box.height &&
                    rect.bottom > box.top) {
                    newSelected.push(el.getAttribute('data-path'));
                }
            });

            if (e.ctrlKey || e.metaKey) {
                // If Ctrl is held, add new items to existing selection
                setSelectedItems(prev => {
                    const set = new Set(prev);
                    newSelected.forEach(path => set.add(path));
                    return Array.from(set);
                });
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
    useEffect(() => {
        setSelectedItems([]);
        onSelectItem?.(null);
        setFocusedItem(null);
        setIsSelecting(false);
        setSelectionBox(null);
    }, [currentPath]);



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

    // Filter, sort, and group items
    const processedItems = useMemo(() => {
        let filtered = showHidden ? items : items.filter((item) => !item.isHidden);

        filtered = [...filtered].sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;

            let comparison = 0;
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name, undefined, { numeric: true });
                    break;
                case 'date':
                    comparison = new Date(b.modified) - new Date(a.modified);
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

        return filtered;
    }, [items, showHidden, sortBy, sortOrder]);

    // Keyboard shortcuts and Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if input is active
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const currentIndex = focusedItem ? processedItems.findIndex(i => i.path === focusedItem) : -1;
            const gridCols = viewMode === 'grid' ? Math.floor(document.querySelector('.file-grid')?.offsetWidth / (thumbnailSize + 16)) || 1 : 1;

            if (e.key === 'Escape') {
                // Deselect all
                setSelectedItems([]);
                onSelectItem?.(null);
                setFocusedItem(null);
                setSelectionBox(null);
                setIsSelecting(false);
            } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                // Select all
                const filteredItems = showHidden ? items : items.filter((item) => !item.isHidden);
                setSelectedItems(filteredItems.map(item => item.path));
                if (filteredItems.length > 0) {
                    onSelectItem?.(filteredItems[filteredItems.length - 1]);
                    setFocusedItem(filteredItems[filteredItems.length - 1].path);
                }
            } else if (e.key === 'Delete') {
                e.preventDefault();
                if (selectedItems.length > 0) {
                    const itemsToDelete = items.filter(i => selectedItems.includes(i.path));
                    if (itemsToDelete.length > 0) {
                        onDeleteItems?.(itemsToDelete);
                    }
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                if (selectedItems.length > 0 && window.electronAPI) {
                    window.electronAPI.clipboardCopy(selectedItems); // Pass all selected paths
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                e.preventDefault();
                if (selectedItems.length > 0 && window.electronAPI) {
                    window.electronAPI.clipboardCut(selectedItems);
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                onPaste?.();
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();

                let nextIndex = currentIndex;
                const maxIndex = processedItems.length - 1;

                if (currentIndex === -1) {
                    nextIndex = 0; // Start at beginning if nothing focused
                } else {
                    if (e.key === 'ArrowRight') nextIndex = Math.min(currentIndex + 1, maxIndex);
                    else if (e.key === 'ArrowLeft') nextIndex = Math.max(currentIndex - 1, 0);
                    else if (e.key === 'ArrowDown') nextIndex = Math.min(currentIndex + (viewMode === 'grid' ? gridCols : 1), maxIndex);
                    else if (e.key === 'ArrowUp') nextIndex = Math.max(currentIndex - (viewMode === 'grid' ? gridCols : 1), 0);
                }

                if (processedItems[nextIndex]) {
                    const nextItem = processedItems[nextIndex];
                    setFocusedItem(nextItem.path);

                    // Selection logic
                    if (e.shiftKey) {
                        const firstSelected = selectedItems.length > 0 ? selectedItems[0] : (focusedItem || nextItem.path);
                        const anchorIndex = processedItems.findIndex(i => i.path === firstSelected);
                        // If we can't find anchor, use nextIndex
                        const anchor = anchorIndex !== -1 ? anchorIndex : nextIndex;

                        const start = Math.min(anchor, nextIndex);
                        const end = Math.max(anchor, nextIndex);
                        const range = processedItems.slice(start, end + 1).map(i => i.path);
                        setSelectedItems(range);
                    } else if (e.ctrlKey) {
                        // Just move focus (done above by setFocusedItem)
                    } else {
                        // Single select
                        setSelectedItems([nextItem.path]);
                        onSelectItem?.(nextItem);
                    }

                    // Scroll into view
                    requestAnimationFrame(() => {
                        const el = document.querySelector(`[data-path="${nextItem.path}"]`);
                        el?.scrollIntoView({ block: 'nearest' });
                    });
                }
            } else if (e.key === ' ' && e.ctrlKey) {
                e.preventDefault();
                if (focusedItem) {
                    // Toggle selection of focused item
                    setSelectedItems(prev => {
                        if (prev.includes(focusedItem)) return prev.filter(p => p !== focusedItem);
                        return [...prev, focusedItem];
                    });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [items, showHidden, onSelectItem, selectedItems, onDeleteItem, onPaste, focusedItem, processedItems, viewMode, thumbnailSize, onDeleteItems]);

    // Group items
    const groupedItems = useMemo(() => {
        if (groupBy === 'none') {
            return { 'All Files': processedItems };
        }

        const groups = {};

        processedItems.forEach((item) => {
            let groupKey;

            switch (groupBy) {
                case 'type':
                    if (item.isDirectory) {
                        groupKey = 'Folders';
                    } else {
                        const ext = (item.extension || '').toLowerCase();
                        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) {
                            groupKey = 'Images';
                        } else if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.webm'].includes(ext)) {
                            groupKey = 'Videos';
                        } else if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].includes(ext)) {
                            groupKey = 'Audio';
                        } else if (['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt'].includes(ext)) {
                            groupKey = 'Documents';
                        } else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
                            groupKey = 'Archives';
                        } else {
                            groupKey = 'Other';
                        }
                    }
                    break;
                case 'date':
                    const date = new Date(item.modified);
                    const today = new Date();
                    const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
                    if (diffDays === 0) groupKey = 'Today';
                    else if (diffDays === 1) groupKey = 'Yesterday';
                    else if (diffDays < 7) groupKey = 'This Week';
                    else if (diffDays < 30) groupKey = 'This Month';
                    else if (diffDays < 365) groupKey = 'This Year';
                    else groupKey = 'Older';
                    break;
                case 'size':
                    const size = item.size || 0;
                    if (item.isDirectory) groupKey = 'Folders';
                    else if (size === 0) groupKey = 'Empty';
                    else if (size < 1024) groupKey = 'Tiny (< 1 KB)';
                    else if (size < 1024 * 1024) groupKey = 'Small (< 1 MB)';
                    else if (size < 100 * 1024 * 1024) groupKey = 'Medium (< 100 MB)';
                    else if (size < 1024 * 1024 * 1024) groupKey = 'Large (< 1 GB)';
                    else groupKey = 'Huge (> 1 GB)';
                    break;
                default:
                    groupKey = 'All';
            }

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
        });

        return groups;
    }, [processedItems, groupBy]);

    const handleSelect = useCallback((item, e) => {
        setFocusedItem(item.path); // Update focus on click

        if (e?.ctrlKey || e?.metaKey) {
            // Toggle selection
            setSelectedItems(prev => {
                if (prev.includes(item.path)) {
                    return prev.filter(p => p !== item.path);
                } else {
                    return [...prev, item.path];
                }
            });
        } else if (e?.shiftKey && selectedItems.length > 0) {
            // Range selection
            const lastSelected = selectedItems[selectedItems.length - 1]; // This is imprecise as 'last', but ok for MVP
            // Better to use a dedicated anchor ref, but focusedItem might serve

            const lastIndex = processedItems.findIndex(i => i.path === lastSelected);
            const currentIndex = processedItems.findIndex(i => i.path === item.path);
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            const range = processedItems.slice(start, end + 1).map(i => i.path);
            setSelectedItems(range); // Should we merge or replace? Standard is replace for shift-click usually.
        } else {
            // Single selection
            setSelectedItems([item.path]);
        }
        onSelectItem?.(item);
    }, [selectedItems, processedItems, onSelectItem]);

    const handleContextMenu = useCallback(async (e, item) => {
        e.preventDefault();
        if (!window.electronAPI) return;

        // If right-click on an item that is NOT selected, select it (exclusive)
        // If right-click on an item that IS selected, keep selection!
        if (item) {
            if (!selectedItems.includes(item.path)) {
                setSelectedItems([item.path]);
                onSelectItem?.(item);
                setFocusedItem(item.path);
            }
            // If already selected, do nothing to selection
        }

        const menuType = item ? (item.isDirectory ? 'folder' : 'file') : 'background';
        const action = await onShowContextMenu?.(menuType, item);

        if (!action) return;

        // Use selectedItems for bulk actions if applicable
        // Note: 'item' param here is the clicked item.
        // Copy/Cut/Delete should operate on 'selectedItems' if 'item' is inside 'selectedItems'.
        // If we right-clicked outside selection (handled above), we selected it, so 'selectedItems' is correct.

        const targets = selectedItems.length > 0 ? selectedItems : (item ? [item.path] : []);

        if (action === 'open') {
            onOpenFile?.(item); // Open usually opens the clicked item, not all selected
        } else if (action === 'open-new') {
            onOpenFile?.(item);
        } else if (action === 'open-with') {
            onOpenWith?.(item);
        } else if (action === 'cut') {
            if (window.electronAPI && targets.length > 0) {
                await window.electronAPI.clipboardCut(targets);
            }
        } else if (action === 'copy') {
            if (window.electronAPI && targets.length > 0) {
                await window.electronAPI.clipboardCopy(targets);
            }
        } else if (action === 'delete') {
            if (targets.length > 0) {
                // We need object items for onDeleteItems usually?
                // onDeleteItems expects objects? Prop is passed 'deleteItems' from useFileSystem which expects objects... 
                // Wait, useFileSystem's deleteItems implementation:
                // const deleteItems = useCallback(async (itemsToDelete) => { ... item.path ... }
                // So it expects an array of objects { path: ... }.

                // We have paths in selectedItems. need to find objects.
                const itemsToDelete = items.filter(i => targets.includes(i.path));
                onDeleteItems?.(itemsToDelete);
            }
        } else if (action === 'rename') {
            setRenameItem(item); // Rename works on single item usually
            setRenameValue(item.name);
        } else if (action === 'properties') {
            onShowProperties?.(item); // Properties usually for clicked item or combined? MVP: clicked
        } else if (action === 'new-folder') {
            onCreateFolder?.('New Folder');
        } else if (action === 'new-file') {
            onCreateFile?.('New Text Document.txt');
        } else if (action === 'paste') {
            onPaste?.();
        } else if (action === 'refresh') {
            onRefresh?.();
        }
    }, [currentPath, selectedItems, processedItems, onOpenFile, onDeleteItem, onDeleteItems, onShowProperties, onRefresh, onCreateFolder, onCreateFile, onShowContextMenu, onSelectItem, onOpenWith, onPaste, items]);

    // Background handlers
    const handleBackgroundContextMenu = (e) => {
        if (e.target.classList.contains('file-grid') ||
            e.target.classList.contains('explorer-content') ||
            e.target.classList.contains('file-table') ||
            e.target.classList.contains('group-content')) {

            // Only clear selection if not right-clicking on an item (handled by bubbling check, but here we are on background)
            // Actually context menu on background should NOT clear selection? Windows does not clear selection on background right click?
            // Windows DOES NOT clear selection on background context menu.
            // Mac DOES clear selection.
            // Let's stick to current behavior: Select None
            setSelectedItems([]);

            // Pass 'background' menu type
            handleContextMenu(e, null);
        }
    };

    // We need to handle the "action" result for new-folder/file from background menu
    /* 
       Note: handleContextMenu logic above awaits the action. 
       We need to add the handlers there (lines 300+).
    */

    const handleMouseDown = useCallback((e) => {
        // Only left click (0) and on background
        if (e.button !== 0) return;

        // Check targets to avoid interfering with items or UI
        if (e.target.closest('.file-item-grid') || e.target.closest('.file-item-row') ||
            e.target.closest('.toolbar-btn') || e.target.closest('.preview-panel') ||
            e.target.closest('.dropdown-wrapper') || e.target.closest('.rename-dialog')) {
            return;
        }

        setIsSelecting(true);
        setSelectionStart({ x: e.clientX, y: e.clientY });
        setSelectionBox({ left: e.clientX, top: e.clientY, width: 0, height: 0 });

        // Clear selection if not modified key is pressed
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            setSelectedItems([]);
            onSelectItem?.(null);
        }

        // Prevent text selection
        document.body.style.userSelect = 'none';
    }, [onSelectItem]);

    const handleRenameSubmit = async (e) => {
        e.preventDefault();
        if (renameItem && renameValue.trim() && renameValue !== renameItem.name) {
            await onRenameItem?.(renameItem, renameValue.trim());
        }
        setRenameItem(null);
        setRenameValue('');
    };

    const handleRenameKeyDown = (e) => {
        if (e.key === 'Escape') {
            setRenameItem(null);
            setRenameValue('');
        }
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
                <div className="file-grid" style={{ '--thumb-size': `${thumbnailSize}px` }}>
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
            <table className="file-table">
                <thead>
                    <tr>
                        <th className="table-header" onClick={() => toggleSort('name')}>
                            Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="table-header" onClick={() => toggleSort('type')}>
                            Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="table-header size-header" onClick={() => toggleSort('size')}>
                            Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="table-header" onClick={() => toggleSort('date')}>
                            Modified {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
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

    return (
        <main className="file-explorer">
            {/* Toolbar */}
            <div className="explorer-toolbar">
                <div className="toolbar-nav">
                    <button className="toolbar-btn" onClick={onNavigateBack} disabled={!canGoBack} title="Back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button className="toolbar-btn" onClick={onNavigateForward} disabled={!canGoForward} title="Forward">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                    <button className="toolbar-btn" onClick={onNavigateUp} disabled={!canGoUp} title="Up">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                    </button>
                    <button className="toolbar-btn" onClick={onRefresh} title="Refresh">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 4v6h-6M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                        </svg>
                    </button>
                </div>

                <Breadcrumb currentPath={currentPath} onNavigate={onNavigate} />

                <div className="toolbar-actions">
                    {/* 1. Hidden Files Toggle */}
                    <button
                        className={`toolbar-btn ${showHidden ? 'active' : ''}`}
                        onClick={() => setShowHidden(!showHidden)}
                        title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {showHidden ? (
                                <>
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </>
                            ) : (
                                <>
                                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                </>
                            )}
                        </svg>
                    </button>

                    {/* 2. Sort Button */}
                    <div className="dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
                        <button
                            className={`toolbar-btn ${showSortMenu ? 'active' : ''}`}
                            onClick={() => { setShowSortMenu(!showSortMenu); setShowGroupMenu(false); setShowSizeMenu(false); }}
                            title="Sort by"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M6 12h12M9 18h6" />
                            </svg>
                        </button>
                        {showSortMenu && (
                            <div className="dropdown-menu glass-dropdown">
                                <div className="dropdown-header">Sort by</div>
                                {SORT_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        className={`dropdown-item ${sortBy === opt.id ? 'active' : ''}`}
                                        onClick={() => toggleSort(opt.id)}
                                    >
                                        <span>{opt.label}</span>
                                        {sortBy === opt.id && (
                                            <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 3. Group Button */}
                    <div className="dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
                        <button
                            className={`toolbar-btn ${groupBy !== 'none' ? 'active' : ''}`}
                            onClick={() => { setShowGroupMenu(!showGroupMenu); setShowSortMenu(false); setShowSizeMenu(false); }}
                            title="Group by"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 6h16M4 12h16M4 18h16" />
                                <rect x="4" y="6" width="4" height="4" fill="currentColor" fillOpacity="0.2" />
                                <rect x="4" y="12" width="4" height="4" fill="currentColor" fillOpacity="0.2" />
                            </svg>
                        </button>
                        {showGroupMenu && (
                            <div className="dropdown-menu glass-dropdown">
                                <div className="dropdown-header">Group by</div>
                                {GROUP_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        className={`dropdown-item ${groupBy === opt.id ? 'active' : ''}`}
                                        onClick={() => { setGroupBy(opt.id); setShowGroupMenu(false); }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 4. View Toggle */}
                    <div className="view-toggle">
                        <button
                            className={`toolbar-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Grid view"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                        </button>
                        <button
                            className={`toolbar-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            title="List view"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="8" y1="6" x2="21" y2="6" />
                                <line x1="8" y1="12" x2="21" y2="12" />
                                <line x1="8" y1="18" x2="21" y2="18" />
                                <line x1="3" y1="6" x2="3.01" y2="6" />
                                <line x1="3" y1="12" x2="3.01" y2="12" />
                                <line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* 5. Thumbnail Size Dropdown */}
                    {viewMode === 'grid' && (
                        <div className="dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
                            <button
                                className={`toolbar-btn ${showSizeMenu ? 'active' : ''}`}
                                onClick={() => { setShowSizeMenu(!showSizeMenu); setShowSortMenu(false); setShowGroupMenu(false); }}
                                title="Thumbnail size"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="2" y="7" width="20" height="10" rx="2" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            </button>
                            {showSizeMenu && (
                                <div className="dropdown-menu glass-dropdown size-dropdown">
                                    <div className="dropdown-header">Thumbnail Size</div>
                                    <div className="size-slider-container">
                                        <input
                                            type="range"
                                            min="48"
                                            max="160"
                                            value={thumbnailSize}
                                            onChange={(e) => setThumbnailSize(Number(e.target.value))}
                                            className="size-slider"
                                        />
                                        <span className="size-label">{thumbnailSize}px</span>
                                    </div>
                                    <div className="size-presets">
                                        <button onClick={() => setThumbnailSize(48)}>S</button>
                                        <button onClick={() => setThumbnailSize(80)}>M</button>
                                        <button onClick={() => setThumbnailSize(120)}>L</button>
                                        <button onClick={() => setThumbnailSize(160)}>XL</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Rename Dialog */}
            {renameItem && (
                <div className="rename-overlay" onClick={() => setRenameItem(null)}>
                    <form className="rename-dialog card" onClick={(e) => e.stopPropagation()} onSubmit={handleRenameSubmit}>
                        <h3>Rename</h3>
                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            autoFocus
                            className="rename-input"
                        />
                        <div className="rename-actions">
                            <button type="button" className="rename-btn cancel" onClick={() => setRenameItem(null)}>Cancel</button>
                            <button type="submit" className="rename-btn confirm">Rename</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Content */}
            <div
                className="explorer-content"
                onContextMenu={handleBackgroundContextMenu}
                onMouseDown={handleMouseDown}
            >
                {/* Selection Box */}
                {selectionBox && (
                    <div
                        className="selection-box"
                        style={{
                            left: selectionBox.left,
                            top: selectionBox.top,
                            width: selectionBox.width,
                            height: selectionBox.height
                        }}
                    />
                )}

                {loading ? (
                    <div className="explorer-loading">
                        <div className="spinner"></div>
                        <span>Loading...</span>
                    </div>
                ) : error ? (
                    <div className="explorer-error">
                        <span className="error-icon">⚠️</span>
                        <h3>Unable to access folder</h3>
                        <p>{error}</p>
                        <button className="retry-btn" onClick={onRefresh}>Try Again</button>
                    </div>
                ) : processedItems.length === 0 ? (
                    <div className="explorer-empty">
                        <span className="empty-icon">📂</span>
                        <h3>This folder is empty</h3>
                        <p>There are no files or folders to display</p>
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

            {/* Status Bar */}
            <div className="explorer-statusbar">
                <span>{processedItems.length} items</span>
                {selectedItems.length > 1 && (
                    <span className="selection-status">{selectedItems.length} selected</span>
                )}
                {clipboardStatus?.count > 0 && (
                    <span className="clipboard-status">
                        {clipboardStatus.action === 'cut' ? '✂️' : '📋'} {clipboardStatus.count} item(s)
                    </span>
                )}
            </div>
        </main>
    );
}

export default FileExplorer;
