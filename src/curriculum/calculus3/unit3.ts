import { frac, fracTex, gcd, signed, type Rng } from "../../math/random";
import { md, slug, type Generator, type Problem, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

/** A term c x^p y^q of a polynomial in two variables. */
type Term = [c: number, p: number, q: number];

const par = (n: number) => (n < 0 ? `(${n})` : String(n));
const pw = (v: string, n: number) => (n === 0 ? "" : n === 1 ? v : `${v}^{${n}}`);
const pwText = (v: string, n: number) => (n === 0 ? "" : n === 1 ? v : `${v}^${n}`);

/** Merge like terms and drop zeros. */
function tidy(terms: Term[]): Term[] {
  const out: Term[] = [];
  for (const [c, p, q] of terms) {
    const hit = out.find((t) => t[1] === p && t[2] === q);
    if (hit) hit[0] += c;
    else out.push([c, p, q]);
  }
  return out.filter((t) => t[0] !== 0).sort((a, b) => b[1] + b[2] - (a[1] + a[2]) || b[1] - a[1]);
}

/** LaTeX of a polynomial, written the way a person would. */
function tex(terms: Term[], vx = "x", vy = "y"): string {
  let out = "";
  for (const [c, p, q] of tidy(terms)) {
    const vars = pw(vx, p) + pw(vy, q);
    const mag = vars ? `${Math.abs(c) === 1 ? "" : Math.abs(c)}${vars}` : String(Math.abs(c));
    out += out ? (c < 0 ? ` - ${mag}` : ` + ${mag}`) : c < 0 ? `-${mag}` : mag;
  }
  return out || "0";
}

/** The same polynomial in typed-answer syntax. */
function txt(terms: Term[], vx = "x", vy = "y"): string {
  let out = "";
  for (const [c, p, q] of tidy(terms)) {
    const vars = [pwText(vx, p), pwText(vy, q)].filter(Boolean).join(" ");
    const mag = vars ? `${Math.abs(c) === 1 ? "" : Math.abs(c)}${vars}` : String(Math.abs(c));
    out += out ? (c < 0 ? ` - ${mag}` : ` + ${mag}`) : c < 0 ? `-${mag}` : mag;
  }
  return out || "0";
}

/** The polynomial with X and Y substituted for its variables, fully explicit, for verify equations. */
function raw(terms: Term[], X: string | number, Y: string | number): string {
  const parts = tidy(terms).map(([c, p, q]) => [String(c), ...(p ? [`(${X})^${p}`] : []), ...(q ? [`(${Y})^${q}`] : [])].join("*"));
  return `(${parts.join(" + ") || "0"})`;
}

const ev = (terms: Term[], x: number, y: number) => terms.reduce((s, [c, p, q]) => s + c * x ** p * y ** q, 0);
const dX = (terms: Term[]): Term[] => tidy(terms.filter((t) => t[1] > 0).map(([c, p, q]) => [c * p, p - 1, q]));
const dY = (terms: Term[]): Term[] => tidy(terms.filter((t) => t[2] > 0).map(([c, p, q]) => [c * q, p, q - 1]));

/**
 * Central difference quotients with step 1, as text. For a polynomial of degree at most 2 in the
 * variable they are exactly the partial derivative, so a verify equation can use them without
 * ever writing the derivative itself.
 */
const cdx = (f: Term[], x: string | number, y: string | number) => `((${raw(f, `${x}+1`, y)} - ${raw(f, `${x}-1`, y)})/2)`;
const cdy = (f: Term[], x: string | number, y: string | number) => `((${raw(f, x, `${y}+1`)} - ${raw(f, x, `${y}-1`)})/2)`;

/** sqrt(n) in simplest typed form and in LaTeX. */
function sqrtText(n: number): [string, string] {
  let k = 1;
  for (let i = 2; i * i <= n; i++) if (n % (i * i) === 0) k = i;
  const m = n / (k * k);
  if (m === 1) return [String(k), String(k)];
  if (k === 1) return [`sqrt(${m})`, `\\sqrt{${m}}`];
  return [`${k}sqrt(${m})`, `${k}\\sqrt{${m}}`];
}

/** A polynomial of degree at most 2 in each variable, with small coefficients. */
function quad(r: Rng): Term[] {
  const k = r.int(0, 6);
  const a = r.coef(-3, 3);
  const b = r.nonzero(-3, 3);
  const c = r.nonzero(-4, 4);
  const d = r.nonzero(-4, 4);
  const shapes: Term[][] = [
    [[a, 2, 0], [b, 0, 2]],
    [[a, 2, 0], [b, 1, 1], [c, 0, 2]],
    [[a, 2, 1], [c, 0, 1]],
    [[a, 1, 2], [c, 1, 0]],
    [[b, 1, 1], [c, 1, 0], [d, 0, 1]],
    [[a, 2, 0], [b, 1, 1], [d, 0, 1]],
    [[a, 2, 0], [b, 0, 2], [c, 1, 0], [d, 0, 1]],
  ];
  return tidy(shapes[k]!);
}

const PYTHAG: [number, number, number][] = [[3, 4, 5], [4, 3, 5], [-3, 4, 5], [3, -4, 5], [-4, -3, 5], [5, 12, 13], [12, -5, 13], [-5, 12, 13], [6, 8, 10], [8, -6, 10]];

const point = (x: number, y: number) => `(${x}, ${y})`;
/** "expr = value", or just the value when the expression is already that constant. */
const eq = (expr: string, value: number) => (expr === String(value) ? expr : `${expr} = ${value}`);

// ── Lesson 1: functions of several variables ────────────────────────────────

const evaluateFunction: Generator = (r) => {
  const kind = r.int(0, 2);
  const x = r.nonzero(-3, 3);
  const y = r.nonzero(-3, 3);
  if (kind === 0) {
    const f = quad(r);
    const value = ev(f, x, y);
    return {
      prompt: md`Evaluate $${tex(f)}$ when $x = ${x}$ and $y = ${y}$.`,
      answer: String(value),
      hint: md`This is $f(${x}, ${y})$: put $${par(x)}$ in for every $x$ and $${par(y)}$ in for every $y$, with parentheses.`,
      solution: [
        { math: tidy(f).map(([c, p, q]) => `${c < 0 ? "- " : "+ "}${Math.abs(c) === 1 && p + q > 0 ? "" : Math.abs(c)}${p ? `(${x})${p > 1 ? `^{${p}}` : ""}` : ""}${q ? `(${y})${q > 1 ? `^{${q}}` : ""}` : ""}`).join(" ").replace(/^\+ /, "").replace(/^- /, "-"), note: "Substitute, with every number in parentheses." },
        { math: tidy(f).map(([c, p, q]) => signed(c * x ** p * y ** q)).join(" ").replace(/^\+ /, ""), note: "Work out each term." },
        { math: String(value), note: md`So $f(${x}, ${y}) = ${value}$.` },
      ],
    };
  }
  if (kind === 1) {
    const [a, b] = [r.coef(-3, 3), r.nonzero(-3, 3)];
    let den = x + b * y;
    let yy = y;
    while (den === 0) {
      yy = r.nonzero(-3, 3);
      den = x + b * yy;
    }
    const num = a * x * x - yy;
    return {
      prompt: md`Evaluate $\dfrac{${a}x^2 - y}{x ${signed(b)}y}$ when $x = ${x}$ and $y = ${yy}$. Give an exact fraction.`,
      answer: frac(num, den),
      hint: "Evaluate the top and the bottom separately, then divide. Reduce the fraction.",
      solution: [
        { math: md`\frac{${a}${par(x)}^2 - ${par(yy)}}{${par(x)} ${signed(b)}${par(yy)}}`, note: "Substitute." },
        { math: md`\frac{${num}}{${den}}`, note: md`Top: $${a} \cdot ${x * x} ${signed(-yy)} = ${num}$. Bottom: $${x} ${signed(b * yy)} = ${den}$.` },
        { math: fracTex(num, den), note: "Reduce." },
      ],
    };
  }
  const z = r.nonzero(-3, 3);
  const [a, b] = [r.coef(-3, 3), r.coef(-4, 4)];
  const value = a * x * y * z + b * z * z;
  return {
    prompt: md`Evaluate $${a}xyz ${signed(b)}z^2$ when $x = ${x}$, $y = ${y}$ and $z = ${z}$.`,
    answer: String(value),
    hint: "A function of three variables works the same way: substitute all three.",
    solution: [
      { math: md`${a}(${x})(${y})(${z}) ${signed(b)}(${z})^2`, note: "Substitute, with every number in parentheses." },
      { math: md`${a * x * y * z} ${signed(b * z * z)}`, note: md`$${a} \cdot ${par(x)} \cdot ${par(y)} \cdot ${par(z)} = ${a * x * y * z}$ and $${b} \cdot ${z * z} = ${b * z * z}$.` },
      { math: String(value), note: "" },
    ],
  };
};

const levelCurves: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const p = r.nonzero(-5, 5);
    const q = r.nonzero(-5, 5);
    const n = p * p + q * q;
    const [ans, texAns] = sqrtText(n);
    return {
      prompt: md`The level curve of $f(x, y) = x^2 + y^2$ through the point $${point(p, q)}$ is a circle. Find its radius, in simplest exact form.`,
      answer: ans,
      simplified: true,
      verify: ["r^2 = " + raw([[1, 2, 0], [1, 0, 2]], p, q)],
      hint: md`The level curve through a point is the set where $f$ has the same value as at that point. Find that value first.`,
      solution: [
        { math: md`f(${p}, ${q}) = ${p * p} + ${q * q} = ${n}`, note: "The height of the level curve through the point." },
        { math: md`x^2 + y^2 = ${n}`, note: md`This is a circle centred at the origin with $r^2 = ${n}$.` },
        { math: md`r = \sqrt{${n}} = ${texAns}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const a = r.nonzero(-5, 5);
    const b = r.nonzero(-5, 5);
    const k = r.int(-6, 6);
    return {
      prompt: md`Every level curve of $f(x, y) = ${tex([[a, 1, 0], [b, 0, 1]])}$ is a straight line. Find the slope of the level curve $f(x, y) = ${k}$. Give an exact fraction.`,
      answer: frac(-a, b),
      verify: [`${a} + ${b} m = 0`],
      hint: md`Write the level curve as an equation in $x$ and $y$, then solve it for $y$.`,
      solution: [
        { math: md`${tex([[a, 1, 0], [b, 0, 1]])} = ${k}`, note: "Set the function equal to the level." },
        { math: md`y = \frac{${-a}x + ${k}}{${b}}`, note: md`Solve for $y$.` },
        { math: md`m = ${fracTex(-a, b)}`, note: md`The slope is the same for every level $k$: the level curves are parallel lines.` },
      ],
    };
  }
  const p = r.nonzero(-4, 4);
  const q = r.pick([1, 2, 3, 4].map((v) => (p > 0 ? v : -v)));
  const k = p * q;
  const [ans, texAns] = sqrtText(k);
  return {
    prompt: md`The level curve of $f(x, y) = xy$ through $${point(p, q)}$ is a hyperbola. Find the $x$-coordinates of the points where it meets the line $y = x$. Separate them with commas; give exact values.`,
    answer: `${ans}, -${ans}`,
    form: "set",
    simplified: true,
    verify: ["x^2 = " + k],
    hint: md`First find the level $k = f(${p}, ${q})$. Then put $y = x$ into $xy = k$.`,
    solution: [
      { math: md`xy = ${par(p)} \cdot ${par(q)} = ${k}`, note: "The level curve through the point." },
      { math: md`x \cdot x = ${k}`, note: md`On the line $y = x$.` },
      { math: md`x = \pm ${texAns}`, note: "Two crossing points, one on each branch of the hyperbola." },
    ],
  };
};

const describeFunction: Generator = (r) => {
  const kind = r.int(0, 1);
  if (kind === 0) {
    const a = r.int(2, 4);
    const items: [string, string, string][] = [
      [md`x^2 + y^2`, "circles", md`$x^2 + y^2 = k$ is a circle of radius $\sqrt{k}$ for each $k > 0$.`],
      [md`x^2 + ${a}y^2`, "ellipses", md`$x^2 + ${a}y^2 = k$ is an ellipse: the $y$-direction is squeezed by $\sqrt{${a}}$.`],
      [md`x^2 - y^2`, "hyperbolas", md`$x^2 - y^2 = k$ is a hyperbola for $k \ne 0$ (and two crossing lines for $k = 0$).`],
      [md`${a}x - y`, "parallel lines", md`$${a}x - y = k$ is a line of slope $${a}$ for every $k$.`],
      [md`y - ${a}x^2`, "parabolas", md`$y - ${a}x^2 = k$ is $y = ${a}x^2 + k$: the same parabola shifted up or down.`],
      [md`\sqrt{x^2 + y^2}`, "circles", md`$\sqrt{x^2 + y^2} = k$ is a circle of radius $k$.`],
      [md`xy`, "hyperbolas", md`$xy = k$ is a hyperbola with the axes as asymptotes.`],
    ];
    const [f, right, why] = r.pick(items);
    return {
      prompt: md`What shape are the level curves of $f(x, y) = ${f}$?`,
      choices: ["circles", "ellipses", "hyperbolas", "parallel lines", "parabolas"],
      accept: [right],
      hint: md`Set $f(x, y) = k$ and recognise the equation from analytic geometry.`,
      solution: [{ math: md`${f} = k`, note: why }],
    };
  }
  const a = r.int(2, 5);
  const items: [string, string, string, string][] = [
    [md`\sqrt{${a * a} - x^2 - y^2}`, md`the disk $x^2 + y^2 \le ${a * a}$`, md`x^2 + y^2 \le ${a * a}`, md`The square root needs $${a * a} - x^2 - y^2 \ge 0$.`],
    [md`\ln(x + y - ${a})`, md`the half-plane $x + y > ${a}$`, md`x + y > ${a}`, md`The logarithm needs a positive input.`],
    [md`\dfrac{1}{x - y}`, md`all points with $x \ne y$`, md`x \ne y`, md`Division by zero is the only problem, and it happens on the line $y = x$.`],
    [md`\sqrt{y - x^2}`, md`the points on or above the parabola $y = x^2$`, md`y \ge x^2`, md`The square root needs $y - x^2 \ge 0$.`],
    [md`\dfrac{xy}{x^2 + y^2}`, md`every point except the origin`, md`(x, y) \ne (0, 0)`, md`The denominator is zero only when $x = y = 0$.`],
  ];
  const [f, right, cond, why] = r.pick(items);
  const choices = [md`the disk $x^2 + y^2 \le ${a * a}$`, md`the half-plane $x + y > ${a}$`, md`all points with $x \ne y$`, md`the points on or above the parabola $y = x^2$`, md`every point except the origin`, "all of the plane"];
  return {
    prompt: md`What is the domain of $f(x, y) = ${f}$?`,
    choices,
    accept: [right],
    hint: "Ask where the formula fails: a square root of a negative, a log of a non-positive number, division by zero.",
    solution: [{ math: md`\text{domain: } ${cond}`, note: why }],
  };
};

// ── Lesson 2: limits and continuity ─────────────────────────────────────────

const limitBySubstitution: Generator = (r) => {
  const a = r.nonzero(-3, 3);
  const b = r.nonzero(-3, 3);
  const f = quad(r);
  if (r.next() < 0.5) {
    const value = ev(f, a, b);
    return {
      prompt: md`Find $\displaystyle\lim_{(x, y) \to ${point(a, b)}} \left(${tex(f)}\right)$.`,
      answer: String(value),
      verify: ["L = " + raw(f, a, b)],
      hint: "A polynomial is continuous everywhere, so the limit is the value at the point.",
      solution: [
        { math: md`\lim_{(x, y) \to ${point(a, b)}} \left(${tex(f)}\right) = f(${a}, ${b})`, note: "Polynomials are continuous: substitute." },
        { math: String(value), note: "" },
      ],
    };
  }
  const g: Term[] = [[1, 1, 0], [r.nonzero(-3, 3), 0, 1], [r.nonzero(-5, 5), 0, 0]];
  let den = ev(g, a, b);
  let bb = b;
  while (den === 0) {
    bb = r.nonzero(-3, 3);
    den = ev(g, a, bb);
  }
  const num = ev(f, a, bb);
  return {
    prompt: md`Find $\displaystyle\lim_{(x, y) \to ${point(a, bb)}} \frac{${tex(f)}}{${tex(g)}}$. Give an exact fraction.`,
    answer: frac(num, den),
    verify: [`L * ${raw(g, a, bb)} = ${raw(f, a, bb)}`],
    hint: "A rational function is continuous wherever its denominator isn't zero. Check the denominator at the point first.",
    solution: [
      { math: md`${tex(g)} \to ${den} \ne 0`, note: "The denominator doesn't vanish, so the quotient is continuous there." },
      { math: md`\frac{${num}}{${den}} = ${fracTex(num, den)}`, note: "Substitute into top and bottom." },
    ],
  };
};

const limitZeroOverZero: Generator = (r) => {
  const a = r.nonzero(-4, 4);
  const kind = r.int(0, 3);
  const items: Record<number, { top: string; bottom: string; at: [number, number]; simp: string; value: number; note: string }> = {
    0: { top: "x^2 - y^2", bottom: "x - y", at: [a, a], simp: "x + y", value: 2 * a, note: md`$x^2 - y^2 = (x - y)(x + y)$; cancel the $x - y$ (allowed, since $x \ne y$ away from the line).` },
    1: { top: "x^2 - xy", bottom: "x - y", at: [a, a], simp: "x", value: a, note: md`$x^2 - xy = x(x - y)$.` },
    2: { top: "x^3 - y^3", bottom: "x - y", at: [a, a], simp: "x^2 + xy + y^2", value: 3 * a * a, note: md`$x^3 - y^3 = (x - y)(x^2 + xy + y^2)$.` },
    3: { top: "x^2y - y", bottom: "x - 1", at: [1, a], simp: "y(x + 1)", value: 2 * a, note: md`$x^2 y - y = y(x^2 - 1) = y(x - 1)(x + 1)$.` },
  };
  const it = items[kind]!;
  return {
    prompt: md`Find $\displaystyle\lim_{(x, y) \to ${point(it.at[0], it.at[1])}} \frac{${it.top}}{${it.bottom}}$. The fraction is $\frac{0}{0}$ at the point, so simplify first.`,
    answer: String(it.value),
    hint: "Factor the numerator; one factor cancels with the denominator. What's left is continuous.",
    solution: [
      { math: md`\frac{${it.top}}{${it.bottom}} = ${it.simp}`, note: it.note },
      { math: md`\lim_{(x, y) \to ${point(it.at[0], it.at[1])}} ${it.simp} = ${it.value}`, note: "The simplified expression is a polynomial, so substitute." },
    ],
  };
};

const limitAlongPaths: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const k = r.coef(-4, 4);
    const m = r.nonzero(-3, 3);
    return {
      prompt: md`Along the line $y = ${m === 1 ? "" : m === -1 ? "-" : m}x$ (with $x \ne 0$), the function $f(x, y) = \dfrac{${k}xy}{x^2 + y^2}$ takes one constant value. Find it as an exact fraction.`,
      answer: frac(k * m, 1 + m * m),
      verify: [`L * (1^2 + (${m})^2) = ${k} * 1 * (${m})`],
      hint: md`Substitute $y = ${m}x$ and simplify. Every $x$ cancels.`,
      solution: [
        { math: md`f(x, ${m}x) = \frac{${k}x(${m}x)}{x^2 + (${m}x)^2} = \frac{${k * m}x^2}{${1 + m * m}x^2}`, note: md`Put $y = ${m}x$.` },
        { math: fracTex(k * m, 1 + m * m), note: md`The $x^2$ cancels, so the value doesn't depend on $x$. Approaching the origin along this line, $f$ stays at $${fracTex(k * m, 1 + m * m)}$.` },
      ],
    };
  }
  if (kind === 1) {
    const m = r.nonzero(-3, 3);
    return {
      prompt: md`Along the parabola $y = ${m === 1 ? "" : m === -1 ? "-" : m}x^2$ (with $x \ne 0$), the function $f(x, y) = \dfrac{x^2 y}{x^4 + y^2}$ is constant. Find its value as an exact fraction.`,
      answer: frac(m, 1 + m * m),
      verify: [`L * (1^4 + (${m})^2) = 1^2 * (${m})`],
      hint: md`Substitute $y = ${m}x^2$. Both top and bottom become multiples of $x^4$.`,
      solution: [
        { math: md`f(x, ${m}x^2) = \frac{x^2 \cdot ${m}x^2}{x^4 + ${m * m}x^4} = \frac{${m}x^4}{${1 + m * m}x^4}`, note: "" },
        { math: fracTex(m, 1 + m * m), note: md`Along every straight line $y = mx$ this function tends to $0$, but along this parabola it stays at $${fracTex(m, 1 + m * m)}$. So the limit at the origin does not exist.` },
      ],
    };
  }
  const k = r.int(2, 5);
  const items: [string, string, string][] = [
    [md`\dfrac{${k}xy}{x^2 + y^2}`, "the limit does not exist", md`Along $y = 0$ the values are $0$; along $y = x$ they are $\frac{${k}}{2}$. Two paths, two answers.`],
    [md`\dfrac{x^2 - y^2}{x^2 + y^2}`, "the limit does not exist", md`Along the $x$-axis $f = 1$; along the $y$-axis $f = -1$.`],
    [md`\dfrac{${k}x^2 y}{x^2 + y^2}`, "the limit is 0", md`$\left|\frac{x^2}{x^2 + y^2}\right| \le 1$, so $|f| \le ${k}|y| \to 0$. The squeeze works in every direction at once.`],
    [md`\dfrac{x^3}{x^2 + y^2}`, "the limit is 0", md`$|f| = |x| \cdot \frac{x^2}{x^2 + y^2} \le |x| \to 0$.`],
    [md`\dfrac{x^2}{x^2 + y^2}`, "the limit does not exist", md`Along the $x$-axis $f = 1$; along the $y$-axis $f = 0$.`],
    [md`\dfrac{xy^2}{x^2 + y^4}`, "the limit does not exist", md`Along $y = 0$: $0$. Along $x = y^2$: $\frac{y^4}{2y^4} = \frac12$.`],
  ];
  const [f, right, why] = r.pick(items);
  return {
    prompt: md`Consider $\displaystyle\lim_{(x, y) \to (0, 0)} ${f}$. Which is true?`,
    choices: ["the limit is 0", "the limit does not exist", "the limit is 1"],
    accept: [right],
    hint: "Try the axes and the line y = x. If two paths disagree, there is no limit. If they agree, look for a squeeze.",
    solution: [{ math: md`\lim_{(x, y) \to (0, 0)} ${f}`, note: why }],
  };
};

// ── Lesson 3: partial derivatives ───────────────────────────────────────────

/** A polynomial with a few terms of total degree up to 3 or 4. */
function cubic(r: Rng): Term[] {
  const shapes: Term[][] = [
    [[r.coef(-4, 4), 3, 1], [r.nonzero(-3, 3), 1, 2], [r.nonzero(-5, 5), 0, 1]],
    [[r.coef(-4, 4), 2, 2], [r.nonzero(-5, 5), 1, 0], [r.nonzero(-5, 5), 0, 3]],
    [[r.nonzero(-3, 3), 3, 0], [r.coef(-4, 4), 1, 1], [r.nonzero(-5, 5), 0, 2]],
    [[r.coef(-3, 3), 2, 1], [r.coef(-4, 4), 1, 3], [r.nonzero(-6, 6), 0, 0]],
    [[r.coef(-5, 5), 1, 1], [r.nonzero(-3, 3), 2, 0], [r.nonzero(-3, 3), 0, 2], [r.nonzero(-5, 5), 1, 0]],
  ];
  return tidy(r.pick(shapes));
}

const firstPartialsPolynomial: Generator = (r) => {
  const f = cubic(r);
  const wrtX = r.next() < 0.5;
  const d = wrtX ? dX(f) : dY(f);
  const v = wrtX ? "x" : "y";
  const other = wrtX ? "y" : "x";
  const steps: Step[] = tidy(f).map(([c, p, q]) => {
    const own = wrtX ? p : q;
    const rest = wrtX ? pw("y", q) : pw("x", p);
    const term = tex([[c, p, q]]);
    if (own === 0) return { math: md`\frac{\partial}{\partial ${v}}\left(${term}\right) = 0`, note: md`No $${v}$ here: with $${other}$ held fixed this term is a constant.` };
    const dTerm = wrtX ? tex(dX([[c, p, q]])) : tex(dY([[c, p, q]]));
    const factor = rest ? `${c === 1 ? "" : c === -1 ? "-" : c}${rest}` : String(c);
    const note = own === 1 ? md`The derivative of $${v}$ is $1$, leaving the constant factor $${factor}$.` : md`Power rule on $${v}^{${own}}$; the factor $${factor}$ rides along as a constant.`;
    return { math: md`\frac{\partial}{\partial ${v}}\left(${term}\right) = ${dTerm}`, note };
  });
  if (r.next() < 0.35) {
    const x = r.nonzero(-2, 2);
    const y = r.nonzero(-2, 2);
    const value = ev(d, x, y);
    return {
      prompt: md`Find $\frac{\partial f}{\partial ${v}}$ when $f(x, y) = ${tex(f)}$ and $x = ${x}$ and $y = ${y}$.`,
      answer: String(value),
      hint: md`Differentiate with respect to $${v}$ treating $${other}$ as a constant, then substitute the point.`,
      solution: [...steps, { math: md`f_${v}(x, y) = ${tex(d)}`, note: "Add the pieces." }, { math: md`f_${v}(${x}, ${y}) = ${value}`, note: "Substitute." }],
    };
  }
  return {
    prompt: md`Find $\frac{\partial f}{\partial ${v}}$ when $f(x, y) = ${tex(f)}$.`,
    answer: txt(d),
    hint: md`Treat $${other}$ as a constant and differentiate term by term with respect to $${v}$.`,
    solution: [...steps, { math: md`f_${v}(x, y) = ${tex(d)}`, note: "Add the pieces." }],
  };
};

const firstPartialsRules: Generator = (r) => {
  const a = r.int(2, 4);
  const items: { f: string; fx: string; fy: string; fxTex: string; fyTex: string; ruleX: string; ruleY: string }[] = [
    { f: md`x e^{${a}xy}`, fx: `e^(${a}xy)(1 + ${a}xy)`, fy: `${a}x^2 e^(${a}xy)`, fxTex: md`e^{${a}xy}(1 + ${a}xy)`, fyTex: md`${a}x^2 e^{${a}xy}`, ruleX: md`Product rule: $1 \cdot e^{${a}xy} + x \cdot ${a}y\,e^{${a}xy}$, since $\frac{\partial}{\partial x} e^{${a}xy} = ${a}y\,e^{${a}xy}$ by the chain rule.`, ruleY: md`$x$ is a constant here, so only the exponential moves: $x \cdot ${a}x\,e^{${a}xy}$.` },
    { f: md`\sin(${a}xy)`, fx: `${a}y cos(${a}xy)`, fy: `${a}x cos(${a}xy)`, fxTex: md`${a}y\cos(${a}xy)`, fyTex: md`${a}x\cos(${a}xy)`, ruleX: md`Chain rule: $\cos(${a}xy)$ times the $x$-derivative of the inside, $${a}y$.`, ruleY: md`Chain rule: $\cos(${a}xy)$ times the $y$-derivative of the inside, $${a}x$.` },
    { f: md`\sqrt{x^2 + y^2}`, fx: `x/sqrt(x^2 + y^2)`, fy: `y/sqrt(x^2 + y^2)`, fxTex: md`\frac{x}{\sqrt{x^2 + y^2}}`, fyTex: md`\frac{y}{\sqrt{x^2 + y^2}}`, ruleX: md`$\frac{1}{2}(x^2 + y^2)^{-1/2} \cdot 2x$.`, ruleY: md`$\frac{1}{2}(x^2 + y^2)^{-1/2} \cdot 2y$.` },
    { f: md`\ln(x^2 + ${a}y)`, fx: `2x/(x^2 + ${a}y)`, fy: `${a}/(x^2 + ${a}y)`, fxTex: md`\frac{2x}{x^2 + ${a}y}`, fyTex: md`\frac{${a}}{x^2 + ${a}y}`, ruleX: md`$\frac{1}{\text{inside}}$ times the $x$-derivative of the inside.`, ruleY: md`$\frac{1}{\text{inside}}$ times the $y$-derivative of the inside, $${a}$.` },
    { f: md`\dfrac{x^${a}}{y}`, fx: `${a}x^${a - 1}/y`, fy: `-x^${a}/y^2`, fxTex: md`\frac{${a}x^{${a - 1}}}{y}`, fyTex: md`-\frac{x^{${a}}}{y^2}`, ruleX: md`$\frac{1}{y}$ is a constant multiplier; power rule on $x^${a}$.`, ruleY: md`Write it as $x^${a} y^{-1}$; the derivative of $y^{-1}$ is $-y^{-2}$.` },
    { f: md`\dfrac{y}{x + ${a}y}`, fx: `-y/(x + ${a}y)^2`, fy: `x/(x + ${a}y)^2`, fxTex: md`-\frac{y}{(x + ${a}y)^2}`, fyTex: md`\frac{x}{(x + ${a}y)^2}`, ruleX: md`$y(x + ${a}y)^{-1}$: chain rule gives $-y(x + ${a}y)^{-2}$.`, ruleY: md`Quotient rule: $\frac{(x + ${a}y) \cdot 1 - y \cdot ${a}}{(x + ${a}y)^2}$.` },
    { f: md`e^{${a}x}\cos y`, fx: `${a}e^(${a}x) cos(y)`, fy: `-e^(${a}x) sin(y)`, fxTex: md`${a}e^{${a}x}\cos y`, fyTex: md`-e^{${a}x}\sin y`, ruleX: md`$\cos y$ is a constant; $\frac{d}{dx} e^{${a}x} = ${a}e^{${a}x}$.`, ruleY: md`$e^{${a}x}$ is a constant; $\frac{d}{dy}\cos y = -\sin y$.` },
    { f: md`\cos(x^2 + ${a}y)`, fx: `-2x sin(x^2 + ${a}y)`, fy: `-${a} sin(x^2 + ${a}y)`, fxTex: md`-2x\sin(x^2 + ${a}y)`, fyTex: md`-${a}\sin(x^2 + ${a}y)`, ruleX: md`Chain rule: $-\sin(\text{inside}) \cdot 2x$.`, ruleY: md`Chain rule: $-\sin(\text{inside}) \cdot ${a}$.` },
    { f: md`\arctan\left(\dfrac{y}{x}\right)`, fx: `-y/(x^2 + y^2)`, fy: `x/(x^2 + y^2)`, fxTex: md`-\frac{y}{x^2 + y^2}`, fyTex: md`\frac{x}{x^2 + y^2}`, ruleX: md`$\frac{1}{1 + (y/x)^2} \cdot \left(-\frac{y}{x^2}\right)$, then multiply top and bottom by $x^2$.`, ruleY: md`$\frac{1}{1 + (y/x)^2} \cdot \frac{1}{x}$, then multiply top and bottom by $x^2$.` },
    { f: md`(x + ${a}y)^3`, fx: `3(x + ${a}y)^2`, fy: `${3 * a}(x + ${a}y)^2`, fxTex: md`3(x + ${a}y)^2`, fyTex: md`${3 * a}(x + ${a}y)^2`, ruleX: md`Chain rule: $3(\text{inside})^2 \cdot 1$.`, ruleY: md`Chain rule: $3(\text{inside})^2 \cdot ${a}$.` },
  ];
  const it = r.pick(items);
  const wrtX = r.next() < 0.5;
  return {
    prompt: md`Find $\frac{\partial f}{\partial ${wrtX ? "x" : "y"}}$ when $f(x, y) = ${it.f}$.`,
    answer: wrtX ? it.fx : it.fy,
    hint: md`Hold $${wrtX ? "y" : "x"}$ fixed and use the one-variable rules (product, quotient, chain) in $${wrtX ? "x" : "y"}$.`,
    solution: [{ math: md`f_${wrtX ? "x" : "y"} = ${wrtX ? it.fxTex : it.fyTex}`, note: wrtX ? it.ruleX : it.ruleY }],
  };
};

const secondPartials: Generator = (r) => {
  const f = cubic(r);
  const which = r.pick(["xx", "yy", "xy", "yx"] as const);
  const first = which[0] === "x" ? dX(f) : dY(f);
  const second = which[1] === "x" ? dX(first) : dY(first);
  const steps: Step[] = [
    { math: md`f_${which[0]} = ${tex(first)}`, note: md`Differentiate with respect to $${which[0]}$ first.` },
    { math: md`f_{${which}} = ${tex(second)}`, note: md`Then differentiate that with respect to $${which[1]}$.` },
  ];
  if (which === "xy" || which === "yx") steps.push({ math: md`f_{xy} = f_{yx}`, note: "Clairaut: the mixed partials of a polynomial agree, so either order gives the same answer." });
  if (r.next() < 0.3) {
    const x = r.nonzero(-2, 2);
    const y = r.nonzero(-2, 2);
    const value = ev(second, x, y);
    return {
      prompt: md`Find $f_{${which}}$ at the point $${point(x, y)}$ when $f(x, y) = ${tex(f)}$.`,
      answer: String(value),
      hint: md`$f_{${which}}$ means: differentiate with respect to $${which[0]}$, then with respect to $${which[1]}$. Substitute at the end.`,
      solution: [...steps, { math: md`f_{${which}}(${x}, ${y}) = ${value}`, note: "Substitute." }],
    };
  }
  return {
    prompt: md`Find $f_{${which}}$ when $f(x, y) = ${tex(f)}$.`,
    answer: txt(second),
    hint: md`Subscripts are read left to right: $f_{${which}}$ differentiates with respect to $${which[0]}$ first, then $${which[1]}$.`,
    solution: steps,
  };
};

// ── Lesson 4: tangent planes ────────────────────────────────────────────────

/** A quadratic, a point, and the pieces of its tangent plane there. */
function planeData(r: Rng) {
  const f = quad(r);
  const x0 = r.nonzero(-3, 3);
  const y0 = r.nonzero(-3, 3);
  const fx = ev(dX(f), x0, y0);
  const fy = ev(dY(f), x0, y0);
  const z0 = ev(f, x0, y0);
  return { f, x0, y0, fx, fy, z0, c: z0 - fx * x0 - fy * y0 };
}

const tangentPlane: Generator = (r) => {
  const { f, x0, y0, fx, fy, z0, c } = planeData(r);
  return {
    prompt: md`Find the tangent plane to $z = ${tex(f)}$ at the point where $x = ${x0}$ and $y = ${y0}$. Write it as $z = ax + by + c$ and answer with $(a, b, c)$.`,
    answer: `(${fx}, ${fy}, ${c})`,
    form: "tuple",
    verify: [`a*${par(x0)} + b*${par(y0)} + c = ${raw(f, x0, y0)}`, `a + 0b + 0c = ${cdx(f, x0, y0)}`, `b + 0a + 0c = ${cdy(f, x0, y0)}`],
    hint: md`$z = f(x_0, y_0) + f_x(x_0, y_0)(x - x_0) + f_y(x_0, y_0)(y - y_0)$. Then collect the constants.`,
    solution: [
      { math: md`f(${x0}, ${y0}) = ${z0}`, note: "The point on the surface." },
      { math: md`f_x = ${tex(dX(f))}, \quad f_x(${x0}, ${y0}) = ${fx}`, note: "Slope in the x-direction." },
      { math: md`f_y = ${tex(dY(f))}, \quad f_y(${x0}, ${y0}) = ${fy}`, note: "Slope in the y-direction." },
      { math: md`z = ${z0} + ${par(fx)}(x - ${par(x0)}) + ${par(fy)}(y - ${par(y0)})`, note: "The tangent plane formula." },
      { math: md`z = ${tex([[fx, 1, 0], [fy, 0, 1], [c, 0, 0]])}`, note: md`Expand and collect: $${z0} ${signed(-fx * x0)} ${signed(-fy * y0)} = ${c}$.` },
    ],
  };
};

const linearApproximation: Generator = (r) => {
  const { f, x0, y0, fx, fy, z0 } = planeData(r);
  const h1 = r.nonzero(-3, 3);
  const h2 = r.nonzero(-3, 3);
  const N = 10 * z0 + fx * h1 + fy * h2;
  const dec = (n: number) => (n / 10).toString();
  const x1 = dec(10 * x0 + h1);
  const y1 = dec(10 * y0 + h2);
  return {
    prompt: md`Let $f(x, y) = ${tex(f)}$. Use the linearization of $f$ at $${point(x0, y0)}$ to estimate $f(${x1}, ${y1})$. Give the estimate as a decimal.`,
    answer: dec(N),
    verify: [`L = ${raw(f, x0, y0)} + (${h1}/10)*${cdx(f, x0, y0)} + (${h2}/10)*${cdy(f, x0, y0)}`],
    hint: md`$L(x, y) = f(x_0, y_0) + f_x(x_0, y_0)\,\Delta x + f_y(x_0, y_0)\,\Delta y$ with $\Delta x = ${dec(h1)}$ and $\Delta y = ${dec(h2)}$.`,
    solution: [
      { math: md`f(${x0}, ${y0}) = ${z0}, \quad f_x(${x0}, ${y0}) = ${fx}, \quad f_y(${x0}, ${y0}) = ${fy}`, note: md`From $f_x = ${tex(dX(f))}$ and $f_y = ${tex(dY(f))}$.` },
      { math: md`\Delta x = ${dec(h1)}, \quad \Delta y = ${dec(h2)}`, note: "How far the new point is from the base point." },
      { math: md`L = ${z0} + ${par(fx)}(${dec(h1)}) + ${par(fy)}(${dec(h2)})`, note: "Height of the tangent plane at the new point." },
      { math: md`L = ${dec(N)}`, note: md`The true value is $f(${x1}, ${y1}) = ${ev(f, (10 * x0 + h1) / 10, (10 * y0 + h2) / 10).toFixed(2).replace(/\.?0+$/, "")}$; the error is quadratic in the step.` },
    ],
  };
};

const horizontalTangentPlane: Generator = (r) => {
  const p = r.coef(-3, 3);
  const q = r.coef(-3, 3);
  const x0 = r.nonzero(-3, 3);
  const y0 = r.nonzero(-3, 3);
  const e = r.int(-5, 5);
  const f: Term[] = tidy([[p, 2, 0], [q, 0, 2], [-2 * p * x0, 1, 0], [-2 * q * y0, 0, 1], [e, 0, 0]]);
  return {
    prompt: md`At one point the tangent plane to $z = ${tex(f)}$ is horizontal. Find that point's $(x, y)$.`,
    answer: `(${x0}, ${y0})`,
    form: "tuple",
    verify: [`${raw(f, "a+1", "b")} - ${raw(f, "a-1", "b")} = 0`, `${raw(f, "a", "b+1")} - ${raw(f, "a", "b-1")} = 0`],
    hint: md`A horizontal plane is $z = c$: both slopes are zero. Set $f_x = 0$ and $f_y = 0$.`,
    solution: [
      { math: md`f_x = ${tex(dX(f))} = 0 \implies x = ${x0}`, note: "The x-slope must vanish." },
      { math: md`f_y = ${tex(dY(f))} = 0 \implies y = ${y0}`, note: "So must the y-slope." },
      { math: md`(${x0}, ${y0})`, note: md`There the tangent plane is $z = f(${x0}, ${y0}) = ${ev(f, x0, y0)}$, flat.` },
    ],
  };
};

// ── Lesson 5: the chain rule ────────────────────────────────────────────────

/** Polynomials in t of degree at most 2, as Term[] in (t, unused). */
const PATHS: [Term[], string][] = [
  [[[1, 2, 0]], "t^2"],
  [[[2, 1, 0]], "2t"],
  [[[1, 1, 0], [1, 0, 0]], "t + 1"],
  [[[1, 2, 0], [-1, 0, 0]], "t^2 - 1"],
  [[[3, 1, 0]], "3t"],
  [[[2, 1, 0], [1, 0, 0]], "2t + 1"],
  [[[1, 2, 0], [1, 1, 0]], "t^2 + t"],
  [[[1, 1, 0], [-2, 0, 0]], "t - 2"],
];

const chainRuleOneVariable: Generator = (r) => {
  const f = quad(r);
  const [xt, xTex] = r.pick(PATHS);
  let [yt, yTex] = r.pick(PATHS);
  while (yTex === xTex) [yt, yTex] = r.pick(PATHS);
  const t0 = r.nonzero(-2, 2);
  const x0 = ev(xt, t0, 0);
  const y0 = ev(yt, t0, 0);
  const fx = ev(dX(f), x0, y0);
  const fy = ev(dY(f), x0, y0);
  const dx = ev(dX(xt), t0, 0);
  const dy = ev(dX(yt), t0, 0);
  const D = fx * dx + fy * dy;
  return {
    prompt: md`Let $z = ${tex(f)}$ with $x = ${xTex}$ and $y = ${yTex}$. Find $\dfrac{dz}{dt}$ when $t = ${t0}$.`,
    answer: String(D),
    verify: [`D = ${cdx(f, x0, y0)} * ${cdx(xt, t0, 0)} + ${cdy(f, x0, y0)} * ${cdx(yt, t0, 0)}`],
    hint: md`$\frac{dz}{dt} = \frac{\partial z}{\partial x}\frac{dx}{dt} + \frac{\partial z}{\partial y}\frac{dy}{dt}$. Evaluate the partials at the point $(x, y)$ that $t = ${t0}$ gives.`,
    solution: [
      { math: md`t = ${t0}: \quad x = ${x0}, \quad y = ${y0}`, note: "Where the path is at that moment." },
      { math: md`z_x = ${eq(tex(dX(f)), fx)}, \quad z_y = ${eq(tex(dY(f)), fy)}`, note: md`Partials of $z$, evaluated at $(${x0}, ${y0})$.` },
      { math: md`\frac{dx}{dt} = ${eq(tex(dX(xt), "t"), dx)}, \quad \frac{dy}{dt} = ${eq(tex(dX(yt), "t"), dy)}`, note: md`Derivatives of the path at $t = ${t0}$.` },
      { math: md`\frac{dz}{dt} = ${par(fx)} \cdot ${par(dx)} + ${par(fy)} \cdot ${par(dy)} = ${D}`, note: "One term for each route from z down to t." },
    ],
  };
};

const implicitDifferentiation: Generator = (r) => {
  let F = quad(r);
  let x0 = r.nonzero(-3, 3);
  let y0 = r.nonzero(-3, 3);
  while (ev(dY(F), x0, y0) === 0) {
    F = quad(r);
    x0 = r.nonzero(-3, 3);
    y0 = r.nonzero(-3, 3);
  }
  const k = ev(F, x0, y0);
  const Fx = ev(dX(F), x0, y0);
  const Fy = ev(dY(F), x0, y0);
  return {
    prompt: md`The curve $${tex(F)} = ${k}$ passes through $${point(x0, y0)}$. Find $\dfrac{dy}{dx}$ at that point, as an exact fraction.`,
    answer: frac(-Fx, Fy),
    verify: [`${cdx(F, x0, y0)} + m * ${cdy(F, x0, y0)} = 0`],
    hint: md`With $F(x, y) = ${tex(F)}$, the chain rule gives $F_x + F_y \frac{dy}{dx} = 0$, so $\frac{dy}{dx} = -\frac{F_x}{F_y}$.`,
    solution: [
      { math: md`F_x = ${tex(dX(F))}, \quad F_y = ${tex(dY(F))}`, note: md`Partials of $F(x, y) = ${tex(F)}$.` },
      { math: md`F_x(${x0}, ${y0}) = ${Fx}, \quad F_y(${x0}, ${y0}) = ${Fy}`, note: "At the point." },
      { math: md`\frac{dy}{dx} = -\frac{F_x}{F_y} = -\frac{${Fx}}{${Fy}} = ${fracTex(-Fx, Fy)}`, note: md`Differentiating $F(x, y(x)) = ${k}$ with the chain rule: $F_x \cdot 1 + F_y \cdot y' = 0$.` },
    ],
  };
};

const MAPS: [Term[], string][] = [
  [[[1, 1, 1]], "st"],
  [[[1, 1, 0], [1, 0, 1]], "s + t"],
  [[[1, 1, 0], [-1, 0, 1]], "s - t"],
  [[[1, 2, 0], [-1, 0, 1]], "s^2 - t"],
  [[[2, 1, 0], [1, 0, 2]], "2s + t^2"],
  [[[1, 1, 2]], "st^2"],
  [[[1, 2, 0], [1, 0, 2]], "s^2 + t^2"],
];

const chainRuleTwoVariables: Generator = (r) => {
  const f = quad(r);
  const [xst, xTex] = r.pick(MAPS);
  let [yst, yTex] = r.pick(MAPS);
  while (yTex === xTex) [yst, yTex] = r.pick(MAPS);
  const s0 = r.nonzero(-2, 2);
  const t0 = r.nonzero(-2, 2);
  const x0 = ev(xst, s0, t0);
  const y0 = ev(yst, s0, t0);
  const fx = ev(dX(f), x0, y0);
  const fy = ev(dY(f), x0, y0);
  const wrtS = r.next() < 0.5;
  const v = wrtS ? "s" : "t";
  const xv = wrtS ? ev(dX(xst), s0, t0) : ev(dY(xst), s0, t0);
  const yv = wrtS ? ev(dX(yst), s0, t0) : ev(dY(yst), s0, t0);
  const D = fx * xv + fy * yv;
  const cd = wrtS ? cdx : cdy;
  return {
    prompt: md`Let $z = ${tex(f)}$ with $x = ${xTex}$ and $y = ${yTex}$. Find $\dfrac{\partial z}{\partial ${v}}$ when $s = ${s0}$ and $t = ${t0}$.`,
    answer: String(D),
    verify: [`D = ${cdx(f, x0, y0)} * ${cd(xst, s0, t0)} + ${cdy(f, x0, y0)} * ${cd(yst, s0, t0)}`],
    hint: md`Two routes from $z$ to $${v}$: through $x$ and through $y$. $\frac{\partial z}{\partial ${v}} = z_x x_${v} + z_y y_${v}$.`,
    solution: [
      { math: md`(s, t) = (${s0}, ${t0}): \quad x = ${x0}, \quad y = ${y0}`, note: "" },
      { math: md`z_x = ${eq(tex(dX(f)), fx)}, \quad z_y = ${eq(tex(dY(f)), fy)}`, note: md`At $(x, y) = (${x0}, ${y0})$.` },
      { math: md`x_${v} = ${eq(tex(wrtS ? dX(xst) : dY(xst), "s", "t"), xv)}, \quad y_${v} = ${eq(tex(wrtS ? dX(yst) : dY(yst), "s", "t"), yv)}`, note: md`At $(s, t) = (${s0}, ${t0})$, holding the other variable fixed.` },
      { math: md`\frac{\partial z}{\partial ${v}} = ${par(fx)} \cdot ${par(xv)} + ${par(fy)} \cdot ${par(yv)} = ${D}`, note: "Add the two routes." },
    ],
  };
};

// ── Lesson 6: gradient and directional derivatives ──────────────────────────

const directionalDerivative: Generator = (r) => {
  const f = quad(r);
  const x0 = r.nonzero(-3, 3);
  const y0 = r.nonzero(-3, 3);
  const fx = ev(dX(f), x0, y0);
  const fy = ev(dY(f), x0, y0);
  const [v1, v2, n] = r.pick(PYTHAG);
  const dot = fx * v1 + fy * v2;
  return {
    prompt: md`Let $f(x, y) = ${tex(f)}$. Find the directional derivative of $f$ at $${point(x0, y0)}$ in the direction of $\mathbf{v} = \langle ${v1}, ${v2} \rangle$. Give an exact fraction.`,
    answer: frac(dot, n),
    verify: [`D * ${n} = ${cdx(f, x0, y0)} * ${par(v1)} + ${cdy(f, x0, y0)} * ${par(v2)}`],
    hint: md`$D_{\mathbf{u}} f = \nabla f \cdot \mathbf{u}$, where $\mathbf{u}$ must be a **unit** vector: divide $\mathbf{v}$ by its length first.`,
    solution: [
      { math: md`\nabla f = \langle ${tex(dX(f))}, ${tex(dY(f))} \rangle, \quad \nabla f(${x0}, ${y0}) = \langle ${fx}, ${fy} \rangle`, note: "The gradient at the point." },
      { math: md`\mathbf{u} = \frac{\mathbf{v}}{|\mathbf{v}|} = \left\langle \frac{${v1}}{${n}}, \frac{${v2}}{${n}} \right\rangle`, note: md`$|\mathbf{v}| = \sqrt{${v1 * v1} + ${v2 * v2}} = ${n}$.` },
      { math: md`D_{\mathbf{u}} f = \frac{${par(fx)} \cdot ${par(v1)} + ${par(fy)} \cdot ${par(v2)}}{${n}} = ${fracTex(dot, n)}`, note: "Dot the gradient with the unit direction." },
    ],
  };
};

const gradientAtPoint: Generator = (r) => {
  let f = quad(r);
  let x0 = r.nonzero(-3, 3);
  let y0 = r.nonzero(-3, 3);
  while (ev(dX(f), x0, y0) === 0 && ev(dY(f), x0, y0) === 0) {
    f = quad(r);
    x0 = r.nonzero(-3, 3);
    y0 = r.nonzero(-3, 3);
  }
  const fx = ev(dX(f), x0, y0);
  const fy = ev(dY(f), x0, y0);
  const grad: Step = { math: md`\nabla f = \langle ${tex(dX(f))}, ${tex(dY(f))} \rangle, \quad \nabla f(${x0}, ${y0}) = \langle ${fx}, ${fy} \rangle`, note: "Both partials, evaluated at the point." };
  if (r.next() < 0.5) {
    return {
      prompt: md`Find the gradient of $f(x, y) = ${tex(f)}$ at $${point(x0, y0)}$. Answer as a vector $\langle a, b \rangle$.`,
      answer: `(${fx}, ${fy})`,
      form: "tuple",
      verify: [`a + 0b = ${cdx(f, x0, y0)}`, `b + 0a = ${cdy(f, x0, y0)}`],
      hint: md`$\nabla f = \langle f_x, f_y \rangle$: compute both partials, then substitute.`,
      solution: [grad],
    };
  }
  const [ans, texAns] = sqrtText(fx * fx + fy * fy);
  return {
    prompt: md`Find the maximum rate of change of $f(x, y) = ${tex(f)}$ at $${point(x0, y0)}$, in simplest exact form.`,
    answer: ans,
    simplified: true,
    verify: [`m^2 = ${cdx(f, x0, y0)}^2 + ${cdy(f, x0, y0)}^2`],
    hint: "The largest directional derivative is the length of the gradient, taken in the gradient's own direction.",
    solution: [
      grad,
      { math: md`|\nabla f(${x0}, ${y0})| = \sqrt{${fx * fx} + ${fy * fy}} = ${texAns}`, note: md`$D_{\mathbf{u}} f = |\nabla f|\cos\theta$ is largest when $\theta = 0$, and then it equals $|\nabla f|$.` },
    ],
  };
};

const levelCurveSlope: Generator = (r) => {
  let f = quad(r);
  let x0 = r.nonzero(-3, 3);
  let y0 = r.nonzero(-3, 3);
  while (ev(dX(f), x0, y0) === 0 || ev(dY(f), x0, y0) === 0) {
    f = quad(r);
    x0 = r.nonzero(-3, 3);
    y0 = r.nonzero(-3, 3);
  }
  const fx = ev(dX(f), x0, y0);
  const fy = ev(dY(f), x0, y0);
  const k = ev(f, x0, y0);
  const normal = r.next() < 0.35;
  const grad: Step = { math: md`\nabla f(${x0}, ${y0}) = \langle ${fx}, ${fy} \rangle`, note: md`From $\nabla f = \langle ${tex(dX(f))}, ${tex(dY(f))} \rangle$.` };
  if (normal) {
    return {
      prompt: md`Find the slope of the **normal line** to the level curve $${tex(f)} = ${k}$ at the point $${point(x0, y0)}$. Give an exact fraction.`,
      answer: frac(fy, fx),
      verify: [`m * ${cdx(f, x0, y0)} = ${cdy(f, x0, y0)}`],
      hint: "The gradient is perpendicular to the level curve, so the normal line runs along the gradient.",
      solution: [grad, { math: md`m = \frac{f_y}{f_x} = ${fracTex(fy, fx)}`, note: md`A line in the direction $\langle ${fx}, ${fy} \rangle$ has slope $\frac{${fy}}{${fx}}$.` }],
    };
  }
  return {
    prompt: md`Find the slope of the tangent line to the level curve $${tex(f)} = ${k}$ at the point $${point(x0, y0)}$. Give an exact fraction.`,
    answer: frac(-fx, fy),
    verify: [`${cdx(f, x0, y0)} + m * ${cdy(f, x0, y0)} = 0`],
    hint: "The gradient is perpendicular to the level curve. A tangent direction is perpendicular to the gradient.",
    solution: [
      grad,
      { math: md`\langle ${fx}, ${fy} \rangle \cdot \langle 1, m \rangle = 0 \implies m = -\frac{${fx}}{${fy}} = ${fracTex(-fx, fy)}`, note: md`The tangent direction $\langle 1, m \rangle$ must be perpendicular to $\nabla f$. (Same as $-F_x/F_y$ from implicit differentiation.)` },
    ],
  };
};

// ── Lesson 7: maxima and minima ─────────────────────────────────────────────

/** p x^2 + q xy + s y^2 + c x + d y with its critical point placed at (x0, y0). */
function quadWithCritical(r: Rng) {
  let p = r.coef(-3, 3);
  let q = r.int(-3, 3);
  let s = r.coef(-3, 3);
  while (4 * p * s - q * q === 0) {
    p = r.coef(-3, 3);
    q = r.int(-3, 3);
    s = r.coef(-3, 3);
  }
  const x0 = r.int(-3, 3);
  const y0 = r.nonzero(-3, 3);
  const c = -(2 * p * x0 + q * y0);
  const d = -(q * x0 + 2 * s * y0);
  const f: Term[] = tidy([[p, 2, 0], [q, 1, 1], [s, 0, 2], [c, 1, 0], [d, 0, 1]]);
  return { f, p, q, s, x0, y0, D: 4 * p * s - q * q };
}

const criticalPoints: Generator = (r) => {
  const { f, x0, y0 } = quadWithCritical(r);
  const fx = dX(f);
  const fy = dY(f);
  return {
    prompt: md`Find the critical point of $f(x, y) = ${tex(f)}$. Answer as $(x, y)$.`,
    answer: `(${x0}, ${y0})`,
    form: "tuple",
    verify: [`${raw(f, "a+1", "b")} - ${raw(f, "a-1", "b")} = 0`, `${raw(f, "a", "b+1")} - ${raw(f, "a", "b-1")} = 0`],
    hint: md`Set both partials to zero and solve the two linear equations together.`,
    solution: [
      { math: md`f_x = ${tex(fx)} = 0`, note: "" },
      { math: md`f_y = ${tex(fy)} = 0`, note: "Two linear equations in x and y." },
      { math: md`(x, y) = (${x0}, ${y0})`, note: md`Solve by substitution or elimination. Check: $f_x(${x0}, ${y0}) = ${ev(fx, x0, y0)}$ and $f_y(${x0}, ${y0}) = ${ev(fy, x0, y0)}$.` },
    ],
  };
};

const classifyCriticalPoint: Generator = (r) => {
  const choices = ["a local minimum", "a local maximum", "a saddle point"];
  if (r.next() < 0.55) {
    const { f, p, q, s, x0, y0, D } = quadWithCritical(r);
    const right = D < 0 ? choices[2]! : p > 0 ? choices[0]! : choices[1]!;
    const steps: Step[] = [
      { math: md`f_{xx} = ${2 * p}, \quad f_{yy} = ${2 * s}, \quad f_{xy} = ${q}`, note: "Second partials of a quadratic are constants." },
      { math: md`D = f_{xx} f_{yy} - f_{xy}^2 = ${par(2 * p)}${par(2 * s)} - ${par(q)}^2 = ${D}`, note: "" },
      { math: md`\text{${right}}`, note: D < 0 ? md`$D < 0$: a saddle.` : md`$D > 0$ and $f_{xx} ${p > 0 ? ">" : "<"} 0$, so the surface curves ${p > 0 ? "up" : "down"} in every direction.` },
    ];
    if (r.next() < 0.4) {
      return {
        prompt: md`The point $${point(x0, y0)}$ is a critical point of $f(x, y) = ${tex(f)}$. Compute $D = f_{xx} f_{yy} - f_{xy}^2$ there.`,
        answer: String(D),
        hint: "Find the three second partials, then combine them.",
        solution: steps.slice(0, 2),
      };
    }
    return {
      prompt: md`The point $${point(x0, y0)}$ is a critical point of $f(x, y) = ${tex(f)}$. Classify it.`,
      choices,
      accept: [right],
      hint: md`Compute $D = f_{xx} f_{yy} - f_{xy}^2$ at the point. $D < 0$: saddle. $D > 0$: look at the sign of $f_{xx}$.`,
      solution: steps,
    };
  }
  const k = r.int(1, 3);
  const c = r.coef(-3, 3);
  const sign = r.sign();
  const x0 = sign * k;
  const f: Term[] = [[1, 3, 0], [-3 * k * k, 1, 0], [c, 0, 2]];
  const D = 12 * c * x0;
  const right = D < 0 ? choices[2]! : 6 * x0 > 0 ? choices[0]! : choices[1]!;
  const steps: Step[] = [
    { math: md`f_x = 3x^2 - ${3 * k * k}, \quad f_y = ${2 * c}y`, note: md`Both vanish at $(${x0}, 0)$: $3 \cdot ${k * k} - ${3 * k * k} = 0$.` },
    { math: md`f_{xx} = 6x, \quad f_{yy} = ${2 * c}, \quad f_{xy} = 0`, note: "" },
    { math: md`D(${x0}, 0) = ${6 * x0} \cdot ${par(2 * c)} - 0 = ${D}`, note: "" },
    { math: md`\text{${right}}`, note: D < 0 ? md`$D < 0$: a saddle.` : md`$D > 0$ with $f_{xx} = ${6 * x0} ${6 * x0 > 0 ? ">" : "<"} 0$.` },
  ];
  if (r.next() < 0.4) {
    return {
      prompt: md`The point $${point(x0, 0)}$ is a critical point of $f(x, y) = ${tex(f)}$. Compute $D = f_{xx} f_{yy} - f_{xy}^2$ there.`,
      answer: String(D),
      hint: "Here the second partials aren't constant: evaluate them at the point.",
      solution: steps.slice(1, 3),
    };
  }
  return {
    prompt: md`The point $${point(x0, 0)}$ is a critical point of $f(x, y) = ${tex(f)}$. Classify it.`,
    choices,
    accept: [right],
    hint: md`$D$ depends on the point here. Evaluate $f_{xx}$, $f_{yy}$, $f_{xy}$ at $(${x0}, 0)$.`,
    solution: steps,
  };
};

const absoluteExtrema: Generator = (r) => {
  if (r.next() < 0.55) {
    const W = r.int(2, 5);
    const H = r.int(2, 5);
    const x0 = r.int(1, W - 1);
    const y0 = r.int(1, H - 1);
    const f: Term[] = [[1, 2, 0], [1, 0, 2], [-2 * x0, 1, 0], [-2 * y0, 0, 1]];
    const corners: [number, number][] = [[0, 0], [W, 0], [0, H], [W, H]];
    const vals = corners.map(([x, y]) => ev(f, x, y));
    const max = Math.max(...vals);
    const far = corners[vals.indexOf(max)]!;
    const min = ev(f, x0, y0);
    const wantMax = r.next() < 0.5;
    const steps: Step[] = [
      { math: md`f_x = 2x - ${2 * x0} = 0, \quad f_y = 2y - ${2 * y0} = 0 \implies (${x0}, ${y0})`, note: md`The only critical point, and it is inside the rectangle. $f(${x0}, ${y0}) = ${min}$.` },
      { math: md`f(x, y) = (x - ${x0})^2 + (y - ${y0})^2 - ${x0 * x0 + y0 * y0}`, note: md`Completing the squares shows $f$ is the squared distance to $(${x0}, ${y0})$ minus a constant. So the interior point is the minimum, and the maximum is at the corner farthest from it.` },
      { math: md`f(0, 0) = ${vals[0]}, \quad f(${W}, 0) = ${vals[1]}, \quad f(0, ${H}) = ${vals[2]}, \quad f(${W}, ${H}) = ${vals[3]}`, note: md`The boundary consists of four segments; on each, $f$ is a parabola in one variable opening up, so its largest value on a segment is at an endpoint. Check the corners.` },
      { math: wantMax ? md`\max f = ${max} \text{ at } (${far[0]}, ${far[1]})` : md`\min f = ${min} \text{ at } (${x0}, ${y0})`, note: "" },
    ];
    return {
      prompt: md`Find the absolute ${wantMax ? "maximum" : "minimum"} value of $f(x, y) = ${tex(f)}$ on the rectangle $0 \le x \le ${W}$, $0 \le y \le ${H}$.`,
      answer: String(wantMax ? max : min),
      hint: "Candidates: critical points inside the region, and the extremes of f along each edge (which here land at the corners). Compare values.",
      solution: steps,
    };
  }
  const a = r.coef(-5, 5);
  const b = r.coef(-5, 5);
  const c = r.int(-4, 4);
  const W = r.int(1, 4);
  const H = r.int(1, 4);
  const f: Term[] = [[a, 1, 0], [b, 0, 1], [c, 0, 0]];
  const verts: [number, number][] = [[0, 0], [W, 0], [0, H]];
  const vals = verts.map(([x, y]) => ev(f, x, y));
  const wantMax = r.next() < 0.5;
  const value = wantMax ? Math.max(...vals) : Math.min(...vals);
  const at = verts[vals.indexOf(value)]!;
  return {
    prompt: md`Find the absolute ${wantMax ? "maximum" : "minimum"} value of $f(x, y) = ${tex(f)}$ on the triangle with vertices $(0, 0)$, $(${W}, 0)$ and $(0, ${H})$ (including its edges).`,
    answer: String(value),
    hint: "A linear function has no critical points, and along each edge it is linear in one variable. Where does a linear function on a segment take its extremes?",
    solution: [
      { math: md`\nabla f = \langle ${a}, ${b} \rangle \ne \mathbf{0}`, note: "No critical points inside: the extremes are on the boundary." },
      { math: md`f(0, 0) = ${vals[0]}, \quad f(${W}, 0) = ${vals[1]}, \quad f(0, ${H}) = ${vals[2]}`, note: "On each edge f is linear in one variable, so its extremes on the edge are at the endpoints: the vertices." },
      { math: (wantMax ? "\\max" : "\\min") + md` f = ${value} \text{ at } (${at[0]}, ${at[1]})`, note: "" },
    ],
  };
};

// ── Lesson 8: Lagrange multipliers ──────────────────────────────────────────

const lagrangeOnCircle: Generator = (r) => {
  const [A, B, n] = r.pick(PYTHAG);
  const k = r.int(1, 3);
  const R2 = n * n * k * k;
  const wantMax = r.next() < 0.5;
  const sgn = wantMax ? 1 : -1;
  const f = tex([[A, 1, 0], [B, 0, 1]]);
  return {
    prompt: md`Find the point on the circle $x^2 + y^2 = ${R2}$ where $f(x, y) = ${f}$ is ${wantMax ? "largest" : "smallest"}. Answer as $(x, y)$.`,
    answer: `(${sgn * k * A}, ${sgn * k * B})`,
    form: "tuple",
    verify: [`a^2 + b^2 = ${R2}`, `${A} * b = ${B} * a`],
    hint: md`Lagrange: $\nabla f = \lambda \nabla g$ with $g = x^2 + y^2$. That gives $${A} = 2\lambda x$ and $${B} = 2\lambda y$; use them to write $x$ and $y$ in terms of $\lambda$, then use the constraint.`,
    solution: [
      { math: md`\langle ${A}, ${B} \rangle = \lambda \langle 2x, 2y \rangle`, note: md`$\nabla f = \lambda \nabla g$.` },
      { math: md`x = \frac{${A}}{2\lambda}, \quad y = \frac{${B}}{2\lambda}`, note: md`$\lambda \ne 0$, since $\nabla f \ne \mathbf{0}$.` },
      { math: md`\frac{${A * A} + ${B * B}}{4\lambda^2} = ${R2} \implies \lambda = \pm ${fracTex(1, 2 * k)}`, note: md`$\frac{${n * n}}{4\lambda^2} = ${R2}$, so $\lambda^2 = ${fracTex(1, 4 * k * k)}$.` },
      { math: md`(x, y) = \pm(${k * A}, ${k * B})`, note: md`$f(${k * A}, ${k * B}) = ${k * n * n}$ and $f(${-k * A}, ${-k * B}) = ${-k * n * n}$. The circle is closed and bounded, so these two candidates are the max and the min.` },
      { math: md`(${sgn * k * A}, ${sgn * k * B})`, note: md`The ${wantMax ? "largest" : "smallest"} value, $${sgn * k * n * n}$, happens here. Note $\nabla f = \langle ${A}, ${B} \rangle$ is along the radius there: the level line of $f$ is tangent to the circle.` },
    ],
  };
};

const lagrangeExtremeValue: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const k = r.int(1, 4);
    const wantMax = r.next() < 0.5;
    return {
      prompt: md`Find the ${wantMax ? "maximum" : "minimum"} value of $f(x, y) = xy$ on the circle $x^2 + y^2 = ${2 * k * k}$.`,
      answer: String(wantMax ? k * k : -k * k),
      hint: md`$\nabla f = \langle y, x \rangle$ and $\nabla g = \langle 2x, 2y \rangle$. Compare the two equations $y = 2\lambda x$ and $x = 2\lambda y$.`,
      solution: [
        { math: md`y = 2\lambda x, \quad x = 2\lambda y, \quad x^2 + y^2 = ${2 * k * k}`, note: "The Lagrange system." },
        { math: md`x = 4\lambda^2 x \implies x = 0 \text{ or } \lambda = \pm\tfrac12`, note: md`Substitute the first equation into the second. $x = 0$ forces $y = 0$, which isn't on the circle.` },
        { math: md`y = \pm x, \quad 2x^2 = ${2 * k * k} \implies x = \pm ${k}`, note: md`$\lambda = \frac12$ gives $y = x$; $\lambda = -\frac12$ gives $y = -x$.` },
        { math: md`f(\pm ${k}, \pm ${k}) = ${k * k}, \quad f(\pm ${k}, \mp ${k}) = ${-k * k}`, note: md`So the maximum is $${k * k}$ and the minimum is $${-k * k}$.` },
      ],
    };
  }
  if (kind === 1) {
    let a = r.int(1, 5);
    let b = r.int(1, 5);
    while (a === b) b = r.int(1, 5);
    const wantMax = r.next() < 0.5;
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    return {
      prompt: md`Find the ${wantMax ? "maximum" : "minimum"} value of $f(x, y) = x^2 + y^2$ on the ellipse $${b * b === 1 ? "" : b * b}x^2 + ${a * a === 1 ? "" : a * a}y^2 = ${a * a * b * b}$.`,
      answer: String(wantMax ? big * big : small * small),
      hint: md`$\nabla f = \lambda \nabla g$ reads $2x = ${2 * b * b}\lambda x$ and $2y = ${2 * a * a}\lambda y$. Don't divide by $x$ or $y$: each equation is "this variable is 0, or $\lambda$ is a particular number".`,
      solution: [
        { math: md`2x = ${2 * b * b}\lambda x, \quad 2y = ${2 * a * a}\lambda y`, note: "" },
        { math: md`x = 0 \text{ or } \lambda = ${fracTex(1, b * b)}; \qquad y = 0 \text{ or } \lambda = ${fracTex(1, a * a)}`, note: md`Both $\lambda$ values can't hold at once since $${a} \ne ${b}$, so $x = 0$ or $y = 0$.` },
        { math: md`x = 0 \implies y = \pm ${b}, \quad f = ${b * b}; \qquad y = 0 \implies x = \pm ${a}, \quad f = ${a * a}`, note: "From the constraint." },
        { math: md`\max f = ${big * big}, \quad \min f = ${small * small}`, note: md`$f$ is the squared distance from the origin: the farthest points are the ends of the long axis, the closest are the ends of the short one.` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(1, 5);
    const wantMax = r.next() < 0.5;
    return {
      prompt: md`Find the ${wantMax ? "maximum" : "minimum"} value of $f(x, y) = x + y$ on the circle $x^2 + y^2 = ${2 * k * k}$.`,
      answer: String(wantMax ? 2 * k : -2 * k),
      hint: md`$\langle 1, 1 \rangle = \lambda \langle 2x, 2y \rangle$ forces $x = y$.`,
      solution: [
        { math: md`1 = 2\lambda x, \quad 1 = 2\lambda y \implies x = y`, note: md`Both equal $\frac{1}{2\lambda}$.` },
        { math: md`2x^2 = ${2 * k * k} \implies x = \pm ${k}`, note: "Constraint." },
        { math: md`f(${k}, ${k}) = ${2 * k}, \quad f(${-k}, ${-k}) = ${-2 * k}`, note: md`Maximum $${2 * k}$, minimum $${-2 * k}$.` },
      ],
    };
  }
  const m = r.int(2, 8);
  return {
    prompt: md`Find the maximum value of $f(x, y) = xy$ subject to $x + y = ${2 * m}$.`,
    answer: String(m * m),
    hint: md`$\langle y, x \rangle = \lambda \langle 1, 1 \rangle$ gives $x = y$.`,
    solution: [
      { math: md`y = \lambda, \quad x = \lambda \implies x = y`, note: "" },
      { math: md`2x = ${2 * m} \implies x = y = ${m}`, note: "Constraint." },
      { math: md`f(${m}, ${m}) = ${m * m}`, note: md`A maximum, not a minimum: along the line, $xy = x(${2 * m} - x)$ is a downward parabola.` },
    ],
  };
};

const lagrangeApplied: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [A, B, n] = r.pick(PYTHAG.filter(([a, b]) => a > 0 && b > 0));
    const k = r.int(1, 3);
    const C = n * n * k;
    return {
      prompt: md`Find the point on the line $${A}x + ${B}y = ${C}$ that is closest to the origin. Answer as $(x, y)$.`,
      answer: `(${A * k}, ${B * k})`,
      form: "tuple",
      verify: [`${A} a + ${B} b = ${C}`, `${B} a - ${A} b = 0`],
      hint: md`Minimize $x^2 + y^2$ (the squared distance) with constraint $g = ${A}x + ${B}y = ${C}$.`,
      solution: [
        { math: md`\langle 2x, 2y \rangle = \lambda \langle ${A}, ${B} \rangle`, note: md`$\nabla f = \lambda \nabla g$ with $f = x^2 + y^2$.` },
        { math: md`x = \frac{${A}\lambda}{2}, \quad y = \frac{${B}\lambda}{2}`, note: md`So $(x, y)$ is a multiple of $\langle ${A}, ${B} \rangle$: the closest point is where the perpendicular from the origin meets the line.` },
        { math: md`${A} \cdot \frac{${A}\lambda}{2} + ${B} \cdot \frac{${B}\lambda}{2} = ${C} \implies \lambda = ${2 * k}`, note: md`$\frac{${n * n}\lambda}{2} = ${C}$.` },
        { math: md`(x, y) = (${A * k}, ${B * k})`, note: md`Distance $\sqrt{${A * A * k * k} + ${B * B * k * k}} = ${n * k}$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(2, 9);
    return {
      prompt: md`A rectangle has perimeter $${4 * k}$. Use Lagrange multipliers to find the side lengths $(x, y)$ that make its area largest.`,
      answer: `(${k}, ${k})`,
      form: "tuple",
      verify: [`2a + 2b = ${4 * k}`, `a - b = 0`],
      hint: md`Maximize $A = xy$ subject to $2x + 2y = ${4 * k}$.`,
      solution: [
        { math: md`\langle y, x \rangle = \lambda \langle 2, 2 \rangle`, note: md`$\nabla(xy) = \lambda \nabla(2x + 2y)$.` },
        { math: md`y = 2\lambda = x`, note: "Both components give the same thing: the sides are equal." },
        { math: md`4x = ${4 * k} \implies x = y = ${k}`, note: md`A square. Area $${k * k}$, the most any rectangle of this perimeter can enclose.` },
      ],
    };
  }
  const m = r.int(1, 4);
  const S = 3 * m;
  return {
    prompt: md`Two positive numbers $x$ and $y$ have $x + y = ${S}$. Find the pair $(x, y)$ that makes $x^2 y$ as large as possible.`,
    answer: `(${2 * m}, ${m})`,
    form: "tuple",
    verify: [`a + b = ${S}`, `a - 2b = 0`],
    hint: md`$\nabla(x^2 y) = \langle 2xy, x^2 \rangle$ must be parallel to $\nabla(x + y) = \langle 1, 1 \rangle$.`,
    solution: [
      { math: md`2xy = \lambda, \quad x^2 = \lambda`, note: "" },
      { math: md`x^2 = 2xy \implies x = 2y`, note: md`$x > 0$, so dividing by $x$ is allowed.` },
      { math: md`3y = ${S} \implies y = ${m}, \quad x = ${2 * m}`, note: md`$x^2 y = ${4 * m * m * m}$. The endpoints $x \to 0$ or $y \to 0$ give $0$, so this is the maximum.` },
    ],
  };
};

// ── The unit ────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "Partial Derivatives",
  lessons: [
    {
      id: slug("Functions of several variables"),
      title: "Functions of several variables",
      summary: "A function of two variables takes a point and returns a number. Its graph is a surface; its level curves are a contour map. Domains, graphs and how to read a contour map.",
      blocks: [
        {
          kind: "text",
          body: md`The temperature at a spot on a map depends on two numbers, the east-west position and the north-south position. The volume of a box depends on three. Most quantities in the world depend on more than one input, and this unit extends calculus to them.

A **function of two variables** $f$ assigns to each point $(x, y)$ in some set $D$ a single real number $f(x, y)$. The set $D$ is the **domain**. For example $f(x, y) = x^2 + y^2$ assigns to $(3, -1)$ the number $9 + 1 = 10$. Evaluating is nothing new: substitute each variable, with parentheses, and compute.

When a formula is given without a domain, the domain is every point where the formula makes sense. For $f(x, y) = \sqrt{9 - x^2 - y^2}$ we need $9 - x^2 - y^2 \ge 0$, so the domain is the disk $x^2 + y^2 \le 9$. For $\ln(x + y)$ we need $x + y > 0$, a half-plane. For $\frac{1}{x - y}$, everything except the line $y = x$.`,
        },
        {
          kind: "key",
          title: "Function of two variables",
          body: md`$f(x, y)$ gives one number for each point $(x, y)$ of its domain $D \subseteq \mathbb{R}^2$. Its **graph** is the set of points $(x, y, f(x, y))$ in space: a **surface** $z = f(x, y)$ sitting over $D$. Each vertical line above a point of $D$ meets the surface exactly once, because $f$ has one value there.`,
        },
        {
          kind: "why",
          title: "Why the graph needs three dimensions",
          body: md`The graph of a function records inputs and outputs together. One input and one output took two axes, so the graph of $y = g(x)$ is a curve in the plane. Two inputs and one output need three axes: $x$ and $y$ for the input point, $z$ for the value. The result is a surface over the domain.

This also says why we stop drawing at two variables. A function $f(x, y, z)$ of three variables would need four axes for its graph. We can still study it, but we picture it in other ways, which come below.`,
        },
        {
          kind: "surface",
          x: [-2, 2],
          y: [-2, 2],
          expr: "x^2 + y^2",
          caption: md`The graph of $f(x, y) = x^2 + y^2$, a **paraboloid**. Turn it. Every vertical slice through the $z$-axis is a parabola, and every horizontal slice is a circle.`,
        },
        {
          kind: "text",
          body: md`A surface is hard to draw by hand, so we borrow the mapmaker's trick. A **level curve** of $f$ is the set of points where $f$ takes one fixed value $k$:

$$f(x, y) = k.$$

It is the shadow on the $xy$-plane of the horizontal slice $z = k$ through the surface. Drawing level curves for several equally spaced values of $k$ gives a **contour map**. Where the curves are close together the surface is steep; where they are far apart it is nearly flat. Slide the point below and watch the value of $f$.`,
        },
        {
          kind: "contour",
          x: [-3, 3],
          y: [-3, 3],
          expr: "x^2 + y^2",
          levels: [1, 2, 3, 4, 5, 6, 7, 8],
          points: [{ x: "a", y: "b", label: "f = {=a^2 + b^2}", color: 2 }],
          params: [
            { name: "a", tex: "x", min: -2.5, max: 2.5, step: 0.1, value: 1.5 },
            { name: "b", tex: "y", min: -2.5, max: 2.5, step: 0.1, value: 1 },
          ],
          caption: md`Level curves of $x^2 + y^2$ at $k = 1, 2, \ldots, 8$. Each is a circle of radius $\sqrt{k}$. They bunch up as you move out, because the paraboloid gets steeper.`,
        },
        {
          kind: "why",
          title: "Why the circles bunch up",
          body: md`The level curve $x^2 + y^2 = k$ is a circle of radius $\sqrt{k}$. Going from height $k = 1$ to $k = 2$ moves you from radius $1$ to radius $\sqrt{2} \approx 1.41$, a step of $0.41$. Going from $k = 7$ to $k = 8$ moves you from $\sqrt 7 \approx 2.65$ to $\sqrt 8 \approx 2.83$, a step of only $0.18$. The same rise in height is gained over less ground, which is exactly what "steeper" means. Contour spacing measures slope: equal heights, unequal distances.`,
        },
        {
          kind: "example",
          title: "Level curves of a saddle",
          problem: md`Describe the level curves of $f(x, y) = x^2 - y^2$.`,
          steps: [
            { math: md`x^2 - y^2 = k`, note: "Set the function equal to a constant." },
            { math: md`k > 0: \quad \frac{x^2}{k} - \frac{y^2}{k} = 1`, note: md`A hyperbola opening left and right, crossing the $x$-axis at $\pm\sqrt{k}$.` },
            { math: md`k < 0: \quad \frac{y^2}{-k} - \frac{x^2}{-k} = 1`, note: md`A hyperbola opening up and down.` },
            { math: md`k = 0: \quad (x - y)(x + y) = 0`, note: md`The two lines $y = x$ and $y = -x$. They separate the "uphill" hyperbolas from the "downhill" ones.` },
          ],
        },
        {
          kind: "surface",
          x: [-2, 2],
          y: [-2, 2],
          expr: "x^2 - y^2",
          caption: md`The graph of $x^2 - y^2$: a **saddle**. Along the $x$-axis it curves up; along the $y$-axis it curves down. The origin is the lowest point of one slice and the highest point of the other.`,
        },
        {
          kind: "contour",
          x: [-3, 3],
          y: [-3, 3],
          expr: "x^2 - y^2",
          levels: [-6, -4, -2, 0, 2, 4, 6],
          caption: md`The contour map of the saddle. Hyperbolas, with the two crossing lines at level $0$. Compare with the surface above: positive levels sit over the $x$-axis, negative levels over the $y$-axis.`,
        },
        {
          kind: "key",
          title: "Reading a contour map",
          body: md`- A level curve $f(x, y) = k$ is where the surface has height $k$.
- Close contours mean a steep surface; wide spacing means nearly flat.
- Circles around a point: a peak or a pit. Hyperbolas crossing at a point: a saddle.
- Parallel straight lines: a plane, or any surface shaped like $f(x, y) = g(ax + by)$.`,
        },
        {
          kind: "check",
          prompt: md`At which level $k$ does the level curve of $f(x, y) = x^2 + y^2$ pass through the point $(2, -3)$?`,
          answer: "13",
          explain: md`The level curve through a point has $k$ equal to the value of $f$ there: $k = 2^2 + (-3)^2 = 13$. The circle $x^2 + y^2 = 13$ passes through $(2, -3)$.`,
        },
        {
          kind: "text",
          body: md`Everything here extends to **three variables**. $f(x, y, z)$ assigns a number to each point in a region of space; we can't draw its graph, but we can draw its **level surfaces** $f(x, y, z) = k$. For $f = x^2 + y^2 + z^2$ they are spheres of radius $\sqrt{k}$. For $f = x^2 + y^2 - z$ they are paraboloids, one for each $k$: the level surfaces of a three-variable function are a stack of surfaces, as the level curves of a two-variable function are a stack of curves.`,
        },
      ],
      practice: [evaluateFunction, levelCurves, describeFunction],
    },
    {
      id: slug("Limits and continuity"),
      title: "Limits and continuity",
      summary: "A limit in two variables must give the same value along every path to the point. Two paths that disagree kill a limit; a squeeze proves one exists. Continuity and why substitution works.",
      blocks: [
        {
          kind: "text",
          body: md`In Calculus 1, $\lim_{x \to a} g(x) = L$ meant: the values $g(x)$ get as close to $L$ as you like once $x$ is close enough to $a$. On a line there are only two ways to approach $a$, from the left and from the right.

In the plane there are infinitely many ways to approach a point $(a, b)$: along either axis, along any line, along a spiral, along a parabola. The definition of a limit doesn't care which. It only asks about distance:

$$\lim_{(x, y) \to (a, b)} f(x, y) = L$$

means that $|f(x, y) - L|$ can be made as small as we like by taking the distance $\sqrt{(x - a)^2 + (y - b)^2}$ small enough, in any direction at all.`,
        },
        {
          kind: "key",
          title: "Limits in two variables",
          body: md`$\lim_{(x, y) \to (a, b)} f(x, y) = L$ means: for every $\varepsilon > 0$ there is a $\delta > 0$ such that $|f(x, y) - L| < \varepsilon$ whenever $0 < \sqrt{(x - a)^2 + (y - b)^2} < \delta$.

**The two-path test.** If $f$ tends to different values along two different paths into $(a, b)$, the limit does not exist.`,
        },
        {
          kind: "why",
          title: "Why two disagreeing paths settle it, but two agreeing paths prove nothing",
          body: md`Suppose the limit is $L$. Every point close enough to $(a, b)$ has $f$ within $\varepsilon$ of $L$, whatever direction it lies in. A path into $(a, b)$ eventually stays inside that small disk, so along the path $f$ must also approach $L$. Two paths with different limits would need two different values of $L$ at once. Impossible, so there is no limit.

The reverse fails. Agreeing along the two axes, or along every straight line, says nothing about the parabolas and spirals you haven't checked. To prove a limit exists you need an argument that covers every approach at once. The usual one is a squeeze on $|f - L|$ by something that depends only on the distance to the point.`,
        },
        {
          kind: "example",
          title: "A limit that doesn't exist",
          problem: md`Does $\displaystyle\lim_{(x, y) \to (0, 0)} \frac{2xy}{x^2 + y^2}$ exist?`,
          steps: [
            { math: md`\text{along } y = 0: \quad f(x, 0) = \frac{0}{x^2} = 0`, note: "Approach along the x-axis. The values are all 0." },
            { math: md`\text{along } y = x: \quad f(x, x) = \frac{2x^2}{2x^2} = 1`, note: "Approach along the diagonal. The values are all 1." },
            { math: md`0 \ne 1`, note: "Two paths, two answers. The limit does not exist." },
          ],
        },
        {
          kind: "surface",
          x: [-1, 1],
          y: [-1, 1],
          z: [-1.2, 1.2],
          expr: "2x y/(x^2 + y^2)",
          caption: md`The graph of $\frac{2xy}{x^2 + y^2}$. The surface is torn at the origin: it stands at height $1$ above the diagonal $y = x$, at $-1$ above $y = -x$, and at $0$ above the axes. No single height fits.`,
        },
        {
          kind: "contour",
          x: [-1, 1],
          y: [-1, 1],
          expr: "2x y/(x^2 + y^2)",
          levels: [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9],
          caption: md`Its contour map. Every level curve is a pair of straight lines through the origin. All heights from $-1$ to $1$ meet at one point, so the function cannot be made continuous there.`,
        },
        {
          kind: "plot",
          x: [-2, 2],
          y: [-1.5, 1.5],
          curves: [
            { expr: "2m x^2/(x^2 + m^2 x^2)", label: "\\tfrac{2xy}{x^2 + y^2} \\text{ along } y = mx", color: 1 },
            { expr: "m x^3/(x^2 + m^2 x^2)", label: "\\tfrac{x^2 y}{x^2 + y^2} \\text{ along } y = mx", color: 3 },
          ],
          params: [{ name: "m", tex: "m", min: -3, max: 3, step: 0.1, value: 1 }],
          caption: md`Riding into the origin along the line $y = mx$, plotted against $x$. The blue function sits at the constant height $\frac{2m}{1 + m^2}$, which changes as you slide $m$: no limit. The green function $\frac{x^2 y}{x^2 + y^2}$ heads to $0$ for every $m$.`,
        },
        {
          kind: "proof",
          title: "The two-path test in action",
          given: md`$f(x, y) = \dfrac{2xy}{x^2 + y^2}$ for $(x, y) \ne (0, 0)$`,
          prove: md`$\displaystyle\lim_{(x, y) \to (0, 0)} f(x, y)$ does not exist`,
          steps: [
            { statement: md`Suppose the limit exists and equals $L$.`, reason: "Assume the opposite, to reach a contradiction." },
            { statement: md`Along the path $(x, 0)$ with $x \to 0$, $f(x, 0) = 0$, so $L = 0$.`, reason: "A limit must agree with the limit along any path into the point." },
            { statement: md`Along the path $(x, x)$ with $x \to 0$, $f(x, x) = 1$, so $L = 1$.`, reason: "Same reason, second path." },
            { statement: md`$0 = L = 1$, a contradiction. So no such $L$ exists.`, reason: "A number can't equal both." },
          ],
        },
        {
          kind: "text",
          body: md`When a limit does exist, finding it is usually easy. The limit laws from Calculus 1 (sum, product, quotient with nonzero denominator) hold word for word, because their proofs only use the definition's shape, "close input gives close output". Together with the facts $\lim x = a$ and $\lim y = b$, they show that every polynomial in $x$ and $y$ has a limit at every point, equal to its value there. The same holds for rational functions wherever the denominator isn't zero, and for compositions with continuous one-variable functions like $\sqrt{\ }$, $e^x$, $\sin$. Such functions are **continuous**, and for them "find the limit" means "substitute".`,
        },
        {
          kind: "why",
          title: "Why polynomials are continuous",
          body: md`Start with the two simplest functions, $f(x, y) = x$ and $g(x, y) = y$. If $(x, y)$ is within distance $\delta$ of $(a, b)$ then $|x - a| \le \sqrt{(x - a)^2 + (y - b)^2} < \delta$: a leg of a right triangle is shorter than its hypotenuse. So $x \to a$ and $y \to b$: both coordinate functions are continuous.

A polynomial is built from $x$, $y$ and constants by adding and multiplying finitely many times. The sum and product laws say each step preserves continuity. So the whole polynomial is continuous, and its limit at any point is its value there. The same reasoning covers $\frac{p}{q}$ wherever $q \ne 0$.`,
        },
        {
          kind: "example",
          title: "A 0/0 that simplifies",
          problem: md`Find $\displaystyle\lim_{(x, y) \to (2, 2)} \frac{x^2 - y^2}{x - y}$.`,
          steps: [
            { math: md`\frac{x^2 - y^2}{x - y} = \frac{(x - y)(x + y)}{x - y} = x + y`, note: md`Valid wherever $x \ne y$, which is everywhere the original is defined. Near $(2, 2)$ but off the line $y = x$, the two expressions agree.` },
            { math: md`\lim_{(x, y) \to (2, 2)} (x + y) = 4`, note: "A polynomial: substitute." },
          ],
        },
        {
          kind: "proof",
          title: "A limit that does exist, by squeezing",
          given: md`$f(x, y) = \dfrac{x^2 y}{x^2 + y^2}$ for $(x, y) \ne (0, 0)$`,
          prove: md`$\displaystyle\lim_{(x, y) \to (0, 0)} f(x, y) = 0$`,
          steps: [
            { statement: md`$0 \le \dfrac{x^2}{x^2 + y^2} \le 1$ for every $(x, y) \ne (0, 0)$.`, reason: md`$x^2 \le x^2 + y^2$ since $y^2 \ge 0$.` },
            { statement: md`$|f(x, y)| = \dfrac{x^2}{x^2 + y^2} \cdot |y| \le |y|$.`, reason: "Multiply the inequality by |y|." },
            { statement: md`$|y| \le \sqrt{x^2 + y^2}$, the distance to the origin.`, reason: "A leg is at most the hypotenuse." },
            { statement: md`So $|f(x, y) - 0| \le \sqrt{x^2 + y^2}$, which is less than $\varepsilon$ whenever the distance is less than $\delta = \varepsilon$.`, reason: "This is the definition of the limit being 0, and it holds in every direction at once." },
          ],
        },
        {
          kind: "key",
          title: "Continuity",
          body: md`$f$ is **continuous** at $(a, b)$ when $\lim_{(x, y) \to (a, b)} f(x, y) = f(a, b)$: the limit exists and equals the value. Polynomials, rational functions off their zero denominators, and compositions of continuous functions are continuous. For a continuous function, limits are found by substitution.

A function like $\frac{2xy}{x^2 + y^2}$ can't be made continuous at the origin by choosing a value there, because it has no limit there.`,
        },
        {
          kind: "check",
          prompt: md`Along the line $y = 3x$, the function $\dfrac{2xy}{x^2 + y^2}$ is constant. What is that constant? Give an exact fraction.`,
          answer: "3/5",
          explain: md`Substitute $y = 3x$: $\frac{2x \cdot 3x}{x^2 + 9x^2} = \frac{6x^2}{10x^2} = \frac{3}{5}$. Along the $x$-axis the value is $0$, so this function has no limit at the origin.`,
        },
      ],
      practice: [limitBySubstitution, limitZeroOverZero, limitAlongPaths],
    },
    {
      id: slug("Partial derivatives"),
      title: "Partial derivatives",
      summary: "Freeze one variable and differentiate with respect to the other. The slice picture, notation, every Calculus 1 rule reused, higher-order partials and Clairaut's theorem.",
      blocks: [
        {
          kind: "text",
          body: md`How fast does $f(x, y)$ change? The question is incomplete: change in which direction? The simplest answers come from moving parallel to one axis.

Fix $y$ at some value $b$. Then $g(x) = f(x, b)$ is an ordinary function of one variable, and its derivative at $x = a$ is a number we already know how to compute. That number is the **partial derivative of $f$ with respect to $x$** at $(a, b)$:

$$f_x(a, b) = \lim_{h \to 0} \frac{f(a + h, b) - f(a, b)}{h}.$$

Freezing $x = a$ instead and letting $y$ move gives $f_y(a, b)$. Letting the point vary gives the functions $f_x(x, y)$ and $f_y(x, y)$.`,
        },
        {
          kind: "key",
          title: "Partial derivatives",
          body: md`$$f_x = \frac{\partial f}{\partial x} = \lim_{h \to 0} \frac{f(x + h, y) - f(x, y)}{h}, \qquad f_y = \frac{\partial f}{\partial y} = \lim_{h \to 0} \frac{f(x, y + h) - f(x, y)}{h}.$$

To compute $f_x$, treat $y$ as a constant and differentiate in $x$ with the usual rules. To compute $f_y$, treat $x$ as a constant. The curly $\partial$ is a reminder that other variables are being held still.`,
        },
        {
          kind: "why",
          title: "Why this is a slope on the surface",
          body: md`Holding $y = b$ fixed picks out the vertical plane $y = b$ in space. That plane cuts the surface $z = f(x, y)$ in a curve, the graph of $z = f(x, b)$ drawn in the plane. The partial derivative $f_x(a, b)$ is the slope of that curve at $x = a$: the slope of the surface as you walk across it parallel to the $x$-axis.

$f_y(a, b)$ is the slope of the other slice, cut by the plane $x = a$. Two slices, two slopes. Lesson 4 fits a plane to them; Lesson 6 finds the slope in every other direction from these two.`,
        },
        {
          kind: "plot",
          x: [-2.5, 2.5],
          y: [-3, 5],
          curves: [
            { expr: "4 - b^2 - x^2", label: "z = f(x, b) = 4 - x^2 - b^2", color: 1 },
            { expr: "4 - b^2 - a^2 - 2a(x - a)", label: "\\text{slope } f_x(a, b) = {=-2a}", color: 2, dashed: true },
          ],
          points: [{ x: "a", y: "4 - a^2 - b^2", label: "(a, f(a, b))", color: 2 }],
          params: [
            { name: "a", tex: "a", min: -2, max: 2, step: 0.1, value: 1 },
            { name: "b", tex: "b", min: -1.5, max: 1.5, step: 0.1, value: 0.5 },
          ],
          caption: md`The slice $y = b$ of the surface $z = 4 - x^2 - y^2$, seen from the side, with its tangent line at $x = a$. Slide $b$: the slice moves up and down, but its slope at any $x$ is still $-2x$, because $y$ played no part in the differentiation. Slide $a$ to see $f_x = -2a$ change.`,
        },
        {
          kind: "example",
          title: "Partials of a polynomial",
          problem: md`Find $f_x$ and $f_y$ for $f(x, y) = x^3 y^2 + 2x - y$.`,
          steps: [
            { math: md`f_x = 3x^2 y^2 + 2`, note: md`$y^2$ is a constant factor on the first term; $-y$ is a constant and differentiates to $0$.` },
            { math: md`f_y = 2x^3 y - 1`, note: md`Now $x^3$ is the constant factor; $2x$ differentiates to $0$.` },
            { math: md`f_x(1, 2) = 14, \quad f_y(1, 2) = 3`, note: "At the point (1, 2) the surface climbs 14 per unit step in x and 3 per unit step in y." },
          ],
        },
        {
          kind: "text",
          body: md`Nothing new is needed for the computation. Product, quotient and chain rules all apply, with the frozen variable riding along as a constant. The only new skill is keeping track of which letter is the variable right now.`,
        },
        {
          kind: "example",
          title: "Product and chain rules inside a partial",
          problem: md`Find $f_x$ and $f_y$ for $f(x, y) = x e^{xy}$.`,
          steps: [
            { math: md`f_x = 1 \cdot e^{xy} + x \cdot \frac{\partial}{\partial x} e^{xy}`, note: md`Product rule in $x$: both factors contain $x$.` },
            { math: md`\frac{\partial}{\partial x} e^{xy} = e^{xy} \cdot y`, note: md`Chain rule: the inside $xy$ has $x$-derivative $y$.` },
            { math: md`f_x = e^{xy} + xy\,e^{xy} = e^{xy}(1 + xy)`, note: "" },
            { math: md`f_y = x \cdot e^{xy} \cdot x = x^2 e^{xy}`, note: md`In $y$, the leading $x$ is a constant; only the exponential moves, and the inside has $y$-derivative $x$.` },
          ],
        },
        {
          kind: "key",
          title: "Higher-order partials",
          body: md`Partial derivatives are functions, so they can be differentiated again:

$$f_{xx} = \frac{\partial^2 f}{\partial x^2}, \qquad f_{yy} = \frac{\partial^2 f}{\partial y^2}, \qquad f_{xy} = (f_x)_y = \frac{\partial^2 f}{\partial y\,\partial x}, \qquad f_{yx} = (f_y)_x = \frac{\partial^2 f}{\partial x\,\partial y}.$$

Subscripts are read left to right: $f_{xy}$ differentiates in $x$ first. In the $\partial$ notation the order is read right to left, nearest the $f$ first. The two notations agree; they just write the same order differently.`,
        },
        {
          kind: "text",
          body: md`**Clairaut's theorem.** If $f_{xy}$ and $f_{yx}$ are both continuous near a point, they are equal there. For every function in this course, the mixed partials agree, so the order never matters. We state it rather than prove it in full, but the reason is visible.`,
        },
        {
          kind: "why",
          title: "Why the mixed partials agree",
          body: md`Look at the four values of $f$ at the corners of a small rectangle with sides $h$ and $k$, and form the combination

$$Q = \frac{f(a + h, b + k) - f(a + h, b) - f(a, b + k) + f(a, b)}{hk}.$$

Group it one way: the numerator is $[f(a + h, b + k) - f(a + h, b)] - [f(a, b + k) - f(a, b)]$, a difference in $y$ taken at two $x$-values, then differenced in $x$. Letting $k \to 0$ and then $h \to 0$ gives $f_{yx}(a, b)$.

Group it the other way: $[f(a + h, b + k) - f(a, b + k)] - [f(a + h, b) - f(a, b)]$, a difference in $x$ at two $y$-values, then differenced in $y$. Letting $h \to 0$ and then $k \to 0$ gives $f_{xy}(a, b)$.

It is the same four numbers either way. Continuity of the second partials is what lets us swap the order of the two limits, and that is the whole content of the theorem.`,
        },
        {
          kind: "example",
          title: "Checking Clairaut",
          problem: md`Compute $f_{xy}$ and $f_{yx}$ for $f(x, y) = x^3 y^2 - e^x y$.`,
          steps: [
            { math: md`f_x = 3x^2 y^2 - e^x y, \qquad f_{xy} = 6x^2 y - e^x`, note: md`$x$ first, then $y$.` },
            { math: md`f_y = 2x^3 y - e^x, \qquad f_{yx} = 6x^2 y - e^x`, note: md`$y$ first, then $x$. The same.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $f_y$ for $f(x, y) = x^2 y + y^3$.`,
          answer: "x^2 + 3y^2",
          explain: md`Treat $x^2$ as a constant: $\frac{\partial}{\partial y}(x^2 y) = x^2$, and $\frac{\partial}{\partial y}(y^3) = 3y^2$.`,
        },
        {
          kind: "text",
          body: md`With three or more variables nothing changes: $f_z$ freezes $x$ and $y$ and differentiates in $z$. Partial derivatives are the language of the physical sciences because so many laws say how a quantity changes in one direction while the others are held still. The heat equation $u_t = k\,u_{xx}$ and the wave equation $u_{tt} = c^2 u_{xx}$ are statements about partial derivatives, and we now have what's needed to read them.`,
        },
      ],
      practice: [firstPartialsPolynomial, firstPartialsRules, secondPartials],
    },
    {
      id: slug("Tangent planes"),
      title: "Tangent planes",
      summary: "Two tangent lines through a point determine a plane; it is the best flat approximation to the surface. The tangent plane equation, linear approximation, differentials and what differentiable means.",
      blocks: [
        {
          kind: "text",
          body: md`In one variable, the tangent line at $x = a$ is the line through $(a, g(a))$ with slope $g'(a)$, and it is the best straight-line stand-in for the curve near $a$. A surface has two slopes at a point, $f_x$ and $f_y$, each belonging to a tangent line of one slice. Those two lines lie in a single plane through the point, and that plane is the **tangent plane**.`,
        },
        {
          kind: "why",
          title: "Why the two slopes determine the plane",
          body: md`Any non-vertical plane through the point $P = (a, b, f(a, b))$ can be written

$$z - f(a, b) = A(x - a) + B(y - b)$$

for some numbers $A$ and $B$. Cut this plane with the vertical plane $y = b$: the second term vanishes and we get the line $z - f(a, b) = A(x - a)$ with slope $A$. For the plane to contain the tangent line of the slice $y = b$, that slope must be $f_x(a, b)$. So $A = f_x(a, b)$.

Cut it with $x = a$ instead: $z - f(a, b) = B(y - b)$, slope $B$, which must be $f_y(a, b)$. Both numbers are forced, so there is exactly one plane containing both tangent lines.`,
        },
        {
          kind: "key",
          title: "Tangent plane",
          body: md`The tangent plane to $z = f(x, y)$ at the point above $(a, b)$ is

$$z = f(a, b) + f_x(a, b)\,(x - a) + f_y(a, b)\,(y - b).$$

A normal vector to the surface there is $\langle f_x(a, b), f_y(a, b), -1 \rangle$: bring everything to one side and read off the coefficients of $x$, $y$, $z$.`,
        },
        {
          kind: "example",
          title: "A tangent plane to the paraboloid",
          problem: md`Find the tangent plane to $z = x^2 + y^2$ at $(1, 2, 5)$.`,
          steps: [
            { math: md`f_x = 2x = 2, \quad f_y = 2y = 4`, note: "Partials at (1, 2)." },
            { math: md`z = 5 + 2(x - 1) + 4(y - 2)`, note: "Point and both slopes." },
            { math: md`z = 2x + 4y - 5`, note: md`Collect constants: $5 - 2 - 8 = -5$. Check: at $(1, 2)$ it gives $2 + 8 - 5 = 5$.` },
          ],
        },
        {
          kind: "surface",
          x: [-2, 2],
          y: [-2, 2],
          z: [0, 8],
          expr: "x^2 + y^2 - (2a(x - a) + 2b(y - b) + a^2 + b^2)",
          params: [
            { name: "a", tex: "a", min: -1.5, max: 1.5, step: 0.1, value: 1 },
            { name: "b", tex: "b", min: -1.5, max: 1.5, step: 0.1, value: 0.5 },
          ],
          caption: md`The **error** $f(x, y) - L(x, y)$ between $f = x^2 + y^2$ and its tangent plane $L$ at $(a, b)$. It is zero at $(a, b)$ and flat there, then grows like a bowl. Move the point: the bowl follows it. Near the point of tangency the plane and the surface are nearly the same.`,
        },
        {
          kind: "why",
          title: "Why the error is so small near the point",
          body: md`For $f = x^2 + y^2$ the error can be computed exactly. With $L = a^2 + b^2 + 2a(x - a) + 2b(y - b)$,

$$f - L = x^2 - 2ax + a^2 + y^2 - 2by + b^2 = (x - a)^2 + (y - b)^2.$$

The error is the **square** of the distance from $(a, b)$. Move $0.1$ away and the error is about $0.01$; move $0.01$ away and it is $0.0001$. It shrinks faster than the distance itself, so the ratio $\frac{\text{error}}{\text{distance}} \to 0$. A plane that is merely through the point, with the wrong slopes, has an error proportional to the distance, not its square. That is what makes the tangent plane the best one.`,
        },
        {
          kind: "key",
          title: "Linear approximation and differentials",
          body: md`Near $(a, b)$,

$$f(x, y) \approx L(x, y) = f(a, b) + f_x(a, b)\,\Delta x + f_y(a, b)\,\Delta y, \qquad \Delta x = x - a,\ \Delta y = y - b.$$

The **differential** $dz = f_x\,dx + f_y\,dy$ is the change in height along the tangent plane: the first-order estimate of the change $\Delta z$ in $f$.`,
        },
        {
          kind: "example",
          title: "Estimating with the tangent plane",
          problem: md`Estimate $\sqrt{3.1^2 + 3.9^2}$ using $f(x, y) = \sqrt{x^2 + y^2}$ at $(3, 4)$.`,
          steps: [
            { math: md`f(3, 4) = 5`, note: "A point where the exact value is easy." },
            { math: md`f_x = \frac{x}{\sqrt{x^2 + y^2}} = \frac{3}{5}, \qquad f_y = \frac{y}{\sqrt{x^2 + y^2}} = \frac{4}{5}`, note: "At (3, 4)." },
            { math: md`\Delta x = 0.1, \quad \Delta y = -0.1`, note: "" },
            { math: md`L = 5 + \tfrac{3}{5}(0.1) + \tfrac{4}{5}(-0.1) = 5 + 0.06 - 0.08 = 4.98`, note: md`The true value is $\sqrt{9.61 + 15.21} = \sqrt{24.82} \approx 4.9820$.` },
          ],
        },
        {
          kind: "text",
          body: md`In one variable, "differentiable" and "has a derivative" are the same thing. In two variables they are not. The function

$$f(x, y) = \frac{xy}{x^2 + y^2} \ (\text{with } f(0, 0) = 0)$$

has $f_x(0, 0) = 0$ and $f_y(0, 0) = 0$, since it is zero along both axes. Its "tangent plane" at the origin would be $z = 0$. But along $y = x$ the function equals $\frac12$, so the plane misses the surface by $\frac12$ no matter how close you get. The partials exist, yet the plane is not a good approximation. Having two slopes is not enough; the plane has to fit.`,
        },
        {
          kind: "key",
          title: "Differentiability",
          body: md`$f$ is **differentiable** at $(a, b)$ when the tangent plane really approximates it:

$$f(a + \Delta x, b + \Delta y) = f(a, b) + f_x(a, b)\,\Delta x + f_y(a, b)\,\Delta y + \varepsilon \sqrt{\Delta x^2 + \Delta y^2},$$

with $\varepsilon \to 0$ as $(\Delta x, \Delta y) \to (0, 0)$. The error shrinks faster than the distance.

**Theorem.** If $f_x$ and $f_y$ exist near $(a, b)$ and are continuous at $(a, b)$, then $f$ is differentiable there. Every function built from polynomials, exponentials, trig functions and roots is differentiable wherever its partials are continuous, which is almost everywhere we'll look.`,
        },
        {
          kind: "proof",
          title: "Differentiable implies continuous",
          given: md`$f$ is differentiable at $(a, b)$`,
          prove: md`$\displaystyle\lim_{(x, y) \to (a, b)} f(x, y) = f(a, b)$`,
          steps: [
            { statement: md`$f(a + \Delta x, b + \Delta y) - f(a, b) = f_x(a, b)\,\Delta x + f_y(a, b)\,\Delta y + \varepsilon\sqrt{\Delta x^2 + \Delta y^2}$`, reason: "Definition of differentiable." },
            { statement: md`As $(\Delta x, \Delta y) \to (0, 0)$: $f_x(a, b)\,\Delta x \to 0$ and $f_y(a, b)\,\Delta y \to 0$.`, reason: "Fixed numbers times quantities going to 0." },
            { statement: md`$\varepsilon\sqrt{\Delta x^2 + \Delta y^2} \to 0$.`, reason: md`$\varepsilon \to 0$ and the distance $\to 0$.` },
            { statement: md`So $f(a + \Delta x, b + \Delta y) - f(a, b) \to 0$, which is continuity at $(a, b)$.`, reason: "Sum of three terms each tending to 0." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the tangent plane to $z = xy$ at the point above $(2, 3)$. Write it as $z = ax + by + c$ and answer with $(a, b, c)$.`,
          answer: "(3, 2, -6)",
          form: "tuple",
          explain: md`$f_x = y = 3$, $f_y = x = 2$, $f(2, 3) = 6$. So $z = 6 + 3(x - 2) + 2(y - 3) = 3x + 2y - 6$.`,
        },
      ],
      practice: [tangentPlane, linearApproximation, horizontalTangentPlane],
    },
    {
      id: slug("The multivariable chain rule"),
      title: "The multivariable chain rule",
      summary: "When the inputs of f themselves depend on t, the rate of change of f is a sum of one term per route. Derived from the linear approximation; tree diagrams; implicit differentiation as a corollary.",
      blocks: [
        {
          kind: "text",
          body: md`The one-variable chain rule says: if $z = g(x)$ and $x = x(t)$, then $\frac{dz}{dt} = g'(x)\,x'(t)$. A change in $t$ changes $x$, which changes $z$, and the rates multiply.

Now let $z = f(x, y)$ where both $x = x(t)$ and $y = y(t)$ depend on $t$. Think of $(x(t), y(t))$ as a point moving through the plane, and $z$ as the height of the surface above it: a hiker on a hillside. How fast is the hiker's altitude changing? Both coordinates move, and each contributes.`,
        },
        {
          kind: "key",
          title: "Chain rule, one independent variable",
          body: md`If $z = f(x, y)$ is differentiable and $x = x(t)$, $y = y(t)$ are differentiable, then

$$\frac{dz}{dt} = \frac{\partial z}{\partial x}\frac{dx}{dt} + \frac{\partial z}{\partial y}\frac{dy}{dt}.$$

One term for each intermediate variable, each a product of two rates along the route from $z$ to $t$.`,
        },
        {
          kind: "proof",
          title: "The chain rule from the linear approximation",
          given: md`$z = f(x, y)$ differentiable at $(x(t), y(t))$; $x(t)$, $y(t)$ differentiable at $t$`,
          prove: md`$\dfrac{dz}{dt} = f_x\,\dfrac{dx}{dt} + f_y\,\dfrac{dy}{dt}$`,
          steps: [
            { statement: md`Change $t$ by $\Delta t$. Then $x$ changes by $\Delta x$ and $y$ by $\Delta y$, and $\Delta z = f_x\,\Delta x + f_y\,\Delta y + \varepsilon\sqrt{\Delta x^2 + \Delta y^2}$, with $\varepsilon \to 0$ as $(\Delta x, \Delta y) \to (0, 0)$.`, reason: "Definition of differentiable (Lesson 4)." },
            { statement: md`$\dfrac{\Delta z}{\Delta t} = f_x\,\dfrac{\Delta x}{\Delta t} + f_y\,\dfrac{\Delta y}{\Delta t} + \varepsilon\sqrt{\left(\dfrac{\Delta x}{\Delta t}\right)^2 + \left(\dfrac{\Delta y}{\Delta t}\right)^2}$`, reason: md`Divide by $\Delta t$; a factor $\frac{1}{|\Delta t|}$ goes inside the square root as $\frac{1}{\Delta t^2}$. The sign of $\Delta t$ doesn't affect the limit below.` },
            { statement: md`As $\Delta t \to 0$: $\dfrac{\Delta x}{\Delta t} \to x'(t)$ and $\dfrac{\Delta y}{\Delta t} \to y'(t)$.`, reason: "Definition of the derivative." },
            { statement: md`Also $\Delta x \to 0$ and $\Delta y \to 0$, so $\varepsilon \to 0$, while the square root tends to the finite number $\sqrt{x'(t)^2 + y'(t)^2}$.`, reason: "Differentiable functions are continuous; the last term is (something going to 0) times (something bounded)." },
            { statement: md`$\dfrac{dz}{dt} = f_x\,x'(t) + f_y\,y'(t)$`, reason: "Take the limit of both sides." },
          ],
        },
        {
          kind: "contour",
          x: [-1.5, 1.5],
          y: [-1.5, 1.5],
          expr: "x y",
          levels: [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6],
          points: [{ x: "cos(t)", y: "sin(t)", label: "z = {=cos(t) sin(t)}", color: 2 }],
          arrows: [{ x: "cos(t)", y: "sin(t)", dx: "-0.5sin(t)", dy: "0.5cos(t)", label: "\\mathbf{r}'(t)", color: 3 }],
          params: [{ name: "t", tex: "t", min: 0, max: 6.28, step: 0.05, value: 0.6 }],
          caption: md`A hiker walks the unit circle $(\cos t, \sin t)$ over the hill $z = xy$. The green arrow is the velocity. Where it cuts across level curves, $z$ is changing; where it runs along one, $\frac{dz}{dt} = 0$. Slide $t$ to the diagonals, where $z$ peaks and bottoms out.`,
        },
        {
          kind: "plot",
          x: [0, 6.3],
          y: [-0.8, 0.8],
          curves: [
            { expr: "cos(x) sin(x)", label: "z(t) = \\cos t \\sin t", color: 1 },
            { expr: "cos(x)^2 - sin(x)^2", label: "\\tfrac{dz}{dt} = \\cos^2 t - \\sin^2 t", color: 3, dashed: true },
          ],
          caption: md`The hiker's altitude $z(t) = \cos t \sin t$ against $t$, with $\frac{dz}{dt}$ from the chain rule: $z_x x' + z_y y' = y(-\sin t) + x(\cos t) = \cos^2 t - \sin^2 t$. It is zero exactly at the peaks and valleys of $z$.`,
        },
        {
          kind: "example",
          title: "Two ways to the same derivative",
          problem: md`Let $z = x^2 y$ with $x = t^2$ and $y = 3t$. Find $\dfrac{dz}{dt}$ at $t = 1$.`,
          steps: [
            { math: md`z_x = 2xy, \quad z_y = x^2, \quad \frac{dx}{dt} = 2t, \quad \frac{dy}{dt} = 3`, note: "The four rates." },
            { math: md`\frac{dz}{dt} = 2xy \cdot 2t + x^2 \cdot 3`, note: "Chain rule." },
            { math: md`t = 1: \quad x = 1, \ y = 3, \quad \frac{dz}{dt} = 2(1)(3)(2) + (1)(3) = 15`, note: "" },
            { math: md`\text{check: } z = (t^2)^2 (3t) = 3t^5, \quad \frac{dz}{dt} = 15t^4 = 15`, note: "Substituting first and differentiating once agrees. The chain rule earns its keep when substitution isn't possible, as with implicit or unknown functions." },
          ],
        },
        {
          kind: "text",
          body: md`Now let $z = f(x, y)$ where $x$ and $y$ each depend on **two** variables, $x = x(s, t)$ and $y = y(s, t)$. Then $z$ is a function of $s$ and $t$, and we can ask for $\frac{\partial z}{\partial s}$. Holding $t$ fixed makes $s$ the only moving variable, so the one-variable chain rule applies, with partials where the derivatives of $x$ and $y$ used to be. A **tree diagram** keeps track: draw $z$, below it the variables it depends on, below each of those the variables they depend on. Label each branch with the partial derivative it represents.`,
        },
        {
          kind: "diagram",
          view: [-3.2, 3.2, -0.6, 2.8],
          points: [
            { name: "Z", x: 0, y: 2.4, label: "z", dir: "n" },
            { name: "X", x: -1.5, y: 1.2, label: "x", dir: "w" },
            { name: "Y", x: 1.5, y: 1.2, label: "y", dir: "e" },
            { name: "S1", x: -2.4, y: 0, label: "s", dir: "s" },
            { name: "T1", x: -0.6, y: 0, label: "t", dir: "s" },
            { name: "S2", x: 0.6, y: 0, label: "s", dir: "s" },
            { name: "T2", x: 2.4, y: 0, label: "t", dir: "s" },
          ],
          segments: [
            { from: "Z", to: "X", label: "\\frac{\\partial z}{\\partial x}", color: 1 },
            { from: "Z", to: "Y", label: "\\frac{\\partial z}{\\partial y}", color: 1 },
            { from: "X", to: "S1", label: "\\frac{\\partial x}{\\partial s}", color: 2 },
            { from: "X", to: "T1", label: "\\frac{\\partial x}{\\partial t}", color: 3 },
            { from: "Y", to: "S2", label: "\\frac{\\partial y}{\\partial s}", color: 2 },
            { from: "Y", to: "T2", label: "\\frac{\\partial y}{\\partial t}", color: 3 },
          ],
          caption: md`Tree diagram for $z = f(x, y)$, $x = x(s, t)$, $y = y(s, t)$. To find $\frac{\partial z}{\partial s}$, follow every route from $z$ down to an $s$ (the orange branches), multiply along each route, and add the routes.`,
        },
        {
          kind: "key",
          title: "Chain rule, general form",
          body: md`$$\frac{\partial z}{\partial s} = \frac{\partial z}{\partial x}\frac{\partial x}{\partial s} + \frac{\partial z}{\partial y}\frac{\partial y}{\partial s}, \qquad \frac{\partial z}{\partial t} = \frac{\partial z}{\partial x}\frac{\partial x}{\partial t} + \frac{\partial z}{\partial y}\frac{\partial y}{\partial t}.$$

In general: one term for each route down the tree from the output to the variable in question, each term the product of the partials along that route. Any number of levels and any number of variables.`,
        },
        {
          kind: "why",
          title: "Why one term per route",
          body: md`The linear approximation says a small change in $z$ is $f_x\,\Delta x + f_y\,\Delta y$: the intermediate variables each pass their change on to $z$, scaled by a partial, and the contributions add. If $x$ in turn depends on $s$ and $t$, then $\Delta x \approx x_s\,\Delta s + x_t\,\Delta t$, and likewise for $y$. Substitute, collect the terms with $\Delta s$, and you get $(f_x x_s + f_y y_s)\,\Delta s$. Each product is one route; the sum runs over all routes. Making the approximations exact in the limit is the same argument as the proof above.`,
        },
        {
          kind: "example",
          title: "Two intermediate variables",
          problem: md`Let $z = x^2 + xy$ with $x = st$ and $y = s - t$. Find $\dfrac{\partial z}{\partial s}$ at $(s, t) = (2, 1)$.`,
          steps: [
            { math: md`(s, t) = (2, 1): \quad x = 2, \quad y = 1`, note: "" },
            { math: md`z_x = 2x + y = 5, \quad z_y = x = 2`, note: "At (x, y) = (2, 1)." },
            { math: md`x_s = t = 1, \quad y_s = 1`, note: md`Holding $t$ fixed.` },
            { math: md`\frac{\partial z}{\partial s} = 5 \cdot 1 + 2 \cdot 1 = 7`, note: "Two routes, added." },
          ],
        },
        {
          kind: "text",
          body: md`**Implicit differentiation** is a corollary. Suppose an equation $F(x, y) = 0$ defines $y$ as a function of $x$, as $x^3 + y^3 = 6xy$ does near most of its points. Then $F(x, y(x)) = 0$ for all $x$. Differentiate with the chain rule, treating $x$ and $y$ as the intermediate variables and $x$ as the independent one:

$$F_x \frac{dx}{dx} + F_y \frac{dy}{dx} = 0 \quad\Longrightarrow\quad \frac{dy}{dx} = -\frac{F_x}{F_y} \qquad (F_y \ne 0).$$

This is the method of Calculus 1 in a single formula. For a surface $F(x, y, z) = 0$ defining $z(x, y)$, the same move gives $\frac{\partial z}{\partial x} = -\frac{F_x}{F_z}$ and $\frac{\partial z}{\partial y} = -\frac{F_y}{F_z}$.`,
        },
        {
          kind: "example",
          title: "The folium",
          problem: md`Find $\dfrac{dy}{dx}$ on $x^3 + y^3 = 6xy$ at the point $(3, 3)$.`,
          steps: [
            { math: md`F(x, y) = x^3 + y^3 - 6xy`, note: "Move everything to one side." },
            { math: md`F_x = 3x^2 - 6y = 27 - 18 = 9, \quad F_y = 3y^2 - 6x = 27 - 18 = 9`, note: "At (3, 3)." },
            { math: md`\frac{dy}{dx} = -\frac{F_x}{F_y} = -1`, note: "The curve is symmetric in x and y, and at (3, 3) its tangent is perpendicular to the line of symmetry. The formula agrees." },
          ],
        },
        {
          kind: "check",
          prompt: md`Let $z = xy$ with $x = t^2$ and $y = t^3$. Find $\dfrac{dz}{dt}$ at $t = 1$.`,
          answer: "5",
          explain: md`$z_x x' + z_y y' = y \cdot 2t + x \cdot 3t^2 = t^3 \cdot 2t + t^2 \cdot 3t^2 = 5t^4$, which is $5$ at $t = 1$. Check: $z = t^5$, $z' = 5t^4$.`,
        },
      ],
      practice: [chainRuleOneVariable, implicitDifferentiation, chainRuleTwoVariables],
    },
    {
      id: slug("Gradient and directional derivatives"),
      title: "Gradient and directional derivatives",
      summary: "The slope of a surface in any direction, from just two numbers. The gradient vector: it points straight uphill, its length is the steepest slope, and it is perpendicular to the level curves. All three proved.",
      blocks: [
        {
          kind: "text",
          body: md`$f_x$ is the slope when you walk east, $f_y$ when you walk north. What about north-east, or any other direction? Let $\mathbf{u} = \langle a, b \rangle$ be a **unit** vector. Walking from $(x_0, y_0)$ in the direction $\mathbf{u}$ for a distance $h$ puts you at $(x_0 + ah, y_0 + bh)$. The rate of change of $f$ per unit distance in that direction is

$$D_{\mathbf{u}} f(x_0, y_0) = \lim_{h \to 0} \frac{f(x_0 + ah, y_0 + bh) - f(x_0, y_0)}{h}.$$

With $\mathbf{u} = \langle 1, 0 \rangle$ this is $f_x$; with $\mathbf{u} = \langle 0, 1 \rangle$ it is $f_y$. The unit length matters: it makes $h$ the actual distance travelled, so the result is a slope.`,
        },
        {
          kind: "key",
          title: "Directional derivative",
          body: md`For a unit vector $\mathbf{u} = \langle a, b \rangle$, $D_{\mathbf{u}} f$ is the slope of the surface $z = f(x, y)$ in the direction $\mathbf{u}$. If a direction is given by a vector $\mathbf{v}$ that isn't a unit vector, use $\mathbf{u} = \mathbf{v}/|\mathbf{v}|$.`,
        },
        {
          kind: "proof",
          title: "The directional derivative from the partials",
          given: md`$f$ differentiable at $(x_0, y_0)$; $\mathbf{u} = \langle a, b \rangle$ a unit vector`,
          prove: md`$D_{\mathbf{u}} f(x_0, y_0) = f_x(x_0, y_0)\,a + f_y(x_0, y_0)\,b$`,
          steps: [
            { statement: md`Let $g(h) = f(x_0 + ah, y_0 + bh)$. Then $D_{\mathbf{u}} f(x_0, y_0) = g'(0)$.`, reason: md`$\frac{g(h) - g(0)}{h}$ is exactly the difference quotient in the definition.` },
            { statement: md`$g(h) = f(x(h), y(h))$ with $x(h) = x_0 + ah$, $y(h) = y_0 + bh$, so $g'(h) = f_x\,x'(h) + f_y\,y'(h)$.`, reason: "Chain rule (Lesson 5)." },
            { statement: md`$x'(h) = a$ and $y'(h) = b$.`, reason: "Derivatives of linear functions." },
            { statement: md`$g'(0) = f_x(x_0, y_0)\,a + f_y(x_0, y_0)\,b$.`, reason: md`At $h = 0$ the point is $(x_0, y_0)$.` },
          ],
        },
        {
          kind: "key",
          title: "The gradient",
          body: md`The **gradient** of $f$ is the vector of its partials:

$$\nabla f = \langle f_x, f_y \rangle.$$

Then the directional derivative is a dot product:

$$D_{\mathbf{u}} f = \nabla f \cdot \mathbf{u}.$$

Two numbers, $f_x$ and $f_y$, determine the slope in every direction.`,
        },
        {
          kind: "contour",
          x: [-3, 3],
          y: [-3, 3],
          expr: "x^2 + 2y^2",
          levels: [1, 2, 4, 6, 9, 12, 16],
          points: [{ x: "a", y: "b", label: "P", color: 2 }],
          arrows: [
            { x: "a", y: "b", dx: "0.4a", dy: "0.8b", label: "\\nabla f", color: 2 },
            { x: "a", y: "b", dx: "-0.8b", dy: "0.4a", label: "\\text{tangent}", color: 3 },
          ],
          params: [
            { name: "a", tex: "x", min: -2.5, max: 2.5, step: 0.1, value: 1.5 },
            { name: "b", tex: "y", min: -2.5, max: 2.5, step: 0.1, value: 0.8 },
          ],
          caption: md`Level curves of $f = x^2 + 2y^2$ with $\nabla f = \langle 2x, 4y \rangle$ drawn at $P$ (scaled down). Move $P$: the gradient is always perpendicular to the level curve through $P$, points toward higher levels, and is longer where the contours are close together.`,
        },
        {
          kind: "why",
          title: "Why the gradient points straight uphill",
          body: md`Write the dot product with the angle $\theta$ between $\nabla f$ and $\mathbf{u}$:

$$D_{\mathbf{u}} f = |\nabla f|\,|\mathbf{u}| \cos\theta = |\nabla f| \cos\theta.$$

As $\mathbf{u}$ turns, only $\cos\theta$ changes. It is largest, equal to $1$, when $\theta = 0$: walking in the direction of $\nabla f$ gives the steepest climb, and that slope is $|\nabla f|$. It is $-1$ when $\theta = \pi$: straight downhill is $-\nabla f$, slope $-|\nabla f|$. And it is $0$ when $\theta = \pm\frac{\pi}{2}$: perpendicular to the gradient the ground is level, which is where the level curve runs.

So the gradient is a compass for the surface: direction of steepest ascent, length equal to that slope.`,
        },
        {
          kind: "plot",
          x: [0, 6.3],
          y: [-5, 5],
          curves: [{ expr: "p cos(x) + q sin(x)", label: "D_{\\mathbf{u}} f = f_x \\cos\\theta + f_y \\sin\\theta", color: 1 }],
          hlines: [{ y: "sqrt(p^2 + q^2)", label: "|\\nabla f|" }, { y: "-sqrt(p^2 + q^2)", label: "-|\\nabla f|" }],
          vlines: [{ x: "atan(q/p)", label: "\\theta_{\\nabla f}" }],
          params: [
            { name: "p", tex: "f_x", min: 0.5, max: 4, step: 0.1, value: 3 },
            { name: "q", tex: "f_y", min: -4, max: 4, step: 0.1, value: 1 },
          ],
          caption: md`The directional derivative as the direction $\mathbf{u} = \langle \cos\theta, \sin\theta \rangle$ turns through a full circle. It is a sine wave of amplitude $|\nabla f|$, peaking at the gradient's own angle and crossing zero a quarter turn away.`,
        },
        {
          kind: "proof",
          title: "The gradient is perpendicular to the level curve",
          given: md`$f$ differentiable; a level curve $f(x, y) = k$ passing through $P$, parametrized by a smooth $\mathbf{r}(t) = \langle x(t), y(t) \rangle$ with $\mathbf{r}(t_0) = P$ and $\mathbf{r}'(t_0) \ne \mathbf{0}$`,
          prove: md`$\nabla f(P) \perp \mathbf{r}'(t_0)$`,
          steps: [
            { statement: md`$f(x(t), y(t)) = k$ for all $t$.`, reason: "The curve stays on the level curve." },
            { statement: md`$f_x\,x'(t) + f_y\,y'(t) = 0$`, reason: "Differentiate both sides in t: chain rule on the left, derivative of a constant on the right." },
            { statement: md`$\nabla f \cdot \mathbf{r}'(t) = 0$`, reason: "The left side is this dot product." },
            { statement: md`At $t = t_0$: $\nabla f(P) \cdot \mathbf{r}'(t_0) = 0$, so the gradient is perpendicular to the tangent vector of the level curve.`, reason: "Zero dot product means perpendicular (Unit 1)." },
          ],
        },
        {
          kind: "example",
          title: "Slope in a given direction, and the steepest one",
          problem: md`For $f(x, y) = x^2 + 2y^2$ at $P = (1, 1)$: find $D_{\mathbf{u}} f$ in the direction of $\mathbf{v} = \langle 3, 4 \rangle$, and the greatest slope at $P$.`,
          steps: [
            { math: md`\nabla f = \langle 2x, 4y \rangle = \langle 2, 4 \rangle`, note: "At (1, 1)." },
            { math: md`\mathbf{u} = \frac{\langle 3, 4 \rangle}{5}`, note: md`$|\mathbf{v}| = 5$. Always normalize first.` },
            { math: md`D_{\mathbf{u}} f = \frac{2 \cdot 3 + 4 \cdot 4}{5} = \frac{22}{5}`, note: "" },
            { math: md`\max D_{\mathbf{u}} f = |\nabla f| = \sqrt{4 + 16} = 2\sqrt5 \approx 4.47`, note: md`In the direction $\langle 2, 4 \rangle / 2\sqrt5 = \langle 1, 2 \rangle/\sqrt5$. The slope $22/5 = 4.4$ toward $\mathbf{v}$ is a little less, because $\mathbf{v}$ is a little off the gradient.` },
          ],
        },
        {
          kind: "text",
          body: md`In three variables, $\nabla f = \langle f_x, f_y, f_z \rangle$, $D_{\mathbf{u}} f = \nabla f \cdot \mathbf{u}$, and the same proof shows $\nabla F$ is perpendicular to every curve lying in the **level surface** $F(x, y, z) = k$. That makes $\nabla F$ a normal vector to the level surface, so the tangent plane at $P = (x_0, y_0, z_0)$ is

$$F_x(P)(x - x_0) + F_y(P)(y - y_0) + F_z(P)(z - z_0) = 0.$$

Lesson 4's tangent plane is the special case $F(x, y, z) = f(x, y) - z$: then $\nabla F = \langle f_x, f_y, -1 \rangle$, the normal we found there.`,
        },
        {
          kind: "key",
          title: "Tangent plane to a level surface",
          body: md`At a point $P$ of the surface $F(x, y, z) = k$ with $\nabla F(P) \ne \mathbf{0}$, the normal vector is $\nabla F(P)$ and the tangent plane is $\nabla F(P) \cdot \langle x - x_0, y - y_0, z - z_0 \rangle = 0$. For the sphere $x^2 + y^2 + z^2 = 14$ at $(1, 2, 3)$: $\nabla F = \langle 2, 4, 6 \rangle$, plane $2(x - 1) + 4(y - 2) + 6(z - 3) = 0$, which simplifies to $x + 2y + 3z = 14$.`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x, y) = x^2 y$. Find the directional derivative at $(2, 1)$ in the direction of $\mathbf{v} = \langle 3, 4 \rangle$. Give an exact fraction.`,
          answer: "28/5",
          explain: md`$\nabla f = \langle 2xy, x^2 \rangle = \langle 4, 4 \rangle$ at $(2, 1)$. Unit direction $\langle 3, 4 \rangle/5$. $D_{\mathbf{u}} f = \frac{12 + 16}{5} = \frac{28}{5}$.`,
        },
      ],
      practice: [directionalDerivative, gradientAtPoint, levelCurveSlope],
    },
    {
      id: slug("Maxima and minima"),
      title: "Maxima and minima",
      summary: "Peaks, pits and passes. Critical points, where both partials vanish; the second derivative test with D = f_xx f_yy - f_xy^2 and where it comes from; absolute extrema on closed, bounded regions.",
      blocks: [
        {
          kind: "text",
          body: md`$f$ has a **local maximum** at $(a, b)$ if $f(x, y) \le f(a, b)$ for all $(x, y)$ near $(a, b)$: a peak on the surface. A **local minimum** is a pit. In one variable, Fermat's theorem said the derivative is zero at any interior extremum where it exists. The same holds here, slice by slice.`,
        },
        {
          kind: "proof",
          title: "Fermat's theorem in two variables",
          given: md`$f$ has a local maximum or minimum at $(a, b)$, and $f_x(a, b)$, $f_y(a, b)$ exist`,
          prove: md`$f_x(a, b) = 0$ and $f_y(a, b) = 0$`,
          steps: [
            { statement: md`Let $g(x) = f(x, b)$. Then $g$ has a local extremum at $x = a$.`, reason: md`Points $(x, b)$ near $(a, b)$ are among the points where $f(x, y) \le f(a, b)$ (or $\ge$).` },
            { statement: md`$g'(a) = 0$.`, reason: "Fermat's theorem for one variable; g'(a) exists because it equals f_x(a, b)." },
            { statement: md`$f_x(a, b) = g'(a) = 0$.`, reason: "Definition of the partial derivative." },
            { statement: md`Likewise $h(y) = f(a, y)$ has an extremum at $y = b$, so $f_y(a, b) = h'(b) = 0$.`, reason: "Same argument in the other slice." },
          ],
        },
        {
          kind: "key",
          title: "Critical points",
          body: md`A **critical point** of $f$ is a point where $f_x = f_y = 0$, or where one of the partials fails to exist. Local extrema can only happen at critical points. At a critical point with $\nabla f = \mathbf{0}$, the tangent plane is horizontal.

Not every critical point is an extremum. The saddle $x^2 - y^2$ has $\nabla f = \langle 2x, -2y \rangle = \mathbf{0}$ at the origin, which is a minimum along one axis and a maximum along the other: a **saddle point**.`,
        },
        {
          kind: "example",
          title: "A pit, found and confirmed",
          problem: md`Find and classify the critical point of $f(x, y) = x^2 + y^2 - 2x - 6y + 14$.`,
          steps: [
            { math: md`f_x = 2x - 2 = 0, \quad f_y = 2y - 6 = 0`, note: "Critical point (1, 3)." },
            { math: md`f = (x - 1)^2 + (y - 3)^2 + 4`, note: "Complete both squares." },
            { math: md`f(x, y) \ge 4 = f(1, 3)`, note: "Squares are never negative, so (1, 3) is a minimum, in fact the absolute minimum." },
          ],
        },
        {
          kind: "text",
          body: md`Completing the square won't always be available. We want a test that uses only derivatives at the critical point, like the second derivative test in one variable. The surface below shows what has to be detected. Slide $c$: as the cross term grows, the bowl $x^2 + y^2$ stretches, flattens into a trough at $c = 2$, and becomes a saddle beyond it.`,
        },
        {
          kind: "surface",
          x: [-2, 2],
          y: [-2, 2],
          z: [-4, 8],
          expr: "x^2 + c x y + y^2",
          params: [{ name: "c", tex: "c", min: 0, max: 4, step: 0.1, value: 1 }],
          caption: md`$z = x^2 + cxy + y^2$. Here $f_{xx} = f_{yy} = 2$ and $f_{xy} = c$, so $D = 4 - c^2$. Positive for $c < 2$: a pit. Negative for $c > 2$: a saddle. Zero at $c = 2$, where $f = (x + y)^2$ is a trough and the test can't decide.`,
        },
        {
          kind: "why",
          title: "Where the second derivative test comes from",
          body: md`Near a critical point, a smooth function looks like its quadratic approximation (first-order terms are gone, since the partials vanish):

$$f(a + h, b + k) - f(a, b) \approx \tfrac12\left(A h^2 + 2B hk + C k^2\right), \qquad A = f_{xx},\ B = f_{xy},\ C = f_{yy}.$$

So the question is the sign of the quadratic $Q = Ah^2 + 2Bhk + Ck^2$. Suppose $A \ne 0$ and complete the square in $h$:

$$Q = A\left(h + \frac{B}{A}k\right)^2 + \frac{AC - B^2}{A}\,k^2.$$

If $AC - B^2 > 0$, both coefficients have the sign of $A$: $Q$ keeps one sign in every direction. Positive for $A > 0$, a minimum; negative for $A < 0$, a maximum. If $AC - B^2 < 0$ the two coefficients have opposite signs, so $Q$ is positive in some directions ($k = 0$) and negative in others: a saddle. If $AC - B^2 = 0$ the quadratic part is zero along a whole line, and the higher-order terms decide; the test is silent.

The number $D = AC - B^2 = f_{xx} f_{yy} - f_{xy}^2$ is the determinant of the matrix of second partials, $\begin{vmatrix} f_{xx} & f_{xy} \\ f_{xy} & f_{yy} \end{vmatrix}$.`,
        },
        {
          kind: "key",
          title: "Second derivative test",
          body: md`At a critical point with $\nabla f = \mathbf{0}$ and continuous second partials, let $D = f_{xx} f_{yy} - f_{xy}^2$.

- $D > 0$ and $f_{xx} > 0$: local minimum.
- $D > 0$ and $f_{xx} < 0$: local maximum.
- $D < 0$: saddle point.
- $D = 0$: no conclusion.

When $D > 0$, $f_{xx}$ and $f_{yy}$ have the same sign, so either one can be used.`,
        },
        {
          kind: "example",
          title: "Two critical points, two verdicts",
          problem: md`Find and classify the critical points of $f(x, y) = x^3 - 3x + y^2$.`,
          steps: [
            { math: md`f_x = 3x^2 - 3 = 0 \implies x = \pm 1, \qquad f_y = 2y = 0 \implies y = 0`, note: "Critical points (1, 0) and (-1, 0)." },
            { math: md`f_{xx} = 6x, \quad f_{yy} = 2, \quad f_{xy} = 0, \quad D = 12x`, note: "Here D depends on the point." },
            { math: md`(1, 0): \ D = 12 > 0, \ f_{xx} = 6 > 0`, note: "A local minimum, value -2." },
            { math: md`(-1, 0): \ D = -12 < 0`, note: "A saddle point." },
          ],
        },
        {
          kind: "contour",
          x: [-2.5, 2.5],
          y: [-2, 2],
          expr: "x^3 - 3x + y^2",
          levels: [-2, -1.5, -1, 0, 1, 2, 3, 4],
          points: [
            { x: 1, y: 0, label: "\\text{min}", color: 3 },
            { x: -1, y: 0, label: "\\text{saddle}", color: 4 },
          ],
          caption: md`Contours of $x^3 - 3x + y^2$. Closed loops ring the minimum at $(1, 0)$. At the saddle $(-1, 0)$ the level curve $f = 2$ crosses itself, the signature of a pass: uphill in two directions, downhill in two others.`,
        },
        {
          kind: "text",
          body: md`**Absolute extrema.** On a closed, bounded region $R$ (a region that includes its boundary and doesn't run off to infinity), a continuous $f$ has an absolute maximum and minimum somewhere in $R$. This is the Extreme Value Theorem, two-variable version. The extreme either lies inside $R$, where it is a local extremum and therefore a critical point, or on the boundary, which is a curve and so a one-variable problem.`,
        },
        {
          kind: "key",
          title: "Finding absolute extrema on a closed region",
          body: md`1. Find the critical points of $f$ inside $R$ and compute $f$ there.
2. Find the extreme values of $f$ on the boundary of $R$ (parametrize each boundary piece, reducing to one variable).
3. The largest of all these values is the absolute maximum, the smallest the absolute minimum.`,
        },
        {
          kind: "example",
          title: "Extremes on a square",
          problem: md`Find the absolute extrema of $f(x, y) = x^2 + y^2 - 2x - 4y$ on the square $0 \le x \le 3$, $0 \le y \le 3$.`,
          steps: [
            { math: md`f_x = 2x - 2 = 0, \ f_y = 2y - 4 = 0 \implies (1, 2), \quad f(1, 2) = -5`, note: "Interior critical point." },
            { math: md`x = 0: \ y^2 - 4y, \text{ min } -4 \text{ at } y = 2; \text{ ends } 0, -3`, note: "Left edge: a parabola in y." },
            { math: md`x = 3: \ y^2 - 4y + 3, \text{ min } -1 \text{ at } y = 2; \text{ ends } 3, 0`, note: "Right edge." },
            { math: md`y = 0: \ x^2 - 2x, \text{ min } -1 \text{ at } x = 1; \qquad y = 3: \ x^2 - 2x - 3, \text{ min } -4 \text{ at } x = 1`, note: "Bottom and top edges; their endpoints are the corners already listed." },
            { math: md`\max f = 3 \text{ at } (3, 0), \qquad \min f = -5 \text{ at } (1, 2)`, note: "Compare every candidate." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the critical point of $f(x, y) = x^2 + xy + y^2 - 3x$. Answer as $(x, y)$.`,
          answer: "(2, -1)",
          form: "tuple",
          explain: md`$f_x = 2x + y - 3 = 0$ and $f_y = x + 2y = 0$. From the second, $x = -2y$; then $-4y + y = 3$, $y = -1$, $x = 2$. ($D = 4 - 1 = 3 > 0$ with $f_{xx} = 2$: a minimum.)`,
        },
      ],
      practice: [criticalPoints, classifyCriticalPoint, absoluteExtrema],
    },
    {
      id: slug("Lagrange multipliers"),
      title: "Lagrange multipliers",
      summary: "Optimizing f when the point must stay on a curve g = k. At the extreme, the level curve of f is tangent to the constraint, so the gradients are parallel: grad f = lambda grad g. Proved, then used.",
      blocks: [
        {
          kind: "text",
          body: md`Often the point we optimize over isn't free. Find the largest value of $f(x, y) = 3x + 4y$ among points on the circle $x^2 + y^2 = 25$. Find the rectangle of perimeter 20 with the largest area: maximize $xy$ with $2x + 2y = 20$. In each case there is an **objective** $f$ and a **constraint** $g(x, y) = k$.

Substitution sometimes works (solve the constraint for $y$, substitute, differentiate), but it is often messy or impossible. Lagrange's method handles the constraint directly, and the idea behind it is geometric.`,
        },
        {
          kind: "plot",
          x: [-7, 7],
          y: [-6.5, 6.5],
          parametric: [{ x: "5cos(t)", y: "5sin(t)", t: [0, 6.2832], label: "x^2 + y^2 = 25", color: 1 }],
          curves: [{ expr: "(k - 3x)/4", label: "3x + 4y = {k}", color: 2 }],
          points: [
            { x: 3, y: 4, label: "(3, 4)", color: 3 },
            { x: -3, y: -4, label: "(-3, -4)", color: 3 },
          ],
          params: [{ name: "k", tex: "k", min: -30, max: 30, step: 1, value: 10 }],
          caption: md`Level lines $3x + 4y = k$ of the objective, sliding over the constraint circle. Raise $k$: the line still meets the circle until $k = 25$, where it just touches at $(3, 4)$. Any higher and it misses. At the touching point the level line is **tangent** to the circle.`,
        },
        {
          kind: "why",
          title: "Why the level curve must be tangent to the constraint",
          body: md`Suppose at a point $P$ on the constraint curve the level curve of $f$ through $P$ **crosses** the constraint instead of touching it. Then the constraint curve passes from one side of the level curve to the other. On one side $f$ is bigger than $f(P)$ and on the other it is smaller (that's what a level curve separates). So walking along the constraint through $P$ you can increase $f$ one way and decrease it the other way, and $P$ is not an extremum.

Therefore at a constrained extremum the level curve of $f$ and the constraint curve share a tangent line. Two curves tangent at a point have parallel normals, and the normal to a level curve is the gradient (Lesson 6). So $\nabla f$ is parallel to $\nabla g$ at $P$.`,
        },
        {
          kind: "proof",
          title: "The Lagrange condition",
          given: md`$f$ has a maximum or minimum on the curve $g(x, y) = k$ at $P$; $f$ and $g$ differentiable; $\nabla g(P) \ne \mathbf{0}$`,
          prove: md`$\nabla f(P) = \lambda\,\nabla g(P)$ for some number $\lambda$`,
          steps: [
            { statement: md`Parametrize the constraint curve near $P$ by $\mathbf{r}(t)$ with $\mathbf{r}(t_0) = P$ and $\mathbf{r}'(t_0) \ne \mathbf{0}$.`, reason: md`Possible since $\nabla g(P) \ne \mathbf{0}$ (the implicit function theorem; the curve is smooth there).` },
            { statement: md`$h(t) = f(\mathbf{r}(t))$ has an extremum at $t_0$, so $h'(t_0) = 0$.`, reason: "Fermat's theorem in one variable." },
            { statement: md`$h'(t_0) = \nabla f(P) \cdot \mathbf{r}'(t_0) = 0$.`, reason: "Chain rule." },
            { statement: md`$\nabla g(P) \cdot \mathbf{r}'(t_0) = 0$.`, reason: "The gradient is perpendicular to the level curve g = k (Lesson 6)." },
            { statement: md`Both $\nabla f(P)$ and $\nabla g(P)$ are perpendicular to the same nonzero vector $\mathbf{r}'(t_0)$ in the plane, so they are parallel: $\nabla f(P) = \lambda\,\nabla g(P)$.`, reason: "In two dimensions, the vectors perpendicular to a given nonzero vector all lie on one line." },
          ],
        },
        {
          kind: "key",
          title: "Method of Lagrange multipliers",
          body: md`To find the extreme values of $f(x, y)$ subject to $g(x, y) = k$:

1. Solve the system $\nabla f = \lambda \nabla g$, $g = k$. That is three equations, $f_x = \lambda g_x$, $f_y = \lambda g_y$, $g = k$, in the three unknowns $x$, $y$, $\lambda$.
2. Evaluate $f$ at every solution. The largest is the maximum, the smallest the minimum (when they exist, e.g. the constraint curve is closed and bounded).

The number $\lambda$ is the **multiplier**. You rarely need its value; it's a device for finding the points.`,
        },
        {
          kind: "example",
          title: "The circle problem",
          problem: md`Find the extreme values of $f(x, y) = 3x + 4y$ on the circle $x^2 + y^2 = 25$.`,
          steps: [
            { math: md`\langle 3, 4 \rangle = \lambda \langle 2x, 2y \rangle, \qquad x^2 + y^2 = 25`, note: md`$\nabla f = \lambda \nabla g$ with $g = x^2 + y^2$.` },
            { math: md`x = \frac{3}{2\lambda}, \quad y = \frac{4}{2\lambda} = \frac{2}{\lambda}`, note: md`$\lambda \ne 0$ because $\nabla f \ne \mathbf{0}$.` },
            { math: md`\frac{9}{4\lambda^2} + \frac{4}{\lambda^2} = 25 \implies \frac{25}{4\lambda^2} = 25 \implies \lambda = \pm\tfrac12`, note: "Substitute into the constraint." },
            { math: md`\lambda = \tfrac12: (3, 4), \ f = 25; \qquad \lambda = -\tfrac12: (-3, -4), \ f = -25`, note: "Maximum 25 and minimum -25, matching the picture." },
          ],
        },
        {
          kind: "example",
          title: "When a case split appears",
          problem: md`Find the extreme values of $f(x, y) = x^2 + y^2$ on the ellipse $x^2 + 4y^2 = 4$.`,
          steps: [
            { math: md`2x = \lambda \cdot 2x, \qquad 2y = \lambda \cdot 8y`, note: md`$\nabla f = \lambda \nabla g$ with $g = x^2 + 4y^2$.` },
            { math: md`2x(1 - \lambda) = 0 \implies x = 0 \text{ or } \lambda = 1`, note: "Don't divide by x; it might be zero. Factor instead." },
            { math: md`2y(1 - 4\lambda) = 0 \implies y = 0 \text{ or } \lambda = \tfrac14`, note: md`$\lambda$ can't be both $1$ and $\frac14$, so at least one of $x$, $y$ is $0$.` },
            { math: md`x = 0: \ 4y^2 = 4, \ y = \pm 1, \ f = 1; \qquad y = 0: \ x^2 = 4, \ x = \pm 2, \ f = 4`, note: "Constraint fixes the other coordinate." },
            { math: md`\max f = 4, \quad \min f = 1`, note: "The farthest points from the origin are the ends of the long axis; the nearest are the ends of the short one." },
          ],
        },
        {
          kind: "why",
          title: "Why you must not divide by a variable",
          body: md`The equation $2x = 2\lambda x$ is satisfied by $x = 0$ whatever $\lambda$ is. Dividing both sides by $x$ throws that solution away, and in the ellipse problem it is exactly the solution that gives the minimum. Rewrite every such equation as a product equal to zero, $2x(1 - \lambda) = 0$, and keep both factors. Case splits are normal in Lagrange problems; follow each case to the constraint and collect all the points before comparing values.`,
        },
        {
          kind: "example",
          title: "A word problem",
          problem: md`A rectangle has perimeter 20. Which dimensions give the largest area?`,
          steps: [
            { math: md`\text{maximize } A = xy \quad \text{subject to } 2x + 2y = 20`, note: "Objective and constraint." },
            { math: md`\langle y, x \rangle = \lambda \langle 2, 2 \rangle \implies y = 2\lambda = x`, note: "Both components give the same thing." },
            { math: md`4x = 20 \implies x = y = 5`, note: "A 5 by 5 square, area 25. The endpoints of the constraint (a side of length 0) give area 0, so this is the maximum." },
          ],
        },
        {
          kind: "text",
          body: md`With three variables nothing changes except the count: $\nabla f = \lambda \nabla g$ is three equations, plus the constraint makes four, in the four unknowns $x, y, z, \lambda$. The geometry is the same: at an extreme point on the surface $g = k$, the level surface of $f$ is tangent to it, and both gradients are normal to the shared tangent plane. The box of volume 8 with least surface area, for instance, comes from $\nabla(2xy + 2yz + 2xz) = \lambda \nabla(xyz)$, and the symmetry of the equations forces $x = y = z = 2$.

The multiplier itself has a meaning: $\lambda = \frac{dM}{dk}$, the rate at which the optimal value $M$ changes as the constraint level $k$ is relaxed. Economists call it a shadow price. In the circle problem, $\lambda = \frac12$ at the maximum, and indeed $M = 5\sqrt{k}$ has $\frac{dM}{dk} = \frac{5}{2\sqrt{25}} = \frac12$ at $k = 25$.`,
        },
        {
          kind: "check",
          prompt: md`Find the point on the line $3x + 4y = 25$ closest to the origin. Answer as $(x, y)$.`,
          answer: "(3, 4)",
          form: "tuple",
          explain: md`Minimize $x^2 + y^2$ with constraint $3x + 4y = 25$: $\langle 2x, 2y \rangle = \lambda \langle 3, 4 \rangle$, so $(x, y)$ is a multiple of $\langle 3, 4 \rangle$. On the line, $3(3t) + 4(4t) = 25t = 25$, so $t = 1$ and the point is $(3, 4)$.`,
        },
      ],
      practice: [lagrangeOnCircle, lagrangeExtremeValue, lagrangeApplied],
    },
  ],
};
