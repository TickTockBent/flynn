export interface ContributionGrid {
  grid: number[][]; // [week][day], values 0-4
  weeks: number;
  days: number;
}

const levelMap: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export async function fetchContributions(username: string, token: string): Promise<ContributionGrid> {
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

    return { grid, weeks: grid.length, days: 7 };
  } catch {
    return generateFallback();
  }
}

function generateFallback(): ContributionGrid {
  const grid: number[][] = [];
  for (let w = 0; w < 52; w++) {
    grid[w] = [];
    for (let d = 0; d < 7; d++) {
      grid[w][d] = Math.random() < 0.45 ? Math.floor(Math.random() * 4) + 1 : 0;
    }
  }
  return { grid, weeks: 52, days: 7 };
}
