import { useState, useEffect } from 'react';
import { getFileIcon } from '../../utils/fileIcons';
import { formatFileSize, formatDate, getFileType } from '../../utils/formatters';
import './FileItem.css';

const THUMB_GENERATION_SIZE = 256; // Generate high-quality thumbs once and scale down
const THUMB_CACHE_LIMIT = 500;
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif', '.ico'];
const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv', '.m4v'];

// LRU cache of data URLs keyed by path + mtime + size, so edited files get fresh thumbnails.
// A null value records a failed attempt so it is not retried on every render.
const thumbnailCache = new Map();

function cacheKey(item) {
    return `${item.path}|${item.modified}|${item.size}`;
}

function cacheGet(key) {
    if (!thumbnailCache.has(key)) return undefined;
    const value = thumbnailCache.get(key);
    thumbnailCache.delete(key);
    thumbnailCache.set(key, value);
    return value;
}

function cacheSet(key, value) {
    thumbnailCache.set(key, value);
    while (thumbnailCache.size > THUMB_CACHE_LIMIT) {
        thumbnailCache.delete(thumbnailCache.keys().next().value);
    }
}

function supportsThumbnail(item) {
    const ext = item.extension?.toLowerCase();
    return !item.isDirectory && !item.error && (IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext));
}

function FileItem({ item, viewMode, onOpen, selected, onSelect, onContextMenu, thumbnailSize = 80, clipboardStatus, focused }) {
    const key = cacheKey(item);
    const wantsThumb = supportsThumbnail(item);
    // Results are stored per key, so a stale result for an old key is simply ignored
    const [loaded, setLoaded] = useState({ key: null, data: null });
    const cached = cacheGet(key);
    const thumbnail = cached !== undefined ? cached : (loaded.key === key ? loaded.data : null);
    const loading = wantsThumb && cached === undefined && loaded.key !== key;

    // Check if item is in clipboard with 'cut' action
    const isCut = clipboardStatus?.action === 'cut' && clipboardStatus?.items?.includes(item.path);

    useEffect(() => {
        if (!wantsThumb || !window.electronAPI || thumbnailCache.has(key)) return undefined;
        let cancelled = false;

        window.electronAPI.getThumbnail(item.path, THUMB_GENERATION_SIZE)
            .then((result) => (result?.success && result.data ? result.data : null))
            .catch(() => null)
            .then((data) => {
                cacheSet(key, data);
                if (!cancelled) setLoaded({ key, data });
            });

        return () => {
            cancelled = true;
        };
    }, [key, wantsThumb, item.path]);

    const handleDoubleClick = () => {
        onOpen(item);
    };

    const handleClick = (e) => {
        onSelect?.(item, e);
    };

    // Selection for right-click is decided by the explorer (keeps multi-selection intact)
    const handleContextMenu = (e) => {
        onContextMenu?.(e, item);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onOpen(item);
        }
    };

    const icon = getFileIcon(item);

    // List view with small thumbnail
    if (viewMode === 'list') {
        return (
            <tr
                data-path={item.path}
                aria-selected={selected}
                className={`file-item-row ${selected ? 'selected' : ''} ${focused ? 'focused' : ''} ${item.isHidden ? 'hidden-file' : ''} ${isCut ? 'cut-item' : ''}`}
                onDoubleClick={handleDoubleClick}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onKeyDown={handleKeyDown}
                tabIndex={0}
            >
                <td className="file-cell file-name">
                    <span className="file-icon-wrapper-small">
                        {thumbnail ? (
                            <img src={thumbnail} alt="" className="file-thumbnail-small" />
                        ) : (
                            <span className="file-icon">{icon}</span>
                        )}
                    </span>
                    <span className="file-name-text truncate">{item.name}</span>
                </td>
                <td className="file-cell file-type truncate">{getFileType(item)}</td>
                <td className="file-cell file-size">{item.isDirectory ? '-' : formatFileSize(item.size)}</td>
                <td className="file-cell file-date truncate">{formatDate(item.modified)}</td>
            </tr>
        );
    }

    // Grid view with variable thumbnail size
    return (
        <button
            data-path={item.path}
            role="option"
            aria-selected={selected}
            title={item.name}
            className={`file-item-grid ${item.isDirectory ? 'is-folder' : ''} ${selected ? 'selected' : ''} ${focused ? 'focused' : ''} ${item.isHidden ? 'hidden-file' : ''} ${isCut ? 'cut-item' : ''}`}
            onDoubleClick={handleDoubleClick}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            style={{ width: thumbnailSize + 32 }}
        >
            <div
                className="file-icon-wrapper"
                style={{ width: thumbnailSize, height: thumbnailSize }}
            >
                {loading ? (
                    <div className="thumbnail-loading">
                        <div className="spinner-small"></div>
                    </div>
                ) : thumbnail ? (
                    <img src={thumbnail} alt="" className="file-thumbnail-grid" />
                ) : (
                    <span className="file-icon-large" style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        padding: '10%'
                    }}>
                        {icon}
                    </span>
                )}
            </div>
            <span className="file-name-grid truncate">{item.name}</span>
            {!item.isDirectory && thumbnailSize >= 64 && (
                <span className="file-size-grid">{formatFileSize(item.size)}</span>
            )}
        </button>
    );
}

export default FileItem;
