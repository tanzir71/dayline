import { entryFor } from '../labels';
import { nfc, words } from './normalize';

const SEQUENCES: [string, string][] = [
  ['ড়', 'r'],
  ['ঢ়', 'rh'],
  ['য়', 'y'],
].map(([bn, latin]) => [nfc(bn as string), latin as string]);

const LETTERS: Record<string, string> = {
  ক: 'k', খ: 'kh', গ: 'g', ঘ: 'gh', ঙ: 'ng', চ: 'ch', ছ: 'chh', জ: 'j', ঝ: 'jh', ঞ: 'n',
  ট: 't', ঠ: 'th', ড: 'd', ঢ: 'dh', ণ: 'n', ত: 't', থ: 'th', দ: 'd', ধ: 'dh', ন: 'n',
  প: 'p', ফ: 'f', ব: 'b', ভ: 'bh', ম: 'm', য: 'j', র: 'r', ল: 'l', শ: 'sh', ষ: 'sh', স: 's', হ: 'h', ৎ: 't',
  অ: 'o', আ: 'a', ই: 'i', ঈ: 'i', উ: 'u', ঊ: 'u', ঋ: 'ri', এ: 'e', ঐ: 'oi', ও: 'o', ঔ: 'ou',
  'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
  'ং': 'ng', 'ঃ': '', 'ঁ': '', '্': '',
};

const BN_SCRIPT = /[ঀ-৿]/;

export function transliterate(text: string): string {
  let s = nfc(text);
  for (const [bn, latin] of SEQUENCES) s = s.split(bn).join(latin);
  return [...s].map((ch) => LETTERS[ch] ?? ch).join('');
}

const latin = (word: string) => (BN_SCRIPT.test(word) ? transliterate(word) : word).toLowerCase();
const letterCount = (word: string) => latin(word).replace(/[^a-z]/g, '').length;

/** Consonants only: ph→f, c/ck/q→k, x→ks, repeats collapsed. y is a vowel here (methyl = মিথাইল). */
export function skeleton(word: string): string {
  return latin(word)
    .replace(/ph/g, 'f')
    .replace(/[cq]/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/[^a-z]/g, '')
    .replace(/[aeiouy]/g, '')
    .replace(/(.)\1+/g, '$1');
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHit = new Array<boolean>(a.length).fill(false);
  const bHit = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const end = Math.min(i + window + 1, b.length);
    for (let j = Math.max(0, i - window); j < end; j++) {
      if (bHit[j] || a[i] !== b[j]) continue;
      aHit[i] = true;
      bHit[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  let swaps = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aHit[i]) continue;
    while (!bHit[k]) k++;
    if (a[i] !== b[k]) swaps++;
    k++;
  }
  const t = swaps / 2;
  const jaro = (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

export interface MedicineName {
  id: string;
  generic_name: string;
  brand_name: string;
}

/** Names a medicine can be heard by: its own, their first words, and the curated en/bn names. */
function namesOf(m: MedicineName): string[] {
  const entry = entryFor(m.generic_name) ?? entryFor(m.brand_name);
  const full = [m.generic_name, m.brand_name, entry?.names.en ?? '', entry?.names.bn ?? ''].filter(Boolean);
  const out = new Set<string>();
  for (const name of full) {
    const first = nfc(name).toLowerCase().split(/[\s(]+/)[0];
    if (first) out.add(first);
  }
  return [...out];
}

/**
 * The best medicine named in these words. Aliases match exactly at any length, because the
 * parent taught them; everything else needs 4+ letters and must not be an everyday word.
 */
export function matchMedicine(
  tokens: string[],
  medicines: MedicineName[],
  aliases: Record<string, string>,
  isEverydayWord: (word: string) => boolean,
): MedicineName | null {
  const aliasIds = new Map(Object.entries(aliases).map(([heard, id]) => [nfc(heard).toLowerCase(), id]));
  let best: MedicineName | null = null;
  let bestScore = 0;
  for (const token of tokens) {
    const aliased = aliasIds.get(token);
    const viaAlias = aliased ? medicines.find((m) => m.id === aliased) : undefined;
    if (viaAlias) return viaAlias;
    if (letterCount(token) < 4 || /\d/.test(token) || isEverydayWord(token)) continue;
    const heard = latin(token);
    const bones = skeleton(token);
    for (const m of medicines) {
      for (const name of namesOf(m)) {
        const jw = jaroWinkler(heard, latin(name));
        const sameBones = bones.length >= 3 && bones === skeleton(name);
        const score = Math.max(jw >= 0.88 ? jw : 0, sameBones ? 0.95 : 0);
        if (score > bestScore) {
          best = m;
          bestScore = score;
        }
      }
    }
  }
  return best;
}

const PLAYBOOK_SKIP = new Set(['with', 'that', 'this', 'from', 'have', 'give', 'take', 'them', 'then']);

/** Playbook items whose main words were said: at least half of their 4+ letter words, fuzzily. */
export function matchPlaybook(norm: string, items: string[]): string[] {
  const heard = words(norm).map(latin);
  return items.filter((item) => {
    const key = words(nfc(item).toLowerCase())
      .filter((w) => letterCount(w) >= 4 && !PLAYBOOK_SKIP.has(w))
      .map(latin);
    if (!key.length) return false;
    const hits = key.filter((k) => heard.some((h) => jaroWinkler(h, k) >= 0.88)).length;
    return hits >= Math.ceil(key.length / 2);
  });
}
