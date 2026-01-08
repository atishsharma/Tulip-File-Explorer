import { getFolderIcon, getDriveIcon } from '../../utils/fileIcons';
import { formatDriveCapacity, getDriveUsagePercent } from '../../utils/formatters';
import './Sidebar.css';

function Sidebar({ specialFolders, drives, currentPath, onNavigate, onShowContextMenu }) {

    const handleDriveContextMenu = async (e, drive) => {
        e.preventDefault();
        if (onShowContextMenu) {
            const action = await onShowContextMenu('drive', { path: drive.path, name: drive.name });
            if (action === 'open') {
                onNavigate(drive.path);
            }
        }
    };

    return (
        <aside className="sidebar glass-panel">
            {/* Quick Access */}
            <section className="sidebar-section">
                <h3 className="sidebar-heading">Quick Access</h3>
                <nav className="sidebar-nav">
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
                    {drives.map((drive, index) => (
                        <button
                            key={drive.path || index}
                            className={`sidebar-item drive-item ${currentPath === drive.path ? 'active' : ''}`}
                            onClick={() => onNavigate(drive.path)}
                            onContextMenu={(e) => handleDriveContextMenu(e, drive)}
                        >
                            <span className="sidebar-icon">{getDriveIcon(drive)}</span>
                            <div className="drive-info">
                                <span className="sidebar-label">{drive.name}</span>
                                {drive.total && (
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
        </aside>
    );
}

export default Sidebar;
