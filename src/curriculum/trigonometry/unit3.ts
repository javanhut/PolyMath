import { frac, gcd, type Rng } from "../../math/random";
import { md, slug, type DiagramSpec, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Exact values as n·sqrt(rad)/d ────────────────────────────────────────────

interface Val {
  n: number;
  rad: number;
  d: number;
}

function norm(v: Val): Val {
  if (v.n === 0) return { n: 0, rad: 1, d: 1 };
  let { n, rad, d } = v;
  if (d < 0) [n, d] = [-n, -d];
  for (let k = 2; k * k <= rad; k++) {
    while (rad % (k * k) === 0) {
      rad /= k * k;
      n *= k;
    }
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, rad, d: d / g };
}

const val = (n: number, rad = 1, d = 1): Val => norm({ n, rad, d });
const negate = (v: Val): Val => ({ ...v, n: -v.n });
const mul = (a: Val, b: Val): Val => norm({ n: a.n * b.n, rad: a.rad * b.rad, d: a.d * b.d });
/** 1/(n sqrt(rad)/d) = d sqrt(rad)/(n rad); null when the value is 0. */
const recip = (a: Val): Val | null => (a.n === 0 ? null : norm({ n: a.d, rad: a.rad, d: a.n * a.rad }));
const div = (a: Val, b: Val): Val | null => {
  const rb = recip(b);
  return rb && mul(a, rb);
};
const valNum = (v: Val) => (v.n * Math.sqrt(v.rad)) / v.d;
const sameVal = (a: Val, b: Val) => a.n === b.n && a.rad === b.rad && a.d === b.d;

/** Typed-answer syntax: "-sqrt(3)/2", "2sqrt(3)/3", "1/2", "0". */
function valText(v: Val): string {
  if (v.n === 0) return "0";
  const c = Math.abs(v.n);
  const body = v.rad === 1 ? `${c}` : c === 1 ? `sqrt(${v.rad})` : `${c}sqrt(${v.rad})`;
  const s = v.n < 0 ? "-" : "";
  return v.d === 1 ? `${s}${body}` : `${s}${body}/${v.d}`;
}

function valTex(v: Val): string {
  if (v.n === 0) return "0";
  const c = Math.abs(v.n);
  const body = v.rad === 1 ? `${c}` : c === 1 ? `\\sqrt{${v.rad}}` : `${c}\\sqrt{${v.rad}}`;
  const s = v.n < 0 ? "-" : "";
  return v.d === 1 ? `${s}${body}` : `${s}\\frac{${body}}{${v.d}}`;
}

// ── Angles as rational multiples of pi ───────────────────────────────────────

interface Ang {
  p: number;
  q: number;
}

function ang(p: number, q: number): Ang {
  if (q < 0) [p, q] = [-p, -q];
  const g = gcd(p, q) || 1;
  return { p: p / g, q: q / g };
}

function angTex(a: Ang): string {
  if (a.p === 0) return "0";
  if (a.q === 1) return a.p === 1 ? "\\pi" : a.p === -1 ? "-\\pi" : `${a.p}\\pi`;
  const c = Math.abs(a.p) === 1 ? "" : `${Math.abs(a.p)}`;
  return `${a.p < 0 ? "-" : ""}\\frac{${c}\\pi}{${a.q}}`;
}

function angText(a: Ang): string {
  if (a.p === 0) return "0";
  if (a.q === 1) return a.p === 1 ? "pi" : a.p === -1 ? "-pi" : `${a.p}pi`;
  const c = Math.abs(a.p) === 1 ? "" : `${Math.abs(a.p)}`;
  return `${a.p < 0 ? "-" : ""}${c}pi/${a.q}`;
}

const angNum = (a: Ang) => (a.p * Math.PI) / a.q;
const degOf = (a: Ang) => (180 * a.p) / a.q;

/** The coterminal angle in [0, 2pi). */
function reduce2pi(a: Ang): Ang {
  const m = 2 * a.q;
  return ang(((a.p % m) + m) % m, a.q);
}

/** 1-4, or 0 for an angle on an axis. */
function quadrantOf(a: Ang): number {
  const r = reduce2pi(a);
  const x = r.p / r.q;
  if (x === 0 || x === 0.5 || x === 1 || x === 1.5) return 0;
  return x < 0.5 ? 1 : x < 1 ? 2 : x < 1.5 ? 3 : 4;
}

/** The reference angle of a non-quadrantal angle. */
function refOf(a: Ang): Ang {
  const r = reduce2pi(a);
  switch (quadrantOf(r)) {
    case 1:
      return r;
    case 2:
      return ang(r.q - r.p, r.q);
    case 3:
      return ang(r.p - r.q, r.q);
    default:
      return ang(2 * r.q - r.p, r.q);
  }
}

const ROMAN = ["", "I", "II", "III", "IV"];

/** First-quadrant (cos, sin) by reference angle p/q of pi. */
const BASE: Record<string, [Val, Val]> = {
  "0/1": [val(1), val(0)],
  "1/6": [val(1, 3, 2), val(1, 1, 2)],
  "1/4": [val(1, 2, 2), val(1, 2, 2)],
  "1/3": [val(1, 1, 2), val(1, 3, 2)],
  "1/2": [val(0), val(1)],
};

function cosSin(a: Ang): [Val, Val] {
  const r = reduce2pi(a);
  const q = quadrantOf(r);
  if (q === 0) {
    const x = r.p / r.q;
    return x === 0 ? [val(1), val(0)] : x === 0.5 ? [val(0), val(1)] : x === 1 ? [val(-1), val(0)] : [val(0), val(-1)];
  }
  const ref = refOf(r);
  const [c, s] = BASE[`${ref.p}/${ref.q}`]!;
  return [q === 1 || q === 4 ? c : negate(c), q <= 2 ? s : negate(s)];
}

type Fn = "sin" | "cos" | "tan" | "csc" | "sec" | "cot";
const fnTex = (f: Fn) => `\\${f}`;

/** "\sin\frac{5\pi}{6}", "\sin 0", "\sin \pi"; parentheses when the angle is negative or a bigger multiple of pi. */
function fnAt(f: Fn, a: Ang): string {
  const t = angTex(a);
  const plain = a.p >= 0 && (a.q > 1 || a.p <= 1);
  return plain ? `${fnTex(f)}${a.q === 1 ? " " : ""}${t}` : `${fnTex(f)}\\left(${t}\\right)`;
}

/** The exact value, or null when it is undefined. */
function trig(f: Fn, a: Ang): Val | null {
  const [c, s] = cosSin(a);
  switch (f) {
    case "sin":
      return s;
    case "cos":
      return c;
    case "tan":
      return div(s, c);
    case "cot":
      return div(c, s);
    case "sec":
      return recip(c);
    case "csc":
      return recip(s);
  }
}

/** Multiples of pi/12 for the sixteen special angles in [0, 2pi). */
const SPECIAL_K = [0, 2, 3, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22];
const NON_AXIS_K = SPECIAL_K.filter((k) => k % 6 !== 0);
const SPECIAL = SPECIAL_K.map((k) => ang(k, 12));
const special = (k: number) => ang(k, 12);

function shuffled<T>(r: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const UNDEFINED = ["undefined", "not defined", "does not exist", "dne", "none"];

// ── Figures ──────────────────────────────────────────────────────────────────

/** A point (x, y) on the terminal side of t, with the angle marked. */
function terminalSideFigure(x: number, y: number): Figure {
  const m = Math.max(Math.abs(x), Math.abs(y)) + 1;
  const dir = x > 0 ? (y > 0 ? "ne" : "se") : y > 0 ? "nw" : "sw";
  return {
    kind: "diagram",
    view: [-m, m, -m, m],
    grid: true,
    points: [
      { name: "O", x: 0, y: 0, label: "", hidden: true },
      { name: "P", x, y, label: md`(${x}, ${y})`, dir },
      { name: "A", x: 1, y: 0, label: "", hidden: true },
      { name: "Q", x, y: 0, label: "", hidden: true },
    ],
    segments: [
      { from: "O", to: "P", kind: "ray", color: 1 },
      { from: "P", to: "Q", dashed: true, color: 2 },
    ],
    angles: [{ at: "O", from: "A", to: "P", label: "t", reflex: y < 0, color: 1 }],
  };
}

const unitCircleDiagram: DiagramSpec = {
  view: [-1.75, 1.75, -1.3, 1.3],
  grid: true,
  params: [{ name: "t", tex: md`t \text{ (radians)}`, min: 0.05, max: 6.25, step: 0.05, value: 0.95 }],
  points: [
    { name: "O", x: 0, y: 0, dir: "sw" },
    { name: "P", x: "cos(t)", y: "sin(t)", label: md`P = ({=cos(t)},\ {=sin(t)})`, dir: "ne" },
    { name: "Q", x: "cos(t)", y: 0, hidden: true, label: "" },
    { name: "A", x: 1, y: 0, label: "(1, 0)", dir: "se" },
    { name: "A2", x: 0.28, y: 0, hidden: true, label: "" },
    { name: "M", x: "0.28cos(t/2)", y: "0.28sin(t/2)", hidden: true, label: "" },
    { name: "P2", x: "0.28cos(t)", y: "0.28sin(t)", hidden: true, label: "" },
  ],
  circles: [{ center: "O", radius: 1 }],
  segments: [
    { from: "O", to: "P", color: 1 },
    { from: "P", to: "Q", dashed: true, color: 2, label: md`\sin t` },
    { from: "O", to: "Q", dashed: true, color: 3, label: md`\cos t` },
  ],
  arcs: [
    { center: "O", from: "A2", to: "M", color: 1 },
    { center: "O", from: "M", to: "P2", color: 1 },
  ],
  labels: [{ x: "0.45cos(t/2)", y: "0.45sin(t/2)", text: "t" }],
  readouts: [
    { label: "t", value: "t" },
    { label: md`\text{in degrees}`, value: "180t/pi", unit: "^\\circ" },
    { label: md`\cos t`, value: "cos(t)" },
    { label: md`\sin t`, value: "sin(t)" },
  ],
  caption: md`Slide $t$. The terminal side meets the unit circle at $P = (\cos t, \sin t)$. The green dashed length along the $x$-axis is $\cos t$ (negative when it points left); the orange one is $\sin t$ (negative when it hangs below). Watch the signs change as $P$ crosses each axis.`,
};

const referenceAngleDiagram: DiagramSpec = {
  view: [-1.75, 1.75, -1.3, 1.3],
  grid: true,
  params: [{ name: "t", tex: md`t \text{ (radians)}`, min: 0.05, max: 6.25, step: 0.05, value: 2.3 }],
  points: [
    { name: "O", x: 0, y: 0, dir: "sw" },
    { name: "P", x: "cos(t)", y: "sin(t)", label: md`P = ({=cos(t)},\ {=sin(t)})`, dir: "ne" },
    { name: "Q", x: "cos(t)", y: 0, hidden: true, label: "" },
    { name: "A2", x: 0.22, y: 0, hidden: true, label: "" },
    { name: "M", x: "0.22cos(t/2)", y: "0.22sin(t/2)", hidden: true, label: "" },
    { name: "P2", x: "0.22cos(t)", y: "0.22sin(t)", hidden: true, label: "" },
  ],
  circles: [{ center: "O", radius: 1 }],
  segments: [
    { from: "O", to: "P", color: 1 },
    { from: "P", to: "Q", dashed: true, color: 2 },
    { from: "O", to: "Q", color: 2 },
  ],
  arcs: [
    { center: "O", from: "A2", to: "M", color: 1 },
    { center: "O", from: "M", to: "P2", color: 1 },
  ],
  angles: [
    { at: "O", from: "Q", to: "P", color: 2, label: "t'", arcs: 2 },
    { at: "Q", from: "O", to: "P", right: true, color: 2 },
  ],
  labels: [{ x: "0.42cos(t/2)", y: "0.42sin(t/2)", text: "t" }],
  readouts: [
    { label: "t", value: "t" },
    { label: md`t'`, value: "acos(abs(cos(t)))" },
    { label: md`\cos t'`, value: "abs(cos(t))" },
    { label: md`\sin t'`, value: "abs(sin(t))" },
  ],
  caption: md`Slide $t$ around the circle. The orange right triangle always stands on the $x$-axis, and its angle at $O$ is the reference angle $t'$. Its legs are $|\cos t|$ and $|\sin t|$, so $\cos t' = |\cos t|$ and $\sin t' = |\sin t|$ no matter which quadrant $P$ is in.`,
};

const firstQuadrantDiagram: DiagramSpec = (() => {
  const on = (k: number) => [Math.cos((k * Math.PI) / 12), Math.sin((k * Math.PI) / 12)] as const;
  const [b, c, d] = [on(2), on(3), on(4)];
  return {
    view: [-0.3, 2.35, -0.3, 1.35],
    grid: true,
    points: [
      { name: "O", x: 0, y: 0, dir: "sw" },
      { name: "A", x: 1, y: 0, label: md`0:\ (1, 0)`, dir: "se" },
      { name: "B", x: b[0], y: b[1], label: md`\tfrac{\pi}{6}:\ \left(\tfrac{\sqrt{3}}{2}, \tfrac{1}{2}\right)`, dir: "e" },
      { name: "C", x: c[0], y: c[1], label: md`\tfrac{\pi}{4}:\ \left(\tfrac{\sqrt{2}}{2}, \tfrac{\sqrt{2}}{2}\right)`, dir: "ne" },
      { name: "D", x: d[0], y: d[1], label: md`\tfrac{\pi}{3}:\ \left(\tfrac{1}{2}, \tfrac{\sqrt{3}}{2}\right)`, dir: "n" },
      { name: "E", x: 0, y: 1, label: md`\tfrac{\pi}{2}:\ (0, 1)`, dir: "nw" },
    ],
    circles: [{ center: "O", radius: 1 }],
    segments: [
      { from: "O", to: "B", color: 1 },
      { from: "O", to: "C", color: 1 },
      { from: "O", to: "D", color: 1 },
    ],
    caption: md`The first quadrant of the unit circle. Each point's $x$-coordinate is the cosine of its angle and its $y$-coordinate is the sine. These five points, and reflections of them, are the whole table.`,
  };
})();

const reflectionsDiagram: DiagramSpec = (() => {
  const on = (k: number) => [Math.cos((k * Math.PI) / 12), Math.sin((k * Math.PI) / 12)] as const;
  const [p1, p2, p3, p4] = [on(2), on(10), on(14), on(22)];
  return {
    view: [-2.05, 2.05, -1.3, 1.3],
    grid: true,
    points: [
      { name: "O", x: 0, y: 0, dir: "sw" },
      { name: "P", x: p1[0], y: p1[1], label: md`\tfrac{\pi}{6}:\ \left(\tfrac{\sqrt{3}}{2}, \tfrac{1}{2}\right)`, dir: "ne" },
      { name: "R", x: p2[0], y: p2[1], label: md`\tfrac{5\pi}{6}:\ \left(-\tfrac{\sqrt{3}}{2}, \tfrac{1}{2}\right)`, dir: "nw" },
      { name: "S", x: p3[0], y: p3[1], label: md`\tfrac{7\pi}{6}:\ \left(-\tfrac{\sqrt{3}}{2}, -\tfrac{1}{2}\right)`, dir: "sw" },
      { name: "T", x: p4[0], y: p4[1], label: md`\tfrac{11\pi}{6}:\ \left(\tfrac{\sqrt{3}}{2}, -\tfrac{1}{2}\right)`, dir: "se" },
    ],
    circles: [{ center: "O", radius: 1 }],
    segments: [
      { from: "O", to: "P", color: 1 },
      { from: "O", to: "R", color: 1 },
      { from: "O", to: "S", color: 1 },
      { from: "O", to: "T", color: 1 },
      { from: "R", to: "P", dashed: true, color: 2 },
      { from: "S", to: "T", dashed: true, color: 2 },
      { from: "P", to: "T", dashed: true, color: 3 },
      { from: "R", to: "S", dashed: true, color: 3 },
    ],
    caption: md`One first-quadrant point and its three mirror images. Across the $y$-axis the $x$-coordinate flips sign (angle $\pi - t$). Across the $x$-axis the $y$-coordinate flips (angle $2\pi - t$). Through the origin both flip (angle $\pi + t$). The sizes never change.`,
  };
})();

// ── Lesson 1 generators ──────────────────────────────────────────────────────

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [5, 12, 13],
  [12, 5, 13],
  [8, 15, 17],
  [15, 8, 17],
  [6, 8, 10],
  [8, 6, 10],
];

/** The ratio for f from a point (x, y) with r = sqrt(r2), as (top, bottom, value); null when undefined. */
function ratioParts(f: Fn, x: number, y: number, r2: number): { top: Val; bottom: Val; value: Val } | null {
  const R = val(1, r2);
  const X = val(x);
  const Y = val(y);
  const [top, bottom] = f === "sin" ? [Y, R] : f === "cos" ? [X, R] : f === "tan" ? [Y, X] : f === "csc" ? [R, Y] : f === "sec" ? [R, X] : [X, Y];
  const value = div(top, bottom);
  return value && { top, bottom, value };
}

const RATIO_WORDS: Record<Fn, string> = {
  sin: md`\sin t = \frac{y}{r}`,
  cos: md`\cos t = \frac{x}{r}`,
  tan: md`\tan t = \frac{y}{x}`,
  csc: md`\csc t = \frac{r}{y}`,
  sec: md`\sec t = \frac{r}{x}`,
  cot: md`\cot t = \frac{x}{y}`,
};

const VERIFY_EQ: Record<Fn, (x: number, y: number) => string> = {
  sin: (x, y) => `v * sqrt((${x})^2 + (${y})^2) = ${y}`,
  cos: (x, y) => `v * sqrt((${x})^2 + (${y})^2) = ${x}`,
  tan: (x, y) => `v * (${x}) = ${y}`,
  csc: (x, y) => `v * (${y}) = sqrt((${x})^2 + (${y})^2)`,
  sec: (x, y) => `v * (${x}) = sqrt((${x})^2 + (${y})^2)`,
  cot: (x, y) => `v * (${y}) = ${x}`,
};

const pointOnTerminalSide: Generator = (r) => {
  const kind = r.int(0, 2);
  let x: number;
  let y: number;
  let f: Fn;
  if (kind === 0) {
    const [a, b] = r.pick(TRIPLES);
    [x, y] = [a * r.sign(), b * r.sign()];
    f = r.pick(["sin", "cos", "tan", "sin", "cos", "sec", "csc", "cot"]);
  } else if (kind === 1) {
    const a = r.int(1, 4);
    [x, y] = [a * r.sign(), a * r.sign()];
    f = r.pick(["sin", "cos", "tan", "sec", "csc", "cot"]);
  } else {
    const [a, b] = r.pick([
      [1, 2],
      [2, 1],
      [1, 3],
      [3, 1],
    ]);
    [x, y] = [a * r.sign(), b * r.sign()];
    f = r.pick(["sin", "cos", "sec", "csc", "tan", "cot"]);
  }
  const r2 = x * x + y * y;
  const parts = ratioParts(f, x, y, r2)!;
  const R = val(1, r2);
  const quadrant = x > 0 ? (y > 0 ? 1 : 4) : y > 0 ? 2 : 3;
  const raw = md`\frac{${valTex(parts.top)}}{${valTex(parts.bottom)}}`;
  const answer = valText(parts.value);
  const steps: Step[] = [
    {
      math: md`r = \sqrt{x^2 + y^2} = \sqrt{(${x})^2 + (${y})^2} = \sqrt{${r2}}${R.rad === 1 ? ` = ${R.n}` : ""}`,
      note: md`The distance from the origin to $(${x}, ${y})$. It is always positive.${R.rad !== 1 ? md` $\sqrt{${r2}}$ has no square factor, so it stays as a root.` : ""}`,
    },
    {
      math: md`${RATIO_WORDS[f]} = ${raw}${valTex(parts.value) === raw ? "" : ` = ${valTex(parts.value)}`}`,
      note:
        parts.value.rad !== 1 && parts.bottom.rad !== 1
          ? md`Rationalize: multiply top and bottom by $\sqrt{${parts.bottom.rad}}$.`
          : f === "tan" || f === "cot"
            ? md`$r$ isn't needed for ${f === "tan" ? "tangent: it's $y$ against $x$" : "cotangent: it's $x$ against $y$"}.`
            : md`Substitute $x = ${x}$, $y = ${y}$, $r = ${valTex(R)}$.`,
    },
    {
      math: md`\text{Quadrant ${ROMAN[quadrant]}: } ${fnTex(f)} t ${parts.value.n < 0 ? "<" : ">"} 0 \ \checkmark`,
      note: md`Sign check: in Quadrant ${ROMAN[quadrant]}, $x$ is ${x > 0 ? "positive" : "negative"} and $y$ is ${y > 0 ? "positive" : "negative"}, so the ratio $${RATIO_WORDS[f].split(" = ")[1]}$ is ${parts.value.n < 0 ? "negative" : "positive"}.`,
    },
  ];
  return {
    prompt: md`The terminal side of an angle $t$ in standard position passes through $(${x}, ${y})$. Find $${fnTex(f)} t$. Give the exact value (a fraction like -3/5, or a root like 2sqrt(5)/5).`,
    figure: terminalSideFigure(x, y),
    answer,
    simplified: true,
    verify: [VERIFY_EQ[f](x, y)],
    hint: md`First find $r = \sqrt{x^2 + y^2}$. Then $${RATIO_WORDS[f]}$. Keep the signs of $x$ and $y$.`,
    solution: steps,
  };
};

const SIGN_OF: Record<Fn, (q: number) => 1 | -1> = {
  sin: (q) => (q <= 2 ? 1 : -1),
  csc: (q) => (q <= 2 ? 1 : -1),
  cos: (q) => (q === 1 || q === 4 ? 1 : -1),
  sec: (q) => (q === 1 || q === 4 ? 1 : -1),
  tan: (q) => (q === 1 || q === 3 ? 1 : -1),
  cot: (q) => (q === 1 || q === 3 ? 1 : -1),
};

const QUADRANTS = ["Quadrant I", "Quadrant II", "Quadrant III", "Quadrant IV"];
const WHY_SIGN: Record<Fn, string> = {
  sin: md`$\sin t = \frac{y}{r}$ has the sign of $y$`,
  csc: md`$\csc t = \frac{r}{y}$ has the sign of $y$`,
  cos: md`$\cos t = \frac{x}{r}$ has the sign of $x$`,
  sec: md`$\sec t = \frac{r}{x}$ has the sign of $x$`,
  tan: md`$\tan t = \frac{y}{x}$ is positive exactly when $x$ and $y$ have the same sign`,
  cot: md`$\cot t = \frac{x}{y}$ is positive exactly when $x$ and $y$ have the same sign`,
};

const quadrantFromSigns: Generator = (r) => {
  const q = r.int(1, 4);
  if (r.next() < 0.6) {
    const [f, g] = r.pick<[Fn, Fn]>([
      ["sin", "cos"],
      ["cos", "sin"],
      ["sin", "tan"],
      ["cos", "tan"],
      ["tan", "sin"],
      ["sec", "sin"],
      ["csc", "cos"],
      ["cot", "cos"],
    ]);
    const sf = SIGN_OF[f](q);
    const sg = SIGN_OF[g](q);
    const word = (s: number) => (s > 0 ? ">" : "<");
    const where = (fn: Fn, s: number) =>
      fn === "sin" || fn === "csc"
        ? s > 0
          ? "upper half (Quadrants I and II)"
          : "lower half (Quadrants III and IV)"
        : fn === "cos" || fn === "sec"
          ? s > 0
            ? "right half (Quadrants I and IV)"
            : "left half (Quadrants II and III)"
          : s > 0
            ? "Quadrant I or III, where $x$ and $y$ have the same sign"
            : "Quadrant II or IV, where $x$ and $y$ have opposite signs";
    return {
      prompt: md`$${fnTex(f)} t ${word(sf)} 0$ and $${fnTex(g)} t ${word(sg)} 0$. In which quadrant does the terminal side of $t$ lie?`,
      choices: QUADRANTS,
      accept: [QUADRANTS[q - 1]!],
      hint: md`$r$ is always positive, so each sign tells you the sign of $x$, of $y$, or of $\frac{y}{x}$.`,
      solution: [
        { math: md`${fnTex(f)} t ${word(sf)} 0`, note: md`${WHY_SIGN[f]}, so the terminal side is in the ${where(f, sf)}.` },
        { math: md`${fnTex(g)} t ${word(sg)} 0`, note: md`${WHY_SIGN[g]}, so it is in the ${where(g, sg)}.` },
        { math: md`\text{Quadrant ${ROMAN[q]}}`, note: `The only quadrant on both lists.` },
      ],
    };
  }
  const askNegative = q !== 1 && r.next() < 0.5;
  const fns: Fn[] = ["sin", "cos", "tan", "csc", "sec", "cot"];
  const pos = shuffled(r, fns.filter((f) => SIGN_OF[f](q) > 0));
  const neg = shuffled(r, fns.filter((f) => SIGN_OF[f](q) < 0));
  const right = askNegative ? neg[0]! : pos[0]!;
  const wrong = askNegative ? pos.slice(0, 2) : neg.slice(0, 2);
  if (q === 1) {
    // Everything is positive in Quadrant I, so ask about the point instead.
    const [x, y] = [r.int(1, 9), r.int(1, 9)];
    const f2 = r.pick(fns);
    return {
      prompt: md`The terminal side of $t$ passes through $(${x}, ${y})$. Which quadrant is $t$ in, and what is the sign of $${fnTex(f2)} t$?`,
      choices: shuffled(r, ["Quadrant I, positive", "Quadrant I, negative", "Quadrant III, positive", "Quadrant II, negative"]),
      accept: ["Quadrant I, positive"],
      hint: "Both coordinates are positive.",
      solution: [
        { math: md`x = ${x} > 0, \quad y = ${y} > 0`, note: "Both coordinates positive: Quadrant I." },
        { math: md`${fnTex(f2)} t > 0`, note: md`Every ratio of $x$, $y$ and $r$ is a quotient of positive numbers, so all six functions are positive in Quadrant I.` },
      ],
    };
  }
  const label = (f: Fn) => md`$${fnTex(f)} t$`;
  return {
    prompt: md`The terminal side of $t$ is in ${QUADRANTS[q - 1]}. Which of these is ${askNegative ? "**negative**" : "**positive**"}?`,
    choices: shuffled(r, [right, ...wrong].map(label)),
    accept: [label(right)],
    hint: md`In Quadrant ${ROMAN[q]}, $x$ is ${q === 1 || q === 4 ? "positive" : "negative"} and $y$ is ${q <= 2 ? "positive" : "negative"}. $r$ is always positive.`,
    solution: [
      { math: md`\text{Quadrant ${ROMAN[q]}: } x ${q === 1 || q === 4 ? ">" : "<"} 0, \ y ${q <= 2 ? ">" : "<"} 0`, note: "Read the signs of the coordinates." },
      { math: md`${fnTex(right)} t ${askNegative ? "<" : ">"} 0`, note: md`${WHY_SIGN[right]}.` },
      { math: wrong.map((f) => md`${fnTex(f)} t ${askNegative ? ">" : "<"} 0`).join(md`, \quad `), note: md`${WHY_SIGN[wrong[0]!]}; ${WHY_SIGN[wrong[1]!]}.` },
    ],
  };
};

const fromOneValue: Generator = (r) => {
  const [a, b, c] = r.pick(TRIPLES.filter((t) => t[2] !== 10));
  const q = r.int(1, 4);
  const sx = q === 1 || q === 4 ? 1 : -1;
  const sy = q <= 2 ? 1 : -1;
  const [x, y] = [sx * a, sy * b];
  const given = r.pick<Fn>(["sin", "cos", "tan", "sin", "cos"]);
  const want = r.pick((["sin", "cos", "tan"] as Fn[]).filter((f) => f !== given));
  const givenVal = ratioParts(given, x, y, c * c)!.value;
  const wantVal = ratioParts(want, x, y, c * c)!.value;
  const givenTex = valTex(givenVal);
  const answer = valText(wantVal);
  const sign = wantVal.n < 0 ? "v = -abs(v)" : "v = abs(v)";
  const g = valText(givenVal);
  const relation =
    given === "sin"
      ? want === "cos"
        ? `v^2 + (${g})^2 = 1`
        : `v^2 * (1 - (${g})^2) = (${g})^2`
      : given === "cos"
        ? want === "sin"
          ? `v^2 + (${g})^2 = 1`
          : `v^2 * (${g})^2 = 1 - (${g})^2`
        : want === "sin"
          ? `v^2 * (1 + (${g})^2) = (${g})^2`
          : `v^2 * (1 + (${g})^2) = 1`;
  const steps: Step[] = [];
  if (given === "sin") {
    steps.push({ math: md`\sin t = \frac{y}{r} = ${givenTex} \;\Rightarrow\; y = ${y}, \ r = ${c}`, note: md`Any point on the terminal side works, so choose the one with $r = ${c}$. Then $y = ${y}$.` });
    steps.push({ math: md`x^2 + (${y})^2 = ${c}^2 \;\Rightarrow\; x^2 = ${c * c - b * b} \;\Rightarrow\; x = \pm ${a}`, note: md`$x^2 + y^2 = r^2$. Squaring hides the sign of $x$.` });
    steps.push({ math: md`\text{Quadrant ${ROMAN[q]}: } x ${sx > 0 ? ">" : "<"} 0, \text{ so } x = ${x}`, note: `The quadrant settles the sign.` });
  } else if (given === "cos") {
    steps.push({ math: md`\cos t = \frac{x}{r} = ${givenTex} \;\Rightarrow\; x = ${x}, \ r = ${c}`, note: md`Choose the point with $r = ${c}$. Then $x = ${x}$.` });
    steps.push({ math: md`(${x})^2 + y^2 = ${c}^2 \;\Rightarrow\; y^2 = ${c * c - a * a} \;\Rightarrow\; y = \pm ${b}`, note: md`$x^2 + y^2 = r^2$.` });
    steps.push({ math: md`\text{Quadrant ${ROMAN[q]}: } y ${sy > 0 ? ">" : "<"} 0, \text{ so } y = ${y}`, note: `The quadrant settles the sign.` });
  } else {
    steps.push({ math: md`\tan t = \frac{y}{x} = ${givenTex}`, note: md`A ratio of $y$ to $x$. The point $(${x}, ${y})$ gives this ratio and lies in Quadrant ${ROMAN[q]} ($x ${sx > 0 ? ">" : "<"} 0$, $y ${sy > 0 ? ">" : "<"} 0$), so use it.` });
    steps.push({ math: md`r = \sqrt{(${x})^2 + (${y})^2} = \sqrt{${c * c}} = ${c}`, note: md`$r$ is always positive.` });
  }
  steps.push({ math: md`${RATIO_WORDS[want]} = ${valTex(wantVal)}`, note: md`Substitute $x = ${x}$, $y = ${y}$, $r = ${c}$.` });
  return {
    prompt: md`$${fnTex(given)} t = ${givenTex}$ and $t$ is in ${QUADRANTS[q - 1]}. Find $${fnTex(want)} t$. Give an exact fraction.`,
    answer,
    simplified: true,
    verify: [relation, sign],
    hint:
      given === "tan"
        ? md`$\tan t = \frac{y}{x}$: pick a point $(x, y)$ with that ratio in the right quadrant, then find $r$.`
        : md`Write the given value as $\frac{${given === "sin" ? "y" : "x"}}{r}$ with $r = ${c}$, then use $x^2 + y^2 = r^2$ to find the other coordinate. The quadrant tells you its sign.`,
    solution: steps,
  };
};

// ── Lesson 2 generators ──────────────────────────────────────────────────────

const QUADRANT_RULE: Record<number, [string, string]> = {
  1: ["t' = t", "the angle itself is already acute"],
  2: ["t' = \\pi - t", "the terminal side and the negative $x$-axis make a straight angle together with $t$"],
  3: ["t' = t - \\pi", "the terminal side has turned a half turn and then $t'$ more"],
  4: ["t' = 2\\pi - t", "$t'$ more brings the terminal side back to a full turn"],
};

function referenceSteps(a: Ang): Step[] {
  const reduced = reduce2pi(a);
  const q = quadrantOf(reduced);
  const ref = refOf(reduced);
  const steps: Step[] = [];
  if (reduced.p !== a.p || reduced.q !== a.q) {
    const turns = Math.floor(a.p / (2 * a.q));
    const k = -turns;
    steps.push({
      math: md`${angTex(a)} ${k > 0 ? "+" : "-"} ${Math.abs(k) === 1 ? "2\\pi" : `${Math.abs(k)}(2\\pi)`} = ${angTex(reduced)}`,
      note: md`First find the coterminal angle in $[0, 2\pi)$: ${k > 0 ? "add" : "subtract"} ${Math.abs(k) === 1 ? "one full turn" : `${Math.abs(k)} full turns`}. Coterminal angles share a terminal side, so they share a reference angle.`,
    });
  }
  const lo = q === 1 ? "0" : q === 2 ? "\\frac{\\pi}{2}" : q === 3 ? "\\pi" : "\\frac{3\\pi}{2}";
  const hi = q === 1 ? "\\frac{\\pi}{2}" : q === 2 ? "\\pi" : q === 3 ? "\\frac{3\\pi}{2}" : "2\\pi";
  steps.push({ math: md`${lo} < ${angTex(reduced)} < ${hi} \;\Rightarrow\; \text{Quadrant ${ROMAN[q]}}`, note: md`Compare with the axes at $0$, $\frac{\pi}{2}$, $\pi$, $\frac{3\pi}{2}$ and $2\pi$.` });
  const [rule, why] = QUADRANT_RULE[q]!;
  const work = q === 1 ? "" : q === 2 ? md`\pi - ${angTex(reduced)} = ` : q === 3 ? md`${angTex(reduced)} - \pi = ` : md`2\pi - ${angTex(reduced)} = `;
  steps.push({ math: md`${rule} \;\Rightarrow\; t' = ${work}${angTex(ref)}`, note: md`In Quadrant ${ROMAN[q]}, ${why}.` });
  return steps;
}

const referenceAngleRadians: Generator = (r) => {
  const kind = r.int(0, 3);
  let a: Ang;
  if (kind <= 1) {
    a = special(r.pick(NON_AXIS_K.filter((k) => k > 6)));
  } else if (kind === 2) {
    const k = r.pick(NON_AXIS_K);
    a = special(r.next() < 0.5 ? k - 24 : k + 24 * r.int(1, 2));
  } else {
    const q = r.pick([5, 7, 8, 9, 10]);
    let p = r.int(q + 1, 2 * q - 1);
    while (gcd(p, q) !== 1 || (2 * p) % q === 0) p = r.int(q + 1, 2 * q - 1);
    a = ang(p, q);
  }
  const ref = refOf(a);
  return {
    prompt: md`Find the reference angle of $t = ${angTex(a)}$. Give it in radians as a multiple of $\pi$, like pi/4.`,
    answer: angText(ref),
    simplified: true,
    // The reference angle is the acute angle with the same |sin| and |cos|.
    verify: [`sin(a) = abs(sin(${angText(a)}))`, `cos(a) = abs(cos(${angText(a)}))`],
    hint:
      kind === 2
        ? md`First add or subtract $2\pi$ until the angle is in $[0, 2\pi)$. Then decide the quadrant and measure to the nearer part of the $x$-axis.`
        : md`Which quadrant is the angle in? Quadrant II: $\pi - t$. Quadrant III: $t - \pi$. Quadrant IV: $2\pi - t$.`,
    solution: referenceSteps(a),
  };
};

const referenceAngleDegrees: Generator = (r) => {
  const q = r.pick([2, 3, 4, 2, 3, 4, 1]);
  const ref = r.pick([r.int(1, 89), r.int(1, 17) * 5, r.pick([30, 45, 60])]);
  const base = q === 1 ? ref : q === 2 ? 180 - ref : q === 3 ? 180 + ref : 360 - ref;
  const shift = r.next() < 0.35 ? r.pick([-360, -360, 360, 720]) : 0;
  const D = base + shift;
  const steps: Step[] = [];
  if (shift !== 0) {
    steps.push({
      math: md`${D}^\circ ${shift < 0 ? "+" : "-"} ${Math.abs(shift) === 360 ? "" : Math.abs(shift) / 360 + "("}360^\circ${Math.abs(shift) === 360 ? "" : ")"} = ${base}^\circ`,
      note: md`A coterminal angle in $[0^\circ, 360^\circ)$ has the same terminal side, so the same reference angle.`,
    });
  }
  const lo = [0, 0, 90, 180, 270][q]!;
  steps.push({ math: md`${lo}^\circ < ${base}^\circ < ${lo + 90}^\circ \;\Rightarrow\; \text{Quadrant ${ROMAN[q]}}`, note: "Locate the terminal side." });
  const work = q === 1 ? md`t' = ${base}^\circ` : q === 2 ? md`t' = 180^\circ - ${base}^\circ = ${ref}^\circ` : q === 3 ? md`t' = ${base}^\circ - 180^\circ = ${ref}^\circ` : md`t' = 360^\circ - ${base}^\circ = ${ref}^\circ`;
  steps.push({ math: work, note: md`${QUADRANT_RULE[q]![1].replace(/^./, (c) => c.toUpperCase())}.` });
  return {
    prompt: md`Find the reference angle of $t = ${D}^\circ$. Answer in degrees.`,
    answer: String(ref),
    verify: [`sin(a pi/180) = abs(sin((${D}) pi/180))`, `cos(a pi/180) = abs(cos((${D}) pi/180))`],
    hint:
      shift !== 0
        ? md`Add or subtract $360^\circ$ until the angle is between $0^\circ$ and $360^\circ$, then measure to the nearer part of the $x$-axis.`
        : md`The reference angle is the acute angle between the terminal side and the $x$-axis. In Quadrant II it is $180^\circ - t$; in III, $t - 180^\circ$; in IV, $360^\circ - t$.`,
    solution: steps,
  };
};

/** Steps that evaluate f at a special angle by reference angle, for the solutions of several generators. */
function evaluateSteps(f: Fn, a: Ang): Step[] {
  const reduced = reduce2pi(a);
  const q = quadrantOf(reduced);
  const steps: Step[] = [];
  if (reduced.p !== a.p || reduced.q !== a.q) {
    const k = -Math.floor(a.p / (2 * a.q));
    steps.push({
      math: md`${fnAt(f, a)} = ${fnTex(f)}\left(${angTex(a)} ${k > 0 ? "+" : "-"} ${Math.abs(k) === 1 ? "2\\pi" : `${Math.abs(k)}(2\\pi)`}\right) = ${fnAt(f, reduced)}`,
      note: md`Coterminal angles meet the unit circle at the same point, so every trig function repeats every $2\pi$.`,
    });
  }
  const value = trig(f, reduced);
  const [c, s] = cosSin(reduced);
  if (q === 0) {
    steps.push({ math: md`\text{Point on the unit circle: } (${valTex(c)}, ${valTex(s)})`, note: md`$${angTex(reduced)}$ lands on an axis.` });
    const basic = f === "sin" || f === "csc" ? md`${fnAt("sin", reduced)} = ${valTex(s)}` : f === "cos" || f === "sec" ? md`${fnAt("cos", reduced)} = ${valTex(c)}` : md`${fnAt("cos", reduced)} = ${valTex(c)}, \quad ${fnAt("sin", reduced)} = ${valTex(s)}`;
    if (f === "sin" || f === "cos") {
      steps.push({ math: basic, note: f === "sin" ? "The sine is the $y$-coordinate." : "The cosine is the $x$-coordinate." });
    } else {
      const formula = f === "tan" ? md`\tan t = \frac{\sin t}{\cos t}` : f === "cot" ? md`\cot t = \frac{\cos t}{\sin t}` : f === "sec" ? md`\sec t = \frac{1}{\cos t}` : md`\csc t = \frac{1}{\sin t}`;
      steps.push({ math: basic, note: "Read the coordinates." });
      steps.push({
        math: value ? md`${formula} = ${valTex(value)}` : md`${formula} = \frac{${f === "tan" ? valTex(s) : f === "cot" ? valTex(c) : "1"}}{0}`,
        note: value ? "" : "Division by zero has no value, so this is undefined.",
      });
    }
    return steps;
  }
  const ref = refOf(reduced);
  const sign = SIGN_OF[f](q);
  const base = trig(f, ref)!;
  steps.push({
    math: md`\text{Quadrant ${ROMAN[q]}: } t' = ${angTex(ref)}, \quad ${fnTex(f)} t ${sign > 0 ? ">" : "<"} 0`,
    note: md`Reference angle and sign. In Quadrant ${ROMAN[q]}, $x$ is ${q === 1 || q === 4 ? "positive" : "negative"} and $y$ is ${q <= 2 ? "positive" : "negative"}.`,
  });
  if (f === "sin" || f === "cos") {
    steps.push(
      q === 1
        ? { math: md`${fnAt(f, reduced)} = ${valTex(value!)}`, note: md`Straight from the first-quadrant table: the ${f === "sin" ? "$y$" : "$x$"}-coordinate of the point at $${angTex(ref)}$.` }
        : {
            math: md`${fnAt(f, reduced)} = ${sign < 0 ? "-" : ""}${fnAt(f, ref)} = ${valTex(value!)}`,
            note: md`$${fnAt(f, ref)} = ${valTex(base)}$ from the first-quadrant table, with the quadrant's sign.`,
          },
    );
  } else {
    const [bc, bs] = cosSin(ref);
    const from = f === "tan" ? md`\frac{\sin t'}{\cos t'} = \frac{${valTex(bs)}}{${valTex(bc)}}` : f === "cot" ? md`\frac{\cos t'}{\sin t'} = \frac{${valTex(bc)}}{${valTex(bs)}}` : f === "sec" ? md`\frac{1}{\cos t'} = \frac{1}{${valTex(bc)}}` : md`\frac{1}{\sin t'} = \frac{1}{${valTex(bs)}}`;
    steps.push({ math: md`${fnTex(f)} t' = ${from} = ${valTex(base)}`, note: base.rad !== 1 && base.d !== 1 ? md`Rationalize the denominator.` : "" });
    steps.push(
      q === 1
        ? { math: md`${fnAt(f, reduced)} = ${valTex(value!)}`, note: "In Quadrant I every function is positive, so this is the value." }
        : { math: md`${fnAt(f, reduced)} = ${sign < 0 ? "-" : ""}${fnAt(f, ref)} = ${valTex(value!)}`, note: "Attach the quadrant's sign." },
    );
  }
  return steps;
}

const evaluateWithReference: Generator = (r) => {
  const f = r.pick<Fn>(["sin", "cos", "sin", "cos", "tan"]);
  const a = special(r.pick(NON_AXIS_K.filter((k) => k > 6)));
  const value = trig(f, a)!;
  return {
    prompt: md`Use the reference angle to evaluate $${fnAt(f, a)}$. Give the exact value, like -sqrt(3)/2.`,
    answer: valText(value),
    simplified: true,
    hint: md`Quadrant first (for the sign), then the reference angle (for the size). $${fnTex(f)}$ of $\frac{\pi}{6}$, $\frac{\pi}{4}$ and $\frac{\pi}{3}$ come from the special right triangles.`,
    solution: evaluateSteps(f, a),
  };
};

// ── Lesson 3 generators ──────────────────────────────────────────────────────

const exactValue: Generator = (r) => {
  const f = r.pick<Fn>(["sin", "cos", "tan", "sin", "cos", "tan"]);
  const a = special(r.pick(SPECIAL_K));
  const value = trig(f, a);
  const common = {
    prompt: md`Evaluate $${fnAt(f, a)}$. Give the exact value, like -sqrt(2)/2, or type undefined.`,
    hint:
      quadrantOf(a) === 0
        ? md`The angle lands on an axis. Which point of the unit circle is that: $(1, 0)$, $(0, 1)$, $(-1, 0)$ or $(0, -1)$? Then $\cos$ is $x$, $\sin$ is $y$ and $\tan$ is $\frac{y}{x}$.`
        : md`Quadrant for the sign, reference angle for the size.`,
    solution: evaluateSteps(f, a),
  };
  return value ? { ...common, answer: valText(value), simplified: true } : { ...common, accept: UNDEFINED };
};

const reciprocalAndBeyond: Generator = (r) => {
  const f = r.pick<Fn>(["sec", "csc", "cot", "sec", "csc", "cot", "sin", "cos", "tan"]);
  const kind = r.int(0, 2);
  let k = r.pick(r.next() < 0.85 ? NON_AXIS_K : SPECIAL_K);
  if (kind === 1) k -= 24;
  if (kind === 2) k += 24 * r.int(1, 2);
  const a = special(k);
  const value = trig(f, a);
  const base = f === "sec" ? "cos" : f === "csc" ? "sin" : f === "cot" ? "tan" : null;
  const common = {
    prompt: md`Evaluate $${fnAt(f, a)}$. Give the exact value with a rational denominator, like -2sqrt(3)/3, or type undefined.`,
    hint: md`${kind !== 0 ? "Add or subtract full turns of $2\\pi$ to get an angle in $[0, 2\\pi)$. " : ""}${base ? `$${fnTex(f)} t$ is the reciprocal of $\\${base} t$${f === "cot" ? ", or $\\frac{\\cos t}{\\sin t}$" : ""}; find that first by quadrant and reference angle.` : "Quadrant for the sign, reference angle for the size."}`,
    solution: evaluateSteps(f, a),
  };
  return value ? { ...common, answer: valText(value), simplified: true } : { ...common, accept: UNDEFINED };
};

const solveOnCircle: Generator = (r) => {
  const f = r.pick<Fn>(["sin", "cos", "tan", "sin", "cos"]);
  // A target value from the table, including 0 and ±1 now and then.
  const k0 = r.pick(f === "tan" ? [0, 2, 3, 4, 2, 3, 4] : [0, 2, 3, 4, 6, 2, 3, 4]);
  let target = trig(f, special(k0))!;
  if (r.sign() < 0 && target.n !== 0) target = negate(target);
  const solutions = SPECIAL.filter((a) => {
    const v = trig(f, a);
    return v !== null && sameVal(v, target);
  });
  const answer = solutions.map(angText).join(", ");
  const ref = target.n === 0 || Math.abs(valNum(target)) === 1 || (f === "tan" && target.n === 0) ? null : refOf(solutions[0]!);
  const quads = solutions.map((a) => quadrantOf(a)).filter((q) => q > 0);
  const steps: Step[] = [];
  if (ref) {
    steps.push({ math: md`${fnTex(f)} t' = ${valTex(target.n < 0 ? negate(target) : target)} \;\Rightarrow\; t' = ${angTex(ref)}`, note: "Ignore the sign for a moment: which first-quadrant angle has this size?" });
    steps.push({
      math: md`${fnTex(f)} t ${target.n < 0 ? "<" : ">"} 0 \text{ in Quadrants ${quads.map((q) => ROMAN[q]).join(" and ")}}`,
      note: md`${WHY_SIGN[f]}.`,
    });
    const placed = (a: Ang) => {
      const q = quadrantOf(a);
      const work = q === 1 ? angTex(ref) : q === 2 ? md`\pi - ${angTex(ref)}` : q === 3 ? md`\pi + ${angTex(ref)}` : md`2\pi - ${angTex(ref)}`;
      return md`Quadrant ${ROMAN[q]}: $t = ${work}${q === 1 ? "" : ` = ${angTex(a)}`}$`;
    };
    steps.push({
      math: solutions.map((a) => md`t = ${angTex(a)}`).join(md`, \quad `),
      note: md`Place the reference angle in each of those quadrants. ${solutions.map(placed).join("; ")}.`,
    });
  } else {
    const where = f === "tan" ? (target.n === 0 ? "where $y = 0$: the points $(1, 0)$ and $(-1, 0)$" : target.n > 0 ? "where $y = x$, on the diagonal through Quadrants I and III" : "where $y = -x$, on the diagonal through Quadrants II and IV") : f === "sin" ? (target.n === 0 ? "where $y = 0$: the points $(1, 0)$ and $(-1, 0)$" : target.n > 0 ? "at the top of the circle, $(0, 1)$" : "at the bottom, $(0, -1)$") : target.n === 0 ? "where $x = 0$: the points $(0, 1)$ and $(0, -1)$" : target.n > 0 ? "at the right, $(1, 0)$" : "at the left, $(-1, 0)$";
    steps.push({ math: md`${fnTex(f)} t = ${valTex(target)}`, note: md`On the unit circle this happens ${where}.` });
    steps.push({ math: solutions.map((a) => md`t = ${angTex(a)}`).join(md`, \quad `), note: md`The angles in $[0, 2\pi)$ that reach ${solutions.length === 1 ? "that point" : "those points"}.` });
  }
  return {
    prompt: md`Solve $${fnTex(f)} t = ${valTex(target)}$ on the interval $[0, 2\pi)$. Give every solution as a multiple of $\pi$ (like 5pi/6), separated by commas.`,
    answer,
    form: "set",
    simplified: true,
    hint: ref
      ? md`Find the reference angle whose $${fnTex(f)}$ has this size, then place it in the two quadrants where $${fnTex(f)}$ has this sign.`
      : md`Values of $0$ and $\pm 1$ happen on the axes. Which axis points have this coordinate?`,
    solution: steps,
  };
};

// ── The unit ─────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "The Unit Circle",
  lessons: [
    {
      id: slug("Trig functions of any angle"),
      title: "Trig functions of any angle",
      summary: "Sine, cosine and tangent for angles of any size, defined from a point on the terminal side, and why on the unit circle they are just coordinates.",
      blocks: [
        {
          kind: "text",
          body: md`In Unit 2 the trig functions were ratios of sides in a right triangle. That only makes sense for angles between $0$ and $\frac{\pi}{2}$: a right triangle can't hold an angle of $150^\circ$, let alone a negative one. But angles in standard position (Unit 1) can be any size at all. We want $\sin$ and $\cos$ of those too.

The way forward is coordinates. Put the angle in standard position, pick any point on its terminal side, and use the point's coordinates in place of the triangle's sides.`,
        },
        {
          kind: "key",
          title: "Trig functions of any angle",
          body: md`Let $t$ be an angle in standard position, and let $(x, y)$ be any point other than the origin on its terminal side. Write $r = \sqrt{x^2 + y^2}$ for its distance from the origin, so $r > 0$. Then

$$\sin t = \frac{y}{r}, \qquad \cos t = \frac{x}{r}, \qquad \tan t = \frac{y}{x},$$

$$\csc t = \frac{r}{y}, \qquad \sec t = \frac{r}{x}, \qquad \cot t = \frac{x}{y}.$$

A ratio with $0$ underneath is **undefined**: $\tan t$ and $\sec t$ when $x = 0$, $\cot t$ and $\csc t$ when $y = 0$.`,
        },
        {
          kind: "why",
          title: "Why this agrees with the right-triangle definition",
          body: md`Take an acute angle $t$ and a point $(x, y)$ on its terminal side, which sits in the first quadrant. Drop a perpendicular from the point to the $x$-axis. You get a right triangle with the angle $t$ at the origin, a horizontal leg of length $x$ next to $t$, a vertical leg of length $y$ opposite $t$, and hypotenuse $r$.

So $\frac{\text{opposite}}{\text{hypotenuse}} = \frac{y}{r}$ and $\frac{\text{adjacent}}{\text{hypotenuse}} = \frac{x}{r}$. The new definition gives exactly the Unit 2 values for every acute angle. Nothing you learned changes; the definition just reaches more angles.`,
        },
        {
          kind: "text",
          body: md`There is a worry to settle. The definition says *any* point on the terminal side. Different points have different coordinates, so why do they all give the same ratio? In Unit 2 the answer was similar triangles, and it's the same answer here.`,
        },
        {
          kind: "proof",
          title: "The ratios depend only on the angle",
          given: md`$P(x_1, y_1)$ and $Q(x_2, y_2)$ are two points on the terminal side of $t$, not on an axis, at distances $r_1$ and $r_2$ from the origin $O$.`,
          prove: md`$\dfrac{y_1}{r_1} = \dfrac{y_2}{r_2}$`,
          steps: [
            { statement: md`Let $A = (x_1, 0)$ and $B = (x_2, 0)$.`, reason: md`The feet of the perpendiculars from $P$ and $Q$ to the $x$-axis.` },
            { statement: md`$\angle PAO = \angle QBO = 90^\circ$`, reason: md`$\overline{PA}$ and $\overline{QB}$ are perpendicular to the $x$-axis.` },
            { statement: md`$\angle POA = \angle QOB$`, reason: md`They are the same angle: $P$ and $Q$ lie on one ray from $O$, and $A$, $B$ lie on one ray along the $x$-axis ($x_1$ and $x_2$ have the same sign, since $P$ and $Q$ are on the same side of the $y$-axis).` },
            { statement: md`$\triangle POA \sim \triangle QOB$`, reason: "AA similarity (Geometry, Unit 6)." },
            { statement: md`$\dfrac{PA}{QB} = \dfrac{OP}{OQ}$, that is, $\dfrac{|y_1|}{|y_2|} = \dfrac{r_1}{r_2}$`, reason: md`Corresponding sides of similar triangles are proportional. $PA = |y_1|$ is the distance from $P$ to the $x$-axis, and $OP = r_1$.` },
            { statement: md`$\dfrac{|y_1|}{r_1} = \dfrac{|y_2|}{r_2}$`, reason: md`Multiply both sides by $\dfrac{|y_2|}{r_1}$.` },
            { statement: md`$\dfrac{y_1}{r_1} = \dfrac{y_2}{r_2}$`, reason: md`$y_1$ and $y_2$ have the same sign (same side of the $x$-axis), and $r_1, r_2 > 0$, so the two ratios have the same sign as well as the same size.` },
          ],
        },
        {
          kind: "text",
          body: md`The same triangles give $\frac{x_1}{r_1} = \frac{x_2}{r_2}$ (using $OA = |x_1|$ and $OB = |x_2|$), and dividing the two results gives $\frac{y_1}{x_1} = \frac{y_2}{x_2}$. If the terminal side lies on an axis, every point on it has $x = 0$ or $y = 0$, and the ratios are $0$, $\pm 1$ or undefined for all of them at once. So the six functions really are functions of the angle alone.

Since any point will do, choose the most convenient one: the point at distance $1$. The circle of radius $1$ centered at the origin is the **unit circle**, $x^2 + y^2 = 1$, and every terminal side crosses it exactly once.`,
        },
        { kind: "diagram", ...unitCircleDiagram },
        {
          kind: "key",
          title: "The unit circle",
          body: md`If $t$ is in standard position, the point where its terminal side meets the unit circle is

$$(\cos t, \ \sin t).$$

Cosine is the $x$-coordinate and sine is the $y$-coordinate. The other four functions follow:

$$\tan t = \frac{\sin t}{\cos t}, \quad \cot t = \frac{\cos t}{\sin t}, \quad \sec t = \frac{1}{\cos t}, \quad \csc t = \frac{1}{\sin t}.$$`,
        },
        {
          kind: "why",
          title: "Why the point is (cos t, sin t)",
          body: md`On the unit circle $r = 1$, so the definitions collapse: $\cos t = \frac{x}{1} = x$ and $\sin t = \frac{y}{1} = y$. Then $\tan t = \frac{y}{x} = \frac{\sin t}{\cos t}$, and the reciprocals follow the same way.

This also explains the identity $\sin^2 t + \cos^2 t = 1$ at a glance: the point $(\cos t, \sin t)$ is on the circle $x^2 + y^2 = 1$. Unit 5 builds on this.`,
        },
        {
          kind: "example",
          title: "All six from one point",
          problem: md`The terminal side of $t$ passes through $(-3, 4)$. Find the six trig functions of $t$.`,
          steps: [
            { math: md`r = \sqrt{(-3)^2 + 4^2} = \sqrt{25} = 5`, note: md`$r$ is a distance, so it's positive even though $x$ is negative.` },
            { math: md`\sin t = \frac{y}{r} = \frac{4}{5}, \qquad \cos t = \frac{x}{r} = -\frac{3}{5}, \qquad \tan t = \frac{y}{x} = -\frac{4}{3}`, note: "Substitute. The signs come from the coordinates." },
            { math: md`\csc t = \frac{5}{4}, \qquad \sec t = -\frac{5}{3}, \qquad \cot t = -\frac{3}{4}`, note: "Flip each of the first three." },
          ],
        },
        {
          kind: "key",
          title: "Signs by quadrant",
          body: md`$$\begin{array}{c|cccc} & \text{I} & \text{II} & \text{III} & \text{IV} \\ \hline x = \cos t & + & - & - & + \\ y = \sin t & + & + & - & - \\ \tan t = y/x & + & - & + & - \end{array}$$

Each reciprocal has the sign of its partner: $\sec$ goes with $\cos$, $\csc$ with $\sin$, $\cot$ with $\tan$.`,
        },
        {
          kind: "why",
          title: "Why the signs work out this way",
          body: md`$r$ is always positive, so dividing by it never changes a sign. That means $\sin t = \frac{y}{r}$ has the sign of $y$: positive above the $x$-axis (Quadrants I and II), negative below. And $\cos t = \frac{x}{r}$ has the sign of $x$: positive to the right of the $y$-axis (Quadrants I and IV), negative to the left.

$\tan t = \frac{y}{x}$ is a quotient of two signed numbers. It's positive when they agree (I and III) and negative when they differ (II and IV). You don't need to memorize the table; read it off the coordinates.`,
        },
        {
          kind: "text",
          body: md`**Angles on the axes.** When the terminal side lies along an axis, the unit-circle point is one of $(1, 0)$, $(0, 1)$, $(-1, 0)$ or $(0, -1)$, and the values are immediate:

$$\cos 0 = 1, \ \sin 0 = 0; \qquad \cos\tfrac{\pi}{2} = 0, \ \sin\tfrac{\pi}{2} = 1; \qquad \cos\pi = -1, \ \sin\pi = 0; \qquad \cos\tfrac{3\pi}{2} = 0, \ \sin\tfrac{3\pi}{2} = -1.$$

So $\tan\frac{\pi}{2} = \frac{1}{0}$ is undefined, and so is $\sec\frac{\pi}{2}$; $\cot 0$ and $\csc 0$ are undefined too. "Undefined" is the honest answer, not $\infty$: there is no number that works.`,
        },
        {
          kind: "example",
          title: "From one value to the others",
          problem: md`$\sin t = -\frac{3}{5}$ and $t$ is in Quadrant IV. Find $\cos t$ and $\tan t$.`,
          steps: [
            { math: md`\frac{y}{r} = -\frac{3}{5} \;\Rightarrow\; \text{take } y = -3, \ r = 5`, note: md`Any point on the terminal side works, so pick the one with $r = 5$.` },
            { math: md`x^2 + (-3)^2 = 5^2 \;\Rightarrow\; x^2 = 16 \;\Rightarrow\; x = \pm 4`, note: md`$x^2 + y^2 = r^2$. Squaring lost the sign of $x$.` },
            { math: md`\text{Quadrant IV: } x > 0, \text{ so } x = 4`, note: "The quadrant decides." },
            { math: md`\cos t = \frac{x}{r} = \frac{4}{5}, \qquad \tan t = \frac{y}{x} = -\frac{3}{4}`, note: "Substitute." },
          ],
        },
        {
          kind: "check",
          prompt: md`The terminal side of $t$ passes through $(5, -12)$. Find $\cos t$.`,
          answer: "5/13",
          simplified: true,
          explain: md`$r = \sqrt{25 + 144} = 13$, so $\cos t = \frac{x}{r} = \frac{5}{13}$. Positive, as it should be in Quadrant IV.`,
        },
        {
          kind: "check",
          prompt: md`$\sin t > 0$ and $\tan t < 0$. In which quadrant is the terminal side of $t$?`,
          choices: QUADRANTS,
          accept: ["Quadrant II"],
          explain: md`$\sin t > 0$ means $y > 0$: Quadrant I or II. $\tan t < 0$ means $x$ and $y$ have opposite signs: Quadrant II or IV. Only Quadrant II is on both lists.`,
        },
      ],
      practice: [pointOnTerminalSide, quadrantFromSigns, fromOneValue],
    },
    {
      id: slug("Reference angles"),
      title: "Reference angles",
      summary: "Every angle's trig values come from one acute angle folded against the x-axis, with the quadrant fixing the sign.",
      blocks: [
        {
          kind: "text",
          body: md`On the unit circle the point at $30^\circ$ is $\left(\frac{\sqrt{3}}{2}, \frac{1}{2}\right)$, from the 30-60-90 triangle of Unit 2. The point at $150^\circ$ turns out to be $\left(-\frac{\sqrt{3}}{2}, \frac{1}{2}\right)$: the same two numbers, one sign flipped. That is no coincidence. The two points are mirror images of each other across the $y$-axis.

This lesson turns that observation into a method. Every angle has an acute partner whose trig values it shares, up to sign.`,
        },
        {
          kind: "key",
          title: "Reference angle",
          body: md`The **reference angle** $t'$ of an angle $t$ in standard position (not on an axis) is the acute angle between the terminal side and the $x$-axis. It is always between $0$ and $\frac{\pi}{2}$. For $t$ in $[0, 2\pi)$:

$$\text{I: } t' = t \qquad \text{II: } t' = \pi - t \qquad \text{III: } t' = t - \pi \qquad \text{IV: } t' = 2\pi - t$$

In degrees, replace $\pi$ by $180^\circ$ and $2\pi$ by $360^\circ$. For an angle outside $[0, 2\pi)$, first replace it with its coterminal angle inside that range.`,
        },
        {
          kind: "why",
          title: "Why those four formulas",
          body: md`The $x$-axis is a straight line through the origin, so the positive and negative halves make a straight angle of $\pi$ between them.

- **Quadrant II:** the terminal side sits between the positive $y$-axis and the negative $x$-axis. The angle $t$ from the positive $x$-axis and the angle $t'$ on to the negative $x$-axis together make the straight angle: $t + t' = \pi$.
- **Quadrant III:** the terminal side has passed the negative $x$-axis (a half turn, $\pi$) and gone $t'$ further: $t = \pi + t'$.
- **Quadrant IV:** turning $t'$ more would complete the full turn: $t + t' = 2\pi$.
- **Quadrant I:** the angle is already acute, so $t' = t$.

Coterminal angles share a terminal side, so they share a reference angle. That's why you can reduce to $[0, 2\pi)$ first.`,
        },
        { kind: "diagram", ...referenceAngleDiagram },
        {
          kind: "proof",
          title: "The trig values of t are those of t', up to sign",
          given: md`$t$ is in standard position, not on an axis, with reference angle $t'$. $P = (x, y)$ is where its terminal side meets the unit circle.`,
          prove: md`$|x| = \cos t'$ and $|y| = \sin t'$, so $\cos t = \pm\cos t'$ and $\sin t = \pm\sin t'$.`,
          steps: [
            { statement: md`Let $Q = (x, 0)$.`, reason: md`The foot of the perpendicular from $P$ to the $x$-axis.` },
            { statement: md`$OQ = |x|$ and $PQ = |y|$`, reason: md`$Q$ is $|x|$ along the axis from $O$; $P$ is $|y|$ above or below the axis.` },
            { statement: md`$OP = 1$`, reason: md`$P$ is on the unit circle.` },
            { statement: md`$\angle POQ = t'$`, reason: md`$Q$ is on the $x$-axis on $P$'s side, so $\angle POQ$ is the acute angle between the terminal side and the $x$-axis: the reference angle, by definition.` },
            { statement: md`$\triangle OPQ$ is a right triangle with its right angle at $Q$`, reason: md`$\overline{PQ} \perp$ the $x$-axis.` },
            { statement: md`$\cos t' = \dfrac{OQ}{OP} = |x|$ and $\sin t' = \dfrac{PQ}{OP} = |y|$`, reason: md`Right-triangle ratios (Unit 2): adjacent over hypotenuse and opposite over hypotenuse, with hypotenuse $1$.` },
            { statement: md`$\cos t = x = \pm\cos t'$ and $\sin t = y = \pm\sin t'$`, reason: md`Unit-circle definition (lesson 1). The sign is the sign of $x$ or $y$, which the quadrant decides.` },
          ],
        },
        {
          kind: "text",
          body: md`Because $\tan$, $\cot$, $\sec$ and $\csc$ are built from $\sin$ and $\cos$, the same holds for them: each equals plus or minus its value at $t'$. So every trig value of every angle is a first-quadrant value with a sign attached.`,
        },
        {
          kind: "key",
          title: "Evaluating with a reference angle",
          body: md`To find a trig function of any angle $t$:

1. If needed, add or subtract multiples of $2\pi$ (or $360^\circ$) to land in $[0, 2\pi)$.
2. Find the quadrant. It fixes the **sign** (lesson 1).
3. Find the reference angle $t'$. It fixes the **size**: the function's value at $t'$, from the special triangles.`,
        },
        {
          kind: "why",
          title: "Why the x-axis, and not the y-axis?",
          body: md`The right triangle in the proof stands on the $x$-axis, so its horizontal leg is $|x|$ and its vertical leg is $|y|$. Adjacent to the angle at $O$ is the horizontal leg, which is why $\cos t'$ comes out as $|x| = |\cos t|$: the roles match.

Measure to the $y$-axis instead and the triangle stands on its side. The leg adjacent to that angle is now $|y|$, so its cosine is $|\sin t|$, not $|\cos t|$. The values get swapped. (That swap is real and useful, $\cos\left(\frac{\pi}{2} - t\right) = \sin t$, but it is a different fact.) Always fold against the $x$-axis.`,
        },
        {
          kind: "example",
          title: "Finding reference angles",
          problem: md`Find the reference angle of $\frac{5\pi}{6}$, of $\frac{4\pi}{3}$ and of $\frac{7\pi}{4}$.`,
          steps: [
            { math: md`\tfrac{\pi}{2} < \tfrac{5\pi}{6} < \pi \;\Rightarrow\; \text{II}, \quad t' = \pi - \tfrac{5\pi}{6} = \tfrac{\pi}{6}`, note: md`$\frac{5\pi}{6}$ is $\frac{\pi}{6}$ short of a half turn.` },
            { math: md`\pi < \tfrac{4\pi}{3} < \tfrac{3\pi}{2} \;\Rightarrow\; \text{III}, \quad t' = \tfrac{4\pi}{3} - \pi = \tfrac{\pi}{3}`, note: md`$\frac{\pi}{3}$ past the half turn.` },
            { math: md`\tfrac{3\pi}{2} < \tfrac{7\pi}{4} < 2\pi \;\Rightarrow\; \text{IV}, \quad t' = 2\pi - \tfrac{7\pi}{4} = \tfrac{\pi}{4}`, note: md`$\frac{\pi}{4}$ short of a full turn.` },
          ],
        },
        {
          kind: "example",
          title: "Angles outside [0, 2π)",
          problem: md`Find the reference angle of $\frac{11\pi}{4}$ and of $-\frac{2\pi}{3}$.`,
          steps: [
            { math: md`\tfrac{11\pi}{4} - 2\pi = \tfrac{3\pi}{4}`, note: md`$\frac{11\pi}{4}$ is more than one turn. Subtract $2\pi = \frac{8\pi}{4}$.` },
            { math: md`\tfrac{\pi}{2} < \tfrac{3\pi}{4} < \pi \;\Rightarrow\; \text{II}, \quad t' = \pi - \tfrac{3\pi}{4} = \tfrac{\pi}{4}`, note: "" },
            { math: md`-\tfrac{2\pi}{3} + 2\pi = \tfrac{4\pi}{3}`, note: md`A negative angle turns clockwise. Add a full turn to get its coterminal angle in $[0, 2\pi)$.` },
            { math: md`\pi < \tfrac{4\pi}{3} < \tfrac{3\pi}{2} \;\Rightarrow\; \text{III}, \quad t' = \tfrac{4\pi}{3} - \pi = \tfrac{\pi}{3}`, note: "" },
          ],
        },
        {
          kind: "example",
          title: "Evaluating with the recipe",
          problem: md`Find $\cos\frac{5\pi}{6}$ and $\sin\frac{7\pi}{4}$.`,
          steps: [
            { math: md`\tfrac{5\pi}{6}: \text{ Quadrant II, so } \cos < 0; \quad t' = \tfrac{\pi}{6}`, note: md`Sign from the quadrant ($x < 0$ on the left), size from the reference angle.` },
            { math: md`\cos\tfrac{5\pi}{6} = -\cos\tfrac{\pi}{6} = -\tfrac{\sqrt{3}}{2}`, note: md`$\cos\frac{\pi}{6} = \frac{\sqrt{3}}{2}$ from the 30-60-90 triangle.` },
            { math: md`\tfrac{7\pi}{4}: \text{ Quadrant IV, so } \sin < 0; \quad t' = \tfrac{\pi}{4}`, note: md`$y < 0$ below the $x$-axis.` },
            { math: md`\sin\tfrac{7\pi}{4} = -\sin\tfrac{\pi}{4} = -\tfrac{\sqrt{2}}{2}`, note: md`$\sin\frac{\pi}{4} = \frac{\sqrt{2}}{2}$ from the 45-45-90 triangle.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the reference angle of $\frac{5\pi}{4}$. Give it as a multiple of $\pi$, like pi/3.`,
          answer: "pi/4",
          simplified: true,
          explain: md`$\pi < \frac{5\pi}{4} < \frac{3\pi}{2}$, so Quadrant III, and $t' = \frac{5\pi}{4} - \pi = \frac{\pi}{4}$.`,
        },
        {
          kind: "check",
          prompt: md`Use the reference angle to evaluate $\sin\frac{4\pi}{3}$. Give the exact value, like -sqrt(2)/2.`,
          answer: "-sqrt(3)/2",
          simplified: true,
          explain: md`$\frac{4\pi}{3}$ is in Quadrant III, where $\sin < 0$. Its reference angle is $\frac{4\pi}{3} - \pi = \frac{\pi}{3}$, and $\sin\frac{\pi}{3} = \frac{\sqrt{3}}{2}$. So $\sin\frac{4\pi}{3} = -\frac{\sqrt{3}}{2}$.`,
        },
      ],
      practice: [referenceAngleRadians, referenceAngleDegrees, evaluateWithReference],
    },
    {
      id: slug("Exact values"),
      title: "Exact values",
      summary: "The whole unit circle from two triangles: the exact-value table, why it repeats, periodicity, and even and odd symmetry.",
      blocks: [
        {
          kind: "text",
          body: md`Two right triangles give every exact value you will ever need. From Unit 2: in a 45-45-90 triangle with hypotenuse $1$ both legs are $\frac{\sqrt{2}}{2}$, and in a 30-60-90 triangle with hypotenuse $1$ the legs are $\frac{1}{2}$ (opposite $30^\circ$) and $\frac{\sqrt{3}}{2}$ (opposite $60^\circ$).

Put each triangle inside the unit circle with its acute angle at the origin, and the far vertex lands on the circle. Its coordinates are $(\cos t, \sin t)$.`,
        },
        {
          kind: "why",
          title: "Where the square roots come from",
          body: md`**45-45-90.** The two legs are equal, say $a$. Pythagoras with hypotenuse $1$: $a^2 + a^2 = 1$, so $a^2 = \frac{1}{2}$ and $a = \frac{1}{\sqrt{2}} = \frac{\sqrt{2}}{2}$.

**30-60-90.** Start with an equilateral triangle of side $1$; its angles are all $60^\circ$. Cut it in half along an altitude. Each half is a right triangle with hypotenuse $1$, a short leg of $\frac{1}{2}$ (half the base), and angles $30^\circ$ and $60^\circ$. The other leg is $\sqrt{1 - \frac{1}{4}} = \frac{\sqrt{3}}{2}$. The short leg is opposite the $30^\circ$ angle, so $\sin\frac{\pi}{6} = \frac{1}{2}$ and $\cos\frac{\pi}{6} = \frac{\sqrt{3}}{2}$. Swap them for $\frac{\pi}{3}$.`,
        },
        { kind: "diagram", ...firstQuadrantDiagram },
        {
          kind: "key",
          title: "First-quadrant values",
          body: md`$$\begin{array}{c|ccccc} t & 0 & \frac{\pi}{6} & \frac{\pi}{4} & \frac{\pi}{3} & \frac{\pi}{2} \\ \hline \sin t & 0 & \frac{1}{2} & \frac{\sqrt{2}}{2} & \frac{\sqrt{3}}{2} & 1 \\[4pt] \cos t & 1 & \frac{\sqrt{3}}{2} & \frac{\sqrt{2}}{2} & \frac{1}{2} & 0 \\[4pt] \tan t & 0 & \frac{\sqrt{3}}{3} & 1 & \sqrt{3} & \text{undefined} \end{array}$$

A pattern to remember the sines: $\frac{\sqrt{0}}{2}, \frac{\sqrt{1}}{2}, \frac{\sqrt{2}}{2}, \frac{\sqrt{3}}{2}, \frac{\sqrt{4}}{2}$. The cosines are the same list backwards.`,
        },
        {
          kind: "why",
          title: "Why the cosines are the sines backwards",
          body: md`In a right triangle the two acute angles add to $\frac{\pi}{2}$. The leg opposite one of them is adjacent to the other. So the sine of one angle is the cosine of the other: $\cos t = \sin\left(\frac{\pi}{2} - t\right)$. Reading the table, $\cos\frac{\pi}{6} = \sin\frac{\pi}{3}$, $\cos\frac{\pi}{4} = \sin\frac{\pi}{4}$, and so on.

And $\tan t = \frac{\sin t}{\cos t}$ each time: $\frac{1/2}{\sqrt{3}/2} = \frac{1}{\sqrt{3}} = \frac{\sqrt{3}}{3}$, while $\frac{\sqrt{3}/2}{1/2} = \sqrt{3}$.`,
        },
        { kind: "diagram", ...reflectionsDiagram },
        {
          kind: "why",
          title: "Why the table repeats around the circle",
          body: md`The unit circle is symmetric across both axes and through the origin, and each symmetry carries one first-quadrant point to a point in another quadrant without changing the size of either coordinate.

- Reflecting across the $y$-axis sends $(x, y)$ to $(-x, y)$ and the angle $t$ to $\pi - t$.
- Reflecting through the origin sends $(x, y)$ to $(-x, -y)$ and $t$ to $\pi + t$.
- Reflecting across the $x$-axis sends $(x, y)$ to $(x, -y)$ and $t$ to $2\pi - t$ (or $-t$).

This is the reference-angle idea of lesson 2 seen as symmetry. The sixteen special points of the circle are five first-quadrant points plus their mirror images, with signs by quadrant.`,
        },
        {
          kind: "key",
          title: "The special points of the unit circle",
          body: md`Written as angle: $(\cos t, \sin t)$.

$$\text{I: } \ 0: (1, 0) \quad \tfrac{\pi}{6}: \left(\tfrac{\sqrt{3}}{2}, \tfrac{1}{2}\right) \quad \tfrac{\pi}{4}: \left(\tfrac{\sqrt{2}}{2}, \tfrac{\sqrt{2}}{2}\right) \quad \tfrac{\pi}{3}: \left(\tfrac{1}{2}, \tfrac{\sqrt{3}}{2}\right) \quad \tfrac{\pi}{2}: (0, 1)$$

$$\text{II: } \ \tfrac{2\pi}{3}: \left(-\tfrac{1}{2}, \tfrac{\sqrt{3}}{2}\right) \quad \tfrac{3\pi}{4}: \left(-\tfrac{\sqrt{2}}{2}, \tfrac{\sqrt{2}}{2}\right) \quad \tfrac{5\pi}{6}: \left(-\tfrac{\sqrt{3}}{2}, \tfrac{1}{2}\right) \quad \pi: (-1, 0)$$

$$\text{III: } \ \tfrac{7\pi}{6}: \left(-\tfrac{\sqrt{3}}{2}, -\tfrac{1}{2}\right) \quad \tfrac{5\pi}{4}: \left(-\tfrac{\sqrt{2}}{2}, -\tfrac{\sqrt{2}}{2}\right) \quad \tfrac{4\pi}{3}: \left(-\tfrac{1}{2}, -\tfrac{\sqrt{3}}{2}\right) \quad \tfrac{3\pi}{2}: (0, -1)$$

$$\text{IV: } \ \tfrac{5\pi}{3}: \left(\tfrac{1}{2}, -\tfrac{\sqrt{3}}{2}\right) \quad \tfrac{7\pi}{4}: \left(\tfrac{\sqrt{2}}{2}, -\tfrac{\sqrt{2}}{2}\right) \quad \tfrac{11\pi}{6}: \left(\tfrac{\sqrt{3}}{2}, -\tfrac{1}{2}\right)$$

Don't memorize this as a list. Memorize the first-quadrant row and the sign table, and rebuild the rest in your head.`,
        },
        {
          kind: "example",
          title: "Tangent and secant",
          problem: md`Find $\tan\frac{5\pi}{3}$ and $\sec\frac{7\pi}{6}$.`,
          steps: [
            { math: md`\tfrac{5\pi}{3}: \text{ Quadrant IV}, \quad t' = 2\pi - \tfrac{5\pi}{3} = \tfrac{\pi}{3}`, note: md`In Quadrant IV, $x > 0$ and $y < 0$, so $\tan = \frac{y}{x} < 0$.` },
            { math: md`\tan\tfrac{5\pi}{3} = -\tan\tfrac{\pi}{3} = -\sqrt{3}`, note: md`Or directly from the point $\left(\frac{1}{2}, -\frac{\sqrt{3}}{2}\right)$: $\frac{y}{x} = \frac{-\sqrt{3}/2}{1/2} = -\sqrt{3}$.` },
            { math: md`\tfrac{7\pi}{6}: \text{ Quadrant III}, \quad t' = \tfrac{7\pi}{6} - \pi = \tfrac{\pi}{6}, \quad \cos < 0`, note: md`$x < 0$ in Quadrant III.` },
            { math: md`\sec\tfrac{7\pi}{6} = \frac{1}{\cos\frac{7\pi}{6}} = \frac{1}{-\sqrt{3}/2} = -\frac{2}{\sqrt{3}} = -\frac{2\sqrt{3}}{3}`, note: "Flip the cosine, then rationalize the denominator." },
          ],
        },
        {
          kind: "key",
          title: "Periodicity",
          body: md`Adding a full turn changes nothing:

$$\sin(t + 2\pi) = \sin t, \qquad \cos(t + 2\pi) = \cos t,$$

and the same for $\sec$ and $\csc$. Tangent and cotangent repeat twice as fast:

$$\tan(t + \pi) = \tan t, \qquad \cot(t + \pi) = \cot t.$$

The smallest positive shift that repeats a function is its **period**: $2\pi$ for sine and cosine, $\pi$ for tangent.`,
        },
        {
          kind: "why",
          title: "Why tangent repeats every half turn",
          body: md`$t$ and $t + 2\pi$ are coterminal: same terminal side, same point on the unit circle, same coordinates. That is the whole reason sine and cosine have period $2\pi$.

A half turn is different. Turning $(x, y)$ by $\pi$ about the origin gives $(-x, -y)$, the point diametrically opposite. Both coordinates flip sign, so $\sin$ and $\cos$ do change. But their ratio doesn't:

$$\tan(t + \pi) = \frac{-y}{-x} = \frac{y}{x} = \tan t.$$

Geometrically, $t$ and $t + \pi$ lie on the same line through the origin, and tangent is the slope of that line.`,
        },
        {
          kind: "proof",
          title: "Cosine is even and sine is odd",
          given: md`$P$ is where the terminal side of $t$ meets the unit circle, and $P'$ is the same for $-t$.`,
          prove: md`$\cos(-t) = \cos t$ and $\sin(-t) = -\sin t$`,
          steps: [
            { statement: md`$P = (\cos t, \sin t)$ and $P' = (\cos(-t), \sin(-t))$`, reason: "Unit-circle definition (lesson 1)." },
            { statement: md`Reflecting across the $x$-axis carries the terminal side of $t$ onto the terminal side of $-t$.`, reason: md`The reflection fixes the positive $x$-axis and reverses the direction of turning, so a counterclockwise turn of $t$ becomes a clockwise turn of $t$, which is the angle $-t$.` },
            { statement: md`The reflection carries $P$ to $P'$.`, reason: md`It maps the unit circle to itself (distances from $O$ are preserved), so the terminal side's crossing point goes to the other terminal side's crossing point.` },
            { statement: md`$P' = (\cos t, -\sin t)$`, reason: md`Reflection across the $x$-axis sends $(x, y)$ to $(x, -y)$ (Geometry).` },
            { statement: md`$\cos(-t) = \cos t$ and $\sin(-t) = -\sin t$`, reason: "Compare the two descriptions of $P'$, coordinate by coordinate." },
          ],
        },
        {
          kind: "text",
          body: md`So $\cos$ is an **even** function and $\sin$ is **odd**, in the sense of Algebra 2. Dividing, $\tan(-t) = \frac{-\sin t}{\cos t} = -\tan t$: tangent is odd too, and so are $\cot$ and $\csc$, while $\sec$ is even. For a negative angle you can either add $2\pi$ or use these: $\sin\left(-\frac{\pi}{6}\right) = -\sin\frac{\pi}{6} = -\frac{1}{2}$.`,
        },
        {
          kind: "example",
          title: "A large angle and a negative one",
          problem: md`Find $\cos\frac{13\pi}{4}$ and $\csc\left(-\frac{\pi}{3}\right)$.`,
          steps: [
            { math: md`\tfrac{13\pi}{4} - 2\pi = \tfrac{5\pi}{4}`, note: md`One full turn is $\frac{8\pi}{4}$. Cosine has period $2\pi$, so $\cos\frac{13\pi}{4} = \cos\frac{5\pi}{4}$.` },
            { math: md`\tfrac{5\pi}{4}: \text{ Quadrant III}, \ t' = \tfrac{\pi}{4}, \quad \cos\tfrac{13\pi}{4} = -\tfrac{\sqrt{2}}{2}`, note: md`$x < 0$ in Quadrant III.` },
            { math: md`\sin\left(-\tfrac{\pi}{3}\right) = -\sin\tfrac{\pi}{3} = -\tfrac{\sqrt{3}}{2}`, note: "Sine is odd." },
            { math: md`\csc\left(-\tfrac{\pi}{3}\right) = \frac{1}{-\sqrt{3}/2} = -\frac{2}{\sqrt{3}} = -\frac{2\sqrt{3}}{3}`, note: "Reciprocal, then rationalize." },
          ],
        },
        {
          kind: "example",
          title: "Reading the circle backwards",
          problem: md`Find every $t$ in $[0, 2\pi)$ with $\cos t = -\frac{1}{2}$.`,
          steps: [
            { math: md`\cos t' = \tfrac{1}{2} \;\Rightarrow\; t' = \tfrac{\pi}{3}`, note: "First the size: which first-quadrant angle has cosine one half?" },
            { math: md`\cos t < 0 \text{ in Quadrants II and III}`, note: md`$x < 0$ on the left half of the circle.` },
            { math: md`t = \pi - \tfrac{\pi}{3} = \tfrac{2\pi}{3} \quad\text{or}\quad t = \pi + \tfrac{\pi}{3} = \tfrac{4\pi}{3}`, note: "Place the reference angle in each of those quadrants. Two answers, one per quadrant." },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $\cot\frac{5\pi}{6}$. Give the exact value.`,
          answer: "-sqrt(3)",
          simplified: true,
          explain: md`$\frac{5\pi}{6}$ is in Quadrant II with $t' = \frac{\pi}{6}$. $\cot = \frac{x}{y}$ is negative there. $\cot\frac{\pi}{6} = \frac{\sqrt{3}/2}{1/2} = \sqrt{3}$, so $\cot\frac{5\pi}{6} = -\sqrt{3}$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\sin t = -\frac{\sqrt{2}}{2}$ on $[0, 2\pi)$. Separate the solutions with commas.`,
          answer: "5pi/4, 7pi/4",
          form: "set",
          simplified: true,
          explain: md`$\sin t' = \frac{\sqrt{2}}{2}$ gives $t' = \frac{\pi}{4}$. Sine is negative in Quadrants III and IV: $t = \pi + \frac{\pi}{4} = \frac{5\pi}{4}$ and $t = 2\pi - \frac{\pi}{4} = \frac{7\pi}{4}$.`,
        },
      ],
      practice: [exactValue, reciprocalAndBeyond, solveOnCircle],
    },
  ],
};
