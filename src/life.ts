import { ContributionGrid } from './contributions';
import { WIDTH, GameContext, svgWrapper, contribGridLayout } from './shared';

const DURATION = 15;
const GENERATIONS = 60;

// Classic GoL patterns to inject for guaranteed interesting behavior
const GLIDER = [[0,1,0],[0,0,1],[1,1,1]];
const R_PENTOMINO = [[0,1,1],[1,1,0],[0,1,0]];
const BLINKER = [[1,1,1]];

export function generateLife(contrib: ContributionGrid, ctx: GameContext): string {
  const { theme, rng } = ctx;
  // Conway-born cell colors — colorful life blooming from green contribution substrate
  const conwayColors = [theme.cyan, theme.blue, theme.magenta];
  const layout = contribGridLayout(contrib);
  const { cellSize, gap, offsetX, offsetY } = layout;
  const step = cellSize + gap;
  const cols = contrib.weeks;
  const rows = 7;

  // ── Seed from contribution graph ─────────────────────────────────────────

  let grid: boolean[][] = [];
  const cellOrigin: string[][] = []; // 'contrib' or 'conway' — determines fill color
  const initialLevel: number[][] = [];

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    cellOrigin[r] = [];
    initialLevel[r] = [];
    for (let c = 0; c < cols; c++) {
      const level = (contrib.grid[c] && contrib.grid[c][r]) ? contrib.grid[c][r] : 0;
      grid[r][c] = level > 0;
      cellOrigin[r][c] = level > 0 ? 'contrib' : '';
      initialLevel[r][c] = level;
    }
  }

  // ── Inject classic patterns ──────────────────────────────────────────────

  function injectPattern(pattern: number[][], startCol: number, startRow: number): void {
    for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < pattern[r].length; c++) {
        const gr = startRow + r, gc = startCol + c;
        if (gr >= 0 && gr < rows && gc >= 0 && gc < cols) {
          if (pattern[r][c] === 1) {
            grid[gr][gc] = true;
            if (!cellOrigin[gr][gc]) cellOrigin[gr][gc] = 'contrib';
          }
        }
      }
    }
  }

  // Inject 2 gliders at random-ish positions in open areas
  const glider1Col = 3 + Math.floor(rng() * 8);
  const glider2Col = cols - 12 + Math.floor(rng() * 8);
  injectPattern(GLIDER, glider1Col, 0);
  injectPattern(GLIDER, glider2Col, rows - 4);

  // Inject R-pentomino near center for chaotic growth
  injectPattern(R_PENTOMINO, Math.floor(cols / 2) - 1, 2);

  // Inject a couple blinkers for reliable oscillation
  injectPattern(BLINKER, Math.floor(cols * 0.3), 3);
  injectPattern(BLINKER, Math.floor(cols * 0.7), 3);

  // ── Run simulation ─────────────────────────────────────────────────────────

  // Track per-cell: alive state and age (consecutive generations alive) per generation
  const cellAlive: boolean[][][] = []; // [gen][row][col]
  const cellAge: number[][][] = [];    // [gen][row][col]

  // Generation 0
  cellAlive[0] = grid.map(row => [...row]);
  cellAge[0] = grid.map(row => row.map(alive => alive ? 1 : 0));

  for (let g = 1; g < GENERATIONS; g++) {
    const prevGrid = cellAlive[g - 1];
    const prevAge = cellAge[g - 1];
    const nextGrid: boolean[][] = [];
    const nextAge: number[][] = [];

    for (let r = 0; r < rows; r++) {
      nextGrid[r] = [];
      nextAge[r] = [];
      for (let c = 0; c < cols; c++) {
        let neighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && prevGrid[nr][nc]) {
              neighbors++;
            }
          }
        }

        if (prevGrid[r][c]) {
          nextGrid[r][c] = neighbors === 2 || neighbors === 3;
          nextAge[r][c] = nextGrid[r][c] ? prevAge[r][c] + 1 : 0;
        } else {
          nextGrid[r][c] = neighbors === 3;
          nextAge[r][c] = nextGrid[r][c] ? 1 : 0;
        }

        // Track origin of Conway-born cells
        if (nextGrid[r][c] && !prevGrid[r][c] && !cellOrigin[r][c]) {
          cellOrigin[r][c] = 'conway';
        }
      }
    }

    cellAlive[g] = nextGrid;
    cellAge[g] = nextAge;
  }

  // ── Determine cell colors ──────────────────────────────────────────────────

  function getCellColor(r: number, c: number): string {
    const origin = cellOrigin[r][c];
    if (origin === 'contrib') {
      const level = initialLevel[r][c];
      return level > 0 ? theme.contrib[level] : theme.contrib[1];
    }
    // Conway-born: colorful based on position
    return conwayColors[(r + c) % conwayColors.length];
  }

  // ── Age to opacity mapping ─────────────────────────────────────────────────

  function ageToOpacity(age: number): string {
    if (age <= 1) return '0.9';  // newborn — bright
    if (age <= 3) return '0.75';
    if (age <= 6) return '0.6';
    if (age <= 10) return '0.5';
    return '0.4'; // ancient — dim
  }

  // ── Build per-cell keyframes ───────────────────────────────────────────────

  let cellElements = '';
  let cellStyles = '';
  let cellIndex = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Check if this cell is ever alive
      let everAlive = false;
      for (let g = 0; g < GENERATIONS; g++) {
        if (cellAlive[g][r][c]) { everAlive = true; break; }
      }
      if (!everAlive) continue;

      const px = offsetX + c * step;
      const py = offsetY + r * step;
      const fillColor = getCellColor(r, c);

      // Build keyframe stops
      const stops: string[] = [];
      let prevOpacity = '0';

      for (let g = 0; g < GENERATIONS; g++) {
        const pct = ((g / GENERATIONS) * 100).toFixed(1);
        const alive = cellAlive[g][r][c];
        const age = cellAge[g][r][c];

        let opacity: string;
        if (alive) {
          opacity = ageToOpacity(age);
        } else {
          // Was alive last gen? → dying flash
          const wasPrevAlive = g > 0 && cellAlive[g - 1][r][c];
          opacity = wasPrevAlive ? '0.3' : '0';
        }

        if (opacity !== prevOpacity) {
          stops.push(`${pct}%{opacity:${opacity}}`);
          prevOpacity = opacity;
        }
      }
      stops.push('100%{opacity:0}');

      const cls = `c${cellIndex}`;
      cellElements += `<rect class="${cls}" x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fillColor}" opacity="0"/>`;
      cellStyles += `.${cls}{animation:${cls} ${DURATION}s step-end infinite}`;
      cellStyles += `@keyframes ${cls}{${stops.join('')}}`;
      cellIndex++;
    }
  }

  // ── Hotspot glow circles ───────────────────────────────────────────────────

  // Find the 3 densest column ranges (windows of 8 columns)
  const defs = `
  <radialGradient id="lifeGlow">
    <stop offset="0%" stop-color="${theme.cyan}" stop-opacity="0.25"/>
    <stop offset="70%" stop-color="${theme.blue}" stop-opacity="0.08"/>
    <stop offset="100%" stop-color="${theme.blue}" stop-opacity="0"/>
  </radialGradient>`;

  let glowElements = '';
  const windowSize = 10;
  const densities: { col: number; count: number }[] = [];
  for (let startCol = 0; startCol <= cols - windowSize; startCol += Math.floor(windowSize / 2)) {
    let count = 0;
    for (let c = startCol; c < startCol + windowSize && c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (cellAlive[0][r][c]) count++;
      }
    }
    densities.push({ col: startCol + Math.floor(windowSize / 2), count });
  }
  densities.sort((a, b) => b.count - a.count);

  for (let i = 0; i < Math.min(3, densities.length); i++) {
    const d = densities[i];
    if (d.count < 5) continue;
    const cx = offsetX + d.col * step + cellSize / 2;
    const cy = offsetY + Math.floor(rows / 2) * step + cellSize / 2;
    const radius = cellSize * 6;
    glowElements += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#lifeGlow)" opacity="0.6"/>`;
  }

  // ── Generation counter (stacked text elements) ─────────────────────────────

  let genElements = '';
  let genStyles = '';
  const genSteps = 6; // show gen 10, 20, 30, 40, 50, 60
  for (let i = 0; i < genSteps; i++) {
    const genNum = (i + 1) * 10;
    const showStart = ((genNum - 10) / GENERATIONS * 100).toFixed(1);
    const showEnd = (genNum / GENERATIONS * 100).toFixed(1);
    const cls = `gn${i}`;

    genStyles += `.${cls}{animation:${cls} ${DURATION}s step-end infinite}`;
    genStyles += `@keyframes ${cls}{0%,${showStart}%{opacity:0}${showStart}%{opacity:0.4}${showEnd}%{opacity:0}100%{opacity:0}}`;
    genElements += `<text class="${cls}" x="${WIDTH - 130}" y="14" fill="${theme.dimmed}" font-family="'Courier New',monospace" font-size="9" text-anchor="end" opacity="0">gen ${genNum}</text>`;
  }

  // ── Grid dots (subtle) ─────────────────────────────────────────────────────

  let gridDots = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = offsetX + c * step + cellSize / 2;
      const py = offsetY + r * step + cellSize / 2;
      gridDots += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="0.6" fill="${theme.dimmed}" opacity="0.08"/>`;
    }
  }

  // ── Assemble ───────────────────────────────────────────────────────────────

  const allStyles = cellStyles + genStyles;

  const content = `
${gridDots}
${glowElements}
${cellElements}
${genElements}`;

  const svg = svgWrapper(ctx, 'GAME OF LIFE', allStyles, content);
  return svg.replace('<defs>', `<defs>${defs}`);
}
