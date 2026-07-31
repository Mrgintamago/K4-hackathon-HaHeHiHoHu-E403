export const LESSON_PATTERN = /\b(bài|học|pdf)\b/i;
export const SCHEDULE_PATTERN = /\b(lịch|workshop|office\s*hours?|mentor\s*duty)\b/i;
export const WEEKLY_PATTERN = /\b(hàng tuần|trong tuần|tuần này|lịch tuần)\b/i;

export function requestedDate(question, intentPattern = null, now = new Date()) {
  const explicit = String(question || '').match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  if (explicit) return new Date(`${explicit[3]}-${explicit[2]}-${explicit[1]}T12:00:00+07:00`);
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
