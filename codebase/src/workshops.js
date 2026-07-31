import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { redactPii } from './privacy.js';

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

export function buildWorkshopSummarySource(workshop, maxChars = 18000) {
  const content = workshop.contentChunks;
  const target = Math.min(28, content.length);
  const sampled = [];
  for (let i = 0; i < target; i += 1) {
    const index = Math.floor(i * content.length / target);
    if (content[index] && sampled.at(-1) !== content[index]) sampled.push(content[index]);
  }
  const questions = workshop.qaChunks.filter((chunk) => QUESTION_RE.test(chunk.text)).slice(0, 6);
  const main = fitChunks(sampled, Math.floor(maxChars * 0.72), [], 650);
  const qa = fitChunks(questions, maxChars - main.length - 50, ['hỏi', 'câu hỏi'], 900);
  return `${main}\n\n<CÂU_HỎI_CUỐI_BUỔI>\n${qa || 'Không nhận diện được câu hỏi.'}`.slice(0, maxChars);
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

export function isWorkshopQuery(value) {
  return /\bworkshop\b|\bw[\s._-]*s(?:\s*\d+)?\b/i.test(String(value || ''));
}

export function loadRelevantWorkshops(value) {
  const requested = workshopNumbersFromText(value);
  return (requested.length ? requested : Object.keys(WORKSHOPS).map(Number)).map(loadWorkshop);
}
