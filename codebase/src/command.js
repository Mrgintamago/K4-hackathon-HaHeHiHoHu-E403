import { SlashCommandBuilder } from 'discord.js';

export const command = new SlashCommandBuilder()
  .setName('tomtat-day2')
  .setDescription('Tóm tắt an toàn một phần transcript Day 2, có citation')
  .addStringOption((o) => o.setName('phan').setDescription('Phần bài học').setRequired(true)
    .addChoices(
      { name: 'Sáng — Xác định bài toán', value: 'sang-bai-toan' },
      { name: 'Chỉ số & tự động hoá', value: 'chi-so-tu-dong-hoa' },
      { name: 'Chiều — Ràng buộc & workflow', value: 'chieu-rang-buoc' },
    ))
  .addStringOption((o) => o.setName('muc_do').setDescription('Độ dài').setRequired(true)
    .addChoices({ name: 'Ngắn', value: 'ngan' }, { name: 'Đầy đủ', value: 'day-du' }));

