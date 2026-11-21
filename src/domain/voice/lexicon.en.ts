export type Part = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Ate = 'none' | 'little' | 'most' | 'some' | 'all';
export type Gut = 'none' | 'constipated' | 'loose' | 'normal';
export type Quality = 'poor' | 'restless' | 'good';

/**
 * Trigger and slot words. Record keys are checked in the order written, so the more
 * specific reading comes first ("no poop" before "pooped", poor sleep before good).
 * place, before and helped are indexed: index i resolves to the label at index i.
 */
export interface Lexicon {
  note: string[];
  doseGeneric: string[];
  doseGive: string[];
  /** Verbs that can introduce an unknown medicine. Never had/took. */
  doseUnknownVerbs: string[];
  doseMissed: string[];
  doseRefused: string[];
  /** Plans and questions: a dose talked about, not a dose given. */
  doseNotDone: string[];
  /** Past-tense words that confirm a named medicine was given. */
  doseConfirm: string[];
  /** Words that may surround a medicine name when it is said alone ("Keppra at 1"). */
  doseBare: string[];
  /** Words that are never an unknown medicine. */
  stop: string[];
  sleep: string[];
  /** Sleep words that also mean something else; a health word in the clause outranks them. */
  sleepWeak: string[];
  wake: string[];
  nap: string[];
  quality: Record<Quality, string[]>;
  hard: string[];
  size: { 5: string[]; 4: string[]; 3: string[]; 1: string[] };
  /** "little sister" is not a size. */
  sizeNot: string[];
  hurtSelf: string[];
  place: string[][];
  before: string[][];
  helpedCue: string[];
  helped: string[][];
  food: string[];
  meal: Record<Meal, string[]>;
  ate: Record<Ate, string[]>;
  gut: Record<Gut, string[]>;
  /** Gut words that make a food entry alone; bare "loose" or "runny" do not. */
  gutTrigger: string[];
  health: { key: string | null; terms: string[] }[];
  school: string[];
  win: string[];
  parts: Record<Part, string[]>;
  yesterday: string[];
  filler: string[];
  joiners: string[];
  /** The joiners that share one verb and time across both sides ("risperidone and Keppra at 8"). */
  andWords: string[];
}

export const en: Lexicon = {
  note: ['buy', 'order', 'refill', 'remind', 'reminder', 'ask the doctor', 'ask doctor', 'ask dr'],
  doseGeneric: ['medicine', 'meds', 'dose', 'tablet', 'pill', 'syrup', 'drops'],
  doseGive: ['gave', 'give', 'took', 'had his', 'had her'],
  doseUnknownVerbs: ['gave', 'give'],
  doseMissed: ['missed', 'forgot', 'skipped', "didn't give", 'did not give'],
  doseRefused: ['refused', 'spat', 'spit out', "wouldn't take", "won't take", "didn't take", 'did not take', "didn't want", 'did not want'],
  doseNotDone: ['need to', 'needs to', 'have to', 'has to', 'should', 'must', 'will give', 'will take', 'going to', 'gonna', 'want to', 'wants to', 'supposed to', 'plan to', 'next dose', 'did he', 'did she', 'has he', 'has she', 'can i', 'can we', 'do i', 'do we', 'when do', 'how much', 'tomorrow'],
  doseConfirm: ['had', 'taken', 'given', 'swallowed'],
  doseBare: ['at', 'around', 'by', 'about', 'the', 'his', 'her', 'a', 'an', 'in', 'on', 'am', 'pm', 'this', 'morning', 'noon', 'afternoon', 'evening', 'night', "o'clock", 'oclock'],
  stop: [
    'bath', 'shower', 'water', 'juice', 'milk', 'break', 'phone', 'tablet',
    'space', 'another', 'extra', 'more', 'some', 'them', 'that', 'this', 'these', 'those', 'what',
    'everything', 'nothing', 'something', 'choice', 'chance', 'warning', 'rest', 'attention',
    'cuddle', 'kiss', 'homework', 'money', 'ride', 'lift', 'yogurt', 'banana', 'apple', 'biscuit',
  ],
  sleep: ['slept', 'sleep', 'asleep', 'nap', 'bed', 'bedtime', 'woke', 'wake', 'good night', 'bad night'],
  sleepWeak: [],
  wake: ['woke', 'wake', 'got up'],
  nap: ['nap'],
  quality: {
    poor: ['bad night', 'badly', 'barely slept', "didn't sleep", 'did not sleep', 'poor sleep'],
    restless: ['restless', 'tossing'],
    good: ['slept well', 'sleep well', 'good night', 'good sleep'],
  },
  hard: ['meltdown', 'tantrum', 'upset', 'scream', 'cry', 'cried', 'cries', 'hit', 'bite', 'bit him', 'bit her', 'bit me', 'bit someone', 'threw', 'throw', 'kick', 'shutdown', 'shut down', 'hard moment'],
  size: {
    5: ['unsafe', 'hurt himself', 'hurt herself', 'needed help', 'hit someone'],
    4: ['big', 'bad', 'long'],
    3: ['medium'],
    1: ['small', 'brief', 'little'],
  },
  sizeNot: ['little sister', 'little brother', 'little one', 'little boy', 'little girl', 'big sister', 'big brother', 'big boy', 'big girl'],
  hurtSelf: ['hurt himself', 'hurt herself'],
  place: [
    ['home', 'house'],
    ['school', 'class'],
    ['car', 'bus', 'rickshaw', 'cng'],
    ['outside', 'park', 'shop', 'market', 'road'],
  ],
  before: [
    ['turned off', 'switch', 'leaving', 'stop playing'],
    ['said no', 'told him no', 'told her no', "wasn't allowed"],
    ['noise', 'loud', 'fire drill', 'horn', 'crowd'],
    ['wait', 'queue'],
    ['tired'],
    ['hungry'],
    ['pain', 'hurt', 'tooth', 'teeth', 'stomach'],
    ['no reason', "don't know why"],
  ],
  helpedCue: ['helped', 'worked', 'calmed', 'calmed down'],
  helped: [
    ['quiet', 'calm corner', 'calm room'],
    ['fewer words', 'less talking'],
    ['hug', 'squeeze', 'pressure', 'blanket'],
    ['toy', 'favourite', 'favorite'],
    ['time', 'waited it out'],
  ],
  food: ['ate', 'eat', 'breakfast', 'lunch', 'dinner', 'supper', 'snack', 'food', 'meal'],
  meal: {
    breakfast: ['breakfast'],
    lunch: ['lunch'],
    dinner: ['dinner', 'supper'],
    snack: ['snack'],
  },
  ate: {
    none: ['nothing', "didn't eat", 'did not eat', "wouldn't eat"],
    little: ['a little', 'a bit', 'few bites'],
    most: ['most'],
    some: ['half', 'some'],
    all: ['everything', 'all', 'full plate'],
  },
  gut: {
    none: ['no poop', "didn't poop", 'did not poop'],
    constipated: ['constipated', 'constipation', 'hard stool'],
    loose: ['loose', 'diarrhoea', 'diarrhea', 'runny'],
    normal: ['pooped', 'normal poop'],
  },
  gutTrigger: ['poop', 'pooped', 'no poop', "didn't poop", 'constipated', 'constipation', 'hard stool', 'loose stool', 'loose motion', 'diarrhoea', 'diarrhea'],
  health: [
    { key: 'fever', terms: ['fever', 'temperature'] },
    { key: 'vomiting', terms: ['vomit', 'threw up', 'throw up', 'throwing up'] },
    { key: 'rash', terms: ['rash'] },
    { key: 'stomach_pain', terms: ['upset stomach', 'stomach upset', 'stomach ache', 'stomachache'] },
    { key: null, terms: ['cough', 'cold'] },
  ],
  school: ['school', 'teacher', 'class', "ma'am", 'sir'],
  win: ['first time', 'managed', 'did well', 'by himself', 'by herself', 'asked for', 'used words', 'proud'],
  parts: {
    morning: ['morning'],
    noon: ['noon'],
    afternoon: ['afternoon'],
    evening: ['evening'],
    night: ['night', 'tonight'],
  },
  yesterday: ['yesterday', 'last night'],
  filler: ['um', 'umm', 'uh', 'uhh', 'hm', 'hmm', 'ah', 'er', 'erm', 'mm'],
  joiners: ['and', 'then', 'also'],
  andWords: ['and'],
};
