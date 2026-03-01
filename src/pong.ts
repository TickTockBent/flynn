import { WIDTH, HEIGHT, colors, svgWrapper, rand, clamp } from './shared';

export function generatePong(): string {
  const duration = 12;
  const fps = 30;
  const totalFrames = duration * fps;
  const sampleEvery = 3;

  const paddleW = 8, paddleH = 35, paddleMargin = 20;
  const ballR = 4;
  const areaTop = 22, areaBottom = HEIGHT - 5;
  const rightPaddleX = WIDTH - paddleMargin - paddleW;

  let bx = WIDTH / 2, by = (areaTop + areaBottom) / 2;
  const baseSpeed = 3.5;
  let vx = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
  let vy = rand(-1.5, 1.5);

  let lpy = by - paddleH / 2, rpy = by - paddleH / 2;
  let leftScore = 0, rightScore = 0;

  const ballSamples: string[] = [];
  const lpSamples: string[] = [];
  const rpSamples: string[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    lpy += (bx < WIDTH / 2 ? (by - lpy - paddleH / 2) * 0.09 : (by - lpy - paddleH / 2) * 0.04);
    rpy += (bx > WIDTH / 2 ? (by - rpy - paddleH / 2) * 0.09 : (by - rpy - paddleH / 2) * 0.04);
    lpy = clamp(lpy, areaTop, areaBottom - paddleH);
    rpy = clamp(rpy, areaTop, areaBottom - paddleH);

    bx += vx;
    by += vy;

    if (by <= areaTop + ballR) { by = areaTop + ballR; vy = Math.abs(vy); }
    if (by >= areaBottom - ballR) { by = areaBottom - ballR; vy = -Math.abs(vy); }

    if (bx - ballR <= paddleMargin + paddleW && vx < 0 && by >= lpy - 2 && by <= lpy + paddleH + 2) {
      bx = paddleMargin + paddleW + ballR;
      vx = Math.abs(vx);
      vy += ((by - lpy - paddleH / 2) / paddleH) * 2;
    }

    if (bx + ballR >= rightPaddleX && vx > 0 && by >= rpy - 2 && by <= rpy + paddleH + 2) {
      bx = rightPaddleX - ballR;
      vx = -Math.abs(vx);
      vy += ((by - rpy - paddleH / 2) / paddleH) * 2;
    }

    const spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > 5.5) { vx *= 5.5 / spd; vy *= 5.5 / spd; }
    if (Math.abs(vy) < 0.5) vy += vy >= 0 ? 0.3 : -0.3;

    if (bx < -5) {
      rightScore++;
      bx = WIDTH / 2; by = (areaTop + areaBottom) / 2;
      vx = baseSpeed; vy = rand(-1.5, 1.5);
    }
    if (bx > WIDTH + 5) {
      leftScore++;
      bx = WIDTH / 2; by = (areaTop + areaBottom) / 2;
      vx = -baseSpeed; vy = rand(-1.5, 1.5);
    }

    if (f % sampleEvery === 0 || f === totalFrames) {
      const pct = ((f / totalFrames) * 100).toFixed(2);
      ballSamples.push(`${pct}%{transform:translate(${bx.toFixed(1)}px,${by.toFixed(1)}px)}`);
      lpSamples.push(`${pct}%{transform:translateY(${lpy.toFixed(1)}px)}`);
      rpSamples.push(`${pct}%{transform:translateY(${rpy.toFixed(1)}px)}`);
    }
  }

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
${centerLine}
<text x="${WIDTH / 2 - 30}" y="16" fill="${colors.blue}" font-family="'Courier New',monospace" font-size="14" opacity="0.7">${leftScore}</text>
<text x="${WIDTH / 2 + 22}" y="16" fill="${colors.red}" font-family="'Courier New',monospace" font-size="14" opacity="0.7">${rightScore}</text>
<rect class="lp" x="${paddleMargin}" y="0" width="${paddleW}" height="${paddleH}" rx="2" fill="${colors.blue}"/>
<rect class="rp" x="${rightPaddleX}" y="0" width="${paddleW}" height="${paddleH}" rx="2" fill="${colors.red}"/>
<circle class="ball" cx="0" cy="0" r="${ballR}" fill="${colors.yellow}"/>`;

  return svgWrapper('PONG', styles, content);
}
