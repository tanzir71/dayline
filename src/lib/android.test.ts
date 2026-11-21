import { describe, expect, it } from 'vitest';
import { compareVersions, formatDate, formatFingerprint, formatHash, formatSize, updateState } from './android';

describe('compareVersions', () => {
  it('orders by major, minor, then patch', () => {
    expect(compareVersions('0.9.0', '1.0.0')).toBe(-1);
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('compares numbers, not text', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
  });
});

describe('updateState', () => {
  it('offers an update only when a newer version exists', () => {
    expect(updateState('0.9.0', '1.0.0')).toBe('update');
    expect(updateState('1.0.0', '1.0.0')).toBe('current');
    expect(updateState('1.1.0', '1.0.0')).toBe('current');
  });

  it('shows nothing for a missing or malformed version', () => {
    expect(updateState(null, '1.0.0')).toBeNull();
    expect(updateState('', '1.0.0')).toBeNull();
    expect(updateState('1.0', '1.0.0')).toBeNull();
    expect(updateState('<img src=x>', '1.0.0')).toBeNull();
  });
});

describe('formatting', () => {
  it('size in MB with one decimal, Bangla digits in Bangla', () => {
    expect(formatSize(9_123_456, 'en')).toBe('9.1 MB');
    expect(formatSize(9_000_000, 'en')).toBe('9.0 MB');
    expect(formatSize(9_123_456, 'bn')).toBe('৯.১ MB');
  });

  it('date in the page language', () => {
    expect(formatDate('2026-12-04', 'en')).toBe('4 December 2026');
    expect(formatDate('2026-12-04', 'bn')).toContain('২০২৬');
  });

  it('hash in groups of 4', () => {
    expect(formatHash('9F2C41AB77e0')).toBe('9f2c 41ab 77e0');
  });

  it('fingerprint as colon hex, with or without colons in the source', () => {
    expect(formatFingerprint('7b2c901e')).toBe('7B:2C:90:1E');
    expect(formatFingerprint('7B:2C:90:1E')).toBe('7B:2C:90:1E');
  });
});
