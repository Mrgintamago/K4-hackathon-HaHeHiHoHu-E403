import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { findLessonPdf, readFirstPages, dayDates } from './lessons.js';
import { summarizeLessonPage, summarizeWorkshopDaily } from './ai.js';
import { fetchDailyEvents } from './announcements.js';
import { buildWorkshopSummarySource, loadWorkshop } from './workshops.js';

const codebaseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function dateKey(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: config.reminderTimezone, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date).replaceAll('/', '.');
}

export function localLessonSummary(text) {
  const raw = String(text || '');
  const pages = new Map([...raw.matchAll(/\[Trang (\d+)\]\s*([\s\S]*?)(?=\n\[Trang \d+\]|$)/g)]
    .map((match) => [Number(match[1]), match[2].trim()]));
  const parts = String(pages.get(1) || raw).split(/\s*·\s*/)
    .map((part) => part.replace(/\s*Tên Giảng Viên.*$/i, '').trim())
    .filter((part) => part && !/^tên giảng viên\b/i.test(part));
  const overview = parts.slice(0, 4).join(' · ');
  const focus = (pages.get(2) || '').replace(/^\?\s*HÃY SUY NGHĨ\.{0,3}\s*/i, '').slice(0, 100);
  const topics = (pages.get(3) || '')
    .replace(/^.*?Nội Dung Bài Học\s*/i, '')
    .replace(/\s+Giảng viên.*$/i, '')
    .slice(0, 180);
  return [
    overview,
    focus ? `Câu hỏi trọng tâm: ${focus}` : '',
    topics ? `Nội dung: ${topics}` : '',
  ].filter(Boolean).join(' · ').slice(0, 360)
    || 'Đã tìm thấy PDF nhưng trang đầu không có nội dung chữ để tóm tắt.';
}

async function lessonLine(label, date) {
  const file = findLessonPdf(config.lessonPdfDir, date, config.reminderTimezone);
  if (!file) return `• ${label}: không có PDF bài học đúng định dạng.`;
  const fileLabel = path.basename(file, '.pdf').split('-')[0];
  try {
    const firstPages = await readFirstPages(file);
    try {
      const summary = await summarizeLessonPage(firstPages);
      return `• ${label} (${fileLabel}): ${summary || localLessonSummary(firstPages)}`;
    } catch (error) {
      console.error('lesson_summary_ai_failed', error?.name || 'UNKNOWN');
      return `• ${label} (${fileLabel}): ${localLessonSummary(firstPages)} _(tóm tắt cục bộ)_`;
    }
  } catch (error) {
    console.error('lesson_pdf_read_failed', error?.name || 'UNKNOWN');
    return `• ${label} (${fileLabel}): chưa thể đọc trang đầu PDF.`;
  }
}

async function workshopLines(label, number) {
  try {
    const workshop = loadWorkshop(number);
    const summary = await summarizeWorkshopDaily(buildWorkshopSummarySource(workshop), workshop.label);
    return summary ? [`**${label} — ${workshop.label}**`, summary] : [];
  } catch {
    console.error('daily_workshop_summary_failed', number);
    return [`**${label} — Workshop ${number}**`, 'Chưa thể tạo tóm tắt an toàn lúc này.'];
  }
}

export async function buildDailyReminder(client, now = new Date()) {
  const { today, yesterday } = dayDates(now);
  const lines = [
    '☀️ **Nhắc học tập hằng ngày**',
    await lessonLine('Hôm qua đã học', yesterday),
    await lessonLine('Bài hôm nay', today),
  ];
  lines.push(
    '',
    ...await workshopLines('Hôm qua', 2),
  );
  if (config.discord.announcementChannelId) {
    const channel = await client.channels.fetch(config.discord.announcementChannelId);
    if (channel?.isTextBased()) {
      const events = await fetchDailyEvents(channel, config.discord.managerRoleIds, dateKey(today));
      if (events.length) {
        lines.push('', '**Lịch hôm nay**');
        for (const event of events) lines.push(`• ${event.time ? `${event.time} — ` : ''}${event.type}: ${event.description}`);
      }
    }
  }
  return lines.join('\n').slice(0, 1950);
}

export function startDailyReminder(client) {
  const stateFile = path.join(codebaseDir, 'data-private/reminder-state.json');
  let lastSent = '';
  try { lastSent = JSON.parse(fs.readFileSync(stateFile, 'utf8')).lastSent || ''; } catch { /* Chưa có state. */ }
  const check = async () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.reminderTimezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const value = (type) => parts.find((p) => p.type === type)?.value;
    const day = `${value('year')}-${value('month')}-${value('day')}`;
    const scheduleKey = `${day}@${String(config.reminderHour).padStart(2, '0')}:${String(config.reminderMinute).padStart(2, '0')}`;
    const current = Number(value('hour')) * 60 + Number(value('minute'));
    const scheduled = config.reminderHour * 60 + config.reminderMinute;
    if (current < scheduled || lastSent === scheduleKey) return;
    const content = await buildDailyReminder(client);
    const channelIds = config.discord.userPersonalChannelMap.size
      ? new Set(config.discord.userPersonalChannelMap.values()) : new Set([config.discord.reminderChannelId]);
    let sent = 0;
    for (const channelId of channelIds) {
      const channel = await client.channels.fetch(channelId);
      if (channel?.isTextBased()) {
        await channel.send({ content, allowedMentions: { parse: [] } });
        sent += 1;
      }
    }
    if (!sent) return;
    lastSent = scheduleKey;
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ lastSent, sentAt: new Date().toISOString(), sentCount: sent }), { encoding: 'utf8', mode: 0o600 });
    console.log('daily_reminder_sent', sent);
  };
  check().catch(() => console.error('daily_reminder_failed'));
  return setInterval(() => check().catch(() => console.error('daily_reminder_failed')), 60_000);
}
