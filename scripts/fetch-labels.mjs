// Fetch official label sections from openFDA for the curated medicines in content/medicines.json
// and save them as static JSON in content/labels/. Runs in a scheduled GitHub Action; the app never
// calls openFDA. Usage: node scripts/fetch-labels.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const API = 'https://api.fda.gov/drug/label.json';
const MAX = 12_000;
const { medicines } = JSON.parse(await readFile('content/medicines.json', 'utf8'));
const { symptoms } = JSON.parse(await readFile('content/symptoms.json', 'utf8'));
await mkdir('content/labels', { recursive: true });

const clean = (s) => (Array.isArray(s) ? s.join('\n') : (s ?? '')).replace(/\s+/g, ' ').trim().slice(0, MAX);
const slug = (g) => g.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function termsIn(text) {
  const t = text.toLowerCase();
  return symptoms.filter((s) => s.label.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t))).map((s) => s.key);
}

let ok = 0;
for (const m of medicines) {
  if (m.no_fda_label) continue;
  const url = `${API}?search=openfda.generic_name:%22${encodeURIComponent(m.generic)}%22&limit=1`;
  const res = await fetch(url, { headers: { 'user-agent': 'dayline-label-check' } });
  if (!res.ok) {
    console.warn(`skip ${m.generic}: HTTP ${res.status}`);
    continue;
  }
  const r = (await res.json()).results?.[0];
  if (!r) {
    console.warn(`skip ${m.generic}: no label`);
    continue;
  }
  const sections = {
    indications: clean(r.indications_and_usage),
    adverse_reactions: clean(r.adverse_reactions),
    warnings: clean(r.warnings_and_cautions ?? r.warnings),
    boxed_warning: clean(r.boxed_warning),
  };
  const out = {
    generic: m.generic,
    source: 'U.S. FDA drug label via openFDA',
    set_id: r.set_id,
    effective_time: r.effective_time,
    fetched_at: new Date().toISOString().slice(0, 10),
    dailymed_url: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${r.set_id}`,
    sections,
    // Symptoms from content/symptoms.json found in the adverse reactions and warnings.
    terms: termsIn(`${sections.adverse_reactions} ${sections.warnings}`),
  };
  await writeFile(`content/labels/${slug(m.generic)}.json`, JSON.stringify(out, null, 1) + '\n');
  ok++;
  console.log(`${m.generic}: ${out.terms.length} symptoms on the label (effective ${r.effective_time})`);
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`${ok} labels saved`);
