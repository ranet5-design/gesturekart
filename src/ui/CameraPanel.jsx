import { useEffect, useRef } from 'react';
import { input } from '../cv/input.js';
import { pose, BONES } from '../cv/pose.js';
import { settings } from '../game/settings.js';

// Mirrored webcam view with the tracked skeleton and a virtual steering wheel drawn between the hands.
export default function CameraPanel({ big = false }) {
  const canvas = useRef();
  const wheelRef = useRef({ cx: 0, cy: 0, r: 0 });
  useEffect(() => {
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      const W = c.width;
      const H = c.height;
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(W, 0);
      ctx.scale(-1, 1); // mirror, so moving right moves right on screen
      const privacy = settings.privacy;
      if (pose.video && pose.video.readyState >= 2 && !privacy) {
        ctx.drawImage(pose.video, 0, 0, W, H);
        ctx.fillStyle = 'rgba(8,12,24,0.25)';
        ctx.fillRect(0, 0, W, H);
      } else {
        // Privacy mode: no camera image at all, just a dark stage with a soft grid
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(148,163,184,0.08)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 32) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, H);
          ctx.stroke();
        }
        for (let gy = 0; gy < H; gy += 32) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(W, gy);
          ctx.stroke();
        }
      }
      const lm = input.landmarks;
      const k = big ? 1.6 : 1;
      // Privacy mode: draw the head as a plain circle (no face) so the stick figure still reads as a person
      if (privacy && lm && (lm[0].visibility ?? 1) > 0.5 && (lm[11].visibility ?? 1) > 0.5) {
        const sw = Math.abs(lm[11].x - lm[12].x) * W;
        ctx.fillStyle = input.locked ? 'rgba(34,197,94,0.35)' : 'rgba(245,158,11,0.35)';
        ctx.beginPath();
        ctx.arc(lm[0].x * W, lm[0].y * H, Math.max(14, sw * 0.38), 0, Math.PI * 2);
        ctx.fill();
      }
      if (lm) {
        const P = (i) => [lm[i].x * W, lm[i].y * H];
        const ok = (i) => (lm[i].visibility ?? 1) > 0.5;
        const bodyColor = input.locked ? '#22c55e' : '#f59e0b';

        // Brake line at head height
        if (ok(0)) {
          const y = lm[0].y * H;
          ctx.strokeStyle = input.halt ? '#ef4444' : 'rgba(255,255,255,0.28)';
          ctx.setLineDash([8, 8]);
          ctx.lineWidth = 2 * k;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.lineWidth = 3 * k;
        ctx.strokeStyle = bodyColor;
        ctx.lineCap = 'round';
        for (const [a, b] of BONES) {
          if (!ok(a) || !ok(b)) continue;
          ctx.beginPath();
          ctx.moveTo(...P(a));
          ctx.lineTo(...P(b));
          ctx.stroke();
        }

        // Virtual steering wheel between the hands. Its size is capped by shoulder width and its
        // position is eased, and it turns with the game's smoothed wheel angle, so it never jumps
        // across the face or fills the screen when the tracker glitches.
        const W2 = wheelRef.current;
        if (input.wheelHeld && !input.halt && ok(15) && ok(16) && ok(11) && ok(12)) {
          const [x1, y1] = P(15);
          const [x2, y2] = P(16);
          const swPx = Math.hypot(lm[11].x * W - lm[12].x * W, lm[11].y * H - lm[12].y * H);
          const shoulderY = ((lm[11].y + lm[12].y) / 2) * H;
          const tcx = (x1 + x2) / 2;
          const tcy = Math.max(shoulderY + swPx * 0.2, (y1 + y2) / 2);
          const tr = Math.min(swPx * 1.0, Math.max(swPx * 0.5, Math.hypot(x2 - x1, y2 - y1) / 2));
          if (!W2.r) Object.assign(W2, { cx: tcx, cy: tcy, r: tr });
          W2.cx += (tcx - W2.cx) * 0.25;
          W2.cy += (tcy - W2.cy) * 0.25;
          W2.r += (tr - W2.r) * 0.15;
          const { cx, cy, r } = W2;
          // The canvas is mirrored, so flip the angle to match what the player sees
          const a = -input.wheelAngle;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(a);
          ctx.strokeStyle = 'rgba(250,204,21,0.9)';
          ctx.lineWidth = 7 * k;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 5 * k;
          ctx.beginPath();
          ctx.moveTo(-r, 0);
          ctx.lineTo(r, 0);
          ctx.moveTo(0, 0);
          ctx.lineTo(0, r);
          ctx.stroke();
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-4 * k, -r - 10 * k, 8 * k, 14 * k); // top marker shows how far it's turned
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          W2.r = 0;
        }

        // Where to hold the hands: a soft box at chest height
        if (big && ok(11) && ok(12) && !input.wheelHeld) {
          const swPx = Math.abs(lm[11].x - lm[12].x) * W;
          const midX = ((lm[11].x + lm[12].x) / 2) * W;
          const top = ((lm[11].y + lm[12].y) / 2) * H + swPx * 0.25;
          ctx.setLineDash([10, 8]);
          ctx.strokeStyle = 'rgba(250,204,21,0.7)';
          ctx.lineWidth = 3;
          ctx.strokeRect(midX - swPx * 1.1, top, swPx * 2.2, swPx * 1.0);
          ctx.setLineDash([]);
        }

        [15, 16].forEach((i) => {
          if (!ok(i)) return;
          ctx.fillStyle = i === 16 && input.halt ? '#ef4444' : '#facc15';
          ctx.beginPath();
          ctx.arc(...P(i), 8 * k, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        if (ok(0)) {
          ctx.fillStyle = bodyColor;
          ctx.beginPath();
          ctx.arc(...P(0), 6 * k, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [big]);

  return (
    <canvas
      ref={canvas}
      className={big ? 'cam-canvas big' : 'cam-canvas'}
      width={big ? 640 : 320}
      height={big ? 480 : 240}
      aria-label="Webcam view with tracked body and virtual steering wheel"
    />
  );
}
