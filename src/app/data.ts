import { useApp } from './context';
import { useLive } from './live';
import type { Contact, DayEvent, EventTag, Medicine, MedicineSchedule, PlaybookItem, ProfileSection, Stock } from '../data/types';

export interface ChildData {
  ready: boolean;
  medicines: Medicine[];
  schedules: MedicineSchedule[];
  stocks: Stock[];
  playbook: PlaybookItem[];
  contacts: Contact[];
  profile: ProfileSection[];
}

const empty: ChildData = { ready: false, medicines: [], schedules: [], stocks: [], playbook: [], contacts: [], profile: [] };

/** Everything about the current child that screens read, kept live. */
export function useChildData(): ChildData {
  const { repos, child } = useApp();
  const id = child?.id ?? '';
  return useLive(
    async () => {
      if (!id) return { ...empty, ready: true };
      const medicines = await repos.medicines.where('child_id', id);
      const ids = new Set(medicines.map((m) => m.id));
      const [schedules, stocks, playbook, contacts, profile] = await Promise.all([
        repos.schedules.all().then((r) => r.filter((s) => ids.has(s.medicine_id))),
        repos.stock.all().then((r) => r.filter((s) => ids.has(s.medicine_id))),
        repos.playbook.where('child_id', id),
        repos.contacts.where('child_id', id),
        repos.profile.where('child_id', id),
      ]);
      return {
        ready: true,
        medicines,
        schedules,
        stocks,
        playbook: playbook.sort((a, b) => b.helped_count - a.helped_count || a.sort - b.sort),
        contacts,
        profile,
      };
    },
    [id],
    empty,
  );
}

/** Events and their tags between two days (inclusive), kept live. */
export function useEvents(fromDay: string, toDay: string): { events: DayEvent[]; tags: EventTag[]; ready: boolean } {
  const { repos, child } = useApp();
  const id = child?.id ?? '';
  return useLive(
    async () => {
      if (!id) return { events: [], tags: [], ready: true };
      const events = await repos.events.between(id, fromDay, toDay);
      return { events, tags: await repos.events.tags(events.map((e) => e.id)), ready: true };
    },
    [id, fromDay, toDay],
    { events: [] as DayEvent[], tags: [] as EventTag[], ready: false as boolean },
  );
}

export function sectionLines(profile: ProfileSection[], key: string): string[] {
  const s = profile.find((p) => p.section === key);
  return (s?.body ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

export function sortedContacts(contacts: Contact[]): Contact[] {
  const order = ['parent', 'grandparent', 'sitter', 'teacher', 'doctor', 'therapist', 'other'];
  return [...contacts].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
}
