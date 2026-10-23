import { SKILL_NAMES } from '../game/rules.js';

/** Six-axis radar of driving skills (0–100). Skills a drive didn't test are drawn as "–". */
export default function SkillRadar({ skills, size = 220, light = false }) {
  const keys = Object.keys(SKILL_NAMES);
  const R = size * 0.34;
  const c = size / 2;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / keys.length;
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v];
  };
  const poly = keys.map((k, i) => pt(i, (skills?.[k] ?? 0) / 100).join(',')).join(' ');
  return (
    <svg className={`radar ${light ? 'light' : ''}`} viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Driving skills radar">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={keys.map((_, i) => pt(i, f).join(',')).join(' ')} className="r-grid" />
      ))}
      {keys.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} className="r-grid" />;
      })}
      <polygon points={poly} className="r-val" />
      {keys.map((k, i) => {
        const [x, y] = pt(i, 1.28);
        const v = skills?.[k];
        return (
          <text key={k} x={x} y={y} textAnchor="middle" className="r-label">
            <tspan x={x} dy="0">{SKILL_NAMES[k]}</tspan>
            <tspan x={x} dy="13" className={v == null ? 'r-na' : v >= 85 ? 'r-good' : v >= 60 ? 'r-warn' : 'r-bad'}>
              {v == null ? '–' : v}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

// Which level to practise for a weak skill
export const PRACTICE_FOR = { signals: 2, lanes: 5, speed: 4, distance: 3, people: 2, focus: 6 };

export function weakestSkill(skills) {
  if (!skills) return null;
  let worst = null;
  for (const [k, v] of Object.entries(skills)) {
    if (v == null) continue;
    if (!worst || v < worst.v) worst = { k, v };
  }
  return worst && worst.v < 85 ? worst : null;
}
