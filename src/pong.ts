import { ContributionGrid } from './contributions';
import { WIDTH, HEIGHT, GameContext, svgWrapper, clamp, renderContribBackground, contribGridLayout } from './shared';

const DURATION = 12;
const FPS = 30;
const TOTAL_FRAMES = DURATION * FPS;
const SAMPLE_EVERY = 2;

const PADDLE_W = 8;
const PADDLE_H = 35;
const PADDLE_MARGIN = 20;
const BALL_R = 4;
const AREA_TOP = 22;
const AREA_BOTTOM = HEIGHT - 5;

const RIGHT_PADDLE_X = WIDTH - PADDLE_MARGIN - PADDLE_W;

export function generatePong(contrib: ContributionGrid, ctx: GameContext): string {
  const { theme, rng } = ctx;
  const rand = (min: number, max: number) => min + rng() * (max - min);

  // ── Ball state ─────────────────────────────────────────────────────────────

  const baseSpeed = 9.0;
  let bx = WIDTH / 2, by = (AREA_TOP + AREA_BOTTOM) / 2;
  let vx = rand(6.5, 8.0) * (rng() > 0.5 ? 1 : -1);
  let vy = rand(3.5, 5.5) * (rng() > 0.5 ? 1 : -1);

  // ── Paddle AI state ────────────────────────────────────────────────────────

  interface PaddleAI {
    y: number;
    maxSpeed: number;
    predictionError: number;
    reactionDelay: number;
    reactionCountdown: number;
    lastPredictedY: number;
    lastBallVx: number;
    overshootBias: number; // tendency to overshoot target
  }

  // Left paddle: "The Aggressive" — faster but bigger errors
  const leftAI: PaddleAI = {
    y: by - PADDLE_H / 2,
    maxSpeed: 2.0,
    predictionError: rand(-50, 50),
    reactionDelay: Math.floor(rand(3, 7)),
    reactionCountdown: 0,
    lastPredictedY: by,
    lastBallVx: vx,
    overshootBias: rand(6, 14),
  };

  // Right paddle: "The Steady" — slower, less error
  const rightAI: PaddleAI = {
    y: by - PADDLE_H / 2,
    maxSpeed: 1.8,
    predictionError: rand(-40, 40),
    reactionDelay: Math.floor(rand(4, 9)),
    reactionCountdown: 0,
    lastPredictedY: by,
    lastBallVx: vx,
    overshootBias: rand(3, 8),
  };

  let leftScore = 0, rightScore = 0;

  // Track score change frames for flash effect
  const scoreFrames: { frame: number; side: 'left' | 'right' }[] = [];

  // ── Ball trajectory projection ─────────────────────────────────────────────

  function projectBallY(fromX: number, fromY: number, velX: number, velY: number, targetX: number): number {
    let x = fromX, y = fromY, dvx = velX, dvy = velY;
    // Don't project if ball is moving away from target
    if ((targetX > x && dvx < 0) || (targetX < x && dvx > 0)) return y;

    for (let i = 0; i < 500; i++) {
      const stepsToTarget = (targetX - x) / dvx;
      if (stepsToTarget <= 1 && stepsToTarget >= 0) {
        return y + dvy * stepsToTarget;
      }
      x += dvx;
      y += dvy;
      // Wall bounces (top/bottom)
      if (y <= AREA_TOP + BALL_R) { y = AREA_TOP + BALL_R; dvy = Math.abs(dvy); }
      if (y >= AREA_BOTTOM - BALL_R) { y = AREA_BOTTOM - BALL_R; dvy = -Math.abs(dvy); }
    }
    return y;
  }

  // ── Paddle AI update ───────────────────────────────────────────────────────

  function updatePaddle(ai: PaddleAI, paddleX: number, isLeft: boolean): void {
    const ballComingToward = isLeft ? vx < 0 : vx > 0;
    const ballOnMySide = isLeft ? bx < WIDTH * 0.5 : bx > WIDTH * 0.5;

    // Re-roll prediction error when ball changes direction
    const dirChanged = isLeft ? (ai.lastBallVx >= 0 && vx < 0) : (ai.lastBallVx <= 0 && vx > 0);
    if (dirChanged) {
      ai.predictionError = isLeft ? rand(-50, 50) : rand(-40, 40);
      ai.lastPredictedY = 0;
    }
    ai.lastBallVx = vx;

    let targetY: number;

    if (!ballComingToward) {
      // Ball going away — follow ball's Y reactively (paddle stays alive visually)
      targetY = by;
      ai.lastPredictedY = 0;
    } else if (!ballOnMySide) {
      // Ball coming but on far side — follow loosely with mild error
      targetY = by + ai.predictionError * 0.3;
    } else {
      // Ball on my half — COMMIT to predicted arrival Y (lock in)
      if (ai.lastPredictedY === 0) {
        const targetX = isLeft ? PADDLE_MARGIN + PADDLE_W + BALL_R : RIGHT_PADDLE_X - BALL_R;
        ai.lastPredictedY = projectBallY(bx, by, vx, vy, targetX) + ai.predictionError;
      }
      targetY = ai.lastPredictedY;
    }

    const desiredPaddleY = targetY - PADDLE_H / 2;
    const diff = desiredPaddleY - ai.y;
    ai.y += clamp(diff, -ai.maxSpeed, ai.maxSpeed);
    ai.y = clamp(ai.y, AREA_TOP, AREA_BOTTOM - PADDLE_H);
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  const ballSamples: string[] = [];
  const lpSamples: string[] = [];
  const rpSamples: string[] = [];

  for (let f = 0; f <= TOTAL_FRAMES; f++) {
    // Update paddles
    updatePaddle(leftAI, PADDLE_MARGIN, true);
    updatePaddle(rightAI, RIGHT_PADDLE_X, false);

    // Move ball
    bx += vx;
    by += vy;

    // Wall bounces (top/bottom)
    if (by <= AREA_TOP + BALL_R) { by = AREA_TOP + BALL_R; vy = Math.abs(vy); }
    if (by >= AREA_BOTTOM - BALL_R) { by = AREA_BOTTOM - BALL_R; vy = -Math.abs(vy); }

    // Left paddle bounce — steep angle reflection
    if (bx - BALL_R <= PADDLE_MARGIN + PADDLE_W && vx < 0 &&
        by >= leftAI.y - 3 && by <= leftAI.y + PADDLE_H + 3) {
      bx = PADDLE_MARGIN + PADDLE_W + BALL_R;
      const hitOffset = (by - leftAI.y - PADDLE_H / 2) / (PADDLE_H / 2);
      const spd = Math.sqrt(vx * vx + vy * vy) * 1.03;
      const angle = hitOffset * 55 * (Math.PI / 180);
      vx = spd * Math.cos(angle);
      vy = spd * Math.sin(angle);
    }

    // Right paddle bounce — steep angle reflection
    if (bx + BALL_R >= RIGHT_PADDLE_X && vx > 0 &&
        by >= rightAI.y - 3 && by <= rightAI.y + PADDLE_H + 3) {
      bx = RIGHT_PADDLE_X - BALL_R;
      const hitOffset = (by - rightAI.y - PADDLE_H / 2) / (PADDLE_H / 2);
      const spd = Math.sqrt(vx * vx + vy * vy) * 1.03;
      const angle = hitOffset * 55 * (Math.PI / 180);
      vx = -spd * Math.cos(angle);
      vy = spd * Math.sin(angle);
    }

    // Speed management
    const spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > 9) { vx *= 9 / spd; vy *= 9 / spd; }
    if (Math.abs(vy) < 0.8) vy += vy >= 0 ? 0.5 : -0.5;

    // Left scores (ball off right)
    if (bx > WIDTH + 5) {
      leftScore++;
      scoreFrames.push({ frame: f, side: 'left' });
      bx = WIDTH / 2; by = (AREA_TOP + AREA_BOTTOM) / 2;
      vx = rand(-8, -6.5); vy = rand(3.5, 5.5) * (rng() > 0.5 ? 1 : -1);
      // Re-roll AI errors for new rally
      leftAI.predictionError = rand(-50, 50);
      rightAI.predictionError = rand(-40, 40);
      leftAI.reactionCountdown = leftAI.reactionDelay;
      rightAI.reactionCountdown = rightAI.reactionDelay;
    }

    // Right scores (ball off left)
    if (bx < -5) {
      rightScore++;
      scoreFrames.push({ frame: f, side: 'right' });
      bx = WIDTH / 2; by = (AREA_TOP + AREA_BOTTOM) / 2;
      vx = rand(6.5, 8); vy = rand(3.5, 5.5) * (rng() > 0.5 ? 1 : -1);
      leftAI.predictionError = rand(-50, 50);
      rightAI.predictionError = rand(-40, 40);
      leftAI.reactionCountdown = leftAI.reactionDelay;
      rightAI.reactionCountdown = rightAI.reactionDelay;
    }

    // Sample
    if (f % SAMPLE_EVERY === 0 || f === TOTAL_FRAMES) {
      const pct = ((f / TOTAL_FRAMES) * 100).toFixed(2);
      ballSamples.push(`${pct}%{transform:translate(${bx.toFixed(1)}px,${by.toFixed(1)}px)}`);
      lpSamples.push(`${pct}%{transform:translateY(${leftAI.y.toFixed(1)}px)}`);
      rpSamples.push(`${pct}%{transform:translateY(${rightAI.y.toFixed(1)}px)}`);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const layout = contribGridLayout(contrib);
  const contribBg = renderContribBackground(theme, contrib, layout.cellSize, layout.gap, layout.offsetX, layout.offsetY, 0.2);

  // Center dashed line
  let centerLine = '';
  for (let y = AREA_TOP; y < AREA_BOTTOM; y += 12) {
    centerLine += `<rect x="${WIDTH / 2 - 1}" y="${y}" width="2" height="6" fill="${theme.dimmed}" opacity="0.3"/>`;
  }

  // SVG defs for ball glow
  const defs = `
  <radialGradient id="pongGlow">
    <stop offset="0%" stop-color="${theme.yellow}" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="${theme.yellow}" stop-opacity="0"/>
  </radialGradient>`;

  // Styles
  let allStyles = '';
  allStyles += `.ball,.ball-glow{animation:bm ${DURATION}s linear infinite}`;
  allStyles += `@keyframes bm{${ballSamples.join('')}}`;
  allStyles += `.lp{animation:lpm ${DURATION}s linear infinite}`;
  allStyles += `@keyframes lpm{${lpSamples.join('')}}`;
  allStyles += `.rp{animation:rpm ${DURATION}s linear infinite}`;
  allStyles += `@keyframes rpm{${rpSamples.join('')}}`;

  // Score flash keyframes — brief opacity pulse on score
  let scoreFlashElements = '';
  if (scoreFrames.length > 0) {
    const leftFlashStops: string[] = ['0%{opacity:0}'];
    const rightFlashStops: string[] = ['0%{opacity:0}'];

    for (const sf of scoreFrames) {
      const pct = ((sf.frame / TOTAL_FRAMES) * 100).toFixed(2);
      const pctEnd = (((sf.frame + 8) / TOTAL_FRAMES) * 100).toFixed(2);
      if (sf.side === 'left') {
        leftFlashStops.push(`${pct}%{opacity:0.8}`);
        leftFlashStops.push(`${pctEnd}%{opacity:0}`);
      } else {
        rightFlashStops.push(`${pct}%{opacity:0.8}`);
        rightFlashStops.push(`${pctEnd}%{opacity:0}`);
      }
    }
    leftFlashStops.push('100%{opacity:0}');
    rightFlashStops.push('100%{opacity:0}');

    allStyles += `.lf{animation:lf ${DURATION}s step-end infinite}`;
    allStyles += `@keyframes lf{${leftFlashStops.join('')}}`;
    allStyles += `.rf{animation:rf ${DURATION}s step-end infinite}`;
    allStyles += `@keyframes rf{${rightFlashStops.join('')}}`;

    // Flash rectangles covering each half of the screen
    scoreFlashElements += `<rect class="lf" x="0" y="${AREA_TOP}" width="${WIDTH / 2}" height="${AREA_BOTTOM - AREA_TOP}" fill="${theme.blue}" opacity="0"/>`;
    scoreFlashElements += `<rect class="rf" x="${WIDTH / 2}" y="${AREA_TOP}" width="${WIDTH / 2}" height="${AREA_BOTTOM - AREA_TOP}" fill="${theme.red}" opacity="0"/>`;
  }

  const content = `
${contribBg}
${centerLine}
${scoreFlashElements}
<text x="${WIDTH / 2 - 30}" y="16" fill="${theme.blue}" font-family="'Courier New',monospace" font-size="14" opacity="0.7">${leftScore}</text>
<text x="${WIDTH / 2 + 22}" y="16" fill="${theme.red}" font-family="'Courier New',monospace" font-size="14" opacity="0.7">${rightScore}</text>
<rect class="lp" x="${PADDLE_MARGIN}" y="0" width="${PADDLE_W}" height="${PADDLE_H}" rx="2" fill="${theme.blue}"/>
<rect class="rp" x="${RIGHT_PADDLE_X}" y="0" width="${PADDLE_W}" height="${PADDLE_H}" rx="2" fill="${theme.red}"/>
<circle class="ball-glow" cx="0" cy="0" r="12" fill="url(#pongGlow)" opacity="0.5"/>
<circle class="ball" cx="0" cy="0" r="${BALL_R}" fill="${theme.yellow}"/>`;

  const svg = svgWrapper(ctx, 'PONG', allStyles, content);
  return svg.replace('<defs>', `<defs>${defs}`);
}
