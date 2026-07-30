import fs from 'node:fs';
import path from 'node:path';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from './config.js';
import { redactPii } from './privacy.js';

const stateFile = path.resolve('data-private/standup-state.json');

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.reminderTimezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function messageText(message) {
  return [message.content, ...message.embeds.flatMap((embed) => [embed.title, embed.description, ...(embed.fields || []).flatMap((f) => [f.name, f.value])])]
    .filter(Boolean).join('\n');
}

export function parseStandup(raw) {
  const text = String(raw || '').replace(/\r/g, '').replace(/[*_#]/g, '');
  if (!/✅\s*Stand-up đã ghi nhận/i.test(text)) return null;
  const userId = text.match(/<@!?(\d{17,20})>/)?.[1];
  const team = text.match(/\b[tT]-?(\d{2,6})\b/)?.[1];
  const yesterdayLabel = /Hôm qua/i.exec(text);
  const todayLabel = yesterdayLabel ? /Hôm nay/i.exec(text.slice(yesterdayLabel.index + yesterdayLabel[0].length)) : null;
  if (todayLabel) todayLabel.index += yesterdayLabel.index + yesterdayLabel[0].length;
  const blockerLabel = todayLabel ? /Blocker/i.exec(text.slice(todayLabel.index + todayLabel[0].length)) : null;
  if (blockerLabel) blockerLabel.index += todayLabel.index + todayLabel[0].length;
  const clean = (value) => value?.replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s+/g, ' ').trim();
  const yesterday = yesterdayLabel && todayLabel
    ? clean(text.slice(yesterdayLabel.index + yesterdayLabel[0].length, todayLabel.index)) : '';
  const today = todayLabel && blockerLabel
    ? clean(text.slice(todayLabel.index + todayLabel[0].length, blockerLabel.index)) : '';
  const blocker = blockerLabel
    ? clean(text.slice(blockerLabel.index + blockerLabel[0].length).split(/Hôm nay lúc|Today at/i)[0]) : '';
  if (!userId || !yesterday || !today || !blocker) return null;
  return { userId, team: team ? `T${team}` : '', yesterday: redactPii(yesterday).slice(0, 350), today: redactPii(today).slice(0, 350), blocker: redactPii(blocker).slice(0, 200) };
}

function buttons(ownerId, date) {
  const make = (status, label, style) => new ButtonBuilder().setCustomId(`standup:${status}:${ownerId}:${date}`).setLabel(label).setStyle(style);
  return [new ActionRowBuilder().addComponents(
    make('done', 'Đã làm', ButtonStyle.Success), make('pending', 'Chưa xong', ButtonStyle.Secondary), make('blocked', 'Có blocker', ButtonStyle.Danger),
  )];
}

function card(item) {
  return `🧪 **DEMO STANDUP · ${item.team || 'TEAM'}**\n👤 <@${item.userId}>\n\n**Việc hôm qua**\n${item.yesterday}\n        ↓\n**Hôm nay**\n${item.today}\n        ☐ Chưa xác nhận\n        ↓\n**Ngày mai**\nLoading...\n\n🚧 **Blocker:** ${item.blocker}`.slice(0, 1900);
}

export async function sendTeamStandups(client, date = new Date()) {
  const day = localDateKey(date);
  let sent = 0;
  for (const [team, channelId] of config.discord.standupChannelMap) {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) continue;
    const messages = await channel.messages.fetch({ limit: 100 });
    const latest = new Map();
    for (const message of messages.values()) {
      if (localDateKey(message.createdAt) !== day) continue;
      const parsed = parseStandup(messageText(message));
      if (parsed && (!parsed.team || parsed.team === team) && !latest.has(parsed.userId)) latest.set(parsed.userId, parsed);
    }
    for (const item of latest.values()) {
      const personalId = config.discord.userPersonalChannelMap.get(item.userId);
      if (!personalId) continue;
      const destination = await client.channels.fetch(personalId);
      if (destination?.isTextBased()) {
        await destination.send({ content: card(item), components: buttons(item.userId, day), allowedMentions: { users: [item.userId] } });
        sent += 1;
      }
    }
  }
  return sent;
}

export async function handleStandupButton(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('standup:')) return false;
  const [, status, ownerId, date] = interaction.customId.split(':');
  const manager = interaction.member?.roles?.cache?.some((role) => config.discord.standupManagerRoleIds.has(role.id));
  if (interaction.user.id !== ownerId && !manager) {
    await interaction.reply({ content: 'Chỉ thành viên này hoặc Discord Manager được cập nhật.', ephemeral: true });
    return true;
  }
  const labels = { done: '☑ Đã làm', pending: '⏳ Chưa xong', blocked: '🧱 Có blocker' };
  const content = interaction.message.content.replace(/        [☐☑].*?(?=\n        ↓)/s, `        ${labels[status] || labels.pending}`);
  await interaction.update({ content, components: [] });
  let state = {};
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* Chưa có state. */ }
  state[`${date}:${ownerId}`] = status;
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });
  return true;
}

export function startStandupReminder(client) {
  let lastSent = '';
  try { lastSent = JSON.parse(fs.readFileSync(stateFile, 'utf8'))._lastReminder || ''; } catch { /* Chưa có state. */ }
  const check = async () => {
    const now = new Date();
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: config.reminderTimezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
    const value = (type) => Number(timeParts.find((part) => part.type === type)?.value);
    const day = localDateKey(now);
    const current = value('hour') * 60 + value('minute');
    const scheduled = config.standupHour * 60 + config.standupMinute;
    if (current < scheduled || lastSent === day) return;
    const sent = await sendTeamStandups(client, now);
    if (!sent) return;
    lastSent = day;
    let state = {};
    try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* Chưa có state. */ }
    state._lastReminder = day;
    state._sentAt = new Date().toISOString();
    state._sentCount = sent;
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });
    console.log('standup_reminder_sent', sent);
  };
  check().catch(() => console.error('standup_reminder_failed'));
  return setInterval(() => check().catch(() => console.error('standup_reminder_failed')), 60_000);
}
