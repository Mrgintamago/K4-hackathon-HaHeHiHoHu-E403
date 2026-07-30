import { Client, Events, GatewayIntentBits } from 'discord.js';
import { assertEnv, config } from './config.js';
import { loadPart, validateCitations } from './transcripts.js';
import { summarize } from './ai.js';
import { acquire, authorize, release } from './security.js';

assertEnv();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (bot) => console.log(`Bot online: ${bot.user.tag}`));
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'tomtat-day2') return;
  const denied = authorize(interaction);
  if (denied) return interaction.reply({ content: denied, ephemeral: true });
  const lock = acquire(interaction.user.id);
  if (!lock.ok) return interaction.reply({ content: lock.message, ephemeral: true });
  await interaction.deferReply({ ephemeral: true });

  try {
    const key = interaction.options.getString('phan', true);
    const detail = interaction.options.getString('muc_do', true);
    const part = loadPart(key);
    const result = await summarize(part, detail);
    const validCodes = new Set(part.chunks.map((c) => c.code));
    if (!validateCitations(result, part, validCodes)) throw new Error('citation_validation_failed');
    const points = result.key_points.map((p, i) => `${i + 1}. ${p.text}\n   Nguồn: ${p.citations.map((c) => `[${c}]`).join(', ')}`).join('\n\n');
    const actions = Array.isArray(result.actions) && result.actions.length ? `\n\n✅ Gợi ý ôn tập:\n${result.actions.slice(0, 3).map((x) => `- ${String(x).slice(0, 300)}`).join('\n')}` : '';
    const warning = part.truncated ? '\n\n⚠️ Nguồn dài đã được giới hạn context.' : '';
    await interaction.editReply(`📚 **${String(result.title || part.label).slice(0, 150)}**\n\n${points}${actions}${warning}`.slice(0, 1950));
  } catch (error) {
    // Chỉ log mã lỗi, không log prompt, transcript, token hay raw response.
    console.error('summary_failed', error?.name || 'Error', error?.message === 'citation_validation_failed' ? 'citation_validation_failed' : 'provider_or_config_error');
    await interaction.editReply('Không thể tạo bản tóm tắt có căn cứ lúc này. Bot đã chặn kết quả để tránh gửi nội dung hoặc citation không đáng tin.');
  } finally {
    release(interaction.user.id);
  }
});

client.login(config.discord.token);

