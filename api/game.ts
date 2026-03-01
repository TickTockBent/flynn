import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generatePong } from '../src/pong';
import { generateBreakout } from '../src/breakout';
import { generateSnake } from '../src/snake';
import { generateLife } from '../src/life';

const games: Record<string, () => string> = {
  pong: generatePong,
  breakout: generateBreakout,
  snake: generateSnake,
  life: generateLife,
};

const gameNames = Object.keys(games);

export default function handler(req: VercelRequest, res: VercelResponse) {
  const requestedGame = typeof req.query.game === 'string' ? req.query.game : undefined;

  let gameName: string;
  if (requestedGame && games[requestedGame]) {
    gameName = requestedGame;
  } else {
    gameName = gameNames[Math.floor(Math.random() * gameNames.length)];
  }

  const svg = games[gameName]();

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).send(svg);
}
