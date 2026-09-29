import { useState, useEffect } from 'react';
import { readStorage, writeStorage } from '../utils/storage';

const THEMES = ['light', 'dark', 'auto'];
const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function useTheme() {
    const [theme, setTheme] = useState(() => {
        const saved = readStorage('tulip-theme', 'auto');
        return THEMES.includes(saved) ? saved : 'auto';
    });
    const [systemDark, setSystemDark] = useState(() => !!darkQuery()?.matches);

    // Track the OS preference so "auto" follows it live
    useEffect(() => {
        const mediaQuery = darkQuery();
        if (!mediaQuery) return undefined;
        const handleChange = (e) => setSystemDark(e.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const effectiveTheme = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme;

    useEffect(() => {
        writeStorage('tulip-theme', theme);
        document.documentElement.setAttribute('data-theme', effectiveTheme);
    }, [theme, effectiveTheme]);

    return { theme, effectiveTheme, setTheme };
}
