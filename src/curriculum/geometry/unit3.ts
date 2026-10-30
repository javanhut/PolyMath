import { poly, type Rng } from "../../math/random";
import { md, type DiagramSpec, type Figure, type Generator, type SeriesColor, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Vertex names for triangles. No two share a letter, so any two make a pair. */
const TRIPLES = ["ABC", "DEF", "JKL", "PQR", "STU", "XYZ"];
const PERMS: readonly (readonly number[])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
const POSITION = ["1st", "2nd", "3rd"];

function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const oneTriangle = (r: Rng) => r.pick(TRIPLES).split("");
function twoTriangles(r: Rng): [string[], string[]] {
  const [a, b] = shuffle(r, TRIPLES);
  return [a!.split(""), b!.split("")];
}

/** px + q */
const lin = (p: number, q: number) => poly([[p, "x"], [q, ""]]);
/** A side named with its letters in alphabetical order. */
const side = (a: string, b: string) => (a < b ? a + b : b + a);
const validTriangle = (a: number, b: number, c: number) => a + b > c && b + c > a && a + c > b;
/** "A, B and C" */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const pairing = (t: string[], s: string[]) => md`${t[0]} \leftrightarrow ${s[0]}, \quad ${t[1]} \leftrightarrow ${s[1]}, \quad ${t[2]} \leftrightarrow ${s[2]}`;

/** Two linear expressions px + q and mx + n that agree at x, and the steps that solve px + q = mx + n. */
function linearSteps(p: number, q: number, m: number, n: number, x: number): Step[] {
  const [d, c] = p > m ? [p - m, n - q] : [m - p, q - n];
  // The constant that sits with the remaining x-term; if it is 0 there is nothing to move.
  const stays = p > m ? q : n;
  const note = md`Subtract $${poly([[Math.min(p, m), "x"]])}$ from both sides${stays === 0 ? "" : ", then move the constant term across"}.`;
  if (d === 1) return [{ math: md`x = ${c}`, note }];
  return [
    { math: p > m ? md`${poly([[d, "x"]])} = ${c}` : md`${c} = ${poly([[d, "x"]])}`, note },
    { math: md`x = ${x}`, note: d === 1 ? "" : md`Divide both sides by ${d}.` },
  ];
}

/** The line "name = p(x) + q = v" that substitutes x back in, without "1(...)" or "+ 0". */
function substitute(name: string, p: number, q: number, x: number, v: number, unit = ""): Step {
  const e = `${p === 1 ? x : `${p}(${x})`}${q === 0 ? "" : ` ${q < 0 ? "-" : "+"} ${Math.abs(q)}`}`;
  return { math: e === String(v) ? md`${name} = ${v}${unit}` : md`${name} = ${e} = ${v}${unit}`, note: "Substitute x back in." };
}

/** Coefficients for two different expressions px + q, mx + n that both equal v at x. */
function twoExpressions(r: Rng, x: number, v: number): [number, number, number, number] {
  const p = r.int(2, 7);
  let m = r.int(1, 6);
  while (m === p) m = r.int(1, 6);
  return r.next() < 0.5 ? [p, v - p * x, m, v - m * x] : [m, v - m * x, p, v - p * x];
}

const DEG = "Give the angle in degrees.";

// ── Practice figures ────────────────────────────────────────────────────────
// Figures are built from the generated numbers. Labels are placed here, not by
// the renderer, so they sit outside sides and inside angles whatever the shape.

type Pt = { x: number; y: number };
type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DiagramFigure = Extract<Figure, { kind: "diagram" }>;
type Seg = NonNullable<DiagramSpec["segments"]>[number];
type AngleMark = NonNullable<DiagramSpec["angles"]>[number];

const RAD = Math.PI / 180;
const pt = (x: number, y: number): Pt => ({ x, y });
const plus = (a: Pt, b: Pt) => pt(a.x + b.x, a.y + b.y);
const minus = (a: Pt, b: Pt) => pt(a.x - b.x, a.y - b.y);
const times = (a: Pt, k: number) => pt(a.x * k, a.y * k);
const norm = (a: Pt) => times(a, 1 / (Math.hypot(a.x, a.y) || 1));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mean = (ps: Pt[]) => times(ps.reduce(plus, pt(0, 0)), 1 / ps.length);
const turnBy = (a: Pt, deg: number) => pt(a.x * Math.cos(deg * RAD) - a.y * Math.sin(deg * RAD), a.x * Math.sin(deg * RAD) + a.y * Math.cos(deg * RAD));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** A triangle with angles a0, a1, a2 (degrees) at vertices 0, 1, 2. */
function triangleFromAngles([a0, a1, a2]: readonly number[]): Pt[] {
  const [b, c] = [Math.sin(a1! * RAD), Math.sin(a2! * RAD)];
  return [pt(0, 0), pt(c, 0), pt(b * Math.cos(a0! * RAD), b * Math.sin(a0! * RAD))];
}

/** A triangle with sides d01, d12 and d02 between vertices 0, 1 and 2. */
function triangleFromSides(d01: number, d12: number, d02: number): Pt[] {
  const a0 = Math.acos((d01 ** 2 + d02 ** 2 - d12 ** 2) / (2 * d01 * d02));
  return [pt(0, 0), pt(d01, 0), pt(d02 * Math.cos(a0), d02 * Math.sin(a0))];
}

/** Three different angles, none small, for a triangle whose shape is not given. */
function scaleneAngles(r: Rng): [number, number, number] {
  for (;;) {
    const a = r.int(38, 88);
    const b = r.int(38, 142 - a);
    const c = 180 - a - b;
    if (c >= 38 && Math.abs(a - b) >= 7 && Math.abs(b - c) >= 7 && Math.abs(a - c) >= 7) return [a, b, c];
  }
}

/** Scale so the longest side is `size`, mirror if asked, turn, and centre on the centroid. */
function pose(ps: Pt[], deg: number, mirror = false, size = 5): Pt[] {
  const longest = Math.max(...ps.map((p, i) => dist(p, ps[(i + 1) % ps.length]!)));
  const c = mean(ps);
  return ps.map((p) => {
    const q = times(minus(p, c), size / longest);
    return turnBy(mirror ? pt(-q.x, q.y) : q, deg);
  });
}

/**
 * A triangle sitting on one of its sides, the opposite vertex up, maybe mirrored, tilted a little.
 * Vertices in `keep` carry wide angle labels. An acute one sits best at an end of the level side,
 * an obtuse one at the top, where the label hangs into the widest part of the triangle.
 */
function seat(r: Rng, base: Pt[], mirror: boolean, keep: readonly number[] = []): Pt[] {
  const ps = mirror ? base.map((p) => pt(-p.x, p.y)) : base;
  const wide = (v: number) => {
    const [a, b] = [norm(minus(ps[(v + 1) % 3]!, ps[v]!)), norm(minus(ps[(v + 2) % 3]!, ps[v]!))];
    return a.x * b.x + a.y * b.y < 0.1;
  };
  // Side k joins vertices k and k + 1.
  const sides = [0, 1, 2].filter((k) => keep.every((v) => (v === k || v === (k + 1) % 3) !== wide(v)));
  const k = r.pick(sides.length ? sides : [0, 1, 2]);
  const [a, b, c] = [ps[k]!, ps[(k + 1) % 3]!, ps[(k + 2) % 3]!];
  let deg = -Math.atan2(b.y - a.y, b.x - a.x) / RAD;
  if (turnBy(minus(c, a), deg).y < 0) deg += 180;
  return pose(ps, deg + r.int(-10, 10));
}

/** Two congruent copies side by side; the second may be flipped and sit on a different side. */
function pairUp(r: Rng, base: Pt[], keep: [readonly number[], readonly number[]] = [[], []]): [Pt[], Pt[]] {
  const a = seat(r, base, false, keep[0]);
  const b = seat(r, base, r.next() < 0.5, keep[1]);
  const span = (ps: Pt[], k: "x" | "y") => [Math.min(...ps.map((p) => p[k])), Math.max(...ps.map((p) => p[k]))] as const;
  const [ax, bx, ay, by] = [span(a, "x"), span(b, "x"), span(a, "y"), span(b, "y")];
  // Side by side, or one above the other when that draws them clearly larger (a tall figure pushes the answer box down).
  const wide = { w: ax[1] - ax[0] + bx[1] - bx[0] + 2.8, h: Math.max(ay[1] - ay[0], by[1] - by[0]) };
  const tall = { w: Math.max(ax[1] - ax[0], bx[1] - bx[0]), h: ay[1] - ay[0] + by[1] - by[0] + 2.4 };
  const scale = (d: { w: number; h: number }) => Math.min(516 / (d.w + 2), 516 / (1.3 * (d.h + 2)));
  if (scale(tall) > 1.25 * scale(wide)) {
    const dy = ay[0] - by[1] - 2.4;
    return [a, b.map((p) => pt(p.x, p.y + dy))];
  }
  const dx = ax[1] - bx[0] + 2.8;
  return [a, b.map((p) => pt(p.x + dx, p.y))];
}

function compass(v: Pt): Dir {
  const k = Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4));
  return (["w", "sw", "s", "se", "e", "ne", "n", "nw", "w"] as const)[k + 4]!;
}
/** Label offsets the renderer uses, in screen directions (y down). */
const DIR_V: Record<Dir, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [0.75, -0.75], nw: [-0.75, -0.75], se: [0.75, 0.75], sw: [-0.75, 0.75] };

/** Rough width in pixels of a short LaTeX label at the figure's font size. */
function texWidth(tex: string): number {
  const ops = (tex.match(/ [+-] /g) ?? []).length;
  const s = tex.replace(/\^\\circ/g, "o").replace(/\\[a-zA-Z]+/g, "").replace(/[{}\s^]/g, "");
  return 7.5 * s.length + 7 * ops + 4;
}

/** The angle at vertex i of triangle t, between its two sides. */
const corner = (t: readonly string[], i: number) => ({ at: t[i]!, from: t[(i + 1) % 3]!, to: t[(i + 2) % 3]! });

class Sketch {
  private pts: { name: string; p: Pt; center: Pt; label?: string; dir?: Dir; hidden?: boolean }[] = [];
  private segs: Seg[] = [];
  private polys: NonNullable<DiagramSpec["polygons"]> = [];
  private angs: AngleMark[] = [];
  private sideTexts: { a: string; b: string; text: string; away: Pt }[] = [];
  private nameTexts: { name: string; dir: Pt }[] = [];
  private angleTexts: { at: string; from: string; to: string; text: string; r: number }[] = [];
  /** Set by build() when some angle label found no clear spot. */
  crowded = false;

  at(name: string): Pt {
    return this.pts.find((q) => q.name === name)!.p;
  }
  /** A named point. Its label goes on the side away from `center`, unless `dir` says otherwise. */
  point(name: string, p: Pt, o: { center?: Pt; label?: string; dir?: Dir; hidden?: boolean } = {}): this {
    if (!this.pts.some((q) => q.name === name)) this.pts.push({ name, p, center: o.center ?? p, label: o.label, dir: o.dir, hidden: o.hidden });
    return this;
  }
  /** Put a point's label on a chosen side, e.g. off a line that runs through it. */
  /** Write a point's name in any direction `dir` (a vector), not just the eight compass points. */
  nameToward(name: string, dir: Pt): this {
    this.pts.find((q) => q.name === name)!.label = "";
    this.nameTexts.push({ name, dir: norm(dir) });
    return this;
  }
  labelDir(name: string, dir: Dir): this {
    this.pts.find((q) => q.name === name)!.dir = dir;
    return this;
  }
  triangle(names: readonly string[], ps: Pt[], fill?: SeriesColor, center = mean(ps)): this {
    names.forEach((n, i) => this.point(n, ps[i]!, { center }));
    this.polys.push(fill ? { points: [...names], fill } : { points: [...names] });
    return this;
  }
  seg(from: string, to: string, o: Omit<Seg, "from" | "to" | "label"> = {}): this {
    this.segs.push({ from, to, ...o });
    return this;
  }
  /** A label beside segment ab, on the side away from `away` (default: the centre of a's triangle). */
  sideLabel(a: string, b: string, text: string, away?: Pt): this {
    this.sideTexts.push({ a, b, text, away: away ?? this.pts.find((q) => q.name === a)!.center });
    return this;
  }
  /** An angle mark, with an optional label placed inside the angle clear of both sides. */
  angle(m: AngleMark & { text?: string }): this {
    const { text, ...mark } = m;
    this.angs.push(mark);
    if (text) this.angleTexts.push({ at: m.at, from: m.from, to: m.to, text, r: m.right ? 17 : 20 + 4 * ((m.arcs ?? 1) - 1) });
    return this;
  }
  /** The unknown angle: an orange arc and a question mark. */
  unknownAngle(m: { at: string; from: string; to: string }, text = "?"): this {
    return this.angle({ ...m, color: 2, text });
  }

  build(caption?: string): DiagramFigure {
    const box0 = {
      x0: Math.min(...this.pts.map((q) => q.p.x)),
      x1: Math.max(...this.pts.map((q) => q.p.x)),
      y0: Math.min(...this.pts.map((q) => q.p.y)),
      y1: Math.max(...this.pts.map((q) => q.p.y)),
    };
    const span = Math.max(box0.x1 - box0.x0, box0.y1 - box0.y0);
    let view: [number, number, number, number] = [box0.x0 - 0.08 * span, box0.x1 + 0.08 * span, box0.y0 - 0.08 * span, box0.y1 + 0.08 * span];
    const dirs = this.pts.map((q) => q.dir ?? compass(minus(q.p, q.center)));
    let labels: { x: number; y: number; text: string }[] = [];
    // Every drawn line, with rays run well past the figure.
    const lines: [Pt, Pt][] = [
      ...this.polys.flatMap((g) => g.points.map((n, i): [Pt, Pt] => [this.at(n), this.at(g.points[(i + 1) % g.points.length]!)])),
      ...this.segs.map((s): [Pt, Pt] => {
        const [P, Q] = [this.at(s.from), this.at(s.to)];
        return [P, s.kind === "ray" ? plus(P, times(minus(Q, P), 100)) : Q];
      }),
    ];
    // Label offsets are in pixels, so they depend on the scale, which depends on the labels: settle it in a few passes.
    for (let pass = 0; pass < 3; pass++) {
      this.crowded = false;
      const u = Math.min(516 / (view[1] - view[0]), 556 / (view[3] - view[2]));
      const b = { ...box0 };
      const grow = (c: Pt, hw: number, hh: number) => {
        b.x0 = Math.min(b.x0, c.x - hw / u);
        b.x1 = Math.max(b.x1, c.x + hw / u);
        b.y0 = Math.min(b.y0, c.y - hh / u);
        b.y1 = Math.max(b.y1, c.y + hh / u);
      };
      labels = [];
      /** Label boxes placed so far, in figure units: centre and half sizes. */
      const boxes: { c: Pt; hw: number; hh: number }[] = [];
      const hits = (c: Pt, hw: number, hh: number) => boxes.some((o) => Math.abs(o.c.x - c.x) < o.hw + hw + 2 / u && Math.abs(o.c.y - c.y) < o.hh + hh + 2 / u);
      for (const s of this.sideTexts) {
        const [A, B] = [this.at(s.a), this.at(s.b)];
        const mid = times(plus(A, B), 0.5);
        let n = norm(pt(A.y - B.y, B.x - A.x));
        if ((mid.x - s.away.x) * n.x + (mid.y - s.away.y) * n.y < 0) n = times(n, -1);
        const hw = texWidth(s.text) / 2;
        const c = plus(mid, times(n, (9 + hw * Math.abs(n.x) + 9 * Math.abs(n.y)) / u));
        labels.push({ x: c.x, y: c.y, text: s.text });
        boxes.push({ c, hw: hw / u, hh: 9 / u });
        grow(c, hw, 9);
      }
      // Smallest angles first: they have the least room, so larger ones give way when labels collide.
      const size = (a: { at: string; from: string; to: string }) => {
        const V = this.at(a.at);
        const [p, q] = [norm(minus(this.at(a.from), V)), norm(minus(this.at(a.to), V))];
        return p.x * q.x + p.y * q.y;
      };
      for (const n of this.nameTexts) {
        const hw = texWidth(n.name) / 2;
        const c = plus(this.at(n.name), times(n.dir, (11 + Math.min(hw / Math.abs(n.dir.x || 1e-9), 9 / Math.abs(n.dir.y || 1e-9))) / u));
        labels.push({ x: c.x, y: c.y, text: n.name });
        boxes.push({ c, hw: hw / u, hh: 8 / u });
        grow(c, hw, 9);
      }
      // Point labels are fixed; angle labels must keep off them.
      this.pts.forEach((q, i) => {
        if (q.label === "") return;
        const w = texWidth(q.label ?? q.name);
        const [dx, dy] = DIR_V[dirs[i]!];
        const cx = dx > 0 ? 8 * dx + w / 2 : dx < 0 ? 8 * dx - w / 2 : 0;
        const c = pt(q.p.x + cx / u, q.p.y - (dy * 14) / u);
        boxes.push({ c, hw: w / 2 / u, hh: 8 / u });
        grow(c, w / 2, 9);
      });
      /** Does a label box (figure units) touch a drawn line, a vertex dot or another vertex's angle mark? */
      const blocked = (c: Pt, hw: number, hh: number, own: string) => {
        const [m, x0, x1, y0, y1] = [2 / u, c.x - hw, c.x + hw, c.y - hh, c.y + hh];
        const crosses = ([P, Q]: [Pt, Pt]) => {
          // Clip PQ to the box grown by m (Liang-Barsky).
          let [t0, t1] = [0, 1];
          const d = minus(Q, P);
          for (const [p, q] of [[-d.x, P.x - (x0 - m)], [d.x, x1 + m - P.x], [-d.y, P.y - (y0 - m)], [d.y, y1 + m - P.y]] as const) {
            if (Math.abs(p) < 1e-12) {
              if (q < 0) return false;
            } else if (p < 0) t0 = Math.max(t0, q / p);
            else t1 = Math.min(t1, q / p);
          }
          return t0 <= t1;
        };
        const away = (P: Pt, r: number) => Math.hypot(Math.max(x0 - P.x, 0, P.x - x1), Math.max(y0 - P.y, 0, P.y - y1)) < r / u;
        return (
          lines.some(crosses) ||
          this.pts.some((q) => !q.hidden && away(q.p, 6)) ||
          this.angs.some((g) => g.at !== own && away(this.at(g.at), (g.right ? 17 : 20 + 4 * ((g.arcs ?? 1) - 1)) + 3))
        );
      };
      for (const a of [...this.angleTexts].sort((p, q) => size(q) - size(p))) {
        const V = this.at(a.at);
        const [u1, u2] = [norm(minus(this.at(a.from), V)), norm(minus(this.at(a.to), V))];
        const bis = norm(plus(u1, u2));
        const hw = texWidth(a.text) / 2;
        const ext = (d: Pt) => hw * Math.abs(d.x) + 9 * Math.abs(d.y);
        // The nearest spot (in pixels from V) where the label box clears both sides: n1·c = e1 and n2·c = e2,
        // with n1, n2 the inward normals of the two sides.
        const inward = (e: Pt, other: Pt) => {
          const n = pt(-e.y, e.x);
          return n.x * other.x + n.y * other.y >= 0 ? n : times(n, -1);
        };
        const [n1, n2] = [inward(u1, u2), inward(u2, u1)];
        const [e1, e2] = [ext(n1) + 3, ext(n2) + 3];
        const det = n1.x * n2.y - n1.y * n2.x;
        let c0 = Math.abs(det) < 1e-6 ? times(bis, Math.max(e1, e2)) : pt((e1 * n2.y - e2 * n1.y) / det, (n1.x * e2 - n2.x * e1) / det);
        // Then clear the arc too, sliding out along the bisector.
        const clear = a.r + 4 + ext(norm(c0));
        if (Math.hypot(c0.x, c0.y) < clear) c0 = plus(c0, times(bis, clear - Math.hypot(c0.x, c0.y)));
        c0 = plus(V, times(c0, 1 / u));
        // If that spot is taken, try nearby spots that still clear both sides: further out along the bisector,
        // or along either side. Keep the nearest one that touches no other label, line or mark, and that sits
        // nearer its own vertex than any other, so it can't be read as another angle's label.
        const [hwu, hhu] = [hw / u, 9 / u];
        const side = (A: Pt, B: Pt, C: Pt) => Math.sign((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x));
        const fits = (q: Pt) =>
          // Sliding must not carry the label across a line, out of its own region.
          !lines.some(([P, Q]) => side(P, Q, c0) * side(P, Q, q) < 0 && side(c0, q, P) * side(c0, q, Q) < 0) &&
          !hits(q, hwu, hhu) &&
          !blocked(q, hwu, hhu, a.at) &&
          this.pts.every((o) => o.hidden || o.name === a.at || dist(q, o.p) > dist(q, V));
        let c: Pt | undefined;
        search: for (let s = 0; s <= 120; s += 3) {
          for (const d of [bis, u1, u2]) {
            const q = plus(c0, times(d, s / u));
            if (fits(q)) {
              c = q;
              break search;
            }
          }
        }
        // No good spot: leave it at the nearest one and let the caller try another layout.
        if (!c) {
          c = c0;
          this.crowded = true;
        }
        labels.push({ x: c.x, y: c.y, text: a.text });
        boxes.push({ c, hw: hwu, hh: hhu });
        grow(c, hw, 9);
      }
      const pad = 4 / u;
      view = [b.x0 - pad, b.x1 + pad, b.y0 - pad, b.y1 + pad];
      // Keep the figure at least 1.3 times as wide as tall, so it stays under about 400px high.
      const widen = (1.3 * (view[3] - view[2]) - (view[1] - view[0])) / 2;
      if (widen > 0) view = [view[0] - widen, view[1] + widen, view[2], view[3]];
    }
    return {
      kind: "diagram",
      view: view.map(r3) as [number, number, number, number],
      points: this.pts.map((q, i) => ({
        name: q.name,
        x: r3(q.p.x),
        y: r3(q.p.y),
        dir: dirs[i],
        ...(q.label !== undefined ? { label: q.label } : {}),
        ...(q.hidden ? { hidden: true } : {}),
      })),
      segments: this.segs,
      polygons: this.polys,
      angles: this.angs,
      labels: labels.map((l) => ({ x: r3(l.x), y: r3(l.y), text: l.text })),
      ...(caption ? { caption } : {}),
    };
  }
}

/** Two congruent triangles: vertex t[i] matches s[i]. */
function congruentPair(r: Rng, t: readonly string[], s: readonly string[], base: Pt[], keep: [readonly number[], readonly number[]] = [[], []]): Sketch {
  const [a, b] = pairUp(r, base, keep);
  return new Sketch().triangle(t, a, 1).triangle(s, b, 2);
}

/** Build a figure, drawing a fresh layout (seat, tilt, flip) while some angle label has no clear spot. */
function settle(make: () => Sketch, tries = 12): DiagramFigure {
  for (let k = 1; ; k++) {
    const sk = make();
    const fig = sk.build();
    if (!sk.crowded || k >= tries) return fig;
  }
}

/** "The answer is the a for which px + q and mx + n agree": a hidden check for a value found by setting two expressions equal. */
const agree = (p: number, q: number, m: number, n: number, a = "y") => `${m}*((${a} - (${q}))/${p}) + (${n}) = ${a}`;

// ── Lesson 1: Congruent figures ─────────────────────────────────────────────

const correspondingParts: Generator = (r) => {
  const [t, u] = twoTriangles(r);
  const s = r.pick(PERMS.slice(1)).map((k) => u[k]!);
  const [T, S, U] = [t.join(""), s.join(""), u.join("")];
  const stmt = md`$\triangle ${T} \cong \triangle ${S}$`;
  const kind = r.int(0, 3);
  const hint = "Read the statement by position: 1st letter with 1st letter, 2nd with 2nd, 3rd with 3rd.";
  if (kind === 0) {
    const pairs = [[0, 1], [1, 2], [0, 2]] as const;
    const [i, j] = r.pick(pairs);
    return {
      prompt: md`${stmt}. Which side of $\triangle ${S}$ corresponds to $\overline{${t[i]}${t[j]}}$?`,
      choices: shuffle(r, pairs.map(([a, b]) => md`$\overline{${s[a]}${s[b]}}$`)),
      accept: [md`$\overline{${s[i]}${s[j]}}$`],
      hint,
      solution: [
        { math: pairing(t, s), note: "Pair the letters by position in the statement." },
        {
          math: md`\overline{${t[i]}${t[j]}} \leftrightarrow \overline{${s[i]}${s[j]}}`,
          note: md`$${t[i]}$ and $${t[j]}$ are the ${POSITION[i]} and ${POSITION[j]} letters of $\triangle ${T}$, so the matching side is made of the ${POSITION[i]} and ${POSITION[j]} letters of $\triangle ${S}$.`,
        },
      ],
    };
  }
  if (kind === 1) {
    const i = r.int(0, 2);
    return {
      prompt: md`${stmt}. Which angle of $\triangle ${S}$ corresponds to $\angle ${t[i]}$?`,
      choices: shuffle(r, u.map((v) => md`$\angle ${v}$`)),
      accept: [md`$\angle ${s[i]}$`],
      hint,
      solution: [
        { math: pairing(t, s), note: "Pair the letters by position in the statement." },
        { math: md`\angle ${t[i]} = \angle ${s[i]}`, note: md`$${t[i]}$ is the ${POSITION[i]} letter of the first triangle, and $${s[i]}$ is the ${POSITION[i]} letter of the second.` },
      ],
    };
  }
  if (kind === 2) {
    const sigma = r.pick(PERMS.slice(1));
    const first = sigma.map((k) => t[k]).join("");
    const good = sigma.map((k) => s[k]).join("");
    const bad = shuffle(r, PERMS.filter((q) => q !== sigma))
      .slice(0, 3)
      .map((q) => q.map((k) => s[k]).join(""));
    return {
      prompt: md`${stmt}. Which of these says exactly the same thing?`,
      choices: shuffle(r, [good, ...bad].map((w) => md`$\triangle ${first} \cong \triangle ${w}$`)),
      accept: [md`$\triangle ${first} \cong \triangle ${good}$`],
      hint: "You may list the vertices in any order, as long as every letter keeps the same partner. Check the three pairs in each option.",
      solution: [
        { math: pairing(t, s), note: "These three pairs are the whole content of the statement." },
        {
          math: md`\triangle ${first} \cong \triangle ${good}`,
          note: md`Here the first triangle is listed as ${first}. Writing each partner underneath its letter gives ${good}. Every other option splits up at least one pair.`,
        },
      ],
    };
  }
  const p = s;
  const bad = shuffle(r, PERMS.map((q) => q.map((k) => u[k]!).join("")).filter((w) => w !== p.join(""))).slice(0, 3);
  const sk = congruentPair(r, t, s, triangleFromAngles(scaleneAngles(r)));
  for (const i of [0, 1, 2]) for (const tri of [t, s]) sk.angle({ ...corner(tri, i), arcs: (i + 1) as 1 | 2 | 3 });
  return {
    prompt: md`$\triangle ${T}$ and $\triangle ${U}$ in the figure are congruent. Angles with the same number of arcs are equal. Which congruence statement is correct?`,
    figure: sk.build(),
    choices: shuffle(r, [S, ...bad].map((w) => md`$\triangle ${T} \cong \triangle ${w}$`)),
    accept: [md`$\triangle ${T} \cong \triangle ${S}$`],
    hint: md`Write $\triangle ${T}$ first, then put each vertex's partner under it. A vertex's partner has the same number of arcs.`,
    solution: [
      { math: pairing(t, s), note: "Read the partners off the arcs." },
      { math: md`\triangle ${T} \cong \triangle ${S}`, note: md`The partner of $${t[0]}$ goes first, then the partner of $${t[1]}$, then the partner of $${t[2]}$.` },
    ],
  };
};

const correspondingValues: Generator = (r) => {
  const [t, u] = twoTriangles(r);
  const s = r.pick(PERMS).map((k) => u[k]!);
  const [T, S, U] = [t.join(""), s.join(""), u.join("")];
  const stmt = md`$\triangle ${T} \cong \triangle ${S}$`;
  const kind = r.int(0, 2);
  if (kind === 0) {
    const pairs = [[0, 1], [1, 2], [0, 2]] as const;
    let L: number[];
    do L = [r.int(4, 15), r.int(4, 15), r.int(4, 15)];
    while (new Set(L).size < 3 || !validTriangle(L[0]!, L[1]!, L[2]!));
    const given = pairs
      .map(([i, j], k) => ({ name: side(s[i]!, s[j]!), len: L[k]! }))
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    const ask = r.int(0, 2);
    const [i, j] = pairs[ask]!;
    const nameT = side(t[i]!, t[j]!);
    const nameS = side(s[i]!, s[j]!);
    const sk = congruentPair(r, t, s, triangleFromSides(L[0]!, L[1]!, L[2]!));
    pairs.forEach(([a, b], k) => sk.sideLabel(s[a]!, s[b]!, String(L[k])));
    sk.seg(t[i]!, t[j]!, { color: 2 }).sideLabel(t[i]!, t[j]!, "?");
    return {
      prompt: md`${stmt}. Find $${nameT}$ in the figure.`,
      figure: sk.build(),
      answer: String(L[ask]),
      verify: [`y = ${given.find((g) => g.name === nameS)!.len}`],
      hint: md`Which letters of $\triangle ${S}$ sit in the same positions as $${t[i]}$ and $${t[j]}$?`,
      solution: [
        { math: pairing(t, s), note: "Pair the letters by position." },
        { math: md`\overline{${nameT}} \leftrightarrow \overline{${nameS}}`, note: md`$${t[i]} \leftrightarrow ${s[i]}$ and $${t[j]} \leftrightarrow ${s[j]}$.` },
        { math: md`${nameT} = ${nameS} = ${L[ask]}`, note: "Corresponding parts of congruent triangles are equal (CPCTC)." },
      ],
    };
  }
  let A: number[];
  do {
    const a0 = r.int(25, 100);
    const a1 = r.int(25, 155 - a0);
    A = [a0, a1, 180 - a0 - a1];
  } while (new Set(A).size < 3 || A[2]! < 25);
  if (kind === 1) {
    const [j1, j2] = shuffle(r, [0, 1, 2]).slice(0, 2).sort((a, b) => (s[a]! < s[b]! ? -1 : 1)) as [number, number];
    const k = r.int(0, 2);
    const direct = k === j1 || k === j2;
    const third = 3 - j1 - j2;
    const figure = settle(() => {
      const sk = congruentPair(r, t, s, triangleFromAngles(A), [[k], [j1, j2]]);
      for (const g of [j1, j2]) sk.angle({ ...corner(s, g), text: md`${A[g]}^\circ` });
      return sk.unknownAngle(corner(t, k));
    });
    return {
      prompt: md`${stmt}. Find $\angle ${t[k]}$ in the figure. ${DEG}`,
      figure,
      answer: String(A[k]),
      verify: [direct ? `y = ${A[k]}` : `y + ${A[j1]} + ${A[j2]} = 180`],
      hint: direct ? md`Find the partner of $${t[k]}$ in the statement.` : md`The partner of $${t[k]}$ is the angle you weren't given. What is left of $180^\circ$?`,
      solution: [
        { math: pairing(t, s), note: "Pair the letters by position." },
        ...(direct
          ? [{ math: md`\angle ${t[k]} = \angle ${s[k]} = ${A[k]}^\circ`, note: "Corresponding angles of congruent triangles are equal." }]
          : [
              { math: md`\angle ${s[third]} = 180^\circ - ${A[j1]}^\circ - ${A[j2]}^\circ = ${A[third]}^\circ`, note: md`Triangle Angle Sum Theorem in $\triangle ${S}$.` },
              { math: md`\angle ${t[k]} = \angle ${s[k]} = ${A[k]}^\circ`, note: md`$${t[k]}$ corresponds to $${s[k]}$.` },
            ]),
      ],
    };
  }
  const [i, j, k] = shuffle(r, [0, 1, 2]) as [number, number, number];
  const askFirst = r.next() < 0.5;
  const target = askFirst ? t[k]! : s[k]!;
  const figure = settle(() =>
    congruentPair(r, t, s, triangleFromAngles(A), askFirst ? [[i, k], [j]] : [[i], [j, k]])
      .angle({ ...corner(t, i), text: md`${A[i]}^\circ` })
      .angle({ ...corner(s, j), text: md`${A[j]}^\circ` })
      .unknownAngle(corner(askFirst ? t : s, k)),
  );
  return {
    prompt: md`${stmt}. Find $\angle ${target}$ in the figure. ${DEG}`,
    figure,
    answer: String(A[k]),
    verify: [`y + ${A[i]} + ${A[j]} = 180`],
    hint: md`Copy each given angle to its partner first, so that one triangle has two known angles.`,
    solution: [
      { math: pairing(t, s), note: "Pair the letters by position." },
      { math: md`\angle ${s[i]} = \angle ${t[i]} = ${A[i]}^\circ, \quad \angle ${t[j]} = \angle ${s[j]} = ${A[j]}^\circ`, note: "CPCTC: now both triangles have two known angles." },
      { math: md`\angle ${target} = 180^\circ - ${A[i]}^\circ - ${A[j]}^\circ = ${A[k]}^\circ`, note: "Triangle Angle Sum Theorem." },
    ],
  };
};

const congruenceAlgebra: Generator = (r) => {
  const [t, u] = twoTriangles(r);
  const s = r.pick(PERMS).map((k) => u[k]!);
  const stmt = md`$\triangle ${t.join("")} \cong \triangle ${s.join("")}$`;
  const isAngle = r.next() < 0.45;
  const x = r.int(2, 12);
  const v = isAngle ? r.int(45, 100) : r.int(6, 40);
  const [p, q, m, n] = twoExpressions(r, x, v);
  const [E1, E2] = [lin(p, q), lin(m, n)];
  const pairs = [[0, 1], [1, 2], [0, 2]] as const;
  const k = r.int(0, 2);
  const [i, j] = pairs[k]!;
  const n1 = isAngle ? md`\angle ${t[k]}` : side(t[i]!, t[j]!);
  const n2 = isAngle ? md`\angle ${s[k]}` : side(s[i]!, s[j]!);
  const show = (e: string) => (isAngle ? md`(${e})^\circ` : e);
  const what = isAngle ? "angles" : "sides";
  const match = { math: md`${n1} = ${n2}`, note: md`They are corresponding ${what} (same positions in ${stmt}), so CPCTC makes them equal.` };
  /** Both triangles drawn to scale from the known part sizes, with the parts labelled. */
  const figure = (parts: { k: number; size: number; tri: string[]; text: string }[]) => {
    let base: Pt[];
    if (isAngle) {
      const A = [0, 0, 0];
      for (const pr of parts) A[pr.k] = pr.size;
      const free = [0, 1, 2].filter((z) => !A[z]);
      const left = 180 - A.reduce((a, b) => a + b, 0);
      if (free.length === 1) A[free[0]!] = left;
      else {
        A[free[0]!] = r.int(25, left - 25);
        A[free[1]!] = left - A[free[0]!]!;
      }
      base = triangleFromAngles(A);
    } else if (new Set(parts.map((pr) => pr.k)).size === 1) base = triangleFromAngles(scaleneAngles(r));
    else {
      const len = [0, 0, 0];
      for (const pr of parts) len[pr.k] = pr.size;
      const free = len.indexOf(0);
      const others = len.filter((z) => z);
      len[free] = ((others[0]! + others[1]!) / 2) * (0.75 + 0.5 * r.next());
      base = triangleFromSides(len[0]!, len[1]!, len[2]!);
    }
    const keep = (tri: string[]) => (isAngle ? parts.filter((pr) => pr.tri === tri).map((pr) => pr.k) : []);
    return settle(() => {
      const sk = congruentPair(r, t, s, base, [keep(t), keep(s)]);
      for (const pr of parts) {
        if (isAngle) sk.angle({ ...corner(pr.tri, pr.k), text: md`(${pr.text})^\circ` });
        else sk.sideLabel(pr.tri[pairs[pr.k]![0]]!, pr.tri[pairs[pr.k]![1]]!, pr.text);
      }
      return sk;
    });
  };
  if (r.next() < 0.65) {
    return {
      prompt: md`Solve $${E1} = ${E2}$. It comes from ${stmt} in the figure, where $${n1} = ${show(E1)}$ and $${n2} = ${show(E2)}$ are corresponding ${what}.`,
      figure: figure([
        { k, size: v, tri: t, text: E1 },
        { k, size: v, tri: s, text: E2 },
      ]),
      answer: String(x),
      hint: "Corresponding parts are equal, which is where the equation comes from. Collect the x-terms on one side.",
      solution: [match, { math: md`${E1} = ${E2}`, note: "Substitute the expressions." }, ...linearSteps(p, q, m, n, x)],
    };
  }
  // A distractor: another part of the second triangle that does not correspond.
  const k2 = (k + r.int(1, 2)) % 3;
  const [i2, j2] = pairs[k2]!;
  const n3 = isAngle ? md`\angle ${s[k2]}` : side(s[i2]!, s[j2]!);
  // Keep side lengths within a factor of 1.6 of each other, so the figure can be drawn to scale.
  const draw = () => (isAngle ? r.int(45, 145 - v) : r.int(Math.max(5, Math.ceil(0.6 * v)), Math.min(40, Math.floor(1.6 * v))));
  let w = draw();
  while (w === v) w = draw();
  const p3 = r.int(1, 5);
  const E3 = lin(p3, w - p3 * x);
  return {
    prompt: md`${stmt}. Use the figure to find $${n1}$.${isAngle ? ` ${DEG}` : ""}`,
    figure: figure([
      { k, size: v, tri: t, text: E1 },
      { k, size: v, tri: s, text: E2 },
      { k: k2, size: w, tri: s, text: E3 },
    ]),
    answer: String(v),
    verify: [agree(p, q, m, n)],
    hint: md`Only one of the other two parts corresponds to $${n1}$. Use the letter positions to pick it, set the two equal, and solve.`,
    solution: [
      { math: pairing(t, s), note: "Pair the letters by position." },
      match,
      { math: md`${E1} = ${E2}`, note: md`$${n3}$ is a different part, so it plays no role.` },
      ...linearSteps(p, q, m, n, x),
      substitute(n1, p, q, x, v, isAngle ? "^\\circ" : ""),
    ],
  };
};

// ── Lesson 2: SSS, SAS, ASA, AAS ────────────────────────────────────────────

type Part = { side: [number, number] } | { angle: number; right?: boolean };
type Test = "SSS" | "SAS" | "ASA" | "AAS" | "HL" | "LL" | "SSA" | "AAA";
const NOT_ENOUGH = "not enough information";

/** The three given parts for a test, with the vertices playing roles i, j, k. */
function partsFor(test: Test, roles: readonly number[]): Part[] {
  const [i = 0, j = 1, k = 2] = roles;
  const S = (a: number, b: number): Part => ({ side: a < b ? [a, b] : [b, a] });
  switch (test) {
    case "SSS":
      return [S(0, 1), S(1, 2), S(0, 2)];
    case "SAS":
      return [{ angle: k }, S(k, i), S(k, j)];
    case "ASA":
      return [{ angle: i }, { angle: j }, S(i, j)];
    case "AAS":
      return [{ angle: i }, { angle: j }, S(j, k)];
    case "HL":
      return [{ angle: k, right: true }, S(i, j), S(i, k)];
    case "LL":
      return [{ angle: k, right: true }, S(i, k), S(j, k)];
    case "SSA":
      return [{ angle: i }, S(i, j), S(j, k)];
    case "AAA":
      return [{ angle: 0 }, { angle: 1 }, { angle: 2 }];
  }
}

/** Tick and arc marks for the given parts, in every triangle listed (vertex i matches vertex i). */
function markParts(sk: Sketch, tris: readonly (readonly string[])[], parts: Part[]) {
  let ticks = 0;
  let arcs = 0;
  for (const p of parts) {
    if ("side" in p) {
      const k = ++ticks as 1 | 2 | 3;
      for (const t of tris) sk.seg(t[p.side[0]]!, t[p.side[1]]!, { ticks: k });
    } else {
      const mark = p.right ? { right: true } : { arcs: ++arcs as 1 | 2 | 3 };
      for (const t of tris) sk.angle({ ...corner(t, p.angle), ...mark });
    }
  }
}

/** Angles for a triangle that fits the test: a right angle where HL or LL puts one, otherwise any scalene shape. */
function shapeFor(r: Rng, test: Test, roles: readonly number[]): number[] {
  if (test !== "HL" && test !== "LL") return scaleneAngles(r);
  const A = [0, 0, 0];
  const a = r.int(32, 58);
  A[roles[2]!] = 90;
  A[roles[0]!] = a;
  A[roles[1]!] = 90 - a;
  return A;
}

const testAnswer = (test: Test) => (test === "LL" ? "SAS" : test === "SSA" || test === "AAA" ? NOT_ENOUGH : test);

/** Why the given parts match (or fail) their test, in terms of triangle t. */
function testReason(test: Test, t: string[], roles: readonly number[], ang = (a: number) => t[a]!): Step[] {
  const [i = 0, j = 1, k = 2] = roles;
  const seg = (a: number, b: number) => md`\overline{${side(t[a]!, t[b]!)}}`;
  switch (test) {
    case "SSS":
      return [{ math: md`\text{3 sides}`, note: "All three pairs of sides are equal: **SSS**." }];
    case "SAS":
    case "LL":
      return [
        { math: md`${seg(k, i)}, \; \angle ${ang(k)}, \; ${seg(k, j)}`, note: md`$\angle ${ang(k)}$ is formed by $${seg(k, i)}$ and $${seg(k, j)}$, so it is the included angle: **SAS**.${test === "LL" ? " (A right angle is still an angle; two legs and the right angle between them is SAS.)" : ""}` },
      ];
    case "ASA":
      return [{ math: md`\angle ${ang(i)}, \; ${seg(i, j)}, \; \angle ${ang(j)}`, note: md`$${seg(i, j)}$ joins the vertices of the two angles, so it is the included side: **ASA**.` }];
    case "AAS":
      return [{ math: md`\angle ${ang(i)}, \; \angle ${ang(j)}, \; ${seg(j, k)}`, note: md`The side between $\angle ${ang(i)}$ and $\angle ${ang(j)}$ would be $${seg(i, j)}$. The given side $${seg(j, k)}$ is not between them: **AAS**.` }];
    case "HL":
      return [
        { math: md`\angle ${ang(k)} = 90^\circ`, note: "Both triangles are right triangles." },
        { math: md`${seg(i, j)} \text{ and } ${seg(i, k)}`, note: md`$${seg(i, j)}$ is opposite the right angle, so it is the hypotenuse; $${seg(i, k)}$ is a leg: **HL**.` },
      ];
    case "SSA":
      return [
        { math: md`${seg(i, j)}, \; ${seg(j, k)}, \; \angle ${ang(i)}`, note: md`$\angle ${ang(i)}$ is not between $${seg(i, j)}$ and $${seg(j, k)}$ (that would be $\angle ${ang(j)}$). This is side-side-angle.` },
        { math: md`\text{${NOT_ENOUGH}}`, note: "SSA is not a test: two different triangles can share these parts, as the slider in the lesson shows." },
      ];
    case "AAA":
      return [{ math: md`\text{3 angles}`, note: "Equal angles fix the shape but not the size: a small and a large copy have the same angles. **Not enough information.**" }];
  }
}

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
/** Angle a of triangle t, named by three letters so a shared vertex is not ambiguous. */
const angName = (t: string[], a: number) => {
  const [b, c] = [0, 1, 2].filter((z) => z !== a) as [number, number];
  return `${t[b]}${t[a]}${t[c]}`;
};
// Tests and roles whose parts include the free pair: side [1, 2] when shared, angle 1 when vertical.
const SHARED_SIDE: [Test, number[]][] = [
  ["SSS", [0, 1, 2]], ["SAS", [2, 0, 1]], ["SAS", [1, 0, 2]], ["ASA", [1, 2, 0]], ["AAS", [0, 1, 2]], ["AAS", [0, 2, 1]],
  ["HL", [1, 0, 2]], ["HL", [2, 0, 1]], ["SSA", [1, 2, 0]], ["SSA", [0, 1, 2]],
];
const VERTICAL: [Test, number[]][] = [
  ["SAS", [0, 2, 1]], ["SAS", [0, 2, 1]], ["ASA", [0, 1, 2]], ["ASA", [2, 1, 0]], ["AAS", [1, 0, 2]], ["AAS", [1, 2, 0]],
  ["AAS", [0, 1, 2]], ["AAS", [2, 1, 0]], ["AAA", [0, 1, 2]], ["SSA", [1, 0, 2]], ["SSA", [1, 2, 0]],
];

/** Two given facts; the figure supplies the third pair (a shared side or vertical angles). */
function hiddenPart(r: Rng) {
  const shared = r.next() < 0.5;
  const [test, roles] = r.pick(shared ? SHARED_SIDE : VERTICAL);
  const L = shuffle(r, LETTERS);
  // Shared side: t = R1 P Q and u = R2 P Q. Vertical angles: t = A M B and u = D M C.
  const t = [L[0]!, L[1]!, L[2]!];
  const u = shared ? [L[3]!, L[1]!, L[2]!] : [L[3]!, L[1]!, L[4]!];
  const free = (p: Part) => (shared ? "side" in p && p.side[0] === 1 && p.side[1] === 2 : "angle" in p && p.angle === 1);
  const [T, U] = [t.join(""), u.join("")];
  // The figure: t drawn to fit the test, and u its mirror image in the shared side, or its half-turn about the crossing.
  const tp = triangleFromAngles(shapeFor(r, test, roles));
  let up: Pt[];
  if (shared) {
    const d = norm(minus(tp[2]!, tp[1]!));
    const foot = plus(tp[1]!, times(d, (tp[0]!.x - tp[1]!.x) * d.x + (tp[0]!.y - tp[1]!.y) * d.y));
    up = [minus(times(foot, 2), tp[0]!), tp[1]!, tp[2]!];
  } else up = [minus(times(tp[1]!, 2), tp[0]!), tp[1]!, minus(times(tp[1]!, 2), tp[2]!)];
  // Turn the whole figure so the shared side stands upright, or by a small random amount.
  const along = minus(tp[2]!, tp[1]!);
  const spin = shared ? r.pick([90, -90]) - Math.atan2(along.y, along.x) / RAD + r.int(-12, 12) : r.int(-30, 30);
  const scale = 5 / Math.max(dist(tp[0]!, tp[1]!), dist(tp[1]!, tp[2]!), dist(tp[0]!, tp[2]!));
  const all = [...tp, up[0]!, up[2]!];
  const c0 = mean(all);
  const place = (p: Pt) => turnBy(times(minus(p, c0), scale), spin);
  const [ta, ua] = [tp.map(place), up.map(place)];
  const sk = new Sketch();
  if (shared) {
    const middle = mean([ta[1]!, ta[2]!]);
    sk.point(t[1]!, ta[1]!, { center: middle }).point(t[2]!, ta[2]!, { center: middle });
  } else {
    // Four segments leave the crossing: put its label in the compass direction farthest from all of them.
    const rays = [ta[0]!, ta[2]!, ua[0]!, ua[2]!].map((p) => Math.atan2(p.y - ta[1]!.y, p.x - ta[1]!.x) / RAD).sort((a, b) => a - b);
    const gaps = rays.map((a, i) => ({ from: a, size: (i < 3 ? rays[i + 1]! : rays[0]! + 360) - a }));
    const wide = gaps.reduce((a, b) => (b.size > a.size ? b : a));
    sk.point(t[1]!, ta[1]!).nameToward(t[1]!, turnBy(pt(1, 0), wide.from + wide.size / 2));
  }
  sk.triangle(t, ta, 1).triangle(u, ua, 2);
  markParts(sk, [t, u], shuffle(r, partsFor(test, roles).filter((p) => !free(p))));
  const setup = shared
    ? md`In the figure, $\triangle ${T}$ and $\triangle ${U}$ share the side $\overline{${side(t[1]!, t[2]!)}}$.`
    : md`In the figure, $\overline{${t[0]}${u[0]}}$ and $\overline{${t[2]}${u[2]}}$ cross at $${t[1]}$.`;
  const freeStep: Step = shared
    ? { math: md`${t[1]}${t[2]} = ${t[1]}${t[2]}`, note: "Reflexive Property: the shared side is a third pair of equal parts, given by the figure." }
    : { math: md`\angle ${angName(t, 1)} = \angle ${angName(u, 1)}`, note: "Vertical Angles Theorem: the angles at the crossing are a third pair of equal parts, given by the figure." };
  return {
    prompt: md`${setup} The marks show two pairs of equal parts. Find the third pair of equal parts the figure gives you. Which congruence test do the three pairs match, for $\triangle ${T}$ and $\triangle ${U}$?`,
    figure: sk.build(),
    choices: shuffle(r, ["SSS", "SAS", "ASA", "AAS", "HL", NOT_ENOUGH]),
    accept: [testAnswer(test)],
    hint: shared ? "Both triangles use the same side. Which property says a segment equals itself?" : "Two segments cross. What do you know about the angles opposite each other at the crossing?",
    solution: [freeStep, ...testReason(test, t, roles, (a) => angName(t, a))],
  };
}

const whichCriterion: Generator = (r) => {
  if (r.next() < 0.35) return hiddenPart(r);
  const [t, u] = twoTriangles(r);
  const test = r.pick<Test>(["SSS", "SAS", "SAS", "ASA", "ASA", "AAS", "AAS", "HL", "LL", "SSA", "SSA", "AAA"]);
  const roles = shuffle(r, [0, 1, 2]);
  const answer = testAnswer(test);
  const sk = congruentPair(r, t, u, triangleFromAngles(shapeFor(r, test, roles)));
  markParts(sk, [t, u], shuffle(r, partsFor(test, roles)));
  return {
    prompt: md`The marks show which parts of $\triangle ${t.join("")}$ and $\triangle ${u.join("")}$ are equal. Which congruence test do the marked parts match, exactly as marked?`,
    figure: sk.build(),
    choices: shuffle(r, ["SSS", "SAS", "ASA", "AAS", "HL", NOT_ENOUGH]),
    accept: [answer],
    hint: "Look at one triangle. Is a marked angle between the two marked sides? Is a marked side between the two marked angles?",
    solution: testReason(test, t, roles),
  };
};

const ssaCount: Generator = (r) => {
  const roll = r.next();
  if (roll < 0.6) {
    const [l1, l2, h] = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20]] as const);
    const d = r.pick([l1, l2]);
    const AB = h;
    const options: string[] = ["one", "tangent"];
    if (AB - d >= 2) options.push("two", "two", "two");
    if (d >= 2) options.push("zero");
    const c = r.pick(options);
    const BC = c === "zero" ? r.int(1, d - 1) : c === "tangent" ? d : c === "two" ? r.int(d + 1, AB - 1) : r.int(AB, AB + 6);
    const count = c === "zero" ? 0 : c === "two" ? 2 : 1;
    const verdict: Step =
      c === "zero"
        ? { math: md`${BC} < ${d}`, note: md`You never get as close to $B$ as ${BC}. No point works: **0** triangles.` }
        : c === "tangent"
          ? { math: md`${BC} = ${d}`, note: md`Distance ${d} happens only once, at the closest point. **1** triangle, with a right angle at $C$.` }
          : c === "two"
            ? { math: md`${d} < ${BC} < ${AB}`, note: md`Distance ${BC} happens twice: once on the way in, once on the way out. **2** triangles.` }
            : {
                math: md`${BC} \ge ${AB}`,
                note: md`On the way in, the distance is never more than ${AB}${BC === AB ? " except at A itself, which can't be C" : ""}. On the way out it passes ${BC} once. **1** triangle.`,
              };
    // Drawn to scale: the ray along the x-axis, B above the foot F of the perpendicular.
    const s = 6 / AB;
    const fx = Math.sqrt(AB * AB - d * d) * s;
    const sk = new Sketch()
      .point("A", pt(0, 0), { dir: "w" })
      .point("F", pt(fx, 0), { label: "", hidden: true })
      .point("X", pt(2 * fx + 1.5, 0), { label: "", hidden: true })
      .point("B", pt(fx, d * s), { dir: "n" })
      .seg("A", "X", { kind: "ray" })
      .seg("A", "B")
      .seg("B", "F", { dashed: true })
      .sideLabel("A", "B", String(AB), pt(fx, 0))
      .sideLabel("B", "F", String(d), pt(0, 0))
      .angle({ at: "A", from: "X", to: "B" })
      .angle({ at: "F", from: "X", to: "B", right: true });
    return {
      prompt: md`In the figure, the angle at $A$ is fixed, and $C$ is a point on the ray from $A$ with $BC = ${BC}$. The dashed segment shows how far $B$ is from the ray. How many different triangles $ABC$ fit these facts? Give 0, 1 or 2.`,
      figure: sk.build(),
      answer: String(count),
      hint: "C lies on a fixed ray from A. Walk along that ray: how does your distance to B change? Count how often it equals BC.",
      solution: [
        { math: md`${AB} \;\searrow\; ${d} \;\nearrow\; \infty`, note: md`Walking along the ray from $A$, your distance to $B$ starts at $AB = ${AB}$, shrinks to ${d} at the point closest to $B$, then grows without end.` },
        verdict,
      ],
    };
  }
  const angle = roll < 0.8 ? 90 : r.pick([120, 135, 150]);
  const AB = r.int(4, 12);
  const BC = r.next() < 0.5 ? r.int(AB + 1, AB + 8) : r.int(2, AB);
  const count = BC > AB ? 1 : 0;
  const B = times(pt(Math.cos(angle * RAD), Math.sin(angle * RAD)), 5);
  const sk = new Sketch()
    .point("A", pt(0, 0), { dir: "s" })
    .point("X", pt(8, 0), { label: "", hidden: true })
    .point("B", B, { dir: angle === 90 ? "n" : "nw" })
    .seg("A", "X", { kind: "ray" })
    .seg("A", "B")
    .sideLabel("A", "B", String(AB), pt(5, 0))
    .angle(angle === 90 ? { at: "A", from: "X", to: "B", right: true } : { at: "A", from: "X", to: "B", text: md`${angle}^\circ` });
  return {
    prompt: md`In the figure, $C$ is a point on the ray from $A$ with $BC = ${BC}$. How many different triangles $ABC$ fit these facts? Give 0, 1 or 2.`,
    figure: sk.build(),
    answer: String(count),
    hint: `C lies on a fixed ray from A. Because the angle at A is ${angle === 90 ? "right" : "obtuse"}, does walking along that ray bring you closer to B, or only farther away?`,
    solution: [
      { math: md`${AB} \;\nearrow\; \infty`, note: md`The ray from $A$ points ${angle === 90 ? "at a right angle to" : "away from"} $\overline{AB}$, so walking along it only takes you farther from $B$. Your distance starts at $AB = ${AB}$ and grows.` },
      count
        ? { math: md`${BC} > ${AB}`, note: md`Every distance above ${AB} happens exactly once. **1** triangle.` }
        : { math: md`${BC} \le ${AB}`, note: md`The distance is never as small as ${BC} anywhere past $A$. **0** triangles.` },
    ],
  };
};

const cpctcAlgebra: Generator = (r) => {
  const t = oneTriangle(r);
  let u = oneTriangle(r);
  while (u[0] === t[0]) u = oneTriangle(r);
  const test = r.pick<Test>(["SSS", "SAS", "ASA", "AAS", "HL"]);
  const roles = shuffle(r, [0, 1, 2]);
  const given = partsFor(test, roles);
  const all: Part[] = [{ side: [0, 1] }, { side: [1, 2] }, { side: [0, 2] }, { angle: 0 }, { angle: 1 }, { angle: 2 }];
  const used = (p: Part) => given.some((g) => ("side" in g && "side" in p ? g.side[0] === p.side[0] && g.side[1] === p.side[1] : "angle" in g && "angle" in p && g.angle === p.angle));
  const target = r.pick(all.filter((p) => !used(p)));
  const isAngle = "angle" in target;
  const n1 = isAngle ? md`\angle ${t[target.angle]}` : md`${t[target.side[0]]}${t[target.side[1]]}`;
  const n2 = isAngle ? md`\angle ${u[target.angle]}` : md`${u[target.side[0]]}${u[target.side[1]]}`;
  const x = r.int(2, 12);
  const v = isAngle ? r.int(45, test === "HL" ? 65 : 110) : r.int(6, 40);
  const [p, q, m, n] = twoExpressions(r, x, v);
  const [E1, E2] = [lin(p, q), lin(m, n)];
  const show = (e: string) => (isAngle ? md`(${e})^\circ` : e);
  const T = t.join("");
  const U = u.join("");
  // The figure: a shape that fits the test, with the target angle drawn to scale.
  let A = shapeFor(r, test, roles);
  if (isAngle) {
    A = [0, 0, 0];
    A[target.angle] = v;
    const rest = [0, 1, 2].filter((z) => z !== target.angle);
    const right = test === "HL" ? roles[2]! : -1;
    if (right >= 0) {
      A[right] = 90;
      A[rest.find((z) => z !== right)!] = 90 - v;
    } else {
      A[rest[0]!] = r.int(25, 155 - v);
      A[rest[1]!] = 180 - v - A[rest[0]!]!;
    }
  }
  const keep = isAngle ? [target.angle] : [];
  const marks = shuffle(r, given);
  const figure = settle(() => {
    const sk = congruentPair(r, t, u, triangleFromAngles(A), [keep, keep]);
    markParts(sk, [t, u], marks);
    for (const [tri, e] of [[t, E1], [u, E2]] as const) {
      if (isAngle) sk.angle({ ...corner(tri, target.angle), color: 2, text: show(e) });
      else sk.seg(tri[target.side[0]]!, tri[target.side[1]]!, { color: 2 }).sideLabel(tri[target.side[0]]!, tri[target.side[1]]!, e);
    }
    return sk;
  });
  const steps: Step[] = [
    ...testReason(test, t, roles),
    { math: md`\triangle ${T} \cong \triangle ${U}`, note: `The ${test} ${test === "HL" ? "Theorem" : test === "AAS" ? "Theorem" : "Postulate"}.` },
    { math: md`${n1} = ${n2}`, note: "CPCTC: these parts are in matching positions." },
    { math: md`${E1} = ${E2}`, note: "Substitute the expressions." },
    ...linearSteps(p, q, m, n, x),
  ];
  if (r.next() < 0.35) {
    return {
      prompt: md`Solve $${E1} = ${E2}$. It comes from the figure: the marked parts make $\triangle ${T}$ and $\triangle ${U}$ congruent, and $${n1} = ${show(E1)}$ and $${n2} = ${show(E2)}$ are matching parts.`,
      figure,
      answer: String(x),
      hint: "Which test makes the triangles congruent? Then CPCTC says these two parts are equal, which is the equation. Collect the x-terms on one side.",
      solution: steps,
    };
  }
  return {
    prompt: md`The marks show three pairs of equal parts in $\triangle ${T}$ and $\triangle ${U}$. Find $${n1}$ in the figure.${isAngle ? ` ${DEG}` : ""}`,
    figure,
    answer: String(v),
    verify: [agree(p, q, m, n)],
    hint: "First decide which test makes the triangles congruent. Then CPCTC turns the two expressions into an equation.",
    solution: [...steps, substitute(n1, p, q, x, v, isAngle ? "^\\circ" : "")],
  };
};

// ── Lesson 3: Isosceles and equilateral triangles ───────────────────────────

/** A triangle with a chosen apex: the vertex where the two equal sides meet. */
function isosceles(r: Rng) {
  const t = oneTriangle(r);
  const a = r.int(0, 2);
  const apex = t[a]!;
  const [b1, b2] = t.filter((_, i) => i !== a) as [string, string];
  const leg1 = side(apex, b1);
  const leg2 = side(apex, b2);
  return { T: t.join(""), apex, b1, b2, leg1, leg2, legs: md`$${leg1} = ${leg2}$` };
}

/**
 * An isosceles triangle with the given vertex angle, drawn to scale, usually apex up.
 * `marks`: ticks on the legs, ticks on all three sides (equilateral), or equal base-angle arcs.
 */
function isoSketch(r: Rng, apex: string, b1: string, b2: string, vertex: number, marks: "legs" | "all" | "base angles") {
  const h = (vertex / 2) * RAD;
  const f = r.next() < 0.5 ? 1 : -1;
  const ps = pose([pt(0, Math.cos(h)), pt(-Math.sin(h) * f, 0), pt(Math.sin(h) * f, 0)], r.int(-8, 8));
  const sk = new Sketch().triangle([apex, b1, b2], ps, 1);
  if (marks === "base angles") {
    sk.angle({ at: b1, from: b2, to: apex }).angle({ at: b2, from: apex, to: b1 });
  } else {
    sk.seg(apex, b1, { ticks: 1 }).seg(apex, b2, { ticks: 1 });
    if (marks === "all") sk.seg(b1, b2, { ticks: 1 });
  }
  return sk;
}
const angleAt = (v: string, a: string, b: string) => ({ at: v, from: a, to: b });

/** Base angles labelled with expressions (and the vertex angle marked unknown, if asked). */
function baseAngles(r: Rng, apex: string, b1: string, b2: string, base: number, e1: string, e2: string, askApex = false) {
  const sk = isoSketch(r, apex, b1, b2, 180 - 2 * base, "legs")
    .angle({ ...angleAt(b1, b2, apex), text: md`(${e1})^\circ` })
    .angle({ ...angleAt(b2, apex, b1), text: md`(${e2})^\circ` });
  if (askApex) sk.unknownAngle(angleAt(apex, b1, b2));
  return sk.build();
}

/** Equal base angles marked, and the legs opposite them labelled: e1 on the leg to b2, e2 on the leg to b1. */
function equalLegs(r: Rng, apex: string, b1: string, b2: string, e1: string, e2: string) {
  return isoSketch(r, apex, b1, b2, 180 - 2 * r.int(50, 72), "base angles").sideLabel(apex, b2, e1).sideLabel(apex, b1, e2).build();
}

/** An equilateral triangle with two sides (named like "PQ") labelled. */
function equilateral(r: Rng, apex: string, b1: string, b2: string, ...labels: [string, string][]) {
  const sk = isoSketch(r, apex, b1, b2, 60, "all");
  for (const [name, text] of labels) sk.sideLabel(name[0]!, name[1]!, text);
  return sk.build();
}

const TIMES: Record<number, string> = { 2: "twice", 3: "three times", 4: "four times", 7: "seven times" };

const isoscelesAngles: Generator = (r) => {
  const { apex, b1, b2, legs } = isosceles(r);
  const kind = r.int(0, 4);
  const opp = md`The equal sides ${legs} are opposite $\angle ${b2}$ and $\angle ${b1}$, so the base angles are equal (Isosceles Triangle Theorem).`;
  if (kind === 0) {
    const v = 2 * r.int(10, 75);
    const b = (180 - v) / 2;
    const ask = r.pick([b1, b2]);
    return {
      prompt: md`Find $\angle ${ask}$ in the figure. ${DEG}`,
      figure: isoSketch(r, apex, b1, b2, v, "legs").angle({ ...angleAt(apex, b1, b2), text: md`${v}^\circ` }).unknownAngle(ask === b1 ? angleAt(b1, b2, apex) : angleAt(b2, apex, b1)).build(),
      answer: String(b),
      verify: [`2*y + ${v} = 180`],
      hint: md`Which two angles are equal? Their sum is what's left of $180^\circ$.`,
      solution: [
        { math: md`\angle ${b1} = \angle ${b2}`, note: opp },
        { math: md`${v}^\circ + 2\angle ${ask} = 180^\circ`, note: "Triangle Angle Sum Theorem." },
        { math: md`\angle ${ask} = \frac{180^\circ - ${v}^\circ}{2} = ${b}^\circ`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const b = r.int(25, 75);
    const given = r.pick([b1, b2]);
    return {
      prompt: md`Find $\angle ${apex}$ in the figure. ${DEG}`,
      figure: isoSketch(r, apex, b1, b2, 180 - 2 * b, "legs")
        .angle({ ...(given === b1 ? angleAt(b1, b2, apex) : angleAt(b2, apex, b1)), text: md`${b}^\circ` })
        .unknownAngle(angleAt(apex, b1, b2))
        .build(),
      answer: String(180 - 2 * b),
      verify: [`y + 2*${b} = 180`],
      hint: md`Is $\angle ${given}$ a base angle or the vertex angle? Look at where the equal sides meet.`,
      solution: [
        { math: md`\angle ${b1} = \angle ${b2} = ${b}^\circ`, note: md`The equal sides meet at $${apex}$, so $\angle ${given}$ is a base angle. ${opp}` },
        { math: md`\angle ${apex} = 180^\circ - 2(${b}^\circ) = ${180 - 2 * b}^\circ`, note: "Triangle Angle Sum Theorem." },
      ],
    };
  }
  if (kind === 2) {
    const v = 2 * r.int(10, 75);
    const b = (180 - v) / 2;
    const e = 180 - b;
    const fromVertex = r.next() < 0.5;
    const extAngle = md`\angle ${apex}${b2}W`;
    const setup = md`In the figure, $W$ is on $\overrightarrow{${b1}${b2}}$, past $${b2}$.`;
    const sk = isoSketch(r, apex, b1, b2, v, "legs");
    const [P1, P2] = [sk.at(b1), sk.at(b2)];
    // The base runs on through b2, so its label goes below the line.
    sk.point("W", plus(P2, times(minus(P2, P1), 0.45)), { center: P2 }).seg(b2, "W").labelDir(b2, "s");
    const ext = angleAt(b2, apex, "W");
    return fromVertex
      ? {
          prompt: md`${setup} Find $${extAngle}$. ${DEG}`,
          figure: sk.angle({ ...angleAt(apex, b1, b2), text: md`${v}^\circ` }).unknownAngle(ext).build(),
          answer: String(e),
          verify: [`y + (180 - ${v})/2 = 180`],
          hint: md`Find the base angle $\angle ${b2}$ first. $${extAngle}$ forms a linear pair with it.`,
          solution: [
            { math: md`\angle ${b2} = \frac{180^\circ - ${v}^\circ}{2} = ${b}^\circ`, note: md`Base angles are equal and the three angles sum to $180^\circ$.` },
            { math: md`${extAngle} = 180^\circ - ${b}^\circ = ${e}^\circ`, note: "Linear Pair Postulate." },
          ],
        }
      : {
          prompt: md`${setup} Find $\angle ${apex}$. ${DEG}`,
          figure: sk.angle({ ...ext, text: md`${e}^\circ` }).unknownAngle(angleAt(apex, b1, b2)).build(),
          answer: String(v),
          verify: [`y + 2*(180 - ${e}) = 180`],
          hint: md`$${extAngle}$ and $\angle ${b2}$ form a linear pair. Then use the base angles.`,
          solution: [
            { math: md`\angle ${b2} = 180^\circ - ${e}^\circ = ${b}^\circ`, note: "Linear Pair Postulate." },
            { math: md`\angle ${b1} = ${b}^\circ`, note: opp },
            { math: md`\angle ${apex} = 180^\circ - 2(${b}^\circ) = ${v}^\circ`, note: "Triangle Angle Sum Theorem." },
          ],
        };
  }
  // The vertex angle is k times a base angle, or each base angle is k times the vertex angle.
  if (r.next() < 0.5) {
    const k = r.pick([2, 3, 4, 7]);
    const b = 180 / (k + 2);
    const askApex = r.next() < 0.5;
    return {
      prompt: md`In the figure, $\angle ${apex}$ is ${TIMES[k]} $\angle ${b1}$. Find $\angle ${askApex ? apex : b2}$. ${DEG}`,
      figure: isoSketch(r, apex, b1, b2, k * b, "legs").unknownAngle(askApex ? angleAt(apex, b1, b2) : angleAt(b2, apex, b1)).build(),
      answer: String(askApex ? k * b : b),
      verify: [askApex ? `y + 2*(y/${k}) = 180` : `y + y + ${k}*y = 180`],
      hint: md`Call a base angle $x$. Then the vertex angle is $${k}x$. Add up all three angles.`,
      solution: [
        { math: md`\angle ${b1} = \angle ${b2} = x, \quad \angle ${apex} = ${k}x`, note: opp },
        { math: md`x + x + ${k}x = 180`, note: "Triangle Angle Sum Theorem." },
        { math: md`${k + 2}x = 180 \;\Rightarrow\; x = ${b}`, note: "" },
        { math: askApex ? md`\angle ${apex} = ${k}(${b}^\circ) = ${k * b}^\circ` : md`\angle ${b2} = ${b}^\circ`, note: "" },
      ],
    };
  }
  const k = r.pick([2, 4, 7]);
  const v = 180 / (2 * k + 1);
  const askApex = r.next() < 0.5;
  return {
    prompt: md`In the figure, $\angle ${b1}$ is ${TIMES[k]} $\angle ${apex}$. Find $\angle ${askApex ? apex : b2}$. ${DEG}`,
    figure: isoSketch(r, apex, b1, b2, v, "legs").unknownAngle(askApex ? angleAt(apex, b1, b2) : angleAt(b2, apex, b1)).build(),
    answer: String(askApex ? v : k * v),
    verify: [askApex ? `y + 2*${k}*y = 180` : `y/${k} + 2*y = 180`],
    hint: md`Call the vertex angle $x$. Both base angles are then $${k}x$.`,
    solution: [
      { math: md`\angle ${apex} = x, \quad \angle ${b1} = \angle ${b2} = ${k}x`, note: opp },
      { math: md`x + ${k}x + ${k}x = 180`, note: "Triangle Angle Sum Theorem." },
      { math: md`${2 * k + 1}x = 180 \;\Rightarrow\; x = ${v}`, note: "" },
      { math: askApex ? md`\angle ${apex} = ${v}^\circ` : md`\angle ${b2} = ${k}(${v}^\circ) = ${k * v}^\circ`, note: "" },
    ],
  };
};

const isoscelesSolve: Generator = (r) => {
  const { T, apex, b1, b2, leg1, leg2, legs } = isosceles(r);
  const x = r.int(2, 14);
  const kind = r.int(0, 4);
  const check = (what: string, value: number) => ({ math: md`${what} = ${value}`, note: "Check: substitute x into both expressions and they agree." });
  if (kind === 0) {
    const B = r.int(30, 70);
    const [p, q, m, n] = twoExpressions(r, x, B);
    const [E1, E2] = [lin(p, q), lin(m, n)];
    return {
      prompt: md`Solve $${E1} = ${E2}$. It comes from $\triangle ${T}$ in the figure, where ${legs}, $\angle ${b1} = (${E1})^\circ$ and $\angle ${b2} = (${E2})^\circ$.`,
      figure: baseAngles(r, apex, b1, b2, B, E1, E2),
      answer: String(x),
      hint: md`Why must $\angle ${b1}$ and $\angle ${b2}$ be equal? Which sides are they opposite?`,
      solution: [
        { math: md`\angle ${b1} = \angle ${b2}`, note: md`$\angle ${b1}$ is opposite $\overline{${leg2}}$ and $\angle ${b2}$ is opposite $\overline{${leg1}}$. Those sides are equal, so the Isosceles Triangle Theorem makes the angles equal.` },
        ...linearSteps(p, q, m, n, x),
        check(md`\angle ${b1} = \angle ${b2}`, B),
      ],
    };
  }
  if (kind === 1) {
    const L = r.int(6, 40);
    const [p, q, m, n] = twoExpressions(r, x, L);
    const [E1, E2] = [lin(p, q), lin(m, n)];
    return {
      prompt: md`Solve $${E1} = ${E2}$. It comes from $\triangle ${T}$ in the figure, where $\angle ${b1} = \angle ${b2}$, $${leg2} = ${E1}$ and $${leg1} = ${E2}$.`,
      figure: equalLegs(r, apex, b1, b2, E1, E2),
      answer: String(x),
      hint: md`Which side is opposite $\angle ${b1}$, and which is opposite $\angle ${b2}$?`,
      solution: [
        { math: md`${leg2} = ${leg1}`, note: md`$\overline{${leg2}}$ is opposite $\angle ${b1}$ and $\overline{${leg1}}$ is opposite $\angle ${b2}$. The angles are equal, so by the converse of the Isosceles Triangle Theorem these sides are equal.` },
        ...linearSteps(p, q, m, n, x),
        check(md`${leg1} = ${leg2}`, L),
      ],
    };
  }
  if (kind === 2) {
    const B = r.int(30, 68);
    const a = B - x;
    const V = 180 - 2 * B;
    const k = r.int(1, 4);
    const c = V - k * x;
    return {
      prompt: md`Solve $2(${lin(1, a)}) + ${lin(k, c)} = 180$. It comes from $\triangle ${T}$ in the figure, where ${legs}, $\angle ${b1} = (${lin(1, a)})^\circ$ and $\angle ${apex} = (${lin(k, c)})^\circ$.`,
      figure: isoSketch(r, apex, b1, b2, V, "legs")
        .angle({ ...angleAt(b1, b2, apex), text: md`(${lin(1, a)})^\circ` })
        .angle({ ...angleAt(apex, b1, b2), text: md`(${lin(k, c)})^\circ` })
        .build(),
      answer: String(x),
      hint: md`$\angle ${b2}$ equals $\angle ${b1}$, which is why the equation has a 2. Distribute, combine like terms, then solve.`,
      solution: [
        { math: md`\angle ${b1} + \angle ${b2} + \angle ${apex} = 180^\circ`, note: md`Triangle Angle Sum Theorem, with $\angle ${b2} = \angle ${b1}$ by the Isosceles Triangle Theorem.` },
        { math: md`${lin(2, 2 * a)} + ${lin(k, c)} = 180`, note: "Distribute the 2." },
        { math: md`${lin(k + 2, 2 * a + c)} = 180`, note: "Combine like terms." },
        { math: md`${poly([[k + 2, "x"]])} = ${180 - 2 * a - c}`, note: "Move the constant across." },
        { math: md`x = ${x}`, note: md`Divide by ${k + 2}. Then each base angle is $${B}^\circ$ and $\angle ${apex} = ${V}^\circ$.` },
      ],
    };
  }
  if (kind === 3) {
    const L = r.int(6, 40);
    const [p, q, m, n] = twoExpressions(r, x, L);
    const [E1, E2] = [lin(p, q), lin(m, n)];
    const sides = shuffle(r, [side(apex, b1), side(apex, b2), side(b1, b2)]);
    return {
      prompt: md`Solve $${E1} = ${E2}$. It comes from equilateral $\triangle ${T}$ in the figure, where $${sides[0]} = ${E1}$ and $${sides[1]} = ${E2}$.`,
      figure: equilateral(r, apex, b1, b2, [sides[0]!, E1], [sides[1]!, E2]),
      answer: String(x),
      hint: "In an equilateral triangle every side has the same length.",
      solution: [{ math: md`${sides[0]} = ${sides[1]}`, note: "Equilateral means all three sides are equal." }, ...linearSteps(p, q, m, n, x), check(md`${sides[0]} = ${sides[1]}`, L)],
    };
  }
  const p = r.int(2, 9);
  const q = 60 - p * x;
  const vertex = r.pick([apex, b1, b2]);
  return {
    prompt: md`Solve $${lin(p, q)} = 60$. It comes from equilateral $\triangle ${T}$ in the figure, where $\angle ${vertex} = (${lin(p, q)})^\circ$.`,
    figure: isoSketch(r, apex, b1, b2, 60, "all")
      .angle({ ...(vertex === apex ? angleAt(apex, b1, b2) : vertex === b1 ? angleAt(b1, b2, apex) : angleAt(b2, apex, b1)), text: md`(${lin(p, q)})^\circ` })
      .build(),
    answer: String(x),
    hint: "Why is every angle of an equilateral triangle 60°?",
    solution: [
      { math: md`\angle ${vertex} = 60^\circ`, note: "An equilateral triangle is equiangular, and three equal angles summing to 180° are 60° each." },
      ...(q === 0 ? [] : [{ math: md`${poly([[p, "x"]])} = ${60 - q}`, note: md`${q < 0 ? "Add" : "Subtract"} ${Math.abs(q)} on both sides.` }]),
      { math: md`x = ${x}`, note: md`Divide by ${p}.` },
    ],
  };
};

const isoscelesFind: Generator = (r) => {
  const { T, apex, b1, b2, leg1, leg2, legs } = isosceles(r);
  const x = r.int(2, 14);
  const kind = r.int(0, 3);
  if (kind === 0) {
    const B = r.int(30, 70);
    const [p, q, m, n] = twoExpressions(r, x, B);
    const [E1, E2] = [lin(p, q), lin(m, n)];
    return {
      prompt: md`Find $\angle ${apex}$ in the figure. ${DEG}`,
      figure: baseAngles(r, apex, b1, b2, B, E1, E2, true),
      answer: String(180 - 2 * B),
      verify: [agree(p, q, m, n, "(180 - y)/2")],
      hint: "Set the base angles equal to find x. Then use the angle sum.",
      solution: [
        { math: md`${E1} = ${E2}`, note: md`The base angles are opposite the equal sides, so they are equal.` },
        ...linearSteps(p, q, m, n, x),
        { math: md`\angle ${b1} = \angle ${b2} = ${B}^\circ`, note: "Substitute x." },
        { math: md`\angle ${apex} = 180^\circ - 2(${B}^\circ) = ${180 - 2 * B}^\circ`, note: "Triangle Angle Sum Theorem." },
      ],
    };
  }
  if (kind === 1) {
    const L = r.int(6, 40);
    const [p, q, m, n] = twoExpressions(r, x, L);
    const [E1, E2] = [lin(p, q), lin(m, n)];
    return {
      prompt: md`Find $${leg2}$ in the figure.`,
      figure: equalLegs(r, apex, b1, b2, E1, E2),
      answer: String(L),
      verify: [agree(p, q, m, n)],
      hint: md`Equal angles mean the sides opposite them are equal. Which sides are those?`,
      solution: [
        { math: md`${leg2} = ${leg1}`, note: "Converse of the Isosceles Triangle Theorem: these sides are opposite the equal angles." },
        { math: md`${E1} = ${E2}`, note: "" },
        ...linearSteps(p, q, m, n, x),
        substitute(leg2, p, q, x, L),
      ],
    };
  }
  if (kind === 2) {
    const B = r.int(30, 68);
    const a = B - x;
    const V = 180 - 2 * B;
    const k = r.int(1, 4);
    const c = V - k * x;
    return {
      prompt: md`Find $\angle ${b2}$ in the figure. ${DEG}`,
      figure: isoSketch(r, apex, b1, b2, V, "legs")
        .angle({ ...angleAt(apex, b1, b2), text: md`(${lin(k, c)})^\circ` })
        .angle({ ...angleAt(b1, b2, apex), text: md`(${lin(1, a)})^\circ` })
        .unknownAngle(angleAt(b2, apex, b1))
        .build(),
      answer: String(B),
      verify: [`2*y + ${k}*(y - (${a})) + (${c}) = 180`],
      hint: md`$\angle ${b2}$ has the same expression as $\angle ${b1}$. Add all three angles and set the sum to 180.`,
      solution: [
        { math: md`\angle ${b2} = \angle ${b1} = (${lin(1, a)})^\circ`, note: "Isosceles Triangle Theorem." },
        { math: md`2(${lin(1, a)}) + ${lin(k, c)} = 180`, note: "Triangle Angle Sum Theorem." },
        { math: md`${lin(k + 2, 2 * a + c)} = 180 \;\Rightarrow\; x = ${x}`, note: "Distribute, combine like terms, solve." },
        { math: md`\angle ${b2} = ${x} ${a < 0 ? "-" : "+"} ${Math.abs(a)} = ${B}^\circ`, note: "Substitute x." },
      ],
    };
  }
  const L = r.int(6, 30);
  const [p, q, m, n] = twoExpressions(r, x, L);
  const [E1, E2] = [lin(p, q), lin(m, n)];
  const sides = shuffle(r, [leg1, leg2, side(b1, b2)]);
  return {
    prompt: md`$\triangle ${T}$ in the figure is equilateral. Find its perimeter.`,
    figure: equilateral(r, apex, b1, b2, [sides[0]!, E1], [sides[1]!, E2]),
    answer: String(3 * L),
    verify: [agree(p, q, m, n, "y/3")],
    hint: "All three sides are equal. Find x, then one side, then add three of them.",
    solution: [
      { math: md`${E1} = ${E2}`, note: "Equilateral: all sides are equal." },
      ...linearSteps(p, q, m, n, x),
      { math: md`${sides[0]} = ${L}`, note: "Substitute x." },
      { math: md`\text{perimeter} = 3 \cdot ${L} = ${3 * L}`, note: "Three equal sides." },
    ],
  };
};

// ── Lesson 4: Triangle inequalities ─────────────────────────────────────────

const thirdSideRange: Generator = (r) => {
  const a = r.int(2, 15);
  const b = r.next() < 0.15 ? a : r.int(2, 15);
  const [lo, hi] = [Math.abs(a - b), a + b];
  const [s, l] = a < b ? [a, b] : [b, a];
  const setup = md`Two sides of a triangle are ${a} and ${b} long.`;
  const derive: Step[] = [
    { math: md`x < ${a} + ${b} = ${hi}`, note: "The third side is shorter than the other two together." },
    { math: md`${l} < ${s} + x \;\Rightarrow\; x > ${lo}`, note: lo === 0 ? "The two given sides are equal, so this only says x > 0." : md`The longer given side must be shorter than the other two together.` },
    { math: md`${s} < ${l} + x`, note: "Always true for a positive x, so it adds nothing." },
  ];
  const kind = r.int(0, 3);
  if (kind <= 1) {
    return {
      prompt: md`${setup} Write every possible length $x$ of the third side as an inequality, like 2 < x < 9.`,
      answer: `${lo} < x < ${hi}`,
      form: "inequality",
      hint: "The third side must be less than the sum of the other two and more than their difference.",
      solution: [...derive, { math: md`${lo} < x < ${hi}`, note: "Both ends are excluded: at either end the triangle collapses flat." }],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`${setup} How many whole-number lengths are possible for the third side?`,
      answer: String(hi - lo - 1),
      hint: "Find the range first. Then count the whole numbers strictly inside it.",
      solution: [
        ...derive,
        { math: md`${lo} < x < ${hi}`, note: "" },
        { math: md`${lo + 1}, ${lo + 2}, \ldots, ${hi - 1}`, note: md`That's $${hi - 1} - ${lo + 1} + 1 = ${hi - lo - 1}$ whole numbers.` },
      ],
    };
  }
  const largest = r.next() < 0.5;
  return {
    prompt: md`${setup} What is the ${largest ? "largest" : "smallest"} whole-number length the third side can have?`,
    answer: String(largest ? hi - 1 : lo + 1),
    hint: "Find the range first. The ends themselves are not allowed.",
    solution: [
      ...derive,
      { math: md`${lo} < x < ${hi}`, note: "" },
      { math: String(largest ? hi - 1 : lo + 1), note: largest ? md`${hi} itself is too long: the triangle would be flat.` : md`${lo} itself is too short${lo === 0 ? " (a side must have positive length)" : ": the triangle would be flat"}.` },
    ],
  };
};

const YES = ["yes", "no"];

/**
 * A triangle drawn to scale for one allowed value x0 of x, with its sides labelled.
 * Each side is [label, length - x0].
 */
function labelledSides(r: Rng, x0: number, ...sides: [string, number][]) {
  const order = shuffle(r, sides);
  const len = order.map(([, extra]) => x0 + extra);
  const names = ["A", "B", "C"];
  const ps = pose(triangleFromSides(len[0]!, len[1]!, len[2]!), r.int(-20, 20), r.next() < 0.5);
  // Unlabelled vertices: the figure is about the sides.
  const sk = new Sketch();
  names.forEach((n, i) => sk.point(n, ps[i]!, { label: "", hidden: true, center: mean(ps) }));
  sk.triangle(names, ps, 1);
  order.forEach(([text], i) => sk.sideLabel(names[[0, 1, 0][i]!]!, names[[1, 2, 2][i]!]!, text));
  return sk.build();
}

const sidesAlgebra: Generator = (r) => {
  const roll = r.next();
  if (roll < 0.15) {
    const a = r.int(2, 9);
    const b = r.int(a, 12);
    const c = r.pick(["yes", "flat", "long"]);
    const third = c === "yes" ? r.int(b - a + 1, a + b - 1) : c === "flat" ? a + b : r.int(a + b + 1, a + b + 6);
    const lens = shuffle(r, [a, b, third]);
    const sorted = [...lens].sort((p, q) => p - q) as [number, number, number];
    const ok = sorted[0] + sorted[1] > sorted[2];
    return {
      prompt: md`Can three segments of lengths ${lens.join(", ")} be the sides of a triangle?`,
      choices: shuffle(r, YES),
      accept: [ok ? "yes" : "no"],
      hint: "Compare the two shorter lengths, added together, with the longest.",
      solution: [
        {
          math: md`${sorted[0]} + ${sorted[1]} = ${sorted[0] + sorted[1]} ${ok ? ">" : sorted[0] + sorted[1] === sorted[2] ? "=" : "<"} ${sorted[2]}`,
          note: ok
            ? "The two shorter sides together beat the longest, and the other two checks are automatic. **Yes.**"
            : sorted[0] + sorted[1] === sorted[2]
              ? "The two short sides exactly reach across the long one: the 'triangle' is flat. **No.**"
              : "The two short sides can't reach across the long one. **No.**",
        },
      ],
    };
  }
  const solve = r.next() < 0.5;
  if (roll < 0.55) {
    const d = r.int(1, 6);
    const h = r.int(1, 7);
    const c = d + 2 * h;
    const tex = md`x + (x + ${d}) > ${c}`;
    const steps: Step[] = [
      { math: tex, note: md`The two sides with $x$ in them must add up to more than ${c}.` },
      { math: md`2x + ${d} > ${c} \;\Rightarrow\; 2x > ${2 * h} \;\Rightarrow\; x > ${h}`, note: "Solve the inequality." },
      { math: md`x + ${c} > x + ${d}, \quad (x + ${d}) + ${c} > x`, note: "The other two checks hold for every positive x." },
    ];
    return solve
      ? {
          prompt: md`Solve $${tex}$. It is the triangle inequality for a triangle with sides $x$, $x + ${d}$ and ${c}; the other two inequalities hold for every positive $x$. Write the answer as an inequality.`,
          answer: `x > ${h}`,
          form: "inequality",
          hint: "Combine like terms, then solve as in Algebra 1.",
          solution: steps,
        }
      : {
          prompt: md`The triangle in the figure has sides of length $x$, $x + ${d}$ and ${c}. Write every possible value of $x$ as an inequality.`,
          figure: labelledSides(r, h + c / 2, ["x", 0], [md`x + ${d}`, d], [String(c), c - h - c / 2]),
          answer: `x > ${h}`,
          form: "inequality",
          hint: "Write all three triangle inequalities. Most of them are automatic.",
          solution: steps,
        };
  }
  const k = r.pick([2, 2, 3]);
  const c = k === 2 ? 3 * r.int(2, 7) : 8 * r.int(1, 3);
  const [lo, hi] = [c / (k + 1), c / (k - 1)];
  const kx = `${k}x`;
  const tex = md`${c} - x < ${kx} < ${c} + x`;
  const steps: Step[] = [
    { math: md`x + ${kx} > ${c} \;\Rightarrow\; x > ${lo}`, note: md`Sum of the two sides with $x$ beats ${c}: $${k + 1}x > ${c}$.` },
    { math: md`x + ${c} > ${kx} \;\Rightarrow\; x < ${hi}`, note: md`Sum of $x$ and ${c} beats $${kx}$: ${k === 2 ? md`$${c} > x$` : md`$${c} > ${k - 1}x$`}.` },
    { math: md`${kx} + ${c} > x`, note: "Always true for positive x." },
    { math: md`${lo} < x < ${hi}`, note: "Both conditions together." },
  ];
  return solve
    ? {
        prompt: md`Solve $${tex}$. It says the side $${kx}$ of a triangle with sides $x$, $${kx}$ and ${c} lies between the difference and the sum of the other two. Write the answer as an inequality.`,
        answer: `${lo} < x < ${hi}`,
        form: "inequality",
        hint: "Split it into two inequalities and solve each one.",
        solution: steps,
      }
    : {
        prompt: md`The triangle in the figure has sides of length $x$, $${kx}$ and ${c}. Write every possible value of $x$ as an inequality.`,
        figure: labelledSides(r, (lo + hi) / 2, ["x", 0], [kx, ((lo + hi) / 2) * (k - 1)], [String(c), c - (lo + hi) / 2]),
        answer: `${lo} < x < ${hi}`,
        form: "inequality",
        hint: "Write all three triangle inequalities. Two of them give limits on x.",
        solution: steps,
      };
};

const sideAngleOrder: Generator = (r) => {
  const t = oneTriangle(r);
  const sides = [side(t[1]!, t[2]!), side(t[0]!, t[2]!), side(t[0]!, t[1]!)]; // sides[i] is opposite t[i]
  const largest = r.next() < 0.6;
  const word = largest ? "largest" : "smallest";
  // Deliberately not to scale: a near-equilateral shape, so the answer has to come from the numbers.
  const sk = new Sketch().triangle(t, pose(triangleFromAngles(shuffle(r, [56, 60, 64])), r.int(-15, 15)), 1);
  if (r.next() < 0.5) {
    let L: number[];
    do L = [r.int(3, 15), r.int(3, 15), r.int(3, 15)];
    while (new Set(L).size < 3 || !validTriangle(L[0]!, L[1]!, L[2]!));
    const pick = L.indexOf(largest ? Math.max(...L) : Math.min(...L));
    const given = [0, 1, 2].map((i) => ({ name: sides[i]!, len: L[i]! })).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const g of given) sk.sideLabel(g.name[0]!, g.name[1]!, String(g.len));
    return {
      prompt: md`Which angle of $\triangle ${t.join("")}$ is ${word}? The figure is not drawn to scale.`,
      figure: sk.build(),
      choices: shuffle(r, t.map((v) => md`$\angle ${v}$`)),
      accept: [md`$\angle ${t[pick]}$`],
      hint: `The ${word} angle is opposite the ${largest ? "longest" : "shortest"} side. Opposite means the vertex the side doesn't touch.`,
      solution: [
        { math: md`${sides[pick]} = ${L[pick]}`, note: `This is the ${largest ? "longest" : "shortest"} side.` },
        { math: md`\angle ${t[pick]}`, note: md`$\overline{${sides[pick]}}$ doesn't touch $${t[pick]}$, so it is opposite $\angle ${t[pick]}$.` },
      ],
    };
  }
  let A: number[];
  do {
    const a0 = r.int(20, 120);
    const a1 = r.int(20, 160 - a0);
    A = [a0, a1, 180 - a0 - a1];
  } while (new Set(A).size < 3 || A[2]! < 20);
  const [i, j] = shuffle(r, [0, 1, 2]).slice(0, 2).sort((a, b) => a - b) as [number, number];
  const k = 3 - i - j;
  const pick = A.indexOf(largest ? Math.max(...A) : Math.min(...A));
  const longest = largest ? "longest" : "shortest";
  return {
    prompt: md`Which side of $\triangle ${t.join("")}$ is ${longest}? The figure is not drawn to scale.`,
    figure: sk.angle({ ...corner(t, i), text: md`${A[i]}^\circ` }).angle({ ...corner(t, j), text: md`${A[j]}^\circ` }).build(),
    choices: shuffle(r, [...sides].sort().map((s) => md`$\overline{${s}}$`)),
    accept: [md`$\overline{${sides[pick]}}$`],
    hint: `Find the third angle first. The ${longest} side is opposite the ${word} angle.`,
    solution: [
      { math: md`\angle ${t[k]} = 180^\circ - ${A[i]}^\circ - ${A[j]}^\circ = ${A[k]}^\circ`, note: "Triangle Angle Sum Theorem." },
      { math: md`\angle ${t[pick]} = ${A[pick]}^\circ`, note: `This is the ${word} angle.` },
      { math: md`\overline{${sides[pick]}}`, note: md`The side opposite $\angle ${t[pick]}$ is the one that doesn't touch $${t[pick]}$.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "Triangles and Congruence",
  lessons: [
    {
      id: "congruent-figures",
      title: "Congruent figures",
      summary: "What congruent means, why the order of the letters matters, and how CPCTC turns one fact into six.",
      blocks: [
        {
          kind: "text",
          body: md`Two figures are **congruent** when one can be moved onto the other so that they match exactly: same size, same shape. Picture tracing one figure on thin paper, then sliding, turning or flipping the tracing until it covers the other. (Unit 9 makes "moving" precise. Here we only need the result.)

For polygons, matching exactly means you can pair up the vertices so that every pair of matching sides has the same length and every pair of matching angles has the same measure.`,
        },
        {
          kind: "key",
          title: "Congruence statement",
          body: md`$\triangle ABC \cong \triangle DEF$ means the triangles match with $A \leftrightarrow D$, $B \leftrightarrow E$ and $C \leftrightarrow F$. It packs six facts into one line:

- Sides: $AB = DE$, $BC = EF$ and $CA = FD$.
- Angles: $\angle A = \angle D$, $\angle B = \angle E$ and $\angle C = \angle F$.

Segments are **congruent** when their lengths are equal, and angles are congruent when their measures are equal, so $\overline{AB} \cong \overline{DE}$ says the same thing as $AB = DE$. Lengths and measures are numbers, so they get $=$. Figures get $\cong$.`,
        },
        {
          kind: "diagram",
          view: [-1, 12, -1, 4],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 4, y: 0, dir: "se" },
            { name: "C", x: 1, y: 3, dir: "n" },
            { name: "D", x: 11, y: 0, dir: "se" },
            { name: "E", x: 7, y: 0, dir: "sw" },
            { name: "F", x: 10, y: 3, dir: "n" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["D", "E", "F"], fill: 2 },
          ],
          segments: [
            { from: "A", to: "B", ticks: 1 },
            { from: "B", to: "C", ticks: 2 },
            { from: "C", to: "A", ticks: 3 },
            { from: "D", to: "E", ticks: 1 },
            { from: "E", to: "F", ticks: 2 },
            { from: "F", to: "D", ticks: 3 },
          ],
          angles: [
            { at: "A", from: "B", to: "C", arcs: 1 },
            { at: "B", from: "C", to: "A", arcs: 2 },
            { at: "C", from: "A", to: "B", arcs: 3 },
            { at: "D", from: "E", to: "F", arcs: 1 },
            { at: "E", from: "F", to: "D", arcs: 2 },
            { at: "F", from: "D", to: "E", arcs: 3 },
          ],
          caption: md`Sides with the same number of ticks are equal, and angles with the same number of arcs are equal. $\triangle DEF$ is a flipped copy of $\triangle ABC$, so $\triangle ABC \cong \triangle DEF$.`,
        },
        {
          kind: "why",
          title: "Why the order of the letters matters",
          body: md`A congruence statement is read by position: 1st letter with 1st letter, 2nd with 2nd, 3rd with 3rd. To find the side that matches $\overline{BC}$, notice that $B$ and $C$ are the 2nd and 3rd letters of $\triangle ABC$. So the match is made of the 2nd and 3rd letters of $\triangle DEF$: $\overline{EF}$.

Change the order and you change the claim. In the figure, $\triangle ABC \cong \triangle EDF$ would say $BC = DF$, but $\overline{BC}$ has two ticks and $\overline{DF}$ has three. Same triangles, false statement. The order **is** the information.

You may list both triangles in a new order, as long as every pair stays together: $\triangle BCA \cong \triangle EFD$ says exactly what $\triangle ABC \cong \triangle DEF$ says.`,
        },
        {
          kind: "example",
          title: "Reading off corresponding parts",
          problem: md`$\triangle PQR \cong \triangle XZY$. $PQ = 7$, $\angle Q = 52^\circ$ and $\angle R = 41^\circ$. Find $XZ$, $\angle Z$ and $\angle X$.`,
          steps: [
            { math: md`P \leftrightarrow X, \quad Q \leftrightarrow Z, \quad R \leftrightarrow Y`, note: "Pair the letters by position." },
            { math: md`XZ = PQ = 7`, note: md`$X$ and $Z$ are the 1st and 2nd letters, like $P$ and $Q$.` },
            { math: md`\angle Z = \angle Q = 52^\circ`, note: md`$Z$ is 2nd, like $Q$.` },
            { math: md`\angle P = 180^\circ - 52^\circ - 41^\circ = 87^\circ`, note: "Triangle Angle Sum Theorem (Unit 2)." },
            { math: md`\angle X = \angle P = 87^\circ`, note: md`$X$ is 1st, like $P$.` },
          ],
        },
        {
          kind: "key",
          title: "CPCTC",
          body: md`**CPCTC**: *Corresponding Parts of Congruent Triangles are Congruent.* Once you know $\triangle ABC \cong \triangle DEF$, you may use any of the six equalities it contains, with "CPCTC" as the reason.`,
        },
        {
          kind: "why",
          title: "Why give the definition a name?",
          body: md`CPCTC is just the definition of congruent triangles, read in the useful direction. It earns a name because of how proofs go. The next lesson shows that three well-chosen equal parts already force two triangles to be congruent. So a typical proof has two stages:

- Check three parts, and conclude that the triangles are congruent.
- Use CPCTC to collect the other three parts for free.

That second stage is how geometry proves two segments or two angles equal when nobody measured them.`,
        },
        {
          kind: "key",
          title: "Congruence behaves like equality",
          body: md`For segments, angles and triangles alike:

- **Reflexive:** $\overline{AB} \cong \overline{AB}$.
- **Symmetric:** if $\overline{AB} \cong \overline{CD}$, then $\overline{CD} \cong \overline{AB}$.
- **Transitive:** if $\overline{AB} \cong \overline{CD}$ and $\overline{CD} \cong \overline{EF}$, then $\overline{AB} \cong \overline{EF}$.

Each comes straight from the matching property of equality, because congruence is defined by equal numbers. Here is the transitive case for segments; the others work the same way.`,
        },
        {
          kind: "proof",
          title: "Congruence of segments is transitive",
          given: md`$\overline{AB} \cong \overline{CD}$ and $\overline{CD} \cong \overline{EF}$`,
          prove: md`$\overline{AB} \cong \overline{EF}$`,
          steps: [
            { statement: md`$\overline{AB} \cong \overline{CD}$, $\overline{CD} \cong \overline{EF}$`, reason: "Given" },
            { statement: md`$AB = CD$, $CD = EF$`, reason: "Definition of congruent segments" },
            { statement: md`$AB = EF$`, reason: "Transitive Property of Equality" },
            { statement: md`$\overline{AB} \cong \overline{EF}$`, reason: "Definition of congruent segments" },
          ],
        },
        {
          kind: "text",
          body: md`One more tool, needed in the next lesson, recalled from Unit 2. Suppose two angles of one triangle match two angles of another. Then the third angles have no choice: each one is whatever is left of $180^\circ$. Here is that argument written as a two-column proof.

**Third Angles Theorem.** If two angles of one triangle are equal to two angles of another triangle, then the third angles are equal too.`,
        },
        {
          kind: "diagram",
          view: [-0.5, 11.5, -0.8, 4.6],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 3, y: 0, dir: "se" },
            { name: "C", x: 1, y: 2, dir: "n" },
            { name: "D", x: 5, y: 0, dir: "sw" },
            { name: "E", x: 11, y: 0, dir: "se" },
            { name: "F", x: 7, y: 4, dir: "n" },
          ],
          polygons: [
            { points: ["A", "B", "C"], fill: 1 },
            { points: ["D", "E", "F"], fill: 2 },
          ],
          angles: [
            { at: "A", from: "B", to: "C", arcs: 1 },
            { at: "B", from: "C", to: "A", arcs: 2 },
            { at: "C", from: "A", to: "B", label: "?", color: 2 },
            { at: "D", from: "E", to: "F", arcs: 1 },
            { at: "E", from: "F", to: "D", arcs: 2 },
            { at: "F", from: "D", to: "E", label: "?", color: 2 },
          ],
          caption: md`The triangles have different sizes, yet $\angle C = \angle F$ is forced. So matching angles alone can't prove two triangles congruent; size needs at least one side.`,
        },
        {
          kind: "proof",
          title: "Third Angles Theorem",
          given: md`In $\triangle ABC$ and $\triangle DEF$, $\angle A = \angle D$ and $\angle B = \angle E$`,
          prove: md`$\angle C = \angle F$`,
          steps: [
            { statement: md`$\angle A = \angle D$, $\angle B = \angle E$`, reason: "Given" },
            { statement: md`$\angle A + \angle B + \angle C = 180^\circ$ and $\angle D + \angle E + \angle F = 180^\circ$`, reason: "Triangle Angle Sum Theorem" },
            { statement: md`$\angle A + \angle B + \angle C = \angle D + \angle E + \angle F$`, reason: md`Substitution (both sums equal $180^\circ$)` },
            { statement: md`$\angle A + \angle B + \angle C = \angle A + \angle B + \angle F$`, reason: "Substitution (step 1)" },
            { statement: md`$\angle C = \angle F$`, reason: md`Subtraction Property of Equality (subtract $\angle A + \angle B$)` },
          ],
        },
        {
          kind: "example",
          title: "Congruence gives equations",
          problem: md`$\triangle ABC \cong \triangle DEF$, $AB = 2x + 3$ and $DE = 5x - 9$. Find $x$ and $AB$.`,
          steps: [
            { math: md`AB = DE`, note: "Both are made of the 1st and 2nd letters, so they correspond (CPCTC)." },
            { math: md`2x + 3 = 5x - 9`, note: "Substitute." },
            { math: md`12 = 3x \;\Rightarrow\; x = 4`, note: md`Subtract $2x$, add 9, divide by 3.` },
            { math: md`AB = 2(4) + 3 = 11`, note: md`Check: $DE = 5(4) - 9 = 11$ as well.` },
          ],
        },
        {
          kind: "check",
          prompt: md`$\triangle JKL \cong \triangle TSU$. Which angle corresponds to $\angle L$?`,
          choices: [md`$\angle S$`, md`$\angle T$`, md`$\angle U$`],
          accept: [md`$\angle U$`],
          explain: md`$L$ is the 3rd letter of $\triangle JKL$, and the 3rd letter of $\triangle TSU$ is $U$.`,
        },
        {
          kind: "check",
          prompt: md`$\triangle ABC \cong \triangle DEF$, $\angle A = 50^\circ$ and $\angle E = 60^\circ$. Find $\angle F$ in degrees.`,
          answer: "70",
          explain: md`$\angle B = \angle E = 60^\circ$, so $\angle C = 180^\circ - 50^\circ - 60^\circ = 70^\circ$, and $\angle F = \angle C = 70^\circ$.`,
        },
      ],
      practice: [correspondingParts, correspondingValues, congruenceAlgebra],
    },
    {
      id: "sss-sas-asa-aas",
      title: "SSS, SAS, ASA, AAS",
      summary: "Three well-chosen parts pin a triangle down. Which three, why, and why side-side-angle is not one of them.",
      blocks: [
        {
          kind: "text",
          body: md`The definition of congruent triangles asks for six equalities. Checking all six is a lot of work, and usually unnecessary. A triangle is **rigid**: join three sticks at their ends and the frame can't wobble, while four sticks fold into many shapes. That suggests three well-chosen parts already fix a triangle completely. The question is which three.`,
        },
        {
          kind: "diagram",
          view: [-4.5, 11.5, -5.5, 5.5],
          points: [
            { name: "A", x: 0, y: 0, dir: "w" },
            { name: "B", x: 6, y: 0, dir: "e" },
            { name: "C", x: 2.25, y: "sqrt(10.9375)", dir: "n" },
            { name: "Cp", x: 2.25, y: "-sqrt(10.9375)", label: "C'", dir: "s" },
          ],
          circles: [
            { center: "A", radius: 4, color: 1, dashed: true },
            { center: "B", radius: 5, color: 2, dashed: true },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          segments: [
            { from: "A", to: "B", label: "6" },
            { from: "A", to: "C", label: "4", color: 1 },
            { from: "B", to: "C", label: "5", color: 2 },
            { from: "A", to: "Cp", color: 1, dashed: true },
            { from: "B", to: "Cp", color: 2, dashed: true },
          ],
          caption: md`**Building a triangle from three sides.** Lay down $\overline{AB}$ of length 6. The third vertex must be 4 from $A$ and 5 from $B$, so it lies on both circles. They cross at only two points, $C$ and $C'$, which are mirror images. Either way it's the same triangle, flipped.`,
        },
        {
          kind: "key",
          title: "Four congruence tests",
          body: md`For $\triangle ABC$ and $\triangle DEF$, any one of these is enough:

- **SSS:** all three pairs of sides are equal.
- **SAS:** two pairs of sides are equal, and so are the angles **included** between them (the angle formed by those two sides).
- **ASA:** two pairs of angles are equal, and so are the **included** sides (the side joining those two vertices).
- **AAS:** two pairs of angles are equal, and so is a pair of **corresponding** sides that are **not** between them (for example $\angle A = \angle D$, $\angle B = \angle E$ and $BC = EF$).

Then the triangles are congruent, and CPCTC gives you every other part.`,
        },
        {
          kind: "why",
          title: "Postulates, honestly",
          body: md`The postulates so far (Ruler, Protractor, Parallel) can't prove two triangles congruent. Nothing in them says that a triangle built from the same parts must come out the same. Euclid "proved" SAS by picking one triangle up and laying it on the other, but his axioms never said that moving a figure keeps its lengths and angles. He used it anyway.

Modern geometry is upfront about this and takes a test as a postulate. With SAS alone, ASA and SSS can be proved. We take **SSS, SAS and ASA as postulates** to keep proofs short. The pictures show why they deserve it: each set of three parts leaves room for only one triangle. AAS we prove.`,
        },
        {
          kind: "diagram",
          view: [-4.5, 6, -0.8, 4.6],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 5, y: 0, dir: "se" },
            { name: "C", x: "4cos(t pi/180)", y: "4sin(t pi/180)", dir: "n" },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          segments: [
            { from: "A", to: "B", label: "5" },
            { from: "A", to: "C", label: "4" },
          ],
          angles: [{ at: "A", from: "B", to: "C", label: md`{t}^\circ` }],
          params: [{ name: "t", label: "angle A", tex: md`\angle A`, min: 15, max: 165, step: 1, value: 60 }],
          readouts: [{ label: "BC", value: "sqrt((5 - 4cos(t pi/180))^2 + (4sin(t pi/180))^2)" }],
          caption: md`**SAS.** Two sides are fixed at 5 and 4. Drag the angle between them: each angle gives exactly one triangle and one length for $BC$. Fix the angle as well, and nothing is left to change. **ASA** is similar: fix $\overline{AB}$ and the angles at both ends, and the two rays from $A$ and $B$ are fixed. Two lines cross at most once, so $C$ has only one place to be.`,
        },
        {
          kind: "proof",
          title: "AAS Theorem",
          given: md`$\angle A = \angle D$, $\angle B = \angle E$ and $BC = EF$`,
          prove: md`$\triangle ABC \cong \triangle DEF$`,
          steps: [
            { statement: md`$\angle A = \angle D$, $\angle B = \angle E$`, reason: "Given" },
            { statement: md`$\angle C = \angle F$`, reason: "Third Angles Theorem" },
            { statement: md`$BC = EF$`, reason: "Given" },
            { statement: md`$\triangle ABC \cong \triangle DEF$`, reason: md`ASA: $\overline{BC}$ is the side between $\angle B$ and $\angle C$` },
          ],
        },
        {
          kind: "diagram",
          view: [-1, 11, -1.5, 7],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: "3sqrt(3)", y: 3, dir: "n" },
            { name: "C1", x: "3sqrt(3) - sqrt(abs(s^2 - 9))", y: 0, label: "C_1", dir: "s" },
            { name: "C2", x: "3sqrt(3) + sqrt(abs(s^2 - 9))", y: 0, label: "C_2", dir: "s" },
            { name: "X", x: 10, y: 0, label: "", hidden: true },
          ],
          circles: [{ center: "B", radius: "s", dashed: true }],
          polygons: [
            { points: ["A", "B", "C2"], fill: 2 },
            { points: ["A", "B", "C1"], fill: 1 },
          ],
          segments: [
            { from: "A", to: "X", kind: "ray" },
            { from: "A", to: "B", label: "6" },
            { from: "B", to: "C1", color: 1 },
            { from: "B", to: "C2", color: 2, label: "{s}" },
          ],
          angles: [{ at: "A", from: "X", to: "B", label: md`30^\circ` }],
          // BC_1's length goes on its right, low down: on the left it would crowd AB's label in the thin triangle.
          labels: [{ x: "3sqrt(3) - 0.6sqrt(abs(s^2 - 9)) + 1.35/s", y: "1.2 - 0.45sqrt(abs(s^2 - 9))/s", text: "{s}" }],
          params: [{ name: "s", label: "BC", tex: "BC", min: 3, max: 5.9, step: 0.1, value: 4 }],
          readouts: [
            { label: md`AC_1`, value: "3sqrt(3) - sqrt(abs(s^2 - 9))" },
            { label: md`AC_2`, value: "3sqrt(3) + sqrt(abs(s^2 - 9))" },
          ],
          caption: md`**SSA fails.** $AB = 6$ and $\angle A = 30^\circ$ never change, and the slider sets $BC$. The dashed circle holds every point at distance $BC$ from $B$. For any $BC$ between 3 and 6 it crosses the ray twice, so $\triangle ABC_1$ and $\triangle ABC_2$ share a side, a side and an angle, yet have different shapes. At $BC = 3$ the circle just touches the ray, and there is one triangle.`,
        },
        {
          kind: "why",
          title: "Why side-side-angle fails",
          body: md`In SSA the angle is not between the two sides, so the side opposite it can swing. Walk along the ray from $A$ and watch your distance to $B$: it starts at $AB = 6$, shrinks to 3 at the point closest to $B$, then grows forever. (Drag the slider down to 3 and watch $C_1$ and $C_2$ merge. Unit 5 shows why a $30^\circ$ angle puts the closest point at exactly half of $AB$.) Every distance between 3 and 6 happens twice, once on the way in and once on the way out. That gives two places for $C$.

Count the other cases the same way. If $BC$ is less than 3, the walk never gets that close to $B$: no triangle. If $BC = 3$, it happens once, at the closest point: one triangle. If $BC$ is 6 or more, the way in never gets that far (it starts at 6, and $A$ itself can't be $C$), so only the way out counts: one triangle. And if the angle at $A$ is right or obtuse, the walk never heads toward $B$ at all, so the distance only grows from $AB$: one triangle when $BC > AB$, none otherwise.

So there is no SSA test. Three equal angles fail too (**AAA**): a small and a large equilateral triangle have the same angles but are not congruent.`,
        },
        {
          kind: "key",
          title: "HL for right triangles",
          body: md`**HL (Hypotenuse-Leg):** if two right triangles have equal hypotenuses and one pair of equal legs, they are congruent.

The **hypotenuse** is the side opposite the right angle, and the other two sides are the **legs**. HL looks like SSA, but the right angle rescues it. We prove it in the next lesson, once the Isosceles Triangle Theorem is available.`,
        },
        {
          kind: "diagram",
          view: [-5.5, 5.5, -1.2, 4.5],
          points: [
            { name: "C", x: 0, y: 0, dir: "s" },
            { name: "B", x: 0, y: 3, dir: "n" },
            { name: "A1", x: -4, y: 0, label: "A_1", dir: "sw" },
            { name: "A2", x: 4, y: 0, label: "A_2", dir: "se" },
          ],
          circles: [{ center: "B", radius: 5, dashed: true }],
          segments: [
            { from: "A1", to: "A2", kind: "line" },
            { from: "B", to: "C" },
            { from: "B", to: "A1", color: 1, label: "5" },
            { from: "B", to: "A2", color: 2, label: "5" },
          ],
          angles: [{ at: "C", from: "A2", to: "B", right: true }],
          caption: md`Why the right angle helps: on the line through $C$, the closest point to $B$ is $C$ itself, so each longer distance, like 5, happens once on each side of $C$. The two spots $A_1$ and $A_2$ are mirror images, so the two triangles are one triangle, flipped.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 6.8, -2.8, 2.8],
          points: [
            { name: "A", x: 0, y: 0, dir: "w" },
            { name: "C", x: 6, y: 0, dir: "e" },
            { name: "B", x: 3.276608, y: 2.294305, dir: "n" },
            { name: "D", x: 3.276608, y: -2.294305, dir: "s" },
          ],
          segments: [
            { from: "A", to: "B", ticks: 1 },
            { from: "A", to: "D", ticks: 1 },
            { from: "A", to: "C" },
            { from: "B", to: "C" },
            { from: "D", to: "C" },
          ],
          angles: [
            { at: "A", from: "C", to: "B" },
            { at: "A", from: "C", to: "D" },
          ],
          caption: md`Given: $AB = AD$ and $\angle BAC = \angle DAC$. The two triangles share the side $\overline{AC}$.`,
        },
        {
          kind: "proof",
          title: "Using a shared side",
          given: md`$AB = AD$ and $\angle BAC = \angle DAC$`,
          prove: md`$BC = DC$`,
          steps: [
            { statement: md`$AB = AD$`, reason: "Given" },
            { statement: md`$\angle BAC = \angle DAC$`, reason: "Given" },
            { statement: md`$AC = AC$`, reason: "Reflexive Property (shared side)" },
            { statement: md`$\triangle BAC \cong \triangle DAC$`, reason: md`SAS: the angles at $A$ are between the given sides` },
            { statement: md`$BC = DC$`, reason: "CPCTC" },
          ],
        },
        {
          kind: "diagram",
          view: [-0.8, 6.8, -1.6, 3.6],
          points: [
            { name: "A", x: 0, y: 2, dir: "nw" },
            { name: "B", x: 1, y: -1, dir: "sw" },
            { name: "M", x: 3, y: 1, dir: "n" },
            { name: "C", x: 5, y: 3, dir: "ne" },
            { name: "D", x: 6, y: 0, dir: "se" },
          ],
          segments: [
            { from: "A", to: "M", ticks: 1 },
            { from: "M", to: "D", ticks: 1 },
            { from: "B", to: "M", ticks: 2 },
            { from: "M", to: "C", ticks: 2 },
            { from: "A", to: "B" },
            { from: "D", to: "C" },
          ],
          angles: [
            { at: "M", from: "A", to: "B" },
            { at: "M", from: "D", to: "C" },
          ],
          caption: md`$\overline{AD}$ and $\overline{BC}$ cross at $M$, the midpoint of both.`,
        },
        {
          kind: "check",
          prompt: md`In the figure above, $M$ is the midpoint of both $\overline{AD}$ and $\overline{BC}$. Which test proves $\triangle AMB \cong \triangle DMC$?`,
          choices: ["SSS", "SAS", "ASA", "AAS", NOT_ENOUGH],
          accept: ["SAS"],
          explain: md`The midpoints give $AM = DM$ and $BM = CM$. The angles at $M$ are vertical angles, so they are equal, and each is between its two sides. That's SAS.`,
        },
        {
          kind: "check",
          prompt: md`In $\triangle ABC$ and $\triangle DEF$: $\angle A = \angle D$, $\angle B = \angle E$ and $AC = DF$. Which test matches these facts?`,
          choices: ["SSS", "SAS", "ASA", "AAS", "HL", NOT_ENOUGH],
          accept: ["AAS"],
          explain: md`The side between $\angle A$ and $\angle B$ is $\overline{AB}$. The given side $\overline{AC}$ isn't between them, so this is AAS.`,
        },
      ],
      practice: [whichCriterion, ssaCount, cpctcAlgebra],
    },
    {
      id: "isosceles-and-equilateral-triangles",
      title: "Isosceles and equilateral triangles",
      summary: "Equal sides force equal angles, and equal angles force equal sides. Both proved with congruence, then put to work.",
      blocks: [
        {
          kind: "text",
          body: md`An **isosceles triangle** has at least two equal sides. Those two are the **legs**, and the third side is the **base**. The angle between the legs is the **vertex angle**, and the two angles at the ends of the base are the **base angles**. An **equilateral triangle** has all three sides equal, so it is isosceles three ways at once.`,
        },
        {
          kind: "diagram",
          view: [-3.5, 3.5, -0.9, 4.6],
          points: [
            { name: "A", x: 0, y: 4, dir: "n" },
            { name: "B", x: -2.5, y: 0, dir: "sw" },
            { name: "C", x: 2.5, y: 0, dir: "se" },
            { name: "M", x: 0, y: 0, dir: "s" },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          segments: [
            { from: "A", to: "B", ticks: 1, label: md`\text{leg}` },
            { from: "A", to: "C", ticks: 1, label: md`\text{leg}` },
            { from: "A", to: "M", dashed: true },
          ],
          angles: [
            { at: "A", from: "B", to: "M" },
            { at: "A", from: "M", to: "C" },
            { at: "B", from: "C", to: "A", arcs: 2, color: 2 },
            { at: "C", from: "A", to: "B", arcs: 2, color: 2 },
          ],
          caption: md`Legs $\overline{AB}$ and $\overline{AC}$ are equal, and $\overline{BC}$ is the base. The dashed segment bisects the vertex angle $\angle A$ and meets the base at $M$. The orange base angles are what we're about to prove equal.`,
        },
        {
          kind: "key",
          title: "The Isosceles Triangle Theorem and its converse",
          body: md`- **Isosceles Triangle Theorem:** if two sides of a triangle are equal, the angles opposite them are equal.
- **Converse:** if two angles of a triangle are equal, the sides opposite them are equal.

"Opposite" is the key word. In $\triangle ABC$, $\angle B$ is opposite $\overline{AC}$, the side it doesn't touch.`,
        },
        {
          kind: "why",
          title: "The idea: fold it",
          body: md`Fold the triangle along the line that splits the vertex angle in half. The two halves of $\angle A$ line up, and the legs are equal, so $B$ lands exactly on $C$. Then $\angle B$ lands on $\angle C$. An isosceles triangle is its own mirror image. The proof writes that fold as an SAS congruence.`,
        },
        {
          kind: "proof",
          title: "Isosceles Triangle Theorem",
          given: md`$\triangle ABC$ with $AB = AC$`,
          prove: md`$\angle B = \angle C$`,
          steps: [
            { statement: md`$AB = AC$`, reason: "Given" },
            { statement: md`Draw the ray that bisects $\angle BAC$; it meets $\overline{BC}$ at $M$`, reason: "Every angle has a bisector (Protractor Postulate)" },
            { statement: md`$\angle BAM = \angle CAM$`, reason: "Definition of angle bisector" },
            { statement: md`$AM = AM$`, reason: "Reflexive Property" },
            { statement: md`$\triangle BAM \cong \triangle CAM$`, reason: md`SAS: $\angle BAM$ is between $\overline{AB}$ and $\overline{AM}$` },
            { statement: md`$\angle B = \angle C$`, reason: "CPCTC" },
          ],
        },
        {
          kind: "why",
          title: "A proof with no extra lines",
          body: md`Here is a slicker proof, credited to Pappus of Alexandria. Compare $\triangle ABC$ with **itself**, read in a different order, $\triangle ACB$:

- $AB = AC$ (given), and $AC = AB$ (the same fact read backwards).
- $\angle A = \angle A$ (Reflexive Property), and it is between those sides.

So $\triangle ABC \cong \triangle ACB$ by SAS. By CPCTC, the 2nd letters match: $\angle B = \angle C$. The triangle is congruent to its own mirror image, which is the fold without the fold.`,
        },
        {
          kind: "proof",
          title: "Converse of the Isosceles Triangle Theorem",
          given: md`$\triangle ABC$ with $\angle B = \angle C$`,
          prove: md`$AB = AC$`,
          steps: [
            { statement: md`$\angle B = \angle C$`, reason: "Given" },
            { statement: md`Draw the bisector of $\angle BAC$, meeting $\overline{BC}$ at $M$`, reason: "Protractor Postulate" },
            { statement: md`$\angle BAM = \angle CAM$`, reason: "Definition of angle bisector" },
            { statement: md`$AM = AM$`, reason: "Reflexive Property" },
            { statement: md`$\triangle BAM \cong \triangle CAM$`, reason: md`AAS: $\overline{AM}$ is not between $\angle B$ and $\angle BAM$` },
            { statement: md`$AB = AC$`, reason: "CPCTC" },
          ],
        },
        {
          kind: "key",
          title: "Equilateral and equiangular",
          body: md`- An equilateral triangle is **equiangular**: all three angles are $60^\circ$.
- An equiangular triangle is equilateral.

The second fact is the same proof as below, run with the converse instead.`,
        },
        {
          kind: "proof",
          title: "Equilateral triangles are equiangular",
          given: md`$\triangle ABC$ with $AB = BC = CA$`,
          prove: md`$\angle A = \angle B = \angle C = 60^\circ$`,
          steps: [
            { statement: md`$AB = AC$`, reason: "Given" },
            { statement: md`$\angle C = \angle B$`, reason: md`Isosceles Triangle Theorem ($\overline{AB}$ is opposite $\angle C$, $\overline{AC}$ is opposite $\angle B$)` },
            { statement: md`$BA = BC$`, reason: "Given" },
            { statement: md`$\angle C = \angle A$`, reason: md`Isosceles Triangle Theorem ($\overline{BA}$ is opposite $\angle C$, $\overline{BC}$ is opposite $\angle A$)` },
            { statement: md`$\angle A = \angle B = \angle C$`, reason: "Transitive Property of Equality" },
            { statement: md`$3\angle A = 180^\circ$, so $\angle A = 60^\circ$`, reason: "Triangle Angle Sum Theorem, Division Property of Equality" },
          ],
        },
        {
          kind: "text",
          body: md`Last lesson promised a proof of **HL**, and the Isosceles Triangle Theorem is the missing piece. The plan: build a mirror copy of one triangle next to the other, so that together they form an isosceles triangle.`,
        },
        {
          kind: "diagram",
          view: [-4, 12, -0.9, 4.8],
          points: [
            { name: "A", x: -3, y: 0, dir: "sw" },
            { name: "C", x: 0, y: 0, dir: "s" },
            { name: "B", x: 0, y: 4, dir: "n" },
            { name: "G", x: 3, y: 0, dir: "se" },
            { name: "F", x: 8, y: 0, dir: "sw" },
            { name: "E", x: 8, y: 4, dir: "n" },
            { name: "D", x: 11, y: 0, dir: "se" },
          ],
          polygons: [
            { points: ["A", "C", "B"], fill: 1 },
            { points: ["D", "F", "E"], fill: 2 },
            { points: ["G", "C", "B"], fill: 2, dashed: true },
          ],
          segments: [
            { from: "A", to: "B", ticks: 2 },
            { from: "B", to: "C", ticks: 1 },
            { from: "D", to: "E", ticks: 2 },
            { from: "E", to: "F", ticks: 1 },
          ],
          angles: [
            { at: "C", from: "A", to: "B", right: true },
            { at: "C", from: "G", to: "B", right: true },
            { at: "F", from: "D", to: "E", right: true },
          ],
          caption: md`Right angles at $C$ and $F$, equal hypotenuses (two ticks) and equal legs $BC = EF$ (one tick). The dashed $\triangle GCB$ is built to match $\triangle DEF$, and with $\triangle ACB$ it forms the big $\triangle ABG$.`,
        },
        {
          kind: "proof",
          title: "HL Theorem",
          given: md`$\angle ACB = \angle DFE = 90^\circ$, $AB = DE$, $BC = EF$`,
          prove: md`$\triangle ABC \cong \triangle DEF$`,
          steps: [
            { statement: md`$\angle ACB = \angle DFE = 90^\circ$, $AB = DE$, $BC = EF$`, reason: "Given" },
            { statement: md`Mark $G$ on the ray opposite $\overrightarrow{CA}$ with $CG = FD$`, reason: "Ruler Postulate" },
            { statement: md`$\angle BCG = 90^\circ$`, reason: md`Linear Pair Postulate: $\angle ACB + \angle BCG = 180^\circ$` },
            { statement: md`$\triangle GCB \cong \triangle DFE$`, reason: md`SAS: $CG = FD$, $\angle BCG = \angle EFD$, $CB = FE$` },
            { statement: md`$BG = ED$, so $BG = AB$`, reason: md`CPCTC, then Substitution ($ED = AB$)` },
            { statement: md`$\angle A = \angle G$`, reason: md`Isosceles Triangle Theorem in $\triangle ABG$` },
            { statement: md`$\angle G = \angle D$`, reason: "CPCTC (step 4)" },
            { statement: md`$\angle A = \angle D$`, reason: "Transitive Property of Equality" },
            { statement: md`$\triangle ABC \cong \triangle DEF$`, reason: md`AAS: $\angle A = \angle D$, $\angle ACB = \angle DFE$, $BC = EF$` },
          ],
        },
        {
          kind: "example",
          title: "Angles from one angle",
          problem: md`In $\triangle PQR$, $PQ = PR$ and $\angle P = 40^\circ$. Find $\angle Q$.`,
          steps: [
            { math: md`\angle Q = \angle R`, note: md`$\overline{PQ}$ is opposite $\angle R$ and $\overline{PR}$ is opposite $\angle Q$. Equal sides, so equal angles.` },
            { math: md`40^\circ + \angle Q + \angle R = 180^\circ`, note: "Triangle Angle Sum Theorem." },
            { math: md`2\angle Q = 140^\circ \;\Rightarrow\; \angle Q = 70^\circ`, note: "Substitute $\\angle R = \\angle Q$ and solve." },
            { math: md`\angle Q = \frac{180^\circ - \angle P}{2} < 90^\circ`, note: "In general a base angle is half of what the vertex angle leaves, so base angles are always acute." },
          ],
        },
        {
          kind: "example",
          title: "Equal angles give an equation",
          problem: md`In $\triangle ABC$, $\angle B = \angle C$, $AB = 3x - 2$ and $AC = x + 8$. Find $AB$.`,
          steps: [
            { math: md`AB = AC`, note: md`$\overline{AB}$ is opposite $\angle C$ and $\overline{AC}$ is opposite $\angle B$. Converse of the Isosceles Triangle Theorem.` },
            { math: md`3x - 2 = x + 8`, note: "Substitute." },
            { math: md`2x = 10 \;\Rightarrow\; x = 5`, note: "" },
            { math: md`AB = 3(5) - 2 = 13`, note: md`Check: $AC = 5 + 8 = 13$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`In $\triangle ABC$, $AB = AC$ and $\angle B = 65^\circ$. Find $\angle A$ in degrees.`,
          answer: "50",
          explain: md`$\angle C = \angle B = 65^\circ$, so $\angle A = 180^\circ - 65^\circ - 65^\circ = 50^\circ$.`,
        },
        {
          kind: "check",
          prompt: md`In $\triangle PQR$, $\angle P = \angle Q = 55^\circ$ and $PR = 9$. Find $QR$.`,
          answer: "9",
          explain: md`$\angle P$ is opposite $\overline{QR}$ and $\angle Q$ is opposite $\overline{PR}$. The angles are equal, so $QR = PR = 9$.`,
        },
      ],
      practice: [isoscelesAngles, isoscelesSolve, isoscelesFind],
    },
    {
      id: "triangle-inequalities",
      title: "Triangle inequalities",
      summary: "Which side lengths can make a triangle, and how the sides and angles line up by size.",
      blocks: [
        {
          kind: "text",
          body: md`Can sticks of length 2, 3 and 10 make a triangle? Lay the 10 down and hinge the other two at its ends. Even stretched out flat, $2 + 3 = 5$ doesn't reach across. A straight path is the shortest way between two points, so any detour through a third vertex has to be longer than the direct side.

This lesson turns that picture into theorems. First, how sides and angles compare. Then the inequality itself.`,
        },
        {
          kind: "diagram",
          view: [-4.5, 7.8, -0.8, 4.6],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 7, y: 0, dir: "se" },
            { name: "C", x: "4cos(t pi/180)", y: "4sin(t pi/180)", dir: "n" },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          segments: [
            { from: "A", to: "B", label: "7" },
            { from: "A", to: "C", label: "4" },
          ],
          angles: [{ at: "A", from: "B", to: "C", label: md`{t}^\circ` }],
          params: [{ name: "t", label: "angle A", tex: md`\angle A`, min: 2, max: 178, step: 1, value: 60 }],
          readouts: [{ label: "BC", value: "sqrt((7 - 4cos(t pi/180))^2 + (4sin(t pi/180))^2)" }],
          caption: md`$AB = 7$ and $AC = 4$ are fixed, and the slider opens the angle at $A$. $BC$ gets close to $7 - 4 = 3$ when the angle is nearly $0^\circ$ and close to $7 + 4 = 11$ when it is nearly $180^\circ$. At the very ends the triangle is flat, so a real triangle has $3 < BC < 11$. Notice too that a bigger angle at $A$ means a longer opposite side.`,
        },
        {
          kind: "key",
          title: "Sides and angles by size",
          body: md`In any triangle:

- If one side is longer than another, the angle opposite it is larger.
- If one angle is larger than another, the side opposite it is longer.

So the longest side is opposite the largest angle, and the shortest side is opposite the smallest angle.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 7.8, -0.9, 3.8],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 2, y: 3, dir: "n" },
            { name: "C", x: 7, y: 0, dir: "se" },
            { name: "D", x: "sqrt(13)", y: 0, dir: "s" },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          segments: [
            { from: "A", to: "B", ticks: 1 },
            { from: "A", to: "D", ticks: 1 },
            { from: "B", to: "D", dashed: true },
          ],
          angles: [
            { at: "B", from: "A", to: "D", color: 2 },
            { at: "D", from: "A", to: "B", color: 2 },
            { at: "C", from: "D", to: "B", arcs: 2 },
          ],
          caption: md`$AC > AB$. Mark $D$ on $\overline{AC}$ with $AD = AB$. The orange angles are equal, because $\triangle ABD$ is isosceles.`,
        },
        {
          kind: "proof",
          title: "Longer side, larger angle",
          given: md`$\triangle ABC$ with $AC > AB$`,
          prove: md`$\angle ABC > \angle C$`,
          steps: [
            { statement: md`Mark $D$ on $\overline{AC}$ with $AD = AB$`, reason: md`Ruler Postulate (possible since $AB < AC$)` },
            { statement: md`$\angle ABD = \angle ADB$`, reason: md`Isosceles Triangle Theorem in $\triangle ABD$` },
            { statement: md`$\angle ADB = \angle DBC + \angle C$`, reason: md`Exterior Angle Theorem in $\triangle BDC$` },
            { statement: md`$\angle ADB > \angle C$`, reason: md`$\angle DBC > 0$, so adding it makes the sum bigger` },
            { statement: md`$\angle ABC = \angle ABD + \angle DBC$`, reason: md`Angle Addition Postulate ($D$ is inside $\angle ABC$)` },
            { statement: md`$\angle ABC > \angle ABD$`, reason: md`$\angle DBC > 0$` },
            { statement: md`$\angle ABC > \angle ABD = \angle ADB > \angle C$`, reason: md`Steps 2, 4 and 6. If $a > b$ and $b > c$, then $a > c$: something bigger than a quantity that is bigger than $\angle C$ is itself bigger than $\angle C$` },
          ],
        },
        {
          kind: "why",
          title: "Why prove the converse indirectly?",
          body: md`Now we want the reverse: a larger angle forces a longer opposite side. For two sides there are only three possibilities: shorter, equal or longer. Rule out two of them and the third must hold.

This is an **indirect proof**, or proof by contradiction: assume the opposite of what you want and show it leads to something false. It is legitimate because "if $p$ then $q$" and its contrapositive "if not $q$ then not $p$" are logically the same statement (Unit 1).`,
        },
        {
          kind: "proof",
          title: "Larger angle, longer side",
          given: md`$\triangle ABC$ with $\angle B > \angle C$`,
          prove: md`$AC > AB$`,
          steps: [
            { statement: md`Suppose $AC \le AB$`, reason: "Assumption for an indirect proof" },
            { statement: md`If $AC = AB$, then $\angle B = \angle C$`, reason: md`Isosceles Triangle Theorem ($\overline{AC}$ is opposite $\angle B$)` },
            { statement: md`If $AC < AB$, then $\angle B < \angle C$`, reason: "Longer side, larger angle (just proved)" },
            { statement: md`Either way $\angle B \le \angle C$, which contradicts $\angle B > \angle C$`, reason: "Given" },
            { statement: md`$AC > AB$`, reason: "The assumption was false" },
          ],
        },
        {
          kind: "key",
          title: "Triangle Inequality Theorem",
          body: md`The sum of any two sides of a triangle is greater than the third side:

$$a + b > c, \qquad b + c > a, \qquad a + c > b.$$

So if two sides are $a$ and $b$, the third side $x$ is trapped: $|a - b| < x < a + b$.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 7, -0.9, 7.8],
          points: [
            { name: "B", x: 0, y: 0, dir: "sw" },
            { name: "C", x: 6, y: 0, dir: "se" },
            { name: "A", x: 2, y: 3, dir: "w" },
            { name: "D", x: 4.773501, y: 7.160251, dir: "n" },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          segments: [
            { from: "A", to: "D", dashed: true, ticks: 1 },
            { from: "A", to: "C", ticks: 1 },
            { from: "D", to: "C", dashed: true },
          ],
          angles: [
            { at: "D", from: "A", to: "C", color: 2 },
            { at: "C", from: "A", to: "D", color: 2 },
            { at: "C", from: "B", to: "D", arcs: 2 },
          ],
          caption: md`Extend $\overline{BA}$ past $A$ to $D$ with $AD = AC$. Then $BD = BA + AC$, and the two orange angles are equal.`,
        },
        {
          kind: "proof",
          title: "Triangle Inequality Theorem",
          given: md`$\triangle ABC$`,
          prove: md`$BA + AC > BC$`,
          steps: [
            { statement: md`Extend $\overline{BA}$ past $A$ to $D$ with $AD = AC$`, reason: "Ruler Postulate" },
            { statement: md`$\angle ADC = \angle ACD$`, reason: md`Isosceles Triangle Theorem in $\triangle ADC$` },
            { statement: md`$\angle BCD = \angle BCA + \angle ACD$`, reason: md`Angle Addition Postulate ($A$ is inside $\angle BCD$)` },
            { statement: md`$\angle BCD > \angle ACD = \angle BDC$`, reason: md`$\angle BCA > 0$; step 2 ($\angle BDC$ is $\angle ADC$, since $A$ is on $\overline{DB}$)` },
            { statement: md`$BD > BC$`, reason: md`Larger angle, longer side, in $\triangle BCD$` },
            { statement: md`$BD = BA + AD$`, reason: "Segment Addition Postulate" },
            { statement: md`$BA + AC > BC$`, reason: md`Substitution ($AD = AC$)` },
          ],
        },
        {
          kind: "why",
          title: "Where the range comes from, and a shortcut",
          body: md`Call the known sides $a$ and $b$, with $a \ge b$, and the third side $x$. The theorem gives three inequalities:

- $x < a + b$.
- $a < b + x$, which means $x > a - b$.
- $b < a + x$, which always holds, because $a \ge b$ and $x > 0$.

So $a - b < x < a + b$. The same idea gives a shortcut for testing three lengths: **only check that the two shorter ones add up to more than the longest.** Adding anything positive to the longest side already beats either shorter one.`,
        },
        {
          kind: "example",
          title: "Range for the third side",
          problem: md`Two sides of a triangle are 5 and 8. What lengths can the third side $x$ have?`,
          steps: [
            { math: md`x < 5 + 8 = 13`, note: "Shorter than the other two together." },
            { math: md`8 < 5 + x \;\Rightarrow\; x > 3`, note: "The longer known side must be shorter than the other two together." },
            { math: md`5 < 8 + x`, note: "Always true; it adds nothing." },
            { math: md`3 < x < 13`, note: "Both ends excluded: at 3 or 13 the triangle lies flat." },
          ],
        },
        {
          kind: "numberline",
          range: [0, 15],
          intervals: [{ from: 3, to: 13, fromOpen: true, toOpen: true }],
          points: [
            { at: 3, open: true, label: "8 - 5" },
            { at: 13, open: true, label: "8 + 5" },
          ],
          caption: md`The possible third sides for 5 and 8: every length strictly between $3$ and $13$.`,
        },
        {
          kind: "check",
          prompt: md`Two sides of a triangle are 6 and 10. Write the possible lengths $x$ of the third side as an inequality.`,
          answer: "4 < x < 16",
          form: "inequality",
          explain: md`$x < 6 + 10 = 16$, and $10 < 6 + x$ gives $x > 4$. So $4 < x < 16$.`,
        },
        {
          kind: "check",
          prompt: md`In $\triangle ABC$, $AB = 5$, $BC = 7$ and $CA = 9$. Which angle is largest?`,
          choices: [md`$\angle A$`, md`$\angle B$`, md`$\angle C$`],
          accept: [md`$\angle B$`],
          explain: md`The longest side is $\overline{CA}$, and the vertex it doesn't touch is $B$. So $\angle B$ is the largest angle.`,
        },
      ],
      practice: [thirdSideRange, sidesAlgebra, sideAngleOrder],
    },
  ],
};
