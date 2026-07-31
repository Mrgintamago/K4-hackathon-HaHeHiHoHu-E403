import { redactPii } from './privacy.js';

const DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g;
const TIME_RE = /\b(2[0-3]|[01]?\d)(?:[:h]([0-5]\d))?\b/i;
const LABELED_TIME_RE = /Thời gian\s*:\s*(2[0-3]|[01]?\d)(?:[:h]([0-5]\d))?/i;
const LABELED_TIME_GLOBAL_RE = /Thời gian\s*:\s*(2[0-3]|[01]?\d)(?:[:h]([0-5]\d))?/gi;
const WEEKDAY_RE = /(?:^|\n)\s*(Thứ\s*([2-7])|Chủ\s*Nhật)\s*\|\s*([^\n]+)/giu;

function key(date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function eventType(text) {
  return /office\s*hours?/i.test(text) ? 'Office hours'
    : /mentor\s*duty/i.test(text) ? 'Mentor duty'
      : /workshop|\bWS\s*\d/i.test(text) ? 'Workshop' : null;
}

function workshopNumber(text) {
  const match = String(text || '').match(/\b(?:workshop|WS)\s*0?([1-9]\d*)\b/i);
  return match ? Number(match[1]) : null;
}

function weeklyDate(messageDate, discordDay) {
  const date = new Date(messageDate);
  date.setHours(12, 0, 0, 0);
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + mondayOffset + (discordDay === 8 ? 6 : discordDay - 2));
  return date;
}

export function memberHasManagerRole(message, roleIds) {
  if (!roleIds.size) return false;
  return message.member?.roles?.cache?.some((role) => roleIds.has(role.id)) === true;
}

async function authorHasManagerRole(message, roleIds) {
  if (memberHasManagerRole(message, roleIds)) return true;
  if (!message.guild || !message.author?.id) return false;
  try {
    const member = await message.guild.members.fetch(message.author.id);
    return member.roles.cache.some((role) => roleIds.has(role.id));
  } catch {
    return false;
  }
}

export function extractEvents(content, messageDate = new Date()) {
  const safe = redactPii(content);
  const labeledTimes = [...safe.matchAll(LABELED_TIME_GLOBAL_RE)];
  const events = [];
  const weekly = [...safe.matchAll(WEEKDAY_RE)];
  for (let i = 0; i < weekly.length; i += 1) {
    const match = weekly[i];
    const block = safe.slice(match.index, weekly[i + 1]?.index || safe.length).replace(/\s+/g, ' ').trim();
    const type = eventType(block);
    if (!type) continue;
    const discordDay = match[2] ? Number(match[2]) : 8;
    const time = match[3].match(TIME_RE);
    const detail = block.match(/Nội dung\s*:\s*(.+)/i)?.[1] || block;
    events.push({
      dateKey: key(weeklyDate(messageDate, discordDay)),
      type,
      workshopNumber: type === 'Workshop' ? workshopNumber(block) : null,
      time: time ? `${String(time[1]).padStart(2, '0')}:${time[2] || '00'}` : '',
      description: detail.slice(0, 180),
    });
  }
  const type = eventType(safe);
  if (!type) return events;
  for (const match of safe.matchAll(DATE_RE)) {
    const year = Number(match[3] || messageDate.getFullYear());
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) continue;
    const nearby = safe.slice(Math.max(0, match.index - 180), match.index + 300).replace(/\s+/g, ' ').trim();
    const time = labeledTimes[0] || nearby.match(LABELED_TIME_RE) || nearby.match(TIME_RE);
    const detail = nearby.match(/Nội dung\s*:\s*([^.!?]+[.!?]?)/i)?.[1]?.trim();
    events.push({
      dateKey: key(date),
      type,
      workshopNumber: type === 'Workshop' ? workshopNumber(nearby) || workshopNumber(safe) : null,
      time: time ? `${String(time[1]).padStart(2, '0')}:${time[2] || '00'}` : '',
      description: (detail || `${type} theo thông báo của chương trình.`).slice(0, 180),
    });
  }
  return events.filter((event, index, all) =>
    all.findIndex((candidate) => candidate.dateKey === event.dateKey && candidate.type === event.type && candidate.time === event.time) === index);
}

export async function fetchDailyEvents(channel, roleIds, wantedDateKey) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const events = [];
  for (const message of messages.values()) {
    if (!await authorHasManagerRole(message, roleIds)) continue;
    events.push(...extractEvents(message.content, message.createdAt));
  }
  return events
    .filter((event) => event.dateKey === wantedDateKey)
    .filter((event, index, all) => all.findIndex((candidate) =>
      candidate.dateKey === event.dateKey && candidate.type === event.type && candidate.time === event.time) === index)
    .slice(0, 10);
}

export async function fetchWeeklyEvents(channel, roleIds, referenceDate, timezone = 'Asia/Ho_Chi_Minh') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const local = formatter.formatToParts(referenceDate)
    .reduce((parts, item) => ({ ...parts, [item.type]: item.value }), {});
  const noon = new Date(`${local.year}-${local.month}-${local.day}T12:00:00+07:00`);
  const monday = new Date(noon);
  monday.setDate(noon.getDate() + (noon.getDay() === 0 ? -6 : 1 - noon.getDay()));
  const wanted = new Set(Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    return key(date);
  }));

  const messages = await channel.messages.fetch({ limit: 100 });
  const events = [];
  for (const message of messages.values()) {
    if (!await authorHasManagerRole(message, roleIds)) continue;
    events.push(...extractEvents(message.content, message.createdAt));
  }
  return events
    .filter((event) => wanted.has(event.dateKey))
    .filter((event, index, all) => all.findIndex((candidate) =>
      candidate.dateKey === event.dateKey && candidate.type === event.type && candidate.time === event.time) === index)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(0, 20);
}
