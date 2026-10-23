import { jsPDF } from 'jspdf';
import { SPEED_LIMIT_KMH } from '../game/config.js';

export const EVENT_INFO = {
  redLight: { label: 'Red lights run', bad: true },
  pedestrian: { label: 'Pedestrian incidents', bad: true },
  crash: { label: 'Collisions', bad: true },
  overspeed: { label: 'Over-speeding', bad: true },
  tailgate: { label: 'Tailgating', bad: true },
  straddle: { label: 'Lane straddling', bad: true },
  unsafeLane: { label: 'Unsafe lane changes', bad: true },
  goodStop: { label: 'Proper stops at red', bad: false },
  cleanLane: { label: 'Clean lane changes', bad: false },
};

export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Plain-language coaching, like a driving instructor's notes at the end of a lesson.
export function coachTips(r) {
  const c = r.counts;
  const tips = [];
  if (c.pedestrian) tips.push('Pedestrians on a zebra crossing always have right of way. Stop well before the line.');
  if (c.redLight) tips.push('Raise your right hand early when a signal turns yellow, so you stop before the line.');
  if (c.crash) tips.push('Leave a gap of at least two seconds to the vehicle ahead. Rickshaws and buses stop suddenly.');
  if (c.overspeed) tips.push(`Canal Road is limited to ${SPEED_LIMIT_KMH} km/h. Keep your hands a little closer together.`);
  if (c.tailgate) tips.push('You followed too closely. Ease off and let the gap grow before overtaking.');
  if (c.straddle || c.unsafeLane) tips.push('Pick a lane and commit. Change lanes in one smooth lean, never near a crossing.');
  if (r.reason !== 'finish') tips.push('Finish the full route to earn a complete score.');
  if (!tips.length) tips.push('Excellent discipline. You obeyed every signal and kept your lane. Share your score and challenge a friend!');
  return tips.slice(0, 4);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  ctx.fillText(line, x, y);
  return y + lh;
}

const scoreColor = (s) => (s >= 85 ? '#15803d' : s >= 55 ? '#b45309' : '#b91c1c');

export async function drawCard(r) {
  try {
    await document.fonts.ready;
  } catch {
    /* fonts are optional */
  }
  const W = 1240;
  const H = 1754;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const F = (w, size) => `${w} ${size}px "Space Grotesk", Arial, sans-serif`;
  const M = (size) => `700 ${size}px "JetBrains Mono", Consolas, monospace`;

  ctx.fillStyle = '#f8f5ef';
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, 210);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(0, 210, W / 3, 10);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(W / 3, 210, W / 3, 10);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect((2 * W) / 3, 210, W / 3, 10);
  ctx.fillStyle = '#fff';
  ctx.font = F(700, 64);
  ctx.fillText('GestureKart', 70, 105);
  ctx.font = F(500, 28);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('CIVIC DRIVING SCORE CARD', 70, 155);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = F(500, 26);
  ctx.fillText(r.route, W - 70, 100);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(
    r.date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    W - 70,
    145,
  );
  ctx.textAlign = 'left';

  // Driver + score
  ctx.fillStyle = '#64748b';
  ctx.font = F(500, 26);
  ctx.fillText('DRIVER', 70, 300);
  ctx.fillStyle = '#0f172a';
  ctx.font = F(700, 60);
  ctx.fillText(r.player.slice(0, 22), 70, 370);
  ctx.fillStyle = '#334155';
  ctx.font = F(500, 30);
  ctx.fillText(r.label, 70, 425);
  ctx.fillStyle = '#64748b';
  ctx.font = F(400, 24);
  const endText =
    r.reason === 'finish' ? 'Completed the full route' : r.reason === 'suspended' ? 'Drive ended: licence suspended' : 'Drive ended early';
  ctx.fillText(`${endText} · ${r.mode === 'camera' ? 'Webcam gesture control' : 'Keyboard control'}`, 70, 470);

  // Score ring
  const cx = W - 220;
  const cy = 390;
  const R = 130;
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = scoreColor(r.score);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * r.score) / 100);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.textAlign = 'center';
  ctx.fillStyle = scoreColor(r.score);
  ctx.font = F(700, 40);
  ctx.fillText(`Grade ${r.grade}`, cx, cy - 52);
  ctx.fillStyle = '#0f172a';
  ctx.font = M(88);
  ctx.fillText(String(r.score), cx, cy + 36);
  ctx.font = F(500, 24);
  ctx.fillStyle = '#64748b';
  ctx.fillText('out of 100', cx, cy + 76);
  ctx.textAlign = 'left';

  // Stats grid
  const stats = [
    ['Distance', `${(r.distance / 1000).toFixed(2)} km`],
    ['Drive time', fmtTime(r.time)],
    ['Average speed', `${Math.round(r.avgKmh)} km/h`],
    ['Top speed', `${Math.round(r.maxKmh)} km/h`],
    ['Signals passed', `${r.signalsPassed}`],
    ['Proper stops', `${r.properStops}`],
    ['Red lights run', `${r.redsRun}`],
    ['Clean lane changes', `${r.counts.cleanLane || 0}`],
    ['Collisions', `${r.counts.crash || 0}`],
    ['Over-speeding', `${r.counts.overspeed || 0}`],
    ['Tailgating', `${r.counts.tailgate || 0}`],
    ['Pedestrian incidents', `${r.counts.pedestrian || 0}`],
  ];
  const gx = 70;
  const gy = 530;
  const cw = (W - 140 - 3 * 20) / 4;
  const ch = 120;
  stats.forEach(([k, v], i) => {
    const x = gx + (i % 4) * (cw + 20);
    const y = gy + Math.floor(i / 4) * (ch + 20);
    ctx.fillStyle = '#fff';
    roundRect(ctx, x, y, cw, ch, 14);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = F(500, 22);
    ctx.fillText(k, x + 22, y + 42);
    const bad = /run|Collisions|Over|Tail|Pedestrian/.test(k) && v !== '0';
    ctx.fillStyle = bad ? '#b91c1c' : '#0f172a';
    ctx.font = M(40);
    ctx.fillText(v, x + 22, y + 94);
  });

  // Speed chart
  const px = 70;
  const py = 980;
  const pw = W - 140;
  const ph = 260;
  ctx.fillStyle = '#0f172a';
  ctx.font = F(700, 30);
  ctx.fillText('Speed through the drive', px, py - 20);
  ctx.fillStyle = '#fff';
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();
  const tel = r.telemetry;
  const maxT = Math.max(1, r.time);
  const maxK = 90;
  const X = (t) => px + 20 + ((pw - 40) * t) / maxT;
  const Y = (k) => py + ph - 20 - ((ph - 40) * Math.min(k, maxK)) / maxK;
  // limit line
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + 20, Y(SPEED_LIMIT_KMH));
  ctx.lineTo(px + pw - 20, Y(SPEED_LIMIT_KMH));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ef4444';
  ctx.font = F(500, 20);
  ctx.fillText(`limit ${SPEED_LIMIT_KMH}`, px + pw - 110, Y(SPEED_LIMIT_KMH) - 10);
  if (tel.length > 1) {
    ctx.beginPath();
    tel.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.kmh)) : ctx.moveTo(X(p.t), Y(p.kmh))));
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  r.events.forEach((e) => {
    const k = tel.find((p) => p.t >= e.t)?.kmh ?? 0;
    ctx.fillStyle = e.points < 0 ? '#dc2626' : '#16a34a';
    ctx.beginPath();
    ctx.arc(X(e.t), Y(k), 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  ctx.fillStyle = '#64748b';
  ctx.font = F(400, 20);
  ctx.fillText('0:00', px + 20, py + ph + 30);
  ctx.textAlign = 'right';
  ctx.fillText(fmtTime(r.time), px + pw - 20, py + ph + 30);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#dc2626';
  ctx.fillText('● violation', px + pw / 2 - 150, py + ph + 30);
  ctx.fillStyle = '#16a34a';
  ctx.fillText('● good habit', px + pw / 2 + 10, py + ph + 30);

  // Event log
  const ly = 1320;
  ctx.fillStyle = '#0f172a';
  ctx.font = F(700, 30);
  ctx.fillText('Drive log', 70, ly);
  ctx.font = F(400, 22);
  const list = r.events.slice(-9);
  if (!list.length) {
    ctx.fillStyle = '#64748b';
    ctx.fillText('No events recorded.', 70, ly + 45);
  }
  list.forEach((e, i) => {
    const y = ly + 45 + i * 34;
    ctx.fillStyle = '#64748b';
    ctx.font = M(20);
    ctx.fillText(fmtTime(e.t), 70, y);
    ctx.font = F(500, 22);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(e.label, 160, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = e.points < 0 ? '#dc2626' : '#16a34a';
    ctx.font = M(22);
    ctx.fillText(`${e.points > 0 ? '+' : ''}${e.points}`, 600, y);
    ctx.textAlign = 'left';
  });

  // Coach notes
  ctx.fillStyle = '#0f172a';
  ctx.font = F(700, 30);
  ctx.fillText("Coach's notes", 660, ly);
  ctx.font = F(400, 23);
  let ty = ly + 45;
  coachTips(r).forEach((tip) => {
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(660, ty - 17, 8, 8);
    ctx.fillStyle = '#334155';
    ty = wrap(ctx, tip, 685, ty, W - 70 - 685, 32) + 10;
  });

  // Footer
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, H - 80, W, 80);
  ctx.fillStyle = '#94a3b8';
  ctx.font = F(400, 20);
  ctx.fillText('GestureKart · Physical gesture-controlled traffic rule training · MediaPipe Pose + Three.js', 70, H - 33);
  return c;
}

function fileBase(r) {
  return `GestureKart-Civic-Score-${r.player.replace(/[^a-z0-9]+/gi, '-')}`;
}

export async function downloadPNG(r) {
  const c = await drawCard(r);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `${fileBase(r)}.png`;
  a.click();
}

export async function downloadPDF(r) {
  const c = await drawCard(r);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  pdf.setProperties({ title: `GestureKart Civic Driving Score: ${r.player}`, creator: 'GestureKart' });
  pdf.save(`${fileBase(r)}.pdf`);
}
