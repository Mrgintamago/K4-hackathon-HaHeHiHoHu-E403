export const LESSON_PATTERN = /\b(bài|học|pdf)\b/i;
export const SCHEDULE_PATTERN = /\b(lịch|workshop|office\s*hours?|mentor\s*duty)\b/i;
export const WEEKLY_PATTERN = /\b(hàng tuần|trong tuần|tuần này|lịch tuần)\b/i;

export function requestedDate(question, intentPattern = null, now = new Date()) {
  const explicit = String(question || '').match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}))?\b/);
  if (explicit) {
    const currentYear = Number(new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric',
    }).format(now));
    const day = Number(explicit[1]);
    const month = Number(explicit[2]);
    const year = Number(explicit[3] || currentYear);
    const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+07:00`);
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return date;
  }
  const relevant = intentPattern
    ? String(question || '').split(/[,.?!;\n]+/).find((part) => intentPattern.test(part)) || question
    : question;
  const offset = /hôm qua/i.test(relevant) ? -1 : /ngày mai/i.test(relevant) ? 1 : 0;
  return new Date(now.getTime() + offset * 86_400_000);
}

export function classifyQuery(question) {
  return {
    asksLesson: LESSON_PATTERN.test(question),
    asksSchedule: SCHEDULE_PATTERN.test(question),
    asksWeeklySchedule: SCHEDULE_PATTERN.test(question) && WEEKLY_PATTERN.test(question),
  };
}
