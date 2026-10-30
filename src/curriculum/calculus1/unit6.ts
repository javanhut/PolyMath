import { frac, fracTex, gcd, paren, poly, signed, type Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Fraction and polynomial helpers ─────────────────────────────────────────
// A fraction is [numerator, denominator], reduced, denominator positive.

type Fr = [number, number];
const fr = (n: number, d = 1): Fr => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const fadd = (a: Fr, b: Fr): Fr => fr(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const fmul = (a: Fr, b: Fr): Fr => fr(a[0] * b[0], a[1] * b[1]);
const fpow = (a: Fr, k: number): Fr => fr(a[0] ** k, a[1] ** k);
const ftext = (a: Fr) => frac(a[0], a[1]);
const ftex = (a: Fr) => fracTex(a[0], a[1]);
const isZero = (a: Fr) => a[0] === 0;

/** x^k as it is both typed and typeset. */
const xPow = (k: number, v = "x") => (k === 0 ? "" : k === 1 ? v : `${v}^${k}`);

/** A polynomial is its coefficients by power: [c0, c1, c2] is c0 + c1 x + c2 x^2. Written highest power first. */
const polyTex = (c: number[], v = "x") => poly(c.map((k, i) => [k, xPow(i, v)] as [number, string]).reverse());

/** Evaluate an integer polynomial at a fraction, exactly. */
function polyAt(c: number[], x: Fr): Fr {
  let out: Fr = [0, 1];
  for (let i = c.length - 1; i >= 0; i--) out = fadd(fmul(out, x), fr(c[i]!));
  return out;
}

/** The antiderivative of an integer polynomial, as fractional coefficients by power (constant 0). */
const antiderivative = (c: number[]): Fr[] => [fr(0), ...c.map((k, i) => fr(k, i + 1))];

/** A polynomial with fractional coefficients, highest power first, as LaTeX and as typed text. */
function fpoly(c: Fr[], v = "x"): { tex: string; text: string } {
  let tex = "";
  let text = "";
  for (let i = c.length - 1; i >= 0; i--) {
    const [n, d] = c[i]!;
    if (n === 0) continue;
    const neg = n < 0;
    const an = Math.abs(n);
    const pw = xPow(i, v);
    const one = an === 1 && d === 1 && pw;
    const magTex = one ? pw : d === 1 ? `${an}${pw}` : pw ? `\\frac{${an}${pw}}{${d}}` : `\\frac{${an}}{${d}}`;
    const magText = one ? pw : d === 1 ? `${an}${pw}` : `${an === 1 && pw ? "" : an}${pw}/${d}`;
    if (!tex) {
      tex = neg ? `-${magTex}` : magTex;
      text = neg ? `-${magText}` : magText;
    } else {
      tex += neg ? ` - ${magTex}` : ` + ${magTex}`;
      text += neg ? ` - ${magText}` : ` + ${magText}`;
    }
  }
  return { tex: tex || "0", text: text || "0" };
}

/** A random integer polynomial whose antiderivative has integer coefficients where possible. */
function friendlyPoly(r: Rng, degree: number, allowZero = true): number[] {
  const c: number[] = [];
  for (let k = 0; k <= degree; k++) {
    const m = k === degree ? r.nonzero(-3, 3) : allowZero && r.next() < 0.3 ? 0 : r.nonzero(-3, 3);
    c.push(r.next() < 0.75 ? m * (k + 1) : m);
  }
  return c;
}

// ── Lesson 1: Antiderivatives ───────────────────────────────────────────────

const antiderivativePolynomial: Generator = (r) => {
  const degree = r.int(1, 3);
  const c = friendlyPoly(r, degree);
  const F = fpoly(antiderivative(c));
  const terms = c
    .map((k, i) => [k, i] as const)
    .filter(([k]) => k !== 0)
    .reverse();
  return {
    prompt: md`Find $\int ${polyTex(c).includes(" ") ? `(${polyTex(c)})` : polyTex(c)} \, dx$. Writing $+ C$ is optional.`,
    answer: F.text,
    upToConstant: true,
    hint: md`Integrate term by term. For each power, raise the exponent by 1 and divide by the new exponent: $\int x^n \, dx = \frac{x^{n+1}}{n+1} + C$.`,
    solution: [
      {
        math: terms.map(([k, i]) => `\\int ${poly([[k, xPow(i)]])} \\, dx`).join(" + ").replace(/\+ \\int -/g, "- \\int "),
        note: "Split the sum and pull each constant out: the antiderivative of a sum is the sum of the antiderivatives.",
      },
      ...terms.map(([k, i]) => ({
        math: md`\int ${poly([[k, xPow(i)]])} \, dx = ${fpoly([...Array<Fr>(i + 1).fill(fr(0)), fr(k, i + 1)]).tex} + C`,
        note: i === 0 ? md`A constant $${k}$ is $${k}x^0$; its antiderivative is $${k}x$.` : md`Raise the power to ${i + 1}, divide by ${i + 1}: $${k} \cdot \frac{x^{${i + 1}}}{${i + 1}}$.`,
      })),
      { math: md`${F.tex} + C`, note: md`Check by differentiating: you get back $${polyTex(c)}$.` },
    ],
  };
};

const antiderivativeRewrite: Generator = (r) => {
  const kind = r.int(0, 7);
  const a = r.coef(2, 6);
  let tex = "";
  let answer = "";
  let hint = "";
  let steps: Step[] = [];
  if (kind === 0) {
    const k = a * 3;
    tex = `${k}\\sqrt{x}`;
    answer = `${2 * a}x^(3/2)`;
    hint = md`Write $\sqrt{x}$ as $x^{1/2}$, then use the power rule backwards.`;
    steps = [
      { math: md`\int ${k} x^{1/2} \, dx`, note: md`$\sqrt{x} = x^{1/2}$.` },
      { math: md`${k} \cdot \frac{x^{3/2}}{3/2} + C`, note: md`New exponent $\frac12 + 1 = \frac32$; divide by it.` },
      { math: md`${2 * a} x^{3/2} + C`, note: md`Dividing by $\frac32$ is multiplying by $\frac23$: $${k} \cdot \frac23 = ${2 * a}$.` },
    ];
  } else if (kind === 1) {
    tex = `\\frac{${a}}{x^2}`;
    answer = `-${a}/x`;
    hint = md`Write $\frac{1}{x^2}$ as $x^{-2}$. The power rule works for negative exponents too (except $-1$).`;
    steps = [
      { math: md`\int ${a} x^{-2} \, dx`, note: md`$\frac{1}{x^2} = x^{-2}$.` },
      { math: md`${a} \cdot \frac{x^{-1}}{-1} + C`, note: md`New exponent $-2 + 1 = -1$; divide by $-1$.` },
      { math: md`-\frac{${a}}{x} + C`, note: md`Check: $\frac{d}{dx}\left(-${a}x^{-1}\right) = ${a}x^{-2}$.` },
    ];
  } else if (kind === 2) {
    const k = 2 * a;
    tex = `\\frac{${k}}{x^3}`;
    answer = `-${a}/x^2`;
    hint = md`Write $\frac{1}{x^3}$ as $x^{-3}$, then raise the exponent by 1 to $-2$.`;
    steps = [
      { math: md`\int ${k} x^{-3} \, dx`, note: md`$\frac{1}{x^3} = x^{-3}$.` },
      { math: md`${k} \cdot \frac{x^{-2}}{-2} + C`, note: md`New exponent $-2$; divide by $-2$.` },
      { math: md`-\frac{${a}}{x^2} + C`, note: md`$${k} \div (-2) = -${a}$.` },
    ];
  } else if (kind === 3) {
    const b = r.nonzero(-5, 5);
    tex = `${a}e^x ${signed(b)}`;
    answer = `${a}e^x ${signed(b)}x`;
    hint = md`$e^x$ is its own derivative, so it is its own antiderivative. The constant $${b}$ integrates to $${b}x$.`;
    steps = [
      { math: md`${a}\int e^x \, dx ${signed(b)} \int 1 \, dx`, note: "Split and pull out constants." },
      { math: md`${a}e^x ${signed(b)}x + C`, note: md`$\frac{d}{dx} e^x = e^x$ and $\frac{d}{dx} x = 1$.` },
    ];
  } else if (kind === 4) {
    const b = r.nonzero(-4, 4);
    tex = `${a}\\cos x ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}\\sin x`;
    answer = `${a}sin(x) ${b < 0 ? "+" : "-"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}cos(x)`;
    hint = md`Ask: whose derivative is $\cos x$? Whose derivative is $\sin x$? Watch the sign on the second one.`;
    steps = [
      { math: md`${a}\int \cos x \, dx ${signed(b)} \int \sin x \, dx`, note: "Split and pull out constants." },
      { math: md`${a}\sin x ${signed(b)}(-\cos x) + C`, note: md`$\frac{d}{dx}\sin x = \cos x$, and $\frac{d}{dx}(-\cos x) = \sin x$.` },
      { math: md`${a}\sin x ${b < 0 ? "+" : "-"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}\cos x + C`, note: "Clean up the signs." },
    ];
  } else if (kind === 5) {
    tex = `\\frac{${a}}{x}`;
    answer = `${a}ln(abs(x))`;
    hint = md`The power rule can't do $x^{-1}$ (it would divide by 0). This is the one case that needs $\ln$. Type $\ln|x|$ as ln|x|.`;
    steps = [
      { math: md`${a}\int \frac{1}{x} \, dx`, note: "Pull the constant out." },
      { math: md`${a}\ln|x| + C`, note: md`$\frac{d}{dx}\ln|x| = \frac{1}{x}$ for every $x \ne 0$.` },
    ];
  } else if (kind === 6) {
    tex = `${a}\\sec^2 x`;
    answer = `${a}tan(x)`;
    hint = md`Which trig function has derivative $\sec^2 x$?`;
    steps = [{ math: md`${a}\tan x + C`, note: md`$\frac{d}{dx}\tan x = \sec^2 x$ (Unit 3).` }];
  } else {
    tex = `\\frac{${a}}{1 + x^2}`;
    answer = `${a}atan(x)`;
    hint = md`This is the derivative of an inverse trig function (Unit 4). Type $\arctan x$ as atan(x).`;
    steps = [{ math: md`${a}\arctan x + C`, note: md`$\frac{d}{dx}\arctan x = \frac{1}{1 + x^2}$.` }];
  }
  return {
    prompt: md`Find $\int ${tex} \, dx$. Writing $+ C$ is optional.`,
    answer,
    upToConstant: true,
    hint,
    solution: steps,
  };
};

const initialValue: Generator = (r) => {
  const motion = r.next() < 0.4;
  const v = motion ? "t" : "x";
  const degree = r.int(1, 2);
  // Small coefficients m_k for the antiderivative, so f' = sum (k + 1) m_k x^k integrates to integers.
  const m = Array.from({ length: degree + 1 }, () => r.nonzero(-3, 3));
  const d = m.map((k, i) => k * (i + 1));
  const F = [0, ...m];
  const x0 = motion ? 0 : r.int(-2, 2);
  const C = r.int(-6, 6);
  const y0 = polyAt(F, fr(x0))[0] + C;
  const full = [...F];
  full[0] = C;
  const Ftex = polyTex(full, v);
  const fName = motion ? "s" : "f";
  const fpTex = polyTex(d, v);
  const noC = polyTex(F, v);
  return {
    prompt: motion
      ? md`A particle moves along a line with velocity $v(t) = ${fpTex}$ and starts at position $s(0) = ${y0}$. Find its position $s(t)$.`
      : md`Find $f(x)$ when $f'(x) = ${fpTex}$ and $f(${x0}) = ${y0}$.`,
    answer: polyTex(full, v),
    hint: md`First find every antiderivative: $${fName}(${v}) = ${noC} + C$. Then substitute $${v} = ${x0}$ and solve for $C$.`,
    solution: [
      { math: md`${fName}(${v}) = ${noC} + C`, note: md`Every antiderivative of $${fpTex}$ has this form, for some constant $C$.` },
      { math: md`${fName}(${x0}) = ${polyAt(F, fr(x0))[0]} + C = ${y0}`, note: md`Substitute $${v} = ${x0}$ and use the given value.` },
      { math: md`C = ${C}`, note: "Solve for the constant." },
      { math: md`${fName}(${v}) = ${Ftex}`, note: md`Check: its derivative is $${fpTex}$, and at $${v} = ${x0}$ it equals $${y0}$.` },
    ],
  };
};

// ── Lesson 2: Area and Riemann sums ─────────────────────────────────────────

/** A curve for Riemann-sum practice: integer polynomial, written and typed. */
function riemannCurve(r: Rng): { c: number[]; tex: string } {
  const c = r.pick([
    [1, 0, 1],
    [0, 0, 1],
    [2, 0, 1],
    [1, 2],
    [1, 3],
    [3, 1],
    [0, 0, 0, 1],
    [4, 0, -1],
    [0, 1, 1],
  ] as number[][]);
  return { c, tex: polyTex(c) };
}

/** Partition [a, a + n dx] and the sum of f at the given sample points, exactly. */
function riemannSum(c: number[], xs: Fr[], dx: Fr): { values: Fr[]; sum: Fr } {
  const values = xs.map((x) => polyAt(c, x));
  const sum = fmul(values.reduce((s, v) => fadd(s, v), fr(0)), dx);
  return { values, sum };
}

const substituted = (c: number[], x: Fr) => `(${polyTex(c).replace(/x/g, `(${ftext(x)})`)})`;

const leftRightSum: Generator = (r) => {
  const { c, tex } = riemannCurve(r);
  const n = r.int(2, 4);
  const dx: Fr = r.next() < 0.5 ? fr(1) : fr(1, 2);
  const a = r.int(-1, 2);
  const b = fadd(fr(a), fmul(fr(n), dx));
  const left = r.next() < 0.5;
  const xs = Array.from({ length: n }, (_, i) => fadd(fr(a), fmul(fr(left ? i : i + 1), dx)));
  const { values, sum } = riemannSum(c, xs, dx);
  const name = left ? "L" : "R";
  return {
    prompt: md`Use the ${left ? "left" : "right"} Riemann sum with $n = ${n}$ equal rectangles to approximate the area under $y = ${tex}$ on $[${a}, ${ftext(b)}]$. Give the exact value ($${name}_${n}$) as a fraction or integer.`,
    answer: ftext(sum),
    verify: [`S = (${xs.map((x) => substituted(c, x)).join(" + ")}) * (${ftext(dx)})`],
    figure: {
      kind: "plot",
      x: [a - 1, b[0] / b[1] + 1],
      y: [-1, Math.max(4, Math.ceil(Math.max(...values.map((v) => v[0] / v[1]), polyAt(c, b)[0] / polyAt(c, b)[1]) + 1))],
      curves: [{ expr: polyTex(c), label: md`y = ${tex}` }],
      riemann: { expr: polyTex(c), from: a, to: b[0] / b[1], n, method: left ? "left" : "right" },
    },
    hint: md`$\Delta x = \frac{${ftext(b)} - ${paren(a)}}{${n}} = ${ftex(dx)}$. The ${left ? "left" : "right"} sum uses the ${left ? "left" : "right"} end of each strip as the sample point: $x = ${xs.map(ftex).join(", ")}$.`,
    solution: [
      { math: md`\Delta x = \frac{${ftext(b)} - ${paren(a)}}{${n}} = ${ftex(dx)}`, note: "The width of each rectangle." },
      { math: md`x = ${xs.map(ftex).join(",\\; ")}`, note: md`The ${left ? "left" : "right"} endpoint of each of the ${n} strips.` },
      { math: md`f(x) = ${values.map(ftex).join(",\\; ")}`, note: md`Heights: evaluate $${tex}$ at each sample point.` },
      { math: md`${name}_${n} = \left(${values.map(ftex).join(" + ")}\right) \cdot ${ftex(dx)} = ${ftex(sum)}`, note: "Add the heights, then multiply by the common width." },
    ],
  };
};

const midpointSum: Generator = (r) => {
  const { c, tex } = riemannCurve(r);
  const n = r.int(2, 4);
  const dx: Fr = r.next() < 0.6 ? fr(1) : fr(2);
  const a = r.int(-1, 1);
  const b = fadd(fr(a), fmul(fr(n), dx));
  const xs = Array.from({ length: n }, (_, i) => fadd(fr(a), fmul(fr(2 * i + 1, 2), dx)));
  const { values, sum } = riemannSum(c, xs, dx);
  return {
    prompt: md`Use the midpoint Riemann sum with $n = ${n}$ equal rectangles to approximate the area under $y = ${tex}$ on $[${a}, ${ftext(b)}]$. Give the exact value ($M_${n}$) as a fraction or integer.`,
    answer: ftext(sum),
    verify: [`S = (${xs.map((x) => substituted(c, x)).join(" + ")}) * (${ftext(dx)})`],
    figure: {
      kind: "plot",
      x: [a - 1, b[0] / b[1] + 1],
      y: [-1, Math.max(4, Math.ceil(Math.max(...values.map((v) => v[0] / v[1]), polyAt(c, b)[0] / polyAt(c, b)[1], polyAt(c, fr(a))[0]) + 1))],
      curves: [{ expr: polyTex(c), label: md`y = ${tex}` }],
      riemann: { expr: polyTex(c), from: a, to: b[0] / b[1], n, method: "midpoint" },
    },
    hint: md`$\Delta x = ${ftex(dx)}$. The sample point of each strip is its midpoint, halfway between the strip's ends: $x = ${xs.map(ftex).join(", ")}$.`,
    solution: [
      { math: md`\Delta x = \frac{${ftext(b)} - ${paren(a)}}{${n}} = ${ftex(dx)}`, note: "The width of each rectangle." },
      { math: md`x = ${xs.map(ftex).join(",\\; ")}`, note: md`Midpoints: start at $${a} + \frac{\Delta x}{2}$ and step by $\Delta x$.` },
      { math: md`f(x) = ${values.map(ftex).join(",\\; ")}`, note: md`Evaluate $${tex}$ at each midpoint.` },
      { math: md`M_${n} = \left(${values.map(ftex).join(" + ")}\right) \cdot ${ftex(dx)} = ${ftex(sum)}`, note: "Add the heights, then multiply by the width." },
    ],
  };
};

const limitOfSums: Generator = (r) => {
  const b = r.int(1, 4);
  const kind = r.int(0, 2);
  let closed = "";
  let answer = "";
  let fTex = "";
  let which = "right";
  let steps: Step[] = [];
  if (kind === 0) {
    // y = x^2, right sums: (b^3/n^3) * n(n+1)(2n+1)/6
    const [num, den] = fr(b ** 3, 6);
    closed = `\\frac{${num === 1 ? "" : num}(n+1)(2n+1)}{${den === 1 ? "" : den}n^2}`;
    answer = frac(b ** 3, 3);
    fTex = "x^2";
    steps = [
      { math: md`R_n = \sum_{i=1}^{n} \left(\frac{${b}i}{n}\right)^2 \cdot \frac{${b}}{n} = \frac{${b ** 3}}{n^3} \sum_{i=1}^{n} i^2 = \frac{${b ** 3}}{n^3} \cdot \frac{n(n+1)(2n+1)}{6}`, note: md`Where the closed form comes from: $\Delta x = \frac{${b}}{n}$, $x_i = \frac{${b}i}{n}$, and the formula for $\sum i^2$.` },
      { math: md`${closed} = ${fracTex(num, den)} \cdot \frac{n+1}{n} \cdot \frac{2n+1}{n} = ${fracTex(num, den)}\left(1 + \frac1n\right)\left(2 + \frac1n\right)`, note: md`Divide each factor by $n$.` },
      { math: md`\lim_{n \to \infty} R_n = ${fracTex(num, den)} \cdot 1 \cdot 2 = ${fracTex(b ** 3, 3)}`, note: md`As $n \to \infty$, $\frac1n \to 0$. The exact area under $y = x^2$ on $[0, ${b}]$ is $\frac{${b}^3}{3}$.` },
    ];
  } else if (kind === 1) {
    // y = x^2, left sums: (b^3/n^3) * (n-1)n(2n-1)/6
    const [num, den] = fr(b ** 3, 6);
    closed = `\\frac{${num === 1 ? "" : num}(n-1)(2n-1)}{${den === 1 ? "" : den}n^2}`;
    answer = frac(b ** 3, 3);
    fTex = "x^2";
    which = "left";
    steps = [
      { math: md`L_n = \sum_{i=0}^{n-1} \left(\frac{${b}i}{n}\right)^2 \cdot \frac{${b}}{n} = \frac{${b ** 3}}{n^3} \cdot \frac{(n-1)n(2n-1)}{6}`, note: md`The left sum uses $i = 0, \dots, n - 1$, so the $\sum i^2$ formula is applied with $n - 1$ in place of $n$.` },
      { math: md`${closed} = ${fracTex(num, den)}\left(1 - \frac1n\right)\left(2 - \frac1n\right)`, note: md`Divide each factor by $n$.` },
      { math: md`\lim_{n \to \infty} L_n = ${fracTex(num, den)} \cdot 1 \cdot 2 = ${fracTex(b ** 3, 3)}`, note: md`The same limit as the right sums: the true area is squeezed between $L_n$ and $R_n$.` },
    ];
  } else {
    // y = x^3, right sums: (b^4/n^4) * n^2(n+1)^2/4
    const [num, den] = fr(b ** 4, 4);
    closed = `\\frac{${num === 1 ? "" : num}(n+1)^2}{${den === 1 ? "" : den}n^2}`;
    answer = frac(b ** 4, 4);
    fTex = "x^3";
    steps = [
      { math: md`R_n = \sum_{i=1}^{n} \left(\frac{${b}i}{n}\right)^3 \cdot \frac{${b}}{n} = \frac{${b ** 4}}{n^4} \cdot \frac{n^2(n+1)^2}{4}`, note: md`Using $\sum_{i=1}^{n} i^3 = \frac{n^2(n+1)^2}{4}$.` },
      { math: md`${closed} = ${fracTex(num, den)}\left(1 + \frac1n\right)^2`, note: md`Divide inside by $n$.` },
      { math: md`\lim_{n \to \infty} R_n = ${fracTex(num, den)} \cdot 1 = ${fracTex(b ** 4, 4)}`, note: md`The exact area under $y = x^3$ on $[0, ${b}]$.` },
    ];
  }
  return {
    prompt: md`Find $\lim_{n \to \infty} ${closed}$. This is the limit of the ${which} Riemann sums for $y = ${fTex}$ on $[0, ${b}]$, so it is the exact area under the curve. Give the exact value.`,
    answer,
    hint: md`Divide every factor by $n$: $\frac{n + 1}{n} = 1 + \frac1n$, and $\frac1n \to 0$.`,
    solution: steps,
  };
};

// ── Lesson 3: The definite integral ─────────────────────────────────────────

const lineByGeometry: Generator = (r) => {
  const m = r.pick([1, 2, 3, -1, -2, 1, 2]);
  const crosses = r.next() < 0.4;
  let a: number;
  let b: number;
  let c: number;
  if (crosses) {
    // Root at an integer strictly inside [a, b].
    const root = r.int(-1, 3);
    c = -m * root;
    a = root - r.int(1, 3);
    b = root + r.int(1, 3);
  } else {
    a = r.int(-2, 2);
    b = a + r.int(2, 5);
    // Keep the line positive on [a, b].
    const low = Math.min(m * a, m * b);
    c = -low + r.int(1, 4);
  }
  const f = (x: number) => m * x + c;
  const exact = fadd(fr(m * (b * b - a * a), 2), fr(c * (b - a)));
  const tex = polyTex([c, m]);
  const steps: Step[] = crosses
    ? (() => {
        const root = -c / m;
        const left = fr(f(a) * (root - a), 2);
        const right = fr(f(b) * (b - root), 2);
        return [
          { math: md`${tex} = 0 \iff x = ${root}`, note: "The line crosses the axis inside the interval, so the region is two triangles, one below the axis and one above." },
          { math: md`\text{on } [${a}, ${root}]: \tfrac12 \cdot ${root - a} \cdot ${paren(f(a))} = ${ftex(left)}`, note: md`A triangle of base $${root - a}$ and height $|${f(a)}|$. ${f(a) < 0 ? "It lies below the axis, so it counts negative." : "It lies above the axis, so it counts positive."}` },
          { math: md`\text{on } [${root}, ${b}]: \tfrac12 \cdot ${b - root} \cdot ${paren(f(b))} = ${ftex(right)}`, note: md`${f(b) < 0 ? "Below the axis: negative." : "Above the axis: positive."}` },
          { math: md`\int_{${a}}^{${b}} (${tex}) \, dx = ${ftex(left)} ${right[0] < 0 ? "-" : "+"} ${ftex([Math.abs(right[0]), right[1]])} = ${ftex(exact)}`, note: "Signed areas add." },
        ];
      })()
    : [
        { math: md`f(${a}) = ${f(a)}, \quad f(${b}) = ${f(b)}`, note: "The two parallel sides of the trapezoid: the heights at the ends." },
        { math: md`\text{Area} = \frac{${f(a)} + ${f(b)}}{2} \cdot (${b} - ${paren(a)})`, note: "A trapezoid's area is its average height times its width." },
        { math: md`= ${(f(a) + f(b)) / 2} \cdot ${b - a} = ${ftex(exact)}`, note: md`The line stays above the axis on $[${a}, ${b}]$, so the integral is the ordinary area.` },
      ];
  return {
    prompt: md`Evaluate $\int_{${a}}^{${b}} ${tex.includes(" ") ? `(${tex})` : tex} \, dx$ by interpreting it as signed area (a trapezoid or triangles). Give the exact value.`,
    answer: ftext(exact),
    figure: {
      kind: "plot",
      x: [a - 1, b + 1],
      y: [Math.min(-1, f(a), f(b)) - 1, Math.max(2, f(a), f(b)) + 1],
      curves: [{ expr: polyTex([c, m]), label: md`y = ${tex}` }],
      shade: [{ expr: polyTex([c, m]), from: a, to: b, color: 3 }],
    },
    hint: crosses
      ? md`Find where the line crosses the axis. On one side the triangle is below the axis and counts negative.`
      : md`On $[${a}, ${b}]$ the region under the line is a trapezoid with parallel sides $f(${a})$ and $f(${b})$ and width $${b - a}$.`,
    solution: steps,
  };
};

const circleByGeometry: Generator = (r) => {
  const R = r.int(1, 4);
  const kind = r.int(0, 2);
  const k = kind === 2 ? r.int(1, 3) : 0;
  const lo = kind === 1 ? 0 : -R;
  const body = `\\sqrt{${R * R} - x^2}${k ? ` + ${k}` : ""}`;
  const circlePart = kind === 1 ? fr(R * R, 4) : fr(R * R, 2);
  const rect = k * (R - lo);
  const coef = circlePart[0] === 1 ? "" : String(circlePart[0]);
  const piText = circlePart[1] === 1 ? `${coef}pi` : `${coef}pi/${circlePart[1]}`;
  const piTex = circlePart[1] === 1 ? `${coef}\\pi` : `\\frac{${coef}\\pi}{${circlePart[1]}}`;
  return {
    prompt: md`Evaluate $\int_{${lo}}^{${R}} ${k ? `\\left(${body}\\right)` : body} \, dx$ by interpreting it as area. Give the exact value, e.g. 9pi/2 or 2pi + 6.`,
    answer: rect ? `${piText} + ${rect}` : piText,
    figure: {
      kind: "plot",
      x: [-R - 1, R + 1],
      y: [-1, R + k + 1],
      curves: [{ expr: `sqrt(${R * R} - x^2)${k ? ` + ${k}` : ""}`, label: md`y = ${body}`, domain: [-R, R] }],
      shade: [{ expr: `sqrt(${R * R} - x^2)${k ? ` + ${k}` : ""}`, from: lo, to: R, color: 3 }],
    },
    hint: md`$y = \sqrt{${R * R} - x^2}$ is the upper half of the circle $x^2 + y^2 = ${R}^2$. ${kind === 1 ? "From 0 to " + R + " that is a quarter circle." : "That is a half circle."}${k ? ` Adding ${k} lifts the region by a rectangle of height ${k}.` : ""}`,
    solution: [
      { math: md`y = \sqrt{${R * R} - x^2} \iff x^2 + y^2 = ${R * R},\; y \ge 0`, note: md`Square both sides: the graph is the top half of a circle of radius ${R} centered at the origin.` },
      { math: kind === 1 ? md`\tfrac14 \pi \cdot ${R}^2 = ${piTex}` : md`\tfrac12 \pi \cdot ${R}^2 = ${piTex}`, note: kind === 1 ? "A quarter of the circle's area." : "Half of the circle's area." },
      ...(k
        ? [{ math: md`${k} \cdot (${R} - ${paren(lo)}) = ${rect}`, note: md`The $+${k}$ adds a rectangle of height ${k} and width ${R - lo} under the arc.` }, { math: md`${piTex} + ${rect}`, note: "Total area." }]
        : []),
    ],
  };
};

const integralProperties: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const [a, c, b] = [0, r.int(1, 3), r.int(4, 6)];
    const whole = r.int(5, 12);
    const first = r.int(-3, whole - 1);
    const V = whole - first;
    return {
      prompt: md`Suppose $\int_{${a}}^{${b}} f(x) \, dx = ${whole}$ and $\int_{${a}}^{${c}} f(x) \, dx = ${first}$. Find $\int_{${c}}^{${b}} f(x) \, dx$.`,
      answer: String(V),
      verify: [`${first} + V = ${whole}`],
      hint: md`Integrals over adjacent intervals add: $\int_{${a}}^{${c}} + \int_{${c}}^{${b}} = \int_{${a}}^{${b}}$.`,
      solution: [
        { math: md`\int_{${a}}^{${c}} f \, dx + \int_{${c}}^{${b}} f \, dx = \int_{${a}}^{${b}} f \, dx`, note: "Additivity over intervals." },
        { math: md`${first} + \int_{${c}}^{${b}} f \, dx = ${whole}`, note: "Substitute the known values." },
        { math: md`\int_{${c}}^{${b}} f \, dx = ${V}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const [a, b] = [r.int(-2, 1), r.int(2, 5)];
    const F = r.int(-6, 9);
    const G = r.nonzero(-5, 6);
    const [p, q] = [r.coef(2, 5), r.nonzero(-4, 4)];
    const V = p * F + q * G;
    const gTerm = q < 0 ? `- ${Math.abs(q) === 1 ? "" : Math.abs(q)}g(x)` : `+ ${q === 1 ? "" : q}g(x)`;
    return {
      prompt: md`Suppose $\int_{${a}}^{${b}} f(x) \, dx = ${F}$ and $\int_{${a}}^{${b}} g(x) \, dx = ${G}$. Find $\int_{${a}}^{${b}} \left(${p}f(x) ${gTerm}\right) \, dx$.`,
      answer: String(V),
      verify: [`V = ${p} * (${F}) + (${q}) * (${G})`],
      hint: md`The integral of a sum is the sum of the integrals, and constants factor out.`,
      solution: [
        { math: md`\int (${p}f ${gTerm.replace("(x)", "")}) \, dx = ${p}\int f \, dx ${q < 0 ? "-" : "+"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}\int g \, dx`, note: "Linearity, on the same interval." },
        { math: md`= ${p}(${F}) ${q < 0 ? "-" : "+"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}(${G}) = ${V}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const [a, b] = [r.int(-1, 2), r.int(3, 6)];
    const F = r.int(-5, 10);
    const k = r.nonzero(-4, 4);
    const V = F + k * (b - a);
    return {
      prompt: md`Suppose $\int_{${a}}^{${b}} f(x) \, dx = ${F}$. Find $\int_{${a}}^{${b}} \left(f(x) ${signed(k)}\right) \, dx$.`,
      answer: String(V),
      verify: [`V = ${F} + (${k}) * (${b} - ${paren(a)})`],
      hint: md`Split off the constant: $\int_{${a}}^{${b}} ${k} \, dx$ is a rectangle of height $${k}$ and width $${b - a}$.`,
      solution: [
        { math: md`\int_{${a}}^{${b}} f \, dx + \int_{${a}}^{${b}} ${k} \, dx`, note: "Sum rule." },
        { math: md`${F} + ${k}(${b} - ${paren(a)}) = ${F} ${signed(k * (b - a))} = ${V}`, note: md`A constant integrates to the constant times the length of the interval.` },
      ],
    };
  }
  const [a, b] = [r.int(-2, 1), r.int(2, 5)];
  const F = r.nonzero(-9, 9);
  const k = r.pick([1, 1, 2, 3]);
  const V = -k * F;
  return {
    prompt: md`Suppose $\int_{${a}}^{${b}} f(x) \, dx = ${F}$. Find $\int_{${b}}^{${a}} ${k === 1 ? "" : k}f(x) \, dx$.`,
    answer: String(V),
    verify: [`V = -${k} * (${F})`],
    hint: md`Swapping the limits reverses the sign: every $\Delta x$ becomes negative.`,
    solution: [
      { math: md`\int_{${b}}^{${a}} ${k === 1 ? "" : k}f \, dx = -${k === 1 ? "" : k}\int_{${a}}^{${b}} f \, dx`, note: "Reversed limits flip the sign; the constant factors out." },
      { math: md`= -${k === 1 ? "" : `${k} \\cdot `}${paren(F)} = ${V}`, note: "" },
    ],
  };
};

// ── Lesson 4: The fundamental theorem of calculus ───────────────────────────

const ftcPolynomial: Generator = (r) => {
  const degree = r.int(1, 3);
  const c = friendlyPoly(r, degree);
  const a = r.int(-2, 1);
  const b = a + r.int(1, 3);
  const F = antiderivative(c);
  // Exact: evaluate the fractional antiderivative at b and a.
  const at = (x: number): Fr => F.reduce((s, coef, i) => fadd(s, fmul(coef, fpow(fr(x), i))), fr(0));
  const [FB, FA] = [at(b), at(a)];
  const value = fadd(FB, fmul(fr(-1), FA));
  const Ftex = fpoly(F).tex;
  return {
    prompt: md`Evaluate $\int_{${a}}^{${b}} ${polyTex(c).includes(" ") ? `(${polyTex(c)})` : polyTex(c)} \, dx$. Give the exact value.`,
    answer: ftext(value),
    hint: md`Find an antiderivative $F$ (no $+ C$ needed), then compute $F(${b}) - F(${a})$.`,
    solution: [
      { math: md`F(x) = ${Ftex}`, note: "An antiderivative, term by term. Any constant would cancel in the next step, so leave it out." },
      { math: md`F(${b}) = ${ftex(FB)}, \quad F(${a}) = ${ftex(FA)}`, note: md`Substitute the upper and lower limits${a < 0 ? ", keeping the negative in parentheses" : ""}.` },
      { math: md`\int_{${a}}^{${b}} (${polyTex(c)}) \, dx = ${ftex(FB)} - ${FA[0] < 0 ? `\\left(${ftex(FA)}\\right)` : ftex(FA)} = ${ftex(value)}`, note: "Upper minus lower (FTC part 2)." },
    ],
  };
};

const ftcTranscendental: Generator = (r) => {
  const kind = r.int(0, 8);
  const items: { lo: string; hi: string; body: string; F: string; FbTex: string; FaTex: string; answer: string; note: string }[] = [
    (() => {
      const k = r.int(1, 3);
      return { lo: "0", hi: String(k), body: "e^x", F: "e^x", FbTex: `e^{${k}}`, FaTex: "e^0 = 1", answer: k === 1 ? "e - 1" : `e^${k} - 1`, note: md`$e^x$ is its own antiderivative.` };
    })(),
    (() => {
      const k = r.pick([2, 3, 5]);
      return { lo: "1", hi: String(k), body: "\\frac{1}{x}", F: "\\ln x", FbTex: `\\ln ${k}`, FaTex: "\\ln 1 = 0", answer: `ln(${k})`, note: md`On $[1, ${k}]$, $x > 0$, so $\ln|x| = \ln x$.` };
    })(),
    { lo: "0", hi: "\\pi/2", body: "\\cos x", F: "\\sin x", FbTex: "\\sin\\tfrac{\\pi}{2} = 1", FaTex: "\\sin 0 = 0", answer: "1", note: md`$\frac{d}{dx}\sin x = \cos x$.` },
    { lo: "0", hi: "\\pi", body: "\\sin x", F: "-\\cos x", FbTex: "-\\cos\\pi = 1", FaTex: "-\\cos 0 = -1", answer: "2", note: md`$\frac{d}{dx}(-\cos x) = \sin x$. The whole arch of sine has area exactly 2.` },
    { lo: "0", hi: "\\pi/4", body: "\\sec^2 x", F: "\\tan x", FbTex: "\\tan\\tfrac{\\pi}{4} = 1", FaTex: "\\tan 0 = 0", answer: "1", note: md`$\frac{d}{dx}\tan x = \sec^2 x$.` },
    { lo: "1", hi: "4", body: "\\sqrt{x}", F: "\\tfrac23 x^{3/2}", FbTex: "\\tfrac23 \\cdot 8 = \\tfrac{16}{3}", FaTex: "\\tfrac23", answer: "14/3", note: md`$\sqrt{x} = x^{1/2}$, so the antiderivative is $\frac{x^{3/2}}{3/2} = \frac23 x^{3/2}$. $4^{3/2} = (\sqrt4)^3 = 8$.` },
    { lo: "0", hi: "1", body: "\\frac{1}{1 + x^2}", F: "\\arctan x", FbTex: "\\arctan 1 = \\tfrac{\\pi}{4}", FaTex: "\\arctan 0 = 0", answer: "pi/4", note: md`$\frac{d}{dx}\arctan x = \frac{1}{1 + x^2}$ (Unit 4).` },
    { lo: "1", hi: "e", body: "\\frac{1}{x}", F: "\\ln x", FbTex: "\\ln e = 1", FaTex: "\\ln 1 = 0", answer: "1", note: md`The area under $\frac1x$ from 1 to $e$ is exactly 1; that is one way to define $e$.` },
    (() => {
      const k = r.int(1, 3);
      return { lo: "1", hi: String(k + 1), body: `\\frac{${k * 2}}{x^2}`, F: `-\\frac{${2 * k}}{x}`, FbTex: `-\\frac{${2 * k}}{${k + 1}}`, FaTex: `-${2 * k}`, answer: frac(2 * k * k, k + 1), note: md`$\frac{1}{x^2} = x^{-2}$ has antiderivative $\frac{x^{-1}}{-1} = -\frac1x$.` };
    })(),
  ];
  const it = items[kind]!;
  return {
    prompt: md`Evaluate $\int_{${it.lo}}^{${it.hi}} ${it.body} \, dx$. Give the exact value (for example e^2 - 1, ln(3) or pi/4).`,
    answer: it.answer,
    hint: md`Find an antiderivative $F$, then compute $F(\text{upper}) - F(\text{lower})$.`,
    solution: [
      { math: md`F(x) = ${it.F}`, note: it.note },
      { math: md`F(${it.hi}) = ${it.FbTex}, \quad F(${it.lo}) = ${it.FaTex}`, note: "Evaluate at both limits." },
      { math: md`\int_{${it.lo}}^{${it.hi}} ${it.body} \, dx = ${it.answer.replace(/pi/g, "\\pi").replace(/ln\((\d)\)/g, "\\ln $1").replace(/e\^(\d)/g, "e^{$1}").replace(/^(\d+)\/(\d+)$/, "\\frac{$1}{$2}")}`, note: "Upper minus lower." },
    ],
  };
};

const ftcPartOne: Generator = (r) => {
  // Parenthesise a compound upper limit when it replaces t; a bare x needs none.
  const w = (u: string) => (/^[a-z]$/.test(u) ? u : `(${u})`);
  const integrands = [
    { tex: "\\sqrt{1 + t^3}", text: (u: string) => `sqrt(1 + ${w(u)}^3)`, texAt: (u: string) => `\\sqrt{1 + ${u}^3}` },
    { tex: "\\sin(t^2)", text: (u: string) => `sin(${w(u)}^2)`, texAt: (u: string) => `\\sin(${u}^2)` },
    { tex: "e^{t^2}", text: (u: string) => `e^(${w(u)}^2)`, texAt: (u: string) => `e^{${u}^2}` },
    { tex: "\\frac{1}{1 + t^2}", text: (u: string) => `1/(1 + ${w(u)}^2)`, texAt: (u: string) => `\\frac{1}{1 + ${u}^2}` },
    { tex: "\\cos(t^3)", text: (u: string) => `cos(${w(u)}^3)`, texAt: (u: string) => `\\cos(${u}^3)` },
    { tex: "\\sqrt{t^2 + 4}", text: (u: string) => `sqrt(${w(u)}^2 + 4)`, texAt: (u: string) => `\\sqrt{${u}^2 + 4}` },
  ];
  const f = r.pick(integrands);
  const kind = r.int(0, 2);
  const a = r.int(0, 3);
  if (kind === 0) {
    return {
      prompt: md`Let $g(x) = \int_{${a}}^{x} ${f.tex} \, dt$. Find $g'(x)$.`,
      answer: f.text("x"),
      hint: md`FTC part 1: the derivative of $\int_a^x f(t)\,dt$ with respect to $x$ is just $f(x)$. Replace $t$ by $x$.`,
      solution: [
        { math: md`g'(x) = ${f.texAt("x")}`, note: md`$g$ is the area function of $f(t) = ${f.tex}$ starting at $${a}$. Its rate of change is the height of the curve at the moving edge, $f(x)$. The lower limit $${a}$ doesn't matter.` },
      ],
    };
  }
  if (kind === 1) {
    const [p, q] = r.pick([
      [2, "x^2"],
      [3, "x^3"],
      [2, "x^2"],
    ] as const);
    const uPrime = p === 2 ? "2x" : "3x^2";
    const ans = f.text(q);
    return {
      prompt: md`Let $g(x) = \int_{${a}}^{${q}} ${f.tex} \, dt$. Find $g'(x)$.`,
      answer: `${uPrime} * ${ans}`,
      hint: md`The upper limit is $u = ${q}$, not $x$. Write $g(x) = A(u)$ where $A(u) = \int_{${a}}^{u} ${f.tex}\,dt$, and use the chain rule: $g'(x) = A'(u) \cdot u'$.`,
      solution: [
        { math: md`A(u) = \int_{${a}}^{u} ${f.tex} \, dt, \quad A'(u) = ${f.texAt("u")}`, note: "FTC part 1 for the plain area function." },
        { math: md`g(x) = A(${q}), \quad g'(x) = A'(${q}) \cdot \frac{d}{dx}(${q})`, note: "Chain rule: outer derivative at the inner function, times the inner derivative." },
        { math: md`g'(x) = ${f.texAt(`(${q})`)} \cdot ${uPrime}`, note: md`Replace $u$ by $${q}$ in $A'(u)$, and $\frac{d}{dx}(${q}) = ${uPrime}$.` },
      ],
    };
  }
  const b = r.int(2, 5);
  return {
    prompt: md`Let $h(x) = \int_{x}^{${b}} ${f.tex} \, dt$. Find $h'(x)$.`,
    answer: `-${f.text("x")}`,
    hint: md`The variable is in the lower limit. Swap the limits first: $\int_x^{${b}} = -\int_{${b}}^{x}$.`,
    solution: [
      { math: md`h(x) = -\int_{${b}}^{x} ${f.tex} \, dt`, note: "Reversing the limits changes the sign." },
      { math: md`h'(x) = -${f.texAt("x")}`, note: "FTC part 1 on the integral with the variable up top, then keep the minus." },
    ],
  };
};

// ── Lesson 5: Substitution ──────────────────────────────────────────────────

const linearInside: Generator = (r) => {
  const a = r.coef(2, 5);
  const b = r.nonzero(-6, 6);
  const inner = poly([[a, "x"], [b, ""]]);
  const kind = r.int(0, 5);
  let tex = "";
  let answer = "";
  let steps: Step[] = [];
  let uSub = md`Let $u = ${inner}$, so $du = ${a} \, dx$ and $dx = \frac{du}{${a}}$.`;
  if (kind === 0) {
    const n = r.int(2, 5);
    tex = `(${inner})^${n}`;
    answer = `(${inner})^${n + 1}/${a * (n + 1)}`;
    steps = [
      { math: md`\int u^${n} \cdot \frac{du}{${a}} = \frac{1}{${a}} \cdot \frac{u^${n + 1}}{${n + 1}} + C`, note: uSub },
      { math: md`\frac{(${inner})^${n + 1}}{${a * (n + 1)}} + C`, note: md`Put $u = ${inner}$ back. Check: the chain rule gives back $(${inner})^${n}$ times $${a}$, over $${a}$.` },
    ];
  } else if (kind === 1) {
    tex = `e^{${inner}}`;
    answer = `e^(${inner})/${a}`;
    steps = [
      { math: md`\int e^u \cdot \frac{du}{${a}} = \frac{1}{${a}} e^u + C`, note: uSub },
      { math: md`\frac{e^{${inner}}}{${a}} + C`, note: md`Back to $x$. Differentiating gives $e^{${inner}} \cdot ${a} / ${a}$: correct.` },
    ];
  } else if (kind === 2) {
    tex = `\\cos(${inner})`;
    answer = `sin(${inner})/${a}`;
    steps = [
      { math: md`\int \cos u \cdot \frac{du}{${a}} = \frac{1}{${a}} \sin u + C`, note: uSub },
      { math: md`\frac{\sin(${inner})}{${a}} + C`, note: "Back to $x$." },
    ];
  } else if (kind === 3) {
    tex = `\\sin(${inner})`;
    answer = `-cos(${inner})/${a}`;
    steps = [
      { math: md`\int \sin u \cdot \frac{du}{${a}} = -\frac{1}{${a}} \cos u + C`, note: uSub },
      { math: md`-\frac{\cos(${inner})}{${a}} + C`, note: "Back to $x$." },
    ];
  } else if (kind === 4) {
    tex = `\\frac{1}{${inner}}`;
    answer = `ln(abs(${inner}))/${a}`;
    uSub += md` Type $\ln|u|$ as ln|u|.`;
    steps = [
      { math: md`\int \frac{1}{u} \cdot \frac{du}{${a}} = \frac{1}{${a}} \ln|u| + C`, note: uSub },
      { math: md`\frac{\ln|${inner}|}{${a}} + C`, note: "Back to $x$." },
    ];
  } else {
    tex = `\\sqrt{${inner}}`;
    answer = `2(${inner})^(3/2)/${3 * a}`;
    steps = [
      { math: md`\int u^{1/2} \cdot \frac{du}{${a}} = \frac{1}{${a}} \cdot \frac{u^{3/2}}{3/2} + C = \frac{2}{${3 * a}} u^{3/2} + C`, note: uSub },
      { math: md`\frac{2(${inner})^{3/2}}{${3 * a}} + C`, note: "Back to $x$." },
    ];
  }
  return {
    prompt: md`Find $\int ${tex} \, dx$. Writing $+ C$ is optional.`,
    answer,
    upToConstant: true,
    hint: md`Substitute $u = ${inner}$. Then $du = ${a}\,dx$, so replace $dx$ with $\frac{du}{${a}}$.`,
    solution: steps,
  };
};

const innerFunction: Generator = (r) => {
  const kind = r.int(0, 6);
  const c = r.int(1, 5);
  let tex = "";
  let answer = "";
  let u = "";
  let du = "";
  let steps: Step[] = [];
  if (kind === 0) {
    const n = r.int(2, 4);
    tex = `x(x^2 + ${c})^${n}`;
    answer = `(x^2 + ${c})^${n + 1}/${2 * (n + 1)}`;
    u = `x^2 + ${c}`;
    du = "2x \\, dx";
    steps = [
      { math: md`x \, dx = \tfrac12 \, du`, note: md`$du = 2x\,dx$, and the integrand has an $x\,dx$ in it, so $x\,dx = \frac12 du$.` },
      { math: md`\int u^${n} \cdot \tfrac12 \, du = \tfrac12 \cdot \frac{u^${n + 1}}{${n + 1}} + C`, note: "Power rule in u." },
      { math: md`\frac{(x^2 + ${c})^${n + 1}}{${2 * (n + 1)}} + C`, note: "Back to x." },
    ];
  } else if (kind === 1) {
    const k = r.pick([1, 2, 4]);
    tex = `${k === 1 ? "" : k}x e^{x^2}`;
    answer = k === 1 ? "e^(x^2)/2" : k === 2 ? "e^(x^2)" : "2e^(x^2)";
    u = "x^2";
    du = "2x \\, dx";
    steps = [
      { math: md`${k}x \, dx = ${fracTex(k, 2)} \, du`, note: md`$du = 2x\,dx$.` },
      { math: md`\int e^u \cdot ${fracTex(k, 2)} \, du = ${fracTex(k, 2)} e^u + C`, note: "" },
      { math: md`${k === 2 ? "" : fracTex(k, 2)} e^{x^2} + C`, note: "Back to x." },
    ];
  } else if (kind === 2) {
    tex = `x \\cos(x^2)`;
    answer = `sin(x^2)/2`;
    u = "x^2";
    du = "2x \\, dx";
    steps = [
      { math: md`\int \cos u \cdot \tfrac12 \, du = \tfrac12 \sin u + C`, note: md`$x\,dx = \frac12 du$.` },
      { math: md`\frac{\sin(x^2)}{2} + C`, note: "Back to x." },
    ];
  } else if (kind === 3) {
    tex = `\\frac{x}{x^2 + ${c}}`;
    answer = `ln(x^2 + ${c})/2`;
    u = `x^2 + ${c}`;
    du = "2x \\, dx";
    steps = [
      { math: md`\int \frac{1}{u} \cdot \tfrac12 \, du = \tfrac12 \ln|u| + C`, note: md`$x\,dx = \frac12 du$.` },
      { math: md`\frac{\ln(x^2 + ${c})}{2} + C`, note: md`$x^2 + ${c} > 0$, so the absolute value isn't needed.` },
    ];
  } else if (kind === 4) {
    const n = r.int(2, 4);
    tex = `x^2 (x^3 + ${c})^${n}`;
    answer = `(x^3 + ${c})^${n + 1}/${3 * (n + 1)}`;
    u = `x^3 + ${c}`;
    du = "3x^2 \\, dx";
    steps = [
      { math: md`x^2 \, dx = \tfrac13 \, du`, note: md`$du = 3x^2\,dx$.` },
      { math: md`\int u^${n} \cdot \tfrac13 \, du = \frac{u^${n + 1}}{${3 * (n + 1)}} + C`, note: "" },
      { math: md`\frac{(x^3 + ${c})^${n + 1}}{${3 * (n + 1)}} + C`, note: "Back to x." },
    ];
  } else if (kind === 5) {
    const n = r.int(2, 4);
    tex = `\\sin^${n} x \\cos x`;
    answer = `(sin(x))^${n + 1}/${n + 1}`;
    u = "\\sin x";
    du = "\\cos x \\, dx";
    steps = [
      { math: md`\int u^${n} \, du = \frac{u^${n + 1}}{${n + 1}} + C`, note: md`The $\cos x\,dx$ is exactly $du$.` },
      { math: md`\frac{\sin^${n + 1} x}{${n + 1}} + C`, note: md`Back to x. Type it as (sin(x))^${n + 1}/${n + 1}.` },
    ];
  } else {
    tex = `\\frac{\\ln x}{x}`;
    answer = `(ln(x))^2/2`;
    u = "\\ln x";
    du = "\\frac{1}{x} \\, dx";
    steps = [
      { math: md`\int u \, du = \frac{u^2}{2} + C`, note: md`The $\frac{1}{x}\,dx$ is exactly $du$.` },
      { math: md`\frac{(\ln x)^2}{2} + C`, note: "Back to x. Type it as (ln(x))^2/2." },
    ];
  }
  return {
    prompt: md`Find $\int ${tex} \, dx$. Writing $+ C$ is optional.`,
    answer,
    upToConstant: true,
    hint: md`Look for an inside function whose derivative is also a factor. Try $u = ${u}$, $du = ${du}$.`,
    solution: [{ math: md`u = ${u}, \quad du = ${du}`, note: "Choose the inside function as u." }, ...steps],
  };
};

const definiteSubstitution: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const c = r.int(1, 3);
    const n = r.int(2, 3);
    const b = r.int(1, 2);
    const hi = b * b + c;
    const value = fr(hi ** (n + 1) - c ** (n + 1), 2 * (n + 1));
    return {
      prompt: md`Evaluate $\int_{0}^{${b}} x(x^2 + ${c})^${n} \, dx$. Give the exact value.`,
      answer: ftext(value),
      hint: md`Let $u = x^2 + ${c}$. Change the limits too: $x = 0$ gives $u = ${c}$, and $x = ${b}$ gives $u = ${hi}$.`,
      solution: [
        { math: md`u = x^2 + ${c}, \quad du = 2x\,dx, \quad x\,dx = \tfrac12\,du`, note: "The substitution." },
        { math: md`x = 0 \Rightarrow u = ${c}, \qquad x = ${b} \Rightarrow u = ${hi}`, note: "New limits: the u-values at the old limits." },
        { math: md`\int_{${c}}^{${hi}} \tfrac12 u^${n} \, du = \left[\frac{u^${n + 1}}{${2 * (n + 1)}}\right]_{${c}}^{${hi}}`, note: "Integrate in u. No need to go back to x." },
        { math: md`\frac{${hi}^${n + 1} - ${c}^${n + 1}}{${2 * (n + 1)}} = ${ftex(value)}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const b = r.int(1, 2);
    const hi = b * b;
    return {
      prompt: md`Evaluate $\int_{0}^{${b}} x e^{x^2} \, dx$. Give the exact value, e.g. (e^4 - 1)/2.`,
      answer: `(e^${hi} - 1)/2`,
      hint: md`Let $u = x^2$. The limits become $u = 0$ and $u = ${hi}$.`,
      solution: [
        { math: md`u = x^2, \quad x\,dx = \tfrac12\,du; \quad x = 0 \Rightarrow u = 0, \; x = ${b} \Rightarrow u = ${hi}`, note: "Substitute and change the limits." },
        { math: md`\tfrac12 \int_{0}^{${hi}} e^u \, du = \tfrac12 \left[e^u\right]_0^{${hi}}`, note: "" },
        { math: md`\frac{e^{${hi}} - 1}{2}`, note: md`$e^0 = 1$.` },
      ],
    };
  }
  if (kind === 2) {
    const c = r.int(1, 4);
    const b = r.int(1, 3);
    const hi = b * b + c;
    const ratio = fr(hi, c);
    const ratioTex = ratio[1] === 1 ? String(ratio[0]) : `\\frac{${ratio[0]}}{${ratio[1]}}`;
    const ratioText = ratio[1] === 1 ? String(ratio[0]) : `${ratio[0]}/${ratio[1]}`;
    return {
      prompt: md`Evaluate $\int_{0}^{${b}} \frac{x}{x^2 + ${c}} \, dx$. Give the exact value, e.g. ln(5)/2.`,
      answer: `ln(${ratioText})/2`,
      hint: md`Let $u = x^2 + ${c}$, with new limits $u = ${c}$ and $u = ${hi}$. Remember $\ln a - \ln b = \ln\frac{a}{b}$.`,
      solution: [
        { math: md`u = x^2 + ${c}, \quad x\,dx = \tfrac12\,du; \quad u: ${c} \to ${hi}`, note: "Substitute and change the limits." },
        { math: md`\tfrac12 \int_{${c}}^{${hi}} \frac{du}{u} = \tfrac12 \left[\ln u\right]_{${c}}^{${hi}} = \tfrac12(\ln ${hi} - \ln ${c})`, note: md`$u > 0$ throughout, so no absolute value.` },
        { math: md`\frac{\ln ${ratioTex}}{2}`, note: md`Log of a quotient.${c === 1 ? " Since ln 1 = 0 this is just ln " + hi + " over 2." : ""}` },
      ],
    };
  }
  if (kind === 3) {
    const n = r.int(2, 4);
    return {
      prompt: md`Evaluate $\int_{0}^{\pi/2} \sin^${n} x \cos x \, dx$. Give the exact value.`,
      answer: `1/${n + 1}`,
      hint: md`Let $u = \sin x$, so $du = \cos x\,dx$. At $x = 0$, $u = 0$; at $x = \frac{\pi}{2}$, $u = 1$.`,
      solution: [
        { math: md`u = \sin x, \quad du = \cos x \, dx; \quad u: 0 \to 1`, note: "Substitute and change the limits." },
        { math: md`\int_{0}^{1} u^${n} \, du = \left[\frac{u^${n + 1}}{${n + 1}}\right]_0^1 = \frac{1}{${n + 1}}`, note: "" },
      ],
    };
  }
  const a = r.pick([2, 3]);
  const b0 = r.int(1, 3);
  const n = r.int(2, 3);
  const top = r.int(1, 2);
  const uLo = b0;
  const uHi = a * top + b0;
  const value = fr(uHi ** (n + 1) - uLo ** (n + 1), a * (n + 1));
  const inner = `${a}x + ${b0}`;
  return {
    prompt: md`Evaluate $\int_{0}^{${top}} (${inner})^${n} \, dx$. Give the exact value.`,
    answer: ftext(value),
    hint: md`Let $u = ${inner}$, $du = ${a}\,dx$. The limits become $u = ${uLo}$ and $u = ${uHi}$.`,
    solution: [
      { math: md`u = ${inner}, \quad dx = \frac{du}{${a}}; \quad u: ${uLo} \to ${uHi}`, note: "Substitute and change the limits." },
      { math: md`\frac{1}{${a}} \int_{${uLo}}^{${uHi}} u^${n} \, du = \left[\frac{u^${n + 1}}{${a * (n + 1)}}\right]_{${uLo}}^{${uHi}}`, note: "" },
      { math: md`\frac{${uHi}^${n + 1} - ${uLo}^${n + 1}}{${a * (n + 1)}} = ${ftex(value)}`, note: "" },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit6: Unit = {
  title: "Integrals",
  lessons: [
    {
      id: slug("Antiderivatives"),
      title: "Antiderivatives",
      summary: "Running differentiation backwards: what function has this derivative? Why the answer is a whole family, and how a starting value picks one member out.",
      blocks: [
        {
          kind: "text",
          body: md`For five units the question has been: here is a function, what is its rate of change? Now we turn it around. A car's speedometer reads $v(t) = 2t$ meters per second. Where is the car? We know the derivative of the position and want the position itself.

A function whose derivative is $2t$ is $t^2$, since $\frac{d}{dt} t^2 = 2t$. But $t^2 + 5$ also works, and so does $t^2 - 100$. Differentiating kills constants, so running it backwards can't recover them. That is the whole story of this lesson: the answer is a family, and one extra piece of information picks out the member you want.`,
        },
        {
          kind: "key",
          title: "Antiderivative",
          body: md`A function $F$ is an **antiderivative** of $f$ on an interval when $F'(x) = f(x)$ for every $x$ in it.

If $F$ is one antiderivative of $f$, then every antiderivative is $F(x) + C$ for some constant $C$. We write the whole family as

$$\int f(x) \, dx = F(x) + C,$$

read "the indefinite integral of $f$". $C$ is the **constant of integration**.`,
        },
        {
          kind: "why",
          title: "Why every antiderivative is F + C",
          body: md`That $F + C$ is an antiderivative is easy: $(F + C)' = F' + 0 = f$. The real claim is the other direction, that there are no *other* antiderivatives hiding somewhere.

Suppose $G$ is any antiderivative of $f$, and look at the difference $H = G - F$. Its derivative is $G' - F' = f - f = 0$ everywhere on the interval. Unit 5 proved, from the Mean Value Theorem, that a function with derivative 0 on an interval is constant. So $H = C$, which means $G = F + C$.

The phrase "on an interval" matters. On the two separate pieces of the domain of $\frac{1}{x}$, the constant could be different on each piece. Within one unbroken interval there is only one.`,
        },
        {
          kind: "proof",
          title: "Two antiderivatives differ by a constant",
          given: md`$F'(x) = G'(x)$ for every $x$ in an interval $I$`,
          prove: md`$G(x) = F(x) + C$ on $I$ for some constant $C$`,
          steps: [
            { statement: md`Let $H(x) = G(x) - F(x)$.`, reason: "Definition" },
            { statement: md`$H'(x) = G'(x) - F'(x) = 0$ on $I$`, reason: "Difference rule; the derivatives are equal" },
            { statement: md`For any $a < b$ in $I$, $H(b) - H(a) = H'(c)(b - a)$ for some $c$ between them`, reason: "Mean Value Theorem (Unit 5)" },
            { statement: md`$H(b) - H(a) = 0 \cdot (b - a) = 0$, so $H(a) = H(b)$`, reason: md`$H'(c) = 0$` },
            { statement: md`$H$ takes one value $C$ on all of $I$`, reason: "Any two values of H are equal" },
            { statement: md`$G(x) = F(x) + C$`, reason: md`$H = G - F$` },
          ],
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-5, 5],
          curves: [
            { expr: "x^3/3 - x + c", label: md`y = \tfrac{x^3}{3} - x + C` },
            { expr: "x^3/3 - x", dashed: true, color: 2, label: md`C = 0` },
          ],
          params: [{ name: "c", tex: "C", min: -3, max: 3, step: 0.5, value: 1.5 }],
          caption: md`Every antiderivative of $x^2 - 1$. Slide $C$: the curve moves straight up or down, so its slope at any given $x$ never changes. Same derivative, different height.`,
        },
        {
          kind: "text",
          body: md`Every derivative rule, read backwards, is an antiderivative rule. The power rule $\frac{d}{dx} x^{n+1} = (n+1)x^n$ says that $x^{n+1}$ is "almost" an antiderivative of $x^n$: off by the factor $n + 1$. Divide it away.`,
        },
        {
          kind: "key",
          title: "Basic antiderivatives",
          body: md`Each line is a derivative rule from Units 3 and 4, reversed. $C$ is any constant.

- $\int x^n \, dx = \dfrac{x^{n+1}}{n+1} + C$ for $n \ne -1$ (any real $n$, including fractions and negatives)
- $\int \dfrac{1}{x} \, dx = \ln|x| + C$
- $\int e^x \, dx = e^x + C$
- $\int \cos x \, dx = \sin x + C$, and $\int \sin x \, dx = -\cos x + C$
- $\int \sec^2 x \, dx = \tan x + C$
- $\int \dfrac{1}{1 + x^2} \, dx = \arctan x + C$, and $\int \dfrac{1}{\sqrt{1 - x^2}} \, dx = \arcsin x + C$
- $\int k f(x) \, dx = k \int f(x) \, dx$, and $\int \left(f(x) + g(x)\right) dx = \int f(x) \, dx + \int g(x) \, dx$`,
        },
        {
          kind: "why",
          title: "Why the power rule reverses, and why n = −1 is left out",
          body: md`Check the claim by differentiating: $\frac{d}{dx}\frac{x^{n+1}}{n+1} = \frac{(n+1)x^n}{n+1} = x^n$. That is all an antiderivative has to do. The rule holds for every real $n$ where the power rule holds, so $\sqrt{x} = x^{1/2}$ and $\frac{1}{x^2} = x^{-2}$ are covered.

For $n = -1$ the formula would divide by $n + 1 = 0$. The pattern breaks exactly there, and something new fills the gap: Unit 3 showed $\frac{d}{dx}\ln x = \frac{1}{x}$ for $x > 0$. For $x < 0$, $\ln(-x)$ has derivative $\frac{-1}{-x} = \frac{1}{x}$ by the chain rule. Both cases together say $\frac{d}{dx}\ln|x| = \frac{1}{x}$ for every $x \ne 0$.

The two linearity rules come from the constant multiple and sum rules for derivatives: if $F' = f$ and $G' = g$, then $(kF)' = kf$ and $(F + G)' = f + g$.`,
        },
        {
          kind: "example",
          title: "Term by term",
          problem: md`Find $\int (6x^2 - 4x + 5) \, dx$.`,
          steps: [
            { math: md`6\int x^2 \, dx - 4\int x \, dx + 5\int 1 \, dx`, note: "Split the sum and pull out the constants (linearity)." },
            { math: md`6 \cdot \frac{x^3}{3} - 4 \cdot \frac{x^2}{2} + 5x + C`, note: md`Power rule reversed on each term. $1 = x^0$ becomes $\frac{x^1}{1}$. One $C$ covers all three.` },
            { math: md`2x^3 - 2x^2 + 5x + C`, note: md`Check: differentiate and you get $6x^2 - 4x + 5$ back.` },
          ],
        },
        {
          kind: "example",
          title: "Rewrite first",
          problem: md`Find $\int \left(3\sqrt{x} - \frac{2}{x^3}\right) dx$.`,
          steps: [
            { math: md`\int \left(3x^{1/2} - 2x^{-3}\right) dx`, note: "Roots and fractions are powers in disguise. Write them as powers before integrating." },
            { math: md`3 \cdot \frac{x^{3/2}}{3/2} - 2 \cdot \frac{x^{-2}}{-2} + C`, note: md`Raise each exponent by 1 ($\frac12 \to \frac32$, $-3 \to -2$) and divide by the new exponent.` },
            { math: md`2x^{3/2} + \frac{1}{x^2} + C`, note: md`Dividing by $\frac32$ multiplies by $\frac23$: $3 \cdot \frac23 = 2$. And $-2 \div (-2) = 1$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\int (4x^3 - 2x) \, dx$. Writing $+ C$ is optional.`,
          answer: "x^4 - x^2",
          upToConstant: true,
          explain: md`$4 \cdot \frac{x^4}{4} = x^4$ and $2 \cdot \frac{x^2}{2} = x^2$, so the family is $x^4 - x^2 + C$.`,
        },
        {
          kind: "text",
          body: md`**Picking one member of the family.** The family $\int f \, dx = F(x) + C$ has one curve through every point. If you know a single value of the function you want, substitute it and solve for $C$. This is an **initial value problem**: the derivative plus one starting value determine the function completely.`,
        },
        {
          kind: "example",
          title: "An initial value problem",
          problem: md`A particle moves with velocity $v(t) = 6t^2 - 4t$ and is at position $s(0) = 3$. Find $s(t)$.`,
          steps: [
            { math: md`s(t) = \int (6t^2 - 4t) \, dt = 2t^3 - 2t^2 + C`, note: "Position is an antiderivative of velocity, because velocity is the derivative of position." },
            { math: md`s(0) = 0 - 0 + C = 3`, note: md`Use the starting position: substitute $t = 0$.` },
            { math: md`s(t) = 2t^3 - 2t^2 + 3`, note: md`$C = 3$. Of all the curves in the family, this is the one through $(0, 3)$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`$f'(x) = 2x + 3$ and $f(1) = 6$. Find $f(2)$.`,
          answer: "12",
          explain: md`$f(x) = x^2 + 3x + C$. Then $f(1) = 4 + C = 6$ gives $C = 2$, so $f(x) = x^2 + 3x + 2$ and $f(2) = 4 + 6 + 2 = 12$.`,
        },
      ],
      practice: [antiderivativePolynomial, antiderivativeRewrite, initialValue],
    },
    {
      id: slug("Area and Riemann sums"),
      title: "Area and Riemann sums",
      summary: "Approximating the area under a curve with rectangles, writing the approximation with sigma notation, and taking the limit to get the exact area.",
      blocks: [
        {
          kind: "text",
          body: md`Here is a question that looks unrelated to derivatives: what is the area under $y = x^2$ from $x = 0$ to $x = 2$? Geometry has formulas for triangles, trapezoids and circles, but not for a region with a curved top. We need a new idea, and the idea is the one that made limits work in Unit 1: approximate, then improve the approximation without end.

Cut the interval $[0, 2]$ into strips of equal width and stand a rectangle on each strip. The rectangles have a total area we can compute. Use more strips and the fit gets better. The exact area is what the totals approach.`,
        },
        {
          kind: "plot",
          x: [-0.5, 2.5],
          y: [-0.5, 4.5],
          curves: [{ expr: "x^2", label: md`y = x^2` }],
          riemann: { expr: "x^2", from: 0, to: 2, n: "n", method: "left" },
          params: [{ name: "n", label: "n", min: 1, max: 40, step: 1, value: 4 }],
          caption: md`Left rectangles: each one's height is the curve's value at the **left** edge of its strip. With $n = {n}$ strips the total is $L_n = {=4(n-1)(2n-1)/(3n^2)}$. Since $x^2$ is increasing here, every left rectangle sits under the curve, so $L_n$ is too small.`,
        },
        {
          kind: "plot",
          x: [-0.5, 2.5],
          y: [-0.5, 4.5],
          curves: [{ expr: "x^2", label: md`y = x^2` }],
          riemann: { expr: "x^2", from: 0, to: 2, n: "n", method: "right", color: 2 },
          params: [{ name: "n", label: "n", min: 1, max: 40, step: 1, value: 4 }],
          caption: md`Right rectangles: heights taken at the **right** edge. With $n = {n}$ strips, $R_n = {=4(n+1)(2n+1)/(3n^2)}$: too big. The true area is trapped between $L_n$ and $R_n$, and the gap $R_n - L_n = {=8/n}$ shrinks to 0 as $n$ grows.`,
        },
        {
          kind: "key",
          title: "Riemann sums",
          body: md`To approximate the area under $y = f(x)$ on $[a, b]$ with $n$ rectangles:

- Width of each strip: $\Delta x = \dfrac{b - a}{n}$.
- Cut points: $x_0 = a,\; x_1 = a + \Delta x,\; x_2 = a + 2\Delta x,\; \dots,\; x_n = b$. In general $x_i = a + i\,\Delta x$.
- **Left sum** $L_n = \displaystyle\sum_{i=0}^{n-1} f(x_i)\,\Delta x$, **right sum** $R_n = \displaystyle\sum_{i=1}^{n} f(x_i)\,\Delta x$, **midpoint sum** $M_n = \displaystyle\sum_{i=1}^{n} f\!\left(\tfrac{x_{i-1} + x_i}{2}\right)\Delta x$.

Any such sum, height sampled anywhere in each strip, is a **Riemann sum**. $\sum$ is sigma notation from Algebra 3: $\sum_{i=1}^{n} a_i$ means $a_1 + a_2 + \cdots + a_n$.`,
        },
        {
          kind: "why",
          title: "Why the area is squeezed between the left and right sums",
          body: md`Take one strip of an increasing function. The curve's lowest point on the strip is at the left edge and its highest is at the right edge. So the left rectangle fits inside the region under the curve, and the right rectangle contains it: left area $\le$ true area $\le$ right area, strip by strip. Adding over all strips, $L_n \le \text{Area} \le R_n$.

For a decreasing function the roles swap, and the area is still trapped between them. The difference $R_n - L_n$ is the sum of the little rectangles between the two staircases. For a monotonic function, slide them all sideways into one column: they stack to a single rectangle of width $\Delta x$ and height $|f(b) - f(a)|$. Its area $|f(b) - f(a)|\,\Delta x \to 0$ as $n \to \infty$. Two numbers that trap the area and squeeze together can only be squeezing onto the area itself.`,
        },
        {
          kind: "example",
          title: "Four rectangles by hand",
          problem: md`Compute $L_4$ and $R_4$ for $y = x^2$ on $[0, 2]$.`,
          steps: [
            { math: md`\Delta x = \frac{2 - 0}{4} = \frac12, \qquad x_i = 0,\ \tfrac12,\ 1,\ \tfrac32,\ 2`, note: "Five cut points make four strips." },
            { math: md`f(x_i) = 0,\ \tfrac14,\ 1,\ \tfrac94,\ 4`, note: md`Heights: square each cut point.` },
            { math: md`L_4 = \left(0 + \tfrac14 + 1 + \tfrac94\right)\tfrac12 = \tfrac{7}{2} \cdot \tfrac12 = \tfrac74`, note: "The left sum uses the first four heights." },
            { math: md`R_4 = \left(\tfrac14 + 1 + \tfrac94 + 4\right)\tfrac12 = \tfrac{15}{2} \cdot \tfrac12 = \tfrac{15}{4}`, note: md`The right sum uses the last four. So $1.75 \le \text{Area} \le 3.75$. Rough, but honest bounds.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Compute the right Riemann sum $R_2$ for $y = x^2$ on $[0, 2]$ (two rectangles). Give the exact value.`,
          answer: "5",
          explain: md`$\Delta x = 1$, right endpoints $1$ and $2$, heights $1$ and $4$. $R_2 = (1 + 4) \cdot 1 = 5$.`,
        },
        {
          kind: "text",
          body: md`Rectangles by hand get you bounds, not the exact area. For that we need $R_n$ as a formula in $n$, so we can let $n \to \infty$. The heights are $f(x_i) = x_i^2 = \left(\frac{2i}{n}\right)^2$, so

$$R_n = \sum_{i=1}^{n} \left(\frac{2i}{n}\right)^2 \frac{2}{n} = \frac{8}{n^3} \sum_{i=1}^{n} i^2.$$

Everything hangs on adding the first $n$ squares in closed form.`,
        },
        {
          kind: "key",
          title: "Sums of powers",
          body: md`$$\sum_{i=1}^{n} 1 = n, \qquad \sum_{i=1}^{n} i = \frac{n(n+1)}{2}, \qquad \sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}, \qquad \sum_{i=1}^{n} i^3 = \frac{n^2(n+1)^2}{4}.$$`,
        },
        {
          kind: "why",
          title: "Why 1 + 2 + ⋯ + n = n(n + 1)/2",
          body: md`Write the sum twice, the second time backwards, and add in columns:

$$\begin{aligned} S &= 1 + 2 + \cdots + (n - 1) + n \\ S &= n + (n - 1) + \cdots + 2 + 1 \\ 2S &= (n + 1) + (n + 1) + \cdots + (n + 1) \end{aligned}$$

There are $n$ columns, each adding to $n + 1$. So $2S = n(n + 1)$ and $S = \frac{n(n+1)}{2}$.`,
        },
        {
          kind: "proof",
          title: "The sum of the first n squares",
          given: md`$n$ is a positive whole number`,
          prove: md`$\displaystyle\sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}$`,
          steps: [
            { statement: md`$(i + 1)^3 - i^3 = 3i^2 + 3i + 1$ for every $i$`, reason: "Expand the cube and cancel" },
            { statement: md`$\displaystyle\sum_{i=1}^{n} \left[(i+1)^3 - i^3\right] = (n+1)^3 - 1$`, reason: md`The sum telescopes: $(2^3 - 1^3) + (3^3 - 2^3) + \cdots + ((n+1)^3 - n^3)$, and every cube but the first and last cancels` },
            { statement: md`$\displaystyle\sum_{i=1}^{n} \left[(i+1)^3 - i^3\right] = 3\sum i^2 + 3\sum i + n$`, reason: "Sum the right side of line 1 term by term" },
            { statement: md`$(n+1)^3 - 1 = 3\sum i^2 + \dfrac{3n(n+1)}{2} + n$`, reason: md`Lines 2 and 3 are the same sum; substitute $\sum i = \frac{n(n+1)}{2}$` },
            { statement: md`$3\sum i^2 = n^3 + 3n^2 + 3n - \dfrac{3n^2 + 3n}{2} - n = \dfrac{2n^3 + 3n^2 + n}{2}$`, reason: "Expand and solve for the unknown sum" },
            { statement: md`$\sum i^2 = \dfrac{n(2n^2 + 3n + 1)}{6} = \dfrac{n(n+1)(2n+1)}{6}$`, reason: md`Divide by 3 and factor $2n^2 + 3n + 1$` },
          ],
        },
        {
          kind: "example",
          title: "The exact area under x² on [0, 2]",
          problem: md`Find $\lim_{n \to \infty} R_n$ for $y = x^2$ on $[0, 2]$.`,
          steps: [
            { math: md`R_n = \frac{8}{n^3} \cdot \frac{n(n+1)(2n+1)}{6} = \frac{4(n+1)(2n+1)}{3n^2}`, note: md`Substitute the formula for $\sum i^2$ and cancel an $n$.` },
            { math: md`= \frac43 \cdot \frac{n+1}{n} \cdot \frac{2n+1}{n} = \frac43\left(1 + \frac1n\right)\left(2 + \frac1n\right)`, note: md`Divide each factor by $n$ (the Unit 1 method for limits at infinity).` },
            { math: md`\lim_{n \to \infty} R_n = \frac43 \cdot 1 \cdot 2 = \frac83`, note: md`As $n \to \infty$, $\frac1n \to 0$. The area is exactly $\frac83 \approx 2.667$, safely between $1.75$ and $3.75$.` },
          ],
        },
        {
          kind: "key",
          title: "Area as a limit",
          body: md`The **area** under a continuous $f \ge 0$ on $[a, b]$ is

$$\text{Area} = \lim_{n \to \infty} \sum_{i=1}^{n} f(x_i^*)\,\Delta x,$$

where $x_i^*$ is any sample point in the $i$-th strip. For continuous functions the limit exists and does not depend on how the sample points are chosen: left, right, midpoint, all give the same number.`,
        },
        {
          kind: "text",
          body: md`Why doesn't the choice of sample point matter? Because every Riemann sum is trapped between the smallest possible one (lowest point in each strip) and the largest (highest point in each strip), and for a continuous function those two squeeze together as the strips thin out, just as $L_n$ and $R_n$ did above. We will take that squeeze on trust for general continuous functions; proving it needs a result about continuity (uniform continuity) that belongs to a later course.

Computing areas by this limit is honest but slow. The fundamental theorem, two lessons from now, will make it almost effortless. The limit definition is still what the integral *means*.`,
        },
        {
          kind: "check",
          prompt: md`The right Riemann sums for $y = x$ on $[0, 4]$ simplify to $R_n = \dfrac{8(n+1)}{n}$. Find $\lim_{n \to \infty} R_n$, the exact area.`,
          answer: "8",
          explain: md`$\frac{8(n+1)}{n} = 8\left(1 + \frac1n\right) \to 8$. Check with geometry: the region is a triangle with base 4 and height 4, area $\frac12 \cdot 4 \cdot 4 = 8$.`,
        },
      ],
      practice: [leftRightSum, midpointSum, limitOfSums],
    },
    {
      id: slug("The definite integral"),
      title: "The definite integral",
      summary: "The limit of Riemann sums gets a name and a notation. Signed area, the rules integrals obey, and why each rule is true.",
      blocks: [
        {
          kind: "text",
          body: md`The limit of Riemann sums turned out to be worth computing even when $f$ dips below the axis, or when it measures something that isn't area at all: distance from velocity, total from a rate, mass from a density. So the limit gets its own name and symbol, with no mention of area in the definition.`,
        },
        {
          kind: "key",
          title: "The definite integral",
          body: md`For $f$ defined on $[a, b]$, the **definite integral of $f$ from $a$ to $b$** is

$$\int_a^b f(x) \, dx = \lim_{n \to \infty} \sum_{i=1}^{n} f(x_i^*)\,\Delta x,$$

whenever this limit exists and is the same for every choice of sample points. Then $f$ is **integrable** on $[a, b]$. Every continuous function is integrable.

$f$ is the **integrand**, $a$ and $b$ are the **limits of integration**, and $x$ is a dummy variable: $\int_a^b f(x)\,dx$ and $\int_a^b f(t)\,dt$ are the same number.`,
        },
        {
          kind: "why",
          title: "Why the notation looks like that",
          body: md`The symbol $\int$ is a stretched S, for *sum*. Compare the two sides of the definition piece by piece: $\sum$ became $\int$, the heights $f(x_i^*)$ became $f(x)$, and the finite width $\Delta x$ became $dx$, the same "infinitely thin width" that appears in $\frac{dy}{dx}$. Leibniz designed it so that the notation itself says "add up $f(x)$ times a sliver of width $dx$, from $a$ to $b$". That reading will make substitution (lesson 5) almost automatic.

The result is a number, not a function. Compare the indefinite integral $\int f(x)\,dx$ of lesson 1, which is a family of functions. The two uses of the same symbol are connected by the fundamental theorem, next lesson.`,
        },
        {
          kind: "text",
          body: md`**Signed area.** When $f(x) < 0$, the "heights" $f(x_i^*)$ in the Riemann sum are negative, so those terms subtract. The integral counts area above the axis as positive and area below as negative:

$$\int_a^b f(x) \, dx = (\text{area above the axis}) - (\text{area below the axis}).$$`,
        },
        {
          kind: "plot",
          x: [-0.5, 6.8],
          y: [-1.5, 1.5],
          curves: [{ expr: "sin(x)", label: md`y = \sin x` }],
          shade: [
            { expr: "sin(x)", from: 0, to: Math.PI, color: 3 },
            { expr: "sin(x)", from: Math.PI, to: 2 * Math.PI, color: 4 },
          ],
          vlines: [{ x: Math.PI, label: md`\pi` }, { x: 2 * Math.PI, label: md`2\pi` }],
          caption: md`$\int_0^{2\pi} \sin x \, dx = 0$: the arch above the axis and the one below have the same area and opposite signs. Each arch alone has area 2, so $\int_0^{\pi} \sin x\,dx = 2$ and $\int_{\pi}^{2\pi} \sin x\,dx = -2$.`,
        },
        {
          kind: "text",
          body: md`Until the fundamental theorem, our tools for computing an integral are the limit of sums (slow) and geometry (when the region is one we know). Geometry handles lines and circles.`,
        },
        {
          kind: "example",
          title: "An integral as a trapezoid",
          problem: md`Evaluate $\int_0^3 (2x + 1) \, dx$.`,
          steps: [
            { math: md`f(0) = 1, \quad f(3) = 7`, note: "The region under the line from 0 to 3 is a trapezoid standing on the x-axis, with these two parallel sides." },
            { math: md`\text{Area} = \frac{1 + 7}{2} \cdot 3 = 12`, note: "Average of the parallel sides times the width." },
            { math: md`\int_0^3 (2x + 1) \, dx = 12`, note: "The line is above the axis throughout, so the integral is the plain area." },
          ],
        },
        {
          kind: "example",
          title: "An integral as a half circle",
          problem: md`Evaluate $\int_{-3}^{3} \sqrt{9 - x^2} \, dx$.`,
          steps: [
            { math: md`y = \sqrt{9 - x^2} \iff x^2 + y^2 = 9,\; y \ge 0`, note: "Square both sides: the graph is the top half of the circle of radius 3 centered at the origin." },
            { math: md`\int_{-3}^{3} \sqrt{9 - x^2} \, dx = \tfrac12 \pi \cdot 3^2 = \frac{9\pi}{2}`, note: "Half the circle's area. No antiderivative needed, which is lucky, because this one is hard to find." },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $\int_{0}^{4} (x - 2) \, dx$ using signed area. Give the exact value.`,
          answer: "0",
          explain: md`The line crosses the axis at $x = 2$. Below the axis on $[0, 2]$ is a triangle of area $\frac12 \cdot 2 \cdot 2 = 2$, counted negative. Above on $[2, 4]$ is a matching triangle, counted positive. $-2 + 2 = 0$.`,
        },
        {
          kind: "key",
          title: "Properties of the definite integral",
          body: md`For integrable $f$ and $g$ and constants $k$:

1. $\displaystyle\int_a^b k \, dx = k(b - a)$
2. $\displaystyle\int_a^b k f(x) \, dx = k \int_a^b f(x) \, dx$, and $\displaystyle\int_a^b \left(f(x) \pm g(x)\right) dx = \int_a^b f(x)\,dx \pm \int_a^b g(x)\,dx$
3. $\displaystyle\int_a^a f(x) \, dx = 0$ and $\displaystyle\int_b^a f(x) \, dx = -\int_a^b f(x) \, dx$
4. **Additivity:** $\displaystyle\int_a^c f(x) \, dx + \int_c^b f(x) \, dx = \int_a^b f(x) \, dx$
5. **Comparison:** if $f(x) \le g(x)$ on $[a, b]$, then $\displaystyle\int_a^b f(x)\,dx \le \int_a^b g(x)\,dx$. In particular, if $m \le f(x) \le M$ on $[a, b]$ then $m(b - a) \le \int_a^b f(x)\,dx \le M(b - a)$.`,
        },
        {
          kind: "why",
          title: "Why each property holds: look at the sums",
          body: md`Every property is a fact about Riemann sums that survives the limit, because limits respect sums, constant multiples and inequalities (the limit laws of Unit 1).

**2.** A Riemann sum for $kf$ is $\sum k f(x_i^*)\Delta x = k \sum f(x_i^*)\Delta x$, which is $k$ times a Riemann sum for $f$. The sum for $f + g$ splits into a sum for $f$ plus a sum for $g$. Take limits.

**3.** With $a = b$, every $\Delta x = 0$. Going from $b$ to $a$ makes $\Delta x = \frac{a - b}{n}$ negative, the opposite of before, so every term flips sign.

**4.** Choose partitions of $[a, c]$ and $[c, b]$ and lay them side by side: together they partition $[a, b]$, and the Riemann sum for $[a, b]$ is literally the sum for $[a, c]$ plus the sum for $[c, b]$. (With the sign rule in 3, additivity holds no matter how $a$, $b$, $c$ are ordered.)

**5.** If $f(x_i^*) \le g(x_i^*)$ in every strip, the sums satisfy the same inequality, and a limit of smaller numbers can't exceed a limit of larger ones. The bounds with $m$ and $M$ follow by comparing with constant functions and using property 1.`,
        },
        {
          kind: "proof",
          title: "The integral of a constant",
          given: md`$f(x) = k$ on $[a, b]$`,
          prove: md`$\displaystyle\int_a^b k \, dx = k(b - a)$`,
          steps: [
            { statement: md`$\Delta x = \dfrac{b - a}{n}$ and $f(x_i^*) = k$ for every sample point`, reason: "Definition of the partition; f is constant" },
            { statement: md`$\displaystyle\sum_{i=1}^{n} f(x_i^*)\,\Delta x = \sum_{i=1}^{n} k \cdot \frac{b - a}{n} = n \cdot k \cdot \frac{b - a}{n} = k(b - a)$`, reason: "n equal terms" },
            { statement: md`$\displaystyle\int_a^b k\,dx = \lim_{n \to \infty} k(b - a) = k(b - a)$`, reason: "The sums are constant, so their limit is that constant" },
          ],
        },
        {
          kind: "example",
          title: "Using the properties",
          problem: md`Given $\int_0^4 f(x)\,dx = 7$ and $\int_0^2 f(x)\,dx = 3$, find $\int_2^4 (3f(x) - 1) \, dx$.`,
          steps: [
            { math: md`\int_2^4 f \, dx = \int_0^4 f \, dx - \int_0^2 f \, dx = 7 - 3 = 4`, note: "Additivity, rearranged." },
            { math: md`\int_2^4 (3f - 1) \, dx = 3\int_2^4 f \, dx - \int_2^4 1 \, dx`, note: "Linearity." },
            { math: md`= 3 \cdot 4 - 1 \cdot (4 - 2) = 10`, note: "A constant integrates to the constant times the length of the interval." },
          ],
        },
        {
          kind: "check",
          prompt: md`Given $\int_1^5 f(x)\,dx = 10$ and $\int_1^3 f(x)\,dx = 4$, find $\int_3^5 f(x)\,dx$.`,
          answer: "6",
          explain: md`$\int_1^3 f + \int_3^5 f = \int_1^5 f$, so $4 + \int_3^5 f = 10$ and the answer is $6$.`,
        },
      ],
      practice: [lineByGeometry, circleByGeometry, integralProperties],
    },
    {
      id: slug("The fundamental theorem of calculus"),
      title: "The fundamental theorem of calculus",
      summary: "The area function's derivative is the original function. That one fact, proved, links derivatives to integrals and turns computing an integral into finding an antiderivative.",
      blocks: [
        {
          kind: "text",
          body: md`Lesson 2 took a page of algebra to show that the area under $x^2$ from 0 to 2 is $\frac83$. Notice $\frac83 = \frac{2^3}{3}$, and $\frac{x^3}{3}$ is an antiderivative of $x^2$. Coincidence? Try $[0, b]$: the practice limits gave $\frac{b^3}{3}$ every time. The area under a curve seems to be governed by an antiderivative of the curve. This lesson explains why, and the explanation is the single most important idea in calculus.

Fix a starting point $a$ and let the right edge move. Define the **area function**

$$A(x) = \int_a^x f(t) \, dt,$$

the signed area from $a$ to $x$. ($t$ is the dummy variable inside; $x$ is the moving edge.) Ask the Unit 2 question: how fast does $A$ change as $x$ moves?`,
        },
        {
          kind: "plot",
          x: [-0.5, 4.5],
          y: [-0.5, 5.5],
          curves: [{ expr: "x^2/4 + 1", label: md`y = f(t) = \tfrac{t^2}{4} + 1` }],
          shade: [{ expr: "x^2/4 + 1", from: 0, to: "c", color: 3 }],
          vlines: [{ x: "c", label: md`x` }],
          points: [{ x: "c", y: "c^2/4 + 1", label: md`f(x)`, color: 2 }],
          params: [{ name: "c", tex: "x", min: 0, max: 4, step: 0.1, value: 2 }],
          caption: md`The area function for $f(t) = \frac{t^2}{4} + 1$ starting at $0$. At $x = {c}$ the shaded area is $A(x) = {=c^3/12 + c}$. Nudge $x$ to the right: the area grows by a thin strip whose height is $f(x) = {=c^2/4 + 1}$. The taller the curve at the moving edge, the faster the area grows.`,
        },
        {
          kind: "why",
          title: "Why A'(x) = f(x): the thin strip",
          body: md`Move the edge from $x$ to $x + h$. The area gains a strip of width $h$ between the curve and the axis, so by additivity

$$A(x + h) - A(x) = \int_x^{x+h} f(t)\,dt.$$

For small $h$ the strip is nearly a rectangle of width $h$ and height $f(x)$, so $A(x + h) - A(x) \approx f(x)\,h$. Divide by $h$:

$$\frac{A(x + h) - A(x)}{h} \approx f(x).$$

The left side is the difference quotient of $A$. As $h \to 0$ the approximation becomes exact, and $A'(x) = f(x)$. The area function is an antiderivative of $f$. That is why antiderivatives kept appearing in area problems.`,
        },
        {
          kind: "key",
          title: "The fundamental theorem of calculus, part 1",
          body: md`If $f$ is continuous on $[a, b]$, then the function $A(x) = \displaystyle\int_a^x f(t)\,dt$ is differentiable on $(a, b)$ and

$$A'(x) = \frac{d}{dx}\int_a^x f(t)\,dt = f(x).$$

In words: differentiating an integral with a variable upper limit gives back the integrand, evaluated at that limit.`,
        },
        {
          kind: "proof",
          title: "FTC part 1",
          given: md`$f$ is continuous on $[a, b]$ and $A(x) = \displaystyle\int_a^x f(t)\,dt$`,
          prove: md`$A'(x) = f(x)$ for $a < x < b$`,
          steps: [
            { statement: md`For $h > 0$ small, $A(x + h) - A(x) = \displaystyle\int_x^{x+h} f(t)\,dt$`, reason: "Additivity of the integral" },
            { statement: md`On $[x, x + h]$, $f$ has a minimum value $m_h$ and a maximum value $M_h$`, reason: "Extreme Value Theorem (Unit 5): f is continuous on a closed interval" },
            { statement: md`$m_h \cdot h \le \displaystyle\int_x^{x+h} f(t)\,dt \le M_h \cdot h$`, reason: "Comparison property with the constants m_h and M_h" },
            { statement: md`$m_h \le \dfrac{A(x + h) - A(x)}{h} \le M_h$`, reason: md`Divide by $h > 0$` },
            { statement: md`As $h \to 0^+$, $m_h \to f(x)$ and $M_h \to f(x)$`, reason: md`$m_h$ and $M_h$ are values of $f$ at points within $h$ of $x$, and $f$ is continuous at $x$` },
            { statement: md`$\displaystyle\lim_{h \to 0^+} \frac{A(x + h) - A(x)}{h} = f(x)$`, reason: "Squeeze theorem (Unit 1)" },
            { statement: md`The same holds for $h \to 0^-$, so $A'(x) = f(x)$`, reason: md`For $h < 0$ the strip is $[x + h, x]$; the same bounds apply and the two sign flips (reversed limits, dividing by a negative) cancel` },
          ],
        },
        {
          kind: "example",
          title: "Differentiating an area function",
          problem: md`Find $\dfrac{d}{dx}\displaystyle\int_1^x \sqrt{1 + t^3}\,dt$ and $\dfrac{d}{dx}\displaystyle\int_0^{x^2} \sin t\,dt$.`,
          steps: [
            { math: md`\frac{d}{dx}\int_1^x \sqrt{1 + t^3}\,dt = \sqrt{1 + x^3}`, note: md`FTC part 1 directly: replace $t$ by $x$. No one can write this antiderivative in closed form, and we didn't need to.` },
            { math: md`g(x) = \int_0^{x^2} \sin t\,dt = A(u), \quad u = x^2, \quad A(u) = \int_0^u \sin t\,dt`, note: "The upper limit isn't plain x, so g is a composition: the area function A applied to u = x²." },
            { math: md`g'(x) = A'(u) \cdot u' = \sin(x^2) \cdot 2x`, note: md`Chain rule, with $A'(u) = \sin u$ from FTC part 1.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Let $g(x) = \displaystyle\int_2^x \sqrt{1 + t^3}\,dt$. Find $g'(x)$.`,
          answer: "sqrt(1 + x^3)",
          explain: md`FTC part 1: the derivative of the area function is the integrand at the moving edge, $\sqrt{1 + x^3}$. The lower limit 2 plays no part.`,
        },
        {
          kind: "text",
          body: md`Part 1 says the area function is *an* antiderivative. Lesson 1 says all antiderivatives differ by a constant. Put those together and any antiderivative you can find, by any method, computes areas.`,
        },
        {
          kind: "key",
          title: "The fundamental theorem of calculus, part 2",
          body: md`If $f$ is continuous on $[a, b]$ and $F$ is any antiderivative of $f$, then

$$\int_a^b f(x)\,dx = F(b) - F(a).$$

The difference is often written $\Big[F(x)\Big]_a^b$. The constant of integration is irrelevant: it would appear in both $F(b)$ and $F(a)$ and cancel.`,
        },
        {
          kind: "why",
          title: "Why part 2 follows from part 1",
          body: md`Let $A(x) = \int_a^x f(t)\,dt$. By part 1, $A$ is an antiderivative of $f$. If $F$ is any other antiderivative, lesson 1 says $F(x) = A(x) + C$ for some constant $C$. Then

$$F(b) - F(a) = \big(A(b) + C\big) - \big(A(a) + C\big) = A(b) - A(a).$$

Now $A(a) = \int_a^a f\,dt = 0$ and $A(b) = \int_a^b f\,dt$ is exactly the integral we want. So $\int_a^b f\,dx = F(b) - F(a)$.

Read it as a statement about change: $F(b) - F(a)$ is the total change in $F$ over $[a, b]$, and the integral adds up all the little changes $F'(x)\,dx = f(x)\,dx$. Total change is the sum of the small changes. Position is the integral of velocity.`,
        },
        {
          kind: "example",
          title: "The area under x² in two lines",
          problem: md`Evaluate $\int_1^3 x^2\,dx$.`,
          steps: [
            { math: md`F(x) = \frac{x^3}{3}`, note: "Any antiderivative will do; leave out the + C." },
            { math: md`\int_1^3 x^2\,dx = F(3) - F(1) = \frac{27}{3} - \frac13 = \frac{26}{3}`, note: "Upper limit minus lower limit. Compare with the page of sums it took in lesson 2." },
          ],
        },
        {
          kind: "example",
          title: "A trig integral",
          problem: md`Evaluate $\int_0^{\pi} \sin x\,dx$.`,
          steps: [
            { math: md`F(x) = -\cos x`, note: md`Because $\frac{d}{dx}(-\cos x) = \sin x$.` },
            { math: md`\Big[-\cos x\Big]_0^{\pi} = (-\cos\pi) - (-\cos 0) = 1 - (-1) = 2`, note: "Watch the double negatives. One arch of the sine curve has area exactly 2, as the picture last lesson claimed." },
          ],
        },
        {
          kind: "text",
          body: md`**Two cautions.** First, part 2 needs $f$ continuous on the whole interval. $\int_{-1}^{1} \frac{1}{x^2}\,dx$ is *not* $\left[-\frac1x\right]_{-1}^{1} = -2$; the integrand blows up at 0 and the integral doesn't exist. (A negative answer for a positive function is the giveaway.) Second, an integral that comes out negative or zero isn't wrong; it is signed area.`,
        },
        {
          kind: "check",
          prompt: md`Evaluate $\int_0^1 e^x\,dx$. Give the exact value, e.g. e - 1.`,
          answer: "e - 1",
          explain: md`$F(x) = e^x$, so the integral is $e^1 - e^0 = e - 1$.`,
        },
      ],
      practice: [ftcPolynomial, ftcTranscendental, ftcPartOne],
    },
    {
      id: slug("Substitution"),
      title: "Substitution",
      summary: "The chain rule run backwards. Spotting an inside function and its derivative, changing the variable, and changing the limits of a definite integral along with it.",
      blocks: [
        {
          kind: "text",
          body: md`The fundamental theorem makes every integral an antiderivative hunt, and lesson 1's table handles the basics. But what is $\int 2x\cos(x^2)\,dx$? None of the table entries fits. Yet you can check that $\sin(x^2)$ works: by the chain rule, $\frac{d}{dx}\sin(x^2) = \cos(x^2) \cdot 2x$. The $2x$ is the derivative of the inside function $x^2$. Substitution is the systematic way to notice this.`,
        },
        {
          kind: "why",
          title: "Why the chain rule gives an integration rule",
          body: md`The chain rule says $\dfrac{d}{dx} F(g(x)) = F'(g(x))\,g'(x)$. Read it backwards as a statement about antiderivatives: $F(g(x))$ is an antiderivative of $F'(g(x))\,g'(x)$. Writing $f = F'$,

$$\int f(g(x))\,g'(x)\,dx = F(g(x)) + C.$$

So whenever an integrand is "a function of an inside quantity, times the derivative of that inside quantity", the answer is an antiderivative of the outer function with the inside quantity plugged in. In $2x\cos(x^2)$: inside $g(x) = x^2$, its derivative $2x$ is right there, outer function $\cos$, antiderivative $\sin$. Answer: $\sin(x^2) + C$.`,
        },
        {
          kind: "key",
          title: "Substitution",
          body: md`To find $\displaystyle\int f(g(x))\,g'(x)\,dx$:

1. Let $u = g(x)$. Then $du = g'(x)\,dx$.
2. Rewrite the integral entirely in $u$: $\displaystyle\int f(u)\,du$. No $x$ may remain.
3. Integrate in $u$, then put $g(x)$ back in place of $u$.

Choosing $u$: look for an inside function (something inside a power, a root, $e^{(\ )}$, $\sin(\ )$, a denominator) whose derivative also appears as a factor, possibly up to a constant.`,
        },
        {
          kind: "why",
          title: "Why writing du = g′(x) dx is legitimate",
          body: md`$du = g'(x)\,dx$ is the differential of Unit 5: for a small change $dx$ in $x$, the change in $u$ is $g'(x)\,dx$. In a Riemann sum, each term is $f(g(x_i))\,g'(x_i)\,\Delta x$, and $g'(x_i)\,\Delta x$ is almost exactly the change $\Delta u_i$ in $u$ across that strip. So the sum is almost exactly $\sum f(u_i)\,\Delta u_i$, a Riemann sum for $\int f(u)\,du$. The notation is doing honest bookkeeping for the chain rule; the "why" box above is the proof, and $du = g'(x)\,dx$ is the shorthand that keeps the proof's pieces in the right places.`,
        },
        {
          kind: "example",
          title: "A clean substitution",
          problem: md`Find $\int x\sqrt{x^2 + 1}\,dx$.`,
          steps: [
            { math: md`u = x^2 + 1, \quad du = 2x\,dx`, note: "The inside of the root. Its derivative 2x is there up to the constant 2." },
            { math: md`x\,dx = \tfrac12\,du`, note: "Solve for the piece the integrand actually contains." },
            { math: md`\int \sqrt{u} \cdot \tfrac12\,du = \tfrac12 \cdot \frac{u^{3/2}}{3/2} + C = \tfrac13 u^{3/2} + C`, note: "Everything is in u. Power rule." },
            { math: md`\tfrac13 (x^2 + 1)^{3/2} + C`, note: md`Back to $x$. Check: $\frac{d}{dx}\tfrac13(x^2+1)^{3/2} = \tfrac13 \cdot \tfrac32 (x^2+1)^{1/2} \cdot 2x = x\sqrt{x^2+1}$.` },
          ],
        },
        {
          kind: "example",
          title: "A linear inside function",
          problem: md`Find $\int e^{3x}\,dx$ and $\int (2x + 5)^4\,dx$.`,
          steps: [
            { math: md`u = 3x, \; du = 3\,dx: \quad \int e^u \frac{du}{3} = \frac{e^{3x}}{3} + C`, note: md`With a linear inside $ax + b$, $du = a\,dx$ always; the effect is to divide by $a$.` },
            { math: md`u = 2x + 5, \; du = 2\,dx: \quad \int u^4 \frac{du}{2} = \frac{u^5}{10} + C = \frac{(2x + 5)^5}{10} + C`, note: "Divide by the new exponent 5 and by the inside slope 2." },
          ],
        },
        {
          kind: "example",
          title: "The derivative is hiding",
          problem: md`Find $\int \tan x\,dx$.`,
          steps: [
            { math: md`\int \frac{\sin x}{\cos x}\,dx`, note: "Write tan as a quotient. Now the denominator's derivative, up to a sign, is the numerator." },
            { math: md`u = \cos x, \quad du = -\sin x\,dx, \quad \sin x\,dx = -du`, note: "" },
            { math: md`\int \frac{-du}{u} = -\ln|u| + C = -\ln|\cos x| + C`, note: md`Equivalently $\ln|\sec x| + C$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\int 3x^2 (x^3 + 1)^4\,dx$. Writing $+ C$ is optional.`,
          answer: "(x^3 + 1)^5/5",
          upToConstant: true,
          explain: md`$u = x^3 + 1$, $du = 3x^2\,dx$ exactly. $\int u^4\,du = \frac{u^5}{5}$, so the answer is $\frac{(x^3 + 1)^5}{5} + C$.`,
        },
        {
          kind: "text",
          body: md`**Definite integrals.** With limits, you have a choice. Either substitute, go back to $x$, and then plug in the $x$-limits; or stay in $u$ and convert the limits to $u$-values. The second is shorter and avoids a classic mistake (plugging $x$-limits into a $u$-expression).`,
        },
        {
          kind: "key",
          title: "Substitution with limits",
          body: md`If $g'$ is continuous on $[a, b]$ and $f$ is continuous on the range of $g$, then

$$\int_a^b f(g(x))\,g'(x)\,dx = \int_{g(a)}^{g(b)} f(u)\,du.$$

When $x$ runs from $a$ to $b$, $u = g(x)$ runs from $g(a)$ to $g(b)$. Change the limits along with the variable, and never return to $x$.`,
        },
        {
          kind: "proof",
          title: "Changing the limits",
          given: md`$F$ is an antiderivative of $f$; $g'$ continuous on $[a, b]$, $f$ continuous on the range of $g$`,
          prove: md`$\displaystyle\int_a^b f(g(x))\,g'(x)\,dx = \int_{g(a)}^{g(b)} f(u)\,du$`,
          steps: [
            { statement: md`$\dfrac{d}{dx}F(g(x)) = f(g(x))\,g'(x)$`, reason: md`Chain rule, with $F' = f$` },
            { statement: md`$\displaystyle\int_a^b f(g(x))\,g'(x)\,dx = F(g(b)) - F(g(a))$`, reason: md`FTC part 2, using $F(g(x))$ as the antiderivative` },
            { statement: md`$\displaystyle\int_{g(a)}^{g(b)} f(u)\,du = F(g(b)) - F(g(a))$`, reason: md`FTC part 2 again, now for $f$ on $[g(a), g(b)]$ with antiderivative $F$` },
            { statement: md`The two integrals are equal`, reason: "Both equal F(g(b)) − F(g(a))" },
          ],
        },
        {
          kind: "plot",
          x: [-0.3, 2.5],
          y: [-0.5, 8.5],
          curves: [
            { expr: "2x(x^2 + 1)^2", label: md`y = 2x(x^2 + 1)^2`, domain: [0, 1.1] },
            { expr: "x^2", label: md`y = u^2`, color: 2, domain: [0.9, 2.1] },
          ],
          shade: [
            { expr: "2x(x^2 + 1)^2", from: 0, to: 1, color: 1 },
            { expr: "x^2", from: 1, to: 2, color: 2 },
          ],
          caption: md`$\int_0^1 2x(x^2 + 1)^2\,dx$ (blue, in $x$) and $\int_1^2 u^2\,du$ (orange, in $u = x^2 + 1$). Different shapes, same area $\frac73$. The substitution stretches and squeezes the region sideways while keeping every thin strip's area $f(u)\,du = f(g(x))\,g'(x)\,dx$ the same.`,
        },
        {
          kind: "example",
          title: "Limits in u",
          problem: md`Evaluate $\int_0^2 x e^{x^2}\,dx$.`,
          steps: [
            { math: md`u = x^2, \quad du = 2x\,dx, \quad x\,dx = \tfrac12 du`, note: "" },
            { math: md`x = 0 \Rightarrow u = 0, \qquad x = 2 \Rightarrow u = 4`, note: "Convert the limits." },
            { math: md`\tfrac12 \int_0^4 e^u\,du = \tfrac12 \Big[e^u\Big]_0^4 = \frac{e^4 - 1}{2}`, note: md`Evaluate in $u$. Plugging $x = 2$ into $\frac12 e^u$ would have been the mistake; the limits are now $u$-values.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $\int_0^1 2x(x^2 + 1)^2\,dx$. Give the exact value.`,
          answer: "7/3",
          explain: md`$u = x^2 + 1$, $du = 2x\,dx$, limits $u = 1$ to $u = 2$. $\int_1^2 u^2\,du = \frac{8}{3} - \frac13 = \frac73$.`,
        },
      ],
      practice: [linearInside, innerFunction, definiteSubstitution],
    },
  ],
};
