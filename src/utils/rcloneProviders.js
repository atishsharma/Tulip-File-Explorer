import googleDriveIcon from '../assets/rclone-icons/google-drive.png';
import oneDriveIcon from '../assets/rclone-icons/onedrive.png';
import dropboxIcon from '../assets/rclone-icons/dropbox.png';

// Map rclone types to friendly names and icons
export const RCLONE_PROVIDERS = {
    'drive': { name: 'Google Drive', icon: googleDriveIcon },
    'onedrive': { name: 'OneDrive', icon: oneDriveIcon },
    'dropbox': { name: 'Dropbox', icon: dropboxIcon },
    's3': { name: 'Amazon S3', icon: '☁️' },
    'b2': { name: 'Backblaze B2', icon: '💾' },
    'box': { name: 'Box', icon: '📦' },
    'mega': { name: 'MEGA', icon: 'M' },
    'pcloud': { name: 'pCloud', icon: '☁️' },
    'ftp': { name: 'FTP', icon: '📡' },
    'sftp': { name: 'SFTP', icon: '🔐' },
    'webdav': { name: 'WebDAV', icon: '🌐' },
    'azureblob': { name: 'Azure Blob', icon: '☁️' },
    'googlecloudstorage': { name: 'Google Cloud', icon: '☁️' },
    'unknown': { name: 'Cloud Storage', icon: '☁️' }
};

export function getRcloneProviderInfo(type) {
    return RCLONE_PROVIDERS[type] || RCLONE_PROVIDERS['unknown'];
}

export function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
