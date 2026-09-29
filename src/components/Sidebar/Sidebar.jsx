import logo from '../../assets/logo1.png';
import { getFolderIcon, getDriveIcon, LineIcon } from '../../utils/fileIcons';
import { formatDriveCapacity, getDriveUsagePercent } from '../../utils/formatters';
import { getRcloneProviderInfo, capitalizeFirst } from '../../utils/rcloneProviders';
import { usePlatform, computerName } from '../../hooks/usePlatform';
import './Sidebar.css';

const FAVOURITE_IDS = ['home', 'desktop', 'documents', 'downloads'];
const LIBRARY_IDS = ['pictures', 'videos', 'music'];

function Sidebar({ specialFolders, drives, cloudDrives = [], currentPath, onNavigate, onShowContextMenu, onAddCloudDrive }) {
    const platform = usePlatform();

    // Pass full drive info so Properties can show capacity; App handles properties/unmount
    const handleDriveContextMenu = async (e, drive, menuType) => {
        e.preventDefault();
        if (!onShowContextMenu) return;
        const item = { ...drive, isDrive: true, isDirectory: true, size: drive.total, isCloud: menuType === 'cloud-drive' };
        const action = await onShowContextMenu(menuType, item);
        if (action === 'open') onNavigate(drive.path);
    };

    const byId = (ids) => ids.map((id) => specialFolders.find((f) => f.id === id)).filter(Boolean);
    const favourites = byId(FAVOURITE_IDS);
    const libraries = byId(LIBRARY_IDS);
    const localDrives = drives.filter((drive) => !drive.isCloud);
    const computerLabel = computerName(platform);

    const navItem = (key, path, icon, label) => {
        const active = currentPath === path;
        return (
            <button
                key={key}
                className={`sidebar-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(path)}
                title={label}
            >
                <span className="sidebar-icon">{icon}</span>
                <span className="sidebar-label">{label}</span>
            </button>
        );
    };

    const driveItem = (drive, menuType, icon, label, subtitle) => {
        const active = currentPath === drive.path;
        const percent = getDriveUsagePercent(drive);
        return (
            <button
                key={drive.path}
                className={`sidebar-item drive-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(drive.path)}
                onContextMenu={(e) => handleDriveContextMenu(e, drive, menuType)}
                title={drive.path}
            >
                <span className="drive-item-row">
                    <span className="sidebar-icon">{icon}</span>
                    <span className="sidebar-label">{label}</span>
                    {subtitle && <span className="drive-provider">{subtitle}</span>}
                </span>
                {!!drive.total && (
                    <>
                        <span className={`usage-bar ${percent >= 90 ? 'warn' : ''}`}>
                            <span style={{ width: `${percent}%` }} />
                        </span>
                        <span className="drive-text">{formatDriveCapacity(drive)}</span>
                    </>
                )}
            </button>
        );
    };

    return (
        <aside className="sidebar" aria-label="Navigation">
            <div className="sidebar-brand">
                <img src={logo} alt="" className="sidebar-logo" />
                <span className="sidebar-app-name">Tulip</span>
            </div>

            <div className="sidebar-scroll">
                <nav className="sidebar-section" aria-labelledby="sidebar-favourites">
                    <h3 id="sidebar-favourites" className="sidebar-heading">Favourites</h3>
                    {navItem('thispc', 'thispc://', <LineIcon name="computer" />, computerLabel)}
                    {favourites.map((folder) => navItem(folder.id, folder.path, getFolderIcon(folder.id), folder.name))}
                </nav>

                {libraries.length > 0 && (
                    <nav className="sidebar-section" aria-labelledby="sidebar-library">
                        <h3 id="sidebar-library" className="sidebar-heading">Library</h3>
                        {libraries.map((folder) => navItem(folder.id, folder.path, getFolderIcon(folder.id), folder.name))}
                    </nav>
                )}

                {localDrives.length > 0 && (
                    <nav className="sidebar-section" aria-labelledby="sidebar-drives">
                        <h3 id="sidebar-drives" className="sidebar-heading">Drives</h3>
                        {localDrives.map((drive) => driveItem(drive, 'drive', getDriveIcon(drive), drive.name))}
                    </nav>
                )}

                <nav className="sidebar-section" aria-labelledby="sidebar-cloud">
                    <h3 id="sidebar-cloud" className="sidebar-heading">Cloud</h3>
                    {cloudDrives.map((drive) => {
                        const provider = getRcloneProviderInfo(drive.type || 'unknown');
                        const isImage = typeof provider.icon === 'string' && /\.(png|svg|jpe?g|webp)$|^data:/.test(provider.icon);
                        const icon = isImage
                            ? <img src={provider.icon} alt="" className="sidebar-icon-img" />
                            : <LineIcon name="cloud" />;
                        return driveItem({ ...drive, isCloud: true }, 'cloud-drive', icon, capitalizeFirst(drive.name), provider.name);
                    })}
                    <button className="add-cloud-btn" onClick={onAddCloudDrive}>
                        <LineIcon name="plus" size={16} strokeWidth={2} />
                        Add cloud drive
                    </button>
                </nav>
            </div>
        </aside>
    );
}

export default Sidebar;
