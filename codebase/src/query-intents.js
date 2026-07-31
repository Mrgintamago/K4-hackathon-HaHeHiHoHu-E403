export const LESSON_PATTERN = /\b(bài|bai|học|hoc|pdf)\b/i;
export const SCHEDULE_PATTERN = /\b(lịch|lich|workshop|office\s*hours?|mentor\s*duty)\b/i;
export const WEEKLY_PATTERN = /\b(hàng tuần|hang tuan|trong tuần|trong tuan|tuần này|tuan nay|lịch tuần|lich tuan)\b/i;

const DAY_MS = 86_400_000;
const ABSOLUTE_DATE_RE = /\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?\b/g;
const TEXTUAL_DATE_RE = /\b(?:ngày|ngay)?\s*(\d{1,2})\s+(?:tháng|thang)\s+(\d{1,2})(?:\s+(?:năm|nam)\s+(\d{4}))?\b/gi;
const RELATIVE_DATE_RE = /\b(hôm kia|hom kia|bữa kia|bua kia|hkia|hôm qua|hom qua|bữa qua|bua qua|hqua|hôm nay|hom nay|ngày mai|ngay mai|ngày kia|ngay kia|ngày mốt|ngay mot|(\d{1,3})\s*(?:ngày|ngay)\s*(?:trước|truoc)|(\d{1,3})\s*(?:ngày|ngay)\s*(?:nữa|nua))\b/gi;
const AMBIGUOUS_DATE_RE = /\b(tuần trước|tuan truoc|tháng trước|thang truoc|hôm trước|hom truoc|mấy hôm trước|may hom truoc|đầu tuần|dau tuan|cuối tuần|cuoi tuan|bài cũ|bai cu|bài trước|bai truoc|buổi trước|buoi truoc|gần nhất|gan nhat|mới nhất|moi nhat|thứ\s*(?:hai|ba|tư|tu|năm|nam|sáu|sau|bảy|bay|[2-7]))\b/i;

function currentYear(now) {
  return Number(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric',
  }).format(now));
}

function absoluteDate(match, now) {
  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = match[3];
  const year = rawYear ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear) : currentYear(now);
  const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+07:00`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return value('year') === year && value('month') === month && value('day') === day ? date : null;
}

function dateReferences(question, now) {
  const value = String(question || '');
  const references = [];
  for (const match of value.matchAll(ABSOLUTE_DATE_RE)) {
    references.push({ index: match.index, length: match[0].length, date: absoluteDate(match, now) });
  }
  for (const match of value.matchAll(TEXTUAL_DATE_RE)) {
    references.push({ index: match.index, length: match[0].length, date: absoluteDate(match, now) });
  }
  for (const match of value.matchAll(RELATIVE_DATE_RE)) {
    const token = match[1].toLocaleLowerCase('vi');
    const offset = /^(?:hôm kia|hom kia|bữa kia|bua kia|hkia)$/.test(token)
      ? -2
      : /^(?:hôm qua|hom qua|bữa qua|bua qua|hqua)$/.test(token)
        ? -1
        : /^(?:hôm nay|hom nay)$/.test(token)
          ? 0
          : /^(?:ngày mai|ngay mai)$/.test(token)
            ? 1
            : /^(?:ngày kia|ngay kia|ngày mốt|ngay mot)$/.test(token)
              ? 2
              : match[2]
                ? -Number(match[2])
                : Number(match[3]);
    references.push({
      index: match.index,
      length: match[0].length,
      date: new Date(now.getTime() + offset * DAY_MS),
    });
  }
  return references.sort((a, b) => a.index - b.index);
}

export function hasDateReference(question, now = new Date()) {
  return dateReferences(question, now).length > 0;
}

export function dateReferenceCount(question, now = new Date()) {
  return dateReferences(question, now).length;
}

export function hasAmbiguousDateReference(question, now = new Date()) {
  return !hasDateReference(question, now) && AMBIGUOUS_DATE_RE.test(String(question || ''));
}

function uniqueDates(references) {
  const seen = new Set();
  return references.map((reference) => reference.date).filter((date) => {
    const key = date ? date.toISOString() : 'invalid';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function requestsAllLessons(question) {
  return /\b(?:cả\s*hai|ca\s*hai|hai|2)\s+(?:bài|bai)(?:\s+học|\s+hoc)?\b/i.test(String(question || ''));
}

export function requestedLessonDates(question, now = new Date()) {
  const value = String(question || '');
  const allReferences = dateReferences(value, now);
  if (!allReferences.length) return [new Date(now)];

  const hasLessonIntent = LESSON_PATTERN.test(value);
  const hasScheduleIntent = SCHEDULE_PATTERN.test(value);
  if (!hasLessonIntent && !hasScheduleIntent) return uniqueDates(allReferences);

  const clauses = value.split(/[,.?!;\n]+|\s+(?:và|còn|nhưng|đồng thời)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const selected = [];
  let activeIntent = null;
  for (const clause of clauses) {
    const lesson = LESSON_PATTERN.test(clause);
    const schedule = SCHEDULE_PATTERN.test(clause);
    if (lesson && !schedule) activeIntent = 'lesson';
    else if (schedule && !lesson) activeIntent = 'schedule';
    const references = dateReferences(clause, now);
    if (lesson || (!schedule && activeIntent === 'lesson')) selected.push(...references);
  }
  if (selected.length) return uniqueDates(selected);
  if (hasLessonIntent && !hasScheduleIntent) return uniqueDates(allReferences);
  return [new Date(now)];
}

export function requestedDate(question, intentPattern = null, now = new Date()) {
  const value = String(question || '');
  const clauses = intentPattern
    ? value.split(/[,.?!;\n]+|\s+(?:và|còn|nhưng|đồng thời)\s+/i).map((part) => part.trim()).filter(Boolean)
    : [];
  const scoped = clauses.find((part) => intentPattern.test(part) && dateReferences(part, now).length);
  const relevant = scoped || value;
  const references = dateReferences(relevant, now);
  if (!references.length) return new Date(now);
  if (!intentPattern || references.length === 1) return references[0].date;

  const flags = [...new Set(`${intentPattern.flags}g`)].join('');
  const intents = [...relevant.matchAll(new RegExp(intentPattern.source, flags))];
  if (!intents.length) return references[0].date;
  const intentCenters = intents.map((intent) => intent.index + intent[0].length / 2);
  return references.reduce((closest, reference) => {
    const referenceCenter = reference.index + reference.length / 2;
    const distance = Math.min(...intentCenters.map((center) => Math.abs(referenceCenter - center)));
    return distance < closest.distance ? { reference, distance } : closest;
  }, { reference: references[0], distance: Number.POSITIVE_INFINITY }).reference.date;
}

export function classifyQuery(question) {
  return {
    asksLesson: LESSON_PATTERN.test(question),
    asksSchedule: SCHEDULE_PATTERN.test(question),
    asksWeeklySchedule: SCHEDULE_PATTERN.test(question) && WEEKLY_PATTERN.test(question),
  };
}
