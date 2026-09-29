import { useState, useEffect } from 'react';
import { getFolderIcon, getDriveIcon } from '../../utils/fileIcons';
import { formatDriveCapacity, getDriveUsagePercent } from '../../utils/formatters';
import { getRcloneProviderInfo, capitalizeFirst } from '../../utils/rcloneProviders';
import './Sidebar.css';

function Sidebar({ specialFolders, drives, cloudDrives = [], currentPath, onNavigate, onShowContextMenu, onAddCloudDrive }) {
    const [platform, setPlatform] = useState(null);

    useEffect(() => {
        async function getPlatform() {
            if (window.electronAPI) {
                const plat = await window.electronAPI.getPlatform();
                setPlatform(plat);
            }
        }
        getPlatform();
    }, []);
    // Pass full drive info so Properties can show capacity; App handles properties/unmount
    const handleDriveContextMenu = async (e, drive, menuType) => {
        e.preventDefault();
        if (!onShowContextMenu) return;
        const item = { ...drive, isDrive: true, isDirectory: true, size: drive.total, isCloud: menuType === 'cloud-drive' };
        const action = await onShowContextMenu(menuType, item);
        if (action === 'open') onNavigate(drive.path);
    };

    return (
        <aside className="sidebar glass-panel" aria-label="Navigation">
            {/* Quick Access */}
            <section className="sidebar-section">
                <h3 className="sidebar-heading">Quick Access</h3>
                <nav className="sidebar-nav">
                    {/* This PC / This Mac / Computer - All platforms */}
                    {platform && (
                        <button
                            className={`sidebar-item ${currentPath === 'thispc://' ? 'active' : ''}`}
                            onClick={() => onNavigate('thispc://')}
                        >
                            <span className="sidebar-icon">💻</span>
                            <span className="sidebar-label">
                                {platform === 'win32' ? 'This PC' : platform === 'darwin' ? 'This Mac' : 'Computer'}
                            </span>
                        </button>
                    )}
                    {specialFolders.slice(0, 2).map((folder) => (
                        <button
                            key={folder.id}
                            className={`sidebar-item ${currentPath === folder.path ? 'active' : ''}`}
                            onClick={() => onNavigate(folder.path)}
                        >
                            <span className="sidebar-icon">{getFolderIcon(folder.id)}</span>
                            <span className="sidebar-label">{folder.name}</span>
                        </button>
                    ))}
                </nav>
            </section>

            {/* Libraries */}
            <section className="sidebar-section">
                <h3 className="sidebar-heading">Libraries</h3>
                <nav className="sidebar-nav">
                    {specialFolders.slice(2).map((folder) => (
                        <button
                            key={folder.id}
                            className={`sidebar-item ${currentPath === folder.path ? 'active' : ''}`}
                            onClick={() => onNavigate(folder.path)}
                        >
                            <span className="sidebar-icon">{getFolderIcon(folder.id)}</span>
                            <span className="sidebar-label">{folder.name}</span>
                        </button>
                    ))}
                </nav>
            </section>

            {/* Drives */}
            <section className="sidebar-section">
                <h3 className="sidebar-heading">Drives</h3>
                <nav className="sidebar-nav">
                    {drives.filter((drive) => !drive.isCloud).map((drive, index) => (
                        <button
                            key={drive.path || index}
                            className={`sidebar-item drive-item ${currentPath === drive.path ? 'active' : ''}`}
                            onClick={() => onNavigate(drive.path)}
                            onContextMenu={(e) => handleDriveContextMenu(e, drive, 'drive')}
                        >
                            <span className="sidebar-icon">{getDriveIcon(drive)}</span>
                            <div className="drive-info">
                                <span className="sidebar-label">{drive.name}</span>
                                {!!drive.total && (
                                    <div className="drive-capacity">
                                        <div className="drive-bar">
                                            <div
                                                className="drive-bar-fill"
                                                style={{ width: `${getDriveUsagePercent(drive)}%` }}
                                            />
                                        </div>
                                        <span className="drive-text">{formatDriveCapacity(drive)}</span>
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </nav>
            </section>

            {/* Cloud Drives Action */}
            <section className="sidebar-section">
                <button
                    className="add-cloud-btn"
                    onClick={onAddCloudDrive}
                    title="Connect Cloud Drive"
                >
                    <span className="add-cloud-icon">+</span>
                    <span className="add-cloud-text">Add Cloud Drive</span>
                </button>

                {cloudDrives.length > 0 && (
                    <nav className="sidebar-nav" style={{ marginTop: '8px' }}>
                        {cloudDrives.map((drive, index) => {
                            const providerInfo = getRcloneProviderInfo(drive.type || 'unknown');
                            const isImage = typeof providerInfo.icon === 'string' && providerInfo.icon.includes('.png');

                            return (
                                <button
                                    key={drive.path || index}
                                    className={`sidebar-item drive-item ${currentPath === drive.path ? 'active' : ''}`}
                                    onClick={() => onNavigate(drive.path)}
                                    onContextMenu={(e) => handleDriveContextMenu(e, drive, 'cloud-drive')}
                                >
                                    {isImage ? (
                                        <img
                                            src={providerInfo.icon}
                                            alt={providerInfo.name}
                                            className="sidebar-icon-img"
                                        />
                                    ) : (
                                        <span className="sidebar-icon">{providerInfo.icon}</span>
                                    )}
                                    <div className="drive-info">
                                        <div className="cloud-drive-name-section">
                                            <span className="sidebar-label">{capitalizeFirst(drive.name)}</span>
                                            <span className="cloud-drive-provider">({providerInfo.name})</span>
                                        </div>
                                        {!!drive.total && (
                                            <div className="drive-capacity">
                                                <div className="drive-bar">
                                                    <div
                                                        className="drive-bar-fill"
                                                        style={{ width: `${getDriveUsagePercent(drive)}%` }}
                                                    />
                                                </div>
                                                <span className="drive-text">{formatDriveCapacity(drive)}</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </nav>
                )}
            </section>
        </aside>
    );
}

export default Sidebar;
