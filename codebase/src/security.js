import { config } from './config.js';

const lastUse = new Map();
const inFlight = new Set();

export function authorize(interaction) {
  if (interaction.guildId !== config.discord.guildId) return 'Bot chỉ hoạt động trong server thử nghiệm.';
  const channelIds = [interaction.channelId, interaction.channel?.parentId].filter(Boolean);
  if (channelIds.some((id) => config.discord.deniedChannelIds.has(id))) {
    return 'Bot không được phép hoạt động trong channel này.';
  }
  if (config.discord.allowedRoleIds.size > 0) {
    const roles = interaction.member?.roles?.cache;
    const hasAllowedRole = roles && [...roles.values()].some((role) => config.discord.allowedRoleIds.has(role.id));
    if (!hasAllowedRole) return 'Bạn chưa có role được phép thử bot.';
  }
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
