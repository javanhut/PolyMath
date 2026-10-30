import { fracTex, paren, poly, signed, type Rng } from "../../math/random";
import { md, type Block, type DiagramSpec, type Figure, type Generator, type SeriesColor, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** ax + b, written the way a person would. */
const lin = (a: number, b: number) => poly([[a, "x"], [b, ""]]);

/** ax + b as a term in a sum: in parentheses unless it is a single term. */
const term = (a: number, b: number) => (a === 0 || b === 0 ? lin(a, b) : `(${lin(a, b)})`);

/** The angle (ax + b) degrees, as LaTeX. */
const degX = (a: number, b: number) => (b === 0 ? md`${lin(a, 0)}^\circ` : md`(${lin(a, b)})^\circ`);

/** ax + b with x replaced by a number: "3(7) - 4". */
const subst = (a: number, b: number, x: number) => `${a === 1 ? x : `${a}(${x})`}${b === 0 ? "" : ` ${signed(b)}`}`;

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** "a, b and c" */
function listAnd(items: string[]): string {
  return items.length === 1 ? items[0]! : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Steps from aL x + bL = aR x + bR (aL ≠ aR) to x = value, keeping the x-coefficient positive. */
function linearSteps(aL: number, bL: number, aR: number, bR: number): Step[] {
  const steps: Step[] = [];
  const moveConst = (b: number) => md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} ${b > 0 ? "from" : "to"} both sides.`;
  if (aL > aR) {
    const a = aL - aR;
    if (aR !== 0) steps.push({ math: md`${lin(a, bL)} = ${bR}`, note: md`Subtract $${lin(aR, 0)}$ from both sides.` });
    if (bL !== 0) steps.push({ math: md`${lin(a, 0)} = ${bR - bL}`, note: moveConst(bL) });
    if (a !== 1 || steps.length === 0) steps.push({ math: md`x = ${(bR - bL) / a}`, note: a === 1 ? "" : md`Divide both sides by ${a}.` });
  } else {
    const a = aR - aL;
    if (aL !== 0) steps.push({ math: md`${bL} = ${lin(a, bR)}`, note: md`Subtract $${lin(aL, 0)}$ from both sides, so the $x$-terms are on the right.` });
    if (bR !== 0) steps.push({ math: md`${bL - bR} = ${lin(a, 0)}`, note: moveConst(bR) });
    if (a !== 1 || steps.length === 0) steps.push({ math: md`x = ${(bL - bR) / a}`, note: a === 1 ? "" : md`Divide both sides by ${a}.` });
  }
  return steps;
}

/** Two different coefficients in [lo, hi]. */
function twoCoefs(r: Rng, lo: number, hi: number): [number, number] {
  const a = r.int(lo, hi);
  let b = r.int(lo, hi);
  while (b === a) b = r.int(lo, hi);
  return [a, b];
}

const POLY_NAMES: Record<number, string> = {
  3: "triangle",
  4: "quadrilateral",
  5: "pentagon",
  6: "hexagon",
  7: "heptagon",
  8: "octagon",
  9: "nonagon",
  10: "decagon",
  12: "dodecagon",
};
const polyName = (n: number) => POLY_NAMES[n] ?? `${n}-gon`;
const COUNT_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];

/** Multiples of 5 from 40 to 140, without 90. */
const ANGLES = Array.from({ length: 21 }, (_, i) => 40 + 5 * i).filter((a) => a !== 90);

/** `count` multiples of 5 in [lo, hi] that add up to `total`. */
function anglesSumming(r: Rng, count: number, total: number, lo: number, hi: number): number[] {
  for (;;) {
    const out = Array.from({ length: count - 1 }, () => 5 * r.int(lo / 5, hi / 5));
    const last = total - out.reduce((s, v) => s + v, 0);
    if (last >= lo && last <= hi) return [...out, last];
  }
}

const V = ["A", "B", "C", "D"] as const;
const isOpposite = (i: number, j: number) => (i + 2) % 4 === j;

/** An equation in x with x rewritten in terms of the asked quantity, for verify equations. */
const via = (eq: string, x: string) => eq.replace(/x/g, `(${x})`);
/** x in terms of y, when y = ax + b. */
const xFrom = (a: number, b: number, y = "y") => `(${y} - (${b}))/${a}`;

// ── Practice figures ────────────────────────────────────────────────────────
// Built from each problem's own numbers, so the picture matches the problem.

type Pt = [number, number];
type FigPoint = NonNullable<DiagramSpec["points"]>[number];
type Dir = NonNullable<FigPoint["dir"]>;
type FigSeg = NonNullable<DiagramSpec["segments"]>[number];
type FigAngle = NonNullable<DiagramSpec["angles"]>[number];
type Quad = Record<"A" | "B" | "C" | "D", Pt>;

const rad = (d: number) => (d * Math.PI) / 180;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const midPt = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const dist = (p: Pt, q: Pt) => Math.hypot(q[0] - p[0], q[1] - p[1]);
/** The unknown is drawn in orange. */
const ASKED: SeriesColor = 2;

const DIRS8: Dir[] = ["e", "ne", "n", "nw", "w", "sw", "s", "se"];
const dirOf = (v: Pt): Dir => DIRS8[((Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 4)) % 8) + 8) % 8]!;

/** Label direction for a crossing point e: into the widest gap between the rays to `around` (counterclockwise), skipping gaps by index. */
function crossingDir(e: Pt, around: Pt[], skip: number[] = []): Dir {
  let best = -1;
  let dir: Dir = "s";
  around.forEach((p, i) => {
    if (skip.includes(i)) return;
    const q = around[(i + 1) % around.length]!;
    const a = Math.atan2(p[1] - e[1], p[0] - e[0]);
    let d = Math.atan2(q[1] - e[1], q[0] - e[0]) - a;
    while (d <= 0) d += 2 * Math.PI;
    if (d > best) {
      best = d;
      dir = dirOf([Math.cos(a + d / 2), Math.sin(a + d / 2)]);
    }
  });
  return dir;
}

function scalePts<T extends Record<string, Pt>>(pts: T, k: number): T {
  return Object.fromEntries(Object.entries(pts).map(([n, p]) => [n, [p[0] * k, p[1] * k]])) as T;
}

interface FigSpec {
  /** Vertices of the shape, drawn as a polygon; labels point away from its centre. */
  outline?: string[];
  segments?: FigSeg[];
  angles?: FigAngle[];
  dirs?: Partial<Record<string, Dir>>;
  /** Point labels other than the name ("" for none). */
  names?: Partial<Record<string, string>>;
  hidden?: string[];
  grid?: boolean;
  view?: [number, number, number, number];
}

type DiagramFig = Extract<Figure, { kind: "diagram" }>;

/** Screen pixels per unit in a figure with this view (the renderer's own scale). */
const pxPerUnit = (view: DiagramSpec["view"]) => Math.min(516 / (view[1] - view[0]), 556 / (view[3] - view[2]));

/** Number of characters a LaTeX label shows, roughly. */
const texLength = (tex: string) => tex.replace(/\\circ/g, "o").replace(/\\[a-zA-Z]+/g, "").replace(/[{}^]/g, "").length;

/** Rough size in pixels of a rendered LaTeX label, with some room to spare. */
function labelBox(tex: string): [number, number] {
  return [8 * texLength(tex) + 4, 20];
}

const SCREEN_DIRS: Record<Dir, Pt> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [0.75, -0.75], nw: [-0.75, -0.75], se: [0.75, 0.75], sw: [-0.75, 0.75] };

/** Does the segment pq (screen pixels) pass through the box [x0, x1, y0, y1]? */
function crossesBox(p: Pt, q: Pt, [x0, x1, y0, y1]: number[]): boolean {
  let [lo, hi] = [0, 1];
  const d: Pt = [q[0] - p[0], q[1] - p[1]];
  for (const [k, min, max] of [[0, x0!, x1!], [1, y0!, y1!]] as const) {
    if (Math.abs(d[k]) < 1e-9) {
      if (p[k] < min || p[k] > max) return false;
      continue;
    }
    let [a, b] = [(min - p[k]) / d[k], (max - p[k]) / d[k]];
    if (a > b) [a, b] = [b, a];
    [lo, hi] = [Math.max(lo, a), Math.min(hi, b)];
    if (lo > hi) return false;
  }
  return true;
}

/**
 * How many clashes a figure's labels have, as the renderer would place them: labels on top of each other, or
 * on a line. Used to choose the clearest of several true-to-scale shapes.
 */
function crowding(f: DiagramFig): number {
  const unit = pxPerUnit(f.view);
  const scr = (x: number, y: number): Pt => [(x - f.view[0]) * unit, (f.view[3] - y) * unit];
  const at = new Map(f.points!.map((p) => [p.name, scr(p.x as number, p.y as number)]));
  const all = [...at.values()];
  const c: Pt = [all.reduce((t, p) => t + p[0], 0) / all.length, all.reduce((t, p) => t + p[1], 0) / all.length];
  const boxes: number[][] = [];
  const centred = ([x, y]: Pt, tex: string) => {
    const [w, h] = labelBox(tex);
    boxes.push([x - w / 2, x + w / 2, y - h / 2, y + h / 2]);
  };
  for (const p of f.points!) {
    if (p.label === "") continue;
    const s = at.get(p.name)!;
    const [dx, dy] = SCREEN_DIRS[p.dir ?? "ne"];
    const [w, h] = labelBox(p.label ?? p.name);
    const x = s[0] + dx * (dx ? 8 : 14);
    const left = dx > 0 ? x : dx < 0 ? x - w : x - w / 2;
    boxes.push([left, left + w, s[1] + dy * 14 - h / 2, s[1] + dy * 14 + h / 2]);
  }
  for (const sg of f.segments ?? []) {
    if (!sg.label) continue;
    const [p, q] = [at.get(sg.from)!, at.get(sg.to)!];
    const len = dist(p, q);
    const n: Pt = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len];
    const m = midPt(p, q);
    const side = (c[0] - m[0]) * n[0] + (c[1] - m[1]) * n[1] > 0 ? -1 : 1;
    centred([m[0] + n[0] * 14 * side, m[1] + n[1] * 14 * side], sg.label);
  }
  for (const a of f.angles ?? []) {
    if (!a.label) continue;
    const [v, p, q] = [at.get(a.at)!, at.get(a.from)!, at.get(a.to)!];
    const t1 = Math.atan2(p[1] - v[1], p[0] - v[0]);
    let d = Math.atan2(q[1] - v[1], q[0] - v[0]) - t1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d <= -Math.PI) d += 2 * Math.PI;
    if (a.reflex) d += d > 0 ? -2 * Math.PI : 2 * Math.PI;
    const r = 36 + ((a.arcs ?? 1) - 1) * 4;
    centred([v[0] + r * Math.cos(t1 + d / 2), v[1] + r * Math.sin(t1 + d / 2)], a.label);
  }
  for (const l of f.labels ?? []) centred(scr(l.x as number, l.y as number), l.text);
  const lines: [Pt, Pt][] = [];
  for (const pg of f.polygons ?? []) pg.points.forEach((n, i) => lines.push([at.get(n)!, at.get(pg.points[(i + 1) % pg.points.length]!)!]));
  for (const sg of f.segments ?? []) lines.push([at.get(sg.from)!, at.get(sg.to)!]);
  let clashes = 0;
  boxes.forEach((b, i) => {
    for (const o of boxes.slice(i + 1)) if (Math.min(b[1]!, o[1]!) - Math.max(b[0]!, o[0]!) > -4 && Math.min(b[3]!, o[3]!) - Math.max(b[2]!, o[2]!) > -2) clashes++;
    const inner = [b[0]! + 3, b[1]! - 3, b[2]! + 4, b[3]! - 4];
    if (lines.some(([p, q]) => crossesBox(p, q, inner))) clashes++;
  });
  return clashes;
}

/** The first figure whose labels don't clash, or else the one with the fewest clashes. */
function roomiest(make: (() => DiagramFig)[]): DiagramFig {
  let best: DiagramFig | undefined;
  let fewest = Infinity;
  for (const m of make) {
    const f = m();
    const n = crowding(f);
    if (n < fewest) [best, fewest] = [f, n];
    if (n === 0) break;
  }
  return best!;
}

/**
 * The renderer puts angle labels 36px out along the bisector and segment labels 14px off the midpoint. A wide
 * label in a narrow angle, or beside a steep segment, then sits on a line. Move those labels out just far
 * enough to clear the lines (as free labels), and widen the view so they stay inside it.
 */
function declutter(f: DiagramFig): DiagramFig {
  const at = new Map(f.points!.map((p) => [p.name, [p.x as number, p.y as number] as Pt]));
  const all = [...at.values()];
  const centre: Pt = [all.reduce((t, p) => t + p[0], 0) / all.length, all.reduce((t, p) => t + p[1], 0) / all.length];
  const base = f.view;
  /** Distance from a box's centre to a line in direction t that the box just clears, in pixels. */
  const clear = (tex: string, t: number) => {
    const [w, h] = labelBox(tex);
    return (w / 2) * Math.abs(Math.sin(t)) + (h / 2) * Math.abs(Math.cos(t)) + 3;
  };
  let out = f;
  for (let pass = 0; pass < 3; pass++) {
    const unit = pxPerUnit(out.view);
    const labels: NonNullable<DiagramSpec["labels"]> = [];
    // Where each angle label must sit to clear its sides and its arc. If any has to move, all the given values
    // become free labels, so they look alike.
    const spots = (f.angles ?? []).map((a) => {
      if (!a.label || a.right || a.reflex) return null;
      const [v, p, q] = [at.get(a.at)!, at.get(a.from)!, at.get(a.to)!];
      const t1 = Math.atan2(p[1] - v[1], p[0] - v[0]);
      let d = Math.atan2(q[1] - v[1], q[0] - v[0]) - t1;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d <= -Math.PI) d += 2 * Math.PI;
      const usual = 36 + ((a.arcs ?? 1) - 1) * 4;
      const bisector = t1 + d / 2;
      // Far enough out to clear both sides, and far enough that the label's near edge clears the arc. (A wide
      // label on a nearly level bisector reaches back over its own arc at the usual distance.)
      const sides = Math.max(clear(a.label, t1), clear(a.label, t1 + d)) / Math.sin(Math.abs(d) / 2);
      const arc = 20 + ((a.arcs ?? 1) - 1) * 4 + 1;
      const [w, h] = [labelBox(a.label)[0], 14];
      const gap = (r: number) => Math.hypot(Math.max(0, Math.abs(r * Math.cos(bisector)) - w / 2), Math.max(0, Math.abs(r * Math.sin(bisector)) - h / 2));
      let past = usual;
      while (gap(past) < arc && past < 300) past += 1;
      return { v, bisector, usual, need: Math.max(sides, past) };
    });
    const move = spots.some((sp) => sp && sp.need > sp.usual);
    const angles = (f.angles ?? []).map((a, i) => {
      const sp = spots[i];
      // The unknown keeps its orange unless it has to move itself (free labels have no colour).
      if (!move || !sp || (a.color === ASKED && sp.need <= sp.usual)) return a;
      const r = Math.max(sp.need, sp.usual) / unit;
      labels.push({ x: r3(sp.v[0] + r * Math.cos(sp.bisector)), y: r3(sp.v[1] + r * Math.sin(sp.bisector)), text: a.label! });
      const { label: _, ...rest } = a;
      return rest;
    });
    const segments = (f.segments ?? []).map((sg) => {
      if (!sg.label) return sg;
      const [p, q] = [at.get(sg.from)!, at.get(sg.to)!];
      const t = Math.atan2(q[1] - p[1], q[0] - p[0]);
      // Tick and parallel marks reach 6px out from the line, so a label beside them needs that much more room.
      const need = clear(sg.label, t) + (sg.ticks || sg.parallel ? 5 : 0);
      if (need <= 16) return sg;
      const m = midPt(p, q);
      const n: Pt = [-Math.sin(t), Math.cos(t)];
      const side = (m[0] - centre[0]) * n[0] + (m[1] - centre[1]) * n[1] < 0 ? -1 : 1;
      labels.push({ x: r3(m[0] + (side * n[0] * need) / unit), y: r3(m[1] + (side * n[1] * need) / unit), text: sg.label });
      const { label: _, ...rest } = sg;
      return rest;
    });
    // Widen the view to hold the moved labels.
    const view: [number, number, number, number] = [...base];
    for (const l of labels) {
      const [w, h] = labelBox(l.text).map((v) => (v / 2 + 4) / unit) as [number, number];
      const [x, y] = [l.x as number, l.y as number];
      view[0] = Math.min(view[0], r3(x - w));
      view[1] = Math.max(view[1], r3(x + w));
      view[2] = Math.min(view[2], r3(y - h));
      view[3] = Math.max(view[3], r3(y + h));
    }
    out = { ...f, view, ...(f.angles ? { angles } : {}), ...(f.segments ? { segments } : {}), ...(labels.length ? { labels } : {}) };
  }
  return out;
}

function diagram(pts: Record<string, Pt>, s: FigSpec): DiagramFig {
  const names = Object.keys(pts);
  const core = (s.outline ?? names).map((n) => pts[n]!);
  const c: Pt = [core.reduce((t, p) => t + p[0], 0) / core.length, core.reduce((t, p) => t + p[1], 0) / core.length];
  const all = Object.values(pts);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 0.2 * Math.max(x1 - x0, y1 - y0, 1);
  return declutter({
    kind: "diagram",
    view: s.view ?? [r3(x0 - pad), r3(x1 + pad), r3(y0 - pad), r3(y1 + pad)],
    ...(s.grid ? { grid: true } : {}),
    points: names.map((name) => {
      const p = pts[name]!;
      const point: FigPoint = { name, x: r3(p[0]), y: r3(p[1]), dir: s.dirs?.[name] ?? dirOf([p[0] - c[0], p[1] - c[1]]) };
      const label = s.names?.[name];
      if (label !== undefined) point.label = label;
      if (s.hidden?.includes(name)) point.hidden = true;
      return point;
    }),
    ...(s.outline ? { polygons: [{ points: s.outline }] } : {}),
    ...(s.segments ? { segments: s.segments } : {}),
    ...(s.angles ? { angles: s.angles } : {}),
  });
}

/** The sides of each corner of quadrilateral ABCD. */
const CORNER: Record<string, [string, string]> = { A: ["B", "D"], B: ["C", "A"], C: ["D", "B"], D: ["A", "C"] };
/** The interior angle at a corner of ABCD, labelled; the asked one in orange. */
const corner = (v: string, label: string, asked = false): FigAngle => ({ at: v, from: CORNER[v]![0], to: CORNER[v]![1], label, ...(asked ? { color: ASKED } : {}) });
/** A segment named like "AB" or "AE", with an optional label. */
const seg = (name: string, label?: string, extra: Partial<FigSeg> = {}): FigSeg => ({ from: name[0]!, to: name[1]!, ...(label ? { label } : {}), ...extra });
/** The four halves of the diagonals of ABCD, meeting at E, with labels on some. */
const halves = (labels: Partial<Record<string, string>> = {}): FigSeg[] => ["AE", "CE", "BE", "DE"].map((h) => seg(h, labels[h]));

/** Parallelogram with A at the origin, AB along the x-axis and angle A in degrees. */
function parallelogramPts(angleA: number, ab = 6, ad = 3.6): Quad {
  const d: Pt = [ad * Math.cos(rad(angleA)), ad * Math.sin(rad(angleA))];
  return { A: [0, 0], B: [ab, 0], C: [ab + d[0], d[1]], D: d };
}

/** A quadrilateral with its diagonals drawn to E (the midpoint of AC, for parallelograms). */
const withCenter = (q: Quad): Quad & { E: Pt } => ({ ...q, E: midPt(q.A, q.C) });

/** Trapezoid with base AB on the x-axis, DC above it at height h, and angles a at A and b at B. */
function trapezoidPts(a: number, b: number, h = 3, minBase = 3): Quad {
  const [ca, cb] = [h / Math.tan(rad(a)), h / Math.tan(rad(b))];
  const top = Math.max(minBase, minBase - (ca + cb));
  const ab = top + ca + cb;
  return { A: [0, 0], B: [ab, 0], C: [ab - cb, h], D: [ca, h] };
}

/** Kite ABCD with AB = AD and CB = CD: A above and C below E, the origin; B and D at distance q to the sides. */
const kitePts = (ae: number, ce: number, q: number): Quad & { E: Pt } => ({ A: [0, ae], B: [-q, 0], C: [0, -ce], D: [q, 0], E: [0, 0] });

/** The same shape turned a quarter turn counterclockwise (a kite then has A on the left and C on the right). */
const sideways = <T extends Record<string, Pt>>(pts: T): T => Object.fromEntries(Object.entries(pts).map(([n, p]) => [n, [-p[1], p[0]]])) as T;

/** Kite from its angles at A and C. */
const kiteFromAngles = (a: number, c: number, q = 3) => kitePts(q / Math.tan(rad(a / 2)), q / Math.tan(rad(c / 2)), q);

const PARALLEL_BASES: FigSeg[] = [seg("AB", undefined, { parallel: 1 }), seg("DC", undefined, { parallel: 1 })];
const EQUAL_LEGS: FigSeg[] = [seg("AD", undefined, { ticks: 1 }), seg("BC", undefined, { ticks: 1 })];
const KITE_SIDES: FigSeg[] = [seg("AB", undefined, { ticks: 1 }), seg("AD", undefined, { ticks: 1 }), seg("CB", undefined, { ticks: 2 }), seg("CD", undefined, { ticks: 2 })];

/** A regular n-gon with one interior angle, or one exterior angle, marked "?". */
function regularPolygonFigure(n: number, exterior: boolean): Figure {
  const R = 4;
  const pts: Record<string, Pt> = {};
  for (let k = 0; k < n; k++) {
    const t = rad(-90 - 180 / n + (360 * k) / n);
    pts[`P${k}`] = [R * Math.cos(t), R * Math.sin(t)];
  }
  const names = Object.keys(pts);
  const blank = Object.fromEntries(names.map((nm) => [nm, ""]));
  if (!exterior) {
    return diagram(pts, { outline: names, names: blank, hidden: n > 12 ? names : [], angles: [{ at: "P0", from: "P1", to: `P${n - 1}`, label: "?", color: ASKED }] });
  }
  const [p0, p1] = [pts.P0!, pts.P1!];
  const side = dist(p0, p1);
  const ext = Math.max(0.8 * side, 1.8) / side;
  pts.X = [p1[0] + (p1[0] - p0[0]) * ext, p1[1] + (p1[1] - p0[1]) * ext];
  return diagram(pts, {
    outline: names,
    names: { ...blank, X: "" },
    hidden: ["X"],
    segments: [{ from: "P1", to: "X", dashed: true }],
    angles: [{ at: "P1", from: "X", to: "P2", label: "?", color: ASKED }],
  });
}

/**
 * Convex polygons whose interior angles, in order around them, are `angles` (in degrees), as lists of corners.
 * The most even-looking shape comes first.
 */
function polygonsWithAngles(angles: number[]): Pt[][] {
  const n = angles.length;
  const heading: number[] = [];
  let d = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) d += 180 - angles[i]!;
    heading.push(rad(d));
  }
  const u = heading.map((h): Pt => [Math.cos(h), Math.sin(h)]);
  // Side i runs from corner i to corner i + 1. Choose all lengths but two, solve for those two so the
  // polygon closes, and keep the most even-looking result.
  const found: { L: number[]; score: number }[] = [];
  for (let t = 0; t < 12; t++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const L = Array.from({ length: n }, (_, k) => 1 + 0.5 * Math.sin(1.3 * t + 2.1 * k + 0.7 * t * k));
        L[i] = L[j] = 0;
        const sx = L.reduce((s, l, k) => s + l * u[k]![0], 0);
        const sy = L.reduce((s, l, k) => s + l * u[k]![1], 0);
        const [p, q] = [u[i]!, u[j]!];
        const det = p[0] * q[1] - p[1] * q[0];
        if (Math.abs(det) < 0.05) continue;
        L[i] = (-sx * q[1] + q[0] * sy) / det;
        L[j] = (-p[0] * sy + p[1] * sx) / det;
        if (!(L[i]! > 0 && L[j]! > 0)) continue;
        found.push({ L, score: Math.min(...L) / Math.max(...L) });
      }
    }
  }
  if (!found.length) throw new Error(`no polygon with angles ${angles.join(", ")}`);
  return found
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map(({ L }) => {
      const pts: Pt[] = [[0, 0]];
      for (let i = 0; i < n - 1; i++) pts.push([pts[i]![0] + L[i]! * u[i]![0], pts[i]![1] + L[i]! * u[i]![1]]);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const k = 8 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      return pts.map((p): Pt => [p[0] * k, p[1] * k]);
    });
}

/**
 * A convex polygon with its angles labelled in order. With `exterior`, each side is extended past the next corner
 * and the label goes on that exterior angle; the polygon's interior angles are then 180 minus each value.
 */
function anglePolygonFigure(values: number[], labels: string[], exterior: boolean, asked = -1): Figure {
  // Of the shapes with these angles, the most even one whose labels have room.
  return roomiest(polygonsWithAngles(exterior ? values.map((v) => 180 - v) : values).map((corners) => () => anglePolygon(corners, labels, exterior, asked)));
}

function anglePolygon(corners: Pt[], labels: string[], exterior: boolean, asked: number): DiagramFig {
  const n = corners.length;
  const pts: Record<string, Pt> = {};
  corners.forEach((p, i) => (pts[`V${i}`] = p));
  const names = Object.keys(pts);
  const blank: Record<string, string> = Object.fromEntries(names.map((nm) => [nm, ""]));
  const segments: FigSeg[] = [];
  const angles: FigAngle[] = [];
  corners.forEach((p, i) => {
    const prev = `V${(i + n - 1) % n}`;
    const next = `V${(i + 1) % n}`;
    const style = i === asked ? { color: ASKED } : {};
    if (exterior) {
      const q = pts[prev]!;
      const k = 2.2 / dist(q, p);
      const x = `X${i}`;
      pts[x] = [p[0] + (p[0] - q[0]) * k, p[1] + (p[1] - q[1]) * k];
      blank[x] = "";
      segments.push({ from: `V${i}`, to: x, dashed: true });
      angles.push({ at: `V${i}`, from: x, to: next, label: labels[i]!, ...style });
    } else {
      angles.push({ at: `V${i}`, from: next, to: prev, label: labels[i]!, ...style });
    }
  });
  return diagram(pts, { outline: names, names: blank, hidden: Object.keys(pts).filter((nm) => nm.startsWith("X")), segments, angles });
}

interface QuadFig {
  /** Segment labels by name, in either order: sides ("AB"), halves of diagonals ("AE"), whole diagonals ("AC"). */
  lengths?: Partial<Record<string, string>>;
  /** The segment that is asked for, drawn in orange. */
  asked?: string;
  angles?: FigAngle[];
  /** "halves" draws the diagonals as four halves meeting at E; otherwise the whole diagonals listed. */
  diagonals?: "halves" | string[];
  /** Tick or parallel marks on sides. */
  marks?: FigSeg[];
  /** Gaps around E (0 = between EA and EB, counterclockwise) to keep E's label out of. */
  eSkip?: number[];
}

/** Quadrilateral ABCD, with E where its diagonals cross when `pts` has one. */
function quadFigure(pts: Quad & { E?: Pt }, o: QuadFig = {}): DiagramFig {
  const key = (nm: string) => [...nm].sort().join("");
  const lengths = Object.entries(o.lengths ?? {});
  const used = new Set<string>();
  const make = (nm: string, extra: Partial<FigSeg> = {}): FigSeg => {
    used.add(key(nm));
    const label = lengths.find(([n]) => key(n) === key(nm))?.[1];
    return { from: nm[0]!, to: nm[1]!, ...extra, ...(label ? { label } : {}), ...(o.asked && key(nm) === key(o.asked) ? { color: ASKED } : {}) };
  };
  const segments = (o.marks ?? []).map((m) => make(m.from + m.to, m));
  if (o.diagonals === "halves") segments.push(...["AE", "CE", "BE", "DE"].map((h) => make(h)));
  else for (const d of o.diagonals ?? []) segments.push(make(d));
  for (const [n] of lengths) if (!used.has(key(n))) segments.push(make(n));
  const dirs: Partial<Record<string, Dir>> = pts.E ? { E: crossingDir(pts.E, [pts.A, pts.B, pts.C, pts.D], o.eSkip) } : {};
  return diagram(pts, { outline: ["A", "B", "C", "D"], segments, ...(o.angles ? { angles: o.angles } : {}), dirs });
}

/** `pts` scaled so that segment `nm` has length `len`. */
const scaledTo = <T extends Record<string, Pt>>(pts: T, nm: string, len: number): T => scalePts(pts, len / dist(pts[nm[0]!]!, pts[nm[1]!]!));

/** The parallelogram used when only lengths matter. */
const PG = withCenter(parallelogramPts(65));

const rectPts = (w: number, h: number) => withCenter({ A: [0, 0], B: [w, 0], C: [w, h], D: [0, h] });
/** The rectangle used when only lengths matter. */
const RECT = rectPts(7, 4);
const RIGHT_CORNERS: FigAngle[] = ["A", "B", "C", "D"].map((v) => ({ ...corner(v, ""), right: true }));

/** Rhombus ABCD with half-diagonals AE = p (up) and BE = q (left), E at the origin. */
const rhombusPts = (p: number, q: number) => kitePts(p, p, q);
/** Rhombus ABCD with side s and angle 2t at B (and D). */
const rhombusFromAngle = (s: number, t: number) => rhombusPts(s * Math.sin(rad(t)), s * Math.cos(rad(t)));
const RHOMBUS_SIDES: FigSeg[] = ["AB", "BC", "CD", "DA"].map((n) => seg(n, undefined, { ticks: 1 }));
const withoutE = <T extends { E?: Pt }>(pts: T): Omit<T, "E"> => {
  const { E: _, ...rest } = pts;
  return rest;
};

// ── Lesson 1: Angles of polygons ────────────────────────────────────────────

const REGULAR_N = [5, 6, 8, 9, 10, 12, 15, 18, 20];

const polygonAngles: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 2, 2, 3]);
  if (kind === 0) {
    const n = r.int(5, 20);
    const S = (n - 2) * 180;
    return {
      prompt: md`Find the sum of the interior angles of a convex ${polyName(n)}${POLY_NAMES[n] ? "" : ` (a polygon with ${n} sides)`}. Give the angle in degrees.`,
      answer: String(S),
      verify: [`x = (${n} - 2)*180`],
      hint: md`Triangulate from one vertex. A convex polygon with $n$ sides splits into $n - 2$ triangles.`,
      solution: [
        { math: md`${n} - 2 = ${n - 2}`, note: md`Diagonals from one vertex cut the polygon into ${n - 2} triangles.` },
        { math: md`${n - 2} \cdot 180^\circ = ${S}^\circ`, note: md`Each triangle's angles add to $180^\circ$, and together the triangles' angles make up the polygon's angles exactly.` },
      ],
    };
  }
  if (kind === 1) {
    const n = r.pick(REGULAR_N);
    const S = (n - 2) * 180;
    return {
      prompt: md`Find the measure of each interior angle of a regular ${POLY_NAMES[n] ?? `polygon with ${n} sides`}. Give the angle in degrees.`,
      answer: String(S / n),
      figure: regularPolygonFigure(n, false),
      verify: [`${n}x = (${n} - 2)*180`],
      hint: md`Find the total of all ${n} angles first. In a regular polygon they are all equal, so share the total equally.`,
      solution: [
        { math: md`(${n} - 2) \cdot 180^\circ = ${S}^\circ`, note: md`The interior angles add to $(n - 2) \cdot 180^\circ$.` },
        { math: md`\frac{${S}^\circ}{${n}} = ${S / n}^\circ`, note: md`A regular polygon is equiangular, so each of the ${n} angles gets an equal share.` },
        { math: md`180^\circ - \frac{360^\circ}{${n}} = 180^\circ - ${360 / n}^\circ = ${S / n}^\circ`, note: md`Check with the exterior angle: each one is $360^\circ$ shared ${n} ways, and it forms a linear pair with the interior angle.` },
      ],
    };
  }
  if (kind === 2) {
    const n = r.pick([...REGULAR_N, 24, 30, 36]);
    return {
      prompt: md`Find the measure of each exterior angle of a regular ${POLY_NAMES[n] ?? `polygon with ${n} sides`}. Give the angle in degrees.`,
      answer: String(360 / n),
      ...(n <= 12 ? { figure: regularPolygonFigure(n, true) } : {}),
      verify: [`${n}x = 360`],
      hint: md`The exterior angles of any convex polygon, one at each vertex, add up to $360^\circ$.`,
      solution: [
        { math: md`\frac{360^\circ}{${n}} = ${360 / n}^\circ`, note: md`The ${n} exterior angles add to $360^\circ$, and in a regular polygon they are all equal.` },
      ],
    };
  }
  const n = r.int(7, 20);
  return {
    prompt: md`A convex ${POLY_NAMES[n] ?? `polygon with ${n} sides`} has one exterior angle drawn at each vertex. Find the sum of these ${n} exterior angles. Give the angle in degrees.`,
    answer: "360",
    verify: [`x + (${n} - 2)*180 = ${n}*180`],
    hint: md`At each vertex, the interior and exterior angles form a linear pair. Add up all ${n} pairs, then take away the interior angles.`,
    solution: [
      { math: md`${n} \cdot 180^\circ = ${n * 180}^\circ`, note: md`Each of the ${n} linear pairs adds to $180^\circ$.` },
      { math: md`${n * 180}^\circ - ${(n - 2) * 180}^\circ = 360^\circ`, note: md`Subtract the interior angle sum, $(${n} - 2) \cdot 180^\circ$. The answer is $360^\circ$ for every convex polygon.` },
    ],
  };
};

const sidesFromAngle: Generator = (r) => {
  const kind = r.pick([0, 1, 1, 2, 2]);
  if (kind === 0) {
    const n = r.int(5, 24);
    const S = (n - 2) * 180;
    return {
      prompt: md`Solve $180(n - 2) = ${S}$ to find how many sides a convex polygon has when its interior angles add up to $${S}^\circ$. Give a whole number.`,
      answer: String(n),
      hint: md`The polygon splits into $n - 2$ triangles of $180^\circ$ each. Divide by 180 first.`,
      solution: [
        { math: md`n - 2 = ${n - 2}`, note: md`Divide both sides by 180: there are $${S} \div 180 = ${n - 2}$ triangles.` },
        { math: md`n = ${n}`, note: "Add 2 to both sides." },
      ],
    };
  }
  const n = r.pick([...REGULAR_N, 24, 30, 36]);
  const e = 360 / n;
  if (kind === 1) {
    return {
      prompt: md`Solve $\frac{360}{n} = ${e}$ to find how many sides a regular polygon has when each exterior angle measures $${e}^\circ$. Give a whole number.`,
      answer: String(n),
      hint: md`Multiply both sides by $n$ to clear the fraction.`,
      solution: [
        { math: md`360 = ${e}n`, note: md`Multiply both sides by $n$. This says: $n$ equal exterior angles of $${e}^\circ$ make a full turn.` },
        { math: md`n = \frac{360}{${e}} = ${n}`, note: md`Divide both sides by ${e}.` },
      ],
    };
  }
  const i = 180 - e;
  return {
    prompt: md`Solve $\frac{180(n - 2)}{n} = ${i}$ to find how many sides a regular polygon has when each interior angle measures $${i}^\circ$. Give a whole number.`,
    answer: String(n),
    hint: md`Multiply both sides by $n$, then collect the $n$-terms. (Or use the exterior angle, $180^\circ - ${i}^\circ$.)`,
    solution: [
      { math: md`180(n - 2) = ${i}n`, note: md`Multiply both sides by $n$.` },
      { math: md`180n - 360 = ${i}n`, note: "Distribute." },
      { math: md`${e}n = 360`, note: md`Subtract $${i}n$ from both sides, then add 360.` },
      { math: md`n = ${n}`, note: md`Divide by ${e}. Shortcut: each exterior angle is $180^\circ - ${i}^\circ = ${e}^\circ$, and $360 \div ${e} = ${n}$.` },
    ],
  };
};

const missingPolygonAngle: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 1, 2, 2]);
  if (kind === 0) {
    const n = r.int(4, 7);
    const S = (n - 2) * 180;
    const angles = anglesSumming(r, n, S, 60, 170);
    const missing = angles.pop()!;
    const given = angles.reduce((s, v) => s + v, 0);
    return {
      prompt: md`The figure shows a convex ${polyName(n)}. Find the missing angle, $x$. Give the angle in degrees.`,
      answer: String(missing),
      figure: anglePolygonFigure([...angles, missing], [...angles.map((a) => md`${a}^\circ`), md`x^\circ`], false, n - 1),
      verify: [`x + ${angles.join(" + ")} = (${n} - 2)*180`],
      hint: md`All ${n} angles add up to $(${n} - 2) \cdot 180^\circ$. What is left after the ones you know?`,
      solution: [
        { math: md`(${n} - 2) \cdot 180^\circ = ${S}^\circ`, note: md`The angle sum of a ${polyName(n)}.` },
        { math: md`${angles.join(" + ")} = ${given}`, note: "Add the angles you know." },
        { math: md`${S}^\circ - ${given}^\circ = ${missing}^\circ`, note: "The missing angle is whatever is left." },
      ],
    };
  }
  const exterior = kind === 2;
  const n = r.pick([4, 5, 6]);
  const S = exterior ? 360 : (n - 2) * 180;
  const values = exterior ? anglesSumming(r, n, 360, 30, 130) : anglesSumming(r, n, S, 50, 170);
  const x = r.int(5, exterior ? 20 : 30);
  const k = exterior ? n : r.int(2, 3);
  const parts = values.map((v, i) => {
    const a = i < k ? r.int(1, 3) : 0;
    return { a, b: v - a * x };
  });
  const shown = shuffle(r, parts);
  const A = shown.reduce((s, p) => s + p.a, 0);
  const B = shown.reduce((s, p) => s + p.b, 0);
  const sum = shown.map((p) => term(p.a, p.b)).join(" + ");
  const name = polyName(n);
  const solveForm = r.next() < 0.5;
  const prompt = exterior
    ? solveForm
      ? md`Solve $${sum} = 360$. The left side adds the exterior angles of a convex ${name}, one at each vertex.`
      : md`The figure shows a convex ${name} with one exterior angle at each vertex. Find $x$.`
    : solveForm
      ? md`Solve $${sum} = ${S}$. The left side adds the ${COUNT_WORDS[n]!.toLowerCase()} angles of a convex ${name}, and $${S}^\circ$ is the ${name}'s angle sum.`
      : md`The figure shows a convex ${name} with its angles marked. Find $x$.`;
  const labels = shown.map((p) => (p.a === 0 ? md`${p.b}^\circ` : degX(p.a, p.b)));
  const why = exterior
    ? md`The exterior angles of a convex polygon, one at each vertex, add up to $360^\circ$.`
    : md`The angles of a ${name} add up to $(${n} - 2) \cdot 180^\circ = ${S}^\circ$.`;
  return {
    prompt,
    answer: String(x),
    ...(solveForm ? {} : { figure: anglePolygonFigure(shown.map((p) => p.a * x + p.b), labels, exterior), verify: [`${sum} = ${S}`] }),
    hint: exterior ? md`Exterior angles, one at each vertex, always add up to $360^\circ$.` : md`Set the sum of all ${n} angles equal to the ${name}'s angle sum, $(${n} - 2) \cdot 180^\circ$.`,
    solution: [
      { math: md`${sum} = ${S}`, note: why },
      { math: md`${lin(A, B)} = ${S}`, note: "Combine like terms." },
      ...linearSteps(A, B, 0, S).map((s, i, all) => (i === all.length - 1 ? { ...s, note: md`${s.note ? s.note + " " : ""}Check: the angles are ${listAnd(shown.map((p) => md`$${p.a * x + p.b}^\circ$`))}, which add to $${S}^\circ$.` } : s)),
    ],
  };
};

// ── Lesson 2: Parallelograms ────────────────────────────────────────────────

const PARALLEL_SIDES: FigSeg[] = [
  seg("AB", undefined, { parallel: 1 }),
  seg("DC", undefined, { parallel: 1 }),
  seg("AD", undefined, { parallel: 2 }),
  seg("BC", undefined, { parallel: 2 }),
];

/** Parallelogram ABCD with angle A of `angleA` degrees and some corners labelled. */
function parallelogramAngleFigure(angleA: number, labels: Partial<Record<string, string>>, asked?: string): Figure {
  return diagram(parallelogramPts(angleA), {
    outline: ["A", "B", "C", "D"],
    segments: PARALLEL_SIDES,
    angles: Object.entries(labels).map(([v, l]) => corner(v, l!, v === asked)),
  });
}

const parallelogramAngles: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 1, 2, 2]);
  const g = r.int(0, 3);
  const q = (g + r.int(1, 3)) % 4;
  const opp = isOpposite(g, q);
  const [G, Q] = [V[g]!, V[q]!];
  if (kind === 0) {
    const a = r.pick(ANGLES);
    const ans = opp ? a : 180 - a;
    return {
      prompt: md`Find $\angle ${Q}$ in parallelogram $ABCD$. Give the angle in degrees.`,
      answer: String(ans),
      figure: parallelogramAngleFigure(g % 2 === 0 ? a : 180 - a, { [G]: md`${a}^\circ`, [Q]: "?" }, Q),
      verify: [opp ? `y = ${a}` : `y + ${a} = 180`],
      hint: md`Are $\angle ${G}$ and $\angle ${Q}$ opposite each other, or next to each other? Opposite angles are congruent; consecutive angles are supplementary.`,
      solution: opp
        ? [{ math: md`\angle ${Q} = \angle ${G} = ${a}^\circ`, note: "They are opposite angles, and opposite angles of a parallelogram are congruent." }]
        : [{ math: md`\angle ${Q} = 180^\circ - ${a}^\circ = ${ans}^\circ`, note: md`They are consecutive angles: same-side interior angles between parallel sides, so they add to $180^\circ$.` }],
    };
  }
  const x = r.int(4, 20);
  const v1 = r.pick(ANGLES);
  const v2 = opp ? v1 : 180 - v1;
  const [a1, a2] = opp ? twoCoefs(r, 1, 4) : [r.int(1, 4), r.int(1, 4)];
  const [b1, b2] = [v1 - a1 * x, v2 - a2 * x];
  const given = md`$\angle ${G} = ${degX(a1, b1)}$ and $\angle ${Q} = ${degX(a2, b2)}$`;
  const eq = opp ? md`${lin(a1, b1)} = ${lin(a2, b2)}` : md`${term(a1, b1)} + ${term(a2, b2)} = 180`;
  const steps: Step[] = opp
    ? [{ math: eq, note: "Opposite angles of a parallelogram are congruent." }, ...linearSteps(a1, b1, a2, b2)]
    : [
        { math: eq, note: md`Consecutive angles of a parallelogram are supplementary.` },
        { math: md`${lin(a1 + a2, b1 + b2)} = 180`, note: "Combine like terms." },
        ...linearSteps(a1 + a2, b1 + b2, 0, 180),
      ];
  const hint = md`Decide first: are $\angle ${G}$ and $\angle ${Q}$ opposite (equal) or consecutive (adding to $180^\circ$)?`;
  const angleA = g % 2 === 0 ? v1 : 180 - v1;
  if (kind === 1) {
    const solveForm = r.next() < 0.5;
    return {
      prompt: solveForm
        ? md`Solve $${eq}$. In parallelogram $ABCD$, ${given} are ${opp ? "opposite angles, so they are equal" : md`consecutive angles, so they add to $180^\circ$`}.`
        : md`Find $x$ in parallelogram $ABCD$.`,
      answer: String(x),
      ...(solveForm ? {} : { figure: parallelogramAngleFigure(angleA, { [G]: degX(a1, b1), [Q]: degX(a2, b2) }), verify: [eq] }),
      hint,
      solution: steps,
    };
  }
  const t = r.int(0, 3);
  const T = V[t]!;
  const ans = t === g || isOpposite(g, t) ? v1 : 180 - v1;
  const last: Step =
    t === g
      ? { math: md`\angle ${T} = ${ans}^\circ`, note: "That's the angle asked for." }
      : isOpposite(g, t)
        ? { math: md`\angle ${T} = \angle ${G} = ${ans}^\circ`, note: "Opposite angles are congruent." }
        : { math: md`\angle ${T} = 180^\circ - ${v1}^\circ = ${ans}^\circ`, note: md`$\angle ${T}$ is consecutive to $\angle ${G}$.` };
  return {
    prompt: md`Find $\angle ${T}$ in parallelogram $ABCD$. Give the angle in degrees.`,
    answer: String(ans),
    figure: parallelogramAngleFigure(angleA, { [T]: "?", [G]: degX(a1, b1), [Q]: degX(a2, b2) }, t === g || t === q ? undefined : T),
    verify: [via(eq, t === g || isOpposite(g, t) ? xFrom(a1, b1) : xFrom(a1, b1, "180 - y"))],
    hint: md`${hint} Find $x$, then substitute.`,
    solution: [...steps, { math: md`\angle ${G} = ${subst(a1, b1, x)} = ${v1}^\circ`, note: md`Substitute $x = ${x}$.` }, last],
  };
};

const SIDE_PAIRS = [
  ["AB", "CD"],
  ["AD", "BC"],
] as const;
const HALF_PAIRS = [
  ["AE", "CE", "AC"],
  ["BE", "DE", "BD"],
] as const;

/** Label directions for points on a grid, turned away from the axis numbers (below the x-axis, left of the y-axis). */
function offAxes(pts: Record<string, [readonly number[], Dir]>, turn = true): Record<string, Dir> {
  return Object.fromEntries(
    Object.entries(pts).map(([n, [p, d]]) => {
      let dir: string = d;
      if (!turn) return [n, d];
      if (p[1] === 0 && dir.includes("s")) dir = dir.replace("s", "n");
      if (p[0] === 0 && dir.includes("w")) dir = dir.replace("w", "e");
      return [n, dir as Dir];
    }),
  );
}

const parallelogramSegments: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 1, 1, 2, 2, 3, 3]);
  const diag = md`the diagonals meet at $E$`;
  if (kind === 0) {
    const sub = r.int(0, 2);
    const k = r.int(3, 15);
    if (sub === 0) {
      const [h1, h2, w] = r.pick(HALF_PAIRS);
      const asked = r.next() < 0.5 ? h1 : h2;
      return {
        prompt: md`In parallelogram $ABCD$, ${diag} and $${w} = ${2 * k}$. Find $${asked}$.`,
        answer: String(k),
        figure: quadFigure(scaledTo(PG, w, 2 * k), { diagonals: "halves", lengths: { [asked]: "?" }, asked }),
        verify: [`2y = ${2 * k}`],
        hint: "The diagonals of a parallelogram bisect each other.",
        solution: [{ math: md`${asked} = \frac{${w}}{2} = \frac{${2 * k}}{2} = ${k}`, note: md`$E$ is the midpoint of $\overline{${w}}$.` }],
      };
    }
    if (sub === 1) {
      const [h1, h2, w] = r.pick(HALF_PAIRS);
      const given = r.next() < 0.5 ? h1 : h2;
      return {
        prompt: md`In parallelogram $ABCD$, ${diag}. Find $${w}$.`,
        answer: String(2 * k),
        figure: quadFigure(scaledTo(PG, w, 2 * k), { diagonals: "halves", lengths: { [given]: String(k) } }),
        verify: [`y = 2 * ${k}`],
        hint: "The diagonals of a parallelogram bisect each other.",
        solution: [{ math: md`${w} = 2 \cdot ${given} = 2 \cdot ${k} = ${2 * k}`, note: md`$E$ is the midpoint of $\overline{${w}}$, so $\overline{${w}}$ is twice as long as either half.` }],
      };
    }
    const s = r.int(4, 15);
    let t = r.int(3, 15);
    while (t === s) t = r.int(3, 15);
    const P = 2 * (s + t);
    return {
      prompt: md`Parallelogram $ABCD$ has perimeter ${P}. Find $BC$.`,
      answer: String(t),
      figure: quadFigure(parallelogramPts(65, s, t), { lengths: { AB: String(s), BC: "?" }, asked: "BC" }),
      verify: [`2(${s} + y) = ${P}`],
      hint: md`Opposite sides are congruent, so the perimeter is two copies of $AB + BC$.`,
      solution: [
        { math: md`2(AB + BC) = ${P}`, note: md`$CD = AB$ and $DA = BC$, so the perimeter is $2(AB + BC)$.` },
        { math: md`AB + BC = ${P / 2}`, note: "Divide by 2." },
        { math: md`BC = ${P / 2} - ${s} = ${t}`, note: "Subtract AB." },
      ],
    };
  }
  if (kind === 3) {
    let A: [number, number], u: [number, number], v: [number, number];
    for (;;) {
      A = [r.int(-4, 2), r.int(-4, 2)];
      u = [r.int(3, 7), r.int(-2, 2)];
      v = [r.int(-3, 3), r.int(3, 6)];
      if (u[0] * v[1] - u[1] * v[0] !== 0) break;
    }
    const B = [A[0] + u[0], A[1] + u[1]] as const;
    const C = [B[0] + v[0], B[1] + v[1]] as const;
    const D = [A[0] + v[0], A[1] + v[1]] as const;
    return {
      prompt: md`Three vertices of parallelogram $ABCD$ are $A(${A[0]}, ${A[1]})$, $B(${B[0]}, ${B[1]})$ and $C(${C[0]}, ${C[1]})$. Find the coordinates of $D$. Give the point as (x, y).`,
      answer: `(${D[0]}, ${D[1]})`,
      form: "tuple",
      // A and C away from each other; B away from both of its sides (they run along -u and v). A point on an
      // axis keeps its label off that axis's numbers, unless that would put it on a side.
      figure: roomiest([true, false].map((axes) => () => diagram(
        { A: [...A], B: [...B], C: [...C] },
        {
          grid: true,
          names: { A: md`A(${A[0]}, ${A[1]})`, B: md`B(${B[0]}, ${B[1]})`, C: md`C(${C[0]}, ${C[1]})` },
          dirs: offAxes(
            {
              A: [A, dirOf([A[0] - C[0], A[1] - C[1]])],
              B: [B, dirOf([u[0] / Math.hypot(...u) - v[0] / Math.hypot(...v), u[1] / Math.hypot(...u) - v[1] / Math.hypot(...v)])],
              C: [C, dirOf([C[0] - A[0], C[1] - A[1]])],
            },
            axes,
          ),
          segments: [seg("AB"), seg("BC")],
          view: [Math.min(A[0], B[0], C[0], D[0]) - 2, Math.max(A[0], B[0], C[0], D[0]) + 2, Math.min(A[1], B[1], C[1], D[1]) - 1.5, Math.max(A[1], B[1], C[1], D[1]) + 1.5],
        },
      ))),
      // D - A = C - B, one equation for the sum of the coordinates and one for the difference.
      verify: [`(x - (${A[0]})) + (y - (${A[1]})) = (${C[0]} - (${B[0]})) + (${C[1]} - (${B[1]}))`, `(x - (${A[0]})) - (y - (${A[1]})) = (${C[0]} - (${B[0]})) - (${C[1]} - (${B[1]}))`],
      hint: md`The diagonals $\overline{AC}$ and $\overline{BD}$ bisect each other, so they have the same midpoint.`,
      solution: [
        {
          math: md`M = \left(\frac{${A[0]} + ${paren(C[0])}}{2}, \frac{${A[1]} + ${paren(C[1])}}{2}\right) = \left(${fracTex(A[0] + C[0], 2)}, ${fracTex(A[1] + C[1], 2)}\right)`,
          note: md`The midpoint of $\overline{AC}$. It is also the midpoint of $\overline{BD}$.`,
        },
        {
          math: md`D = (${A[0]} + ${paren(C[0])} - ${paren(B[0])},\; ${A[1]} + ${paren(C[1])} - ${paren(B[1])}) = (${D[0]}, ${D[1]})`,
          note: md`$M$ is halfway from $B$ to $D$, so $B + D = 2M = A + C$ in each coordinate. Solve for $D$.`,
        },
        { math: md`C - B = (${v[0]}, ${v[1]}) = D - A`, note: md`Check: going from $A$ to $D$ is the same move as from $B$ to $C$, since $\overline{AD}$ and $\overline{BC}$ are parallel and congruent.` },
      ],
    };
  }
  // Expressions in x.
  const type = r.pick(["sides", "halves", "halfwhole"] as const);
  const x = r.int(2, 10);
  const v = r.int(5, 20);
  if (type === "halfwhole") {
    const [h1, h2, w] = r.pick(HALF_PAIRS);
    const H = r.next() < 0.5 ? h1 : h2;
    const a1 = r.int(1, 3);
    let a2 = r.int(1, 6);
    while (a2 === 2 * a1) a2 = r.int(1, 6);
    const [b1, b2] = [v - a1 * x, 2 * v - a2 * x];
    const given = md`$${H} = ${lin(a1, b1)}$ and $${w} = ${lin(a2, b2)}$`;
    const eq = `2(${lin(a1, b1)}) = ${lin(a2, b2)}`;
    const figure = quadFigure(scaledTo(PG, w, 2 * v), { diagonals: "halves", lengths: { [H]: lin(a1, b1) } });
    const steps: Step[] = [
      { math: md`2(${lin(a1, b1)}) = ${lin(a2, b2)}`, note: md`$E$ is the midpoint of $\overline{${w}}$, so $${w} = 2 \cdot ${H}$.` },
      { math: md`${lin(2 * a1, 2 * b1)} = ${lin(a2, b2)}`, note: "Distribute." },
      ...linearSteps(2 * a1, 2 * b1, a2, b2),
    ];
    if (kind === 1) {
      const solveForm = r.next() < 0.5;
      return {
        prompt: solveForm
          ? md`Solve $2(${lin(a1, b1)}) = ${lin(a2, b2)}$. In parallelogram $ABCD$, ${diag}, ${given}; the equation says $${H}$ is half of $${w}$.`
          : md`In parallelogram $ABCD$, ${diag} and $${w} = ${lin(a2, b2)}$. Find $x$.`,
        answer: String(x),
        ...(solveForm ? {} : { figure, verify: [eq] }),
        hint: md`The diagonals bisect each other, so $${w}$ is twice $${H}$.`,
        solution: steps,
      };
    }
    return {
      prompt: md`In parallelogram $ABCD$, ${diag} and $${w} = ${lin(a2, b2)}$. Find $${w}$.`,
      answer: String(2 * v),
      figure,
      verify: [via(eq, xFrom(a2, b2))],
      hint: md`The diagonals bisect each other, so $${w}$ is twice $${H}$. Find $x$ first.`,
      solution: [...steps, { math: md`${w} = ${subst(a2, b2, x)} = ${2 * v}`, note: md`Substitute $x = ${x}$.` }],
    };
  }
  const [p1, p2, W]: readonly string[] = type === "sides" ? [...r.pick(SIDE_PAIRS), ""] : r.pick(HALF_PAIRS);
  const [N1, N2] = r.next() < 0.5 ? [p1!, p2!] : [p2!, p1!];
  const [a1, a2] = twoCoefs(r, 1, 5);
  const [b1, b2] = [v - a1 * x, v - a2 * x];
  const given = md`$${N1} = ${lin(a1, b1)}$ and $${N2} = ${lin(a2, b2)}$`;
  const reason = type === "sides" ? "Opposite sides of a parallelogram are congruent." : "The diagonals of a parallelogram bisect each other.";
  const steps: Step[] = [{ math: md`${lin(a1, b1)} = ${lin(a2, b2)}`, note: reason }, ...linearSteps(a1, b1, a2, b2)];
  const setting = type === "sides" ? md`In parallelogram $ABCD$, ${given}` : md`In parallelogram $ABCD$, ${diag}, ${given}`;
  const eq = `${lin(a1, b1)} = ${lin(a2, b2)}`;
  const figure =
    type === "sides"
      ? quadFigure(N1 === "AB" || N1 === "CD" ? parallelogramPts(65, v, 0.6 * v) : parallelogramPts(65, v / 0.6, v), { lengths: { [N1]: lin(a1, b1), [N2]: lin(a2, b2) } })
      : quadFigure(scaledTo(PG, W!, 2 * v), { diagonals: "halves", lengths: { [N1]: lin(a1, b1), [N2]: lin(a2, b2) } });
  const where = type === "sides" ? md`in parallelogram $ABCD$` : md`in parallelogram $ABCD$, where ${diag}`;
  if (kind === 1) {
    const solveForm = r.next() < 0.5;
    return {
      prompt: solveForm
        ? md`Solve $${lin(a1, b1)} = ${lin(a2, b2)}$. ${setting}, and ${type === "sides" ? "these opposite sides are congruent" : md`$E$ is the midpoint of $\overline{${W}}$`}.`
        : md`Find $x$ ${where}.`,
      answer: String(x),
      ...(solveForm ? {} : { figure, verify: [eq] }),
      hint: type === "sides" ? "Opposite sides of a parallelogram are congruent." : "The diagonals bisect each other, so the two halves are equal.",
      solution: steps,
    };
  }
  if (type === "sides") {
    return {
      prompt: md`Find $${N1}$ ${where}.`,
      answer: String(v),
      figure,
      verify: [via(eq, xFrom(a1, b1))],
      hint: md`Opposite sides are congruent. Find $x$ first.`,
      solution: [...steps, { math: md`${N1} = ${subst(a1, b1, x)} = ${v}`, note: md`Substitute $x = ${x}$.` }],
    };
  }
  return {
    prompt: md`Find $${W}$ ${where}.`,
    answer: String(2 * v),
    figure,
    verify: [via(eq, xFrom(a1, b1, "y/2"))],
    hint: md`The two halves of $\overline{${W}}$ are equal. Find $x$, then add the halves.`,
    solution: [
      ...steps,
      { math: md`${N1} = ${subst(a1, b1, x)} = ${v}`, note: md`Substitute $x = ${x}$.` },
      { math: md`${W} = ${v} + ${v} = ${2 * v}`, note: md`$${W} = ${N1} + ${N2}$ (Segment Addition), and the halves are equal.` },
    ],
  };
};

const TESTS: { fact: string; yes: boolean; why: string }[] = [
  { fact: md`$\overline{AB} \cong \overline{CD}$ and $\overline{BC} \cong \overline{DA}$`, yes: true, why: md`Both pairs of opposite sides congruent is a parallelogram test. SSS on a diagonal gives congruent triangles, whose alternate interior angles force both pairs of sides parallel.` },
  { fact: md`$\angle A \cong \angle C$ and $\angle B \cong \angle D$`, yes: true, why: md`The four angles add to $360^\circ$, so $2\angle A + 2\angle B = 360^\circ$ and $\angle A + \angle B = 180^\circ$. By the Same-Side Interior Angles Converse, $\overline{AD} \parallel \overline{BC}$, and the same argument gives $\overline{AB} \parallel \overline{DC}$.` },
  { fact: md`the diagonals bisect each other`, yes: true, why: md`Diagonals that bisect each other is a parallelogram test: vertical angles and SAS give congruent triangles, and their alternate interior angles force the sides parallel.` },
  { fact: md`$\overline{AB} \parallel \overline{DC}$ and $\overline{AB} \cong \overline{DC}$`, yes: true, why: md`One pair of sides that is both parallel and congruent is enough. SAS on diagonal $\overline{AC}$ gives $\triangle ABC \cong \triangle CDA$, and then $\overline{AD} \parallel \overline{BC}$ too.` },
  { fact: md`$\overline{AB} \parallel \overline{DC}$ and $\overline{BC} \parallel \overline{DA}$`, yes: true, why: "That is the definition of a parallelogram." },
  { fact: md`$\angle A + \angle B = 180^\circ$ and $\angle B + \angle C = 180^\circ$`, yes: true, why: md`With transversal $\overleftrightarrow{AB}$, the first equation and the Same-Side Interior Angles Converse give $\overline{AD} \parallel \overline{BC}$. With transversal $\overleftrightarrow{BC}$, the second gives $\overline{AB} \parallel \overline{DC}$.` },
  { fact: md`$\overline{AB} \parallel \overline{DC}$ and $\overline{BC} \cong \overline{DA}$`, yes: false, why: "An isosceles trapezoid has one pair of parallel sides and congruent legs, but its legs aren't parallel." },
  { fact: md`$\overline{AB} \cong \overline{BC}$ and $\overline{CD} \cong \overline{DA}$`, yes: false, why: "Those are consecutive sides, not opposite ones. A kite fits this description and isn't a parallelogram." },
  { fact: md`the diagonals are congruent`, yes: false, why: "An isosceles trapezoid has congruent diagonals and isn't a parallelogram." },
  { fact: md`the diagonals are perpendicular`, yes: false, why: "A kite has perpendicular diagonals and isn't a parallelogram." },
  { fact: md`$\angle A \cong \angle C$`, yes: false, why: "One pair of opposite angles isn't enough: a kite has one pair of congruent opposite angles." },
  { fact: md`$\overline{AB} \parallel \overline{DC}$`, yes: false, why: "One pair of parallel sides is a trapezoid. It takes both pairs." },
  { fact: md`$\overline{AB} \cong \overline{CD}$`, yes: false, why: "One pair of congruent sides isn't enough: an isosceles trapezoid has one, with the congruent sides as its legs." },
  { fact: md`$\angle A + \angle D = 180^\circ$`, yes: false, why: md`That only gives $\overline{AB} \parallel \overline{DC}$ (Same-Side Interior Angles Converse). A trapezoid fits.` },
];

const YES = "Yes, always";
const NO = "No, not necessarily";

const parallelogramTest: Generator = (r) => {
  const t = r.pick(TESTS);
  const right = t.yes ? YES : NO;
  return {
    prompt: md`In quadrilateral $ABCD$, ${t.fact}. Must $ABCD$ be a parallelogram?`,
    choices: shuffle(r, [YES, NO]),
    accept: [right],
    hint: "Is it one of the parallelogram tests, or can you prove both pairs of opposite sides parallel from it? If not, try to picture a trapezoid or a kite that fits.",
    solution: [{ math: t.yes ? md`\text{Yes}` : md`\text{No}`, note: t.why }],
  };
};

// ── Lesson 3: Rectangles, rhombuses and squares ─────────────────────────────

const RECT_EQUAL = [
  ["AC", "BD"],
  ["AE", "BE"],
  ["AE", "DE"],
  ["CE", "BE"],
  ["CE", "DE"],
] as const;
const RECT_HALF = [
  ["AE", "BD"],
  ["BE", "AC"],
  ["CE", "BD"],
  ["DE", "AC"],
] as const;

const rectangleDiagonals: Generator = (r) => {
  const kind = r.pick([0, 0, 0, 1, 1, 1, 2, 2]);
  const diag = md`the diagonals meet at $E$`;
  if (kind === 0) {
    const sub = r.int(0, 3);
    if (sub === 0) {
      const k = r.int(3, 15);
      const [half, whole] = r.pick(RECT_HALF);
      return {
        prompt: md`In rectangle $ABCD$, ${diag} and $${whole} = ${2 * k}$. Find $${half}$.`,
        answer: String(k),
        figure: quadFigure(scaledTo(RECT, whole, 2 * k), { diagonals: "halves", lengths: { [half]: "?" }, asked: half, angles: RIGHT_CORNERS }),
        verify: [`2y = ${2 * k}`],
        hint: "A rectangle's diagonals are congruent, and (as in any parallelogram) they bisect each other.",
        solution: [
          { math: md`AC = BD = ${2 * k}`, note: "The diagonals of a rectangle are congruent." },
          { math: md`${half} = \frac{${2 * k}}{2} = ${k}`, note: md`$E$ is the midpoint of each diagonal.` },
        ],
      };
    }
    let th = r.int(20, 70);
    while (th === 45) th = r.int(20, 70);
    const asked = sub === 1 ? "ABD" : sub === 2 ? "AEB" : "CAD";
    const ans = sub === 1 ? th : sub === 2 ? 180 - 2 * th : 90 - th;
    const iso: Step = { math: md`AE = BE`, note: md`The diagonals are congruent and bisect each other, so all four halves are equal: $\triangle ABE$ is isosceles.` };
    const steps: Step[] =
      sub === 1
        ? [iso, { math: md`\angle ABD = \angle BAC = ${th}^\circ`, note: md`Base angles of an isosceles triangle are congruent. ($\angle ABD$ is $\angle ABE$.)` }]
        : sub === 2
          ? [
              iso,
              { math: md`\angle ABE = ${th}^\circ`, note: "Base angles of an isosceles triangle are congruent." },
              { math: md`\angle AEB = 180^\circ - ${th}^\circ - ${th}^\circ = ${ans}^\circ`, note: "Triangle Angle Sum Theorem." },
            ]
          : [{ math: md`\angle CAD = 90^\circ - ${th}^\circ = ${ans}^\circ`, note: md`$\angle BAD = 90^\circ$, and by Angle Addition $\angle BAC + \angle CAD = \angle BAD$.` }];
    const askedAngle: FigAngle =
      sub === 1 ? { at: "B", from: "A", to: "D", label: "?", color: ASKED } : sub === 2 ? { at: "E", from: "A", to: "B", label: "?", color: ASKED } : { at: "A", from: "C", to: "D", label: "?", color: ASKED };
    return {
      prompt: md`In rectangle $ABCD$, ${diag}. Find $\angle ${asked}$. Give the angle in degrees.`,
      answer: String(ans),
      figure: quadFigure(rectPts(8 * Math.cos(rad(th)), 8 * Math.sin(rad(th))), {
        diagonals: "halves",
        angles: [{ at: "A", from: "B", to: "C", label: md`${th}^\circ` }, askedAngle, ...RIGHT_CORNERS.slice(2)],
        eSkip: sub === 2 ? [0] : [],
      }),
      verify: [sub === 1 ? `y = ${th}` : sub === 2 ? `y + 2 * ${th} = 180` : `y + ${th} = 90`],
      hint: sub === 3 ? md`Every angle of a rectangle is $90^\circ$.` : md`The halves of the diagonals are all equal, so $\triangle ABE$ is isosceles.`,
      solution: steps,
    };
  }
  const x = r.int(2, 10);
  const v = r.int(5, 20);
  const halfWhole = r.next() < 0.4;
  if (halfWhole) {
    const [H, W] = r.pick(RECT_HALF);
    const a1 = r.int(1, 3);
    let a2 = r.int(1, 6);
    while (a2 === 2 * a1) a2 = r.int(1, 6);
    const [b1, b2] = [v - a1 * x, 2 * v - a2 * x];
    const given = md`$${H} = ${lin(a1, b1)}$ and $${W} = ${lin(a2, b2)}$`;
    const eq = `2(${lin(a1, b1)}) = ${lin(a2, b2)}`;
    const figure = quadFigure(scaledTo(RECT, W, 2 * v), { diagonals: "halves", lengths: { [H]: lin(a1, b1) }, angles: RIGHT_CORNERS });
    const steps: Step[] = [
      { math: md`2(${lin(a1, b1)}) = ${lin(a2, b2)}`, note: md`The diagonals are congruent and bisect each other, so each half is half of either diagonal: $${W} = 2 \cdot ${H}$.` },
      { math: md`${lin(2 * a1, 2 * b1)} = ${lin(a2, b2)}`, note: "Distribute." },
      ...linearSteps(2 * a1, 2 * b1, a2, b2),
    ];
    if (kind === 1) {
      const solveForm = r.next() < 0.5;
      return {
        prompt: solveForm
          ? md`Solve $2(${lin(a1, b1)}) = ${lin(a2, b2)}$. In rectangle $ABCD$, ${diag}, ${given}; the equation says $${W}$ is twice $${H}$.`
          : md`In rectangle $ABCD$, ${diag} and $${W} = ${lin(a2, b2)}$. Find $x$.`,
        answer: String(x),
        ...(solveForm ? {} : { figure, verify: [eq] }),
        hint: md`$\overline{${H}}$ is half of one diagonal, and the diagonals are congruent.`,
        solution: steps,
      };
    }
    return {
      prompt: md`In rectangle $ABCD$, ${diag} and $${W} = ${lin(a2, b2)}$. Find $${W}$.`,
      answer: String(2 * v),
      figure,
      verify: [via(eq, xFrom(a2, b2))],
      hint: md`$\overline{${H}}$ is half of one diagonal, and the diagonals are congruent. Find $x$ first.`,
      solution: [...steps, { math: md`${W} = ${subst(a2, b2, x)} = ${2 * v}`, note: md`Substitute $x = ${x}$.` }],
    };
  }
  const [N1, N2] = shuffle(r, r.pick(RECT_EQUAL));
  const [a1, a2] = twoCoefs(r, 1, 5);
  const [b1, b2] = [v - a1 * x, v - a2 * x];
  const given = md`$${N1} = ${lin(a1, b1)}$ and $${N2} = ${lin(a2, b2)}$`;
  const whole = N1 === "AC" || N1 === "BD";
  const reason = whole ? "The diagonals of a rectangle are congruent." : "The diagonals are congruent and bisect each other, so all four halves are equal.";
  const steps: Step[] = [{ math: md`${lin(a1, b1)} = ${lin(a2, b2)}`, note: reason }, ...linearSteps(a1, b1, a2, b2)];
  const eq = `${lin(a1, b1)} = ${lin(a2, b2)}`;
  // Whole diagonals would be labelled right on top of E, so those stay in words.
  const figure = whole ? undefined : quadFigure(scaledTo(RECT, "AC", 2 * v), { diagonals: "halves", lengths: { [N1!]: lin(a1, b1), [N2!]: lin(a2, b2) }, angles: RIGHT_CORNERS });
  if (kind === 1) {
    const solveForm = r.next() < 0.5;
    return {
      prompt: solveForm
        ? md`Solve $${lin(a1, b1)} = ${lin(a2, b2)}$. In rectangle $ABCD$, ${diag}, ${given}, and these lengths are equal.`
        : figure
          ? md`In rectangle $ABCD$, ${diag}. Find $x$.`
          : md`In rectangle $ABCD$, ${diag}, ${given}. Find $x$.`,
      answer: String(x),
      ...(solveForm ? {} : { ...(figure ? { figure } : {}), verify: [eq] }),
      hint: whole ? "The diagonals of a rectangle are congruent." : "In a rectangle, all four halves of the diagonals are equal.",
      solution: steps,
    };
  }
  const W = whole ? "AC" : "BD";
  const ans = whole ? v : 2 * v;
  return {
    prompt: figure ? md`In rectangle $ABCD$, ${diag}. Find $${W}$.` : md`In rectangle $ABCD$, ${diag}, ${given}. Find $${W}$.`,
    answer: String(ans),
    ...(figure ? { figure } : {}),
    verify: [via(eq, xFrom(a1, b1, whole ? "y" : "y/2"))],
    hint: whole ? md`The diagonals are congruent. Find $x$ first.` : md`All four halves are equal. Find $x$ first; a whole diagonal is two halves.`,
    solution: [
      ...steps,
      { math: md`${N1} = ${subst(a1, b1, x)} = ${v}`, note: md`Substitute $x = ${x}$.` },
      ...(whole ? [] : [{ math: md`BD = 2 \cdot ${v} = ${2 * v}`, note: md`$E$ is the midpoint of $\overline{BD}$, and $BE = ${v}$ like every other half.` }]),
    ],
  };
};

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [9, 12, 15],
  [8, 15, 17],
  [12, 16, 20],
  [7, 24, 25],
  [15, 20, 25],
];

/** Rhombus with diagonal BD splitting the angle at B into halves of t degrees, labelled. */
const bisectedRhombus = (t: number, labels: Record<string, string>) =>
  quadFigure(withoutE(rhombusFromAngle(5, t)), {
    marks: RHOMBUS_SIDES,
    diagonals: ["BD"],
    angles: [
      { at: "B", from: "A", to: "D", label: labels.ABD! },
      { at: "B", from: "C", to: "D", label: labels.CBD! },
    ],
  });

const rhombusFacts: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 2, 2]);
  if (kind === 0) {
    const [t0, t1, side] = r.pick(TRIPLES);
    const [p, q] = r.next() < 0.5 ? [t0, t1] : [t1, t0];
    const sub = r.int(0, 2);
    const pyth: Step = { math: md`AB^2 = ${p}^2 + ${q}^2 = ${p * p + q * q}`, note: md`$\triangle ABE$ has a right angle at $E$ (the diagonals are perpendicular). Pythagorean Theorem.` };
    const shape = rhombusPts(p, q);
    if (sub === 0) {
      return {
        prompt: md`The diagonals of rhombus $ABCD$ meet at $E$, with $AC = ${2 * p}$ and $BD = ${2 * q}$. Find $AB$.`,
        answer: String(side),
        figure: quadFigure(shape, { marks: RHOMBUS_SIDES, diagonals: ["AC", "BD"], lengths: { AB: "?" }, asked: "AB" }),
        verify: [`y^2 = (${2 * p}/2)^2 + (${2 * q}/2)^2`],
        hint: "The diagonals bisect each other at right angles, so they cut the rhombus into four right triangles.",
        solution: [
          { math: md`AE = ${p}, \quad BE = ${q}`, note: "The diagonals bisect each other." },
          pyth,
          { math: md`AB = \sqrt{${p * p + q * q}} = ${side}`, note: "" },
        ],
      };
    }
    if (sub === 1) {
      return {
        prompt: md`Rhombus $ABCD$ has side length ${side}, and diagonal $AC = ${2 * p}$. Find the length of the other diagonal, $BD$.`,
        answer: String(2 * q),
        figure: quadFigure(withoutE(shape), { marks: RHOMBUS_SIDES, diagonals: ["AC", "BD"], lengths: { AB: String(side) }, asked: "BD" }),
        verify: [`(${2 * p}/2)^2 + (y/2)^2 = ${side}^2`],
        hint: md`Half of each diagonal and a side form a right triangle.`,
        solution: [
          { math: md`AE = ${p}`, note: md`The diagonals bisect each other at $E$.` },
          { math: md`BE^2 = ${side}^2 - ${p}^2 = ${side * side - p * p}`, note: md`$\triangle ABE$ has a right angle at $E$. Pythagorean Theorem.` },
          { math: md`BE = ${q}, \quad BD = 2 \cdot ${q} = ${2 * q}`, note: md`$E$ is the midpoint of $\overline{BD}$.` },
        ],
      };
    }
    return {
      prompt: md`The diagonals of rhombus $ABCD$ have lengths $${2 * p}$ and $${2 * q}$. Find its perimeter.`,
      answer: String(4 * side),
      figure: quadFigure(withoutE(shape), { marks: RHOMBUS_SIDES, diagonals: ["AC", "BD"] }),
      verify: [`(y/4)^2 = (${2 * p}/2)^2 + (${2 * q}/2)^2`],
      hint: "Find one side from a right triangle made by half-diagonals. All four sides are equal.",
      solution: [
        { math: md`${p}^2 + ${q}^2 = ${p * p + q * q} = ${side}^2`, note: "The half-diagonals are legs of a right triangle whose hypotenuse is a side." },
        { math: md`4 \cdot ${side} = ${4 * side}`, note: "A rhombus has four congruent sides." },
      ],
    };
  }
  if (kind === 1) {
    let t = r.int(20, 70);
    while (t === 45) t = r.int(20, 70);
    const sub = r.int(0, 3);
    const asked = ["ABD", "BAC", "BAD", "BCA"][sub]!;
    const ans = [t, 90 - t, 180 - 2 * t, 90 - t][sub]!;
    const steps: Step[] =
      sub === 0
        ? [{ math: md`\angle ABD = \frac{${2 * t}^\circ}{2} = ${t}^\circ`, note: md`Each diagonal of a rhombus bisects the angles at its ends.` }]
        : sub === 2
          ? [{ math: md`\angle BAD = 180^\circ - ${2 * t}^\circ = ${ans}^\circ`, note: "Consecutive angles of a parallelogram are supplementary." }]
          : [
              { math: md`\angle ABE = ${t}^\circ`, note: md`Diagonal $\overline{BD}$ bisects $\angle ABC$.` },
              { math: md`\angle AEB = 90^\circ`, note: "The diagonals of a rhombus are perpendicular." },
              sub === 1
                ? { math: md`\angle BAC = 180^\circ - 90^\circ - ${t}^\circ = ${ans}^\circ`, note: md`Triangle Angle Sum in $\triangle ABE$.` }
                : { math: md`\angle BCA = \angle BAC = 180^\circ - 90^\circ - ${t}^\circ = ${ans}^\circ`, note: md`Triangle Angle Sum in $\triangle ABE$; and $\triangle ABC$ is isosceles ($AB = BC$), so its base angles match.` },
            ];
    const angles: FigAngle[] = [
      sub === 0 ? { at: "B", from: "A", to: "D", label: "?", color: ASKED } : corner("B", md`${2 * t}^\circ`),
      ...(sub === 1 ? [{ at: "A", from: "B", to: "C", label: "?", color: ASKED }] : sub === 2 ? [corner("A", "?", true)] : sub === 3 ? [{ at: "C", from: "B", to: "A", label: "?", color: ASKED }] : []),
    ];
    return {
      prompt: sub === 0 ? md`In rhombus $ABCD$, $\angle ABC = ${2 * t}^\circ$. Find $\angle ${asked}$. Give the angle in degrees.` : md`Find $\angle ${asked}$ in rhombus $ABCD$. Give the angle in degrees.`,
      answer: String(ans),
      figure: quadFigure(withoutE(rhombusFromAngle(5, t)), { marks: RHOMBUS_SIDES, diagonals: sub === 0 ? ["BD"] : sub === 2 ? [] : ["AC"], angles }),
      verify: [sub === 0 ? `2y = ${2 * t}` : sub === 2 ? `y + ${2 * t} = 180` : `y + 90 + ${2 * t}/2 = 180`],
      hint: "The diagonals of a rhombus are perpendicular, and each one bisects two angles of the rhombus.",
      solution: steps,
    };
  }
  const x = r.int(2, 12);
  const [a1, a2] = twoCoefs(r, 1, 5);
  const bisect = r.next() < 0.4;
  const v = bisect ? r.int(20, 70) : r.int(5, 25);
  const [b1, b2] = [v - a1 * x, v - a2 * x];
  const [N1, N2] = bisect ? shuffle(r, ["ABD", "CBD"]) : shuffle(r, ["AB", "BC", "CD", "DA"]).slice(0, 2);
  const given = bisect ? md`$\angle ${N1} = ${degX(a1, b1)}$ and $\angle ${N2} = ${degX(a2, b2)}$` : md`$${N1} = ${lin(a1, b1)}$ and $${N2} = ${lin(a2, b2)}$`;
  const reason = bisect ? md`Diagonal $\overline{BD}$ bisects $\angle ABC$.` : "All four sides of a rhombus are congruent.";
  const solveForm = r.next() < 0.5;
  return {
    prompt: solveForm ? md`Solve $${lin(a1, b1)} = ${lin(a2, b2)}$. In rhombus $ABCD$, ${given}, and these are equal.` : md`Find $x$ in rhombus $ABCD$.`,
    answer: String(x),
    ...(solveForm ? {} : { figure: bisect ? bisectedRhombus(v, { [N1!]: degX(a1, b1), [N2!]: degX(a2, b2) }) : quadFigure(scalePts(withoutE(rhombusFromAngle(1, 35)), v), { marks: RHOMBUS_SIDES, lengths: { [N1!]: lin(a1, b1), [N2!]: lin(a2, b2) } }), verify: [`${lin(a1, b1)} = ${lin(a2, b2)}`] }),
    hint: bisect ? "Each diagonal of a rhombus bisects the angles at its ends." : "A rhombus has four congruent sides.",
    solution: [{ math: md`${lin(a1, b1)} = ${lin(a2, b2)}`, note: reason }, ...linearSteps(a1, b1, a2, b2)],
  };
};

const SHAPES = ["parallelogram", "rectangle", "rhombus", "square"] as const;
type Shape = (typeof SHAPES)[number];

const CLASSIFY_FACTS: { fact: string; shape: Shape; why: string }[] = [
  { fact: "A parallelogram has one right angle.", shape: "rectangle", why: md`Consecutive angles are supplementary and opposite angles are congruent, so one right angle makes all four $90^\circ$.` },
  { fact: "A parallelogram has congruent diagonals.", shape: "rectangle", why: "A parallelogram with congruent diagonals is a rectangle (SSS gives congruent consecutive angles, which are also supplementary)." },
  { fact: "A parallelogram has perpendicular diagonals.", shape: "rhombus", why: "A parallelogram with perpendicular diagonals is a rhombus (SAS gives two consecutive sides congruent)." },
  { fact: "A parallelogram has two consecutive sides congruent.", shape: "rhombus", why: "Opposite sides are congruent too, so all four sides are equal." },
  { fact: "A diagonal of a parallelogram bisects two of its angles.", shape: "rhombus", why: md`If $\overline{AC}$ bisects $\angle A$, then $\angle BAC = \angle DAC = \angle BCA$ (alternate interior angles), so $\triangle ABC$ is isosceles with $AB = BC$.` },
  { fact: "A rectangle has perpendicular diagonals.", shape: "square", why: "Perpendicular diagonals make it a rhombus as well, and a rectangle that is a rhombus is a square." },
  { fact: "A rhombus has a right angle.", shape: "square", why: "A right angle makes the parallelogram a rectangle as well, and a rhombus that is a rectangle is a square." },
  { fact: "A rhombus has congruent diagonals.", shape: "square", why: "Congruent diagonals make it a rectangle as well." },
  { fact: "A rectangle has two consecutive sides congruent.", shape: "square", why: "Opposite sides are congruent too, so all four sides are equal and all four angles are right." },
  { fact: "A parallelogram has diagonals that are congruent and perpendicular.", shape: "square", why: "Congruent diagonals make it a rectangle; perpendicular diagonals make it a rhombus. Both together is a square." },
  { fact: md`A parallelogram has diagonals of lengths 10 and 14 that cross at a $60^\circ$ angle.`, shape: "parallelogram", why: "The diagonals are neither congruent nor perpendicular, so it is neither a rectangle nor a rhombus." },
  { fact: md`A parallelogram has sides of lengths 5 and 8 and an angle of $70^\circ$.`, shape: "parallelogram", why: "Consecutive sides differ, so it isn't a rhombus, and no angle is right, so it isn't a rectangle." },
];

/** Integer vector pairs of equal length that are neither perpendicular nor parallel. */
const RHOMBUS_CLASSES: [number, number][][] = [
  [[5, 0], [3, 4], [4, 3], [0, 5], [-3, 4]],
  [[3, 1], [1, 3], [-1, 3]],
  [[3, 2], [2, 3], [-2, 3]],
  [[4, 1], [1, 4], [-1, 4]],
];

function quadVectors(r: Rng, shape: Shape): [[number, number], [number, number]] {
  const cross = (u: [number, number], v: [number, number]) => u[0] * v[1] - u[1] * v[0];
  const dot = (u: [number, number], v: [number, number]) => u[0] * v[0] + u[1] * v[1];
  const len2 = (u: [number, number]) => dot(u, u);
  for (;;) {
    let u: [number, number];
    let v: [number, number];
    if (shape === "square" || shape === "rectangle") {
      u = [r.int(1, 4), r.int(0, 3)];
      const k = shape === "square" ? 1 : r.pick([2, 3]);
      v = [-u[1] * k, u[0] * k];
      if (shape === "rectangle" && r.next() < 0.5) [u, v] = [v, [-u[0], -u[1]]];
    } else if (shape === "rhombus") {
      const cls = r.pick(RHOMBUS_CLASSES);
      [u, v] = shuffle(r, cls).slice(0, 2) as [[number, number], [number, number]];
    } else {
      u = [r.int(2, 6), r.int(-1, 2)];
      v = [r.int(-2, 3), r.int(2, 5)];
    }
    if (cross(u, v) < 0) [u, v] = [v, u];
    const perp = dot(u, v) === 0;
    const same = len2(u) === len2(v);
    const ok = cross(u, v) !== 0 && (shape === "square" ? perp && same : shape === "rectangle" ? perp && !same : shape === "rhombus" ? same && !perp : !same && !perp);
    if (ok && len2(u) >= 5 && len2(v) >= 5) return [u, v];
  }
}

const classifyParallelogram: Generator = (r) => {
  if (r.next() < 0.5) {
    const f = r.pick(CLASSIFY_FACTS);
    return {
      prompt: md`${f.fact} What is the most specific name for it?`,
      choices: shuffle(r, SHAPES),
      accept: [f.shape],
      hint: "Rectangle: right angles, congruent diagonals. Rhombus: equal sides, perpendicular diagonals. Square: both.",
      solution: [{ math: md`\text{${f.shape}}`, note: f.why }],
    };
  }
  const shape = r.pick(SHAPES);
  const [u, v] = quadVectors(r, shape);
  const A: [number, number] = [r.int(-3, 1), r.int(-3, 1)];
  const B: [number, number] = [A[0] + u[0], A[1] + u[1]];
  const C: [number, number] = [B[0] + v[0], B[1] + v[1]];
  const D: [number, number] = [A[0] + v[0], A[1] + v[1]];
  const pt = (n: string, p: [number, number]) => md`$${n}(${p[0]}, ${p[1]})$`;
  const d2 = (p: [number, number], q: [number, number]) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
  const sq = (p: [number, number], q: [number, number]) => md`(${q[0]} - ${paren(p[0])})^2 + (${q[1]} - ${paren(p[1])})^2 = ${d2(p, q)}`;
  const sameSides = d2(A, B) === d2(B, C);
  const sameDiags = d2(A, C) === d2(B, D);
  return {
    prompt: md`A parallelogram has vertices ${pt("A", A)}, ${pt("B", B)}, ${pt("C", C)} and ${pt("D", D)}. What is the most specific name for it?`,
    choices: shuffle(r, SHAPES),
    accept: [shape],
    hint: "Compare two consecutive sides (equal means rhombus) and the two diagonals (equal means rectangle). Squared lengths from the Distance Formula are enough.",
    solution: [
      { math: md`AB^2 = ${sq(A, B)}, \quad BC^2 = ${sq(B, C)}`, note: sameSides ? "Consecutive sides are equal, so all four sides are: it is a rhombus." : "Consecutive sides differ, so it isn't a rhombus." },
      { math: md`AC^2 = ${sq(A, C)}, \quad BD^2 = ${sq(B, D)}`, note: sameDiags ? "The diagonals are congruent, so it is a rectangle." : "The diagonals differ, so it isn't a rectangle." },
      { math: md`\text{${shape}}`, note: shape === "square" ? "Both a rhombus and a rectangle: a square." : shape === "parallelogram" ? "Neither, so the most specific name is parallelogram." : "" },
    ],
  };
};

// ── Lesson 4: Trapezoids and kites ──────────────────────────────────────────

const TRAP = md`Trapezoid $ABCD$ has bases $\overline{AB}$ and $\overline{DC}$, and $\overline{MN}$ is its midsegment`;

/** Trapezoid with bases AB = b1 (below) and DC = b2 (above), drawn to scale, and its midsegment MN. */
function midsegmentFigure(b1: number, b2: number, labels: { AB?: string; DC?: string; MN?: string }, asked?: "DC" | "MN"): DiagramFig {
  const h = 0.4 * Math.max(b1, b2);
  const off = (b1 - b2) / 2 + (0.12 * (b1 + b2)) / 2;
  const q: Quad = { A: [0, 0], B: [b1, 0], C: [off + b2, h], D: [off, h] };
  const c = midPt(midPt(q.A, q.C), midPt(q.B, q.D));
  /** The side of leg pq facing away from the middle, for the label of its midpoint. */
  const outward = (p: Pt, r: Pt): Dir => {
    const n: Pt = [r[1] - p[1], p[0] - r[0]];
    const m = midPt(p, r);
    return dirOf((m[0] - c[0]) * n[0] + (m[1] - c[1]) * n[1] > 0 ? n : [-n[0], -n[1]]);
  };
  const mark = (name: "AB" | "DC" | "MN", extra: Partial<FigSeg>): FigSeg => seg(name, labels[name], { ...extra, ...(name === asked ? { color: ASKED } : {}) });
  return diagram(
    { ...q, M: midPt(q.A, q.D), N: midPt(q.B, q.C) },
    {
      outline: ["A", "B", "C", "D"],
      segments: [
        mark("AB", { parallel: 1 }),
        mark("DC", { parallel: 1 }),
        seg("AM", undefined, { ticks: 1 }),
        seg("MD", undefined, { ticks: 1 }),
        seg("BN", undefined, { ticks: 2 }),
        seg("NC", undefined, { ticks: 2 }),
        mark("MN", {}),
      ],
      dirs: { M: outward(q.A, q.D), N: outward(q.B, q.C) },
    },
  );
}

const trapezoidMidsegment: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 2, 2, 2]);
  let b1 = r.int(6, 24);
  let b2 = r.int(4, 20);
  while (b2 === b1 || (b1 + b2) % 2) b2 = r.int(4, 20);
  if (r.next() < 0.5) [b1, b2] = [b2, b1];
  const m = (b1 + b2) / 2;
  if (kind === 0) {
    return {
      prompt: md`${TRAP}. Find $MN$.`,
      answer: String(m),
      figure: midsegmentFigure(b1, b2, { AB: String(b1), DC: String(b2), MN: "?" }, "MN"),
      verify: [`y = (${b1} + ${b2})/2`],
      hint: "The midsegment of a trapezoid is the average of the two bases.",
      solution: [{ math: md`MN = \frac{${b1} + ${b2}}{2} = \frac{${b1 + b2}}{2} = ${m}`, note: "Trapezoid Midsegment Theorem." }],
    };
  }
  if (kind === 1) {
    const solveForm = r.next() < 0.5;
    return {
      prompt: solveForm ? md`Solve $\frac{${b1} + x}{2} = ${m}$ to find the base $x = DC$. ${TRAP}, with $MN = ${m}$ and $AB = ${b1}$.` : md`${TRAP}. Find $DC$.`,
      answer: String(b2),
      ...(solveForm ? {} : { figure: midsegmentFigure(b1, b2, { AB: String(b1), DC: "?", MN: String(m) }, "DC"), verify: [`(${b1} + y)/2 = ${m}`] }),
      hint: "The midsegment is the average of the bases, so the two bases add up to twice the midsegment.",
      solution: [
        { math: md`\frac{${b1} + DC}{2} = ${m}`, note: "Trapezoid Midsegment Theorem." },
        { math: md`${b1} + DC = ${2 * m}`, note: "Multiply both sides by 2." },
        { math: md`DC = ${b2}`, note: md`Subtract ${b1}.` },
      ],
    };
  }
  const x = r.int(2, 9);
  let [a1, a2, a3] = [r.int(1, 4), r.int(1, 4), r.int(0, 3)];
  while (a1 + a2 === 2 * a3) a3 = r.int(0, 3);
  const [c1, c2, c3] = [b1 - a1 * x, b2 - a2 * x, m - a3 * x];
  const M3 = lin(a3, c3);
  const given = md`$AB = ${lin(a1, c1)}$, $DC = ${lin(a2, c2)}$ and $MN = ${M3}$`;
  const eq = md`\frac{${term(a1, c1)} + ${term(a2, c2)}}{2} = ${M3}`;
  const solveForm = r.next() < 0.5;
  return {
    prompt: solveForm ? md`Solve $${eq}$. ${TRAP}, with ${given}.` : md`${TRAP}. Find $x$.`,
    answer: String(x),
    ...(solveForm
      ? {}
      : { figure: midsegmentFigure(b1, b2, { AB: lin(a1, c1), DC: lin(a2, c2), MN: M3 }), verify: [`(${term(a1, c1)} + ${term(a2, c2)})/2 = ${M3}`] }),
    hint: "The midsegment is the average of the bases. Set it up, then multiply both sides by 2.",
    solution: [
      { math: eq, note: "Trapezoid Midsegment Theorem." },
      { math: md`${lin(a1 + a2, c1 + c2)} = ${lin(2 * a3, 2 * c3)}`, note: "Multiply both sides by 2 and combine like terms." },
      ...linearSteps(a1 + a2, c1 + c2, 2 * a3, 2 * c3),
    ],
  };
};

/** Quadrilateral ABCD with corner labels; "?" marks the asked corner. */
const cornersFigure = (pts: Quad, marks: FigSeg[], labels: Record<string, string>) =>
  quadFigure(pts, { marks, angles: Object.entries(labels).map(([v, l]) => corner(v, l, l === "?")) });

const trapezoidKiteAngles: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 2, 2, 3, 3, 3]);
  if (kind === 0) {
    const a = 5 * r.int(8, 17);
    const g = r.int(0, 3);
    const q = (g + r.int(1, 3)) % 4;
    const val = (i: number) => (i < 2 ? a : 180 - a);
    const [G, Q] = [V[g]!, V[q]!];
    const legPartner: Record<string, string> = { A: "D", D: "A", B: "C", C: "B" };
    const P = legPartner[Q]!;
    const sameBase = (g < 2) === (q < 2);
    const solution: Step[] = sameBase
      ? [{ math: md`\angle ${Q} = \angle ${G} = ${val(q)}^\circ`, note: md`$\angle ${G}$ and $\angle ${Q}$ are the base angles of one base, and those are congruent.` }]
      : P === G
        ? [
            { math: md`\angle ${G} + \angle ${Q} = 180^\circ`, note: md`They lie along leg $\overline{${G < Q ? G + Q : Q + G}}$: same-side interior angles between the parallel bases.` },
            { math: md`\angle ${Q} = 180^\circ - ${val(g)}^\circ = ${val(q)}^\circ`, note: "" },
          ]
        : [
            { math: md`\angle ${P} = \angle ${G} = ${val(g)}^\circ`, note: md`$\angle ${P}$ and $\angle ${G}$ are the base angles of one base.` },
            { math: md`\angle ${Q} = 180^\circ - ${val(g)}^\circ = ${val(q)}^\circ`, note: md`$\angle ${P}$ and $\angle ${Q}$ lie along a leg, so they are supplementary.` },
          ];
    return {
      prompt: md`Isosceles trapezoid $ABCD$ has bases $\overline{AB}$ and $\overline{DC}$, with $\overline{AB}$ the longer one. Find $\angle ${Q}$. Give the angle in degrees.`,
      answer: String(val(q)),
      figure: cornersFigure(trapezoidPts(a, a), [...PARALLEL_BASES, ...EQUAL_LEGS], { [G]: md`${val(g)}^\circ`, [Q]: "?" }),
      verify: [sameBase ? `y = ${val(g)}` : `y + ${val(g)} = 180`],
      hint: md`Base angles of an isosceles trapezoid are congruent, and two angles along a leg add to $180^\circ$.`,
      solution,
    };
  }
  if (kind === 1) {
    const [a, b] = shuffle(r, ANGLES).slice(0, 2) as [number, number];
    const askD = r.next() < 0.5;
    return {
      prompt: md`In trapezoid $ABCD$, $\overline{AB} \parallel \overline{DC}$. Find $\angle ${askD ? "D" : "C"}$. Give the angle in degrees.`,
      answer: String(askD ? 180 - a : 180 - b),
      figure: cornersFigure(trapezoidPts(a, b), PARALLEL_BASES, { A: md`${a}^\circ`, B: md`${b}^\circ`, [askD ? "D" : "C"]: "?" }),
      verify: [`y + ${askD ? a : b} = 180`],
      hint: md`Each leg is a transversal of the parallel bases. Which given angle shares a leg with $\angle ${askD ? "D" : "C"}$?`,
      solution: [
        {
          math: askD ? md`\angle A + \angle D = 180^\circ` : md`\angle B + \angle C = 180^\circ`,
          note: md`Same-Side Interior Angles Theorem, with leg $\overline{${askD ? "AD" : "BC"}}$ as the transversal.`,
        },
        { math: md`\angle ${askD ? "D" : "C"} = 180^\circ - ${askD ? a : b}^\circ = ${askD ? 180 - a : 180 - b}^\circ`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    let a = 5 * r.int(8, 24);
    let c = 5 * r.int(8, 24);
    while ((a + c) % 10 !== 0 || a === c) c = 5 * r.int(8, 24);
    if (r.next() < 0.5) [a, c] = [c, a];
    const b = (360 - a - c) / 2;
    const solveForm = r.next() < 0.5;
    return {
      prompt: solveForm
        ? md`Solve $${a} + ${c} + 2x = 360$ to find $x = \angle B$ in degrees. Kite $ABCD$ has $\overline{AB} \cong \overline{AD}$ and $\overline{CB} \cong \overline{CD}$, with $\angle A = ${a}^\circ$, $\angle C = ${c}^\circ$, and $\angle B \cong \angle D$.`
        : md`Kite $ABCD$ has $\overline{AB} \cong \overline{AD}$ and $\overline{CB} \cong \overline{CD}$. Find $\angle B$. Give the angle in degrees.`,
      answer: String(b),
      ...(solveForm ? {} : { figure: cornersFigure(withoutE(kiteFromAngles(a, c)), KITE_SIDES, { A: md`${a}^\circ`, C: md`${c}^\circ`, B: "?" }), verify: [`${a} + ${c} + 2y = 360`] }),
      hint: md`In this kite, $\angle B$ and $\angle D$ are the congruent pair. All four angles add to $360^\circ$.`,
      solution: [
        { math: md`\angle B = \angle D`, note: md`$\triangle ABC \cong \triangle ADC$ by SSS, so the angles between the unequal sides match.` },
        { math: md`2\angle B = 360^\circ - ${a}^\circ - ${c}^\circ = ${360 - a - c}^\circ`, note: md`A quadrilateral's angles add to $360^\circ$.` },
        { math: md`\angle B = ${b}^\circ`, note: "Divide by 2." },
      ],
    };
  }
  const type = r.pick(["iso", "trap", "kite"] as const);
  const x = r.int(4, 20);
  const v1 = type === "kite" ? 5 * r.int(14, 26) : r.pick(ANGLES);
  const equal = type !== "trap";
  const v2 = equal ? v1 : 180 - v1;
  const [a1, a2] = equal ? twoCoefs(r, 1, 4) : [r.int(1, 4), r.int(1, 4)];
  const [b1, b2] = [v1 - a1 * x, v2 - a2 * x];
  const [N1, N2] = type === "iso" ? shuffle(r, ["A", "B"]) : type === "kite" ? shuffle(r, ["B", "D"]) : ["A", "D"];
  const setting =
    type === "iso"
      ? md`Isosceles trapezoid $ABCD$ has bases $\overline{AB}$ and $\overline{DC}$`
      : type === "trap"
        ? md`In trapezoid $ABCD$, $\overline{AB} \parallel \overline{DC}$`
        : md`Kite $ABCD$ has $\overline{AB} \cong \overline{AD}$ and $\overline{CB} \cong \overline{CD}$`;
  const given = md`$\angle ${N1} = ${degX(a1, b1)}$ and $\angle ${N2} = ${degX(a2, b2)}$`;
  const eq = equal ? md`${lin(a1, b1)} = ${lin(a2, b2)}` : md`${term(a1, b1)} + ${term(a2, b2)} = 180`;
  const reason = type === "iso" ? "Base angles of an isosceles trapezoid are congruent." : type === "kite" ? md`In this kite, $\angle B \cong \angle D$ (SSS on diagonal $\overline{AC}$).` : md`$\angle A$ and $\angle D$ are same-side interior angles along leg $\overline{AD}$, so they are supplementary.`;
  const steps: Step[] = equal
    ? [{ math: eq, note: reason }, ...linearSteps(a1, b1, a2, b2)]
    : [{ math: eq, note: reason }, { math: md`${lin(a1 + a2, b1 + b2)} = 180`, note: "Combine like terms." }, ...linearSteps(a1 + a2, b1 + b2, 0, 180)];
  const solveForm = r.next() < 0.5;
  const labels = { [N1!]: degX(a1, b1), [N2!]: degX(a2, b2) };
  // Drawn to scale at the answer. The kite's two other angles share what is left, unevenly so it isn't a rhombus.
  // A short base, or a tall kite, can leave two wide labels no room; then a longer base or a kite on its side.
  const kite = withoutE(kiteFromAngles(180 - v1 - 20, 180 - v1 + 20));
  const figure =
    type === "iso"
      ? roomiest([3, 4.5, 6].map((min) => () => cornersFigure(trapezoidPts(v1, v1, 3, min), [...PARALLEL_BASES, ...EQUAL_LEGS], labels)))
      : type === "trap"
        ? roomiest([3, 4.5, 6].map((min) => () => cornersFigure(trapezoidPts(v1, v1 < 90 ? v1 + 25 : v1 - 25, 3, min), PARALLEL_BASES, labels)))
        : roomiest([kite, sideways(kite)].map((k) => () => cornersFigure(k, KITE_SIDES, labels)));
  return {
    prompt: solveForm ? md`Solve $${eq}$. ${setting}, with ${given}.` : md`${setting}. Find $x$.`,
    answer: String(x),
    ...(solveForm ? {} : { figure, verify: [eq] }),
    hint: type === "trap" ? "Two angles along a leg of a trapezoid are supplementary." : type === "iso" ? "Base angles of an isosceles trapezoid are congruent." : "Which two angles of a kite are congruent?",
    solution: steps,
  };
};

/** Pythagorean triples grouped by a shared leg q: q -> other legs p with p^2 + q^2 a perfect square. */
const SHARED_LEG: [number, number[]][] = [
  [12, [5, 9, 16]],
  [8, [6, 15]],
  [24, [7, 10, 18]],
  [16, [12, 30]],
  [20, [15, 21]],
  [15, [8, 20]],
];

const kiteAndTrapezoidLengths: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 2, 2]);
  const kite = md`Kite $ABCD$ has $\overline{AB} \cong \overline{AD}$ and $\overline{CB} \cong \overline{CD}$, and its diagonals meet at $E$`;
  if (kind === 0) {
    const [q, ps] = r.pick(SHARED_LEG);
    const p = r.pick(ps);
    const h = Math.hypot(p, q);
    return {
      prompt: md`${kite}. If $BD = ${2 * q}$, find $AB$.`,
      answer: String(h),
      // CE isn't given, so any length there is true to the problem.
      figure: quadFigure(kitePts(p, p + q, q), { marks: KITE_SIDES, diagonals: ["AE", "CE", "BD"], lengths: { AE: String(p), AB: "?" }, asked: "AB", eSkip: [0, 3] }),
      verify: [`y^2 = ${p}^2 + (${2 * q}/2)^2`],
      hint: md`Diagonal $\overline{AC}$ is perpendicular to $\overline{BD}$ and cuts it in half.`,
      solution: [
        { math: md`BE = \frac{${2 * q}}{2} = ${q}`, note: md`In a kite, the diagonal between the vertices with congruent sides bisects the other diagonal.` },
        { math: md`AB^2 = ${p}^2 + ${q}^2 = ${p * p + q * q}`, note: md`$\angle AEB = 90^\circ$ because the diagonals are perpendicular. Pythagorean Theorem.` },
        { math: md`AB = ${h}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const [q, ps] = r.pick(SHARED_LEG);
    const [p1, p2] = shuffle(r, ps).slice(0, 2) as [number, number];
    const [h1, h2] = [Math.hypot(p1, q), Math.hypot(p2, q)];
    return {
      prompt: md`${kite}. If $BD = ${2 * q}$, find $AC$.`,
      answer: String(p1 + p2),
      figure: quadFigure(kitePts(p1, p2, q), { marks: KITE_SIDES, diagonals: ["AC", "BD"], lengths: { AB: String(h1), CB: String(h2) } }),
      verify: [`y = sqrt(${h1}^2 - (${2 * q}/2)^2) + sqrt(${h2}^2 - (${2 * q}/2)^2)`],
      hint: md`$E$ splits $\overline{AC}$ into $AE$ and $CE$. Each is a leg of a right triangle with hypotenuse a side of the kite.`,
      solution: [
        { math: md`BE = ${q}`, note: md`Diagonal $\overline{AC}$ bisects $\overline{BD}$ at a right angle.` },
        { math: md`AE = \sqrt{${h1}^2 - ${q}^2} = \sqrt{${h1 * h1 - q * q}} = ${p1}`, note: md`Pythagorean Theorem in right triangle $ABE$.` },
        { math: md`CE = \sqrt{${h2}^2 - ${q}^2} = \sqrt{${h2 * h2 - q * q}} = ${p2}`, note: md`Pythagorean Theorem in right triangle $CBE$.` },
        { math: md`AC = ${p1} + ${p2} = ${p1 + p2}`, note: "Segment Addition Postulate." },
      ],
    };
  }
  const x = r.int(2, 10);
  const v = r.int(8, 30);
  const [a1, a2] = twoCoefs(r, 1, 5);
  const [b1, b2] = [v - a1 * x, v - a2 * x];
  const [N1, N2] = shuffle(r, ["AC", "BD"]);
  const setting = md`Isosceles trapezoid $ABCD$ has bases $\overline{AB}$ and $\overline{DC}$, $${N1} = ${lin(a1, b1)}$ and $${N2} = ${lin(a2, b2)}$`;
  const steps: Step[] = [{ math: md`${lin(a1, b1)} = ${lin(a2, b2)}`, note: "The diagonals of an isosceles trapezoid are congruent." }, ...linearSteps(a1, b1, a2, b2)];
  const eq = `${lin(a1, b1)} = ${lin(a2, b2)}`;
  const shape = scaledTo(trapezoidPts(65, 65), "AC", v);
  const figure = quadFigure(shape, { marks: [...PARALLEL_BASES, ...EQUAL_LEGS], diagonals: ["AC", "BD"] });
  // At their midpoints the two diagonal labels would sit by the crossing, where either diagonal could own them.
  // Put each one low on its own diagonal instead, on the side facing the longer base.
  const unit = pxPerUnit(figure.view);
  figure.labels = (["AC", "BD"] as const).map((d) => {
    const [p, q] = [shape[d[0] as "A" | "B"], shape[d[1] as "C" | "D"]];
    const text = d === N1 ? lin(a1, b1) : lin(a2, b2);
    const t = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const off = ((labelBox(text)[0] / 2) * Math.abs(Math.sin(t)) + 13) / unit;
    const at: Pt = [p[0] + 0.3 * (q[0] - p[0]), p[1] + 0.3 * (q[1] - p[1])];
    return { x: r3(at[0] + (d === "AC" ? 1 : -1) * off * Math.sin(t)), y: r3(at[1] - (d === "AC" ? 1 : -1) * off * Math.cos(t)), text };
  });
  const iso = md`Isosceles trapezoid $ABCD$ has bases $\overline{AB}$ and $\overline{DC}$`;
  if (r.next() < 0.5) {
    const solveForm = r.next() < 0.6;
    return {
      prompt: solveForm ? md`Solve $${lin(a1, b1)} = ${lin(a2, b2)}$. ${setting}, and these diagonals are congruent.` : md`${iso}. Find $x$.`,
      answer: String(x),
      ...(solveForm ? {} : { figure, verify: [eq] }),
      hint: "The diagonals of an isosceles trapezoid are congruent.",
      solution: steps,
    };
  }
  return {
    prompt: md`${iso}. Find $${N1}$.`,
    answer: String(v),
    figure,
    verify: [via(eq, xFrom(a1, b1))],
    hint: md`The diagonals of an isosceles trapezoid are congruent. Find $x$ first.`,
    solution: [...steps, { math: md`${N1} = ${subst(a1, b1, x)} = ${v}`, note: md`Substitute $x = ${x}$.` }],
  };
};

// ── Diagrams ────────────────────────────────────────────────────────────────

type Diagram = Extract<Block, { kind: "diagram" }>;
const num = (v: number) => Number(v.toFixed(3));
const plus = (v: number) => (v < 0 ? ` - ${num(-v)}` : ` + ${num(v)}`);

/** A convex pentagon that shrinks toward a point, with its exterior angles marked. */
function shrinkingPentagon(): Diagram {
  const verts: [string, number, number, "sw" | "se" | "e" | "n" | "w"][] = [
    ["A", 0, 0, "sw"],
    ["B", 5, 0, "se"],
    ["C", 6.5, 3, "e"],
    ["D", 3, 5.5, "n"],
    ["E", -1, 3, "w"],
  ];
  const [ox, oy] = [2.7, 2.3];
  const points: NonNullable<Diagram["points"]> = [];
  const segments: NonNullable<Diagram["segments"]> = [];
  const angles: NonNullable<Diagram["angles"]> = [];
  const colors = [1, 2, 3, 4, 3] as const;
  verts.forEach(([n, x, y, dir]) => points.push({ name: n, x: `${ox} + s*(${num(x - ox)})`, y: `${oy} + s*(${num(y - oy)})`, dir }));
  verts.forEach(([, x, y], i) => {
    const [n2, x2, y2] = verts[(i + 1) % 5]!;
    const [n3] = verts[(i + 2) % 5]!;
    const len = Math.hypot(x2 - x, y2 - y);
    const [dx, dy] = [(2 * (x2 - x)) / len, (2 * (y2 - y)) / len];
    const p = `P${i}`;
    points.push({ name: p, x: `${ox} + s*(${num(x2 - ox)})${plus(dx)}`, y: `${oy} + s*(${num(y2 - oy)})${plus(dy)}`, label: "", hidden: true });
    segments.push({ from: n2, to: p, dashed: true });
    angles.push({ at: n2, from: p, to: n3, label: String(i + 1), color: colors[i] });
  });
  return {
    kind: "diagram",
    view: [-3.5, 8, -2.6, 7.2],
    points,
    segments,
    polygons: [{ points: verts.map((v) => v[0]) }],
    angles,
    params: [{ name: "s", label: "size", min: 0.05, max: 1, step: 0.05, value: 1 }],
    caption: md`Each side is extended (dashed) to make an exterior angle at every vertex. Drag **size** down. The pentagon shrinks, but its sides keep their directions, so the exterior angles don't change. At the smallest size, the five angles fit around a single point: one full turn, $360^\circ$.`,
  };
}

/** Parallelogram A(0,0), B(6,0) with side b at angle t, diagonals meeting at E (their actual intersection). */
function bisectingDiagonals(): Diagram {
  const dx = "b cos(t pi/180)";
  const dy = "b sin(t pi/180)";
  const cx = `6 + ${dx}`;
  // Intersection of line AC with line BD: A + s(C - A) = B + u(D - B).
  const s = `(6 (${dy})) / ((${cx}) (${dy}) - (${dy}) (${dx} - 6))`;
  const ex = `(${s}) (${cx})`;
  const ey = `(${s}) (${dy})`;
  const dist = (x1: string, y1: string, x2: string, y2: string) => `sqrt(((${x1}) - (${x2}))^2 + ((${y1}) - (${y2}))^2)`;
  return {
    kind: "diagram",
    view: [-3, 10.5, -1, 5.2],
    points: [
      { name: "A", x: 0, y: 0, dir: "sw" },
      { name: "B", x: 6, y: 0, dir: "se" },
      { name: "C", x: cx, y: dy, dir: "ne" },
      { name: "D", x: dx, y: dy, dir: "nw" },
      { name: "E", x: ex, y: ey, dir: "s" },
    ],
    polygons: [{ points: ["A", "B", "C", "D"] }],
    segments: [
      { from: "A", to: "C", color: 1 },
      { from: "B", to: "D", color: 2 },
    ],
    params: [
      { name: "t", tex: "\\angle A", min: 40, max: 140, step: 1, value: 65 },
      { name: "b", tex: "AD", min: 2, max: 5, step: 0.1, value: 4 },
    ],
    readouts: [
      { label: "AE", value: dist("0", "0", ex, ey) },
      { label: "CE", value: dist(cx, dy, ex, ey) },
      { label: "BE", value: dist("6", "0", ex, ey) },
      { label: "DE", value: dist(dx, dy, ex, ey) },
    ],
    caption: md`$E$ is computed as the point where the diagonals cross. Reshape the parallelogram: $AE = CE$ and $BE = DE$ every time, though the two diagonals usually differ.`,
  };
}

/** Parallelogram with sides 6 and 3.5 and angle t at A; readouts of both diagonals. */
function rectangleDiagonalsDiagram(): Diagram {
  const dx = "3.5 cos(t pi/180)";
  const dy = "3.5 sin(t pi/180)";
  return {
    kind: "diagram",
    view: [-2.6, 8.8, -0.8, 4.2],
    points: [
      { name: "A", x: 0, y: 0, dir: "sw" },
      { name: "B", x: 6, y: 0, dir: "se" },
      { name: "C", x: `6 + ${dx}`, y: dy, dir: "ne" },
      { name: "D", x: dx, y: dy, dir: "nw" },
    ],
    polygons: [{ points: ["A", "B", "C", "D"] }],
    segments: [
      { from: "A", to: "C", color: 1 },
      { from: "B", to: "D", color: 2 },
    ],
    angles: [{ at: "A", from: "B", to: "D", label: "{t}^\\circ" }],
    params: [{ name: "t", tex: "\\angle A", min: 50, max: 130, step: 1, value: 70 }],
    readouts: [
      { label: "AC", value: `sqrt((6 + ${dx})^2 + (${dy})^2)` },
      { label: "BD", value: `sqrt((${dx} - 6)^2 + (${dy})^2)` },
    ],
    caption: md`A parallelogram with fixed sides. Turn $\angle A$ and watch the two diagonals: they are equal only at $\angle A = 90^\circ$, when the parallelogram is a rectangle.`,
  };
}

/** Rhombus with side 4 and angle t; E is the midpoint of AC. */
function rhombusDiagram(): Diagram {
  const c = "4 cos(t pi/180)";
  const sn = "4 sin(t pi/180)";
  const ex = `(4 + ${c})/2`;
  const ey = `(${sn})/2`;
  return {
    kind: "diagram",
    view: [-3, 8.5, -0.8, 4.4],
    points: [
      { name: "A", x: 0, y: 0, dir: "sw" },
      { name: "B", x: 4, y: 0, dir: "se" },
      { name: "C", x: `4 + ${c}`, y: sn, dir: "ne" },
      { name: "D", x: c, y: sn, dir: "nw" },
      { name: "E", x: ex, y: ey, dir: "e" },
    ],
    segments: [
      { from: "A", to: "B", ticks: 1 },
      { from: "B", to: "C", ticks: 1 },
      { from: "C", to: "D", ticks: 1 },
      { from: "D", to: "A", ticks: 1 },
      { from: "A", to: "C", color: 1 },
      { from: "B", to: "D", color: 2 },
    ],
    params: [{ name: "t", tex: "\\angle A", min: 40, max: 140, step: 1, value: 60 }],
    readouts: [
      { label: "AE^2 + BE^2", value: `(${ex})^2 + (${ey})^2 + (${ex} - 4)^2 + (${ey})^2` },
      { label: "AB^2", value: "16" },
    ],
    caption: md`A rhombus with side 4. $E$ is the midpoint of $\overline{AC}$, which is also where $\overline{BD}$ crosses it. However you tilt it, $AE^2 + BE^2 = AB^2$, so by the converse of the Pythagorean Theorem, $\angle AEB$ is always a right angle.`,
  };
}

// ── Unit ────────────────────────────────────────────────────────────────────

export const unit6: Unit = {
  title: "Polygons and Quadrilaterals",
  lessons: [
    {
      id: "angles-of-polygons",
      title: "Angles of polygons",
      summary: "Why a polygon's angles add to (n − 2) · 180°, and why the exterior angles always add to 360°.",
      blocks: [
        {
          kind: "text",
          body: md`A **polygon** is a closed figure in a plane made of segments, called **sides**, that meet only at their endpoints, the **vertices**. Each vertex belongs to exactly two sides. A polygon with $n$ sides is called an **$n$-gon**. Some have names: a pentagon has 5 sides, a hexagon 6, an octagon 8, a decagon 10.

A **diagonal** joins two vertices that aren't next to each other. A polygon is **convex** if every diagonal lies inside it. If some diagonal goes outside, the polygon has a dent and is **concave**. In this unit, polygons are convex.`,
        },
        {
          kind: "text",
          body: md`You already know one angle sum: a triangle's angles add to $180^\circ$ (Unit 2). That is enough to find every other polygon's angle sum. Draw one diagonal of a quadrilateral and it becomes two triangles, so its angles add to $2 \cdot 180^\circ = 360^\circ$.

For bigger polygons, draw every diagonal from a single vertex. This is called **triangulating** the polygon.`,
        },
        {
          kind: "diagram",
          view: [-1.8, 7.3, -1.2, 6.8],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 4, y: -0.5, dir: "se" },
            { name: "C", x: 6.5, y: 2, dir: "e" },
            { name: "D", x: 5.5, y: 5, dir: "ne" },
            { name: "E", x: 2, y: 6, dir: "n" },
            { name: "F", x: -1, y: 3, dir: "w" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["A", "C", "D"], fill: 2 },
            { points: ["A", "D", "E"], fill: 3 },
            { points: ["A", "E", "F"], fill: 4 },
          ],
          segments: [
            { from: "A", to: "C", dashed: true },
            { from: "A", to: "D", dashed: true },
            { from: "A", to: "E", dashed: true },
          ],
          angles: [
            { at: "A", from: "B", to: "C", color: 1 },
            { at: "A", from: "C", to: "D", color: 2 },
            { at: "A", from: "D", to: "E", color: 3 },
            { at: "A", from: "E", to: "F", color: 4 },
          ],
          caption: md`A hexagon has $6 - 3 = 3$ diagonals from $A$, which cut it into $6 - 2 = 4$ triangles. At $A$, the four triangles' angles fit together to make the hexagon's angle at $A$.`,
        },
        {
          kind: "why",
          title: "Why n − 2 triangles?",
          body: md`From one vertex you can draw a diagonal to every vertex except itself and its two neighbours. That's $n - 3$ diagonals. Because the polygon is convex, each one lies inside it and cuts one region into two, so $n - 3$ cuts make $1 + (n - 3) = n - 2$ triangles.

Why do the triangles' angles add up to *exactly* the polygon's angles? The triangles use no new corners: every corner of every triangle is a vertex of the polygon. And at each vertex, the triangle corners sit side by side and fill the polygon's angle there, with no gaps or overlaps. That's the Angle Addition Postulate. Nothing is added and nothing is lost.`,
        },
        {
          kind: "key",
          title: "Polygon Interior Angle Sum Theorem",
          body: md`The interior angles of a convex $n$-gon add up to

$$(n - 2) \cdot 180^\circ.$$

- triangle: $180^\circ$; quadrilateral: $360^\circ$; pentagon: $540^\circ$
- hexagon: $720^\circ$; octagon: $1080^\circ$; decagon: $1440^\circ$`,
        },
        {
          kind: "proof",
          title: "The interior angle sum",
          given: md`A convex polygon with $n$ sides and vertices $V_1, V_2, \ldots, V_n$.`,
          prove: md`Its interior angles add up to $(n - 2) \cdot 180^\circ$.`,
          steps: [
            { statement: md`Draw $\overline{V_1V_3}, \overline{V_1V_4}, \ldots, \overline{V_1V_{n-1}}$.`, reason: "Through any two points there is exactly one line" },
            { statement: md`These $n - 3$ diagonals split the polygon into $n - 2$ triangles.`, reason: "The polygon is convex, so each diagonal lies inside it and adds one region" },
            { statement: md`The angles of each triangle add up to $180^\circ$.`, reason: "Triangle Angle Sum Theorem" },
            { statement: md`At each vertex, the triangles' angles add up to the polygon's angle there.`, reason: "Angle Addition Postulate" },
            { statement: md`The polygon's angles add up to $(n - 2) \cdot 180^\circ$.`, reason: md`Substitution: add the $n - 2$ triangle sums` },
          ],
        },
        {
          kind: "text",
          body: md`A polygon is **regular** if all its sides are congruent (it is *equilateral*) and all its angles are congruent (it is *equiangular*). The angles of a regular $n$-gon share the total equally, so each one measures $\frac{(n - 2) \cdot 180^\circ}{n}$.`,
        },
        {
          kind: "example",
          title: "One angle of a regular octagon",
          problem: md`Find the measure of each interior angle of a regular octagon.`,
          steps: [
            { math: md`(8 - 2) \cdot 180^\circ = 1080^\circ`, note: "An octagon splits into 6 triangles." },
            { math: md`\frac{1080^\circ}{8} = 135^\circ`, note: "Its 8 angles are equal, so each gets one eighth." },
          ],
        },
        {
          kind: "text",
          body: md`An **exterior angle** of a polygon is made by extending one side past a vertex. It sits beside the interior angle at that vertex, and the two form a linear pair, so

$$\text{interior} + \text{exterior} = 180^\circ.$$`,
        },
        shrinkingPentagon(),
        {
          kind: "why",
          title: "Why the exterior angles make a full turn",
          body: md`Walk around the polygon along its sides. At each vertex you turn left by exactly the exterior angle there, then walk the next side. When you get back to the start, you face the way you began, and you have turned around once: $360^\circ$. The shrinking picture shows the same thing: the turns don't depend on how long the sides are, and with the sides shrunk away, the exterior angles fill the space around a point.`,
        },
        {
          kind: "proof",
          title: "The exterior angle sum",
          given: md`A convex $n$-gon with one exterior angle at each vertex.`,
          prove: md`The exterior angles add up to $360^\circ$.`,
          steps: [
            { statement: md`At each vertex, interior angle $+$ exterior angle $= 180^\circ$.`, reason: "Linear Pair Postulate" },
            { statement: md`(sum of interior angles) $+$ (sum of exterior angles) $= 180n^\circ$.`, reason: md`Addition Property of Equality, over all $n$ vertices` },
            { statement: md`sum of interior angles $= (n - 2) \cdot 180^\circ = 180n^\circ - 360^\circ$.`, reason: "Polygon Interior Angle Sum Theorem; Distributive Property" },
            { statement: md`sum of exterior angles $= 180n^\circ - (180n^\circ - 360^\circ) = 360^\circ$.`, reason: "Subtraction Property of Equality, then simplify" },
          ],
        },
        {
          kind: "example",
          title: "From an angle back to the number of sides",
          problem: md`Each interior angle of a regular polygon measures $156^\circ$. How many sides does it have?`,
          steps: [
            { math: md`\frac{180(n - 2)}{n} = 156`, note: md`Each angle is the total shared $n$ ways.` },
            { math: md`180n - 360 = 156n`, note: md`Multiply both sides by $n$ and distribute.` },
            { math: md`24n = 360 \;\Rightarrow\; n = 15`, note: md`Subtract $156n$, add 360, divide by 24.` },
            { math: md`180^\circ - 156^\circ = 24^\circ, \quad \frac{360^\circ}{24^\circ} = 15`, note: md`The quick way: each exterior angle is $24^\circ$, and 15 of them make a full turn.` },
          ],
        },
        {
          kind: "why",
          title: "Which regular polygons can exist?",
          body: md`A regular $n$-gon's exterior angles are each $\frac{360^\circ}{n}$, so $n$ must be $360$ divided by the exterior angle. If an "interior angle" of $100^\circ$ were possible, each exterior angle would be $80^\circ$, and $360 \div 80 = 4.5$. A polygon can't have 4.5 sides, so no regular polygon has $100^\circ$ angles. An interior angle works only when $180^\circ$ minus it divides $360^\circ$ a whole number of times (at least 3).`,
        },
        {
          kind: "check",
          prompt: md`Find the sum of the interior angles of a convex hexagon. Give the angle in degrees.`,
          answer: "720",
          explain: md`A hexagon splits into $6 - 2 = 4$ triangles, so its angles add to $4 \cdot 180^\circ = 720^\circ$.`,
        },
        {
          kind: "check",
          prompt: md`Each exterior angle of a regular polygon measures $30^\circ$. How many sides does it have?`,
          answer: "12",
          explain: md`The exterior angles add to $360^\circ$, and $360 \div 30 = 12$.`,
        },
      ],
      practice: [polygonAngles, sidesFromAngle, missingPolygonAngle],
    },
    {
      id: "parallelograms",
      title: "Parallelograms",
      summary: "Proving what a parallelogram's sides, angles and diagonals must do, and the tests that prove a quadrilateral is one.",
      blocks: [
        {
          kind: "text",
          body: md`A quadrilateral is named by its vertices in order around it: $ABCD$ has sides $\overline{AB}$, $\overline{BC}$, $\overline{CD}$ and $\overline{DA}$, and diagonals $\overline{AC}$ and $\overline{BD}$. Sides that share a vertex are **consecutive**; sides that don't are **opposite**. The same words apply to angles: $\angle A$ and $\angle C$ are opposite, $\angle A$ and $\angle B$ are consecutive.`,
        },
        {
          kind: "key",
          title: "Parallelogram",
          body: md`A **parallelogram** is a quadrilateral with both pairs of opposite sides parallel: $\overline{AB} \parallel \overline{DC}$ and $\overline{AD} \parallel \overline{BC}$.

That is the whole definition. Everything else we say about parallelograms has to be proved from it.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 8.8, -0.8, 4.3],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 6, y: 0, dir: "se" },
            { name: "C", x: 8, y: 3.5, dir: "ne" },
            { name: "D", x: 2, y: 3.5, dir: "nw" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["C", "D", "A"], fill: 2 },
          ],
          segments: [
            { from: "A", to: "B", parallel: 1 },
            { from: "D", to: "C", parallel: 1 },
            { from: "A", to: "D", parallel: 2 },
            { from: "B", to: "C", parallel: 2 },
            { from: "A", to: "C", dashed: true },
          ],
          angles: [
            { at: "A", from: "B", to: "C", arcs: 1, color: 1 },
            { at: "C", from: "D", to: "A", arcs: 1, color: 1 },
            { at: "C", from: "A", to: "B", arcs: 2, color: 2 },
            { at: "A", from: "C", to: "D", arcs: 2, color: 2 },
          ],
          caption: md`Diagonal $\overline{AC}$ is a transversal for both pairs of parallel sides. The matching arcs are alternate interior angles, so they are congruent.`,
        },
        {
          kind: "why",
          title: "The plan: cut along a diagonal",
          body: md`We know how to prove triangles congruent, but not quadrilaterals. So cut the parallelogram along diagonal $\overline{AC}$ into $\triangle ABC$ and $\triangle CDA$. The diagonal is a transversal of $\overline{AB} \parallel \overline{DC}$ and also of $\overline{AD} \parallel \overline{BC}$, so it makes two pairs of congruent alternate interior angles. The triangles also share the side $\overline{AC}$. That is angle, side, angle: ASA.`,
        },
        {
          kind: "proof",
          title: "Opposite sides and opposite angles are congruent",
          given: md`$ABCD$ is a parallelogram.`,
          prove: md`$\overline{AB} \cong \overline{CD}$, $\overline{BC} \cong \overline{DA}$, $\angle B \cong \angle D$ and $\angle A \cong \angle C$.`,
          steps: [
            { statement: md`$\overline{AB} \parallel \overline{DC}$ and $\overline{AD} \parallel \overline{BC}$`, reason: "Definition of a parallelogram" },
            { statement: md`Draw diagonal $\overline{AC}$.`, reason: "Through any two points there is exactly one line" },
            { statement: md`$\angle BAC \cong \angle DCA$`, reason: md`Alternate Interior Angles Theorem ($\overline{AB} \parallel \overline{DC}$)` },
            { statement: md`$\angle BCA \cong \angle DAC$`, reason: md`Alternate Interior Angles Theorem ($\overline{AD} \parallel \overline{BC}$)` },
            { statement: md`$\overline{AC} \cong \overline{CA}$`, reason: "Reflexive Property" },
            { statement: md`$\triangle ABC \cong \triangle CDA$`, reason: "ASA (steps 3, 5, 4)" },
            { statement: md`$\overline{AB} \cong \overline{CD}$, $\overline{BC} \cong \overline{DA}$, $\angle B \cong \angle D$`, reason: "CPCTC" },
            { statement: md`$\angle BAC + \angle DAC = \angle DCA + \angle BCA$`, reason: "Addition Property of Equality (steps 3 and 4)" },
            { statement: md`$\angle BAD = \angle BCD$, that is, $\angle A \cong \angle C$`, reason: "Angle Addition Postulate and substitution" },
          ],
        },
        {
          kind: "why",
          title: "Why consecutive angles are supplementary",
          body: md`Look at $\angle A$ and $\angle D$. Side $\overline{AD}$ is a transversal of the parallel sides $\overline{AB}$ and $\overline{DC}$, and $\angle A$ and $\angle D$ are same-side interior angles. By the Same-Side Interior Angles Theorem (Unit 2), $\angle A + \angle D = 180^\circ$. The same goes for any two consecutive angles.`,
        },
        {
          kind: "proof",
          title: "The diagonals bisect each other",
          given: md`Parallelogram $ABCD$, with diagonals $\overline{AC}$ and $\overline{BD}$ meeting at $E$.`,
          prove: md`$\overline{AE} \cong \overline{CE}$ and $\overline{BE} \cong \overline{DE}$.`,
          steps: [
            { statement: md`$\overline{AB} \parallel \overline{DC}$`, reason: "Definition of a parallelogram" },
            { statement: md`$\angle EAB \cong \angle ECD$`, reason: md`Alternate Interior Angles Theorem (transversal $\overleftrightarrow{AC}$)` },
            { statement: md`$\angle EBA \cong \angle EDC$`, reason: md`Alternate Interior Angles Theorem (transversal $\overleftrightarrow{BD}$)` },
            { statement: md`$\overline{AB} \cong \overline{CD}$`, reason: "Opposite sides of a parallelogram are congruent (just proved)" },
            { statement: md`$\triangle ABE \cong \triangle CDE$`, reason: "ASA (steps 2, 4, 3)" },
            { statement: md`$\overline{AE} \cong \overline{CE}$ and $\overline{BE} \cong \overline{DE}$`, reason: "CPCTC" },
          ],
        },
        bisectingDiagonals(),
        {
          kind: "key",
          title: "Properties of a parallelogram",
          body: md`In every parallelogram:

- opposite sides are congruent;
- opposite angles are congruent;
- consecutive angles are supplementary;
- the diagonals bisect each other.`,
        },
        {
          kind: "example",
          title: "Using the angle facts",
          problem: md`In parallelogram $ABCD$, $\angle A = (3x + 15)^\circ$ and $\angle B = (2x + 25)^\circ$. Find $x$ and $\angle C$.`,
          steps: [
            { math: md`(3x + 15) + (2x + 25) = 180`, note: md`$\angle A$ and $\angle B$ are consecutive, so they are supplementary.` },
            { math: md`5x + 40 = 180 \;\Rightarrow\; x = 28`, note: "Combine like terms, subtract 40, divide by 5." },
            { math: md`\angle A = 3(28) + 15 = 99^\circ`, note: "Substitute." },
            { math: md`\angle C = \angle A = 99^\circ`, note: md`Opposite angles are congruent. Check: $\angle B = 81^\circ$, and $99 + 81 = 180$.` },
          ],
        },
        {
          kind: "example",
          title: "The fourth vertex",
          problem: md`$A(1, 2)$, $B(6, 3)$ and $C(8, 7)$ are three vertices of parallelogram $ABCD$. Find $D$.`,
          steps: [
            { math: md`\left(\frac{1 + 8}{2}, \frac{2 + 7}{2}\right) = (4.5, 4.5)`, note: md`The midpoint of $\overline{AC}$ (Midpoint Formula, Unit 5). The diagonals bisect each other, so it is also the midpoint of $\overline{BD}$.` },
            { math: md`B + D = A + C`, note: md`In each coordinate, both sums are twice the midpoint.` },
            { math: md`D = (1 + 8 - 6,; 2 + 7 - 3) = (3, 6)`, note: md`Solve for $D$. Check: $C - B = (2, 4) = D - A$, so $\overline{AD}$ and $\overline{BC}$ are the same move.` },
          ],
        },
        {
          kind: "text",
          body: md`**Turning it around.** The properties tell you what a parallelogram does. Often you need the converse: from some facts about a quadrilateral, prove that it *is* a parallelogram. Each of these is enough:

- both pairs of opposite sides are congruent;
- both pairs of opposite angles are congruent;
- the diagonals bisect each other;
- one pair of opposite sides is both parallel and congruent.`,
        },
        {
          kind: "proof",
          title: "Opposite sides congruent makes a parallelogram",
          given: md`Quadrilateral $ABCD$ with $\overline{AB} \cong \overline{CD}$ and $\overline{BC} \cong \overline{DA}$.`,
          prove: md`$ABCD$ is a parallelogram.`,
          steps: [
            { statement: md`$\overline{AB} \cong \overline{CD}$ and $\overline{BC} \cong \overline{DA}$`, reason: "Given" },
            { statement: md`Draw diagonal $\overline{AC}$; $\overline{AC} \cong \overline{CA}$.`, reason: "Two points determine a line; Reflexive Property" },
            { statement: md`$\triangle ABC \cong \triangle CDA$`, reason: "SSS" },
            { statement: md`$\angle BAC \cong \angle DCA$ and $\angle BCA \cong \angle DAC$`, reason: "CPCTC" },
            { statement: md`$\overline{AB} \parallel \overline{DC}$ and $\overline{BC} \parallel \overline{AD}$`, reason: md`Alternate Interior Angles Converse (transversal $\overleftrightarrow{AC}$)` },
            { statement: md`$ABCD$ is a parallelogram.`, reason: "Definition of a parallelogram" },
          ],
        },
        {
          kind: "why",
          title: "Why the other tests work, and one that doesn't",
          body: md`- **Diagonals bisect each other:** the vertical angles at $E$ are congruent, so SAS gives $\triangle AEB \cong \triangle CED$. Then $\angle EAB \cong \angle ECD$, and the Alternate Interior Angles Converse gives $\overline{AB} \parallel \overline{DC}$. The other pair works the same way.
- **Opposite angles congruent:** if $\angle A = \angle C = a$ and $\angle B = \angle D = b$, then $2a + 2b = 360^\circ$, so $a + b = 180^\circ$. Same-side interior angles that are supplementary mean parallel lines.
- **One pair parallel and congruent:** if $\overline{AB} \parallel \overline{DC}$ and $\overline{AB} \cong \overline{DC}$, SAS on diagonal $\overline{AC}$ gives $\triangle ABC \cong \triangle CDA$, and then $\overline{AD} \parallel \overline{BC}$ too.

But one pair parallel and the *other* pair congruent is **not** enough. The trapezoid below has $\overline{AB} \parallel \overline{DC}$ and $\overline{AD} \cong \overline{BC}$, and it isn't a parallelogram.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 7.8, -0.8, 3.8],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 7, y: 0, dir: "se" },
            { name: "C", x: 5, y: 3, dir: "ne" },
            { name: "D", x: 2, y: 3, dir: "nw" },
          ],
          polygons: [{ points: ["A", "B", "C", "D"], fill: 2 }],
          segments: [
            { from: "A", to: "B", parallel: 1 },
            { from: "D", to: "C", parallel: 1 },
            { from: "A", to: "D", ticks: 1 },
            { from: "B", to: "C", ticks: 1 },
          ],
          caption: md`A counterexample: $\overline{AB} \parallel \overline{DC}$ and $AD = BC = \sqrt{13}$, but $\overline{AD}$ and $\overline{BC}$ lean opposite ways, so they aren't parallel.`,
        },
        {
          kind: "check",
          prompt: md`In parallelogram $ABCD$, $\angle A = 64^\circ$. Find $\angle B$. Give the angle in degrees.`,
          answer: "116",
          explain: md`$\angle A$ and $\angle B$ are consecutive, so $\angle B = 180^\circ - 64^\circ = 116^\circ$.`,
        },
        {
          kind: "check",
          prompt: md`In quadrilateral $PQRS$, the diagonals bisect each other. Must $PQRS$ be a parallelogram?`,
          choices: [YES, NO],
          accept: [YES],
          explain: md`Yes. Vertical angles and SAS give congruent triangles, whose alternate interior angles force both pairs of opposite sides to be parallel.`,
        },
      ],
      practice: [parallelogramAngles, parallelogramSegments, parallelogramTest],
    },
    {
      id: "rectangles-rhombuses-and-squares",
      title: "Rectangles, rhombuses and squares",
      summary: "Special parallelograms: why a rectangle's diagonals are congruent and a rhombus's are perpendicular.",
      blocks: [
        {
          kind: "text",
          body: md`Every fact from the last lesson holds for any parallelogram. Asking for more, such as right angles, equal sides or both, gives three special parallelograms, and each extra condition shows up in the diagonals. The proofs work the same way as before: find congruent triangles (Unit 3) and read off the parts.`,
        },
        {
          kind: "key",
          title: "Three special parallelograms",
          body: md`- A **rectangle** is a quadrilateral with four right angles.
- A **rhombus** is a quadrilateral with four congruent sides.
- A **square** is a quadrilateral with four right angles and four congruent sides.`,
        },
        {
          kind: "why",
          title: "Why each one is a parallelogram",
          body: md`A rectangle's opposite angles are all $90^\circ$, so they are congruent, and that is a parallelogram test. A rhombus's opposite sides are congruent (all four are), which is another test. A square is both a rectangle and a rhombus.

So every rectangle, rhombus and square gets all the parallelogram properties for free: opposite sides congruent and parallel, diagonals bisecting each other. The question is what *extra* each one has.`,
        },
        {
          kind: "text",
          body: md`The family fits together like this:

- every square is a rectangle and a rhombus;
- every rectangle and every rhombus is a parallelogram;
- a rectangle that is also a rhombus is a square.

When asked for the **most specific** name, say square if the shape is both a rectangle and a rhombus, rectangle or rhombus if it is exactly one of those, and parallelogram only if it is neither.`,
        },
        rectangleDiagonalsDiagram(),
        {
          kind: "proof",
          title: "A rectangle's diagonals are congruent",
          given: md`Rectangle $ABCD$.`,
          prove: md`$\overline{AC} \cong \overline{BD}$.`,
          steps: [
            { statement: md`$ABCD$ is a parallelogram.`, reason: "Every rectangle is a parallelogram" },
            { statement: md`$\overline{BC} \cong \overline{AD}$`, reason: "Opposite sides of a parallelogram are congruent" },
            { statement: md`$\angle ABC \cong \angle BAD$`, reason: md`Both are right angles, $90^\circ$` },
            { statement: md`$\overline{AB} \cong \overline{BA}$`, reason: "Reflexive Property" },
            { statement: md`$\triangle ABC \cong \triangle BAD$`, reason: "SAS (steps 4, 3, 2)" },
            { statement: md`$\overline{AC} \cong \overline{BD}$`, reason: "CPCTC" },
          ],
        },
        {
          kind: "diagram",
          view: [-0.8, 7.8, -0.8, 4.8],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 7, y: 0, dir: "se" },
            { name: "C", x: 7, y: 4, dir: "ne" },
            { name: "D", x: 0, y: 4, dir: "nw" },
            { name: "E", x: 3.5, y: 2, dir: "n" },
          ],
          polygons: [{ points: ["A", "B", "C", "D"] }, { points: ["A", "B", "E"], fill: 1 }],
          segments: [
            { from: "A", to: "E", ticks: 1 },
            { from: "E", to: "C", ticks: 1 },
            { from: "B", to: "E", ticks: 1 },
            { from: "E", to: "D", ticks: 1 },
          ],
          angles: [
            { at: "A", from: "B", to: "D", right: true },
            { at: "B", from: "C", to: "A", right: true },
            { at: "C", from: "D", to: "B", right: true },
            { at: "D", from: "A", to: "C", right: true },
            { at: "A", from: "B", to: "E", color: 2 },
            { at: "B", from: "E", to: "A", color: 2 },
          ],
          caption: md`The diagonals are congruent and bisect each other, so all four halves are equal. That makes $\triangle ABE$ isosceles, with $\angle BAE \cong \angle ABE$.`,
        },
        {
          kind: "example",
          title: "Rectangle diagonals",
          problem: md`In rectangle $ABCD$, the diagonals meet at $E$, $AC = 3x + 4$ and $BD = 5x - 6$. Find $x$ and $BE$.`,
          steps: [
            { math: md`3x + 4 = 5x - 6`, note: "The diagonals of a rectangle are congruent." },
            { math: md`10 = 2x \;\Rightarrow\; x = 5`, note: md`Subtract $3x$, add 6, divide by 2.` },
            { math: md`BD = 5(5) - 6 = 19`, note: "Substitute." },
            { math: md`BE = \frac{19}{2}`, note: md`$E$ is the midpoint of $\overline{BD}$. Answers don't have to be whole numbers.` },
          ],
        },
        rhombusDiagram(),
        {
          kind: "proof",
          title: "A rhombus's diagonals are perpendicular",
          given: md`Rhombus $ABCD$, with diagonals meeting at $E$.`,
          prove: md`$\overline{AC} \perp \overline{BD}$, and $\overline{BD}$ bisects $\angle ABC$.`,
          steps: [
            { statement: md`$\overline{AB} \cong \overline{CB}$`, reason: "Definition of a rhombus" },
            { statement: md`$\overline{AE} \cong \overline{CE}$`, reason: "A rhombus is a parallelogram, so its diagonals bisect each other" },
            { statement: md`$\overline{BE} \cong \overline{BE}$`, reason: "Reflexive Property" },
            { statement: md`$\triangle ABE \cong \triangle CBE$`, reason: "SSS" },
            { statement: md`$\angle AEB \cong \angle CEB$ and $\angle ABE \cong \angle CBE$`, reason: "CPCTC" },
            { statement: md`$\angle AEB + \angle CEB = 180^\circ$`, reason: "Linear Pair Postulate" },
            { statement: md`$2\angle AEB = 180^\circ$, so $\angle AEB = 90^\circ$`, reason: "Substitution; Division Property of Equality" },
            { statement: md`$\overline{AC} \perp \overline{BD}$, and $\overline{BD}$ bisects $\angle ABC$`, reason: "Definitions of perpendicular and of angle bisector (step 5)" },
          ],
        },
        {
          kind: "key",
          title: "What each special parallelogram adds",
          body: md`- **Rectangle:** congruent diagonals. Conversely, a parallelogram with congruent diagonals is a rectangle.
- **Rhombus:** perpendicular diagonals, and each diagonal bisects the two angles at its ends. Conversely, a parallelogram with perpendicular diagonals is a rhombus, and so is a parallelogram with a diagonal that bisects an angle.
- **Square:** all of these.`,
        },
        {
          kind: "why",
          title: "Why the converses hold",
          body: md`Suppose parallelogram $ABCD$ has $AC = BD$. Then $\triangle ABC \cong \triangle BAD$ by SSS ($AB = BA$, $BC = AD$, $AC = BD$), so $\angle B \cong \angle A$. But consecutive angles are supplementary, so each is half of $180^\circ$: a right angle. Then every angle is right, and it's a rectangle.

Suppose instead the diagonals are perpendicular. They bisect each other, so $AE = CE$, $BE = BE$, and the right angles at $E$ match: SAS gives $\triangle ABE \cong \triangle CBE$, so $AB = CB$. Opposite sides are equal too, so all four sides are, and it's a rhombus.

Suppose diagonal $\overline{AC}$ bisects $\angle A$. Then $\angle BAC = \angle DAC$, and $\angle DAC = \angle BCA$ (Alternate Interior Angles Theorem, $\overline{AD} \parallel \overline{BC}$). So $\angle BAC = \angle BCA$, and by the converse of the Isosceles Triangle Theorem, $AB = CB$. Again all four sides are equal: a rhombus.`,
        },
        {
          kind: "example",
          title: "A rhombus from its diagonals",
          problem: md`The diagonals of rhombus $ABCD$ meet at $E$, with $AC = 10$ and $BD = 24$. Find the side length.`,
          steps: [
            { math: md`AE = 5, \quad BE = 12`, note: "The diagonals bisect each other." },
            { math: md`AB^2 = 5^2 + 12^2 = 169`, note: md`They are perpendicular, so $\triangle ABE$ has a right angle at $E$. Pythagorean Theorem.` },
            { math: md`AB = 13`, note: "All four sides are 13." },
          ],
        },
        {
          kind: "check",
          prompt: md`In rectangle $ABCD$, the diagonals meet at $E$ and $AE = 7$. Find $BD$.`,
          answer: "14",
          explain: md`$AC = 2 \cdot 7 = 14$, and the diagonals of a rectangle are congruent, so $BD = 14$.`,
        },
        {
          kind: "check",
          prompt: md`A parallelogram's diagonals are perpendicular but not congruent. What is the most specific name for it?`,
          choices: ["parallelogram", "rectangle", "rhombus", "square"],
          accept: ["rhombus"],
          explain: md`Perpendicular diagonals make it a rhombus. Its diagonals aren't congruent, so it isn't a rectangle, and so it isn't a square.`,
        },
      ],
      practice: [rectangleDiagonals, rhombusFacts, classifyParallelogram],
    },
    {
      id: "trapezoids-and-kites",
      title: "Trapezoids and kites",
      summary: "The midsegment of a trapezoid, isosceles trapezoids, and why a kite's diagonals are perpendicular.",
      blocks: [
        {
          kind: "text",
          body: md`The quadrilaterals so far had two pairs of parallel sides. A trapezoid has only one pair, and a kite has none. They are still studied the same way: split them into triangles. The trapezoid's midsegment comes from the triangle midsegment, and the kite's diagonals come from congruent triangles.`,
        },
        {
          kind: "key",
          title: "Trapezoid",
          body: md`A **trapezoid** is a quadrilateral with exactly one pair of parallel sides. The parallel sides are the **bases** and the other two are the **legs**. The **midsegment** joins the midpoints of the legs.

In trapezoid $ABCD$ with bases $\overline{AB}$ and $\overline{DC}$, each leg is a transversal of the bases. So angles along a leg are same-side interior angles: $\angle A + \angle D = 180^\circ$ and $\angle B + \angle C = 180^\circ$.`,
        },
        {
          kind: "why",
          title: "The triangle midsegment, from SAS Similarity (Unit 4)",
          body: md`In $\triangle ABC$, let $M$ and $N$ be the midpoints of $\overline{AB}$ and $\overline{AC}$. Then $\frac{AM}{AB} = \frac{AN}{AC} = \frac{1}{2}$ and the triangles share $\angle A$, so $\triangle AMN \sim \triangle ABC$ by SAS Similarity, with scale factor $\frac{1}{2}$. Two things follow:

- $MN = \frac{1}{2}BC$, since corresponding sides are in ratio $\frac{1}{2}$;
- $\angle AMN \cong \angle ABC$, and these are corresponding angles, so $\overline{MN} \parallel \overline{BC}$.

This is the **Triangle Midsegment Theorem**: the segment joining the midpoints of two sides is parallel to the third side and half as long.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 9.8, -0.8, 4.8],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 9, y: 0, dir: "se" },
            { name: "C", x: 6, y: 4, dir: "ne" },
            { name: "D", x: 1, y: 4, dir: "nw" },
            { name: "M", x: 0.5, y: 2, dir: "w" },
            { name: "N", x: 7.5, y: 2, dir: "e" },
            { name: "P", x: 3, y: 2, dir: "n" },
          ],
          polygons: [{ points: ["A", "B", "C", "D"] }],
          segments: [
            { from: "A", to: "B", parallel: 1, label: "9" },
            { from: "D", to: "C", parallel: 1, label: "5" },
            { from: "A", to: "M", ticks: 1 },
            { from: "M", to: "D", ticks: 1 },
            { from: "B", to: "N", ticks: 2 },
            { from: "N", to: "C", ticks: 2 },
            { from: "A", to: "C", dashed: true },
            { from: "M", to: "P", color: 2 },
            { from: "P", to: "N", color: 3 },
          ],
          caption: md`$P$ is the midpoint of diagonal $\overline{AC}$. In $\triangle ACD$, $MP = \frac{5}{2}$; in $\triangle CAB$, $PN = \frac{9}{2}$. Together, $MN = 7$, the average of 5 and 9.`,
        },
        {
          kind: "proof",
          title: "Trapezoid Midsegment Theorem",
          given: md`Trapezoid $ABCD$ with bases $\overline{AB} \parallel \overline{DC}$; $M$ and $N$ are the midpoints of legs $\overline{AD}$ and $\overline{BC}$.`,
          prove: md`$\overline{MN} \parallel \overline{AB}$ and $MN = \frac{AB + DC}{2}$.`,
          steps: [
            { statement: md`Draw diagonal $\overline{AC}$ with midpoint $P$.`, reason: "Two points determine a line; a segment has exactly one midpoint (Ruler Postulate)" },
            { statement: md`$\overline{MP} \parallel \overline{DC}$ and $MP = \frac{1}{2}DC$`, reason: md`Triangle Midsegment Theorem in $\triangle ACD$` },
            { statement: md`$\overline{PN} \parallel \overline{AB}$ and $PN = \frac{1}{2}AB$`, reason: md`Triangle Midsegment Theorem in $\triangle CAB$` },
            { statement: md`$\overline{MP} \parallel \overline{AB}$`, reason: md`Step 2 and the Parallel Postulate. $M$ is not on $\overleftrightarrow{AB}$, so if $\overleftrightarrow{MP}$ met $\overleftrightarrow{AB}$, two different lines through that point would both be parallel to $\overleftrightarrow{DC}$` },
            { statement: md`$M$, $P$ and $N$ lie on one line.`, reason: md`Parallel Postulate: through $P$ there is only one line parallel to $\overline{AB}$, and both $\overleftrightarrow{PM}$ and $\overleftrightarrow{PN}$ are` },
            { statement: md`$MN = MP + PN$`, reason: "Segment Addition Postulate" },
            { statement: md`$MN = \frac{1}{2}DC + \frac{1}{2}AB = \frac{AB + DC}{2}$, and $\overline{MN} \parallel \overline{AB}$`, reason: "Substitution (steps 2, 3); step 5" },
          ],
        },
        {
          kind: "why",
          title: "Another way to see the average",
          body: md`Cut out a paper copy of the trapezoid and spin it halfway around $N$, the midpoint of leg $\overline{BC}$ (Unit 9 makes this kind of motion precise). Leg $\overline{BC}$ lands on itself, reversed. At $B$ the copy's angle is the original's $\angle C$, and $\angle B + \angle C = 180^\circ$, so the copy's bases continue the original's in straight lines. Together they form a parallelogram whose top and bottom are each $AB + DC$ long.

The two midsegments line up end to end across the middle of that parallelogram, joining the midpoints of its slanted sides, so together they are $AB + DC$ long as well. Each trapezoid owns half: $MN = \frac{AB + DC}{2}$.`,
        },
        {
          kind: "key",
          title: "Trapezoid Midsegment Theorem",
          body: md`The midsegment of a trapezoid is parallel to the bases, and its length is their average: $MN = \frac{AB + DC}{2}$.`,
        },
        {
          kind: "example",
          title: "Using the midsegment",
          problem: md`A trapezoid's midsegment is 15 and one base is 11. Find the other base.`,
          steps: [
            { math: md`\frac{11 + b}{2} = 15`, note: "The midsegment is the average of the bases." },
            { math: md`11 + b = 30 \;\Rightarrow\; b = 19`, note: "Multiply by 2, subtract 11." },
          ],
        },
        {
          kind: "text",
          body: md`An **isosceles trapezoid** is a trapezoid with congruent legs. Each base has two **base angles**, the angles at its ends.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 8.8, -0.8, 3.8],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 8, y: 0, dir: "se" },
            { name: "C", x: 6, y: 3, dir: "ne" },
            { name: "D", x: 2, y: 3, dir: "nw" },
            { name: "F", x: 2, y: 0, dir: "s" },
            { name: "G", x: 6, y: 0, dir: "s" },
          ],
          polygons: [
            { points: ["A", "F", "D"], fill: 1 },
            { points: ["B", "G", "C"], fill: 1 },
          ],
          segments: [
            { from: "A", to: "B", parallel: 1 },
            { from: "D", to: "C", parallel: 1 },
            { from: "A", to: "D", ticks: 1 },
            { from: "B", to: "C", ticks: 1 },
            { from: "D", to: "F", dashed: true },
            { from: "C", to: "G", dashed: true },
          ],
          angles: [
            { at: "F", from: "A", to: "D", right: true },
            { at: "G", from: "C", to: "B", right: true },
            { at: "A", from: "B", to: "D", color: 2 },
            { at: "B", from: "C", to: "A", color: 2 },
          ],
          caption: md`Heights from $D$ and $C$ cut off two right triangles with congruent hypotenuses (the legs) and congruent heights.`,
        },
        {
          kind: "proof",
          title: "Base angles of an isosceles trapezoid are congruent",
          given: md`Trapezoid $ABCD$ with $\overline{AB} \parallel \overline{DC}$, $\overline{AB}$ the longer base, and $\overline{AD} \cong \overline{BC}$.`,
          prove: md`$\angle A \cong \angle B$ and $\angle D \cong \angle C$.`,
          steps: [
            { statement: md`Draw $\overline{DF} \perp \overleftrightarrow{AB}$ and $\overline{CG} \perp \overleftrightarrow{AB}$, with $F$ and $G$ on $\overleftrightarrow{AB}$.`, reason: "From a point there is exactly one perpendicular to a line" },
            { statement: md`$\overline{DF} \parallel \overline{CG}$`, reason: "Two lines perpendicular to the same line are parallel (Unit 2)" },
            { statement: md`$DFGC$ is a parallelogram, so $\overline{DF} \cong \overline{CG}$ and $FG = DC$`, reason: md`Both pairs of opposite sides are parallel ($\overline{DC} \parallel \overline{FG}$ is given); opposite sides are congruent` },
            { statement: md`$\overline{AD} \cong \overline{BC}$`, reason: "Given" },
            { statement: md`$\triangle AFD \cong \triangle BGC$, so $AF = BG$`, reason: md`HL: right angles at $F$ and $G$, hypotenuses (step 4), legs (step 3); CPCTC` },
            { statement: md`$F$ and $G$ lie between $A$ and $B$.`, reason: md`$FG = DC < AB$ (step 3, given). Since $AF = BG$, either $F$ and $G$ are moved the same distance in the same direction from $A$ and $B$, which gives $FG = AB$, or they are moved toward each other or away from each other, and then $FG < AB$ only when both stay between $A$ and $B$` },
            { statement: md`$\angle A \cong \angle B$`, reason: md`CPCTC gives $\angle DAF \cong \angle CBG$, and by step 6 these are $\angle DAB$ and $\angle CBA$` },
            { statement: md`$\angle D = 180^\circ - \angle A = 180^\circ - \angle B = \angle C$`, reason: "Same-Side Interior Angles Theorem along each leg; substitution" },
          ],
        },
        {
          kind: "why",
          title: "Why the diagonals of an isosceles trapezoid are congruent",
          body: md`Compare $\triangle ABC$ and $\triangle BAD$. They share $\overline{AB}$, the legs give $\overline{BC} \cong \overline{AD}$, and the base angles give $\angle ABC \cong \angle BAD$. So the triangles are congruent by SAS, and $\overline{AC} \cong \overline{BD}$ by CPCTC.`,
        },
        {
          kind: "key",
          title: "Isosceles trapezoid",
          body: md`In an isosceles trapezoid:

- each pair of base angles is congruent;
- two angles along a leg add to $180^\circ$, as in every trapezoid;
- the diagonals are congruent.`,
        },
        {
          kind: "key",
          title: "Kite",
          body: md`A **kite** is a quadrilateral with two pairs of consecutive congruent sides, and no pair of opposite sides congruent. In kite $ABCD$ with $\overline{AB} \cong \overline{AD}$ and $\overline{CB} \cong \overline{CD}$:

- the diagonals are perpendicular;
- diagonal $\overline{AC}$ bisects diagonal $\overline{BD}$ and bisects $\angle A$ and $\angle C$;
- $\angle B \cong \angle D$, the angles between the unequal sides.`,
        },
        {
          kind: "diagram",
          view: [-4, 4, -4.8, 5.8],
          points: [
            { name: "A", x: 0, y: 5, dir: "n" },
            { name: "B", x: -3, y: 2, dir: "w" },
            { name: "C", x: 0, y: -4, dir: "s" },
            { name: "D", x: 3, y: 2, dir: "e" },
            { name: "E", x: 0, y: 2, dir: "se" },
          ],
          polygons: [{ points: ["A", "B", "C", "D"], fill: 3 }],
          segments: [
            { from: "A", to: "B", ticks: 1 },
            { from: "A", to: "D", ticks: 1 },
            { from: "C", to: "B", ticks: 2 },
            { from: "C", to: "D", ticks: 2 },
            { from: "A", to: "C", dashed: true },
            { from: "B", to: "D", dashed: true },
          ],
          angles: [
            { at: "E", from: "D", to: "A", right: true },
            { at: "B", from: "A", to: "C", color: 2 },
            { at: "D", from: "C", to: "A", color: 2 },
          ],
          caption: md`Kite $ABCD$: $AB = AD$ and $CB = CD$. Diagonal $\overline{AC}$ is a line of symmetry.`,
        },
        {
          kind: "proof",
          title: "A kite's diagonals are perpendicular",
          given: md`Kite $ABCD$ with $\overline{AB} \cong \overline{AD}$ and $\overline{CB} \cong \overline{CD}$; diagonals meet at $E$.`,
          prove: md`$\overline{AC} \perp \overline{BD}$, $\overline{BE} \cong \overline{DE}$ and $\angle ABC \cong \angle ADC$.`,
          steps: [
            { statement: md`$\overline{AB} \cong \overline{AD}$, $\overline{CB} \cong \overline{CD}$, and $\overline{AC} \cong \overline{AC}$`, reason: "Given; Reflexive Property" },
            { statement: md`$\triangle ABC \cong \triangle ADC$`, reason: "SSS" },
            { statement: md`$\angle BAE \cong \angle DAE$ and $\angle ABC \cong \angle ADC$`, reason: md`CPCTC ($\angle BAE$ is $\angle BAC$)` },
            { statement: md`$\triangle ABE \cong \triangle ADE$`, reason: md`SAS: $\overline{AB} \cong \overline{AD}$, step 3, and $\overline{AE} \cong \overline{AE}$` },
            { statement: md`$\overline{BE} \cong \overline{DE}$ and $\angle AEB \cong \angle AED$`, reason: "CPCTC" },
            { statement: md`$\angle AEB + \angle AED = 180^\circ$, so each is $90^\circ$`, reason: "Linear Pair Postulate; substitution and division" },
            { statement: md`$\overline{AC} \perp \overline{BD}$`, reason: "Definition of perpendicular" },
          ],
        },
        {
          kind: "example",
          title: "Angles of a kite",
          problem: md`Kite $ABCD$ has $AB = AD$ and $CB = CD$, with $\angle A = 80^\circ$ and $\angle C = 60^\circ$. Find $\angle B$.`,
          steps: [
            { math: md`\angle B = \angle D`, note: "The angles between the unequal sides are congruent." },
            { math: md`2\angle B = 360^\circ - 80^\circ - 60^\circ = 220^\circ`, note: md`The angles of a quadrilateral add to $360^\circ$.` },
            { math: md`\angle B = 110^\circ`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`A trapezoid has bases of length 7 and 13. How long is its midsegment?`,
          answer: "10",
          explain: md`The midsegment is the average of the bases: $\frac{7 + 13}{2} = 10$.`,
        },
        {
          kind: "check",
          prompt: md`Isosceles trapezoid $ABCD$ has bases $\overline{AB}$ and $\overline{DC}$, and $\angle A = 70^\circ$. Find $\angle D$. Give the angle in degrees.`,
          answer: "110",
          explain: md`$\angle A$ and $\angle D$ lie along leg $\overline{AD}$, so they are supplementary: $180^\circ - 70^\circ = 110^\circ$.`,
        },
      ],
      practice: [trapezoidMidsegment, trapezoidKiteAngles, kiteAndTrapezoidLengths],
    },
  ],
};
