'use client';

import type { ReactNode } from 'react';
import { useUi, type MascotKind } from '@/lib/ui-store';

/**
 * Monee 的角色（街頭貼紙風）：硬幣小子、錢包兄弟、豬撲滿，使用者在「我的 → 外觀」挑。
 * 粗黑框、平塗色，配色用 tokens.css 的角色色。表情：
 * ok 節奏剛好、tight 快用完了、over 超支、yay 記完帳慶祝。
 */
export type Mood = 'ok' | 'tight' | 'over' | 'yay';

export const MASCOT_NAMES: Record<MascotKind, string> = { coin: '硬幣小子', wallet: '錢包兄弟', piggy: '豬撲滿' };

const INK = '#1A1A1E';
const line = { stroke: INK, strokeWidth: 6, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** 冒汗（快用完了、超支） */
const Sweat = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <path
    d={`M${x} ${y} C ${x - 8 * s} ${y + 12 * s}, ${x - 8 * s} ${y + 20 * s}, ${x} ${y + 22 * s} C ${x + 8 * s} ${y + 20 * s}, ${x + 8 * s} ${y + 12 * s}, ${x} ${y} Z`}
    fill="#8FDBFF" stroke={INK} strokeWidth={4} strokeLinejoin="round"
  />
);

/** 慶祝的星星 */
const Spark = ({ x, y, r = 10, fill = '#FDE021' }: { x: number; y: number; r?: number; fill?: string }) => (
  <path
    d={`M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z`}
    fill={fill} stroke={INK} strokeWidth={3} strokeLinejoin="round"
  />
);

/** 墨鏡下面的嘴：硬幣小子、豬撲滿共用 */
function Mouth({ mood, cx, y, w }: { mood: Mood; cx: number; y: number; w: number }) {
  const l = cx - w / 2;
  const r = cx + w / 2;
  if (mood === 'tight') {
    return <path d={`M${l} ${y + 6} Q ${l + w / 6} ${y - 2}, ${l + w / 3} ${y + 6} T ${l + (2 * w) / 3} ${y + 6} T ${r} ${y + 4}`} fill="none" stroke={INK} strokeWidth={5.5} strokeLinecap="round" />;
  }
  if (mood === 'over') {
    return (
      <g>
        <ellipse cx={cx} cy={y + 9} rx={w / 4.2} ry={w / 4.6} fill={INK} />
        <ellipse cx={cx} cy={y + 14} rx={w / 8} ry={w / 14} fill="#FF3A81" />
      </g>
    );
  }
  if (mood === 'yay') {
    return (
      <g>
        <path d={`M${l - 2} ${y - 2} C ${l + 8} ${y + 32}, ${r - 8} ${y + 32}, ${r + 2} ${y - 4} Z`} fill={INK} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <path d={`M${cx - w / 4} ${y + 16} Q ${cx} ${y + 28}, ${cx + w / 4} ${y + 16} Q ${cx} ${y + 10}, ${cx - w / 4} ${y + 16} Z`} fill="#FF3A81" />
      </g>
    );
  }
  return null;
}

function CoinKid({ mood }: { mood: Mood }) {
  return (
    <>
      <g {...line}>
        {/* 反戴的帽簷（在頭後面）、硬幣的厚度、正面 */}
        <path d="M58 74 C 36 58, 6 62, 10 82 C 14 96, 44 94, 62 86 Z" fill="#00747F" />
        <circle cx="107" cy="118" r="64" fill="#D99A00" />
        <circle cx="100" cy="112" r="64" fill="#FDE021" />
      </g>
      <circle cx="100" cy="112" r="51" fill="none" stroke="#E2B000" strokeWidth={5} strokeDasharray="0.1 10" strokeLinecap="round" />
      <g {...line}>
        <path d="M34 96 C 34 26, 166 26, 166 96 Z" fill="#00A5B5" />
        <path d="M100 32 C 82 48, 72 70, 70 95 M100 32 C 118 48, 128 70, 130 95" fill="none" strokeWidth={3.5} opacity={0.55} />
        <circle cx="100" cy="30" r="7" fill="#00A5B5" />
        <path d="M82 96 A 18 16 0 0 1 118 96 Z" fill="#FDE021" strokeWidth={5} />
        <path d="M80 88 H120" stroke="#FFFFFF" strokeWidth={5} />
        {/* 墨鏡 */}
        <path d="M48 104 H96 V114 C 96 128 86 134 72 134 C 56 134 48 124 48 112 Z" fill={INK} />
        <path d="M104 104 H152 V112 C 152 124 144 134 128 134 C 114 134 104 128 104 114 Z" fill={INK} />
        <path d="M94 106 H106" />
      </g>
      <path d="M58 112 L72 112 M120 112 L134 112" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
      <circle cx="52" cy="144" r="8" fill="#FF8FB8" />
      <circle cx="150" cy="144" r="8" fill="#FF8FB8" />
      {mood === 'ok' ? (
        <>
          <path d="M72 146 C 84 170, 122 170, 134 144 Z" fill="#FFFFFF" stroke={INK} strokeWidth={5.5} strokeLinejoin="round" />
          <path d="M74 150 H131" stroke={INK} strokeWidth={3} />
          <rect x="104" y="149.5" width="9" height="9" fill={INK} />
        </>
      ) : <Mouth mood={mood} cx={103} y={146} w={58} />}
      {/* 帽子側邊的 $ 布章 */}
      <g transform="rotate(14 136 62)">
        <circle cx="136" cy="62" r="13" fill="#FDE021" stroke={INK} strokeWidth={4.5} />
        <path d="M141 56 C 135 52, 129 56, 133 61 C 137 65, 141 69, 131 69" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
        <path d="M136 51 V73" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      </g>
    </>
  );
}

function WalletBro({ mood }: { mood: Mood }) {
  // 眼睛：剛好是看前面、快用完了往上飄、超支瞳孔縮小、慶祝笑瞇瞇
  const pupil = mood === 'tight' ? { dx: -3, dy: -5, r: 9 } : mood === 'over' ? { dx: 0, dy: 0, r: 4.5 } : { dx: 4, dy: 3, r: 9.5 };
  return (
    <>
      <g {...line}>
        <rect x="34" y="62" width="132" height="116" rx="24" fill="#8C7FD0" />
        <path d="M34 150 H166" strokeWidth={4} opacity={0.35} />
        <path d="M120 112 H166 V140 H120 C 112 140 108 134 108 126 C 108 118 112 112 120 112 Z" fill="#6E60C0" />
        <circle cx="124" cy="126" r="6" fill="#FDE021" strokeWidth={4} />
        {/* 毛帽 */}
        <path d="M38 72 C 40 18, 160 18, 162 72 Z" fill="#E1131E" />
        <rect x="32" y="62" width="136" height="20" rx="10" fill="#B30D17" />
        <path d="M52 66 V78 M70 66 V78 M88 66 V78 M106 66 V78 M124 66 V78 M142 66 V78" strokeWidth={3} opacity={0.5} />
        <circle cx="100" cy="20" r="11" fill="#FFFFFF" />
      </g>
      {mood === 'yay' ? (
        <g fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round">
          <path d="M56 112 Q 72 94 88 112" />
          <path d="M98 112 Q 112 96 126 112" />
        </g>
      ) : (
        <g {...line}>
          <circle cx="72" cy="108" r="19" fill="#FFFFFF" />
          <circle cx={72 + pupil.dx} cy={108 + pupil.dy} r={pupil.r} fill={INK} stroke="none" />
          <circle cx={72 + pupil.dx + 4} cy={108 + pupil.dy - 5} r={3.5} fill="#FFFFFF" stroke="none" />
          <circle cx="112" cy="108" r="17" fill="#FFFFFF" />
          <circle cx={112 + pupil.dx} cy={108 + pupil.dy} r={pupil.r - 0.5} fill={INK} stroke="none" />
          <circle cx={112 + pupil.dx + 4} cy={108 + pupil.dy - 5} r={3.2} fill="#FFFFFF" stroke="none" />
          {mood !== 'ok' && <path d="M52 84 L86 90 M96 90 L128 84" strokeWidth={5} fill="none" />}
        </g>
      )}
      {mood === 'ok' && (
        <g {...line}>
          {/* 叼著鈔票 */}
          <path d="M60 140 L118 150 L112 172 L54 162 Z" fill="#2DB45A" strokeWidth={5} />
          <circle cx="86" cy="156" r="7" fill="none" strokeWidth={3.5} />
          <path d="M70 140 C 80 150, 96 152, 108 144" fill="none" strokeWidth={5} />
        </g>
      )}
      {mood === 'tight' && <Mouth mood="tight" cx={92} y={148} w={44} />}
      {mood === 'over' && (
        <>
          <Mouth mood="over" cx={92} y={142} w={52} />
          {/* 鈔票飛走了 */}
          <g transform="rotate(-24 168 52)" {...line} strokeWidth={4.5}>
            <path d="M146 40 L190 40 L190 64 L146 64 Z" fill="#2DB45A" />
            <circle cx="168" cy="52" r="6" fill="none" strokeWidth={3} />
          </g>
          <path d="M140 74 L132 82 M150 80 L144 90" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </>
      )}
      {mood === 'yay' && <Mouth mood="yay" cx={92} y={138} w={56} />}
      <circle cx="50" cy="132" r="7" fill="#FF8FB8" />
    </>
  );
}

function Piggy({ mood }: { mood: Mood }) {
  return (
    <>
      <g {...line}>
        <path d="M44 74 L40 36 L76 56 Z" fill="#FF8FB8" />
        <path d="M156 74 L160 36 L124 56 Z" fill="#FF8FB8" />
        <rect x="54" y="160" width="24" height="24" rx="6" fill="#FF6FA3" />
        <rect x="122" y="160" width="24" height="24" rx="6" fill="#FF6FA3" />
        <ellipse cx="100" cy="118" rx="72" ry="58" fill="#FF8FB8" />
        <rect x="84" y="62" width="32" height="8" rx="4" fill={INK} stroke="none" />
        {/* 頭巾 */}
        <path d="M30 98 C 60 82, 140 82, 170 98 L 168 112 C 140 98, 60 98, 32 112 Z" fill="#2C8CDB" />
        <path d="M168 102 L188 92 L186 112 Z M170 106 L186 122 L172 124 Z" fill="#2C8CDB" strokeWidth={5} />
        {/* 墨鏡 */}
        <path d="M50 112 H94 V118 C 94 130 86 136 72 136 C 58 136 50 128 50 118 Z" fill={INK} />
        <path d="M106 112 H150 V118 C 150 128 142 136 128 136 C 114 136 106 130 106 118 Z" fill={INK} />
        <path d="M92 114 H108" />
        <ellipse cx="100" cy="150" rx="22" ry="15" fill="#FF6FA3" />
      </g>
      <g fill="#FFFFFF" opacity={0.85}>
        <circle cx="44" cy="102" r="2.5" /><circle cx="64" cy="94" r="2.5" /><circle cx="86" cy="90" r="2.5" />
        <circle cx="110" cy="90" r="2.5" /><circle cx="132" cy="93" r="2.5" /><circle cx="154" cy="100" r="2.5" />
      </g>
      <ellipse cx="92" cy="150" rx="4" ry="6" fill={INK} />
      <ellipse cx="108" cy="150" rx="4" ry="6" fill={INK} />
      <path d="M58 120 L70 120 M114 120 L126 120" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
      {mood === 'ok'
        ? <path d="M120 166 C 128 172, 140 170, 146 162" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        : <Mouth mood={mood} cx={134} y={160} w={30} />}
    </>
  );
}

const BODIES: Record<MascotKind, (p: { mood: Mood }) => ReactNode> = { coin: CoinKid, wallet: WalletBro, piggy: Piggy };

/** 沒指定 kind 就用使用者挑的角色；裝飾用的（旁邊有字）不用給 title */
export function Mascot({ kind, mood = 'ok', className, title }: { kind?: MascotKind; mood?: Mood; className?: string; title?: string }) {
  const chosen = useUi((s) => s.mascot);
  const Body = BODIES[kind ?? chosen];
  return (
    <svg viewBox="0 0 200 200" className={className} overflow="visible" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Body mood={mood} />
      {(mood === 'tight' || mood === 'over') && <Sweat x={176} y={88} />}
      {mood === 'over' && <Sweat x={22} y={110} s={0.8} />}
      {mood === 'yay' && <><Spark x={22} y={40} /><Spark x={182} y={36} r={8} fill="#FF8FB8" /><Spark x={186} y={150} r={7} fill="#00A5B5" /></>}
    </svg>
  );
}
