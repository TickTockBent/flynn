import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchContributions, ContributionGrid } from '../src/contributions';
import { GameContext, ThemeName, createRng, themes } from '../src/shared';
import { generatePong } from '../src/pong';
import { generateBreakout } from '../src/breakout';
import { generateSnake } from '../src/snake';
import { generateLife } from '../src/life';
import { generateTron } from '../src/tron';
import { generateInvaders } from '../src/invaders';

type Generator = (contrib: ContributionGrid, ctx: GameContext) => string;

const rotation: Record<string, Generator> = {
  invaders: generateInvaders,
  breakout: generateBreakout,
  snake: generateSnake,
  life: generateLife,
  tron: generateTron,
};

// Pong is still accessible via ?game=pong but excluded from the daily rotation
const allGames: Record<string, Generator> = {
  ...rotation,
  pong: generatePong,
};

const rotationNames = Object.keys(rotation);

const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestedUsername = queryString(req.query.username);
  const username = USERNAME_PATTERN.test(requestedUsername) ? requestedUsername : 'TickTockBent';
  const token = process.env.PAT_1 || '';

  const themeName: ThemeName = queryString(req.query.theme) === 'light' ? 'light' : 'dark';

  // Deterministic "game of the day": same seed (and thus the same game and
  // playthrough) all day, a fresh one tomorrow. ?seed= overrides for variety.
  const daySeed = new Date().toISOString().slice(0, 10);
  const seed = queryString(req.query.seed) || daySeed;

  const requestedGame = queryString(req.query.game);
  const gameName = allGames[requestedGame]
    ? requestedGame
    : rotationNames[Math.floor(createRng(`pick:${username}:${seed}`)() * rotationNames.length)];

  const contributions = await fetchContributions(username, token, createRng(`fallback:${seed}`));

  const ctx: GameContext = {
    theme: themes[themeName],
    rng: createRng(`${gameName}:${username}:${seed}`),
    username,
    totalContributions: contributions.total,
  };

  const svg = allGames[gameName](contributions, ctx);

  res.setHeader('Content-Type', 'image/svg+xml');
  // Output is deterministic within a day, so let GitHub's camo proxy cache it
  // for a while instead of hammering the GraphQL API on every profile view
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.status(200).send(svg);
}
