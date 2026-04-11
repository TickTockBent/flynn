import { ContributionGrid } from './contributions';
import { WIDTH, HEIGHT, colors, svgWrapper, contribColors, contribGridLayout } from './shared';

const DURATION = 15;
const MAX_STEPS = 200;

const dx = [1, 0, -1, 0]; // right, down, left, up
const dy = [0, 1, 0, -1];

export function generateSnake(contrib: ContributionGrid): string {
  const layout = contribGridLayout(contrib);
  const { cellSize, gap, offsetX, offsetY } = layout;
  const step = cellSize + gap;
  const cols = contrib.weeks;
  const rows = 7;

  const key = (x: number, y: number) => `${x},${y}`;

  // ── Snake state ────────────────────────────────────────────────────────────

  const startX = Math.floor(cols / 6);
  const startY = Math.floor(rows / 2);
  const snakeBody: { x: number; y: number }[] = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
  ];
  let direction = 0;

  const occupied = new Set<string>();
  for (const seg of snakeBody) occupied.add(key(seg.x, seg.y));

  // ── Food placement ─────────────────────────────────────────────────────────

  function placeFood(): { x: number; y: number } | null {
    const candidates: { x: number; y: number; level: number }[] = [];
    for (let w = 0; w < cols; w++) {
      for (let d = 0; d < rows; d++) {
        if (contrib.grid[w] && contrib.grid[w][d] > 0 && !occupied.has(key(w, d))) {
          candidates.push({ x: w, y: d, level: contrib.grid[w][d] });
        }
      }
    }
    if (candidates.length === 0) {
      for (let w = 0; w < cols; w++) {
        for (let d = 0; d < rows; d++) {
          if (!occupied.has(key(w, d))) candidates.push({ x: w, y: d, level: 0 });
        }
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.level - a.level);
    const topN = Math.min(candidates.length, Math.max(5, Math.floor(candidates.length * 0.2)));
    return candidates[Math.floor(Math.random() * topN)];
  }

  let food = placeFood();

  // ── Cell occupancy tracking (for body gradient) ────────────────────────────

  interface CellEvent { enter: number; exit: number; enterAge: number }
  const cellOccupancy = new Map<string, CellEvent[]>();

  function markEnter(x: number, y: number, stepNum: number, distFromHead: number): void {
    const k = key(x, y);
    if (!cellOccupancy.has(k)) cellOccupancy.set(k, []);
    cellOccupancy.get(k)!.push({ enter: stepNum, exit: -1, enterAge: distFromHead });
  }

  function markExit(x: number, y: number, stepNum: number): void {
    const k = key(x, y);
    const intervals = cellOccupancy.get(k);
    if (intervals && intervals.length > 0) {
      const last = intervals[intervals.length - 1];
      if (last.exit === -1) last.exit = stepNum;
    }
  }

  // Initialize occupancy for starting body
  for (let i = 0; i < snakeBody.length; i++) {
    markEnter(snakeBody[i].x, snakeBody[i].y, 0, i);
  }

  // ── Head tracking ──────────────────────────────────────────────────────────

  const headPositions: { x: number; y: number; alive: boolean }[] = [
    { x: snakeBody[0].x, y: snakeBody[0].y, alive: true },
  ];

  // ── Food tracking ──────────────────────────────────────────────────────────

  interface FoodEvent { x: number; y: number; appear: number; eaten: number; level: number }
  const foodEvents: FoodEvent[] = [];
  if (food) {
    const level = (contrib.grid[food.x] && contrib.grid[food.x][food.y]) || 0;
    foodEvents.push({ ...food, appear: 0, eaten: -1, level });
  }

  // ── Flood fill for trap avoidance ──────────────────────────────────────────

  function floodFillCount(startX: number, startY: number): number {
    const visited = new Set<string>();
    const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
    visited.add(key(startX, startY));
    let count = 0;

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      count++;
      if (count > snakeBody.length + 5) return count; // enough, no need to count more

      for (let d = 0; d < 4; d++) {
        const nx = x + dx[d], ny = y + dy[d];
        const k = key(nx, ny);
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !occupied.has(k) && !visited.has(k)) {
          visited.add(k);
          queue.push({ x: nx, y: ny });
        }
      }
    }
    return count;
  }

  // ── AI ─────────────────────────────────────────────────────────────────────

  function chooseDirection(): number {
    const head = snakeBody[0];
    const opposite = (direction + 2) % 4;
    let bestDir = -1;
    let bestScore = -Infinity;

    for (let d = 0; d < 4; d++) {
      if (d === opposite) continue;
      const nx = head.x + dx[d], ny = head.y + dy[d];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

      // Allow moving to tail's current position (it will move away)
      const tail = snakeBody[snakeBody.length - 1];
      if (occupied.has(key(nx, ny)) && !(nx === tail.x && ny === tail.y)) continue;

      // Trap avoidance — flood fill reachable area
      const reachable = floodFillCount(nx, ny);
      if (reachable < snakeBody.length) continue; // guaranteed trap

      let score = 0;

      if (food) {
        const distToFood = Math.abs(nx - food.x) + Math.abs(ny - food.y);

        if (distToFood <= 8) {
          // Close to food — pursue, but with occasional detour
          score -= distToFood * 2;
          if (Math.random() < 0.15) score += Math.random() * 6; // detour
        } else {
          // Far from food — wander organically
          score -= distToFood * 0.5; // mild pull toward food
          score += Math.random() * 4; // strong wander
        }
      }

      // Prefer current direction slightly
      if (d === direction) score += 0.8;

      // Open neighbors
      let openNeighbors = 0;
      for (let nd = 0; nd < 4; nd++) {
        const nnx = nx + dx[nd], nny = ny + dy[nd];
        if (nnx >= 0 && nnx < cols && nny >= 0 && nny < rows && !occupied.has(key(nnx, nny))) openNeighbors++;
      }
      score += openNeighbors * 1.5;

      // Mild edge avoidance
      if (nx <= 0 || nx >= cols - 1) score -= 0.5;
      if (ny <= 0 || ny >= rows - 1) score -= 0.5;

      // Bonus for reachable space (prefer open areas)
      score += Math.min(reachable, 20) * 0.3;

      if (score > bestScore) { bestScore = score; bestDir = d; }
    }
    return bestDir;
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  for (let s = 1; s <= MAX_STEPS; s++) {
    if (!food) {
      // No food left — restart
      for (const seg of snakeBody) markExit(seg.x, seg.y, s);
      snakeBody.length = 0;
      occupied.clear();
      const restartX = Math.floor(cols / 6);
      const restartY = Math.floor(rows / 2);
      snakeBody.push(
        { x: restartX, y: restartY },
        { x: restartX - 1, y: restartY },
        { x: restartX - 2, y: restartY },
      );
      direction = 0;
      for (let i = 0; i < snakeBody.length; i++) {
        occupied.add(key(snakeBody[i].x, snakeBody[i].y));
        markEnter(snakeBody[i].x, snakeBody[i].y, s, i);
      }
      food = placeFood();
      if (food) {
        const level = (contrib.grid[food.x] && contrib.grid[food.x][food.y]) || 0;
        foodEvents.push({ ...food, appear: s, eaten: -1, level });
      }
      headPositions.push({ x: restartX, y: restartY, alive: true });
      continue;
    }

    const bestDir = chooseDirection();

    if (bestDir === -1) {
      // Stuck — restart
      for (const seg of snakeBody) markExit(seg.x, seg.y, s);
      if (foodEvents.length > 0 && foodEvents[foodEvents.length - 1].eaten === -1) {
        foodEvents[foodEvents.length - 1].eaten = s;
      }

      snakeBody.length = 0;
      occupied.clear();
      const restartX = Math.floor(cols / 6);
      const restartY = Math.floor(rows / 2);
      snakeBody.push(
        { x: restartX, y: restartY },
        { x: restartX - 1, y: restartY },
        { x: restartX - 2, y: restartY },
      );
      direction = 0;
      for (let i = 0; i < snakeBody.length; i++) {
        occupied.add(key(snakeBody[i].x, snakeBody[i].y));
        markEnter(snakeBody[i].x, snakeBody[i].y, s, i);
      }
      food = placeFood();
      if (food) {
        const level = (contrib.grid[food.x] && contrib.grid[food.x][food.y]) || 0;
        foodEvents.push({ ...food, appear: s, eaten: -1, level });
      }
      headPositions.push({ x: restartX, y: restartY, alive: true });
      continue;
    }

    direction = bestDir;
    const newHead = { x: snakeBody[0].x + dx[direction], y: snakeBody[0].y + dy[direction] };
    snakeBody.unshift(newHead);
    occupied.add(key(newHead.x, newHead.y));
    markEnter(newHead.x, newHead.y, s, 0);

    if (food && newHead.x === food.x && newHead.y === food.y) {
      // Eat food — don't remove tail (snake grows)
      foodEvents[foodEvents.length - 1].eaten = s;
      food = placeFood();
      if (food) {
        const level = (contrib.grid[food.x] && contrib.grid[food.x][food.y]) || 0;
        foodEvents.push({ ...food, appear: s, eaten: -1, level });
      }
    } else {
      // Remove tail
      const tail = snakeBody.pop()!;
      occupied.delete(key(tail.x, tail.y));
      markExit(tail.x, tail.y, s);
    }

    // Update distances from head for existing body cells
    // (not tracked per-step — we rely on enter time for the gradient)

    headPositions.push({ x: newHead.x, y: newHead.y, alive: true });
  }

  // Close open occupancy intervals
  for (const [, intervals] of cellOccupancy) {
    for (const interval of intervals) {
      if (interval.exit === -1) interval.exit = MAX_STEPS;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Contribution background (dim)
  let bgElements = '';
  for (let w = 0; w < cols; w++) {
    for (let d = 0; d < (contrib.grid[w]?.length || 0); d++) {
      const level = contrib.grid[w][d];
      if (level === 0) continue;
      const px = offsetX + w * step;
      const py = offsetY + d * step;
      bgElements += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${contribColors[level]}" opacity="0.15"/>`;
    }
  }

  // Grid dots
  let gridDots = '';
  for (let w = 0; w < cols; w++) {
    for (let d = 0; d < rows; d++) {
      const px = offsetX + w * step + cellSize / 2;
      const py = offsetY + d * step + cellSize / 2;
      gridDots += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="0.8" fill="${colors.dimmed}" opacity="0.1"/>`;
    }
  }

  // ── Body trail keyframes (with gradient) ───────────────────────────────────

  let trailElements = '';
  let trailStyles = '';
  let idx = 0;

  for (const [k, intervals] of cellOccupancy) {
    const [wx, wy] = k.split(',').map(Number);
    const px = offsetX + wx * step;
    const py = offsetY + wy * step;

    const stops: string[] = [];
    const events: { pct: number; opacity: string }[] = [{ pct: 0, opacity: '0' }];

    for (const { enter, exit, enterAge } of intervals) {
      const enterPct = (enter / MAX_STEPS) * 100;
      const exitPct = (exit / MAX_STEPS) * 100;

      // Bright when near head (enterAge 0-1), dimmer for body (enterAge 2+)
      const enterOpacity = enterAge <= 1 ? '0.85' : '0.45';
      // After a few steps, drop to body opacity
      const bodyPct = Math.min(enterPct + (3 / MAX_STEPS) * 100, exitPct);

      events.push({ pct: enterPct, opacity: enterOpacity });
      if (enterAge <= 1 && bodyPct < exitPct) {
        events.push({ pct: bodyPct, opacity: '0.45' });
      }
      // Exit fade
      const preFadePct = Math.max(enterPct, exitPct - (1 / MAX_STEPS) * 100);
      if (preFadePct > enterPct && preFadePct < exitPct) {
        events.push({ pct: preFadePct, opacity: '0.2' });
      }
      events.push({ pct: exitPct, opacity: '0' });
    }
    events.push({ pct: 100, opacity: '0' });
    events.sort((a, b) => a.pct - b.pct);

    for (const ev of events) {
      stops.push(`${ev.pct.toFixed(1)}%{opacity:${ev.opacity}}`);
    }

    trailElements += `<rect class="s${idx}" x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${colors.green}" opacity="0"/>`;
    trailStyles += `.s${idx}{animation:s${idx} ${DURATION}s step-end infinite}`;
    trailStyles += `@keyframes s${idx}{${stops.join('')}}`;
    idx++;
  }

  // ── Head element + glow ────────────────────────────────────────────────────

  let headStyles = '';
  const headStops: string[] = [];
  const glowStops: string[] = [];

  let prevHeadKey = '';
  for (let s = 0; s < headPositions.length; s++) {
    const pos = headPositions[s];
    const px = offsetX + pos.x * step + cellSize / 2;
    const py = offsetY + pos.y * step + cellSize / 2;
    const stateKey = `${Math.round(px)},${Math.round(py)}`;

    if (stateKey !== prevHeadKey || s === 0) {
      const pct = ((s / MAX_STEPS) * 100).toFixed(1);
      headStops.push(`${pct}%{transform:translate(${Math.round(px)}px,${Math.round(py)}px)}`);
      glowStops.push(`${pct}%{transform:translate(${Math.round(px)}px,${Math.round(py)}px)}`);
      prevHeadKey = stateKey;
    }
  }
  headStops.push('100%{transform:translate(0px,0px);opacity:0}');
  glowStops.push('100%{opacity:0}');

  headStyles += `.snake-head{animation:sh ${DURATION}s step-end infinite}`;
  headStyles += `@keyframes sh{${headStops.join('')}}`;
  headStyles += `.snake-glow{animation:sg ${DURATION}s step-end infinite}`;
  headStyles += `@keyframes sg{${glowStops.join('')}}`;

  // ── Food elements (with pulse) ─────────────────────────────────────────────

  let foodElements = '';
  let foodStyles = '';

  // Global pulse animation for food
  foodStyles += `@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`;

  for (let i = 0; i < foodEvents.length; i++) {
    const fe = foodEvents[i];
    const px = offsetX + fe.x * step + cellSize / 2;
    const py = offsetY + fe.y * step + cellSize / 2;
    const appearPct = ((fe.appear / MAX_STEPS) * 100).toFixed(1);
    const eatPct = fe.eaten >= 0 ? ((fe.eaten / MAX_STEPS) * 100).toFixed(1) : '100';
    const foodColor = fe.level > 0 ? contribColors[fe.level] : colors.red;

    // Wrapper group controls visibility
    foodStyles += `.fw${i}{animation:fw${i} ${DURATION}s step-end infinite}`;
    foodStyles += `@keyframes fw${i}{0%,${appearPct}%{opacity:0}${appearPct}%{opacity:1}${eatPct}%{opacity:0}100%{opacity:0}}`;

    foodElements += `<g class="fw${i}" opacity="0">`;
    foodElements += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${cellSize / 2 - 1}" fill="${foodColor}" style="animation:pulse .8s ease-in-out infinite"/>`;
    foodElements += `</g>`;
  }

  // ── SVG defs ───────────────────────────────────────────────────────────────

  const defs = `
  <radialGradient id="snakeGlow">
    <stop offset="0%" stop-color="${colors.cyan}" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="${colors.cyan}" stop-opacity="0"/>
  </radialGradient>`;

  // ── Assemble ───────────────────────────────────────────────────────────────

  const allStyles = trailStyles + headStyles + foodStyles;

  const half = cellSize / 2;
  const content = `
${gridDots}
${bgElements}
${trailElements}
${foodElements}
<circle class="snake-glow" cx="0" cy="0" r="${cellSize * 1.5}" fill="url(#snakeGlow)" opacity="0.6"/>
<rect class="snake-head" x="${-half}" y="${-half}" width="${cellSize}" height="${cellSize}" rx="2" fill="${colors.cyan}" opacity="0"/>`;

  const svg = svgWrapper('SNAKE', allStyles, content);
  return svg.replace('<defs>', `<defs>${defs}`);
}
