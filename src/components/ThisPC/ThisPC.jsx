import { useState, useEffect } from 'react';
import { getFolderIcon, getDriveIcon } from '../../utils/fileIcons';
import { getRcloneProviderInfo } from '../../utils/rcloneProviders';
import { formatFileSize, getDriveUsagePercent } from '../../utils/formatters';
import './ThisPC.css';

// Drive list updates are pushed from the main process via useFileSystem; no polling here.
function ThisPC({ items = [], cloudDrives = [], onNavigate, viewMode = 'grid', onShowContextMenu, onShowProperties, onRefresh, specialFolders = [] }) {
    const libraryItems = items.filter((item) => item.isSpecialFolder);
    const libraries = libraryItems.length > 0 ? libraryItems : specialFolders.map((f) => ({ ...f, isDirectory: true, isSpecialFolder: true }));
    // Cloud mounts that appear as drive letters are listed once, under Cloud Locations
    const drives = items.filter((item) => item.isDrive && !item.isCloud);

    const [platform, setPlatform] = useState(null);
    useEffect(() => {
        window.electronAPI?.getPlatform().then(setPlatform);
    }, []);

    const getHeaderName = () => {
        if (platform === 'darwin') return 'This Mac';
        if (platform === 'linux') return 'This Computer';
        return 'This PC';
    };

    const getProgressBarColor = (percentage) => {
        if (percentage > 90) return 'var(--error)';
        if (percentage > 75) return 'var(--warning)';
        return 'var(--primary)';
    };

    const handleContextMenu = async (e, menuType, item) => {
        e.preventDefault();
        e.stopPropagation();
        if (!onShowContextMenu) return;

        // App-level handler already deals with properties and unmount
        const action = await onShowContextMenu(menuType, item);
        if (action === 'open' && item) onNavigate(item.path);
        else if (action === 'properties' && item) onShowProperties?.(item);
        else if (action === 'refresh') onRefresh?.();
    };

    const renderUsage = (drive) => {
        const percent = getDriveUsagePercent(drive);
        return (
            <div className="drive-status">
                <div
                    className="drive-bar-track"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${drive.name} usage`}
                >
                    <div
                        className="drive-bar-fill"
                        style={{ width: `${percent}%`, backgroundColor: getProgressBarColor(percent) }}
                    />
                </div>
                <span className="drive-text">
                    {drive.total && drive.free != null
                        ? `${formatFileSize(drive.free)} free of ${formatFileSize(drive.total)}`
                        : 'Space unknown'}
                </span>
            </div>
        );
    };

    return (
        <div
            className={`this-pc-container fade-in ${viewMode === 'list' ? 'thispc-list-view' : ''}`}
            onContextMenu={(e) => handleContextMenu(e, 'background', null)}
        >
            <h1 className="thispc-header">{getHeaderName()}</h1>

            {/* Libraries Section */}
            <section className="pc-section">
                <h2 className="pc-section-title">Libraries</h2>
                <div className="libraries-grid">
                    {libraries.map((lib) => (
                        <button
                            type="button"
                            key={lib.path}
                            className="library-card glass-card"
                            onClick={() => onNavigate(lib.path)}
                            onContextMenu={(e) => handleContextMenu(e, 'library', lib)}
                        >
                            <span className="library-icon">{getFolderIcon(lib.id || lib.icon)}</span>
                            <span className="library-name">{lib.name}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* System Drives Section */}
            <section className="pc-section">
                <h2 className="pc-section-title">Devices and Drives</h2>
                <div className="drives-grid">
                    {drives.map((drive) => (
                        <button
                            type="button"
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
                            </div>
                            {renderUsage(drive)}
                        </button>
                    ))}
                </div>
            </section>

            {/* Cloud Drives Section */}
            {cloudDrives.length > 0 && (
                <section className="pc-section">
                    <h2 className="pc-section-title">Cloud Locations</h2>
                    <div className="drives-grid">
                        {cloudDrives.map((drive) => {
                            const providerInfo = getRcloneProviderInfo(drive.type || 'unknown');
                            const isImage = typeof providerInfo.icon === 'string' && providerInfo.icon.includes('.png');
                            const item = { ...drive, isDrive: true, isCloud: true, isDirectory: true, size: drive.total };
                            return (
                                <button
                                    type="button"
                                    key={drive.name}
                                    className="drive-card glass-card"
                                    onClick={() => onNavigate(drive.path)}
                                    onContextMenu={(e) => handleContextMenu(e, 'cloud-drive', item)}
                                >
                                    <div className="drive-icon-wrapper">
                                        {isImage ? (
                                            <img src={providerInfo.icon} alt="" className="sidebar-icon-img" />
                                        ) : (
                                            <span className="drive-icon cloud-icon">{providerInfo.icon}</span>
                                        )}
                                    </div>
                                    <div className="drive-info-center">
                                        <span className="drive-name">{drive.name}</span>
                                        <span className="drive-provider">{providerInfo.name}</span>
                                    </div>
                                    {drive.total ? renderUsage(drive) : null}
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}

export default ThisPC;
