import { ContributionGrid } from './contributions';

export const WIDTH = 850;
export const HEIGHT = 195;

export const colors = {
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
};

export const contribColors = ['transparent', '#0e4429', '#006d32', '#26a641', '#39d353'];

export function svgWrapper(label: string, styles: string, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="2" fill="rgba(0,0,0,0.06)"/>
  </pattern>
  <style>${styles}</style>
</defs>
<rect width="${WIDTH}" height="${HEIGHT}" rx="6" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1"/>
${content}
<rect width="${WIDTH}" height="${HEIGHT}" rx="6" fill="url(#scan)" opacity="0.3"/>
<text x="${WIDTH - 10}" y="14" fill="${colors.dimmed}" font-family="'Courier New',monospace" font-size="9" text-anchor="end" opacity="0.4">${label}</text>
</svg>`;
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function renderContribBackground(
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
      elements += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${contribColors[level]}" opacity="${opacity}"/>`;
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
