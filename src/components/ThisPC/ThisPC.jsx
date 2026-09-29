import { getFolderIcon, getDriveIcon, LineIcon } from '../../utils/fileIcons';
import { getRcloneProviderInfo } from '../../utils/rcloneProviders';
import { formatFileSize, getDriveUsagePercent } from '../../utils/formatters';
import { usePlatform, computerName } from '../../hooks/usePlatform';
import './ThisPC.css';

// Drive list updates are pushed from the main process via useFileSystem; no polling here.
function ThisPC({ items = [], cloudDrives = [], onNavigate, viewMode = 'grid', onShowContextMenu, onShowProperties, onRefresh, onAddCloudDrive, specialFolders = [] }) {
    const libraryItems = items.filter((item) => item.isSpecialFolder);
    const libraries = libraryItems.length > 0 ? libraryItems : specialFolders.map((f) => ({ ...f, isDirectory: true, isSpecialFolder: true }));
    // Cloud mounts that appear as drive letters are listed once, under Cloud Locations
    const drives = items.filter((item) => item.isDrive && !item.isCloud);

    const platform = usePlatform();
    const getHeaderName = () => computerName(platform);

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
        if (!drive.total) return <span className="drive-text">Space unknown</span>;
        const percent = getDriveUsagePercent(drive);
        return (
            <>
                <span
                    className={`usage-bar ${percent >= 90 ? 'warn' : ''}`}
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${drive.name} usage`}
                >
                    <span style={{ width: `${percent}%` }} />
                </span>
                <span className="drive-text">
                    {percent >= 90 ? 'Almost full · ' : ''}
                    {drive.free != null ? `${formatFileSize(drive.free)} free of ${formatFileSize(drive.total)}` : formatFileSize(drive.total)}
                </span>
            </>
        );
    };

    return (
        <div
            className={`this-pc fade-in ${viewMode === 'list' ? 'is-list' : ''}`}
            onContextMenu={(e) => handleContextMenu(e, 'background', null)}
        >
            <div className="thispc-heading">
                <h1>{getHeaderName()}</h1>
                <p>
                    {drives.length} drive{drives.length !== 1 ? 's' : ''}
                    {cloudDrives.length > 0 ? ` · ${cloudDrives.length} cloud location${cloudDrives.length !== 1 ? 's' : ''}` : ''}
                </p>
            </div>

            <section className="pc-section" aria-labelledby="pc-libraries">
                <h2 id="pc-libraries" className="eyebrow">Libraries</h2>
                <div className="libraries-grid">
                    {libraries.map((lib) => (
                        <button
                            type="button"
                            key={lib.path}
                            className="library-card pc-card"
                            onClick={() => onNavigate(lib.path)}
                            onContextMenu={(e) => handleContextMenu(e, 'library', lib)}
                        >
                            <span className="library-chip" data-lib={lib.id || lib.icon}>{getFolderIcon(lib.id || lib.icon)}</span>
                            <span className="library-name">{lib.name}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="pc-section" aria-labelledby="pc-drives">
                <h2 id="pc-drives" className="eyebrow">Devices and drives</h2>
                <div className="drives-grid">
                    {drives.map((drive) => {
                        const percent = getDriveUsagePercent(drive);
                        return (
                            <button
                                type="button"
                                key={drive.path}
                                className="drive-card pc-card"
                                onClick={() => onNavigate(drive.path)}
                                onContextMenu={(e) => handleContextMenu(e, 'drive', drive)}
                            >
                                <span className="drive-card-row">
                                    <span className="drive-card-icon">{getDriveIcon(drive)}</span>
                                    <span className="drive-card-title">
                                        <span className="drive-name">{drive.name || 'Local Disk'}</span>
                                        <span className="drive-path">{drive.path}</span>
                                    </span>
                                    {!!drive.total && (
                                        <span className={`drive-percent ${percent >= 90 ? 'warn' : ''}`}>{percent}%</span>
                                    )}
                                </span>
                                {renderUsage(drive)}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="pc-section" aria-labelledby="pc-cloud">
                <h2 id="pc-cloud" className="eyebrow">Cloud locations</h2>
                <div className="drives-grid">
                    {cloudDrives.map((drive) => {
                        const providerInfo = getRcloneProviderInfo(drive.type || 'unknown');
                        const isImage = typeof providerInfo.icon === 'string' && /\.(png|svg|jpe?g|webp)$|^data:/.test(providerInfo.icon);
                        const item = { ...drive, isDrive: true, isCloud: true, isDirectory: true, size: drive.total };
                        return (
                            <button
                                type="button"
                                key={drive.name}
                                className="drive-card pc-card"
                                onClick={() => onNavigate(drive.path)}
                                onContextMenu={(e) => handleContextMenu(e, 'cloud-drive', item)}
                            >
                                <span className="drive-card-row">
                                    <span className="drive-card-icon cloud">
                                        {isImage ? <img src={providerInfo.icon} alt="" /> : <LineIcon name="cloud" size={22} />}
                                    </span>
                                    <span className="drive-card-title">
                                        <span className="drive-name">{drive.name}</span>
                                        <span className="drive-path">{providerInfo.name}</span>
                                    </span>
                                    <span className="chip chip-success">Mounted</span>
                                </span>
                                {!!drive.total && renderUsage(drive)}
                            </button>
                        );
                    })}
                    <button type="button" className="pc-card add-card" onClick={onAddCloudDrive}>
                        <LineIcon name="plus" size={18} strokeWidth={2} />
                        Connect a cloud drive
                    </button>
                </div>
            </section>
        </div>
    );
}

export default ThisPC;
