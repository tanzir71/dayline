import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { useChildData, sortedContacts } from '../data';
import { Field, ScreenHeader, TextInput } from '../ui';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { fmt } from '../../i18n';
import { CONTACT_ROLES, type Contact, type ContactRole } from '../../data/types';

/** People to call: they become call buttons in Help now, show mode and the brief. */
export function Contacts() {
  const ctx = useApp();
  const { t } = ctx;
  const C = t.contacts;
  const data = useChildData();
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 16px">
        <ScreenHeader title={C.title} backTo="/child" />
        {!data.contacts.length && !editing && <p class="empty-note t-body-14">{C.empty}</p>}
        <ul class="list-cards" role="list">
          {sortedContacts(data.contacts).map((c) =>
            editing !== 'new' && editing?.id === c.id ? (
              <li key={c.id}>
                <ContactForm contact={c} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={c.id} class="card contact">
                <span>
                  <span class="t-body-strong-15">{c.name}</span>
                  <span class="t-caption-13 muted">
                    {C.roles[c.role]}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </span>
                </span>
                <span class="contact__actions">
                  {c.phone && (
                    <a class="icon-btn" href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`} aria-label={fmt(C.call, { name: c.name })}>
                      <Icon name="phone" size={20} />
                    </a>
                  )}
                  <button type="button" class="btn btn--ghost btn--sm" onClick={() => setEditing(c)}>
                    {t.common.edit}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
        {editing === 'new' ? (
          <ContactForm contact={null} onDone={() => setEditing(null)} />
        ) : (
          <button type="button" class="btn btn--secondary btn--block" onClick={() => setEditing('new')}>
            <Icon name="plus" size={20} />
            {C.add}
          </button>
        )}
      </main>
    </div>
  );
}

function ContactForm({ contact, onDone }: { contact: Contact | null; onDone: () => void }) {
  const ctx = useApp();
  const { t, child, repos } = ctx;
  const C = t.contacts;
  const [name, setName] = useState(contact?.name ?? '');
  const [role, setRole] = useState<ContactRole>(contact?.role ?? 'parent');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  async function save(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    const v = { name: name.trim(), role, phone: phone.trim(), notes: notes.trim() };
    if (contact) await repos.contacts.update(contact.id, v);
    else await repos.contacts.add({ ...v, child_id: child!.id });
    onDone();
  }
  async function remove() {
    if (!contact) return;
    await repos.contacts.remove(contact.id);
    ctx.toast(t.common.deleted, () => void repos.contacts.restore(contact.id));
    onDone();
  }
  return (
    <form class="card stack" style="--stack-gap: 14px" onSubmit={save}>
      <Field id="ct-name" label={C.name}>
        <TextInput id="ct-name" value={name} onValue={setName} required maxLength={60} data-autofocus />
      </Field>
      <fieldset class="field">
        <legend class="field__label">{C.role}</legend>
        <div class="chip-group" role="radiogroup" aria-label={C.role}>
          {CONTACT_ROLES.map((r) => (
            <Chip key={r} mode="single" on={role === r} onClick={() => setRole(r)}>
              {C.roles[r]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <Field id="ct-phone" label={C.phone} optional>
        <TextInput id="ct-phone" type="tel" inputMode="tel" value={phone} onValue={setPhone} maxLength={20} />
      </Field>
      <Field id="ct-notes" label={C.notes} optional>
        <TextInput id="ct-notes" value={notes} onValue={setNotes} maxLength={120} />
      </Field>
      <div class="button-row">
        <button type="submit" class="btn btn--primary">
          {t.common.save}
        </button>
        <button type="button" class="btn btn--secondary" onClick={onDone}>
          {t.common.cancel}
        </button>
        {contact && (
          <button type="button" class="btn btn--ghost btn--danger" onClick={() => void remove()}>
            {t.common.delete}
          </button>
        )}
      </div>
    </form>
  );
}
