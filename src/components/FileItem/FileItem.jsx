import { useState, useEffect } from 'react';
import { getFileIcon } from '../../utils/fileIcons';
import { formatFileSize, formatDate, getFileType } from '../../utils/formatters';
import './FileItem.css';

const thumbnailCache = new Map();
const THUMB_GENERATION_SIZE = 256; // Generate high-quality thumbs once and scale down

function FileItem({ item, viewMode, onOpen, selected, onSelect, onContextMenu, thumbnailSize = 80, clipboardStatus, focused }) {
    // Initialize from cache if available
    const [thumbnail, setThumbnail] = useState(() => thumbnailCache.get(item.path) || null);
    const [loading, setLoading] = useState(!thumbnailCache.has(item.path));

    // Check if item is in clipboard with 'cut' action
    const isCut = clipboardStatus?.action === 'cut' && clipboardStatus?.items?.includes(item.path);

    useEffect(() => {
        // If we already have a thumbnail map for this path, don't re-fetch
        if (thumbnailCache.has(item.path)) {
            setThumbnail(thumbnailCache.get(item.path));
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function loadThumbnail() {
            if (!window.electronAPI) return;

            const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.ico'];
            // Also supports video thumbs if implemented in backend
            const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];
            const supportsThumb = imageExts.includes(item.extension?.toLowerCase()) || videoExts.includes(item.extension?.toLowerCase());

            if (item.isFile && supportsThumb) {
                setLoading(true);
                try {
                    // Request fixed size to allow efficient caching and CSS scaling
                    const result = await window.electronAPI.getThumbnail(item.path, THUMB_GENERATION_SIZE);
                    if (!cancelled && result.success && result.data) {
                        thumbnailCache.set(item.path, result.data);
                        setThumbnail(result.data);
                    }
                } catch (err) {
                    // Ignore errors
                } finally {
                    if (!cancelled) setLoading(false);
                }
            } else {
                setLoading(false);
            }
        }

        loadThumbnail();

        return () => {
            cancelled = true;
        };
    }, [item.path, item.extension, item.isFile]); // Removed thumbnailSize dependency to avoid re-fetching on resize

    const handleDoubleClick = () => {
        onOpen(item);
    };

    const handleClick = (e) => {
        onSelect?.(item, e);
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        onSelect?.(item, e);
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
