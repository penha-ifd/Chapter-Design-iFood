import type { RGB, LAB, ColorToken } from '../shared/types';

function linearize(c: number): number {
  return c > 0.04045
    ? Math.pow((c + 0.055) / 1.055, 2.4)
    : c / 12.92;
}

function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta * delta * delta
    ? Math.cbrt(t)
    : t / (3 * delta * delta) + 4 / 29;
}

export function rgbToLab(r: number, g: number, b: number): LAB {
  const rl = linearize(r);
  const gl = linearize(g);
  const bl = linearize(b);

  const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / 0.95047;
  const y = (0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl) / 1.00000;
  const z = (0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) / 1.08883;

  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function deltaE(lab1: LAB, lab2: LAB): number {
  const dl = lab1.l - lab2.l;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

export function findNearestColor(
  color: RGB,
  palette: ColorToken[]
): { token: ColorToken; distance: number } | null {
  if (palette.length === 0) return null;

  const inputLab = rgbToLab(color.r, color.g, color.b);
  let nearest: ColorToken = palette[0];
  let minDist = Infinity;

  for (const token of palette) {
    const tokenLab = rgbToLab(token.r, token.g, token.b);
    const dist = deltaE(inputLab, tokenLab);
    if (dist < minDist) {
      minDist = dist;
      nearest = token;
    }
  }

  return { token: nearest, distance: minDist };
}

export function colorsAreEqual(a: RGB, b: RGB, tolerance = 0.004): boolean {
  return (
    Math.abs(a.r - b.r) < tolerance &&
    Math.abs(a.g - b.g) < tolerance &&
    Math.abs(a.b - b.b) < tolerance
  );
}

// ─── WCAG 2.1 Contrast Utilities ───────────────────────────────

/**
 * Calculates relative luminance per WCAG 2.1 definition.
 * Uses the same linearize() already defined above for sRGB gamma correction.
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const rl = linearize(r);
  const gl = linearize(g);
  const bl = linearize(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/**
 * Calculates contrast ratio between two colors per WCAG 2.1.
 * Returns a value between 1 (identical) and 21 (black on white).
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function calculateContrastRatio(fg: RGB, bg: RGB): number {
  const l1 = getRelativeLuminance(fg.r, fg.g, fg.b);
  const l2 = getRelativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Walks up the node tree to find the nearest solid background color.
 * Returns white (#FFFFFF) as fallback if no solid fill found.
 */
export function getBackgroundColor(node: SceneNode): RGB {
  let current: BaseNode | null = node.parent;
  while (current) {
    if ('fills' in current) {
      const fills = (current as any).fills;
      if (fills && typeof fills !== 'symbol' && Array.isArray(fills)) {
        for (let i = fills.length - 1; i >= 0; i--) {
          const fill = fills[i];
          if (fill.type === 'SOLID' && fill.visible !== false) {
            return { r: fill.color.r, g: fill.color.g, b: fill.color.b };
          }
        }
      }
    }
    current = current.parent;
  }
  // Fallback: white background
  return { r: 1, g: 1, b: 1 };
}

/**
 * Checks if a component name suggests an interactive element.
 */
export function isInteractiveComponent(name: string): boolean {
  const lower = name.toLowerCase();
  const keywords = ['button', 'btn', 'link', 'checkbox', 'radio', 'switch', 'toggle', 'tab', 'icon-button', 'iconbutton', 'input', 'select', 'dropdown'];
  return keywords.some(kw => lower.includes(kw));
}

export function findNearestSpacing(value: number, scale: number[]): { nearest: number; delta: number } {
  let nearest = scale[0];
  let minDelta = Math.abs(value - scale[0]);

  for (const s of scale) {
    const d = Math.abs(value - s);
    if (d < minDelta) {
      minDelta = d;
      nearest = s;
    }
  }

  return { nearest, delta: minDelta };
}
