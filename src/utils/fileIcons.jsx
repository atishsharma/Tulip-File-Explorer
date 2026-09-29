// Tulip icon set: 24px line icons (stroke = currentColor), a two-tone folder glyph
// and document tiles with a colour-coded extension badge.

const LINE_ICONS = {
    computer: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
    home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M3 13h18" /></>,
    documents: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
    downloads: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
    pictures: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
    videos: <><rect x="3" y="5" width="14" height="14" rx="2" /><path d="M17 10l4-2v8l-4-2" /></>,
    music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
    folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    drive: <><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M5 13l2.5-8h9L19 13" /><path d="M7 16.5h.01" /></>,
    usb: <><rect x="7" y="10" width="10" height="11" rx="2" /><path d="M9 10V4h6v6M11 6.5h.01M13 6.5h.01" /></>,
    cloud: <path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    back: <path d="M15 18l-6-6 6-6" />,
    forward: <path d="M9 18l6-6-6-6" />,
    up: <path d="M12 19V5M5 12l7-7 7 7" />,
    refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
    list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    sort: <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />,
    group: <><path d="M4 6h16M4 12h16M4 18h16" /><rect x="4" y="9" width="4" height="6" rx="1" /></>,
    size: <><rect x="3" y="7" width="18" height="10" rx="2" /><circle cx="12" cy="12" r="3" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9M9.9 5.2A9 9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2" /><path d="M2 2l20 20" /></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M15 4v16" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
    minimize: <path d="M5 12h14" />,
    maximize: <rect x="5" y="5" width="14" height="14" rx="3" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    open: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
    rename: <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />,
    check: <path d="M5 12l5 5 9-10" />,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17h.01" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="2" /><path d="M17 10l4-2v8l-4-2" /></>,
    audio: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
    tulip: <><path d="M12 21V11" /><path d="M12 11c-4 0-6-3-6-7 2 0 4 1 6 3 2-2 4-3 6-3 0 4-2 7-6 7z" /></>,
};

export function LineIcon({ name, size = 18, strokeWidth = 1.8, className = '' }) {
    return (
        <svg
            className={`line-icon ${className}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {LINE_ICONS[name] || LINE_ICONS.documents}
        </svg>
    );
}

// Two-tone folder; colours come from --folder-back / --folder-front so themes and accents restyle it
export function FolderGlyph({ className = '' }) {
    return (
        <svg className={`folder-glyph ${className}`} viewBox="0 0 88 72" aria-hidden="true" focusable="false">
            <path d="M6 12a8 8 0 0 1 8-8h18l7 7h35a8 8 0 0 1 8 8v37a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z" fill="var(--folder-back)" />
            <path d="M4 26a8 8 0 0 1 8-8h64a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H12a8 8 0 0 1-8-8z" fill="var(--folder-front)" />
            <path d="M12 22h64" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

const KIND_BY_EXT = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tif', '.tiff', '.heic', '.avif'],
    video: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv', '.m4v'],
    audio: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.opus'],
    pdf: ['.pdf'],
    doc: ['.doc', '.docx', '.odt', '.rtf', '.pages', '.txt', '.md'],
    sheet: ['.xls', '.xlsx', '.ods', '.csv', '.numbers'],
    slides: ['.ppt', '.pptx', '.odp', '.key'],
    archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.dmg', '.iso', '.deb', '.rpm', '.appimage'],
    code: ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.sh', '.bash', '.sql', '.yml', '.yaml', '.toml', '.xml', '.ini', '.cfg', '.conf', '.env', '.log'],
    app: ['.exe', '.msi', '.app', '.bat', '.cmd'],
};

/**
 * Broad file kind used for badge colour and grouping.
 */
export function getFileKind(item) {
    if (!item || item.isDirectory) return 'folder';
    const ext = (item.extension || '').toLowerCase();
    for (const [kind, exts] of Object.entries(KIND_BY_EXT)) {
        if (exts.includes(ext)) return kind;
    }
    return 'other';
}

// Document tile with an extension badge; badge colour comes from CSS via data-kind
export function FileGlyph({ item, className = '' }) {
    const kind = getFileKind(item);
    const ext = (item.extension || '').replace('.', '').slice(0, 4).toUpperCase();
    return (
        <span className={`file-glyph ${className}`} data-kind={kind} aria-hidden="true">
            <span className="file-glyph-fold" />
            <span className="file-glyph-badge">{ext || 'FILE'}</span>
        </span>
    );
}

export function getFileIcon(item) {
    return item?.isDirectory ? <FolderGlyph /> : <FileGlyph item={item || {}} />;
}

const FOLDER_ICON_NAMES = ['home', 'desktop', 'documents', 'downloads', 'pictures', 'videos', 'music', 'computer'];

export function getFolderIcon(folderId) {
    return <LineIcon name={FOLDER_ICON_NAMES.includes(folderId) ? folderId : 'folder'} />;
}

export function getDriveIcon(drive) {
    if (drive?.isCloud) return <LineIcon name="cloud" />;
    const p = (drive?.path || '').toLowerCase();
    if (p.startsWith('/media') || p.startsWith('/run/media') || p.startsWith('/volumes/')) return <LineIcon name="usb" />;
    return <LineIcon name="drive" />;
}
