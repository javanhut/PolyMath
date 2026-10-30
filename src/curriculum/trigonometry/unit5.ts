import { frac, fracTex, type Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

/** How to type a trig answer. Functions need parentheses: "cot t" with a space is read as words, and sin(t)^2 means sin(t^2). */
const TYPE = "Type functions with parentheses, like cos(t) or sin(2t); write a square as (sin(t))^2.";
const EXACT = "Give the exact value with square roots, like (sqrt(6) - sqrt(2))/4, in simplest form.";

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Pythagorean triples [a, b, c] with a^2 + b^2 = c^2. */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [5, 12, 13],
  [12, 5, 13],
  [8, 15, 17],
  [15, 8, 17],
  [7, 24, 25],
  [24, 7, 25],
  [20, 21, 29],
  [9, 40, 41],
];

const QUADRANT = ["I", "II", "III", "IV"] as const;
/** Signs of (cos, sin) in each quadrant. */
const SIGNS: [number, number][] = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

/**
 * An angle in quadrant q (0-3) whose terminal point is at (x, y) with x, y > 0 before signs,
 * written as an expression the checker can evaluate: atan(y/x) plus pi when cos is negative.
 */
function angleExpr(q: number, x: number, y: number): string {
  const [sx, sy] = SIGNS[q]!;
  return `(atan(${sy * y}/${sx * x})${sx < 0 ? " + pi" : ""})`;
}

/** A signed fraction as LaTeX. */
const ftex = (n: number, d: number) => fracTex(n, d);

// ── Lesson 1 generators ─────────────────────────────────────────────────────

/** Simplify to a single trig function (or a constant) using the Pythagorean identities. */
const simplifyPythagorean: Generator = (r) => {
  const level = r.int(0, 2);
  type Item = { tex: string; answer: string; steps: Step[]; hint: string };
  const easy: Item[] = [
    {
      tex: md`1 - \cos^2 t`,
      answer: "(sin(t))^2",
      hint: md`Start from $\sin^2 t + \cos^2 t = 1$ and move the cosine term.`,
      steps: [{ math: md`1 - \cos^2 t = \sin^2 t`, note: md`Subtract $\cos^2 t$ from both sides of $\sin^2 t + \cos^2 t = 1$.` }],
    },
    {
      tex: md`1 - \sin^2 t`,
      answer: "(cos(t))^2",
      hint: md`Start from $\sin^2 t + \cos^2 t = 1$ and move the sine term.`,
      steps: [{ math: md`1 - \sin^2 t = \cos^2 t`, note: md`Subtract $\sin^2 t$ from both sides of the Pythagorean identity.` }],
    },
    {
      tex: md`\sec^2 t - 1`,
      answer: "(tan(t))^2",
      hint: md`Which identity has $\sec^2 t$ in it?`,
      steps: [{ math: md`\sec^2 t - 1 = \tan^2 t`, note: md`From $1 + \tan^2 t = \sec^2 t$, subtract 1.` }],
    },
    {
      tex: md`\csc^2 t - 1`,
      answer: "(cot(t))^2",
      hint: md`Which identity has $\csc^2 t$ in it?`,
      steps: [{ math: md`\csc^2 t - 1 = \cot^2 t`, note: md`From $1 + \cot^2 t = \csc^2 t$, subtract 1.` }],
    },
    {
      tex: md`\tan t \cdot \cos t`,
      answer: "sin(t)",
      hint: md`Write $\tan t$ as $\frac{\sin t}{\cos t}$.`,
      steps: [
        { math: md`\frac{\sin t}{\cos t} \cdot \cos t`, note: "Quotient identity." },
        { math: md`\sin t`, note: "The cosines cancel." },
      ],
    },
    {
      tex: md`\cot t \cdot \sin t`,
      answer: "cos(t)",
      hint: md`Write $\cot t$ as $\frac{\cos t}{\sin t}$.`,
      steps: [
        { math: md`\frac{\cos t}{\sin t} \cdot \sin t`, note: "Quotient identity." },
        { math: md`\cos t`, note: "The sines cancel." },
      ],
    },
    {
      tex: md`\frac{\sin t}{\tan t}`,
      answer: "cos(t)",
      hint: md`Dividing by $\tan t$ is multiplying by $\frac{\cos t}{\sin t}$.`,
      steps: [
        { math: md`\sin t \cdot \frac{\cos t}{\sin t}`, note: "Dividing by a fraction is multiplying by its reciprocal." },
        { math: md`\cos t`, note: "Cancel." },
      ],
    },
    {
      tex: md`\sec t \cdot \cot t`,
      answer: "csc(t)",
      hint: "Write both in terms of sine and cosine.",
      steps: [
        { math: md`\frac{1}{\cos t} \cdot \frac{\cos t}{\sin t}`, note: "Reciprocal and quotient identities." },
        { math: md`\frac{1}{\sin t} = \csc t`, note: "Cancel the cosines." },
      ],
    },
  ];
  const medium: Item[] = [
    {
      tex: md`\frac{1 - \sin^2 t}{\cos t}`,
      answer: "cos(t)",
      hint: md`The numerator is a Pythagorean identity in disguise.`,
      steps: [
        { math: md`\frac{\cos^2 t}{\cos t}`, note: md`$1 - \sin^2 t = \cos^2 t$.` },
        { math: md`\cos t`, note: "Cancel one cosine." },
      ],
    },
    {
      tex: md`\frac{1 - \cos^2 t}{\sin t}`,
      answer: "sin(t)",
      hint: md`The numerator is a Pythagorean identity in disguise.`,
      steps: [
        { math: md`\frac{\sin^2 t}{\sin t}`, note: md`$1 - \cos^2 t = \sin^2 t$.` },
        { math: md`\sin t`, note: "Cancel one sine." },
      ],
    },
    {
      tex: md`\csc^2 t - \cot^2 t`,
      answer: "1",
      hint: md`Rearrange $1 + \cot^2 t = \csc^2 t$.`,
      steps: [{ math: md`\csc^2 t - \cot^2 t = 1`, note: md`Subtract $\cot^2 t$ from both sides of $1 + \cot^2 t = \csc^2 t$.` }],
    },
    {
      tex: md`(1 - \cos t)(1 + \cos t)`,
      answer: "(sin(t))^2",
      hint: "Multiply out: it is a difference of squares.",
      steps: [
        { math: md`1 - \cos^2 t`, note: md`$(1 - c)(1 + c) = 1 - c^2$.` },
        { math: md`\sin^2 t`, note: "Pythagorean identity." },
      ],
    },
    {
      tex: md`(\sec t - 1)(\sec t + 1)`,
      answer: "(tan(t))^2",
      hint: "Multiply out: it is a difference of squares.",
      steps: [
        { math: md`\sec^2 t - 1`, note: "Difference of squares." },
        { math: md`\tan^2 t`, note: md`$1 + \tan^2 t = \sec^2 t$.` },
      ],
    },
    {
      tex: md`\frac{\sec^2 t - 1}{\tan t}`,
      answer: "tan(t)",
      hint: md`Replace $\sec^2 t - 1$ first.`,
      steps: [
        { math: md`\frac{\tan^2 t}{\tan t}`, note: md`$\sec^2 t - 1 = \tan^2 t$.` },
        { math: md`\tan t`, note: "Cancel." },
      ],
    },
    {
      tex: md`\cos^2 t (1 + \tan^2 t)`,
      answer: "1",
      hint: md`$1 + \tan^2 t$ is a single function squared.`,
      steps: [
        { math: md`\cos^2 t \cdot \sec^2 t`, note: md`$1 + \tan^2 t = \sec^2 t$.` },
        { math: md`\cos^2 t \cdot \frac{1}{\cos^2 t} = 1`, note: "Reciprocal identity." },
      ],
    },
  ];
  const hard: Item[] = [
    {
      tex: md`\sin^4 t - \cos^4 t + \cos^2 t`,
      answer: "(sin(t))^2",
      hint: md`Factor the difference of fourth powers: $(\sin^2 t - \cos^2 t)(\sin^2 t + \cos^2 t)$.`,
      steps: [
        { math: md`(\sin^2 t - \cos^2 t)(\sin^2 t + \cos^2 t) + \cos^2 t`, note: "Difference of squares." },
        { math: md`(\sin^2 t - \cos^2 t)(1) + \cos^2 t`, note: "Pythagorean identity." },
        { math: md`\sin^2 t`, note: "The cosine terms cancel." },
      ],
    },
    {
      tex: md`\frac{\sin t}{1 - \cos^2 t}`,
      answer: "csc(t)",
      hint: md`Replace the denominator with a single square.`,
      steps: [
        { math: md`\frac{\sin t}{\sin^2 t}`, note: md`$1 - \cos^2 t = \sin^2 t$.` },
        { math: md`\frac{1}{\sin t} = \csc t`, note: "Cancel, then use the reciprocal identity." },
      ],
    },
    {
      tex: md`\frac{\tan^2 t}{\sec^2 t}`,
      answer: "(sin(t))^2",
      hint: "Write both in terms of sine and cosine.",
      steps: [
        { math: md`\frac{\sin^2 t}{\cos^2 t} \cdot \cos^2 t`, note: md`$\tan^2 t = \frac{\sin^2 t}{\cos^2 t}$ and dividing by $\sec^2 t$ is multiplying by $\cos^2 t$.` },
        { math: md`\sin^2 t`, note: "Cancel." },
      ],
    },
    {
      tex: md`\frac{\cot t}{\csc t}`,
      answer: "cos(t)",
      hint: "Write both in terms of sine and cosine.",
      steps: [
        { math: md`\frac{\cos t}{\sin t} \cdot \sin t`, note: "Quotient identity, and dividing by a reciprocal." },
        { math: md`\cos t`, note: "Cancel." },
      ],
    },
    {
      tex: md`\sec t - \sin t \tan t`,
      answer: "cos(t)",
      hint: "Put everything over a common denominator of cosine.",
      steps: [
        { math: md`\frac{1}{\cos t} - \frac{\sin^2 t}{\cos t}`, note: md`$\sin t \tan t = \frac{\sin^2 t}{\cos t}$.` },
        { math: md`\frac{1 - \sin^2 t}{\cos t} = \frac{\cos^2 t}{\cos t}`, note: "Combine, then the Pythagorean identity." },
        { math: md`\cos t`, note: "Cancel." },
      ],
    },
    {
      tex: md`\csc t - \cos t \cot t`,
      answer: "sin(t)",
      hint: "Put everything over a common denominator of sine.",
      steps: [
        { math: md`\frac{1}{\sin t} - \frac{\cos^2 t}{\sin t}`, note: md`$\cos t \cot t = \frac{\cos^2 t}{\sin t}$.` },
        { math: md`\frac{1 - \cos^2 t}{\sin t} = \frac{\sin^2 t}{\sin t}`, note: "Combine, then the Pythagorean identity." },
        { math: md`\sin t`, note: "Cancel." },
      ],
    },
  ];
  const item = r.pick(level === 0 ? easy : level === 1 ? medium : hard);
  const single = item.answer !== "1";
  return {
    prompt: md`Simplify $${item.tex}$${single ? " to a single trig function" : ""}. ${TYPE}`,
    answer: item.answer,
    simplified: true,
    hint: item.hint,
    solution: item.steps,
  };
};

/** Given one trig value and the quadrant, find another. */
const otherFunction: Generator = (r) => {
  const [a, b, c] = r.pick(TRIPLES);
  const q = r.int(0, 3);
  const [sx, sy] = SIGNS[q]!;
  // Terminal point (sx b, sy a) on a circle of radius c: sin = sy a / c, cos = sx b / c.
  const sin = [sy * a, c] as const;
  const cos = [sx * b, c] as const;
  const tan = [sy * a, sx * b] as const;
  const sec = [sx * c, b] as const;
  const csc = [sy * c, a] as const;
  const cot = [sx * b, sy * a] as const;
  const T = angleExpr(q, b, a);
  type Fn = { name: string; value: readonly [number, number]; expr: string };
  const fns: Fn[] = [
    { name: "\\sin", value: sin, expr: "sin" },
    { name: "\\cos", value: cos, expr: "cos" },
    { name: "\\tan", value: tan, expr: "tan" },
    { name: "\\sec", value: sec, expr: "sec" },
    { name: "\\csc", value: csc, expr: "csc" },
    { name: "\\cot", value: cot, expr: "cot" },
  ];
  const kind = r.int(0, 2);
  const given = kind === 0 ? fns[0]! : kind === 1 ? fns[1]! : fns[2]!;
  const want = r.pick(fns.filter((f) => f !== given));
  const sinTex = ftex(sin[0], sin[1]);
  const cosTex = ftex(cos[0], cos[1]);
  const steps: Step[] = [];
  if (given.expr === "sin") {
    steps.push({ math: md`\cos^2 t = 1 - \sin^2 t = 1 - ${ftex(a * a, c * c)} = ${ftex(b * b, c * c)}`, note: "Pythagorean identity." });
    steps.push({ math: md`\cos t = ${cosTex}`, note: md`Take the square root. Cosine is ${sx > 0 ? "positive" : "negative"} in quadrant ${QUADRANT[q]}, which fixes the sign.` });
  } else if (given.expr === "cos") {
    steps.push({ math: md`\sin^2 t = 1 - \cos^2 t = 1 - ${ftex(b * b, c * c)} = ${ftex(a * a, c * c)}`, note: "Pythagorean identity." });
    steps.push({ math: md`\sin t = ${sinTex}`, note: md`Take the square root. Sine is ${sy > 0 ? "positive" : "negative"} in quadrant ${QUADRANT[q]}, which fixes the sign.` });
  } else {
    steps.push({ math: md`\sec^2 t = 1 + \tan^2 t = 1 + ${ftex(a * a, b * b)} = ${ftex(c * c, b * b)}`, note: md`$1 + \tan^2 t = \sec^2 t$.` });
    steps.push({ math: md`\sec t = ${ftex(sec[0], sec[1])}, \quad \cos t = ${cosTex}`, note: md`Secant has the sign of cosine, ${sx > 0 ? "positive" : "negative"} in quadrant ${QUADRANT[q]}.` });
    steps.push({ math: md`\sin t = \tan t \cos t = ${ftex(tan[0], tan[1])} \cdot ${cosTex} = ${sinTex}`, note: md`From $\tan t = \frac{\sin t}{\cos t}$.` });
  }
  const final = (f: Fn): Step | null => {
    const v = ftex(f.value[0], f.value[1]);
    switch (f.expr) {
      case "sin":
      case "cos":
        return null;
      case "tan":
        return { math: md`\tan t = \frac{\sin t}{\cos t} = ${v}`, note: "Quotient identity: the common denominators cancel." };
      case "cot":
        return { math: md`\cot t = \frac{\cos t}{\sin t} = ${v}`, note: "Quotient identity." };
      case "sec":
        return { math: md`\sec t = \frac{1}{\cos t} = ${v}`, note: "Reciprocal identity: flip the fraction." };
      default:
        return { math: md`\csc t = \frac{1}{\sin t} = ${v}`, note: "Reciprocal identity: flip the fraction." };
    }
  };
  const last = final(want);
  if (last) steps.push(last);
  return {
    prompt: md`Find $${want.name} t$ when $${given.name} t = ${ftex(given.value[0], given.value[1])}$ and $t$ is in quadrant ${QUADRANT[q]}. Give a fraction.`,
    answer: frac(want.value[0], want.value[1]),
    verify: [`v = ${want.expr}${T}`],
    hint: md`Use $\sin^2 t + \cos^2 t = 1$ ${given.expr === "tan" ? md`(or $1 + \tan^2 t = \sec^2 t$)` : ""} to get the missing square, then let the quadrant choose the sign. In quadrant ${QUADRANT[q]}, cosine is ${sx > 0 ? "positive" : "negative"} and sine is ${sy > 0 ? "positive" : "negative"}.`,
    solution: steps,
  };
};

/** sin t + cos t = k, find sin t cos t: the identity hiding inside a square. */
const sumToProduct: Generator = (r) => {
  const [a, b, c] = r.pick(TRIPLES.filter(([p, q]) => p !== q));
  const minus = r.next() < 0.5;
  // sin t = a/c, cos t = b/c in quadrant I: a true pair of values, so the problem is consistent.
  const k = minus ? a - b : a + b;
  const product = a * b;
  const ktex = ftex(k, c);
  const sq = ftex(k * k, c * c);
  const sign = minus ? "-" : "+";
  return {
    prompt: md`If $\sin t ${sign} \cos t = ${ktex}$, find $\sin t \cos t$. Give a fraction.`,
    answer: frac(product, c * c),
    verify: [`v = sin(atan(${a}/${b})) cos(atan(${a}/${b}))`],
    hint: md`Square both sides. The square of a sum (or difference) contains $\sin^2 t + \cos^2 t$, which you know.`,
    solution: [
      { math: md`(\sin t ${sign} \cos t)^2 = \left(${ktex}\right)^2`, note: "Square both sides." },
      { math: md`\sin^2 t ${minus ? "-" : "+"} 2\sin t \cos t + \cos^2 t = ${sq}`, note: md`$(u ${sign} v)^2 = u^2 ${sign} 2uv + v^2$.` },
      { math: md`1 ${minus ? "-" : "+"} 2\sin t \cos t = ${sq}`, note: md`$\sin^2 t + \cos^2 t = 1$.` },
      { math: md`${minus ? "-" : ""}2\sin t \cos t = ${sq} - 1 = ${ftex(k * k - c * c, c * c)}`, note: "Subtract 1." },
      { math: md`\sin t \cos t = ${ftex(product, c * c)}`, note: md`Divide by ${minus ? "-2" : "2"}.` },
    ],
  };
};

// ── Exact values of the standard angles ─────────────────────────────────────

type Exact = { text: string; tex: string };
const E = (text: string, tex: string): Exact => ({ text, tex });
const ZERO = E("0", "0");
const ONE = E("1", "1");
const HALF = E("1/2", "\\frac{1}{2}");
const R2 = E("sqrt(2)/2", "\\frac{\\sqrt{2}}{2}");
const R3 = E("sqrt(3)/2", "\\frac{\\sqrt{3}}{2}");
const neg = (v: Exact): Exact => {
  if (v.text === "0") return v;
  // A sum like "2 - sqrt(3)" must be wrapped before the minus goes on; "(sqrt(6) + sqrt(2))/4" already is.
  const sum = / [+-] /.test(v.text) && !v.text.startsWith("(");
  return sum ? E(`-(${v.text})`, `-(${v.tex})`) : E(`-${v.text}`, `-${v.tex}`);
};

/** sin, cos and tan of a multiple of 30 or 45 degrees, exactly. tan is null where it is undefined. */
function std(deg: number): { sin: Exact; cos: Exact; tan: Exact | null } {
  const d = ((deg % 360) + 360) % 360;
  const ref = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  const base: Record<number, [Exact, Exact, Exact | null]> = {
    0: [ZERO, ONE, ZERO],
    30: [HALF, R3, E("sqrt(3)/3", "\\frac{\\sqrt{3}}{3}")],
    45: [R2, R2, ONE],
    60: [R3, HALF, E("sqrt(3)", "\\sqrt{3}")],
    90: [ONE, ZERO, null],
  };
  const [s, c, t] = base[ref]!;
  const sPos = d <= 180;
  const cPos = d <= 90 || d >= 270;
  const sin = sPos ? s : neg(s);
  const cos = cPos ? c : neg(c);
  const tan = t === null ? null : sPos === cPos ? t : neg(t);
  return { sin, cos, tan };
}

/** An angle in degrees as a LaTeX multiple of pi. */
function radTex(deg: number): string {
  const f = fracTex(deg, 180);
  if (f === "0") return "0";
  if (f === "1") return "\\pi";
  if (f === "-1") return "-\\pi";
  // "\frac{5}{12}" -> "\frac{5\pi}{12}"; "5" -> "5\pi"
  if (!f.includes("\\frac")) return `${f}\\pi`;
  return f.replace(/\\frac\{(-?\d+)\}/, (_, n: string) => (n === "1" ? "\\frac{\\pi}" : n === "-1" ? "-\\frac{\\pi}" : `\\frac{${n}\\pi}`));
}

/** An angle in degrees as typed radians: "5pi/12". */
function radText(deg: number): string {
  const f = frac(deg, 180);
  return f.includes("/") ? f.replace("/", "pi/") : f === "1" ? "pi" : `${f}pi`;
}

// ── Lesson 2 generators ─────────────────────────────────────────────────────

/** sin, cos or tan of an odd multiple of 15 degrees, from a sum or difference of standard angles. */
const exactSumValue: Generator = (r) => {
  const deg = r.pick([15, 75, 105, 165, 195, 255, 285, 345]);
  const fn = r.pick(["sin", "cos", "tan"] as const);
  const useDegrees = r.next() < 0.5;
  // Reference angle 15 or 75; the quadrant gives the signs.
  const d = deg;
  const ref = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  const sPos = d < 180;
  const cPos = d < 90 || d > 270;
  const big = E("(sqrt(6) + sqrt(2))/4", "\\frac{\\sqrt{6} + \\sqrt{2}}{4}");
  const small = E("(sqrt(6) - sqrt(2))/4", "\\frac{\\sqrt{6} - \\sqrt{2}}{4}");
  const tBig = E("2 + sqrt(3)", "2 + \\sqrt{3}");
  const tSmall = E("2 - sqrt(3)", "2 - \\sqrt{3}");
  const sinV = ref === 15 ? small : big;
  const cosV = ref === 15 ? big : small;
  const tanV = ref === 15 ? tSmall : tBig;
  const value = fn === "sin" ? (sPos ? sinV : neg(sinV)) : fn === "cos" ? (cPos ? cosV : neg(cosV)) : sPos === cPos ? tanV : neg(tanV);
  // Split as A + 45 (or 45 - 30 for 15 degrees) using angles whose values are known.
  const [A, B, op] = deg === 15 ? [45, 30, "-"] : [deg - 45, 45, "+"];
  const a = std(A);
  const b = std(B);
  const angleTex = useDegrees ? `${deg}^\\circ` : `\\left(${radTex(deg)}\\right)`;
  const aTex = useDegrees ? `${A}^\\circ` : radTex(A);
  const bTex = useDegrees ? `${B}^\\circ` : radTex(B);
  const fnTex = `\\${fn}`;
  const steps: Step[] = [{ math: md`${fnTex} ${angleTex} = ${fnTex}(${aTex} ${op} ${bTex})`, note: md`Write the angle as a sum or difference of angles whose values you know.` }];
  if (fn === "sin") {
    const other = op === "+" ? "+" : "-";
    steps.push({ math: md`\sin ${aTex} \cos ${bTex} ${other} \cos ${aTex} \sin ${bTex}`, note: md`$\sin(A ${op} B) = \sin A \cos B ${op} \cos A \sin B$.` });
    steps.push({ math: md`\left(${a.sin.tex}\right)\left(${b.cos.tex}\right) ${other} \left(${a.cos.tex}\right)\left(${b.sin.tex}\right)`, note: "Exact values from the unit circle." });
  } else if (fn === "cos") {
    const other = op === "+" ? "-" : "+";
    steps.push({ math: md`\cos ${aTex} \cos ${bTex} ${other} \sin ${aTex} \sin ${bTex}`, note: md`$\cos(A ${op} B) = \cos A \cos B ${other} \sin A \sin B$: the sign flips.` });
    steps.push({ math: md`\left(${a.cos.tex}\right)\left(${b.cos.tex}\right) ${other} \left(${a.sin.tex}\right)\left(${b.sin.tex}\right)`, note: "Exact values from the unit circle." });
  } else {
    const other = op === "+" ? "-" : "+";
    steps.push({ math: md`\frac{\tan ${aTex} ${op} \tan ${bTex}}{1 ${other} \tan ${aTex} \tan ${bTex}}`, note: md`$\tan(A ${op} B) = \dfrac{\tan A ${op} \tan B}{1 ${other} \tan A \tan B}$.` });
    steps.push({ math: md`\frac{${a.tan!.tex} ${op} ${b.tan!.tex}}{1 ${other} \left(${a.tan!.tex}\right)\left(${b.tan!.tex}\right)}`, note: "Exact values." });
    steps.push({ math: md`${value.tex}`, note: md`Multiply top and bottom by the conjugate of the denominator to clear the root, then simplify.` });
  }
  if (fn !== "tan") steps.push({ math: md`${value.tex}`, note: md`Multiply the fractions: each product has denominator 4, and $\sqrt{2}\sqrt{3} = \sqrt{6}$.` });
  const prompt = useDegrees ? md`Find the exact value of $${fnTex} ${angleTex}$. ${EXACT}` : md`Find the value of $${fnTex}${angleTex}$. ${EXACT}`;
  return {
    prompt,
    answer: value.text,
    simplified: true,
    ...(useDegrees ? { verify: [`v = ${fn}(${deg} pi/180)`] } : {}),
    hint: md`$${useDegrees ? deg : radTex(deg)}${useDegrees ? "^\\circ" : ""} = ${aTex} ${op} ${bTex}$. Use the ${fn === "sin" ? "sine" : fn === "cos" ? "cosine" : "tangent"} ${op === "+" ? "sum" : "difference"} formula.`,
    solution: steps,
  };
};

/** Recognise the right side of a sum formula and collapse it, or simplify a shifted angle. */
const recogniseFormula: Generator = (r) => {
  if (r.next() < 0.35) {
    // Shifted angles: cos(pi - t) and friends.
    const items: { tex: string; answer: string; formula: string; expand: string }[] = [
      { tex: md`\cos(\pi - t)`, answer: "-cos(t)", formula: md`\cos(A - B) = \cos A \cos B + \sin A \sin B`, expand: md`\cos \pi \cos t + \sin \pi \sin t = (-1)\cos t + (0)\sin t` },
      { tex: md`\sin(\pi - t)`, answer: "sin(t)", formula: md`\sin(A - B) = \sin A \cos B - \cos A \sin B`, expand: md`\sin \pi \cos t - \cos \pi \sin t = (0)\cos t - (-1)\sin t` },
      { tex: md`\sin(\pi + t)`, answer: "-sin(t)", formula: md`\sin(A + B) = \sin A \cos B + \cos A \sin B`, expand: md`\sin \pi \cos t + \cos \pi \sin t = (0)\cos t + (-1)\sin t` },
      { tex: md`\cos(\pi + t)`, answer: "-cos(t)", formula: md`\cos(A + B) = \cos A \cos B - \sin A \sin B`, expand: md`\cos \pi \cos t - \sin \pi \sin t = (-1)\cos t - (0)\sin t` },
      { tex: md`\sin\left(\frac{\pi}{2} - t\right)`, answer: "cos(t)", formula: md`\sin(A - B) = \sin A \cos B - \cos A \sin B`, expand: md`\sin \tfrac{\pi}{2} \cos t - \cos \tfrac{\pi}{2} \sin t = (1)\cos t - (0)\sin t` },
      { tex: md`\cos\left(\frac{\pi}{2} - t\right)`, answer: "sin(t)", formula: md`\cos(A - B) = \cos A \cos B + \sin A \sin B`, expand: md`\cos \tfrac{\pi}{2} \cos t + \sin \tfrac{\pi}{2} \sin t = (0)\cos t + (1)\sin t` },
      { tex: md`\cos\left(t + \frac{\pi}{2}\right)`, answer: "-sin(t)", formula: md`\cos(A + B) = \cos A \cos B - \sin A \sin B`, expand: md`\cos t \cos \tfrac{\pi}{2} - \sin t \sin \tfrac{\pi}{2} = \cos t (0) - \sin t (1)` },
      { tex: md`\sin\left(t + \frac{\pi}{2}\right)`, answer: "cos(t)", formula: md`\sin(A + B) = \sin A \cos B + \cos A \sin B`, expand: md`\sin t \cos \tfrac{\pi}{2} + \cos t \sin \tfrac{\pi}{2} = \sin t (0) + \cos t (1)` },
      { tex: md`\cos(2\pi - t)`, answer: "cos(t)", formula: md`\cos(A - B) = \cos A \cos B + \sin A \sin B`, expand: md`\cos 2\pi \cos t + \sin 2\pi \sin t = (1)\cos t + (0)\sin t` },
      { tex: md`\sin\left(\frac{3\pi}{2} - t\right)`, answer: "-cos(t)", formula: md`\sin(A - B) = \sin A \cos B - \cos A \sin B`, expand: md`\sin \tfrac{3\pi}{2} \cos t - \cos \tfrac{3\pi}{2} \sin t = (-1)\cos t - (0)\sin t` },
      { tex: md`\tan(\pi + t)`, answer: "tan(t)", formula: md`\tan(A + B) = \frac{\tan A + \tan B}{1 - \tan A \tan B}`, expand: md`\frac{\tan \pi + \tan t}{1 - \tan \pi \tan t} = \frac{0 + \tan t}{1 - 0}` },
      { tex: md`\tan(\pi - t)`, answer: "-tan(t)", formula: md`\tan(A - B) = \frac{\tan A - \tan B}{1 + \tan A \tan B}`, expand: md`\frac{\tan \pi - \tan t}{1 + \tan \pi \tan t} = \frac{0 - \tan t}{1 + 0}` },
    ];
    const it = r.pick(items);
    return {
      prompt: md`Simplify $${it.tex}$ to a single trig function, possibly with a minus sign. ${TYPE}`,
      answer: it.answer,
      simplified: true,
      hint: md`Expand with $${it.formula}$ and use the exact values of the fixed angle.`,
      solution: [
        { math: it.expand, note: md`$${it.formula}$, with the known values at the fixed angle.` },
        { math: it.answer.replace(/(sin|cos|tan)\((\w)\)/, "\\$1 $2"), note: "Drop the zero term." },
      ],
    };
  }
  const fn = r.pick(["sin", "cos", "tan"] as const);
  const fnTex = `\\${fn}`;
  const op = r.pick(["+", "-"] as const);
  // Pairs (A, B) in degrees, neither standard, with A op B standard (and not 90 for tangent).
  const sums: [number, number][] = [
    [20, 10],
    [25, 20],
    [35, 10],
    [40, 20],
    [50, 40],
    [70, 20],
    [80, 40],
    [100, 35],
    [110, 40],
    [130, 50],
  ];
  const diffs: [number, number][] = [
    [50, 20],
    [80, 35],
    [100, 40],
    [140, 50],
    [160, 40],
    [200, 20],
    [250, 70],
    [230, 50],
    [310, 40],
    [100, 55],
  ];
  const pairs = (op === "+" ? sums : diffs).filter(([A, B]) => fn !== "tan" || (((op === "+" ? A + B : A - B) % 180) + 180) % 180 !== 90);
  const [A, B] = r.pick(pairs);
  const total = op === "+" ? A + B : A - B;
  const value = std(total)[fn]!;
  const useDegrees = r.next() < 0.5;
  const ang = (d: number) => (useDegrees ? `${d}^\\circ` : `\\left(${radTex(d)}\\right)`);
  const angT = (d: number) => (useDegrees ? `${d}^\\circ` : radTex(d));
  const other = op === "+" ? "-" : "+";
  const expr =
    fn === "sin"
      ? `\\sin ${ang(A)} \\cos ${ang(B)} ${op} \\cos ${ang(A)} \\sin ${ang(B)}`
      : fn === "cos"
        ? `\\cos ${ang(A)} \\cos ${ang(B)} ${other} \\sin ${ang(A)} \\sin ${ang(B)}`
        : `\\frac{\\tan ${ang(A)} ${op} \\tan ${ang(B)}}{1 ${other} \\tan ${ang(A)} \\tan ${ang(B)}}`;
  const formula =
    fn === "sin"
      ? md`\sin A \cos B ${op} \cos A \sin B = \sin(A ${op} B)`
      : fn === "cos"
        ? md`\cos A \cos B ${other} \sin A \sin B = \cos(A ${op} B)`
        : md`\frac{\tan A ${op} \tan B}{1 ${other} \tan A \tan B} = \tan(A ${op} B)`;
  const rad = (d: number) => `(${d} pi/180)`;
  const verifyExpr =
    fn === "sin"
      ? `sin${rad(A)} cos${rad(B)} ${op} cos${rad(A)} sin${rad(B)}`
      : fn === "cos"
        ? `cos${rad(A)} cos${rad(B)} ${other} sin${rad(A)} sin${rad(B)}`
        : `(tan${rad(A)} ${op} tan${rad(B)})/(1 ${other} tan${rad(A)} tan${rad(B)})`;
  return {
    prompt: md`Find the value of $${expr}$. ${EXACT}`,
    answer: value.text,
    simplified: true,
    ...(useDegrees ? { verify: [`v = ${verifyExpr}`] } : {}),
    hint: md`This is the right side of a sum or difference formula, read backwards: $${formula}$.`,
    solution: [
      { math: md`${fnTex}(${angT(A)} ${op} ${angT(B)})`, note: md`$${formula}$, with $A = ${angT(A)}$ and $B = ${angT(B)}$.` },
      { math: md`${fnTex} ${angT(((total % 360) + 360) % 360)} = ${value.tex}`, note: "A standard angle, so the exact value is known." },
    ],
  };
};

/** sin(a + b) and friends from given values of sin a and cos b with quadrants. */
const sumFromValues: Generator = (r) => {
  const [a1, b1, c1] = r.pick(TRIPLES);
  const [a2, b2, c2] = r.pick(TRIPLES);
  const q1 = r.int(0, 3);
  const q2 = r.int(0, 3);
  const [sx1, sy1] = SIGNS[q1]!;
  const [sx2, sy2] = SIGNS[q2]!;
  // Angle a: sin = sy1 a1/c1, cos = sx1 b1/c1. Angle b: sin = sy2 a2/c2, cos = sx2 b2/c2.
  const sa = sy1 * a1, ca = sx1 * b1, sb = sy2 * a2, cb = sx2 * b2;
  const fn = r.pick(["sin", "cos", "tan"] as const);
  const fnTex = `\\${fn}`;
  const op = r.pick(["+", "-"] as const);
  const other = op === "+" ? "-" : "+";
  const given1 = r.next() < 0.5 ? "sin" : "cos";
  const given2 = r.next() < 0.5 ? "sin" : "cos";
  let answer: string;
  let steps: Step[];
  const sign = op === "+" ? 1 : -1;
  if (fn === "sin") {
    const num = sa * cb + sign * ca * sb;
    answer = frac(num, c1 * c2);
    steps = [
      { math: md`\sin(a ${op} b) = \sin a \cos b ${op} \cos a \sin b`, note: "Sine sum or difference formula." },
      { math: md`\left(${ftex(sa, c1)}\right)\left(${ftex(cb, c2)}\right) ${op} \left(${ftex(ca, c1)}\right)\left(${ftex(sb, c2)}\right)`, note: "Substitute all four values." },
      { math: md`${ftex(sa * cb, c1 * c2)} ${sign * ca * sb < 0 ? "-" : "+"} ${ftex(Math.abs(ca * sb), c1 * c2)} = ${ftex(num, c1 * c2)}`, note: "Multiply, then add over the common denominator." },
    ];
  } else if (fn === "cos") {
    const num = ca * cb - sign * sa * sb;
    answer = frac(num, c1 * c2);
    steps = [
      { math: md`\cos(a ${op} b) = \cos a \cos b ${other} \sin a \sin b`, note: "Cosine formula: the sign in the middle flips." },
      { math: md`\left(${ftex(ca, c1)}\right)\left(${ftex(cb, c2)}\right) ${other} \left(${ftex(sa, c1)}\right)\left(${ftex(sb, c2)}\right)`, note: "Substitute all four values." },
      { math: md`${ftex(ca * cb, c1 * c2)} ${-sign * sa * sb < 0 ? "-" : "+"} ${ftex(Math.abs(sa * sb), c1 * c2)} = ${ftex(num, c1 * c2)}`, note: "Multiply, then combine." },
    ];
  } else {
    // tan a = sa/ca, tan b = sb/cb; tan(a op b) = (sa cb op ca sb)/(ca cb -op sa sb).
    const num = sa * cb + sign * ca * sb;
    const den = ca * cb - sign * sa * sb;
    if (den === 0) return sumFromValues(r);
    answer = frac(num, den);
    steps = [
      { math: md`\tan a = \frac{\sin a}{\cos a} = ${ftex(sa, ca)}, \qquad \tan b = ${ftex(sb, cb)}`, note: "Quotient identity, from the sine and cosine of each angle." },
      { math: md`\tan(a ${op} b) = \frac{\tan a ${op} \tan b}{1 ${other} \tan a \tan b}`, note: "Tangent formula." },
      { math: md`\frac{${ftex(sa, ca)} ${op} ${ftex(sb, cb)}}{1 ${other} \left(${ftex(sa, ca)}\right)\left(${ftex(sb, cb)}\right)} = ${ftex(num, den)}`, note: md`Multiply top and bottom by ${Math.abs(ca * cb)} to clear the small fractions, then reduce.` },
    ];
  }
  const gTex1 = given1 === "sin" ? md`\sin a = ${ftex(sa, c1)}` : md`\cos a = ${ftex(ca, c1)}`;
  const gTex2 = given2 === "sin" ? md`\sin b = ${ftex(sb, c2)}` : md`\cos b = ${ftex(cb, c2)}`;
  const findSteps: Step[] = [
    given1 === "sin"
      ? { math: md`\cos a = ${sx1 < 0 ? "-" : ""}\sqrt{1 - ${ftex(a1 * a1, c1 * c1)}} = ${ftex(ca, c1)}`, note: md`Pythagorean identity; cosine is ${sx1 > 0 ? "positive" : "negative"} in quadrant ${QUADRANT[q1]}.` }
      : { math: md`\sin a = ${sy1 < 0 ? "-" : ""}\sqrt{1 - ${ftex(b1 * b1, c1 * c1)}} = ${ftex(sa, c1)}`, note: md`Pythagorean identity; sine is ${sy1 > 0 ? "positive" : "negative"} in quadrant ${QUADRANT[q1]}.` },
    given2 === "sin"
      ? { math: md`\cos b = ${sx2 < 0 ? "-" : ""}\sqrt{1 - ${ftex(a2 * a2, c2 * c2)}} = ${ftex(cb, c2)}`, note: md`Cosine is ${sx2 > 0 ? "positive" : "negative"} in quadrant ${QUADRANT[q2]}.` }
      : { math: md`\sin b = ${sy2 < 0 ? "-" : ""}\sqrt{1 - ${ftex(b2 * b2, c2 * c2)}} = ${ftex(sb, c2)}`, note: md`Sine is ${sy2 > 0 ? "positive" : "negative"} in quadrant ${QUADRANT[q2]}.` },
  ];
  const TA = angleExpr(q1, b1, a1);
  const TB = angleExpr(q2, b2, a2);
  return {
    prompt: md`Suppose $${gTex1}$ with $a$ in quadrant ${QUADRANT[q1]}, and $${gTex2}$ with $b$ in quadrant ${QUADRANT[q2]}. Find $${fnTex}(a ${op} b)$. Give a fraction.`,
    answer,
    verify: [`v = ${fn}(${TA} ${op} ${TB})`],
    hint: md`The formula needs both the sine and the cosine of each angle. Find the missing ones with $\sin^2 t + \cos^2 t = 1$, letting each quadrant choose the sign.`,
    solution: [...findSteps, ...steps],
  };
};

// ── Lesson 3 generators ─────────────────────────────────────────────────────

/** sin(2t), cos(2t) or tan(2t) from one value and a quadrant. */
const doubleFromValue: Generator = (r) => {
  const [a, b, c] = r.pick(TRIPLES);
  const q = r.int(0, 3);
  const [sx, sy] = SIGNS[q]!;
  const s = sy * a, co = sx * b;
  const given = r.pick(["sin", "cos", "tan"] as const);
  const fn = r.pick(["sin", "cos", "tan"] as const);
  const fnTex = `\\${fn}`;
  const T = angleExpr(q, b, a);
  const gTex = given === "sin" ? md`\sin t = ${ftex(s, c)}` : given === "cos" ? md`\cos t = ${ftex(co, c)}` : md`\tan t = ${ftex(s, co)}`;
  const find: Step[] = [];
  if (given === "sin") find.push({ math: md`\cos t = ${sx < 0 ? "-" : ""}\sqrt{1 - ${ftex(a * a, c * c)}} = ${ftex(co, c)}`, note: md`Pythagorean identity; cosine is ${sx > 0 ? "positive" : "negative"} in quadrant ${QUADRANT[q]}.` });
  else if (given === "cos") find.push({ math: md`\sin t = ${sy < 0 ? "-" : ""}\sqrt{1 - ${ftex(b * b, c * c)}} = ${ftex(s, c)}`, note: md`Pythagorean identity; sine is ${sy > 0 ? "positive" : "negative"} in quadrant ${QUADRANT[q]}.` });
  else if (fn !== "tan")
    find.push({
      math: md`\sec^2 t = 1 + ${ftex(a * a, b * b)} = ${ftex(c * c, b * b)}, \quad \cos t = ${ftex(co, c)}, \quad \sin t = \tan t \cos t = ${ftex(s, c)}`,
      note: md`$1 + \tan^2 t = \sec^2 t$; in quadrant ${QUADRANT[q]} cosine is ${sx > 0 ? "positive" : "negative"}.`,
    });
  let answer: string;
  let main: Step[];
  if (fn === "sin") {
    answer = frac(2 * s * co, c * c);
    main = [
      { math: md`\sin(2t) = 2 \sin t \cos t`, note: "Double-angle formula for sine." },
      { math: md`2 \left(${ftex(s, c)}\right)\left(${ftex(co, c)}\right) = ${ftex(2 * s * co, c * c)}`, note: "Substitute and multiply." },
    ];
  } else if (fn === "cos") {
    const num = b * b - a * a;
    answer = frac(num, c * c);
    const form = given === "sin" ? md`1 - 2\sin^2 t` : given === "cos" ? md`2\cos^2 t - 1` : md`\cos^2 t - \sin^2 t`;
    const work = given === "sin" ? md`1 - 2 \cdot ${ftex(a * a, c * c)}` : given === "cos" ? md`2 \cdot ${ftex(b * b, c * c)} - 1` : md`${ftex(b * b, c * c)} - ${ftex(a * a, c * c)}`;
    main = [
      { math: md`\cos(2t) = ${form}`, note: md`Double-angle formula for cosine, in the form that uses what you ${given === "tan" ? "found" : "were given"}. ${given !== "tan" ? "The sign of the other function doesn't even matter here." : ""}` },
      { math: md`${work} = ${ftex(num, c * c)}`, note: "Substitute." },
    ];
  } else {
    const num = 2 * s * co;
    const den = b * b - a * a;
    if (den === 0) return doubleFromValue(r);
    answer = frac(num, den);
    main = [
      { math: md`\tan t = ${ftex(s, co)}`, note: given === "tan" ? "Given." : "Quotient identity." },
      { math: md`\tan(2t) = \frac{2\tan t}{1 - \tan^2 t} = \frac{2 \cdot ${ftex(s, co)}}{1 - ${ftex(a * a, b * b)}}`, note: "Double-angle formula for tangent." },
      { math: md`\frac{${ftex(2 * s * co, b * b)}}{${ftex(den, b * b)}} = ${ftex(num, den)}`, note: md`Multiply top and bottom by ${b * b}.` },
    ];
  }
  return {
    prompt: md`Find $${fnTex}(2t)$ when $${gTex}$ and $t$ is in quadrant ${QUADRANT[q]}. Give a fraction.`,
    answer,
    verify: [`v = ${fn}(2 ${T})`],
    hint: md`${fn === "cos" && given !== "tan" ? md`One form of $\cos(2t)$ uses only the function you were given.` : md`Find the missing sine or cosine from the Pythagorean identity, with the quadrant fixing its sign, then apply the double-angle formula.`}`,
    solution: [...find, ...main],
  };
};

/** Collapse an expression with a double-angle formula. */
const simplifyDouble: Generator = (r) => {
  const k = r.pick([1, 1, 2, 3, 4]);
  const kt = k === 1 ? "t" : `${k}t`;
  const two = 2 * k;
  const twoT = `${two}t`;
  type Item = { tex: string; answer: string; hint: string; steps: Step[]; single: boolean };
  const items: Item[] = [
    {
      tex: md`2\sin(${kt})\cos(${kt})`,
      answer: `sin(${twoT})`,
      hint: md`$2 \sin A \cos A = \sin(2A)$.`,
      steps: [{ math: md`\sin(2 \cdot ${kt}) = \sin(${twoT})`, note: md`Sine double-angle formula with $A = ${kt}$.` }],
      single: true,
    },
    {
      tex: md`\cos^2(${kt}) - \sin^2(${kt})`,
      answer: `cos(${twoT})`,
      hint: md`$\cos^2 A - \sin^2 A = \cos(2A)$.`,
      steps: [{ math: md`\cos(2 \cdot ${kt}) = \cos(${twoT})`, note: md`Cosine double-angle formula with $A = ${kt}$.` }],
      single: true,
    },
    {
      tex: md`1 - 2\sin^2(${kt})`,
      answer: `cos(${twoT})`,
      hint: md`$1 - 2\sin^2 A = \cos(2A)$.`,
      steps: [{ math: md`\cos(2 \cdot ${kt}) = \cos(${twoT})`, note: md`Second form of the cosine double-angle formula, $A = ${kt}$.` }],
      single: true,
    },
    {
      tex: md`2\cos^2(${kt}) - 1`,
      answer: `cos(${twoT})`,
      hint: md`$2\cos^2 A - 1 = \cos(2A)$.`,
      steps: [{ math: md`\cos(2 \cdot ${kt}) = \cos(${twoT})`, note: md`Third form of the cosine double-angle formula, $A = ${kt}$.` }],
      single: true,
    },
    {
      tex: md`\frac{2\tan(${kt})}{1 - \tan^2(${kt})}`,
      answer: `tan(${twoT})`,
      hint: md`This is the tangent double-angle formula read backwards.`,
      steps: [{ math: md`\tan(2 \cdot ${kt}) = \tan(${twoT})`, note: md`$\dfrac{2\tan A}{1 - \tan^2 A} = \tan(2A)$ with $A = ${kt}$.` }],
      single: true,
    },
    {
      tex: md`\frac{\sin(${twoT})}{\sin(${kt})}`,
      answer: `2cos(${kt})`,
      hint: md`Expand $\sin(${twoT})$ as a double angle, then cancel.`,
      steps: [
        { math: md`\frac{2\sin(${kt})\cos(${kt})}{\sin(${kt})}`, note: md`$\sin(2A) = 2\sin A \cos A$.` },
        { math: md`2\cos(${kt})`, note: "Cancel the sine." },
      ],
      single: false,
    },
    {
      tex: md`\frac{\sin(${twoT})}{\cos(${kt})}`,
      answer: `2sin(${kt})`,
      hint: md`Expand $\sin(${twoT})$ as a double angle, then cancel.`,
      steps: [
        { math: md`\frac{2\sin(${kt})\cos(${kt})}{\cos(${kt})}`, note: md`$\sin(2A) = 2\sin A \cos A$.` },
        { math: md`2\sin(${kt})`, note: "Cancel the cosine." },
      ],
      single: false,
    },
    {
      tex: md`\frac{1 - \cos(${twoT})}{2}`,
      answer: `(sin(${kt}))^2`,
      hint: md`Use $\cos(2A) = 1 - 2\sin^2 A$.`,
      steps: [
        { math: md`\frac{1 - (1 - 2\sin^2(${kt}))}{2}`, note: md`$\cos(2A) = 1 - 2\sin^2 A$.` },
        { math: md`\frac{2\sin^2(${kt})}{2} = \sin^2(${kt})`, note: "Simplify. This is the power-reducing formula." },
      ],
      single: true,
    },
    {
      tex: md`\frac{1 + \cos(${twoT})}{2}`,
      answer: `(cos(${kt}))^2`,
      hint: md`Use $\cos(2A) = 2\cos^2 A - 1$.`,
      steps: [
        { math: md`\frac{1 + (2\cos^2(${kt}) - 1)}{2}`, note: md`$\cos(2A) = 2\cos^2 A - 1$.` },
        { math: md`\frac{2\cos^2(${kt})}{2} = \cos^2(${kt})`, note: "Simplify. This is the power-reducing formula." },
      ],
      single: true,
    },
    {
      tex: md`\frac{\sin(${twoT})}{1 + \cos(${twoT})}`,
      answer: `tan(${kt})`,
      hint: md`Write both the top and the bottom as double angles of $${kt}$.`,
      steps: [
        { math: md`\frac{2\sin(${kt})\cos(${kt})}{2\cos^2(${kt})}`, note: md`$1 + \cos(2A) = 2\cos^2 A$.` },
        { math: md`\frac{\sin(${kt})}{\cos(${kt})} = \tan(${kt})`, note: "Cancel, then the quotient identity." },
      ],
      single: true,
    },
    {
      tex: md`\frac{1 - \cos(${twoT})}{\sin(${twoT})}`,
      answer: `tan(${kt})`,
      hint: md`Write both the top and the bottom as double angles of $${kt}$.`,
      steps: [
        { math: md`\frac{2\sin^2(${kt})}{2\sin(${kt})\cos(${kt})}`, note: md`$1 - \cos(2A) = 2\sin^2 A$.` },
        { math: md`\frac{\sin(${kt})}{\cos(${kt})} = \tan(${kt})`, note: "Cancel, then the quotient identity." },
      ],
      single: true,
    },
    {
      tex: md`(\sin(${kt}) + \cos(${kt}))^2`,
      answer: `1 + sin(${twoT})`,
      hint: "Expand the square. You will meet the Pythagorean identity and a double angle.",
      steps: [
        { math: md`\sin^2(${kt}) + 2\sin(${kt})\cos(${kt}) + \cos^2(${kt})`, note: md`$(u + v)^2 = u^2 + 2uv + v^2$.` },
        { math: md`1 + \sin(${twoT})`, note: md`$\sin^2 + \cos^2 = 1$ and $2\sin A \cos A = \sin(2A)$.` },
      ],
      single: false,
    },
  ];
  const it = r.pick(items);
  return {
    prompt: md`Simplify $${it.tex}$${it.single ? " to a single trig function" : ""}. ${TYPE}`,
    answer: it.answer,
    simplified: true,
    hint: it.hint,
    solution: it.steps,
  };
};

/** Half-angle values: exact values at odd multiples of pi/8 and pi/12, or from a given cosine. */
const halfAngle: Generator = (r) => {
  if (r.next() < 0.5) {
    const fn = r.pick(["sin", "cos", "tan"] as const);
    const fnTex = `\\${fn}`;
    const deg = r.pick([22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]);
    const full = 2 * deg;
    const c = std(full).cos;
    const sPos = deg < 180;
    const cPos = deg < 90 || deg > 270;
    const cosFull = full % 360 === 45 || full % 360 === 315 ? 1 : -1; // sign of cos(2 deg)
    // sin(t/2) = ±sqrt((1 - cos)/2), cos(t/2) = ±sqrt((1 + cos)/2): with cos = ±sqrt(2)/2 the radicands are (2 ∓ sqrt(2))/4.
    const sinMag = cosFull > 0 ? E("sqrt(2 - sqrt(2))/2", "\\frac{\\sqrt{2 - \\sqrt{2}}}{2}") : E("sqrt(2 + sqrt(2))/2", "\\frac{\\sqrt{2 + \\sqrt{2}}}{2}");
    const cosMag = cosFull > 0 ? E("sqrt(2 + sqrt(2))/2", "\\frac{\\sqrt{2 + \\sqrt{2}}}{2}") : E("sqrt(2 - sqrt(2))/2", "\\frac{\\sqrt{2 - \\sqrt{2}}}{2}");
    const tanMag = cosFull > 0 ? E("sqrt(2) - 1", "\\sqrt{2} - 1") : E("sqrt(2) + 1", "\\sqrt{2} + 1");
    const value = fn === "sin" ? (sPos ? sinMag : neg(sinMag)) : fn === "cos" ? (cPos ? cosMag : neg(cosMag)) : sPos === cPos ? tanMag : neg(tanMag);
    const angTex = radTex(deg);
    const fullTex = radTex(full);
    const sign = fn === "sin" ? (sPos ? "+" : "-") : fn === "cos" ? (cPos ? "+" : "-") : sPos === cPos ? "+" : "-";
    const steps: Step[] = [{ math: md`${angTex} = \frac{1}{2} \cdot ${fullTex}, \qquad \cos\left(${fullTex}\right) = ${c.tex}`, note: "Half of a standard angle, whose cosine is known." }];
    if (fn === "sin") {
      steps.push({ math: md`\sin\left(${angTex}\right) = ${sign === "-" ? "-" : ""}\sqrt{\frac{1 - \cos\left(${fullTex}\right)}{2}}`, note: md`Half-angle formula. The sign comes from the quadrant of $${angTex}$: sine is ${sPos ? "positive" : "negative"} there.` });
      steps.push({ math: md`${sign === "-" ? "-" : ""}\sqrt{\frac{1 ${cosFull > 0 ? "-" : "+"} \frac{\sqrt{2}}{2}}{2}} = ${sign === "-" ? "-" : ""}\sqrt{\frac{2 ${cosFull > 0 ? "-" : "+"} \sqrt{2}}{4}} = ${value.tex}`, note: "Multiply top and bottom of the inner fraction by 2, then take the root of the 4." });
    } else if (fn === "cos") {
      steps.push({ math: md`\cos\left(${angTex}\right) = ${sign === "-" ? "-" : ""}\sqrt{\frac{1 + \cos\left(${fullTex}\right)}{2}}`, note: md`Half-angle formula. Cosine is ${cPos ? "positive" : "negative"} in the quadrant of $${angTex}$.` });
      steps.push({ math: md`${sign === "-" ? "-" : ""}\sqrt{\frac{1 ${cosFull > 0 ? "+" : "-"} \frac{\sqrt{2}}{2}}{2}} = ${sign === "-" ? "-" : ""}\sqrt{\frac{2 ${cosFull > 0 ? "+" : "-"} \sqrt{2}}{4}} = ${value.tex}`, note: "Multiply top and bottom of the inner fraction by 2, then take the root of the 4." });
    } else {
      const sFull = std(full).sin;
      steps.push({ math: md`\tan\left(${angTex}\right) = \frac{1 - \cos\left(${fullTex}\right)}{\sin\left(${fullTex}\right)}`, note: "The half-angle formula for tangent that needs no sign decision." });
      steps.push({ math: md`\frac{1 - \left(${c.tex}\right)}{${sFull.tex}} = \frac{2 ${cosFull > 0 ? "-" : "+"} \sqrt{2}}{${sFull.text.startsWith("-") ? "-" : ""}\sqrt{2}} = ${value.tex}`, note: md`Multiply top and bottom by 2, then by $\sqrt{2}$ to clear the root from the bottom.` });
    }
    return {
      prompt: md`Find the value of $${fnTex}\left(${angTex}\right)$. ${EXACT}`,
      answer: value.text,
      simplified: true,
      hint: md`$${angTex}$ is half of $${fullTex}$, a standard angle. Use a half-angle formula and let the quadrant of $${angTex}$ fix the sign.`,
      solution: steps,
    };
  }
  // From a given cosine: cos t = (b^2 - a^2)/c^2 means sin(t/2) = a/c, cos(t/2) = b/c (up to sign).
  const [a, b, c] = r.pick(TRIPLES);
  const upper = r.next() < 0.5; // t in (0, pi) or (pi, 2pi)
  const cosT = b * b - a * a;
  const fn = r.pick(["sin", "cos", "tan"] as const);
  const fnTex = `\\${fn}`;
  // t/2 is in quadrant I (upper) or II (lower half): sine positive both ways, cosine negative when t > pi.
  const cs = upper ? 1 : -1;
  const answer = fn === "sin" ? frac(a, c) : fn === "cos" ? frac(cs * b, c) : frac(a, cs * b);
  const T = upper ? `acos(${cosT}/${c * c})` : `(2pi - acos(${cosT}/${c * c}))`;
  const range = upper ? md`0 < t < \pi` : md`\pi < t < 2\pi`;
  const halfRange = upper ? md`0 < \tfrac{t}{2} < \tfrac{\pi}{2}` : md`\tfrac{\pi}{2} < \tfrac{t}{2} < \pi`;
  const steps: Step[] = [{ math: md`${range} \;\Rightarrow\; ${halfRange}`, note: md`Halve the range to find the quadrant of $\tfrac{t}{2}$: quadrant ${upper ? "I, so every function is positive" : "II, so sine is positive and cosine and tangent are negative"}.` }];
  if (fn === "sin") {
    steps.push({ math: md`\sin\tfrac{t}{2} = \sqrt{\frac{1 - \cos t}{2}} = \sqrt{\frac{1 - ${ftex(cosT, c * c)}}{2}}`, note: "Half-angle formula, positive sign." });
    steps.push({ math: md`\sqrt{\frac{${ftex(2 * a * a, c * c)}}{2}} = \sqrt{${ftex(a * a, c * c)}} = ${ftex(a, c)}`, note: "Simplify under the root." });
  } else if (fn === "cos") {
    steps.push({ math: md`\cos\tfrac{t}{2} = ${cs < 0 ? "-" : ""}\sqrt{\frac{1 + \cos t}{2}} = ${cs < 0 ? "-" : ""}\sqrt{\frac{1 + ${ftex(cosT, c * c)}}{2}}`, note: md`Half-angle formula, ${cs < 0 ? "negative" : "positive"} sign.` });
    steps.push({ math: md`${cs < 0 ? "-" : ""}\sqrt{\frac{${ftex(2 * b * b, c * c)}}{2}} = ${cs < 0 ? "-" : ""}\sqrt{${ftex(b * b, c * c)}} = ${ftex(cs * b, c)}`, note: "Simplify under the root." });
  } else {
    steps.push({ math: md`\tan\tfrac{t}{2} = ${cs < 0 ? "-" : ""}\sqrt{\frac{1 - \cos t}{1 + \cos t}} = ${cs < 0 ? "-" : ""}\sqrt{\frac{${ftex(2 * a * a, c * c)}}{${ftex(2 * b * b, c * c)}}}`, note: md`Half-angle formula for tangent, ${cs < 0 ? "negative" : "positive"} sign.` });
    steps.push({ math: md`${cs < 0 ? "-" : ""}\sqrt{${ftex(a * a, b * b)}} = ${ftex(a, cs * b)}`, note: "Simplify the fraction, then take the root." });
  }
  return {
    prompt: md`Find $${fnTex}\left(\frac{t}{2}\right)$ when $\cos t = ${ftex(cosT, c * c)}$ and $${range}$. Give a fraction.`,
    answer,
    verify: [`v = ${fn}(${T}/2)`],
    hint: md`Use a half-angle formula. The sign comes from the quadrant of $\tfrac{t}{2}$, not of $t$, so halve the given range first.`,
    solution: steps,
  };
};

// ── Lesson 4 generators ─────────────────────────────────────────────────────

/**
 * Short identity proofs, one side worked line by line. Each line has LaTeX for display and typed text
 * for the audit script, which checks that consecutive lines are equal and that every distractor is not.
 */
interface ProofLine {
  tex: string;
  reason: string;
}
interface ProofCase {
  /** The identity, as "LHS = RHS" in LaTeX. */
  claim: string;
  lines: ProofLine[];
  /** Wrong next steps for the line at the same index (the step from lines[i] to lines[i + 1]). */
  wrong: string[][];
}

const PROOFS: ProofCase[] = [
  {
    claim: md`\frac{\sin t}{1 + \cos t} = \frac{1 - \cos t}{\sin t}`,
    lines: [
      { tex: md`\frac{\sin t}{1 + \cos t}`, reason: "Start with the left side." },
      { tex: md`\frac{\sin t}{1 + \cos t} \cdot \frac{1 - \cos t}{1 - \cos t}`, reason: "Multiply by 1 in the form of the conjugate over itself." },
      { tex: md`\frac{\sin t (1 - \cos t)}{1 - \cos^2 t}`, reason: md`$(1 + c)(1 - c) = 1 - c^2$.` },
      { tex: md`\frac{\sin t (1 - \cos t)}{\sin^2 t}`, reason: md`$1 - \cos^2 t = \sin^2 t$.` },
      { tex: md`\frac{1 - \cos t}{\sin t}`, reason: "Cancel one factor of sine." },
    ],
    wrong: [
      [md`\frac{\sin t}{1 + \cos t} \cdot \frac{1 + \cos t}{1 - \cos t}`, md`\frac{\sin t - \cos t}{1}`, md`\frac{\tan t}{1 + 1}`],
      [md`\frac{\sin t (1 - \cos t)}{1 + \cos^2 t}`, md`\frac{\sin t (1 - \cos t)}{1 - \cos t}`, md`\frac{\sin t - \cos t}{1 - \cos^2 t}`],
      [md`\frac{\sin t (1 - \cos t)}{\cos^2 t}`, md`\frac{\sin t (1 - \cos t)}{1 + \sin^2 t}`, md`\frac{\sin t (1 - \cos t)}{\sin t}`],
      [md`\frac{1 - \cos t}{\sin^2 t}`, md`\frac{1 - \cos t}{1}`, md`\frac{\sin t - \cos t}{\sin t}`],
    ],
  },
  {
    claim: md`\sec t - \cos t = \sin t \tan t`,
    lines: [
      { tex: md`\sec t - \cos t`, reason: "Start with the left side." },
      { tex: md`\frac{1}{\cos t} - \cos t`, reason: "Reciprocal identity." },
      { tex: md`\frac{1 - \cos^2 t}{\cos t}`, reason: md`Common denominator: $\cos t = \frac{\cos^2 t}{\cos t}$.` },
      { tex: md`\frac{\sin^2 t}{\cos t}`, reason: md`$1 - \cos^2 t = \sin^2 t$.` },
      { tex: md`\sin t \cdot \frac{\sin t}{\cos t} = \sin t \tan t`, reason: "Split off one sine; quotient identity." },
    ],
    wrong: [
      [md`\frac{1}{\sin t} - \cos t`, md`\cos t - \frac{1}{\cos t}`, md`\frac{1}{\cos t - \cos t}`],
      [md`\frac{1 - \cos t}{\cos t}`, md`\frac{1 - \cos^2 t}{\cos^2 t}`, md`\frac{1 + \cos^2 t}{\cos t}`],
      [md`\frac{\cos^2 t}{\cos t}`, md`\frac{\tan^2 t}{\cos t}`, md`\frac{1 - \sin^2 t}{\cos t}`],
      [md`\sin t \cdot \frac{\cos t}{\sin t}`, md`\sin t \cot t`, md`\sin t \sec t`],
    ],
  },
  {
    claim: md`\frac{\cos t}{1 - \sin t} = \sec t + \tan t`,
    lines: [
      { tex: md`\frac{\cos t}{1 - \sin t}`, reason: "Start with the left side." },
      { tex: md`\frac{\cos t}{1 - \sin t} \cdot \frac{1 + \sin t}{1 + \sin t}`, reason: "Multiply by the conjugate over itself." },
      { tex: md`\frac{\cos t (1 + \sin t)}{1 - \sin^2 t}`, reason: "Difference of squares in the denominator." },
      { tex: md`\frac{\cos t (1 + \sin t)}{\cos^2 t}`, reason: md`$1 - \sin^2 t = \cos^2 t$.` },
      { tex: md`\frac{1 + \sin t}{\cos t}`, reason: "Cancel one cosine." },
      { tex: md`\frac{1}{\cos t} + \frac{\sin t}{\cos t} = \sec t + \tan t`, reason: "Split the fraction; reciprocal and quotient identities." },
    ],
    wrong: [
      [md`\frac{\cos t}{1 - \sin t} \cdot \frac{1 - \sin t}{1 + \sin t}`, md`\frac{\cos t}{1} - \frac{\cos t}{\sin t}`, md`\frac{\cot t}{1 - 1}`],
      [md`\frac{\cos t (1 + \sin t)}{1 - \sin t}`, md`\frac{\cos t (1 + \sin t)}{1 + \sin^2 t}`, md`\frac{\cos t + \sin t}{1 - \sin^2 t}`],
      [md`\frac{\cos t (1 + \sin t)}{\sin^2 t}`, md`\frac{\cos t (1 + \sin t)}{\cos t}`, md`\frac{\cos t (1 + \sin t)}{1 + \cos^2 t}`],
      [md`\frac{1 + \sin t}{\cos^2 t}`, md`1 + \sin t`, md`\frac{1 + \sin t}{\sin t}`],
      [md`\sec t + \sin t`, md`\csc t + \tan t`, md`\sec t + \cot t`],
    ],
  },
  {
    claim: md`\frac{\tan t}{\sec t} = \sin t`,
    lines: [
      { tex: md`\frac{\tan t}{\sec t}`, reason: "Start with the left side." },
      { tex: md`\frac{\sin t}{\cos t} \cdot \frac{1}{\sec t}`, reason: "Quotient identity, and dividing is multiplying by the reciprocal." },
      { tex: md`\frac{\sin t}{\cos t} \cdot \cos t`, reason: md`$\frac{1}{\sec t} = \cos t$.` },
      { tex: md`\sin t`, reason: "Cancel the cosines." },
    ],
    wrong: [
      [md`\frac{\cos t}{\sin t} \cdot \frac{1}{\sec t}`, md`\frac{\sin t}{\cos t} \cdot \sec t`, md`\tan t - \sec t`],
      [md`\frac{\sin t}{\cos t} \cdot \sin t`, md`\frac{\sin t}{\cos t} \cdot \frac{1}{\cos t}`, md`\frac{\sin t}{\cos t} \cdot \frac{1}{\sin t}`],
      [md`\cos t`, md`\tan t`, md`\sin t \cos t`],
    ],
  },
  {
    claim: md`(1 - \sin t)(1 + \sin t) = \frac{1}{\sec^2 t}`,
    lines: [
      { tex: md`(1 - \sin t)(1 + \sin t)`, reason: "Start with the left side." },
      { tex: md`1 - \sin^2 t`, reason: "Difference of squares." },
      { tex: md`\cos^2 t`, reason: "Pythagorean identity." },
      { tex: md`\frac{1}{\sec^2 t}`, reason: md`Reciprocal identity: $\cos t = \frac{1}{\sec t}$.` },
    ],
    wrong: [
      [md`1 + \sin^2 t`, md`1 - 2\sin t - \sin^2 t`, md`1 - \sin t`],
      [md`\tan^2 t`, md`1 - \cos^2 t`, md`\sec^2 t`],
      [md`\frac{1}{\csc^2 t}`, md`\sec^2 t`, md`\frac{1}{\cos^2 t}`],
    ],
  },
  {
    claim: md`\frac{1 + \tan^2 t}{\csc^2 t} = \tan^2 t`,
    lines: [
      { tex: md`\frac{1 + \tan^2 t}{\csc^2 t}`, reason: "Start with the left side." },
      { tex: md`\frac{\sec^2 t}{\csc^2 t}`, reason: md`$1 + \tan^2 t = \sec^2 t$.` },
      { tex: md`\frac{1}{\cos^2 t} \cdot \sin^2 t`, reason: "Reciprocal identities: dividing by a reciprocal is multiplying." },
      { tex: md`\frac{\sin^2 t}{\cos^2 t} = \tan^2 t`, reason: "Quotient identity." },
    ],
    wrong: [
      [md`\frac{\cot^2 t}{\csc^2 t}`, md`\frac{\csc^2 t}{\csc^2 t}`, md`\frac{1 + \tan^2 t}{\sec^2 t}`],
      [md`\frac{1}{\sin^2 t} \cdot \cos^2 t`, md`\frac{1}{\cos^2 t} \cdot \frac{1}{\sin^2 t}`, md`\sec^2 t - \csc^2 t`],
      [md`\frac{\cos^2 t}{\sin^2 t} = \cot^2 t`, md`\frac{\sin^2 t}{\cos t}`, md`\sin^2 t \cos^2 t`],
    ],
  },
  {
    claim: md`\frac{\sin(2t)}{1 + \cos(2t)} = \tan t`,
    lines: [
      { tex: md`\frac{\sin(2t)}{1 + \cos(2t)}`, reason: "Start with the left side." },
      { tex: md`\frac{2\sin t \cos t}{1 + \cos(2t)}`, reason: "Sine double-angle formula." },
      { tex: md`\frac{2\sin t \cos t}{1 + (2\cos^2 t - 1)}`, reason: md`Cosine double-angle formula, in the form $2\cos^2 t - 1$ so the 1s cancel.` },
      { tex: md`\frac{2\sin t \cos t}{2\cos^2 t}`, reason: "Simplify the denominator." },
      { tex: md`\frac{\sin t}{\cos t} = \tan t`, reason: "Cancel, then the quotient identity." },
    ],
    wrong: [
      [md`\frac{\sin t \cos t}{1 + \cos(2t)}`, md`\frac{2\sin t}{1 + \cos(2t)}`, md`\frac{\sin^2 t}{1 + \cos(2t)}`],
      [md`\frac{2\sin t \cos t}{1 + (1 - 2\cos^2 t)}`, md`\frac{2\sin t \cos t}{1 + 2\cos t}`, md`\frac{2\sin t \cos t}{2 - 2\cos^2 t}`],
      [md`\frac{2\sin t \cos t}{2 + 2\cos^2 t}`, md`\frac{2\sin t \cos t}{\cos^2 t}`, md`\frac{2\sin t \cos t}{2\cos t}`],
      [md`\frac{\cos t}{\sin t} = \cot t`, md`\sin t`, md`\frac{\sin t}{\cos^2 t}`],
    ],
  },
  {
    claim: md`\cos^4 t - \sin^4 t = \cos(2t)`,
    lines: [
      { tex: md`\cos^4 t - \sin^4 t`, reason: "Start with the left side." },
      { tex: md`(\cos^2 t - \sin^2 t)(\cos^2 t + \sin^2 t)`, reason: "Difference of squares, with the squares being the squared functions." },
      { tex: md`(\cos^2 t - \sin^2 t)(1)`, reason: "Pythagorean identity." },
      { tex: md`\cos(2t)`, reason: "Cosine double-angle formula." },
    ],
    wrong: [
      [md`(\cos^2 t - \sin^2 t)^2`, md`(\cos t - \sin t)^4`, md`(\cos^2 t + \sin^2 t)^2`],
      [md`(\cos^2 t - \sin^2 t)(\cos^2 t - \sin^2 t)`, md`(1)(1)`, md`(\cos t - \sin t)(1)`],
      [md`\sin(2t)`, md`\cos(4t)`, md`1 - \cos(2t)`],
    ],
  },
];

/** Multiple choice: the next valid line of a proof. */
const nextStep: Generator = (r) => {
  const pf = r.pick(PROOFS);
  const i = r.int(0, pf.lines.length - 2);
  const right = md`$${pf.lines[i + 1]!.tex}$`;
  const choices = shuffle(r, [right, ...pf.wrong[i]!.map((w) => md`$${w}$`)]);
  const sofar = pf.lines.slice(0, i + 1).map((l) => md`$$${l.tex}$$`).join("\n\n");
  return {
    prompt: md`You are proving $${pf.claim}$ by working on the left side. So far:

${sofar}

Which line is a valid next step?`,
    choices,
    accept: [right],
    hint: pf.lines[i + 1]!.reason,
    solution: [
      { math: pf.lines[i + 1]!.tex, note: pf.lines[i + 1]!.reason },
      ...pf.lines.slice(i + 2).map((l) => ({ math: l.tex, note: l.reason })),
    ],
  };
};

/** Simplify a messier expression, the way the middle of a proof does. */
const simplifyMixed: Generator = (r) => {
  type Item = { tex: string; answer: string; hint: string; steps: Step[]; single: boolean };
  const items: Item[] = [
    {
      tex: md`\frac{\sin t}{1 + \cos t} + \frac{1 + \cos t}{\sin t}`,
      answer: "2csc(t)",
      hint: "Common denominator, then the Pythagorean identity in the numerator.",
      single: false,
      steps: [
        { math: md`\frac{\sin^2 t + (1 + \cos t)^2}{(1 + \cos t)\sin t}`, note: "Common denominator." },
        { math: md`\frac{\sin^2 t + 1 + 2\cos t + \cos^2 t}{(1 + \cos t)\sin t} = \frac{2 + 2\cos t}{(1 + \cos t)\sin t}`, note: md`Expand the square; $\sin^2 t + \cos^2 t = 1$.` },
        { math: md`\frac{2(1 + \cos t)}{(1 + \cos t)\sin t} = \frac{2}{\sin t} = 2\csc t`, note: "Factor and cancel." },
      ],
    },
    {
      tex: md`\frac{\cos t}{1 - \sin t} - \tan t`,
      answer: "sec(t)",
      hint: md`Write $\tan t$ over $\cos t$ and use a common denominator of $(1 - \sin t)\cos t$.`,
      single: true,
      steps: [
        { math: md`\frac{\cos^2 t - \sin t (1 - \sin t)}{(1 - \sin t)\cos t}`, note: "Common denominator." },
        { math: md`\frac{\cos^2 t + \sin^2 t - \sin t}{(1 - \sin t)\cos t} = \frac{1 - \sin t}{(1 - \sin t)\cos t}`, note: "Expand; Pythagorean identity." },
        { math: md`\frac{1}{\cos t} = \sec t`, note: "Cancel." },
      ],
    },
    {
      tex: md`\frac{1}{1 - \sin t} + \frac{1}{1 + \sin t}`,
      answer: "2(sec(t))^2",
      hint: "Common denominator is a difference of squares.",
      single: false,
      steps: [
        { math: md`\frac{(1 + \sin t) + (1 - \sin t)}{(1 - \sin t)(1 + \sin t)}`, note: "Common denominator." },
        { math: md`\frac{2}{1 - \sin^2 t} = \frac{2}{\cos^2 t}`, note: "Simplify the top; Pythagorean identity on the bottom." },
        { math: md`2\sec^2 t`, note: "Reciprocal identity." },
      ],
    },
    {
      tex: md`\frac{1}{1 - \cos t} + \frac{1}{1 + \cos t}`,
      answer: "2(csc(t))^2",
      hint: "Common denominator is a difference of squares.",
      single: false,
      steps: [
        { math: md`\frac{(1 + \cos t) + (1 - \cos t)}{(1 - \cos t)(1 + \cos t)}`, note: "Common denominator." },
        { math: md`\frac{2}{1 - \cos^2 t} = \frac{2}{\sin^2 t}`, note: "Simplify the top; Pythagorean identity on the bottom." },
        { math: md`2\csc^2 t`, note: "Reciprocal identity." },
      ],
    },
    {
      tex: md`(\sec t - \tan t)(\sec t + \tan t)`,
      answer: "1",
      hint: "Difference of squares, then a Pythagorean identity.",
      single: false,
      steps: [
        { math: md`\sec^2 t - \tan^2 t`, note: "Difference of squares." },
        { math: md`1`, note: md`$1 + \tan^2 t = \sec^2 t$.` },
      ],
    },
    {
      tex: md`\frac{\sec t}{\sin t} - \frac{\sin t}{\cos t}`,
      answer: "cot(t)",
      hint: "Write everything in sines and cosines, then a common denominator.",
      single: true,
      steps: [
        { math: md`\frac{1}{\sin t \cos t} - \frac{\sin t}{\cos t}`, note: "Reciprocal identity." },
        { math: md`\frac{1 - \sin^2 t}{\sin t \cos t} = \frac{\cos^2 t}{\sin t \cos t}`, note: md`Common denominator $\sin t \cos t$; Pythagorean identity.` },
        { math: md`\frac{\cos t}{\sin t} = \cot t`, note: "Cancel; quotient identity." },
      ],
    },
    {
      tex: md`\frac{\sin t + \tan t}{1 + \cos t}`,
      answer: "tan(t)",
      hint: md`Factor $\tan t$ out of the numerator: $\sin t = \tan t \cos t$.`,
      single: true,
      steps: [
        { math: md`\frac{\tan t \cos t + \tan t}{1 + \cos t}`, note: md`$\sin t = \tan t \cos t$.` },
        { math: md`\frac{\tan t (\cos t + 1)}{1 + \cos t} = \tan t`, note: "Factor and cancel." },
      ],
    },
    {
      tex: md`\frac{\csc t}{\cot t + \tan t}`,
      answer: "cos(t)",
      hint: "Sines and cosines everywhere, then clear the small fractions.",
      single: true,
      steps: [
        { math: md`\frac{\frac{1}{\sin t}}{\frac{\cos t}{\sin t} + \frac{\sin t}{\cos t}}`, note: "Reciprocal and quotient identities." },
        { math: md`\frac{\frac{1}{\sin t}}{\frac{\cos^2 t + \sin^2 t}{\sin t \cos t}} = \frac{1}{\sin t} \cdot \frac{\sin t \cos t}{1}`, note: md`Combine the bottom over $\sin t \cos t$; $\cos^2 t + \sin^2 t = 1$.` },
        { math: md`\cos t`, note: "Cancel." },
      ],
    },
    {
      tex: md`\frac{\cos^2 t - \sin^2 t}{\cos t + \sin t}`,
      answer: "cos(t) - sin(t)",
      hint: "The numerator is a difference of squares.",
      single: false,
      steps: [
        { math: md`\frac{(\cos t - \sin t)(\cos t + \sin t)}{\cos t + \sin t}`, note: "Factor." },
        { math: md`\cos t - \sin t`, note: "Cancel." },
      ],
    },
    {
      tex: md`\frac{1 - \cos(2t)}{\sin(2t)} \cdot \cot t`,
      answer: "1",
      hint: "Double-angle formulas first.",
      single: false,
      steps: [
        { math: md`\frac{2\sin^2 t}{2\sin t \cos t} \cdot \frac{\cos t}{\sin t}`, note: md`$1 - \cos(2t) = 2\sin^2 t$ and $\sin(2t) = 2\sin t \cos t$.` },
        { math: md`\frac{\sin t}{\cos t} \cdot \frac{\cos t}{\sin t} = 1`, note: "Cancel." },
      ],
    },
  ];
  const it = r.pick(items);
  return {
    prompt: md`Simplify $${it.tex}$${it.single ? " to a single trig function" : ""}. ${TYPE}`,
    answer: it.answer,
    simplified: true,
    hint: it.hint,
    solution: it.steps,
  };
};

/** Fill in the missing expression that makes an identity true. */
const fillBlank: Generator = (r) => {
  type Item = { lhs: string; lhsText: string; rhsTex: string; rhsText: string; answer: string; hint: string; steps: Step[] };
  // lhsText is the left side in typed syntax; rhsText is the right side with q standing for the blank, for the verify equation.
  const items: Item[] = [
    {
      lhs: md`\frac{\sin t}{1 + \cos t}`,
      lhsText: "sin(t)/(1 + cos(t))",
      rhsTex: md`\frac{\;?\;}{\sin t}`,
      rhsText: "q/sin(t)",
      answer: "1 - cos(t)",
      hint: md`Cross-multiply: the blank times $(1 + \cos t)$ must equal $\sin^2 t$.`,
      steps: [
        { math: md`? \cdot (1 + \cos t) = \sin t \cdot \sin t = \sin^2 t`, note: "Cross-multiply." },
        { math: md`? = \frac{\sin^2 t}{1 + \cos t} = \frac{1 - \cos^2 t}{1 + \cos t} = 1 - \cos t`, note: md`Pythagorean identity, then factor $1 - \cos^2 t = (1 - \cos t)(1 + \cos t)$ and cancel.` },
      ],
    },
    {
      lhs: md`\frac{\cos t}{1 - \sin t}`,
      lhsText: "cos(t)/(1 - sin(t))",
      rhsTex: md`\frac{\;?\;}{\cos t}`,
      rhsText: "q/cos(t)",
      answer: "1 + sin(t)",
      hint: md`Cross-multiply: the blank times $(1 - \sin t)$ must equal $\cos^2 t$.`,
      steps: [
        { math: md`? \cdot (1 - \sin t) = \cos^2 t = 1 - \sin^2 t`, note: "Cross-multiply; Pythagorean identity." },
        { math: md`? = \frac{(1 - \sin t)(1 + \sin t)}{1 - \sin t} = 1 + \sin t`, note: "Factor and cancel." },
      ],
    },
    {
      lhs: md`\sec t - \cos t`,
      lhsText: "sec(t) - cos(t)",
      rhsTex: md`\frac{\;?\;}{\cos t}`,
      rhsText: "q/cos(t)",
      answer: "(sin(t))^2",
      hint: md`Put the left side over $\cos t$.`,
      steps: [
        { math: md`\frac{1}{\cos t} - \frac{\cos^2 t}{\cos t} = \frac{1 - \cos^2 t}{\cos t}`, note: "Common denominator." },
        { math: md`? = 1 - \cos^2 t = \sin^2 t`, note: "Pythagorean identity." },
      ],
    },
    {
      lhs: md`\csc t - \sin t`,
      lhsText: "csc(t) - sin(t)",
      rhsTex: md`\frac{\;?\;}{\sin t}`,
      rhsText: "q/sin(t)",
      answer: "(cos(t))^2",
      hint: md`Put the left side over $\sin t$.`,
      steps: [
        { math: md`\frac{1}{\sin t} - \frac{\sin^2 t}{\sin t} = \frac{1 - \sin^2 t}{\sin t}`, note: "Common denominator." },
        { math: md`? = 1 - \sin^2 t = \cos^2 t`, note: "Pythagorean identity." },
      ],
    },
    {
      lhs: md`\tan t + \cot t`,
      lhsText: "tan(t) + cot(t)",
      rhsTex: md`\frac{1}{\;?\;}`,
      rhsText: "1/q",
      answer: "sin(t) cos(t)",
      hint: "Combine the left side over a common denominator and see what is left under the 1.",
      steps: [
        { math: md`\frac{\sin t}{\cos t} + \frac{\cos t}{\sin t} = \frac{\sin^2 t + \cos^2 t}{\sin t \cos t}`, note: "Quotient identities; common denominator." },
        { math: md`\frac{1}{\sin t \cos t}, \quad ? = \sin t \cos t`, note: "Pythagorean identity." },
      ],
    },
    {
      lhs: md`\frac{1 + \tan^2 t}{\tan^2 t}`,
      lhsText: "(1 + (tan(t))^2)/(tan(t))^2",
      rhsTex: md`\;?\;`,
      rhsText: "q",
      answer: "(csc(t))^2",
      hint: md`$1 + \tan^2 t$ is a single squared function. Then divide.`,
      steps: [
        { math: md`\frac{\sec^2 t}{\tan^2 t} = \frac{1}{\cos^2 t} \cdot \frac{\cos^2 t}{\sin^2 t}`, note: "Pythagorean identity, then sines and cosines." },
        { math: md`\frac{1}{\sin^2 t} = \csc^2 t`, note: "Cancel; reciprocal identity." },
      ],
    },
    {
      lhs: md`\frac{\sin(2t)}{\cos t}`,
      lhsText: "sin(2t)/cos(t)",
      rhsTex: md`2 \cdot \;?\;`,
      rhsText: "2q",
      answer: "sin(t)",
      hint: md`Expand $\sin(2t)$.`,
      steps: [
        { math: md`\frac{2\sin t \cos t}{\cos t} = 2\sin t`, note: "Double-angle formula; cancel." },
      ],
    },
    {
      lhs: md`\cos(2t) + 2\sin^2 t - \cos^2 t`,
      lhsText: "cos(2t) + 2(sin(t))^2 - (cos(t))^2",
      rhsTex: md`\;?\;`,
      rhsText: "q",
      answer: "(sin(t))^2",
      hint: md`Choose the form of $\cos(2t)$ that has $\sin^2 t$ in it.`,
      steps: [
        { math: md`(1 - 2\sin^2 t) + 2\sin^2 t - \cos^2 t = 1 - \cos^2 t`, note: "Double-angle formula; the sine terms cancel." },
        { math: md`\sin^2 t`, note: "Pythagorean identity." },
      ],
    },
  ];
  const it = r.pick(items);
  return {
    prompt: md`Fill in the blank so that the equation is an identity: $${it.lhs} = ${it.rhsTex}$. ${TYPE}`,
    answer: it.answer,
    simplified: true,
    verify: [`${it.lhsText} = ${it.rhsText}`],
    hint: it.hint,
    solution: it.steps,
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit5: Unit = {
  title: "Identities",
  lessons: [
    {
      id: slug("The Pythagorean identities"),
      title: "The Pythagorean identities",
      summary: "Why sin² t + cos² t = 1 for every angle, the two identities that follow from it, and how to use them.",
      blocks: [
        {
          kind: "text",
          body: md`An equation like $2\sin t = 1$ is true for some angles and false for others. Solving it means finding the angles that work. An **identity** is different: it is an equation that is true for *every* value of the variable where both sides are defined. $\tan t = \frac{\sin t}{\cos t}$ is an identity. You never solve an identity; you prove it, and then you use it to rewrite expressions.

This unit builds the identities of trigonometry from one fact about the unit circle. Nothing is memorised without a reason.`,
        },
        {
          kind: "key",
          title: "Identity",
          body: md`An **identity** is an equation that holds for every value of the variable for which both sides make sense. The identities you already have from Units 2 and 3:

- **Reciprocal:** $\sec t = \dfrac{1}{\cos t}$, $\csc t = \dfrac{1}{\sin t}$, $\cot t = \dfrac{1}{\tan t}$.
- **Quotient:** $\tan t = \dfrac{\sin t}{\cos t}$, $\cot t = \dfrac{\cos t}{\sin t}$.

These are definitions, so they need no proof.`,
        },
        {
          kind: "diagram",
          view: [-1.5, 1.5, -1.5, 1.5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 1, y: 0, label: "(1, 0)", dir: "se" },
            { name: "P", x: "cos(t pi/180)", y: "sin(t pi/180)", label: "P = (\\cos t, \\sin t)", dir: "ne" },
            { name: "F", x: "cos(t pi/180)", y: 0, label: "", hidden: true },
          ],
          circles: [{ center: "O", radius: 1 }],
          segments: [
            { from: "O", to: "P", label: "1", color: 1 },
            { from: "O", to: "F", label: "\\cos t", color: 2 },
            { from: "F", to: "P", label: "\\sin t", color: 3, dashed: true },
          ],
          angles: [{ at: "O", from: "A", to: "P", label: "t", color: 1 }],
          params: [{ name: "t", tex: "t\\ (\\text{degrees})", min: 5, max: 355, step: 5, value: 50 }],
          readouts: [
            { label: "\\cos t", value: "cos(t pi/180)" },
            { label: "\\sin t", value: "sin(t pi/180)" },
            { label: "\\cos^2 t + \\sin^2 t", value: "(cos(t pi/180))^2 + (sin(t pi/180))^2" },
          ],
          caption: md`Drag $t$. The point $P$ moves around the circle, $\cos t$ and $\sin t$ change sign and size, and the last readout never moves.`,
        },
        {
          kind: "why",
          title: "Why sin² t + cos² t = 1",
          body: md`In Unit 3, $\cos t$ and $\sin t$ were *defined* as the coordinates of the point $P$ on the unit circle at angle $t$. The unit circle is the set of points at distance 1 from the origin, so by the distance formula (or the Pythagorean theorem on the dashed triangle) every point on it satisfies

$$x^2 + y^2 = 1.$$

Put $x = \cos t$ and $y = \sin t$ and you have $\cos^2 t + \sin^2 t = 1$. That is the whole proof. It holds in every quadrant, because squaring removes the signs, and it holds when $P$ is on an axis, where the triangle collapses: $0^2 + 1^2 = 1$.

The notation $\sin^2 t$ means $(\sin t)^2$: square the output. It never means $\sin(t^2)$.`,
        },
        {
          kind: "key",
          title: "The Pythagorean identities",
          body: md`$$\sin^2 t + \cos^2 t = 1$$
$$1 + \tan^2 t = \sec^2 t$$
$$1 + \cot^2 t = \csc^2 t$$

The second needs $\cos t \ne 0$ and the third needs $\sin t \ne 0$, since otherwise the functions in them are undefined. Each can be rearranged: $\sin^2 t = 1 - \cos^2 t$, $\tan^2 t = \sec^2 t - 1$, $\cot^2 t = \csc^2 t - 1$, and so on.`,
        },
        {
          kind: "why",
          title: "Where the other two come from",
          body: md`Divide every term of $\sin^2 t + \cos^2 t = 1$ by $\cos^2 t$, which is allowed when $\cos t \ne 0$:

$$\frac{\sin^2 t}{\cos^2 t} + \frac{\cos^2 t}{\cos^2 t} = \frac{1}{\cos^2 t} \quad\Longrightarrow\quad \tan^2 t + 1 = \sec^2 t.$$

Divide by $\sin^2 t$ instead, when $\sin t \ne 0$:

$$\frac{\sin^2 t}{\sin^2 t} + \frac{\cos^2 t}{\sin^2 t} = \frac{1}{\sin^2 t} \quad\Longrightarrow\quad 1 + \cot^2 t = \csc^2 t.$$

So there is really one Pythagorean identity, seen three ways. If you forget the second or third, divide the first.`,
        },
        {
          kind: "plot",
          x: [-6.5, 6.5],
          y: [-0.5, 1.5],
          curves: [
            { expr: "(sin x)^2", label: "y = \\sin^2 x", color: 3 },
            { expr: "(cos x)^2", label: "y = \\cos^2 x", color: 2 },
            { expr: "(sin x)^2 + (cos x)^2", label: "y = \\sin^2 x + \\cos^2 x", color: 1 },
          ],
          caption: md`The two squared waves are mirror images: wherever one dips, the other rises by exactly the same amount. Their sum is the flat line $y = 1$. Every identity has this picture: both sides draw the same graph.`,
        },
        {
          kind: "text",
          body: md`The identities are used in two directions. **Simplifying:** spot a piece of an identity inside an expression and replace it with something shorter. **Finding values:** when one trig value and the quadrant are known, the identity gives the square of another, and the quadrant decides the sign of its root.`,
        },
        {
          kind: "example",
          title: "Finding the other functions",
          problem: md`$\sin t = -\dfrac{5}{13}$ and $t$ is in quadrant III. Find $\cos t$ and $\tan t$.`,
          steps: [
            { math: md`\cos^2 t = 1 - \sin^2 t = 1 - \frac{25}{169} = \frac{144}{169}`, note: "Pythagorean identity, rearranged." },
            { math: md`\cos t = \pm\frac{12}{13}`, note: "A square root has two candidates. The identity alone can't choose." },
            { math: md`\cos t = -\frac{12}{13}`, note: "In quadrant III both coordinates are negative, so cosine is negative." },
            { math: md`\tan t = \frac{\sin t}{\cos t} = \frac{-5/13}{-12/13} = \frac{5}{12}`, note: "Quotient identity. Tangent is positive in quadrant III, as it should be." },
          ],
        },
        {
          kind: "example",
          title: "Simplifying",
          problem: md`Simplify $\dfrac{\sec^2 t - 1}{\sin^2 t}$ to a single trig function.`,
          steps: [
            { math: md`\frac{\tan^2 t}{\sin^2 t}`, note: md`$\sec^2 t - 1 = \tan^2 t$, from the second identity.` },
            { math: md`\frac{\sin^2 t}{\cos^2 t} \cdot \frac{1}{\sin^2 t}`, note: "Write tangent as a quotient. Dividing by a quantity is multiplying by its reciprocal." },
            { math: md`\frac{1}{\cos^2 t} = \sec^2 t`, note: "Cancel, then the reciprocal identity." },
          ],
        },
        {
          kind: "why",
          title: "A trick worth knowing: squares hide identities",
          body: md`Suppose $\sin t + \cos t = \frac{7}{5}$ and you want $\sin t \cos t$. Square both sides:

$$\sin^2 t + 2\sin t \cos t + \cos^2 t = \frac{49}{25}.$$

The first and last terms are the Pythagorean identity, so $1 + 2\sin t\cos t = \frac{49}{25}$, which gives $\sin t \cos t = \frac{12}{25}$. Whenever $\sin t$ and $\cos t$ appear squared, or can be made to, the identity is waiting.`,
        },
        {
          kind: "check",
          prompt: md`Find $\sin t$ when $\cos t = \dfrac{3}{5}$ and $t$ is in quadrant IV. Give a fraction.`,
          answer: "-4/5",
          explain: md`$\sin^2 t = 1 - \frac{9}{25} = \frac{16}{25}$, so $\sin t = \pm\frac{4}{5}$. In quadrant IV sine is negative: $\sin t = -\frac{4}{5}$.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $\tan t \cdot \cos t$ to a single trig function. ${TYPE}`,
          answer: "sin(t)",
          simplified: true,
          explain: md`$\tan t \cos t = \dfrac{\sin t}{\cos t} \cdot \cos t = \sin t$.`,
        },
      ],
      practice: [simplifyPythagorean, otherFunction, sumToProduct],
    },
    {
      id: slug("Sum and difference formulas"),
      title: "Sum and difference formulas",
      summary: "Prove cos(A − B) with the distance formula, derive the other five formulas from it, and use them for exact values.",
      blocks: [
        {
          kind: "text",
          body: md`Is $\sin(A + B)$ equal to $\sin A + \sin B$? Test it: $\sin(30^\circ + 60^\circ) = \sin 90^\circ = 1$, but $\sin 30^\circ + \sin 60^\circ = \frac{1}{2} + \frac{\sqrt{3}}{2} \approx 1.37$. So no. Sine does not distribute over addition, because it is not multiplication. The correct formula is more interesting, and it comes from a picture.`,
        },
        {
          kind: "diagram",
          view: [-1.5, 1.5, -1.5, 1.5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 1, y: 0, label: "A = (1, 0)", dir: "se" },
            { name: "P", x: "cos(a pi/180)", y: "sin(a pi/180)", label: "P = (\\cos a, \\sin a)", dir: "nw" },
            { name: "Q", x: "cos(b pi/180)", y: "sin(b pi/180)", label: "Q = (\\cos b, \\sin b)", dir: "ne" },
            { name: "R", x: "cos((a - b) pi/180)", y: "sin((a - b) pi/180)", label: "R = (\\cos(a - b), \\sin(a - b))", dir: "ne" },
          ],
          circles: [{ center: "O", radius: 1 }],
          segments: [
            { from: "O", to: "P", dashed: true },
            { from: "O", to: "Q", dashed: true },
            { from: "O", to: "R", dashed: true },
            { from: "P", to: "Q", color: 2, ticks: 1 },
            { from: "A", to: "R", color: 3, ticks: 1 },
          ],
          angles: [
            { at: "O", from: "Q", to: "P", label: "a - b", color: 2 },
            { at: "O", from: "A", to: "R", label: "a - b", color: 3 },
          ],
          params: [
            { name: "a", tex: "a\\ (\\text{degrees})", min: 0, max: 180, step: 5, value: 110 },
            { name: "b", tex: "b\\ (\\text{degrees})", min: 0, max: 100, step: 5, value: 40 },
          ],
          readouts: [
            { label: "PQ^2", value: "(cos(a pi/180) - cos(b pi/180))^2 + (sin(a pi/180) - sin(b pi/180))^2" },
            { label: "AR^2", value: "(cos((a - b) pi/180) - 1)^2 + (sin((a - b) pi/180))^2" },
          ],
          caption: md`Two chords of the unit circle. $PQ$ spans the angle from $b$ to $a$; $AR$ spans the same size of angle, $a - b$, but starting from the $x$-axis. Rotating one chord onto the other shows they are equal, and the readouts agree for every $a$ and $b$.`,
        },
        {
          kind: "why",
          title: "Why cos(A − B) = cos A cos B + sin A sin B",
          body: md`Take two points on the unit circle, $P$ at angle $A$ and $Q$ at angle $B$. The angle between the radii $OP$ and $OQ$ is $A - B$. Now rotate the whole picture about $O$ by $-B$. Rotation keeps lengths, so the chord doesn't change; $Q$ lands on $(1, 0)$ and $P$ lands on the point $R$ at angle $A - B$.

Measure the same chord twice with the distance formula (Geometry, Unit 1). Before rotating:

$$PQ^2 = (\cos A - \cos B)^2 + (\sin A - \sin B)^2 = \underbrace{\cos^2 A + \sin^2 A}_{1} + \underbrace{\cos^2 B + \sin^2 B}_{1} - 2\cos A \cos B - 2\sin A \sin B.$$

After rotating:

$$AR^2 = (\cos(A - B) - 1)^2 + \sin^2(A - B) = \underbrace{\cos^2(A - B) + \sin^2(A - B)}_{1} - 2\cos(A - B) + 1.$$

Both equal the same chord squared, so $2 - 2\cos A \cos B - 2\sin A \sin B = 2 - 2\cos(A - B)$. Divide by $-2$ and the formula falls out. The Pythagorean identity did all the cleaning up.`,
        },
        {
          kind: "proof",
          title: "The cosine difference formula",
          given: md`$P = (\cos A, \sin A)$ and $Q = (\cos B, \sin B)$ on the unit circle; $R = (\cos(A - B), \sin(A - B))$; $E = (1, 0)$`,
          prove: md`$\cos(A - B) = \cos A \cos B + \sin A \sin B$`,
          steps: [
            { statement: md`$PQ = ER$`, reason: md`Both chords subtend a central angle of $A - B$ in the same circle; congruent central angles have congruent chords (Geometry, Unit 7)` },
            { statement: md`$PQ^2 = (\cos A - \cos B)^2 + (\sin A - \sin B)^2$`, reason: "Distance formula" },
            { statement: md`$PQ^2 = 2 - 2\cos A \cos B - 2\sin A \sin B$`, reason: md`Expand; $\cos^2 A + \sin^2 A = 1$ and $\cos^2 B + \sin^2 B = 1$` },
            { statement: md`$ER^2 = (\cos(A - B) - 1)^2 + (\sin(A - B) - 0)^2$`, reason: "Distance formula" },
            { statement: md`$ER^2 = 2 - 2\cos(A - B)$`, reason: md`Expand; $\cos^2(A - B) + \sin^2(A - B) = 1$` },
            { statement: md`$2 - 2\cos A \cos B - 2\sin A \sin B = 2 - 2\cos(A - B)$`, reason: "Substitution (steps 1, 3, 5)" },
            { statement: md`$\cos(A - B) = \cos A \cos B + \sin A \sin B$`, reason: md`Subtract 2, divide by $-2$` },
          ],
        },
        {
          kind: "why",
          title: "The other five formulas come free",
          body: md`**cos(A + B).** Write $A + B = A - (-B)$ and use the formula just proved, then the even/odd facts from Unit 3, $\cos(-B) = \cos B$ and $\sin(-B) = -\sin B$:

$$\cos(A + B) = \cos A \cos(-B) + \sin A \sin(-B) = \cos A \cos B - \sin A \sin B.$$

**sin(A + B).** Unit 3 gave the cofunction identity $\sin x = \cos\left(\frac{\pi}{2} - x\right)$. Apply it to $x = A + B$:

$$\sin(A + B) = \cos\left(\left(\tfrac{\pi}{2} - A\right) - B\right) = \cos\left(\tfrac{\pi}{2} - A\right)\cos B + \sin\left(\tfrac{\pi}{2} - A\right)\sin B = \sin A \cos B + \cos A \sin B.$$

**sin(A − B).** Replace $B$ by $-B$ in the line above: $\sin A \cos B - \cos A \sin B$.

**tan(A ± B).** Divide $\sin(A + B)$ by $\cos(A + B)$, then divide top and bottom by $\cos A \cos B$:

$$\tan(A + B) = \frac{\sin A \cos B + \cos A \sin B}{\cos A \cos B - \sin A \sin B} = \frac{\tan A + \tan B}{1 - \tan A \tan B}.$$

Replacing $B$ by $-B$ and using $\tan(-B) = -\tan B$ gives the difference version.`,
        },
        {
          kind: "key",
          title: "Sum and difference formulas",
          body: md`$$\sin(A \pm B) = \sin A \cos B \pm \cos A \sin B$$
$$\cos(A \pm B) = \cos A \cos B \mp \sin A \sin B$$
$$\tan(A \pm B) = \frac{\tan A \pm \tan B}{1 \mp \tan A \tan B}$$

Read the stacked signs top with top, bottom with bottom. Sine keeps the sign; cosine flips it. The tangent formula needs $\cos A$, $\cos B$ and $\cos(A \pm B)$ all nonzero.`,
        },
        {
          kind: "plot",
          x: [-6.5, 6.5],
          y: [-2.2, 2.2],
          curves: [
            { expr: "sin(x + c)", label: "y = \\sin(x + c)", color: 1 },
            { expr: "sin(x) cos(c) + cos(x) sin(c)", label: "y = \\sin x \\cos c + \\cos x \\sin c", color: 2, dashed: true },
            { expr: "sin(x) + sin(c)", label: "y = \\sin x + \\sin c\\ \\text{(wrong)}", color: 4, dashed: true },
          ],
          params: [{ name: "c", tex: "c", min: -3, max: 3, step: 0.1, value: 1 }],
          caption: md`Slide $c$. The solid curve $\sin(x + c)$ and the dashed formula lie exactly on top of each other for every $c$. The red "distribute the sine" guess is a different curve: it even leaves the band $-1 \le y \le 1$.`,
        },
        {
          kind: "text",
          body: md`The main use right now is **exact values**. You know sine and cosine at multiples of $30^\circ$ and $45^\circ$. Sums and differences of those reach every multiple of $15^\circ$.`,
        },
        {
          kind: "example",
          title: "sin 75° exactly",
          problem: md`Find the exact value of $\sin 75^\circ$.`,
          steps: [
            { math: md`\sin 75^\circ = \sin(45^\circ + 30^\circ)`, note: "Split into two angles with known values." },
            { math: md`\sin 45^\circ \cos 30^\circ + \cos 45^\circ \sin 30^\circ`, note: "Sine sum formula." },
            { math: md`\frac{\sqrt{2}}{2} \cdot \frac{\sqrt{3}}{2} + \frac{\sqrt{2}}{2} \cdot \frac{1}{2}`, note: "Exact values from the special triangles." },
            { math: md`\frac{\sqrt{6} + \sqrt{2}}{4}`, note: md`$\sqrt{2}\sqrt{3} = \sqrt{6}$; both products have denominator 4. Check: $\approx 0.966$, and $\sin 75^\circ$ should be a little under 1.` },
          ],
        },
        {
          kind: "example",
          title: "Reading a formula backwards",
          problem: md`Find the exact value of $\cos 80^\circ \cos 20^\circ + \sin 80^\circ \sin 20^\circ$.`,
          steps: [
            { math: md`\cos A \cos B + \sin A \sin B = \cos(A - B)`, note: md`The pattern matches the cosine difference formula with $A = 80^\circ$, $B = 20^\circ$.` },
            { math: md`\cos(80^\circ - 20^\circ) = \cos 60^\circ = \frac{1}{2}`, note: "A long expression collapses to a standard angle." },
          ],
        },
        {
          kind: "why",
          title: "The shift identities are sum formulas too",
          body: md`Unit 3 found facts like $\cos(\pi - t) = -\cos t$ from symmetry of the circle. They are also instant consequences of the sum formulas, which is reassuring: two different arguments, one answer.

$$\cos(\pi - t) = \cos \pi \cos t + \sin \pi \sin t = (-1)\cos t + (0)\sin t = -\cos t.$$

Any angle of the form $\frac{k\pi}{2} \pm t$ can be reduced this way, because $\sin$ and $\cos$ of a multiple of $\frac{\pi}{2}$ are $0$, $1$ or $-1$.`,
        },
        {
          kind: "check",
          prompt: md`Find the exact value of $\cos 15^\circ$. ${EXACT}`,
          answer: "(sqrt(6) + sqrt(2))/4",
          simplified: true,
          explain: md`$\cos(45^\circ - 30^\circ) = \cos 45^\circ \cos 30^\circ + \sin 45^\circ \sin 30^\circ = \frac{\sqrt{2}}{2}\cdot\frac{\sqrt{3}}{2} + \frac{\sqrt{2}}{2}\cdot\frac{1}{2} = \frac{\sqrt{6} + \sqrt{2}}{4}$.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $\sin\left(t + \dfrac{\pi}{2}\right)$ to a single trig function. ${TYPE}`,
          answer: "cos(t)",
          simplified: true,
          explain: md`$\sin t \cos\frac{\pi}{2} + \cos t \sin\frac{\pi}{2} = \sin t \cdot 0 + \cos t \cdot 1 = \cos t$. Shifting sine a quarter turn left gives cosine, which matches the graphs in Unit 4.`,
        },
      ],
      practice: [exactSumValue, recogniseFormula, sumFromValues],
    },
    {
      id: slug("Double- and half-angle formulas"),
      title: "Double- and half-angle formulas",
      summary: "Set A = B in the sum formulas to get the double-angle formulas, then run them backwards for half angles.",
      blocks: [
        {
          kind: "text",
          body: md`The sum formulas work for any two angles, including two copies of the same angle. Setting $B = A$ costs nothing and produces the most-used identities after Pythagoras.`,
        },
        {
          kind: "why",
          title: "Why sin(2t) = 2 sin t cos t",
          body: md`Put $A = B = t$ into $\sin(A + B) = \sin A \cos B + \cos A \sin B$:

$$\sin(t + t) = \sin t \cos t + \cos t \sin t = 2\sin t \cos t.$$

Do the same with cosine:

$$\cos(2t) = \cos t \cos t - \sin t \sin t = \cos^2 t - \sin^2 t.$$

Now the Pythagorean identity gives two more forms, each using only one function. Replace $\sin^2 t$ with $1 - \cos^2 t$ to get $\cos(2t) = 2\cos^2 t - 1$; replace $\cos^2 t$ with $1 - \sin^2 t$ to get $\cos(2t) = 1 - 2\sin^2 t$. Which form to use depends on what you know.`,
        },
        {
          kind: "key",
          title: "Double-angle formulas",
          body: md`$$\sin(2t) = 2\sin t \cos t$$
$$\cos(2t) = \cos^2 t - \sin^2 t = 2\cos^2 t - 1 = 1 - 2\sin^2 t$$
$$\tan(2t) = \frac{2\tan t}{1 - \tan^2 t}$$

The angle can be anything: $\sin(6t) = 2\sin(3t)\cos(3t)$ and $\cos t = 1 - 2\sin^2\frac{t}{2}$ are the same formulas with a different letter inside.`,
        },
        {
          kind: "why",
          title: "Tangent, and a warning",
          body: md`Set $A = B = t$ in the tangent sum formula: $\tan(2t) = \dfrac{\tan t + \tan t}{1 - \tan t \tan t} = \dfrac{2\tan t}{1 - \tan^2 t}$.

Notice what these formulas say about a tempting shortcut. $\sin(2t)$ is **not** $2\sin t$. At $t = 90^\circ$: $\sin 180^\circ = 0$ but $2\sin 90^\circ = 2$. Doubling the angle and doubling the output are different things, and the picture below shows how different.`,
        },
        {
          kind: "plot",
          x: [-6.5, 6.5],
          y: [-2.2, 2.2],
          curves: [
            { expr: "cos(2x)", label: "y = \\cos(2x)", color: 1 },
            { expr: "2(cos x)^2 - 1", label: "y = 2\\cos^2 x - 1", color: 2, dashed: true },
            { expr: "2cos(x)", label: "y = 2\\cos x\\ \\text{(not the same)}", color: 4, dashed: true },
          ],
          caption: md`$\cos(2x)$ and $2\cos^2 x - 1$ are one curve drawn twice. $2\cos x$ has the wrong height and the wrong period: it is a stretch, not a squeeze.`,
        },
        {
          kind: "example",
          title: "Double angle from one value",
          problem: md`$\cos t = -\dfrac{3}{5}$ and $t$ is in quadrant II. Find $\sin(2t)$ and $\cos(2t)$.`,
          steps: [
            { math: md`\sin t = +\sqrt{1 - \tfrac{9}{25}} = \frac{4}{5}`, note: "Pythagorean identity; sine is positive in quadrant II." },
            { math: md`\sin(2t) = 2 \cdot \frac{4}{5} \cdot \left(-\frac{3}{5}\right) = -\frac{24}{25}`, note: "Double-angle formula for sine." },
            { math: md`\cos(2t) = 2\cos^2 t - 1 = 2 \cdot \frac{9}{25} - 1 = -\frac{7}{25}`, note: "The form with cosine only, since cosine was given. The sign of sine never mattered for this one." },
            { math: md`\left(-\tfrac{24}{25}\right)^2 + \left(-\tfrac{7}{25}\right)^2 = \tfrac{576 + 49}{625} = 1 \;\checkmark`, note: md`Check: $\sin(2t)$ and $\cos(2t)$ must satisfy the Pythagorean identity too. Both negative puts $2t$ in quadrant III, which fits an angle between $180^\circ$ and $270^\circ$ doubled from one between $90^\circ$ and $135^\circ$.` },
          ],
        },
        {
          kind: "why",
          title: "Running the cosine formula backwards: half angles",
          body: md`Solve $\cos(2t) = 2\cos^2 t - 1$ for $\cos^2 t$, and $\cos(2t) = 1 - 2\sin^2 t$ for $\sin^2 t$:

$$\cos^2 t = \frac{1 + \cos(2t)}{2}, \qquad \sin^2 t = \frac{1 - \cos(2t)}{2}.$$

These are the **power-reducing formulas**: a square on the left, no square on the right. Now rename the angle. The letter $t$ stands for any angle, so put $\frac{u}{2}$ in its place; then $2t$ becomes $u$:

$$\cos^2 \frac{u}{2} = \frac{1 + \cos u}{2}, \qquad \sin^2 \frac{u}{2} = \frac{1 - \cos u}{2}.$$

Taking square roots gives $\cos\frac{u}{2}$ and $\sin\frac{u}{2}$ up to sign. The sign is **not** in the formula. It comes from the quadrant of $\frac{u}{2}$, which you find by halving the range of $u$.`,
        },
        {
          kind: "key",
          title: "Half-angle formulas",
          body: md`$$\sin\frac{u}{2} = \pm\sqrt{\frac{1 - \cos u}{2}}, \qquad \cos\frac{u}{2} = \pm\sqrt{\frac{1 + \cos u}{2}}$$
$$\tan\frac{u}{2} = \frac{1 - \cos u}{\sin u} = \frac{\sin u}{1 + \cos u}$$

Choose $+$ or $-$ from the quadrant that $\frac{u}{2}$ lies in. The tangent forms carry their own sign, so no choice is needed.`,
        },
        {
          kind: "why",
          title: "Why tan(u/2) needs no ± sign",
          body: md`Divide the two half-angle squares: $\tan^2\frac{u}{2} = \dfrac{1 - \cos u}{1 + \cos u}$. Multiply top and bottom by $1 - \cos u$:

$$\tan^2\frac{u}{2} = \frac{(1 - \cos u)^2}{1 - \cos^2 u} = \frac{(1 - \cos u)^2}{\sin^2 u} = \left(\frac{1 - \cos u}{\sin u}\right)^2.$$

So $\tan\frac{u}{2} = \pm\dfrac{1 - \cos u}{\sin u}$. But the numerator $1 - \cos u$ is never negative, so the fraction has the sign of $\sin u$. And $\tan\frac{u}{2}$ also has the sign of $\sin u$: when $u$ is in quadrants I or II (sine positive), $\frac{u}{2}$ is in quadrant I where tangent is positive; when $u$ is in III or IV, $\frac{u}{2}$ is in II where tangent is negative. The signs always match, so the $\pm$ is always $+$. Multiplying top and bottom by $1 + \cos u$ instead gives the other form.`,
        },
        {
          kind: "plot",
          x: [-6.5, 6.5],
          y: [-0.5, 1.5],
          curves: [
            { expr: "(sin(x/2))^2", label: "y = \\sin^2(x/2)", color: 1 },
            { expr: "(1 - cos(x))/2", label: "y = \\frac{1 - \\cos x}{2}", color: 2, dashed: true },
            { expr: "cos(x)", label: "y = \\cos x", color: 3 },
          ],
          caption: md`$\sin^2\frac{x}{2}$ and $\frac{1 - \cos x}{2}$ coincide. The green curve is $\cos x$ itself: flip it, lift it by 1 and halve it, and you get the other two.`,
        },
        {
          kind: "example",
          title: "An exact value at 22.5°",
          problem: md`Find the exact value of $\cos\dfrac{\pi}{8}$.`,
          steps: [
            { math: md`\frac{\pi}{8} = \frac{1}{2} \cdot \frac{\pi}{4}, \qquad \cos\frac{\pi}{4} = \frac{\sqrt{2}}{2}`, note: "Half of a standard angle." },
            { math: md`\cos\frac{\pi}{8} = +\sqrt{\frac{1 + \frac{\sqrt{2}}{2}}{2}}`, note: md`Half-angle formula. $\frac{\pi}{8}$ is in quadrant I, so cosine is positive.` },
            { math: md`\sqrt{\frac{2 + \sqrt{2}}{4}} = \frac{\sqrt{2 + \sqrt{2}}}{2}`, note: md`Multiply top and bottom inside by 2, then $\sqrt{4} = 2$. Check: $\approx 0.924$, and $\cos 22.5^\circ$ should be between $\cos 30^\circ \approx 0.866$ and $1$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\cos(2t)$ when $\cos t = \dfrac{1}{3}$. Give a fraction.`,
          answer: "-7/9",
          explain: md`$\cos(2t) = 2\cos^2 t - 1 = 2 \cdot \frac{1}{9} - 1 = -\frac{7}{9}$. No quadrant was needed, because this form uses only $\cos t$.`,
        },
        {
          kind: "check",
          prompt: md`Find the exact value of $\tan\dfrac{\pi}{8}$. ${EXACT}`,
          answer: "sqrt(2) - 1",
          simplified: true,
          explain: md`$\tan\frac{\pi}{8} = \dfrac{1 - \cos\frac{\pi}{4}}{\sin\frac{\pi}{4}} = \dfrac{1 - \frac{\sqrt{2}}{2}}{\frac{\sqrt{2}}{2}} = \dfrac{2 - \sqrt{2}}{\sqrt{2}} = \sqrt{2} - 1$.`,
        },
      ],
      practice: [doubleFromValue, simplifyDouble, halfAngle],
    },
    {
      id: slug("Proving identities"),
      title: "Proving identities",
      summary: "What it means to prove an identity, why you work on one side, and the moves that get you there.",
      blocks: [
        {
          kind: "text",
          body: md`To **prove an identity** is to show that two expressions are equal for every allowed value of the variable. Testing a few values can't do that: a million agreements don't rule out a disagreement at the next angle. What does prove it is a chain of rewrites, each one already known to be an identity, that turns one side into the other.`,
        },
        {
          kind: "why",
          title: "Why you work on one side",
          body: md`It's tempting to treat the claim like an equation: do the same thing to both sides until something obviously true appears. But that argument runs backwards. Start with the false claim $-1 = 1$ and square both sides: $1 = 1$, which is true. Reaching a truth from a claim doesn't make the claim true, because steps like squaring aren't reversible.

Working on one side avoids the problem. You start from an expression (not a claim), replace it with equal expressions, and arrive at the other side. Every link in the chain is a known identity, so the two ends are equal. Nothing was assumed.`,
        },
        {
          kind: "key",
          title: "The moves",
          body: md`- Start with the more complicated side. It has more to simplify.
- Rewrite everything in terms of $\sin$ and $\cos$ when stuck.
- Combine fractions over a common denominator; split a fraction into pieces when the other side has pieces.
- Factor: difference of squares $u^2 - v^2 = (u - v)(u + v)$ shows up constantly.
- Look for $\sin^2 + \cos^2$, $1 + \tan^2$, $1 + \cot^2$ hiding in sums.
- Multiply a fraction by a **conjugate** over itself: $\dfrac{1 - \cos t}{1 - \cos t}$ turns $1 + \cos t$ into $1 - \cos^2 t = \sin^2 t$.
- Keep the goal in view. Glance at the other side after every step.`,
        },
        {
          kind: "example",
          title: "The conjugate move",
          problem: md`Prove $\dfrac{\sin t}{1 + \cos t} = \dfrac{1 - \cos t}{\sin t}$.`,
          steps: [
            { math: md`\frac{\sin t}{1 + \cos t} \cdot \frac{1 - \cos t}{1 - \cos t}`, note: md`Start on the left. Multiply by 1, written as the conjugate over itself. The target has $1 - \cos t$ on top, which is the clue.` },
            { math: md`\frac{\sin t (1 - \cos t)}{1 - \cos^2 t}`, note: md`$(1 + \cos t)(1 - \cos t) = 1 - \cos^2 t$.` },
            { math: md`\frac{\sin t (1 - \cos t)}{\sin^2 t}`, note: "Pythagorean identity." },
            { math: md`\frac{1 - \cos t}{\sin t}`, note: "Cancel one sine. This is the right side, so the identity is proved." },
          ],
        },
        {
          kind: "proof",
          title: "sec t − cos t = sin t tan t",
          given: md`$\cos t \ne 0$`,
          prove: md`$\sec t - \cos t = \sin t \tan t$`,
          steps: [
            { statement: md`$\sec t - \cos t = \dfrac{1}{\cos t} - \cos t$`, reason: "Reciprocal identity" },
            { statement: md`$= \dfrac{1}{\cos t} - \dfrac{\cos^2 t}{\cos t}$`, reason: md`Write $\cos t$ over the common denominator` },
            { statement: md`$= \dfrac{1 - \cos^2 t}{\cos t}$`, reason: "Subtract the fractions" },
            { statement: md`$= \dfrac{\sin^2 t}{\cos t}$`, reason: "Pythagorean identity" },
            { statement: md`$= \sin t \cdot \dfrac{\sin t}{\cos t}$`, reason: "Split off one factor of sine" },
            { statement: md`$= \sin t \tan t$`, reason: "Quotient identity" },
          ],
        },
        {
          kind: "plot",
          x: [-6.5, 6.5],
          y: [-4, 4],
          curves: [
            { expr: "sec(x) - cos(x)", label: "y = \\sec x - \\cos x", color: 1 },
            { expr: "sin(x) tan(x)", label: "y = \\sin x \\tan x", color: 2, dashed: true },
            { expr: "sin(2x)", label: "y = \\sin(2x)", color: 3 },
            { expr: "2sin(x)", label: "y = 2\\sin x", color: 4, dashed: true },
          ],
          caption: md`The graph test. The first pair lies on one curve, as the proof says it must. The second pair, $\sin(2x)$ and $2\sin x$, visibly disagree, so $\sin(2t) = 2\sin t$ is not an identity. A graph or a single number can **disprove** a claim; only a proof can establish one.`,
        },
        {
          kind: "why",
          title: "One counterexample is enough to disprove",
          body: md`To show an equation is *not* an identity, one value where the sides differ settles it. Is $\sqrt{1 - \cos^2 t} = \sin t$ an identity? Try $t = \frac{3\pi}{2}$: the left side is $\sqrt{1 - 0} = 1$, the right side is $-1$. So no. The correct statement is $\sqrt{1 - \cos^2 t} = |\sin t|$. Square roots of squares always come with absolute values, which is why the half-angle formulas carry a $\pm$.`,
        },
        {
          kind: "example",
          title: "Splitting a fraction",
          problem: md`Prove $\dfrac{\cos t}{1 - \sin t} = \sec t + \tan t$.`,
          steps: [
            { math: md`\frac{\cos t}{1 - \sin t} \cdot \frac{1 + \sin t}{1 + \sin t} = \frac{\cos t (1 + \sin t)}{1 - \sin^2 t}`, note: "Conjugate: the right side has no denominator like $1 - \\sin t$, so get rid of it." },
            { math: md`\frac{\cos t (1 + \sin t)}{\cos^2 t} = \frac{1 + \sin t}{\cos t}`, note: "Pythagorean identity, then cancel." },
            { math: md`\frac{1}{\cos t} + \frac{\sin t}{\cos t}`, note: "The right side is a sum of two terms, so split the fraction into two." },
            { math: md`\sec t + \tan t`, note: "Reciprocal and quotient identities. Done." },
          ],
        },
        {
          kind: "key",
          title: "Mistakes that look like identities",
          body: md`- $\sin(A + B) \ne \sin A + \sin B$. Functions don't distribute.
- $\sin(2t) \ne 2\sin t$ and $\cos^2 t \ne \cos(t^2)$.
- $\sqrt{a^2 + b^2} \ne a + b$, so $\sqrt{\sin^2 t + \cos^2 t} = 1$, not $\sin t + \cos t$.
- $\dfrac{\sin t + 1}{\sin t} \ne 1 + 1$. You can cancel a common **factor**, never a term.
- $1 + \tan^2 t = \sec^2 t$, not $\csc^2 t$. When unsure, divide $\sin^2 t + \cos^2 t = 1$ by $\cos^2 t$ again.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $(\sec t - \tan t)(\sec t + \tan t)$. ${TYPE}`,
          answer: "1",
          simplified: true,
          explain: md`Difference of squares: $\sec^2 t - \tan^2 t$, and $\sec^2 t = 1 + \tan^2 t$, so this is 1.`,
        },
        {
          kind: "check",
          prompt: "Which of these is NOT an identity?",
          choices: [md`$\sin(2t) = 2\sin t$`, md`$\cos^2 t - \sin^2 t = \cos(2t)$`, md`$\sec^2 t - 1 = \tan^2 t$`, md`$\sin(\pi - t) = \sin t$`],
          accept: [md`$\sin(2t) = 2\sin t$`],
          explain: md`At $t = \frac{\pi}{2}$, $\sin \pi = 0$ but $2\sin\frac{\pi}{2} = 2$. The other three are the double-angle formula, a Pythagorean identity and a shift identity.`,
        },
      ],
      practice: [nextStep, simplifyMixed, fillBlank],
    },
  ],
};
