/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes) {
    if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) return '-';
    const value = Number(bytes);
    if (value === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    const base = 1024;
    const abs = Math.abs(value);
    const unitIndex = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(abs) / Math.log(base))));
    const size = value / Math.pow(base, unitIndex);

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Whole calendar days between date and now (0 = today, 1 = yesterday, negative = future).
 */
export function calendarDaysAgo(date, now = new Date()) {
    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((startOf(now) - startOf(date)) / (1000 * 60 * 60 * 24));
}

/**
 * Format date to locale string
 */
export function formatDate(dateString, now = new Date()) {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    const days = calendarDaysAgo(date, now);
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    if (days === 0) return `Today ${time}`;
    if (days === 1) return `Yesterday ${time}`;
    if (days > 1 && days < 7) {
        return date.toLocaleDateString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    }

    // Older or future dates: full date
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
    if (!drive.total || drive.free == null) return '';
    return `${formatFileSize(drive.free)} free of ${formatFileSize(drive.total)}`;
}

/**
 * Get drive usage percentage
 */
export function getDriveUsagePercent(drive) {
    if (!drive.total || drive.free == null) return 0;
    return Math.min(100, Math.max(0, Math.round(((drive.total - drive.free) / drive.total) * 100)));
}
