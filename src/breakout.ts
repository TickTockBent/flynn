import { WIDTH, HEIGHT, colors, svgWrapper, rand, clamp } from './shared';

export function generateBreakout(): string {
  const duration = 15;
  const fps = 30;
  const totalFrames = duration * fps;
  const sampleEvery = 3;

  const margin = 8;
  const areaTop = 5, areaBottom = HEIGHT - 5;
  const ballR = 3;

  const brickRows = 3, brickCols = 20;
  const brickGap = 2;
  const brickW = (WIDTH - 2 * margin - (brickCols - 1) * brickGap) / brickCols;
  const brickH = 12;
  const brickTop = 20;
  const rowColors = [colors.red, colors.orange, colors.yellow];

  interface Brick { x: number; y: number; alive: boolean; destroyTime: number; color: string }
  const bricks: Brick[] = [];
  for (let r = 0; r < brickRows; r++) {
    for (let c = 0; c < brickCols; c++) {
      bricks.push({
        x: margin + c * (brickW + brickGap),
        y: brickTop + r * (brickH + brickGap),
        alive: true,
        destroyTime: -1,
        color: rowColors[r],
      });
    }
  }

  const paddleW = 60, paddleH = 7;
  const paddleY = areaBottom - 18;
  let paddleX = WIDTH / 2 - paddleW / 2;

  let bx = WIDTH / 2, by = paddleY - 20;
  let vx = rand(1.5, 2.5) * (Math.random() > 0.5 ? 1 : -1);
  let vy = -3;

  const ballSamples: string[] = [];
  const paddleSamples: string[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    paddleX += (bx - paddleX - paddleW / 2) * 0.1;
    paddleX = clamp(paddleX, margin, WIDTH - margin - paddleW);

    bx += vx;
    by += vy;

    if (bx <= margin + ballR) { bx = margin + ballR; vx = Math.abs(vx); }
    if (bx >= WIDTH - margin - ballR) { bx = WIDTH - margin - ballR; vx = -Math.abs(vx); }
    if (by <= areaTop + ballR) { by = areaTop + ballR; vy = Math.abs(vy); }

    if (by + ballR >= paddleY && by + ballR <= paddleY + paddleH + 4 &&
        bx >= paddleX - 2 && bx <= paddleX + paddleW + 2 && vy > 0) {
      by = paddleY - ballR;
      vy = -Math.abs(vy);
      vx += ((bx - paddleX - paddleW / 2) / paddleW) * 3;
    }

    for (const brick of bricks) {
      if (!brick.alive) continue;
      if (bx + ballR >= brick.x && bx - ballR <= brick.x + brickW &&
          by + ballR >= brick.y && by - ballR <= brick.y + brickH) {
        brick.alive = false;
        brick.destroyTime = (f / totalFrames) * duration;
        const overlapLeft = (bx + ballR) - brick.x;
        const overlapRight = (brick.x + brickW) - (bx - ballR);
        const overlapTop = (by + ballR) - brick.y;
        const overlapBottom = (brick.y + brickH) - (by - ballR);
        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);
        if (minOverlapX < minOverlapY) { vx = -vx; } else { vy = -vy; }
        break;
      }
    }

    if (by > areaBottom + 10) {
      bx = WIDTH / 2;
      by = paddleY - 20;
      vx = rand(1.5, 2.5) * (Math.random() > 0.5 ? 1 : -1);
      vy = -3;
    }

    const spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > 5) { vx *= 5 / spd; vy *= 5 / spd; }

    if (f % sampleEvery === 0 || f === totalFrames) {
      const pct = ((f / totalFrames) * 100).toFixed(2);
      ballSamples.push(`${pct}%{transform:translate(${bx.toFixed(1)}px,${by.toFixed(1)}px)}`);
      paddleSamples.push(`${pct}%{transform:translateX(${paddleX.toFixed(1)}px)}`);
    }
  }

  let brickElements = '';
  for (const brick of bricks) {
    if (brick.destroyTime >= 0) {
      brickElements += `<rect class="brk" x="${brick.x.toFixed(1)}" y="${brick.y}" width="${brickW.toFixed(1)}" height="${brickH}" rx="1" fill="${brick.color}" style="animation-delay:${brick.destroyTime.toFixed(2)}s"/>`;
    } else {
      brickElements += `<rect x="${brick.x.toFixed(1)}" y="${brick.y}" width="${brickW.toFixed(1)}" height="${brickH}" rx="1" fill="${brick.color}"/>`;
    }
  }

  const styles = `
.ball{animation:bm ${duration}s linear infinite}
.pad{animation:pm ${duration}s linear infinite}
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
