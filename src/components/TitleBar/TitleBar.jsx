import { LineIcon } from '../../utils/fileIcons';
import './TitleBar.css';

// Right-hand cluster of the window header: preview toggle, settings and window controls
function TitleBar({ showPreview, onTogglePreview, onOpenSettings }) {
    return (
        <div className="titlebar-actions">
            <button
                className={`icon-btn ${showPreview ? 'active' : ''}`}
                onClick={onTogglePreview}
                title={showPreview ? 'Hide preview panel' : 'Show preview panel'}
                aria-label={showPreview ? 'Hide preview panel' : 'Show preview panel'}
                aria-pressed={showPreview}
            >
                <LineIcon name="panel" />
            </button>
            <span className="titlebar-divider" aria-hidden="true" />
            <button className="icon-btn" onClick={onOpenSettings} title="Settings" aria-label="Settings">
                <LineIcon name="settings" />
            </button>
            <div className="window-controls">
                <button className="window-btn" onClick={() => window.electronAPI?.minimizeWindow()} title="Minimize" aria-label="Minimize">
                    <LineIcon name="minimize" size={14} strokeWidth={2} />
                </button>
                <button className="window-btn" onClick={() => window.electronAPI?.maximizeWindow()} title="Maximize" aria-label="Maximize">
                    <LineIcon name="maximize" size={13} strokeWidth={2} />
                </button>
                <button className="window-btn close" onClick={() => window.electronAPI?.closeWindow()} title="Close" aria-label="Close">
                    <LineIcon name="close" size={14} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

export default TitleBar;
