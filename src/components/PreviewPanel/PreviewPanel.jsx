import { useState, useEffect, useRef } from 'react';
import { getFileIcon, LineIcon } from '../../utils/fileIcons';
import { formatFileSize, formatDate, getFileType } from '../../utils/formatters';
import { fileUrl } from '../../utils/paths';
import './PreviewPanel.css';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg', '.tiff', '.tif'];
const VIDEO_EXTS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];

function PreviewPanel({ item }) {
    // Results are tagged with the item they belong to, so a slow response for a
    // previously selected file can never replace the current preview
    const [loaded, setLoaded] = useState({ key: null, preview: null, metadata: null });
    const [width, setWidth] = useState(300);
    const resizeRef = useRef(null);
    const isDragging = useRef(false);

    const itemKey = item ? `${item.path}|${item.modified}` : null;
    const current = loaded.key === itemKey ? loaded : null;
    const preview = item?.isDirectory ? { success: true, type: 'folder' } : current?.preview ?? null;
    const metadata = current?.metadata ?? null;
    const loading = !!item && !item.isDirectory && !current;

    useEffect(() => {
        if (!item || item.isDirectory || !window.electronAPI) return undefined;
        let cancelled = false;

        (async () => {
            let result;
            let meta = null;
            try {
                result = await window.electronAPI.readFilePreview(item.path);
                const ext = (item.extension || '').toLowerCase();
                if (IMAGE_EXTS.includes(ext)) {
                    const res = await window.electronAPI.getImageMetadata(item.path);
                    if (res.success) meta = { type: 'image', ...res.metadata };
                } else if (VIDEO_EXTS.includes(ext)) {
                    const res = await window.electronAPI.getVideoMetadata(item.path);
                    if (res.success) meta = { type: 'video', ...res.metadata };
                }
            } catch (err) {
                result = { success: false, error: err.message };
            }
            if (!cancelled) setLoaded({ key: itemKey, preview: result, metadata: meta });
        })();

        return () => {
            cancelled = true;
        };
    }, [item, itemKey]);

    // Resize handling
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging.current) {
                const newWidth = window.innerWidth - e.clientX;
                setWidth(Math.max(240, Math.min(520, newWidth)));
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

    const handleShowInFolder = () => {
        if (window.electronAPI && item) {
            window.electronAPI.showInFolder(item.path);
        }
    };

    const renderPreview = () => {
        if (!preview) return null;

        if (!preview.success) {
            return (
                <div className="preview-placeholder">
                    <span className="preview-state-icon"><LineIcon name="alert" size={26} /></span>
                    <p>Unable to preview</p>
                    {preview.error && <p className="preview-hint">{preview.error}</p>}
                </div>
            );
        }

        switch (preview.type) {
            case 'image':
                return <img src={fileUrl(preview.path)} alt={item?.name} className="preview-image" />;
            case 'video':
                return (
                    <video controls className="preview-video" key={preview.path}>
                        <source src={fileUrl(preview.path)} />
                    </video>
                );
            case 'audio':
                return (
                    <div className="preview-placeholder">
                        <span className="preview-state-icon"><LineIcon name="audio" size={26} /></span>
                        <audio controls className="preview-audio" key={preview.path}>
                            <source src={fileUrl(preview.path)} />
                        </audio>
                    </div>
                );
            case 'text':
                return (
                    <pre className="preview-text">
                        {preview.content}
                        {preview.truncated && <span className="truncated-notice">{'\n'}… showing the first 50 KB</span>}
                    </pre>
                );
            case 'folder':
                return <div className="preview-placeholder large-glyph" style={{ '--icon-size': '120px' }}>{getFileIcon(item)}</div>;
            case 'pdf':
                return (
                    <div className="preview-placeholder" style={{ '--icon-size': '96px' }}>
                        {getFileIcon(item)}
                        <p className="preview-hint">Open to view in your PDF reader</p>
                    </div>
                );
            default:
                return (
                    <div className="preview-placeholder" style={{ '--icon-size': '96px' }}>
                        {getFileIcon(item)}
                        <p className="preview-hint">{preview.type === 'binary' ? 'Binary file' : 'No preview available'}</p>
                    </div>
                );
        }
    };

    const metaRows = [];
    if (item) {
        if (!item.isDirectory) metaRows.push(['Size', formatFileSize(item.size)]);
        if (metadata?.width) metaRows.push([metadata.type === 'video' ? 'Resolution' : 'Dimensions', `${metadata.width} × ${metadata.height}`]);
        if (metadata?.type === 'video' && metadata.duration) metaRows.push(['Duration', formatDuration(metadata.duration)]);
        if (metadata?.type === 'video' && metadata.codec) metaRows.push(['Codec', metadata.codec.toUpperCase()]);
        metaRows.push(['Modified', formatDate(item.modified)]);
        if (item.created) metaRows.push(['Created', formatDate(item.created)]);
    }

    return (
        <aside className="preview-panel" style={{ width }} aria-label="Preview">
            <div
                className="resize-handle"
                onMouseDown={handleResizeStart}
                ref={resizeRef}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize preview panel"
            />

            {!item ? (
                <div className="preview-empty">
                    <span className="preview-state-icon"><LineIcon name="panel" size={26} /></span>
                    <p>Select a file to see its preview and details</p>
                </div>
            ) : (
                <div className="preview-content">
                    <div className={`preview-area ${preview?.type === 'text' ? 'is-text' : ''}`}>
                        {loading ? <div className="spinner" /> : renderPreview()}
                    </div>

                    <div className="preview-heading">
                        <h2 className="preview-filename">{item.name}</h2>
                        <span className="chip">{getFileType(item)}</span>
                    </div>

                    <dl className="preview-meta">
                        {metaRows.map(([label, value]) => (
                            <div className="meta-row" key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                            </div>
                        ))}
                    </dl>

                    <div className="preview-actions">
                        <button className="btn btn-primary" onClick={handleOpen}>
                            <LineIcon name="open" size={16} strokeWidth={2} />
                            Open
                        </button>
                        <button className="btn btn-secondary" onClick={handleShowInFolder}>
                            Show in folder
                        </button>
                    </div>
                </div>
            )}
        </aside>
    );
}

export default PreviewPanel;
