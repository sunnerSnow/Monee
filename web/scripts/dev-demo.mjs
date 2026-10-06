// 用示範模式啟動開發伺服器（不需要 Supabase）。Windows 的 npm script 不能直接寫 VAR=1，所以用這支腳本。
import { spawn } from 'node:child_process';

const child = spawn('npx', ['next', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_MONEE_DEMO: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
