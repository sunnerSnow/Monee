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

/** 黃色的手腳：先畫一條粗的墨線當外框，再疊黃色 */
const Limb = ({ d }: { d: string }) => (
  <>
    <path d={d} fill="none" stroke={INK} strokeWidth={22} strokeLinecap="round" />
    <path d={d} fill="none" stroke="#FDE021" strokeWidth={11} strokeLinecap="round" />
  </>
);

/** 白手套 */
const Glove = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r={11} fill="#FFFFFF" stroke={INK} strokeWidth={5} />;

/** 硬幣小子：圓滾滾的硬幣戴頭盔，豆豆眼加三根睫毛；手腳跟著心情擺 */
function CoinKid({ mood }: { mood: Mood }) {
  const leftUp = mood === 'yay';
  const rightUp = mood === 'ok' || mood === 'yay';
  return (
    <>
      <Limb d="M84 166 V180" />
      <Limb d="M116 166 V180" />
      <ellipse cx="82" cy="188" rx="16" ry="8" fill="#FFFFFF" stroke={INK} strokeWidth={5} />
      <ellipse cx="118" cy="188" rx="16" ry="8" fill="#FFFFFF" stroke={INK} strokeWidth={5} />
      <Limb d={leftUp ? 'M46 122 Q26 110 28 88' : 'M46 134 Q28 144 30 162'} />
      <Glove x={leftUp ? 28 : 30} y={leftUp ? 84 : 166} />
      <Limb d={rightUp ? 'M154 122 Q174 110 172 88' : 'M154 134 Q172 144 170 162'} />
      <Glove x={rightUp ? 172 : 170} y={rightUp ? 84 : 166} />
      <g {...line}>
        {/* 硬幣的厚度、正面 */}
        <circle cx="106" cy="118" r="63" fill="#D99A00" />
        <circle cx="100" cy="112" r="63" fill="#FDE021" />
      </g>
      <circle cx="100" cy="112" r="53" fill="none" stroke="#E9B800" strokeWidth={4} />
      <g {...line}>
        {/* 頭盔 */}
        <path d="M42 96 C 42 32, 158 32, 158 96 Z" fill="#00A5B5" />
        <path d="M100 38 C 84 52, 76 72, 75 95 M100 38 C 116 52, 124 72, 125 95" fill="none" strokeWidth={3.5} opacity={0.5} />
        <circle cx="100" cy="36" r="7" fill="#00A5B5" />
        <path d="M32 96 Q 100 80, 168 96 Q 172 110, 156 110 Q 100 100, 44 110 Q 28 110, 32 96 Z" fill="#00747F" />
      </g>
      {/* 頭盔側邊的 $ 布章 */}
      <g transform="rotate(14 134 66)">
        <circle cx="134" cy="66" r="12" fill="#FDE021" stroke={INK} strokeWidth={4.5} />
        <path d="M138.5 60.5 C 133 57, 128 60.5, 131.5 65 C 135 68.5, 138.5 72, 129.5 72" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
        <path d="M134 56 V76" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />
      </g>
      <circle cx="63" cy="146" r="7.5" fill="#FF8FB8" />
      <circle cx="137" cy="146" r="7.5" fill="#FF8FB8" />
      {/* 眼睛：剛好、快用完了是豆豆眼加睫毛；超支換成皺眉、掉眼淚；慶祝笑瞇瞇 */}
      {mood === 'over' ? (
        <>
          <path d="M66 114 L90 121 M134 114 L110 121" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <circle cx="80" cy="131" r="5.5" fill={INK} />
          <circle cx="120" cy="131" r="5.5" fill={INK} />
          <path d="M78 141 Q 80 150, 78 158 M122 141 Q 120 150, 122 158" fill="none" stroke="#8FDBFF" strokeWidth={5} strokeLinecap="round" />
        </>
      ) : mood === 'yay' ? (
        <path d="M71 131 Q 80 118, 89 131 M111 131 Q 120 118, 129 131" fill="none" stroke={INK} strokeWidth={5.5} strokeLinecap="round" />
      ) : (
        <>
          <path d="M71 115 L67 109 M80 112 V105 M89 115 L93 109 M111 115 L107 109 M120 112 V105 M129 115 L133 109" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <ellipse cx="80" cy="128" rx="6" ry="8.5" fill={INK} />
          <ellipse cx="120" cy="128" rx="6" ry="8.5" fill={INK} />
          <circle cx="82" cy="124" r="2" fill="#FFFFFF" />
          <circle cx="122" cy="124" r="2" fill="#FFFFFF" />
        </>
      )}
      <path d="M94 141 Q 100 137, 106 141 Q 103 148, 100 148 Q 97 148, 94 141 Z" fill={INK} />
      {mood === 'ok' && <path d="M88 155 Q 100 167, 112 155" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />}
      {mood === 'tight' && <path d="M84 159 Q 90 153, 96 159 Q 102 165, 108 159 Q 114 153, 118 158" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />}
      {mood === 'over' && <ellipse cx="100" cy="161" rx="8" ry="9" fill={INK} />}
      {mood === 'yay' && (
        <>
          <path d="M84 153 Q 100 181, 116 153 Z" fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d="M91 164 Q 100 159, 109 164 Q 105 171, 100 171 Q 95 171, 91 164 Z" fill="#FF3A81" />
        </>
      )}
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
