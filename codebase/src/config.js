import 'dotenv/config';
import path from 'node:path';

const int = (name, fallback, min, max) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} phải là số nguyên từ ${min} đến ${max}`);
  }
  return value;
};

function snowflakeSet(name) {
  const values = (process.env[name] || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (values.some((id) => !/^\d{17,20}$/.test(id))) {
    throw new Error(`${name} chứa Discord ID không hợp lệ`);
  }
  return new Set(values);
}

const bool = (name, fallback = false) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  if (!/^(true|false)$/i.test(value)) throw new Error(`${name} phải là true hoặc false`);
  return value.toLowerCase() === 'true';
};

const snowflake = (name) => {
  const value = (process.env[name] || '').trim();
  if (value && !/^\d{17,20}$/.test(value)) throw new Error(`${name} không phải Discord ID hợp lệ`);
  return value;
};

function teamChannelMap(name) {
  const map = new Map();
  for (const item of (process.env[name] || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const match = item.match(/^([A-Za-z0-9_-]{1,20}):(\d{17,20})$/);
    if (!match) throw new Error(`${name} phải có dạng TEAM:CHANNEL_ID`);
    map.set(match[1].toUpperCase(), match[2]);
  }
  return map;
}

export const config = Object.freeze({
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    appId: process.env.DISCORD_APP_ID || '',
    guildId: process.env.DISCORD_GUILD_ID || '',
    deniedChannelIds: snowflakeSet('DENIED_CHANNEL_IDS'),
    allowedRoleIds: snowflakeSet('ALLOWED_ROLE_IDS'),
    mentionAllowedChannelIds: snowflakeSet('MENTION_ALLOWED_CHANNEL_IDS'),
    managerRoleIds: snowflakeSet('DISCORD_MANAGER_ROLE_IDS'),
    announcementChannelId: snowflake('DISCORD_ANNOUNCEMENT_CHANNEL_ID'),
    reminderChannelId: snowflake('DISCORD_REMINDER_CHANNEL_ID'),
    standupChannelMap: teamChannelMap('TEAM_STANDUP_CHANNEL_MAP'),
    userPersonalChannelMap: teamChannelMap('USER_PERSONAL_CHANNEL_MAP'),
    standupManagerRoleIds: snowflakeSet('STANDUP_MANAGER_ROLE_IDS'),
  },
  ai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    timeoutMs: int('AI_TIMEOUT_MS', 30000, 5000, 60000),
  },
  transcriptDir: path.resolve(process.env.TRANSCRIPT_DIR || '../../data/vlearn-pack/transcript'),
  lessonPdfDir: path.resolve(process.env.LESSON_PDF_DIR || '../pdf'),
  maxContextChars: int('MAX_CONTEXT_CHARS', 130000, 10000, 160000),
  rateLimitMs: int('RATE_LIMIT_SECONDS', 30, 5, 300) * 1000,
  mentionQaEnabled: bool('ENABLE_MENTION_QA', false),
  dailyReminderEnabled: bool('ENABLE_DAILY_REMINDER', false),
  reminderHour: int('REMINDER_HOUR', 8, 0, 23),
  reminderMinute: int('REMINDER_MINUTE', 0, 0, 59),
  reminderTimezone: process.env.REMINDER_TIMEZONE || 'Asia/Ho_Chi_Minh',
  standupEnabled: bool('ENABLE_STANDUP_REMINDER', false),
  standupHour: int('STANDUP_REMINDER_HOUR', 12, 0, 23),
  standupMinute: int('STANDUP_REMINDER_MINUTE', 0, 0, 59),
});

export function assertEnv({ ai = true } = {}) {
  for (const [name, value] of Object.entries({
    DISCORD_TOKEN: config.discord.token,
    DISCORD_APP_ID: config.discord.appId,
    DISCORD_GUILD_ID: config.discord.guildId,
  })) if (!value) throw new Error(`Thiếu ${name}`);

  if (!ai) return;
  if (!config.ai.apiKey) throw new Error('Thiếu OPENAI_API_KEY');
  if (!/^gpt-[a-z0-9.-]+$/i.test(config.ai.model)) throw new Error('OPENAI_MODEL không hợp lệ');
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: config.reminderTimezone }).format(); } catch {
    throw new Error('REMINDER_TIMEZONE không hợp lệ');
  }
  if (config.mentionQaEnabled && !config.discord.mentionAllowedChannelIds.size) {
    throw new Error('Phải cấu hình MENTION_ALLOWED_CHANNEL_IDS khi bật mention Q&A');
  }
  if (config.dailyReminderEnabled) {
    if (!config.discord.userPersonalChannelMap.size && !config.discord.reminderChannelId) throw new Error('Thiếu USER_PERSONAL_CHANNEL_MAP');
    if (!config.discord.announcementChannelId) throw new Error('Thiếu DISCORD_ANNOUNCEMENT_CHANNEL_ID');
    if (!config.discord.managerRoleIds.size) throw new Error('Thiếu DISCORD_MANAGER_ROLE_IDS');
  }
  if (config.standupEnabled && !config.discord.standupChannelMap.size) {
    throw new Error('Thiếu TEAM_STANDUP_CHANNEL_MAP');
  }
  if (config.standupEnabled && !config.discord.userPersonalChannelMap.size) throw new Error('Thiếu USER_PERSONAL_CHANNEL_MAP');
}
