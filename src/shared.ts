export const WIDTH = 850;
export const HEIGHT = 195;

export const colors = {
  bg: '#1a1b27',
  fg: '#a9b1d6',
  blue: '#7aa2f7',
  cyan: '#7dcfff',
  green: '#9ece6a',
  magenta: '#bb9af7',
  red: '#f7768e',
  yellow: '#e0af68',
  orange: '#ff9e64',
  dimmed: '#565f89',
  border: '#292e42',
};

export function svgWrapper(label: string, styles: string, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="2" fill="rgba(0,0,0,0.06)"/>
  </pattern>
  <style>${styles}</style>
</defs>
<rect width="${WIDTH}" height="${HEIGHT}" rx="6" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1"/>
${content}
<rect width="${WIDTH}" height="${HEIGHT}" rx="6" fill="url(#scan)" opacity="0.3"/>
<text x="${WIDTH - 10}" y="14" fill="${colors.dimmed}" font-family="'Courier New',monospace" font-size="9" text-anchor="end" opacity="0.4">${label}</text>
</svg>`;
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
