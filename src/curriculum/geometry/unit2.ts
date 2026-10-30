import { poly, signed, type Rng } from "../../math/random";
import { md, type Block, type Figure, type Generator, type PlotSpec, type SeriesColor, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** ax + b as LaTeX and answer text. */
const lin = (a: number, b: number) => poly([[a, "x"], [b, ""]]);

/** An angle given by the expression tex, in degrees: "(2x + 5)^\circ", but "x^\circ" or "3x^\circ" for a bare term. */
const deg = (tex: string) => (/^\d*x$/.test(tex) ? md`${tex}^\circ` : md`(${tex})^\circ`);

/** a(x) + b with x substituted, as LaTeX: "3(12) - 5". */
const sub = (a: number, b: number, x: number) => md`${a === 1 ? x : `${a}(${x})`}${b ? ` ${signed(b)}` : ""}`;

/** An angle in degrees between lo and hi, never 90 (a right angle makes every pair look equal). */
function angleBetween(r: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = r.int(lo, hi);
    if (v !== 90) return v;
  }
}

/**
 * Steps for solving Ax + B = Cx + D (A != C), collecting x on the side with the larger coefficient.
 * Pass C = 0 for a plain number on the right.
 */
function solveSteps(A: number, B: number, C: number, D: number): Step[] {
  const [P, Q, R, S] = A > C ? [A, B, C, D] : [C, D, A, B];
  const x = (S - Q) / (P - R);
  const steps: Step[] = [];
  const left = A > C;
  const show = (lhs: string, rhs: string) => (left ? md`${lhs} = ${rhs}` : md`${rhs} = ${lhs}`);
  if (R !== 0) {
    steps.push({ math: show(lin(P - R, Q), String(S)), note: md`${R > 0 ? "Subtract" : "Add"} $${poly([[Math.abs(R), "x"]])}$ ${R > 0 ? "from" : "to"} both sides.` });
  }
  const undo = md`${Q > 0 ? "Subtract" : "Add"} ${Math.abs(Q)} ${Q > 0 ? "from" : "to"} both sides.`;
  if (P - R === 1) {
    // With R != 0, Q = 0 and x on the left, the step above already reads "x = S".
    if (!(R !== 0 && Q === 0 && left)) steps.push({ math: md`x = ${x}`, note: Q !== 0 ? undo : "" });
    return steps;
  }
  if (Q !== 0) steps.push({ math: show(poly([[P - R, "x"]]), String(S - Q)), note: undo });
  steps.push({ math: md`x = ${x}`, note: md`Divide both sides by ${P - R}.` });
  return steps;
}

// ── Practice figures ────────────────────────────────────────────────────────
//
// Practice figures are built from the generated numbers, in plain coordinates.
// Angle labels are placed here rather than by the renderer, so a long label in
// a narrow angle moves out along the bisector until it clears both sides.

type Pt = { x: number; y: number };
type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DiagramFigure = Extract<Figure, { kind: "diagram" }>;
type View = [number, number, number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const unitVec = (from: Pt, to: Pt): Pt => {
  const l = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / l, y: (to.y - from.y) / l };
};
const cross = (u: Pt, v: Pt) => u.x * v.y - u.y * v.x;

/** Pixels per figure unit for a view, as the diagram renderer computes it. */
const pxPerUnit = (v: View) => Math.min(516 / (v[1] - v[0]), 556 / (v[3] - v[2]));

/** Rough rendered width, in pixels, of a short LaTeX label (KaTeX at the diagram's 14px). */
function texWidth(tex: string): number {
  let w = tex.includes("\\circ") ? 7 : 0;
  for (const ch of tex.replace(/\^\\circ|\\[a-zA-Z]+|[{}^ ]/g, "")) w += "+-=".includes(ch) ? 21 : "()".includes(ch) ? 6.5 : /\d/.test(ch) ? 8.5 : 9.5;
  return w;
}

/** The direction (of the eight) closest to the vector from `from` to `to`, for a point label. */
function dirAway(from: Pt, to: Pt): Dir {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const k = (Math.round(a / (Math.PI / 4)) + 8) % 8;
  return (["e", "ne", "n", "nw", "w", "sw", "s", "se"] as const)[k]!;
}

/**
 * Where to centre the label of the angle at v between the rays toward a and b: the
 * nearest point along the bisector, past the angle mark, where the label's box sits
 * inside the angle. With `bound` (the opposite side of a triangle) the box must also
 * stay on v's side of that line; if it can't, the label goes just outside the vertex.
 */
function angleLabelAt(v: Pt, a: Pt, b: Pt, tex: string, unit: number, bound?: [Pt, Pt]): Pt {
  const ua = unitVec(v, a);
  const ub = unitVec(v, b);
  const bis = unitVec({ x: 0, y: 0 }, { x: ua.x + ub.x, y: ua.y + ub.y });
  const hw = (texWidth(tex) / 2 + 6) / unit;
  const hh = 10 / unit;
  const sa = Math.sign(cross(ua, ub));
  const sb = -sa;
  const inBound = (q: Pt) => !bound || Math.sign(cross(unitVec(bound[0], bound[1]), { x: q.x - bound[0].x, y: q.y - bound[0].y })) === Math.sign(cross(unitVec(bound[0], bound[1]), { x: v.x - bound[0].x, y: v.y - bound[0].y }));
  const fits = (c: Pt) => {
    const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => ({ x: c.x + sx * hw, y: c.y + sy * hh })));
    const nearest = { x: Math.max(c.x - hw, Math.min(v.x, c.x + hw)), y: Math.max(c.y - hh, Math.min(v.y, c.y + hh)) };
    return (
      corners.every((q) => cross(ua, { x: q.x - v.x, y: q.y - v.y }) * sa > 0 && cross(ub, { x: q.x - v.x, y: q.y - v.y }) * sb > 0 && inBound(q)) &&
      Math.hypot(nearest.x - v.x, nearest.y - v.y) * unit >= 26
    );
  };
  for (let d = 30 / unit; d < 320 / unit; d += 2 / unit) {
    const c = { x: v.x + bis.x * d, y: v.y + bis.y * d };
    if (fits(c)) return c;
  }
  const out = Math.abs(bis.x) * hw + Math.abs(bis.y) * hh + 6 / unit;
  return { x: v.x - bis.x * out, y: v.y - bis.y * out };
}

interface FigPoint {
  x: number;
  y: number;
  /** LaTeX label; omit for none. */
  label?: string;
  dir?: Dir;
  hidden?: boolean;
}

interface FigAngle {
  at: string;
  from: string;
  to: string;
  label?: string;
  color?: SeriesColor;
  right?: boolean;
  arcs?: 1 | 2 | 3;
  /** The triangle side opposite `at`, which the label must stay inside. */
  bound?: [string, string];
}

/**
 * A practice diagram from plain coordinates. The view is fitted around the points and
 * the angle labels, which are placed with angleLabelAt.
 */
function practiceFigure(o: {
  points: Record<string, FigPoint>;
  segments?: DiagramFigure["segments"];
  polygons?: DiagramFigure["polygons"];
  angles: FigAngle[];
  labels?: { x: number; y: number; text: string }[];
}): DiagramFigure {
  const pts = Object.values(o.points);
  const box = (extra: { x: number; y: number; hw: number; hh: number }[], pad: number): View => {
    const xs = [...pts.map((p) => [p.x, p.x]), ...extra.map((e) => [e.x - e.hw, e.x + e.hw])].flat();
    const ys = [...pts.map((p) => [p.y, p.y]), ...extra.map((e) => [e.y - e.hh, e.y + e.hh])].flat();
    return [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
  };
  let view = box([], 1.2);
  let placed: { x: number; y: number; text: string; color?: SeriesColor }[] = [];
  for (let pass = 0; pass < 3; pass++) {
    const unit = pxPerUnit(view);
    placed = o.angles
      .filter((a) => a.label)
      .map((a) => {
        const at = o.points[a.at]!;
        const c = angleLabelAt(at, o.points[a.from]!, o.points[a.to]!, a.label!, unit, a.bound && [o.points[a.bound[0]]!, o.points[a.bound[1]]!]);
        return { x: c.x, y: c.y, text: a.label!, color: a.color };
      });
    // Fit the labels with a little room, and leave space for the point names.
    const labelled = box([...placed, ...(o.labels ?? [])].map((l) => ({ x: l.x, y: l.y, hw: (texWidth(l.text) / 2 + 4) / unit, hh: 12 / unit })), 0.45);
    const named = box([], 0.9);
    view = [Math.min(labelled[0], named[0]), Math.max(labelled[1], named[1]), Math.min(labelled[2], named[2]), Math.max(labelled[3], named[3])];
  }
  return {
    kind: "diagram",
    view: view.map(round3) as View,
    points: Object.entries(o.points).map(([name, p]) => ({ name, x: round3(p.x), y: round3(p.y), label: p.label ?? "", dir: p.dir, hidden: p.hidden })),
    segments: o.segments,
    polygons: o.polygons,
    angles: o.angles.map((a) => ({ at: a.at, from: a.from, to: a.to, color: a.color, right: a.right, arcs: a.arcs })),
    labels: [...placed, ...(o.labels ?? [])].map((l) => ({ x: round3(l.x), y: round3(l.y), text: l.text })),
  };
}

/**
 * Corners of a triangle with angle a0 at the bottom-left corner and a1 at the
 * bottom-right, scaled so its larger dimension is `size`.
 */
function triangle(a0: number, a1: number, size = 7): [Pt, Pt, Pt] {
  const d = Math.sin(rad(a1)) / Math.sin(rad(a0 + a1));
  const apex = { x: d * Math.cos(rad(a0)), y: d * Math.sin(rad(a0)) };
  const k = size / Math.max(Math.max(1, apex.x) - Math.min(0, apex.x), apex.y);
  return [{ x: 0, y: 0 }, { x: k, y: 0 }, { x: apex.x * k, y: apex.y * k }];
}

/** Triangle corners as named figure points, each labelled away from the centre. */
function corners(names: [string, string, string], tri: [Pt, Pt, Pt], show = true): Record<string, FigPoint> {
  const c = { x: (tri[0].x + tri[1].x + tri[2].x) / 3, y: (tri[0].y + tri[1].y + tri[2].y) / 3 };
  return Object.fromEntries(names.map((n, i) => [n, { ...tri[i]!, label: show ? n : undefined, dir: dirAway(c, tri[i]!) }]));
}

/** A point `len` along the ray from p away from q (to extend side qp past p). */
const beyond = (q: Pt, p: Pt, len: number): Pt => {
  const u = unitVec(q, p);
  return { x: p.x + u.x * len, y: p.y + u.y * len };
};

/**
 * The transversal layout of the lessons, in numbers: ℓ is y = 3, t crosses it at
 * P at `t` degrees, and m crosses t at Q, turned `u` degrees from horizontal.
 * Angles 1-4 sit at P and 5-8 at Q (upper left, upper right, lower left, lower right).
 * `marks` get arcs; with `numbers`, every angle shows its number.
 */
function crossingFigure(o: {
  t: number;
  u?: number;
  marks?: { n: number; color?: SeriesColor; right?: boolean; label?: string }[];
  numbers?: boolean;
  parallelMarks?: boolean;
  labels?: { x: number; y: number; text: string }[];
}): DiagramFigure {
  const u = o.u ?? 0;
  const view: View = [-6, 6, -2, 5];
  const unit = pxPerUnit(view);
  const dt = { x: Math.cos(rad(o.t)), y: Math.sin(rad(o.t)) };
  const dm = { x: Math.cos(rad(u)), y: Math.sin(rad(u)) };
  const p = (1.5 * dt.x) / dt.y;
  const P = { x: p, y: 3 };
  const Q = { x: -p, y: 0 };
  const along = (V: Pt, d: Pt, s: number) => ({ x: V.x + d.x * s, y: V.y + d.y * s });
  const rays = (V: Pt, dl: Pt) => ({ L: along(V, dl, -1), R: along(V, dl, 1), U: along(V, dt, 1), D: along(V, dt, -1) });
  const rp = rays(P, { x: 1, y: 0 });
  const rq = rays(Q, dm);
  const hidden = (x: number, y: number): FigPoint => ({ x, y, hidden: true });
  const points: Record<string, FigPoint> = {
    P: { ...P },
    Q: { ...Q },
    ...Object.fromEntries(Object.entries(rp).map(([k, v]) => [`P${k}`, hidden(v.x, v.y)])),
    ...Object.fromEntries(Object.entries(rq).map(([k, v]) => [`Q${k}`, hidden(v.x, v.y)])),
    L1: hidden(-6, 3),
    L2: hidden(-3.6, 3),
    M1: hidden(-6, 0),
    M2: hidden(-3.6, 0),
  };
  const RAYS = [["L", "U"], ["R", "U"], ["L", "D"], ["R", "D"]] as const;
  const wedge = (n: number) => {
    const v = n <= 4 ? "P" : "Q";
    const [a, b] = RAYS[(n - 1) % 4]!;
    return { at: v, from: v + a, to: v + b };
  };
  /**
   * Where the number of angle n goes: 36px along the bisector, where the renderer
   * puts an angle label, or further out in a narrow angle until it clears both lines.
   */
  const numberAt = (n: number) => {
    const w = wedge(n);
    const V = points[w.at]!;
    const rays = [unitVec(V, points[w.from]!), unitVec(V, points[w.to]!)];
    const bis = unitVec({ x: 0, y: 0 }, { x: rays[0]!.x + rays[1]!.x, y: rays[0]!.y + rays[1]!.y });
    const hw = (texWidth(String(n)) / 2 + 1) / unit;
    const hh = 7 / unit;
    const clear = (c: Pt) => rays.every((d) => Math.abs(cross(d, { x: c.x - V.x, y: c.y - V.y })) - Math.abs(d.y) * hw - Math.abs(d.x) * hh >= 2 / unit);
    let d = 36 / unit;
    while (!clear({ x: V.x + bis.x * d, y: V.y + bis.y * d }) && d < 120 / unit) d += 2 / unit;
    return { x: round3(V.x + bis.x * d), y: round3(V.y + bis.y * d), text: String(n), moved: d > 36 / unit + 1e-9 };
  };
  const numbers = o.numbers ? [1, 2, 3, 4, 5, 6, 7, 8].map(numberAt) : [];
  // A marked angle keeps its (coloured) number on the arc unless it had to move out.
  const onArc = new Set((o.marks ?? []).filter((m) => !m.right && !m.label && numbers[m.n - 1] && !numbers[m.n - 1]!.moved).map((m) => m.n));
  const numberLabels = numbers.filter((l) => !onArc.has(Number(l.text))).map(({ x, y, text }) => ({ x, y, text }));
  // t's name sits beside it, on the side of the wider angle above ℓ.
  const side = o.t <= 90 ? 1 : -1;
  const tName = { x: round3(P.x + 1.6 * dt.x - (side * dt.y * 16) / unit), y: round3(3 + 1.6 * dt.y + (side * dt.x * 16) / unit), text: "t" };
  const pm = o.parallelMarks ? (1 as const) : undefined;
  const fixPt = (p: FigPoint, name: string) => ({ name, x: round3(p.x), y: round3(p.y), label: "", hidden: p.hidden });
  return {
    kind: "diagram",
    view,
    points: Object.entries(points).map(([name, p]) => fixPt(p, name)),
    segments: [
      { from: "L1", to: "L2", kind: "line", parallel: pm },
      u === 0 ? { from: "M1", to: "M2", kind: "line", parallel: pm } : { from: "Q", to: "QR", kind: "line" },
      { from: "Q", to: "P", kind: "line" },
    ],
    angles: (o.marks ?? []).map((m) => ({ ...wedge(m.n), color: m.color, right: m.right, label: m.right ? undefined : (m.label ?? (onArc.has(m.n) ? String(m.n) : undefined)) })),
    labels: [
      { x: -5.6, y: 3.4, text: md`\ell` },
      { x: -5.6, y: round3((-5.6 - Q.x) * Math.tan(rad(u)) + 0.4), text: "m" },
      tName,
      ...numberLabels,
      ...(o.labels ?? []),
    ],
  };
}

/** The tilt of t that gives angle n the size v when ℓ and m are parallel. */
const tiltFor = (n: number, v: number) => ([2, 3, 6, 7].includes(n) ? v : 180 - v);

/** All eight angles numbered, with angles i (orange) and j (green) marked. Parallel marks unless `generic`. */
const pairFigure = (i: number, j: number, t: number, u = 0, generic = false) =>
  crossingFigure({ t, u, numbers: true, parallelMarks: !generic, marks: [{ n: i, color: 2 }, { n: j, color: 3 }] });

/** Two angle expressions that are equal, or that add to 180. */
const pairEquation = (e1: string, e2: string, equal: boolean) => (equal ? `${e1} = ${e2}` : `(${e1}) + (${e2}) = 180`);

// ── The standard transversal figure ─────────────────────────────────────────
//
// Line l is y = 3, line m passes through Q = (qx, 0), and the transversal t
// passes through (0, 1.5) at angle t (degrees) to the horizontal, meeting l at
// P. Angles 1-4 sit at P and 5-8 at Q: upper left, upper right, lower left,
// lower right. Line m can be tilted by u degrees about Q.

interface Mark {
  n: number;
  color?: SeriesColor;
  arcs?: 1 | 2 | 3;
  right?: boolean;
  label?: string;
}

function transversalFigure(o: {
  t: string;
  u?: string;
  marks: Mark[];
  parallelMarks?: boolean;
  names?: boolean;
  params?: PlotSpec["params"];
  readouts?: { label: string; value: string; unit?: string }[];
  view?: [number, number, number, number];
  caption: string;
}): Block {
  const u = o.u ?? "0";
  const ct = `cos(${o.t} pi/180)`;
  const st = `sin(${o.t} pi/180)`;
  const cu = `cos(${u} pi/180)`;
  const su = `sin(${u} pi/180)`;
  const px = `1.5${ct}/${st}`;
  const qx = `-1.5${ct}/${st}`;
  const sg = `(${ct} + 0.001)/abs(${ct} + 0.001)`;
  const flat = u === "0";
  const hidden = (name: string, x: string | number, y: string | number) => ({ name, x, y, label: "", hidden: true });
  const points = [
    { name: "P", x: px, y: 3, label: o.names ? "P" : "", dir: "nw" as const },
    { name: "Q", x: qx, y: 0, label: o.names ? "Q" : "", dir: flat ? ("nw" as const) : ("s" as const) },
    hidden("PL", `${px} - 1`, 3),
    hidden("PR", `${px} + 1`, 3),
    hidden("PU", `${px} + ${ct}`, `3 + ${st}`),
    hidden("PD", `${px} - ${ct}`, `3 - ${st}`),
    hidden("QL", `${qx} - ${cu}`, `-${su}`),
    hidden("QR", `${qx} + ${cu}`, su),
    hidden("QU", `${qx} + ${ct}`, st),
    hidden("QD", `${qx} - ${ct}`, `-${st}`),
    hidden("L1", -6, 3),
    hidden("L2", -3.6, 3),
    hidden("M1", -6, 0),
    hidden("M2", -3.6, 0),
  ];
  const rays: Record<number, [string, string]> = { 0: ["L", "U"], 1: ["R", "U"], 2: ["L", "D"], 3: ["R", "D"] };
  const angles = o.marks.map((mk) => {
    const v = mk.n <= 4 ? "P" : "Q";
    const [a, b] = rays[(mk.n - 1) % 4]!;
    return { at: v, from: v + a, to: v + b, label: mk.label ?? String(mk.n), color: mk.color, arcs: mk.arcs, right: mk.right };
  });
  const pm = o.parallelMarks ? (1 as const) : undefined;
  return {
    kind: "diagram",
    view: o.view ?? [-6, 6, -2, 5],
    points,
    segments: [
      { from: "L1", to: "L2", kind: "line", parallel: pm },
      flat ? { from: "M1", to: "M2", kind: "line", parallel: pm } : { from: "Q", to: "QR", kind: "line" },
      { from: "Q", to: "P", kind: "line" },
    ],
    angles,
    labels: [
      { x: -5.6, y: 3.4, text: md`\ell` },
      // A turning m keeps its name 3.5 units out along it from Q, clear of where it meets ℓ.
      flat ? { x: -5.6, y: 0.4, text: "m" } : { x: `${qx} - 3.5${cu} - 0.4${su}`, y: `-3.5${su} + 0.4${cu}`, text: "m" },
      // Beside t, on the side of the wider angle above ℓ (sg is 1 up to 90 degrees, then -1).
      { x: `${px} + 1.6${ct} - 0.37${st}*${sg}`, y: `3 + 1.6${st} + 0.37${ct}*${sg}`, text: "t" },
    ],
    params: o.params,
    readouts: o.readouts,
    caption: o.caption,
  };
}

// ── Angle positions and relationships ───────────────────────────────────────

const quad = (n: number) => (n - 1) % 4;
const atL = (n: number) => n <= 4;
/** The angles equal to angle 2; the others equal 180 minus it. */
const family = (n: number) => [2, 3, 6, 7].includes(n);
const interior = (n: number) => (atL(n) ? quad(n) >= 2 : quad(n) < 2);
const leftOfT = (n: number) => quad(n) % 2 === 0;

const TYPE_NAMES = ["corresponding angles", "alternate interior angles", "alternate exterior angles", "same-side interior angles", "vertical angles", "a linear pair"] as const;
const THEOREMS = ["Corresponding Angles Postulate", "Alternate Interior Angles Theorem", "Alternate Exterior Angles Theorem", "Same-Side Interior Angles Theorem"] as const;
const CONVERSES = ["Corresponding Angles Converse", "Alternate Interior Angles Converse", "Alternate Exterior Angles Converse", "Same-Side Interior Angles Converse"] as const;

const PAIRS: [number, number, number][] = [
  [1, 5, 0], [2, 6, 0], [3, 7, 0], [4, 8, 0],
  [3, 6, 1], [4, 5, 1],
  [1, 8, 2], [2, 7, 2],
  [3, 5, 3], [4, 6, 3],
  [1, 4, 4], [2, 3, 4], [5, 8, 4], [6, 7, 4],
  [1, 2, 5], [3, 4, 5], [1, 3, 5], [2, 4, 5], [5, 6, 5], [7, 8, 5], [5, 7, 5], [6, 8, 5],
];

/** The named type of a pair (index into TYPE_NAMES), or -1 for a pair with no name of its own. */
function pairType(i: number, j: number): number {
  const hit = PAIRS.find(([a, b]) => (a === i && b === j) || (a === j && b === i));
  return hit ? hit[2] : -1;
}

function pickPair(r: Rng, type: number): [number, number] {
  const [a, b] = r.pick(PAIRS.filter((p) => p[2] === type));
  return r.next() < 0.5 ? [a, b] : [b, a];
}

/** Why angles i and j (parallel lines) are equal or supplementary, as one note. */
function relationNote(i: number, j: number): string {
  const type = pairType(i, j);
  if (type >= 0 && type <= 2) return md`$\angle ${i}$ and $\angle ${j}$ are ${TYPE_NAMES[type]}, so they are equal by the ${THEOREMS[type]}.`;
  if (type === 3) return md`$\angle ${i}$ and $\angle ${j}$ are same-side interior angles, so they add to $180^\circ$ by the Same-Side Interior Angles Theorem.`;
  if (type === 4) return md`$\angle ${i}$ and $\angle ${j}$ are vertical angles, so they are equal.`;
  if (type === 5) return md`$\angle ${i}$ and $\angle ${j}$ form a linear pair, so they add to $180^\circ$.`;
  // Different crossings, no name: go through the angle corresponding to i.
  const k = atL(i) ? i + 4 : i - 4;
  const vertical = quad(k) + quad(j) === 3;
  return md`$\angle ${i}$ and $\angle ${k}$ are corresponding, so they are equal. Then $\angle ${k}$ and $\angle ${j}$ ${vertical ? md`are vertical angles, so they are equal too` : md`form a linear pair, so they add to $180^\circ$`}.`;
}

function describe(n: number): string {
  const line = atL(n) ? md`$\ell$` : md`$m$`;
  return md`at the crossing with ${line}, ${quad(n) < 2 ? "above" : "below"} ${line} and ${leftOfT(n) ? "left" : "right"} of $t$`;
}

// ── Lesson 1 practice ───────────────────────────────────────────────────────

const identifyPair: Generator = (r) => {
  const type = r.pick([0, 0, 1, 1, 2, 2, 3, 3, 4, 5]);
  const [i, j] = pickPair(r, type);
  const words = r.next() < 0.45;
  const choices = shuffle(r, TYPE_NAMES);
  const spot = (n: number) => md`${atL(n) ? md`$\ell$` : md`$m$`}, ${interior(n) ? "interior" : "exterior"}, ${leftOfT(n) ? "left" : "right"} of $t$`;
  const verdict =
    type === 4
      ? md`Same crossing, opposite each other: **vertical angles**.`
      : type === 5
        ? md`Same crossing, side by side, sharing a ray, with the other sides opposite rays: **a linear pair**.`
        : type === 0
          ? md`Different crossings, same side of $t$, and in the same spot at each crossing: **corresponding angles**.`
          : type === 1
            ? md`Both between the lines, on opposite sides of $t$: **alternate interior angles**.`
            : type === 2
              ? md`Both outside the lines, on opposite sides of $t$: **alternate exterior angles**.`
              : md`Both between the lines, on the same side of $t$: **same-side interior angles**.`;
  const figure = crossingFigure({
    t: angleBetween(r, 50, 130),
    u: r.int(-10, 10),
    numbers: !words,
    marks: words ? [] : [{ n: i, color: 2 }, { n: j, color: 3 }],
  });
  return {
    prompt: words
      ? md`In the figure, lines $\ell$ and $m$ are cut by a transversal $t$. One angle sits ${describe(i)}. The other sits ${describe(j)}. What kind of pair are they?`
      : md`In the figure, lines $\ell$ and $m$ are cut by a transversal $t$. What kind of pair are $\angle ${i}$ and $\angle ${j}$?`,
    figure,
    choices,
    accept: [TYPE_NAMES[type]!],
    hint: "First ask: same crossing or different crossings? Then: between the lines (interior) or outside (exterior), and same side of t or opposite sides?",
    solution: [
      { math: md`\angle ${i}: \text{at } ${atL(i) ? md`\ell` : "m"}`, note: words ? md`The first angle is $\angle ${i}$ in the usual numbering: ${spot(i)}` : spot(i) },
      { math: md`\angle ${j}: \text{at } ${atL(j) ? md`\ell` : "m"}`, note: words ? md`The second is $\angle ${j}$: ${spot(j)}` : spot(j) },
      { math: md`\text{${TYPE_NAMES[type]}}`, note: verdict },
    ],
  };
};

const findAngle: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 2]);
  if (kind === 0) {
    const v = angleBetween(r, 35, 145);
    const i = r.int(1, 8);
    let j = r.int(1, 8);
    while (j === i) j = r.int(1, 8);
    const equal = family(i) === family(j);
    const ans = equal ? v : 180 - v;
    return {
      prompt: md`In the figure, $\ell \parallel m$ and $\angle ${i} = ${v}^\circ$. Find $\angle ${j}$. Give the angle in degrees.`,
      figure: pairFigure(i, j, tiltFor(i, v)),
      answer: String(ans),
      verify: [equal ? `x = ${v}` : `x + ${v} = 180`],
      hint: md`All eight angles come in two sizes. Find a chain of vertical angles, linear pairs and corresponding angles from $\angle ${i}$ to $\angle ${j}$.`,
      solution: [
        { math: equal ? md`\angle ${j} = \angle ${i}` : md`\angle ${i} + \angle ${j} = 180^\circ`, note: relationNote(i, j) },
        { math: equal ? md`\angle ${j} = ${v}^\circ` : md`\angle ${j} = 180^\circ - ${v}^\circ = ${ans}^\circ`, note: "" },
      ],
    };
  }
  // Algebra: angles at different crossings given as expressions.
  let i = r.int(1, 4);
  let j = r.int(5, 8);
  if (r.next() < 0.5) [i, j] = [j, i];
  const equal = family(i) === family(j);
  const x = r.int(8, 30);
  const alpha = angleBetween(r, 40, 140);
  const a = r.int(2, 5);
  const b = alpha - a * x;
  let c = r.int(1, 6);
  while (equal && c === a) c = r.int(1, 6);
  const beta = equal ? alpha : 180 - alpha;
  const d = beta - c * x;
  const [e1, e2] = [lin(a, b), lin(c, d)];
  const eqSteps: Step[] = equal
    ? [{ math: md`${e1} = ${e2}`, note: relationNote(i, j) }, ...solveSteps(a, b, c, d)]
    : [
        { math: md`(${e1}) + (${e2}) = 180`, note: relationNote(i, j) },
        { math: md`${lin(a + c, b + d)} = 180`, note: "Combine like terms." },
        ...solveSteps(a + c, b + d, 0, 180),
      ];
  const findX = kind === 1;
  return {
    prompt: md`In the figure, $\ell \parallel m$, $\angle ${i} = ${deg(e1)}$ and $\angle ${j} = ${deg(e2)}$. Find ${findX ? md`$x$.` : md`$\angle ${i}$. Give the angle in degrees.`}`,
    figure: pairFigure(i, j, tiltFor(i, alpha)),
    answer: String(findX ? x : alpha),
    // For the angle itself, y = angle i, so x = (y - b)/a.
    verify: [findX ? pairEquation(lin(a, b), lin(c, d), equal) : pairEquation("y", `${c}*(y - (${b}))/${a} + (${d})`, equal)],
    hint: md`Decide first: are $\angle ${i}$ and $\angle ${j}$ equal, or do they add to $180^\circ$? Write that equation and solve it.`,
    solution: [
      ...eqSteps,
      { math: md`\angle ${i} = ${sub(a, b, x)} = ${alpha}^\circ`, note: findX ? md`Check: $\angle ${j} = ${beta}^\circ$, and the relationship holds.` : md`Substitute $x = ${x}$ to get the angle. Check: $\angle ${j} = ${beta}^\circ$.` },
    ],
  };
};

const solveTransversal: Generator = (r) => {
  const type = r.int(0, 3);
  const [i, j] = pickPair(r, type);
  const x = r.int(6, 30);
  const alpha = angleBetween(r, 35, 145);
  const a = r.int(2, 6);
  const b = alpha - a * x;
  if (type < 3) {
    let c = r.int(1, 7);
    while (c === a) c = r.int(1, 7);
    const d = alpha - c * x;
    const [e1, e2] = [lin(a, b), lin(c, d)];
    return {
      prompt: md`Solve $${e1} = ${e2}$. In the figure, $\ell \parallel m$, and $\angle ${i} = ${deg(e1)}$ and $\angle ${j} = ${deg(e2)}$ are ${TYPE_NAMES[type]}, so the ${THEOREMS[type]} gives this equation. Give the value of $x$.`,
      figure: pairFigure(i, j, tiltFor(i, alpha)),
      answer: String(x),
      hint: "Collect the x-terms on one side and the plain numbers on the other.",
      solution: [
        ...solveSteps(a, b, c, d),
        { math: md`\angle ${i} = \angle ${j} = ${alpha}^\circ`, note: md`Check: $${sub(a, b, x)} = ${alpha}$ and $${sub(c, d, x)} = ${alpha}$.` },
      ],
    };
  }
  const c = r.int(1, 5);
  const d = 180 - alpha - c * x;
  const [e1, e2] = [lin(a, b), lin(c, d)];
  return {
    prompt: md`Solve $(${e1}) + (${e2}) = 180$. In the figure, $\ell \parallel m$, and $\angle ${i} = ${deg(e1)}$ and $\angle ${j} = ${deg(e2)}$ are same-side interior angles, so they add to $180^\circ$. Give the value of $x$.`,
    figure: pairFigure(i, j, tiltFor(i, alpha)),
    answer: String(x),
    hint: "Combine like terms on the left first.",
    solution: [
      { math: md`${lin(a + c, b + d)} = 180`, note: "Combine like terms." },
      ...solveSteps(a + c, b + d, 0, 180),
      { math: md`\angle ${i} = ${alpha}^\circ, \quad \angle ${j} = ${180 - alpha}^\circ`, note: md`Check: $${alpha} + ${180 - alpha} = 180$.` },
    ],
  };
};

// ── Lesson 2 practice ───────────────────────────────────────────────────────

const NOT_PARALLEL = md`$\ell$ and $m$ are not parallel`;
const NO_INFO = "There isn't enough information to decide";
const CONCLUSIONS = [...CONVERSES.map((c) => md`$\ell \parallel m$, by the ${c}`), NOT_PARALLEL, NO_INFO];

const concludeParallel: Generator = (r) => {
  const type = r.pick([0, 1, 2, 3, 0, 1, 2, 3, 4, 5]);
  const [i, j] = pickPair(r, type);
  const v = angleBetween(r, 35, 145);
  const holds = type >= 4 || r.next() < 0.55;
  let w: number;
  if (type === 4) w = v;
  else if (type === 5) w = 180 - v;
  else {
    const target = type === 3 ? 180 - v : v;
    if (holds) w = target;
    else {
      w = r.next() < 0.5 ? 180 - target : target + r.pick([-4, -3, -2, 2, 3, 4]);
      if (w === target) w = target + 2;
    }
  }
  const correct = type >= 4 ? NO_INFO : holds ? CONCLUSIONS[type]! : NOT_PARALLEL;
  const test = type === 3 || type === 5 ? md`${v}^\circ + ${w}^\circ = ${v + w}^\circ` : md`${v}^\circ ${v === w ? "=" : "\\ne"} ${w}^\circ`;
  const why =
    type >= 4
      ? md`Both angles are at the same crossing, so this relationship holds whether or not the lines are parallel. It says nothing about whether $\ell \parallel m$.`
      : holds
        ? md`That is exactly the condition in the ${CONVERSES[type]}, so $\ell \parallel m$.`
        : type === 3
          ? md`If $\ell \parallel m$, these angles would have to add to $180^\circ$. They don't, so by the contrapositive of the Same-Side Interior Angles Theorem, the lines are not parallel.`
          : md`If $\ell \parallel m$, these angles would have to be equal by the ${THEOREMS[type]}. They aren't, so by the contrapositive, the lines are not parallel.`;
  // The conclusion has to come from the measurements, so the drawing never hints at it:
  // angle i is drawn to scale, and m always gets the same kind of small tilt, whatever the answer.
  const u = r.pick([-1, 1]) * r.int(2, 6);
  const t = tiltFor(i, v) + (atL(i) ? 0 : u);
  return {
    prompt: md`In the figure, lines $\ell$ and $m$ are cut by a transversal $t$. You measure $\angle ${i} = ${v}^\circ$ and $\angle ${j} = ${w}^\circ$. The figure is not drawn to scale. What can you conclude?`,
    figure: pairFigure(i, j, t, u, true),
    choices: shuffle(r, CONCLUSIONS),
    accept: [correct],
    hint: "Name the pair first. Pairs at different crossings test for parallel lines; pairs at the same crossing don't.",
    solution: [
      { math: md`\angle ${i}, \angle ${j}: \text{${TYPE_NAMES[type]}}`, note: type >= 4 ? "They are at the same crossing." : "They are at different crossings." },
      { math: test, note: why },
    ],
  };
};

const solveForParallel: Generator = (r) => {
  const kind = r.int(0, 4);
  const x = r.int(6, 28);
  if (kind === 4) {
    // Perpendicular to the same line.
    const a = r.int(2, 6);
    const b = 90 - a * x;
    return {
      prompt: md`Solve $${lin(a, b)} = 90$. In the figure, line $t$ is perpendicular to $\ell$, and line $m$ crosses $t$ at an angle of $${deg(lin(a, b))}$. This $x$ makes $m \perp t$ too, and two lines perpendicular to the same line are parallel. Give the value of $x$.`,
      figure: crossingFigure({ t: 90, marks: [{ n: 2, right: true }, { n: 6, color: 2 }], labels: [{ x: 1.4, y: 0.5, text: deg(lin(a, b)) }] }),
      answer: String(x),
      hint: "Undo the addition or subtraction first, then divide.",
      solution: [...solveSteps(a, b, 0, 90), { math: md`${sub(a, b, x)} = 90`, note: md`Check. With this $x$, both $\ell$ and $m$ are perpendicular to $t$, so $\ell \parallel m$.` }],
    };
  }
  const type = kind;
  const [i, j] = pickPair(r, type);
  // First angle: either ax + b or a(x + k).
  let alpha = 0;
  let tex1 = "";
  let deg1 = "";
  let A = 0;
  let B = 0;
  const distribute = r.next() < 0.4;
  for (;;) {
    if (distribute) {
      A = r.int(2, 4);
      const k = r.int(-8, 12);
      if (k === 0) continue;
      B = A * k;
      tex1 = md`${A}(${lin(1, k)})`;
      deg1 = md`[${tex1}]^\circ`;
    } else {
      A = r.int(2, 6);
      B = r.int(-30, 40);
      tex1 = lin(A, B);
      deg1 = deg(tex1);
    }
    alpha = A * x + B;
    if (alpha >= 30 && alpha <= 150 && alpha !== 90) break;
  }
  const beta = type === 3 ? 180 - alpha : alpha;
  let C = r.int(1, 6);
  while (type !== 3 && C === A) C = r.int(1, 6);
  const D = beta - C * x;
  const tex2 = lin(C, D);
  const eq = type === 3 ? md`${distribute ? tex1 : md`(${tex1})`} + (${tex2}) = 180` : md`${tex1} = ${tex2}`;
  const steps: Step[] = [];
  if (distribute) steps.push({ math: type === 3 ? md`${lin(A, B)} + ${tex2} = 180` : md`${lin(A, B)} = ${tex2}`, note: "Distribute." });
  if (type === 3) {
    steps.push({ math: md`${lin(A + C, B + D)} = 180`, note: "Combine like terms." }, ...solveSteps(A + C, B + D, 0, 180));
  } else steps.push(...solveSteps(A, B, C, D));
  steps.push({
    math: type === 3 ? md`\angle ${i} = ${alpha}^\circ, \quad \angle ${j} = ${beta}^\circ` : md`\angle ${i} = \angle ${j} = ${alpha}^\circ`,
    note: md`Check. With this $x$ the ${TYPE_NAMES[type]} ${type === 3 ? "add to $180^\\circ$" : "are equal"}, so $\ell \parallel m$ by the ${CONVERSES[type]}.`,
  });
  return {
    prompt: md`Solve $${eq}$. In the figure, lines $\ell$ and $m$ are cut by a transversal, with ${TYPE_NAMES[type]} $\angle ${i} = ${deg1}$ and $\angle ${j} = ${deg(tex2)}$. This equation is the condition in the ${CONVERSES[type]}, so its solution makes $\ell \parallel m$. Give the value of $x$.`,
    figure: pairFigure(i, j, tiltFor(i, alpha), 0, true),
    answer: String(x),
    hint: distribute ? "Distribute first, then collect the x-terms on one side." : "Collect the x-terms on one side and the plain numbers on the other.",
    solution: steps,
  };
};

const makeParallel: Generator = (r) => {
  let i = r.int(1, 4);
  let j = r.int(5, 8);
  if (r.next() < 0.5) [i, j] = [j, i];
  const equal = family(i) === family(j);
  const x = r.int(5, 30);
  const alpha = angleBetween(r, 35, 145);
  const a = r.int(2, 6);
  const b = alpha - a * x;
  let c = r.int(1, 6);
  while (equal && c === a) c = r.int(1, 6);
  const beta = equal ? alpha : 180 - alpha;
  const d = beta - c * x;
  const [e1, e2] = [lin(a, b), lin(c, d)];
  const type = pairType(i, j);
  const reason =
    type >= 0
      ? md`$\angle ${i}$ and $\angle ${j}$ are ${TYPE_NAMES[type]}. By the ${CONVERSES[type]}, the lines are parallel when they ${type === 3 ? "add to $180^\\circ$" : "are equal"}.`
      : (() => {
          const k = atL(i) ? i + 4 : i - 4;
          const vertical = quad(k) + quad(j) === 3;
          return md`No single name fits, so go through $\angle ${k}$, which corresponds to $\angle ${i}$. $\angle ${k}$ and $\angle ${j}$ ${vertical ? "are vertical angles, so they are equal" : "form a linear pair, so they add to $180^\\circ$"} whether or not the lines are parallel. So if $\angle ${i}$ and $\angle ${j}$ ${equal ? "are equal" : "add to $180^\\circ$"}, then $\angle ${i} = \angle ${k}$. Those are equal corresponding angles, and the Corresponding Angles Converse gives $\ell \parallel m$.`;
        })();
  const steps: Step[] = equal
    ? [{ math: md`${e1} = ${e2}`, note: reason }, ...solveSteps(a, b, c, d)]
    : [{ math: md`(${e1}) + (${e2}) = 180`, note: reason }, { math: md`${lin(a + c, b + d)} = 180`, note: "Combine like terms." }, ...solveSteps(a + c, b + d, 0, 180)];
  steps.push({ math: md`\angle ${i} = ${alpha}^\circ, \quad \angle ${j} = ${beta}^\circ`, note: "Check by substituting back." });
  return {
    prompt: md`In the figure, lines $\ell$ and $m$ are cut by a transversal $t$, with $\angle ${i} = ${deg(e1)}$ and $\angle ${j} = ${deg(e2)}$. What value of $x$ makes $\ell \parallel m$?`,
    figure: pairFigure(i, j, tiltFor(i, alpha), 0, true),
    answer: String(x),
    verify: [pairEquation(e1, e2, equal)],
    hint: md`If the lines were parallel, would $\angle ${i}$ and $\angle ${j}$ be equal or add to $180^\circ$? That relationship is the equation to solve.`,
    solution: steps,
  };
};

// ── Lesson 3 practice ───────────────────────────────────────────────────────

const EXT = md`In the figure, side $\overline{BC}$ of $\triangle ABC$ is extended past $C$ to $D$.`;

type Corner = { label?: string; color?: SeriesColor; right?: boolean };

/** A triangle drawn to scale from its two base angles, with marks at the named corners (base left, base right, apex). */
function triangleFigure(names: [string, string, string], a0: number, a1: number, marks: Record<string, Corner>, showNames = true): DiagramFigure {
  const others = (n: string) => names.filter((m) => m !== n) as [string, string];
  return practiceFigure({
    points: corners(names, triangle(a0, a1), showNames),
    polygons: [{ points: names, fill: 1 }],
    angles: Object.entries(marks).map(([n, m]) => ({ at: n, from: others(n)[0], to: others(n)[1], ...m, bound: others(n) })),
  });
}

/** Triangle ABC with angle a at the apex A and b at B, side BC extended past C to D. */
function extendedFigure(a: number, b: number, marks: { A?: Corner; B?: Corner; ACD?: Corner }, showNames = true): DiagramFigure {
  const tri = triangle(b, 180 - a - b);
  const points = corners(["B", "C", "A"], tri, showNames);
  points.C!.dir = "s";
  points.D = { ...beyond(tri[0], tri[1], 3), label: showNames ? "D" : undefined, dir: "se" };
  const angles: FigAngle[] = [];
  if (marks.A) angles.push({ at: "A", from: "B", to: "C", ...marks.A, bound: ["B", "C"] });
  if (marks.B) angles.push({ at: "B", from: "C", to: "A", ...marks.B, bound: ["C", "A"] });
  if (marks.ACD) angles.push({ at: "C", from: "A", to: "D", ...marks.ACD });
  return practiceFigure({ points, polygons: [{ points: ["A", "B", "C"], fill: 1 }], segments: [{ from: "C", to: "D" }], angles });
}

const triangleAngles: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 2, 3]);
  if (kind === 0 || kind === 1) {
    const names = shuffle(r, ["A", "B", "C"]);
    const [p, q, u] = names as [string, string, string];
    const vp = kind === 1 ? 90 : r.int(25, 110);
    const vq = kind === 1 ? r.int(15, 75) : r.int(20, 155 - vp);
    const ans = 180 - vp - vq;
    const size: Record<string, number> = { [p]: vp, [q]: vq, [u]: ans };
    return {
      prompt: kind === 1
        ? md`Find $\angle ${u}$ in the right triangle shown. Give the angle in degrees.`
        : md`Find $\angle ${u}$ in the figure. Give the angle in degrees.`,
      figure: triangleFigure(["A", "B", "C"], size.A!, size.B!, {
        [p]: kind === 1 ? { right: true } : { label: md`${vp}^\circ` },
        [q]: { label: md`${vq}^\circ` },
        [u]: { label: "?", color: 2 },
      }),
      answer: String(ans),
      verify: [`x + ${vp} + ${vq} = 180`],
      hint: kind === 1 ? "The two acute angles of a right triangle add to 90 degrees." : "The three angles add to 180 degrees.",
      solution:
        kind === 1
          ? [
              { math: md`\angle ${q} + \angle ${u} = 90^\circ`, note: "The acute angles of a right triangle are complementary, because the right angle uses up 90 of the 180 degrees." },
              { math: md`\angle ${u} = 90^\circ - ${vq}^\circ = ${ans}^\circ`, note: "" },
            ]
          : [
              { math: md`${vp}^\circ + ${vq}^\circ + \angle ${u} = 180^\circ`, note: "Triangle Angle Sum Theorem." },
              { math: md`\angle ${u} = 180^\circ - ${vp + vq}^\circ = ${ans}^\circ`, note: "Subtract the two known angles." },
            ],
    };
  }
  const a = r.int(25, 85);
  const b = r.int(25, 150 - a);
  const ext = a + b;
  if (kind === 2) {
    return {
      prompt: md`${EXT} Find the exterior angle $\angle ACD$. Give the angle in degrees.`,
      figure: extendedFigure(a, b, { A: { label: md`${a}^\circ` }, B: { label: md`${b}^\circ` }, ACD: { label: "?", color: 2 } }),
      answer: String(ext),
      verify: [`x = ${a} + ${b}`],
      hint: "An exterior angle equals the sum of the two remote interior angles.",
      solution: [
        { math: md`\angle ACD = \angle A + \angle B`, note: md`Exterior Angle Theorem: $\angle A$ and $\angle B$ are the remote interior angles for the exterior angle at $C$.` },
        { math: md`\angle ACD = ${a}^\circ + ${b}^\circ = ${ext}^\circ`, note: md`Check another way: $\angle ACB = 180^\circ - ${ext}^\circ = ${180 - ext}^\circ$, and $${180 - ext}^\circ + ${ext}^\circ = 180^\circ$ along the straight line.` },
      ],
    };
  }
  const known = r.next() < 0.5 ? "A" : "B";
  const kv = known === "A" ? a : b;
  const other = known === "A" ? "B" : "A";
  return {
    prompt: md`${EXT} Find $\angle ${other}$. Give the angle in degrees.`,
    figure: extendedFigure(a, b, { [known]: { label: md`${kv}^\circ` }, [other]: { label: "?", color: 2 }, ACD: { label: md`${ext}^\circ` } }),
    answer: String(ext - kv),
    verify: [`${kv} + x = ${ext}`],
    hint: md`$\angle ACD$ is an exterior angle. Which two angles of the triangle add up to it?`,
    solution: [
      { math: md`\angle ACD = \angle A + \angle B`, note: "Exterior Angle Theorem." },
      { math: md`${ext}^\circ = ${kv}^\circ + \angle ${other}`, note: "Substitute what you know." },
      { math: md`\angle ${other} = ${ext - kv}^\circ`, note: md`Subtract ${kv}.` },
    ],
  };
};

const solveTriangle: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 2]);
  const x = r.int(5, 30);
  /** ax + b with value v at x, coefficient from the list. */
  const expr = (v: number, coefs: number[]) => {
    const a = r.pick(coefs);
    return { a, b: v - a * x, tex: lin(a, v - a * x) };
  };
  if (kind === 0) {
    const al = r.int(30, 100);
    const be = r.int(25, 150 - al);
    const ga = 180 - al - be;
    const [e1, e2, e3] = [expr(al, [1, 2, 3, 4]), expr(be, [1, 2, 3]), expr(ga, [1, 2, 3])];
    const A = e1.a + e2.a + e3.a;
    const B = e1.b + e2.b + e3.b;
    return {
      prompt: md`Solve $(${e1.tex}) + (${e2.tex}) + (${e3.tex}) = 180$. The figure shows the three angles of a triangle, and this equation is the Triangle Angle Sum Theorem. Give the value of $x$.`,
      figure: triangleFigure(["P", "Q", "R"], al, be, { P: { label: deg(e1.tex) }, Q: { label: deg(e2.tex) }, R: { label: deg(e3.tex) } }, false),
      answer: String(x),
      hint: "Combine the x-terms and the numbers on the left first.",
      solution: [
        { math: md`${lin(A, B)} = 180`, note: "Combine like terms." },
        ...solveSteps(A, B, 0, 180),
        { math: md`${al}^\circ + ${be}^\circ + ${ga}^\circ = 180^\circ`, note: "Check: substitute x to get each angle." },
      ],
    };
  }
  if (kind === 1) {
    const al = r.int(25, 80);
    const be = r.int(25, 150 - al);
    const [e1, e2] = [expr(al, [1, 2, 3]), expr(be, [1, 2])];
    let c = r.int(2, 6);
    while (c === e1.a + e2.a) c = r.int(2, 6);
    const ext = { a: c, b: al + be - c * x, tex: lin(c, al + be - c * x) };
    const A = e1.a + e2.a;
    const B = e1.b + e2.b;
    return {
      prompt: md`Solve $${ext.tex} = (${e1.tex}) + (${e2.tex})$. The figure shows an exterior angle of a triangle, $${deg(ext.tex)}$, and its two remote interior angles. This equation is the Exterior Angle Theorem. Give the value of $x$.`,
      figure: extendedFigure(al, be, { A: { label: deg(e1.tex) }, B: { label: deg(e2.tex) }, ACD: { label: deg(ext.tex), color: 3 } }, false),
      answer: String(x),
      hint: "Combine like terms on the right, then collect the x-terms on one side.",
      solution: [
        { math: md`${ext.tex} = ${lin(A, B)}`, note: "Combine like terms on the right." },
        ...solveSteps(c, ext.b, A, B),
        { math: md`${al + be}^\circ = ${al}^\circ + ${be}^\circ`, note: "Check: the exterior angle equals the sum of the remote interior angles." },
      ],
    };
  }
  const al = r.int(20, 70);
  const [e1, e2] = [expr(al, [2, 3, 4]), expr(90 - al, [1, 2, 3])];
  const A = e1.a + e2.a;
  const B = e1.b + e2.b;
  return {
    prompt: md`Solve $(${e1.tex}) + (${e2.tex}) = 90$. The figure shows the acute angles of a right triangle, and they are complementary. Give the value of $x$.`,
    figure: triangleFigure(["P", "Q", "R"], 90, al, { P: { right: true }, Q: { label: deg(e1.tex) }, R: { label: deg(e2.tex) } }, false),
    answer: String(x),
    hint: "Combine like terms on the left first.",
    solution: [
      { math: md`${lin(A, B)} = 90`, note: "Combine like terms." },
      ...solveSteps(A, B, 0, 90),
      { math: md`${al}^\circ + ${90 - al}^\circ = 90^\circ`, note: "Check." },
    ],
  };
};

const RATIOS: [number, number, number][] = [
  [1, 2, 3], [2, 3, 4], [1, 1, 2], [3, 4, 5], [1, 4, 5], [2, 3, 5], [1, 2, 6], [4, 5, 6], [1, 3, 5], [2, 2, 5], [1, 3, 8], [3, 5, 7],
];

const triangleReasoning: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const p = r.int(30, 80);
    const q = r.int(30, 150 - p);
    const s = 180 - p - q;
    const setup = md`In the figure, the line $\overleftrightarrow{DE}$ passes through $B$ parallel to $\overline{AC}$.`;
    // Drawn to scale: angle A = angle DBA = p and angle C = angle CBE = q.
    const parallelFigure = (marks: FigAngle[]) => {
      const tri = triangle(p, q);
      const points = corners(["A", "C", "B"], tri);
      points.B!.dir = "n";
      points.D = { ...tri[2], x: tri[2].x - 3, label: "D", dir: "n" };
      points.E = { ...tri[2], x: tri[2].x + 3, label: "E", dir: "n" };
      return practiceFigure({
        points,
        polygons: [{ points: ["A", "B", "C"], fill: 1 }],
        segments: [{ from: "A", to: "C", parallel: 1 }, { from: "D", to: "B", parallel: 1 }, { from: "B", to: "E" }],
        angles: marks,
      });
    };
    if (r.next() < 0.5) {
      return {
        prompt: md`${setup} Find $\angle ABC$. Give the angle in degrees.`,
        figure: parallelFigure([
          { at: "B", from: "D", to: "A", label: md`${p}^\circ` },
          { at: "B", from: "A", to: "C", label: "?", color: 2, bound: ["A", "C"] },
          { at: "B", from: "C", to: "E", label: md`${q}^\circ` },
        ]),
        answer: String(s),
        verify: [`${p} + x + ${q} = 180`],
        hint: md`The three angles at $B$ sit side by side along the straight line $\overleftrightarrow{DE}$, so they add to $180^\circ$.`,
        solution: [
          { math: md`\angle DBA + \angle ABC + \angle CBE = 180^\circ`, note: md`$\overrightarrow{BD}$ and $\overrightarrow{BE}$ are opposite rays: Linear Pair Postulate plus Angle Addition, as in the proof.` },
          { math: md`\angle ABC = 180^\circ - ${p}^\circ - ${q}^\circ = ${s}^\circ`, note: md`Another route: $\angle A = ${p}^\circ$ and $\angle C = ${q}^\circ$ (alternate interior angles), then the angle sum.` },
        ],
      };
    }
    return {
      prompt: md`${setup} Find $\angle BCA$. Give the angle in degrees.`,
      figure: parallelFigure([
        { at: "B", from: "D", to: "A", label: md`${p}^\circ` },
        { at: "B", from: "A", to: "C", label: md`${s}^\circ`, bound: ["A", "C"] },
        { at: "C", from: "B", to: "A", label: "?", color: 2, bound: ["A", "B"] },
      ]),
      answer: String(q),
      // Angle CBE completes the straight line at B, and it equals angle BCA.
      verify: [`${p} + ${s} + x = 180`],
      hint: md`Find $\angle CBE$ first. Which angle of the triangle is it equal to?`,
      solution: [
        { math: md`\angle CBE = 180^\circ - ${p}^\circ - ${s}^\circ = ${q}^\circ`, note: md`The three angles at $B$ sit side by side along the straight line $\overleftrightarrow{DE}$, so they add to $180^\circ$.` },
        { math: md`\angle BCA = \angle CBE = ${q}^\circ`, note: md`Alternate interior angles: $\overleftrightarrow{DE} \parallel \overleftrightarrow{AC}$ with transversal $\overleftrightarrow{BC}$.` },
      ],
    };
  }
  if (kind === 1) {
    const [p, q, s] = r.pick(RATIOS);
    const k = 180 / (p + q + s);
    const largest = r.next() < 0.6;
    const want = largest ? s * k : p * k;
    return {
      prompt: md`The angles of a triangle are in the ratio $${p} : ${q} : ${s}$. Find the ${largest ? "largest" : "smallest"} angle. Give the angle in degrees.`,
      answer: String(want),
      verify: [`(x/${largest ? s : p})*(${p} + ${q} + ${s}) = 180`],
      hint: md`Call the angles $${poly([[p, "k"]])}$, $${poly([[q, "k"]])}$ and $${poly([[s, "k"]])}$. They add to $180^\circ$.`,
      solution: [
        { math: md`${poly([[p, "k"], [q, "k"], [s, "k"]])} = 180`, note: "Triangle Angle Sum Theorem." },
        { math: md`${p + q + s}k = 180 \Rightarrow k = ${k}`, note: "Combine like terms and divide." },
        { math: md`${p * k}^\circ, \; ${q * k}^\circ, \; ${s * k}^\circ`, note: md`Multiply out. The ${largest ? "largest" : "smallest"} is $${want}^\circ$.` },
      ],
    };
  }
  if (kind === 2) {
    const c = r.int(20, 120);
    const twice = r.next() < 0.5;
    if (twice) {
      const m = r.pick([2, 3, 4]);
      // m*B + B = 180 - c needs (180 - c) divisible by m + 1.
      let cc = c;
      while ((180 - cc) % (m + 1) !== 0) cc++;
      const bv = (180 - cc) / (m + 1);
      return {
        prompt: md`In $\triangle ABC$, $\angle A$ is ${m === 2 ? "twice" : m === 3 ? "three times" : "four times"} $\angle B$, and $\angle C = ${cc}^\circ$. Find $\angle A$. Give the angle in degrees.`,
        answer: String(m * bv),
        verify: [`x + x/${m} + ${cc} = 180`],
        hint: md`Let $\angle B = y$. Then $\angle A = ${m}y$, and all three angles add to $180^\circ$.`,
        solution: [
          { math: md`${m}y + y + ${cc} = 180`, note: md`With $\angle B = y$ and $\angle A = ${m}y$, use the Triangle Angle Sum Theorem.` },
          { math: md`${m + 1}y = ${180 - cc} \Rightarrow y = ${bv}`, note: "Combine like terms, subtract, divide." },
          { math: md`\angle A = ${m}(${bv}) = ${m * bv}^\circ`, note: md`Check: $${m * bv} + ${bv} + ${cc} = 180$.` },
        ],
      };
    }
    const dlt = r.int(5, 40);
    let cc = c;
    while ((180 - cc - dlt) % 2 !== 0 || 180 - cc - dlt < 20) cc = cc > 30 ? cc - 1 : cc + 1;
    const bv = (180 - cc - dlt) / 2;
    return {
      prompt: md`In $\triangle ABC$, $\angle A$ is $${dlt}^\circ$ more than $\angle B$, and $\angle C = ${cc}^\circ$. Find $\angle A$. Give the angle in degrees.`,
      answer: String(bv + dlt),
      verify: [`x + (x - ${dlt}) + ${cc} = 180`],
      hint: md`Let $\angle B = y$. Then $\angle A = y + ${dlt}$, and all three angles add to $180^\circ$.`,
      solution: [
        { math: md`(y + ${dlt}) + y + ${cc} = 180`, note: "Triangle Angle Sum Theorem." },
        { math: md`2y = ${180 - cc - dlt} \Rightarrow y = ${bv}`, note: "Combine like terms, subtract, divide by 2." },
        { math: md`\angle A = ${bv} + ${dlt} = ${bv + dlt}^\circ`, note: md`Check: $${bv + dlt} + ${bv} + ${cc} = 180$.` },
      ],
    };
  }
  const a = r.int(30, 80);
  const b = r.int(30, 150 - a);
  const [e1, e2] = [180 - a, 180 - b];
  return {
    prompt: md`The figure shows the exterior angles of $\triangle ABC$ at $A$ and $B$. Find $\angle C$. Give the angle in degrees.`,
    figure: (() => {
      const tri = triangle(a, b);
      const points = corners(["A", "B", "C"], tri);
      // The base runs on past A and B, so their names go underneath it.
      points.A!.dir = "s";
      points.B!.dir = "s";
      points.A2 = { ...beyond(tri[1], tri[0], 2.5), hidden: true };
      points.B2 = { ...beyond(tri[0], tri[1], 2.5), hidden: true };
      return practiceFigure({
        points,
        polygons: [{ points: ["A", "B", "C"], fill: 1 }],
        segments: [{ from: "A", to: "A2" }, { from: "B", to: "B2" }],
        angles: [
          { at: "A", from: "C", to: "A2", label: md`${e1}^\circ` },
          { at: "B", from: "C", to: "B2", label: md`${e2}^\circ` },
          { at: "C", from: "A", to: "B", label: "?", color: 2, bound: ["A", "B"] },
        ],
      });
    })(),
    answer: String(180 - a - b),
    // Each exterior angle forms a linear pair with the interior angle beside it.
    verify: [`x + (180 - ${e1}) + (180 - ${e2}) = 180`],
    hint: "Each exterior angle forms a linear pair with the interior angle beside it. Find those interior angles first.",
    solution: [
      { math: md`\angle A = 180^\circ - ${e1}^\circ = ${a}^\circ`, note: "Linear pair with the exterior angle at A." },
      { math: md`\angle B = 180^\circ - ${e2}^\circ = ${b}^\circ`, note: "Linear pair with the exterior angle at B." },
      { math: md`\angle C = 180^\circ - ${a}^\circ - ${b}^\circ = ${180 - a - b}^\circ`, note: md`Triangle Angle Sum Theorem. (Shortcut: the exterior angle at $A$ equals $\angle B + \angle C$, so $\angle C = ${e1} - ${b}$.)` },
    ],
  };
};


// ── Figures ─────────────────────────────────────────────────────────────────

const ALL_EIGHT: Mark[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ n }));
const BY_FAMILY: Mark[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ n, color: family(n) ? 1 : 2 }));

const numberedFigure = transversalFigure({
  t: "62",
  u: "-8",
  marks: ALL_EIGHT,
  caption: md`Line $t$ crosses $\ell$ and $m$. Angles 1 to 4 sit at the crossing with $\ell$ and angles 5 to 8 at $m$, in the same pattern: upper left, upper right, lower left, lower right. Practice problems use this numbering. Watch out: it doesn't go around the crossing the way Unit 1's did. Here $\angle 1$ and $\angle 4$ are vertical, and $\angle 1$ and $\angle 3$ form a linear pair. These two lines are **not** parallel: the names of the pairs only describe positions.`,
});

const familyFigure = transversalFigure({
  t: "t",
  marks: BY_FAMILY,
  parallelMarks: true,
  params: [{ name: "t", tex: md`\text{tilt } t`, min: 30, max: 150, step: 1, value: 65 }],
  readouts: [
    { label: md`\angle 2`, value: "t", unit: md`^\circ` },
    { label: md`\angle 3`, value: "t", unit: md`^\circ` },
    { label: md`\angle 6`, value: "t", unit: md`^\circ` },
    { label: md`\angle 5`, value: "180 - t", unit: md`^\circ` },
    { label: md`\angle 4 + \angle 6`, value: "(180 - t) + t", unit: md`^\circ` },
  ],
  caption: md`Now $\ell \parallel m$ (the arrow marks say so). Tilt the transversal. The blue angles always equal each other, the orange angles always equal each other, and a blue angle plus an orange angle always makes $180^\circ$. At a tilt of $90^\circ$ all eight are right angles. This is also the figure for the three proofs below.`,
});

const pivotFigure = transversalFigure({
  t: "60",
  u: "u",
  names: true,
  marks: [
    { n: 2, color: 1 },
    { n: 6, color: 2 },
  ],
  view: [-7, 7, -2.5, 5],
  params: [{ name: "u", tex: md`\text{turn } m \text{ by } u`, min: -30, max: 30, step: 1, value: 14 }],
  readouts: [
    { label: md`\angle 2`, value: "60", unit: md`^\circ` },
    { label: md`\angle 6`, value: "60 - u", unit: md`^\circ` },
  ],
  caption: md`Here $\angle 2$ stays fixed while $m$ turns about $Q$. The corresponding angles match only at $u = 0$, which is exactly when $m$ stops meeting $\ell$. Turn $m$ far enough either way and you can see the two lines meet.`,
});

const sumFigure: Block = {
  kind: "diagram",
  view: [-2, 8.5, -1, 9.2],
  params: [
    { name: "a", tex: md`\angle A`, min: 35, max: 70, step: 1, value: 55 },
    { name: "c", tex: md`\angle C`, min: 35, max: 70, step: 1, value: 50 },
  ],
  points: [
    { name: "A", x: 0, y: 0, dir: "sw" },
    { name: "C", x: 6, y: 0, dir: "se" },
    { name: "B", x: "6sin(c pi/180)/sin((a + c) pi/180)*cos(a pi/180)", y: "6sin(c pi/180)/sin((a + c) pi/180)*sin(a pi/180)", dir: "n" },
    { name: "D", x: "6sin(c pi/180)/sin((a + c) pi/180)*cos(a pi/180) - 2.6", y: "6sin(c pi/180)/sin((a + c) pi/180)*sin(a pi/180)", dir: "nw" },
    { name: "E", x: "6sin(c pi/180)/sin((a + c) pi/180)*cos(a pi/180) + 2.6", y: "6sin(c pi/180)/sin((a + c) pi/180)*sin(a pi/180)", dir: "ne" },
  ],
  polygons: [{ points: ["A", "B", "C"], fill: 1 }],
  segments: [
    { from: "A", to: "C", parallel: 1 },
    { from: "D", to: "B", parallel: 1 },
    { from: "B", to: "E" },
  ],
  angles: [
    { at: "A", from: "C", to: "B", color: 1, label: md`{a}^\circ` },
    { at: "B", from: "D", to: "A", color: 1, label: md`{a}^\circ` },
    { at: "B", from: "A", to: "C", color: 3, arcs: 3, label: md`{=180 - a - c}^\circ` },
    { at: "B", from: "C", to: "E", color: 2, arcs: 2, label: md`{c}^\circ` },
    { at: "C", from: "B", to: "A", color: 2, arcs: 2, label: md`{c}^\circ` },
  ],
  readouts: [{ label: md`\angle A + \angle ABC + \angle C`, value: "a + (180 - a - c) + c", unit: md`^\circ` }],
  caption: md`$\overleftrightarrow{DE}$ passes through $B$ parallel to $\overline{AC}$. Angles with the same color and number of arcs are alternate interior angles, so they are equal. At $B$ the three angles sit side by side along a straight line. Reshape the triangle: the angles change, their sum doesn't.`,
};

const exteriorFigure: Block = {
  kind: "diagram",
  view: [-1.5, 10, -1, 7.4],
  params: [
    { name: "b", tex: md`\angle B`, min: 30, max: 60, step: 1, value: 45 },
    { name: "c", tex: md`\angle ACB`, min: 40, max: 80, step: 1, value: 65 },
  ],
  points: [
    { name: "B", x: 0, y: 0, dir: "sw" },
    { name: "C", x: 5, y: 0, dir: "s" },
    { name: "D", x: 8.5, y: 0, dir: "se" },
    { name: "A", x: "5sin(c pi/180)/sin((b + c) pi/180)*cos(b pi/180)", y: "5sin(c pi/180)/sin((b + c) pi/180)*sin(b pi/180)", dir: "n" },
  ],
  polygons: [{ points: ["A", "B", "C"], fill: 1 }],
  segments: [{ from: "C", to: "D" }],
  angles: [
    { at: "A", from: "B", to: "C", color: 1, label: md`{=180 - b - c}^\circ` },
    { at: "B", from: "C", to: "A", color: 2, label: md`{b}^\circ` },
    { at: "C", from: "A", to: "D", color: 3, arcs: 2, label: md`{=180 - c}^\circ` },
  ],
  readouts: [
    { label: md`\angle ACD`, value: "180 - c", unit: md`^\circ` },
    { label: md`\angle BAC + \angle ABC`, value: "(180 - b - c) + b", unit: md`^\circ` },
  ],
  caption: md`Side $\overline{BC}$ is extended past $C$ to $D$. The green angle $\angle ACD$ is an exterior angle, and the blue and orange angles are its remote interior angles. The two readouts always agree.`,
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit2: Unit = {
  title: "Parallel Lines",
  lessons: [
    {
      id: "angles-formed-by-a-transversal",
      title: "Angles formed by a transversal",
      summary: "Eight angles, four kinds of pairs, and what parallel lines force those angles to do.",
      blocks: [
        {
          kind: "text",
          body: md`A **transversal** is a line that crosses two other lines in the same plane at two different points. At each crossing it makes four angles, so there are eight in all.

Unit 1 already tells you how the four angles at **one** crossing relate: opposite angles are vertical angles, so they are equal, and neighbors form a linear pair, so they add to $180^\circ$. The new question is how the angles at one crossing relate to the angles at the *other* crossing.`,
        },
        numberedFigure,
        {
          kind: "key",
          title: "Names for pairs of angles",
          body: md`The region between $\ell$ and $m$ is the **interior**; the region outside them is the **exterior**. For two angles at different crossings:

- **Corresponding angles** sit in the same spot at each crossing: $\angle 1$ and $\angle 5$, $\angle 2$ and $\angle 6$, $\angle 3$ and $\angle 7$, $\angle 4$ and $\angle 8$.
- **Alternate interior angles** are interior and on opposite sides of $t$: $\angle 3$ and $\angle 6$, $\angle 4$ and $\angle 5$.
- **Alternate exterior angles** are exterior and on opposite sides of $t$: $\angle 1$ and $\angle 8$, $\angle 2$ and $\angle 7$.
- **Same-side interior angles** are interior and on the same side of $t$: $\angle 3$ and $\angle 5$, $\angle 4$ and $\angle 6$.

Each name is a description. *Interior* means between the lines, *alternate* means on alternate (opposite) sides of $t$, and *corresponding* means in the matching spot, as if you laid one crossing on top of the other.`,
        },
        {
          kind: "check",
          prompt: md`In the figure, what kind of pair are $\angle 4$ and $\angle 5$?`,
          choices: ["corresponding angles", "alternate interior angles", "alternate exterior angles", "same-side interior angles"],
          accept: ["alternate interior angles"],
          explain: md`Both are between $\ell$ and $m$, so they're interior. $\angle 4$ is right of $t$ and $\angle 5$ is left of it: opposite sides, so they're alternate.`,
        },
        {
          kind: "key",
          title: "Parallel lines and the Parallel Postulate",
          body: md`Two lines are **parallel**, written $\ell \parallel m$, when they lie in the same plane and never meet.

**Parallel Postulate.** Through a point not on a line, there is exactly one line parallel to the given line.`,
        },
        {
          kind: "why",
          title: "Why is this a postulate?",
          body: md`It sounds too obvious to need saying, and for about two thousand years mathematicians tried to prove it from Euclid's other postulates. Nobody managed it, and in the 1800s it became clear that nobody ever will: there are perfectly consistent geometries where it is false. On a sphere, where the "lines" are great circles like the equator, any two lines meet, so there are no parallels at all.

So the Parallel Postulate is a real choice, not a consequence of anything simpler. Choosing it gives the flat geometry of a sheet of paper, the one this course studies. Every theorem in this unit depends on it.`,
        },
        {
          kind: "key",
          title: "Corresponding Angles Postulate",
          body: md`If two parallel lines are cut by a transversal, then each pair of corresponding angles is equal.`,
        },
        {
          kind: "why",
          title: "Why believe it?",
          body: md`Imagine sliding line $\ell$ along $t$, without turning it, until it passes through the point where $t$ meets $m$. Sliding doesn't turn anything, so the slid copy makes the same angle with $t$ that $\ell$ did. The copy is parallel to $\ell$ and passes through a point of $m$, and the Parallel Postulate says only one such line exists. So the copy *is* $m$, and $\angle 2$ lands exactly on $\angle 6$.

That is intuition, not a proof: "sliding" hasn't been defined yet (it will be, in Unit 9). So this course takes the statement as a postulate, and proves everything else in the unit from it.`,
        },
        familyFigure,
        {
          kind: "why",
          title: "Why only two sizes?",
          body: md`At one crossing, $\angle 2$ and $\angle 3$ are vertical angles, so they are equal, and $\angle 1$ and $\angle 2$ form a linear pair, so $\angle 1 = 180^\circ - \angle 2$. That already splits the four angles at a crossing into two sizes. When $\ell \parallel m$, the Corresponding Angles Postulate copies those same two sizes to the other crossing.

So with parallel lines, once you know **one** of the eight angles, you know all of them.`,
        },
        {
          kind: "key",
          title: "Three theorems about parallel lines",
          body: md`If two parallel lines are cut by a transversal, then:

- **Alternate Interior Angles Theorem:** alternate interior angles are equal.
- **Alternate Exterior Angles Theorem:** alternate exterior angles are equal.
- **Same-Side Interior Angles Theorem:** same-side interior angles add to $180^\circ$.`,
        },
        {
          kind: "proof",
          title: "Alternate Interior Angles Theorem",
          given: md`$\ell \parallel m$, cut by transversal $t$`,
          prove: md`$\angle 3 = \angle 6$`,
          steps: [
            { statement: md`$\ell \parallel m$`, reason: "Given" },
            { statement: md`$\angle 2 = \angle 6$`, reason: "Corresponding Angles Postulate" },
            { statement: md`$\angle 3 = \angle 2$`, reason: "Vertical Angles Theorem" },
            { statement: md`$\angle 3 = \angle 6$`, reason: "Transitive Property of Equality (steps 3 and 2)" },
          ],
        },
        {
          kind: "proof",
          title: "Alternate Exterior Angles Theorem",
          given: md`$\ell \parallel m$, cut by transversal $t$`,
          prove: md`$\angle 1 = \angle 8$`,
          steps: [
            { statement: md`$\ell \parallel m$`, reason: "Given" },
            { statement: md`$\angle 1 = \angle 5$`, reason: "Corresponding Angles Postulate" },
            { statement: md`$\angle 5 = \angle 8$`, reason: "Vertical Angles Theorem" },
            { statement: md`$\angle 1 = \angle 8$`, reason: "Transitive Property of Equality (steps 2 and 3)" },
          ],
        },
        {
          kind: "proof",
          title: "Same-Side Interior Angles Theorem",
          given: md`$\ell \parallel m$, cut by transversal $t$`,
          prove: md`$\angle 4 + \angle 6 = 180^\circ$`,
          steps: [
            { statement: md`$\ell \parallel m$`, reason: "Given" },
            { statement: md`$\angle 4 + \angle 2 = 180^\circ$`, reason: "Linear Pair Postulate" },
            { statement: md`$\angle 2 = \angle 6$`, reason: "Corresponding Angles Postulate" },
            { statement: md`$\angle 4 + \angle 6 = 180^\circ$`, reason: md`Substitution Property of Equality (put $\angle 6$ in place of $\angle 2$ in step 2)` },
          ],
        },
        {
          kind: "text",
          body: md`The other pair in each family works the same way: $\angle 4 = \angle 5$, $\angle 2 = \angle 7$ and $\angle 3 + \angle 5 = 180^\circ$, each by the same steps with different numbers. The theorems are shortcuts. Anything they say, you could also get by chaining the postulate with vertical angles and linear pairs.`,
        },
        {
          kind: "example",
          title: "All eight from one",
          problem: md`$\ell \parallel m$ and $\angle 1 = 115^\circ$. Find the other seven angles.`,
          steps: [
            { math: md`\angle 4 = 115^\circ`, note: md`Vertical with $\angle 1$.` },
            { math: md`\angle 2 = \angle 3 = 180^\circ - 115^\circ = 65^\circ`, note: md`$\angle 2$ forms a linear pair with $\angle 1$, and $\angle 3$ is vertical with $\angle 2$.` },
            { math: md`\angle 5 = \angle 8 = 115^\circ`, note: md`Corresponding to $\angle 1$ and $\angle 4$.` },
            { math: md`\angle 6 = \angle 7 = 65^\circ`, note: md`Corresponding to $\angle 2$ and $\angle 3$.` },
            { math: md`\angle 4 + \angle 6 = 115^\circ + 65^\circ = 180^\circ \;\checkmark`, note: "Check with the Same-Side Interior Angles Theorem." },
          ],
        },
        {
          kind: "example",
          title: "Solving for x",
          problem: md`$\ell \parallel m$, $\angle 4 = (2x + 10)^\circ$ and $\angle 6 = (4x + 20)^\circ$. Find $x$ and both angles.`,
          steps: [
            { math: md`(2x + 10) + (4x + 20) = 180`, note: "These are same-side interior angles, so they add to 180, not equal each other." },
            { math: md`6x + 30 = 180`, note: "Combine like terms." },
            { math: md`6x = 150 \Rightarrow x = 25`, note: "Subtract 30, divide by 6." },
            { math: md`\angle 4 = 60^\circ, \quad \angle 6 = 120^\circ`, note: md`Substitute. Check: $60 + 120 = 180$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`$\ell \parallel m$ and $\angle 3 = 72^\circ$. Find $\angle 8$. Give the angle in degrees.`,
          answer: "108",
          explain: md`$\angle 4$ forms a linear pair with $\angle 3$, so $\angle 4 = 108^\circ$, and $\angle 8$ corresponds to $\angle 4$. (Or by color: $\angle 3$ is blue and $\angle 8$ is orange, so they add to $180^\circ$.)`,
        },
      ],
      practice: [identifyPair, findAngle, solveTransversal],
    },
    {
      id: "proving-lines-parallel",
      title: "Proving lines parallel",
      summary: "Running the angle theorems backwards: when the angles force two lines to be parallel.",
      blocks: [
        {
          kind: "text",
          body: md`Lesson 1 went from lines to angles: **if** $\ell \parallel m$, **then** corresponding angles are equal. Often you know the angles and want to know about the lines. Is a shelf parallel to the floor? Are two roads on a map parallel? That calls for the **converse**: if corresponding angles are equal, then $\ell \parallel m$.`,
        },
        {
          kind: "why",
          title: "Why the converse needs its own proof",
          body: md`Unit 1 showed that a conditional and its converse are different claims. "If a number is a multiple of 4, then it is even" is true; its converse, "if a number is even, then it is a multiple of 4", is false (try 6). Proving a statement tells you nothing about its converse, so each converse here has to be proved on its own.

The contrapositive is different: it always has the same truth value as the original. That gives a free test for lines that are *not* parallel, which comes up below.`,
        },
        pivotFigure,
        {
          kind: "key",
          title: "Corresponding Angles Converse",
          body: md`If two lines are cut by a transversal and a pair of corresponding angles are equal, then the lines are parallel.

This needs no new postulate. It follows from the Parallel Postulate, the Corresponding Angles Postulate and the Protractor Postulate, by showing that $m$ has no choice: it must be the one parallel through $Q$.`,
        },
        {
          kind: "proof",
          title: "Corresponding Angles Converse",
          given: md`Line $t$ crosses $\ell$ at $P$ and $m$ at $Q$, and $\angle 2 = \angle 6$`,
          prove: md`$\ell \parallel m$`,
          steps: [
            { statement: md`$\angle 2 = \angle 6$`, reason: "Given" },
            { statement: md`There is exactly one line $n$ through $Q$ with $n \parallel \ell$`, reason: md`Parallel Postulate ($Q$ is not on $\ell$, since $t$ meets $\ell$ only at $P$)` },
            { statement: md`Let $\overrightarrow{QN}$ be the ray of $n$ on the same side of $t$ as $\angle 6$. Then $\angle NQP = \angle 2$`, reason: md`Corresponding Angles Postulate, for $\ell \parallel n$` },
            { statement: md`$\angle NQP = \angle 6$`, reason: "Transitive Property of Equality (steps 3 and 1)" },
            { statement: md`$\overrightarrow{QN}$ is the side of $\angle 6$ that lies along $m$`, reason: md`Protractor Postulate: on one side of $\overleftrightarrow{QP}$, exactly one ray from $Q$ makes a given angle with $\overrightarrow{QP}$` },
            { statement: md`$n = m$, so $\ell \parallel m$`, reason: md`Through two points there is exactly one line ($n$ and $m$ share $Q$ and every other point of that ray)` },
          ],
        },
        {
          kind: "why",
          title: "What the proof really says",
          body: md`The Parallel Postulate says a parallel to $\ell$ through $Q$ exists, and only one. The Corresponding Angles Postulate says that parallel makes the same angle with $t$ as $\ell$ does. If $m$ makes that angle too, it leaves $Q$ in exactly the same direction, so it **is** that parallel. There was only ever one candidate.`,
        },
        {
          kind: "key",
          title: "The other converses",
          body: md`If two lines are cut by a transversal, the lines are parallel when any one of these holds:

- **Alternate Interior Angles Converse:** a pair of alternate interior angles are equal.
- **Alternate Exterior Angles Converse:** a pair of alternate exterior angles are equal.
- **Same-Side Interior Angles Converse:** a pair of same-side interior angles add to $180^\circ$.

Each proof turns the given pair into a pair of equal corresponding angles, then applies the Corresponding Angles Converse.`,
        },
        {
          kind: "proof",
          title: "Alternate Interior Angles Converse",
          given: md`$\angle 3 = \angle 6$`,
          prove: md`$\ell \parallel m$`,
          steps: [
            { statement: md`$\angle 3 = \angle 6$`, reason: "Given" },
            { statement: md`$\angle 2 = \angle 3$`, reason: "Vertical Angles Theorem" },
            { statement: md`$\angle 2 = \angle 6$`, reason: "Transitive Property of Equality (steps 2 and 1)" },
            { statement: md`$\ell \parallel m$`, reason: "Corresponding Angles Converse" },
          ],
        },
        {
          kind: "proof",
          title: "Alternate Exterior Angles Converse",
          given: md`$\angle 1 = \angle 8$`,
          prove: md`$\ell \parallel m$`,
          steps: [
            { statement: md`$\angle 1 = \angle 8$`, reason: "Given" },
            { statement: md`$\angle 1 = \angle 4$`, reason: "Vertical Angles Theorem" },
            { statement: md`$\angle 4 = \angle 8$`, reason: md`Substitution Property of Equality (put $\angle 4$ in place of $\angle 1$ in step 1)` },
            { statement: md`$\ell \parallel m$`, reason: md`Corresponding Angles Converse ($\angle 4$ and $\angle 8$ are corresponding)` },
          ],
        },
        {
          kind: "proof",
          title: "Same-Side Interior Angles Converse",
          given: md`$\angle 4 + \angle 6 = 180^\circ$`,
          prove: md`$\ell \parallel m$`,
          steps: [
            { statement: md`$\angle 4 + \angle 6 = 180^\circ$`, reason: "Given" },
            { statement: md`$\angle 2 + \angle 4 = 180^\circ$`, reason: "Linear Pair Postulate" },
            { statement: md`$\angle 2 + \angle 4 = \angle 4 + \angle 6$`, reason: md`Substitution Property of Equality (replace $180^\circ$ in step 2 using step 1)` },
            { statement: md`$\angle 2 = \angle 6$`, reason: md`Subtraction Property of Equality (subtract $\angle 4$)` },
            { statement: md`$\ell \parallel m$`, reason: "Corresponding Angles Converse" },
          ],
        },
        {
          kind: "text",
          body: md`Pairs with no name work too. Say $\angle 2 + \angle 5 = 180^\circ$. Since $\angle 6 + \angle 5 = 180^\circ$ (linear pair), $\angle 2 = \angle 6$, and the Corresponding Angles Converse gives $\ell \parallel m$. Any pair at different crossings can be routed through a corresponding angle like this.`,
        },
        {
          kind: "why",
          title: "Why unequal angles prove the lines meet",
          body: md`Take the contrapositive of the Alternate Interior Angles Theorem: if alternate interior angles are **not** equal, then the lines are **not** parallel. The same works for every theorem in Lesson 1. So a pair of angles at different crossings settles the question both ways: the right relationship means parallel, and anything else means the lines meet somewhere.

One warning. A pair at the **same** crossing, like vertical angles $\angle 1$ and $\angle 4$, tells you nothing. Those are equal whether or not the lines are parallel.`,
        },
        {
          kind: "example",
          title: "Parallel or not?",
          problem: md`You measure $\angle 4 = 68^\circ$ and $\angle 6 = 112^\circ$. Is $\ell \parallel m$?`,
          steps: [
            { math: md`\angle 4, \angle 6: \text{same-side interior}`, note: "Both are between the lines, on the right of t." },
            { math: md`68^\circ + 112^\circ = 180^\circ`, note: "Test the condition: they add to 180." },
            { math: md`\ell \parallel m`, note: "By the Same-Side Interior Angles Converse." },
          ],
        },
        {
          kind: "example",
          title: "Choosing x to make lines parallel",
          problem: md`$\angle 1 = (3x + 14)^\circ$ and $\angle 8 = (5x - 22)^\circ$. What value of $x$ makes $\ell \parallel m$?`,
          steps: [
            { math: md`3x + 14 = 5x - 22`, note: "Alternate exterior angles. By the converse, equal angles make the lines parallel." },
            { math: md`36 = 2x \Rightarrow x = 18`, note: md`Subtract $3x$, add 22, divide by 2.` },
            { math: md`\angle 1 = \angle 8 = 68^\circ`, note: md`Check: $3(18) + 14 = 68$ and $5(18) - 22 = 68$.` },
          ],
        },
        {
          kind: "why",
          title: "Why two perpendiculars are parallel",
          body: md`Two lines are **perpendicular**, written $\ell \perp t$, when they meet at a right angle. Then all four angles at the crossing are right angles: the angle beside the right angle is $180^\circ - 90^\circ = 90^\circ$ (Linear Pair Postulate), and the other two are vertical to those.

Suppose $\ell \perp t$ and $m \perp t$, in one plane. Then $\angle 2 = 90^\circ$ and $\angle 6 = 90^\circ$, so $\angle 2 = \angle 6$ (Transitive Property), and these are corresponding angles. By the Corresponding Angles Converse, $\ell \parallel m$.

**In a plane, two lines perpendicular to the same line are parallel.** That is why a carpenter can draw parallel lines with nothing but a square: draw two lines at right angles to one edge.`,
        },
        {
          kind: "check",
          prompt: md`You measure $\angle 2 = 70^\circ$ and $\angle 7 = 110^\circ$. What can you conclude?`,
          choices: [md`$\ell \parallel m$`, md`$\ell$ and $m$ are not parallel`, "There isn't enough information"],
          accept: [md`$\ell$ and $m$ are not parallel`],
          explain: md`$\angle 2$ and $\angle 7$ are alternate exterior angles. If the lines were parallel they would be equal. They aren't, so by the contrapositive the lines are not parallel. (Adding to $180^\circ$ is the test for same-side interior angles, not this pair.)`,
        },
        {
          kind: "check",
          prompt: md`$\angle 3 = (2x + 30)^\circ$ and $\angle 5 = (4x + 6)^\circ$. What value of $x$ makes $\ell \parallel m$?`,
          answer: "24",
          explain: md`Same-side interior angles must add to $180^\circ$: $6x + 36 = 180$, so $x = 24$. The angles are then $78^\circ$ and $102^\circ$.`,
        },
      ],
      practice: [concludeParallel, solveForParallel, makeParallel],
    },
    {
      id: "the-angle-sum-of-a-triangle",
      title: "The angle sum of a triangle",
      summary: "Why every triangle's angles add to 180 degrees, proved with one parallel line, and what that says about exterior angles.",
      blocks: [
        {
          kind: "text",
          body: md`Draw any triangle on paper, tear off its three corners, and fit them together point to point. They always make a straight line: $180^\circ$. Skinny triangles, wide ones, right ones, all the same.

An experiment can't check every triangle, though, and torn corners are never exact. A proof can. The idea is already in the torn corners: put the three angles side by side along a straight line. A parallel line through one vertex does exactly that.`,
        },
        sumFigure,
        {
          kind: "key",
          title: "Triangle Angle Sum Theorem",
          body: md`The three angles of any triangle add to $180^\circ$. In $\triangle ABC$:

$$\angle A + \angle B + \angle C = 180^\circ.$$

When only one angle sits at a vertex, $\angle A$ is short for $\angle BAC$.`,
        },
        {
          kind: "proof",
          title: "Triangle Angle Sum Theorem",
          given: md`$\triangle ABC$`,
          prove: md`$\angle BAC + \angle ABC + \angle BCA = 180^\circ$`,
          steps: [
            { statement: md`Draw $\overleftrightarrow{DE}$ through $B$ with $\overleftrightarrow{DE} \parallel \overleftrightarrow{AC}$, $D$ on the same side of $\overleftrightarrow{BC}$ as $A$ and $E$ on the same side of $\overleftrightarrow{AB}$ as $C$`, reason: "Parallel Postulate (there is exactly one such line)" },
            { statement: md`$\angle DBA + \angle ABE = 180^\circ$`, reason: md`Linear Pair Postulate ($\overrightarrow{BD}$ and $\overrightarrow{BE}$ are opposite rays)` },
            { statement: md`$\angle ABE = \angle ABC + \angle CBE$`, reason: md`Angle Addition Postulate ($C$ is inside $\angle ABE$)` },
            { statement: md`$\angle DBA + \angle ABC + \angle CBE = 180^\circ$`, reason: "Substitution Property of Equality (step 3 into step 2)" },
            { statement: md`$\angle DBA = \angle BAC$`, reason: md`Alternate Interior Angles Theorem (transversal $\overleftrightarrow{AB}$)` },
            { statement: md`$\angle CBE = \angle BCA$`, reason: md`Alternate Interior Angles Theorem (transversal $\overleftrightarrow{BC}$)` },
            { statement: md`$\angle BAC + \angle ABC + \angle BCA = 180^\circ$`, reason: "Substitution Property of Equality (steps 5 and 6 into step 4)" },
          ],
        },
        {
          kind: "why",
          title: "Where the Parallel Postulate comes in",
          body: md`Step 1 needs a parallel through $B$, and steps 5 and 6 need the Alternate Interior Angles Theorem, which came from the Corresponding Angles Postulate. Take parallels away and the theorem fails.

On a sphere, start at the North Pole and walk straight down to the equator. Turn $90^\circ$, walk a quarter of the way around the equator, turn $90^\circ$ again and walk straight back to the pole. That triangle has three right angles: $270^\circ$. So $180^\circ$ is not a fact about every possible triangle. It is a fact about flat geometry, and the proof shows exactly which assumption makes it true.`,
        },
        {
          kind: "key",
          title: "Consequences",
          body: md`- The two acute angles of a right triangle add to $90^\circ$: they are **complementary**.
- A triangle has at most one angle of $90^\circ$ or more, so at most one right or obtuse angle.
- **Third Angles Theorem:** if two angles of one triangle equal two angles of another triangle, then their third angles are equal too.
- If all three angles of a triangle are equal, each one is $60^\circ$.`,
        },
        {
          kind: "why",
          title: "Why these follow",
          body: md`Each one is the angle sum plus a line of algebra.

- Right triangle: $90^\circ + \angle A + \angle B = 180^\circ$, so $\angle A + \angle B = 90^\circ$.
- Two angles of $90^\circ$ or more would already total at least $180^\circ$, leaving nothing for the third angle.
- Third angles: each third angle is $180^\circ$ minus the same two numbers.
- Three equal angles: $3x = 180^\circ$, so $x = 60^\circ$.`,
        },
        {
          kind: "example",
          title: "Angles given by expressions",
          problem: md`The angles of a triangle measure $(2x)^\circ$, $(3x + 10)^\circ$ and $(x + 20)^\circ$. Find each angle.`,
          steps: [
            { math: md`2x + (3x + 10) + (x + 20) = 180`, note: "Triangle Angle Sum Theorem." },
            { math: md`6x + 30 = 180 \Rightarrow x = 25`, note: "Combine like terms, subtract 30, divide by 6." },
            { math: md`50^\circ, \; 85^\circ, \; 45^\circ`, note: md`Substitute. Check: $50 + 85 + 45 = 180$.` },
          ],
        },
        {
          kind: "example",
          title: "Angles in a ratio",
          problem: md`The angles of a triangle are in the ratio $2 : 3 : 4$. Find each angle.`,
          steps: [
            { math: md`2k + 3k + 4k = 180`, note: md`"In the ratio $2 : 3 : 4$" means the angles are 2, 3 and 4 copies of the same amount. Call that amount $k$. Then use the Triangle Angle Sum Theorem.` },
            { math: md`9k = 180 \Rightarrow k = 20`, note: "Combine like terms, divide by 9." },
            { math: md`40^\circ, \; 60^\circ, \; 80^\circ`, note: md`Check: $40 + 60 + 80 = 180$.` },
          ],
        },
        {
          kind: "text",
          body: md`Extend one side of a triangle past a vertex. The angle between the extension and the other side at that vertex is an **exterior angle**. It forms a linear pair with the interior angle there. The two angles of the triangle at the *other* vertices are its **remote interior angles**.`,
        },
        exteriorFigure,
        {
          kind: "key",
          title: "Exterior Angle Theorem",
          body: md`An exterior angle of a triangle equals the sum of its two remote interior angles. In the figure, $\angle ACD = \angle BAC + \angle ABC$.`,
        },
        {
          kind: "proof",
          title: "Exterior Angle Theorem",
          given: md`$\triangle ABC$, with $D$ on the extension of $\overline{BC}$ past $C$`,
          prove: md`$\angle ACD = \angle BAC + \angle ABC$`,
          steps: [
            { statement: md`$\angle ACB + \angle ACD = 180^\circ$`, reason: "Linear Pair Postulate" },
            { statement: md`$\angle BAC + \angle ABC + \angle ACB = 180^\circ$`, reason: "Triangle Angle Sum Theorem" },
            { statement: md`$\angle ACB + \angle ACD = \angle BAC + \angle ABC + \angle ACB$`, reason: md`Substitution Property of Equality (replace $180^\circ$ in step 1 using step 2)` },
            { statement: md`$\angle ACD = \angle BAC + \angle ABC$`, reason: md`Subtraction Property of Equality (subtract $\angle ACB$)` },
          ],
        },
        {
          kind: "why",
          title: "An exterior angle beats each remote angle",
          body: md`Since $\angle ACD = \angle A + \angle B$ and $\angle B$ is more than $0^\circ$, the exterior angle is **larger** than $\angle A$. In the same way it is larger than $\angle B$. This inequality comes back in Unit 3.

The theorem is also a shortcut: to get an exterior angle you never need the interior angle beside it. Add the two remote angles and you're done.`,
        },
        {
          kind: "example",
          title: "Exterior angle with algebra",
          problem: md`An exterior angle of a triangle measures $(5x - 10)^\circ$. Its remote interior angles measure $(2x + 15)^\circ$ and $(x + 25)^\circ$. Find $x$ and the exterior angle.`,
          steps: [
            { math: md`5x - 10 = (2x + 15) + (x + 25)`, note: "Exterior Angle Theorem." },
            { math: md`5x - 10 = 3x + 40`, note: "Combine like terms on the right." },
            { math: md`2x = 50 \Rightarrow x = 25`, note: md`Subtract $3x$, add 10, divide by 2.` },
            { math: md`5(25) - 10 = 115^\circ`, note: md`Check: the remote angles are $65^\circ$ and $50^\circ$, and $65 + 50 = 115$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`In $\triangle ABC$, $\angle A = 48^\circ$ and $\angle B = 77^\circ$. Find $\angle C$. Give the angle in degrees.`,
          answer: "55",
          explain: md`$180 - 48 - 77 = 55$.`,
        },
        {
          kind: "check",
          prompt: md`An exterior angle of a triangle measures $130^\circ$, and one of its remote interior angles measures $55^\circ$. Find the other remote interior angle. Give the angle in degrees.`,
          answer: "75",
          explain: md`The exterior angle is the sum of the two remote angles: $130 - 55 = 75$.`,
        },
      ],
      practice: [triangleAngles, solveTriangle, triangleReasoning],
    },
  ],
};
