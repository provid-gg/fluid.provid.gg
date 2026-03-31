import { CanvasRenderingContext2D } from 'canvas';
import { VideoEffect, CountdownConfig } from '../types';


export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

function lerpColor(hex1: string, hex2: string, t: number): string {
  const a = hexToRgb(hex1), b = hexToRgb(hex2);
  return `rgb(${Math.round(a.r+(b.r-a.r)*t)},${Math.round(a.g+(b.g-a.g)*t)},${Math.round(a.b+(b.b-a.b)*t)})`;
}

function colorAt(colors: string[], t: number): string {
  const n = colors.length;
  const fi = Math.max(0, Math.min(1, t)) * (n - 1);
  const lo = Math.min(Math.floor(fi), n - 2);
  return lerpColor(colors[lo], colors[lo + 1], fi - lo);
}

function renderMesh(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const n = colors.length;
  const cx = w / 2, cy = h / 2;
  const ox = w * 0.4, oy = h * 0.4;
  const R = Math.min(w, h) * 0.72;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  colors.forEach((color, i) => {
    const ph = (i / n) * Math.PI * 2;
    const bx = cx + Math.cos(ph + t * (0.26 + i * 0.08)) * ox;
    const by = cy + Math.sin(ph + t * (0.21 + i * 0.10)) * oy;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, R);
    g.addColorStop(0.00, rgba(color, 0.9 * intensity));
    g.addColorStop(0.30, rgba(color, 0.42 * intensity));
    g.addColorStop(0.65, rgba(color, 0.10 * intensity));
    g.addColorStop(1.00, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  ctx.restore();
}

function renderAurora(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const n = colors.length;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const curtainsPerColor = 3;
  for (let ci = 0; ci < n; ci++) {
    for (let c = 0; c < curtainsPerColor; c++) {
      const phase = ci * 2.09 + c * 1.13;
      const speed = 0.14 + c * 0.07;
      const horizon = h * (0.3 + ci * (0.4 / Math.max(n - 1, 1)));
      const curtainH = h * (0.32 + 0.12 * Math.sin(phase));
      const alpha = (0.7 - c * 0.18) * intensity;

      ctx.beginPath();
      ctx.moveTo(-5, h + 5);
      const steps = 48;
      for (let xi = 0; xi <= steps; xi++) {
        const x = (xi / steps) * (w + 10) - 5;
        const nx = xi / steps;
        const y = horizon
          + Math.sin(nx * Math.PI * 2.8 + t * speed + phase) * curtainH * 0.28
          + Math.sin(nx * Math.PI * 6.1 + t * speed * 1.6) * curtainH * 0.10
          + Math.sin(nx * Math.PI * 1.4 + t * speed * 0.5 + phase) * curtainH * 0.18;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 5, h + 5);
      ctx.closePath();

      const g = ctx.createLinearGradient(0, horizon - curtainH * 1.5, 0, horizon + curtainH * 0.6);
      g.addColorStop(0.00, rgba(colors[ci], 0));
      g.addColorStop(0.35, rgba(colors[ci], alpha * 0.55));
      g.addColorStop(0.62, rgba(colors[ci], alpha));
      g.addColorStop(0.82, rgba(colors[ci], alpha * 0.38));
      g.addColorStop(1.00, rgba(colors[ci], 0.03));
      ctx.fillStyle = g;
      ctx.fill();
    }
  }
  ctx.restore();
}

function renderVortex(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const cx = w / 2, cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy) * 1.1;
  const slices = 180;
  const rot = t * 0.35;

  for (let s = 0; s < slices; s++) {
    const a1 = (s / slices) * Math.PI * 2 + rot;
    const a2 = ((s + 1) / slices) * Math.PI * 2 + rot;
    const colorT = (s / slices) % 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, a1, a2);
    ctx.closePath();
    ctx.fillStyle = colorAt(colors, colorT);
    ctx.fill();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const numArms = Math.min(colors.length, 3);
  for (let arm = 0; arm < numArms; arm++) {
    const armAngle = (arm / numArms) * Math.PI * 2 + t * 0.35;
    ctx.beginPath();
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const r = (i / steps) * maxR;
      const theta = armAngle - (r / maxR) * Math.PI * 3.5;
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(colors[arm % colors.length], 0.42 * intensity);
    ctx.lineWidth = maxR * 0.16;
    (ctx as any).lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();

  const center = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
  center.addColorStop(0,    'rgba(0,0,0,0.93)');
  center.addColorStop(0.16, 'rgba(0,0,0,0.28)');
  center.addColorStop(0.52, 'rgba(0,0,0,0)');
  center.addColorStop(0.88, 'rgba(0,0,0,0.10)');
  center.addColorStop(1,    'rgba(0,0,0,0.55)');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = center;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const glowR = Math.min(w, h) * 0.055;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR * 5);
  glow.addColorStop(0,    `rgba(255,255,255,${Math.min(1, 0.88 * intensity)})`);
  glow.addColorStop(0.15, rgba(colors[0], 0.65 * intensity));
  glow.addColorStop(1,    rgba(colors[0], 0));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function renderWave(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const n = colors.length;
  const numLines = 80;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let li = 0; li < numLines; li++) {
    const ny = li / numLines;
    const baseY = ny * h;
    const lineColor = colorAt(colors, ny);
    const lineAlpha = (0.12 + 0.22 * Math.pow(Math.sin(ny * Math.PI), 0.7)) * intensity;

    ctx.beginPath();
    let firstPt = true;
    for (let x = -3; x <= w + 3; x += 3) {
      const nx = x / w;
      const y = baseY
        + Math.sin(nx * Math.PI * 3.1 + t * 1.1 + ny * Math.PI * 3) * h * 0.045
        + Math.sin(nx * Math.PI * 7.3 - t * 0.75 + ny * Math.PI * 6) * h * 0.018
        + Math.sin(nx * Math.PI * 1.7 + t * 0.45 + ny * Math.PI * 1.5) * h * 0.025;
      if (firstPt) { ctx.moveTo(x, y); firstPt = false; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = lineColor.replace('rgb(', 'rgba(').replace(')', `,${lineAlpha})`);
    ctx.lineWidth = 1.8 + 1.2 * Math.sin(ny * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  void n;
}

function renderPlasma(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const rgb = colors.map(hexToRgb);
  const n = rgb.length;
  const imgData = ctx.createImageData(w, h);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = px / w, ny = py / h;
      const v = (
        Math.sin(nx * 8 + t) +
        Math.sin(ny * 8 + t * 1.3) +
        Math.sin((nx + ny) * 5 + t * 0.8) +
        Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 12 + t * 1.1)
      ) / 4;

      const ct = (v + 1) / 2;
      const fi = ct * (n - 1);
      const lo = Math.min(Math.floor(fi), n - 2);
      const frac = fi - lo;
      const c1 = rgb[lo], c2 = rgb[lo + 1];
      const idx = (py * w + px) * 4;
      imgData.data[idx]     = Math.min(255, (c1.r + (c2.r - c1.r) * frac) * intensity);
      imgData.data[idx + 1] = Math.min(255, (c1.g + (c2.g - c1.g) * frac) * intensity);
      imgData.data[idx + 2] = Math.min(255, (c1.b + (c2.b - c1.b) * frac) * intensity);
      imgData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function renderNebula(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const n = colors.length;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let ci = 0; ci < n; ci++) {
    const ph = ci * 2.094;
    const bx = w * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(ph + t * 0.028)));
    const by = h * (0.2 + 0.6 * (0.5 + 0.5 * Math.cos(ph * 0.71 + t * 0.022)));
    const r  = Math.max(w, h) * (0.42 + 0.08 * Math.sin(ph + t * 0.035));
    const g  = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0,   rgba(colors[ci], 0.20 * intensity));
    g.addColorStop(0.5, rgba(colors[ci], 0.07 * intensity));
    g.addColorStop(1,   rgba(colors[ci], 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const numMed = n * 3;
  for (let mc = 0; mc < numMed; mc++) {
    const ci = mc % n;
    const ph = mc * 1.618 + ci * 0.5;
    const bx = w * (0.08 + 0.84 * (0.5 + 0.5 * Math.sin(ph + t * (0.052 + mc * 0.004))));
    const by = h * (0.08 + 0.84 * (0.5 + 0.5 * Math.cos(ph * 1.31 + t * (0.042 + mc * 0.003))));
    const r  = Math.min(w, h) * (0.10 + 0.07 * Math.sin(ph * 2 + t * 0.065));
    const g  = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0,    rgba(colors[ci], 0.50 * intensity));
    g.addColorStop(0.55, rgba(colors[ci], 0.15 * intensity));
    g.addColorStop(1,    rgba(colors[ci], 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const numStars = 160;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let si = 0; si < numStars; si++) {
    const sr = Math.sqrt((si + 0.5) / numStars) * Math.min(w, h) * 0.52;
    const stheta = si * goldenAngle;
    const sx = w * 0.5 + Math.cos(stheta) * sr;
    const sy = h * 0.5 + Math.sin(stheta) * sr;

    const ci = si % n;
    const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(si * 2.718 + t * (1.4 + (si % 4) * 0.28)));
    const alpha = twinkle * (si % 3 === 0 ? 0.92 : 0.52) * intensity;
    const starR = si % 5 === 0 ? 2.2 : (si % 3 === 0 ? 1.4 : 0.85);

    ctx.beginPath();
    ctx.arc(sx, sy, starR, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors[ci], alpha);
    ctx.fill();

    if (si % 4 === 0) {
      const gr = starR * 5.5;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, gr);
      glow.addColorStop(0, rgba(colors[ci], alpha * 0.55));
      glow.addColorStop(1, rgba(colors[ci], 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sx - gr, sy - gr, gr * 2, gr * 2);
    }
  }
  ctx.restore();
}

function renderPulse(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const cx = w / 2, cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy) * 1.15;
  const n = colors.length;
  const numRings = 12;
  const speed = 0.35;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let ri = 0; ri < numRings; ri++) {
    const phase = ri / numRings;
    const animR = ((phase + t * speed) % 1) * maxR;
    const life = 1 - animR / maxR;
    const ci = Math.floor(phase * n) % n;
    const ringW = maxR / numRings * 0.65;

    const g = ctx.createRadialGradient(cx, cy, Math.max(0, animR - ringW), cx, cy, animR + ringW);
    g.addColorStop(0,   rgba(colors[ci], 0));
    g.addColorStop(0.5, rgba(colors[ci], life * 0.85 * intensity));
    g.addColorStop(1,   rgba(colors[ci], 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const c0 = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.12);
  c0.addColorStop(0, rgba(colors[0], 0.75 * intensity));
  c0.addColorStop(1, rgba(colors[0], 0));
  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function renderLava(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const n = colors.length;
  const numBlobs = Math.max(6, n * 3);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0,   rgba(colors[0], 0.08 * intensity));
  bg.addColorStop(0.5, rgba(colors[Math.floor(n / 2)] ?? colors[0], 0.04 * intensity));
  bg.addColorStop(1,   rgba(colors[n - 1], 0.11 * intensity));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  for (let bi = 0; bi < numBlobs; bi++) {
    const ci = bi % n;
    const ph1 = bi * 1.618033;
    const ph2 = bi * 2.718281;
    const ph3 = bi * 3.141592;

    const bx = w * (0.15 + 0.70 * (0.5 + 0.5 * Math.sin(ph1 + t * (0.09 + (bi % 5) * 0.014))));
    const rawY = Math.sin(ph2 + t * (0.07 + (bi % 7) * 0.011));
    const by = h * (0.06 + 0.88 * (0.5 + 0.48 * rawY));

    const baseR = Math.min(w, h) * (0.10 + 0.06 * Math.sin(ph3 + t * 0.12));
    const rx = baseR * (0.80 + 0.28 * Math.sin(ph1 * 2 + t * 0.18));
    const ry = baseR * (1.05 + 0.48 * Math.sin(ph2 * 1.7 + t * 0.14));

    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(1, ry / rx);

    ctx.beginPath();
    ctx.arc(0, 0, rx * 1.25, 0, Math.PI * 2);

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.25);
    g.addColorStop(0.00, rgba(colors[ci], Math.min(1, 1.0 * intensity)));
    g.addColorStop(0.55, rgba(colors[ci], Math.min(1, 0.90 * intensity)));
    g.addColorStop(0.85, rgba(colors[ci], Math.min(1, 0.40 * intensity)));
    g.addColorStop(1.00, rgba(colors[ci], 0));
    ctx.fillStyle = g;
    ctx.fill();

    const hs = ctx.createRadialGradient(0, -rx * 0.18, 0, 0, 0, rx * 0.55);
    hs.addColorStop(0, `rgba(255,255,255,${0.22 * intensity})`);
    hs.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hs;
    ctx.fill();

    ctx.restore();
  }

  const heat = ctx.createLinearGradient(0, h * 0.65, 0, h);
  heat.addColorStop(0, rgba(colors[0], 0));
  heat.addColorStop(1, rgba(colors[0], 0.28 * intensity));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = heat;
  ctx.fillRect(0, h * 0.65, w, h * 0.35);
  ctx.restore();
}

function renderPrism(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const cx = w / 2, cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy) * 1.2;
  const n = colors.length;
  const numRays = n * 3 + 2;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let ri = 0; ri < numRays; ri++) {
    const ci = ri % n;
    const baseAngle = (ri / numRays) * Math.PI * 2 + t * (0.10 + (ri % 3) * 0.035);
    const halfW = (Math.PI / numRays) * (0.28 + 0.22 * Math.abs(Math.sin(ri * 1.618 + t * 0.20)));

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, baseAngle - halfW, baseAngle + halfW);
    ctx.closePath();

    const endX = cx + Math.cos(baseAngle) * maxR;
    const endY = cy + Math.sin(baseAngle) * maxR;
    const g = ctx.createLinearGradient(cx, cy, endX, endY);
    g.addColorStop(0.00, rgba(colors[ci], 0.88 * intensity));
    g.addColorStop(0.22, rgba(colors[ci], 0.55 * intensity));
    g.addColorStop(0.60, rgba(colors[ci], 0.18 * intensity));
    g.addColorStop(1.00, rgba(colors[ci], 0));
    ctx.fillStyle = g;
    ctx.fill();
  }

  const lensR = Math.min(w, h) * 0.055;
  const lens = ctx.createRadialGradient(cx, cy, 0, cx, cy, lensR * 4.5);
  lens.addColorStop(0.00, `rgba(255,255,255,${Math.min(1, intensity)})`);
  lens.addColorStop(0.12, rgba(colors[0], 0.75 * intensity));
  lens.addColorStop(0.45, rgba(colors[0], 0.18 * intensity));
  lens.addColorStop(1.00, rgba(colors[0], 0));
  ctx.fillStyle = lens;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function renderParticles(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const n = colors.length;
  const numParticles = 65;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let pi = 0; pi < numParticles; pi++) {
    const ci = pi % n;
    const seed = pi * 1.61803;
    const fx = 1 + (pi % 5) * 0.38 + Math.floor(pi / 5) * 0.14;
    const fy = 1 + (pi % 7) * 0.29 + Math.floor(pi / 7) * 0.11;

    const px = w * 0.5 + w * 0.43 * Math.sin(fx * t * 0.37 + seed);
    const py = h * 0.5 + h * 0.42 * Math.sin(fy * t * 0.34 + seed * 1.618);

    const size = Math.min(w, h) * (0.005 + 0.004 * (pi % 4));
    const twinkle = 0.38 + 0.62 * Math.abs(Math.sin(seed + t * (1.4 + pi % 3)));
    const alpha = twinkle * intensity;

    const gr = size * 5.5;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, gr);
    glow.addColorStop(0,   rgba(colors[ci], alpha * 0.72));
    glow.addColorStop(0.4, rgba(colors[ci], alpha * 0.22));
    glow.addColorStop(1,   rgba(colors[ci], 0));
    ctx.fillStyle = glow;
    ctx.fillRect(px - gr, py - gr, gr * 2, gr * 2);

    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors[ci], Math.min(1, alpha * 1.85));
    ctx.fill();
  }
  ctx.restore();
}

function renderGalaxy(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const cx = w / 2, cy = h / 2;
  const maxR = Math.min(w, h) * 0.47;
  const n = colors.length;
  const rot = t * 0.07;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const dust = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.2);
  dust.addColorStop(0,   rgba(colors[0], 0.12 * intensity));
  dust.addColorStop(0.5, rgba(colors[0], 0.05 * intensity));
  dust.addColorStop(1,   rgba(colors[0], 0));
  ctx.fillStyle = dust;
  ctx.fillRect(0, 0, w, h);

  const numArms = 2;
  const starsPerArm = 220;
  for (let arm = 0; arm < numArms; arm++) {
    const armOffset = (arm / numArms) * Math.PI * 2;
    for (let si = 0; si < starsPerArm; si++) {
      const frac = si / starsPerArm;
      const r = maxR * Math.pow(frac, 0.62);
      const theta = armOffset + frac * Math.PI * 4.2 + rot;
      const scatter = maxR * 0.045 * Math.sqrt(frac) * Math.sin(si * 47.3 + arm * 23.7);
      const perpAngle = theta + Math.PI / 2;
      const sx = cx + Math.cos(theta) * r + Math.cos(perpAngle) * scatter;
      const sy = cy + Math.sin(theta) * r + Math.sin(perpAngle) * scatter;
      const ci = Math.min(Math.floor(frac * (n - 1)), n - 1);
      const brightness = (1 - frac * 0.42) * intensity;
      const starR = si % 4 === 0 ? 1.8 : 0.75;
      ctx.beginPath();
      ctx.arc(sx, sy, starR, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors[ci], brightness * 0.90);
      ctx.fill();
    }
  }

  const haloStars = 100;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let si = 0; si < haloStars; si++) {
    const sr = maxR * (0.48 + 0.52 * Math.sqrt(si / haloStars));
    const theta = si * goldenAngle + rot * 0.22;
    const sx = cx + Math.cos(theta) * sr;
    const sy = cy + Math.sin(theta) * sr;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.65, 0, Math.PI * 2);
    ctx.fillStyle = rgba(colors[si % n], 0.26 * intensity);
    ctx.fill();
  }

  const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.42);
  coreGlow.addColorStop(0,    `rgba(255,255,220,${Math.min(1, 0.88 * intensity)})`);
  coreGlow.addColorStop(0.12, rgba(colors[0], 0.72 * intensity));
  coreGlow.addColorStop(0.45, rgba(colors[0], 0.18 * intensity));
  coreGlow.addColorStop(1,    rgba(colors[0], 0));
  ctx.fillStyle = coreGlow;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function renderGlitch(
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
): void {
  const n = colors.length;
  const rgb = colors.map(hexToRgb);
  const imgData = ctx.createImageData(w, h);
  const d = imgData.data;

  const frameIdx = Math.floor(t * 12);
  const glitchStrength = 0.5 + 0.5 * Math.abs(Math.sin(t * 1.7));
  const maxShift = Math.round(w * 0.04 * glitchStrength);

  for (let py = 0; py < h; py++) {
    const lineKey = ((py * 1664525 + frameIdx * 1013904223) >>> 0) % 100;
    const threshold = Math.round(14 * glitchStrength);
    const isGlitchLine = lineKey < threshold;
    const lineShift = isGlitchLine
      ? Math.round(((lineKey / threshold) - 0.5) * maxShift * 2)
      : 0;

    for (let px = 0; px < w; px++) {
      const nx = px / w, ny = py / h;
      const v = (
        Math.sin(nx * 7 + t * 0.9) +
        Math.sin(ny * 5 + t * 1.1) +
        Math.sin((nx + ny) * 4.5 + t * 0.7)
      ) / 3;
      const ct = (v + 1) / 2;
      const fi = ct * (n - 1);
      const lo = Math.min(Math.floor(fi), n - 2);
      const frac = fi - lo;

      const rPx = Math.max(0, Math.min(w - 1, px - lineShift - Math.round(maxShift * 0.45)));
      const bPx = Math.max(0, Math.min(w - 1, px + lineShift + Math.round(maxShift * 0.45)));
      const rnx = rPx / w, bnx = bPx / w;

      const rv = (Math.sin(rnx * 7 + t * 0.9) + Math.sin(ny * 5 + t * 1.1) + Math.sin((rnx + ny) * 4.5 + t * 0.7)) / 3;
      const rct = (rv + 1) / 2;
      const rfi = rct * (n - 1);
      const rlo = Math.min(Math.floor(rfi), n - 2);
      const rfrac = rfi - rlo;

      const bv = (Math.sin(bnx * 7 + t * 0.9) + Math.sin(ny * 5 + t * 1.1) + Math.sin((bnx + ny) * 4.5 + t * 0.7)) / 3;
      const bct = (bv + 1) / 2;
      const bfi = bct * (n - 1);
      const blo = Math.min(Math.floor(bfi), n - 2);
      const bfrac = bfi - blo;

      const idx = (py * w + px) * 4;
      const rC1 = rgb[rlo], rC2 = rgb[Math.min(rlo + 1, n - 1)];
      const gC1 = rgb[lo],  gC2 = rgb[Math.min(lo + 1, n - 1)];
      const bC1 = rgb[blo], bC2 = rgb[Math.min(blo + 1, n - 1)];

      d[idx]     = Math.min(255, (rC1.r + (rC2.r - rC1.r) * rfrac) * intensity);
      d[idx + 1] = Math.min(255, (gC1.g + (gC2.g - gC1.g) * frac)  * intensity);
      d[idx + 2] = Math.min(255, (bC1.b + (bC2.b - bC1.b) * bfrac) * intensity);
      d[idx + 3] = 255;

      if (py % 3 === 0) {
        d[idx]     = d[idx]     * 0.5;
        d[idx + 1] = d[idx + 1] * 0.5;
        d[idx + 2] = d[idx + 2] * 0.5;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const numBlocks = 2 + Math.floor(Math.abs(Math.sin(t * 2.1)) * 4);
  for (let bi = 0; bi < numBlocks; bi++) {
    const bh   = h * (0.008 + 0.014 * ((bi * 7919 + frameIdx * 3) % 10) / 10);
    const by   = h * ((bi * 6271 + frameIdx * 17) % 100) / 100;
    const boff = w * (Math.sin(bi * 2.718 + t * 6.3) * 0.04);
    ctx.fillStyle = rgba(colors[bi % n], 0.14 * intensity);
    ctx.fillRect(boff, by, w, bh);
  }
  ctx.restore();
}


function cdFmt(remaining: number, totalDur: number): string {
  const s = Math.ceil(Math.max(0, remaining));
  if (totalDur >= 60) {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }
  return `${s}`;
}

function cdRgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

function cdClean(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  timeStr: string, label: string, color: string, base: number,
): void {
  const numSz = base * 0.22;
  const labSz = base * 0.040;
  const gap   = base * 0.018;
  const totalH = label ? labSz + gap + numSz : numSz;
  let y = cy - totalH / 2;

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  if (label) {
    ctx.font        = `700 ${labSz}px Arial, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = base * 0.04;
    ctx.fillStyle   = cdRgba(color, 0.88);
    ctx.fillText(label.toUpperCase(), cx, y);
    y += labSz + gap;
  }

  ctx.font = `900 ${numSz}px Arial Black, Impact, Arial, sans-serif`;
  for (const [blur, alpha] of [[base * 0.08, 0.95], [base * 0.025, 1.0]] as [number, number][]) {
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = blur;
    ctx.fillStyle   = color;
    ctx.fillText(timeStr, cx, y);
  }

  ctx.restore();
}

function cdGlow(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  timeStr: string, label: string, color: string, base: number,
): void {
  const numSz = base * 0.21;
  const labSz = base * 0.038;
  const gap   = base * 0.016;
  const totalH = label ? labSz + gap + numSz : numSz;
  let y = cy - totalH / 2;

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  if (label) {
    ctx.font        = `700 ${labSz}px Arial, sans-serif`;
    ctx.shadowColor = color;
    ctx.shadowBlur  = base * 0.07;
    ctx.fillStyle   = cdRgba(color, 0.95);
    ctx.fillText(label.toUpperCase(), cx, y);
    y += labSz + gap;
  }

  ctx.font = `900 ${numSz}px Arial Black, Impact, Arial, sans-serif`;

  ctx.shadowColor = color;
  ctx.shadowBlur  = base * 0.18;
  ctx.fillStyle   = cdRgba(color, 0.35);
  ctx.fillText(timeStr, cx, y);

  ctx.shadowBlur  = base * 0.08;
  ctx.fillStyle   = cdRgba(color, 0.70);
  ctx.fillText(timeStr, cx, y);

  ctx.shadowBlur  = base * 0.015;
  ctx.shadowColor = 'rgba(255,255,255,0.6)';
  ctx.fillStyle   = '#ffffff';
  ctx.fillText(timeStr, cx, y);

  ctx.restore();
}

function cdOutline(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  timeStr: string, label: string, color: string, base: number,
): void {
  const numSz = base * 0.23;
  const labSz = base * 0.040;
  const gap   = base * 0.018;
  const totalH = label ? labSz + gap + numSz : numSz;
  let y = cy - totalH / 2;

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  if (label) {
    ctx.font        = `700 ${labSz}px Arial, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur  = base * 0.03;
    ctx.fillStyle   = color;
    ctx.fillText(label.toUpperCase(), cx, y);
    y += labSz + gap;
  }

  ctx.font = `900 ${numSz}px Arial Black, Impact, Arial, sans-serif`;

  ctx.lineJoin    = 'round';
  ctx.lineWidth   = base * 0.020;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = base * 0.03;
  ctx.strokeText(timeStr, cx, y);

  ctx.lineWidth   = base * 0.010;
  ctx.strokeStyle = color;
  ctx.shadowColor = cdRgba(color, 0.55);
  ctx.shadowBlur  = base * 0.04;
  ctx.strokeText(timeStr, cx, y);

  ctx.restore();
}

function cdRing(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  timeStr: string, label: string, color: string,
  progress: number, base: number,
): void {
  const ringR  = base * 0.19;
  const trackW = base * 0.014;
  const arcW   = base * 0.026;
  const numSz  = base * 0.14;
  const labSz  = base * 0.032;
  const START  = -Math.PI / 2;
  const remArc = (1 - progress) * Math.PI * 2;

  ctx.save();

  ctx.beginPath();
  ctx.arc(cx, cy, ringR + arcW, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = cdRgba(color, 0.15);
  ctx.lineWidth   = trackW;
  ctx.stroke();

  if (remArc > 0.01) {
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, START, START + remArc);
    ctx.strokeStyle = color;
    ctx.lineWidth   = arcW;
    (ctx as any).lineCap = 'round';
    ctx.shadowColor = cdRgba(color, 0.7);
    ctx.shadowBlur  = base * 0.025;
    ctx.stroke();
  }

  ctx.shadowBlur   = 0;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = `900 ${numSz}px Arial Black, Impact, Arial, sans-serif`;
  ctx.fillStyle    = color;
  ctx.shadowColor  = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur   = base * 0.015;
  ctx.fillText(timeStr, cx, cy);

  if (label) {
    ctx.shadowBlur  = base * 0.012;
    ctx.font        = `700 ${labSz}px Arial, sans-serif`;
    ctx.fillStyle   = cdRgba(color, 0.82);
    ctx.fillText(label.toUpperCase(), cx, cy + ringR + labSz * 1.2);
  }

  ctx.restore();
}

function cdPill(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  timeStr: string, label: string, color: string, base: number,
): void {
  const numSz = base * 0.090;
  const labSz = base * 0.048;
  const padV  = base * 0.022;
  const padH  = base * 0.055;
  const sepW  = base * 0.028;
  const pillH = numSz + padV * 2;
  const rr    = pillH / 2;

  ctx.save();
  ctx.textBaseline = 'middle';

  ctx.font = `900 ${numSz}px Arial Black, Impact, Arial, sans-serif`;
  const numW = ctx.measureText(timeStr).width;
  ctx.font = `700 ${labSz}px Arial, sans-serif`;
  const labW = label ? ctx.measureText(label.toUpperCase()).width : 0;

  const innerW = label ? labW + sepW * 1.8 + numW : numW;
  const pillW  = innerW + padH * 2;
  const rx     = cx - pillW / 2;
  const ry     = cy - pillH / 2;

  ctx.beginPath();
  ctx.moveTo(rx + rr, ry);
  ctx.lineTo(rx + pillW - rr, ry);
  ctx.arcTo(rx + pillW, ry, rx + pillW, ry + rr, rr);
  ctx.lineTo(rx + pillW, ry + pillH - rr);
  ctx.arcTo(rx + pillW, ry + pillH, rx + pillW - rr, ry + pillH, rr);
  ctx.lineTo(rx + rr, ry + pillH);
  ctx.arcTo(rx, ry + pillH, rx, ry + pillH - rr, rr);
  ctx.lineTo(rx, ry + rr);
  ctx.arcTo(rx, ry, rx + rr, ry, rr);
  ctx.closePath();

  ctx.fillStyle   = 'rgba(0,0,0,0.58)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = base * 0.025;
  ctx.fill();

  ctx.strokeStyle = cdRgba(color, 0.38);
  ctx.lineWidth   = base * 0.003;
  ctx.shadowBlur  = 0;
  ctx.stroke();

  const textY = cy;
  let x = rx + padH;

  if (label) {
    ctx.font      = `700 ${labSz}px Arial, sans-serif`;
    ctx.fillStyle = cdRgba(color, 0.72);
    ctx.textAlign = 'left';
    ctx.fillText(label.toUpperCase(), x, textY);
    x += labW + sepW * 0.6;

    ctx.strokeStyle = cdRgba(color, 0.22);
    ctx.lineWidth   = base * 0.002;
    ctx.beginPath();
    ctx.moveTo(x, ry + pillH * 0.18);
    ctx.lineTo(x, ry + pillH * 0.82);
    ctx.stroke();
    x += sepW * 1.2;
  } else {
    ctx.textAlign = 'center';
  }

  ctx.font      = `900 ${numSz}px Arial Black, Impact, Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur  = base * 0.012;
  if (label) {
    ctx.textAlign = 'left';
    ctx.fillText(timeStr, x, textY);
  } else {
    ctx.fillText(timeStr, cx, textY);
  }

  ctx.restore();
}

export function renderCountdown(
  ctx: CanvasRenderingContext2D,
  remaining: number, totalDuration: number,
  w: number, h: number,
  cd: CountdownConfig,
): void {
  const progress = totalDuration > 0 ? 1 - remaining / totalDuration : 1;
  const timeStr  = cdFmt(remaining, totalDuration);
  const base     = Math.min(w, h);
  const cx = w / 2, cy = h / 2;

  if      (cd.style === 'clean')   cdClean(ctx, cx, cy, timeStr, cd.label, cd.color, base);
  else if (cd.style === 'glow')    cdGlow (ctx, cx, cy, timeStr, cd.label, cd.color, base);
  else if (cd.style === 'outline') cdOutline(ctx, cx, cy, timeStr, cd.label, cd.color, base);
  else if (cd.style === 'ring')    cdRing(ctx, cx, cy, timeStr, cd.label, cd.color, progress, base);
  else if (cd.style === 'pill')    cdPill(ctx, cx, cy, timeStr, cd.label, cd.color, base);
  else                             cdGlow (ctx, cx, cy, timeStr, cd.label, cd.color, base);
}

export function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  const r = Math.sqrt(cx * cx + cy * cy);
  const g = ctx.createRadialGradient(cx, cy, r * 0.28, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

type EffectFn = (
  ctx: CanvasRenderingContext2D, t: number, w: number, h: number,
  colors: string[], intensity: number,
) => void;

const EFFECTS: Record<VideoEffect, EffectFn> = {
  mesh:      renderMesh,
  aurora:    renderAurora,
  vortex:    renderVortex,
  wave:      renderWave,
  plasma:    renderPlasma,
  nebula:    renderNebula,
  pulse:     renderPulse,
  lava:      renderLava,
  prism:     renderPrism,
  particles: renderParticles,
  galaxy:    renderGalaxy,
  glitch:    renderGlitch,
};

export function renderEffect(
  ctx: CanvasRenderingContext2D,
  t: number, w: number, h: number,
  colors: string[], effect: VideoEffect,
  intensity = 1.0,
): void {
  EFFECTS[effect](ctx, t, w, h, colors, intensity);
}
