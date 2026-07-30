import { REST, Routes } from 'discord.js';
import { assertEnv, config } from './config.js';

assertEnv({ ai: false });
const rest = new REST({ version: '10' }).setToken(config.discord.token);
await rest.put(Routes.applicationGuildCommands(config.discord.appId, config.discord.guildId), { body: [] });
console.log('Đã gỡ toàn bộ slash command trong test guild.');
