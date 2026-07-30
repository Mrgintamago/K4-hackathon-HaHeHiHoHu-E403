import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const run = spawnSync(process.execPath, ['--test', '--test-isolation=none'], {
  cwd: path.resolve(scriptDir, '..'), encoding: 'utf8', env: process.env,
});
const output = `${run.stdout || ''}\n${run.stderr || ''}`;
const number = (label) => Number(output.match(new RegExp(`ℹ ${label} (\\d+)`))?.[1] || 0);
const result = {
  generated_at: new Date().toISOString(),
  automated_tests: number('tests'),
  passed: number('pass'),
  failed: number('fail'),
  golden_set_total: 20,
  live_ai_eval_run: false,
};
const evalDir = path.resolve(scriptDir, '../../eval');
fs.mkdirSync(evalDir, { recursive: true });
fs.writeFileSync(path.join(evalDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
const markdown = `# Kết quả eval\n\n` +
  `> Báo cáo tự động không thay thế 20 case golden set. Live AI eval chưa chạy.\n\n` +
  `| Thời điểm | Automated pass | Automated fail | Golden set | Live AI |\n` +
  `|---|---:|---:|---:|---|\n` +
  `| ${result.generated_at} | ${result.passed}/${result.automated_tests} | ${result.failed} | Chưa chạy đủ 20 | Chưa chạy |\n`;
fs.writeFileSync(path.join(evalDir, 'results.md'), markdown, 'utf8');
process.stdout.write(output);
process.exitCode = run.status || 0;
