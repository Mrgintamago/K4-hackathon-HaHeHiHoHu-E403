import { config } from './config.js';

const lastUse = new Map();
const inFlight = new Set();

export function authorize(interaction) {
  if (interaction.guildId !== config.discord.guildId) return 'Bot chỉ hoạt động trong server thử nghiệm.';
  if (config.discord.allowedChannelId && interaction.channelId !== config.discord.allowedChannelId) return 'Command không được bật trong channel này.';
  if (config.discord.allowedRoleId && !interaction.member?.roles?.cache?.has(config.discord.allowedRoleId)) return 'Bạn chưa có role được phép thử bot.';
  return null;
}

export function acquire(userId) {
  const now = Date.now();
  if (inFlight.has(userId)) return { ok: false, message: 'Bạn đang có một request chạy.' };
  const wait = config.rateLimitMs - (now - (lastUse.get(userId) || 0));
  if (wait > 0) return { ok: false, message: `Vui lòng thử lại sau ${Math.ceil(wait / 1000)} giây.` };
  inFlight.add(userId);
  lastUse.set(userId, now);
  return { ok: true };
}

export function release(userId) { inFlight.delete(userId); }

