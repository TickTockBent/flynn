import { ContributionGrid } from './contributions';
import { WIDTH, HEIGHT, colors, svgWrapper, rand, clamp, renderContribBackground, contribGridLayout } from './shared';

export function generatePong(contrib: ContributionGrid): string {
  const duration = 10;
  const fps = 30;
  const totalFrames = duration * fps;
  const sampleEvery = 2;

  const paddleW = 8, paddleH = 35, paddleMargin = 20;
  const ballR = 4;
  const areaTop = 22, areaBottom = HEIGHT - 5;
  const rightPaddleX = WIDTH - paddleMargin - paddleW;

  let bx = WIDTH / 2, by = (areaTop + areaBottom) / 2;
  const baseSpeed = 5.0;
  let vx = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
  let vy = rand(-2.5, 2.5);

  let lpy = by - paddleH / 2, rpy = by - paddleH / 2;
  let leftScore = 0, rightScore = 0;

  const ballSamples: string[] = [];
  const lpSamples: string[] = [];
  const rpSamples: string[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    // Paddles track ball — active side tracks faster, far side drifts
    const leftActive = bx < WIDTH * 0.55;
    const rightActive = bx > WIDTH * 0.45;
    lpy += (by - lpy - paddleH / 2) * (leftActive ? 0.12 : 0.03);
    rpy += (by - rpy - paddleH / 2) * (rightActive ? 0.10 : 0.03);
    // Add slight imperfection
    lpy += rand(-0.3, 0.3);
    rpy += rand(-0.3, 0.3);
    lpy = clamp(lpy, areaTop, areaBottom - paddleH);
    rpy = clamp(rpy, areaTop, areaBottom - paddleH);

    bx += vx;
    by += vy;

    // Wall bounce
    if (by <= areaTop + ballR) { by = areaTop + ballR; vy = Math.abs(vy); }
    if (by >= areaBottom - ballR) { by = areaBottom - ballR; vy = -Math.abs(vy); }

    // Left paddle bounce
    if (bx - ballR <= paddleMargin + paddleW && vx < 0 && by >= lpy - 2 && by <= lpy + paddleH + 2) {
      bx = paddleMargin + paddleW + ballR;
      vx = Math.abs(vx) * 1.05;
      vy += ((by - lpy - paddleH / 2) / paddleH) * 3;
    }

    // Right paddle bounce
    if (bx + ballR >= rightPaddleX && vx > 0 && by >= rpy - 2 && by <= rpy + paddleH + 2) {
      bx = rightPaddleX - ballR;
      vx = -Math.abs(vx) * 1.05;
      vy += ((by - rpy - paddleH / 2) / paddleH) * 3;
    }

    // Speed clamp
    const spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > 8) { vx *= 8 / spd; vy *= 8 / spd; }
    if (Math.abs(vy) < 0.8) vy += vy >= 0 ? 0.5 : -0.5;

    // Score
    if (bx < -5) {
      rightScore++;
      bx = WIDTH / 2; by = (areaTop + areaBottom) / 2;
      vx = baseSpeed; vy = rand(-2, 2);
    }
    if (bx > WIDTH + 5) {
      leftScore++;
      bx = WIDTH / 2; by = (areaTop + areaBottom) / 2;
      vx = -baseSpeed; vy = rand(-2, 2);
    }

    if (f % sampleEvery === 0 || f === totalFrames) {
      const pct = ((f / totalFrames) * 100).toFixed(2);
      ballSamples.push(`${pct}%{transform:translate(${bx.toFixed(1)}px,${by.toFixed(1)}px)}`);
      lpSamples.push(`${pct}%{transform:translateY(${lpy.toFixed(1)}px)}`);
      rpSamples.push(`${pct}%{transform:translateY(${rpy.toFixed(1)}px)}`);
    }
  }

  // Contribution background
  const layout = contribGridLayout(contrib);
  const contribBg = renderContribBackground(contrib, layout.cellSize, layout.gap, layout.offsetX, layout.offsetY, 0.2);

  // Center dashed line
  let centerLine = '';
  for (let y = areaTop; y < areaBottom; y += 12) {
    centerLine += `<rect x="${WIDTH / 2 - 1}" y="${y}" width="2" height="6" fill="${colors.dimmed}" opacity="0.3"/>`;
  }

  const styles = `
.ball{animation:bm ${duration}s linear infinite}
.lp{animation:lpm ${duration}s linear infinite}
.rp{animation:rpm ${duration}s linear infinite}
@keyframes bm{${ballSamples.join('')}}
@keyframes lpm{${lpSamples.join('')}}
@keyframes rpm{${rpSamples.join('')}}`;

  const content = `
${contribBg}
${centerLine}
<text x="${WIDTH / 2 - 30}" y="16" fill="${colors.blue}" font-family="'Courier New',monospace" font-size="14" opacity="0.7">${leftScore}</text>
<text x="${WIDTH / 2 + 22}" y="16" fill="${colors.red}" font-family="'Courier New',monospace" font-size="14" opacity="0.7">${rightScore}</text>
<rect class="lp" x="${paddleMargin}" y="0" width="${paddleW}" height="${paddleH}" rx="2" fill="${colors.blue}"/>
<rect class="rp" x="${rightPaddleX}" y="0" width="${paddleW}" height="${paddleH}" rx="2" fill="${colors.red}"/>
<circle class="ball" cx="0" cy="0" r="${ballR}" fill="${colors.yellow}"/>`;

  return svgWrapper('PONG', styles, content);
}
