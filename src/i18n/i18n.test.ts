import { describe, it, expect } from 'vitest';
import en from './en.json';
import bn from './bn.json';
import { fmt, plural } from './index';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function shape(value: Json, path = ''): string[] {
  if (Array.isArray(value)) return [`${path}[${value.length}]`, ...value.flatMap((v, i) => shape(v, `${path}[${i}]`))];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  return [path];
}

function leaves(value: Json, path = ''): [string, Json][] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, value]];
}

describe('i18n parity', () => {
  it('Bangla has exactly the same keys and list lengths as English', () => {
    expect(shape(bn as Json).sort()).toEqual(shape(en as Json).sort());
  });

  it('no string is empty in either language', () => {
    for (const [path, v] of [...leaves(en as Json), ...leaves(bn as Json)]) {
      if (typeof v === 'string') expect(v.trim(), path).not.toBe('');
    }
  });

  it('placeholders match between languages', () => {
    const bnMap = new Map(leaves(bn as Json));
    for (const [path, v] of leaves(en as Json)) {
      if (typeof v !== 'string') continue;
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(String(bnMap.get(path))), path).toEqual(ph(v));
    }
  });

  it('copy avoids alarm and blame words', () => {
    const text = JSON.stringify(en).toLowerCase();
    for (const word of ['patient', 'episode', 'non-compliant', "you haven't logged", 'streak!', '!"']) {
      expect(text.includes(word), word).toBe(false);
    }
  });
});

describe('fmt', () => {
  it('fills placeholders and uses Bangla digits in Bangla', () => {
    expect(fmt('{n} guides', { n: 12 })).toBe('12 guides');
    expect(fmt('{n}টি গাইড', { n: 12 }, 'bn')).toBe('১২টি গাইড');
    expect(plural(1, { one: '1 guide', other: '{n} guides' }, 'en')).toBe('1 guide');
    expect(plural(0, { one: '1 guide', other: '{n} guides', zero: 'Coming soon' }, 'en')).toBe('Coming soon');
  });
});
