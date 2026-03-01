import { ContributionGrid } from './contributions';
import { WIDTH, HEIGHT, colors, svgWrapper, contribColors, contribGridLayout } from './shared';

export function generateTron(contrib: ContributionGrid): string {
  const duration = 15;
  const layout = contribGridLayout(contrib);
  const { cellSize, gap, offsetX, offsetY } = layout;
  const step = cellSize + gap;
  const cols = contrib.weeks;
  const rows = 7;

  const key = (x: number, y: number) => `${x},${y}`;
  const dx = [1, 0, -1, 0]; // right, down, left, up
  const dy = [0, 1, 0, -1];

  const maxSteps = 200;

  // Per-cell trail events: which cycle colored it and when it appeared/disappeared
  interface TrailEvent { cycle: number; enter: number; exit: number }
  const cellTrails = new Map<string, TrailEvent[]>();

  function markTrail(x: number, y: number, cycle: number, stepNum: number) {
    const k = key(x, y);
    if (!cellTrails.has(k)) cellTrails.set(k, []);
    cellTrails.get(k)!.push({ cycle, enter: stepNum, exit: -1 });
  }

  function clearAllTrails(stepNum: number) {
    for (const [, events] of cellTrails) {
      for (const ev of events) {
        if (ev.exit === -1) ev.exit = stepNum;
      }
    }
  }

  // Collision grid for the current round
  const occupied = new Set<string>();

  interface Cycle {
    x: number;
    y: number;
    dir: number;
    alive: boolean;
  }

  // Randomize starting rows so each game plays differently
  const blueStartY = 1 + Math.floor(Math.random() * (rows - 2));
  const orangeStartY = 1 + Math.floor(Math.random() * (rows - 2));
  const blueStart = { x: Math.floor(cols * 0.2), y: blueStartY, dir: 0 };
  const orangeStart = { x: Math.floor(cols * 0.8), y: orangeStartY, dir: 2 };

  function initRound(stepNum: number): Cycle[] {
    occupied.clear();

    const newCycles: Cycle[] = [
      { ...blueStart, alive: true },
      { ...orangeStart, alive: true },
    ];
    for (let i = 0; i < 2; i++) {
      const k = key(newCycles[i].x, newCycles[i].y);
      occupied.add(k);
      markTrail(newCycles[i].x, newCycles[i].y, i, stepNum);
    }
    return newCycles;
  }

  let cycles = initRound(0);

  // AI: choose best direction
  function chooseDir(cycle: Cycle, other: Cycle): number {
    const opposite = (cycle.dir + 2) % 4;
    let bestDir = -1;
    let bestScore = -Infinity;

    for (let d = 0; d < 4; d++) {
      if (d === opposite) continue;
      const nx = cycle.x + dx[d];
      const ny = cycle.y + dy[d];

      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (occupied.has(key(nx, ny))) continue;

      let score = 0;

      // Prefer going straight
      if (d === cycle.dir) score += 2;

      // Count reachable neighbors (immediate open space)
      let openNeighbors = 0;
      for (let nd = 0; nd < 4; nd++) {
        const nnx = nx + dx[nd], nny = ny + dy[nd];
        if (nnx >= 0 && nnx < cols && nny >= 0 && nny < rows && !occupied.has(key(nnx, nny))) {
          openNeighbors++;
        }
      }
      score += openNeighbors * 3;

      // Look 2 steps ahead
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (d + 2) % 4) continue;
        const n2x = nx + dx[nd], n2y = ny + dy[nd];
        if (n2x >= 0 && n2x < cols && n2y >= 0 && n2y < rows) {
          if (!occupied.has(key(n2x, n2y))) score += 1;
          // 3 steps ahead
          for (let n3d = 0; n3d < 4; n3d++) {
            if (n3d === (nd + 2) % 4) continue;
            const n3x = n2x + dx[n3d], n3y = n2y + dy[n3d];
            if (n3x >= 0 && n3x < cols && n3y >= 0 && n3y < rows && !occupied.has(key(n3x, n3y))) {
              score += 0.5;
            }
          }
        }
      }

      // Mild pull toward center to avoid cornering
      const centerX = cols / 2, centerY = rows / 2;
      score -= (Math.abs(nx - centerX) / cols + Math.abs(ny - centerY) / rows) * 1.5;

      // Keep distance from opponent when far, cut off when close
      const distToOther = Math.abs(nx - other.x) + Math.abs(ny - other.y);
      if (distToOther < 4) score -= (4 - distToOther) * 1.5;

      // Small random factor so each game plays differently
      score += Math.random() * 1.5;

      if (score > bestScore) { bestScore = score; bestDir = d; }
    }

    return bestDir;
  }

  for (let s = 1; s <= maxSteps; s++) {
    // Both choose directions based on current state
    const dirs = [
      cycles[0].alive ? chooseDir(cycles[0], cycles[1]) : -1,
      cycles[1].alive ? chooseDir(cycles[1], cycles[0]) : -1,
    ];

    // Move simultaneously
    const newPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < 2; i++) {
      if (!cycles[i].alive || dirs[i] === -1) {
        cycles[i].alive = false;
        newPositions.push({ x: cycles[i].x, y: cycles[i].y });
        continue;
      }
      cycles[i].dir = dirs[i];
      newPositions.push({
        x: cycles[i].x + dx[dirs[i]],
        y: cycles[i].y + dy[dirs[i]],
      });
    }

    // Check collisions against occupied cells and each other
    for (let i = 0; i < 2; i++) {
      if (!cycles[i].alive) continue;
      const k = key(newPositions[i].x, newPositions[i].y);
      if (occupied.has(k)) {
        cycles[i].alive = false;
      }
    }

    // Head-on collision: both moved to same cell
    if (cycles[0].alive && cycles[1].alive &&
        newPositions[0].x === newPositions[1].x &&
        newPositions[0].y === newPositions[1].y) {
      cycles[0].alive = false;
      cycles[1].alive = false;
    }

    // Apply moves for surviving cycles
    for (let i = 0; i < 2; i++) {
      if (!cycles[i].alive) continue;
      cycles[i].x = newPositions[i].x;
      cycles[i].y = newPositions[i].y;
      const k = key(cycles[i].x, cycles[i].y);
      occupied.add(k);
      markTrail(cycles[i].x, cycles[i].y, i, s);
    }

    // If either died, restart the round
    if (!cycles[0].alive || !cycles[1].alive) {
      clearAllTrails(s);
      cycles = initRound(s);
    }
  }

  // Close any open trail events
  clearAllTrails(maxSteps);

  // --- Render ---

  // Contribution background (dim)
  let bgElements = '';
  for (let w = 0; w < cols; w++) {
    for (let d = 0; d < (contrib.grid[w]?.length || 0); d++) {
      const level = contrib.grid[w][d];
      if (level === 0) continue;
      const px = offsetX + w * step;
      const py = offsetY + d * step;
      bgElements += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${contribColors[level]}" opacity="0.12"/>`;
    }
  }

  // Grid lines (subtle)
  let gridLines = '';
  for (let w = 0; w < cols; w++) {
    for (let d = 0; d < rows; d++) {
      const px = offsetX + w * step + cellSize / 2;
      const py = offsetY + d * step + cellSize / 2;
      gridLines += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="0.5" fill="${colors.cyan}" opacity="0.06"/>`;
    }
  }

  // Trail elements + styles
  const cycleColors = [colors.blue, colors.orange];
  let trailElements = '';
  let trailStyles = '';
  let idx = 0;

  for (const [k, events] of cellTrails) {
    const [wx, wy] = k.split(',').map(Number);
    const px = offsetX + wx * step;
    const py = offsetY + wy * step;

    // Group events by cycle to render separate colored rects
    const byCycle = new Map<number, TrailEvent[]>();
    for (const ev of events) {
      if (!byCycle.has(ev.cycle)) byCycle.set(ev.cycle, []);
      byCycle.get(ev.cycle)!.push(ev);
    }

    for (const [cycle, cycleEvents] of byCycle) {
      const keyframes: { pct: number; opacity: string }[] = [{ pct: 0, opacity: '0' }];

      for (const ev of cycleEvents) {
        const enterPct = (ev.enter / maxSteps) * 100;
        const exitPct = (ev.exit / maxSteps) * 100;
        keyframes.push({ pct: enterPct, opacity: '0.75' });
        // Fade out over a brief window rather than instant disappear
        if (exitPct < 100) {
          keyframes.push({ pct: exitPct, opacity: '0.3' });
          keyframes.push({ pct: Math.min(exitPct + 1, 100), opacity: '0' });
        }
      }
      keyframes.push({ pct: 100, opacity: '0' });
      keyframes.sort((a, b) => a.pct - b.pct);

      const stops = keyframes.map(kf => `${kf.pct.toFixed(2)}%{opacity:${kf.opacity}}`).join('');

      trailElements += `<rect class="t${idx}" x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${cycleColors[cycle]}" opacity="0"/>`;
      trailStyles += `.t${idx}{animation:t${idx} ${duration}s step-end infinite}`;
      trailStyles += `@keyframes t${idx}{${stops}}`;
      idx++;
    }
  }

  const content = `
${gridLines}
${bgElements}
${trailElements}`;

  return svgWrapper('TRON', trailStyles, content);
}
