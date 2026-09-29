import { describe, it, expect } from 'vitest';
import { formatFileSize, formatDriveCapacity, getDriveUsagePercent, calendarDaysAgo } from '../src/utils/formatters.js';

describe('formatFileSize', () => {
    it('formats common sizes', () => {
        expect(formatFileSize(0)).toBe('0 B');
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(null)).toBe('-');
    });
    it('never returns undefined units', () => {
        expect(formatFileSize(2 ** 60)).toMatch(/EB$/);
        expect(formatFileSize(2 ** 80)).not.toMatch(/undefined/);
        expect(formatFileSize(-2048)).toBe('-2.0 KB');
    });
});

describe('drive capacity', () => {
    it('reports a completely full drive', () => {
        const full = { total: 1000, free: 0 };
        expect(getDriveUsagePercent(full)).toBe(100);
        expect(formatDriveCapacity(full)).toContain('0 B free');
    });
    it('handles unknown values', () => {
        expect(getDriveUsagePercent({ total: null, free: null })).toBe(0);
        expect(formatDriveCapacity({ total: 1000, free: null })).toBe('');
    });
});

describe('calendarDaysAgo', () => {
    it('uses calendar days, not 24h windows', () => {
        const now = new Date(2026, 0, 2, 0, 30);
        expect(calendarDaysAgo(new Date(2026, 0, 1, 23, 45), now)).toBe(1);
        expect(calendarDaysAgo(new Date(2026, 0, 2, 0, 5), now)).toBe(0);
        expect(calendarDaysAgo(new Date(2026, 0, 5), now)).toBe(-3);
    });
});
