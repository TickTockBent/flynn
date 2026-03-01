import { WIDTH, HEIGHT, colors, svgWrapper } from './shared';

export function generateLife(): string {
  const duration = 15;
  const cellSize = 14;
  const gap = 1;
  const step = cellSize + gap;
  const margin = 8;

  const cols = Math.floor((WIDTH - 2 * margin) / step);
  const rows = Math.floor((HEIGHT - 2 * margin) / step);
  const offsetX = margin + ((WIDTH - 2 * margin) - cols * step + gap) / 2;
  const offsetY = margin + ((HEIGHT - 2 * margin) - rows * step + gap) / 2;

  const generations = 25;
  const genDuration = duration / generations;

  // Initialize random grid (~30% fill)
  let currentGrid: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    currentGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      currentGrid[r][c] = Math.random() < 0.3;
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

  // For each cell, build a timeline of alive/dead states
  // Only create elements for cells that are ever alive
  let cellElements = '';
  let cellStyles = '';
  let cellIndex = 0;

  const accentColors = [colors.blue, colors.cyan, colors.magenta, colors.green];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const timeline = history.map(gen => gen[r][c]);
      const everAlive = timeline.some(v => v);
      if (!everAlive) continue;

      const px = offsetX + c * step;
      const py = offsetY + r * step;

      // Build keyframe string
      const keyframeStops: string[] = [];
      for (let g = 0; g < generations; g++) {
        const pctStart = ((g / generations) * 100).toFixed(2);
        const opacity = timeline[g] ? '0.75' : '0';
        keyframeStops.push(`${pctStart}%{opacity:${opacity}}`);
      }
      keyframeStops.push('100%{opacity:0}');

      // Pick color based on position for visual variety
      const colorChoice = accentColors[(r + c) % accentColors.length];

      cellElements += `<rect class="c${cellIndex}" x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" rx="2" fill="${colorChoice}" opacity="0"/>`;
      cellStyles += `.c${cellIndex}{animation:c${cellIndex} ${duration}s step-end infinite}`;
      cellStyles += `@keyframes c${cellIndex}{${keyframeStops.join('')}}`;
      cellIndex++;
    }
  }

  const content = cellElements;
  return svgWrapper('GAME OF LIFE', cellStyles, content);
}
