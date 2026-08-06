import { ContributionGrid } from './contributions';
import { WIDTH, HEIGHT, GameContext, svgWrapper } from './shared';

// Space Invaders — the contribution graph IS the alien formation. A cannon
// sweeps along the bottom picking off the bottom-most alien in each column
// while the whole fleet marches side to side. Score counts real contributions.

const DURATION = 16;
const TICKS = 64; // one tick = 0.25s
const FLIGHT_TICKS = 2; // bullet travel time
const COOLDOWN_TICKS = 2;
const SHIP_SPEED = 34; // px per tick
const MARCH_AMPLITUDE = 24; // px the fleet swings left/right
const SHIP_Y = 176;
const GUN_Y = SHIP_Y - 10;

// Triangle-wave march offsets, one full sweep every 16 ticks
const MARCH_PERIOD = [0, 6, 12, 18, 24, 18, 12, 6, 0, -6, -12, -18, -24, -18, -12, -6];

export function generateInvaders(contrib: ContributionGrid, ctx: GameContext): string {
  const { theme, rng } = ctx;
  const cols = contrib.weeks;
  const rows = 7;

  // ── Layout — inset so the marching fleet never leaves the frame ────────────

  const margin = 9;
  const gap = 2;
  const inset = margin + MARCH_AMPLITUDE;
  const cellSize = Math.floor((WIDTH - 2 * inset - (cols - 1) * gap) / cols);
  const step = cellSize + gap;
  const totalW = cols * step - gap;
  const offsetX = Math.floor((WIDTH - totalW) / 2);
  const offsetY = 18;

  const marchPx = (tick: number) => MARCH_PERIOD[tick % MARCH_PERIOD.length];

  const cellCenterX = (col: number) => offsetX + col * step + cellSize / 2;
  const cellCenterY = (row: number) => offsetY + row * step + cellSize / 2;

  // ── Fleet state ────────────────────────────────────────────────────────────

  const alive: boolean[][] = [];
  for (let w = 0; w < cols; w++) {
    alive[w] = [];
    for (let d = 0; d < rows; d++) {
      alive[w][d] = ((contrib.grid[w] && contrib.grid[w][d]) || 0) > 0;
    }
  }

  const columnHasAliens = (col: number) => alive[col].some(Boolean);

  const bottomAlienRow = (col: number): number => {
    for (let d = rows - 1; d >= 0; d--) {
      if (alive[col][d]) return d;
    }
    return -1;
  };

  // ── Simulation — sweep, aim, fire ──────────────────────────────────────────

  interface Kill { col: number; row: number; fireTick: number; hitTick: number; x: number; points: number }
  const kills: Kill[] = [];

  function nextTargetCol(fromCol: number, dir: number): { col: number; dir: number } {
    for (let c = fromCol; c >= 0 && c < cols; c += dir) {
      if (columnHasAliens(c)) return { col: c, dir };
    }
    for (let c = fromCol; c >= 0 && c < cols; c -= dir) {
      if (columnHasAliens(c)) return { col: c, dir: -dir };
    }
    return { col: -1, dir };
  }

  let shipX = offsetX + cellSize / 2;
  let sweepDir = 1;
  let target = nextTargetCol(0, sweepDir);
  sweepDir = target.dir;
  let cooldown = 0;
  const shipXAtTick: number[] = [];

  for (let t = 0; t < TICKS; t++) {
    if (cooldown > 0) cooldown--;

    if (target.col >= 0) {
      const hitTick = t + FLIGHT_TICKS;
      // Aim where the target column will be when the bullet lands
      const desiredX = cellCenterX(target.col) + marchPx(Math.min(hitTick, TICKS - 1));
      const diff = desiredX - shipX;
      shipX += Math.max(-SHIP_SPEED, Math.min(SHIP_SPEED, diff));

      if (cooldown === 0 && Math.abs(desiredX - shipX) < 2 && hitTick < TICKS - 1) {
        const row = bottomAlienRow(target.col);
        if (row >= 0) {
          alive[target.col][row] = false;
          const points = (contrib.counts[target.col] && contrib.counts[target.col][row]) || 1;
          kills.push({ col: target.col, row, fireTick: t, hitTick, x: desiredX, points });
          cooldown = COOLDOWN_TICKS;
          target = nextTargetCol(target.col + sweepDir, sweepDir);
          sweepDir = target.dir;
        }
      }
    } else {
      // Fleet wiped out — drift home
      const homeX = WIDTH / 2;
      shipX += Math.max(-SHIP_SPEED / 2, Math.min(SHIP_SPEED / 2, homeX - shipX));
    }

    shipXAtTick.push(shipX);
  }

  const tickPct = (t: number) => ((t / TICKS) * 100).toFixed(2);

  // ── Fleet march animation ──────────────────────────────────────────────────

  let allStyles = '';
  const marchStops: string[] = [];
  for (let t = 0; t < TICKS; t++) {
    marchStops.push(`${tickPct(t)}%{transform:translateX(${marchPx(t)}px)}`);
  }
  marchStops.push(`100%{transform:translateX(${marchPx(0)}px)}`);
  allStyles += `.fleet{animation:fm ${DURATION}s linear infinite}`;
  allStyles += `@keyframes fm{${marchStops.join('')}}`;

  // ── Alien cells ────────────────────────────────────────────────────────────

  const killByCell = new Map<string, Kill>();
  for (const kill of kills) killByCell.set(`${kill.col},${kill.row}`, kill);

  let cellElements = '';
  let killIndex = 0;
  for (let w = 0; w < cols; w++) {
    for (let d = 0; d < rows; d++) {
      const level = (contrib.grid[w] && contrib.grid[w][d]) || 0;
      if (level === 0) continue;
      const px = offsetX + w * step;
      const py = offsetY + d * step;
      const kill = killByCell.get(`${w},${d}`);
      if (kill) {
        const cls = `kc${killIndex++}`;
        const hitPct = tickPct(kill.hitTick);
        const gonePct = ((kill.hitTick / TICKS) * 100 + 0.3).toFixed(2);
        allStyles += `.${cls}{animation:${cls} ${DURATION}s step-end infinite}`;
        allStyles += `@keyframes ${cls}{0%,${hitPct}%{opacity:0.9}${gonePct}%{opacity:0}100%{opacity:0}}`;
        cellElements += `<rect class="${cls}" x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" rx="2" fill="${theme.contrib[level]}" opacity="0.9"/>`;
      } else {
        cellElements += `<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" rx="2" fill="${theme.contrib[level]}" opacity="0.9"/>`;
      }
    }
  }

  // ── Bullets + explosions ───────────────────────────────────────────────────

  let shotElements = '';
  for (let i = 0; i < kills.length; i++) {
    const kill = kills[i];
    const firePct = tickPct(kill.fireTick);
    const hitPct = tickPct(kill.hitTick);
    const cy = cellCenterY(kill.row);

    allStyles += `.bl${i}{animation:bl${i} ${DURATION}s linear infinite}`;
    allStyles += `@keyframes bl${i}{0%,${firePct}%{transform:translate(${kill.x.toFixed(1)}px,${GUN_Y}px);opacity:0}${((kill.fireTick / TICKS) * 100 + 0.2).toFixed(2)}%{opacity:1}${hitPct}%{transform:translate(${kill.x.toFixed(1)}px,${cy.toFixed(1)}px);opacity:0}100%{transform:translate(${kill.x.toFixed(1)}px,${cy.toFixed(1)}px);opacity:0}}`;
    shotElements += `<rect class="bl${i}" x="-1" y="-6" width="2" height="7" rx="1" fill="${theme.yellow}" opacity="0"/>`;

    const explodeEndPct = ((kill.hitTick / TICKS) * 100 + 2.2).toFixed(2);
    const at = `translate(${kill.x.toFixed(1)}px,${cy.toFixed(1)}px)`;
    allStyles += `.ex${i}{animation:ex${i} ${DURATION}s linear infinite}`;
    allStyles += `@keyframes ex${i}{0%,${hitPct}%{transform:${at} scale(0.2);opacity:0}${((kill.hitTick / TICKS) * 100 + 0.3).toFixed(2)}%{transform:${at} scale(0.8);opacity:0.9}${explodeEndPct}%{transform:${at} scale(1.7);opacity:0}100%{transform:${at} scale(1.7);opacity:0}}`;
    shotElements += `<g class="ex${i}" opacity="0"><circle r="${(cellSize * 0.7).toFixed(1)}" fill="${theme.orange}"/><circle r="${(cellSize * 0.35).toFixed(1)}" fill="${theme.yellow}"/></g>`;
  }

  // ── Alien bombs — falling retaliation, purely cosmetic ─────────────────────

  const survivors: { col: number; row: number }[] = [];
  for (let w = 0; w < cols; w++) {
    for (let d = 0; d < rows; d++) {
      if (alive[w][d]) survivors.push({ col: w, row: d });
    }
  }
  let bombElements = '';
  const bombCount = Math.min(4, survivors.length);
  for (let i = 0; i < bombCount; i++) {
    const cell = survivors[Math.floor(rng() * survivors.length)];
    const dropTick = 6 + Math.floor(rng() * (TICKS - 16));
    const landTick = dropTick + 4;
    const bx = (cellCenterX(cell.col) + marchPx(dropTick)).toFixed(1);
    const startY = cellCenterY(cell.row) + cellSize / 2;
    allStyles += `.bb${i}{animation:bb${i} ${DURATION}s linear infinite}`;
    allStyles += `@keyframes bb${i}{0%,${tickPct(dropTick)}%{transform:translate(${bx}px,${startY.toFixed(1)}px);opacity:0}${((dropTick / TICKS) * 100 + 0.2).toFixed(2)}%{opacity:0.9}${tickPct(landTick)}%{transform:translate(${bx}px,${HEIGHT - 12}px);opacity:0}100%{transform:translate(${bx}px,${HEIGHT - 12}px);opacity:0}}`;
    bombElements += `<rect class="bb${i}" x="-1" y="0" width="2" height="5" fill="${theme.magenta}" opacity="0"/>`;
  }

  // ── Ship ───────────────────────────────────────────────────────────────────

  const shipStops: string[] = [];
  let prevShipX = -1;
  for (let t = 0; t < TICKS; t++) {
    if (Math.abs(shipXAtTick[t] - prevShipX) > 0.5 || t === 0) {
      shipStops.push(`${tickPct(t)}%{transform:translate(${shipXAtTick[t].toFixed(1)}px,${SHIP_Y}px)}`);
      prevShipX = shipXAtTick[t];
    }
  }
  shipStops.push(`100%{transform:translate(${shipXAtTick[TICKS - 1].toFixed(1)}px,${SHIP_Y}px)}`);
  allStyles += `.ship,.ship-glow{animation:sp ${DURATION}s linear infinite}`;
  allStyles += `@keyframes sp{${shipStops.join('')}}`;

  const shipElements = `
<circle class="ship-glow" cx="0" cy="0" r="20" fill="url(#invaderGlow)" opacity="0.6"/>
<g class="ship">
  <rect x="-12" y="-3" width="24" height="6" rx="2" fill="${theme.green}"/>
  <rect x="-4" y="-8" width="8" height="6" rx="1" fill="${theme.green}"/>
  <rect x="-1" y="-12" width="2" height="5" fill="${theme.green}"/>
</g>`;

  // ── Score HUD — real contribution counts ───────────────────────────────────

  let scoreElements = '';
  let cumulativeScore = 0;
  const scoreValues: { value: number; startTick: number; endTick: number }[] = [];
  scoreValues.push({ value: 0, startTick: 0, endTick: kills.length > 0 ? kills[0].hitTick : TICKS });
  for (let i = 0; i < kills.length; i++) {
    cumulativeScore += kills[i].points;
    scoreValues.push({
      value: cumulativeScore,
      startTick: kills[i].hitTick,
      endTick: i + 1 < kills.length ? kills[i + 1].hitTick : TICKS,
    });
  }
  for (let i = 0; i < scoreValues.length; i++) {
    const sv = scoreValues[i];
    const startPct = tickPct(sv.startTick);
    const endPct = tickPct(sv.endTick);
    const text = `SCORE ${sv.value.toString().padStart(4, '0')}`;
    if (sv.startTick === 0 && sv.endTick >= TICKS) {
      scoreElements += `<text x="10" y="15" fill="${theme.green}" font-family="'Courier New',monospace" font-size="11" font-weight="bold" opacity="0.85">${text}</text>`;
      continue;
    }
    // Duplicate stop at startPct: the later block wins at that instant, so the
    // value flips on at startPct and off at endPct (step-end holds between)
    allStyles += `.sc${i}{animation:sc${i} ${DURATION}s step-end infinite}`;
    allStyles += `@keyframes sc${i}{0%,${startPct}%{opacity:0}${startPct}%{opacity:0.85}${endPct}%{opacity:0}100%{opacity:0}}`;
    scoreElements += `<text class="sc${i}" x="10" y="15" fill="${theme.green}" font-family="'Courier New',monospace" font-size="11" font-weight="bold" opacity="0">${text}</text>`;
  }

  // ── Ground line + defs ─────────────────────────────────────────────────────

  const groundY = SHIP_Y + 8;
  const groundLine = `<line x1="${margin}" y1="${groundY}" x2="${WIDTH - margin}" y2="${groundY}" stroke="${theme.dimmed}" stroke-width="1" opacity="0.25"/>`;

  const defs = `
  <radialGradient id="invaderGlow">
    <stop offset="0%" stop-color="${theme.cyan}" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="${theme.cyan}" stop-opacity="0"/>
  </radialGradient>`;

  const content = `
<g class="fleet">${cellElements}</g>
${bombElements}
${shotElements}
${groundLine}
${shipElements}
${scoreElements}`;

  const svg = svgWrapper(ctx, 'INVADERS', allStyles, content);
  return svg.replace('<defs>', `<defs>${defs}`);
}
