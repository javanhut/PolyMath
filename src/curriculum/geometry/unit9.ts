import { frac, fracTex, paren, poly, signed } from "../../math/random";
import type { Rng } from "../../math/random";
import { md, type DiagramSpec, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A point as answer text and LaTeX alike: "(3, -5)". */
const pt = (x: number, y: number) => `(${x}, ${y})`;
const units = (n: number) => (n === 1 ? "1 unit" : `${n} units`);
/** The opposite of n, written as a substitution: -(-5), -3, 0. */
const neg = (n: number) => (n === 0 ? "0" : `-${paren(n)}`);
/** "sub = ans", or just "ans" when substituting changed nothing visible. */
const then = (sub: string, ans: string) => (sub === ans ? ans : `${sub} = ${ans}`);
const IMAGE = md`Give the coordinates of $P'$ as (x, y).`;
const POINT = "Give the point as (x, y).";
const EXACT = "Give an exact answer.";

/** A lattice point off the axes and off the lines y = x and y = -x, so every rule gives a different image. */
function point(r: Rng, lim = 7): [number, number] {
  for (;;) {
    const x = r.nonzero(-lim, lim);
    const y = r.nonzero(-lim, lim);
    if (Math.abs(x) !== Math.abs(y)) return [x, y];
  }
}

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * One hidden verify equation that holds exactly when both coordinate equations do,
 * for a point answer (x, y): (l1 - r1)^2 + (l2 - r2)^2 = 0.
 */
function both(ex: string, ey: string): string {
  const sq = (e: string) => {
    const [l, r] = e.split("=");
    return `(${l} - (${r}))^2`;
  };
  return `${sq(ex)} + ${sq(ey)} = 0`;
}

// ── Figures ─────────────────────────────────────────────────────────────────

type XY = [number, number];
type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DiagramFigure = Extract<Figure, { kind: "diagram" }>;
type Points = NonNullable<DiagramSpec["points"]>;
type Segments = NonNullable<DiagramSpec["segments"]>;
type Labels = NonNullable<DiagramSpec["labels"]>;
type View = [number, number, number, number];

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const rad = (d: number) => (d * Math.PI) / 180;

// ── Label placement ─────────────────────────────────────────────────────────
// The diagram renderer (components/widgets/Diagram.tsx) fits the view into 560 x 600 px inside a
// 22 px margin and draws labels as 14 px KaTeX. These helpers copy that geometry, so a practice
// figure can put its labels where they don't sit on a line, a dot or another label.

/** A label's box on screen: left, right, top, bottom, in px. */
type Box = [number, number, number, number];
type Seg = [XY, XY];
const LABEL_H = 18;

/** Width in px of a short LaTeX label as KaTeX draws it (KaTeX glyph widths at 16.9 px/em, checked against measured labels). */
function texWidth(tex: string): number {
  let w = 3;
  const s = tex
    .replace(/\^\\circ/g, () => ((w += 6), ""))
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/ [-+=] /g, () => ((w += 22), ""));
  for (const c of s) w += /[A-Z]/.test(c) ? 13 : /[a-z]/.test(c) ? 9.7 : /[()]/.test(c) ? 6.6 : c === "," ? 7.5 : c === "'" ? 4 : c === "-" ? 13.2 : c === " " ? 0 : 8.5;
  return w;
}

interface Screen {
  W: number;
  H: number;
  at: (p: XY) => XY;
  back: (q: XY) => XY;
}

function screenOf([x0, x1, y0, y1]: View): Screen {
  const unit = Math.min(516 / (x1 - x0), 556 / (y1 - y0));
  return {
    W: (x1 - x0) * unit + 44,
    H: (y1 - y0) * unit + 44,
    at: ([x, y]) => [22 + (x - x0) * unit, 22 + (y1 - y) * unit],
    back: ([u, v]) => [r3(x0 + (u - 22) / unit), r3(y1 - (v - 22) / unit)],
  };
}

const DIR_STEP: Record<Dir, XY> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [0.75, -0.75], nw: [-0.75, -0.75], se: [0.75, 0.75], sw: [-0.75, 0.75] };
const DIRS8: Dir[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

/** Where the renderer puts a point's label for each `dir`. */
function pointBox(q: XY, dir: Dir, w: number): Box {
  const [dx, dy] = DIR_STEP[dir];
  const ax = q[0] + dx * (dx ? 8 : 14);
  const ay = q[1] + dy * 14;
  const left = dx > 0 ? ax : dx < 0 ? ax - w : ax - w / 2;
  return [left, left + w, ay - LABEL_H / 2, ay + LABEL_H / 2];
}
const boxAt = (c: XY, w: number): Box => [c[0] - w / 2, c[0] + w / 2, c[1] - LABEL_H / 2, c[1] + LABEL_H / 2];
const overlaps = (a: Box, b: Box) => Math.min(a[1], b[1]) > Math.max(a[0], b[0]) && Math.min(a[3], b[3]) > Math.max(a[2], b[2]);
const holds = (b: Box, p: XY) => p[0] > b[0] && p[0] < b[1] && p[1] > b[2] && p[1] < b[3];

/** Whether point c is inside the polygon (even-odd rule). */
function inside(poly: XY[], c: XY): boolean {
  let odd = false;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    if (p[1] > c[1] !== q[1] > c[1] && c[0] < p[0] + ((c[1] - p[1]) * (q[0] - p[0])) / (q[1] - p[1])) odd = !odd;
  });
  return odd;
}

/** Whether segment pq passes through box b (Liang-Barsky clipping). */
function crosses([p, q]: Seg, b: Box): boolean {
  if (Math.max(p[0], q[0]) < b[0] || Math.min(p[0], q[0]) > b[1] || Math.max(p[1], q[1]) < b[2] || Math.min(p[1], q[1]) > b[3]) return false;
  let [t0, t1] = [0, 1];
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  const sides: [number, number][] = [[-dx, p[0] - b[0]], [dx, b[1] - p[0]], [-dy, p[1] - b[2]], [dy, b[3] - p[1]]];
  for (const [k, m] of sides) {
    if (k === 0) {
      if (m < 0) return false;
      continue;
    }
    const t = m / k;
    if (k < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

/** The signed screen-space turn from direction a to direction b: the smaller one, or the larger if `major`. */
function turnBy(a: number, b: number, major = false): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return major ? (d > 0 ? d - 2 * Math.PI : d + 2 * Math.PI) : d;
}

/** Points along a screen-space arc, as short segments. */
function arcSegs(c: XY, r: number, from: number, delta: number): Seg[] {
  const n = Math.max(6, Math.ceil(Math.abs(delta) * 8));
  const pts = Array.from({ length: n + 1 }, (_, i): XY => [c[0] + r * Math.cos(from + (delta * i) / n), c[1] + r * Math.sin(from + (delta * i) / n)]);
  return pts.slice(1).map((p, i) => [pts[i]!, p]);
}

/** What a label must stay clear of: lines (hard), angle marks, axes and axis numbers (soft), dots, and labels already placed. */
interface Scene {
  s: Screen;
  segs: Seg[];
  soft: Seg[];
  softBoxes: Box[];
  dots: XY[];
  boxes: Box[];
}

function sceneOf(fig: DiagramFigure): Scene {
  const s = screenOf(fig.view);
  const at = new Map((fig.points ?? []).map((p) => [p.name, s.at([Number(p.x), Number(p.y)])] as const));
  const P = (n: string) => at.get(n)!;
  const far = 3 * (s.W + s.H);
  const sc: Scene = { s, segs: [], soft: [], softBoxes: [], dots: [], boxes: [] };
  for (const p of fig.points ?? []) if (!p.hidden) sc.dots.push(P(p.name));
  for (const g of fig.segments ?? []) {
    let [a, b] = [P(g.from), P(g.to)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const u: XY = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    if (g.kind === "ray" || g.kind === "line") b = [a[0] + u[0] * far, a[1] + u[1] * far];
    if (g.kind === "line") a = [a[0] - u[0] * far, a[1] - u[1] * far];
    sc.segs.push([a, b]);
  }
  for (const pg of fig.polygons ?? []) pg.points.forEach((n, i) => sc.segs.push([P(n), P(pg.points[(i + 1) % pg.points.length]!)]));
  for (const a of fig.arcs ?? []) {
    const [c, f, t] = [P(a.center), P(a.from), P(a.to)];
    const af = Math.atan2(f[1] - c[1], f[0] - c[0]);
    sc.segs.push(...arcSegs(c, Math.hypot(f[0] - c[0], f[1] - c[1]), af, turnBy(af, Math.atan2(t[1] - c[1], t[0] - c[0]), a.major)));
  }
  for (const a of fig.angles ?? []) {
    const [v, f, t] = [P(a.at), P(a.from), P(a.to)];
    const af = Math.atan2(f[1] - v[1], f[0] - v[0]);
    const delta = turnBy(af, Math.atan2(t[1] - v[1], t[0] - v[0]));
    if (a.right) {
      const e1: XY = [12 * Math.cos(af), 12 * Math.sin(af)];
      const e2: XY = [12 * Math.cos(af + delta), 12 * Math.sin(af + delta)];
      const corner: XY = [v[0] + e1[0] + e2[0], v[1] + e1[1] + e2[1]];
      sc.soft.push([[v[0] + e1[0], v[1] + e1[1]], corner], [corner, [v[0] + e2[0], v[1] + e2[1]]]);
    } else sc.soft.push(...arcSegs(v, 20 + 4 * ((a.arcs ?? 1) - 1), af, delta));
  }
  for (const l of fig.labels ?? []) sc.boxes.push(boxAt(s.at([Number(l.x), Number(l.y)]), texWidth(l.text)));
  if (fig.grid) {
    const [x0, x1, y0, y1] = fig.view;
    const span = Math.max(x1 - x0, y1 - y0) / 12;
    const p10 = 10 ** Math.floor(Math.log10(span));
    const step = [1, 2, 5, 10].map((k) => k * p10).find((k) => k >= span)!;
    const [ax, ay] = s.at([x0 <= 0 && 0 <= x1 ? 0 : x0, y0 <= 0 && 0 <= y1 ? 0 : y0]);
    sc.soft.push([[22, ay], [s.W - 22, ay]], [[ax, 22], [ax, s.H - 22]]);
    for (let v = Math.ceil(x0 / step) * step; v <= x1 + 1e-9; v += step) {
      const w = 6.5 * String(Math.round(v)).length;
      if (Math.round(v) !== 0) sc.softBoxes.push([s.at([v, 0])[0] - w / 2, s.at([v, 0])[0] + w / 2, ay + 5, ay + 16]);
    }
    for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) {
      const w = 6.5 * String(Math.round(v)).length;
      if (Math.round(v) !== 0) sc.softBoxes.push([ax - 5 - w, ax - 5, s.at([0, v])[1] - 5, s.at([0, v])[1] + 6]);
    }
  }
  return sc;
}

/** How badly a label box collides with the scene; `own` is the label's own dot. Counting stops at `cap`. */
function clash(sc: Scene, b: Box, own?: XY, cap = Infinity): number {
  const pad: Box = [b[0] - 2, b[1] + 2, b[2] - 1, b[3] + 1];
  let c = b[0] < 2 || b[1] > sc.s.W - 2 || b[2] < 2 || b[3] > sc.s.H - 2 ? 100 : 0;
  for (const x of sc.boxes) if (c < cap && overlaps(x, pad)) c += 60;
  for (const d of sc.dots) if (c < cap && (!own || Math.hypot(d[0] - own[0], d[1] - own[1]) > 0.5) && holds([pad[0] - 3, pad[1] + 3, pad[2] - 3, pad[3] + 3], d)) c += 50;
  for (const g of sc.segs) if (c < cap && crosses(g, pad)) c += 40;
  for (const g of sc.soft) if (c < cap && crosses(g, b)) c += 4;
  for (const x of sc.softBoxes) if (c < cap && overlaps(x, b)) c += 4;
  return c;
}

/**
 * Move a figure's angle and segment labels to free labels where they clear the lines, then turn each
 * point label to the side where it collides least, starting from its given `dir`. Only for figures
 * whose coordinates are numbers.
 */
function placeLabels(fig: DiagramFigure, slides: Sliding[] = []): DiagramFigure {
  arrange(fig, slides);
  return fig;
}

/**
 * placeLabels, returning how badly the placed labels still collide: the total cost and the worst
 * single label. A worst of 30 or more means some label sits on a line, a dot, another label, or
 * outside the shape its angle belongs to.
 */
function arrange(fig: DiagramFigure, slides: Sliding[] = []): { total: number; worst: number } {
  let total = 0;
  let worst = 0;
  const angles = (fig.angles ?? []).filter((a) => a.label);
  const segLabels = (fig.segments ?? []).filter((g) => g.label);
  const pending = [...angles.map((a) => a.label!), ...segLabels.map((g) => g.label!)];
  for (const a of angles) delete a.label;
  for (const g of segLabels) delete g.label;
  const sc = sceneOf(fig);
  const P = (n: string) => {
    const p = fig.points!.find((q) => q.name === n)!;
    return sc.s.at([Number(p.x), Number(p.y)]);
  };
  const free = (c: XY, tex: string) => {
    sc.boxes.push(boxAt(c, texWidth(tex)));
    const [x, y] = sc.s.back(c);
    (fig.labels ??= []).push({ x, y, text: tex });
  };
  // The cheapest spot, trying spots in order of their own cost and stopping once no later one can win.
  const best = (tries: [XY, number][], w: number): XY => {
    let pick: [XY, number] = [tries[0]![0], Infinity];
    for (const [c, k] of tries.sort((p, q) => p[1] - q[1])) {
      if (k >= pick[1]) break;
      const cost = clash(sc, boxAt(c, w), undefined, pick[1] - k) + k;
      if (cost < pick[1]) pick = [c, cost];
    }
    total += pick[1];
    worst = Math.max(worst, pick[1]);
    return pick[0];
  };
  // Angle labels inside the angle, along (or near) its bisector, as close to the vertex as they fit.
  angles.forEach((a, i) => {
    const [v, f, t] = [P(a.at), P(a.from), P(a.to)];
    const af = Math.atan2(f[1] - v[1], f[0] - v[0]);
    const delta = turnBy(af, Math.atan2(t[1] - v[1], t[0] - v[0]));
    // A label that leaves the polygon the angle belongs to reads as labelling something else.
    const shape = fig.polygons?.find((pg) => [a.at, a.from, a.to].every((n) => pg.points.includes(n)))?.points.map(P);
    const tries: [XY, number][] = [];
    for (let d = 32; d <= 220; d += 3)
      for (const k of [0, -0.3, 0.3, -0.55, 0.55, -0.75, 0.75]) {
        const ang = af + (delta / 2) * (1 + k);
        const c: XY = [v[0] + d * Math.cos(ang), v[1] + d * Math.sin(ang)];
        tries.push([c, d / 15 + 3 * Math.abs(k) + (shape && !inside(shape, c) ? 30 : 0)]);
      }
    free(best(tries, texWidth(pending[i]!)), pending[i]!);
  });
  // Segment labels beside the midpoint, far enough out that the whole label clears the segment.
  const pts = (fig.points ?? []).map((p) => sc.s.at([Number(p.x), Number(p.y)]));
  const cen = centroid(pts);
  segLabels.forEach((g, i) => {
    const tex = pending[angles.length + i]!;
    const w = texWidth(tex);
    const [a, b] = [P(g.from), P(g.to)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n: XY = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    const away = (cen[0] - (a[0] + b[0]) / 2) * n[0] + (cen[1] - (a[1] + b[1]) / 2) * n[1] > 0 ? -1 : 1;
    const tries: [XY, number][] = [];
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7])
      for (const side of [away, -away])
        for (const extra of [0, 6, 12]) {
          const off = side * ((w / 2) * Math.abs(n[0]) + (LABEL_H / 2) * Math.abs(n[1]) + 4 + extra);
          tries.push([[a[0] + t * (b[0] - a[0]) + off * n[0], a[1] + t * (b[1] - a[1]) + off * n[1]], 12 * Math.abs(t - 0.5) + (side === away ? 0 : 6) + extra / 3]);
        }
    free(best(tries, w), tex);
  });
  // Point labels: two passes, so each one also sees where the later ones went.
  const named = (fig.points ?? []).filter((p) => p.label !== "" && typeof p.x === "number" && typeof p.y === "number");
  const placed = new Map<string, Box>();
  for (let pass = 0; pass < 2; pass++)
    for (const p of named) {
      const q = P(p.name);
      const w = texWidth(p.label ?? p.name);
      const others = [...placed].filter(([k]) => k !== p.name).map(([, b]) => b);
      const view = { ...sc, boxes: [...sc.boxes, ...others] };
      const i0 = DIRS8.indexOf(p.dir ?? "ne");
      let pick: [number, Dir] = [Infinity, p.dir ?? "ne"];
      DIRS8.forEach((d, i) => {
        const c = clash(view, pointBox(q, d, w), q) + Math.min((i - i0 + 8) % 8, (i0 - i + 8) % 8);
        if (c < pick[0]) pick = [c, d];
      });
      p.dir = pick[1];
      placed.set(p.name, pointBox(q, pick[1], w));
      if (pass === 1) {
        total += pick[0];
        worst = Math.max(worst, pick[0]);
      }
    }
  // Last, sliding labels at the clearest of their spots, the first spot preferred.
  sc.boxes.push(...placed.values());
  for (const l of slides) free(best(l.spots.map((p, i): [XY, number] => [sc.s.at(p), i]), texWidth(l.text)), l.text);
  return { total, worst };
}

/** The compass direction from one point to another, for putting a label on the outside of a figure. */
function compass(from: XY, to: XY): Dir {
  const a = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
  return (["e", "ne", "n", "nw", "w", "sw", "s", "se"] as const)[((Math.round(a / 45) % 8) + 8) % 8]!;
}

const centroid = (pts: XY[]): XY => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/** A view window around the points: `pad` units, plus `frac` of the larger span, on every side. */
function viewOf(pts: XY[], pad: number, frac = 0): View {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const m = pad + frac * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return [r3(Math.min(...xs) - m), r3(Math.max(...xs) + m), r3(Math.min(...ys) - m), r3(Math.max(...ys) + m)];
}

/** A line of reflection: the vertical line x = k, the horizontal line y = k, or y = x. */
type Mirror = { v: "x" | "y"; k: number } | { v: "y=x" };

/** A free label that may sit at any of several spots; placeLabels picks the clearest. */
interface Sliding {
  text: string;
  spots: XY[];
}

/** Hidden points, a dashed line and its equation for each mirror, with spots for the equation near either end inside `view`. */
function mirrorParts(mirrors: Mirror[], view: View, axisNames = false): { points: Points; segments: Segments; slides: Sliding[] } {
  const [x0, x1, y0, y1] = view;
  const out = { points: [] as Points, segments: [] as Segments, slides: [] as Sliding[] };
  mirrors.forEach((m, i) => {
    const [a, b] = [`L${i}a`, `L${i}b`];
    const ends: [XY, XY] = m.v === "x" ? [[m.k, 0], [m.k, 1]] : m.v === "y" ? [[0, m.k], [1, m.k]] : [[0, 0], [1, 1]];
    out.points.push({ name: a, x: ends[0][0], y: ends[0][1], label: "", hidden: true }, { name: b, x: ends[1][0], y: ends[1][1], label: "", hidden: true });
    out.segments.push({ from: a, to: b, kind: "line", dashed: true, color: 3 });
    const span = Math.max(x1 - x0, y1 - y0);
    const off = 0.07 * span;
    const at = (x: number, y: number): XY => [r3(x), r3(y)];
    if (m.v === "x") {
      const text = axisNames && m.k === 0 ? md`y\text{-axis}` : md`x = ${m.k}`;
      out.slides.push({ text, spots: [y1 - off, y0 + off].flatMap((y) => [at(m.k + 1.6 * off, y), at(m.k - 1.6 * off, y)]) });
    } else if (m.v === "y") {
      const text = axisNames && m.k === 0 ? md`x\text{-axis}` : md`y = ${m.k}`;
      out.slides.push({ text, spots: [x1 - 1.6 * off, x0 + 1.6 * off].flatMap((x) => [at(x, m.k + off), at(x, m.k - off)]) });
    } else {
      const ts = [Math.min(x1, y1) - 2 * off, Math.max(x0, y0) + 2 * off];
      out.slides.push({ text: "y = x", spots: ts.flatMap((t) => [at(t + off, t - off), at(t - off, t + off)]) });
    }
  });
  return out;
}

/** A given point on a coordinate grid, labeled with its coordinates unless `label` says otherwise. */
interface Plotted {
  name: string;
  at: XY;
  label?: string;
  dir?: Dir;
}

/**
 * A coordinate-grid figure showing the given points and any lines of reflection. The view
 * also holds the origin and the points in `room`, so the learner has space to place the answer.
 */
function gridFigure(shown: Plotted[], room: XY[] = [], mirrors: Mirror[] = [], extra: Pick<DiagramSpec, "segments" | "arcs"> = {}): DiagramFigure {
  const all: XY[] = [[0, 0], ...shown.map((p) => p.at), ...room];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const view: View = [Math.floor(Math.min(...xs) - 1.5), Math.ceil(Math.max(...xs) + 1.5), Math.floor(Math.min(...ys) - 1.5), Math.ceil(Math.max(...ys) + 1.5)];
  const lines = mirrorParts(mirrors, view, true);
  const fig: DiagramFigure = {
    kind: "diagram",
    grid: true,
    view,
    points: [
      ...shown.map((p) => ({ name: p.name, x: p.at[0], y: p.at[1], label: p.label ?? `${p.name}${pt(...p.at)}`, dir: p.dir ?? (p.at[1] >= 0 ? ("n" as const) : ("s" as const)) })),
      ...lines.points,
    ],
    segments: [...lines.segments, ...(extra.segments ?? [])],
    arcs: extra.arcs,
  };
  return placeLabels(fig, lines.slides);
}

/** Vertices of a regular n-gon of radius 3 about the origin, one vertex at the top. */
const regular = (n: number): XY[] => Array.from({ length: n }, (_, i) => [r3(3 * Math.cos(rad(90 + (360 * i) / n))), r3(3 * Math.sin(rad(90 + (360 * i) / n)))]);

/** A filled polygon with unlabeled corners, optionally with its center O marked and every side ticked as equal. */
function polygonFigure(verts: XY[], center = false, equalSides = false): DiagramFigure {
  const names = verts.map((_, i) => `V${i}`);
  return {
    segments: equalSides ? names.map((a, i) => ({ from: a, to: names[(i + 1) % names.length]!, ticks: 1 as const })) : undefined,
    kind: "diagram",
    view: viewOf(verts, 0.6),
    points: [
      ...verts.map((v, i) => ({ name: names[i]!, x: v[0], y: v[1], label: "", hidden: true })),
      ...(center ? [{ name: "O", x: 0, y: 0, dir: "s" as const }] : []),
    ],
    polygons: [{ points: names, fill: 1 }],
  };
}

/** Triangle with base along the x-axis from (0, 0) and sides [v0v1, v1v2, v2v0]: v1 at (s0, 0), v2 above. */
function sssTriangle([s0, s1, s2]: number[]): XY[] {
  const x = (s0! * s0! + s2! * s2! - s1! * s1!) / (2 * s0!);
  return [[0, 0], [s0!, 0], [r3(x), r3(Math.sqrt(Math.max(s2! * s2! - x * x, 0)))]];
}

/**
 * A dilation with center C: segment AB and its image A'B', with rays from C. The image is
 * drawn `ratio` times as long; labels are LaTeX or undefined for none.
 */
function dilationFigure(ratio: number, abLabel?: string, imgLabel?: string): DiagramFigure {
  const A: XY = [3, 0.5];
  const B: XY = [2, 2.4];
  const A2: XY = [r3(ratio * A[0]), r3(ratio * A[1])];
  const B2: XY = [r3(ratio * B[0]), r3(ratio * B[1])];
  const farA = ratio > 1 ? "A'" : "A";
  const farB = ratio > 1 ? "B'" : "B";
  return placeLabels({
    kind: "diagram",
    view: viewOf([[0, 0], A, B, A2, B2], 0.3, 0.1),
    points: [
      { name: "C", x: 0, y: 0, dir: "sw" },
      { name: "A", x: A[0], y: A[1], dir: "se" },
      { name: "B", x: B[0], y: B[1], dir: "nw" },
      { name: "A'", x: A2[0], y: A2[1], dir: "se" },
      { name: "B'", x: B2[0], y: B2[1], dir: "nw" },
    ],
    segments: [
      { from: "C", to: farA, dashed: true, color: 3 },
      { from: "C", to: farB, dashed: true, color: 3 },
      { from: "A", to: "B", color: 1, label: abLabel },
      { from: "A'", to: "B'", color: 2, label: imgLabel },
    ],
  });
}

/** A triangle drawn to scale with its sides [v0v1, v1v2, v2v0] labeled, longest side along the bottom. */
function sidesFigure(sides: number[]): DiagramFigure {
  const order = [...sides].sort((p, q) => q - p);
  const [P, Q, R] = sssTriangle([order[0]!, order[1]!, order[2]!]);
  return placeLabels({
    kind: "diagram",
    view: viewOf([P!, Q!, R!], 0.4, 0.06),
    points: [
      { name: "P", x: P![0], y: P![1], label: "", hidden: true },
      { name: "Q", x: Q![0], y: Q![1], label: "", hidden: true },
      { name: "R", x: R![0], y: R![1], label: "", hidden: true },
    ],
    polygons: [{ points: ["P", "Q", "R"], fill: 1 }],
    segments: [
      { from: "P", to: "Q", label: String(order[0]) },
      { from: "Q", to: "R", label: String(order[1]) },
      { from: "R", to: "P", label: String(order[2]) },
    ],
  });
}

/** C, P and P' on one ray from C, drawn to scale, with CP = cp labeled and PP' marked "?". */
function rayFigure(cp: number, k: number): DiagramFigure {
  const img = k * cp;
  const far = Math.max(cp, img);
  const up = 0.09 * far;
  return {
    kind: "diagram",
    view: [r3(-0.12 * far), r3(1.12 * far), r3(-2.2 * up), r3(2.2 * up)],
    points: [
      { name: "C", x: 0, y: 0, dir: "s" },
      { name: "P", x: cp, y: 0, dir: "s" },
      { name: "P'", x: r3(img), y: 0, dir: "s" },
      { name: "end", x: r3(1.1 * far), y: 0, label: "", hidden: true },
    ],
    segments: [{ from: "C", to: "end", arrow: true }],
    labels: [
      { x: r3(cp / 2), y: r3(up), text: `CP = ${cp}` },
      { x: r3((cp + img) / 2), y: r3(up), text: "?" },
    ],
  };
}

/** The gap between two convex polygons: 0 when they touch or overlap. */
function polygonGap(p: XY[], q: XY[]): number {
  if (p.some((v) => inside(q, v)) || q.some((v) => inside(p, v))) return 0;
  const toSeg = (v: XY, a: XY, b: XY) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(v[0] - a[0] - t * dx, v[1] - a[1] - t * dy);
  };
  const one = (p: XY[], q: XY[]) => Math.min(...p.flatMap((v) => q.map((a, i) => toSeg(v, a, q[(i + 1) % q.length]!))));
  return Math.min(one(p, q), one(q, p));
}

/**
 * Triangle ABC with the angle at B equal to `angle` degrees, and its image under a dilation by 2
 * with center O, placed so the two don't overlap. With `labels`, the angles at B and B' carry them.
 * The layout (which way the angle opens, and where O sits) is the one where the labels fit best;
 * `fits` says whether every label is clear. The smaller triangle often can't hold a wide angle
 * label, especially an obtuse one.
 */
function dilatedAngleFigure(angle: number, labels?: [string, string]): { fig: DiagramFigure; fits: boolean } {
  const s = Math.sin(rad(angle / 2));
  const c = Math.cos(rad(angle / 2));
  // B at the origin with the bisector of angle B pointing up.
  const up: XY[] = [[2.4 * s, 2.4 * c], [0, 0], [-2 * s, 2 * c]];
  // Turn the triangle four ways, and put O in each of 12 directions from B, as close as it can be
  // without the triangles touching.
  const layouts: { fig: DiagramFigure; unit: number }[] = [];
  for (const spin of [0, -90, 45, -45])
    for (let a = 0; a < 360; a += 30) {
      const tri = up.map(([x, y]): XY => [x * Math.cos(rad(spin)) - y * Math.sin(rad(spin)), x * Math.sin(rad(spin)) + y * Math.cos(rad(spin))]);
      const u: XY = [Math.cos(rad(a)), Math.sin(rad(a))];
      for (let d = 0.6; d < 16; d += 0.1) {
        const o: XY = [-d * u[0], -d * u[1]];
        const img = tri.map(([x, y]): XY => [2 * x - o[0], 2 * y - o[1]]);
        if (polygonGap(tri, img) < 0.6) continue;
        // Skip O on (or nearly on) the line of a side: a dashed ray would run along that side.
        const seen = (p: XY, q: XY) => Math.abs(turnBy(Math.atan2(p[1] - o[1], p[0] - o[0]), Math.atan2(q[1] - o[1], q[0] - o[0])));
        if (tri.some((p, i) => seen(p, tri[(i + 1) % 3]!) < rad(8))) break;
        // Move O to the origin.
        const fig = angleLayout(tri.map(([x, y]) => [r3(x - o[0]), r3(y - o[1])]), labels);
        layouts.push({ fig, unit: Math.min(516 / (fig.view[1] - fig.view[0]), 556 / (fig.view[3] - fig.view[2])) });
        break;
      }
    }
  // Largest drawing first; take the first whose labels are all clear, else the least bad.
  let best = { total: Infinity, worst: Infinity, fig: layouts[0]!.fig };
  for (const { fig } of layouts.sort((p, q) => q.unit - p.unit)) {
    const cost = arrange(fig);
    if (cost.total < best.total) best = { ...cost, fig };
    if (cost.total < 12) break;
  }
  return { fig: best.fig, fits: best.worst < 30 };
}

/** Triangle ABC, given with O at the origin, and its image under the dilation by 2 about O. */
function angleLayout(tri: XY[], labels?: [string, string]): DiagramFigure {
  const img = tri.map(([x, y]): XY => [r3(2 * x), r3(2 * y)]);
  const names = ["A", "B", "C"];
  const points: Points = [{ name: "O", x: 0, y: 0, dir: "s" }];
  for (const [pts, suffix] of [[tri, ""], [img, "'"]] as const) {
    const c = centroid([...pts]);
    pts.forEach((p, i) => points.push({ name: names[i]! + suffix, x: p[0], y: p[1], dir: compass(c, p) }));
  }
  return {
    kind: "diagram",
    view: viewOf([[0, 0], ...tri, ...img], 0.5, 0.04),
    points,
    polygons: [
      { points: names, fill: 1 },
      { points: names.map((n) => `${n}'`), fill: 2 },
    ],
    segments: names.map((n) => ({ from: "O", to: `${n}'`, dashed: true, color: 3 as const })),
    angles: [
      { at: "B", from: "A", to: "C", label: labels?.[0] },
      { at: "B'", from: "A'", to: "C'", label: labels?.[1] },
    ],
  };
}

/** Drawn ratio for a dilation figure: true to scale between 1/4 and 4, clamped beyond. */
const drawnRatio = (k: number) => Math.min(4, Math.max(0.25, k));
const NOT_TO_SCALE = "The figure is not drawn to scale.";

// ── Lesson 1 practice: translations, reflections, rotations ─────────────────

interface Motion {
  verb: "Reflect" | "Rotate" | "Translate";
  /** Markup after the object: "across the $x$-axis". */
  tail: string;
  /** Markup naming it as a noun: "reflection across the $x$-axis". */
  noun: string;
  /** The coordinate rule, LaTeX. */
  rule: string;
  f: (x: number, y: number) => [number, number];
  /** The rule with numbers substituted, LaTeX. */
  sub: (x: number, y: number) => string;
  why: string;
  hint: string;
  /** Hidden check: two equations the image (x, y) of (a, b) satisfies, from the definition of the move. */
  holds: (a: number, b: number) => [string, string];
  /** For a reflection, its line; for a rotation about the origin, its counterclockwise angle. */
  mirror?: Mirror;
  turn?: number;
}

/**
 * A rotation by `deg` counterclockwise about the origin keeps OP' = OP and turns by deg. With
 * P(a, b) and P'(x, y), the dot product a x + b y is OP^2 cos(deg) and the cross product
 * a y - b x is OP^2 sin(deg).
 */
const turned =
  (deg: number) =>
  (a: number, b: number): [string, string] => {
    const r2 = a * a + b * b;
    const [c, s] = [Math.round(Math.cos(rad(deg))), Math.round(Math.sin(rad(deg)))];
    return [`${paren(a)}*x + ${paren(b)}*y = ${r2 * c}`, `${paren(a)}*y - ${paren(b)}*x = ${r2 * s}`];
  };

const REFLECT_X: Motion = {
  verb: "Reflect",
  tail: md`across the $x$-axis`,
  noun: md`reflection across the $x$-axis`,
  rule: md`(x, y) \to (x, -y)`,
  f: (x, y) => [x, -y],
  sub: (x, y) => `(${x}, ${neg(y)})`,
  why: md`Across the $x$-axis, $x$ stays the same and $y$ changes sign.`,
  hint: md`The $x$-axis is the perpendicular bisector of $\overline{PP'}$: the image is straight up or down from $P$, the same distance from the axis.`,
  // PP' is vertical and its midpoint is on the x-axis.
  holds: (a, b) => [`x - ${paren(a)} = 0`, `(${b} + y)/2 = 0`],
  mirror: { v: "y", k: 0 },
};
const REFLECT_Y: Motion = {
  verb: "Reflect",
  tail: md`across the $y$-axis`,
  noun: md`reflection across the $y$-axis`,
  rule: md`(x, y) \to (-x, y)`,
  f: (x, y) => [-x, y],
  sub: (x, y) => `(${neg(x)}, ${y})`,
  why: md`Across the $y$-axis, $y$ stays the same and $x$ changes sign.`,
  hint: md`The image is straight left or right of $P$, the same distance from the $y$-axis on the other side.`,
  holds: (a, b) => [`(${a} + x)/2 = 0`, `y - ${paren(b)} = 0`],
  mirror: { v: "x", k: 0 },
};
const REFLECT_YX: Motion = {
  verb: "Reflect",
  tail: md`across the line $y = x$`,
  noun: md`reflection across the line $y = x$`,
  rule: md`(x, y) \to (y, x)`,
  f: (x, y) => [y, x],
  sub: (x, y) => `(${y}, ${x})`,
  why: md`Across $y = x$, the two coordinates swap.`,
  hint: md`Reflecting across $y = x$ swaps the coordinates.`,
  // The midpoint of PP' is on y = x, and PP' has slope -1.
  holds: (a, b) => [`(${a} + x)/2 = (${b} + y)/2`, `y - ${paren(b)} = -(x - ${paren(a)})`],
  mirror: { v: "y=x" },
};
const ROTATE_90: Motion = {
  verb: "Rotate",
  tail: md`by $90^\circ$ counterclockwise about the origin`,
  noun: md`rotation of $90^\circ$ counterclockwise about the origin`,
  rule: md`(x, y) \to (-y, x)`,
  f: (x, y) => [-y, x],
  sub: (x, y) => `(${neg(y)}, ${x})`,
  why: md`A quarter turn counterclockwise: the old $y$, with its sign changed, becomes the new $x$, and the old $x$ becomes the new $y$.`,
  hint: md`The $90^\circ$ rule is $(x, y) \to (-y, x)$. Swap, then change the sign of the new first coordinate.`,
  holds: turned(90),
  turn: 90,
};
const ROTATE_180: Motion = {
  verb: "Rotate",
  tail: md`by $180^\circ$ about the origin`,
  noun: md`rotation of $180^\circ$ about the origin`,
  rule: md`(x, y) \to (-x, -y)`,
  f: (x, y) => [-x, -y],
  sub: (x, y) => `(${neg(x)}, ${neg(y)})`,
  why: md`A half turn is two quarter turns, and both coordinates change sign.`,
  hint: md`A $180^\circ$ turn is two $90^\circ$ turns. Both coordinates change sign.`,
  holds: turned(180),
  turn: 180,
};
const ROTATE_270: Motion = {
  verb: "Rotate",
  tail: md`by $270^\circ$ counterclockwise about the origin`,
  noun: md`rotation of $270^\circ$ counterclockwise about the origin`,
  rule: md`(x, y) \to (y, -x)`,
  f: (x, y) => [y, -x],
  sub: (x, y) => `(${y}, ${neg(x)})`,
  why: md`Three quarter turns: apply $(x, y) \to (-y, x)$ three times and you get $(y, -x)$.`,
  hint: md`$270^\circ$ is three quarter turns. The rule is $(x, y) \to (y, -x)$.`,
  holds: turned(270),
  turn: 270,
};
const ROTATE_CW: Motion = {
  ...ROTATE_270,
  tail: md`by $90^\circ$ clockwise about the origin`,
  noun: md`rotation of $90^\circ$ clockwise about the origin`,
  why: md`A quarter turn clockwise ends where three quarter turns counterclockwise do, so use the $270^\circ$ rule.`,
  hint: md`Clockwise $90^\circ$ is the same as counterclockwise $270^\circ$.`,
};

function translation(a: number, b: number): Motion {
  return {
    verb: "Translate",
    tail: md`by the rule $(x, y) \to (x ${signed(a)}, y ${signed(b)})$`,
    noun: md`translation by $\langle ${a}, ${b} \rangle$`,
    rule: md`(x, y) \to (x ${signed(a)}, y ${signed(b)})`,
    f: (x, y) => [x + a, y + b],
    sub: (x, y) => `(${x} ${signed(a)}, ${y} ${signed(b)})`,
    why: md`A translation adds the same amounts to every point.`,
    hint: md`Add ${a} to $x$ and ${b} to $y$.`,
    holds: (x, y) => [`x - ${paren(x)} = ${a}`, `y - ${paren(y)} = ${b}`],
  };
}

/** A grid figure for moves about the origin: the axes are already drawn, so only y = x needs adding. */
function motionGrid(moves: Motion[], shown: Plotted[], room: XY[], segments?: Segments): DiagramFigure {
  const mirrors = moves.flatMap((m) => (m.mirror?.v === "y=x" ? [m.mirror] : []));
  return gridFigure(shown, room, mirrors.slice(0, 1), { segments });
}

/**
 * Triangle ABC with the angle at B equal to `angle` degrees (or, with `angle` null, segment AB),
 * and its image under the move. Reflections show their line, rotations their center O and the
 * path of one vertex, translations the arrow from a vertex to its image. With `labels`, the angles
 * at B and B' (or the two segments) carry them; `fits` says whether every label is clear.
 */
function rigidFigure(m: Motion, angle: number | null, labels?: [string, string]): { fig: DiagramFigure; fits: boolean } {
  let shape: XY[] = angle === null ? [[0, 0], [4.2, 1.7]] : [[4.2, 0], [0, 0], [r3(3.5 * Math.cos(rad(angle))), r3(3.5 * Math.sin(rad(angle)))]];
  const names = angle === null ? ["A", "B"] : ["A", "B", "C"];
  const xs = () => shape.map((p) => p[0]);
  const ys = () => shape.map((p) => p[1]);
  const move = (dx: number, dy: number) => (shape = shape.map(([x, y]) => [r3(x + dx), r3(y + dy)]));
  const [w, h] = [Math.max(...xs()) - Math.min(...xs()), Math.max(...ys()) - Math.min(...ys())];
  if (m.verb === "Translate") {
    // Shrink the shape below the length of the vector, so it and its image can't overlap.
    const [vx, vy] = m.f(0, 0);
    const diam = Math.max(...shape.flatMap((p) => shape.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))));
    const s = (0.75 * Math.hypot(vx, vy)) / diam;
    shape = shape.map(([x, y]) => [r3(x * s), r3(y * s)]);
    // Leave a gap of 2 between the shape and its mirror, for the mirror's label.
  } else if (m === REFLECT_X) move(-Math.min(...xs()) - w / 2, 2 - Math.min(...ys()));
  else if (m === REFLECT_Y) move(2 - Math.min(...xs()), -Math.min(...ys()) - h / 2);
  else if (m === REFLECT_YX) move(1.5 - Math.min(...xs()), -1.5 - Math.max(...ys()));
  else move(1 - Math.min(...xs()), 1 - Math.min(...ys()));
  const image = shape.map(([x, y]) => m.f(x, y).map(r3) as XY);
  const primed = names.map((n) => `${n}'`);
  const all: XY[] = [...shape, ...image, ...(m.turn ? [[0, 0] as XY] : [])];
  // Clear space at the top of a vertical mirror for its label.
  if (m === REFLECT_Y) all.push([0, Math.max(...all.map((p) => p[1])) + 1.8]);
  const view = viewOf(all, 0.9);
  const points: Points = [];
  for (const [pts, ns] of [[shape, names], [image, primed]] as const) {
    const c = centroid(pts);
    pts.forEach((p, i) => points.push({ name: ns[i]!, x: p[0], y: p[1], dir: compass(c, p) }));
  }
  const lines = mirrorParts(m.mirror ? [m.mirror] : [], view, true);
  points.push(...lines.points);
  const segments: Segments = [...lines.segments];
  const fig: DiagramFigure = { kind: "diagram", view, points, segments };
  if (angle === null) {
    segments.push({ from: "A", to: "B", color: 1, label: labels?.[0] }, { from: "A'", to: "B'", color: 2, label: labels?.[1] });
  } else {
    fig.polygons = [
      { points: names, fill: 1 },
      { points: primed, fill: 2 },
    ];
    fig.angles = [
      { at: "B", from: "A", to: "C", label: labels?.[0] },
      { at: "B'", from: "A'", to: "C'", label: labels?.[1] },
    ];
  }
  // Trace the vertex whose path stays outside both shapes: for a rotation the one farthest from O
  // (every other point turns on a smaller circle), for a translation the one furthest to the side
  // of the vector (the arrow then runs along a line that both shapes lie on one side of).
  const [vx, vy] = m.f(0, 0);
  const reach = (p: XY) => (m.turn ? Math.hypot(p[0], p[1]) : vx * p[1] - vy * p[0]);
  const tracer = names[shape.reduce((best, p, i) => (reach(p) > reach(shape[best]!) ? i : best), 0)]!;
  if (m.turn) {
    points.push({ name: "O", x: 0, y: 0, dir: "sw" });
    fig.arcs = [{ center: "O", from: tracer, to: `${tracer}'`, major: m.turn > 180, dashed: true, color: 3 }];
  } else if (m.verb === "Translate") segments.push({ from: tracer, to: `${tracer}'`, arrow: true, dashed: true, color: 3 });
  return { fig, fits: arrange(fig, lines.slides).worst < 30 };
}

const translations: Generator = (r) => {
  const kind = r.int(0, 3);
  const [x, y] = point(r);
  const a = r.nonzero(-6, 6);
  const b = r.nonzero(-6, 6);
  const rule = md`(x, y) \to (x ${signed(a)}, y ${signed(b)})`;
  const moveX = a > 0 ? `add ${a} to` : `subtract ${-a} from`;
  const moveY = b > 0 ? `add ${b} to` : `subtract ${-b} from`;
  if (kind === 0) {
    const ans = pt(x + a, y + b);
    return {
      prompt: md`Translate $A${pt(x, y)}$ by the rule $${rule}$. Give the coordinates of $A'$ as (x, y).`,
      answer: ans,
      form: "tuple",
      figure: gridFigure([{ name: "A", at: [x, y] }], [[x + a, y + b]]),
      verify: [both(...translation(a, b).holds(x, y))],
      hint: md`The rule says: ${moveX} the $x$-coordinate and ${moveY} the $y$-coordinate.`,
      solution: [
        { math: md`A' = (${x} ${signed(a)}, ${y} ${signed(b)})`, note: "Substitute the coordinates of A into the rule." },
        { math: md`A' = ${ans}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const ans = pt(x + a, y + b);
    return {
      prompt: md`Translate $P${pt(x, y)}$ ${units(Math.abs(a))} ${a > 0 ? "right" : "left"} and ${units(Math.abs(b))} ${b > 0 ? "up" : "down"}. ${IMAGE}`,
      answer: ans,
      form: "tuple",
      figure: gridFigure([{ name: "P", at: [x, y] }], [[x + a, y + b]]),
      verify: [both(...translation(a, b).holds(x, y))],
      hint: "Right and up are positive; left and down are negative. Moving sideways only changes x, and moving up or down only changes y.",
      solution: [
        { math: md`(x, y) \to (x ${signed(a)}, y ${signed(b)})`, note: md`Write the move as a rule, with vector $\langle ${a}, ${b} \rangle$.` },
        { math: md`P' = (${x} ${signed(a)}, ${y} ${signed(b)}) = ${ans}`, note: "Substitute." },
      ],
    };
  }
  if (kind === 2) {
    let [bx, by] = point(r);
    while (bx === x && by === y) [bx, by] = point(r);
    const ans = pt(bx + a, by + b);
    return {
      prompt: md`A translation maps $A${pt(x, y)}$ to $A'${pt(x + a, y + b)}$, along the arrow in the figure. Where does it map $B${pt(bx, by)}$? ${POINT}`,
      answer: ans,
      form: "tuple",
      figure: gridFigure(
        [
          { name: "A", at: [x, y] },
          { name: "A'", at: [x + a, y + b] },
          { name: "B", at: [bx, by] },
        ],
        [[bx + a, by + b]],
        [],
        { segments: [{ from: "A", to: "A'", arrow: true, color: 2 }] },
      ),
      // The trip from B to B' is the trip from A to A'.
      verify: [both(`x - ${paren(bx)} = ${x + a} - ${paren(x)}`, `y - ${paren(by)} = ${y + b} - ${paren(y)}`)],
      hint: md`Find how far $A$ moved sideways and up or down. A translation moves **every** point by that same amount.`,
      solution: [
        { math: md`a = ${x + a} - ${paren(x)} = ${a}, \quad b = ${y + b} - ${paren(y)} = ${b}`, note: "Subtract the coordinates of A from those of A' to get the vector." },
        { math: rule, note: "So this is the translation rule." },
        { math: md`B' = (${bx} ${signed(a)}, ${by} ${signed(b)}) = ${ans}`, note: "Apply the same rule to B." },
      ],
    };
  }
  const ans = pt(x, y);
  return {
    prompt: md`The translation $${rule}$ maps $P$ to $P'${pt(x + a, y + b)}$. Find the pre-image $P$. ${POINT}`,
    answer: ans,
    form: "tuple",
    figure: gridFigure([{ name: "P'", at: [x + a, y + b] }], [[x, y]]),
    verify: [both(`x ${signed(a)} = ${x + a}`, `y ${signed(b)} = ${y + b}`)],
    hint: md`Undo the translation: move the opposite way, by $\langle ${-a}, ${-b} \rangle$.`,
    solution: [
      { math: md`x ${signed(a)} = ${x + a}, \quad y ${signed(b)} = ${y + b}`, note: "The image coordinates came from the rule." },
      { math: md`x = ${x}, \quad y = ${y}`, note: md`Solve each one: ${a > 0 ? `subtract ${a}` : `add ${-a}`}, and ${b > 0 ? `subtract ${b}` : `add ${-b}`}.` },
      { math: md`P = ${ans}`, note: "Check: translating it forward gives P' again." },
    ],
  };
};

const reflectAndRotate: Generator = (r) => {
  const [x, y] = point(r);
  const roll = r.int(0, 8);
  if (roll >= 7) {
    // Reflection across a vertical or horizontal line that isn't an axis.
    const k = r.nonzero(-4, 4);
    const vertical = roll === 7;
    const c = vertical ? x : y;
    if (c === k) return reflectAndRotate(r);
    const img = 2 * k - c;
    const ans = vertical ? pt(img, y) : pt(x, img);
    const v = vertical ? "x" : "y";
    return {
      prompt: md`Reflect $P${pt(x, y)}$ across the line $${v} = ${k}$. ${IMAGE}`,
      answer: ans,
      form: "tuple",
      figure: gridFigure([{ name: "P", at: [x, y] }], [vertical ? [img, y] : [x, img]], [{ v, k }]),
      // The line is the perpendicular bisector of PP': the midpoint is on it, and the other coordinate stays.
      verify: [vertical ? both(`(${x} + x)/2 = ${k}`, `y - ${paren(y)} = 0`) : both(`x - ${paren(x)} = 0`, `(${y} + y)/2 = ${k}`)],
      hint: md`$\overline{PP'}$ is perpendicular to the line, so only the $${v}$-coordinate changes. The line passes through the midpoint of $\overline{PP'}$.`,
      solution: [
        { math: vertical ? md`P' = (x', ${y})` : md`P' = (${x}, y')`, note: md`The line $${v} = ${k}$ is ${vertical ? "vertical" : "horizontal"}, so $\overline{PP'}$ is ${vertical ? "horizontal" : "vertical"} and the other coordinate stays the same.` },
        { math: md`\frac{${c} + ${v}'}{2} = ${k}`, note: "The line of reflection passes through the midpoint of the segment PP'." },
        { math: md`${v}' = ${2 * k} - ${paren(c)} = ${img}`, note: "Multiply by 2, then subtract." },
        { math: md`P' = ${ans}`, note: md`Check: $${c}$ and $${img}$ are both ${units(Math.abs(c - k))} from $${k}$.` },
      ],
    };
  }
  const m = [REFLECT_X, REFLECT_Y, REFLECT_YX, ROTATE_90, ROTATE_180, ROTATE_270, ROTATE_CW][roll]!;
  const [u, v] = m.f(x, y);
  const ans = pt(u, v);
  return {
    prompt: md`${m.verb} $P${pt(x, y)}$ ${m.tail}. ${IMAGE}`,
    answer: ans,
    form: "tuple",
    figure: motionGrid([m], [{ name: "P", at: [x, y] }], [[u, v]]),
    verify: [both(...m.holds(x, y))],
    hint: m.hint,
    solution: [
      { math: m.rule, note: m.why },
      { math: md`P' = ${then(m.sub(x, y), ans)}`, note: "Substitute the coordinates of P." },
    ],
  };
};

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [6, 8, 10],
  [8, 6, 10],
  [5, 12, 13],
  [12, 5, 13],
];

const compositionsAndRigidity: Generator = (r) => {
  const roll = r.next();
  if (roll < 0.3) {
    const [x, y] = point(r, 6);
    const pool = [REFLECT_X, REFLECT_Y, REFLECT_YX, ROTATE_90, ROTATE_180, translation(r.nonzero(-5, 5), r.nonzero(-5, 5))];
    const [first, second] = shuffle(r, pool) as [Motion, Motion];
    const [x1, y1] = first.f(x, y);
    const [x2, y2] = second.f(x1, y1);
    const ans = pt(x2, y2);
    return {
      prompt: md`Start with $P${pt(x, y)}$. First ${first.verb.toLowerCase()} it ${first.tail}. Then ${second.verb.toLowerCase()} the image ${second.tail}. Give the coordinates of the final image $P''$ as (x, y).`,
      answer: ans,
      form: "tuple",
      figure: motionGrid([first, second], [{ name: "P", at: [x, y] }], [[x1, y1], [x2, y2]]),
      verify: [both(...second.holds(x1, y1))],
      hint: md`Do one step at a time. Find $P'$ from the first move, then apply the second move to $P'$, not to $P$.`,
      solution: [
        { math: md`P' = ${then(first.sub(x, y), pt(x1, y1))}`, note: md`First move: $${first.rule}$.` },
        { math: md`P'' = ${then(second.sub(x1, y1), ans)}`, note: md`Second move, applied to $P'$: $${second.rule}$.` },
      ],
    };
  }
  if (roll < 0.45) {
    const lines = [
      { m: REFLECT_X, name: md`the $x$-axis` },
      { m: REFLECT_Y, name: md`the $y$-axis` },
      { m: REFLECT_YX, name: md`the line $y = x$` },
    ];
    const [a, b] = shuffle(r, lines) as [(typeof lines)[0], (typeof lines)[0]];
    const rotations = [
      { m: ROTATE_90, text: md`a rotation of $90^\circ$ counterclockwise about the origin` },
      { m: ROTATE_180, text: md`a rotation of $180^\circ$ about the origin` },
      { m: ROTATE_CW, text: md`a rotation of $90^\circ$ clockwise about the origin` },
    ];
    const composite = (x: number, y: number) => b.m.f(...a.m.f(x, y));
    const right = rotations.find((rot) => rot.m.f(1, 2).join() === composite(1, 2).join())!;
    const [x1, y1] = a.m.f(1, 2);
    const [x2, y2] = b.m.f(x1, y1);
    return {
      prompt: md`Reflecting a figure across ${a.name} and then reflecting the image across ${b.name} has the same effect as which single transformation?`,
      choices: shuffle(r, [...rotations.map((rot) => rot.text), md`a reflection across the $x$-axis`]),
      accept: [right.text],
      hint: md`Follow a test point such as $(1, 2)$ through both reflections, then compare with the rotation rules.`,
      solution: [
        { math: md`(1, 2) \to ${pt(x1, y1)} \to ${pt(x2, y2)}`, note: md`First across ${a.name}, then across ${b.name}.` },
        { math: md`(x, y) \to ${a.m.rule.split("\\to ")[1]} \to ${right.m.rule.split("\\to ")[1]}`, note: "With letters, the same two steps give a rotation rule." },
        { math: right.m.rule, note: md`This is ${right.text}. Two reflections across lines that cross always make a rotation about the crossing point.` },
      ],
    };
  }
  if (roll < 0.7) {
    const motion = r.pick([REFLECT_X, REFLECT_Y, REFLECT_YX, ROTATE_90, ROTATE_180, translation(r.nonzero(-5, 5), r.nonzero(-5, 5))]);
    const sol = r.int(2, 12);
    let a = r.int(2, 7);
    let c = r.int(2, 7);
    while (c === a) c = r.int(2, 7);
    if (a > c) [a, c] = [c, a];
    const isAngle = roll >= 0.6;
    // ax + b = cx + d with solution `sol`; the value must be a sensible length or angle.
    const value = isAngle ? r.int(8, 32) * 5 : a * sol + r.int(1, 12);
    const b = value - a * sol;
    const d = value - c * sol;
    const left = poly([[a, "x"], [b, ""]]);
    const right = poly([[c, "x"], [d, ""]]);
    // Label the figure when the labels fit there; otherwise give the two measures in the prompt.
    const labels: [string, string] = isAngle ? [md`(${left})^\circ`, md`(${right})^\circ`] : [left, right];
    const labeled = rigidFigure(motion, isAngle ? value : null, labels);
    const given = labeled.fits ? "" : isAngle ? md` $m\angle ABC = (${left})^\circ$ and $m\angle A'B'C' = (${right})^\circ$.` : md` $AB = ${left}$ and $A'B' = ${right}$.`;
    return {
      prompt: isAngle
        ? md`A ${motion.noun} maps $\triangle ABC$ onto $\triangle A'B'C'$, as in the figure.${given} Find $x$.`
        : md`A ${motion.noun} maps $\overline{AB}$ onto $\overline{A'B'}$, as in the figure.${given} Find $x$. ${NOT_TO_SCALE}`,
      answer: String(sol),
      figure: labeled.fits ? labeled.fig : rigidFigure(motion, isAngle ? value : null).fig,
      // A rigid motion preserves angle measure and distance.
      verify: [`${left} = ${right}`],
      hint: isAngle
        ? "Rigid motions preserve angle measure, so the two expressions are equal. Collect the x-terms on one side."
        : "Rigid motions preserve distance, so the two expressions are equal. Collect the x-terms on one side.",
      solution: [
        { math: md`${left} = ${right}`, note: isAngle ? md`$\angle B' = \angle B$, because a rigid motion preserves angle measure.` : md`$A'B' = AB$, because a rigid motion preserves distance.` },
        { math: md`${b - d} = ${poly([[c - a, "x"]])}`, note: md`Subtract $${a}x$${d === 0 ? "" : d < 0 ? ` and add ${-d}` : ` and subtract ${d}`} on both sides.` },
        { math: md`x = ${sol}`, note: md`${c - a === 1 ? "" : `Divide by ${c - a}. `}Check: both sides equal ${value}${isAngle ? md`, so $\angle B = ${value}^\circ$` : ""}.` },
      ],
    };
  }
  const motion = r.pick([REFLECT_X, REFLECT_Y, REFLECT_YX, ROTATE_90, ROTATE_180, ROTATE_270]);
  const [dx0, dy0, len] = r.pick(TRIPLES);
  const dx = dx0 * r.sign();
  const dy = dy0 * r.sign();
  const x1 = r.int(-4, 4);
  const y1 = r.int(-4, 4);
  const [x2, y2] = [x1 + dx, y1 + dy];
  const A2 = motion.f(x1, y1);
  const B2 = motion.f(x2, y2);
  return {
    prompt: md`A ${motion.noun} maps $A${pt(x1, y1)}$ and $B${pt(x2, y2)}$, shown in the figure, to $A'$ and $B'$. Find $A'B'$. Give an exact length.`,
    answer: String(len),
    figure: motionGrid(
      [motion],
      [
        { name: "A", at: [x1, y1], dir: compass([x2, y2], [x1, y1]) },
        { name: "B", at: [x2, y2], dir: compass([x1, y1], [x2, y2]) },
      ],
      [A2, B2],
      [{ from: "A", to: "B", color: 1 }],
    ),
    // A'B' = AB, by the Distance Formula.
    verify: [`d = sqrt((${x2} - ${paren(x1)})^2 + (${y2} - ${paren(y1)})^2)`],
    hint: md`A rigid motion preserves distance, so $A'B' = AB$. Use the Distance Formula on $A$ and $B$.`,
    solution: [
      { math: md`A'B' = AB`, note: "Rigid motions preserve distance." },
      { math: md`AB = \sqrt{(${x2} - ${paren(x1)})^2 + (${y2} - ${paren(y1)})^2} = \sqrt{${dx * dx} + ${dy * dy}}`, note: "Distance Formula." },
      { math: md`AB = \sqrt{${len * len}} = ${len}`, note: "" },
      { math: md`A' = ${pt(...A2)}, \; B' = ${pt(...B2)}`, note: md`Check with the images: their differences are $${B2[0] - A2[0]}$ and $${B2[1] - A2[1]}$, the same numbers up to order and sign, so the distance is ${len} again.` },
    ],
  };
};

// ── Lesson 2 practice: dilations ────────────────────────────────────────────

/** Scale factors n/d with friendly numbers. */
const FACTORS: [number, number][] = [
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [3, 2],
  [1, 3],
  [2, 3],
  [5, 2],
  [3, 4],
];

const dilatePoints: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const k = r.int(2, 4);
    const [x, y] = point(r, 5);
    const ans = pt(k * x, k * y);
    return {
      prompt: md`Dilate $P${pt(x, y)}$ by a scale factor of $${k}$ with center at the origin. ${IMAGE}`,
      answer: ans,
      form: "tuple",
      figure: gridFigure([{ name: "O", at: [0, 0], label: "O", dir: "sw" }, { name: "P", at: [x, y] }], [[k * x, k * y]]),
      // P' is on ray OP, k times as far out: each coordinate is k times as big.
      verify: [both(`x = ${k} * ${paren(x)}`, `y = ${k} * ${paren(y)}`)],
      hint: md`With center at the origin, multiply both coordinates by the scale factor.`,
      solution: [
        { math: md`(x, y) \to (${k}x, ${k}y)`, note: "The dilation rule with center at the origin." },
        { math: md`P' = (${k} \cdot ${paren(x)}, ${k} \cdot ${paren(y)}) = ${ans}`, note: md`$P'$ is on ray $OP$, ${k} times as far from the origin.` },
      ],
    };
  }
  if (kind === 1) {
    const [n, d] = r.pick(FACTORS.filter(([, dd]) => dd > 1));
    let [x, y] = [d * r.nonzero(-3, 3), d * r.nonzero(-3, 3)];
    while (Math.abs(x) === Math.abs(y)) [x, y] = [d * r.nonzero(-3, 3), d * r.nonzero(-3, 3)];
    const ans = pt((n * x) / d, (n * y) / d);
    const k = fracTex(n, d);
    return {
      prompt: md`Dilate $P${pt(x, y)}$ by a scale factor of $${k}$ with center at the origin. ${IMAGE}`,
      answer: ans,
      form: "tuple",
      figure: gridFigure([{ name: "O", at: [0, 0], label: "O", dir: "sw" }, { name: "P", at: [x, y] }], [[(n * x) / d, (n * y) / d]]),
      verify: [both(`${d}x = ${n} * ${paren(x)}`, `${d}y = ${n} * ${paren(y)}`)],
      hint: n === 1 ? md`Multiply each coordinate by $${k}$, which means dividing it by ${d}.` : md`Multiply each coordinate by $${k}$: divide by ${d}, then multiply by ${n}.`,
      solution: [
        { math: md`(x, y) \to \left(${k}x, ${k}y\right)`, note: "The dilation rule with center at the origin." },
        { math: md`P' = \left(${k} \cdot ${paren(x)}, ${k} \cdot ${paren(y)}\right) = ${ans}`, note: n < d ? "A scale factor less than 1 shrinks: P' is between O and P." : "A scale factor more than 1 enlarges: P' is beyond P." },
      ],
    };
  }
  if (kind === 2) {
    const [n, d] = r.pick(FACTORS.slice(0, 5));
    const k = n / d;
    let [ax, ay] = [d * r.nonzero(-3, 3), d * r.nonzero(-3, 3)];
    while (Math.abs(ax) === Math.abs(ay)) [ax, ay] = [d * r.nonzero(-3, 3), d * r.nonzero(-3, 3)];
    let [bx, by] = [d * r.nonzero(-3, 3), d * r.nonzero(-3, 3)];
    while (bx === ax && by === ay) [bx, by] = [d * r.nonzero(-3, 3), d * r.nonzero(-3, 3)];
    const ans = pt(k * bx, k * by);
    const kt = fracTex(n, d);
    const rawX = `\\frac{${k * ax}}{${ax}}`;
    const rawY = `\\frac{${k * ay}}{${ay}}`;
    return {
      prompt: md`A dilation with center at the origin maps $A${pt(ax, ay)}$ to $A'${pt(k * ax, k * ay)}$, as in the figure. Where does it map $B${pt(bx, by)}$? ${POINT}`,
      answer: ans,
      form: "tuple",
      figure: gridFigure(
        [{ name: "O", at: [0, 0], label: "O", dir: "sw" }, { name: "A", at: [ax, ay] }, { name: "A'", at: [k * ax, k * ay] }, { name: "B", at: [bx, by] }],
        [[k * bx, k * by]],
        [],
        { segments: [{ from: "O", to: k > 1 ? "A'" : "A", dashed: true, color: 3 }] },
      ),
      // B' is scaled from the origin by the same factor as A', so the coordinate ratios match.
      verify: [both(`x / ${paren(bx)} = ${k * ax} / ${paren(ax)}`, `y / ${paren(by)} = ${k * ay} / ${paren(ay)}`)],
      hint: md`Find the scale factor first: what do you multiply the coordinates of $A$ by to get those of $A'$?`,
      solution: [
        { math: md`k = ${then(rawX, kt)}`, note: md`Each coordinate of $A'$ is $k$ times that of $A$. (The $y$-coordinates agree: $${then(rawY, kt)}$.)` },
        { math: md`B' = \left(${kt} \cdot ${paren(bx)}, ${kt} \cdot ${paren(by)}\right) = ${ans}`, note: "Apply the same scale factor to B." },
      ],
    };
  }
  const h = r.nonzero(-3, 3);
  const j = r.nonzero(-3, 3);
  const half = r.next() < 0.3;
  const k = half ? 1 / 2 : r.int(2, 3);
  const kt = half ? md`\frac{1}{2}` : String(k);
  const step = half ? 2 : 1;
  let [dx, dy] = [step * r.nonzero(-3, 3), step * r.nonzero(-3, 3)];
  while (Math.abs(dx) === Math.abs(dy)) [dx, dy] = [step * r.nonzero(-3, 3), step * r.nonzero(-3, 3)];
  const [px, py] = [h + dx, j + dy];
  const ans = pt(h + k * dx, j + k * dy);
  return {
    prompt: md`Dilate $P${pt(px, py)}$ by a scale factor of $${kt}$ with center $C${pt(h, j)}$. ${IMAGE}`,
    answer: ans,
    form: "tuple",
    figure: gridFigure(
      [
        { name: "C", at: [h, j], dir: compass([px, py], [h, j]) },
        { name: "P", at: [px, py], dir: compass([h, j], [px, py]) },
      ],
      [[h + k * dx, j + k * dy]],
    ),
    // The trip from C to P' is k times the trip from C to P.
    verify: [both(`x - ${paren(h)} = ${half ? "1/2" : k} * (${px} - ${paren(h)})`, `y - ${paren(j)} = ${half ? "1/2" : k} * (${py} - ${paren(j)})`)],
    hint: md`Find how far $P$ is from $C$ in each direction, scale those distances by $${kt}$, then add them back on to $C$.`,
    solution: [
      { math: md`\langle ${px} - ${paren(h)}, ${py} - ${paren(j)} \rangle = \langle ${dx}, ${dy} \rangle`, note: "The trip from C to P, as a vector." },
      { math: md`${kt} \cdot \langle ${dx}, ${dy} \rangle = \langle ${k * dx}, ${k * dy} \rangle`, note: "The trip from C to P' is k times as long, in the same direction." },
      { math: md`P' = (${h} ${signed(k * dx)}, ${j} ${signed(k * dy)}) = ${ans}`, note: "Start at C and make the scaled trip." },
    ],
  };
};

const dilationLengths: Generator = (r) => {
  const kind = r.int(0, 4);
  const [n, d] = r.pick(FACTORS);
  const k = fracTex(n, d);
  if (kind === 0) {
    const ab = d * r.int(2, 8);
    const ans = (n * ab) / d;
    return {
      prompt: md`In the figure, a dilation with center $C$ and scale factor $${k}$ maps $\overline{AB}$ to $\overline{A'B'}$. Find $A'B'$. ${EXACT}`,
      answer: String(ans),
      figure: dilationFigure(n / d, String(ab), "?"),
      verify: [`x = ${n}/${d} * ${ab}`],
      hint: md`A dilation multiplies every length by the scale factor.`,
      solution: [
        { math: md`A'B' = k \cdot AB`, note: "Dilations multiply lengths by k." },
        { math: md`A'B' = ${k} \cdot ${ab} = ${ans}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const m = r.int(2, 8);
    const [ab, img] = [d * m, n * m];
    return {
      prompt: md`In the figure, a dilation with center $C$ and scale factor $${k}$ maps $\overline{AB}$ to $\overline{A'B'}$. Find $AB$. ${EXACT}`,
      answer: String(ab),
      figure: dilationFigure(n / d, "?", String(img)),
      verify: [`${img} = ${n}/${d} * x`],
      hint: md`$A'B' = k \cdot AB$. This time you know $A'B'$, so divide by $k$.`,
      solution: [
        { math: md`${img} = ${k} \cdot AB`, note: "Dilations multiply lengths by k." },
        { math: md`AB = ${img} \div ${k} = ${ab}`, note: md`Dividing by $${k}$ is multiplying by $${fracTex(d, n)}$.` },
      ],
    };
  }
  if (kind === 2) {
    let s: number[];
    do s = [r.int(3, 12), r.int(3, 12), r.int(3, 12)].sort((p, q) => p - q);
    while (s[0]! + s[1]! <= s[2]! || s[0] === s[2]);
    const sum = s[0]! + s[1]! + s[2]!;
    return {
      prompt: md`The triangle in the figure is dilated by a scale factor of $${k}$. Find the perimeter of the image. ${EXACT}`,
      answer: frac(n * sum, d),
      simplified: true,
      figure: sidesFigure(s),
      // Every side is multiplied by k, so the perimeter is too.
      verify: [`x = ${n}/${d} * ${s[0]} + ${n}/${d} * ${s[1]} + ${n}/${d} * ${s[2]}`],
      hint: md`Every side is multiplied by $${k}$, so the perimeter is too.`,
      solution: [
        { math: md`P = ${s[0]} + ${s[1]} + ${s[2]} = ${sum}`, note: "Perimeter of the original triangle." },
        { math: md`P' = ${k} \cdot ${s[0]} + ${k} \cdot ${s[1]} + ${k} \cdot ${s[2]} = ${k} \cdot ${sum}`, note: "Each side scales by k; factor k out (Distributive Property)." },
        { math: md`P' = ${fracTex(n * sum, d)}`, note: "" },
      ],
    };
  }
  if (kind === 3) {
    const shape = r.pick(["rectangle", "triangle", "pentagon"]);
    const area = d * d * r.int(1, 6) + (d === 1 ? r.int(1, 9) : 0);
    return {
      prompt: md`A ${shape} with area ${area} is dilated by a scale factor of $${k}$. Find the area of the image. ${EXACT}`,
      answer: frac(n * n * area, d * d),
      simplified: true,
      // Lengths scale by k, so areas scale by k^2.
      verify: [`x = (${n}/${d})^2 * ${area}`],
      hint: md`Lengths scale by $k$, so areas scale by $k^2$: width and height both get multiplied by $k$.`,
      solution: [
        { math: md`A' = k^2 \cdot A`, note: "Area is length times length, so it picks up a factor of k twice." },
        { math: md`A' = \left(${k}\right)^2 \cdot ${area} = ${fracTex(n * n, d * d)} \cdot ${area}`, note: "" },
        { math: md`A' = ${fracTex(n * n * area, d * d)}`, note: "" },
      ],
    };
  }
  const cp = d * r.int(1, 6);
  const cpImg = (n * cp) / d;
  const gap = Math.abs(cpImg - cp);
  return {
    prompt: md`In the figure, a dilation with center $C$ and scale factor $${k}$ maps $P$ to $P'$. Find $PP'$, the distance between $P$ and $P'$. ${EXACT}`,
    answer: String(gap),
    figure: rayFigure(cp, n / d),
    // CP' = k CP, and the Segment Addition Postulate on the ray.
    verify: [n > d ? `${cp} + x = ${n}/${d} * ${cp}` : `${n}/${d} * ${cp} + x = ${cp}`],
    hint: md`$P$ and $P'$ are on the same ray from $C$. Find $CP'$, then compare it with $CP$.`,
    solution: [
      { math: md`CP' = ${k} \cdot ${cp} = ${cpImg}`, note: "The definition of a dilation." },
      { math: md`PP' = ${Math.max(cp, cpImg)} - ${Math.min(cp, cpImg)} = ${gap}`, note: n > d ? "P' is beyond P on the ray, so subtract (Segment Addition Postulate)." : "P' is between C and P, so subtract (Segment Addition Postulate)." },
    ],
  };
};

const dilationEquations: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const k = r.int(2, 4);
    const a = r.int(1, 2);
    const sol = r.int(2, 8);
    const b = r.int(1, 6);
    let c = r.int(1, 9);
    while (c === k * a) c = r.int(1, 9);
    const d = k * (a * sol + b) - c * sol;
    const ab = poly([[a, "x"], [b, ""]]);
    const img = poly([[c, "x"], [d, ""]]);
    return {
      prompt: md`In the figure, a dilation with center $C$ and scale factor $${k}$ maps $\overline{AB}$ to $\overline{A'B'}$. Find $x$.`,
      answer: String(sol),
      figure: dilationFigure(k, ab, img),
      // A'B' = k AB.
      verify: [`${img} = ${k} * (${ab})`],
      hint: "Distribute the scale factor, then collect the x-terms on one side.",
      solution: [
        { math: md`${poly([[k * a, "x"], [k * b, ""]])} = ${img}`, note: md`Distribute the ${k}.` },
        { math: md`${poly([[k * a - c, "x"]])} = ${(k * a - c) * sol}`, note: "Collect x-terms on the left and numbers on the right." },
        ...(k * a - c === 1 ? [] : [{ math: md`x = ${sol}`, note: md`Divide by ${k * a - c}.` }]),
        { math: md`AB = ${a * sol + b}, \quad A'B' = ${c * sol + d} = ${k} \cdot ${a * sol + b} \;\checkmark`, note: "Check by substituting." },
      ],
    };
  }
  if (kind === 1) {
    const sol = r.int(3, 15);
    let a = r.int(2, 6);
    let c = r.int(2, 6);
    while (c === a) c = r.int(2, 6);
    if (a < c) [a, c] = [c, a];
    const value = r.int(6, 30) * 5;
    const b = value - a * sol;
    const d = value - c * sol;
    const left = poly([[a, "x"], [b, ""]]);
    const right = poly([[c, "x"], [d, ""]]);
    // Label the angles in the figure when they fit there; otherwise give them in the prompt.
    const labeled = dilatedAngleFigure(value, [md`(${left})^\circ`, md`(${right})^\circ`]);
    const given = labeled.fits ? "" : md` $m\angle ABC = (${left})^\circ$ and $m\angle A'B'C' = (${right})^\circ$.`;
    return {
      prompt: md`In the figure, a dilation with center $O$ maps $\triangle ABC$ to $\triangle A'B'C'$.${given} Find $x$.`,
      answer: String(sol),
      figure: labeled.fits ? labeled.fig : dilatedAngleFigure(value).fig,
      // Dilations preserve angle measure.
      verify: [`${left} = ${right}`],
      hint: "A dilation changes lengths but not angles, so the two measures are equal.",
      solution: [
        { math: md`${left} = ${right}`, note: "Dilations preserve angle measure." },
        { math: md`${poly([[a - c, "x"]])} = ${d - b}`, note: md`Subtract $${c}x$${b === 0 ? "" : b < 0 ? ` and add ${-b}` : ` and subtract ${b}`} on both sides.` },
        ...(a - c === 1 ? [] : [{ math: md`x = ${sol}`, note: md`Divide by ${a - c}.` }]),
        { math: md`\angle ABC = \angle A'B'C' = ${value}^\circ`, note: md`Check: put $x = ${sol}$ into both expressions. The scale factor never entered the problem.` },
      ],
    };
  }
  if (kind === 2) {
    const L = r.int(2, 12);
    let M = r.int(2, 20);
    while (M === L) M = r.int(2, 20);
    const toScale = drawnRatio(M / L) === M / L;
    return {
      prompt: md`In the figure, a dilation with center $C$ maps $\overline{AB}$ to $\overline{A'B'}$. Find the scale factor. ${EXACT}${toScale ? "" : ` ${NOT_TO_SCALE}`}`,
      answer: frac(M, L),
      simplified: true,
      figure: dilationFigure(drawnRatio(M / L), String(L), String(M)),
      // Image length = k times original length.
      verify: [`${L}k = ${M}`],
      hint: md`Image length = $k$ times original length. Divide both sides by ${L}.`,
      solution: [
        { math: md`k = \frac{${M}}{${L}}${frac(M, L) === `${M}/${L}` ? "" : ` = ${fracTex(M, L)}`}`, note: "Divide both sides by the original length, and reduce." },
        { math: M > L ? md`k > 1` : md`k < 1`, note: M > L ? "Bigger than 1: an enlargement." : "Less than 1: a reduction." },
      ],
    };
  }
  const h = r.nonzero(-3, 3);
  const j = r.int(-3, 3);
  const k = r.int(2, 4);
  const dx = r.nonzero(-3, 3);
  const dy = r.int(-2, 2);
  const [px, py] = [h + dx, j + dy];
  const img = h + k * dx;
  return {
    prompt: md`A dilation with center $C${pt(h, j)}$ maps $P${pt(px, py)}$ to $P'${pt(img, j + k * dy)}$, as in the figure. Find the scale factor $k$.`,
    answer: String(k),
    figure: gridFigure(
      [
        { name: "C", at: [h, j], dir: dy === 0 ? "s" : compass([px, py], [h, j]) },
        { name: "P", at: [px, py], dir: dy === 0 ? "n" : compass([h, j], [px, py]) },
        { name: "P'", at: [img, j + k * dy], dir: dy === 0 ? "s" : compass([h, j], [img, j + k * dy]) },
      ],
      [],
      [],
      { segments: [{ from: "C", to: "P'", dashed: true, color: 3 }] },
    ),
    // The trip from C to P' is k times the trip from C to P, in each coordinate.
    verify: [`${img} - ${paren(h)} = k(${px} - ${paren(h)})`, `${j + k * dy} - ${paren(j)} = k(${py} - ${paren(j)})`],
    hint: md`Simplify inside the parentheses, ${h > 0 ? `subtract ${h}` : `add ${-h}`} on both sides, then divide.`,
    solution: [
      { math: md`${poly([[h, ""], [dx, "k"]])} = ${img}`, note: md`$${px} ${signed(-h)} = ${dx}$: the horizontal trip from C to P.` },
      { math: md`${poly([[dx, "k"]])} = ${img - h}`, note: md`${h > 0 ? `Subtract ${h}` : `Add ${-h}`} on both sides.` },
      ...(dx === 1 ? [] : [{ math: md`k = ${k}`, note: md`Divide by ${dx}.` }]),
      { math: md`${j} + ${k}(${dy}) = ${j + k * dy}`, note: md`Check: the $y$-coordinates agree with $k = ${k}$.` },
    ],
  };
};

// ── Lesson 3 practice: symmetry ─────────────────────────────────────────────

const POLYGON: Record<number, string> = {
  3: "an equilateral triangle",
  4: "a square",
  5: "a regular pentagon",
  6: "a regular hexagon",
  7: "a regular heptagon (7 sides)",
  8: "a regular octagon",
  9: "a regular nonagon (9 sides)",
  10: "a regular decagon (10 sides)",
  12: "a regular dodecagon (12 sides)",
};
const polygonName = (n: number) => POLYGON[n] ?? `a regular ${n}-gon (${n} sides)`;

const SHAPES: { name: string; lines: number; order: number }[] = [
  { name: "a scalene triangle", lines: 0, order: 1 },
  { name: "an isosceles triangle that is not equilateral", lines: 1, order: 1 },
  { name: "an equilateral triangle", lines: 3, order: 3 },
  { name: "a parallelogram that is not a rectangle or a rhombus", lines: 0, order: 2 },
  { name: "a rectangle that is not a square", lines: 2, order: 2 },
  { name: "a rhombus that is not a square", lines: 2, order: 2 },
  { name: "a square", lines: 4, order: 4 },
  { name: "an isosceles trapezoid that is not a rectangle", lines: 1, order: 1 },
  { name: "a kite that is not a rhombus", lines: 1, order: 1 },
  { name: "a regular pentagon", lines: 5, order: 5 },
  { name: "a regular hexagon", lines: 6, order: 6 },
];

const SHAPE_WHY: Record<string, string> = {
  "a scalene triangle": "No two sides match, so no fold or turn can swap any of them.",
  "an isosceles triangle that is not equilateral": "The one line through the vertex angle and the midpoint of the base swaps the two equal sides. No turn short of a full turn works: it would have to move the base onto one of the other sides, which have a different length.",
  "an equilateral triangle": "Each line from a vertex to the midpoint of the opposite side works, and turns of 120 and 240 degrees (and 360) work.",
  "a parallelogram that is not a rectangle or a rhombus": "A half turn about the point where the diagonals cross works, because the diagonals bisect each other. No fold does.",
  "a rectangle that is not a square": "The two lines through the midpoints of opposite sides work. The diagonals don't: folding along one would put a long side onto a short one. A half turn about the center works.",
  "a rhombus that is not a square": "The two diagonals are lines of symmetry, and a half turn works.",
  "a square": "Two diagonals and two midlines, and quarter turns.",
  "an isosceles trapezoid that is not a rectangle": "One line, through the midpoints of the two bases. Only a full turn maps it onto itself.",
  "a kite that is not a rhombus": "One line, the diagonal between the two pairs of equal sides. Only a full turn maps it onto itself.",
  "a regular pentagon": "Five lines, one through each vertex, and turns by multiples of 72 degrees.",
  "a regular hexagon": "Six lines, and turns by multiples of 60 degrees.",
};

/**
 * A picture of each shape in SHAPES: corners, tick marks on the sides the name says are equal,
 * parallel marks where it says sides are parallel, and right-angle marks.
 */
const SHAPE_PICTURES: Record<string, { verts: XY[]; ticks?: (1 | 2 | undefined)[]; parallel?: (1 | 2 | undefined)[]; right?: boolean }> = {
  "a scalene triangle": { verts: [[0, 0], [5, 0], [1.4, 2.8]] },
  "an isosceles triangle that is not equilateral": { verts: [[0, 0], [3.6, 0], [1.8, 3.4]], ticks: [undefined, 1, 1] },
  "an equilateral triangle": { verts: regular(3), ticks: [1, 1, 1] },
  "a parallelogram that is not a rectangle or a rhombus": { verts: [[0, 0], [4.4, 0], [5.6, 2.2], [1.2, 2.2]], parallel: [1, 2, 1, 2] },
  "a rectangle that is not a square": { verts: [[0, 0], [5, 0], [5, 2.6], [0, 2.6]], right: true },
  "a rhombus that is not a square": { verts: [[-2.6, 0], [0, -1.5], [2.6, 0], [0, 1.5]], ticks: [1, 1, 1, 1] },
  "a square": { verts: [[0, 0], [3, 0], [3, 3], [0, 3]], ticks: [1, 1, 1, 1], right: true },
  "an isosceles trapezoid that is not a rectangle": { verts: [[0, 0], [5, 0], [3.8, 2.4], [1.2, 2.4]], ticks: [undefined, 1, undefined, 1], parallel: [1, undefined, 1, undefined] },
  "a kite that is not a rhombus": { verts: [[0, 3], [-1.6, 1.4], [0, -2.2], [1.6, 1.4]], ticks: [1, 2, 2, 1] },
  "a regular pentagon": { verts: regular(5), ticks: [1, 1, 1, 1, 1] },
  "a regular hexagon": { verts: regular(6), ticks: [1, 1, 1, 1, 1, 1] },
};

function shapeFigure(name: string): DiagramFigure {
  const pic = SHAPE_PICTURES[name]!;
  const fig = polygonFigure(pic.verts);
  const n = pic.verts.length;
  const names = pic.verts.map((_, i) => `V${i}`);
  fig.segments = names
    .map((a, i) => ({ from: a, to: names[(i + 1) % n]!, ticks: pic.ticks?.[i], parallel: pic.parallel?.[i] }))
    .filter((sg) => sg.ticks || sg.parallel);
  if (pic.right) fig.angles = names.map((a, i) => ({ at: a, from: names[(i + n - 1) % n]!, to: names[(i + 1) % n]!, right: true }));
  return fig;
}

const symmetryCounts: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const n = r.int(3, 12);
    const odd = n % 2 === 1;
    return {
      prompt: md`The figure shows ${polygonName(n)}. How many lines of symmetry does it have? Give a whole number.`,
      answer: String(n),
      figure: polygonFigure(regular(n), false, true),
      hint: "A regular polygon has one line of symmetry for each vertex. Check how they pair up for odd and even numbers of sides.",
      solution: [
        {
          math: md`n = ${n}`,
          note: odd
            ? md`With an odd number of sides, each line runs from a vertex to the midpoint of the opposite side: one line per vertex, ${n} lines.`
            : md`With an even number of sides, ${n / 2} lines join opposite vertices and ${n / 2} join midpoints of opposite sides: ${n} lines.`,
        },
      ],
    };
  }
  if (kind === 1) {
    const n = r.pick([3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20]);
    return {
      prompt: md`The figure shows ${polygonName(n)} with center $O$. What is the smallest positive angle of rotation about $O$ that maps it onto itself? Give the angle in degrees.`,
      answer: String(360 / n),
      figure: polygonFigure(regular(n), true, true),
      // n of these turns make one full turn.
      verify: [`${n}x = 360`],
      hint: md`Turning by one central angle moves each vertex to the next one. The ${n} central angles fill $360^\circ$.`,
      solution: [{ math: md`\frac{360^\circ}{${n}} = ${360 / n}^\circ`, note: "Each vertex moves to the next one, so the polygon lands on itself." }],
    };
  }
  if (kind === 2) {
    const n = r.pick([3, 4, 5, 6, 8]);
    const angles = Array.from({ length: n }, (_, i) => (360 / n) * (i + 1));
    return {
      prompt: md`The figure shows ${polygonName(n)} with center $O$. List every angle from $1^\circ$ to $360^\circ$ (counterclockwise, about $O$) that maps it onto itself. Give the angles in degrees, separated by commas.`,
      answer: angles.join(", "),
      form: "set",
      figure: polygonFigure(regular(n), true, true),
      // Each listed turn, done n times, is a whole number of full turns. (This checks each angle works, not that the list is complete.)
      verify: [`cos(${n}x * pi/180) = 1`],
      hint: md`Find the smallest one, $\frac{360^\circ}{${n}}$, then take its multiples up to $360^\circ$.`,
      solution: [
        { math: md`\frac{360^\circ}{${n}} = ${360 / n}^\circ`, note: "The smallest turn moves each vertex to the next." },
        { math: angles.map((a) => `${a}^\\circ`).join(", \\;"), note: md`Turning again and again keeps working. That gives ${n} angles, so the order of rotational symmetry is ${n}.` },
      ],
    };
  }
  if (kind === 3) {
    const s = r.pick(SHAPES);
    const askLines = r.next() < 0.5;
    return {
      prompt: askLines
        ? `The figure shows ${s.name}. How many lines of symmetry does it have? Give a whole number.`
        : `The figure shows ${s.name}. What is its order of rotational symmetry? Give a whole number (a figure with no rotational symmetry has order 1).`,
      answer: String(askLines ? s.lines : s.order),
      figure: shapeFigure(s.name),
      hint: askLines
        ? "Imagine folding along each candidate line: through vertices, and through midpoints of sides. Does each half land exactly on the other?"
        : "Count the positions, in one full turn about the center, where the figure fits exactly onto its outline. The full turn itself counts as one.",
      solution: [{ math: md`${askLines ? s.lines : s.order}`, note: SHAPE_WHY[s.name]! }],
    };
  }
  const target = r.pick(SHAPES);
  const others = shuffle(
    r,
    SHAPES.filter((s) => s.lines !== target.lines || s.order !== target.order),
  ).slice(0, 3);
  const lines = target.lines === 0 ? "no lines" : target.lines === 1 ? "exactly 1 line" : `exactly ${target.lines} lines`;
  const cap = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;
  return {
    prompt: `Which of these has ${lines} of symmetry and rotational symmetry of order ${target.order}?`,
    choices: shuffle(r, [target.name, ...others.map((s) => s.name)]),
    accept: [target.name],
    hint: "Check each shape for folds first, then for turns. Order 1 means only the full turn works.",
    solution: [
      { math: md`\text{${target.lines} line${target.lines === 1 ? "" : "s"}, order ${target.order}}`, note: `${cap(target.name)}. ${SHAPE_WHY[target.name]}` },
      ...others.map((s) => ({ math: md`\text{${s.lines} line${s.lines === 1 ? "" : "s"}, order ${s.order}}`, note: `${cap(s.name)} has this symmetry, so it doesn't fit.` })),
    ],
  };
};

const coordinateSymmetry: Generator = (r) => {
  const kind = r.int(0, 6);
  const [x, y] = point(r);
  const ask = "Give that point as (x, y).";
  if (kind === 6) {
    const h = r.int(-3, 3);
    const a = r.pick([1, 2, -1]);
    const k = r.int(-5, 5);
    const dd = r.nonzero(-3, 3);
    const x0 = h + dd;
    const y0 = a * dd * dd + k;
    const sq = h === 0 ? "x^2" : `(x ${signed(-h)})^2`;
    const f = `${a === 1 ? "" : a === -1 ? "-" : a}${sq}${k === 0 ? "" : ` ${signed(k)}`}`;
    return {
      prompt: md`The parabola $y = ${f}$ in the graph passes through $${pt(x0, y0)}$. Its line of symmetry gives a second point on the parabola at the same height. ${ask}`,
      answer: pt(2 * h - x0, y0),
      form: "tuple",
      figure: {
        kind: "plot",
        x: [h - Math.abs(dd) - 3, h + Math.abs(dd) + 3],
        y: [Math.min(k, y0) - 3, Math.max(k, y0) + 3],
        curves: [{ expr: f }],
        points: [{ x: x0, y: y0, label: pt(x0, y0) }],
      },
      // The second point is on the parabola, and the axis x = h is halfway between the two.
      verify: [both(`y = ${f}`, `(${x0} + x)/2 = ${h}`)],
      hint: md`The line of symmetry of $y = a(x - h)^2 + k$ is the vertical line $x = h$. Reflect the point across it.`,
      solution: [
        { math: md`x = ${h}`, note: "The axis of symmetry, through the vertex (Algebra 1, Unit 8)." },
        { math: md`x' = 2(${h}) - ${paren(x0)} = ${2 * h - x0}`, note: md`The line $x = ${h}$ is halfway between the two $x$-values: $\frac{${x0} + x'}{2} = ${h}$.` },
        { math: md`${pt(2 * h - x0, y0)}`, note: md`Check: $${f.replace(/x/g, `(${2 * h - x0})`)} = ${y0}$.` },
      ],
    };
  }
  const cases = [
    { has: md`has the $y$-axis as a line of symmetry`, m: REFLECT_Y, how: md`Reflecting $P$ across the $y$-axis` },
    { has: md`has the $x$-axis as a line of symmetry`, m: REFLECT_X, how: md`Reflecting $P$ across the $x$-axis` },
    { has: md`has the line $y = x$ as a line of symmetry`, m: REFLECT_YX, how: md`Reflecting $P$ across the line $y = x$` },
    { has: md`has $180^\circ$ rotational symmetry about the origin`, m: ROTATE_180, how: md`Rotating $P$ by $180^\circ$ about the origin` },
    { has: md`has $90^\circ$ rotational symmetry about the origin`, m: ROTATE_90, how: md`Rotating $P$ by $90^\circ$ counterclockwise about the origin` },
  ];
  if (kind === 5) {
    const k = r.nonzero(-3, 3);
    if (x === k) return coordinateSymmetry(r);
    const ans = pt(2 * k - x, y);
    return {
      prompt: md`A figure has the line $x = ${k}$ as a line of symmetry and contains $P${pt(x, y)}$, plotted below with the line. Reflecting $P$ across that line gives another point that must be on the figure. ${ask}`,
      answer: ans,
      form: "tuple",
      figure: gridFigure([{ name: "P", at: [x, y] }], [[2 * k - x, y]], [{ v: "x", k }]),
      verify: [both(`(${x} + x)/2 = ${k}`, `y - ${paren(y)} = 0`)],
      hint: md`The reflection is level with $P$, and the line $x = ${k}$ is halfway between them.`,
      solution: [
        { math: md`\frac{${x} + x'}{2} = ${k}`, note: "The line of symmetry is the perpendicular bisector of PP'." },
        { math: md`x' = ${2 * k} - ${paren(x)} = ${2 * k - x}`, note: "" },
        { math: ans, note: "The y-coordinate doesn't change." },
      ],
    };
  }
  const c = cases[kind]!;
  const [u, v] = c.m.f(x, y);
  const ans = pt(u, v);
  return {
    prompt: md`A figure ${c.has} and contains $P${pt(x, y)}$, plotted below. ${c.how} gives another point that must be on the figure. ${ask}`,
    answer: ans,
    form: "tuple",
    figure: c.m.mirror ? gridFigure([{ name: "P", at: [x, y] }], [[u, v]], [c.m.mirror]) : gridFigure([{ name: "O", at: [0, 0], label: "O", dir: "sw" }, { name: "P", at: [x, y] }], [[u, v]]),
    verify: [both(...c.m.holds(x, y))],
    hint: md`A symmetry maps the figure onto itself, so it sends every point of the figure to a point of the figure. Apply the rule: $${c.m.rule}$.`,
    solution: [
      { math: c.m.rule, note: c.m.why },
      { math: then(c.m.sub(x, y), ans), note: "That image is on the figure too, because the symmetry maps the figure onto itself." },
    ],
  };
};

const sidesFromAngles: Generator = (r) => {
  const kind = r.int(0, 2);
  const n = r.pick([3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20]);
  const turn = 360 / n;
  if (kind === 0) {
    return {
      prompt: md`Solve $\frac{360}{n} = ${turn}$. Its solution is the number of sides of a regular polygon whose smallest rotational symmetry is a turn of $${turn}^\circ$.`,
      answer: String(n),
      hint: "Multiply both sides by n, then divide.",
      solution: [
        { math: md`360 = ${turn}n`, note: "Multiply both sides by n." },
        { math: md`n = ${n}`, note: md`Divide by ${turn}. A regular ${n}-sided polygon turns onto itself every $${turn}^\circ$.` },
      ],
    };
  }
  const interior = 180 - turn;
  if (kind === 1) {
    return {
      prompt: md`Solve $\frac{180(n - 2)}{n} = ${interior}$. Its solution is the number of sides of a regular polygon with interior angles of $${interior}^\circ$.`,
      answer: String(n),
      hint: "Multiply both sides by n, distribute, and collect the n-terms.",
      solution: [
        { math: md`180n - 360 = ${interior}n`, note: "Multiply both sides by n and distribute." },
        { math: md`${180 - interior}n = 360`, note: md`Subtract $${interior}n$ and add 360.` },
        { math: md`n = ${n}`, note: md`Divide by ${180 - interior}. Notice $${180 - interior}^\circ$ is the exterior angle, and it is also the smallest turn that maps the polygon onto itself.` },
      ],
    };
  }
  return {
    prompt: md`Solve $x + ${interior} = 180$. Its solution is the smallest rotation, in degrees, that maps a regular polygon with interior angles of $${interior}^\circ$ onto itself.`,
    answer: String(turn),
    hint: "An exterior angle and its interior angle form a linear pair, and the exterior angle is the smallest turn.",
    solution: [
      { math: md`x = 180 - ${interior} = ${turn}`, note: md`Subtract ${interior}. That is the exterior angle.` },
      { math: md`${turn}^\circ = \frac{360^\circ}{${n}}`, note: md`The polygon has ${n} sides, and the smallest turn moves each vertex to the next one.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit9: Unit = {
  title: "Transformations",
  lessons: [
    {
      id: "translations-reflections-and-rotations",
      title: "Translations, reflections and rotations",
      summary: "The three moves that keep size and shape, their coordinate rules, and why they explain congruence.",
      blocks: [
        {
          kind: "text",
          body: md`A **transformation** is a rule that sends every point of the plane to a point. The figure you start with is the **pre-image**. Where it lands is the **image**. Image points get a prime: $A$ goes to $A'$ ("A prime"). A second move sends $A'$ to $A''$.

This lesson is about three moves that never stretch or bend anything: sliding, flipping and turning. At the end they give a new way to see congruence from Unit 3.`,
        },
        {
          kind: "key",
          title: "Translation",
          body: md`A **translation** slides every point the same distance in the same direction. Sliding $a$ units right and $b$ units up is the rule

$$(x, y) \to (x + a, y + b).$$

The arrow from any point to its image is the same for every point. It is the **translation vector** $\langle a, b \rangle$. A negative $a$ means left, and a negative $b$ means down.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-5, 5, -3, 5],
          points: [
            { name: "A", x: -4, y: 1, dir: "w" },
            { name: "B", x: -1, y: 1, dir: "s" },
            { name: "C", x: -3, y: 4, dir: "n" },
            { name: "A'", x: 1, y: -2, dir: "sw" },
            { name: "B'", x: 4, y: -2, dir: "se" },
            { name: "C'", x: 2, y: 1, dir: "ne" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["A'", "B'", "C'"], fill: 2 },
          ],
          segments: [
            { from: "A", to: "A'", dashed: true, color: 2, arrow: true },
            { from: "B", to: "B'", dashed: true, color: 2, arrow: true },
            { from: "C", to: "C'", dashed: true, color: 2, arrow: true },
          ],
          caption: md`The translation by $\langle 5, -3 \rangle$: every point moves 5 right and 3 down. The three arrows are parallel and equally long.`,
        },
        {
          kind: "why",
          title: "Why a translation keeps every length",
          body: md`By the Distance Formula (Unit 5), the length of $\overline{AB}$ depends only on the differences $x_2 - x_1$ and $y_2 - y_1$. A translation adds the same $a$ to both $x$-coordinates:

$$(x_2 + a) - (x_1 + a) = x_2 - x_1.$$

The same happens with $b$ and the $y$-coordinates. The differences don't change, so the distance doesn't either.`,
        },
        {
          kind: "key",
          title: "Reflection",
          body: md`A **reflection** across a line $\ell$, the **line of reflection**, sends each point $P$ to the point $P'$ for which $\ell$ is the perpendicular bisector of $\overline{PP'}$. Points on $\ell$ stay where they are.

- Across the $x$-axis: $(x, y) \to (x, -y)$
- Across the $y$-axis: $(x, y) \to (-x, y)$
- Across the line $y = x$: $(x, y) \to (y, x)$`,
        },
        {
          kind: "why",
          title: "Why the axis rules work",
          body: md`Take $P(a, b)$ and $P'(a, -b)$. They have the same $x$-coordinate, so $\overline{PP'}$ is vertical, which makes it perpendicular to the horizontal $x$-axis. Its midpoint is $\left(a, \frac{b + (-b)}{2}\right) = (a, 0)$, which is on the $x$-axis. So the $x$-axis is the perpendicular bisector of $\overline{PP'}$, exactly what the definition asks. The $y$-axis rule works the same way with the roles of $x$ and $y$ swapped.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-1, 7, -1, 7],
          points: [
            { name: "O", x: 0, y: 0, label: "", hidden: true },
            { name: "A", x: 1, y: 3, dir: "w" },
            { name: "B", x: 1, y: 5, dir: "nw" },
            { name: "C", x: 3, y: 5, dir: "n" },
            { name: "A'", x: 3, y: 1, dir: "s" },
            { name: "B'", x: 5, y: 1, dir: "se" },
            { name: "C'", x: 5, y: 3, dir: "e" },
            { name: "M", x: 3, y: 3, dir: "se" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["A'", "B'", "C'"], fill: 2 },
          ],
          segments: [
            { from: "O", to: "M", kind: "line", color: 3 },
            { from: "B", to: "M", dashed: true, ticks: 1 },
            { from: "M", to: "B'", dashed: true, ticks: 1 },
          ],
          angles: [{ at: "M", from: "B", to: "O", right: true }],
          labels: [{ x: 6.2, y: 5.5, text: "y = x" }],
          caption: md`Reflection across $y = x$. The line crosses $\overline{BB'}$ at its midpoint $M(3, 3)$, at a right angle. Each image point has its coordinates swapped: $B(1, 5) \to B'(5, 1)$.`,
        },
        {
          kind: "proof",
          title: "Reflecting across y = x swaps the coordinates",
          given: md`$P = (a, b)$ with $a \ne b$, and $P' = (b, a)$.`,
          prove: md`The line $y = x$ is the perpendicular bisector of $\overline{PP'}$, so $P'$ is the reflection of $P$.`,
          steps: [
            { statement: md`The midpoint of $\overline{PP'}$ is $M = \left(\frac{a + b}{2}, \frac{b + a}{2}\right)$.`, reason: "Midpoint Formula (Unit 5)" },
            { statement: md`$M$ lies on the line $y = x$.`, reason: md`Its coordinates are equal, since $a + b = b + a$ (commutative property)` },
            { statement: md`The slope of $\overleftrightarrow{PP'}$ is $\frac{a - b}{b - a} = -1$.`, reason: md`Slope formula; $b - a \ne 0$ because $a \ne b$` },
            { statement: md`The slope of $y = x$ is $1$.`, reason: md`It is $y = 1x + 0$` },
            { statement: md`$\overleftrightarrow{PP'}$ is perpendicular to $y = x$.`, reason: md`$(-1)(1) = -1$: perpendicular slopes (Algebra 1, Unit 4)` },
            { statement: md`$y = x$ is the perpendicular bisector of $\overline{PP'}$.`, reason: "It passes through the midpoint (step 2) and is perpendicular (step 5)" },
            { statement: md`$P'$ is the reflection of $P$ across $y = x$.`, reason: "Definition of reflection" },
          ],
        },
        {
          kind: "example",
          title: "Reflecting across a line that isn't an axis",
          problem: md`Reflect $P(5, 3)$ across the vertical line $x = 2$.`,
          steps: [
            { math: md`P' = (x', 3)`, note: md`$\overline{PP'}$ must be perpendicular to a vertical line, so it is horizontal: the $y$-coordinate stays 3.` },
            { math: md`\frac{5 + x'}{2} = 2`, note: md`The line $x = 2$ passes through the midpoint of $\overline{PP'}$.` },
            { math: md`x' = 4 - 5 = -1`, note: "Multiply by 2, then subtract 5." },
            { math: md`P' = (-1, 3)`, note: md`Check: 5 and $-1$ are both 3 units from 2. In general, reflecting across $x = k$ is $(x, y) \to (2k - x, y)$, and across $y = k$ it is $(x, y) \to (x, 2k - y)$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Reflect $(4, -1)$ across the line $y = x$. Give the point as (x, y).`,
          answer: "(-1, 4)",
          form: "tuple",
          explain: md`Reflecting across $y = x$ swaps the coordinates: $(4, -1) \to (-1, 4)$.`,
        },
        {
          kind: "key",
          title: "Rotation",
          body: md`A **rotation** about a point $O$, the **center**, through an angle $\theta$ sends each point $P$ to the point $P'$ with

$$OP' = OP \quad\text{and}\quad \angle POP' = \theta.$$

The angle is measured counterclockwise from $\overrightarrow{OP}$; rotations are counterclockwise unless a problem says otherwise. An angle measure is at most $180^\circ$, so this describes turns up to $180^\circ$. A bigger turn is built from smaller ones: a $270^\circ$ turn is three $90^\circ$ turns. The center stays where it is.`,
        },
        {
          kind: "text",
          body: md`Now find the rule for a $90^\circ$ rotation about the origin. Start with $P(a, b)$. Drop a perpendicular to the $x$-axis at $Q(a, 0)$. That makes a right triangle $OQP$ with a horizontal leg of length $a$ and a vertical leg of length $b$.

Turn the whole triangle a quarter turn counterclockwise. The horizontal leg turns to point straight up, so $Q$ lands on $R(0, a)$. The vertical leg turns to point left, so $P$ lands $b$ units left of $R$, at $(-b, a)$. Drag the sliders to see the two triangles in every quadrant. The proof below makes this exact.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-5, 5, -5, 5],
          params: [
            { name: "a", tex: "a", min: -4, max: 4, step: 0.5, value: 4 },
            { name: "b", tex: "b", min: -4, max: 4, step: 0.5, value: 2 },
          ],
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "P", x: "a", y: "b", label: "P({a}, {b})", dir: "ne" },
            { name: "Q", x: "a", y: 0, dir: "s" },
            { name: "R", x: 0, y: "a", dir: "e" },
            { name: "P'", x: "-b", y: "a", label: "P'({=-b}, {a})", dir: "nw" },
          ],
          arcs: [{ center: "O", from: "P", to: "P'", dashed: true, color: 3 }],
          polygons: [
            { points: ["O", "Q", "P"], fill: 1 },
            { points: ["O", "R", "P'"], fill: 2 },
          ],
          segments: [
            { from: "O", to: "Q", ticks: 1 },
            { from: "O", to: "R", ticks: 1 },
            { from: "Q", to: "P", ticks: 2 },
            { from: "R", to: "P'", ticks: 2 },
          ],
          angles: [
            { at: "Q", from: "O", to: "P", right: true },
            { at: "R", from: "O", to: "P'", right: true },
            { at: "O", from: "Q", to: "P", color: 1 },
            { at: "O", from: "R", to: "P'", color: 1 },
          ],
          readouts: [
            { label: "OP", value: "sqrt(a^2 + b^2)" },
            { label: "OP'", value: "sqrt(b^2 + a^2)" },
          ],
          caption: md`$\triangle OQP$ and $\triangle ORP'$ have the same legs, $a$ and $b$, so they are congruent. The image of $P(a, b)$ is $P'(-b, a)$, at the same distance from $O$.`,
        },
        {
          kind: "proof",
          title: "The 90° rotation rule",
          given: md`$P = (a, b)$ with $a > 0$ and $b > 0$. $Q = (a, 0)$, $R = (0, a)$ and $P' = (-b, a)$. $O$ is the origin.`,
          prove: md`$OP' = OP$ and $\angle POP' = 90^\circ$, so $P'$ is the image of $P$ under a $90^\circ$ rotation about $O$.`,
          steps: [
            { statement: md`$OQ = a$ and $OR = a$, so $\overline{OQ} \cong \overline{OR}$.`, reason: "Ruler Postulate: distances along the axes" },
            { statement: md`$QP = b$ and $RP' = b$, so $\overline{QP} \cong \overline{RP'}$.`, reason: md`$\overline{QP}$ is vertical and $\overline{RP'}$ is horizontal; each has length $b$` },
            { statement: md`$\angle OQP = 90^\circ$ and $\angle ORP' = 90^\circ$.`, reason: "A vertical segment meets the x-axis, and a horizontal one meets the y-axis, at right angles" },
            { statement: md`$\triangle OQP \cong \triangle ORP'$`, reason: "SAS (steps 1 to 3)" },
            { statement: md`$OP = OP'$`, reason: "CPCTC" },
            { statement: md`$\angle QOP = \angle ROP'$`, reason: "CPCTC" },
            { statement: md`$\angle QOP + \angle POR = \angle QOR = 90^\circ$`, reason: md`Angle Addition Postulate ($P$ is inside $\angle QOR$); the axes are perpendicular` },
            { statement: md`$\angle POP' = \angle POR + \angle ROP'$`, reason: md`Angle Addition Postulate ($R$ is inside $\angle POP'$)` },
            { statement: md`$\angle POP' = \angle POR + \angle QOP = 90^\circ$`, reason: "Substitution (step 6), then step 7" },
          ],
        },
        {
          kind: "why",
          title: "Half turns and three-quarter turns",
          body: md`The proof used a point in the first quadrant. For any $P(a, b)$ other than $O$, check the definition directly. Distance: $OP' = \sqrt{(-b)^2 + a^2} = \sqrt{a^2 + b^2} = OP$. Angle: when $a$ and $b$ are both nonzero, $\overleftrightarrow{OP}$ has slope $\frac{b}{a}$ and $\overleftrightarrow{OP'}$ has slope $\frac{a}{-b}$. Since $\frac{b}{a} \cdot \frac{a}{-b} = -1$, they are perpendicular (Algebra 1, Unit 4), so $\angle POP' = 90^\circ$. When $a$ or $b$ is 0, $P$ and $P'$ lie on the two axes, which are perpendicular. The sliders show $P'$ is on the counterclockwise side in every quadrant.

A $180^\circ$ rotation is two $90^\circ$ rotations, so apply the rule twice:

$$(x, y) \to (-y, x) \to (-x, -y).$$

A $270^\circ$ rotation is one more quarter turn: $(-x, -y) \to (y, -x)$. Turning $270^\circ$ counterclockwise ends in the same place as turning $90^\circ$ clockwise.`,
        },
        {
          kind: "key",
          title: "Rotations about the origin",
          body: md`- $90^\circ$: $(x, y) \to (-y, x)$
- $180^\circ$: $(x, y) \to (-x, -y)$
- $270^\circ$, the same as $90^\circ$ clockwise: $(x, y) \to (y, -x)$`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-6, 6, -4, 6],
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 2, y: 1, dir: "s" },
            { name: "B", x: 5, y: 1, dir: "se" },
            { name: "C", x: 2, y: 3, dir: "ne" },
            { name: "A'", x: -1, y: 2, dir: "e" },
            { name: "B'", x: -1, y: 5, dir: "ne" },
            { name: "C'", x: -3, y: 2, dir: "nw" },
            { name: "A''", x: -2, y: -1, dir: "n" },
            { name: "B''", x: -5, y: -1, dir: "nw" },
            { name: "C''", x: -2, y: -3, dir: "sw" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["A'", "B'", "C'"], fill: 2 },
            { points: ["A''", "B''", "C''"], fill: 3 },
          ],
          segments: [
            { from: "O", to: "A", dashed: true, ticks: 1 },
            { from: "O", to: "A'", dashed: true, ticks: 1 },
          ],
          arcs: [{ center: "O", from: "B", to: "B'", dashed: true, color: 2 }],
          angles: [{ at: "O", from: "A", to: "A'", right: true }],
          caption: md`$\triangle ABC$ (blue), its $90^\circ$ image $\triangle A'B'C'$ (orange), and its $180^\circ$ image $\triangle A''B''C''$ (green). For example $A(2, 1) \to A'(-1, 2) \to A''(-2, -1)$.`,
        },
        {
          kind: "check",
          prompt: md`Rotate $(3, -5)$ by $90^\circ$ counterclockwise about the origin. Give the point as (x, y).`,
          answer: "(5, 3)",
          form: "tuple",
          explain: md`$(x, y) \to (-y, x)$ gives $(-(-5), 3) = (5, 3)$. A point in the fourth quadrant turns into the first.`,
        },
        {
          kind: "example",
          title: "Doing one move after another",
          problem: md`Reflect $P(2, 5)$ across the $x$-axis, then reflect the image across the $y$-axis. What single move does the same thing?`,
          steps: [
            { math: md`P' = (2, -5)`, note: md`Across the $x$-axis: $(x, y) \to (x, -y)$.` },
            { math: md`P'' = (-2, -5)`, note: md`Across the $y$-axis: $(x, y) \to (-x, y)$, applied to $P'$.` },
            { math: md`(x, y) \to (x, -y) \to (-x, -y)`, note: md`With letters, the two steps together are the $180^\circ$ rotation rule.` },
          ],
        },
        {
          kind: "text",
          body: md`Doing one transformation after another is a **composition**. Order can matter. Start at $(1, 2)$. Translating 4 right and then reflecting across the $y$-axis gives $(5, 2) \to (-5, 2)$. Reflecting first and then translating gives $(-1, 2) \to (3, 2)$. Different answers, so always apply the moves in the order given.`,
        },
        {
          kind: "key",
          title: "Rigid motions and congruence",
          body: md`A **rigid motion** is a transformation that preserves distance: $A'B' = AB$ for every pair of points. Translations, reflections and rotations are rigid motions, and so is any composition of them.

Rigid motions also preserve angle measure. Two figures are **congruent** exactly when a sequence of rigid motions maps one onto the other.`,
        },
        {
          kind: "proof",
          title: "A 90° rotation preserves distance",
          given: md`$A = (x_1, y_1)$ and $B = (x_2, y_2)$, with images $A' = (-y_1, x_1)$ and $B' = (-y_2, x_2)$.`,
          prove: md`$A'B' = AB$`,
          steps: [
            { statement: md`$A'B' = \sqrt{(-y_2 - (-y_1))^2 + (x_2 - x_1)^2}$`, reason: "Distance Formula" },
            { statement: md`$A'B' = \sqrt{(y_1 - y_2)^2 + (x_2 - x_1)^2}$`, reason: md`Simplify: $-y_2 + y_1 = y_1 - y_2$` },
            { statement: md`$(y_1 - y_2)^2 = (y_2 - y_1)^2$`, reason: "A number and its opposite have the same square" },
            { statement: md`$A'B' = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$`, reason: "Substitution and the commutative property" },
            { statement: md`$A'B' = AB$`, reason: "Distance Formula" },
          ],
        },
        {
          kind: "why",
          title: "Why reflections and the other rotations keep lengths",
          body: md`Across the $x$-axis, the differences of the coordinates become $x_2 - x_1$ and $-(y_2 - y_1)$. A number and its opposite have the same square, so the Distance Formula gives the same length. Across the $y$-axis the same thing happens with $x$. Across $y = x$ the two differences trade places, and $(y_2 - y_1)^2 + (x_2 - x_1)^2$ is the same sum. A $180^\circ$ or $270^\circ$ rotation is two or three $90^\circ$ rotations, and each of those keeps every length. Reflections across other lines and rotations about other points keep lengths too, but the coordinate cases are the ones you'll use here.`,
        },
        {
          kind: "why",
          title: "Why angles survive, and why this is congruence",
          body: md`Take any angle $\angle ABC$. A rigid motion keeps all three lengths $AB$, $BC$ and $AC$, so $\triangle A'B'C' \cong \triangle ABC$ by SSS, and $\angle A'B'C' = \angle ABC$ by CPCTC.

The other direction: suppose $\triangle ABC \cong \triangle DEF$. Translate so $A$ lands on $D$. Rotate about $D$ until the image of $\overrightarrow{AB}$ lies along $\overrightarrow{DE}$. Since $AB = DE$, $B$ lands on $E$. The image of $C$ is at distance $AC = DF$ from $D$, on a ray making an angle equal to $\angle A$ with $\overrightarrow{DE}$. Since $\angle A = \angle D$ (CPCTC), that ray is $\overrightarrow{DF}$ or its mirror image across $\overleftrightarrow{DE}$. So $C$ lands on $F$ or on the mirror image of $F$. In the second case, reflect across $\overleftrightarrow{DE}$. So "congruent" and "one moves exactly onto the other" mean the same thing.`,
        },
        {
          kind: "check",
          prompt: md`A rigid motion maps $\triangle ABC$ onto $\triangle A'B'C'$. In $\triangle ABC$, $AB = 6$, $BC = 9$ and $\angle B = 48^\circ$. Find $\angle B'$. Give the angle in degrees.`,
          answer: "48",
          explain: md`Rigid motions preserve angle measure, so $\angle B' = \angle B = 48^\circ$. The lengths carry over too: $A'B' = 6$ and $B'C' = 9$. The two triangles are congruent.`,
        },
      ],
      practice: [translations, reflectAndRotate, compositionsAndRigidity],
    },
    {
      id: "dilations",
      title: "Dilations",
      summary: "Scaling from a center: the coordinate rule, why lengths scale and angles don't, and similarity as a dilation plus a rigid motion.",
      blocks: [
        {
          kind: "text",
          body: md`Rigid motions keep size and shape. A **dilation** keeps shape but changes size, like zooming a photo. Every point moves along a ray from one fixed point, and every distance from that point gets multiplied by the same number.`,
        },
        {
          kind: "key",
          title: "Dilation",
          body: md`A **dilation** with **center** $C$ and **scale factor** $k > 0$ leaves $C$ where it is and sends every other point $P$ to the point $P'$ on $\overrightarrow{CP}$ with

$$CP' = k \cdot CP.$$

- $k > 1$ is an **enlargement**: $P'$ is beyond $P$.
- $0 < k < 1$ is a **reduction**: $P'$ is between $C$ and $P$.
- $k = 1$ moves nothing.

(Some books also allow a negative $k$. That is a dilation by $|k|$ followed by a $180^\circ$ rotation about the center.)`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-1, 10, -1, 7],
          params: [{ name: "k", tex: "k", min: 0.5, max: 3, step: 0.25, value: 2 }],
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 1, y: 1, dir: "s" },
            { name: "B", x: 3, y: 1, dir: "se" },
            { name: "C", x: 1, y: 2, dir: "w" },
            { name: "A'", x: "k", y: "k", dir: "se" },
            { name: "B'", x: "3k", y: "k", dir: "se" },
            { name: "C'", x: "k", y: "2k", dir: "nw" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["A'", "B'", "C'"], fill: 2 },
          ],
          segments: [
            { from: "O", to: "A", kind: "ray", dashed: true, color: 3 },
            { from: "O", to: "B", kind: "ray", dashed: true, color: 3 },
            { from: "O", to: "C", kind: "ray", dashed: true, color: 3 },
            { from: "A", to: "B", parallel: 1 },
            { from: "A'", to: "B'", parallel: 1, label: "{=2k}" },
            { from: "B", to: "C", parallel: 2 },
            { from: "B'", to: "C'", parallel: 2 },
          ],
          // Between the ray through B and segment AB, clear of both.
          labels: [{ x: 1.65, y: 0.79, text: "2" }],
          caption: md`A dilation centered at the origin. Each image vertex stays on its ray from $O$. Move $k$ below 1 to shrink the triangle. Each image side is parallel to its original and $k$ times as long.`,
        },
        {
          kind: "key",
          title: "Dilation centered at the origin",
          body: md`$$(x, y) \to (kx, ky)$$

Multiply both coordinates by the scale factor.`,
        },
        {
          kind: "proof",
          title: "The dilation rule",
          given: md`$P = (a, b)$, not the origin $O$. A scale factor $k > 0$. $P' = (ka, kb)$.`,
          prove: md`$P'$ is on $\overrightarrow{OP}$ and $OP' = k \cdot OP$.`,
          steps: [
            { statement: md`$OP = \sqrt{a^2 + b^2}$`, reason: "Distance Formula" },
            { statement: md`$OP' = \sqrt{(ka)^2 + (kb)^2} = \sqrt{k^2(a^2 + b^2)}$`, reason: "Distance Formula; factor out k squared (Distributive Property)" },
            { statement: md`$OP' = k\sqrt{a^2 + b^2}$`, reason: md`Product rule for radicals, and $\sqrt{k^2} = k$ because $k > 0$` },
            { statement: md`$OP' = k \cdot OP$`, reason: "Substitution (step 1)" },
            { statement: md`$O$, $P$ and $P'$ all satisfy $bx - ay = 0$.`, reason: md`$b \cdot 0 - a \cdot 0 = 0$, $\; ba - ab = 0$, $\; b(ka) - a(kb) = 0$` },
            { statement: md`$P'$ is on $\overleftrightarrow{OP}$.`, reason: md`$bx - ay = 0$ is a line through $O$ and $P$, and two points determine one line` },
            { statement: md`$P'$ is on the same side of $O$ as $P$.`, reason: md`$k > 0$, so $ka$ has the sign of $a$ and $kb$ has the sign of $b$` },
            { statement: md`$P'$ is on $\overrightarrow{OP}$ with $OP' = k \cdot OP$.`, reason: "Steps 4, 6 and 7" },
          ],
        },
        {
          kind: "example",
          title: "A reduction",
          problem: md`Dilate $\triangle ABC$ with $A(4, 6)$, $B(-2, 8)$, $C(0, -4)$ by a scale factor of $\frac{1}{2}$, centered at the origin.`,
          steps: [
            { math: md`(x, y) \to \left(\tfrac{1}{2}x, \tfrac{1}{2}y\right)`, note: "Halve both coordinates." },
            { math: md`A'(2, 3), \quad B'(-1, 4), \quad C'(0, -2)`, note: "Each image point is halfway from the origin to its original." },
          ],
        },
        {
          kind: "text",
          body: md`**A center that isn't the origin.** Find the trip from the center to the point, scale that trip by $k$, and make the scaled trip from the center. With center $C(h, j)$:

$$(x, y) \to \big(h + k(x - h),\; j + k(y - j)\big).$$

This is the origin rule with a translation before and after: slide $C$ to the origin, dilate, then slide back.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-1, 8, -1, 6],
          points: [
            { name: "C", x: 1, y: 1, dir: "sw" },
            { name: "D", x: 2, y: 2, dir: "nw" },
            { name: "E", x: 4, y: 2, dir: "s" },
            { name: "F", x: 2, y: 3, dir: "w" },
            { name: "D'", x: 3, y: 3, dir: "se" },
            { name: "E'", x: 7, y: 3, dir: "se" },
            { name: "F'", x: 3, y: 5, dir: "n" },
          ],
          polygons: [
            { points: ["D", "E", "F"], fill: 1 },
            { points: ["D'", "E'", "F'"], fill: 2 },
          ],
          segments: [
            { from: "C", to: "D'", dashed: true, color: 3 },
            { from: "C", to: "E'", dashed: true, color: 3 },
            { from: "C", to: "F'", dashed: true, color: 3 },
          ],
          caption: md`A dilation with center $C(1, 1)$ and scale factor 2. The trip from $C$ to $E(4, 2)$ is $\langle 3, 1 \rangle$. Doubled it is $\langle 6, 2 \rangle$, so $E' = (7, 3)$.`,
        },
        {
          kind: "proof",
          title: "A dilation multiplies lengths by k and keeps directions",
          given: md`A dilation with center $O$ and scale factor $k > 0$. $A = (x_1, y_1)$ and $B = (x_2, y_2)$, so $A' = (kx_1, ky_1)$ and $B' = (kx_2, ky_2)$.`,
          prove: md`$A'B' = k \cdot AB$, and $\overline{A'B'}$ is parallel to $\overline{AB}$ (or on the same line).`,
          steps: [
            { statement: md`$A'B' = \sqrt{(kx_2 - kx_1)^2 + (ky_2 - ky_1)^2}$`, reason: "Distance Formula" },
            { statement: md`$A'B' = \sqrt{k^2\left[(x_2 - x_1)^2 + (y_2 - y_1)^2\right]}$`, reason: "Distributive Property: factor out k, then square" },
            { statement: md`$A'B' = k \cdot AB$`, reason: md`$\sqrt{k^2} = k$ for $k > 0$, and the Distance Formula for $AB$` },
            { statement: md`$\text{slope of } \overline{A'B'} = \frac{k(y_2 - y_1)}{k(x_2 - x_1)} = \frac{y_2 - y_1}{x_2 - x_1}$`, reason: md`Slope formula; divide top and bottom by $k$ (when $x_1 \ne x_2$; a vertical segment stays vertical)` },
            { statement: md`$\overline{A'B'} \parallel \overline{AB}$, or both lie on one line`, reason: "Equal slopes (Algebra 1, Unit 4)" },
          ],
        },
        {
          kind: "why",
          title: "Why angles don't change",
          body: md`Take any angle $\angle ABC$ and dilate it by $k$ with center at its own vertex $B$. Then $B$ stays put, $A'$ is on $\overrightarrow{BA}$ and $C'$ is on $\overrightarrow{BC}$, so $\angle A'BC'$ is the same angle as $\angle ABC$.

Now use the same $k$ with a different center $Q(h, j)$, and let $B = (p, q)$. With center $B$ a point goes to $\big(p + k(x - p),\; q + k(y - q)\big)$. With center $Q$ it goes to $\big(h + k(x - h),\; j + k(y - j)\big)$. Subtract: the coordinates differ by $(1 - k)(h - p)$ and $(1 - k)(j - q)$, the same amounts for every point. So the dilation about $Q$ is the dilation about $B$ followed by a translation, and translations preserve angle measure (Lesson 1). Either way the angle keeps its measure. This uses no similarity, so the AA argument below doesn't assume what it proves. It also shows that a dilated triangle is similar to the original in the Unit 4 sense: its angles match, and by the proof above its sides are all $k$ times as long.

This is also the Triangle Proportionality Theorem in action. In the slider picture, $\overline{A'B'} \parallel \overline{AB}$ cuts the sides of $\triangle OA'B'$ in proportion: $\frac{OA}{OA'} = \frac{OB}{OB'} = \frac{1}{k}$.`,
        },
        {
          kind: "why",
          title: "Why area scales by k squared",
          body: md`A rectangle $l$ by $w$ becomes a rectangle $kl$ by $kw$. Its area goes from $lw$ to

$$(kl)(kw) = k^2 lw.$$

A triangle's base and height are both lengths, so they both scale by $k$, and $\frac{1}{2}(kb)(kh) = k^2 \cdot \frac{1}{2}bh$. Any polygon splits into triangles, and by the Area Addition Postulate (Unit 8) its area scales by $k^2$ too. Perimeter is a sum of lengths, so it just scales by $k$.`,
        },
        {
          kind: "check",
          prompt: md`Dilate $(6, -4)$ by a scale factor of $\frac{1}{2}$, centered at the origin. Give the point as (x, y).`,
          answer: "(3, -2)",
          form: "tuple",
          explain: md`Multiply both coordinates by $\frac{1}{2}$: $(3, -2)$.`,
        },
        {
          kind: "key",
          title: "Similarity through transformations",
          body: md`Two figures are **similar** when a dilation followed by a sequence of rigid motions maps one onto the other.

The dilation fixes the size. The rigid motions fix the position. This matches Unit 4: the dilation makes all sides proportional and keeps the angles, and the rigid motions keep both.

Unit 4 took AA as a postulate because its proof needs dilations. Now that we have them, the proof below shows that AA really follows.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-5, 7, -1, 7],
          points: [
            { name: "A", x: 1, y: 1, dir: "sw" },
            { name: "B", x: 3, y: 1, dir: "se" },
            { name: "C", x: 1, y: 2, dir: "nw" },
            { name: "A'", x: 2, y: 2, dir: "se" },
            { name: "B'", x: 6, y: 2, dir: "se" },
            { name: "C'", x: 2, y: 4, dir: "n" },
            { name: "D", x: -2, y: 2, dir: "se" },
            { name: "E", x: -2, y: 6, dir: "ne" },
            { name: "F", x: -4, y: 2, dir: "sw" },
            { name: "O", x: 0, y: 0, dir: "sw" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["A'", "B'", "C'"], fill: 2 },
            { points: ["D", "E", "F"], fill: 3 },
          ],
          arcs: [{ center: "O", from: "A'", to: "D", dashed: true, color: 3 }],
          caption: md`$\triangle ABC$ is dilated by 2 from the origin to $\triangle A'B'C'$, which is then rotated $90^\circ$ counterclockwise about the origin to $\triangle DEF$. So $\triangle ABC \sim \triangle DEF$ with scale factor 2.`,
        },
        {
          kind: "proof",
          title: "Two pairs of equal angles are enough (AA, through transformations)",
          given: md`$\triangle ABC$ and $\triangle DEF$ with $\angle A = \angle D$ and $\angle B = \angle E$.`,
          prove: md`A dilation followed by a rigid motion maps $\triangle ABC$ onto $\triangle DEF$.`,
          steps: [
            { statement: md`Let $k = \frac{DE}{AB}$, and dilate $\triangle ABC$ by $k$ to get $\triangle A'B'C'$.`, reason: "A dilation can use any center and any positive scale factor" },
            { statement: md`$A'B' = k \cdot AB = DE$`, reason: "Dilations multiply lengths by k; definition of k" },
            { statement: md`$\angle A' = \angle A$ and $\angle B' = \angle B$`, reason: "Dilations preserve angle measure" },
            { statement: md`$\angle A' = \angle D$ and $\angle B' = \angle E$`, reason: "Transitive Property of Equality (with the given)" },
            { statement: md`$\triangle A'B'C' \cong \triangle DEF$`, reason: "ASA (steps 2 and 4)" },
            { statement: md`A rigid motion maps $\triangle A'B'C'$ onto $\triangle DEF$.`, reason: "Congruent figures are related by rigid motions (Lesson 1)" },
            { statement: md`The dilation, then that rigid motion, maps $\triangle ABC$ onto $\triangle DEF$.`, reason: "Composition of steps 1 and 6" },
          ],
        },
        {
          kind: "check",
          prompt: md`A dilation maps a segment of length 4 to a segment of length 10. What is the scale factor? Give an exact answer.`,
          answer: "5/2",
          simplified: true,
          explain: md`$4k = 10$, so $k = \frac{10}{4} = \frac{5}{2}$. It is more than 1, so this is an enlargement.`,
        },
      ],
      practice: [dilatePoints, dilationLengths, dilationEquations],
    },
    {
      id: "symmetry",
      title: "Symmetry",
      summary: "Transformations that map a figure onto itself: lines of symmetry, rotational symmetry, and why regular polygons have so much of both.",
      blocks: [
        {
          kind: "text",
          body: md`A **symmetry** of a figure is a rigid motion that maps the figure onto itself. Afterwards the figure looks exactly as before, even though its points have moved. Symmetry is a precise version of "this shape looks balanced".`,
        },
        {
          kind: "key",
          title: "Line and rotational symmetry",
          body: md`- A figure has **line symmetry** if a reflection across some line maps it onto itself. That line is a **line of symmetry**.
- A figure has **rotational symmetry** if a rotation about some point, by an angle between $0^\circ$ and $360^\circ$, maps it onto itself.
- The **order** of rotational symmetry is the number of angles from $1^\circ$ to $360^\circ$ that work. The full turn always works, so a figure with no rotational symmetry has order 1.
- **Point symmetry** is rotational symmetry by $180^\circ$.`,
        },
        {
          kind: "diagram",
          view: [-3.5, 3.5, -3.5, 3.5],
          points: [
            { name: "O", x: 0, y: 0, label: "", hidden: true },
            { name: "A", x: "3cos(90 pi/180)", y: "3sin(90 pi/180)", dir: "ne" },
            { name: "B", x: "3cos(162 pi/180)", y: "3sin(162 pi/180)", dir: "sw" },
            { name: "C", x: "3cos(234 pi/180)", y: "3sin(234 pi/180)", dir: "s" },
            { name: "D", x: "3cos(306 pi/180)", y: "3sin(306 pi/180)", dir: "s" },
            { name: "E", x: "3cos(18 pi/180)", y: "3sin(18 pi/180)", dir: "se" },
          ],
          polygons: [{ points: ["A", "B", "C", "D", "E"], fill: 1 }],
          segments: [
            { from: "O", to: "A", kind: "line", dashed: true, color: 2 },
            { from: "O", to: "B", kind: "line", dashed: true, color: 2 },
            { from: "O", to: "C", kind: "line", dashed: true, color: 2 },
            { from: "O", to: "D", kind: "line", dashed: true, color: 2 },
            { from: "O", to: "E", kind: "line", dashed: true, color: 2 },
          ],
          caption: md`A regular pentagon has 5 lines of symmetry. Five sides is odd, so each line runs from a vertex through the center to the midpoint of the opposite side.`,
        },
        {
          kind: "diagram",
          view: [-3, 3, -3, 3],
          points: [
            { name: "O", x: 0, y: 0, label: "", hidden: true },
            { name: "A", x: 2, y: 2, dir: "n" },
            { name: "B", x: -2, y: 2, dir: "n" },
            { name: "C", x: -2, y: -2, dir: "s" },
            { name: "D", x: 2, y: -2, dir: "s" },
            { name: "M", x: 2, y: 0, label: "", hidden: true },
            { name: "N", x: 0, y: 2, label: "", hidden: true },
          ],
          polygons: [{ points: ["A", "B", "C", "D"], fill: 1 }],
          segments: [
            { from: "O", to: "A", kind: "line", dashed: true, color: 2 },
            { from: "O", to: "B", kind: "line", dashed: true, color: 2 },
            { from: "O", to: "M", kind: "line", dashed: true, color: 3 },
            { from: "O", to: "N", kind: "line", dashed: true, color: 3 },
          ],
          caption: md`A square has 4 lines of symmetry. Four sides is even, so the lines pair up differently: 2 join opposite vertices (orange) and 2 join midpoints of opposite sides (green).`,
        },
        {
          kind: "text",
          body: md`Now turn instead of folding. Below, the orange triangle is a copy of the blue equilateral triangle, rotated about its center by the slider angle. Find the angles where the copy fits exactly over the original.`,
        },
        {
          kind: "diagram",
          view: [-3.6, 3.6, -3.6, 3.6],
          params: [{ name: "t", tex: "\\theta", min: 0, max: 360, step: 5, value: 40 }],
          points: [
            { name: "O", x: 0, y: 0, dir: "s" },
            { name: "A", x: 0, y: 3, dir: "n" },
            { name: "B", x: "3cos(210 pi/180)", y: "3sin(210 pi/180)", dir: "sw" },
            { name: "C", x: "3cos(330 pi/180)", y: "3sin(330 pi/180)", dir: "se" },
            { name: "A'", x: "3cos((90 + t) pi/180)", y: "3sin((90 + t) pi/180)", dir: "nw" },
            { name: "B'", x: "3cos((210 + t) pi/180)", y: "3sin((210 + t) pi/180)", dir: "w" },
            { name: "C'", x: "3cos((330 + t) pi/180)", y: "3sin((330 + t) pi/180)", dir: "e" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["A'", "B'", "C'"], fill: 2 },
          ],
          segments: [
            { from: "O", to: "A", dashed: true },
            { from: "O", to: "A'", dashed: true, color: 2 },
          ],
          readouts: [{ label: "\\theta", value: "t", unit: "^\\circ" }],
          caption: md`The copy lands exactly on the original at $120^\circ$, $240^\circ$ and $360^\circ$. Three angles work, so the order of rotational symmetry is 3. Each time, every vertex has moved to the next one.`,
        },
        {
          kind: "key",
          title: "Regular polygons",
          body: md`A regular polygon with $n$ sides has

- $n$ lines of symmetry,
- rotational symmetry of order $n$,
- smallest rotation angle $\frac{360^\circ}{n}$.

The smallest rotation angle equals the exterior angle of the polygon (Unit 6).`,
        },
        {
          kind: "proof",
          title: "A regular polygon turns onto itself by 360°/n",
          given: md`A regular polygon $V_1V_2 \ldots V_n$ with center $O$, so $OV_1 = OV_2 = \cdots = OV_n$.`,
          prove: md`The rotation about $O$ by $\frac{360^\circ}{n}$ maps the polygon onto itself.`,
          steps: [
            { statement: md`$V_1V_2 = V_2V_3 = \cdots = V_nV_1$`, reason: "Definition of regular polygon" },
            { statement: md`$OV_1 = OV_2 = \cdots = OV_n$`, reason: "Given: O is the center" },
            { statement: md`$\triangle OV_1V_2 \cong \triangle OV_2V_3 \cong \cdots \cong \triangle OV_nV_1$`, reason: "SSS" },
            { statement: md`$\angle V_1OV_2 = \angle V_2OV_3 = \cdots = \angle V_nOV_1$`, reason: "CPCTC" },
            { statement: md`These $n$ equal angles add up to $360^\circ$.`, reason: "Together they make one full turn about O (Angle Addition Postulate)" },
            { statement: md`Each one measures $\frac{360^\circ}{n}$.`, reason: "Division Property of Equality" },
            { statement: md`The rotation sends $V_1 \to V_2$, $V_2 \to V_3$, ..., $V_n \to V_1$.`, reason: md`Each next vertex is the same distance from $O$ and $\frac{360^\circ}{n}$ further around (definition of rotation)` },
            { statement: md`It sends each side onto the next side, so the polygon onto itself.`, reason: "A rigid motion maps a segment to the segment between the images of its endpoints" },
          ],
        },
        {
          kind: "why",
          title: "Why there are exactly n lines",
          body: md`Every line of symmetry passes through the center: a reflection preserves distance, so it must send the one point equally far from all the vertices to itself. It also crosses the outline at points the reflection leaves fixed, and those can only be vertices or midpoints of sides. So the candidates are the lines from the center through a vertex or through the midpoint of a side.

Each candidate works. In the proof above, the triangles $\triangle OV_1V_2, \triangle OV_2V_3, \ldots$ are congruent and isosceles, so the line from $O$ through a vertex bisects the angle there and folds one neighboring side onto the other. The line from $O$ through a midpoint is the perpendicular bisector of that side, and it folds the polygon the same way.

When $n$ is odd, each vertex sits opposite the midpoint of a side, so each candidate line contains one vertex and one midpoint: $n$ lines, one per vertex. When $n$ is even, vertices sit opposite vertices and midpoints opposite midpoints. That gives $\frac{n}{2}$ lines of each kind, $n$ in total. The pentagon and square pictures show both cases.`,
        },
        {
          kind: "example",
          title: "All the rotations of a regular octagon",
          problem: md`List every angle from $1^\circ$ to $360^\circ$ that maps a regular octagon onto itself.`,
          steps: [
            { math: md`\frac{360^\circ}{8} = 45^\circ`, note: "The smallest turn moves each vertex to the next one." },
            { math: md`45^\circ, 90^\circ, 135^\circ, 180^\circ, 225^\circ, 270^\circ, 315^\circ, 360^\circ`, note: "Repeating a symmetry gives another symmetry, so every multiple works." },
            { math: md`\text{order } 8`, note: md`Eight angles. Since $180^\circ$ is on the list, the octagon has point symmetry too.` },
          ],
        },
        {
          kind: "check",
          prompt: md`What is the smallest positive angle of rotation that maps a regular hexagon onto itself? Give the angle in degrees.`,
          answer: "60",
          explain: md`$\frac{360^\circ}{6} = 60^\circ$. Each vertex moves to the next one.`,
        },
        {
          kind: "text",
          body: md`**Quadrilaterals and triangles.** The special shapes from Units 3 and 6 each have their own symmetry:

- square: 4 lines, order 4
- rectangle that is not a square: 2 lines (through midpoints of opposite sides), order 2
- rhombus that is not a square: 2 lines (the diagonals), order 2
- parallelogram that is not a rectangle or rhombus: no lines, order 2
- isosceles trapezoid: 1 line, order 1
- kite that is not a rhombus: 1 line (a diagonal), order 1
- equilateral triangle: 3 lines, order 3; other isosceles triangles: 1 line; scalene: none`,
        },
        {
          kind: "diagram",
          view: [-1, 6, -1, 3],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 4, y: 0, dir: "se" },
            { name: "C", x: 5, y: 2, dir: "ne" },
            { name: "D", x: 1, y: 2, dir: "nw" },
            { name: "M", x: 2.5, y: 1, dir: "s" },
          ],
          polygons: [{ points: ["A", "B", "C", "D"], fill: 1 }],
          segments: [
            { from: "A", to: "M", dashed: true, ticks: 1 },
            { from: "M", to: "C", dashed: true, ticks: 1 },
            { from: "B", to: "M", dashed: true, ticks: 2 },
            { from: "M", to: "D", dashed: true, ticks: 2 },
          ],
          caption: md`The diagonals of parallelogram $ABCD$ bisect each other at $M$. A half turn about $M$ swaps $A$ with $C$ and $B$ with $D$.`,
        },
        {
          kind: "proof",
          title: "Every parallelogram has point symmetry",
          given: md`Parallelogram $ABCD$ whose diagonals meet at $M$.`,
          prove: md`The $180^\circ$ rotation about $M$ maps $ABCD$ onto itself.`,
          steps: [
            { statement: md`$AM = MC$ and $BM = MD$`, reason: "The diagonals of a parallelogram bisect each other (Unit 6)" },
            { statement: md`$\angle AMC = 180^\circ$`, reason: md`$M$ is between $A$ and $C$ on $\overline{AC}$, so $\overrightarrow{MA}$ and $\overrightarrow{MC}$ are opposite rays` },
            { statement: md`The rotation sends $A \to C$ and $C \to A$.`, reason: "Definition of rotation (steps 1 and 2)" },
            { statement: md`The rotation sends $B \to D$ and $D \to B$.`, reason: "Same reasoning on diagonal BD" },
            { statement: md`It sends $\overline{AB} \to \overline{CD}$, $\overline{BC} \to \overline{DA}$, $\overline{CD} \to \overline{AB}$, $\overline{DA} \to \overline{BC}$.`, reason: "A rigid motion maps a segment to the segment between the images of its endpoints" },
            { statement: md`It maps $ABCD$ onto itself.`, reason: "Every side lands on a side" },
          ],
        },
        {
          kind: "why",
          title: "Why a slanted parallelogram has no line of symmetry",
          body: md`A reflection that maps the parallelogram onto itself sends vertices to vertices and sides to sides, so it sends each pair of opposite vertices to a pair of opposite vertices. That sends each diagonal onto a diagonal, and their crossing point $M$ to itself. A reflection only leaves points on its line in place, so the line of symmetry passes through $M$. Where it crosses the outline the points stay fixed, and as with regular polygons those can only be vertices or midpoints of sides. A line through $M$ and a vertex is a diagonal, and a line through $M$ and the midpoint of a side also passes through the midpoint of the opposite side, since the half turn about $M$ swaps those two midpoints. So the only candidates are the two diagonals and the two lines joining midpoints of opposite sides. Folding along a diagonal would swap two adjacent sides, so they would have to be equal: a rhombus. Folding along the line through the midpoints of two opposite sides would swap the two angles at each end of a side, and a pair of same-side interior angles that are equal and add to $180^\circ$ are both $90^\circ$: a rectangle. A parallelogram that is neither has no fold that works, only the half turn.`,
        },
        {
          kind: "text",
          body: md`**Symmetry with coordinates.** Each symmetry is a rule, so it tells you new points of the figure. If a figure is symmetric across the $y$-axis and contains $(x, y)$, it also contains $(-x, y)$. If it has point symmetry about the origin, it also contains $(-x, -y)$. The parabolas of Algebra 1 are an example: $y = x^2$ is symmetric across the $y$-axis because $(-x)^2 = x^2$.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-4, 4, -1, 5],
          points: [
            { name: "A", x: -2, y: 0, dir: "sw" },
            { name: "B", x: 2, y: 0, dir: "se" },
            { name: "P", x: 2, y: 2, label: "P(2, 2)", dir: "e" },
            { name: "D", x: 0, y: 4, dir: "ne" },
            { name: "P'", x: -2, y: 2, label: "P'(-2, 2)", dir: "w" },
            { name: "M", x: 0, y: 2, label: "", hidden: true },
          ],
          polygons: [{ points: ["A", "B", "P", "D", "P'"], fill: 1 }],
          segments: [
            { from: "P'", to: "M", dashed: true, color: 2, ticks: 1 },
            { from: "M", to: "P", dashed: true, color: 2, ticks: 1 },
          ],
          angles: [{ at: "M", from: "P", to: "D", right: true, color: 2 }],
          caption: md`This pentagon has the $y$-axis as a line of symmetry. The reflection $(x, y) \to (-x, y)$ sends $P(2, 2)$ to $P'(-2, 2)$, another vertex.`,
        },
        {
          kind: "check",
          prompt: md`A figure has point symmetry about the origin and contains $(3, -7)$. Which other point must it contain? Give the point as (x, y).`,
          answer: "(-3, 7)",
          form: "tuple",
          explain: md`Point symmetry is a $180^\circ$ rotation, $(x, y) \to (-x, -y)$, so $(3, -7) \to (-3, 7)$.`,
        },
      ],
      practice: [symmetryCounts, coordinateSymmetry, sidesFromAngles],
    },
  ],
};
