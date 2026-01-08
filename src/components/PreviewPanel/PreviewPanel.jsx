import { useState, useEffect, useRef } from 'react';
import { getFileIcon } from '../../utils/fileIcons';
import { formatFileSize, formatDate, getFileType } from '../../utils/formatters';
import './PreviewPanel.css';

function PreviewPanel({ item, onClose }) {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState(null);
    const [width, setWidth] = useState(280);
    const resizeRef = useRef(null);
    const isDragging = useRef(false);

    // Load preview and metadata
    useEffect(() => {
        if (!item) {
            setPreview(null);
            setMetadata(null);
            return;
        }

        async function loadPreview() {
            if (!window.electronAPI) return;
            setLoading(true);
            try {
                const result = await window.electronAPI.readFilePreview(item.path);
                setPreview(result);

                // Load metadata for images
                const ext = (item.extension || '').toLowerCase();
                const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg'];
                const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];

                if (imageExts.includes(ext)) {
                    const meta = await window.electronAPI.getImageMetadata(item.path);
                    if (meta.success) setMetadata({ type: 'image', ...meta.metadata });
                } else if (videoExts.includes(ext)) {
                    const meta = await window.electronAPI.getVideoMetadata(item.path);
                    if (meta.success) setMetadata({ type: 'video', ...meta.metadata });
                } else {
                    setMetadata(null);
                }
            } catch (err) {
                setPreview({ success: false, error: err.message });
                setMetadata(null);
            } finally {
                setLoading(false);
            }
        }

        if (!item.isDirectory) {
            loadPreview();
        } else {
            setPreview({ success: true, type: 'folder' });
            setMetadata(null);
        }
    }, [item]);

    // Resize handling
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging.current) {
                const newWidth = window.innerWidth - e.clientX;
                setWidth(Math.max(200, Math.min(500, newWidth)));
            }
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleResizeStart = (e) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    const formatDuration = (seconds) => {
        if (!seconds) return null;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleOpen = () => {
        if (window.electronAPI && item) {
            window.electronAPI.openFile(item.path);
        }
    };

    const renderPreview = () => {
        if (!preview) return null;

        if (!preview.success) {
            return (
                <div className="preview-error">
                    <span className="preview-icon-large">⚠️</span>
                    <p>Unable to preview</p>
                </div>
            );
        }

        switch (preview.type) {
            case 'image':
                return <img src={preview.data} alt={item?.name} className="preview-image" />;
            case 'video':
                return (
                    <video controls className="preview-video" key={preview.path}>
                        <source src={`file://${preview.path}`} />
                    </video>
                );
            case 'audio':
                return (
                    <div className="preview-audio-container">
                        <span className="preview-icon-large">🎵</span>
                        <audio controls className="preview-audio" key={preview.path}>
                            <source src={`file://${preview.path}`} />
                        </audio>
                    </div>
                );
            case 'text':
                return (
                    <pre className="preview-text">
                        {preview.content}
                        {preview.truncated && <span className="truncated-notice">... (truncated)</span>}
                    </pre>
                );
            case 'folder':
                return (
                    <div className="preview-folder">
                        <span className="preview-icon-large">📁</span>
                        <p>Folder</p>
                    </div>
                );
            case 'pdf':
                return (
                    <div className="preview-pdf">
                        <span className="preview-icon-large">📄</span>
                        <p>PDF Document</p>
                    </div>
                );
            default:
                return (
                    <div className="preview-unknown">
                        <span className="preview-icon-large">{getFileIcon(item)}</span>
                        <p>{getFileType(item)}</p>
                    </div>
                );
        }
    };

    return (
        <aside className="preview-panel glass-panel" style={{ width }}>
            {/* Resize Handle */}
            <div
                className="resize-handle"
                onMouseDown={handleResizeStart}
                ref={resizeRef}
            />

            <div className="preview-content-wrapper">
                {!item ? (
                    <div className="preview-empty">
                        <span className="preview-empty-icon">👆</span>
                        <p>Select a file to preview</p>
                    </div>
                ) : (
                    <>
                        {/* Preview Area */}
                        <div className="preview-area">
                            {loading ? (
                                <div className="preview-loading">
                                    <div className="spinner"></div>
                                </div>
                            ) : (
                                renderPreview()
                            )}
                        </div>

                        {/* File Info */}
                        <div className="preview-info">
                            <h3 className="preview-filename">{item.name}</h3>
                            <span className="preview-type-badge">{getFileType(item)}</span>

                            <div className="preview-meta">
                                {!item.isDirectory && (
                                    <div className="meta-row">
                                        <span className="meta-label">Size</span>
                                        <span className="meta-value">{formatFileSize(item.size)}</span>
                                    </div>
                                )}
                                <div className="meta-row">
                                    <span className="meta-label">Modified</span>
                                    <span className="meta-value">{formatDate(item.modified)}</span>
                                </div>

                                {/* Image metadata */}
                                {metadata?.type === 'image' && metadata.width && (
                                    <>
                                        <div className="meta-row">
                                            <span className="meta-label">Dimensions</span>
                                            <span className="meta-value">{metadata.width} × {metadata.height}</span>
                                        </div>
                                        {metadata.megapixels && (
                                            <div className="meta-row">
                                                <span className="meta-label">Megapixels</span>
                                                <span className="meta-value">{metadata.megapixels} MP</span>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Video metadata */}
                                {metadata?.type === 'video' && (
                                    <>
                                        {metadata.duration && (
                                            <div className="meta-row">
                                                <span className="meta-label">Duration</span>
                                                <span className="meta-value">{formatDuration(metadata.duration)}</span>
                                            </div>
                                        )}
                                        {metadata.width && (
                                            <div className="meta-row">
                                                <span className="meta-label">Resolution</span>
                                                <span className="meta-value">{metadata.width} × {metadata.height}</span>
                                            </div>
                                        )}
                                        {metadata.codec && (
                                            <div className="meta-row">
                                                <span className="meta-label">Codec</span>
                                                <span className="meta-value">{metadata.codec.toUpperCase()}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <button className="preview-action-btn" onClick={handleOpen}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                Open
                            </button>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}

export default PreviewPanel;
