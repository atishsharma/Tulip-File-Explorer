import { useState, useEffect, useRef } from 'react';
import { getFileIcon } from '../../utils/fileIcons';
import { formatFileSize, formatDate, getFileType } from '../../utils/formatters';
import { fileUrl } from '../../utils/paths';
import { useModal } from '../../hooks/useModal';
import './PropertiesModal.css';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg', '.tiff', '.tif'];
const VIDEO_EXTS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];

function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBitrate(bps) {
    if (!bps) return 'Unknown';
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
    if (bps >= 1000) return `${(bps / 1000).toFixed(0)} Kbps`;
    return `${bps} bps`;
}

function typeLabel(item) {
    if (item.isCloud) return 'Cloud Drive';
    if (item.isDrive) return 'Drive';
    return getFileType(item);
}

/**
 * Rendered only while open (App mounts it with a key per item), so all state starts fresh.
 */
function PropertiesModal({ isOpen, onClose, item: initialItem, onRename, onChanged, notify }) {
    // Local copy so the dialog follows the item after a rename or hide (its path changes)
    const [item, setItem] = useState(initialItem);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(initialItem?.name || '');
    const [metadata, setMetadata] = useState(null);
    const [contentInfo, setContentInfo] = useState(null);
    const [folderStats, setFolderStats] = useState(null);
    const renameInFlight = useRef(false);
    const dialogRef = useModal(isOpen, onClose);

    const itemPath = item?.path;
    const isFolder = !!item?.isDirectory && !item?.isDrive;
    const isFile = !!item && !item.isDirectory;
    const extension = (item?.extension || '').toLowerCase();

    useEffect(() => {
        if (!isOpen || !itemPath || !window.electronAPI) return undefined;
        let cancelled = false;

        (async () => {
            try {
                const info = await window.electronAPI.getContentInfo(itemPath);
                if (cancelled) return;
                setContentInfo(info);

                if (isFile && IMAGE_EXTS.includes(extension)) {
                    const result = await window.electronAPI.getImageMetadata(itemPath);
                    if (!cancelled && result.success) setMetadata({ type: 'image', ...result.metadata });
                } else if (isFile && VIDEO_EXTS.includes(extension)) {
                    const result = await window.electronAPI.getVideoMetadata(itemPath);
                    if (!cancelled && result.success) setMetadata({ type: 'video', ...result.metadata });
                }
            } catch (err) {
                console.error('Error loading properties:', err);
            }
        })();

        // Folder size can take a long time; it is cancelled when the dialog closes
        if (isFolder) {
            window.electronAPI.calculateFolderStats(itemPath).then((stats) => {
                if (!cancelled && stats && !stats.cancelled) setFolderStats(stats);
            });
        }

        return () => {
            cancelled = true;
            if (isFolder) window.electronAPI.cancelFolderStats(itemPath);
        };
    }, [isOpen, itemPath, isFile, isFolder, extension]);

    if (!isOpen || !item) return null;

    const canRename = !item.isDrive && !item.isSpecialFolder;

    const handleRename = async () => {
        if (renameInFlight.current) return;
        const trimmed = newName.trim();
        if (!trimmed || trimmed === item.name) {
            setIsRenaming(false);
            setNewName(item.name);
            return;
        }
        renameInFlight.current = true;
        try {
            const result = await onRename?.(item, trimmed);
            if (result?.success) {
                setItem((prev) => ({ ...prev, name: trimmed, path: result.newPath }));
                setIsRenaming(false);
            }
        } finally {
            renameInFlight.current = false;
        }
    };

    const handleHideChange = async (e) => {
        const hide = e.target.checked;
        if (!window.electronAPI) return;
        const result = await window.electronAPI.setHiddenAttribute(item.path, hide);
        if (result?.success) {
            const newPath = result.newPath || item.path;
            const name = newPath.split(/[\\/]/).pop();
            setItem((prev) => ({ ...prev, path: newPath, name, isHidden: hide }));
            setNewName(name);
            setContentInfo((prev) => ({ ...prev, isHidden: hide, path: newPath, name }));
            onChanged?.();
        } else {
            notify?.(`Couldn't change hidden attribute: ${result?.error || 'unknown error'}`, 'error');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRename();
        } else if (e.key === 'Escape') {
            e.stopPropagation();
            setIsRenaming(false);
            setNewName(item.name);
        }
    };

    const renderDriveUsage = () => {
        const total = item.total || item.size || contentInfo?.total || 0;
        const free = item.free ?? contentInfo?.free;
        if (!total) return <div className="usage-total">Capacity unknown</div>;
        const used = item.used ?? (free != null ? total - free : 0);
        const percent = Math.min(100, Math.max(0, (used / total) * 100));
        const variant = percent > 90 ? 'danger' : 'primary';

        return (
            <div className="properties-drive-usage">
                <div className="usage-labels">
                    <span>Used: {formatFileSize(used)}</span>
                    <span>Free: {free != null ? formatFileSize(free) : 'Unknown'}</span>
                </div>
                <div className="usage-track" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
                    <div className={`usage-fill ${variant}`} style={{ width: `${percent}%` }} />
                </div>
                <div className="usage-total">Capacity: {formatFileSize(total)}</div>
            </div>
        );
    };

    const isHidden = contentInfo ? contentInfo.isHidden : (item.isHidden || item.name.startsWith('.'));

    return (
        <div className="properties-overlay" onClick={onClose}>
            <div
                ref={dialogRef}
                className="properties-modal card scale-in"
                role="dialog"
                aria-modal="true"
                aria-labelledby="properties-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="properties-header">
                    <div className="properties-icon">
                        {metadata?.type === 'image' ? (
                            <img
                                src={fileUrl(item.path)}
                                alt=""
                                className="properties-thumbnail"
                                style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }}
                            />
                        ) : (
                            getFileIcon(item)
                        )}
                    </div>
                    <div className="properties-title-section">
                        {isRenaming && canRename ? (
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleRename}
                                autoFocus
                                className="properties-name-input"
                                aria-label="New name"
                            />
                        ) : (
                            <h2 id="properties-title" className="properties-title truncate" title={item.name}>
                                {item.name}
                            </h2>
                        )}
                        <span className="properties-type">{typeLabel(item)}</span>
                    </div>
                    <button className="properties-close" onClick={onClose} aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <div className="properties-content">
                    <section className="properties-section">
                        <h3 className="properties-section-title">General</h3>
                        <div className="properties-grid">
                            <div className="properties-row">
                                <span className="properties-label">Type</span>
                                <span className="properties-value">{typeLabel(item)}</span>
                            </div>

                            <div className="properties-row">
                                <span className="properties-label">Location</span>
                                <span className="properties-value properties-path" title={item.path}>
                                    {item.path}
                                </span>
                            </div>

                            {isFile && (
                                <div className="properties-row">
                                    <span className="properties-label">Size</span>
                                    <span className="properties-value">{formatFileSize(contentInfo?.size ?? item.size)}</span>
                                </div>
                            )}

                            {isFolder && (
                                <>
                                    <div className="properties-row">
                                        <span className="properties-label">Size</span>
                                        <span className="properties-value">
                                            {folderStats ? formatFileSize(folderStats.size) : 'Calculating...'}
                                        </span>
                                    </div>
                                    <div className="properties-row">
                                        <span className="properties-label">Contains</span>
                                        <span className="properties-value">
                                            {folderStats ? `${folderStats.files} Files, ${folderStats.folders} Folders` : '...'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {item.isDrive && (
                        <section className="properties-section">
                            <h3 className="properties-section-title">Drive Usage</h3>
                            {renderDriveUsage()}
                        </section>
                    )}

                    {metadata && (
                        <section className="properties-section">
                            <h3 className="properties-section-title">Media Details</h3>
                            <div className="properties-grid">
                                {!!metadata.width && (
                                    <div className="properties-row">
                                        <span className="properties-label">Dimensions</span>
                                        <span className="properties-value">{metadata.width} x {metadata.height}</span>
                                    </div>
                                )}
                                {!!metadata.duration && (
                                    <div className="properties-row">
                                        <span className="properties-label">Duration</span>
                                        <span className="properties-value">{formatDuration(metadata.duration)}</span>
                                    </div>
                                )}
                                {!!metadata.bitrate && (
                                    <div className="properties-row">
                                        <span className="properties-label">Bitrate</span>
                                        <span className="properties-value">{formatBitrate(metadata.bitrate)}</span>
                                    </div>
                                )}
                                {!!metadata.fps && (
                                    <div className="properties-row">
                                        <span className="properties-label">Frame rate</span>
                                        <span className="properties-value">{metadata.fps} fps</span>
                                    </div>
                                )}
                                {metadata.ffprobeMissing && (
                                    <div className="properties-row">
                                        <span className="properties-label">Details</span>
                                        <span className="properties-value">Install ffprobe (FFmpeg) for video details</span>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    <section className="properties-section">
                        <h3 className="properties-section-title">Attributes</h3>
                        <div className="properties-grid">
                            <div className="properties-row">
                                <span className="properties-label">Created</span>
                                <span className="properties-value">{formatDate(contentInfo?.created || item.created)}</span>
                            </div>
                            <div className="properties-row">
                                <span className="properties-label">Modified</span>
                                <span className="properties-value">{formatDate(contentInfo?.modified || item.modified)}</span>
                            </div>
                        </div>

                        {!item.isDrive && (
                            <div className="properties-attributes">
                                <label className="attribute-item">
                                    <input
                                        type="checkbox"
                                        checked={!!isHidden}
                                        onChange={handleHideChange}
                                        disabled={!window.electronAPI || item.isSpecialFolder}
                                    />
                                    <span>Hidden</span>
                                </label>
                                <label className="attribute-item">
                                    <input type="checkbox" checked={!!contentInfo?.readOnly} readOnly disabled />
                                    <span>Read-only</span>
                                </label>
                            </div>
                        )}
                    </section>
                </div>

                <footer className="properties-footer">
                    {canRename && (
                        <button
                            className="properties-btn outlined"
                            onClick={() => {
                                setIsRenaming(true);
                                setNewName(item.name);
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                            Rename
                        </button>
                    )}
                    <button className="properties-btn primary" onClick={onClose}>
                        OK
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default PropertiesModal;
