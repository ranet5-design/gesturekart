// Landmark smoothing with the One Euro filter (Casiez et al., 2012), the standard way to steady
// jittery tracking in VR and gesture apps: very smooth when still, quick to follow fast moves.
// Pure code, no browser APIs.

const alpha = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

class OneEuro {
  constructor(minCutoff, beta, dCutoff = 0.5) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = null;
    this.dx = 0;
  }
  step(v, dt) {
    if (this.x == null || !(dt > 0)) {
      this.x = v;
      this.dx = 0;
      return v;
    }
    const rawDx = (v - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
  reset() {
    this.x = null;
    this.dx = 0;
  }
}

/**
 * Smooths all 33 pose landmarks. On top of One Euro it rejects single-frame "teleports": if a point
 * jumps more than `maxJump` (in frame widths) while it is not clearly seen, the old position is kept
 * for up to a few frames instead of following the glitch.
 */
export function createLandmarkFilter({ minCutoff = 0.55, beta = 2.5, maxJump = 0.22, holdFrames = 4 } = {}) {
  let filters = null;
  let last = null;
  let held = [];
  return {
    reset() {
      filters = null;
      last = null;
    },
    step(lm, dt) {
      if (!lm) {
        filters?.forEach((f) => f.forEach((g) => g.reset()));
        last = null;
        return null;
      }
      if (!filters) {
        filters = lm.map(() => [new OneEuro(minCutoff, beta), new OneEuro(minCutoff, beta), new OneEuro(minCutoff, beta)]);
        held = lm.map(() => 0);
      }
      const out = lm.map((p, i) => {
        const prev = last?.[i];
        let { x, y } = p;
        const z = p.z ?? 0;
        const vis = p.visibility ?? 1;
        if (prev) {
          const jump = Math.hypot(x - prev.x, y - prev.y);
          if (jump > maxJump && vis < 0.85 && held[i] < holdFrames) {
            held[i]++;
            return { ...prev, visibility: vis };
          }
        }
        held[i] = 0;
        return {
          x: filters[i][0].step(x, dt),
          y: filters[i][1].step(y, dt),
          z: filters[i][2].step(z, dt),
          visibility: vis,
        };
      });
      last = out;
      return out;
    },
  };
}
