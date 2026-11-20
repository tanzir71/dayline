/** Colour = kind of moment, everywhere. Tones map to the event colours in src/styles/tokens.css. */
export type Tone = 'win' | 'medicine' | 'sleep' | 'food' | 'hard-moment' | 'neutral';
export type OverlineTone = Tone | 'marigold';

export const TONES: Tone[] = ['win', 'medicine', 'sleep', 'food', 'hard-moment', 'neutral'];
export const OVERLINE_TONES: OverlineTone[] = ['marigold', 'win', 'medicine', 'sleep', 'hard-moment', 'food', 'neutral'];

/** Guide category → tone (Guides home browse tiles). */
export const CATEGORY_TONE: Record<string, Tone> = {
  everyday: 'win',
  medicines: 'medicine',
  sleep: 'sleep',
  'food-gut': 'food',
  'hard-moments': 'hard-moment',
  'school-rights': 'neutral',
  services: 'neutral',
};
