import { frac, fracTex, gcd, poly, type Rng } from "../../math/random";
import { md, slug, type Block, type Figure, type Generator, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

/** An exact fraction n/d, always reduced, denominator positive. */
interface F {
  n: number;
  d: number;
}
const F = (n: number, d = 1): F => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const add = (a: F, b: F): F => F(a.n * b.d + b.n * a.d, a.d * b.d);
const mul = (a: F, b: F): F => F(a.n * b.n, a.d * b.d);
const ftext = (f: F) => frac(f.n, f.d);
const ftex = (f: F) => fracTex(f.n, f.d);
const fval = (f: F) => f.n / f.d;
/** ∫_a^b x^n dx, exactly. */
const powInt = (n: number, a: number, b: number): F => F(b ** (n + 1) - a ** (n + 1), n + 1);

/** k·pi as typed text and LaTeX: 8pi, pi/2, 3pi/4; 0 stays 0. */
function piOf(f: F): { text: string; tex: string } {
  if (f.n === 0) return { text: "0", tex: "0" };
  const num = Math.abs(f.n) === 1 ? "" : String(Math.abs(f.n));
  const sign = f.n < 0 ? "-" : "";
  if (f.d === 1) return { text: `${sign}${num}pi`, tex: `${sign}${num}\\pi` };
  return { text: `${sign}${num}pi/${f.d}`, tex: `${sign}\\frac{${num}\\pi}{${f.d}}` };
}

/** x^n in LaTeX / typed text, with x^1 as x and x^0 dropped. */
const pw = (v: string, n: number) => (n === 0 ? "" : n === 1 ? v : `${v}^{${n}}`);
const pwText = (v: string, n: number) => (n === 0 ? "" : n === 1 ? v : `${v}^${n}`);
/** A monomial in several variables: [["x", 2], ["y", 1]] -> x^{2}y and "x^2 y". */
const byName = (vars: [string, number][]) => [...vars].sort((a, b) => a[0].localeCompare(b[0]));
const monoTex = (vars: [string, number][]) => byName(vars).map(([v, n]) => pw(v, n)).join("");
// No spaces: the checker reads "x y" as words, not algebra.
const monoText = (vars: [string, number][]) => byName(vars).map(([v, n]) => pwText(v, n)).join("");

/** A sum of terms with fraction coefficients, written the way a person would. Each term is [coef, monoTex, monoText]. */
function fsum(terms: [F, string, string][]): { tex: string; text: string } {
  let tex = "";
  let text = "";
  for (const [c, mt, mx] of terms) {
    if (c.n === 0) continue;
    const an = Math.abs(c.n);
    const magTex = c.d === 1 ? (an === 1 && mt ? mt : `${an}${mt}`) : `\\frac{${an}}{${c.d}}${mt}`;
    const magText = c.d === 1 ? (an === 1 && mx ? mx : `${an}${mx ? " " + mx : ""}`) : mx ? `(${an}/${c.d})${mx}` : `${an}/${c.d}`;
    if (!tex) {
      tex = c.n < 0 ? `-${magTex}` : magTex;
      text = c.n < 0 ? `-${magText}` : magText;
    } else {
      tex += c.n < 0 ? ` - ${magTex}` : ` + ${magTex}`;
      text += c.n < 0 ? ` - ${magText}` : ` + ${magText}`;
    }
  }
  return { tex: tex || "0", text: text || "0" };
}

/** Integer-coefficient sum of monomials, in LaTeX. */
const isum = (terms: [number, string][]) => poly(terms);

/** A number in parentheses when negative. */
const par = (n: number) => (n < 0 ? `(${n})` : String(n));

/** Shuffle a copy of an array with the seeded rng. */
function shuffle<T>(r: Rng, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Hidden points along y = f(x) for drawing a curved boundary as a polygon edge. */
function curvePts(prefix: string, f: (x: number) => number, x0: number, x1: number, n: number) {
  const names: string[] = [];
  const points = Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n;
    const name = `${prefix}${i}`;
    names.push(name);
    return { name, x: Number(x.toFixed(4)), y: Number(f(x).toFixed(4)), hidden: true as const, label: "" };
  });
  return { names, points };
}

// ── Lesson 1 generators: double integrals ───────────────────────────────────

/** The inner integral of an iterated integral over a rectangle: an expression in the other variable. */
const innerIntegral: Generator = (r) => {
  const inY = r.next() < 0.6;
  const [v, w] = inY ? ["y", "x"] : ["x", "y"];
  const lo = r.int(0, 1);
  const hi = lo + r.int(1, 2);
  // Terms c * w^m * v^n, distinct monomials.
  const t1 = { c: r.coef(-6, 6), m: r.int(1, 2), n: r.int(1, 2) };
  let t2 = { c: r.nonzero(-5, 5), m: r.int(0, 2), n: r.int(0, 1) };
  while (t2.m === t1.m && t2.n === t1.n) t2 = { ...t2, m: r.int(0, 2), n: r.int(0, 1) };
  const terms = [t1, t2];
  const integrand = isum(terms.map((t) => [t.c, monoTex([[w, t.m], [v, t.n]])] as [number, string]));
  const anti = fsum(terms.map((t) => [F(t.c, t.n + 1), monoTex([[w, t.m], [v, t.n + 1]]), ""] as [F, string, string]));
  // Collect by power of w.
  const byPower = new Map<number, F>();
  for (const t of terms) byPower.set(t.m, add(byPower.get(t.m) ?? F(0), mul(F(t.c), powInt(t.n, lo, hi))));
  const result = fsum([...byPower.entries()].sort((a, b) => b[0] - a[0]).map(([m, c]) => [c, pw(w, m), pwText(w, m)] as [F, string, string]));
  return {
    prompt: md`Evaluate the inner integral $\int_{${lo}}^{${hi}} (${integrand}) \, d${v}$ of an iterated integral, treating $${w}$ as a constant. Give your answer as an expression in $${w}$.`,
    answer: result.text,
    simplified: true,
    hint: md`Only $${v}$ varies. Everything with $${w}$ in it is a constant coefficient, so integrate each term in $${v}$ with the power rule and keep the $${w}$ factors as they are.`,
    solution: [
      { math: `\\left[${anti.tex}\\right]_{${v} = ${lo}}^{${v} = ${hi}}`, note: md`Antidifferentiate in $${v}$; $${w}$ rides along as a constant.` },
      { math: terms.map((t) => `${t.c < 0 ? "-" : "+"} ${Math.abs(t.c)}${pw(w, t.m)} \\cdot ${ftex(powInt(t.n, lo, hi))}`).join(" ").replace(/^\+ /, ""), note: md`Substitute $${v} = ${hi}$ and $${v} = ${lo}$: each $\int_{${lo}}^{${hi}} ${v}^n \, d${v}$ is just a number.` },
      { math: result.tex, note: md`Collect like powers of $${w}$. This is the function of $${w}$ the outer integral will integrate.` },
    ],
  };
};

/** An iterated integral over a rectangle, exact. */
const rectangleIntegral: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const x0 = r.int(0, 1);
    const x1 = x0 + r.int(1, 2);
    const y0 = r.int(0, 1);
    const y1 = y0 + r.int(1, 2);
    const t1 = { c: r.coef(-6, 6), m: r.int(0, 2), n: r.int(1, 2) };
    let t2 = { c: r.nonzero(-4, 4), m: r.int(0, 2), n: r.int(0, 1) };
    while (t2.m === t1.m && t2.n === t1.n) t2 = { ...t2, m: r.int(0, 2), n: r.int(0, 1) };
    const terms = [t1, t2];
    const integrand = isum(terms.map((t) => [t.c, monoTex([["x", t.m], ["y", t.n]])] as [number, string]));
    const byPower = new Map<number, F>();
    for (const t of terms) byPower.set(t.m, add(byPower.get(t.m) ?? F(0), mul(F(t.c), powInt(t.n, y0, y1))));
    const inner = fsum([...byPower.entries()].sort((a, b) => b[0] - a[0]).map(([m, c]) => [c, pw("x", m), pwText("x", m)] as [F, string, string]));
    let total = F(0);
    for (const [m, c] of byPower) total = add(total, mul(c, powInt(m, x0, x1)));
    return {
      prompt: md`Work out $\int_{${x0}}^{${x1}} \int_{${y0}}^{${y1}} (${integrand}) \, dy \, dx$. Give the exact value, as a fraction if needed.`,
      answer: ftext(total),
      simplified: true,
      hint: md`Inside out. First integrate in $y$ from $${y0}$ to $${y1}$ with $x$ held constant; that leaves a function of $x$ alone. Then integrate it from $${x0}$ to $${x1}$.`,
      solution: [
        { math: `\\int_{${y0}}^{${y1}} (${integrand}) \\, dy = ${inner.tex}`, note: md`The inner integral, with $x$ a constant. Each $y^n$ becomes the number $\int_{${y0}}^{${y1}} y^n \, dy$.` },
        { math: `\\int_{${x0}}^{${x1}} \\left(${inner.tex}\\right) dx = ${ftex(total)}`, note: "The outer integral is an ordinary Calculus 1 integral." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 3);
    const b = r.int(1, 2);
    const half = F(a * a, 2);
    const eb = b === 1 ? "e" : `e^${b}`;
    const ebTex = b === 1 ? "e" : `e^{${b}}`;
    return {
      prompt: md`Work out $\int_{0}^{${a}} \int_{0}^{${b}} x e^{y} \, dy \, dx$. Give the exact value, in terms of $e$.`,
      answer: half.d === 1 ? `${half.n}(${eb} - 1)` : `(${ftext(half)})(${eb} - 1)`,
      hint: md`The integrand is a product $x \cdot e^y$, so the inner integral in $y$ is $x$ times $\int_0^{${b}} e^y \, dy$.`,
      solution: [
        { math: `\\int_{0}^{${b}} x e^{y} \\, dy = x\\left[e^{y}\\right]_0^{${b}} = x(${ebTex} - 1)`, note: md`$x$ is a constant inside.` },
        { math: `\\int_{0}^{${a}} x(${ebTex} - 1) \\, dx = (${ebTex} - 1)\\left[\\frac{x^2}{2}\\right]_0^{${a}} = ${ftex(half)}(${ebTex} - 1)`, note: md`A product $f(x)g(y)$ over a rectangle always factors into two single integrals.` },
      ],
    };
  }
  if (kind === 2) {
    const b = r.int(1, 3);
    return {
      prompt: md`Work out $\int_{0}^{${b}} \int_{0}^{\pi} y \sin(x) \, dx \, dy$. Give the exact value.`,
      answer: String(b * b),
      hint: md`Inner integral in $x$ first: $y$ is a constant there, and $\int_0^{\pi} \sin x \, dx = 2$.`,
      solution: [
        { math: `\\int_{0}^{\\pi} y \\sin(x) \\, dx = y\\left[-\\cos x\\right]_0^{\\pi} = 2y`, note: md`$-\cos\pi + \cos 0 = 1 + 1 = 2$.` },
        { math: `\\int_{0}^{${b}} 2y \\, dy = \\left[y^2\\right]_0^{${b}} = ${b * b}`, note: "" },
      ],
    };
  }
  if (kind === 3) {
    const a = r.int(1, 4);
    const half = F(a * a, 2);
    return {
      prompt: md`Work out $\int_{0}^{${a}} \int_{0}^{\pi/2} x \cos(y) \, dy \, dx$. Give the exact value.`,
      answer: ftext(half),
      hint: md`$\int_0^{\pi/2} \cos y \, dy = 1$, and $x$ waits outside that inner integral.`,
      solution: [
        { math: `\\int_{0}^{\\pi/2} x \\cos(y) \\, dy = x\\left[\\sin y\\right]_0^{\\pi/2} = x`, note: "" },
        { math: `\\int_{0}^{${a}} x \\, dx = ${ftex(half)}`, note: "" },
      ],
    };
  }
  const a = r.int(1, 4);
  const half = F(a * a, 2);
  return {
    prompt: md`Work out $\int_{0}^{${a}} \int_{0}^{1} \frac{x}{1 + y} \, dy \, dx$. Give the exact value, using ln.`,
    answer: half.d === 1 ? `${half.n === 1 ? "" : half.n}ln(2)` : `(${ftext(half)})ln(2)`,
    hint: md`$\frac{x}{1 + y} = x \cdot \frac{1}{1 + y}$. The inner integral gives $x \ln 2$.`,
    solution: [
      { math: `\\int_{0}^{1} \\frac{x}{1 + y} \\, dy = x\\left[\\ln(1 + y)\\right]_0^{1} = x \\ln 2`, note: "" },
      { math: `\\int_{0}^{${a}} x \\ln 2 \\, dx = \\ln 2 \\cdot \\frac{${a}^2}{2} = ${ftex(half)}\\ln 2`, note: "" },
    ],
  };
};

/** The region between y = x^2 and y = kx, as a shaded diagram. */
function parabolaRegion(k: number): Figure {
  const curve = curvePts("P", (x) => x * x, 0, k, 12);
  return {
    kind: "diagram",
    view: [-0.5, k + 0.8, -0.5, k * k + 0.8],
    grid: true,
    points: [...curve.points, { name: "O", x: 0, y: 0, label: "" }, { name: "T", x: k, y: k * k, label: `(${k}, ${k * k})`, dir: "e" }],
    polygons: [{ points: curve.names, fill: 1 }],
    segments: [{ from: "O", to: "T", color: 2, label: `y = ${k === 1 ? "" : k}x` }],
    labels: [{ x: k * 0.85, y: k * k * 0.55, text: "y = x^2" }],
  };
}

/** The triangle 0 <= x <= y <= a, for reversing the order of integration. */
function triangleRegion(a: number): Figure {
  return {
    kind: "diagram",
    view: [-0.5, a + 0.8, -0.5, a + 0.8],
    grid: true,
    points: [
      { name: "O", x: 0, y: 0, label: "" },
      { name: "A", x: a, y: a, label: `(${a}, ${a})`, dir: "e" },
      { name: "B", x: 0, y: a, label: `(0, ${a})`, dir: "w" },
    ],
    polygons: [{ points: ["O", "A", "B"], fill: 1 }],
    segments: [{ from: "O", to: "A", color: 2, label: "y = x" }],
  };
}

/** A double integral over a non-rectangular region. */
const regionIntegral: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const k = r.int(1, 3);
    const [m, n] = r.pick([[1, 0], [0, 1], [1, 1], [0, 0], [2, 0]] as [number, number][]);
    const f = monoTex([["x", m], ["y", n]]) || "1";
    // ∫_0^k ∫_{x^2}^{kx} x^m y^n dy dx
    const first = F(k ** (n + 1) * k ** (m + n + 2), (n + 1) * (m + n + 2));
    const second = F(k ** (m + 2 * n + 3), (n + 1) * (m + 2 * n + 3));
    const total = add(first, mul(F(-1), second));
    const lineTex = k === 1 ? "x" : `${k}x`;
    return {
      prompt: md`Work out $\iint_D ${f} \, dA$, where $D$ is the region bounded by $y = x^2$ and $y = ${lineTex}$. Give the exact value.`,
      answer: ftext(total),
      simplified: true,
      figure: parabolaRegion(k),
      hint: md`The curves meet where $x^2 = ${lineTex}$, at $x = 0$ and $x = ${k}$. Between them the line is on top, so a vertical strip at $x$ runs from $y = x^2$ up to $y = ${lineTex}$.`,
      solution: [
        { math: `\\iint_D ${f} \\, dA = \\int_{0}^{${k}} \\int_{x^2}^{${lineTex}} ${f} \\, dy \\, dx`, note: md`Type I region: $0 \le x \le ${k}$, $x^2 \le y \le ${lineTex}$.` },
        { math: `\\int_{x^2}^{${lineTex}} ${f} \\, dy = ${pw("x", m) || ""}\\left[\\frac{y^{${n + 1}}}{${n + 1}}\\right]_{x^2}^{${lineTex}} = \\frac{${k ** (n + 1) === 1 ? "" : k ** (n + 1)}x^{${m + n + 1}} - x^{${m + 2 * n + 2}}}{${n + 1}}`, note: md`Inner integral, $x$ constant. Substituting $y = ${lineTex}$ gives $(${lineTex})^{${n + 1}} = ${k ** (n + 1) === 1 ? "" : k ** (n + 1)}x^{${n + 1}}$; substituting $y = x^2$ gives $x^{${2 * n + 2}}$.` },
        { math: `\\frac{1}{${n + 1}}\\left[\\frac{${k ** (n + 1) === 1 ? "" : k ** (n + 1)}x^{${m + n + 2}}}{${m + n + 2}} - \\frac{x^{${m + 2 * n + 3}}}{${m + 2 * n + 3}}\\right]_0^{${k}} = ${ftex(first)} - ${ftex(second)} = ${ftex(total)}`, note: "Outer integral; the lower limit 0 contributes nothing." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 3);
    const b = r.int(1, 3);
    const [m, n] = r.pick([[1, 0], [0, 1], [1, 1], [0, 0]] as [number, number][]);
    const f = monoTex([["x", m], ["y", n]]) || "1";
    const slope = F(b, a);
    // ∫_0^a x^m ((b/a) x)^{n+1}/(n+1) dx = (b/a)^{n+1}/(n+1) * a^{m+n+2}/(m+n+2)
    const total = mul(F(b ** (n + 1), a ** (n + 1) * (n + 1)), F(a ** (m + n + 2), m + n + 2));
    const slopeTex = slope.d === 1 ? (slope.n === 1 ? "" : String(slope.n)) : ftex(slope);
    return {
      prompt: md`Work out $\iint_D ${f} \, dA$, where $D$ is the triangle with vertices $(0, 0)$, $(${a}, 0)$ and $(${a}, ${b})$. Give the exact value.`,
      answer: ftext(total),
      simplified: true,
      figure: {
        kind: "diagram",
        view: [-0.5, a + 0.8, -0.5, b + 0.8],
        grid: true,
        points: [
          { name: "O", x: 0, y: 0, label: "" },
          { name: "A", x: a, y: 0, label: `(${a}, 0)`, dir: "se" },
          { name: "B", x: a, y: b, label: `(${a}, ${b})`, dir: "ne" },
        ],
        polygons: [{ points: ["O", "A", "B"], fill: 1 }],
        segments: [{ from: "O", to: "B", color: 2, label: `y = ${slopeTex}x` }],
      },
      hint: md`The slanted side is the line $y = ${slopeTex}x$. A vertical strip at $x$ runs from $y = 0$ up to that line, for $0 \le x \le ${a}$.`,
      solution: [
        { math: `\\iint_D ${f} \\, dA = \\int_{0}^{${a}} \\int_{0}^{${slopeTex}x} ${f} \\, dy \\, dx`, note: md`Type I: the top boundary is the line through $(0, 0)$ and $(${a}, ${b})$, slope $${ftex(slope)}$.` },
        { math: `\\int_{0}^{${slopeTex}x} ${f} \\, dy = ${pw("x", m)}\\frac{(${slopeTex}x)^{${n + 1}}}{${n + 1}} = ${ftex(F(b ** (n + 1), a ** (n + 1) * (n + 1)))} x^{${m + n + 1}}`, note: "Inner integral." },
        { math: `${ftex(F(b ** (n + 1), a ** (n + 1) * (n + 1)))} \\cdot \\frac{${a}^{${m + n + 2}}}{${m + n + 2}} = ${ftex(total)}`, note: "Outer integral." },
      ],
    };
  }
  const a = r.pick([1, 2]);
  const forms = [
    { g: "e^{y^2}", gText: "e^(y^2)", anti: "\\frac{1}{2}e^{y^2}", value: a === 1 ? "(e - 1)/2" : `(e^${a * a} - 1)/2`, valueTex: `\\frac{e^{${a * a}} - 1}{2}`, why: md`$\int y e^{y^2} \, dy = \frac12 e^{y^2}$ by the substitution $u = y^2$.` },
    { g: "\\cos(y^2)", gText: "cos(y^2)", anti: "\\frac{1}{2}\\sin(y^2)", value: `sin(${a * a})/2`, valueTex: `\\frac{\\sin ${a * a}}{2}`, why: md`$\int y \cos(y^2) \, dy = \frac12 \sin(y^2)$ with $u = y^2$.` },
    { g: "\\sin(y^2)", gText: "sin(y^2)", anti: "-\\frac{1}{2}\\cos(y^2)", value: `(1 - cos(${a * a}))/2`, valueTex: `\\frac{1 - \\cos ${a * a}}{2}`, why: md`$\int y \sin(y^2) \, dy = -\frac12 \cos(y^2)$ with $u = y^2$.` },
    { g: "\\frac{1}{1 + y^2}", gText: "1/(1 + y^2)", anti: "\\frac{1}{2}\\ln(1 + y^2)", value: `ln(${1 + a * a})/2`, valueTex: `\\frac{\\ln ${1 + a * a}}{2}`, why: md`$\int \frac{y}{1 + y^2} \, dy = \frac12 \ln(1 + y^2)$ with $u = 1 + y^2$.` },
  ];
  const form = r.pick(forms);
  return {
    prompt: md`Work out $\int_{0}^{${a}} \int_{x}^{${a}} ${form.g} \, dy \, dx$ by reversing the order of integration. Give the exact value.`,
    answer: form.value,
    figure: triangleRegion(a),
    hint: md`$${form.g}$ has no elementary antiderivative in $y$, so the inner integral can't be done as written. The region is $0 \le x \le y \le ${a}$: a triangle. Describe it with horizontal strips instead: $0 \le y \le ${a}$, $0 \le x \le y$.`,
    solution: [
      { math: `\\{(x, y) : 0 \\le x \\le ${a},\\; x \\le y \\le ${a}\\} = \\{(x, y) : 0 \\le y \\le ${a},\\; 0 \\le x \\le y\\}`, note: md`Same triangle, sliced horizontally. At height $y$ the strip runs from $x = 0$ to $x = y$.` },
      { math: `\\int_{0}^{${a}} \\int_{0}^{y} ${form.g} \\, dx \\, dy = \\int_{0}^{${a}} y \\, ${form.g} \\, dy`, note: md`The inner integral is easy now: the integrand doesn't depend on $x$, so it is $${form.g}$ times the strip length $y$.` },
      { math: `\\left[${form.anti}\\right]_0^{${a}} = ${form.valueTex}`, note: form.why },
    ],
  };
};

/** The x-limits of a region between a parabola and a line, as a tuple with Vieta checks. */
const regionLimits: Generator = (r) => {
  const r1 = r.int(-3, 1);
  const r2 = r1 + r.int(1, 4);
  const k = r1 + r2;
  const m = -r1 * r2;
  const lineTex = isum([[k, "x"], [m, ""]]);
  const f = r.pick(["x", "y", "xy", "x + y", "1"]);
  return {
    prompt: md`The region $D$ lies between the parabola $y = x^2$ and the line $y = ${lineTex}$. To write $\iint_D ${f} \, dA$ as $\int_{a}^{b} \int_{x^2}^{${lineTex}} ${f} \, dy \, dx$ you need the $x$-values where the curves meet. Give $(a, b)$ with $a < b$.`,
    answer: `(${r1}, ${r2})`,
    form: "tuple",
    verify: [`a + b = ${k}`, `a b = ${-m}`],
    hint: md`The curves meet where $x^2 = ${lineTex}$. Move everything to one side and factor.`,
    solution: [
      { math: `x^2 = ${lineTex} \\;\\Rightarrow\\; ${isum([[1, "x^2"], [-k, "x"], [-m, ""]])} = 0`, note: "Set the two heights equal." },
      { math: `(x ${r1 < 0 ? "+" : "-"} ${Math.abs(r1)})(x ${r2 < 0 ? "+" : "-"} ${Math.abs(r2)}) = 0 \\;\\Rightarrow\\; x = ${r1}, \\; ${r2}`, note: md`Between the crossings the parabola is below the line (check any $x$ between them), which is why $x^2$ is the lower limit.` },
      { math: `(a, b) = (${r1}, ${r2})`, note: md`So $\iint_D ${f === "1" ? "" : f} \, dA = \int_{${r1}}^{${r2}} \int_{x^2}^{${lineTex}} ${f === "1" ? "" : f} \, dy \, dx$.` },
    ],
  };
};

// ── Lesson 2 generators: polar coordinates ──────────────────────────────────

/** Rewrite a curve in polar form, solved for r. */
const polarCurve: Generator = (r) => {
  const kind = r.int(0, 5);
  const a = r.int(1, 4);
  const items: Record<number, { curve: string; answer: string; answerTex: string; verify: string; steps: { math: string; note: string }[] }> = {
    0: {
      curve: `x^2 + y^2 = ${2 * a}x`,
      answer: `${2 * a}cos(t)`,
      answerTex: `${2 * a}\\cos\\theta`,
      verify: `(r cos(t))^2 + (r sin(t))^2 = ${2 * a} r cos(t)`,
      steps: [
        { math: `r^2 = ${2 * a} r\\cos\\theta`, note: md`$x^2 + y^2 = r^2$ and $x = r\cos\theta$.` },
        { math: `r = ${2 * a}\\cos\\theta`, note: md`Divide by $r$. (The point $r = 0$ is still on the curve: it is reached at $\theta = \pi/2$.) This is a circle of radius $${a}$ centered at $(${a}, 0)$.` },
      ],
    },
    1: {
      curve: `x^2 + y^2 = ${2 * a}y`,
      answer: `${2 * a}sin(t)`,
      answerTex: `${2 * a}\\sin\\theta`,
      verify: `(r cos(t))^2 + (r sin(t))^2 = ${2 * a} r sin(t)`,
      steps: [
        { math: `r^2 = ${2 * a} r\\sin\\theta`, note: md`$x^2 + y^2 = r^2$ and $y = r\sin\theta$.` },
        { math: `r = ${2 * a}\\sin\\theta`, note: md`Divide by $r$. A circle of radius $${a}$ centered at $(0, ${a})$.` },
      ],
    },
    2: {
      curve: `x = ${a}`,
      answer: `${a}/cos(t)`,
      answerTex: `\\frac{${a}}{\\cos\\theta} = ${a}\\sec\\theta`,
      verify: `r cos(t) = ${a}`,
      steps: [
        { math: `r\\cos\\theta = ${a}`, note: md`$x = r\cos\theta$.` },
        { math: `r = \\frac{${a}}{\\cos\\theta}`, note: md`A vertical line: as $\theta \to \pm\pi/2$, $r \to \infty$ along it.` },
      ],
    },
    3: {
      curve: `y = ${a}`,
      answer: `${a}/sin(t)`,
      answerTex: `\\frac{${a}}{\\sin\\theta} = ${a}\\csc\\theta`,
      verify: `r sin(t) = ${a}`,
      steps: [
        { math: `r\\sin\\theta = ${a}`, note: md`$y = r\sin\theta$.` },
        { math: `r = \\frac{${a}}{\\sin\\theta}`, note: "A horizontal line." },
      ],
    },
    4: {
      curve: `x + y = ${a}`,
      answer: `${a}/(cos(t) + sin(t))`,
      answerTex: `\\frac{${a}}{\\cos\\theta + \\sin\\theta}`,
      verify: `r cos(t) + r sin(t) = ${a}`,
      steps: [
        { math: `r\\cos\\theta + r\\sin\\theta = ${a}`, note: "Substitute both coordinates." },
        { math: `r = \\frac{${a}}{\\cos\\theta + \\sin\\theta}`, note: md`Factor out $r$ and divide.` },
      ],
    },
    5: {
      curve: `y = ${a === 1 ? "" : a}x^2`,
      answer: `sin(t)/(${a === 1 ? "" : a}(cos(t))^2)`,
      answerTex: `\\frac{\\sin\\theta}{${a === 1 ? "" : a}\\cos^2\\theta}`,
      verify: `r sin(t) = ${a}(r cos(t))^2`,
      steps: [
        { math: `r\\sin\\theta = ${a === 1 ? "" : a}r^2\\cos^2\\theta`, note: "Substitute both coordinates." },
        { math: `r = \\frac{\\sin\\theta}{${a === 1 ? "" : a}\\cos^2\\theta}`, note: md`Divide by $r\cos^2\theta$. The parabola, in polar form.` },
      ],
    },
  };
  const item = items[kind]!;
  return {
    prompt: md`Write the curve $${item.curve}$ in polar coordinates, solved for $r$ as a function of $\theta$. Type theta as t, for example 4cos(t).`,
    answer: item.answer,
    verify: [item.verify],
    hint: md`Substitute $x = r\cos\theta$ and $y = r\sin\theta$ (and $x^2 + y^2 = r^2$ where it appears), then solve for $r$.`,
    solution: [...item.steps, { math: `r = ${item.answerTex}`, note: "" }],
  };
};

interface PolarRegion {
  desc: string;
  /** Angle span as a multiple of pi. */
  T: F;
  TTex: string;
  rIn: number;
  rOut: number;
}

function polarRegionOf(r: Rng): PolarRegion {
  const a = r.int(1, 3);
  const b = a + r.int(1, 2);
  const kind = r.int(0, 3);
  if (kind === 0) return { desc: md`the disk $x^2 + y^2 \le ${a * a}$`, T: F(2), TTex: "2\\pi", rIn: 0, rOut: a };
  if (kind === 1) return { desc: md`the annulus $${a * a} \le x^2 + y^2 \le ${b * b}$`, T: F(2), TTex: "2\\pi", rIn: a, rOut: b };
  if (kind === 2) return { desc: md`the half disk $x^2 + y^2 \le ${a * a}$, $y \ge 0$`, T: F(1), TTex: "\\pi", rIn: 0, rOut: a };
  return { desc: md`the quarter disk $x^2 + y^2 \le ${a * a}$ in the first quadrant`, T: F(1, 2), TTex: "\\pi/2", rIn: 0, rOut: a };
}

/** A double integral over a circular region, by polar coordinates. */
const polarIntegral: Generator = (r) => {
  const R = polarRegionOf(r);
  const quarter = R.T.d === 2;
  const half = R.T.d === 1 && R.T.n === 1;
  const options = ["r2", "sqrt", "area", "exp", ...(quarter || half ? ["y"] : []), ...(quarter ? ["x"] : [])];
  const which = r.pick(options);
  const setup = `\\int_{0}^{${R.TTex}} \\int_{${R.rIn}}^{${R.rOut}}`;
  const polarOf: Record<string, { f: string; polar: string; radialTex: string; radial: F; angleKind: "const" | "sin" | "cos" }> = {
    r2: { f: "(x^2 + y^2)", polar: "r^2 \\cdot r = r^3", radialTex: `\\left[\\frac{r^4}{4}\\right]_{${R.rIn}}^{${R.rOut}}`, radial: powInt(3, R.rIn, R.rOut), angleKind: "const" },
    sqrt: { f: "\\sqrt{x^2 + y^2}", polar: "r \\cdot r = r^2", radialTex: `\\left[\\frac{r^3}{3}\\right]_{${R.rIn}}^{${R.rOut}}`, radial: powInt(2, R.rIn, R.rOut), angleKind: "const" },
    area: { f: "1", polar: "1 \\cdot r = r", radialTex: `\\left[\\frac{r^2}{2}\\right]_{${R.rIn}}^{${R.rOut}}`, radial: powInt(1, R.rIn, R.rOut), angleKind: "const" },
    exp: { f: "e^{-(x^2 + y^2)}", polar: "e^{-r^2} r", radialTex: `\\left[-\\frac{1}{2}e^{-r^2}\\right]_{${R.rIn}}^{${R.rOut}}`, radial: F(1, 2), angleKind: "const" },
    y: { f: "y", polar: "r\\sin\\theta \\cdot r = r^2 \\sin\\theta", radialTex: `\\sin\\theta\\left[\\frac{r^3}{3}\\right]_{${R.rIn}}^{${R.rOut}}`, radial: powInt(2, R.rIn, R.rOut), angleKind: "sin" },
    x: { f: "x", polar: "r\\cos\\theta \\cdot r = r^2 \\cos\\theta", radialTex: `\\cos\\theta\\left[\\frac{r^3}{3}\\right]_{${R.rIn}}^{${R.rOut}}`, radial: powInt(2, R.rIn, R.rOut), angleKind: "cos" },
  };
  const P = polarOf[which]!;
  let answer: string;
  let answerTex: string;
  let angleNote: string;
  if (which === "exp") {
    const expPart = R.rIn === 0 ? `1 - e^(-${R.rOut * R.rOut})` : `e^(-${R.rIn * R.rIn}) - e^(-${R.rOut * R.rOut})`;
    const expTex = R.rIn === 0 ? `1 - e^{-${R.rOut * R.rOut}}` : `e^{-${R.rIn * R.rIn}} - e^{-${R.rOut * R.rOut}}`;
    const c = piOf(mul(R.T, F(1, 2)));
    answer = `${c.text}(${expPart})`;
    answerTex = `${c.tex}\\left(${expTex}\\right)`;
    angleNote = md`The integrand doesn't involve $\theta$, so the outer integral just multiplies by the angle span $${R.TTex}$.`;
  } else if (P.angleKind === "const") {
    const v = piOf(mul(R.T, P.radial));
    answer = v.text;
    answerTex = v.tex;
    angleNote = md`Nothing depends on $\theta$: the outer integral multiplies the inner result $${ftex(P.radial)}$ by the angle span $${R.TTex}$.`;
  } else {
    // ∫_0^T sin = 1 - cos T: half -> 2, quarter -> 1. ∫_0^{π/2} cos = 1.
    const angle = P.angleKind === "sin" ? (half ? 2 : 1) : 1;
    const v = mul(P.radial, F(angle));
    answer = ftext(v);
    answerTex = ftex(v);
    angleNote = P.angleKind === "sin" ? md`$\int_0^{${R.TTex}} \sin\theta \, d\theta = [-\cos\theta]_0^{${R.TTex}} = ${angle}$.` : md`$\int_0^{\pi/2} \cos\theta \, d\theta = 1$.`;
  }
  return {
    prompt: md`Work out $\iint_D ${P.f} \, dA$, where $D$ is ${R.desc}, by changing to polar coordinates. Give the exact value.`,
    answer,
    hint: md`In polar coordinates the region is $${R.rIn} \le r \le ${R.rOut}$, $0 \le \theta \le ${R.TTex}$. Replace $x = r\cos\theta$, $y = r\sin\theta$, $x^2 + y^2 = r^2$, and don't forget $dA = r \, dr \, d\theta$.`,
    solution: [
      { math: `D: \; ${R.rIn} \\le r \\le ${R.rOut}, \\quad 0 \\le \\theta \\le ${R.TTex}`, note: "A polar rectangle: constant limits in both variables." },
      { math: `${P.f} \\, dA \\to ${P.polar} \\, dr \\, d\\theta`, note: md`Convert the integrand and multiply by the extra factor $r$ from $dA = r \, dr \, d\theta$.` },
      { math: `${setup} ${P.polar.split(" = ").pop()} \\, dr \\, d\\theta = \\int_{0}^{${R.TTex}} ${P.radialTex} \\, d\\theta`, note: "Inner integral in r." },
      { math: `= ${answerTex}`, note: angleNote },
    ],
  };
};

/** A polar curve r = f(theta) as a plot figure. */
function polarPlot(rExpr: string, label: string, span: [number, number], range: number): Figure {
  return {
    kind: "plot",
    x: [-range, range],
    y: [-range, range],
    parametric: [{ x: `(${rExpr}) cos(t)`, y: `(${rExpr}) sin(t)`, t: span, label, color: 1 }],
  };
}

/** Volumes and areas by polar coordinates. */
const polarVolumeArea: Generator = (r) => {
  const kind = r.int(0, 7);
  const a = r.int(1, 3);
  const a2 = a * a;
  const a3 = a2 * a;
  const a4 = a3 * a;
  const common = (prompt: string, value: F, hint: string, steps: { math: string; note: string }[], figure?: Figure) => ({
    prompt,
    answer: piOf(value).text,
    figure,
    hint,
    solution: steps,
  });
  switch (kind) {
    case 0:
      return common(
        md`Find the volume of the solid under the paraboloid $z = ${a2} - x^2 - y^2$ and above the $xy$-plane. Give the exact value.`,
        F(a4, 2),
        md`The solid sits over the disk where $${a2} - x^2 - y^2 \ge 0$, that is $r \le ${a}$. Volume is $\iint (\text{height}) \, dA$ with height $${a2} - r^2$.`,
        [
          { math: `V = \\iint_{r \\le ${a}} (${a2} - x^2 - y^2) \\, dA = \\int_0^{2\\pi} \\int_0^{${a}} (${a2} - r^2) \\, r \\, dr \\, d\\theta`, note: md`The paraboloid meets $z = 0$ on the circle $r = ${a}$.` },
          { math: `\\int_0^{${a}} (${a2}r - r^3) \\, dr = \\frac{${a2} \\cdot ${a2}}{2} - \\frac{${a4}}{4} = ${ftex(F(a4, 4))}`, note: "" },
          { math: `V = 2\\pi \\cdot ${ftex(F(a4, 4))} = ${piOf(F(a4, 2)).tex}`, note: "" },
        ],
      );
    case 1:
      return common(
        md`Find the volume of the solid under the cone $z = ${a} - \sqrt{x^2 + y^2}$ and above the $xy$-plane. Give the exact value.`,
        F(a3, 3),
        md`In polar coordinates the cone is $z = ${a} - r$, which is positive for $r < ${a}$.`,
        [
          { math: `V = \\int_0^{2\\pi} \\int_0^{${a}} (${a} - r) \\, r \\, dr \\, d\\theta`, note: md`Height $${a} - r$ over the disk $r \le ${a}$.` },
          { math: `\\int_0^{${a}} (${a}r - r^2) \\, dr = \\frac{${a3}}{2} - \\frac{${a3}}{3} = ${ftex(F(a3, 6))}`, note: "" },
          { math: `V = 2\\pi \\cdot ${ftex(F(a3, 6))} = ${piOf(F(a3, 3)).tex}`, note: md`One third of the cylinder $\pi ${a2} \cdot ${a}$ around it, as the cone formula from Geometry says.` },
        ],
      );
    case 2:
      return common(
        md`Find the volume of the solid inside the sphere $x^2 + y^2 + z^2 = ${a2}$ and above the $xy$-plane. Give the exact value.`,
        F(2 * a3, 3),
        md`The top of the hemisphere is $z = \sqrt{${a2} - x^2 - y^2} = \sqrt{${a2} - r^2}$ over the disk $r \le ${a}$. Substitute $u = ${a2} - r^2$ in the inner integral.`,
        [
          { math: `V = \\int_0^{2\\pi} \\int_0^{${a}} \\sqrt{${a2} - r^2} \\, r \\, dr \\, d\\theta`, note: "" },
          { math: `\\int_0^{${a}} r\\sqrt{${a2} - r^2} \\, dr = \\left[-\\frac{1}{3}(${a2} - r^2)^{3/2}\\right]_0^{${a}} = \\frac{${a3}}{3}`, note: md`$u = ${a2} - r^2$, $du = -2r \, dr$.` },
          { math: `V = 2\\pi \\cdot \\frac{${a3}}{3} = ${piOf(F(2 * a3, 3)).tex}`, note: md`Half of $\frac43 \pi ${a}^3$, as it should be.` },
        ],
      );
    case 3:
      return common(
        md`Find the volume of the solid bounded by the paraboloid $z = x^2 + y^2$ and the plane $z = ${a2}$. Give the exact value.`,
        F(a4, 2),
        md`The plane is on top and the paraboloid underneath, over the disk where $x^2 + y^2 \le ${a2}$. Height is top minus bottom: $${a2} - r^2$.`,
        [
          { math: `V = \\int_0^{2\\pi} \\int_0^{${a}} (${a2} - r^2) \\, r \\, dr \\, d\\theta`, note: md`They meet where $r^2 = ${a2}$, so the shadow is the disk $r \le ${a}$.` },
          { math: `\\int_0^{${a}} (${a2}r - r^3) \\, dr = ${ftex(F(a4, 4))}`, note: "" },
          { math: `V = 2\\pi \\cdot ${ftex(F(a4, 4))} = ${piOf(F(a4, 2)).tex}`, note: "" },
        ],
      );
    case 4:
      return common(
        md`Find the area enclosed by the cardioid $r = ${a}(1 + \cos\theta)$. Give the exact value.`,
        F(3 * a2, 2),
        md`Area is $\iint_D 1 \, dA = \int_0^{2\pi} \int_0^{${a}(1 + \cos\theta)} r \, dr \, d\theta$. You will need $\cos^2\theta = \frac{1 + \cos 2\theta}{2}$.`,
        [
          { math: `A = \\int_0^{2\\pi} \\int_0^{${a}(1 + \\cos\\theta)} r \\, dr \\, d\\theta = \\int_0^{2\\pi} \\frac{${a2}(1 + \\cos\\theta)^2}{2} \\, d\\theta`, note: "Inner integral in r." },
          { math: `= \\frac{${a2}}{2} \\int_0^{2\\pi} \\left(1 + 2\\cos\\theta + \\frac{1 + \\cos 2\\theta}{2}\\right) d\\theta`, note: md`Expand and use the half-angle identity for $\cos^2\theta$.` },
          { math: `= \\frac{${a2}}{2} \\cdot 3\\pi = ${piOf(F(3 * a2, 2)).tex}`, note: md`$\cos\theta$ and $\cos 2\theta$ integrate to zero over a full period; $1 + \frac12$ integrates to $3\pi$.` },
        ],
        polarPlot(`${a}(1 + cos(t))`, `r = ${a}(1 + \\cos\\theta)`, [0, 2 * Math.PI], 2.3 * a),
      );
    case 5:
      return common(
        md`Find the area enclosed by the circle $r = ${2 * a}\cos\theta$. Give the exact value.`,
        F(a2),
        md`The whole circle is traced once for $-\pi/2 \le \theta \le \pi/2$. Area is $\int \int_0^{${2 * a}\cos\theta} r \, dr \, d\theta$.`,
        [
          { math: `A = \\int_{-\\pi/2}^{\\pi/2} \\int_0^{${2 * a}\\cos\\theta} r \\, dr \\, d\\theta = \\int_{-\\pi/2}^{\\pi/2} ${2 * a2}\\cos^2\\theta \\, d\\theta`, note: md`Inner integral: $\frac12 (${2 * a}\cos\theta)^2$. Beyond $\pm\pi/2$, $r$ would be negative and retrace the same circle.` },
          { math: `= ${2 * a2} \\cdot \\frac{\\pi}{2} = ${piOf(F(a2)).tex}`, note: md`$\int_{-\pi/2}^{\pi/2} \cos^2\theta \, d\theta = \frac{\pi}{2}$: the circle has radius $${a}$, so this matches $\pi r^2$.` },
        ],
        polarPlot(`${2 * a}cos(t)`, `r = ${2 * a}\\cos\\theta`, [-Math.PI / 2, Math.PI / 2], 2.3 * a),
      );
    case 6:
      return common(
        md`Find the area of one petal of the rose $r = ${a}\cos 2\theta$. Give the exact value.`,
        F(a2, 8),
        md`One petal is traced while $\cos 2\theta \ge 0$, for $-\pi/4 \le \theta \le \pi/4$.`,
        [
          { math: `A = \\int_{-\\pi/4}^{\\pi/4} \\int_0^{${a}\\cos 2\\theta} r \\, dr \\, d\\theta = \\int_{-\\pi/4}^{\\pi/4} \\frac{${a2}}{2}\\cos^2 2\\theta \\, d\\theta`, note: "" },
          { math: `= \\frac{${a2}}{2} \\cdot \\frac{\\pi}{4} = ${piOf(F(a2, 8)).tex}`, note: md`$\cos^2 2\theta = \frac{1 + \cos 4\theta}{2}$; over an interval of length $\pi/2$ the cosine part integrates to zero.` },
        ],
        polarPlot(`${a}cos(2t)`, `r = ${a}\\cos 2\\theta`, [0, 2 * Math.PI], 1.3 * a),
      );
    default:
      return common(
        md`Find the area of one petal of the rose $r = ${a}\sin 3\theta$. Give the exact value.`,
        F(a2, 12),
        md`One petal is traced while $\sin 3\theta \ge 0$, for $0 \le \theta \le \pi/3$.`,
        [
          { math: `A = \\int_{0}^{\\pi/3} \\int_0^{${a}\\sin 3\\theta} r \\, dr \\, d\\theta = \\int_{0}^{\\pi/3} \\frac{${a2}}{2}\\sin^2 3\\theta \\, d\\theta`, note: "" },
          { math: `= \\frac{${a2}}{2} \\cdot \\frac{\\pi}{6} = ${piOf(F(a2, 12)).tex}`, note: md`$\sin^2 3\theta = \frac{1 - \cos 6\theta}{2}$ averages to $\frac12$ over the interval of length $\pi/3$.` },
        ],
        polarPlot(`${a}sin(3t)`, `r = ${a}\\sin 3\\theta`, [0, Math.PI], 1.3 * a),
      );
  }
};

// ── Lesson 3 generators: triple integrals ───────────────────────────────────

/** The innermost integral of a triple integral over a box. */
const innermostIntegral: Generator = (r) => {
  const lo = r.int(0, 1);
  const hi = lo + r.int(1, 2);
  const t1 = { c: r.coef(-6, 6), m: r.int(0, 2), n: r.int(0, 2), p: r.int(1, 2) };
  let t2 = { c: r.nonzero(-5, 5), m: r.int(0, 1), n: r.int(0, 1), p: r.int(0, 1) };
  while (t2.m === t1.m && t2.n === t1.n && t2.p === t1.p) t2 = { ...t2, m: r.int(0, 1), p: r.int(0, 1) };
  if (t1.m === 0 && t1.n === 0 && t2.m === 0 && t2.n === 0) t1.m = 1;
  const terms = [t1, t2];
  const integrand = isum(terms.map((t) => [t.c, monoTex([["x", t.m], ["y", t.n], ["z", t.p]])] as [number, string]));
  const anti = fsum(terms.map((t) => [F(t.c, t.p + 1), monoTex([["x", t.m], ["y", t.n], ["z", t.p + 1]]), ""] as [F, string, string]));
  const byMono = new Map<string, { f: F; tex: string; text: string }>();
  for (const t of terms) {
    const key = `${t.m},${t.n}`;
    const prev = byMono.get(key);
    const c = mul(F(t.c), powInt(t.p, lo, hi));
    byMono.set(key, { f: add(prev?.f ?? F(0), c), tex: monoTex([["x", t.m], ["y", t.n]]), text: monoText([["x", t.m], ["y", t.n]]) });
  }
  const result = fsum([...byMono.values()].map((v) => [v.f, v.tex, v.text] as [F, string, string]));
  return {
    prompt: md`Evaluate the innermost integral $\int_{${lo}}^{${hi}} (${integrand}) \, dz$ of a triple integral over a box, treating $x$ and $y$ as constants. Give your answer as an expression in $x$ and $y$.`,
    answer: result.text,
    simplified: true,
    hint: md`Only $z$ moves. Integrate each term in $z$ with the power rule; the $x$ and $y$ factors are constant coefficients.`,
    solution: [
      { math: `\\left[${anti.tex}\\right]_{z = ${lo}}^{z = ${hi}}`, note: md`Antidifferentiate in $z$.` },
      { math: terms.map((t) => `${t.c < 0 ? "-" : "+"} ${Math.abs(t.c)}${monoTex([["x", t.m], ["y", t.n]])} \\cdot ${ftex(powInt(t.p, lo, hi))}`).join(" ").replace(/^\+ /, ""), note: md`Each $\int_{${lo}}^{${hi}} z^p \, dz$ is a number.` },
      { math: result.tex, note: "Collect like terms. The next integral will be in y, then x." },
    ],
  };
};

/** A triple integral over a box. */
const boxIntegral: Generator = (r) => {
  const [a, b, c] = [r.int(1, 2), r.int(1, 3), r.int(1, 2)];
  const t1 = { k: r.coef(-6, 6), m: r.int(0, 2), n: r.int(0, 2), p: r.int(0, 2) };
  if (t1.m + t1.n + t1.p === 0) t1.p = 1;
  const t2 = { k: r.nonzero(-4, 4), m: r.int(0, 1), n: r.int(0, 1), p: 0 };
  const terms = [t1, t2];
  const integrand = isum(terms.map((t) => [t.k, monoTex([["x", t.m], ["y", t.n], ["z", t.p]])] as [number, string]));
  const termValue = (t: typeof t1) => mul(mul(mul(F(t.k), powInt(t.m, 0, a)), powInt(t.n, 0, b)), powInt(t.p, 0, c));
  const total = add(termValue(t1), termValue(t2));
  const afterZ = fsum(terms.map((t) => [mul(F(t.k), powInt(t.p, 0, c)), monoTex([["x", t.m], ["y", t.n]]), ""] as [F, string, string]));
  const afterY = fsum(terms.map((t) => [mul(mul(F(t.k), powInt(t.p, 0, c)), powInt(t.n, 0, b)), pw("x", t.m), ""] as [F, string, string]));
  return {
    prompt: md`Work out $\int_{0}^{${a}} \int_{0}^{${b}} \int_{0}^{${c}} (${integrand}) \, dz \, dy \, dx$. Give the exact value, as a fraction if needed.`,
    answer: ftext(total),
    simplified: true,
    hint: md`Three single integrals, inside out: first $z$ from $0$ to $${c}$ with $x, y$ constant, then $y$ from $0$ to $${b}$, then $x$ from $0$ to $${a}$.`,
    solution: [
      { math: `\\int_{0}^{${c}} (${integrand}) \\, dz = ${afterZ.tex}`, note: md`Each $z^p$ becomes $\int_0^{${c}} z^p \, dz = \frac{${c}^{p+1}}{p+1}$.` },
      { math: `\\int_{0}^{${b}} \\left(${afterZ.tex}\\right) dy = ${afterY.tex}`, note: md`Now $y$, with $x$ still constant.` },
      { math: `\\int_{0}^{${a}} \\left(${afterY.tex}\\right) dx = ${ftex(total)}`, note: "The last integral is a plain number." },
    ],
  };
};

/** The tetrahedron cut from the first octant by a plane with intercepts a, b, c. */
function tetra(r: Rng) {
  const [a, b, c] = [r.pick([1, 2, 3, 4]), r.pick([1, 2, 3, 4]), r.pick([1, 2, 3, 4, 6])];
  const l = (x: number, y: number) => (x * y) / gcd(x, y);
  const s = l(l(a, b), c);
  const [p, q, w] = [s / a, s / b, s / c];
  const planeTex = `${isum([[p, "x"], [q, "y"], [w, "z"]])} = ${s}`;
  const topTex = fsum([[F(s, w), "", ""], [F(-p, w), "x", "x"], [F(-q, w), "y", "y"]]).tex;
  const yTopTex = fsum([[F(s, q), "", ""], [F(-p, q), "x", "x"]]).tex;
  const figure: Figure = {
    kind: "diagram",
    view: [-0.6, a + 0.8, -0.6, b + 0.8],
    grid: true,
    points: [
      { name: "O", x: 0, y: 0, label: "" },
      { name: "A", x: a, y: 0, label: `(${a}, 0)`, dir: "se" },
      { name: "B", x: 0, y: b, label: `(0, ${b})`, dir: "nw" },
    ],
    polygons: [{ points: ["O", "A", "B"], fill: 1 }],
    segments: [{ from: "A", to: "B", color: 2, label: `${isum([[p, "x"], [q, "y"]])} = ${s}` }],
    caption: md`The shadow of the solid on the $xy$-plane: where the plane meets $z = 0$.`,
  };
  return { a, b, c, p, q, w, s, planeTex, topTex, yTopTex, figure };
}

/** Volume and moments of a tetrahedron, and a wedge, by triple integrals. */
const tetraSolid: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 3) {
    const a = r.int(1, 3);
    const total = F(a ** 4, 8);
    return {
      prompt: md`Find the volume of the solid bounded below by $z = 0$, above by $z = xy$, and lying over the triangle $0 \le y \le x \le ${a}$ in the $xy$-plane. Give the exact value.`,
      answer: ftext(total),
      simplified: true,
      hint: md`$V = \iiint 1 \, dV$ with $0 \le z \le xy$ over the triangle. The $z$ integral gives the height $xy$, so it becomes $\iint_D xy \, dA$.`,
      solution: [
        { math: `V = \\int_0^{${a}} \\int_0^{x} \\int_0^{xy} dz \\, dy \\, dx = \\int_0^{${a}} \\int_0^{x} xy \\, dy \\, dx`, note: md`The triangle: $0 \le x \le ${a}$ and, for each $x$, $0 \le y \le x$.` },
        { math: `\\int_0^{x} xy \\, dy = \\frac{x^3}{2}`, note: "" },
        { math: `\\int_0^{${a}} \\frac{x^3}{2} \\, dx = \\frac{${a ** 4}}{8} = ${ftex(total)}`, note: "" },
      ],
    };
  }
  const T = tetra(r);
  const { a, b, c, s, p, q, w } = T;
  const vol = F(a * b * c, 6);
  if (kind === 0) {
    return {
      prompt: md`Find the volume of the tetrahedron bounded by the coordinate planes and the plane $${T.planeTex}$. Give the exact value.`,
      answer: ftext(vol),
      simplified: true,
      figure: T.figure,
      hint: md`Solve the plane for $z$: that is the top. The shadow on the $xy$-plane is the triangle where $z = 0$, so $${isum([[p, "x"], [q, "y"]])} \le ${s}$ in the first quadrant.`,
      solution: [
        { math: `V = \\int_0^{${a}} \\int_0^{${T.yTopTex}} \\int_0^{${T.topTex}} dz \\, dy \\, dx`, note: md`Intercepts: $x = ${a}$, $y = ${b}$, $z = ${c}$. The top is $z = ${T.topTex}$; the shadow's slanted edge is $y = ${T.yTopTex}$.` },
        { math: `= \\int_0^{${a}} \\int_0^{${T.yTopTex}} \\left(${T.topTex}\\right) dy \\, dx = \\int_0^{${a}} \\frac{(${s} - ${p === 1 ? "" : p}x)^2}{${2 * q * w}} \\, dx`, note: md`Inner $y$ integral: an antiderivative of $\frac{${s} - ${p === 1 ? "" : p}x - ${q === 1 ? "" : q}y}{${w}}$ in $y$ is $-\frac{(${s} - ${p === 1 ? "" : p}x - ${q === 1 ? "" : q}y)^2}{${2 * q * w}}$, which is $0$ at the top limit.` },
        { math: `= \\frac{${s}^3}{${6 * p * q * w}} = ${ftex(vol)}`, note: md`$\int_0^{${a}} (${s} - ${p === 1 ? "" : p}x)^2 \, dx = \frac{${s}^3}{${3 * p}}$. This is $\frac{abc}{6}$ with intercepts $a = ${a}$, $b = ${b}$, $c = ${c}$, as proved in the lesson.` },
      ],
    };
  }
  if (kind === 1) {
    const total = F(a * b * c * c, 24);
    return {
      prompt: md`Work out $\iiint_E z \, dV$, where $E$ is the tetrahedron bounded by the coordinate planes and the plane $${T.planeTex}$. Give the exact value.`,
      answer: ftext(total),
      simplified: true,
      figure: T.figure,
      hint: md`Same limits as for the volume, but the innermost integral is $\int_0^{\text{top}} z \, dz = \frac12 (\text{top})^2$.`,
      solution: [
        { math: `\\iiint_E z \\, dV = \\int_0^{${a}} \\int_0^{${T.yTopTex}} \\int_0^{${T.topTex}} z \\, dz \\, dy \\, dx`, note: md`Intercepts $${a}, ${b}, ${c}$; top $z = ${T.topTex}$.` },
        { math: `= \\int_0^{${a}} \\int_0^{${T.yTopTex}} \\frac12\\left(${T.topTex}\\right)^2 dy \\, dx`, note: md`Innermost integral: $\frac{z^2}{2}$ at the top.` },
        { math: `= \\frac{${c * c}}{2} \\iint_D \\left(1 - \\frac{x}{${a}} - \\frac{y}{${b}}\\right)^2 dA = \\frac{${c * c}}{2} \\cdot \\frac{${a * b}}{12} = ${ftex(total)}`, note: md`Over the shadow triangle, $\iint (1 - x/a - y/b)^2 \, dA = ab/12$: substitute $u = 1 - x/a - y/b$ in the inner integral, or expand and integrate term by term.` },
      ],
    };
  }
  const total = F(a * a * b * c, 24);
  return {
    prompt: md`Work out $\iiint_E x \, dV$, where $E$ is the tetrahedron bounded by the coordinate planes and the plane $${T.planeTex}$. Give the exact value.`,
    answer: ftext(total),
    simplified: true,
    figure: T.figure,
    hint: md`Integrate $z$ first: $\int_0^{\text{top}} x \, dz = x \cdot \text{top}$. Then you have a double integral over the shadow triangle.`,
    solution: [
      { math: `\\iiint_E x \\, dV = \\int_0^{${a}} \\int_0^{${T.yTopTex}} x\\left(${T.topTex}\\right) dy \\, dx`, note: md`The innermost integral is $x$ times the height.` },
      { math: `= \\int_0^{${a}} x \\cdot \\frac{${c}}{2} \\cdot \\frac{${b}}{${a}}\\left(${a} - x\\right) \\cdot \\frac{${a} - x}{${a}} \\, dx = \\frac{${b * c}}{2 \\cdot ${a * a}} \\int_0^{${a}} x(${a} - x)^2 \\, dx`, note: md`The $y$ integral of a linear function vanishing at its top limit is half base times height; the base is $\frac{${b}}{${a}}(${a} - x)$ and the height $\frac{${c}}{${a}}(${a} - x)$.` },
      { math: `= \\frac{${b * c}}{${2 * a * a}} \\cdot \\frac{${a}^4}{12} = ${ftex(total)}`, note: md`$\int_0^{a} x(a - x)^2 \, dx = \frac{a^4}{12}$. In general $\iiint_E x \, dV = \frac{a^2 bc}{24}$.` },
    ],
  };
};

/** Limits for a tetrahedron in the order dz dy dx: x upper limit and y upper limit. */
const tetraLimits: Generator = (r) => {
  const T = tetra(r);
  const { a, p, q, s } = T;
  const yTopText = fsum([[F(s, q), "", ""], [F(-p, q), "x", "x"]]).text;
  return {
    prompt: md`$E$ is the tetrahedron bounded by the coordinate planes and the plane $${T.planeTex}$. In $\iiint_E f \, dV = \int_0^{b} \int_0^{h(x)} \int_0^{${T.topTex}} f \, dz \, dy \, dx$, find the outer limit $b$ and the middle limit $h(x)$. Give $(b, h(x))$, with $h(x)$ an expression in $x$.`,
    answer: `(${a}, ${yTopText})`,
    form: "tuple",
    // b is where the plane meets the x-axis (y = z = 0); h(x) is where it meets z = 0 at that x.
    verify: [`${p} b + 0 h = ${s}`, `${p} x + ${q} h + 0 b = ${s}`],
    figure: T.figure,
    hint: md`Set $z = 0$ in the plane to get the shadow's slanted edge, and solve it for $y$: that is $h(x)$. Then set $y = 0$ too to find how far $x$ reaches.`,
    solution: [
      { math: `z = 0: \\quad ${isum([[p, "x"], [q, "y"]])} = ${s} \;\\Rightarrow\; y = ${T.yTopTex} = h(x)`, note: md`For each $x$, $y$ runs from $0$ up to the edge of the shadow.` },
      { math: `y = 0, \; z = 0: \\quad ${p === 1 ? "" : p}x = ${s} \;\\Rightarrow\; x = ${a} = b`, note: md`The shadow reaches as far as the plane's $x$-intercept.` },
      { math: `(b, h(x)) = (${a}, ${T.yTopTex})`, note: "" },
    ],
  };
};

// ── Lesson 4 generators: cylindrical and spherical coordinates ──────────────

/** An exact value a·sqrt(r)/d. */
interface Rad {
  a: number;
  r: number;
  d: number;
}
const radMul = (p: Rad, q: Rad): Rad => {
  let a = p.a * q.a;
  let r: number;
  if (p.r === q.r) {
    a *= p.r;
    r = 1;
  } else r = p.r * q.r;
  const g = gcd(a, p.d * q.d) || 1;
  return { a: a / g, r, d: (p.d * q.d) / g };
};
const radScale = (p: Rad, k: number): Rad => radMul(p, { a: k, r: 1, d: 1 });
function radText(p: Rad): string {
  if (p.a === 0) return "0";
  const root = p.r === 1 ? "" : `sqrt(${p.r})`;
  const coef = p.r === 1 ? String(p.a) : p.a === 1 ? "" : p.a === -1 ? "-" : String(p.a);
  return p.d === 1 ? `${coef}${root}` : `${coef}${root}/${p.d}`;
}
function radTex(p: Rad): string {
  if (p.a === 0) return "0";
  const root = p.r === 1 ? "" : `\\sqrt{${p.r}}`;
  const coef = p.r === 1 ? String(Math.abs(p.a)) : Math.abs(p.a) === 1 ? "" : String(Math.abs(p.a));
  const body = p.d === 1 ? `${coef}${root}` : `\\frac{${coef}${root}}{${p.d}}`;
  return p.a < 0 ? `-${body}` : body;
}
const radVal = (p: Rad) => (p.a * Math.sqrt(p.r)) / p.d;

/** cos and sin of k·pi/12 for the friendly k, as exact values over 2. */
const ANGLES: Record<number, [Rad, Rad]> = {
  0: [{ a: 2, r: 1, d: 2 }, { a: 0, r: 1, d: 2 }],
  2: [{ a: 1, r: 3, d: 2 }, { a: 1, r: 1, d: 2 }],
  3: [{ a: 1, r: 2, d: 2 }, { a: 1, r: 2, d: 2 }],
  4: [{ a: 1, r: 1, d: 2 }, { a: 1, r: 3, d: 2 }],
  6: [{ a: 0, r: 1, d: 2 }, { a: 2, r: 1, d: 2 }],
  8: [{ a: -1, r: 1, d: 2 }, { a: 1, r: 3, d: 2 }],
  9: [{ a: -1, r: 2, d: 2 }, { a: 1, r: 2, d: 2 }],
  10: [{ a: -1, r: 3, d: 2 }, { a: 1, r: 1, d: 2 }],
  12: [{ a: -2, r: 1, d: 2 }, { a: 0, r: 1, d: 2 }],
  14: [{ a: -1, r: 3, d: 2 }, { a: -1, r: 1, d: 2 }],
  15: [{ a: -1, r: 2, d: 2 }, { a: -1, r: 2, d: 2 }],
  16: [{ a: -1, r: 1, d: 2 }, { a: -1, r: 3, d: 2 }],
  18: [{ a: 0, r: 1, d: 2 }, { a: -2, r: 1, d: 2 }],
  20: [{ a: 1, r: 1, d: 2 }, { a: -1, r: 3, d: 2 }],
  21: [{ a: 1, r: 2, d: 2 }, { a: -1, r: 2, d: 2 }],
  22: [{ a: 1, r: 3, d: 2 }, { a: -1, r: 1, d: 2 }],
};
const ANGLE_KEYS = Object.keys(ANGLES).map(Number);
/** "7pi/6" style text and LaTeX for k·pi/12. */
const angleOf = (k: number) => piOf(F(k, 12));

/** Rectangular to cylindrical coordinates. */
const cylPoint: Generator = (r) => {
  const k = r.pick(ANGLE_KEYS);
  const R = r.pick([2, 4, 6]);
  const z = r.int(-3, 5);
  const [c, s] = ANGLES[k]!;
  const x = radScale(c, R);
  const y = radScale(s, R);
  const t = angleOf(k);
  const quadrant = k === 0 || k === 6 || k === 12 || k === 18 ? "on an axis" : k < 6 ? "in the first quadrant" : k < 12 ? "in the second quadrant" : k < 18 ? "in the third quadrant" : "in the fourth quadrant";
  return {
    prompt: md`Convert the point $(${radTex(x)}, ${radTex(y)}, ${z})$ from rectangular to cylindrical coordinates $(r, \theta, z)$, with $r \ge 0$ and $0 \le \theta < 2\pi$. Give $(r, \theta, z)$, for example (2, pi/3, 5).`,
    answer: `(${R}, ${t.text}, ${z})`,
    form: "tuple",
    // The cylindrical point lands exactly on the given point.
    verify: [`(r cos(t) - (${radText(x)}))^2 + (r sin(t) - (${radText(y)}))^2 + (z - (${z}))^2 = 0`],
    hint: md`$r = \sqrt{x^2 + y^2}$, $\theta$ is the angle of $(x, y)$ measured from the positive $x$-axis, and $z$ is unchanged. Check the quadrant of $(x, y)$ before trusting an inverse tangent.`,
    solution: [
      { math: `r = \\sqrt{(${radTex(x)})^2 + (${radTex(y)})^2} = \\sqrt{${R * R}} = ${R}`, note: "Distance from the z-axis, exactly as in polar coordinates." },
      { math: `\\cos\\theta = \\frac{${radTex(x)}}{${R}} = ${radTex(c)}, \\quad \\sin\\theta = \\frac{${radTex(y)}}{${R}} = ${radTex(s)} \;\\Rightarrow\; \\theta = ${t.tex}`, note: md`The point $(x, y)$ is ${quadrant}, which picks out this angle in $[0, 2\pi)$.` },
      { math: `(r, \\theta, z) = (${R}, ${t.tex}, ${z})`, note: md`$z$ carries over unchanged.` },
    ],
  };
};

/** Rectangular to spherical coordinates. */
const sphPoint: Generator = (r) => {
  const kPhi = r.pick([2, 3, 4, 6, 8, 9, 10]);
  const kTheta = r.pick(ANGLE_KEYS);
  const rho = r.pick([2, 4, 4]);
  const [cPhi, sPhi] = ANGLES[kPhi]!;
  const [cTh, sTh] = ANGLES[kTheta]!;
  const x = radScale(radMul(sPhi, cTh), rho);
  const y = radScale(radMul(sPhi, sTh), rho);
  const z = radScale(cPhi, rho);
  const phi = angleOf(kPhi);
  const theta = angleOf(kTheta);
  const rxy = radScale(sPhi, rho);
  return {
    prompt: md`Convert the point $(${radTex(x)}, ${radTex(y)}, ${radTex(z)})$ from rectangular to spherical coordinates $(\rho, \varphi, \theta)$, with $\rho \ge 0$, $0 \le \varphi \le \pi$ and $0 \le \theta < 2\pi$. Give $(\rho, \varphi, \theta)$, for example (4, pi/3, pi/4).`,
    answer: `(${rho}, ${phi.text}, ${theta.text})`,
    form: "tuple",
    // Tuple letters bind alphabetically: p is rho, r is phi, t is theta. The spherical point lands on the given point.
    verify: [`(p sin(r) cos(t) - (${radText(x)}))^2 + (p sin(r) sin(t) - (${radText(y)}))^2 + (p cos(r) - (${radText(z)}))^2 = 0`],
    hint: md`$\rho = \sqrt{x^2 + y^2 + z^2}$. Then $\cos\varphi = z/\rho$ fixes $\varphi$ in $[0, \pi]$. Finally $\theta$ is the polar angle of $(x, y)$, as in cylindrical coordinates.`,
    solution: [
      { math: `\\rho = \\sqrt{x^2 + y^2 + z^2} = \\sqrt{${rho * rho}} = ${rho}`, note: md`$x^2 + y^2 = ${radTex(radMul(rxy, rxy))}$ and $z^2 = ${radTex(radMul(z, z))}$.` },
      { math: `\\cos\\varphi = \\frac{z}{\\rho} = ${radTex(cPhi)} \;\\Rightarrow\; \\varphi = ${phi.tex}`, note: md`$\varphi$ is the angle down from the positive $z$-axis, between $0$ and $\pi$, so cosine alone determines it.` },
      { math: `r = \\rho\\sin\\varphi = ${radTex(rxy)}, \\quad \\cos\\theta = \\frac{x}{r} = ${radTex(cTh)}, \\quad \\sin\\theta = \\frac{y}{r} = ${radTex(sTh)} \;\\Rightarrow\; \\theta = ${theta.tex}`, note: md`$\theta$ is the angle of $(x, y)$ in the $xy$-plane; both signs are needed to place it.` },
      { math: `(\\rho, \\varphi, \\theta) = (${rho}, ${phi.tex}, ${theta.tex})`, note: "" },
    ],
  };
};

/** Surfaces in spherical coordinates. */
const sphEquation: Generator = (r) => {
  const kind = r.int(0, 4);
  const a = r.int(1, 4);
  if (kind === 0) {
    const cones = [
      { tex: "z = \\sqrt{3}\\sqrt{x^2 + y^2}", phi: "pi/6", phiTex: "\\pi/6", tan: "1/sqrt(3)", note: md`$\tan\varphi = \frac{r}{z} = \frac{1}{\sqrt 3}$, so $\varphi = \pi/6$: a narrow cone around the positive $z$-axis.` },
      { tex: "z = \\sqrt{x^2 + y^2}", phi: "pi/4", phiTex: "\\pi/4", tan: "1", note: md`$\tan\varphi = \frac{r}{z} = 1$, so $\varphi = \pi/4$.` },
      { tex: "z = \\frac{1}{\\sqrt{3}}\\sqrt{x^2 + y^2}", phi: "pi/3", phiTex: "\\pi/3", tan: "sqrt(3)", note: md`$\tan\varphi = \frac{r}{z} = \sqrt 3$, so $\varphi = \pi/3$: a wide cone.` },
      { tex: "z = -\\sqrt{x^2 + y^2}", phi: "3pi/4", phiTex: "3\\pi/4", tan: "-1", note: md`$z < 0$ puts the cone below the $xy$-plane, so $\varphi > \pi/2$: $\tan\varphi = -1$ gives $\varphi = 3\pi/4$.` },
      { tex: "z = -\\sqrt{3}\\sqrt{x^2 + y^2}", phi: "5pi/6", phiTex: "5\\pi/6", tan: "-1/sqrt(3)", note: md`Below the plane and hugging the negative $z$-axis: $\varphi = 5\pi/6$.` },
    ];
    const cone = r.pick(cones);
    return {
      prompt: md`The cone $${cone.tex}$ is a surface $\varphi = \text{constant}$ in spherical coordinates. Find that constant. Give the exact angle, for example pi/4.`,
      answer: cone.phi,
      // On the cone, tan(phi) = r/z.
      verify: [`tan(p) = ${cone.tan}`],
      hint: md`$\sqrt{x^2 + y^2} = r = \rho\sin\varphi$ and $z = \rho\cos\varphi$. Divide to get $\tan\varphi$, and remember $0 \le \varphi \le \pi$.`,
      solution: [
        { math: `\\rho\\cos\\varphi = ${cone.tex.split(" = ")[1]!.replace("\\sqrt{x^2 + y^2}", "\\rho\\sin\\varphi")}`, note: md`Substitute $z = \rho\cos\varphi$ and $\sqrt{x^2 + y^2} = \rho\sin\varphi$.` },
        { math: `\\varphi = ${cone.phiTex}`, note: cone.note },
      ],
    };
  }
  const items = [
    { surface: `x^2 + y^2 + z^2 = ${2 * a}z`, answer: `${2 * a}cos(p)`, answerTex: `${2 * a}\\cos\\varphi`, verify: `q^2 = ${2 * a} q cos(p)`, step: { math: `\\rho^2 = ${2 * a}\\rho\\cos\\varphi`, note: md`$x^2 + y^2 + z^2 = \rho^2$ and $z = \rho\cos\varphi$.` }, why: md`Divide by $\rho$. A sphere of radius $${a}$ centered at $(0, 0, ${a})$.` },
    { surface: `x^2 + y^2 = ${a * a}`, answer: `${a}/sin(p)`, answerTex: `\\frac{${a}}{\\sin\\varphi}`, verify: `(q sin(p))^2 = ${a * a}`, step: { math: `\\rho^2\\sin^2\\varphi = ${a * a}`, note: md`$x^2 + y^2 = r^2 = \rho^2\sin^2\varphi$.` }, why: md`Take the positive root and divide: the cylinder of radius $${a}$.` },
    { surface: `z = ${a}`, answer: `${a}/cos(p)`, answerTex: `\\frac{${a}}{\\cos\\varphi}`, verify: `q cos(p) = ${a}`, step: { math: `\\rho\\cos\\varphi = ${a}`, note: md`$z = \rho\cos\varphi$.` }, why: md`A horizontal plane; $\rho$ grows without bound as $\varphi \to \pi/2$.` },
    { surface: a === 1 ? "z = x^2 + y^2" : `z = ${a}(x^2 + y^2)`, answer: `cos(p)/(${a === 1 ? "" : a}(sin(p))^2)`, answerTex: `\\frac{\\cos\\varphi}{${a === 1 ? "" : a}\\sin^2\\varphi}`, verify: `q cos(p) = ${a}(q sin(p))^2`, step: { math: `\\rho\\cos\\varphi = ${a === 1 ? "" : a}\\rho^2\\sin^2\\varphi`, note: md`$z = \rho\cos\varphi$ and $x^2 + y^2 = \rho^2\sin^2\varphi$.` }, why: md`Divide by $\rho\sin^2\varphi$: the paraboloid.` },
  ];
  const item = items[kind - 1]!;
  return {
    prompt: md`Write the surface $${item.surface}$ in spherical coordinates, solved for $\rho$ as a function of $\varphi$ (it doesn't depend on $\theta$). Type phi as p, for example 2cos(p).`,
    answer: item.answer,
    verify: [item.verify],
    hint: md`Substitute $x^2 + y^2 = \rho^2\sin^2\varphi$, $z = \rho\cos\varphi$ and $x^2 + y^2 + z^2 = \rho^2$, then solve for $\rho$.`,
    solution: [item.step, { math: `\\rho = ${item.answerTex}`, note: item.why }],
  };
};

/** Volumes and moments by cylindrical and spherical coordinates. */
const coordVolume: Generator = (r) => {
  const kind = r.int(0, 8);
  const a = r.int(1, 3);
  const h = r.int(1, 4);
  const [a2, a3, a4, a5, a6] = [a ** 2, a ** 3, a ** 4, a ** 5, a ** 6];
  const make = (prompt: string, answer: string, hint: string, steps: { math: string; note: string }[]) => ({ prompt, answer, hint, solution: steps });
  switch (kind) {
    case 0:
      return make(
        md`Work out $\iiint_E z \, dV$, where $E$ is the solid cylinder $x^2 + y^2 \le ${a2}$, $0 \le z \le ${h}$. Give the exact value.`,
        piOf(F(a2 * h * h, 2)).text,
        md`In cylindrical coordinates $E$ is $0 \le r \le ${a}$, $0 \le \theta \le 2\pi$, $0 \le z \le ${h}$, and $dV = r \, dz \, dr \, d\theta$.`,
        [
          { math: `\\int_0^{2\\pi} \\int_0^{${a}} \\int_0^{${h}} z \\, r \\, dz \\, dr \\, d\\theta`, note: "Constant limits in all three variables: a box in cylindrical coordinates." },
          { math: `= \\int_0^{2\\pi} d\\theta \\int_0^{${a}} r \\, dr \\int_0^{${h}} z \\, dz = 2\\pi \\cdot \\frac{${a2}}{2} \\cdot \\frac{${h * h}}{2} = ${piOf(F(a2 * h * h, 2)).tex}`, note: "The integrand is a product, so the triple integral factors." },
        ],
      );
    case 1:
      return make(
        md`Work out $\iiint_E (x^2 + y^2) \, dV$, where $E$ is the solid cylinder $x^2 + y^2 \le ${a2}$, $0 \le z \le ${h}$. Give the exact value.`,
        piOf(F(h * a4, 2)).text,
        md`$x^2 + y^2 = r^2$, and $dV = r \, dz \, dr \, d\theta$, so the integrand becomes $r^3$.`,
        [
          { math: `\\int_0^{2\\pi} \\int_0^{${a}} \\int_0^{${h}} r^2 \\cdot r \\, dz \\, dr \\, d\\theta = 2\\pi \\cdot ${h} \\cdot \\int_0^{${a}} r^3 \\, dr`, note: md`The $z$ and $\theta$ integrals just multiply by $${h}$ and $2\pi$.` },
          { math: `= ${2 * h}\\pi \\cdot \\frac{${a4}}{4} = ${piOf(F(h * a4, 2)).tex}`, note: "" },
        ],
      );
    case 2: {
      const m = r.int(1, 2);
      const hh = m * a + r.int(1, 3);
      return make(
        md`Find the volume of the solid inside the cylinder $x^2 + y^2 \le ${a2}$, above $z = 0$ and below the plane $z = ${isum([[m, "x"], [hh, ""]])}$. Give the exact value.`,
        piOf(F(a2 * hh)).text,
        md`Height is $${isum([[m, "x"], [hh, ""]])} = ${m === 1 ? "" : m}r\cos\theta + ${hh}$, positive on the whole disk since $|x| \le ${a}$. Integrate over the disk in polar form.`,
        [
          { math: `V = \\int_0^{2\\pi} \\int_0^{${a}} (${m === 1 ? "" : m}r\\cos\\theta + ${hh}) \\, r \\, dr \\, d\\theta`, note: md`$V = \iint (\text{top} - \text{bottom}) \, dA$, or equivalently the $z$ integral of $dV$ done first.` },
          { math: `= ${m === 1 ? "" : m}\\int_0^{2\\pi} \\cos\\theta \\, d\\theta \\int_0^{${a}} r^2 \\, dr + ${hh} \\cdot 2\\pi \\cdot \\frac{${a2}}{2} = 0 + ${piOf(F(a2 * hh)).tex}`, note: md`$\int_0^{2\pi} \cos\theta \, d\theta = 0$: the plane rises on one side of the cylinder exactly as much as it drops on the other.` },
        ],
      );
    }
    case 3:
      return make(
        md`Work out $\iiint_E z \, dV$, where $E$ is the solid between the paraboloid $z = x^2 + y^2$ and the plane $z = ${a2}$. Give the exact value.`,
        piOf(F(a6, 3)).text,
        md`In cylindrical coordinates: $0 \le r \le ${a}$, $r^2 \le z \le ${a2}$. Do the $z$ integral first.`,
        [
          { math: `\\int_0^{2\\pi} \\int_0^{${a}} \\int_{r^2}^{${a2}} z \\, r \\, dz \\, dr \\, d\\theta = \\int_0^{2\\pi} \\int_0^{${a}} \\frac{${a4} - r^4}{2} \\, r \\, dr \\, d\\theta`, note: md`$\left[\frac{z^2}{2}\right]_{r^2}^{${a2}} = \frac{${a4} - r^4}{2}$.` },
          { math: `= 2\\pi \\cdot \\frac12\\left(\\frac{${a4} \\cdot ${a2}}{2} - \\frac{${a6}}{6}\\right) = \\pi \\cdot \\frac{${a6}}{3} = ${piOf(F(a6, 3)).tex}`, note: "" },
        ],
      );
    case 4:
      return make(
        md`Use spherical coordinates to find the volume of the ball $x^2 + y^2 + z^2 \le ${a2}$. Give the exact value.`,
        piOf(F(4 * a3, 3)).text,
        md`The ball is $0 \le \rho \le ${a}$, $0 \le \varphi \le \pi$, $0 \le \theta \le 2\pi$, with $dV = \rho^2 \sin\varphi \, d\rho \, d\varphi \, d\theta$.`,
        [
          { math: `V = \\int_0^{2\\pi} \\int_0^{\\pi} \\int_0^{${a}} \\rho^2 \\sin\\varphi \\, d\\rho \\, d\\varphi \\, d\\theta`, note: "" },
          { math: `= 2\\pi \\cdot \\left[-\\cos\\varphi\\right]_0^{\\pi} \\cdot \\frac{${a3}}{3} = 2\\pi \\cdot 2 \\cdot \\frac{${a3}}{3} = ${piOf(F(4 * a3, 3)).tex}`, note: "Three separate single integrals, multiplied." },
        ],
      );
    case 5:
      return make(
        md`Work out $\iiint_B (x^2 + y^2 + z^2) \, dV$ over the ball $B$: $x^2 + y^2 + z^2 \le ${a2}$. Give the exact value.`,
        piOf(F(4 * a5, 5)).text,
        md`$x^2 + y^2 + z^2 = \rho^2$, and $dV = \rho^2\sin\varphi \, d\rho \, d\varphi \, d\theta$. The integrand becomes $\rho^4 \sin\varphi$.`,
        [
          { math: `\\int_0^{2\\pi} \\int_0^{\\pi} \\int_0^{${a}} \\rho^2 \\cdot \\rho^2\\sin\\varphi \\, d\\rho \\, d\\varphi \\, d\\theta = 2\\pi \\cdot 2 \\cdot \\frac{${a5}}{5}`, note: md`$\int_0^{\pi}\sin\varphi \, d\varphi = 2$ and $\int_0^{${a}} \rho^4 \, d\rho = \frac{${a5}}{5}$.` },
          { math: `= ${piOf(F(4 * a5, 5)).tex}`, note: "" },
        ],
      );
    case 6: {
      const cone = r.pick([
        { phi: "\\pi/3", cos: "\\frac12", factor: F(1, 2), extra: "", coneTex: "z = \\frac{1}{\\sqrt{3}}\\sqrt{x^2 + y^2}" },
        { phi: "\\pi/4", cos: "\\frac{\\sqrt 2}{2}", factor: F(1, 2), extra: "(2 - sqrt(2))", coneTex: "z = \\sqrt{x^2 + y^2}" },
        { phi: "\\pi/6", cos: "\\frac{\\sqrt 3}{2}", factor: F(1, 2), extra: "(2 - sqrt(3))", coneTex: "z = \\sqrt{3}\\sqrt{x^2 + y^2}" },
      ]);
      // V = (2 pi a^3 / 3)(1 - cos phi0). For pi/3 that is pi a^3/3; otherwise (pi a^3/3)(2 - sqrt k).
      const base = piOf(F(a3, 3));
      return make(
        md`Find the volume of the "ice-cream cone" inside the sphere $x^2 + y^2 + z^2 = ${a2}$ and above the cone $${cone.coneTex}$. Give the exact value.`,
        `${base.text}${cone.extra}`,
        md`The cone is $\varphi = ${cone.phi}$, so the solid is $0 \le \rho \le ${a}$, $0 \le \varphi \le ${cone.phi}$, $0 \le \theta \le 2\pi$.`,
        [
          { math: `V = \\int_0^{2\\pi} \\int_0^{${cone.phi}} \\int_0^{${a}} \\rho^2\\sin\\varphi \\, d\\rho \\, d\\varphi \\, d\\theta`, note: md`Above the cone means closer to the $z$-axis: $\varphi$ from $0$ up to the cone's angle.` },
          { math: `= 2\\pi \\cdot \\frac{${a3}}{3} \\cdot \\left[-\\cos\\varphi\\right]_0^{${cone.phi}} = \\frac{${2 * a3}\\pi}{3}\\left(1 - ${cone.cos}\\right) = ${base.tex}${cone.extra ? `\\left${cone.extra.replace("sqrt(", "\\sqrt{").replace(")", "}").replace(")", "\\right)")}` : ""}`, note: "" },
        ],
      );
    }
    case 7:
      return make(
        md`Work out $\iiint_E z \, dV$, where $E$ is the upper half of the ball $x^2 + y^2 + z^2 \le ${a2}$, $z \ge 0$. Give the exact value.`,
        piOf(F(a4, 4)).text,
        md`$z = \rho\cos\varphi$ and the upper half ball is $0 \le \varphi \le \pi/2$. The integrand becomes $\rho^3 \cos\varphi \sin\varphi$.`,
        [
          { math: `\\int_0^{2\\pi} \\int_0^{\\pi/2} \\int_0^{${a}} \\rho\\cos\\varphi \\cdot \\rho^2\\sin\\varphi \\, d\\rho \\, d\\varphi \\, d\\theta = 2\\pi \\cdot \\frac{${a4}}{4} \\int_0^{\\pi/2} \\sin\\varphi\\cos\\varphi \\, d\\varphi`, note: "" },
          { math: `= 2\\pi \\cdot \\frac{${a4}}{4} \\cdot \\frac12 = ${piOf(F(a4, 4)).tex}`, note: md`$\int_0^{\pi/2} \sin\varphi\cos\varphi \, d\varphi = \left[\frac{\sin^2\varphi}{2}\right]_0^{\pi/2} = \frac12$.` },
        ],
      );
    default: {
      const b = a + r.int(1, 2);
      return make(
        md`Find the volume of the shell between the spheres $x^2 + y^2 + z^2 = ${a2}$ and $x^2 + y^2 + z^2 = ${b * b}$. Give the exact value.`,
        piOf(F(4 * (b ** 3 - a3), 3)).text,
        md`In spherical coordinates the shell is simply $${a} \le \rho \le ${b}$, all $\varphi$ and $\theta$.`,
        [
          { math: `V = \\int_0^{2\\pi} \\int_0^{\\pi} \\int_{${a}}^{${b}} \\rho^2\\sin\\varphi \\, d\\rho \\, d\\varphi \\, d\\theta = 2\\pi \\cdot 2 \\cdot \\frac{${b ** 3} - ${a3}}{3}`, note: "" },
          { math: `= ${piOf(F(4 * (b ** 3 - a3), 3)).tex}`, note: "The difference of two ball volumes, as it should be." },
        ],
      );
    }
  }
};

// ── Lesson 5 generators: change of variables ────────────────────────────────

/** Find the (u, v) corner that maps to a given (x, y) corner. */
const inverseCorner: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let a: number, b: number, c: number, d: number;
    do [a, b, c, d] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
    while (a * d - b * c === 0);
    const u0 = r.int(-2, 3);
    const v0 = u0 === 0 ? r.nonzero(-2, 3) : r.int(-2, 3);
    const [x0, y0] = [a * u0 + b * v0, c * u0 + d * v0];
    const det = a * d - b * c;
    return {
      prompt: md`The change of variables $x = ${isum([[a, "u"], [b, "v"]])}$, $y = ${isum([[c, "u"], [d, "v"]])}$ maps a region $S$ in the $uv$-plane onto a region $R$. One corner of $R$ is $(${x0}, ${y0})$. Find the corner $(u, v)$ of $S$ that maps to it.`,
      answer: `(${u0}, ${v0})`,
      form: "tuple",
      verify: [`${a} u + ${b} v = ${x0}`, `${c} u + ${d} v = ${y0}`],
      hint: md`Set $x = ${x0}$ and $y = ${y0}$ and solve the two linear equations for $u$ and $v$.`,
      solution: [
        { math: `${isum([[a, "u"], [b, "v"]])} = ${x0}, \\quad ${isum([[c, "u"], [d, "v"]])} = ${y0}`, note: "The corner of S is the preimage of the corner of R." },
        { math: `u = \\frac{${d}(${x0}) - ${b}(${y0})}{${det}} = ${u0}, \\quad v = \\frac{${a}(${y0}) - ${c}(${x0})}{${det}} = ${v0}`, note: md`Cramer's rule, or elimination. The determinant $${a}\cdot${par(d)} - ${par(b)}\cdot${par(c)} = ${det}$ is the Jacobian of this linear map.` },
      ],
    };
  }
  if (kind === 1) {
    const u0 = r.int(2, 3);
    const v0 = r.int(1, u0 - 1);
    const [x0, y0] = [u0 * u0 - v0 * v0, 2 * u0 * v0];
    return {
      prompt: md`The transformation $x = u^2 - v^2$, $y = 2uv$ with $u > 0$, $v > 0$ maps a region $S$ onto a region $R$. One corner of $R$ is $(${x0}, ${y0})$. Find the corner $(u, v)$ of $S$ that maps to it.`,
      answer: `(${u0}, ${v0})`,
      form: "tuple",
      verify: [`u^2 - v^2 = ${x0}`, `2 u v = ${y0}`],
      hint: md`$u^2 - v^2 = ${x0}$ and $uv = ${y0 / 2}$. Try small whole numbers, or use $(u^2 + v^2)^2 = (u^2 - v^2)^2 + (2uv)^2$.`,
      solution: [
        { math: `(u^2 + v^2)^2 = (u^2 - v^2)^2 + (2uv)^2 = ${x0 * x0} + ${y0 * y0} = ${(u0 * u0 + v0 * v0) ** 2}`, note: md`So $u^2 + v^2 = ${u0 * u0 + v0 * v0}$.` },
        { math: `u^2 = \\frac{${u0 * u0 + v0 * v0} + ${x0}}{2} = ${u0 * u0}, \\quad v^2 = \\frac{${u0 * u0 + v0 * v0} - ${x0}}{2} = ${v0 * v0}`, note: "Add and subtract the two equations for u² ± v²." },
        { math: `(u, v) = (${u0}, ${v0})`, note: md`Both positive, as required. Check: $2uv = ${y0}$.` },
      ],
    };
  }
  const v0 = r.int(1, 3);
  const u0 = v0 * r.int(1, 3);
  const [x0, y0] = [u0 * v0, u0 / v0];
  return {
    prompt: md`The transformation $x = uv$, $y = u/v$ with $u > 0$, $v > 0$ maps a region $S$ onto a region $R$. One corner of $R$ is $(${x0}, ${y0})$. Find the corner $(u, v)$ of $S$ that maps to it.`,
    answer: `(${u0}, ${v0})`,
    form: "tuple",
    verify: [`u v = ${x0}`, `u = ${y0} v`],
    hint: md`Multiply the two equations: $xy = u^2$. Divide them: $x/y = v^2$.`,
    solution: [
      { math: `xy = uv \\cdot \\frac{u}{v} = u^2 = ${x0 * y0} \;\\Rightarrow\; u = ${u0}`, note: md`$u > 0$ picks the positive root.` },
      { math: `\\frac{x}{y} = \\frac{uv}{u/v} = v^2 = ${v0 * v0} \;\\Rightarrow\; v = ${v0}`, note: "" },
    ],
  };
};

interface Map2 {
  x: string;
  y: string;
  J: string;
  Jtext: string;
  xu: string;
  xv: string;
  yu: string;
  yv: string;
}

function mapOf(r: Rng): Map2 {
  const kind = r.int(0, 7);
  switch (kind) {
    case 0:
      return { x: "u^2 - v^2", y: "2uv", J: "4u^2 + 4v^2", Jtext: "4u^2 + 4v^2", xu: "2u", xv: "-2v", yu: "2v", yv: "2u" };
    case 1:
      return { x: "uv", y: "u + v", J: "v - u", Jtext: "v - u", xu: "v", xv: "u", yu: "1", yv: "1" };
    case 2:
      return { x: "u^2 + v", y: "u - v^2", J: "-4uv - 1", Jtext: "-4uv - 1", xu: "2u", xv: "1", yu: "1", yv: "-2v" };
    case 3:
      return { x: "u\\cos v", y: "u\\sin v", J: "u", Jtext: "u", xu: "\\cos v", xv: "-u\\sin v", yu: "\\sin v", yv: "u\\cos v" };
    case 4:
      return { x: "ue^{v}", y: "ue^{-v}", J: "-2u", Jtext: "-2u", xu: "e^{v}", xv: "ue^{v}", yu: "e^{-v}", yv: "-ue^{-v}" };
    case 5:
      return { x: "u^3 - v", y: "u + v^3", J: "9u^2v^2 + 1", Jtext: "9u^2 v^2 + 1", xu: "3u^2", xv: "-1", yu: "1", yv: "3v^2" };
    case 6:
      return { x: "u^2 v", y: "uv^2", J: "3u^2v^2", Jtext: "3u^2 v^2", xu: "2uv", xv: "u^2", yu: "v^2", yv: "2uv" };
    default: {
      let a: number, b: number, c: number, d: number;
      do [a, b, c, d] = [r.nonzero(-4, 4), r.nonzero(-4, 4), r.nonzero(-4, 4), r.nonzero(-4, 4)];
      while (a * d - b * c === 0);
      return { x: isum([[a, "u"], [b, "v"]]), y: isum([[c, "u"], [d, "v"]]), J: String(a * d - b * c), Jtext: String(a * d - b * c), xu: String(a), xv: String(b), yu: String(c), yv: String(d) };
    }
  }
}

/** The Jacobian of a transformation, as an expression or at a point. */
const jacobian: Generator = (r) => {
  const M = mapOf(r);
  const det = `\\frac{\\partial(x, y)}{\\partial(u, v)} = \\begin{vmatrix} x_u & x_v \\\\ y_u & y_v \\end{vmatrix} = \\begin{vmatrix} ${M.xu} & ${M.xv} \\\\ ${M.yu} & ${M.yv} \\end{vmatrix}`;
  const steps = [
    { math: `x_u = ${M.xu}, \\quad x_v = ${M.xv}, \\quad y_u = ${M.yu}, \\quad y_v = ${M.yv}`, note: "The four partial derivatives." },
    { math: `${det} = (${M.xu})(${M.yv}) - (${M.xv})(${M.yu}) = ${M.J}`, note: "Product of the diagonal minus product of the anti-diagonal." },
  ];
  if (r.next() < 0.5 && !/^-?\d+$/.test(M.J)) {
    return {
      prompt: md`For the transformation $x = ${M.x}$, $y = ${M.y}$, find the Jacobian $\dfrac{\partial(x, y)}{\partial(u, v)}$ as an expression in $u$ and $v$.`,
      answer: M.Jtext,
      hint: md`Compute the four partials $x_u, x_v, y_u, y_v$ and take the determinant $x_u y_v - x_v y_u$.`,
      solution: steps,
    };
  }
  const u0 = r.pick([1, 2, -1]);
  const v0 = r.pick([1, 2, 0, -1]);
  const uses = (s: string) => /u|v/.test(s);
  const Jexpr = M.Jtext.replace(/u/g, `(${u0})`).replace(/v/g, `(${v0})`);
  // Evaluate the Jacobian exactly at the point.
  const value = evalJacobian(M, u0, v0);
  return {
    prompt: md`For the transformation $x = ${M.x}$, $y = ${M.y}$, find the Jacobian $\dfrac{\partial(x, y)}{\partial(u, v)}$ at $(u, v) = (${u0}, ${v0})$. Give the exact value.`,
    answer: value.text,
    hint: md`First find the Jacobian as a function of $u$ and $v$; then substitute $u = ${u0}$, $v = ${v0}$.`,
    solution: [...steps, { math: `${uses(M.J) ? `${M.J}\\Big|_{(${u0}, ${v0})} = ` : ""}${value.tex}`, note: uses(M.J) ? md`Substitute: $${Jexpr.replace(/\(/g, "(").replace(/e\^\(/g, "e^{")}$.` : "The Jacobian of a linear map is constant." }],
  };
};

/** Exact value of a map's Jacobian at integer (u, v), as text and LaTeX. */
function evalJacobian(M: Map2, u: number, v: number): { text: string; tex: string } {
  switch (M.x) {
    case "u^2 - v^2":
      return { text: String(4 * u * u + 4 * v * v), tex: String(4 * u * u + 4 * v * v) };
    case "uv":
      return { text: String(v - u), tex: String(v - u) };
    case "u^2 + v":
      return { text: String(-4 * u * v - 1), tex: String(-4 * u * v - 1) };
    case "u\\cos v":
      return { text: String(u), tex: String(u) };
    case "ue^{v}":
      return { text: String(-2 * u), tex: String(-2 * u) };
    case "u^3 - v":
      return { text: String(9 * u * u * v * v + 1), tex: String(9 * u * u * v * v + 1) };
    case "u^2 v":
      return { text: String(3 * u * u * v * v), tex: String(3 * u * u * v * v) };
    default:
      return { text: M.Jtext, tex: M.J };
  }
}

/** A parallelogram given by 0 <= x + y <= P, 0 <= x - y <= Q, with its corners. */
function parallelogram(P: number, Q: number): Figure {
  const V: [number, number][] = [[0, 0], [P / 2, P / 2], [(P + Q) / 2, (P - Q) / 2], [Q / 2, -Q / 2]];
  return {
    kind: "diagram",
    view: [-0.8, (P + Q) / 2 + 1, -Q / 2 - 1, P / 2 + 1],
    grid: true,
    points: V.map(([x, y], i) => ({ name: "ABCD"[i]!, x, y, label: `(${x}, ${y})`, dir: (["sw", "n", "e", "s"] as const)[i] })),
    polygons: [{ points: ["A", "B", "C", "D"], fill: 1 }],
    caption: md`$R$: between the lines $x + y = 0$ and $x + y = ${P}$, and between $x - y = 0$ and $x - y = ${Q}$.`,
  };
}

/** Evaluate an integral by a change of variables. */
const changeOfVariables: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind <= 1) {
    const a = r.int(1, 3);
    const b = a + r.int(1, 3);
    const ellipse = `\\frac{x^2}{${a * a}} + \\frac{y^2}{${b * b}} \\le 1`;
    const figure: Figure = {
      kind: "plot",
      x: [-b - 0.5, b + 0.5],
      y: [-b - 0.5, b + 0.5],
      parametric: [{ x: `${a}cos(t)`, y: `${b}sin(t)`, t: [0, 2 * Math.PI], label: `\\frac{x^2}{${a * a}} + \\frac{y^2}{${b * b}} = 1`, color: 1 }],
    };
    if (kind === 0) {
      return {
        prompt: md`Use the change of variables $x = ${a}u$, $y = ${b}v$ to find the area of the ellipse $${ellipse}$. Give the exact value.`,
        answer: piOf(F(a * b)).text,
        figure,
        hint: md`Under $x = ${a}u$, $y = ${b}v$ the ellipse becomes the unit disk $u^2 + v^2 \le 1$. The Jacobian stretches areas by a constant factor.`,
        solution: [
          { math: `\\frac{\\partial(x, y)}{\\partial(u, v)} = \\begin{vmatrix} ${a} & 0 \\\\ 0 & ${b} \\end{vmatrix} = ${a * b}`, note: md`Every small $uv$-square becomes an $xy$-rectangle $${a}$ times wider and $${b}$ times taller.` },
          { math: `A = \\iint_E 1 \\, dA = \\iint_{u^2 + v^2 \\le 1} ${a * b} \\, du \\, dv = ${a * b} \\cdot \\pi = ${piOf(F(a * b)).tex}`, note: "The unit disk has area π." },
        ],
      };
    }
    return {
      prompt: md`Use the change of variables $x = ${a}u$, $y = ${b}v$ to work out $\iint_E \left(\frac{x^2}{${a * a}} + \frac{y^2}{${b * b}}\right) dA$ over the ellipse $E$: $${ellipse}$. Give the exact value.`,
      answer: piOf(F(a * b, 2)).text,
      figure,
      hint: md`The integrand becomes $u^2 + v^2$ over the unit disk, times the Jacobian $${a * b}$. Finish in polar coordinates.`,
      solution: [
        { math: `\\iint_E \\left(\\frac{x^2}{${a * a}} + \\frac{y^2}{${b * b}}\\right) dA = \\iint_{u^2 + v^2 \\le 1} (u^2 + v^2) \\cdot ${a * b} \\, du \\, dv`, note: md`$x^2/${a * a} = u^2$, $y^2/${b * b} = v^2$, and $dA = ${a * b} \, du \, dv$.` },
        { math: `= ${a * b} \\int_0^{2\\pi} \\int_0^1 r^2 \\cdot r \\, dr \\, d\\theta = ${a * b} \\cdot 2\\pi \\cdot \\frac14 = ${piOf(F(a * b, 2)).tex}`, note: "Polar coordinates in the uv-plane." },
      ],
    };
  }
  const P = r.pick([2, 4]);
  const Q = r.pick([2, 4]);
  const items = [
    { f: "(x + y)^2", g: "u^2", value: F(P ** 3 * Q, 6), inner: `\\int_0^{${P}} \\int_0^{${Q}} u^2 \\cdot \\frac12 \\, dv \\, du = \\frac{${Q}}{2} \\cdot \\frac{${P ** 3}}{3}` },
    { f: "(x - y)^2", g: "v^2", value: F(P * Q ** 3, 6), inner: `\\int_0^{${P}} \\int_0^{${Q}} v^2 \\cdot \\frac12 \\, dv \\, du = \\frac{${P}}{2} \\cdot \\frac{${Q ** 3}}{3}` },
    { f: "x", g: "\\frac{u + v}{2}", value: F(P * Q * (P + Q), 8), inner: `\\int_0^{${P}} \\int_0^{${Q}} \\frac{u + v}{2} \\cdot \\frac12 \\, dv \\, du = \\frac14\\left(\\frac{${P * P} \\cdot ${Q}}{2} + \\frac{${P} \\cdot ${Q * Q}}{2}\\right)` },
  ];
  const item = r.pick(items);
  return {
    prompt: md`Let $R$ be the parallelogram with vertices $(0, 0)$, $(${P / 2}, ${P / 2})$, $(${(P + Q) / 2}, ${(P - Q) / 2})$ and $(${Q / 2}, ${-Q / 2})$. Use $u = x + y$, $v = x - y$ to work out $\iint_R ${item.f} \, dA$. Give the exact value.`,
    answer: ftext(item.value),
    simplified: true,
    figure: parallelogram(P, Q),
    hint: md`The sides of $R$ lie on $x + y = 0$, $x + y = ${P}$, $x - y = 0$ and $x - y = ${Q}$, so in $uv$-coordinates $R$ is the rectangle $0 \le u \le ${P}$, $0 \le v \le ${Q}$. Solve for $x, y$ in terms of $u, v$ to get the Jacobian.`,
    solution: [
      { math: `x = \\frac{u + v}{2}, \\quad y = \\frac{u - v}{2}, \\quad \\frac{\\partial(x, y)}{\\partial(u, v)} = \\begin{vmatrix} \\frac12 & \\frac12 \\\\ \\frac12 & -\\frac12 \\end{vmatrix} = -\\frac12`, note: md`So $dA = \left|-\frac12\right| du \, dv = \frac12 \, du \, dv$: the map from $uv$ to $xy$ halves areas.` },
      { math: `R \\leftrightarrow S: \; 0 \\le u \\le ${P}, \; 0 \\le v \\le ${Q}`, note: md`Each side of $R$ is a line where $u$ or $v$ is constant. Check the vertices: $(${P / 2}, ${P / 2})$ has $u = ${P}$, $v = 0$.` },
      { math: `\\iint_R ${item.f} \\, dA = ${item.inner} = ${ftex(item.value)}`, note: md`${item.f} becomes $${item.g}$.` },
    ],
  };
};

// ── Figures for the lessons ─────────────────────────────────────────────────

/** A polar rectangle: between two circles and two rays, with a slider for its angular width. */
const polarRectangle: Block = {
  kind: "diagram",
  view: [-0.5, 4.2, -0.5, 3.6],
  points: [
    { name: "O", x: 0, y: 0, dir: "sw" },
    { name: "A", x: "2cos(0.4)", y: "2sin(0.4)", label: "", hidden: true },
    { name: "B", x: "3cos(0.4)", y: "3sin(0.4)", label: "", hidden: true },
    { name: "C", x: "3cos(0.4 + w)", y: "3sin(0.4 + w)", label: "", hidden: true },
    { name: "D", x: "2cos(0.4 + w)", y: "2sin(0.4 + w)", label: "", hidden: true },
    { name: "X", x: 4, y: 0, label: "", hidden: true },
    { name: "E1", x: 3.9, y: 0, label: "", hidden: true },
    { name: "E2", x: "3.9cos(0.4)", y: "3.9sin(0.4)", label: "", hidden: true },
  ],
  polygons: [{ points: ["A", "B", "C", "D"], fill: 1 }],
  segments: [
    { from: "O", to: "B", kind: "ray", dashed: true },
    { from: "O", to: "C", kind: "ray", dashed: true },
    { from: "O", to: "X" },
    { from: "A", to: "B", label: "\\Delta r", color: 2 },
    { from: "D", to: "C", color: 2 },
  ],
  arcs: [
    { center: "O", from: "B", to: "C", color: 2 },
    { center: "O", from: "A", to: "D", color: 2 },
    { center: "O", from: "E1", to: "E2", dashed: true },
  ],
  angles: [{ at: "O", from: "C", to: "B", label: "\\Delta\\theta" }],
  labels: [{ x: 0.9, y: 0.12, text: "\\theta_1" }],
  params: [{ name: "w", tex: "\\Delta\\theta", min: 0.1, max: 1.2, step: 0.05, value: 0.6 }],
  readouts: [
    { label: "\\tfrac12(3^2 - 2^2)\\,\\Delta\\theta", value: "0.5 (9 - 4) w" },
    { label: "\\bar r\\,\\Delta r\\,\\Delta\\theta", value: "2.5 (1) w" },
  ],
  caption: md`A polar rectangle: $2 \le r \le 3$, $\theta_1 \le \theta \le \theta_1 + \Delta\theta$. Its area is the difference of two sectors, $\frac12 (3^2 - 2^2)\Delta\theta$, which equals $\bar r \, \Delta r \, \Delta\theta$ with $\bar r = 2.5$ the middle radius. Drag $\Delta\theta$: the two readouts always agree.`,
};

/** Cross-section of spherical coordinates in the vertical half-plane through a point. */
const sphericalSlice: Block = {
  kind: "diagram",
  view: [-0.5, 4.2, -0.5, 4],
  points: [
    { name: "O", x: 0, y: 0, dir: "sw" },
    { name: "Z", x: 0, y: 3.8, label: "z", dir: "n" },
    { name: "H", x: 4, y: 0, label: "r", dir: "e" },
    { name: "P", x: "3sin(p)", y: "3cos(p)", dir: "ne" },
    { name: "Q", x: 0, y: "3cos(p)", label: "", hidden: true },
    { name: "F", x: "3sin(p)", y: 0, label: "", hidden: true },
    { name: "T", x: 0, y: 3, label: "", hidden: true },
    { name: "P2", x: "3sin(p + 0.25)", y: "3cos(p + 0.25)", label: "", hidden: true },
    { name: "P3", x: "3.5sin(p)", y: "3.5cos(p)", label: "", hidden: true },
  ],
  segments: [
    { from: "O", to: "Z", kind: "segment" },
    { from: "O", to: "H" },
    { from: "O", to: "P", label: "\\rho", color: 1 },
    { from: "P", to: "Q", dashed: true, label: "\\rho\\sin\\varphi" },
    { from: "P", to: "F", dashed: true, label: "\\rho\\cos\\varphi" },
    { from: "P", to: "P3", color: 2, label: "\\Delta\\rho" },
  ],
  arcs: [{ center: "O", from: "P", to: "P2", color: 2 }],
  angles: [{ at: "O", from: "Z", to: "P", label: "\\varphi" }],
  labels: [{ x: "3.2sin(p + 0.12) + 0.25", y: "3.2cos(p + 0.12) + 0.15", text: "\\rho\\,\\Delta\\varphi" }],
  params: [{ name: "p", tex: "\\varphi", min: 0.15, max: 1.4, step: 0.05, value: 0.7 }],
  caption: md`The half-plane containing the $z$-axis and the point $P$. Here $\rho = 3$ is the distance from the origin and $\varphi$ is the angle down from the $z$-axis. Increasing $\rho$ by $\Delta\rho$ moves $P$ straight out (orange segment); increasing $\varphi$ by $\Delta\varphi$ swings it along an arc of length $\rho\,\Delta\varphi$. The third direction, $\theta$, turns this whole half-plane about the $z$-axis, moving $P$ along a horizontal circle of radius $\rho\sin\varphi$.`,
};

/** The unit square in the uv-plane and its image parallelogram under x = u + v, y = u - v... drawn side by side as two figures. */
const uvSquare: Block = {
  kind: "diagram",
  view: [-0.6, 2.2, -0.6, 2.2],
  grid: true,
  points: [
    { name: "O", x: 0, y: 0, label: "(0, 0)", dir: "sw" },
    { name: "A", x: 1, y: 0, label: "(1, 0)", dir: "se" },
    { name: "B", x: 1, y: 1, label: "(1, 1)", dir: "ne" },
    { name: "C", x: 0, y: 1, label: "(0, 1)", dir: "nw" },
    { name: "M", x: "a", y: "b", label: "(u, v)", dir: "ne" },
  ],
  polygons: [{ points: ["O", "A", "B", "C"], fill: 1 }],
  params: [
    { name: "a", tex: "u", min: 0, max: 1, step: 0.05, value: 0.4 },
    { name: "b", tex: "v", min: 0, max: 1, step: 0.05, value: 0.7 },
  ],
  caption: md`The unit square $S$ in the $uv$-plane. Move the point $(u, v)$ and watch where it lands in the next figure.`,
};

const xyParallelogram: Block = {
  kind: "diagram",
  view: [-0.6, 4.4, -1.6, 3.4],
  grid: true,
  points: [
    { name: "O", x: 0, y: 0, label: "(0, 0)", dir: "sw" },
    { name: "A", x: 2, y: 1, label: "(2, 1)", dir: "se" },
    { name: "B", x: 3, y: 3, label: "(3, 3)", dir: "ne" },
    { name: "C", x: 1, y: 2, label: "(1, 2)", dir: "nw" },
    { name: "M", x: "2a + b", y: "a + 2b", label: "(x, y)", dir: "ne" },
  ],
  polygons: [{ points: ["O", "A", "B", "C"], fill: 2 }],
  segments: [
    { from: "O", to: "A", arrow: true, color: 2, label: "\\langle 2, 1 \\rangle" },
    { from: "O", to: "C", arrow: true, color: 2, label: "\\langle 1, 2 \\rangle" },
  ],
  params: [
    { name: "a", tex: "u", min: 0, max: 1, step: 0.05, value: 0.4 },
    { name: "b", tex: "v", min: 0, max: 1, step: 0.05, value: 0.7 },
  ],
  readouts: [
    { label: "x = 2u + v", value: "2a + b" },
    { label: "y = u + 2v", value: "a + 2b" },
  ],
  caption: md`The image $R = T(S)$ under $x = 2u + v$, $y = u + 2v$: a parallelogram spanned by $T(1, 0) = (2, 1)$ and $T(0, 1) = (1, 2)$. Its area is $|2 \cdot 2 - 1 \cdot 1| = 3$ times the area of $S$. That $3$ is the Jacobian.`,
};

// ── The unit ────────────────────────────────────────────────────────────────

export const unit4: Unit = {
  title: "Multiple Integrals",
  lessons: [
    {
      id: slug("Double integrals"),
      title: "Double integrals",
      summary: "The double integral as a limit of Riemann sums over a grid; volume under a surface; Fubini's theorem turns it into two single integrals, over rectangles and then over regions with curved edges, where the order of integration can matter a great deal.",
      blocks: [
        {
          kind: "text",
          body: md`In Calculus 1 the definite integral $\int_a^b f(x) \, dx$ was built from thin rectangles: cut $[a, b]$ into pieces, multiply each piece's width by a height of $f$, add, and take the limit. The answer was the signed area under the graph.

Now let $f(x, y)$ be a function of two variables on a rectangle $R = [a, b] \times [c, d]$ in the plane. Its graph $z = f(x, y)$ is a surface, and the natural question is the **volume** between the surface and the rectangle. The same construction answers it. Cut $[a, b]$ into $m$ pieces of width $\Delta x$ and $[c, d]$ into $n$ pieces of width $\Delta y$. That chops $R$ into $mn$ small rectangles $R_{ij}$, each of area $\Delta A = \Delta x \, \Delta y$. Pick a sample point $(x_{ij}^*, y_{ij}^*)$ in each, and stand a box on $R_{ij}$ of height $f(x_{ij}^*, y_{ij}^*)$. The boxes together approximate the solid, and the approximation improves as the grid gets finer.`,
        },
        {
          kind: "key",
          title: "The double integral",
          body: md`$$\iint_R f(x, y) \, dA = \lim_{m, n \to \infty} \sum_{i = 1}^{m} \sum_{j = 1}^{n} f(x_{ij}^*, y_{ij}^*) \, \Delta A,$$

when the limit exists and is the same for every choice of sample points. It does for every continuous $f$. When $f \ge 0$ it is the volume under the surface $z = f(x, y)$ over $R$; in general it counts volume below the $xy$-plane as negative, just as a single integral counts area below the axis as negative. And $\iint_R 1 \, dA$ is the area of $R$: boxes of height 1 have volume equal to their base.`,
        },
        {
          kind: "surface",
          x: [0, 2],
          y: [0, 3],
          z: [0, 16],
          expr: "16 - x^2 - y^2",
          caption: md`The surface $z = 16 - x^2 - y^2$ over the rectangle $[0, 2] \times [0, 3]$. The double integral is the volume of the solid between this roof and the floor $z = 0$. Turn it to see the roof is curved in both directions.`,
        },
        {
          kind: "why",
          title: "Why slicing turns the volume into two single integrals",
          body: md`Take the solid under $z = f(x, y)$ over $R = [a, b] \times [c, d]$ and slice it with the vertical plane $x = x_0$. The slice is a flat region: it sits under the curve $z = f(x_0, y)$ for $c \le y \le d$. Its area is a Calculus 1 integral in which $x_0$ is just a constant:

$$A(x_0) = \int_c^d f(x_0, y) \, dy.$$

Now use the cross-section formula from Calculus 2: a solid whose cross-sectional area at $x$ is $A(x)$ has volume $\int_a^b A(x) \, dx$. (Thin slabs of thickness $\Delta x$ and face area $A(x_i)$ have volume $A(x_i)\Delta x$; sum and take the limit.) Putting the two together,

$$V = \int_a^b \left( \int_c^d f(x, y) \, dy \right) dx.$$

Slicing with planes $y = y_0$ instead gives $\int_c^d \left( \int_a^b f(x, y) \, dx \right) dy$. Same solid, same volume, so the two orders agree. The Riemann sum says the same thing: $\sum_i \sum_j f \, \Delta x \, \Delta y$ can be summed over $j$ first (one slab) or over $i$ first, and addition doesn't care about the order.`,
        },
        {
          kind: "key",
          title: "Fubini's theorem (rectangles)",
          body: md`If $f$ is continuous on $R = [a, b] \times [c, d]$, then

$$\iint_R f(x, y) \, dA = \int_a^b \int_c^d f(x, y) \, dy \, dx = \int_c^d \int_a^b f(x, y) \, dx \, dy.$$

Read an **iterated integral** from the inside out: the inner integral is done first, treating the outer variable as a constant, and leaves a function of the outer variable alone. The limits match the differentials in order: in $\int_a^b \int_c^d \ldots dy \, dx$, the $y$ limits are $c$ to $d$ (inner) and the $x$ limits $a$ to $b$ (outer).`,
        },
        {
          kind: "proof",
          title: "A product integrand factors",
          given: md`$f(x, y) = g(x) h(y)$ with $g$ continuous on $[a, b]$ and $h$ continuous on $[c, d]$`,
          prove: md`$\iint_R g(x) h(y) \, dA = \left( \int_a^b g(x) \, dx \right) \left( \int_c^d h(y) \, dy \right)$`,
          steps: [
            { statement: md`$\sum_{i} \sum_{j} g(x_i) h(y_j) \, \Delta x \, \Delta y = \sum_{i} g(x_i) \Delta x \left( \sum_{j} h(y_j) \Delta y \right)$`, reason: md`Take sample points $(x_i, y_j)$ on the grid. For fixed $i$, $g(x_i)\Delta x$ is a common factor of the inner sum; pull it out` },
            { statement: md`$= \left( \sum_{i} g(x_i) \Delta x \right) \left( \sum_{j} h(y_j) \Delta y \right)$`, reason: md`The inner sum no longer depends on $i$, so it is a common factor of the outer sum` },
            { statement: md`$\to \left( \int_a^b g \, dx \right) \left( \int_c^d h \, dy \right)$ as $m, n \to \infty$`, reason: md`Each factor is a Riemann sum for a single integral (Calculus 1), and the limit of a product is the product of the limits` },
            { statement: md`The left side tends to $\iint_R g(x) h(y) \, dA$`, reason: md`Definition of the double integral; $gh$ is continuous, so the limit exists` },
          ],
        },
        {
          kind: "example",
          title: "An iterated integral over a rectangle",
          problem: md`Find $\iint_R (6xy^2 - 2x) \, dA$ for $R = [0, 2] \times [1, 3]$.`,
          steps: [
            { math: md`\int_0^2 \int_1^3 (6xy^2 - 2x) \, dy \, dx`, note: md`Choose an order. Inner in $y$ from 1 to 3, outer in $x$ from 0 to 2.` },
            { math: md`\int_1^3 (6xy^2 - 2x) \, dy = \left[2xy^3 - 2xy\right]_{y = 1}^{y = 3} = (54x - 6x) - (2x - 2x) = 48x`, note: md`$x$ is a constant here. The result is a function of $x$ only, as it must be.` },
            { math: md`\int_0^2 48x \, dx = \left[24x^2\right]_0^2 = 96`, note: "The outer integral finishes it." },
            { math: md`\int_1^3 \int_0^2 (6xy^2 - 2x) \, dx \, dy = \int_1^3 (12y^2 - 4) \, dy = \left[4y^3 - 4y\right]_1^3 = 96`, note: "The other order gives the same number, as Fubini promises." },
          ],
        },
        {
          kind: "check",
          prompt: md`Work out $\iint_R (x + 2y) \, dA$ for $R = [0, 1] \times [0, 2]$.`,
          answer: "5",
          explain: md`$\int_0^2 (x + 2y) \, dy = 2x + 4$, and $\int_0^1 (2x + 4) \, dx = 1 + 4 = 5$.`,
        },
        {
          kind: "text",
          body: md`Most regions aren't rectangles. Let $D$ be a bounded region with a reasonable boundary. Put it inside a rectangle $R$ and define $F(x, y) = f(x, y)$ on $D$ and $F = 0$ off $D$. Then

$$\iint_D f \, dA = \iint_R F \, dA.$$

The boxes outside $D$ have height 0 and contribute nothing, so this is the volume over $D$ alone. The payoff comes when $D$ is described by inequalities, because then the zero region can be dropped from the inner integral by shrinking its limits.

A **type I** region lies between two curves $y = g_1(x)$ and $y = g_2(x)$ for $a \le x \le b$. A vertical strip at $x$ enters $D$ at height $g_1(x)$ and leaves at $g_2(x)$, so the inner integral in $y$ runs between those heights, and they depend on $x$. A **type II** region lies between $x = h_1(y)$ and $x = h_2(y)$ for $c \le y \le d$, and horizontal strips do the same job.`,
        },
        {
          kind: "diagram",
          view: [-0.5, 2.8, -0.5, 4.8],
          grid: true,
          points: [
            ...curvePts("P", (x) => x * x, 0, 2, 12).points,
            { name: "O", x: 0, y: 0, label: "" },
            { name: "T", x: 2, y: 4, label: "(2, 4)", dir: "e" },
            { name: "L", x: "a", y: "a^2", label: "(x, x^2)", dir: "se" },
            { name: "U", x: "a", y: "2a", label: "(x, 2x)", dir: "nw" },
          ],
          polygons: [{ points: curvePts("P", (x) => x * x, 0, 2, 12).names, fill: 1 }],
          segments: [
            { from: "O", to: "T", color: 2, label: "y = 2x" },
            { from: "L", to: "U", color: 4 },
          ],
          labels: [{ x: 1.9, y: 2.3, text: "y = x^2" }],
          params: [{ name: "a", tex: "x", min: 0.1, max: 1.9, step: 0.05, value: 1.2 }],
          readouts: [{ label: "\\text{strip length } 2x - x^2", value: "2a - a^2" }],
          caption: md`The region between $y = x^2$ and $y = 2x$ is type I: for each $x$ in $[0, 2]$ the vertical strip runs from $x^2$ up to $2x$. Those are the inner limits. The outer limits $0$ and $2$ are where the curves cross.`,
        },
        {
          kind: "key",
          title: "Double integrals over general regions",
          body: md`Type I, $D = \{(x, y) : a \le x \le b, \; g_1(x) \le y \le g_2(x)\}$:
$$\iint_D f \, dA = \int_a^b \int_{g_1(x)}^{g_2(x)} f(x, y) \, dy \, dx.$$

Type II, $D = \{(x, y) : c \le y \le d, \; h_1(y) \le x \le h_2(y)\}$:
$$\iint_D f \, dA = \int_c^d \int_{h_1(y)}^{h_2(y)} f(x, y) \, dx \, dy.$$

The inner limits may contain the outer variable; the outer limits are numbers. After the inner integral, no trace of the inner variable may remain.`,
        },
        {
          kind: "why",
          title: "Why the inner limits are functions",
          body: md`Apply the slicing argument to $F$ on the big rectangle. At a fixed $x$, the cross-section is $\int_c^d F(x, y) \, dy$. But $F(x, y)$ is zero unless $g_1(x) \le y \le g_2(x)$, so the integral collapses to $\int_{g_1(x)}^{g_2(x)} f(x, y) \, dy$: the area of the slice through the solid at that $x$, which is exactly the part between the two boundary curves. Integrate those slice areas from $a$ to $b$ and you have the volume.

The order matters now. Slicing a type I region with horizontal lines may hit the boundary in a way that changes formula partway, needing two integrals; vertical slicing needs one. Choose the direction whose strips always run from one single formula to another.`,
        },
        {
          kind: "example",
          title: "Between a parabola and a line",
          problem: md`Find $\iint_D xy \, dA$, where $D$ is bounded by $y = x^2$ and $y = 2x$.`,
          steps: [
            { math: md`x^2 = 2x \;\Rightarrow\; x = 0, \; 2`, note: md`Find where the curves cross: these are the outer limits. Between them the line is above the parabola (test $x = 1$: $2 > 1$).` },
            { math: md`\iint_D xy \, dA = \int_0^2 \int_{x^2}^{2x} xy \, dy \, dx`, note: "Type I: vertical strips from the parabola to the line." },
            { math: md`\int_{x^2}^{2x} xy \, dy = x\left[\frac{y^2}{2}\right]_{x^2}^{2x} = \frac{x}{2}\left(4x^2 - x^4\right) = 2x^3 - \frac{x^5}{2}`, note: md`Inner integral. Substituting $y = 2x$ and $y = x^2$ leaves a function of $x$.` },
            { math: md`\int_0^2 \left(2x^3 - \frac{x^5}{2}\right) dx = \left[\frac{x^4}{2} - \frac{x^6}{12}\right]_0^2 = 8 - \frac{16}{3} = \frac{8}{3}`, note: "" },
          ],
        },
        {
          kind: "example",
          title: "Reversing the order to make an integral possible",
          problem: md`Find $\int_0^1 \int_x^1 e^{y^2} \, dy \, dx$.`,
          steps: [
            { math: md`\int e^{y^2} \, dy \text{ has no elementary antiderivative}`, note: "As written, the inner integral can't be done. Don't give up: change how the region is sliced." },
            { math: md`D = \{0 \le x \le 1, \; x \le y \le 1\} = \{0 \le y \le 1, \; 0 \le x \le y\}`, note: md`Sketch it: the triangle with vertices $(0, 0)$, $(1, 1)$, $(0, 1)$. Horizontal strips at height $y$ run from $x = 0$ to $x = y$.` },
            { math: md`\int_0^1 \int_0^y e^{y^2} \, dx \, dy = \int_0^1 y e^{y^2} \, dy`, note: md`Now the inner integrand is constant in $x$: it just gets multiplied by the strip length $y$.` },
            { math: md`= \left[\frac{1}{2} e^{y^2}\right]_0^1 = \frac{e - 1}{2}`, note: md`The extra factor $y$ is exactly what the substitution $u = y^2$ needs.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Work out $\int_0^1 \int_0^{x} 2y \, dy \, dx$.`,
          answer: "1/3",
          explain: md`Inner: $\left[y^2\right]_0^x = x^2$. Outer: $\int_0^1 x^2 \, dx = \frac13$.`,
        },
      ],
      practice: [innerIntegral, rectangleIntegral, regionLimits, regionIntegral],
    },
    {
      id: slug("Double integrals in polar coordinates"),
      title: "Double integrals in polar coordinates",
      summary: "Circular regions are awkward in x and y and simple in r and theta. Deriving the area element dA = r dr dtheta from the area of a polar rectangle, then volumes, areas of polar curves and the Gaussian integral.",
      blocks: [
        {
          kind: "text",
          body: md`Try to integrate over the disk $x^2 + y^2 \le 4$ with vertical strips. The strip at $x$ runs from $-\sqrt{4 - x^2}$ to $\sqrt{4 - x^2}$; the limits are square roots, and the integrand usually gets worse after the first integration. The disk is simple in **polar coordinates**: it is $0 \le r \le 2$, $0 \le \theta \le 2\pi$, a rectangle in the $r\theta$-plane.

Recall from Trigonometry: $x = r\cos\theta$, $y = r\sin\theta$, $r^2 = x^2 + y^2$. A **polar rectangle** $\{a \le r \le b, \; \alpha \le \theta \le \beta\}$ is the region between two circles and two rays. To integrate over it we need the area of a small polar rectangle, and it is not $\Delta r \, \Delta\theta$.`,
        },
        polarRectangle,
        {
          kind: "why",
          title: "Why dA = r dr dθ",
          body: md`A sector of a circle of radius $r$ with angle $\Delta\theta$ has area $\frac{1}{2} r^2 \Delta\theta$: it is the fraction $\frac{\Delta\theta}{2\pi}$ of the whole disk $\pi r^2$ (Geometry). The polar rectangle between radii $r_1$ and $r_2 = r_1 + \Delta r$ is a big sector minus a small one:

$$\Delta A = \tfrac{1}{2} r_2^2 \Delta\theta - \tfrac{1}{2} r_1^2 \Delta\theta = \tfrac{1}{2}(r_2 + r_1)(r_2 - r_1) \Delta\theta = \bar r \, \Delta r \, \Delta\theta,$$

where $\bar r = \frac{r_1 + r_2}{2}$ is the middle radius. So the piece is like a rectangle with sides $\Delta r$ and $\bar r \Delta\theta$: the arc is longer the farther out you are. In a Riemann sum over a polar grid, sample each piece at its middle radius:

$$\sum \sum f(\bar r_i \cos\bar\theta_j, \bar r_i \sin\bar\theta_j) \, \bar r_i \, \Delta r \, \Delta\theta.$$

This is a Riemann sum for the function $f(r\cos\theta, r\sin\theta) \, r$ over the ordinary rectangle $[a, b] \times [\alpha, \beta]$ in the $r\theta$-plane, and it converges to that double integral. The extra factor $r$ is the price of using coordinates whose grid cells grow with $r$.`,
        },
        {
          kind: "key",
          title: "Double integrals in polar coordinates",
          body: md`If $f$ is continuous on the polar rectangle $R = \{a \le r \le b, \; \alpha \le \theta \le \beta\}$ with $0 \le \beta - \alpha \le 2\pi$,

$$\iint_R f(x, y) \, dA = \int_\alpha^\beta \int_a^b f(r\cos\theta, r\sin\theta) \, r \, dr \, d\theta.$$

More generally, over $D = \{\alpha \le \theta \le \beta, \; h_1(\theta) \le r \le h_2(\theta)\}$ the inner limits are $h_1(\theta)$ to $h_2(\theta)$. Three things to do every time: convert the integrand, convert the region, and put in the $r$.`,
        },
        {
          kind: "example",
          title: "An integral over a disk",
          problem: md`Find $\iint_D (x^2 + y^2) \, dA$ where $D$ is the disk $x^2 + y^2 \le 4$.`,
          steps: [
            { math: md`D: \; 0 \le r \le 2, \quad 0 \le \theta \le 2\pi`, note: "Convert the region." },
            { math: md`x^2 + y^2 = r^2, \qquad dA = r \, dr \, d\theta`, note: "Convert the integrand, and add the r." },
            { math: md`\int_0^{2\pi} \int_0^2 r^2 \cdot r \, dr \, d\theta = \int_0^{2\pi} \left[\frac{r^4}{4}\right]_0^2 d\theta = \int_0^{2\pi} 4 \, d\theta = 8\pi`, note: md`Nothing depends on $\theta$, so the outer integral is just a multiplication by $2\pi$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Work out $\iint_D y \, dA$ where $D$ is the half disk $x^2 + y^2 \le 4$, $y \ge 0$. (Hint: $y = r\sin\theta$ and $0 \le \theta \le \pi$.)`,
          answer: "16/3",
          explain: md`$\int_0^{\pi} \int_0^2 r\sin\theta \cdot r \, dr \, d\theta = \int_0^{\pi} \frac{8}{3}\sin\theta \, d\theta = \frac{8}{3} \cdot 2 = \frac{16}{3}$.`,
        },
        {
          kind: "example",
          title: "Volume under a paraboloid",
          problem: md`Find the volume of the solid under $z = 9 - x^2 - y^2$ and above the $xy$-plane.`,
          steps: [
            { math: md`9 - x^2 - y^2 \ge 0 \iff r \le 3`, note: "The solid stands over the disk where the roof is above the floor." },
            { math: md`V = \int_0^{2\pi} \int_0^3 (9 - r^2) \, r \, dr \, d\theta`, note: md`Height $9 - r^2$, area element $r \, dr \, d\theta$.` },
            { math: md`\int_0^3 (9r - r^3) \, dr = \frac{81}{2} - \frac{81}{4} = \frac{81}{4}`, note: "" },
            { math: md`V = 2\pi \cdot \frac{81}{4} = \frac{81\pi}{2}`, note: md`Exactly half the cylinder of radius 3 and height 9 around it. A paraboloid always fills half its cylinder.` },
          ],
        },
        {
          kind: "surface",
          x: [-3, 3],
          y: [-3, 3],
          z: [0, 9],
          expr: "9 - x^2 - y^2",
          caption: md`The paraboloid $z = 9 - x^2 - y^2$. Its level curves are circles, which is why polar coordinates fit: along each circle $r = \text{const}$ the height is constant.`,
        },
        {
          kind: "plot",
          x: [-1.5, 4.5],
          y: [-3, 3],
          parametric: [
            { x: "(1 + cos(t)) cos(t)", y: "(1 + cos(t)) sin(t)", t: [0, 2 * Math.PI], label: "r = 1 + \\cos\\theta", color: 1 },
            { x: "t (1 + cos(a)) cos(a)", y: "t (1 + cos(a)) sin(a)", t: [0, 1], color: 2 },
          ],
          points: [{ x: "(1 + cos(a)) cos(a)", y: "(1 + cos(a)) sin(a)", label: "r = {=1 + cos(a)}", color: 2 }],
          params: [{ name: "a", tex: "\\theta", min: 0, max: 6.28, step: 0.05, value: 0.9 }],
          caption: md`The cardioid $r = 1 + \cos\theta$. Drag $\theta$: the orange segment is the ray from the origin to the curve, of length $r(\theta)$. The area inside is $\iint 1 \, dA$ with $r$ running from $0$ to $1 + \cos\theta$ on each ray.`,
        },
        {
          kind: "proof",
          title: "Area inside a polar curve",
          given: md`A region $D = \{\alpha \le \theta \le \beta, \; 0 \le r \le h(\theta)\}$ with $h$ continuous and $\beta - \alpha \le 2\pi$`,
          prove: md`$\text{Area}(D) = \int_\alpha^\beta \tfrac{1}{2} h(\theta)^2 \, d\theta$`,
          steps: [
            { statement: md`$\text{Area}(D) = \iint_D 1 \, dA$`, reason: "Boxes of height 1 over D have volume equal to the area of D" },
            { statement: md`$= \int_\alpha^\beta \int_0^{h(\theta)} r \, dr \, d\theta$`, reason: md`Polar form of the double integral, with $dA = r \, dr \, d\theta$ and the integrand $1$` },
            { statement: md`$= \int_\alpha^\beta \left[\tfrac{1}{2} r^2\right]_0^{h(\theta)} d\theta = \int_\alpha^\beta \tfrac{1}{2} h(\theta)^2 \, d\theta$`, reason: "Inner integral in r" },
          ],
        },
        {
          kind: "example",
          title: "The area inside the cardioid",
          problem: md`Find the area enclosed by $r = 1 + \cos\theta$.`,
          steps: [
            { math: md`A = \int_0^{2\pi} \tfrac{1}{2}(1 + \cos\theta)^2 \, d\theta = \tfrac{1}{2}\int_0^{2\pi} \left(1 + 2\cos\theta + \cos^2\theta\right) d\theta`, note: "Expand." },
            { math: md`\cos^2\theta = \frac{1 + \cos 2\theta}{2}`, note: "The half-angle identity from Trigonometry." },
            { math: md`A = \tfrac{1}{2}\left(2\pi + 0 + \pi\right) = \frac{3\pi}{2}`, note: md`Over a full period, $\cos\theta$ and $\cos 2\theta$ integrate to zero; the constants $1 + \frac12$ give $\frac32 \cdot 2\pi$.` },
          ],
        },
        {
          kind: "text",
          body: md`One famous integral yields to polar coordinates and nothing else at this level. The function $e^{-x^2}$ has no elementary antiderivative, so $I = \int_{-\infty}^{\infty} e^{-x^2} \, dx$ can't be done directly. But by the product rule for double integrals,

$$I^2 = \int_{-\infty}^{\infty} e^{-x^2} \, dx \int_{-\infty}^{\infty} e^{-y^2} \, dy = \iint_{\mathbb{R}^2} e^{-(x^2 + y^2)} \, dA = \int_0^{2\pi} \int_0^{\infty} e^{-r^2} \, r \, dr \, d\theta.$$

The factor $r$ makes the inner integral a substitution: $\int_0^\infty r e^{-r^2} \, dr = \left[-\frac12 e^{-r^2}\right]_0^\infty = \frac12$. So $I^2 = 2\pi \cdot \frac12 = \pi$ and $I = \sqrt{\pi}$. (The improper integral over the whole plane is the limit over disks of radius $R \to \infty$; the limit exists because the integrand is positive and the disk integrals increase and are bounded.) This is why the normal distribution's density has a $\sqrt{\pi}$ in it.`,
        },
        {
          kind: "check",
          prompt: md`Find the area of the region inside the circle $r = 4\cos\theta$. (The whole circle is traced for $-\pi/2 \le \theta \le \pi/2$.)`,
          answer: "4pi",
          explain: md`$A = \int_{-\pi/2}^{\pi/2} \frac12 (4\cos\theta)^2 \, d\theta = 8 \int_{-\pi/2}^{\pi/2} \cos^2\theta \, d\theta = 8 \cdot \frac{\pi}{2} = 4\pi$. The circle has radius 2, so $\pi r^2 = 4\pi$ agrees.`,
        },
      ],
      practice: [polarCurve, polarIntegral, polarVolumeArea],
    },
    {
      id: slug("Triple integrals"),
      title: "Triple integrals",
      summary: "Integrating over solids: Riemann sums over boxes, mass from density, Fubini for boxes, and solids described as the space between two surfaces over a shadow region in the plane.",
      blocks: [
        {
          kind: "text",
          body: md`Nothing in the definition of the double integral depended on the number two. Let $f(x, y, z)$ be a function on a box $B = [a, b] \times [c, d] \times [p, q]$. Chop each interval, which chops $B$ into small boxes $B_{ijk}$ of volume $\Delta V = \Delta x \, \Delta y \, \Delta z$. Sample $f$ in each, multiply by $\Delta V$, add, and let the grid shrink:

$$\iiint_B f(x, y, z) \, dV = \lim \sum_i \sum_j \sum_k f(x_{ijk}^*, y_{ijk}^*, z_{ijk}^*) \, \Delta V.$$

We can't draw the graph of $f$ (it would need four dimensions), so the volume picture is gone. Two interpretations replace it. If $f = 1$, every term is just $\Delta V$, so $\iiint_B 1 \, dV$ is the **volume** of $B$, and later of any solid $E$. If $f(x, y, z) = \rho(x, y, z)$ is the **density** of a material (mass per unit volume) at each point, then $\rho \, \Delta V$ is approximately the mass of a small box, and the triple integral is the total **mass**.`,
        },
        {
          kind: "key",
          title: "Fubini's theorem (boxes)",
          body: md`If $f$ is continuous on $B = [a, b] \times [c, d] \times [p, q]$,

$$\iiint_B f \, dV = \int_a^b \int_c^d \int_p^q f(x, y, z) \, dz \, dy \, dx,$$

and the same in any of the other five orders. Work from the inside out: the innermost integral treats the two outer variables as constants and removes its own.`,
        },
        {
          kind: "why",
          title: "Why Fubini still works",
          body: md`The slicing argument runs the same way, one dimension up. Fix $x$ and $y$. The innermost sum $\sum_k f(x, y, z_k) \Delta z$ is a Riemann sum for $g(x, y) = \int_p^q f(x, y, z) \, dz$, a function of two variables. The remaining double sum $\sum_i \sum_j g(x_i, y_j) \Delta x \, \Delta y$ is a Riemann sum for $\iint_R g \, dA$ over the rectangle $R = [a, b] \times [c, d]$, which the last lesson turns into two single integrals. Addition is indifferent to the order of summation, so any of the six orders gives the same limit.`,
        },
        {
          kind: "example",
          title: "A triple integral over a box",
          problem: md`Find $\iiint_B xyz^2 \, dV$ for $B = [0, 1] \times [0, 2] \times [0, 3]$.`,
          steps: [
            { math: md`\int_0^1 \int_0^2 \int_0^3 xyz^2 \, dz \, dy \, dx`, note: md`Innermost in $z$ from 0 to 3, then $y$ from 0 to 2, then $x$ from 0 to 1.` },
            { math: md`\int_0^3 xyz^2 \, dz = xy\left[\frac{z^3}{3}\right]_0^3 = 9xy`, note: md`$x$ and $y$ are constants here.` },
            { math: md`\int_0^2 9xy \, dy = 9x \cdot 2 = 18x`, note: "" },
            { math: md`\int_0^1 18x \, dx = 9`, note: md`Or all at once: the integrand is a product, so the answer is $\int_0^1 x \, dx \int_0^2 y \, dy \int_0^3 z^2 \, dz = \frac12 \cdot 2 \cdot 9 = 9$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Work out $\iiint_B (x + y + z) \, dV$ for $B = [0, 1] \times [0, 1] \times [0, 2]$.`,
          answer: "4",
          explain: md`Innermost: $\int_0^2 (x + y + z) \, dz = 2x + 2y + 2$. Then $\int_0^1 (2x + 2y + 2) \, dy = 2x + 3$, and $\int_0^1 (2x + 3) \, dx = 4$.`,
        },
        {
          kind: "text",
          body: md`For a general solid $E$, enclose it in a box and extend $f$ by zero, exactly as for regions in the plane. The useful case is a solid that lies **between two surfaces** over a region $D$ in the $xy$-plane:

$$E = \{(x, y, z) : (x, y) \in D, \; u_1(x, y) \le z \le u_2(x, y)\}.$$

Think of $D$ as the solid's **shadow** when the sun is directly overhead. A vertical line through a point $(x, y)$ of the shadow enters the solid at the floor $z = u_1(x, y)$ and leaves at the roof $z = u_2(x, y)$. Those are the $z$ limits, and they are functions of $x$ and $y$. What's left after the $z$ integral is a double integral over $D$, which the first lesson handles.`,
        },
        {
          kind: "key",
          title: "Triple integrals over solids",
          body: md`If $E$ lies between $z = u_1(x, y)$ and $z = u_2(x, y)$ over the plane region $D$,

$$\iiint_E f \, dV = \iint_D \left[ \int_{u_1(x, y)}^{u_2(x, y)} f(x, y, z) \, dz \right] dA.$$

In particular, with $f = 1$, $\text{Vol}(E) = \iint_D \left[u_2(x, y) - u_1(x, y)\right] dA$: the triple integral recovers the "roof minus floor" formula for volume. The roles of the axes can be swapped: a solid can also be described as lying between two surfaces $y = \ldots$ over its shadow on the $xz$-plane, or $x = \ldots$ over its shadow on the $yz$-plane.`,
        },
        {
          kind: "why",
          title: "Why the z integral comes out as roof minus floor",
          body: md`Approximate $E$ by thin vertical columns, one over each small rectangle of the shadow $D$. The column over $(x, y)$ runs from $u_1$ to $u_2$, so it has height $u_2 - u_1$ and volume $(u_2 - u_1)\Delta A$. Summing the columns and refining gives $\iint_D (u_2 - u_1) \, dA$, the volume formula.

A triple integral says the same thing with one more step. Cut each column into little cubes of height $\Delta z$. Summing $f \, \Delta z$ up the column is a Riemann sum for $\int_{u_1}^{u_2} f \, dz$; when $f = 1$ that is just the column's height. Then summing over the columns is the double integral. So the triple integral is not a new idea, only a new bookkeeping: first stack, then sweep.`,
        },
        {
          kind: "surface",
          x: [0, 2],
          y: [0, 4],
          z: [0, 4],
          expr: "4 - 2x - y",
          caption: md`The roof $z = 4 - 2x - y$ over the rectangle $[0, 2] \times [0, 4]$. The tetrahedron in the example below is the part of the solid under this plane where the roof is above the floor $z = 0$, that is, over the triangle $2x + y \le 4$.`,
        },
        {
          kind: "diagram",
          view: [-0.5, 2.8, -0.5, 4.8],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "" },
            { name: "A", x: 2, y: 0, label: "(2, 0)", dir: "se" },
            { name: "B", x: 0, y: 4, label: "(0, 4)", dir: "nw" },
            { name: "L", x: "a", y: 0, label: "", hidden: true },
            { name: "U", x: "a", y: "4 - 2a", label: "(x, 4 - 2x)", dir: "ne" },
          ],
          polygons: [{ points: ["O", "A", "B"], fill: 1 }],
          segments: [
            { from: "A", to: "B", color: 2, label: "2x + y = 4" },
            { from: "L", to: "U", color: 4 },
          ],
          params: [{ name: "a", tex: "x", min: 0.1, max: 1.9, step: 0.05, value: 0.8 }],
          caption: md`The shadow $D$ of the tetrahedron: the triangle where $z = 4 - 2x - y \ge 0$. For each $x$ in $[0, 2]$, $y$ runs from $0$ to $4 - 2x$. Above each point of $D$, $z$ runs from $0$ to $4 - 2x - y$.`,
        },
        {
          kind: "example",
          title: "The volume of a tetrahedron",
          problem: md`Find the volume of the tetrahedron bounded by the coordinate planes and the plane $2x + y + z = 4$.`,
          steps: [
            { math: md`0 \le z \le 4 - 2x - y`, note: md`Floor $z = 0$, roof the plane solved for $z$.` },
            { math: md`D: \; 0 \le x \le 2, \quad 0 \le y \le 4 - 2x`, note: md`The shadow is where the roof meets the floor: set $z = 0$ to get the edge $2x + y = 4$, which meets the axes at $x = 2$ and $y = 4$.` },
            { math: md`V = \int_0^2 \int_0^{4 - 2x} \int_0^{4 - 2x - y} dz \, dy \, dx = \int_0^2 \int_0^{4 - 2x} (4 - 2x - y) \, dy \, dx`, note: "The innermost integral gives the height of the column." },
            { math: md`\int_0^{4 - 2x} (4 - 2x - y) \, dy = \left[(4 - 2x)y - \frac{y^2}{2}\right]_0^{4 - 2x} = \frac{(4 - 2x)^2}{2}`, note: md`A linear function that reaches 0 at the top limit: half the base times the height.` },
            { math: md`V = \int_0^2 \frac{(4 - 2x)^2}{2} \, dx = \left[-\frac{(4 - 2x)^3}{12}\right]_0^2 = \frac{64}{12} = \frac{16}{3}`, note: md`Check with Geometry: $\frac13 \cdot \text{base} \cdot \text{height} = \frac13 \cdot \frac12 (2)(4) \cdot 4 = \frac{16}{3}$.` },
          ],
        },
        {
          kind: "proof",
          title: "The volume of a tetrahedron with intercepts a, b, c",
          given: md`$a, b, c > 0$, and $E$ the tetrahedron cut from the first octant by the plane $\frac{x}{a} + \frac{y}{b} + \frac{z}{c} = 1$`,
          prove: md`$\text{Vol}(E) = \frac{abc}{6}$`,
          steps: [
            { statement: md`$E = \{0 \le x \le a, \; 0 \le y \le b(1 - \tfrac{x}{a}), \; 0 \le z \le c(1 - \tfrac{x}{a} - \tfrac{y}{b})\}$`, reason: md`Solve the plane for $z$ (the roof); its trace in $z = 0$ is $\frac{x}{a} + \frac{y}{b} = 1$, the shadow's slanted edge` },
            { statement: md`$\text{Vol}(E) = \int_0^a \int_0^{b(1 - x/a)} c\left(1 - \tfrac{x}{a} - \tfrac{y}{b}\right) dy \, dx$`, reason: "Roof minus floor over the shadow D" },
            { statement: md`$\int_0^{b(1 - x/a)} c\left(1 - \tfrac{x}{a} - \tfrac{y}{b}\right) dy = \frac{bc}{2}\left(1 - \tfrac{x}{a}\right)^2$`, reason: md`An antiderivative in $y$ is $-\frac{bc}{2}\left(1 - \frac{x}{a} - \frac{y}{b}\right)^2$; it is $0$ at the upper limit and $-\frac{bc}{2}(1 - \frac{x}{a})^2$ at $y = 0$` },
            { statement: md`$\text{Vol}(E) = \frac{bc}{2} \int_0^a \left(1 - \tfrac{x}{a}\right)^2 dx = \frac{bc}{2} \cdot \frac{a}{3} = \frac{abc}{6}$`, reason: md`Antiderivative $-\frac{a}{3}(1 - \frac{x}{a})^3$, evaluated from $0$ to $a$` },
          ],
        },
        {
          kind: "example",
          title: "Mass of a tetrahedron with varying density",
          problem: md`A solid occupies the tetrahedron $x + y + z \le 1$ in the first octant and has density $\rho(x, y, z) = z$. Find its mass.`,
          steps: [
            { math: md`M = \iiint_E z \, dV = \int_0^1 \int_0^{1 - x} \int_0^{1 - x - y} z \, dz \, dy \, dx`, note: md`Same limits as for the volume ($a = b = c = 1$), but the integrand is the density.` },
            { math: md`\int_0^{1 - x - y} z \, dz = \frac{(1 - x - y)^2}{2}`, note: "" },
            { math: md`\int_0^{1 - x} \frac{(1 - x - y)^2}{2} \, dy = \left[-\frac{(1 - x - y)^3}{6}\right]_0^{1 - x} = \frac{(1 - x)^3}{6}`, note: "" },
            { math: md`M = \int_0^1 \frac{(1 - x)^3}{6} \, dx = \frac{1}{24}`, note: md`The volume is $\frac16$, so the average density is $\frac{1/24}{1/6} = \frac14$: the material is denser near the top, but most of the tetrahedron is near the bottom.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Work out $\int_0^1 \int_0^{x} \int_0^{xy} dz \, dy \, dx$, the volume of the solid under $z = xy$ over the triangle $0 \le y \le x \le 1$.`,
          answer: "1/8",
          explain: md`The $z$ integral gives $xy$; then $\int_0^x xy \, dy = \frac{x^3}{2}$ and $\int_0^1 \frac{x^3}{2} \, dx = \frac18$.`,
        },
      ],
      practice: [innermostIntegral, boxIntegral, tetraLimits, tetraSolid],
    },
    {
      id: slug("Cylindrical and spherical coordinates"),
      title: "Cylindrical and spherical coordinates",
      summary: "Two coordinate systems for solids with circular symmetry. Deriving dV = r dz dr dtheta and dV = rho^2 sin(phi) drho dphi dtheta from the shape of a small coordinate cell, then volumes of balls, cones and cylinders.",
      blocks: [
        {
          kind: "text",
          body: md`Polar coordinates handled disks in the plane. For solids with an axis of symmetry, add $z$ unchanged. **Cylindrical coordinates** $(r, \theta, z)$ locate a point by the polar coordinates of its shadow in the $xy$-plane and its height:

$$x = r\cos\theta, \qquad y = r\sin\theta, \qquad z = z, \qquad r^2 = x^2 + y^2.$$

The surface $r = 2$ is a cylinder of radius 2 around the $z$-axis, hence the name. The paraboloid $z = x^2 + y^2$ becomes $z = r^2$; the cone $z = \sqrt{x^2 + y^2}$ becomes $z = r$. Anything that looks like $x^2 + y^2$ in a problem is a hint to switch.`,
        },
        {
          kind: "why",
          title: "Why dV = r dz dr dθ",
          body: md`A small cylindrical cell is a polar rectangle in the $xy$-plane, with area $r \, \Delta r \, \Delta\theta$ by the last lesson, extruded straight up by $\Delta z$. Its volume is base times height, $r \, \Delta r \, \Delta\theta \, \Delta z$. A Riemann sum over such cells is a Riemann sum for $f(r\cos\theta, r\sin\theta, z) \, r$ over a box in $(r, \theta, z)$-space, so the triple integral picks up exactly the same factor $r$ as the double integral did.`,
        },
        {
          kind: "key",
          title: "Triple integrals in cylindrical coordinates",
          body: md`If $E = \{\alpha \le \theta \le \beta, \; h_1(\theta) \le r \le h_2(\theta), \; u_1(r, \theta) \le z \le u_2(r, \theta)\}$,

$$\iiint_E f \, dV = \int_\alpha^\beta \int_{h_1(\theta)}^{h_2(\theta)} \int_{u_1}^{u_2} f(r\cos\theta, r\sin\theta, z) \, r \, dz \, dr \, d\theta.$$

Typical use: the shadow $D$ is a disk or sector (easy in $r$, $\theta$), and the roof and floor are given in terms of $x^2 + y^2 = r^2$.`,
        },
        {
          kind: "example",
          title: "Between a paraboloid and a plane",
          problem: md`Find the volume of the solid bounded by $z = x^2 + y^2$ and $z = 4$.`,
          steps: [
            { math: md`r^2 \le z \le 4, \qquad 0 \le r \le 2, \qquad 0 \le \theta \le 2\pi`, note: md`Floor $z = r^2$, roof $z = 4$. They meet where $r^2 = 4$, so the shadow is the disk $r \le 2$.` },
            { math: md`V = \int_0^{2\pi} \int_0^2 \int_{r^2}^4 r \, dz \, dr \, d\theta = \int_0^{2\pi} \int_0^2 (4 - r^2) \, r \, dr \, d\theta`, note: md`The $z$ integral gives the height $4 - r^2$, times the $r$ from $dV$.` },
            { math: md`\int_0^2 (4r - r^3) \, dr = 8 - 4 = 4, \qquad V = 2\pi \cdot 4 = 8\pi`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`Convert the point $(1, \sqrt{3}, 2)$ to cylindrical coordinates $(r, \theta, z)$ with $r \ge 0$ and $0 \le \theta < 2\pi$. Give it as (r, t, z), typing pi as pi.`,
          answer: "(2, pi/3, 2)",
          form: "tuple",
          explain: md`$r = \sqrt{1 + 3} = 2$; $\cos\theta = \frac12$ and $\sin\theta = \frac{\sqrt3}{2}$ put $\theta = \frac{\pi}{3}$; $z$ stays $2$.`,
        },
        {
          kind: "text",
          body: md`**Spherical coordinates** $(\rho, \varphi, \theta)$ suit solids with a center of symmetry. $\rho \ge 0$ is the distance from the origin, $\varphi \in [0, \pi]$ is the angle down from the positive $z$-axis, and $\theta$ is the same angle as in cylindrical coordinates: the direction of the shadow in the $xy$-plane. (Latitude and longitude, except that $\varphi$ is measured from the pole, not the equator.)

From the right triangle with hypotenuse $\rho$ in the figure below, the height is $z = \rho\cos\varphi$ and the distance from the $z$-axis is $r = \rho\sin\varphi$. Then $x = r\cos\theta$ and $y = r\sin\theta$ as before:

$$x = \rho\sin\varphi\cos\theta, \qquad y = \rho\sin\varphi\sin\theta, \qquad z = \rho\cos\varphi, \qquad \rho^2 = x^2 + y^2 + z^2.$$

The sphere $x^2 + y^2 + z^2 = 9$ is simply $\rho = 3$. The cone $z = \sqrt{x^2 + y^2}$ is $\rho\cos\varphi = \rho\sin\varphi$, that is, $\varphi = \pi/4$. The $xy$-plane is $\varphi = \pi/2$.`,
        },
        sphericalSlice,
        {
          kind: "why",
          title: "Why dV = ρ² sin φ dρ dφ dθ",
          body: md`Look at the small cell where $\rho$, $\varphi$ and $\theta$ each change by a little. Its three edges are roughly perpendicular, so its volume is roughly the product of their lengths. Increasing $\rho$ by $\Delta\rho$ moves the point straight outward: edge length $\Delta\rho$. Increasing $\varphi$ by $\Delta\varphi$ swings the point along a circle of radius $\rho$ centered at the origin: an arc of length $\rho \, \Delta\varphi$. Increasing $\theta$ by $\Delta\theta$ turns the point about the $z$-axis along a horizontal circle whose radius is the distance from the axis, $r = \rho\sin\varphi$: an arc of length $\rho\sin\varphi \, \Delta\theta$.

$$\Delta V \approx \Delta\rho \cdot \rho\,\Delta\varphi \cdot \rho\sin\varphi\,\Delta\theta = \rho^2 \sin\varphi \, \Delta\rho \, \Delta\varphi \, \Delta\theta.$$

The factor $\sin\varphi$ says cells near the poles ($\varphi$ near $0$ or $\pi$) are thin, because the circles of latitude are short there; cells near the equator are fattest. The $\rho^2$ says cells far from the origin are bigger in two directions at once. As with polar coordinates, this is the only correction: integrate $f \cdot \rho^2 \sin\varphi$ over a box in $(\rho, \varphi, \theta)$.`,
        },
        {
          kind: "key",
          title: "Triple integrals in spherical coordinates",
          body: md`If $E = \{a \le \rho \le b, \; \alpha \le \varphi \le \beta, \; \gamma \le \theta \le \delta\}$ (a "spherical wedge"), or more generally $\rho$ runs between functions of $\varphi$ and $\theta$,

$$\iiint_E f \, dV = \int_\gamma^\delta \int_\alpha^\beta \int_a^b f(\rho\sin\varphi\cos\theta, \rho\sin\varphi\sin\theta, \rho\cos\varphi) \, \rho^2 \sin\varphi \, d\rho \, d\varphi \, d\theta.$$

Use it when the solid is bounded by spheres and cones centered at the origin, or the integrand contains $x^2 + y^2 + z^2$.`,
        },
        {
          kind: "proof",
          title: "The volume of a ball",
          given: md`The ball $B$ of radius $a$ centered at the origin`,
          prove: md`$\text{Vol}(B) = \frac{4}{3}\pi a^3$`,
          steps: [
            { statement: md`$B = \{0 \le \rho \le a, \; 0 \le \varphi \le \pi, \; 0 \le \theta \le 2\pi\}$`, reason: md`Every point within distance $a$ of the origin, in every direction` },
            { statement: md`$\text{Vol}(B) = \int_0^{2\pi} \int_0^\pi \int_0^a \rho^2\sin\varphi \, d\rho \, d\varphi \, d\theta$`, reason: md`$\iiint_B 1 \, dV$ in spherical coordinates` },
            { statement: md`$= \left(\int_0^{2\pi} d\theta\right)\left(\int_0^\pi \sin\varphi \, d\varphi\right)\left(\int_0^a \rho^2 \, d\rho\right)$`, reason: "The integrand is a product and the limits are constants, so it factors (Lesson 1)" },
            { statement: md`$= 2\pi \cdot 2 \cdot \frac{a^3}{3} = \frac{4}{3}\pi a^3$`, reason: md`$\left[-\cos\varphi\right]_0^\pi = 1 + 1 = 2$` },
          ],
        },
        {
          kind: "example",
          title: "An ice-cream cone",
          problem: md`Find the volume of the solid inside the sphere $x^2 + y^2 + z^2 = 4$ and above the cone $z = \sqrt{x^2 + y^2}$.`,
          steps: [
            { math: md`\text{sphere: } \rho = 2, \qquad \text{cone: } \varphi = \frac{\pi}{4}`, note: md`On the cone, $\rho\cos\varphi = \rho\sin\varphi$, so $\tan\varphi = 1$.` },
            { math: md`E = \{0 \le \rho \le 2, \; 0 \le \varphi \le \tfrac{\pi}{4}, \; 0 \le \theta \le 2\pi\}`, note: md`"Above the cone" means closer to the $z$-axis than the cone: $\varphi$ smaller than $\pi/4$.` },
            { math: md`V = \int_0^{2\pi} \int_0^{\pi/4} \int_0^2 \rho^2\sin\varphi \, d\rho \, d\varphi \, d\theta = 2\pi \cdot \frac{8}{3} \cdot \left[-\cos\varphi\right]_0^{\pi/4}`, note: "" },
            { math: md`= \frac{16\pi}{3}\left(1 - \frac{\sqrt2}{2}\right) = \frac{8\pi(2 - \sqrt2)}{3}`, note: md`About $4.9$. In cylindrical coordinates this would need $\sqrt{4 - r^2}$ as a roof and $r$ as a floor; spherical makes every limit a constant.` },
          ],
        },
        {
          kind: "example",
          title: "A moment of inertia",
          problem: md`Find $\iiint_B (x^2 + y^2) \, dV$ over the ball $x^2 + y^2 + z^2 \le 1$. (With density 1, this is the ball's moment of inertia about the $z$-axis.)`,
          steps: [
            { math: md`x^2 + y^2 = \rho^2\sin^2\varphi`, note: md`The distance from the $z$-axis squared.` },
            { math: md`\int_0^{2\pi} \int_0^\pi \int_0^1 \rho^2\sin^2\varphi \cdot \rho^2\sin\varphi \, d\rho \, d\varphi \, d\theta = 2\pi \cdot \frac15 \int_0^\pi \sin^3\varphi \, d\varphi`, note: "" },
            { math: md`\int_0^\pi \sin^3\varphi \, d\varphi = \int_0^\pi (1 - \cos^2\varphi)\sin\varphi \, d\varphi = \left[-\cos\varphi + \frac{\cos^3\varphi}{3}\right]_0^\pi = \frac43`, note: md`Substitute $u = \cos\varphi$.` },
            { math: md`= 2\pi \cdot \frac15 \cdot \frac43 = \frac{8\pi}{15}`, note: md`Compared with the volume $\frac{4\pi}{3}$, the average of $x^2 + y^2$ over the ball is $\frac25$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the volume of the solid $\rho \le 2$, $0 \le \varphi \le \pi/2$: the upper half of a ball of radius 2. Give the exact value.`,
          answer: "16pi/3",
          explain: md`$\int_0^{2\pi} \int_0^{\pi/2} \int_0^2 \rho^2\sin\varphi \, d\rho \, d\varphi \, d\theta = 2\pi \cdot 1 \cdot \frac83 = \frac{16\pi}{3}$, half of $\frac43\pi \cdot 8$.`,
        },
      ],
      practice: [cylPoint, sphPoint, sphEquation, coordVolume],
    },
    {
      id: slug("Change of variables and the Jacobian"),
      title: "Change of variables and the Jacobian",
      summary: "Polar, cylindrical and spherical coordinates are special cases of one idea: a substitution in two or three variables, where a determinant measures how the map stretches small areas. Why that determinant appears, and how to use it.",
      blocks: [
        {
          kind: "text",
          body: md`In Calculus 1 a substitution $x = g(u)$ turns $\int f(x) \, dx$ into $\int f(g(u)) \, g'(u) \, du$. The factor $g'(u)$ is the stretch: a small interval $\Delta u$ becomes an interval of length about $|g'(u)| \Delta u$ on the $x$-axis. The same thing happened in polar coordinates, where the small $r\theta$-rectangle became a polar rectangle $r$ times as big. Here is the general version.

A **transformation** $T$ from the $uv$-plane to the $xy$-plane is a pair of functions $x = x(u, v)$, $y = y(u, v)$. It carries a region $S$ in the $uv$-plane onto a region $R = T(S)$ in the $xy$-plane. We want to trade an integral over $R$ for an integral over $S$, which is useful when $S$ is a rectangle and $R$ is not. The question is how much $T$ stretches area near each point.`,
        },
        uvSquare,
        xyParallelogram,
        {
          kind: "why",
          title: "Why a determinant measures the stretch",
          body: md`Start with a **linear** map $x = au + bv$, $y = cu + dv$. The unit square's corners $(0, 0), (1, 0), (0, 1)$ go to $(0, 0)$, $(a, c)$, $(b, d)$, and straight lines go to straight lines, so the square becomes the parallelogram spanned by $\langle a, c \rangle$ and $\langle b, d \rangle$. Unit 1: the area of that parallelogram is the magnitude of the cross product of its sides, $|ad - bc|$. Every small square is handled the same way, so a linear map multiplies all areas by the constant $|ad - bc|$.

Now a general $T$. Near a point $(u_0, v_0)$ it is approximately linear (Unit 3, linear approximation): a small rectangle with corners at $(u_0, v_0)$, $(u_0 + \Delta u, v_0)$, $(u_0, v_0 + \Delta v)$ is carried to approximately the parallelogram with sides

$$\left\langle \frac{\partial x}{\partial u}, \frac{\partial y}{\partial u} \right\rangle \Delta u \quad\text{and}\quad \left\langle \frac{\partial x}{\partial v}, \frac{\partial y}{\partial v} \right\rangle \Delta v,$$

because moving $\Delta u$ in the $u$ direction changes $x$ by about $x_u \Delta u$ and $y$ by about $y_u \Delta u$. Its area is

$$\left| x_u y_v - x_v y_u \right| \Delta u \, \Delta v.$$

So a Riemann sum for $\iint_R f \, dA$, built from the images of the $uv$-grid cells, is $\sum f(T(u_i, v_j)) \, |x_u y_v - x_v y_u| \, \Delta u \, \Delta v$, a Riemann sum over $S$ for the function $f(T(u, v))$ times the stretch factor.`,
        },
        {
          kind: "key",
          title: "The Jacobian and the change of variables formula",
          body: md`The **Jacobian** of $T$ is the determinant

$$\frac{\partial(x, y)}{\partial(u, v)} = \begin{vmatrix} \dfrac{\partial x}{\partial u} & \dfrac{\partial x}{\partial v} \\[2ex] \dfrac{\partial y}{\partial u} & \dfrac{\partial y}{\partial v} \end{vmatrix} = \frac{\partial x}{\partial u}\frac{\partial y}{\partial v} - \frac{\partial x}{\partial v}\frac{\partial y}{\partial u}.$$

If $T$ is one-to-one with continuous partials and nonzero Jacobian on the interior of $S$, then

$$\iint_R f(x, y) \, dA = \iint_S f(x(u, v), y(u, v)) \left| \frac{\partial(x, y)}{\partial(u, v)} \right| du \, dv.$$

The absolute value is there because area is positive; a negative Jacobian means $T$ flips orientation. For three variables the same holds with a $3 \times 3$ determinant $\frac{\partial(x, y, z)}{\partial(u, v, w)}$.`,
        },
        {
          kind: "proof",
          title: "Linear maps scale area by |ad − bc|",
          given: md`$T(u, v) = (au + bv, cu + dv)$ with $ad - bc \ne 0$, and a rectangle $S = [u_0, u_0 + h] \times [v_0, v_0 + k]$`,
          prove: md`$\text{Area}(T(S)) = |ad - bc| \cdot \text{Area}(S)$`,
          steps: [
            { statement: md`$T(u_0 + s, v_0 + t) = T(u_0, v_0) + s\langle a, c \rangle + t\langle b, d \rangle$ for $0 \le s \le h$, $0 \le t \le k$`, reason: "Expand: the map is linear in the increments" },
            { statement: md`$T(S)$ is the parallelogram with a corner at $T(u_0, v_0)$ and sides $h\langle a, c \rangle$ and $k\langle b, d \rangle$`, reason: md`As $s$ and $t$ range over their intervals, the point sweeps out exactly that parallelogram` },
            { statement: md`$\text{Area}(T(S)) = \left| h\langle a, c, 0 \rangle \times k\langle b, d, 0 \rangle \right| = hk \, |ad - bc|$`, reason: "Unit 1: the area of a parallelogram is the magnitude of the cross product of its sides" },
            { statement: md`$= |ad - bc| \cdot \text{Area}(S)$`, reason: md`$\text{Area}(S) = hk$` },
          ],
        },
        {
          kind: "example",
          title: "Polar coordinates, again",
          problem: md`Compute the Jacobian of the polar map $x = r\cos\theta$, $y = r\sin\theta$.`,
          steps: [
            { math: md`\frac{\partial(x, y)}{\partial(r, \theta)} = \begin{vmatrix} \cos\theta & -r\sin\theta \\ \sin\theta & r\cos\theta \end{vmatrix}`, note: md`Rows are $x$ and $y$; columns are $\partial/\partial r$ and $\partial/\partial\theta$.` },
            { math: md`= r\cos^2\theta + r\sin^2\theta = r`, note: md`So $dA = r \, dr \, d\theta$: the formula derived from sectors in Lesson 2 is the Jacobian formula in disguise. The same computation in three variables gives $r$ for cylindrical and $\rho^2\sin\varphi$ for spherical coordinates.` },
          ],
        },
        {
          kind: "example",
          title: "A parallelogram becomes a rectangle",
          problem: md`Find $\iint_R (x + y)^2 \, dA$, where $R$ is the parallelogram with vertices $(0, 0)$, $(1, 1)$, $(2, 0)$ and $(1, -1)$.`,
          steps: [
            { math: md`\text{sides: } y = x, \quad x + y = 2, \quad y = x - 2, \quad x + y = 0`, note: md`Two sides have $x - y$ constant ($0$ and $2$), two have $x + y$ constant ($0$ and $2$). That suggests $u = x + y$, $v = x - y$.` },
            { math: md`x = \frac{u + v}{2}, \quad y = \frac{u - v}{2}, \qquad \frac{\partial(x, y)}{\partial(u, v)} = \begin{vmatrix} \frac12 & \frac12 \\ \frac12 & -\frac12 \end{vmatrix} = -\frac12`, note: md`Solve for $x$ and $y$, then differentiate. $|J| = \frac12$: the map from $uv$ to $xy$ halves areas.` },
            { math: md`S: \; 0 \le u \le 2, \quad 0 \le v \le 2`, note: md`$R$ is the set where $0 \le x + y \le 2$ and $0 \le x - y \le 2$: a square in the $uv$-plane.` },
            { math: md`\iint_R (x + y)^2 \, dA = \int_0^2 \int_0^2 u^2 \cdot \frac12 \, dv \, du = \frac12 \cdot 2 \cdot \frac{8}{3} = \frac{8}{3}`, note: md`The integrand $(x + y)^2$ is just $u^2$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the Jacobian $\dfrac{\partial(x, y)}{\partial(u, v)}$ of $x = 2u + v$, $y = u - 3v$.`,
          answer: "-7",
          explain: md`$x_u y_v - x_v y_u = (2)(-3) - (1)(1) = -7$. The map multiplies areas by $7$ and flips orientation.`,
        },
        {
          kind: "example",
          title: "The area of an ellipse",
          problem: md`Find the area inside $\frac{x^2}{a^2} + \frac{y^2}{b^2} = 1$.`,
          steps: [
            { math: md`x = au, \quad y = bv`, note: md`Then $\frac{x^2}{a^2} + \frac{y^2}{b^2} = u^2 + v^2$, so the ellipse $R$ is the image of the unit disk $S$.` },
            { math: md`\frac{\partial(x, y)}{\partial(u, v)} = \begin{vmatrix} a & 0 \\ 0 & b \end{vmatrix} = ab`, note: "A stretch by a horizontally and b vertically." },
            { math: md`\text{Area}(R) = \iint_S ab \, du \, dv = ab \cdot \pi = \pi ab`, note: md`With $a = b = r$ this is $\pi r^2$. Doing this directly in $x$ and $y$ needs a trigonometric substitution; here the geometry does the work.` },
          ],
        },
        {
          kind: "contour",
          x: [-3.5, 3.5],
          y: [-2.5, 2.5],
          expr: "x^2/9 + y^2/4",
          levels: [0.25, 0.5, 1, 1.5],
          caption: md`Level curves of $\frac{x^2}{9} + \frac{y^2}{4}$: ellipses, the images of circles $u^2 + v^2 = c$ under $x = 3u$, $y = 2v$. Each is $6$ times the area of the circle it came from.`,
        },
        {
          kind: "check",
          prompt: md`Use $x = 3u$, $y = 2v$ to find the area of the ellipse $\frac{x^2}{9} + \frac{y^2}{4} \le 1$. Give the exact value.`,
          answer: "6pi",
          explain: md`The Jacobian is $3 \cdot 2 = 6$, and the ellipse is the image of the unit disk, so the area is $6\pi$.`,
        },
      ],
      practice: [inverseCorner, jacobian, changeOfVariables],
    },
  ],
};
