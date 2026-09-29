import { useState, useEffect, useCallback } from 'react';
import { useModal } from '../../hooks/useModal';
import { LineIcon } from '../../utils/fileIcons';
import { getRcloneProviderInfo, capitalizeFirst } from '../../utils/rcloneProviders';
import './RcloneModal.css';

function RcloneModal({ isOpen, onClose, onMounted, notify }) {
    const [remotes, setRemotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notInstalled, setNotInstalled] = useState(false);
    const [processing, setProcessing] = useState(null);
    const [mounted, setMounted] = useState(new Set());
    const dialogRef = useModal(isOpen, onClose);

    const loadRemotes = useCallback(async () => {
        if (!window.electronAPI) return;
        setLoading(true);
        setError(null);
        setNotInstalled(false);
        try {
            const [mountedResult, result] = await Promise.all([
                window.electronAPI.rclone.getMounted(),
                window.electronAPI.rclone.listRemotes(),
            ]);
            setMounted(new Set((mountedResult || []).map((m) => m.name)));
            if (result.success) {
                setRemotes(result.remotes);
            } else {
                setError(result.error);
                setNotInstalled(!!result.notInstalled);
            }
        } catch {
            setError('Failed to contact backend');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            loadRemotes();
        }
    }, [isOpen, loadRemotes]);

    const handleMount = async (remote) => {
        setProcessing(remote.name);
        try {
            const result = await window.electronAPI.rclone.mount(remote.name, remote.type);
            if (result.success) {
                setMounted((prev) => new Set(prev).add(remote.name));
                notify?.(`Mounted ${remote.name}`, 'success');
                onMounted?.(remote.name, result.path);
            } else {
                notify?.(result.error || `Failed to mount ${remote.name}`, 'error');
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
                setMounted((prev) => {
                    const next = new Set(prev);
                    next.delete(remote.name);
                    return next;
                });
                onMounted?.();
            } else {
                notify?.(result.error || `Failed to unmount ${remote.name}`, 'error');
            }
        } finally {
            setProcessing(null);
        }
    };

    const handleOpenConfig = async () => {
        const result = await window.electronAPI?.rclone.openConfig();
        if (result && !result.success) notify?.(result.error, 'error');
    };

    if (!isOpen) return null;

    return (
        <div className="overlay" onClick={onClose}>
            <div
                ref={dialogRef}
                className="rclone-modal dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rclone-title"
                onClick={e => e.stopPropagation()}
            >
                <header className="dialog-header">
                    <h2 id="rclone-title" className="dialog-title">Cloud drives</h2>
                    <button className="dialog-close" onClick={onClose} aria-label="Close">
                        <LineIcon name="close" size={14} strokeWidth={2.2} />
                    </button>
                </header>

                <div className="rclone-content">
                    {loading ? (
                        <div className="rclone-loading">Loading remotes...</div>
                    ) : error ? (
                        <div className="rclone-error">
                            <p>{notInstalled ? 'rclone is not installed' : `Error: ${error}`}</p>
                            <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                                {notInstalled ? (
                                    <>
                                        Cloud drives need rclone.{' '}
                                        <button
                                            className="rclone-link"
                                            onClick={() => window.electronAPI?.openExternal('https://rclone.org/install/')}
                                        >
                                            Install rclone
                                        </button>
                                        , then reopen this dialog.
                                    </>
                                ) : 'Make sure rclone is installed and configured.'}
                            </p>
                        </div>
                    ) : remotes.length === 0 ? (
                        <div className="rclone-empty">
                            <div className="rclone-empty-icon"><LineIcon name="cloud" size={28} /></div>
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
                                const isImage = typeof providerInfo.icon === 'string' && (providerInfo.icon.startsWith('/') || providerInfo.icon.includes('.png') || providerInfo.icon.startsWith('data:'));

                                return (
                                    <div key={remote.name} className="rclone-item">
                                        <div className="rclone-item-info">
                                            {isImage ? (
                                                <img
                                                    src={providerInfo.icon}
                                                    alt={providerInfo.name}
                                                    className="rclone-icon-img"
                                                />
                                            ) : (
                                                <span className="rclone-icon"><LineIcon name="cloud" size={20} /></span>
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
                                            {isProcessing ? 'Working…' : isMounted ? 'Unmount' : 'Mount'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <footer className="rclone-footer">
                    <button className="rclone-config-btn" onClick={handleOpenConfig} disabled={notInstalled}>
                        <LineIcon name="settings" size={16} />
                        <span>Open Rclone Config</span>
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default RcloneModal;
