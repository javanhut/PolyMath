// Seeded randomness and number formatting for problem generators, so a
// problem can be regenerated from its seed and tests are reproducible.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number;
  /** Integer in [lo, hi], never 0. */
  nonzero(lo: number, hi: number): number;
  /** Integer in [lo, hi] other than 0, 1 and -1: a coefficient worth writing. */
  coef(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  sign(): 1 | -1;
}

export function rng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const self: Rng = {
    next,
    int,
    nonzero(lo, hi) {
      for (;;) {
        const n = int(lo, hi);
        if (n !== 0) return n;
      }
    },
    coef(lo, hi) {
      for (;;) {
        const n = int(lo, hi);
        if (Math.abs(n) > 1) return n;
      }
    },
    pick: (items) => items[Math.floor(next() * items.length)]!,
    sign: () => (next() < 0.5 ? 1 : -1),
  };
  return self;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** A reduced fraction n/d as answer text ("3/4", "-2", "5"). */
export function frac(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}

/** A reduced fraction n/d as LaTeX. */
export function fracTex(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  if (d === 1) return String(n);
  return n < 0 ? `-\\frac{${-n}}{${d}}` : `\\frac{${n}}{${d}}`;
}

/**
 * Write a sum of terms the way a person would: coefficients of 1 hidden,
 * zero terms dropped, "+ -3" turned into "- 3". Works for both LaTeX and
 * answer text since it only emits digits, letters, "+" and "-".
 *
 *   poly([[3, "x"], [-1, "y"], [5, ""]]) === "3x - y + 5"
 */
export function poly(terms: [number, string][]): string {
  let out = "";
  for (const [c, v] of terms) {
    if (c === 0) continue;
    const mag = Math.abs(c) === 1 && v ? v : `${Math.abs(c)}${v}`;
    if (!out) out = c < 0 ? `-${mag}` : mag;
    else out += c < 0 ? ` - ${mag}` : ` + ${mag}`;
  }
  return out || "0";
}

/** A signed number for the middle of an expression: "+ 3" or "- 3". */
export function signed(n: number): string {
  return n < 0 ? `- ${-n}` : `+ ${n}`;
}

/** A number in parentheses when negative, for substitutions like 3(-2). */
export function paren(n: number): string {
  return n < 0 ? `(${n})` : String(n);
}
