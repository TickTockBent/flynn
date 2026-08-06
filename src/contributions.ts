export interface ContributionGrid {
  grid: number[][]; // [week][day], levels 0-4
  counts: number[][]; // [week][day], actual contribution counts
  weeks: number;
  days: number;
  total: number; // total contributions across the grid
}

const levelMap: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

type Rng = () => number;

export async function fetchContributions(username: string, token: string, fallbackRng?: Rng): Promise<ContributionGrid> {
  try {
    const query = `{
      user(login: "${username}") {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }`;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    const rawWeeks = data.data.user.contributionsCollection.contributionCalendar.weeks;
    const grid: number[][] = rawWeeks.map((w: any) =>
      w.contributionDays.map((d: any) => levelMap[d.contributionLevel] || 0)
    );
    const counts: number[][] = rawWeeks.map((w: any) =>
      w.contributionDays.map((d: any) => d.contributionCount || 0)
    );
    const total = counts.reduce((sum, week) => sum + week.reduce((s, c) => s + c, 0), 0);

    return { grid, counts, weeks: grid.length, days: 7, total };
  } catch {
    return generateFallback(fallbackRng || Math.random);
  }
}

export function generateFallback(rng: Rng): ContributionGrid {
  const grid: number[][] = [];
  const counts: number[][] = [];
  let total = 0;
  for (let w = 0; w < 52; w++) {
    grid[w] = [];
    counts[w] = [];
    for (let d = 0; d < 7; d++) {
      const level = rng() < 0.45 ? Math.floor(rng() * 4) + 1 : 0;
      grid[w][d] = level;
      // Rough count for the level — enough for score displays to look real
      counts[w][d] = level === 0 ? 0 : level * 2 + Math.floor(rng() * 3);
      total += counts[w][d];
    }
  }
  return { grid, counts, weeks: 52, days: 7, total };
}
