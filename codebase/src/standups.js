import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { config } from './config.js';
import { redactPii } from './privacy.js';

const stateFile = path.resolve('data-private/standup-state.json');
const actionLogFile = path.resolve('data-private/standup-action-log.json');
let logWriteQueue = Promise.resolve();

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
  const group = text.match(/\b[gG]-?(\d{1,6})\b/)?.[1];
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
  return {
    userId,
    group: group ? `G${group}` : '',
    team: team ? `T${team}` : '',
    yesterday: redactPii(yesterday).slice(0, 350),
    today: redactPii(today).slice(0, 350),
    blocker: redactPii(blocker).slice(0, 200),
  };
}

function safeUnit(value, prefix) {
  const match = String(value || '').toUpperCase().match(new RegExp(`^${prefix}-?(\\d{1,6})$`));
  return match ? `${prefix}-${match[1]}` : `${prefix}-0`;
}

function buttons(item, date) {
  const group = safeUnit(item.group, 'G');
  const team = safeUnit(item.team, 'T');
  const make = (status, label, style) => new ButtonBuilder()
    .setCustomId(`standup:${status}:${item.userId}:${date}:${group}:${team}`)
    .setLabel(label)
    .setStyle(style);
  return [new ActionRowBuilder().addComponents(
    make('done', 'Đã làm', ButtonStyle.Success), make('pending', 'Chưa xong', ButtonStyle.Secondary), make('blocked', 'Có blocker', ButtonStyle.Danger),
  )];
}

function card(item) {
  const group = safeUnit(item.group, 'G') === 'G-0' ? 'G-CHƯA-CẤU-HÌNH' : safeUnit(item.group, 'G');
  const team = safeUnit(item.team, 'T') === 'T-0' ? 'T-CHƯA-CẤU-HÌNH' : safeUnit(item.team, 'T');
  return `🧪 **DEMO STANDUP · ${group} → ${team}**\n👤 <@${item.userId}>\n\n**Việc hôm qua**\n${item.yesterday}\n        ↓\n**Hôm nay**\n${item.today}\n        ☐ Chưa xác nhận\n        ↓\n**Ngày mai**\nLoading...\n\n🚧 **Blocker:** ${item.blocker}`.slice(0, 1900);
}

export function missingStandupUserIds(userChannelMap, submittedUserIds) {
  return [...userChannelMap.keys()].filter((userId) => !submittedUserIds.has(userId));
}

export function missingStandupCard({ userId, group = '', team = '', date }) {
  const displayGroup = safeUnit(group, 'G') === 'G-0' ? 'G-CHƯA-XÁC-ĐỊNH' : safeUnit(group, 'G');
  const displayTeam = safeUnit(team, 'T') === 'T-0' ? 'T-CHƯA-XÁC-ĐỊNH' : safeUnit(team, 'T');
  return `⏰ **NHẮC DAILY STANDUP · ${displayGroup} → ${displayTeam}**\n` +
    `👤 <@${userId}>\n\n` +
    `❌ **Chưa ghi nhận Daily Standup ngày ${date}.**\n` +
    `Bạn hãy gửi Daily Standup trong channel team theo đúng mẫu gồm **Hôm qua · Hôm nay · Blocker**.`;
}

export async function sendTeamStandups(client, date = new Date()) {
  const day = localDateKey(date);
  let sent = 0;
  const submittedUserIds = new Set();
  let guild = null;
  for (const [team, channelId] of config.discord.standupChannelMap) {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) continue;
    guild ||= channel.guild || null;
    const messages = await channel.messages.fetch({ limit: 100 });
    const latest = new Map();
    for (const message of messages.values()) {
      if (localDateKey(message.createdAt) !== day) continue;
      const parsed = parseStandup(messageText(message));
      if (parsed && !latest.has(parsed.userId)) {
        parsed.team ||= team;
        parsed.group ||= config.discord.standupGroupMap.get(team) || '';
        latest.set(parsed.userId, parsed);
      }
    }
    for (const item of latest.values()) {
      submittedUserIds.add(item.userId);
      try {
        const member = await channel.guild?.members.fetch(item.userId);
        const units = parseMemberUnits(member?.displayName || member?.user?.globalName || member?.user?.username);
        item.group = units.group || item.group;
        item.team = units.team || item.team;
      } catch { /* Giữ group/team từ message hoặc cấu hình. */ }
      const personalId = config.discord.userPersonalChannelMap.get(item.userId);
      if (!personalId) continue;
      const destination = await client.channels.fetch(personalId);
      if (destination?.isTextBased()) {
        await destination.send({ content: card(item), components: buttons(item, day), allowedMentions: { users: [item.userId] } });
        sent += 1;
      }
    }
  }
  if (!guild) {
    try { guild = await client.guilds.fetch(config.discord.guildId); } catch { /* Không thể đọc guild. */ }
  }
  for (const userId of missingStandupUserIds(config.discord.userPersonalChannelMap, submittedUserIds)) {
    try {
      const personalId = config.discord.userPersonalChannelMap.get(userId);
      const destination = await client.channels.fetch(personalId);
      if (!destination?.isTextBased()) continue;
      let units = { group: '', team: '' };
      try {
        const member = await guild?.members.fetch(userId);
        units = parseMemberUnits(member?.displayName || member?.user?.globalName || member?.user?.username);
      } catch { /* Card vẫn gửi với G/T chưa xác định. */ }
      await destination.send({
        content: missingStandupCard({ userId, ...units, date: day }),
        allowedMentions: { users: [userId] },
      });
      sent += 1;
    } catch {
      console.error('standup_missing_delivery_failed');
    }
  }
  return sent;
}

function cleanDisplayName(value) {
  return redactPii(String(value || 'unknown-user').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 80);
}

export function parseMemberUnits(displayName) {
  const value = String(displayName || '');
  const group = value.match(/(?:^|[\s_-])G-?(\d{1,6})(?=$|[\s_-])/i)?.[1];
  const team = value.match(/(?:^|[\s_-])T-?(\d{1,6})(?=$|[\s_-])/i)?.[1];
  return {
    group: group ? `G${group}` : '',
    team: team ? `T${team}` : '',
  };
}

export function buildStandupLogEntry({
  group, team, userId, userName, status, blocker = '', standupDate = '', timestamp = new Date().toISOString(),
}) {
  return {
    group: safeUnit(group, 'G') === 'G-0' ? 'G-CHUA-CAU-HINH' : safeUnit(group, 'G'),
    team: safeUnit(team, 'T') === 'T-0' ? 'T-CHUA-CAU-HINH' : safeUnit(team, 'T'),
    userId: String(userId || ''),
    userName: cleanDisplayName(userName),
    status,
    blocker: status === 'blocked' ? redactPii(blocker).replace(/\s+/g, ' ').trim().slice(0, 500) : '',
    standupDate: /^\d{4}-\d{2}-\d{2}$/.test(standupDate) ? standupDate : '',
    timestamp,
  };
}

export function appendStandupAction(entry, filePath = actionLogFile) {
  logWriteQueue = logWriteQueue.then(async () => {
    let log = { version: 1, groups: {} };
    try { log = JSON.parse(await fs.promises.readFile(filePath, 'utf8')); } catch { /* Chưa có log. */ }
    log.version = 1;
    log.groups ||= {};
    const group = log.groups[entry.group] ||= { teams: {} };
    const team = group.teams[entry.team] ||= { users: {} };
    const user = team.users[entry.userId] ||= { name: entry.userName, history: [] };
    user.name = entry.userName;
    user.history.push({
      status: entry.status,
      blocker: entry.blocker,
      standupDate: entry.standupDate,
      timestamp: entry.timestamp,
    });
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const tempFile = `${filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(tempFile, JSON.stringify(log, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.promises.rename(tempFile, filePath);
  });
  return logWriteQueue;
}

function interactionIdentity(interaction) {
  return cleanDisplayName(interaction.member?.displayName || interaction.user.globalName || interaction.user.username);
}

async function ownerMember(interaction, ownerId) {
  if (interaction.user.id === ownerId) return interaction.member;
  try { return await interaction.guild?.members.fetch(ownerId); } catch { return null; }
}

async function ownerIdentity(interaction, ownerId) {
  const member = await ownerMember(interaction, ownerId);
  return member
    ? cleanDisplayName(member.displayName || member.user?.globalName || member.user?.username)
    : `user-${ownerId.slice(-6)}`;
}

async function resolvedOwnerUnits(interaction, ownerId, fallbackGroup, fallbackTeam) {
  const member = await ownerMember(interaction, ownerId);
  const fromName = parseMemberUnits(member?.displayName || member?.user?.globalName || member?.user?.username);
  return {
    group: fromName.group || fallbackGroup,
    team: fromName.team || fallbackTeam,
  };
}

function isManager(interaction) {
  return interaction.member?.roles?.cache?.some((role) => config.discord.standupManagerRoleIds.has(role.id));
}

async function denyUnauthorized(interaction, ownerId) {
  if (interaction.user.id === ownerId || isManager(interaction)) return false;
  await interaction.reply({ content: 'Chỉ thành viên này hoặc Discord Manager được cập nhật.', ephemeral: true });
  return true;
}

export function statusContent(content, status, blocker = '', group = '', team = '') {
  const labels = {
    done: '☑ Đã làm',
    pending: '⏳ Chưa xong',
    blocked: `🧱 Có blocker${blocker ? `: ${blocker}` : ''}`,
  };
  let updated = content.replace(/        [☐☑⏳🧱].*?(?=\n        ↓)/s, `        ${labels[status] || labels.pending}`);
  if (group || team) {
    const displayGroup = safeUnit(group, 'G') === 'G-0' ? 'G-CHƯA-CẤU-HÌNH' : safeUnit(group, 'G');
    const displayTeam = safeUnit(team, 'T') === 'T-0' ? 'T-CHƯA-CẤU-HÌNH' : safeUnit(team, 'T');
    updated = updated.replace(/DEMO STANDUP · [^*\n]+/i, `DEMO STANDUP · ${displayGroup} → ${displayTeam}`);
  }
  if (status === 'blocked' && blocker) {
    updated = updated.replace(/🚧\s*\*\*Blocker:\*\*\s*[^\n]*/i, `🚧 **Blocker:** ${blocker}`);
  }
  return updated;
}

export async function handleStandupButton(interaction) {
  if (interaction.isButton() && interaction.customId.startsWith('standup:')) {
    const [, status, ownerId, date, group = 'G0', team = 'T0'] = interaction.customId.split(':');
    if (await denyUnauthorized(interaction, ownerId)) return true;
    if (status === 'blocked') {
      const input = new TextInputBuilder()
        .setCustomId('blocker')
        .setLabel('Blocker mới là gì?')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(2)
        .setMaxLength(500)
        .setRequired(true);
      const modal = new ModalBuilder()
        .setCustomId(`standup-modal:${ownerId}:${date}:${group}:${team}`)
        .setTitle('Cập nhật blocker')
        .addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return true;
    }
    const units = await resolvedOwnerUnits(interaction, ownerId, group, team);
    const entry = buildStandupLogEntry({
      ...units, userId: ownerId, userName: await ownerIdentity(interaction, ownerId), status, standupDate: date,
    });
    await appendStandupAction(entry);
    await interaction.update({
      content: statusContent(interaction.message.content, status, '', units.group, units.team),
      components: [],
    });
    return true;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith('standup-modal:')) {
    const [, ownerId, date, group = 'G0', team = 'T0'] = interaction.customId.split(':');
    if (await denyUnauthorized(interaction, ownerId)) return true;
    const blocker = redactPii(interaction.fields.getTextInputValue('blocker')).replace(/\s+/g, ' ').trim().slice(0, 500);
    if (blocker.length < 2) {
      await interaction.reply({ content: 'Bạn cần nhập blocker mới.', ephemeral: true });
      return true;
    }
    const units = await resolvedOwnerUnits(interaction, ownerId, group, team);
    const entry = buildStandupLogEntry({
      ...units,
      userId: ownerId,
      userName: await ownerIdentity(interaction, ownerId),
      status: 'blocked',
      blocker,
      standupDate: date,
    });
    await appendStandupAction(entry);
    if (interaction.isFromMessage()) {
      await interaction.update({
        content: statusContent(interaction.message.content, 'blocked', blocker, units.group, units.team),
        components: [],
      });
    } else {
      await interaction.reply({ content: 'Đã ghi nhận blocker.', ephemeral: true });
    }
    return true;
  }
  return false;
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
    const scheduleKey = `${day}@${String(config.standupHour).padStart(2, '0')}:${String(config.standupMinute).padStart(2, '0')}`;
    const current = value('hour') * 60 + value('minute');
    const scheduled = config.standupHour * 60 + config.standupMinute;
    if (current < scheduled || lastSent === scheduleKey) return;
    const sent = await sendTeamStandups(client, now);
    if (!sent) return;
    lastSent = scheduleKey;
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
