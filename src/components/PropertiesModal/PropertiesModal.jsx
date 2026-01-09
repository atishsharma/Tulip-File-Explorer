import { useState, useEffect } from 'react';
import { getFileIcon } from '../../utils/fileIcons';
import { formatFileSize, formatDate, getFileType } from '../../utils/formatters';
import './PropertiesModal.css';

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

function PropertiesModal({ isOpen, onClose, item, onRename }) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState('');
    const [metadata, setMetadata] = useState(null);
    const [contentInfo, setContentInfo] = useState(null);
    const [folderStats, setFolderStats] = useState(null);
    const [loadingMeta, setLoadingMeta] = useState(false);
    const [calculatingStats, setCalculatingStats] = useState(false);

    useEffect(() => {
        if (!isOpen || !item) return;

        setNewName(item.name);
        setMetadata(null);
        setContentInfo(null);
        setFolderStats(null);
        setLoadingMeta(true);

        async function loadData() {
            if (!window.electronAPI) return;

            try {
                // 1. Get Unified Content Info (includes exact Hidden status checked properly on backend)
                const info = await window.electronAPI.getContentInfo(item.path);
                setContentInfo(info);

                // 2. Load Item Specifics
                if (item.isDirectory && !item.isDrive) {
                    setCalculatingStats(true); // Don't block UI
                    window.electronAPI.calculateFolderStats(item.path).then(stats => {
                        setFolderStats(stats);
                        setCalculatingStats(false);
                    });
                } else if (item.isFile) {
                    // Load Media Metadata
                    const ext = (item.extension || '').toLowerCase();
                    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg'];
                    const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];

                    if (imageExts.includes(ext)) {
                        const result = await window.electronAPI.getImageMetadata(item.path);
                        if (result.success) setMetadata({ type: 'image', ...result.metadata });
                    } else if (videoExts.includes(ext)) {
                        const result = await window.electronAPI.getVideoMetadata(item.path);
                        if (result.success) setMetadata({ type: 'video', ...result.metadata });
                    }
                }
            } catch (err) {
                console.error('Error loading properties:', err);
            } finally {
                setLoadingMeta(false);
            }
        }

        loadData();
    }, [isOpen, item]);

    if (!isOpen || !item) return null;

    const handleRename = async () => {
        if (newName.trim() && newName !== item.name) {
            await onRename?.(item, newName.trim());
            setIsRenaming(false);
        }
    };

    const handleHideChange = async (e) => {
        const hide = e.target.checked;
        if (window.electronAPI) {
            const success = await window.electronAPI.setHiddenAttribute(item.path, hide);
            if (success) {
                // Update local state to reflect change immediately
                setContentInfo(prev => ({ ...prev, isHidden: hide }));
                // Might need to refresh explorer view to see changes...
                // Ideally we'd trigger a refresh callback here if provided
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleRename();
        } else if (e.key === 'Escape') {
            setIsRenaming(false);
            setNewName(item.name);
        }
    };

    // Drive Capacity Bar
    const renderDriveUsage = () => {
        if (!item.isDrive) return null;
        const used = item.used || 0;
        const total = item.size || 1;
        const percent = Math.min(100, Math.max(0, (used / total) * 100));
        const variant = percent > 90 ? 'danger' : 'primary';

        return (
            <div className="properties-drive-usage">
                <div className="usage-labels">
                    <span>Used: {formatFileSize(used)}</span>
                    <span>Free: {formatFileSize(item.free || 0)}</span>
                </div>
                <div className="usage-track">
                    <div
                        className={`usage-fill ${variant}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <div className="usage-total">Capacity: {formatFileSize(total)}</div>
            </div>
        );
    };

    return (
        <div className="properties-overlay" onClick={onClose}>
            <div className="properties-modal card scale-in" onClick={(e) => e.stopPropagation()}>
                <header className="properties-header">
                    <div className="properties-icon">
                        {metadata?.type === 'image' && item ? (
                            <img
                                src={`file://${item.path}`}
                                alt=""
                                className="properties-thumbnail"
                                style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }}
                            />
                        ) : (
                            getFileIcon(item)
                        )}
                    </div>
                    <div className="properties-title-section">
                        {isRenaming && !item.isDrive && !item.isSpecialFolder ? (
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleRename}
                                autoFocus
                                className="properties-name-input"
                            />
                        ) : (
                            <h2 className="properties-title truncate" title={item.name}>
                                {item.name}
                            </h2>
                        )}
                        <span className="properties-type">{item.isDrive ? 'Local Disk' : getFileType(item)}</span>
                    </div>
                    <button className="properties-close" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <div className="properties-content">
                    {/* General Info */}
                    <section className="properties-section">
                        <h3 className="properties-section-title">General</h3>
                        <div className="properties-grid">
                            <div className="properties-row">
                                <span className="properties-label">Type</span>
                                <span className="properties-value">{item.isDrive ? 'Local Disk' : getFileType(item)}</span>
                            </div>

                            <div className="properties-row">
                                <span className="properties-label">Location</span>
                                <span className="properties-value properties-path" title={item.path}>
                                    {item.path}
                                </span>
                            </div>

                            {!item.isDirectory && !item.isDrive && (
                                <div className="properties-row">
                                    <span className="properties-label">Size</span>
                                    <span className="properties-value">{formatFileSize(item.size)}</span>
                                </div>
                            )}

                            {/* Folder Stats */}
                            {item.isDirectory && !item.isDrive && (
                                <>
                                    <div className="properties-row">
                                        <span className="properties-label">Size</span>
                                        <span className="properties-value">
                                            {folderStats ? formatFileSize(folderStats.size) : (calculatingStats ? 'Calculating...' : formatFileSize(item.size || 0))}
                                        </span>
                                    </div>
                                    <div className="properties-row">
                                        <span className="properties-label">Contains</span>
                                        <span className="properties-value">
                                            {folderStats ? `${folderStats.files} Files, ${folderStats.folders} Folders` : (calculatingStats ? '...' : '-')}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* Drive Usage */}
                    {item.isDrive && (
                        <section className="properties-section">
                            <h3 className="properties-section-title">Drive Usage</h3>
                            {renderDriveUsage()}
                        </section>
                    )}

                    {/* Media Metadata */}
                    {metadata && (
                        <section className="properties-section">
                            <h3 className="properties-section-title">Media Details</h3>
                            <div className="properties-grid">
                                {metadata.width && (
                                    <div className="properties-row">
                                        <span className="properties-label">Dimensions</span>
                                        <span className="properties-value">{metadata.width} x {metadata.height}</span>
                                    </div>
                                )}
                                {metadata.duration && (
                                    <div className="properties-row">
                                        <span className="properties-label">Duration</span>
                                        <span className="properties-value">{formatDuration(metadata.duration)}</span>
                                    </div>
                                )}
                                {metadata.bitrate && (
                                    <div className="properties-row">
                                        <span className="properties-label">Bitrate</span>
                                        <span className="properties-value">{formatBitrate(metadata.bitrate)}</span>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Dates & Attributes */}
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
                                        checked={contentInfo ? contentInfo.isHidden : (item.isHidden || item.name.startsWith('.'))}
                                        onChange={handleHideChange}
                                        disabled={!window.electronAPI}
                                    />
                                    <span>Hidden</span>
                                </label>
                                <label className="attribute-item">
                                    <input type="checkbox" checked={contentInfo?.readOnly} disabled />
                                    <span>Read-only</span>
                                </label>
                            </div>
                        )}
                    </section>
                </div>

                <footer className="properties-footer">
                    {!item.isDrive && !item.isSpecialFolder && (
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
