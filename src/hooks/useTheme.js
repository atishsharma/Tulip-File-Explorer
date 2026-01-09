import { useState, useEffect } from 'react';

export function useTheme() {
    const [theme, setTheme] = useState(() => {
        // Check localStorage first
        const saved = localStorage.getItem('tulip-theme');
        if (saved) return saved;

        // Default to auto if nothing is saved
        return 'auto';
    });

    const [effectiveTheme, setEffectiveTheme] = useState('light');

    // Determine the actual theme to apply
    useEffect(() => {
        if (theme === 'auto') {
            // Use system preference
            const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            setEffectiveTheme(isDark ? 'dark' : 'light');
        } else {
            setEffectiveTheme(theme);
        }
    }, [theme]);

    // Apply the effective theme to the document
    useEffect(() => {
        localStorage.setItem('tulip-theme', theme);
        document.documentElement.setAttribute('data-theme', effectiveTheme);
    }, [theme, effectiveTheme]);

    // Listen for system theme changes (only when in auto mode)
    useEffect(() => {
        if (theme !== 'auto') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            setEffectiveTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'auto';
            return 'light';
        });
    };

    return { theme, effectiveTheme, setTheme, toggleTheme };
}
