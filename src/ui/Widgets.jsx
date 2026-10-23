// Small visual pieces shared by the practice screen and the in-game dashboard.

/** A steering wheel that turns with the player's hands. angle in radians, + = right. */
export function Wheel({ angle = 0, held = true, halt = false, size = 160 }) {
  const deg = (angle * 180) / Math.PI;
  const tone = halt ? 'halt' : held ? 'held' : 'idle';
  return (
    <svg
      className={`wheel ${tone}`}
      width={size}
      height={size}
      viewBox="-100 -100 200 200"
      role="img"
      aria-label={`Steering wheel turned ${Math.round(deg)} degrees`}
    >
      <g style={{ transform: `rotate(${deg}deg)`, transition: 'transform 60ms linear' }}>
        <circle r="86" className="rim" />
        <circle r="86" className="rim-grip" />
        <path d="M -78 -10 L -24 -6 L -24 10 L -60 52 Z" className="spoke" />
        <path d="M 78 -10 L 24 -6 L 24 10 L 60 52 Z" className="spoke" />
        <path d="M -12 22 L 12 22 L 16 80 L -16 80 Z" className="spoke" />
        <circle r="28" className="hub" />
        <text y="7" textAnchor="middle" className="hub-text">GK</text>
        {/* top marker so you can see how far it's turned */}
        <rect x="-5" y="-98" width="10" height="20" rx="3" className="marker" />
      </g>
    </svg>
  );
}

/** Circular body-lock meter: 0..1 */
export function LockRing({ value = 0, locked = false, size = 120 }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.round(value * 100);
  return (
    <div className={`lock-ring ${locked ? 'locked' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <circle cx="60" cy="60" r={r} className="track" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className="value"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="lock-label">
        <b>{pct}%</b>
        <span>{locked ? 'Locked' : 'Body lock'}</span>
      </div>
    </div>
  );
}

/** Speed gauge arc with the speed limit marked. */
export function SpeedGauge({ kmh, limit, max = 90 }) {
  const a0 = -220;
  const a1 = 40;
  const ang = (v) => a0 + ((a1 - a0) * Math.min(v, max)) / max;
  const pt = (deg, rad) => [Math.cos((deg * Math.PI) / 180) * rad, Math.sin((deg * Math.PI) / 180) * rad];
  const arc = (from, to, rad) => {
    const [x0, y0] = pt(from, rad);
    const [x1, y1] = pt(to, rad);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${large} 1 ${x1} ${y1}`;
  };
  const over = kmh > limit;
  const [lx, ly] = pt(ang(limit), 80);
  return (
    <svg className={`gauge ${over ? 'over' : ''}`} viewBox="-100 -100 200 170" role="img" aria-label={`${kmh} km/h`}>
      <path d={arc(a0, a1, 80)} className="g-track" />
      <path d={arc(ang(limit), a1, 80)} className="g-danger" />
      {kmh > 0.5 && <path d={arc(a0, ang(kmh), 80)} className="g-value" />}
      <circle cx={lx} cy={ly} r="7" className="g-limit" />
      <text y="8" textAnchor="middle" className="g-num">
        {kmh}
      </text>
      <text y="34" textAnchor="middle" className="g-unit">
        km/h · limit {limit}
      </text>
    </svg>
  );
}
