import { useState, useEffect, useRef } from 'react';
import { getFolderIcon, getDriveIcon } from '../../utils/fileIcons';
import { getRcloneProviderInfo } from '../../utils/rcloneProviders';
import './ThisPC.css';

// Hook for polling intervals
function useInterval(callback, delay) {
    const savedCallback = useRef();

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (delay !== null) {
            const id = setInterval(() => savedCallback.current(), delay);
            return () => clearInterval(id);
        }
    }, [delay]);
}

function ThisPC({ drives: initialDrives, cloudDrives, onNavigate, viewMode = 'grid', onShowContextMenu, onShowProperties, specialFolders = [] }) {
    // Filter out libraries from drives list to prevent them showing as drives
    const validDrives = (initialDrives || []).filter(item =>
        !['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'Home'].includes(item.name) &&
        !item.isSpecialFolder
    );

    const [drives, setDrives] = useState(validDrives);

    // Update local state when prop changes
    useEffect(() => {
        if (initialDrives) {
            const valid = initialDrives.filter(item =>
                !['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'Home'].includes(item.name) &&
                !item.isSpecialFolder
            );
            setDrives(valid);
        }
    }, [initialDrives]);

    // Polling for drive changes (Auto-refresh)
    useInterval(async () => {
        if (window.electronAPI) {
            try {
                // Fetch latest drives silently
                const latestDrives = await window.electronAPI.getDrives();

                // Deep compare to avoid unnecessary re-renders
                if (JSON.stringify(latestDrives) !== JSON.stringify(drives)) {
                    console.log('Drive change detected, updating...');
                    setDrives(latestDrives);
                }
            } catch (err) {
                console.error('Failed to poll drives:', err);
            }
        }
    }, 3000); // Poll every 3 seconds

    // Use specialFolders from prop if available, otherwise fallback (though FileExplorer should pass it)
    const libraries = specialFolders.length > 0 ? specialFolders : [
        { name: 'Desktop', path: 'desktop', id: 'desktop' },
        { name: 'Documents', path: 'documents', id: 'documents' },
        { name: 'Downloads', path: 'downloads', id: 'downloads' },
        { name: 'Pictures', path: 'pictures', id: 'pictures' },
        { name: 'Music', path: 'music', id: 'music' },
        { name: 'Videos', path: 'videos', id: 'videos' },
    ];

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return 'Unknown';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    const getUsagePercentage = (used, total) => {
        if (!total || total === 0) return 0;
        return Math.min(100, Math.max(0, (used / total) * 100));
    };

    const getProgressBarColor = (percentage) => {
        if (percentage > 90) return 'var(--error, #ef4444)';
        if (percentage > 75) return 'var(--warning, #f59e0b)';
        return 'var(--primary)';
    };

    const handleLibraryClick = (lib) => {
        // If we have a path from specialFolders and it's not just the ID, use it directly
        if (lib.path && lib.path !== lib.id && !['desktop', 'documents', 'downloads', 'pictures', 'music', 'videos'].includes(lib.path)) {
            onNavigate(lib.path);
            return;
        }

        // Fallback for special IDs if path is not resolved or is just a keyword
        if (window.electronAPI) {
            window.electronAPI.getSpecialPath(lib.id || lib.path).then(path => {
                if (path) onNavigate(path);
            });
        } else {
            // Fallback for web dev mode (mock)
            onNavigate(lib.path);
        }
    };

    const [platform, setPlatform] = useState('win32');

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getPlatform().then(setPlatform);
        }
    }, []);

    const getHeaderName = () => {
        if (platform === 'darwin') return 'This Mac System';
        if (platform === 'linux') return 'This Linux System';
        return 'This PC';
    };

    const handleContextMenu = async (e, menuType, item) => {
        e.preventDefault();
        if (!onShowContextMenu) return;

        const action = await onShowContextMenu(menuType, item);

        if (!action) return;

        if (action === 'open' && item) {
            onNavigate(item.path);
        } else if (action === 'properties' && item) {
            onShowProperties?.(item);
        }
    };

    return (
        <div
            className={`this-pc-container fade-in ${viewMode === 'list' ? 'thispc-list-view' : ''}`}
            onContextMenu={(e) => handleContextMenu(e, 'background')}
        >
            <h1 className="thispc-header">{getHeaderName()}</h1>

            {/* Libraries Section */}
            <section className="pc-section">
                <h2 className="pc-section-title">Libraries</h2>
                <div className="libraries-grid">
                    {libraries.map((lib) => (
                        <div
                            key={lib.name}
                            className="library-card glass-card"
                            onClick={() => handleLibraryClick(lib)}
                            onContextMenu={(e) => handleContextMenu(e, 'folder', { ...lib, isDirectory: true })}
                        >
                            <span className="library-icon">{getFolderIcon(lib.id || lib.icon)}</span>
                            <span className="library-name">{lib.name}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* System Drives Section */}
            <section className="pc-section">
                <h2 className="pc-section-title">Devices and Drives</h2>
                <div className="drives-grid">
                    {drives.map((drive) => {
                        const percent = drive.total ? getUsagePercentage(drive.used, drive.total) : 0;
                        const freeSpace = drive.free ? formatBytes(drive.free) : 'Unknown';
                        const totalSpace = drive.total ? formatBytes(drive.total) : '';

                        return (
                            <div
                                key={drive.path}
                                className="drive-card glass-card"
                                onClick={() => onNavigate(drive.path)}
                                onContextMenu={(e) => handleContextMenu(e, 'drive', drive)}
                            >
                                <div className="drive-icon-wrapper">
                                    <span className="drive-icon">{getDriveIcon(drive)}</span>
                                </div>
                                <div className="drive-info-center">
                                    <span className="drive-name">{drive.name || 'Local Disk'}</span>
                                    {drive.path && <span className="drive-label"></span>}
                                </div>
                                <div className="drive-status">
                                    <div className="drive-bar-track">
                                        <div
                                            className="drive-bar-fill"
                                            style={{
                                                width: `${percent}%`,
                                                backgroundColor: getProgressBarColor(percent)
                                            }}
                                        />
                                    </div>
                                    <span className="drive-text">
                                        {drive.total ? `${freeSpace} free of ${totalSpace}` : 'Space unknown'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Cloud Drives Section */}
            {cloudDrives.length > 0 && (
                <section className="pc-section">
                    <h2 className="pc-section-title">Cloud Locations</h2>
                    <div className="drives-grid">
                        {cloudDrives.map((drive) => {
                            const providerInfo = getRcloneProviderInfo(drive.provider || 'default');
                            return (
                                <div
                                    key={drive.name}
                                    className="drive-card glass-card"
                                    onClick={() => onNavigate(drive.path)}
                                    onContextMenu={(e) => handleContextMenu(e, 'cloud-drive', drive)}
                                >
                                    <div className="drive-icon-wrapper">
                                        <span className="drive-icon cloud-icon">
                                            {providerInfo.icon || '☁️'}
                                        </span>
                                    </div>
                                    <div className="drive-info-center">
                                        <span className="drive-name">{drive.name}</span>
                                        <span className="drive-provider">{providerInfo.name}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}

export default ThisPC;
