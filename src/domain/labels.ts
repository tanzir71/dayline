import symptomsFile from '../../content/symptoms.json';
import medicinesFile from '../../content/medicines.json';
import type { DayEvent, Medicine } from '../data/types';
import { dayOf } from '../lib/time';

export interface Symptom {
  key: string;
  en: string;
  bn: string;
  label: string[];
}

export interface MedicineEntry {
  generic: string;
  names: { en: string; bn: string };
  brands: string[];
  no_fda_label?: boolean;
}

/** What the app needs from a saved label (content/labels/*.json); the full text stays out of the bundle. */
export interface LabelSummary {
  generic: string;
  source: string;
  effective_time: string;
  fetched_at: string;
  dailymed_url: string;
  indications: string;
  boxed: boolean;
  terms: string[];
}

export const SYMPTOMS = symptomsFile.symptoms as Symptom[];
export const MEDICINES = medicinesFile.medicines as MedicineEntry[];

/** Visit-prep "anything new" answers that correspond to label symptoms. */
export const PREP_SYMPTOMS: Record<string, string[]> = {
  appetite: ['appetite_up', 'appetite_down'],
  sleepiness: ['sleepiness'],
  toileting: ['constipation', 'diarrhoea', 'bedwetting'],
};

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** The curated entry for a medicine name as the parent typed it (generic or a listed brand). */
export function entryFor(name: string): MedicineEntry | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return MEDICINES.find((m) => {
    const g = norm(m.generic);
    const en = norm(m.names.en);
    return g === n || en === n || g.startsWith(`${n} `) || n.startsWith(g) || n.startsWith(en) || m.brands.some((b) => norm(b) === n);
  });
}

export function labelFor(medicine: Pick<Medicine, 'generic_name' | 'brand_name'>, labels: LabelSummary[]): LabelSummary | undefined {
  const e = entryFor(medicine.generic_name) ?? entryFor(medicine.brand_name);
  return e ? labels.find((l) => l.generic === e.generic) : undefined;
}

/** Days each symptom was noted: Health moments with a symptom, and the gut flags from food. */
export function symptomDays(events: DayEvent[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (key: string, day: string) => out.set(key, (out.get(key) ?? new Set()).add(day));
  for (const e of events) {
    if (e.deleted_at) continue;
    const d = e.data as Record<string, unknown>;
    if (e.kind === 'health' && typeof d.symptom_key === 'string') add(d.symptom_key, dayOf(e.started_at));
    if (e.kind === 'food' && (d.gut === 'constipated' || d.gut === 'none')) add('constipation', dayOf(e.started_at));
    if (e.kind === 'food' && d.gut === 'loose') add('diarrhoea', dayOf(e.started_at));
  }
  return out;
}

export interface LabelMatch {
  symptom: string;
  days: number;
  /** Noticed at home (visit prep) rather than logged. */
  fromPrep: boolean;
  medicines: string[];
}

/**
 * Symptoms noted at home that are listed on the label of a current medicine.
 * Each becomes a question for the prescriber; nothing says the medicine caused it.
 */
export function labelMatches(events: DayEvent[], medicines: Medicine[], labels: LabelSummary[], prepNew: string[] = []): LabelMatch[] {
  const days = symptomDays(events);
  const prepKeys = new Set(prepNew.flatMap((k) => PREP_SYMPTOMS[k] ?? []));
  const keys = new Set([...days.keys(), ...prepKeys]);
  const out: LabelMatch[] = [];
  for (const key of keys) {
    const meds = medicines.filter((m) => m.active && !m.deleted_at && labelFor(m, labels)?.terms.includes(key)).map((m) => m.generic_name);
    if (!meds.length) continue;
    const n = days.get(key)?.size ?? 0;
    out.push({ symptom: key, days: n, fromPrep: n === 0, medicines: meds });
  }
  return out.sort((a, b) => b.days - a.days);
}
