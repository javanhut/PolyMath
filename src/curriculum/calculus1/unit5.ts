import { frac, fracTex, paren, poly, signed, type Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Tidy a float for display: 1.2000000000000002 -> "1.2". */
const num = (x: number) => String(Number(x.toPrecision(12)));

/** x rounded to d decimal places, or null when x is too close to a rounding tie to trust. */
function rounded(x: number, d: number): string | null {
  const s = x * 10 ** d;
  if (Math.abs(s - Math.floor(s) - 0.5) < 1e-3) return null;
  return (Math.round(s) / 10 ** d).toFixed(d);
}

/** e^{kx} as LaTeX and as answer text. */
const ekxTex = (k: number) => (k === 1 ? "e^{x}" : k === -1 ? "e^{-x}" : `e^{${k}x}`);
const ekxText = (k: number) => (k === 1 ? "e^x" : k === -1 ? "e^(-x)" : `e^(${k}x)`);

/** sqrt(n) as answer text ("3", "sqrt(10)") and LaTeX. */
function root(n: number): { text: string; tex: string } {
  const s = Math.round(Math.sqrt(n));
  if (s * s === n) return { text: String(s), tex: String(s) };
  return { text: `sqrt(${n})`, tex: `\\sqrt{${n}}` };
}

/**
 * A cubic s(x^3 - 3(p+q)/2 x^2 + 3pq x) + d with derivative 3s(x - p)(x - q),
 * so its critical points are the integers p < q (p + q even keeps the coefficients whole).
 */
interface Cubic {
  s: 1 | -1;
  p: number;
  q: number;
  d: number;
  /** f(x) as text that works both as LaTeX and as typed-answer syntax. */
  text: string;
  /** f'(x) expanded. */
  dText: string;
  /** f'(x) factored, as LaTeX. */
  dFactored: string;
  /** f''(x). */
  ddText: string;
  at: (x: number) => number;
}

function cubic(r: Rng, sign?: 1 | -1): Cubic {
  for (;;) {
    const p = r.int(-4, 3);
    const q = r.int(p + 1, 5);
    if ((p + q) % 2 !== 0) continue;
    const s = sign ?? r.pick([1, 1, -1] as const);
    const d = r.int(-5, 9);
    const a2 = (-s * 3 * (p + q)) / 2;
    const a1 = 3 * s * p * q;
    return {
      s,
      p,
      q,
      d,
      text: poly([[s, "x^3"], [a2, "x^2"], [a1, "x"], [d, ""]]),
      dText: poly([[3 * s, "x^2"], [2 * a2, "x"], [a1, ""]]),
      dFactored: `${s === 1 ? "3" : "-3"}(x ${signed(-p)})(x ${signed(-q)})`,
      ddText: poly([[6 * s, "x"], [2 * a2, ""]]),
      at: (x) => s * x ** 3 + a2 * x * x + a1 * x + d,
    };
  }
}

/** "x = a" steps for a factored derivative. */
const setList = (xs: number[]) => xs.join(", ");

// ── Lesson 1: Extreme values ────────────────────────────────────────────────

const criticalPoints: Generator = (r) => {
  if (r.next() < 0.65) {
    const c = cubic(r);
    return {
      prompt: md`Find the critical points of $f(x) = ${c.text}$. Give the $x$-values as a comma-separated list.`,
      answer: setList([c.p, c.q]),
      form: "set",
      verify: [`${c.dText} = 0`],
      hint: md`Critical points are where $f'(x) = 0$ or $f'(x)$ doesn't exist. A polynomial's derivative always exists, so solve $f'(x) = 0$. Factor out the common factor first.`,
      solution: [
        { math: md`f'(x) = ${c.dText}`, note: "Power rule on each term." },
        { math: md`f'(x) = ${c.dFactored}`, note: md`Factor out ${c.s === 1 ? "3" : "-3"}, then factor the quadratic.` },
        { math: md`x = ${c.p} \quad\text{or}\quad x = ${c.q}`, note: md`$f'(x) = 0$ at both. The derivative exists everywhere, so these are the only critical points.` },
      ],
    };
  }
  const a = r.int(1, 3);
  const d = r.int(-4, 6);
  const text = poly([[1, "x^4"], [-2 * a * a, "x^2"], [d, ""]]);
  return {
    prompt: md`Find the critical points of $f(x) = ${text}$. Give the $x$-values as a comma-separated list.`,
    answer: setList([-a, 0, a]),
    form: "set",
    verify: [`4x^3 - ${4 * a * a}x = 0`],
    hint: md`Solve $f'(x) = 0$. Factor out $4x$ and you are left with a difference of squares.`,
    solution: [
      { math: md`f'(x) = 4x^3 - ${4 * a * a}x`, note: "Power rule." },
      { math: md`f'(x) = 4x(x^2 - ${a * a}) = 4x(x - ${a})(x + ${a})`, note: "Common factor, then difference of squares." },
      { math: md`x = -${a}, \quad x = 0, \quad x = ${a}`, note: "Three critical points. A quartic can have up to three, since its derivative is a cubic." },
    ],
  };
};

const absoluteExtremum: Generator = (r) => {
  for (;;) {
    const c = cubic(r);
    const A = c.p - r.int(0, 2);
    const B = c.q + r.int(0, 2);
    const xs = [...new Set([A, c.p, c.q, B])].sort((u, v) => u - v);
    const table = xs.map((x) => ({ x, y: c.at(x) }));
    const wantMax = r.next() < 0.5;
    const sorted = [...table].sort((u, v) => (wantMax ? v.y - u.y : u.y - v.y));
    if (sorted[0]!.y === sorted[1]!.y) continue;
    const best = sorted[0]!;
    const word = wantMax ? "maximum" : "minimum";
    return {
      prompt: md`Find the absolute ${word} of $f(x) = ${c.text}$ on the interval $[${A}, ${B}]$. Give it as a point $(x, y)$.`,
      answer: `(${best.x}, ${best.y})`,
      form: "tuple",
      verify: [`y = ${c.text}`, `(y - ${paren(c.at(A))})(y - ${paren(c.at(B))})(${c.dText}) = 0`],
      hint: md`Closed interval method: find the critical points inside the interval, then compare $f$ at those points and at both endpoints. The biggest value is the maximum, the smallest the minimum.`,
      solution: [
        { math: md`f'(x) = ${c.dText} = ${c.dFactored}`, note: "Differentiate and factor." },
        { math: md`x = ${c.p}, \quad x = ${c.q}`, note: md`Both critical points lie in $[${A}, ${B}]$ (an endpoint counts as a candidate either way).` },
        { math: table.map((t) => `f(${t.x}) = ${t.y}`).join(", \\quad "), note: "Evaluate at the endpoints and the critical points." },
        { math: md`\text{absolute ${word}: } (${best.x}, ${best.y})`, note: md`The ${wantMax ? "largest" : "smallest"} value in the list is $${best.y}$, at $x = ${best.x}$.` },
      ],
    };
  }
};

const productCritical: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const k = r.pick([-3, -2, -1, 1, 2, 3]);
    return {
      prompt: md`Find the critical points of $f(x) = x${ekxTex(k)}$. Give the $x$-values as a comma-separated list (just the one value if there is only one).`,
      answer: frac(-1, k),
      form: "set",
      verify: [`${ekxText(k)}(${poly([[k, "x"], [1, ""]])}) = 0`],
      hint: md`Product rule, then factor out $${ekxTex(k)}$. An exponential is never zero, so only the other factor can vanish.`,
      solution: [
        { math: md`f'(x) = 1 \cdot ${ekxTex(k)} + x \cdot ${k === 1 ? "" : k}${ekxTex(k)}`, note: "Product rule, with the chain rule on the exponential." },
        { math: md`f'(x) = ${ekxTex(k)}(1 ${signed(k)}x)`, note: md`Factor out $${ekxTex(k)}$.` },
        { math: md`1 ${signed(k)}x = 0 \;\Rightarrow\; x = ${fracTex(-1, k)}`, note: md`$${ekxTex(k)} > 0$ always, so the only critical point comes from the linear factor.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(-2, 4);
    return {
      prompt: md`Find the critical points of $f(x) = (x ${signed(-a)})^2 e^{x}$. Give the $x$-values as a comma-separated list.`,
      answer: setList([a - 2, a]),
      form: "set",
      verify: [`e^x (x ${signed(-a)})(x ${signed(2 - a)}) = 0`],
      hint: md`Product rule, then factor out everything the two terms share: $e^x$ and one copy of $(x ${signed(-a)})$.`,
      solution: [
        { math: md`f'(x) = 2(x ${signed(-a)})e^{x} + (x ${signed(-a)})^2 e^{x}`, note: "Product rule." },
        { math: md`f'(x) = (x ${signed(-a)})e^{x}\,(2 + x ${signed(-a)}) = (x ${signed(-a)})(x ${signed(2 - a)})e^{x}`, note: "Factor the common pieces." },
        { math: md`x = ${a - 2} \quad\text{or}\quad x = ${a}`, note: md`$e^x$ is never zero.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(1, 4);
    return {
      prompt: md`Find the critical points of $f(x) = \dfrac{x}{x^2 + ${a * a}}$. Give the $x$-values as a comma-separated list.`,
      answer: setList([-a, a]),
      form: "set",
      verify: [`(${a * a} - x^2)/(x^2 + ${a * a})^2 = 0`],
      hint: md`Quotient rule. A fraction is zero only when its numerator is zero, and this denominator is never zero.`,
      solution: [
        { math: md`f'(x) = \frac{(1)(x^2 + ${a * a}) - x(2x)}{(x^2 + ${a * a})^2}`, note: "Quotient rule: low d-high minus high d-low, over low squared." },
        { math: md`f'(x) = \frac{${a * a} - x^2}{(x^2 + ${a * a})^2}`, note: "Simplify the numerator." },
        { math: md`${a * a} - x^2 = 0 \;\Rightarrow\; x = \pm ${a}`, note: md`The denominator is at least $${a * a}$, so $f'$ exists everywhere; only the numerator matters.` },
      ],
    };
  }
  if (kind === 3) {
    const k = r.pick([-2, -1, 1, 2]);
    return {
      prompt: md`Find the critical points of $f(x) = x^2 ${ekxTex(k)}$. Give the $x$-values as a comma-separated list.`,
      answer: setList([Math.min(0, -2 / k), Math.max(0, -2 / k)]),
      form: "set",
      verify: [`x ${ekxText(k)} (${poly([[k, "x"], [2, ""]])}) = 0`],
      hint: md`Product rule, then factor out $x${ekxTex(k)}$.`,
      solution: [
        { math: md`f'(x) = 2x${ekxTex(k)} + x^2 \cdot ${k === 1 ? "" : k}${ekxTex(k)}`, note: "Product rule with the chain rule." },
        { math: md`f'(x) = x${ekxTex(k)}(2 ${signed(k)}x)`, note: "Factor." },
        { math: md`x = 0 \quad\text{or}\quad x = ${fracTex(-2, k)}`, note: md`Two critical points; the exponential factor is never zero.` },
      ],
    };
  }
  const k = r.int(1, 3);
  const fTex = k === 1 ? "x \\ln x" : `x^{${k}} \\ln x`;
  const ans = k === 1 ? "1/e" : `e^(-1/${k})`;
  return {
    prompt: md`Find the critical points of $f(x) = ${fTex}$ (for $x > 0$). Give the exact value, like e^(-1/3) or 1/e.`,
    answer: ans,
    form: "set",
    verify: [k === 1 ? `ln(x) + 1 = 0` : `x^${k - 1}(${k} ln(x) + 1) = 0`],
    hint: md`Product rule. Then remember that $\ln x = c$ means $x = e^{c}$.`,
    solution: [
      { math: k === 1 ? md`f'(x) = \ln x + x \cdot \frac{1}{x} = \ln x + 1` : md`f'(x) = ${k}x^{${k - 1}}\ln x + x^{${k}} \cdot \frac{1}{x} = x^{${k - 1}}(${k}\ln x + 1)`, note: "Product rule." },
      { math: k === 1 ? md`\ln x = -1` : md`${k}\ln x + 1 = 0 \;\Rightarrow\; \ln x = -\tfrac{1}{${k}}`, note: md`${k === 1 ? "" : `$x^{${k - 1}} > 0$ on the domain, so only the bracket can vanish. `}Solve for $\ln x$.` },
      { math: k === 1 ? md`x = e^{-1} = \frac{1}{e}` : md`x = e^{-1/${k}}`, note: md`Undo the logarithm with $e$.` },
    ],
  };
};

// ── Lesson 2: The mean value theorem ────────────────────────────────────────

const mvtC: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.nonzero(-3, 3);
    const b = r.int(-6, 6);
    const k = r.int(-5, 5);
    const p = r.int(-4, 3);
    const q = r.int(p + 1, 6);
    const f = (x: number) => a * x * x + b * x + k;
    const slope = a * (p + q) + b;
    const text = poly([[a, "x^2"], [b, "x"], [k, ""]]);
    return {
      prompt: md`Find every value $c$ that the mean value theorem guarantees for $f(x) = ${text}$ on $[${p}, ${q}]$. Give all such $c$ as a comma-separated list.`,
      answer: frac(p + q, 2),
      form: "set",
      verify: [`${poly([[2 * a, "c"], [b, ""]])} = (${paren(f(q))} - ${paren(f(p))})/(${q} - ${paren(p)})`],
      hint: md`Compute the secant slope $\dfrac{f(${q}) - f(${p})}{${q} - ${paren(p)}}$, then solve $f'(c) = $ that slope.`,
      solution: [
        { math: md`\frac{f(${q}) - f(${p})}{${q} - ${paren(p)}} = \frac{${f(q)} - ${paren(f(p))}}{${q - p}} = ${slope}`, note: "The secant slope over the interval." },
        { math: md`f'(c) = ${poly([[2 * a, "c"], [b, ""]])} = ${slope}`, note: "Set the tangent slope equal to it." },
        { math: md`c = ${fracTex(p + q, 2)}`, note: md`For a parabola the MVT point is always the midpoint of the interval.` },
      ],
    };
  }
  if (kind === 1) {
    const p = r.int(-3, 2);
    const q = r.int(p + 1, 4);
    const k = r.pick([0, 0, -3, 2, 1, -1]);
    const f = (x: number) => x ** 3 + k * x;
    const m = p * p + p * q + q * q;
    const text = poly([[1, "x^3"], [k, "x"]]);
    const cText = m % 3 === 0 ? root(m / 3).text : `sqrt(${m}/3)`;
    const cTex = m % 3 === 0 ? root(m / 3).tex : `\\frac{\\sqrt{${3 * m}}}{3}`;
    const cVal = Math.sqrt(m / 3);
    const inside = [-cVal, cVal].filter((c) => c > p + 1e-9 && c < q - 1e-9);
    const answer = inside.map((c) => (c < 0 ? `-${cText}` : cText)).join(", ");
    return {
      prompt: md`Find every value $c$ that the mean value theorem guarantees for $f(x) = ${text}$ on $[${p}, ${q}]$. Give all such $c$ as a comma-separated list, exactly (for example sqrt(7/3)).`,
      answer,
      form: "set",
      verify: [`${poly([[3, "c^2"], [k, ""]])} = (${paren(f(q))} - ${paren(f(p))})/(${q} - ${paren(p)})`],
      hint: md`The secant slope is $\dfrac{f(${q}) - f(${p})}{${q - p}}$. Set $f'(c) = 3c^2 ${k ? signed(k) : ""}$ equal to it, solve for $c^2$, and keep only the roots inside $(${p}, ${q})$.`,
      solution: [
        { math: md`\frac{f(${q}) - f(${p})}{${q} - ${paren(p)}} = \frac{${f(q)} - ${paren(f(p))}}{${q - p}} = ${m + k}`, note: "Secant slope." },
        { math: md`3c^2 ${k ? signed(k) : ""} = ${m + k} \;\Rightarrow\; c^2 = \frac{${m}}{3}`, note: md`$f'(c) = 3c^2 ${k ? signed(k) : ""}$.` },
        { math: md`c = \pm ${cTex}`, note: md`Both square roots solve the equation, but the theorem promises a $c$ strictly between $${p}$ and $${q}$.` },
        { math: md`c = ${inside.map((c) => (c < 0 ? `-${cTex}` : cTex)).join(", \\quad ")}`, note: inside.length === 2 ? "Both roots lie inside the interval." : md`Only this root lies in $(${p}, ${q})$.` },
      ],
    };
  }
  if (kind === 2) {
    const s = r.int(0, 4);
    const t = r.int(s + 1, 6);
    const a = s * s;
    const b = t * t;
    return {
      prompt: md`Find the value $c$ that the mean value theorem guarantees for $f(x) = \sqrt{x}$ on $[${a}, ${b}]$.`,
      answer: frac((s + t) ** 2, 4),
      form: "set",
      verify: [`1/(2 sqrt(c)) = (${t} - ${s})/(${b} - ${a})`],
      hint: md`$\sqrt{${b}} = ${t}$ and $\sqrt{${a}} = ${s}$ make the secant slope easy. Then $f'(c) = \dfrac{1}{2\sqrt{c}}$.${s === 0 ? " The theorem only needs $f$ differentiable on the open interval, so the corner at 0 is no problem." : ""}`,
      solution: [
        { math: md`\frac{\sqrt{${b}} - \sqrt{${a}}}{${b} - ${a}} = \frac{${t - s}}{${b - a}} = \frac{1}{${s + t}}`, note: md`Secant slope; $${b} - ${a} = (${t} - ${s})(${t} + ${s})$ cancels the ${t - s}.` },
        { math: md`\frac{1}{2\sqrt{c}} = \frac{1}{${s + t}} \;\Rightarrow\; \sqrt{c} = \frac{${s + t}}{2}`, note: "Set the derivative equal to the slope." },
        { math: md`c = ${fracTex((s + t) ** 2, 4)}`, note: "Square both sides." },
      ],
    };
  }
  const a = r.int(1, 4);
  const b = r.int(a + 1, 9);
  const c = root(a * b);
  return {
    prompt: md`Find the value $c$ that the mean value theorem guarantees for $f(x) = \dfrac{1}{x}$ on $[${a}, ${b}]$. Give it exactly.`,
    answer: c.text,
    form: "set",
    verify: [`-1/c^2 = (1/${b} - 1/${a})/(${b} - ${a})`],
    hint: md`The secant slope simplifies to $-\dfrac{1}{${a} \cdot ${b}}$. Set $f'(c) = -\dfrac{1}{c^2}$ equal to it.`,
    solution: [
      { math: md`\frac{\frac{1}{${b}} - \frac{1}{${a}}}{${b} - ${a}} = \frac{\frac{${a} - ${b}}{${a * b}}}{${b - a}} = -\frac{1}{${a * b}}`, note: md`Combine the fractions on top; the $${b - a}$ cancels.` },
      { math: md`-\frac{1}{c^2} = -\frac{1}{${a * b}} \;\Rightarrow\; c^2 = ${a * b}`, note: "Set the derivative equal to the slope." },
      { math: md`c = ${c.tex}`, note: md`The negative root is outside $[${a}, ${b}]$. The MVT point for $1/x$ is the geometric mean of the endpoints.` },
    ],
  };
};

const mvtBounds: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a0 = r.int(0, 3);
    const b = a0 + r.int(2, 6);
    const A = r.int(-5, 8);
    const m = r.int(-2, 3);
    const M = m + r.int(1, 4);
    const lo = A + m * (b - a0);
    const hi = A + M * (b - a0);
    return {
      prompt: md`Suppose $f(${a0}) = ${A}$ and $${m} \le f'(x) \le ${M}$ for every $x$. Find the smallest and largest values $f(${b})$ could possibly have. Give them as a pair (smallest, largest).`,
      answer: `(${lo}, ${hi})`,
      form: "tuple",
      verify: [`(a - ${paren(A)})/(${b} - ${a0}) + (b - ${paren(A)})/(${b} - ${a0}) = ${m + M}`, `b - a = ${M - m}(${b} - ${a0})`],
      hint: md`By the MVT, $\dfrac{f(${b}) - f(${a0})}{${b} - ${a0}} = f'(c)$ for some $c$, and that slope is trapped between $${m}$ and $${M}$.`,
      solution: [
        { math: md`\frac{f(${b}) - ${A}}{${b - a0}} = f'(c) \quad\text{for some } c \in (${a0}, ${b})`, note: "The mean value theorem." },
        { math: md`${m} \le \frac{f(${b}) - ${A}}{${b - a0}} \le ${M}`, note: md`Because $${m} \le f'(c) \le ${M}$.` },
        { math: md`${m * (b - a0)} \le f(${b}) - ${A} \le ${M * (b - a0)}`, note: md`Multiply through by $${b - a0}$.` },
        { math: md`${lo} \le f(${b}) \le ${hi}`, note: md`Add $${A}$. Both ends are achievable, by the straight lines of slope $${m}$ and $${M}$ through $(${a0}, ${A})$.` },
      ],
    };
  }
  if (kind === 1) {
    const a0 = r.int(0, 4);
    const b = a0 + r.int(2, 8);
    const A = r.int(-6, 10);
    const m = r.int(1, 5);
    const lo = A + m * (b - a0);
    return {
      prompt: md`Suppose $f(${a0}) = ${A}$ and $f'(x) \ge ${m}$ for every $x$. What is the smallest value $f(${b})$ can have?`,
      answer: String(lo),
      verify: [`(y - ${paren(A)})/(${b} - ${a0}) = ${m}`],
      hint: md`The MVT says the secant slope from $x = ${a0}$ to $x = ${b}$ equals $f'(c)$ for some $c$, and $f'(c) \ge ${m}$.`,
      solution: [
        { math: md`\frac{f(${b}) - ${A}}{${b} - ${a0}} = f'(c) \ge ${m}`, note: "Mean value theorem plus the bound on the derivative." },
        { math: md`f(${b}) - ${A} \ge ${m * (b - a0)}`, note: md`Multiply by $${b - a0}$.` },
        { math: md`f(${b}) \ge ${lo}`, note: md`The line $y = ${A} + ${m}(x - ${a0})$ shows the value $${lo}$ really can happen.` },
      ],
    };
  }
  const T = r.int(2, 5);
  const v = r.int(12, 30) * 5;
  const D = v * T;
  return {
    prompt: md`A truck covers ${D} km in ${T} hours. The mean value theorem guarantees that at some instant its speedometer read exactly a certain speed. What speed, in km/h?`,
    answer: String(v),
    verify: [`${T} v = ${D}`],
    hint: md`Let $s(t)$ be the distance travelled. The secant slope of $s$ over $[0, ${T}]$ is the average speed, and the MVT says the instantaneous speed $s'(c)$ equals it somewhere.`,
    solution: [
      { math: md`\frac{s(${T}) - s(0)}{${T} - 0} = \frac{${D}}{${T}} = ${v}`, note: "Average speed over the trip." },
      { math: md`s'(c) = ${v} \text{ km/h for some } c \in (0, ${T})`, note: "The mean value theorem. Position is continuous and differentiable, so the theorem applies." },
    ],
  };
};

const rolleC: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const a = r.int(2, 6);
    return {
      prompt: md`$f(x) = x^3 - ${a}x^2$ satisfies $f(0) = f(${a}) = 0$. Find the value $c$ in $(0, ${a})$ that Rolle's theorem guarantees. Give all such $c$ as a comma-separated list.`,
      answer: frac(2 * a, 3),
      form: "set",
      verify: [`3c^2 - ${2 * a}c = 0`],
      hint: md`Rolle's theorem promises $f'(c) = 0$. Solve it and keep the root strictly inside the interval.`,
      solution: [
        { math: md`f'(x) = 3x^2 - ${2 * a}x = x(3x - ${2 * a})`, note: "Differentiate and factor." },
        { math: md`x = 0 \quad\text{or}\quad x = ${fracTex(2 * a, 3)}`, note: md`$x = 0$ is an endpoint, not inside $(0, ${a})$.` },
        { math: md`c = ${fracTex(2 * a, 3)}`, note: "The one horizontal tangent strictly between the equal heights." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 4);
    const cText = `${a}/sqrt(3)`;
    return {
      prompt: md`$f(x) = x^3 - ${a * a === 1 ? "" : a * a}x$ satisfies $f(-${a}) = f(${a}) = 0$. Find every $c$ in $(-${a}, ${a})$ with $f'(c) = 0$. Give them exactly as a comma-separated list, for example 2/sqrt(3), -2/sqrt(3).`,
      answer: `-${cText}, ${cText}`,
      form: "set",
      verify: [`3c^2 - ${a * a} = 0`],
      hint: md`Solve $3c^2 - ${a * a} = 0$.`,
      solution: [
        { math: md`f'(x) = 3x^2 - ${a * a}`, note: "Differentiate." },
        { math: md`3c^2 = ${a * a} \;\Rightarrow\; c = \pm\frac{${a}}{\sqrt{3}} = \pm\frac{${a}\sqrt{3}}{3}`, note: md`Both roots lie in $(-${a}, ${a})$ since $\sqrt{3} > 1$. Rolle promises at least one; here there are two.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(3, 9);
    return {
      prompt: md`$f(x) = x\sqrt{${a} - x}$ satisfies $f(0) = f(${a}) = 0$. Find the value $c$ in $(0, ${a})$ that Rolle's theorem guarantees.`,
      answer: frac(2 * a, 3),
      form: "set",
      verify: [`sqrt(${a} - c) - c/(2 sqrt(${a} - c)) = 0`],
      hint: md`Product rule with the chain rule on $\sqrt{${a} - x}$. Put the two terms over the common denominator $2\sqrt{${a} - x}$.`,
      solution: [
        { math: md`f'(x) = \sqrt{${a} - x} + x \cdot \frac{-1}{2\sqrt{${a} - x}}`, note: "Product rule; the chain rule supplies the minus sign." },
        { math: md`f'(x) = \frac{2(${a} - x) - x}{2\sqrt{${a} - x}} = \frac{${2 * a} - 3x}{2\sqrt{${a} - x}}`, note: "Common denominator." },
        { math: md`c = ${fracTex(2 * a, 3)}`, note: md`The numerator vanishes there, and $${fracTex(2 * a, 3)}$ lies in $(0, ${a})$.` },
      ],
    };
  }
  if (kind === 3) {
    const k = r.int(1, 2);
    const cs = Array.from({ length: k }, (_, j) => (2 * j + 1) / (2 * k));
    const text = cs.map((c) => (c === 0.5 ? "pi/2" : c === 0.25 ? "pi/4" : "3pi/4")).join(", ");
    const tex = cs.map((c) => (c === 0.5 ? "\\tfrac{\\pi}{2}" : c === 0.25 ? "\\tfrac{\\pi}{4}" : "\\tfrac{3\\pi}{4}")).join(", \\quad ");
    return {
      prompt: md`$f(x) = \sin(${k === 1 ? "" : k}x)$ satisfies $f(0) = f(\pi) = 0$. Find every $c$ in $(0, \pi)$ with $f'(c) = 0$. Give them exactly, as a comma-separated list (write pi for $\pi$).`,
      answer: text,
      form: "set",
      verify: [`${k} cos(${k} c) = 0`],
      hint: md`$f'(x) = ${k === 1 ? "" : k}\cos(${k === 1 ? "" : k}x)$. Cosine is zero at odd multiples of $\pi/2$.`,
      solution: [
        { math: md`f'(x) = ${k === 1 ? "" : k}\cos(${k === 1 ? "" : k}x) = 0`, note: "Chain rule." },
        { math: k === 1 ? md`x = \tfrac{\pi}{2}` : md`${k}x = \tfrac{\pi}{2}, \tfrac{3\pi}{2} \;\Rightarrow\; x = ${tex}`, note: md`Only the solutions strictly between $0$ and $\pi$ count.` },
      ],
    };
  }
  const p = r.int(-4, 3);
  const q = r.int(p + 1, 6);
  const text = poly([[1, "x^2"], [-(p + q), "x"], [p * q, ""]]);
  return {
    prompt: md`$f(x) = ${text}$ has roots $x = ${p}$ and $x = ${q}$, so $f(${p}) = f(${q}) = 0$. Find the $c$ in $(${p}, ${q})$ that Rolle's theorem guarantees.`,
    answer: frac(p + q, 2),
    form: "set",
    verify: [`2c ${signed(-(p + q))} = 0`],
    hint: md`Solve $f'(c) = 0$.`,
    solution: [
      { math: md`f'(x) = 2x ${signed(-(p + q))}`, note: "Differentiate." },
      { math: md`c = ${fracTex(p + q, 2)}`, note: "The vertex of the parabola sits halfway between its roots." },
    ],
  };
};

// ── Lesson 3: Curve sketching ───────────────────────────────────────────────

const monotonic: Generator = (r) => {
  const kind = r.int(0, 2);
  const wantInc = r.next() < 0.6;
  const word = wantInc ? "increasing" : "decreasing";
  const format = "Answer as an inequality (like x < 1 or x > 3) or in interval notation.";
  if (kind === 0) {
    const c = cubic(r);
    const outside = `x < ${c.p} or x > ${c.q}`;
    const between = `${c.p} < x < ${c.q}`;
    const answer = (c.s === 1) === wantInc ? outside : between;
    return {
      prompt: md`On what interval(s) is $f(x) = ${c.text}$ ${word}? ${format}`,
      answer,
      form: "inequality",
      hint: md`Find where $f'(x) ${wantInc ? ">" : "<"} 0$. Factor $f'$ and test a point in each piece between the critical points.`,
      solution: [
        { math: md`f'(x) = ${c.dFactored}`, note: "Differentiate and factor." },
        { math: md`x = ${c.p}, \quad x = ${c.q}`, note: "Critical points split the line into three pieces." },
        {
          math: md`f'(x) ${c.s === 1 ? ">" : "<"} 0 \text{ for } x < ${c.p} \text{ or } x > ${c.q}, \qquad f'(x) ${c.s === 1 ? "<" : ">"} 0 \text{ for } ${c.p} < x < ${c.q}`,
          note: md`Outside the roots both factors have the same sign, so their product is positive and $f'$ has the sign of the leading ${c.s === 1 ? "3" : "-3"}. Between them it flips.`,
        },
        { math: md`f \text{ is ${word} on } ${answer.includes("or") ? `(-\\infty, ${c.p}) \\cup (${c.q}, \\infty)` : `(${c.p}, ${c.q})`}`, note: md`${word[0]!.toUpperCase() + word.slice(1)} where $f' ${wantInc ? ">" : "<"} 0$ (the increasing/decreasing test).` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 3);
    const d = r.int(-4, 6);
    const text = poly([[1, "x^4"], [-2 * a * a, "x^2"], [d, ""]]);
    const inc = `-${a} < x < 0 or x > ${a}`;
    const dec = `x < -${a} or 0 < x < ${a}`;
    return {
      prompt: md`On what interval(s) is $f(x) = ${text}$ ${word}? ${format}`,
      answer: wantInc ? inc : dec,
      form: "inequality",
      hint: md`$f'(x) = 4x(x - ${a})(x + ${a})$. Three roots make four pieces; test one point in each.`,
      solution: [
        { math: md`f'(x) = 4x^3 - ${4 * a * a}x = 4x(x - ${a})(x + ${a})`, note: "Differentiate and factor." },
        { math: md`x = -${a}, \quad 0, \quad ${a}`, note: "Critical points." },
        { math: md`f' < 0 \text{ on } (-\infty, -${a}), \quad f' > 0 \text{ on } (-${a}, 0), \quad f' < 0 \text{ on } (0, ${a}), \quad f' > 0 \text{ on } (${a}, \infty)`, note: md`Each simple root flips the sign; far to the right $4x^3$ dominates and is positive.` },
        { math: md`f \text{ is ${word} on } ${wantInc ? `(-${a}, 0) \\cup (${a}, \\infty)` : `(-\\infty, -${a}) \\cup (0, ${a})`}`, note: "Read off the pieces with the right sign." },
      ],
    };
  }
  const k = r.pick([-2, -1, 1, 2]);
  const cp = frac(-1, k);
  const cpTex = fracTex(-1, k);
  // 1 + kx > 0  <=>  x > -1/k when k > 0, x < -1/k when k < 0.
  const incAnswer = k > 0 ? `x > ${cp}` : `x < ${cp}`;
  const decAnswer = k > 0 ? `x < ${cp}` : `x > ${cp}`;
  return {
    prompt: md`On what interval is $f(x) = x${ekxTex(k)}$ ${word}? ${format}`,
    answer: wantInc ? incAnswer : decAnswer,
    form: "inequality",
    hint: md`$f'(x) = ${ekxTex(k)}(1 ${signed(k)}x)$, and the exponential factor is always positive.`,
    solution: [
      { math: md`f'(x) = ${ekxTex(k)} + ${k === 1 ? "" : k}x${ekxTex(k)} = ${ekxTex(k)}(1 ${signed(k)}x)`, note: "Product rule, then factor." },
      { math: md`1 ${signed(k)}x = 0 \;\Rightarrow\; x = ${cpTex}`, note: "The only critical point." },
      { math: md`f'(x) > 0 \iff 1 ${signed(k)}x > 0 \iff x ${k > 0 ? ">" : "<"} ${cpTex}`, note: md`$${ekxTex(k)} > 0$, so the sign of $f'$ is the sign of $1 ${signed(k)}x$.${k < 0 ? " Dividing by a negative flips the inequality." : ""}` },
      { math: md`f \text{ is ${word} for } ${(wantInc ? incAnswer : decAnswer).replace("<", "\\lt ").replace(">", "\\gt ")}`, note: md`${word[0]!.toUpperCase() + word.slice(1)} where $f' ${wantInc ? ">" : "<"} 0$.` },
    ],
  };
};

const inflection: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const c = cubic(r);
    const x0 = (c.p + c.q) / 2;
    return {
      prompt: md`Find the $x$-coordinate(s) of the inflection points of $f(x) = ${c.text}$. Give them as a comma-separated list.`,
      answer: String(x0),
      form: "set",
      verify: [`${c.ddText} = 0`],
      hint: md`Differentiate twice and find where $f''$ changes sign. For a cubic, $f''$ is linear, so it changes sign at its single root.`,
      solution: [
        { math: md`f'(x) = ${c.dText}`, note: "First derivative." },
        { math: md`f''(x) = ${c.ddText}`, note: "Second derivative." },
        { math: md`f''(x) = 0 \;\Rightarrow\; x = ${x0}`, note: md`A line crosses zero, so $f''$ really changes sign here: concave ${c.s === 1 ? "down then up" : "up then down"}. This is an inflection point.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 3);
    const c1 = r.int(-5, 5);
    const d = r.int(-4, 6);
    const text = poly([[1, "x^4"], [-6 * k * k, "x^2"], [c1, "x"], [d, ""]]);
    return {
      prompt: md`Find the $x$-coordinate(s) of the inflection points of $f(x) = ${text}$. Give them as a comma-separated list.`,
      answer: setList([-k, k]),
      form: "set",
      verify: [`12x^2 - ${12 * k * k} = 0`],
      hint: md`$f''(x)$ is a quadratic. Solve $f''(x) = 0$ and check that the sign changes at each root.`,
      solution: [
        { math: md`f'(x) = ${poly([[4, "x^3"], [-12 * k * k, "x"], [c1, ""]])}`, note: "First derivative." },
        { math: md`f''(x) = 12x^2 - ${12 * k * k} = 12(x - ${k})(x + ${k})`, note: "Second derivative, factored." },
        { math: md`x = -${k}, \quad x = ${k}`, note: md`$f'' > 0$ outside the roots and $f'' < 0$ between them, so the concavity changes at both: two inflection points.` },
      ],
    };
  }
  const k = r.pick([-2, -1, 1, 2]);
  return {
    prompt: md`Find the $x$-coordinate of the inflection point of $f(x) = x${ekxTex(k)}$.`,
    answer: frac(-2, k),
    form: "set",
    verify: [`${k} ${ekxText(k)} (${poly([[k, "x"], [2, ""]])}) = 0`],
    hint: md`$f'(x) = ${ekxTex(k)}(1 ${signed(k)}x)$. Differentiate again with the product rule and factor out $${ekxTex(k)}$.`,
    solution: [
      { math: md`f'(x) = ${ekxTex(k)}(1 ${signed(k)}x)`, note: "Product rule." },
      { math: md`f''(x) = ${k === 1 ? "" : k}${ekxTex(k)}(1 ${signed(k)}x) + ${ekxTex(k)} \cdot ${k} = ${k === 1 ? "" : k}${ekxTex(k)}(2 ${signed(k)}x)`, note: "Product rule again, then factor." },
      { math: md`2 ${signed(k)}x = 0 \;\Rightarrow\; x = ${fracTex(-2, k)}`, note: md`The exponential never vanishes, and the linear factor changes sign, so this is an inflection point.` },
    ],
  };
};

const localExtremum: Generator = (r) => {
  if (r.next() < 0.7) {
    const c = cubic(r);
    const wantMax = r.next() < 0.5;
    // s = 1: f' goes + - + so p is a max, q a min. s = -1: swapped.
    const x0 = (c.s === 1) === wantMax ? c.p : c.q;
    const y0 = c.at(x0);
    const word = wantMax ? "maximum" : "minimum";
    return {
      prompt: md`Find the local ${word} point of $f(x) = ${c.text}$. Give it as $(x, y)$.`,
      answer: `(${x0}, ${y0})`,
      form: "tuple",
      verify: [`(${c.dText})^2 + (y - (${c.text}))^2 = 0`],
      hint: md`Find the critical points, then decide which is the ${word} with the first derivative test (sign of $f'$ on each side) or the second derivative test (sign of $f''$).`,
      solution: [
        { math: md`f'(x) = ${c.dFactored} = 0 \;\Rightarrow\; x = ${c.p}, ${c.q}`, note: "Critical points." },
        { math: md`f''(x) = ${c.ddText}, \qquad f''(${x0}) = ${6 * c.s * x0 - 3 * c.s * (c.p + c.q)}`, note: md`Second derivative test: $f''(${x0}) ${wantMax ? "< 0" : "> 0"}$, so $x = ${x0}$ is a local ${word}.` },
        { math: md`f(${x0}) = ${y0}`, note: md`The local ${word} point is $(${x0}, ${y0})$.` },
      ],
    };
  }
  const a = r.int(1, 3);
  const d = r.int(-4, 6);
  const text = poly([[1, "x^4"], [-2 * a * a, "x^2"], [d, ""]]);
  return {
    prompt: md`Find the local maximum point of $f(x) = ${text}$. Give it as $(x, y)$.`,
    answer: `(0, ${d})`,
    form: "tuple",
    verify: [`(4x^3 - ${4 * a * a}x)^2 + (y - (${text}))^2 = 0`],
    hint: md`There are three critical points. Only one of them has $f'' < 0$.`,
    solution: [
      { math: md`f'(x) = 4x(x - ${a})(x + ${a}) = 0 \;\Rightarrow\; x = -${a}, 0, ${a}`, note: "Critical points." },
      { math: md`f''(x) = 12x^2 - ${4 * a * a}, \qquad f''(0) = -${4 * a * a} < 0`, note: md`So $x = 0$ is a local maximum; at $\pm ${a}$, $f'' = ${8 * a * a} > 0$ gives local minima.` },
      { math: md`(0, ${d})`, note: md`$f(0) = ${d}$.` },
    ],
  };
};

// ── Lesson 4: Optimization ──────────────────────────────────────────────────

const fenceProblem: Generator = (r) => {
  const P = r.pick([120, 240, 360, 480, 600, 720]);
  const kind = r.int(0, 3);
  const setups: { m: number; n: number; story: string }[] = [
    { m: 2, n: 1, story: md`A farmer has ${P} m of fence for a rectangular field beside a straight river. No fence is needed along the river. Let $x$ be the length of each side perpendicular to the river and $y$ the side parallel to it.` },
    { m: 2, n: 2, story: md`A rectangular garden with sides $x$ and $y$ is to be enclosed by ${P} m of fence.` },
    { m: 3, n: 2, story: md`A rectangular pen with sides $x$ and $y$ is divided into two equal pens by a fence of length $x$ running parallel to the sides of length $x$. There are ${P} m of fence in total.` },
    { m: 4, n: 2, story: md`A rectangular pen with sides $x$ and $y$ is split into three equal pens by two fences of length $x$, each parallel to the sides of length $x$. There are ${P} m of fence in total.` },
  ];
  const { m, n, story } = setups[kind]!;
  const x0 = P / (2 * m);
  const y0 = P / (2 * n);
  return {
    prompt: md`${story} Find the dimensions that make the area as large as possible. Give them as $(x, y)$.`,
    answer: `(${x0}, ${y0})`,
    form: "tuple",
    verify: [`${m}x + ${n}y = ${P}`, `${m}x = ${n}y`],
    hint: md`The fence constraint is $${m}x + ${n}y = ${P}$. Solve it for $y$, write the area $A = xy$ as a function of $x$ alone, and set $A'(x) = 0$.`,
    solution: [
      { math: md`${m}x + ${n}y = ${P} \;\Rightarrow\; y = \frac{${P} - ${m}x}{${n}}`, note: `Count the fence: ${m} lengths of x and ${n} of y.` },
      { math: md`A(x) = x \cdot \frac{${P} - ${m}x}{${n}} = \frac{${P}x - ${m}x^2}{${n}}, \quad 0 \le x \le ${P / m}`, note: md`Area in one variable. At the ends of the domain the area is 0.` },
      { math: md`A'(x) = \frac{${P} - ${2 * m}x}{${n}} = 0 \;\Rightarrow\; x = ${x0}`, note: "The only critical point." },
      { math: md`A''(x) = -\frac{${2 * m}}{${n}} < 0`, note: "Concave down, so the critical point is the maximum (the endpoints give zero area anyway)." },
      { math: md`y = \frac{${P} - ${m} \cdot ${x0}}{${n}} = ${y0}, \qquad A = ${x0 * y0}\text{ m}^2`, note: md`Dimensions $(${x0}, ${y0})$.` },
    ],
  };
};

const BOXES: [number, number, string][] = [
  [12, 12, "2"],
  [18, 18, "3"],
  [24, 24, "4"],
  [30, 30, "5"],
  [36, 36, "6"],
  [5, 8, "1"],
  [10, 16, "2"],
  [15, 24, "3"],
  [20, 32, "4"],
  [8, 15, "5/3"],
  [16, 30, "10/3"],
  [24, 45, "5"],
  [3, 8, "2/3"],
  [6, 16, "4/3"],
  [9, 24, "2"],
  [12, 32, "8/3"],
  [7, 15, "3/2"],
  [14, 30, "3"],
];

const boxProblem: Generator = (r) => {
  const [a, b, x] = r.pick(BOXES);
  const square = a === b;
  const sum = a + b;
  // Roots of V'(x) = 12x^2 - 4(a+b)x + ab.
  const disc = Math.sqrt(16 * sum * sum - 48 * a * b);
  const big = (4 * sum + disc) / 24;
  const xTex = x.includes("/") ? `\\frac{${x.split("/")[0]}}{${x.split("/")[1]}}` : x;
  const bigTex = Number.isInteger(big) ? String(big) : fracTex(Math.round(big * 6), 6);
  return {
    prompt: md`An open-top box is made from a ${a} cm by ${b} cm sheet of cardboard by cutting equal squares of side $x$ from the four corners and folding up the sides. Find the value of $x$ that maximizes the volume. Give it exactly, in cm.`,
    answer: x,
    verify: [`12x^2 - ${4 * sum}x + ${a * b} = 0`],
    hint: md`The base is $(${a} - 2x)$ by $(${b} - 2x)$ and the height is $x$. Expand the volume, differentiate, and solve $V'(x) = 0$. Only roots with $0 < x < ${Math.min(a, b) / 2}$ make sense.`,
    solution: [
      { math: md`V(x) = x(${a} - 2x)(${b} - 2x), \quad 0 < x < ${Math.min(a, b) / 2}`, note: `Folding leaves a base of ${a} - 2x by ${b} - 2x; the height is the cut x.` },
      { math: md`V(x) = 4x^3 - ${2 * sum}x^2 + ${a * b}x`, note: "Expand." },
      { math: md`V'(x) = 12x^2 - ${4 * sum}x + ${a * b} = 0`, note: "Differentiate and set to zero." },
      {
        math: square ? md`V'(x) = (2x - ${a})(6x - ${a}) = 0 \;\Rightarrow\; x = \tfrac{${a}}{2}, \; \tfrac{${a}}{6}` : md`x = \frac{${4 * sum} \pm \sqrt{${16 * sum * sum} - ${48 * a * b}}}{24} = \frac{${4 * sum} \pm ${disc}}{24} \;\Rightarrow\; x = ${bigTex}, \; ${xTex}`,
        note: square ? md`$x = \frac{${a}}{2}$ cuts the sheet to nothing (volume 0), so it is the end of the domain, not a maximum.` : md`$x = ${bigTex}$ is outside the domain (it would use up the whole ${Math.min(a, b)} cm side).`,
      },
      { math: md`x = ${xTex}\text{ cm}`, note: md`$V' > 0$ to the left of $${xTex}$ and $V' < 0$ to the right (the parabola $V'$ opens up and this is its smaller root), so the volume is largest here.` },
    ],
  };
};

const minimizeDistance: Generator = (r) => {
  if (r.next() < 0.5) {
    const k = r.int(1, 5);
    const V = 2 * k ** 3;
    return {
      prompt: md`A closed cylindrical can must hold $${V}\pi$ cm$^3$. Find the radius $r$ (in cm) that minimizes the amount of metal used (the total surface area). Give it exactly.`,
      answer: String(k),
      verify: [`4 pi r - ${2 * V} pi / r^2 = 0`],
      hint: md`Volume $\pi r^2 h = ${V}\pi$ gives $h$ in terms of $r$. Substitute into $S = 2\pi r^2 + 2\pi r h$ and set $S'(r) = 0$.`,
      solution: [
        { math: md`\pi r^2 h = ${V}\pi \;\Rightarrow\; h = \frac{${V}}{r^2}`, note: "Use the volume constraint to eliminate h." },
        { math: md`S(r) = 2\pi r^2 + 2\pi r \cdot \frac{${V}}{r^2} = 2\pi r^2 + \frac{${2 * V}\pi}{r}, \quad r > 0`, note: "Two circular ends plus the side." },
        { math: md`S'(r) = 4\pi r - \frac{${2 * V}\pi}{r^2} = 0 \;\Rightarrow\; r^3 = ${k ** 3}`, note: md`Multiply through by $r^2$ and divide by $4\pi$.` },
        { math: md`r = ${k}\text{ cm}, \qquad h = \frac{${V}}{${k * k}} = ${2 * k}\text{ cm}`, note: md`$S'' = 4\pi + \frac{${4 * V}\pi}{r^3} > 0$, so this single critical point is the minimum. Note $h = 2r$: the best can is as tall as it is wide.` },
      ],
    };
  }
  for (;;) {
    const m = r.pick([1, -1, 2, -2, 3, -3]);
    const b = r.int(-5, 5);
    const p = r.int(-6, 6);
    const q = r.int(-6, 6);
    const numer = p + m * (q - b);
    const den = 1 + m * m;
    if (numer % den !== 0) continue;
    const x0 = numer / den;
    const y0 = m * x0 + b;
    if (q === m * p + b || (x0 === p && y0 === q)) continue;
    const line = poly([[m, "x"], [b, ""]]);
    return {
      prompt: md`Find the point on the line $y = ${line}$ that is closest to $(${p}, ${q})$. Give it as $(x, y)$.`,
      answer: `(${x0}, ${y0})`,
      form: "tuple",
      verify: [`y = ${line}`, `(x - ${paren(p)}) + ${paren(m)}(y - ${paren(q)}) = 0`],
      hint: md`A point on the line is $(x, ${line})$. Minimize the *squared* distance $D(x) = (x - ${paren(p)})^2 + (${line} - ${paren(q)})^2$; the square root only gets in the way and has the same minimum.`,
      solution: [
        { math: md`D(x) = (x ${signed(-p)})^2 + (${poly([[m, "x"], [b - q, ""]])})^2`, note: "Squared distance from the point to (x, mx + b)." },
        { math: md`D'(x) = 2(x ${signed(-p)}) + 2(${poly([[m, "x"], [b - q, ""]])}) \cdot ${paren(m)}`, note: "Chain rule on each square." },
        { math: md`D'(x) = ${2 * den}x ${signed(2 * (-p + m * (b - q)))} = 0 \;\Rightarrow\; x = ${x0}`, note: "Simplify and solve." },
        { math: md`y = ${m === 1 ? "" : m === -1 ? "-" : m}(${x0}) ${signed(b)} = ${y0}`, note: md`$D'' = ${2 * den} > 0$, so this is the minimum. The closest point is $(${x0}, ${y0})$; the segment to it is perpendicular to the line.` },
      ],
    };
  }
};

// ── Lesson 5: Linear approximation and Newton's method ──────────────────────

const linearization: Generator = (r) => {
  const kind = r.int(0, 5);
  let fTex: string;
  let a: number;
  let fa: string;
  let fpa: string;
  let faTex: string;
  let fpaTex: string;
  let derivTex: string;
  let answer: string;
  if (kind === 0) {
    const n = r.int(2, 7);
    a = n * n;
    fTex = "\\sqrt{x}";
    fa = String(n);
    faTex = fa;
    fpa = `1/${2 * n}`;
    fpaTex = `\\frac{1}{${2 * n}}`;
    derivTex = "\\frac{1}{2\\sqrt{x}}";
    answer = `${n} + (x - ${a})/${2 * n}`;
  } else if (kind === 1) {
    const n = r.int(2, 4);
    a = n ** 3;
    fTex = "\\sqrt[3]{x}";
    fa = String(n);
    faTex = fa;
    fpa = `1/${3 * n * n}`;
    fpaTex = `\\frac{1}{${3 * n * n}}`;
    derivTex = "\\frac{1}{3x^{2/3}}";
    answer = `${n} + (x - ${a})/${3 * n * n}`;
  } else if (kind === 2) {
    const k = r.int(2, 3);
    a = r.int(1, 3);
    fTex = `x^{${k}}`;
    fa = String(a ** k);
    faTex = fa;
    fpa = String(k * a ** (k - 1));
    fpaTex = fpa;
    derivTex = `${k}x^{${k - 1}}`;
    answer = `${fa} + ${fpa}(x - ${a})`;
  } else if (kind === 3) {
    a = r.int(2, 5);
    fTex = "\\frac{1}{x}";
    fa = `1/${a}`;
    faTex = `\\frac{1}{${a}}`;
    fpa = `-1/${a * a}`;
    fpaTex = `-\\frac{1}{${a * a}}`;
    derivTex = "-\\frac{1}{x^2}";
    answer = `1/${a} - (x - ${a})/${a * a}`;
  } else if (kind === 4) {
    const k = r.pick([1, 2, 3, -1]);
    a = 0;
    fTex = ekxTex(k);
    fa = "1";
    faTex = "1";
    fpa = String(k);
    fpaTex = fpa;
    derivTex = `${k === 1 ? "" : k}${ekxTex(k)}`;
    answer = poly([[k, "x"], [1, ""]]);
  } else {
    const pick = r.pick(["ln", "sin", "tan"]);
    if (pick === "ln") {
      a = 1;
      fTex = "\\ln x";
      fa = "0";
      faTex = "0";
      fpa = "1";
      fpaTex = "1";
      derivTex = "\\frac{1}{x}";
      answer = "x - 1";
    } else if (pick === "sin") {
      a = 0;
      fTex = "\\sin x";
      fa = "0";
      faTex = "0";
      fpa = "1";
      fpaTex = "1";
      derivTex = "\\cos x";
      answer = "x";
    } else {
      a = 0;
      fTex = "\\tan x";
      fa = "0";
      faTex = "0";
      fpa = "1";
      fpaTex = "1";
      derivTex = "\\sec^2 x";
      answer = "x";
    }
  }
  return {
    prompt: md`Find the linearization $L(x)$ of $f(x) = ${fTex}$ at $a = ${a}$. Give $L(x)$ as an expression in $x$.`,
    answer,
    verify: [`(L - (${fa}))/(x - ${a}) = ${fpa}`],
    hint: md`$L(x) = f(a) + f'(a)(x - a)$: the tangent line at $x = ${a}$. You need $f(${a})$ and $f'(${a})$.`,
    solution: [
      { math: md`f(${a}) = ${faTex}`, note: "The point of tangency." },
      { math: md`f'(x) = ${derivTex}, \qquad f'(${a}) = ${fpaTex}`, note: "The slope there." },
      { math: md`L(x) = ${faTex} + ${fpaTex === "1" ? "" : `\\left(${fpaTex}\\right)`}(x - ${a})`, note: md`$L(x) = f(a) + f'(a)(x - a)$.` },
    ],
  };
};

const estimateWithLinearization: Generator = (r) => {
  for (;;) {
    const kind = r.int(0, 3);
    if (kind === 0) {
      const n = r.int(2, 7);
      const a = n * n;
      const h = r.pick([0.1, 0.2, 0.3, 0.4, 0.5, -0.1, -0.2, -0.3]);
      const est = n + h / (2 * n);
      const key = rounded(est, 3);
      if (!key) continue;
      const target = num(a + h);
      return {
        prompt: md`Use the linearization of $f(x) = \sqrt{x}$ at $a = ${a}$ to estimate $\sqrt{${target}}$. Round to 3 decimal places.`,
        answer: key,
        tolerance: 0.0005,
        hint: md`$L(x) = ${n} + \dfrac{x - ${a}}{${2 * n}}$. Plug in $x = ${target}$.`,
        solution: [
          { math: md`L(x) = \sqrt{${a}} + \frac{1}{2\sqrt{${a}}}(x - ${a}) = ${n} + \frac{x - ${a}}{${2 * n}}`, note: md`Tangent line at $x = ${a}$.` },
          { math: md`\sqrt{${target}} \approx L(${target}) = ${n} + \frac{${num(h)}}{${2 * n}} = ${num(est)}`, note: md`The step from ${a} to ${target} is $${num(h)}$.` },
          { math: md`\sqrt{${target}} \approx ${key}`, note: md`The true value is $${Math.sqrt(a + h).toFixed(5)}$; the tangent line sits slightly above the curve on both sides because $\sqrt{x}$ is concave down.` },
        ],
      };
    }
    if (kind === 1) {
      const k = r.int(2, 3);
      const a = r.int(1, 3);
      const h = r.pick([0.1, 0.2, 0.05, -0.1, -0.2]);
      const est = a ** k + k * a ** (k - 1) * h;
      const key = rounded(est, 3);
      if (!key) continue;
      const target = num(a + h);
      return {
        prompt: md`Use the linearization of $f(x) = x^{${k}}$ at $a = ${a}$ to estimate $${target}^{${k}}$. Round to 3 decimal places.`,
        answer: key,
        tolerance: 0.0005,
        hint: md`$L(x) = ${a ** k} + ${k * a ** (k - 1)}(x - ${a})$. Evaluate at $x = ${target}$.`,
        solution: [
          { math: md`f(${a}) = ${a ** k}, \qquad f'(x) = ${k}x^{${k - 1}}, \qquad f'(${a}) = ${k * a ** (k - 1)}`, note: "Value and slope at the base point." },
          { math: md`L(${target}) = ${a ** k} + ${k * a ** (k - 1)}(${num(h)}) = ${num(est)}`, note: md`$x - a = ${num(h)}$.` },
          { math: md`${target}^{${k}} \approx ${key}`, note: md`Exactly, $${target}^{${k}} = ${num((a + h) ** k)}$. The error is roughly proportional to $(${num(h)})^2$.` },
        ],
      };
    }
    if (kind === 2) {
      const a = r.int(2, 5);
      const dx = r.pick([0.1, 0.2, 0.05, -0.1, -0.05]);
      const kind2 = r.pick(["x^2", "x^3", "sqrt"]);
      const fTex = kind2 === "sqrt" ? "\\sqrt{x}" : kind2;
      const fp = kind2 === "x^2" ? 2 * a : kind2 === "x^3" ? 3 * a * a : 1 / (2 * Math.sqrt(a));
      const fpTex = kind2 === "x^2" ? `2(${a}) = ${2 * a}` : kind2 === "x^3" ? `3(${a})^2 = ${3 * a * a}` : `\\frac{1}{2\\sqrt{${a}}}`;
      const dy = fp * dx;
      const key = rounded(dy, 3);
      if (!key || kind2 === "sqrt" && Number.isInteger(Math.sqrt(a)) === false && Math.abs(dy) < 0.005) continue;
      const derivTex = kind2 === "x^2" ? "2x" : kind2 === "x^3" ? "3x^2" : "\\frac{1}{2\\sqrt{x}}";
      return {
        prompt: md`Find the differential $dy$ when $y = ${fTex}$, $x = ${a}$ and $dx = ${num(dx)}$. Round to 3 decimal places.`,
        answer: key,
        tolerance: 0.0005,
        hint: md`$dy = f'(x)\,dx$. Compute $f'(${a})$ and multiply by $${num(dx)}$.`,
        solution: [
          { math: md`\frac{dy}{dx} = ${derivTex}, \qquad f'(${a}) = ${fpTex}`, note: "The derivative at the given x." },
          { math: md`dy = f'(${a})\,dx = ${kind2 === "sqrt" ? `\\frac{${num(dx)}}{2\\sqrt{${a}}}` : `${fp}(${num(dx)})`} = ${num(dy)}`, note: md`$dy$ is the change along the tangent line; the actual change $\Delta y$ is close to it when $dx$ is small.` },
          { math: md`dy \approx ${key}`, note: "Rounded to 3 decimal places." },
        ],
      };
    }
    const kind3 = r.pick(["ln", "exp", "sin"]);
    const h = r.pick([0.1, 0.05, 0.2, -0.1, -0.05]);
    const fTex = kind3 === "ln" ? "\\ln x" : kind3 === "exp" ? "e^{x}" : "\\sin x";
    const a = kind3 === "ln" ? 1 : 0;
    const L = kind3 === "ln" ? "x - 1" : kind3 === "exp" ? "1 + x" : "x";
    const est = kind3 === "exp" ? 1 + h : h;
    const key = rounded(est, 3);
    if (!key) continue;
    const target = num(a + h);
    const argTex = kind3 === "ln" ? `\\ln(${target})` : kind3 === "exp" ? `e^{${target}}` : `\\sin(${target})`;
    const exact = kind3 === "ln" ? Math.log(1 + h) : kind3 === "exp" ? Math.exp(h) : Math.sin(h);
    return {
      prompt: md`Use the linearization of $f(x) = ${fTex}$ at $a = ${a}$ to estimate $${argTex}$. Round to 3 decimal places.`,
      answer: key,
      tolerance: 0.0005,
      hint: md`At $a = ${a}$, $f(a) = ${kind3 === "exp" ? 1 : 0}$ and $f'(a) = 1$, so $L(x) = ${L}$.`,
      solution: [
        { math: md`L(x) = ${L}`, note: md`$f(${a}) = ${kind3 === "exp" ? 1 : 0}$ and $f'(${a}) = 1$ (the derivative of $${fTex}$ is $${kind3 === "ln" ? "1/x" : kind3 === "exp" ? "e^x" : "\\cos x"}$).` },
        { math: md`${argTex} \approx L(${target}) = ${key}`, note: md`The exact value is $${exact.toFixed(5)}$.` },
      ],
    };
  }
};

const newtonStep: Generator = (r) => {
  for (;;) {
    const kind = r.int(0, 3);
    let fTex: string;
    let fpTex: string;
    let f: (x: number) => number;
    let fp: (x: number) => number;
    let x0: number;
    let rootTex: string;
    if (kind === 0) {
      const N = r.pick([2, 3, 5, 6, 7, 10, 11, 13, 15, 17]);
      x0 = r.pick([Math.floor(Math.sqrt(N)), Math.ceil(Math.sqrt(N))]);
      fTex = `x^2 - ${N}`;
      fpTex = "2x";
      f = (x) => x * x - N;
      fp = (x) => 2 * x;
      rootTex = `\\sqrt{${N}}`;
    } else if (kind === 1) {
      const N = r.pick([2, 3, 5, 7, 9, 10, 20, 30]);
      x0 = r.pick([Math.floor(Math.cbrt(N)), Math.ceil(Math.cbrt(N))]);
      fTex = `x^3 - ${N}`;
      fpTex = "3x^2";
      f = (x) => x ** 3 - N;
      fp = (x) => 3 * x * x;
      rootTex = `\\sqrt[3]{${N}}`;
    } else if (kind === 2) {
      const [a, b, s] = r.pick([
        [-2, -5, 2],
        [1, -1, 1],
        [-3, 1, 2],
        [2, -4, 1],
        [-4, -2, 2],
        [3, -5, 1],
      ] as const);
      x0 = s;
      fTex = poly([[1, "x^3"], [a, "x"], [b, ""]]);
      fpTex = poly([[3, "x^2"], [a, ""]]);
      f = (x) => x ** 3 + a * x + b;
      fp = (x) => 3 * x * x + a;
      rootTex = "\\text{the real root}";
    } else {
      x0 = r.pick([1, 0.5]);
      fTex = "\\cos x - x";
      fpTex = "-\\sin x - 1";
      f = (x) => Math.cos(x) - x;
      fp = (x) => -Math.sin(x) - 1;
      rootTex = "\\text{the solution of } \\cos x = x";
    }
    const steps = r.int(1, 2);
    const xs = [x0];
    for (let i = 0; i < steps; i++) xs.push(xs[i]! - f(xs[i]!) / fp(xs[i]!));
    const key = rounded(xs[steps]!, 3);
    if (!key) continue;
    const show = (x: number) => (Number.isInteger(x) ? String(x) : Number(x.toFixed(6)).toString());
    const solution: Step[] = [
      { math: md`x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}, \qquad f'(x) = ${fpTex}`, note: "Newton's iteration: the x-intercept of the tangent line." },
    ];
    for (let i = 0; i < steps; i++) {
      const x = xs[i]!;
      solution.push({
        math: md`x_{${i + 1}} = ${show(x)} - \frac{${show(f(x))}}{${show(fp(x))}} = ${show(xs[i + 1]!)}`,
        note: i === 0 ? md`Substitute $x_0 = ${show(x0)}$ into $f$ and $f'$.` : "Keep full precision from the previous step before rounding at the end.",
      });
    }
    solution.push({ math: md`x_{${steps}} \approx ${key}`, note: md`Each step roughly doubles the number of correct digits of $${rootTex}$.` });
    return {
      prompt: md`Apply Newton's method to $f(x) = ${fTex}$ starting from $x_0 = ${show(x0)}$. Find $x_{${steps}}$, rounded to 3 decimal places.`,
      answer: key,
      tolerance: 0.0005,
      hint: md`$x_{n+1} = x_n - \dfrac{f(x_n)}{f'(x_n)}$ with $f'(x) = ${fpTex}$.${steps === 2 ? " Do the step twice, keeping all the digits of $x_1$." : ""}`,
      solution,
    };
  }
};

// ── Lesson 6: L'Hôpital's rule ──────────────────────────────────────────────

const zeroOverZero: Generator = (r) => {
  const kind = r.int(0, 8);
  const lim = (body: string, at = "0") => md`Find $\lim_{x \to ${at}} ${body}$. Give the exact value.`;
  const form = "Check the form first: top and bottom both go to 0, so L'Hôpital's rule applies. Differentiate the top and the bottom separately (not the quotient rule).";
  if (kind === 0) {
    const k = r.pick([2, 3, 4, 5, -2, -3]);
    return {
      prompt: lim(`\\frac{${ekxTex(k)} - 1}{x}`),
      answer: String(k),
      hint: md`${form}`,
      solution: [
        { math: md`\frac{${ekxTex(k)} - 1}{x} \to \frac{0}{0}`, note: md`$e^0 - 1 = 0$: indeterminate.` },
        { math: md`\lim_{x \to 0} \frac{${k}${ekxTex(k)}}{1} = ${k}`, note: md`Derivative of the top is $${k}${ekxTex(k)}$, of the bottom is 1. Substitute $x = 0$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(2, 6);
    const m = r.pick([1, 2, 3, 4].filter((v) => v !== k));
    return {
      prompt: lim(`\\frac{\\sin(${k}x)}{${m === 1 ? "x" : `\\sin(${m}x)`}}`),
      answer: frac(k, m),
      hint: md`${form}`,
      solution: [
        { math: md`\frac{\sin(${k}x)}{${m === 1 ? "x" : `\\sin(${m}x)`}} \to \frac{0}{0}`, note: "Indeterminate." },
        { math: md`\lim_{x \to 0} \frac{${k}\cos(${k}x)}{${m === 1 ? "1" : `${m}\\cos(${m}x)`}} = \frac{${k} \cdot 1}{${m}${m === 1 ? "" : " \\cdot 1"}} = ${fracTex(k, m)}`, note: md`Chain rule on each side, then $\cos 0 = 1$. (This agrees with $\sin(kx) \approx kx$ near 0.)` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(2, 5);
    const m = r.pick([1, 2, 3].filter((v) => v !== k));
    return {
      prompt: lim(`\\frac{x^{${k}} - 1}{x^{${m}} - 1}`, "1"),
      answer: frac(k, m),
      hint: md`${form}`,
      solution: [
        { math: md`\frac{x^{${k}} - 1}{x^{${m}} - 1} \to \frac{0}{0} \text{ as } x \to 1`, note: "Indeterminate." },
        { math: md`\lim_{x \to 1} \frac{${k}x^{${k - 1}}}{${m === 1 ? "1" : `${m}x^{${m - 1}}`}} = ${fracTex(k, m)}`, note: md`Power rule top and bottom, then $x = 1$.` },
      ],
    };
  }
  if (kind === 3) {
    const a = r.pick([1, 4, 9, 16, 25]);
    const s = Math.sqrt(a);
    return {
      prompt: lim(`\\frac{\\sqrt{x + ${a}} - ${s}}{x}`),
      answer: `1/${2 * s}`,
      hint: md`${form} The derivative of $\sqrt{x + ${a}}$ is $\dfrac{1}{2\sqrt{x + ${a}}}$.`,
      solution: [
        { math: md`\frac{\sqrt{x + ${a}} - ${s}}{x} \to \frac{0}{0}`, note: md`$\sqrt{${a}} - ${s} = 0$.` },
        { math: md`\lim_{x \to 0} \frac{\frac{1}{2\sqrt{x + ${a}}}}{1} = \frac{1}{2\sqrt{${a}}} = \frac{1}{${2 * s}}`, note: "Differentiate top and bottom. The same answer comes from multiplying by the conjugate." },
      ],
    };
  }
  if (kind === 4) {
    const a = r.int(1, 5);
    return {
      prompt: lim(`\\frac{\\ln x - \\ln ${a}}{x - ${a}}`, String(a)),
      answer: `1/${a}`,
      hint: md`${form}`,
      solution: [
        { math: md`\frac{\ln x - \ln ${a}}{x - ${a}} \to \frac{0}{0} \text{ as } x \to ${a}`, note: "Indeterminate." },
        { math: md`\lim_{x \to ${a}} \frac{1/x}{1} = \frac{1}{${a}}`, note: md`This is just the definition of the derivative of $\ln x$ at $${a}$, in disguise.` },
      ],
    };
  }
  if (kind === 5) {
    const k = r.pick([2, 3, 4]);
    const m = r.pick([1, 2, 3, 5].filter((v) => v !== k));
    return {
      prompt: lim(`\\frac{\\tan(${k}x)}{${ekxTex(m)} - 1}`),
      answer: frac(k, m),
      hint: md`${form} The derivative of $\tan(${k}x)$ is $${k}\sec^2(${k}x)$.`,
      solution: [
        { math: md`\frac{\tan(${k}x)}{${ekxTex(m)} - 1} \to \frac{0}{0}`, note: "Indeterminate." },
        { math: md`\lim_{x \to 0} \frac{${k}\sec^2(${k}x)}{${m === 1 ? "" : m}${ekxTex(m)}} = \frac{${k} \cdot 1}{${m} \cdot 1} = ${fracTex(k, m)}`, note: md`$\sec 0 = 1$ and $e^0 = 1$.` },
      ],
    };
  }
  if (kind === 6) {
    const a = r.pick([2, 3, 5, 10]);
    return {
      prompt: lim(`\\frac{${a}^{x} - 1}{x}`),
      answer: `ln(${a})`,
      hint: md`${form} Remember $\dfrac{d}{dx} ${a}^x = ${a}^x \ln ${a}$.`,
      solution: [
        { math: md`\frac{${a}^x - 1}{x} \to \frac{0}{0}`, note: "Indeterminate." },
        { math: md`\lim_{x \to 0} \frac{${a}^x \ln ${a}}{1} = \ln ${a}`, note: md`$${a}^0 = 1$. The slope of $${a}^x$ at 0 is $\ln ${a}$, which is what this limit measures.` },
      ],
    };
  }
  if (kind === 7) {
    const k = r.int(2, 5);
    return {
      prompt: lim(`\\frac{\\arctan(${k}x)}{x}`),
      answer: String(k),
      hint: md`${form} The derivative of $\arctan(${k}x)$ is $\dfrac{${k}}{1 + ${k * k}x^2}$.`,
      solution: [
        { math: md`\frac{\arctan(${k}x)}{x} \to \frac{0}{0}`, note: "Indeterminate." },
        { math: md`\lim_{x \to 0} \frac{${k}/(1 + ${k * k}x^2)}{1} = ${k}`, note: md`Substitute $x = 0$.` },
      ],
    };
  }
  // Not indeterminate at all: a trap.
  const k = r.int(2, 5);
  const m = r.int(1, 4);
  return {
    prompt: lim(`\\frac{\\cos(${m}x) + ${k - 1}}{${ekxTex(1)} + ${k - 1}}`),
    answer: "1",
    hint: md`Check the form before reaching for L'Hôpital. Is the top actually 0 at $x = 0$?`,
    solution: [
      { math: md`\frac{\cos(0) + ${k - 1}}{e^0 + ${k - 1}} = \frac{${k}}{${k}} = 1`, note: md`Both parts are continuous and the bottom isn't zero, so just substitute. L'Hôpital would give the wrong answer here: $\frac{-${m}\sin 0}{e^0} = 0$.` },
    ],
  };
};

const infinityForms: Generator = (r) => {
  const kind = r.int(0, 7);
  const lim = (body: string, at: string) => md`Find $\lim_{x \to ${at}} ${body}$. Give the exact value.`;
  if (kind === 0) {
    const k = r.int(1, 3);
    return {
      prompt: lim(`\\frac{\\ln x}{x${k === 1 ? "" : `^{${k}}`}}`, "\\infty"),
      answer: "0",
      hint: md`Form $\infty/\infty$. Differentiate top and bottom.`,
      solution: [
        { math: md`\frac{\ln x}{x${k === 1 ? "" : `^{${k}}`}} \to \frac{\infty}{\infty}`, note: "Indeterminate." },
        { math: md`\lim_{x \to \infty} \frac{1/x}{${k === 1 ? "1" : `${k}x^{${k - 1}}`}} = \lim_{x \to \infty} \frac{1}{${k === 1 ? "x" : `${k}x^{${k}}`}} = 0`, note: md`Logarithms grow slower than any positive power of $x$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 4);
    return {
      prompt: lim(`\\frac{x^{${k}}}{e^{x}}`, "\\infty"),
      answer: "0",
      hint: md`Form $\infty/\infty$. You may need the rule ${k} times; each time the power drops by one and $e^x$ stays put.`,
      solution: [
        { math: md`\frac{x^{${k}}}{e^x} \to \frac{\infty}{\infty}`, note: "Indeterminate." },
        { math: k === 1 ? md`\lim_{x \to \infty} \frac{1}{e^x} = 0` : md`\lim_{x \to \infty} \frac{${k}x^{${k - 1}}}{e^x} = \cdots = \lim_{x \to \infty} \frac{${Array.from({ length: k }, (_, i) => k - i).reduce((a, b) => a * b, 1)}}{e^x} = 0`, note: md`${k === 1 ? "One application." : `Apply the rule ${k} times; the form stays $\\infty/\\infty$ until the top is the constant $${k}!$.`} Exponentials beat powers.` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(1, 3);
    return {
      prompt: lim(`x${k === 1 ? "" : `^{${k}}`} \\ln x`, "0^+"),
      answer: "0",
      hint: md`Form $0 \cdot (-\infty)$. Rewrite as $\dfrac{\ln x}{x^{-${k}}}$, which is $\dfrac{-\infty}{\infty}$, then apply the rule.`,
      solution: [
        { math: md`x${k === 1 ? "" : `^{${k}}`} \ln x = \frac{\ln x}{x^{-${k}}} \to \frac{-\infty}{\infty}`, note: "Move the power downstairs as a negative power." },
        { math: md`\lim_{x \to 0^+} \frac{1/x}{-${k}x^{-${k + 1}}} = \lim_{x \to 0^+} \frac{x^{${k}}}{-${k}} = 0`, note: md`$\frac{1/x}{-${k}x^{-${k + 1}}} = -\frac{x^{${k + 1}}}{${k}x} = -\frac{x^{${k}}}{${k}}$. The power wins against the logarithm.` },
      ],
    };
  }
  if (kind === 3) {
    const k = r.int(2, 6);
    return {
      prompt: lim(`x \\sin\\left(\\frac{${k}}{x}\\right)`, "\\infty"),
      answer: String(k),
      hint: md`Form $\infty \cdot 0$. Write it as $\dfrac{\sin(${k}/x)}{1/x}$, a $0/0$ form.`,
      solution: [
        { math: md`x \sin\left(\tfrac{${k}}{x}\right) = \frac{\sin(${k}/x)}{1/x} \to \frac{0}{0}`, note: "Divide by the reciprocal instead of multiplying." },
        { math: md`\lim_{x \to \infty} \frac{\cos(${k}/x) \cdot (-${k}/x^2)}{-1/x^2} = \lim_{x \to \infty} ${k}\cos\left(\tfrac{${k}}{x}\right) = ${k}`, note: md`Chain rule on top; the $-1/x^2$ factors cancel and $\cos 0 = 1$.` },
      ],
    };
  }
  if (kind === 4) {
    const k = r.int(2, 6);
    return {
      prompt: lim(`x\\left(e^{${k}/x} - 1\\right)`, "\\infty"),
      answer: String(k),
      hint: md`Form $\infty \cdot 0$. Rewrite as $\dfrac{e^{${k}/x} - 1}{1/x}$.`,
      solution: [
        { math: md`\frac{e^{${k}/x} - 1}{1/x} \to \frac{0}{0}`, note: "Divide by the reciprocal." },
        { math: md`\lim_{x \to \infty} \frac{e^{${k}/x} \cdot (-${k}/x^2)}{-1/x^2} = \lim_{x \to \infty} ${k}e^{${k}/x} = ${k}`, note: md`$e^{${k}/x} \to e^0 = 1$.` },
      ],
    };
  }
  if (kind === 5) {
    const k = r.int(2, 6);
    return {
      prompt: lim(`x \\ln\\left(1 + \\frac{${k}}{x}\\right)`, "\\infty"),
      answer: String(k),
      hint: md`Form $\infty \cdot 0$. Rewrite as $\dfrac{\ln(1 + ${k}/x)}{1/x}$.`,
      solution: [
        { math: md`\frac{\ln(1 + ${k}/x)}{1/x} \to \frac{0}{0}`, note: "Divide by the reciprocal." },
        { math: md`\lim_{x \to \infty} \frac{\frac{1}{1 + ${k}/x} \cdot (-${k}/x^2)}{-1/x^2} = \lim_{x \to \infty} \frac{${k}}{1 + ${k}/x} = ${k}`, note: md`This limit is the logarithm of $\lim (1 + ${k}/x)^x$, which is therefore $e^{${k}}$.` },
      ],
    };
  }
  if (kind === 6) {
    const k = r.pick([2, 4, 6, 8]);
    return {
      prompt: lim(`\\left(\\sqrt{x^2 + ${k}x} - x\\right)`, "\\infty"),
      answer: String(k / 2),
      hint: md`Form $\infty - \infty$. Factor out $x$: $x\left(\sqrt{1 + ${k}/x} - 1\right)$, then write it as $\dfrac{\sqrt{1 + ${k}/x} - 1}{1/x}$.`,
      solution: [
        { math: md`\sqrt{x^2 + ${k}x} - x = \frac{\sqrt{1 + ${k}/x} - 1}{1/x} \to \frac{0}{0}`, note: md`For $x > 0$, $\sqrt{x^2 + ${k}x} = x\sqrt{1 + ${k}/x}$.` },
        { math: md`\lim_{x \to \infty} \frac{\frac{1}{2\sqrt{1 + ${k}/x}} \cdot (-${k}/x^2)}{-1/x^2} = \frac{${k}}{2} = ${k / 2}`, note: md`The $-1/x^2$ cancels and $\sqrt{1 + 0} = 1$. Multiplying by the conjugate gives the same answer.` },
      ],
    };
  }
  const k = r.int(1, 3);
  const m = r.int(1, 3);
  return {
    prompt: lim(`x^{${k}} ${ekxTex(-m)}`, "\\infty"),
    answer: "0",
    hint: md`Form $\infty \cdot 0$. Write it as $\dfrac{x^{${k}}}{e^{${m}x}}$ and apply the rule ${k === 1 ? "once" : `${k} times`}.`,
    solution: [
      { math: md`x^{${k}}e^{-${m}x} = \frac{x^{${k}}}{e^{${m}x}} \to \frac{\infty}{\infty}`, note: "A negative exponent is a reciprocal." },
      { math: md`\lim_{x \to \infty} \frac{${k === 1 ? "1" : `${k}!`}}{${m ** k === 1 ? "" : m ** k}e^{${m}x}} = 0`, note: md`After ${k} application${k === 1 ? "" : "s"} the top is constant and the bottom still grows without bound.` },
    ],
  };
};

const powerForms: Generator = (r) => {
  const kind = r.int(0, 5);
  const lim = (body: string, at: string) => md`Find $\lim_{x \to ${at}} ${body}$. Give the exact value (write e for Euler's number, like e^2).`;
  const logTrick = "Take the logarithm: find the limit of the log, then exponentiate. The log turns the power into a product, which you rewrite as a quotient.";
  if (kind === 0) {
    const k = r.pick([2, 3, 4, -1, -2]);
    return {
      prompt: lim(`\\left(1 + \\frac{${k}}{x}\\right)^{x}`, "\\infty"),
      answer: `e^(${k})`,
      hint: md`Form $1^{\infty}$. ${logTrick}`,
      solution: [
        { math: md`y = \left(1 + \tfrac{${k}}{x}\right)^x, \qquad \ln y = x\ln\left(1 + \tfrac{${k}}{x}\right) = \frac{\ln(1 + ${k}/x)}{1/x}`, note: "The log brings the exponent down." },
        { math: md`\lim_{x \to \infty} \ln y = \lim_{x \to \infty} \frac{\frac{1}{1 + ${k}/x} \cdot (-${k}/x^2)}{-1/x^2} = ${k}`, note: md`A $0/0$ form; L'Hôpital.` },
        { math: md`\lim_{x \to \infty} y = e^{${k}}`, note: md`$e^x$ is continuous, so the limit of $y = e^{\ln y}$ is $e^{\lim \ln y}$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.pick([2, 3, 5, -1, -3]);
    return {
      prompt: lim(`(1 + ${k}x)^{1/x}`, "0"),
      answer: `e^(${k})`,
      hint: md`Form $1^{\infty}$. ${logTrick}`,
      solution: [
        { math: md`\ln y = \frac{\ln(1 + ${k}x)}{x} \to \frac{0}{0}`, note: "Log of the expression." },
        { math: md`\lim_{x \to 0} \frac{${k}/(1 + ${k}x)}{1} = ${k}`, note: "L'Hôpital." },
        { math: md`\lim_{x \to 0} (1 + ${k}x)^{1/x} = e^{${k}}`, note: "Exponentiate." },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(1, 3);
    const m = r.int(2, 4);
    return {
      prompt: lim(`\\left(1 + \\frac{${k}}{x}\\right)^{${m}x}`, "\\infty"),
      answer: `e^(${k * m})`,
      hint: md`Form $1^{\infty}$. ${logTrick}`,
      solution: [
        { math: md`\ln y = ${m}x\ln\left(1 + \tfrac{${k}}{x}\right) = ${m} \cdot \frac{\ln(1 + ${k}/x)}{1/x}`, note: "Log, then divide by the reciprocal." },
        { math: md`\lim_{x \to \infty} \frac{\ln(1 + ${k}/x)}{1/x} = \lim_{x \to \infty} \frac{${k}}{1 + ${k}/x} = ${k}`, note: "L'Hôpital on the 0/0 quotient." },
        { math: md`\lim \ln y = ${m} \cdot ${k} = ${k * m}, \qquad \lim y = e^{${k * m}}`, note: "Exponentiate." },
      ],
    };
  }
  if (kind === 3) {
    return {
      prompt: lim(`x^{1/x}`, "\\infty"),
      answer: "1",
      hint: md`Form $\infty^{0}$. ${logTrick}`,
      solution: [
        { math: md`\ln y = \frac{\ln x}{x} \to \frac{\infty}{\infty}`, note: "Log of the expression." },
        { math: md`\lim_{x \to \infty} \frac{1/x}{1} = 0`, note: "L'Hôpital." },
        { math: md`\lim_{x \to \infty} x^{1/x} = e^0 = 1`, note: "Exponentiate." },
      ],
    };
  }
  if (kind === 4) {
    return {
      prompt: lim(`x^{x}`, "0^+"),
      answer: "1",
      hint: md`Form $0^{0}$. ${logTrick} You will meet $x \ln x$.`,
      solution: [
        { math: md`\ln y = x\ln x = \frac{\ln x}{1/x} \to \frac{-\infty}{\infty}`, note: "Log of the expression, rewritten as a quotient." },
        { math: md`\lim_{x \to 0^+} \frac{1/x}{-1/x^2} = \lim_{x \to 0^+} (-x) = 0`, note: "L'Hôpital." },
        { math: md`\lim_{x \to 0^+} x^x = e^0 = 1`, note: md`$0^0$ is indeterminate in general, but this particular limit is 1.` },
      ],
    };
  }
  const k = r.int(2, 5);
  return {
    prompt: lim(`(1 + \\sin(${k}x))^{1/x}`, "0"),
    answer: `e^(${k})`,
    hint: md`Form $1^{\infty}$. ${logTrick}`,
    solution: [
      { math: md`\ln y = \frac{\ln(1 + \sin(${k}x))}{x} \to \frac{0}{0}`, note: "Log of the expression." },
      { math: md`\lim_{x \to 0} \frac{${k}\cos(${k}x)/(1 + \sin(${k}x))}{1} = \frac{${k} \cdot 1}{1 + 0} = ${k}`, note: "L'Hôpital with the chain rule." },
      { math: md`\lim_{x \to 0} (1 + \sin(${k}x))^{1/x} = e^{${k}}`, note: "Exponentiate." },
    ],
  };
};

// ── The unit ────────────────────────────────────────────────────────────────

export const unit5: Unit = {
  title: "Applications of Derivatives",
  lessons: [
    {
      id: slug("Extreme values"),
      title: "Extreme values",
      summary: "Where a function is biggest or smallest, why the derivative must vanish there, and how to find the extremes on a closed interval.",
      blocks: [
        {
          kind: "text",
          body: md`The most useful questions about a function are often the most basic: where is it biggest, and where is it smallest? The highest profit, the least material, the fastest route. This unit is about using the derivative to answer them. The first step is to say exactly what "biggest" means, because there are two kinds.`,
        },
        {
          kind: "key",
          title: "Absolute and local extrema",
          body: md`$f$ has an **absolute maximum** at $c$ if $f(c) \ge f(x)$ for every $x$ in the domain. The number $f(c)$ is the **maximum value**. An **absolute minimum** is defined the same way with $\le$.

$f$ has a **local maximum** at $c$ if $f(c) \ge f(x)$ for all $x$ in some open interval around $c$: it beats its neighbours, not necessarily everyone. **Local minimum** likewise.

Together these are **extreme values** or **extrema**. An absolute extremum at an interior point is also a local one; a local extremum need not be absolute.`,
        },
        {
          kind: "plot",
          x: [-2, 3],
          y: [-3, 9],
          curves: [{ expr: "x^3 - 3x", label: "f(x) = x^3 - 3x", domain: [-1.5, 2.5] }],
          points: [
            { x: -1.5, y: 1.125, label: "(-1.5,\\ 1.125)", color: 2 },
            { x: -1, y: 2, label: "\\text{local max}", color: 3 },
            { x: 1, y: -2, label: "\\text{absolute min}", color: 4 },
            { x: 2.5, y: 8.125, label: "\\text{absolute max}", color: 4 },
          ],
          caption: md`$f(x) = x^3 - 3x$ on $[-1.5, 2.5]$. The hilltop at $x = -1$ is a local maximum but not the absolute one: the right-hand endpoint is higher. The valley at $x = 1$ is both local and absolute. Endpoints can be absolute extrema without being hilltops or valleys at all.`,
        },
        {
          kind: "text",
          body: md`Look at the two interior extremes in the picture. At the top of the hill and the bottom of the valley the tangent line is horizontal. That is not a coincidence, and it is the whole reason derivatives help with this problem.`,
        },
        {
          kind: "why",
          title: "Why the tangent is flat at a peak",
          body: md`Suppose $f$ has a local maximum at $c$ and the derivative $f'(c)$ exists. Step a little to the right: $f(c + h) \le f(c)$, so the difference quotient $\dfrac{f(c + h) - f(c)}{h}$ has a non-positive top and a positive bottom. It is $\le 0$, and so is its limit. Step a little to the left: the top is still $\le 0$ but now $h < 0$, so the quotient is $\ge 0$, and so is its limit.

The derivative exists, so both one-sided limits equal $f'(c)$. A number that is both $\le 0$ and $\ge 0$ is $0$. That argument, written carefully, is Fermat's theorem.`,
        },
        {
          kind: "proof",
          title: "Fermat's theorem",
          given: md`$f$ has a local maximum at $c$, and $f'(c)$ exists.`,
          prove: md`$f'(c) = 0$.`,
          steps: [
            { statement: md`There is a $\delta > 0$ with $f(c + h) \le f(c)$ whenever $|h| < \delta$.`, reason: "Definition of local maximum." },
            { statement: md`For $0 < h < \delta$: $\dfrac{f(c + h) - f(c)}{h} \le 0$.`, reason: md`The numerator is $\le 0$ and $h > 0$.` },
            { statement: md`$\displaystyle\lim_{h \to 0^+} \frac{f(c + h) - f(c)}{h} \le 0$.`, reason: md`A limit of values that are all $\le 0$ is $\le 0$ (if it were positive, the values would eventually be positive).` },
            { statement: md`$f'(c) \le 0$.`, reason: md`$f'(c)$ exists, so it equals this one-sided limit.` },
            { statement: md`For $-\delta < h < 0$: $\dfrac{f(c + h) - f(c)}{h} \ge 0$.`, reason: md`The numerator is $\le 0$ and $h < 0$: dividing by a negative flips the sign.` },
            { statement: md`$f'(c) \ge 0$.`, reason: "The same limit argument from the left." },
            { statement: md`$f'(c) = 0$.`, reason: md`$f'(c) \le 0$ and $f'(c) \ge 0$. (For a local minimum, apply this to $-f$.)` },
          ],
        },
        {
          kind: "key",
          title: "Critical points",
          body: md`A **critical point** of $f$ is a number $c$ in the domain where $f'(c) = 0$ or $f'(c)$ does not exist.

Fermat's theorem, restated: **if $f$ has a local extremum at $c$, then $c$ is a critical point.** So the search for local extrema can be narrowed to the critical points. Nothing else is in the running.`,
        },
        {
          kind: "why",
          title: "Why critical points are only candidates",
          body: md`Fermat's theorem runs one way. Every local extremum is a critical point, but not every critical point is an extremum. $f(x) = x^3$ has $f'(0) = 0$, yet $0$ is neither a peak nor a valley: the graph flattens for an instant and keeps climbing.

And the "does not exist" case matters. $f(x) = |x|$ has an obvious minimum at $0$, but there is no tangent line there, so $f'(0) = 0$ never gets a chance to happen. If we only looked where $f' = 0$ we would miss it. That is why the definition of critical point includes points where $f'$ is undefined.`,
        },
        {
          kind: "plot",
          x: [-2, 2],
          y: [-2, 3],
          curves: [
            { expr: "x^3", label: "y = x^3" },
            { expr: "abs(x)", label: "y = |x|", color: 2 },
          ],
          points: [{ x: 0, y: 0, label: "0" }],
          caption: md`Two critical points at $x = 0$. For $x^3$, $f'(0) = 0$ but there is no extremum. For $|x|$, $f'(0)$ doesn't exist and there is a minimum. Critical points are where to look, not a guarantee.`,
        },
        {
          kind: "key",
          title: "The extreme value theorem",
          body: md`If $f$ is **continuous** on a **closed** interval $[a, b]$, then $f$ attains an absolute maximum value and an absolute minimum value somewhere on $[a, b]$.

The proof needs a deep property of the real numbers (that they have no gaps), so we take the theorem as given here. Both hypotheses are essential, as the next picture shows.`,
        },
        {
          kind: "plot",
          x: [0, 2.5],
          y: [0, 6],
          curves: [{ expr: "1/x", domain: [0.17, 2], color: 2, label: "y = 1/x \\text{ on } (0, 2]" }],
          points: [{ x: 2, y: 0.5, color: 2 }],
          caption: md`$1/x$ on $(0, 2]$ has a minimum value $\tfrac12$ but no maximum: as $x \to 0^+$ the values climb past every number. The interval isn't closed at 0, and the theorem's promise is off. Likewise $f(x) = x$ on the open interval $(0, 1)$ has no largest value: whatever you pick, something a little to the right is bigger. And a function with a jump can miss its extreme too.`,
        },
        {
          kind: "text",
          body: md`Put the two theorems together. On a closed interval a continuous function *has* an absolute maximum. Where can it be? Either at an endpoint, or at an interior point. An interior absolute maximum is also a local maximum, so by Fermat it is a critical point. That leaves a short list of candidates, and checking a short list is easy.`,
        },
        {
          kind: "key",
          title: "The closed interval method",
          body: md`To find the absolute extrema of a continuous $f$ on $[a, b]$:

- Find the critical points of $f$ in $(a, b)$ and evaluate $f$ at each.
- Evaluate $f(a)$ and $f(b)$.
- The largest of these values is the absolute maximum; the smallest is the absolute minimum.

No further test is needed. The extreme value theorem says the extremes exist, and Fermat says they are in the list.`,
        },
        {
          kind: "example",
          title: "A cubic on a closed interval",
          problem: md`Find the absolute maximum and minimum of $f(x) = 2x^3 - 3x^2 - 12x + 5$ on $[-2, 3]$.`,
          steps: [
            { math: md`f'(x) = 6x^2 - 6x - 12 = 6(x - 2)(x + 1)`, note: "Differentiate and factor." },
            { math: md`x = -1, \quad x = 2`, note: md`Both critical points lie inside $(-2, 3)$. The derivative exists everywhere, so there are no others.` },
            { math: md`f(-2) = 1, \quad f(-1) = 12, \quad f(2) = -15, \quad f(3) = -4`, note: "Evaluate at the two endpoints and the two critical points." },
            { math: md`\text{max } 12 \text{ at } x = -1, \qquad \text{min } -15 \text{ at } x = 2`, note: "Pick the largest and smallest from the list. Here both extremes happen to be interior." },
          ],
        },
        {
          kind: "example",
          title: "With an exponential",
          problem: md`Find the absolute extrema of $f(x) = xe^{-x}$ on $[0, 3]$.`,
          steps: [
            { math: md`f'(x) = e^{-x} - xe^{-x} = e^{-x}(1 - x)`, note: "Product rule, then factor." },
            { math: md`x = 1`, note: md`$e^{-x}$ is never zero, so the only critical point is $x = 1$.` },
            { math: md`f(0) = 0, \quad f(1) = \frac{1}{e} \approx 0.368, \quad f(3) = \frac{3}{e^3} \approx 0.149`, note: "Endpoints and the critical point." },
            { math: md`\text{max } \tfrac{1}{e} \text{ at } x = 1, \qquad \text{min } 0 \text{ at } x = 0`, note: "The minimum is at an endpoint." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the critical points of $f(x) = x^3 - 12x$. List the $x$-values separated by commas.`,
          answer: "-2, 2",
          form: "set",
          explain: md`$f'(x) = 3x^2 - 12 = 3(x - 2)(x + 2)$, which is zero at $x = \pm 2$ and exists everywhere.`,
        },
        {
          kind: "check",
          prompt: md`Find the absolute maximum of $f(x) = x^2 - 4x$ on $[0, 5]$. Give it as a point $(x, y)$.`,
          answer: "(5, 5)",
          form: "tuple",
          explain: md`$f'(x) = 2x - 4 = 0$ at $x = 2$. Compare $f(0) = 0$, $f(2) = -4$ and $f(5) = 5$. The largest is $5$, at the endpoint $x = 5$. The critical point gave the minimum.`,
        },
      ],
      practice: [criticalPoints, absoluteExtremum, productCritical],
    },
    {
      id: slug("The mean value theorem"),
      title: "The mean value theorem",
      summary: "Rolle's theorem and the mean value theorem, proved from the extreme value theorem, and what they tell us about functions with zero derivative.",
      blocks: [
        {
          kind: "text",
          body: md`You drive 120 miles in 2 hours. Your average speed was 60 mph. Must your speedometer have read exactly 60 at some instant? It seems obvious: if you were always below 60 you couldn't have covered the distance, and if you were always above you'd have covered more. So at some moment you were at 60 exactly.

That intuition is the mean value theorem: somewhere, the instantaneous rate equals the average rate. It is the bridge between $f'$ (local information) and $f$ (global behaviour), and almost everything in the rest of this unit rests on it. We build it in two steps.`,
        },
        {
          kind: "key",
          title: "Rolle's theorem",
          body: md`If $f$ is continuous on $[a, b]$, differentiable on $(a, b)$, and $f(a) = f(b)$, then there is at least one $c$ in $(a, b)$ with $f'(c) = 0$.

In words: a smooth curve that starts and ends at the same height has a horizontal tangent somewhere in between.`,
        },
        {
          kind: "proof",
          title: "Rolle's theorem",
          given: md`$f$ is continuous on $[a, b]$, differentiable on $(a, b)$, and $f(a) = f(b)$.`,
          prove: md`$f'(c) = 0$ for some $c$ in $(a, b)$.`,
          steps: [
            { statement: md`$f$ has an absolute maximum value $M$ and an absolute minimum value $m$ on $[a, b]$.`, reason: "Extreme value theorem (continuous on a closed interval)." },
            { statement: md`Case 1: $M = m$. Then $f$ is constant, so $f'(x) = 0$ for every $x$ in $(a, b)$; any $c$ works.`, reason: "A constant function has derivative 0." },
            { statement: md`Case 2: $M > m$. At least one of $M$, $m$ is different from the common value $f(a) = f(b)$.`, reason: md`Both can't equal $f(a)$ when they differ from each other.` },
            { statement: md`That extreme value is attained at some $c$ in the open interval $(a, b)$.`, reason: md`It isn't attained at $a$ or $b$, since $f(a) = f(b)$ is not that value.` },
            { statement: md`$f$ has a local extremum at $c$ and $f'(c)$ exists.`, reason: md`An interior absolute extremum is a local one; $f$ is differentiable on $(a, b)$.` },
            { statement: md`$f'(c) = 0$.`, reason: "Fermat's theorem." },
          ],
        },
        {
          kind: "plot",
          x: [-2.5, 2.5],
          y: [-4, 4],
          curves: [{ expr: "x^3 - 4x", label: "f(x) = x^3 - 4x", domain: [-2, 2] }],
          points: [
            { x: -2, y: 0, color: 2 },
            { x: 2, y: 0, color: 2 },
            { x: "-2/sqrt(3)", y: "16/(3 sqrt(3))", label: "c_1", color: 3 },
            { x: "2/sqrt(3)", y: "-16/(3 sqrt(3))", label: "c_2", color: 3 },
          ],
          hlines: [{ y: "16/(3 sqrt(3))" }, { y: "-16/(3 sqrt(3))" }],
          caption: md`$f(x) = x^3 - 4x$ has $f(-2) = f(2) = 0$. Rolle promises at least one horizontal tangent in between; this curve has two, at $c = \pm\tfrac{2}{\sqrt3}$. The proof found them as the places where $f$ is highest and lowest.`,
        },
        {
          kind: "key",
          title: "The mean value theorem (MVT)",
          body: md`If $f$ is continuous on $[a, b]$ and differentiable on $(a, b)$, then there is at least one $c$ in $(a, b)$ with

$$f'(c) = \frac{f(b) - f(a)}{b - a}.$$

The right side is the slope of the **secant** line through $(a, f(a))$ and $(b, f(b))$: the average rate of change. The theorem says some tangent line is parallel to that secant. Equivalently, $f(b) - f(a) = f'(c)(b - a)$.`,
        },
        {
          kind: "why",
          title: "Why the MVT is Rolle's theorem, tilted",
          body: md`Rolle needs equal heights at the ends. In general the ends are at different heights, joined by a secant of slope $m = \dfrac{f(b) - f(a)}{b - a}$. So subtract the secant line: let

$$g(x) = f(x) - \big[f(a) + m(x - a)\big].$$

$g$ measures how far the curve sits above the secant. At both ends the curve meets the secant, so $g(a) = g(b) = 0$. Rolle applies to $g$ and gives a $c$ with $g'(c) = 0$. But $g'(x) = f'(x) - m$, so $f'(c) = m$. The tangent at $c$ is parallel to the secant.`,
        },
        {
          kind: "proof",
          title: "The mean value theorem",
          given: md`$f$ is continuous on $[a, b]$ and differentiable on $(a, b)$. Let $m = \dfrac{f(b) - f(a)}{b - a}$.`,
          prove: md`$f'(c) = m$ for some $c$ in $(a, b)$.`,
          steps: [
            { statement: md`Define $g(x) = f(x) - f(a) - m(x - a)$.`, reason: "The gap between the curve and the secant line." },
            { statement: md`$g$ is continuous on $[a, b]$ and differentiable on $(a, b)$.`, reason: md`$g$ is $f$ minus a linear function, and linear functions are continuous and differentiable everywhere.` },
            { statement: md`$g(a) = f(a) - f(a) - 0 = 0$.`, reason: "Substitute." },
            { statement: md`$g(b) = f(b) - f(a) - m(b - a) = f(b) - f(a) - \big(f(b) - f(a)\big) = 0$.`, reason: md`$m(b - a) = f(b) - f(a)$ by the definition of $m$.` },
            { statement: md`There is a $c$ in $(a, b)$ with $g'(c) = 0$.`, reason: "Rolle's theorem." },
            { statement: md`$g'(x) = f'(x) - m$.`, reason: "Derivative of a difference; the derivative of a line is its slope." },
            { statement: md`$f'(c) = m$.`, reason: md`$g'(c) = 0$ means $f'(c) - m = 0$.` },
          ],
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-2, 10],
          curves: [
            { expr: "x^2", label: "f(x) = x^2" },
            { expr: "a^2 + (a + b)(x - a)", label: "\\text{secant}", color: 2 },
            { expr: "(a + b) x - ((a + b)/2)^2", label: "\\text{tangent at } c", color: 3, dashed: true },
          ],
          points: [
            { x: "a", y: "a^2", label: "(a, f(a))", color: 2 },
            { x: "b", y: "b^2", label: "(b, f(b))", color: 2 },
            { x: "(a + b)/2", y: "((a + b)/2)^2", label: "c = {=(a + b)/2}", color: 3 },
          ],
          params: [
            { name: "a", min: -3, max: 0, step: 0.5, value: -2 },
            { name: "b", min: 0.5, max: 3, step: 0.5, value: 2 },
          ],
          caption: md`For $f(x) = x^2$ the secant from $a$ to $b$ has slope $\dfrac{b^2 - a^2}{b - a} = a + b$, and $f'(c) = 2c$ equals that exactly when $c = \dfrac{a + b}{2}$. Slide the endpoints: the tangent at the midpoint stays parallel to the secant.`,
        },
        {
          kind: "example",
          title: "Finding the c",
          problem: md`Find the $c$ guaranteed by the MVT for $f(x) = x^3$ on $[0, 3]$.`,
          steps: [
            { math: md`\frac{f(3) - f(0)}{3 - 0} = \frac{27 - 0}{3} = 9`, note: "The secant slope." },
            { math: md`f'(c) = 3c^2 = 9 \;\Rightarrow\; c^2 = 3`, note: "Set the tangent slope equal to it." },
            { math: md`c = \sqrt{3}`, note: md`$-\sqrt3$ also solves the equation but lies outside $(0, 3)$. The theorem promises a $c$ inside the interval, and $\sqrt3 \approx 1.73$ is.` },
          ],
        },
        {
          kind: "example",
          title: "The speeding ticket",
          problem: md`A car passes a toll booth at 2:00 and another one 150 km away at 3:30. The speed limit is 90 km/h. Can the driver be ticketed?`,
          steps: [
            { math: md`\frac{s(1.5) - s(0)}{1.5 - 0} = \frac{150}{1.5} = 100 \text{ km/h}`, note: md`Let $s(t)$ be the distance travelled after $t$ hours. This is the average speed.` },
            { math: md`s'(c) = 100 \text{ for some } c \in (0, 1.5)`, note: "The MVT: the position function is continuous and differentiable, so at some instant the speedometer read exactly 100." },
            { math: md`100 > 90`, note: "Yes. The theorem doesn't say when, but it guarantees the moment existed." },
          ],
        },
        {
          kind: "key",
          title: "What zero derivative means",
          body: md`- If $f'(x) = 0$ for every $x$ in an interval, then $f$ is **constant** on that interval.
- If $f'(x) = g'(x)$ for every $x$ in an interval, then $f(x) = g(x) + C$ for some constant $C$: two functions with the same derivative differ by a constant.

The first is the converse of "a constant has derivative zero", and it is not obvious: knowing the slope is zero at each point separately doesn't by itself say the heights match. The MVT is what connects the points.`,
        },
        {
          kind: "proof",
          title: "Zero derivative means constant",
          given: md`$f'(x) = 0$ for every $x$ in an interval $I$.`,
          prove: md`$f$ is constant on $I$.`,
          steps: [
            { statement: md`Let $x_1 < x_2$ be any two points of $I$.`, reason: "We show their function values agree." },
            { statement: md`$f$ is continuous on $[x_1, x_2]$ and differentiable on $(x_1, x_2)$.`, reason: md`$f$ is differentiable on all of $I$, and differentiable implies continuous.` },
            { statement: md`$f(x_2) - f(x_1) = f'(c)(x_2 - x_1)$ for some $c$ between them.`, reason: "Mean value theorem." },
            { statement: md`$f(x_2) - f(x_1) = 0 \cdot (x_2 - x_1) = 0$.`, reason: md`$f'(c) = 0$ by hypothesis.` },
            { statement: md`$f(x_1) = f(x_2)$, so $f$ is constant on $I$.`, reason: md`Any two values are equal. For the second bullet above, apply this to $f - g$, whose derivative is $f' - g' = 0$.` },
          ],
        },
        {
          kind: "why",
          title: "Why this matters later",
          body: md`The second consequence is the foundation of integration. When you find one function $F$ with $F' = f$, every other one is $F + C$: there are no surprises hiding. That is why antiderivatives (Unit 6) always come with "$+ C$" and nothing more exotic.

The interval matters. $f(x) = \dfrac{x}{|x|}$ has $f' = 0$ everywhere it's defined, but $f = -1$ on the left and $+1$ on the right. The MVT can't be applied across the gap at $0$, and the conclusion fails there.`,
        },
        {
          kind: "check",
          prompt: md`Find the $c$ guaranteed by the mean value theorem for $f(x) = x^2$ on $[1, 5]$.`,
          answer: "3",
          explain: md`The secant slope is $\dfrac{25 - 1}{5 - 1} = 6$, and $f'(c) = 2c = 6$ gives $c = 3$, the midpoint.`,
        },
        {
          kind: "check",
          prompt: md`$f(0) = 2$ and $f'(x) \le 3$ for every $x$. What is the largest possible value of $f(5)$?`,
          answer: "17",
          explain: md`By the MVT, $\dfrac{f(5) - 2}{5} = f'(c) \le 3$, so $f(5) \le 2 + 15 = 17$. The line $y = 2 + 3x$ shows that $17$ is possible.`,
        },
      ],
      practice: [mvtC, rolleC, mvtBounds],
    },
    {
      id: slug("Curve sketching"),
      title: "Curve sketching",
      summary: "How the signs of f' and f'' determine where a graph rises, falls, bends up and bends down, with each test proved from the mean value theorem.",
      blocks: [
        {
          kind: "text",
          body: md`A graph is a story: where it rises, where it falls, where it turns, how it bends. The derivative tells that story in advance. This lesson turns the mean value theorem into a set of tests you can run on any differentiable function, and then uses them to sketch graphs without plotting a hundred points.`,
        },
        {
          kind: "key",
          title: "The increasing/decreasing test",
          body: md`On an interval where $f'(x) > 0$, $f$ is **increasing** (bigger $x$ gives bigger $f(x)$).
On an interval where $f'(x) < 0$, $f$ is **decreasing**.

Positive slope, uphill; negative slope, downhill. The proof is the MVT.`,
        },
        {
          kind: "proof",
          title: "Positive derivative means increasing",
          given: md`$f'(x) > 0$ for every $x$ in an interval $I$.`,
          prove: md`If $x_1 < x_2$ are in $I$, then $f(x_1) < f(x_2)$.`,
          steps: [
            { statement: md`$f$ is continuous on $[x_1, x_2]$ and differentiable on $(x_1, x_2)$.`, reason: "Differentiable on I, and differentiable implies continuous." },
            { statement: md`$f(x_2) - f(x_1) = f'(c)(x_2 - x_1)$ for some $c$ in $(x_1, x_2)$.`, reason: "Mean value theorem." },
            { statement: md`$f'(c) > 0$ and $x_2 - x_1 > 0$.`, reason: md`Hypothesis, and $x_1 < x_2$.` },
            { statement: md`$f(x_2) - f(x_1) > 0$, so $f(x_1) < f(x_2)$.`, reason: md`A product of positives is positive. (For $f' < 0$ the product is negative: decreasing.)` },
          ],
        },
        {
          kind: "plot",
          x: [-2.5, 2.5],
          y: [-4, 7],
          curves: [
            { expr: "x^3 - 3x", label: "f(x) = x^3 - 3x" },
            { expr: "3x^2 - 3", label: "f'(x) = 3x^2 - 3", color: 2, dashed: true },
          ],
          vlines: [{ x: "c" }],
          points: [
            { x: "c", y: "c^3 - 3c", label: "f({c})" },
            { x: "c", y: "3c^2 - 3", label: "f'({c}) = {=3c^2 - 3}", color: 2 },
          ],
          params: [{ name: "c", min: -2.5, max: 2.5, step: 0.1, value: -1.6 }],
          caption: md`Slide $c$. Wherever the dashed $f'$ is above the axis, $f$ is climbing; where $f'$ is below, $f$ is falling. $f'$ crosses zero at $x = -1$ (where $f$ peaks) and $x = 1$ (where $f$ bottoms out).`,
        },
        {
          kind: "key",
          title: "The first derivative test",
          body: md`Let $c$ be a critical point of a continuous $f$.

- If $f'$ changes from **positive to negative** at $c$, then $f$ has a **local maximum** at $c$.
- If $f'$ changes from **negative to positive** at $c$, $f$ has a **local minimum** at $c$.
- If $f'$ has the **same sign** on both sides, there is no extremum at $c$.`,
        },
        {
          kind: "why",
          title: "Why the first derivative test works",
          body: md`It is the increasing/decreasing test read twice. If $f' > 0$ just left of $c$, then $f$ is increasing up to $c$: every value on the left is below $f(c)$. If $f' < 0$ just right of $c$, $f$ is decreasing from $c$: every value on the right is below $f(c)$ too. So $f(c)$ beats all its neighbours. That is a local maximum.

If the sign doesn't change, $f$ keeps going the same direction through $c$ (like $x^3$ at $0$), so $c$ is neither a peak nor a valley. Note the test never needs $f'(c)$ itself: it works for corners like $|x|$ as well.`,
        },
        {
          kind: "key",
          title: "Concavity",
          body: md`$f$ is **concave up** on an interval if its graph lies above its tangent lines there; it bends upward, like a cup. $f$ is **concave down** if the graph lies below its tangent lines; it bends downward, like a cap.

**Concavity test.** If $f''(x) > 0$ on an interval, $f$ is concave up there. If $f''(x) < 0$, concave down.`,
        },
        {
          kind: "why",
          title: "Why the second derivative measures bending",
          body: md`$f''$ is the derivative of $f'$. If $f'' > 0$ on an interval, then by the increasing test applied to $f'$, the slope $f'$ is increasing: the tangent lines turn counterclockwise as you move right. A curve whose slope keeps growing bends upward, and the tangent at any point is left behind underneath it.

To see the "above its tangents" claim exactly: fix $a$ and let $x > a$. By the MVT, $f(x) - f(a) = f'(c)(x - a)$ for some $c$ between $a$ and $x$. Because $f'$ is increasing, $f'(c) > f'(a)$, so $f(x) > f(a) + f'(a)(x - a)$: the curve is above the tangent line at $a$. The case $x < a$ is the same with the inequalities flipped twice.`,
        },
        {
          kind: "plot",
          x: [-2.5, 2.5],
          y: [-4, 4],
          curves: [
            { expr: "x^3 - 3x", label: "f(x) = x^3 - 3x" },
            { expr: "c^3 - 3c + (3c^2 - 3)(x - c)", label: "\\text{tangent at } c", color: 2, dashed: true },
          ],
          points: [{ x: "c", y: "c^3 - 3c", label: "f''({c}) = {=6c}", color: 2 }],
          params: [{ name: "c", min: -2, max: 2, step: 0.1, value: -1.2 }],
          caption: md`$f'' = 6x$. For $c < 0$ the tangent sits above the curve (concave down); for $c > 0$ it sits below (concave up). At $x = 0$ the curve crosses its own tangent: an inflection point.`,
        },
        {
          kind: "key",
          title: "Inflection points and the second derivative test",
          body: md`An **inflection point** is a point on the graph where $f$ is continuous and the concavity changes. At such a point $f'' = 0$ or $f''$ doesn't exist, but as with critical points, that is only a candidate list: check that the sign of $f''$ actually changes.

**Second derivative test.** Suppose $f'(c) = 0$.
- If $f''(c) > 0$, $f$ has a local minimum at $c$.
- If $f''(c) < 0$, $f$ has a local maximum at $c$.
- If $f''(c) = 0$, the test says nothing; use the first derivative test.`,
        },
        {
          kind: "why",
          title: "Why the second derivative test works",
          body: md`Suppose $f'(c) = 0$ and $f''(c) > 0$. By the definition of derivative applied to $f'$,

$$f''(c) = \lim_{x \to c} \frac{f'(x) - f'(c)}{x - c} = \lim_{x \to c} \frac{f'(x)}{x - c} > 0.$$

A quotient whose limit is positive is itself positive for $x$ close to $c$. So $f'(x)$ has the same sign as $x - c$ near $c$: negative on the left, positive on the right. That is exactly the first derivative test's pattern for a local minimum. Flip every sign for $f''(c) < 0$.

Why it fails when $f''(c) = 0$: $x^4$, $-x^4$ and $x^3$ all have $f'(0) = f''(0) = 0$, yet the first has a minimum, the second a maximum and the third neither.`,
        },
        {
          kind: "example",
          title: "Sketching a cubic",
          problem: md`Sketch $f(x) = x^3 - 6x^2 + 9x$: find where it rises and falls, its local extrema, its concavity and its inflection point.`,
          steps: [
            { math: md`f'(x) = 3x^2 - 12x + 9 = 3(x - 1)(x - 3)`, note: md`Critical points $x = 1$ and $x = 3$.` },
            { math: md`f' > 0 \text{ on } (-\infty, 1), \quad f' < 0 \text{ on } (1, 3), \quad f' > 0 \text{ on } (3, \infty)`, note: md`Test $x = 0$: $f'(0) = 9 > 0$. Test $x = 2$: $f'(2) = -3$. Test $x = 4$: $f'(4) = 9$. So $f$ rises, falls, rises.` },
            { math: md`\text{local max } (1, 4), \qquad \text{local min } (3, 0)`, note: md`First derivative test: $+$ to $-$ at 1, $-$ to $+$ at 3. $f(1) = 1 - 6 + 9 = 4$, $f(3) = 27 - 54 + 27 = 0$.` },
            { math: md`f''(x) = 6x - 12 = 6(x - 2)`, note: md`Negative for $x < 2$ (concave down), positive for $x > 2$ (concave up).` },
            { math: md`\text{inflection point } (2, 2)`, note: md`$f(2) = 8 - 24 + 18 = 2$. The concavity really changes, since $f''$ is a line crossing zero.` },
          ],
        },
        {
          kind: "example",
          title: "When the second derivative test is silent",
          problem: md`Analyse $f(x) = x^4 - 4x^3$.`,
          steps: [
            { math: md`f'(x) = 4x^3 - 12x^2 = 4x^2(x - 3)`, note: md`Critical points $x = 0$ and $x = 3$.` },
            { math: md`f''(x) = 12x^2 - 24x = 12x(x - 2)`, note: md`$f''(3) = 36 > 0$: local minimum at $x = 3$, with $f(3) = -27$. But $f''(0) = 0$: no verdict.` },
            { math: md`f'(-1) = -16 < 0, \qquad f'(1) = -8 < 0`, note: md`First derivative test at $0$: $f'$ is negative on both sides (the factor $x^2$ never changes sign). No extremum at $x = 0$; the graph just flattens as it descends.` },
            { math: md`\text{inflection points at } x = 0 \text{ and } x = 2`, note: md`$f''$ changes sign at both roots: concave up, down, up. Points $(0, 0)$ and $(2, -16)$.` },
          ],
        },
        {
          kind: "plot",
          x: [-1.5, 4.5],
          y: [-30, 10],
          curves: [{ expr: "x^4 - 4x^3", label: "f(x) = x^4 - 4x^3" }],
          points: [
            { x: 0, y: 0, label: "\\text{inflection, } f' = 0", color: 2 },
            { x: 2, y: -16, label: "\\text{inflection}", color: 2 },
            { x: 3, y: -27, label: "\\text{local min}", color: 4 },
          ],
          caption: md`$x^4 - 4x^3$. At the origin the tangent is horizontal and the concavity flips, but the function keeps falling: a critical point that is not an extremum.`,
        },
        {
          kind: "check",
          prompt: md`On what interval(s) is $f(x) = x^3 - 3x$ increasing? Answer as an inequality (like x < 1 or x > 3) or in interval notation.`,
          answer: "x < -1 or x > 1",
          form: "inequality",
          explain: md`$f'(x) = 3x^2 - 3 = 3(x - 1)(x + 1)$ is positive when $x < -1$ or $x > 1$, and negative in between.`,
        },
        {
          kind: "check",
          prompt: md`Find the $x$-coordinate of the inflection point of $f(x) = x^3 - 6x^2 + 5$.`,
          answer: "2",
          explain: md`$f''(x) = 6x - 12$, zero at $x = 2$, negative before and positive after, so the concavity changes there.`,
        },
      ],
      practice: [monotonic, inflection, localExtremum],
    },
    {
      id: slug("Optimization"),
      title: "Optimization",
      summary: "Turning a word problem into a function on an interval, then finding its extreme with the closed interval method or the derivative tests.",
      blocks: [
        {
          kind: "text",
          body: md`Optimization problems ask for the best of something: the largest area a fence can enclose, the least metal for a can, the shortest route. Every one of them becomes the same calculus problem: a function to make as big or small as possible on some interval. The calculus is the easy part. The work is in the translation.`,
        },
        {
          kind: "key",
          title: "The method",
          body: md`- **Draw a picture** and name the quantities with letters. Decide which quantity $Q$ is to be maximized or minimized.
- **Write $Q$ in terms of the other variables.**
- **Use the constraints** (the fixed total, the fixed volume, the geometry) to eliminate variables until $Q$ depends on just one, $Q = f(x)$.
- **Find the domain**: the values of $x$ that make physical sense.
- **Find the extreme** of $f$ on that domain: the closed interval method if the domain is closed, otherwise the first or second derivative test.
- **Answer the question asked.** If it wanted the dimensions, give the dimensions; if the area, give the area.`,
        },
        {
          kind: "example",
          title: "The fence by the river",
          problem: md`A farmer has 100 m of fence for a rectangular field along a straight river. No fence is needed on the river side. What dimensions give the largest area?`,
          steps: [
            { math: md`2x + y = 100`, note: md`Let $x$ be each side perpendicular to the river and $y$ the side parallel to it. Three sides of fence.` },
            { math: md`A = xy = x(100 - 2x) = 100x - 2x^2, \qquad 0 \le x \le 50`, note: md`Solve the constraint for $y = 100 - 2x$ and substitute. Negative lengths make no sense, and $x = 50$ uses up all the fence.` },
            { math: md`A'(x) = 100 - 4x = 0 \;\Rightarrow\; x = 25`, note: "The one critical point." },
            { math: md`A(0) = 0, \quad A(25) = 1250, \quad A(50) = 0`, note: "Closed interval method. The endpoints give degenerate fields with no area." },
            { math: md`x = 25\text{ m}, \quad y = 50\text{ m}, \quad A = 1250\text{ m}^2`, note: "The side parallel to the river is twice the others." },
          ],
        },
        {
          kind: "diagram",
          view: [-10, 110, -12, 60],
          points: [
            { name: "A", x: 0, y: 0, label: "" },
            { name: "B", x: "100 - 2w", y: 0, label: "" },
            { name: "C", x: "100 - 2w", y: "w", label: "" },
            { name: "D", x: 0, y: "w", label: "" },
            { name: "R", x: -8, y: -4, label: "", hidden: true },
            { name: "S", x: 108, y: -4, label: "", hidden: true },
          ],
          segments: [
            { from: "R", to: "S", color: 1, label: "\\text{river}" },
            { from: "A", to: "D", label: "x = {w}" },
            { from: "B", to: "C", label: "x = {w}" },
            { from: "D", to: "C", label: "y = {=100 - 2w}" },
          ],
          polygons: [{ points: ["A", "B", "C", "D"], fill: 3 }],
          params: [{ name: "w", tex: "x", min: 5, max: 45, step: 1, value: 15 }],
          readouts: [{ label: "A", value: "w(100 - 2w)", unit: "\\text{ m}^2" }],
          caption: md`Slide $x$. A long thin field or a short wide one both waste fence; the area peaks at $x = 25$.`,
        },
        {
          kind: "plot",
          x: [0, 50],
          y: [0, 1400],
          curves: [{ expr: "x(100 - 2x)", label: "A(x) = x(100 - 2x)" }],
          points: [{ x: "w", y: "w(100 - 2w)", label: "({w}, {=w(100 - 2w)})", color: 2 }],
          vlines: [{ x: 25, label: "x = 25" }],
          params: [{ name: "w", tex: "x", min: 0, max: 50, step: 1, value: 15 }],
          caption: md`The area function. It is a downward parabola, so its single critical point is the maximum, confirming what the closed interval method found.`,
        },
        {
          kind: "why",
          title: "Why you must still check",
          body: md`A critical point is a candidate, not a verdict. Change the question: with a fixed area of 1250 m$^2$ by the river, what dimensions use the *least* fence? Now $F(x) = 2x + \dfrac{1250}{x}$ on $(0, \infty)$, with $F'(x) = 2 - \dfrac{1250}{x^2} = 0$ at $x = 25$ again. This time the critical point is a minimum, and the domain has no endpoints to compare with. You need a test to know which way it went: $F'' = \dfrac{2500}{x^3} > 0$, concave up, so it is a minimum.

Setting the derivative to zero finds the turning points. Deciding whether they are peaks or valleys, and whether an endpoint beats them, is a separate step. Skip it and you can confidently report the worst answer as the best.`,
        },
        {
          kind: "example",
          title: "An open box",
          problem: md`A box with no top is made from a 12 cm by 12 cm sheet by cutting equal squares from the corners and folding up the sides. What cut maximizes the volume?`,
          steps: [
            { math: md`V(x) = x(12 - 2x)^2, \qquad 0 \le x \le 6`, note: md`Cut $x$ from each corner: the base is $12 - 2x$ square and the height is $x$. At $x = 6$ nothing is left of the base.` },
            { math: md`V'(x) = (12 - 2x)^2 + x \cdot 2(12 - 2x)(-2) = (12 - 2x)(12 - 2x - 4x) = (12 - 2x)(12 - 6x)`, note: "Product rule with the chain rule, then factor out the shared (12 - 2x)." },
            { math: md`x = 6 \quad\text{or}\quad x = 2`, note: md`$x = 6$ is the endpoint with $V = 0$.` },
            { math: md`V(0) = 0, \quad V(2) = 2 \cdot 8^2 = 128, \quad V(6) = 0`, note: "Closed interval method." },
            { math: md`x = 2\text{ cm}, \qquad V = 128\text{ cm}^3`, note: "The box is 8 by 8 by 2." },
          ],
        },
        {
          kind: "example",
          title: "The cheapest can",
          problem: md`A closed cylindrical can must hold $16\pi$ cm$^3$. Find the radius and height that use the least metal.`,
          steps: [
            { math: md`\pi r^2 h = 16\pi \;\Rightarrow\; h = \frac{16}{r^2}`, note: "The volume constraint lets us eliminate h." },
            { math: md`S = 2\pi r^2 + 2\pi r h = 2\pi r^2 + \frac{32\pi}{r}, \qquad r > 0`, note: "Two discs plus the rolled-up side. The domain is open: no endpoints to check." },
            { math: md`S'(r) = 4\pi r - \frac{32\pi}{r^2} = 0 \;\Rightarrow\; r^3 = 8 \;\Rightarrow\; r = 2`, note: md`Multiply through by $r^2$ and divide by $4\pi$.` },
            { math: md`S''(r) = 4\pi + \frac{64\pi}{r^3} > 0`, note: "Concave up everywhere on the domain, so the only critical point is the absolute minimum." },
            { math: md`r = 2\text{ cm}, \qquad h = \frac{16}{4} = 4\text{ cm}`, note: md`The height equals the diameter. That is always true of the cheapest can, whatever the volume.` },
          ],
        },
        {
          kind: "why",
          title: "Why one critical point on an open interval can be enough",
          body: md`On an open interval there are no endpoints, and the extreme value theorem doesn't apply. But suppose $f$ is continuous on the interval and $c$ is its *only* critical point. If $f' < 0$ to the left of $c$ and $f' > 0$ to the right, then $f$ decreases all the way down to $c$ and increases all the way up afterwards (increasing/decreasing test). No point anywhere in the interval is lower than $f(c)$. The local minimum is the absolute minimum.

That is why in the can problem a single sign check, or $S'' > 0$ everywhere, settles the matter. If there were two critical points, you would need to compare them.`,
        },
        {
          kind: "key",
          title: "Open-interval checklist",
          body: md`When the domain has no endpoints (lengths that may be arbitrarily small or large):

- Find all critical points.
- If there is exactly one and $f'$ changes sign there (or $f''$ has one sign on the whole domain), it is the absolute extremum of that type.
- Otherwise compare the candidates, and check what $f$ does near the ends of the domain (does it blow up, or sink toward a value it never reaches?).`,
        },
        {
          kind: "example",
          title: "The closest point",
          problem: md`Find the point on the line $y = 2x - 5$ closest to the origin.`,
          steps: [
            { math: md`D(x) = x^2 + (2x - 5)^2`, note: md`The squared distance from $(0, 0)$ to $(x, 2x - 5)$. Minimizing the square is the same as minimizing the distance, and the algebra is cleaner without the root.` },
            { math: md`D'(x) = 2x + 2(2x - 5)(2) = 10x - 20 = 0 \;\Rightarrow\; x = 2`, note: "Chain rule on the second square." },
            { math: md`D''(x) = 10 > 0`, note: "Concave up: a minimum, and the only critical point." },
            { math: md`(2, -1), \qquad \text{distance } \sqrt{4 + 1} = \sqrt5`, note: md`The segment from the origin to $(2, -1)$ has slope $-\tfrac12$, perpendicular to the line's slope 2. Calculus rediscovered the geometry.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Two positive numbers $x$ and $y$ satisfy $x + y = 30$. Find the pair that makes $xy^2$ as large as possible. Give it as $(x, y)$.`,
          answer: "(10, 20)",
          form: "tuple",
          explain: md`$P = (30 - y)y^2 = 30y^2 - y^3$, so $P' = 60y - 3y^2 = 3y(20 - y)$, zero at $y = 20$ (the $y = 0$ root gives $P = 0$). $P'' = 60 - 6y < 0$ at $y = 20$: a maximum. Then $x = 10$.`,
        },
      ],
      practice: [fenceProblem, boxProblem, minimizeDistance],
    },
    {
      id: slug("Linear approximation and Newton's method"),
      title: "Linear approximation and Newton's method",
      summary: "Using the tangent line as a stand-in for the curve: estimating values, differentials and error, and Newton's method for solving equations.",
      blocks: [
        {
          kind: "text",
          body: md`Zoom in on a smooth curve and it straightens out. Zoom in enough and you cannot tell it from its tangent line. That observation has a practical side: near a point where you know $f$ and $f'$, the tangent line is a cheap substitute for the function itself. This lesson uses that substitute twice, first to estimate values, then to solve equations.`,
        },
        {
          kind: "plot",
          x: [0, 10],
          y: [0, 4],
          curves: [
            { expr: "sqrt(x)", label: "f(x) = \\sqrt{x}" },
            { expr: "sqrt(a) + (x - a)/(2 sqrt(a))", label: "L(x)", color: 2, dashed: true },
          ],
          points: [{ x: "a", y: "sqrt(a)", label: "(a, \\sqrt{a})", color: 2 }],
          params: [{ name: "a", min: 1, max: 9, step: 0.5, value: 4 }],
          caption: md`The tangent line to $\sqrt{x}$ at $x = a$. Close to $a$ the two are nearly indistinguishable; further away they drift apart. The line is above the curve everywhere, because $\sqrt{x}$ is concave down.`,
        },
        {
          kind: "key",
          title: "Linearization",
          body: md`The **linearization** of $f$ at $a$ is the tangent line written as a function:

$$L(x) = f(a) + f'(a)(x - a).$$

For $x$ near $a$, $f(x) \approx L(x)$. This is the **linear approximation** (or tangent line approximation) of $f$ at $a$.`,
        },
        {
          kind: "why",
          title: "Why the tangent line approximates the curve",
          body: md`By definition, $f'(a) = \displaystyle\lim_{x \to a} \frac{f(x) - f(a)}{x - a}$. So for $x$ close to $a$, the difference quotient is close to $f'(a)$:

$$\frac{f(x) - f(a)}{x - a} \approx f'(a) \quad\Longrightarrow\quad f(x) \approx f(a) + f'(a)(x - a).$$

That is $L(x)$. The approximation is good precisely because the derivative exists: the error in the quotient goes to zero, so the error in $f(x)$ goes to zero faster than $x - a$ does. Among all lines through $(a, f(a))$, the tangent is the only one with this property.`,
        },
        {
          kind: "example",
          title: "Estimating a square root",
          problem: md`Estimate $\sqrt{4.1}$ without a calculator.`,
          steps: [
            { math: md`f(x) = \sqrt{x}, \quad a = 4, \quad f(4) = 2, \quad f'(x) = \frac{1}{2\sqrt{x}}, \quad f'(4) = \frac14`, note: "Pick the nearest point where the root is known." },
            { math: md`L(x) = 2 + \tfrac14(x - 4)`, note: "The linearization." },
            { math: md`\sqrt{4.1} \approx L(4.1) = 2 + \tfrac14(0.1) = 2.025`, note: md`The true value is $2.02485\ldots$ The estimate is high by $0.00015$, because the curve bends down away from its tangent.` },
          ],
        },
        {
          kind: "plot",
          x: [3.5, 4.5],
          y: [1.85, 2.15],
          curves: [
            { expr: "sqrt(x)", label: "\\sqrt{x}" },
            { expr: "2 + (x - 4)/4", label: "L(x)", color: 2, dashed: true },
          ],
          points: [{ x: 4, y: 2, color: 2 }, { x: 4.1, y: 2.025, label: "L(4.1)", color: 3 }],
          caption: md`Zoomed in near $x = 4$. The curve and its tangent line are nearly the same thing here; the gap at $x = 4.1$ is too small to see.`,
        },
        {
          kind: "key",
          title: "Differentials",
          body: md`Let $y = f(x)$. The **differential** $dx$ is any change in $x$, and the differential of $y$ is defined by

$$dy = f'(x)\,dx.$$

$dy$ is the change in height *along the tangent line* when $x$ changes by $dx$. The true change in the function is $\Delta y = f(x + dx) - f(x)$. The linear approximation says $\Delta y \approx dy$ when $dx$ is small. This notation also explains why $\dfrac{dy}{dx}$ looks like a fraction: with these definitions, it is one.`,
        },
        {
          kind: "why",
          title: "Why the error is so small",
          body: md`Write $x = a + dx$. Then $L(x) = f(a) + f'(a)\,dx$, so $\Delta y - dy = f(a + dx) - L(a + dx)$: the gap between curve and tangent. For a quadratic $f(x) = x^2$ you can compute it exactly: $\Delta y = 2a\,dx + (dx)^2$ and $dy = 2a\,dx$, so the error is $(dx)^2$. Halve $dx$ and the error drops to a quarter.

That is typical. Smooth functions have errors of size roughly $\tfrac12 |f''(a)| (dx)^2$: proportional to the *square* of the step and to how much the curve bends. For $\sqrt{4.1}$: $\tfrac12 \cdot \tfrac{1}{32} \cdot (0.1)^2 \approx 0.00016$, matching what we saw. Concavity also predicts the sign: concave down means the tangent overestimates.`,
        },
        {
          kind: "example",
          title: "Error in a measurement",
          problem: md`The radius of a sphere is measured as 10 cm, with a possible error of 0.1 cm. Estimate the resulting error in the computed volume.`,
          steps: [
            { math: md`V = \tfrac43\pi r^3, \qquad dV = 4\pi r^2\,dr`, note: "Differentiate; the differential of the volume." },
            { math: md`dV = 4\pi(10)^2(0.1) = 40\pi \approx 126\text{ cm}^3`, note: md`$r = 10$, $dr = 0.1$. The volume could be off by about $126$ cm$^3$.` },
            { math: md`\frac{dV}{V} = \frac{4\pi r^2\,dr}{\frac43\pi r^3} = 3\,\frac{dr}{r} = 3(1\%) = 3\%`, note: "The relative error in the volume is three times the relative error in the radius: a cube triples percentage errors." },
          ],
        },
        {
          kind: "text",
          body: md`Now the second use of the tangent line. Many equations cannot be solved by algebra: $x^5 - x - 1 = 0$, $\cos x = x$. But we can solve *linear* equations easily. So replace the curve by its tangent line, solve that, and repeat.`,
        },
        {
          kind: "why",
          title: "Deriving Newton's iteration",
          body: md`We want a root of $f$: a number $r$ with $f(r) = 0$. Start with a guess $x_0$. The tangent line at $x_0$ is

$$y = f(x_0) + f'(x_0)(x - x_0).$$

Where does this line cross the $x$-axis? Set $y = 0$ and solve: $x = x_0 - \dfrac{f(x_0)}{f'(x_0)}$. Since the line hugs the curve near $x_0$, its root should be near the curve's root. Call it $x_1$ and do it again from there. Each step is

$$x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}.$$`,
        },
        {
          kind: "plot",
          x: [-0.5, 3.5],
          y: [-3, 8],
          curves: [
            { expr: "x^2 - 2", label: "f(x) = x^2 - 2" },
            { expr: "a^2 - 2 + 2a(x - a)", label: "\\text{tangent at } x_0", color: 2, dashed: true },
          ],
          vlines: [{ x: "a", label: "x_0" }, { x: "(a^2 + 2)/(2a)", label: "x_1" }],
          points: [
            { x: "a", y: "a^2 - 2", color: 2 },
            { x: "(a^2 + 2)/(2a)", y: 0, label: "x_1 = {=(a^2 + 2)/(2a)}", color: 3 },
            { x: 1.41421356, y: 0, label: "\\sqrt2", color: 4 },
          ],
          params: [{ name: "a", tex: "x_0", min: 0.6, max: 3, step: 0.1, value: 3 }],
          caption: md`One Newton step for $x^2 - 2 = 0$. The tangent at $x_0$ hits the axis at $x_1$, which is much closer to $\sqrt2$. Slide $x_0$: even a poor start lands near the root in one step, and the second step is nearly exact.`,
        },
        {
          kind: "key",
          title: "Newton's method",
          body: md`To solve $f(x) = 0$: choose a starting value $x_0$ near the root and iterate

$$x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}.$$

When it works, it works fast: the number of correct digits roughly doubles each step. It can fail when $f'(x_n) = 0$ (horizontal tangent, no crossing), when the start is too far away (the tangent can send you off toward a different root, or to no root), or when the iterates cycle. Always check that $f(x_n)$ is actually shrinking.`,
        },
        {
          kind: "example",
          title: "Computing a square root by hand",
          problem: md`Use Newton's method on $f(x) = x^2 - 2$ with $x_0 = 1$ to approximate $\sqrt2$.`,
          steps: [
            { math: md`x_{n+1} = x_n - \frac{x_n^2 - 2}{2x_n}`, note: md`$f'(x) = 2x$.` },
            { math: md`x_1 = 1 - \frac{1 - 2}{2} = 1.5`, note: "One correct digit." },
            { math: md`x_2 = 1.5 - \frac{2.25 - 2}{3} = 1.41667`, note: "Three correct digits." },
            { math: md`x_3 = 1.41667 - \frac{0.00694}{2.83333} = 1.41422`, note: md`Six correct digits: $\sqrt2 = 1.414213\ldots$ The formula simplifies to $x_{n+1} = \tfrac12\left(x_n + \tfrac{2}{x_n}\right)$, averaging a guess with $2$ divided by the guess. This is how calculators do it.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the linearization $L(x)$ of $f(x) = x^3$ at $a = 2$. Give it as an expression in $x$.`,
          answer: "8 + 12(x - 2)",
          explain: md`$f(2) = 8$ and $f'(x) = 3x^2$ gives $f'(2) = 12$, so $L(x) = 8 + 12(x - 2)$.`,
        },
        {
          kind: "check",
          prompt: md`Apply one step of Newton's method to $f(x) = x^2 - 5$ from $x_0 = 2$. What is $x_1$? Give the exact value.`,
          answer: "9/4",
          explain: md`$x_1 = 2 - \dfrac{4 - 5}{4} = 2 + \dfrac14 = \dfrac94 = 2.25$. Already close to $\sqrt5 \approx 2.236$.`,
        },
      ],
      practice: [linearization, estimateWithLinearization, newtonStep],
    },
    {
      id: slug("L'Hôpital's rule"),
      title: "L'Hôpital's rule",
      summary: "Why a 0/0 limit equals the ratio of derivatives, Cauchy's mean value theorem and the proof, and how to handle every indeterminate form.",
      blocks: [
        {
          kind: "text",
          body: md`In Unit 1 you met limits like $\displaystyle\lim_{x \to 0} \frac{\sin x}{x}$, where the top and bottom both go to 0. The quotient law is useless there ($0/0$ is not a number), and we needed a clever squeeze with areas to get the answer 1. Now that we have derivatives, there is a general method, and the squeeze argument becomes a one-liner.`,
        },
        {
          kind: "why",
          title: "Why 0/0 limits are ratios of slopes",
          body: md`Suppose $f(a) = g(a) = 0$ and both are differentiable at $a$. Near $a$, replace each by its linearization:

$$f(x) \approx f(a) + f'(a)(x - a) = f'(a)(x - a), \qquad g(x) \approx g'(a)(x - a).$$

So for $x$ near $a$,

$$\frac{f(x)}{g(x)} \approx \frac{f'(a)(x - a)}{g'(a)(x - a)} = \frac{f'(a)}{g'(a)}.$$

The $(x - a)$ cancels. Both functions are shrinking to zero, but the *ratio* is governed by how fast each shrinks, and that is their slopes. For $\sin x / x$: slopes $\cos 0 = 1$ and $1$, ratio $1$.`,
        },
        {
          kind: "key",
          title: "L'Hôpital's rule",
          body: md`Suppose $f$ and $g$ are differentiable near $a$ (except possibly at $a$) with $g'(x) \ne 0$ there, and

$$\lim_{x \to a} f(x) = 0 \text{ and } \lim_{x \to a} g(x) = 0, \qquad\text{or}\qquad \lim_{x \to a} f(x) = \pm\infty \text{ and } \lim_{x \to a} g(x) = \pm\infty.$$

Then

$$\lim_{x \to a} \frac{f(x)}{g(x)} = \lim_{x \to a} \frac{f'(x)}{g'(x)}$$

provided the limit on the right exists (or is $\pm\infty$). The same holds for one-sided limits and for $x \to \pm\infty$.

Differentiate the top and bottom *separately*. This is not the quotient rule.`,
        },
        {
          kind: "plot",
          x: [-1.5, 1.5],
          y: [-1.5, 3],
          curves: [
            { expr: "e^(2x) - 1", label: "f(x) = e^{2x} - 1" },
            { expr: "x", label: "g(x) = x", color: 2 },
            { expr: "2x", label: "y = 2x", color: 3, dashed: true },
          ],
          caption: md`Near $0$, $e^{2x} - 1$ looks like its tangent $y = 2x$, while $g(x) = x$ is its own tangent. Two lines through the origin have heights in a fixed ratio: $2x/x = 2$. So $\dfrac{e^{2x} - 1}{x} \to 2$.`,
        },
        {
          kind: "example",
          title: "A 0/0 limit",
          problem: md`Find $\displaystyle\lim_{x \to 0} \frac{e^{2x} - 1}{x}$.`,
          steps: [
            { math: md`e^{0} - 1 = 0, \qquad 0 = 0`, note: "Check the form: 0/0. The rule applies." },
            { math: md`\lim_{x \to 0} \frac{2e^{2x}}{1}`, note: "Differentiate the top and the bottom separately." },
            { math: md`= 2e^0 = 2`, note: "The new limit is found by substitution, so the original limit is 2." },
          ],
        },
        {
          kind: "text",
          body: md`The linearization argument explains the rule but assumes $f'(a)$ and $g'(a)$ exist and $g'(a) \ne 0$. The real theorem needs less, and its proof uses a generalization of the mean value theorem to two functions at once.`,
        },
        {
          kind: "key",
          title: "Cauchy's mean value theorem",
          body: md`If $f$ and $g$ are continuous on $[a, b]$ and differentiable on $(a, b)$, then there is a $c$ in $(a, b)$ with

$$\big[f(b) - f(a)\big]\,g'(c) = \big[g(b) - g(a)\big]\,f'(c).$$

When $g(x) = x$ this is the ordinary MVT. When $g'$ is never zero it reads $\dfrac{f'(c)}{g'(c)} = \dfrac{f(b) - f(a)}{g(b) - g(a)}$: the same $c$ serves both functions.`,
        },
        {
          kind: "proof",
          title: "Cauchy's mean value theorem",
          given: md`$f$, $g$ continuous on $[a, b]$, differentiable on $(a, b)$.`,
          prove: md`$[f(b) - f(a)]\,g'(c) = [g(b) - g(a)]\,f'(c)$ for some $c$ in $(a, b)$.`,
          steps: [
            { statement: md`Define $h(x) = [f(b) - f(a)]\,g(x) - [g(b) - g(a)]\,f(x)$.`, reason: "The same trick as for the MVT: build a function Rolle can use." },
            { statement: md`$h$ is continuous on $[a, b]$ and differentiable on $(a, b)$.`, reason: md`It is a combination of $f$ and $g$ with constant coefficients.` },
            { statement: md`$h(a) = f(b)g(a) - f(a)g(a) - g(b)f(a) + g(a)f(a) = f(b)g(a) - g(b)f(a)$.`, reason: "Expand and cancel." },
            { statement: md`$h(b) = f(b)g(b) - f(a)g(b) - g(b)f(b) + g(a)f(b) = f(b)g(a) - g(b)f(a)$.`, reason: "Expand and cancel: the same value." },
            { statement: md`There is a $c$ in $(a, b)$ with $h'(c) = 0$.`, reason: md`Rolle's theorem, since $h(a) = h(b)$.` },
            { statement: md`$h'(c) = [f(b) - f(a)]\,g'(c) - [g(b) - g(a)]\,f'(c) = 0$.`, reason: "Differentiate h; the brackets are constants." },
          ],
        },
        {
          kind: "proof",
          title: "L'Hôpital's rule for 0/0 (right-hand case)",
          given: md`$f(a) = g(a) = 0$; $f$, $g$ are differentiable on $(a, b)$ with $g'(x) \ne 0$ there, and $\displaystyle\lim_{x \to a^+} \frac{f'(x)}{g'(x)} = L$.`,
          prove: md`$\displaystyle\lim_{x \to a^+} \frac{f(x)}{g(x)} = L$.`,
          steps: [
            { statement: md`Fix $x$ in $(a, b)$. $f$ and $g$ are continuous on $[a, x]$ and differentiable on $(a, x)$.`, reason: md`Differentiable on $(a, b)$, and continuous at $a$ because $f(a) = g(a) = 0$ equal their limits (if $f$ wasn't defined at $a$, define it so).` },
            { statement: md`$g(x) \ne 0$.`, reason: md`If $g(x) = 0 = g(a)$, Rolle would give a point where $g' = 0$, contradicting $g' \ne 0$.` },
            { statement: md`There is a $c$ with $a < c < x$ and $[f(x) - f(a)]\,g'(c) = [g(x) - g(a)]\,f'(c)$.`, reason: "Cauchy's mean value theorem on [a, x]." },
            { statement: md`$f(x)\,g'(c) = g(x)\,f'(c)$, so $\dfrac{f(x)}{g(x)} = \dfrac{f'(c)}{g'(c)}$.`, reason: md`$f(a) = g(a) = 0$; divide by $g(x)g'(c) \ne 0$.` },
            { statement: md`As $x \to a^+$, $c \to a^+$ too.`, reason: md`$c$ is squeezed between $a$ and $x$.` },
            { statement: md`$\displaystyle\lim_{x \to a^+} \frac{f(x)}{g(x)} = \lim_{c \to a^+} \frac{f'(c)}{g'(c)} = L$.`, reason: md`By hypothesis. The left-hand case is identical, and the two-sided result follows. The $\infty/\infty$ case and $x \to \infty$ need more care; we take them on trust.` },
          ],
        },
        {
          kind: "example",
          title: "Infinity over infinity, more than once",
          problem: md`Find $\displaystyle\lim_{x \to \infty} \frac{x^2}{e^x}$.`,
          steps: [
            { math: md`\frac{x^2}{e^x} \to \frac{\infty}{\infty}`, note: "Both grow without bound. The rule applies." },
            { math: md`\lim_{x \to \infty} \frac{2x}{e^x} \to \frac{\infty}{\infty}`, note: "Still indeterminate after one round. Check the form again, then apply the rule again." },
            { math: md`\lim_{x \to \infty} \frac{2}{e^x} = 0`, note: md`Now the top is constant and the bottom grows. Exponentials beat every power of $x$; the same steps show $x^n / e^x \to 0$ for every $n$.` },
          ],
        },
        {
          kind: "key",
          title: "The other indeterminate forms",
          body: md`L'Hôpital handles only quotients. Everything else is rewritten into one:

- **$0 \cdot \infty$**: write $fg = \dfrac{f}{1/g}$ (or $\dfrac{g}{1/f}$); pick the one whose derivative is simpler.
- **$\infty - \infty$**: combine into one fraction, or factor out the biggest term.
- **$1^{\infty}$, $0^{0}$, $\infty^{0}$**: take the logarithm. If $y = f^{g}$ then $\ln y = g \ln f$ is a $0 \cdot \infty$ form. Find $\lim \ln y = M$, then $\lim y = e^{M}$ (because $e^x$ is continuous).

Forms like $0/\infty$, $\infty + \infty$ or $0^{\infty}$ are *not* indeterminate: they have definite answers ($0$, $\infty$, $0$) without any work.`,
        },
        {
          kind: "example",
          title: "A product that tends to zero times infinity",
          problem: md`Find $\displaystyle\lim_{x \to 0^+} x \ln x$.`,
          steps: [
            { math: md`x \to 0, \quad \ln x \to -\infty`, note: md`A $0 \cdot \infty$ form. Which factor wins?` },
            { math: md`x\ln x = \frac{\ln x}{1/x} \to \frac{-\infty}{\infty}`, note: md`Divide by the reciprocal of $x$ rather than of $\ln x$: differentiating $1/x$ is easy.` },
            { math: md`\lim_{x \to 0^+} \frac{1/x}{-1/x^2} = \lim_{x \to 0^+} (-x) = 0`, note: md`$\frac{1/x}{-1/x^2} = -\frac{x^2}{x} = -x$. The $x$ wins: it goes to zero faster than the logarithm blows up.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 1.5],
          y: [-0.6, 0.7],
          curves: [{ expr: "x ln(x)", label: "y = x \\ln x", domain: [0.001, 1.5] }],
          points: [{ x: 0, y: 0, open: true }],
          caption: md`$x \ln x$ near $0$. The logarithm is heading to $-\infty$, yet the product dips only to $-1/e$ before returning to $0$.`,
        },
        {
          kind: "example",
          title: "The number e, again",
          problem: md`Find $\displaystyle\lim_{x \to \infty} \left(1 + \frac{1}{x}\right)^{x}$.`,
          steps: [
            { math: md`\left(1 + \tfrac1x\right)^x \to 1^{\infty}`, note: "The base tends to 1, the exponent to infinity: indeterminate. Take logs." },
            { math: md`\ln y = x\ln\left(1 + \tfrac1x\right) = \frac{\ln(1 + 1/x)}{1/x} \to \frac{0}{0}`, note: "A product turned into a quotient." },
            { math: md`\lim_{x \to \infty} \frac{\frac{1}{1 + 1/x}\cdot\left(-\frac{1}{x^2}\right)}{-\frac{1}{x^2}} = \lim_{x \to \infty} \frac{1}{1 + 1/x} = 1`, note: md`L'Hôpital. The $-1/x^2$ factors cancel.` },
            { math: md`\lim_{x \to \infty} y = e^{1} = e`, note: md`$\ln y \to 1$, so $y = e^{\ln y} \to e^1$. This is the compound-interest limit from Algebra 2, now proved from the derivative of $\ln$.` },
          ],
        },
        {
          kind: "why",
          title: "Why 1 to the infinity is indeterminate",
          body: md`It's a tug of war. A base slightly above 1 raised to a huge power can be enormous: $1.01^{1000} \approx 20959$. But if the base approaches 1 fast enough while the exponent grows, the result can settle anywhere. $\left(1 + \frac1x\right)^x \to e$, $\left(1 + \frac2x\right)^x \to e^2$, and $\left(1 + \frac{1}{x^2}\right)^x \to 1$. The answer depends on the *rates*, which is exactly what derivatives measure, and why the logarithm trick works: it converts the race between base and exponent into a $0/0$ quotient.

The same tug of war is behind $0/0$: $\frac{x}{x} \to 1$, $\frac{x^2}{x} \to 0$, $\frac{x}{x^2} \to \infty$. Knowing both parts go to zero tells you nothing until you know how fast.`,
        },
        {
          kind: "key",
          title: "Cautions",
          body: md`- **Check the form every time**, including before each repeated application. $\displaystyle\lim_{x \to 0} \frac{x + 1}{x + 2} = \frac12$ by substitution; blindly differentiating would give $1$, which is wrong.
- Differentiate top and bottom **separately**. Never use the quotient rule here.
- The rule says the limits are equal **if the new limit exists**. If $f'/g'$ oscillates with no limit, the rule is silent, not a proof that the original limit fails.
- Simplify between rounds. Cancelling a common factor can finish the problem faster than another derivative.`,
        },
        {
          kind: "check",
          prompt: md`Find $\displaystyle\lim_{x \to 0} \frac{\sin(3x)}{x}$.`,
          answer: "3",
          explain: md`$0/0$. Differentiate: $\dfrac{3\cos(3x)}{1} \to 3\cos 0 = 3$. (Or: $\sin(3x) \approx 3x$ near 0.)`,
        },
        {
          kind: "check",
          prompt: md`What is the form of $\displaystyle\lim_{x \to 0} \frac{\cos x}{x + 1}$, and what should you do?`,
          choices: ["0/0: apply L'Hôpital", "Infinity over infinity: apply L'Hôpital", "Not indeterminate: just substitute x = 0"],
          accept: ["Not indeterminate: just substitute x = 0"],
          explain: md`At $x = 0$ the top is $\cos 0 = 1$ and the bottom is $1$. Nothing is indeterminate; the limit is $1$. L'Hôpital would wrongly give $\frac{-\sin 0}{1} = 0$.`,
        },
      ],
      practice: [zeroOverZero, infinityForms, powerForms],
    },
  ],
};
