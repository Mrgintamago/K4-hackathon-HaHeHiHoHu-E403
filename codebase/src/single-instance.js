import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codebaseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lockFile = path.join(codebaseDir, 'data-private/bot.lock');

function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function acquireInstanceLock() {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  try {
    const existing = Number(fs.readFileSync(lockFile, 'utf8').trim());
    if (pidIsAlive(existing)) throw new Error(`Bot đã chạy ở PID ${existing}`);
    fs.rmSync(lockFile, { force: true });
  } catch (error) {
    if (error.code !== 'ENOENT' && /Bot đã chạy/.test(error.message)) throw error;
  }
  const fd = fs.openSync(lockFile, 'wx', 0o600);
  fs.writeFileSync(fd, String(process.pid));
  fs.closeSync(fd);
  const release = () => { try { if (Number(fs.readFileSync(lockFile, 'utf8')) === process.pid) fs.rmSync(lockFile, { force: true }); } catch { /* Đã được dọn. */ } };
  process.once('exit', release);
  process.once('SIGINT', () => { release(); process.exit(0); });
  process.once('SIGTERM', () => { release(); process.exit(0); });
}
