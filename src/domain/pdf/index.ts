/**
 * PDF engine. Each A4 page is laid out in HTML, rendered to a JPEG on the device and placed on a PDF page.
 * Pages are images on purpose: PDF libraries can't shape Bangla script, the browser can.
 * This module is loaded only when someone shares or prints (dynamic import).
 */
import { domToJpeg } from 'modern-screenshot';
import { PDFDocument } from 'pdf-lib';

export const A4 = { widthPt: 595.28, heightPt: 841.89, widthPx: 794, heightPx: 1123 };

function dataUrlToBytes(url: string): Uint8Array {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface PdfOptions {
  title: string;
  lang: string;
  /** JPEG quality; about 0.85 keeps a page near 150–300 KB for WhatsApp. */
  quality?: number;
  scale?: number;
}

export async function pagesToPdf(pages: HTMLElement[], filename: string, opts: PdfOptions): Promise<File> {
  await document.fonts.ready;
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title);
  pdf.setLanguage(opts.lang);
  pdf.setCreator('Dayline');
  pdf.setProducer('Dayline');
  pdf.setCreationDate(new Date());
  for (const page of pages) {
    const jpeg = await domToJpeg(page, {
      quality: opts.quality ?? 0.85,
      scale: opts.scale ?? 2,
      backgroundColor: '#ffffff',
      width: A4.widthPx,
      height: A4.heightPx,
    });
    const img = await pdf.embedJpg(dataUrlToBytes(jpeg));
    const p = pdf.addPage([A4.widthPt, A4.heightPt]);
    p.drawImage(img, { x: 0, y: 0, width: A4.widthPt, height: A4.heightPt });
  }
  // Plain object streams: opens in older phone PDF viewers too.
  const bytes = await pdf.save({ useObjectStreams: false });
  return new File([bytes as BlobPart], filename, { type: 'application/pdf' });
}
