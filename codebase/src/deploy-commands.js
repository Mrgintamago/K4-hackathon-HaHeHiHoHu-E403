import { REST, Routes } from 'discord.js';
import { assertEnv, config } from './config.js';
import { command } from './command.js';

assertEnv({ ai: false });
const rest = new REST({ version: '10' }).setToken(config.discord.token);
await rest.put(Routes.applicationGuildCommands(config.discord.appId, config.discord.guildId), { body: [command.toJSON()] });
console.log('Đã đăng ký /tomtat-day2 trong test guild.');

