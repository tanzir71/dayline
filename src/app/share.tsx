import { render, type VNode } from 'preact';
import { fileSafeName } from './actions';

/** Mount A4 page layouts off-screen, wait for fonts and images, run `fn`, then clean up. */
export async function withOffscreenPages<T>(pages: VNode, fn: (els: HTMLElement[]) => Promise<T>): Promise<T> {
  const host = document.createElement('div');
  host.className = 'pdf-host';
  host.setAttribute('aria-hidden', 'true');
  document.body.append(host);
  try {
    render(pages, host);
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await fn([...host.querySelectorAll<HTMLElement>('.pdf-page')]);
  } finally {
    render(null, host);
    host.remove();
  }
}

/** Build a PDF from page layouts; the PDF code is fetched only now. */
export async function makePdf(pages: VNode, base: { name: string; what: string; lang: string; title: string }): Promise<File> {
  const { pagesToPdf } = await import('../domain/pdf');
  const day = new Date();
  const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const filename = `${fileSafeName(base.name)}-${base.what}-${stamp}.pdf`;
  return withOffscreenPages(pages, (els) => pagesToPdf(els, filename, { title: base.title, lang: base.lang }));
}

/** Print the same page layouts with the browser's print dialog (selectable text). */
export async function printPages(pages: VNode): Promise<void> {
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.append(root);
  }
  render(pages, root);
  await document.fonts.ready;
  document.documentElement.classList.add('printing');
  const done = () => {
    document.documentElement.classList.remove('printing');
    render(null, root!);
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  // Some browsers don't fire afterprint; clean up after a while anyway.
  setTimeout(done, 60_000);
}
