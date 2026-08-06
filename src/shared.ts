import { ContributionGrid } from './contributions';

export const WIDTH = 850;
export const HEIGHT = 195;

// ── Themes ─────────────────────────────────────────────────────────────────────

export interface Theme {
  name: string;
  bg: string;
  fg: string;
  blue: string;
  cyan: string;
  green: string;
  magenta: string;
  red: string;
  yellow: string;
  orange: string;
  dimmed: string;
  border: string;
  contrib: string[]; // index 0-4 by contribution level
}

export type ThemeName = 'dark' | 'light';

export const themes: Record<ThemeName, Theme> = {
  // Tokyo Night — the original look
  dark: {
    name: 'dark',
    bg: '#1a1b27',
    fg: '#a9b1d6',
    blue: '#7aa2f7',
    cyan: '#7dcfff',
    green: '#9ece6a',
    magenta: '#bb9af7',
    red: '#f7768e',
    yellow: '#e0af68',
    orange: '#ff9e64',
    dimmed: '#565f89',
    border: '#292e42',
    contrib: ['transparent', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  // GitHub light
  light: {
    name: 'light',
    bg: '#ffffff',
    fg: '#24292f',
    blue: '#0969da',
    cyan: '#1b7c83',
    green: '#1a7f37',
    magenta: '#8250df',
    red: '#cf222e',
    yellow: '#9a6700',
    orange: '#bc4c00',
    dimmed: '#6e7781',
    border: '#d0d7de',
    contrib: ['transparent', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
};

// ── Seeded RNG ─────────────────────────────────────────────────────────────────

export type Rng = () => number;

// xmur3 string hash — spreads a seed string into a well-mixed 32-bit state
function hashSeed(seedString: string): number {
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

// mulberry32 — small fast PRNG, returns floats in [0, 1)
export function createRng(seedString: string): Rng {
  let state = hashSeed(seedString);
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Game context ───────────────────────────────────────────────────────────────

export interface GameContext {
  theme: Theme;
  rng: Rng;
  username: string;
  totalContributions: number;
}

export function rand(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ── SVG scaffolding ────────────────────────────────────────────────────────────

export function svgWrapper(ctx: GameContext, label: string, styles: string, content: string): string {
  const { theme } = ctx;
  const hudText = `${ctx.username} · ${ctx.totalContributions.toLocaleString('en-US')} CONTRIBS`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="2" fill="rgba(0,0,0,0.06)"/>
  </pattern>
  <style>${styles}</style>
</defs>
<rect width="${WIDTH}" height="${HEIGHT}" rx="6" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1"/>
${content}
<rect width="${WIDTH}" height="${HEIGHT}" rx="6" fill="url(#scan)" opacity="0.3"/>
<text x="${WIDTH - 10}" y="14" fill="${theme.dimmed}" font-family="'Courier New',monospace" font-size="9" text-anchor="end" opacity="0.4">${label}</text>
<text x="10" y="${HEIGHT - 6}" fill="${theme.dimmed}" font-family="'Courier New',monospace" font-size="8" opacity="0.35">${hudText}</text>
</svg>`;
}

export function renderContribBackground(
  theme: Theme,
  grid: ContributionGrid,
  cellSize: number,
  gap: number,
  offsetX: number,
  offsetY: number,
  opacity: number
): string {
  let elements = '';
  const step = cellSize + gap;
  for (let w = 0; w < grid.weeks; w++) {
    for (let d = 0; d < grid.grid[w].length; d++) {
      const level = grid.grid[w][d];
      if (level === 0) continue;
      const x = offsetX + w * step;
      const y = offsetY + d * step;
      elements += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${theme.contrib[level]}" opacity="${opacity}"/>`;
    }
  }
  return elements;
}

export function contribGridLayout(grid: ContributionGrid) {
  const margin = 9;
  const gap = 2;
  const cellSize = Math.floor((WIDTH - 2 * margin - (grid.weeks - 1) * gap) / grid.weeks);
  const totalW = grid.weeks * (cellSize + gap) - gap;
  const totalH = 7 * (cellSize + gap) - gap;
  const offsetX = Math.floor((WIDTH - totalW) / 2);
  const offsetY = Math.floor((HEIGHT - totalH) / 2);
  return { cellSize, gap, offsetX, offsetY, totalW, totalH };
}
