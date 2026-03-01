import { ContributionGrid } from './contributions';
import { WIDTH, HEIGHT, colors, svgWrapper, rand, clamp, contribColors } from './shared';

export function generateBreakout(contrib: ContributionGrid): string {
  const duration = 12;
  const fps = 30;
  const totalFrames = duration * fps;
  const sampleEvery = 2;

  const margin = 6;
  const areaTop = 5, areaBottom = HEIGHT - 5;
  const ballR = 3;

  // Bricks from contribution graph
  const brickGap = 2;
  const brickW = Math.floor((WIDTH - 2 * margin - (contrib.weeks - 1) * brickGap) / contrib.weeks);
  const brickH = 11;
  const brickTop = 15;
  const brickOffsetX = Math.floor((WIDTH - contrib.weeks * (brickW + brickGap) + brickGap) / 2);

  interface Brick { x: number; y: number; w: number; h: number; alive: boolean; destroyTime: number; color: string }
  const bricks: Brick[] = [];
  for (let w = 0; w < contrib.weeks; w++) {
    for (let d = 0; d < contrib.grid[w].length; d++) {
      const level = contrib.grid[w][d];
      if (level === 0) continue;
      bricks.push({
        x: brickOffsetX + w * (brickW + brickGap),
        y: brickTop + d * (brickH + brickGap),
        w: brickW,
        h: brickH,
        alive: true,
        destroyTime: -1,
        color: contribColors[level],
      });
    }
  }

  // Paddle and ball
  const paddleW = 70, paddleH = 7;
  const paddleY = areaBottom - 16;
  let paddleX = WIDTH / 2 - paddleW / 2;

  let bx = WIDTH / 2, by = paddleY - 15;
  let vx = rand(2.5, 3.5) * (Math.random() > 0.5 ? 1 : -1);
  let vy = -4.5;

  let pierceCooldown = 0; // frames remaining in pierce-through mode
  const recentPositions: { x: number; y: number }[] = [];

  const ballSamples: string[] = [];
  const paddleSamples: string[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    // Paddle tracks ball with anticipation — predict where ball is heading
    const anticipatedX = bx + vx * 5;
    paddleX += (anticipatedX - paddleX - paddleW / 2) * 0.35;
    paddleX = clamp(paddleX, margin, WIDTH - margin - paddleW);

    bx += vx;
    by += vy;

    // Wall bounces
    if (bx <= margin + ballR) { bx = margin + ballR; vx = Math.abs(vx); }
    if (bx >= WIDTH - margin - ballR) { bx = WIDTH - margin - ballR; vx = -Math.abs(vx); }
    if (by <= areaTop + ballR) { by = areaTop + ballR; vy = Math.abs(vy); }

    // Paddle bounce — generous hitbox
    if (by + ballR >= paddleY && by + ballR <= paddleY + paddleH + 8 &&
        bx >= paddleX - 8 && bx <= paddleX + paddleW + 8 && vy > 0) {
      by = paddleY - ballR;
      vy = -Math.abs(vy);
      vx += ((bx - paddleX - paddleW / 2) / paddleW) * 2.5;
    }

    // Brick collisions — pierce mode prevents oscillation in dense areas
    if (pierceCooldown > 0) pierceCooldown--;
    if (pierceCooldown === 0) {
      // Normal hit: bounce off first brick, then enter pierce mode
      for (const brick of bricks) {
        if (!brick.alive) continue;
        if (bx + ballR >= brick.x && bx - ballR <= brick.x + brick.w &&
            by + ballR >= brick.y && by - ballR <= brick.y + brick.h) {
          brick.alive = false;
          brick.destroyTime = (f / totalFrames) * duration;
          const overlapX = Math.min((bx + ballR) - brick.x, (brick.x + brick.w) - (bx - ballR));
          const overlapY = Math.min((by + ballR) - brick.y, (brick.y + brick.h) - (by - ballR));
          if (overlapX < overlapY) { vx = -vx; } else { vy = -vy; }
          pierceCooldown = 3;
          break;
        }
      }
    } else {
      // Pierce mode: destroy bricks in path without changing direction
      for (const brick of bricks) {
        if (!brick.alive) continue;
        if (bx + ballR >= brick.x && bx - ballR <= brick.x + brick.w &&
            by + ballR >= brick.y && by - ballR <= brick.y + brick.h) {
          brick.alive = false;
          brick.destroyTime = (f / totalFrames) * duration;
        }
      }
    }

    // Ball off bottom — reset
    if (by > areaBottom + 10) {
      bx = WIDTH / 2;
      by = paddleY - 15;
      vx = rand(2.5, 3.5) * (Math.random() > 0.5 ? 1 : -1);
      vy = -4.5;
      pierceCooldown = 0;
    }

    // Speed clamp
    const spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > 7) { vx *= 7 / spd; vy *= 7 / spd; }
    if (spd < 3.5) { vx *= 3.5 / spd; vy *= 3.5 / spd; }

    // Anti-stuck watchdog: if ball barely moved over 8 frames, nudge it
    recentPositions.push({ x: bx, y: by });
    if (recentPositions.length > 8) recentPositions.shift();
    if (recentPositions.length === 8) {
      const rangeX = Math.max(...recentPositions.map(p => p.x)) - Math.min(...recentPositions.map(p => p.x));
      const rangeY = Math.max(...recentPositions.map(p => p.y)) - Math.min(...recentPositions.map(p => p.y));
      if (rangeX < 10 && rangeY < 10) {
        vx = rand(3, 4) * (vx >= 0 ? 1 : -1);
        vy = rand(3, 4) * (vy >= 0 ? 1 : -1);
        pierceCooldown = 3;
      }
    }

    if (f % sampleEvery === 0 || f === totalFrames) {
      const pct = ((f / totalFrames) * 100).toFixed(2);
      ballSamples.push(`${pct}%{transform:translate(${bx.toFixed(1)}px,${by.toFixed(1)}px)}`);
      paddleSamples.push(`${pct}%{transform:translateX(${paddleX.toFixed(1)}px)}`);
    }
  }

  // Build brick elements
  let brickElements = '';
  for (const brick of bricks) {
    if (brick.destroyTime >= 0) {
      brickElements += `<rect class="brk" x="${brick.x.toFixed(1)}" y="${brick.y}" width="${brick.w}" height="${brick.h}" rx="1" fill="${brick.color}" style="animation-delay:${brick.destroyTime.toFixed(2)}s"/>`;
    } else {
      brickElements += `<rect x="${brick.x.toFixed(1)}" y="${brick.y}" width="${brick.w}" height="${brick.h}" rx="1" fill="${brick.color}"/>`;
    }
  }

  const styles = `
.ball{animation:bm ${duration}s linear forwards}
.pad{animation:pm ${duration}s linear forwards}
.brk{animation:bp 0.15s ease forwards}
@keyframes bm{${ballSamples.join('')}}
@keyframes pm{${paddleSamples.join('')}}
@keyframes bp{to{opacity:0;transform:scale(1.3)}}`;

  const content = `
${brickElements}
<rect class="pad" x="0" y="${paddleY}" width="${paddleW}" height="${paddleH}" rx="3" fill="${colors.cyan}"/>
<circle class="ball" cx="0" cy="0" r="${ballR}" fill="${colors.fg}"/>`;

  return svgWrapper('BREAKOUT', styles, content);
}
