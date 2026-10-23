import * as THREE from 'three';

// Procedural canvas textures, so the game ships with zero image assets.

function canvasTex(w, h, draw, { repeat = [1, 1], wrap = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  t.anisotropy = 4;
  return t;
}

function noise(ctx, w, h, base, spread, count) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = Math.random() * spread;
    ctx.fillStyle = `rgba(${v > spread / 2 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

export const makeAsphalt = (repeatY) =>
  canvasTex(256, 256, (ctx, w, h) => {
    noise(ctx, w, h, '#3b3d42', 2, 9000);
    // a few patches and cracks for a lived-in Lahore road
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.06})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 6 + Math.random() * 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [2, repeatY] });

export const makeGrass = (rx, ry) =>
  canvasTex(128, 128, (ctx, w, h) => {
    noise(ctx, w, h, '#6f8f47', 2, 4000);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(40,70,20,${Math.random() * 0.25})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 3);
    }
  }, { repeat: [rx, ry] });

export const makeWater = (ry) =>
  canvasTex(128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#3e6f6a');
    g.addColorStop(0.5, '#4f8a80');
    g.addColorStop(1, '#3e6f6a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4 + Math.random() * 10, y + 1);
      ctx.stroke();
    }
  }, { repeat: [1, ry] });

export const makePavement = (ry) =>
  canvasTex(128, 128, (ctx, w, h) => {
    noise(ctx, w, h, '#b9ae9c', 2, 2000);
    ctx.strokeStyle = 'rgba(80,70,60,0.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y <= h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
  }, { repeat: [1, ry] });

// Signboard with big text lines. Used for billboards and the finish arch.
export const makeSign = (lines, { bg = '#0f5132', fg = '#ffffff', accent = '#ffd166', w = 512, h = 256 } = {}) =>
  canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = h / (lines.length + 1);
    lines.forEach((line, i) => {
      const size = i === 0 ? Math.round(h / 4.2) : Math.round(h / 7);
      ctx.font = `700 ${size}px "Space Grotesk", Arial, sans-serif`;
      ctx.fillStyle = i === 0 ? fg : accent;
      ctx.fillText(line, w / 2, step * (i + 1));
    });
  }, { wrap: false });

export const makeChecker = () =>
  canvasTex(256, 64, (ctx, w, h) => {
    const s = 16;
    for (let y = 0; y < h; y += s)
      for (let x = 0; x < w; x += s) {
        ctx.fillStyle = (x / s + y / s) % 2 ? '#111' : '#fff';
        ctx.fillRect(x, y, s, s);
      }
  }, { wrap: false });
