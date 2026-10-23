import { useEffect, useRef } from 'react';
import { input } from '../cv/input.js';
import { pose, BONES } from '../cv/pose.js';

// Mirrored webcam view with the tracked skeleton and a virtual steering wheel drawn between the hands.
export default function CameraPanel({ big = false }) {
  const canvas = useRef();
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
      if (pose.video && pose.video.readyState >= 2) {
        ctx.drawImage(pose.video, 0, 0, W, H);
        ctx.fillStyle = 'rgba(8,12,24,0.25)';
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, W, H);
      }
      const lm = input.landmarks;
      const k = big ? 1.6 : 1;
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

        // Virtual steering wheel held between the two wrists
        if (input.wheelHeld && ok(15) && ok(16)) {
          const [x1, y1] = P(15);
          const [x2, y2] = P(16);
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          const r = Math.hypot(x2 - x1, y2 - y1) / 2;
          ctx.strokeStyle = 'rgba(250,204,21,0.95)';
          ctx.lineWidth = 7 * k;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 5 * k;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          // bottom spoke, perpendicular to the hand line
          const nx = -(y2 - y1) / (2 * r || 1);
          const ny = (x2 - x1) / (2 * r || 1);
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + nx * r, cy + ny * r);
          ctx.stroke();
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(250,204,21,0.95)';
          ctx.lineWidth = 3 * k;
          ctx.stroke();
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
