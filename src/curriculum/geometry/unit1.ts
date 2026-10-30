import { paren, poly } from "../../math/random";
import type { Rng } from "../../math/random";
import { md, type DiagramSpec, type Generator, type SeriesColor, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** ax + b, written the way a person would. */
const lin = (a: number, b: number) => poly([[a, "x"], [b, ""]]);
/** ax on its own. */
const term = (a: number) => poly([[a, "x"]]);
/** An angle measure given as an expression: (3x + 5)°. */
const degs = (a: number, b: number) => md`(${lin(a, b)})^\circ`;
/** The same text with its first letter capitalised. */
const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** The point at a given distance and direction (degrees, counterclockwise from east) from (cx, cy). */
function polar(radius: number, degrees: number, cx = 0, cy = 0): { x: number; y: number } {
  const t = (degrees * Math.PI) / 180;
  return { x: Math.round((cx + radius * Math.cos(t)) * 1000) / 1000, y: Math.round((cy + radius * Math.sin(t)) * 1000) / 1000 };
}

/**
 * One angle of a linear pair drawn in a figure, 20 to 160 degrees. Never 90:
 * two right angles would be drawn with different arc marks, as if unequal.
 */
function pairAngle(r: Rng): number {
  for (;;) {
    const v = r.int(20, 160);
    if (v !== 90) return v;
  }
}

/** Coefficients a (1 to maxA) and b (nonzero, -40 to 120) with a x + b = v. */
function split(r: Rng, x: number, v: number, maxA = 6): [number, number] {
  if (v > 60) maxA = Math.max(maxA, 9);
  // Prefer modest constants, then accept larger ones.
  for (let tries = 0; tries < 160; tries++) {
    const a = r.int(1, maxA);
    const b = v - a * x;
    if (b !== 0 && b >= -40 && b <= (tries < 80 ? 50 : 120)) return [a, b];
  }
  let a = Math.max(1, Math.min(12, Math.floor((v - 20) / x)));
  if (v - a * x === 0) a = a > 1 ? a - 1 : a + 1;
  return [a, v - a * x];
}

/** Two different expressions a x + b and c x + d with the same value v (in [lo, hi]) at x. Returns [a, b, c, d, v]. */
function twoWays(r: Rng, x: number, lo: number, hi: number, maxA = 7): [number, number, number, number, number] {
  for (let tries = 0; ; tries++) {
    const a = r.int(1, maxA);
    const c = r.int(1, maxA);
    const b = r.int(-30, tries < 200 ? 50 : 100);
    const v = a * x + b;
    const d = v - c * x;
    if (a === c || b === 0 || d === 0 || v < lo || v > hi || d < -40 || d > 120) continue;
    return [a, b, c, d, v];
  }
}

/**
 * The steps that solve A x + B = C x + D, with every coefficient a whole
 * number and A, C >= 0, A != C. The equation itself is not repeated.
 */
function solveLinear(A: number, B: number, C: number, D: number, x: number): Step[] {
  const steps: Step[] = [];
  // Collect the x-terms on the side with the larger coefficient: k x + c0 = r0.
  const left = A > C;
  const k = left ? A - C : C - A;
  const c0 = left ? B : D;
  const r0 = left ? D : B;
  if (C !== 0 && left) steps.push({ math: md`${lin(k, B)} = ${D}`, note: md`Subtract $${term(C)}$ from both sides.` });
  if (!left) steps.push({ math: md`${B} = ${lin(k, D)}`, note: md`Subtract $${term(A)}$ from both sides.` });
  if (c0 !== 0) {
    const math = left ? md`${term(k)} = ${r0 - c0}` : md`${r0 - c0} = ${term(k)}`;
    steps.push({ math, note: c0 > 0 ? `Subtract ${c0} from both sides.` : `Add ${-c0} to both sides.` });
  }
  if (k !== 1) steps.push({ math: md`x = ${x}`, note: `Divide both sides by ${k}.` });
  else if (!left) steps.push({ math: md`x = ${x}`, note: "Read it the other way round (Symmetric Property)." });
  return steps;
}

/** Tick marks and numbers for a ruler drawn along y = 0. */
function rulerMarks(lo: number, hi: number): Required<Pick<DiagramSpec, "points" | "segments" | "labels">> {
  const points: NonNullable<DiagramSpec["points"]> = [
    { name: "L", x: lo - 0.6, y: 0, hidden: true, label: "" },
    { name: "R", x: hi + 0.6, y: 0, hidden: true, label: "" },
  ];
  const segments: NonNullable<DiagramSpec["segments"]> = [{ from: "L", to: "R", kind: "line" }];
  const labels: NonNullable<DiagramSpec["labels"]> = [];
  for (let i = lo; i <= hi; i++) {
    points.push({ name: `u${i}`, x: i, y: 0.16, hidden: true, label: "" }, { name: `d${i}`, x: i, y: -0.16, hidden: true, label: "" });
    segments.push({ from: `u${i}`, to: `d${i}` });
    labels.push({ x: i, y: -0.55, text: String(i) });
  }
  return { points, segments, labels };
}

// ── Practice figures ────────────────────────────────────────────────────────
// Built from the generated numbers, so the picture matches the problem. The
// renderer fits a figure into about 516 pixels, so label sizes are estimated in
// pixels and turned into diagram units once the view is known.

type Diagram = { kind: "diagram" } & DiagramSpec;
type Pts = NonNullable<DiagramSpec["points"]>;
type Segs = NonNullable<DiagramSpec["segments"]>;
type Angs = NonNullable<DiagramSpec["angles"]>;
type Labs = NonNullable<DiagramSpec["labels"]>;
type Dir = NonNullable<Pts[number]["dir"]>;
type Box = [number, number, number, number];

const rad = (deg: number) => (deg * Math.PI) / 180;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
/** Degrees in [0, 360). */
const norm = (deg: number) => ((deg % 360) + 360) % 360;
/** Pixels per diagram unit for a view of this size. */
const scale = ([x0, x1, y0, y1]: Box) => Math.min(516 / (x1 - x0), 556 / (y1 - y0));
const spinRange = (lo: number, hi: number) => Array.from({ length: (hi - lo) / 5 + 1 }, (_, i) => lo + 5 * i);

/** A rough on-screen size of a LaTeX label, in pixels. */
function texSize(tex: string): { w: number; h: number } {
  const plain = tex.replace(/\^\\circ/g, "o").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "");
  const spaces = (plain.match(/ /g) ?? []).length;
  return { w: 9 * (plain.length - spaces) + 5 * spaces + 4, h: 22 };
}

/** The compass direction nearest to an angle in degrees. */
function compass(deg: number): Dir {
  const dirs: Dir[] = ["e", "ne", "n", "nw", "w", "sw", "s", "se"];
  return dirs[Math.round(norm(deg) / 45) % 8]!;
}

/**
 * Points on a line, left to right, with pieces of the given lengths drawn to
 * scale in a 10-unit figure. Each piece can carry a label and tick marks;
 * `total` labels the whole on a dimension line underneath. A piece under a
 * quarter of the whole is widened so its label fits, and `toScale` is then false.
 */
function collinearFigure(
  names: string[],
  pieces: { length: number; label?: string; ticks?: 1 | 2; color?: SeriesColor }[],
  total?: string,
): { figure: Diagram; toScale: boolean } {
  const sum = pieces.reduce((s, p) => s + p.length, 0);
  let fracs = pieces.map((p) => p.length / sum);
  const MIN = 0.25;
  const toScale = fracs.every((f) => f >= MIN - 1e-9);
  if (!toScale) {
    const small = fracs.filter((f) => f < MIN).length;
    const rest = fracs.filter((f) => f >= MIN).reduce((s, f) => s + f, 0);
    fracs = fracs.map((f) => (f < MIN ? MIN : (f * (1 - small * MIN)) / rest));
  }
  const xs = [0];
  for (const f of fracs) xs.push(round3(xs[xs.length - 1]! + 10 * f));
  const view: Box = [-0.9, 10.9, total ? -2.25 : -1, 1];
  // Names go on the side away from the piece labels.
  const points: Pts = names.map((name, i) => ({ name, x: xs[i]!, y: 0, dir: total ? "s" : "n" }));
  // A segment label sits 14 pixels off the line, where a tick mark would run into it.
  // With ticks, the piece labels go a little further out as free labels.
  const ticked = pieces.some((p) => p.ticks);
  const segments: Segs = pieces.map((p, i) => ({ from: names[i]!, to: names[i + 1]!, label: ticked ? undefined : p.label, ticks: p.ticks, color: p.color }));
  const labels: Labs = [];
  if (ticked) {
    const off = round3(22 / scale(view));
    pieces.forEach((p, i) => p.label && labels.push({ x: round3((xs[i]! + xs[i + 1]!) / 2), y: total ? off : -off, text: p.label }));
  }
  if (total) {
    // Hidden points below pull the figure's centre down, so piece labels sit above the line.
    points.push(
      { name: "dl", x: 0, y: -1.3, hidden: true, label: "" },
      { name: "dm", x: 5, y: -1.3, hidden: true, label: "" },
      { name: "dr", x: 10, y: -1.3, hidden: true, label: "" },
    );
    segments.push({ from: "dm", to: "dl", arrow: true }, { from: "dm", to: "dr", arrow: true });
    labels.push({ x: 5, y: -1.75, text: total });
  } else {
    // A hidden point above keeps the piece labels below the line.
    points.push({ name: "up", x: 5, y: 0.9, hidden: true, label: "" });
  }
  return { figure: { kind: "diagram", view, points, segments, labels }, toScale };
}

/**
 * Points on a number line at their coordinates, names above and coordinates
 * below (no ruler, so lengths can't be read off). `ticks` marks the pieces
 * between neighbours as congruent; `ask` highlights a segment with a "?".
 */
function coordinateFigure(pts: { name: string; at: number; coord: string }[], opts: { ticks?: boolean; ask?: [string, string] } = {}): Diagram {
  const sorted = [...pts].sort((p, q) => p.at - q.at);
  const lo = sorted[0]!.at;
  const hi = sorted[sorted.length - 1]!.at;
  const mid = (lo + hi) / 2;
  const half = Math.max((hi - lo) / 2 + 2, 5);
  const P = 516 / (2 * half);
  const points: Pts = sorted.map((p) => ({ name: p.name, x: p.at, y: 0, dir: "n" }));
  const segments: Segs = [{ from: sorted[0]!.name, to: sorted[sorted.length - 1]!.name, kind: "line" }];
  const labels: Labs = sorted.map((p) => ({ x: p.at, y: round3(-24 / P), text: p.coord }));
  if (opts.ticks) for (let i = 0; i + 1 < sorted.length; i++) segments.push({ from: sorted[i]!.name, to: sorted[i + 1]!.name, ticks: 1 });
  if (opts.ask) {
    const [a, b] = opts.ask.map((n) => sorted.find((p) => p.name === n)!.at);
    segments.push({ from: opts.ask[0], to: opts.ask[1], color: 1 });
    labels.push({ x: (a! + b!) / 2, y: round3(18 / P), text: "?" });
  }
  return { kind: "diagram", view: [round3(mid - half), round3(mid + half), round3(-44 / P), round3(36 / P)], points, segments, labels };
}

/** Rays from one vertex, with angle marks and labels placed inside their angles. */
interface FanSpec {
  vertex: string;
  /** "" for no label. */
  vertexLabel?: string;
  /** The rays' far points, by direction in degrees counterclockwise from east. */
  rays: { name: string; deg: number; label?: string; hidden?: boolean }[];
  /** Angle marks, each the smaller angle between two rays. */
  marks?: { from: string; to: string; label?: string; arcs?: 1 | 2 | 3; color?: SeriesColor }[];
  /** Pairs of rays drawn as one line through the vertex. */
  lines?: [string, string][];
  /** Ray length in diagram units. */
  len?: number;
  /** Rotations to try; the one where the labels fit best wins, preferring small turns. */
  spins?: number[];
}

interface Laid {
  points: Pts;
  segments: Segs;
  angles: Angs;
  labels: Labs;
  /** Everything drawn, labels included: [xmin, xmax, ymin, ymax]. */
  box: Box;
  /** Pixels by which labels had to be pulled in from where they would clear the rays. */
  cost: number;
}

function layoutFan(f: FanSpec, spin: number, P: number, finite: boolean, at = { x: 0, y: 0 }): Laid {
  const len = f.len ?? 5.5;
  const dir: Record<string, number> = {};
  for (const r of f.rays) dir[r.name] = norm(r.deg + spin);
  const sorted = [...f.rays].sort((p, q) => dir[p.name]! - dir[q.name]!);
  const n = sorted.length;
  // Gap i runs counterclockwise from sorted[i] to the next ray.
  const gaps = sorted.map((r, i) => {
    const next = sorted[(i + 1) % n]!;
    return { from: r.name, to: next.name, start: dir[r.name]!, size: norm(dir[next.name]! - dir[r.name]!) || 360 };
  });
  const marked = (g: (typeof gaps)[number]) => (f.marks ?? []).some((m) => (m.from === g.from && m.to === g.to) || (m.from === g.to && m.to === g.from));
  const xs: number[] = [];
  const ys: number[] = [];
  const grow = (x: number, y: number, rx: number, ry: number) => (xs.push(x - rx, x + rx), ys.push(y - ry, y + ry));
  const out = (deg: number, r: number) => ({ x: round3(at.x + r * Math.cos(rad(deg))), y: round3(at.y + r * Math.sin(rad(deg))) });

  /**
   * Distance in pixels from the vertex at which a label, centred on the bisector of
   * the angle from `start` turning `size` degrees, clears both sides and `inner` pixels.
   */
  const reach = (tex: string, start: number, size: number, inner: number) => {
    const { w, h } = texSize(tex);
    const mid = start + size / 2;
    const clear = (phi: number) => (w / 2) * Math.abs(Math.sin(rad(phi))) + (h / 2) * Math.abs(Math.cos(rad(phi))) + 5;
    const fit = size >= 180 ? 0 : Math.max(clear(start), clear(start + size)) / Math.sin(rad(size / 2));
    return { w, h, mid, R: Math.max(fit, inner + (w / 2) * Math.abs(Math.cos(rad(mid))) + (h / 2) * Math.abs(Math.sin(rad(mid))) + 4) };
  };
  const labels: Labs = [];

  // The vertex's name goes in the widest unmarked gap (any gap if all are marked), clear of the sides.
  const free = gaps.filter((g) => !marked(g));
  const widest = (free.length ? free : gaps).reduce((a, b) => (b.size > a.size ? b : a));
  const points: Pts = [{ name: f.vertex, x: at.x, y: at.y, label: "" }];
  grow(at.x, at.y, 0.6, 0.6);
  const vertexLabel = f.vertexLabel ?? f.vertex;
  if (vertexLabel) {
    const v = reach(vertexLabel, widest.start, widest.size, free.length ? 2 : 30);
    const c = out(v.mid, v.R / P);
    labels.push({ x: c.x, y: c.y, text: vertexLabel });
    grow(c.x, c.y, v.w / 2 / P, v.h / 2 / P);
  }
  for (const [i, r] of sorted.entries()) {
    const d = dir[r.name]!;
    const p = out(d, len);
    // Beside the ray's far end, on the side of the wider neighbouring gap.
    const side = gaps[i]!.size >= gaps[(i - 1 + n) % n]!.size ? 90 : -90;
    points.push({ name: r.name, x: p.x, y: p.y, label: r.label, hidden: r.hidden, dir: compass(d + side) });
    grow(p.x, p.y, 0.8, 0.8);
  }

  const inLine = new Set((f.lines ?? []).flat());
  const segments: Segs = (f.lines ?? []).map(([p, q]) => ({ from: p, to: q, kind: finite ? "segment" : "line" }));
  for (const r of f.rays) if (!inLine.has(r.name)) segments.push({ from: f.vertex, to: r.name, kind: finite ? "segment" : "ray" });

  const angles: Angs = [];
  let cost = 0;
  for (const m of f.marks ?? []) {
    angles.push({ at: f.vertex, from: m.from, to: m.to, arcs: m.arcs, color: m.color });
    if (!m.label) continue;
    let start = dir[m.from]!;
    let size = norm(dir[m.to]! - start);
    if (size > 180) [start, size] = [dir[m.to]!, 360 - size];
    // Clear of both sides of the angle and of its arc marks.
    const { w, h, mid, R: want } = reach(m.label, start, size, 22 + ((m.arcs ?? 1) - 1) * 4);
    const cap = (len - 1.1) * P;
    cost += Math.max(0, want - cap);
    const c = out(mid, Math.min(want, cap) / P);
    labels.push({ x: c.x, y: c.y, text: m.label });
    grow(c.x, c.y, w / 2 / P, h / 2 / P);
  }
  return { points, segments, angles, labels, box: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], cost };
}

/**
 * One or more angle fans side by side, vertices on one level. A single fan's
 * sides run on to the edge of the figure; several fans are drawn with finite
 * sides so they don't cross.
 */
function angleDiagram(fans: FanSpec[]): Diagram {
  const finite = fans.length > 1;
  let P = 40;
  const spins = fans.map((f) => {
    const tries = f.spins ?? [0];
    const score = (s: number) => layoutFan(f, s, P, finite).cost + 0.3 * Math.abs(s);
    return tries.reduce((best, s) => (score(s) < score(best) ? s : best), tries[0]!);
  });
  let laid: Laid[] = [];
  let view: Box = [0, 1, 0, 1];
  for (let pass = 0; pass < 4; pass++) {
    laid = [];
    let right = 0;
    for (const [i, f] of fans.entries()) {
      let g = layoutFan(f, spins[i]!, P, finite);
      if (i > 0) g = layoutFan(f, spins[i]!, P, finite, { x: round3(right - g.box[0] + 0.6), y: 0 });
      laid.push(g);
      right = g.box[1];
    }
    view = [
      round3(Math.min(...laid.map((g) => g.box[0])) - 0.3),
      round3(Math.max(...laid.map((g) => g.box[1])) + 0.3),
      round3(Math.min(...laid.map((g) => g.box[2])) - 0.3),
      round3(Math.max(...laid.map((g) => g.box[3])) + 0.3),
    ];
    const next = scale(view);
    if (Math.abs(next - P) < 0.5) break;
    P = next;
  }
  return {
    kind: "diagram",
    view,
    points: laid.flatMap((g) => g.points),
    segments: laid.flatMap((g) => g.segments),
    angles: laid.flatMap((g) => g.angles),
    labels: laid.flatMap((g) => g.labels),
  };
}

/** Rays BA, BD and BC from B, with A at 0 degrees, D at `d` and C at `c`. */
function bisectFan(d: number, c: number, marks: FanSpec["marks"]): Diagram {
  return angleDiagram([
    {
      vertex: "B",
      rays: [
        { name: "A", deg: 0 },
        { name: "D", deg: d },
        { name: "C", deg: c },
      ],
      marks,
      spins: spinRange(-30, 30),
    },
  ]);
}

/** Line AC with B on it and ray BD at `d` degrees from BC, so angle DBC = d and angle ABD = 180 - d. */
function linearPairFigure(d: number, marks: FanSpec["marks"]): Diagram {
  return angleDiagram([
    {
      vertex: "B",
      rays: [
        { name: "C", deg: 0 },
        { name: "D", deg: d },
        { name: "A", deg: 180 },
      ],
      lines: [["A", "C"]],
      marks,
      spins: spinRange(-20, 20),
    },
  ]);
}

// ── Lesson 1: Points, lines and planes ──────────────────────────────────────

const segmentAddition: Generator = (r) => {
  const kind = r.int(0, 2);
  // Most of the time hand over the equation; otherwise the learner sets it up from the figure.
  const scaffold = r.next() < 0.6;
  const lead = scaffold ? "" : md`Segment Addition Postulate: $AB + BC = AC$. Put in the expressions. `;
  const x = r.int(2, 9);
  const [a, b] = split(r, x, r.int(4, 30), 5);
  const [c, d] = split(r, x, r.int(4, 30), 5);
  const AB = a * x + b;
  const BC = c * x + d;
  const AC = AB + BC;
  const e = kind === 1 ? a + c + r.int(1, 3) : a + r.int(1, 3);
  const f = AC - e * x;
  const abTex = lin(a, b);
  const bcTex = kind === 2 ? String(BC) : lin(c, d);
  const acTex = kind === 0 ? String(AC) : lin(e, f);
  const eq = md`(${abTex}) + ${kind === 2 ? bcTex : md`(${bcTex})`} = ${acTex}`;
  const { figure, toScale } = collinearFigure(["A", "B", "C"], [{ length: AB, label: abTex, color: 1 }, { length: BC, label: bcTex, color: 2 }], acTex);
  const note = toScale ? "" : " The figure is not drawn to scale.";
  const postulate = md`$B$ is between $A$ and $C$, so the Segment Addition Postulate gives $AB + BC = AC$.`;
  const back: Step = { math: md`AB = ${AB}, \quad BC = ${BC}, \quad AC = ${AC}`, note: md`Substitute $x = ${x}$ back in. Check: $${AB} + ${BC} = ${AC}$.` };
  const base = {
    prompt: scaffold ? md`Solve $${eq}$. It comes from the figure, where $B$ is between $A$ and $C$.${note} Give the value of $x$.` : md`Find $x$ in the figure.${note}`,
    answer: String(x),
    figure,
    ...(scaffold ? {} : { verify: [eq] }),
  };
  if (kind === 0) {
    return {
      ...base,
      hint: md`${scaffold ? md`This is $AB + BC = AC$. ` : lead}Combine the $x$-terms and the constants on the left first.`,
      solution: [
        { math: eq, note: postulate },
        { math: md`${lin(a + c, b + d)} = ${AC}`, note: "Combine like terms." },
        ...solveLinear(a + c, b + d, 0, AC, x),
        back,
      ],
    };
  }
  if (kind === 1) {
    return {
      ...base,
      hint: md`${lead}Combine like terms on the left, then gather the x-terms on the side where there are more of them.`,
      solution: [
        { math: eq, note: postulate },
        { math: md`${lin(a + c, b + d)} = ${lin(e, f)}`, note: "Combine like terms." },
        ...solveLinear(a + c, b + d, e, f, x),
        back,
      ],
    };
  }
  return {
    ...base,
    hint: md`${lead}Add the numbers on the left first, then collect the x-terms on one side.`,
    solution: [
      { math: eq, note: postulate },
      { math: md`${lin(a, b + BC)} = ${lin(e, f)}`, note: "Combine the constants." },
      ...solveLinear(a, b + BC, e, f, x),
      back,
    ],
  };
};

const midpointAlgebra: Generator = (r) => {
  const x = r.int(2, 9);
  const scaffold = r.next() < 0.6;
  const pose = (eq: string) =>
    scaffold
      ? { prompt: md`Solve $${eq}$. It comes from the figure, where $M$ is the midpoint of $\overline{AB}$. Give the value of $x$.` }
      : { prompt: md`Find $x$ in the figure.`, verify: [eq] };
  if (r.next() < 0.55) {
    const [a, b, c, d, v] = twoWays(r, x, 4, 30, 6);
    const eq = md`${lin(a, b)} = ${lin(c, d)}`;
    return {
      ...pose(eq),
      figure: collinearFigure(["A", "M", "B"], [{ length: v, label: lin(a, b), ticks: 1 }, { length: v, label: lin(c, d), ticks: 1 }]).figure,
      answer: String(x),
      hint: scaffold ? "A midpoint makes the two halves equal. Collect the x-terms on one side." : md`The tick marks say $AM = MB$. Collect the x-terms on one side.`,
      solution: [
        { math: md`AM = MB`, note: "Definition of midpoint." },
        { math: eq, note: "Substitute the two expressions." },
        ...solveLinear(a, b, c, d, x),
        { math: md`AM = MB = ${v}, \quad AB = ${2 * v}`, note: md`Substitute $x = ${x}$. The whole segment is twice either half.` },
      ],
    };
  }
  const [a, b] = split(r, x, r.int(4, 25), 5);
  const v = a * x + b;
  let c = 0;
  let d = 0;
  for (;;) {
    c = r.int(1, 12);
    d = 2 * v - c * x;
    if (c !== 2 * a && d !== 0 && Math.abs(d) <= 60) break;
  }
  const eq = md`2(${lin(a, b)}) = ${lin(c, d)}`;
  return {
    ...pose(eq),
    figure: collinearFigure(["A", "M", "B"], [{ length: v, label: lin(a, b), ticks: 1 }, { length: v, ticks: 1 }], lin(c, d)).figure,
    answer: String(x),
    hint: md`${scaffold ? "" : md`The tick marks say $M$ is the midpoint. `}$AB$ is the whole segment, so it is two copies of $AM$. Distribute the 2 first.`,
    solution: [
      { math: md`AM + MB = AB`, note: "Segment Addition Postulate." },
      { math: md`2 \cdot AM = AB`, note: md`$MB = AM$ by the definition of midpoint. Substitute.` },
      { math: eq, note: "Substitute the expressions." },
      { math: md`${lin(2 * a, 2 * b)} = ${lin(c, d)}`, note: "Distribute." },
      ...solveLinear(2 * a, 2 * b, c, d, x),
      { math: md`AM = ${v}, \quad AB = ${2 * v}`, note: md`Substitute $x = ${x}$.` },
    ],
  };
};

const rulerProblems: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.int(-12, 12);
    let b = r.int(-12, 12);
    while (b === a) b = r.int(-12, 12);
    const dist = Math.abs(a - b);
    return {
      prompt: md`The figure shows points $A$ and $B$ on a line, with their coordinates. Find $AB$. Give the length as a number.`,
      figure: coordinateFigure([{ name: "A", at: a, coord: String(a) }, { name: "B", at: b, coord: String(b) }], { ask: ["A", "B"] }),
      verify: [`x = abs(${a} - (${b}))`],
      answer: String(dist),
      hint: md`The Ruler Postulate says $AB = |a - b|$: subtract the coordinates, then drop the sign.`,
      solution: [
        { math: md`AB = |${a} - ${paren(b)}|`, note: "Ruler Postulate." },
        { math: md`= |${a - b}| = ${dist}`, note: "A distance is never negative." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(-12, 6);
    const b = a + 2 * r.int(2, 9);
    const m = (a + b) / 2;
    return {
      prompt: md`In the figure, $M$ is the midpoint of $\overline{AB}$. Give the coordinate of $M$.`,
      figure: coordinateFigure(
        [
          { name: "A", at: a, coord: String(a) },
          { name: "M", at: m, coord: "?" },
          { name: "B", at: b, coord: String(b) },
        ],
        { ticks: true },
      ),
      verify: [`x = (${a} + (${b}))/2`],
      answer: String(m),
      hint: md`The midpoint's coordinate is the average of the endpoints' coordinates, $\frac{a + b}{2}$.`,
      solution: [
        { math: md`m = \frac{${a} + ${paren(b)}}{2} = \frac{${a + b}}{2} = ${m}`, note: "Average the two coordinates." },
        { math: md`AM = |${m} - ${paren(a)}| = ${m - a}, \quad MB = |${b} - ${paren(m)}| = ${b - m}`, note: "Check: the two halves are equal." },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(-10, 10);
    const m = a + r.nonzero(-8, 8);
    const b = 2 * m - a;
    return {
      prompt: md`In the figure, $M$ is the midpoint of $\overline{AB}$. Give the coordinate of $B$.`,
      figure: coordinateFigure(
        [
          { name: "A", at: a, coord: String(a) },
          { name: "M", at: m, coord: String(m) },
          { name: "B", at: b, coord: "?" },
        ],
        { ticks: true },
      ),
      verify: [`(${a} + x)/2 = ${m}`],
      answer: String(b),
      hint: md`$B$ is as far beyond $M$ as $A$ is before it. Find the step from $A$ to $M$ and take it again.`,
      solution: [
        { math: md`${m} - ${paren(a)} = ${m - a}`, note: md`The step from $A$ to $M$ (signed, so it keeps the direction).` },
        { math: md`b = ${m} ${m - a < 0 ? "-" : "+"} ${Math.abs(m - a)} = ${b}`, note: "Take the same step again from M." },
        { math: md`\frac{${a} + ${paren(b)}}{2} = ${m} \;\checkmark`, note: "Check: the midpoint's coordinate is the average of the endpoints'." },
      ],
    };
  }
  const x = r.int(2, 9);
  const [a, b] = split(r, x, r.int(4, 30), 5);
  const [c, d] = split(r, x, r.int(4, 30), 5);
  const AB = a * x + b;
  const BC = c * x + d;
  const AC = AB + BC;
  const askAB = r.next() < 0.5;
  const { figure, toScale } = collinearFigure(["A", "B", "C"], [{ length: AB, label: lin(a, b), color: 1 }, { length: BC, label: lin(c, d), color: 2 }], String(AC));
  return {
    prompt: md`Find $${askAB ? "AB" : "BC"}$ in the figure. Give the length as a number.${toScale ? "" : " The figure is not drawn to scale."}`,
    figure,
    // The answer is the length s. Then x = (s - b)/a, and the pieces add to AC.
    verify: [askAB ? `s + ${c}(s - (${b}))/${a} + (${d}) = ${AC}` : `${a}(s - (${d}))/${c} + (${b}) + s = ${AC}`],
    answer: String(askAB ? AB : BC),
    hint: md`Write the Segment Addition Postulate, $AB + BC = AC$, solve it for $x$, then substitute.`,
    solution: [
      { math: md`(${lin(a, b)}) + (${lin(c, d)}) = ${AC}`, note: "Segment Addition Postulate." },
      { math: md`${lin(a + c, b + d)} = ${AC}`, note: "Combine like terms." },
      ...solveLinear(a + c, b + d, 0, AC, x),
      askAB
        ? { math: md`AB = ${a === 1 ? "" : a}(${x}) ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${AB}`, note: "Substitute x. The question asks for a length, not for x." }
        : { math: md`BC = ${c === 1 ? "" : c}(${x}) ${d < 0 ? "-" : "+"} ${Math.abs(d)} = ${BC}`, note: "Substitute x. The question asks for a length, not for x." },
    ],
  };
};

// ── Lesson 2: Angles and their measure ──────────────────────────────────────

const angleAddition: Generator = (r) => {
  const kind = r.int(0, 3);
  const x = r.int(4, 15);
  const scaffold = r.next() < 0.6;
  /** Hand over the equation, or show the figure alone and check the answer against the equation. */
  const pose = (eq: string, given: string) =>
    scaffold ? { prompt: md`Solve $${eq}$. It comes from the figure, where ${given}. Give the value of $x$.` } : { prompt: md`In the figure, ${given}. Find $x$.`, verify: [eq] };
  if (kind <= 1) {
    const [a, b] = split(r, x, r.int(20, 80));
    const [c, d] = split(r, x, r.int(20, 80));
    const p = a * x + b;
    const q = c * x + d;
    const whole = p + q;
    const e = a + c + r.int(1, 3);
    const f = whole - e * x;
    const wholeTex = kind === 0 ? md`${whole}^\circ` : degs(e, f);
    const rhs = kind === 0 ? String(whole) : lin(e, f);
    const eq = md`(${lin(a, b)}) + (${lin(c, d)}) = ${rhs}`;
    return {
      ...pose(eq, md`$\angle ABC = ${wholeTex}$`),
      figure: bisectFan(p, whole, [
        { from: "A", to: "D", label: degs(a, b), color: 1 },
        { from: "D", to: "C", label: degs(c, d), color: 2, arcs: 2 },
      ]),
      answer: String(x),
      hint: md`Angle Addition Postulate: $\angle ABD + \angle DBC = \angle ABC$. Combine like terms first.`,
      solution: [
        { math: eq, note: "Angle Addition Postulate: the two parts add to the whole." },
        { math: md`${lin(a + c, b + d)} = ${rhs}`, note: "Combine like terms." },
        ...solveLinear(a + c, b + d, kind === 0 ? 0 : e, kind === 0 ? whole : f, x),
        { math: md`\angle ABD = ${p}^\circ, \quad \angle DBC = ${q}^\circ`, note: md`Substitute $x = ${x}$. Check: $${p} + ${q} = ${whole}$.` },
      ],
    };
  }
  if (kind === 2) {
    const [a, b, c, d, v] = twoWays(r, x, 20, 85);
    const eq = md`${lin(a, b)} = ${lin(c, d)}`;
    return {
      ...pose(eq, md`$\overrightarrow{BD}$ bisects $\angle ABC$`),
      figure: bisectFan(v, 2 * v, [
        // Matching double arcs mark the congruent halves; the colours keep them apart.
        { from: "A", to: "D", label: degs(a, b), color: 1, arcs: 2 },
        { from: "D", to: "C", label: degs(c, d), color: 2, arcs: 2 },
      ]),
      answer: String(x),
      hint: "A bisector splits an angle into two equal angles. Collect the x-terms on one side.",
      solution: [
        { math: md`\angle ABD = \angle DBC`, note: "Definition of angle bisector." },
        { math: eq, note: "Substitute the expressions." },
        ...solveLinear(a, b, c, d, x),
        { math: md`\angle ABD = \angle DBC = ${v}^\circ, \quad \angle ABC = ${2 * v}^\circ`, note: md`Substitute $x = ${x}$.` },
      ],
    };
  }
  const [a, b] = split(r, x, r.int(20, 60));
  const v = a * x + b;
  let e = 0;
  let f = 0;
  for (;;) {
    e = r.int(1, 12);
    f = 2 * v - e * x;
    if (e !== 2 * a && f !== 0 && f >= -40 && f <= 120) break;
  }
  const eq = md`2(${lin(a, b)}) = ${lin(e, f)}`;
  return {
    ...pose(eq, md`$\overrightarrow{BD}$ bisects $\angle ABC$, and $\angle ABC = ${degs(e, f)}$`),
    figure: bisectFan(v, 2 * v, [
      { from: "A", to: "D", label: degs(a, b), color: 1, arcs: 2 },
      { from: "D", to: "C", color: 2, arcs: 2 },
    ]),
    answer: String(x),
    hint: md`The whole angle is two copies of $\angle ABD$. Distribute the 2 first.`,
    solution: [
      { math: md`2 \cdot \angle ABD = \angle ABC`, note: "A bisector makes the two halves equal, and they add to the whole." },
      { math: eq, note: "Substitute the expressions." },
      { math: md`${lin(2 * a, 2 * b)} = ${lin(e, f)}`, note: "Distribute." },
      ...solveLinear(2 * a, 2 * b, e, f, x),
      { math: md`\angle ABD = ${v}^\circ, \quad \angle ABC = ${2 * v}^\circ`, note: md`Substitute $x = ${x}$.` },
    ],
  };
};

const pairEquations: Generator = (r) => {
  const kind = r.int(0, 3);
  const x = r.int(4, 15);
  if (kind <= 2) {
    const scaffold = r.next() < 0.6;
    const total = kind === 0 ? 90 : 180;
    const v1 = kind === 2 ? pairAngle(r) : r.int(10, total - 10);
    const [a, b] = split(r, x, v1);
    const [c, d] = split(r, x, total - v1);
    const [n1, n2] = kind === 2 ? ["ABD", "DBC"] : r.pick([["P", "Q"], ["1", "2"], ["A", "B"]] as const);
    const eq = md`(${lin(a, b)}) + (${lin(c, d)}) = ${total}`;
    const reason =
      kind === 0 ? "Complementary angles add to 90 degrees." : kind === 1 ? "Supplementary angles add to 180 degrees." : "Linear Pair Postulate: a linear pair adds to 180 degrees.";
    const solution: Step[] = [
      { math: eq, note: reason },
      { math: md`${lin(a + c, b + d)} = ${total}`, note: "Combine like terms." },
      ...solveLinear(a + c, b + d, 0, total, x),
      { math: md`\angle ${n1} = ${v1}^\circ, \quad \angle ${n2} = ${total - v1}^\circ`, note: md`Substitute $x = ${x}$. Check: $${v1} + ${total - v1} = ${total}$.` },
    ];
    const hint = md`The two measures add to $${total}^\circ$. Combine like terms first.`;
    if (kind === 2) {
      return {
        prompt: scaffold ? md`Solve $${eq}$. It comes from the figure, where $\angle ABD$ and $\angle DBC$ form a linear pair. Give the value of $x$.` : md`Find $x$ in the figure.`,
        ...(scaffold ? {} : { verify: [eq] }),
        figure: linearPairFigure(180 - v1, [
          { from: "A", to: "D", label: degs(a, b), color: 1 },
          { from: "D", to: "C", label: degs(c, d), color: 2, arcs: 2 },
        ]),
        answer: String(x),
        hint: scaffold ? hint : md`$\angle ABD$ and $\angle DBC$ form a linear pair, so they add to $180^\circ$. Combine like terms first.`,
        solution,
      };
    }
    // Complementary and supplementary are about the numbers, not positions, so these stay without a figure.
    const relation = md`$\angle ${n1} = ${degs(a, b)}$ and $\angle ${n2} = ${degs(c, d)}$ are ${kind === 0 ? "complementary" : "supplementary"}`;
    return {
      prompt: scaffold ? md`Solve $${eq}$. It comes from two angles: ${relation}. Give the value of $x$.` : md`${relation}. Find $x$.`,
      ...(scaffold ? {} : { verify: [eq] }),
      answer: String(x),
      hint,
      solution,
    };
  }
  const supp = r.next() < 0.5;
  const total = supp ? 180 : 90;
  let m = 0;
  let k = 0;
  let angle = 0;
  for (;;) {
    m = r.int(2, 4);
    angle = r.int(supp ? 10 : 5, supp ? 50 : 25);
    k = total - angle - m * angle;
    if (k !== 0 && Math.abs(k) <= 40) break;
  }
  const which = supp ? "supplement" : "complement";
  return {
    prompt: md`The ${which} of an angle is $${Math.abs(k)}^\circ$ ${k > 0 ? "more" : "less"} than ${m} times the angle. Find the angle. Give just the number of degrees, like 35.`,
    // The angle and its complement or supplement, m x + k, make the total.
    verify: [`x + (${lin(m, k)}) = ${total}`],
    answer: String(angle),
    hint: md`Call the angle $x^\circ$ and write its ${which} in terms of $x$. Together they make $${total}^\circ$.`,
    solution: [
      { math: md`x + (${lin(m, k)}) = ${total}`, note: md`Call the angle $x^\circ$. Its ${which} is $(${lin(m, k)})^\circ$, and together they make $${total}^\circ$.` },
      { math: md`${lin(m + 1, k)} = ${total}`, note: "Combine like terms." },
      ...solveLinear(m + 1, k, 0, total, angle),
      { math: md`${m}(${angle}) ${k < 0 ? "-" : "+"} ${Math.abs(k)} = ${m * angle + k}`, note: md`Check: the ${which} is $${m * angle + k}^\circ$, and $${angle} + ${m * angle + k} = ${total}$.` },
    ],
  };
};

const angleMeasures: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    let k = r.int(5, 85);
    while (k === 45) k = r.int(5, 85);
    return {
      prompt: md`What is the complement of a $${k}^\circ$ angle? Give just the number of degrees, like 35.`,
      verify: [`x + ${k} = 90`],
      answer: String(90 - k),
      hint: "Complementary angles add to 90 degrees.",
      solution: [{ math: md`90^\circ - ${k}^\circ = ${90 - k}^\circ`, note: "Subtract from 90." }],
    };
  }
  if (kind === 1) {
    let k = r.int(5, 175);
    while (k === 90) k = r.int(5, 175);
    return {
      prompt: md`What is the supplement of a $${k}^\circ$ angle? Give just the number of degrees, like 35.`,
      verify: [`x + ${k} = 180`],
      answer: String(180 - k),
      hint: "Supplementary angles add to 180 degrees.",
      solution: [{ math: md`180^\circ - ${k}^\circ = ${180 - k}^\circ`, note: "Subtract from 180." }],
    };
  }
  if (kind === 2) {
    const whole = r.int(45, 170);
    const p = r.int(20, whole - 20);
    return {
      prompt: md`In the figure, $\angle ABC = ${whole}^\circ$. What is $\angle DBC$? Give just the number of degrees, like 35.`,
      figure: bisectFan(p, whole, [
        { from: "A", to: "D", label: md`${p}^\circ`, color: 1 },
        { from: "D", to: "C", label: "?", color: 2, arcs: 2 },
      ]),
      verify: [`${p} + x = ${whole}`],
      answer: String(whole - p),
      hint: md`Angle Addition Postulate: $\angle ABD + \angle DBC = \angle ABC$.`,
      solution: [
        { math: md`${p} + \angle DBC = ${whole}`, note: "Angle Addition Postulate." },
        { math: md`\angle DBC = ${whole - p}^\circ`, note: md`Subtract ${p} from both sides.` },
      ],
    };
  }
  if (kind === 3) {
    const k = r.int(20, 70);
    const hide = (name: string, deg: number) => ({ name, deg, label: "", hidden: true });
    return {
      prompt: md`In the figure, $\angle 1$ and $\angle 2$ are complementary, and $\angle 2$ and $\angle 3$ form a linear pair. If $\angle 1 = ${k}^\circ$, what is $\angle 3$? Give just the number of degrees, like 35.`,
      figure: angleDiagram([
        { vertex: "P", vertexLabel: "", rays: [hide("P1", 0), hide("P2", k)], marks: [{ from: "P1", to: "P2", label: "1", color: 1 }], len: 4, spins: spinRange(0, 30) },
        {
          vertex: "Q",
          vertexLabel: "",
          rays: [hide("Q1", 0), hide("Q2", 90 - k), hide("Q3", 180)],
          lines: [["Q1", "Q3"]],
          marks: [
            { from: "Q1", to: "Q2", label: "2", color: 2, arcs: 2 },
            { from: "Q2", to: "Q3", label: "3", color: 3, arcs: 3 },
          ],
          len: 4,
        },
      ]),
      // Angle 2 is what angle 1 leaves of 90, and angle 3 is what angle 2 leaves of 180.
      verify: [`x + (90 - ${k}) = 180`],
      answer: String(90 + k),
      hint: md`Find $\angle 2$ first, then use the Linear Pair Postulate.`,
      solution: [
        { math: md`\angle 2 = 90^\circ - ${k}^\circ = ${90 - k}^\circ`, note: "Complementary angles add to 90 degrees." },
        { math: md`\angle 3 = 180^\circ - ${90 - k}^\circ = ${90 + k}^\circ`, note: "Linear Pair Postulate: the pair adds to 180 degrees." },
      ],
    };
  }
  const x = r.int(4, 15);
  const rel = r.int(0, 2);
  const total = rel === 0 ? 90 : 180;
  const v1 = rel === 2 ? pairAngle(r) : r.int(10, total - 10);
  const [a, b] = split(r, x, v1);
  const [c, d] = split(r, x, total - v1);
  const askFirst = r.next() < 0.5;
  const names = rel === 2 ? ["ABD", "DBC"] : ["P", "Q"];
  const relation = rel === 0 ? "are complementary" : rel === 1 ? "are supplementary" : "form a linear pair";
  const target = askFirst ? names[0]! : names[1]!;
  return {
    prompt:
      rel === 2
        ? md`In the figure, what is $\angle ${target}$? Give just the number of degrees, like 35.`
        : md`$\angle ${names[0]} = ${degs(a, b)}$ and $\angle ${names[1]} = ${degs(c, d)}$ ${relation}. What is $\angle ${target}$? Give just the number of degrees, like 35.`,
    ...(rel === 2
      ? {
          figure: linearPairFigure(180 - v1, [
            { from: "A", to: "D", label: degs(a, b), color: 1 },
            { from: "D", to: "C", label: degs(c, d), color: 2, arcs: 2 },
          ]),
        }
      : {}),
    // The answer is the angle s. Recover x from it, then the two angles must make the total.
    verify: [askFirst ? `s + ${c}(s - (${b}))/${a} + (${d}) = ${total}` : `${a}(s - (${d}))/${c} + (${b}) + s = ${total}`],
    answer: String(askFirst ? v1 : total - v1),
    hint: md`Write an equation saying the two measures add to $${total}^\circ$, solve it for $x$, then substitute.`,
    solution: [
      { math: md`(${lin(a, b)}) + (${lin(c, d)}) = ${total}`, note: rel === 2 ? "Linear Pair Postulate." : `They add to ${total} degrees.` },
      { math: md`${lin(a + c, b + d)} = ${total}`, note: "Combine like terms." },
      ...solveLinear(a + c, b + d, 0, total, x),
      askFirst
        ? { math: md`\angle ${target} = ${a === 1 ? "" : a}(${x}) ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${v1}^\circ`, note: "Substitute x. The question asks for the angle, not for x." }
        : { math: md`\angle ${target} = ${c === 1 ? "" : c}(${x}) ${d < 0 ? "-" : "+"} ${Math.abs(d)} = ${total - v1}^\circ`, note: "Substitute x. The question asks for the angle, not for x." },
    ],
  };
};

// ── Lesson 3: Conditional statements ────────────────────────────────────────

/** The pieces of a conditional. Each clause has a form for the "if" slot and one for the "then" slot. */
interface Conditional {
  p: [string, string];
  q: [string, string];
  np: [string, string];
  nq: [string, string];
  /** Truth of the conditional and of its converse, each with the reason. */
  cond?: [boolean, string];
  conv?: [boolean, string];
}

/** Clauses about a subject: "two angles are ...", then "they are ...". */
function about(who: [string, string], p: string, q: string, np: string, nq: string): Pick<Conditional, "p" | "q" | "np" | "nq"> {
  const both = (s: string): [string, string] => [`${who[0]} ${s}`, `${who[1]} ${s}`];
  return { p: both(p), q: both(q), np: both(np), nq: both(nq) };
}

/** Clauses that already name their subject. */
function plain(p: string, q: string, np: string, nq: string): Pick<Conditional, "p" | "q" | "np" | "nq"> {
  return { p: [p, p], q: [q, q], np: [np, np], nq: [nq, nq] };
}

const ifThen = (h: string, c: string) => `If ${h}, then ${c}.`;

function forms(s: Conditional) {
  return {
    conditional: ifThen(s.p[0], s.q[1]),
    converse: ifThen(s.q[0], s.p[1]),
    inverse: ifThen(s.np[0], s.nq[1]),
    contrapositive: ifThen(s.nq[0], s.np[1]),
  };
}

const CONDITIONALS: ((r: Rng) => Conditional)[] = [
  () => ({
    ...about(["an angle", "it"], md`measures $90^\circ$`, "is a right angle", md`does not measure $90^\circ$`, "is not a right angle"),
    cond: [true, md`This is the definition of a right angle.`],
    conv: [true, md`The definition works both ways: a right angle measures $90^\circ$.`],
  }),
  () => ({
    ...about(["two angles", "they"], "form a linear pair", "are supplementary", "do not form a linear pair", "are not supplementary"),
    cond: [true, "This is the Linear Pair Postulate."],
    conv: [false, md`Counterexample: a $130^\circ$ angle and a $50^\circ$ angle far apart are supplementary but not a linear pair.`],
  }),
  () => ({
    ...about(["a figure", "it"], "is a square", "is a rectangle", "is not a square", "is not a rectangle"),
    cond: [true, "Every square has four right angles, so it is a rectangle."],
    conv: [false, md`Counterexample: a $2$ by $5$ rectangle is not a square.`],
  }),
  () => ({
    ...about(["a number", "it"], "is divisible by 6", "is even", "is not divisible by 6", "is not even"),
    cond: [true, md`A multiple of 6 is $6k = 2(3k)$, a multiple of 2.`],
    conv: [false, "Counterexample: 4 is even but not divisible by 6."],
  }),
  (r) => {
    const k = r.int(2, 12);
    return {
      ...plain(md`$x = ${k}$`, md`$x^2 = ${k * k}$`, md`$x \ne ${k}$`, md`$x^2 \ne ${k * k}$`),
      cond: [true, md`Squaring ${k} gives ${k * k}.`],
      conv: [false, md`Counterexample: $x = -${k}$ also has $x^2 = ${k * k}$.`],
    };
  },
  () => ({
    ...plain(md`$M$ is the midpoint of $\overline{AB}$`, md`$AM = MB$`, md`$M$ is not the midpoint of $\overline{AB}$`, md`$AM \ne MB$`),
    cond: [true, "This is the definition of midpoint."],
    conv: [false, md`Counterexample: $M$ can be off the line, like the top of a tent whose two sides from $A$ and $B$ are equal.`],
  }),
  () => ({
    ...about(["three points", "they"], "are collinear", "are coplanar", "are not collinear", "are not coplanar"),
    cond: [true, "Pick a point off their line. It and two of the three points are not collinear, so some plane contains them. That plane contains the line through those two points, so it contains the third point too."],
    conv: [false, "Counterexample: the three corners of a triangle are coplanar but not collinear."],
  }),
  (r) => {
    const k = r.pick([20, 30, 40, 50, 60, 70]);
    return {
      ...about(["an angle", "it"], md`measures $${k}^\circ$`, "is acute", md`does not measure $${k}^\circ$`, "is not acute"),
      cond: [true, md`$${k}^\circ$ is between $0^\circ$ and $90^\circ$.`],
      conv: [false, md`Counterexample: a $${k === 20 ? 10 : k - 10}^\circ$ angle is acute too.`],
    };
  },
  (r) => {
    const k = r.int(2, 12);
    return {
      ...plain(md`$x^2 = ${k * k}$`, md`$x = ${k}$`, md`$x^2 \ne ${k * k}$`, md`$x \ne ${k}$`),
      cond: [false, md`Counterexample: $x = -${k}$.`],
      conv: [true, md`Squaring ${k} gives ${k * k}.`],
    };
  },
  () => ({
    ...about(["two angles", "they"], "are supplementary", "are congruent", "are not supplementary", "are not congruent"),
    cond: [false, md`Counterexample: $120^\circ$ and $60^\circ$ are supplementary but not congruent.`],
    conv: [false, md`Counterexample: two $30^\circ$ angles are congruent but not supplementary.`],
  }),
  () => ({
    ...about(["a number", "it"], "is even", "is divisible by 3", "is not even", "is not divisible by 3"),
    cond: [false, "Counterexample: 2 is even but not divisible by 3."],
    conv: [false, "Counterexample: 3 is divisible by 3 but not even."],
  }),
  () => ({
    ...about(["an angle", "it"], "is acute", "is a right angle", "is not acute", "is not a right angle"),
    cond: [false, md`Counterexample: a $30^\circ$ angle is acute, not right.`],
    conv: [false, md`Counterexample: a right angle measures exactly $90^\circ$, so it is not acute.`],
  }),
  (r) => {
    const k = r.int(2, 9);
    const m = k + r.int(3, 12);
    return {
      ...plain(md`$x + ${k} = ${m}$`, md`$x = ${m - k}$`, md`$x + ${k} \ne ${m}$`, md`$x \ne ${m - k}$`),
      cond: [true, md`Subtract ${k} from both sides.`],
      conv: [true, md`Add ${k} to both sides: $${m - k} + ${k} = ${m}$.`],
    };
  },
  () => ({
    ...about(["two segments", "they"], "have the same length", "are congruent", "do not have the same length", "are not congruent"),
    cond: [true, "This is the definition of congruent segments."],
    conv: [true, "The definition works both ways."],
  }),
  () => ({
    ...about(["two angles", "they"], "are complementary", "are both acute", "are not complementary", "are not both acute"),
    cond: [true, md`Two positive measures that add to $90^\circ$ are each less than $90^\circ$.`],
    conv: [false, md`Counterexample: two $30^\circ$ angles are both acute but add to $60^\circ$.`],
  }),
  () => ({
    ...about(["an animal", "it"], "is a bird", "can fly", "is not a bird", "cannot fly"),
    cond: [false, "Counterexample: a penguin is a bird that cannot fly."],
    conv: [false, "Counterexample: a bat can fly but is not a bird."],
  }),
  () => ({
    ...plain("it is raining", "the ground is wet", "it is not raining", "the ground is not wet"),
    cond: [true, "Rain wets the ground (take this as given)."],
    conv: [false, "Counterexample: a sprinkler wets the ground on a dry day."],
  }),
];

const FORM_NAMES = ["converse", "inverse", "contrapositive"] as const;

const identifyForm: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 3) return trueBiconditional(r);
  let s = r.pick(CONDITIONALS)(r);
  // Kind 2 asks which form matches in truth value. Use only statements whose
  // converse differs in truth, so exactly one option matches this statement too.
  while (kind === 2 && s.cond![0] === s.conv![0]) s = r.pick(CONDITIONALS)(r);
  const f = forms(s);
  const recipe = md`Converse: swap. Inverse: negate both parts. Contrapositive: swap **and** negate.`;
  if (kind === 0) {
    const target = r.pick(FORM_NAMES);
    return {
      prompt: md`Here is a conditional: "${f.conditional}" Which statement is its **${target}**?`,
      choices: shuffle(r, FORM_NAMES.map((n) => f[n])),
      accept: [f[target]],
      hint: recipe,
      solution: [
        { math: md`p \to q`, note: md`The conditional: "${f.conditional}"` },
        {
          math: target === "converse" ? md`q \to p` : target === "inverse" ? md`\text{not } p \to \text{not } q` : md`\text{not } q \to \text{not } p`,
          note: md`The ${target}: "${f[target]}"`,
        },
      ],
    };
  }
  if (kind === 1) {
    const target = r.pick(FORM_NAMES);
    return {
      prompt: md`Conditional: "${f.conditional}" Statement: "${f[target]}" How is the statement related to the conditional?`,
      choices: shuffle(r, FORM_NAMES.map(capital)),
      accept: [capital(target)],
      hint: md`Compare the parts. Were they swapped? Were they negated? ${recipe}`,
      solution: [
        {
          math: target === "converse" ? md`q \to p` : target === "inverse" ? md`\text{not } p \to \text{not } q` : md`\text{not } q \to \text{not } p`,
          note:
            target === "converse"
              ? "The hypothesis and conclusion were swapped, with no negation: the converse."
              : target === "inverse"
                ? "Both parts were negated but stayed in place: the inverse."
                : "The parts were swapped and both negated: the contrapositive.",
        },
      ],
    };
  }
  const fromConverse = r.next() < 0.4;
  const ref = fromConverse ? f.converse : f.conditional;
  const options = fromConverse ? [f.conditional, f.inverse, f.contrapositive] : [f.converse, f.inverse, f.contrapositive];
  const right = fromConverse ? f.inverse : f.contrapositive;
  return {
    prompt: md`Which statement always has the same truth value as "${ref}"?`,
    choices: shuffle(r, options),
    accept: [right],
    hint: "A statement and its contrapositive always agree. Find the contrapositive of the given statement.",
    solution: [
      {
        math: md`\text{not } q \to \text{not } p \;\equiv\; p \to q`,
        note: md`A conditional is false only when its hypothesis is true and its conclusion false, and its contrapositive fails in exactly that same case.`,
      },
      {
        math: fromConverse ? md`\text{inverse} \equiv \text{converse}` : md`\text{contrapositive} \equiv \text{conditional}`,
        note: fromConverse
          ? md`The inverse is the contrapositive of the converse, so it matches the converse: "${right}"`
          : md`So the answer is the contrapositive: "${right}"`,
      },
    ],
  };
};

/** Which biconditional is true: one whose two directions both hold, against three that hold one way only. */
function trueBiconditional(r: Rng) {
  const all = CONDITIONALS.map((make) => make(r));
  const right = r.pick(all.filter((c) => c.cond![0] && c.conv![0]));
  const wrong = shuffle(r, all.filter((c) => c.cond![0] && !c.conv![0])).slice(0, 3);
  const bic = (c: Conditional) => `${capital(c.p[0])} if and only if ${c.q[1]}.`;
  const choices = shuffle(r, [right, ...wrong]);
  return {
    prompt: md`Which of these biconditionals is true?`,
    choices: choices.map(bic),
    accept: [bic(right)],
    hint: "A biconditional says two things: the conditional and its converse. It is true only when both directions hold.",
    solution: choices.map((c): Step =>
      c === right
        ? { math: md`p \leftrightarrow q: \ \text{true}`, note: md`"${bic(c)}" Both directions hold. ${c.cond![1]} ${c.conv![1]}` }
        : { math: md`p \leftrightarrow q: \ \text{false}`, note: md`"${bic(c)}" The converse, "${forms(c).converse}", is false. ${c.conv![1]}` },
    ),
  };
}

const counterexample: Generator = (r) => {
  const kind = r.int(0, 5);
  const hint = "A counterexample makes the hypothesis true and the conclusion false. Find every x that makes the hypothesis true, then see which one breaks the conclusion.";
  const ask = (hyp: string, concl: string) =>
    md`The statement "If $${hyp}$, then $${concl}$." is false. Exactly one real number $x$ is a counterexample. Give that value of $x$.`;
  const finish = (ans: number, hyp: string, concl: string): Step => ({
    math: md`x = ${ans}`,
    note: md`With $x = ${ans}$ the hypothesis $${hyp}$ is true and the conclusion $${concl}$ is false.`,
  });
  if (kind === 0 || kind === 5) {
    const k = r.int(2, 12);
    const hyp = md`x^2 = ${k * k}`;
    const concl = kind === 0 ? md`x = ${k}` : md`x > 0`;
    return {
      prompt: ask(hyp, concl),
      answer: String(-k),
      hint,
      solution: [{ math: md`x = ${k} \text{ or } x = -${k}`, note: md`Both square to ${k * k}.` }, finish(-k, hyp, concl)],
    };
  }
  if (kind === 1) {
    const k = r.int(2, 15);
    const hyp = md`|x| = ${k}`;
    const concl = md`x = ${k}`;
    return {
      prompt: ask(hyp, concl),
      answer: String(-k),
      hint,
      solution: [{ math: md`x = ${k} \text{ or } x = -${k}`, note: md`Both are ${k} units from 0.` }, finish(-k, hyp, concl)],
    };
  }
  if (kind === 2) {
    const k = r.int(2, 9);
    const hyp = md`x^2 = ${k}x`;
    const concl = md`x = ${k}`;
    return {
      prompt: ask(hyp, concl),
      answer: "0",
      hint,
      solution: [
        { math: md`x^2 - ${k}x = 0 \;\Rightarrow\; x(x - ${k}) = 0`, note: "Move everything to one side and factor." },
        { math: md`x = 0 \text{ or } x = ${k}`, note: "A product is zero only when a factor is zero." },
        finish(0, hyp, concl),
      ],
    };
  }
  if (kind === 3) {
    const a = r.nonzero(-9, 9);
    let b = r.nonzero(-9, 9);
    while (b === a) b = r.nonzero(-9, 9);
    const hyp = md`(${poly([[1, "x"], [-a, ""]])})(${poly([[1, "x"], [-b, ""]])}) = 0`;
    const concl = md`x = ${a}`;
    return {
      prompt: ask(hyp, concl),
      answer: String(b),
      hint,
      solution: [{ math: md`x = ${a} \text{ or } x = ${b}`, note: "A product is zero only when one of its factors is zero." }, finish(b, hyp, concl)],
    };
  }
  const c = r.nonzero(-8, 8);
  const d = r.int(2, 9);
  const hyp = md`|${poly([[1, "x"], [-c, ""]])}| = ${d}`;
  const concl = md`x = ${c + d}`;
  return {
    prompt: ask(hyp, concl),
    answer: String(c - d),
    hint,
    solution: [
      { math: md`x - ${paren(c)} = ${d} \text{ or } x - ${paren(c)} = -${d}`, note: md`$x$ is ${d} units from ${c}, on either side.` },
      { math: md`x = ${c + d} \text{ or } x = ${c - d}`, note: c > 0 ? `Add ${c} to both sides of each equation.` : `Subtract ${-c} from both sides of each equation.` },
      finish(c - d, hyp, concl),
    ],
  };
};

const countTrue: Generator = (r) => {
  const s = r.pick(CONDITIONALS)(r);
  const f = forms(s);
  const [cond, condWhy] = s.cond!;
  const [conv, convWhy] = s.conv!;
  const tf = (b: boolean) => (b ? "true" : "false");
  const count = 2 * Number(cond) + 2 * Number(conv);
  return {
    prompt: md`Conditional: "${f.conditional}" Count how many of these four statements are true: the conditional, its converse, its inverse and its contrapositive. Give a whole number.`,
    answer: String(count),
    hint: "You only need to decide two of them. The contrapositive always agrees with the conditional, and the inverse always agrees with the converse.",
    solution: [
      { math: md`\text{conditional: ${tf(cond)}}`, note: condWhy },
      { math: md`\text{contrapositive: ${tf(cond)}}`, note: "A conditional and its contrapositive always have the same truth value." },
      { math: md`\text{converse: ${tf(conv)}}`, note: md`"${f.converse}" ${convWhy}` },
      { math: md`\text{inverse: ${tf(conv)}}`, note: "The inverse is the contrapositive of the converse, so it agrees with the converse." },
      { math: String(count), note: "Count the true ones." },
    ],
  };
};

// ── Lesson 4: Your first proofs ─────────────────────────────────────────────

const PROPS = [
  "Reflexive Property",
  "Symmetric Property",
  "Transitive Property",
  "Substitution Property",
  "Addition Property of Equality",
  "Subtraction Property of Equality",
  "Multiplication Property of Equality",
  "Division Property of Equality",
  "Distributive Property",
] as const;
type Prop = (typeof PROPS)[number];

/** Properties that could fairly be argued for the same step, so they never appear as each other's wrong options. */
const PARTNER: Partial<Record<Prop, Prop>> = {
  "Addition Property of Equality": "Subtraction Property of Equality",
  "Subtraction Property of Equality": "Addition Property of Equality",
  "Multiplication Property of Equality": "Division Property of Equality",
  "Division Property of Equality": "Multiplication Property of Equality",
  "Transitive Property": "Substitution Property",
  "Substitution Property": "Transitive Property",
};

const PROPERTY_STEPS: ((r: Rng) => { step: string; prop: Prop; why: string })[] = [
  (r) => {
    const a = r.int(2, 15);
    const b = r.int(1, 20);
    return { step: md`From $x - ${a} = ${b}$ to $x = ${a + b}$.`, prop: "Addition Property of Equality", why: md`${a} was added to both sides.` };
  },
  () => ({ step: md`From $AB = CD$ to $AB + BC = CD + BC$.`, prop: "Addition Property of Equality", why: md`$BC$ was added to both sides.` }),
  (r) => {
    const a = r.int(2, 15);
    const c = a + r.int(1, 20);
    return { step: md`From $x + ${a} = ${c}$ to $x = ${c - a}$.`, prop: "Subtraction Property of Equality", why: md`${a} was subtracted from both sides.` };
  },
  () => ({
    step: md`From $\angle 1 + \angle 2 = \angle 2 + \angle 3$ to $\angle 1 = \angle 3$.`,
    prop: "Subtraction Property of Equality",
    why: md`$\angle 2$ was subtracted from both sides.`,
  }),
  (r) => {
    const k = r.int(2, 9);
    const m = r.int(2, 12);
    return { step: md`From $\frac{x}{${k}} = ${m}$ to $x = ${k * m}$.`, prop: "Multiplication Property of Equality", why: md`Both sides were multiplied by ${k}.` };
  },
  () => ({ step: md`From $\frac{1}{2}AB = AM$ to $AB = 2 \cdot AM$.`, prop: "Multiplication Property of Equality", why: "Both sides were multiplied by 2." }),
  (r) => {
    const k = r.int(2, 9);
    const m = r.int(2, 12);
    return { step: md`From $${k}x = ${k * m}$ to $x = ${m}$.`, prop: "Division Property of Equality", why: md`Both sides were divided by ${k}.` };
  },
  (r) => {
    const v = r.int(10, 80);
    return { step: md`From $2 \cdot \angle ABD = ${2 * v}^\circ$ to $\angle ABD = ${v}^\circ$.`, prop: "Division Property of Equality", why: "Both sides were divided by 2." };
  },
  (r) => {
    const k = r.int(2, 6);
    const a = r.int(1, 9);
    const n = k * (a + r.int(1, 9));
    return {
      step: md`From $${k}(x + ${a}) = ${n}$ to $${k}x + ${k * a} = ${n}$.`,
      prop: "Distributive Property",
      why: md`The ${k} was multiplied into each term inside the parentheses.`,
    };
  },
  (r) => {
    const v = r.int(3, 20);
    return { step: md`From $AB + BC = AC$ and $AB = ${v}$ to $${v} + BC = AC$.`, prop: "Substitution Property", why: md`$${v}$ replaced its equal, $AB$.` };
  },
  (r) => {
    const v = r.int(20, 160);
    return {
      step: md`From $\angle 1 + \angle 2 = 180^\circ$ and $\angle 2 = ${v}^\circ$ to $\angle 1 + ${v}^\circ = 180^\circ$.`,
      prop: "Substitution Property",
      why: md`$${v}^\circ$ replaced its equal, $\angle 2$.`,
    };
  },
  () => ({
    step: md`From $\angle 1 = \angle 2$ and $\angle 2 = \angle 3$ to $\angle 1 = \angle 3$.`,
    prop: "Transitive Property",
    why: "Two quantities equal to the same quantity are equal to each other.",
  }),
  () => ({ step: md`From $AB = CD$ and $CD = EF$ to $AB = EF$.`, prop: "Transitive Property", why: "Two quantities equal to the same quantity are equal to each other." }),
  (r) => {
    const v = r.int(2, 30);
    return { step: md`From $${v} = x$ to $x = ${v}$.`, prop: "Symmetric Property", why: "The two sides were swapped." };
  },
  () => ({ step: md`From $\angle A = \angle B$ to $\angle B = \angle A$.`, prop: "Symmetric Property", why: "The two sides were swapped." }),
  () => ({ step: md`A proof line says $BC = BC$, using no earlier line.`, prop: "Reflexive Property", why: "Every quantity equals itself." }),
  () => ({ step: md`A proof line says $\angle ABC = \angle ABC$, using no earlier line.`, prop: "Reflexive Property", why: "Every quantity equals itself." }),
];

/** Every kind of reason the unit's proofs cite. */
const REASONS = [
  "Given",
  "Definition of midpoint",
  "Definition of angle bisector",
  "Definition of linear pair",
  "Definition of complementary angles",
  "Segment Addition Postulate",
  "Angle Addition Postulate",
  "Linear Pair Postulate",
  "Vertical Angles Theorem",
  ...PROPS,
] as const;
type Reason = (typeof REASONS)[number];

/** A proof line: statement, reason, and why the reason fits (lines without a why are never blanked). */
type ProofLine = [statement: string, reason: Reason | "Commutative Property of Addition", why?: string];

/** Two-column proofs from this unit, some with fresh numbers. */
const PROOFS: ((r: Rng) => { given: string; prove: string; lines: ProofLine[] })[] = [
  () => ({
    given: md`$M$ is the midpoint of $\overline{AB}$.`,
    prove: md`$AB = 2 \cdot AM$`,
    lines: [
      [md`$M$ is the midpoint of $\overline{AB}$`, "Given", "The problem states it."],
      [md`$AM = MB$`, "Definition of midpoint", "A midpoint makes the two halves equal."],
      [md`$AM + MB = AB$`, "Segment Addition Postulate", md`$M$ is between $A$ and $B$, so the pieces add to the whole.`],
      [md`$AM + AM = AB$`, "Substitution Property", md`$AM$ replaced its equal, $MB$, from line 2.`],
      [md`$2 \cdot AM = AB$`, "Distributive Property", md`Combining like terms: $AM + AM = (1 + 1)AM$.`],
      [md`$AB = 2 \cdot AM$`, "Symmetric Property", "The two sides were swapped."],
    ],
  }),
  () => ({
    given: md`$\overrightarrow{BD}$ bisects $\angle ABC$.`,
    prove: md`$\angle ABD = \frac{1}{2}\angle ABC$`,
    lines: [
      [md`$\overrightarrow{BD}$ bisects $\angle ABC$`, "Given", "The problem states it."],
      [md`$\angle ABD = \angle DBC$`, "Definition of angle bisector", "A bisector splits the angle into two equal angles."],
      [md`$\angle ABD + \angle DBC = \angle ABC$`, "Angle Addition Postulate", "The bisector lies inside the angle, so the parts add to the whole."],
      [md`$\angle ABD + \angle ABD = \angle ABC$`, "Substitution Property", md`$\angle ABD$ replaced its equal, $\angle DBC$, from line 2.`],
      [md`$2 \cdot \angle ABD = \angle ABC$`, "Distributive Property", "Combining like terms."],
      [md`$\angle ABD = \frac{1}{2}\angle ABC$`, "Division Property of Equality", "Both sides were divided by 2."],
    ],
  }),
  () => ({
    given: md`$A$, $B$, $C$, $D$ lie on a line in that order, and $AB = CD$.`,
    prove: md`$AC = BD$`,
    lines: [
      [md`$AB = CD$`, "Given", "The problem states it."],
      [md`$AB + BC = CD + BC$`, "Addition Property of Equality", md`$BC$ was added to both sides.`],
      [md`$AB + BC = AC$ and $BC + CD = BD$`, "Segment Addition Postulate", md`$B$ is between $A$ and $C$, and $C$ is between $B$ and $D$.`],
      [md`$CD + BC = BD$`, "Commutative Property of Addition"],
      [md`$AC = BD$`, "Substitution Property", "Each side of line 2 was replaced by its equal from lines 3 and 4."],
    ],
  }),
  () => ({
    given: md`Lines $\overleftrightarrow{AC}$ and $\overleftrightarrow{BD}$ intersect at $E$, forming $\angle 1$, $\angle 2$, $\angle 3$ and $\angle 4$ in order around $E$.`,
    prove: md`$\angle 1 = \angle 3$`,
    lines: [
      [md`$\angle 1$ and $\angle 2$ form a linear pair, and so do $\angle 2$ and $\angle 3$`, "Definition of linear pair", "Each pair is adjacent, and its other sides are opposite rays."],
      [md`$\angle 1 + \angle 2 = 180^\circ$`, "Linear Pair Postulate", "A linear pair adds to 180 degrees."],
      [md`$\angle 2 + \angle 3 = 180^\circ$`, "Linear Pair Postulate", "A linear pair adds to 180 degrees."],
      [md`$\angle 1 + \angle 2 = \angle 2 + \angle 3$`, "Substitution Property", md`$\angle 2 + \angle 3$ replaced its equal, $180^\circ$, in line 2.`],
      [md`$\angle 1 = \angle 3$`, "Subtraction Property of Equality", md`$\angle 2$ was subtracted from both sides.`],
    ],
  }),
  (r) => {
    const k = r.int(20, 160);
    return {
      given: md`$\angle 1$ and $\angle 2$ form a linear pair, and $\angle 1 = ${k}^\circ$.`,
      prove: md`$\angle 2 = ${180 - k}^\circ$`,
      lines: [
        [md`$\angle 1$ and $\angle 2$ form a linear pair`, "Given", "The problem states it."],
        [md`$\angle 1 + \angle 2 = 180^\circ$`, "Linear Pair Postulate", "A linear pair adds to 180 degrees."],
        [md`$\angle 1 = ${k}^\circ$`, "Given", "The problem states it."],
        [md`$${k}^\circ + \angle 2 = 180^\circ$`, "Substitution Property", md`$${k}^\circ$ replaced its equal, $\angle 1$.`],
        [md`$\angle 2 = ${180 - k}^\circ$`, "Subtraction Property of Equality", md`$${k}^\circ$ was subtracted from both sides.`],
      ],
    };
  },
  (r) => {
    const k = r.int(10, 80);
    return {
      given: md`$\angle P$ and $\angle Q$ are complementary, and $\angle P = ${k}^\circ$.`,
      prove: md`$\angle Q = ${90 - k}^\circ$`,
      lines: [
        [md`$\angle P$ and $\angle Q$ are complementary`, "Given", "The problem states it."],
        [md`$\angle P + \angle Q = 90^\circ$`, "Definition of complementary angles", "Complementary angles add to 90 degrees."],
        [md`$\angle P = ${k}^\circ$`, "Given", "The problem states it."],
        [md`$${k}^\circ + \angle Q = 90^\circ$`, "Substitution Property", md`$${k}^\circ$ replaced its equal, $\angle P$.`],
        [md`$\angle Q = ${90 - k}^\circ$`, "Subtraction Property of Equality", md`$${k}^\circ$ was subtracted from both sides.`],
      ],
    };
  },
];

/** A proof with one reason hidden: name it. */
function missingReason(r: Rng) {
  const { given, prove, lines } = r.pick(PROOFS)(r);
  const blankable = lines.flatMap((l, i) => (l[2] ? [i] : []));
  const k = r.pick(blankable);
  const [, right, why] = lines[k]! as [string, Reason, string];
  const partner = (PARTNER as Partial<Record<string, string>>)[right];
  const wrong = shuffle(
    r,
    REASONS.filter((p) => p !== right && p !== partner),
  ).slice(0, 3);
  const shown = lines.map(([st, reason], i) => md`**${i + 1}.** ${st} (${i === k ? "**?**" : reason}).`).join(" ");
  return {
    prompt: md`Given: ${given} Prove: ${prove}. ${shown} Which reason belongs in line ${k + 1}?`,
    choices: shuffle(r, [right, ...wrong]),
    accept: [right],
    hint: "Ask where the statement comes from: the given, a definition, a postulate, a property of equality, or a theorem already proved.",
    solution: [{ math: md`\text{${right}}`, note: why }],
  };
}

const whichProperty: Generator = (r) => {
  if (r.next() < 0.4) return missingReason(r);
  const { step, prop, why } = r.pick(PROPERTY_STEPS)(r);
  const wrong = shuffle(
    r,
    PROPS.filter((p) => p !== prop && p !== PARTNER[prop]),
  ).slice(0, 3);
  return {
    prompt: md`Which property justifies this step? ${step}`,
    choices: shuffle(r, [prop, ...wrong]),
    accept: [prop],
    hint: "Ask what was done: something added, subtracted, multiplied or divided on both sides? Something replaced by its equal? Sides swapped?",
    solution: [{ math: md`\text{${prop}}`, note: why }],
  };
};

/** The four angles where lines AC and BD cross at E, in order around E. Opposite entries are vertical. */
const AROUND = ["AEB", "BEC", "CED", "DEA"] as const;
type Around = (typeof AROUND)[number];
const FIGURE = md`Lines $\overleftrightarrow{AC}$ and $\overleftrightarrow{BD}$ intersect at $E$.`;

/** The turn from ray EC to ray EB that makes angle `name` measure `deg`. */
const thetaFor = (name: Around, deg: number) => (name === "BEC" || name === "DEA" ? deg : 180 - deg);

/** Lines AC and BD crossing at E with angle BEC = theta, drawn to scale, with labelled angle marks. */
function crossingFigure(theta: number, marks: { angle: Around; label: string; color: SeriesColor; arcs?: 1 | 2 }[]): Diagram {
  return angleDiagram([
    {
      vertex: "E",
      rays: [
        { name: "C", deg: 0 },
        { name: "B", deg: theta },
        { name: "A", deg: 180 },
        { name: "D", deg: 180 + theta },
      ],
      lines: [
        ["A", "C"],
        ["D", "B"],
      ],
      marks: marks.map((m) => ({ from: m.angle[0]!, to: m.angle[2]!, label: m.label, color: m.color, arcs: m.arcs })),
      spins: spinRange(-25, 25),
    },
  ]);
}

const verticalLinear: Generator = (r) => {
  const x = r.int(4, 15);
  const i = r.int(0, 3);
  // Without the scaffold the learner must tell from the figure which relation holds.
  const scaffold = r.next() < 0.6;
  if (r.next() < 0.5) {
    const [n1, n2] = r.next() < 0.5 ? [AROUND[i]!, AROUND[(i + 2) % 4]!] : [AROUND[(i + 2) % 4]!, AROUND[i]!];
    const [a, b, c, d, v] = twoWays(r, x, 20, 160);
    const eq = md`${lin(a, b)} = ${lin(c, d)}`;
    return {
      prompt: scaffold
        ? md`Solve $${eq}$. It comes from the figure, where the vertical angles $\angle ${n1}$ and $\angle ${n2}$ are congruent. Give the value of $x$.`
        : md`Find $x$ in the figure.`,
      ...(scaffold ? {} : { verify: [eq] }),
      figure: crossingFigure(thetaFor(n1, v), [
        { angle: n1, label: degs(a, b), color: 1 },
        { angle: n2, label: degs(c, d), color: 2 },
      ]),
      answer: String(x),
      hint: md`${scaffold ? "" : md`$\angle ${n1}$ and $\angle ${n2}$ sit opposite each other at $E$, so they are vertical angles. `}Vertical angles are congruent, so the two expressions are equal. Collect the x-terms on one side.`,
      solution: [
        { math: md`\angle ${n1} = \angle ${n2}`, note: "Vertical Angles Theorem." },
        { math: eq, note: "Substitute the expressions." },
        ...solveLinear(a, b, c, d, x),
        { math: md`\angle ${n1} = \angle ${n2} = ${v}^\circ`, note: md`Substitute $x = ${x}$. Check: both expressions give ${v}.` },
      ],
    };
  }
  const [n1, n2] = r.next() < 0.5 ? [AROUND[i]!, AROUND[(i + 1) % 4]!] : [AROUND[(i + 1) % 4]!, AROUND[i]!];
  const v1 = pairAngle(r);
  const [a, b] = split(r, x, v1);
  const [c, d] = split(r, x, 180 - v1);
  const eq = md`(${lin(a, b)}) + (${lin(c, d)}) = 180`;
  return {
    prompt: scaffold
      ? md`Solve $${eq}$. It comes from the figure, where the adjacent angles $\angle ${n1}$ and $\angle ${n2}$ form a linear pair. Give the value of $x$.`
      : md`Find $x$ in the figure.`,
    ...(scaffold ? {} : { verify: [eq] }),
    figure: crossingFigure(thetaFor(n1, v1), [
      { angle: n1, label: degs(a, b), color: 1 },
      { angle: n2, label: degs(c, d), color: 2, arcs: 2 },
    ]),
    answer: String(x),
    hint: md`${scaffold ? "" : md`$\angle ${n1}$ and $\angle ${n2}$ share the side $\overrightarrow{E${AROUND[i]![2]}}$, and their other sides are opposite rays, so they form a linear pair. `}A linear pair adds to $180^\circ$. Combine like terms first.`,
    solution: [
      { math: eq, note: "Linear Pair Postulate." },
      { math: md`${lin(a + c, b + d)} = 180`, note: "Combine like terms." },
      ...solveLinear(a + c, b + d, 0, 180, x),
      { math: md`\angle ${n1} = ${v1}^\circ, \quad \angle ${n2} = ${180 - v1}^\circ`, note: md`Substitute $x = ${x}$. Check: they add to 180.` },
    ],
  };
};

const verticalMeasure: Generator = (r) => {
  const kind = r.int(0, 2);
  const i = r.int(0, 3);
  const given = AROUND[i]!;
  if (kind === 0) {
    const k = pairAngle(r);
    const j = (i + r.int(1, 3)) % 4;
    const target = AROUND[j]!;
    const vertical = (j - i + 4) % 4 === 2;
    const ans = vertical ? k : 180 - k;
    return {
      prompt: md`${FIGURE} What is $\angle ${target}$ in the figure? Give just the number of degrees, like 35.`,
      figure: crossingFigure(thetaFor(given, k), [
        { angle: given, label: md`${k}^\circ`, color: 1 },
        { angle: target, label: "?", color: 2, arcs: 2 },
      ]),
      verify: [vertical ? `x = ${k}` : `x + ${k} = 180`],
      answer: String(ans),
      hint: "Look at the four angles around E. Opposite angles are vertical; neighbouring angles form a linear pair.",
      solution: [
        {
          math: vertical ? md`\angle ${target} = \angle ${given} = ${k}^\circ` : md`\angle ${target} = 180^\circ - ${k}^\circ = ${ans}^\circ`,
          note: vertical ? md`$\angle ${target}$ and $\angle ${given}$ are vertical angles: Vertical Angles Theorem.` : md`$\angle ${target}$ and $\angle ${given}$ form a linear pair: Linear Pair Postulate.`,
        },
      ],
    };
  }
  const x = r.int(4, 15);
  if (kind === 1) {
    // A vertical pair given by expressions; ask for a neighbour.
    const other = AROUND[(i + 2) % 4]!;
    const target = AROUND[(i + r.pick([1, 3])) % 4]!;
    // Not 90: the asked angle would then equal the given pair but carry different arc marks.
    let pair = twoWays(r, x, 20, 160);
    while (pair[4] === 90) pair = twoWays(r, x, 20, 160);
    const [a, b, c, d, v] = pair;
    return {
      prompt: md`${FIGURE} What is $\angle ${target}$ in the figure? Give just the number of degrees, like 35.`,
      figure: crossingFigure(thetaFor(given, v), [
        { angle: given, label: degs(a, b), color: 1 },
        { angle: other, label: degs(c, d), color: 1 },
        { angle: target, label: "?", color: 2, arcs: 2 },
      ]),
      // The vertical pair fixes x, and the answer s makes a linear pair with the given angle.
      verify: [`s + ${a}(${d} - (${b}))/(${a - c}) + (${b}) = 180`],
      answer: String(180 - v),
      hint: md`$\angle ${given}$ and $\angle ${other}$ are vertical angles, so set them equal and find $x$. Then $\angle ${target}$ forms a linear pair with $\angle ${given}$.`,
      solution: [
        { math: md`${lin(a, b)} = ${lin(c, d)}`, note: "Vertical Angles Theorem." },
        ...solveLinear(a, b, c, d, x),
        { math: md`\angle ${given} = ${v}^\circ`, note: md`Substitute $x = ${x}$.` },
        { math: md`\angle ${target} = 180^\circ - ${v}^\circ = ${180 - v}^\circ`, note: "Linear Pair Postulate." },
      ],
    };
  }
  // A linear pair given by expressions; ask for a vertical partner.
  const next = AROUND[(i + 1) % 4]!;
  const v1 = pairAngle(r);
  const [a, b] = split(r, x, v1);
  const [c, d] = split(r, x, 180 - v1);
  const askOppositeGiven = r.next() < 0.5;
  const target = askOppositeGiven ? AROUND[(i + 2) % 4]! : AROUND[(i + 3) % 4]!;
  const ans = askOppositeGiven ? v1 : 180 - v1;
  return {
    prompt: md`${FIGURE} What is $\angle ${target}$ in the figure? Give just the number of degrees, like 35.`,
    figure: crossingFigure(thetaFor(given, v1), [
      { angle: given, label: degs(a, b), color: 1 },
      { angle: next, label: degs(c, d), color: 2, arcs: 2 },
      { angle: target, label: "?", color: 3, arcs: askOppositeGiven ? 1 : 2 },
    ]),
    // The linear pair fixes x; the answer s equals the angle it is vertical to.
    verify: [askOppositeGiven ? `s = ${a}(180 - (${b}) - (${d}))/${a + c} + (${b})` : `s = ${c}(180 - (${b}) - (${d}))/${a + c} + (${d})`],
    answer: String(ans),
    hint: md`$\angle ${given}$ and $\angle ${next}$ are neighbours, so they form a linear pair. Find $x$, then look for the angle vertical to $\angle ${target}$.`,
    solution: [
      { math: md`(${lin(a, b)}) + (${lin(c, d)}) = 180`, note: "Linear Pair Postulate." },
      { math: md`${lin(a + c, b + d)} = 180`, note: "Combine like terms." },
      ...solveLinear(a + c, b + d, 0, 180, x),
      { math: md`\angle ${given} = ${v1}^\circ, \quad \angle ${next} = ${180 - v1}^\circ`, note: md`Substitute $x = ${x}$.` },
      {
        math: md`\angle ${target} = \angle ${askOppositeGiven ? given : next} = ${ans}^\circ`,
        note: md`Vertical Angles Theorem: $\angle ${target}$ is opposite $\angle ${askOppositeGiven ? given : next}$.`,
      },
    ],
  };
};

// ── Figures ─────────────────────────────────────────────────────────────────

/**
 * A live label for an angle at the origin whose sides point `from` and `to`
 * degrees (expressions in slider names, counterclockwise, less than 180 apart).
 * The renderer puts an angle's own label at a fixed distance, which runs into
 * the sides once the angle gets small; this one moves out until it clears both
 * sides and the arc marks. `w` is the label's widest size in pixels.
 */
function liveAngleLabel(text: string, from: string, to: string, view: Box, w = 34): NonNullable<DiagramSpec["labels"]>[number] {
  const P = scale(view);
  const h = 18;
  const deg = (e: string) => `(${e}) * pi/180`;
  const max = (u: string, v: string) => `((${u}) + (${v}) + abs((${u}) - (${v})))/2`;
  const need = (e: string) => `${w / 2} * abs(sin(${deg(e)})) + ${h / 2} * abs(cos(${deg(e)})) + 4`;
  const mid = `((${from}) + (${to}))/2`;
  const fit = `(${max(need(from), need(to))}) / sin(${deg(`((${to}) - (${from}))/2`)})`;
  const arcs = `30 + ${w / 2} * abs(cos(${deg(mid)})) + ${h / 2} * abs(sin(${deg(mid)}))`;
  const r = `(${max(fit, arcs)}) / ${round3(P)}`;
  return { x: `${r} * cos(${deg(mid)})`, y: `${r} * sin(${deg(mid)})`, text };
}

const ruler = rulerMarks(-6, 6);
const CROSS_VIEW: Box = [-6.5, 6.5, -5.8, 5.8];
const C40 = polar(6.5, 40);
const D120 = polar(6.5, 120);
const ANGLE_C = polar(6, 110);
const B70 = polar(6, 70);

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit1: Unit = {
  title: "Foundations and Logic",
  lessons: [
    {
      id: "points-lines-and-planes",
      title: "Points, lines and planes",
      summary: "Why geometry starts from a few undefined terms and postulates, and the first postulates about distance.",
      blocks: [
        {
          kind: "text",
          body: md`Algebra rested on a few properties of numbers, and every step you took could be traced back to one of them. Geometry does the same thing for shapes, and it does it in the open. It is the oldest example of the **axiomatic method**: agree on a short list of starting facts, then **prove** everything else from them.

Around 300 BC, Euclid wrote the *Elements* this way. For two thousand years it was the model of careful reasoning, and this course follows the same plan.`,
        },
        {
          kind: "why",
          title: "Why not prove everything?",
          body: md`Every proof uses earlier facts. Those facts need proofs of their own, which use still earlier facts. Either this goes on forever, or it goes in a circle, or it stops somewhere. Mathematicians choose to stop on purpose.

- A **postulate** (or axiom) is a statement we accept without proof.
- A **theorem** is a statement proved from postulates, definitions and theorems already proved.

Definitions have the same problem. A dictionary defines words with other words, so somewhere it must loop. Geometry avoids the loop by leaving three words undefined.`,
        },
        {
          kind: "key",
          title: "The undefined terms",
          body: md`- A **point** is a location. It has no size. Name it with a capital letter, like $A$.
- A **line** is straight, has no thickness, and extends forever in both directions. Name it by two of its points, $\overleftrightarrow{AB}$, or by a lowercase letter like $\ell$.
- A **plane** is a flat surface with no thickness that extends forever. Name it by three of its points that are not on one line, or by a capital letter like plane $P$.

These descriptions guide your intuition. They are not definitions. In a proof you may use only what the postulates say about these objects.`,
        },
        {
          kind: "text",
          body: md`With them we can define new words. Points are **collinear** when one line passes through all of them, and **coplanar** when one plane contains all of them. The first postulates say how points, lines and planes fit together:

- Through any two points there is exactly one line.
- Through any three points that are not collinear there is exactly one plane.
- If two points lie in a plane, the line through them lies in that plane.`,
        },
        {
          kind: "diagram",
          view: [-0.5, 9.5, -0.5, 4],
          points: [
            { name: "P1", x: 0, y: 0, hidden: true, label: "" },
            { name: "P2", x: 7, y: 0, hidden: true, label: "" },
            { name: "P3", x: 9, y: 3.5, hidden: true, label: "" },
            { name: "P4", x: 2, y: 3.5, hidden: true, label: "" },
            { name: "A", x: 2, y: 1, dir: "s" },
            { name: "B", x: 4.5, y: 1.75, dir: "s" },
            { name: "C", x: 7, y: 2.5, dir: "s" },
            { name: "D", x: 4, y: 2.9, dir: "n" },
          ],
          polygons: [{ points: ["P1", "P2", "P3", "P4"], fill: 3 }],
          segments: [{ from: "A", to: "C", kind: "line", color: 1 }],
          labels: [{ x: 6.6, y: 0.45, text: md`\text{plane } P` }],
          caption: md`$A$, $B$ and $C$ are collinear: they lie on one line. $D$ is not on that line. All four points lie in plane $P$, so they are coplanar.`,
        },
        {
          kind: "why",
          title: "A first theorem: two lines cross at most once",
          body: md`Could two different lines meet at two points, $X$ and $Y$? Then two different lines would pass through $X$ and $Y$. The first postulate says only one line does. So it can't happen.

That short argument is a proof. "Two different lines meet in at most one point" is therefore a theorem, not a postulate. Postulate lists are kept short by proving whatever can be proved.`,
        },
        {
          kind: "key",
          title: "Segments and rays",
          body: md`- The **segment** $\overline{AB}$ is the points $A$ and $B$ (its **endpoints**) and all points of the line between them. Its **length** is written $AB$, with no bar: $\overline{AB}$ is a set of points, $AB$ is a number.
- The **ray** $\overrightarrow{AB}$ starts at $A$ and passes through $B$, going on forever. Order matters: $\overrightarrow{BA}$ starts at $B$ and points the other way.
- If $C$ is between $A$ and $B$ on a line, then $\overrightarrow{CA}$ and $\overrightarrow{CB}$ are **opposite rays**. Together they make the whole line.`,
        },
        {
          kind: "diagram",
          view: [-1, 9, -0.9, 3.7],
          points: [
            { name: "A", x: 2, y: 2.8, dir: "s" },
            { name: "B", x: 6, y: 2.8, dir: "s" },
            { name: "C", x: 2, y: 1.4, dir: "s" },
            { name: "D", x: 6, y: 1.4, dir: "s" },
            { name: "E", x: 2, y: 0, dir: "s" },
            { name: "F", x: 6, y: 0, dir: "s" },
          ],
          segments: [
            { from: "A", to: "B", kind: "line" },
            { from: "C", to: "D" },
            { from: "E", to: "F", kind: "ray" },
          ],
          labels: [
            { x: 4, y: 3.3, text: md`\text{line } \overleftrightarrow{AB}` },
            { x: 4, y: 1.9, text: md`\text{segment } \overline{CD}` },
            { x: 4, y: 0.5, text: md`\text{ray } \overrightarrow{EF}` },
          ],
          caption: "A line goes on in both directions, a segment stops at both endpoints, and a ray stops at one.",
        },
        {
          kind: "key",
          title: "Ruler Postulate",
          body: md`The points of a line can be matched with the real numbers, one point for each number, so that each point has a **coordinate**. If $A$ and $B$ have coordinates $a$ and $b$, the distance between them is

$$AB = |a - b|.$$

Coordinates also make "between" exact: $B$ is **between** $A$ and $C$ when the three points are collinear and $B$'s coordinate is between theirs.`,
        },
        {
          kind: "why",
          title: "Why the absolute value?",
          body: md`Lengths can't come from point, line and plane alone, so we postulate them, using the real numbers from algebra. A distance should never be negative, and it shouldn't depend on which end you start from. Subtracting coordinates gives how far apart they are, with a sign that only records direction. The absolute value throws the sign away, and $|a - b| = |b - a|$.

Where you put the zero of the ruler doesn't matter. Sliding every coordinate by the same amount leaves every difference unchanged.`,
        },
        {
          kind: "diagram",
          view: [-7.5, 7.5, -1, 1],
          points: [...ruler.points, { name: "A", x: "a", y: 0, dir: "n" }, { name: "B", x: "b", y: 0, dir: "n" }],
          segments: [...ruler.segments, { from: "A", to: "B", color: 1 }],
          labels: ruler.labels,
          params: [
            { name: "a", tex: md`a \text{, the coordinate of } A`, min: -6, max: 6, step: 1, value: -2 },
            { name: "b", tex: md`b \text{, the coordinate of } B`, min: -6, max: 6, step: 1, value: 5 },
          ],
          readouts: [
            { label: "a - b", value: "a - b" },
            { label: "AB = |a - b|", value: "abs(a - b)" },
          ],
          caption: "Drag the points. The difference of the coordinates can be negative; the distance never is.",
        },
        {
          kind: "key",
          title: "Segment Addition Postulate",
          body: md`If $B$ is between $A$ and $C$, then

$$AB + BC = AC.$$

The two pieces add up to the whole.`,
        },
        {
          kind: "why",
          title: "Why it's true",
          body: md`Use the Ruler Postulate with coordinates $a < b < c$. Then $AB = b - a$ and $BC = c - b$, so

$$AB + BC = (b - a) + (c - b) = c - a = AC.$$

If the coordinates run the other way, $c < b < a$, every difference flips sign: $(a - b) + (b - c) = a - c = AC$. Either way the pieces add to the whole.

So in a fully careful course this is a theorem. It is listed as a postulate because it is used constantly, and from now on you cite it by name.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 10.8, -0.8, 1],
          points: [
            { name: "A", x: 0, y: 0, dir: "n" },
            { name: "B", x: "b", y: 0, dir: "n" },
            { name: "C", x: 10, y: 0, dir: "n" },
            // Keeps the length labels below the line, clear of the names.
            { name: "U", x: 5, y: 0.8, hidden: true, label: "" },
          ],
          segments: [
            { from: "A", to: "B", color: 1, label: "{b}" },
            { from: "B", to: "C", color: 2, label: "{=10 - b}" },
          ],
          params: [{ name: "b", tex: "AB", min: 1, max: 9, step: 0.5, value: 4 }],
          readouts: [{ label: "AB + BC", value: "b + (10 - b)" }],
          caption: md`Slide $B$ anywhere between $A$ and $C$. The pieces change, but they always add to $AC = 10$.`,
        },
        {
          kind: "example",
          title: "Segment addition with algebra",
          problem: md`$B$ is between $A$ and $C$, with $AB = 2x + 3$, $BC = 3x - 1$ and $AC = 27$. Find $x$ and $AB$.`,
          steps: [
            { math: md`(2x + 3) + (3x - 1) = 27`, note: "Segment Addition Postulate: $AB + BC = AC$." },
            { math: md`5x + 2 = 27`, note: "Combine like terms." },
            { math: md`5x = 25 \;\Rightarrow\; x = 5`, note: "Subtract 2, then divide by 5." },
            { math: md`AB = 2(5) + 3 = 13, \quad BC = 3(5) - 1 = 14`, note: md`Check: $13 + 14 = 27$.` },
          ],
        },
        {
          kind: "key",
          title: "Congruent segments and midpoints",
          body: md`- Segments are **congruent**, $\overline{AB} \cong \overline{CD}$, when they have the same length, $AB = CD$. Matching tick marks in a figure show congruent segments.
- The **midpoint** of $\overline{AB}$ is the point $M$ on the segment with $AM = MB$.
- A line, ray or segment through the midpoint **bisects** $\overline{AB}$.`,
        },
        {
          kind: "diagram",
          view: [-1, 9, -2.5, 2.5],
          points: [
            { name: "A", x: 0, y: 0, dir: "n" },
            { name: "M", x: 4, y: 0, dir: "se" },
            { name: "B", x: 8, y: 0, dir: "n" },
            { name: "P", x: 5, y: 2, hidden: true, label: "" },
            { name: "Q", x: 3, y: -2, hidden: true, label: "" },
          ],
          segments: [
            { from: "A", to: "M", ticks: 1 },
            { from: "M", to: "B", ticks: 1 },
            { from: "Q", to: "P", kind: "line", color: 2 },
          ],
          labels: [{ x: 5.5, y: 2.1, text: md`\ell` }],
          caption: md`The single ticks say $AM = MB$, so $M$ is the midpoint. Line $\ell$ passes through $M$, so it bisects $\overline{AB}$.`,
        },
        {
          kind: "proof",
          title: "The midpoint's coordinate is the average",
          given: md`On a ruler, $A$ has coordinate $a$ and $B$ has coordinate $b$, with $a < b$. $M$, with coordinate $m$, is the midpoint of $\overline{AB}$.`,
          prove: md`$m = \frac{a + b}{2}$`,
          steps: [
            { statement: md`$AM = MB$, and $M$ is between $A$ and $B$`, reason: "Definition of midpoint" },
            { statement: md`$a < m < b$`, reason: "Definition of between" },
            { statement: md`$AM = m - a$ and $MB = b - m$`, reason: "Ruler Postulate (both differences are positive, so the absolute values drop)" },
            { statement: md`$m - a = b - m$`, reason: "Substitution (line 3 into line 1)" },
            { statement: md`$2m - a = b$`, reason: md`Addition Property of Equality (add $m$)` },
            { statement: md`$2m = a + b$`, reason: md`Addition Property of Equality (add $a$)` },
            { statement: md`$m = \frac{a + b}{2}$`, reason: "Division Property of Equality" },
          ],
        },
        {
          kind: "text",
          body: md`The reasons in that proof are the properties of equality you used to solve equations in Algebra 1. Lesson 4 lists them all, and you'll write proofs like this yourself.`,
        },
        {
          kind: "check",
          prompt: md`On a ruler, $A$ is at $-3$ and $B$ is at $9$. Give the coordinate of the midpoint of $\overline{AB}$.`,
          answer: "3",
          explain: md`$\frac{-3 + 9}{2} = \frac{6}{2} = 3$. Check: $3 - (-3) = 6$ and $9 - 3 = 6$, so the halves match.`,
        },
        {
          kind: "check",
          prompt: md`$B$ is between $A$ and $C$, $AB = 7$ and $AC = 19$. Give $BC$.`,
          answer: "12",
          explain: md`Segment Addition: $7 + BC = 19$, so $BC = 12$.`,
        },
      ],
      practice: [rulerProblems, segmentAddition, midpointAlgebra],
    },
    {
      id: "angles-and-their-measure",
      title: "Angles and their measure",
      summary: "Angles, the Protractor and Angle Addition Postulates, and complementary, supplementary and linear-pair angles.",
      blocks: [
        {
          kind: "text",
          body: md`An **angle** is two rays with a shared endpoint. The rays are the angle's **sides** and the shared endpoint is its **vertex**.

The angle with sides $\overrightarrow{BA}$ and $\overrightarrow{BC}$ is $\angle ABC$ or $\angle CBA$. The vertex always goes in the middle. When only one angle at $B$ is in play, $\angle B$ is enough. In this course the same symbol also stands for the angle's measure, so we write $\angle ABC = 40^\circ$.`,
        },
        {
          kind: "diagram",
          view: [-6.5, 7, -1, 6.6],
          points: [
            { name: "B", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 6, y: 0, dir: "s" },
            { name: "C", x: "6cos(t pi/180)", y: "6sin(t pi/180)", dir: "n" },
          ],
          segments: [
            { from: "B", to: "A", kind: "ray" },
            { from: "B", to: "C", kind: "ray" },
          ],
          angles: [{ at: "B", from: "A", to: "C" }],
          labels: [liveAngleLabel("{t}^\\circ", "0", "t", [-6.5, 7, -1, 6.6])],
          params: [{ name: "t", tex: "\\angle ABC", min: 20, max: 170, step: 1, value: 50 }],
          caption: md`Open and close the angle. Its measure depends only on how far apart the rays turn, not on how long they are drawn.`,
        },
        {
          kind: "key",
          title: "Protractor Postulate",
          body: md`Let $O$ be a point on line $\overleftrightarrow{AB}$, between $A$ and $B$. The rays from $O$ on one side of the line, together with $\overrightarrow{OA}$ and $\overrightarrow{OB}$, can be matched with the numbers from $0$ to $180$, with $\overrightarrow{OA}$ at $0$ and $\overrightarrow{OB}$ at $180$. The measure of the angle between two of these rays is the absolute difference of their numbers.`,
        },
        {
          kind: "diagram",
          view: [-7.5, 7.5, -0.8, 7.4],
          points: [
            { name: "O", x: 0, y: 0, dir: "s" },
            { name: "A", x: 6.5, y: 0, dir: "s" },
            { name: "B", x: -6.5, y: 0, dir: "s" },
            { name: "C", x: C40.x, y: C40.y, dir: "ne" },
            { name: "D", x: D120.x, y: D120.y, dir: "nw" },
            { name: "R0", x: 5, y: 0, hidden: true, label: "" },
            { name: "R90", x: 0, y: 5, hidden: true, label: "" },
            { name: "R180", x: -5, y: 0, hidden: true, label: "" },
          ],
          // The protractor's half circle, in two quarter arcs so the side is never ambiguous.
          arcs: [
            { center: "O", from: "R0", to: "R90", dashed: true },
            { center: "O", from: "R90", to: "R180", dashed: true },
          ],
          segments: [
            { from: "O", to: "A" },
            { from: "O", to: "B" },
            { from: "O", to: "C", color: 1 },
            { from: "O", to: "D", color: 1 },
          ],
          angles: [{ at: "O", from: "C", to: "D", label: md`80^\circ` }],
          labels: [
            { x: 5.55, y: 0.45, text: "0" },
            { x: -5.55, y: 0.45, text: "180" },
            { x: polar(5.6, 47).x, y: polar(5.6, 47).y, text: "40" },
            { x: polar(5.6, 128).x, y: polar(5.6, 128).y, text: "120" },
          ],
          caption: md`$\overrightarrow{OC}$ is matched with 40 and $\overrightarrow{OD}$ with 120, so $\angle COD = |120 - 40| = 80^\circ$.`,
        },
        {
          kind: "why",
          title: "The same idea as the ruler",
          body: md`Lengths come from matching points with numbers. Angle measures come from matching rays with numbers. As with a ruler, only differences matter, so you can put the protractor's zero on any ray.

Why 180 for a straight line? Only convention, inherited from Babylonian astronomers who split a full turn into 360 parts. A different unit would change the numbers, but no theorem would change.`,
        },
        {
          kind: "key",
          title: "Kinds of angles",
          body: md`- **Acute:** between $0^\circ$ and $90^\circ$.
- **Right:** exactly $90^\circ$, marked with a small square.
- **Obtuse:** between $90^\circ$ and $180^\circ$.
- **Straight:** exactly $180^\circ$, two opposite rays.

Angles are **congruent** when they have the same measure. Matching arcs in a figure show congruent angles. A ray that splits an angle into two congruent angles is the angle's **bisector**.`,
        },
        {
          kind: "key",
          title: "Angle Addition Postulate",
          body: md`A point $D$ is in the **interior** of $\angle ABC$ when it lies between the sides: on the same side of $\overleftrightarrow{BA}$ as $C$, and on the same side of $\overleftrightarrow{BC}$ as $A$.

If $D$ is in the interior of $\angle ABC$, then

$$\angle ABD + \angle DBC = \angle ABC.$$

This is the Segment Addition Postulate for angles: the parts add up to the whole.`,
        },
        {
          kind: "why",
          title: "Why it follows from the protractor",
          body: md`Lay the protractor along $\overleftrightarrow{BA}$ with $\overrightarrow{BA}$ at $0$, on the side where $C$ is. If $\overrightarrow{BC}$ reads $c$ and $\overrightarrow{BD}$ reads $d$, then $D$ inside the angle means $0 < d < c$. So $\angle ABD = d - 0 = d$, $\angle DBC = c - d$, and their sum is $c = \angle ABC$.`,
        },
        {
          kind: "diagram",
          view: [-4, 7, -1, 6.6],
          points: [
            { name: "B", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 6, y: 0, dir: "s" },
            { name: "C", x: ANGLE_C.x, y: ANGLE_C.y, dir: "nw" },
            { name: "D", x: "6cos(d pi/180)", y: "6sin(d pi/180)", dir: "ne" },
          ],
          segments: [
            { from: "B", to: "A", kind: "ray" },
            { from: "B", to: "C", kind: "ray" },
            { from: "B", to: "D", kind: "ray", color: 2 },
          ],
          angles: [
            { at: "B", from: "A", to: "D", color: 1 },
            { at: "B", from: "D", to: "C", color: 2, arcs: 2 },
          ],
          labels: [liveAngleLabel("{d}^\\circ", "0", "d", [-4, 7, -1, 6.6]), liveAngleLabel("{=110 - d}^\\circ", "d", "110", [-4, 7, -1, 6.6])],
          params: [{ name: "d", tex: "\\angle ABD", min: 20, max: 90, step: 1, value: 40 }],
          readouts: [{ label: "\\angle ABD + \\angle DBC", value: "d + (110 - d)", unit: "^\\circ" }],
          caption: md`$\angle ABC = 110^\circ$. Wherever $\overrightarrow{BD}$ sits inside it, the two parts add to $110^\circ$.`,
        },
        {
          kind: "example",
          title: "Angle addition with algebra",
          problem: md`$D$ is in the interior of $\angle ABC$, with $\angle ABD = (2x + 10)^\circ$, $\angle DBC = (4x - 8)^\circ$ and $\angle ABC = 110^\circ$. Find both parts.`,
          steps: [
            { math: md`(2x + 10) + (4x - 8) = 110`, note: "Angle Addition Postulate." },
            { math: md`6x + 2 = 110`, note: "Combine like terms." },
            { math: md`6x = 108 \;\Rightarrow\; x = 18`, note: "Subtract 2, then divide by 6." },
            { math: md`\angle ABD = 46^\circ, \quad \angle DBC = 64^\circ`, note: md`Substitute. Check: $46 + 64 = 110$.` },
          ],
        },
        {
          kind: "proof",
          title: "A bisector makes two halves",
          given: md`$\overrightarrow{BD}$ bisects $\angle ABC$.`,
          prove: md`$\angle ABD = \frac{1}{2}\angle ABC$`,
          steps: [
            { statement: md`$\angle ABD = \angle DBC$`, reason: "Definition of angle bisector" },
            { statement: md`$\angle ABD + \angle DBC = \angle ABC$`, reason: "Angle Addition Postulate (a bisector lies inside the angle)" },
            { statement: md`$\angle ABD + \angle ABD = \angle ABC$`, reason: "Substitution (line 1 into line 2)" },
            { statement: md`$2 \cdot \angle ABD = \angle ABC$`, reason: "Combine like terms (Distributive Property)" },
            { statement: md`$\angle ABD = \frac{1}{2}\angle ABC$`, reason: "Division Property of Equality" },
          ],
        },
        {
          kind: "key",
          title: "Pairs of angles",
          body: md`- Two angles are **complementary** if their measures add to $90^\circ$, and **supplementary** if they add to $180^\circ$. Each is the *complement* or *supplement* of the other.
- Two angles are **adjacent** if they share a vertex and a side but no interior points.
- A **linear pair** is two adjacent angles whose other sides are opposite rays.

**Linear Pair Postulate:** if two angles form a linear pair, they are supplementary.`,
        },
        {
          kind: "diagram",
          view: [-7, 7, -1, 6.6],
          points: [
            { name: "A", x: -6, y: 0, dir: "s" },
            { name: "B", x: 0, y: 0, dir: "s" },
            { name: "C", x: 6, y: 0, dir: "s" },
            { name: "D", x: "6cos(t pi/180)", y: "6sin(t pi/180)", dir: "n" },
          ],
          segments: [
            { from: "B", to: "A", kind: "ray" },
            { from: "B", to: "C", kind: "ray" },
            { from: "B", to: "D", kind: "ray", color: 2 },
          ],
          angles: [
            { at: "B", from: "C", to: "D", color: 1 },
            { at: "B", from: "D", to: "A", color: 2, arcs: 2 },
          ],
          labels: [liveAngleLabel("{t}^\\circ", "0", "t", [-7, 7, -1, 6.6]), liveAngleLabel("{=180 - t}^\\circ", "t", "180", [-7, 7, -1, 6.6])],
          params: [{ name: "t", tex: "\\angle DBC", min: 20, max: 160, step: 1, value: 60 }],
          readouts: [{ label: "\\angle ABD + \\angle DBC", value: "t + (180 - t)", unit: "^\\circ" }],
          caption: md`$\overrightarrow{BA}$ and $\overrightarrow{BC}$ are opposite rays, so $\angle ABD$ and $\angle DBC$ form a linear pair. However you turn $\overrightarrow{BD}$, the pair adds to $180^\circ$.`,
        },
        {
          kind: "why",
          title: "Why a linear pair adds to 180",
          body: md`Lay the protractor along the line, with $\overrightarrow{BC}$ at $0$ and $\overrightarrow{BA}$ at $180$. If $\overrightarrow{BD}$ reads $r$, then $\angle DBC = r - 0 = r$ and $\angle ABD = 180 - r$. Their sum is $r + (180 - r) = 180$.

So, like segment addition, this follows from an earlier postulate. It gets its own name because it is used in almost every proof about angles.`,
        },
        {
          kind: "diagram",
          view: [-0.5, 9, -0.6, 3.4],
          points: [
            { name: "P", x: 0, y: 0, label: "" },
            { name: "P1", x: 3.5, y: 0, hidden: true, label: "" },
            { name: "P2", x: polar(3.5, 35).x, y: polar(3.5, 35).y, hidden: true, label: "" },
            { name: "Q", x: 5, y: 0, label: "" },
            { name: "Q1", x: 8.5, y: 0, hidden: true, label: "" },
            { name: "Q2", x: polar(3.5, 55, 5).x, y: polar(3.5, 55, 5).y, hidden: true, label: "" },
          ],
          segments: [
            { from: "P", to: "P1" },
            { from: "P", to: "P2" },
            { from: "Q", to: "Q1" },
            { from: "Q", to: "Q2" },
          ],
          angles: [
            { at: "P", from: "P1", to: "P2", color: 1 },
            { at: "Q", from: "Q1", to: "Q2", color: 2 },
          ],
          labels: [
            { x: polar(1.7, 17.5).x, y: polar(1.7, 17.5).y, text: md`35^\circ` },
            { x: polar(1.7, 27.5, 5).x, y: polar(1.7, 27.5, 5).y, text: md`55^\circ` },
          ],
          caption: md`These two angles are complementary, since $35^\circ + 55^\circ = 90^\circ$, even though they are not adjacent. Complementary and supplementary are about the numbers, not the positions.`,
        },
        {
          kind: "example",
          title: "An angle and its supplement",
          problem: md`An angle measures $30^\circ$ less than twice its supplement. Find the angle.`,
          steps: [
            { math: md`x = 2(180 - x) - 30`, note: md`Call the angle $x^\circ$. Its supplement is $(180 - x)^\circ$.` },
            { math: md`x = 360 - 2x - 30 = 330 - 2x`, note: "Distribute and combine." },
            { math: md`3x = 330 \;\Rightarrow\; x = 110`, note: md`Add $2x$, then divide by 3.` },
            { math: md`180 - 110 = 70, \quad 2(70) - 30 = 110 \;\checkmark`, note: "Check against the words." },
          ],
        },
        {
          kind: "check",
          prompt: md`What is the supplement of a $47^\circ$ angle? Give just the number of degrees, like 35.`,
          answer: "133",
          explain: md`$180 - 47 = 133$, so the supplement is $133^\circ$.`,
        },
        {
          kind: "check",
          prompt: md`$\angle 1$ and $\angle 2$ form a linear pair, with $\angle 1 = (3x + 20)^\circ$ and $\angle 2 = (2x + 10)^\circ$. Give the value of $x$.`,
          answer: "30",
          explain: md`Linear Pair Postulate: $(3x + 20) + (2x + 10) = 180$, so $5x + 30 = 180$ and $x = 30$. Then $\angle 1 = 110^\circ$ and $\angle 2 = 70^\circ$.`,
        },
      ],
      practice: [angleMeasures, angleAddition, pairEquations],
    },
    {
      id: "conditional-statements",
      title: "Conditional statements",
      summary: "If-then statements, their converse, inverse and contrapositive, counterexamples and biconditionals.",
      blocks: [
        {
          kind: "text",
          body: md`Most of the postulates so far are if-then statements in disguise. "A linear pair is supplementary" means "If two angles form a linear pair, then they are supplementary." A proof chains statements like this together, so before writing proofs we need to know exactly what an if-then statement claims, and what it doesn't.`,
        },
        {
          kind: "key",
          title: "Conditional",
          body: md`A **conditional** is a statement of the form "If $p$, then $q$", written $p \to q$.

- $p$ is the **hypothesis**.
- $q$ is the **conclusion**.

In "If two angles form a linear pair, then they are supplementary", the hypothesis is "two angles form a linear pair" and the conclusion is "they are supplementary".`,
        },
        {
          kind: "text",
          body: md`A conditional claims: every time $p$ is true, $q$ is true as well. It makes no claim about what happens when $p$ is false. So a conditional is false in only one situation: $p$ true and $q$ false.`,
        },
        {
          kind: "why",
          title: "Why a false hypothesis can't break a conditional",
          body: md`Think of it as a promise. "If you finish your homework, I'll take you to the cinema." The promise is broken only if you finish the homework and don't get the cinema. If you don't finish, nothing that happens next can break the promise, because it said nothing about that case.

So $p \to q$ is true whenever $p$ is false. That may feel odd, but it is what "if" has to mean for proofs to work: a theorem only promises its conclusion when its hypothesis holds.`,
        },
        {
          kind: "key",
          title: "Counterexample",
          body: md`A **counterexample** to $p \to q$ is one case where $p$ is true and $q$ is false.

- One counterexample proves a conditional false.
- No number of examples proves a conditional true. That takes a proof.`,
        },
        {
          kind: "example",
          title: "Breaking a conditional",
          problem: md`Show that "If $x^2 = 49$, then $x = 7$" is false.`,
          steps: [
            { math: md`x = -7`, note: "Look for a value that makes the hypothesis true but the conclusion false." },
            { math: md`(-7)^2 = 49`, note: "The hypothesis is true." },
            { math: md`-7 \ne 7`, note: "The conclusion is false. One counterexample is enough." },
          ],
        },
        {
          kind: "key",
          title: "Converse, inverse, contrapositive",
          body: md`Start from $p \to q$, "If $p$, then $q$".

- **Converse:** swap the parts. $q \to p$.
- **Inverse:** negate both parts. $\text{not } p \to \text{not } q$.
- **Contrapositive:** swap and negate. $\text{not } q \to \text{not } p$.`,
        },
        {
          kind: "example",
          title: "All four at once",
          problem: md`Write the converse, inverse and contrapositive of "If two angles form a linear pair, then they are supplementary", and decide which are true.`,
          steps: [
            { math: md`p \to q: \ \text{true}`, note: "The original is the Linear Pair Postulate." },
            { math: md`q \to p: \ \text{false}`, note: "Converse: If two angles are supplementary, then they form a linear pair. The two angles in the figure below break it." },
            { math: md`\text{not } p \to \text{not } q: \ \text{false}`, note: "Inverse: If two angles do not form a linear pair, then they are not supplementary. The same two angles break it." },
            { math: md`\text{not } q \to \text{not } p: \ \text{true}`, note: "Contrapositive: If two angles are not supplementary, then they do not form a linear pair. A linear pair would have to be supplementary." },
          ],
        },
        {
          kind: "diagram",
          view: [-0.5, 10.5, -0.6, 3],
          points: [
            { name: "P", x: 2, y: 0, label: "" },
            { name: "P1", x: 5, y: 0, hidden: true, label: "" },
            { name: "P2", x: polar(3, 130, 2).x, y: polar(3, 130, 2).y, hidden: true, label: "" },
            { name: "Q", x: 7, y: 0, label: "" },
            { name: "Q1", x: 10, y: 0, hidden: true, label: "" },
            { name: "Q2", x: polar(3, 50, 7).x, y: polar(3, 50, 7).y, hidden: true, label: "" },
          ],
          segments: [
            { from: "P", to: "P1" },
            { from: "P", to: "P2" },
            { from: "Q", to: "Q1" },
            { from: "Q", to: "Q2" },
          ],
          angles: [
            { at: "P", from: "P1", to: "P2", color: 1 },
            { at: "Q", from: "Q1", to: "Q2", color: 2 },
          ],
          labels: [
            { x: polar(1.3, 65, 2).x, y: polar(1.3, 65, 2).y, text: md`130^\circ` },
            { x: polar(1.5, 25, 7).x, y: polar(1.5, 25, 7).y, text: md`50^\circ` },
          ],
          caption: md`A counterexample to the converse: these angles are supplementary ($130 + 50 = 180$) but they are not adjacent, so they are not a linear pair.`,
        },
        {
          kind: "why",
          title: "Why the contrapositive always agrees",
          body: md`$p \to q$ is false in exactly one situation: $p$ true and $q$ false.

$\text{not } q \to \text{not } p$ is false in exactly one situation: "not $q$" true and "not $p$" false. That means $q$ false and $p$ true, the very same situation.

So a conditional and its contrapositive are true together and false together, always. The inverse is the contrapositive of the converse, so those two always agree with each other too. But a conditional and its converse are separate claims: either can be true while the other is false.`,
        },
        {
          kind: "diagram",
          view: [-3.6, 3.6, -3.6, 3.6],
          points: [
            { name: "O", x: 0, y: 0, hidden: true, label: "" },
            { name: "S", x: -1, y: -0.5, hidden: true, label: "" },
            { name: "X", x: 1.7, y: -0.6, dir: "e" },
          ],
          circles: [
            { center: "O", radius: 3.2, fill: 3 },
            { center: "S", radius: 1.5, fill: 1 },
          ],
          labels: [
            { x: -1, y: -0.5, text: md`\text{squares}` },
            { x: 0, y: 2.1, text: md`\text{rectangles}` },
          ],
          caption: md`"If a figure is a square, then it is a rectangle": the squares sit inside the rectangles. The converse fails, since $X$ is a rectangle that is not a square. The contrapositive holds: anything outside the big circle is outside the small one too.`,
        },
        {
          kind: "check",
          prompt: md`Which statement is the contrapositive of "If an angle measures $30^\circ$, then it is acute"?`,
          choices: [
            md`If an angle is acute, then it measures $30^\circ$.`,
            md`If an angle does not measure $30^\circ$, then it is not acute.`,
            md`If an angle is not acute, then it does not measure $30^\circ$.`,
          ],
          accept: [md`If an angle is not acute, then it does not measure $30^\circ$.`],
          explain: md`Swap the parts and negate both. The first option is the converse and the second is the inverse.`,
        },
        {
          kind: "key",
          title: "Biconditional",
          body: md`When $p \to q$ and its converse $q \to p$ are both true, we combine them into one **biconditional**: "$p$ if and only if $q$", written $p \leftrightarrow q$.

"An angle is a right angle if and only if it measures $90^\circ$" says two things: a right angle measures $90^\circ$, and an angle that measures $90^\circ$ is a right angle.`,
        },
        {
          kind: "why",
          title: "Why definitions must work both ways",
          body: md`Every good definition is a biconditional, and proofs use both directions. Knowing $M$ is a midpoint, you conclude $AM = MB$. Knowing $M$ is on $\overline{AB}$ with $AM = MB$, you conclude $M$ is the midpoint.

Theorems are often one-way only. Next lesson you'll prove that vertical angles are congruent, but congruent angles need not be vertical. Always check which direction you are allowed to use.`,
        },
        {
          kind: "check",
          prompt: md`"If $|x| = 6$, then $x = 6$" is false. Give the one real number $x$ that is a counterexample.`,
          answer: "-6",
          explain: md`$|-6| = 6$, so the hypothesis is true, but $-6 \ne 6$, so the conclusion is false.`,
        },
      ],
      practice: [identifyForm, counterexample, countTrue],
    },
    {
      id: "your-first-proofs",
      title: "Your first proofs",
      summary: "Two-column proofs built from the properties of equality, and a proof of the Vertical Angles Theorem.",
      blocks: [
        {
          kind: "text",
          body: md`A **proof** is a chain of statements. Each statement follows from earlier ones for a reason everyone has agreed to accept. In a **two-column proof** the statements go on the left, numbered, and each one's reason goes on the right.

A reason must be one of these:

- **Given:** what the problem tells you.
- A **definition**: midpoint, bisector, complementary, supplementary, linear pair, congruent.
- A **postulate**: Ruler, Segment Addition, Protractor, Angle Addition, Linear Pair.
- A **property** of equality or of numbers.
- A **theorem** already proved.`,
        },
        {
          kind: "key",
          title: "Properties of equality",
          body: md`For any numbers $a$, $b$ and $c$:

- **Reflexive:** $a = a$.
- **Symmetric:** if $a = b$, then $b = a$.
- **Transitive:** if $a = b$ and $b = c$, then $a = c$.
- **Substitution:** if $a = b$, then $b$ may replace $a$ in any equation or expression.
- **Addition and Subtraction:** if $a = b$, then $a + c = b + c$ and $a - c = b - c$.
- **Multiplication and Division:** if $a = b$, then $ac = bc$, and $\frac{a}{c} = \frac{b}{c}$ when $c \ne 0$.
- **Distributive:** $a(b + c) = ab + ac$.`,
        },
        {
          kind: "why",
          title: "Why these are safe in geometry",
          body: md`Lengths and angle measures are real numbers, so everything you know about equations applies to them. An equation $a = b$ says $a$ and $b$ name one number. Doing the same thing to one number gives one result, which is all the properties say.

Congruence borrows them too. $\overline{AB} \cong \overline{CD}$ means $AB = CD$, so congruence is reflexive, symmetric and transitive as well.`,
        },
        {
          kind: "text",
          body: md`You have been writing proofs since Algebra 1, Unit 2. Solving an equation is one: each step follows from the one before by a property of equality. Here it is with every reason written out.`,
        },
        {
          kind: "proof",
          title: "Solving an equation is a proof",
          given: md`$5x - 7 = 3x + 9$`,
          prove: md`$x = 8$`,
          steps: [
            { statement: md`$5x - 7 = 3x + 9$`, reason: "Given" },
            { statement: md`$2x - 7 = 9$`, reason: md`Subtraction Property of Equality (subtract $3x$)` },
            { statement: md`$2x = 16$`, reason: md`Addition Property of Equality (add 7)` },
            { statement: md`$x = 8$`, reason: "Division Property of Equality (divide by 2)" },
          ],
        },
        {
          kind: "diagram",
          view: [-0.8, 7.8, -0.8, 0.9],
          points: [
            { name: "A", x: 0, y: 0, dir: "n" },
            { name: "B", x: 2, y: 0, dir: "n" },
            { name: "C", x: 5, y: 0, dir: "n" },
            { name: "D", x: 7, y: 0, dir: "n" },
          ],
          segments: [
            { from: "A", to: "B", ticks: 1 },
            { from: "B", to: "C" },
            { from: "C", to: "D", ticks: 1 },
          ],
          caption: md`$A$, $B$, $C$, $D$ in order on a line, with $AB = CD$. Adding the middle piece $\overline{BC}$ to each gives $\overline{AC}$ and $\overline{BD}$.`,
        },
        {
          kind: "proof",
          title: "Adding the same piece",
          given: md`$A$, $B$, $C$, $D$ lie on a line in that order, and $AB = CD$.`,
          prove: md`$AC = BD$`,
          steps: [
            { statement: md`$AB = CD$`, reason: "Given" },
            { statement: md`$AB + BC = CD + BC$`, reason: md`Addition Property of Equality (add $BC$)` },
            { statement: md`$AB + BC = AC$ and $BC + CD = BD$`, reason: md`Segment Addition Postulate ($B$ is between $A$ and $C$; $C$ is between $B$ and $D$)` },
            { statement: md`$CD + BC = BD$`, reason: "Commutative Property of Addition" },
            { statement: md`$AC = BD$`, reason: "Substitution (lines 3 and 4 into line 2)" },
          ],
        },
        {
          kind: "why",
          title: "Why prove what you can see?",
          body: md`A figure can mislead. Two segments that look equal can differ by a hair, and a figure only ever shows one case. The proof above never used the actual sizes in the drawing, only the given facts, so it works for every four points that fit the description. That is what a proof buys: certainty for all cases at once.`,
        },
        {
          kind: "text",
          body: md`When two lines cross they make four angles. Two angles are **vertical angles** if they are not adjacent and their sides form two pairs of opposite rays. In the figure, $\angle 1$ and $\angle 3$ are vertical, and so are $\angle 2$ and $\angle 4$. Turn the line and watch the measures.

With letters: lines $\overleftrightarrow{AC}$ and $\overleftrightarrow{BD}$ crossing at $E$ make $\angle AEB$, $\angle BEC$, $\angle CED$ and $\angle DEA$, in order around $E$. $\angle AEB$ and $\angle CED$ are vertical, because $\overrightarrow{EA}$, $\overrightarrow{EC}$ are opposite rays and so are $\overrightarrow{EB}$, $\overrightarrow{ED}$. Two of these angles that share a letter besides $E$, like $\angle AEB$ and $\angle BEC$, share a side and form a linear pair.`,
        },
        {
          kind: "diagram",
          view: CROSS_VIEW,
          points: [
            // E's name goes outside the arcs, in the wider of the two lower angles.
            { name: "E", x: 0, y: 0, label: "" },
            { name: "A", x: -6, y: 0, dir: "s" },
            { name: "C", x: 6, y: 0, dir: "s" },
            { name: "B", x: "6cos(t pi/180)", y: "6sin(t pi/180)", dir: "e" },
            { name: "D", x: "-6cos(t pi/180)", y: "-6sin(t pi/180)", dir: "w" },
          ],
          segments: [
            { from: "A", to: "C", kind: "line" },
            { from: "D", to: "B", kind: "line" },
          ],
          angles: [
            { at: "E", from: "C", to: "B", color: 1 },
            { at: "E", from: "B", to: "A", color: 2, arcs: 2 },
            { at: "E", from: "A", to: "D", color: 1 },
            { at: "E", from: "D", to: "C", color: 2, arcs: 2 },
          ],
          labels: [
            liveAngleLabel("1", "0", "t", CROSS_VIEW, 12),
            liveAngleLabel("2", "t", "180", CROSS_VIEW, 12),
            liveAngleLabel("3", "180", "180 + t", CROSS_VIEW, 12),
            liveAngleLabel("4", "180 + t", "360", CROSS_VIEW, 12),
            // (90.5 - t + abs(90.5 - t))/(2abs(90.5 - t)) is 1 while angle 4 is the wider one, else 0.
            {
              x: `${round3(70 / scale(CROSS_VIEW))} * cos((180 + t/2 + 90(90.5 - t + abs(90.5 - t))/(2abs(90.5 - t))) pi/180)`,
              y: `${round3(70 / scale(CROSS_VIEW))} * sin((180 + t/2 + 90(90.5 - t + abs(90.5 - t))/(2abs(90.5 - t))) pi/180)`,
              text: "E",
            },
          ],
          params: [{ name: "t", tex: "\\angle 1", min: 20, max: 160, step: 1, value: 55 }],
          readouts: [
            { label: "\\angle 1", value: "t", unit: "^\\circ" },
            { label: "\\angle 2", value: "180 - t", unit: "^\\circ" },
            { label: "\\angle 3", value: "t", unit: "^\\circ" },
            { label: "\\angle 4", value: "180 - t", unit: "^\\circ" },
          ],
          caption: md`Lines $\overleftrightarrow{AC}$ and $\overleftrightarrow{BD}$ cross at $E$. The vertical angles always match. The proof below explains why.`,
        },
        {
          kind: "why",
          title: "The idea before the proof",
          body: md`$\angle 1$ and $\angle 2$ make a straight line, so they add to $180^\circ$. So do $\angle 2$ and $\angle 3$. Both $\angle 1$ and $\angle 3$ are "what's left of $180^\circ$ after $\angle 2$", so they must be the same number.`,
        },
        {
          kind: "proof",
          title: "Vertical Angles Theorem",
          given: md`Lines $\overleftrightarrow{AC}$ and $\overleftrightarrow{BD}$ intersect at $E$, forming $\angle 1$, $\angle 2$, $\angle 3$ and $\angle 4$ as in the figure.`,
          prove: md`$\angle 1 = \angle 3$`,
          steps: [
            { statement: md`$\angle 1$ and $\angle 2$ form a linear pair, and so do $\angle 2$ and $\angle 3$`, reason: md`Definition of linear pair ($\overrightarrow{EA}$, $\overrightarrow{EC}$ are opposite rays, and so are $\overrightarrow{EB}$, $\overrightarrow{ED}$)` },
            { statement: md`$\angle 1 + \angle 2 = 180^\circ$`, reason: "Linear Pair Postulate" },
            { statement: md`$\angle 2 + \angle 3 = 180^\circ$`, reason: "Linear Pair Postulate" },
            { statement: md`$\angle 1 + \angle 2 = \angle 2 + \angle 3$`, reason: "Substitution (line 3 into line 2)" },
            { statement: md`$\angle 1 = \angle 3$`, reason: md`Subtraction Property of Equality (subtract $\angle 2$)` },
          ],
        },
        {
          kind: "key",
          title: "Vertical Angles Theorem",
          body: md`Vertical angles are congruent.

It is now a theorem, so you may cite it by name in any later proof. The same argument with $\angle 2$ and $\angle 4$ shows those two are congruent as well. More generally, it shows that two angles supplementary to the same angle are congruent.`,
        },
        {
          kind: "check",
          prompt: md`In the Vertical Angles proof, which property justifies going from $\angle 1 + \angle 2 = \angle 2 + \angle 3$ to $\angle 1 = \angle 3$?`,
          choices: ["Symmetric Property", "Subtraction Property of Equality", "Transitive Property", "Reflexive Property"],
          accept: ["Subtraction Property of Equality"],
          explain: md`$\angle 2$ is subtracted from both sides, which is the Subtraction Property of Equality.`,
        },
        {
          kind: "diagram",
          view: [-6.5, 6.5, -5.8, 5.8],
          points: [
            { name: "E", x: 0, y: 0, dir: "se" },
            { name: "A", x: -6, y: 0, dir: "s" },
            { name: "C", x: 6, y: 0, dir: "s" },
            { name: "B", x: B70.x, y: B70.y, dir: "e" },
            { name: "D", x: -B70.x, y: -B70.y, dir: "w" },
          ],
          segments: [
            { from: "A", to: "C", kind: "line" },
            { from: "D", to: "B", kind: "line" },
          ],
          angles: [
            { at: "E", from: "C", to: "B", color: 1 },
            { at: "E", from: "A", to: "D", color: 1 },
          ],
          labels: [
            { x: polar(2.6, 35).x, y: polar(2.6, 35).y, text: md`(4x - 10)^\circ` },
            { x: polar(2.6, 215).x, y: polar(2.6, 215).y, text: md`(2x + 30)^\circ` },
          ],
          caption: md`The figure for the next example, drawn to scale with $x = 20$.`,
        },
        {
          kind: "example",
          title: "Using the theorem",
          problem: md`In the figure, $\angle BEC = (4x - 10)^\circ$ and $\angle AED = (2x + 30)^\circ$. Find all four angles.`,
          steps: [
            { math: md`4x - 10 = 2x + 30`, note: "The two angles are vertical, so they are equal: Vertical Angles Theorem." },
            { math: md`2x = 40 \;\Rightarrow\; x = 20`, note: md`Subtract $2x$, add 10, divide by 2.` },
            { math: md`\angle BEC = \angle AED = 70^\circ`, note: md`Substitute: $4(20) - 10 = 70$ and $2(20) + 30 = 70$.` },
            { math: md`\angle AEB = \angle CED = 180^\circ - 70^\circ = 110^\circ`, note: "Each forms a linear pair with a 70 degree angle." },
          ],
        },
        {
          kind: "check",
          prompt: md`Two lines intersect. One pair of vertical angles measures $(5x - 12)^\circ$ and $(3x + 20)^\circ$. Give the value of $x$.`,
          answer: "16",
          explain: md`Vertical angles are congruent: $5x - 12 = 3x + 20$, so $2x = 32$ and $x = 16$. Each angle is $68^\circ$.`,
        },
      ],
      practice: [whichProperty, verticalLinear, verticalMeasure],
    },
  ],
};
