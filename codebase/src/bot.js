import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { assertEnv, config } from './config.js';
import { answerFromLearningSources, summarizeWorkshop } from './ai.js';
import { acquire, release } from './security.js';
import { safeQuestion } from './privacy.js';
import { localLessonSummary, startDailyReminder } from './reminders.js';
import { handleStandupButton, startStandupReminder } from './standups.js';
import {
  findLessonPdf,
  lessonDateForPdf,
  lessonLinkForPdf,
  lessonNumberForPdf,
  listLessonPdfs,
  readFirstPages,
} from './lessons.js';
import { fetchDailyEvents, fetchWeeklyEvents } from './announcements.js';
import { acquireInstanceLock } from './single-instance.js';
import {
  classifyQuery,
  dateReferenceCount,
  hasAmbiguousDateReference,
  requestedDate,
  requestedLessonDates,
  requestsAllLessons,
  SCHEDULE_PATTERN,
} from './query-intents.js';
import {
  buildLocalWorkshopFallback,
  buildWorkshopSummarySource,
  findWorkshopQaSource,
  isWorkshopQuery,
  loadWorkshop,
  WORKSHOPS,
  workshopNumbersForContent,
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
    await accessNotice(message, 'role', 'Chỉ thành viên có role Learner mới được sử dụng trợ lý.');
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
    const workshopSummaryTargets = [];
    const asksWorkshop = isWorkshopQuery(question);
    const { asksLesson, asksSchedule, asksWeeklySchedule } = classifyQuery(question);
    const requestsLessonContent = asksLesson || (!asksWorkshop && !asksSchedule);
    if (requestsLessonContent && hasAmbiguousDateReference(question)) {
      return await message.reply('Mình chưa xác định được ngày bài học. Bạn hãy ghi một ngày cụ thể theo dạng dd/mm/yyyy.');
    }
    const lessonDates = requestsLessonContent ? requestedLessonDates(question) : [];
    if (lessonDates.length > 2) {
      return await message.reply('Bạn có thể yêu cầu tối đa hai bài học trong mỗi câu hỏi.');
    }
    if (lessonDates.some((date) => !date)) {
      return await message.reply('Ngày bài học bạn hỏi không hợp lệ. Hãy ghi ngày theo dạng dd/mm/yyyy.');
    }
    const scheduleDate = requestedDate(question, SCHEDULE_PATTERN);
    if (asksSchedule && !scheduleDate) {
      return await message.reply('Ngày lịch bạn hỏi không hợp lệ. Hãy ghi ngày theo dạng dd/mm/yyyy.');
    }
    const groundedFallbackParts = [];
    const lessonAppendices = [];
    let foundLessons = 0;
    let missingLessons = 0;
    if (requestsLessonContent) {
      let lessonTargets;
      if (requestsAllLessons(question) && dateReferenceCount(question) === 0) {
        const files = listLessonPdfs(config.lessonPdfDir);
        const dates = files.map(lessonDateForPdf);
        if (files.length !== 2 || dates.some((date) => !date)
          || new Set(dates.map((date) => dateKey(date))).size !== 2) {
          return await message.reply('Mình chưa xác định được đúng hai bài. Bạn hãy ghi rõ hai ngày cần tóm tắt.');
        }
        lessonTargets = files.map((pdf, index) => ({ date: dates[index], pdf }));
      } else {
        lessonTargets = lessonDates.map((date) => ({
          date,
          pdf: findLessonPdf(config.lessonPdfDir, date, config.reminderTimezone),
        }));
      }
      for (const { date: lessonDate, pdf } of lessonTargets) {
        const lessonDateKey = dateKey(lessonDate);
        if (pdf) {
          foundLessons += 1;
          const lessonNumber = lessonNumberForPdf(pdf);
          const lessonLabel = lessonNumber
            ? `Ngày học ${lessonNumber}, ngày ${lessonDateKey}`
            : `Bài học ngày ${lessonDateKey}`;
          const firstPages = await readFirstPages(pdf);
          sourceParts.push(`${lessonLabel} — nội dung 3 trang đầu:\n${firstPages}`);
          groundedFallbackParts.push(`**${lessonLabel}**\n${localLessonSummary(firstPages)} _(tóm tắt cục bộ)_`);
          const lessonLink = lessonLinkForPdf(pdf);
          lessonAppendices.push([
            lessonNumber ? `📘 **Ngày ${lessonNumber} — ${lessonDateKey}**` : `📘 **Bài học — ${lessonDateKey}**`,
            lessonLink ? `🔗 [Mở bài học trên VLearn](${lessonLink})` : '',
          ].filter(Boolean).join('\n'));
        } else {
          missingLessons += 1;
          const missingLesson = `Mình không có dữ liệu bài học đúng ngày ${lessonDateKey}.`;
          sourceParts.push(`Bài học ngày ${lessonDateKey}: không có PDF đúng ngày trong dữ liệu được phép.`);
          groundedFallbackParts.push(missingLesson);
          console.error('lesson_not_found', lessonDateKey, config.lessonPdfDir);
        }
      }
    }
    if (asksSchedule && config.discord.announcementChannelId) {
      try {
        const channel = await client.channels.fetch(config.discord.announcementChannelId);
        const events = channel?.isTextBased()
          ? asksWeeklySchedule
            ? await fetchWeeklyEvents(channel, config.discord.managerRoleIds, scheduleDate, config.reminderTimezone)
            : await fetchDailyEvents(channel, config.discord.managerRoleIds, dateKey(scheduleDate))
          : [];
        if (events.length) {
          const eventLines = events.map((event) =>
            `${event.dateKey}${event.time ? ` ${event.time}` : ''} — ${event.type}: ${event.description}`);
          const heading = asksWeeklySchedule
            ? `Lịch chính thức trong tuần chứa ngày ${dateKey(scheduleDate)}`
            : `Lịch chính thức ngày ${dateKey(scheduleDate)}`;
          sourceParts.push(`${heading}:\n${eventLines.join('\n')}`);
          groundedFallbackParts.push(`Theo thông báo chính thức, ${heading.toLowerCase()}:\n${eventLines
            .map((line) => `• ${line}`)
            .join('\n')}`);
        } else if (channel?.isTextBased()) {
          const scope = asksWeeklySchedule
            ? `tuần chứa ngày ${dateKey(scheduleDate)}`
            : `ngày ${dateKey(scheduleDate)}`;
          sourceParts.push(`Lịch chính thức ${scope}: không tìm thấy sự kiện phù hợp trong thông báo được phép.`);
          groundedFallbackParts.push(`Mình chưa tìm thấy sự kiện trong thông báo chính thức cho ${scope}.`);
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
      const transcriptNumbers = workshopNumbersForContent(question, announcedWorkshopNumbers);
      for (const workshop of transcriptNumbers.map(loadWorkshop)) {
        const source = asksQa
          ? findWorkshopQaSource(workshop, question)
          : buildWorkshopSummarySource(workshop);
        if (source) {
          sourceParts.push(`${workshop.label}${asksQa ? ' — hỏi đáp theo chủ đề' : ' — nội dung trình bày'}:\n${source}`);
          const fallback = buildLocalWorkshopFallback(workshop, asksQa ? source : '');
          groundedFallbackParts.push(fallback);
          if (!asksQa) workshopSummaryTargets.push({ workshop, source, fallback });
        }
      }
    }
    let answer;
    if (workshopSummaryTargets.length && !requestsLessonContent && !asksQa) {
      const summaries = [];
      for (const { workshop, source, fallback } of workshopSummaryTargets) {
        try {
          const summary = await summarizeWorkshop(source, workshop.label);
          summaries.push(`**${workshop.label}**\n${summary || fallback}`);
        } catch (error) {
          console.error('workshop_summary_failed', workshop.number, error?.code || error?.name || 'UNKNOWN');
          summaries.push(fallback);
        }
      }
      answer = summaries.join('\n\n').slice(0, 1900);
    } else if (missingLessons > 0 && foundLessons === 0 && !asksWorkshop && !asksSchedule) {
      answer = groundedFallbackParts.join('\n\n');
    } else {
      try {
        answer = await answerFromLearningSources(question, sourceParts.join('\n\n'));
        if (/^Mình (?:chưa tìm thấy|chưa thể tạo)/i.test(answer) && groundedFallbackParts.length) {
          answer = groundedFallbackParts.join('\n\n');
        }
      } catch (error) {
        console.error('learning_answer_failed', error?.code || error?.name || 'UNKNOWN');
        if (!groundedFallbackParts.length) throw error;
        answer = groundedFallbackParts.join('\n\n');
      }
    }
    if (lessonAppendices.length) {
      const appendix = `\n\n${lessonAppendices.join('\n')}`;
      answer = `${answer.slice(0, 1900 - appendix.length)}${appendix}`;
    }
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
