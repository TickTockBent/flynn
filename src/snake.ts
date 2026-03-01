import { WIDTH, HEIGHT, colors, svgWrapper } from './shared';

export function generateSnake(): string {
  const duration = 15;
  const cellSize = 18;
  const gap = 2;
  const step = cellSize + gap;
  const margin = 10;

  const cols = Math.floor((WIDTH - 2 * margin) / step);
  const rows = Math.floor((HEIGHT - 2 * margin) / step);
  const offsetX = margin + ((WIDTH - 2 * margin) - cols * step + gap) / 2;
  const offsetY = margin + ((HEIGHT - 2 * margin) - rows * step + gap) / 2;

  const grid = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  // Snake state
  const snakeBody: { x: number; y: number }[] = [
    { x: Math.floor(cols / 4), y: Math.floor(rows / 2) },
    { x: Math.floor(cols / 4) - 1, y: Math.floor(rows / 2) },
    { x: Math.floor(cols / 4) - 2, y: Math.floor(rows / 2) },
  ];
  let direction = 0; // 0=right,1=down,2=left,3=up
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];

  for (const seg of snakeBody) grid.add(key(seg.x, seg.y));

  // Place food
  function placeFood(): { x: number; y: number } {
    let fx: number, fy: number;
    do {
      fx = Math.floor(Math.random() * cols);
      fy = Math.floor(Math.random() * rows);
    } while (grid.has(key(fx, fy)));
    return { x: fx, y: fy };
  }

  let food = placeFood();

  // Record events
  interface TrailEvent { x: number; y: number; enterStep: number; exitStep: number }
  const trailMap = new Map<string, TrailEvent>();
  interface FoodEvent { x: number; y: number; appearStep: number; eatStep: number }
  const foodEvents: FoodEvent[] = [{ x: food.x, y: food.y, appearStep: 0, eatStep: -1 }];

  const maxSteps = 180;
  let snakeLength = snakeBody.length;

  // Initialize trail for starting body
  for (let i = 0; i < snakeBody.length; i++) {
    const seg = snakeBody[i];
    trailMap.set(key(seg.x, seg.y), { x: seg.x, y: seg.y, enterStep: 0, exitStep: -1 });
  }

  for (let step = 1; step <= maxSteps; step++) {
    // Simple AI: try to move toward food, avoid collisions
    const head = snakeBody[0];

    // Possible directions (can't reverse)
    const opposite = (direction + 2) % 4;
    const candidates = [0, 1, 2, 3].filter(d => d !== opposite);

    // Score each direction
    let bestDir = direction;
    let bestScore = -Infinity;

    for (const d of candidates) {
      const nx = head.x + dx[d];
      const ny = head.y + dy[d];

      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const isBody = grid.has(key(nx, ny)) && !(nx === snakeBody[snakeBody.length - 1].x && ny === snakeBody[snakeBody.length - 1].y);
      if (isBody) continue;

      const distToFood = Math.abs(nx - food.x) + Math.abs(ny - food.y);
      let score = -distToFood;
      // Prefer current direction slightly
      if (d === direction) score += 0.5;
      // Avoid edges
      if (nx === 0 || nx === cols - 1 || ny === 0 || ny === rows - 1) score -= 1;

      if (score > bestScore) { bestScore = score; bestDir = d; }
    }

    direction = bestDir;
    const newHead = { x: head.x + dx[direction], y: head.y + dy[direction] };

    // Bounds check (if stuck, just stop)
    if (newHead.x < 0 || newHead.x >= cols || newHead.y < 0 || newHead.y >= rows) break;
    if (grid.has(key(newHead.x, newHead.y)) &&
        !(newHead.x === snakeBody[snakeBody.length - 1].x && newHead.y === snakeBody[snakeBody.length - 1].y)) break;

    // Move
    snakeBody.unshift(newHead);
    grid.add(key(newHead.x, newHead.y));

    // Trail enter
    const k = key(newHead.x, newHead.y);
    if (trailMap.has(k)) {
      trailMap.get(k)!.enterStep = step;
      trailMap.get(k)!.exitStep = -1;
    } else {
      trailMap.set(k, { x: newHead.x, y: newHead.y, enterStep: step, exitStep: -1 });
    }

    // Check food
    if (newHead.x === food.x && newHead.y === food.y) {
      snakeLength++;
      foodEvents[foodEvents.length - 1].eatStep = step;
      food = placeFood();
      foodEvents.push({ x: food.x, y: food.y, appearStep: step, eatStep: -1 });
    } else {
      // Remove tail
      const tail = snakeBody.pop()!;
      grid.delete(key(tail.x, tail.y));
      const tailKey = key(tail.x, tail.y);
      if (trailMap.has(tailKey)) {
        trailMap.get(tailKey)!.exitStep = step;
      }
    }
  }

  const stepsUsed = maxSteps;
  const stepDuration = duration / stepsUsed;

  // Generate trail elements
  let trailElements = '';
  let trailStyles = '';

  let trailIndex = 0;
  for (const [, trail] of trailMap) {
    const px = offsetX + trail.x * (cellSize + gap);
    const py = offsetY + trail.y * (cellSize + gap);
    const enterPct = ((trail.enterStep / stepsUsed) * 100).toFixed(2);
    const exitPct = trail.exitStep >= 0 ? ((trail.exitStep / stepsUsed) * 100).toFixed(2) : '100';

    trailElements += `<rect class="t${trailIndex}" x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" rx="3" fill="${colors.green}" opacity="0"/>`;
    trailStyles += `.t${trailIndex}{animation:t${trailIndex} ${duration}s step-end forwards}`;
    trailStyles += `@keyframes t${trailIndex}{0%,${enterPct}%{opacity:0}${enterPct}%,${exitPct}%{opacity:0.7}${exitPct}%,100%{opacity:0.15}}`;
    trailIndex++;
  }

  // Food elements
  let foodElements = '';
  for (let i = 0; i < foodEvents.length; i++) {
    const fe = foodEvents[i];
    const px = offsetX + fe.x * (cellSize + gap) + cellSize / 2;
    const py = offsetY + fe.y * (cellSize + gap) + cellSize / 2;
    const appearPct = ((fe.appearStep / stepsUsed) * 100).toFixed(2);
    const eatPct = fe.eatStep >= 0 ? ((fe.eatStep / stepsUsed) * 100).toFixed(2) : '100';

    foodElements += `<circle class="f${i}" cx="${px}" cy="${py}" r="${cellSize / 2 - 2}" fill="${colors.red}" opacity="0"/>`;
    trailStyles += `.f${i}{animation:f${i} ${duration}s step-end forwards}`;
    trailStyles += `@keyframes f${i}{0%,${appearPct}%{opacity:0}${appearPct}%,${eatPct}%{opacity:0.9}${eatPct}%,100%{opacity:0}}`;
  }

  // Grid background dots
  let gridDots = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = offsetX + c * (cellSize + gap) + cellSize / 2;
      const py = offsetY + r * (cellSize + gap) + cellSize / 2;
      gridDots += `<circle cx="${px}" cy="${py}" r="1" fill="${colors.dimmed}" opacity="0.15"/>`;
    }
  }

  const styles = trailStyles;

  const content = `
${gridDots}
${trailElements}
${foodElements}`;

  return svgWrapper('SNAKE', styles, content);
}
