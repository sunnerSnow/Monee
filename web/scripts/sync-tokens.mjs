// 把設計規範的 tokens.css 複製進 App，讓 design-system/monee/tokens.css 保持唯一來源。
// 在 dev / build 前自動執行；找不到來源（例如只部署 web/ 資料夾）時沿用現有的副本。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '../design-system/monee/tokens.css');
const target = resolve(root, 'src/styles/tokens.css');
const banner = '/* 自動產生：請改 design-system/monee/tokens.css，再執行 npm run sync:tokens */\n';

if (!existsSync(source)) {
  console.warn(`[sync-tokens] 找不到 ${source}，沿用現有的 src/styles/tokens.css`);
  process.exit(0);
}

// 統一成 LF 再比較：Windows 的 git 會把換行轉成 CRLF，不統一的話每次重新 clone 都會被當成有改動
const lf = (s) => s.replace(/\r\n/g, '\n');
const next = banner + lf(readFileSync(source, 'utf8'));
if (!existsSync(target) || lf(readFileSync(target, 'utf8')) !== next) {
  writeFileSync(target, next);
  console.log('[sync-tokens] 已更新 src/styles/tokens.css');
}
