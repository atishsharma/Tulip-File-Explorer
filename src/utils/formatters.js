/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes) {
    if (bytes === null || bytes === undefined) return '-';
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const base = 1024;
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));
    const size = bytes / Math.pow(base, unitIndex);

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Format date to locale string
 */
export function formatDate(dateString) {
    if (!dateString) return '-';

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Today
    if (diffDays === 0) {
        return `Today ${date.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    }

    // Yesterday
    if (diffDays === 1) {
        return `Yesterday ${date.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    }

    // Within a week
    if (diffDays < 7) {
        return date.toLocaleDateString(undefined, {
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    // Default: full date
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Format path for display (truncate if too long)
 */
export function formatPath(path, maxLength = 50) {
    if (!path || path.length <= maxLength) return path;

    const separator = path.includes('\\') ? '\\' : '/';
    const parts = path.split(separator);

    if (parts.length <= 3) return path;

    const first = parts[0] || separator;
    const last = parts.slice(-2).join(separator);

    return `${first}${separator}...${separator}${last}`;
}

/**
 * Get file type description
 */
export function getFileType(item) {
    if (item.isDirectory) return 'Folder';

    const extension = item.extension?.toLowerCase();

    const typeMap = {
        '.pdf': 'PDF Document',
        '.doc': 'Word Document',
        '.docx': 'Word Document',
        '.txt': 'Text File',
        '.rtf': 'Rich Text',
        '.xls': 'Excel Spreadsheet',
        '.xlsx': 'Excel Spreadsheet',
        '.csv': 'CSV File',
        '.ppt': 'PowerPoint',
        '.pptx': 'PowerPoint',
        '.jpg': 'JPEG Image',
        '.jpeg': 'JPEG Image',
        '.png': 'PNG Image',
        '.gif': 'GIF Image',
        '.svg': 'SVG Image',
        '.webp': 'WebP Image',
        '.mp4': 'MP4 Video',
        '.avi': 'AVI Video',
        '.mkv': 'MKV Video',
        '.mov': 'QuickTime Video',
        '.mp3': 'MP3 Audio',
        '.wav': 'WAV Audio',
        '.flac': 'FLAC Audio',
        '.zip': 'ZIP Archive',
        '.rar': 'RAR Archive',
        '.7z': '7-Zip Archive',
        '.js': 'JavaScript',
        '.jsx': 'React JSX',
        '.ts': 'TypeScript',
        '.tsx': 'React TSX',
        '.html': 'HTML Document',
        '.css': 'CSS Stylesheet',
        '.json': 'JSON File',
        '.py': 'Python Script',
        '.java': 'Java Source',
        '.md': 'Markdown',
        '.exe': 'Executable',
        '.app': 'Application',
    };

    return typeMap[extension] || (extension ? `${extension.slice(1).toUpperCase()} File` : 'File');
}

/**
 * Format drive capacity
 */
export function formatDriveCapacity(drive) {
    if (!drive.total || !drive.free) return '';

    const used = drive.total - drive.free;
    const usedPercent = Math.round((used / drive.total) * 100);

    return `${formatFileSize(drive.free)} free of ${formatFileSize(drive.total)}`;
}

/**
 * Get drive usage percentage
 */
export function getDriveUsagePercent(drive) {
    if (!drive.total || !drive.free) return 0;
    return Math.round(((drive.total - drive.free) / drive.total) * 100);
}
