import React from 'react';

// Modern SVG Icon Component
const Icon = ({ path, className = "" }) => (
    <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="currentColor"
        className={className}
    >
        <path d={path} />
    </svg>
);

// Material Symbols Rounded Icons
const ICONS = {
    folder: "M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
    folderOpen: "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",

    // Quick Access
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    desktop: "M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z",
    computer: "M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z",


    // Libraries
    documents: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
    downloads: "M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z",
    pictures: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
    videos: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z",
    music: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",

    // Drives
    drive: "M6 15c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-3h-2v2l-3-2-3 2v-2H8v3zm12-9H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 8H6V8h12v6z", // Generic drive like
    driveRoot: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-11c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
    driveUSB: "M15 7v4h1v2h-3V5h6v2h-4zm4 2v2h2v-2h-2zm-8 4h2v2h-2v-2zm-4-4v8h2v-8H7zm8 10v2h-2v-2h2zm-4 0v2h-2v-2h2z" // Rough
};

// File extension to icon mapping
// Keep emojis for file types to allow easy extension, OR update valid ones.
// User only asked for Library Sidebar icons to be Modern, files can remain emojis or be improved later.
const iconMap = {
    // Folders
    folder: <Icon path={ICONS.folder} />,
    folderOpen: <Icon path={ICONS.folderOpen} />,

    // Default file (keeping emojis for now as requested task was sidebar, but could update later)
    // Actually mixed style is bad. I should stick to emojis for files for now as I don't have paths for all types.
    // Or I can return a generic Document icon for all files if I want consistency?
    // User: "style icon for library sidebar these look old school"
    // So mostly concerned about Sidebar.

    // Documents
    '.pdf': '📄',
    '.doc': '📝',
    '.docx': '📝',
    '.txt': '📄',
    '.rtf': '📄',
    '.odt': '📝',
    '.xls': '📊',
    '.xlsx': '📊',
    '.csv': '📊',
    '.ppt': '📽️',
    '.pptx': '📽️',

    // Images
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.png': '🖼️',
    '.gif': '🖼️',
    '.bmp': '🖼️',
    '.svg': '🖼️',
    '.webp': '🖼️',
    '.ico': '🖼️',
    '.tiff': '🖼️',
    '.raw': '🖼️',

    // Videos
    '.mp4': '🎬',
    '.avi': '🎬',
    '.mkv': '🎬',
    '.mov': '🎬',
    '.wmv': '🎬',
    '.flv': '🎬',
    '.webm': '🎬',

    // Audio
    '.mp3': '🎵',
    '.wav': '🎵',
    '.ogg': '🎵',
    '.flac': '🎵',
    '.aac': '🎵',
    '.wma': '🎵',
    '.m4a': '🎵',

    // Archives
    '.zip': '🗜️',
    '.rar': '🗜️',
    '.7z': '🗜️',
    '.tar': '🗜️',
    '.gz': '🗜️',
    '.bz2': '🗜️',

    // Code
    '.js': '📜',
    '.jsx': '⚛️',
    '.ts': '📜',
    '.tsx': '⚛️',
    '.html': '🌐',
    '.css': '🎨',
    '.scss': '🎨',
    '.sass': '🎨',
    '.less': '🎨',
    '.json': '📋',
    '.xml': '📋',
    '.yaml': '📋',
    '.yml': '📋',
    '.py': '🐍',
    '.java': '☕',
    '.c': '📜',
    '.cpp': '📜',
    '.h': '📜',
    '.cs': '📜',
    '.go': '📜',
    '.rs': '🦀',
    '.rb': '💎',
    '.php': '🐘',
    '.swift': '🐦',
    '.kt': '📜',
    '.sql': '🗃️',
    '.sh': '📜',
    '.bash': '📜',
    '.ps1': '📜',
    '.bat': '📜',
    '.cmd': '📜',

    // Executables
    '.exe': '⚙️',
    '.msi': '⚙️',
    '.dmg': '⚙️',
    '.app': '⚙️',
    '.deb': '⚙️',
    '.rpm': '⚙️',
    '.appimage': '⚙️',

    // Config
    '.env': '⚙️',
    '.ini': '⚙️',
    '.cfg': '⚙️',
    '.conf': '⚙️',
    '.config': '⚙️',

    // Other
    '.md': '📖',
    '.markdown': '📖',
    '.log': '📋',
    '.lock': '🔒',

    // Default
    default: '📄',
};

// Special folder icons
export const folderIcons = {
    home: <Icon path={ICONS.home} />,
    desktop: <Icon path={ICONS.desktop} />,
    documents: <Icon path={ICONS.documents} />,
    downloads: <Icon path={ICONS.downloads} />,
    pictures: <Icon path={ICONS.pictures} />,
    videos: <Icon path={ICONS.videos} />,
    music: <Icon path={ICONS.music} />,
    computer: <Icon path={ICONS.computer} />,
};

// Drive icons
export const driveIcons = {
    default: <Icon path="M6 2h12v20H6V2zm2 2v16h8V4H8zm2 2h4v2h-4V6z" />, // Simple HDD
    root: <Icon path={ICONS.driveRoot} />,
    removable: <Icon path="M17 6c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1V7c0-.55.45-1 1-1h10zm0-2H7C5.9 4 5 4.9 5 6v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM8 8h1v8H8V8zm2 0h1v8h-1V8z" />, // USB
};

export function getFileIcon(item) {
    if (item.isDirectory) {
        return iconMap.folder;
    }

    const ext = item.extension?.toLowerCase();
    return iconMap[ext] || iconMap.default;
}

export function getFolderIcon(folderId) {
    return folderIcons[folderId] || iconMap.folder;
}

export function getDriveIcon(drive) {
    if (drive.path === '/' || drive.name === 'Root') {
        return driveIcons.root;
    }
    // Simple logic for removable
    return driveIcons.default;
}
