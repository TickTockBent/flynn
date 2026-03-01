import { ContributionGrid } from './contributions';
import { WIDTH, HEIGHT, colors, svgWrapper, contribColors, contribGridLayout } from './shared';

export function generateLife(contrib: ContributionGrid): string {
  const duration = 15;
  const layout = contribGridLayout(contrib);
  const { cellSize, gap, offsetX, offsetY } = layout;
  const step = cellSize + gap;
  const cols = contrib.weeks;
  const rows = 7;

  const generations = 30;

  // Seed from contribution graph: any contribution = alive
  let currentGrid: boolean[][] = [];
  const initialLevel: number[][] = [];
  for (let r = 0; r < rows; r++) {
    currentGrid[r] = [];
    initialLevel[r] = [];
    for (let c = 0; c < cols; c++) {
      const level = (contrib.grid[c] && contrib.grid[c][r]) ? contrib.grid[c][r] : 0;
      currentGrid[r][c] = level > 0;
      initialLevel[r][c] = level;
    }
  }

  // Record all generations
  const history: boolean[][][] = [currentGrid.map(row => [...row])];

  for (let g = 1; g < generations; g++) {
    const nextGrid: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
      nextGrid[r] = [];
      for (let c = 0; c < cols; c++) {
        let neighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && currentGrid[nr][nc]) {
              neighbors++;
            }
          }
        }
        if (currentGrid[r][c]) {
          nextGrid[r][c] = neighbors === 2 || neighbors === 3;
        } else {
          nextGrid[r][c] = neighbors === 3;
        }
      }
    }
    currentGrid = nextGrid;
    history.push(nextGrid.map(row => [...row]));
  }

  // Build animated cells — only for cells that are ever alive
  let cellElements = '';
  let cellStyles = '';
  let cellIndex = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const timeline = history.map(gen => gen[r][c]);
      const everAlive = timeline.some(v => v);
      if (!everAlive) continue;

      const px = offsetX + c * step;
      const py = offsetY + r * step;

      // Color from initial contribution level, or a default for newly born cells
      const origLevel = initialLevel[r][c];
      let cellColor: string;
      if (origLevel > 0) {
        cellColor = contribColors[origLevel];
      } else {
        // Cells born through Conway's rules glow blue/purple
        cellColor = [colors.blue, colors.cyan, colors.magenta, colors.green][(r + c) % 4];
      }

      // Build keyframe stops
      const stops: string[] = [];
      for (let g = 0; g < generations; g++) {
        const pct = ((g / generations) * 100).toFixed(2);
        const opacity = timeline[g] ? '0.8' : '0';
        stops.push(`${pct}%{opacity:${opacity}}`);
      }
      stops.push('100%{opacity:0}');

      cellElements += `<rect class="c${cellIndex}" x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${cellColor}" opacity="0"/>`;
      cellStyles += `.c${cellIndex}{animation:c${cellIndex} ${duration}s step-end infinite}`;
      cellStyles += `@keyframes c${cellIndex}{${stops.join('')}}`;
      cellIndex++;
    }
  }

  return svgWrapper('GAME OF LIFE', cellStyles, cellElements);
}
