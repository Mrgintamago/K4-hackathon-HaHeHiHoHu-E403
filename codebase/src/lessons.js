import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { redactPii } from './privacy.js';

const FILE_RE = /^(\d{2})\.(\d{2})\.(\d{4})-([^\\/]+)\.pdf$/iu;

function dateKey(date, timeZone = 'Asia/Ho_Chi_Minh') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('day')}.${get('month')}.${get('year')}`;
}

export function findLessonPdf(directory, date, timeZone) {
  if (!fs.existsSync(directory)) return null;
  const wanted = dateKey(date, timeZone);
  const matches = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && FILE_RE.test(entry.name) && entry.name.startsWith(`${wanted}-`));
  if (matches.length !== 1) return null;
  const resolvedDir = path.resolve(directory);
  const filePath = path.resolve(resolvedDir, matches[0].name);
  if (!filePath.startsWith(`${resolvedDir}${path.sep}`)) throw new Error('Đường dẫn PDF không an toàn');
  return filePath;
}

export function lessonLinkForPdf(filePath, listPath = path.join(path.dirname(filePath), 'list.md')) {
  const match = path.basename(filePath).match(FILE_RE);
  if (!match || !fs.existsSync(listPath)) return '';
  const lessonKey = match[4].trim().toLocaleLowerCase('vi');
  for (const line of fs.readFileSync(listPath, 'utf8').split(/\r?\n/)) {
    const entry = line.match(/^\s*([^:#]+)\s*:\s*(https:\/\/\S+)\s*$/i);
    if (entry?.[1].trim().toLocaleLowerCase('vi') === lessonKey) {
      try {
        const url = new URL(entry[2]);
        return url.protocol === 'https:' ? url.toString() : '';
      } catch {
        return '';
      }
    }
  }
  return '';
}

export function lessonNumberForPdf(filePath) {
  const match = path.basename(filePath).match(FILE_RE);
  const lesson = match?.[4].trim().match(/^ngay[\s._-]*0?(\d{1,3})$/i);
  return lesson ? Number(lesson[1]) : null;
}

export async function readFirstPages(filePath, maxPages = 3) {
  const bytes = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await getDocument({ data: bytes, disableFontFace: true, useSystemFonts: false }).promise;
  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(maxPages, pdf.numPages); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str || '').join(' ').replace(/\s+/g, ' ').trim();
      pages.push(`[Trang ${pageNumber}] ${text}`);
    }
    return redactPii(pages.join('\n')).slice(0, 30000);
  } finally {
    await pdf.destroy();
  }
}

export const readFirstPage = readFirstPages;

export function dayDates(now = new Date()) {
  return { today: now, yesterday: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
}
