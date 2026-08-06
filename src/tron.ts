import { ContributionGrid } from './contributions';
import { GameContext, svgWrapper, contribGridLayout } from './shared';

const DURATION = 10;
const MAX_STEPS = 200;
const DEATH_FADE_STEPS = 6;
const ROUND_OVERLAP = 3;

const dx = [1, 0, -1, 0]; // right, down, left, up
const dy = [0, 1, 0, -1];
const dirAngles = [0, 90, 180, 270];

export function generateTron(contrib: ContributionGrid, ctx: GameContext): string {
  const { theme, rng } = ctx;
  const cycleColors = [theme.blue, theme.orange];
  const glowColors = [theme.cyan, theme.yellow];
  const layout = contribGridLayout(contrib);
  const { cellSize, gap, offsetX, offsetY } = layout;
  const step = cellSize + gap;
  const cols = contrib.weeks;
  const rows = 7;

  const key = (x: number, y: number) => `${x},${y}`;

  // ── Trail tracking ─────────────────────────────────────────────────────────

  interface TrailEvent {
    cycle: number;
    enter: number;
    exit: number;
    deathStep: number; // step when this round ended (-1 if still alive at end)
  }

  const cellTrails = new Map<string, TrailEvent[]>();

  function markTrail(x: number, y: number, cycle: number, stepNum: number): void {
    const k = key(x, y);
    if (!cellTrails.has(k)) cellTrails.set(k, []);
    cellTrails.get(k)!.push({ cycle, enter: stepNum, exit: -1, deathStep: -1 });
  }

  function closeRoundTrails(stepNum: number): void {
    for (const [, events] of cellTrails) {
      for (const ev of events) {
        if (ev.exit === -1) {
          ev.exit = stepNum + DEATH_FADE_STEPS;
          ev.deathStep = stepNum;
        }
      }
    }
  }

  // ── Head tracking ──────────────────────────────────────────────────────────

  interface HeadState { x: number; y: number; dir: number; alive: boolean }
  const headHistory: [HeadState, HeadState][] = [];

  // ── Cycle state ────────────────────────────────────────────────────────────

  interface Cycle { x: number; y: number; dir: number; alive: boolean; id: number }

  const occupied = new Set<string>();
  const ownTrail: Set<string>[] = [new Set(), new Set()];

  function randomStart(colMin: number, colMax: number, dir: number): Cycle & { id: number } {
    return {
      x: colMin + Math.floor(rng() * (colMax - colMin)),
      y: 1 + Math.floor(rng() * (rows - 2)),
      dir,
      alive: true,
      id: 0,
    };
  }

  function initRound(stepNum: number): [Cycle, Cycle] {
    occupied.clear();
    ownTrail[0].clear();
    ownTrail[1].clear();

    const blue: Cycle = {
      ...randomStart(5, 15, rng() < 0.5 ? 0 : Math.floor(rng() * 4)),
      id: 0,
    };
    const orange: Cycle = {
      ...randomStart(37, 47, rng() < 0.5 ? 2 : Math.floor(rng() * 4)),
      id: 1,
    };

    for (let i = 0; i < 2; i++) {
      const c = i === 0 ? blue : orange;
      const k = key(c.x, c.y);
      occupied.add(k);
      ownTrail[i].add(k);
      markTrail(c.x, c.y, i, stepNum);
    }

    return [blue, orange];
  }

  // ── AI: Blue "The Cutter" — aggressive, cuts across opponent ───────────────

  function chooseDirBlue(cycle: Cycle, other: Cycle): number {
    const opposite = (cycle.dir + 2) % 4;
    let bestDir = -1, bestScore = -Infinity;

    for (let d = 0; d < 4; d++) {
      if (d === opposite) continue;
      const nx = cycle.x + dx[d], ny = cycle.y + dy[d];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (occupied.has(key(nx, ny))) continue;

      let score = 0;

      // Low straight preference — turns frequently
      if (d === cycle.dir) score += 0.5;

      // Count open neighbors
      let openNeighbors = 0;
      for (let nd = 0; nd < 4; nd++) {
        const nnx = nx + dx[nd], nny = ny + dy[nd];
        if (nnx >= 0 && nnx < cols && nny >= 0 && nny < rows && !occupied.has(key(nnx, nny))) openNeighbors++;
      }
      score += openNeighbors * 2;

      // Opponent seeking — move TOWARD opponent when close
      const distToOther = Math.abs(nx - other.x) + Math.abs(ny - other.y);
      if (distToOther < 8) {
        score += (8 - distToOther) * 1.5; // bonus for closing distance
      }

      // Weak center pull
      score -= (Math.abs(nx - cols / 2) / cols + Math.abs(ny - rows / 2) / rows) * 0.5;

      // High random factor
      score += rng() * 2.5;

      if (score > bestScore) { bestScore = score; bestDir = d; }
    }
    return bestDir;
  }

  // ── AI: Orange "The Waller" — territorial, builds walls ────────────────────

  function chooseDirOrange(cycle: Cycle, other: Cycle): number {
    const opposite = (cycle.dir + 2) % 4;
    let bestDir = -1, bestScore = -Infinity;

    for (let d = 0; d < 4; d++) {
      if (d === opposite) continue;
      const nx = cycle.x + dx[d], ny = cycle.y + dy[d];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (occupied.has(key(nx, ny))) continue;

      let score = 0;

      // High straight preference — builds long walls
      if (d === cycle.dir) score += 4;

      // Strong space-maximizing
      let openNeighbors = 0;
      for (let nd = 0; nd < 4; nd++) {
        const nnx = nx + dx[nd], nny = ny + dy[nd];
        if (nnx >= 0 && nnx < cols && nny >= 0 && nny < rows && !occupied.has(key(nnx, nny))) openNeighbors++;
      }
      score += openNeighbors * 5;

      // Deep lookahead (4 steps)
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (d + 2) % 4) continue;
        const n2x = nx + dx[nd], n2y = ny + dy[nd];
        if (n2x >= 0 && n2x < cols && n2y >= 0 && n2y < rows && !occupied.has(key(n2x, n2y))) {
          score += 1.5;
          for (let n3d = 0; n3d < 4; n3d++) {
            if (n3d === (nd + 2) % 4) continue;
            const n3x = n2x + dx[n3d], n3y = n2y + dy[n3d];
            if (n3x >= 0 && n3x < cols && n3y >= 0 && n3y < rows && !occupied.has(key(n3x, n3y))) {
              score += 0.8;
              for (let n4d = 0; n4d < 4; n4d++) {
                if (n4d === (n3d + 2) % 4) continue;
                const n4x = n3x + dx[n4d], n4y = n3y + dy[n4d];
                if (n4x >= 0 && n4x < cols && n4y >= 0 && n4y < rows && !occupied.has(key(n4x, n4y))) score += 0.3;
              }
            }
          }
        }
      }

      // Strong center pull
      score -= (Math.abs(nx - cols / 2) / cols + Math.abs(ny - rows / 2) / rows) * 2.5;

      // Opponent avoiding
      const distToOther = Math.abs(nx - other.x) + Math.abs(ny - other.y);
      if (distToOther < 6) score -= (6 - distToOther) * 2;

      // Wall-building: bonus for being adjacent to own trail
      for (let nd = 0; nd < 4; nd++) {
        const adjX = nx + dx[nd], adjY = ny + dy[nd];
        if (ownTrail[1].has(key(adjX, adjY))) score += 1;
      }

      // Low random factor
      score += rng() * 0.5;

      if (score > bestScore) { bestScore = score; bestDir = d; }
    }
    return bestDir;
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  let cycles = initRound(0);

  headHistory.push([
    { x: cycles[0].x, y: cycles[0].y, dir: cycles[0].dir, alive: true },
    { x: cycles[1].x, y: cycles[1].y, dir: cycles[1].dir, alive: true },
  ]);

  for (let s = 1; s <= MAX_STEPS; s++) {
    // Choose directions
    const dirs = [
      cycles[0].alive ? chooseDirBlue(cycles[0], cycles[1]) : -1,
      cycles[1].alive ? chooseDirOrange(cycles[1], cycles[0]) : -1,
    ];

    // Compute new positions
    const newPos = cycles.map((c, i) => {
      if (!c.alive || dirs[i] === -1) return { x: c.x, y: c.y };
      return { x: c.x + dx[dirs[i]], y: c.y + dy[dirs[i]] };
    });

    // Mark dead if no valid move
    for (let i = 0; i < 2; i++) {
      if (dirs[i] === -1) cycles[i].alive = false;
    }

    // Check collisions against occupied
    for (let i = 0; i < 2; i++) {
      if (!cycles[i].alive) continue;
      if (occupied.has(key(newPos[i].x, newPos[i].y))) cycles[i].alive = false;
    }

    // Head-on collision
    if (cycles[0].alive && cycles[1].alive &&
        newPos[0].x === newPos[1].x && newPos[0].y === newPos[1].y) {
      cycles[0].alive = false;
      cycles[1].alive = false;
    }

    // Apply moves for survivors
    for (let i = 0; i < 2; i++) {
      if (!cycles[i].alive) continue;
      cycles[i].dir = dirs[i];
      cycles[i].x = newPos[i].x;
      cycles[i].y = newPos[i].y;
      const k = key(cycles[i].x, cycles[i].y);
      occupied.add(k);
      ownTrail[i].add(k);
      markTrail(cycles[i].x, cycles[i].y, i, s);
    }

    // Record head state
    headHistory.push([
      { x: cycles[0].x, y: cycles[0].y, dir: cycles[0].alive ? (dirs[0] >= 0 ? dirs[0] : cycles[0].dir) : cycles[0].dir, alive: cycles[0].alive },
      { x: cycles[1].x, y: cycles[1].y, dir: cycles[1].alive ? (dirs[1] >= 0 ? dirs[1] : cycles[1].dir) : cycles[1].dir, alive: cycles[1].alive },
    ]);

    // Round end?
    if (!cycles[0].alive || !cycles[1].alive) {
      closeRoundTrails(s);
      // Start new round after overlap
      const restartStep = s + ROUND_OVERLAP;
      if (restartStep < MAX_STEPS) {
        // Fill head history during dead frames
        for (let gap = 1; gap < ROUND_OVERLAP && s + gap <= MAX_STEPS; gap++) {
          headHistory.push([
            { x: cycles[0].x, y: cycles[0].y, dir: cycles[0].dir, alive: false },
            { x: cycles[1].x, y: cycles[1].y, dir: cycles[1].dir, alive: false },
          ]);
        }
        s += ROUND_OVERLAP - 1;
        cycles = initRound(restartStep);
        headHistory.push([
          { x: cycles[0].x, y: cycles[0].y, dir: cycles[0].dir, alive: true },
          { x: cycles[1].x, y: cycles[1].y, dir: cycles[1].dir, alive: true },
        ]);
      }
    }
  }

  // Close any remaining open trails
  for (const [, events] of cellTrails) {
    for (const ev of events) {
      if (ev.exit === -1) ev.exit = MAX_STEPS;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Grid floor — faint cyan lines for TRON aesthetic
  let gridLines = '';
  for (let w = 0; w <= cols; w++) {
    const lx = offsetX + w * step - gap / 2;
    gridLines += `<line x1="${lx}" y1="${offsetY}" x2="${lx}" y2="${offsetY + rows * step - gap}" stroke="${theme.cyan}" stroke-width="0.5" opacity="0.04"/>`;
  }
  for (let d = 0; d <= rows; d++) {
    const ly = offsetY + d * step - gap / 2;
    gridLines += `<line x1="${offsetX}" y1="${ly}" x2="${offsetX + cols * step - gap}" y2="${ly}" stroke="${theme.cyan}" stroke-width="0.5" opacity="0.04"/>`;
  }

  // Contribution background (very dim)
  let bgElements = '';
  for (let w = 0; w < cols; w++) {
    for (let d = 0; d < (contrib.grid[w]?.length || 0); d++) {
      const level = contrib.grid[w][d];
      if (level === 0) continue;
      const px = offsetX + w * step;
      const py = offsetY + d * step;
      bgElements += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${theme.contrib[level]}" opacity="0.10"/>`;
    }
  }

  // Trail elements + styles
  let trailElements = '';
  let trailStyles = '';
  let idx = 0;

  for (const [k, events] of cellTrails) {
    const [wx, wy] = k.split(',').map(Number);
    const px = offsetX + wx * step;
    const py = offsetY + wy * step;

    const byCycle = new Map<number, TrailEvent[]>();
    for (const ev of events) {
      if (!byCycle.has(ev.cycle)) byCycle.set(ev.cycle, []);
      byCycle.get(ev.cycle)!.push(ev);
    }

    for (const [cycle, cycleEvents] of byCycle) {
      const keyframes: { pct: number; opacity: string }[] = [{ pct: 0, opacity: '0' }];

      for (const ev of cycleEvents) {
        const enterPct = (ev.enter / MAX_STEPS) * 100;

        if (ev.deathStep >= 0) {
          // Death flash: bright → fade
          const deathPct = (ev.deathStep / MAX_STEPS) * 100;
          const fadePct = (ev.exit / MAX_STEPS) * 100;
          keyframes.push({ pct: enterPct, opacity: '0.5' });
          keyframes.push({ pct: deathPct, opacity: '0.9' }); // flash
          keyframes.push({ pct: deathPct + (fadePct - deathPct) * 0.3, opacity: '0.4' });
          keyframes.push({ pct: deathPct + (fadePct - deathPct) * 0.7, opacity: '0.15' });
          keyframes.push({ pct: fadePct, opacity: '0' });
        } else {
          const exitPct = (ev.exit / MAX_STEPS) * 100;
          keyframes.push({ pct: enterPct, opacity: '0.5' });
          if (exitPct < 100) {
            keyframes.push({ pct: exitPct, opacity: '0' });
          }
        }
      }
      keyframes.push({ pct: 100, opacity: '0' });
      keyframes.sort((a, b) => a.pct - b.pct);

      const stops = keyframes.map(kf => `${kf.pct.toFixed(1)}%{opacity:${kf.opacity}}`).join('');

      trailElements += `<rect class="t${idx}" x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${cycleColors[cycle]}" opacity="0"/>`;
      trailStyles += `.t${idx}{animation:t${idx} ${DURATION}s step-end infinite}`;
      trailStyles += `@keyframes t${idx}{${stops}}`;
      idx++;
    }
  }

  // Head elements — position keyframes
  let headStyles = '';
  let headElements = '';

  for (let i = 0; i < 2; i++) {
    // Build combined head+arrow+glow keyframes (share the same translate, differ in rotate/opacity)
    // Only emit when state changes to reduce CSS size
    const posStops: string[] = [];
    const arrowStops: string[] = [];
    const glowStops: string[] = [];

    let prevKey = '';
    for (let s = 0; s < headHistory.length; s++) {
      const state = headHistory[s][i];
      const px = offsetX + state.x * step + cellSize / 2;
      const py = offsetY + state.y * step + cellSize / 2;
      const stateKey = `${px},${py},${state.dir},${state.alive}`;

      if (stateKey !== prevKey || s === 0) {
        const pct = ((s / MAX_STEPS) * 100).toFixed(1);
        const opacity = state.alive ? '1' : '0';
        const pxR = Math.round(px), pyR = Math.round(py);

        posStops.push(`${pct}%{transform:translate(${pxR}px,${pyR}px);opacity:${opacity}}`);
        arrowStops.push(`${pct}%{transform:translate(${pxR}px,${pyR}px) rotate(${dirAngles[state.dir]}deg);opacity:${opacity}}`);
        glowStops.push(`${pct}%{transform:translate(${pxR}px,${pyR}px);opacity:${state.alive ? '.6' : '0'}}`);
        prevKey = stateKey;
      }
    }
    posStops.push('100%{opacity:0}');
    arrowStops.push('100%{opacity:0}');
    glowStops.push('100%{opacity:0}');

    headStyles += `.h${i}{animation:h${i} ${DURATION}s step-end infinite}`;
    headStyles += `@keyframes h${i}{${posStops.join('')}}`;
    headStyles += `.a${i}{animation:a${i} ${DURATION}s step-end infinite}`;
    headStyles += `@keyframes a${i}{${arrowStops.join('')}}`;
    headStyles += `.g${i}{animation:g${i} ${DURATION}s step-end infinite}`;
    headStyles += `@keyframes g${i}{${glowStops.join('')}}`;

    const half = cellSize / 2;

    // Glow halo circle
    headElements += `<circle class="g${i}" cx="0" cy="0" r="${cellSize * 1.5}" fill="url(#halo${i})" opacity="0"/>`;

    // Head rect
    headElements += `<rect class="h${i}" x="${-half}" y="${-half}" width="${cellSize}" height="${cellSize}" rx="2" fill="${glowColors[i]}" opacity="0"/>`;

    // Direction arrow (small triangle pointing right at origin, rotated by keyframe)
    const arrowSize = cellSize * 0.35;
    headElements += `<polygon class="a${i}" points="${arrowSize},0 ${-arrowSize * 0.6},${-arrowSize * 0.7} ${-arrowSize * 0.6},${arrowSize * 0.7}" fill="${cycleColors[i]}" opacity="0"/>`;
  }

  // ── SVG defs ───────────────────────────────────────────────────────────────

  const defs = `
  <radialGradient id="halo0">
    <stop offset="0%" stop-color="${theme.cyan}" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="${theme.cyan}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="halo1">
    <stop offset="0%" stop-color="${theme.yellow}" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="${theme.yellow}" stop-opacity="0"/>
  </radialGradient>`;

  // ── Assemble ───────────────────────────────────────────────────────────────

  const allStyles = trailStyles + headStyles;

  const content = `
${gridLines}
${bgElements}
${trailElements}
${headElements}`;

  const svg = svgWrapper(ctx, 'TRON', allStyles, content);
  return svg.replace('<defs>', `<defs>${defs}`);
}
