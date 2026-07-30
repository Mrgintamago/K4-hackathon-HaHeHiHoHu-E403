import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

export const PARTS = Object.freeze({
  'sang-bai-toan': { file: 'transcript-01-clean.md', prefix: 'T01', label: 'Day 2 sáng — Xác định bài toán' },
  'chi-so-tu-dong-hoa': { file: 'transcript-02-clean.md', prefix: 'T02', label: 'Day 2 — Chỉ số và tự động hoá' },
  'chieu-rang-buoc': { file: 'transcript-03-clean.md', prefix: 'T03', label: 'Day 2 chiều — Ràng buộc và workflow' },
});

const CHUNK_RE = /\*\*\[(T\d{2}-\d{3})\]\*\*\s*([\s\S]*?)(?=\n\*\*\[T\d{2}-\d{3}\]\*\*|\n## |$)/g;

export function loadPart(key) {
  const part = PARTS[key];
  if (!part) throw new Error('Phần Day 2 không hợp lệ');
  const filePath = path.resolve(config.transcriptDir, part.file);
  if (!filePath.startsWith(path.resolve(config.transcriptDir) + path.sep)) throw new Error('Đường dẫn transcript không an toàn');
  const raw = fs.readFileSync(filePath, 'utf8');
  const chunks = [...raw.matchAll(CHUNK_RE)].map((m) => ({ code: m[1], text: m[2].replace(/\s+/g, ' ').trim() }));
  if (!chunks.length || chunks.some((c) => !c.code.startsWith(part.prefix))) throw new Error('Transcript sai định dạng');
  const context = chunks.map((c) => `[${c.code}] ${c.text}`).join('\n');
  return { ...part, chunks, context: context.slice(0, config.maxContextChars), truncated: context.length > config.maxContextChars };
}

export function validateCitations(result, part, validCodes) {
  if (!result || !Array.isArray(result.key_points) || result.key_points.length < 2) return false;
  return result.key_points.every((point) =>
    typeof point.text === 'string' && point.text.length > 0 && point.text.length <= 500 &&
    Array.isArray(point.citations) && point.citations.length > 0 &&
    point.citations.every((code) => code.startsWith(part.prefix) && validCodes.has(code))
  );
}

