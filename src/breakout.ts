import { ContributionGrid } from './contributions';
import { WIDTH, HEIGHT, GameContext, svgWrapper, clamp } from './shared';

type RandomIn = (min: number, max: number) => number;

// ── Constants ──────────────────────────────────────────────────────────────────

const DURATION = 25;
const FPS = 30;
const TOTAL_FRAMES = DURATION * FPS;
const SAMPLE_EVERY = 2;

const MARGIN = 6;
const AREA_TOP = 20;
const AREA_BOTTOM = HEIGHT - 10;
const BALL_R = 3;

const PADDLE_W = 80;
const PADDLE_H = 7;
const PADDLE_Y = HEIGHT - 23;
const PADDLE_MAX_SPEED = 14;

const INITIAL_SPEED = 12.0;
const MAX_SPEED = 18.0;
const MIN_SPEED = 8.0;

const MAX_LIVES = 3;
const RESPAWN_FRAMES = 25;

const BRICK_TOP = 24;
const BRICK_GAP = 2;
const BRICK_ROWS = 7;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Brick {
  x: number; y: number; w: number; h: number;
  alive: boolean;
  destroyFrame: number;
  color: string;
  index: number;
}

type GameState = 'playing' | 'respawn' | 'win' | 'gameover';

// ── Paddle AI ──────────────────────────────────────────────────────────────────

function projectBallX(
  startX: number, startY: number, velX: number, velY: number, targetY: number
): number {
  if (velY <= 0) return startX;
  let x = startX, y = startY, dvx = velX, dvy = velY;
  for (let i = 0; i < 300; i++) {
    const stepsToTarget = (targetY - y) / dvy;
    if (stepsToTarget <= 1) return x + dvx * stepsToTarget;
    x += dvx; y += dvy;
    if (x <= MARGIN + BALL_R) { x = MARGIN + BALL_R; dvx = Math.abs(dvx); }
    if (x >= WIDTH - MARGIN - BALL_R) { x = WIDTH - MARGIN - BALL_R; dvx = -Math.abs(dvx); }
  }
  return x;
}

interface PaddleAI {
  predictionError: number;
  reactionDelay: number;
  reactionCountdown: number;
  lastPrediction: number;
  lastBallVy: number;
  rallyCount: number;
}

function initPaddleAI(randomIn: RandomIn): PaddleAI {
  return {
    predictionError: randomIn(-12, 12),
    reactionDelay: Math.floor(randomIn(2, 4)),
    reactionCountdown: 0,
    lastPrediction: WIDTH / 2,
    lastBallVy: -1,
    rallyCount: 0,
  };
}

function updatePaddleAI(
  ai: PaddleAI, paddleX: number,
  bx: number, by: number, vx: number, vy: number,
  randomIn: RandomIn
): number {
  const center = WIDTH / 2 - PADDLE_W / 2;

  if (vy <= 0) {
    ai.reactionCountdown = ai.reactionDelay;
    return clamp(paddleX + clamp(center - paddleX, -2, 2), MARGIN, WIDTH - MARGIN - PADDLE_W);
  }

  if (ai.lastBallVy <= 0 && vy > 0) {
    ai.reactionCountdown = Math.floor(randomIn(1, 3));
    ai.predictionError = randomIn(-10, 10);
  }
  ai.lastBallVy = vy;

  if (ai.reactionCountdown > 0) {
    ai.reactionCountdown--;
    const target = ai.lastPrediction > 0 ? ai.lastPrediction - PADDLE_W / 2 : center;
    return clamp(paddleX + clamp(target - paddleX, -PADDLE_MAX_SPEED * 0.5, PADDLE_MAX_SPEED * 0.5), MARGIN, WIDTH - MARGIN - PADDLE_W);
  }

  const predictedX = projectBallX(bx, by, vx, vy, PADDLE_Y);
  ai.lastPrediction = predictedX + ai.predictionError;

  const diff = ai.lastPrediction - PADDLE_W / 2 - paddleX;
  return clamp(paddleX + clamp(diff, -PADDLE_MAX_SPEED, PADDLE_MAX_SPEED), MARGIN, WIDTH - MARGIN - PADDLE_W);
}

function resetPaddleAIForRally(ai: PaddleAI, randomIn: RandomIn): void {
  ai.predictionError = randomIn(-10, 10);
  ai.reactionCountdown = ai.reactionDelay;
  ai.lastBallVy = -1;
  ai.rallyCount++;
}

function resetPaddleAIForLifeLost(ai: PaddleAI, randomIn: RandomIn): void {
  ai.predictionError = randomIn(-8, 8);
  ai.reactionDelay = Math.floor(randomIn(2, 4));
  ai.reactionCountdown = 0;
  ai.lastBallVy = -1;
  ai.rallyCount = 0;
}

// ── Main Generator ─────────────────────────────────────────────────────────────

export function generateBreakout(contrib: ContributionGrid, ctx: GameContext): string {
  const { theme, rng } = ctx;
  const randomIn: RandomIn = (min, max) => min + rng() * (max - min);
  const brickW = Math.floor((WIDTH - 2 * MARGIN - (contrib.weeks - 1) * BRICK_GAP) / contrib.weeks);
  const brickH = 11;
  const brickOffsetX = Math.floor((WIDTH - contrib.weeks * (brickW + BRICK_GAP) + BRICK_GAP) / 2);
  const brickBottomY = BRICK_TOP + BRICK_ROWS * (brickH + BRICK_GAP);

  // ── Build bricks + grid lookup ───────────────────────────────────────────
  const bricks: Brick[] = [];
  const brickGrid: (Brick | undefined)[][] = [];
  let brickIndex = 0;
  for (let w = 0; w < contrib.weeks; w++) {
    brickGrid[w] = [];
    for (let d = 0; d < Math.min(contrib.grid[w].length, BRICK_ROWS); d++) {
      const level = contrib.grid[w][d];
      if (level === 0) continue;
      const brick: Brick = {
        x: brickOffsetX + w * (brickW + BRICK_GAP),
        y: BRICK_TOP + d * (brickH + BRICK_GAP),
        w: brickW, h: brickH,
        alive: true, destroyFrame: -1,
        color: theme.contrib[level],
        index: brickIndex++,
      };
      bricks.push(brick);
      brickGrid[w][d] = brick;
    }
  }

  const totalBricks = bricks.length;
  let bricksRemaining = totalBricks;

  // ── Game state ─────────────────────────────────────────────────────────────
  let lives = MAX_LIVES;
  const lifeLostFrames: number[] = [];
  let state: GameState = 'playing';
  let respawnTimer = 0;
  let gameEndFrame = TOTAL_FRAMES;

  // ── Ball state ─────────────────────────────────────────────────────────────
  let speed = INITIAL_SPEED;
  let bx = WIDTH / 2, by = PADDLE_Y - 20;
  let vx = randomIn(3, 5) * (rng() > 0.5 ? 1 : -1);
  let vy = -speed * 0.8;

  function normVel(): void {
    const cs = Math.sqrt(vx * vx + vy * vy);
    if (cs > 0) { vx = (vx / cs) * speed; vy = (vy / cs) * speed; }
    if (Math.abs(vy) < speed * 0.3) {
      vy = speed * 0.3 * (vy >= 0 ? 1 : -1);
      const cs2 = Math.sqrt(vx * vx + vy * vy);
      if (cs2 > 0) { vx = (vx / cs2) * speed; vy = (vy / cs2) * speed; }
    }
  }
  normVel();

  let paddleX = WIDTH / 2 - PADDLE_W / 2;
  const paddleAI = initPaddleAI(randomIn);
  const paddleHitFrames: number[] = [];
  let ballVisible = true;

  const ballSamples: string[] = [];
  const paddleSamples: string[] = [];
  const progressSamples: number[] = [];

  function destroyColumn(w: number, f: number): void {
    for (let d = 0; d < BRICK_ROWS; d++) {
      const brick = brickGrid[w]?.[d];
      if (!brick || !brick.alive) continue;
      brick.alive = false;
      brick.destroyFrame = f;
      bricksRemaining--;
    }
  }

  function splashColumns(w: number, f: number): void {
    for (const nw of [w - 4, w - 3, w - 2, w - 1, w + 1, w + 2, w + 3, w + 4]) {
      if (nw < 0 || nw >= contrib.weeks) continue;
      const dist = Math.abs(nw - w);
      const chance = dist === 1 ? 1.0 : dist === 2 ? 0.65 : dist === 3 ? 0.30 : 0.12;
      for (let d = 0; d < BRICK_ROWS; d++) {
        const neighbor = brickGrid[nw]?.[d];
        if (!neighbor || !neighbor.alive) continue;
        if (rng() < chance) {
          neighbor.alive = false;
          neighbor.destroyFrame = f + dist;
          bricksRemaining--;
        }
      }
    }
  }

  // ── Simulation loop ────────────────────────────────────────────────────────
  const overtimeFrame = Math.floor(TOTAL_FRAMES * 0.35);

  for (let f = 0; f <= TOTAL_FRAMES; f++) {
    // Overtime — speed boost
    if (f === overtimeFrame && state === 'playing') {
      speed = clamp(speed * 1.8, MIN_SPEED, MAX_SPEED);
      normVel();
    }

    if (state === 'win' || state === 'gameover') {
      if (f === gameEndFrame) ballVisible = false;
    } else if (state === 'respawn') {
      respawnTimer--;
      bx = WIDTH / 2; by = PADDLE_Y - 20;
      const center = WIDTH / 2 - PADDLE_W / 2;
      paddleX += clamp(center - paddleX, -4, 4);
      paddleX = clamp(paddleX, MARGIN, WIDTH - MARGIN - PADDLE_W);

      if (respawnTimer <= 0) {
        state = 'playing';
        speed = Math.max(INITIAL_SPEED, speed * 0.9);
        vx = randomIn(3, 5) * (rng() > 0.5 ? 1 : -1);
        vy = -speed * 0.8;
        normVel();
        ballVisible = true;
        resetPaddleAIForLifeLost(paddleAI, randomIn);
      }
    } else {
      // ── PLAYING ──────────────────────────────────────────────────────────
      paddleX = updatePaddleAI(paddleAI, paddleX, bx, by, vx, vy, randomIn);

      const prevBx = bx, prevBy = by;
      bx += vx; by += vy;

      // Walls — slight angle perturbation on bounce to vary trajectory
      if (bx - BALL_R <= MARGIN) { bx = MARGIN + BALL_R; vx = Math.abs(vx); vy += randomIn(-0.5, 0.5); normVel(); }
      if (bx + BALL_R >= WIDTH - MARGIN) { bx = WIDTH - MARGIN - BALL_R; vx = -Math.abs(vx); vy += randomIn(-0.5, 0.5); normVel(); }
      if (by - BALL_R <= AREA_TOP) { by = AREA_TOP + BALL_R; vy = Math.abs(vy); vx += randomIn(-0.5, 0.5); normVel(); }

      // Brick destruction — column-based pierce
      if (by - BALL_R <= brickBottomY && by + BALL_R >= BRICK_TOP) {
        const colStart = Math.max(0, Math.floor((Math.min(prevBx, bx) - BALL_R - brickOffsetX) / (brickW + BRICK_GAP)));
        const colEnd = Math.min(contrib.weeks - 1, Math.floor((Math.max(prevBx, bx) + BALL_R - brickOffsetX) / (brickW + BRICK_GAP)));
        for (let w = colStart; w <= colEnd; w++) {
          const hadBricks = brickGrid[w]?.some(b => b?.alive);
          if (hadBricks) {
            destroyColumn(w, f);
            splashColumns(w, f);
            speed = clamp(speed * 1.004, MIN_SPEED, MAX_SPEED);
            normVel();
          }
        }
      }

      // Paddle — tunnel-proof: detect if ball crossed paddle Y between frames
      const crossedPaddle = vy > 0 && prevBy + BALL_R < PADDLE_Y + PADDLE_H &&
                            by + BALL_R >= PADDLE_Y;
      if (crossedPaddle && bx >= paddleX - 8 && bx <= paddleX + PADDLE_W + 8) {
        by = PADDLE_Y - BALL_R;
        const hitOffset = clamp((bx - paddleX - PADDLE_W / 2) / (PADDLE_W / 2), -1, 1);
        // Add random jitter to break periodic trajectories
        const jitter = randomIn(-0.3, 0.3);
        const angle = clamp(hitOffset + jitter, -1, 1) * 65 * (Math.PI / 180);
        vx = speed * Math.sin(angle);
        vy = -speed * Math.cos(angle);
        paddleHitFrames.push(f);
        resetPaddleAIForRally(paddleAI, randomIn);
      }

      // Ball lost
      if (by > AREA_BOTTOM + 15) {
        lives--;
        lifeLostFrames.push(f);
        ballVisible = false;
        if (lives <= 0) {
          state = 'gameover';
          gameEndFrame = f;
        } else {
          state = 'respawn';
          respawnTimer = RESPAWN_FRAMES;
        }
      }

      // Win
      if (bricksRemaining <= 0) {
        state = 'win';
        gameEndFrame = f;
      }
    }

    // ── Sample ─────────────────────────────────────────────────────────────
    if (f % SAMPLE_EVERY === 0 || f === TOTAL_FRAMES) {
      const pct = ((f / TOTAL_FRAMES) * 100).toFixed(2);
      const opacity = ballVisible && state !== 'win' && state !== 'gameover' ? 1 : 0;
      ballSamples.push(`${pct}%{transform:translate(${bx.toFixed(1)}px,${by.toFixed(1)}px);opacity:${opacity}}`);
      paddleSamples.push(`${pct}%{transform:translateX(${paddleX.toFixed(1)}px)}`);
      progressSamples.push(bricksRemaining);
    }
  }

  // ── Build SVG ──────────────────────────────────────────────────────────────

  let allStyles = '';
  let allContent = '';

  const defs = `
  <radialGradient id="ballGlow">
    <stop offset="0%" stop-color="${theme.cyan}" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="${theme.cyan}" stop-opacity="0"/>
  </radialGradient>`;

  // Ball
  allStyles += `.ball,.ball-glow{animation:bm ${DURATION}s linear forwards}`;
  allStyles += `@keyframes bm{${ballSamples.join('')}}`;

  // Paddle
  allStyles += `.pad{animation:pm ${DURATION}s linear forwards}`;
  allStyles += `@keyframes pm{${paddleSamples.join('')}}`;

  // Paddle flash
  if (paddleHitFrames.length > 0) {
    const flashStops: string[] = ['0%{opacity:0}'];
    for (const hf of paddleHitFrames) {
      const pct = ((hf / TOTAL_FRAMES) * 100).toFixed(2);
      const pctAfter = (((hf + 3) / TOTAL_FRAMES) * 100).toFixed(2);
      flashStops.push(`${pct}%{opacity:0.5}`);
      flashStops.push(`${pctAfter}%{opacity:0}`);
    }
    flashStops.push('100%{opacity:0}');
    allStyles += `.pad-flash{animation:pf ${DURATION}s step-end forwards}`;
    allStyles += `@keyframes pf{${flashStops.join('')}}`;
  }

  // Bricks
  let brickElements = '';
  for (const brick of bricks) {
    const cls = `b${brick.index}`;
    if (brick.destroyFrame >= 0) {
      const dPct = ((brick.destroyFrame / TOTAL_FRAMES) * 100).toFixed(2);
      const fPct = (((brick.destroyFrame + 1) / TOTAL_FRAMES) * 100).toFixed(2);
      allStyles += `.${cls}{animation:${cls} ${DURATION}s step-end forwards}`;
      allStyles += `@keyframes ${cls}{0%,${dPct}%{opacity:0.85}${fPct}%{opacity:0}100%{opacity:0}}`;
    } else {
      allStyles += `.${cls}{opacity:0.85}`;
    }
    brickElements += `<rect class="${cls}" x="${brick.x.toFixed(1)}" y="${brick.y}" width="${brick.w}" height="${brick.h}" rx="2" fill="${brick.color}"/>`;
  }

  // Lives
  let lifeElements = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const cx = 16 + i * 16;
    if (i < lifeLostFrames.length) {
      const lPct = ((lifeLostFrames[i] / TOTAL_FRAMES) * 100).toFixed(2);
      allStyles += `.life${i}{animation:l${i} ${DURATION}s step-end forwards}`;
      allStyles += `@keyframes l${i}{0%,${lPct}%{opacity:0.9}${lPct}%{opacity:0}100%{opacity:0}}`;
    } else {
      allStyles += `.life${i}{opacity:0.9}`;
    }
    lifeElements += `<circle class="life${i}" cx="${cx}" cy="12" r="4" fill="${theme.red}"/>`;
  }

  // Progress bar
  const progBarX = 64, progBarW = 200, progBarY = 10, progBarH = 4;
  const progStops: string[] = [];
  for (let i = 0; i < progressSamples.length; i++) {
    const pct = ((i / (progressSamples.length - 1)) * 100).toFixed(2);
    const scale = totalBricks > 0 ? (progressSamples[i] / totalBricks) : 0;
    progStops.push(`${pct}%{transform:scaleX(${scale.toFixed(3)})}`);
  }
  allStyles += `.prog{animation:pg ${DURATION}s step-end forwards;transform-origin:${progBarX}px ${progBarY + progBarH / 2}px}`;
  allStyles += `@keyframes pg{${progStops.join('')}}`;

  // Win/Lose text
  if (state === 'win') {
    const pct = ((gameEndFrame / TOTAL_FRAMES) * 100).toFixed(2);
    allStyles += `.win-text{animation:wt ${DURATION}s step-end forwards}`;
    allStyles += `@keyframes wt{0%,${pct}%{opacity:0}${pct}%,100%{opacity:1}}`;
    allStyles += `.lose-text{opacity:0}`;
  } else if (state === 'gameover') {
    const pct = ((gameEndFrame / TOTAL_FRAMES) * 100).toFixed(2);
    allStyles += `.lose-text{animation:lt ${DURATION}s step-end forwards}`;
    allStyles += `@keyframes lt{0%,${pct}%{opacity:0}${pct}%,100%{opacity:1}}`;
    allStyles += `.win-text{opacity:0}`;
  } else {
    allStyles += `.win-text{opacity:0}.lose-text{opacity:0}`;
  }

  // Content assembly
  allContent += brickElements;
  allContent += `<rect class="prog" x="${progBarX}" y="${progBarY}" width="${progBarW}" height="${progBarH}" rx="2" fill="${theme.green}" opacity="0.6"/>`;
  allContent += lifeElements;
  allContent += `<rect class="pad" x="0" y="${PADDLE_Y}" width="${PADDLE_W}" height="${PADDLE_H}" rx="3" fill="${theme.cyan}"/>`;
  if (paddleHitFrames.length > 0) {
    allContent += `<rect class="pad-flash pad" x="0" y="${PADDLE_Y}" width="${PADDLE_W}" height="${PADDLE_H}" rx="3" fill="white" opacity="0"/>`;
  }
  allContent += `<circle class="ball-glow" cx="0" cy="0" r="10" fill="url(#ballGlow)" opacity="0.5"/>`;
  allContent += `<circle class="ball" cx="0" cy="0" r="${BALL_R}" fill="${theme.fg}"/>`;

  const textY = Math.floor((PADDLE_Y + brickBottomY) / 2) + 4;
  allContent += `<text class="win-text" x="${WIDTH / 2}" y="${textY}" fill="${theme.green}" font-family="'Courier New',monospace" font-size="20" font-weight="bold" text-anchor="middle" opacity="0">YOU WIN!</text>`;
  allContent += `<text class="lose-text" x="${WIDTH / 2}" y="${textY}" fill="${theme.red}" font-family="'Courier New',monospace" font-size="20" font-weight="bold" text-anchor="middle" opacity="0">GAME OVER</text>`;

  const svg = svgWrapper(ctx, 'BREAKOUT', allStyles, allContent);
  return svg.replace('<defs>', `<defs>${defs}`);
}
