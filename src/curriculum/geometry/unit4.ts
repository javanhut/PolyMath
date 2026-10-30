import { frac, fracTex, gcd, poly, type Rng } from "../../math/random";
import { md, type DiagramSpec, type Figure, type Generator, type Problem, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A reduced ratio p:q with p != q. */
function ratio(r: Rng, maxP: number, maxQ: number): [number, number] {
  for (;;) {
    const p = r.int(1, maxP);
    const q = r.int(2, maxQ);
    if (p !== q && gcd(p, q) === 1) return [p, q];
  }
}

/** n = k^2 m with m square-free. */
function surd(n: number): [number, number] {
  let k = 1;
  for (let f = 2; f * f <= n; f++) {
    while (n % (f * f) === 0) {
      n /= f * f;
      k *= f;
    }
  }
  return [k, n];
}

/** "x + 3", "x - 2" or "x". */
const plus = (s: number, c = 1) => poly([[c, "x"], [s, ""]]);

/** n times (cx + s): "3(x + 2)", or "3 \cdot 2x" when there is no constant, or just "x + 2" when n is 1. */
const times = (n: number, s: number, c = 1) => (n === 1 ? plus(s, c) : s === 0 ? md`${n} \cdot ${poly([[c, "x"]])}` : md`${n}(${plus(s, c)})`);

/** n times a named length: "3 \cdot EC", or just "EC" when n is 1. */
const timesLen = (n: number, v: string) => (n === 1 ? v : md`${n} \cdot ${v}`);

/**
 * The collected line of a linear equation, coef x = k. The x-terms go on the side
 * where their coefficient is larger, so the coefficient stays positive.
 */
function collect(coef: number, k: number, leftNote: string, rightNote = "Collect the x-terms on the right, where the coefficient is larger, and the constants on the left."): Step {
  return coef > 0 ? { math: md`${poly([[coef, "x"]])} = ${k}`, note: leftNote } : { math: md`${-k} = ${poly([[-coef, "x"]])}`, note: rightNote };
}

/** p shares of size k: "k", "3k". */
const shares = (p: number) => poly([[p, "k"]]);
const sharesWord = (p: number) => `${p} share${p === 1 ? "" : "s"}`;

/** Side lengths of triangles with whole-number sides (each satisfies the triangle inequality). */
const BASES: [number, number, number][] = [
  [4, 5, 6],
  [3, 4, 5],
  [5, 6, 7],
  [2, 3, 4],
  [3, 5, 7],
  [4, 6, 7],
  [5, 7, 8],
  [3, 4, 6],
  [4, 7, 9],
];

/** Pairs of triangle names; vertex i of one is matched with vertex i of the other. */
const NAMES: [string[], string[]][] = [
  [["A", "B", "C"], ["D", "E", "F"]],
  [["P", "Q", "R"], ["X", "Y", "Z"]],
  [["J", "K", "L"], ["R", "S", "T"]],
  [["A", "B", "C"], ["P", "Q", "R"]],
];

/** Side i of a triangle runs from vertex i to vertex i + 1. */
const sideName = (t: string[], i: number) => t[i]! + t[(i + 1) % 3]!;
/** The same side with its letters in alphabetical order, which hides the correspondence. */
const sortedName = (t: string[], i: number) => sideName(t, i).split("").sort().join("");

// ── Figures ─────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };
type DiagramFigure = Extract<Figure, { kind: "diagram" }>;
type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (d: number) => md`${d}^\circ`;

/** The compass direction from one point to another, for putting a label on the outside of a figure. */
function compass(from: Pt, to: Pt): Dir {
  const a = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return (["e", "ne", "n", "nw", "w", "sw", "s", "se"] as const)[(((Math.round(a / 45) % 8) + 8) % 8)]!;
}

const centroid = (pts: Pt[]): Pt => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

/** A view window around the points, with room for labels. */
function viewOf(pts: Pt[], pad = 0.16): [number, number, number, number] {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const m = pad * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return [r3(Math.min(...xs) - m), r3(Math.max(...xs) + m), r3(Math.min(...ys) - m), r3(Math.max(...ys) + m)];
}

type View = [number, number, number, number];

/** Screen pixels per unit for this view: the renderer's scale (Diagram.tsx, 560 x 600 with 22 px margins). */
function pxPerUnit(view: View): number {
  const [x0, x1, y0, y1] = view;
  return Math.min((560 - 44) / (x1 - x0), (600 - 44) / (y1 - y0));
}

/** Rough width in pixels of a short LaTeX label at the diagram's 14 px size. */
function texWidth(tex: string): number {
  const s = tex.replace(/\^\\circ/g, "o").replace(/\\[a-zA-Z]+/g, "").replace(/[{}^ ]/g, "");
  let w = 0;
  for (const ch of s) w += /[+\-=]/.test(ch) ? 14 : 8.5;
  return w;
}

/** How far a label's box reaches toward a line with unit normal n, in pixels. */
const reach = (n: Pt, text: string) => (Math.abs(n.x) * texWidth(text)) / 2 + Math.abs(n.y) * 9;

/**
 * Where to put label `text` for side PQ: off its midpoint, on the side away from `inside`. The gap is
 * in screen pixels, using the renderer's scale for this view, and allows for the label's width beside
 * steep sides, where the width faces the line.
 */
function outside(P: Pt, Q: Pt, inside: Pt, view: View, text = "00"): Pt {
  const unit = pxPerUnit(view);
  const len = Math.hypot(Q.x - P.x, Q.y - P.y);
  let n = { x: -(Q.y - P.y) / len, y: (Q.x - P.x) / len };
  const mid = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  if ((inside.x - mid.x) * n.x + (inside.y - mid.y) * n.y > 0) n = { x: -n.x, y: -n.y };
  const gap = (6 + reach(n, text)) / unit;
  return { x: r3(mid.x + n.x * gap), y: r3(mid.y + n.y * gap) };
}

/**
 * Where to put the label of the angle at V between rays to F and T: on the bisector, just past the arcs,
 * or further out when the angle is too narrow for the label to fit between its sides.
 */
function inAngle(V: Pt, F: Pt, T: Pt, text: string, view: View, arcs = 1): Pt {
  const unit = pxPerUnit(view);
  const dir = (P: Pt) => {
    const l = Math.hypot(P.x - V.x, P.y - V.y);
    return { x: (P.x - V.x) / l, y: (P.y - V.y) / l };
  };
  const [u, v] = [dir(F), dir(T)];
  const half = Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) / 2;
  const b = dir({ x: V.x + u.x + v.x, y: V.y + u.y + v.y });
  let r = 20 + (arcs - 1) * 4 + 16;
  for (const w of [u, v]) r = Math.max(r, (reach({ x: -w.y, y: w.x }, text) + 3) / Math.sin(half));
  return { x: r3(V.x + (b.x * r) / unit), y: r3(V.y + (b.y * r) / unit) };
}

/** The third vertex of a triangle on the base (0, 0) to (base, 0), at distance l0 from (0, 0) and l1 from (base, 0), above the base. */
function apex(base: number, l0: number, l1: number): Pt {
  const x = (base * base + l0 * l0 - l1 * l1) / (2 * base);
  return { x, y: Math.sqrt(Math.max(l0 * l0 - x * x, 0)) };
}

/** Law of cosines: the side opposite an angle of `ang` degrees between sides u and v. */
const opposite = (u: number, v: number, ang: number) => Math.sqrt(u * u + v * v - 2 * u * v * Math.cos(rad(ang)));

/** Vertices of a triangle with sides [v0v1, v1v2, v2v0]: the longest side along the x-axis, the third vertex above it. */
function placeTriangle(sides: readonly number[]): Pt[] {
  const j = sides.indexOf(Math.max(...sides));
  const out: Pt[] = [];
  out[j] = { x: 0, y: 0 };
  out[(j + 1) % 3] = { x: sides[j]!, y: 0 };
  out[(j + 2) % 3] = apex(sides[j]!, sides[(j + 2) % 3]!, sides[(j + 1) % 3]!);
  return out;
}

interface Tri {
  names: string[];
  /** Side i runs from vertex i to vertex i + 1. */
  sides: readonly number[];
  /** LaTeX label for each side, or undefined for none. */
  labels?: (string | undefined)[];
  /** LaTeX label for the angle at each vertex, or undefined for no mark. */
  angles?: (string | undefined)[];
}

/**
 * Two triangles side by side. When `match` is set, the angle at vertex i of each gets i + 1 arcs,
 * showing the correspondence. The second is drawn at its true size relative to the first unless that
 * is more than twice as big or small; `toScale` says which.
 */
function trianglePair(t1: Tri, t2: Tri, match = false): { figure: DiagramFigure; toScale: boolean } {
  const ratio = Math.max(...t2.sides) / Math.max(...t1.sides);
  const shown = Math.min(2, Math.max(0.5, ratio));
  const place = (t: Tri, size: number, dx: number) => {
    const longest = Math.max(...t.sides);
    return placeTriangle(t.sides).map((p) => ({ x: (p.x * size) / longest + dx, y: (p.y * size) / longest }));
  };
  const p1 = place(t1, 6, 0);
  const raw2 = place(t2, 6 * shown, 0);
  const dx = Math.max(...p1.map((p) => p.x)) - Math.min(...raw2.map((p) => p.x)) + 2.2;
  const p2 = raw2.map((p) => ({ x: p.x + dx, y: p.y }));
  const view = viewOf([...p1, ...p2], 0.1);
  const points: NonNullable<DiagramSpec["points"]> = [];
  const labels: NonNullable<DiagramSpec["labels"]> = [];
  const angles: NonNullable<DiagramSpec["angles"]> = [];
  for (const [t, pts] of [[t1, p1], [t2, p2]] as const) {
    const c = centroid(pts);
    pts.forEach((p, i) => points.push({ name: t.names[i]!, x: r3(p.x), y: r3(p.y), dir: compass(c, p) }));
    for (let i = 0; i < 3; i++) {
      // Side labels go outside their own triangle. (Segment labels would be pushed away from the centre of both triangles.)
      const label = t.labels?.[i];
      if (label) labels.push({ ...outside(pts[i]!, pts[(i + 1) % 3]!, c, view, label), text: label });
      const [at, from, to] = [t.names[i]!, t.names[(i + 1) % 3]!, t.names[(i + 2) % 3]!];
      const angle = t.angles?.[i];
      if (match) angles.push({ at, from, to, arcs: (i + 1) as 1 | 2 | 3 });
      else if (angle) {
        // The label is placed here rather than by the renderer, so narrow angles push it out until it fits.
        angles.push({ at, from, to });
        labels.push({ ...inAngle(pts[i]!, pts[(i + 1) % 3]!, pts[(i + 2) % 3]!, angle, view), text: angle });
      }
    }
  }
  return {
    figure: {
      kind: "diagram",
      view,
      points,
      polygons: [
        { points: t1.names, fill: 1 },
        { points: t2.names, fill: 2 },
      ],
      labels,
      angles,
    },
    toScale: Math.abs(shown - ratio) < 1e-9,
  };
}

const NOT_TO_SCALE = "The figure is not drawn to scale.";

/** Triangle ABC with base BC on the x-axis, D on AB and E on AC at fractions tD and tE of the way from A. */
function splitFigure(sides: { AB: number; AC: number; BC: number }, tD: number, tE: number, lab: Partial<Record<"AD" | "DB" | "AE" | "EC" | "BC" | "DE", string>>, parallel: boolean): DiagramFigure {
  const B = { x: 0, y: 0 };
  const C = { x: sides.BC, y: 0 };
  const A = apex(sides.BC, sides.AB, sides.AC);
  const D = { x: A.x + tD * (B.x - A.x), y: A.y + tD * (B.y - A.y) };
  const E = { x: A.x + tE * (C.x - A.x), y: A.y + tE * (C.y - A.y) };
  const at = { A, B, C, D, E };
  const c = centroid([A, B, C]);
  /** Straight out from side PQ, away from the opposite vertex R: where the label of a point on PQ goes. */
  const away = (P: Pt, Q: Pt, R: Pt) => {
    const n = { x: -(Q.y - P.y), y: Q.x - P.x };
    const s = (R.x - P.x) * n.x + (R.y - P.y) * n.y > 0 ? -1 : 1;
    return compass({ x: 0, y: 0 }, { x: s * n.x, y: s * n.y });
  };
  const dirs = { A: compass(c, A), B: compass(c, B), C: compass(c, C), D: away(A, B, C), E: away(A, C, B) };
  const view = viewOf([A, B, C]);
  // Side labels go outside the triangle, clear of the line whatever their width.
  const labels: NonNullable<DiagramSpec["labels"]> = [];
  for (const name of ["AD", "DB", "AE", "EC", "BC"] as const) {
    const text = lab[name];
    if (text) labels.push({ ...outside(at[name[0] as keyof typeof at], at[name[1] as keyof typeof at], c, view, text), text });
  }
  if (lab.DE) {
    // DE is horizontal (parallel to the base BC). Its label goes on the roomier side: above it when D is
    // past the middle of AB, below it otherwise.
    const gap = 14 / pxPerUnit(view);
    labels.push({ x: r3((D.x + E.x) / 2), y: r3((D.y + E.y) / 2 + (tD > 0.5 ? gap : -gap)), text: lab.DE });
  }
  return {
    kind: "diagram",
    view,
    points: (Object.keys(at) as (keyof typeof at)[]).map((n) => ({ name: n, x: r3(at[n].x), y: r3(at[n].y), dir: dirs[n] })),
    polygons: [{ points: ["A", "B", "C"], fill: 1 }],
    segments: [
      { from: "B", to: "C", ...(parallel ? { parallel: 1 as const } : {}) },
      { from: "D", to: "E", color: 2, ...(parallel ? { parallel: 1 as const } : {}) },
    ],
    labels,
  };
}

/** Triangle ABC with base BC, and D on BC with BD = bd, joined to A. Marks AD as the bisector of angle A. */
function bisectorFigure(AB: number, AC: number, BC: number, bd: number, lab: Partial<Record<"AB" | "AC" | "BD" | "DC", string>>): DiagramFigure {
  const A = apex(BC, AB, AC);
  const segs: NonNullable<DiagramSpec["segments"]> = [];
  if (lab.AB) segs.push({ from: "B", to: "A", label: lab.AB });
  if (lab.AC) segs.push({ from: "A", to: "C", label: lab.AC });
  if (lab.BD) segs.push({ from: "B", to: "D", label: lab.BD });
  if (lab.DC) segs.push({ from: "D", to: "C", label: lab.DC });
  segs.push({ from: "A", to: "D", color: 2 });
  const c = centroid([A, { x: 0, y: 0 }, { x: BC, y: 0 }]);
  return {
    kind: "diagram",
    view: viewOf([A, { x: 0, y: 0 }, { x: BC, y: 0 }]),
    points: [
      { name: "A", x: r3(A.x), y: r3(A.y), dir: compass(c, A) },
      { name: "B", x: 0, y: 0, dir: "sw" },
      { name: "C", x: BC, y: 0, dir: "se" },
      { name: "D", x: bd, y: 0, dir: "s" },
    ],
    polygons: [{ points: ["A", "B", "C"], fill: 1 }],
    segments: segs,
    angles: [
      { at: "A", from: "B", to: "D" },
      { at: "A", from: "D", to: "C" },
    ],
  };
}

// ── Lesson 1: Ratios and proportions ────────────────────────────────────────

const CROSS_HINT = md`Use cross products: $\frac{a}{b} = \frac{c}{d}$ means $ad = bc$.`;

const solveProportion: Generator = (r) => {
  const kind = r.int(0, 3);
  const [p, q] = ratio(r, 7, 6);
  const m1 = r.int(1, 5);
  let m2 = r.int(2, 5);
  while (m2 === m1) m2 = r.int(2, 5);
  if (kind === 0) {
    const [a, x, b, c] = [q * m1, p * m1, p * m2, q * m2];
    return {
      prompt: md`Solve $\frac{x}{${a}} = \frac{${b}}{${c}}$.`,
      answer: String(x),
      hint: CROSS_HINT,
      solution: [
        { math: md`${c}x = ${a} \cdot ${b}`, note: "Cross products: the product of the extremes equals the product of the means." },
        { math: md`${c}x = ${a * b}`, note: "" },
        { math: md`x = ${x}`, note: md`Divide both sides by ${c}.` },
        { math: md`\frac{${x}}{${a}} = ${fracTex(p, q)} = \frac{${b}}{${c}} \;\checkmark`, note: "Check: both ratios reduce to the same fraction." },
      ],
    };
  }
  if (kind === 1) {
    const [a, x, b, c] = [p * m1, q * m1, p * m2, q * m2];
    return {
      prompt: md`Solve $\frac{${a}}{x} = \frac{${b}}{${c}}$.`,
      answer: String(x),
      hint: CROSS_HINT,
      solution: [
        { math: md`${a} \cdot ${c} = ${b}x`, note: md`Cross products. The extremes are ${a} and ${c}; the means are $x$ and ${b}.` },
        { math: md`${a * c} = ${b}x`, note: "" },
        { math: md`x = ${x}`, note: md`Divide both sides by ${b}.` },
        { math: md`\frac{${a}}{${x}} = ${fracTex(p, q)} = \frac{${b}}{${c}} \;\checkmark`, note: "Check." },
      ],
    };
  }
  if (kind === 2) {
    const num = p * m1;
    const a = q * m1;
    const [b, c] = [p * m2, q * m2];
    let s = r.nonzero(-6, 6);
    while (num - s < 1) s = r.nonzero(-6, 6);
    const x = num - s;
    return {
      prompt: md`Solve $\frac{${plus(s)}}{${a}} = \frac{${b}}{${c}}$.`,
      answer: String(x),
      hint: md`Cross products first. The fraction bar groups $${plus(s)}$, so keep it in parentheses.`,
      solution: [
        { math: md`${c}(${plus(s)}) = ${a} \cdot ${b}`, note: "Cross products, keeping the numerator together." },
        { math: md`${poly([[c, "x"], [c * s, ""]])} = ${a * b}`, note: "Distribute." },
        { math: md`${c}x = ${a * b - c * s}`, note: md`${s > 0 ? "Subtract" : "Add"} ${Math.abs(c * s)} on both sides.` },
        { math: md`x = ${x}`, note: md`Divide by ${c}.` },
      ],
    };
  }
  const x = r.int(1, 9);
  const m = r.int(1, 4);
  const a = r.int(2, 9);
  let b = r.int(2, 9);
  while (b === a) b = r.int(2, 9);
  const s = a * m - x;
  const t = b * m - x;
  return {
    prompt: md`Solve $\frac{${plus(s)}}{${a}} = \frac{${plus(t)}}{${b}}$.`,
    answer: String(x),
    hint: "Cross products, then it's an equation with x on both sides, like Algebra 1, Unit 2.",
    solution: [
      { math: md`${times(b, s)} = ${times(a, t)}`, note: "Cross products. Keep each numerator together." },
      { math: md`${poly([[b, "x"], [b * s, ""]])} = ${poly([[a, "x"], [a * t, ""]])}`, note: "Distribute." },
      collect(b - a, a * t - b * s, "Collect the x-terms on the left and the constants on the right."),
      ...(Math.abs(b - a) === 1 ? [] : [{ math: md`x = ${x}`, note: md`Divide by ${Math.abs(b - a)}.` }]),
    ],
  };
};

const TRUE_FORMS = [md`$\frac{a}{c} = \frac{b}{d}$`, md`$\frac{b}{a} = \frac{d}{c}$`, md`$\frac{a + b}{b} = \frac{c + d}{d}$`, md`$\frac{d}{b} = \frac{c}{a}$`];
const FALSE_FORMS = [
  md`$\frac{a}{d} = \frac{c}{b}$`,
  md`$\frac{a}{b} = \frac{d}{c}$`,
  md`$\frac{a + 1}{b} = \frac{c + 1}{d}$`,
  md`$\frac{b}{c} = \frac{a}{d}$`,
  md`$a + d = b + c$`,
  md`$\frac{a + b}{b} = \frac{c + d}{c}$`,
];
const TRUE_WHY = [
  md`Divide both sides of $ad = bc$ by $cd$: $\frac{a}{c} = \frac{b}{d}$. This is swapping the means.`,
  md`Its cross products are $bc = ad$, the same as the original's, so it is equivalent. This is flipping both ratios.`,
  md`Add 1 to both sides and write it as $\frac{b}{b}$ and $\frac{d}{d}$: $\frac{a}{b} + \frac{b}{b} = \frac{c}{d} + \frac{d}{d}$.`,
  md`Its cross products are $da = bc$, the same as the original's $ad = bc$.`,
];

const ratioProblems: Generator = (r): Problem => {
  const kind = r.int(0, 6);
  if (kind === 0 || kind === 1) {
    const total = kind === 0 ? 180 : 90;
    let p: number, q: number;
    do {
      p = r.int(1, 8);
      q = r.int(p + 1, 11);
    } while (gcd(p, q) !== 1 || total % (p + q) !== 0);
    const k = total / (p + q);
    const larger = r.next() < 0.6;
    const word = kind === 0 ? "supplementary" : "complementary";
    return {
      prompt: md`Two angles are ${word}, and their measures are in the ratio $${p}:${q}$. Find the ${larger ? "larger" : "smaller"} angle. Give the angle in degrees.`,
      answer: String((larger ? q : p) * k),
      verify: [larger ? `(${total} - x)/x = ${p}/${q}` : `x/(${total} - x) = ${p}/${q}`],
      hint: md`Call one share $k$. The angles are $${shares(p)}$ and $${shares(q)}$, and ${word} angles add to $${total}^\circ$.`,
      solution: [
        { math: md`${shares(p)} + ${shares(q)} = ${total}`, note: md`A ratio of $${p}:${q}$ means ${sharesWord(p)} and ${sharesWord(q)} of the same size $k$.` },
        { math: md`${p + q}k = ${total}, \quad k = ${k}`, note: "Combine like terms and divide." },
        { math: md`${shares(p)} = ${p * k}^\circ, \quad ${shares(q)} = ${q * k}^\circ`, note: md`The ${larger ? "larger" : "smaller"} angle is $${(larger ? q : p) * k}^\circ$. Check: they add to ${total}.` },
      ],
    };
  }
  if (kind === 2) {
    let p: number, q: number, s: number;
    do {
      [p, q, s] = [r.int(1, 7), r.int(1, 7), r.int(1, 8)];
    } while (180 % (p + q + s) !== 0 || gcd(gcd(p, q), s) !== 1 || (p === q && q === s));
    const k = 180 / (p + q + s);
    const big = Math.max(p, q, s);
    return {
      prompt: md`The angles of a triangle are in the ratio $${p}:${q}:${s}$. Find the largest angle. Give the angle in degrees.`,
      answer: String(big * k),
      verify: [`x/${big} = 180/${p + q + s}`],
      hint: md`Call one share $k$. The three angles add to $180^\circ$ (Triangle Angle Sum Theorem).`,
      solution: [
        { math: md`${shares(p)} + ${shares(q)} + ${shares(s)} = 180`, note: "Each angle is some number of shares of one size k, and the three add to 180 by the Triangle Angle Sum Theorem." },
        { math: md`${p + q + s}k = 180, \quad k = ${k}`, note: "" },
        { math: md`${shares(big)} = ${big * k}^\circ`, note: md`The largest angle has the most shares. The three angles are $${p * k}^\circ$, $${q * k}^\circ$ and $${s * k}^\circ$.` },
      ],
    };
  }
  if (kind === 3) {
    const [p, q] = ratio(r, 7, 7);
    const m = r.int(2, 6);
    const askAP = r.next() < 0.5;
    const L = (p + q) * m;
    const px = r3((10 * p) / (p + q));
    return {
      prompt: md`In the figure, $AP:PB = ${p}:${q}$ and $AB = ${L}$. Find $${askAP ? "AP" : "PB"}$.`,
      figure: {
        kind: "diagram",
        view: [-1, 11, -1.1, 1.1],
        points: [
          { name: "A", x: 0, y: 0, dir: "n" },
          { name: "P", x: px, y: 0, dir: "n" },
          { name: "B", x: 10, y: 0, dir: "n" },
        ],
        segments: [
          { from: "A", to: "P", color: 1, label: askAP ? "?" : undefined },
          { from: "P", to: "B", color: 2, label: askAP ? undefined : "?" },
        ],
      },
      answer: String((askAP ? p : q) * m),
      verify: [askAP ? `x/(${L} - x) = ${p}/${q}` : `(${L} - x)/x = ${p}/${q}`],
      hint: md`$AP = ${shares(p)}$ and $PB = ${shares(q)}$ for one share $k$. By the Segment Addition Postulate they add to $AB$.`,
      solution: [
        { math: md`${shares(p)} + ${shares(q)} = ${L}`, note: "Segment Addition Postulate: AP + PB = AB." },
        { math: md`k = ${m}`, note: md`${p + q} shares make ${L}.` },
        { math: md`${askAP ? "AP" : "PB"} = ${askAP ? p : q} \cdot ${m} = ${(askAP ? p : q) * m}`, note: "" },
      ],
    };
  }
  if (kind === 4) {
    let p: number, q: number, s: number;
    do {
      [p, q, s] = [r.int(2, 7), r.int(2, 7), r.int(2, 8)];
    } while (gcd(gcd(p, q), s) !== 1 || 2 * Math.max(p, q, s) >= p + q + s || (p === q && q === s));
    const m = r.int(2, 5);
    const big = Math.max(p, q, s);
    const P = (p + q + s) * m;
    return {
      prompt: md`The sides of a triangle are in the ratio $${p}:${q}:${s}$, and its perimeter is $${P}$. Find the length of the longest side.`,
      answer: String(big * m),
      verify: [`x/${big} = ${P}/${p + q + s}`],
      hint: md`The sides are $${p}k$, $${q}k$ and $${s}k$. The perimeter is their sum.`,
      solution: [
        { math: md`${p}k + ${q}k + ${s}k = ${P}`, note: "The perimeter is the sum of the sides." },
        { math: md`${p + q + s}k = ${P}, \quad k = ${m}`, note: "" },
        { math: md`${big}k = ${big * m}`, note: md`The sides are ${p * m}, ${q * m} and ${s * m}.` },
      ],
    };
  }
  if (kind === 5) {
    const t = r.int(0, TRUE_FORMS.length - 1);
    const wrong = shuffle(r, FALSE_FORMS).slice(0, 3);
    return {
      prompt: md`Suppose $\frac{a}{b} = \frac{c}{d}$, where none of the four numbers is 0. Which of these must also be true?`,
      choices: shuffle(r, [TRUE_FORMS[t]!, ...wrong]),
      accept: [TRUE_FORMS[t]!],
      hint: md`Cross products: $\frac{a}{b} = \frac{c}{d}$ means $ad = bc$. Test each option with real numbers, like $\frac{1}{2} = \frac{3}{6}$.`,
      solution: [
        { math: md`ad = bc`, note: "Start from the cross products of the given proportion." },
        { math: TRUE_FORMS[t]!.slice(1, -1), note: TRUE_WHY[t]! },
        { math: md`\frac{1}{2} = \frac{3}{6}`, note: "A numerical test helps rule out the others: with a = 1, b = 2, c = 3, d = 6, each wrong option comes out false." },
      ],
    };
  }
  const [p, q] = ratio(r, 7, 7);
  const ask = r.int(0, 2);
  const target = [md`\frac{a + b}{b}`, md`\frac{b}{a}`, md`\frac{a}{a + b}`][ask]!;
  const value = [[p + q, q], [q, p], [p, p + q]][ask]! as [number, number];
  const steps: Step[] =
    ask === 0
      ? [
          { math: md`\frac{a}{b} + 1 = ${fracTex(p, q)} + 1`, note: "Add 1 to both sides." },
          { math: md`\frac{a + b}{b} = ${fracTex(p + q, q)}`, note: md`Write 1 as $\frac{b}{b}$ on the left and $\frac{${q}}{${q}}$ on the right.` },
        ]
      : ask === 1
        ? [{ math: md`\frac{b}{a} = ${fracTex(q, p)}`, note: "Flip both ratios: if two numbers are equal, so are their reciprocals." }]
        : [
            { math: md`\frac{a + b}{b} = ${fracTex(p + q, q)}`, note: "Add 1 to both sides, as in the add-1 form." },
            { math: md`\frac{b}{a + b} = ${fracTex(q, p + q)}`, note: "Flip both ratios." },
            { math: md`\frac{a}{a + b} = \frac{a}{b} \cdot \frac{b}{a + b} = ${fracTex(p, q)} \cdot ${fracTex(q, p + q)} = ${fracTex(p, p + q)}`, note: "Multiply the two ratios you know." },
          ];
  return {
    prompt: md`If $\frac{a}{b} = ${fracTex(p, q)}$, what is $${target}$? Give a fraction in lowest terms or a whole number.`,
    answer: frac(value[0], value[1]),
    verify: [[`x = ${p}/${q} + 1`, `${p}/${q} * x = 1`, `1/x = 1 + ${q}/${p}`][ask]!],
    simplified: true,
    hint: ask === 1 ? "Flip both sides of the proportion." : md`Add 1 to both sides of the proportion, writing $1 = \frac{b}{b}$.`,
    solution: steps,
  };
};

const harderProportions: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let g: number, p: number, q: number;
    do {
      g = r.int(1, 3);
      p = r.int(1, 4);
      q = r.int(1, 4);
    } while (p === q || g * Math.min(p, q) ** 2 === 1);
    const [a, b, x] = [g * p * p, g * q * q, g * p * q];
    const eq = r.next() < 0.5 ? md`\frac{${a}}{x} = \frac{x}{${b}}` : md`\frac{x}{${a}} = \frac{${b}}{x}`;
    return {
      prompt: md`Solve $${eq}$. Give the positive solution.`,
      answer: String(x),
      hint: md`Cross products give $x \cdot x = ${a} \cdot ${b}$.`,
      solution: [
        { math: md`x^2 = ${a} \cdot ${b} = ${a * b}`, note: "Cross products. The unknown appears twice, so you get a square." },
        { math: md`x = \sqrt{${a * b}} = ${x}`, note: md`Both $${x}$ and $-${x}$ square to ${a * b}; the question asks for the positive one. It is the **geometric mean** of ${a} and ${b}.` },
      ],
    };
  }
  if (kind === 1) {
    let a: number, b: number;
    do {
      a = r.int(2, 12);
      b = r.int(2, 12);
    } while (a === b || Number.isInteger(Math.sqrt(a * b)));
    const [k, m] = surd(a * b);
    const text = k === 1 ? `sqrt(${m})` : `${k}sqrt(${m})`;
    const tex = k === 1 ? md`\sqrt{${m}}` : md`${k}\sqrt{${m}}`;
    return {
      prompt: md`Solve $\frac{${a}}{x} = \frac{x}{${b}}$. Give the positive solution as a simplified radical (type $\sqrt{2}$ as sqrt(2)).`,
      answer: text,
      simplified: true,
      hint: md`Cross products give $x^2 = ${a * b}$. Then simplify the square root by pulling out a perfect square factor.`,
      solution: [
        { math: md`x^2 = ${a} \cdot ${b} = ${a * b}`, note: "Cross products." },
        {
          math: k === 1 ? md`x = \sqrt{${a * b}}` : md`x = \sqrt{${a * b}} = \sqrt{${k * k}} \cdot \sqrt{${m}} = ${tex}`,
          note: k === 1 ? md`Take the positive square root. ${a * b} has no perfect square factor, so this is simplified.` : md`Take the positive square root, and split off the perfect square ${k * k}.`,
        },
      ],
    };
  }
  const x = r.int(1, 8);
  const m = r.int(1, 4);
  for (;;) {
    const [p, q] = [r.int(1, 3), r.int(1, 3)];
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    if (a === b || b * p === a * q) continue;
    const s = a * m - p * x;
    const t = b * m - q * x;
    if (s === 0 || t === 0) continue;
    const coef = b * p - a * q;
    return {
      prompt: md`Solve $\frac{${plus(s, p)}}{${a}} = \frac{${plus(t, q)}}{${b}}$.`,
      answer: String(x),
      hint: "Cross products, then distribute and collect the x-terms on one side.",
      solution: [
        { math: md`${b}(${plus(s, p)}) = ${a}(${plus(t, q)})`, note: "Cross products, keeping each numerator in parentheses." },
        { math: md`${poly([[b * p, "x"], [b * s, ""]])} = ${poly([[a * q, "x"], [a * t, ""]])}`, note: "Distribute." },
        collect(coef, a * t - b * s, md`Subtract $${a * q}x$ on both sides, and move the constant to the right.`, md`Subtract $${b * p}x$ on both sides, and move the constant to the left. The x-terms go on the right, where the coefficient is larger.`),
        ...(Math.abs(coef) === 1 ? [] : [{ math: md`x = ${x}`, note: md`Divide by ${Math.abs(coef)}.` }]),
      ],
    };
  }
};

// ── Lesson 2: Similar triangles ─────────────────────────────────────────────

const similarSides: Generator = (r) => {
  const kind = r.int(0, 3);
  const base = r.pick(BASES);
  const m1 = r.int(1, 4);
  let m2 = r.int(1, 5);
  while (m2 === m1) m2 = r.int(1, 5);
  const [T1, T2plain] = r.pick(NAMES);
  // Kind 1 scrambles the order of the second name, so the sides have to be matched by letter position.
  let T2 = T2plain;
  if (kind === 1) {
    do T2 = shuffle(r, T2plain);
    while (T2.every((v, i) => v === T2plain[i]));
  }
  const tri = md`\triangle ${T1.join("")} \sim \triangle ${T2.join("")}`;
  const len1 = (i: number) => base[i]! * m1;
  const len2 = (i: number) => base[i]! * m2;
  const n1 = (i: number) => (kind === 1 ? sortedName(T1, i) : sideName(T1, i));
  const n2 = (i: number) => (kind === 1 ? sortedName(T2, i) : sideName(T2, i));
  const i = r.int(0, 2);
  let j = r.int(0, 2);
  while (j === i) j = r.int(0, 2);
  const k = fracTex(m2, m1);
  /** Both triangles, with side i labelled in each and any extra labels. */
  const pair = (extra1: (string | undefined)[] = [], extra2: (string | undefined)[] = []) => {
    const lab = (len: (n: number) => number, extra: (string | undefined)[]) => [0, 1, 2].map((n) => extra[n] ?? (n === i ? String(len(n)) : undefined));
    return trianglePair({ names: T1, sides: base.map((b) => b * m1), labels: lab(len1, extra1) }, { names: T2, sides: base.map((b) => b * m2), labels: lab(len2, extra2) }, true);
  };
  const scaleNote = (toScale: boolean) => (toScale ? "" : ` ${NOT_TO_SCALE}`);

  if (kind === 2) {
    const { figure, toScale } = pair();
    return {
      prompt: md`In the figure, $${tri}$. What is the scale factor from $\triangle ${T1.join("")}$ to $\triangle ${T2.join("")}$? Give a fraction in lowest terms or a whole number.${scaleNote(toScale)}`,
      figure,
      answer: frac(m2, m1),
      verify: [`x = ${len2(i)}/${len1(i)}`],
      simplified: true,
      hint: md`The scale factor from the first triangle to the second is (a side of the second) divided by (the matching side of the first).`,
      solution: [
        { math: md`k = \frac{${n2(i)}}{${n1(i)}} = \frac{${len2(i)}}{${len1(i)}} = ${k}`, note: md`$\overline{${n2(i)}}$ matches $\overline{${n1(i)}}$. Divide new by old, then reduce.` },
        { math: md`${n2(i)} = ${k} \cdot ${n1(i)}`, note: md`Every side of $\triangle ${T2.join("")}$ is ${m2 > m1 ? "longer" : "shorter"} by this same factor.` },
      ],
    };
  }
  if (kind === 3) {
    const P1 = (base[0] + base[1] + base[2]) * m1;
    const { figure, toScale } = pair();
    return {
      prompt: md`In the figure, $${tri}$, and the perimeter of $\triangle ${T1.join("")}$ is ${P1}. Find the perimeter of $\triangle ${T2.join("")}$.${scaleNote(toScale)}`,
      figure,
      answer: String((base[0] + base[1] + base[2]) * m2),
      verify: [`x/${P1} = ${len2(i)}/${len1(i)}`],
      hint: "Every side is multiplied by the scale factor, so the perimeter is too.",
      solution: [
        { math: md`k = \frac{${len2(i)}}{${len1(i)}} = ${k}`, note: "Scale factor from the matching pair of sides." },
        { math: md`P = ${k} \cdot ${P1} = ${(base[0] + base[1] + base[2]) * m2}`, note: md`The perimeter is $k(a + b + c) = ka + kb + kc$: each side scales, so the sum does too.` },
      ],
    };
  }
  // Kinds 0 and 1: find a missing side, in either direction.
  const forward = r.next() < 0.6;
  const [knownName, knownLen, askName, askLen] = forward ? [n1(j), len1(j), n2(j), len2(j)] : [n2(j), len2(j), n1(j), len1(j)];
  const steps: Step[] = [];
  if (kind === 1) {
    steps.push({
      math: md`${T1.map((v, t) => md`${v} \leftrightarrow ${T2[t]}`).join(md`,\; `)}`,
      note: md`The order of the letters in $${tri}$ gives the matching. So $\overline{${n1(i)}}$ goes with $\overline{${n2(i)}}$, and $\overline{${n1(j)}}$ with $\overline{${n2(j)}}$.`,
    });
  }
  steps.push(
    { math: md`k = \frac{${n2(i)}}{${n1(i)}} = \frac{${len2(i)}}{${len1(i)}} = ${k}`, note: "The scale factor from the first triangle to the second, from the pair of sides you know." },
    forward
      ? { math: md`${askName} = ${k} \cdot ${knownName} = ${k} \cdot ${knownLen} = ${askLen}`, note: md`$\overline{${askName}}$ matches $\overline{${knownName}}$.` }
      : { math: md`${askName} = \frac{${knownName}}{k} = ${knownLen} \div ${k} = ${askLen}`, note: md`$\overline{${askName}}$ matches $\overline{${knownName}}$, and goes back from the second triangle to the first, so divide.` },
  );
  const verify = [forward ? `x/${knownLen} = ${len2(i)}/${len1(i)}` : `${knownLen}/x = ${len2(i)}/${len1(i)}`];
  if (kind === 1) {
    // The scrambled names are the point of this kind: the learner matches sides by letter position, so no picture.
    return {
      prompt: md`$${tri}$, with $${n1(i)} = ${len1(i)}$, $${n2(i)} = ${len2(i)}$ and $${knownName} = ${knownLen}$. Find $${askName}$.`,
      answer: String(askLen),
      verify,
      hint: md`Match vertices by position in $${tri}$: first with first, second with second, third with third. A side matches the side joining the matching vertices.`,
      solution: steps,
    };
  }
  const onSide = (text: string) => [0, 1, 2].map((n) => (n === j ? text : undefined));
  const { figure, toScale } = forward ? pair(onSide(String(knownLen)), onSide("?")) : pair(onSide("?"), onSide(String(knownLen)));
  return {
    prompt: md`In the figure, $${tri}$. Find $${askName}$.${scaleNote(toScale)}`,
    figure,
    answer: String(askLen),
    verify,
    hint: md`Find the scale factor from the pair of matching sides you know, then apply it.`,
    solution: steps,
  };
};

const CRITERIA = ["AA", "SSS similarity", "SAS similarity", "Not similar", "Not enough information"];

const similarityCriterion: Generator = (r): Problem => {
  const kind = r.int(0, 5);
  const ask = (toScale = true) =>
    md`Use only the measurements marked in the figure.${toScale ? "" : ` ${NOT_TO_SCALE}`} Are $\triangle ABC$ and $\triangle DEF$ similar? Pick the criterion that proves it, or **Not similar**, or **Not enough information**.`;
  const ABC = ["A", "B", "C"];
  const DEF = ["D", "E", "F"];
  const hint = md`List what you know. Two angle pairs: AA. Three side ratios: SSS. Two side ratios and the angle **between** those sides: SAS.`;
  const choices = shuffle(r, CRITERIA);
  if (kind <= 1) {
    // The two marked angles of each triangle sit at the ends of one side. That side is kept at least
    // 0.6 of the longest (Law of Sines), so the two angle labels have room and don't run into each other.
    const roomy = (u: number, v: number, w: number) => Math.sin(rad(w)) >= 0.6 * Math.max(Math.sin(rad(u)), Math.sin(rad(v)), Math.sin(rad(w)));
    let a: number, b: number, c: number, f: number;
    for (;;) {
      a = 5 * r.int(7, 15);
      b = 5 * r.int(8, 16);
      c = 180 - a - b;
      f = kind === 1 ? c + 5 * r.pick([-2, -1, 1, 2]) : c;
      if (c < 25 || a === b || b === c || a === c) continue;
      if (kind === 1 && (f === b || f < 20 || 180 - a - f < 20)) continue;
      if (roomy(a, b, c) && roomy(a, f, 180 - a - f)) break;
    }
    const e = 180 - a - f;
    // Sides in proportion to the sines of the opposite angles (Law of Sines), so the angles are drawn true.
    const sines = (u: number, v: number, w: number) => [Math.sin(rad(w)), Math.sin(rad(u)), Math.sin(rad(v))].map((x) => 6 * x);
    const { figure } = trianglePair(
      { names: ABC, sides: sines(a, b, c), angles: [deg(a), deg(b), undefined] },
      { names: DEF, sides: sines(a, e, f).map((x) => 1.4 * x), angles: [deg(a), undefined, deg(f)] },
    );
    return {
      prompt: ask(),
      figure,
      choices,
      accept: [kind === 0 ? "AA" : "Not similar"],
      hint: md`Use the Triangle Angle Sum Theorem to find the third angle of each triangle.`,
      solution: [
        { math: md`\angle C = 180^\circ - ${a}^\circ - ${b}^\circ = ${c}^\circ`, note: "Triangle Angle Sum Theorem." },
        { math: md`\angle E = 180^\circ - ${a}^\circ - ${f}^\circ = ${e}^\circ`, note: "Same theorem in the other triangle." },
        kind === 0
          ? { math: md`\angle A = \angle D, \quad \angle B = \angle E`, note: "Two pairs of congruent angles, so the triangles are similar by **AA**." }
          : { math: md`\{${a}, ${b}, ${c}\} \ne \{${a}, ${e}, ${f}\}`, note: "Similar triangles have the same three angles. These don't, so the triangles are **not similar**." },
      ],
    };
  }
  const base = r.pick(BASES);
  const m1 = r.int(1, 3);
  let m2 = r.int(2, 4);
  while (m2 === m1) m2 = r.int(2, 4);
  const k = fracTex(m2, m1);
  if (kind <= 3) {
    const big = base.map((s) => s * m2);
    if (kind === 3) {
      for (;;) {
        const t = big.map((s) => s);
        const idx = r.int(0, 2);
        t[idx] = t[idx]! + r.pick([-1, 1]);
        const sorted = [...t].sort((x, y) => x - y);
        if (sorted[2]! >= sorted[0]! + sorted[1]!) continue;
        if (sorted.every((s, n) => s * m1 === base[n]! * m2)) continue;
        big.splice(0, 3, ...t);
        break;
      }
    }
    const order = shuffle(r, [0, 1, 2]);
    const def = order.map((o) => big[o]!);
    const small = base.map((s) => s * m1);
    const sortedSmall = [...small].sort((x, y) => x - y);
    const sortedBig = [...def].sort((x, y) => x - y);
    const { figure, toScale } = trianglePair({ names: ABC, sides: small, labels: small.map(String) }, { names: DEF, sides: def, labels: def.map(String) });
    return {
      prompt: ask(toScale),
      figure,
      choices,
      accept: [kind === 2 ? "SSS similarity" : "Not similar"],
      hint: md`Pair the shortest sides, the middle sides and the longest sides, and compare the three ratios.`,
      solution: [
        { math: md`${sortedSmall.join(", ")} \quad\text{and}\quad ${sortedBig.join(", ")}`, note: "Sort each triangle's sides. In similar triangles the shortest matches the shortest, and so on." },
        { math: sortedSmall.map((s, n) => md`\frac{${sortedBig[n]}}{${s}}`).join(", \\quad "), note: "The three ratios." },
        kind === 2
          ? { math: md`\text{all equal } ${k}`, note: "All three ratios are equal, so the triangles are similar by **SSS similarity**." }
          : { math: md`\text{not all equal}`, note: "The ratios differ, so the sides are not proportional under any matching. The triangles are **not similar**." },
      ],
    };
  }
  if (kind === 4) {
    // Up to 100 degrees: wider angles make a flat triangle with no room for the label.
    const ang = 5 * r.int(6, 20);
    const [u, v] = shuffle(r, base).slice(0, 2) as [number, number];
    const tri = (names: string[], m: number): Tri => ({
      names,
      sides: [u * m, opposite(u * m, v * m, ang), v * m],
      labels: [String(u * m), undefined, String(v * m)],
      angles: [deg(ang), undefined, undefined],
    });
    const { figure, toScale } = trianglePair(tri(ABC, m1), tri(DEF, m2));
    return {
      prompt: ask(toScale),
      figure,
      choices,
      accept: ["SAS similarity"],
      hint,
      solution: [
        { math: md`\frac{DE}{AB} = \frac{${u * m2}}{${u * m1}} = ${k}, \quad \frac{DF}{AC} = \frac{${v * m2}}{${v * m1}} = ${k}`, note: "Two pairs of sides in the same ratio." },
        { math: md`\angle A = \angle D = ${ang}^\circ`, note: md`$\angle A$ lies between $\overline{AB}$ and $\overline{AC}$, and $\angle D$ between $\overline{DE}$ and $\overline{DF}$. Included angles: **SAS similarity**.` },
      ],
    };
  }
  // SSA in the ambiguous case: the side opposite the angle is shorter than the side next to it.
  let ang: number, c: number, a: number;
  do {
    ang = r.pick([30, 35, 40, 45, 50]);
    c = r.int(5, 9);
    a = r.int(3, c - 1);
  } while (a <= c * Math.sin((ang * Math.PI) / 180) + 0.3);
  const s = r.int(2, 3);
  // One of the two triangles that fit side-side-angle. The other is just as possible, so the picture can't settle it.
  const ac = c * Math.cos(rad(ang)) + Math.sqrt(a * a - (c * Math.sin(rad(ang))) ** 2);
  const tri = (names: string[], m: number): Tri => ({ names, sides: [c * m, a * m, ac * m], labels: [String(c * m), String(a * m), undefined], angles: [deg(ang), undefined, undefined] });
  const { figure } = trianglePair(tri(ABC, 1), tri(DEF, s));
  return {
    prompt: ask(false),
    figure,
    choices,
    accept: ["Not enough information"],
    hint,
    solution: [
      { math: md`\frac{DE}{AB} = \frac{EF}{BC} = ${s}`, note: "The two pairs of sides are proportional." },
      { math: md`\angle A \text{ is not between } \overline{AB} \text{ and } \overline{BC}`, note: md`$\angle A$ is between $\overline{AB}$ and $\overline{AC}$. This is side-side-angle, which is not a criterion.` },
      { math: md`\text{SSA}`, note: md`With $BC = ${a}$ shorter than $AB = ${c}$, two different triangles fit these measurements (Unit 3), so these triangles may or may not be similar. **Not enough information.**` },
    ],
  };
};

const SHADOWS: [number, number][] = [
  [6, 4],
  [6, 8],
  [5, 2],
  [5, 4],
  [6, 9],
  [5, 3],
  [6, 5],
];

const similarApplications: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [h1, s1] = r.pick(SHADOWS);
    const g = gcd(h1, s1);
    const [p, q] = [h1 / g, s1 / g];
    let b = r.int(2, 12);
    // At least twice the person's height, which also rules out b = g (the person again).
    while (p * b < 2 * h1) b = r.int(2, 12);
    const [h2, s2] = [p * b, q * b];
    const thing = r.pick(["tree", "flagpole", "lamppost", "building"]);
    const askHeight = r.next() < 0.65;
    // Drawn to scale unless the object is more than 3 times the person's height.
    const big = Math.min(b / g, 3);
    const gap = Math.max(s1, h1 / 2);
    const Qx = s1 + gap;
    const view = viewOf([{ x: 0, y: 0 }, { x: Qx + s1 * big, y: h1 * big }], 0.1);
    const [P, H, S] = [{ x: 0, y: 0 }, { x: 0, y: h1 }, { x: s1, y: 0 }];
    const [Q, T, U] = [{ x: Qx, y: 0 }, { x: Qx, y: h1 * big }, { x: Qx + s1 * big, y: 0 }];
    // Each length goes outside its own triangle: heights to the left, shadows below.
    const side = (A: Pt, B: Pt, tri: Pt[], text: string) => ({ ...outside(A, B, centroid(tri), view, text), text });
    const shadowFigure: DiagramFigure = {
      kind: "diagram",
      view,
      points: [
        { name: "P", x: 0, y: 0, label: "" },
        { name: "H", x: 0, y: h1, label: "" },
        { name: "S", x: s1, y: 0, label: "" },
        { name: "Q", x: r3(Qx), y: 0, label: "" },
        { name: "T", x: r3(Qx), y: r3(h1 * big), label: "" },
        { name: "U", x: r3(Qx + s1 * big), y: 0, label: "" },
      ],
      segments: [
        { from: "P", to: "H" },
        { from: "P", to: "S" },
        { from: "H", to: "S", dashed: true, color: 2 },
        { from: "Q", to: "T" },
        { from: "Q", to: "U" },
        { from: "T", to: "U", dashed: true, color: 2 },
      ],
      labels: [
        side(P, H, [P, H, S], String(h1)),
        side(P, S, [P, H, S], String(s1)),
        side(Q, T, [Q, T, U], askHeight ? "?" : String(h2)),
        side(Q, U, [Q, T, U], askHeight ? String(s2) : "?"),
      ],
      angles: [
        { at: "P", from: "S", to: "H", right: true },
        { at: "Q", from: "U", to: "T", right: true },
        { at: "S", from: "P", to: "H", color: 2 },
        { at: "U", from: "Q", to: "T", color: 2 },
      ],
      caption: md`The person on the left, the ${thing} on the right, and the sun's rays (dashed). Lengths in feet.`,
    };
    const note = big < b / g ? ` ${NOT_TO_SCALE}` : "";
    return {
      prompt: askHeight
        ? md`A person ${h1} ft tall casts a shadow ${s1} ft long. At the same moment, a ${thing} casts a shadow ${s2} ft long. How tall is the ${thing}? Give the height in feet, as a number without units.${note}`
        : md`A person ${h1} ft tall casts a shadow ${s1} ft long. At the same moment, a ${thing} ${h2} ft tall stands nearby. How long is its shadow? Give the length in feet, as a number without units.${note}`,
      figure: shadowFigure,
      answer: String(askHeight ? h2 : s2),
      verify: [askHeight ? `x/${s2} = ${h1}/${s1}` : `${h2}/x = ${h1}/${s1}`],
      hint: "The two right triangles (object, shadow, sun ray) are similar by AA. Match height with height and shadow with shadow.",
      solution: [
        { math: md`\frac{\text{height}}{\text{shadow}}: \quad \frac{${h1}}{${s1}} = ${askHeight ? md`\frac{h}{${s2}}` : md`\frac{${h2}}{s}`}`, note: "Both stand vertically, and the sun's parallel rays meet the ground at the same angle, so the triangles are similar by AA." },
        askHeight
          ? { math: md`${s1}h = ${h1 * s2}, \quad h = ${h2}`, note: "Cross products, then divide." }
          : { math: md`${h1}s = ${s1 * h2}, \quad s = ${s2}`, note: "Cross products, then divide." },
      ],
    };
  }
  const m1 = r.int(1, 4);
  let m2 = r.int(1, 5);
  while (m2 === m1) m2 = r.int(1, 5);
  if (kind === 1) {
    const base = r.pick(BASES);
    const [AB, BC, DE, EF] = [base[0] * m1, base[1] * m1, base[0] * m2, base[1] * m2];
    let s = r.nonzero(-4, 6);
    while (AB - s < 1) s = r.nonzero(-4, 6);
    const x = AB - s;
    const { figure, toScale } = trianglePair(
      { names: ["A", "B", "C"], sides: base.map((b) => b * m1), labels: [plus(s), String(BC), undefined] },
      { names: ["D", "E", "F"], sides: base.map((b) => b * m2), labels: [String(DE), String(EF), undefined] },
      true,
    );
    return {
      prompt: md`In the figure, $\triangle ABC \sim \triangle DEF$. Find $x$.${toScale ? "" : ` ${NOT_TO_SCALE}`}`,
      figure,
      answer: String(x),
      verify: [`(${plus(s)})/${DE} = ${BC}/${EF}`],
      hint: md`$\overline{AB}$ matches $\overline{DE}$ and $\overline{BC}$ matches $\overline{EF}$. Set the two ratios equal.`,
      solution: [
        { math: md`\frac{AB}{DE} = \frac{BC}{EF}: \quad \frac{${plus(s)}}{${DE}} = \frac{${BC}}{${EF}}`, note: "Corresponding sides of similar triangles are proportional." },
        { math: md`${EF}(${plus(s)}) = ${DE * BC}`, note: "Cross products." },
        { math: md`${plus(s)} = ${AB}`, note: md`Divide both sides by ${EF}.` },
        { math: md`x = ${x}`, note: md`${s > 0 ? "Subtract" : "Add"} ${Math.abs(s)}.` },
      ],
    };
  }
  const g = r.int(2, 4);
  const h = r.int(1, 3);
  let x: number, s: number, t: number;
  do {
    x = r.int(1, 9);
    s = m1 * g - x;
    t = m2 * g - x;
  } while (s === 0 && t === 0);
  const [BC, EF] = [m1 * h * 2, m2 * h * 2];
  const coef = EF - BC;
  // The third sides aren't given; an angle of 70 degrees at B and E fixes a shape.
  const shape = (m: number) => [m * g, 2 * m * h, opposite(m * g, 2 * m * h, 70)];
  const { figure, toScale } = trianglePair(
    { names: ["A", "B", "C"], sides: shape(m1), labels: [plus(s), String(BC), undefined] },
    { names: ["D", "E", "F"], sides: shape(m2), labels: [plus(t), String(EF), undefined] },
    true,
  );
  return {
    prompt: md`In the figure, $\triangle ABC \sim \triangle DEF$. Find $x$.${toScale ? "" : ` ${NOT_TO_SCALE}`}`,
    figure,
    answer: String(x),
    verify: [`(${plus(s)})/(${plus(t)}) = ${BC}/${EF}`],
    hint: "Set AB/DE equal to BC/EF, cross multiply, and solve the linear equation.",
    solution: [
      { math: md`\frac{${plus(s)}}{${plus(t)}} = \frac{${BC}}{${EF}}`, note: "Corresponding sides are proportional: AB with DE, BC with EF." },
      { math: md`${times(EF, s)} = ${times(BC, t)}`, note: "Cross products." },
      { math: md`${poly([[EF, "x"], [EF * s, ""]])} = ${poly([[BC, "x"], [BC * t, ""]])}`, note: "Distribute." },
      collect(coef, BC * t - EF * s, "Collect the x-terms on the left and the constants on the right."),
      { math: md`x = ${x}`, note: md`${Math.abs(coef) === 1 ? "" : `Divide by ${Math.abs(coef)}. `}Check: $AB = ${m1 * g}$ and $DE = ${m2 * g}$, in the ratio $${fracTex(m1, m2)}$, the same as $\frac{${BC}}{${EF}}$.` },
    ],
  };
};

// ── Lesson 3: Proportions in triangles ──────────────────────────────────────

/** "In the figure, DE ∥ BC", plus an extra given, as a sentence. */
const SPLIT = (extra = "") => md`In the figure, $\overline{DE} \parallel \overline{BC}$${extra ? ` and $${extra}$` : ""}.`;

/** The split triangle for AB = ab and AC = ac, with D and E at the given distances from A. Angle A is 60 degrees. */
const split = (ab: number, ac: number, ad: number, ae: number, lab: Parameters<typeof splitFigure>[3], parallel = true) =>
  splitFigure({ AB: ab, AC: ac, BC: opposite(ab, ac, 60) }, ad / ab, ae / ac, lab, parallel);

/** Close enough in size to draw side by side: neither more than `k` times the other. */
const near = (a: number, b: number, k: number) => Math.max(a, b) <= k * Math.min(a, b);

/**
 * Numbers for a split triangle: AD:DB = AE:EC = p:q, AB = (p + q)m, AC = (p + q)n. The limits keep
 * every piece long enough on screen to carry its label: D and E at least a quarter of the way along,
 * and AB and AC within a factor of 2 of each other.
 */
function splitNumbers(r: Rng): { p: number; q: number; m: number; n: number } {
  for (;;) {
    const [p, q, m, n] = [r.int(1, 5), r.int(1, 6), r.int(1, 4), r.int(1, 4)];
    if (p !== q && m !== n && near(p, q, 3) && near(m, n, 2)) return { p, q, m, n };
  }
}

const sideSplitter: Generator = (r) => {
  const kind = r.int(0, 3);
  const { p, q, m, n } = splitNumbers(r);
  const [AD, DB, AE, EC] = [p * m, q * m, p * n, q * n];
  if (kind === 0 || kind === 1) {
    const findEC = kind === 0;
    return {
      prompt: md`${SPLIT()} Find $${findEC ? "EC" : "AE"}$.`,
      figure: split(AD + DB, AE + EC, AD, AE, { AD: String(AD), DB: String(DB), AE: findEC ? String(AE) : "?", EC: findEC ? "?" : String(EC) }),
      answer: String(findEC ? EC : AE),
      verify: [findEC ? `${AD}/${DB} = ${AE}/x` : `${AD}/${DB} = x/${EC}`],
      hint: md`Triangle Proportionality Theorem: $\frac{AD}{DB} = \frac{AE}{EC}$.`,
      solution: findEC
        ? [
            { math: md`\frac{${AD}}{${DB}} = \frac{${AE}}{EC}`, note: "Side-splitter: the parallel divides the two sides proportionally." },
            { math: md`${timesLen(AD, "EC")} = ${DB * AE}`, note: "Cross products." },
            ...(AD === 1 ? [] : [{ math: md`EC = ${EC}`, note: md`Divide by ${AD}.` }]),
          ]
        : [
            { math: md`\frac{${AD}}{${DB}} = \frac{AE}{${EC}}`, note: "Side-splitter: the parallel divides the two sides proportionally." },
            { math: md`${timesLen(DB, "AE")} = ${AD * EC}`, note: "Cross products." },
            ...(DB === 1 ? [] : [{ math: md`AE = ${AE}`, note: md`Divide by ${DB}.` }]),
          ],
    };
  }
  if (kind === 2) {
    const AB = AD + DB;
    return {
      prompt: md`${SPLIT(`AB = ${AB}`)} Find $AC$.`,
      figure: split(AB, AE + EC, AD, AE, { AD: String(AD), AE: String(AE) }),
      answer: String(AE + EC),
      verify: [`${AD}/${AB} = ${AE}/x`],
      hint: md`$\triangle ADE \sim \triangle ABC$ by AA, so $\frac{AD}{AB} = \frac{AE}{AC}$.`,
      solution: [
        { math: md`\triangle ADE \sim \triangle ABC`, note: "AA: corresponding angles at D and B, and the shared angle A." },
        { math: md`\frac{${AD}}{${AB}} = \frac{${AE}}{AC}`, note: "Compare each part from A with the whole side." },
        AD === 1
          ? { math: md`AC = ${AB * AE}`, note: "Cross products." }
          : { math: md`${AD} \cdot AC = ${AB * AE}, \quad AC = ${AE + EC}`, note: "Cross products, then divide." },
      ],
    };
  }
  let hh = r.int(1, 4);
  while (!near(hh, m, 2)) hh = r.int(1, 4);
  const BC = (p + q) * hh;
  // AC isn't given here; an angle of 60 degrees at B fixes a shape.
  const AB = AD + DB;
  return {
    prompt: md`${SPLIT()} Find $DE$.`,
    figure: splitFigure({ AB, AC: opposite(AB, BC, 60), BC }, p / (p + q), p / (p + q), { AD: String(AD), DB: String(DB), BC: String(BC), DE: "?" }, true),
    answer: String(p * hh),
    verify: [`x/${BC} = ${AD}/${AD + DB}`],
    hint: md`$\overline{DE}$ is a side of $\triangle ADE$, which is similar to the whole $\triangle ABC$. Compare $AD$ with all of $AB$, not with $DB$.`,
    solution: [
      { math: md`AB = ${AD} + ${DB} = ${AD + DB}`, note: "Segment Addition Postulate." },
      { math: md`\frac{DE}{BC} = \frac{AD}{AB}: \quad \frac{DE}{${BC}} = \frac{${AD}}{${AD + DB}}`, note: md`$\triangle ADE \sim \triangle ABC$ by AA, and $\overline{DE}$ matches $\overline{BC}$.` },
      { math: md`DE = ${BC} \cdot ${fracTex(AD, AD + DB)} = ${p * hh}`, note: md`Multiply both sides by ${BC}.` },
    ],
  };
};

const BISECT = (extra = "") => md`In the figure, $\overline{AD}$ bisects $\angle BAC$${extra ? ` and $${extra}$` : ""}.`;

const angleBisector: Generator = (r) => {
  const kind = r.int(0, 2);
  let p: number, q: number, m: number, n: number;
  do {
    p = r.int(2, 7);
    q = r.int(2, 7);
    m = r.int(2, 5);
    n = r.int(1, m - 1);
  } while (p === q || gcd(p, q) !== 1 || (p + q) * n <= Math.abs(p - q) * m || p * m > 30 || q * m > 30);
  const [AB, AC, BD, DC] = [p * m, q * m, p * n, q * n];
  const fig = (lab: Parameters<typeof bisectorFigure>[4]) => bisectorFigure(AB, AC, BD + DC, BD, lab);
  if (kind === 0) {
    return {
      prompt: md`${BISECT()} Find $DC$.`,
      figure: fig({ AB: String(AB), AC: String(AC), BD: String(BD), DC: "?" }),
      answer: String(DC),
      verify: [`${BD}/x = ${AB}/${AC}`],
      hint: md`Triangle Angle Bisector Theorem: $\frac{BD}{DC} = \frac{AB}{AC}$. Each piece goes with the side it touches.`,
      solution: [
        { math: md`\frac{${BD}}{DC} = \frac{${AB}}{${AC}}`, note: "Angle Bisector Theorem: BD touches AB, and DC touches AC." },
        { math: md`${AB} \cdot DC = ${BD * AC}`, note: "Cross products." },
        { math: md`DC = ${DC}`, note: md`Divide by ${AB}.` },
      ],
    };
  }
  if (kind === 1) {
    const BC = BD + DC;
    const askBD = r.next() < 0.5;
    return {
      prompt: md`${BISECT(`BC = ${BC}`)} Find $${askBD ? "BD" : "DC"}$.`,
      figure: fig({ AB: String(AB), AC: String(AC), [askBD ? "BD" : "DC"]: "?" }),
      answer: String(askBD ? BD : DC),
      verify: [askBD ? `x/(${BC} - x) = ${AB}/${AC}` : `(${BC} - x)/x = ${AB}/${AC}`],
      hint: md`$BD:DC = AB:AC = ${p}:${q}$. Split $BC$ into ${p + q} equal shares.`,
      solution: [
        { math: md`\frac{BD}{DC} = \frac{${AB}}{${AC}} = ${fracTex(p, q)}`, note: "Angle Bisector Theorem." },
        { math: md`BD = ${p}k, \quad DC = ${q}k`, note: "One share is k." },
        { math: md`${p}k + ${q}k = ${BC}, \quad k = ${n}`, note: "Segment Addition Postulate: BD + DC = BC." },
        { math: md`${askBD ? "BD" : "DC"} = ${askBD ? p : q} \cdot ${n} = ${askBD ? BD : DC}`, note: "" },
      ],
    };
  }
  return {
    prompt: md`${BISECT()} Find $AC$.`,
    figure: fig({ AB: String(AB), AC: "?", BD: String(BD), DC: String(DC) }),
    answer: String(AC),
    verify: [`${BD}/${DC} = ${AB}/x`],
    hint: md`Triangle Angle Bisector Theorem: $\frac{BD}{DC} = \frac{AB}{AC}$.`,
    solution: [
      { math: md`\frac{${BD}}{${DC}} = \frac{${AB}}{AC}`, note: "Angle Bisector Theorem." },
      { math: md`${BD} \cdot AC = ${DC * AB}`, note: "Cross products." },
      { math: md`AC = ${AC}`, note: md`Divide by ${BD}.` },
    ],
  };
};

const parallelAndAlgebra: Generator = (r): Problem => {
  const kind = r.int(0, 2);
  const { p, q, m, n } = splitNumbers(r);
  const [AD, DB, AE] = [p * m, q * m, p * n];
  if (kind === 0 && r.next() < 0.5) {
    const EC = q * n;
    return {
      prompt: md`In the figure, what length of $\overline{EC}$ makes $\overline{DE} \parallel \overline{BC}$?`,
      figure: split(AD + DB, AE + EC, AD, AE, { AD: String(AD), DB: String(DB), AE: String(AE), EC: "?" }, false),
      answer: String(EC),
      verify: [`${AD}/${DB} = ${AE}/x`],
      hint: md`By the converse of the Triangle Proportionality Theorem, $\overline{DE} \parallel \overline{BC}$ when $\frac{AD}{DB} = \frac{AE}{EC}$.`,
      solution: [
        { math: md`\frac{${AD}}{${DB}} = \frac{${AE}}{EC}`, note: "Converse of the Triangle Proportionality Theorem: if the sides are divided proportionally, DE is parallel to BC. By the theorem itself, no other length works, since a parallel would force this proportion." },
        { math: md`${timesLen(AD, "EC")} = ${DB * AE}`, note: "Cross products." },
        ...(AD === 1 ? [] : [{ math: md`EC = ${EC}`, note: md`Divide by ${AD}.` }]),
      ],
    };
  }
  if (kind === 0) {
    const parallel = r.next() < 0.5;
    let EC = q * n;
    if (!parallel) {
      // A near miss, but not so short a piece that its label crowds point E.
      const misses = shuffle(r, [-2, -1, 1, 2])
        .map((d) => q * n + d)
        .filter((v) => AD * v !== DB * AE);
      EC = misses.find((v) => v >= 2 && near(AE, v, 3.5)) ?? misses.find((v) => v >= 1)!;
    }
    return {
      prompt: md`In the figure, is $\overline{DE}$ parallel to $\overline{BC}$?`,
      figure: split(AD + DB, AE + EC, AD, AE, { AD: String(AD), DB: String(DB), AE: String(AE), EC: String(EC) }, false),
      choices: ["Parallel", "Not parallel"],
      accept: [parallel ? "Parallel" : "Not parallel"],
      hint: md`Test whether $\frac{AD}{DB} = \frac{AE}{EC}$ using cross products.`,
      solution: [
        { math: md`${AD} \cdot ${EC} = ${AD * EC}, \qquad ${DB} \cdot ${AE} = ${DB * AE}`, note: "Cross products of the two ratios AD/DB and AE/EC." },
        parallel
          ? { math: md`\frac{${AD}}{${DB}} = \frac{${AE}}{${EC}}`, note: "Equal, so the sides are divided proportionally. By the converse of the Triangle Proportionality Theorem, DE is **parallel** to BC." }
          : { math: md`\frac{${AD}}{${DB}} \ne \frac{${AE}}{${EC}}`, note: "Not equal. If DE were parallel to BC, the side-splitter theorem would make these ratios equal, so DE is **not parallel** to BC." },
      ],
    };
  }
  const EC = q * n;
  if (kind === 1) {
    const s = (q - p) * m;
    const x = p * m;
    return {
      prompt: md`${SPLIT()} Find $x$.`,
      figure: split(AD + DB, AE + EC, AD, AE, { AD: "x", DB: plus(s), AE: String(AE), EC: String(EC) }),
      answer: String(x),
      verify: [`x/(${plus(s)}) = ${AE}/${EC}`],
      hint: md`Side-splitter: $\frac{AD}{DB} = \frac{AE}{EC}$. Cross multiply and solve.`,
      solution: [
        { math: md`\frac{x}{${plus(s)}} = \frac{${AE}}{${EC}}`, note: "Triangle Proportionality Theorem." },
        { math: md`${poly([[EC, "x"]])} = ${times(AE, s)}`, note: "Cross products." },
        ...(AE === 1 ? [] : [{ math: md`${poly([[EC, "x"]])} = ${poly([[AE, "x"], [AE * s, ""]])}`, note: "Distribute." }]),
        collect(EC - AE, AE * s, md`Subtract $${poly([[AE, "x"]])}$ from both sides.`, md`Subtract $${poly([[EC, "x"]])}$ from both sides, and move the constant to the left. The x-terms go on the right, where the coefficient is larger.`),
        { math: md`x = ${x}`, note: md`${Math.abs(EC - AE) === 1 ? "" : `Divide by ${Math.abs(EC - AE)}. `}Check: $AD = ${x}$ and $DB = ${x + s}$, in the ratio $${fracTex(p, q)}$, the same as $\frac{${AE}}{${EC}}$.` },
      ],
    };
  }
  let c: number, x: number;
  do {
    c = r.pick([2, 3]);
    x = r.int(1, 8);
  } while (q === c * p);
  const s = p * m - x;
  const t = q * m - c * x;
  const coef = EC - c * AE;
  return {
    prompt: md`${SPLIT()} Find $x$.`,
    figure: split(AD + DB, AE + EC, AD, AE, { AD: plus(s), DB: plus(t, c), AE: String(AE), EC: String(EC) }),
    answer: String(x),
    verify: [`(${plus(s)})/(${plus(t, c)}) = ${AE}/${EC}`],
    hint: md`Side-splitter: $\frac{AD}{DB} = \frac{AE}{EC}$. Cross multiply, keeping the binomials in parentheses.`,
    solution: [
      { math: md`\frac{${plus(s)}}{${plus(t, c)}} = \frac{${AE}}{${EC}}`, note: "Triangle Proportionality Theorem." },
      { math: md`${times(EC, s)} = ${times(AE, t, c)}`, note: "Cross products." },
      { math: md`${poly([[EC, "x"], [EC * s, ""]])} = ${poly([[c * AE, "x"], [AE * t, ""]])}`, note: "Distribute." },
      collect(coef, AE * t - EC * s, "Collect the x-terms on the left and the constants on the right."),
      { math: md`x = ${x}`, note: md`${Math.abs(coef) === 1 ? "" : `Divide by ${Math.abs(coef)}. `}Check: $AD = ${x + s}$ and $DB = ${c * x + t}$, in the ratio $${fracTex(p, q)}$, the same as $\frac{${AE}}{${EC}}$.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit4: Unit = {
  title: "Similarity",
  lessons: [
    {
      id: "ratios-and-proportions",
      title: "Ratios and proportions",
      summary: "Comparing lengths by division, and the cross products property that solves every proportion.",
      blocks: [
        {
          kind: "text",
          body: md`A photo and its enlargement have the **same shape**. So do a map and the land it shows. To say exactly what "same shape" means, we need a way to compare lengths by how many times bigger one is than another. That comparison is a ratio.

A **ratio** compares two quantities by division. The ratio of $a$ to $b$ is written $a:b$ or $\frac{a}{b}$, with $b \ne 0$. The ratio $6:4$ is the same as $3:2$, because $\frac{6}{4} = \frac{3 \cdot 2}{2 \cdot 2} = \frac{3}{2}$. Multiplying both terms by the same nonzero number doesn't change a ratio. When a ratio compares lengths, measure both in the same unit.`,
        },
        {
          kind: "diagram",
          view: [-1.2, 18, -1.2, 5],
          points: [
            { name: "A1", x: 0, y: 0, label: "", hidden: true },
            { name: "B1", x: 3, y: 0, label: "", hidden: true },
            { name: "C1", x: 3, y: 2, label: "", hidden: true },
            { name: "D1", x: 0, y: 2, label: "", hidden: true },
            { name: "A2", x: 4.5, y: 0, label: "", hidden: true },
            { name: "B2", x: 10.5, y: 0, label: "", hidden: true },
            { name: "C2", x: 10.5, y: 4, label: "", hidden: true },
            { name: "D2", x: 4.5, y: 4, label: "", hidden: true },
            { name: "A3", x: 12, y: 0, label: "", hidden: true },
            { name: "B3", x: 17, y: 0, label: "", hidden: true },
            { name: "C3", x: 17, y: 2, label: "", hidden: true },
            { name: "D3", x: 12, y: 2, label: "", hidden: true },
          ],
          polygons: [
            { points: ["A1", "B1", "C1", "D1"], fill: 1 },
            { points: ["A2", "B2", "C2", "D2"], fill: 1 },
            { points: ["A3", "B3", "C3", "D3"], fill: 2 },
          ],
          segments: [
            { from: "A1", to: "B1", label: "3" },
            { from: "A1", to: "D1", label: "2" },
            { from: "A2", to: "B2", label: "6" },
            { from: "A2", to: "D2", label: "4" },
            { from: "A3", to: "B3", label: "5" },
            { from: "C3", to: "B3", label: "2" },
          ],
          caption: md`Width to height: $3:2$, $6:4$ and $5:2$. The first two are the same ratio, and they look like one shape at two sizes. The third ratio is different, and it looks stretched.`,
        },
        {
          kind: "key",
          title: "Proportion",
          body: md`A **proportion** is an equation saying two ratios are equal:

$$\frac{a}{b} = \frac{c}{d} \qquad (b \ne 0,\ d \ne 0).$$

Read it "$a$ is to $b$ as $c$ is to $d$". The outer terms $a$ and $d$ are the **extremes**; the inner terms $b$ and $c$ are the **means**.`,
        },
        {
          kind: "key",
          title: "Cross Products Property",
          body: md`For $b \ne 0$ and $d \ne 0$:

$$\frac{a}{b} = \frac{c}{d} \quad\text{if and only if}\quad ad = bc.$$

In a proportion, the product of the extremes equals the product of the means.`,
        },
        {
          kind: "proof",
          title: "Cross Products Property",
          given: md`$\frac{a}{b} = \frac{c}{d}$, with $b \ne 0$ and $d \ne 0$`,
          prove: md`$ad = bc$`,
          steps: [
            { statement: md`$\frac{a}{b} = \frac{c}{d}$`, reason: "Given" },
            { statement: md`$bd \cdot \frac{a}{b} = bd \cdot \frac{c}{d}$`, reason: md`Multiplication Property of Equality (multiply both sides by $bd$)` },
            { statement: md`$da \cdot \frac{b}{b} = bc \cdot \frac{d}{d}$`, reason: "Commutative and associative properties: rearrange the factors" },
            { statement: md`$da = bc$`, reason: md`$\frac{b}{b} = 1$ and $\frac{d}{d} = 1$, and multiplying by 1 changes nothing` },
            { statement: md`$ad = bc$`, reason: "Commutative property of multiplication" },
          ],
        },
        {
          kind: "why",
          title: "Why it works in both directions",
          body: md`The proof multiplied both sides by $bd$. To go back, divide both sides of $ad = bc$ by $bd$, which is allowed because $bd \ne 0$:

$$\frac{ad}{bd} = \frac{bc}{bd} \quad\Rightarrow\quad \frac{a}{b} = \frac{c}{d}.$$

So cross products are also a **test** for equal ratios. Is $\frac{6}{8} = \frac{9}{12}$? $6 \cdot 12 = 72$ and $8 \cdot 9 = 72$, so yes. Is $\frac{5}{7} = \frac{7}{10}$? $50 \ne 49$, so no, even though the two are close.

"Cross multiplying" is not a new rule. It's the multiplication property of equality, done in one step.`,
        },
        {
          kind: "example",
          title: "Solving a proportion",
          problem: md`Solve $\frac{x}{6} = \frac{10}{15}$.`,
          steps: [
            { math: md`15x = 6 \cdot 10`, note: md`Cross products. The extremes are $x$ and 15; the means are 6 and 10.` },
            { math: md`15x = 60`, note: "" },
            { math: md`x = 4`, note: "Divide both sides by 15." },
            { math: md`\frac{4}{6} = \frac{2}{3} = \frac{10}{15} \;\checkmark`, note: md`Check: both ratios reduce to $\frac{2}{3}$.` },
          ],
        },
        {
          kind: "example",
          title: "When a numerator is a sum",
          problem: md`Solve $\frac{x + 2}{3} = \frac{x - 1}{2}$.`,
          steps: [
            { math: md`2(x + 2) = 3(x - 1)`, note: "Cross products. The fraction bar groups each numerator, so keep the parentheses." },
            { math: md`2x + 4 = 3x - 3`, note: "Distribute." },
            { math: md`7 = x`, note: md`Subtract $2x$ from both sides, then add 3.` },
            { math: md`\frac{9}{3} = 3 = \frac{6}{2} \;\checkmark`, note: "Check in the original." },
          ],
        },
        {
          kind: "key",
          title: "Equivalent forms of a proportion",
          body: md`If $\frac{a}{b} = \frac{c}{d}$, with all four numbers nonzero, then each of these is true too:

- $\frac{b}{a} = \frac{d}{c}$ (flip both ratios)
- $\frac{a}{c} = \frac{b}{d}$ (swap the means)
- $\frac{a + b}{b} = \frac{c + d}{d}$ (add 1 to both sides)`,
        },
        {
          kind: "why",
          title: "Why these follow",
          body: md`Each one is a property of equality in disguise.

- **Flip:** $\frac{b}{a} = \frac{d}{c}$ has cross products $bc = ad$, the same equation as before. By the Cross Products Property (both directions), the two proportions stand or fall together.
- **Swap the means:** divide both sides of $ad = bc$ by $cd$. You get $\frac{ad}{cd} = \frac{bc}{cd}$, which is $\frac{a}{c} = \frac{b}{d}$.
- **Add 1:** add 1 to both sides, $\frac{a}{b} + 1 = \frac{c}{d} + 1$. Write 1 as $\frac{b}{b}$ on the left and $\frac{d}{d}$ on the right, then add: $\frac{a + b}{b} = \frac{c + d}{d}$.

The add-1 form looks like a curiosity. It's the key step in the main theorem of this unit's last lesson.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 10.8, -1, 1],
          points: [
            { name: "A", x: 0, y: 0, dir: "n" },
            { name: "B", x: 10, y: 0, dir: "n" },
            { name: "P", x: "p", y: 0, dir: "n" },
          ],
          segments: [
            { from: "A", to: "P", color: 1, label: "{p}" },
            { from: "P", to: "B", color: 2, label: "{=10 - p}" },
          ],
          params: [{ name: "p", tex: "AP", min: 1, max: 9, step: 0.5, value: 4 }],
          readouts: [
            { label: md`\frac{AP}{PB}`, value: "p/(10 - p)" },
            { label: md`\frac{AP}{AB}`, value: "p/10" },
          ],
          caption: md`A segment of length 10. At $AP = 4$, $AP:PB = 4:6 = 2:3$: the segment is 5 equal shares, 2 on one side of $P$ and 3 on the other. So $AP:AB = 2:5$. Parts compared with parts give one ratio; a part compared with the whole gives another.`,
        },
        {
          kind: "example",
          title: "Splitting a total in a ratio",
          problem: md`Two angles form a linear pair, and their measures are in the ratio $2:7$. Find both angles.`,
          steps: [
            { math: md`2k \text{ and } 7k`, note: md`A ratio of $2:7$ means 2 shares and 7 shares of the same size. Call one share $k$.` },
            { math: md`2k + 7k = 180`, note: md`A linear pair adds to $180^\circ$ (Linear Pair Postulate).` },
            { math: md`9k = 180, \quad k = 20`, note: "" },
            { math: md`40^\circ \text{ and } 140^\circ`, note: md`Check: $40 + 140 = 180$, and $\frac{40}{140} = \frac{2}{7}$.` },
          ],
        },
        {
          kind: "example",
          title: "The unknown twice",
          problem: md`Solve $\frac{4}{x} = \frac{x}{9}$, where $x$ is a length.`,
          steps: [
            { math: md`x \cdot x = 4 \cdot 9`, note: "Cross products." },
            { math: md`x^2 = 36`, note: "" },
            { math: md`x = 6`, note: md`Both $6$ and $-6$ square to 36, but a length is positive. When the two means are equal like this, $x$ is called the **geometric mean** of 4 and 9: $x = \sqrt{4 \cdot 9}$. It comes back in right triangles (Unit 5).` },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $\frac{x}{4} = \frac{9}{6}$.`,
          answer: "6",
          explain: md`Cross products: $6x = 36$, so $x = 6$. Check: $\frac{6}{4} = \frac{3}{2} = \frac{9}{6}$.`,
        },
        {
          kind: "check",
          prompt: md`Point $P$ is on $\overline{AB}$ with $AP:PB = 3:5$ and $AB = 24$. Find $AP$.`,
          answer: "9",
          explain: md`Call one share $k$. By the Segment Addition Postulate, $3k + 5k = 24$, so $k = 3$ and $AP = 3 \cdot 3 = 9$.`,
        },
      ],
      practice: [solveProportion, ratioProblems, harderProportions],
    },
    {
      id: "similar-triangles",
      title: "Similar triangles",
      summary: "Same shape at any size: the definition of similarity, the AA Similarity Postulate, and the SSS and SAS Similarity Theorems proved from it.",
      blocks: [
        {
          kind: "text",
          body: md`A photocopier set to 150% makes every length 1.5 times as long and leaves every angle alone. The copy has the same shape as the original. That's the idea of similarity: **every length scaled by the same factor, every angle unchanged**.

The figure scales a triangle from a point $O$. Each vertex moves along its ray from $O$ until it is $k$ times as far from $O$ as before. (Unit 9 studies this move, a **dilation**, in detail.) Drag $k$ and watch the side ratios.`,
        },
        {
          kind: "diagram",
          view: [-1, 10.8, -1, 8.2],
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 1, y: 1, dir: "nw" },
            { name: "B", x: 4, y: 1, dir: "se" },
            { name: "C", x: 2, y: 3, dir: "n" },
            { name: "A2", x: "k", y: "k", label: "A'", dir: "se" },
            { name: "B2", x: "4k", y: "k", label: "B'", dir: "se" },
            { name: "C2", x: "2k", y: "3k", label: "C'", dir: "n" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["A2", "B2", "C2"], fill: 2 },
          ],
          segments: [
            { from: "O", to: "A", kind: "ray", dashed: true, color: 3 },
            { from: "O", to: "B", kind: "ray", dashed: true, color: 3 },
            { from: "O", to: "C", kind: "ray", dashed: true, color: 3 },
          ],
          angles: [
            { at: "A", from: "B", to: "C" },
            { at: "A2", from: "B2", to: "C2" },
            { at: "B", from: "C", to: "A", arcs: 2 },
            { at: "B2", from: "C2", to: "A2", arcs: 2 },
          ],
          params: [{ name: "k", tex: "k", min: 0.5, max: 2.5, step: 0.25, value: 2 }],
          readouts: [
            { label: md`\frac{A'B'}{AB}`, value: "sqrt((4k - k)^2 + (k - k)^2)/sqrt((4 - 1)^2 + (1 - 1)^2)" },
            { label: md`\frac{B'C'}{BC}`, value: "sqrt((2k - 4k)^2 + (3k - k)^2)/sqrt((2 - 4)^2 + (3 - 1)^2)" },
            { label: md`\frac{A'C'}{AC}`, value: "sqrt((2k - k)^2 + (3k - k)^2)/sqrt((2 - 1)^2 + (3 - 1)^2)" },
          ],
          caption: md`The readouts measure each side from its coordinates. All three ratios always equal $k$, and the marked angles never change. For $k < 1$ the copy shrinks; at $k = 1$ it lands on the original.`,
        },
        {
          kind: "key",
          title: "Similar polygons",
          body: md`Two polygons are **similar** when their vertices can be matched so that

- corresponding angles are congruent, and
- corresponding sides are proportional: every ratio of matching lengths is the same number $k$, the **scale factor**.

$\triangle ABC \sim \triangle DEF$ says the match is $A \leftrightarrow D$, $B \leftrightarrow E$, $C \leftrightarrow F$, in that order. It means

$$\angle A = \angle D,\quad \angle B = \angle E,\quad \angle C = \angle F, \qquad \frac{DE}{AB} = \frac{EF}{BC} = \frac{FD}{CA} = k.$$

This $k$ is the scale factor from $\triangle ABC$ to $\triangle DEF$. Congruent figures are the special case $k = 1$.`,
        },
        {
          kind: "why",
          title: "Why the definition needs both conditions",
          body: md`Either condition alone can fail to give the same shape.

- A $1 \times 1$ square and a $1 \times 3$ rectangle have all their angles equal, $90^\circ$ each, but their sides are not in one ratio. The rectangle is stretched.
- A square with side 1 and a squashed square, with all four sides 1 but angles of $60^\circ$ and $120^\circ$, have all sides in the ratio $1:1$, but different shapes. (Unit 6 calls the squashed one a **rhombus**.)

For polygons in general you need both. Triangles turn out to be special: they need much less.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 17.8, -1, 5.8],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 6, y: 0, dir: "se" },
            { name: "C", x: 3.75, y: "sqrt(10.9375)", dir: "n" },
            { name: "D", x: 8, y: 0, dir: "sw" },
            { name: "E", x: 17, y: 0, dir: "se" },
            { name: "F", x: 13.625, y: "1.5sqrt(10.9375)", dir: "n" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["D", "E", "F"], fill: 2 },
          ],
          segments: [
            { from: "A", to: "B", label: "6" },
            { from: "C", to: "A", label: "5" },
            { from: "D", to: "E", label: "9" },
            { from: "E", to: "F", label: "x" },
          ],
          // The facing sides are labelled outside their own triangle. (Segment labels would land inside.)
          labels: [
            { ...outside({ x: 6, y: 0 }, { x: 3.75, y: Math.sqrt(10.9375) }, { x: 3.25, y: Math.sqrt(10.9375) / 3 }, [-0.8, 17.8, -1, 5.8], "4"), text: "4" },
            { ...outside({ x: 13.625, y: 1.5 * Math.sqrt(10.9375) }, { x: 8, y: 0 }, { x: 12.875, y: Math.sqrt(10.9375) / 2 }, [-0.8, 17.8, -1, 5.8], "7.5"), text: "7.5" },
          ],
          angles: [
            { at: "A", from: "B", to: "C" },
            { at: "D", from: "E", to: "F" },
            { at: "B", from: "C", to: "A", arcs: 2 },
            { at: "E", from: "F", to: "D", arcs: 2 },
            { at: "C", from: "A", to: "B", arcs: 3 },
            { at: "F", from: "D", to: "E", arcs: 3 },
          ],
          caption: md`$\triangle ABC \sim \triangle DEF$. Matching angles carry matching marks. The order of the letters says which sides go together: $\overline{AB}$ with $\overline{DE}$, $\overline{BC}$ with $\overline{EF}$, $\overline{CA}$ with $\overline{FD}$.`,
        },
        {
          kind: "example",
          title: "Using the scale factor",
          problem: md`In the figure, $\triangle ABC \sim \triangle DEF$. Find $x = EF$.`,
          steps: [
            { math: md`k = \frac{DE}{AB} = \frac{9}{6} = \frac{3}{2}`, note: md`$\overline{DE}$ matches $\overline{AB}$: first and second letters of each name. Both lengths are known, so they give the scale factor.` },
            { math: md`\frac{FD}{CA} = \frac{7.5}{5} = \frac{3}{2} \;\checkmark`, note: "Another known pair agrees, as it must." },
            { math: md`EF = \frac{3}{2} \cdot BC = \frac{3}{2} \cdot 4 = 6`, note: md`$\overline{EF}$ matches $\overline{BC}$.` },
          ],
        },
        {
          kind: "why",
          title: "Why perimeters scale by k too",
          body: md`If every side of $\triangle DEF$ is $k$ times its partner, then by the Distributive Property

$$DE + EF + FD = k \cdot AB + k \cdot BC + k \cdot CA = k(AB + BC + CA).$$

So the perimeter of $\triangle DEF$ is $k$ times the perimeter of $\triangle ABC$. In the figure: $9 + 6 + 7.5 = 22.5$, and $\frac{3}{2} \cdot 15 = 22.5$.`,
        },
        {
          kind: "key",
          title: "AA Similarity Postulate",
          body: md`If two angles of one triangle are congruent to two angles of another triangle, then the triangles are similar:

$$\angle A = \angle D \text{ and } \angle B = \angle E \quad\Longrightarrow\quad \triangle ABC \sim \triangle DEF.$$`,
        },
        {
          kind: "why",
          title: "Why two angles are enough",
          body: md`Two angles fix the third. By the Triangle Angle Sum Theorem, $\angle C = 180^\circ - \angle A - \angle B$ and $\angle F = 180^\circ - \angle D - \angle E$, so AA really gives all three pairs of angles.

Why should equal angles force proportional sides? Picture $\triangle ABC$ and slide side $\overline{BC}$ parallel to itself, toward $A$ or away from it. By the Corresponding Angles Postulate the angles stay the same the whole time; only the size changes. The angles pin down the shape, and size is the one thing left free.

That picture is convincing, but it isn't a proof. A complete proof needs dilations (Unit 9) or extra machinery about lengths. So, just as SAS was taken as a postulate for congruence, we take AA as a **postulate** for similarity and prove everything else from it.`,
        },
        {
          kind: "diagram",
          view: [-1, 18, -1, 10],
          points: [
            { name: "P", x: 0, y: 0, dir: "sw" },
            { name: "H", x: 0, y: 1.5, dir: "nw" },
            { name: "S", x: 2, y: 0, dir: "se" },
            { name: "Q", x: 5, y: 0, dir: "sw" },
            { name: "T", x: 5, y: 9, dir: "nw" },
            { name: "U", x: 17, y: 0, dir: "se" },
          ],
          segments: [
            { from: "P", to: "H", label: "1.5" },
            { from: "P", to: "S", label: "2" },
            { from: "H", to: "S", dashed: true, color: 2 },
            { from: "Q", to: "T" },
            { from: "Q", to: "U", label: "12" },
            { from: "T", to: "U", dashed: true, color: 2 },
          ],
          // Left of the flagpole, outside its triangle. (A segment label would land inside.)
          labels: [{ ...outside({ x: 5, y: 0 }, { x: 5, y: 9 }, { x: 9, y: 3 }, [-1, 18, -1, 10], "h"), text: "h" }],
          angles: [
            { at: "P", from: "S", to: "H", right: true },
            { at: "Q", from: "U", to: "T", right: true },
            { at: "S", from: "P", to: "H", color: 2 },
            { at: "U", from: "Q", to: "T", color: 2 },
          ],
          caption: md`A person and a flagpole in the sun. Both stand vertically, and the sun's rays (dashed) are parallel, so they meet the ground at the same angle. Two pairs of congruent angles: $\triangle PHS \sim \triangle QTU$ by AA.`,
        },
        {
          kind: "example",
          title: "Measuring a flagpole with a shadow",
          problem: md`A person 1.5 m tall casts a shadow 2 m long. At the same moment, a flagpole casts a shadow 12 m long. How tall is the flagpole?`,
          steps: [
            { math: md`\triangle PHS \sim \triangle QTU`, note: "AA: a right angle at each foot, and congruent angles where the parallel rays meet the ground (Corresponding Angles Postulate)." },
            { math: md`\frac{QT}{PH} = \frac{QU}{PS}`, note: "Corresponding sides are proportional: height with height, shadow with shadow." },
            { math: md`\frac{h}{1.5} = \frac{12}{2} = 6`, note: "" },
            { math: md`h = 9`, note: "Multiply both sides by 1.5. The flagpole is 9 m tall, and nobody had to climb it." },
          ],
        },
        {
          kind: "key",
          title: "SSS and SAS Similarity Theorems",
          body: md`- **SSS Similarity:** if all three pairs of corresponding sides are proportional, $\frac{DE}{AB} = \frac{EF}{BC} = \frac{FD}{CA}$, the triangles are similar.
- **SAS Similarity:** if two pairs of sides are proportional, $\frac{DE}{AB} = \frac{DF}{AC}$, and the angles **between** them are congruent, $\angle A = \angle D$, the triangles are similar.

These are theorems. We prove them from AA and the congruence postulates of Unit 3. In both proofs, suppose $DE < AB$. (If $DE > AB$, swap the names of the triangles. If $DE = AB$, the ratio is 1 and the triangles are congruent by SSS or SAS.)`,
        },
        {
          kind: "diagram",
          view: [-0.8, 18.8, -1, 5.8],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 9, y: 0, dir: "se" },
            { name: "C", x: 5.625, y: "1.5sqrt(10.9375)", dir: "n" },
            { name: "P", x: 6, y: 0, dir: "s" },
            { name: "Q", x: 3.75, y: "sqrt(10.9375)", dir: "nw" },
            { name: "D", x: 12, y: 0, dir: "sw" },
            { name: "E", x: 18, y: 0, dir: "se" },
            { name: "F", x: 15.75, y: "sqrt(10.9375)", dir: "n" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["D", "E", "F"], fill: 2 },
          ],
          segments: [
            { from: "A", to: "P", ticks: 1, color: 2 },
            { from: "D", to: "E", ticks: 1 },
            { from: "A", to: "Q", ticks: 2, color: 2 },
            { from: "D", to: "F", ticks: 2 },
            { from: "P", to: "Q", dashed: true, color: 2, parallel: 1 },
            { from: "B", to: "C", parallel: 1 },
          ],
          angles: [
            { at: "A", from: "B", to: "C" },
            { at: "D", from: "E", to: "F" },
          ],
          caption: md`The plan for both proofs: build a copy of $\triangle DEF$ inside $\triangle ABC$. Mark $P$ on $\overline{AB}$ with $AP = DE$, and draw the line through $P$ parallel to $\overline{BC}$. It meets $\overline{AC}$ at $Q$. Here $AB = 9$, $AC = 7.5$, $DE = 6$, $DF = 5$.`,
        },
        {
          kind: "proof",
          title: "SAS Similarity Theorem",
          given: md`$\angle A = \angle D$ and $\frac{DE}{AB} = \frac{DF}{AC}$, with $DE < AB$`,
          prove: md`$\triangle ABC \sim \triangle DEF$`,
          steps: [
            { statement: md`Mark $P$ on $\overline{AB}$ with $AP = DE$. The line through $P$ parallel to $\overline{BC}$ meets $\overline{AC}$ at $Q$.`, reason: "Ruler Postulate; Parallel Postulate" },
            { statement: md`$\angle APQ = \angle B$`, reason: md`Corresponding Angles Postulate ($\overleftrightarrow{PQ} \parallel \overleftrightarrow{BC}$, transversal $\overleftrightarrow{AB}$)` },
            { statement: md`$\angle A = \angle A$`, reason: "Reflexive Property" },
            { statement: md`$\triangle APQ \sim \triangle ABC$`, reason: "AA Similarity Postulate" },
            { statement: md`$\frac{AQ}{AC} = \frac{AP}{AB}$`, reason: "Corresponding sides of similar triangles are proportional" },
            { statement: md`$\frac{AQ}{AC} = \frac{DE}{AB} = \frac{DF}{AC}$`, reason: md`Substitution ($AP = DE$), then the given ratio and the Transitive Property` },
            { statement: md`$AQ = DF$`, reason: md`Multiplication Property of Equality (multiply both sides by $AC$)` },
            { statement: md`$\triangle APQ \cong \triangle DEF$`, reason: md`SAS ($AP = DE$, $\angle A = \angle D$, $AQ = DF$)` },
            { statement: md`$\angle APQ = \angle E$`, reason: "CPCTC" },
            { statement: md`$\angle B = \angle E$`, reason: "Substitution (steps 2 and 9)" },
            { statement: md`$\triangle ABC \sim \triangle DEF$`, reason: md`AA Similarity Postulate ($\angle A = \angle D$, $\angle B = \angle E$)` },
          ],
        },
        {
          kind: "proof",
          title: "SSS Similarity Theorem",
          given: md`$\frac{DE}{AB} = \frac{EF}{BC} = \frac{FD}{CA}$, with $DE < AB$`,
          prove: md`$\triangle ABC \sim \triangle DEF$`,
          steps: [
            { statement: md`Mark $P$ on $\overline{AB}$ with $AP = DE$. The line through $P$ parallel to $\overline{BC}$ meets $\overline{AC}$ at $Q$.`, reason: "Ruler Postulate; Parallel Postulate" },
            { statement: md`$\angle APQ = \angle B$, so $\triangle APQ \sim \triangle ABC$`, reason: md`Corresponding Angles Postulate, then AA with the shared $\angle A$` },
            { statement: md`$\frac{AP}{AB} = \frac{PQ}{BC} = \frac{AQ}{AC}$`, reason: "Corresponding sides of similar triangles are proportional" },
            { statement: md`$\frac{DE}{AB} = \frac{PQ}{BC} = \frac{AQ}{AC}$`, reason: md`Substitution ($AP = DE$)` },
            { statement: md`$\frac{PQ}{BC} = \frac{EF}{BC}$ and $\frac{AQ}{AC} = \frac{FD}{CA}$`, reason: "Transitive Property, with the given ratios" },
            { statement: md`$PQ = EF$ and $AQ = FD$`, reason: "Multiplication Property of Equality" },
            { statement: md`$\triangle APQ \cong \triangle DEF$`, reason: md`SSS ($AP = DE$, $PQ = EF$, $AQ = DF$)` },
            { statement: md`$\angle A = \angle D$ and $\angle APQ = \angle E$`, reason: "CPCTC" },
            { statement: md`$\angle B = \angle E$`, reason: md`Substitution ($\angle APQ = \angle B$ from step 2)` },
            { statement: md`$\triangle ABC \sim \triangle DEF$`, reason: "AA Similarity Postulate" },
          ],
        },
        {
          kind: "check",
          prompt: md`In $\triangle ABC$, $AB = 4$, $AC = 6$ and $\angle A = 40^\circ$. In $\triangle DEF$, $DE = 6$, $DF = 9$ and $\angle D = 40^\circ$. Which criterion shows the triangles are similar?`,
          choices: ["AA", "SSS similarity", "SAS similarity", "Not enough information"],
          accept: ["SAS similarity"],
          explain: md`$\frac{6}{4} = \frac{9}{6} = \frac{3}{2}$, and each $40^\circ$ angle sits between the two sides given. Two proportional sides and the included angle: SAS similarity.`,
        },
        {
          kind: "check",
          prompt: md`$\triangle PQR \sim \triangle XYZ$, with $PQ = 8$, $QR = 10$ and $XY = 12$. Find $YZ$.`,
          answer: "15",
          explain: md`$\overline{XY}$ matches $\overline{PQ}$, so $k = \frac{12}{8} = \frac{3}{2}$. $\overline{YZ}$ matches $\overline{QR}$, so $YZ = \frac{3}{2} \cdot 10 = 15$.`,
        },
      ],
      practice: [similarSides, similarityCriterion, similarApplications],
    },
    {
      id: "proportions-in-triangles",
      title: "Proportions in triangles",
      summary: "A line parallel to one side splits the other two proportionally, and an angle bisector splits the opposite side in the ratio of the other two sides.",
      blocks: [
        {
          kind: "text",
          body: md`Draw a line parallel to one side of a triangle so that it crosses the other two sides. It cuts off a small triangle at the top, and that small triangle has the same angles as the big one. By AA, the two are similar.

This lesson gets two useful theorems out of that one observation: one about parallel lines, and one about angle bisectors.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 9.8, -0.8, 6.8],
          points: [
            { name: "A", x: 2, y: 6, dir: "n" },
            { name: "B", x: 0, y: 0, dir: "sw" },
            { name: "C", x: 9, y: 0, dir: "se" },
            { name: "D", x: "2 - 2t", y: "6 - 6t", dir: "w" },
            { name: "E", x: "2 + 7t", y: "6 - 6t", dir: "e" },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          segments: [
            { from: "D", to: "E", color: 2, parallel: 1 },
            { from: "B", to: "C", parallel: 1 },
          ],
          params: [{ name: "t", tex: md`\frac{AD}{AB}`, min: 0.1, max: 0.9, step: 0.05, value: 0.4 }],
          readouts: [
            { label: md`\frac{AD}{DB}`, value: "sqrt((2t)^2 + (6t)^2)/sqrt((2 - 2t)^2 + (6 - 6t)^2)" },
            { label: md`\frac{AE}{EC}`, value: "sqrt((7t)^2 + (6t)^2)/sqrt((7 - 7t)^2 + (6 - 6t)^2)" },
            { label: md`\frac{DE}{BC}`, value: "((2 + 7t) - (2 - 2t))/9" },
          ],
          caption: md`Slide $\overline{DE}$, always parallel to $\overline{BC}$. The ratio $AD:DB$ changes, but it always equals $AE:EC$. Notice that $\frac{DE}{BC}$ matches $\frac{AD}{AB}$, a part over the whole side, not $\frac{AD}{DB}$.`,
        },
        {
          kind: "key",
          title: "Triangle Proportionality Theorem",
          body: md`If a line parallel to one side of a triangle intersects the other two sides, then it divides those sides proportionally.

In $\triangle ABC$, with $D$ on $\overline{AB}$, $E$ on $\overline{AC}$ and $\overline{DE} \parallel \overline{BC}$:

$$\frac{AD}{DB} = \frac{AE}{EC}.$$

It is often called the **side-splitter theorem**.`,
        },
        {
          kind: "proof",
          title: "Triangle Proportionality Theorem",
          given: md`$D$ on $\overline{AB}$, $E$ on $\overline{AC}$, $\overline{DE} \parallel \overline{BC}$`,
          prove: md`$\frac{AD}{DB} = \frac{AE}{EC}$`,
          steps: [
            { statement: md`$\angle ADE = \angle ABC$`, reason: md`Corresponding Angles Postulate (transversal $\overleftrightarrow{AB}$)` },
            { statement: md`$\angle A = \angle A$`, reason: "Reflexive Property" },
            { statement: md`$\triangle ADE \sim \triangle ABC$`, reason: "AA Similarity Postulate" },
            { statement: md`$\frac{AB}{AD} = \frac{AC}{AE}$`, reason: "Corresponding sides of similar triangles are proportional" },
            { statement: md`$AB = AD + DB$ and $AC = AE + EC$`, reason: "Segment Addition Postulate" },
            { statement: md`$\frac{AD + DB}{AD} = \frac{AE + EC}{AE}$`, reason: "Substitution" },
            { statement: md`$1 + \frac{DB}{AD} = 1 + \frac{EC}{AE}$`, reason: md`Split each fraction, $\frac{AD + DB}{AD} = \frac{AD}{AD} + \frac{DB}{AD}$: the add-1 form of Lesson 1, read backwards` },
            { statement: md`$\frac{DB}{AD} = \frac{EC}{AE}$`, reason: "Subtraction Property of Equality" },
            { statement: md`$\frac{AD}{DB} = \frac{AE}{EC}$`, reason: "Flip both ratios (equivalent forms of a proportion)" },
          ],
        },
        {
          kind: "why",
          title: "Why DE is compared with whole sides",
          body: md`The similar triangles are $\triangle ADE$ and the **whole** $\triangle ABC$. So $\overline{DE}$ is compared with whole sides:

$$\frac{DE}{BC} = \frac{AD}{AB} = \frac{AE}{AC}.$$

The ratio $\frac{AD}{DB}$ compares two pieces of one side, and it's a different number. If $AD = 2$ and $DB = 3$, then $\frac{AD}{DB} = \frac{2}{3}$, but $\frac{DE}{BC} = \frac{2}{5}$. Pieces go with pieces. When $\overline{DE}$ or $\overline{BC}$ is involved, use whole sides.`,
        },
        {
          kind: "example",
          title: "Finding a piece",
          problem: md`In $\triangle ABC$, $\overline{DE} \parallel \overline{BC}$ with $D$ on $\overline{AB}$ and $E$ on $\overline{AC}$. $AD = 6$, $DB = 4$ and $AE = 9$. Find $EC$.`,
          steps: [
            { math: md`\frac{6}{4} = \frac{9}{EC}`, note: md`Side-splitter: $\frac{AD}{DB} = \frac{AE}{EC}$.` },
            { math: md`6 \cdot EC = 36`, note: "Cross products." },
            { math: md`EC = 6`, note: "Divide by 6." },
          ],
        },
        {
          kind: "example",
          title: "Finding the parallel segment",
          problem: md`Same setup, with $AD = 6$, $DB = 4$ and $BC = 15$. Find $DE$.`,
          steps: [
            { math: md`AB = 6 + 4 = 10`, note: "Segment Addition Postulate." },
            { math: md`\frac{DE}{BC} = \frac{AD}{AB}: \quad \frac{DE}{15} = \frac{6}{10}`, note: md`$\triangle ADE \sim \triangle ABC$, so compare $\overline{DE}$ with $\overline{BC}$ and $\overline{AD}$ with the whole $\overline{AB}$.` },
            { math: md`DE = 9`, note: md`Multiply both sides by 15. Using $\frac{6}{4}$ by mistake would give 22.5, longer than $\overline{BC}$ itself, which is impossible for a segment inside the triangle.` },
          ],
        },
        {
          kind: "key",
          title: "Converse of the Triangle Proportionality Theorem",
          body: md`If a line divides two sides of a triangle proportionally, then it is parallel to the third side:

$$\frac{AD}{DB} = \frac{AE}{EC} \quad\Longrightarrow\quad \overline{DE} \parallel \overline{BC}.$$`,
        },
        {
          kind: "proof",
          title: "Converse of the Triangle Proportionality Theorem",
          given: md`$D$ on $\overline{AB}$, $E$ on $\overline{AC}$, $\frac{AD}{DB} = \frac{AE}{EC}$`,
          prove: md`$\overline{DE} \parallel \overline{BC}$`,
          steps: [
            { statement: md`$\frac{DB}{AD} = \frac{EC}{AE}$`, reason: "Flip both ratios" },
            { statement: md`$\frac{DB}{AD} + 1 = \frac{EC}{AE} + 1$`, reason: "Addition Property of Equality" },
            { statement: md`$\frac{AD + DB}{AD} = \frac{AE + EC}{AE}$`, reason: md`The add-1 form (Lesson 1): write 1 as $\frac{AD}{AD}$ and as $\frac{AE}{AE}$, then add` },
            { statement: md`$\frac{AB}{AD} = \frac{AC}{AE}$`, reason: "Segment Addition Postulate and Substitution" },
            { statement: md`$\frac{AD}{AB} = \frac{AE}{AC}$`, reason: "Flip both ratios" },
            { statement: md`$\angle A = \angle A$`, reason: "Reflexive Property" },
            { statement: md`$\triangle ADE \sim \triangle ABC$`, reason: md`SAS Similarity Theorem ($\angle A$ is between the proportional sides)` },
            { statement: md`$\angle ADE = \angle ABC$`, reason: "Corresponding angles of similar triangles are congruent" },
            { statement: md`$\overline{DE} \parallel \overline{BC}$`, reason: "Corresponding Angles Converse" },
          ],
        },
        {
          kind: "check",
          prompt: md`In $\triangle ABC$, $D$ is on $\overline{AB}$ and $E$ is on $\overline{AC}$, with $AD = 4$, $DB = 6$, $AE = 6$ and $EC = 9$. Is $\overline{DE}$ parallel to $\overline{BC}$?`,
          choices: ["Parallel", "Not parallel"],
          accept: ["Parallel"],
          explain: md`Cross products: $4 \cdot 9 = 36$ and $6 \cdot 6 = 36$, so $\frac{4}{6} = \frac{6}{9}$. The sides are divided proportionally, so by the converse, $\overline{DE} \parallel \overline{BC}$.`,
        },
        {
          kind: "key",
          title: "Triangle Angle Bisector Theorem",
          body: md`An angle bisector of a triangle divides the opposite side into two pieces proportional to the other two sides. If $\overrightarrow{AD}$ bisects $\angle BAC$ with $D$ on $\overline{BC}$, then

$$\frac{BD}{DC} = \frac{AB}{AC}.$$

Each piece of $\overline{BC}$ goes with the side it touches: $\overline{BD}$ with $\overline{AB}$, and $\overline{DC}$ with $\overline{AC}$.`,
        },
        {
          kind: "diagram",
          view: [-0.6, 8.9, -0.8, 6.4],
          points: [
            { name: "B", x: 0, y: 0, dir: "sw" },
            { name: "C", x: 7, y: 0, dir: "se" },
            { name: "A", x: "69/14", y: "sqrt(36 - (69/14)^2)", dir: "nw" },
            { name: "D", x: 4.2, y: 0, dir: "s" },
            { name: "E", x: "(10/6)(69/14)", y: "(10/6)sqrt(36 - (69/14)^2)", dir: "n" },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          segments: [
            { from: "B", to: "A", label: "6" },
            { from: "A", to: "C", label: "4" },
            { from: "A", to: "D", color: 1, parallel: 1 },
            { from: "A", to: "E", dashed: true },
            // E to C, so its arrow points the same way as the one on A to D.
            { from: "E", to: "C", dashed: true, color: 2, parallel: 1 },
          ],
          angles: [
            { at: "A", from: "B", to: "D" },
            { at: "A", from: "D", to: "C" },
            { at: "E", from: "A", to: "C", arcs: 2, color: 2 },
            { at: "C", from: "A", to: "E", arcs: 2, color: 2 },
          ],
          caption: md`$\overline{AD}$ bisects $\angle A$, with $AB = 6$ and $AC = 4$, so $D$ splits $\overline{BC}$, with $BC = 7$, in the ratio $6:4$: $BD = 4.2$ and $DC = 2.8$. For the proof, extend $\overline{BA}$ past $A$, and draw the line through $C$ parallel to $\overline{AD}$. They meet at $E$.`,
        },
        {
          kind: "proof",
          title: "Triangle Angle Bisector Theorem",
          given: md`$\overrightarrow{AD}$ bisects $\angle BAC$, with $D$ on $\overline{BC}$`,
          prove: md`$\frac{BD}{DC} = \frac{AB}{AC}$`,
          steps: [
            { statement: md`Draw the line through $C$ parallel to $\overleftrightarrow{AD}$. It meets $\overleftrightarrow{BA}$ at a point $E$ beyond $A$.`, reason: "Parallel Postulate" },
            { statement: md`$\angle BAD = \angle DAC$`, reason: "Definition of angle bisector" },
            { statement: md`$\angle BAD = \angle AEC$`, reason: md`Corresponding Angles Postulate ($\overleftrightarrow{AD} \parallel \overleftrightarrow{EC}$, transversal $\overleftrightarrow{BE}$)` },
            { statement: md`$\angle DAC = \angle ACE$`, reason: md`Alternate Interior Angles Theorem (transversal $\overleftrightarrow{AC}$)` },
            { statement: md`$\angle AEC = \angle ACE$`, reason: "Substitution (steps 2, 3 and 4)" },
            { statement: md`$AE = AC$`, reason: md`Converse of the Isosceles Triangle Theorem, in $\triangle ACE$` },
            { statement: md`$\frac{BD}{DC} = \frac{BA}{AE}$`, reason: md`Triangle Proportionality Theorem, in $\triangle BCE$ with $\overline{AD} \parallel \overline{EC}$` },
            { statement: md`$\frac{BD}{DC} = \frac{AB}{AC}$`, reason: md`Substitution ($AE = AC$)` },
          ],
        },
        {
          kind: "why",
          title: "Why the proof builds an isosceles triangle",
          body: md`The bisector gives two equal angles at $A$, but they sit in different places, so no theorem can use them directly. The parallel through $C$ copies both angles to the new triangle $\triangle ACE$, where they become its two base angles. An isosceles triangle then turns equal angles into equal lengths, $AE = AC$, and the side-splitter theorem turns the parallel into a proportion.

A quick sanity check: if $AB = AC$, the theorem says $BD = DC$, so the bisector hits the midpoint. That matches the isosceles triangle facts of Unit 3. The longer side always gets the longer piece.`,
        },
        {
          kind: "example",
          title: "Splitting a whole side",
          problem: md`In $\triangle ABC$, $AB = 10$, $AC = 8$ and $BC = 12$. The bisector of $\angle A$ meets $\overline{BC}$ at $D$. Find $BD$.`,
          steps: [
            { math: md`\frac{BD}{DC} = \frac{10}{8} = \frac{5}{4}`, note: "Triangle Angle Bisector Theorem." },
            { math: md`BD = 5k, \quad DC = 4k`, note: md`So $\overline{BC}$ is 9 equal shares.` },
            { math: md`5k + 4k = 12, \quad k = \frac{4}{3}`, note: "Segment Addition Postulate." },
            { math: md`BD = \frac{20}{3}, \quad DC = \frac{16}{3}`, note: md`Check: $\frac{20}{3} + \frac{16}{3} = 12$, and $\frac{20}{16} = \frac{5}{4}$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`In $\triangle ABC$, the bisector of $\angle A$ meets $\overline{BC}$ at $D$. $AB = 9$, $AC = 6$ and $BD = 6$. Find $DC$.`,
          answer: "4",
          explain: md`$\frac{BD}{DC} = \frac{AB}{AC}$ gives $\frac{6}{DC} = \frac{9}{6}$. Cross products: $9 \cdot DC = 36$, so $DC = 4$.`,
        },
      ],
      practice: [sideSplitter, angleBisector, parallelAndAlgebra],
    },
  ],
};
