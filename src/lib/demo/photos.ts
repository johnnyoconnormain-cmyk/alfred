/**
 * Demo job imagery.
 *
 * The demo tenant needs before/after pairs that look like real job
 * documentation without shipping photographs of anyone's actual property. These
 * are generated scene illustrations — deterministic from a seed, muted and
 * photographic in palette, and clearly labelled as demo material in the UI. A
 * real tenant's gallery is whatever their crew uploads from the field.
 */

function rng(seed: number): () => number {
  let state = seed * 9301 + 49297;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

interface SceneOptions {
  seed: number;
  phase: 'before' | 'after';
}

const PALETTES = {
  before: {
    sky: ['#b9c2c7', '#d7d9d3'],
    lawn: ['#8c9068', '#6f7350'],
    bed: '#6b5c46',
    shrub: ['#5e6b4a', '#6d7853', '#55613f'],
    debris: '#7a6a51',
  },
  after: {
    sky: ['#a8c4d8', '#dfe7ea'],
    lawn: ['#5f8a4a', '#476c37'],
    bed: '#4a3728',
    shrub: ['#3f6b3a', '#4d7a42', '#375f33'],
    debris: '#4a3728',
  },
};

export function yardScene({ seed, phase }: SceneOptions): string {
  const rand = rng(seed + (phase === 'after' ? 977 : 13));
  const p = PALETTES[phase];
  const W = 800;
  const H = 600;
  const horizon = 232 + Math.floor(rand() * 30);

  const shrubs = Array.from({ length: 5 + Math.floor(rand() * 4) }, (_, i) => {
    const cx = 70 + rand() * (W - 140);
    const base = horizon + 8 + rand() * 26;
    const r = phase === 'after' ? 26 + rand() * 16 : 30 + rand() * 30;
    const fill = p.shrub[i % p.shrub.length];
    const wobble = phase === 'after' ? 1 : 1.25;
    return `<ellipse cx="${cx.toFixed(0)}" cy="${base.toFixed(0)}" rx="${(r * wobble).toFixed(0)}" ry="${(
      r * 0.72
    ).toFixed(0)}" fill="${fill}" opacity="0.92"/>`;
  }).join('');

  const bedTop = H - 150 - rand() * 40;
  const bedPath = `M0 ${bedTop.toFixed(0)} C ${W * 0.25} ${(bedTop - 34).toFixed(0)}, ${(W * 0.6).toFixed(
    0,
  )} ${(bedTop + 26).toFixed(0)}, ${W} ${(bedTop - 12).toFixed(0)} L ${W} ${H} L 0 ${H} Z`;

  const scatter =
    phase === 'before'
      ? Array.from({ length: 26 }, () => {
          const x = rand() * W;
          const y = horizon + 40 + rand() * (H - horizon - 60);
          const len = 14 + rand() * 46;
          const rot = rand() * 180;
          return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${len.toFixed(
            0,
          )}" height="3" rx="1.5" fill="${p.debris}" opacity="${(0.3 + rand() * 0.4).toFixed(2)}" transform="rotate(${rot.toFixed(
            0,
          )} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
        }).join('')
      : Array.from({ length: 5 }, (_, i) => {
          const x = 90 + i * 150 + rand() * 40;
          const y = bedTop + 34 + rand() * 40;
          return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(9 + rand() * 7).toFixed(
            0,
          )}" fill="${p.shrub[i % p.shrub.length]}" opacity="0.9"/>`;
        }).join('');

  const mowLines =
    phase === 'after'
      ? Array.from({ length: 7 }, (_, i) => {
          const y = horizon + 44 + i * 30;
          return `<rect x="0" y="${y}" width="${W}" height="14" fill="#ffffff" opacity="0.045"/>`;
        }).join('')
      : '';

  const houseW = 210 + rand() * 90;
  const houseX = rand() > 0.5 ? 40 : W - houseW - 40;
  const houseH = 92 + rand() * 34;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${phase} — yard">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.sky[0]}"/><stop offset="100%" stop-color="${p.sky[1]}"/>
    </linearGradient>
    <linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.lawn[0]}"/><stop offset="100%" stop-color="${p.lawn[1]}"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.14"/>
      <stop offset="40%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#lawn)"/>
  ${mowLines}
  <rect x="${houseX.toFixed(0)}" y="${(horizon - houseH).toFixed(0)}" width="${houseW.toFixed(
    0,
  )}" height="${houseH.toFixed(0)}" fill="#cfcabd" opacity="0.85"/>
  <polygon points="${houseX.toFixed(0)},${(horizon - houseH).toFixed(0)} ${(houseX + houseW / 2).toFixed(
    0,
  )},${(horizon - houseH - 42).toFixed(0)} ${(houseX + houseW).toFixed(0)},${(horizon - houseH).toFixed(
    0,
  )}" fill="#8d8579" opacity="0.9"/>
  ${shrubs}
  <path d="${bedPath}" fill="${p.bed}" opacity="${phase === 'after' ? '0.95' : '0.7'}"/>
  ${scatter}
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;
}
