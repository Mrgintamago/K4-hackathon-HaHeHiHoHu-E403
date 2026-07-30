import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { authorize } from '../src/security.js';

const guildId = '10000000000000000';
config.discord.guildId = guildId;
config.discord.deniedChannelIds.clear();
config.discord.allowedRoleIds.clear();

function interaction({ channelId = '20000000000000000', parentId = null, roles = [] } = {}) {
  return {
    guildId,
    channelId,
    channel: { parentId },
    member: { roles: { cache: new Map(roles.map((id) => [id, { id }])) } },
  };
}

test('cho phép mặc định trong guild', () => {
  assert.equal(authorize(interaction()), null);
});

test('chặn channel và thread có parent trong denylist', () => {
  const denied = '30000000000000000';
  config.discord.deniedChannelIds.add(denied);
  assert.match(authorize(interaction({ channelId: denied })), /không được phép/);
  assert.match(authorize(interaction({ parentId: denied })), /không được phép/);
  config.discord.deniedChannelIds.clear();
});

test('nhiều role là OR và allowlist trống cho phép mọi role', () => {
  const roleA = '40000000000000000';
  const roleB = '50000000000000000';
  config.discord.allowedRoleIds.add(roleA);
  config.discord.allowedRoleIds.add(roleB);
  assert.equal(authorize(interaction({ roles: [roleB] })), null);
  assert.match(authorize(interaction({ roles: ['60000000000000000'] })), /chưa có role/);
  config.discord.allowedRoleIds.clear();
  assert.equal(authorize(interaction({ roles: [] })), null);
});
