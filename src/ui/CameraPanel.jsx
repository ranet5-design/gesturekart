import { useEffect, useRef } from 'react';
import { input } from '../cv/input.js';
import { pose, BONES } from '../cv/pose.js';

// Mirrored webcam view with the tracked skeleton and live gesture meters.
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
      ctx.scale(-1, 1); // mirror so it feels like a mirror
      if (pose.video && pose.video.readyState >= 2) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(pose.video, 0, 0, W, H);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, W, H);
      }
      const lm = input.landmarks;
      if (lm) {
        // head-level guide: raise the right hand above this line to stop
        const nose = lm[0];
        ctx.strokeStyle = input.halt ? '#ef4444' : 'rgba(255,255,255,0.35)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, nose.y * H);
        ctx.lineTo(W, nose.y * H);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.lineWidth = big ? 5 : 3;
        ctx.strokeStyle = '#22c55e';
        for (const [a, b] of BONES) {
          const p = lm[a];
          const q = lm[b];
          if ((p.visibility ?? 1) < 0.4 || (q.visibility ?? 1) < 0.4) continue;
          ctx.beginPath();
          ctx.moveTo(p.x * W, p.y * H);
          ctx.lineTo(q.x * W, q.y * H);
          ctx.stroke();
        }
        [0, 11, 12, 13, 14, 15, 16, 23, 24].forEach((i) => {
          const p = lm[i];
          if ((p.visibility ?? 1) < 0.4) return;
          ctx.fillStyle = i === 16 ? (input.halt ? '#ef4444' : '#facc15') : i === 15 ? '#facc15' : '#fff';
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, i === 15 || i === 16 ? (big ? 9 : 6) : big ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
        // hand span line = virtual steering wheel width
        const lw = lm[15];
        const rw = lm[16];
        if (input.handsVisible) {
          ctx.strokeStyle = 'rgba(250,204,21,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(lw.x * W, lw.y * H);
          ctx.lineTo(rw.x * W, rw.y * H);
          ctx.stroke();
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
      aria-label="Webcam view with tracked body pose"
    />
  );
}
