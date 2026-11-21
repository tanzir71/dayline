/**
 * Step 1 of the parser: one spelling for digits, number words and Bangla clock words.
 * Bangla patterns always go through nfc(), because NFC decomposes য়, ড় and ঢ় and the
 * source text may hold either form.
 */

export const nfc = (s: string): string => s.normalize('NFC').replace(/[‌‍]/g, '');

export const WORD_START = '(?<![\\p{L}\\p{M}\\p{N}])';
export const WORD_END = '(?![\\p{L}\\p{M}\\p{N}])';

export const rx = (source: string, flags = 'gu'): RegExp => new RegExp(nfc(source), flags);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BN_SCRIPT = /[ঀ-৿]/;

const BN_ENDINGS = ['ে', 'র', 'ের', 'তে', 'য়', 'য়ে', 'টা', 'টি', 'টার', 'টায়', 'টাই', 'টুকু', 'গুলো', 'গুলি', 'কে', 'ও', 'ই', 'দের', 'েও', 'েই', 'তেও', 'তেই', 'রও', 'রই', 'ো']
  .map(nfc)
  .sort((a, b) => b.length - a.length)
  .join('|');

/** English stems: screamed, screaming, hitting, biting; never car → caring or nap → napkin. */
function enWord(w: string): string {
  if (!/^[a-z]+$/.test(w)) return escapeRe(w);
  if (w.endsWith('e')) return `${w.slice(0, -1)}(?:e|es|ed|ing)`;
  const last = w.slice(-1);
  if (w.length <= 4 && /[^aeiou][aeiou][^aeiouwxy]$/.test(w)) return `${w}(?:${last}ed|${last}ing|s|es)?`;
  return `${w}(?:s|es|ed|ing)?`;
}

/** Bangla stems: three or more letters match as a prefix; shorter ones (বাস, সব) take known endings only. */
function bnWord(w: string, open: boolean): string {
  const letters = w.match(/\p{L}/gu)?.length ?? 0;
  return open || letters >= 3 ? `${escapeRe(w)}[\\p{L}\\p{M}]*` : `${escapeRe(w)}(?:${BN_ENDINGS})?`;
}

function termPattern(term: string): string {
  const open = term.endsWith('*');
  const parts = nfc(open ? term.slice(0, -1) : term)
    .toLowerCase()
    .trim()
    .split(/\s+/);
  const last = parts.pop() ?? '';
  const tail = BN_SCRIPT.test(last) ? bnWord(last, open) : enWord(last);
  return [...parts.map(escapeRe), tail].join('\\s+');
}

/** One regex for a list of lexicon terms. A trailing * forces prefix matching on a short Bangla stem. */
export function compile(terms: readonly string[], flags = 'iu'): RegExp {
  if (!terms.length) return new RegExp('(?!)', flags);
  const body = [...new Set(terms)]
    .sort((a, b) => b.length - a.length)
    .map(termPattern)
    .join('|');
  return new RegExp(`${WORD_START}(?:${body})${WORD_END}`, flags);
}

export const words = (s: string): string[] =>
  (s.match(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'.:-]*/gu) ?? []).map((w) => w.replace(/[.:'-]+$/, ''));

const EN_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};
const EN_ONES = 'one|two|three|four|five|six|seven|eight|nine';
const EN_ANY = new RegExp(`\\b(?:${Object.keys(EN_NUMBERS).join('|')})\\b`, 'g');

const previousHour = (h: number) => (h <= 1 ? 12 : h - 1);

function english(input: string): string {
  return input
    .replace(/\b([ap])\.\s?m\b\.?/g, '$1m')
    .replace(/\b(did|would|was|do|could|wo)nt\b/g, "$1n't")
    .replace(/\bhalf[ -](?:an? )?hour\b/g, '30 min')
    .replace(new RegExp(`\\b(twenty|thirty|forty|fifty)[ -](${EN_ONES})\\b`, 'g'), (_, tens: string, ones: string) => String((EN_NUMBERS[tens] ?? 0) + (EN_NUMBERS[ones] ?? 0)))
    .replace(EN_ANY, (w) => String(EN_NUMBERS[w]))
    .replace(/\bonce\b/g, '1 times')
    .replace(/\btwice\b/g, '2 times')
    .replace(/\bthrice\b/g, '3 times')
    .replace(/\b(?:a|an)\s+(?=(?:min|mins|minute|hr|hour)\b)/g, '1 ')
    .replace(/\b(\d+) (?:hours?|hrs?) and (?:a )?half\b/g, '$1:30 hour')
    .replace(/(\d+) point (\d+)/g, '$1.$2')
    .replace(/\bhalf past (\d{1,2})\b/g, '$1:30')
    .replace(/\bquarter past (\d{1,2})\b/g, '$1:15')
    .replace(/\bquarter to (\d{1,2})\b/g, (_, h: string) => `${previousHour(Number(h))}:45`)
    // "to almost 7" reads as "to 7", so a range keeps both ends.
    .replace(/\b(at|from|to|till|until|by) (?:almost|nearly|about|around|roughly|approximately) (?=\d)/g, '$1 ')
    .replace(/\b(at|from|to|till|until|around|by) (\d{1,2})[ .]([0-5]\d)\b(?!\s*(?:min|hour|hr|times))/g, '$1 $2:$3')
    // "nine thirty" with no "at" before it is still a clock time.
    .replace(/(?<![\d.:])\b(1[0-2]|[1-9]) ([1-5][05])\b(?![.:]\d)(?!\s*(?:mins?|minutes?|hours?|hrs?|times|mg|ml|tablets?|pills?|drops?|%|°))/g, '$1:$2');
}

const BN_NUMBERS: Record<string, number> = Object.fromEntries(
  (
    [
      ['এক', 1],
      ['দুই', 2],
      ['দু', 2],
      ['তিন', 3],
      ['চার', 4],
      ['পাঁচ', 5],
      ['ছয়', 6],
      ['ছ', 6],
      ['সাত', 7],
      ['আট', 8],
      ['নয়', 9],
      ['দশ', 10],
      ['এগারো', 11],
      ['এগার', 11],
      ['বারো', 12],
      ['পনেরো', 15],
      ['পনের', 15],
      ['বিশ', 20],
      ['ত্রিশ', 30],
    ] as const
  ).map(([w, n]) => [nfc(w), n]),
);
const BN_NUMBER = rx(
  `${WORD_START}(${Object.keys(BN_NUMBERS)
    .sort((a, b) => b.length - a.length)
    .join('|')})(টোয়|টোর|টায়|টার|টো|টা|বার)?${WORD_END}`,
);
/** নয় also means "is not" and ছ is rarely alone: they count only next to a unit or a clock suffix. */
const BN_AMBIGUOUS = new Set([nfc('নয়'), nfc('ছ')]);
const BN_UNIT_NEXT = rx('^\\s*(?:মিনিট|ঘণ্টা|বার)', 'u');
const BN_SUFFIX: Record<string, string> = { [nfc('টোয়')]: nfc('টায়'), [nfc('টোর')]: nfc('টার'), [nfc('টো')]: nfc('টা') };

function bangla(input: string): string {
  return input
    .replace(rx('ঘন্টা'), nfc('ঘণ্টা'))
    .replace(rx('থেকে\\s+প্রায়\\s+'), `${nfc('থেকে')} `)
    .replace(rx('(\\d)\\s+(টায়|টার|টা|বার)'), '$1$2')
    .replace(rx('(সাড়ে|সোয়া|পৌনে)\\s+নয়'), '$1 9')
    .replace(BN_NUMBER, (m: string, word: string, suffix: string | undefined, at: number, whole: string) => {
      if (!suffix && BN_AMBIGUOUS.has(word) && !BN_UNIT_NEXT.test(whole.slice(at + m.length))) return m;
      return `${BN_NUMBERS[word]}${suffix ? (BN_SUFFIX[suffix] ?? suffix) : ''}`;
    })
    .replace(rx(`${WORD_START}সাড়ে\\s*(\\d{1,2})`), '$1:30')
    .replace(rx(`${WORD_START}সোয়া\\s*(\\d{1,2})`), '$1:15')
    .replace(rx(`${WORD_START}পৌনে\\s*(\\d{1,2})`), (_, h: string) => `${previousHour(Number(h))}:45`)
    .replace(rx(`${WORD_START}দেড়(?=টা|\\s|$)`), '1:30')
    .replace(rx(`${WORD_START}আড়াই(?=টা|\\s|$)`), '2:30')
    .replace(rx(`${WORD_START}আধা?\\s*ঘণ্টা[\\p{L}\\p{M}]*`), `30 ${nfc('মিনিট')}`);
}

export function normalize(text: string): string {
  const base = nfc(text)
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
  return bangla(english(base)).replace(/\s+/g, ' ').trim();
}
