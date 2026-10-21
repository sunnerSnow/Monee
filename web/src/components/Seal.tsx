/** 鋸齒徽章的外形（像參考網站的 ONLINE SHOP）：粗黑框加錯開的實心影，放在按鈕或標籤後面當底 */
function points(n: number, inner: number) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? inner : 1;
    const a = (Math.PI * i) / n - Math.PI / 2;
    return `${(50 + 46 * r * Math.cos(a)).toFixed(2)},${(50 + 46 * r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

const SHAPES = { 14: points(14, 0.86), 16: points(16, 0.87) };

export function SealShape({ fill, spikes = 16, className = '' }: { fill: string; spikes?: 14 | 16; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={`pointer-events-none overflow-visible ${className}`}>
      <polygon points={SHAPES[spikes]} transform="translate(4 4)" fill="#1A1A1E" />
      <polygon points={SHAPES[spikes]} fill={fill} stroke="#1A1A1E" strokeWidth={4} strokeLinejoin="round" />
    </svg>
  );
}
