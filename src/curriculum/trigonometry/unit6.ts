import { gcd, poly } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Angles as rational multiples of pi ──────────────────────────────────────

/** The angle n·pi/d. */
type Frac = [number, number];
type Fn = "sin" | "cos" | "tan";

function reduce([n, d]: Frac): Frac {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}

const radians = ([n, d]: Frac) => (n / d) * Math.PI;

/** n·pi/d as LaTeX: 0, \pi, \frac{5\pi}{6}, -\frac{\pi}{3}. */
function angTex(f: Frac): string {
  let [n, d] = reduce(f);
  if (n === 0) return "0";
  const sign = n < 0 ? "-" : "";
  n = Math.abs(n);
  const top = n === 1 ? "\\pi" : `${n}\\pi`;
  return d === 1 ? `${sign}${top}` : `${sign}\\frac{${top}}{${d}}`;
}

/** n·pi/d as typed: 0, pi, 5pi/6, -pi/3. */
function angText(f: Frac): string {
  let [n, d] = reduce(f);
  if (n === 0) return "0";
  const sign = n < 0 ? "-" : "";
  n = Math.abs(n);
  const top = n === 1 ? "pi" : `${n}pi`;
  return d === 1 ? `${sign}${top}` : `${sign}${top}/${d}`;
}

const sortAngles = (fs: Frac[]) => fs.map(reduce).sort((a, b) => a[0] / a[1] - b[0] / b[1]);
const listTex = (fs: Frac[]) => fs.map(angTex).join(",\\ ");
const listText = (fs: Frac[]) => fs.map(angText).join(", ");
const addTurns = ([n, d]: Frac, turns: number): Frac => [n + 2 * d * turns, d];

// ── Special values ──────────────────────────────────────────────────────────

interface Val {
  /** Signed value as LaTeX and as typed text. */
  tex: string;
  text: string;
  v: number;
  neg: boolean;
  kind: "zero" | "one" | "negone" | "ref";
  /** First-quadrant reference angle whose function value is |value|, when there is one. */
  ref: Frac | null;
  magTex: string;
  magText: string;
}

const MAG: Record<string, { tex: string; text: string; v: number }> = {
  "0": { tex: "0", text: "0", v: 0 },
  "1": { tex: "1", text: "1", v: 1 },
  "1/2": { tex: "\\frac{1}{2}", text: "1/2", v: 0.5 },
  "sqrt(2)/2": { tex: "\\frac{\\sqrt{2}}{2}", text: "sqrt(2)/2", v: Math.SQRT2 / 2 },
  "sqrt(3)/2": { tex: "\\frac{\\sqrt{3}}{2}", text: "sqrt(3)/2", v: Math.sqrt(3) / 2 },
  "sqrt(3)/3": { tex: "\\frac{\\sqrt{3}}{3}", text: "sqrt(3)/3", v: Math.sqrt(3) / 3 },
  "sqrt(3)": { tex: "\\sqrt{3}", text: "sqrt(3)", v: Math.sqrt(3) },
};

const REF: Record<Fn, Record<string, Frac>> = {
  sin: { "1/2": [1, 6], "sqrt(2)/2": [1, 4], "sqrt(3)/2": [1, 3] },
  cos: { "1/2": [1, 3], "sqrt(2)/2": [1, 4], "sqrt(3)/2": [1, 6] },
  tan: { "sqrt(3)/3": [1, 6], "1": [1, 4], "sqrt(3)": [1, 3] },
};

/** The value named by a key like "-sqrt(3)/2", as the output of fn. */
function val(fn: Fn, key: string): Val {
  const neg = key.startsWith("-");
  const mag = neg ? key.slice(1) : key;
  const m = MAG[mag]!;
  const ref = REF[fn][mag] ?? null;
  const kind = mag === "0" ? "zero" : ref ? "ref" : neg ? "negone" : "one";
  return { tex: neg ? `-${m.tex}` : m.tex, text: neg ? `-${m.text}` : m.text, v: neg ? -m.v : m.v, neg, kind, ref, magTex: m.tex, magText: m.text };
}

const SIN_KEYS = ["0", "1", "-1", "1/2", "-1/2", "sqrt(2)/2", "-sqrt(2)/2", "sqrt(3)/2", "-sqrt(3)/2"];
const TAN_KEYS = ["0", "1", "-1", "sqrt(3)", "-sqrt(3)", "sqrt(3)/3", "-sqrt(3)/3"];
const keysFor = (fn: Fn) => (fn === "tan" ? TAN_KEYS : SIN_KEYS);

const FN_TEX: Record<Fn, string> = { sin: "\\sin", cos: "\\cos", tan: "\\tan" };
const INV_TEX: Record<Fn, string> = { sin: "\\arcsin", cos: "\\arccos", tan: "\\arctan" };
const INV_NAME: Record<Fn, string> = { sin: "arcsin", cos: "arccos", tan: "arctan" };
const INV_TYPED: Record<Fn, string> = { sin: "asin", cos: "acos", tan: "atan" };
const FN_NAME: Record<Fn, string> = { sin: "sine", cos: "cosine", tan: "tangent" };
const RANGE_TEX: Record<Fn, string> = { sin: "-\\frac{\\pi}{2} \\le y \\le \\frac{\\pi}{2}", cos: "0 \\le y \\le \\pi", tan: "-\\frac{\\pi}{2} < y < \\frac{\\pi}{2}" };

/** All solutions of fn(t) = c with 0 <= t < 2pi. */
function solveOnTurn(fn: Fn, c: Val): Frac[] {
  if (c.kind === "zero") return fn === "cos" ? [[1, 2], [3, 2]] : [[0, 1], [1, 1]];
  if (c.kind === "one") return fn === "sin" ? [[1, 2]] : [[0, 1]];
  if (c.kind === "negone") return fn === "sin" ? [[3, 2]] : [[1, 1]];
  const [n, d] = c.ref!;
  const q1: Frac = [n, d];
  const q2: Frac = [d - n, d];
  const q3: Frac = [d + n, d];
  const q4: Frac = [2 * d - n, d];
  if (fn === "sin") return c.neg ? [q3, q4] : [q1, q2];
  if (fn === "cos") return c.neg ? [q2, q3] : [q1, q4];
  return c.neg ? [q2, q4] : [q1, q3];
}

const CAP: Record<Fn, string> = { sin: "Sine", cos: "Cosine", tan: "Tangent" };

/** Which quadrants fn has the sign of c in, and how the two angles are built from the reference angle r. `v` names the angle variable. */
function quadrantNote(fn: Fn, c: Val, v = "t"): string {
  const name = CAP[fn];
  if (fn === "sin") return c.neg ? md`${name} is negative in quadrants III and IV, so $${v} = \pi + r$ and $${v} = 2\pi - r$.` : md`${name} is positive in quadrants I and II, so $${v} = r$ and $${v} = \pi - r$.`;
  if (fn === "cos") return c.neg ? md`${name} is negative in quadrants II and III, so $${v} = \pi - r$ and $${v} = \pi + r$.` : md`${name} is positive in quadrants I and IV, so $${v} = r$ and $${v} = 2\pi - r$.`;
  return c.neg ? md`${name} is negative in quadrants II and IV, so $${v} = \pi - r$ and $${v} = 2\pi - r$.` : md`${name} is positive in quadrants I and III, so $${v} = r$ and $${v} = \pi + r$.`;
}

/** Why fn(v) = c has the axis solutions it has, for c = 0, 1 or -1. */
function axisNote(fn: Fn, c: Val): string {
  if (c.kind === "zero") {
    if (fn === "cos") return md`The unit-circle point has $x = 0$ at the top and bottom of the circle.`;
    if (fn === "sin") return md`The unit-circle point has $y = 0$ on the positive and negative $x$-axis.`;
    return md`$\tan = \frac{y}{x}$ is 0 where $y = 0$: on the $x$-axis.`;
  }
  return fn === "sin" ? md`$y = ${c.tex}$ happens at exactly one point of the unit circle, the ${c.neg ? "bottom" : "top"}.` : md`$x = ${c.tex}$ happens at exactly one point of the unit circle, the ${c.neg ? "left" : "right"} end.`;
}

/** Steps that solve fn(v) = c on [0, 2pi) once the function is isolated. `v` is the angle variable (t or u). */
function solveSteps(fn: Fn, c: Val, v = "t"): Step[] {
  const list = listTex(sortAngles(solveOnTurn(fn, c)));
  if (c.kind !== "ref") {
    return [{ math: md`${v} = ${list}`, note: md`${axisNote(fn, c)} No reference angle is needed for $0$, $1$ or $-1$: read the answer off the circle.` }];
  }
  return [
    { math: md`r = ${angTex(c.ref!)}`, note: md`Reference angle: the first-quadrant angle with $${FN_TEX[fn]} r = ${c.magTex}$, from the exact-value table (Unit 3).` },
    { math: md`${v} = ${list}`, note: quadrantNote(fn, c, v) },
  ];
}

/** arcsin c, arccos c or arctan c as a multiple of pi. */
function principal(fn: Fn, c: Val): Frac {
  if (c.kind === "zero") return fn === "cos" ? [1, 2] : [0, 1];
  if (c.kind === "one") return fn === "sin" ? [1, 2] : [0, 1];
  if (c.kind === "negone") return fn === "sin" ? [-1, 2] : [1, 1];
  const [n, d] = c.ref!;
  if (fn === "cos") return c.neg ? [d - n, d] : [n, d];
  return c.neg ? [-n, d] : [n, d];
}

/** Exact value of fn at the angle n·pi/d (d dividing 12); null where tangent is undefined. */
function exact(fn: Fn, a: Frac): Val | null {
  const [n, d] = reduce(a);
  const m = (((n % (2 * d)) + 2 * d) % (2 * d)) as number;
  let r: number;
  let quad: 1 | 2 | 3 | 4;
  if (2 * m <= d) [r, quad] = [m, 1];
  else if (m <= d) [r, quad] = [d - m, 2];
  else if (2 * m <= 3 * d) [r, quad] = [m - d, 3];
  else [r, quad] = [2 * d - m, 4];
  const [rn, rd] = reduce([r, d]);
  const key = `${rn}/${rd}`;
  const table: Record<Fn, Record<string, string | undefined>> = {
    sin: { "0/1": "0", "1/2": "1", "1/6": "1/2", "1/4": "sqrt(2)/2", "1/3": "sqrt(3)/2" },
    cos: { "0/1": "1", "1/2": "0", "1/6": "sqrt(3)/2", "1/4": "sqrt(2)/2", "1/3": "1/2" },
    tan: { "0/1": "0", "1/2": undefined, "1/6": "sqrt(3)/3", "1/4": "1", "1/3": "sqrt(3)" },
  };
  const mag = table[fn][key];
  if (mag === undefined) return null;
  const positive = fn === "sin" ? quad <= 2 : fn === "cos" ? quad === 1 || quad === 4 : quad === 1 || quad === 3;
  return val(fn, positive || mag === "0" ? mag : `-${mag}`);
}

const QUAD_NAME = ["", "I", "II", "III", "IV"];
function quadrantOf(a: Frac): number {
  const x = ((radians(a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return x < Math.PI / 2 ? 1 : x < Math.PI ? 2 : x < (3 * Math.PI) / 2 ? 3 : 4;
}

// ── Lesson 1 generators ─────────────────────────────────────────────────────

const ANGLE_FORMAT = md`Give the angle in radians as a multiple of $\pi$: type pi/6 to mean $\frac{\pi}{6}$, -pi/4 to mean $-\frac{\pi}{4}$, and 0 to mean $0$.`;

const inverseValues: Generator = (r) => {
  const fn = r.pick<Fn>(["sin", "cos", "tan"]);
  const c = val(fn, r.pick(keysFor(fn)));
  const ans = principal(fn, c);
  const inv = INV_TEX[fn];
  const steps: Step[] = [{ math: md`y = ${inv}\left(${c.tex}\right) \iff ${FN_TEX[fn]} y = ${c.tex},\quad ${RANGE_TEX[fn]}`, note: md`The definition. Only one angle in that interval has ${FN_NAME[fn]} equal to $${c.tex}$.` }];
  if (c.kind === "ref") {
    const rf = c.ref!;
    steps.push({ math: md`${FN_TEX[fn]}\left(${angTex(rf)}\right) = ${c.magTex}`, note: "The first-quadrant angle from the exact-value table." });
    if (c.neg && fn === "cos") {
      steps.push({ math: md`\cos\left(\pi - ${angTex(rf)}\right) = -\cos\left(${angTex(rf)}\right) = ${c.tex}`, note: md`A negative cosine needs a quadrant II angle, and $[0, \pi]$ contains quadrant II but not quadrant III. Reflecting $(x, y)$ across the $y$-axis gives the angle $\pi - r$ with $x$-coordinate $-x$.` });
    } else if (c.neg) {
      steps.push({ math: md`${FN_TEX[fn]}\left(-${angTex(rf)}\right) = -${FN_TEX[fn]}\left(${angTex(rf)}\right) = ${c.tex}`, note: md`${FN_NAME[fn] === "sine" ? "Sine" : "Tangent"} is odd (Unit 3), and $-${angTex(rf)}$ lies in the allowed interval. Other angles with the same ${FN_NAME[fn]} exist, but they are outside it.` });
    }
  } else {
    const where = fn === "cos" ? (c.kind === "zero" ? md`$x = 0$ at the top of the unit circle, angle $\frac{\pi}{2}$, which is in $[0, \pi]$.` : c.kind === "one" ? md`$x = 1$ only at the point $(1, 0)$, angle $0$.` : md`$x = -1$ only at $(-1, 0)$, angle $\pi$.`) : fn === "sin" ? (c.kind === "zero" ? md`$y = 0$ at angle $0$, the only such angle in $[-\frac{\pi}{2}, \frac{\pi}{2}]$.` : c.kind === "one" ? md`$y = 1$ only at the top of the circle, angle $\frac{\pi}{2}$.` : md`$y = -1$ only at the bottom, angle $-\frac{\pi}{2}$.`) : md`$\tan y = 0$ means $\sin y = 0$, and the only such angle in $(-\frac{\pi}{2}, \frac{\pi}{2})$ is $0$.`;
    steps.push({ math: md`${FN_TEX[fn]}\left(${angTex(ans)}\right) = ${c.tex}`, note: where });
  }
  steps.push({ math: md`${inv}\left(${c.tex}\right) = ${angTex(ans)}`, note: "" });
  return {
    prompt: md`Evaluate $${inv}\left(${c.tex}\right)$. ${ANGLE_FORMAT}`,
    answer: angText(ans),
    hint: md`Which angle in $${RANGE_TEX[fn].replace(/y/g, "t")}$ has ${FN_NAME[fn]} equal to $${c.tex}$? ${c.neg ? "The answer is not a quadrant III angle, even though one of those has the right value." : "Use the exact-value table."}`,
    solution: steps,
  };
};

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
];

const compositions: Generator = (r) => {
  const kind = r.int(0, 3);
  // Fix a side; the rest follows from sin^2 + cos^2 = 1 and the sign of the quadrant.
  const [a, b, c] = r.pick(TRIPLES);
  const neg = r.next() < 0.5;
  const sgn = neg ? "-" : "";
  const quadNote = (inner: Fn) =>
    inner === "cos"
      ? neg
        ? md`$\cos t < 0$ and $0 \le t \le \pi$, so $t$ is in quadrant II: $\sin t > 0$.`
        : md`$\cos t > 0$ and $0 \le t \le \pi$, so $t$ is in quadrant I: $\sin t > 0$.`
      : neg
        ? md`$${FN_TEX[inner]} t < 0$ and $-\frac{\pi}{2} \le t \le \frac{\pi}{2}$, so $t$ is in quadrant IV: $\cos t > 0$ and $\sin t < 0$.`
        : md`$${FN_TEX[inner]} t > 0$ and $-\frac{\pi}{2} \le t \le \frac{\pi}{2}$, so $t$ is in quadrant I: everything is positive.`;
  const FORMAT = "Give an exact fraction, like 4/5 or -5/12, with any root rationalized (2sqrt(5)/5, not 2/sqrt(5)).";
  if (kind === 0) {
    // cos(arcsin(±a/c)) = b/c, or sin(arccos(±a/c)) = b/c.
    const inner = r.pick<Fn>(["sin", "cos"]);
    const outer: Fn = inner === "sin" ? "cos" : "sin";
    return {
      prompt: md`Evaluate $${FN_TEX[outer]}\left(${INV_TEX[inner]}\left(${sgn}\frac{${a}}{${c}}\right)\right)$. ${FORMAT}`,
      answer: `${b}/${c}`,
      simplified: true,
      hint: md`Name the inner angle: let $t = ${INV_TEX[inner]}\left(${sgn}\frac{${a}}{${c}}\right)$, so $${FN_TEX[inner]} t = ${sgn}\frac{${a}}{${c}}$. Then use $\sin^2 t + \cos^2 t = 1$, and decide the sign from the quadrant $t$ must lie in.`,
      solution: [
        { math: md`t = ${INV_TEX[inner]}\left(${sgn}\frac{${a}}{${c}}\right) \iff ${FN_TEX[inner]} t = ${sgn}\frac{${a}}{${c}},\quad ${RANGE_TEX[inner].replace(/y/g, "t")}`, note: "Give the angle a name. The question is now about an ordinary angle." },
        { math: md`${FN_TEX[outer]}^2 t = 1 - \left(${sgn}\frac{${a}}{${c}}\right)^2 = \frac{${c * c - a * a}}{${c * c}}`, note: md`Pythagorean identity: $\sin^2 t + \cos^2 t = 1$.` },
        { math: md`${FN_TEX[outer]} t = \frac{${b}}{${c}}`, note: md`${quadNote(inner)} So the positive root.` },
      ],
    };
  }
  if (kind === 1) {
    // tan(arcsin(±a/c)) = ±a/b, or tan(arccos(±a/c)) = ±b/a.
    const inner = r.pick<Fn>(["sin", "cos"]);
    const [num, den] = inner === "sin" ? [a, b] : [b, a];
    const g = gcd(num, den);
    const ans = `${neg ? "-" : ""}${num / g}/${den / g}`;
    return {
      prompt: md`Evaluate $\tan\left(${INV_TEX[inner]}\left(${sgn}\frac{${a}}{${c}}\right)\right)$. ${FORMAT}`,
      answer: ans,
      simplified: true,
      hint: md`Let $t = ${INV_TEX[inner]}\left(${sgn}\frac{${a}}{${c}}\right)$. Find the other leg with $\sin^2 t + \cos^2 t = 1$ (a ${a}-${b}-${c} triangle), then $\tan t = \frac{\sin t}{\cos t}$. Watch the sign.`,
      solution: [
        { math: md`${FN_TEX[inner]} t = ${sgn}\frac{${a}}{${c}},\quad ${RANGE_TEX[inner].replace(/y/g, "t")}`, note: md`Where $t = ${INV_TEX[inner]}\left(${sgn}\frac{${a}}{${c}}\right)$.` },
        { math: inner === "sin" ? md`\cos t = \sqrt{1 - \frac{${a * a}}{${c * c}}} = \frac{${b}}{${c}}` : md`\sin t = \sqrt{1 - \frac{${a * a}}{${c * c}}} = \frac{${b}}{${c}}`, note: md`${quadNote(inner)}` },
        { math: md`\tan t = \frac{\sin t}{\cos t} = \frac{${inner === "sin" ? `${sgn}${a}/${c}` : `${b}/${c}`}}{${inner === "sin" ? `${b}/${c}` : `${sgn}${a}/${c}`}} = ${neg ? "-" : ""}\frac{${num}}{${den}}${g > 1 ? ` = ${neg ? "-" : ""}\\frac{${num / g}}{${den / g}}` : ""}`, note: md`The ${c}'s cancel. ${neg ? "One of the two is negative, so the quotient is negative." : "Both are positive."}` },
      ],
    };
  }
  if (kind === 2) {
    // sin(arctan(±a/b)) = ±a/c, cos(arctan(±a/b)) = b/c.
    const outer = r.pick<Fn>(["sin", "cos"]);
    const ans = outer === "sin" ? `${sgn}${a}/${c}` : `${b}/${c}`;
    return {
      prompt: md`Evaluate $${FN_TEX[outer]}\left(\arctan\left(${sgn}\frac{${a}}{${b}}\right)\right)$. ${FORMAT}`,
      answer: ans,
      simplified: true,
      hint: md`Let $t = \arctan\left(${sgn}\frac{${a}}{${b}}\right)$, so $\tan t = ${sgn}\frac{${a}}{${b}}$: opposite ${a}, adjacent ${b}. The hypotenuse is $\sqrt{${a}^2 + ${b}^2}$. Then read off $${FN_TEX[outer]} t$ and fix the sign by quadrant.`,
      solution: [
        { math: md`\tan t = ${sgn}\frac{${a}}{${b}},\quad -\frac{\pi}{2} < t < \frac{\pi}{2}`, note: md`Where $t = \arctan\left(${sgn}\frac{${a}}{${b}}\right)$.` },
        { math: md`\text{hyp} = \sqrt{${a}^2 + ${b}^2} = ${c}`, note: md`Reference triangle with opposite ${a} and adjacent ${b}. The triangle only gives sizes; signs come next.` },
        { math: md`${FN_TEX[outer]} t = ${outer === "sin" ? `${sgn}\\frac{${a}}{${c}}` : `\\frac{${b}}{${c}}`}`, note: md`${neg ? md`$\tan t < 0$ with $t$ in $(-\frac{\pi}{2}, \frac{\pi}{2})$ puts $t$ in quadrant IV: cosine positive, sine negative.` : md`$t$ is in quadrant I, where everything is positive.`}` },
      ],
    };
  }
  // sin(arctan k) = k/sqrt(1 + k^2) and cos(arctan k) = 1/sqrt(1 + k^2): the root has to be rationalized.
  const k = r.pick([1, 2, 3]);
  const n = 1 + k * k; // 2, 5, 10: no square factors
  const outer = r.pick<Fn>(["sin", "cos"]);
  const num = outer === "sin" ? k : 1;
  const ans = `${neg && outer === "sin" ? "-" : ""}${num === 1 ? "" : num}sqrt(${n})/${n}`;
  const ansTex = `${neg && outer === "sin" ? "-" : ""}\\frac{${num === 1 ? "" : num}\\sqrt{${n}}}{${n}}`;
  return {
    prompt: md`Evaluate $${FN_TEX[outer]}\left(\arctan\left(${sgn}${k}\right)\right)$. ${FORMAT}`,
    answer: ans,
    simplified: true,
    hint: md`$\tan t = ${sgn}${k} = ${sgn}\frac{${k}}{1}$: a reference triangle with opposite ${k} and adjacent 1. Its hypotenuse is $\sqrt{${k * k} + 1}$. Rationalize at the end.`,
    solution: [
      { math: md`\tan t = ${sgn}${k},\quad -\frac{\pi}{2} < t < \frac{\pi}{2}`, note: md`Where $t = \arctan(${sgn}${k})$.` },
      { math: md`\text{hyp} = \sqrt{${k}^2 + 1^2} = \sqrt{${n}}`, note: md`Opposite ${k}, adjacent 1.` },
      { math: md`${FN_TEX[outer]} t = ${neg && outer === "sin" ? "-" : ""}\frac{${num}}{\sqrt{${n}}} = ${ansTex}`, note: md`${neg ? md`$t$ is in quadrant IV, so sine is negative and cosine positive.` : md`$t$ is in quadrant I.`} Multiply top and bottom by $\sqrt{${n}}$ to rationalize.` },
    ],
  };
};

const inverseOfFunction: Generator = (r) => {
  const fn = r.pick<Fn>(["sin", "cos", "tan"]);
  // Angles k·pi/6 and k·pi/4 within two turns, mostly outside the inverse's range.
  const d = r.pick([6, 4, 3]);
  let n = r.int(-2 * d, 2 * d);
  // Tangent is undefined at odd multiples of pi/2: where 2n/d is an odd integer.
  const tanUndefined = (k: number) => (2 * k) % d === 0 && ((2 * k) / d) % 2 !== 0;
  while (fn === "tan" && tanUndefined(n)) n = r.int(-2 * d, 2 * d);
  const a: Frac = reduce([n, d]);
  const value = exact(fn, a)!;
  const ans = principal(fn, value);
  const inside = fn === "sin" ? radians(a) >= -Math.PI / 2 - 1e-9 && radians(a) <= Math.PI / 2 + 1e-9 : fn === "cos" ? radians(a) >= -1e-9 && radians(a) <= Math.PI + 1e-9 : Math.abs(radians(a)) < Math.PI / 2;
  const inv = INV_TEX[fn];
  const steps: Step[] = inside
    ? [{ math: md`${inv}\left(${FN_TEX[fn]}\left(${angTex(a)}\right)\right) = ${angTex(a)}`, note: md`$${angTex(a)}$ is already in the interval $${RANGE_TEX[fn].replace(/y/g, "t")}$, so ${INV_NAME[fn]} undoes ${FN_NAME[fn]} exactly.` }]
    : [
        { math: md`${FN_TEX[fn]}\left(${angTex(a)}\right) = ${value.tex}`, note: md`Work from the inside out. $${angTex(a)}$ is ${value.kind === "ref" ? md`in quadrant ${QUAD_NAME[quadrantOf(a)]} with reference angle $${angTex(value.ref!)}$` : "on an axis"}, so the exact-value table gives this.` },
        { math: md`${inv}\left(${value.tex}\right) = ${angTex(ans)}`, note: md`The angle in $${RANGE_TEX[fn].replace(/y/g, "t")}$ with ${FN_NAME[fn]} $${value.tex}$. It is not $${angTex(a)}$: that angle is outside the interval, so ${INV_NAME[fn]} can't return it.` },
      ];
  return {
    prompt: md`Evaluate $${inv}\left(${FN_TEX[fn]}\left(${angTex(a)}\right)\right)$. ${ANGLE_FORMAT}`,
    answer: angText(ans),
    hint: inside ? md`Is $${angTex(a)}$ inside the range of ${INV_NAME[fn]}, $${RANGE_TEX[fn].replace(/y/g, "t")}$? If so, the two functions cancel.` : md`$${inv}(${FN_TEX[fn]} t) = t$ only when $t$ is in $${RANGE_TEX[fn].replace(/y/g, "t")}$. Here it isn't. Evaluate the inside first, then ask which angle in that interval has that ${FN_NAME[fn]}.`,
    solution: steps,
  };
};

// ── Lesson 2 generators ─────────────────────────────────────────────────────

const SET_FORMAT = md`List every solution, separated by commas, as multiples of $\pi$ (type pi/6, 5pi/6 to mean $\frac{\pi}{6}, \frac{5\pi}{6}$; type 0 to mean $0$).`;

/** |value| = p·sqrt(s)/q for the special values. */
const PARTS: Record<string, [number, number]> = { "0": [1, 1], "1": [1, 1], "1/2": [1, 2], "sqrt(2)/2": [2, 2], "sqrt(3)/2": [3, 2], "sqrt(3)/3": [3, 3], "sqrt(3)": [3, 1] };
const rootTex = (s: number) => (s === 1 ? "1" : `\\sqrt{${s}}`);
const rootText = (s: number) => (s === 1 ? "1" : `sqrt(${s})`);

/**
 * An equation equivalent to fn(arg) = c, written three ways, with the steps that isolate the function.
 * Returns LaTeX, typed text (for verify) and the isolating steps.
 */
function linearEquation(r: { int(a: number, b: number): number; next(): number }, fn: Fn, c: Val, argTex = "t", argText = "t"): { tex: string; text: string; steps: Step[] } {
  const [s, q] = PARTS[c.magText]!;
  // "\sin t" but "\sin(2t)": no space before a bracket.
  const f = /^[(\\]/.test(argTex) ? `${FN_TEX[fn]}${argTex}` : `${FN_TEX[fn]} ${argTex}`;
  const ftext = `${fn}(${argText})`;
  const P = c.kind === "zero" ? 0 : c.neg ? -1 : 1; // sign of the constant on the right
  const Ptex = P === 0 ? "0" : `${P < 0 ? "-" : ""}${rootTex(s)}`;
  const Ptext = P === 0 ? "0" : `${P < 0 ? "-" : ""}${rootText(s)}`;
  const qf = `${q === 1 ? "" : q}${f}`;
  const qftext = `${q === 1 ? "" : q}${ftext}`;
  const isolate: Step = q === 1 ? { math: md`${f} = ${c.tex}`, note: "" } : { math: md`${f} = ${c.tex}`, note: md`Divide both sides by ${q}.` };
  const form = P === 0 ? 0 : s === 1 ? r.int(0, 2) : r.int(0, 1);
  if (form === 0) {
    // q f = P
    return { tex: `${qf} = ${Ptex}`, text: `${qftext} = ${Ptext}`, steps: q === 1 ? [] : [isolate] };
  }
  if (form === 1) {
    // q f - P = 0
    const sign = P < 0 ? "+" : "-";
    return {
      tex: `${qf} ${sign} ${rootTex(s)} = 0`,
      text: `${qftext} ${sign} ${rootText(s)} = 0`,
      steps: [{ math: md`${qf} = ${Ptex}`, note: md`${P < 0 ? "Subtract" : "Add"} $${rootTex(s)}$ on both sides.` }, ...(q === 1 ? [] : [isolate])],
    };
  }
  // (q + k) f + m = k f + (m + P), integers only
  const k = r.int(1, 3);
  const m = r.int(1, 6);
  return {
    tex: `${q + k}${f} + ${m} = ${k === 1 ? "" : k}${f} + ${m + P}`,
    text: `${q + k}${ftext} + ${m} = ${k}${ftext} + ${m + P}`,
    steps: [
      { math: md`${qf} + ${m} = ${m + P}`, note: md`Subtract $${k === 1 ? "" : k}${f}$ from both sides: $${f}$ is the unknown here, so collect it like $x$.` },
      { math: md`${qf} = ${P}`, note: md`Subtract ${m}.` },
      ...(q === 1 ? [] : [isolate]),
    ],
  };
}

const linearEquations: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 4) {
    // Approximate: a value not on the table, smallest positive solution to 3 decimal places.
    const fn = r.pick<Fn>(["sin", "cos", "tan"]);
    const c = fn === "tan" ? r.pick([-3, -2.5, -2, -1.5, -0.75, -0.5, 0.5, 0.75, 1.5, 2, 2.5, 3]) : r.pick([-0.9, -0.8, -0.7, -0.6, -0.4, -0.3, -0.2, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9]);
    const inv = fn === "sin" ? Math.asin(c) : fn === "cos" ? Math.acos(c) : Math.atan(c);
    // Negative sine: the quadrant III partner pi - t0; negative tangent: one period later.
    const ans = fn === "cos" || c > 0 ? inv : fn === "sin" ? Math.PI - inv : Math.PI + inv;
    const f3 = (x: number) => x.toFixed(3);
    const steps: Step[] =
      fn === "cos"
        ? [
            { math: md`t_0 = \arccos(${c}) \approx ${f3(inv)}`, note: md`A calculator in radian mode. ${c < 0 ? "A negative cosine gives an angle in quadrant II, between $\\frac{\\pi}{2}$ and $\\pi$." : "The angle is in quadrant I."}` },
            { math: md`t = \pm ${f3(inv)} + 2\pi n`, note: md`All solutions of $\cos t = c$ are $\pm t_0$ plus whole turns.` },
            { math: md`t \approx ${f3(ans)}`, note: md`$t_0$ itself is the smallest positive one; the next is $2\pi - t_0 \approx ${f3(2 * Math.PI - inv)}$.` },
          ]
        : fn === "sin"
          ? [
              { math: md`t_0 = \arcsin(${c}) \approx ${f3(inv)}`, note: md`A calculator in radian mode. ${c < 0 ? "Arcsine of a negative number is negative, so this isn't a positive solution yet." : "This is in quadrant I."}` },
              { math: md`t = t_0 + 2\pi n \quad\text{or}\quad t = \pi - t_0 + 2\pi n`, note: "All solutions of a sine equation." },
              c > 0
                ? { math: md`t \approx ${f3(ans)}`, note: md`$t_0$ is positive and smaller than $\pi - t_0 \approx ${f3(Math.PI - inv)}$.` }
                : { math: md`t = \pi - t_0 \approx \pi + ${f3(-inv)} \approx ${f3(ans)}`, note: md`With $t_0 < 0$, the candidates in $(0, 2\pi)$ are $\pi - t_0$ (quadrant III) and $2\pi + t_0 \approx ${f3(2 * Math.PI + inv)}$ (quadrant IV). The first is smaller.` },
            ]
          : [
              { math: md`t_0 = \arctan(${c}) \approx ${f3(inv)}`, note: md`A calculator in radian mode. ${c < 0 ? "Negative, so not a positive solution yet." : ""}` },
              { math: md`t = t_0 + \pi n`, note: md`Tangent repeats every $\pi$, not every $2\pi$.` },
              c > 0 ? { math: md`t \approx ${f3(ans)}`, note: md`$t_0$ is already positive.` } : { math: md`t = t_0 + \pi \approx ${f3(ans)}`, note: md`Add one period to the negative $t_0$.` },
            ];
    return {
      prompt: md`Find the smallest positive solution of $${FN_TEX[fn]} t = ${c}$. Round to 3 decimal places (your answer should be within 0.0005).`,
      answer: f3(ans),
      tolerance: 0.0005,
      hint: md`$${c}$ isn't on the exact-value table, so use $${INV_TEX[fn]}$ on a calculator in radian mode. That gives one solution, $t_0$, maybe negative. Then write the general solution and pick the smallest positive one.`,
      solution: steps,
    };
  }
  const fn = r.pick<Fn>(["sin", "cos", "tan"]);
  const c = val(fn, r.pick(keysFor(fn)));
  const eq = linearEquation(r, fn, c);
  const sols = sortAngles(solveOnTurn(fn, c));
  return {
    prompt: md`Solve $${eq.tex}$ on $[0, 2\pi)$. ${SET_FORMAT}`,
    answer: listText(sols),
    form: "set",
    hint: md`Isolate $${FN_TEX[fn]} t$ first. Then find the reference angle from the exact-value table and place it in the quadrants where ${FN_NAME[fn]} has the right sign.${sols.length === 1 ? " There is only one solution this time." : ""}`,
    solution: [
      ...eq.steps,
      ...solveSteps(fn, c),
      // The axis case already ends with the full list.
      ...(c.kind === "ref" ? [{ math: md`t = ${listTex(sols)}`, note: md`Both solutions in $[0, 2\pi)$. Adding $2\pi n$ to each gives every solution there is.` }] : []),
    ],
  };
};

/** Linear factors p·f + q with roots f = -q/p among the special values 0, ±1/2, ±1, plus two with no solutions. */
const FACTORS: { p: number; q: number; root: string }[] = [
  { p: 1, q: 1, root: "-1" },
  { p: 2, q: 1, root: "-1/2" },
  { p: 1, q: 0, root: "0" },
  { p: 2, q: -1, root: "1/2" },
  { p: 1, q: -1, root: "1" },
  { p: 1, q: -2, root: "2" },
  { p: 1, q: 2, root: "-2" },
];

function factorTex(p: number, q: number, f: string): string {
  if (q === 0) return p === 1 ? f : `${p}${f}`;
  return `(${p === 1 ? "" : p}${f} ${q < 0 ? "-" : "+"} ${Math.abs(q)})`;
}

const multipleAnglesAndQuadratics: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    // fn(2t) = c or fn(t/2) = c on [0, 2pi).
    const fn = r.pick<Fn>(["sin", "cos", "tan"]);
    const half = r.next() < 0.3;
    // For t/2 the angle u only covers [0, pi): keep values that have a solution there.
    const keys = keysFor(fn).filter((k) => (half ? !(fn === "sin" && k.startsWith("-")) && !(fn === "cos" && k === "-1") : true)).filter((k) => k !== "0" || r.next() < 0.4);
    const c = val(fn, r.pick(keys));
    const argTex = half ? "\\frac{t}{2}" : "2t";
    const eq = linearEquation(r, fn, c, half ? "\\left(\\tfrac{t}{2}\\right)" : "(2t)");
    const base = sortAngles(solveOnTurn(fn, c));
    const uSols = half ? base.filter((u) => radians(u) < Math.PI - 1e-9) : [...base, ...base.map((u) => addTurns(u, 1))];
    const tSols = sortAngles(uSols.map(([n, d]): Frac => (half ? [2 * n, d] : [n, 2 * d])));
    const uRange = half ? "0 \\le u < \\pi" : "0 \\le u < 4\\pi";
    const oneTurn = solveSteps(fn, c, "u");
    return {
      prompt: md`Solve $${eq.tex}$ on $[0, 2\pi)$. ${SET_FORMAT}`,
      answer: listText(tSols),
      form: "set",
      hint: md`Let $u = ${argTex}$. As $t$ runs through $[0, 2\pi)$, $u$ runs through $${uRange}$. Solve $${FN_TEX[fn]} u = ${c.tex}$ for every $u$ in that range first, then ${half ? "double" : "halve"} each one.`,
      solution: [
        ...eq.steps,
        { math: md`u = ${argTex},\quad ${uRange}`, note: md`Substitute. ${half ? md`Half of $[0, 2\pi)$ is $[0, \pi)$: only half a turn for $u$, so expect fewer solutions.` : md`Twice $[0, 2\pi)$ is $[0, 4\pi)$: two full turns for $u$, so expect twice as many solutions.`}` },
        ...oneTurn.slice(0, -1),
        { math: md`u = ${listTex(base)}`, note: md`${oneTurn[oneTurn.length - 1]!.note} These are the solutions on the first turn, $0 \le u < 2\pi$.` },
        { math: md`u = ${listTex(sortAngles(uSols))}`, note: half ? md`Keep only the ones below $\pi$.` : md`Add $2\pi$ to each for the second turn.` },
        { math: md`t = ${listTex(tSols)}`, note: md`${half ? "Double" : "Halve"} each $u$. Every one of these is in $[0, 2\pi)$.` },
      ],
    };
  }
  if (kind === 1) {
    // Quadratic in sin t or cos t, factorable over the integers.
    const fn = r.pick<Fn>(["sin", "cos"]);
    const f = `${FN_TEX[fn]} t`;
    const f2 = `${FN_TEX[fn]}^2 t`;
    const live = FACTORS.slice(0, 5);
    const dead = FACTORS.slice(5);
    const A = r.pick(live);
    let B = r.next() < 0.3 ? r.pick(dead) : r.pick(live.filter((x) => x !== A));
    if (B.root === A.root) B = live.find((x) => x !== A)!;
    const [first, second] = r.next() < 0.5 ? [A, B] : [B, A];
    const a2 = first.p * second.p;
    const a1 = first.p * second.q + second.p * first.q;
    const a0 = first.q * second.q;
    const lhs = poly([[a2, f2], [a1, f], [a0, ""]]);
    const roots = [first, second].filter((x) => ["2", "-2"].includes(x.root) === false);
    const rejected = [first, second].find((x) => ["2", "-2"].includes(x.root));
    const sols = sortAngles(roots.flatMap((x) => solveOnTurn(fn, val(fn, x.root))));
    const rootTexOf = (x: { root: string }) => (["2", "-2"].includes(x.root) ? x.root : val(fn, x.root).tex);
    return {
      prompt: md`Solve $${lhs} = 0$ on $[0, 2\pi)$. ${SET_FORMAT}`,
      answer: listText(sols),
      form: "set",
      hint: md`This is a quadratic in $${f}$. Write $u = ${f}$ if it helps: $${poly([[a2, "u^2"], [a1, "u"], [a0, ""]])} = 0$. Factor, solve for $u$, then solve each $${f} = u$ on $[0, 2\pi)$.${rejected ? ` One value of $u$ will be impossible for a ${FN_NAME[fn]}.` : ""}`,
      solution: [
        { math: md`${factorTex(first.p, first.q, f)}${factorTex(second.p, second.q, f)} = 0`, note: md`Factor, treating $${f}$ as the unknown. Check by multiplying out.` },
        { math: md`${f} = ${rootTexOf(first)} \quad\text{or}\quad ${f} = ${rootTexOf(second)}`, note: "Zero product property: one factor must be 0." },
        ...(rejected ? [{ math: md`${f} = ${rootTexOf(rejected)} \text{ is impossible}`, note: md`A ${FN_NAME[fn]} is always between $-1$ and $1$. That factor contributes no solutions.` }] : []),
        ...roots.flatMap((x) => {
          const v = val(fn, x.root);
          const own = sortAngles(solveOnTurn(fn, v));
          return [{ math: md`${f} = ${v.tex} \;\Rightarrow\; t = ${listTex(own)}`, note: v.kind === "ref" ? md`Reference angle $${angTex(v.ref!)}$. ${quadrantNote(fn, v)}` : md`Read off the unit circle.` }];
        }),
        { math: md`t = ${listTex(sols)}`, note: "All solutions together, in order." },
      ],
    };
  }
  // a f^2 - b = 0: take square roots, both signs.
  const fn = r.pick<Fn>(["sin", "cos", "tan"]);
  const choices: [number, number, string][] = fn === "tan" ? [[1, 3, "sqrt(3)"], [3, 1, "sqrt(3)/3"], [1, 1, "1"]] : [[2, 1, "sqrt(2)/2"], [4, 3, "sqrt(3)/2"], [4, 1, "1/2"]];
  const [a, b, mag] = r.pick(choices);
  const plus = val(fn, mag);
  const minus = val(fn, `-${mag}`);
  const f = `${FN_TEX[fn]} t`;
  const f2 = `${FN_TEX[fn]}^2 t`;
  const sols = sortAngles([...solveOnTurn(fn, plus), ...solveOnTurn(fn, minus)]);
  const swap = r.next() < 0.4;
  const tex = swap ? `${a === 1 ? "" : a}${f2} = ${b}` : `${a === 1 ? "" : a}${f2} - ${b} = 0`;
  const sq = b === a ? "1" : a === 1 ? String(b) : `\\frac{${b}}{${a}}`;
  return {
    prompt: md`Solve $${tex}$ on $[0, 2\pi)$. ${SET_FORMAT}`,
    answer: listText(sols),
    form: "set",
    hint: md`Isolate $${f2}$, then take square roots of both sides. Don't forget the negative root: a square equals $${sq}$ for two values of $${f}$.`,
    solution: [
      { math: md`${f2} = ${sq}`, note: swap ? (a === 1 ? "" : md`Divide by ${a}.`) : md`Add ${b}${a === 1 ? "" : `, then divide by ${a}`}.` },
      { math: md`${f} = ${plus.tex} \quad\text{or}\quad ${f} = ${minus.tex}`, note: md`Both square roots. ${mag === "sqrt(3)/3" ? md`$\sqrt{\frac{1}{3}} = \frac{1}{\sqrt{3}} = \frac{\sqrt{3}}{3}$.` : mag === "sqrt(2)/2" ? md`$\sqrt{\frac{1}{2}} = \frac{\sqrt{2}}{2}$.` : ""}` },
      { math: md`${f} = ${plus.tex} \;\Rightarrow\; t = ${listTex(sortAngles(solveOnTurn(fn, plus)))}`, note: plus.kind === "ref" ? md`Reference angle $${angTex(plus.ref!)}$. ${quadrantNote(fn, plus)}` : "Read off the unit circle." },
      { math: md`${f} = ${minus.tex} \;\Rightarrow\; t = ${listTex(sortAngles(solveOnTurn(fn, minus)))}`, note: minus.kind === "ref" ? quadrantNote(fn, minus) : "Read off the unit circle." },
      { math: md`t = ${listTex(sols)}`, note: md`All ${sols.length} solutions, in order: one in every quadrant.` },
    ],
  };
};

/** Equations that need an identity before they factor. Each root is fn(t) = value. */
interface Template {
  tex: string;
  steps: Step[];
  roots: [Fn, string][];
}

function identityTemplates(r: { pick<T>(items: readonly T[]): T }): Template {
  const K = r.pick(["1", "-1", "sqrt(2)/2", "-sqrt(2)/2", "sqrt(3)/2", "-sqrt(3)/2"]);
  // K/2 must be a special value: K itself is the value of sin or cos, times 2 is the coefficient.
  const kv = val("sin", K);
  const twoK = kv.magText === "1" ? "2" : kv.magText === "1/2" ? "1" : `\\sqrt{${kv.magText === "sqrt(2)/2" ? 2 : 3}}`;
  const coefTex = (neg: boolean) => (twoK === "1" ? (neg ? "-" : "") : `${neg ? "-" : ""}${twoK}`);
  const templates: Template[] = [
    {
      tex: `\\sin(2t) = ${coefTex(kv.neg)}\\cos t`,
      steps: [
        { math: md`2\sin t\cos t = ${coefTex(kv.neg)}\cos t`, note: md`Double-angle identity (Unit 5): $\sin(2t) = 2\sin t\cos t$. Now both sides use plain $t$.` },
        { math: md`2\sin t\cos t ${kv.neg ? "+" : "-"} ${twoK === "1" ? "" : twoK}\cos t = 0`, note: md`Move everything to one side. Don't divide by $\cos t$: it may be 0, and dividing would lose those solutions.` },
        { math: md`\cos t\,(2\sin t ${kv.neg ? "+" : "-"} ${twoK === "1" ? "1" : twoK}) = 0`, note: md`Factor out $\cos t$.` },
        { math: md`\cos t = 0 \quad\text{or}\quad \sin t = ${kv.tex}`, note: "Zero product property." },
      ],
      roots: [["cos", "0"], ["sin", K]],
    },
    {
      tex: `\\sin(2t) = ${coefTex(kv.neg)}\\sin t`,
      steps: [
        { math: md`2\sin t\cos t = ${coefTex(kv.neg)}\sin t`, note: md`Double-angle identity: $\sin(2t) = 2\sin t\cos t$.` },
        { math: md`\sin t\,(2\cos t ${kv.neg ? "+" : "-"} ${twoK === "1" ? "1" : twoK}) = 0`, note: md`Bring the right side over and factor out $\sin t$. Dividing by $\sin t$ instead would throw away $t = 0$ and $t = \pi$.` },
        { math: md`\sin t = 0 \quad\text{or}\quad \cos t = ${val("cos", K).tex}`, note: "Zero product property." },
      ],
      roots: [["sin", "0"], ["cos", K]],
    },
    {
      tex: "\\cos(2t) = \\cos t",
      steps: [
        { math: md`2\cos^2 t - 1 = \cos t`, note: md`Double-angle identity in the cosine-only form: $\cos(2t) = 2\cos^2 t - 1$.` },
        { math: md`2\cos^2 t - \cos t - 1 = 0`, note: "A quadratic in cos t." },
        { math: md`(2\cos t + 1)(\cos t - 1) = 0`, note: "Factor." },
        { math: md`\cos t = -\frac{1}{2} \quad\text{or}\quad \cos t = 1`, note: "" },
      ],
      roots: [["cos", "-1/2"], ["cos", "1"]],
    },
    {
      tex: "\\cos(2t) + \\cos t = 0",
      steps: [
        { math: md`2\cos^2 t - 1 + \cos t = 0`, note: md`$\cos(2t) = 2\cos^2 t - 1$, chosen because the other term is a cosine.` },
        { math: md`(2\cos t - 1)(\cos t + 1) = 0`, note: md`Factor $2\cos^2 t + \cos t - 1$.` },
        { math: md`\cos t = \frac{1}{2} \quad\text{or}\quad \cos t = -1`, note: "" },
      ],
      roots: [["cos", "1/2"], ["cos", "-1"]],
    },
    {
      tex: "\\cos(2t) = \\sin t",
      steps: [
        { math: md`1 - 2\sin^2 t = \sin t`, note: md`$\cos(2t) = 1 - 2\sin^2 t$, the sine-only form, because the other side is a sine.` },
        { math: md`2\sin^2 t + \sin t - 1 = 0`, note: "Everything to one side, leading coefficient positive." },
        { math: md`(2\sin t - 1)(\sin t + 1) = 0`, note: "Factor." },
        { math: md`\sin t = \frac{1}{2} \quad\text{or}\quad \sin t = -1`, note: "" },
      ],
      roots: [["sin", "1/2"], ["sin", "-1"]],
    },
    {
      tex: "\\cos(2t) + \\sin t = 0",
      steps: [
        { math: md`1 - 2\sin^2 t + \sin t = 0`, note: md`$\cos(2t) = 1 - 2\sin^2 t$.` },
        { math: md`2\sin^2 t - \sin t - 1 = 0`, note: md`Multiply by $-1$ and reorder.` },
        { math: md`(2\sin t + 1)(\sin t - 1) = 0`, note: "Factor." },
        { math: md`\sin t = -\frac{1}{2} \quad\text{or}\quad \sin t = 1`, note: "" },
      ],
      roots: [["sin", "-1/2"], ["sin", "1"]],
    },
    {
      tex: "2\\sin^2 t + 3\\cos t - 3 = 0",
      steps: [
        { math: md`2(1 - \cos^2 t) + 3\cos t - 3 = 0`, note: md`Pythagorean identity: $\sin^2 t = 1 - \cos^2 t$, so that only cosines remain.` },
        { math: md`2\cos^2 t - 3\cos t + 1 = 0`, note: md`Expand, collect, multiply by $-1$.` },
        { math: md`(2\cos t - 1)(\cos t - 1) = 0`, note: "Factor." },
        { math: md`\cos t = \frac{1}{2} \quad\text{or}\quad \cos t = 1`, note: "" },
      ],
      roots: [["cos", "1/2"], ["cos", "1"]],
    },
    {
      tex: "2\\cos^2 t + \\sin t - 1 = 0",
      steps: [
        { math: md`2(1 - \sin^2 t) + \sin t - 1 = 0`, note: md`$\cos^2 t = 1 - \sin^2 t$, so that only sines remain.` },
        { math: md`2\sin^2 t - \sin t - 1 = 0`, note: md`Expand, collect, multiply by $-1$.` },
        { math: md`(2\sin t + 1)(\sin t - 1) = 0`, note: "Factor." },
        { math: md`\sin t = -\frac{1}{2} \quad\text{or}\quad \sin t = 1`, note: "" },
      ],
      roots: [["sin", "-1/2"], ["sin", "1"]],
    },
    {
      tex: "2\\cos^2 t - \\sin t - 1 = 0",
      steps: [
        { math: md`2(1 - \sin^2 t) - \sin t - 1 = 0`, note: md`$\cos^2 t = 1 - \sin^2 t$.` },
        { math: md`2\sin^2 t + \sin t - 1 = 0`, note: md`Expand, collect, multiply by $-1$.` },
        { math: md`(2\sin t - 1)(\sin t + 1) = 0`, note: "Factor." },
        { math: md`\sin t = \frac{1}{2} \quad\text{or}\quad \sin t = -1`, note: "" },
      ],
      roots: [["sin", "1/2"], ["sin", "-1"]],
    },
    {
      tex: "\\cos(2t) - \\cos t + 1 = 0",
      steps: [
        { math: md`2\cos^2 t - 1 - \cos t + 1 = 0`, note: md`$\cos(2t) = 2\cos^2 t - 1$.` },
        { math: md`\cos t\,(2\cos t - 1) = 0`, note: md`The constants cancel; factor out $\cos t$.` },
        { math: md`\cos t = 0 \quad\text{or}\quad \cos t = \frac{1}{2}`, note: "" },
      ],
      roots: [["cos", "0"], ["cos", "1/2"]],
    },
  ];
  return r.pick(templates);
}

const identitiesAndSmallest: Generator = (r) => {
  if (r.next() < 0.3) {
    // Smallest positive solution of fn(kt) = c, k = 2, 3, 4.
    const fn = r.pick<Fn>(["sin", "cos", "tan"]);
    const c = val(fn, r.pick(keysFor(fn)));
    const k = r.pick([2, 3, 4]);
    const eq = linearEquation(r, fn, c, `(${k}t)`, `${k}t`);
    const base = solveOnTurn(fn, c);
    const candidates = sortAngles([...base, ...base.map((u) => addTurns(u, 1))].filter((u) => radians(u) > 1e-9));
    const u = candidates[0]!;
    const t: Frac = reduce([u[0], u[1] * k]);
    return {
      prompt: md`Find the smallest positive solution of $${eq.tex}$. ${ANGLE_FORMAT}`,
      answer: angText(t),
      verify: [eq.text],
      hint: md`Let $u = ${k}t$ and solve $${FN_TEX[fn]} u = ${c.tex}$. Take the smallest **positive** $u$ (if $u = 0$ is a solution, skip it), then $t = \frac{u}{${k}}$.`,
      solution: [
        ...eq.steps,
        { math: md`u = ${k}t`, note: md`Substitute, so this is an ordinary equation in $u$.` },
        ...solveSteps(fn, c, "u"),
        { math: md`u = ${angTex(u)}`, note: md`The smallest positive solution for $u$.${radians(base[0]!) < 1e-9 ? md` ($u = 0$ is a solution, but it isn't positive.)` : ""} Any smaller positive $u$ would have to be in this list, and none is.` },
        { math: md`t = \frac{u}{${k}} = ${angTex(t)}`, note: md`Divide by ${k}. Smallest positive $u$ gives smallest positive $t$, because dividing by ${k} keeps the order.` },
      ],
    };
  }
  const T = identityTemplates(r);
  const groups = T.roots.map(([fn, key]) => ({ fn, v: val(fn, key), sols: sortAngles(solveOnTurn(fn, val(fn, key))) }));
  const sols = sortAngles(groups.flatMap((g) => g.sols)).filter((s, i, arr) => i === 0 || Math.abs(radians(s) - radians(arr[i - 1]!)) > 1e-9);
  return {
    prompt: md`Solve $${T.tex}$ on $[0, 2\pi)$. ${SET_FORMAT}`,
    answer: listText(sols),
    form: "set",
    hint: md`Two different trig expressions appear. Use an identity from Unit 5 to rewrite everything in terms of one function of $t$ (or to factor out a common factor), then solve. Never divide both sides by $\sin t$ or $\cos t$.`,
    solution: [
      ...T.steps,
      ...groups.map((g) => ({ math: md`${FN_TEX[g.fn]} t = ${g.v.tex} \;\Rightarrow\; t = ${listTex(g.sols)}`, note: g.v.kind === "ref" ? md`Reference angle $${angTex(g.v.ref!)}$. ${quadrantNote(g.fn, g.v)}` : "Read off the unit circle." })),
      { math: md`t = ${listTex(sols)}`, note: "All solutions together, in order." },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit6: Unit = {
  title: "Inverse Functions and Equations",
  lessons: [
    {
      id: slug("Inverse trig functions"),
      title: "Inverse trig functions",
      summary: "Sine, cosine and tangent don't have inverses until you restrict them. Which pieces to keep, why, and how to evaluate arcsin, arccos and arctan exactly.",
      blocks: [
        {
          kind: "text",
          body: md`Sine turns an angle into a number. We often need to go the other way. A ramp rises 3 feet over a 5-foot slope, so $\sin t = \frac{3}{5}$. What is $t$?

Algebra 2 said when a function can be run backwards: it needs an inverse, and a function has an inverse only when it is **one-to-one**, every output coming from exactly one input. That is the horizontal line test. Sine fails it badly.`,
        },
        {
          kind: "plot",
          x: [-7, 7],
          y: [-1.6, 1.6],
          curves: [{ expr: "sin(x)", label: "y = \\sin t" }],
          hlines: [{ y: "c", label: "y = c" }],
          params: [{ name: "c", min: -1, max: 1, step: 0.1, value: 0.6 }],
          caption: md`Slide $c$. Every horizontal line between $-1$ and $1$ crosses the sine wave again and again, forever in both directions. "The angle whose sine is $c$" is not one angle. It is infinitely many.`,
        },
        {
          kind: "why",
          title: "Why restrict instead of giving up",
          body: md`You have met this problem before. $x^2$ isn't one-to-one either ($3$ and $-3$ both square to $9$), yet $\sqrt{\,}$ exists. The fix was to keep only part of the domain: $\sqrt{9}$ means the **nonnegative** number whose square is 9. On $x \ge 0$, squaring is one-to-one, so it has an inverse there.

Do the same to sine. Keep a piece of its domain on which it is one-to-one, and make sure that piece still produces **every** output in $[-1, 1]$, or the inverse would be missing values. Sine must climb straight from $-1$ to $1$ with no turn. The natural piece is the one through the origin, from $-\frac{\pi}{2}$ to $\frac{\pi}{2}$: sine rises from $-1$ to $1$ there and hits each value exactly once. It also contains the whole first quadrant, so the right-triangle angles from Unit 2 are all included.`,
        },
        {
          kind: "key",
          title: "Arcsine",
          body: md`For $-1 \le x \le 1$,

$$y = \arcsin x \quad\text{means}\quad \sin y = x \ \text{ and } \ -\frac{\pi}{2} \le y \le \frac{\pi}{2}.$$

Domain $[-1, 1]$, range $\left[-\frac{\pi}{2}, \frac{\pi}{2}\right]$: the output is always a quadrant I or quadrant IV angle (or an axis angle between them). The notation $\sin^{-1} x$ means the same thing. It does **not** mean $\frac{1}{\sin x}$; that is $\csc x$.

Type it as **asin(x)**. Answers in this course are in radians.`,
        },
        {
          kind: "plot",
          x: [-2, 2],
          y: [-2, 2],
          curves: [
            { expr: "x", label: "y = t", color: 3, dashed: true },
            { expr: "sin(x)", label: "y = \\sin t \\text{ on } [-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2}]", color: 1, domain: [-Math.PI / 2, Math.PI / 2] },
            { expr: "asin(x)", label: "y = \\arcsin t", color: 2, domain: [-1, 1] },
          ],
          points: [
            { x: "c", y: "sin(c)", label: "(c, \\sin c)", color: 1 },
            { x: "sin(c)", y: "c", label: "(\\sin c, c)", color: 2 },
          ],
          params: [{ name: "c", min: -1.5, max: 1.5, step: 0.1, value: 0.9 }],
          caption: md`The restricted sine (blue) and arcsine (orange). Slide $c$: the point $(c, \sin c)$ on the sine piece has a partner $(\sin c, c)$ on arcsine with the coordinates swapped. That is what an inverse does, and swapping coordinates reflects the graph across the line $y = t$, exactly as for $b^x$ and $\log_b x$ in Algebra 2.`,
        },
        {
          kind: "why",
          title: "Why cosine and tangent get different intervals",
          body: md`Try the same interval for cosine and it fails: cosine is even, $\cos(-t) = \cos t$, so on $\left[-\frac{\pi}{2}, \frac{\pi}{2}\right]$ every value (except $\cos 0 = 1$) appears twice. Shift the window instead: on $[0, \pi]$ cosine falls steadily from $1$ to $-1$ and takes each value once. So arccosine returns a quadrant I or quadrant II angle.

Tangent has asymptotes at $\pm\frac{\pi}{2}$. Between them is one branch that climbs from $-\infty$ to $\infty$ and takes every real number exactly once. Keep that branch: $\left(-\frac{\pi}{2}, \frac{\pi}{2}\right)$, with open ends because tangent isn't defined there. Since tangent takes every real value, arctangent accepts every real number as input.`,
        },
        {
          kind: "key",
          title: "The three inverse functions",
          body: md`- $y = \arcsin x$: $\sin y = x$, $\ -\frac{\pi}{2} \le y \le \frac{\pi}{2}$. Domain $[-1, 1]$. Type **asin**.
- $y = \arccos x$: $\cos y = x$, $\ 0 \le y \le \pi$. Domain $[-1, 1]$. Type **acos**.
- $y = \arctan x$: $\tan y = x$, $\ -\frac{\pi}{2} < y < \frac{\pi}{2}$. Domain all real numbers. Type **atan**.

Each one answers "which angle **in my interval** has this value?" The interval is part of the definition. Forgetting it is the main source of mistakes in this unit.`,
        },
        {
          kind: "plot",
          x: [-1.5, 3.5],
          y: [-1.5, 3.5],
          curves: [
            { expr: "x", label: "y = t", color: 3, dashed: true },
            { expr: "cos(x)", label: "y = \\cos t \\text{ on } [0, \\pi]", color: 1, domain: [0, Math.PI] },
            { expr: "acos(x)", label: "y = \\arccos t", color: 2, domain: [-1, 1] },
          ],
          points: [
            { x: Math.PI, y: -1, label: "(\\pi, -1)", color: 1 },
            { x: -1, y: Math.PI, label: "(-1, \\pi)", color: 2 },
            { x: 0, y: 1, label: "(0, 1)", color: 1 },
            { x: 1, y: 0, label: "(1, 0)", color: 2 },
          ],
          caption: md`Cosine on $[0, \pi]$ and its inverse. Arccosine runs from $(-1, \pi)$ down to $(1, 0)$: its outputs are never negative.`,
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-5, 5],
          curves: [
            { expr: "x", label: "y = t", color: 3, dashed: true },
            { expr: "tan(x)", label: "y = \\tan t \\text{ on } (-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2})", color: 1, domain: [-1.37, 1.37] },
            { expr: "atan(x)", label: "y = \\arctan t", color: 2 },
          ],
          vlines: [{ x: -Math.PI / 2, label: "t = -\\tfrac{\\pi}{2}" }, { x: Math.PI / 2, label: "t = \\tfrac{\\pi}{2}" }],
          hlines: [{ y: -Math.PI / 2, label: "y = -\\tfrac{\\pi}{2}" }, { y: Math.PI / 2, label: "y = \\tfrac{\\pi}{2}" }],
          caption: md`One branch of tangent and its inverse. The vertical asymptotes of tangent become horizontal asymptotes of arctangent: $\arctan t$ levels off toward $\frac{\pi}{2}$ as $t$ grows, and never reaches it.`,
        },
        {
          kind: "example",
          title: "Exact values",
          problem: md`Find $\arcsin\left(-\frac{\sqrt{3}}{2}\right)$, $\arccos\left(-\frac{1}{2}\right)$ and $\arctan(-1)$.`,
          steps: [
            { math: md`\sin\frac{\pi}{3} = \frac{\sqrt{3}}{2}, \quad\text{so}\quad \sin\left(-\frac{\pi}{3}\right) = -\frac{\sqrt{3}}{2}`, note: md`Sine is odd (Unit 3). $-\frac{\pi}{3}$ is in $\left[-\frac{\pi}{2}, \frac{\pi}{2}\right]$.` },
            { math: md`\arcsin\left(-\frac{\sqrt{3}}{2}\right) = -\frac{\pi}{3}`, note: md`Not $\frac{4\pi}{3}$ or $\frac{5\pi}{3}$. Their sines are right, but they are outside the interval, so arcsine can't return them.` },
            { math: md`\cos\frac{\pi}{3} = \frac{1}{2}, \quad \cos\left(\pi - \frac{\pi}{3}\right) = -\frac{1}{2}`, note: md`A negative cosine needs a quadrant II angle, because $[0, \pi]$ has no quadrant III. Reflecting across the $y$-axis flips the sign of $x$: the angle $\pi - r$.` },
            { math: md`\arccos\left(-\frac{1}{2}\right) = \frac{2\pi}{3}`, note: md`In $[0, \pi]$, as required.` },
            { math: md`\arctan(-1) = -\frac{\pi}{4}`, note: md`$\tan\frac{\pi}{4} = 1$ and tangent is odd. $-\frac{\pi}{4}$ is in $\left(-\frac{\pi}{2}, \frac{\pi}{2}\right)$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $\arccos\left(-\frac{\sqrt{2}}{2}\right)$. Give the angle in radians as a multiple of $\pi$, like 3pi/4.`,
          answer: "3pi/4",
          explain: md`$\cos\frac{\pi}{4} = \frac{\sqrt{2}}{2}$. A negative cosine in $[0, \pi]$ means quadrant II: $\pi - \frac{\pi}{4} = \frac{3\pi}{4}$.`,
        },
        {
          kind: "key",
          title: "When the functions cancel",
          body: md`$$\sin(\arcsin x) = x \quad\text{for every } x \text{ in } [-1, 1],$$

always, because $\arcsin x$ is *defined* as an angle whose sine is $x$. But

$$\arcsin(\sin t) = t \quad\text{only when}\quad -\frac{\pi}{2} \le t \le \frac{\pi}{2}.$$

For any other $t$, $\arcsin(\sin t)$ is the angle **in the interval** with the same sine as $t$. The same holds for cosine with $[0, \pi]$ and tangent with $\left(-\frac{\pi}{2}, \frac{\pi}{2}\right)$.`,
        },
        {
          kind: "example",
          title: "Inside out",
          problem: md`Find $\arcsin\left(\sin\frac{5\pi}{6}\right)$ and $\arctan\left(\tan\frac{4\pi}{3}\right)$.`,
          steps: [
            { math: md`\sin\frac{5\pi}{6} = \frac{1}{2}`, note: md`Quadrant II, reference angle $\frac{\pi}{6}$, sine positive. Evaluate the inside first.` },
            { math: md`\arcsin\frac{1}{2} = \frac{\pi}{6}`, note: md`The answer is $\frac{\pi}{6}$, not $\frac{5\pi}{6}$: it has the same sine and it is in the interval.` },
            { math: md`\tan\frac{4\pi}{3} = \sqrt{3}`, note: md`Quadrant III, reference angle $\frac{\pi}{3}$, tangent positive.` },
            { math: md`\arctan\sqrt{3} = \frac{\pi}{3}`, note: md`$\frac{4\pi}{3} - \pi = \frac{\pi}{3}$: going back one period of tangent lands in the interval.` },
          ],
        },
        {
          kind: "text",
          body: md`The most useful compositions mix two different functions, like $\cos(\arcsin x)$. Name the inner angle: let $t = \arcsin x$. Then $\sin t = x$, and the question is just "what is $\cos t$?" A right triangle with opposite side $x$ and hypotenuse $1$ has $\sin t = x$, and its other leg is $\sqrt{1 - x^2}$.`,
        },
        {
          kind: "diagram",
          view: [-0.3, 1.4, -0.3, 1.15],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: "sqrt(1 - x^2)", y: 0, dir: "se" },
            { name: "C", x: "sqrt(1 - x^2)", y: "x", dir: "ne" },
          ],
          polygons: [{ points: ["A", "B", "C"], fill: 1 }],
          segments: [
            { from: "A", to: "C", label: "1" },
            { from: "B", to: "C", label: "x" },
            { from: "A", to: "B", label: "\\sqrt{1 - x^2}" },
          ],
          angles: [
            { at: "A", from: "B", to: "C", label: "t" },
            { at: "B", from: "C", to: "A", right: true },
          ],
          params: [{ name: "x", min: 0.1, max: 0.95, step: 0.05, value: 0.6 }],
          readouts: [
            { label: "\\sin t", value: "x" },
            { label: "\\cos t = \\sqrt{1 - x^2}", value: "sqrt(1 - x^2)" },
          ],
          caption: md`The reference triangle for $t = \arcsin x$. Slide $x$. With hypotenuse 1, the opposite side is $\sin t = x$ and the adjacent side is $\cos t$, found by the Pythagorean theorem. The triangle gives sizes; for a negative $x$ the sign still has to come from the quadrant.`,
        },
        {
          kind: "proof",
          title: "cos(arcsin x) = sqrt(1 − x²)",
          given: md`$-1 \le x \le 1$ and $y = \arcsin x$`,
          prove: md`$\cos y = \sqrt{1 - x^2}$`,
          steps: [
            { statement: md`$\sin y = x$ and $-\frac{\pi}{2} \le y \le \frac{\pi}{2}$`, reason: "Definition of arcsine" },
            { statement: md`$\sin^2 y + \cos^2 y = 1$`, reason: "Pythagorean identity (Unit 5)" },
            { statement: md`$\cos^2 y = 1 - x^2$`, reason: "Substitute step 1 and subtract" },
            { statement: md`$\cos y = \sqrt{1 - x^2}$ or $\cos y = -\sqrt{1 - x^2}$`, reason: "A square has two square roots" },
            { statement: md`$\cos y \ge 0$`, reason: md`On $\left[-\frac{\pi}{2}, \frac{\pi}{2}\right]$ the unit-circle point is in quadrant I or IV or on the boundary, where $x \ge 0$ (Unit 3)` },
            { statement: md`$\cos y = \sqrt{1 - x^2}$`, reason: "Steps 4 and 5: the negative root is ruled out" },
          ],
        },
        {
          kind: "example",
          title: "A composition with a negative input",
          problem: md`Find the exact value of $\tan\left(\arccos\left(-\frac{1}{3}\right)\right)$.`,
          steps: [
            { math: md`t = \arccos\left(-\frac{1}{3}\right) \iff \cos t = -\frac{1}{3},\quad 0 \le t \le \pi`, note: "Name the angle and write down what you know about it." },
            { math: md`\sin^2 t = 1 - \frac{1}{9} = \frac{8}{9}`, note: "Pythagorean identity." },
            { math: md`\sin t = \frac{2\sqrt{2}}{3}`, note: md`Positive: $\cos t < 0$ with $t$ in $[0, \pi]$ puts $t$ in quadrant II, where sine is positive. $\sqrt{8} = 2\sqrt{2}$.` },
            { math: md`\tan t = \frac{\sin t}{\cos t} = \frac{2\sqrt{2}/3}{-1/3} = -2\sqrt{2}`, note: "The 3's cancel. Negative, as tangent should be in quadrant II." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the exact value of $\cos(\arctan 2)$. Rationalize the denominator (type sqrt(5)/5 for $\frac{\sqrt{5}}{5}$).`,
          answer: "sqrt(5)/5",
          simplified: true,
          explain: md`Let $t = \arctan 2$: opposite 2, adjacent 1, hypotenuse $\sqrt{5}$. $t$ is in quadrant I, so $\cos t = \frac{1}{\sqrt{5}} = \frac{\sqrt{5}}{5}$.`,
        },
      ],
      practice: [inverseValues, compositions, inverseOfFunction],
    },
    {
      id: slug("Solving trig equations"),
      title: "Solving trig equations",
      summary: "Every solution of sin t = c on one turn, then on the whole line; multiple angles, quadratics in sin t, and equations that need an identity first.",
      blocks: [
        {
          kind: "text",
          body: md`$\sin t = \frac{1}{2}$ has infinitely many solutions, because sine repeats. The inverse function gives only one of them, $\arcsin\frac{1}{2} = \frac{\pi}{6}$. To find the rest, we go back to the unit circle.

The plan for every equation in this lesson: find all the solutions in one turn, $0 \le t < 2\pi$, then add whole turns. The unit circle makes the first part a picture.`,
        },
        {
          kind: "diagram",
          view: [-1.6, 1.6, -1.35, 1.35],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 1, y: 0, label: "", hidden: true },
            { name: "P", x: "cos(a pi/180)", y: "sin(a pi/180)", dir: "ne" },
            { name: "Q", x: "-cos(a pi/180)", y: "sin(a pi/180)", dir: "nw" },
            { name: "L", x: -1.5, y: "sin(a pi/180)", label: "", hidden: true },
            { name: "R", x: 1.5, y: "sin(a pi/180)", label: "", hidden: true },
          ],
          circles: [{ center: "O", radius: 1 }],
          segments: [
            { from: "O", to: "P" },
            { from: "O", to: "Q" },
            { from: "L", to: "R", dashed: true, color: 2, label: "y = c" },
          ],
          angles: [
            { at: "O", from: "A", to: "P", label: "t" },
            { at: "O", from: "A", to: "Q", label: "\\pi - t", arcs: 2, color: 2 },
          ],
          params: [{ name: "a", label: "t (degrees)", min: 5, max: 85, step: 5, value: 30 }],
          readouts: [{ label: "\\sin t", value: "sin(a pi/180)" }],
          caption: md`$\sin t$ is the $y$-coordinate of the point at angle $t$. The line $y = c$ cuts the circle at two points, $P$ at angle $t$ and its mirror image $Q$ at angle $\pi - t$. Those are the only two points with that sine, so $\sin t = c$ has exactly two solutions per turn (one, when $c = \pm 1$).`,
        },
        {
          kind: "key",
          title: "Solving sin t = c, cos t = c, tan t = c on one turn",
          body: md`1. Isolate the trig function.
2. Find the **reference angle** $r$: the first-quadrant angle with $\sin r = |c|$ (or $\cos r = |c|$, $\tan r = |c|$). Exact values come from the table in Unit 3; otherwise $r = \arcsin|c|$ on a calculator.
3. Place $r$ in the quadrants where the function has the sign of $c$ (Unit 3: sine positive in I and II, cosine in I and IV, tangent in I and III):

$$\text{I: } t = r \qquad \text{II: } t = \pi - r \qquad \text{III: } t = \pi + r \qquad \text{IV: } t = 2\pi - r.$$

If $c$ is $0$, $1$ or $-1$ there is no reference angle: read the axis points straight off the circle.`,
        },
        {
          kind: "why",
          title: "Why the second solution is π − r (or 2π − r, or π + r)",
          body: md`Each rule is a reflection of the unit circle. Start at the point $(x, y)$ at angle $r$.

- Reflect across the $y$-axis: $(-x, y)$. Same $y$, so the same sine, at angle $\pi - r$.
- Reflect across the $x$-axis: $(x, -y)$. Same $x$, so the same cosine, at angle $-r$, which is the same point as $2\pi - r$.
- Reflect through the origin: $(-x, -y)$. Both signs flip, so $\frac{y}{x}$ is unchanged: the same tangent, at angle $\pi + r$.

Each reflection pairs every point with exactly one other, which is why there are exactly two solutions per turn.`,
        },
        {
          kind: "example",
          title: "A cosine equation",
          problem: md`Solve $2\cos t + 1 = 0$ on $[0, 2\pi)$.`,
          steps: [
            { math: md`\cos t = -\frac{1}{2}`, note: "Isolate the function first, exactly as you would isolate x." },
            { math: md`r = \frac{\pi}{3}`, note: md`Reference angle: $\cos\frac{\pi}{3} = \frac{1}{2}$.` },
            { math: md`t = \pi - \frac{\pi}{3} = \frac{2\pi}{3}, \qquad t = \pi + \frac{\pi}{3} = \frac{4\pi}{3}`, note: "Cosine is negative in quadrants II and III." },
          ],
        },
        {
          kind: "plot",
          x: [-7, 7],
          y: [-1.6, 1.6],
          curves: [{ expr: "sin(x)", label: "y = \\sin t" }],
          hlines: [{ y: "c", label: "y = c" }],
          points: [
            { x: "asin(c)", y: "c", label: "t_0", color: 2 },
            { x: "pi - asin(c)", y: "c", label: "\\pi - t_0", color: 3 },
            { x: "asin(c) + 2pi", y: "c", label: "t_0 + 2\\pi", color: 2 },
            { x: "3pi - asin(c)", y: "c", label: "\\pi - t_0 + 2\\pi", color: 3 },
            { x: "asin(c) - 2pi", y: "c", label: "t_0 - 2\\pi", color: 2 },
            { x: "-pi - asin(c)", y: "c", label: "\\pi - t_0 - 2\\pi", color: 3 },
          ],
          params: [{ name: "c", min: -0.9, max: 0.9, step: 0.1, value: 0.5 }],
          caption: md`All the solutions of $\sin t = c$, with $t_0 = \arcsin c$. Two per turn, repeating every $2\pi$ in both directions. Slide $c$ and watch the two families move toward each other as $c$ nears $1$, where they merge into one.`,
        },
        {
          kind: "key",
          title: "General solutions",
          body: md`With $n$ any integer and $t_0$ one solution:

- $\sin t = c$: $\ t = t_0 + 2\pi n \ $ or $\ t = \pi - t_0 + 2\pi n$.
- $\cos t = c$: $\ t = \pm t_0 + 2\pi n$.
- $\tan t = c$: $\ t = t_0 + \pi n$.

Sine and cosine have period $2\pi$, so each solution on one turn spawns a family $2\pi$ apart. Tangent is different: one solution per $\pi$.`,
        },
        {
          kind: "proof",
          title: "The solutions of tan t = c are t₀ + πn",
          given: md`$t_0 = \arctan c$`,
          prove: md`$\tan t = c$ exactly when $t = t_0 + \pi n$ for some integer $n$`,
          steps: [
            { statement: md`$\sin(t + \pi) = -\sin t$ and $\cos(t + \pi) = -\cos t$`, reason: md`Adding $\pi$ sends the unit-circle point $(x, y)$ to $(-x, -y)$ (Unit 3)` },
            { statement: md`$\tan(t + \pi) = \dfrac{-\sin t}{-\cos t} = \tan t$`, reason: "Definition of tangent; the two minus signs cancel" },
            { statement: md`$\tan(t_0 + \pi n) = \tan t_0 = c$ for every integer $n$`, reason: "Step 2 applied repeatedly, and the definition of arctangent" },
            { statement: md`Now let $t$ be any solution. There is an integer $n$ with $-\frac{\pi}{2} < t - \pi n < \frac{\pi}{2}$`, reason: md`The open intervals between consecutive asymptotes have length $\pi$ and cover the whole domain of tangent` },
            { statement: md`$\tan(t - \pi n) = \tan t = c$`, reason: "Step 2" },
            { statement: md`$t - \pi n = t_0$`, reason: md`Tangent is one-to-one on $\left(-\frac{\pi}{2}, \frac{\pi}{2}\right)$: that is why arctangent exists, and only one angle there has tangent $c$` },
            { statement: md`$t = t_0 + \pi n$`, reason: "Addition Property of Equality" },
          ],
        },
        {
          kind: "example",
          title: "A tangent equation",
          problem: md`Solve $\sqrt{3}\tan t + 1 = 0$. Give the solutions on $[0, 2\pi)$ and the general solution.`,
          steps: [
            { math: md`\tan t = -\frac{1}{\sqrt{3}} = -\frac{\sqrt{3}}{3}`, note: "Isolate." },
            { math: md`r = \frac{\pi}{6}`, note: md`$\tan\frac{\pi}{6} = \frac{\sqrt{3}}{3}$.` },
            { math: md`t = \pi - \frac{\pi}{6} = \frac{5\pi}{6}, \qquad t = 2\pi - \frac{\pi}{6} = \frac{11\pi}{6}`, note: "Tangent is negative in quadrants II and IV." },
            { math: md`t = \frac{5\pi}{6} + \pi n`, note: md`The general solution. Notice $\frac{11\pi}{6} = \frac{5\pi}{6} + \pi$: for tangent, one family with step $\pi$ covers both quadrants.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $2\sin t - \sqrt{3} = 0$ on $[0, 2\pi)$. List all solutions, separated by commas, as multiples of $\pi$ (like pi/3, 2pi/3).`,
          answer: "pi/3, 2pi/3",
          form: "set",
          explain: md`$\sin t = \frac{\sqrt{3}}{2}$, reference angle $\frac{\pi}{3}$. Sine is positive in quadrants I and II: $\frac{\pi}{3}$ and $\pi - \frac{\pi}{3} = \frac{2\pi}{3}$.`,
        },
        {
          kind: "text",
          body: md`**Multiple angles.** In $\sin(2t) = \frac{\sqrt{3}}{2}$ the angle is $2t$. Give it a name, $u = 2t$, and solve for $u$ first. One warning about the interval: as $t$ runs through $[0, 2\pi)$, $u = 2t$ runs through $[0, 4\pi)$, two full turns. So collect the solutions for $u$ over **two** turns, and only then divide by 2.`,
        },
        {
          kind: "plot",
          x: [0, 6.6],
          y: [-1.6, 1.6],
          curves: [{ expr: "sin(B x)", label: "y = \\sin(Bt)" }],
          hlines: [{ y: 0.5, label: "y = \\tfrac{1}{2}" }],
          vlines: [{ x: 2 * Math.PI, label: "2\\pi" }],
          params: [{ name: "B", min: 1, max: 4, step: 1, value: 2 }],
          caption: md`Slide $B$. On one turn $0 \le t < 2\pi$, the wave $y = \sin(Bt)$ completes $B$ cycles, so the line $y = \frac{1}{2}$ meets it {=2 B} times: $\sin(Bt) = \frac{1}{2}$ has $2B$ solutions on $[0, 2\pi)$, not 2.`,
        },
        {
          kind: "example",
          title: "A double angle",
          problem: md`Solve $\sin(2t) = \frac{\sqrt{3}}{2}$ on $[0, 2\pi)$.`,
          steps: [
            { math: md`u = 2t, \qquad 0 \le u < 4\pi`, note: md`Doubling $[0, 2\pi)$ gives $[0, 4\pi)$.` },
            { math: md`\sin u = \frac{\sqrt{3}}{2} \;\Rightarrow\; u = \frac{\pi}{3}, \frac{2\pi}{3}`, note: "The first turn: quadrants I and II." },
            { math: md`u = \frac{\pi}{3}, \frac{2\pi}{3}, \frac{7\pi}{3}, \frac{8\pi}{3}`, note: md`The second turn: add $2\pi$ to each.` },
            { math: md`t = \frac{\pi}{6}, \frac{\pi}{3}, \frac{7\pi}{6}, \frac{4\pi}{3}`, note: "Halve every one. Four solutions, all inside the original interval." },
          ],
        },
        {
          kind: "why",
          title: "Why not divide by 2 at the start?",
          body: md`Because $\sin(2t)$ is not $2\sin t$. Sine is not a linear function: $\sin(2 \cdot \frac{\pi}{2}) = \sin\pi = 0$, while $2\sin\frac{\pi}{2} = 2$. The $2$ is inside the function and can't be moved out. The only way to reach $t$ is to find the angle $2t$ first, and then divide the **angle**.

The same goes for the interval. If you solved $\sin u = \frac{\sqrt{3}}{2}$ on one turn only, you'd get $t = \frac{\pi}{6}$ and $\frac{\pi}{3}$ and miss half the answers.`,
        },
        {
          kind: "key",
          title: "Quadratic-type equations",
          body: md`$2\sin^2 t - \sin t - 1 = 0$ is a quadratic in $\sin t$. Treat $\sin t$ as the unknown (write $u = \sin t$ if it helps), factor or use the quadratic formula, then solve each $\sin t = u$ on the circle.

Two things to watch. A square equation $\sin^2 t = \frac{1}{2}$ has **two** roots, $\sin t = \pm\frac{\sqrt{2}}{2}$, so four solutions per turn. And any root with $|u| > 1$ is impossible for sine or cosine: discard it.`,
        },
        {
          kind: "example",
          title: "Factoring a quadratic in sin t",
          problem: md`Solve $2\sin^2 t - \sin t - 1 = 0$ on $[0, 2\pi)$.`,
          steps: [
            { math: md`(2\sin t + 1)(\sin t - 1) = 0`, note: md`Factor as you would $2u^2 - u - 1 = (2u + 1)(u - 1)$.` },
            { math: md`\sin t = -\frac{1}{2} \quad\text{or}\quad \sin t = 1`, note: "Zero product property." },
            { math: md`\sin t = -\frac{1}{2} \;\Rightarrow\; t = \frac{7\pi}{6}, \frac{11\pi}{6}`, note: md`Reference angle $\frac{\pi}{6}$; sine negative in quadrants III and IV.` },
            { math: md`\sin t = 1 \;\Rightarrow\; t = \frac{\pi}{2}`, note: "The top of the circle." },
            { math: md`t = \frac{\pi}{2}, \frac{7\pi}{6}, \frac{11\pi}{6}`, note: "All three, in order." },
          ],
        },
        {
          kind: "text",
          body: md`**Two functions in one equation.** When sine and cosine (or $t$ and $2t$) both appear, use an identity from Unit 5 to rewrite everything in one function of one angle, then factor:

- $\sin(2t) = 2\sin t\cos t$.
- $\cos(2t) = 2\cos^2 t - 1$ when the rest is cosines, $\cos(2t) = 1 - 2\sin^2 t$ when the rest is sines.
- $\sin^2 t = 1 - \cos^2 t$ and $\cos^2 t = 1 - \sin^2 t$.

Then move everything to one side and **factor**. Never divide both sides by $\sin t$ or $\cos t$.`,
        },
        {
          kind: "example",
          title: "An identity first",
          problem: md`Solve $\sin(2t) = \cos t$ on $[0, 2\pi)$.`,
          steps: [
            { math: md`2\sin t\cos t = \cos t`, note: "Double-angle identity, so that only the angle t appears." },
            { math: md`2\sin t\cos t - \cos t = 0`, note: md`Everything to one side. Resist dividing by $\cos t$.` },
            { math: md`\cos t\,(2\sin t - 1) = 0`, note: md`Factor out $\cos t$.` },
            { math: md`\cos t = 0 \;\Rightarrow\; t = \frac{\pi}{2}, \frac{3\pi}{2}`, note: "The top and bottom of the circle." },
            { math: md`\sin t = \frac{1}{2} \;\Rightarrow\; t = \frac{\pi}{6}, \frac{5\pi}{6}`, note: "Quadrants I and II." },
            { math: md`t = \frac{\pi}{6}, \frac{\pi}{2}, \frac{5\pi}{6}, \frac{3\pi}{2}`, note: "Four solutions." },
          ],
        },
        {
          kind: "why",
          title: "Why dividing by cos t loses solutions",
          body: md`Dividing both sides of $2\sin t\cos t = \cos t$ by $\cos t$ gives $2\sin t = 1$, which has only the two solutions $\frac{\pi}{6}$ and $\frac{5\pi}{6}$. The other two vanished. Division by $\cos t$ is only legal when $\cos t \ne 0$, so the step silently assumed away exactly the cases $t = \frac{\pi}{2}$ and $\frac{3\pi}{2}$, and those were solutions.

Factoring makes no assumption: $\cos t \cdot (2\sin t - 1) = 0$ keeps both possibilities and lets the zero product property sort them out. This is the same rule as in Algebra 1: never divide an equation by something that might be zero.`,
        },
        {
          kind: "check",
          prompt: md`Find the smallest positive solution of $\cos(2t) = \frac{1}{2}$. Give it as a multiple of $\pi$, like pi/6.`,
          answer: "pi/6",
          explain: md`$u = 2t$, $\cos u = \frac{1}{2}$, so the smallest positive $u$ is $\frac{\pi}{3}$. Then $t = \frac{u}{2} = \frac{\pi}{6}$.`,
        },
        {
          kind: "text",
          body: md`**Values not on the table.** For $\cos t = 0.3$ the reference angle is $\arccos 0.3 \approx 1.266$ (calculator, radian mode). Cosine is positive in quadrants I and IV, so on $[0, 2\pi)$ the solutions are $t \approx 1.266$ and $t \approx 2\pi - 1.266 \approx 5.017$.

Be careful with negatives: $\arcsin(-0.4) \approx -0.412$ is a solution of $\sin t = -0.4$, but it isn't in $[0, 2\pi)$. Its coterminal angle $2\pi - 0.412 \approx 5.872$ is, and so is the quadrant III partner $\pi + 0.412 \approx 3.553$. The method is identical to the exact case; only the arithmetic changes.`,
        },
      ],
      practice: [linearEquations, multipleAnglesAndQuadratics, identitiesAndSmallest],
    },
  ],
};
