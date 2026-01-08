import logo from '../../assets/logo.png';
import './TitleBar.css';

function TitleBar({ showPreview, onTogglePreview, onOpenSettings }) {
    const handleMinimize = () => {
        window.electronAPI?.minimizeWindow();
    };

    const handleMaximize = () => {
        window.electronAPI?.maximizeWindow();
    };

    const handleClose = () => {
        window.electronAPI?.closeWindow();
    };

    return (
        <header className="titlebar">
            <div className="titlebar-drag">
                <div className="titlebar-logo">
                    <img src={logo} alt="Tulip" className="titlebar-icon-img" />
                    <span className="titlebar-title">Tulip File Explorer</span>
                </div>
            </div>

            <div className="titlebar-actions">
                {/* Settings Button */}
                <button
                    className="titlebar-btn settings-btn"
                    onClick={onOpenSettings}
                    title="Settings"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>

                {/* Preview Toggle */}
                <button
                    className={`titlebar-btn preview-toggle ${showPreview ? 'active' : ''}`}
                    onClick={onTogglePreview}
                    title={showPreview ? 'Hide preview panel' : 'Show preview panel'}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                </button>

                <div className="window-controls">
                    <button
                        className="titlebar-btn window-btn minimize"
                        onClick={handleMinimize}
                        title="Minimize"
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <rect y="5" width="12" height="2" fill="currentColor" />
                        </svg>
                    </button>

                    <button
                        className="titlebar-btn window-btn maximize"
                        onClick={handleMaximize}
                        title="Maximize"
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    </button>

                    <button
                        className="titlebar-btn window-btn close"
                        onClick={handleClose}
                        title="Close"
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
}

export default TitleBar;
