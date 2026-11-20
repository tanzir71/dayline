import { describe, it, expect } from 'vitest';

describe('base path config', () => {
  it('normalises PUBLIC_BASE_PATH', () => {
    const norm = (raw: string) => {
      const t = raw.replace(/^\/+|\/+$/g, '');
      return t ? `/${t}/` : '/';
    };
    expect(norm('/dayline')).toBe('/dayline/');
    expect(norm('dayline/')).toBe('/dayline/');
    expect(norm('')).toBe('/');
    expect(norm('/')).toBe('/');
  });
});
