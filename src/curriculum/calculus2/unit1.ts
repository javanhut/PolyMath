import { frac, fracTex, gcd, paren, poly, signed, type Rng } from "../../math/random";
import { md, slug, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Exact arithmetic helpers ────────────────────────────────────────────────

type Frac = { n: number; d: number };
function fr(n: number, d = 1): Frac {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const fadd = (a: Frac, b: Frac): Frac => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const fsub = (a: Frac, b: Frac): Frac => fr(a.n * b.d - b.n * a.d, a.d * b.d);
const fmul = (a: Frac, b: Frac): Frac => fr(a.n * b.n, a.d * b.d);
const ftext = (f: Frac) => frac(f.n, f.d);
const ftex = (f: Frac) => fracTex(f.n, f.d);
/** A fraction in parentheses when negative, for "F(b) - F(a)". */
const ftexParen = (f: Frac) => (f.n < 0 ? `\\left(${ftex(f)}\\right)` : ftex(f));

/** k·pi as typed answer text: "32pi/5", "pi", "-pi/2". */
function piText(f: Frac): string {
  if (f.n === 0) return "0";
  const c = f.n === 1 ? "" : f.n === -1 ? "-" : String(f.n);
  return f.d === 1 ? `${c}pi` : `${c}pi/${f.d}`;
}
function piTex(f: Frac): string {
  if (f.n === 0) return "0";
  const c = Math.abs(f.n) === 1 ? "" : String(Math.abs(f.n));
  const sign = f.n < 0 ? "-" : "";
  return f.d === 1 ? `${sign}${c}\\pi` : `${sign}\\frac{${c}\\pi}{${f.d}}`;
}

/** Polynomials with integer coefficients; index = power. */
type Poly = number[];
function pmul(a: Poly, b: Poly): Poly {
  const out: Poly = Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j]! += x * y)));
  return out;
}
const pscale = (p: Poly, k: number): Poly => p.map((c) => c * k);
function psub(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push((a[i] ?? 0) - (b[i] ?? 0));
  return out;
}
/** Exact value of p at a fraction x. */
function peval(p: Poly, x: Frac): Frac {
  let out = fr(0);
  let pow = fr(1);
  for (const c of p) {
    out = fadd(out, fmul(fr(c), pow));
    pow = fmul(pow, x);
  }
  return out;
}
const pnum = (p: Poly, x: number) => p.reduce((s, c, k) => s + c * x ** k, 0);
/** Exact value of the antiderivative (no constant) at an integer x. */
function pantiEval(p: Poly, x: number): Frac {
  let out = fr(0);
  p.forEach((c, k) => (out = fadd(out, fr(c * x ** (k + 1), k + 1))));
  return out;
}
/** Exact ∫_a^b p dx for integers a, b. */
const pint = (p: Poly, a: number, b: number): Frac => fsub(pantiEval(p, b), pantiEval(p, a));
/** p in LaTeX (and typed-answer syntax), highest power first. */
function ptex(p: Poly, v = "x"): string {
  const terms: [number, string][] = [];
  for (let k = p.length - 1; k >= 0; k--) terms.push([p[k]!, k === 0 ? "" : k === 1 ? v : `${v}^${k}`]);
  return poly(terms);
}
/** The antiderivative of p (no constant) in LaTeX. */
function pantiTex(p: Poly, v = "x"): string {
  let out = "";
  for (let k = p.length - 1; k >= 0; k--) {
    const c = p[k]!;
    if (c === 0) continue;
    const coef = fr(Math.abs(c), k + 1);
    const vp = `${v}^${k + 1}`;
    const mag = coef.d === 1 ? (coef.n === 1 ? vp : `${coef.n}${vp}`) : coef.n === 1 ? `\\frac{${vp}}{${coef.d}}` : `\\frac{${coef.n}${vp}}{${coef.d}}`;
    out += out ? (c < 0 ? ` - ${mag}` : ` + ${mag}`) : c < 0 ? `-${mag}` : mag;
  }
  return out || "0";
}
/** "(x - 3)", "(x + 2)" or "x" for a root of 0. */
const linFactor = (root: number, v = "x") => (root === 0 ? v : `(${v} ${signed(-root)})`);

/** About half the time the prompt hands over the integral and asks only for its evaluation. */
const handsOverSetup = (r: Rng) => r.next() < 0.55;
/** Plain fractions and multiples of pi are asked for in simplest form. */
const simpleKey = (s: string) => /^-?\d+(\/\d+)?$/.test(s) || /^-?\d*pi(\/\d+)?$/.test(s);

// ── Lesson 1: Area between curves ───────────────────────────────────────────

const areaLineParabola: Generator = (r) => {
  const p = r.int(-3, 2);
  const w = r.int(1, 4);
  const q = p + w;
  const a = r.pick([1, 1, -1, 2]);
  const m = r.int(-3, 3);
  const k = r.int(-4, 4);
  const parab: Poly = [k + a * p * q, m - a * (p + q), a];
  const line: Poly = [k, m];
  const lineOnTop = a > 0;
  const [top, bottom] = lineOnTop ? [line, parab] : [parab, line];
  const diff = psub(top, bottom);
  const area = pint(diff, p, q);
  const mid = fr(p + q, 2);
  const factorTex = `${a === 1 ? "" : a === -1 ? "-" : a}${linFactor(p)}${linFactor(q)}`;
  const xlo = p - 1.5;
  const xhi = q + 1.5;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (let x = xlo; x <= xhi + 1e-9; x += 0.25) {
    for (const c of [parab, line]) {
      ymin = Math.min(ymin, pnum(c, x));
      ymax = Math.max(ymax, pnum(c, x));
    }
  }
  const figure: Figure = {
    kind: "plot",
    x: [xlo, xhi],
    y: [Math.floor(ymin) - 1, Math.ceil(ymax) + 1],
    curves: [
      { expr: ptex(parab), label: `y = ${ptex(parab)}`, color: 2 },
      { expr: ptex(line), label: `y = ${ptex(line)}`, color: 1 },
    ],
    shade: [{ expr: ptex(top), under: ptex(bottom), from: p, to: q }],
  };
  return {
    prompt: md`Find the area of the region enclosed by $y = ${ptex(parab)}$ and $y = ${ptex(line)}$. Give an exact answer, like 9/2.`,
    answer: ftext(area),
    simplified: true,
    figure,
    hint: "Set the two equations equal to find where the curves cross. Between the crossings, test one point to see which curve is on top, then integrate top minus bottom.",
    solution: [
      { math: md`${ptex(parab)} = ${ptex(line)} \;\Rightarrow\; ${ptex(psub(parab, line))} = 0`, note: "Set the two equal and bring everything to one side." },
      { math: md`${factorTex} = 0 \;\Rightarrow\; x = ${p} \text{ or } x = ${q}`, note: "Factor to find where the curves cross. These are the limits of integration." },
      {
        math: md`x = ${ftex(mid)}: \quad \text{line} = ${ftex(peval(line, mid))}, \quad \text{parabola} = ${ftex(peval(parab, mid))}`,
        note: md`Test a point between the crossings: the ${lineOnTop ? "line" : "parabola"} is on top there, so it is on top on the whole interval (the curves don't cross again).`,
      },
      { math: md`A = \int_{${p}}^{${q}} \left[(${ptex(top)}) - (${ptex(bottom)})\right] dx = \int_{${p}}^{${q}} \left(${ptex(diff)}\right) dx`, note: "Top minus bottom, simplified." },
      { math: md`= \left[${pantiTex(diff)}\right]_{${p}}^{${q}} = ${ftex(pantiEval(diff, q))} - ${ftexParen(pantiEval(diff, p))}`, note: "Antiderivative by the power rule, evaluated at both ends." },
      {
        math: md`A = ${ftex(area)}`,
        note: md`A check worth knowing: when a parabola $y = ax^2 + \dots$ and a line cross at $x = ${p}$ and $x = ${q}$, the area between them is always $\frac{|a|(${q} - ${paren(p)})^3}{6}$. Here that is $\frac{${Math.abs(a)} \cdot ${w}^3}{6} = ${ftex(area)}$.`,
      },
    ],
  };
};

const areaBetweenIntegral: Generator = (r) => {
  type V = { f: string; g: string; a: string; b: string; integrand: string; answer: string; steps: Step[] };
  const kind = r.int(0, 4);
  let v: V;
  if (kind === 0) {
    const c = r.int(1, 3);
    v = {
      f: `x + ${c}`,
      g: "x^2",
      a: "0",
      b: "1",
      integrand: `x + ${c} - x^2`,
      answer: frac(6 * c + 1, 6),
      steps: [
        { math: md`\int_{0}^{1} (x + ${c} - x^2)\,dx = \left[\frac{x^2}{2} + ${c}x - \frac{x^3}{3}\right]_0^1`, note: "Power rule, term by term." },
        { math: md`= \left(\frac12 + ${c} - \frac13\right) - 0 = ${fracTex(6 * c + 1, 6)}`, note: "Every term vanishes at 0." },
      ],
    };
  } else if (kind === 1) {
    const b = r.int(1, 2);
    v = {
      f: "e^x",
      g: "1",
      a: "0",
      b: String(b),
      integrand: "e^x - 1",
      answer: `e^${b} - ${b + 1}`,
      steps: [
        { math: md`\int_{0}^{${b}} (e^x - 1)\,dx = \left[e^x - x\right]_0^{${b}}`, note: md`$e^x$ is its own antiderivative.` },
        { math: md`= (e^{${b}} - ${b}) - (1 - 0) = e^{${b}} - ${b + 1}`, note: md`Remember $e^0 = 1$: the lower limit isn't zero here.` },
      ],
    };
  } else if (kind === 2) {
    v = {
      f: "\\cos x",
      g: "\\sin x",
      a: "0",
      b: "\\pi/4",
      integrand: "\\cos x - \\sin x",
      answer: "sqrt(2) - 1",
      steps: [
        { math: md`\int_{0}^{\pi/4} (\cos x - \sin x)\,dx = \left[\sin x + \cos x\right]_0^{\pi/4}`, note: md`The antiderivative of $-\sin x$ is $+\cos x$.` },
        { math: md`= \left(\frac{\sqrt2}{2} + \frac{\sqrt2}{2}\right) - (0 + 1) = \sqrt2 - 1`, note: md`The curves meet at $x = \pi/4$, where $\sin x = \cos x$.` },
      ],
    };
  } else if (kind === 3) {
    const b = r.int(2, 4);
    v = {
      f: "\\frac{1}{x}",
      g: "\\frac{1}{x^2}",
      a: "1",
      b: String(b),
      integrand: "\\frac{1}{x} - \\frac{1}{x^2}",
      answer: `ln(${b}) - ${frac(b - 1, b)}`,
      steps: [
        { math: md`\int_{1}^{${b}} \left(\frac1x - x^{-2}\right) dx = \left[\ln x + \frac1x\right]_1^{${b}}`, note: md`$\int x^{-2}\,dx = -x^{-1}$, so subtracting it gives $+\frac1x$.` },
        { math: md`= \left(\ln ${b} + \frac{1}{${b}}\right) - (0 + 1) = \ln ${b} - ${fracTex(b - 1, b)}`, note: md`Positive, as an area must be: $\ln ${b} \approx ${Math.log(b).toFixed(3)}$.` },
      ],
    };
  } else {
    const s = r.int(1, 2);
    const c = s * s;
    v = {
      f: `${c} - x^2`,
      g: `x^2 - ${c}`,
      a: `-${s}`,
      b: `${s}`,
      integrand: `${2 * c} - 2x^2`,
      answer: frac(8 * s ** 3, 3),
      steps: [
        { math: md`\int_{-${s}}^{${s}} (${2 * c} - 2x^2)\,dx = \left[${2 * c}x - \frac{2x^3}{3}\right]_{-${s}}^{${s}}`, note: md`$(${c} - x^2) - (x^2 - ${c}) = ${2 * c} - 2x^2$.` },
        { math: md`= \left(${2 * c * s} - \frac{${2 * s ** 3}}{3}\right) - \left(-${2 * c * s} + \frac{${2 * s ** 3}}{3}\right) = ${fracTex(8 * s ** 3, 3)}`, note: "The integrand is even, so the two halves contribute equally." },
      ],
    };
  }
  return {
    prompt: md`The region between $y = ${v.f}$ (on top) and $y = ${v.g}$ for $${v.a} \le x \le ${v.b}$ has area $\int_{${v.a}}^{${v.b}} \left(${v.integrand}\right) \, dx$. Evaluate it exactly. Fractions, e, ln and sqrt are fine, like 7/6 or e^2 - 3.`,
    answer: v.answer,
    simplified: simpleKey(v.answer),
    hint: "Find an antiderivative of each term, then evaluate at the upper limit minus the lower limit.",
    solution: v.steps,
  };
};

const areaInY: Generator = (r) => {
  const given = handsOverSetup(r);
  if (r.next() < 0.5) {
    const s = r.int(1, 3);
    const d = r.int(-3, 3);
    const c = d + s * s;
    const flip = r.next() < 0.5;
    const curve = flip ? ptex([c, 0, -1], "y") : ptex([d, 0, 1], "y");
    const lineX = flip ? d : c;
    const integrand: Poly = [s * s, 0, -1];
    const area = pint(integrand, -s, s);
    const [right, left] = flip ? [curve, String(lineX)] : [String(lineX), curve];
    return {
      prompt: md`Find the area of the region enclosed by $x = ${curve}$ and $x = ${lineX}$.${given ? md` Set up in $y$, it is $\int_{${-s}}^{${s}} (${ptex(integrand, "y")}) \, dy$; evaluate it.` : " Integrate with respect to $y$."} Give an exact answer, like 32/3.`,
      answer: ftext(area),
      simplified: true,
      figure: {
        kind: "plot",
        x: [Math.min(d, c) - 1.5, Math.max(d, c) + 1.5],
        y: [-s - 1, s + 1],
        parametric: [{ x: ptex(flip ? [c, 0, -1] : [d, 0, 1], "t"), y: "t", t: [-s - 0.8, s + 0.8], label: `x = ${curve}`, color: 2 }],
        vlines: [{ x: lineX, label: `x = ${lineX}` }],
      },
      hint: md`Horizontal strips run from the left boundary to the right one. Find where the curves meet by setting the two $x$-values equal.`,
      solution: [
        { math: md`${curve} = ${lineX} \;\Rightarrow\; y^2 = ${s * s} \;\Rightarrow\; y = \pm ${s}`, note: md`The curves meet where their $x$-values agree. Solve for $y$.` },
        { math: md`\text{right} - \text{left} = (${right}) - (${left}) = ${ptex(integrand, "y")}`, note: md`At $y = 0$ the ${flip ? "parabola" : "line"} has the larger $x$, so it is on the right throughout.` },
        { math: md`A = \int_{${-s}}^{${s}} (${ptex(integrand, "y")})\,dy = \left[${pantiTex(integrand, "y")}\right]_{${-s}}^{${s}}`, note: md`A horizontal strip has length right minus left and thickness $dy$. In $x$ this region would need two integrals, because its upper and lower boundaries are the two halves of the same parabola.` },
        { math: md`= ${ftex(pantiEval(integrand, s))} - ${ftexParen(pantiEval(integrand, -s))} = ${ftex(area)}`, note: "" },
      ],
    };
  }
  const p = r.int(-3, 1);
  const w = r.int(1, 4);
  const q = p + w;
  const m = r.int(-2, 2);
  const k = r.int(-3, 3);
  const parab: Poly = [k + p * q, m - (p + q), 1];
  const line: Poly = [k, m];
  const integrand = psub(line, parab);
  const area = pint(integrand, p, q);
  const mid = fr(p + q, 2);
  const tlo = p - 1;
  const thi = q + 1;
  let xmin = Infinity;
  let xmax = -Infinity;
  for (let t = tlo; t <= thi + 1e-9; t += 0.25) {
    for (const c of [parab, line]) {
      xmin = Math.min(xmin, pnum(c, t));
      xmax = Math.max(xmax, pnum(c, t));
    }
  }
  return {
    prompt: md`Find the area of the region enclosed by $x = ${ptex(parab, "y")}$ and $x = ${ptex(line, "y")}$.${given ? md` Set up in $y$, it is $\int_{${p}}^{${q}} (${ptex(integrand, "y")}) \, dy$; evaluate it.` : " Integrate with respect to $y$."} Give an exact answer, like 9/2.`,
    answer: ftext(area),
    simplified: true,
    figure: {
      kind: "plot",
      x: [Math.floor(xmin) - 1, Math.ceil(xmax) + 1],
      y: [tlo, thi],
      parametric: [
        { x: ptex(parab, "t"), y: "t", t: [tlo, thi], label: `x = ${ptex(parab, "y")}`, color: 2 },
        { x: ptex(line, "t"), y: "t", t: [tlo, thi], label: `x = ${ptex(line, "y")}`, color: 1 },
      ],
    },
    hint: md`Set the two $x$-values equal and solve for $y$. Between the two solutions the line is on the right; integrate right minus left in $y$.`,
    solution: [
      { math: md`${ptex(parab, "y")} = ${ptex(line, "y")} \;\Rightarrow\; ${ptex(psub(parab, line), "y")} = 0`, note: "Set the two equal." },
      { math: md`${linFactor(p, "y")}${linFactor(q, "y")} = 0 \;\Rightarrow\; y = ${p} \text{ or } y = ${q}`, note: md`Factor. These $y$-values are the limits.` },
      { math: md`y = ${ftex(mid)}: \quad \text{line } x = ${ftex(peval(line, mid))}, \quad \text{parabola } x = ${ftex(peval(parab, mid))}`, note: "Between the crossings the line is to the right of the parabola." },
      { math: md`A = \int_{${p}}^{${q}} \left[(${ptex(line, "y")}) - (${ptex(parab, "y")})\right] dy = \int_{${p}}^{${q}} (${ptex(integrand, "y")})\,dy`, note: "Right minus left." },
      { math: md`= \left[${pantiTex(integrand, "y")}\right]_{${p}}^{${q}} = ${ftex(pantiEval(integrand, q))} - ${ftexParen(pantiEval(integrand, p))} = ${ftex(area)}`, note: "" },
    ],
  };
};

// ── Lesson 2: Volumes by slicing ────────────────────────────────────────────

const diskVolume: Generator = (r) => {
  const given = handsOverSetup(r);
  const kind = r.int(0, 7);
  if (kind === 7) {
    const n = r.pick([1, 2, 2, 3]);
    const c = n === 3 ? 8 : r.int(1, 4);
    const fTex = n === 1 ? "x" : `x^${n}`;
    const xOfY = n === 1 ? "y" : n === 2 ? "\\sqrt{y}" : "y^{1/3}";
    const V = n === 1 ? fr(c ** 3, 3) : n === 2 ? fr(c * c, 2) : fr(96, 5);
    const sq = n === 1 ? "y^2" : n === 2 ? "y" : "y^{2/3}";
    const anti = n === 1 ? "\\frac{y^3}{3}" : n === 2 ? "\\frac{y^2}{2}" : "\\frac{3}{5}y^{5/3}";
    return {
      prompt: md`The region bounded by $y = ${fTex}$, $y = ${c}$ and the $y$-axis is revolved about the $y$-axis. Find the volume of the solid.${given ? md` Slicing perpendicular to the $y$-axis gives $V = \int_{0}^{${c}} \pi\left(${xOfY}\right)^2 \, dy$; evaluate it.` : ""} Use pi, like 32pi/5.`,
      answer: piText(V),
      simplified: true,
      hint: md`The slices are horizontal disks. Their radius is the $x$-value of the curve at height $y$, so solve $y = ${fTex}$ for $x$ and integrate in $y$ from 0 to ${c}.`,
      solution: [
        { math: md`x = ${xOfY}, \qquad 0 \le y \le ${c}`, note: md`Slices perpendicular to the $y$-axis are disks whose radius is the curve's $x$-value at that height.` },
        { math: md`V = \int_0^{${c}} \pi\left(${xOfY}\right)^2 dy = \pi\int_0^{${c}} ${sq}\,dy`, note: "Disk area, integrated along the axis of revolution." },
        { math: md`= \pi\left[${anti}\right]_0^{${c}} = ${piTex(V)}`, note: "" },
      ],
    };
  }
  let fTex: string;
  let a = 0;
  let b: number | string;
  let sqTex: string;
  let answer: string;
  let steps: Step[];
  if (kind === 0) {
    const n = r.int(1, 3);
    b = r.int(1, 3);
    fTex = n === 1 ? "x" : `x^${n}`;
    sqTex = `x^${2 * n}`;
    const V = fr(b ** (2 * n + 1), 2 * n + 1);
    answer = piText(V);
    steps = [{ math: md`= \pi\left[\frac{x^{${2 * n + 1}}}{${2 * n + 1}}\right]_0^{${b}} = ${piTex(V)}`, note: "Power rule." }];
  } else if (kind === 1) {
    const k = r.int(1, 4);
    b = r.int(1, 4);
    fTex = k === 1 ? "\\sqrt{x}" : `\\sqrt{${k}x}`;
    sqTex = k === 1 ? "x" : `${k}x`;
    const V = fr(k * b * b, 2);
    answer = piText(V);
    steps = [{ math: md`= \pi\left[\frac{${k === 1 ? "" : k}x^2}{2}\right]_0^{${b}} = ${piTex(V)}`, note: "Squaring the root removes it: the integrand is just a line." }];
  } else if (kind === 2) {
    const c = r.int(1, 2);
    b = r.int(1, 2);
    fTex = `x + ${c}`;
    sqTex = `(x + ${c})^2`;
    const V = fr((b + c) ** 3 - c ** 3, 3);
    answer = piText(V);
    steps = [{ math: md`= \pi\left[\frac{(x + ${c})^3}{3}\right]_0^{${b}} = \pi\left(\frac{${(b + c) ** 3}}{3} - \frac{${c ** 3}}{3}\right) = ${piTex(V)}`, note: md`Integrate $(x + ${c})^2$ directly with $u = x + ${c}$; no need to expand.` }];
  } else if (kind === 3) {
    b = 1;
    fTex = "e^x";
    sqTex = "e^{2x}";
    answer = "pi(e^2 - 1)/2";
    steps = [{ math: md`= \pi\left[\frac{e^{2x}}{2}\right]_0^{1} = \frac{\pi}{2}\left(e^2 - 1\right)`, note: md`$(e^x)^2 = e^{2x}$, whose antiderivative is $\frac12 e^{2x}$.` }];
  } else if (kind === 4) {
    const c = r.int(1, 3);
    a = -c;
    b = c;
    fTex = `\\sqrt{${c * c} - x^2}`;
    sqTex = `${c * c} - x^2`;
    const V = fr(4 * c ** 3, 3);
    answer = piText(V);
    steps = [{ math: md`= \pi\left[${c * c}x - \frac{x^3}{3}\right]_{-${c}}^{${c}} = \pi\left(${2 * c ** 3} - \frac{${2 * c ** 3}}{3}\right) = ${piTex(V)}`, note: md`This is a sphere of radius ${c}: the formula $\frac43\pi r^3$ gives the same thing.` }];
  } else if (kind === 5) {
    b = "\\pi/4";
    fTex = "\\sec x";
    sqTex = "\\sec^2 x";
    answer = "pi";
    steps = [{ math: md`= \pi\left[\tan x\right]_0^{\pi/4} = \pi(1 - 0) = \pi`, note: md`$\sec^2 x$ is the derivative of $\tan x$.` }];
  } else {
    a = 1;
    b = r.int(2, 4);
    fTex = "\\frac{1}{x}";
    sqTex = "\\frac{1}{x^2}";
    const V = fr(b - 1, b);
    answer = piText(V);
    steps = [{ math: md`= \pi\left[-\frac1x\right]_1^{${b}} = \pi\left(-\frac{1}{${b}} + 1\right) = ${piTex(V)}`, note: md`$\int x^{-2}\,dx = -x^{-1}$.` }];
  }
  return {
    prompt: md`The region under $y = ${fTex}$ from $x = ${a}$ to $x = ${b}$ is revolved about the $x$-axis. Find the volume of the solid.${given ? md` Disks give $V = \int_{${a}}^{${b}} \pi\left(${fTex}\right)^2 \, dx$; evaluate it.` : ""} Use pi and e as needed, like 32pi/5 or pi(e^2 - 1)/2.`,
    answer,
    simplified: simpleKey(answer),
    hint: md`The slice at $x$ is a disk of radius $${fTex}$, so its area is $\pi(${fTex})^2$. Integrate that from $${a}$ to $${b}$.`,
    solution: [
      { math: md`A(x) = \pi r^2 = \pi\left(${fTex}\right)^2 = \pi \cdot ${sqTex}`, note: md`The cross-section at $x$ is a disk whose radius is the height of the curve.` },
      { math: md`V = \int_{${a}}^{${b}} \pi \cdot ${sqTex}\,dx`, note: "Volume by slicing." },
      ...steps,
    ],
  };
};

const washerGiven: Generator = (r) => {
  type V = { f: string; g: string; a: string; b: string; answer: string; steps: Step[] };
  const b1 = r.int(1, 3);
  const s = r.int(1, 2);
  const variants: V[] = [
    {
      f: "x",
      g: "x^2",
      a: "0",
      b: "1",
      answer: "2pi/15",
      steps: [
        { math: md`V = \pi\int_0^1 \left(x^2 - x^4\right) dx`, note: md`Outer radius $x$, inner radius $x^2$. Square each radius separately: $R^2 - r^2$, never $(R - r)^2$.` },
        { math: md`= \pi\left[\frac{x^3}{3} - \frac{x^5}{5}\right]_0^1 = \pi\left(\frac13 - \frac15\right) = \frac{2\pi}{15}`, note: "" },
      ],
    },
    {
      f: "2x",
      g: "x^2",
      a: "0",
      b: "2",
      answer: "64pi/15",
      steps: [
        { math: md`V = \pi\int_0^2 \left(4x^2 - x^4\right) dx`, note: md`$(2x)^2 = 4x^2$ and $(x^2)^2 = x^4$.` },
        { math: md`= \pi\left[\frac{4x^3}{3} - \frac{x^5}{5}\right]_0^2 = \pi\left(\frac{32}{3} - \frac{32}{5}\right) = \frac{64\pi}{15}`, note: "" },
      ],
    },
    {
      f: "\\sqrt{x}",
      g: "x^2",
      a: "0",
      b: "1",
      answer: "3pi/10",
      steps: [
        { math: md`V = \pi\int_0^1 \left(x - x^4\right) dx`, note: md`$(\sqrt{x})^2 = x$.` },
        { math: md`= \pi\left[\frac{x^2}{2} - \frac{x^5}{5}\right]_0^1 = \pi\left(\frac12 - \frac15\right) = \frac{3\pi}{10}`, note: "" },
      ],
    },
    {
      f: String(s * s),
      g: "x^2",
      a: `-${s}`,
      b: String(s),
      answer: piText(fr(8 * s ** 5, 5)),
      steps: [
        { math: md`V = \pi\int_{-${s}}^{${s}} \left(${s ** 4} - x^4\right) dx`, note: md`The line $y = ${s * s}$ is the outer radius, constant; the parabola is the inner one.` },
        { math: md`= \pi\left[${s ** 4}x - \frac{x^5}{5}\right]_{-${s}}^{${s}} = \pi\left(${2 * s ** 5} - \frac{${2 * s ** 5}}{5}\right) = ${piTex(fr(8 * s ** 5, 5))}`, note: "" },
      ],
    },
    {
      f: "e^x",
      g: "1",
      a: "0",
      b: "1",
      answer: "pi(e^2 - 3)/2",
      steps: [
        { math: md`V = \pi\int_0^1 \left(e^{2x} - 1\right) dx = \pi\left[\frac{e^{2x}}{2} - x\right]_0^1`, note: md`$(e^x)^2 = e^{2x}$.` },
        { math: md`= \pi\left[\left(\frac{e^2}{2} - 1\right) - \frac12\right] = \frac{\pi(e^2 - 3)}{2}`, note: "" },
      ],
    },
    {
      f: "x + 1",
      g: "1",
      a: "0",
      b: String(b1),
      answer: piText(fadd(fr(b1 ** 3, 3), fr(b1 * b1))),
      steps: [
        { math: md`V = \pi\int_0^{${b1}} \left[(x + 1)^2 - 1\right] dx = \pi\int_0^{${b1}} \left(x^2 + 2x\right) dx`, note: md`$(x + 1)^2 - 1 = x^2 + 2x$.` },
        { math: md`= \pi\left[\frac{x^3}{3} + x^2\right]_0^{${b1}} = \pi\left(\frac{${b1 ** 3}}{3} + ${b1 * b1}\right) = ${piTex(fadd(fr(b1 ** 3, 3), fr(b1 * b1)))}`, note: "" },
      ],
    },
    {
      f: "x^3",
      g: "x",
      a: "1",
      b: "2",
      answer: "332pi/21",
      steps: [
        { math: md`V = \pi\int_1^2 \left(x^6 - x^2\right) dx = \pi\left[\frac{x^7}{7} - \frac{x^3}{3}\right]_1^2`, note: md`For $x \ge 1$, $x^3 \ge x$, so the cubic is the outer radius.` },
        { math: md`= \pi\left[\left(\frac{128}{7} - \frac83\right) - \left(\frac17 - \frac13\right)\right] = \pi\left(\frac{127}{7} - \frac73\right) = \frac{332\pi}{21}`, note: "" },
      ],
    },
    {
      f: "2",
      g: "x^2 + 1",
      a: "-1",
      b: "1",
      answer: "64pi/15",
      steps: [
        { math: md`V = \pi\int_{-1}^{1} \left[4 - (x^2 + 1)^2\right] dx = \pi\int_{-1}^{1} \left(3 - 2x^2 - x^4\right) dx`, note: md`$(x^2 + 1)^2 = x^4 + 2x^2 + 1$.` },
        { math: md`= \pi\left[3x - \frac{2x^3}{3} - \frac{x^5}{5}\right]_{-1}^{1} = 2\pi\left(3 - \frac23 - \frac15\right) = \frac{64\pi}{15}`, note: "The integrand is even, so double the value from 0 to 1." },
      ],
    },
  ];
  const v = r.pick(variants);
  return {
    prompt: md`The region between $y = ${v.f}$ and $y = ${v.g}$ for $${v.a} \le x \le ${v.b}$ is revolved about the $x$-axis. Washers give $V = \int_{${v.a}}^{${v.b}} \pi\left((${v.f})^2 - (${v.g})^2\right) \, dx$. Evaluate it. Use pi and e as needed, like 2pi/15 or pi(e^2 - 3)/2.`,
    answer: v.answer,
    simplified: simpleKey(v.answer),
    hint: md`Square each radius on its own, subtract, then integrate term by term. Keep the $\pi$ outside.`,
    solution: v.steps,
  };
};

const crossSections: Generator = (r) => {
  const given = handsOverSetup(r);
  const shape = r.pick(["square", "semicircle", "triangle"] as const);
  const base = r.int(0, 2);
  let fTex: string;
  let b: number;
  let sqTex: string;
  let antiTex: string;
  let I: Frac;
  if (base === 0) {
    const n = r.int(1, 2);
    b = r.int(1, 3);
    fTex = n === 1 ? "x" : "x^2";
    sqTex = `x^${2 * n}`;
    antiTex = `\\frac{x^${2 * n + 1}}{${2 * n + 1}}`;
    I = fr(b ** (2 * n + 1), 2 * n + 1);
  } else if (base === 1) {
    const k = r.int(1, 3);
    b = r.pick([1, 2, 4]);
    fTex = k === 1 ? "\\sqrt{x}" : `\\sqrt{${k}x}`;
    sqTex = k === 1 ? "x" : `${k}x`;
    antiTex = k === 1 ? "\\frac{x^2}{2}" : `\\frac{${k}x^2}{2}`;
    I = fr(k * b * b, 2);
  } else {
    b = r.int(2, 4);
    fTex = `${b} - x`;
    sqTex = `(${b} - x)^2`;
    antiTex = `-\\frac{(${b} - x)^3}{3}`;
    I = fr(b ** 3, 3);
  }
  const desc = shape === "square" ? "a square with one side in the base" : shape === "semicircle" ? "a semicircle with its diameter in the base" : "an equilateral triangle with one side in the base";
  const factorTex = shape === "square" ? "" : shape === "semicircle" ? "\\frac{\\pi}{8}" : "\\frac{\\sqrt{3}}{4}";
  const areaTex = `${factorTex}\\left(${fTex}\\right)^2`;
  const q = fmul(I, shape === "square" ? fr(1) : shape === "semicircle" ? fr(1, 8) : fr(1, 4));
  const answer = shape === "square" ? ftext(q) : shape === "semicircle" ? piText(q) : `${q.n === 1 ? "" : q.n}sqrt(3)${q.d === 1 ? "" : `/${q.d}`}`;
  const answerTex = shape === "square" ? ftex(q) : shape === "semicircle" ? piTex(q) : q.d === 1 ? `${q.n === 1 ? "" : q.n}\\sqrt{3}` : `\\frac{${q.n === 1 ? "" : q.n}\\sqrt{3}}{${q.d}}`;
  const areaWhy =
    shape === "square"
      ? md`A square of side $s$ has area $s^2$.`
      : shape === "semicircle"
        ? md`A semicircle of diameter $s$ has radius $\frac{s}{2}$ and area $\frac12\pi\left(\frac s2\right)^2 = \frac{\pi}{8}s^2$.`
        : md`An equilateral triangle of side $s$ has height $\frac{\sqrt3}{2}s$ and area $\frac{\sqrt3}{4}s^2$.`;
  return {
    prompt: md`A solid has as its base the region under $y = ${fTex}$ from $x = 0$ to $x = ${b}$ in the $xy$-plane. Every cross-section perpendicular to the $x$-axis is ${desc}. Find the volume.${given ? md` The slice at $x$ has area $${areaTex}$, so $V = \int_{0}^{${b}} ${areaTex} \, dx$; evaluate it.` : ""} Give an exact answer; use pi and sqrt(3) as needed, like 8/3, pi/6 or 2sqrt(3)/3.`,
    answer,
    simplified: simpleKey(answer),
    hint: md`The slice at $x$ has one side of length $${fTex}$ (the height of the base region there). Write its area in terms of that side, then integrate from 0 to ${b}.`,
    solution: [
      { math: md`s = ${fTex}, \qquad A(x) = ${factorTex || ""}s^2 = ${factorTex}\left(${fTex}\right)^2 = ${factorTex ? `${factorTex} \\cdot ` : ""}${sqTex}`, note: areaWhy },
      { math: md`V = \int_0^{${b}} A(x)\,dx = ${factorTex ? `${factorTex}` : ""}\int_0^{${b}} ${sqTex}\,dx`, note: "Volume by slicing: the constant factor comes out front." },
      { math: md`\int_0^{${b}} ${sqTex}\,dx = \left[${antiTex}\right]_0^{${b}} = ${ftex(I)}`, note: "" },
      { math: md`V = ${factorTex ? `${factorTex} \\cdot ${ftex(I)} = ` : ""}${answerTex}`, note: "" },
    ],
  };
};

// ── Lesson 3: Volumes by shells ─────────────────────────────────────────────

const shellUnderCurve: Generator = (r) => {
  const given = handsOverSetup(r);
  const kind = r.int(0, 5);
  let fTex: string;
  let a = 0;
  let b: number;
  let answer: string;
  let steps: Step[];
  if (kind === 0) {
    const n = r.int(1, 3);
    b = r.int(1, 3);
    fTex = n === 1 ? "x" : `x^${n}`;
    const V = fr(2 * b ** (n + 2), n + 2);
    answer = piText(V);
    steps = [
      { math: md`V = \int_0^{${b}} 2\pi x \cdot ${fTex}\,dx = 2\pi\int_0^{${b}} x^{${n + 1}}\,dx`, note: "Multiply the radius into the height." },
      { math: md`= 2\pi\left[\frac{x^{${n + 2}}}{${n + 2}}\right]_0^{${b}} = ${piTex(V)}`, note: "" },
    ];
  } else if (kind === 1) {
    b = r.int(1, 3);
    fTex = `${b * b} - x^2`;
    const V = fr(b ** 4, 2);
    answer = piText(V);
    steps = [
      { math: md`V = \int_0^{${b}} 2\pi x (${b * b} - x^2)\,dx = 2\pi\int_0^{${b}} (${b * b}x - x^3)\,dx`, note: "" },
      { math: md`= 2\pi\left[\frac{${b * b}x^2}{2} - \frac{x^4}{4}\right]_0^{${b}} = 2\pi\left(\frac{${b ** 4}}{2} - \frac{${b ** 4}}{4}\right) = ${piTex(V)}`, note: "" },
    ];
  } else if (kind === 2) {
    a = 1;
    b = r.int(2, 4);
    fTex = "\\frac{1}{x}";
    answer = piText(fr(2 * (b - 1)));
    steps = [
      { math: md`V = \int_1^{${b}} 2\pi x \cdot \frac1x\,dx = 2\pi\int_1^{${b}} 1\,dx`, note: md`The radius $x$ cancels the height $\frac1x$: every shell has the same volume per unit thickness.` },
      { math: md`= 2\pi(${b} - 1) = ${piTex(fr(2 * (b - 1)))}`, note: "" },
    ];
  } else if (kind === 3) {
    b = r.int(1, 3);
    fTex = "\\frac{1}{1 + x^2}";
    answer = `pi ln(${1 + b * b})`;
    steps = [
      { math: md`V = \int_0^{${b}} 2\pi x \cdot \frac{1}{1 + x^2}\,dx = \pi\int_0^{${b}} \frac{2x}{1 + x^2}\,dx`, note: md`The $x$ from the radius is exactly what a substitution $u = 1 + x^2$ needs: $du = 2x\,dx$.` },
      { math: md`= \pi\left[\ln(1 + x^2)\right]_0^{${b}} = \pi\ln ${1 + b * b}`, note: md`$\ln 1 = 0$.` },
    ];
  } else if (kind === 4) {
    b = 1;
    fTex = "e^{x^2}";
    answer = "pi(e - 1)";
    steps = [
      { math: md`V = \int_0^1 2\pi x\,e^{x^2}\,dx = \pi\int_0^1 2x\,e^{x^2}\,dx`, note: md`With $u = x^2$, $du = 2x\,dx$. Slicing this solid would need $x = \sqrt{\ln y}$; shells avoid it.` },
      { math: md`= \pi\left[e^{x^2}\right]_0^1 = \pi(e - 1)`, note: "" },
    ];
  } else {
    b = r.pick([1, 4]);
    fTex = "\\sqrt{x}";
    const V = b === 1 ? fr(4, 5) : fr(128, 5);
    answer = piText(V);
    steps = [
      { math: md`V = \int_0^{${b}} 2\pi x\sqrt{x}\,dx = 2\pi\int_0^{${b}} x^{3/2}\,dx`, note: md`$x \cdot x^{1/2} = x^{3/2}$.` },
      { math: md`= 2\pi\left[\frac25 x^{5/2}\right]_0^{${b}} = \frac{4\pi}{5} \cdot ${b === 1 ? 1 : 32} = ${piTex(V)}`, note: b === 1 ? "" : md`$4^{5/2} = (\sqrt4)^5 = 32$.` },
    ];
  }
  return {
    prompt: md`The region under $y = ${fTex}$ from $x = ${a}$ to $x = ${b}$ is revolved about the $y$-axis. Use shells to find the volume.${given ? md` The shell at $x$ has radius $x$ and height $${fTex}$, so $V = \int_{${a}}^{${b}} 2\pi x\left(${fTex}\right) \, dx$; evaluate it.` : ""} Use pi, ln and e as needed, like 8pi/3, pi ln(5) or pi(e - 1).`,
    answer,
    simplified: simpleKey(answer),
    hint: md`A vertical strip at $x$ sweeps out a shell of radius $x$, height $${fTex}$ and thickness $dx$: volume element $2\pi x\left(${fTex}\right) dx$.`,
    solution: [{ math: md`\text{radius} = x, \qquad \text{height} = ${fTex}`, note: "The strip is parallel to the axis of revolution, so it sweeps out a cylindrical shell." }, ...steps],
  };
};

const shellBetweenCurves: Generator = (r) => {
  const given = handsOverSetup(r);
  const fam = r.int(0, 2);
  let f: string;
  let g: string;
  let q: number;
  let Htex: string;
  let xHtex: string;
  let I0: Frac;
  let I1: Frac;
  if (fam === 0) {
    q = r.int(1, 3);
    f = q === 1 ? "x" : `${q}x`;
    g = "x^2";
    Htex = ptex([0, q, -1]);
    xHtex = ptex([0, 0, q, -1]);
    I0 = fr(q ** 3, 6);
    I1 = fr(q ** 4, 12);
  } else if (fam === 1) {
    q = 1;
    f = "x^2";
    g = "x^3";
    Htex = "x^2 - x^3";
    xHtex = "x^3 - x^4";
    I0 = fr(1, 12);
    I1 = fr(1, 20);
  } else {
    q = 1;
    f = "\\sqrt{x}";
    g = "x^2";
    Htex = "\\sqrt{x} - x^2";
    xHtex = "x^{3/2} - x^3";
    I0 = fr(1, 3);
    I1 = fr(3, 20);
  }
  const axisKind = r.int(0, 2);
  const c = axisKind === 1 ? q + r.int(0, 1) : r.int(1, 2);
  const axisDesc = axisKind === 0 ? "the $y$-axis" : axisKind === 1 ? md`the line $x = ${c}$` : md`the line $x = -${c}$`;
  const Rtex = axisKind === 0 ? "x" : axisKind === 1 ? `${c} - x` : `x + ${c}`;
  const K = axisKind === 0 ? I1 : axisKind === 1 ? fsub(fmul(fr(c), I0), I1) : fadd(I1, fmul(fr(c), I0));
  const V = fmul(fr(2), K);
  const splitStep: Step =
    axisKind === 0
      ? { math: md`= 2\pi\int_0^{${q}} \left(${xHtex}\right) dx = 2\pi \cdot ${ftex(I1)}`, note: "Multiply the radius into the height and integrate term by term." }
      : axisKind === 1
        ? { math: md`= 2\pi\left[${c}\int_0^{${q}} \left(${Htex}\right) dx - \int_0^{${q}} \left(${xHtex}\right) dx\right] = 2\pi\left[${c} \cdot ${ftex(I0)} - ${ftex(I1)}\right]`, note: md`Split $(${c} - x)(\text{height})$ into ${c} times the height minus $x$ times the height. The two integrals are $\int_0^{${q}} (${Htex})\,dx = ${ftex(I0)}$ and $\int_0^{${q}} (${xHtex})\,dx = ${ftex(I1)}$.` }
        : { math: md`= 2\pi\left[\int_0^{${q}} \left(${xHtex}\right) dx + ${c}\int_0^{${q}} \left(${Htex}\right) dx\right] = 2\pi\left[${ftex(I1)} + ${c} \cdot ${ftex(I0)}\right]`, note: md`Split $(x + ${c})(\text{height})$. The two integrals are $\int_0^{${q}} (${xHtex})\,dx = ${ftex(I1)}$ and $\int_0^{${q}} (${Htex})\,dx = ${ftex(I0)}$.` };
  return {
    prompt: md`The region between $y = ${f}$ and $y = ${g}$ is revolved about ${axisDesc}. Use shells to find the volume.${given ? md` The curves meet at $x = 0$ and $x = ${q}$, and the shell at $x$ has radius $${Rtex}$, so $V = \int_{0}^{${q}} 2\pi (${Rtex})\left(${f} - ${g}\right) \, dx$; evaluate it.` : ""} Use pi, like 4pi/15.`,
    answer: piText(V),
    simplified: true,
    hint: md`Find where the curves meet. A vertical strip at $x$ has height top minus bottom, and its distance to the axis of revolution is the radius: ${axisKind === 0 ? "$x$" : axisKind === 1 ? md`$${c} - x$` : md`$x + ${c}$`}.`,
    solution: [
      { math: md`${f} = ${g} \;\Rightarrow\; x = 0 \text{ or } x = ${q}`, note: md`The curves cross at these points, and between them $y = ${f}$ is on top.` },
      { math: md`\text{radius} = ${Rtex}, \qquad \text{height} = ${f} - ${g}`, note: axisKind === 0 ? "The distance from the strip to the axis is $x$." : axisKind === 1 ? md`The strip at $x$ sits to the left of the line $x = ${c}$, at distance $${c} - x$.` : md`The strip at $x$ sits to the right of the line $x = -${c}$, at distance $x - (-${c}) = x + ${c}$.` },
      { math: md`V = \int_0^{${q}} 2\pi\,(${Rtex})\left(${Htex}\right) dx`, note: md`Shell element: $2\pi \cdot \text{radius} \cdot \text{height} \cdot dx$.` },
      splitStep,
      { math: md`V = ${piTex(V)}`, note: "" },
    ],
  };
};

const shellHorizontal: Generator = (r) => {
  const given = handsOverSetup(r);
  const kind = r.int(0, 2);
  let desc: string;
  let top: number;
  let Htex: string;
  let intTex: string;
  let antiTex: string;
  let V: Frac;
  let where: string;
  if (kind === 0) {
    const n = r.int(1, 3);
    top = r.int(1, 3);
    const curve = n === 1 ? "y" : `y^${n}`;
    desc = md`$x = ${curve}$, the $y$-axis and $y = ${top}$`;
    Htex = curve;
    intTex = `y^${n + 1}`;
    antiTex = `\\frac{y^${n + 2}}{${n + 2}}`;
    V = fr(2 * top ** (n + 2), n + 2);
    where = md`At height $y$ the region runs from the $y$-axis ($x = 0$) to the curve ($x = ${curve}$), so the shell is $${curve}$ long.`;
  } else if (kind === 1) {
    const n = r.int(1, 3);
    const s = n === 3 ? r.int(1, 2) : r.int(1, 3);
    top = s;
    const curve = n === 1 ? "y" : `y^${n}`;
    desc = md`$x = ${curve}$, $x = ${s ** n}$ and $y = 0$`;
    Htex = `${s ** n} - ${curve}`;
    intTex = `${s ** n}y - y^${n + 1}`;
    antiTex = `\\frac{${s ** n}y^2}{2} - \\frac{y^${n + 2}}{${n + 2}}`;
    V = fmul(fr(2), fsub(fr(s ** (n + 2), 2), fr(s ** (n + 2), n + 2)));
    where = md`The curve meets $x = ${s ** n}$ where $y^${n} = ${s ** n}$, at $y = ${s}$. At height $y$ (between 0 and ${s}) the region runs from the curve, $x = ${curve}$, out to $x = ${s ** n}$.`;
  } else {
    const s = r.int(1, 3);
    top = s * s;
    desc = md`$y = x^2$, $y = ${top}$ and the $y$-axis`;
    Htex = "\\sqrt{y}";
    intTex = "y^{3/2}";
    antiTex = "\\frac25 y^{5/2}";
    V = fr(4 * s ** 5, 5);
    where = md`Horizontal shells need the right-hand boundary as $x$ in terms of $y$: $y = x^2$ gives $x = \sqrt{y}$. At height $y$ the region runs from $x = 0$ to $x = \sqrt{y}$.`;
  }
  return {
    prompt: md`The region bounded by ${desc} is revolved about the $x$-axis. Use shells (horizontal strips) to find the volume.${given ? md` The shell at height $y$ has radius $y$ and height $${Htex}$, so $V = \int_{0}^{${top}} 2\pi y\left(${Htex}\right) \, dy$; evaluate it.` : ""} Use pi, like 8pi.`,
    answer: piText(V),
    simplified: true,
    hint: md`A horizontal strip at height $y$ is parallel to the $x$-axis, so it sweeps out a shell of radius $y$. Its length is the right boundary minus the left one, written in terms of $y$.`,
    solution: [
      { math: md`\text{radius} = y, \qquad \text{height} = ${Htex}, \qquad 0 \le y \le ${top}`, note: where },
      { math: md`V = \int_0^{${top}} 2\pi y\left(${Htex}\right) dy = 2\pi\int_0^{${top}} \left(${intTex}\right) dy`, note: "Shell element in $y$." },
      { math: md`= 2\pi\left[${antiTex}\right]_0^{${top}} = ${piTex(V)}`, note: "" },
    ],
  };
};

// ── Lesson 4: Arc length ────────────────────────────────────────────────────

const arcLength: Generator = (r) => {
  const given = handsOverSetup(r);
  const kind = r.int(0, 2);
  let fTex: string;
  let bTex: string;
  let integrand: string;
  let answer: string;
  let steps: Step[];
  if (kind === 0) {
    const [bT, u, ans, ansTex] = r.pick([
      ["1", "13/4", "(13sqrt(13) - 8)/27", "\\frac{13\\sqrt{13} - 8}{27}"],
      ["4/3", "4", "56/27", "\\frac{56}{27}"],
      ["4", "10", "(80sqrt(10) - 8)/27", "\\frac{80\\sqrt{10} - 8}{27}"],
      ["32/9", "9", "208/27", "\\frac{208}{27}"],
    ] as const);
    fTex = "x^{3/2}";
    bTex = bT;
    integrand = "\\sqrt{1 + \\frac{9}{4}x}";
    answer = ans;
    const uTex = u.includes("/") ? `\\frac{${u.split("/")[0]}}{${u.split("/")[1]}}` : u;
    steps = [
      { math: md`f'(x) = \frac32 x^{1/2}, \qquad 1 + f'(x)^2 = 1 + \frac94 x`, note: "" },
      { math: md`L = \int_0^{${bTex}} \sqrt{1 + \tfrac94 x}\,dx`, note: "" },
      { math: md`u = 1 + \tfrac94 x, \quad du = \tfrac94\,dx: \qquad L = \frac49\int_1^{${uTex}} u^{1/2}\,du = \frac49 \cdot \frac23\left[u^{3/2}\right]_1^{${uTex}}`, note: md`When $x = 0$, $u = 1$; when $x = ${bTex}$, $u = ${uTex}$.` },
      { math: md`= \frac{8}{27}\left(\left(${uTex}\right)^{3/2} - 1\right) = ${ansTex}`, note: "" },
    ];
  } else if (kind === 1) {
    const b = r.int(1, 3);
    fTex = "\\frac23 (x^2 + 1)^{3/2}";
    bTex = String(b);
    integrand = "\\sqrt{1 + 4x^2(x^2 + 1)}";
    const L = fr(2 * b ** 3 + 3 * b, 3);
    answer = ftext(L);
    steps = [
      { math: md`f'(x) = \frac23 \cdot \frac32 (x^2 + 1)^{1/2} \cdot 2x = 2x\sqrt{x^2 + 1}`, note: "Chain rule." },
      { math: md`1 + f'(x)^2 = 1 + 4x^2(x^2 + 1) = 4x^4 + 4x^2 + 1 = (2x^2 + 1)^2`, note: "A perfect square: that's what makes the length computable." },
      { math: md`L = \int_0^{${b}} (2x^2 + 1)\,dx = \left[\frac{2x^3}{3} + x\right]_0^{${b}} = ${ftex(L)}`, note: md`$\sqrt{(2x^2 + 1)^2} = 2x^2 + 1$, since it is positive.` },
    ];
  } else {
    const [bT, ans, ansTex, why] = r.pick([
      ["\\ln 2", "3/4", "\\frac34", md`$\sinh(\ln 2) = \frac{e^{\ln 2} - e^{-\ln 2}}{2} = \frac{2 - \frac12}{2} = \frac34$.`],
      ["\\ln 3", "4/3", "\\frac43", md`$\sinh(\ln 3) = \frac{3 - \frac13}{2} = \frac43$.`],
      ["1", "(e - 1/e)/2", "\\sinh 1 = \\frac{e - e^{-1}}{2}", md`About $1.175$.`],
      ["2", "(e^2 - 1/e^2)/2", "\\sinh 2 = \\frac{e^2 - e^{-2}}{2}", md`About $3.627$.`],
    ] as const);
    fTex = "\\cosh x";
    bTex = bT;
    integrand = "\\sqrt{1 + \\sinh^2 x}";
    answer = ans;
    steps = [
      { math: md`f'(x) = \sinh x, \qquad 1 + f'(x)^2 = 1 + \sinh^2 x = \cosh^2 x`, note: md`$\cosh^2 x - \sinh^2 x = 1$.` },
      { math: md`L = \int_0^{${bTex}} \cosh x\,dx = \left[\sinh x\right]_0^{${bTex}} = ${ansTex}`, note: why },
    ];
  }
  return {
    prompt: md`Find the length of the curve $y = ${fTex}$ for $0 \le x \le ${bTex}$.${given ? md` The arc length integral is $\int_{0}^{${bTex}} ${integrand} \, dx$; evaluate it.` : ""} Give an exact answer; fractions, square roots and e are fine, like 56/27 or (13sqrt(13) - 8)/27.`,
    answer,
    simplified: simpleKey(answer),
    hint: md`Compute $f'(x)$, then simplify $1 + f'(x)^2$ before taking the root. It is a perfect square or something a substitution handles.`,
    solution: steps,
  };
};

type SquareFamily = { fTex: string; ypTex: string; yp2Tex: string; sqTex: string; intTex: string; antiTex: string; L: (b: number) => { text: string; tex: string } };
const SQUARE_FAMILIES: SquareFamily[] = [
  {
    fTex: "\\frac{x^3}{6} + \\frac{1}{2x}",
    ypTex: "\\frac{x^2}{2} - \\frac{1}{2x^2}",
    yp2Tex: "\\frac{x^4}{4} - \\frac12 + \\frac{1}{4x^4}",
    sqTex: "\\left(\\frac{x^2}{2} + \\frac{1}{2x^2}\\right)^2",
    intTex: "\\frac{x^2}{2} + \\frac{1}{2x^2}",
    antiTex: "\\frac{x^3}{6} - \\frac{1}{2x}",
    L: (b) => {
      const v = fadd(fr(b ** 3 - 1, 6), fr(b - 1, 2 * b));
      return { text: ftext(v), tex: ftex(v) };
    },
  },
  {
    fTex: "\\frac{x^4}{8} + \\frac{1}{4x^2}",
    ypTex: "\\frac{x^3}{2} - \\frac{1}{2x^3}",
    yp2Tex: "\\frac{x^6}{4} - \\frac12 + \\frac{1}{4x^6}",
    sqTex: "\\left(\\frac{x^3}{2} + \\frac{1}{2x^3}\\right)^2",
    intTex: "\\frac{x^3}{2} + \\frac{1}{2x^3}",
    antiTex: "\\frac{x^4}{8} - \\frac{1}{4x^2}",
    L: (b) => {
      const v = fadd(fr(b ** 4 - 1, 8), fr(b * b - 1, 4 * b * b));
      return { text: ftext(v), tex: ftex(v) };
    },
  },
  {
    fTex: "\\frac{x^3}{3} + \\frac{1}{4x}",
    ypTex: "x^2 - \\frac{1}{4x^2}",
    yp2Tex: "x^4 - \\frac12 + \\frac{1}{16x^4}",
    sqTex: "\\left(x^2 + \\frac{1}{4x^2}\\right)^2",
    intTex: "x^2 + \\frac{1}{4x^2}",
    antiTex: "\\frac{x^3}{3} - \\frac{1}{4x}",
    L: (b) => {
      const v = fadd(fr(b ** 3 - 1, 3), fr(b - 1, 4 * b));
      return { text: ftext(v), tex: ftex(v) };
    },
  },
  {
    fTex: "\\frac{x^2}{2} - \\frac{\\ln x}{4}",
    ypTex: "x - \\frac{1}{4x}",
    yp2Tex: "x^2 - \\frac12 + \\frac{1}{16x^2}",
    sqTex: "\\left(x + \\frac{1}{4x}\\right)^2",
    intTex: "x + \\frac{1}{4x}",
    antiTex: "\\frac{x^2}{2} + \\frac{\\ln x}{4}",
    L: (b) => ({ text: `${frac(b * b - 1, 2)} + ln(${b})/4`, tex: `${fracTex(b * b - 1, 2)} + \\frac{\\ln ${b}}{4}` }),
  },
];

const arcPerfectSquare: Generator = (r) => {
  const given = handsOverSetup(r);
  const fam = r.pick(SQUARE_FAMILIES);
  const b = r.int(2, 3);
  const L = fam.L(b);
  return {
    prompt: md`Find the length of the curve $y = ${fam.fTex}$ for $1 \le x \le ${b}$.${given ? md` The arc length integral is $\int_{1}^{${b}} \sqrt{1 + \left(${fam.ypTex}\right)^2} \, dx$; evaluate it.` : ""} Give an exact answer; fractions and ln are fine, like 17/12 or 3/2 + ln(2)/4.`,
    answer: L.text,
    simplified: simpleKey(L.text),
    hint: md`Compute $y'$ and square it. When you add 1, the middle term $-\frac12$ becomes $+\frac12$ and $1 + (y')^2$ is a perfect square.`,
    solution: [
      { math: md`y' = ${fam.ypTex}`, note: "" },
      { math: md`(y')^2 = ${fam.yp2Tex}, \qquad 1 + (y')^2 = ${fam.sqTex}`, note: md`Adding 1 flips the sign of the middle term, so the sum is the square of the same two terms with a plus.` },
      { math: md`\sqrt{1 + (y')^2} = ${fam.intTex}`, note: md`Both terms are positive for $x > 0$, so the root of the square is the expression itself.` },
      { math: md`L = \int_1^{${b}} \left(${fam.intTex}\right) dx = \left[${fam.antiTex}\right]_1^{${b}} = ${L.tex}`, note: "" },
    ],
  };
};

const arcIntegrand: Generator = (r) => {
  const v = r.pick([
    { fTex: "\\frac{x^3}{6} + \\frac{1}{2x}", ypTex: "\\frac{x^2}{2} - \\frac{1}{2x^2}", ypText: "x^2/2 - 1/(2x^2)", sumTex: "\\frac{x^4}{4} + \\frac12 + \\frac{1}{4x^4}", answer: "x^2/2 + 1/(2x^2)", answerTex: "\\frac{x^2}{2} + \\frac{1}{2x^2}" },
    { fTex: "\\frac{x^4}{8} + \\frac{1}{4x^2}", ypTex: "\\frac{x^3}{2} - \\frac{1}{2x^3}", ypText: "x^3/2 - 1/(2x^3)", sumTex: "\\frac{x^6}{4} + \\frac12 + \\frac{1}{4x^6}", answer: "x^3/2 + 1/(2x^3)", answerTex: "\\frac{x^3}{2} + \\frac{1}{2x^3}" },
    { fTex: "\\frac{x^3}{3} + \\frac{1}{4x}", ypTex: "x^2 - \\frac{1}{4x^2}", ypText: "x^2 - 1/(4x^2)", sumTex: "x^4 + \\frac12 + \\frac{1}{16x^4}", answer: "(4x^4 + 1)/(4x^2)", answerTex: "x^2 + \\frac{1}{4x^2}" },
    { fTex: "\\frac{x^2}{8} - \\ln x", ypTex: "\\frac{x}{4} - \\frac{1}{x}", ypText: "x/4 - 1/x", sumTex: "\\frac{x^2}{16} + \\frac12 + \\frac{1}{x^2}", answer: "(x^2 + 4)/(4x)", answerTex: "\\frac{x}{4} + \\frac{1}{x}" },
    { fTex: "\\frac23 (x^2 + 1)^{3/2}", ypTex: "2x\\sqrt{x^2 + 1}", ypText: "2x sqrt(x^2 + 1)", sumTex: "1 + 4x^2(x^2 + 1) = 4x^4 + 4x^2 + 1", answer: "2x^2 + 1", answerTex: "2x^2 + 1" },
    { fTex: "\\frac13 (x^2 + 2)^{3/2}", ypTex: "x\\sqrt{x^2 + 2}", ypText: "x sqrt(x^2 + 2)", sumTex: "1 + x^2(x^2 + 2) = x^4 + 2x^2 + 1", answer: "x^2 + 1", answerTex: "x^2 + 1" },
  ]);
  return {
    prompt: md`Let $y = ${v.fTex}$ for $x > 0$. The arc length integrand $\sqrt{1 + (y')^2}$ simplifies to an expression with no square root. Find it, as an expression in $x$ (type it like x^2/2 + 1/(2x^2)).`,
    answer: v.answer,
    simplified: true,
    positive: true,
    verify: [`g^2 = 1 + (${v.ypText})^2`],
    hint: md`Differentiate, square, add 1, and look for a perfect square: $(A - B)^2 + 4AB = (A + B)^2$.`,
    solution: [
      { math: md`y' = ${v.ypTex}`, note: "" },
      { math: md`1 + (y')^2 = ${v.sumTex} = \left(${v.answerTex}\right)^2`, note: "Adding 1 completes the square." },
      { math: md`\sqrt{1 + (y')^2} = ${v.answerTex}`, note: md`Positive for $x > 0$, so no absolute value is needed.` },
    ],
  };
};

// ── Lesson 5: Work and other physics ────────────────────────────────────────

const tenths = (n: number) => (n === 0 ? "0" : n === 10 ? "1" : `0.${n}`);

const springWork: Generator = (r) => {
  const given = handsOverSetup(r);
  if (r.next() < 0.5) {
    const [F, d, k] = r.pick([
      [20, "0.5", 40],
      [10, "0.2", 50],
      [15, "0.25", 60],
      [20, "0.25", 80],
      [10, "0.1", 100],
      [30, "0.25", 120],
      [20, "0.1", 200],
      [30, "0.2", 150],
    ] as const);
    const A = r.int(0, 4);
    const B = r.int(A + 1, 6);
    const W = fr(k * (B * B - A * A), 200);
    return {
      prompt: md`A force of $${F}$ N holds a spring stretched $${d}$ m beyond its natural length. How much work is done stretching it from $${tenths(A)}$ m to $${tenths(B)}$ m beyond its natural length?${given ? md` Hooke's law gives $F = ${k}x$, so $W = \int_{${tenths(A)}}^{${tenths(B)}} ${k}x \, dx$; evaluate it.` : ""} Give the answer in joules, as a number like 6.3 or 63/10.`,
      answer: ftext(W),
      hint: md`First find $k$ from Hooke's law, $F = kx$, using the one measurement given. Then work is $\int kx\,dx$ between the two stretches.`,
      solution: [
        { math: md`k = \frac{${F}}{${d}} = ${k} \text{ N/m}`, note: md`Hooke's law $F = kx$ with the measured pair $F = ${F}$, $x = ${d}$.` },
        { math: md`W = \int_{${tenths(A)}}^{${tenths(B)}} ${k}x\,dx = \left[${k / 2}x^2\right]_{${tenths(A)}}^{${tenths(B)}}`, note: md`The force at stretch $x$ is $${k}x$; integrate it over the stretch.` },
        { math: md`= ${k / 2}\left(${tenths(B)}^2 - ${tenths(A)}^2\right) = ${ftex(W)} \text{ J}`, note: md`That is $${(W.n / W.d).toFixed(W.d === 1 ? 0 : 3).replace(/\.?0+$/, "")}$ joules.` },
      ],
    };
  }
  const L = r.pick([10, 20, 30]);
  const d1 = r.pick([2, 4, 5, 10]);
  const j = r.int(2, 6);
  const F = d1 * j;
  const k = 100 * j;
  const marks = [0, 5, 10, 15, 20, 25];
  const ai = r.int(0, 3);
  const bi = r.int(ai + 1, 5);
  const [a, b] = [marks[ai]!, marks[bi]!];
  const W = fr(j * (b * b - a * a), 200);
  return {
    prompt: md`A spring has natural length $${L}$ cm. A force of $${F}$ N holds it stretched to a length of $${L + d1}$ cm. How much work is done stretching it from $${L + a}$ cm to $${L + b}$ cm?${given ? md` In meters, Hooke's law gives $k = ${F}/${d1 / 100} = ${k}$ N/m, so $W = \int_{${a / 100}}^{${b / 100}} ${k}x \, dx$; evaluate it.` : ""} Give the answer in joules, as a number like 6.3 or 63/10.`,
    answer: ftext(W),
    hint: md`Measure the stretch $x$ from the natural length, in meters. The spring at $${L + d1}$ cm is stretched $${d1}$ cm $= ${d1 / 100}$ m.`,
    solution: [
      { math: md`x = ${L + d1} - ${L} = ${d1} \text{ cm} = ${d1 / 100} \text{ m}, \qquad k = \frac{${F}}{${d1 / 100}} = ${k} \text{ N/m}`, note: "Hooke's law uses the stretch beyond natural length, in meters." },
      { math: md`\text{from } x = ${a / 100} \text{ m to } x = ${b / 100} \text{ m}`, note: md`Subtract the natural length: $${L + a} - ${L} = ${a}$ cm and $${L + b} - ${L} = ${b}$ cm.` },
      { math: md`W = \int_{${a / 100}}^{${b / 100}} ${k}x\,dx = ${k / 2}\left(${b / 100}^2 - ${a / 100}^2\right) = ${ftex(W)} \text{ J}`, note: "" },
    ],
  };
};

const pumpingWork: Generator = (r) => {
  const given = handsOverSetup(r);
  const kind = r.int(0, 2);
  const density = md`Take the weight density of water as $9800$ newtons per cubic meter.`;
  if (kind === 0) {
    const R = r.int(1, 3);
    const h = r.int(2, 6);
    const s = r.pick([0, 0, 1, 2]);
    const W = fmul(fr(9800 * R * R), fadd(fr(h * h, 2), fr(s * h)));
    return {
      prompt: md`A cylindrical tank with radius $${R}$ m and height $${h}$ m stands upright and is full of water. How much work is needed to pump all the water ${s ? md`up to a spout $${s}$ m above the top of the tank` : "out over the top of the tank"}?${given ? md` Measuring $y$ up from the bottom, the slab at height $y$ weighs $9800\pi \cdot ${R * R} \, dy$ newtons and rises $${h + s} - y$ meters, so $W = \int_{0}^{${h}} 9800\pi \cdot ${R * R}\,(${h + s} - y) \, dy$; evaluate it.` : ""} ${density} Give the answer in joules; use pi, like 490000pi.`,
      answer: piText(W),
      simplified: true,
      hint: md`Slice the water into horizontal slabs. The slab at height $y$ has volume $\pi \cdot ${R}^2\,dy$, so its weight is $9800 \cdot ${R * R}\pi\,dy$, and it must rise $${h + s} - y$ meters.`,
      solution: [
        { math: md`A(y) = \pi \cdot ${R}^2 = ${R * R}\pi, \qquad \text{weight of slab} = 9800 \cdot ${R * R}\pi\,dy = ${9800 * R * R}\pi\,dy`, note: "Every cross-section of a cylinder is the same circle." },
        { math: md`\text{lift} = ${h + s} - y`, note: s ? md`The outlet is at height $${h} + ${s} = ${h + s}$.` : md`The slab at height $y$ rises to the rim at height ${h}.` },
        { math: md`W = \int_0^{${h}} ${9800 * R * R}\pi\,(${h + s} - y)\,dy = ${9800 * R * R}\pi\left[${h + s}y - \frac{y^2}{2}\right]_0^{${h}}`, note: "" },
        { math: md`= ${9800 * R * R}\pi\left(${(h + s) * h} - \frac{${h * h}}{2}\right) = ${piTex(W)} \text{ J}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const l = r.int(1, 4);
    const w = r.int(1, 4);
    const h = r.int(2, 4);
    const d = r.pick([h, h, h - 1]);
    const W = fmul(fr(9800 * l * w), fsub(fr(h * d), fr(d * d, 2)));
    return {
      prompt: md`A rectangular tank is $${l}$ m long, $${w}$ m wide and $${h}$ m deep, and holds water to a depth of $${d}$ m${d === h ? " (it is full)" : ""}. How much work is needed to pump all the water out over the top?${given ? md` Measuring $y$ up from the bottom, the slab at height $y$ weighs $9800 \cdot ${l * w} \, dy$ newtons and rises $${h} - y$ meters, so $W = \int_{0}^{${d}} 9800 \cdot ${l * w}\,(${h} - y) \, dy$; evaluate it.` : ""} ${density} Give the answer in joules, like 1176000.`,
      answer: ftext(W),
      simplified: true,
      hint: md`The slab at height $y$ has volume $${l} \cdot ${w}\,dy$ and rises $${h} - y$ meters to the top. The water only goes up to $y = ${d}$, so that is the upper limit.`,
      solution: [
        { math: md`\text{weight of slab} = 9800 \cdot ${l} \cdot ${w}\,dy = ${9800 * l * w}\,dy`, note: "Rectangular cross-sections are all the same." },
        { math: md`W = \int_0^{${d}} ${9800 * l * w}\,(${h} - y)\,dy = ${9800 * l * w}\left[${h}y - \frac{y^2}{2}\right]_0^{${d}}`, note: md`The water fills $0 \le y \le ${d}$; each slab rises to the rim at $y = ${h}$.` },
        { math: md`= ${9800 * l * w}\left(${h * d} - \frac{${d * d}}{2}\right) = ${ftex(W)} \text{ J}`, note: "" },
      ],
    };
  }
  const [R, h] = r.pick([
    [3, 4],
    [3, 6],
    [2, 6],
    [2, 3],
    [1, 6],
  ] as const);
  const W = fr(9800 * R * R * h * h, 12);
  const ratio = fracTex(R, h);
  const coef = fr(9800 * R * R, h * h);
  return {
    prompt: md`A tank is an inverted cone (vertex down) with top radius $${R}$ m and height $${h}$ m, and it is full of water. How much work is needed to pump all the water out over the top?${given ? md` At height $y$ above the vertex the slab has radius $${ratio}y$, so $W = \int_{0}^{${h}} 9800\pi\left(${ratio}y\right)^2 (${h} - y) \, dy$; evaluate it.` : ""} ${density} Give the answer in joules; use pi, like 117600pi.`,
    answer: piText(W),
    simplified: true,
    hint: md`The slab at height $y$ (from the vertex) is a disk whose radius grows in proportion to $y$: by similar triangles, $r = ${ratio}y$. Its weight is $9800\pi r^2\,dy$ and it rises $${h} - y$.`,
    solution: [
      { math: md`\frac{r}{y} = \frac{${R}}{${h}} \;\Rightarrow\; r = ${ratio}y, \qquad A(y) = \pi\left(${ratio}y\right)^2 = ${ftex(fr(R * R, h * h))}\pi y^2`, note: "Similar triangles in a vertical cross-section through the vertex." },
      { math: md`W = \int_0^{${h}} 9800 \cdot ${ftex(fr(R * R, h * h))}\pi y^2\,(${h} - y)\,dy = ${ftex(coef)}\pi\int_0^{${h}} \left(${h}y^2 - y^3\right) dy`, note: "Weight of the slab times the distance it rises." },
      { math: md`= ${ftex(coef)}\pi\left[\frac{${h}y^3}{3} - \frac{y^4}{4}\right]_0^{${h}} = ${ftex(coef)}\pi \cdot \frac{${h ** 4}}{12} = ${piTex(W)} \text{ J}`, note: md`$\frac{h^4}{3} - \frac{h^4}{4} = \frac{h^4}{12}$. In general a full cone takes $\frac{9800\pi R^2 h^2}{12}$ joules.` },
    ],
  };
};

const centroid: Generator = (r) => {
  const kind = r.int(0, 2);
  let fTex: string;
  let b: number;
  let A: Frac;
  let My: Frac;
  let Mx: Frac;
  let aTex: string;
  let myTex: string;
  let mxTex: string;
  if (kind === 0) {
    const m = r.int(1, 3);
    b = r.pick([1, 2, 3, 4, 6]);
    fTex = m === 1 ? "x" : `${m}x`;
    A = fr(m * b * b, 2);
    My = fr(m * b ** 3, 3);
    Mx = fr(m * m * b ** 3, 6);
    aTex = md`\left[\frac{${m === 1 ? "" : m}x^2}{2}\right]_0^{${b}}`;
    myTex = md`\int_0^{${b}} ${m === 1 ? "" : m}x^2\,dx = \left[\frac{${m === 1 ? "" : m}x^3}{3}\right]_0^{${b}}`;
    mxTex = md`\int_0^{${b}} \frac12 (${fTex})^2\,dx = \left[\frac{${m * m}x^3}{6}\right]_0^{${b}}`;
  } else if (kind === 1) {
    const n = r.int(2, 3);
    b = r.int(1, 3);
    fTex = `x^${n}`;
    A = fr(b ** (n + 1), n + 1);
    My = fr(b ** (n + 2), n + 2);
    Mx = fr(b ** (2 * n + 1), 2 * (2 * n + 1));
    aTex = md`\left[\frac{x^${n + 1}}{${n + 1}}\right]_0^{${b}}`;
    myTex = md`\int_0^{${b}} x^${n + 1}\,dx = \left[\frac{x^${n + 2}}{${n + 2}}\right]_0^{${b}}`;
    mxTex = md`\int_0^{${b}} \frac12 x^${2 * n}\,dx = \left[\frac{x^${2 * n + 1}}{${2 * (2 * n + 1)}}\right]_0^{${b}}`;
  } else {
    const s = r.int(1, 3);
    b = s * s;
    fTex = "\\sqrt{x}";
    A = fr(2 * s ** 3, 3);
    My = fr(2 * s ** 5, 5);
    Mx = fr(b * b, 4);
    aTex = md`\left[\frac23 x^{3/2}\right]_0^{${b}}`;
    myTex = md`\int_0^{${b}} x^{3/2}\,dx = \left[\frac25 x^{5/2}\right]_0^{${b}}`;
    mxTex = md`\int_0^{${b}} \frac12 x\,dx = \left[\frac{x^2}{4}\right]_0^{${b}}`;
  }
  const xbar = fr(My.n * A.d, My.d * A.n);
  const ybar = fr(Mx.n * A.d, Mx.d * A.n);
  return {
    prompt: md`Find the centroid of the region under $y = ${fTex}$ from $x = 0$ to $x = ${b}$ (uniform density). Give it as $(\bar{x}, \bar{y})$ with exact coordinates, like (3/2, 6/5).`,
    answer: `(${ftext(xbar)}, ${ftext(ybar)})`,
    form: "tuple",
    hint: md`Three integrals: the area $A = \int f\,dx$, the moment $M_y = \int x f\,dx$, and $M_x = \int \frac12 f^2\,dx$. Then $\bar{x} = M_y / A$ and $\bar{y} = M_x / A$.`,
    solution: [
      { math: md`A = \int_0^{${b}} ${fTex}\,dx = ${aTex} = ${ftex(A)}`, note: "The area, which divides both moments." },
      { math: md`M_y = \int_0^{${b}} x \cdot ${fTex}\,dx = ${myTex} = ${ftex(My)}`, note: md`Each strip's area times its distance $x$ from the $y$-axis.` },
      { math: md`M_x = ${mxTex} = ${ftex(Mx)}`, note: md`Each strip's area $f\,dx$ times the height of its own center, $\frac12 f$.` },
      { math: md`\bar{x} = \frac{M_y}{A} = ${ftex(xbar)}, \qquad \bar{y} = \frac{M_x}{A} = ${ftex(ybar)}`, note: md`Sanity check: $\bar{x}$ lies between 0 and ${b}, and $\bar{y}$ lies below the curve's average height.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit1: Unit = {
  title: "Applications of Integration",
  lessons: [
    {
      id: slug("Area between curves"),
      title: "Area between curves",
      summary: "Thin strips between two curves add up to an integral of top minus bottom; sometimes it's easier sideways.",
      blocks: [
        {
          kind: "text",
          body: md`In Calculus 1 the integral $\int_a^b f(x)\,dx$ was built from thin rectangles under a curve: height $f(x)$, width $\Delta x$, added up, then the limit. Nothing in that construction needs the bottom of the rectangle to sit on the $x$-axis. Let each rectangle run from one curve up to another, and the same limit gives the area between them.`,
        },
        {
          kind: "why",
          title: "Why the integrand is top minus bottom",
          body: md`Suppose $f(x) \ge g(x)$ on $[a, b]$. Cut $[a, b]$ into $n$ pieces of width $\Delta x$ and pick a point $x_i$ in each. Over the $i$-th piece, draw the rectangle from the lower curve up to the upper one. Its height is $f(x_i) - g(x_i)$ and its area is $\left[f(x_i) - g(x_i)\right]\Delta x$. Together the rectangles approximate the region, and the approximation improves as $\Delta x \to 0$ because each rectangle hugs the curves more closely:

$$A = \lim_{n \to \infty} \sum_{i=1}^{n} \left[f(x_i) - g(x_i)\right]\Delta x = \int_a^b \left[f(x) - g(x)\right] dx.$$

The last step is the definition of the definite integral, applied to the function $f - g$, which is continuous whenever $f$ and $g$ are.`,
        },
        {
          kind: "key",
          title: "Area between curves",
          body: md`If $f(x) \ge g(x)$ for $a \le x \le b$, the area of the region between the two graphs is

$$A = \int_a^b \left[f(x) - g(x)\right] dx = \int_a^b (\text{top} - \text{bottom}) \, dx.$$

The height of a strip is always top minus bottom, whatever the signs of $f$ and $g$.`,
        },
        {
          kind: "plot",
          x: [-2.5, 3.5],
          y: [-1, 5],
          curves: [
            { expr: "x + 2", label: "y = x + 2", color: 1 },
            { expr: "x^2", label: "y = x^2", color: 2 },
          ],
          shade: [{ expr: "x + 2", under: "x^2", from: -1, to: 2 }],
          vlines: [{ x: "c" }],
          points: [
            { x: "c", y: "c + 2", label: "{=c + 2}", color: 1 },
            { x: "c", y: "c^2", label: "{=c^2}", color: 2 },
          ],
          params: [{ name: "c", min: -1, max: 2, step: 0.1, value: 0.5 }],
          caption: md`The region between $y = x + 2$ and $y = x^2$. Slide $c$ to move the strip. At $x = c$ it reaches from $c^2$ up to $c + 2$, so its height is $(c + 2) - c^2$, whatever the sign of either value.`,
        },
        {
          kind: "proof",
          title: "The formula holds below the axis too",
          given: md`$f$ and $g$ are continuous on $[a, b]$ with $f(x) \ge g(x)$`,
          prove: md`The region between the graphs has area $\int_a^b \left[f(x) - g(x)\right] dx$`,
          steps: [
            { statement: md`Choose a constant $C$ with $g(x) + C \ge 0$ on $[a, b]$`, reason: md`A continuous function on a closed interval is bounded (Calculus 1), so take $C$ larger than $|\min g|$` },
            { statement: md`The region between $f + C$ and $g + C$ has the same area as the region between $f$ and $g$`, reason: md`It is the same region slid up by $C$; sliding doesn't change area` },
            { statement: md`$0 \le g + C \le f + C$ on $[a, b]$`, reason: md`Add $C$ to both sides of $g \le f$, and use the choice of $C$` },
            { statement: md`Area between $f + C$ and $g + C$ $= \int_a^b (f + C)\,dx - \int_a^b (g + C)\,dx$`, reason: md`The region under $f + C$ is the region under $g + C$ plus the region between them; areas of pieces add, and the area under a non-negative continuous curve is its integral (Calculus 1)` },
            { statement: md`$= \int_a^b \left[f(x) - g(x)\right] dx$`, reason: md`Linearity of the integral; the two $\int_a^b C\,dx$ terms cancel` },
          ],
        },
        {
          kind: "example",
          title: "A line over a parabola",
          problem: md`Find the area of the region enclosed by $y = x + 2$ and $y = x^2$.`,
          steps: [
            { math: md`x^2 = x + 2 \;\Rightarrow\; x^2 - x - 2 = (x - 2)(x + 1) = 0 \;\Rightarrow\; x = -1, \; 2`, note: "No interval is given because the region is enclosed: the crossings are the limits, and you find them." },
            { math: md`x = 0: \quad \text{line} = 2 > 0 = \text{parabola}`, note: md`Test a point between the crossings. Two continuous curves can't swap places without crossing, so the line is on top on all of $[-1, 2]$.` },
            { math: md`A = \int_{-1}^{2} \left[(x + 2) - x^2\right] dx = \left[\frac{x^2}{2} + 2x - \frac{x^3}{3}\right]_{-1}^{2}`, note: "Top minus bottom, then the power rule." },
            { math: md`= \left(2 + 4 - \frac83\right) - \left(\frac12 - 2 + \frac13\right) = \frac{10}{3} + \frac76 = \frac92`, note: "" },
          ],
        },
        {
          kind: "text",
          body: md`If the curves cross inside the interval, "top" changes sides, and a single $\int (f - g)\,dx$ would count one piece negatively. Split at the crossing and integrate top minus bottom on each piece. In one formula, the area is $\int_a^b |f(x) - g(x)|\,dx$, and the absolute value is handled by splitting.`,
        },
        {
          kind: "example",
          title: "Curves that cross",
          problem: md`Find the area between $y = x^3$ and $y = x$ for $-1 \le x \le 1$.`,
          steps: [
            { math: md`x^3 = x \;\Rightarrow\; x(x^2 - 1) = 0 \;\Rightarrow\; x = -1, \; 0, \; 1`, note: "They cross at 0, inside the interval." },
            { math: md`[-1, 0]: \; x^3 \ge x, \qquad [0, 1]: \; x \ge x^3`, note: md`Test $x = -\tfrac12$: $-\tfrac18 > -\tfrac12$. Test $x = \tfrac12$: $\tfrac12 > \tfrac18$.` },
            { math: md`A = \int_{-1}^{0} (x^3 - x)\,dx + \int_{0}^{1} (x - x^3)\,dx = \frac14 + \frac14 = \frac12`, note: md`Each piece: $\left[\frac{x^2}{2} - \frac{x^4}{4}\right]_0^1 = \frac14$, and the first by symmetry. A single integral of $x - x^3$ from $-1$ to $1$ would give $0$: the two pieces would cancel.` },
          ],
        },
        {
          kind: "key",
          title: "Integrating in y",
          body: md`If a region is bounded on the right by $x = R(y)$ and on the left by $x = L(y)$ for $c \le y \le d$, use horizontal strips:

$$A = \int_c^d \left[R(y) - L(y)\right] dy = \int_c^d (\text{right} - \text{left}) \, dy.$$`,
        },
        {
          kind: "why",
          title: "Why the same argument works sideways",
          body: md`Nothing in the Riemann-sum derivation cared which axis was which. Cut $[c, d]$ on the $y$-axis into pieces of height $\Delta y$. The horizontal strip at height $y_i$ runs from the left boundary to the right one, so it has length $R(y_i) - L(y_i)$ and area $\left[R(y_i) - L(y_i)\right]\Delta y$. Sum, take the limit, and the integral in $y$ appears.

Choose the direction that keeps the boundaries simple. If the lower boundary of a region changes formula partway across, vertical strips need two integrals, while horizontal strips may need one.`,
        },
        {
          kind: "plot",
          x: [-1, 5],
          y: [-2, 3],
          parametric: [
            { x: "t^2", y: "t", t: [-1.5, 2.3], label: "x = y^2", color: 2 },
            { x: "t + 2", y: "t", t: [-2, 2.8], label: "x = y + 2", color: 1 },
          ],
          shade: [
            { expr: "sqrt(x)", under: "-sqrt(x)", from: 0, to: 1 },
            { expr: "sqrt(x)", under: "x - 2", from: 1, to: 4 },
          ],
          hlines: [{ y: "c" }],
          points: [
            { x: "c^2", y: "c", label: "{=c^2}", color: 2 },
            { x: "c + 2", y: "c", label: "{=c + 2}", color: 1 },
          ],
          params: [{ name: "c", min: -1, max: 2, step: 0.1, value: 1 }],
          caption: md`The region between $x = y^2$ and $x = y + 2$. A horizontal strip at height $c$ runs from $c^2$ to $c + 2$, one formula for the whole region. A vertical strip would have the parabola below it for $x < 1$ and the line below it for $x > 1$.`,
        },
        {
          kind: "example",
          title: "The same region both ways",
          problem: md`Find the area enclosed by $x = y^2$ and $x = y + 2$.`,
          steps: [
            { math: md`y^2 = y + 2 \;\Rightarrow\; (y - 2)(y + 1) = 0 \;\Rightarrow\; y = -1, \; 2`, note: md`Set the $x$-values equal and solve for $y$.` },
            { math: md`y = 0: \quad \text{line } x = 2 > 0 = \text{parabola}`, note: "The line is on the right between the crossings." },
            { math: md`A = \int_{-1}^{2} \left[(y + 2) - y^2\right] dy = \left[\frac{y^2}{2} + 2y - \frac{y^3}{3}\right]_{-1}^{2} = \frac92`, note: md`Right minus left, thickness $dy$. The same arithmetic as the first example, with $y$ in place of $x$.` },
            { math: md`\text{In } x: \quad \int_0^1 \left[\sqrt{x} - (-\sqrt{x})\right] dx + \int_1^4 \left[\sqrt{x} - (x - 2)\right] dx = \frac43 + \frac{19}{6} = \frac92`, note: md`Vertical strips need two integrals, because the bottom boundary switches from the parabola to the line at $x = 1$. Same answer, more work.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the area of the region enclosed by $y = 2x$ and $y = x^2$. Give an exact answer, like 4/3.`,
          answer: "4/3",
          simplified: true,
          explain: md`They meet at $x = 0$ and $x = 2$, and $2x$ is on top (at $x = 1$: $2 > 1$). $\int_0^2 (2x - x^2)\,dx = \left[x^2 - \frac{x^3}{3}\right]_0^2 = 4 - \frac83 = \frac43$.`,
        },
        {
          kind: "check",
          prompt: md`Find the area of the region enclosed by $x = y^2$ and $x = 4$ by integrating in $y$. Give an exact answer, like 32/3.`,
          answer: "32/3",
          simplified: true,
          explain: md`$y^2 = 4$ at $y = \pm 2$, and $x = 4$ is on the right. $\int_{-2}^{2} (4 - y^2)\,dy = \left[4y - \frac{y^3}{3}\right]_{-2}^{2} = \left(8 - \frac83\right) - \left(-8 + \frac83\right) = \frac{32}{3}$.`,
        },
      ],
      practice: [areaLineParabola, areaBetweenIntegral, areaInY],
    },
    {
      id: slug("Volumes by slicing"),
      title: "Volumes by slicing",
      summary: "Slice a solid into thin slabs; the limit of their total is the integral of cross-sectional area. Disks and washers are the case of revolution.",
      blocks: [
        {
          kind: "text",
          body: md`Area came from adding thin rectangles. Volume comes from adding thin slabs. Picture a loaf of bread sliced thinly: each slice is almost a flat prism, with some cross-sectional area and a small thickness, and the loaf is the sum of its slices. That picture is the whole method.`,
        },
        {
          kind: "why",
          title: "Why volume is the integral of cross-sectional area",
          body: md`Place the solid along the $x$-axis from $x = a$ to $x = b$, and let $A(x)$ be the area of the cross-section cut by the plane perpendicular to the axis at $x$. Slice at $x_0 = a, x_1, \dots, x_n = b$, each slab of thickness $\Delta x$. If $A$ is continuous, the slab between $x_{i-1}$ and $x_i$ differs very little from a flat prism of base area $A(x_i)$ and thickness $\Delta x$, whose volume is $A(x_i)\Delta x$. So

$$V \approx \sum_{i=1}^{n} A(x_i)\,\Delta x, \qquad V = \lim_{n \to \infty} \sum_{i=1}^{n} A(x_i)\,\Delta x = \int_a^b A(x)\,dx.$$

The error in one slab is at most (the biggest change in $A$ across the slab) times $\Delta x$, and a continuous $A$ changes as little as we like over a thin enough slab. So the total error over all $n$ slabs is at most that tiny change times $(b - a)$, which goes to 0.`,
        },
        {
          kind: "key",
          title: "Volume by slicing",
          body: md`If a solid stretches from $x = a$ to $x = b$ and the cross-section at $x$ has area $A(x)$, then

$$V = \int_a^b A(x)\,dx.$$

The whole job is to find $A(x)$. Slicing along $y$ works the same way: $V = \int_c^d A(y)\,dy$.`,
        },
        {
          kind: "example",
          title: "A pyramid, from scratch",
          problem: md`A pyramid has a square base of side $s$ and height $h$. Find its volume by slicing.`,
          steps: [
            { math: md`\text{at height } y: \quad \frac{\text{side}}{s} = \frac{h - y}{h} \;\Rightarrow\; \text{side} = s\left(1 - \frac{y}{h}\right)`, note: md`Slice horizontally; each cross-section is a square. In a vertical cross-section through the apex, similar triangles shrink the side in proportion to the distance from the apex, $h - y$.` },
            { math: md`A(y) = s^2\left(1 - \frac{y}{h}\right)^2`, note: "" },
            { math: md`V = \int_0^h s^2\left(1 - \frac{y}{h}\right)^2 dy = s^2\left[-\frac{h}{3}\left(1 - \frac{y}{h}\right)^3\right]_0^h = \frac{s^2 h}{3}`, note: md`Substitute $u = 1 - y/h$, $du = -dy/h$. The famous $\frac13 \cdot \text{base} \cdot \text{height}$ falls out; the $\frac13$ is from integrating $u^2$.` },
          ],
        },
        {
          kind: "text",
          body: md`Spin a region in the plane around a line and it sweeps out a **solid of revolution**: a vase, a bowl, a doughnut. Take the region under $y = f(x)$ for $a \le x \le b$ and revolve it about the $x$-axis. The cross-section at $x$ is a circle whose radius is the height of the curve, $f(x)$. So $A(x) = \pi f(x)^2$, and slicing gives the **disk method**.`,
        },
        {
          kind: "plot",
          x: [-0.5, 4.5],
          y: [-2.5, 2.5],
          curves: [
            { expr: "sqrt(x)", label: "y = \\sqrt{x}", color: 1 },
            { expr: "-sqrt(x)", dashed: true, color: 1 },
          ],
          shade: [{ expr: "sqrt(x)", from: 0, to: 4 }],
          vlines: [{ x: "c" }],
          points: [
            { x: "c", y: "sqrt(c)", label: "r = {=sqrt(c)}", color: 2 },
            { x: "c", y: "-sqrt(c)", color: 2 },
          ],
          params: [{ name: "c", min: 0.2, max: 4, step: 0.1, value: 2 }],
          caption: md`The region under $y = \sqrt{x}$ revolved about the $x$-axis. The dashed curve is where the region lands after half a turn. At $x = c$ the slice is a disk of radius $\sqrt{c}$ and area $\pi c$; the solid's volume is $\int_0^4 \pi x\,dx = 8\pi$.`,
        },
        {
          kind: "key",
          title: "Disks and washers",
          body: md`Revolving the region under $y = f(x)$, $a \le x \le b$, about the $x$-axis:

$$V = \int_a^b \pi\,f(x)^2\,dx.$$

Revolving the region between $y = f(x)$ (outer) and $y = g(x)$ (inner), with $f \ge g \ge 0$: each slice is a **washer**, a disk with a hole, so

$$V = \int_a^b \pi\left[f(x)^2 - g(x)^2\right] dx.$$

Revolving about the $y$-axis, slice horizontally: write the curves as $x$ in terms of $y$ and integrate in $dy$.`,
        },
        {
          kind: "why",
          title: "Why R² − r², not (R − r)²",
          body: md`A washer is the big disk with the small disk removed, so its area is $\pi R^2 - \pi r^2$. The tempting shortcut $\pi(R - r)^2$ is the area of a disk whose radius is the gap between the two radii, a different shape entirely. With $R = 3$ and $r = 1$ the washer has area $8\pi$, while $\pi(R - r)^2 = 4\pi$. Keep the two squares separate. If you like, $\pi(R^2 - r^2) = \pi(R - r)(R + r)$: the area depends on $R + r$ as well as on the gap.`,
        },
        {
          kind: "diagram",
          view: [-5, 5, -5, 5],
          params: [
            { name: "r", tex: "r", min: 0.5, max: 3, step: 0.25, value: 1.5 },
            { name: "w", tex: "R - r", min: 0.25, max: 2, step: 0.25, value: 1.5 },
          ],
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "P", x: "r cos(pi/4)", y: "r sin(pi/4)", label: "", hidden: true },
            { name: "Q", x: "(r + w) cos(5pi/6)", y: "(r + w) sin(5pi/6)", label: "", hidden: true },
          ],
          circles: [
            { center: "O", radius: "r + w", color: 1 },
            { center: "O", radius: "r", color: 2, dashed: true },
          ],
          segments: [
            { from: "O", to: "P", color: 2, label: "r" },
            { from: "O", to: "Q", color: 1, label: "R" },
          ],
          readouts: [
            { label: "R", value: "r + w" },
            { label: "\\pi R^2 - \\pi r^2", value: "pi((r + w)^2 - r^2)" },
            { label: "\\pi (R - r)^2", value: "pi w^2" },
          ],
          caption: md`A washer face-on: outer radius $R$, hole of radius $r$. Its area is the first readout. Keep $R - r$ fixed and grow $r$: the true area grows while the wrong formula $\pi(R - r)^2$ doesn't move.`,
        },
        {
          kind: "example",
          title: "A washer",
          problem: md`The region between $y = x$ and $y = x^2$ for $0 \le x \le 1$ is revolved about the $x$-axis. Find the volume.`,
          steps: [
            { math: md`R = x, \qquad r = x^2`, note: md`On $[0, 1]$ the line is above the parabola, so it is the outer radius.` },
            { math: md`V = \int_0^1 \pi\left[x^2 - (x^2)^2\right] dx = \pi\int_0^1 (x^2 - x^4)\,dx`, note: "Square each radius, then subtract." },
            { math: md`= \pi\left[\frac{x^3}{3} - \frac{x^5}{5}\right]_0^1 = \pi\left(\frac13 - \frac15\right) = \frac{2\pi}{15}`, note: "" },
          ],
        },
        {
          kind: "proof",
          title: "The volume of a sphere",
          given: md`A sphere of radius $r$`,
          prove: md`$V = \frac43\pi r^3$`,
          steps: [
            { statement: md`The sphere is the region under $y = \sqrt{r^2 - x^2}$, $-r \le x \le r$, revolved about the $x$-axis`, reason: md`The circle $x^2 + y^2 = r^2$ has upper half $y = \sqrt{r^2 - x^2}$, and spinning a half-disk about its diameter sweeps out the sphere` },
            { statement: md`$A(x) = \pi\left(\sqrt{r^2 - x^2}\right)^2 = \pi(r^2 - x^2)$`, reason: md`The cross-section at $x$ is a disk of radius $\sqrt{r^2 - x^2}$` },
            { statement: md`$V = \int_{-r}^{r} \pi(r^2 - x^2)\,dx$`, reason: "Volume by slicing" },
            { statement: md`$= \pi\left[r^2 x - \frac{x^3}{3}\right]_{-r}^{r} = \pi\left[\left(r^3 - \frac{r^3}{3}\right) - \left(-r^3 + \frac{r^3}{3}\right)\right]$`, reason: "Power rule and evaluation" },
            { statement: md`$= \pi \cdot \frac{4r^3}{3} = \frac43\pi r^3$`, reason: "Arithmetic" },
          ],
        },
        {
          kind: "example",
          title: "Revolving about the y-axis",
          problem: md`The region bounded by $y = x^2$, $y = 4$ and the $y$-axis is revolved about the $y$-axis. Find the volume.`,
          steps: [
            { math: md`x = \sqrt{y}, \qquad 0 \le y \le 4`, note: md`Slices perpendicular to the $y$-axis are horizontal disks, so describe the curve as $x$ in terms of $y$. The radius of the disk at height $y$ is its $x$-value.` },
            { math: md`V = \int_0^4 \pi\left(\sqrt{y}\right)^2 dy = \pi\int_0^4 y\,dy = \pi\left[\frac{y^2}{2}\right]_0^4 = 8\pi`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`The region under $y = x^2$ from $x = 0$ to $x = 1$ is revolved about the $x$-axis. Find the volume. Use pi, like 2pi/15.`,
          answer: "pi/5",
          simplified: true,
          explain: md`$V = \int_0^1 \pi(x^2)^2\,dx = \pi\int_0^1 x^4\,dx = \frac{\pi}{5}$.`,
        },
        {
          kind: "check",
          prompt: md`The region between $y = x + 1$ and $y = 1$ for $0 \le x \le 2$ is revolved about the $x$-axis. Find the volume. Use pi, like 2pi/15.`,
          answer: "20pi/3",
          simplified: true,
          explain: md`Washers with $R = x + 1$ and $r = 1$: $V = \pi\int_0^2 \left[(x + 1)^2 - 1\right] dx = \pi\int_0^2 (x^2 + 2x)\,dx = \pi\left(\frac83 + 4\right) = \frac{20\pi}{3}$.`,
        },
      ],
      practice: [diskVolume, washerGiven, crossSections],
    },
    {
      id: slug("Volumes by shells"),
      title: "Volumes by shells",
      summary: "Strips parallel to the axis sweep out thin cylindrical shells; unrolling one gives the element 2π(radius)(height)(thickness).",
      blocks: [
        {
          kind: "text",
          body: md`Revolve the region under $y = 4x - x^2$, $0 \le x \le 4$, about the $y$-axis. Slicing horizontally means solving $y = 4x - x^2$ for $x$, which gives two square-root branches and a messy washer. There is a cleaner way: cut the region into **vertical** strips instead, and ask what one strip sweeps out as it goes around.`,
        },
        {
          kind: "plot",
          x: [-4.5, 4.5],
          y: [-0.5, 4.5],
          curves: [
            { expr: "4x - x^2", label: "y = 4x - x^2", domain: [0, 4], color: 1 },
            { expr: "-4x - x^2", dashed: true, domain: [-4, 0], color: 1 },
          ],
          shade: [
            { expr: "4x - x^2", from: 0, to: 4 },
            { expr: "4x - x^2", from: "c - 0.12", to: "c + 0.12", color: 2 },
            { expr: "-4x - x^2", from: "-c - 0.12", to: "-c + 0.12", color: 2 },
          ],
          points: [{ x: "c", y: "4c - c^2", label: "h = {=4c - c^2}", color: 2 }],
          params: [{ name: "c", min: 0.3, max: 3.7, step: 0.1, value: 1.5 }],
          caption: md`The strip at $x = c$ (orange) sits $c$ from the $y$-axis and is $4c - c^2$ tall. Spun around the axis it sweeps out a thin tube of radius $c$; the dashed curve shows where the region lands after half a turn.`,
        },
        {
          kind: "why",
          title: "Why a strip sweeps out 2πxh Δx",
          body: md`A vertical strip at distance $x$ from the axis, of height $h = f(x)$ and width $\Delta x$, revolves into a thin cylindrical shell: a tube of radius $x$, height $h$ and wall thickness $\Delta x$. Cut the tube down one side and unroll it. It flattens into a slab that is $2\pi x$ long (the circumference), $h$ tall and $\Delta x$ thick, with volume

$$2\pi x \cdot h \cdot \Delta x.$$

The unrolling isn't quite exact: the outer face is a little longer than the inner one. But the exact shell volume is $\pi(x + \Delta x)^2 h - \pi x^2 h = 2\pi x h\,\Delta x + \pi h\,(\Delta x)^2$, and the extra term carries a $(\Delta x)^2$. Compared with the main term it is smaller by a factor of $\Delta x$, so in the limit it contributes nothing.`,
        },
        {
          kind: "key",
          title: "The shell method",
          body: md`Revolving the region under $y = f(x)$, $a \le x \le b$ (with $a \ge 0$), about the $y$-axis:

$$V = \int_a^b 2\pi x\,f(x)\,dx = \int 2\pi \cdot (\text{radius}) \cdot (\text{height}) \cdot d(\text{thickness}).$$

The radius is the distance from the strip to the axis of revolution, and the height is the length of the strip. For the region between two curves, the height is top minus bottom.`,
        },
        {
          kind: "diagram",
          view: [-5, 5, -5, 5],
          params: [
            { name: "x", tex: "x", min: 1, max: 3.5, step: 0.1, value: 2 },
            { name: "d", tex: "\\Delta x", min: 0.1, max: 1.2, step: 0.1, value: 0.8 },
          ],
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "P", x: "x", y: 0, label: "", hidden: true },
            { name: "Q", x: "x + d", y: 0, label: "", hidden: true },
          ],
          circles: [
            { center: "O", radius: "x", color: 1 },
            { center: "O", radius: "x + d", color: 2 },
          ],
          segments: [
            { from: "O", to: "P", color: 1, label: "x" },
            { from: "P", to: "Q", color: 2, label: "\\Delta x" },
          ],
          readouts: [
            { label: "\\text{exact ring area } \\pi(x + \\Delta x)^2 - \\pi x^2", value: "pi((x + d)^2 - x^2)" },
            { label: "2\\pi x\\,\\Delta x", value: "2 pi x d" },
            { label: "\\text{difference } \\pi(\\Delta x)^2", value: "pi d^2" },
          ],
          caption: md`A shell seen from above is a ring. Its exact area is the first readout; the unrolled estimate $2\pi x\,\Delta x$ is the second. Shrink $\Delta x$: the difference, $\pi(\Delta x)^2$, dies away much faster than either area.`,
        },
        {
          kind: "proof",
          title: "The shell formula",
          given: md`$f$ is continuous and non-negative on $[a, b]$ with $a \ge 0$; the region under $y = f(x)$ is revolved about the $y$-axis`,
          prove: md`$V = \int_a^b 2\pi x f(x)\,dx$`,
          steps: [
            { statement: md`Partition $[a, b]$ into $n$ pieces $[x_{i-1}, x_i]$ of width $\Delta x$, with midpoints $\bar{x}_i$`, reason: "Set-up" },
            { statement: md`The strip over $[x_{i-1}, x_i]$ sweeps out approximately $\pi x_i^2 f(\bar{x}_i) - \pi x_{i-1}^2 f(\bar{x}_i)$`, reason: md`Replace the strip by a rectangle of height $f(\bar{x}_i)$; it sweeps out the difference of two cylinders of that height. Because $f$ is continuous, the error is a small fraction of the shell and vanishes in the limit` },
            { statement: md`$\pi\left(x_i^2 - x_{i-1}^2\right) f(\bar{x}_i) = \pi(x_i + x_{i-1})(x_i - x_{i-1})\,f(\bar{x}_i) = 2\pi\bar{x}_i f(\bar{x}_i)\,\Delta x$`, reason: md`Difference of squares; $x_i + x_{i-1} = 2\bar{x}_i$ and $x_i - x_{i-1} = \Delta x$` },
            { statement: md`$V = \lim_{n \to \infty} \sum_{i=1}^{n} 2\pi\bar{x}_i f(\bar{x}_i)\,\Delta x = \int_a^b 2\pi x f(x)\,dx$`, reason: md`The sum is a midpoint Riemann sum for the continuous function $2\pi x f(x)$` },
          ],
        },
        {
          kind: "example",
          title: "A shell integral",
          problem: md`Revolve the region under $y = 4x - x^2$, $0 \le x \le 4$, about the $y$-axis. Find the volume.`,
          steps: [
            { math: md`\text{radius} = x, \qquad \text{height} = 4x - x^2`, note: md`The strip at $x$ is $4x - x^2$ tall and sits $x$ from the axis.` },
            { math: md`V = \int_0^4 2\pi x (4x - x^2)\,dx = 2\pi\int_0^4 (4x^2 - x^3)\,dx`, note: "Multiply the radius into the height before integrating." },
            { math: md`= 2\pi\left[\frac{4x^3}{3} - \frac{x^4}{4}\right]_0^4 = 2\pi\left(\frac{256}{3} - 64\right) = \frac{128\pi}{3}`, note: "" },
          ],
        },
        {
          kind: "example",
          title: "Shells and washers agree",
          problem: md`The region under $y = x^2$ for $0 \le x \le 2$ is revolved about the $y$-axis. Find the volume both ways.`,
          steps: [
            { math: md`\text{Shells: } V = \int_0^2 2\pi x \cdot x^2\,dx = 2\pi\left[\frac{x^4}{4}\right]_0^2 = 8\pi`, note: md`Vertical strips, radius $x$, height $x^2$.` },
            { math: md`\text{Washers: } V = \int_0^4 \pi\left[2^2 - \left(\sqrt{y}\right)^2\right] dy = \pi\int_0^4 (4 - y)\,dy = \pi(16 - 8) = 8\pi`, note: md`Horizontal slices at height $y$ run from the curve, $x = \sqrt{y}$, out to $x = 2$: a washer with outer radius 2 and inner radius $\sqrt{y}$.` },
          ],
        },
        {
          kind: "why",
          title: "Which method, and why",
          body: md`Both methods are slicing in disguise; they differ only in the direction of the strip. A strip **perpendicular** to the axis of revolution sweeps out a disk or washer. A strip **parallel** to the axis sweeps out a shell. Pick the direction that makes the ends of the strip easy to describe. If the region is given by $y$ in terms of $x$ and the axis is vertical, vertical strips (shells) avoid solving for $x$. If the axis is horizontal, the same vertical strips give disks or washers.`,
        },
        {
          kind: "key",
          title: "Other axes",
          body: md`The radius is always the distance from the strip to the axis.

- About the line $x = c$ with the region to its left: radius $c - x$. With the region to its right: radius $x - c$.
- About the $x$-axis using horizontal strips at height $y$: radius $y$, height $= \text{right} - \text{left}$, so $V = \int 2\pi y\left[R(y) - L(y)\right] dy$.`,
        },
        {
          kind: "example",
          title: "About a line that isn't an axis",
          problem: md`The region between $y = x$ and $y = x^2$ is revolved about the line $x = 2$. Find the volume.`,
          steps: [
            { math: md`\text{radius} = 2 - x, \qquad \text{height} = x - x^2, \qquad 0 \le x \le 1`, note: md`The curves meet at 0 and 1. A strip at $x$ is $2 - x$ away from the line $x = 2$.` },
            { math: md`V = \int_0^1 2\pi(2 - x)(x - x^2)\,dx = 2\pi\int_0^1 (2x - 3x^2 + x^3)\,dx`, note: md`Expand: $(2 - x)(x - x^2) = 2x - 2x^2 - x^2 + x^3$.` },
            { math: md`= 2\pi\left[x^2 - x^3 + \frac{x^4}{4}\right]_0^1 = 2\pi \cdot \frac14 = \frac{\pi}{2}`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`The region under $y = x^3$ from $x = 0$ to $x = 1$ is revolved about the $y$-axis. Use shells to find the volume. Use pi, like 2pi/7.`,
          answer: "2pi/5",
          simplified: true,
          explain: md`$V = \int_0^1 2\pi x \cdot x^3\,dx = 2\pi\left[\frac{x^5}{5}\right]_0^1 = \frac{2\pi}{5}$.`,
        },
        {
          kind: "check",
          prompt: md`The region bounded by $x = y^2$, $x = 4$ and $y = 0$ is revolved about the $x$-axis. Use horizontal shells to find the volume. Use pi, like 2pi/7.`,
          answer: "8pi",
          simplified: true,
          explain: md`The shell at height $y$ has radius $y$ and runs from $x = y^2$ to $x = 4$: $V = \int_0^2 2\pi y(4 - y^2)\,dy = 2\pi\left[2y^2 - \frac{y^4}{4}\right]_0^2 = 2\pi(8 - 4) = 8\pi$.`,
        },
      ],
      practice: [shellUnderCurve, shellBetweenCurves, shellHorizontal],
    },
    {
      id: slug("Arc length"),
      title: "Arc length",
      summary: "Approximate a curve by short chords, apply the Pythagorean theorem to each, and the limit is the integral of the square root of 1 + f'(x)².",
      blocks: [
        {
          kind: "text",
          body: md`How long is a curve? For a line segment, Pythagoras answers. For a curve, do what we always do: cut it into small pieces, treat each piece as straight, add up, and take the limit. Every piece of a smooth curve looks more and more like its chord as it shrinks, which is why this works.`,
        },
        {
          kind: "plot",
          x: [-0.5, 3.5],
          y: [-0.5, 6],
          curves: [{ expr: "x^2/2", label: "y = x^2/2", color: 1 }],
          parametric: [
            { x: "c + t d", y: "c^2/2 + t((c + d)^2/2 - c^2/2)", t: [0, 1], color: 2, label: "\\text{chord}" },
            { x: "c + t d", y: "c^2/2", t: [0, 1], color: 3, dashed: true },
            { x: "c + d", y: "c^2/2 + t((c + d)^2/2 - c^2/2)", t: [0, 1], color: 3, dashed: true },
          ],
          points: [
            { x: "c", y: "c^2/2", label: "A", color: 2 },
            { x: "c + d", y: "(c + d)^2/2", label: "B", color: 2 },
            { x: "c + d", y: "c^2/2", label: "C", color: 3 },
          ],
          params: [
            { name: "c", tex: "x_0", min: 0, max: 2, step: 0.1, value: 1 },
            { name: "d", tex: "\\Delta x", min: 0.1, max: 1.5, step: 0.1, value: 1 },
          ],
          caption: md`The piece of curve from $A$ to $B$ and its chord. The chord is the hypotenuse of a right triangle with legs $\Delta x = AC$ and $\Delta y = CB$, so its length is $\sqrt{(\Delta x)^2 + (\Delta y)^2}$. Shrink $\Delta x$ and the chord and the arc become indistinguishable.`,
        },
        {
          kind: "why",
          title: "Why the integrand is √(1 + f′(x)²)",
          body: md`Take $y = f(x)$ for $a \le x \le b$, with $f'$ continuous. Mark points on the curve at $x_0 = a, x_1, \dots, x_n = b$, equally spaced by $\Delta x$. The chord from the $(i-1)$-th point to the $i$-th has horizontal run $\Delta x$ and vertical rise $\Delta y_i = f(x_i) - f(x_{i-1})$, so its length is

$$\sqrt{(\Delta x)^2 + (\Delta y_i)^2} = \sqrt{1 + \left(\frac{\Delta y_i}{\Delta x}\right)^2}\;\Delta x.$$

By the Mean Value Theorem there is a point $c_i$ in the $i$-th piece with $\frac{\Delta y_i}{\Delta x} = f'(c_i)$. So the polygon of chords has total length $\sum \sqrt{1 + f'(c_i)^2}\,\Delta x$, a Riemann sum for $\sqrt{1 + f'(x)^2}$. As $n \to \infty$ the sum tends to the integral, and we **define** the length of the curve to be that limit.`,
        },
        {
          kind: "key",
          title: "Arc length",
          body: md`For $y = f(x)$ with $f'$ continuous on $[a, b]$,

$$L = \int_a^b \sqrt{1 + f'(x)^2}\,dx.$$

For a curve $x = g(y)$, $c \le y \le d$: $L = \int_c^d \sqrt{1 + g'(y)^2}\,dy$. Think of the integrand as $\sqrt{dx^2 + dy^2}$, the length of an infinitesimal chord.`,
        },
        {
          kind: "proof",
          title: "The arc length formula",
          given: md`$f'$ is continuous on $[a, b]$; $L$ is the limit of the lengths of the inscribed polygons as $\Delta x \to 0$`,
          prove: md`$L = \int_a^b \sqrt{1 + f'(x)^2}\,dx$`,
          steps: [
            { statement: md`Chord $i$ has length $\sqrt{(\Delta x)^2 + \left(f(x_i) - f(x_{i-1})\right)^2}$`, reason: "Distance formula (Pythagorean theorem)" },
            { statement: md`$f(x_i) - f(x_{i-1}) = f'(c_i)\,\Delta x$ for some $c_i$ in $(x_{i-1}, x_i)$`, reason: md`Mean Value Theorem; $f$ is differentiable` },
            { statement: md`Chord $i$ has length $\sqrt{1 + f'(c_i)^2}\;\Delta x$`, reason: md`Substitute, factor $(\Delta x)^2$ out of the root; $\Delta x > 0$` },
            { statement: md`Polygon length $= \sum_{i=1}^{n} \sqrt{1 + f'(c_i)^2}\,\Delta x$`, reason: "Add the chords" },
            { statement: md`$\lim_{n \to \infty} \sum_{i=1}^{n} \sqrt{1 + f'(c_i)^2}\,\Delta x = \int_a^b \sqrt{1 + f'(x)^2}\,dx$`, reason: md`It is a Riemann sum with sample points $c_i$, and $\sqrt{1 + f'(x)^2}$ is continuous, so every choice of sample points gives the same limit` },
          ],
        },
        {
          kind: "text",
          body: md`The square root makes most arc length integrals impossible in closed form; even a parabola leads to functions you haven't met yet. Textbook curves are chosen so that $1 + f'(x)^2$ is a perfect square or a simple power. Two reliable families:

- $y = x^{3/2}$ and relatives, where $1 + f'^2$ is linear in $x$ and a substitution finishes it.
- Functions like $y = \frac{x^3}{6} + \frac{1}{2x}$, where $f' = \frac12\left(x^2 - x^{-2}\right)$ and $1 + f'^2 = \frac14\left(x^2 + x^{-2}\right)^2$: adding 1 turns the cross term $-\frac12$ into $+\frac12$. The catenary $y = \cosh x$ works for the same reason: $1 + \sinh^2 x = \cosh^2 x$.`,
        },
        {
          kind: "example",
          title: "A power curve",
          problem: md`Find the length of $y = x^{3/2}$ from $x = 0$ to $x = 4$.`,
          steps: [
            { math: md`f'(x) = \frac32 x^{1/2}, \qquad 1 + f'(x)^2 = 1 + \frac94 x`, note: "" },
            { math: md`L = \int_0^4 \sqrt{1 + \tfrac94 x}\,dx`, note: "" },
            { math: md`u = 1 + \tfrac94 x, \quad du = \tfrac94\,dx: \qquad L = \frac49\int_1^{10} u^{1/2}\,du = \frac49 \cdot \frac23\left[u^{3/2}\right]_1^{10}`, note: md`When $x = 0$, $u = 1$; when $x = 4$, $u = 10$.` },
            { math: md`= \frac{8}{27}\left(10\sqrt{10} - 1\right)`, note: md`About $9.07$. The straight line from $(0, 0)$ to $(4, 8)$ has length $\sqrt{80} \approx 8.94$, so the answer is plausible: a little longer than the chord.` },
          ],
        },
        {
          kind: "example",
          title: "A perfect square",
          problem: md`Find the length of $y = \frac{x^3}{6} + \frac{1}{2x}$ from $x = 1$ to $x = 2$.`,
          steps: [
            { math: md`f'(x) = \frac{x^2}{2} - \frac{1}{2x^2}`, note: "" },
            { math: md`f'(x)^2 = \frac{x^4}{4} - \frac12 + \frac{1}{4x^4}, \qquad 1 + f'(x)^2 = \frac{x^4}{4} + \frac12 + \frac{1}{4x^4} = \left(\frac{x^2}{2} + \frac{1}{2x^2}\right)^2`, note: md`Adding 1 turns $-\frac12$ into $+\frac12$, and the result is the square of the same two terms with a plus sign.` },
            { math: md`L = \int_1^2 \left(\frac{x^2}{2} + \frac{1}{2x^2}\right) dx = \left[\frac{x^3}{6} - \frac{1}{2x}\right]_1^2`, note: md`The root of a square is the absolute value; both terms are positive for $x > 0$.` },
            { math: md`= \left(\frac86 - \frac14\right) - \left(\frac16 - \frac12\right) = \frac{17}{12}`, note: "" },
          ],
        },
        {
          kind: "why",
          title: "Why the catenary's length is sinh",
          body: md`For $y = \cosh x = \frac{e^x + e^{-x}}{2}$ the derivative is $\sinh x = \frac{e^x - e^{-x}}{2}$. Squaring, $\sinh^2 x = \frac{e^{2x} - 2 + e^{-2x}}{4}$ and $\cosh^2 x = \frac{e^{2x} + 2 + e^{-2x}}{4}$, so $\cosh^2 x - \sinh^2 x = 1$. That is exactly the identity the arc length formula wants: $\sqrt{1 + \sinh^2 x} = \cosh x$, and

$$L = \int_0^b \cosh x\,dx = \sinh b.$$

The length of the catenary from $0$ to $b$ equals the slope of the curve at $b$. For $b = \ln 2$: $\sinh(\ln 2) = \frac{2 - \frac12}{2} = \frac34$.`,
        },
        {
          kind: "plot",
          x: [-2.5, 2.5],
          y: [-0.5, 4],
          curves: [{ expr: "cosh(x)", label: "y = \\cosh x", color: 1 }],
          vlines: [{ x: "b" }],
          points: [{ x: "b", y: "cosh(b)", label: "L = {=sinh(b)}", color: 2 }],
          params: [{ name: "b", tex: "b", min: 0, max: 2, step: 0.1, value: 1 }],
          caption: md`The catenary $y = \cosh x$, the shape of a hanging chain. The label shows the length of the arc from $x = 0$ to $x = b$, which is $\sinh b$.`,
        },
        {
          kind: "check",
          prompt: md`Find the length of $y = \frac23(x^2 + 1)^{3/2}$ from $x = 0$ to $x = 1$. Give an exact answer, like 7/3.`,
          answer: "5/3",
          simplified: true,
          explain: md`$f' = 2x\sqrt{x^2 + 1}$, so $1 + f'^2 = 1 + 4x^4 + 4x^2 = (2x^2 + 1)^2$. $L = \int_0^1 (2x^2 + 1)\,dx = \frac23 + 1 = \frac53$.`,
        },
        {
          kind: "check",
          prompt: md`Find the length of $y = \cosh x$ from $x = 0$ to $x = \ln 3$. Give an exact answer, like 3/4.`,
          answer: "4/3",
          simplified: true,
          explain: md`$L = \sinh(\ln 3) = \frac{e^{\ln 3} - e^{-\ln 3}}{2} = \frac{3 - \frac13}{2} = \frac43$.`,
        },
      ],
      practice: [arcLength, arcPerfectSquare, arcIntegrand],
    },
    {
      id: slug("Work and other physics"),
      title: "Work and other physics",
      summary: "Work is force times distance when the force is constant; when it varies, add up small pieces and integrate. Springs, pumping, and centers of mass.",
      blocks: [
        {
          kind: "text",
          body: md`In physics, **work** measures the effect of a force acting through a distance. Push with a constant force $F$ over a distance $d$ in the direction of the force and you do work $W = Fd$. Newtons times meters are **joules** (J). The trouble starts when the force changes as you go. A spring pushes back harder the farther you stretch it; the water left in a tank gets lighter as you pump it. Then $Fd$ is meaningless, because there is no single $F$.`,
        },
        {
          kind: "why",
          title: "Why work is an integral",
          body: md`Suppose an object moves from $x = a$ to $x = b$ under a force $F(x)$ that depends on position and is continuous. Cut $[a, b]$ into $n$ small pieces of width $\Delta x$. On the $i$-th piece the force barely changes, so the work done there is about $F(x_i)\,\Delta x$, with $x_i$ any point in the piece. Adding up,

$$W \approx \sum_{i=1}^{n} F(x_i)\,\Delta x \quad\longrightarrow\quad W = \int_a^b F(x)\,dx.$$

The error on a piece is at most (how much $F$ varies on that piece) times $\Delta x$, which vanishes in the limit because $F$ is continuous. Work is the area under the force graph.`,
        },
        {
          kind: "key",
          title: "Work",
          body: md`$$W = \int_a^b F(x)\,dx$$

for a force $F(x)$ acting along the $x$-axis as the object moves from $a$ to $b$. A constant force gives back $W = F(b - a) = Fd$.`,
        },
        {
          kind: "text",
          body: md`**Hooke's law** says the force needed to hold a spring stretched (or compressed) $x$ beyond its natural length is proportional to $x$: $F(x) = kx$. The constant $k$ (in N/m) is the spring's stiffness, and you find it from one measurement. Hooke's law is an experimental fact, accurate for small stretches, not a theorem. Everything after it is.`,
        },
        {
          kind: "plot",
          x: [-0.1, 1.2],
          y: [-5, 70],
          curves: [{ expr: "k x", label: "F = kx", color: 1 }],
          shade: [{ expr: "k x", from: "a", to: "b" }],
          vlines: [{ x: "a" }, { x: "b" }],
          params: [
            { name: "k", tex: "k", min: 20, max: 60, step: 5, value: 40 },
            { name: "a", tex: "a", min: 0, max: 0.5, step: 0.05, value: 0.2 },
            { name: "b", tex: "b", min: 0.5, max: 1, step: 0.05, value: 0.5 },
          ],
          caption: md`Hooke's law as a graph. The work to stretch the spring from $a$ to $b$ is the shaded area under the force line, $\int_a^b kx\,dx = \frac{k}{2}(b^2 - a^2)$: a trapezoid, since the force is linear.`,
        },
        {
          kind: "example",
          title: "Stretching a spring",
          problem: md`A force of 12 N holds a spring stretched 0.2 m beyond its natural length. How much work is done stretching it from 0.2 m to 0.5 m beyond natural length?`,
          steps: [
            { math: md`k = \frac{12}{0.2} = 60 \text{ N/m}`, note: md`One measurement fixes $k$.` },
            { math: md`W = \int_{0.2}^{0.5} 60x\,dx = \left[30x^2\right]_{0.2}^{0.5}`, note: md`The force at stretch $x$ is $60x$. Measure $x$ from the natural length, not from where the stretch starts.` },
            { math: md`= 30(0.25 - 0.04) = 6.3 \text{ J}`, note: "" },
          ],
        },
        {
          kind: "why",
          title: "Why pumping is a sum of slabs",
          body: md`To empty a tank, you lift water. Different layers travel different distances: water near the top barely moves, water at the bottom goes all the way up. So slice the water into thin horizontal slabs. The slab at height $y$ (measured up from the bottom) with thickness $dy$ has volume $A(y)\,dy$, where $A(y)$ is the tank's cross-sectional area there. Its weight is $\rho g\,A(y)\,dy$, with $\rho g$ the weight density (about $9800$ $\text{N/m}^3$ for water), and it must rise a distance $H - y$ to reach the outlet at height $H$. Lifting at a steady speed takes a force equal to the weight, so the work on that slab is

$$dW = \rho g\,A(y)\,(H - y)\,dy, \qquad W = \int_0^{h} \rho g\,A(y)\,(H - y)\,dy,$$

integrating over the water, from depth $0$ to $h$. Here the "force" is a slab's weight and the "distance" is how far it rises. The variable of integration is where the water starts, not where the pump is.`,
        },
        {
          kind: "diagram",
          view: [-4, 4.5, -0.5, 6.5],
          params: [{ name: "y", tex: "y", min: 0, max: 4.6, step: 0.2, value: 1.6 }],
          points: [
            { name: "T1", x: -2, y: 0, label: "", hidden: true },
            { name: "T2", x: 2, y: 0, label: "", hidden: true },
            { name: "T3", x: 2, y: 5, label: "", hidden: true },
            { name: "T4", x: -2, y: 5, label: "", hidden: true },
            { name: "S1", x: -2, y: "y", label: "", hidden: true },
            { name: "S2", x: 2, y: "y", label: "", hidden: true },
            { name: "S3", x: 2, y: "y + 0.4", label: "", hidden: true },
            { name: "S4", x: -2, y: "y + 0.4", label: "", hidden: true },
            { name: "P", x: 0, y: "y + 0.4", label: "", hidden: true },
            { name: "Q", x: 0, y: 5.8, label: "", hidden: true },
            { name: "R1", x: 2.6, y: 0, label: "", hidden: true },
            { name: "R2", x: 2.6, y: "y", label: "", hidden: true },
          ],
          segments: [
            { from: "T1", to: "T2" },
            { from: "T2", to: "T3" },
            { from: "T4", to: "T1" },
            { from: "T4", to: "T3", dashed: true, color: 1 },
            { from: "P", to: "Q", arrow: true, color: 2, label: "{=5 - y}" },
            { from: "R1", to: "R2", color: 3, label: "y" },
          ],
          polygons: [{ points: ["S1", "S2", "S3", "S4"], fill: 1 }],
          labels: [{ x: -3.1, y: 2.5, text: "h = 5" }],
          readouts: [
            { label: "\\text{slab weight (thickness } 0.4\\text{ m)}", value: "9800*pi*4*0.4", unit: "\\text{ N}" },
            { label: "\\text{lift}", value: "5 - y", unit: "\\text{ m}" },
            { label: "\\text{work on this slab}", value: "9800*pi*4*0.4*(5 - y)", unit: "\\text{ J}" },
          ],
          caption: md`A cylindrical tank of radius 2 m and height 5 m, seen from the side. Slide the slab up and down: its weight never changes, but the distance it must rise does. Adding the work over all slabs is the integral.`,
        },
        {
          kind: "example",
          title: "Emptying a cylinder",
          problem: md`A cylindrical tank of radius 2 m and height 5 m is full of water. Find the work to pump all of it out over the top.`,
          steps: [
            { math: md`A(y) = \pi \cdot 2^2 = 4\pi, \qquad \text{weight of slab} = 9800 \cdot 4\pi\,dy`, note: "" },
            { math: md`\text{lift} = 5 - y`, note: md`The slab at height $y$ rises to the rim at height 5.` },
            { math: md`W = \int_0^5 9800 \cdot 4\pi\,(5 - y)\,dy = 39200\pi\left[5y - \frac{y^2}{2}\right]_0^5`, note: "" },
            { math: md`= 39200\pi \cdot \frac{25}{2} = 490000\pi \approx 1.54 \times 10^6 \text{ J}`, note: md`The same as lifting the tank's whole weight, $9800 \cdot 20\pi$ N, through $2.5$ m: the distance the water's center of mass travels. That is no accident; see below.` },
          ],
        },
        {
          kind: "example",
          title: "An inverted cone",
          problem: md`A tank is an inverted cone, vertex down, 6 m tall with top radius 3 m, and it is full of water. Find the work to pump the water out over the top.`,
          steps: [
            { math: md`\frac{r}{y} = \frac{3}{6} \;\Rightarrow\; r = \frac{y}{2}, \qquad A(y) = \frac{\pi y^2}{4}`, note: md`Similar triangles: the slab at height $y$ above the vertex has radius proportional to $y$.` },
            { math: md`W = \int_0^6 9800 \cdot \frac{\pi y^2}{4}(6 - y)\,dy = 2450\pi\int_0^6 (6y^2 - y^3)\,dy`, note: "" },
            { math: md`= 2450\pi\left[2y^3 - \frac{y^4}{4}\right]_0^6 = 2450\pi(432 - 324) = 264600\pi \text{ J}`, note: "" },
          ],
        },
        {
          kind: "key",
          title: "Center of mass",
          body: md`For a flat plate of uniform density covering the region between $y = f(x)$ (top) and $y = g(x)$ (bottom), $a \le x \le b$, with area $A$, the **centroid** $(\bar{x}, \bar{y})$ is

$$\bar{x} = \frac{1}{A}\int_a^b x\left[f(x) - g(x)\right] dx, \qquad \bar{y} = \frac{1}{A}\int_a^b \frac12\left[f(x)^2 - g(x)^2\right] dx.$$

The plate balances on a pin at the centroid. The integrals are **moments**: each strip's area times its distance from an axis.`,
        },
        {
          kind: "why",
          title: "Why these are the balance point",
          body: md`A see-saw balances when the weights times their signed distances from the pivot add to zero: $\sum m_i(x_i - \bar{x}) = 0$, so $\bar{x} = \frac{\sum m_i x_i}{\sum m_i}$. For a plate, the strip at $x$ is a thin mass of area $\left[f(x) - g(x)\right] dx$ at horizontal position $x$. Replace the sums by integrals: $\bar{x} = \frac{\int x\,[f - g]\,dx}{\int [f - g]\,dx}$, and the denominator is $A$.

For $\bar{y}$, the strip's own center is halfway up, at height $\frac{f + g}{2}$, so its moment about the $x$-axis is $\frac{f + g}{2}(f - g)\,dx = \frac12\left(f^2 - g^2\right) dx$. Dividing by $A$ gives $\bar{y}$.`,
        },
        {
          kind: "proof",
          title: "The plate balances at x̄",
          given: md`$\bar{x} = \frac{1}{A}\int_a^b x\,h(x)\,dx$, where $h = f - g$ and $A = \int_a^b h(x)\,dx$`,
          prove: md`The total moment about the line $x = \bar{x}$ is zero: $\int_a^b (x - \bar{x})\,h(x)\,dx = 0$`,
          steps: [
            { statement: md`$\int_a^b (x - \bar{x})\,h(x)\,dx = \int_a^b x\,h(x)\,dx - \bar{x}\int_a^b h(x)\,dx$`, reason: md`Linearity of the integral; $\bar{x}$ is a constant` },
            { statement: md`$= \int_a^b x\,h(x)\,dx - \bar{x}A$`, reason: md`Definition of $A$` },
            { statement: md`$= \int_a^b x\,h(x)\,dx - \int_a^b x\,h(x)\,dx = 0$`, reason: md`Definition of $\bar{x}$: $\bar{x}A = \int_a^b x\,h(x)\,dx$` },
          ],
        },
        {
          kind: "example",
          title: "Centroid of a parabolic plate",
          problem: md`Find the centroid of the region under $y = x^2$ from $x = 0$ to $x = 1$.`,
          steps: [
            { math: md`A = \int_0^1 x^2\,dx = \frac13`, note: "" },
            { math: md`\bar{x} = 3\int_0^1 x \cdot x^2\,dx = 3 \cdot \frac14 = \frac34`, note: md`Most of the area is on the right, where the curve is tall, so $\bar{x} > \frac12$ makes sense.` },
            { math: md`\bar{y} = 3\int_0^1 \frac12 (x^2)^2\,dx = \frac32 \cdot \frac15 = \frac{3}{10}`, note: "The region is thin near the axis, so the centroid sits low." },
          ],
        },
        {
          kind: "check",
          prompt: md`A force of 20 N holds a spring stretched 0.5 m beyond its natural length. How much work is done stretching it from 0 to 0.5 m? Give the answer in joules, as a number like 6.3.`,
          answer: "5",
          explain: md`$k = 20/0.5 = 40$ N/m, so $W = \int_0^{0.5} 40x\,dx = 20(0.5)^2 = 5$ J.`,
        },
        {
          kind: "check",
          prompt: md`Find the centroid of the region under $y = 2x$ from $x = 0$ to $x = 3$. Give it as $(\bar{x}, \bar{y})$, like (3/2, 1).`,
          answer: "(2, 2)",
          form: "tuple",
          explain: md`$A = 9$. $\bar{x} = \frac19\int_0^3 2x^2\,dx = \frac{18}{9} = 2$ and $\bar{y} = \frac19\int_0^3 \frac12(2x)^2\,dx = \frac{18}{9} = 2$. A triangle's centroid is two thirds of the way from each vertex to the opposite side.`,
        },
      ],
      practice: [springWork, pumpingWork, centroid],
    },
  ],
};
