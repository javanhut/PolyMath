import { fracTex, gcd, paren, poly, signed, type Rng } from "../../math/random";
import { md, type DiagramSpec, type Figure, type Generator, type SeriesColor, type Step, type Unit } from "../types";

// ── Shared wording ──────────────────────────────────────────────────────────

const DEG = "Give the angle in degrees.";
const ARC = "Give the arc measure in degrees.";
const PI_FORM = md`Give an exact answer in terms of $\pi$, like 3pi.`;
const EXACT = md`Give an exact answer, with any square root simplified (type $2\sqrt{5}$ as 2sqrt(5)).`;
const POINT = "Give the point as (x, y).";
const SOLS = "Give all solutions, separated by commas.";

/** Degree answers also take "160 degrees" and "160 deg"; the checker itself strips only the ° sign. */
const degreeWords = (g: Generator): Generator => (r) => {
  const p = g(r);
  if (p.answer === undefined || p.choices || !(p.prompt.includes(DEG) || p.prompt.includes(ARC))) return p;
  return { ...p, accept: [...(p.accept ?? []), `${p.answer} degrees`, `${p.answer} deg`] };
};

// ── Number helpers ──────────────────────────────────────────────────────────

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

/** c·√n simplified, as answer text and LaTeX. */
function root(n: number, c = 1): { text: string; tex: string } {
  const [k0, m] = surd(n);
  const k = k0 * c;
  if (m === 1) return { text: String(k), tex: String(k) };
  const lead = k === 1 ? "" : String(k);
  return { text: `${lead}sqrt(${m})`, tex: md`${lead}\sqrt{${m}}` };
}

/** (n/d)π as answer text: "6pi", "5pi/2", "pi". */
function piText(n: number, d = 1): string {
  const g = gcd(n, d) || 1;
  [n, d] = [n / g, d / g];
  const top = n === 1 ? "pi" : `${n}pi`;
  return d === 1 ? top : `${top}/${d}`;
}

/** (n/d)π as LaTeX. */
function piTex(n: number, d = 1): string {
  const g = gcd(n, d) || 1;
  [n, d] = [n / g, d / g];
  const top = n === 1 ? md`\pi` : md`${n}\pi`;
  return d === 1 ? top : md`\frac{${top}}{${d}}`;
}

/** ax + b. */
const lin = (a: number, b: number) => poly([[a, "x"], [b, ""]]);

function shuffled<T>(r: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];

// ── Diagram helpers ─────────────────────────────────────────────────────────

type DPoint = NonNullable<DiagramSpec["points"]>[number];
type DSegment = NonNullable<DiagramSpec["segments"]>[number];
type DAngle = NonNullable<DiagramSpec["angles"]>[number];
type DLabel = NonNullable<DiagramSpec["labels"]>[number];
type Dir = NonNullable<DPoint["dir"]>;
type Pt = { x: number; y: number };

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const RAD = Math.PI / 180;
const COMPASS: Dir[] = ["e", "ne", "n", "nw", "w", "sw", "s", "se"];
/** The label direction pointing away from the centre for a point at this angle. */
const outward = (deg: number): Dir => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
/** The compass direction from p towards q. */
const toward = (p: Pt, q: Pt): Dir => outward(Math.atan2(q.y - p.y, q.x - p.x) / RAD);

function polar(r: number, deg: number, cx = 0, cy = 0) {
  return { x: round3(cx + r * Math.cos(deg * RAD)), y: round3(cy + r * Math.sin(deg * RAD)) };
}

/** A named point on the circle of radius r about the origin, at an angle in degrees. */
function on(name: string, deg: number, r = 4, dir?: Dir): DPoint {
  return { name, ...polar(r, deg), dir: dir ?? outward(deg) };
}

type XY = [string, string];
const onExpr = (r: number | string, degExpr: string): XY => [`(${r})*cos((${degExpr})*pi/180)`, `(${r})*sin((${degExpr})*pi/180)`];

/** A readout expression that really measures angle AVB in degrees from the coordinates, so a live figure shows a measurement, not the theorem. */
function measureAngle(v: XY, a: XY, b: XY): string {
  const d = (p: string, q: string) => `((${p}) - (${q}))`;
  const [ux, uy, vx, vy] = [d(a[0], v[0]), d(a[1], v[1]), d(b[0], v[0]), d(b[1], v[1])];
  return `acos((${ux}*${vx} + ${uy}*${vy})/sqrt((${ux}^2 + ${uy}^2)*(${vx}^2 + ${vy}^2)))*180/pi`;
}

/** Intersection of lines PQ and RS (numbers). */
function meet(p: Pt, q: Pt, r: Pt, s: Pt) {
  const d = (p.x - q.x) * (r.y - s.y) - (p.y - q.y) * (r.x - s.x);
  const a = p.x * q.y - p.y * q.x;
  const b = r.x * s.y - r.y * s.x;
  return { x: round3((a * (r.x - s.x) - (p.x - q.x) * b) / d), y: round3((a * (r.y - s.y) - (p.y - q.y) * b) / d) };
}

// Practice figures. Circle O has radius 4 about the origin unless a figure is
// built to scale from its own lengths. Labels are sized in diagram units at
// roughly 43 px per unit, the scale of a 12-unit-wide view.

const deg = (v: number | string) => md`${v}^\circ`;
const degOf = (e: string) => md`(${e})^\circ`;
const centre = (dir: Dir = "s"): DPoint => ({ name: "O", x: 0, y: 0, dir });
const HIDDEN_CENTRE: DPoint = { name: "O", x: 0, y: 0, hidden: true, label: "" };
const RING = [{ center: "O", radius: 4 }];
const ringView = (pad = 2): DiagramSpec["view"] => [-4 - pad, 4 + pad, -4 - pad, 4 + pad];

/** Pixels per diagram unit when a view is drawn (Diagram.tsx fits it into about 516 × 556 px). */
const ppu = ([x0, x1, y0, y1]: DiagramSpec["view"]) => Math.min(516 / (x1 - x0), 556 / (y1 - y0));
/**
 * Rough width of a LaTeX label, in diagram units at the given scale (a 12-unit view by default).
 * Measured against KaTeX in the browser: about 7.3 px a character, plus the space KaTeX puts
 * around + and − (about 15 px) and = (about 19 px), and a little more for capitals.
 */
function texWidth(tex: string, scale = 43): number {
  const bare = tex.replace(/\\circ/g, "o").replace(/\\[a-zA-Z]+/g, "").replace(/[{}^ ]/g, "");
  const ops = (bare.match(/[+-]/g) ?? []).length;
  const rels = (bare.match(/=/g) ?? []).length;
  const caps = (bare.match(/[A-Z]/g) ?? []).length;
  return (7.3 * bare.length + 4.3 + 15 * ops + 19 * rels + 3 * caps) / scale;
}

/** A label just outside the circle of radius r about the origin, at this angle, pushed out further for wide text. */
function arcNote(at: number, text: string, r = 4): DLabel {
  const off = 0.3 + (texWidth(text) / 2) * Math.abs(Math.cos(at * RAD)) + 0.25 * Math.abs(Math.sin(at * RAD));
  return { ...polar(r + off, at), text };
}

/**
 * Where to put the label of angle P1-V-P2 (under 180°): on the bisector, far enough out
 * that the text clears both sides, and no farther than `max`. With `stop` (a distance
 * along the bisector, such as a chord across the angle) a label that can't fit before
 * it goes just beyond it instead.
 */
function angleNote(v: Pt, p1: Pt, p2: Pt, text: string, o: { max?: number; stop?: number; scale?: number } = {}): DLabel {
  const px = 1 / (o.scale ?? 43);
  const unit = (p: Pt) => {
    const l = Math.hypot(p.x - v.x, p.y - v.y);
    return { x: (p.x - v.x) / l, y: (p.y - v.y) / l, l };
  };
  const [u1, u2] = [unit(p1), unit(p2)];
  const b = { x: u1.x + u2.x, y: u1.y + u2.y };
  const bl = Math.hypot(b.x, b.y) || 1;
  const half = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y))) / 2;
  const dir = { x: b.x / bl, y: b.y / bl };
  // The text is a box about w × 20 px; how far it reaches across a line with unit normal n.
  const [hw, hh] = [texWidth(text, 1 / px) / 2, 10 * px];
  const reach = (n: Pt) => hw * Math.abs(n.x) + hh * Math.abs(n.y);
  const clear = Math.max(...[u1, u2].map((u) => (reach({ x: -u.y, y: u.x }) + 6 * px) / Math.sin(half)));
  const along = reach(dir);
  // At least as far out as the engine's own angle labels (36 px) and clear of its 20 px angle mark; at most about 140 px.
  let t = Math.min(Math.max(36 * px, 24 * px + along, clear), o.max ?? Math.min(140 * px, 0.7 * Math.min(u1.l, u2.l)));
  if (o.stop !== undefined && t + along > o.stop - 4 * px) t = o.stop + along + 6 * px;
  return { x: round3(v.x + dir.x * t), y: round3(v.y + dir.y * t), text };
}

/** A label beside segment PQ, `at` of the way along it, on the side away from `away`, clear of the line. */
function sideNote(p: Pt, q: Pt, text: string, away: Pt, o: { scale?: number; at?: number } = {}): DLabel {
  const px = 1 / (o.scale ?? 43);
  const at = o.at ?? 0.5;
  const m = { x: p.x + (q.x - p.x) * at, y: p.y + (q.y - p.y) * at };
  const l = Math.hypot(q.x - p.x, q.y - p.y);
  let n = { x: -(q.y - p.y) / l, y: (q.x - p.x) / l };
  if ((away.x - m.x) * n.x + (away.y - m.y) * n.y > 0) n = { x: -n.x, y: -n.y };
  const d = (texWidth(text, 1 / px) / 2) * Math.abs(n.x) + 10 * px * Math.abs(n.y) + 5 * px;
  return { x: round3(m.x + n.x * d), y: round3(m.y + n.y * d), text };
}

/** Distance from c to segment PQ. */
function toSegment(c: Pt, p: Pt, q: Pt): number {
  const [dx, dy] = [q.x - p.x, q.y - p.y];
  const t = Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(c.x - p.x - t * dx, c.y - p.y - t * dy);
}

/** The label direction at v whose spot is farthest from the given segments (lines through v, or labels as short segments). */
function clearDir(v: Pt, segs: [Pt, Pt][]): Dir {
  let [best, far] = ["s" as Dir, -1];
  COMPASS.forEach((d, i) => {
    const c = { x: v.x + 0.45 * Math.cos(i * 45 * RAD), y: v.y + 0.45 * Math.sin(i * 45 * RAD) };
    const gap = Math.min(...segs.map(([p, q]) => toSegment(c, p, q)));
    if (gap > far + 1e-9) [best, far] = [d, gap];
  });
  return best;
}

interface Mark {
  at: string;
  from: string;
  to: string;
  label?: string;
  color?: SeriesColor;
  stop?: number;
}

/** How far outside its circle a highlighted arc is drawn, in pixels, so the circle's own stroke doesn't cover it. */
const ARC_LIFT = 2;

/**
 * A practice figure whose labels are placed clear of the lines: angle labels clear of the
 * angle's sides, and segment labels clear of their segment by the width of the text.
 * Highlighted arcs are drawn just outside their circle so they stay visible.
 */
function build(spec: DiagramSpec & { marks?: Mark[] }): Figure {
  const { marks = [], ...rest } = spec;
  const scale = ppu(spec.view);
  const points: DPoint[] = [...(spec.points ?? [])];
  const at = new Map(points.map((p) => [p.name, { x: Number(p.x), y: Number(p.y) }]));
  const angles: DAngle[] = [...(spec.angles ?? [])];
  const labels: DLabel[] = [...(spec.labels ?? [])];
  for (const m of marks) {
    angles.push({ at: m.at, from: m.from, to: m.to, color: m.color });
    if (m.label) labels.push(angleNote(at.get(m.at)!, at.get(m.from)!, at.get(m.to)!, m.label, { stop: m.stop, scale }));
  }
  // The engine puts segment labels 14 px from the line whatever their width; wide ones then cross it.
  const away = { x: [...at.values()].reduce((s, p) => s + p.x, 0) / at.size, y: [...at.values()].reduce((s, p) => s + p.y, 0) / at.size };
  const segments = (spec.segments ?? []).map((s) => {
    if (!s.label) return s;
    labels.push(sideNote(at.get(s.from)!, at.get(s.to)!, s.label, away, { scale }));
    return { ...s, label: undefined };
  });
  const arcs = (spec.arcs ?? []).map((a, i) => {
    const c = at.get(a.center)!;
    const lift = (name: string, end: string) => {
      const p = at.get(name)!;
      const k = 1 + ARC_LIFT / scale / Math.hypot(p.x - c.x, p.y - c.y);
      points.push({ name: `arc${i}${end}`, x: round3(c.x + (p.x - c.x) * k), y: round3(c.y + (p.y - c.y) * k), hidden: true, label: "" });
      return `arc${i}${end}`;
    };
    return { ...a, from: lift(a.from, "a"), to: lift(a.to, "b") };
  });
  return { kind: "diagram", ...rest, points, segments, arcs, angles, labels };
}

/** Points named in order counterclockwise around circle O, the first at `start` degrees and arcs[i] degrees between point i and the next. */
function around(names: string[], arcs: number[], start: number) {
  const at: number[] = [start];
  for (let i = 1; i < names.length; i++) at.push(at[i - 1]! + arcs[i - 1]!);
  return { points: names.map((n, i) => on(n, at[i]!)), mid: (i: number) => at[i]! + arcs[i]! / 2 };
}

/**
 * Congruent chords AB and CD of circle O, each cutting off a minor arc of `arc` degrees: AB on the left and CD
 * on the right, or for arcs over 90° AB at the bottom and CD at the top. A wide angle at O then opens up or down,
 * so a label like (7x + 34)° lies across it and fits before the chord; lying along it, it would not.
 */
function chordsFig(arc: number, o: { arcAB?: string; angleAOB?: string; angleCOD?: string; majorCD?: boolean }): Figure {
  const h = arc / 2;
  const rot = arc > 90 ? 90 : 0;
  const stop = 4 * Math.cos(h * RAD);
  const O = { x: 0, y: 0 };
  const segments: DSegment[] = [
    { from: "A", to: "B", ticks: 1 },
    { from: "C", to: "D", ticks: 1 },
  ];
  const marks: Mark[] = [];
  // O's label goes where it is farthest from the radii drawn and from the angle labels (on the bisectors).
  const spokes: [Pt, Pt][] = [[O, O]];
  if (o.angleAOB) {
    segments.push({ from: "O", to: "A" }, { from: "O", to: "B" });
    marks.push({ at: "O", from: "A", to: "B", label: o.angleAOB, stop });
    spokes.push([O, polar(4, rot + 180 - h)], [O, polar(4, rot + 180 + h)], [O, polar(1.5, rot + 180)]);
  }
  if (o.angleCOD) {
    segments.push({ from: "O", to: "C" }, { from: "O", to: "D" });
    marks.push({ at: "O", from: "C", to: "D", label: o.angleCOD, color: 2, stop });
    spokes.push([O, polar(4, rot - h)], [O, polar(4, rot + h)], [O, polar(1.5, rot)]);
  }
  // With all four radii drawn the gaps between them can be too narrow for O's label beside the point, so it goes
  // out along a gap, just far enough to clear the radii on either side.
  const both = !!(o.angleAOB && o.angleCOD);
  const view = ringView();
  const px = 1 / ppu(view);
  const half = (90 - h) * RAD;
  const out = Math.max(18 * px, (7 * px * Math.sin(half) + 10.5 * px * Math.cos(half) + 3 * px) / Math.sin(half));
  return build({
    view,
    circles: RING,
    points: [
      both ? { ...HIDDEN_CENTRE, hidden: false } : centre(spokes.length > 1 ? clearDir(O, spokes) : "n"),
      on("A", rot + 180 - h),
      on("B", rot + 180 + h),
      on("C", rot - h),
      on("D", rot + h),
      ...(o.majorCD ? [on("E", rot + 90)] : []),
    ],
    segments,
    arcs: o.majorCD ? [{ center: "O", from: "C", to: "D", major: true, color: 2 }] : o.arcAB ? [{ center: "O", from: "A", to: "B", color: 1 }] : [],
    marks,
    labels: [...(both ? [{ ...polar(out, rot + 90), text: "O" }] : []), ...(o.arcAB ? [arcNote(rot + 180, o.arcAB)] : []), ...(o.majorCD ? [arcNote(rot + 270, "?")] : [])],
  });
}

/** Diameter AB of circle O (horizontal) and a point C on the circle at `c` degrees. */
function diameterFig(c: number, marks: Mark[], showO = true): Figure {
  return build({
    view: ringView(),
    circles: RING,
    points: [showO ? centre("s") : HIDDEN_CENTRE, on("A", 180, 4, "w"), on("B", 0, 4, "e"), on("C", c)],
    segments: [
      { from: "A", to: "B" },
      { from: "C", to: "A" },
      { from: "C", to: "B" },
    ],
    marks,
  });
}

/** Sector of circle O cut off by an arc of m degrees, centred at the top, with the arc highlighted. */
function sectorFig(m: number, o: { radius?: string; arc?: string; angle?: string }): Figure {
  const A = on("A", 90 - m / 2);
  const B = on("B", 90 + m / 2);
  const labels: DLabel[] = o.arc ? [arcNote(90, o.arc)] : [];
  const angles: DAngle[] = [];
  const marks: Mark[] = [];
  if (o.angle && m === 180) {
    angles.push({ at: "O", from: "A", to: "M" }, { at: "O", from: "M", to: "B" });
    labels.push({ ...polar(0.85, 90), text: o.angle });
  } else if (o.angle && m > 180) angles.push({ at: "O", from: "A", to: "B", reflex: true, label: o.angle });
  else if (o.angle) marks.push({ at: "O", from: "A", to: "B", label: o.angle });
  return build({
    view: ringView(),
    circles: RING,
    points: [centre("s"), A, B, { name: "M", ...polar(4, 90), hidden: true, label: "" }],
    segments: [
      { from: "O", to: "A", label: o.radius },
      { from: "O", to: "B" },
    ],
    // Two halves, so each is a minor arc whatever m is.
    arcs: [
      { center: "O", from: "A", to: "M", color: 2 },
      { center: "O", from: "M", to: "B", color: 2 },
    ],
    angles,
    marks,
    labels,
  });
}

/** Inscribed angle ABC with its intercepted arc AC (`arc` degrees) at the bottom and B on the major arc. */
function inscribedFig(arc: number, o: { angleB?: string; arcAC?: string; centralO?: string; showO?: boolean }): Figure {
  const h = arc / 2;
  const segments: DSegment[] = [
    { from: "B", to: "A" },
    { from: "B", to: "C" },
  ];
  const marks: Mark[] = [];
  if (o.centralO) {
    segments.push({ from: "O", to: "A", dashed: true }, { from: "O", to: "C", dashed: true });
    marks.push({ at: "O", from: "A", to: "C", label: o.centralO, color: 2 });
  }
  if (o.angleB) marks.push({ at: "B", from: "A", to: "C", label: o.angleB });
  const b = 65 + ((arc * 7) % 50);
  const [A, B, C] = [polar(4, 270 - h), polar(4, b), polar(4, 270 + h)];
  const O = { x: 0, y: 0 };
  // Keep O's label off BA and BC, which can pass close to the centre, and off the central angle and its label.
  const lines: [Pt, Pt][] = [[B, A], [B, C], ...(o.centralO ? ([[O, A], [O, C], [O, { x: 0, y: -1.5 }]] as [Pt, Pt][]) : [])];
  return build({
    view: ringView(),
    circles: RING,
    points: [o.showO ? centre(clearDir(O, lines)) : HIDDEN_CENTRE, on("A", 270 - h, 4, h < 45 ? "sw" : undefined), on("C", 270 + h, 4, h < 45 ? "se" : undefined), on("B", b)],
    segments,
    arcs: [{ center: "O", from: "A", to: "C", color: 2 }],
    marks,
    labels: o.arcAC ? [arcNote(270, o.arcAC)] : [],
  });
}

/** Inscribed angles ABD and ACD on the same arc AD (`arc` degrees, at the bottom). */
function sameArcFig(arc: number, angleB: string, angleC: string): Figure {
  const h = arc / 2;
  return build({
    view: ringView(),
    circles: RING,
    points: [HIDDEN_CENTRE, on("A", 270 - h, 4, h < 45 ? "sw" : undefined), on("D", 270 + h, 4, h < 45 ? "se" : undefined), on("B", 55), on("C", 125)],
    segments: [
      { from: "B", to: "A" },
      { from: "B", to: "D" },
      { from: "C", to: "A" },
      { from: "C", to: "D" },
    ],
    arcs: [{ center: "O", from: "A", to: "D", color: 2 }],
    marks: [
      { at: "B", from: "A", to: "D", label: angleB },
      { at: "C", from: "A", to: "D", label: angleC, color: 2 },
    ],
  });
}

const QUAD = ["A", "B", "C", "D"];

/** Quadrilateral ABCD inscribed in a circle, with arcs[i] degrees from vertex i to the next. Angle labels by vertex. */
function quadFig(arcs: number[], start: number, angles: Record<string, string>, arcLabels: (string | undefined)[] = []): Figure {
  const pos = around(QUAD, arcs, start);
  return build({
    view: ringView(),
    circles: RING,
    points: [HIDDEN_CENTRE, ...pos.points],
    polygons: [{ points: QUAD }],
    marks: Object.entries(angles).map(([v, label], k) => {
      const i = QUAD.indexOf(v);
      return { at: v, from: QUAD[(i + 3) % 4]!, to: QUAD[(i + 1) % 4]!, label, color: k === 0 ? 1 : 2 };
    }),
    labels: arcLabels.flatMap((t, i) => (t ? [arcNote(pos.mid(i), t)] : [])),
  });
}

/** Arcs for an inscribed quadrilateral whose angle at vertex i is a degrees, with vertex i at the top. */
function quadArcs(r: Rng, i: number, a: number): { arcs: number[]; start: number } {
  const [e, f] = [r.int(-10, 10), r.int(-10, 10)];
  const arcs = [0, 0, 0, 0];
  // The angle at i is half of the two arcs not touching i.
  arcs[(i + 1) % 4] = a + e;
  arcs[(i + 2) % 4] = a - e;
  arcs[i] = 180 - a + f;
  arcs[(i + 3) % 4] = 180 - a - f;
  let start = 90;
  for (let j = 0; j < i; j++) start -= arcs[j]!;
  return { arcs, start };
}

/**
 * Tangent segment PA to circle O, drawn to scale from the radius and OP, unless P would sit
 * too close to the circle to label: then P is moved out and `toScale` is false.
 */
function tangentFig(rad: number, op: number, o: { oa: string; pa: string; op?: string; np?: string }): { figure: Figure; toScale: boolean } {
  const rho = Math.min(3, (8.5 * rad) / op);
  const toScale = (rho * op) / rad - rho >= 0.9;
  const D = round3(toScale ? (rho * op) / rad : rho + 0.9);
  const view: DiagramSpec["view"] = [-rho - 1.2, D + 1.2, -rho - 1.2, rho + 1.2];
  const points: DPoint[] = [centre("w"), { name: "A", ...polar(rho, Math.acos(rho / D) / RAD), dir: "n" }, { name: "P", x: D, y: 0, dir: "e" }];
  const segments: DSegment[] = [
    { from: "O", to: "A", label: o.oa },
    { from: "P", to: "A", label: o.pa, color: 1 },
  ];
  const labels: DLabel[] = [];
  if (o.np) {
    points.push({ name: "N", x: round3(rho), y: 0, dir: "sw" });
    segments.push({ from: "O", to: "N", dashed: true }, { from: "N", to: "P", label: o.np });
  } else {
    segments.push({ from: "O", to: "P" });
    if (o.op) {
      // Under OP, slid along it if the middle would sit on the circle's edge.
      const scale = ppu(view);
      const half = texWidth(o.op, scale) / 2 + 4 / scale;
      const at = [0.5, 0.42, 0.58, 0.35, 0.65, 0.3, 0.7].find((t) => Math.abs(t * D - rho) > half) ?? 0.5;
      labels.push(sideNote({ x: 0, y: 0 }, { x: D, y: 0 }, o.op, { x: D / 2, y: 1 }, { scale, at }));
    }
  }
  return { toScale, figure: build({ view, circles: [{ center: "O", radius: round3(rho) }], points, segments, labels }) };
}

/** Tangents PA and PB to circle O, with central angle AOB of c degrees. */
function twoTangents(c: number, o: { showO: boolean; pa?: string; pb?: string; angleO?: string; angleP?: string; arc?: string }): Figure {
  const h = c / 2;
  const rho = Math.min(2.6, 7.5 * Math.cos(h * RAD));
  const D = round3(rho / Math.cos(h * RAD));
  const marks: Mark[] = [];
  if (o.angleO) marks.push({ at: "O", from: "A", to: "B", label: o.angleO, color: 2 });
  if (o.angleP) marks.push({ at: "P", from: "A", to: "B", label: o.angleP });
  return build({
    view: [-rho - 1.3, D + 1.3, -rho - 1.2, rho + 1.2],
    circles: [{ center: "O", radius: round3(rho) }],
    points: [o.showO ? centre("w") : HIDDEN_CENTRE, { name: "A", ...polar(rho, h), dir: "n" }, { name: "B", ...polar(rho, -h), dir: "s" }, { name: "P", x: D, y: 0, dir: "e" }],
    segments: [
      { from: "P", to: "A", label: o.pa, color: 1 },
      { from: "P", to: "B", label: o.pb, color: 1 },
      ...(o.showO ? [{ from: "O", to: "A" }, { from: "O", to: "B" }] : []),
    ],
    arcs: o.arc ? [{ center: "O", from: "B", to: "A", color: 2 }] : [],
    marks,
    // Just inside the arc it names: outside, it would share the gap before P with the label of angle P.
    labels: o.arc ? [{ ...polar(rho - 0.4, 0), text: o.arc }] : [],
  });
}

/** Scale and centre a set of points into a box `size` units across. */
function fit(pts: Pt[], size: number) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = size / Math.max(x1 - x0, y1 - y0);
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const map = (p: Pt) => ({ x: round3((p.x - cx) * k), y: round3((p.y - cy) * k) });
  const view: DiagramSpec["view"] = [round3((x0 - cx) * k - 1.4), round3((x1 - cx) * k + 1.4), round3((y0 - cy) * k - 1.4), round3((y1 - cy) * k + 1.4)];
  return { map, k, view };
}

/** Triangle ABC with its incircle touching AB, BC, CA at D, E, F, where AD = p, BE = q, CF = s. To scale. */
function incircleFig(p: number, q: number, s: number): Figure {
  const [c, a, b] = [p + q, q + s, s + p];
  const cx = (c * c + b * b - a * a) / (2 * c);
  const raw = { A: { x: 0, y: 0 }, B: { x: c, y: 0 }, C: { x: cx, y: Math.sqrt(b * b - cx * cx) } };
  const per = a + b + c;
  const I0 = { x: (b * c + c * raw.C.x) / per, y: (c * raw.C.y) / per };
  const along = (u: Pt, v: Pt, t: number) => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t });
  const { map, k, view } = fit([raw.A, raw.B, raw.C], 8);
  const [A, B, C, I] = [map(raw.A), map(raw.B), map(raw.C), map(I0)];
  const [D, E, F] = [map(along(raw.A, raw.B, p / c)), map(along(raw.B, raw.C, q / a)), map(along(raw.A, raw.C, p / b))];
  return build({
    view,
    points: [
      { name: "A", ...A, dir: toward(I, A) },
      { name: "B", ...B, dir: toward(I, B) },
      { name: "C", ...C, dir: toward(I, C) },
      { name: "I", ...I, hidden: true, label: "" },
      // The touch points are labelled inside, so the side lengths can sit outside.
      { name: "D", ...D, dir: toward(D, I) },
      { name: "E", ...E, dir: toward(E, I) },
      { name: "F", ...F, dir: toward(F, I) },
    ],
    circles: [{ center: "I", radius: round3(((c * raw.C.y) / per) * k) }],
    segments: [
      { from: "A", to: "B", label: String(c) },
      { from: "B", to: "C", label: String(a) },
      { from: "C", to: "A", label: String(b) },
      { from: "A", to: "D", color: 2 },
    ],
  });
}

/** Quadrilateral ABCD around a circle, with tangent lengths t[i] from each vertex. To scale. */
function tangentialQuadFig(t: number[], sides: string[]): Figure {
  // Half of each vertex angle is atan(ρ / t), and the four halves add to 180°.
  let [lo, hi] = [0, 100];
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    if (t.reduce((sum, ti) => sum + Math.atan(mid / ti), 0) > Math.PI) hi = mid;
    else lo = mid;
  }
  const rho = (lo + hi) / 2;
  const half = t.map((ti) => Math.atan(rho / ti));
  const raw: Pt[] = [];
  let phi = 135 * RAD;
  for (let i = 0; i < 4; i++) {
    if (i > 0) phi += Math.PI - half[i - 1]! - half[i]!;
    raw.push({ x: (rho / Math.sin(half[i]!)) * Math.cos(phi), y: (rho / Math.sin(half[i]!)) * Math.sin(phi) });
  }
  const { map, k, view } = fit(raw, 8.5);
  const I = map({ x: 0, y: 0 });
  const V = raw.map(map);
  return build({
    view,
    points: [{ name: "I", ...I, hidden: true, label: "" }, ...V.map((v, i) => ({ name: QUAD[i]!, ...v, dir: toward(I, v) }))],
    circles: [{ center: "I", radius: round3(rho * k) }],
    segments: QUAD.map((n, i) => ({ from: n, to: QUAD[(i + 1) % 4]!, label: sides[i], color: i === 3 ? (2 as const) : undefined })),
  });
}

/** Chords AB and CD crossing at E with the given pieces. Lengths are square-rooted when they differ too much to draw. */
function crossingFig(a: number, b: number, c: number, x: number): { figure: Figure; toScale: boolean } {
  const toScale = Math.max(a, b, c, x) / Math.min(a, b, c, x) <= 6;
  // Square roots keep AE · EB = CE · ED, so the four points still lie on a circle.
  const [la, lb, lc, lx] = (toScale ? [a, b, c, x] : [a, b, c, x].map(Math.sqrt)) as [number, number, number, number];
  const w = { x: Math.cos(-12 * RAD), y: Math.sin(-12 * RAD) };
  const u = { x: Math.cos(68 * RAD), y: Math.sin(68 * RAD) };
  const raw = { A: { x: -la * w.x, y: -la * w.y }, B: { x: lb * w.x, y: lb * w.y }, C: { x: -lc * u.x, y: -lc * u.y }, D: { x: lx * u.x, y: lx * u.y } };
  const { A, B, C } = raw;
  const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  const [sa, sb, sc] = [A.x ** 2 + A.y ** 2, B.x ** 2 + B.y ** 2, C.x ** 2 + C.y ** 2];
  const O = { x: (sa * (B.y - C.y) + sb * (C.y - A.y) + sc * (A.y - B.y)) / d, y: (sa * (C.x - B.x) + sb * (A.x - C.x) + sc * (B.x - A.x)) / d };
  const k = 4 / Math.hypot(A.x - O.x, A.y - O.y);
  const map = (p: Pt) => ({ x: round3((p.x - O.x) * k), y: round3((p.y - O.y) * k) });
  const E = map({ x: 0, y: 0 });
  const pts = { A: map(raw.A), B: map(raw.B), C: map(raw.C), D: map(raw.D) };
  // The chords make four corners at E. Each piece is labelled in a different corner (AE below AB, CE right of CD,
  // EB above AB, ED left of CD), so two short pieces never share one; E's own label goes in the corner of the longest piece.
  const down = { x: w.y, y: -w.x };
  const left = { x: -u.y, y: u.x };
  const sides: [Pt, Pt, string][] = [
    [pts.A, down, String(a)],
    [pts.C, { x: -left.x, y: -left.y }, String(c)],
    [pts.B, { x: -down.x, y: -down.y }, String(b)],
    [pts.D, left, "?"],
  ];
  const view = ringView(1.6);
  const scale = ppu(view);
  const labels = sides.map(([p, n, text]) => sideNote(p, E, text, { x: (p.x + E.x) / 2 - n.x, y: (p.y + E.y) / 2 - n.y }, { scale }));
  // Corner k lies between piece k and piece k + 1 going round E: AEC, CEB, BED, DEA.
  const longest = [0, 1, 2, 3].reduce((m, k) => (Math.hypot(sides[k]![0].x - E.x, sides[k]![0].y - E.y) > Math.hypot(sides[m]![0].x - E.x, sides[m]![0].y - E.y) ? k : m), 0);
  const corner = (k: number) => {
    const [p, q] = [sides[k]![0], sides[(k + 1) % 4]![0]];
    const [lp, lq] = [Math.hypot(p.x - E.x, p.y - E.y), Math.hypot(q.x - E.x, q.y - E.y)];
    return Math.atan2((p.y - E.y) / lp + (q.y - E.y) / lq, (p.x - E.x) / lp + (q.x - E.x) / lq) / RAD;
  };
  return {
    toScale,
    figure: build({
      view,
      points: [HIDDEN_CENTRE, ...(["A", "B", "C", "D"] as const).map((n) => ({ name: n, ...pts[n], dir: toward({ x: 0, y: 0 }, pts[n]) })), { name: "E", ...E, dir: outward(corner(longest)) }],
      circles: RING,
      segments: [
        { from: "A", to: "B", color: 1 },
        { from: "C", to: "D", color: 2 },
      ],
      labels,
    }),
  };
}

/** Chord AB of circle O at distance d from the centre, half-length h, radius R. To scale. */
function chordFig(R: number, d: number, h: number, o: { radius?: string; dist?: string; chord?: string }): Figure {
  const k = 4 / R;
  const [dd, hh] = [round3(d * k), round3(h * k)];
  const angA = Math.atan2(-dd, -hh) / RAD;
  const view = ringView(1.6);
  const scale = ppu(view);
  const labels: DLabel[] = o.dist ? [{ x: round3(-0.2 - texWidth(o.dist, scale) / 2), y: round3(-dd / 2), text: o.dist }] : [];
  // The chord's length goes under its middle when the strip between chord and circle has room (a label about
  // 20 px tall plus 5 px either side); otherwise it is written out, AB = …, just below the circle.
  const roomy = (4 - dd) * scale >= 34;
  if (o.chord && !roomy) labels.push({ x: 0, y: round3(-4 - 18 / scale), text: md`AB = {${o.chord}}` });
  return build({
    view,
    circles: RING,
    points: [centre("n"), on("A", angA), on("B", 180 - angA), { name: "M", x: 0, y: -dd, hidden: true, label: "" }],
    segments: [
      { from: "A", to: "B", label: roomy ? o.chord : undefined, color: 1 },
      { from: "O", to: "M", dashed: true },
      { from: "O", to: "B", label: o.radius },
    ],
    angles: [{ at: "M", from: "O", to: "B", right: true }],
    labels,
  });
}

// ── Lesson 1: Arcs and central angles ───────────────────────────────────────

const arcMeasure: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = 5 * r.int(4, 34);
    return {
      prompt: md`$C$ is a point on the major arc of circle $O$. Find $\overgroup{ACB}$ in the figure. ${ARC}`,
      figure: build({
        view: ringView(),
        circles: RING,
        points: [centre("s"), on("A", 90 - a / 2), on("B", 90 + a / 2), on("C", 270)],
        segments: [
          { from: "O", to: "A" },
          { from: "O", to: "B" },
        ],
        arcs: [{ center: "O", from: "A", to: "B", major: true, color: 2 }],
        marks: [{ at: "O", from: "A", to: "B", label: deg(a) }],
        labels: [arcNote(315, "?")],
      }),
      answer: String(360 - a),
      verify: [`x + ${a} = 360`],
      hint: md`The minor arc $\overgroup{AB}$ has the measure of its central angle, and the minor and major arcs together make the whole circle.`,
      solution: [
        { math: md`\overgroup{AB} = \angle AOB = ${a}^\circ`, note: "A minor arc measures the same as its central angle." },
        { math: md`\overgroup{ACB} = 360^\circ - ${a}^\circ = ${360 - a}^\circ`, note: md`The two arcs share only $A$ and $B$ and fill the circle, so by Arc Addition they add to $360^\circ$.` },
      ],
    };
  }
  if (kind === 1) {
    let [a, b, c, d] = [0, 0, 0, 0];
    do {
      [a, b, c] = [5 * r.int(6, 24), 5 * r.int(6, 24), 5 * r.int(6, 24)];
      d = 360 - a - b - c;
    } while (d < 30 || d > 170);
    const pos = around(QUAD, [a, b, c, d], 90 + d / 2);
    return {
      prompt: md`Points $A$, $B$, $C$ and $D$ lie on circle $O$. Find $\overgroup{DA}$, the arc from $D$ back to $A$, in the figure. ${ARC}`,
      figure: build({
        view: ringView(),
        circles: RING,
        points: [centre("s"), ...pos.points],
        arcs: [{ center: "O", from: "D", to: "A", color: 2 }],
        labels: [arcNote(pos.mid(0), deg(a)), arcNote(pos.mid(1), deg(b)), arcNote(pos.mid(2), deg(c)), arcNote(pos.mid(3), "?")],
      }),
      answer: String(d),
      verify: [`${a} + ${b} + ${c} + x = 360`],
      hint: "Going once around the circle through all four arcs covers 360 degrees.",
      solution: [
        { math: md`\overgroup{AB} + \overgroup{BC} + \overgroup{CD} + \overgroup{DA} = 360^\circ`, note: "The four arcs meet only at their endpoints and fill the circle (Arc Addition Postulate)." },
        { math: md`${a} + ${b} + ${c} + \overgroup{DA} = 360`, note: "Substitute." },
        { math: md`\overgroup{DA} = 360 - ${a + b + c} = ${d}^\circ`, note: md`Subtract ${a + b + c} from both sides.` },
      ],
    };
  }
  if (kind === 2) {
    const a = 5 * r.int(4, 32);
    return {
      prompt: md`$\overline{AB}$ is a diameter of circle $O$. Find the minor arc $\overgroup{BC}$ in the figure. ${ARC}`,
      figure: build({
        view: ringView(),
        circles: RING,
        points: [centre("s"), on("A", 180, 4, "w"), on("B", 0, 4, "e"), on("C", 180 - a)],
        segments: [
          { from: "A", to: "B" },
          { from: "O", to: "C" },
        ],
        arcs: [{ center: "O", from: "B", to: "C", color: 2 }],
        marks: [{ at: "O", from: "A", to: "C", label: deg(a) }],
        labels: [arcNote((180 - a) / 2, "?")],
      }),
      answer: String(180 - a),
      verify: [`${a} + x = 180`],
      hint: md`$\angle AOC$ and $\angle COB$ sit side by side along the straight diameter.`,
      solution: [
        { math: md`\angle AOC + \angle COB = 180^\circ`, note: md`$O$ is between $A$ and $B$ on the diameter, so the two angles form a linear pair (Linear Pair Postulate).` },
        { math: md`\angle COB = 180^\circ - ${a}^\circ = ${180 - a}^\circ`, note: "Subtract." },
        { math: md`\overgroup{BC} = ${180 - a}^\circ`, note: "A minor arc measures the same as its central angle." },
      ],
    };
  }
  const a = 5 * r.int(6, 32);
  const askAngle = r.next() < 0.5;
  return {
    prompt: askAngle
      ? md`In circle $O$, chords $\overline{AB}$ and $\overline{CD}$ are congruent. Find $\angle COD$ in the figure. ${DEG}`
      : md`In circle $O$, chords $\overline{AB}$ and $\overline{CD}$ are congruent. Find the major arc $\overgroup{CED}$ in the figure. ${ARC}`,
    // In the major-arc case the given measure is the central angle: a label for the minor arc AB would sit on the highlighted major arc.
    figure: chordsFig(a, askAngle ? { arcAB: deg(a), angleCOD: "?" } : { angleAOB: deg(a), majorCD: true }),
    answer: String(askAngle ? a : 360 - a),
    // Congruent chords cut off equal minor arcs; the major arc is the rest of the circle.
    verify: [askAngle ? `x = ${a}` : `x + ${a} = 360`],
    hint: "Congruent chords in the same circle have congruent central angles. Think of the triangles the chords make with the center.",
    solution: [
      { math: md`\triangle AOB \cong \triangle COD`, note: md`SSS: $OA = OC$ and $OB = OD$ (radii), and $AB = CD$ (given).` },
      { math: md`\angle COD = \angle AOB = ${a}^\circ`, note: md`CPCTC, and $\angle AOB = \overgroup{AB}$.` },
      ...(askAngle ? [] : [{ math: md`\overgroup{CED} = 360^\circ - ${a}^\circ = ${360 - a}^\circ`, note: md`The minor arc $\overgroup{CD}$ is ${a}°, and the major arc is the rest of the circle.` }]),
    ],
  };
};

const ARC_ANGLES = [30, 36, 40, 45, 60, 72, 90, 120, 135, 150, 180, 210, 240, 270, 300];

const arcLength: Generator = (r) => {
  const kind = r.int(0, 4);
  const m = r.pick(ARC_ANGLES);
  let rad = r.int(2, 12);
  // Keep the length a whole or half multiple of pi: m·rad/180 has denominator 1 or 2.
  while ((m * rad) % 90 !== 0) rad = r.int(2, 12);
  const L = piTex(m * rad, 180);
  const Ltext = piText(m * rad, 180);
  const formula: Step = { math: md`L = \frac{m}{360} \cdot 2\pi r`, note: "An arc of m degrees is m/360 of the whole circumference." };
  if (kind === 0 || kind === 1) {
    const useDiameter = kind === 1;
    return {
      prompt: useDiameter
        ? md`The circle has diameter ${2 * rad}. Find the length of the highlighted arc. ${PI_FORM}`
        : md`Find the length of the highlighted arc. ${PI_FORM}`,
      figure: sectorFig(m, { radius: useDiameter ? undefined : String(rad), arc: "?", angle: deg(m) }),
      answer: Ltext,
      verify: [`x = ${m}/360 * 2*pi*${rad}`],
      hint: useDiameter ? md`The radius is half the diameter. Then the arc is $\frac{${m}}{360}$ of the circumference $2\pi r$.` : md`The arc is $\frac{${m}}{360}$ of the whole circumference, $2\pi r$.`,
      solution: [
        ...(useDiameter ? [{ math: md`r = \frac{${2 * rad}}{2} = ${rad}`, note: "A diameter is two radii." }] : []),
        formula,
        { math: md`L = ${fracTex(m, 360)} \cdot ${2 * rad}\pi`, note: md`$\frac{${m}}{360}$ reduces to $${fracTex(m, 360)}$, and $2\pi \cdot ${rad} = ${2 * rad}\pi$.` },
        { math: md`L = ${L}`, note: "Multiply." },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`Find the measure of the highlighted arc. ${ARC}`,
      figure: sectorFig(m, { radius: String(rad), arc: md`L = ${L}`, angle: "?" }),
      answer: String(m),
      verify: [`${Ltext} = x/360 * 2*pi*${rad}`],
      hint: md`Find what fraction of the circumference $2\pi \cdot ${rad}$ the arc is. That fraction of $360^\circ$ is its measure.`,
      solution: [
        formula,
        { math: md`${L} = \frac{m}{360} \cdot ${2 * rad}\pi`, note: "Substitute the length and the radius." },
        { math: md`\frac{m}{360} = ${fracTex(m, 360)}`, note: md`Divide both sides by $${2 * rad}\pi$.` },
        { math: md`m = ${m}^\circ`, note: "Multiply both sides by 360." },
      ],
    };
  }
  if (kind === 3) {
    return {
      prompt: md`Find the radius $r$ of the circle.`,
      figure: sectorFig(m, { radius: "r", arc: md`L = ${L}`, angle: deg(m) }),
      answer: String(rad),
      verify: [`${Ltext} = ${m}/360 * 2*pi*r`],
      hint: md`The arc is $\frac{${m}}{360}$ of the circumference. Write $L = \frac{m}{360} \cdot 2\pi r$ and solve for $r$.`,
      solution: [
        formula,
        { math: md`${L} = ${fracTex(m, 360)} \cdot 2\pi r`, note: "Substitute, and reduce the fraction." },
        { math: md`${L} = ${piTex(m, 180)}\, r`, note: md`$${fracTex(m, 360)} \cdot 2\pi = ${piTex(m, 180)}$.` },
        { math: md`r = ${rad}`, note: md`Divide both sides by $${piTex(m, 180)}$.` },
      ],
    };
  }
  return {
    prompt: md`Find the circumference of the circle. ${PI_FORM}`,
    figure: sectorFig(m, { arc: md`L = ${L}`, angle: deg(m) }),
    answer: piText(2 * rad),
    verify: [`${Ltext} = ${m}/360 * x`],
    hint: md`The arc is $\frac{${m}}{360}$ of the circumference, so the circumference is $\frac{360}{${m}}$ times the arc.`,
    solution: [
      { math: md`${L} = ${fracTex(m, 360)} \cdot C`, note: md`The arc is $${fracTex(m, 360)}$ of the whole way around.` },
      { math: md`C = ${fracTex(360, m)} \cdot ${L} = ${piTex(2 * rad)}`, note: md`Multiply both sides by the reciprocal, $${fracTex(360, m)}$.` },
    ],
  };
};

const centralAngleAlgebra: Generator = (r) => {
  const kind = r.int(0, 2);
  let x = r.int(3, 14);
  if (kind === 0) {
    let [a, b, c, d, p, q] = [0, 0, 0, 0, 0, 0];
    do {
      x = r.int(3, 14);
      [a, c, b] = [r.int(2, 7), r.int(2, 7), r.int(-15, 20)];
      p = a * x + b;
      q = 180 - p;
      d = q - c * x;
    } while (p < 25 || q < 25 || a === c || d < -30 || d > 40);
    return {
      prompt: md`$\overline{AB}$ is a diameter of circle $O$. Find $x$ in the figure.`,
      figure: build({
        view: ringView(),
        circles: RING,
        points: [centre("s"), on("A", 180, 4, "w"), on("B", 0, 4, "e"), on("C", 180 - p)],
        segments: [
          { from: "A", to: "B" },
          { from: "O", to: "C" },
        ],
        marks: [
          { at: "O", from: "A", to: "C", label: degOf(lin(a, b)) },
          { at: "O", from: "C", to: "B", label: degOf(lin(c, d)), color: 2 },
        ],
      }),
      answer: String(x),
      verify: [`(${lin(a, b)}) + (${lin(c, d)}) = 180`],
      hint: md`The two angles sit along the straight diameter, so they form a linear pair. Combine like terms, then solve.`,
      solution: [
        { math: md`(${lin(a, b)}) + (${lin(c, d)}) = 180`, note: "A linear pair adds to 180 degrees." },
        { math: md`${lin(a + c, b + d)} = 180`, note: "Combine like terms." },
        { math: md`${a + c}x = ${180 - b - d}`, note: b + d === 0 ? "Nothing to move." : md`${b + d > 0 ? "Subtract" : "Add"} ${Math.abs(b + d)} on both sides.` },
        { math: md`x = ${x}`, note: md`Divide by ${a + c}.` },
        { math: md`\angle AOC = ${p}^\circ, \quad \angle COB = ${q}^\circ`, note: md`Check: $${p} + ${q} = 180$.` },
      ],
    };
  }
  if (kind === 1) {
    let [a, b, c, d, p, q, g] = [0, 0, 0, 0, 0, 0, 0];
    do {
      x = r.int(5, 14);
      [a, c, b, d] = [r.int(3, 9), r.int(3, 9), r.int(-10, 30), r.int(-10, 30)];
      p = a * x + b;
      q = c * x + d;
      g = 360 - p - q;
    } while (p < 30 || q < 30 || g < 30 || p > 170 || q > 170 || g > 170);
    const pos = around(["A", "B", "C"], [p, q, g], 270 + g / 2);
    const O = { x: 0, y: 0 };
    const spokes = pos.points.map((v): [Pt, Pt] => [O, { x: Number(v.x), y: Number(v.y) }]);
    return {
      prompt: md`Radii $\overline{OA}$, $\overline{OB}$ and $\overline{OC}$ split circle $O$ into three arcs. Find $x$ in the figure.`,
      figure: {
        kind: "diagram",
        view: ringView(2.4),
        circles: RING,
        points: [centre(clearDir(O, spokes)), ...pos.points],
        segments: [
          { from: "O", to: "A" },
          { from: "O", to: "B" },
          { from: "O", to: "C" },
        ],
        labels: [arcNote(pos.mid(0), degOf(lin(a, b))), arcNote(pos.mid(1), degOf(lin(c, d))), arcNote(pos.mid(2), deg(g))],
      },
      answer: String(x),
      verify: [`(${lin(a, b)}) + (${lin(c, d)}) + ${g} = 360`],
      hint: "The three arcs go once around the circle, so they add to 360 degrees.",
      solution: [
        { math: md`(${lin(a, b)}) + (${lin(c, d)}) + ${g} = 360`, note: "Arc Addition: the three arcs fill the circle." },
        { math: md`${lin(a + c, b + d + g)} = 360`, note: "Combine like terms." },
        { math: md`${a + c}x = ${360 - b - d - g}`, note: md`Subtract ${b + d + g} from both sides.` },
        { math: md`x = ${x}`, note: md`Divide by ${a + c}.` },
        { math: md`${p}^\circ + ${q}^\circ + ${g}^\circ = 360^\circ`, note: "Check." },
      ],
    };
  }
  let [a, b, c, d, p] = [0, 0, 0, 0, 0];
  do {
    [a, c] = [r.int(2, 9), r.int(2, 9)];
    p = r.int(30, 140); // wider, and the gaps between the four radii get too narrow for O's label
    b = p - a * x;
    d = p - c * x;
  } while (a === c || Math.abs(b) > 60 || Math.abs(d) > 60 || b === 0 || d === 0);
  return {
    prompt: md`Chords $\overline{AB}$ and $\overline{CD}$ of circle $O$ are congruent. Find $x$ in the figure.`,
    figure: chordsFig(p, { angleAOB: degOf(lin(a, b)), angleCOD: degOf(lin(c, d)) }),
    answer: String(x),
    verify: [`${lin(a, b)} = ${lin(c, d)}`],
    hint: "Congruent chords have congruent central angles (SSS on the two triangles with the center), so the expressions are equal. Collect the x-terms on one side.",
    solution: [
      { math: md`${lin(a, b)} = ${lin(c, d)}`, note: "Congruent chords, congruent central angles." },
      { math: md`${lin(a - c, 0)} = ${d - b}`, note: md`Subtract $${lin(c, 0)}$ and ${b > 0 ? "subtract" : "add"} ${Math.abs(b)} on both sides.` },
      { math: md`x = ${x}`, note: md`Divide by ${a - c}.` },
      { math: md`\angle AOB = \angle COD = ${p}^\circ`, note: "Check: both expressions give the same angle." },
    ],
  };
};

// ── Lesson 2: Inscribed angles ──────────────────────────────────────────────

const inscribedBasics: Generator = (r) => {
  const kind = r.int(0, 5);
  const k = r.int(12, 84);
  if (kind === 0) {
    return {
      prompt: md`$\angle ABC$ is inscribed in circle $O$. Find $\angle ABC$ in the figure. ${DEG}`,
      figure: inscribedFig(2 * k, { angleB: "?", arcAC: deg(2 * k), showO: true }),
      answer: String(k),
      verify: [`2x = ${2 * k}`],
      hint: "An inscribed angle is half of the arc it intercepts.",
      solution: [
        { math: md`\angle ABC = \tfrac{1}{2}\overgroup{AC}`, note: "Inscribed Angle Theorem." },
        { math: md`\angle ABC = \tfrac{1}{2}(${2 * k}^\circ) = ${k}^\circ`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`$\angle ABC$ is inscribed in circle $O$. Find the arc it intercepts, $\overgroup{AC}$, in the figure. ${ARC}`,
      figure: inscribedFig(2 * k, { angleB: deg(k), arcAC: "?", showO: true }),
      answer: String(2 * k),
      verify: [`x = 2*${k}`],
      hint: "The arc is twice the inscribed angle.",
      solution: [
        { math: md`\angle ABC = \tfrac{1}{2}\overgroup{AC}`, note: "Inscribed Angle Theorem." },
        { math: md`\overgroup{AC} = 2(${k}^\circ) = ${2 * k}^\circ`, note: "Multiply both sides by 2." },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`$B$ is a point on the major arc of circle $O$. Find the inscribed angle $\angle ABC$ in the figure. ${DEG}`,
      figure: inscribedFig(2 * k, { centralO: deg(2 * k), angleB: "?", showO: true }),
      answer: String(k),
      verify: [`2x = ${2 * k}`],
      hint: md`Both angles stand on the same arc $\overgroup{AC}$. The central angle equals the arc, and the inscribed angle is half of it.`,
      solution: [
        { math: md`\overgroup{AC} = \angle AOC = ${2 * k}^\circ`, note: "An arc has the measure of its central angle." },
        { math: md`\angle ABC = \tfrac{1}{2}\overgroup{AC} = ${k}^\circ`, note: md`Inscribed Angle Theorem. $B$ is on the major arc, so $\angle ABC$ intercepts the minor arc $\overgroup{AC}$.` },
      ],
    };
  }
  if (kind === 3) {
    return {
      prompt: md`Points $A$, $B$, $C$ and $D$ lie on a circle. Find $\angle ACD$ in the figure. ${DEG}`,
      figure: sameArcFig(2 * k, deg(k), "?"),
      answer: String(k),
      // Both angles are half of the arc AD.
      verify: [`2x = 2*${k}`],
      hint: "Two inscribed angles that intercept the same arc are each half of that arc.",
      solution: [
        { math: md`\overgroup{AD} = 2 \cdot ${k}^\circ = ${2 * k}^\circ`, note: md`$\angle ABD$ is half its arc.` },
        { math: md`\angle ACD = \tfrac{1}{2}\overgroup{AD} = ${k}^\circ`, note: "Same arc, same half: inscribed angles on the same arc are congruent." },
      ],
    };
  }
  if (kind === 4) {
    const t = r.int(15, 75);
    return {
      prompt: md`$\overline{AB}$ is a diameter of circle $O$. Find $\angle CBA$ in the figure. ${DEG}`,
      figure: diameterFig(2 * t, [
        { at: "A", from: "B", to: "C", label: deg(t) },
        { at: "B", from: "C", to: "A", label: "?", color: 2 },
      ]),
      answer: String(90 - t),
      verify: [`${t} + 90 + x = 180`],
      hint: md`What does Thales' Theorem say about $\angle ACB$? Then use the triangle's angle sum.`,
      solution: [
        { math: md`\angle ACB = 90^\circ`, note: md`Thales: $\angle ACB$ intercepts a semicircle, $180^\circ$, so it is half of that.` },
        { math: md`\angle CBA = 180^\circ - 90^\circ - ${t}^\circ = ${90 - t}^\circ`, note: "Triangle Angle Sum Theorem." },
      ],
    };
  }
  let [p, q, s] = [0, 0, 0];
  do {
    p = 2 * r.int(20, 80);
    q = 2 * r.int(20, 80);
    s = 360 - p - q;
  } while (s < 40 || s > 170);
  const pos = around(["A", "B", "C"], [p, q, s], 270 - p);
  return {
    prompt: md`Triangle $ABC$ is inscribed in a circle. Find $\angle ABC$ in the figure. ${DEG}`,
    figure: build({
      view: ringView(),
      circles: RING,
      points: [HIDDEN_CENTRE, ...pos.points],
      polygons: [{ points: ["A", "B", "C"] }],
      marks: [{ at: "B", from: "A", to: "C", label: "?" }],
      labels: [arcNote(pos.mid(0), deg(p)), arcNote(pos.mid(1), deg(q))],
    }),
    answer: String(s / 2),
    verify: [`2x + ${p} + ${q} = 360`],
    hint: md`$\angle ABC$ intercepts the third arc, from $C$ to $A$. The three arcs go once around the circle.`,
    solution: [
      { math: md`\overgroup{CA} = 360^\circ - ${p}^\circ - ${q}^\circ = ${s}^\circ`, note: "Arc Addition: the three arcs fill the circle." },
      { math: md`\angle ABC = \tfrac{1}{2}\overgroup{CA} = ${s / 2}^\circ`, note: md`Inscribed Angle Theorem: the angle at $B$ opens onto the arc between $C$ and $A$.` },
    ],
  };
};

const VERTEX_PAIRS: [string, string][] = [
  ["A", "C"],
  ["B", "D"],
  ["C", "A"],
  ["D", "B"],
];

const inscribedQuadrilateral: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.int(35, 145);
    const [u, v] = r.pick(VERTEX_PAIRS);
    const { arcs, start } = quadArcs(r, QUAD.indexOf(u), a);
    return {
      prompt: md`Quadrilateral $ABCD$ is inscribed in a circle. Find $\angle ${v}$ in the figure. ${DEG}`,
      figure: quadFig(arcs, start, { [u]: deg(a), [v]: "?" }),
      answer: String(180 - a),
      verify: [`${a} + x = 180`],
      hint: md`$\angle ${u}$ and $\angle ${v}$ are opposite angles. Their two intercepted arcs make up the whole circle.`,
      solution: [
        { math: md`\angle ${u} + \angle ${v} = 180^\circ`, note: "Opposite angles of an inscribed quadrilateral are supplementary: their arcs add to 360, and each angle is half its arc." },
        { math: md`\angle ${v} = 180^\circ - ${a}^\circ = ${180 - a}^\circ`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    let [ab, bc, cd, da] = [0, 0, 0, 0];
    do {
      [ab, bc, cd] = [2 * r.int(20, 70), 2 * r.int(20, 70), 2 * r.int(20, 70)];
      da = 360 - ab - bc - cd;
    } while (da < 40 || da > 140);
    const v = r.pick(["A", "B", "C", "D"] as const);
    const info = {
      A: { name: "DAB", arc: "BCD", parts: [bc, cd], labels: ["BC", "CD"] },
      B: { name: "ABC", arc: "CDA", parts: [cd, da], labels: ["CD", "DA"] },
      C: { name: "BCD", arc: "DAB", parts: [da, ab], labels: ["DA", "AB"] },
      D: { name: "CDA", arc: "ABC", parts: [ab, bc], labels: ["AB", "BC"] },
    }[v];
    // The angle is half the two arcs not touching its vertex; DA is the rest of the circle.
    const relation = {
      A: `2x = ${bc} + ${cd}`,
      B: `2x = ${cd} + (360 - ${ab} - ${bc} - ${cd})`,
      C: `2x = (360 - ${ab} - ${bc} - ${cd}) + ${ab}`,
      D: `2x = ${ab} + ${bc}`,
    }[v];
    const arc = info.parts[0]! + info.parts[1]!;
    const steps: Step[] = [];
    if (v === "B" || v === "C") steps.push({ math: md`\overgroup{DA} = 360^\circ - ${ab}^\circ - ${bc}^\circ - ${cd}^\circ = ${da}^\circ`, note: "The four arcs fill the circle." });
    steps.push(
      { math: md`\overgroup{${info.arc}} = \overgroup{${info.labels[0]}} + \overgroup{${info.labels[1]}} = ${info.parts[0]}^\circ + ${info.parts[1]}^\circ = ${arc}^\circ`, note: md`$\angle ${info.name}$ opens onto the arc that doesn't contain $${v}$. Arc Addition.` },
      { math: md`\angle ${info.name} = \tfrac{1}{2}(${arc}^\circ) = ${arc / 2}^\circ`, note: "Inscribed Angle Theorem." },
    );
    return {
      prompt: md`Points $A$, $B$, $C$ and $D$ lie on a circle in that order. Find $\angle ${info.name}$ in the figure. ${DEG}`,
      figure: quadFig([ab, bc, cd, da], 90 + da / 2, { [v]: "?" }, [deg(ab), deg(bc), deg(cd)]),
      answer: String(arc / 2),
      verify: [relation],
      hint: md`An inscribed angle is half the arc between its sides, the arc on the far side from its vertex.`,
      solution: steps,
    };
  }
  const right = "a rectangle";
  return {
    prompt: "A parallelogram is inscribed in a circle. What kind of parallelogram must it be?",
    choices: shuffled(r, [right, "a square", "a rhombus", "it could be any parallelogram"]),
    accept: [right],
    hint: "A parallelogram's opposite angles are congruent. An inscribed quadrilateral's opposite angles are supplementary. What angle is both?",
    solution: [
      { math: md`\angle A = \angle C`, note: "Opposite angles of a parallelogram are congruent (Unit 6)." },
      { math: md`\angle A + \angle C = 180^\circ`, note: "Opposite angles of an inscribed quadrilateral are supplementary." },
      { math: md`2\angle A = 180^\circ \;\Rightarrow\; \angle A = 90^\circ`, note: "Substitute. The same works for B and D, so every angle is right: it must be a rectangle. (A square is a rectangle too.)" },
    ],
  };
};

const inscribedAlgebra: Generator = (r) => {
  const kind = r.int(0, 3);
  let x = r.int(3, 12);
  if (kind === 0) {
    let [a, b, c, d, p] = [0, 0, 0, 0, 0];
    // The angle is at least 36°: a narrower one can't hold a label as wide as (7x - 19)° between its sides.
    do {
      x = r.int(3, 12);
      [a, c, b] = [r.int(2, 6), r.int(2, 9), r.int(-10, 20)];
      p = a * x + b;
      d = 2 * p - c * x;
    } while (p < 36 || p > 85 || c === 2 * a || Math.abs(d) > 60 || b === 0);
    return {
      prompt: md`The inscribed angle $\angle ABC$ intercepts $\overgroup{AC}$. Find $x$ in the figure.`,
      figure: inscribedFig(2 * p, { angleB: degOf(lin(a, b)), arcAC: degOf(lin(c, d)) }),
      answer: String(x),
      verify: [`2(${lin(a, b)}) = ${lin(c, d)}`],
      hint: "An intercepted arc is twice its inscribed angle, so double the angle and set it equal to the arc. Distribute, then collect the x-terms.",
      solution: [
        { math: md`2(${lin(a, b)}) = ${lin(c, d)}`, note: "Inscribed Angle Theorem, written as arc = 2 · angle." },
        { math: md`${lin(2 * a, 2 * b)} = ${lin(c, d)}`, note: "Distribute." },
        { math: md`${lin(2 * a - c, 0)} = ${d - 2 * b}`, note: "Collect the x-terms on the left and the numbers on the right." },
        { math: md`x = ${x}`, note: md`Divide by ${2 * a - c}.` },
        { math: md`\angle ABC = ${p}^\circ, \quad \overgroup{AC} = ${2 * p}^\circ`, note: "Check: the arc is twice the angle." },
      ],
    };
  }
  if (kind === 1) {
    let [a, b, c, d, p] = [0, 0, 0, 0, 0];
    do {
      x = r.int(3, 12);
      [a, c] = [r.int(2, 8), r.int(2, 8)];
      p = r.int(36, 80); // narrower angles can't hold their expression labels
      b = p - a * x;
      d = p - c * x;
    } while (a === c || Math.abs(b) > 50 || Math.abs(d) > 50 || b === 0 || d === 0);
    return {
      prompt: md`The inscribed angles $\angle ABD$ and $\angle ACD$ intercept the same arc, $\overgroup{AD}$. Find $x$ in the figure.`,
      figure: sameArcFig(2 * p, degOf(lin(a, b)), degOf(lin(c, d))),
      answer: String(x),
      verify: [`${lin(a, b)} = ${lin(c, d)}`],
      hint: "Inscribed angles on the same arc are congruent, so the two expressions are equal.",
      solution: [
        { math: md`${lin(a, b)} = ${lin(c, d)}`, note: "Both are half of the same arc." },
        { math: md`${lin(a - c, 0)} = ${d - b}`, note: "Collect the x-terms on the left and the numbers on the right." },
        { math: md`x = ${x}`, note: md`Divide by ${a - c}.` },
        { math: md`\angle ABD = \angle ACD = ${p}^\circ`, note: "Check." },
      ],
    };
  }
  if (kind === 2) {
    let [a, b] = [0, 0];
    do {
      x = r.int(3, 12);
      a = r.int(2, 9);
      b = 90 - a * x;
    } while (Math.abs(b) > 60 || b === 0);
    return {
      prompt: md`$\overline{AB}$ is a diameter of the circle. Find $x$ in the figure.`,
      figure: diameterFig(30 + ((a * 37 + x * 53) % 120), [{ at: "C", from: "A", to: "B", label: degOf(lin(a, b)) }], false),
      answer: String(x),
      verify: [`${lin(a, b)} = 90`],
      hint: md`Thales' Theorem: an angle inscribed in a semicircle is a right angle.`,
      solution: [
        { math: md`${lin(a, b)} = 90`, note: md`$\angle ACB$ intercepts a semicircle, so it is $\frac{1}{2}(180^\circ) = 90^\circ$.` },
        { math: md`${a}x = ${90 - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides.` },
        { math: md`x = ${x}`, note: md`Divide by ${a}.` },
      ],
    };
  }
  let [a, b, c, d, p, q] = [0, 0, 0, 0, 0, 0];
  do {
    x = r.int(3, 12);
    [a, c, b] = [r.int(2, 7), r.int(2, 7), r.int(-15, 25)];
    p = a * x + b;
    q = 180 - p;
    d = q - c * x;
  } while (p < 35 || q < 35 || Math.abs(d) > 50 || b === 0 || d === 0);
  const { arcs, start } = quadArcs(r, 0, p);
  return {
    prompt: md`Quadrilateral $ABCD$ is inscribed in a circle. Find $x$ in the figure.`,
    figure: quadFig(arcs, start, { A: degOf(lin(a, b)), C: degOf(lin(c, d)) }),
    answer: String(x),
    verify: [`(${lin(a, b)}) + (${lin(c, d)}) = 180`],
    hint: "Opposite angles of an inscribed quadrilateral are supplementary.",
    solution: [
      { math: md`(${lin(a, b)}) + (${lin(c, d)}) = 180`, note: md`$\angle A$ and $\angle C$ are opposite, so they add to $180^\circ$.` },
      { math: md`${lin(a + c, b + d)} = 180`, note: "Combine like terms." },
      { math: md`${a + c}x = ${180 - b - d}`, note: b + d === 0 ? "Nothing to move." : md`${b + d > 0 ? "Subtract" : "Add"} ${Math.abs(b + d)} on both sides.` },
      { math: md`x = ${x}`, note: md`Divide by ${a + c}. Check: $${p}^\circ + ${q}^\circ = 180^\circ$.` },
    ],
  };
};

// ── Lesson 3: Tangents and chords ───────────────────────────────────────────

const tangentRadius: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let rad: number, t2: number, op: number;
    if (r.next() < 0.6) {
      const [p, q, h] = r.pick(TRIPLES.slice(0, 4));
      const k = h <= 13 ? r.pick([1, 1, 2]) : 1;
      [rad, op] = r.next() < 0.5 ? [p * k, h * k] : [q * k, h * k];
      t2 = op * op - rad * rad;
    } else {
      rad = r.int(2, 9);
      op = rad + r.int(1, 6);
      t2 = op * op - rad * rad;
    }
    const t = root(t2);
    const fig = tangentFig(rad, op, { oa: String(rad), op: String(op), pa: "?" });
    return {
      prompt: md`$\overline{PA}$ is tangent to circle $O$ at $A$. Find $PA$ in the figure.${fig.toScale ? "" : " (The figure is not drawn to scale.)"} ${EXACT}`,
      figure: fig.figure,
      answer: t.text,
      simplified: true,
      verify: [`x^2 + ${rad}^2 = ${op}^2`],
      hint: md`Draw the radius $\overline{OA}$. What angle does it make with the tangent? Then $\overline{OP}$ is the hypotenuse of a right triangle.`,
      solution: [
        { math: md`\angle OAP = 90^\circ`, note: "A tangent is perpendicular to the radius at the point of tangency." },
        { math: md`PA^2 + ${rad}^2 = ${op}^2`, note: md`Pythagorean Theorem in right triangle $OAP$, with hypotenuse $\overline{OP}$.` },
        { math: md`PA^2 = ${op * op} - ${rad * rad} = ${t2}`, note: "" },
        { math: md`PA = ${t.tex}`, note: Number.isInteger(Math.sqrt(t2)) ? "Take the positive square root: a length is positive." : md`Take the positive square root and simplify.` },
      ],
    };
  }
  if (kind === 1) {
    const [p, q, h] = r.pick(TRIPLES.slice(0, 4));
    const k = h <= 5 ? r.int(1, 3) : 1;
    const [rad, t] = r.next() < 0.5 ? [p * k, q * k] : [q * k, p * k];
    const d = h * k - rad;
    const fig = tangentFig(rad, rad + d, { oa: "r", pa: String(t), np: String(d) });
    return {
      prompt: md`$\overline{PA}$ is tangent to circle $O$ at $A$, and $N$ is the point of the circle nearest $P$. Find the radius $r$.${fig.toScale ? "" : " (The figure is not drawn to scale.)"}`,
      figure: fig.figure,
      answer: String(rad),
      verify: [`r^2 + ${t}^2 = (r + ${d})^2`],
      hint: md`$\angle OAP = 90^\circ$ and $OP = r + ${d}$, so the Pythagorean Theorem gives an equation in $r$. Expand it: the $r^2$ terms cancel.`,
      solution: [
        { math: md`r^2 + ${t * t} = r^2 + ${2 * d}r + ${d * d}`, note: md`The nearest point lies on $\overline{OP}$ (Triangle Inequality, as in the example), so $OP = r + ${d}$. With $\angle OAP = 90^\circ$, Pythagoras gives $r^2 + ${t}^2 = (r + ${d})^2$. Expand the right side.` },
        { math: md`${t * t} = ${2 * d}r + ${d * d}`, note: md`Subtract $r^2$ from both sides.` },
        { math: md`${t * t - d * d} = ${2 * d}r`, note: md`Subtract ${d * d}.` },
        { math: md`r = ${rad}`, note: md`Divide by ${2 * d}. Check: $${rad}^2 + ${t}^2 = ${rad * rad + t * t} = ${rad + d}^2$.` },
      ],
    };
  }
  // AOB from 90° up: below that P sits so close to the circle that the label of angle P can't fit between them.
  const c = 5 * r.int(18, 32);
  const askAngle = r.next() < 0.5;
  const quad: Step = {
    math: md`\angle AOB + 90^\circ + \angle APB + 90^\circ = 360^\circ`,
    note: md`$OAPB$ is a quadrilateral, so its angles add to $(4 - 2) \cdot 180^\circ = 360^\circ$. The angles at $A$ and $B$ are right: each tangent is perpendicular to its radius.`,
  };
  return askAngle
    ? {
        prompt: md`$\overline{PA}$ and $\overline{PB}$ are tangent to circle $O$ at $A$ and $B$. Find $\angle APB$ in the figure. ${DEG}`,
        figure: twoTangents(c, { showO: true, angleO: deg(c), angleP: "?" }),
        answer: String(180 - c),
        verify: [`${c} + 90 + x + 90 = 360`],
        hint: md`Look at quadrilateral $OAPB$. Two of its angles are right angles.`,
        solution: [quad, { math: md`\angle APB = 180^\circ - ${c}^\circ = ${180 - c}^\circ`, note: "Subtract the known angles." }],
      }
    : {
        prompt: md`$\overline{PA}$ and $\overline{PB}$ are tangent to circle $O$ at $A$ and $B$. Find the minor arc $\overgroup{AB}$ in the figure. ${ARC}`,
        figure: twoTangents(c, { showO: true, angleP: deg(180 - c), arc: "?" }),
        answer: String(c),
        verify: [`x + 90 + ${180 - c} + 90 = 360`],
        hint: md`Look at quadrilateral $OAPB$. Two of its angles are right angles, and $\angle AOB$ is the central angle of $\overgroup{AB}$.`,
        solution: [
          quad,
          { math: md`\angle AOB = 180^\circ - ${180 - c}^\circ = ${c}^\circ`, note: "Subtract the known angles." },
          { math: md`\overgroup{AB} = ${c}^\circ`, note: "An arc has the measure of its central angle." },
        ],
      };
};

const tangentSegments: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind <= 1) {
    const x = r.int(2, 12);
    let [a, b, c, d, p] = [0, 0, 0, 0, 0];
    do {
      [a, c] = [r.int(2, 9), r.int(2, 9)];
      p = r.int(8, 60);
      b = p - a * x;
      d = p - c * x;
    } while (a === c || b === 0 || d === 0 || Math.abs(b) > 40 || Math.abs(d) > 40);
    return {
      prompt: md`$\overline{PA}$ and $\overline{PB}$ are tangent to the circle. Find $x$ in the figure.`,
      figure: twoTangents(110, { showO: false, pa: lin(a, b), pb: lin(c, d) }),
      answer: String(x),
      verify: [`${lin(a, b)} = ${lin(c, d)}`],
      hint: "Two tangent segments from the same point are congruent. Collect the x-terms on one side.",
      solution: [
        { math: md`${lin(a, b)} = ${lin(c, d)}`, note: "Tangent segments from one point are congruent (proved with HL)." },
        { math: md`${lin(a - c, 0)} = ${d - b}`, note: "Collect the x-terms on the left and the numbers on the right." },
        { math: md`x = ${x}`, note: md`Divide by ${a - c}. Check: $PA = PB = ${p}$.` },
      ],
    };
  }
  const [p, q, s] = [r.int(2, 12), r.int(2, 12), r.int(2, 12)];
  if (kind === 2) {
    const [ab, bc, ca] = [p + q, q + s, s + p];
    return {
      prompt: md`A circle is inscribed in triangle $ABC$, touching the sides at $D$, $E$ and $F$. Find $AD$ in the figure.`,
      figure: incircleFig(p, q, s),
      answer: String(p),
      verify: [`(${ab} - x) + (${ca} - x) = ${bc}`],
      hint: md`From each vertex, the two tangent segments are equal: $AD = AF$, $BD = BE$, $CE = CF$. Call $AD = t$ and write the other pieces in terms of $t$.`,
      solution: [
        { math: md`AD = AF = t`, note: "Tangent segments from A are congruent." },
        { math: md`BD = ${ab} - t = BE, \quad CF = ${ca} - t = CE`, note: md`Segment Addition on $\overline{AB}$ and $\overline{CA}$, then tangent segments from $B$ and from $C$.` },
        { math: md`(${ab} - t) + (${ca} - t) = ${bc}`, note: md`$BE + EC = BC$.` },
        { math: md`${ab + ca} - 2t = ${bc} \;\Rightarrow\; t = ${p}`, note: md`Subtract ${ab + ca}, then divide by $-2$.` },
      ],
    };
  }
  const w = r.int(2, 12);
  const [ab, bc, cd, da] = [w + p, p + q, q + s, s + w];
  return {
    prompt: md`All four sides of quadrilateral $ABCD$ are tangent to a circle. Find $DA$ in the figure.`,
    figure: tangentialQuadFig([w, p, q, s], [String(ab), String(bc), String(cd), "?"]),
    answer: String(da),
    verify: [`${ab} + ${cd} = ${bc} + x`],
    hint: "Each side is made of two tangent pieces, one from each end. The pieces from the same vertex are equal. Compare the opposite sides.",
    solution: [
      { math: md`AB = a + b, \; BC = b + c, \; CD = c + d, \; DA = d + a`, note: md`Call the tangent lengths from $A$, $B$, $C$, $D$ $a$, $b$, $c$, $d$. Each vertex sends two equal tangent segments.` },
      { math: md`AB + CD = a + b + c + d = BC + DA`, note: "Both pairs of opposite sides use each tangent length once." },
      { math: md`${ab} + ${cd} = ${bc} + DA \;\Rightarrow\; DA = ${da}`, note: md`Subtract ${bc}.` },
    ],
  };
};

const chordFacts: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 2) {
    let [c, x, prod] = [0, 0, 0];
    let divs: number[] = [];
    do {
      [c, x] = [r.int(2, 9), r.int(2, 12)];
      prod = c * x;
      divs = Array.from({ length: prod }, (_, i) => i + 1).filter((v) => prod % v === 0 && v !== c && v !== x && v > 1 && v < prod);
    } while (divs.length === 0);
    const a = r.pick(divs);
    const b = prod / a;
    const fig = crossingFig(a, b, c, x);
    return {
      prompt: md`Chords $\overline{AB}$ and $\overline{CD}$ of a circle cross at $E$. Find $ED$ in the figure.${fig.toScale ? "" : " (The figure is not drawn to scale.)"}`,
      figure: fig.figure,
      answer: String(x),
      verify: [`${a} * ${b} = ${c} * x`],
      hint: md`When two chords cross, the products of their pieces are equal: $AE \cdot EB = CE \cdot ED$.`,
      solution: [
        { math: md`AE \cdot EB = CE \cdot ED`, note: md`$\triangle AEC \sim \triangle DEB$ by AA, so the pieces are proportional, which gives this product rule.` },
        { math: md`${a} \cdot ${b} = ${c} \cdot ED`, note: "Substitute." },
        { math: md`${prod} = ${c} \cdot ED`, note: "Multiply." },
        { math: md`ED = ${x}`, note: md`Divide by ${c}.` },
      ],
    };
  }
  // Right triangle: distance d, half-chord h, radius R.
  let d: number, h2: number, R: number;
  const useTriple = kind !== 0 || r.next() < 0.6;
  if (useTriple) {
    const [p, q, hyp] = r.pick(TRIPLES.slice(0, 4));
    const k = hyp <= 5 ? r.int(1, 3) : 1;
    const flip = r.next() < 0.5;
    [d, R] = [(flip ? p : q) * k, hyp * k];
    h2 = R * R - d * d;
  } else {
    R = r.int(3, 10);
    d = r.int(1, R - 1);
    h2 = R * R - d * d;
  }
  const h = Math.sqrt(h2);
  const picture: Step = { math: md`d^2 + \left(\tfrac{c}{2}\right)^2 = r^2`, note: "The perpendicular from the center bisects the chord, so the distance, half the chord and a radius form a right triangle with the radius as hypotenuse." };
  if (kind === 0) {
    const chord = root(h2, 2);
    return {
      prompt: md`Find the length of chord $\overline{AB}$ in circle $O$. ${EXACT}`,
      figure: chordFig(R, d, h, { radius: String(R), dist: String(d), chord: "?" }),
      answer: chord.text,
      simplified: true,
      verify: [`${d}^2 + (x/2)^2 = ${R}^2`],
      hint: "Draw the perpendicular from the center to the chord, and a radius to one end of the chord. Find half the chord first.",
      solution: [
        picture,
        { math: md`${d}^2 + \left(\tfrac{c}{2}\right)^2 = ${R}^2 \;\Rightarrow\; \left(\tfrac{c}{2}\right)^2 = ${h2}`, note: md`$${R * R} - ${d * d} = ${h2}$.` },
        { math: md`\tfrac{c}{2} = ${root(h2).tex}`, note: "Take the positive square root." },
        { math: md`c = ${chord.tex}`, note: "Double it: the perpendicular cut the chord into two equal halves." },
      ],
    };
  }
  if (kind === 1) {
    const chord = 2 * h;
    return {
      prompt: md`How far is chord $\overline{AB}$ from the center of circle $O$? Find the distance marked in the figure.`,
      figure: chordFig(R, d, h, { radius: String(R), dist: "?", chord: String(chord) }),
      answer: String(d),
      verify: [`x^2 + ${h}^2 = ${R}^2`],
      hint: "The perpendicular from the center cuts the chord in half. Use half the chord and a radius in a right triangle.",
      solution: [
        picture,
        { math: md`d^2 + ${h}^2 = ${R}^2`, note: md`Half the chord is $\frac{${chord}}{2} = ${h}$.` },
        { math: md`d^2 = ${R * R} - ${h2} = ${d * d}`, note: "" },
        { math: md`d = ${d}`, note: "Take the positive square root." },
      ],
    };
  }
  const chord = 2 * h;
  return {
    prompt: md`Find the radius of circle $O$.`,
    figure: chordFig(R, d, h, { radius: "?", dist: String(d), chord: String(chord) }),
    answer: String(R),
    verify: [`${d}^2 + ${h}^2 = x^2`],
    hint: "Join the center to one end of the chord. That radius is the hypotenuse of a right triangle whose legs are the distance and half the chord.",
    solution: [
      picture,
      { math: md`${d}^2 + ${h}^2 = r^2`, note: md`Half the chord is $\frac{${chord}}{2} = ${h}$.` },
      { math: md`r^2 = ${d * d} + ${h2} = ${R * R}`, note: "" },
      { math: md`r = ${R}`, note: "Take the positive square root." },
    ],
  };
};

// ── Lesson 4: Equations of circles ──────────────────────────────────────────

/** (x - h)^2, or x^2 when h = 0. */
const sq = (v: "x" | "y", h: number) => (h === 0 ? `${v}^2` : `(${v} ${signed(-h)})^2`);
const standard = (h: number, k: number, r2: number) => md`${sq("x", h)} + ${sq("y", k)} = ${r2}`;
const NONSQUARES = [2, 3, 5, 6, 7, 8, 10, 12, 13, 18, 20, 27, 32, 45, 50];

const readCircle: Generator = (r) => {
  const kind = r.int(0, 3);
  let h = r.int(-9, 9);
  let k = r.int(-9, 9);
  if (kind === 3) [h, k] = r.next() < 0.5 ? [0, r.nonzero(-9, 9)] : [r.nonzero(-9, 9), 0];
  if (kind === 2) [h, k] = [0, 0];
  const r2 = r.next() < 0.55 ? r.int(1, 10) ** 2 : r.pick(NONSQUARES);
  const eq = standard(h, k, r2);
  const rad = root(r2);
  if (kind === 0 || kind === 3) {
    return {
      prompt: md`Find the center of the circle $${eq}$. ${POINT}`,
      answer: `(${h}, ${k})`,
      form: "tuple",
      hint: md`Match it to $(x - h)^2 + (y - k)^2 = r^2$. A plus sign inside means that coordinate is negative, and a bare $x^2$ means $(x - 0)^2$.`,
      solution: [
        { math: md`(x - ${paren(h)})^2 + (y - ${paren(k)})^2 = ${r2}`, note: md`Rewrite it in exactly the shape $(x - h)^2 + (y - k)^2 = r^2$.` },
        { math: md`(h, k) = (${h}, ${k})`, note: md`The center is the one point that makes both squares 0.` },
      ],
    };
  }
  return {
    prompt: md`Find the radius of the circle $${eq}$. ${EXACT}`,
    answer: rad.text,
    simplified: true,
    hint: md`The number on the right is $r^2$, not $r$.`,
    solution: [
      { math: md`r^2 = ${r2}`, note: md`In $(x - h)^2 + (y - k)^2 = r^2$ the right side is the radius squared.` },
      { math: md`r = ${rad.tex}`, note: Number.isInteger(Math.sqrt(r2)) ? "Take the positive square root." : md`Take the positive square root and simplify.` },
    ],
  };
};

const circleData: Generator = (r) => {
  const kind = r.int(0, 4);
  const h = r.int(-6, 6);
  const k = r.int(-6, 6);
  if (kind === 0) {
    let [dx, dy] = [0, 0];
    while (dx === 0 && dy === 0) [dx, dy] = [r.int(-7, 7), r.int(-7, 7)];
    const r2 = dx * dx + dy * dy;
    const rad = root(r2);
    if (r.next() < 0.4) {
      return {
        prompt: md`A circle has center $(${h}, ${k})$ and passes through $(${h + dx}, ${k + dy})$. Its equation is $${sq("x", h)} + ${sq("y", k)} = c$. Find $c$.`,
        answer: String(r2),
        hint: md`In $(x - h)^2 + (y - k)^2 = r^2$ the right side is $r^2$, the squared distance from the center to the point.`,
        solution: [
          { math: md`r^2 = (${h + dx} - ${paren(h)})^2 + (${k + dy} - ${paren(k)})^2`, note: md`Distance Formula, squared. The equation needs only $r^2$, so there is no square root to take.` },
          { math: md`r^2 = ${paren(dx)}^2 + ${paren(dy)}^2 = ${r2}`, note: "" },
          { math: standard(h, k, r2), note: md`So $c = ${r2}$.` },
        ],
      };
    }
    return {
      prompt: md`A circle has center $(${h}, ${k})$ and passes through $(${h + dx}, ${k + dy})$. Find its radius. ${EXACT}`,
      answer: rad.text,
      simplified: true,
      hint: "The radius is the distance from the center to any point on the circle. Use the Distance Formula.",
      solution: [
        { math: md`r = \sqrt{(${h + dx} - ${paren(h)})^2 + (${k + dy} - ${paren(k)})^2}`, note: "Distance Formula." },
        { math: md`r = \sqrt{${paren(dx)}^2 + ${paren(dy)}^2} = \sqrt{${r2}}`, note: "" },
        { math: md`r = ${rad.tex}`, note: Number.isInteger(Math.sqrt(r2)) ? "" : "Simplify the root." },
        { math: standard(h, k, r2), note: "So the circle's equation is this." },
      ],
    };
  }
  if (kind === 1) {
    let [dx, dy] = [0, 0];
    while (dx === 0 && dy === 0) [dx, dy] = [r.int(-6, 6), r.int(-6, 6)];
    const [x1, y1, x2, y2] = [h - dx, k - dy, h + dx, k + dy];
    return {
      prompt: md`The endpoints of a diameter of a circle are $(${x1}, ${y1})$ and $(${x2}, ${y2})$. Find the center of the circle. ${POINT}`,
      answer: `(${h}, ${k})`,
      form: "tuple",
      hint: "The center is the midpoint of every diameter.",
      solution: [
        { math: md`\left(\frac{${x1} + ${paren(x2)}}{2}, \frac{${y1} + ${paren(y2)}}{2}\right)`, note: "Midpoint Formula: average the coordinates." },
        { math: md`(${h}, ${k})`, note: md`The center is the midpoint of every diameter: the two halves of a diameter are radii, so they are equal.` },
      ],
    };
  }
  if (kind === 2) {
    const R = r.pick([5, 10, 13]);
    const onPts: Record<number, [number, number][]> = { 5: [[3, 4], [4, 3], [5, 0], [0, 5]], 10: [[6, 8], [8, 6], [10, 0]], 13: [[5, 12], [12, 5], [13, 0]] };
    const target = r.pick(["inside the circle", "on the circle", "outside the circle"] as const);
    let [dx, dy] = [0, 0];
    if (target === "on the circle") {
      [dx, dy] = r.pick(onPts[R]!);
      if (r.next() < 0.5) dx = -dx;
      if (r.next() < 0.5) dy = -dy;
    } else {
      for (;;) {
        [dx, dy] = [r.int(-R - 2, R + 2), r.int(-R - 2, R + 2)];
        const d2 = dx * dx + dy * dy;
        if (target === "inside the circle" ? d2 < R * R && d2 >= (R - 3) * (R - 3) : d2 > R * R && d2 <= (R + 2) * (R + 2)) break;
      }
    }
    const d2 = dx * dx + dy * dy;
    const cmp = d2 < R * R ? "<" : d2 > R * R ? ">" : "=";
    const xTerm = h === 0 ? `${paren(dx)}^2` : `(${h + dx} ${signed(-h)})^2`;
    const yTerm = k === 0 ? `${paren(dy)}^2` : `(${k + dy} ${signed(-k)})^2`;
    const middle = h === 0 && k === 0 ? "" : ` = ${paren(dx)}^2 + ${paren(dy)}^2`;
    return {
      prompt: md`Is the point $(${h + dx}, ${k + dy})$ inside, on, or outside the circle $${standard(h, k, R * R)}$?`,
      choices: shuffled(r, ["inside the circle", "on the circle", "outside the circle"]),
      accept: [target],
      hint: md`Substitute the point into the left side and compare with $r^2 = ${R * R}$. The left side is the squared distance from the center.`,
      solution: [
        { math: md`${xTerm} + ${yTerm}${middle} = ${d2}`, note: "This is the squared distance from the center to the point." },
        { math: md`${d2} ${cmp} ${R * R}`, note: `So the point is ${target}: its distance from the center is ${cmp === "<" ? "less than" : cmp === ">" ? "more than" : "exactly"} the radius ${R}.` },
      ],
    };
  }
  // Where the circle meets a horizontal line.
  const [p, q, hyp] = r.pick([
    [3, 4, 5],
    [4, 3, 5],
    [6, 8, 10],
    [8, 6, 10],
    [5, 12, 13],
    [12, 5, 13],
    [0, 5, 5],
    [0, 10, 10],
  ] as [number, number, number][]);
  const yOff = p === 0 ? 0 : r.sign() * p;
  const c = k + yOff;
  const yPart = k === 0 ? `${paren(c)}^2` : `(${c} ${signed(-k)})^2`;
  const answer = `${h + q}, ${h - q}`;
  return {
    prompt: md`Find the $x$-coordinates of the points where the circle $${standard(h, k, hyp * hyp)}$ meets the line $y = ${c}$. ${SOLS}`,
    answer,
    form: "set",
    hint: md`Every point on the line has $y = ${c}$. Substitute that into the circle's equation, then isolate the x-square and take square roots (both signs).`,
    solution: [
      { math: md`${sq("x", h)} + ${yPart} = ${hyp * hyp}`, note: md`The points are on the line, so substitute $y = ${c}$ into the circle's equation.` },
      ...(yOff === 0
        ? [{ math: md`${sq("x", h)} = ${q * q}`, note: md`$${yPart} = 0$, so the y-term drops out: the line passes through the center.` }]
        : [
            { math: md`${sq("x", h)} + ${yOff * yOff} = ${hyp * hyp}`, note: k === 0 ? md`$${yPart} = ${yOff * yOff}$.` : md`$${c} ${signed(-k)} = ${yOff}$, and its square is ${yOff * yOff}.` },
            { math: md`${sq("x", h)} = ${q * q}`, note: md`Subtract ${yOff * yOff}.` },
          ]),
      { math: h === 0 ? md`x = \pm ${q}` : md`x ${signed(-h)} = \pm ${q}`, note: "Square root property: two solutions." },
      { math: md`x = ${h + q} \quad\text{or}\quad x = ${h - q}`, note: md`The points are $(${h + q}, ${c})$ and $(${h - q}, ${c})$.` },
    ],
  };
};

const generalForm: Generator = (r) => {
  let [h, k] = [0, 0];
  while (h === 0 && k === 0) [h, k] = [r.int(-6, 6), r.int(-6, 6)];
  const r2 = r.next() < 0.6 ? r.int(1, 8) ** 2 : r.pick(NONSQUARES);
  const [D, E, F] = [-2 * h, -2 * k, h * h + k * k - r2];
  const m = r.next() < 0.25 ? 2 : 1;
  const eq = md`${poly([[m, "x^2"], [m, "y^2"], [m * D, "x"], [m * E, "y"], [m * F, ""]])} = 0`;
  const askCenter = r.next() < 0.5;
  const xg = D === 0 ? "x^2" : `(${poly([[1, "x^2"], [D, "x"]])})`;
  const yg = E === 0 ? "y^2" : `(${poly([[1, "y^2"], [E, "y"]])})`;
  const xc = D === 0 ? "x^2" : `(${poly([[1, "x^2"], [D, "x"], [h * h, ""]])})`;
  const yc = E === 0 ? "y^2" : `(${poly([[1, "y^2"], [E, "y"], [k * k, ""]])})`;
  const added = [h * h, k * k].filter((v) => v !== 0);
  const halves = [D !== 0 ? md`half of $${D}$ is $${-h}$, squared ${h * h}` : "", E !== 0 ? md`half of $${E}$ is $${-k}$, squared ${k * k}` : ""].filter(Boolean).join("; ");
  const steps: Step[] = [];
  if (m !== 1) steps.push({ math: md`${poly([[1, "x^2"], [1, "y^2"], [D, "x"], [E, "y"], [F, ""]])} = 0`, note: md`Divide every term by ${m}, so $x^2$ and $y^2$ have coefficient 1.` });
  steps.push(
    { math: md`${xg} + ${yg} = ${-F}`, note: "Group the x-terms and the y-terms, and move the constant to the right." },
    { math: md`${xc} + ${yc} = ${-F} ${added.map((v) => signed(v)).join(" ")}`, note: md`Complete each square: ${halves}. Add the same amounts to the right side.` },
    { math: standard(h, k, r2), note: "Each group is a perfect square now." },
    askCenter
      ? { math: md`(h, k) = (${h}, ${k})`, note: "Read the center off standard form." }
      : { math: md`r = \sqrt{${r2}} = ${root(r2).tex}`, note: "The right side is the radius squared." },
  );
  return {
    prompt: askCenter
      ? md`Find the center of the circle $${eq}$. ${POINT}`
      : md`Find the radius of the circle $${eq}$. ${EXACT}`,
    answer: askCenter ? `(${h}, ${k})` : root(r2).text,
    form: askCenter ? "tuple" : undefined,
    simplified: askCenter ? undefined : true,
    hint: m !== 1 ? "Divide through so x² and y² have coefficient 1. Then complete the square in x and in y separately." : "Complete the square in x and in y separately: half the coefficient, squared, added to both sides.",
    solution: steps,
  };
};

// ── Diagrams ────────────────────────────────────────────────────────────────

const partsDiagram: DiagramSpec = (() => {
  return {
    view: [-5.5, 5.5, -5, 5],
    points: [{ name: "O", x: 0, y: 0, dir: "s" }, on("A", 60), on("D", 180), on("E", 0), on("B", 215), on("C", 325)],
    circles: [{ center: "O", radius: 4 }],
    segments: [
      { from: "O", to: "A", color: 1 },
      { from: "D", to: "E", color: 2 },
      { from: "B", to: "C", color: 3 },
    ],
    labels: [
      { x: 0.35, y: 1.95, text: md`\text{radius}` },
      { x: -2.2, y: 0.45, text: md`\text{diameter}` },
      { x: 0, y: -2.05, text: md`\text{chord}` },
    ],
    caption: md`$\overline{OA}$ is a radius, $\overline{BC}$ is a chord, and $\overline{DE}$ is a diameter: a chord through the center.`,
  };
})();

const arcMeasureDiagram: DiagramSpec = (() => {
  const A = onExpr(4, "90 - m/2");
  const B = onExpr(4, "90 + m/2");
  const view: DiagramSpec["view"] = [-5, 5, -5, 5];
  // The highlighted arc runs just outside the circle, so the circle's stroke doesn't cover it.
  const lift = 4 + ARC_LIFT / ppu(view);
  const [A2, B2] = [onExpr(lift, "90 - m/2"), onExpr(lift, "90 + m/2")];
  return {
    view,
    params: [{ name: "m", tex: md`\angle AOB`, min: 20, max: 170, step: 5, value: 70 }],
    points: [
      { name: "O", x: 0, y: 0, dir: "s" },
      { name: "A", x: A[0], y: A[1], dir: "ne" },
      { name: "B", x: B[0], y: B[1], dir: "nw" },
      on("C", 270),
      { name: "A2", x: A2[0], y: A2[1], hidden: true, label: "" },
      { name: "B2", x: B2[0], y: B2[1], hidden: true, label: "" },
    ],
    circles: [{ center: "O", radius: 4 }],
    segments: [{ from: "O", to: "A" }, { from: "O", to: "B" }],
    arcs: [{ center: "O", from: "A2", to: "B2", color: 2 }],
    angles: [{ at: "O", from: "A", to: "B", color: 2, label: md`{m}^\circ` }],
    readouts: [
      { label: md`\overgroup{AB}`, value: "m", unit: "^\\circ" },
      { label: md`\overgroup{ACB}`, value: "360 - m", unit: "^\\circ" },
    ],
    caption: md`The orange minor arc $\overgroup{AB}$ measures the same as its central angle. The major arc $\overgroup{ACB}$, through $C$, is the rest of the $360^\circ$.`,
  };
})();

const chordProofDiagram: DiagramSpec = {
  view: [-5.5, 5.5, -5, 5],
  points: [{ name: "O", x: 0, y: 0, dir: "e" }, on("A", 95), on("B", 165), on("C", 255), on("D", 325)],
  circles: [{ center: "O", radius: 4 }],
  segments: [
    { from: "O", to: "A", dashed: true },
    { from: "O", to: "B", dashed: true },
    { from: "O", to: "C", dashed: true },
    { from: "O", to: "D", dashed: true },
    { from: "A", to: "B", ticks: 1, color: 1 },
    { from: "C", to: "D", ticks: 1, color: 1 },
  ],
  angles: [
    { at: "O", from: "A", to: "B", label: md`70^\circ` },
    { at: "O", from: "C", to: "D", label: md`70^\circ` },
  ],
  caption: md`Equal central angles, so the triangles $AOB$ and $COD$ match by SAS, and the chords are equal.`,
};

const arcLengthDiagram: DiagramSpec = (() => {
  const view: DiagramSpec["view"] = [-5.5, 5.5, -5.5, 5.5];
  const B = onExpr("r", "m");
  // The arc is drawn in two halves through its midpoint, so each half stays a minor arc up to 350°. It runs
  // just outside the circle (A2, M, B2), so the circle's stroke doesn't cover it.
  const lift = `r + ${round3(ARC_LIFT / ppu(view))}`;
  const [A2, M, B2] = [onExpr(lift, "0"), onExpr(lift, "m/2"), onExpr(lift, "m")];
  return {
    view,
    params: [
      { name: "m", tex: md`\text{arc measure } m`, min: 10, max: 350, step: 5, value: 120 },
      { name: "r", tex: md`\text{radius } r`, min: 1, max: 5, step: 0.5, value: 4 },
    ],
    points: [
      { name: "O", x: 0, y: 0, dir: "sw" },
      { name: "A", x: "r", y: 0, dir: "e" },
      // B moves all the way round, so its label is a live one just outside the circle.
      { name: "B", x: B[0], y: B[1], label: "" },
      { name: "A2", x: A2[0], y: A2[1], hidden: true, label: "" },
      { name: "M", x: M[0], y: M[1], hidden: true, label: "" },
      { name: "B2", x: B2[0], y: B2[1], hidden: true, label: "" },
    ],
    circles: [{ center: "O", radius: "r" }],
    segments: [{ from: "O", to: "A" }, { from: "O", to: "B" }],
    arcs: [
      { center: "O", from: "A2", to: "M", color: 2 },
      { center: "O", from: "M", to: "B2", color: 2 },
    ],
    labels: [{ x: onExpr("r + 0.45", "m")[0], y: onExpr("r + 0.45", "m")[1], text: "B" }],
    readouts: [
      { label: md`\text{fraction of circle } \tfrac{m}{360}`, value: "m/360" },
      { label: md`C = 2\pi r`, value: "2*pi*r" },
      { label: md`\text{arc length}`, value: "m/360*2*pi*r" },
    ],
    caption: md`The orange arc runs counterclockwise from $A$ to $B$. Its length is the same fraction of the circumference as its measure is of $360^\circ$. Double $r$ and the length doubles; the measure doesn't change.`,
  };
})();

const inscribedSlider: DiagramSpec = (() => {
  const P = onExpr(5, "p");
  const A = onExpr(5, "270 - c/2");
  const B = onExpr(5, "270 + c/2");
  const view: DiagramSpec["view"] = [-6.5, 6.5, -6.5, 6.5];
  // The highlighted arc runs just outside the circle, so the circle's stroke doesn't cover it.
  const lift = 5 + ARC_LIFT / ppu(view);
  const [A2, B2] = [onExpr(lift, "270 - c/2"), onExpr(lift, "270 + c/2")];
  return {
    view,
    params: [
      { name: "p", tex: md`\text{position of } P`, min: -10, max: 190, step: 1, value: 115 },
      { name: "c", tex: md`\angle AOB`, min: 40, max: 140, step: 5, value: 80 },
    ],
    points: [
      { name: "O", x: 0, y: 0, dir: "n" },
      // P moves round the top, so its label is a live one just outside the circle.
      { name: "P", x: P[0], y: P[1], label: "" },
      { name: "A", x: A[0], y: A[1], dir: "sw" },
      { name: "B", x: B[0], y: B[1], dir: "se" },
      { name: "A2", x: A2[0], y: A2[1], hidden: true, label: "" },
      { name: "B2", x: B2[0], y: B2[1], hidden: true, label: "" },
    ],
    circles: [{ center: "O", radius: 5 }],
    segments: [
      { from: "P", to: "A", color: 1 },
      { from: "P", to: "B", color: 1 },
      { from: "O", to: "A", dashed: true },
      { from: "O", to: "B", dashed: true },
    ],
    arcs: [{ center: "O", from: "A2", to: "B2", color: 2 }],
    angles: [
      { at: "P", from: "A", to: "B", color: 1 },
      { at: "O", from: "A", to: "B", color: 2 },
    ],
    labels: [{ x: onExpr(5.55, "p")[0], y: onExpr(5.55, "p")[1], text: "P" }],
    readouts: [
      { label: md`\angle AOB = \overgroup{AB}`, value: "c", unit: "^\\circ" },
      { label: md`\angle APB \text{ (measured)}`, value: measureAngle(P, A, B), unit: "^\\circ" },
    ],
    caption: md`Slide $P$ anywhere on the top part of the circle: the measured $\angle APB$ doesn't move, and it is always half of $\angle AOB$. Change the arc and both readouts change together.`,
  };
})();

const case1Diagram: DiagramSpec = {
  view: [-5.5, 5.5, -5, 5],
  points: [{ name: "O", x: 0, y: 0, dir: "se" }, on("A", 80), on("B", 200), on("C", 20)],
  circles: [{ center: "O", radius: 4 }],
  polygons: [{ points: ["A", "O", "B"], fill: 3 }],
  segments: [
    { from: "B", to: "A", color: 1 },
    { from: "B", to: "C", color: 1 },
    { from: "O", to: "A", ticks: 1 },
    { from: "O", to: "B", ticks: 1 },
  ],
  angles: [
    { at: "B", from: "O", to: "A", label: "x", color: 1 },
    { at: "A", from: "B", to: "O", label: "x", color: 1 },
    { at: "O", from: "C", to: "A", label: "2x", color: 2 },
  ],
  caption: md`Case 1: side $\overline{BC}$ is a diameter. $\triangle AOB$ is isosceles because $OA = OB$, and $\angle AOC$ is its exterior angle.`,
};

const case2Diagram: DiagramSpec = {
  view: [-5.5, 5.5, -5, 5],
  points: [{ name: "O", x: 0, y: 0, dir: "e" }, on("A", 150), on("B", 270), on("C", 30), on("D", 90)],
  circles: [{ center: "O", radius: 4 }],
  segments: [
    { from: "B", to: "A", color: 1 },
    { from: "B", to: "C", color: 1 },
    { from: "B", to: "D", dashed: true },
  ],
  angles: [
    { at: "B", from: "A", to: "D", arcs: 1, color: 1 },
    { at: "B", from: "D", to: "C", arcs: 2, color: 2 },
  ],
  caption: md`Case 2: the center is inside the angle. The diameter $\overline{BD}$ splits the angle, and the arc, into two case-1 pieces.`,
};

const thalesDiagram: DiagramSpec = (() => {
  const C = onExpr(4, "t");
  return {
    view: [-5, 5, -1.5, 5],
    params: [{ name: "t", tex: md`\text{position of } C`, min: 8, max: 172, step: 1, value: 60 }],
    // C moves round the top, so its label is a live one just outside the circle.
    points: [{ name: "O", x: 0, y: 0, dir: "s" }, { name: "A", x: -4, y: 0, dir: "w" }, { name: "B", x: 4, y: 0, dir: "e" }, { name: "C", x: C[0], y: C[1], label: "" }],
    circles: [{ center: "O", radius: 4 }],
    segments: [
      { from: "A", to: "B" },
      { from: "C", to: "A", color: 1 },
      { from: "C", to: "B", color: 1 },
    ],
    angles: [{ at: "C", from: "A", to: "B", right: true, color: 1 }],
    labels: [{ x: onExpr(4.45, "t")[0], y: onExpr(4.45, "t")[1], text: "C" }],
    readouts: [{ label: md`\angle ACB \text{ (measured)}`, value: measureAngle(C, ["-4", "0"], ["4", "0"]), unit: "^\\circ" }],
    caption: md`$\overline{AB}$ is a diameter. Wherever $C$ goes on the circle, $\angle ACB$ is a right angle.`,
  };
})();

const quadDiagram: DiagramSpec = {
  view: [-5.5, 5.5, -5, 5],
  points: [{ name: "O", x: 0, y: 0, dir: "e" }, on("A", 200), on("B", 110), on("C", 30), on("D", 290)],
  circles: [{ center: "O", radius: 4 }],
  polygons: [{ points: ["A", "B", "C", "D"], fill: 1 }],
  angles: [
    { at: "A", from: "D", to: "B", color: 1 },
    { at: "C", from: "B", to: "D", color: 2 },
  ],
  caption: md`$\angle A$ opens onto the arc $\overgroup{BCD}$, and $\angle C$ onto the arc $\overgroup{DAB}$. Together those arcs are the whole circle.`,
};

const linesDiagram: DiagramSpec = (() => {
  const T = polar(3, 60);
  const T2 = { x: round3(T.x - 2 * Math.sin(Math.PI / 3)), y: round3(T.y + 2 * Math.cos(Math.PI / 3)) };
  return {
    view: [-6, 6, -4.6, 4.6],
    points: [
      { name: "O", x: 0, y: 0, dir: "s" },
      { name: "T", ...T, dir: "ne" },
      { name: "T2", ...T2, hidden: true, label: "" },
      on("S1", 200, 3, "nw"),
      on("S2", 330, 3, "ne"),
      { name: "M1", x: -5, y: -4, hidden: true, label: "" },
      { name: "M2", x: 5, y: -4, hidden: true, label: "" },
    ],
    circles: [{ center: "O", radius: 3 }],
    segments: [
      { from: "T", to: "T2", kind: "line", color: 2 },
      { from: "S1", to: "S2", kind: "line", color: 1 },
      { from: "M1", to: "M2", kind: "line", color: 3, dashed: true },
      { from: "O", to: "T", dashed: true },
    ],
    angles: [{ at: "T", from: "O", to: "T2", right: true, color: 2 }],
    labels: [
      { x: 4.1, y: 2.15, text: md`\text{tangent}` },
      { x: 4.3, y: -1.0, text: md`\text{secant}` },
      { x: 4.3, y: -3.55, text: md`\text{misses}` },
    ],
    caption: md`A line can meet a circle in two points (a **secant**), one point (a **tangent**), or none. The tangent touches at $T$, and it is perpendicular to the radius $\overline{OT}$ there.`,
  };
})();

const tangentProofDiagram: DiagramSpec = (() => {
  // A line that is NOT perpendicular to OT at T: its foot F from O is between T and a second hit T'.
  const n = { x: Math.cos((63.435 * Math.PI) / 180), y: Math.sin((63.435 * Math.PI) / 180) };
  const u = { x: n.y, y: -n.x };
  const F = { x: round3(3 * n.x), y: round3(3 * n.y) };
  const half = Math.sqrt(16 - 9);
  const T = { x: round3(F.x - half * u.x), y: round3(F.y - half * u.y) };
  const T2 = { x: round3(F.x + half * u.x), y: round3(F.y + half * u.y) };
  return {
    view: [-5, 6, -4.6, 5.2],
    points: [{ name: "O", x: 0, y: 0, dir: "s" }, { name: "T", ...T, dir: "nw" }, { name: "F", ...F, dir: "n" }, { name: "T'", ...T2, label: "T'", dir: "ne" }],
    circles: [{ center: "O", radius: 4 }],
    segments: [
      { from: "T", to: "T'", kind: "line", color: 4 },
      { from: "O", to: "T", ticks: 1 },
      { from: "O", to: "T'", ticks: 1 },
      { from: "O", to: "F", dashed: true },
      { from: "T", to: "F", ticks: 2, color: 4 },
      { from: "F", to: "T'", ticks: 2, color: 4 },
    ],
    angles: [{ at: "F", from: "O", to: "T'", right: true }],
    caption: md`If the line through $T$ were not perpendicular to $\overline{OT}$, the perpendicular from $O$ would land at some other point $F$. Mirroring $T$ across $F$ gives $T'$, just as far from $O$: a second point on the circle.`,
  };
})();

const tangentSegmentsDiagram: DiagramSpec = {
  view: [-3.6, 6, -3.4, 3.4],
  points: [
    { name: "O", x: 0, y: 0, dir: "w" },
    { name: "A", x: 1.8, y: 2.4, dir: "n" },
    { name: "B", x: 1.8, y: -2.4, dir: "s" },
    { name: "P", x: 5, y: 0, dir: "e" },
  ],
  circles: [{ center: "O", radius: 3 }],
  segments: [
    { from: "P", to: "A", ticks: 1, color: 1, label: "4" },
    { from: "P", to: "B", ticks: 1, color: 1, label: "4" },
    { from: "O", to: "A", label: "3" },
    { from: "O", to: "B", label: "3" },
    { from: "O", to: "P", dashed: true, label: "5" },
  ],
  angles: [
    { at: "A", from: "O", to: "P", right: true },
    { at: "B", from: "O", to: "P", right: true },
  ],
  caption: md`Two tangents from $P$. Both triangles have a right angle, a radius as a leg and $\overline{OP}$ as the hypotenuse, so HL makes them congruent.`,
};

const chordDiagram: DiagramSpec = {
  view: [-6, 6, -6, 6],
  points: [
    { name: "O", x: 0, y: 0, dir: "n" },
    { name: "A", x: -4, y: -3, dir: "w" },
    { name: "B", x: 4, y: -3, dir: "e" },
    { name: "M", x: 0, y: -3, dir: "s" },
  ],
  circles: [{ center: "O", radius: 5 }],
  segments: [
    { from: "A", to: "M", ticks: 1, color: 1, label: "4" },
    { from: "M", to: "B", ticks: 1, color: 1, label: "4" },
    { from: "O", to: "M", dashed: true, label: "3" },
    { from: "O", to: "A", label: "5" },
    { from: "O", to: "B" },
  ],
  angles: [{ at: "M", from: "O", to: "B", right: true }],
  caption: md`The perpendicular from the center $O$ meets chord $\overline{AB}$ at its midpoint $M$. Here the radius is 5, the distance to the chord is 3, and half the chord is 4.`,
};

const crossingChordsDiagram: DiagramSpec = (() => {
  const [A, B, C, D] = [polar(4, 150), polar(4, 340), polar(4, 70), polar(4, 235)];
  const E = meet(A, B, C, D);
  return {
    view: [-5.5, 5.5, -5, 5],
    points: [
      { name: "O", x: 0, y: 0, hidden: true, label: "" },
      { name: "A", ...A, dir: "nw" },
      { name: "B", ...B, dir: "se" },
      { name: "C", ...C, dir: "n" },
      { name: "D", ...D, dir: "sw" },
      { name: "E", ...E, dir: "ne" },
    ],
    circles: [{ center: "O", radius: 4 }],
    segments: [
      { from: "A", to: "B", color: 1 },
      { from: "C", to: "D", color: 2 },
      { from: "A", to: "C", dashed: true },
      { from: "D", to: "B", dashed: true },
    ],
    angles: [
      { at: "A", from: "C", to: "E", color: 3 },
      { at: "D", from: "E", to: "B", color: 3 },
    ],
    caption: md`$\angle CAB$ and $\angle CDB$ both stand on $\overgroup{CB}$, so they are equal. With the vertical angles at $E$, that makes $\triangle AEC \sim \triangle DEB$.`,
  };
})();

const circleEquationDiagram: DiagramSpec = {
  view: [-8, 8, -8, 8],
  grid: true,
  params: [
    { name: "h", tex: "h", min: -3, max: 3, step: 1, value: 1 },
    { name: "k", tex: "k", min: -3, max: 3, step: 1, value: -1 },
    { name: "r", tex: "r", min: 1, max: 4, step: 0.5, value: 3 },
    { name: "t", tex: md`\text{position of } P`, min: 0, max: 360, step: 5, value: 40 },
  ],
  points: [
    { name: "C", x: "h", y: "k", label: "" },
    { name: "P", x: "h + r*cos(t*pi/180)", y: "k + r*sin(t*pi/180)", label: "" },
    { name: "Q", x: "h + r*cos(t*pi/180)", y: "k", hidden: true, label: "" },
  ],
  circles: [{ center: "C", radius: "r", color: 1 }],
  segments: [
    { from: "C", to: "P", color: 2 },
    { from: "C", to: "Q", dashed: true },
    { from: "Q", to: "P", dashed: true },
  ],
  // P moves all the way round, so both labels are live: (x, y) just beyond P, and (h, k) on the side of the
  // centre away from P, clear of the radius and the dashed legs.
  labels: [
    { x: "h + (r + 1.05)*cos(t*pi/180)", y: "k + (r + 0.5)*sin(t*pi/180)", text: "(x, y)" },
    { x: "h - 1.05*cos(t*pi/180)", y: "k - 0.5*sin(t*pi/180)", text: "(h, k)" },
  ],
  readouts: [
    { label: "x - h", value: "r*cos(t*pi/180)" },
    { label: "y - k", value: "r*sin(t*pi/180)" },
    { label: "(x - h)^2 + (y - k)^2", value: "(r*cos(t*pi/180))^2 + (r*sin(t*pi/180))^2" },
    { label: "r^2", value: "r^2" },
  ],
  caption: md`The dashed legs are $x - h$ and $y - k$, and the radius is the hypotenuse. Move $P$ around the circle: the sum of the squared legs is always $r^2$.`,
};

const exampleCircleDiagram: DiagramSpec = {
  view: [-4, 9, -8, 5],
  grid: true,
  points: [
    { name: "C", x: 3, y: -2, label: "(3, -2)", dir: "s" },
    { name: "P", x: 6, y: 2, label: "(6, 2)", dir: "ne" },
    { name: "Q", x: 6, y: -2, hidden: true, label: "" },
  ],
  circles: [{ center: "C", radius: 5, color: 1 }],
  segments: [
    { from: "C", to: "P", color: 2, label: "5" },
    { from: "C", to: "Q", dashed: true, label: "3" },
    { from: "Q", to: "P", dashed: true, label: "4" },
  ],
  caption: md`$(x - 3)^2 + (y + 2)^2 = 25$: center $(3, -2)$, radius 5. The point $(6, 2)$ is on it, because $3^2 + 4^2 = 25$.`,
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit7: Unit = {
  title: "Circles",
  lessons: [
    {
      id: "arcs-and-central-angles",
      title: "Arcs and central angles",
      summary: "What a circle is, how arcs are measured by central angles, and how long an arc is.",
      blocks: [
        {
          kind: "text",
          body: md`A **circle** is the set of all points in a plane that are a fixed distance from a fixed point. The fixed point is the **center**, and the fixed distance is the **radius**. A circle is named by its center: circle $O$ is the circle with center $O$.

That one sentence is everything a circle is. Every fact in this unit follows from it, using the triangles, parallels and similarity of the earlier units.`,
        },
        { kind: "diagram", ...partsDiagram },
        {
          kind: "key",
          title: "Parts of a circle",
          body: md`- A **radius** is a segment from the center to a point on the circle. Its length is also called the radius, $r$.
- A **chord** is a segment whose endpoints are both on the circle.
- A **diameter** is a chord through the center. Its length is $d = 2r$.
- All radii of a circle are congruent, since every point on it is the same distance $r$ from the center. In proofs the reason is "radii of the same circle". Circles with equal radii are **congruent circles**.`,
        },
        {
          kind: "why",
          title: "Why is a diameter twice the radius?",
          body: md`A diameter $\overline{DE}$ passes through the center $O$, so $O$ is between $D$ and $E$. By the Segment Addition Postulate, $DE = DO + OE$. Both pieces are radii, so $DE = r + r = 2r$.

It also shows that the center is the midpoint of every diameter, since $DO = OE$.`,
        },
        {
          kind: "text",
          body: md`A **central angle** has its vertex at the center and its sides along two radii. Two points $A$ and $B$ on a circle split it into two **arcs**. The smaller one is the **minor arc**, written $\overgroup{AB}$. The larger one is the **major arc**, named with a third point on it, like $\overgroup{ACB}$, so it's clear which way around you go. If $\overline{AB}$ is a diameter, the two arcs are equal halves called **semicircles**.`,
        },
        {
          kind: "key",
          title: "Arc measure",
          body: md`- A minor arc measures the same as its central angle: $\overgroup{AB} = \angle AOB$.
- A semicircle measures $180^\circ$, and the whole circle $360^\circ$.
- A major arc is the rest of the circle: $\overgroup{ACB} = 360^\circ - \overgroup{AB}$.
- **Arc Addition Postulate:** if two arcs of a circle share only an endpoint $B$, the arc they make together is their sum: $\overgroup{ABC} = \overgroup{AB} + \overgroup{BC}$. Arcs that meet only at their endpoints and go once around the circle add to $360^\circ$.`,
        },
        {
          kind: "why",
          title: "Why a semicircle is 180° and a circle 360°",
          body: md`Take a diameter $\overline{DE}$ and any point $A$ on one side. The angles $\angle DOA$ and $\angle AOE$ form a linear pair, so they add to $180^\circ$ (Linear Pair Postulate). Each is the measure of its arc, so by Arc Addition the semicircle from $D$ through $A$ to $E$ is $\overgroup{DA} + \overgroup{AE} = 180^\circ$. The other half is another $180^\circ$, making $360^\circ$ for the whole circle.

So arc measure is a measure of *turning*, not of length. A $60^\circ$ arc is one sixth of the way around any circle, large or small.`,
        },
        { kind: "diagram", ...arcMeasureDiagram },
        {
          kind: "text",
          body: md`Here is the first theorem about circles. It ties chords, which are segments, to central angles, which measure arcs. The proof needs nothing new: just the fact that radii are equal, and SAS from Unit 3.`,
        },
        { kind: "diagram", ...chordProofDiagram },
        {
          kind: "proof",
          title: "Congruent central angles have congruent chords",
          given: md`$\angle AOB = \angle COD$ in circle $O$`,
          prove: md`$AB = CD$`,
          steps: [
            { statement: md`$\angle AOB = \angle COD$`, reason: "Given" },
            { statement: md`$OA = OC$ and $OB = OD$`, reason: "Radii of the same circle" },
            { statement: md`$\triangle AOB \cong \triangle COD$`, reason: "SAS" },
            { statement: md`$AB = CD$`, reason: "CPCTC" },
          ],
        },
        {
          kind: "text",
          body: md`The converse holds too: if $AB = CD$, the triangles match by SSS (two pairs of radii and the chords), so $\angle AOB = \angle COD$ by CPCTC. In one circle, congruent chords, congruent central angles and congruent arcs all go together.

**Arc length** is different from arc measure: it's how long the arc actually is. For that we need the distance all the way around, the **circumference** $C$. Every circle is a scaled copy of every other, so the ratio $\frac{C}{d}$ is the same number for all of them. That number is $\pi \approx 3.14159$. By definition, then, $C = \pi d = 2\pi r$. (Unit 8 looks closely at why the ratio is constant and how $\pi$ is estimated.)`,
        },
        {
          kind: "why",
          title: "Why arc length is a fraction of 2πr",
          body: md`Cut the circle into 360 arcs of $1^\circ$ each. Turn the circle about its center and any one of these arcs lands exactly on any other, since the turn keeps every point at distance $r$ from $O$ and keeps the central angle. So they are all the same length, and 360 of them make the circumference: $\frac{2\pi r}{360}$ each.

An arc of $m^\circ$ is $m$ of those pieces laid end to end (Arc Addition). So its length is $m \cdot \frac{2\pi r}{360}$. The same works with half-degree or smaller pieces, so the formula holds for any measure.`,
        },
        {
          kind: "key",
          title: "Arc length",
          body: md`An arc of $m^\circ$ in a circle of radius $r$ has length

$$L = \frac{m}{360} \cdot 2\pi r.$$

Leave $\pi$ as a symbol for an exact answer: type $6\pi$ as **6pi**.`,
        },
        { kind: "diagram", ...arcLengthDiagram },
        {
          kind: "example",
          title: "Finding an arc length",
          problem: md`Find the length of a $120^\circ$ arc in a circle with radius 9.`,
          steps: [
            { math: md`\frac{120}{360} = \frac{1}{3}`, note: "The arc is a third of the way around." },
            { math: md`C = 2\pi(9) = 18\pi`, note: "The whole circumference." },
            { math: md`L = \frac{1}{3} \cdot 18\pi = 6\pi`, note: md`About $18.85$ units, but $6\pi$ is exact.` },
          ],
        },
        {
          kind: "example",
          title: "Working backward to the measure",
          problem: md`An arc in a circle with radius 10 has length $4\pi$. Find its measure.`,
          steps: [
            { math: md`4\pi = \frac{m}{360} \cdot 20\pi`, note: md`Substitute into $L = \frac{m}{360} \cdot 2\pi r$.` },
            { math: md`\frac{m}{360} = \frac{4\pi}{20\pi} = \frac{1}{5}`, note: md`Divide both sides by $20\pi$. The arc is a fifth of the circle.` },
            { math: md`m = 72^\circ`, note: "Multiply both sides by 360." },
          ],
        },
        {
          kind: "check",
          prompt: md`In circle $O$, $\angle AOB = 64^\circ$ and $C$ is on the major arc. Find $\overgroup{ACB}$. Give the arc measure in degrees.`,
          answer: "296",
          explain: md`The minor arc is $64^\circ$, and the major arc is the rest: $360 - 64 = 296$.`,
        },
        {
          kind: "check",
          prompt: md`Find the length of a $90^\circ$ arc in a circle with radius 10. Give an exact answer in terms of $\pi$, like 3pi.`,
          answer: "5pi",
          explain: md`$\frac{90}{360} = \frac{1}{4}$ of $2\pi(10) = 20\pi$, which is $5\pi$.`,
        },
      ],
      practice: [arcMeasure, arcLength, centralAngleAlgebra].map(degreeWords),
    },
    {
      id: "inscribed-angles",
      title: "Inscribed angles",
      summary: "An angle with its vertex on the circle is half its arc: proved in three cases, with Thales' Theorem and inscribed quadrilaterals as consequences.",
      blocks: [
        {
          kind: "text",
          body: md`An **inscribed angle** has its vertex on the circle and its sides along two chords. In $\angle APB$ below, the vertex $P$ is on the circle. The arc between its sides, on the far side from $P$, is the **intercepted arc**, here $\overgroup{AB}$.

A central angle on the same arc is easy: it *equals* the arc. The inscribed angle is farther away from the arc, so it opens less. Try the slider and see by how much.`,
        },
        { kind: "diagram", ...inscribedSlider },
        {
          kind: "key",
          title: "Inscribed Angle Theorem",
          body: md`An inscribed angle is half of its intercepted arc:

$$\angle ABC = \tfrac{1}{2}\overgroup{AC}.$$

Equivalently, the arc is twice the angle. The intercepted arc is the one inside the angle, on the far side from the vertex. If the angle is obtuse it is a major arc, named with three letters: $\angle ABC = \tfrac{1}{2}\overgroup{ADC}$ for a point $D$ on that arc. The proof handles one special position first, where a side of the angle is a diameter, and then builds every other position out of that one.`,
        },
        { kind: "diagram", ...case1Diagram },
        {
          kind: "proof",
          title: "Case 1: one side is a diameter",
          given: md`$\angle ABC$ is inscribed in circle $O$, and $\overline{BC}$ is a diameter`,
          prove: md`$\angle ABC = \frac{1}{2}\overgroup{AC}$`,
          steps: [
            { statement: md`$OA = OB$`, reason: "Radii of the same circle" },
            { statement: md`$\angle OAB = \angle OBA$`, reason: md`Isosceles Triangle Theorem, in $\triangle AOB$` },
            { statement: md`$\angle AOC = \angle OAB + \angle OBA$`, reason: md`Exterior Angle Theorem: $B$, $O$, $C$ are on one line, so $\angle AOC$ is an exterior angle of $\triangle AOB$` },
            { statement: md`$\angle AOC = 2\angle OBA$`, reason: "Substitution (step 2 into step 3)" },
            { statement: md`$\overgroup{AC} = 2\angle ABC$`, reason: md`An arc equals its central angle, and $\angle OBA$ is $\angle ABC$ (ray $\overrightarrow{BO}$ is ray $\overrightarrow{BC}$)` },
            { statement: md`$\angle ABC = \frac{1}{2}\overgroup{AC}$`, reason: "Division Property of Equality" },
          ],
        },
        { kind: "diagram", ...case2Diagram },
        {
          kind: "proof",
          title: "Case 2: the center is inside the angle",
          given: md`$\angle ABC$ is inscribed in circle $O$, with $O$ inside the angle`,
          prove: md`$\angle ABC = \frac{1}{2}\overgroup{AC}$`,
          steps: [
            { statement: md`Draw the diameter $\overline{BD}$`, reason: md`Two points ($B$ and $O$) determine a line` },
            { statement: md`$\angle ABC = \angle ABD + \angle DBC$`, reason: md`Angle Addition Postulate ($D$ is inside the angle)` },
            { statement: md`$\overgroup{AC} = \overgroup{AD} + \overgroup{DC}$`, reason: "Arc Addition Postulate" },
            { statement: md`$\angle ABD = \frac{1}{2}\overgroup{AD}$ and $\angle DBC = \frac{1}{2}\overgroup{DC}$`, reason: md`Case 1: each angle has the diameter $\overline{BD}$ as a side` },
            { statement: md`$\angle ABC = \frac{1}{2}\overgroup{AD} + \frac{1}{2}\overgroup{DC}$`, reason: "Substitution (step 4 into step 2)" },
            { statement: md`$\angle ABC = \frac{1}{2}(\overgroup{AD} + \overgroup{DC}) = \frac{1}{2}\overgroup{AC}$`, reason: "Distributive Property, then substitution (step 3)" },
          ],
        },
        {
          kind: "why",
          title: "Case 3: the center is outside the angle",
          body: md`Draw the diameter $\overline{BD}$ again. Now it lies outside the angle, and one side of the angle, say $\overrightarrow{BA}$, is between $\overrightarrow{BD}$ and $\overrightarrow{BC}$. So instead of adding, subtract:

$$\angle ABC = \angle DBC - \angle DBA, \qquad \overgroup{AC} = \overgroup{DC} - \overgroup{DA}.$$

Case 1 applies to both angles on the right, so $\angle ABC = \frac{1}{2}\overgroup{DC} - \frac{1}{2}\overgroup{DA} = \frac{1}{2}\overgroup{AC}$. Every inscribed angle is in one of the three cases, so the theorem is proved.`,
        },
        {
          kind: "key",
          title: "Consequences",
          body: md`- **Same arc, same angle.** Inscribed angles that intercept the same arc are congruent: each is half of that arc.
- **Thales' Theorem.** An angle inscribed in a semicircle is a right angle: its arc is $180^\circ$.
- **Inscribed quadrilaterals.** If all four vertices of a quadrilateral lie on a circle, its opposite angles are supplementary.`,
        },
        { kind: "diagram", ...thalesDiagram },
        { kind: "diagram", ...quadDiagram },
        {
          kind: "proof",
          title: "Opposite angles of an inscribed quadrilateral",
          given: md`Quadrilateral $ABCD$ is inscribed in a circle`,
          prove: md`$\angle A + \angle C = 180^\circ$`,
          steps: [
            { statement: md`$\angle A = \frac{1}{2}\overgroup{BCD}$ and $\angle C = \frac{1}{2}\overgroup{DAB}$`, reason: "Inscribed Angle Theorem" },
            { statement: md`$\overgroup{BCD} + \overgroup{DAB} = 360^\circ$`, reason: md`Arc Addition: the two arcs share only $B$ and $D$ and fill the circle` },
            { statement: md`$\angle A + \angle C = \frac{1}{2}(\overgroup{BCD} + \overgroup{DAB})$`, reason: "Addition Property of Equality, then the Distributive Property" },
            { statement: md`$\angle A + \angle C = \frac{1}{2}(360^\circ) = 180^\circ$`, reason: "Substitution" },
          ],
        },
        {
          kind: "example",
          title: "Angles of an inscribed quadrilateral from its arcs",
          problem: md`$A$, $B$, $C$, $D$ lie on a circle in that order, with $\overgroup{AB} = 80^\circ$, $\overgroup{BC} = 90^\circ$ and $\overgroup{CD} = 120^\circ$. Find $\angle ABC$ and $\angle ADC$.`,
          steps: [
            { math: md`\overgroup{DA} = 360^\circ - 80^\circ - 90^\circ - 120^\circ = 70^\circ`, note: "The four arcs fill the circle." },
            { math: md`\angle ABC = \tfrac{1}{2}(\overgroup{CD} + \overgroup{DA}) = \tfrac{1}{2}(190^\circ) = 95^\circ`, note: md`$\angle ABC$ opens onto the arc from $C$ through $D$ to $A$.` },
            { math: md`\angle ADC = \tfrac{1}{2}(\overgroup{AB} + \overgroup{BC}) = \tfrac{1}{2}(170^\circ) = 85^\circ`, note: md`$\angle ADC$ opens onto the arc through $B$.` },
            { math: md`95^\circ + 85^\circ = 180^\circ \;\checkmark`, note: "Opposite angles are supplementary, as proved." },
          ],
        },
        {
          kind: "check",
          prompt: md`An inscribed angle intercepts an arc of $136^\circ$. Find the angle. Give the angle in degrees.`,
          answer: "68",
          explain: md`Half of $136^\circ$ is $68^\circ$.`,
        },
        {
          kind: "check",
          prompt: md`$\overline{AB}$ is a diameter of a circle and $C$ is on the circle, with $\angle CAB = 35^\circ$. Find $\angle CBA$. Give the angle in degrees.`,
          answer: "55",
          explain: md`By Thales, $\angle ACB = 90^\circ$. The angles of the triangle add to $180^\circ$, so $\angle CBA = 180 - 90 - 35 = 55$.`,
        },
      ],
      practice: [inscribedBasics, inscribedQuadrilateral, inscribedAlgebra].map(degreeWords),
    },
    {
      id: "tangents-and-chords",
      title: "Tangents and chords",
      summary: "Why a tangent is perpendicular to the radius, why tangent segments from one point are equal, and where the center sits relative to every chord.",
      blocks: [
        {
          kind: "text",
          body: md`A line and a circle can meet in two points, one point, or none. A line that meets the circle in two points is a **secant**. A line that meets it in exactly one point is a **tangent**, and that point is the **point of tangency**. A **tangent segment** runs from an outside point to the point of tangency.`,
        },
        { kind: "diagram", ...linesDiagram },
        {
          kind: "key",
          title: "Tangent and radius",
          body: md`- A tangent line is perpendicular to the radius at the point of tangency.
- Conversely, a line through a point of the circle that is perpendicular to the radius there is a tangent.`,
        },
        {
          kind: "why",
          title: "Why the perpendicular line touches only once",
          body: md`Start with the converse. Let line $\ell$ be perpendicular to $\overline{OT}$ at $T$, and let $P$ be any other point of $\ell$. Then $\triangle OTP$ has a right angle at $T$. The other two angles share the remaining $90^\circ$, so the right angle is the largest, and the larger side is opposite the larger angle (Unit 3). So the hypotenuse $\overline{OP}$ is the longest side: $OP > OT = r$.

Every point of $\ell$ except $T$ is farther than $r$ from $O$, so it is outside the circle. The line meets the circle only at $T$: it is a tangent.`,
        },
        {
          kind: "text",
          body: md`The main direction is proved **indirectly**, as in Unit 3: assume the opposite, and show it leads to something impossible. The proof also uses the fact that from a point not on a line there is only one perpendicular to that line. Two would make a triangle with two right angles, more than the $180^\circ$ the Triangle Angle Sum Theorem allows.`,
        },
        { kind: "diagram", ...tangentProofDiagram },
        {
          kind: "proof",
          title: "A tangent is perpendicular to the radius",
          given: md`Line $\ell$ is tangent to circle $O$ at $T$`,
          prove: md`$\ell \perp \overline{OT}$`,
          steps: [
            { statement: md`Suppose $\ell$ is not perpendicular to $\overline{OT}$.`, reason: "Assumption, to be shown impossible" },
            { statement: md`Let $F$ be the point of $\ell$ with $\overline{OF} \perp \ell$. Then $F \ne T$.`, reason: md`There is exactly one perpendicular from $O$ to $\ell$, and by step 1 it isn't $\overline{OT}$` },
            { statement: md`Choose $T'$ on $\ell$, on the other side of $F$ from $T$, with $FT' = FT$.`, reason: "Ruler Postulate" },
            { statement: md`$\angle OFT = \angle OFT' = 90^\circ$ and $OF = OF$`, reason: "Definition of perpendicular; Reflexive Property" },
            { statement: md`$\triangle OFT \cong \triangle OFT'$`, reason: "SAS" },
            { statement: md`$OT' = OT = r$`, reason: "CPCTC" },
            { statement: md`$T'$ is a second point of $\ell$ on the circle.`, reason: md`Definition of a circle: $T'$ is $r$ from $O$, and $T' \ne T$` },
            { statement: md`So $\ell \perp \overline{OT}$.`, reason: md`Step 7 contradicts "$\ell$ is tangent", so the assumption in step 1 is false` },
          ],
        },
        { kind: "diagram", ...tangentSegmentsDiagram },
        {
          kind: "proof",
          title: "Tangent segments from one point are congruent",
          given: md`$\overline{PA}$ and $\overline{PB}$ are tangent to circle $O$ at $A$ and $B$`,
          prove: md`$PA = PB$`,
          steps: [
            { statement: md`$\angle OAP = \angle OBP = 90^\circ$`, reason: "A tangent is perpendicular to the radius" },
            { statement: md`$OA = OB$`, reason: "Radii of the same circle" },
            { statement: md`$OP = OP$`, reason: "Reflexive Property" },
            { statement: md`$\triangle OAP \cong \triangle OBP$`, reason: md`HL: hypotenuse $\overline{OP}$ and legs $\overline{OA}$, $\overline{OB}$` },
            { statement: md`$PA = PB$`, reason: "CPCTC" },
          ],
        },
        {
          kind: "example",
          title: "A tangent and the Pythagorean Theorem",
          problem: md`$\overline{PA}$ is tangent to circle $O$ at $A$. The radius is 5 and $PA = 12$. How far is $P$ from the center, and from the nearest point of the circle?`,
          steps: [
            { math: md`\angle OAP = 90^\circ`, note: "Tangent is perpendicular to the radius." },
            { math: md`OP^2 = 5^2 + 12^2 = 169`, note: md`Pythagorean Theorem, with $\overline{OP}$ as the hypotenuse.` },
            { math: md`OP = 13`, note: "" },
            { math: md`13 - 5 = 8`, note: md`For any point $X$ on the circle, $PX + XO \ge PO$ (Triangle Inequality, with equality when $X$ is on $\overline{OP}$), so $PX \ge 13 - 5 = 8$. The point where $\overline{OP}$ crosses the circle is exactly 8 from $P$, so it is the nearest.` },
          ],
        },
        {
          kind: "key",
          title: "Chords and the center",
          body: md`- A line through the center perpendicular to a chord bisects the chord.
- The perpendicular bisector of any chord passes through the center.
- If a chord of length $c$ is at distance $d$ from the center (measured along the perpendicular), then $d^2 + \left(\frac{c}{2}\right)^2 = r^2$.
- **Crossing chords:** if chords $\overline{AB}$ and $\overline{CD}$ meet at $E$, then $AE \cdot EB = CE \cdot ED$.`,
        },
        { kind: "diagram", ...chordDiagram },
        {
          kind: "proof",
          title: "The perpendicular from the center bisects a chord",
          given: md`$\overline{AB}$ is a chord of circle $O$, and $\overline{OM} \perp \overline{AB}$ at $M$`,
          prove: md`$AM = MB$`,
          steps: [
            { statement: md`$\angle OMA = \angle OMB = 90^\circ$`, reason: "Definition of perpendicular" },
            { statement: md`$OA = OB$`, reason: "Radii of the same circle" },
            { statement: md`$OM = OM$`, reason: "Reflexive Property" },
            { statement: md`$\triangle OMA \cong \triangle OMB$`, reason: "HL" },
            { statement: md`$AM = MB$`, reason: "CPCTC" },
          ],
        },
        {
          kind: "why",
          title: "Why the perpendicular bisector of a chord hits the center",
          body: md`Let $M$ be the midpoint of chord $\overline{AB}$. Then $OA = OB$ (radii), $AM = BM$ (midpoint) and $OM = OM$, so $\triangle OMA \cong \triangle OMB$ by SSS. By CPCTC, $\angle OMA = \angle OMB$. They also form a linear pair, so each is $90^\circ$. So $\overleftrightarrow{OM}$ is the line through $M$ perpendicular to $\overline{AB}$: the perpendicular bisector, and it contains $O$.

This gives a way to find a lost center: draw two chords, then their perpendicular bisectors. Both pass through the center, so they cross there. The right triangle $OMA$ is also where $d^2 + \left(\frac{c}{2}\right)^2 = r^2$ comes from.`,
        },
        { kind: "diagram", ...crossingChordsDiagram },
        {
          kind: "why",
          title: "Why crossing chords multiply the same",
          body: md`Chords $\overline{AB}$ and $\overline{CD}$ cross at $E$. The inscribed angles $\angle CAB$ and $\angle CDB$ intercept the same arc $\overgroup{CB}$, so they are equal. The angles $\angle AEC$ and $\angle DEB$ are vertical angles, so they are equal too. That's two pairs of angles, so $\triangle AEC \sim \triangle DEB$ by AA Similarity (Unit 4).

Corresponding sides are proportional: $\frac{AE}{DE} = \frac{CE}{BE}$. Cross-multiply: $AE \cdot EB = CE \cdot ED$.`,
        },
        {
          kind: "example",
          title: "How far is a chord from the center?",
          problem: md`A circle has radius 10, and a chord has length 16. How far is the chord from the center?`,
          steps: [
            { math: md`\tfrac{c}{2} = 8`, note: "The perpendicular from the center splits the chord into two halves of 8." },
            { math: md`d^2 + 8^2 = 10^2`, note: "Right triangle: distance, half-chord, radius." },
            { math: md`d^2 = 36 \;\Rightarrow\; d = 6`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`$\overline{PA}$ is tangent to circle $O$ at $A$. The radius is 8 and $PA = 15$. Find $OP$.`,
          answer: "17",
          explain: md`$\angle OAP = 90^\circ$, so $OP^2 = 8^2 + 15^2 = 289$ and $OP = 17$.`,
        },
        {
          kind: "check",
          prompt: md`Chords $\overline{AB}$ and $\overline{CD}$ cross at $E$, with $AE = 4$, $EB = 9$ and $CE = 6$. Find $ED$.`,
          answer: "6",
          explain: md`$AE \cdot EB = CE \cdot ED$, so $36 = 6 \cdot ED$ and $ED = 6$.`,
        },
      ],
      practice: [tangentRadius, tangentSegments, chordFacts].map(degreeWords),
    },
    {
      id: "equations-of-circles",
      title: "Equations of circles",
      summary: "From the Distance Formula to (x − h)² + (y − k)² = r², and back from an expanded equation by completing the square.",
      blocks: [
        {
          kind: "text",
          body: md`On a coordinate plane, the circle with center $(h, k)$ and radius $r$ is the set of all points $(x, y)$ whose distance from $(h, k)$ is $r$. That is the definition from the first lesson, word for word. The Distance Formula from Unit 5 turns the sentence into an equation.`,
        },
        { kind: "diagram", ...circleEquationDiagram },
        {
          kind: "why",
          title: "Deriving the equation",
          body: md`The distance from $(x, y)$ to $(h, k)$ is $r$:

$$\sqrt{(x - h)^2 + (y - k)^2} = r.$$

Square both sides:

$$(x - h)^2 + (y - k)^2 = r^2.$$

Squaring can sometimes add false solutions, but not here. Both sides of the first equation are non-negative, and for non-negative $a$ and $b$, $a^2 = b^2$ forces $a = b$: from $(a - b)(a + b) = 0$, either $a = b$ or $a + b = 0$, and the second means both are 0. So the two equations have exactly the same solutions.`,
        },
        {
          kind: "key",
          title: "Standard form of a circle",
          body: md`$$(x - h)^2 + (y - k)^2 = r^2$$

- The center is $(h, k)$ and the radius is $r$. The right side is $r^2$, not $r$.
- A circle centered at the origin is $x^2 + y^2 = r^2$.`,
        },
        {
          kind: "why",
          title: "Why the signs look backward",
          body: md`In $(x - 3)^2 + (y + 2)^2 = 25$, the center is $(3, -2)$, not $(-3, 2)$. Write $y + 2$ as $y - (-2)$ and it matches $y - k$ with $k = -2$.

Or think about what the center *does*: it is the one point at distance 0, so it makes both squares zero. $x - 3 = 0$ at $x = 3$, and $y + 2 = 0$ at $y = -2$.`,
        },
        {
          kind: "example",
          title: "Reading the center and radius",
          problem: md`Find the center and radius of $(x + 1)^2 + (y - 4)^2 = 20$.`,
          steps: [
            { math: md`(x - (-1))^2 + (y - 4)^2 = 20`, note: md`Match $(x - h)^2 + (y - k)^2 = r^2$.` },
            { math: md`(h, k) = (-1, 4)`, note: "The center." },
            { math: md`r = \sqrt{20} = \sqrt{4}\sqrt{5} = 2\sqrt{5}`, note: md`$r^2 = 20$. Simplify the root, as in Algebra 1.` },
          ],
        },
        {
          kind: "example",
          title: "Writing the equation from a center and a point",
          problem: md`Write the equation of the circle with center $(3, -2)$ that passes through $(6, 2)$.`,
          steps: [
            { math: md`r^2 = (6 - 3)^2 + (2 - (-2))^2 = 9 + 16 = 25`, note: "The radius is the distance from the center to a point on the circle. We only need its square." },
            { math: md`(x - 3)^2 + (y + 2)^2 = 25`, note: "Substitute into standard form." },
          ],
        },
        { kind: "diagram", ...exampleCircleDiagram },
        {
          kind: "text",
          body: md`The left side, $(x - h)^2 + (y - k)^2$, is the squared distance from the center to $(x, y)$. So it also tells you where any point is: if it comes out less than $r^2$ the point is **inside** the circle, equal means **on** it, and greater means **outside**.

Substituting also finds where a circle meets a line. For $(x - 3)^2 + (y + 2)^2 = 25$ and the line $y = 2$: $(x - 3)^2 + 16 = 25$, so $(x - 3)^2 = 9$, $x - 3 = \pm 3$, and the points are $(6, 2)$ and $(0, 2)$.`,
        },
        {
          kind: "text",
          body: md`Multiply out standard form and you get something like

$$x^2 + y^2 - 6x + 4y - 12 = 0.$$

The center and radius are hidden now. To find them, run the expansion backward by **completing the square** (Algebra 1, Unit 8), once in $x$ and once in $y$.`,
        },
        {
          kind: "example",
          title: "Completing the square twice",
          problem: md`Find the center and radius of $x^2 + y^2 - 6x + 4y - 12 = 0$.`,
          steps: [
            { math: md`(x^2 - 6x) + (y^2 + 4y) = 12`, note: "Group the x-terms and the y-terms, and move the constant across." },
            { math: md`(x^2 - 6x + 9) + (y^2 + 4y + 4) = 12 + 9 + 4`, note: md`Half of $-6$ is $-3$, squared 9. Half of $4$ is $2$, squared 4. Add both to **both** sides.` },
            { math: md`(x - 3)^2 + (y + 2)^2 = 25`, note: "Each group is a perfect square." },
            { math: md`\text{center } (3, -2), \quad r = 5`, note: "Read them off standard form." },
          ],
        },
        {
          kind: "why",
          title: "Why it always works, and when it isn't a circle",
          body: md`The $x$-terms and the $y$-terms never mix, so each can be completed on its own, exactly as in Algebra 1: $x^2 + bx + \left(\frac{b}{2}\right)^2 = \left(x + \frac{b}{2}\right)^2$. Whatever you add to the left, add to the right, and the equation keeps the same solutions.

At the end the right side must be positive to be $r^2$. If it comes out 0, only the center satisfies the equation (a sum of two squares is 0 only when both are 0), so the "circle" is a single point. If it is negative there are no points at all, since a sum of squares can't be negative. If $x^2$ and $y^2$ have a coefficient like 2, divide every term by it first.`,
        },
        {
          kind: "check",
          prompt: md`Find the center of $(x - 5)^2 + (y + 1)^2 = 49$. Give the point as (x, y).`,
          answer: "(5, -1)",
          form: "tuple",
          explain: md`$y + 1 = y - (-1)$, so the center is $(5, -1)$. (The radius is 7.)`,
        },
        {
          kind: "check",
          prompt: md`Find the radius of $x^2 + y^2 + 8x - 2y + 8 = 0$.`,
          answer: "3",
          explain: md`$(x^2 + 8x + 16) + (y^2 - 2y + 1) = -8 + 16 + 1$, so $(x + 4)^2 + (y - 1)^2 = 9$ and $r = 3$.`,
        },
      ],
      practice: [readCircle, circleData, generalForm],
    },
  ],
};
