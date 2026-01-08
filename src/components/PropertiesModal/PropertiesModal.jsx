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
    const [newName, setNewName] = useState(item?.name || '');
    const [metadata, setMetadata] = useState(null);
    const [loadingMeta, setLoadingMeta] = useState(false);

    useEffect(() => {
        if (!isOpen || !item) return;

        setNewName(item.name);
        setMetadata(null);

        async function loadMetadata() {
            if (!window.electronAPI) return;

            const ext = (item.extension || '').toLowerCase();
            const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg'];
            const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];

            setLoadingMeta(true);
            try {
                if (imageExts.includes(ext)) {
                    const result = await window.electronAPI.getImageMetadata(item.path);
                    if (result.success) {
                        setMetadata({ type: 'image', ...result.metadata });
                    }
                } else if (videoExts.includes(ext)) {
                    const result = await window.electronAPI.getVideoMetadata(item.path);
                    if (result.success) {
                        setMetadata({ type: 'video', ...result.metadata });
                    }
                }
            } catch (err) {
                console.error('Error loading metadata:', err);
            } finally {
                setLoadingMeta(false);
            }
        }

        loadMetadata();
    }, [isOpen, item]);

    if (!isOpen || !item) return null;

    const handleRename = async () => {
        if (newName.trim() && newName !== item.name) {
            await onRename?.(item, newName.trim());
            setIsRenaming(false);
        }
    };

    const handleHide = async () => {
        const hiddenName = item.name.startsWith('.')
            ? item.name.slice(1)
            : '.' + item.name;
        await onRename?.(item, hiddenName);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleRename();
        } else if (e.key === 'Escape') {
            setIsRenaming(false);
            setNewName(item.name);
        }
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
                        {isRenaming ? (
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
                        <span className="properties-type">{getFileType(item)}</span>
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
                                <span className="properties-value">{getFileType(item)}</span>
                            </div>
                            {!item.isDirectory && (
                                <div className="properties-row">
                                    <span className="properties-label">Size</span>
                                    <span className="properties-value">{formatFileSize(item.size)}</span>
                                </div>
                            )}
                            <div className="properties-row">
                                <span className="properties-label">Location</span>
                                <span className="properties-value properties-path" title={item.path}>
                                    {item.path}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Image Metadata */}
                    {metadata?.type === 'image' && (
                        <section className="properties-section">
                            <h3 className="properties-section-title">Image Details</h3>
                            <div className="properties-grid">
                                {metadata.width && metadata.height && (
                                    <>
                                        <div className="properties-row">
                                            <span className="properties-label">Dimensions</span>
                                            <span className="properties-value">{metadata.width} × {metadata.height} px</span>
                                        </div>
                                        <div className="properties-row">
                                            <span className="properties-label">Megapixels</span>
                                            <span className="properties-value">{metadata.megapixels} MP</span>
                                        </div>
                                        <div className="properties-row">
                                            <span className="properties-label">Aspect Ratio</span>
                                            <span className="properties-value">{metadata.aspectRatio}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Video Metadata */}
                    {metadata?.type === 'video' && (
                        <section className="properties-section">
                            <h3 className="properties-section-title">Video Details</h3>
                            <div className="properties-grid">
                                {metadata.duration && (
                                    <div className="properties-row">
                                        <span className="properties-label">Duration</span>
                                        <span className="properties-value">{formatDuration(metadata.duration)}</span>
                                    </div>
                                )}
                                {metadata.width && metadata.height && (
                                    <div className="properties-row">
                                        <span className="properties-label">Resolution</span>
                                        <span className="properties-value">{metadata.width} × {metadata.height}</span>
                                    </div>
                                )}
                                {metadata.codec && (
                                    <div className="properties-row">
                                        <span className="properties-label">Video Codec</span>
                                        <span className="properties-value">{metadata.codec.toUpperCase()}</span>
                                    </div>
                                )}
                                {metadata.fps && (
                                    <div className="properties-row">
                                        <span className="properties-label">Frame Rate</span>
                                        <span className="properties-value">{Math.round(metadata.fps)} fps</span>
                                    </div>
                                )}
                                {metadata.bitrate && (
                                    <div className="properties-row">
                                        <span className="properties-label">Bitrate</span>
                                        <span className="properties-value">{formatBitrate(metadata.bitrate)}</span>
                                    </div>
                                )}
                                {metadata.audioCodec && (
                                    <div className="properties-row">
                                        <span className="properties-label">Audio Codec</span>
                                        <span className="properties-value">{metadata.audioCodec.toUpperCase()}</span>
                                    </div>
                                )}
                                {metadata.formatName && (
                                    <div className="properties-row">
                                        <span className="properties-label">Format</span>
                                        <span className="properties-value">{metadata.formatName}</span>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Dates */}
                    <section className="properties-section">
                        <h3 className="properties-section-title">Dates</h3>
                        <div className="properties-grid">
                            <div className="properties-row">
                                <span className="properties-label">Created</span>
                                <span className="properties-value">{formatDate(item.created)}</span>
                            </div>
                            <div className="properties-row">
                                <span className="properties-label">Modified</span>
                                <span className="properties-value">{formatDate(item.modified)}</span>
                            </div>
                        </div>
                    </section>

                    {/* Attributes */}
                    <section className="properties-section">
                        <h3 className="properties-section-title">Attributes</h3>
                        <div className="properties-attributes">
                            <label className="attribute-item">
                                <input
                                    type="checkbox"
                                    checked={item.isHidden || item.name.startsWith('.')}
                                    onChange={handleHide}
                                />
                                <span>Hidden</span>
                            </label>
                        </div>
                    </section>
                </div>

                <footer className="properties-footer">
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
                    <button className="properties-btn primary" onClick={onClose}>
                        OK
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default PropertiesModal;
