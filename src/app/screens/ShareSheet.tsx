import { useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { useApp } from '../context';
import { useChildData, useEvents } from '../data';
import { useLive } from '../live';
import { Sheet } from '../ui';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { fmt } from '../../i18n';
import { addDays, isoWithOffset, localDay } from '../../lib/time';
import { buildBrief, BriefPage } from '../brief';
import { makePdf, printPages } from '../share';
import { deliverFile } from '../actions';
import { go } from '../router';
import { shortDate, timeLabel } from '../format';
import type { Lang, ShareRecord } from '../../data/types';

interface Options {
  title: string;
  subtitle: string;
  what: ShareRecord['what'];
  fileWhat: string;
  pdfTitle: (lang: Lang) => string;
  pdfBody: string;
  showBody: string;
  show: (lang: Lang) => void;
  pages: (lang: Lang) => VNode;
  initialLang: Lang;
  onClose: () => void;
}

/** Share sheet (2540:198): pick a language, then show on this phone, send as PDF, or print. */
export function ShareSheetBase(o: Options) {
  const ctx = useApp();
  const { t, lang, child, repos } = ctx;
  const S = t.share;
  const [outLang, setOutLang] = useState<Lang>(o.initialLang);
  const [state, setState] = useState<'idle' | 'making' | 'failed' | 'downloaded'>('idle');
  const [file, setFile] = useState('');
  const last = useLive(
    async () => (await repos.shares.where('child_id', child!.id)).filter((s) => s.what === o.what).sort((a, b) => b.at.localeCompare(a.at))[0],
    [child!.id],
    undefined,
  );

  const record = (how: 'show' | 'pdf' | 'print') =>
    repos.shares.add({ child_id: child!.id, what: o.what, how, to_text: '', language: outLang, at: isoWithOffset() });

  async function pdf() {
    setState('making');
    try {
      const f = await makePdf(o.pages(outLang), { name: child!.name, what: o.fileWhat, lang: outLang, title: o.pdfTitle(outLang) });
      const how = await deliverFile(f, { share: true, title: f.name });
      if (how !== 'cancelled') await record('pdf');
      if (how === 'downloaded') {
        setFile(f.name);
        setState('downloaded');
      } else setState('idle');
    } catch (e) {
      console.error(e);
      setState('failed');
    }
  }

  return (
    <Sheet
      title={o.title}
      subtitle={
        <>
          {o.subtitle}
          {last && <span class="t-caption-13"> · {fmt(S.lastSent, { date: shortDate(last.at, lang) })}</span>}
        </>
      }
      onClose={o.onClose}
      footer={
        <p class="t-caption-13 muted center share-foot">
          <svg width="16" height="16" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect x="5" y="10" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.8" />
            <path d="M8 10V7a3 3 0 0 1 6 0v3" stroke="currentColor" stroke-width="1.8" />
          </svg>
          {S.footer}
        </p>
      }
    >
      <fieldset class="field">
        <legend class="t-overline-12 muted">{S.language}</legend>
        <div class="chip-group" role="radiogroup" aria-label={S.language}>
          <Chip mode="single" on={outLang === 'en'} onClick={() => setOutLang('en')}>
            <span lang="en">English</span>
          </Chip>
          <Chip mode="single" on={outLang === 'bn'} onClick={() => setOutLang('bn')}>
            <span lang="bn">বাংলা</span>
          </Chip>
        </div>
      </fieldset>
      <ul class="share-options card" role="list">
        <li>
          <button
            type="button"
            class="share-option"
            onClick={async () => {
              await record('show');
              o.show(outLang);
            }}
          >
            <span class="share-option__icon tone-monsoon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="6" y="2.5" width="10" height="17" rx="2.5" stroke="currentColor" stroke-width="1.9" />
                <path d="M10 16.5h2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              </svg>
            </span>
            <span>
              <span class="t-body-strong-15">{S.show}</span>
              <span class="t-caption-13 muted">{o.showBody}</span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
        </li>
        <li>
          <button type="button" class="share-option" onClick={() => void pdf()} disabled={state === 'making'} aria-busy={state === 'making'}>
            <span class="share-option__icon tone-win" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M5 3.5h8l4 4V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" />
                <path d="M7.5 11h7M7.5 14.5h5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              </svg>
            </span>
            <span>
              <span class="t-body-strong-15">{state === 'making' ? S.making : S.pdf}</span>
              <span class="t-caption-13 muted">{o.pdfBody}</span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
        </li>
        <li>
          <button
            type="button"
            class="share-option"
            onClick={async () => {
              await record('print');
              await printPages(o.pages(outLang));
            }}
          >
            <span class="share-option__icon tone-neutral" aria-hidden="true">
              <Icon name="print" size={22} />
            </span>
            <span>
              <span class="t-body-strong-15">{S.print}</span>
              <span class="t-caption-13 muted">{S.printBody}</span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
        </li>
      </ul>
      <p class="t-body-14" role="status">
        {state === 'failed' && S.failed}
        {state === 'downloaded' && fmt(S.downloaded, { file })}
      </p>
    </Sheet>
  );
}

/** Share the child's brief. */
export function ShareSheet({ onClose }: { onClose: () => void }) {
  const ctx = useApp();
  const { t, lang, child } = ctx;
  const data = useChildData();
  const today = localDay();
  const { events, tags } = useEvents(addDays(today, -1), today);
  const name = child!.name;
  return (
    <ShareSheetBase
      title={fmt(t.share.title, { name })}
      subtitle={fmt(t.share.subtitle, { time: timeLabel(new Date(), lang) })}
      what="brief"
      fileWhat="brief"
      pdfTitle={(l) => fmt(buildBrief(ctx, data, events, tags, l).t.brief.pdfTitle, { name })}
      pdfBody={t.share.pdfBody}
      showBody={t.share.showBody}
      show={(l) => go(`/show/${l}`)}
      pages={(l) => <BriefPage b={buildBrief(ctx, data, events, tags, l)} />}
      initialLang={child!.language ?? lang}
      onClose={onClose}
    />
  );
}
