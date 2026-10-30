import { frac, fracTex, gcd, poly, type Rng } from "../../math/random";
import { md, slug, type Generator, type Problem, type Step, type Unit } from "../types";

// ── Small helpers ───────────────────────────────────────────────────────────

/** A reduced fraction [numerator, denominator]. */
type Q = [number, number];
const q = (n: number, d = 1): Q => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const qAdd = (a: Q, b: Q): Q => {
  const g = gcd(a[1], b[1]) || 1;
  return q(a[0] * (b[1] / g) + b[0] * (a[1] / g), (a[1] / g) * b[1]);
};
const qMul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);
const qPow = (a: Q, k: number): Q => q(a[0] ** k, a[1] ** k);
const qText = (a: Q) => frac(a[0], a[1]);
const qTex = (a: Q) => fracTex(a[0], a[1]);
const qNum = (a: Q) => a[0] / a[1];
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));

/** One term c (x - a)^k of a polynomial. */
interface Term {
  c: Q;
  k: number;
}
const powTex = (base: string, k: number) => (k === 0 ? "" : k === 1 ? base : `${base}^{${k}}`);
const powText = (base: string, k: number) => (k === 0 ? "" : k === 1 ? base : `${base}^${k}`);

/** A polynomial in LaTeX, written the way a person would: x - \frac{x^3}{6}. */
function termsTex(terms: Term[], base = "x"): string {
  let out = "";
  for (const { c, k } of terms) {
    const [n, d] = c;
    if (n === 0) continue;
    const an = Math.abs(n);
    const p = powTex(base, k);
    const mag = d === 1 ? (an === 1 && p ? p : `${an}${p}`) : p ? `\\frac{${an === 1 ? "" : an}${p}}{${d}}` : `\\frac{${an}}{${d}}`;
    out = out ? `${out} ${n < 0 ? "-" : "+"} ${mag}` : n < 0 ? `-${mag}` : mag;
  }
  return out || "0";
}

/** The same polynomial in typed-answer syntax: x - x^3/6. */
function termsText(terms: Term[], base = "x"): string {
  let out = "";
  for (const { c, k } of terms) {
    const [n, d] = c;
    if (n === 0) continue;
    const an = Math.abs(n);
    const p = powText(base, k);
    const mag = d === 1 ? (an === 1 && p ? p : `${an}${p}`) : p ? `${an === 1 ? "" : an}${p}/${d}` : `${an}/${d}`;
    out = out ? `${out} ${n < 0 ? "-" : "+"} ${mag}` : n < 0 ? `-${mag}` : mag;
  }
  return out || "0";
}

const CENTERS = [-3, -2, -1, 0, 1, 2, 3];
/** (x - a) with the sign tidied; the same characters work in LaTeX and in typed answers. */
const shift = (a: number) => (a === 0 ? "x" : `(x ${a < 0 ? "+" : "-"} ${Math.abs(a)})`);
const absShift = (a: number) => (a === 0 ? "|x|" : `|x ${a < 0 ? "+" : "-"} ${Math.abs(a)}|`);
const coefTex = (c: number) => (c === 1 ? "" : c === -1 ? "-" : String(c));
const kxTex = (k: number) => (k === 1 ? "x" : k === -1 ? "-x" : `${k}x`);
const primes = (j: number) => (j === 0 ? "f" : j <= 3 ? `f${"'".repeat(j)}` : `f^{(${j})}`);

// ── Lesson 1: Power series and convergence ─────────────────────────────────

const radiusOfConvergence: Generator = (r) => {
  const kind = r.int(0, 7);
  const a = r.pick(CENTERS);
  const b = kind === 6 ? r.pick([4, 9]) : r.pick([2, 3, 4, 5]);
  const u = shift(a);
  const ua = absShift(a);
  const prompt = (from: number, term: string) =>
    md`Find the radius of convergence $R$ of $\displaystyle\sum_{n=${from}}^{\infty} ${term}$. Type a number, or **infinity** if the series converges for every $x$.`;
  const ratio = (body: string) => md`\left|\frac{a_{n+1}}{a_n}\right| = ${body}`;
  const finish: Step = { math: md`${ua} < ${b} \;\Rightarrow\; R = ${b}`, note: "The series converges where the limit is below 1 and diverges where it is above 1, so the cutoff distance is the radius." };

  if (kind === 0) {
    return {
      prompt: prompt(0, md`\frac{${u}^n}{${b}^n}`),
      answer: String(b),
      hint: md`Ratio test: divide the $(n+1)$st term by the $n$th. Most of the powers cancel.`,
      solution: [
        { math: ratio(md`\frac{${ua}^{n+1}}{${b}^{n+1}} \cdot \frac{${b}^n}{${ua}^n} = \frac{${ua}}{${b}}`), note: "The ratio doesn't even depend on $n$, so it is already the limit." },
        finish,
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: prompt(1, md`\frac{${u}^n}{n \cdot ${b}^n}`),
      answer: String(b),
      hint: md`In the ratio, $\frac{n}{n+1} \to 1$. The $n$ in the denominator never changes the radius; it only matters at the endpoints.`,
      solution: [
        { math: ratio(md`\frac{${ua}^{n+1}}{(n+1) ${b}^{n+1}} \cdot \frac{n \, ${b}^n}{${ua}^n} = \frac{n}{n+1} \cdot \frac{${ua}}{${b}}`), note: "Ratio of consecutive terms." },
        { math: md`\to \frac{${ua}}{${b}}`, note: md`$\frac{n}{n+1} \to 1$.` },
        finish,
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: prompt(1, md`\frac{n \, ${u}^n}{${b}^n}`),
      answer: String(b),
      hint: md`The factor $\frac{n+1}{n}$ in the ratio tends to 1.`,
      solution: [
        { math: ratio(md`\frac{(n+1) ${ua}^{n+1}}{${b}^{n+1}} \cdot \frac{${b}^n}{n \, ${ua}^n} = \frac{n+1}{n} \cdot \frac{${ua}}{${b}}`), note: "Ratio of consecutive terms." },
        { math: md`\to \frac{${ua}}{${b}}`, note: md`$\frac{n+1}{n} \to 1$.` },
        finish,
      ],
    };
  }
  if (kind === 3) {
    return {
      prompt: prompt(1, md`\frac{${b}^n ${u}^n}{n}`),
      answer: `1/${b}`,
      hint: md`The $${b}^n$ is on top this time, so the ratio tends to $${b}${ua}$. Solve $${b}${ua} < 1$.`,
      solution: [
        { math: ratio(md`\frac{${b}^{n+1} ${ua}^{n+1}}{n+1} \cdot \frac{n}{${b}^n ${ua}^n} = \frac{n}{n+1} \cdot ${b}${ua}`), note: "Ratio of consecutive terms." },
        { math: md`\to ${b}${ua}`, note: md`$\frac{n}{n+1} \to 1$.` },
        { math: md`${b}${ua} < 1 \;\Rightarrow\; ${ua} < \frac{1}{${b}} \;\Rightarrow\; R = \frac{1}{${b}}`, note: "A growing coefficient shrinks the radius." },
      ],
    };
  }
  if (kind === 4) {
    return {
      prompt: prompt(0, md`\frac{${u}^n}{n!}`),
      accept: ["infinity", "inf"],
      hint: md`$(n+1)! = (n+1) \cdot n!$, so the factorials leave a single factor $n + 1$ in the denominator.`,
      solution: [
        { math: ratio(md`\frac{${ua}^{n+1}}{(n+1)!} \cdot \frac{n!}{${ua}^n} = \frac{${ua}}{n+1}`), note: md`$\frac{n!}{(n+1)!} = \frac{1}{n+1}$.` },
        { math: md`\frac{${ua}}{n+1} \to 0 \text{ for every } x`, note: "A fixed number over a growing one. The limit is below 1 no matter what $x$ is." },
        { math: md`R = \infty`, note: "The series converges for all real $x$." },
      ],
    };
  }
  if (kind === 5) {
    return {
      prompt: prompt(0, md`n! \, ${u}^n`),
      answer: "0",
      hint: md`The factorial is on top now. The ratio is $(n+1)${ua}$, which grows without bound unless $${ua} = 0$.`,
      solution: [
        { math: ratio(md`\frac{(n+1)! \, ${ua}^{n+1}}{n! \, ${ua}^n} = (n+1)${ua}`), note: md`$\frac{(n+1)!}{n!} = n + 1$.` },
        { math: md`(n+1)${ua} \to \infty \text{ unless } ${ua} = 0`, note: "At every $x$ other than the center the terms eventually grow, so the series diverges there." },
        { math: md`R = 0`, note: md`It converges only at $x = ${a}$, where every term after the first is 0.` },
      ],
    };
  }
  if (kind === 6) {
    const R = Math.sqrt(b);
    return {
      prompt: prompt(0, md`\frac{${u}^{2n}}{${b}^n}`),
      answer: String(R),
      hint: md`Only even powers appear. The ratio of consecutive terms is $\frac{${ua}^2}{${b}}$; solve $${ua}^2 < ${b}$.`,
      solution: [
        { math: ratio(md`\frac{${ua}^{2n+2}}{${b}^{n+1}} \cdot \frac{${b}^n}{${ua}^{2n}} = \frac{${ua}^2}{${b}}`), note: "Each step up in $n$ adds two powers of $(x - a)$ and one power of the base." },
        { math: md`\frac{${ua}^2}{${b}} < 1 \;\Rightarrow\; ${ua}^2 < ${b} \;\Rightarrow\; ${ua} < ${R}`, note: "Take the square root of both sides." },
        { math: md`R = ${R}`, note: md`Not $${b}$: the radius is measured in $x$, and the series is really a series in $${u}^2$.` },
      ],
    };
  }
  return {
    prompt: prompt(0, md`\frac{${b}^n ${u}^n}{n!}`),
    accept: ["infinity", "inf"],
    hint: md`Write the term as $\frac{(${b}${u})^n}{n!}$. A factorial in the denominator beats any exponential.`,
    solution: [
      { math: ratio(md`\frac{${b}^{n+1} ${ua}^{n+1}}{(n+1)!} \cdot \frac{n!}{${b}^n ${ua}^n} = \frac{${b}${ua}}{n+1}`), note: md`$\frac{n!}{(n+1)!} = \frac{1}{n+1}$.` },
      { math: md`\frac{${b}${ua}}{n+1} \to 0 \text{ for every } x`, note: "The numerator is fixed once $x$ is; the denominator grows." },
      { math: md`R = \infty`, note: md`This is the series for $e^{${b}${u}}$ (Lesson 2), which exists for every $x$.` },
    ],
  };
};

const intervalOfConvergence: Generator = (r) => {
  const kind = r.int(0, 5);
  const a = r.pick(CENTERS);
  const b = r.pick([2, 3, 4, 5]);
  const [lo, hi] = [a - b, a + b];
  const u = shift(a);
  const ua = absShift(a);
  const prompt = (term: string) =>
    md`Find the interval of convergence of $\displaystyle\sum_{n=1}^{\infty} ${term}$. Check the endpoints. Type an inequality like $-1 \le x < 5$, or interval notation like $[-1, 5)$.`;
  const radius = (extra: string): Step[] => [
    { math: md`\left|\frac{a_{n+1}}{a_n}\right| \to \frac{${ua}}{${b}}`, note: md`Ratio test${extra}.` },
    { math: md`${ua} < ${b} \;\Rightarrow\; ${lo} < x < ${hi}`, note: md`$R = ${b}$ about the center $${a}$. Now the two endpoints, where the ratio test says nothing.` },
  ];
  const at = (x: number, u: string) => md`x = ${x}: \; ${u}`;
  if (kind === 0 || kind === 4) {
    const term = kind === 0 ? md`\frac{${u}^n}{${b}^n}` : md`\frac{n \, ${u}^n}{${b}^n}`;
    const t = kind === 0 ? "1" : "n";
    return {
      prompt: prompt(term),
      answer: `${lo} < x < ${hi}`,
      form: "inequality",
      hint: md`$R = ${b}$. At each endpoint, do the terms even go to 0?`,
      solution: [
        ...radius(kind === 0 ? "; the ratio is exactly $\\frac{" + ua + "}{" + b + "}$" : "; $\\frac{n+1}{n} \\to 1$"),
        { math: at(hi, md`\sum ${t === "1" ? "1" : "n"}`), note: md`$${u} = ${b}$, so $\frac{${u}^n}{${b}^n} = 1$. The terms don't go to 0: diverges by the divergence test.` },
        { math: at(lo, md`\sum (-1)^n ${t === "1" ? "" : "n"}`), note: md`$${u} = -${b}$ gives $(-1)^n$. The terms still don't go to 0: diverges.` },
        { math: md`${lo} < x < ${hi}`, note: "Both endpoints excluded." },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: prompt(md`\frac{${u}^n}{n \cdot ${b}^n}`),
      answer: `${lo} <= x < ${hi}`,
      form: "inequality",
      hint: md`$R = ${b}$. One endpoint gives the harmonic series, the other the alternating harmonic series.`,
      solution: [
        ...radius("; $\\frac{n}{n+1} \\to 1$"),
        { math: at(hi, md`\sum \frac{${b}^n}{n \cdot ${b}^n} = \sum \frac{1}{n}`), note: "Harmonic series: diverges. Endpoint excluded." },
        { math: at(lo, md`\sum \frac{(-${b})^n}{n \cdot ${b}^n} = \sum \frac{(-1)^n}{n}`), note: "Alternating harmonic series: converges by the alternating series test. Endpoint included." },
        { math: md`${lo} \le x < ${hi}`, note: "Closed on the left, open on the right." },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: prompt(md`\frac{(-1)^n ${u}^n}{n \cdot ${b}^n}`),
      answer: `${lo} < x <= ${hi}`,
      form: "inequality",
      hint: md`$R = ${b}$. The $(-1)^n$ swaps which endpoint alternates.`,
      solution: [
        ...radius("; the $(-1)^n$ disappears inside the absolute value"),
        { math: at(hi, md`\sum \frac{(-1)^n ${b}^n}{n \cdot ${b}^n} = \sum \frac{(-1)^n}{n}`), note: "Alternating harmonic series: converges. Endpoint included." },
        { math: at(lo, md`\sum \frac{(-1)^n (-${b})^n}{n \cdot ${b}^n} = \sum \frac{(-1)^n (-1)^n}{n} = \sum \frac{1}{n}`), note: md`$(-1)^n(-1)^n = 1$. Harmonic series: diverges. Endpoint excluded.` },
        { math: md`${lo} < x \le ${hi}`, note: "Open on the left, closed on the right." },
      ],
    };
  }
  if (kind === 3) {
    return {
      prompt: prompt(md`\frac{${u}^n}{n^2 \, ${b}^n}`),
      answer: `${lo} <= x <= ${hi}`,
      form: "inequality",
      hint: md`$R = ${b}$. At both endpoints you get a $p$-series with $p = 2$, up to sign.`,
      solution: [
        ...radius("; $\\left(\\frac{n}{n+1}\\right)^2 \\to 1$"),
        { math: at(hi, md`\sum \frac{1}{n^2}`), note: md`$p$-series with $p = 2 > 1$: converges. Included.` },
        { math: at(lo, md`\sum \frac{(-1)^n}{n^2}`), note: md`Converges absolutely, since $\sum \frac{1}{n^2}$ does. Included.` },
        { math: md`${lo} \le x \le ${hi}`, note: "Both endpoints included." },
      ],
    };
  }
  return {
    prompt: prompt(md`\frac{${u}^n}{\sqrt{n} \, ${b}^n}`),
    answer: `${lo} <= x < ${hi}`,
    form: "inequality",
    hint: md`$R = ${b}$. At the right endpoint the series is $\sum n^{-1/2}$, a $p$-series with $p = \frac12$.`,
    solution: [
      ...radius("; $\\sqrt{\\frac{n}{n+1}} \\to 1$"),
      { math: at(hi, md`\sum \frac{1}{\sqrt{n}}`), note: md`$p$-series with $p = \frac12 \le 1$: diverges. Excluded.` },
      { math: at(lo, md`\sum \frac{(-1)^n}{\sqrt{n}}`), note: md`Alternating, with $\frac{1}{\sqrt n}$ decreasing to 0: converges by the alternating series test. Included.` },
      { math: md`${lo} \le x < ${hi}`, note: "Closed on the left, open on the right." },
    ],
  };
};

const geometricClosedForm: Generator = (r) => {
  const kind = r.int(0, 5);
  const b = r.pick([2, 3, 4, 5]);
  const prompt = (term: string, example: string) =>
    md`The power series $\displaystyle\sum_{n=0}^{\infty} ${term}$ is geometric. Find the function $f(x)$ it converges to on its interval of convergence. Give a single expression in $x$, such as ${example}.`;
  const sum = (first: string, ratio: string) => ({ math: md`\sum_{n=0}^{\infty} a r^n = \frac{a}{1 - r} \quad\text{with } a = ${first},\; r = ${ratio}`, note: "Geometric series: first term over one minus the ratio, valid for $|r| < 1$." });
  if (kind === 0) {
    return {
      prompt: prompt(md`${b}^n x^n`, "1/(1 - 3x)"),
      answer: `1/(1 - ${b}x)`,
      verify: [`y = 1 + ${b}x*y`],
      hint: md`$${b}^n x^n = (${b}x)^n$: a geometric series with ratio $${b}x$.`,
      solution: [
        { math: md`\sum_{n=0}^{\infty} (${b}x)^n`, note: md`Combine the powers: the ratio is $r = ${b}x$ and the first term is 1.` },
        sum("1", md`${b}x`),
        { math: md`f(x) = \frac{1}{1 - ${b}x}, \quad |x| < \frac{1}{${b}}`, note: md`Converges where $|${b}x| < 1$.` },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: prompt(md`\frac{(-1)^n x^n}{${b}^n}`, "3/(3 + x)"),
      answer: `${b}/(${b} + x)`,
      verify: [`y = 1 - (x/${b})*y`],
      hint: md`$\frac{(-1)^n x^n}{${b}^n} = \left(-\frac{x}{${b}}\right)^n$.`,
      solution: [
        { math: md`\sum_{n=0}^{\infty} \left(-\frac{x}{${b}}\right)^n`, note: md`Ratio $r = -\frac{x}{${b}}$, first term 1.` },
        sum("1", md`-\frac{x}{${b}}`),
        { math: md`f(x) = \frac{1}{1 + \frac{x}{${b}}} = \frac{${b}}{${b} + x}, \quad |x| < ${b}`, note: md`Multiply top and bottom by $${b}$.` },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: prompt(md`\frac{x^{2n}}{${b}^n}`, "4/(4 - x^2)"),
      answer: `${b}/(${b} - x^2)`,
      verify: [`y = 1 + (x^2/${b})*y`],
      hint: md`$x^{2n} = (x^2)^n$, so the ratio is $\frac{x^2}{${b}}$.`,
      solution: [
        { math: md`\sum_{n=0}^{\infty} \left(\frac{x^2}{${b}}\right)^n`, note: md`Ratio $r = \frac{x^2}{${b}}$, first term 1.` },
        sum("1", md`\frac{x^2}{${b}}`),
        { math: md`f(x) = \frac{1}{1 - \frac{x^2}{${b}}} = \frac{${b}}{${b} - x^2}, \quad x^2 < ${b}`, note: md`Converges for $|x| < \sqrt{${b}}$.` },
      ],
    };
  }
  if (kind === 3) {
    return {
      prompt: prompt(md`\frac{x^{n+1}}{${b}^n}`, "2x/(2 - x)"),
      answer: `${b}x/(${b} - x)`,
      verify: [`y = x + (x/${b})*y`],
      hint: md`The first term ($n = 0$) is $x$, not 1. The ratio is $\frac{x}{${b}}$.`,
      solution: [
        { math: md`x + \frac{x^2}{${b}} + \frac{x^3}{${b}^2} + \cdots = \sum_{n=0}^{\infty} x \left(\frac{x}{${b}}\right)^n`, note: md`First term $a = x$, ratio $r = \frac{x}{${b}}$.` },
        sum("x", md`\frac{x}{${b}}`),
        { math: md`f(x) = \frac{x}{1 - \frac{x}{${b}}} = \frac{${b}x}{${b} - x}, \quad |x| < ${b}`, note: md`Multiply top and bottom by $${b}$.` },
      ],
    };
  }
  if (kind === 4) {
    const a = r.pick([1, 2, -1, 3]);
    const u = shift(a);
    return {
      prompt: prompt(md`\frac{${u}^n}{${b}^n}`, "3/(5 - x)"),
      answer: `${b}/(${b + a} - x)`,
      verify: [`y = 1 + (${u}/${b})*y`],
      hint: md`Ratio $r = \frac{${u}}{${b}}$. Sum, then tidy the denominator.`,
      solution: [
        { math: md`\sum_{n=0}^{\infty} \left(\frac{${u}}{${b}}\right)^n`, note: md`Ratio $r = \frac{${u}}{${b}}$, first term 1.` },
        sum("1", md`\frac{${u}}{${b}}`),
        { math: md`f(x) = \frac{1}{1 - \frac{${u}}{${b}}} = \frac{${b}}{${b} - ${u}} = \frac{${b}}{${b + a} - x}, \quad ${absShift(a)} < ${b}`, note: md`Multiply top and bottom by $${b}$, then simplify $${b} - ${u}$.` },
      ],
    };
  }
  return {
    prompt: prompt(md`\frac{x^n}{${b}^n}`, "2/(2 - x)"),
    answer: `${b}/(${b} - x)`,
    verify: [`y = 1 + (x/${b})*y`],
    hint: md`$\frac{x^n}{${b}^n} = \left(\frac{x}{${b}}\right)^n$.`,
    solution: [
      { math: md`\sum_{n=0}^{\infty} \left(\frac{x}{${b}}\right)^n`, note: md`Ratio $r = \frac{x}{${b}}$, first term 1.` },
      sum("1", md`\frac{x}{${b}}`),
      { math: md`f(x) = \frac{1}{1 - \frac{x}{${b}}} = \frac{${b}}{${b} - x}, \quad |x| < ${b}`, note: md`Multiply top and bottom by $${b}$.` },
    ],
  };
};

// ── Lesson 2: Taylor and Maclaurin series ──────────────────────────────────

/** A function with its first few derivatives (LaTeX) and their values at 0. */
interface MacFn {
  tex: string;
  derivs: string[];
  at0: Q[];
  known: string;
}

function pickMacFn(r: Rng): { fn: MacFn; n: number } {
  const which = r.int(0, 5);
  if (which === 0) {
    const k = r.pick([2, 3, -1, -2]);
    const kx = kxTex(k);
    return {
      fn: {
        tex: `e^{${kx}}`,
        derivs: [1, 2, 3].map((j) => `${coefTex(k ** j)} e^{${kx}}`),
        at0: [0, 1, 2, 3].map((j) => q(k ** j)),
        known: md`Or substitute $u = ${kx}$ into $e^u = 1 + u + \frac{u^2}{2} + \frac{u^3}{6} + \cdots$.`,
      },
      n: r.int(2, 3),
    };
  }
  if (which === 1) {
    const k = r.pick([2, 3]);
    return {
      fn: {
        tex: `\\sin(${k}x)`,
        derivs: [`${k}\\cos(${k}x)`, `-${k * k}\\sin(${k}x)`, `-${k ** 3}\\cos(${k}x)`],
        at0: [q(0), q(k), q(0), q(-(k ** 3))],
        known: md`Or substitute $u = ${k}x$ into $\sin u = u - \frac{u^3}{6} + \cdots$.`,
      },
      n: 3,
    };
  }
  if (which === 2) {
    const k = r.pick([2, 3]);
    return {
      fn: {
        tex: `\\cos(${k}x)`,
        derivs: [`-${k}\\sin(${k}x)`, `-${k * k}\\cos(${k}x)`, `${k ** 3}\\sin(${k}x)`, `${k ** 4}\\cos(${k}x)`],
        at0: [q(1), q(0), q(-(k * k)), q(0), q(k ** 4)],
        known: md`Or substitute $u = ${k}x$ into $\cos u = 1 - \frac{u^2}{2} + \frac{u^4}{24} - \cdots$.`,
      },
      n: r.pick([2, 4]),
    };
  }
  if (which === 3) {
    const k = r.pick([2, 3]);
    return {
      fn: {
        tex: `\\frac{1}{1 - ${k}x}`,
        derivs: [`\\frac{${k}}{(1 - ${k}x)^2}`, `\\frac{${2 * k * k}}{(1 - ${k}x)^3}`, `\\frac{${6 * k ** 3}}{(1 - ${k}x)^4}`],
        at0: [q(1), q(k), q(2 * k * k), q(6 * k ** 3)],
        known: md`Or use the geometric series with ratio $${k}x$: $\sum (${k}x)^n$.`,
      },
      n: 3,
    };
  }
  if (which === 4) {
    const k = r.pick([1, 2]);
    const kx = kxTex(k);
    return {
      fn: {
        tex: `\\ln(1 + ${kx})`,
        derivs: [`\\frac{${k}}{1 + ${kx}}`, `-\\frac{${k * k}}{(1 + ${kx})^2}`, `\\frac{${2 * k ** 3}}{(1 + ${kx})^3}`],
        at0: [q(0), q(k), q(-k * k), q(2 * k ** 3)],
        known: md`Or substitute $u = ${kx}$ into $\ln(1 + u) = u - \frac{u^2}{2} + \frac{u^3}{3} - \cdots$.`,
      },
      n: 3,
    };
  }
  return {
    fn: {
      tex: `\\sqrt{1 + x}`,
      derivs: [`\\frac{1}{2\\sqrt{1 + x}}`, `-\\frac{1}{4(1 + x)^{3/2}}`, `\\frac{3}{8(1 + x)^{5/2}}`],
      at0: [q(1), q(1, 2), q(-1, 4), q(3, 8)],
      known: md`Each derivative of $(1 + x)^{1/2}$ lowers the exponent by 1 and multiplies by the old exponent.`,
    },
    n: r.int(2, 3),
  };
}

/** Taylor polynomials about a nonzero center, written out by hand. */
const TAYLOR_TABLE: { f: string; a: string; n: number; derivs: string; values: string; coefs: string; tex: string; text: string; note: string }[] = [
  {
    f: "\\ln x", a: "1", n: 3,
    derivs: md`f'(x) = \frac{1}{x},\quad f''(x) = -\frac{1}{x^2},\quad f'''(x) = \frac{2}{x^3}`,
    values: md`f(1) = 0,\quad f'(1) = 1,\quad f''(1) = -1,\quad f'''(1) = 2`,
    coefs: md`c_0 = 0,\quad c_1 = 1,\quad c_2 = -\frac{1}{2},\quad c_3 = \frac{2}{6} = \frac13`,
    tex: "(x - 1) - \\frac{(x - 1)^2}{2} + \\frac{(x - 1)^3}{3}", text: "(x - 1) - (x - 1)^2/2 + (x - 1)^3/3",
    note: md`This is the $\ln(1 + u)$ series with $u = x - 1$, as it must be.`,
  },
  {
    f: "\\ln x", a: "2", n: 2,
    derivs: md`f'(x) = \frac{1}{x},\quad f''(x) = -\frac{1}{x^2}`,
    values: md`f(2) = \ln 2,\quad f'(2) = \frac12,\quad f''(2) = -\frac14`,
    coefs: md`c_0 = \ln 2,\quad c_1 = \frac12,\quad c_2 = -\frac{1}{8}`,
    tex: "\\ln 2 + \\frac{x - 2}{2} - \\frac{(x - 2)^2}{8}", text: "ln(2) + (x - 2)/2 - (x - 2)^2/8",
    note: md`Type $\ln 2$ as **ln(2)**.`,
  },
  {
    f: "\\sqrt{x}", a: "4", n: 2,
    derivs: md`f'(x) = \frac{1}{2\sqrt{x}},\quad f''(x) = -\frac{1}{4x^{3/2}}`,
    values: md`f(4) = 2,\quad f'(4) = \frac14,\quad f''(4) = -\frac{1}{32}`,
    coefs: md`c_0 = 2,\quad c_1 = \frac14,\quad c_2 = -\frac{1}{64}`,
    tex: "2 + \\frac{x - 4}{4} - \\frac{(x - 4)^2}{64}", text: "2 + (x - 4)/4 - (x - 4)^2/64",
    note: md`Try it: $T_2(4.1) \approx 2.02485$, and $\sqrt{4.1} = 2.02485\ldots$.`,
  },
  {
    f: "\\sqrt{x}", a: "9", n: 2,
    derivs: md`f'(x) = \frac{1}{2\sqrt{x}},\quad f''(x) = -\frac{1}{4x^{3/2}}`,
    values: md`f(9) = 3,\quad f'(9) = \frac16,\quad f''(9) = -\frac{1}{108}`,
    coefs: md`c_0 = 3,\quad c_1 = \frac16,\quad c_2 = -\frac{1}{216}`,
    tex: "3 + \\frac{x - 9}{6} - \\frac{(x - 9)^2}{216}", text: "3 + (x - 9)/6 - (x - 9)^2/216",
    note: md`$x^{3/2} = 27$ at $x = 9$, so $f''(9) = -\frac{1}{4 \cdot 27}$.`,
  },
  {
    f: "\\frac{1}{x}", a: "2", n: 3,
    derivs: md`f'(x) = -\frac{1}{x^2},\quad f''(x) = \frac{2}{x^3},\quad f'''(x) = -\frac{6}{x^4}`,
    values: md`f(2) = \frac12,\quad f'(2) = -\frac14,\quad f''(2) = \frac{2}{8} = \frac14,\quad f'''(2) = -\frac{6}{16} = -\frac38`,
    coefs: md`c_0 = \frac12,\quad c_1 = -\frac14,\quad c_2 = \frac{1}{8},\quad c_3 = -\frac{3/8}{6} = -\frac{1}{16}`,
    tex: "\\frac12 - \\frac{x - 2}{4} + \\frac{(x - 2)^2}{8} - \\frac{(x - 2)^3}{16}", text: "1/2 - (x - 2)/4 + (x - 2)^2/8 - (x - 2)^3/16",
    note: md`Each coefficient is the previous one times $-\frac12$: it is a geometric series in $(x - 2)$ with ratio $-\frac{x-2}{2}$.`,
  },
  {
    f: "\\frac{1}{x}", a: "1", n: 3,
    derivs: md`f'(x) = -\frac{1}{x^2},\quad f''(x) = \frac{2}{x^3},\quad f'''(x) = -\frac{6}{x^4}`,
    values: md`f(1) = 1,\quad f'(1) = -1,\quad f''(1) = 2,\quad f'''(1) = -6`,
    coefs: md`c_0 = 1,\quad c_1 = -1,\quad c_2 = \frac{2}{2} = 1,\quad c_3 = -\frac{6}{6} = -1`,
    tex: "1 - (x - 1) + (x - 1)^2 - (x - 1)^3", text: "1 - (x - 1) + (x - 1)^2 - (x - 1)^3",
    note: md`Check: $\frac{1}{x} = \frac{1}{1 + (x - 1)}$ is a geometric series with ratio $-(x - 1)$.`,
  },
  {
    f: "e^x", a: "1", n: 2,
    derivs: md`f'(x) = e^x,\quad f''(x) = e^x`,
    values: md`f(1) = e,\quad f'(1) = e,\quad f''(1) = e`,
    coefs: md`c_0 = e,\quad c_1 = e,\quad c_2 = \frac{e}{2}`,
    tex: "e + e(x - 1) + \\frac{e}{2}(x - 1)^2", text: "e + e(x - 1) + (e/2)(x - 1)^2",
    note: md`Every coefficient carries a factor $e = f(1)$. Type it as **e**.`,
  },
  {
    f: "e^x", a: "2", n: 3,
    derivs: md`f'(x) = e^x,\quad f''(x) = e^x,\quad f'''(x) = e^x`,
    values: md`f(2) = e^2,\quad f'(2) = e^2,\quad f''(2) = e^2,\quad f'''(2) = e^2`,
    coefs: md`c_0 = e^2,\quad c_1 = e^2,\quad c_2 = \frac{e^2}{2},\quad c_3 = \frac{e^2}{6}`,
    tex: "e^2 + e^2(x - 2) + \\frac{e^2}{2}(x - 2)^2 + \\frac{e^2}{6}(x - 2)^3", text: "e^2 + e^2 (x - 2) + (e^2/2)(x - 2)^2 + (e^2/6)(x - 2)^3",
    note: md`Equivalently $e^2 \cdot T_3^{\,e^u}(x - 2)$: shifting $e^x$ just multiplies by $e^2$.`,
  },
  {
    f: "\\sin x", a: "\\frac{\\pi}{2}", n: 2,
    derivs: md`f'(x) = \cos x,\quad f''(x) = -\sin x`,
    values: md`f\!\left(\tfrac{\pi}{2}\right) = 1,\quad f'\!\left(\tfrac{\pi}{2}\right) = 0,\quad f''\!\left(\tfrac{\pi}{2}\right) = -1`,
    coefs: md`c_0 = 1,\quad c_1 = 0,\quad c_2 = -\frac12`,
    tex: "1 - \\frac12\\left(x - \\frac{\\pi}{2}\\right)^2", text: "1 - (x - pi/2)^2/2",
    note: md`Near its peak, sine looks like an upside-down parabola. Type $\pi$ as **pi**.`,
  },
  {
    f: "\\cos x", a: "\\pi", n: 2,
    derivs: md`f'(x) = -\sin x,\quad f''(x) = -\cos x`,
    values: md`f(\pi) = -1,\quad f'(\pi) = 0,\quad f''(\pi) = 1`,
    coefs: md`c_0 = -1,\quad c_1 = 0,\quad c_2 = \frac12`,
    tex: "-1 + \\frac12 (x - \\pi)^2", text: "-1 + (x - pi)^2/2",
    note: md`At its minimum, cosine looks like a parabola opening up.`,
  },
  {
    f: "\\sin x", a: "\\pi", n: 3,
    derivs: md`f'(x) = \cos x,\quad f''(x) = -\sin x,\quad f'''(x) = -\cos x`,
    values: md`f(\pi) = 0,\quad f'(\pi) = -1,\quad f''(\pi) = 0,\quad f'''(\pi) = 1`,
    coefs: md`c_0 = 0,\quad c_1 = -1,\quad c_2 = 0,\quad c_3 = \frac16`,
    tex: "-(x - \\pi) + \\frac{(x - \\pi)^3}{6}", text: "-(x - pi) + (x - pi)^3/6",
    note: md`It is $-\sin(x - \pi)$'s series, since $\sin x = -\sin(x - \pi)$.`,
  },
  {
    f: "\\cos x", a: "\\frac{\\pi}{2}", n: 3,
    derivs: md`f'(x) = -\sin x,\quad f''(x) = -\cos x,\quad f'''(x) = \sin x`,
    values: md`f\!\left(\tfrac{\pi}{2}\right) = 0,\quad f'\!\left(\tfrac{\pi}{2}\right) = -1,\quad f''\!\left(\tfrac{\pi}{2}\right) = 0,\quad f'''\!\left(\tfrac{\pi}{2}\right) = 1`,
    coefs: md`c_0 = 0,\quad c_1 = -1,\quad c_2 = 0,\quad c_3 = \frac16`,
    tex: "-\\left(x - \\frac{\\pi}{2}\\right) + \\frac16\\left(x - \\frac{\\pi}{2}\\right)^3", text: "-(x - pi/2) + (x - pi/2)^3/6",
    note: md`$\cos x = -\sin(x - \frac{\pi}{2})$, so this is minus the sine series in $x - \frac{\pi}{2}$.`,
  },
];

/** Coefficient c_n of x^n in a standard Maclaurin series. */
const COEF_TABLE: { tex: string; ns: number[]; c: (n: number) => Q; series: string; term: string }[] = [
  { tex: "e^{2x}", ns: [3, 4, 5], c: (n) => q(2 ** n, fact(n)), series: md`e^{2x} = \sum_{n=0}^{\infty} \frac{(2x)^n}{n!}`, term: md`\frac{2^n x^n}{n!}` },
  { tex: "e^{3x}", ns: [3, 4], c: (n) => q(3 ** n, fact(n)), series: md`e^{3x} = \sum_{n=0}^{\infty} \frac{(3x)^n}{n!}`, term: md`\frac{3^n x^n}{n!}` },
  { tex: "e^{-2x}", ns: [3, 4, 5], c: (n) => q((-2) ** n, fact(n)), series: md`e^{-2x} = \sum_{n=0}^{\infty} \frac{(-2x)^n}{n!}`, term: md`\frac{(-2)^n x^n}{n!}` },
  { tex: "\\sin x", ns: [3, 5, 7, 4, 6], c: (n) => (n % 2 ? q((-1) ** ((n - 1) / 2), fact(n)) : q(0)), series: md`\sin x = \sum_{k=0}^{\infty} \frac{(-1)^k x^{2k+1}}{(2k+1)!}`, term: md`\frac{(-1)^k x^{2k+1}}{(2k+1)!}` },
  { tex: "\\cos x", ns: [4, 6, 3, 5], c: (n) => (n % 2 ? q(0) : q((-1) ** (n / 2), fact(n))), series: md`\cos x = \sum_{k=0}^{\infty} \frac{(-1)^k x^{2k}}{(2k)!}`, term: md`\frac{(-1)^k x^{2k}}{(2k)!}` },
  { tex: "\\frac{1}{1 - 2x}", ns: [3, 4, 5], c: (n) => q(2 ** n), series: md`\frac{1}{1 - 2x} = \sum_{n=0}^{\infty} (2x)^n`, term: md`2^n x^n` },
  { tex: "\\frac{1}{1 - 3x}", ns: [3, 4], c: (n) => q(3 ** n), series: md`\frac{1}{1 - 3x} = \sum_{n=0}^{\infty} (3x)^n`, term: md`3^n x^n` },
  { tex: "\\ln(1 + x)", ns: [3, 4, 5, 6], c: (n) => q((-1) ** (n + 1), n), series: md`\ln(1 + x) = \sum_{n=1}^{\infty} \frac{(-1)^{n+1} x^n}{n}`, term: md`\frac{(-1)^{n+1} x^n}{n}` },
  { tex: "\\ln(1 + 2x)", ns: [3, 4], c: (n) => q((-1) ** (n + 1) * 2 ** n, n), series: md`\ln(1 + 2x) = \sum_{n=1}^{\infty} \frac{(-1)^{n+1} (2x)^n}{n}`, term: md`\frac{(-1)^{n+1} 2^n x^n}{n}` },
  { tex: "x e^{x}", ns: [3, 4, 5], c: (n) => q(1, fact(n - 1)), series: md`x e^x = x \sum_{k=0}^{\infty} \frac{x^k}{k!} = \sum_{k=0}^{\infty} \frac{x^{k+1}}{k!}`, term: md`\frac{x^{k+1}}{k!}` },
  { tex: "e^{-x^2}", ns: [4, 6, 8, 3, 5], c: (n) => (n % 2 ? q(0) : q((-1) ** (n / 2), fact(n / 2))), series: md`e^{-x^2} = \sum_{k=0}^{\infty} \frac{(-x^2)^k}{k!} = \sum_{k=0}^{\infty} \frac{(-1)^k x^{2k}}{k!}`, term: md`\frac{(-1)^k x^{2k}}{k!}` },
  { tex: "\\arctan x", ns: [3, 5, 7, 4], c: (n) => (n % 2 ? q((-1) ** ((n - 1) / 2), n) : q(0)), series: md`\arctan x = \sum_{k=0}^{\infty} \frac{(-1)^k x^{2k+1}}{2k+1}`, term: md`\frac{(-1)^k x^{2k+1}}{2k+1}` },
  { tex: "\\frac{1}{1 + x^2}", ns: [4, 6, 3], c: (n) => (n % 2 ? q(0) : q((-1) ** (n / 2))), series: md`\frac{1}{1 + x^2} = \sum_{k=0}^{\infty} (-x^2)^k = \sum_{k=0}^{\infty} (-1)^k x^{2k}`, term: md`(-1)^k x^{2k}` },
];

const taylorPolynomial: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const { fn, n } = pickMacFn(r);
    const terms: Term[] = fn.at0.slice(0, n + 1).map((v, j) => ({ c: qMul(v, q(1, fact(j))), k: j }));
    const list = (f: (j: number) => string, from: number) => Array.from({ length: n + 1 - from }, (_, i) => f(i + from)).join(",\\quad ");
    return {
      prompt: md`Find the Maclaurin polynomial $T_{${n}}(x)$ of $f(x) = ${fn.tex}$. Write it as an expanded polynomial in $x$, with exact fractions.`,
      answer: termsText(terms),
      expanded: true,
      hint: md`$c_j = \frac{f^{(j)}(0)}{j!}$: differentiate $${n}$ times, evaluate each derivative at 0, divide by the factorial. ${fn.known}`,
      solution: [
        { math: list((j) => `${primes(j)}(x) = ${fn.derivs[j - 1]}`, 1), note: md`Differentiate ${n} times.` },
        { math: list((j) => `${primes(j)}(0) = ${qTex(fn.at0[j]!)}`, 0), note: "Evaluate at the center, 0." },
        { math: list((j) => `c_${j} = \\frac{${qTex(fn.at0[j]!)}}{${j}!} = ${qTex(terms[j]!.c)}`, 0), note: md`$c_j = \frac{f^{(j)}(0)}{j!}$.` },
        { math: md`T_{${n}}(x) = ${termsTex(terms)}`, note: fn.known },
      ],
    };
  }
  if (kind === 1) {
    const e = r.pick(TAYLOR_TABLE);
    const u = `(x - ${e.a})`;
    return {
      prompt: md`Find the Taylor polynomial $T_{${e.n}}(x)$ of $f(x) = ${e.f}$ about $a = ${e.a}$. You may leave it in powers of $${u}$, like 2 + (x - 4)/4.`,
      answer: e.text,
      hint: md`$c_j = \frac{f^{(j)}(${e.a})}{j!}$. Find the derivatives, evaluate them at $${e.a}$, divide by the factorials.`,
      solution: [
        { math: e.derivs, note: md`Differentiate ${e.n} times.` },
        { math: e.values, note: md`Evaluate at the center $a = ${e.a}$.` },
        { math: e.coefs, note: md`Divide $f^{(j)}(a)$ by $j!$.` },
        { math: md`T_{${e.n}}(x) = ${e.tex}`, note: e.note },
      ],
    };
  }
  const e = r.pick(COEF_TABLE);
  const n = r.pick(e.ns);
  const c = e.c(n);
  const isZero = c[0] === 0;
  return {
    prompt: md`Find the coefficient $c_{${n}}$ of $x^{${n}}$ in the Maclaurin series of $f(x) = ${e.tex}$. Give an exact fraction.`,
    answer: qText(c),
    simplified: true,
    hint: md`Don't differentiate ${n} times. Start from a series you know and find the term whose power is $x^{${n}}$.${isZero ? " It may not be there." : ""}`,
    solution: [
      { math: e.series, note: "Standard series, with the substitution already made." },
      { math: md`\text{general term: } ${e.term}`, note: isZero ? md`Only ${n % 2 ? "even" : "odd"} powers of $x$ appear.` : md`Set the exponent equal to ${n}.` },
      isZero
        ? { math: md`c_{${n}} = 0`, note: md`There is no $x^{${n}}$ term, so its coefficient is 0. (Equivalently $f^{(${n})}(0) = 0$.)` }
        : { math: md`c_{${n}} = ${qTex(c)}`, note: md`The coefficient formula agrees: $f^{(${n})}(0) = ${n}! \cdot c_{${n}} = ${qTex(qMul(c, q(fact(n))))}$.` },
    ],
  };
};

const polynomialRecentered: Generator = (r) => {
  const deg = r.int(2, 3);
  const a = r.pick([-2, -1, 1, 2, 3]);
  const p = deg === 3 ? [r.int(-5, 5), r.int(-4, 4), r.int(-3, 3), r.pick([1, -1, 2])] : [r.int(-5, 5), r.int(-4, 4), r.pick([1, -1, 2, 3])];
  const evalAt = (coeffs: number[], x: number) => coeffs.reduce((s, c, j) => s + c * x ** j, 0);
  const deriv = (coeffs: number[]) => coeffs.slice(1).map((c, j) => c * (j + 1));
  const tex = (coeffs: number[]) => poly(coeffs.map((c, j) => [c, j === 0 ? "" : j === 1 ? "x" : `x^${j}`] as [number, string]).reverse());
  const ds = [p];
  for (let j = 1; j <= deg; j++) ds.push(deriv(ds[j - 1]!));
  const cs = ds.map((d, j) => evalAt(d, a) / fact(j));
  const u = shift(a);
  const letters = ["a", "b", "c", "d"].slice(0, deg + 1);
  const combo = (h: number) => letters.map((L, j) => (j === 0 ? L : h ** j === 1 ? L : `${h ** j}${L}`)).join(" + ").replace(/\+ -/g, "- ");
  const verify = (deg === 3 ? [-2, -1, 1, 2] : [-1, 1, 2]).map((h) => `${combo(h)} = ${evalAt(p, a + h)}`);
  const sumTex = cs.map((c, j) => [c, j === 0 ? "" : j === 1 ? u : `${u}^${j}`] as [number, string]);
  return {
    prompt: md`Find the Taylor series of $p(x) = ${tex(p)}$ about $a = ${a}$. A polynomial's Taylor series is finite: give its coefficients as $(${letters.map((_, j) => `c_${j}`).join(", ")})$, where $p(x) = ${letters.map((_, j) => (j === 0 ? "c_0" : `c_${j}${powTex(u, j)}`)).join(" + ")}$.`,
    answer: `(${cs.join(", ")})`,
    form: "tuple",
    verify,
    hint: md`$c_j = \frac{p^{(j)}(${a})}{j!}$. The leading coefficient never changes, and $c_0 = p(${a})$.`,
    solution: [
      { math: md`c_0 = p(${a}) = ${cs[0]}`, note: "Evaluate the polynomial at the center." },
      { math: md`p'(x) = ${tex(ds[1]!)}, \quad c_1 = p'(${a}) = ${cs[1]}`, note: "First derivative at the center." },
      { math: md`p''(x) = ${tex(ds[2]!)}, \quad c_2 = \frac{p''(${a})}{2!} = \frac{${evalAt(ds[2]!, a)}}{2} = ${cs[2]}`, note: "Second derivative, divided by 2." },
      ...(deg === 3 ? [{ math: md`p'''(x) = ${tex(ds[3]!)}, \quad c_3 = \frac{p'''(${a})}{3!} = \frac{${evalAt(ds[3]!, a)}}{6} = ${cs[3]}`, note: "The third derivative of a cubic is constant, so $c_3$ is the leading coefficient." }] : []),
      { math: md`p(x) = ${poly(sumTex)}`, note: md`Multiply out to check that it reproduces $${tex(p)}$. Every higher derivative is 0, so the series stops here and the equality is exact for all $x$.` },
    ],
  };
};

const closedFormByOperations: Generator = (r) => {
  const kind = r.int(0, 6);
  const prompt = (term: string, from: number, where: string) =>
    md`Starting from $\sum_{n=0}^{\infty} x^n = \frac{1}{1 - x}$, use term-by-term differentiation (and multiplication by powers of $x$ where needed) to find a closed form for $\displaystyle\sum_{n=${from}}^{\infty} ${term}$ for ${where}. Give a single expression in $x$.`;
  const diff: Step = { math: md`\frac{d}{dx} \frac{1}{1 - x} = \frac{1}{(1 - x)^2} = \sum_{n=1}^{\infty} n x^{n-1}`, note: "Differentiate both sides term by term; the constant term disappears. Same radius, 1." };
  if (kind === 0) {
    return {
      prompt: prompt(md`n x^{n-1}`, 1, "$|x| < 1$"),
      answer: "1/(1 - x)^2",
      verify: ["y - x*y = 1/(1 - x)"],
      hint: md`The series is the derivative of $\sum x^n$, term by term.`,
      solution: [diff, { math: md`\sum_{n=1}^{\infty} n x^{n-1} = \frac{1}{(1 - x)^2}`, note: md`Check at $x = \frac12$: $1 + 1 + \frac34 + \frac12 + \cdots = 4$.` }],
    };
  }
  if (kind === 1 || kind === 3) {
    const term = kind === 1 ? md`n x^{n}` : md`(n + 1) x^{n}`;
    return kind === 1
      ? {
          prompt: prompt(term, 1, "$|x| < 1$"),
          answer: "x/(1 - x)^2",
          verify: ["y - x*y = x/(1 - x)"],
          hint: md`Differentiate to get $\sum n x^{n-1}$, then multiply by $x$ to raise every power by one.`,
          solution: [diff, { math: md`\sum_{n=1}^{\infty} n x^{n} = x \sum_{n=1}^{\infty} n x^{n-1} = \frac{x}{(1 - x)^2}`, note: md`Multiplying a series by $x$ multiplies every term by $x$. At $x = \frac12$ this gives $\sum \frac{n}{2^n} = 2$.` }],
        }
      : {
          prompt: prompt(term, 0, "$|x| < 1$"),
          answer: "1/(1 - x)^2",
          verify: ["y - x*y = 1/(1 - x)"],
          hint: md`Re-index: $\sum_{n=0}^{\infty} (n+1)x^n = \sum_{m=1}^{\infty} m x^{m-1}$ with $m = n + 1$.`,
          solution: [diff, { math: md`\sum_{n=0}^{\infty} (n+1) x^{n} = 1 + 2x + 3x^2 + \cdots = \sum_{m=1}^{\infty} m x^{m-1} = \frac{1}{(1 - x)^2}`, note: "The same series written with a different starting index." }],
        };
  }
  if (kind === 2) {
    const k = r.pick([2, 3]);
    return {
      prompt: prompt(md`n \, ${k}^n x^{n}`, 1, md`$|x| < \frac{1}{${k}}$`),
      answer: `${k}x/(1 - ${k}x)^2`,
      verify: [`y - ${k}x*y = ${k}x/(1 - ${k}x)`],
      hint: md`Find $\sum n u^n$ first, then put $u = ${k}x$.`,
      solution: [
        diff,
        { math: md`\sum_{n=1}^{\infty} n u^{n} = \frac{u}{(1 - u)^2}`, note: "Multiply the differentiated series by $u$." },
        { math: md`u = ${k}x: \quad \sum_{n=1}^{\infty} n \, ${k}^n x^n = \frac{${k}x}{(1 - ${k}x)^2}`, note: md`Valid for $|${k}x| < 1$.` },
      ],
    };
  }
  if (kind === 4) {
    const b = r.pick([2, 3]);
    return {
      prompt: prompt(md`\frac{n x^{n-1}}{${b}^n}`, 1, md`$|x| < ${b}$`),
      answer: `${b}/(${b} - x)^2`,
      verify: [`y - (x/${b})*y = 1/(${b} - x)`],
      hint: md`Write $\frac{x^{n-1}}{${b}^n} = \frac{1}{${b}} \left(\frac{x}{${b}}\right)^{n-1}$ and use $u = \frac{x}{${b}}$.`,
      solution: [
        diff,
        { math: md`\sum_{n=1}^{\infty} \frac{n x^{n-1}}{${b}^n} = \frac{1}{${b}} \sum_{n=1}^{\infty} n \left(\frac{x}{${b}}\right)^{n-1} = \frac{1}{${b}} \cdot \frac{1}{(1 - x/${b})^2}`, note: md`Pull out one factor of $\frac{1}{${b}}$ so the rest is $n u^{n-1}$ with $u = \frac{x}{${b}}$.` },
        { math: md`= \frac{1}{${b}} \cdot \frac{${b}^2}{(${b} - x)^2} = \frac{${b}}{(${b} - x)^2}`, note: md`Multiply top and bottom by $${b}^2$. This is also the derivative of $\frac{${b}}{${b} - x}$, as it should be.` },
      ],
    };
  }
  if (kind === 5) {
    return {
      prompt: prompt(md`(-1)^n n x^{n}`, 1, "$|x| < 1$"),
      answer: "-x/(1 + x)^2",
      verify: ["y + x*y = -x/(1 + x)"],
      hint: md`$(-1)^n x^n = (-x)^n$. Find $\sum n u^n$ and put $u = -x$.`,
      solution: [
        diff,
        { math: md`\sum_{n=1}^{\infty} n u^{n} = \frac{u}{(1 - u)^2}`, note: "Multiply the differentiated series by $u$." },
        { math: md`u = -x: \quad \sum_{n=1}^{\infty} (-1)^n n x^n = \frac{-x}{(1 + x)^2}`, note: md`At $x = \frac12$: $-\frac12 + \frac24 - \frac38 + \cdots = -\frac{2}{9}$.` },
      ],
    };
  }
  return {
    prompt: prompt(md`n x^{2n}`, 1, "$|x| < 1$"),
    answer: "x^2/(1 - x^2)^2",
    verify: ["y - x^2*y = x^2/(1 - x^2)"],
    hint: md`$x^{2n} = (x^2)^n$. Find $\sum n u^n$ and put $u = x^2$.`,
    solution: [
      diff,
      { math: md`\sum_{n=1}^{\infty} n u^{n} = \frac{u}{(1 - u)^2}`, note: "Multiply the differentiated series by $u$." },
      { math: md`u = x^2: \quad \sum_{n=1}^{\infty} n x^{2n} = \frac{x^2}{(1 - x^2)^2}`, note: md`Valid for $x^2 < 1$, that is $|x| < 1$.` },
    ],
  };
};

// ── Lesson 3: Taylor's remainder ───────────────────────────────────────────

interface MacPoly {
  tex: string;
  n: number;
  terms: Term[];
  /** LaTeX for f at the point: x is the point as LaTeX, xp the same wrapped in parentheses when negative. */
  at: (x: string, xp: string) => string;
  f: (x: number) => number;
}

const MAC_POLYS: MacPoly[] = [
  { tex: "e^x", n: 3, terms: [{ c: q(1), k: 0 }, { c: q(1), k: 1 }, { c: q(1, 2), k: 2 }, { c: q(1, 6), k: 3 }], at: (x) => `e^{${x}}`, f: Math.exp },
  { tex: "e^x", n: 4, terms: [{ c: q(1), k: 0 }, { c: q(1), k: 1 }, { c: q(1, 2), k: 2 }, { c: q(1, 6), k: 3 }, { c: q(1, 24), k: 4 }], at: (x) => `e^{${x}}`, f: Math.exp },
  { tex: "e^{-x}", n: 3, terms: [{ c: q(1), k: 0 }, { c: q(-1), k: 1 }, { c: q(1, 2), k: 2 }, { c: q(-1, 6), k: 3 }], at: (_, xp) => `e^{-${xp}}`, f: (x) => Math.exp(-x) },
  { tex: "\\sin x", n: 3, terms: [{ c: q(1), k: 1 }, { c: q(-1, 6), k: 3 }], at: (x) => `\\sin\\left(${x}\\right)`, f: Math.sin },
  { tex: "\\sin x", n: 5, terms: [{ c: q(1), k: 1 }, { c: q(-1, 6), k: 3 }, { c: q(1, 120), k: 5 }], at: (x) => `\\sin\\left(${x}\\right)`, f: Math.sin },
  { tex: "\\cos x", n: 2, terms: [{ c: q(1), k: 0 }, { c: q(-1, 2), k: 2 }], at: (x) => `\\cos\\left(${x}\\right)`, f: Math.cos },
  { tex: "\\cos x", n: 4, terms: [{ c: q(1), k: 0 }, { c: q(-1, 2), k: 2 }, { c: q(1, 24), k: 4 }], at: (x) => `\\cos\\left(${x}\\right)`, f: Math.cos },
  { tex: "\\ln(1 + x)", n: 3, terms: [{ c: q(1), k: 1 }, { c: q(-1, 2), k: 2 }, { c: q(1, 3), k: 3 }], at: (_, xp) => `\\ln\\left(1 + ${xp}\\right)`, f: (x) => Math.log(1 + x) },
  { tex: "\\ln(1 + x)", n: 4, terms: [{ c: q(1), k: 1 }, { c: q(-1, 2), k: 2 }, { c: q(1, 3), k: 3 }, { c: q(-1, 4), k: 4 }], at: (_, xp) => `\\ln\\left(1 + ${xp}\\right)`, f: (x) => Math.log(1 + x) },
  { tex: "\\arctan x", n: 3, terms: [{ c: q(1), k: 1 }, { c: q(-1, 3), k: 3 }], at: (x) => `\\arctan\\left(${x}\\right)`, f: Math.atan },
  { tex: "\\arctan x", n: 5, terms: [{ c: q(1), k: 1 }, { c: q(-1, 3), k: 3 }, { c: q(1, 5), k: 5 }], at: (x) => `\\arctan\\left(${x}\\right)`, f: Math.atan },
  { tex: "\\frac{1}{1 - x}", n: 3, terms: [{ c: q(1), k: 0 }, { c: q(1), k: 1 }, { c: q(1), k: 2 }, { c: q(1), k: 3 }], at: (_, xp) => `\\frac{1}{1 - ${xp}}`, f: (x) => 1 / (1 - x) },
  { tex: "\\sqrt{1 + x}", n: 2, terms: [{ c: q(1), k: 0 }, { c: q(1, 2), k: 1 }, { c: q(-1, 8), k: 2 }], at: (_, xp) => `\\sqrt{1 + ${xp}}`, f: (x) => Math.sqrt(1 + x) },
];

const evaluateTaylorPolynomial: Generator = (r) => {
  const p = r.pick(MAC_POLYS);
  const x = r.pick<Q>([[1, 2], [1, 3], [1, 4], [1, 5], [-1, 2], [-1, 3], [1, 10], [2, 5]]);
  const pieces = p.terms.map((t) => qMul(t.c, qPow(x, t.k)));
  const value = pieces.reduce(qAdd, q(0));
  const xTex = qTex(x);
  const xParen = x[0] < 0 ? `\\left(${xTex}\\right)` : xTex;
  const truth = p.f(qNum(x));
  return {
    prompt: md`Evaluate $${termsTex(p.terms)}$, the Maclaurin polynomial $T_{${p.n}}$ of $${p.tex}$, when $x = ${xTex}$. It approximates $${p.at(xTex, xParen)}$. Give the exact fraction.`,
    answer: qText(value),
    simplified: true,
    hint: md`Substitute $x = ${xTex}$ into each term, keep everything as fractions, then add over a common denominator.`,
    solution: [
      { math: termsTex(p.terms.map((t) => ({ c: t.c, k: t.k })), xParen), note: md`Substitute $x = ${xTex}$ in every term.` },
      { math: pieces.map((v) => qTex(v)).join(" + ").replace(/\+ -/g, "- "), note: "Work out each term as a fraction." },
      { math: md`= ${qTex(value)} \approx ${qNum(value).toFixed(5)}`, note: md`Common denominator, then add. The true value is $${p.at(xTex, xParen)} \approx ${truth.toFixed(5)}$; the error is about $${Math.abs(truth - qNum(value)).toExponential(1).replace("e", " \\times 10^{").replace(/\{(-?)0*(\d)/, "{$1$2")}}$.` },
    ],
  };
};

interface IntSeries {
  tex: string;
  terms: Term[];
  count: string;
  f: (x: number) => number;
}

const INT_SERIES: IntSeries[] = [
  { tex: "e^{-x^2}", terms: [{ c: q(1), k: 0 }, { c: q(-1), k: 2 }, { c: q(1, 2), k: 4 }], count: "three", f: (x) => Math.exp(-x * x) },
  { tex: "e^{-x^2}", terms: [{ c: q(1), k: 0 }, { c: q(-1), k: 2 }, { c: q(1, 2), k: 4 }, { c: q(-1, 6), k: 6 }], count: "four", f: (x) => Math.exp(-x * x) },
  { tex: "\\sin(x^2)", terms: [{ c: q(1), k: 2 }, { c: q(-1, 6), k: 6 }], count: "two", f: (x) => Math.sin(x * x) },
  { tex: "\\cos(x^2)", terms: [{ c: q(1), k: 0 }, { c: q(-1, 2), k: 4 }], count: "two", f: (x) => Math.cos(x * x) },
  { tex: "\\cos(x^2)", terms: [{ c: q(1), k: 0 }, { c: q(-1, 2), k: 4 }, { c: q(1, 24), k: 8 }], count: "three", f: (x) => Math.cos(x * x) },
  { tex: "\\frac{\\sin x}{x}", terms: [{ c: q(1), k: 0 }, { c: q(-1, 6), k: 2 }, { c: q(1, 120), k: 4 }], count: "three", f: (x) => (x === 0 ? 1 : Math.sin(x) / x) },
  { tex: "\\frac{1 - \\cos x}{x^2}", terms: [{ c: q(1, 2), k: 0 }, { c: q(-1, 24), k: 2 }, { c: q(1, 720), k: 4 }], count: "three", f: (x) => (x === 0 ? 0.5 : (1 - Math.cos(x)) / (x * x)) },
  { tex: "\\frac{\\arctan x}{x}", terms: [{ c: q(1), k: 0 }, { c: q(-1, 3), k: 2 }, { c: q(1, 5), k: 4 }], count: "three", f: (x) => (x === 0 ? 1 : Math.atan(x) / x) },
  { tex: "\\frac{\\ln(1 + x)}{x}", terms: [{ c: q(1), k: 0 }, { c: q(-1, 2), k: 1 }, { c: q(1, 3), k: 2 }, { c: q(-1, 4), k: 3 }], count: "four", f: (x) => (x === 0 ? 1 : Math.log(1 + x) / x) },
  { tex: "\\frac{e^x - 1}{x}", terms: [{ c: q(1), k: 0 }, { c: q(1, 2), k: 1 }, { c: q(1, 6), k: 2 }, { c: q(1, 24), k: 3 }], count: "four", f: (x) => (x === 0 ? 1 : (Math.exp(x) - 1) / x) },
];

/** Simpson's rule, for the "true value" remark in solutions. */
function simpson(f: (x: number) => number, a: number, b: number): number {
  const n = 200;
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

const integrateSeriesPolynomial: Generator = (r) => {
  const s = r.pick(INT_SERIES);
  const b = r.pick<Q>([[1, 2], [1, 3], [1, 4], [1, 5], [1, 1]]);
  const anti: Term[] = s.terms.map((t) => ({ c: qMul(t.c, q(1, t.k + 1)), k: t.k + 1 }));
  const pieces = anti.map((t) => qMul(t.c, qPow(b, t.k)));
  const value = pieces.reduce(qAdd, q(0));
  const bLimit = b[1] === 1 ? String(b[0]) : `${b[0]}/${b[1]}`;
  const bTex = qTex(b);
  const truth = simpson(s.f, 0, qNum(b));
  return {
    prompt: md`Evaluate $\int_{0}^{${bLimit}} \left(${termsTex(s.terms)}\right) \, dx$. The integrand is the first ${s.count} terms of the Maclaurin series of $${s.tex}$, so the result approximates the integral of $${s.tex}$ from $0$ to $${bTex}$. Give the exact fraction.`,
    answer: qText(value),
    simplified: true,
    hint: md`Integrate term by term with the power rule, then evaluate at $${bTex}$ (the lower limit contributes 0). Keep fractions exact.`,
    solution: [
      { math: md`\left[ ${termsTex(anti)} \right]_0^{${bTex}}`, note: md`Antiderivative of each term: $\int x^k \, dx = \frac{x^{k+1}}{k+1}$.` },
      { math: pieces.map((v) => qTex(v)).join(" + ").replace(/\+ -/g, "- "), note: md`Substitute $x = ${bTex}$; at $x = 0$ every term is 0.` },
      { math: md`= ${qTex(value)} \approx ${qNum(value).toFixed(5)}`, note: md`The integral of $${s.tex}$ itself is about $${truth.toFixed(5)}$. It has no elementary antiderivative, but the series gets as close as you like.` },
    ],
  };
};

const lagrangeBound: Generator = (r) => {
  const kind = r.int(0, 3);
  const bound = (M: number, x: Q, n: number): Q => qMul(q(M), qMul(qPow([Math.abs(x[0]), x[1]], n + 1), q(1, fact(n + 1))));
  const factLine = (n: number) => md`(n + 1)! = ${n + 1}! = ${fact(n + 1)}`;
  if (kind === 0) {
    const f = r.pick(["\\sin x", "\\cos x"]);
    const n = r.int(2, 5);
    const x = r.pick<Q>([[1, 2], [1, 3], [1, 4], [1, 5], [1, 1], [2, 1]]);
    const B = bound(1, x, n);
    return {
      prompt: md`$${f}$ is approximated by its Maclaurin polynomial $T_{${n}}(x)$ at $x = ${qTex(x)}$. Every derivative of $${f}$ is $\pm\sin$ or $\pm\cos$, so take $M = 1$. Use Taylor's inequality $|R_n(x)| \le \frac{M}{(n+1)!}|x - a|^{n+1}$ to bound the error. Give the bound as an exact fraction.`,
      answer: qText(B),
      simplified: true,
      hint: md`$a = 0$, $n = ${n}$, $M = 1$. The bound is $\frac{|x|^{${n + 1}}}{${n + 1}!}$.`,
      solution: [
        { math: md`|R_{${n}}(x)| \le \frac{1}{${n + 1}!} |x|^{${n + 1}}`, note: md`Taylor's inequality with $M = 1$, $a = 0$ and $n = ${n}$: the next power and the next factorial.` },
        { math: factLine(n), note: "" },
        { math: md`|R_{${n}}(${qTex(x)})| \le \frac{${qTex(qPow([Math.abs(x[0]), x[1]], n + 1))}}{${fact(n + 1)}} = ${qTex(B)} \approx ${qNum(B).toExponential(2)}`, note: md`So $T_{${n}}(${qTex(x)})$ is within $${qTex(B)}$ of $${f.replace(" x", "")}(${qTex(x)})$.` },
      ],
    };
  }
  if (kind === 1) {
    const n = r.int(2, 4);
    const x = r.pick<Q>([[1, 2], [1, 3], [1, 4], [1, 1]]);
    const B = bound(3, x, n);
    return {
      prompt: md`$e^x$ is approximated by its Maclaurin polynomial $T_{${n}}(x)$ at $x = ${qTex(x)}$. On $[0, 1]$ every derivative of $e^x$ satisfies $e^t \le e < 3$, so take $M = 3$. Use Taylor's inequality to bound $|R_{${n}}(${qTex(x)})|$. Give the bound as an exact fraction.`,
      answer: qText(B),
      simplified: true,
      hint: md`The bound is $\frac{M |x|^{n+1}}{(n+1)!}$ with $M = 3$, $n = ${n}$ and $x = ${qTex(x)}$.`,
      solution: [
        { math: md`|R_{${n}}(x)| \le \frac{3}{${n + 1}!} |x|^{${n + 1}}`, note: md`$f^{(${n + 1})}(t) = e^t \le 3$ on the stretch from $0$ to $x$.` },
        { math: factLine(n), note: "" },
        { math: md`|R_{${n}}(${qTex(x)})| \le \frac{3 \cdot ${qTex(qPow(x, n + 1))}}{${fact(n + 1)}} = ${qTex(B)} \approx ${qNum(B).toExponential(2)}`, note: md`A guaranteed error bound for $e^{${qTex(x)}} \approx T_{${n}}(${qTex(x)})$. The true error is smaller, since $e^t$ only reaches $3$ past $x = 1$.` },
      ],
    };
  }
  if (kind === 2) {
    for (;;) {
      const f = r.pick(["\\sin x", "\\cos x"]);
      const n = r.int(2, 4);
      const x = r.pick([0.3, 0.4, 0.5, 0.6, 0.8, 1.2]);
      const B = x ** (n + 1) / fact(n + 1);
      if (B < 0.0002) continue;
      return {
        prompt: md`$${f}$ is approximated by its Maclaurin polynomial $T_{${n}}(x)$ at $x = ${x}$, with $M = 1$. Use Taylor's inequality to bound $|R_{${n}}(${x})|$. Round to 6 decimal places.`,
        answer: B.toFixed(6),
        tolerance: 0.0000005,
        hint: md`The bound is $\frac{|x|^{n+1}}{(n+1)!}$ with $n = ${n}$ and $x = ${x}$.`,
        solution: [
          { math: md`|R_{${n}}(${x})| \le \frac{1}{${n + 1}!} (${x})^{${n + 1}}`, note: md`Taylor's inequality with $M = 1$, $a = 0$, $n = ${n}$.` },
          { math: md`(${x})^{${n + 1}} = ${(x ** (n + 1)).toPrecision(6).replace(/\.?0+$/, "")}, \quad ${n + 1}! = ${fact(n + 1)}`, note: "" },
          { math: md`|R_{${n}}(${x})| \le \frac{${(x ** (n + 1)).toPrecision(6).replace(/\.?0+$/, "")}}{${fact(n + 1)}} \approx ${B.toFixed(6)}`, note: md`Six decimal places.` },
        ],
      };
    }
  }
  const scenario = r.pick([
    { f: "\\sin x", x: q(1), M: 1, why: md`every derivative of $\sin x$ has size at most 1` },
    { f: "\\cos x", x: q(1), M: 1, why: md`every derivative of $\cos x$ has size at most 1` },
    { f: "e^x", x: q(1), M: 3, why: md`$e^t \le e < 3$ on $[0, 1]$` },
    { f: "\\sin x", x: q(2), M: 1, why: md`every derivative of $\sin x$ has size at most 1` },
    { f: "e^x", x: q(1, 2), M: 3, why: md`$e^t < 3$ on $[0, \frac12]$` },
  ]);
  const k = r.int(2, 6);
  const target = 10 ** -k;
  let n = 0;
  while (scenario.M * qNum(scenario.x) ** (n + 1) / fact(n + 1) >= target) n++;
  const tries = Array.from({ length: n + 1 }, (_, m) => m).filter((m) => m >= n - 2);
  return {
    prompt: md`$${scenario.f}$ is approximated by its Maclaurin polynomial $T_n(x)$ at $x = ${qTex(scenario.x)}$, with $M = ${scenario.M}$ (${scenario.why}). Find the smallest $n$ for which Taylor's inequality guarantees $|R_n(${qTex(scenario.x)})| < 10^{-${k}}$. Type the whole number $n$.`,
    answer: String(n),
    hint: md`Compute $\frac{M |x|^{n+1}}{(n+1)!}$ for $n = 1, 2, 3, \ldots$ until it drops below $10^{-${k}} = ${target}$. Factorials grow fast, so it won't take long.`,
    solution: [
      { math: md`|R_n(${qTex(scenario.x)})| \le \frac{${scenario.M} \cdot ${qTex(scenario.x)}^{\,n+1}}{(n+1)!}`, note: md`Taylor's inequality with $M = ${scenario.M}$. We need this below $${target}$.` },
      { math: tries.map((m) => `n = ${m}: \\; ${(scenario.M * qNum(scenario.x) ** (m + 1) / fact(m + 1)).toExponential(2).replace("e", " \\times 10^{").replace(/\{(-?)0*(\d)/, "{$1$2")}}`).join(", \\quad "), note: md`The bound at successive $n$. The first below $10^{-${k}}$ is at $n = ${n}$.` },
      { math: md`n = ${n}`, note: md`$T_{${n}}$ is guaranteed accurate to within $10^{-${k}}$. The actual error is usually smaller still, since $c$ is rarely where the derivative is largest.` },
    ],
  };
};

// ── The unit ────────────────────────────────────────────────────────────────

export const unit4: Unit = {
  title: "Power Series",
  lessons: [
    {
      id: slug("Power series and convergence"),
      title: "Power series and convergence",
      summary: "Infinite polynomials, where they converge, and why the answer is always an interval.",
      blocks: [
        {
          kind: "text",
          body: md`Polynomials are the functions we can actually compute: add, multiply, done. Most functions are not polynomials. But many of them are *limits* of polynomials, and that idea is this whole unit.

You already know one case from Unit 3. For $|x| < 1$,

$$1 + x + x^2 + x^3 + \cdots = \frac{1}{1 - x}.$$

The left side is a polynomial that never stops. Cut it off after the $x^n$ term and you get an honest polynomial $s_n(x)$ that approximates $\frac{1}{1 - x}$ on $(-1, 1)$, better and better as $n$ grows. Outside that interval the sum runs away.`,
        },
        {
          kind: "plot",
          x: [-2, 2],
          y: [-2, 8],
          curves: [
            { expr: "1/(1 - x)", label: "\\frac{1}{1 - x}", color: 1 },
            { expr: "(1 - x^(n + 1))/(1 - x)", label: "s_n(x)", color: 2 },
          ],
          vlines: [{ x: -1 }, { x: 1 }],
          params: [{ name: "n", min: 1, max: 25, step: 1, value: 3 }],
          caption: md`Slide $n$. Inside $(-1, 1)$ the partial sum $s_n$ hugs $\frac{1}{1 - x}$ more closely as $n$ grows. Past $|x| = 1$ it runs off, in a different direction depending on whether $n$ is odd or even. The series represents the function only on its interval of convergence.`,
        },
        {
          kind: "key",
          title: "Power series",
          body: md`A **power series centered at $a$** is

$$\sum_{n=0}^{\infty} c_n (x - a)^n = c_0 + c_1(x - a) + c_2(x - a)^2 + \cdots,$$

with constant **coefficients** $c_n$. For each fixed $x$ it is an ordinary series of numbers, which converges or diverges by the tests of Unit 3. At $x = a$ every term after the first is 0, so it always converges there, to $c_0$. The set of $x$ where it converges is its **interval of convergence**.`,
        },
        {
          kind: "why",
          title: "Why the convergence set is an interval around a",
          body: md`Suppose the series converges at some point $x = b$. Then its terms $c_n (b - a)^n$ go to 0 (the divergence test, read backwards), so they are bounded: $|c_n (b - a)^n| \le M$ for some $M$. Now take any $x$ closer to $a$ than $b$ is, and let $r = \frac{|x - a|}{|b - a|} < 1$. Then

$$|c_n (x - a)^n| = |c_n (b - a)^n| \cdot r^n \le M r^n.$$

The right side is a convergent geometric series, so by comparison the series converges absolutely at $x$. Convergence at one point forces convergence at every point nearer the center. That is exactly why the convergence set is an interval centered at $a$: there is a cutoff distance, and everything inside it converges.`,
        },
        {
          kind: "proof",
          title: "Convergence spreads inward",
          given: md`$\sum c_n (x - a)^n$ converges at $x = b \ne a$`,
          prove: md`it converges absolutely at every $x$ with $|x - a| < |b - a|$`,
          steps: [
            { statement: md`$c_n (b - a)^n \to 0$`, reason: "A convergent series has terms tending to 0 (divergence test, Unit 3)." },
            { statement: md`There is an $M$ with $|c_n (b - a)^n| \le M$ for all $n$`, reason: "A sequence with a limit is bounded." },
            { statement: md`Let $r = \frac{|x - a|}{|b - a|}$. Then $0 \le r < 1$`, reason: md`Because $|x - a| < |b - a|$.` },
            { statement: md`$|c_n (x - a)^n| = |c_n (b - a)^n| \cdot r^n \le M r^n$`, reason: md`Write $(x - a)^n = (b - a)^n \left(\frac{x - a}{b - a}\right)^n$ and take absolute values.` },
            { statement: md`$\sum M r^n$ converges`, reason: md`Geometric series with ratio $r < 1$.` },
            { statement: md`$\sum |c_n (x - a)^n|$ converges`, reason: "Comparison test." },
          ],
        },
        {
          kind: "key",
          title: "Radius of convergence",
          body: md`For every power series exactly one of these happens:

- it converges only at $x = a$ (radius $R = 0$);
- it converges for every $x$ ($R = \infty$);
- there is a number $R > 0$ with convergence for $|x - a| < R$ and divergence for $|x - a| > R$.

$R$ is the **radius of convergence**. The interval of convergence is $(a - R, a + R)$ together with whichever endpoints $x = a \pm R$ happen to converge. The theorem above says nothing about the endpoints; they are checked one at a time.`,
        },
        {
          kind: "why",
          title: "Finding R with the ratio test",
          body: md`The ratio test (Unit 3) compares a series with a geometric one. For a power series the ratio of consecutive terms is

$$\left|\frac{c_{n+1} (x - a)^{n+1}}{c_n (x - a)^n}\right| = \left|\frac{c_{n+1}}{c_n}\right| \, |x - a|.$$

If $\left|\frac{c_{n+1}}{c_n}\right| \to L$, the ratio tends to $L |x - a|$. The series converges when $L|x - a| < 1$, that is $|x - a| < \frac{1}{L}$, and diverges when $L|x - a| > 1$. So $R = \frac{1}{L}$.

If $L = 0$ the limit is below 1 for every $x$ and $R = \infty$. If the ratios grow without bound, only $x = a$ survives and $R = 0$. In practice you write the ratio, cancel, take the limit as $n \to \infty$ with $x$ held fixed, and solve the inequality for $|x - a|$.`,
        },
        {
          kind: "example",
          title: "Radius and interval",
          problem: md`Find the interval of convergence of $\displaystyle\sum_{n=1}^{\infty} \frac{(x - 2)^n}{n \cdot 3^n}$.`,
          steps: [
            { math: md`\left|\frac{a_{n+1}}{a_n}\right| = \frac{|x - 2|^{n+1}}{(n+1) 3^{n+1}} \cdot \frac{n \, 3^n}{|x - 2|^n} = \frac{n}{n+1} \cdot \frac{|x - 2|}{3}`, note: "Ratio of consecutive terms; most of the powers cancel." },
            { math: md`\to \frac{|x - 2|}{3}`, note: md`$\frac{n}{n+1} \to 1$ while $x$ stays fixed.` },
            { math: md`\frac{|x - 2|}{3} < 1 \iff |x - 2| < 3`, note: md`$R = 3$, center $2$: certainly converges for $-1 < x < 5$, certainly diverges outside $[-1, 5]$.` },
            { math: md`x = 5: \quad \sum \frac{3^n}{n \cdot 3^n} = \sum \frac{1}{n}`, note: "The harmonic series diverges. Endpoint excluded." },
            { math: md`x = -1: \quad \sum \frac{(-3)^n}{n \cdot 3^n} = \sum \frac{(-1)^n}{n}`, note: "The alternating harmonic series converges (alternating series test). Endpoint included." },
            { math: md`[-1, 5)`, note: "The interval of convergence." },
          ],
        },
        {
          kind: "numberline",
          range: [-3, 7],
          intervals: [{ from: -1, to: 5, toOpen: true }],
          points: [{ at: 2, label: "a = 2" }],
          caption: md`The interval of convergence of the example: center $2$, radius $3$, closed at $-1$ and open at $5$.`,
        },
        {
          kind: "example",
          title: "The two extremes",
          problem: md`Find the radius of convergence of $\displaystyle\sum_{n=0}^{\infty} \frac{x^n}{n!}$ and of $\displaystyle\sum_{n=0}^{\infty} n! \, x^n$.`,
          steps: [
            { math: md`\frac{|x|^{n+1}}{(n+1)!} \cdot \frac{n!}{|x|^n} = \frac{|x|}{n+1} \to 0`, note: md`First series: $(n+1)! = (n+1) \cdot n!$, so the factorials leave a single factor $n + 1$. The limit is 0 for every $x$, below 1, so $R = \infty$. It converges everywhere.` },
            { math: md`\frac{(n+1)! \, |x|^{n+1}}{n! \, |x|^n} = (n+1)|x| \to \infty \quad (x \ne 0)`, note: md`Second series: the ratio grows without bound at every $x \ne 0$, so $R = 0$. It converges only at its center.` },
          ],
        },
        {
          kind: "why",
          title: "Why the endpoints need their own test",
          body: md`At $x = a \pm R$ the ratio tends to exactly $L \cdot R = 1$, and the ratio test is silent there. The endpoints really can go either way. All three of these have $R = 1$:

- $\sum x^n$ diverges at both ends (the terms $\pm 1$ don't go to 0): interval $(-1, 1)$.
- $\sum \frac{x^n}{n}$ diverges at $x = 1$ (harmonic) and converges at $x = -1$ (alternating harmonic): $[-1, 1)$.
- $\sum \frac{x^n}{n^2}$ converges at both ends ($p$-series with $p = 2$): $[-1, 1]$.

Plug each endpoint in, look at the series of numbers you get, and use Unit 3.`,
        },
        {
          kind: "text",
          body: md`Inside its interval, a power series defines a function. The geometric series is the one we can sum exactly, and substitution stretches it a long way. Replace $x$ by $-x^2$ in $\frac{1}{1 - x} = \sum x^n$:

$$\frac{1}{1 + x^2} = \sum_{n=0}^{\infty} (-1)^n x^{2n} = 1 - x^2 + x^4 - x^6 + \cdots, \qquad |x| < 1.$$

The condition $|-x^2| < 1$ is still $|x| < 1$. Lesson 2 will integrate this to get a series for $\arctan x$.`,
        },
        {
          kind: "example",
          title: "A rational function as a power series",
          problem: md`Write $\frac{1}{3 + x}$ as a power series centered at 0 and find its radius of convergence.`,
          steps: [
            { math: md`\frac{1}{3 + x} = \frac{1}{3} \cdot \frac{1}{1 + \frac{x}{3}} = \frac13 \cdot \frac{1}{1 - \left(-\frac{x}{3}\right)}`, note: md`Factor out the 3 so the denominator has the shape $1 - r$.` },
            { math: md`= \frac13 \sum_{n=0}^{\infty} \left(-\frac{x}{3}\right)^n = \sum_{n=0}^{\infty} \frac{(-1)^n}{3^{n+1}} x^n`, note: md`Geometric series with $r = -\frac{x}{3}$.` },
            { math: md`\left|-\frac{x}{3}\right| < 1 \iff |x| < 3`, note: md`$R = 3$: the distance from the center 0 to $x = -3$, where the function blows up. That is no accident; a power series can't get past a point where its function is undefined.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the radius of convergence of $\displaystyle\sum_{n=0}^{\infty} \frac{(x + 1)^n}{4^n}$.`,
          answer: "4",
          explain: md`The ratio of consecutive terms is $\frac{|x + 1|}{4}$, so the series converges when $|x + 1| < 4$: radius 4, center $-1$.`,
        },
        {
          kind: "check",
          prompt: md`Find the interval of convergence of $\displaystyle\sum_{n=1}^{\infty} \frac{x^n}{n \cdot 2^n}$. Type an inequality or interval notation.`,
          answer: "-2 <= x < 2",
          form: "inequality",
          explain: md`$R = 2$. At $x = 2$ the series is $\sum \frac{1}{n}$, which diverges; at $x = -2$ it is $\sum \frac{(-1)^n}{n}$, which converges. So $[-2, 2)$.`,
        },
      ],
      practice: [radiusOfConvergence, intervalOfConvergence, geometricClosedForm],
    },
    {
      id: slug("Taylor and Maclaurin series"),
      title: "Taylor and Maclaurin series",
      summary: "Term-by-term calculus, the coefficient formula and where it comes from, and the series everyone should know.",
      blocks: [
        {
          kind: "text",
          body: md`Lesson 1 went from a series to a function. Now the other way: start with a function $f$ and ask which power series, if any, adds up to it near $x = a$. The answer comes from differentiating, so first we need to know that a power series can be differentiated at all.`,
        },
        {
          kind: "key",
          title: "Term-by-term calculus",
          body: md`If $f(x) = \sum c_n (x - a)^n$ has radius $R > 0$, then for $|x - a| < R$

$$f'(x) = \sum_{n=1}^{\infty} n c_n (x - a)^{n-1}, \qquad \int f(x) \, dx = C + \sum_{n=0}^{\infty} \frac{c_n}{n+1} (x - a)^{n+1},$$

and both new series have the same radius $R$. In words: inside the interval, differentiate or integrate a power series exactly as you would a polynomial, one term at a time.`,
        },
        {
          kind: "why",
          title: "Why the radius doesn't change",
          body: md`The derivative series has coefficients $n c_n$. In the ratio test the new factor is

$$\frac{(n+1) c_{n+1}}{n c_n} = \frac{n+1}{n} \cdot \frac{c_{n+1}}{c_n},$$

and $\frac{n+1}{n} \to 1$, so the limit $L$ is unchanged and so is $R = \frac1L$. Integrating multiplies by $\frac{n}{n+1} \to 1$ instead; same conclusion. The endpoints can change: differentiating tends to lose them and integrating tends to gain them, which is why each endpoint is still checked by hand.

That the derivative of the sum really is the sum of the derivatives is a theorem, not just a plausible guess. Its proof controls the tail of the series with the same geometric comparison as Lesson 1. We take it as given here and use it freely.`,
        },
        {
          kind: "proof",
          title: "The coefficients are forced",
          given: md`$f(x) = \sum_{n=0}^{\infty} c_n (x - a)^n$ for $|x - a| < R$`,
          prove: md`$c_n = \dfrac{f^{(n)}(a)}{n!}$ for every $n$`,
          steps: [
            { statement: md`$f(a) = c_0$`, reason: md`Every term with $n \ge 1$ contains the factor $(x - a)$, which is 0 at $x = a$.` },
            { statement: md`$f'(x) = c_1 + 2 c_2 (x - a) + 3 c_3 (x - a)^2 + \cdots$, so $f'(a) = c_1$`, reason: md`Differentiate term by term, then set $x = a$.` },
            { statement: md`$f''(x) = 2 c_2 + 3 \cdot 2 \, c_3 (x - a) + 4 \cdot 3 \, c_4 (x - a)^2 + \cdots$, so $f''(a) = 2 c_2$`, reason: "Differentiate again. Every surviving term keeps a factor $(x - a)$ except the first." },
            { statement: md`$f'''(a) = 3 \cdot 2 \cdot 1 \cdot c_3 = 3! \, c_3$`, reason: md`Each differentiation brings down the current exponent. After three, the constant term is $3 \cdot 2 \cdot 1 \cdot c_3$.` },
            { statement: md`$f^{(n)}(a) = n! \, c_n$`, reason: md`The same pattern at every stage: $n$ differentiations of $c_n (x - a)^n$ leave the constant $n(n-1)\cdots 1 \cdot c_n$, and every other term is 0 at $a$.` },
            { statement: md`$c_n = \dfrac{f^{(n)}(a)}{n!}$`, reason: md`Divide by $n!$. The coefficients are determined by $f$ alone, so a function has at most one power series about $a$.` },
          ],
        },
        {
          kind: "key",
          title: "Taylor and Maclaurin series",
          body: md`The **Taylor series** of $f$ about $a$ is

$$\sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!} (x - a)^n = f(a) + f'(a)(x - a) + \frac{f''(a)}{2!}(x - a)^2 + \frac{f'''(a)}{3!}(x - a)^3 + \cdots$$

With $a = 0$ it is called the **Maclaurin series**. Cutting it off after the $(x - a)^n$ term gives the **Taylor polynomial** $T_n(x)$: the polynomial of degree at most $n$ whose value and first $n$ derivatives at $a$ all agree with $f$'s.

The proof above shows that *if* $f$ equals some power series near $a$, it must be this one. Whether the Taylor series actually adds up to $f$ is a separate question, settled by the remainder in Lesson 3.`,
        },
        {
          kind: "example",
          title: "The Maclaurin series of e^x",
          problem: md`Find the Maclaurin series of $f(x) = e^x$.`,
          steps: [
            { math: md`f(x) = e^x, \quad f'(x) = e^x, \quad f''(x) = e^x, \quad \ldots`, note: md`Every derivative of $e^x$ is $e^x$.` },
            { math: md`f^{(n)}(0) = e^0 = 1`, note: md`So every coefficient is $c_n = \frac{1}{n!}$.` },
            { math: md`e^x = \sum_{n=0}^{\infty} \frac{x^n}{n!} = 1 + x + \frac{x^2}{2} + \frac{x^3}{6} + \frac{x^4}{24} + \cdots`, note: md`Radius $\infty$ (Lesson 1). That the sum really is $e^x$ for every $x$ is shown in Lesson 3. Put $x = 1$: $e = 1 + 1 + \frac12 + \frac16 + \frac1{24} + \cdots$, a fast way to compute $e$.` },
          ],
        },
        {
          kind: "example",
          title: "Sine, and cosine for free",
          problem: md`Find the Maclaurin series of $\sin x$, and from it the series of $\cos x$.`,
          steps: [
            { math: md`f = \sin x, \quad f' = \cos x, \quad f'' = -\sin x, \quad f''' = -\cos x, \quad f^{(4)} = \sin x`, note: "The derivatives cycle with period 4." },
            { math: md`f(0) = 0, \quad f'(0) = 1, \quad f''(0) = 0, \quad f'''(0) = -1, \quad f^{(4)}(0) = 0, \; \ldots`, note: md`At 0 the values repeat $0, 1, 0, -1$.` },
            { math: md`\sin x = x - \frac{x^3}{3!} + \frac{x^5}{5!} - \frac{x^7}{7!} + \cdots = \sum_{n=0}^{\infty} \frac{(-1)^n x^{2n+1}}{(2n+1)!}`, note: "Only odd powers survive, with alternating signs. An odd function has only odd powers." },
            { math: md`\cos x = \frac{d}{dx} \sin x = 1 - \frac{x^2}{2!} + \frac{x^4}{4!} - \cdots = \sum_{n=0}^{\infty} \frac{(-1)^n x^{2n}}{(2n)!}`, note: md`Differentiate term by term instead of starting over: $\frac{d}{dx} \frac{x^{2n+1}}{(2n+1)!} = \frac{x^{2n}}{(2n)!}$. Same radius, $\infty$.` },
          ],
        },
        {
          kind: "plot",
          x: [-7, 7],
          y: [-3, 3],
          curves: [
            { expr: "sin(x)", label: "\\sin x", color: 1 },
            { expr: "sin(a) + cos(a)(x - a)", label: "T_1", color: 2 },
            { expr: "sin(a) + cos(a)(x - a) - sin(a)(x - a)^2/2 - cos(a)(x - a)^3/6", label: "T_3", color: 3 },
            { expr: "sin(a) + cos(a)(x - a) - sin(a)(x - a)^2/2 - cos(a)(x - a)^3/6 + sin(a)(x - a)^4/24 + cos(a)(x - a)^5/120", label: "T_5", color: 4 },
          ],
          points: [{ x: "a", y: "sin(a)", label: "(a, \\sin a)" }],
          params: [{ name: "a", min: -3, max: 3, step: 0.25, value: 0 }],
          caption: md`Taylor polynomials of $\sin x$ about a movable center $a$. Each $T_n$ matches $\sin x$ and its first $n$ derivatives at $a$, so it hugs the curve near $a$ and peels away further out. Higher degree, wider hug. At $a = 0$, $T_1 = x$ is the small-angle approximation.`,
        },
        {
          kind: "why",
          title: "Series from series: ln and arctan",
          body: md`Differentiating a function $n$ times is slow. Usually it is faster to build on a series you already have. Replace $x$ by $-x$ in the geometric series:

$$\frac{1}{1 + x} = \sum_{n=0}^{\infty} (-1)^n x^n = 1 - x + x^2 - x^3 + \cdots, \qquad |x| < 1.$$

Integrate both sides from 0 to $x$, term by term (allowed inside the interval):

$$\ln(1 + x) = \sum_{n=0}^{\infty} \frac{(-1)^n x^{n+1}}{n+1} = x - \frac{x^2}{2} + \frac{x^3}{3} - \frac{x^4}{4} + \cdots$$

The constant of integration is 0 because both sides are 0 at $x = 0$. The same move on $\frac{1}{1 + x^2} = \sum (-1)^n x^{2n}$ from Lesson 1 gives

$$\arctan x = \sum_{n=0}^{\infty} \frac{(-1)^n x^{2n+1}}{2n+1} = x - \frac{x^3}{3} + \frac{x^5}{5} - \cdots$$

Both have $R = 1$, and integrating gained an endpoint: at $x = 1$ each becomes a convergent alternating series. It is true, though it takes an extra argument (Abel's theorem) to justify, that the sums at the edge are the function values: $\ln 2 = 1 - \frac12 + \frac13 - \cdots$ and $\frac{\pi}{4} = 1 - \frac13 + \frac15 - \cdots$.

Because a function has only one power series about $a$, any correct route gives the same coefficients. You never have to use the derivative formula if a substitution gets there first.`,
        },
        {
          kind: "key",
          title: "Series to know",
          body: md`- $e^x = \displaystyle\sum_{n=0}^{\infty} \frac{x^n}{n!}$, all $x$
- $\sin x = \displaystyle\sum_{n=0}^{\infty} \frac{(-1)^n x^{2n+1}}{(2n+1)!}$, all $x$
- $\cos x = \displaystyle\sum_{n=0}^{\infty} \frac{(-1)^n x^{2n}}{(2n)!}$, all $x$
- $\dfrac{1}{1 - x} = \displaystyle\sum_{n=0}^{\infty} x^n$, $|x| < 1$
- $\ln(1 + x) = \displaystyle\sum_{n=1}^{\infty} \frac{(-1)^{n+1} x^n}{n}$, $-1 < x \le 1$
- $\arctan x = \displaystyle\sum_{n=0}^{\infty} \frac{(-1)^n x^{2n+1}}{2n+1}$, $|x| \le 1$

Substitute freely: $e^{-x^2} = \sum \frac{(-1)^n x^{2n}}{n!}$ in one line, no derivatives taken.`,
        },
        {
          kind: "example",
          title: "A Taylor series about a = 1",
          problem: md`Find the Taylor series of $f(x) = \ln x$ about $a = 1$.`,
          steps: [
            { math: md`f'(x) = \frac1x, \quad f''(x) = -\frac{1}{x^2}, \quad f'''(x) = \frac{2}{x^3}, \quad f^{(4)}(x) = -\frac{6}{x^4}`, note: md`Power rule each time. In general $f^{(n)}(x) = (-1)^{n-1} \frac{(n-1)!}{x^n}$ for $n \ge 1$.` },
            { math: md`f(1) = 0, \quad f'(1) = 1, \quad f''(1) = -1, \quad f'''(1) = 2, \quad f^{(4)}(1) = -6`, note: "Evaluate at the center." },
            { math: md`c_n = \frac{f^{(n)}(1)}{n!} = \frac{(-1)^{n-1} (n-1)!}{n!} = \frac{(-1)^{n-1}}{n}`, note: md`$\frac{(n-1)!}{n!} = \frac1n$.` },
            { math: md`\ln x = (x - 1) - \frac{(x - 1)^2}{2} + \frac{(x - 1)^3}{3} - \cdots, \qquad 0 < x \le 2`, note: md`This is the $\ln(1 + u)$ series with $u = x - 1$, as it must be. $R = 1$: the distance from the center to $x = 0$, where $\ln$ blows up.` },
          ],
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-2, 12],
          curves: [
            { expr: "e^x", label: "e^x", color: 1 },
            { expr: "e^a (1 + (x - a))", label: "T_1", color: 2 },
            { expr: "e^a (1 + (x - a) + (x - a)^2/2)", label: "T_2", color: 3 },
            { expr: "e^a (1 + (x - a) + (x - a)^2/2 + (x - a)^3/6)", label: "T_3", color: 4 },
          ],
          points: [{ x: "a", y: "e^a", label: "(a, e^a)" }],
          params: [{ name: "a", min: -2, max: 2, step: 0.25, value: 0 }],
          caption: md`$e^x$ with its Taylor polynomials about $a$. Because every derivative of $e^x$ is $e^x$, each $T_n$ is $e^a$ times the Maclaurin polynomial in $(x - a)$: shifting the center just rescales. $T_1$ is the tangent line.`,
        },
        {
          kind: "text",
          body: md`A polynomial is its own Taylor series. Take $p(x) = x^2$ about $a = 1$: $p(1) = 1$, $p'(1) = 2$, $\frac{p''(1)}{2} = 1$, and every higher derivative is 0, so

$$x^2 = 1 + 2(x - 1) + (x - 1)^2.$$

Multiply out the right side to check. Re-centering a polynomial is the one case where the Taylor series is a finite sum and the equality holds for every $x$ with nothing left over.`,
        },
        {
          kind: "check",
          prompt: md`Find the coefficient of $x^3$ in the Maclaurin series of $e^{2x}$. Give an exact fraction.`,
          answer: "4/3",
          simplified: true,
          explain: md`Substitute $2x$ into the series for $e^u$: the cubic term is $\frac{(2x)^3}{3!} = \frac{8x^3}{6} = \frac{4}{3}x^3$. Or: $f'''(x) = 8e^{2x}$, so $c_3 = \frac{8}{3!} = \frac43$.`,
        },
        {
          kind: "check",
          prompt: md`Find the Maclaurin polynomial $T_4(x)$ of $\cos x$. Write it expanded, with exact fractions.`,
          answer: "1 - x^2/2 + x^4/24",
          expanded: true,
          explain: md`$\cos x = 1 - \frac{x^2}{2!} + \frac{x^4}{4!} - \cdots$, and $4! = 24$. Since the $x^3$ coefficient is 0, $T_3 = T_2$ and $T_4 = T_5$.`,
        },
      ],
      practice: [taylorPolynomial, polynomialRecentered, closedFormByOperations],
    },
    {
      id: slug("Taylor's remainder"),
      title: "Taylor's remainder",
      summary: "How wrong a Taylor polynomial can be, Taylor's theorem by repeated Rolle, and why the big series really equal their functions.",
      blocks: [
        {
          kind: "text",
          body: md`Lesson 2 built $T_n$, the polynomial that agrees with $f$ and its first $n$ derivatives at $a$. The Taylor series is the limit of the $T_n$. Two questions remain, and they turn out to be the same question. How wrong is $T_n(x)$ as an estimate of $f(x)$? And does that error go to 0 as $n \to \infty$, so that the series really equals $f$?`,
        },
        {
          kind: "key",
          title: "The remainder",
          body: md`$$R_n(x) = f(x) - T_n(x)$$

is the **remainder** (the error) of the degree-$n$ Taylor polynomial about $a$. The Taylor series converges to $f(x)$ exactly when $R_n(x) \to 0$ as $n \to \infty$.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [0, 2],
          curves: [
            { expr: "abs(sin(x) - (x - x^3/6))", label: "|R_3(x)|", color: 4 },
            { expr: "abs(x)^4/24", label: "\\frac{|x|^4}{24}", color: 2, dashed: true },
            { expr: "abs(x)^5/120", label: "\\frac{|x|^5}{120}", color: 3, dashed: true },
          ],
          caption: md`The actual error of $T_3(x) = x - \frac{x^3}{6}$ for $\sin x$, with the two bounds this lesson produces. The error is tiny near 0 and grows like a power of $|x|$, and it stays below both curves.`,
        },
        {
          kind: "key",
          title: "Taylor's theorem (Lagrange form of the remainder)",
          body: md`If $f^{(n+1)}$ exists on an interval containing $a$ and $x$, then

$$R_n(x) = \frac{f^{(n+1)}(c)}{(n+1)!} (x - a)^{n+1}$$

for some $c$ strictly between $a$ and $x$. The error looks exactly like the next term of the series, except that the derivative is taken at an unknown point $c$ instead of at $a$.`,
        },
        {
          kind: "why",
          title: "Why it should be true",
          body: md`For $n = 0$, $T_0(x) = f(a)$, and the claim reads $f(x) - f(a) = f'(c)(x - a)$. That is the Mean Value Theorem from Calculus 1. Taylor's theorem is the Mean Value Theorem repeated: each extra derivative of agreement at $a$ buys one more factor of $(x - a)$ and one more factorial. The proof runs that idea through Rolle's theorem $n + 1$ times, on a helper function built to vanish at both $a$ and $x$.`,
        },
        {
          kind: "proof",
          title: "Taylor's theorem, by repeated Rolle",
          given: md`$f^{(n+1)}$ exists on an interval containing $a$ and $x$, with $x \ne a$`,
          prove: md`$f(x) - T_n(x) = \dfrac{f^{(n+1)}(c)}{(n+1)!}(x - a)^{n+1}$ for some $c$ between $a$ and $x$`,
          steps: [
            { statement: md`Choose the number $K$ with $f(x) - T_n(x) = K (x - a)^{n+1}$`, reason: md`Possible because $(x - a)^{n+1} \ne 0$: $K$ is the error divided by $(x - a)^{n+1}$. We must show $K = \frac{f^{(n+1)}(c)}{(n+1)!}$.` },
            { statement: md`Let $g(t) = f(t) - T_n(t) - K (t - a)^{n+1}$`, reason: md`A helper function of $t$; $x$ and $K$ are fixed.` },
            { statement: md`$g(a) = 0$ and $g(x) = 0$`, reason: md`At $t = a$: $T_n(a) = f(a)$ and $(a - a)^{n+1} = 0$. At $t = x$: that is how $K$ was chosen.` },
            { statement: md`$g'(a) = g''(a) = \cdots = g^{(n)}(a) = 0$`, reason: md`$T_n$ matches the first $n$ derivatives of $f$ at $a$, and the first $n$ derivatives of $(t - a)^{n+1}$ still contain a factor $(t - a)$.` },
            { statement: md`There is $c_1$ between $a$ and $x$ with $g'(c_1) = 0$`, reason: md`Rolle's theorem on $g$, which is 0 at both $a$ and $x$.` },
            { statement: md`There is $c_2$ between $a$ and $c_1$ with $g''(c_2) = 0$`, reason: md`Rolle on $g'$, which is 0 at $a$ and at $c_1$.` },
            { statement: md`Continuing, there is $c = c_{n+1}$ between $a$ and $x$ with $g^{(n+1)}(c) = 0$`, reason: md`Rolle $n + 1$ times in all, each time on the next derivative, which vanishes at $a$ and at the previous $c_k$. Every $c_k$ stays between $a$ and $x$.` },
            { statement: md`$g^{(n+1)}(t) = f^{(n+1)}(t) - 0 - K (n+1)!$`, reason: md`$T_n$ has degree at most $n$, so its $(n+1)$st derivative is 0; the $(n+1)$st derivative of $(t - a)^{n+1}$ is $(n+1)!$.` },
            { statement: md`$f^{(n+1)}(c) = K (n+1)!$, so $K = \dfrac{f^{(n+1)}(c)}{(n+1)!}$`, reason: md`Set $t = c$ and use $g^{(n+1)}(c) = 0$.` },
            { statement: md`$f(x) - T_n(x) = \dfrac{f^{(n+1)}(c)}{(n+1)!}(x - a)^{n+1}$`, reason: md`Substitute $K$ back into the first line.` },
          ],
        },
        {
          kind: "key",
          title: "Taylor's inequality",
          body: md`If $|f^{(n+1)}(t)| \le M$ for every $t$ between $a$ and $x$, then

$$|R_n(x)| \le \frac{M}{(n+1)!} |x - a|^{n+1}.$$

We rarely know $c$, and we don't need to. A bound on the next derivative over the whole stretch from $a$ to $x$ is enough.`,
        },
        {
          kind: "why",
          title: "Where M comes from",
          body: md`For $\sin x$ and $\cos x$ every derivative is $\pm \sin$ or $\pm \cos$, so $M = 1$ always works. For $e^x$ every derivative is $e^x$, which is increasing, so on $[0, x]$ with $x \le 1$ we can take $M = e^x \le e < 3$. Choosing $M$ is the only judgement call in the method. Any valid bound works; a smaller one gives a sharper guarantee.`,
        },
        {
          kind: "example",
          title: "An estimate with a guarantee",
          problem: md`Approximate $\sqrt{e} = e^{1/2}$ with $T_3$ and bound the error.`,
          steps: [
            { math: md`T_3(x) = 1 + x + \frac{x^2}{2} + \frac{x^3}{6}`, note: md`Maclaurin polynomial of $e^x$ (Lesson 2).` },
            { math: md`T_3\!\left(\tfrac12\right) = 1 + \frac12 + \frac18 + \frac{1}{48} = \frac{79}{48} \approx 1.6458`, note: "Common denominator 48." },
            { math: md`\left|R_3\!\left(\tfrac12\right)\right| \le \frac{M}{4!} \left(\tfrac12\right)^4 \quad\text{with } M = 3`, note: md`$f^{(4)}(t) = e^t \le e^{1/2} < 3$ for $0 \le t \le \frac12$.` },
            { math: md`\left|R_3\!\left(\tfrac12\right)\right| \le \frac{3}{24 \cdot 16} = \frac{1}{128} \approx 0.0078`, note: md`So $\sqrt{e}$ is within $0.0078$ of $1.6458$. (It is $1.6487$; the actual error, $0.0029$, is inside the guarantee.)` },
          ],
        },
        {
          kind: "example",
          title: "How many terms?",
          problem: md`How large must $n$ be for $T_n(1)$ to approximate $\sin 1$ within $10^{-4}$?`,
          steps: [
            { math: md`|R_n(1)| \le \frac{1}{(n+1)!}`, note: md`$M = 1$ and $|x - a| = 1$.` },
            { math: md`5! = 120, \quad 6! = 720, \quad 7! = 5040, \quad 8! = 40320`, note: md`We need $(n+1)! > 10^4$.` },
            { math: md`n + 1 = 8, \qquad n = 7`, note: md`$T_7(1) = 1 - \frac16 + \frac{1}{120} - \frac{1}{5040} \approx 0.841468$ is within $\frac{1}{40320} < 10^{-4}$ of $\sin 1$. Since $T_7 = T_8$ for sine, the bound with $n = 8$ is even better: $\frac{1}{9!}$.` },
          ],
        },
        {
          kind: "why",
          title: "Why e^x, sin x and cos x equal their series everywhere",
          body: md`Fix any $x$. For $e^x$, take $M = e^{|x|}$, a number that does not depend on $n$. Then

$$|R_n(x)| \le e^{|x|} \cdot \frac{|x|^{n+1}}{(n+1)!}.$$

The factorial wins. Once $n + 1 > 2|x|$, each step up in $n$ multiplies $\frac{|x|^{n+1}}{(n+1)!}$ by $\frac{|x|}{n+2} < \frac12$, so it is squeezed to 0. Hence $R_n(x) \to 0$, and the Maclaurin series of $e^x$ converges to $e^x$ at every $x$. For $\sin$ and $\cos$, $M = 1$ and the same bound $\frac{|x|^{n+1}}{(n+1)!} \to 0$ finishes it. These are the facts Lesson 2 promised: the equals signs in $e^x = \sum \frac{x^n}{n!}$ and its two companions are genuine.`,
        },
        {
          kind: "text",
          body: md`It can fail. The function $f(x) = e^{-1/x^2}$ (with $f(0) = 0$) has every derivative equal to 0 at the origin, so its Maclaurin series is $0 + 0x + 0x^2 + \cdots$. That series converges everywhere, but it equals $f$ only at $x = 0$. The series exists; the remainder just never goes to 0. That is why the remainder, not the series, carries the proof.

**A second error bound.** When the series at $x$ alternates with terms decreasing to 0 (sine and cosine, $\ln(1 + x)$ and $\arctan x$ for $0 < x \le 1$, $e^{-x^2}$), the alternating series estimate from Unit 3 applies too: the error is at most the first omitted term. It needs no $M$ and is often sharper than Taylor's inequality.`,
        },
        {
          kind: "example",
          title: "An integral with no elementary antiderivative",
          problem: md`Estimate $\displaystyle\int_0^{1/2} e^{-x^2} \, dx$ to within $0.0002$.`,
          steps: [
            { math: md`e^{-x^2} = 1 - x^2 + \frac{x^4}{2} - \frac{x^6}{6} + \cdots`, note: md`Substitute $-x^2$ into the series for $e^u$.` },
            { math: md`\int_0^{1/2} e^{-x^2} \, dx = \left[ x - \frac{x^3}{3} + \frac{x^5}{10} - \frac{x^7}{42} + \cdots \right]_0^{1/2}`, note: "Integrate term by term." },
            { math: md`= \frac12 - \frac{1}{24} + \frac{1}{320} - \frac{1}{5376} + \cdots`, note: md`At $x = \frac12$: $\frac{(1/2)^3}{3} = \frac{1}{24}$, $\frac{(1/2)^5}{10} = \frac{1}{320}$, $\frac{(1/2)^7}{42} = \frac{1}{5376}$.` },
            { math: md`\approx \frac12 - \frac{1}{24} + \frac{1}{320} = \frac{443}{960} \approx 0.46146, \qquad \text{error} < \frac{1}{5376} \approx 0.00019`, note: md`Three terms, with the first omitted term as the alternating-series error bound. (The true value is $0.46128$.) The series computes an integral that has no formula.` },
          ],
        },
        {
          kind: "check",
          prompt: md`$\sin x$ is replaced by $T_3(x) = x - \frac{x^3}{6}$ at $x = \frac15$. Use Taylor's inequality with $M = 1$ and $n = 3$ to bound the error. Give an exact fraction.`,
          answer: "1/15000",
          simplified: true,
          explain: md`$|R_3(\frac15)| \le \frac{1}{4!}\left(\frac15\right)^4 = \frac{1}{24 \cdot 625} = \frac{1}{15000}$. Since $T_3 = T_4$ for sine, using $n = 4$ gives the even better $\frac{1}{120 \cdot 3125} = \frac{1}{375000}$.`,
        },
      ],
      practice: [evaluateTaylorPolynomial, integrateSeriesPolynomial, lagrangeBound],
    },
  ],
};
