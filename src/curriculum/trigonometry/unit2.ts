import { gcd, type Rng } from "../../math/random";
import { md, slug, type DiagramSpec, type Generator, type Step, type Unit } from "../types";

// ── Shared wording ──────────────────────────────────────────────────────────

const EXACT = md`Give an exact answer in lowest terms (type $\frac{3}{5}$ as 3/5 and $\frac{2\sqrt{5}}{5}$ as 2sqrt(5)/5).`;
const ROUND = "Round to 1 decimal place and type the number.";
const DEG1 = "Give the angle in degrees, rounded to 1 decimal place.";

const RAD = Math.PI / 180;
const deg = (v: number | string) => md`${v}^\circ`;
const dp = (v: number, places: number) => v.toFixed(places);
const sinD = (t: number) => Math.sin(t * RAD);
const cosD = (t: number) => Math.cos(t * RAD);
const tanD = (t: number) => Math.tan(t * RAD);

// ── Exact lengths and ratios ────────────────────────────────────────────────

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

/** num·√rad / den in simplest form: reduced, radical simplified, no root underneath. */
function surdRatio(num: number, rad: number, den: number): { text: string; tex: string; v: number } {
  const [k, m] = surd(rad);
  let n = num * k;
  let d = den;
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  [n, d] = [n / g, d / g];
  const v = (n * Math.sqrt(m)) / d;
  const lead = n === 1 ? "" : n === -1 ? "-" : String(n);
  const top = m === 1 ? String(n) : `${lead}sqrt(${m})`;
  const topTex = m === 1 ? String(n) : md`${lead}\sqrt{${m}}`;
  if (d === 1) return { text: top, tex: topTex, v };
  return { text: `${top}/${d}`, tex: md`\frac{${topTex}}{${d}}`, v };
}

/** A side length n·√m (m square-free) as a number, answer text and LaTeX. */
interface Len {
  v: number;
  n: number;
  m: number;
  text: string;
  tex: string;
}

function len(n: number, rad = 1): Len {
  const [k, m] = surd(rad);
  const c = n * k;
  const v = c * Math.sqrt(m);
  if (m === 1) return { v, n: c, m, text: String(c), tex: String(c) };
  const lead = c === 1 ? "" : String(c);
  return { v, n: c, m, text: `${lead}sqrt(${m})`, tex: md`${lead}\sqrt{${m}}` };
}

/** p/q in simplest exact form. */
const ratio = (p: Len, q: Len) => surdRatio(p.n, p.m * q.m, q.n * q.m);

/** The sides of a right triangle from one acute angle's point of view. */
type Role = "opp" | "adj" | "hyp";
type Sides = Record<Role, Len>;

type Fn = "sin" | "cos" | "tan" | "csc" | "sec" | "cot";
const FN_TEX: Record<Fn, string> = { sin: "\\sin", cos: "\\cos", tan: "\\tan", csc: "\\csc", sec: "\\sec", cot: "\\cot" };
const RATIO: Record<Fn, [Role, Role]> = { sin: ["opp", "hyp"], cos: ["adj", "hyp"], tan: ["opp", "adj"], csc: ["hyp", "opp"], sec: ["hyp", "adj"], cot: ["adj", "opp"] };
const ROLE_TEX: Record<Role, string> = { opp: "\\text{opp}", adj: "\\text{adj}", hyp: "\\text{hyp}" };
const ROLE_WORD: Record<Role, string> = { opp: "opposite", adj: "adjacent", hyp: "hypotenuse" };
const RECIPROCAL: Record<Fn, Fn> = { sin: "csc", cos: "sec", tan: "cot", csc: "sin", sec: "cos", cot: "tan" };

/** The ratio for fn as (unreduced LaTeX, simplest form). */
function ratioFor(fn: Fn, s: Sides) {
  const [a, b] = RATIO[fn];
  const value = ratio(s[a], s[b]);
  const raw = md`\frac{${s[a].tex}}{${s[b].tex}}`;
  return { value, raw, word: md`\frac{${ROLE_TEX[a]}}{${ROLE_TEX[b]}}`, sameAsRaw: raw === value.tex };
}

const par = (l: Len) => `(${l.text})`;

/**
 * A hidden equation the ratio for fn must satisfy: a Pythagorean identity in the other sides,
 * so a mixed-up leg fails it. Each fixes x^2, and the key is positive.
 */
function identityFor(fn: Fn, s: Sides): string {
  switch (fn) {
    case "sin":
      return `x^2 + (${par(s.adj)}/${par(s.hyp)})^2 = 1`;
    case "cos":
      return `x^2 + (${par(s.opp)}/${par(s.hyp)})^2 = 1`;
    case "tan":
      return `1 + x^2 = (${par(s.hyp)}/${par(s.adj)})^2`;
    case "csc":
      return `x^2 = 1 + (${par(s.adj)}/${par(s.opp)})^2`;
    case "sec":
      return `x^2 = 1 + (${par(s.opp)}/${par(s.adj)})^2`;
    case "cot":
      return `1 + x^2 = (${par(s.hyp)}/${par(s.opp)})^2`;
  }
}

/** Why the simplest form differs from the raw fraction. */
function simplifyNote(raw: Len, under: Len): string {
  if (under.m !== 1) {
    // After rationalizing, the fraction is raw.n·√(raw.m·under.m) over under.n·under.m; does it still reduce?
    const g = gcd(raw.n * surd(raw.m * under.m)[0], under.n * under.m);
    return md`Rationalize: multiply top and bottom by $\sqrt{${under.m}}$${g > 1 ? `, then divide top and bottom by ${g}` : ""}.`;
  }
  if (raw.m !== 1) return "Reduce the fraction.";
  return md`Reduce: both numbers divide by ${gcd(raw.n, under.n)}.`;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "the hypotenuse", "the opposite side", "the adjacent side". */
const roleSide = (role: Role) => (role === "hyp" ? "the hypotenuse" : `the ${ROLE_WORD[role]} side`);

/** The Pythagorean step c = sqrt(p^2 + q^2), or a leg from the hypotenuse, without a redundant last equality. */
function pythTex(result: Len, lhs: string, p: Len, q: Len, subtract: boolean): string {
  const inside = subtract ? p.v * p.v - q.v * q.v : p.v * p.v + q.v * q.v;
  const root = md`\sqrt{${inside}}`;
  return md`${lhs} = \sqrt{${p.tex}^2 ${subtract ? "-" : "+"} ${q.tex}^2} = ${root}${result.tex === root ? "" : ` = ${result.tex}`}`;
}

// Right triangles with whole sides. The first group is primitive; the rest need reducing.
const PRIMITIVE: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [20, 21, 29],
];
const TRIPLES: [number, number, number][] = [...PRIMITIVE, [6, 8, 10], [9, 12, 15], [10, 24, 26], [12, 16, 20], [15, 20, 25]];
/** Legs whose hypotenuse is irrational, with the triangle still wide enough to draw. */
const SURD_LEGS: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 1],
  [2, 5],
  [3, 5],
  [4, 5],
  [3, 7],
];

/** Sides for angle A from a horizontal leg w (adjacent to A) and vertical leg h (opposite A). */
function sidesFor(corner: "A" | "B", w: Len, h: Len, hyp: Len): Sides {
  return corner === "A" ? { opp: h, adj: w, hyp } : { opp: w, adj: h, hyp };
}

// ── Diagram helpers ─────────────────────────────────────────────────────────

type Pt = { x: number; y: number };
type DLabel = NonNullable<DiagramSpec["labels"]>[number];
type DAngle = NonNullable<DiagramSpec["angles"]>[number];
type DSegment = NonNullable<DiagramSpec["segments"]>[number];
type Dir = NonNullable<NonNullable<DiagramSpec["points"]>[number]["dir"]>;
type Diagram = { kind: "diagram" } & DiagramSpec;

const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Pixels per diagram unit (Diagram.tsx draws a view into about 516 × 556 px). */
const ppu = ([x0, x1, y0, y1]: DiagramSpec["view"]) => Math.min(516 / (x1 - x0), 556 / (y1 - y0));

/** A free label for the angle at v between the rays to p and q, far enough along the bisector to clear both rays. */
function angleLabel(v: Pt, p: Pt, q: Pt, text: string, px: number): DLabel {
  const unit = (a: Pt): Pt => {
    const n = Math.hypot(a.x, a.y);
    return { x: a.x / n, y: a.y / n };
  };
  const u = unit({ x: p.x - v.x, y: p.y - v.y });
  const w = unit({ x: q.x - v.x, y: q.y - v.y });
  const b = unit({ x: u.x + w.x, y: u.y + w.y });
  const half = Math.acos(Math.max(-1, Math.min(1, u.x * w.x + u.y * w.y))) / 2;
  const chars = text.replace(/\\[a-zA-Z]+/g, "o").replace(/[{}^]/g, "").length;
  const d = Math.max(36, (3.7 * chars + 5) / Math.sin(half)) / px;
  return { x: r3(v.x + b.x * d), y: r3(v.y + b.y * d), text };
}

type Side = "AC" | "BC" | "AB";
type Corner = "A" | "B";
interface TriOpts {
  /** Horizontal leg AC and vertical leg BC, in real units; the figure is drawn to scale. */
  w: number;
  h: number;
  sides?: Partial<Record<Side, string>>;
  angles?: Partial<Record<Corner, string>>;
  /** The unknown, drawn in orange. */
  ask?: Side | Corner;
  dashed?: Side[];
  /** Put the right angle at the bottom left instead of the bottom right. */
  mirror?: boolean;
}

const SIZE = 6;
const PAD = 0.9;

/** Right triangle ABC with the right angle at C: A bottom left, C bottom right, B above C. */
function rightTriangle(o: TriOpts): Diagram {
  const k = SIZE / Math.max(o.w, o.h);
  const W = r3(o.w * k);
  const H = r3(o.h * k);
  const mx = (x: number) => (o.mirror ? r3(W - x) : x);
  const P: Record<"A" | "B" | "C", Pt> = { A: { x: mx(0), y: 0 }, C: { x: mx(W), y: 0 }, B: { x: mx(W), y: H } };
  const view: DiagramSpec["view"] = [-PAD, W + PAD, -PAD, H + PAD];
  const px = ppu(view);
  const asked = (s: string) => (o.ask === s ? { color: 2 as const } : {});
  const segments: DSegment[] = (["AC", "BC", "AB"] as Side[]).map((s) => ({
    from: s[0]!,
    to: s[1]!,
    ...(o.sides?.[s] ? { label: o.sides[s] } : {}),
    ...(o.dashed?.includes(s) ? { dashed: true } : {}),
    ...asked(s),
  }));
  const angles: DAngle[] = [{ at: "C", from: "A", to: "B", right: true }];
  const labels: DLabel[] = [];
  for (const c of ["A", "B"] as Corner[]) {
    const text = o.angles?.[c];
    if (text === undefined && o.ask !== c) continue;
    const [from, to] = c === "A" ? (["C", "B"] as const) : (["A", "C"] as const);
    const ang: DAngle = { at: c, from, to, ...asked(c) };
    if (o.ask === c) {
      if (text) ang.label = text;
    } else labels.push(angleLabel(P[c], P[from], P[to], text!, px));
    angles.push(ang);
  }
  const dirs: Record<"A" | "B" | "C", Dir> = o.mirror ? { A: "se", C: "sw", B: "nw" } : { A: "sw", C: "se", B: "ne" };
  return {
    kind: "diagram",
    view,
    points: (["A", "C", "B"] as const).map((n) => ({ name: n, x: P[n].x, y: P[n].y, dir: dirs[n] })),
    segments,
    angles,
    ...(labels.length ? { labels } : {}),
  };
}

const metres = (v: number) => md`${v}\,\text{m}`;

// ── Lesson 1 generators ─────────────────────────────────────────────────────

/** A ratio of the sides of a drawn right triangle, exact. Shared by Lessons 1 and 3. */
function triangleRatioGen(fns: Fn[]): Generator {
  return (r) => {
    const kind = r.int(0, 2);
    const fn = r.pick(fns);
    const corner = r.pick(["A", "B"] as const);
    let w: Len;
    let h: Len;
    let hyp: Len;
    if (kind < 2) {
      const [p, q, c] = r.pick(TRIPLES);
      [w, h] = r.next() < 0.5 ? [len(p), len(q)] : [len(q), len(p)];
      hyp = len(c);
    } else {
      const [p, q] = r.pick(SURD_LEGS);
      [w, h] = r.next() < 0.5 ? [len(p), len(q)] : [len(q), len(p)];
      hyp = len(1, p * p + q * q);
    }
    const shown: Side[] = kind === 0 ? ["AC", "BC", "AB"] : kind === 1 ? r.pick([["AC", "BC"], ["AC", "AB"], ["BC", "AB"]] as Side[][]) : ["AC", "BC"];
    const lengths: Record<Side, Len> = { AC: w, BC: h, AB: hyp };
    const s = sidesFor(corner, w, h, hyp);
    const { value, raw, word, sameAsRaw } = ratioFor(fn, s);
    const [numRole, denRole] = RATIO[fn];
    const sideName: Record<Role, string> = corner === "A" ? { opp: "BC", adj: "AC", hyp: "AB" } : { opp: "AC", adj: "BC", hyp: "AB" };

    const steps: Step[] = [];
    const missing = (["AC", "BC", "AB"] as Side[]).find((side) => !shown.includes(side));
    if (missing === "AB") {
      steps.push({
        math: pythTex(hyp, "AB", w, h, false),
        note: md`The hypotenuse isn't given, so find it first with the Pythagorean Theorem.${hyp.m !== 1 ? ` $\\sqrt{${w.v * w.v + h.v * h.v}}$ doesn't simplify to a whole number${hyp.n !== 1 ? `, but $${w.v * w.v + h.v * h.v} = ${hyp.n * hyp.n} \\cdot ${hyp.m}$, so it is $${hyp.tex}$` : ""}.` : ""}`,
      });
    } else if (missing) {
      const other = missing === "AC" ? h : w;
      steps.push({
        math: pythTex(lengths[missing], missing, hyp, other, true),
        note: md`A leg is missing. From $a^2 + b^2 = c^2$, the leg is $\sqrt{c^2 - (\text{other leg})^2}$.`,
      });
    }
    steps.push({
      math: md`\text{opp} = ${sideName.opp} = ${s.opp.tex}, \quad \text{adj} = ${sideName.adj} = ${s.adj.tex}, \quad \text{hyp} = AB = ${s.hyp.tex}`,
      note: md`Name the sides from angle $${corner}$'s point of view. The hypotenuse is always $AB$, opposite the right angle. The leg that touches $${corner}$ is adjacent; the other leg is opposite.`,
    });
    steps.push({
      math: md`${FN_TEX[fn]} ${corner} = ${word} = ${raw}${sameAsRaw ? "" : ` = ${value.tex}`}`,
      note: sameAsRaw ? md`$${FN_TEX[fn]}$ is ${ROLE_WORD[numRole]} over ${ROLE_WORD[denRole]}.` : simplifyNote(s[numRole], s[denRole]),
    });

    return {
      prompt: md`In the right triangle shown, find $${FN_TEX[fn]} ${corner}$. ${EXACT}`,
      figure: rightTriangle({
        w: w.v,
        h: h.v,
        sides: Object.fromEntries(shown.map((side) => [side, lengths[side].tex])),
        ask: corner,
      }),
      answer: value.text,
      simplified: true,
      verify: [identityFor(fn, s)],
      hint: md`${missing ? "Find the missing side with the Pythagorean Theorem first, then name" : "Name"} the sides from angle $${corner}$'s point of view: $${FN_TEX[fn]}$ is ${ROLE_WORD[numRole]} over ${ROLE_WORD[denRole]}.${s[denRole].m !== 1 ? " Clear the square root from the denominator." : ""}`,
      solution: steps,
    };
  };
}

/** The sides of the special triangles from the given angle's point of view. */
function specialSides(a: 30 | 45 | 60): Sides {
  if (a === 45) return { opp: len(1), adj: len(1), hyp: len(1, 2) };
  if (a === 30) return { opp: len(1), adj: len(1, 3), hyp: len(2) };
  return { opp: len(1, 3), adj: len(1), hyp: len(2) };
}

const triangleName = (a: 30 | 45 | 60) => (a === 45 ? "45-45-90" : "30-60-90");
const triangleSides = (a: 30 | 45 | 60) => (a === 45 ? md`legs $1$ and $1$, hypotenuse $\sqrt{2}$` : md`short leg $1$ (opposite $30^\circ$), long leg $\sqrt{3}$ (opposite $60^\circ$), hypotenuse $2$`);

/** The exact value of a trig function at 30°, 45° or 60°. */
function exactValueProblem(r: Rng, fns: Fn[]) {
  const a = r.pick([30, 45, 60] as const);
  const fn = r.pick(fns);
  const s = specialSides(a);
  const { value, raw, word, sameAsRaw } = ratioFor(fn, s);
  const [numRole, denRole] = RATIO[fn];
  const base = RECIPROCAL[fn];
  const isRecip = fn === "csc" || fn === "sec" || fn === "cot";
  const verify = isRecip ? `x * ${base}(${a} pi/180) = 1` : `x = ${fn}(${a} pi/180)`;
  return {
    prompt: md`Give the exact value of $${FN_TEX[fn]} ${a}^\circ$. ${EXACT}`,
    answer: value.text,
    simplified: true,
    verify: [verify],
    hint: md`Sketch the ${triangleName(a)} triangle (${triangleSides(a)}) and read the ratio off it from the $${a}^\circ$ corner.${isRecip ? md` $${FN_TEX[fn]}$ is $${FN_TEX[base]}$ flipped.` : ""}`,
    solution: [
      {
        math: md`\text{opp} = ${s.opp.tex}, \quad \text{adj} = ${s.adj.tex}, \quad \text{hyp} = ${s.hyp.tex}`,
        note: md`In the ${triangleName(a)} triangle with ${triangleSides(a)}, seen from the $${a}^\circ$ angle.`,
      },
      {
        math: md`${FN_TEX[fn]} ${a}^\circ = ${word} = ${raw}${sameAsRaw ? "" : ` = ${value.tex}`}`,
        note: sameAsRaw ? md`${capital(ROLE_WORD[numRole])} over ${ROLE_WORD[denRole]}.` : simplifyNote(s[numRole], s[denRole]),
      },
    ] as Step[],
  };
}

type SpecialRole = "leg" | "hyp" | "short" | "long";
interface SpecialVariant {
  tri: 30 | 45;
  given: SpecialRole;
  ask: SpecialRole;
  answer: (g: number) => ReturnType<typeof surdRatio>;
  verify: (g: number) => string;
  /** The ratio used and the working, with x the unknown. */
  steps: (g: number, ans: string) => Step[];
}

const SPECIAL_VARIANTS: SpecialVariant[] = [
  {
    tri: 45,
    given: "leg",
    ask: "hyp",
    answer: (g) => surdRatio(g, 2, 1),
    verify: (g) => `x^2 = 2 * ${g}^2`,
    steps: (g, ans) => [
      { math: md`\cos 45^\circ = \frac{${g}}{x}`, note: md`The known leg is adjacent to the $45^\circ$ angle and $x$ is the hypotenuse, so use cosine. (Sine would do just as well: both legs are equal.)` },
      { math: md`x = \frac{${g}}{\cos 45^\circ} = \frac{${g}}{\sqrt{2}/2} = \frac{${2 * g}}{\sqrt{2}}`, note: md`Dividing by $\frac{\sqrt{2}}{2}$ is multiplying by $\frac{2}{\sqrt{2}}$.` },
      { math: md`x = \frac{${2 * g}\sqrt{2}}{2} = ${ans}`, note: md`Rationalize. Check: the hypotenuse of a $45$-$45$-$90$ triangle is the leg times $\sqrt{2}$.` },
    ],
  },
  {
    tri: 45,
    given: "hyp",
    ask: "leg",
    answer: (g) => surdRatio(g, 2, 2),
    verify: (g) => `2 x^2 = ${g}^2`,
    steps: (g, ans) => [
      { math: md`\sin 45^\circ = \frac{x}{${g}}`, note: md`$x$ is opposite the $45^\circ$ angle and ${g} is the hypotenuse.` },
      { math: md`x = ${g} \sin 45^\circ = ${g} \cdot \frac{\sqrt{2}}{2} = ${ans}`, note: md`Check: each leg of a $45$-$45$-$90$ triangle is the hypotenuse divided by $\sqrt{2}$.` },
    ],
  },
  {
    tri: 30,
    given: "short",
    ask: "hyp",
    answer: (g) => surdRatio(2 * g, 1, 1),
    verify: (g) => `${g} / x = sin(30 pi/180)`,
    steps: (g, ans) => [
      { math: md`\sin 30^\circ = \frac{${g}}{x}`, note: md`The short leg is opposite the $30^\circ$ angle, and $x$ is the hypotenuse.` },
      { math: md`x = \frac{${g}}{\sin 30^\circ} = \frac{${g}}{1/2} = ${ans}`, note: "Dividing by one half doubles. The hypotenuse is always twice the short leg." },
    ],
  },
  {
    tri: 30,
    given: "short",
    ask: "long",
    answer: (g) => surdRatio(g, 3, 1),
    verify: (g) => `x / ${g} = tan(60 pi/180)`,
    steps: (g, ans) => [
      { math: md`\tan 60^\circ = \frac{x}{${g}}`, note: md`From the $60^\circ$ angle, $x$ (the long leg) is opposite and the short leg is adjacent.` },
      { math: md`x = ${g} \tan 60^\circ = ${g}\sqrt{3}${ans === md`${g}\sqrt{3}` ? "" : ` = ${ans}`}`, note: "The long leg is the short leg times the square root of 3." },
    ],
  },
  {
    tri: 30,
    given: "hyp",
    ask: "short",
    answer: (g) => surdRatio(g, 1, 2),
    verify: (g) => `x / ${g} = sin(30 pi/180)`,
    steps: (g, ans) => [
      { math: md`\sin 30^\circ = \frac{x}{${g}}`, note: md`$x$ is opposite the $30^\circ$ angle; ${g} is the hypotenuse.` },
      { math: md`x = ${g} \sin 30^\circ = ${g} \cdot \frac{1}{2} = ${ans}`, note: "The short leg is half the hypotenuse." },
    ],
  },
  {
    tri: 30,
    given: "hyp",
    ask: "long",
    answer: (g) => surdRatio(g, 3, 2),
    verify: (g) => `x / ${g} = sin(60 pi/180)`,
    steps: (g, ans) => [
      { math: md`\cos 30^\circ = \frac{x}{${g}}`, note: md`The long leg is adjacent to the $30^\circ$ angle (and opposite the $60^\circ$ one). Either $\cos 30^\circ$ or $\sin 60^\circ$ works.` },
      { math: md`x = ${g} \cos 30^\circ = ${g} \cdot \frac{\sqrt{3}}{2} = ${ans}`, note: "" },
    ],
  },
  {
    tri: 30,
    given: "long",
    ask: "short",
    answer: (g) => surdRatio(g, 3, 3),
    verify: (g) => `x / ${g} = tan(30 pi/180)`,
    steps: (g, ans) => [
      { math: md`\tan 30^\circ = \frac{x}{${g}}`, note: md`From the $30^\circ$ angle, the short leg $x$ is opposite and the long leg is adjacent.` },
      { math: md`x = ${g} \tan 30^\circ = ${g} \cdot \frac{\sqrt{3}}{3} = ${ans}`, note: md`$\tan 30^\circ = \frac{1}{\sqrt{3}} = \frac{\sqrt{3}}{3}$.` },
    ],
  },
  {
    tri: 30,
    given: "long",
    ask: "hyp",
    answer: (g) => surdRatio(2 * g, 3, 3),
    verify: (g) => `${g} / x = cos(30 pi/180)`,
    steps: (g, ans) => [
      { math: md`\cos 30^\circ = \frac{${g}}{x}`, note: md`The long leg is adjacent to the $30^\circ$ angle; $x$ is the hypotenuse.` },
      { math: md`x = \frac{${g}}{\cos 30^\circ} = \frac{${g}}{\sqrt{3}/2} = \frac{${2 * g}}{\sqrt{3}}`, note: md`Dividing by $\frac{\sqrt{3}}{2}$ is multiplying by $\frac{2}{\sqrt{3}}$.` },
      { math: md`x = \frac{${2 * g}\sqrt{3}}{3}${ans === md`\frac{${2 * g}\sqrt{3}}{3}` ? "" : ` = ${ans}`}`, note: "Rationalize the denominator." },
    ],
  },
];

/** A side of a special triangle from one given side, with the figure. */
function specialSideProblem(r: Rng) {
  const variant = r.pick(SPECIAL_VARIANTS);
  const g = variant.tri === 30 && variant.given === "hyp" ? 2 * r.int(2, 9) : r.int(2, 9);
  const ans = variant.answer(g);
  // Real lengths for the figure.
  const base: Record<SpecialRole, number> = { leg: 1, hyp: variant.tri === 45 ? Math.SQRT2 : 2, short: 1, long: Math.sqrt(3) };
  const k = g / base[variant.given];
  let fig: Diagram;
  if (variant.tri === 45) {
    const legSide = r.pick(["AC", "BC"] as Side[]);
    const sideOf: Record<SpecialRole, Side> = { leg: legSide, hyp: "AB", short: legSide, long: legSide };
    fig = rightTriangle({
      w: k,
      h: k,
      sides: { [sideOf[variant.given]]: String(g), [sideOf[variant.ask]]: "x" },
      angles: { A: deg(45) },
      ask: sideOf[variant.ask],
    });
  } else {
    const atA = r.pick([30, 60] as const);
    const sideOf: Record<SpecialRole, Side> = { short: atA === 30 ? "BC" : "AC", long: atA === 30 ? "AC" : "BC", hyp: "AB", leg: "AC" };
    fig = rightTriangle({
      w: k * (atA === 30 ? Math.sqrt(3) : 1),
      h: k * (atA === 30 ? 1 : Math.sqrt(3)),
      sides: { [sideOf[variant.given]]: String(g), [sideOf[variant.ask]]: "x" },
      angles: { A: deg(atA) },
      ask: sideOf[variant.ask],
    });
  }
  const askWord: Record<SpecialRole, string> = { leg: "a leg", hyp: "the hypotenuse", short: "the short leg", long: "the long leg" };
  return {
    prompt: md`The triangle shown is a ${variant.tri === 45 ? "45-45-90" : "30-60-90"} triangle. Find $x$. ${EXACT}`,
    figure: fig,
    answer: ans.text,
    simplified: true,
    verify: [variant.verify(g)],
    hint: md`$x$ is ${askWord[variant.ask]}. Pick the trig ratio that links it to the side you know, and use the exact value from the ${variant.tri === 45 ? "45-45-90" : "30-60-90"} triangle.`,
    solution: variant.steps(g, ans.tex),
  };
}

const exactValues: Generator = (r) => (r.next() < 0.55 ? exactValueProblem(r, ["sin", "cos", "tan"]) : specialSideProblem(r));

/** From one ratio of an acute angle to another, through a reference triangle. Shared by Lessons 1 and 3. */
function fromRatioGen(givens: Fn[], asks: Fn[]): Generator {
  return (r) => {
    const given = r.pick(givens);
    const others = asks.filter((f) => f !== given);
    const ask = r.pick(others);
    const [gNum, gDen] = RATIO[given];
    const legsOnly = gNum !== "hyp" && gDen !== "hyp";
    let opp: Len;
    let adj: Len;
    let hyp: Len;
    if (legsOnly && r.next() < 0.5) {
      const [p, q] = r.pick(SURD_LEGS.filter(([a, b]) => a !== b));
      [opp, adj] = r.next() < 0.5 ? [len(p), len(q)] : [len(q), len(p)];
      hyp = len(1, p * p + q * q);
    } else {
      const [p, q, c] = r.pick(PRIMITIVE);
      [opp, adj] = r.next() < 0.5 ? [len(p), len(q)] : [len(q), len(p)];
      hyp = len(c);
    }
    const s: Sides = { opp, adj, hyp };
    const givenValue = ratio(s[gNum], s[gDen]);
    const { value, raw, word, sameAsRaw } = ratioFor(ask, s);
    const [aNum, aDen] = RATIO[ask];
    const third = (["opp", "adj", "hyp"] as Role[]).find((role) => role !== gNum && role !== gDen)!;
    const [k1, k2] = [gNum, gDen];
    const pyth = third === "hyp" ? pythTex(s.hyp, ROLE_TEX.hyp, s.opp, s.adj, false) : pythTex(s[third], ROLE_TEX[third], s.hyp, s[third === "opp" ? "adj" : "opp"], true);
    const flip = RECIPROCAL[given] === ask;
    return {
      prompt: md`Angle $A$ is acute and $${FN_TEX[given]} A = ${givenValue.tex}$. Find $${FN_TEX[ask]} A$. ${EXACT}`,
      answer: value.text,
      simplified: true,
      verify: [identityFor(ask, s)],
      hint: flip
        ? md`$${FN_TEX[ask]}$ is the reciprocal of $${FN_TEX[given]}$: flip the fraction${aDen !== "hyp" && s[aDen].m !== 1 ? ", then rationalize" : ""}.`
        : md`Draw a right triangle whose ${ROLE_WORD[k1]} and ${ROLE_WORD[k2]} ${k2 === "hyp" ? "" : "sides "}give that ratio. Find the third side with the Pythagorean Theorem, then read off $${FN_TEX[ask]} A$.`,
      solution: [
        {
          math: md`${FN_TEX[given]} A = \frac{${ROLE_TEX[k1]}}{${ROLE_TEX[k2]}} = \frac{${s[k1].tex}}{${s[k2].tex}}`,
          note: md`Any right triangle with this ratio is similar to the one with ${roleSide(k1)} $${s[k1].tex}$ and ${roleSide(k2)} $${s[k2].tex}$, and similar triangles share every ratio. So work in that triangle.`,
        },
        ...(flip ? [] : [{ math: pyth, note: md`The third side, from $a^2 + b^2 = c^2$.` }]),
        {
          math: md`${FN_TEX[ask]} A = ${word} = ${raw}${sameAsRaw ? "" : ` = ${value.tex}`}`,
          note: flip ? md`Flipping $${FN_TEX[given]} A$ swaps top and bottom.${sameAsRaw ? "" : ` ${simplifyNote(s[aNum], s[aDen])}`}` : sameAsRaw ? md`${capital(ROLE_WORD[aNum])} over ${ROLE_WORD[aDen]}.` : simplifyNote(s[aNum], s[aDen]),
        },
      ] as Step[],
    };
  };
}

// ── Lesson 2 generators ─────────────────────────────────────────────────────

const ANGLES = [25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 52, 55, 58, 60, 62, 65];

const findSide: Generator = (r) => {
  const kind = r.int(0, 5);
  const t = r.pick(ANGLES);
  const corner = r.pick(["A", "B"] as const);
  const g = r.int(5, 30);
  // Which ratio, which side is given and which is asked, and the key.
  const spec = [
    { fn: "sin" as Fn, given: "hyp" as Role, ask: "opp" as Role, key: `${g} sin(${t} pi/180)`, value: g * sinD(t), divide: false },
    { fn: "cos" as Fn, given: "hyp" as Role, ask: "adj" as Role, key: `${g} cos(${t} pi/180)`, value: g * cosD(t), divide: false },
    { fn: "tan" as Fn, given: "adj" as Role, ask: "opp" as Role, key: `${g} tan(${t} pi/180)`, value: g * tanD(t), divide: false },
    { fn: "sin" as Fn, given: "opp" as Role, ask: "hyp" as Role, key: `${g} / sin(${t} pi/180)`, value: g / sinD(t), divide: true },
    { fn: "cos" as Fn, given: "adj" as Role, ask: "hyp" as Role, key: `${g} / cos(${t} pi/180)`, value: g / cosD(t), divide: true },
    { fn: "tan" as Fn, given: "opp" as Role, ask: "adj" as Role, key: `${g} / tan(${t} pi/180)`, value: g / tanD(t), divide: true },
  ][kind]!;
  const trig = spec.fn === "sin" ? sinD(t) : spec.fn === "cos" ? cosD(t) : tanD(t);
  // Real lengths from the corner's point of view.
  const hyp = spec.given === "hyp" ? g : spec.ask === "hyp" ? spec.value : Math.hypot(g, spec.value);
  const opp = spec.given === "opp" ? g : spec.ask === "opp" ? spec.value : hyp * sinD(t);
  const adj = spec.given === "adj" ? g : spec.ask === "adj" ? spec.value : hyp * cosD(t);
  const sideName: Record<Role, Side> = corner === "A" ? { opp: "BC", adj: "AC", hyp: "AB" } : { opp: "AC", adj: "BC", hyp: "AB" };
  const [w, h] = corner === "A" ? [adj, opp] : [opp, adj];
  const [numRole, denRole] = RATIO[spec.fn];
  const eq = md`${FN_TEX[spec.fn]} ${t}^\circ = \frac{${numRole === spec.ask ? "x" : g}}{${denRole === spec.ask ? "x" : g}}`;
  const solved = spec.divide ? md`x = \frac{${g}}{${FN_TEX[spec.fn]} ${t}^\circ}` : md`x = ${g} ${FN_TEX[spec.fn]} ${t}^\circ`;
  const numeric = spec.divide ? md`x \approx \frac{${g}}{${dp(trig, 4)}} \approx ${dp(spec.value, 1)}` : md`x \approx ${g}(${dp(trig, 4)}) \approx ${dp(spec.value, 1)}`;
  return {
    prompt: md`Find $x$ in the right triangle shown. ${ROUND}`,
    figure: rightTriangle({
      w,
      h,
      sides: { [sideName[spec.given]]: String(g), [sideName[spec.ask]]: "x" },
      angles: { [corner]: deg(t) },
      ask: sideName[spec.ask],
    }),
    answer: spec.key,
    tolerance: 0.05,
    verify: [spec.divide ? `${g} / x = ${spec.fn}(${t} pi/180)` : `x / ${g} = ${spec.fn}(${t} pi/180)`],
    hint: md`From the $${t}^\circ$ angle, $x$ is ${roleSide(spec.ask)} and ${g} is ${roleSide(spec.given)}. Only one of sine, cosine and tangent uses exactly those two.`,
    solution: [
      { math: eq, note: md`From the $${t}^\circ$ angle: $x$ is ${roleSide(spec.ask)}, $${g}$ is ${roleSide(spec.given)}. $${FN_TEX[spec.fn]}$ is ${ROLE_WORD[numRole]} over ${ROLE_WORD[denRole]}.` },
      {
        math: solved,
        note: spec.divide ? md`$x$ is underneath. Multiply both sides by $x$, then divide both sides by $${FN_TEX[spec.fn]} ${t}^\circ$.` : md`Multiply both sides by ${g}.`,
      },
      {
        math: numeric,
        note: md`$${FN_TEX[spec.fn]} ${t}^\circ \approx ${dp(trig, 4)}$ (calculator in degree mode). Round only at the end.${spec.ask === "hyp" ? " The hypotenuse came out longer than the leg, as it must." : ""}`,
      },
    ],
  };
};

const findAngle: Generator = (r) => {
  const kind = r.int(0, 1);
  const corner = r.pick(["A", "B"] as const);
  let w: number;
  let h: number;
  let fn: Fn;
  let num: number;
  let den: number;
  if (kind === 0) {
    // Two legs: tangent.
    do {
      w = r.int(3, 20);
      h = r.int(3, 20);
    } while (h / w < 0.45 || h / w > 2.2);
    fn = "tan";
    [num, den] = corner === "A" ? [h, w] : [w, h];
  } else {
    // A leg and the hypotenuse: sine or cosine.
    let c: number;
    let a: number;
    do {
      c = r.int(6, 30);
      a = r.int(3, 28);
    } while (a >= c || a / c < 0.42 || a / c > 0.91);
    const b = Math.sqrt(c * c - a * a);
    // a is the vertical leg BC or the horizontal leg AC.
    const vertical = r.next() < 0.5;
    [w, h] = vertical ? [b, a] : [a, b];
    const oppositeCorner = vertical ? "A" : "B";
    fn = corner === oppositeCorner ? "sin" : "cos";
    [num, den] = [a, c];
  }
  const sideName: Record<Role, Side> = corner === "A" ? { opp: "BC", adj: "AC", hyp: "AB" } : { opp: "AC", adj: "BC", hyp: "AB" };
  const [numRole, denRole] = RATIO[fn];
  const inverse = fn === "tan" ? "atan" : fn === "sin" ? "asin" : "acos";
  const value = (fn === "tan" ? Math.atan(num / den) : fn === "sin" ? Math.asin(num / den) : Math.acos(num / den)) / RAD;
  const shown: Partial<Record<Side, string>> = { [sideName[numRole]]: String(num), [sideName[denRole]]: String(den) };
  return {
    prompt: md`In the right triangle shown, find the angle at $${corner}$. ${DEG1}`,
    figure: rightTriangle({ w, h, sides: shown, ask: corner, angles: { [corner]: "?" } }),
    answer: `${inverse}(${num}/${den}) * 180/pi`,
    tolerance: 0.05,
    verify: [`${fn}(x pi/180) = ${num}/${den}`],
    hint: md`The two sides you know are the ${ROLE_WORD[numRole]} and the ${ROLE_WORD[denRole]} of angle $${corner}$. That ratio is $${FN_TEX[fn]} ${corner}$; undo it with $${FN_TEX[fn]}^{-1}$.`,
    solution: [
      {
        math: md`${FN_TEX[fn]} ${corner} = \frac{${ROLE_TEX[numRole]}}{${ROLE_TEX[denRole]}} = \frac{${num}}{${den}}${Number.isInteger((num / den) * 10000) ? ` = ${num / den}` : ` \\approx ${dp(num / den, 4)}`}`,
        note: md`From $${corner}$: $${num}$ is ${ROLE_WORD[numRole]} and $${den}$ is ${ROLE_WORD[denRole]}.`,
      },
      {
        math: md`${corner} = ${FN_TEX[fn]}^{-1}\!\left(\frac{${num}}{${den}}\right) \approx ${dp(value, 1)}^\circ`,
        note: md`$${FN_TEX[fn]}^{-1}$ gives the acute angle with that ${fn === "tan" ? "tangent" : fn === "sin" ? "sine" : "cosine"}. Calculator in degree mode. Check: the other acute angle is about $${dp(90 - value, 1)}^\circ$, and the two add to $90^\circ$.`,
      },
    ],
  };
};

const elevation: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0) {
    const d = 5 * r.int(4, 16);
    const t = r.pick(ANGLES.filter((a) => a <= 60));
    const x = d * tanD(t);
    return {
      prompt: md`From a point ${d} m from the base of a tower, on level ground, the angle of elevation of the top of the tower is $${t}^\circ$. How tall is the tower, in meters? ${ROUND}`,
      figure: rightTriangle({ w: d, h: x, sides: { AC: metres(d), BC: "x" }, angles: { A: deg(t) }, ask: "BC", dashed: ["AB"] }),
      answer: `${d} tan(${t} pi/180)`,
      tolerance: 0.05,
      verify: [`x / ${d} = tan(${t} pi/180)`],
      hint: "The ground, the tower and the line of sight make a right triangle. The height is opposite the angle of elevation; the distance along the ground is adjacent.",
      solution: [
        { math: md`\tan ${t}^\circ = \frac{x}{${d}}`, note: md`From the observer's angle, the tower ($x$) is opposite and the ${d} m along the ground is adjacent: tangent.` },
        { math: md`x = ${d} \tan ${t}^\circ \approx ${d}(${dp(tanD(t), 4)}) \approx ${dp(x, 1)}`, note: "Multiply both sides by the distance. Round at the end." },
      ],
    };
  }
  if (kind === 1) {
    const L = r.int(4, 12);
    const t = r.pick([55, 58, 60, 62, 65, 68, 70, 72, 75]);
    const x = L * sinD(t);
    return {
      prompt: md`A ${L} m ladder leans against a vertical wall and makes an angle of $${t}^\circ$ with the level ground. How far up the wall does it reach, in meters? ${ROUND}`,
      figure: rightTriangle({ w: L * cosD(t), h: x, sides: { AB: metres(L), BC: "x" }, angles: { A: deg(t) }, ask: "BC" }),
      answer: `${L} sin(${t} pi/180)`,
      tolerance: 0.05,
      verify: [`x / ${L} = sin(${t} pi/180)`],
      hint: "The ladder is the hypotenuse. The height on the wall is opposite the angle at the ground.",
      solution: [
        { math: md`\sin ${t}^\circ = \frac{x}{${L}}`, note: md`The height $x$ is opposite the $${t}^\circ$ angle, and the ladder is the hypotenuse: sine.` },
        { math: md`x = ${L} \sin ${t}^\circ \approx ${L}(${dp(sinD(t), 4)}) \approx ${dp(x, 1)}`, note: "Multiply both sides by the ladder's length." },
      ],
    };
  }
  if (kind === 2) {
    let h: number;
    let s: number;
    do {
      h = r.int(2, 12);
      s = r.int(2, 20);
    } while (h / s < 0.45 || h / s > 2.2);
    const value = Math.atan(h / s) / RAD;
    return {
      prompt: md`A vertical pole ${h} m tall casts a shadow ${s} m long on level ground. Find the angle of elevation of the sun. ${DEG1}`,
      figure: rightTriangle({ w: s, h, sides: { AC: metres(s), BC: metres(h) }, ask: "A", angles: { A: "?" }, dashed: ["AB"] }),
      answer: `atan(${h}/${s}) * 180/pi`,
      tolerance: 0.05,
      verify: [`tan(x pi/180) = ${h}/${s}`],
      hint: "The sun's ray runs from the tip of the shadow to the top of the pole. At the tip of the shadow, the pole is opposite and the shadow is adjacent.",
      solution: [
        { math: md`\tan A = \frac{${h}}{${s}}`, note: md`At the shadow's tip, the pole ($${h}$) is opposite the angle of elevation and the shadow ($${s}$) is adjacent.` },
        { math: md`A = \tan^{-1}\!\left(\frac{${h}}{${s}}\right) \approx ${dp(value, 1)}^\circ`, note: "Undo the tangent with the inverse tangent key, in degree mode." },
      ],
    };
  }
  if (kind === 3) {
    const h = 10 * r.int(3, 12);
    const t = r.pick(ANGLES.filter((a) => a <= 55));
    const x = h / tanD(t);
    // Only the angle of depression is marked; finding the angle at the boat is part of the problem.
    const fig = rightTriangle({ w: x, h, mirror: true, sides: { BC: metres(h), AC: "x" }, ask: "AC", dashed: ["AB"] });
    // The horizontal at the top of the cliff, and the angle of depression under it.
    const at = (name: string): Pt => {
      const p = fig.points!.find((q) => q.name === name)!;
      return { x: Number(p.x), y: Number(p.y) };
    };
    const [A, B] = [at("A"), at("B")];
    const D: Pt = { x: A.x, y: B.y };
    fig.points!.push({ name: "D", x: D.x, y: D.y, hidden: true, label: "" });
    fig.segments!.push({ from: "B", to: "D", dashed: true });
    fig.angles!.push({ at: "B", from: "D", to: "A", color: 1 });
    fig.labels = [...(fig.labels ?? []), angleLabel(B, D, A, deg(t), ppu(fig.view))];
    return {
      prompt: md`From the top of a vertical cliff ${h} m high, the angle of depression of a boat is $${t}^\circ$. How far is the boat from the base of the cliff, in meters? ${ROUND}`,
      figure: fig,
      answer: `${h} / tan(${t} pi/180)`,
      tolerance: 0.05,
      verify: [`${h} / x = tan(${t} pi/180)`],
      hint: md`The angle of depression at the top equals the angle of elevation at the boat (alternate interior angles between the two horizontals). From the boat, the cliff is opposite and the distance $x$ is adjacent.`,
      solution: [
        { math: md`\angle A = ${t}^\circ`, note: "The horizontal at the cliff top is parallel to the ground, and the line of sight crosses both, so the angle of elevation at the boat equals the angle of depression." },
        { math: md`\tan ${t}^\circ = \frac{${h}}{x}`, note: md`From the boat, the cliff ($${h}$) is opposite and the distance $x$ is adjacent.` },
        { math: md`x = \frac{${h}}{\tan ${t}^\circ} \approx \frac{${h}}{${dp(tanD(t), 4)}} \approx ${dp(x, 1)}`, note: md`$x$ is underneath: multiply both sides by $x$, then divide by $\tan ${t}^\circ$.` },
      ],
    };
  }
  if (kind === 4) {
    const L = 5 * r.int(4, 12);
    const t = r.pick(ANGLES.filter((a) => a >= 30));
    const x = L * cosD(t);
    return {
      prompt: md`A kite flies on ${L} m of taut string that makes a $${t}^\circ$ angle with the level ground. How far along the ground is the kite from the person holding the string, in meters? ${ROUND}`,
      figure: rightTriangle({ w: x, h: L * sinD(t), sides: { AB: metres(L), AC: "x" }, angles: { A: deg(t) }, ask: "AC" }),
      answer: `${L} cos(${t} pi/180)`,
      tolerance: 0.05,
      verify: [`x / ${L} = cos(${t} pi/180)`],
      hint: "The string is the hypotenuse. The distance along the ground is adjacent to the angle at the person's hand.",
      solution: [
        { math: md`\cos ${t}^\circ = \frac{x}{${L}}`, note: md`$x$ is adjacent to the $${t}^\circ$ angle and the string is the hypotenuse: cosine.` },
        { math: md`x = ${L} \cos ${t}^\circ \approx ${L}(${dp(cosD(t), 4)}) \approx ${dp(x, 1)}`, note: "Multiply both sides by the length of the string." },
      ],
    };
  }
  let L: number;
  let h: number;
  do {
    L = r.int(8, 20);
    h = r.int(4, 12);
  } while (h / L < 0.42 || h / L > 0.72);
  const value = Math.asin(h / L) / RAD;
  return {
    prompt: md`An escalator ${L} m long rises ${h} m. What angle does it make with the floor? ${DEG1}`,
    figure: rightTriangle({ w: Math.sqrt(L * L - h * h), h, sides: { AB: metres(L), BC: metres(h) }, ask: "A", angles: { A: "?" } }),
    answer: `asin(${h}/${L}) * 180/pi`,
    tolerance: 0.05,
    verify: [`sin(x pi/180) = ${h}/${L}`],
    hint: "The escalator is the hypotenuse and the rise is opposite the angle at the floor: sine.",
    solution: [
      { math: md`\sin A = \frac{${h}}{${L}}${Number.isInteger((h / L) * 10000) ? ` = ${h / L}` : ` \\approx ${dp(h / L, 4)}`}`, note: md`The rise ($${h}$) is opposite the angle at the floor; the escalator ($${L}$) is the hypotenuse.` },
      { math: md`A = \sin^{-1}\!\left(\frac{${h}}{${L}}\right) \approx ${dp(value, 1)}^\circ`, note: "Inverse sine, in degree mode." },
    ],
  };
};

// ── Lesson 3 generators ─────────────────────────────────────────────────────

const reciprocalExact: Generator = (r) => exactValueProblem(r, ["csc", "sec", "cot"]);

// ── Lesson blocks ───────────────────────────────────────────────────────────

const px6 = ppu([-0.9, 6.9, -0.9, 4.4]);
const specialView: DiagramSpec["view"] = [-0.7, 9.9, -0.7, 3.7];
const pxSpecial = ppu(specialView);
const SQ3 = r3(2.5 * Math.sqrt(3));

export const unit2: Unit = {
  title: "Right-Triangle Trigonometry",
  lessons: [
    {
      id: slug("Sine, cosine and tangent as ratios"),
      title: "Sine, cosine and tangent as ratios",
      summary: "Why a right triangle's side ratios depend only on its angle, and the exact ratios for 30°, 45° and 60°.",
      blocks: [
        {
          kind: "text",
          body: md`Draw a right triangle with a $35^\circ$ angle. Make it any size you like. Measure the side opposite the $35^\circ$ angle and divide by the hypotenuse. You get about $0.57$, every time, whatever the size.

That number belongs to the angle, not to the triangle. This is the whole idea of trigonometry: a right triangle's *shape* is fixed by one acute angle, so every ratio of its sides is a function of that angle. Drag the slider and watch two triangles of different sizes report the same ratio.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 6.6, -0.8, 7.2],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "C", x: 3, y: 0, dir: "s", label: "C_1" },
            { name: "B", x: 3, y: "3 tan(t pi/180)", dir: "nw", label: "B_1" },
            { name: "D", x: 5.5, y: 0, dir: "s", label: "C_2" },
            { name: "E", x: 5.5, y: "5.5 tan(t pi/180)", dir: "ne", label: "B_2" },
          ],
          segments: [
            { from: "A", to: "D" },
            { from: "A", to: "E" },
            { from: "C", to: "B", color: 2 },
            { from: "D", to: "E", color: 2 },
          ],
          angles: [
            { at: "A", from: "D", to: "E", label: "{t}^\\circ" },
            { at: "C", from: "A", to: "B", right: true },
            { at: "D", from: "A", to: "E", right: true },
          ],
          params: [{ name: "t", tex: "\\theta", min: 15, max: 50, step: 1, value: 35 }],
          readouts: [
            { label: "\\frac{B_1C_1}{AB_1}", value: "3 tan(t pi/180) / sqrt(9 + (3 tan(t pi/180))^2)" },
            { label: "\\frac{B_2C_2}{AB_2}", value: "5.5 tan(t pi/180) / sqrt(5.5^2 + (5.5 tan(t pi/180))^2)" },
          ],
          caption: md`Two right triangles sharing the angle $\theta$ at $A$. Opposite over hypotenuse is the same in both, for every $\theta$.`,
        },
        {
          kind: "why",
          title: "Why the ratio depends only on the angle",
          body: md`Two right triangles that share an acute angle $\theta$ have two equal angles: $\theta$ and the right angle. By AA similarity (Geometry, Unit 6) they are similar, and similar triangles have proportional sides. If the small triangle has opposite side $a$ and hypotenuse $c$, the large one has $ka$ and $kc$ for some scale factor $k$. Then

$$\frac{ka}{kc} = \frac{a}{c}.$$

The $k$ cancels. Scaling changes every side but no ratio. So each ratio is a property of $\theta$ alone, and it deserves a name.`,
        },
        {
          kind: "proof",
          title: "The ratio opposite over hypotenuse is well defined",
          given: md`Right triangles $ABC$ and $DEF$ with right angles at $C$ and $F$, and $\angle A = \angle D$`,
          prove: md`$\dfrac{BC}{AB} = \dfrac{EF}{DE}$`,
          steps: [
            { statement: md`$\angle C = \angle F = 90^\circ$`, reason: "Given" },
            { statement: md`$\angle A = \angle D$`, reason: "Given" },
            { statement: md`$\triangle ABC \sim \triangle DEF$`, reason: "AA Similarity" },
            { statement: md`$\dfrac{BC}{EF} = \dfrac{AB}{DE}$`, reason: "Corresponding sides of similar triangles are proportional" },
            { statement: md`$BC \cdot DE = EF \cdot AB$`, reason: "Multiplication Property of Equality (cross-multiply)" },
            { statement: md`$\dfrac{BC}{AB} = \dfrac{EF}{DE}$`, reason: md`Divide both sides by $AB \cdot DE$` },
          ],
        },
        {
          kind: "key",
          title: "Sine, cosine and tangent",
          body: md`In a right triangle with acute angle $\theta$, name the three sides from $\theta$'s point of view. The **hypotenuse** is opposite the right angle and is always the longest side. The leg **opposite** $\theta$ is across from it. The leg **adjacent** to $\theta$ touches it.

$$\sin\theta = \frac{\text{opp}}{\text{hyp}}, \qquad \cos\theta = \frac{\text{adj}}{\text{hyp}}, \qquad \tan\theta = \frac{\text{opp}}{\text{adj}}.$$

"SOH CAH TOA" is the usual memory aid. Opposite and adjacent swap when you move to the other acute angle; the hypotenuse never changes.`,
        },
        {
          kind: "diagram",
          view: [-0.9, 6.9, -0.9, 4.4],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "C", x: 6, y: 0, dir: "se" },
            { name: "B", x: 6, y: 3.5, dir: "ne" },
          ],
          segments: [
            { from: "A", to: "C", label: "\\text{adjacent}" },
            { from: "C", to: "B", label: "\\text{opposite}", color: 2 },
            { from: "A", to: "B", label: "\\text{hypotenuse}" },
          ],
          angles: [
            { at: "C", from: "A", to: "B", right: true },
            { at: "A", from: "C", to: "B" },
          ],
          labels: [angleLabel({ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3.5 }, "\\theta", px6)],
          caption: md`The sides named from $\theta$'s point of view. From $B$'s point of view the two legs would trade names.`,
        },
        {
          ...rightTriangle({ w: 4, h: 3, sides: { AC: "4", BC: "3", AB: "5" } }),
          caption: md`A 3-4-5 right triangle, used in the example below.`,
        },
        {
          kind: "example",
          title: "All six ratios of a 3-4-5 triangle",
          problem: md`In the triangle above, find $\sin A$, $\cos A$, $\tan A$ and then the same three ratios for $B$.`,
          steps: [
            { math: md`\text{From } A:\ \text{opp} = BC = 3, \quad \text{adj} = AC = 4, \quad \text{hyp} = AB = 5`, note: md`$AB$ is across from the right angle, so it is the hypotenuse. The leg touching $A$ is $AC$.` },
            { math: md`\sin A = \frac{3}{5}, \qquad \cos A = \frac{4}{5}, \qquad \tan A = \frac{3}{4}`, note: "Opposite over hypotenuse, adjacent over hypotenuse, opposite over adjacent." },
            { math: md`\text{From } B:\ \text{opp} = AC = 4, \quad \text{adj} = BC = 3, \quad \text{hyp} = 5`, note: "Now the legs swap roles." },
            { math: md`\sin B = \frac{4}{5}, \qquad \cos B = \frac{3}{5}, \qquad \tan B = \frac{4}{3}`, note: md`Notice $\sin A = \cos B$ and $\cos A = \sin B$. That is no accident.` },
          ],
        },
        {
          kind: "why",
          title: "Why sin A = cos B, and why tan = sin over cos",
          body: md`The two acute angles of a right triangle add to $90^\circ$: the three angles add to $180^\circ$ and one of them is $90^\circ$. The leg opposite $A$ is the leg adjacent to $B$. So

$$\sin A = \frac{a}{c} = \cos B = \cos(90^\circ - A).$$

That is where the name *cosine* comes from: the sine of the **co**mplement. The same swap gives $\tan A = \frac{a}{b}$ and $\tan B = \frac{b}{a}$, reciprocals of each other.

Tangent is not independent of the other two. Divide:

$$\frac{\sin\theta}{\cos\theta} = \frac{\text{opp}/\text{hyp}}{\text{adj}/\text{hyp}} = \frac{\text{opp}}{\text{adj}} = \tan\theta.$$`,
        },
        {
          kind: "text",
          body: md`How big can these ratios be? A leg is always shorter than the hypotenuse: by the Pythagorean Theorem $c^2 = a^2 + b^2 > a^2$, so $c > a$. That makes $0 < \sin\theta < 1$ and $0 < \cos\theta < 1$ for every acute angle. Tangent has no such ceiling: a tall thin triangle has a huge tangent and a flat one a tiny tangent.

When only two sides are given, find the third with the Pythagorean Theorem before writing any ratio. The hypotenuse often comes out irrational, and the convention is to leave no square root in a denominator.`,
        },
        {
          kind: "example",
          title: "Legs 2 and 5",
          problem: md`A right triangle has legs $2$ and $5$. Find the sine, cosine and tangent of the angle $A$ opposite the leg of length $2$.`,
          steps: [
            { math: md`c = \sqrt{2^2 + 5^2} = \sqrt{29}`, note: md`$29$ has no square factor, so this is as simple as the hypotenuse gets.` },
            { math: md`\sin A = \frac{2}{\sqrt{29}} = \frac{2}{\sqrt{29}} \cdot \frac{\sqrt{29}}{\sqrt{29}} = \frac{2\sqrt{29}}{29}`, note: md`Multiplying top and bottom by $\sqrt{29}$ clears the root from the denominator. The value hasn't changed.` },
            { math: md`\cos A = \frac{5}{\sqrt{29}} = \frac{5\sqrt{29}}{29}`, note: "Adjacent over hypotenuse, rationalized the same way." },
            { math: md`\tan A = \frac{2}{5}`, note: "Opposite over adjacent needs no hypotenuse at all." },
          ],
        },
        {
          kind: "key",
          title: "The two special triangles",
          body: md`- **45-45-90:** legs $1$ and $1$, hypotenuse $\sqrt{2}$.
- **30-60-90:** short leg $1$ (opposite the $30^\circ$ angle), long leg $\sqrt{3}$ (opposite the $60^\circ$ angle), hypotenuse $2$.

Every 45-45-90 or 30-60-90 triangle is a scaled copy of one of these, so their ratios give the exact values of the trig functions at $30^\circ$, $45^\circ$ and $60^\circ$.`,
        },
        {
          kind: "diagram",
          view: specialView,
          points: [
            { name: "P", x: 0, y: 0, dir: "sw", label: "" },
            { name: "Q", x: 3, y: 0, dir: "se", label: "" },
            { name: "R", x: 3, y: 3, dir: "ne", label: "" },
            { name: "S", x: 4.8, y: 0, dir: "sw", label: "" },
            { name: "T", x: r3(4.8 + SQ3), y: 0, dir: "se", label: "" },
            { name: "U", x: r3(4.8 + SQ3), y: 2.5, dir: "ne", label: "" },
          ],
          segments: [
            { from: "P", to: "Q", label: "1" },
            { from: "Q", to: "R", label: "1" },
            { from: "P", to: "R", label: "\\sqrt{2}" },
            { from: "S", to: "T", label: "\\sqrt{3}" },
            { from: "T", to: "U", label: "1" },
            { from: "S", to: "U", label: "2" },
          ],
          angles: [
            { at: "Q", from: "P", to: "R", right: true },
            { at: "P", from: "Q", to: "R" },
            { at: "R", from: "P", to: "Q" },
            { at: "T", from: "S", to: "U", right: true },
            { at: "S", from: "T", to: "U" },
            { at: "U", from: "S", to: "T" },
          ],
          labels: [
            angleLabel({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, deg(45), pxSpecial),
            angleLabel({ x: 3, y: 3 }, { x: 0, y: 0 }, { x: 3, y: 0 }, deg(45), pxSpecial),
            angleLabel({ x: 4.8, y: 0 }, { x: 4.8 + SQ3, y: 0 }, { x: 4.8 + SQ3, y: 2.5 }, deg(30), pxSpecial),
            angleLabel({ x: 4.8 + SQ3, y: 2.5 }, { x: 4.8, y: 0 }, { x: 4.8 + SQ3, y: 0 }, deg(60), pxSpecial),
          ],
          caption: md`The 45-45-90 triangle (left) and the 30-60-90 triangle (right), drawn to scale.`,
        },
        {
          kind: "why",
          title: "Where the square roots of 2 and 3 come from",
          body: md`**45-45-90.** The two acute angles are equal, so the legs opposite them are equal (converse of the Isosceles Triangle Theorem). Take both legs to be $1$. Then $c^2 = 1^2 + 1^2 = 2$, so $c = \sqrt{2}$.

**30-60-90.** Start with an equilateral triangle of side $2$. Each angle is $60^\circ$. Drop the altitude from the top vertex. By the symmetry of the isosceles triangle it bisects the base, into $1$ and $1$, and bisects the $60^\circ$ apex angle, into $30^\circ$ and $30^\circ$. Each half is a right triangle with hypotenuse $2$ and short leg $1$, so the other leg is $\sqrt{2^2 - 1^2} = \sqrt{3}$. The $30^\circ$ angle sits at the top, opposite the short leg; the $60^\circ$ angle is at the base, opposite the long leg.`,
        },
        {
          kind: "key",
          title: "Exact values",
          body: md`Read each ratio straight off the triangles:

$$\begin{array}{c|ccc} \theta & 30^\circ & 45^\circ & 60^\circ \\ \hline \sin\theta & \dfrac{1}{2} & \dfrac{\sqrt{2}}{2} & \dfrac{\sqrt{3}}{2} \\[6pt] \cos\theta & \dfrac{\sqrt{3}}{2} & \dfrac{\sqrt{2}}{2} & \dfrac{1}{2} \\[6pt] \tan\theta & \dfrac{\sqrt{3}}{3} & 1 & \sqrt{3} \end{array}$$

For example $\sin 45^\circ = \frac{1}{\sqrt{2}} = \frac{\sqrt{2}}{2}$ and $\tan 30^\circ = \frac{1}{\sqrt{3}} = \frac{\sqrt{3}}{3}$, both rationalized. The sine row read backwards is the cosine row, because $30^\circ$ and $60^\circ$ are complements and $45^\circ$ is its own complement.`,
        },
        {
          kind: "check",
          prompt: md`Give the exact value of $\tan 30^\circ$. ${EXACT}`,
          answer: "sqrt(3)/3",
          simplified: true,
          explain: md`From the $30^\circ$ corner of the 30-60-90 triangle, opposite is $1$ and adjacent is $\sqrt{3}$: $\tan 30^\circ = \frac{1}{\sqrt{3}} = \frac{\sqrt{3}}{3}$.`,
        },
        {
          kind: "check",
          prompt: md`A right triangle has legs $5$ and $12$. Find the sine of the angle opposite the leg of length $5$. ${EXACT}`,
          answer: "5/13",
          simplified: true,
          explain: md`The hypotenuse is $\sqrt{25 + 144} = 13$. Sine is opposite over hypotenuse: $\frac{5}{13}$.`,
        },
      ],
      practice: [triangleRatioGen(["sin", "cos", "tan"]), exactValues, fromRatioGen(["sin", "cos", "tan"], ["sin", "cos", "tan"])],
    },
    {
      id: slug("Solving right triangles"),
      title: "Solving right triangles",
      summary: "Finding every side and angle from one side and one more fact, including angles of elevation and depression.",
      blocks: [
        {
          kind: "text",
          body: md`To **solve** a right triangle is to find all three sides and both acute angles. Besides the right angle you need one side and one more fact: another side, or one acute angle.

Why is that enough? One acute angle fixes the shape (Lesson 1), and one side then fixes the size. Two sides fix the shape too, through their ratio. Either way, nothing is left to choose.`,
        },
        {
          kind: "key",
          title: "The method",
          body: md`- Mark the angle you know (or want). Name the sides from its point of view: opposite, adjacent, hypotenuse.
- Pick the ratio that uses the side you know and the side you want. Exactly one of $\sin$, $\cos$, $\tan$ involves those two sides.
- Write the equation and solve. If the unknown is on top, multiply. If it is underneath, divide.
- Round only at the end, and keep your calculator in degree mode.`,
        },
        {
          kind: "example",
          title: "The unknown on top",
          problem: md`A right triangle has hypotenuse $12$ and an acute angle of $35^\circ$. Find the side $x$ opposite the $35^\circ$ angle, to 1 decimal place.`,
          steps: [
            { math: md`\sin 35^\circ = \frac{x}{12}`, note: md`$x$ is opposite, $12$ is the hypotenuse: sine links them.` },
            { math: md`x = 12 \sin 35^\circ`, note: "Multiply both sides by 12." },
            { math: md`x \approx 12(0.5736) \approx 6.9`, note: md`$\sin 35^\circ \approx 0.5736$ from a calculator in degree mode. Rounded at the end.` },
          ],
        },
        {
          kind: "example",
          title: "The unknown underneath",
          problem: md`A right triangle has an acute angle of $52^\circ$ whose adjacent leg is $7$. Find the hypotenuse $x$, to 1 decimal place.`,
          steps: [
            { math: md`\cos 52^\circ = \frac{7}{x}`, note: "Adjacent over hypotenuse." },
            { math: md`x \cos 52^\circ = 7`, note: md`Multiply both sides by $x$ to get it out of the denominator.` },
            { math: md`x = \frac{7}{\cos 52^\circ} \approx \frac{7}{0.6157} \approx 11.4`, note: md`Divide both sides by $\cos 52^\circ$. The hypotenuse is longer than the leg, as it should be.` },
          ],
        },
        {
          kind: "why",
          title: "Why divide, and why the answer had to grow",
          body: md`$\cos 52^\circ = \frac{7}{x}$ says that $7$ is about $0.6157$ of $x$. To recover $x$, undo the "times $0.6157$" by dividing. Dividing by a number less than $1$ makes the result bigger, which is exactly right: the hypotenuse is the longest side.

Size checks like this catch most mistakes. A hypotenuse shorter than a leg, or a side that came out negative, means a wrong ratio or a calculator left in radian mode.

One more habit: when you have found one unknown, find the next from the *given* numbers, not from your rounded result. Rounding errors compound.`,
        },
        {
          kind: "text",
          body: md`Now the other direction: from a ratio back to the angle. Suppose a right triangle has opposite side $3$ and hypotenuse $5$, so $\sin A = 0.6$. Which angle is $A$? Lesson 1 says each angle owns its ratio. For this to work backwards we need each ratio to belong to exactly one acute angle.`,
        },
        {
          kind: "plot",
          x: [0, 90],
          y: [0, 3],
          curves: [
            { expr: "sin(x pi/180)", label: "\\sin\\theta", color: 1 },
            { expr: "cos(x pi/180)", label: "\\cos\\theta", color: 2 },
            { expr: "tan(x pi/180)", label: "\\tan\\theta", color: 3, domain: [0, 71.5] },
          ],
          caption: md`The three ratios as $\theta$ runs from $0^\circ$ to $90^\circ$. Sine and tangent climb, cosine falls, and none of them takes the same value twice.`,
        },
        {
          kind: "why",
          title: "Why one ratio means one angle",
          body: md`Fix the hypotenuse at $1$ and let the acute angle grow from $0^\circ$ toward $90^\circ$. The opposite side grows the whole way, from $0$ toward $1$, and never shrinks. A quantity that only goes up never repeats a value. So if $\sin A = 0.6$, exactly one acute angle does it.

Cosine is the sine of the complement, so it falls the whole way and also never repeats. Tangent is $\sin\theta/\cos\theta$, a growing number over a shrinking one, so it climbs without bound. All three are one-to-one on acute angles, which is what lets us undo them.`,
        },
        {
          kind: "key",
          title: "Inverse trig notation",
          body: md`$A = \sin^{-1}(0.6)$ means "the acute angle whose sine is $0.6$". It is also written $\arcsin 0.6$. The $-1$ is **not** an exponent: $\sin^{-1} x$ is not $\frac{1}{\sin x}$.

Calculators label the keys $\sin^{-1}$, $\cos^{-1}$, $\tan^{-1}$, usually behind SHIFT or 2nd. In degree mode, $\sin^{-1}(0.6) \approx 36.9^\circ$. Unit 6 studies these inverse functions properly, for angles of every size.`,
        },
        {
          kind: "example",
          title: "Solving a triangle completely",
          problem: md`A right triangle has a leg $a = 9$ and hypotenuse $c = 15$. Find the other leg $b$ and both acute angles, $A$ (opposite $a$) and $B$.`,
          steps: [
            { math: md`b = \sqrt{15^2 - 9^2} = \sqrt{144} = 12`, note: "Pythagorean Theorem for the third side." },
            { math: md`\sin A = \frac{9}{15} = 0.6, \qquad A = \sin^{-1}(0.6) \approx 36.9^\circ`, note: "Opposite over hypotenuse, then undo the sine." },
            { math: md`B = 90^\circ - 36.9^\circ = 53.1^\circ`, note: "The acute angles are complements." },
            { math: md`\tan B = \frac{12}{9} \approx 1.333, \qquad \tan^{-1}(1.333) \approx 53.1^\circ`, note: md`A check from the given sides agrees.` },
          ],
        },
        {
          kind: "key",
          title: "Angles of elevation and depression",
          body: md`The **angle of elevation** of an object is the angle between the horizontal and your line of sight when you look *up* at it. The **angle of depression** is the same thing when you look *down*.

Looking down from a cliff top to a boat, the angle of depression at the top equals the angle of elevation at the boat. The two horizontals are parallel and the line of sight is a transversal, so the two angles are alternate interior angles.`,
        },
        {
          kind: "diagram",
          view: [-0.9, 6.9, -0.9, 4.9],
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "Q", x: 6, y: 0, dir: "se", label: "" },
            { name: "T", x: 6, y: 4, dir: "ne" },
            { name: "P", x: 0, y: 4, hidden: true, label: "" },
          ],
          segments: [
            { from: "O", to: "Q" },
            { from: "Q", to: "T" },
            { from: "O", to: "T", dashed: true, label: "\\text{line of sight}" },
            { from: "T", to: "P", dashed: true },
          ],
          angles: [
            { at: "Q", from: "O", to: "T", right: true },
            { at: "O", from: "Q", to: "T", color: 2 },
            { at: "T", from: "P", to: "O", color: 2 },
          ],
          labels: [
            angleLabel({ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, "\\alpha", ppu([-0.9, 6.9, -0.9, 4.9])),
            angleLabel({ x: 6, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }, "\\alpha", ppu([-0.9, 6.9, -0.9, 4.9])),
          ],
          caption: md`From $O$ the angle of elevation of $T$ is $\alpha$. From $T$ the angle of depression of $O$ is also $\alpha$: alternate interior angles between the two horizontals.`,
        },
        {
          kind: "example",
          title: "An angle of elevation",
          problem: md`From a point $40$ m from the base of a tree, the angle of elevation of its top is $32^\circ$. How tall is the tree, to 1 decimal place?`,
          steps: [
            { math: md`\tan 32^\circ = \frac{h}{40}`, note: "The tree is opposite the angle of elevation; the 40 m along the ground is adjacent. Tangent uses the two legs." },
            { math: md`h = 40 \tan 32^\circ \approx 40(0.6249) \approx 25.0`, note: "About 25.0 m. (If the observer's eyes are above the ground, add their height.)" },
          ],
        },
        {
          kind: "text",
          body: md`**Typing answers here.** Round to 1 decimal place and type the number, like 6.9. Answers within rounding distance are accepted. If you type an expression instead, remember that the answer box computes $\sin$, $\cos$ and $\tan$ in radians: write 12 sin(35 pi/180), not sin(35°).`,
        },
        {
          kind: "check",
          prompt: md`A right triangle has hypotenuse $20$ and an acute angle of $40^\circ$. Find the leg opposite the $40^\circ$ angle. ${ROUND}`,
          answer: "20 sin(40 pi/180)",
          tolerance: 0.05,
          explain: md`$\sin 40^\circ = \frac{x}{20}$, so $x = 20 \sin 40^\circ \approx 20(0.6428) \approx 12.9$.`,
        },
        {
          kind: "check",
          prompt: md`In a right triangle, the leg opposite angle $A$ is $7$ and the leg adjacent to $A$ is $4$. Find $A$. ${DEG1}`,
          answer: "atan(7/4) * 180/pi",
          tolerance: 0.05,
          explain: md`$\tan A = \frac{7}{4} = 1.75$, so $A = \tan^{-1}(1.75) \approx 60.3^\circ$.`,
        },
      ],
      practice: [findSide, findAngle, elevation],
    },
    {
      id: slug("Reciprocal functions"),
      title: "Reciprocal functions",
      summary: "Secant, cosecant and cotangent: the three flipped ratios, their exact values, and the identities Pythagoras gives them.",
      blocks: [
        {
          kind: "text",
          body: md`Three sides make six ratios. Lesson 1 named three of them. The other three are the same fractions turned upside down, and they get their own names because they appear constantly in calculus and physics.`,
        },
        {
          kind: "key",
          title: "Cosecant, secant, cotangent",
          body: md`$$\csc\theta = \frac{\text{hyp}}{\text{opp}} = \frac{1}{\sin\theta}, \qquad \sec\theta = \frac{\text{hyp}}{\text{adj}} = \frac{1}{\cos\theta}, \qquad \cot\theta = \frac{\text{adj}}{\text{opp}} = \frac{1}{\tan\theta}.$$

The pairing is the one that trips people up: **secant goes with cosine** and **cosecant goes with sine**. The "co" never pairs with another "co".`,
        },
        {
          kind: "why",
          title: "Why these are functions of the angle too",
          body: md`Each is the reciprocal of a ratio that depends only on $\theta$ (Lesson 1), so it depends only on $\theta$. Nothing new is needed: the same similar-triangles argument covers them.

Cotangent also comes from sine and cosine, the same way tangent did:

$$\cot\theta = \frac{\text{adj}}{\text{opp}} = \frac{\text{adj}/\text{hyp}}{\text{opp}/\text{hyp}} = \frac{\cos\theta}{\sin\theta}.$$`,
        },
        {
          ...rightTriangle({ w: 12, h: 5, sides: { AC: "12", BC: "5", AB: "13" } }),
          caption: md`A 5-12-13 right triangle.`,
        },
        {
          kind: "example",
          title: "All six ratios",
          problem: md`In the triangle above, find all six trigonometric ratios of angle $A$.`,
          steps: [
            { math: md`\text{opp} = BC = 5, \quad \text{adj} = AC = 12, \quad \text{hyp} = AB = 13`, note: md`From $A$'s point of view.` },
            { math: md`\sin A = \frac{5}{13}, \qquad \cos A = \frac{12}{13}, \qquad \tan A = \frac{5}{12}`, note: "The three from Lesson 1." },
            { math: md`\csc A = \frac{13}{5}, \qquad \sec A = \frac{13}{12}, \qquad \cot A = \frac{12}{5}`, note: "Each one flipped. No new measuring, just reciprocals." },
          ],
        },
        {
          kind: "key",
          title: "Exact values of the reciprocals",
          body: md`Flip the table from Lesson 1, then rationalize:

$$\begin{array}{c|ccc} \theta & 30^\circ & 45^\circ & 60^\circ \\ \hline \csc\theta & 2 & \sqrt{2} & \dfrac{2\sqrt{3}}{3} \\[6pt] \sec\theta & \dfrac{2\sqrt{3}}{3} & \sqrt{2} & 2 \\[6pt] \cot\theta & \sqrt{3} & 1 & \dfrac{\sqrt{3}}{3} \end{array}$$`,
        },
        {
          kind: "why",
          title: "Why sec 30° is 2 root 3 over 3",
          body: md`$\cos 30^\circ = \frac{\sqrt{3}}{2}$, so $\sec 30^\circ = \frac{2}{\sqrt{3}}$. Flipping a fraction with a root on top puts the root underneath, and the convention is to clear it:

$$\frac{2}{\sqrt{3}} \cdot \frac{\sqrt{3}}{\sqrt{3}} = \frac{2\sqrt{3}}{3}.$$

Or read it straight from the 30-60-90 triangle: from the $30^\circ$ corner, hypotenuse over adjacent is $\frac{2}{\sqrt{3}}$. Same number, same rationalizing.`,
        },
        {
          kind: "text",
          body: md`The hypotenuse is the longest side, so $\sec\theta > 1$ and $\csc\theta > 1$ for every acute angle. Cotangent, like tangent, can be any positive number. As $\theta$ nears $90^\circ$, $\cos\theta$ shrinks toward $0$ and $\sec\theta$ blows up.`,
        },
        {
          kind: "plot",
          x: [0, 90],
          y: [0, 6],
          curves: [
            { expr: "cos(x pi/180)", label: "\\cos\\theta", color: 2 },
            { expr: "1/cos(x pi/180)", label: "\\sec\\theta", color: 1, domain: [0, 80.5] },
          ],
          hlines: [{ y: 1, label: "y = 1" }],
          caption: md`Cosine and its reciprocal, secant. Where one is $1$, so is the other. As cosine falls toward $0$, secant climbs without bound.`,
        },
        {
          kind: "why",
          title: "Pythagoras in ratio form",
          body: md`Let the legs be $a$ (opposite $\theta$) and $b$ (adjacent), with hypotenuse $c$, so $a^2 + b^2 = c^2$. Divide through by $c^2$:

$$\left(\frac{a}{c}\right)^2 + \left(\frac{b}{c}\right)^2 = 1, \quad\text{that is}\quad \sin^2\theta + \cos^2\theta = 1.$$

Divide by $b^2$ instead:

$$\left(\frac{a}{b}\right)^2 + 1 = \left(\frac{c}{b}\right)^2, \quad\text{that is}\quad \tan^2\theta + 1 = \sec^2\theta.$$

Divide by $a^2$:

$$1 + \left(\frac{b}{a}\right)^2 = \left(\frac{c}{a}\right)^2, \quad\text{that is}\quad 1 + \cot^2\theta = \csc^2\theta.$$

Three identities, one theorem. Unit 5 proves them for angles of every size; for acute angles, this is the whole proof.`,
        },
        {
          kind: "proof",
          title: "1 + tan² θ = sec² θ for an acute angle",
          given: md`A right triangle with acute angle $\theta$, opposite leg $a$, adjacent leg $b$, hypotenuse $c$`,
          prove: md`$1 + \tan^2\theta = \sec^2\theta$`,
          steps: [
            { statement: md`$a^2 + b^2 = c^2$`, reason: "Pythagorean Theorem" },
            { statement: md`$\dfrac{a^2}{b^2} + 1 = \dfrac{c^2}{b^2}$`, reason: md`Divide both sides by $b^2$ ($b \ne 0$)` },
            { statement: md`$\left(\dfrac{a}{b}\right)^2 + 1 = \left(\dfrac{c}{b}\right)^2$`, reason: "A quotient squared is the quotient of the squares" },
            { statement: md`$\tan\theta = \dfrac{a}{b}$ and $\sec\theta = \dfrac{c}{b}$`, reason: "Definitions: opposite over adjacent, hypotenuse over adjacent" },
            { statement: md`$\tan^2\theta + 1 = \sec^2\theta$`, reason: "Substitution" },
          ],
        },
        {
          kind: "example",
          title: "From one ratio to the others",
          problem: md`Angle $A$ is acute and $\sec A = \frac{5}{3}$. Find $\tan A$ and $\sin A$.`,
          steps: [
            { math: md`\text{hyp} = 5, \quad \text{adj} = 3`, note: md`$\sec A$ is hypotenuse over adjacent. Any right triangle with $\sec A = \frac{5}{3}$ is similar to this one.` },
            { math: md`\text{opp} = \sqrt{5^2 - 3^2} = 4`, note: "Pythagorean Theorem." },
            { math: md`\tan A = \frac{4}{3}, \qquad \sin A = \frac{4}{5}`, note: "Opposite over adjacent; opposite over hypotenuse." },
            { math: md`1 + \tan^2 A = 1 + \frac{16}{9} = \frac{25}{9} = \sec^2 A`, note: "The identity checks. You could also have started from it: $\\tan^2 A = \\sec^2 A - 1$." },
          ],
        },
        {
          kind: "text",
          body: md`Calculators have no $\sec$, $\csc$ or $\cot$ keys. Use $1/\cos$, $1/\sin$ and $1/\tan$. Do not press $\cos^{-1}$: that is the inverse function, which returns an angle, not the reciprocal, which is a ratio.

The answer box here does understand sec, csc and cot, but it works in radians. For exact answers, type fractions and roots, like 2sqrt(3)/3.`,
        },
        {
          kind: "check",
          prompt: md`Give the exact value of $\sec 60^\circ$. ${EXACT}`,
          answer: "2",
          simplified: true,
          explain: md`$\cos 60^\circ = \frac{1}{2}$, so $\sec 60^\circ = 2$. From the 30-60-90 triangle: hypotenuse $2$ over the adjacent side $1$.`,
        },
        {
          kind: "check",
          prompt: md`A right triangle has legs $8$ and $15$. Find the cotangent of the angle opposite the leg of length $8$. ${EXACT}`,
          answer: "15/8",
          simplified: true,
          explain: md`Cotangent is adjacent over opposite. From that angle, the $15$ leg is adjacent and the $8$ leg is opposite: $\frac{15}{8}$. No hypotenuse needed.`,
        },
      ],
      practice: [triangleRatioGen(["csc", "sec", "cot"]), reciprocalExact, fromRatioGen(["sin", "cos", "tan", "sec", "csc", "cot"], ["sin", "cos", "tan", "sec", "csc", "cot"])],
    },
  ],
};
