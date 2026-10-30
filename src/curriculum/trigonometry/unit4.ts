import { fracTex, gcd, type Rng } from "../../math/random";
import { md, slug, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Multiples of pi as fractions ────────────────────────────────────────────
// Angles in this unit are rational multiples of pi, kept as [n, d] meaning n pi / d.

type Pf = [number, number];

const pf = (n: number, d: number): Pf => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const pfVal = ([n, d]: Pf) => (n * Math.PI) / d;
const pfAdd = (a: Pf, b: Pf): Pf => pf(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const pfSub = (a: Pf, b: Pf): Pf => pfAdd(a, [-b[0], b[1]]);
/** a times the plain rational k. */
const pfMul = (a: Pf, k: [number, number]): Pf => pf(a[0] * k[0], a[1] * k[1]);
/** The same angle brought into [0, m). */
function pfMod(a: Pf, m: Pf): Pf {
  let x = a;
  while (pfVal(x) < -1e-12) x = pfAdd(x, m);
  while (pfVal(x) >= pfVal(m) - 1e-12) x = pfSub(x, m);
  return x;
}

/** Typed-answer text: "pi/6", "-pi", "2pi/3", "0". */
function piText([n, d]: Pf): string {
  if (n === 0) return "0";
  const mag = Math.abs(n) === 1 ? "pi" : `${Math.abs(n)}pi`;
  const s = n < 0 ? "-" : "";
  return d === 1 ? `${s}${mag}` : `${s}${mag}/${d}`;
}
/** LaTeX: "\frac{\pi}{6}", "-\pi", "\frac{2\pi}{3}", "0". */
function piTex([n, d]: Pf): string {
  if (n === 0) return "0";
  const s = n < 0 ? "-" : "";
  const m = Math.abs(n);
  if (d === 1) return `${s}${m === 1 ? "" : m}\\pi`;
  return `${s}\\frac{${m === 1 ? "" : m}\\pi}{${d}}`;
}
/** " + \frac{\pi}{3}", " - \pi" or "" for the end of an argument. */
const piTexSigned = (a: Pf) => (a[0] === 0 ? "" : ` ${a[0] < 0 ? "-" : "+"} ${piTex([Math.abs(a[0]), a[1]])}`);
const piTextSigned = (a: Pf) => (a[0] === 0 ? "" : ` ${a[0] < 0 ? "-" : "+"} ${piText([Math.abs(a[0]), a[1]])}`);

// ── Coefficients ────────────────────────────────────────────────────────────

/** "", "-" or the number, for a coefficient in front of a function. */
const coef = (a: number) => (a === 1 ? "" : a === -1 ? "-" : String(a));
/** B x in LaTeX: "x", "2x", "\frac{x}{2}". */
const bTex = ([n, d]: Pf, v = "x") => (d === 1 ? `${n === 1 ? "" : n}${v}` : `\\frac{${n === 1 ? "" : n}${v}}{${d}}`);
/** B x in answer text: "x", "2x", "x/2". */
const bText = ([n, d]: Pf, v = "x") => (d === 1 ? `${n === 1 ? "" : n}${v}` : `${n === 1 ? "" : n}${v}/${d}`);
/** B applied to a compound expression X, for hidden verify equations. */
const bApply = ([n, d]: Pf, X: string) => `${n}*(${X})/${d}`;
/** B as a number in LaTeX. */
const bCoefTex = ([n, d]: Pf) => fracTex(n, d);
/** "\\sin" for "sin": a function name as a LaTeX command. */
const fnTex = (fn: string) => `\\${fn}`;
const signedNum = (n: number) => (n === 0 ? "" : n < 0 ? ` - ${-n}` : ` + ${n}`);

// ── Sinusoids y = A fn(Bx + c) + D ──────────────────────────────────────────

interface Sinusoid {
  A: number;
  B: Pf;
  /** The constant inside the argument, so the phase shift is -c/B. */
  c: Pf;
  D: number;
  fn: "sin" | "cos";
}

const argTex = (s: { B: Pf; c: Pf }) => `${bTex(s.B)}${piTexSigned(s.c)}`;
const sinusoidTex = (s: Sinusoid) => `${coef(s.A)}\\${s.fn}\\left(${argTex(s)}\\right)${signedNum(s.D)}`;
const sinusoidText = (s: Sinusoid) => `${coef(s.A)}${s.fn}(${bText(s.B)}${piTextSigned(s.c)})${signedNum(s.D)}`;
/** The function's value at the expression X, in answer syntax. */
const sinusoidAt = (s: Sinusoid, X: string) => `${s.A}*${s.fn}(${bApply(s.B, X)}${piTextSigned(s.c)})${signedNum(s.D)}`;
const period = (s: { B: Pf }): Pf => pf(2 * s.B[1], s.B[0]);
const phaseShift = (s: Sinusoid): Pf => pf(-s.c[0] * s.B[1], s.c[1] * s.B[0]);
/** The argument value at which the graph peaks (and the one at which it bottoms out). */
function peakArgs(s: Sinusoid): { peak: Pf; trough: Pf } {
  if (s.fn === "sin") return s.A > 0 ? { peak: [1, 2], trough: [3, 2] } : { peak: [3, 2], trough: [1, 2] };
  return s.A > 0 ? { peak: [0, 1], trough: [1, 1] } : { peak: [1, 1], trough: [0, 1] };
}
/** The x at which the argument equals `arg`. */
const xOfArg = (s: Sinusoid, arg: Pf): Pf => pfMul(pfSub(arg, s.c), [s.B[1], s.B[0]]);

const B_CHOICES: Pf[] = [[1, 1], [2, 1], [3, 1], [4, 1], [1, 2]];
const C_CHOICES: Pf[] = [[1, 6], [-1, 6], [1, 4], [-1, 4], [1, 3], [-1, 3], [1, 2], [-1, 2], [2, 3], [-2, 3], [1, 1], [-1, 1]];

function randomSinusoid(r: Rng, o: { shifted?: boolean } = {}): Sinusoid {
  const fn = r.pick(["sin", "cos"] as const);
  const A = r.nonzero(-5, 5);
  const B = r.pick(B_CHOICES);
  const c: Pf = o.shifted === false || (o.shifted === undefined && r.next() < 0.2) ? [0, 1] : r.pick(C_CHOICES);
  const D = r.int(-3, 3);
  return { A, B, c, D, fn };
}

// ── Exact values on the unit circle (Unit 3) ────────────────────────────────

const UNIT: { a: Pf; sin: string; cos: string }[] = [
  { a: [0, 1], sin: "0", cos: "1" },
  { a: [1, 6], sin: "1/2", cos: "sqrt(3)/2" },
  { a: [1, 4], sin: "sqrt(2)/2", cos: "sqrt(2)/2" },
  { a: [1, 3], sin: "sqrt(3)/2", cos: "1/2" },
  { a: [1, 2], sin: "1", cos: "0" },
  { a: [2, 3], sin: "sqrt(3)/2", cos: "-1/2" },
  { a: [3, 4], sin: "sqrt(2)/2", cos: "-sqrt(2)/2" },
  { a: [5, 6], sin: "1/2", cos: "-sqrt(3)/2" },
  { a: [1, 1], sin: "0", cos: "-1" },
  { a: [7, 6], sin: "-1/2", cos: "-sqrt(3)/2" },
  { a: [5, 4], sin: "-sqrt(2)/2", cos: "-sqrt(2)/2" },
  { a: [4, 3], sin: "-sqrt(3)/2", cos: "-1/2" },
  { a: [3, 2], sin: "-1", cos: "0" },
  { a: [5, 3], sin: "-sqrt(3)/2", cos: "1/2" },
  { a: [7, 4], sin: "-sqrt(2)/2", cos: "sqrt(2)/2" },
  { a: [11, 6], sin: "-1/2", cos: "sqrt(3)/2" },
];
const VAL_TEX: Record<string, string> = {
  "0": "0",
  "1": "1",
  "-1": "-1",
  "1/2": "\\frac{1}{2}",
  "-1/2": "-\\frac{1}{2}",
  "sqrt(2)/2": "\\frac{\\sqrt{2}}{2}",
  "-sqrt(2)/2": "-\\frac{\\sqrt{2}}{2}",
  "sqrt(3)/2": "\\frac{\\sqrt{3}}{2}",
  "-sqrt(3)/2": "-\\frac{\\sqrt{3}}{2}",
};
const VAL_NUM: Record<string, number> = {
  "0": 0,
  "1": 1,
  "-1": -1,
  "1/2": 0.5,
  "-1/2": -0.5,
  "sqrt(2)/2": Math.SQRT2 / 2,
  "-sqrt(2)/2": -Math.SQRT2 / 2,
  "sqrt(3)/2": Math.sqrt(3) / 2,
  "-sqrt(3)/2": -Math.sqrt(3) / 2,
};
const negate = (v: string) => (v === "0" ? "0" : v.startsWith("-") ? v.slice(1) : `-${v}`);
const absVal = (v: string) => (v.startsWith("-") ? v.slice(1) : v);

const KEY_X = [Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI];

// ── Lesson 1 generators ─────────────────────────────────────────────────────

const solveByGraph: Generator = (r) => {
  const fn = r.pick(["sin", "cos"] as const);
  const v = r.pick(Object.keys(VAL_TEX));
  const sols = UNIT.filter((u) => u[fn] === v)
    .map((u) => u.a)
    .sort((a, b) => pfVal(a) - pfVal(b));
  const vTex = VAL_TEX[v]!;
  const figure: Figure = {
    kind: "plot",
    x: [-0.4, 6.7],
    y: [-1.5, 1.5],
    curves: [{ expr: `${fn}(x)`, label: `y = ${fnTex(fn)} x` }],
    hlines: [{ y: VAL_NUM[v]! }],
    vlines: KEY_X.map((x) => ({ x })),
    points: sols.map((a) => ({ x: pfVal(a), y: VAL_NUM[v]!, color: 2 as const })),
    caption: md`The dashed vertical lines are $x = \frac{\pi}{2}, \pi, \frac{3\pi}{2}, 2\pi$. The horizontal line is $y = ${vTex}$.`,
  };
  const special = v === "0" || v === "1" || v === "-1";
  const where =
    v === "0"
      ? md`crosses the axis at ${sols.map((a) => `$x = ${piTex(a)}$`).join(" and ")}`
      : v === "1"
        ? md`has its peak at $x = ${piTex(sols[0]!)}$`
        : md`has its trough at $x = ${piTex(sols[0]!)}$`;
  let steps: Step[];
  if (special) {
    steps = [
      { math: md`${fnTex(fn)} x = ${vTex}`, note: md`A value of $${vTex}$ happens only at the key points of the graph: the peaks, the troughs and the zero crossings.` },
      { math: md`x = ${sols.map(piTex).join(", \\;")}`, note: md`On $[0, 2\pi)$ the graph of $y = ${fnTex(fn)} x$ ${where}.` },
    ];
  } else {
    const ref = UNIT.find((u) => pfVal(u.a) < Math.PI / 2 && u[fn] === absVal(v))!.a;
    const positive = !v.startsWith("-");
    const quadrants =
      fn === "sin"
        ? positive
          ? md`Sine is positive in quadrants I and II, so the angles are $${piTex(ref)}$ and $\pi - ${piTex(ref)}$.`
          : md`Sine is negative in quadrants III and IV, so the angles are $\pi + ${piTex(ref)}$ and $2\pi - ${piTex(ref)}$.`
        : positive
          ? md`Cosine is positive in quadrants I and IV, so the angles are $${piTex(ref)}$ and $2\pi - ${piTex(ref)}$.`
          : md`Cosine is negative in quadrants II and III, so the angles are $\pi - ${piTex(ref)}$ and $\pi + ${piTex(ref)}$.`;
    steps = [
      {
        math: md`y = ${vTex}`,
        note: md`The line $y = ${vTex}$ cuts one period of the graph twice, ${positive ? "above" : "below"} the $x$-axis.`,
      },
      { math: md`\text{reference angle } ${piTex(ref)}`, note: md`$${fnTex(fn)} ${piTex(ref)} = ${VAL_TEX[absVal(v)]}$ from the unit-circle table (Unit 3).` },
      { math: md`x = ${sols.map(piTex).join(", \\;")}`, note: quadrants },
    ];
  }
  return {
    prompt: md`Solve $${fnTex(fn)} x = ${vTex}$ on $[0, 2\pi)$ by reading the graph. Give every solution exactly, as a comma-separated list like pi/6, 5pi/6.`,
    answer: sols.map(piText).join(", "),
    form: "set",
    figure,
    hint: special
      ? md`$${vTex}$ is a peak, trough or zero of the graph. Which of the five key points of $y = ${fnTex(fn)} x$ have that height?`
      : md`Find the acute angle whose ${fn === "sin" ? "sine" : "cosine"} is $${VAL_TEX[absVal(v)]}$, then use the symmetry of the graph to find the second crossing.`,
    solution: steps,
  };
};

const evaluateFar: Generator = (r) => {
  const fn = r.pick(["sin", "cos"] as const);
  const u = r.pick(UNIT);
  const negative = u.a[0] !== 0 && r.next() < 0.4;
  const k = negative ? r.int(0, 1) : r.int(1, 3);
  const big = pfAdd(u.a, [2 * k, 1]);
  const shown: Pf = negative ? [-big[0], big[1]] : big;
  const value = negative && fn === "sin" ? negate(u[fn]) : u[fn];
  const steps: Step[] = [];
  if (negative) {
    steps.push({
      math: md`${fnTex(fn)}\left(${piTex(shown)}\right) = ${fn === "sin" ? "-" : ""}${fnTex(fn)}\left(${piTex(big)}\right)`,
      note: fn === "sin" ? md`Sine is odd: $\sin(-x) = -\sin x$.` : md`Cosine is even: $\cos(-x) = \cos x$.`,
    });
  }
  if (k > 0) {
    steps.push({
      math: md`${piTex(big)} = ${piTex(u.a)} + ${k === 1 ? "2\\pi" : `${k} \\cdot 2\\pi`}`,
      note: md`Take off whole turns. The period is $2\pi$, so the value repeats every $2\pi$.`,
    });
    steps.push({ math: md`${fnTex(fn)}\left(${piTex(big)}\right) = ${fnTex(fn)}\left(${piTex(u.a)}\right)`, note: "Same point on the unit circle, same coordinates." });
  }
  steps.push({ math: md`${negative && fn === "sin" ? "-" : ""}${fnTex(fn)}\left(${piTex(u.a)}\right) = ${VAL_TEX[value]}`, note: "From the unit-circle table (Unit 3)." });
  return {
    prompt: md`Find the value of $${fnTex(fn)}\left(${piTex(shown)}\right)$. Give the exact value, like sqrt(3)/2 or -1/2.`,
    answer: value,
    simplified: true,
    hint: md`${negative ? (fn === "sin" ? "Sine is odd, so pull the minus sign out first. " : "Cosine is even, so the minus sign can be dropped. ") : ""}Then subtract $2\pi$ as many times as needed to land in $[0, 2\pi)$: the graph repeats every $2\pi$.`,
    solution: steps,
  };
};

const whichBasic: Generator = (r) => {
  const which = r.int(0, 3);
  const fn = which % 2 === 0 ? "sin" : "cos";
  const neg = which >= 2;
  const expr = `${neg ? "-" : ""}${fn}(x)`;
  const tex = `${neg ? "-" : ""}${fnTex(fn)} x`;
  const y0 = fn === "sin" ? 0 : neg ? -1 : 1;
  const yq = fn === "sin" ? (neg ? -1 : 1) : 0;
  const figure: Figure = {
    kind: "plot",
    x: [-6.6, 6.6],
    y: [-1.5, 1.5],
    curves: [{ expr }],
    vlines: [-Math.PI, -Math.PI / 2, Math.PI / 2, Math.PI].map((x) => ({ x })),
    points: [
      { x: 0, y: y0, label: `(0, ${y0})`, color: 2 },
      { x: Math.PI / 2, y: yq, label: `\\left(\\tfrac{\\pi}{2}, ${yq}\\right)`, color: 3 },
    ],
    caption: md`Dashed lines at $x = \pm\frac{\pi}{2}$ and $x = \pm\pi$.`,
  };
  return {
    prompt: md`The graph shows one of $y = \sin x$, $y = \cos x$, $y = -\sin x$ and $y = -\cos x$. The marked points are at $x = 0$ and $x = \frac{\pi}{2}$. Which function is it? Type it as an expression in $x$, like -cos(x).`,
    answer: expr,
    figure,
    hint: md`Look at $x = 0$ first: $\sin 0 = 0$, so a sine graph passes through the origin, while a cosine graph starts at $1$ or $-1$. Then the point at $x = \frac{\pi}{2}$ settles the sign.`,
    solution: [
      {
        math: md`y(0) = ${y0}`,
        note: fn === "sin" ? md`The graph passes through the origin, so it is $\sin x$ or $-\sin x$ (cosine would start at $\pm 1$).` : md`The graph starts at $${y0}$, not $0$, so it is a cosine graph: $\cos 0 = 1$ gives ${neg ? "$-\\cos x$" : "$\\cos x$"}.`,
      },
      {
        math: md`y\left(\tfrac{\pi}{2}\right) = ${yq}`,
        note: fn === "sin" ? md`$\sin\frac{\pi}{2} = 1$, so the graph that reaches $${yq}$ there is $${tex}$.` : md`Both $\cos x$ and $-\cos x$ cross the axis at $\frac{\pi}{2}$; this point confirms the shape but the sign came from $x = 0$.`,
      },
      { math: md`y = ${tex}`, note: "" },
    ],
  };
};

// ── Lesson 2 generators ─────────────────────────────────────────────────────

const readParameter: Generator = (r) => {
  const kind = r.int(0, 3);
  const s = randomSinusoid(r, kind === 2 ? { shifted: true } : {});
  const { A, B, c, D, fn } = s;
  const tex = sinusoidTex(s);
  const P = period(s);
  const at = (X: string) => sinusoidAt(s, X);
  const { peak, trough } = peakArgs(s);
  const xPeak = xOfArg(s, peak);
  const xTrough = xOfArg(s, trough);

  if (kind === 0) {
    return {
      prompt: md`For $y = ${tex}$, find the amplitude.`,
      answer: String(Math.abs(A)),
      verify: [`${at(piText(xPeak))} - (${at(piText(xTrough))}) = 2a`],
      hint: md`The amplitude is $|A|$, the number multiplying the ${fn === "sin" ? "sine" : "cosine"}: half the distance from the lowest point to the highest.`,
      solution: [
        { math: md`A = ${A}`, note: md`The coefficient in front of $${fnTex(fn)}$.` },
        {
          math: md`\text{amplitude} = |A| = ${Math.abs(A)}`,
          note: A < 0 ? md`A negative $A$ reflects the graph across its midline; it doesn't change how far the graph swings.` : md`The graph rises $${A}$ above its midline and falls $${A}$ below it.`,
        },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`For $y = ${tex}$, find the period. Give it exactly, like 2pi/3.`,
      answer: piText(P),
      verify: [`${at("(0.7 + p)")} = ${at("0.7")}`, `${at("(0.7 + p/2)")} = ${2 * D} - (${at("0.7")})`],
      hint: md`One cycle happens while the input $Bx${piTexSigned(c)}$ runs through $2\pi$. How far must $x$ move for that?`,
      solution: [
        { math: md`B = ${bCoefTex(B)}`, note: md`The coefficient of $x$ inside the ${fn === "sin" ? "sine" : "cosine"}.${c[0] !== 0 ? " The constant added inside shifts the graph but doesn't change its period." : ""}` },
        { math: md`\text{period} = \frac{2\pi}{B} = \frac{2\pi}{${bCoefTex(B)}} = ${piTex(P)}`, note: md`$${fnTex(fn)}$ repeats when its input grows by $2\pi$, and the input grows by $2\pi$ when $x$ grows by $2\pi / B$.` },
      ],
    };
  }
  if (kind === 2) {
    const h = phaseShift(s);
    const verify =
      fn === "sin"
        ? [`${at("h")} = ${D}`, `${at(`(h + ${piText(pfMul(P, [1, 4]))})`)} = ${D + A}`]
        : [`${at("h")} = ${D + A}`, `${at(`(h + ${piText(pfMul(P, [1, 2]))})`)} = ${D - A}`];
    return {
      prompt: md`For $y = ${tex}$, find the phase shift. Give it exactly, like pi/6; a shift to the left is negative.`,
      answer: piText(h),
      verify,
      hint: md`The basic ${fn === "sin" ? "sine" : "cosine"} cycle starts where its input is $0$. Set the whole argument $${argTex(s)}$ equal to $0$ and solve for $x$. Don't just read off the constant: it still has to be divided by $B$.`,
      solution: [
        { math: md`${argTex(s)} = 0`, note: md`The cycle of $y = ${fnTex(fn)} x$ starts at $x = 0$; here the cycle starts where the argument is $0$.` },
        { math: md`${bTex(B)} = ${piTex([-c[0], c[1]])}`, note: "Move the constant across." },
        { math: md`x = ${piTex(h)}`, note: md`Divide by $B = ${bCoefTex(B)}$. ${h[0] > 0 ? "Positive, so the graph is shifted to the right." : "Negative, so the graph is shifted to the left."}` },
      ],
    };
  }
  return {
    prompt: md`For $y = ${tex}$, find the maximum value of $y$.`,
    answer: String(D + Math.abs(A)),
    verify: [`${at(piText(xPeak))} = m`],
    hint: md`The ${fn === "sin" ? "sine" : "cosine"} part swings between $-1$ and $1$. Multiply by $A$, then add $D$.`,
    solution: [
      { math: md`-1 \le ${fnTex(fn)}\left(${argTex(s)}\right) \le 1`, note: "Whatever the input, a sine or cosine stays in this range." },
      { math: md`${-Math.abs(A)} \le ${coef(A)}${fnTex(fn)}\left(${argTex(s)}\right) \le ${Math.abs(A)}`, note: A < 0 ? md`Multiplying by a negative number swaps the ends of the range.` : md`Multiply through by $${A}$.` },
      { math: md`\max y = ${Math.abs(A)}${signedNum(D)} = ${D + Math.abs(A)}`, note: md`Adding $${D}$ lifts the whole range. The maximum is the midline $y = ${D}$ plus the amplitude.` },
    ],
  };
};

const equationFromGraph: Generator = (r) => {
  const fn = r.pick(["sin", "cos"] as const);
  const A = r.sign() * r.int(1, 4);
  const B = r.pick<Pf>([[1, 1], [2, 1], [3, 1], [1, 2]]);
  const D = r.int(-2, 2);
  const s: Sinusoid = { A, B, c: [0, 1], D, fn };
  const { peak, trough } = peakArgs(s);
  const P = period(s);
  const yMax = D + Math.abs(A);
  const yMin = D - Math.abs(A);
  const marks = [
    { kind: "maximum", x: xOfArg(s, peak), y: yMax },
    { kind: "minimum", x: xOfArg(s, trough), y: yMin },
  ].sort((a, b) => pfVal(a.x) - pfVal(b.x));
  const [first, second] = marks as [(typeof marks)[0], (typeof marks)[0]];
  const half = pfSub(second.x, first.x);
  const figure: Figure = {
    kind: "plot",
    x: [-0.6, pfVal(P) * 1.25 + 0.4],
    y: [yMin - 1, yMax + 1],
    curves: [{ expr: sinusoidText(s) }],
    points: marks.map((m, i) => ({ x: pfVal(m.x), y: m.y, label: `\\left(${piTex(m.x)}, ${m.y}\\right)`, color: (i === 0 ? 2 : 3) as 2 | 3 })),
    vlines: [{ x: pfVal(first.x) }, { x: pfVal(second.x) }],
  };
  const shape =
    fn === "sin"
      ? A > 0
        ? md`At $x = 0$ the graph is on its midline and rising, like $\sin x$. So it is a sine with $A > 0$.`
        : md`At $x = 0$ the graph is on its midline and falling: a reflected sine, so $A < 0$.`
      : A > 0
        ? md`At $x = 0$ the graph is at its maximum, like $\cos x$. So it is a cosine with $A > 0$.`
        : md`At $x = 0$ the graph is at its minimum: a reflected cosine, so $A < 0$.`;
  return {
    prompt: md`The graph shows $y = A\sin(Bx) + D$ or $y = A\cos(Bx) + D$ for some constants $A$, $B > 0$ and $D$. The marked points are a ${first.kind} at $\left(${piTex(first.x)}, ${first.y}\right)$ and the next ${second.kind} at $\left(${piTex(second.x)}, ${second.y}\right)$. Find an equation for the graph. Type it as an expression in $x$, like 3sin(2x) + 1.`,
    answer: sinusoidText(s),
    figure,
    hint: md`Amplitude is half of (max $-$ min); the midline $D$ is their average; a maximum and the next minimum are half a period apart. Then decide whether $x = 0$ sits on the midline (sine) or at a peak or trough (cosine).`,
    solution: [
      { math: md`|A| = \frac{${yMax} - (${yMin})}{2} = ${Math.abs(A)}`, note: "Half the vertical distance from trough to peak." },
      { math: md`D = \frac{${yMax} + (${yMin})}{2} = ${D}`, note: "The midline is halfway between the maximum and the minimum." },
      { math: md`\tfrac{1}{2}\,\text{period} = ${piTex(second.x)} - ${piTex(first.x)} = ${piTex(half)}`, note: "A maximum and the next minimum are half a cycle apart." },
      { math: md`\text{period} = ${piTex(P)}, \qquad B = \frac{2\pi}{${piTex(P)}} = ${bCoefTex(B)}`, note: md`Period is $2\pi / B$, so $B = 2\pi / \text{period}$.` },
      { math: md`y = ${sinusoidTex(s)}`, note: shape },
    ],
  };
};

const firstMaximum: Generator = (r) => {
  const s = randomSinusoid(r);
  const { A, B, c, D, fn } = s;
  const P = period(s);
  const { peak } = peakArgs(s);
  const raw = xOfArg(s, peak);
  const x = pfMod(raw, P);
  const k = Math.round((pfVal(x) - pfVal(raw)) / pfVal(P));
  return {
    prompt: md`Find the smallest $x \ge 0$ at which $y = ${sinusoidTex(s)}$ reaches its maximum value. Give it exactly, like 5pi/12.`,
    answer: piText(x),
    verify: [`${sinusoidAt(s, "m")} = ${D + Math.abs(A)}`],
    hint: md`The maximum happens when the ${fn === "sin" ? "sine" : "cosine"} part equals $${A > 0 ? 1 : -1}$. Set the argument equal to the angle where that happens (plus any number of full turns) and solve for $x$.`,
    solution: [
      {
        math: md`${fnTex(fn)}\left(${argTex(s)}\right) = ${A > 0 ? 1 : -1}`,
        note: A > 0 ? md`$A = ${A}$ is positive, so $y$ is largest when the ${fn === "sin" ? "sine" : "cosine"} is at its largest, $1$. Then $y = ${A} \cdot 1${signedNum(D)} = ${D + A}$.` : md`$A = ${A}$ is negative, so $y$ is largest when the ${fn === "sin" ? "sine" : "cosine"} is at its smallest, $-1$. Then $y = ${A} \cdot (-1)${signedNum(D)} = ${D - A}$.`,
      },
      { math: md`${argTex(s)} = ${piTex(peak)} + 2\pi k`, note: md`$${fnTex(fn)} t = ${A > 0 ? 1 : -1}$ exactly when $t = ${piTex(peak)}$ plus whole turns.` },
      { math: md`x = ${piTex(raw)} + ${piTex(P)}\,k`, note: md`Move the constant across and divide by $B = ${bCoefTex(B)}$. Each full turn of the argument is one period, $${piTex(P)}$, in $x$.` },
      { math: md`x = ${piTex(x)}`, note: k === 0 ? md`$k = 0$ already gives a value in $[0, ${piTex(P)})$, and smaller $k$ would make it negative.` : md`With $k = ${k}$ the value lands in $[0, ${piTex(P)})$; smaller $k$ gives a negative $x$.` },
    ],
  };
};

// ── Lesson 3 generators ─────────────────────────────────────────────────────

type Other = "tan" | "cot" | "sec" | "csc";
const OTHERS: Other[] = ["tan", "cot", "sec", "csc"];
const otherTex = (A: number, fn: Other, B: Pf, c: Pf, D = 0) =>
  B[0] === 1 && B[1] === 1 && c[0] === 0 ? `${coef(A)}${fnTex(fn)} x${signedNum(D)}` : `${coef(A)}${fnTex(fn)}\\left(${argTex({ B, c })}\\right)${signedNum(D)}`;

const asymptotes: Generator = (r) => {
  const fn = r.pick(OTHERS);
  const A = r.pick([1, 1, 2, 3]);
  const B = r.pick<Pf>([[1, 1], [2, 1], [3, 1], [4, 1]]);
  const c = r.pick<Pf>([[0, 1], [0, 1], [1, 6], [-1, 6], [1, 4], [-1, 4], [1, 3], [-1, 3], [1, 2], [-1, 2]]);
  const span = pf(2 * B[1], B[0]);
  const gap = pf(B[1], B[0]);
  const cosType = fn === "tan" || fn === "sec";
  const base: Pf = cosType ? [1, 2] : [0, 1];
  const xs = [0, 1]
    .map((k) => pfMod(pfMul(pfSub(pfAdd(base, [k, 1]), c), [B[1], B[0]]), span))
    .sort((a, b) => pfVal(a) - pfVal(b));
  const x0 = pfMul(pfSub(base, c), [B[1], B[0]]);
  const ratio = fn === "tan" ? "\\frac{\\sin t}{\\cos t}" : fn === "cot" ? "\\frac{\\cos t}{\\sin t}" : fn === "sec" ? "\\frac{1}{\\cos t}" : "\\frac{1}{\\sin t}";
  const arg = argTex({ B, c });
  return {
    prompt: md`Find the vertical asymptotes of $y = ${otherTex(A, fn, B, c)}$ on $[0, ${piTex(span)})$. Give the $x$-values as a comma-separated list of exact values, like pi/4, 3pi/4.`,
    answer: xs.map(piText).join(", "),
    form: "set",
    verify: [`${cosType ? "cos" : "sin"}(${bApply(B, "x")}${piTextSigned(c)}) = 0`],
    hint: md`$${fnTex(fn)} t = ${ratio}$ has an asymptote wherever its denominator is $0$: at $t = ${cosType ? "\\frac{\\pi}{2} + k\\pi" : "k\\pi"}$. Set the argument equal to that and solve for $x$.`,
    solution: [
      { math: md`${fnTex(fn)} t = ${ratio}`, note: md`A fraction blows up where its denominator is $0$, so the asymptotes are where $${fnTex(cosType ? "cos" : "sin")}$ of the argument is $0$.` },
      { math: md`${arg} = ${piTex(base)} + k\pi`, note: md`$${fnTex(cosType ? "cos" : "sin")} t = 0$ exactly at ${cosType ? "odd multiples of $\\frac{\\pi}{2}$" : "multiples of $\\pi$"}.` },
      { math: md`x = ${piTex(x0)} + ${piTex(gap)}\,k`, note: md`Move the constant across and divide by $B = ${bCoefTex(B)}$. Consecutive asymptotes are $${piTex(gap)}$ apart, one period of the graph.` },
      { math: md`x = ${xs.map(piTex).join(", \\;")}`, note: md`These are the values of $k$ that land in $[0, ${piTex(span)})$.` },
    ],
  };
};

const periodOfOthers: Generator = (r) => {
  const fn = r.pick(OTHERS);
  const A = r.nonzero(-3, 3);
  const B = r.pick(B_CHOICES);
  const c = r.pick<Pf>([[0, 1], [0, 1], [0, 1], [1, 6], [-1, 6], [1, 4], [-1, 4], [1, 3], [-1, 3], [1, 2], [-1, 2]]);
  const D = r.int(-2, 2);
  const halfTurn = fn === "tan" || fn === "cot";
  const P: Pf = halfTurn ? pf(B[1], B[0]) : pf(2 * B[1], B[0]);
  // A sample x whose argument stays well away from every asymptote.
  const x0 = [0.37, 0.7, 1.1, 0.23, 0.53].find((x) => {
    const t = (B[0] / B[1]) * x + pfVal(c);
    const q = t / (Math.PI / 2);
    return Math.abs(q - Math.round(q)) * (Math.PI / 2) > 0.3;
  })!;
  const arg = (X: string) => `${bApply(B, X)}${piTextSigned(c)}`;
  const g = (X: string) => `${A}*${fn}(${arg(X)})${signedNum(D)}`;
  const flipped = fn === "tan" ? `-(${A})/tan(${arg(String(x0))})` : fn === "cot" ? `-(${A})*tan(${arg(String(x0))})` : `-(${A})*${fn}(${arg(String(x0))})`;
  const direct = `\\frac{${halfTurn ? "\\pi" : "2\\pi"}}{${bCoefTex(B)}}`;
  return {
    prompt: md`Find the period of $y = ${otherTex(A, fn, B, c, D)}$. Give it exactly, like pi/3.`,
    answer: piText(P),
    verify: [`${g(`(${x0} + p)`)} = ${g(String(x0))}`, `${g(`(${x0} + p/2)`)} = ${flipped}${signedNum(D)}`],
    hint: md`The basic period of $${fnTex(fn)} t$ is $${halfTurn ? "\\pi" : "2\\pi"}$. The input $${argTex({ B, c })}$ runs through that much while $x$ runs through $${halfTurn ? "\\pi" : "2\\pi"} / B$.`,
    solution: [
      {
        math: md`\text{period of } ${fnTex(fn)} t \text{ is } ${halfTurn ? "\\pi" : "2\\pi"}`,
        note: halfTurn ? md`Tangent and cotangent repeat every half turn, because a half turn flips the signs of both coordinates and the ratio is unchanged.` : md`Secant and cosecant are reciprocals of cosine and sine, so they repeat every full turn, $2\pi$.`,
      },
      {
        math: md`\text{period} = \frac{${halfTurn ? "\\pi" : "2\\pi"}}{B} = ${direct}${direct === piTex(P) ? "" : ` = ${piTex(P)}`}`,
        note: md`The input grows by $${halfTurn ? "\\pi" : "2\\pi"}$ when $x$ grows by $${halfTurn ? "\\pi" : "2\\pi"} / B$.${c[0] !== 0 || D !== 0 || Math.abs(A) !== 1 ? " The other constants stretch or slide the graph without changing how often it repeats." : ""}`,
      },
    ],
  };
};

const tangentFromGraph: Generator = (r) => {
  const A = r.sign() * r.int(1, 3);
  const B = r.pick<Pf>([[1, 1], [2, 1], [3, 1], [1, 2]]);
  const half = pf(B[1], 2 * B[0]);
  const quarter = pf(B[1], 4 * B[0]);
  const P = pf(B[1], B[0]);
  const expr = `${coef(A)}tan(${bText(B)})`;
  const tex = `${coef(A)}\\tan${B[0] === 1 && B[1] === 1 ? " x" : `\\left(${bTex(B)}\\right)`}`;
  const reach = pfVal(half) * 3.3;
  const figure: Figure = {
    kind: "plot",
    x: [-reach, reach],
    y: [-(3 * Math.abs(A) + 1), 3 * Math.abs(A) + 1],
    curves: [{ expr }],
    vlines: [-3, -1, 1, 3].map((m) => ({ x: m * pfVal(half) })),
    points: [{ x: pfVal(quarter), y: A, label: `\\left(${piTex(quarter)}, ${A}\\right)`, color: 2 }],
    caption: md`The dashed lines are the asymptotes.`,
  };
  return {
    prompt: md`The graph shows $y = A\tan(Bx)$ for some constants $A$ and $B > 0$. Its vertical asymptotes nearest the origin are at $x = \pm ${piTex(half)}$, and the marked point is $\left(${piTex(quarter)}, ${A}\right)$. Find the equation. Type it as an expression in $x$, like 2tan(2x).`,
    answer: expr,
    figure,
    hint: md`$\tan(Bx)$ has its first asymptote where $Bx = \frac{\pi}{2}$, so the distance between neighbouring asymptotes is the period $\pi / B$. Then use the marked point to find $A$.`,
    solution: [
      { math: md`\text{period} = 2 \cdot ${piTex(half)} = ${piTex(P)}`, note: "Neighbouring asymptotes are one period apart." },
      { math: md`\frac{\pi}{B} = ${piTex(P)} \;\Rightarrow\; B = ${bCoefTex(B)}`, note: md`The period of $\tan(Bx)$ is $\pi / B$.` },
      { math: md`A \tan\left(${bCoefTex(B)} \cdot ${piTex(quarter)}\right) = A \tan\frac{\pi}{4} = A = ${A}`, note: md`At the marked point the input to tangent is $\frac{\pi}{4}$, where $\tan = 1$, so the height there is $A$ itself.${A < 0 ? " The graph falls from left to right, which also tells you $A$ is negative." : ""}` },
      { math: md`y = ${tex}`, note: "" },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit4: Unit = {
  title: "Graphs of Trig Functions",
  lessons: [
    {
      id: slug("Graphing sine and cosine"),
      title: "Graphing sine and cosine",
      summary: "Unwrap the unit circle into the sine and cosine waves, and learn their key points, period and symmetry.",
      blocks: [
        {
          kind: "text",
          body: md`In Unit 3, $\cos t$ and $\sin t$ were the coordinates of the point on the unit circle at angle $t$. Now let the angle run. As $t$ grows, the point goes round and round, and its height goes up and down. Plot that height against the angle and you get a wave.

From here on the input is called $x$, as for any function, and $y = \sin x$ means "the height of the unit-circle point at angle $x$ radians".`,
        },
        {
          kind: "plot",
          x: [-3.5, 6.7],
          y: [-1.6, 1.6],
          parametric: [
            { x: "cos(t) - 2", y: "sin(t)", t: [0, 6.2832], color: 3 },
            { x: "-2 + t cos(a)", y: "t sin(a)", t: [0, 1], color: 2 },
          ],
          curves: [{ expr: "sin(x)", domain: [0, 6.2832], label: "y = \\sin x" }],
          hlines: [{ y: "sin(a)" }],
          points: [
            { x: "cos(a) - 2", y: "sin(a)", label: "P = (\\cos a, \\sin a)", color: 2 },
            { x: "a", y: "sin(a)", label: "(a, \\sin a) = ({a}, {=sin(a)})", color: 1 },
          ],
          params: [{ name: "a", tex: "a", min: 0, max: 6.28, step: 0.02, value: 1 }],
          caption: md`Slide $a$. The point $P$ travels round the unit circle (drawn on the left, centred at $(-2, 0)$). Its height is carried straight across to the point $(a, \sin a)$ on the graph: the horizontal distance along the graph is the angle, the height is the sine.`,
        },
        {
          kind: "key",
          title: "The sine and cosine functions",
          body: md`For any real number $x$, read as an angle in radians, $\sin x$ is the $y$-coordinate and $\cos x$ is the $x$-coordinate of the point on the unit circle at angle $x$.

- Domain: all real numbers. Every angle has a point.
- Range: $[-1, 1]$.
- Period: $2\pi$. Both graphs repeat exactly every $2\pi$.`,
        },
        {
          kind: "why",
          title: "Why the range is [-1, 1]",
          body: md`A point $(x, y)$ on the unit circle satisfies $x^2 + y^2 = 1$ (Geometry, Unit 7). So $y^2 \le 1$, which means $-1 \le y \le 1$, and the same for $x$. The height $1$ is reached at the top of the circle, $-1$ at the bottom, and every height in between is passed on the way round. So the range is exactly $[-1, 1]$.`,
        },
        {
          kind: "why",
          title: "Why the graph repeats every 2π",
          body: md`A full turn is $2\pi$ radians (Unit 1). The angles $x$ and $x + 2\pi$ land on the same point of the circle, so they have the same coordinates:

$$\sin(x + 2\pi) = \sin x, \qquad \cos(x + 2\pi) = \cos x.$$

Could the graph repeat sooner? $\sin x = 1$ only at the top of the circle, $x = \frac{\pi}{2} + 2\pi k$, so neighbouring peaks are exactly $2\pi$ apart. Nothing shorter than $2\pi$ can carry a peak onto a peak. So $2\pi$ is the **period**, the smallest positive repeat.`,
        },
        {
          kind: "key",
          title: "Five key points",
          body: md`Over one period $[0, 2\pi]$, each graph is pinned down by what happens at the quarter turns.

- $y = \sin x$: $(0, 0)$, $\left(\frac{\pi}{2}, 1\right)$, $(\pi, 0)$, $\left(\frac{3\pi}{2}, -1\right)$, $(2\pi, 0)$. Start on the midline, up to the peak, back through the midline, down to the trough, back up.
- $y = \cos x$: $(0, 1)$, $\left(\frac{\pi}{2}, 0\right)$, $(\pi, -1)$, $\left(\frac{3\pi}{2}, 0\right)$, $(2\pi, 1)$. Start at the peak, down through the midline to the trough, back up.

Plot these five and join them with a smooth wave, then copy the pattern left and right.`,
        },
        {
          kind: "plot",
          x: [-6.6, 6.6],
          y: [-1.5, 1.5],
          curves: [
            { expr: "sin(x)", label: "y = \\sin x" },
            { expr: "cos(x)", label: "y = \\cos x", color: 2 },
          ],
          vlines: KEY_X.map((x) => ({ x })),
          points: [
            { x: Math.PI / 2, y: 1, label: "\\left(\\tfrac{\\pi}{2}, 1\\right)", color: 1 },
            { x: Math.PI, y: 0, label: "(\\pi, 0)", color: 1 },
            { x: (3 * Math.PI) / 2, y: -1, label: "\\left(\\tfrac{3\\pi}{2}, -1\\right)", color: 1 },
            { x: 2 * Math.PI, y: 0, label: "(2\\pi, 0)", color: 1 },
          ],
          caption: md`Sine and cosine on $[-2\pi, 2\pi]$, with the key points of sine marked and dashed lines at $x = \frac{\pi}{2}, \pi, \frac{3\pi}{2}, 2\pi$. Notice that cosine is the same wave as sine, slid a quarter period to the left: the cosine peak at $x = 0$ matches the sine peak at $x = \frac{\pi}{2}$.`,
        },
        {
          kind: "proof",
          title: "Cosine is sine shifted left by a quarter turn",
          given: md`$P$ is the point on the unit circle at angle $x$.`,
          prove: md`$\cos x = \sin\left(x + \frac{\pi}{2}\right)$`,
          steps: [
            { statement: md`$P = (\cos x, \sin x)$`, reason: "Definition of sine and cosine on the unit circle (Unit 3)" },
            { statement: md`The point $Q$ at angle $x + \frac{\pi}{2}$ is $P$ rotated a quarter turn counterclockwise about $O$`, reason: md`Angles add around the circle; $\frac{\pi}{2}$ is a quarter turn (Unit 1)` },
            { statement: md`Rotating $(a, b)$ a quarter turn counterclockwise gives $(-b, a)$`, reason: md`$OQ$ has the same length as $OP$ and is perpendicular to it: the slopes $\frac{b}{a}$ and $\frac{a}{-b}$ multiply to $-1$ (Geometry). Of the two perpendicular directions, $(-b, a)$ is the counterclockwise one: it sends $(1, 0)$ to $(0, 1)$` },
            { statement: md`$Q = (-\sin x, \cos x)$`, reason: md`Apply the rotation to $P$` },
            { statement: md`$Q = \left(\cos\left(x + \frac{\pi}{2}\right), \sin\left(x + \frac{\pi}{2}\right)\right)$`, reason: "Definition of sine and cosine, at the angle of Q" },
            { statement: md`$\sin\left(x + \frac{\pi}{2}\right) = \cos x$ and $\cos\left(x + \frac{\pi}{2}\right) = -\sin x$`, reason: "Two names for the coordinates of Q" },
          ],
        },
        {
          kind: "text",
          body: md`Replacing $x$ by $x + \frac{\pi}{2}$ shifts a graph $\frac{\pi}{2}$ to the **left** (Algebra 2, Unit 1). So the cosine graph is the sine graph moved a quarter period left, which is what the picture shows. Everything you learn about one graph transfers to the other.`,
        },
        {
          kind: "key",
          title: "Symmetry: cosine is even, sine is odd",
          body: md`$$\cos(-x) = \cos x, \qquad \sin(-x) = -\sin x.$$

The cosine graph is a mirror image across the $y$-axis. The sine graph is unchanged by a half turn about the origin.`,
        },
        {
          kind: "why",
          title: "Why",
          body: md`The angles $x$ and $-x$ are measured the same distance from the positive $x$-axis, one counterclockwise and one clockwise. Their points are reflections of each other across the $x$-axis: same $x$-coordinate, opposite $y$-coordinate. The $x$-coordinate is the cosine, so $\cos(-x) = \cos x$. The $y$-coordinate is the sine, so $\sin(-x) = -\sin x$.`,
        },
        {
          kind: "example",
          title: "Values far along the graph",
          problem: md`Find $\sin\left(\frac{17\pi}{6}\right)$ and $\cos\left(-\frac{5\pi}{3}\right)$.`,
          steps: [
            { math: md`\frac{17\pi}{6} = \frac{5\pi}{6} + 2\pi`, note: md`Take off a full turn. The graph repeats every $2\pi$, so the height is the same.` },
            { math: md`\sin\frac{17\pi}{6} = \sin\frac{5\pi}{6} = \frac{1}{2}`, note: md`$\frac{5\pi}{6}$ is in quadrant II with reference angle $\frac{\pi}{6}$ (Unit 3).` },
            { math: md`\cos\left(-\frac{5\pi}{3}\right) = \cos\frac{5\pi}{3}`, note: "Cosine is even: the sign of the angle doesn't matter." },
            { math: md`\cos\frac{5\pi}{3} = \frac{1}{2}`, note: md`Quadrant IV, reference angle $\frac{\pi}{3}$, where cosine is positive.` },
          ],
        },
        {
          kind: "example",
          title: "Reading solutions off the graph",
          problem: md`Find every $x$ in $[0, 2\pi)$ with $\sin x = -\frac{1}{2}$.`,
          steps: [
            { math: md`y = -\tfrac{1}{2}`, note: "Draw this horizontal line. It cuts one period of the sine wave twice, both times below the axis." },
            { math: md`\sin\frac{\pi}{6} = \frac{1}{2}`, note: md`The reference angle is $\frac{\pi}{6}$.` },
            { math: md`x = \pi + \frac{\pi}{6} = \frac{7\pi}{6}, \qquad x = 2\pi - \frac{\pi}{6} = \frac{11\pi}{6}`, note: "Sine is negative in quadrants III and IV. On the graph: the wave is below the axis between π and 2π, and the two crossings sit symmetrically either side of the trough at 3π/2." },
          ],
        },
        {
          kind: "check",
          prompt: md`Using the graph of $y = \cos x$, list every $x$ in $[0, 2\pi)$ where $\cos x = 0$. Type them like pi/2, 3pi/2.`,
          answer: "pi/2, 3pi/2",
          form: "set",
          explain: md`Cosine crosses the axis a quarter and three quarters of the way through its period: at $\frac{\pi}{2}$ and $\frac{3\pi}{2}$, where the unit-circle point is at the top or bottom and its $x$-coordinate is 0.`,
        },
        {
          kind: "check",
          prompt: md`Find the value of $\sin\left(\frac{9\pi}{2}\right)$.`,
          answer: "1",
          explain: md`$\frac{9\pi}{2} = \frac{\pi}{2} + 4\pi$, two full turns past $\frac{\pi}{2}$. So $\sin\frac{9\pi}{2} = \sin\frac{\pi}{2} = 1$.`,
        },
      ],
      practice: [solveByGraph, evaluateFar, whichBasic],
    },
    {
      id: slug("Amplitude, period and phase"),
      title: "Amplitude, period and phase",
      summary: "How A, B, C and D reshape the basic wave, and why each one does what it does.",
      blocks: [
        {
          kind: "text",
          body: md`Every sine-shaped graph in the world, from a sound wave to a tide table, is the basic $y = \sin x$ stretched and slid. The general form is

$$y = A\sin(Bx - C) + D \qquad\text{or}\qquad y = A\cos(Bx - C) + D,$$

with $B > 0$. Each constant does one job, and every job is a transformation you already know from Algebra 2, Unit 1. Play with the sliders first, then read why.`,
        },
        {
          kind: "plot",
          x: [-7, 7],
          y: [-6, 6],
          curves: [
            { expr: "sin(x)", label: "y = \\sin x", color: 3, dashed: true },
            { expr: "A sin(B x - C) + D", label: "y = A\\sin(Bx - C) + D" },
          ],
          hlines: [{ y: "D" }],
          points: [
            { x: "C/B", y: "D", label: "\\text{cycle starts: } ({=C/B}, {D})", color: 2 },
            { x: "C/B + pi/(2B)", y: "D + A", label: "\\text{quarter period on: } ({=C/B + pi/(2B)}, {=D + A})", color: 4 },
          ],
          params: [
            { name: "A", tex: "A", min: -4, max: 4, step: 0.5, value: 2 },
            { name: "B", tex: "B", min: 0.5, max: 4, step: 0.5, value: 1 },
            { name: "C", tex: "C", min: -3, max: 3, step: 0.25, value: 0 },
            { name: "D", tex: "D", min: -3, max: 3, step: 0.5, value: 0 },
          ],
          caption: md`$A$ changes the height of the wave (and flips it when negative). $B$ squeezes it sideways. $C$ slides it sideways, by $C/B$, not by $C$. $D$ lifts the midline (the dashed horizontal line). The orange point is where a cycle starts; the red one is a quarter period later, at a peak.`,
        },
        {
          kind: "key",
          title: "Amplitude",
          body: md`The **amplitude** of $y = A\sin(Bx - C) + D$ is $|A|$: how far the graph rises above and falls below its midline. The maximum is $D + |A|$ and the minimum is $D - |A|$, so

$$\text{amplitude} = \frac{\max - \min}{2}.$$`,
        },
        {
          kind: "why",
          title: "Why A stretches the wave",
          body: md`Multiplying a function's output by $A$ multiplies every height by $A$: a vertical stretch (Algebra 2). The sine's heights run from $-1$ to $1$, so $A\sin(\ldots)$ runs from $-|A|$ to $|A|$. The zero crossings stay put because $A \cdot 0 = 0$.

If $A < 0$, every height also changes sign, which reflects the wave across its midline: the peaks become troughs. The graph still swings $|A|$ either way, which is why the amplitude is $|A|$ and never negative.`,
        },
        {
          kind: "key",
          title: "Period",
          body: md`The **period** of $y = A\sin(Bx - C) + D$ is $\dfrac{2\pi}{B}$. The graph completes $B$ cycles in the space where $\sin x$ completes one.`,
        },
        {
          kind: "proof",
          title: "The period of sin(Bx) is 2π/B",
          given: md`$B > 0$ and $f(x) = \sin(Bx)$.`,
          prove: md`The smallest positive $p$ with $f(x + p) = f(x)$ for every $x$ is $p = \frac{2\pi}{B}$.`,
          steps: [
            { statement: md`$f\left(x + \frac{2\pi}{B}\right) = \sin\left(Bx + 2\pi\right)$`, reason: md`Distribute: $B \cdot \frac{2\pi}{B} = 2\pi$` },
            { statement: md`$= \sin(Bx) = f(x)$`, reason: md`Sine has period $2\pi$ (Lesson 1). So $\frac{2\pi}{B}$ is a period.` },
            { statement: md`Suppose $p > 0$ is any period. Then $f\left(\frac{\pi}{2B} + p\right) = f\left(\frac{\pi}{2B}\right) = \sin\frac{\pi}{2} = 1$`, reason: md`A period must hold at every $x$, including $x = \frac{\pi}{2B}$` },
            { statement: md`$\sin\left(\frac{\pi}{2} + Bp\right) = 1$, so $\frac{\pi}{2} + Bp = \frac{\pi}{2} + 2\pi k$ for some whole number $k \ge 1$`, reason: md`Sine equals $1$ only at the top of the circle, $\frac{\pi}{2}$ plus whole turns` },
            { statement: md`$p = \frac{2\pi k}{B}$, and the smallest positive choice is $k = 1$: $p = \frac{2\pi}{B}$`, reason: "Solve for p" },
          ],
        },
        {
          kind: "plot",
          x: [-1, 13],
          y: [-1.5, 1.5],
          curves: [{ expr: "sin(B x)", label: "y = \\sin(Bx)" }],
          vlines: [{ x: "pi/B" }, { x: "2pi/B" }],
          points: [
            { x: "pi/(2B)", y: 1, label: "\\text{peak at } x = \\tfrac{\\pi}{2B} = {=pi/(2B)}", color: 2 },
            { x: "2pi/B", y: 0, label: "\\text{period } \\tfrac{2\\pi}{B} = {=2pi/B}", color: 4 },
          ],
          params: [{ name: "B", tex: "B", min: 0.5, max: 4, step: 0.25, value: 1 }],
          caption: md`Replacing $x$ by $Bx$ is a horizontal squeeze by a factor of $B$ (Algebra 2). The input reaches $2\pi$ when $x = 2\pi / B$, so one full wave fits in that distance. Slide $B$ above 1 to pack waves in; below 1 to stretch them out.`,
        },
        {
          kind: "key",
          title: "Phase shift and vertical shift",
          body: md`$$A\sin(Bx - C) + D = A\sin\!\Big(B\Big(x - \frac{C}{B}\Big)\Big) + D$$

- The **phase shift** is $\dfrac{C}{B}$: the graph of $A\sin(Bx)$ slid right by $C/B$ (left if $C/B$ is negative). A cycle starts where the argument $Bx - C$ equals $0$.
- The **vertical shift** is $D$: the midline moves to $y = D$.
- The five key points of one cycle are at $x = \frac{C}{B} + k \cdot \frac{\text{period}}{4}$ for $k = 0, 1, 2, 3, 4$.`,
        },
        {
          kind: "why",
          title: "Why the shift is C/B and not C",
          body: md`Replacing $x$ by $x - h$ slides a graph $h$ to the right (Algebra 2). To see the slide in $\sin(Bx - C)$ you must first factor out $B$: $Bx - C = B\left(x - \frac{C}{B}\right)$. The thing subtracted from $x$ is $\frac{C}{B}$, so that is the shift.

Another way to say it: the basic sine cycle starts where its input is $0$. Here the input is $Bx - C$, which is $0$ when $x = C/B$. Reading the shift as $C$ is the most common mistake with these graphs; the sliders above show it directly, since $C = 2$ with $B = 2$ moves the wave only 1 unit.

$D$ is added last, after the sine has done its work, so it lifts every point by $D$: a vertical slide.`,
        },
        {
          kind: "example",
          title: "Graphing from the equation",
          problem: md`Describe and graph $y = 3\sin\left(2x - \frac{\pi}{3}\right) + 1$.`,
          steps: [
            { math: md`\text{amplitude } 3, \qquad \text{midline } y = 1, \qquad \max 4, \; \min -2`, note: md`$|A| = 3$ and $D = 1$.` },
            { math: md`\text{period} = \frac{2\pi}{2} = \pi`, note: md`$B = 2$.` },
            { math: md`2x - \frac{\pi}{3} = 0 \;\Rightarrow\; x = \frac{\pi}{6}`, note: md`The cycle starts at the phase shift $\frac{C}{B} = \frac{\pi}{6}$. Not $\frac{\pi}{3}$.` },
            { math: md`x = \frac{\pi}{6},\; \frac{5\pi}{12},\; \frac{2\pi}{3},\; \frac{11\pi}{12},\; \frac{7\pi}{6}`, note: md`Key points every quarter period, $\frac{\pi}{4}$ apart, starting at $\frac{\pi}{6}$.` },
            { math: md`(\tfrac{\pi}{6}, 1),\; (\tfrac{5\pi}{12}, 4),\; (\tfrac{2\pi}{3}, 1),\; (\tfrac{11\pi}{12}, -2),\; (\tfrac{7\pi}{6}, 1)`, note: "Midline, peak, midline, trough, midline: the sine pattern, with the new heights." },
          ],
        },
        {
          kind: "plot",
          x: [-1, 5],
          y: [-3, 5],
          curves: [{ expr: "3sin(2x - pi/3) + 1", label: "y = 3\\sin\\left(2x - \\tfrac{\\pi}{3}\\right) + 1" }],
          hlines: [{ y: 1 }],
          vlines: [{ x: Math.PI / 6 }, { x: (7 * Math.PI) / 6 }],
          points: [
            { x: Math.PI / 6, y: 1, label: "\\left(\\tfrac{\\pi}{6}, 1\\right)", color: 2 },
            { x: (5 * Math.PI) / 12, y: 4, label: "\\left(\\tfrac{5\\pi}{12}, 4\\right)", color: 2 },
            { x: (2 * Math.PI) / 3, y: 1, label: "\\left(\\tfrac{2\\pi}{3}, 1\\right)", color: 2 },
            { x: (11 * Math.PI) / 12, y: -2, label: "\\left(\\tfrac{11\\pi}{12}, -2\\right)", color: 2 },
            { x: (7 * Math.PI) / 6, y: 1, label: "\\left(\\tfrac{7\\pi}{6}, 1\\right)", color: 2 },
          ],
          caption: md`One cycle of the example runs between the dashed lines, from $x = \frac{\pi}{6}$ to $x = \frac{7\pi}{6}$. The dashed horizontal line is the midline $y = 1$.`,
        },
        {
          kind: "example",
          title: "A reflected cosine",
          problem: md`Find the amplitude, period, phase shift and midline of $y = -2\cos\left(\frac{x}{2} + \frac{\pi}{4}\right) - 1$.`,
          steps: [
            { math: md`\text{amplitude} = |-2| = 2`, note: "The negative sign reflects the graph: it starts at a trough instead of a peak." },
            { math: md`\text{period} = \frac{2\pi}{1/2} = 4\pi`, note: md`$B = \frac{1}{2}$, so the wave is stretched to twice its usual length.` },
            { math: md`\frac{x}{2} + \frac{\pi}{4} = 0 \;\Rightarrow\; x = -\frac{\pi}{2}`, note: md`Phase shift $-\frac{\pi}{2}$: half a unit of $\pi$ to the left. Written in the standard form, $C = -\frac{\pi}{4}$ and $\frac{C}{B} = -\frac{\pi}{4} \div \frac{1}{2} = -\frac{\pi}{2}$.` },
            { math: md`\text{midline } y = -1, \qquad \min -3 \text{ at } x = -\tfrac{\pi}{2}`, note: md`$D = -1$. Because $A < 0$, the cycle starts at the minimum $D - |A| = -3$.` },
          ],
        },
        {
          kind: "example",
          title: "From the graph to the equation",
          problem: md`A wave has a maximum of $5$ at $x = \frac{\pi}{4}$ and its next minimum is $-1$ at $x = \frac{3\pi}{4}$. Write an equation for it.`,
          steps: [
            { math: md`|A| = \frac{5 - (-1)}{2} = 3, \qquad D = \frac{5 + (-1)}{2} = 2`, note: "Half the swing is the amplitude; the average of max and min is the midline." },
            { math: md`\tfrac{1}{2}\,\text{period} = \frac{3\pi}{4} - \frac{\pi}{4} = \frac{\pi}{2} \;\Rightarrow\; \text{period} = \pi, \; B = \frac{2\pi}{\pi} = 2`, note: "Peak to the next trough is half a cycle." },
            { math: md`y = 3\cos\left(2\left(x - \frac{\pi}{4}\right)\right) + 2 = 3\cos\left(2x - \frac{\pi}{2}\right) + 2`, note: md`A cosine starts at its peak, so use cosine with phase shift $\frac{\pi}{4}$, where the peak is.` },
            { math: md`y = 3\sin(2x) + 2`, note: md`The same graph, written as a sine: $\cos\left(t - \frac{\pi}{2}\right) = \sin t$ by Lesson 1. Either form is correct, and the checker accepts both because they agree at every $x$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the period of $y = 4\cos(3x - \pi)$. Type it exactly, like 2pi/3.`,
          answer: "2pi/3",
          explain: md`$B = 3$, so the period is $\frac{2\pi}{3}$. The $4$ and the $\pi$ change the height and the position, not the repeat length.`,
        },
        {
          kind: "check",
          prompt: md`Find the phase shift of $y = \sin\left(2x + \frac{\pi}{2}\right)$. A shift to the left is negative; type it like -pi/4.`,
          answer: "-pi/4",
          explain: md`Set the argument to $0$: $2x + \frac{\pi}{2} = 0$ gives $x = -\frac{\pi}{4}$. The cycle starts a quarter of $\pi$ to the left of the origin, not $\frac{\pi}{2}$.`,
        },
      ],
      practice: [readParameter, equationFromGraph, firstMaximum],
    },
    {
      id: slug("Graphs of tangent and the others"),
      title: "Graphs of tangent and the others",
      summary: "Why tangent has asymptotes and period π, and how the secant, cosecant and cotangent graphs follow from sine and cosine.",
      blocks: [
        {
          kind: "text",
          body: md`Tangent was defined in Unit 3 as a ratio: $\tan x = \dfrac{\sin x}{\cos x}$. On the unit circle that ratio is the **slope** of the radius to the point at angle $x$, rise over run. That one picture explains the whole graph: the slope of a line through the origin can be any real number, it is $0$ when the radius is flat, and it has no value at all when the radius is vertical.`,
        },
        {
          kind: "why",
          title: "Why tangent has vertical asymptotes",
          body: md`As $x$ approaches $\frac{\pi}{2}$ from the left, the point climbs toward the top of the circle: $\sin x \to 1$ while $\cos x \to 0$ through positive values. A number near $1$ divided by a tiny positive number is huge, so $\tan x \to +\infty$. Just past $\frac{\pi}{2}$, $\cos x$ is a tiny *negative* number and $\tan x \to -\infty$. At $x = \frac{\pi}{2}$ itself the denominator is $0$ and tangent is undefined.

The same happens wherever $\cos x = 0$: at $x = \frac{\pi}{2} + k\pi$. Each of these is a **vertical asymptote**. Between two neighbouring asymptotes the graph sweeps once from $-\infty$ up to $+\infty$.`,
        },
        {
          kind: "proof",
          title: "The period of tangent is π",
          given: md`$x$ is an angle with $\cos x \ne 0$.`,
          prove: md`$\tan(x + \pi) = \tan x$, and no positive number smaller than $\pi$ is a period.`,
          steps: [
            { statement: md`The point at angle $x + \pi$ is the point at angle $x$ turned a half turn about $O$`, reason: md`$\pi$ radians is a half turn (Unit 1)` },
            { statement: md`A half turn sends $(a, b)$ to $(-a, -b)$`, reason: "It sends each point to the opposite end of its diameter" },
            { statement: md`$\sin(x + \pi) = -\sin x$ and $\cos(x + \pi) = -\cos x$`, reason: md`Coordinates of the turned point $(-\cos x, -\sin x)$` },
            { statement: md`$\tan(x + \pi) = \dfrac{-\sin x}{-\cos x} = \dfrac{\sin x}{\cos x} = \tan x$`, reason: "Definition of tangent; the two minus signs cancel" },
            { statement: md`$\tan x = 0$ exactly when $x = k\pi$`, reason: md`A fraction is $0$ only when its numerator is: $\sin x = 0$ at multiples of $\pi$` },
            { statement: md`If $p > 0$ is a period then $\tan p = \tan 0 = 0$, so $p = k\pi$ with $k \ge 1$; the smallest is $\pi$`, reason: "A period carries the zero at 0 onto another zero" },
          ],
        },
        {
          kind: "plot",
          x: [-6.6, 6.6],
          y: [-5, 5],
          curves: [{ expr: "tan(x)", label: "y = \\tan x" }],
          vlines: [-3, -1, 1, 3].map((m) => ({ x: (m * Math.PI) / 2 })),
          points: [
            { x: Math.PI / 4, y: 1, label: "\\left(\\tfrac{\\pi}{4}, 1\\right)", color: 2 },
            { x: -Math.PI / 4, y: -1, label: "\\left(-\\tfrac{\\pi}{4}, -1\\right)", color: 2 },
            { x: 0, y: 0, label: "(0, 0)", color: 3 },
          ],
          caption: md`$y = \tan x$ with asymptotes (dashed) at $x = \pm\frac{\pi}{2}, \pm\frac{3\pi}{2}$. Each branch is a copy of the one before, $\pi$ further along. The graph is odd, like sine, and always increasing within a branch.`,
        },
        {
          kind: "key",
          title: "The tangent graph",
          body: md`- Domain: all $x$ except $\frac{\pi}{2} + k\pi$; range: all real numbers.
- Period $\pi$; zeros at $x = k\pi$; passes through $\left(\frac{\pi}{4}, 1\right)$ because $\tan\frac{\pi}{4} = \frac{\sin \pi/4}{\cos \pi/4} = 1$.
- For $y = A\tan(Bx - C) + D$: period $\dfrac{\pi}{B}$, asymptotes where $Bx - C = \frac{\pi}{2} + k\pi$, midline $y = D$. $A$ is **not** an amplitude (there is no maximum); it is a steepness factor, and a negative $A$ makes the branches fall instead of rise.`,
        },
        {
          kind: "example",
          title: "Graphing a stretched tangent",
          problem: md`Find the period and the asymptotes of $y = 2\tan\left(\frac{x}{2}\right)$, and one point on each side of the origin.`,
          steps: [
            { math: md`\text{period} = \frac{\pi}{1/2} = 2\pi`, note: md`$B = \frac{1}{2}$: the input $\frac{x}{2}$ reaches $\pi$ when $x$ reaches $2\pi$.` },
            { math: md`\frac{x}{2} = \frac{\pi}{2} + k\pi \;\Rightarrow\; x = \pi + 2\pi k`, note: md`Asymptotes where the input is an odd multiple of $\frac{\pi}{2}$: at $x = \pm\pi, \pm 3\pi, \ldots$` },
            { math: md`x = \frac{\pi}{2}: \; y = 2\tan\frac{\pi}{4} = 2, \qquad x = -\frac{\pi}{2}: \; y = -2`, note: md`Halfway from the zero at $0$ to each asymptote the tangent part is $\pm 1$, so the height is $\pm A$.` },
          ],
        },
        {
          kind: "plot",
          x: [-6.6, 6.6],
          y: [-6, 6],
          curves: [{ expr: "A tan(B x)", label: "y = A\\tan(Bx)" }],
          vlines: [{ x: "pi/(2B)" }, { x: "-pi/(2B)" }, { x: "3pi/(2B)" }, { x: "-3pi/(2B)" }],
          points: [{ x: "pi/(4B)", y: "A", label: "\\left(\\tfrac{\\pi}{4B}, A\\right) = ({=pi/(4B)}, {A})", color: 2 }],
          params: [
            { name: "A", tex: "A", min: -3, max: 3, step: 0.5, value: 1 },
            { name: "B", tex: "B", min: 0.5, max: 3, step: 0.25, value: 1 },
          ],
          caption: md`Slide $B$: the asymptotes at $x = \pm\frac{\pi}{2B}$ move in and the period $\frac{\pi}{B}$ shrinks. Slide $A$: the branches get steeper, and a negative $A$ turns them upside down. The marked point is a quarter period past the zero, where the tangent part is $1$.`,
        },
        {
          kind: "text",
          body: md`**Cotangent** is the reciprocal ratio, $\cot x = \dfrac{\cos x}{\sin x}$: run over rise. Everything swaps roles. Its asymptotes are where $\sin x = 0$, at $x = k\pi$; its zeros are where $\cos x = 0$, at $x = \frac{\pi}{2} + k\pi$; and because a half turn flips both coordinates it also has period $\pi$. Within each branch it *decreases*: as the radius turns counterclockwise from flat to vertical its slope rises from $0$ to $+\infty$, so the reciprocal falls from $+\infty$ to $0$.`,
        },
        {
          kind: "key",
          title: "Secant and cosecant",
          body: md`$$\sec x = \frac{1}{\cos x}, \qquad \csc x = \frac{1}{\sin x}.$$

- Asymptotes where the denominator is $0$: $\sec x$ at $x = \frac{\pi}{2} + k\pi$, $\csc x$ at $x = k\pi$.
- Period $2\pi$, the same as cosine and sine.
- Range $(-\infty, -1] \cup [1, \infty)$: the graphs never enter the band between $-1$ and $1$.
- Each graph touches its parent wave at the peaks and troughs, where $\cos x$ or $\sin x$ is $\pm 1$.`,
        },
        {
          kind: "why",
          title: "Why secant never enters the band between -1 and 1",
          body: md`$|\cos x| \le 1$ always, and the reciprocal of a number of size at most $1$ has size at least $1$: if $0 < |c| \le 1$ then $\left|\frac{1}{c}\right| = \frac{1}{|c|} \ge 1$. So $|\sec x| \ge 1$ wherever secant is defined.

Equality happens only when $|\cos x| = 1$, at the peaks and troughs of cosine. There $\sec x = \cos x = \pm 1$, so the two graphs touch. Between those points $|\cos x| < 1$ and $|\sec x| > 1$: as cosine heads down to $0$, secant shoots off to infinity. The U-shaped pieces of secant sit on the humps of cosine, opening away from the axis.`,
        },
        {
          kind: "plot",
          x: [-6.6, 6.6],
          y: [-4, 4],
          curves: [
            { expr: "cos(x)", label: "y = \\cos x", color: 3, dashed: true },
            { expr: "sec(x)", label: "y = \\sec x" },
          ],
          vlines: [-3, -1, 1, 3].map((m) => ({ x: (m * Math.PI) / 2 })),
          hlines: [{ y: 1 }, { y: -1 }],
          caption: md`Secant (solid) with cosine (dashed). Secant's asymptotes are at cosine's zeros, and the two curves touch where $\cos x = \pm 1$. The dashed horizontal lines are $y = \pm 1$; the band between them is empty.`,
        },
        {
          kind: "plot",
          x: [-6.6, 6.6],
          y: [-4, 4],
          curves: [
            { expr: "sin(x)", label: "y = \\sin x", color: 3, dashed: true },
            { expr: "csc(x)", label: "y = \\csc x", color: 2 },
          ],
          vlines: [-2, -1, 0, 1, 2].map((m) => ({ x: m * Math.PI })),
          hlines: [{ y: 1 }, { y: -1 }],
          caption: md`Cosecant with sine. The same picture shifted a quarter period: asymptotes at $x = k\pi$, where sine is $0$, and the curves touch at sine's peaks and troughs.`,
        },
        {
          kind: "example",
          title: "Asymptotes of a transformed cosecant",
          problem: md`Find the vertical asymptotes of $y = \csc\left(2x - \frac{\pi}{2}\right)$ on $[0, 2\pi)$.`,
          steps: [
            { math: md`\sin\left(2x - \frac{\pi}{2}\right) = 0`, note: "Cosecant is 1 over sine, so it is undefined wherever the sine of its argument is 0." },
            { math: md`2x - \frac{\pi}{2} = k\pi`, note: md`$\sin t = 0$ exactly at multiples of $\pi$.` },
            { math: md`x = \frac{\pi}{4} + \frac{k\pi}{2}`, note: md`Add $\frac{\pi}{2}$, divide by $2$. Neighbouring asymptotes are $\frac{\pi}{2}$ apart.` },
            { math: md`x = \frac{\pi}{4}, \; \frac{3\pi}{4}, \; \frac{5\pi}{4}, \; \frac{7\pi}{4}`, note: md`$k = 0, 1, 2, 3$ land in $[0, 2\pi)$; $k = 4$ gives $\frac{9\pi}{4}$, which is past the end.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the period of $y = 3\tan(4x)$. Type it exactly, like pi/4.`,
          answer: "pi/4",
          explain: md`Tangent's basic period is $\pi$, and $B = 4$ squeezes it to $\frac{\pi}{4}$. The $3$ only changes the steepness.`,
        },
        {
          kind: "check",
          prompt: md`List the vertical asymptotes of $y = \sec x$ on $[0, 2\pi)$, like pi/2, 3pi/2.`,
          answer: "pi/2, 3pi/2",
          form: "set",
          explain: md`$\sec x = \frac{1}{\cos x}$ is undefined where $\cos x = 0$: at $\frac{\pi}{2}$ and $\frac{3\pi}{2}$.`,
        },
      ],
      practice: [asymptotes, periodOfOthers, tangentFromGraph],
    },
  ],
};
