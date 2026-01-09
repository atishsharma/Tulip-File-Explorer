import { useState } from 'react';
import logo from '../../assets/logo1.png';
import './SettingsModal.css';

const COLOR_PRESETS = [
    { id: 'blue', name: 'Ocean Blue', hue: 207, preview: '#0078d4' },
    { id: 'purple', name: 'Royal Purple', hue: 270, preview: '#8b5cf6' },
    { id: 'pink', name: 'Rose Pink', hue: 330, preview: '#ec4899' },
    { id: 'red', name: 'Crimson Red', hue: 0, preview: '#dc2626' },
    { id: 'orange', name: 'Sunset Orange', hue: 25, preview: '#f97316' },
    { id: 'green', name: 'Forest Green', hue: 145, preview: '#22c55e' },
    { id: 'teal', name: 'Ocean Teal', hue: 175, preview: '#14b8a6' },
    { id: 'indigo', name: 'Deep Indigo', hue: 235, preview: '#6366f1' },
];

function SettingsModal({ isOpen, onClose, currentColor, onColorChange, theme, onThemeChange }) {
    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal card scale-in" onClick={(e) => e.stopPropagation()}>
                <header className="settings-header">
                    <h2>Settings</h2>
                    <button className="settings-close" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <div className="settings-content">
                    {/* Left Column - Settings */}
                    <div className="settings-column settings-left">
                        {/* Theme Section */}
                        <section className="settings-section">
                            <h3 className="settings-section-title">Appearance</h3>
                            <div className="theme-toggle-group">
                                <button
                                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                                    onClick={() => onThemeChange('light')}
                                >
                                    <span className="theme-icon">☀️</span>
                                    <span className="theme-label">Light</span>
                                </button>
                                <button
                                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => onThemeChange('dark')}
                                >
                                    <span className="theme-icon">🌙</span>
                                    <span className="theme-label">Dark</span>
                                </button>
                                <button
                                    className={`theme-option ${theme === 'auto' ? 'active' : ''}`}
                                    onClick={() => onThemeChange('auto')}
                                >
                                    <span className="theme-icon">🖥️</span>
                                    <span className="theme-label">Auto</span>
                                </button>
                            </div>
                        </section>

                        {/* Color Section */}
                        <section className="settings-section">
                            <h3 className="settings-section-title">Accent Color</h3>
                            <p className="settings-section-desc">
                                Choose a primary color to personalize your experience
                            </p>
                            <div className="color-grid">
                                {COLOR_PRESETS.map((color) => (
                                    <button
                                        key={color.id}
                                        className={`color-option ${currentColor === color.id ? 'active' : ''}`}
                                        onClick={() => onColorChange(color.id)}
                                        title={color.name}
                                    >
                                        <span
                                            className="color-swatch"
                                            style={{ backgroundColor: color.preview }}
                                        />
                                        <span className="color-name">{color.name}</span>
                                        {currentColor === color.id && (
                                            <span className="color-check">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <path d="M20 6L9 17l-5-5" />
                                                </svg>
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Right Column - About */}
                    <div className="settings-column settings-right">
                        <section className="settings-section about-section">
                            <h3 className="settings-section-title">About</h3>
                            <div className="about-header">
                                <img src={logo} alt="Tulip" className="about-logo" />
                                <div className="about-app-info">
                                    <span className="about-app-name">Tulip File Explorer</span>
                                    <span className="about-version">Version 1.4.3-2</span>
                                </div>
                            </div>
                            <div className="about-info">
                                <div className="about-row">
                                    <span className="about-label">Built with</span>
                                    <span className="about-value">Electron + React</span>
                                </div>
                                <div className="about-row">
                                    <span className="about-label">License</span>
                                    <span className="about-value">MIT</span>
                                </div>
                                <div className="about-row">
                                    <span className="about-label">Designed By</span>
                                    <span className="about-value">Atish Ak Sharma</span>
                                </div>
                            </div>
                            <button
                                className="update-btn"
                                onClick={() => window.electronAPI?.openExternal('https://github.com/atishsharma/Tulip-File-Explorer/releases')}
                            >
                                <span className="update-icon">📥</span>
                                <span>Check for Updates</span>
                            </button>

                            <div className="project-links">
                                <button
                                    className="project-link-btn"
                                    onClick={() => window.electronAPI?.openExternal('https://atishaksharma.com')}
                                >
                                    <span className="project-icon">🌐</span>
                                    <span>Webpage Testing Tool</span>
                                </button>
                                <button
                                    className="project-link-btn"
                                    onClick={() => window.electronAPI?.openExternal('https://atishaksharma.com/hub')}
                                >
                                    <span className="project-icon">🔖</span>
                                    <span>Bookmark Manager Hub</span>
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
