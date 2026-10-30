import { frac, fracTex, gcd, paren, poly, type Rng } from "../../math/random";
import { md, type DiagramSpec, type Figure, type Generator, type SeriesColor, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

const EXACT = md`Give an exact answer: simplify square roots and keep them out of denominators (type $\sqrt{5}$ as sqrt(5)).`;

const isSquare = (n: number) => n >= 0 && Math.round(Math.sqrt(n)) ** 2 === n;

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

interface Exact {
  /** Answer text, e.g. "2sqrt(5)". */
  text: string;
  /** LaTeX, e.g. "2\sqrt{5}". */
  tex: string;
}

/** k times the square root of m (m square-free, 1 for a whole number), divided by d, reduced. */
function radOver(k: number, m: number, d = 1): Exact {
  const g = gcd(k, d);
  k /= g;
  d /= g;
  const top: Exact =
    m === 1 ? { text: String(k), tex: String(k) } : k === 1 ? { text: `sqrt(${m})`, tex: md`\sqrt{${m}}` } : { text: `${k}sqrt(${m})`, tex: md`${k}\sqrt{${m}}` };
  if (d === 1) return top;
  return { text: `${top.text}/${d}`, tex: md`\frac{${top.tex}}{${d}}` };
}

/** The square root of n, simplified. */
function root(n: number): Exact {
  const [k, m] = surd(n);
  return radOver(k, m);
}

/** LaTeX that works out the square root of n: "\sqrt{20} = \sqrt{4}\sqrt{5} = 2\sqrt{5}". */
function rootWork(n: number): string {
  const [k, m] = surd(n);
  if (m === 1) return md`\sqrt{${n}} = ${k}`;
  if (k === 1) return md`\sqrt{${n}}`;
  return md`\sqrt{${n}} = \sqrt{${k * k}} \cdot \sqrt{${m}} = ${k}\sqrt{${m}}`;
}

/** A note on what rootWork did. */
function rootNote(n: number): string {
  const [k, m] = surd(n);
  if (m === 1) return md`Square root property. A length is positive, so only the positive root counts, and $${k}^2 = ${n}$.`;
  if (k === 1) return md`Square root property, keeping the positive root since this is a length. ${n} has no perfect-square factor, so $\sqrt{${n}}$ is already simplified.`;
  return md`Square root property, keeping the positive root since this is a length. Then pull out the largest perfect square, ${k * k}.`;
}

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];

/** A Pythagorean triple (leg, leg, hypotenuse), possibly scaled, with hypotenuse at most maxHyp. */
function triple(r: Rng, maxHyp: number): [number, number, number] {
  const options: [number, number, number][] = [];
  for (const [a, b, c] of TRIPLES) for (let k = 1; k * c <= maxHyp; k++) options.push([k * a, k * b, k * c]);
  return r.pick(options);
}

/** Two legs whose hypotenuse is not a whole number. */
function radicalLegs(r: Rng): [number, number] {
  for (;;) {
    const p = r.int(1, 9);
    const q = r.int(p, 10);
    if (!isSquare(p * p + q * q)) return [p, q];
  }
}

/** A hypotenuse and one leg whose other leg is not a whole number. */
function radicalLeg(r: Rng, lo = 3, hi = 12): [number, number] {
  for (;;) {
    const h = r.int(lo, hi);
    const k = r.int(1, h - 1);
    if (!isSquare(h * h - k * k)) return [h, k];
  }
}

/** "An" before numbers read with a leading vowel sound (8, 11, 18, 80 to 89), "A" otherwise. */
const an = (n: number) => (n === 11 || n === 18 || String(n).startsWith("8") ? "An" : "A");

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Work for a missing hypotenuse from legs p and q. */
function hypotenuseSteps(p: number, q: number, name = "c"): Step[] {
  const n = p * p + q * q;
  return [
    { math: md`${name}^2 = ${p}^2 + ${q}^2`, note: "The legs go on one side; the hypotenuse, opposite the right angle, goes alone on the other." },
    { math: md`${name}^2 = ${p * p} + ${q * q} = ${n}`, note: "Square, then add." },
    { math: md`${name} = ${rootWork(n)}`, note: rootNote(n) },
  ];
}

/** Work for a missing leg from hypotenuse h and leg k. */
function legSteps(h: number, k: number, name = "x"): Step[] {
  const n = h * h - k * k;
  return [
    { math: md`${name}^2 + ${k}^2 = ${h}^2`, note: md`The unknown is a leg, so it goes with the other leg. The hypotenuse ${h} goes alone.` },
    { math: md`${name}^2 = ${h * h} - ${k * k} = ${n}`, note: md`Subtract $${k}^2 = ${k * k}$ from both sides.` },
    { math: md`${name} = ${rootWork(n)}`, note: rootNote(n) },
  ];
}

// ── Figures ─────────────────────────────────────────────────────────────────

type Pt = [number, number];
type Dir = NonNullable<NonNullable<DiagramSpec["points"]>[number]["dir"]>;
type Angle = NonNullable<DiagramSpec["angles"]>[number];

const round = (v: number) => Math.round(v * 1000) / 1000;

/** The label direction that points across side PQ, away from the point `inside`. */
function outward(p: Pt, q: Pt, inside: Pt): Dir {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  let [nx, ny] = [(p[1] - q[1]) / len, (q[0] - p[0]) / len];
  if (nx * ((p[0] + q[0]) / 2 - inside[0]) + ny * ((p[1] + q[1]) / 2 - inside[1]) < 0) [nx, ny] = [-nx, -ny];
  if (Math.abs(nx) < 0.2) return ny > 0 ? "n" : "s";
  if (Math.abs(ny) < 0.2) return nx > 0 ? "e" : "w";
  return `${ny > 0 ? "n" : "s"}${nx > 0 ? "e" : "w"}` as Dir;
}

interface Side {
  from: string;
  to: string;
  /** LaTeX, placed off the side, away from the figure (or toward `dir`). */
  label?: string;
  dir?: Dir;
  ticks?: 1 | 2 | 3;
  dashed?: boolean;
  arrow?: boolean;
  color?: SeriesColor;
}

/**
 * A figure drawn to scale from named points in any units: turned by `turn` degrees,
 * then scaled so its longer extent is 5 units. Points stay hidden unless listed in
 * `show`. Side labels sit on hidden points at the midpoints, so long labels never
 * run over a line.
 */
function sketch(s: {
  pts: Record<string, Pt>;
  show?: { name: string; label?: string; dir: Dir }[];
  polygon?: string[];
  sides?: Side[];
  angles?: Angle[];
  turn?: number;
}): Figure {
  const t = ((s.turn ?? 0) * Math.PI) / 180;
  const turned = Object.entries(s.pts).map(([name, [x, y]]) => [name, [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]] as const);
  const xs = turned.map(([, p]) => p[0]);
  const ys = turned.map(([, p]) => p[1]);
  const k = 5 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const at: Record<string, Pt> = Object.fromEntries(turned.map(([name, p]) => [name, [round(p[0] * k), round(p[1] * k)]]));
  const core = (s.polygon ?? Object.keys(at)).map((n) => at[n]!);
  const inside: Pt = [core.reduce((a, p) => a + p[0], 0) / core.length, core.reduce((a, p) => a + p[1], 0) / core.length];
  const shown = new Map((s.show ?? []).map((p) => [p.name, p]));
  const points: NonNullable<DiagramSpec["points"]> = Object.entries(at).map(([name, [x, y]]) => {
    const p = shown.get(name);
    return p ? { name, x, y, label: p.label ?? name, dir: p.dir } : { name, x, y, hidden: true, label: "" };
  });
  const [px, py] = [Math.min(...xs) * k, Math.min(...ys) * k];
  const view: DiagramSpec["view"] = [round(px - 1.5), round(px + (Math.max(...xs) - Math.min(...xs)) * k + 1.5), round(py - 1.1), round(py + (Math.max(...ys) - Math.min(...ys)) * k + 1.1)];
  // Screen pixels per unit, as the renderer will draw this view.
  const pxPerUnit = Math.min(516 / (view[1] - view[0]), 556 / (view[3] - view[2]));
  const sides = s.sides ?? [];
  sides.forEach((side, i) => {
    if (!side.label) return;
    const [p, q] = [at[side.from]!, at[side.to]!];
    let [mx, my] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (side.ticks && !side.dir) {
      // A tick mark sticks out 6px at the midpoint: move the label out past it.
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      let [nx, ny] = [(p[1] - q[1]) / len, (q[0] - p[0]) / len];
      if (nx * (mx - inside[0]) + ny * (my - inside[1]) < 0) [nx, ny] = [-nx, -ny];
      [mx, my] = [mx + (nx * 7) / pxPerUnit, my + (ny * 7) / pxPerUnit];
    }
    points.push({ name: `side${i}`, x: round(mx), y: round(my), hidden: true, label: side.label, dir: side.dir ?? outward(p, q, inside) });
  });
  // Angle labels go on the bisector, far enough out to clear both sides. The renderer puts
  // them a fixed 36px out, which lands a 30-degree label on its own sides.
  const labels: NonNullable<DiagramSpec["labels"]> = [];
  const angles = (s.angles ?? []).map(({ label, ...a }) => {
    if (!label) return a;
    const [v, f, t] = [at[a.at]!, at[a.from]!, at[a.to]!];
    const u1 = [f[0] - v[0], f[1] - v[1]];
    const u2 = [t[0] - v[0], t[1] - v[1]];
    const [l1, l2] = [Math.hypot(u1[0]!, u1[1]!), Math.hypot(u2[0]!, u2[1]!)];
    const bis = [u1[0]! / l1 + u2[0]! / l2, u1[1]! / l1 + u2[1]! / l2];
    const lb = Math.hypot(bis[0]!, bis[1]!);
    const half = Math.acos(Math.min(1, (u1[0]! * u2[0]! + u1[1]! * u2[1]!) / (l1 * l2))) / 2;
    const r = Math.max(36, 16 / Math.sin(half)) / pxPerUnit;
    labels.push({ x: round(v[0] + (bis[0]! / lb) * r), y: round(v[1] + (bis[1]! / lb) * r), text: label });
    return a;
  });
  return {
    kind: "diagram",
    view,
    points,
    polygons: s.polygon ? [{ points: s.polygon, fill: 1 }] : [],
    segments: sides.flatMap(({ from, to, ticks, dashed, arrow, color }, i): NonNullable<DiagramSpec["segments"]> => {
      if (!arrow) return [{ from, to, ticks, dashed, color }];
      // Stop the arrowhead 18px short of the corner, so it doesn't sit on a right-angle mark there.
      const [p, q] = [at[from]!, at[to]!];
      const back = 18 / pxPerUnit / Math.hypot(q[0] - p[0], q[1] - p[1]);
      points.push({ name: `head${i}`, x: round(q[0] - (q[0] - p[0]) * back), y: round(q[1] - (q[1] - p[1]) * back), hidden: true, label: "" });
      return [
        { from, to: `head${i}`, ticks, dashed, arrow, color },
        { from: `head${i}`, to, dashed, color },
      ];
    }),
    angles,
    labels,
  };
}

/**
 * A right triangle to scale: right angle at C, leg CA of length a, leg CB of length b,
 * turned by `turn` degrees. Labels are LaTeX; a side without one is left bare.
 * `angA` and `angB` label the acute angles at A and B.
 */
function rightTri(o: { a: number; b: number; la?: string; lb?: string; lc?: string; ticks?: boolean; angA?: string; angB?: string; turn?: number }): Figure {
  const tick = o.ticks ? 1 : undefined;
  return sketch({
    pts: { C: [0, 0], A: [o.a, 0], B: [0, o.b] },
    polygon: ["A", "B", "C"],
    sides: [
      { from: "C", to: "A", label: o.la, ticks: tick },
      { from: "C", to: "B", label: o.lb, ticks: tick },
      { from: "A", to: "B", label: o.lc },
    ],
    angles: [
      { at: "C", from: "A", to: "B", right: true },
      ...(o.angA ? [{ at: "A", from: "B", to: "C", label: o.angA }] : []),
      ...(o.angB ? [{ at: "B", from: "C", to: "A", label: o.angB }] : []),
    ],
    turn: o.turn,
  });
}

/** A w-by-h rectangle with diagonal AC; `ticks` marks all four sides equal (a square). */
function rectangle(o: { w: number; h: number; lw?: string; lh?: string; ld?: string; ticks?: boolean }): Figure {
  const tick = o.ticks ? 1 : undefined;
  return sketch({
    pts: { A: [0, 0], B: [o.w, 0], C: [o.w, o.h], D: [0, o.h] },
    polygon: ["A", "B", "C", "D"],
    sides: [
      { from: "A", to: "B", label: o.lw, ticks: tick },
      { from: "B", to: "C", label: o.lh, ticks: tick },
      { from: "C", to: "D", ticks: tick },
      { from: "D", to: "A", ticks: tick },
      { from: "A", to: "C", label: o.ld, color: 1 },
    ],
    angles: [{ at: "B", from: "A", to: "C", right: true }],
  });
}

/** A ladder from the ground at F up to T on a vertical wall, with the wall's foot at W. */
function ladder(o: { up: number; across: number; lUp?: string; lAcross?: string; lLadder: string; angle?: string }): Figure {
  const m = Math.max(o.up, o.across);
  return sketch({
    pts: { W: [0, 0], T: [0, o.up], F: [o.across, 0], G: [o.across + 0.25 * m, 0], R: [0, o.up + 0.15 * m] },
    polygon: ["W", "F", "T"],
    sides: [
      { from: "W", to: "R" },
      { from: "W", to: "G" },
      { from: "W", to: "T", label: o.lUp },
      { from: "W", to: "F", label: o.lAcross },
      { from: "F", to: "T", label: o.lLadder, color: 2 },
    ],
    angles: [{ at: "W", from: "F", to: "T", right: true }, ...(o.angle ? [{ at: "F", from: "W", to: "T", label: o.angle }] : [])],
  });
}

/**
 * An equilateral triangle with side t and its altitude AD. The two slanted sides are ticked;
 * a tick on the base would land on the altitude's foot, so the prompt says "equilateral".
 */
function equilateral(o: { t: number; lSide?: string; lHeight?: string }): Figure {
  return sketch({
    pts: { B: [0, 0], C: [o.t, 0], A: [o.t / 2, (o.t * Math.sqrt(3)) / 2], D: [o.t / 2, 0] },
    polygon: ["A", "B", "C"],
    sides: [
      { from: "B", to: "A", label: o.lSide, ticks: 1 },
      { from: "A", to: "C", ticks: 1 },
      { from: "B", to: "C" },
      { from: "A", to: "D", label: o.lHeight, dashed: true, dir: "e" },
    ],
    angles: [{ at: "D", from: "C", to: "A", right: true }],
  });
}

/** A verify equation saying the length named v is positive, to pair with a squared relation. */
const positive = (v: string) => `abs(${v}) = ${v}`;

/** Label direction for a point, pointing away from another point. */
function awayFrom(p: Pt, q: Pt): Dir {
  const [dx, dy] = [p[0] - q[0], p[1] - q[1]];
  if (dx === 0) return dy > 0 ? "n" : "s";
  if (dy === 0) return dx > 0 ? "e" : "w";
  return `${dy > 0 ? "n" : "s"}${dx > 0 ? "e" : "w"}` as Dir;
}

const DIR_STEP: Record<Dir, Pt> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [0.75, -0.75], nw: [-0.75, -0.75], se: [0.75, 0.75], sw: [-0.75, 0.75] };

/**
 * The best of some candidate label placements (a point and a direction) on a coordinate grid:
 * the first, in the order given, whose label stays inside the window and off the axes, their
 * numbers and the given lines. Mirrors the renderer's layout: 22px margin, at most 516 by
 * 556px of drawing, labels 14px tall-ish and about 7.5px a character.
 */
function placeLabel(view: [number, number, number, number], text: string, candidates: [Pt, Dir][], lines: [Pt, Pt][] = []): [Pt, Dir] {
  const [x0, x1, y0, y1] = view;
  const unit = Math.min(516 / (x1 - x0), 556 / (y1 - y0));
  const scr = ([x, y]: Pt): Pt => [22 + (x - x0) * unit, 22 + (y1 - y) * unit];
  const [W, H] = [(x1 - x0) * unit + 44, (y1 - y0) * unit + 44];
  const [ax, ay] = scr([x0 <= 0 && 0 <= x1 ? 0 : x0, y0 <= 0 && 0 <= y1 ? 0 : y0]);
  const width = text.replace(/\\[a-z]+|[{}]/g, "").length * 7.5 + 4;
  const meets = (b: number[], r: number[]) => b[0]! < r[2]! && r[0]! < b[2]! && b[1]! < r[3]! && r[1]! < b[3]!;
  const cost = ([p, dir]: [Pt, Dir]) => {
    const [x, y] = scr(p);
    const [dx, dy] = DIR_STEP[dir];
    const cx = x + dx * (dx ? 8 : 14);
    const left = dx > 0 ? cx : dx < 0 ? cx - width : cx - width / 2;
    const box = [left, y + dy * 14 - 9, left + width, y + dy * 14 + 9];
    let c = 0;
    if (box[0]! < 0 || box[1]! < 0 || box[2]! > W || box[3]! > H) c += 10;
    if (meets(box, [0, ay - 1.5, W, ay + 1.5])) c += 1; // the x-axis
    if (meets(box, [0, ay + 4, W, ay + 14.5])) c += 2; // its numbers, below it
    if (meets(box, [ax - 1.5, 0, ax + 1.5, H])) c += 1; // the y-axis
    if (meets(box, [ax - 24, 0, ax - 4, H])) c += 2; // its numbers, to its left
    for (const [a, b] of lines) {
      const [pa, pb] = [scr(a), scr(b)];
      for (let i = 0; i <= 40; i++) {
        const [qx, qy] = [pa[0] + ((pb[0] - pa[0]) * i) / 40, pa[1] + ((pb[1] - pa[1]) * i) / 40];
        if (qx > box[0]! && qx < box[2]! && qy > box[1]! && qy < box[3]!) {
          c += 2;
          break;
        }
      }
    }
    return c;
  };
  let best = candidates[0]!;
  let bestCost = cost(best);
  for (const cand of candidates.slice(1)) {
    const c = cost(cand);
    if (c < bestCost) [best, bestCost] = [cand, c];
  }
  return best;
}

/** Label directions for a point, most preferred first: pointing away from q, then the rest. */
function dirsAwayFrom(p: Pt, q: Pt): Dir[] {
  const all: Dir[] = ["ne", "nw", "se", "sw", "n", "s", "e", "w"];
  const [dx, dy] = [p[0] - q[0], p[1] - q[1]];
  const score = (d: Dir) => -(DIR_STEP[d][0] * dx - DIR_STEP[d][1] * dy) / (Math.hypot(...DIR_STEP[d]) * (Math.hypot(dx, dy) || 1));
  return [...all].sort((a, b) => score(a) - score(b));
}

/** A coordinate-grid window around some points, always including the origin. */
function gridView(pts: Pt[], pad = 2): [number, number, number, number] {
  const xs = [0, ...pts.map((p) => p[0])];
  const ys = [0, ...pts.map((p) => p[1])];
  return [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
}

// ── Lesson 1: The Pythagorean Theorem and its proofs ────────────────────────

const pythagoreanEquation: Generator = (r) => {
  const kind = r.int(0, 4);
  const ask = (eq: string) => md`Solve $${eq}$ to find the side $x$ of the right triangle in the figure. ${EXACT}`;
  const turn = r.pick([0, 90, 180, 270]);
  if (kind === 0) {
    const [p, q, h] = triple(r, 30);
    const [k, x] = r.next() < 0.5 ? [p, q] : [q, p];
    return {
      prompt: ask(r.next() < 0.5 ? md`x^2 + ${k}^2 = ${h}^2` : md`${k}^2 + x^2 = ${h}^2`),
      figure: rightTri({ a: k, b: x, la: String(k), lb: "x", lc: String(h), turn }),
      answer: String(x),
      simplified: true,
      hint: md`Square the numbers, get $x^2$ alone, then take the square root. A length is positive.`,
      solution: [
        { math: md`x^2 + ${k * k} = ${h * h}`, note: "Square the known sides." },
        { math: md`x^2 = ${h * h - k * k}`, note: md`Subtract ${k * k} from both sides.` },
        { math: md`x = ${rootWork(x * x)}`, note: rootNote(x * x) },
      ],
    };
  }
  if (kind === 1) {
    const [p, q] = radicalLegs(r);
    const n = p * p + q * q;
    return {
      prompt: ask(md`x^2 = ${p}^2 + ${q}^2`),
      figure: rightTri({ a: p, b: q, la: String(p), lb: String(q), lc: "x", turn }),
      answer: root(n).text,
      simplified: true,
      hint: md`Add the squares, then take the square root and simplify it.`,
      solution: [
        { math: md`x^2 = ${p * p} + ${q * q} = ${n}`, note: "Square, then add." },
        { math: md`x = ${rootWork(n)}`, note: rootNote(n) },
      ],
    };
  }
  if (kind === 2) {
    const [h, k] = radicalLeg(r);
    const n = h * h - k * k;
    return {
      prompt: ask(r.next() < 0.5 ? md`x^2 + ${k}^2 = ${h}^2` : md`${k}^2 + x^2 = ${h}^2`),
      figure: rightTri({ a: Math.sqrt(n), b: k, la: "x", lb: String(k), lc: String(h), turn }),
      answer: root(n).text,
      simplified: true,
      hint: md`Subtract $${k}^2$ from both sides, then take the square root and simplify it.`,
      solution: [
        { math: md`x^2 = ${h * h} - ${k * k} = ${n}`, note: md`Subtract $${k}^2 = ${k * k}$ from both sides.` },
        { math: md`x = ${rootWork(n)}`, note: rootNote(n) },
      ],
    };
  }
  const h = r.int(2, 12);
  if (kind === 3) {
    const ans = radOver(h, 2, 2);
    return {
      prompt: ask(md`x^2 + x^2 = ${h}^2`),
      figure: rightTri({ a: 1, b: 1, la: "x", lb: "x", lc: String(h), ticks: true, turn }),
      answer: ans.text,
      simplified: true,
      hint:
        h % 2 === 0
          ? md`Combine $x^2 + x^2$ first and divide by 2. Then take the square root and simplify it.`
          : md`Combine $x^2 + x^2$ first. When you take the square root, you'll get $\sqrt{2}$ in a denominator: multiply top and bottom by $\sqrt{2}$.`,
      solution: [
        { math: md`2x^2 = ${h * h}`, note: md`Combine like terms. Both legs are $x$: this is an isosceles right triangle.` },
        ...(h % 2 === 0
          ? [
              { math: md`x^2 = ${(h * h) / 2}`, note: "Divide both sides by 2." },
              { math: md`x = ${rootWork((h * h) / 2)}`, note: rootNote((h * h) / 2) },
            ]
          : [
              { math: md`x^2 = \frac{${h * h}}{2}`, note: "Divide both sides by 2." },
              { math: md`x = \frac{\sqrt{${h * h}}}{\sqrt{2}} = \frac{${h}}{\sqrt{2}}`, note: "Square root property, positive root. The root of a quotient is the quotient of the roots." },
              { math: md`x = \frac{${h}\sqrt{2}}{2}`, note: md`Multiply by $\frac{\sqrt{2}}{\sqrt{2}} = 1$, which clears the root from the denominator.` },
            ]),
      ],
    };
  }
  const ans = radOver(h, 5, 5);
  return {
    prompt: ask(md`x^2 + (2x)^2 = ${h}^2`),
    figure: rightTri({ a: 2, b: 1, la: "2x", lb: "x", lc: String(h), turn }),
    answer: ans.text,
    simplified: true,
    hint: md`$(2x)^2 = 4x^2$, not $2x^2$. Combine, divide, then take the square root and ${h % 5 === 0 ? "simplify it" : "clear the root from the denominator"}.`,
    solution: [
      { math: md`x^2 + 4x^2 = ${h * h}`, note: md`$(2x)^2 = 2x \cdot 2x = 4x^2$.` },
      { math: md`5x^2 = ${h * h}`, note: "Combine like terms." },
      ...(h % 5 === 0
        ? [
            { math: md`x^2 = ${(h * h) / 5}`, note: "Divide both sides by 5." },
            { math: md`x = ${rootWork((h * h) / 5)}`, note: rootNote((h * h) / 5) },
          ]
        : [
            { math: md`x = \frac{${h}}{\sqrt{5}}`, note: md`Divide by 5 and take the positive square root: $\sqrt{\frac{${h * h}}{5}} = \frac{${h}}{\sqrt{5}}$.` },
            { math: md`x = \frac{${h}\sqrt{5}}{5}`, note: md`Multiply top and bottom by $\sqrt{5}$.` },
          ]),
    ],
  };
};

const rightTriangleStories: Generator = (r) => {
  const story = r.int(0, 4);
  const whole = r.next() < 0.5;
  const fmt = (unit: string) => md`Give an exact length in ${unit}, as a number without units, with any square root simplified (type $\sqrt{5}$ as sqrt(5)).`;
  if (story === 1 || story === 2) {
    let [p, q] = whole ? triple(r, 25) : radicalLegs(r);
    // A leg of 1 reads badly ("1 blocks") and draws as a sliver.
    while (p < 2) [p, q] = radicalLegs(r);
    const [w, h] = r.next() < 0.5 ? [p, q] : [q, p];
    const n = w * w + h * h;
    const prompt =
      story === 1
        ? md`A rectangle is ${w} cm wide and ${h} cm tall. How long is its diagonal $d$? ${fmt("cm")}`
        : md`You walk ${w} blocks east and then ${h} blocks north. How far are you from your starting point in a straight line ($d$ in the figure)? ${fmt("blocks")}`;
    const figure =
      story === 1
        ? rectangle({ w, h, lw: String(w), lh: String(h), ld: "d" })
        : sketch({
            pts: { S: [0, 0], T: [w, 0], E: [w, h] },
            show: [
              { name: "S", label: md`\text{start}`, dir: "w" },
              { name: "E", label: md`\text{end}`, dir: "n" },
            ],
            sides: [
              { from: "S", to: "T", label: String(w), arrow: true, color: 2 },
              { from: "T", to: "E", label: String(h), arrow: true, color: 2 },
              { from: "S", to: "E", label: "d", dashed: true, color: 1 },
            ],
            angles: [{ at: "T", from: "S", to: "E", right: true }],
          });
    const why =
      story === 1
        ? "A rectangle's corners are right angles, so the diagonal is the hypotenuse of a right triangle whose legs are the width and height."
        : "East and north are perpendicular directions, so your path makes the two legs of a right triangle. The straight-line distance is the hypotenuse.";
    return {
      prompt,
      figure,
      verify: [md`d^2 = ${w}^2 + ${h}^2`, positive("d")],
      answer: root(n).text,
      simplified: true,
      hint: "Find the right angle first. The length you want is opposite it, so it is the hypotenuse.",
      solution: [{ math: md`\text{legs } ${w} \text{ and } ${h}`, note: why }, ...hypotenuseSteps(w, h, "d")],
    };
  }
  const t = triple(r, 25);
  let [h, k] = whole ? [t[2], t[0]] : radicalLeg(r, 4, 15);
  // Keep the given leg at least 2 and a quarter of the hypotenuse: no "1 inches wide" screens.
  while (k < 2 || 4 * k < h) [h, k] = radicalLeg(r, 4, 15);
  const n = h * h - k * k;
  if (story === 3) {
    // A very narrow triangle leaves no room to label the altitude, so widen the drawing.
    const half = Math.max(k, 0.35 * Math.sqrt(n));
    return {
      prompt: md`An isosceles triangle has two equal sides of length ${h} and a base of length ${2 * k}. Find its height $h$: the length of the altitude from the top vertex to the base.${half > k ? " The figure is not drawn to scale." : ""} ${EXACT}`,
      figure: sketch({
        pts: { L: [-half, 0], R: [half, 0], P: [0, Math.sqrt(n)], F: [0, 0] },
        polygon: ["L", "R", "P"],
        sides: [
          { from: "P", to: "L", label: String(h), ticks: 1 },
          { from: "P", to: "R", ticks: 1 },
          { from: "L", to: "R", label: String(2 * k) },
          { from: "P", to: "F", label: "h", dashed: true, dir: "e" },
        ],
        angles: [{ at: "F", from: "R", to: "P", right: true }],
      }),
      verify: [md`h^2 + (${2 * k}/2)^2 = ${h}^2`, positive("h")],
      answer: root(n).text,
      simplified: true,
      hint: md`The altitude to the base of an isosceles triangle cuts the base in half (the two halves are congruent by HL). So each half is a right triangle with hypotenuse ${h} and one leg ${k}.`,
      solution: [
        { math: md`\text{hypotenuse } ${h}, \quad \text{leg } \tfrac{${2 * k}}{2} = ${k}`, note: "The altitude splits the triangle into two congruent right triangles (HL), so it meets the base at its midpoint." },
        ...legSteps(h, k, "h"),
      ],
    };
  }
  const prompt =
    story === 0
      ? md`${an(h)} ${h}-foot ladder leans against a vertical wall. Its foot is on level ground, ${k} feet from the base of the wall. How high up the wall does the top of the ladder reach ($x$ in the figure)? ${fmt("feet")}`
      : md`A rectangular screen has ${an(h).toLowerCase()} ${h}-inch diagonal and is ${k} inches wide. How tall is it ($x$ in the figure)? ${fmt("inches")}`;
  const why =
    story === 0
      ? "The wall meets the ground at a right angle. The ladder is opposite that angle, so it is the hypotenuse. The distance along the ground is one leg."
      : "The screen's corner is a right angle, so the diagonal is the hypotenuse and the width is one leg.";
  return {
    prompt,
    figure:
      story === 0
        ? ladder({ up: Math.sqrt(n), across: k, lUp: "x", lAcross: String(k), lLadder: String(h) })
        : rectangle({ w: k, h: Math.sqrt(n), lw: String(k), lh: "x", ld: String(h) }),
    verify: [md`x^2 + ${k}^2 = ${h}^2`, positive("x")],
    answer: root(n).text,
    simplified: true,
    hint: "Which side is opposite the right angle? That one is the hypotenuse, and here it is the length you were given, not the one you want.",
    solution: [{ math: md`\text{hypotenuse } ${h}, \quad \text{leg } ${k}`, note: why }, ...legSteps(h, k, "x")],
  };
};

const CLASSES = ["acute", "right", "obtuse"] as const;

const classifyTriangle: Generator = (r) => {
  const target = r.int(0, 2);
  let a: number, b: number, c: number;
  if (target === 1) {
    [a, b, c] = triple(r, 30);
  } else {
    for (;;) {
      a = r.int(2, 12);
      b = r.int(a, 14);
      c = r.int(b, a + b - 1);
      const d = c * c - a * a - b * b;
      if (target === 0 ? d < 0 : d > 0) break;
    }
  }
  const d = c * c - a * a - b * b;
  const answer = CLASSES[target]!;
  const [s1, s2, s3] = shuffle(r, [a, b, c]);
  const sign = d < 0 ? "<" : d === 0 ? "=" : ">";
  return {
    prompt: md`A triangle has sides of length ${s1}, ${s2} and ${s3}. Is it acute, right or obtuse?`,
    choices: shuffle(r, CLASSES),
    accept: [answer],
    hint: md`Square the longest side and compare it with the sum of the squares of the other two.`,
    solution: [
      { math: md`c = ${c}, \quad a = ${a}, \quad b = ${b}`, note: "The longest side is opposite the largest angle, so it's the one to test." },
      { math: md`c^2 = ${c * c}, \qquad a^2 + b^2 = ${a * a} + ${b * b} = ${a * a + b * b}`, note: "Square and add." },
      {
        math: md`c^2 ${sign} a^2 + b^2`,
        note:
          d === 0
            ? "Equal, so by the converse of the Pythagorean Theorem the angle opposite the longest side is exactly 90 degrees: a **right** triangle."
            : d < 0
              ? "Less: the angle opposite the longest side is smaller than a right angle. It's the largest angle, so all three are acute: an **acute** triangle."
              : "More: the angle opposite the longest side is wider than a right angle, so it is an **obtuse** triangle.",
      },
    ],
  };
};

// ── Lesson 2: Special right triangles ───────────────────────────────────────

/** A 45-45-90 triangle with equal legs ticked, in one of five positions. */
const half45 = (r: Rng, leg: string | undefined, hyp: string | undefined) =>
  rightTri({ a: 1, b: 1, la: leg, lb: leg, lc: hyp, ticks: true, angA: md`45^\circ`, angB: md`45^\circ`, turn: r.pick([0, 90, 180, 270, 225]) });

const fortyFive: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const n = r.int(2, 12);
    return {
      prompt: md`Find the hypotenuse $x$ of the 45-45-90 triangle in the figure. ${EXACT}`,
      figure: half45(r, String(n), "x"),
      verify: [md`x^2 = ${n}^2 + ${n}^2`, positive("x")],
      answer: `${n}sqrt(2)`,
      simplified: true,
      hint: md`Hypotenuse = leg times $\sqrt{2}$.`,
      solution: [
        { math: md`\text{hypotenuse} = ${n}\sqrt{2}`, note: md`Half a square: $c^2 = ${n}^2 + ${n}^2 = 2 \cdot ${n}^2$, so $c = ${n}\sqrt{2}$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(2, 12);
    return {
      prompt: md`Find the leg $x$ of the 45-45-90 triangle in the figure. ${EXACT}`,
      figure: half45(r, "x", md`${k}\sqrt{2}`),
      verify: [md`x^2 + x^2 = (${k}*sqrt(2))^2`, positive("x")],
      answer: String(k),
      simplified: true,
      hint: md`Hypotenuse = leg times $\sqrt{2}$. What times $\sqrt{2}$ gives $${k}\sqrt{2}$?`,
      solution: [
        { math: md`x\sqrt{2} = ${k}\sqrt{2}`, note: "Call the leg x. The hypotenuse is the leg times the square root of 2." },
        { math: md`x = ${k}`, note: md`Divide both sides by $\sqrt{2}$.` },
      ],
    };
  }
  if (kind === 2) {
    const h = r.int(3, 20);
    const ans = radOver(h, 2, 2);
    return {
      prompt: md`Solve $x\sqrt{2} = ${h}$ to find the leg $x$ of the 45-45-90 triangle in the figure. ${EXACT}`,
      figure: half45(r, "x", String(h)),
      answer: ans.text,
      simplified: true,
      hint: md`Divide by $\sqrt{2}$, then multiply top and bottom by $\sqrt{2}$ to clear the root from the denominator.`,
      solution: [
        { math: md`x = \frac{${h}}{\sqrt{2}}`, note: md`Divide both sides by $\sqrt{2}$.` },
        { math: md`x = \frac{${h}}{\sqrt{2}} \cdot \frac{\sqrt{2}}{\sqrt{2}} = \frac{${h}\sqrt{2}}{2}${h % 2 === 0 ? md` = ${ans.tex}` : ""}`, note: md`Multiplying by $\frac{\sqrt{2}}{\sqrt{2}}$ is multiplying by 1, and $\sqrt{2} \cdot \sqrt{2} = 2$.` },
      ],
    };
  }
  const k = r.int(2, 9);
  return {
    prompt: md`Find the hypotenuse $x$ of the 45-45-90 triangle in the figure. ${EXACT}`,
    figure: half45(r, md`${k}\sqrt{2}`, "x"),
    verify: [md`x^2 = (${k}*sqrt(2))^2 + (${k}*sqrt(2))^2`, positive("x")],
    answer: String(2 * k),
    simplified: true,
    hint: md`Hypotenuse = leg times $\sqrt{2}$, and $\sqrt{2} \cdot \sqrt{2} = 2$.`,
    solution: [
      { math: md`${k}\sqrt{2} \cdot \sqrt{2} = ${k} \cdot 2 = ${2 * k}`, note: md`Multiply the leg by $\sqrt{2}$. Two square roots of 2 multiply to 2.` },
    ],
  };
};

/** A 30-60-90 triangle with sides labelled by the angle they face, in one of eight positions. */
function half60(r: Rng, labels: Partial<Record<30 | 60 | 90, string>>) {
  const swap = r.next() < 0.5;
  const [d30, d60] = [md`30^\circ`, md`60^\circ`];
  return rightTri(
    swap
      ? { a: Math.sqrt(3), b: 1, la: labels[60], lb: labels[30], lc: labels[90], angA: d30, angB: d60, turn: r.pick([0, 90, 180, 270]) }
      : { a: 1, b: Math.sqrt(3), la: labels[30], lb: labels[60], lc: labels[90], angA: d60, angB: d30, turn: r.pick([0, 90, 180, 270]) },
  );
}

const thirtySixty: Generator = (r) => {
  const kind = r.int(0, 5);
  const s = r.int(2, 12);
  const SHORT = md`\text{short leg}`;
  if (kind === 3) {
    const L = r.int(2, 15);
    const ans = radOver(L, 3, 3);
    return {
      prompt: md`Solve $x\sqrt{3} = ${L}$ to find the short leg $x$ of the 30-60-90 triangle in the figure. ${EXACT}`,
      figure: half60(r, { 30: "x", 60: String(L) }),
      answer: ans.text,
      simplified: true,
      hint: md`Divide by $\sqrt{3}$, then multiply top and bottom by $\sqrt{3}$.`,
      solution: [
        { math: md`x = \frac{${L}}{\sqrt{3}}`, note: md`Divide both sides by $\sqrt{3}$.` },
        { math: md`x = \frac{${L}\sqrt{3}}{3}${L % 3 === 0 ? md` = ${ans.tex}` : ""}`, note: md`Multiply by $\frac{\sqrt{3}}{\sqrt{3}}$: $\sqrt{3} \cdot \sqrt{3} = 3$.` },
      ],
    };
  }
  // givenText is the given length typed as an answer, for the verify equation.
  let given: 30 | 60 | 90, givenTex: string, givenText: string, asked: 30 | 60 | 90, ans: Exact;
  let steps: Step[];
  if (kind === 0) {
    given = 30;
    givenTex = givenText = String(s);
    asked = r.next() < 0.5 ? 60 : 90;
    ans = asked === 60 ? radOver(s, 3) : radOver(2 * s, 1);
    steps = [
      { math: md`${SHORT} = ${s}`, note: md`The short leg is opposite the $30^\circ$ angle, the smallest angle.` },
      asked === 60
        ? { math: md`\text{long leg} = ${s}\sqrt{3}`, note: md`Long leg = short leg times $\sqrt{3}$.` }
        : { math: md`\text{hypotenuse} = 2 \cdot ${s} = ${2 * s}`, note: "Hypotenuse = twice the short leg." },
    ];
  } else if (kind === 1) {
    given = 90;
    givenTex = givenText = String(2 * s);
    asked = r.next() < 0.5 ? 30 : 60;
    ans = asked === 30 ? radOver(s, 1) : radOver(s, 3);
    steps = [
      { math: md`${SHORT} = \frac{${2 * s}}{2} = ${s}`, note: "The hypotenuse is twice the short leg, so halve it." },
      ...(asked === 60 ? [{ math: md`\text{long leg} = ${s}\sqrt{3}`, note: md`Long leg = short leg times $\sqrt{3}$.` }] : []),
    ];
  } else if (kind === 2) {
    given = 60;
    givenTex = md`${s}\sqrt{3}`;
    givenText = `${s}*sqrt(3)`;
    asked = r.next() < 0.5 ? 30 : 90;
    ans = asked === 30 ? radOver(s, 1) : radOver(2 * s, 1);
    steps = [
      { math: md`${SHORT} = \frac{${s}\sqrt{3}}{\sqrt{3}} = ${s}`, note: md`The long leg is the short leg times $\sqrt{3}$, so divide by $\sqrt{3}$.` },
      ...(asked === 90 ? [{ math: md`\text{hypotenuse} = 2 \cdot ${s} = ${2 * s}`, note: "Hypotenuse = twice the short leg." }] : []),
    ];
  } else if (kind === 4) {
    const L = r.int(2, 15);
    given = 60;
    givenTex = givenText = String(L);
    asked = 90;
    ans = radOver(2 * L, 3, 3);
    const short = radOver(L, 3, 3);
    steps = [
      { math: md`${SHORT} = \frac{${L}}{\sqrt{3}} = \frac{${L}\sqrt{3}}{3}${L % 3 === 0 ? md` = ${short.tex}` : ""}`, note: md`Divide the long leg by $\sqrt{3}$, then clear the root from the denominator.` },
      { math: md`\text{hypotenuse} = 2 \cdot ${short.tex} = ${ans.tex}`, note: "Hypotenuse = twice the short leg." },
    ];
  } else {
    const H = r.int(3, 16);
    given = 90;
    givenTex = givenText = String(H);
    asked = 60;
    ans = radOver(H, 3, 2);
    const short = radOver(H, 1, 2);
    steps = [
      { math: md`${SHORT} = \frac{${H}}{2}${H % 2 === 0 ? md` = ${short.tex}` : ""}`, note: "Half the hypotenuse." },
      { math: md`\text{long leg} = ${short.tex} \cdot \sqrt{3} = ${ans.tex}`, note: md`Short leg times $\sqrt{3}$.` },
    ];
  }
  return {
    prompt: md`The figure shows a 30-60-90 triangle. Find $x$. ${EXACT}`,
    figure: half60(r, { [given]: givenTex, [asked]: "x" }),
    // Law of sines: each side over the sine of the angle it faces gives the same number.
    verify: [md`x / sin(${asked}*pi/180) = (${givenText}) / sin(${given}*pi/180)`],
    answer: ans.text,
    simplified: true,
    hint: md`Find the short leg (opposite $30^\circ$) first. Then long leg = short leg times $\sqrt{3}$, and hypotenuse = twice the short leg.`,
    solution: steps,
  };
};

const specialApplications: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const s = r.int(2, 15);
    return {
      prompt: md`A square has side length ${s}. Find the length of its diagonal $d$. ${EXACT}`,
      figure: rectangle({ w: 1, h: 1, lw: String(s), ld: "d", ticks: true }),
      verify: [md`d^2 = ${s}^2 + ${s}^2`, positive("d")],
      answer: `${s}sqrt(2)`,
      simplified: true,
      hint: "A diagonal cuts the square into two 45-45-90 triangles. The diagonal is the hypotenuse.",
      solution: [
        { math: md`\text{legs } ${s}, ${s}`, note: "The diagonal splits the square into two 45-45-90 triangles whose legs are sides of the square." },
        { math: md`d = ${s}\sqrt{2}`, note: md`Hypotenuse = leg times $\sqrt{2}$.` },
      ],
    };
  }
  if (kind === 1) {
    const d = r.int(2, 16);
    const ans = radOver(d, 2, 2);
    return {
      prompt: md`A square has a diagonal of length ${d}. Find its side length $s$. ${EXACT}`,
      figure: rectangle({ w: 1, h: 1, lw: "s", ld: String(d), ticks: true }),
      verify: [md`s^2 + s^2 = ${d}^2`, positive("s")],
      answer: ans.text,
      simplified: true,
      hint: md`The diagonal is the hypotenuse of a 45-45-90 triangle, so side times $\sqrt{2}$ = diagonal.`,
      solution: [
        { math: md`s\sqrt{2} = ${d}`, note: "The diagonal is the hypotenuse; the sides are the legs." },
        { math: md`s = \frac{${d}}{\sqrt{2}} = \frac{${d}\sqrt{2}}{2}${d % 2 === 0 ? md` = ${ans.tex}` : ""}`, note: md`Divide by $\sqrt{2}$, then multiply top and bottom by $\sqrt{2}$.` },
      ],
    };
  }
  if (kind === 2) {
    const t = r.int(2, 16);
    const ans = radOver(t, 3, 2);
    return {
      prompt: md`An equilateral triangle has side length ${t}. Find its height $h$. ${EXACT}`,
      figure: equilateral({ t, lSide: String(t), lHeight: "h" }),
      verify: [md`h^2 + (${t}/2)^2 = ${t}^2`, positive("h")],
      answer: ans.text,
      simplified: true,
      hint: md`The altitude cuts it into two 30-60-90 triangles. The side ${t} is the hypotenuse, and the height is the long leg.`,
      solution: [
        { math: md`\text{short leg} = \frac{${t}}{2}${t % 2 === 0 ? md` = ${t / 2}` : ""}`, note: "The altitude bisects the base, so the short leg is half a side. The side is the hypotenuse." },
        { math: md`h = ${radOver(t, 1, 2).tex} \cdot \sqrt{3} = ${ans.tex}`, note: md`The height is the long leg: short leg times $\sqrt{3}$.` },
      ],
    };
  }
  if (kind === 3) {
    const k = r.int(2, 10);
    return {
      prompt: md`An equilateral triangle has height $${k}\sqrt{3}$. Find its side length $x$. ${EXACT}`,
      figure: equilateral({ t: 2 * k, lSide: "x", lHeight: md`${k}\sqrt{3}` }),
      verify: [md`(x/2)^2 + (${k}*sqrt(3))^2 = x^2`, positive("x")],
      answer: String(2 * k),
      simplified: true,
      hint: "The height is the long leg of a 30-60-90 triangle, and a side of the equilateral triangle is its hypotenuse.",
      solution: [
        { math: md`\text{short leg} = \frac{${k}\sqrt{3}}{\sqrt{3}} = ${k}`, note: md`The height is the long leg, which is the short leg times $\sqrt{3}$.` },
        { math: md`\text{side} = 2 \cdot ${k} = ${2 * k}`, note: "The side is the hypotenuse: twice the short leg." },
      ],
    };
  }
  const L = r.int(4, 20);
  const angle = r.pick([30, 45, 60] as const);
  const ans = angle === 30 ? radOver(L, 1, 2) : angle === 45 ? radOver(L, 2, 2) : radOver(L, 3, 2);
  const steps: Step[] =
    angle === 45
      ? [
          { math: md`x\sqrt{2} = ${L}`, note: "The ladder, wall and ground make a 45-45-90 triangle. The ladder is the hypotenuse; the height is a leg." },
          { math: md`x = \frac{${L}}{\sqrt{2}} = \frac{${L}\sqrt{2}}{2}${L % 2 === 0 ? md` = ${ans.tex}` : ""}`, note: md`Divide by $\sqrt{2}$ and clear the root from the denominator.` },
        ]
      : [
          {
            math: md`\text{short leg} = \frac{${L}}{2}${L % 2 === 0 ? md` = ${L / 2}` : ""}`,
            note: md`The ladder, wall and ground make a 30-60-90 triangle with the ladder as hypotenuse. The short leg is half of it.`,
          },
          angle === 30
            ? { math: md`x = ${ans.tex}`, note: md`The $30^\circ$ angle is at the ground, so the wall height is opposite it: the short leg.` }
            : { math: md`x = ${radOver(L, 1, 2).tex} \cdot \sqrt{3} = ${ans.tex}`, note: md`The $60^\circ$ angle is at the ground, so the wall height is opposite it: the long leg.` },
        ];
  return {
    prompt: md`${an(L)} ${L}-foot ladder leans against a vertical wall and makes a $${angle}^\circ$ angle with the level ground. How high up the wall does it reach ($x$ in the figure)? Give an exact answer in feet, as a number without units, with square roots simplified and none in a denominator. Fractions are fine, like 7/2.`,
    figure: ladder({ up: Math.sin((angle * Math.PI) / 180), across: Math.cos((angle * Math.PI) / 180), lUp: "x", lLadder: String(L), angle: md`${angle}^\circ` }),
    // The height is the side opposite the ground angle, and the ladder is the hypotenuse.
    verify: [md`x = ${L} * sin(${angle}*pi/180)`],
    answer: ans.text,
    simplified: true,
    hint: md`Wall and ground meet at $90^\circ$, so this is a special right triangle. The height is the side opposite the angle at the ground.`,
    solution: steps,
  };
};

// ── Lesson 3: Distance in the plane ─────────────────────────────────────────

/** A starting coordinate so that start + delta stays within [-lim, lim]. */
const start = (r: Rng, delta: number, lim = 9) => r.int(Math.max(-lim, -lim - delta), Math.min(lim, lim - delta));

const pt = (x: number | string, y: number | string) => `(${x}, ${y})`;

const distanceBetween: Generator = (r) => {
  const kind = r.int(0, 4);
  let dx: number, dy: number;
  if (kind <= 1) {
    const [p, q] = triple(r, 15);
    [dx, dy] = r.next() < 0.5 ? [p, q] : [q, p];
  } else if (kind <= 3) {
    dx = r.int(1, 7);
    dy = r.int(1, 7);
  } else {
    [dx, dy] = r.next() < 0.5 ? [r.int(2, 12), 0] : [0, r.int(2, 12)];
  }
  dx *= r.sign();
  dy *= r.sign();
  const x1 = start(r, dx);
  const y1 = start(r, dy);
  const [x2, y2] = [x1 + dx, y1 + dy];
  const n = dx * dx + dy * dy;
  const view = gridView([[x1, y1], [x2, y2]]);
  const [A, B]: [Pt, Pt] = [[x1, y1], [x2, y2]];
  const gridDir = (p: Pt, q: Pt) => placeLabel(view, `A${pt(p[0], p[1])}`, dirsAwayFrom(p, q).map((d): [Pt, Dir] => [p, d]), [[A, B]])[1];
  return {
    prompt: md`Find the distance between $A${pt(x1, y1)}$ and $B${pt(x2, y2)}$. ${EXACT}`,
    figure: {
      kind: "diagram",
      view,
      grid: true,
      points: [
        { name: "A", x: x1, y: y1, label: md`A${pt(x1, y1)}`, dir: gridDir(A, B) },
        { name: "B", x: x2, y: y2, label: md`B${pt(x2, y2)}`, dir: gridDir(B, A) },
      ],
      segments: [{ from: "A", to: "B", color: 1 }],
    },
    verify: [md`d^2 = (${x2} - ${paren(x1)})^2 + (${y2} - ${paren(y1)})^2`, positive("d")],
    answer: root(n).text,
    simplified: true,
    hint: md`Subtract the $x$-coordinates and the $y$-coordinates. Those are the legs of a right triangle with $\overline{AB}$ as hypotenuse.`,
    solution: [
      { math: md`x_2 - x_1 = ${x2} - ${paren(x1)} = ${dx}, \qquad y_2 - y_1 = ${y2} - ${paren(y1)} = ${dy}`, note: "The horizontal and vertical changes. Their signs won't matter once they're squared." },
      { math: md`AB = \sqrt{${paren(dx)}^2 + ${paren(dy)}^2} = \sqrt{${dx * dx} + ${dy * dy}}`, note: "Distance Formula." },
      { math: md`AB = ${rootWork(n)}`, note: isSquare(n) ? "" : "Simplify the square root." },
    ],
  };
};

const midpointEndpoint: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind <= 1) {
    let x1: number, x2: number, y1: number, y2: number;
    for (;;) {
      [x1, x2, y1, y2] = [r.int(-9, 9), r.int(-9, 9), r.int(-9, 9), r.int(-9, 9)];
      if (x1 === x2 && y1 === y2) continue;
      const even = (x1 + x2) % 2 === 0 && (y1 + y2) % 2 === 0;
      if (kind === 0 ? even : !even) break;
    }
    const [mx, my] = [frac(x1 + x2, 2), frac(y1 + y2, 2)];
    const [AM, MB] = [md`(x - ${paren(x1)})^2 + (y - ${paren(y1)})^2`, md`(x - ${paren(x2)})^2 + (y - ${paren(y2)})^2`];
    return {
      prompt: md`Find the midpoint of $\overline{AB}$ for $A${pt(x1, y1)}$ and $B${pt(x2, y2)}$. Give the point as (x, y); fractions are fine, like (7/2, -1).`,
      // M = (x, y) is the midpoint when it is equally far from A and B and lies on AB.
      verify: [md`${AM} = ${MB}`, md`sqrt(${AM}) + sqrt(${MB}) = sqrt(${(x2 - x1) ** 2 + (y2 - y1) ** 2})`],
      answer: pt(mx, my),
      form: "tuple",
      hint: "Average the x-coordinates, and separately average the y-coordinates.",
      solution: [
        { math: md`M = \left(\frac{${x1} + ${paren(x2)}}{2}, \frac{${y1} + ${paren(y2)}}{2}\right)`, note: "Midpoint Formula: each coordinate is the average of the endpoints' coordinates." },
        { math: md`M = \left(${fracTex(x1 + x2, 2)}, ${fracTex(y1 + y2, 2)}\right)`, note: "" },
      ],
    };
  }
  let x1: number, y1: number, mx: number, my: number;
  for (;;) {
    [x1, y1, mx, my] = [r.int(-8, 8), r.int(-8, 8), r.int(-6, 6), r.int(-6, 6)];
    if (x1 !== mx || y1 !== my) break;
  }
  const [x2, y2] = [2 * mx - x1, 2 * my - y1];
  const [AM, MB] = [(mx - x1) ** 2 + (my - y1) ** 2, md`(x - ${paren(mx)})^2 + (y - ${paren(my)})^2`];
  return {
    prompt: md`The midpoint of $\overline{AB}$ is $M${pt(mx, my)}$, and one endpoint is $A${pt(x1, y1)}$. Find the other endpoint, $B$. Give the point as (x, y).`,
    // B = (x, y) makes M the midpoint when MB = AM and M lies on AB (AM + MB = AB).
    verify: [md`${MB} = ${AM}`, md`sqrt(${AM}) + sqrt(${MB}) = sqrt((x - ${paren(x1)})^2 + (y - ${paren(y1)})^2)`],
    answer: pt(x2, y2),
    form: "tuple",
    hint: md`The step from $A$ to $M$ is half the trip. Take the same step again from $M$ to reach $B$.`,
    solution: [
      { math: md`\frac{${x1} + x}{2} = ${mx}, \qquad \frac{${y1} + y}{2} = ${my}`, note: md`Call $B = (x, y)$ and apply the Midpoint Formula to each coordinate.` },
      { math: md`${x1} + x = ${2 * mx}, \qquad ${y1} + y = ${2 * my}`, note: "Multiply both sides by 2." },
      { math: md`B = ${pt(x2, y2)}`, note: md`Subtract. As a check: from $A$ to $M$ is a step of $(${mx - x1}, ${my - y1})$, and the same step from $M$ lands on $B$.` },
    ],
  };
};

const coordinateFromDistance: Generator = (r) => {
  const unknownX = r.next() < 0.5;
  let k: number, d: number, n: number;
  if (r.next() < 0.7) {
    const [p, q, c] = triple(r, 17);
    [k, d] = [r.next() < 0.5 ? p : q, c];
    n = d * d - k * k;
  } else {
    [d, k] = radicalLeg(r, 3, 9);
    n = d * d - k * k;
  }
  const a1 = r.int(-6, 6);
  const a2 = r.int(-6, 6);
  const knownSign = r.sign();
  const side = r.sign();
  const v = unknownX ? "x" : "y";
  // The known coordinate of P, and the coordinate of A it is compared with.
  const [known, aKnown, aUnknown] = unknownX ? [a2 + knownSign * k, a2, a1] : [a1 + knownSign * k, a1, a2];
  const P = unknownX ? pt("x", known) : pt(known, "y");
  const where = unknownX ? (side > 0 ? "to the right of" : "to the left of") : side > 0 ? "higher than" : "lower than";
  const rt = root(n);
  const answer = isSquare(n)
    ? String(aUnknown + side * Math.sqrt(n))
    : aUnknown === 0
      ? `${side > 0 ? "" : "-"}${rt.text}`
      : `${aUnknown} ${side > 0 ? "+" : "-"} ${rt.text}`;
  const answerTex = isSquare(n)
    ? answer
    : aUnknown === 0
      ? `${side > 0 ? "" : "-"}${rt.tex}`
      : `${aUnknown} ${side > 0 ? "+" : "-"} ${rt.tex}`;
  const shift = poly([[1, v], [-aUnknown, ""]]);
  const unknownSquare = aUnknown === 0 ? `${v}^2` : `(${shift})^2`;
  const knownDiff = `(${known} - ${paren(aKnown)})^2`;
  const eq = unknownX ? md`${unknownSquare} + ${knownDiff} = ${d}^2` : md`${knownDiff} + ${unknownSquare} = ${d}^2`;
  // Half the time the learner sets up the equation from the Distance Formula themselves.
  const scaffold = r.next() < 0.5;
  const goal = md`the point $P${P}$ that is ${d} units from $A${pt(a1, a2)}$ and ${where} $A$`;
  const knownNote = md`The known difference is $${known} - ${paren(aKnown)} = ${known - aKnown}$, and its square is ${k * k}.`;
  // The figure shows A and the line P lies on, not P itself: the grid would give it away.
  const view = unknownX ? gridView([[a1 - d, a2], [a1 + d, known]]) : gridView([[known, a2 - d], [a1, a2 + d]]);
  if (!unknownX) {
    // A tall, narrow grid: A's label and the line's tag sit beside the outermost points,
    // so widen the window until each label fits (about 8px a character, labels start 8px out).
    const room = (chars: number) => {
      const unit = Math.min(516 / (view[1] - view[0]), 556 / (view[3] - view[2]));
      return Math.max(2, Math.ceil(((chars * 8 + 16 - 22) / unit) * 2) / 2);
    };
    const [aChars, tagChars] = [pt(a1, a2).length + 1, `x = ${known}`.length];
    for (let i = 0; i < 3; i++) {
      const [left, right] = known > a1 ? [room(aChars), room(tagChars)] : [room(tagChars), room(aChars)];
      view[0] = Math.min(known, a1, 0) - left;
      view[1] = Math.max(known, a1, 0) + right;
    }
  }
  const along: [Pt, Pt] = unknownX ? [[view[0], known], [view[1], known]] : [[known, view[2]], [known, view[3]]];
  const A: Pt = [a1, a2];
  const [, aDir] = placeLabel(view, `A${pt(a1, a2)}`, dirsAwayFrom(A, unknownX ? [a1, known] : [known, a2]).map((d): [Pt, Dir] => [A, d]), [along]);
  // The line's equation goes near one end of it, on the side away from A, clear of the axes.
  const tagText = `${unknownX ? "y" : "x"} = ${known}`;
  const ends: Pt[] = unknownX ? [[view[0] + 2.5, known], [view[1] - 2.5, known]] : [[known, view[3] - 1.5], [known, view[2] + 1.5]];
  const sides: Dir[] = unknownX ? (known > a2 ? ["n", "s"] : ["s", "n"]) : known > a1 ? ["e", "w"] : ["w", "e"];
  const [tag, tagDir] = placeLabel(view, tagText, sides.flatMap((d) => ends.map((e): [Pt, Dir] => [e, d])), [[A, A]]);
  const figure: Figure = {
    kind: "diagram",
    view,
    grid: true,
    points: [
      { name: "A", x: a1, y: a2, label: md`A${pt(a1, a2)}`, dir: aDir },
      { name: "U", x: along[0][0], y: along[0][1], hidden: true, label: "" },
      { name: "V", x: along[1][0], y: along[1][1], hidden: true, label: "" },
      { name: "L", x: tag[0], y: tag[1], hidden: true, label: md`${tagText}`, dir: tagDir },
    ],
    segments: [{ from: "U", to: "V", kind: "line", dashed: true, color: 2 }],
    caption: md`$P$ is somewhere on the dashed line.`,
  };
  return {
    prompt: scaffold
      ? md`Solve $${eq}$ to find ${goal}. Give the value of $${v}$ exactly, simplifying any square root.`
      : md`Find $${v}$ for ${goal}. Give the value of $${v}$ exactly, simplifying any square root.`,
    figure,
    // P is d units from A, on the stated side of it.
    verify: [md`(${v} - ${paren(aUnknown)})^2 + (${known} - ${paren(aKnown)})^2 = ${d}^2`, md`abs(${v} - ${paren(aUnknown)}) = ${side}*(${v} - ${paren(aUnknown)})`],
    answer,
    simplified: true,
    hint: scaffold
      ? md`Work out the known square, get $${unknownSquare}$ alone, and use the square root property. Then choose the sign that puts $P$ ${where} $A$.`
      : md`Write the Distance Formula for $AP = ${d}$ and square both sides. Get $${unknownSquare}$ alone, use the square root property, then choose the sign that puts $P$ ${where} $A$.`,
    solution: [
      ...(scaffold ? [] : [{ math: eq, note: md`Distance Formula for $AP = ${d}$, with both sides squared.` }]),
      { math: md`${unknownSquare} + ${k * k} = ${d * d}`, note: scaffold ? md`This is the Distance Formula for $AP = ${d}$, squared. ${knownNote}` : knownNote },
      { math: md`${unknownSquare} = ${n}`, note: md`Subtract ${k * k} from both sides.` },
      { math: md`${aUnknown === 0 ? v : shift} = \pm ${rt.tex}`, note: "Square root property: both signs, for now." },
      ...(aUnknown === 0 ? [] : [{ math: md`${v} = ${aUnknown} \pm ${rt.tex}`, note: md`${aUnknown > 0 ? "Add" : "Subtract"} ${Math.abs(aUnknown)}.` }]),
      { math: md`${v} = ${answerTex}`, note: md`Both points are ${d} units from $A$. $P$ is ${where} $A$, so its $${v}$ must be ${side > 0 ? "greater" : "less"} than ${aUnknown}: take the ${side > 0 ? "plus" : "minus"} sign.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit5: Unit = {
  title: "Right Triangles",
  lessons: [
    {
      id: "the-pythagorean-theorem-and-its-proofs",
      title: "The Pythagorean Theorem and its proofs",
      summary: "Why the squares on the legs add up to the square on the hypotenuse, proved two ways, then the converse, classifying triangles by their sides, and Pythagorean triples.",
      blocks: [
        {
          kind: "text",
          body: md`A **right triangle** has one right angle. The two sides that form it are the **legs**. The side opposite the right angle is the **hypotenuse**. The other two angles share the remaining $90^\circ$, so the right angle is the largest angle, and by Unit 3 the hypotenuse is the longest side.

We'll call the legs $a$ and $b$ and the hypotenuse $c$. By SAS, two legs and the right angle between them fix the whole triangle. So $c$ is completely decided by $a$ and $b$. The question is how.`,
        },
        {
          kind: "diagram",
          view: [-4, 8, -5, 8],
          points: [
            { name: "C", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 4, y: 0, dir: "se" },
            { name: "B", x: 0, y: 3, dir: "nw" },
            { name: "P", x: -3, y: 0, hidden: true, label: "" },
            { name: "Q", x: -3, y: 3, hidden: true, label: "" },
            { name: "R", x: 0, y: -4, hidden: true, label: "" },
            { name: "S", x: 4, y: -4, hidden: true, label: "" },
            { name: "T", x: 7, y: 4, hidden: true, label: "" },
            { name: "U", x: 3, y: 7, hidden: true, label: "" },
          ],
          polygons: [
            { points: ["C", "B", "Q", "P"], fill: 3 },
            { points: ["C", "R", "S", "A"], fill: 4 },
            { points: ["A", "T", "U", "B"], fill: 2 },
            { points: ["A", "B", "C"] },
          ],
          angles: [{ at: "C", from: "A", to: "B", right: true }],
          labels: [
            { x: -1.5, y: 1.5, text: "a^2 = 9" },
            { x: 2, y: -2, text: "b^2 = 16" },
            { x: 3.5, y: 3.5, text: "c^2 = 25" },
          ],
          caption: md`A right triangle with legs $a = 3$ and $b = 4$ and hypotenuse $c = 5$, with a square built on each side. The squares on the legs hold $9 + 16 = 25$ unit squares, exactly as many as the square on the hypotenuse.`,
        },
        {
          kind: "key",
          title: "The Pythagorean Theorem",
          body: md`In a right triangle with legs $a$ and $b$ and hypotenuse $c$,

$$a^2 + b^2 = c^2.$$

In pictures: the square on the hypotenuse has the same area as the squares on the two legs put together.`,
        },
        {
          kind: "why",
          title: "Why expect squares?",
          body: md`Scale a right triangle by 2. Every side doubles, and every square on a side gets 4 times the area. A true rule linking the sides has to survive that, and $a^2 + b^2 = c^2$ does: $(2a)^2 + (2b)^2 = 4(a^2 + b^2) = 4c^2 = (2c)^2$.

Scaling alone can't pick the power, though: $a + b = c$ and $a^3 + b^3 = c^3$ survive it too. The 3-4-5 triangle above settles it. $3 + 4 = 7$, not 5 (and the Triangle Inequality says $a + b > c$ in every triangle). $3^3 + 4^3 = 91$, not $125$. But $3^2 + 4^2 = 25 = 5^2$. A guess that fits one triangle isn't a proof. Here are two.`,
        },
        {
          kind: "text",
          body: md`**Proof 1: rearranging four triangles.** This proof uses area facts you know from earlier school. A square with side $s$ has area $s^2$. A right triangle with legs $a$ and $b$ is half of an $a$-by-$b$ rectangle, so its area is $\frac{1}{2}ab$. And when a figure is cut into pieces that don't overlap, the pieces' areas add up to the whole. Unit 8 builds area carefully from postulates, and these facts come out the same there.`,
        },
        {
          kind: "diagram",
          view: [-1, 9, -1, 9],
          params: [
            { name: "a", tex: "a", min: 1, max: 4, step: 0.5, value: 3 },
            { name: "b", tex: "b", min: 1, max: 4, step: 0.5, value: 4 },
          ],
          points: [
            { name: "P1", x: 0, y: 0, hidden: true, label: "" },
            { name: "P2", x: "a + b", y: 0, hidden: true, label: "" },
            { name: "P3", x: "a + b", y: "a + b", hidden: true, label: "" },
            { name: "P4", x: 0, y: "a + b", hidden: true, label: "" },
            { name: "Q1", x: "a", y: 0, hidden: true, label: "" },
            { name: "Q2", x: "a + b", y: "a", hidden: true, label: "" },
            { name: "Q3", x: "b", y: "a + b", hidden: true, label: "" },
            { name: "Q4", x: 0, y: "b", hidden: true, label: "" },
          ],
          polygons: [
            { points: ["P1", "Q1", "Q4"], fill: 1 },
            { points: ["P2", "Q2", "Q1"], fill: 1 },
            { points: ["P3", "Q3", "Q2"], fill: 1 },
            { points: ["P4", "Q4", "Q3"], fill: 1 },
            { points: ["Q1", "Q2", "Q3", "Q4"], fill: 2 },
          ],
          angles: [{ at: "Q1", from: "Q2", to: "Q4", right: true }],
          labels: [
            { x: "a/2", y: -0.45, text: "a" },
            { x: "a + b/2", y: -0.45, text: "b" },
            { x: "a + b + 0.45", y: "a/2", text: "a" },
            { x: "a + b + 0.45", y: "a + b/2", text: "b" },
            { x: "(a + b)/2", y: "(a + b)/2", text: "c^2" },
          ],
          readouts: [
            { label: md`\text{big square } (a + b)^2`, value: "(a + b)^2" },
            { label: md`\text{four triangles } 4 \cdot \tfrac{1}{2}ab`, value: "2*a*b" },
            { label: md`\text{inner square}`, value: "(a + b)^2 - 2*a*b" },
            { label: md`a^2 + b^2`, value: "a^2 + b^2" },
          ],
          caption: md`A square with side $a + b$. Each side is cut into a piece $a$ and a piece $b$, always in the same order going around, and the cut points are joined. The four corner pieces are copies of the triangle. Move the sliders: the inner square always matches $a^2 + b^2$.`,
        },
        {
          kind: "proof",
          title: "The Pythagorean Theorem, by rearrangement",
          given: md`A right triangle with legs $a$ and $b$ and hypotenuse $c$.`,
          prove: md`$a^2 + b^2 = c^2$`,
          steps: [
            {
              statement: md`Draw a square with side $a + b$. Cut each side into a piece $a$ then a piece $b$, going around, and join the cut points in order.`,
              reason: md`Construction (Ruler Postulate to mark the lengths)`,
            },
            {
              statement: md`Each corner piece is a right triangle with legs $a$ and $b$, so it is congruent to the original triangle.`,
              reason: md`SAS Postulate: the square's corner is a $90^\circ$ angle between sides $a$ and $b$`,
            },
            { statement: md`All four sides of the inner figure have length $c$.`, reason: md`CPCTC` },
            {
              statement: md`At each cut point, an acute angle $\alpha$ of one triangle, the inner corner $\theta$, and the other acute angle $\beta$ of the next triangle fill a straight angle: $\alpha + \theta + \beta = 180^\circ$.`,
              reason: md`Angle Addition Postulate and Linear Pair Postulate`,
            },
            { statement: md`$\alpha + \beta = 90^\circ$`, reason: md`Triangle Angle Sum Theorem: the triangle's angles are $\alpha$, $\beta$ and $90^\circ$` },
            { statement: md`$\theta = 90^\circ$`, reason: md`Substitution, then the Subtraction Property of Equality` },
            { statement: md`The inner figure is a square with side $c$, so its area is $c^2$.`, reason: md`Four equal sides and four right angles; area of a square` },
            { statement: md`$(a + b)^2 = 4 \cdot \tfrac{1}{2}ab + c^2$`, reason: md`Area addition: the four triangles and the inner square fill the big square without overlapping` },
            { statement: md`$a^2 + 2ab + b^2 = 2ab + c^2$`, reason: md`Distributive Property (square the binomial), and $4 \cdot \frac{1}{2} = 2$` },
            { statement: md`$a^2 + b^2 = c^2$`, reason: md`Subtraction Property of Equality (subtract $2ab$)` },
          ],
        },
        {
          kind: "why",
          title: "Why is the inside a square, and not just a diamond?",
          body: md`Four equal sides aren't enough. A rhombus has four equal sides and can be squashed flat. The corners have to be right angles too.

Look at one cut point. Three angles sit side by side along the big square's straight edge: an acute angle from the triangle on one side, the inner corner, and an acute angle from the triangle on the other side. Because the pieces go $a$ then $b$ all the way around, those two acute angles are the triangle's two **different** acute angles. They add to $90^\circ$, so the inner corner is $180^\circ - 90^\circ = 90^\circ$. If the pieces went $a, b$ on one side and $b, a$ on the next, this would fail, which is why the order matters.`,
        },
        {
          kind: "diagram",
          view: [-0.5, 16.5, -0.5, 7.5],
          points: [
            { name: "Q1", x: 3, y: 0, hidden: true, label: "" },
            { name: "Q2", x: 7, y: 3, hidden: true, label: "" },
            { name: "Q3", x: 4, y: 7, hidden: true, label: "" },
            { name: "Q4", x: 0, y: 4, hidden: true, label: "" },
            { name: "P1", x: 0, y: 0, hidden: true, label: "" },
            { name: "P2", x: 7, y: 0, hidden: true, label: "" },
            { name: "P3", x: 7, y: 7, hidden: true, label: "" },
            { name: "P4", x: 0, y: 7, hidden: true, label: "" },
            { name: "S1", x: 9, y: 0, hidden: true, label: "" },
            { name: "S2", x: 16, y: 0, hidden: true, label: "" },
            { name: "S3", x: 16, y: 7, hidden: true, label: "" },
            { name: "S4", x: 9, y: 7, hidden: true, label: "" },
            { name: "T1", x: 12, y: 0, hidden: true, label: "" },
            { name: "T2", x: 12, y: 3, hidden: true, label: "" },
            { name: "T3", x: 9, y: 3, hidden: true, label: "" },
            { name: "T4", x: 16, y: 3, hidden: true, label: "" },
            { name: "T5", x: 12, y: 7, hidden: true, label: "" },
          ],
          polygons: [
            { points: ["P1", "Q1", "Q4"], fill: 1 },
            { points: ["P2", "Q2", "Q1"], fill: 1 },
            { points: ["P3", "Q3", "Q2"], fill: 1 },
            { points: ["P4", "Q4", "Q3"], fill: 1 },
            { points: ["Q1", "Q2", "Q3", "Q4"], fill: 2 },
            { points: ["S1", "T1", "T2", "T3"], fill: 3 },
            { points: ["T2", "T4", "S3", "T5"], fill: 4 },
            { points: ["T1", "S2", "T4"], fill: 1 },
            { points: ["T1", "T4", "T2"], fill: 1 },
            { points: ["T3", "T2", "T5"], fill: 1 },
            { points: ["T3", "T5", "S4"], fill: 1 },
          ],
          labels: [
            { x: 3.5, y: 3.5, text: "c^2" },
            { x: 10.5, y: 1.5, text: "a^2" },
            { x: 14, y: 5, text: "b^2" },
          ],
          caption: md`The same four triangles (blue) in the same $(a + b)$-by-$(a + b)$ square, arranged two ways. On the left, what's left uncovered is the square $c^2$. On the right, it's the squares $a^2$ and $b^2$. Equal squares minus equal triangles leave equal areas, so $a^2 + b^2 = c^2$, with no algebra at all.`,
        },
        {
          kind: "text",
          body: md`**Proof 2: similar triangles.** This one never mentions area. Drop the altitude from the right angle $C$ to the hypotenuse, meeting it at $D$. It splits the triangle into two smaller right triangles, and each one has a right angle and shares an acute angle with the whole triangle. By AA, each is similar to the whole.

The foot $D$ lands between $A$ and $B$. If $D$ were $B$ itself, $\overline{CB}$ would be perpendicular to $\overline{AB}$, and $\angle B$ would be a second right angle in the triangle. If it landed past $B$, then $\triangle CDB$ would have a right angle at $D$ and also an obtuse angle at $B$ (the supplement of the acute $\angle ABC$), which is too much for one triangle. The same arguments rule out $D = A$ and $D$ past $A$.`,
        },
        {
          kind: "diagram",
          view: [-0.6, 5.6, -0.7, 3],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 5, y: 0, dir: "se" },
            { name: "C", x: 3.2, y: 2.4, dir: "n" },
            { name: "D", x: 3.2, y: 0, dir: "s" },
          ],
          segments: [
            { from: "A", to: "B", label: "c" },
            { from: "B", to: "C", label: "a" },
            { from: "C", to: "A", label: "b" },
            { from: "C", to: "D", dashed: true },
          ],
          angles: [
            { at: "C", from: "A", to: "B", right: true },
            { at: "D", from: "B", to: "C", right: true },
            { at: "A", from: "B", to: "C", arcs: 1 },
            { at: "B", from: "C", to: "A", arcs: 2 },
          ],
          caption: md`$\triangle ACB$ with the altitude $\overline{CD}$. $\triangle ADC$ shares $\angle A$ (one arc) with the whole triangle, and $\triangle BDC$ shares $\angle B$ (two arcs).`,
        },
        {
          kind: "proof",
          title: "The Pythagorean Theorem, by similar triangles",
          given: md`$\triangle ABC$ with $\angle ACB = 90^\circ$, and the altitude $\overline{CD}$ to the hypotenuse, with $D$ between $A$ and $B$.`,
          prove: md`$AC^2 + BC^2 = AB^2$`,
          steps: [
            { statement: md`$\angle ADC = 90^\circ$ and $\angle BDC = 90^\circ$`, reason: md`Definition of altitude: $\overline{CD} \perp \overline{AB}$` },
            { statement: md`$\angle A = \angle A$`, reason: md`Reflexive Property of Equality` },
            { statement: md`$\triangle ADC \sim \triangle ACB$`, reason: md`AA Similarity Postulate: $\angle ADC = \angle ACB = 90^\circ$ and the shared $\angle A$` },
            { statement: md`$\dfrac{AD}{AC} = \dfrac{AC}{AB}$`, reason: md`Corresponding sides of similar triangles are proportional` },
            { statement: md`$AC^2 = AD \cdot AB$`, reason: md`Cross products (multiply both sides by $AC \cdot AB$)` },
            { statement: md`$\triangle BDC \sim \triangle BCA$`, reason: md`AA Similarity Postulate: $\angle BDC = \angle BCA = 90^\circ$ and the shared $\angle B$` },
            { statement: md`$\dfrac{BD}{BC} = \dfrac{BC}{BA}$, so $BC^2 = BD \cdot AB$`, reason: md`Corresponding sides are proportional; cross products` },
            { statement: md`$AC^2 + BC^2 = AD \cdot AB + BD \cdot AB$`, reason: md`Addition Property of Equality (add steps 5 and 7)` },
            { statement: md`$AC^2 + BC^2 = (AD + BD) \cdot AB$`, reason: md`Distributive Property` },
            { statement: md`$AD + BD = AB$`, reason: md`Segment Addition Postulate ($D$ is between $A$ and $B$)` },
            { statement: md`$AC^2 + BC^2 = AB \cdot AB = AB^2$`, reason: md`Substitution` },
          ],
        },
        {
          kind: "example",
          title: "Finding a hypotenuse",
          problem: md`A right triangle has legs 5 and 12. Find the hypotenuse.`,
          steps: [
            { math: md`c^2 = 5^2 + 12^2`, note: "The legs go on one side, the hypotenuse alone on the other." },
            { math: md`c^2 = 25 + 144 = 169`, note: "" },
            { math: md`c = 13`, note: md`Square root property. $c$ is a length, so it's positive: $-13$ doesn't count.` },
          ],
        },
        {
          kind: "example",
          title: "Finding a leg, exactly",
          problem: md`A right triangle has hypotenuse 6 and one leg 4. Find the other leg.`,
          steps: [
            { math: md`x^2 + 4^2 = 6^2`, note: md`The unknown is a leg, so it goes with the other leg. The most common mistake is adding $4^2 + 6^2$: the hypotenuse is always the one alone.` },
            { math: md`x^2 = 36 - 16 = 20`, note: "Subtract 16 from both sides." },
            { math: md`x = \sqrt{20} = \sqrt{4} \cdot \sqrt{5} = 2\sqrt{5}`, note: md`Pull out the largest perfect square. A calculator says $4.47\ldots$, but $2\sqrt{5}$ is the exact length. If a root lands in a denominator, rationalize it as in Algebra 1: multiply top and bottom by that root.` },
          ],
        },
        {
          kind: "check",
          prompt: md`A right triangle has hypotenuse 10 and one leg 6. Find the other leg.`,
          answer: "8",
          explain: md`$x^2 + 6^2 = 10^2$, so $x^2 = 100 - 36 = 64$ and $x = 8$.`,
        },
        {
          kind: "key",
          title: "The converse, and classifying by sides",
          body: md`**Converse of the Pythagorean Theorem.** If the sides of a triangle satisfy $a^2 + b^2 = c^2$, then it is a right triangle, and the right angle is opposite $c$.

**Classifying a triangle by its sides.** Let $c$ be the longest side.

- $c^2 < a^2 + b^2$: an **acute** triangle.
- $c^2 = a^2 + b^2$: a **right** triangle.
- $c^2 > a^2 + b^2$: an **obtuse** triangle.`,
        },
        {
          kind: "proof",
          title: "Converse of the Pythagorean Theorem",
          given: md`$\triangle ABC$ with $BC = a$, $CA = b$, $AB = c$, and $a^2 + b^2 = c^2$.`,
          prove: md`$\angle C = 90^\circ$`,
          steps: [
            { statement: md`Draw $\triangle DEF$ with $\angle F = 90^\circ$, $EF = a$ and $FD = b$.`, reason: md`Protractor Postulate (make a $90^\circ$ angle) and Ruler Postulate (mark the lengths)` },
            { statement: md`$DE^2 = a^2 + b^2$`, reason: md`Pythagorean Theorem in the right triangle $DEF$` },
            { statement: md`$DE^2 = c^2$`, reason: md`Substitution (given $a^2 + b^2 = c^2$)` },
            { statement: md`$DE = c$`, reason: md`Both are positive lengths with equal squares` },
            { statement: md`$\triangle ABC \cong \triangle DEF$`, reason: md`SSS Postulate: $BC = EF$, $CA = FD$, $AB = DE$` },
            { statement: md`$\angle C = \angle F = 90^\circ$`, reason: md`CPCTC` },
          ],
        },
        {
          kind: "diagram",
          view: [-3.4, 5, -1, 3.6],
          params: [{ name: "t", tex: "\\angle C", min: 20, max: 150, step: 1, value: 110 }],
          points: [
            { name: "C", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 4, y: 0, dir: "s" },
            { name: "B", x: "3cos(t pi/180)", y: "3sin(t pi/180)", dir: "n" },
            { name: "H", x: "3cos(t pi/180)", y: 0, label: "" },
          ],
          segments: [
            { from: "C", to: "A", kind: "line", color: 3 },
            { from: "C", to: "B", label: "a" },
            { from: "B", to: "A", label: "c" },
            { from: "B", to: "H", dashed: true, color: 2 },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          angles: [
            { at: "C", from: "A", to: "B" },
            { at: "H", from: "A", to: "B", right: true, color: 2 },
          ],
          labels: [
            // Past where H can reach (3cos(20 degrees) = 2.82), so the two labels never meet.
            { x: 3.45, y: -0.55, text: "b" },
            // H's label sits lower than C's, so the two never collide as H slides past C.
            { x: "3cos(t pi/180)", y: -0.55, text: "H" },
            // The angle's label on its bisector, pushed out for small angles so it clears both sides:
            // r = max(0.59, 0.26 / sin(t/2)), written with abs.
            {
              x: "(0.59 + 0.26/sin(t pi/360) + abs(0.59 - 0.26/sin(t pi/360)))/2 * cos(t pi/360)",
              y: "(0.59 + 0.26/sin(t pi/360) + abs(0.59 - 0.26/sin(t pi/360)))/2 * sin(t pi/360)",
              text: "{t}^\\circ",
            },
          ],
          readouts: [
            { label: md`a^2 + b^2`, value: "3^2 + 4^2" },
            { label: md`c^2`, value: "(3cos(t pi/180) - 4)^2 + (3sin(t pi/180))^2" },
          ],
          caption: md`Open and close the angle at $C$ while $a = 3$ and $b = 4$ stay fixed. Past $90^\circ$, the foot $H$ of the dashed altitude falls outside the triangle and $c^2$ climbs above $a^2 + b^2$. Below $90^\circ$, $c^2$ drops below it.`,
        },
        {
          kind: "why",
          title: "Why the comparison tells you the angle",
          body: md`Drop the altitude from $B$ to line $\overleftrightarrow{CA}$, with foot $H$. Call $h = BH$ and $x = CH$. In right $\triangle BHC$, $x^2 + h^2 = a^2$.

- If $\angle C$ is **obtuse**, $H$ lands on the far side of $C$, away from $A$. (On the near side, $\triangle BHC$ would hold a right angle and an obtuse angle, more than $180^\circ$.) Then $AH = b + x$, so
$$c^2 = (b + x)^2 + h^2 = b^2 + 2bx + (x^2 + h^2) = a^2 + b^2 + 2bx > a^2 + b^2.$$
- If $\angle C$ is **acute**, $H$ lands on ray $\overrightarrow{CA}$. (On the far side, $\triangle BHC$ would hold a right angle at $H$ and the obtuse supplement of $\angle C$, more than $180^\circ$. And $H \ne C$, or $\angle C$ would be right, so $x > 0$.) Then $AH = |b - x|$, and
$$c^2 = (b - x)^2 + h^2 = a^2 + b^2 - 2bx < a^2 + b^2.$$
- If $\angle C$ is right, $c^2 = a^2 + b^2$ by the theorem.

Each kind of angle gives a different comparison, so the comparison tells you which kind of angle you have. That also proves the converse a second way. To classify a whole triangle, test the angle opposite the **longest** side: it's the largest angle, so if it is acute, all three are.`,
        },
        {
          kind: "text",
          body: md`**Pythagorean triples.** Whole numbers that fit $a^2 + b^2 = c^2$ are called **Pythagorean triples**. The famous ones are $3, 4, 5$ and $5, 12, 13$, then $8, 15, 17$ and $7, 24, 25$. Any multiple of a triple is a triple too: $6, 8, 10$ is $3, 4, 5$ scaled by 2, since $(2a)^2 + (2b)^2 = 4(a^2 + b^2) = (2c)^2$. Recognizing them saves work.`,
        },
        {
          kind: "why",
          title: "A recipe for new triples",
          body: md`Pick whole numbers $m > n > 0$ and set $a = m^2 - n^2$, $b = 2mn$, $c = m^2 + n^2$. Then

$$a^2 + b^2 = m^4 - 2m^2n^2 + n^4 + 4m^2n^2 = m^4 + 2m^2n^2 + n^4 = (m^2 + n^2)^2 = c^2.$$

$m = 2, n = 1$ gives $3, 4, 5$. $m = 3, n = 2$ gives $5, 12, 13$. $m = 4, n = 1$ gives $15, 8, 17$. Every choice gives a triple, including ones like $8, 15, 17$ that aren't multiples of a smaller triple, and it's only algebra from Algebra 1.`,
        },
        {
          kind: "check",
          prompt: md`A triangle has sides 7, 8 and 12. Is it acute, right or obtuse?`,
          choices: ["acute", "right", "obtuse"],
          accept: ["obtuse"],
          explain: md`The longest side is 12, and $12^2 = 144$. The others give $7^2 + 8^2 = 49 + 64 = 113$. Since $144 > 113$, the angle opposite 12 is obtuse.`,
        },
      ],
      practice: [pythagoreanEquation, rightTriangleStories, classifyTriangle],
    },
    {
      id: "special-right-triangles",
      title: "Special right triangles",
      summary: "The 45-45-90 and 30-60-90 triangles, derived from half a square and half an equilateral triangle.",
      blocks: [
        {
          kind: "text",
          body: md`Two right triangles come up so often that it pays to know their sides by heart. There's nothing to memorize blindly, though. Each one is half of a shape you already know, and the Pythagorean Theorem does the rest. They are named by their angles: the **45-45-90** triangle and the **30-60-90** triangle.`,
        },
        {
          kind: "diagram",
          view: [-1, 5, -1, 5],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 4, y: 0, dir: "se" },
            { name: "C", x: 4, y: 4, dir: "ne" },
            { name: "D", x: 0, y: 4, dir: "nw" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["A", "C", "D"] },
          ],
          segments: [
            { from: "A", to: "B", label: "x", ticks: 1 },
            { from: "B", to: "C", label: "x", ticks: 1 },
            { from: "A", to: "C", color: 1 },
          ],
          angles: [
            { at: "B", from: "A", to: "C", right: true },
            { at: "A", from: "B", to: "C", label: md`45^\circ` },
            { at: "C", from: "A", to: "B", label: md`45^\circ` },
          ],
          labels: [{ x: 2.3, y: 1.7, text: md`x\sqrt{2}` }],
          caption: md`Square $ABCD$ with side $x$, cut along the diagonal $\overline{AC}$. Each half is a 45-45-90 triangle.`,
        },
        {
          kind: "why",
          title: "Half a square",
          body: md`Cut a square with side $x$ along a diagonal. Each half is a right triangle (the square's corner is $90^\circ$) with two legs of length $x$, so it is isosceles. By the Isosceles Triangle Theorem its two acute angles are equal, and by the Triangle Angle Sum Theorem they add to $90^\circ$. So each is $45^\circ$.

For the hypotenuse $d$:

$$d^2 = x^2 + x^2 = 2x^2, \qquad d = \sqrt{2} \cdot \sqrt{x^2} = x\sqrt{2}.$$

The last step uses $\sqrt{x^2} = x$, which holds because $x$ is a positive length.

Going the other way, any 45-45-90 triangle has two equal angles, so by the converse of the Isosceles Triangle Theorem its legs are equal. The same computation then gives its hypotenuse.`,
        },
        {
          kind: "key",
          title: "The 45-45-90 triangle",
          body: md`The legs are equal, and

$$\text{hypotenuse} = \text{leg} \cdot \sqrt{2}.$$

Going the other way, $\text{leg} = \dfrac{\text{hypotenuse}}{\sqrt{2}}$.`,
        },
        {
          kind: "example",
          title: "From the hypotenuse back to a leg",
          problem: md`A 45-45-90 triangle has hypotenuse 10. Find each leg.`,
          steps: [
            { math: md`x\sqrt{2} = 10`, note: "Leg times the square root of 2 is the hypotenuse." },
            { math: md`x = \frac{10}{\sqrt{2}}`, note: md`Divide both sides by $\sqrt{2}$.` },
            { math: md`x = \frac{10}{\sqrt{2}} \cdot \frac{\sqrt{2}}{\sqrt{2}} = \frac{10\sqrt{2}}{2}`, note: md`Multiply by $\frac{\sqrt{2}}{\sqrt{2}}$, which is 1. On the bottom, $\sqrt{2} \cdot \sqrt{2} = 2$.` },
            { math: md`x = 5\sqrt{2}`, note: "Reduce." },
          ],
        },
        {
          kind: "why",
          title: "Why clear the root from the denominator?",
          body: md`$\frac{10}{\sqrt{2}}$ and $5\sqrt{2}$ are the same number. Check: $5\sqrt{2} \cdot \sqrt{2} = 5 \cdot 2 = 10$. Multiplying by $\frac{\sqrt{2}}{\sqrt{2}}$ is multiplying by 1, so it can't change the value. This step is **rationalizing the denominator**, from Algebra 1.

The rationalized form is the standard one because it's easier to compare and estimate: with $\sqrt{2} \approx 1.414$, you can see at once that $5\sqrt{2} \approx 7.07$. PolyMath asks for that form.`,
        },
        {
          kind: "check",
          prompt: md`A 45-45-90 triangle has legs of length 6. Find its hypotenuse. Give an exact answer (type $\sqrt{2}$ as sqrt(2)).`,
          answer: "6sqrt(2)",
          simplified: true,
          explain: md`Hypotenuse = leg times $\sqrt{2}$, so it's $6\sqrt{2}$. Check: $6^2 + 6^2 = 72$ and $(6\sqrt{2})^2 = 36 \cdot 2 = 72$.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 4.8, -0.8, 4.2],
          points: [
            { name: "A", x: 2, y: "2sqrt(3)", dir: "n" },
            { name: "B", x: 0, y: 0, dir: "sw" },
            { name: "C", x: 4, y: 0, dir: "se" },
            { name: "D", x: 2, y: 0, dir: "s" },
          ],
          polygons: [{ points: ["A", "B", "D"], fill: 1 }],
          segments: [
            { from: "A", to: "B", label: "2x", ticks: 1 },
            { from: "A", to: "C", label: "2x", ticks: 1 },
            { from: "B", to: "D", label: "x" },
            { from: "D", to: "C", label: "x" },
            { from: "A", to: "D", dashed: true },
          ],
          angles: [
            { at: "B", from: "D", to: "A", label: md`60^\circ` },
            { at: "A", from: "B", to: "D", label: md`30^\circ` },
            { at: "D", from: "C", to: "A", right: true },
          ],
          labels: [{ x: 2.45, y: 1.3, text: md`x\sqrt{3}` }],
          caption: md`Equilateral $\triangle ABC$ with side $2x$ and the altitude $\overline{AD}$. The shaded half is a 30-60-90 triangle.`,
        },
        {
          kind: "proof",
          title: "Half an equilateral triangle",
          given: md`Equilateral $\triangle ABC$ with side $2x$, and $\overline{AD} \perp \overline{BC}$ with $D$ on $\overline{BC}$.`,
          prove: md`$BD = x$, $\angle B = 60^\circ$ and $\angle BAD = 30^\circ$`,
          steps: [
            { statement: md`$AB = AC$`, reason: md`Definition of an equilateral triangle` },
            { statement: md`$\angle ADB = \angle ADC = 90^\circ$`, reason: md`Definition of perpendicular` },
            { statement: md`$AD = AD$`, reason: md`Reflexive Property of Equality` },
            { statement: md`$\triangle ADB \cong \triangle ADC$`, reason: md`HL: hypotenuses $\overline{AB}$ and $\overline{AC}$, shared leg $\overline{AD}$` },
            { statement: md`$BD = DC$`, reason: md`CPCTC` },
            { statement: md`$BD + DC = BC = 2x$`, reason: md`Segment Addition Postulate` },
            { statement: md`$2 \cdot BD = 2x$, so $BD = x$`, reason: md`Substitution, then the Division Property of Equality` },
            { statement: md`$\angle B = 60^\circ$`, reason: md`An equilateral triangle is equiangular, and its three equal angles sum to $180^\circ$` },
            { statement: md`$\angle BAD = 180^\circ - 90^\circ - 60^\circ = 30^\circ$`, reason: md`Triangle Angle Sum Theorem in $\triangle ADB$` },
          ],
        },
        {
          kind: "why",
          title: "The long leg",
          body: md`The proof gives the short leg $BD = x$ and the hypotenuse $AB = 2x$. The Pythagorean Theorem gives the long leg $L = AD$:

$$x^2 + L^2 = (2x)^2 = 4x^2, \qquad L^2 = 3x^2, \qquad L = x\sqrt{3}.$$

The short leg is **half the hypotenuse**. That fact is the heart of this triangle, and it comes straight from the equilateral triangle being cut in half.

It holds in **every** 30-60-90 triangle, not just ones drawn inside an equilateral triangle. Any two 30-60-90 triangles have two pairs of equal angles, so they are similar by AA. Their sides are in the same ratio $1 : \sqrt{3} : 2$ as the half we just measured.`,
        },
        {
          kind: "key",
          title: "The 30-60-90 triangle",
          body: md`- **Short leg** $x$, opposite the $30^\circ$ angle.
- **Long leg** $x\sqrt{3}$, opposite the $60^\circ$ angle.
- **Hypotenuse** $2x$, opposite the right angle.

Larger sides face larger angles (Unit 3), so the short leg is always the one opposite $30^\circ$. Whatever side you're given, find the short leg first.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 6, -0.8, 3.8],
          points: [
            { name: "R", x: 0, y: 0, dir: "sw" },
            { name: "S", x: 0, y: 3, dir: "nw" },
            { name: "T", x: "3sqrt(3)", y: 0, dir: "se" },
          ],
          segments: [
            { from: "R", to: "S", label: "3" },
            { from: "R", to: "T", label: md`3\sqrt{3}` },
            { from: "S", to: "T", label: "6" },
          ],
          polygons: [{ points: ["R", "S", "T"] }],
          angles: [
            { at: "R", from: "T", to: "S", right: true },
            { at: "T", from: "S", to: "R", label: md`30^\circ` },
            { at: "S", from: "R", to: "T", label: md`60^\circ` },
          ],
          caption: md`The same shape lying down, with short leg 3. The short leg $\overline{RS}$ sits across from the $30^\circ$ angle at $T$, wherever the triangle is turned.`,
        },
        {
          kind: "example",
          title: "Starting from the long leg",
          problem: md`In a 30-60-90 triangle the long leg is 9. Find the short leg and the hypotenuse.`,
          steps: [
            { math: md`x\sqrt{3} = 9`, note: md`Long leg = short leg times $\sqrt{3}$.` },
            { math: md`x = \frac{9}{\sqrt{3}} \cdot \frac{\sqrt{3}}{\sqrt{3}} = \frac{9\sqrt{3}}{3} = 3\sqrt{3}`, note: "Divide, then rationalize the denominator." },
            { math: md`\text{hypotenuse} = 2x = 6\sqrt{3}`, note: "Twice the short leg." },
          ],
        },
        {
          kind: "example",
          title: "The height of an equilateral triangle",
          problem: md`An equilateral triangle has side 8. Find its height.`,
          steps: [
            { math: md`\text{short leg} = 4, \quad \text{hypotenuse} = 8`, note: "The altitude splits it into two 30-60-90 triangles. A side is the hypotenuse, and half the base is the short leg." },
            { math: md`h = 4\sqrt{3}`, note: "The height is the long leg." },
          ],
        },
        {
          kind: "check",
          prompt: md`In a 30-60-90 triangle the hypotenuse is 14. Find the long leg. Give an exact answer (type $\sqrt{3}$ as sqrt(3)).`,
          answer: "7sqrt(3)",
          simplified: true,
          explain: md`The short leg is half the hypotenuse, 7. The long leg is $7\sqrt{3}$.`,
        },
      ],
      practice: [fortyFive, thirtySixty, specialApplications],
    },
    {
      id: "distance-in-the-plane",
      title: "Distance in the plane",
      summary: "The Distance Formula is the Pythagorean Theorem on a grid, and the Midpoint Formula averages the coordinates.",
      blocks: [
        {
          kind: "text",
          body: md`On a coordinate grid, horizontal and vertical distances are easy. The points $(1, 2)$ and $(7, 2)$ lie on the horizontal line $y = 2$, which works like a number line, so by the Ruler Postulate the distance between them is $|7 - 1| = 6$.

Slanted segments are harder: you can't read their length off the grid. But every slanted segment is the hypotenuse of a right triangle whose legs run along the grid.`,
        },
        {
          kind: "diagram",
          view: [-1, 9, -1, 11],
          grid: true,
          points: [
            { name: "A", x: 1, y: 2, label: md`A(1, 2)`, dir: "s" },
            { name: "B", x: 7, y: 10, label: md`B(7, 10)`, dir: "n" },
            { name: "C", x: 7, y: 2, label: md`C(7, 2)`, dir: "s" },
          ],
          segments: [
            { from: "A", to: "B", color: 1 },
            { from: "A", to: "C", label: "6", color: 2 },
            { from: "C", to: "B", label: "8", color: 2 },
          ],
          angles: [{ at: "C", from: "A", to: "B", right: true }],
          caption: md`To get from $A$ to $B$, go 6 across and 8 up. Those moves are the legs of a right triangle with $\overline{AB}$ as its hypotenuse.`,
        },
        {
          kind: "example",
          title: "Distance from the right triangle",
          problem: md`Find the distance from $A(1, 2)$ to $B(7, 10)$.`,
          steps: [
            { math: md`AC = 7 - 1 = 6, \qquad CB = 10 - 2 = 8`, note: md`Use the corner $C(7, 2)$: same $x$ as $B$, same $y$ as $A$.` },
            { math: md`AB^2 = 6^2 + 8^2 = 100`, note: "Pythagorean Theorem." },
            { math: md`AB = 10`, note: "Positive square root." },
          ],
        },
        {
          kind: "key",
          title: "The Distance Formula",
          body: md`The distance between $A(x_1, y_1)$ and $B(x_2, y_2)$ is

$$AB = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}.$$`,
        },
        {
          kind: "proof",
          title: "The Distance Formula",
          given: md`Points $A(x_1, y_1)$ and $B(x_2, y_2)$ with $x_1 \ne x_2$ and $y_1 \ne y_2$.`,
          prove: md`$AB = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$`,
          steps: [
            { statement: md`Let $C$ be the point $(x_2, y_1)$.`, reason: md`Every pair of coordinates names a point of the plane` },
            { statement: md`$AC = |x_2 - x_1|$`, reason: md`Ruler Postulate: $A$ and $C$ lie on the horizontal line $y = y_1$, a number line in $x$` },
            { statement: md`$BC = |y_2 - y_1|$`, reason: md`Ruler Postulate: $B$ and $C$ lie on the vertical line $x = x_2$` },
            { statement: md`$\angle ACB = 90^\circ$`, reason: md`Horizontal and vertical lines are perpendicular` },
            { statement: md`$AB^2 = AC^2 + BC^2$`, reason: md`Pythagorean Theorem` },
            { statement: md`$AB^2 = (x_2 - x_1)^2 + (y_2 - y_1)^2$`, reason: md`Substitution, and $|u|^2 = u^2$` },
            { statement: md`$AB = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$`, reason: md`$AB$ is a positive length, so it is the positive square root` },
          ],
        },
        {
          kind: "why",
          title: "Why no absolute values, and why order doesn't matter",
          body: md`The legs are $|x_2 - x_1|$ and $|y_2 - y_1|$, but squaring makes the absolute values unnecessary, because $|u|^2 = u^2$ for every number $u$.

For the same reason you can subtract in either order: $(x_1 - x_2)^2 = (x_2 - x_1)^2$, since a number and its opposite have the same square. And the formula still works when the points line up horizontally or vertically. If $y_1 = y_2$, it gives $\sqrt{(x_2 - x_1)^2} = |x_2 - x_1|$, the Ruler Postulate distance.`,
        },
        {
          kind: "diagram",
          view: [-6, 7, -5, 7],
          grid: true,
          params: [
            { name: "p", tex: "x_2", min: -5, max: 6, step: 1, value: 4 },
            { name: "q", tex: "y_2", min: -4, max: 6, step: 1, value: 6 },
          ],
          points: [
            { name: "A", x: -2, y: -1, label: md`A(-2, -1)`, dir: "s" },
            { name: "B", x: "p", y: "q", label: "B({p}, {q})", dir: "ne" },
            { name: "C", x: "p", y: -1, label: "", hidden: true },
          ],
          segments: [
            { from: "A", to: "B", color: 1 },
            { from: "A", to: "C", color: 2, dashed: true },
            { from: "C", to: "B", color: 2, dashed: true },
          ],
          readouts: [
            { label: md`x_2 - x_1`, value: "p + 2" },
            { label: md`y_2 - y_1`, value: "q + 1" },
            { label: md`AB`, value: "sqrt((p + 2)^2 + (q + 1)^2)" },
          ],
          caption: md`Move $B$ with the sliders. The dashed legs change, and the distance follows the formula. Put $B$ to the left of or below $A$: a difference turns negative, and its square doesn't care.`,
        },
        {
          kind: "example",
          title: "With negative coordinates",
          problem: md`Find the distance between $P(-3, 4)$ and $Q(2, -1)$.`,
          steps: [
            { math: md`x_2 - x_1 = 2 - (-3) = 5, \qquad y_2 - y_1 = -1 - 4 = -5`, note: "Subtract carefully: minus a negative is plus." },
            { math: md`PQ = \sqrt{5^2 + (-5)^2} = \sqrt{50}`, note: "Distance Formula." },
            { math: md`PQ = \sqrt{25} \cdot \sqrt{2} = 5\sqrt{2}`, note: "Simplify the root." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the distance between $(-1, 3)$ and $(5, -5)$.`,
          answer: "10",
          simplified: true,
          explain: md`The changes are $5 - (-1) = 6$ and $-5 - 3 = -8$. So the distance is $\sqrt{36 + 64} = \sqrt{100} = 10$.`,
        },
        {
          kind: "text",
          body: md`**Midpoints.** Unit 1 proved that on a number line, the midpoint between coordinates $p$ and $q$ is their average, $\frac{p + q}{2}$. In the plane, do the same thing to each coordinate separately.`,
        },
        {
          kind: "diagram",
          view: [-4.5, 6.5, -1, 8],
          grid: true,
          points: [
            { name: "A", x: -3, y: 1, label: md`A(-3, 1)`, dir: "s" },
            { name: "B", x: 5, y: 7, label: md`B(5, 7)`, dir: "n" },
            { name: "M", x: 1, y: 4, label: "" },
            { name: "C", x: 5, y: 1, label: "", hidden: true },
            { name: "H", x: 1, y: 1, label: "", hidden: true },
            { name: "V", x: 5, y: 4, label: "", hidden: true },
          ],
          segments: [
            { from: "A", to: "B", color: 1 },
            { from: "A", to: "H", ticks: 1, color: 2 },
            { from: "H", to: "C", ticks: 1, color: 2 },
            { from: "C", to: "V", ticks: 2, color: 2 },
            { from: "V", to: "B", ticks: 2, color: 2 },
            { from: "M", to: "H", dashed: true },
            { from: "M", to: "V", dashed: true },
          ],
          // In the empty corner below and right of M: to its left the label would sit on the y-axis.
          labels: [{ x: 1.75, y: 3.6, text: md`M(1, 4)` }],
          caption: md`The midpoint $M$ sits halfway across ($x = \frac{-3 + 5}{2} = 1$) and halfway up ($y = \frac{1 + 7}{2} = 4$).`,
        },
        {
          kind: "key",
          title: "The Midpoint Formula",
          body: md`The midpoint of $\overline{AB}$, for $A(x_1, y_1)$ and $B(x_2, y_2)$, is

$$M = \left(\frac{x_1 + x_2}{2}, \frac{y_1 + y_2}{2}\right).$$`,
        },
        {
          kind: "proof",
          title: "The Midpoint Formula",
          given: md`$A(x_1, y_1)$, $B(x_2, y_2)$, and $M = \left(\frac{x_1 + x_2}{2}, \frac{y_1 + y_2}{2}\right)$.`,
          prove: md`$M$ is the midpoint of $\overline{AB}$.`,
          steps: [
            { statement: md`From $A$ to $M$ the coordinates change by $\frac{x_2 - x_1}{2}$ and $\frac{y_2 - y_1}{2}$, and from $M$ to $B$ by the same amounts.`, reason: md`Subtraction: $\frac{x_1 + x_2}{2} - x_1 = \frac{x_2 - x_1}{2}$ and $x_2 - \frac{x_1 + x_2}{2} = \frac{x_2 - x_1}{2}$` },
            { statement: md`$AM = \sqrt{\frac{(x_2 - x_1)^2 + (y_2 - y_1)^2}{4}} = \frac{1}{2}AB$`, reason: md`Distance Formula, and $\sqrt{\frac{N}{4}} = \frac{\sqrt{N}}{2}$` },
            { statement: md`$MB = \frac{1}{2}AB$`, reason: md`Distance Formula, with the same changes as from $A$ to $M$ (step 1)` },
            { statement: md`$AM = MB$`, reason: md`Transitive Property of Equality` },
            { statement: md`$AM + MB = AB$`, reason: md`Addition: $\frac{1}{2}AB + \frac{1}{2}AB = AB$` },
            { statement: md`$M$ lies on $\overline{AB}$.`, reason: md`Otherwise $AM + MB > AB$: the Triangle Inequality if $M$ is off line $\overleftrightarrow{AB}$, the Segment Addition Postulate if it's on the line past an endpoint` },
            { statement: md`$M$ is the midpoint of $\overline{AB}$.`, reason: md`Definition of midpoint (steps 4 and 6)` },
          ],
        },
        {
          kind: "why",
          title: "Why the proof checks that M is on the segment",
          body: md`Equal distances alone don't make a midpoint. The top vertex of any isosceles triangle with base $\overline{AB}$ is just as far from $A$ as from $B$, and it's nowhere near the middle of $\overline{AB}$. A midpoint has to be equidistant **and** on the segment. Step 6 is what rules out the impostors.`,
        },
        {
          kind: "example",
          title: "Finding an endpoint",
          problem: md`$M(2, -1)$ is the midpoint of $\overline{AB}$, and $A = (-4, 3)$. Find $B$.`,
          steps: [
            { math: md`\frac{-4 + x}{2} = 2, \qquad \frac{3 + y}{2} = -1`, note: md`Call $B = (x, y)$ and use the Midpoint Formula on each coordinate.` },
            { math: md`-4 + x = 4, \qquad 3 + y = -2`, note: "Multiply both sides by 2." },
            { math: md`B = (8, -5)`, note: md`Check with steps: $A$ to $M$ is $(+6, -4)$, and the same step from $M$ gives $(8, -5)$.` },
          ],
        },
        {
          kind: "example",
          title: "Working backward from a distance",
          problem: md`Point $P(x, 7)$ is 10 units from $A(2, 1)$, to the right of $A$. Find $x$.`,
          steps: [
            { math: md`(x - 2)^2 + (7 - 1)^2 = 10^2`, note: md`Distance Formula for $AP = 10$, squared on both sides.` },
            { math: md`(x - 2)^2 + 36 = 100 \;\Rightarrow\; (x - 2)^2 = 64`, note: "Subtract 36." },
            { math: md`x - 2 = \pm 8 \;\Rightarrow\; x = 10 \text{ or } x = -6`, note: md`Square root property: two points on the line $y = 7$ are 10 units from $A$.` },
            { math: md`x = 10`, note: md`$P$ is to the right of $A$, so $x > 2$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the midpoint of $\overline{AB}$ for $A(-5, 2)$ and $B(3, 8)$. Give the point as (x, y).`,
          answer: "(-1, 5)",
          form: "tuple",
          explain: md`Average each coordinate: $\frac{-5 + 3}{2} = -1$ and $\frac{2 + 8}{2} = 5$.`,
        },
      ],
      practice: [distanceBetween, midpointEndpoint, coordinateFromDistance],
    },
  ],
};
