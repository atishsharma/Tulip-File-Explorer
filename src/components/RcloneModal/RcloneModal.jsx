import { useState, useEffect } from 'react';
import { getRcloneProviderInfo, capitalizeFirst } from '../../utils/rcloneProviders';
import './RcloneModal.css';

function RcloneModal({ isOpen, onClose, onMount }) {
    const [remotes, setRemotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(null);
    const [mounted, setMounted] = useState(new Set());

    useEffect(() => {
        if (isOpen) {
            loadRemotes();
        }
    }, [isOpen]);

    const loadRemotes = async () => {
        setLoading(true);
        setError(null);
        try {
            const mountedResult = await window.electronAPI.rclone.getMounted();
            const mountedSet = new Set(mountedResult.map(m => m.name));
            setMounted(mountedSet);

            const result = await window.electronAPI.rclone.listRemotes();
            if (result.success) {
                setRemotes(result.remotes);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Failed to contact backend');
        } finally {
            setLoading(false);
        }
    };

    const handleMount = async (remote) => {
        setProcessing(remote.name);
        try {
            const result = await window.electronAPI.rclone.mount(remote.name, remote.type);
            if (result.success) {
                setMounted(prev => new Set(prev).add(remote.name));
                if (onMount) onMount(remote.name, result.path);
            } else {
                console.error(result.error);
            }
        } finally {
            setProcessing(null);
        }
    };

    const handleUnmount = async (remote) => {
        setProcessing(remote.name);
        try {
            const result = await window.electronAPI.rclone.unmount(remote.name);
            if (result.success) {
                setMounted(prev => {
                    const next = new Set(prev);
                    next.delete(remote.name);
                    return next;
                });
            }
        } finally {
            setProcessing(null);
        }
    };

    const handleOpenConfig = async () => {
        if (window.electronAPI.rclone.openConfig) {
            await window.electronAPI.rclone.openConfig();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="rclone-modal-overlay" onClick={onClose}>
            <div className="rclone-modal" onClick={e => e.stopPropagation()}>
                <header className="rclone-header">
                    <h2>Cloud Storage</h2>
                    <button className="rclone-close" onClick={onClose}>✕</button>
                </header>

                <div className="rclone-content">
                    {loading ? (
                        <div className="rclone-loading">Loading remotes...</div>
                    ) : error ? (
                        <div className="rclone-error">
                            <p>Error: {error}</p>
                            <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                                Make sure rclone is installed and configured.
                            </p>
                        </div>
                    ) : remotes.length === 0 ? (
                        <div className="rclone-empty">
                            <div className="rclone-empty-icon">☁️</div>
                            <p className="rclone-empty-title">No cloud drives configured</p>
                            <p className="rclone-empty-message">
                                Use the button below to configure your first cloud storage connection.
                            </p>
                        </div>
                    ) : (
                        <div className="rclone-list">
                            {remotes.map(remote => {
                                const isMounted = mounted.has(remote.name);
                                const isProcessing = processing === remote.name;
                                const providerInfo = getRcloneProviderInfo(remote.type);
                                const isImage = typeof providerInfo.icon === 'string' && providerInfo.icon.startsWith('/');

                                return (
                                    <div key={remote.name} className="rclone-item">
                                        <div className="rclone-item-info">
                                            {isImage || providerInfo.icon.includes('.png') ? (
                                                <img
                                                    src={providerInfo.icon}
                                                    alt={providerInfo.name}
                                                    className="rclone-icon-img"
                                                />
                                            ) : (
                                                <span className="rclone-icon">{providerInfo.icon}</span>
                                            )}
                                            <div className="rclone-item-details">
                                                <span className="rclone-item-name">{capitalizeFirst(remote.name)}</span>
                                                <span className="rclone-item-type">{providerInfo.name}</span>
                                            </div>
                                        </div>
                                        <button
                                            className={`rclone-action-btn ${isMounted ? 'unmount' : 'mount'}`}
                                            disabled={isProcessing}
                                            onClick={() => isMounted ? handleUnmount(remote) : handleMount(remote)}
                                        >
                                            {isProcessing ? '⋯' : isMounted ? 'Unmount' : 'Mount'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <footer className="rclone-footer">
                    <button className="rclone-config-btn" onClick={handleOpenConfig}>
                        <span className="rclone-config-icon">⚙️</span>
                        <span>Open Rclone Config</span>
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default RcloneModal;
