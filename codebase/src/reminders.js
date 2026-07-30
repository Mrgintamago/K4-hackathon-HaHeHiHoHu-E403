import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { findLessonPdf, readFirstPage, dayDates } from './lessons.js';
import { summarizeLessonPage } from './ai.js';
import { fetchDailyEvents } from './announcements.js';

function dateKey(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: config.reminderTimezone, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date).replaceAll('/', '.');
}

async function lessonLine(label, date) {
  const file = findLessonPdf(config.lessonPdfDir, date, config.reminderTimezone);
  if (!file) return `• ${label}: không có PDF bài học đúng định dạng.`;
  try {
    const summary = await summarizeLessonPage(await readFirstPage(file));
    return `• ${label} (${path.basename(file, '.pdf').split('-')[0]}): ${summary || 'chưa thể tạo tóm tắt.'}`;
  } catch {
    return `• ${label} (${path.basename(file, '.pdf').split('-')[0]}): AI đang giới hạn lượt gọi, chưa thể tạo tóm tắt an toàn.`;
  }
}

export async function buildDailyReminder(client, now = new Date()) {
  const { today, yesterday } = dayDates(now);
  const lines = [
    '☀️ **Nhắc học tập hằng ngày**',
    await lessonLine('Hôm qua đã học', yesterday),
    await lessonLine('Bài hôm nay', today),
  ];
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
  const stateFile = path.resolve('data-private/reminder-state.json');
  let lastSent = '';
  try { lastSent = JSON.parse(fs.readFileSync(stateFile, 'utf8')).lastSent || ''; } catch { /* Chưa có state. */ }
  const check = async () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.reminderTimezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const value = (type) => parts.find((p) => p.type === type)?.value;
    const key = `${value('year')}-${value('month')}-${value('day')}`;
    const current = Number(value('hour')) * 60 + Number(value('minute'));
    const scheduled = config.reminderHour * 60 + config.reminderMinute;
    if (current < scheduled || lastSent === key) return;
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
    lastSent = key;
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ lastSent, sentAt: new Date().toISOString(), sentCount: sent }), { encoding: 'utf8', mode: 0o600 });
    console.log('daily_reminder_sent', sent);
  };
  check().catch(() => console.error('daily_reminder_failed'));
  return setInterval(() => check().catch(() => console.error('daily_reminder_failed')), 60_000);
}
