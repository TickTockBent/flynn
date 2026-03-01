import { ContributionGrid } from './contributions';
import { WIDTH, HEIGHT, colors, svgWrapper, contribColors, contribGridLayout } from './shared';

export function generateSnake(contrib: ContributionGrid): string {
  const duration = 15;
  const layout = contribGridLayout(contrib);
  const { cellSize, gap, offsetX, offsetY } = layout;
  const step = cellSize + gap;
  const cols = contrib.weeks;
  const rows = 7;

  const key = (x: number, y: number) => `${x},${y}`;

  // Snake state
  const startX = Math.floor(cols / 6);
  const startY = Math.floor(rows / 2);
  const snakeBody: { x: number; y: number }[] = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
  ];
  let direction = 0; // 0=right,1=down,2=left,3=up
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];

  const occupied = new Set<string>();
  for (const seg of snakeBody) occupied.add(key(seg.x, seg.y));

  // Place food on contribution cells (prefer higher levels)
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
      // Fallback: any empty cell
      for (let w = 0; w < cols; w++) {
        for (let d = 0; d < rows; d++) {
          if (!occupied.has(key(w, d))) candidates.push({ x: w, y: d, level: 0 });
        }
      }
    }
    if (candidates.length === 0) return null;
    // Weight toward higher contribution levels
    candidates.sort((a, b) => b.level - a.level);
    const topN = Math.min(candidates.length, Math.max(5, Math.floor(candidates.length * 0.2)));
    const pick = candidates[Math.floor(Math.random() * topN)];
    return { x: pick.x, y: pick.y };
  }

  let food = placeFood();

  // Record grid state per step: for each cell, list of [enterStep, exitStep]
  const cellOccupancy = new Map<string, [number, number][]>();

  function markEnter(x: number, y: number, stepNum: number) {
    const k = key(x, y);
    if (!cellOccupancy.has(k)) cellOccupancy.set(k, []);
    cellOccupancy.get(k)!.push([stepNum, -1]);
  }
  function markExit(x: number, y: number, stepNum: number) {
    const k = key(x, y);
    const intervals = cellOccupancy.get(k);
    if (intervals && intervals.length > 0) {
      const last = intervals[intervals.length - 1];
      if (last[1] === -1) last[1] = stepNum;
    }
  }

  // Initialize occupancy for starting body
  for (const seg of snakeBody) markEnter(seg.x, seg.y, 0);

  // Food tracking
  interface FoodEvent { x: number; y: number; appear: number; eaten: number }
  const foodEvents: FoodEvent[] = [];
  if (food) foodEvents.push({ x: food.x, y: food.y, appear: 0, eaten: -1 });

  const maxSteps = 200;
  let actualSteps = maxSteps;

  for (let s = 1; s <= maxSteps; s++) {
    const head = snakeBody[0];
    if (!food) { actualSteps = s; break; }

    // AI: move toward food, avoid walls and self
    const opposite = (direction + 2) % 4;
    let bestDir = -1;
    let bestScore = -Infinity;

    for (let d = 0; d < 4; d++) {
      if (d === opposite) continue;
      const nx = head.x + dx[d];
      const ny = head.y + dy[d];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

      // Allow moving to tail's current position (it will move away)
      const tail = snakeBody[snakeBody.length - 1];
      if (occupied.has(key(nx, ny)) && !(nx === tail.x && ny === tail.y)) continue;

      let score = 0;
      // Distance to food
      score -= (Math.abs(nx - food.x) + Math.abs(ny - food.y)) * 2;
      // Prefer current direction
      if (d === direction) score += 1;
      // Avoid edges slightly
      if (nx <= 0 || nx >= cols - 1) score -= 0.5;
      if (ny <= 0 || ny >= rows - 1) score -= 0.5;
      // Check open neighbors of destination (avoid trapping self)
      let openNeighbors = 0;
      for (let nd = 0; nd < 4; nd++) {
        const nnx = nx + dx[nd], nny = ny + dy[nd];
        if (nnx >= 0 && nnx < cols && nny >= 0 && nny < rows && !occupied.has(key(nnx, nny))) openNeighbors++;
      }
      score += openNeighbors * 0.5;

      if (score > bestScore) { bestScore = score; bestDir = d; }
    }

    if (bestDir === -1) { actualSteps = s; break; } // Stuck
    direction = bestDir;

    const newHead = { x: head.x + dx[direction], y: head.y + dy[direction] };
    snakeBody.unshift(newHead);
    occupied.add(key(newHead.x, newHead.y));
    markEnter(newHead.x, newHead.y, s);

    if (food && newHead.x === food.x && newHead.y === food.y) {
      // Eat food — don't remove tail (snake grows)
      foodEvents[foodEvents.length - 1].eaten = s;
      food = placeFood();
      if (food) foodEvents.push({ x: food.x, y: food.y, appear: s, eaten: -1 });
    } else {
      // Remove tail
      const tail = snakeBody.pop()!;
      occupied.delete(key(tail.x, tail.y));
      markExit(tail.x, tail.y, s);
    }
  }

  // Close any open occupancy intervals
  for (const [, intervals] of cellOccupancy) {
    for (const interval of intervals) {
      if (interval[1] === -1) interval[1] = actualSteps;
    }
  }

  // Render contribution background (dim)
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

  // Snake trail elements + styles
  let trailElements = '';
  let trailStyles = '';
  let idx = 0;

  for (const [k, intervals] of cellOccupancy) {
    const [wx, wy] = k.split(',').map(Number);
    const px = offsetX + wx * step;
    const py = offsetY + wy * step;

    // Build visibility keyframes
    const stops: string[] = [];
    let lastOpacity = '0';
    const events: { pct: number; opacity: string }[] = [{ pct: 0, opacity: '0' }];

    for (const [enter, exit] of intervals) {
      const enterPct = (enter / actualSteps) * 100;
      const exitPct = (exit / actualSteps) * 100;
      events.push({ pct: enterPct, opacity: '0.8' });
      events.push({ pct: exitPct, opacity: '0.2' });
    }
    events.push({ pct: 100, opacity: '0' });

    // Deduplicate and sort
    events.sort((a, b) => a.pct - b.pct);

    for (const ev of events) {
      stops.push(`${ev.pct.toFixed(2)}%{opacity:${ev.opacity}}`);
    }

    trailElements += `<rect class="s${idx}" x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${colors.green}" opacity="0"/>`;
    trailStyles += `.s${idx}{animation:s${idx} ${duration}s step-end forwards}`;
    trailStyles += `@keyframes s${idx}{${stops.join('')}}`;
    idx++;
  }

  // Food elements
  let foodElements = '';
  for (let i = 0; i < foodEvents.length; i++) {
    const fe = foodEvents[i];
    const px = offsetX + fe.x * step + cellSize / 2;
    const py = offsetY + fe.y * step + cellSize / 2;
    const appearPct = ((fe.appear / actualSteps) * 100).toFixed(2);
    const eatPct = fe.eaten >= 0 ? ((fe.eaten / actualSteps) * 100).toFixed(2) : '100';

    foodElements += `<circle class="f${i}" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${cellSize / 2 - 1}" fill="${colors.red}" opacity="0"/>`;
    trailStyles += `.f${i}{animation:f${i} ${duration}s step-end forwards}`;
    trailStyles += `@keyframes f${i}{0%,${appearPct}%{opacity:0}${appearPct}%,${eatPct}%{opacity:0.9}${eatPct}%,100%{opacity:0}}`;
  }

  const content = `
${gridDots}
${bgElements}
${trailElements}
${foodElements}`;

  return svgWrapper('SNAKE', trailStyles, content);
}
