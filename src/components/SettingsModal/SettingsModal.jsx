import logo from '../../assets/logo1.png';
import { useModal } from '../../hooks/useModal';
import { LineIcon } from '../../utils/fileIcons';
import './SettingsModal.css';

const COLOR_PRESETS = [
    { id: 'rose', name: 'Tulip Rose', preview: '#C93A64' },
    { id: 'blue', name: 'Ocean Blue', preview: '#2F6FC4' },
    { id: 'purple', name: 'Royal Purple', preview: '#7A4BD6' },
    { id: 'red', name: 'Crimson', preview: '#C22E2E' },
    { id: 'orange', name: 'Sunset', preview: '#B85418' },
    { id: 'green', name: 'Forest', preview: '#2A7D4D' },
    { id: 'teal', name: 'Teal', preview: '#1F7F80' },
    { id: 'graphite', name: 'Graphite', preview: '#4A4F5C' },
];

const THEMES = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'auto', label: 'Match system' },
];

function ThemePreview({ id }) {
    if (id === 'auto') {
        return (
            <span className="theme-preview split" aria-hidden="true">
                <span className="theme-half light" />
                <span className="theme-half dark" />
            </span>
        );
    }
    return (
        <span className={`theme-preview ${id}`} aria-hidden="true">
            <span className="theme-preview-sidebar" />
            <span className="theme-preview-body">
                <span className="theme-preview-line" />
                <span className="theme-preview-line accent" />
            </span>
        </span>
    );
}

function SettingsModal({
    isOpen,
    onClose,
    currentColor,
    onColorChange,
    theme,
    onThemeChange,
    glass = true,
    onGlassChange,
    showPreview = false,
    onShowPreviewChange,
    version,
}) {
    const dialogRef = useModal(isOpen, onClose);
    if (!isOpen) return null;

    const currentName = COLOR_PRESETS.find((c) => c.id === currentColor)?.name;

    return (
        <div className="overlay" onClick={onClose}>
            <div
                ref={dialogRef}
                className="settings-modal dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="dialog-header">
                    <h2 id="settings-title" className="dialog-title">Settings</h2>
                    <button className="dialog-close" onClick={onClose} aria-label="Close settings">
                        <LineIcon name="close" size={14} strokeWidth={2.2} />
                    </button>
                </header>

                <div className="settings-body">
                    <div className="settings-main">
                        <section className="settings-section">
                            <h3 className="eyebrow">Appearance</h3>
                            <div className="theme-options" role="radiogroup" aria-label="Theme">
                                {THEMES.map((t) => (
                                    <button
                                        key={t.id}
                                        role="radio"
                                        aria-checked={theme === t.id}
                                        className={`theme-option ${theme === t.id ? 'active' : ''}`}
                                        onClick={() => onThemeChange(t.id)}
                                    >
                                        <ThemePreview id={t.id} />
                                        <span className="theme-label">{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="settings-section">
                            <h3 className="eyebrow">Accent colour</h3>
                            <div className="accent-row">
                                <div className="accent-options" role="radiogroup" aria-label="Accent colour">
                                    {COLOR_PRESETS.map((color) => (
                                        <button
                                            key={color.id}
                                            role="radio"
                                            aria-checked={currentColor === color.id}
                                            aria-label={color.name}
                                            title={color.name}
                                            className={`accent-option ${currentColor === color.id ? 'active' : ''}`}
                                            style={{ '--swatch': color.preview }}
                                            onClick={() => onColorChange(color.id)}
                                        >
                                            <span className="accent-dot" />
                                        </button>
                                    ))}
                                </div>
                                <span className="accent-name">{currentName}</span>
                            </div>
                        </section>

                        <section className="settings-section">
                            <h3 className="eyebrow">Window</h3>
                            <label className="setting-row">
                                <span className="setting-text">
                                    <span className="setting-title">Glass transparency</span>
                                    <span className="setting-desc">Frosted panels over a soft backdrop. Turn off for solid surfaces.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    className="switch"
                                    checked={glass}
                                    onChange={(e) => onGlassChange?.(e.target.checked)}
                                />
                            </label>
                            <label className="setting-row">
                                <span className="setting-text">
                                    <span className="setting-title">Preview panel</span>
                                    <span className="setting-desc">Show file preview and details on the right</span>
                                </span>
                                <input
                                    type="checkbox"
                                    className="switch"
                                    checked={showPreview}
                                    onChange={(e) => onShowPreviewChange?.(e.target.checked)}
                                />
                            </label>
                        </section>
                    </div>

                    <aside className="settings-about" aria-label="About">
                        <div className="about-header">
                            <img src={logo} alt="" className="about-logo" />
                            <div className="about-app-info">
                                <span className="about-app-name">Tulip File Explorer</span>
                                {version && <span className="about-version">Version {version}</span>}
                            </div>
                        </div>
                        <dl className="about-info">
                            <div className="about-row"><dt>Built with</dt><dd>Electron + React</dd></div>
                            <div className="about-row"><dt>License</dt><dd>MIT</dd></div>
                            <div className="about-row"><dt>Designed by</dt><dd>Atish Ak Sharma</dd></div>
                        </dl>
                        <button
                            className="btn btn-primary"
                            onClick={() => window.electronAPI?.openExternal('https://github.com/atishsharma/Tulip-File-Explorer/releases')}
                        >
                            <LineIcon name="downloads" size={16} strokeWidth={2} />
                            Check for updates
                        </button>
                        <div className="about-links">
                            <button className="link-btn" onClick={() => window.electronAPI?.openExternal('https://github.com/atishsharma/Tulip-File-Explorer')}>
                                Source on GitHub
                            </button>
                            <button className="link-btn" onClick={() => window.electronAPI?.openExternal('https://atishaksharma.com')}>
                                Webpage Testing Tool
                            </button>
                            <button className="link-btn" onClick={() => window.electronAPI?.openExternal('https://atishaksharma.com/hub')}>
                                Bookmark Manager Hub
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
