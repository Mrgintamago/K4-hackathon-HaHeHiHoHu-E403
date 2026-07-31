import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { assertEnv, config } from './config.js';
import { answerFromLearningSources } from './ai.js';
import { acquire, release } from './security.js';
import { safeQuestion } from './privacy.js';
import { startDailyReminder } from './reminders.js';
import { handleStandupButton, startStandupReminder } from './standups.js';
import { findLessonPdf, readFirstPages } from './lessons.js';
import { fetchDailyEvents } from './announcements.js';
import { acquireInstanceLock } from './single-instance.js';
import { classifyQuery, LESSON_PATTERN, requestedDate, SCHEDULE_PATTERN } from './query-intents.js';
import {
  buildWorkshopSummarySource,
  findWorkshopQaSource,
  isWorkshopQuery,
  loadWorkshop,
  WORKSHOPS,
  workshopNumbersFromText,
} from './workshops.js';

acquireInstanceLock();
assertEnv();
const intents = [GatewayIntentBits.Guilds];
if (config.mentionQaEnabled) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
const client = new Client({ intents });
const accessNotices = new Map();

async function accessNotice(message, reason, content) {
  const key = `${reason}:${message.author.id}`;
  const now = Date.now();
  if (now - (accessNotices.get(key) || 0) < 5 * 60_000) return;
  accessNotices.set(key, now);
  await message.reply({ content, allowedMentions: { repliedUser: false, parse: [] } });
}

function dateKey(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: config.reminderTimezone, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date).replaceAll('/', '.');
}

client.once(Events.ClientReady, (bot) => {
  console.log(`Bot online: ${bot.user.tag}`);
  if (config.dailyReminderEnabled) startDailyReminder(client);
  if (config.standupEnabled) startStandupReminder(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try { await handleStandupButton(interaction); } catch { console.error('standup_interaction_failed'); }
});

client.on(Events.MessageCreate, async (message) => {
  if (!config.mentionQaEnabled || message.author.bot || message.guildId !== config.discord.guildId) return;
  if (!message.mentions.users.has(client.user.id)) return;
  const channelIds = [message.channelId, message.channel?.parentId].filter(Boolean);
  if (channelIds.some((id) => config.discord.deniedChannelIds.has(id))) return;
  const sendPermission = message.channel?.isThread?.()
    ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
  const canReply = message.channel?.permissionsFor?.(message.guild.members.me)
    ?.has([PermissionFlagsBits.ViewChannel, sendPermission]) === true;
  if (!canReply) {
    console.error('authorization_blocked', 'bot_missing_channel_permission');
    return;
  }
  if (!channelIds.some((id) => config.discord.mentionAllowedChannelIds.has(id))) {
    await accessNotice(message, 'channel', 'Bot chưa được bật trong channel này. Bạn hãy hỏi trong channel học tập được phép.');
    return;
  }
  if (config.discord.allowedRoleIds.size && !message.member?.roles?.cache?.some((role) => config.discord.allowedRoleIds.has(role.id))) {
    await accessNotice(message, 'role', 'Bạn chưa có quyền sử dụng trợ lý trong channel này. Nếu cần hỗ trợ, hãy liên hệ quản lý lớp.');
    return;
  }
  const lock = acquire(message.author.id);
  if (!lock.ok) return message.reply({
    content: lock.message,
    allowedMentions: { repliedUser: false, parse: [] },
  });
  try {
    const question = safeQuestion(message.content, client.user.id);
    if (!question) return await message.reply('Bạn hãy hỏi về lịch hoặc nội dung PDF bài học.');
    const sourceParts = [];
    const announcedWorkshopNumbers = [];
    const asksWorkshop = isWorkshopQuery(question);
    const { asksLesson, asksSchedule } = classifyQuery(question);
    const lessonDate = requestedDate(question, LESSON_PATTERN);
    const scheduleDate = requestedDate(question, SCHEDULE_PATTERN);
    if (asksLesson || (!asksWorkshop && !asksSchedule)) {
      const pdf = findLessonPdf(config.lessonPdfDir, lessonDate, config.reminderTimezone);
      if (pdf) sourceParts.push(`Nội dung 3 trang đầu PDF bài học ngày ${dateKey(lessonDate)}:\n${await readFirstPages(pdf)}`);
    }
    if (asksSchedule && config.discord.announcementChannelId) {
      try {
        const channel = await client.channels.fetch(config.discord.announcementChannelId);
        const events = channel?.isTextBased()
          ? await fetchDailyEvents(channel, config.discord.managerRoleIds, dateKey(scheduleDate)) : [];
        if (events.length) {
          sourceParts.push(`Lịch chính thức ngày ${dateKey(scheduleDate)}:\n${events
            .map((event) => `${event.time ? `${event.time} — ` : ''}${event.type}: ${event.description}`)
            .join('\n')}`);
        } else if (channel?.isTextBased()) {
          sourceParts.push(`Lịch chính thức ngày ${dateKey(scheduleDate)}: không tìm thấy sự kiện phù hợp trong thông báo được phép.`);
        }
        const workshops = events.filter((event) => event.type === 'Workshop');
        if (workshops.length) {
          announcedWorkshopNumbers.push(...workshops.map((event) => event.workshopNumber).filter((number) => WORKSHOPS[number]));
        }
      } catch { console.error('announcement_read_failed'); }
    }
    const asksQa = /hỏi|câu hỏi|q\s*&\s*a|qa|thắc mắc|chủ đề/i.test(question);
    const asksWorkshopContent = asksWorkshop
      && (/tóm tắt|nội dung|đã nói|trình bày/i.test(question) || asksQa || workshopNumbersFromText(question).length > 0)
      && !/\b(lịch|mấy giờ|khi nào|có workshop không)\b/i.test(question);
    if (asksWorkshopContent) {
      const explicitNumbers = workshopNumbersFromText(question);
      const transcriptNumbers = explicitNumbers.length
        ? explicitNumbers
        : announcedWorkshopNumbers.length
          ? [...new Set(announcedWorkshopNumbers)]
          : asksQa ? Object.keys(WORKSHOPS).map(Number) : [];
      for (const workshop of transcriptNumbers.map(loadWorkshop)) {
        const source = asksQa
          ? findWorkshopQaSource(workshop, question)
          : buildWorkshopSummarySource(workshop);
        if (source) sourceParts.push(`${workshop.label}${asksQa ? ' — hỏi đáp theo chủ đề' : ' — nội dung trình bày'}:\n${source}`);
      }
    }
    const answer = await answerFromLearningSources(question, sourceParts.join('\n\n'));
    await message.reply({ content: answer, allowedMentions: { repliedUser: false, parse: [] } });
  } catch {
    console.error('mention_qa_failed');
    await message.reply('Mình chưa thể đọc lịch hoặc PDF có căn cứ lúc này.');
  } finally { release(message.author.id); }
});

async function loginWithRetry(attempt = 1) {
  try {
    await client.login(config.discord.token);
  } catch (error) {
    const code = error?.code || error?.cause?.code || 'UNKNOWN';
    const retryMs = Math.min(60_000, 5_000 * (2 ** Math.min(attempt - 1, 4)));
    console.error('discord_login_failed', code, `retry_in_ms=${retryMs}`);
    try { client.destroy(); } catch { /* Client chưa kết nối hoàn chỉnh. */ }
    setTimeout(() => loginWithRetry(attempt + 1), retryMs);
  }
}

loginWithRetry();
