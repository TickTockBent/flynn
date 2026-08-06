# 🕹️ Flynn's Arcade

Self-playing arcade games rendered over your **real GitHub contribution graph**, as a single animated SVG. No JavaScript, no GIFs — the entire playthrough is simulated server-side and compiled into pure CSS keyframe animations, so it plays anywhere GitHub renders images (including your profile README).

![Flynn's Arcade — game of the day](https://flynn-livid.vercel.app/api/game)

Every day the arcade picks a new game and a new playthrough, deterministically seeded from the date. Refresh tomorrow for a different one.

## The games

| Game | `?game=` | Your contributions are... |
|------|----------|---------------------------|
| Space Invaders | `invaders` | the alien formation — a cannon picks them off while the fleet marches, and the score counts your actual contributions destroyed |
| Breakout | `breakout` | the brick wall |
| Snake | `snake` | the food — the snake hunts your busiest days first |
| Game of Life | `life` | the seed population, with gliders and an R-pentomino injected for chaos |
| Tron | `tron` | the arena floor two dueling light cycles ride over |
| Pong | `pong` | the backdrop (retired from the daily rotation, still playable by request) |

## Put it on your profile

Add this to your profile README — it works for **any** GitHub user, no setup required:

```markdown
[![Flynn's Arcade](https://flynn-livid.vercel.app/api/game?username=YOUR_USERNAME)](https://github.com/TickTockBent/flynn)
```

### URL parameters

| Parameter | Values | Default | What it does |
|-----------|--------|---------|--------------|
| `username` | any GitHub username | `TickTockBent` | whose contribution graph to play on |
| `game` | see table above | game of the day | force a specific game |
| `theme` | `dark`, `light` | `dark` | Tokyo Night dark or GitHub light |
| `seed` | any string | today's date | override the daily seed for a different playthrough |

Example — Space Invaders, light theme:

```
https://flynn-livid.vercel.app/api/game?username=YOUR_USERNAME&game=invaders&theme=light
```

## How it works

1. A Vercel serverless function fetches your contribution calendar (levels *and* counts) from the GitHub GraphQL API.
2. A game simulation runs to completion server-side — snake AI with flood-fill trap avoidance, invader targeting that leads the marching fleet, imperfect pong paddles with locked-in predictions.
3. Every moving part of the recorded playthrough is compiled into CSS `@keyframes` on SVG elements. The result is a static image file that happens to contain an entire game.

All randomness flows through a seeded PRNG (`username` + date), so the same URL renders the same playthrough all day and the response is cacheable.

## Deploy your own

1. Fork this repo and import it into [Vercel](https://vercel.com).
2. Create a GitHub personal access token (classic, `read:user` scope is enough) and add it as the `PAT_1` environment variable — without it, the arcade falls back to synthetic contribution data.
3. Point your profile README at `https://your-deployment.vercel.app/api/game?username=YOUR_USERNAME`.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run preview     # renders every game × theme to preview/*.svg using offline fallback data
npm run dev         # vercel dev
```

`npm run preview` needs no token or network — open the SVGs in a browser to watch them play.

## License

[MIT](LICENSE)
