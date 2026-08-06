// Renders every game in both themes to preview/*.svg using deterministic
// fallback contribution data — no network or token needed.
// Usage: npm run preview [seed]

import * as fs from 'fs';
import * as path from 'path';
import { generateFallback } from '../src/contributions';
import { GameContext, createRng, themes, ThemeName } from '../src/shared';
import { generatePong } from '../src/pong';
import { generateBreakout } from '../src/breakout';
import { generateSnake } from '../src/snake';
import { generateLife } from '../src/life';
import { generateTron } from '../src/tron';
import { generateInvaders } from '../src/invaders';

const games = {
  invaders: generateInvaders,
  breakout: generateBreakout,
  snake: generateSnake,
  life: generateLife,
  tron: generateTron,
  pong: generatePong,
};

const seed = process.argv[2] || 'preview';
const outputDir = path.resolve(process.cwd(), 'preview');
fs.mkdirSync(outputDir, { recursive: true });

const contributions = generateFallback(createRng(`fallback:${seed}`));
console.log(`Fallback grid: ${contributions.weeks} weeks, ${contributions.total} total contributions`);

for (const [gameName, generate] of Object.entries(games)) {
  for (const themeName of Object.keys(themes) as ThemeName[]) {
    const ctx: GameContext = {
      theme: themes[themeName],
      rng: createRng(`${gameName}:preview:${seed}`),
      username: 'TickTockBent',
      totalContributions: contributions.total,
    };
    const svg = generate(contributions, ctx);
    const outputPath = path.join(outputDir, `${gameName}-${themeName}.svg`);
    fs.writeFileSync(outputPath, svg);
    console.log(`${outputPath} (${(svg.length / 1024).toFixed(1)} KB)`);
  }
}
