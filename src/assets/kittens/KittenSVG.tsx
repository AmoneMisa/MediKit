/**
 * Chunky grumpy orange tabby kitten SVGs.
 * Thick dark outlines, tabby stripes, heavy-lidded grumpy eyes.
 */
import React from 'react';

let Svg: any, Circle: any, Ellipse: any, Path: any, G: any, Rect: any;
try {
  const L = require('react-native-svg');
  Svg = L.Svg; Circle = L.Circle; Ellipse = L.Ellipse;
  Path = L.Path; G = L.G; Rect = L.Rect;
} catch {}

// ── colour palette ─────────────────────────────────────────────────────────────
const OL = '#3D1400'; // thick dark outline
const BO = '#E07828'; // body orange
const ST = '#B85C00'; // tabby stripe
const BL = '#F2B060'; // light belly / muzzle
const EP = '#FF9BAD'; // ear inner pink
const NS = '#FF6080'; // nose pink
const WH = '#FFFFFF'; // white
const IR = '#2A7000'; // iris green
const PU = '#080800'; // pupil

const OW = 3; // standard outline stroke width

// ── CatHead ───────────────────────────────────────────────────────────────────
// Shared head component: ears, head circle, face details.
// cx/cy = head centre, r = radius, closed = sleeping eyes

function CatHead({
  cx, cy, r, closed = false,
}: {
  cx: number; cy: number; r: number; closed?: boolean;
}) {
  const elx = cx - r * 0.36; // left eye x
  const erx = cx + r * 0.36; // right eye x
  const ey  = cy - r * 0.04; // eye y
  const eR  = r * 0.22;      // eye radius

  return (
    <G>
      {/* ── Left ear ── */}
      <Path
        d={`M${cx - r * 0.62} ${cy - r * 0.72} L${cx - r * 0.80} ${cy - r * 1.38} L${cx - r * 0.20} ${cy - r * 0.88} Z`}
        fill={BO} stroke={OL} strokeWidth={OW} strokeLinejoin="round"
      />
      <Path
        d={`M${cx - r * 0.58} ${cy - r * 0.73} L${cx - r * 0.73} ${cy - r * 1.22} L${cx - r * 0.25} ${cy - r * 0.88} Z`}
        fill={EP}
      />

      {/* ── Right ear ── */}
      <Path
        d={`M${cx + r * 0.20} ${cy - r * 0.88} L${cx + r * 0.80} ${cy - r * 1.38} L${cx + r * 0.62} ${cy - r * 0.72} Z`}
        fill={BO} stroke={OL} strokeWidth={OW} strokeLinejoin="round"
      />
      <Path
        d={`M${cx + r * 0.25} ${cy - r * 0.88} L${cx + r * 0.73} ${cy - r * 1.22} L${cx + r * 0.58} ${cy - r * 0.73} Z`}
        fill={EP}
      />

      {/* ── Head circle ── */}
      <Circle cx={cx} cy={cy} r={r} fill={BO} stroke={OL} strokeWidth={OW} />

      {/* ── Muzzle (lighter area) ── */}
      <Ellipse cx={cx} cy={cy + r * 0.10} rx={r * 0.60} ry={r * 0.52} fill={BL} />

      {/* ── Forehead tabby stripes ── */}
      <Path d={`M${cx - r * 0.12} ${cy - r * 0.65} L${cx - r * 0.10} ${cy - r * 0.34}`}
        stroke={ST} strokeWidth={2.5} strokeLinecap="round" />
      <Path d={`M${cx} ${cy - r * 0.70} L${cx} ${cy - r * 0.37}`}
        stroke={ST} strokeWidth={2.5} strokeLinecap="round" />
      <Path d={`M${cx + r * 0.12} ${cy - r * 0.65} L${cx + r * 0.10} ${cy - r * 0.34}`}
        stroke={ST} strokeWidth={2.5} strokeLinecap="round" />

      {/* ── Eyes ── */}
      {closed ? (
        /* Sleeping: curved shut arcs */
        <G>
          <Path
            d={`M${elx - eR} ${ey + eR * 0.1} Q${elx} ${ey - eR * 0.75} ${elx + eR} ${ey + eR * 0.1}`}
            stroke={OL} strokeWidth={2.2} fill="none" strokeLinecap="round"
          />
          <Path
            d={`M${erx - eR} ${ey + eR * 0.1} Q${erx} ${ey - eR * 0.75} ${erx + eR} ${ey + eR * 0.1}`}
            stroke={OL} strokeWidth={2.2} fill="none" strokeLinecap="round"
          />
        </G>
      ) : (
        /* Grumpy open eyes: heavy upper lids + inward-angled brows */
        <G>
          {/* Left eye */}
          <Ellipse cx={elx} cy={ey} rx={eR} ry={eR * 0.86} fill={WH} stroke={OL} strokeWidth={2} />
          <Circle  cx={elx} cy={ey + eR * 0.12} r={eR * 0.65} fill={IR} />
          <Circle  cx={elx} cy={ey + eR * 0.12} r={eR * 0.36} fill={PU} />
          <Circle  cx={elx - eR * 0.28} cy={ey - eR * 0.18} r={eR * 0.19} fill={WH} />
          {/* Heavy upper lid overlay */}
          <Path
            d={`M${elx - eR} ${ey} Q${elx} ${ey - eR * 1.15} ${elx + eR} ${ey}`}
            fill={BO} stroke={OL} strokeWidth={1.8}
          />
          {/* Grumpy brow: lower outside, higher inside */}
          <Path
            d={`M${elx - eR - 2} ${ey - eR * 2.1} L${elx + eR * 0.4} ${ey - eR * 2.65}`}
            stroke={OL} strokeWidth={2.8} strokeLinecap="round"
          />

          {/* Right eye */}
          <Ellipse cx={erx} cy={ey} rx={eR} ry={eR * 0.86} fill={WH} stroke={OL} strokeWidth={2} />
          <Circle  cx={erx} cy={ey + eR * 0.12} r={eR * 0.65} fill={IR} />
          <Circle  cx={erx} cy={ey + eR * 0.12} r={eR * 0.36} fill={PU} />
          <Circle  cx={erx - eR * 0.28} cy={ey - eR * 0.18} r={eR * 0.19} fill={WH} />
          {/* Heavy upper lid overlay */}
          <Path
            d={`M${erx - eR} ${ey} Q${erx} ${ey - eR * 1.15} ${erx + eR} ${ey}`}
            fill={BO} stroke={OL} strokeWidth={1.8}
          />
          {/* Grumpy brow: higher inside, lower outside */}
          <Path
            d={`M${erx - eR * 0.4} ${ey - eR * 2.65} L${erx + eR + 2} ${ey - eR * 2.1}`}
            stroke={OL} strokeWidth={2.8} strokeLinecap="round"
          />
        </G>
      )}

      {/* ── Nose ── */}
      <Ellipse cx={cx} cy={cy + r * 0.24} rx={r * 0.09} ry={r * 0.065} fill={NS} />

      {/* ── Mouth (grumpy frown) ── */}
      <Path
        d={`M${cx - r * 0.20} ${cy + r * 0.40} Q${cx} ${cy + r * 0.34} ${cx + r * 0.20} ${cy + r * 0.40}`}
        stroke={OL} strokeWidth={2} fill="none" strokeLinecap="round"
      />

      {/* ── Whiskers ── */}
      <Path d={`M${cx - r * 1.10} ${cy + r * 0.20} L${cx - r * 0.56} ${cy + r * 0.24}`}
        stroke={WH} strokeWidth={1.5} strokeLinecap="round" opacity={0.9} />
      <Path d={`M${cx - r * 1.10} ${cy + r * 0.32} L${cx - r * 0.56} ${cy + r * 0.30}`}
        stroke={WH} strokeWidth={1.5} strokeLinecap="round" opacity={0.9} />
      <Path d={`M${cx + r * 1.10} ${cy + r * 0.20} L${cx + r * 0.56} ${cy + r * 0.24}`}
        stroke={WH} strokeWidth={1.5} strokeLinecap="round" opacity={0.9} />
      <Path d={`M${cx + r * 1.10} ${cy + r * 0.32} L${cx + r * 0.56} ${cy + r * 0.30}`}
        stroke={WH} strokeWidth={1.5} strokeLinecap="round" opacity={0.9} />
    </G>
  );
}

// ── KittenSleeping ─────────────────────────────────────────────────────────────
// Curled up horizontal, eyes closed, ZZZ floating

export function KittenSleeping({ size = 150 }: { size?: number }) {
  if (!Svg) return null;
  const w = size;
  const h = Math.round(size * 0.73);
  return (
    <Svg width={w} height={h} viewBox="0 0 200 146">

      {/* Ground shadow */}
      <Ellipse cx={95} cy={140} rx={68} ry={7} fill="rgba(0,0,0,0.10)" />

      {/* Tail — outline then fill */}
      <Path d="M26 94 Q5 72 10 48 Q16 28 32 30" stroke={OL} strokeWidth={16} fill="none" strokeLinecap="round" />
      <Path d="M26 94 Q5 72 10 48 Q16 28 32 30" stroke={BO} strokeWidth={10} fill="none" strokeLinecap="round" />
      <Path d="M27 90 Q8 70 13 50" stroke={ST} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.65} />

      {/* Body */}
      <Ellipse cx={94} cy={102} rx={70} ry={34} fill={BO} stroke={OL} strokeWidth={OW} />
      {/* Belly */}
      <Ellipse cx={100} cy={110} rx={46} ry={20} fill={BL} />
      {/* Body stripes */}
      <Path d="M52 82 Q48 100 50 120" stroke={ST} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.65} />
      <Path d="M136 82 Q140 100 138 120" stroke={ST} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.65} />

      {/* Front paws resting */}
      <Ellipse cx={130} cy={126} rx={17} ry={10} fill={BO} stroke={OL} strokeWidth={2} />
      <Ellipse cx={155} cy={128} rx={17} ry={10} fill={BO} stroke={OL} strokeWidth={2} />
      {/* Toe lines */}
      <Path d="M121 128 L121 133" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M130 130 L130 135" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M139 128 L139 133" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M146 130 L146 135" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M155 132 L155 137" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M164 130 L164 135" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />

      {/* Head — sleeping */}
      <CatHead cx={150} cy={67} r={35} closed={true} />

      {/* ZZZ */}
      <Path d="M174 40 L183 40 L174 50 L183 50" stroke={ST} strokeWidth={2} fill="none"
        strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <Path d="M181 26 L192 26 L181 38 L192 38" stroke={ST} strokeWidth={2.5} fill="none"
        strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
    </Svg>
  );
}

// ── KittenWaving ──────────────────────────────────────────────────────────────
// Sitting, one paw raised, grumpy expression

export function KittenWaving({ size = 140 }: { size?: number }) {
  if (!Svg) return null;
  const w = size;
  const h = Math.round(size * 1.46);
  return (
    <Svg width={w} height={h} viewBox="0 0 160 205">

      {/* Ground shadow */}
      <Ellipse cx={80} cy={200} rx={50} ry={6} fill="rgba(0,0,0,0.10)" />

      {/* Tail — right side */}
      <Path d="M128 156 Q156 136 148 108" stroke={OL} strokeWidth={16} fill="none" strokeLinecap="round" />
      <Path d="M128 156 Q156 136 148 108" stroke={BO} strokeWidth={10} fill="none" strokeLinecap="round" />
      <Path d="M130 150 Q154 132 146 110" stroke={ST} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.65} />

      {/* Body */}
      <Ellipse cx={80} cy={150} rx={50} ry={40} fill={BO} stroke={OL} strokeWidth={OW} />
      {/* Belly */}
      <Ellipse cx={80} cy={160} rx={30} ry={26} fill={BL} />
      {/* Body stripes */}
      <Path d="M44 122 Q38 150 42 176" stroke={ST} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.65} />
      <Path d="M116 122 Q122 150 118 176" stroke={ST} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.65} />

      {/* Raised left arm — outline then fill */}
      <Path d="M34 122 Q14 94 16 62 Q18 38 28 26" stroke={OL} strokeWidth={17} fill="none" strokeLinecap="round" />
      <Path d="M34 122 Q14 94 16 62 Q18 38 28 26" stroke={BO} strokeWidth={11} fill="none" strokeLinecap="round" />
      <Path d="M35 116 Q16 90 18 62" stroke={ST} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />

      {/* Raised paw */}
      <Circle cx={28} cy={20} r={15} fill={BO} stroke={OL} strokeWidth={OW} />
      {/* Toe blobs on raised paw (pointing up) */}
      <Ellipse cx={20} cy={11} rx={5} ry={6} fill={BO} stroke={OL} strokeWidth={2} />
      <Ellipse cx={28} cy={9}  rx={5} ry={6} fill={BO} stroke={OL} strokeWidth={2} />
      <Ellipse cx={36} cy={11} rx={5} ry={6} fill={BO} stroke={OL} strokeWidth={2} />

      {/* Right paw (resting) */}
      <Ellipse cx={106} cy={188} rx={17} ry={10} fill={BO} stroke={OL} strokeWidth={2} />
      <Path d="M97 190 L97 195"  stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M106 192 L106 197" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M115 190 L115 195" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />

      {/* Left paw (resting) */}
      <Ellipse cx={54} cy={188} rx={17} ry={10} fill={BO} stroke={OL} strokeWidth={2} />
      <Path d="M45 190 L45 195"  stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M54 192 L54 197"  stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M63 190 L63 195"  stroke={OL} strokeWidth={1.5} strokeLinecap="round" />

      {/* Head */}
      <CatHead cx={80} cy={68} r={42} />
    </Svg>
  );
}

// ── KittenWithPill ────────────────────────────────────────────────────────────
// Sitting, both paws extended, holding a pill — suspicious look

export function KittenWithPill({ size = 130 }: { size?: number }) {
  if (!Svg) return null;
  const w = size;
  const h = Math.round(size * 1.58);
  return (
    <Svg width={w} height={h} viewBox="0 0 160 205">

      {/* Ground shadow */}
      <Ellipse cx={80} cy={200} rx={50} ry={6} fill="rgba(0,0,0,0.10)" />

      {/* Tail */}
      <Path d="M128 156 Q155 138 148 112" stroke={OL} strokeWidth={16} fill="none" strokeLinecap="round" />
      <Path d="M128 156 Q155 138 148 112" stroke={BO} strokeWidth={10} fill="none" strokeLinecap="round" />
      <Path d="M130 150 Q152 134 146 114" stroke={ST} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.65} />

      {/* Body */}
      <Ellipse cx={80} cy={150} rx={50} ry={40} fill={BO} stroke={OL} strokeWidth={OW} />
      <Ellipse cx={80} cy={160} rx={30} ry={26} fill={BL} />
      <Path d="M44 122 Q38 150 42 176" stroke={ST} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.65} />
      <Path d="M116 122 Q122 150 118 176" stroke={ST} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.65} />

      {/* Left arm extended */}
      <Path d="M36 130 Q16 144 14 164" stroke={OL} strokeWidth={17} fill="none" strokeLinecap="round" />
      <Path d="M36 130 Q16 144 14 164" stroke={BO} strokeWidth={11} fill="none" strokeLinecap="round" />

      {/* Right arm extended */}
      <Path d="M124 130 Q144 144 146 164" stroke={OL} strokeWidth={17} fill="none" strokeLinecap="round" />
      <Path d="M124 130 Q144 144 146 164" stroke={BO} strokeWidth={11} fill="none" strokeLinecap="round" />

      {/* Left extended paw */}
      <Circle cx={14} cy={170} r={13} fill={BO} stroke={OL} strokeWidth={2.5} />
      <Ellipse cx={6}  cy={163} rx={5} ry={5.5} fill={BO} stroke={OL} strokeWidth={2} />
      <Ellipse cx={14} cy={161} rx={5} ry={5.5} fill={BO} stroke={OL} strokeWidth={2} />
      <Ellipse cx={22} cy={163} rx={5} ry={5.5} fill={BO} stroke={OL} strokeWidth={2} />

      {/* Right extended paw */}
      <Circle cx={146} cy={170} r={13} fill={BO} stroke={OL} strokeWidth={2.5} />
      <Ellipse cx={138} cy={163} rx={5} ry={5.5} fill={BO} stroke={OL} strokeWidth={2} />
      <Ellipse cx={146} cy={161} rx={5} ry={5.5} fill={BO} stroke={OL} strokeWidth={2} />
      <Ellipse cx={154} cy={163} rx={5} ry={5.5} fill={BO} stroke={OL} strokeWidth={2} />

      {/* Pill between paws */}
      <Ellipse cx={80} cy={176} rx={26} ry={15} fill={WH} stroke={OL} strokeWidth={2} />
      <Path d="M54 176 Q54 161 80 161 Q80 191 80 191 Q54 191 54 176 Z" fill="#78A9FF" />
      <Path d="M80 161 L80 191" stroke={WH} strokeWidth={1.5} />

      {/* Front bottom paws */}
      <Ellipse cx={55} cy={190} rx={16} ry={10} fill={BO} stroke={OL} strokeWidth={2} />
      <Ellipse cx={105} cy={190} rx={16} ry={10} fill={BO} stroke={OL} strokeWidth={2} />

      {/* Head — slightly curious tilt kept simple */}
      <CatHead cx={80} cy={68} r={42} />
    </Svg>
  );
}

// ── KittenDoctor ──────────────────────────────────────────────────────────────
// Sitting, stethoscope around neck, serious/wise look

export function KittenDoctor({ size = 130 }: { size?: number }) {
  if (!Svg) return null;
  const w = size;
  const h = Math.round(size * 1.58);
  return (
    <Svg width={w} height={h} viewBox="0 0 160 205">

      {/* Ground shadow */}
      <Ellipse cx={80} cy={200} rx={50} ry={6} fill="rgba(0,0,0,0.10)" />

      {/* Tail */}
      <Path d="M128 156 Q155 138 148 112" stroke={OL} strokeWidth={16} fill="none" strokeLinecap="round" />
      <Path d="M128 156 Q155 138 148 112" stroke={BO} strokeWidth={10} fill="none" strokeLinecap="round" />
      <Path d="M130 150 Q152 134 146 114" stroke={ST} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.65} />

      {/* Body */}
      <Ellipse cx={80} cy={150} rx={50} ry={40} fill={BO} stroke={OL} strokeWidth={OW} />
      <Ellipse cx={80} cy={160} rx={30} ry={26} fill={BL} />
      <Path d="M44 122 Q38 150 42 176" stroke={ST} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.65} />
      <Path d="M116 122 Q122 150 118 176" stroke={ST} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.65} />

      {/* Stethoscope tubing */}
      {/* Ear-piece arcs */}
      <Path d="M60 108 Q48 106 44 94 Q40 82 48 80" stroke="#555050" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d="M100 108 Q112 106 116 94 Q120 82 112 80" stroke="#555050" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* Ear-piece ends */}
      <Circle cx={48} cy={80} r={4} fill="#555050" />
      <Circle cx={112} cy={80} r={4} fill="#555050" />
      {/* Tube going down to chest piece */}
      <Path d="M60 108 Q58 136 72 158" stroke="#555050" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d="M100 108 Q102 136 88 158" stroke="#555050" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* Chest piece disc */}
      <Circle cx={80} cy={162} r={10} fill="#888080" stroke={OL} strokeWidth={2} />
      <Circle cx={80} cy={162} r={6} fill="#555050" />

      {/* Front paws */}
      <Ellipse cx={55} cy={188} rx={17} ry={10} fill={BO} stroke={OL} strokeWidth={2} />
      <Ellipse cx={105} cy={188} rx={17} ry={10} fill={BO} stroke={OL} strokeWidth={2} />
      <Path d="M46 190 L46 195" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M55 192 L55 197" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M64 190 L64 195" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M96 190 L96 195" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M105 192 L105 197" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M114 190 L114 195" stroke={OL} strokeWidth={1.5} strokeLinecap="round" />

      {/* Head */}
      <CatHead cx={80} cy={68} r={42} />

      {/* Small round glasses */}
      <Circle cx={63} cy={66} r={13} fill="none" stroke="#808080" strokeWidth={1.8} opacity={0.7} />
      <Circle cx={97} cy={66} r={13} fill="none" stroke="#808080" strokeWidth={1.8} opacity={0.7} />
      <Path d="M76 66 L84 66" stroke="#808080" strokeWidth={1.8} opacity={0.7} />
    </Svg>
  );
}
