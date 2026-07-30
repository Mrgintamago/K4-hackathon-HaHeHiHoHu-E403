import { Client, Events, GatewayIntentBits } from 'discord.js';
import { assertEnv, config } from './config.js';
import { answerFromLearningSources } from './ai.js';
import { acquire, release } from './security.js';
import { safeQuestion } from './privacy.js';
import { startDailyReminder } from './reminders.js';
import { handleStandupButton, startStandupReminder } from './standups.js';
import { findLessonPdf, readFirstPage } from './lessons.js';
import { fetchDailyEvents } from './announcements.js';
import { acquireInstanceLock } from './single-instance.js';

acquireInstanceLock();
assertEnv();
const intents = [GatewayIntentBits.Guilds];
if (config.mentionQaEnabled) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
const client = new Client({ intents });

function requestedDate(question) {
  const explicit = question.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  if (explicit) return new Date(`${explicit[3]}-${explicit[2]}-${explicit[1]}T12:00:00+07:00`);
  const offset = /hôm qua/i.test(question) ? -1 : /ngày mai/i.test(question) ? 1 : 0;
  return new Date(Date.now() + offset * 86_400_000);
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
  try { await handleStandupButton(interaction); } catch { console.error('standup_button_failed'); }
});

client.on(Events.MessageCreate, async (message) => {
  if (!config.mentionQaEnabled || message.author.bot || message.guildId !== config.discord.guildId) return;
  if (!message.mentions.users.has(client.user.id)) return;
  if (config.discord.deniedChannelIds.has(message.channelId)) return;
  if (!config.discord.mentionAllowedChannelIds.has(message.channelId)) return;
  if (config.discord.allowedRoleIds.size && !message.member?.roles?.cache?.some((role) => config.discord.allowedRoleIds.has(role.id))) return;
  const lock = acquire(message.author.id);
  if (!lock.ok) return message.reply(lock.message);
  try {
    const question = safeQuestion(message.content, client.user.id);
    if (!question) return await message.reply('Bạn hãy hỏi về lịch hoặc nội dung PDF bài học.');
    const date = requestedDate(question);
    const sourceParts = [];
    const asksWorkshop = /workshop|\bws\b/i.test(question);
    const asksLesson = /bài|học|pdf|hôm nay|hôm qua/i.test(question) && !asksWorkshop;
    if (asksLesson || !asksWorkshop) {
      const pdf = findLessonPdf(config.lessonPdfDir, date, config.reminderTimezone);
      if (pdf) sourceParts.push(`Nội dung bài học ngày ${dateKey(date)}:\n${await readFirstPage(pdf)}`);
    }
    if (asksWorkshop && config.discord.announcementChannelId) {
      try {
        const channel = await client.channels.fetch(config.discord.announcementChannelId);
        const events = channel?.isTextBased()
          ? await fetchDailyEvents(channel, config.discord.managerRoleIds, dateKey(date)) : [];
        const workshops = events.filter((event) => event.type === 'Workshop');
        if (workshops.length) sourceParts.push(`Nội dung/mô tả Workshop ngày ${dateKey(date)}:\n${workshops.map((e) => e.description).join('\n')}`);
      } catch { console.error('announcement_read_failed'); }
    }
    const answer = await answerFromLearningSources(question, sourceParts.join('\n\n'));
    await message.reply({ content: answer, allowedMentions: { repliedUser: false, parse: [] } });
  } catch {
    console.error('mention_qa_failed');
    await message.reply('Mình chưa thể đọc lịch hoặc PDF có căn cứ lúc này.');
  } finally { release(message.author.id); }
});

client.login(config.discord.token);
