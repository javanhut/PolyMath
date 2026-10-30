import { frac, fracTex, gcd, paren, type Rng } from "../../math/random";
import { md, slug, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Exact values ────────────────────────────────────────────────────────────
// Nice angles (multiples of pi/6 and pi/4) give coordinates of the form (n/d)·sqrt(s).

interface Ex {
  n: number;
  d: number;
  s: number;
}

/** (n/d)·√s in lowest terms, with square factors pulled out of the radicand. */
function ex(n: number, d = 1, s = 1): Ex {
  if (n === 0) return { n: 0, d: 1, s: 1 };
  for (let k = 2; k * k <= s; k++) {
    while (s % (k * k) === 0) {
      s /= k * k;
      n *= k;
    }
  }
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g, s };
}
const exMul = (a: Ex, b: Ex): Ex => ex(a.n * b.n, a.d * b.d, a.s * b.s);
/** 1 / ((n/d)√s) = d√s / (n s). */
const exInv = (a: Ex): Ex => ex(a.d, a.n * a.s, a.s);
const exVal = (a: Ex): number => (a.n / a.d) * Math.sqrt(a.s);
function exPow(a: Ex, n: number): Ex {
  let out = ex(1);
  for (let i = 0; i < n; i++) out = exMul(out, a);
  return out;
}

/** Typed-answer syntax: "3sqrt(2)/2", "-2", "sqrt(3)". */
function exText(e: Ex): string {
  if (e.n === 0) return "0";
  if (e.s === 1) return frac(e.n, e.d);
  const coef = Math.abs(e.n) === 1 ? "" : String(Math.abs(e.n));
  const body = e.d === 1 ? `${coef}sqrt(${e.s})` : `${coef}sqrt(${e.s})/${e.d}`;
  return e.n < 0 ? `-${body}` : body;
}

function exTex(e: Ex): string {
  if (e.n === 0) return "0";
  if (e.s === 1) return fracTex(e.n, e.d);
  const coef = Math.abs(e.n) === 1 ? "" : String(Math.abs(e.n));
  const body = e.d === 1 ? `${coef}\\sqrt{${e.s}}` : `\\frac{${coef}\\sqrt{${e.s}}}{${e.d}}`;
  return e.n < 0 ? `-${body}` : body;
}

/** LaTeX with a negative value in parentheses, for products. */
const exTexP = (e: Ex): string => (e.n < 0 ? `\\left(${exTex(e)}\\right)` : exTex(e));

/** a + bi in typed syntax: "3sqrt(3)/2 + 3/2 i", "-2i", "4". */
function cxText(re: Ex, im: Ex): string {
  const reT = exText(re);
  if (im.n === 0) return reT;
  const mag = exText({ ...im, n: Math.abs(im.n) });
  const imMag = mag === "1" ? "i" : `${mag} i`;
  if (re.n === 0) return im.n < 0 ? `-${imMag}` : imMag;
  return im.n < 0 ? `${reT} - ${imMag}` : `${reT} + ${imMag}`;
}

function cxTex(re: Ex, im: Ex): string {
  const reT = exTex(re);
  if (im.n === 0) return reT;
  const mag = exTex({ ...im, n: Math.abs(im.n) });
  const imMag = mag === "1" ? "i" : `${mag}i`;
  if (re.n === 0) return im.n < 0 ? `-${imMag}` : imMag;
  return im.n < 0 ? `${reT} - ${imMag}` : `${reT} + ${imMag}`;
}

// Angles are counted in twelfths of pi. Multiples of pi/6 and pi/4 have exact cosines and sines.
const NICE = [0, 2, 3, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22];
const NICE_OFF_AXIS = NICE.filter((k) => k % 6 !== 0);
/** A nice angle, off the axes three times out of four. */
const niceAngle = (r: Rng): number => (r.next() < 0.75 ? r.pick(NICE_OFF_AXIS) : r.pick(NICE));
const norm24 = (k: number): number => ((k % 24) + 24) % 24;

const COS12: Record<number, Ex> = {
  0: ex(1),
  2: ex(1, 2, 3),
  3: ex(1, 2, 2),
  4: ex(1, 2),
  6: ex(0),
  8: ex(-1, 2),
  9: ex(-1, 2, 2),
  10: ex(-1, 2, 3),
  12: ex(-1),
};

function exCos(k: number): Ex {
  let c = norm24(k);
  if (c > 12) c = 24 - c;
  const v = COS12[c];
  if (!v) throw new Error(`no exact cosine for ${k}pi/12`);
  return v;
}
const exSin = (k: number): Ex => exCos(k - 6);

/** A fraction of pi in typed syntax: "5pi/6", "pi", "0", "-pi/4". */
function piText(num: number, den: number): string {
  if (num === 0) return "0";
  if (den < 0) [num, den] = [-num, -den];
  const g = gcd(num, den) || 1;
  [num, den] = [num / g, den / g];
  const m = Math.abs(num);
  const top = m === 1 ? "pi" : `${m}pi`;
  return `${num < 0 ? "-" : ""}${den === 1 ? top : `${top}/${den}`}`;
}

function piTex(num: number, den: number): string {
  if (num === 0) return "0";
  if (den < 0) [num, den] = [-num, -den];
  const g = gcd(num, den) || 1;
  [num, den] = [num / g, den / g];
  const m = Math.abs(num);
  const top = m === 1 ? "\\pi" : `${m}\\pi`;
  return `${num < 0 ? "-" : ""}${den === 1 ? top : `\\frac{${top}}{${den}}`}`;
}

const quadName = (k: number): string => {
  const c = norm24(k);
  return c < 6 ? "I" : c < 12 ? "II" : c < 18 ? "III" : "IV";
};
const refTwelfths = (k: number): number => {
  const c = norm24(k);
  return c <= 6 ? c : c <= 12 ? 12 - c : c <= 18 ? c - 12 : 24 - c;
};
/** "\pi - \frac{\pi}{6}" style: how the angle is built from its reference angle. */
function quadFormula(k: number): string {
  const c = norm24(k);
  const ref = piTex(refTwelfths(k), 12);
  return c < 6 ? ref : c < 12 ? `\\pi - ${ref}` : c < 18 ? `\\pi + ${ref}` : `2\\pi - ${ref}`;
}
function axisName(k: number): string {
  const c = norm24(k);
  return c === 0 ? "positive $x$-axis" : c === 6 ? "positive $y$-axis" : c === 12 ? "negative $x$-axis" : "negative $y$-axis";
}
function refNote(k: number): string {
  if (k % 6 === 0) return md`the angle is on the ${axisName(k)}`;
  return md`reference angle $${piTex(refTwelfths(k), 12)}$, quadrant ${quadName(k)}`;
}

const ORDINAL: Record<number, string> = { 2: "square", 3: "cube", 4: "fourth", 5: "fifth", 6: "sixth" };

/** A complex number drawn as an arrow from 0 in the complex plane. */
function complexArrow(x: number, y: number, label = "z"): Figure {
  const pad = 1.5;
  return {
    kind: "diagram",
    grid: true,
    view: [Math.min(0, x) - pad, Math.max(0, x) + pad, Math.min(0, y) - pad, Math.max(0, y) + pad],
    points: [
      { name: "O", x: 0, y: 0, label: "0", dir: x >= 0 ? "sw" : "se" },
      { name: "Z", x, y, label, dir: y >= 0 ? "n" : "s" },
    ],
    segments: [{ from: "O", to: "Z", arrow: true, color: 1 }],
  };
}

// ── Lesson 1 generators: polar coordinates ──────────────────────────────────

const polarToRect: Generator = (r) => {
  const R = r.int(1, 6);
  const k = niceAngle(r);
  const neg = r.next() < 0.25;
  const rr = neg ? -R : R;
  const c = exCos(k);
  const s = exSin(k);
  const x = exMul(ex(rr), c);
  const y = exMul(ex(rr), s);
  const T = piText(k, 12);
  const Ttex = piTex(k, 12);
  return {
    prompt: md`Convert the polar point $\left(${rr}, ${Ttex}\right)$ to rectangular coordinates $(x, y)$. Give exact values, like (2sqrt(3), -2).`,
    answer: `(${exText(x)}, ${exText(y)})`,
    form: "tuple",
    simplified: true,
    // The tip's projection on the direction theta is r, and across it is 0.
    verify: [`x cos(${T}) + y sin(${T}) = ${rr}`, `x sin(${T}) - y cos(${T}) = 0`],
    hint: neg
      ? md`$x = r\cos\theta$ and $y = r\sin\theta$ work for a negative $r$ too: both coordinates just get multiplied by $-1$, which puts the point behind the pole.`
      : md`$x = r\cos\theta$ and $y = r\sin\theta$. Use the reference angle to get exact values of $\cos\theta$ and $\sin\theta$.`,
    solution: [
      { math: md`x = r\cos\theta = ${paren(rr)} \cdot ${exTexP(c)} = ${exTex(x)}`, note: md`$\cos ${Ttex} = ${exTex(c)}$ (${refNote(k)}).` },
      { math: md`y = r\sin\theta = ${paren(rr)} \cdot ${exTexP(s)} = ${exTex(y)}`, note: md`$\sin ${Ttex} = ${exTex(s)}$.` },
      { math: md`(x, y) = \left(${exTex(x)}, ${exTex(y)}\right)`, note: neg ? md`With $r = ${rr}$ the point is $${R}$ units from the pole on the ray opposite $\theta = ${Ttex}$.` : "" },
    ],
  };
};

const rectToPolar: Generator = (r) => {
  const R = r.int(1, 6);
  const k = niceAngle(r);
  const x = exMul(ex(R), exCos(k));
  const y = exMul(ex(R), exSin(k));
  const T = piText(k, 12);
  const Ttex = piTex(k, 12);
  const steps: Step[] = [
    {
      math: md`r = \sqrt{x^2 + y^2} = \sqrt{${exTex(exMul(x, x))} + ${exTex(exMul(y, y))}} = \sqrt{${R * R}} = ${R}`,
      note: "The distance from the origin, by the Pythagorean theorem.",
    },
  ];
  if (k % 6 === 0) {
    steps.push({ math: md`\theta = ${Ttex}`, note: md`The point is on the ${axisName(k)}, so the angle can be read straight off.` });
  } else {
    const ref = refTwelfths(k);
    const tanRef = exMul(exSin(ref), exInv(exCos(ref)));
    steps.push({
      math: md`\tan\theta = \frac{y}{x} = \frac{${exTex(y)}}{${exTex(x)}} = ${exTex(exMul(y, exInv(x)))}`,
      note: md`The reference angle is $${piTex(ref, 12)}$, since $\tan ${piTex(ref, 12)} = ${exTex(tanRef)}$.`,
    });
    steps.push({
      math: md`\theta = ${quadFormula(k)} = ${Ttex}`,
      note: md`$\left(${exTex(x)}, ${exTex(y)}\right)$ is in quadrant ${quadName(k)}: ${x.n < 0 ? "$x < 0$" : "$x > 0$"} and ${y.n < 0 ? "$y < 0$" : "$y > 0$"}.`,
    });
  }
  steps.push({ math: md`(r, \theta) = \left(${R}, ${Ttex}\right)`, note: "" });
  return {
    prompt: md`Convert the point $\left(${exTex(x)}, ${exTex(y)}\right)$ to polar coordinates $(r, \theta)$ with $r > 0$ and $0 \le \theta < 2\pi$. Write $\theta$ as a multiple of pi, like (4, 5pi/6).`,
    answer: `(${R}, ${T})`,
    form: "tuple",
    simplified: true,
    verify: [`r cos(t) = ${exText(x)}`, `r sin(t) = ${exText(y)}`],
    hint: md`$r = \sqrt{x^2 + y^2}$. Then $\tan\theta = \frac{y}{x}$ gives the reference angle; the signs of $x$ and $y$ give the quadrant.`,
    solution: steps,
  };
};

const polarEquations: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    // A line in polar form, back to rectangular.
    const a = r.nonzero(-6, 6);
    const vertical = r.next() < 0.5;
    const secForm = r.next() < 0.5;
    const TRIG = vertical ? "\\cos" : "\\sin";
    const RECIP = vertical ? "\\sec" : "\\csc";
    const eq = secForm ? md`r = ${a}${RECIP}\theta` : md`r${TRIG}\theta = ${a}`;
    const axis = vertical ? "x" : "y";
    return {
      prompt: md`Convert the polar equation $${eq}$ to rectangular form. The graph is a ${vertical ? "vertical" : "horizontal"} line $${axis} = c$. Find $c$.`,
      answer: String(a),
      // The curve's point at theta = pi/3 has that coordinate.
      verify: vertical ? [`c = ${a} sec(pi/3) cos(pi/3)`] : [`c = ${a} csc(pi/3) sin(pi/3)`],
      hint: secForm
        ? md`$${RECIP}\theta = \frac{1}{${TRIG}\theta}$. Multiply both sides by $${TRIG}\theta$, then remember what $r${TRIG}\theta$ is.`
        : md`$r${TRIG}\theta$ is one of the rectangular coordinates.`,
      solution: [
        ...(secForm ? [{ math: md`r${TRIG}\theta = ${a}`, note: md`Multiply both sides by $${TRIG}\theta$, since $${RECIP}\theta \cdot ${TRIG}\theta = 1$.` }] : []),
        { math: md`${axis} = ${a}`, note: vertical ? md`$x = r\cos\theta$.` : md`$y = r\sin\theta$.` },
        { math: md`c = ${a}`, note: md`Every point of the graph has $${axis} = ${a}$: a ${vertical ? "vertical" : "horizontal"} line.` },
      ],
    };
  }
  if (kind === 1) {
    // A circle through the pole.
    const A = r.nonzero(-4, 4);
    const cos = r.next() < 0.5;
    const FN = cos ? "\\cos" : "\\sin";
    const eq = md`r = ${2 * A}${FN}\theta`;
    const center: [number, number] = cos ? [A, 0] : [0, A];
    const far: [number, number] = cos ? [2 * A, 0] : [0, 2 * A];
    const coord = cos ? "x" : "y";
    const sq = cos ? md`x^2 - ${2 * A}x + y^2 = 0` : md`x^2 + y^2 - ${2 * A}y = 0`;
    const completed = cos ? md`(x ${A < 0 ? "+" : "-"} ${Math.abs(A)})^2 + y^2 = ${A * A}` : md`x^2 + (y ${A < 0 ? "+" : "-"} ${Math.abs(A)})^2 = ${A * A}`;
    return {
      prompt: md`The graph of $${eq}$ is a circle. Convert the equation to rectangular form and give its centre and radius as (a, b, c), where the centre is $(a, b)$ and the radius is $c$.`,
      answer: `(${center[0]}, ${center[1]}, ${Math.abs(A)})`,
      form: "tuple",
      // Three points of the curve (theta = 0 or pi/2, the pole, and theta = pi/4) lie on the circle.
      verify: [
        `(${far[0]} - a)^2 + (${far[1]} - b)^2 = c^2`,
        `(0 - a)^2 + (0 - b)^2 = c^2`,
        `(${A} - a)^2 + (${A} - b)^2 = c^2`,
      ],
      hint: md`Multiply both sides by $r$. Then $r^2 = x^2 + y^2$ and $r${FN}\theta = ${coord}$. Complete the square.`,
      solution: [
        { math: md`r^2 = ${2 * A}\, r${FN}\theta`, note: md`Multiply both sides by $r$. (This adds the pole, $r = 0$, but the pole is already on the curve: $r = 0$ when $${FN}\theta = 0$.)` },
        { math: md`x^2 + y^2 = ${2 * A}${coord}`, note: md`$r^2 = x^2 + y^2$ and $r${FN}\theta = ${coord}$.` },
        { math: sq, note: md`Move the ${coord}-term over.` },
        { math: completed, note: md`Complete the square: half of $${-2 * A}$ is $${-A}$, and $(${-A})^2 = ${A * A}$ goes on both sides.` },
        { math: md`\text{centre } (${center[0]}, ${center[1]}), \quad \text{radius } ${Math.abs(A)}`, note: md`A circle of diameter $${2 * Math.abs(A)}$ through the pole, centred on the ${cos ? "$x$" : "$y$"}-axis.` },
      ],
    };
  }
  // Rectangular to polar: answer is r as an expression in theta (typed t).
  const sub = r.int(0, 2);
  if (sub === 0) {
    const a = r.nonzero(-5, 5);
    const vertical = r.next() < 0.5;
    const fn = vertical ? "sec" : "csc";
    const RECIP = `\\${fn}`;
    const TRIG = vertical ? "\\cos" : "\\sin";
    const coord = vertical ? "x" : "y";
    return {
      prompt: md`Convert the rectangular equation $${coord} = ${a}$ to a polar equation of the form $r = f(\theta)$. Type the right side only, with theta as t, like 2csc(t).`,
      answer: `${a}${fn}(t)`,
      verify: [`r ${vertical ? "cos" : "sin"}(t) = ${a}`],
      hint: md`Replace $${coord}$ by $r${TRIG}\theta$ and solve for $r$.`,
      solution: [
        { math: md`r${TRIG}\theta = ${a}`, note: md`$${coord} = r${TRIG}\theta$.` },
        { math: md`r = \frac{${a}}{${TRIG}\theta} = ${a}${RECIP}\theta`, note: md`Divide by $${TRIG}\theta$; $\frac{1}{${TRIG}\theta} = ${RECIP}\theta$.` },
      ],
    };
  }
  if (sub === 1) {
    const A = r.nonzero(-4, 4);
    const cos = r.next() < 0.5;
    const fn = cos ? "cos" : "sin";
    const FN = `\\${fn}`;
    const coord = cos ? "x" : "y";
    return {
      prompt: md`Convert the rectangular equation $x^2 + y^2 = ${2 * A}${coord}$ to a polar equation of the form $r = f(\theta)$. Type the right side only, with theta as t, like 4sin(t).`,
      answer: `${2 * A}${fn}(t)`,
      verify: [`(r cos(t))^2 + (r sin(t))^2 = ${2 * A} r ${fn}(t)`],
      hint: md`$x^2 + y^2 = r^2$ and $${coord} = r${FN}\theta$. Then divide by $r$.`,
      solution: [
        { math: md`r^2 = ${2 * A}\, r${FN}\theta`, note: md`Substitute $x^2 + y^2 = r^2$ and $${coord} = r${FN}\theta$.` },
        { math: md`r = ${2 * A}${FN}\theta`, note: md`Divide by $r$. Dividing drops only $r = 0$, and the pole is still on the new curve (at $${FN}\theta = 0$), so nothing is lost.` },
      ],
    };
  }
  const R = r.int(1, 7);
  return {
    prompt: md`Convert the rectangular equation $x^2 + y^2 = ${R * R}$ to a polar equation of the form $r = $ a constant. Type the constant.`,
    answer: String(R),
    // A point of the curve at any angle must satisfy the rectangular equation.
    verify: [`(c cos(pi/3))^2 + (c sin(pi/3))^2 = ${R * R}`],
    hint: md`$x^2 + y^2$ is $r^2$ by the Pythagorean theorem.`,
    solution: [
      { math: md`r^2 = ${R * R}`, note: md`$x^2 + y^2 = r^2$.` },
      { math: md`r = ${R}`, note: md`A circle of radius ${R} about the pole: every point is ${R} from the origin, whatever its angle.` },
    ],
  };
};

// ── Lesson 2 generators: vectors ────────────────────────────────────────────

const vecTex = (a: number | string, b: number | string): string => `\\langle ${a}, ${b} \\rangle`;

const vectorBasics: Generator = (r) => {
  let [x1, y1] = [r.int(-6, 6), r.int(-6, 6)];
  let [x2, y2] = [r.int(-6, 6), r.int(-6, 6)];
  while (x1 === x2 || y1 === y2) [x2, y2] = [r.int(-6, 6), r.int(-6, 6)];
  const a = x2 - x1;
  const b = y2 - y1;
  const N = a * a + b * b;
  const kind = r.int(0, 2);
  if (kind === 0) {
    return {
      prompt: md`Find the component form of the vector $\overrightarrow{PQ}$ from $P(${x1}, ${y1})$ to $Q(${x2}, ${y2})$. Type it as (a, b).`,
      answer: `(${a}, ${b})`,
      form: "tuple",
      // Same length as PQ and full projection onto PQ: that forces the same vector.
      verify: [`a^2 + b^2 = ${N}`, `${a} a + ${b} b = ${N}`],
      hint: "Terminal point minus initial point, coordinate by coordinate.",
      solution: [
        { math: md`\overrightarrow{PQ} = \langle ${x2} - ${paren(x1)}, ${y2} - ${paren(y1)} \rangle`, note: "The change in x and the change in y when you move from P to Q." },
        { math: vecTex(a, b), note: "" },
      ],
    };
  }
  if (kind === 1) {
    const mag = ex(1, 1, N);
    return {
      prompt: md`Find $\left|\overrightarrow{PQ}\right|$, the length of the vector from $P(${x1}, ${y1})$ to $Q(${x2}, ${y2})$. Give an exact answer with any square root simplified, like 2sqrt(5).`,
      answer: exText(mag),
      simplified: true,
      verify: [`m^2 = (${x2} - ${paren(x1)})^2 + (${y2} - ${paren(y1)})^2`],
      hint: md`First find the components, then $|\langle a, b \rangle| = \sqrt{a^2 + b^2}$.`,
      solution: [
        { math: md`\overrightarrow{PQ} = ${vecTex(a, b)}`, note: "Terminal minus initial." },
        { math: md`\left|\overrightarrow{PQ}\right| = \sqrt{${paren(a)}^2 + ${paren(b)}^2} = \sqrt{${N}}`, note: "Pythagorean theorem on the right triangle with legs |a| and |b|." },
        ...(mag.s !== N ? [{ math: md`\sqrt{${N}} = ${exTex(mag)}`, note: mag.s === 1 ? md`${N} is a perfect square.` : md`$${N} = ${(mag.n / mag.d) ** 2} \cdot ${mag.s}$.` }] : []),
      ],
    };
  }
  // Terminal point from initial point and vector.
  return {
    prompt: md`The vector $\mathbf{v} = ${vecTex(a, b)}$ is drawn with its initial point at $P(${x1}, ${y1})$. Find its terminal point $Q$. Type it as (x, y).`,
    answer: `(${x2}, ${y2})`,
    form: "tuple",
    verify: [`x^2 + y^2 = ${x2 * x2 + y2 * y2}`, `${x2} x + ${y2} y = ${x2 * x2 + y2 * y2}`],
    hint: "The components say how far to move from P: add them to P's coordinates.",
    solution: [
      { math: md`Q = (${x1} ${a < 0 ? "-" : "+"} ${Math.abs(a)}, \; ${y1} ${b < 0 ? "-" : "+"} ${Math.abs(b)})`, note: md`Move $${a}$ in $x$ and $${b}$ in $y$.` },
      { math: md`Q = (${x2}, ${y2})`, note: "" },
    ],
  };
};

/** A rounded value that isn't sitting on a rounding boundary, so the one-decimal key is unambiguous. */
function safeRound(value: number): boolean {
  const f = (value * 10) % 1;
  return Math.abs(f - 0.5) > 0.03;
}

const vectorArithmetic: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let [u1, u2, v1, v2] = [0, 0, 0, 0];
    do {
      [u1, u2, v1, v2] = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
    } while (u1 * v2 - u2 * v1 === 0);
    const c1 = r.pick([2, 3, -2, 4]);
    const c2 = r.pick([1, -1, 2, -2, 3, -3]);
    const [a, b] = [c1 * u1 + c2 * v1, c1 * u2 + c2 * v2];
    const c2Tex = c2 === 1 ? "+ " : c2 === -1 ? "- " : c2 < 0 ? `- ${-c2}` : `+ ${c2}`;
    const expr = md`${c1}\mathbf{u} ${c2Tex}\mathbf{v}`;
    const uu = u1 * u1 + u2 * u2;
    const uv = u1 * v1 + u2 * v2;
    const vv = v1 * v1 + v2 * v2;
    return {
      prompt: md`Let $\mathbf{u} = ${vecTex(u1, u2)}$ and $\mathbf{v} = ${vecTex(v1, v2)}$. Find $${expr}$. Type it as (a, b).`,
      answer: `(${a}, ${b})`,
      form: "tuple",
      // Dot the result with u and with v: two equations that pin it down, since u and v aren't parallel.
      verify: [`${u1} a + ${u2} b = ${c1 * uu + c2 * uv}`, `${v1} a + ${v2} b = ${c1 * uv + c2 * vv}`],
      hint: "Multiply each vector by its scalar, component by component, then add components.",
      solution: [
        { math: md`${c1}\mathbf{u} = ${vecTex(c1 * u1, c1 * u2)}, \qquad ${Math.abs(c2) === 1 ? "" : Math.abs(c2)}\mathbf{v} = ${vecTex(Math.abs(c2) * v1, Math.abs(c2) * v2)}`, note: "A scalar multiplies both components." },
        { math: md`${expr} = \langle ${c1 * u1} ${c2 < 0 ? "-" : "+"} ${paren(Math.abs(c2) * v1)}, \; ${c1 * u2} ${c2 < 0 ? "-" : "+"} ${paren(Math.abs(c2) * v2)} \rangle`, note: c2 < 0 ? "Subtracting a vector subtracts each component." : "Add matching components." },
        { math: vecTex(a, b), note: "" },
      ],
    };
  }
  if (kind === 1) {
    let a = 0;
    let b = 0;
    let deg = 0;
    do {
      [a, b] = [r.nonzero(-9, 9), r.nonzero(-9, 9)];
      deg = (Math.atan2(b, a) * 180) / Math.PI;
      if (deg < 0) deg += 360;
    } while (!safeRound(deg));
    const ref = (Math.atan(Math.abs(b / a)) * 180) / Math.PI;
    const q = a > 0 && b > 0 ? "I" : a < 0 && b > 0 ? "II" : a < 0 && b < 0 ? "III" : "IV";
    const build = q === "I" ? md`\theta = ${ref.toFixed(2)}^\circ` : q === "II" ? md`\theta = 180^\circ - ${ref.toFixed(2)}^\circ` : q === "III" ? md`\theta = 180^\circ + ${ref.toFixed(2)}^\circ` : md`\theta = 360^\circ - ${ref.toFixed(2)}^\circ`;
    return {
      prompt: md`Find the direction angle of $\mathbf{v} = ${vecTex(a, b)}$, in degrees with $0^\circ \le \theta < 360^\circ$, rounded to one decimal place. Type just the number.`,
      answer: deg.toFixed(1),
      tolerance: 0.05,
      hint: md`$\tan\theta = \frac{b}{a}$ gives the reference angle $\arctan\left|\frac{b}{a}\right|$. Then place it in the quadrant of $(a, b)$.`,
      solution: [
        { math: md`\tan\theta_{\text{ref}} = \left|\frac{${b}}{${a}}\right| = ${frac(Math.abs(b), Math.abs(a)) === String(Math.abs(b) / Math.abs(a)) ? frac(Math.abs(b), Math.abs(a)) : fracTex(Math.abs(b), Math.abs(a))}`, note: "The acute angle the arrow makes with the x-axis." },
        { math: md`\theta_{\text{ref}} = \arctan${fracTex(Math.abs(b), Math.abs(a)).startsWith("\\frac") ? fracTex(Math.abs(b), Math.abs(a)) : `(${fracTex(Math.abs(b), Math.abs(a))})`} \approx ${ref.toFixed(2)}^\circ`, note: "Calculator, in degree mode." },
        { math: md`${build} \approx ${deg.toFixed(1)}^\circ`, note: md`$(${a}, ${b})$ is in quadrant ${q}.` },
      ],
    };
  }
  let [v1, v2] = [r.nonzero(-6, 6), r.nonzero(-6, 6)];
  const N = v1 * v1 + v2 * v2;
  const ux = ex(v1, N, N);
  const uy = ex(v2, N, N);
  const root = ex(1, 1, N);
  return {
    prompt: md`Find the unit vector in the direction of $\mathbf{v} = ${vecTex(v1, v2)}$. Give exact components with rationalized denominators, like (3sqrt(10)/10, -sqrt(10)/10).`,
    answer: `(${exText(ux)}, ${exText(uy)})`,
    form: "tuple",
    simplified: true,
    // Length 1, and its dot product with v is |v|: only the unit vector along v does both.
    verify: [`a^2 + b^2 = 1`, `${v1} a + ${v2} b = sqrt(${N})`],
    hint: md`Divide $\mathbf{v}$ by its own length, $|\mathbf{v}| = \sqrt{${paren(v1)}^2 + ${paren(v2)}^2}$.`,
    solution: [
      { math: md`|\mathbf{v}| = \sqrt{${v1 * v1} + ${v2 * v2}} = \sqrt{${N}}${root.s !== N ? ` = ${exTex(root)}` : ""}`, note: "The length to divide by." },
      { math: md`\frac{\mathbf{v}}{|\mathbf{v}|} = \left\langle \frac{${v1}}{${exTex(root)}}, \frac{${v2}}{${exTex(root)}} \right\rangle`, note: md`Dividing by $|\mathbf{v}|$ scales the length to 1 and keeps the direction.` },
      { math: md`= \left\langle ${exTex(ux)}, ${exTex(uy)} \right\rangle`, note: root.s === 1 ? "" : md`Rationalize: multiply top and bottom by $\sqrt{${root.s}}$.` },
    ],
  };
};

const dotProducts: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [u1, u2, v1, v2] = [r.nonzero(-7, 7), r.nonzero(-7, 7), r.nonzero(-7, 7), r.nonzero(-7, 7)];
    const d = u1 * v1 + u2 * v2;
    const uu = u1 * u1 + u2 * u2;
    const vv = v1 * v1 + v2 * v2;
    const ss = (u1 + v1) ** 2 + (u2 + v2) ** 2;
    return {
      prompt: md`Find $\mathbf{u} \cdot \mathbf{v}$ for $\mathbf{u} = ${vecTex(u1, u2)}$ and $\mathbf{v} = ${vecTex(v1, v2)}$.`,
      answer: String(d),
      // |u + v|^2 = |u|^2 + |v|^2 + 2 u·v, computed from the components directly.
      verify: [`${uu} + ${vv} + 2 d = ${ss}`],
      hint: "Multiply matching components and add the two products. The answer is a number, not a vector.",
      solution: [
        { math: md`\mathbf{u} \cdot \mathbf{v} = ${paren(u1)}${paren(v1)} + ${paren(u2)}${paren(v2)}`, note: "First components together, second components together." },
        { math: md`= ${u1 * v1} ${u2 * v2 < 0 ? "-" : "+"} ${Math.abs(u2 * v2)} = ${d}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    let [u1, u2, v1, v2] = [0, 0, 0, 0];
    let deg = 0;
    let cosv = 0;
    do {
      [u1, u2, v1, v2] = [r.nonzero(-6, 6), r.nonzero(-6, 6), r.nonzero(-6, 6), r.nonzero(-6, 6)];
      cosv = (u1 * v1 + u2 * v2) / (Math.hypot(u1, u2) * Math.hypot(v1, v2));
      deg = (Math.acos(Math.max(-1, Math.min(1, cosv))) * 180) / Math.PI;
    } while (u1 * v2 - u2 * v1 === 0 || !safeRound(deg));
    const d = u1 * v1 + u2 * v2;
    const uu = u1 * u1 + u2 * u2;
    const vv = v1 * v1 + v2 * v2;
    return {
      prompt: md`Find the angle between $\mathbf{u} = ${vecTex(u1, u2)}$ and $\mathbf{v} = ${vecTex(v1, v2)}$, in degrees rounded to one decimal place. Type just the number.`,
      answer: deg.toFixed(1),
      tolerance: 0.05,
      hint: md`$\cos\theta = \dfrac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{u}|\,|\mathbf{v}|}$, then $\theta = \arccos$ of that, between $0^\circ$ and $180^\circ$.`,
      solution: [
        { math: md`\mathbf{u} \cdot \mathbf{v} = ${paren(u1)}${paren(v1)} + ${paren(u2)}${paren(v2)} = ${d}`, note: "" },
        { math: md`|\mathbf{u}| = \sqrt{${uu}}, \qquad |\mathbf{v}| = \sqrt{${vv}}`, note: "" },
        { math: md`\cos\theta = \frac{${d}}{\sqrt{${uu}}\sqrt{${vv}}} \approx ${cosv.toFixed(4)}`, note: "The angle formula, rearranged." },
        { math: md`\theta = \arccos(${cosv.toFixed(4)}) \approx ${deg.toFixed(1)}^\circ`, note: d < 0 ? "A negative dot product means an obtuse angle." : "A positive dot product means an acute angle." },
      ],
    };
  }
  const [b, c, d] = [r.nonzero(-8, 8), r.nonzero(-6, 6), r.nonzero(-8, 8)];
  const k = frac(-b * d, c);
  return {
    prompt: md`Find the value of $k$ that makes $${vecTex("k", b)}$ perpendicular to $${vecTex(c, d)}$. Fractions are fine, like 7/4.`,
    answer: k,
    verify: [`k (${c}) + (${b})(${d}) = 0`],
    hint: "Perpendicular vectors have dot product 0. Write the dot product and solve.",
    solution: [
      { math: md`${vecTex("k", b)} \cdot ${vecTex(c, d)} = ${c}k ${b * d < 0 ? "-" : "+"} ${Math.abs(b * d)} = 0`, note: "Perpendicular means the dot product is 0, since cos 90° = 0." },
      { math: md`${c}k = ${-b * d}`, note: "" },
      { math: md`k = ${fracTex(-b * d, c)}`, note: "" },
    ],
  };
};

// ── Lesson 3 generators: complex numbers in polar form ──────────────────────

/** r(cos θ + i sin θ) in LaTeX; a modulus of 1 is left out. */
const polarFormTex = (R: number | string, Ttex: string): string => `${String(R) === "1" ? "" : R}\\left(\\cos ${Ttex} + i\\sin ${Ttex}\\right)`;

const toPolarForm: Generator = (r) => {
  const R = r.int(1, 6);
  const k = niceAngle(r);
  const re = exMul(ex(R), exCos(k));
  const im = exMul(ex(R), exSin(k));
  const T = piText(k, 12);
  const Ttex = piTex(k, 12);
  const steps: Step[] = [
    { math: md`r = |z| = \sqrt{${exTex(exMul(re, re))} + ${exTex(exMul(im, im))}} = ${R}`, note: "The modulus is the distance from 0." },
  ];
  if (k % 6 === 0) {
    steps.push({ math: md`\theta = ${Ttex}`, note: md`$z$ lies on the ${axisName(k).replace("$x$-axis", "real axis").replace("$y$-axis", "imaginary axis")}.` });
  } else {
    const ref = refTwelfths(k);
    steps.push({ math: md`\tan\theta = \frac{b}{a} = \frac{${exTex(im)}}{${exTex(re)}} = ${exTex(exMul(im, exInv(re)))}`, note: md`Reference angle $${piTex(ref, 12)}$.` });
    steps.push({ math: md`\theta = ${quadFormula(k)} = ${Ttex}`, note: md`The point $(${exTex(re)}, ${exTex(im)})$ is in quadrant ${quadName(k)}.` });
  }
  steps.push({ math: md`z = ${polarFormTex(R, Ttex)}`, note: md`Check: $${R}\cos ${Ttex} = ${exTex(re)}$ and $${R}\sin ${Ttex} = ${exTex(im)}$.` });
  return {
    prompt: md`Write $z = ${cxTex(re, im)}$ in polar form $r(\cos\theta + i\sin\theta)$. Give $(r, \theta)$ with $r > 0$ and $0 \le \theta < 2\pi$, with $\theta$ as a multiple of pi, like (2, 5pi/6).`,
    answer: `(${R}, ${T})`,
    form: "tuple",
    simplified: true,
    figure: complexArrow(exVal(re), exVal(im)),
    verify: [`r cos(t) = ${exText(re)}`, `r sin(t) = ${exText(im)}`],
    hint: md`$r = \sqrt{a^2 + b^2}$, and $\theta$ is the polar angle of the point $(a, b)$: use $\tan\theta = \frac{b}{a}$ and the quadrant shown.`,
    solution: steps,
  };
};

const polarToRectangular: Generator = (r) => {
  const R = r.int(1, 8);
  const k = niceAngle(r);
  const c = exCos(k);
  const s = exSin(k);
  const re = exMul(ex(R), c);
  const im = exMul(ex(R), s);
  const Ttex = piTex(k, 12);
  return {
    prompt: md`Simplify $${polarFormTex(R, Ttex)}$ to the form $a + bi$ with exact values (type sqrt(3) for $\sqrt{3}$).`,
    answer: cxText(re, im),
    complex: true,
    simplified: true,
    hint: md`Find $\cos ${Ttex}$ and $\sin ${Ttex}$ exactly (${refNote(k)}), then multiply through by $${R}$.`,
    solution: [
      { math: md`\cos ${Ttex} = ${exTex(c)}, \qquad \sin ${Ttex} = ${exTex(s)}`, note: md`Exact values from the unit circle: ${refNote(k)}.` },
      { math: md`${R}\left(${exTex(c)} + ${s.n < 0 ? `\\left(${exTex(s)}\\right)` : exTex(s)} i\right)`, note: "Substitute." },
      { math: cxTex(re, im), note: md`Distribute the $${R}$.` },
    ],
  };
};

const productsQuotients: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0 || kind === 1) {
    // Product or quotient, answered in polar form.
    const quotient = kind === 1;
    const r2 = r.int(1, 4);
    const r1 = quotient ? r2 * r.int(2, 5) : r.int(1, 5);
    const k1 = r.int(1, 23);
    let k2 = r.int(1, 23);
    while (k2 === k1) k2 = r.int(1, 23);
    const kOut = norm24(quotient ? k1 - k2 : k1 + k2);
    const rOut = quotient ? r1 / r2 : r1 * r2;
    const [T1, T2] = [piText(k1, 12), piText(k2, 12)];
    const [T1x, T2x] = [piTex(k1, 12), piTex(k2, 12)];
    const raw = quotient ? k1 - k2 : k1 + k2;
    const rawTex = piTex(raw, 12);
    const outTex = piTex(kOut, 12);
    return {
      prompt: md`Let $z_1 = ${polarFormTex(r1, T1x)}$ and $z_2 = ${polarFormTex(r2, T2x)}$. Find $${quotient ? "\\dfrac{z_1}{z_2}" : "z_1 z_2"}$ in polar form. Give $(r, \theta)$ with $0 \le \theta < 2\pi$ and $\theta$ as a multiple of pi, like (6, 5pi/12).`,
      answer: `(${rOut}, ${piText(kOut, 12)})`,
      form: "tuple",
      // Checked the long way, by rectangular multiplication: z1 z2 or w z2 = z1.
      verify: quotient
        ? [`r cos(t) ${r2} cos(${T2}) - r sin(t) ${r2} sin(${T2}) = ${r1} cos(${T1})`, `r cos(t) ${r2} sin(${T2}) + r sin(t) ${r2} cos(${T2}) = ${r1} sin(${T1})`]
        : [`r cos(t) = ${r1} cos(${T1}) ${r2} cos(${T2}) - ${r1} sin(${T1}) ${r2} sin(${T2})`, `r sin(t) = ${r1} sin(${T1}) ${r2} cos(${T2}) + ${r1} cos(${T1}) ${r2} sin(${T2})`],
      hint: quotient ? "Divide the moduli and subtract the arguments." : "Multiply the moduli and add the arguments.",
      solution: [
        { math: quotient ? md`r = \frac{${r1}}{${r2}} = ${rOut}` : md`r = ${r1} \cdot ${r2} = ${rOut}`, note: quotient ? "Moduli divide." : "Moduli multiply." },
        { math: quotient ? md`\theta = ${T1x} - ${T2x} = ${rawTex}` : md`\theta = ${T1x} + ${T2x} = ${rawTex}`, note: quotient ? "Arguments subtract." : "Arguments add." },
        ...(raw !== kOut ? [{ math: md`${rawTex} ${raw < 0 ? "+" : "-"} 2\pi = ${outTex}`, note: md`${raw < 0 ? "Add" : "Subtract"} a full turn to land in $[0, 2\pi)$.` }] : []),
        { math: md`${quotient ? "\\frac{z_1}{z_2}" : "z_1 z_2"} = ${polarFormTex(rOut, outTex)}`, note: "" },
      ],
    };
  }
  // Product or quotient whose result has a nice angle, answered in a + bi form (auto-checked by the validator).
  const quotient = kind === 3;
  // A quotient with target angle 0 would force k2 = k1, so the target is re-picked with the angles.
  let target = niceAngle(r);
  let k1 = r.int(1, 23);
  let k2 = norm24(quotient ? k1 - target : target - k1);
  while (k2 === 0 || k2 === k1) {
    target = niceAngle(r);
    k1 = r.int(1, 23);
    k2 = norm24(quotient ? k1 - target : target - k1);
  }
  const r2 = r.int(1, 3);
  const r1 = quotient ? r2 * r.int(2, 4) : r.int(1, 4);
  const rOut = quotient ? r1 / r2 : r1 * r2;
  const c = exCos(target);
  const s = exSin(target);
  const re = exMul(ex(rOut), c);
  const im = exMul(ex(rOut), s);
  const [T1x, T2x] = [piTex(k1, 12), piTex(k2, 12)];
  const raw = quotient ? k1 - k2 : k1 + k2;
  const expr = quotient ? md`\frac{${polarFormTex(r1, T1x)}}{${polarFormTex(r2, T2x)}}` : md`\left[${polarFormTex(r1, T1x)}\right]\left[${polarFormTex(r2, T2x)}\right]`;
  return {
    prompt: md`Simplify $${expr}$. Give the answer in $a + bi$ form with exact values (type sqrt(2) for $\sqrt{2}$).`,
    answer: cxText(re, im),
    complex: true,
    simplified: true,
    hint: quotient ? "Divide the moduli, subtract the arguments, then evaluate the cosine and sine exactly." : "Multiply the moduli, add the arguments, then evaluate the cosine and sine exactly.",
    solution: [
      { math: quotient ? md`\frac{${r1}}{${r2}}\left(\cos\left(${T1x} - ${T2x}\right) + i\sin\left(${T1x} - ${T2x}\right)\right)` : md`${r1} \cdot ${r2}\left(\cos\left(${T1x} + ${T2x}\right) + i\sin\left(${T1x} + ${T2x}\right)\right)`, note: quotient ? "Quotient rule: divide moduli, subtract arguments." : "Product rule: multiply moduli, add arguments." },
      { math: md`= ${polarFormTex(rOut, piTex(raw, 12))}${raw !== target ? ` = ${polarFormTex(rOut, piTex(target, 12))}` : ""}`, note: raw !== target ? md`$${piTex(raw, 12)}$ and $${piTex(target, 12)}$ differ by a full turn.` : "" },
      { math: md`= ${rOut}\left(${exTex(c)} + ${s.n < 0 ? `\\left(${exTex(s)}\\right)` : exTex(s)} i\right) = ${cxTex(re, im)}`, note: md`$\cos ${piTex(target, 12)} = ${exTex(c)}$ and $\sin ${piTex(target, 12)} = ${exTex(s)}$.` },
    ],
  };
};

// ── Lesson 4 generators: De Moivre ──────────────────────────────────────────

interface Base {
  tex: string;
  r: Ex;
  k: number;
  maxN: number;
}

const BASES: Base[] = [
  { tex: "1 + i", r: ex(1, 1, 2), k: 3, maxN: 8 },
  { tex: "1 - i", r: ex(1, 1, 2), k: 21, maxN: 8 },
  { tex: "-1 + i", r: ex(1, 1, 2), k: 9, maxN: 8 },
  { tex: "-1 - i", r: ex(1, 1, 2), k: 15, maxN: 8 },
  { tex: "\\sqrt{3} + i", r: ex(2), k: 2, maxN: 6 },
  { tex: "\\sqrt{3} - i", r: ex(2), k: 22, maxN: 6 },
  { tex: "-\\sqrt{3} + i", r: ex(2), k: 10, maxN: 6 },
  { tex: "-\\sqrt{3} - i", r: ex(2), k: 14, maxN: 6 },
  { tex: "1 + \\sqrt{3}i", r: ex(2), k: 4, maxN: 6 },
  { tex: "1 - \\sqrt{3}i", r: ex(2), k: 20, maxN: 6 },
  { tex: "-1 + \\sqrt{3}i", r: ex(2), k: 8, maxN: 6 },
  { tex: "-1 - \\sqrt{3}i", r: ex(2), k: 16, maxN: 6 },
  { tex: "2 + 2i", r: ex(2, 1, 2), k: 3, maxN: 4 },
  { tex: "2 - 2i", r: ex(2, 1, 2), k: 21, maxN: 4 },
];

const deMoivrePowers: Generator = (r) => {
  const polarBase = r.next() < 0.3;
  let baseTex: string;
  let R: Ex;
  let k: number;
  let n: number;
  if (polarBase) {
    R = ex(r.pick([2, 3]));
    // n = 5 never works here: 5k is a nice angle only when k already is.
    n = r.int(2, 4);
    do k = r.int(1, 23);
    while (!NICE.includes(norm24(n * k)) || NICE.includes(k));
    baseTex = `\\left[${polarFormTex(exTex(R), piTex(k, 12))}\\right]`;
  } else {
    const base = r.pick(BASES);
    baseTex = `(${base.tex})`;
    R = base.r;
    k = base.k;
    n = r.int(3, base.maxN);
  }
  const Rn = exPow(R, n);
  const nk = n * k;
  const kOut = norm24(nk);
  const c = exCos(kOut);
  const s = exSin(kOut);
  const re = exMul(Rn, c);
  const im = exMul(Rn, s);
  const Ttex = piTex(k, 12);
  const steps: Step[] = [];
  if (!polarBase) {
    const a = exMul(R, exCos(k));
    const b = exMul(R, exSin(k));
    steps.push({
      math: md`${baseTex.slice(1, -1)} = ${polarFormTex(exTex(R), Ttex)}`,
      note: md`Modulus $\sqrt{${exTex(exMul(a, a))} + ${exTex(exMul(b, b))}} = ${exTex(R)}$; the point $(${exTex(a)}, ${exTex(b)})$ is in quadrant ${quadName(k)}, so the argument is $${Ttex}$.`,
    });
  }
  steps.push({
    math: md`${baseTex}^{${n}} = ${exTex(Rn)}\left(\cos ${n} \cdot ${Ttex} + i\sin ${n} \cdot ${Ttex}\right)`,
    note: md`De Moivre: raise the modulus to the ${ORDINAL[n] ?? `${n}th`} power${R.s === 2 ? md` ($(${exTex(R)})^{${n}} = ${exTex(Rn)}$)` : ""} and multiply the argument by ${n}.`,
  });
  steps.push({
    math: md`= ${polarFormTex(exTex(Rn), piTex(nk, 12))}${nk !== kOut ? ` = ${polarFormTex(exTex(Rn), piTex(kOut, 12))}` : ""}`,
    note: nk !== kOut ? md`$${piTex(nk, 12)} - ${piTex(nk - kOut, 12)} = ${piTex(kOut, 12)}$: drop the full turns.` : "",
  });
  steps.push({
    math: md`= ${exTex(Rn)}\left(${exTex(c)} + ${s.n < 0 ? `\\left(${exTex(s)}\\right)` : exTex(s)} i\right) = ${cxTex(re, im)}`,
    note: md`$\cos ${piTex(kOut, 12)} = ${exTex(c)}$ and $\sin ${piTex(kOut, 12)} = ${exTex(s)}$.`,
  });
  return {
    prompt: md`Simplify $${baseTex}^{${n}}$. Give the answer in $a + bi$ form with exact values, like -4sqrt(3) + 4i.`,
    answer: cxText(re, im),
    complex: true,
    simplified: true,
    hint: polarBase ? md`De Moivre: $[r(\cos\theta + i\sin\theta)]^n = r^n(\cos n\theta + i\sin n\theta)$. Then reduce the angle by full turns.` : md`Write the base in polar form first: find its modulus and argument. Then De Moivre.`,
    solution: steps,
  };
};

const nthRoots: Generator = (r) => {
  const n = r.pick([2, 2, 3, 3, 4, 6]);
  const s = n === 6 ? r.pick([1, 2]) : n === 2 ? r.int(1, 5) : r.pick([1, 2, 3]);
  // Root angles k0 + 24j/n (twelfths) must all have exact coordinates.
  const step = 24 / n;
  const k0 = n === 3 || n === 6 ? r.pick([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].filter((k) => k < step)) : r.pick(NICE.filter((k) => k < step));
  const Rz = s ** n;
  const kz = norm24(n * k0);
  const zRe = exMul(ex(Rz), exCos(kz));
  const zIm = exMul(ex(Rz), exSin(kz));
  const zText = cxText(zRe, zIm);
  const zTex = cxTex(zRe, zIm);
  const ks = Array.from({ length: n }, (_, j) => k0 + j * step);
  const roots = ks.map((kj) => ({ re: exMul(ex(s), exCos(kj)), im: exMul(ex(s), exSin(kj)), k: kj }));
  const kzTex = piTex(kz, 12);
  return {
    prompt: md`Find all the ${ORDINAL[n]} roots of $z = ${zTex}$. Give them in $a + bi$ form, separated by commas (type sqrt(3) for $\sqrt{3}$).`,
    answer: roots.map((w) => cxText(w.re, w.im)).join(", "),
    form: "set",
    complex: true,
    simplified: true,
    verify: [`w^${n} = ${zText}`],
    hint: md`Write $z$ in polar form. Each root has modulus $\sqrt[${n}]{|z|}$ and argument $\frac{\theta + 2\pi j}{${n}}$ for $j = 0, 1, \dots, ${n - 1}$.`,
    solution: [
      { math: md`z = ${polarFormTex(Rz, kzTex)}`, note: md`$|z| = ${Rz}$ and the argument is $${kzTex}$.` },
      { math: md`|w| = \sqrt[${n}]{${Rz}} = ${s}`, note: md`Every root has the same modulus, the real ${ORDINAL[n]} root of $|z|$.` },
      { math: md`\theta_j = \frac{${kzTex} + 2\pi j}{${n}}, \quad j = 0, \dots, ${n - 1}: \quad ${ks.map((kj) => piTex(kj, 12)).join(",\\; ")}`, note: md`Consecutive roots are $\frac{2\pi}{${n}}$ apart.` },
      { math: roots.map((w) => `${s}\\left(\\cos ${piTex(w.k, 12)} + i\\sin ${piTex(w.k, 12)}\\right) = ${cxTex(w.re, w.im)}`).join(" \\\\ "), note: "Evaluate each one with exact values." },
    ],
  };
};

const rootInPolar: Generator = (r) => {
  const n = r.int(2, 5);
  const s = r.pick([2, 3]);
  const Rz = s ** n;
  const k = r.int(1, 23);
  const which = r.int(0, 2);
  const j = which === 0 ? 0 : which === 1 ? 1 : n - 1;
  const desc = which === 0 ? "the smallest nonnegative argument" : which === 1 ? "the second-smallest nonnegative argument" : "the largest argument below $2\\pi$";
  const num = k + 24 * j;
  const den = 12 * n;
  const Tz = piTex(k, 12);
  return {
    prompt: md`$z = ${polarFormTex(Rz, Tz)}$ has ${n} ${ORDINAL[n]} roots. Find the one with ${desc}, in polar form. Give $(r, \theta)$ with $\theta$ as a multiple of pi, like (3, 7pi/20).`,
    answer: `(${s}, ${piText(num, den)})`,
    form: "tuple",
    complex: true,
    // The root raised to the nth power must be z.
    verify: [`(r cos(t) + r i sin(t))^${n} = ${Rz} cos(${piText(k, 12)}) + ${Rz} i sin(${piText(k, 12)})`],
    hint: md`Roots: modulus $\sqrt[${n}]{${Rz}}$, arguments $\frac{${Tz} + 2\pi j}{${n}}$ with $j = 0, 1, \dots, ${n - 1}$ in increasing order.`,
    solution: [
      { math: md`|w| = \sqrt[${n}]{${Rz}} = ${s}`, note: md`$${s}^{${n}} = ${Rz}$.` },
      { math: md`\theta_j = \frac{${Tz} + 2\pi j}{${n}}`, note: md`Each $j$ from 0 to ${n - 1} gives a different root, and the arguments grow with $j$.` },
      { math: md`j = ${j}: \quad \theta = \frac{${piTex(num, 12)}}{${n}} = ${piTex(num, den)}`, note: which === 0 ? "The first root." : which === 1 ? "The second root counterclockwise." : md`$j = ${n - 1}$ is the last root before the angles repeat.` },
      { math: md`w = ${polarFormTex(s, piTex(num, den))}`, note: "" },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

const SQ3 = Math.sqrt(3);

export const unit8: Unit = {
  title: "Polar Coordinates and Vectors",
  lessons: [
    {
      id: slug("Polar coordinates"),
      title: "Polar coordinates",
      summary: "Locating a point by distance and direction, converting to and from (x, y), and drawing curves like r = 2cos θ.",
      blocks: [
        {
          kind: "text",
          body: md`Rectangular coordinates locate a point by two distances: how far right, how far up. There is another natural way. A radar operator says "12 miles out, bearing 40 degrees". A distance and a direction also pin down a point, and for anything that turns, like circles, spirals and orbits, they are the better description.`,
        },
        {
          kind: "key",
          title: "Polar coordinates",
          body: md`Fix a point $O$, the **pole**, and a ray from it, the **polar axis** (we use the positive $x$-axis). A point $P$ has polar coordinates $(r, \theta)$ when $\theta$ is an angle in standard position whose terminal side passes through $P$, and $r$ is the *directed* distance from $O$ along that side: $|r|$ is the distance $OP$, and $r < 0$ means $P$ sits on the opposite ray, behind the pole.

Angles are in radians unless degrees are written.`,
        },
        {
          kind: "diagram",
          view: [-4.5, 4.5, -4.5, 4.5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "O", dir: "sw" },
            { name: "P", x: "r cos(t)", y: "r sin(t)", label: "P = (r, \\theta)", dir: "ne" },
          ],
          circles: [{ center: "O", radius: "r", dashed: true }],
          segments: [{ from: "O", to: "P", arrow: true, color: 1, label: "r" }],
          params: [
            { name: "r", tex: "r", min: 0.5, max: 4, step: 0.5, value: 3 },
            { name: "t", tex: "\\theta", min: 0, max: 6.2832, step: Math.PI / 12, value: Math.PI / 4 },
          ],
          readouts: [
            { label: "\\theta", value: "180 t / pi", unit: "^\\circ" },
            { label: "x = r\\cos\\theta", value: "r cos(t)" },
            { label: "y = r\\sin\\theta", value: "r sin(t)" },
          ],
          caption: md`Slide $r$ and $\theta$. The dashed circle is every point with this $r$; the angle picks one of them. The readouts show the same point in rectangular coordinates.`,
        },
        {
          kind: "why",
          title: "Why one point has many names",
          body: md`Turning a full circle brings the terminal side back where it was, so $(r, \theta)$ and $(r, \theta + 2\pi k)$ name the same point for every integer $k$. And walking $r$ units *backwards* along direction $\theta$ lands exactly where walking $r$ units forwards along $\theta + \pi$ does, so $(-r, \theta)$ and $(r, \theta + \pi)$ are the same point too. The pole itself is $(0, \theta)$ for any $\theta$ at all.

Rectangular coordinates never do this: each point has exactly one pair $(x, y)$. Polar coordinates trade that uniqueness for a natural way to talk about distance and turning. When a problem wants a single answer it says so, usually $r > 0$ and $0 \le \theta < 2\pi$.`,
        },
        {
          kind: "example",
          title: "Other names for the same point",
          problem: md`Give three other polar names for the point $\left(3, \frac{\pi}{4}\right)$, one of them with a negative $r$.`,
          steps: [
            { math: md`\left(3, \tfrac{\pi}{4} + 2\pi\right) = \left(3, \tfrac{9\pi}{4}\right)`, note: "One extra full turn." },
            { math: md`\left(3, \tfrac{\pi}{4} - 2\pi\right) = \left(3, -\tfrac{7\pi}{4}\right)`, note: "One full turn the other way." },
            { math: md`\left(-3, \tfrac{\pi}{4} + \pi\right) = \left(-3, \tfrac{5\pi}{4}\right)`, note: md`Face the opposite direction, $\frac{5\pi}{4}$, and step 3 units backwards.` },
          ],
        },
        {
          kind: "key",
          title: "Polar to rectangular",
          body: md`$$x = r\cos\theta, \qquad y = r\sin\theta.$$`,
        },
        {
          kind: "why",
          title: "Why x = r cos θ and y = r sin θ",
          body: md`On the unit circle (Unit 3) the point at angle $\theta$ is $(\cos\theta, \sin\theta)$. That is the definition of cosine and sine for every angle. The point $(r, \theta)$ with $r > 0$ lies on the same ray, $r$ times as far from the pole. Scaling from the origin by a factor $r$ multiplies both coordinates by $r$ (the right triangles with hypotenuse $1$ and hypotenuse $r$ are similar, Geometry Unit 6), so $P = (r\cos\theta, r\sin\theta)$.

If $r < 0$, $P$ is $|r|$ units out along the opposite ray, at angle $\theta + \pi$. Then $x = |r|\cos(\theta + \pi) = -|r|\cos\theta = r\cos\theta$, since $\cos(\theta + \pi) = -\cos\theta$ and $-|r| = r$. Same for $y$. The formula needs no special case.`,
        },
        {
          kind: "example",
          title: "Polar to rectangular",
          problem: md`Convert $\left(4, \frac{2\pi}{3}\right)$ to rectangular coordinates.`,
          steps: [
            { math: md`x = 4\cos\tfrac{2\pi}{3} = 4 \cdot \left(-\tfrac{1}{2}\right) = -2`, note: md`$\frac{2\pi}{3}$ has reference angle $\frac{\pi}{3}$ in quadrant II, where cosine is negative.` },
            { math: md`y = 4\sin\tfrac{2\pi}{3} = 4 \cdot \tfrac{\sqrt{3}}{2} = 2\sqrt{3}`, note: "Sine is positive in quadrant II." },
            { math: md`(x, y) = \left(-2, 2\sqrt{3}\right)`, note: md`Check: $\sqrt{(-2)^2 + (2\sqrt{3})^2} = \sqrt{16} = 4 = r$.` },
          ],
        },
        {
          kind: "key",
          title: "Rectangular to polar",
          body: md`$$r = \sqrt{x^2 + y^2}, \qquad \tan\theta = \frac{y}{x} \;(x \ne 0),$$

with $\theta$ chosen in the quadrant of the point $(x, y)$. If $x = 0$ the point is on the $y$-axis: $\theta = \frac{\pi}{2}$ when $y > 0$ and $\frac{3\pi}{2}$ when $y < 0$.`,
        },
        {
          kind: "why",
          title: "Why tan θ = y/x isn't the whole story",
          body: md`$r = \sqrt{x^2 + y^2}$ is the Pythagorean theorem on the right triangle with legs $|x|$ and $|y|$. For the angle, divide $y = r\sin\theta$ by $x = r\cos\theta$: the $r$ cancels and $\tan\theta = \frac{y}{x}$.

But tangent has period $\pi$. $\tan\theta = 1$ is true at $\theta = \frac{\pi}{4}$ *and* at $\theta = \frac{5\pi}{4}$, which point in opposite directions: $(1, 1)$ and $(-1, -1)$ have the same $y/x$. The equation alone can't tell them apart, so you look at the signs of $x$ and $y$ yourself. Find the reference angle from $\tan\theta_{\text{ref}} = \left|\frac{y}{x}\right|$, then place it in the right quadrant, exactly as in Unit 3.`,
        },
        {
          kind: "example",
          title: "Rectangular to polar",
          problem: md`Convert $(-3, 3)$ to polar coordinates with $r > 0$ and $0 \le \theta < 2\pi$.`,
          steps: [
            { math: md`r = \sqrt{(-3)^2 + 3^2} = \sqrt{18} = 3\sqrt{2}`, note: "" },
            { math: md`\tan\theta_{\text{ref}} = \left|\tfrac{3}{-3}\right| = 1 \;\Rightarrow\; \theta_{\text{ref}} = \tfrac{\pi}{4}`, note: "The acute angle with the x-axis." },
            { math: md`\theta = \pi - \tfrac{\pi}{4} = \tfrac{3\pi}{4}`, note: md`$(-3, 3)$ has $x < 0$ and $y > 0$: quadrant II.` },
            { math: md`\left(3\sqrt{2}, \tfrac{3\pi}{4}\right)`, note: md`Check: $3\sqrt{2}\cos\frac{3\pi}{4} = 3\sqrt{2} \cdot \left(-\frac{\sqrt{2}}{2}\right) = -3$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Convert $\left(-2, -2\sqrt{3}\right)$ to polar coordinates with $r > 0$ and $0 \le \theta < 2\pi$. Type it as (r, t) with t a multiple of pi, like (4, 5pi/6).`,
          answer: "(4, 4pi/3)",
          form: "tuple",
          explain: md`$r = \sqrt{4 + 12} = 4$. $\tan\theta_{\text{ref}} = \sqrt{3}$, so the reference angle is $\frac{\pi}{3}$. Both coordinates are negative (quadrant III), so $\theta = \pi + \frac{\pi}{3} = \frac{4\pi}{3}$.`,
        },
        {
          kind: "text",
          body: md`A **polar equation** relates $r$ and $\theta$, and its graph is every point with *some* polar name satisfying it. The simplest ones: $r = 3$ is the circle of radius 3 about the pole (any $\theta$, distance 3). $\theta = \frac{\pi}{4}$ is a whole line through the pole, since $r$ may be negative. The equation $r = 2a\cos\theta$ is less obvious. Converting it tells us what it is.`,
        },
        {
          kind: "proof",
          title: "The graph of r = 2a cos θ is a circle",
          given: md`$r = 2a\cos\theta$ with $a \ne 0$`,
          prove: md`The graph is the circle with centre $(a, 0)$ and radius $|a|$`,
          steps: [
            { statement: md`$r^2 = 2a\, r\cos\theta$`, reason: md`Multiply both sides by $r$. This also admits $r = 0$, but the pole is already on the graph ($r = 0$ at $\theta = \frac{\pi}{2}$), so no new points appear.` },
            { statement: md`$x^2 + y^2 = 2ax$`, reason: md`$r^2 = x^2 + y^2$ and $r\cos\theta = x$` },
            { statement: md`$x^2 - 2ax + a^2 + y^2 = a^2$`, reason: md`Add $a^2$ to both sides (completing the square)` },
            { statement: md`$(x - a)^2 + y^2 = a^2$`, reason: "Factor the perfect square" },
            { statement: md`The graph is the circle with centre $(a, 0)$ and radius $|a|$`, reason: "Standard form of a circle (Geometry Unit 7)" },
          ],
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-3, 3],
          parametric: [{ x: "2a cos(t) cos(t)", y: "2a cos(t) sin(t)", t: [0, 2 * Math.PI], label: "r = 2a\\cos\\theta", color: 1 }],
          points: [{ x: "a", y: 0, label: "(a, 0)", color: 2 }],
          params: [{ name: "a", tex: "a", min: -2, max: 2, step: 0.5, value: 1.5 }],
          caption: md`$r = 2a\cos\theta$ for different $a$: always a circle through the pole, centred at $(a, 0)$, with diameter $2|a|$. As $\theta$ runs from $0$ to $\pi$ the whole circle is drawn once; from $\pi$ to $2\pi$, $r$ is negative and the same circle is traced again.`,
        },
        {
          kind: "text",
          body: md`Curves like $r = 1 + \cos\theta$ have no rectangular form worth writing, so sketch them point by point. Take $\theta = 0, \frac{\pi}{6}, \frac{\pi}{3}, \dots$, work out $r$, and plot each $(r, \theta)$:

- $\theta = 0$: $r = 2$. $\theta = \frac{\pi}{3}$: $r = 1.5$. $\theta = \frac{\pi}{2}$: $r = 1$. $\theta = \frac{2\pi}{3}$: $r = 0.5$. $\theta = \pi$: $r = 0$.
- Below the axis, cosine repeats its values, so the bottom half mirrors the top.

The result is a heart shape, the **cardioid**. The computer draws a polar curve the same way, as the parametric curve $x = r(\theta)\cos\theta$, $y = r(\theta)\sin\theta$.`,
        },
        {
          kind: "plot",
          x: [-1.5, 2.5],
          y: [-1.6, 1.6],
          parametric: [{ x: "(1 + cos(t)) cos(t)", y: "(1 + cos(t)) sin(t)", t: [0, 2 * Math.PI], label: "r = 1 + \\cos\\theta", color: 2 }],
          points: [
            { x: 2, y: 0, label: "\\theta = 0", color: 1 },
            { x: 0, y: 1, label: "\\theta = \\tfrac{\\pi}{2}", color: 1 },
            { x: 0, y: 0, label: "\\theta = \\pi", color: 1 },
          ],
          caption: md`The cardioid $r = 1 + \cos\theta$. The marked points are three rows of the table above.`,
        },
        {
          kind: "plot",
          x: [-1.3, 1.3],
          y: [-1.3, 1.3],
          parametric: [{ x: "cos(k t) cos(t)", y: "cos(k t) sin(t)", t: [0, 2 * Math.PI], label: "r = \\cos k\\theta", color: 1 }],
          params: [{ name: "k", tex: "k", min: 1, max: 7, step: 1, value: 3 }],
          caption: md`The rose $r = \cos k\theta$. With $k$ odd there are $k$ petals; with $k$ even there are $2k$. Each petal is one hump of the cosine. When $k$ is odd, the negative humps retrace petals already drawn; when $k$ is even they land in the gaps.`,
        },
        {
          kind: "example",
          title: "Rectangular to polar equation",
          problem: md`Write $x^2 + y^2 = 4y$ as a polar equation.`,
          steps: [
            { math: md`r^2 = 4r\sin\theta`, note: md`$x^2 + y^2 = r^2$ and $y = r\sin\theta$.` },
            { math: md`r = 4\sin\theta`, note: md`Divide by $r$. The only point this could lose is the pole, $r = 0$, and it is still on the new curve at $\theta = 0$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`The polar equation $r = 6\sin\theta$ is a circle. Find the rectangular coordinates of its centre. Type them as (x, y).`,
          answer: "(0, 3)",
          form: "tuple",
          explain: md`Multiply by $r$: $x^2 + y^2 = 6y$, so $x^2 + (y - 3)^2 = 9$. The centre is $(0, 3)$ and the radius is 3. A sine version of the proof above: the circle sits on the $y$-axis instead.`,
        },
      ],
      practice: [polarToRect, rectToPolar, polarEquations],
    },
    {
      id: slug("Vectors in the plane"),
      title: "Vectors in the plane",
      summary: "Quantities with size and direction: components, length, adding and scaling, and the dot product with its angle formula.",
      blocks: [
        {
          kind: "text",
          body: md`Some quantities are just a size: a temperature, a mass, a price. Others need a size *and* a direction: a wind of 30 km/h from the west, a push of 10 newtons downward, a move of 3 blocks east and 4 blocks north. A **vector** is a quantity with both. We draw it as an arrow: the length is the size, the way it points is the direction.

Two arrows are the *same* vector when they have the same length and the same direction, wherever they start. The arrow from $(0, 0)$ to $(3, 4)$ and the arrow from $(2, 1)$ to $(5, 5)$ both say "3 right, 4 up". That pair of numbers is the whole vector.`,
        },
        {
          kind: "key",
          title: "Component form",
          body: md`A vector is written $\mathbf{v} = \langle a, b \rangle$: $a$ is the horizontal change and $b$ the vertical change. The vector from $P(x_1, y_1)$ to $Q(x_2, y_2)$ is
$$\overrightarrow{PQ} = \langle x_2 - x_1,\; y_2 - y_1 \rangle.$$
Its **magnitude** (length) is $|\mathbf{v}| = \sqrt{a^2 + b^2}$. The **zero vector** $\mathbf{0} = \langle 0, 0 \rangle$ has length 0 and no direction. Type vectors as (a, b) or <a, b>.`,
        },
        {
          kind: "diagram",
          view: [0, 7, 0, 5.5],
          grid: true,
          points: [
            { name: "P", x: 1, y: 1, label: "P(1, 1)", dir: "sw" },
            { name: "Q", x: 5, y: 4, label: "Q(5, 4)", dir: "ne" },
            { name: "R", x: 5, y: 1, label: "", hidden: true },
          ],
          segments: [
            { from: "P", to: "Q", arrow: true, color: 1, label: "\\mathbf{v}" },
            { from: "P", to: "R", dashed: true, label: "4" },
            { from: "R", to: "Q", dashed: true, label: "3" },
          ],
          angles: [{ at: "R", from: "Q", to: "P", right: true }],
          caption: md`$\overrightarrow{PQ} = \langle 5 - 1, 4 - 1 \rangle = \langle 4, 3 \rangle$, and $|\overrightarrow{PQ}| = \sqrt{4^2 + 3^2} = 5$.`,
        },
        {
          kind: "why",
          title: "Why subtract, and why a square root",
          body: md`Moving from $P$ to $Q$ changes $x$ by $x_2 - x_1$ and $y$ by $y_2 - y_1$. Those changes are the components, so the arrow from $(2, 1)$ to $(5, 5)$ really is $\langle 3, 4 \rangle$, the same as the arrow from the origin to $(3, 4)$.

The arrow is the hypotenuse of a right triangle whose legs are $|a|$ across and $|b|$ up or down, so its length is $\sqrt{a^2 + b^2}$ by the Pythagorean theorem. Squaring removes the signs, which is right: $\langle -3, -4 \rangle$ is just as long as $\langle 3, 4 \rangle$.`,
        },
        {
          kind: "key",
          title: "Direction angle",
          body: md`The **direction angle** $\theta$ of a nonzero vector $\langle a, b \rangle$ is the angle from the positive $x$-axis to the arrow, with $0^\circ \le \theta < 360^\circ$. It satisfies $\tan\theta = \frac{b}{a}$, with the quadrant fixed by the signs of $a$ and $b$, and
$$\mathbf{v} = \langle |\mathbf{v}|\cos\theta,\; |\mathbf{v}|\sin\theta \rangle.$$
Magnitude and direction angle are just the polar coordinates of the arrow's tip when its tail is at the origin.`,
        },
        {
          kind: "example",
          title: "Components, length and direction",
          problem: md`Find the component form, magnitude and direction angle of the vector from $P(1, -2)$ to $Q(-3, 1)$.`,
          steps: [
            { math: md`\overrightarrow{PQ} = \langle -3 - 1,\; 1 - (-2) \rangle = \langle -4, 3 \rangle`, note: "Terminal minus initial." },
            { math: md`|\overrightarrow{PQ}| = \sqrt{(-4)^2 + 3^2} = 5`, note: "" },
            { math: md`\tan\theta_{\text{ref}} = \tfrac{3}{4} \;\Rightarrow\; \theta_{\text{ref}} \approx 36.87^\circ`, note: "The acute angle with the x-axis." },
            { math: md`\theta = 180^\circ - 36.87^\circ = 143.13^\circ`, note: md`$a < 0$ and $b > 0$: the arrow points into quadrant II.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the magnitude of $\langle -6, 8 \rangle$.`,
          answer: "10",
          explain: md`$\sqrt{(-6)^2 + 8^2} = \sqrt{36 + 64} = \sqrt{100} = 10$.`,
        },
        {
          kind: "key",
          title: "Adding and scaling vectors",
          body: md`For $\mathbf{u} = \langle u_1, u_2 \rangle$, $\mathbf{v} = \langle v_1, v_2 \rangle$ and a number (**scalar**) $k$:
$$\mathbf{u} + \mathbf{v} = \langle u_1 + v_1,\; u_2 + v_2 \rangle, \qquad k\mathbf{u} = \langle ku_1,\; ku_2 \rangle, \qquad \mathbf{u} - \mathbf{v} = \mathbf{u} + (-1)\mathbf{v}.$$
$|k\mathbf{u}| = |k|\,|\mathbf{u}|$. A positive $k$ keeps the direction; a negative $k$ reverses it.`,
        },
        {
          kind: "why",
          title: "Why components add",
          body: md`Walk $\mathbf{u}$, then from where you land walk $\mathbf{v}$. Your total horizontal change is $u_1 + v_1$ and your total vertical change is $u_2 + v_2$, because horizontal moves only affect $x$ and vertical moves only affect $y$. The single arrow from start to finish is $\mathbf{u} + \mathbf{v}$: this is **tip-to-tail** addition. Drawing both sums $\mathbf{u} + \mathbf{v}$ and $\mathbf{v} + \mathbf{u}$ from one point gives a parallelogram with the sum as its diagonal.

For the scalar rule, $|k\mathbf{u}| = \sqrt{k^2 u_1^2 + k^2 u_2^2} = \sqrt{k^2}\sqrt{u_1^2 + u_2^2} = |k|\,|\mathbf{u}|$. And $\langle ku_1, ku_2 \rangle$ has $\frac{ku_2}{ku_1} = \frac{u_2}{u_1}$, the same slope, so it lies along the same line: same direction for $k > 0$, opposite for $k < 0$.`,
        },
        {
          kind: "diagram",
          view: [-4, 8, -4, 6],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "U", x: 3, y: 1, label: "", hidden: true },
            { name: "V", x: "a", y: "b", label: "", hidden: true },
            { name: "W", x: "3 + a", y: "1 + b", label: "\\mathbf{u} + \\mathbf{v}", dir: "ne" },
          ],
          segments: [
            { from: "O", to: "U", arrow: true, color: 1, label: "\\mathbf{u}" },
            { from: "O", to: "V", arrow: true, color: 2, label: "\\mathbf{v}" },
            { from: "U", to: "W", arrow: true, color: 2, dashed: true },
            { from: "V", to: "W", arrow: true, color: 1, dashed: true },
            { from: "O", to: "W", arrow: true, color: 3 },
          ],
          params: [
            { name: "a", tex: "v_1", min: -3, max: 4, step: 0.5, value: 1 },
            { name: "b", tex: "v_2", min: -3, max: 4, step: 0.5, value: 2.5 },
          ],
          readouts: [
            { label: "\\mathbf{u} + \\mathbf{v}", value: "3 + a" },
            { label: "\\text{second component}", value: "1 + b" },
          ],
          caption: md`$\mathbf{u} = \langle 3, 1 \rangle$ is fixed; slide the components of $\mathbf{v}$. The dashed copies show tip-to-tail both ways round, and the green diagonal is the sum. Make $\mathbf{v}$ point against $\mathbf{u}$ and watch the sum shrink.`,
        },
        {
          kind: "text",
          body: md`A **unit vector** has length 1. Dividing any nonzero vector by its own length gives the unit vector in its direction: $\frac{\mathbf{v}}{|\mathbf{v}|}$. For $\langle 3, 4 \rangle$ that is $\left\langle \frac{3}{5}, \frac{4}{5} \right\rangle$.

The unit vectors along the axes get names: $\mathbf{i} = \langle 1, 0 \rangle$ and $\mathbf{j} = \langle 0, 1 \rangle$, so every vector can be written $\langle a, b \rangle = a\mathbf{i} + b\mathbf{j}$. (This $\mathbf{i}$ is a vector, not the imaginary unit. Type answers here in component form.)`,
        },
        {
          kind: "key",
          title: "Dot product",
          body: md`$$\mathbf{u} \cdot \mathbf{v} = u_1 v_1 + u_2 v_2.$$
The result is a *number*, not a vector. In particular $\mathbf{u} \cdot \mathbf{u} = u_1^2 + u_2^2 = |\mathbf{u}|^2$, and the dot product is commutative and distributes over addition, since ordinary multiplication does.`,
        },
        {
          kind: "text",
          body: md`Why define such a thing? Because it measures the angle between two vectors. Put the tails of $\mathbf{u}$ and $\mathbf{v}$ together; the third side of the triangle they make is $\mathbf{u} - \mathbf{v}$, and the law of cosines from Unit 7 applies.`,
        },
        {
          kind: "diagram",
          view: [-0.8, 5, -0.8, 3.8],
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "U", x: 4, y: 1, label: "", hidden: true },
            { name: "V", x: 1, y: 3, label: "", hidden: true },
          ],
          segments: [
            { from: "O", to: "U", arrow: true, color: 1, label: "\\mathbf{u}" },
            { from: "O", to: "V", arrow: true, color: 2, label: "\\mathbf{v}" },
            { from: "V", to: "U", arrow: true, color: 3, dashed: true, label: "\\mathbf{u} - \\mathbf{v}" },
          ],
          angles: [{ at: "O", from: "U", to: "V", label: "\\theta" }],
          caption: md`The triangle has sides $|\mathbf{u}|$, $|\mathbf{v}|$ and $|\mathbf{u} - \mathbf{v}|$, with the angle $\theta$ between the first two.`,
        },
        {
          kind: "proof",
          title: "The angle formula: u · v = |u| |v| cos θ",
          given: md`Nonzero vectors $\mathbf{u} = \langle u_1, u_2 \rangle$ and $\mathbf{v} = \langle v_1, v_2 \rangle$ with angle $\theta$ between them`,
          prove: md`$\mathbf{u} \cdot \mathbf{v} = |\mathbf{u}|\,|\mathbf{v}|\cos\theta$`,
          steps: [
            { statement: md`$|\mathbf{u} - \mathbf{v}|^2 = |\mathbf{u}|^2 + |\mathbf{v}|^2 - 2|\mathbf{u}|\,|\mathbf{v}|\cos\theta$`, reason: md`Law of cosines in the triangle with sides $|\mathbf{u}|$, $|\mathbf{v}|$, $|\mathbf{u} - \mathbf{v}|$ (Unit 7)` },
            { statement: md`$|\mathbf{u} - \mathbf{v}|^2 = (u_1 - v_1)^2 + (u_2 - v_2)^2$`, reason: md`Magnitude of $\langle u_1 - v_1, u_2 - v_2 \rangle$, squared` },
            { statement: md`$= u_1^2 + u_2^2 + v_1^2 + v_2^2 - 2(u_1 v_1 + u_2 v_2)$`, reason: "Expand the squares and regroup" },
            { statement: md`$= |\mathbf{u}|^2 + |\mathbf{v}|^2 - 2\,\mathbf{u} \cdot \mathbf{v}$`, reason: md`$u_1^2 + u_2^2 = |\mathbf{u}|^2$, and the definition of the dot product` },
            { statement: md`$|\mathbf{u}|^2 + |\mathbf{v}|^2 - 2\,\mathbf{u} \cdot \mathbf{v} = |\mathbf{u}|^2 + |\mathbf{v}|^2 - 2|\mathbf{u}|\,|\mathbf{v}|\cos\theta$`, reason: "Steps 1 and 4 are both equal to the same square" },
            { statement: md`$\mathbf{u} \cdot \mathbf{v} = |\mathbf{u}|\,|\mathbf{v}|\cos\theta$`, reason: md`Subtract $|\mathbf{u}|^2 + |\mathbf{v}|^2$ from both sides and divide by $-2$` },
          ],
        },
        {
          kind: "key",
          title: "Angle between vectors",
          body: md`$$\cos\theta = \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{u}|\,|\mathbf{v}|}, \qquad 0^\circ \le \theta \le 180^\circ.$$
- $\mathbf{u} \cdot \mathbf{v} = 0$ exactly when the vectors are **perpendicular** (orthogonal).
- $\mathbf{u} \cdot \mathbf{v} > 0$ means an acute angle, $< 0$ an obtuse one.
- $\mathbf{u}$ and $\mathbf{v}$ are **parallel** when one is a scalar multiple of the other; then $\cos\theta = \pm 1$.`,
        },
        {
          kind: "why",
          title: "Why zero dot product means perpendicular",
          body: md`$|\mathbf{u}|$ and $|\mathbf{v}|$ are positive for nonzero vectors, so $\mathbf{u} \cdot \mathbf{v} = |\mathbf{u}|\,|\mathbf{v}|\cos\theta$ is zero exactly when $\cos\theta = 0$, and between $0^\circ$ and $180^\circ$ that happens only at $\theta = 90^\circ$. The test is purely arithmetic: $\langle 2, 3 \rangle \cdot \langle -3, 2 \rangle = -6 + 6 = 0$, so those are perpendicular, no picture needed. (Swap the components and flip one sign: that always makes a perpendicular vector.)`,
        },
        {
          kind: "example",
          title: "The angle between two vectors",
          problem: md`Find the angle between $\mathbf{u} = \langle 1, 2 \rangle$ and $\mathbf{v} = \langle 3, 1 \rangle$.`,
          steps: [
            { math: md`\mathbf{u} \cdot \mathbf{v} = 1 \cdot 3 + 2 \cdot 1 = 5`, note: "" },
            { math: md`|\mathbf{u}| = \sqrt{5}, \qquad |\mathbf{v}| = \sqrt{10}`, note: "" },
            { math: md`\cos\theta = \frac{5}{\sqrt{5}\sqrt{10}} = \frac{5}{\sqrt{50}} = \frac{5}{5\sqrt{2}} = \frac{1}{\sqrt{2}}`, note: "" },
            { math: md`\theta = 45^\circ`, note: md`$\cos 45^\circ = \frac{\sqrt{2}}{2} = \frac{1}{\sqrt{2}}$. Most pairs of vectors won't give a special angle; then use $\arccos$ and round.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $k$ so that $\langle k, 6 \rangle$ is perpendicular to $\langle 4, -3 \rangle$. Fractions are fine, like 7/2.`,
          answer: "9/2",
          explain: md`Dot product zero: $4k + 6(-3) = 0$, so $4k = 18$ and $k = \frac{9}{2}$.`,
        },
      ],
      practice: [vectorBasics, vectorArithmetic, dotProducts],
    },
    {
      id: slug("Complex numbers in polar form"),
      title: "Complex numbers in polar form",
      summary: "A complex number as a length and an angle, and why multiplying complex numbers rotates and scales.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 2 the complex number $a + bi$ became the point $(a, b)$ in the complex plane, with real part across and imaginary part up, and its **modulus** $|a + bi| = \sqrt{a^2 + b^2}$ was its distance from 0. Lesson 1 gave every point a distance and an angle. Apply that to $(a, b)$ and complex multiplication, which looked like bookkeeping in rectangular form, turns into geometry.`,
        },
        {
          kind: "key",
          title: "Polar (trigonometric) form",
          body: md`Every nonzero complex number can be written
$$z = r(\cos\theta + i\sin\theta),$$
where $r = |z| = \sqrt{a^2 + b^2} > 0$ is the modulus and $\theta$, the **argument** of $z$, is the polar angle of the point $(a, b)$. Then $a = r\cos\theta$ and $b = r\sin\theta$. Like any polar angle, $\theta$ is only determined up to multiples of $2\pi$; we usually pick $0 \le \theta < 2\pi$.`,
        },
        {
          kind: "why",
          title: "Why it's exactly polar coordinates",
          body: md`If the point $(a, b)$ has polar coordinates $(r, \theta)$ with $r > 0$, Lesson 1 says $a = r\cos\theta$ and $b = r\sin\theta$. Substitute:
$$a + bi = r\cos\theta + (r\sin\theta)i = r(\cos\theta + i\sin\theta).$$
Factoring out $r$ shows the shape of every complex number: a positive length times a point on the unit circle. The unit-circle part, $\cos\theta + i\sin\theta$, carries the direction and has modulus $\sqrt{\cos^2\theta + \sin^2\theta} = 1$.`,
        },
        {
          kind: "diagram",
          view: [-2.6, 2.2, -1.2, 2.6],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "0", dir: "se" },
            { name: "Z", x: -1, y: SQ3, label: "z = -1 + \\sqrt{3}i", dir: "n" },
            { name: "X", x: 1.5, y: 0, label: "", hidden: true },
            { name: "F", x: -1, y: 0, label: "", hidden: true },
          ],
          segments: [
            { from: "O", to: "Z", arrow: true, color: 1, label: "r = 2" },
            { from: "Z", to: "F", dashed: true, label: "\\sqrt{3}" },
            { from: "F", to: "O", dashed: true, label: "1" },
          ],
          angles: [{ at: "O", from: "X", to: "Z", label: "\\tfrac{2\\pi}{3}", color: 2 }],
          caption: md`$-1 + \sqrt{3}i$ is 2 units from 0 at an angle of $\frac{2\pi}{3}$: $-1 + \sqrt{3}i = 2\left(\cos\frac{2\pi}{3} + i\sin\frac{2\pi}{3}\right)$.`,
        },
        {
          kind: "example",
          title: "Rectangular to polar form",
          problem: md`Write $z = -1 + \sqrt{3}i$ in polar form.`,
          steps: [
            { math: md`r = \sqrt{(-1)^2 + (\sqrt{3})^2} = \sqrt{4} = 2`, note: "The modulus." },
            { math: md`\tan\theta_{\text{ref}} = \frac{\sqrt{3}}{1} \;\Rightarrow\; \theta_{\text{ref}} = \frac{\pi}{3}`, note: "" },
            { math: md`\theta = \pi - \frac{\pi}{3} = \frac{2\pi}{3}`, note: md`$(-1, \sqrt{3})$ is in quadrant II.` },
            { math: md`z = 2\left(\cos\tfrac{2\pi}{3} + i\sin\tfrac{2\pi}{3}\right)`, note: md`Check: $2\cos\frac{2\pi}{3} = -1$ and $2\sin\frac{2\pi}{3} = \sqrt{3}$.` },
          ],
        },
        {
          kind: "example",
          title: "Polar to rectangular form",
          problem: md`Write $6\left(\cos\frac{7\pi}{6} + i\sin\frac{7\pi}{6}\right)$ in the form $a + bi$.`,
          steps: [
            { math: md`\cos\tfrac{7\pi}{6} = -\tfrac{\sqrt{3}}{2}, \qquad \sin\tfrac{7\pi}{6} = -\tfrac{1}{2}`, note: md`Reference angle $\frac{\pi}{6}$ in quadrant III, where both are negative.` },
            { math: md`6\left(-\tfrac{\sqrt{3}}{2} - \tfrac{1}{2}i\right) = -3\sqrt{3} - 3i`, note: "Distribute the 6." },
          ],
        },
        {
          kind: "check",
          prompt: md`Write $1 - i$ in polar form. Give $(r, \theta)$ with $0 \le \theta < 2\pi$, typed like (2, 5pi/6).`,
          answer: "(sqrt(2), 7pi/4)",
          form: "tuple",
          explain: md`$r = \sqrt{1 + 1} = \sqrt{2}$. The point $(1, -1)$ is in quadrant IV with reference angle $\frac{\pi}{4}$, so $\theta = 2\pi - \frac{\pi}{4} = \frac{7\pi}{4}$.`,
        },
        {
          kind: "text",
          body: md`In rectangular form, $(a + bi)(c + di) = (ac - bd) + (ad + bc)i$. Correct, but it says nothing about where the product lands. Write both factors in polar form and multiply them out instead. The sum formulas from Unit 5 do something remarkable.`,
        },
        {
          kind: "proof",
          title: "Multiplying in polar form",
          given: md`$z_1 = r_1(\cos\theta_1 + i\sin\theta_1)$ and $z_2 = r_2(\cos\theta_2 + i\sin\theta_2)$`,
          prove: md`$z_1 z_2 = r_1 r_2\left[\cos(\theta_1 + \theta_2) + i\sin(\theta_1 + \theta_2)\right]$`,
          steps: [
            { statement: md`$z_1 z_2 = r_1 r_2(\cos\theta_1 + i\sin\theta_1)(\cos\theta_2 + i\sin\theta_2)$`, reason: "Multiplication is commutative and associative; gather the moduli" },
            { statement: md`$= r_1 r_2\left[\cos\theta_1\cos\theta_2 + i\cos\theta_1\sin\theta_2 + i\sin\theta_1\cos\theta_2 + i^2\sin\theta_1\sin\theta_2\right]$`, reason: "Distribute (FOIL)" },
            { statement: md`$= r_1 r_2\left[(\cos\theta_1\cos\theta_2 - \sin\theta_1\sin\theta_2) + i(\sin\theta_1\cos\theta_2 + \cos\theta_1\sin\theta_2)\right]$`, reason: md`$i^2 = -1$; group real and imaginary parts` },
            { statement: md`$= r_1 r_2\left[\cos(\theta_1 + \theta_2) + i\sin(\theta_1 + \theta_2)\right]$`, reason: md`Sum formulas (Unit 5): $\cos(A + B) = \cos A\cos B - \sin A\sin B$ and $\sin(A + B) = \sin A\cos B + \cos A\sin B$` },
          ],
        },
        {
          kind: "key",
          title: "Products and quotients in polar form",
          body: md`To multiply, **multiply the moduli and add the arguments**. To divide, **divide the moduli and subtract the arguments**:
$$z_1 z_2 = r_1 r_2\left[\cos(\theta_1 + \theta_2) + i\sin(\theta_1 + \theta_2)\right], \qquad \frac{z_1}{z_2} = \frac{r_1}{r_2}\left[\cos(\theta_1 - \theta_2) + i\sin(\theta_1 - \theta_2)\right].$$
Geometrically, multiplying by $z_2$ rotates by $\theta_2$ and stretches by $r_2$.`,
        },
        {
          kind: "why",
          title: "Why the quotient rule follows from the product rule",
          body: md`Call the quotient $w = \frac{z_1}{z_2}$, so $z_2 w = z_1$. By the product rule, $z_2 w$ has modulus $r_2|w|$ and argument $\theta_2 + \arg w$. For this to be $z_1$ we need $r_2|w| = r_1$ and $\theta_2 + \arg w = \theta_1$, so $|w| = \frac{r_1}{r_2}$ and $\arg w = \theta_1 - \theta_2$. No conjugates, no second FOIL: division is just the multiplication rule read backwards.`,
        },
        {
          kind: "diagram",
          view: [-4.2, 4.2, -4.2, 4.2],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "Z", x: 1, y: 1, label: "z = 1 + i", dir: "se" },
            { name: "W", x: "s cos(p)", y: "s sin(p)", label: "w", dir: "ne" },
            { name: "P", x: "s sqrt(2) cos(p + pi/4)", y: "s sqrt(2) sin(p + pi/4)", label: "zw", dir: "ne" },
          ],
          circles: [{ center: "O", radius: 1, dashed: true }],
          segments: [
            { from: "O", to: "Z", arrow: true, color: 1 },
            { from: "O", to: "W", arrow: true, color: 2 },
            { from: "O", to: "P", arrow: true, color: 3 },
          ],
          params: [
            { name: "s", tex: "|w|", min: 0.5, max: 2.5, step: 0.25, value: 1.5 },
            { name: "p", tex: "\\arg w", min: 0, max: 6.2832, step: Math.PI / 12, value: Math.PI / 3 },
          ],
          readouts: [
            { label: "|zw| = \\sqrt{2}\\,|w|", value: "s sqrt(2)" },
            { label: "\\arg(zw) = \\tfrac{\\pi}{4} + \\arg w", value: "p + pi/4" },
          ],
          caption: md`$z = 1 + i$ has modulus $\sqrt{2}$ and argument $\frac{\pi}{4}$. Slide the modulus and argument of $w$: the product $zw$ is always $w$ turned by $\frac{\pi}{4}$ and stretched by $\sqrt{2}$.`,
        },
        {
          kind: "example",
          title: "A product in polar form",
          problem: md`Multiply $2\left(\cos\frac{\pi}{12} + i\sin\frac{\pi}{12}\right)$ by $3\left(\cos\frac{\pi}{6} + i\sin\frac{\pi}{6}\right)$ and write the result in $a + bi$ form.`,
          steps: [
            { math: md`2 \cdot 3\left[\cos\left(\tfrac{\pi}{12} + \tfrac{\pi}{6}\right) + i\sin\left(\tfrac{\pi}{12} + \tfrac{\pi}{6}\right)\right]`, note: "Multiply moduli, add arguments." },
            { math: md`= 6\left(\cos\tfrac{\pi}{4} + i\sin\tfrac{\pi}{4}\right)`, note: md`$\frac{\pi}{12} + \frac{2\pi}{12} = \frac{3\pi}{12}$.` },
            { math: md`= 6\left(\tfrac{\sqrt{2}}{2} + \tfrac{\sqrt{2}}{2}i\right) = 3\sqrt{2} + 3\sqrt{2}\,i`, note: md`Neither factor had a nice rectangular form, but the product does.` },
          ],
        },
        {
          kind: "why",
          title: "Why i² = −1, geometrically",
          body: md`$i = \cos\frac{\pi}{2} + i\sin\frac{\pi}{2}$: modulus 1, argument $\frac{\pi}{2}$. So multiplying by $i$ rotates a quarter turn and changes no lengths. Two quarter turns make a half turn, and a half turn sends 1 to $-1$. That is $i^2 = -1$, seen rather than decreed. Likewise $i^3 = -i$ (three quarter turns) and $i^4 = 1$, the cycle you met in Algebra 2.`,
        },
        {
          kind: "check",
          prompt: md`Compute $\dfrac{8\left(\cos\frac{5\pi}{6} + i\sin\frac{5\pi}{6}\right)}{2\left(\cos\frac{\pi}{3} + i\sin\frac{\pi}{3}\right)}$ and give it in $a + bi$ form.`,
          answer: "4i",
          complex: true,
          simplified: true,
          explain: md`Divide moduli: $8/2 = 4$. Subtract arguments: $\frac{5\pi}{6} - \frac{\pi}{3} = \frac{\pi}{2}$. So the quotient is $4\left(\cos\frac{\pi}{2} + i\sin\frac{\pi}{2}\right) = 4(0 + i) = 4i$.`,
        },
      ],
      practice: [toPolarForm, polarToRectangular, productsQuotients],
    },
    {
      id: slug("De Moivre's theorem"),
      title: "De Moivre's theorem",
      summary: "Powers of a complex number by repeated rotation, proved by induction, and all n of the nth roots of any complex number.",
      blocks: [
        {
          kind: "text",
          body: md`Let $z = r(\cos\theta + i\sin\theta)$. The product rule with $z_1 = z_2 = z$ gives
$$z^2 = r^2(\cos 2\theta + i\sin 2\theta).$$
Multiply by $z$ once more: moduli $r^2 \cdot r = r^3$, arguments $2\theta + \theta = 3\theta$, so $z^3 = r^3(\cos 3\theta + i\sin 3\theta)$. Each extra factor of $z$ adds another $\theta$ to the angle and another factor $r$ to the length. The pattern is clear. Proving it for *every* exponent needs induction.`,
        },
        {
          kind: "key",
          title: "De Moivre's theorem",
          body: md`For every positive integer $n$,
$$\left[r(\cos\theta + i\sin\theta)\right]^n = r^n\left(\cos n\theta + i\sin n\theta\right).$$`,
        },
        {
          kind: "proof",
          title: "De Moivre's theorem, by induction",
          given: md`$z = r(\cos\theta + i\sin\theta)$`,
          prove: md`$z^n = r^n(\cos n\theta + i\sin n\theta)$ for every positive integer $n$`,
          steps: [
            { statement: md`For $n = 1$: $z^1 = r^1(\cos 1\theta + i\sin 1\theta)$`, reason: "Base case: this is just $z$ itself" },
            { statement: md`Suppose $z^k = r^k(\cos k\theta + i\sin k\theta)$ for some positive integer $k$`, reason: "Induction hypothesis" },
            { statement: md`$z^{k+1} = z^k \cdot z = r^k(\cos k\theta + i\sin k\theta) \cdot r(\cos\theta + i\sin\theta)$`, reason: "Definition of powers, then the hypothesis" },
            { statement: md`$= r^k r\left[\cos(k\theta + \theta) + i\sin(k\theta + \theta)\right]$`, reason: "Product rule (Lesson 3): multiply moduli, add arguments" },
            { statement: md`$= r^{k+1}\left[\cos(k + 1)\theta + i\sin(k + 1)\theta\right]$`, reason: "Laws of exponents and the distributive property" },
            { statement: md`$z^n = r^n(\cos n\theta + i\sin n\theta)$ for all positive integers $n$`, reason: "Principle of mathematical induction: true for 1, and true for $k$ forces true for $k + 1$" },
          ],
        },
        {
          kind: "why",
          title: "What the induction really says",
          body: md`The pattern "and so on" is where hand-waving usually hides. Induction replaces it with two checks. The base case shows the first rung of the ladder is solid. The inductive step shows that from *any* rung you can reach the next: if the formula holds for $k$, one more multiplication (one more rotation by $\theta$, one more stretch by $r$) makes it hold for $k + 1$. Those two facts together reach every rung: $1$ gives $2$, $2$ gives $3$, and no exponent is ever skipped.

Geometrically, $z^n$ is the point you reach by turning through $\theta$ $n$ times and scaling by $r$ $n$ times. With $r > 1$ the powers spiral outward; with $r < 1$ they spiral in; with $r = 1$ they walk around the unit circle.`,
        },
        {
          kind: "diagram",
          view: [-2.7, 2.7, -2.7, 2.7],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "A", x: "r cos(t)", y: "r sin(t)", label: "z", dir: "ne" },
            { name: "B", x: "r^2 cos(2t)", y: "r^2 sin(2t)", label: "z^2", dir: "ne" },
            { name: "C", x: "r^3 cos(3t)", y: "r^3 sin(3t)", label: "z^3", dir: "ne" },
            { name: "D", x: "r^4 cos(4t)", y: "r^4 sin(4t)", label: "z^4", dir: "ne" },
            { name: "E", x: "r^5 cos(5t)", y: "r^5 sin(5t)", label: "z^5", dir: "ne" },
          ],
          circles: [{ center: "O", radius: 1, dashed: true }],
          segments: [
            { from: "O", to: "A", arrow: true, color: 1 },
            { from: "O", to: "B", arrow: true, color: 2 },
            { from: "O", to: "C", arrow: true, color: 3 },
            { from: "O", to: "D", arrow: true, color: 4 },
            { from: "O", to: "E", arrow: true, color: 1 },
            { from: "A", to: "B", dashed: true },
            { from: "B", to: "C", dashed: true },
            { from: "C", to: "D", dashed: true },
            { from: "D", to: "E", dashed: true },
          ],
          params: [
            { name: "r", tex: "r = |z|", min: 0.8, max: 1.2, step: 0.05, value: 1.15 },
            { name: "t", tex: "\\theta = \\arg z", min: 0, max: 1.5708, step: Math.PI / 24, value: Math.PI / 6 },
          ],
          readouts: [
            { label: "|z^5| = r^5", value: "r^5" },
            { label: "\\arg z^5 = 5\\theta", value: "5t" },
          ],
          caption: md`The first five powers of $z$. Each one is the previous one turned by $\theta$ and stretched by $r$. Set $r = 1$ to see them march around the unit circle.`,
        },
        {
          kind: "example",
          title: "A power that collapses",
          problem: md`Compute $(1 + i)^8$.`,
          steps: [
            { math: md`1 + i = \sqrt{2}\left(\cos\tfrac{\pi}{4} + i\sin\tfrac{\pi}{4}\right)`, note: md`Modulus $\sqrt{1 + 1}$, argument $\frac{\pi}{4}$ (quadrant I, reference angle $\frac{\pi}{4}$).` },
            { math: md`(1 + i)^8 = (\sqrt{2})^8\left(\cos\tfrac{8\pi}{4} + i\sin\tfrac{8\pi}{4}\right)`, note: "De Moivre." },
            { math: md`= 16(\cos 2\pi + i\sin 2\pi) = 16`, note: md`$(\sqrt{2})^8 = 2^4 = 16$, and eight turns of $\frac{\pi}{4}$ make exactly one full turn.` },
          ],
        },
        {
          kind: "example",
          title: "Reducing the angle",
          problem: md`Compute $(\sqrt{3} - i)^5$ in $a + bi$ form.`,
          steps: [
            { math: md`\sqrt{3} - i = 2\left(\cos\tfrac{11\pi}{6} + i\sin\tfrac{11\pi}{6}\right)`, note: md`Modulus $\sqrt{3 + 1} = 2$; the point $(\sqrt{3}, -1)$ is in quadrant IV with reference angle $\frac{\pi}{6}$.` },
            { math: md`(\sqrt{3} - i)^5 = 2^5\left(\cos\tfrac{55\pi}{6} + i\sin\tfrac{55\pi}{6}\right)`, note: "De Moivre." },
            { math: md`\tfrac{55\pi}{6} - 8\pi = \tfrac{55\pi - 48\pi}{6} = \tfrac{7\pi}{6}`, note: "Subtract four full turns to get an angle you recognise." },
            { math: md`32\left(\cos\tfrac{7\pi}{6} + i\sin\tfrac{7\pi}{6}\right) = 32\left(-\tfrac{\sqrt{3}}{2} - \tfrac{1}{2}i\right) = -16\sqrt{3} - 16i`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`Compute $(1 - i)^6$. Give the answer in $a + bi$ form.`,
          answer: "8i",
          complex: true,
          simplified: true,
          explain: md`$1 - i = \sqrt{2}\left(\cos\frac{7\pi}{4} + i\sin\frac{7\pi}{4}\right)$. Then $(\sqrt{2})^6 = 8$ and $6 \cdot \frac{7\pi}{4} = \frac{21\pi}{2} = 10\pi + \frac{\pi}{2}$, so the result is $8\left(\cos\frac{\pi}{2} + i\sin\frac{\pi}{2}\right) = 8i$.`,
        },
        {
          kind: "text",
          body: md`Now run the theorem backwards. An **$n$th root** of $z$ is a complex number $w$ with $w^n = z$. Every positive real number has one positive square root; among complex numbers, $4$ has two square roots, $2$ and $-2$, and De Moivre tells us $8i$ has three cube roots. Here is how to find all of them.`,
        },
        {
          kind: "key",
          title: "The n nth roots",
          body: md`If $z = r(\cos\theta + i\sin\theta) \ne 0$, then $z$ has exactly $n$ distinct $n$th roots:
$$w_k = \sqrt[n]{r}\left(\cos\frac{\theta + 2\pi k}{n} + i\sin\frac{\theta + 2\pi k}{n}\right), \qquad k = 0, 1, \dots, n - 1,$$
where $\sqrt[n]{r}$ is the positive real root. They all lie on the circle of radius $\sqrt[n]{r}$, equally spaced $\frac{2\pi}{n}$ apart: the vertices of a regular $n$-gon.`,
        },
        {
          kind: "why",
          title: "Where the formula comes from",
          body: md`Look for $w = s(\cos\varphi + i\sin\varphi)$ with $s > 0$. By De Moivre, $w^n = s^n(\cos n\varphi + i\sin n\varphi)$. For this to equal $r(\cos\theta + i\sin\theta)$ we need two things.

**Same modulus:** $s^n = r$, so $s = \sqrt[n]{r}$. A positive real number has exactly one positive $n$th root, so the modulus of every root is the same.

**Same direction:** the angles $n\varphi$ and $\theta$ must point the same way, which means they differ by a whole number of turns: $n\varphi = \theta + 2\pi k$ for some integer $k$. So $\varphi = \frac{\theta + 2\pi k}{n}$.

Every integer $k$ gives a root, but not a new one each time. Stepping $k$ up by 1 adds $\frac{2\pi}{n}$ to $\varphi$; after $n$ steps you have added $2\pi$, a full turn, and are back at $w_0$. So $k = 0, 1, \dots, n - 1$ give $n$ different directions and everything after repeats. That is why there are exactly $n$ roots, no more and no fewer.`,
        },
        {
          kind: "diagram",
          view: [-3, 3, -3, 2.6],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "A", x: SQ3, y: 1, label: "\\sqrt{3} + i", dir: "ne" },
            { name: "B", x: -SQ3, y: 1, label: "-\\sqrt{3} + i", dir: "nw" },
            { name: "C", x: 0, y: -2, label: "-2i", dir: "s" },
          ],
          circles: [{ center: "O", radius: 2, dashed: true }],
          segments: [
            { from: "O", to: "A", arrow: true, color: 1 },
            { from: "O", to: "B", arrow: true, color: 2 },
            { from: "O", to: "C", arrow: true, color: 3 },
          ],
          polygons: [{ points: ["A", "B", "C"], dashed: true }],
          angles: [
            { at: "O", from: "A", to: "B", label: "\\tfrac{2\\pi}{3}" },
            { at: "O", from: "B", to: "C", label: "\\tfrac{2\\pi}{3}" },
          ],
          caption: md`The three cube roots of $8i$: all on the circle of radius $\sqrt[3]{8} = 2$, spaced $\frac{2\pi}{3}$ apart, forming an equilateral triangle.`,
        },
        {
          kind: "example",
          title: "The cube roots of 8i",
          problem: md`Find all cube roots of $8i$ in $a + bi$ form.`,
          steps: [
            { math: md`8i = 8\left(\cos\tfrac{\pi}{2} + i\sin\tfrac{\pi}{2}\right)`, note: md`$|8i| = 8$ and $8i$ points straight up.` },
            { math: md`s = \sqrt[3]{8} = 2, \qquad \varphi_k = \frac{\frac{\pi}{2} + 2\pi k}{3} = \frac{\pi}{6} + \frac{2\pi k}{3}`, note: "The root formula." },
            { math: md`k = 0: \; 2\left(\cos\tfrac{\pi}{6} + i\sin\tfrac{\pi}{6}\right) = \sqrt{3} + i`, note: "" },
            { math: md`k = 1: \; 2\left(\cos\tfrac{5\pi}{6} + i\sin\tfrac{5\pi}{6}\right) = -\sqrt{3} + i`, note: md`$\frac{\pi}{6} + \frac{2\pi}{3} = \frac{5\pi}{6}$.` },
            { math: md`k = 2: \; 2\left(\cos\tfrac{3\pi}{2} + i\sin\tfrac{3\pi}{2}\right) = -2i`, note: md`$\frac{\pi}{6} + \frac{4\pi}{3} = \frac{9\pi}{6} = \frac{3\pi}{2}$. Check: $(-2i)^3 = -8i^3 = -8(-i) = 8i$.` },
          ],
        },
        {
          kind: "text",
          body: md`The $n$th roots of 1 are called the **roots of unity**. Since $1 = \cos 0 + i\sin 0$, they are $\cos\frac{2\pi k}{n} + i\sin\frac{2\pi k}{n}$: the vertices of a regular $n$-gon on the unit circle, starting at 1. The square roots of 1 are $\pm 1$; the fourth roots are $1, i, -1, -i$.

Algebra 2 promised that $w^n - z = 0$, a polynomial equation of degree $n$, has exactly $n$ complex solutions. Here they are, written out, with a picture.`,
        },
        {
          kind: "check",
          prompt: md`Find both square roots of $2i$. Give them in $a + bi$ form, separated by a comma.`,
          answer: "1 + i, -1 - i",
          form: "set",
          complex: true,
          simplified: true,
          explain: md`$2i = 2\left(\cos\frac{\pi}{2} + i\sin\frac{\pi}{2}\right)$. The roots have modulus $\sqrt{2}$ and arguments $\frac{\pi}{4}$ and $\frac{\pi}{4} + \pi = \frac{5\pi}{4}$: $\sqrt{2}\left(\frac{\sqrt{2}}{2} + \frac{\sqrt{2}}{2}i\right) = 1 + i$ and its opposite, $-1 - i$. Check: $(1 + i)^2 = 1 + 2i + i^2 = 2i$.`,
        },
      ],
      practice: [deMoivrePowers, nthRoots, rootInPolar],
    },
  ],
};
