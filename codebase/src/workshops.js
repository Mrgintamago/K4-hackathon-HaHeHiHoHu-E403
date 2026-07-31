import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { redactPii } from './privacy.js';
import { hasDateReference } from './query-intents.js';

export const WORKSHOPS = Object.freeze({
  1: { number: 1, file: 'workshop01_transcript.md', prefix: 'WS1', label: 'Workshop 1' },
  2: { number: 2, file: 'workshop02_transcript.md', prefix: 'WS2', label: 'Workshop 2' },
});

const MARKER_RE = /(?:^|\n)\s*(?:\*\*)?\[(WS[12]-\d{3})\](?:\*\*)?\s*/g;
const QUESTION_RE = /\b(?:em|mình|tôi)\s+(?:xin\s+)?(?:muốn|có thể|cho)\s+hỏi\b|\bcâu hỏi\b|\bhỏi (?:là|về|ban tổ chức|thầy|anh|chị)\b|\bkhông ạ\b/i;
const QA_SIGNAL_RE = /\bQ\s*&\s*A\b|\bphần (?:hỏi đáp|câu hỏi)\b|\bcó (?:những )?câu hỏi\b|\bgiơ tay\b/i;
const STOP_WORDS = new Set([
  'anh', 'ban', 'ban tổ chức', 'bạn', 'các', 'cái', 'câu', 'cho', 'chủ đề', 'có', 'của', 'được', 'em', 'hỏi',
  'không', 'là', 'mình', 'một', 'muốn', 'này', 'những', 'thầy', 'thì', 'tôi', 'trong', 'và', 'về',
  'workshop', 'ws', 'bot', 'thắc mắc', 'ơi', 'ạ',
]);

function safeTranscriptPath(file) {
  const root = path.resolve(config.transcriptDir);
  const filePath = path.resolve(root, file);
  if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error('Đường dẫn workshop transcript không an toàn');
  return filePath;
}

export function parseWorkshopText(raw, expectedPrefix) {
  const matches = [...String(raw || '').matchAll(MARKER_RE)];
  const chunks = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? raw.length;
    return {
      code: match[1],
      text: String(raw).slice(start, end).replace(/\s+/g, ' ').trim(),
      index,
    };
  }).filter((chunk) => chunk.text && (!expectedPrefix || chunk.code.startsWith(expectedPrefix)));
  if (!chunks.length) throw new Error('Workshop transcript sai định dạng');
  return chunks;
}

export function loadWorkshop(number) {
  const workshop = WORKSHOPS[number];
  if (!workshop) throw new Error('Workshop không hợp lệ');
  const raw = fs.readFileSync(safeTranscriptPath(workshop.file), 'utf8');
  const chunks = parseWorkshopText(raw, workshop.prefix);
  const firstQaSignal = chunks.findIndex((chunk, index) =>
    index >= Math.floor(chunks.length * 0.55) && (QA_SIGNAL_RE.test(chunk.text) || QUESTION_RE.test(chunk.text)));
  const qaStart = firstQaSignal >= 0 ? firstQaSignal : Math.floor(chunks.length * 0.75);
  return {
    ...workshop,
    chunks,
    contentChunks: chunks.slice(0, qaStart),
    qaChunks: chunks.slice(qaStart),
  };
}

function keywords(value) {
  return [...new Set(String(value || '').toLocaleLowerCase('vi')
    .normalize('NFC')
    .match(/[\p{L}\p{N}]{2,}/gu) || [])]
    .filter((word) => !STOP_WORDS.has(word));
}

function score(text, terms) {
  const normalized = text.toLocaleLowerCase('vi').normalize('NFC');
  return terms.reduce((total, term) => total + (normalized.includes(term) ? 1 : 0), 0);
}

function clippedText(text, terms = [], maxLength = 1800) {
  const safe = redactPii(text);
  if (safe.length <= maxLength) return safe;
  const normalized = safe.toLocaleLowerCase('vi').normalize('NFC');
  const positions = terms.map((term) => normalized.indexOf(term)).filter((position) => position >= 0);
  const center = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, center - Math.floor(maxLength * 0.3));
  const end = Math.min(safe.length, start + maxLength);
  return `${start ? '…' : ''}${safe.slice(start, end).trim()}${end < safe.length ? '…' : ''}`;
}

function cited(chunk, terms = [], maxLength = 1800) {
  return `[${chunk.code}] ${clippedText(chunk.text, terms, maxLength)}`;
}

function fitChunks(chunks, maxChars, terms = [], chunkMax = 1800) {
  const result = [];
  let length = 0;
  for (const chunk of chunks) {
    const line = cited(chunk, terms, chunkMax);
    if (length + line.length + 1 > maxChars) break;
    result.push(line);
    length += line.length + 1;
  }
  return result.join('\n');
}

function splitWorkshopChunks(chunks, maxLength = 560) {
  const segments = [];
  for (const chunk of chunks) {
    let remaining = String(chunk.text || '').replace(/\s+/g, ' ').trim();
    while (remaining) {
      if (remaining.length <= maxLength) {
        segments.push({ code: chunk.code, text: remaining });
        break;
      }
      const space = remaining.lastIndexOf(' ', maxLength);
      const cut = space >= Math.floor(maxLength * 0.65) ? space : maxLength;
      segments.push({ code: chunk.code, text: remaining.slice(0, cut).trim() });
      remaining = remaining.slice(cut).trim();
    }
  }
  return segments.filter((segment) => segment.text.length >= 30);
}

function representativeSegments(segments, target) {
  if (segments.length <= target) return segments;
  const selected = [];
  for (let index = 0; index < target; index += 1) {
    const from = Math.floor(index * segments.length / target);
    const to = Math.max(from + 1, Math.floor((index + 1) * segments.length / target));
    const best = segments.slice(from, to).reduce((winner, segment) => {
      const score = keywords(segment.text).length + Math.min(segment.text.length, 560) / 100;
      return score > winner.score ? { segment, score } : winner;
    }, { segment: null, score: -1 });
    if (best.segment) selected.push(best.segment);
  }
  return selected;
}

export function buildWorkshopSummarySource(workshop, maxChars = 12000) {
  const contentSegments = splitWorkshopChunks(workshop.contentChunks);
  const sampled = representativeSegments(contentSegments, Math.min(20, contentSegments.length));
  const qaSegments = splitWorkshopChunks(workshop.qaChunks);
  const selectedQa = new Map();
  const questionIndexes = qaSegments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => QUESTION_RE.test(segment.text) || segment.text.includes('?'))
    .slice(0, 3);
  for (const { index } of questionIndexes) {
    for (let offset = 0; offset < 3 && index + offset < qaSegments.length; offset += 1) {
      selectedQa.set(index + offset, qaSegments[index + offset]);
    }
  }
  const main = fitChunks(sampled, Math.floor(maxChars * 0.68), [], 600);
  const qa = fitChunks([...selectedQa.values()], maxChars - main.length - 50, ['hỏi', 'câu hỏi'], 600);
  return `${main}\n\n<CÂU_HỎI_CUỐI_BUỔI>\n${qa || 'Không nhận diện được câu hỏi.'}`.slice(0, maxChars);
}

function localPoint(text, maxLength = 180) {
  const safe = redactPii(text).replace(/\s+/g, ' ').trim();
  if (safe.length <= maxLength) return safe;
  const clipped = safe.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('? '), clipped.lastIndexOf('! '));
  return `${clipped.slice(0, sentenceEnd >= 80 ? sentenceEnd + 1 : maxLength).trim()}…`;
}

export function buildLocalWorkshopFallback(workshop, qaSource = '') {
  if (qaSource) {
    const excerpts = qaSource.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\[WS[12]-\d{3}\]/.test(line))
      .slice(0, 2)
      .map((line) => `• ${localPoint(line, 260)}`);
    if (excerpts.length) return `**${workshop.label} — hỏi đáp từ transcript**\n${excerpts.join('\n')}`;
  }

  const segments = splitWorkshopChunks(workshop.contentChunks, 360);
  const selected = representativeSegments(segments, Math.min(3, segments.length));
  const points = selected.map((chunk) => `• ${localPoint(chunk.text, 140)} [${chunk.code}]`);
  if (!points.length) return '';
  const qaSegments = splitWorkshopChunks(workshop.qaChunks, 280);
  const questionIndex = qaSegments.findIndex((segment) =>
    QUESTION_RE.test(segment.text) || segment.text.includes('?'));
  const qa = questionIndex >= 0
    ? qaSegments.slice(questionIndex, questionIndex + 2)
      .map((segment, index) => `• ${index ? 'Ý trả lời: ' : ''}${localPoint(segment.text, 120)} [${segment.code}]`)
    : [];
  return [
    `**${workshop.label} — kiến thức chính**`,
    ...points,
    ...(qa.length ? ['', '**Hỏi đáp đáng chú ý**', ...qa] : []),
  ].join('\n');
}

export function findWorkshopQaSource(workshop, query, maxChars = 14000) {
  const terms = keywords(query);
  const minimumScore = terms.length ? Math.max(1, Math.ceil(terms.length * 0.5)) : 0.25;
  const candidates = workshop.qaChunks
    .map((chunk, index) => ({ chunk, index, score: score(chunk.text, terms) + (QUESTION_RE.test(chunk.text) ? 0.25 : 0) }))
    .filter((item) => item.score >= minimumScore)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3);
  const selected = new Map();
  for (const candidate of candidates) {
    const from = Math.max(0, candidate.index - 1);
    const to = Math.min(workshop.qaChunks.length, candidate.index + 4);
    for (let i = from; i < to; i += 1) selected.set(i, workshop.qaChunks[i]);
  }
  return fitChunks(
    [...selected.entries()].sort(([a], [b]) => a - b).map(([, chunk]) => chunk),
    maxChars,
    terms,
    1800,
  );
}

export function workshopNumbersFromText(value) {
  const matches = [...String(value || '').matchAll(/\b(?:workshop|w[\s._-]*s)[\s._-]*0?([12])\b/gi)];
  return [...new Set(matches.map((match) => Number(match[1])))];
}

export function workshopNumbersForContent(value, announcedNumbers = []) {
  const requested = workshopNumbersFromText(value);
  if (requested.length) return requested;
  const announced = [...new Set(announcedNumbers.filter((number) => WORKSHOPS[number]))];
  if (announced.length) return announced;
  return hasDateReference(value) ? [] : Object.keys(WORKSHOPS).map(Number);
}

export function isWorkshopQuery(value) {
  return /\bworkshop\b|\bw[\s._-]*s(?:\s*\d+)?\b/i.test(String(value || ''));
}

export function loadRelevantWorkshops(value) {
  const requested = workshopNumbersFromText(value);
  return (requested.length ? requested : Object.keys(WORKSHOPS).map(Number)).map(loadWorkshop);
}
