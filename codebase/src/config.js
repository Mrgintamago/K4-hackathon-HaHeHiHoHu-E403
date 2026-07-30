import 'dotenv/config';
import path from 'node:path';

const int = (name, fallback, min, max) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} phải là số nguyên từ ${min} đến ${max}`);
  }
  return value;
};

export const config = Object.freeze({
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    appId: process.env.DISCORD_APP_ID || '',
    guildId: process.env.DISCORD_GUILD_ID || '',
    allowedChannelId: process.env.ALLOWED_CHANNEL_ID || '',
    allowedRoleId: process.env.ALLOWED_ROLE_ID || '',
  },
  ai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-5-nano',
    timeoutMs: int('AI_TIMEOUT_MS', 30000, 5000, 60000),
  },
  transcriptDir: path.resolve(process.env.TRANSCRIPT_DIR || '../../data/vlearn-pack/transcript'),
  maxContextChars: int('MAX_CONTEXT_CHARS', 130000, 10000, 160000),
  rateLimitMs: int('RATE_LIMIT_SECONDS', 30, 5, 300) * 1000,
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
}
