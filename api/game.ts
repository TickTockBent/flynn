import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchContributions, ContributionGrid } from '../src/contributions';
import { generatePong } from '../src/pong';
import { generateBreakout } from '../src/breakout';
import { generateSnake } from '../src/snake';
import { generateLife } from '../src/life';
import { generateTron } from '../src/tron';

const games: Record<string, (c: ContributionGrid) => string> = {
  breakout: generateBreakout,
  snake: generateSnake,
  life: generateLife,
  tron: generateTron,
};

// Pong is still accessible via ?game=pong but excluded from random rotation
const allGames: Record<string, (c: ContributionGrid) => string> = {
  ...games,
  pong: generatePong,
};

const gameNames = Object.keys(games);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const username = (typeof req.query.username === 'string' ? req.query.username : '') || 'TickTockBent';
  const token = process.env.PAT_1 || '';

  const contributions = await fetchContributions(username, token);

  const requestedGame = typeof req.query.game === 'string' ? req.query.game : undefined;
  let gameName: string;
  if (requestedGame && allGames[requestedGame]) {
    gameName = requestedGame;
  } else {
    gameName = gameNames[Math.floor(Math.random() * gameNames.length)];
  }

  const svg = allGames[gameName](contributions);

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).send(svg);
}
