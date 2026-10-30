import { frac, fracTex, gcd, poly } from "../../math/random";
import { md, slug, type Block, type Generator, type SeriesColor, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A fraction n/d, kept reduced. */
type Q = [number, number];
const qnorm = ([n, d]: Q): Q => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const qadd = (a: Q, b: Q): Q => qnorm([a[0] * b[1] + b[0] * a[1], a[1] * b[1]]);
const qmul = (a: Q, b: Q): Q => qnorm([a[0] * b[0], a[1] * b[1]]);
const qtext = (q: Q) => frac(q[0], q[1]);
const qtex = (q: Q) => fracTex(q[0], q[1]);

/** "+ \frac{3}{n}" or "- \frac{3}{n}" for a term in the middle of an expression. */
const pmFrac = (v: number, den: string) => `${v < 0 ? "-" : "+"} \\frac{${Math.abs(v)}}{${den}}`;

/** Points (n, f(n)) for n = 1..N, for sequence plots. */
const seqPoints = (f: (n: number) => number, N: number, color?: SeriesColor) =>
  Array.from({ length: N }, (_, i) => ({ x: i + 1, y: f(i + 1), ...(color ? { color } : {}) }));

const DNE = ["diverges", "does not exist", "DNE"];

// ── Lesson 1: Sequences and their limits ────────────────────────────────────

const rationalLimit: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.nonzero(-7, 7);
    const b = r.nonzero(-9, 9);
    const c = r.int(2, 6);
    const d = r.nonzero(-9, 9);
    const top = poly([[a, "n"], [b, ""]]);
    const bot = poly([[c, "n"], [d, ""]]);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{${top}}{${bot}}$. Give an exact value, like 2/3.`,
      answer: frac(a, c),
      hint: md`Divide every term on top and bottom by $n$, the highest power present. Then let $n$ grow.`,
      solution: [
        { math: md`\frac{${top}}{${bot}} = \frac{${a} ${pmFrac(b, "n")}}{${c} ${pmFrac(d, "n")}}`, note: md`Divide top and bottom by $n$. The fraction's value doesn't change.` },
        { math: md`\frac{${b}}{n} \to 0, \qquad \frac{${d}}{n} \to 0`, note: md`A fixed number over a growing $n$ shrinks to 0.` },
        { math: md`\lim_{n \to \infty} a_n = \frac{${a}}{${c}}${frac(a, c) === `${a}/${c}` ? "" : ` = ${fracTex(a, c)}`}`, note: "Only the leading coefficients survive." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.nonzero(-6, 6);
    const b = r.int(-9, 9);
    const c = r.int(-9, 9);
    const d = r.int(2, 5);
    const e = r.int(-9, 9);
    const f = r.int(1, 9);
    const top = poly([[a, "n^2"], [b, "n"], [c, ""]]);
    const bot = poly([[d, "n^2"], [e, "n"], [f, ""]]);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{${top}}{${bot}}$. Give an exact value, like -3/4.`,
      answer: frac(a, d),
      hint: md`Divide top and bottom by $n^2$. Every term except the leading ones then has an $n$ underneath and goes to 0.`,
      solution: [
        { math: md`\frac{${top}}{${bot}} \cdot \frac{1/n^2}{1/n^2}`, note: md`Multiply by $\frac{1/n^2}{1/n^2} = 1$.` },
        { math: md`= \frac{${a} ${b ? pmFrac(b, "n") : ""} ${c ? pmFrac(c, "n^2") : ""}}{${d} ${e ? pmFrac(e, "n") : ""} ${pmFrac(f, "n^2")}}`, note: md`Each term with $n$ or $n^2$ underneath goes to 0 as $n \to \infty$.` },
        { math: md`\lim_{n \to \infty} a_n = ${fracTex(a, d)}`, note: "Same degree on top and bottom: the limit is the ratio of leading coefficients." },
      ],
    };
  }
  const a = r.nonzero(-7, 7);
  const b = r.nonzero(-9, 9);
  const c = r.int(1, 5);
  const d = r.int(0, 9);
  const top = poly([[a, "n"], [b, ""]]);
  const bot = poly([[c, "n^2"], [d, ""]]);
  return {
    prompt: md`Find $\lim_{n \to \infty} \frac{${top}}{${bot}}$.`,
    answer: "0",
    hint: md`The bottom has the higher power. Divide top and bottom by $n^2$ and see what is left.`,
    solution: [
      { math: md`\frac{${top}}{${bot}} = \frac{\frac{${a}}{n} ${pmFrac(b, "n^2")}}{${c} ${d ? pmFrac(d, "n^2") : ""}}`, note: md`Divide top and bottom by $n^2$.` },
      { math: md`\to \frac{0 + 0}{${c} + 0} = 0`, note: md`Every term on top has an $n$ underneath, so the top goes to 0 while the bottom goes to ${c}.` },
    ],
  };
};

const famousLimits: Generator = (r) => {
  const kind = r.int(0, 8);
  if (kind === 0) {
    const a = r.int(2, 8);
    return {
      prompt: md`Find $\lim_{n \to \infty} \left(\sqrt{n^2 + ${a}n} - n\right)$. Give an exact value, like 5/2.`,
      answer: frac(a, 2),
      hint: md`Both pieces grow without bound, so this is an $\infty - \infty$ form. Multiply by the conjugate $\frac{\sqrt{n^2 + ${a}n} + n}{\sqrt{n^2 + ${a}n} + n}$.`,
      solution: [
        { math: md`\left(\sqrt{n^2 + ${a}n} - n\right) \cdot \frac{\sqrt{n^2 + ${a}n} + n}{\sqrt{n^2 + ${a}n} + n} = \frac{(n^2 + ${a}n) - n^2}{\sqrt{n^2 + ${a}n} + n}`, note: md`$(A - B)(A + B) = A^2 - B^2$ clears the root from the top.` },
        { math: md`= \frac{${a}n}{\sqrt{n^2 + ${a}n} + n} = \frac{${a}}{\sqrt{1 + \frac{${a}}{n}} + 1}`, note: md`Divide top and bottom by $n$; under the root, $n$ becomes $n^2$.` },
        { math: md`\to \frac{${a}}{\sqrt{1 + 0} + 1} = ${fracTex(a, 2)}`, note: md`$\frac{${a}}{n} \to 0$, and the square root is continuous.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 6);
    return {
      prompt: md`Find $\lim_{n \to \infty} n \sin\left(\frac{${a}}{n}\right)$.`,
      answer: String(a),
      hint: md`Let $h = \frac{${a}}{n}$, so $h \to 0$. Then $n = \frac{${a}}{h}$, and you know $\lim_{h \to 0} \frac{\sin h}{h}$ from Calculus 1.`,
      solution: [
        { math: md`n \sin\left(\frac{${a}}{n}\right) = ${a} \cdot \frac{\sin h}{h}, \qquad h = \frac{${a}}{n}`, note: md`Since $n = ${a}/h$, the factor $n$ becomes $\frac{${a}}{h}$.` },
        { math: md`h \to 0 \text{ as } n \to \infty, \qquad \frac{\sin h}{h} \to 1`, note: "The basic trig limit from Calculus 1." },
        { math: md`\lim_{n \to \infty} n \sin\left(\frac{${a}}{n}\right) = ${a}`, note: md`A tiny angle, multiplied by a huge $n$: the two effects balance at exactly ${a}.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(2, 5);
    const asExponent = r.next() < 0.5;
    const tex = asExponent ? md`\left(1 + \frac{1}{n}\right)^{${a}n}` : md`\left(1 + \frac{${a}}{n}\right)^{n}`;
    return {
      prompt: md`Find $\lim_{n \to \infty} ${tex}$. Give an exact value in terms of $e$, like e^3.`,
      answer: `e^${a}`,
      hint: md`Take the natural log first: $\ln a_n$ is $n$ times a log. Write it as $\frac{\ln(1 + h)}{h}$ for a small $h$, which is a derivative in disguise.`,
      solution: asExponent
        ? [
            { math: md`\ln a_n = ${a}n \ln\left(1 + \frac{1}{n}\right) = ${a} \cdot \frac{\ln(1 + h)}{h}, \qquad h = \frac{1}{n}`, note: md`Logs turn powers into products.` },
            { math: md`\frac{\ln(1 + h)}{h} = \frac{\ln(1 + h) - \ln 1}{h} \to \frac{d}{dx}\ln x \Big|_{x = 1} = 1`, note: md`It is the difference quotient of $\ln x$ at $x = 1$, and $(\ln x)' = 1/x$.` },
            { math: md`\ln a_n \to ${a}, \qquad a_n \to e^{${a}}`, note: md`$e^x$ is continuous, so $a_n = e^{\ln a_n} \to e^{${a}}$.` },
          ]
        : [
            { math: md`\ln a_n = n \ln\left(1 + \frac{${a}}{n}\right) = ${a} \cdot \frac{\ln(1 + h)}{h}, \qquad h = \frac{${a}}{n}`, note: md`Since $n = ${a}/h$.` },
            { math: md`\frac{\ln(1 + h)}{h} \to 1`, note: md`The difference quotient of $\ln x$ at $x = 1$, where the slope is $1/1 = 1$.` },
            { math: md`\ln a_n \to ${a}, \qquad a_n \to e^{${a}}`, note: md`Exponentiate: $e^x$ is continuous.` },
          ],
    };
  }
  if (kind === 3) {
    const a = r.int(2, 9);
    const s = r.pick([2, 3, 4]);
    const c = r.int(1, 9);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{${a}n}{\sqrt{${s * s}n^2 + ${c}}}$. Give an exact value, like 3/2.`,
      answer: frac(a, s),
      hint: md`Divide top and bottom by $n$. Under the square root, dividing by $n$ means dividing by $n^2$ inside.`,
      solution: [
        { math: md`\frac{${a}n}{\sqrt{${s * s}n^2 + ${c}}} = \frac{${a}}{\sqrt{${s * s} + \frac{${c}}{n^2}}}`, note: md`$n = \sqrt{n^2}$ for $n > 0$, so $\frac{\sqrt{${s * s}n^2 + ${c}}}{n} = \sqrt{\frac{${s * s}n^2 + ${c}}{n^2}}$.` },
        { math: md`\to \frac{${a}}{\sqrt{${s * s}}} = ${fracTex(a, s)}`, note: md`$\frac{${c}}{n^2} \to 0$.` },
      ],
    };
  }
  if (kind === 4) {
    const v = r.int(0, 2);
    const tex = v === 0 ? md`\frac{\ln n}{n}` : v === 1 ? md`\frac{\ln n}{n^2}` : md`\frac{(\ln n)^2}{n}`;
    const fx = v === 0 ? md`\frac{\ln x}{x}` : v === 1 ? md`\frac{\ln x}{x^2}` : md`\frac{(\ln x)^2}{x}`;
    const steps: Step[] =
      v === 0
        ? [{ math: md`\lim_{x \to \infty} \frac{\ln x}{x} = \lim_{x \to \infty} \frac{1/x}{1} = 0`, note: md`An $\frac{\infty}{\infty}$ form, so L'Hôpital's rule applies: differentiate top and bottom.` }]
        : v === 1
          ? [{ math: md`\lim_{x \to \infty} \frac{\ln x}{x^2} = \lim_{x \to \infty} \frac{1/x}{2x} = \lim_{x \to \infty} \frac{1}{2x^2} = 0`, note: "L'Hôpital once." }]
          : [
              { math: md`\lim_{x \to \infty} \frac{(\ln x)^2}{x} = \lim_{x \to \infty} \frac{2 \ln x \cdot \frac{1}{x}}{1} = \lim_{x \to \infty} \frac{2\ln x}{x}`, note: "L'Hôpital once; still an infinity-over-infinity form." },
              { math: md`= \lim_{x \to \infty} \frac{2/x}{1} = 0`, note: "L'Hôpital again." },
            ];
    return {
      prompt: md`Find $\lim_{n \to \infty} ${tex}$.`,
      answer: "0",
      hint: md`Look at the function $f(x) = ${fx}$ instead. If $f(x) \to L$ as $x \to \infty$, then $f(n) \to L$ too. Use L'Hôpital's rule.`,
      solution: [
        { math: md`a_n = f(n), \qquad f(x) = ${fx}`, note: md`The sequence is the function sampled at whole numbers, so a limit of $f$ is a limit of $a_n$.` },
        ...steps,
        { math: md`\lim_{n \to \infty} ${tex} = 0`, note: md`Logarithms grow, but slower than any positive power of $n$.` },
      ],
    };
  }
  if (kind === 5) {
    const c = r.int(2, 9);
    const v = r.int(0, 2);
    const tex = v === 0 ? md`\sqrt[n]{n}` : v === 1 ? md`\sqrt[n]{${c}}` : md`\sqrt[n]{${c}n}`;
    const inside = v === 0 ? "n" : v === 1 ? String(c) : `${c}n`;
    const logTop = v === 0 ? md`\ln n` : v === 1 ? md`\ln ${c}` : md`\ln ${c} + \ln n`;
    return {
      prompt: md`Find $\lim_{n \to \infty} ${tex}$.`,
      answer: "1",
      hint: md`Write $\sqrt[n]{${inside}} = (${inside})^{1/n}$ and take the natural log. You get $\frac{${logTop}}{n}$.`,
      solution: [
        { math: md`\ln a_n = \frac{1}{n} \ln(${inside}) = \frac{${logTop}}{n}`, note: "Logs turn the root into a quotient." },
        { math: md`\frac{${logTop}}{n} \to 0`, note: v === 1 ? md`A constant over $n$.` : md`$\frac{\ln n}{n} \to 0$ by L'Hôpital on $\frac{\ln x}{x}$${v === 2 ? md`, and $\frac{\ln ${c}}{n} \to 0$ as well` : ""}.` },
        { math: md`a_n = e^{\ln a_n} \to e^0 = 1`, note: md`$e^x$ is continuous.` },
      ],
    };
  }
  if (kind === 6) {
    const c = r.int(1, 9);
    return {
      prompt: md`Find $\lim_{n \to \infty} \left(${c} + \arctan n\right)$. Give an exact value in terms of $\pi$, like 2 + pi/2.`,
      answer: `${c} + pi/2`,
      hint: md`What happens to $\arctan x$ as $x \to \infty$? Think of the graph of $\tan$ near its asymptote.`,
      solution: [
        { math: md`\arctan n \to \frac{\pi}{2}`, note: md`$\tan \theta \to \infty$ as $\theta \to \frac{\pi}{2}^-$, so the inverse sends huge inputs to angles just under $\frac{\pi}{2}$.` },
        { math: md`${c} + \arctan n \to ${c} + \frac{\pi}{2}`, note: "The limit of a sum is the sum of the limits." },
      ],
    };
  }
  if (kind === 7) {
    const c = r.int(1, 9);
    const a = r.int(1, 9);
    const q = r.int(2, 5);
    const p = r.int(1, q - 1);
    const neg = r.next() < 0.4;
    const ratio = neg ? md`-\frac{${p}}{${q}}` : md`\frac{${p}}{${q}}`;
    return {
      prompt: md`Find $\lim_{n \to \infty} \left(${c} - ${a}\left(${ratio}\right)^{n}\right)$.`,
      answer: String(c),
      hint: md`A number with absolute value less than 1, raised to higher and higher powers, shrinks to 0.`,
      solution: [
        { math: md`\left|${ratio}\right| = \frac{${p}}{${q}} < 1, \qquad \left(${ratio}\right)^{n} \to 0`, note: neg ? "The sign flips each step, but the size shrinks to 0, so the whole thing goes to 0." : md`Each step multiplies by $\frac{${p}}{${q}}$, so the powers shrink to 0.` },
        { math: md`${c} - ${a} \cdot 0 = ${c}`, note: "Limit laws for the constant multiple and the difference." },
      ],
    };
  }
  const c = r.int(1, 9);
  const v = r.int(0, 2);
  const tex = v === 0 ? md`\frac{(-1)^n}{n}` : v === 1 ? md`${c} + \frac{(-1)^n}{n^2}` : md`\frac{\cos n}{n}`;
  const answer = v === 1 ? String(c) : "0";
  const wiggle = v === 2 ? md`\cos n` : md`(-1)^n`;
  const den = v === 1 ? "n^2" : "n";
  return {
    prompt: md`Find $\lim_{n \to \infty} ${tex}$.`,
    answer,
    hint: md`$${wiggle}$ bounces around but stays between $-1$ and $1$. Squeeze: $-\frac{1}{${den}} \le \frac{${wiggle}}{${den}} \le \frac{1}{${den}}$.`,
    solution: [
      { math: md`-\frac{1}{${den}} \le \frac{${wiggle}}{${den}} \le \frac{1}{${den}}`, note: md`Because $|${wiggle}| \le 1$.` },
      { math: md`\pm\frac{1}{${den}} \to 0, \qquad \text{so } \frac{${wiggle}}{${den}} \to 0`, note: "Squeeze theorem: trapped between two sequences with the same limit." },
      ...(v === 1 ? [{ math: md`${c} + 0 = ${c}`, note: "Add the constant." }] : []),
    ],
  };
};

const recursiveAndOscillating: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const c = r.int(2, 6);
    const k = c * c - c;
    return {
      prompt: md`The sequence with $a_1 = 1$ and $a_{n+1} = \sqrt{a_n + ${k}}$ is increasing and bounded above, so it converges to some limit $L$. Find $L$.`,
      answer: String(c),
      verify: [`L^2 = L + ${k}`],
      hint: md`If $a_n \to L$ then $a_{n+1} \to L$ as well. Take limits on both sides of the recursion: $L = \sqrt{L + ${k}}$.`,
      solution: [
        { math: md`L = \sqrt{L + ${k}}`, note: md`Let $n \to \infty$ in $a_{n+1} = \sqrt{a_n + ${k}}$. The square root is continuous, so the limit passes inside.` },
        { math: md`L^2 = L + ${k} \;\Rightarrow\; L^2 - L - ${k} = 0 \;\Rightarrow\; (L - ${c})(L + ${c - 1}) = 0`, note: "Square and factor." },
        { math: md`L = ${c}`, note: md`$L = -${c - 1}$ is impossible: every term is a square root, so $L \ge 0$. Check: $a_1 = 1$, $a_2 = \sqrt{${k + 1}} \approx ${Math.sqrt(k + 1).toFixed(2)}$, creeping up toward ${c}.` },
      ],
    };
  }
  if (kind === 1) {
    const m = r.int(2, 4);
    const k = r.int(1, 9);
    const L: Q = qnorm([k, m - 1]);
    return {
      prompt: md`The sequence with $a_1 = 0$ and $a_{n+1} = \frac{a_n + ${k}}{${m}}$ converges to some limit $L$. Find $L$. Give an exact value, like 7/2.`,
      answer: qtext(L),
      verify: [`${m} L = L + ${k}`],
      hint: md`Both $a_n$ and $a_{n+1}$ tend to $L$. Replace them both with $L$ and solve.`,
      solution: [
        { math: md`L = \frac{L + ${k}}{${m}}`, note: md`Take the limit of both sides of the recursion.` },
        { math: md`${m}L = L + ${k} \;\Rightarrow\; ${m - 1}L = ${k}`, note: "Clear the fraction and collect." },
        { math: md`L = ${qtex(L)}`, note: md`Check the first terms: $a_2 = ${fracTex(k, m)}$, $a_3 = ${fracTex(k + k * m, m * m)}$, climbing toward $${qtex(L)}$.` },
      ],
    };
  }
  if (kind === 2) {
    const c = r.int(2, 7);
    return {
      prompt: md`The sequence with $a_1 = ${c * c}$ and $a_{n+1} = \frac{1}{2}\left(a_n + \frac{${c * c}}{a_n}\right)$ is decreasing and positive, so it converges to some $L > 0$. Find $L$.`,
      answer: String(c),
      verify: [`2 L = L + ${c * c}/L`],
      hint: md`Take limits of both sides. You get $L = \frac{1}{2}\left(L + \frac{${c * c}}{L}\right)$, an equation you can solve.`,
      solution: [
        { math: md`L = \frac{1}{2}\left(L + \frac{${c * c}}{L}\right)`, note: md`$L > 0$, so dividing by $L$ in the limit is allowed.` },
        { math: md`2L = L + \frac{${c * c}}{L} \;\Rightarrow\; L = \frac{${c * c}}{L} \;\Rightarrow\; L^2 = ${c * c}`, note: "Multiply by 2, subtract L, multiply by L." },
        { math: md`L = ${c}`, note: md`The positive root. This is the Babylonian method for $\sqrt{${c * c}}$: average a guess with $${c * c}$ divided by the guess.` },
      ],
    };
  }
  if (kind === 3) {
    const v = r.int(0, 3);
    const c = r.int(2, 6);
    const tex = v === 0 ? md`(-1)^n \frac{n}{n + 1}` : v === 1 ? md`(-1)^n \left(${c} - \frac{1}{n}\right)` : v === 2 ? md`\frac{n^2 + 1}{n + 1}` : md`\sqrt{n} - ${c}`;
    const steps: Step[] =
      v === 0
        ? [
            { math: md`\frac{n}{n + 1} \to 1`, note: "The size of the terms approaches 1." },
            { math: md`a_{2k} \to 1, \qquad a_{2k + 1} \to -1`, note: "Even terms sit near 1, odd terms near -1." },
            { math: md`\text{diverges}`, note: "A sequence with one limit can't keep returning to two different values. No single band can capture all late terms." },
          ]
        : v === 1
          ? [
              { math: md`${c} - \frac{1}{n} \to ${c}`, note: "The size approaches a nonzero number." },
              { math: md`a_{2k} \to ${c}, \qquad a_{2k+1} \to -${c}`, note: "The sign alternates, so the terms jump between two values forever." },
              { math: md`\text{diverges}`, note: "No limit." },
            ]
          : v === 2
            ? [
                { math: md`\frac{n^2 + 1}{n + 1} = \frac{n + \frac{1}{n}}{1 + \frac{1}{n}}`, note: md`Divide top and bottom by $n$.` },
                { math: md`\to \infty`, note: "The top grows without bound while the bottom goes to 1. The degree on top is higher." },
                { math: md`\text{diverges}`, note: md`We say it *diverges to infinity*. It still has no limit, since $\infty$ is not a number.` },
              ]
            : [
                { math: md`\sqrt{n} \to \infty`, note: md`$\sqrt{n}$ passes any number you name: it passes $M$ once $n > M^2$.` },
                { math: md`\text{diverges}`, note: "Subtracting a constant doesn't stop it." },
              ];
    return {
      prompt: md`Find $\lim_{n \to \infty} ${tex}$ if it exists. If the sequence diverges, type **diverges**.`,
      accept: DNE,
      hint: v < 2 ? "Watch the sign. Do the even-numbered and odd-numbered terms head to the same place?" : "Compare the growth of the top and bottom. Does the sequence settle down to a number?",
      solution: steps,
    };
  }
  const c = r.int(2, 9);
  const v = r.int(0, 2);
  const tex = v === 0 ? md`\frac{(-1)^n}{n}` : v === 1 ? md`${c} + \frac{(-1)^n}{n^2}` : md`\frac{\cos(n\pi)}{n}`;
  const den = v === 1 ? "n^2" : "n";
  const wiggle = v === 2 ? md`\cos(n\pi)` : md`(-1)^n`;
  return {
    prompt: md`Find $\lim_{n \to \infty} ${tex}$ if it exists. If the sequence diverges, type **diverges**.`,
    answer: v === 1 ? String(c) : "0",
    hint: md`The sign flips, but what happens to the *size* of the terms? Squeeze between $\pm\frac{1}{${den}}$.`,
    solution: [
      { math: md`\left| \frac{${wiggle}}{${den}} \right| = \frac{1}{${den}} \to 0`, note: v === 2 ? md`$\cos(n\pi) = (-1)^n$, so it is just a sign.` : "The size of the wiggle shrinks to 0." },
      { math: md`-\frac{1}{${den}} \le \frac{${wiggle}}{${den}} \le \frac{1}{${den}}, \qquad \text{so } \frac{${wiggle}}{${den}} \to 0`, note: "Squeeze theorem. Alternating signs are fine as long as the terms shrink." },
      ...(v === 1 ? [{ math: md`\lim_{n \to \infty} a_n = ${c}`, note: "Add the constant." }] : []),
    ],
  };
};

// ── Lesson 2: Series and partial sums ───────────────────────────────────────

/** A ratio p/q as LaTeX, bracketed for raising to a power: \left(-\frac{2}{3}\right). */
const ratioTex = (p: number, q: number) => `\\left(${fracTex(p, q)}\\right)`;

const geometricSum: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 4) {
    // |r| >= 1: diverges.
    const a = r.int(1, 5);
    const [p, q] = r.pick<[number, number]>([[3, 2], [5, 4], [4, 3], [2, 1], [-3, 2], [-1, 1], [7, 5]]);
    const fromZero = r.next() < 0.5;
    return {
      prompt: md`Find the sum $\sum_{n=${fromZero ? 0 : 1}}^{\infty} ${a === 1 ? "" : a}${ratioTex(p, q)}^{n}$. Give an exact fraction. If the series diverges, type **diverges**.`,
      accept: DNE,
      hint: md`This is geometric with ratio $r = ${fracTex(p, q)}$. The formula $\frac{a}{1 - r}$ only applies when $|r| < 1$.`,
      solution: [
        { math: md`r = ${fracTex(p, q)}, \qquad |r| = ${fracTex(Math.abs(p), q)} \ge 1`, note: "The ratio is not between -1 and 1." },
        { math: md`|a_n| = ${a === 1 ? "" : a}\left(${fracTex(Math.abs(p), q)}\right)^{n} ${Math.abs(p) === q ? `= ${a}` : `\\to \\infty`}`, note: "The terms never shrink to 0." },
        { math: md`\text{diverges}`, note: "A series whose terms don't approach 0 cannot converge (the divergence test, proved in this lesson). The partial sums never settle." },
      ],
    };
  }
  const q = r.int(2, 7);
  let p = r.int(1, q - 1);
  while (gcd(p, q) !== 1) p = r.int(1, q - 1);
  if (r.next() < 0.35) p = -p;
  const ratio: Q = [p, q];
  const oneMinusR: Q = qadd([1, 1], [-p, q]);
  if (kind === 0 || kind === 1) {
    const a = r.int(1, 9);
    const first: Q = kind === 0 ? [a, 1] : qmul([a, 1], ratio);
    const S = qnorm([first[0] * oneMinusR[1], first[1] * oneMinusR[0]]);
    return {
      prompt: md`Find the sum $\sum_{n=${kind}}^{\infty} ${a === 1 ? "" : a}${ratioTex(p, q)}^{n}$. Give an exact fraction. If the series diverges, type **diverges**.`,
      answer: qtext(S),
      verify: [`S (1 - (${p}/${q})) = ${first[0]}/${first[1]}`],
      hint: md`Geometric, with ratio $r = ${fracTex(p, q)}$ and $|r| < 1$. The sum is $\frac{\text{first term}}{1 - r}$. The first term is the one with $n = ${kind}$.`,
      solution: [
        { math: md`r = ${fracTex(p, q)}, \qquad |r| < 1`, note: "So the series converges." },
        { math: md`\text{first term} = ${a === 1 ? "" : a}${ratioTex(p, q)}^{${kind}} = ${qtex(first)}`, note: kind === 0 ? md`$r^0 = 1$.` : md`The sum starts at $n = 1$, not $n = 0$, so the first term already has one factor of $r$.` },
        { math: md`S = \frac{${qtex(first)}}{1 - ${p < 0 ? `\\left(${fracTex(p, q)}\\right)` : fracTex(p, q)}} = \frac{${qtex(first)}}{${qtex(oneMinusR)}} = ${qtex(S)}`, note: md`Dividing by $${qtex(oneMinusR)}$ is multiplying by $${qtex([oneMinusR[1], oneMinusR[0]])}$.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(1, 8);
    const terms = [0, 1, 2, 3].map((k) => qmul([a, 1], [p ** k, q ** k]));
    let written = qtex(terms[0]!);
    for (const t of terms.slice(1)) written += t[0] < 0 ? ` - ${qtex([-t[0], t[1]])}` : ` + ${qtex(t)}`;
    const S = qnorm([a * oneMinusR[1], oneMinusR[0]]);
    return {
      prompt: md`Find the sum $${written} + \cdots$. Give an exact fraction.`,
      answer: qtext(S),
      verify: [`S (1 - (${p}/${q})) = ${a}`],
      hint: md`Divide any term by the one before it to find the common ratio. Then use $\frac{a}{1 - r}$.`,
      solution: [
        { math: md`r = \frac{${qtex(terms[1]!)}}{${a}} = ${fracTex(p, q)}`, note: md`Each term is the previous one times $${fracTex(p, q)}$. Check with the next pair: $${qtex(terms[2]!)} \div ${qtex(terms[1]!)} = ${fracTex(p, q)}$.` },
        { math: md`S = \frac{a}{1 - r} = \frac{${a}}{1 - ${p < 0 ? `\\left(${fracTex(p, q)}\\right)` : fracTex(p, q)}} = \frac{${a}}{${qtex(oneMinusR)}} = ${qtex(S)}`, note: md`First term $a = ${a}$, and $|r| < 1$ so the formula applies.` },
      ],
    };
  }
  // kind 3: p^n / q^(n+1), ratio p/q, first term 1/q. Needs |p| >= 2, or 1^n would appear.
  let pp = Math.abs(p);
  if (pp === 1) {
    const qq = r.int(3, 7);
    pp = r.int(2, qq - 1);
    while (gcd(pp, qq) !== 1) pp = r.int(2, qq - 1);
    return geometricKind3(pp, qq, r.next() < 0.5);
  }
  return geometricKind3(pp, q, r.next() < 0.5);
};

const geometricKind3 = (pp: number, q: number, fromOne: boolean) => {
  const tex = fromOne ? md`\frac{${pp}^{n-1}}{${q}^{n}}` : md`\frac{${pp}^{n}}{${q}^{n+1}}`;
  const S: Q = qnorm([1, q - pp]);
  return {
    prompt: md`Find the sum $\sum_{n=${fromOne ? 1 : 0}}^{\infty} ${tex}$. Give an exact fraction.`,
    answer: qtext(S),
    verify: [`S (1 - ${pp}/${q}) = 1/${q}`],
    hint: md`Rewrite the term as a constant times $\left(\frac{${pp}}{${q}}\right)^{\text{something}}$. Then read off the first term and the ratio.`,
    solution: [
      { math: fromOne ? md`\frac{${pp}^{n-1}}{${q}^{n}} = \frac{1}{${q}} \cdot \frac{${pp}^{n-1}}{${q}^{n-1}} = \frac{1}{${q}}\left(\frac{${pp}}{${q}}\right)^{n-1}` : md`\frac{${pp}^{n}}{${q}^{n+1}} = \frac{1}{${q}} \cdot \frac{${pp}^{n}}{${q}^{n}} = \frac{1}{${q}}\left(\frac{${pp}}{${q}}\right)^{n}`, note: md`Peel one factor of $${q}$ off the bottom.` },
      { math: md`\text{first term} = \frac{1}{${q}}, \qquad r = \frac{${pp}}{${q}}`, note: fromOne ? md`At $n = 1$ the power is $0$.` : md`At $n = 0$ the power is $0$.` },
      { math: md`S = \frac{1/${q}}{1 - ${pp}/${q}} = \frac{1/${q}}{${q - pp}/${q}} = ${qtex(S)}`, note: md`Multiply top and bottom by $${q}$.` },
    ],
  };
};

/** 1/(a+1) + ... + 1/(a+k) as a fraction. */
const harmonicSlice = (a: number, k: number): Q => {
  let s: Q = [0, 1];
  for (let j = 1; j <= k; j++) s = qadd(s, [1, a + j]);
  return s;
};

const telescopingSum: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    // sum_{n=m}^inf 1/(n(n+1)) = 1/m
    const m = r.int(1, 5);
    return {
      prompt: md`Find the sum $\sum_{n=${m}}^{\infty} \frac{1}{n(n + 1)}$. Give an exact fraction.`,
      answer: frac(1, m),
      verify: [`${m} S = 1`],
      hint: md`Split with partial fractions: $\frac{1}{n(n+1)} = \frac{1}{n} - \frac{1}{n+1}$. Then write out a partial sum and watch the middle cancel.`,
      solution: [
        { math: md`\frac{1}{n(n+1)} = \frac{1}{n} - \frac{1}{n + 1}`, note: md`Partial fractions (Algebra 3, Unit 4). Check: $\frac{(n+1) - n}{n(n+1)} = \frac{1}{n(n+1)}$.` },
        { math: md`S_N = \left(\frac{1}{${m}} - \frac{1}{${m + 1}}\right) + \left(\frac{1}{${m + 1}} - \frac{1}{${m + 2}}\right) + \cdots + \left(\frac{1}{N} - \frac{1}{N + 1}\right)`, note: md`The partial sum from $n = ${m}$ to $N$.` },
        { math: md`S_N = \frac{1}{${m}} - \frac{1}{N + 1}`, note: "Every negative piece cancels the next positive piece. Only the first and last survive." },
        { math: md`S = \lim_{N \to \infty} S_N = \frac{1}{${m}} - 0 = ${fracTex(1, m)}`, note: md`$\frac{1}{N+1} \to 0$.` },
      ],
    };
  }
  if (kind === 1) {
    // sum_{n=1}^inf c/((n+a)(n+a+k))
    const a = r.int(0, 2);
    const k = r.int(2, 3);
    const c = r.pick([1, 1, k, 2 * k]);
    const base = harmonicSlice(a, k);
    const S = qmul([c, k], base);
    const nA = a === 0 ? "n" : `(n + ${a})`;
    const nB = `(n + ${a + k})`;
    const firstBits = Array.from({ length: k }, (_, j) => `\\frac{1}{${a + j + 1}}`).join(" + ");
    const lastBits = Array.from({ length: k }, (_, j) => `\\frac{1}{N + ${a + j + 1}}`).join(" - ");
    const coef = c === k ? "" : `${fracTex(c, k)}`;
    return {
      prompt: md`Find the sum $\sum_{n=1}^{\infty} \frac{${c}}{${nA}${nB}}$. Give an exact fraction.`,
      answer: qtext(S),
      verify: [`${k} S = ${c} (${Array.from({ length: k }, (_, j) => `1/${a + j + 1}`).join(" + ")})`],
      hint: md`Partial fractions: $\frac{${c}}{${nA}${nB}} = ${fracTex(c, k)}\left(\frac{1}{${nA}} - \frac{1}{${nB}}\right)$. In the partial sum, each term cancels with one that comes ${k} steps later, so ${k} pieces survive at the front.`,
      solution: [
        { math: md`\frac{${c}}{${nA}${nB}} = ${fracTex(c, k)}\left(\frac{1}{${nA}} - \frac{1}{${nB}}\right)`, note: md`The two denominators differ by ${k}, so $\frac{1}{${nA}} - \frac{1}{${nB}} = \frac{${k}}{${nA}${nB}}$; scale by $${fracTex(c, k)}$.` },
        { math: md`S_N = ${fracTex(c, k)}\left[\left(${firstBits}\right) - \left(${lastBits}\right)\right]`, note: md`Write out the partial sum: each $-\frac{1}{${nB}}$ cancels the $+\frac{1}{${nA}}$ that appears ${k} terms later. The first ${k} positive pieces and the last ${k} negative pieces have no partner.` },
        { math: md`S = \lim_{N \to \infty} S_N = ${fracTex(c, k)}\left(${firstBits}\right) = ${coef ? `${coef} \\cdot ${qtex(base)} = ` : ""}${qtex(S)}`, note: md`Each $\frac{1}{N + \text{const}} \to 0$.` },
      ],
    };
  }
  if (kind === 2) {
    const c = r.int(1, 6);
    const S: Q = qnorm([c, 2]);
    return {
      prompt: md`Find the sum $\sum_{n=1}^{\infty} \frac{${c}}{(2n - 1)(2n + 1)}$. Give an exact fraction.`,
      answer: qtext(S),
      verify: [`2 S = ${c} (1 - 0)`],
      hint: md`$\frac{1}{(2n-1)(2n+1)} = \frac{1}{2}\left(\frac{1}{2n - 1} - \frac{1}{2n + 1}\right)$. The odd numbers $1, 3, 5, \ldots$ telescope.`,
      solution: [
        { math: md`\frac{${c}}{(2n-1)(2n+1)} = \frac{${c}}{2}\left(\frac{1}{2n-1} - \frac{1}{2n+1}\right)`, note: md`Since $\frac{1}{2n-1} - \frac{1}{2n+1} = \frac{2}{(2n-1)(2n+1)}$.` },
        { math: md`S_N = \frac{${c}}{2}\left[\left(1 - \frac{1}{3}\right) + \left(\frac{1}{3} - \frac{1}{5}\right) + \cdots + \left(\frac{1}{2N-1} - \frac{1}{2N+1}\right)\right] = \frac{${c}}{2}\left(1 - \frac{1}{2N+1}\right)`, note: "The inner pieces cancel in pairs." },
        { math: md`S = \frac{${c}}{2}(1 - 0) = ${qtex(S)}`, note: md`$\frac{1}{2N + 1} \to 0$.` },
      ],
    };
  }
  const v = r.int(0, 1);
  const tex = v === 0 ? md`\left(\sqrt{n + 1} - \sqrt{n}\right)` : md`\ln\left(\frac{n + 1}{n}\right)`;
  return {
    prompt: md`Find the sum $\sum_{n=1}^{\infty} ${tex}$. Give an exact value. If the series diverges, type **diverges**.`,
    accept: DNE,
    hint: v === 0 ? "It telescopes. Write out the partial sum and see what is left; then ask whether that has a limit." : md`$\ln\frac{n+1}{n} = \ln(n + 1) - \ln n$. It telescopes. Does the leftover have a limit?`,
    solution:
      v === 0
        ? [
            { math: md`S_N = (\sqrt{2} - \sqrt{1}) + (\sqrt{3} - \sqrt{2}) + \cdots + (\sqrt{N+1} - \sqrt{N}) = \sqrt{N + 1} - 1`, note: "Everything cancels except the last positive and first negative piece." },
            { math: md`\sqrt{N + 1} - 1 \to \infty`, note: "The partial sums grow without bound." },
            { math: md`\text{diverges}`, note: md`Even though the terms $\sqrt{n+1} - \sqrt{n} = \frac{1}{\sqrt{n+1} + \sqrt{n}} \to 0$. Terms going to 0 is not enough.` },
          ]
        : [
            { math: md`\ln\left(\frac{n+1}{n}\right) = \ln(n + 1) - \ln n`, note: "Log of a quotient." },
            { math: md`S_N = (\ln 2 - \ln 1) + (\ln 3 - \ln 2) + \cdots + (\ln(N+1) - \ln N) = \ln(N + 1)`, note: md`Telescopes, and $\ln 1 = 0$.` },
            { math: md`\ln(N + 1) \to \infty, \qquad \text{diverges}`, note: "Slowly, but without bound. The terms do go to 0; that alone never guarantees convergence." },
          ],
  };
};

const partialSumCompute: Generator = (r) => {
  const kind = r.int(0, 1);
  if (kind === 0) {
    const q = r.int(2, 5);
    let p = r.int(1, q - 1);
    while (gcd(p, q) !== 1) p = r.int(1, q - 1);
    const a = r.int(1, 6);
    const N = r.int(3, 4);
    const terms = Array.from({ length: N }, (_, k) => qmul([a, 1], [p ** k, q ** k]));
    const total = terms.reduce((s, t) => qadd(s, t), [0, 1] as Q);
    const written = terms.map(qtex).join(" + ");
    const rN: Q = [p ** N, q ** N];
    return {
      prompt: md`Compute $${written}$, the partial sum $S_{${N}}$ of the geometric series $\sum_{n=0}^{\infty} ${a === 1 ? "" : a}\left(\frac{${p}}{${q}}\right)^{n}$. Give an exact fraction.`,
      answer: qtext(total),
      verify: [`S (1 - ${p}/${q}) = ${a} (1 - (${p}/${q})^${N})`],
      hint: md`Either add the fractions directly, or use $S_N = a\,\frac{1 - r^N}{1 - r}$ with $a = ${a}$, $r = \frac{${p}}{${q}}$, $N = ${N}$.`,
      solution: [
        { math: md`S_{${N}} = ${a} \cdot \frac{1 - \left(\frac{${p}}{${q}}\right)^{${N}}}{1 - \frac{${p}}{${q}}}`, note: md`The formula derived in this lesson: $(1 - r)S_N = a(1 - r^N)$.` },
        { math: md`= ${a} \cdot \frac{1 - ${qtex(rN)}}{${fracTex(q - p, q)}} = ${a} \cdot \frac{${qtex(qadd([1, 1], [-rN[0], rN[1]]))}}{${fracTex(q - p, q)}}`, note: md`$\left(\frac{${p}}{${q}}\right)^{${N}} = ${qtex(rN)}$.` },
        { math: md`S_{${N}} = ${qtex(total)}`, note: md`Adding the ${N} fractions directly gives the same thing. For comparison, the whole series sums to $\frac{${a}}{1 - ${p}/${q}} = ${fracTex(a * q, q - p)}$.` },
      ],
    };
  }
  const N = r.int(3, 5);
  const written = Array.from({ length: N }, (_, k) => `\\frac{1}{${k + 1} \\cdot ${k + 2}}`).join(" + ");
  return {
    prompt: md`Compute $${written}$, the partial sum $S_{${N}}$ of $\sum_{n=1}^{\infty} \frac{1}{n(n+1)}$. Give an exact fraction.`,
    answer: frac(N, N + 1),
    verify: [`S = 1 - 1/${N + 1}`],
    hint: md`Each piece is $\frac{1}{n} - \frac{1}{n+1}$. Written that way, the sum collapses.`,
    solution: [
      { math: md`\frac{1}{n(n+1)} = \frac{1}{n} - \frac{1}{n+1}`, note: "Partial fractions." },
      { math: md`S_{${N}} = \left(1 - \frac{1}{2}\right) + \left(\frac{1}{2} - \frac{1}{3}\right) + \cdots + \left(\frac{1}{${N}} - \frac{1}{${N + 1}}\right)`, note: "Write every piece out." },
      { math: md`S_{${N}} = 1 - \frac{1}{${N + 1}} = ${fracTex(N, N + 1)}`, note: md`The inner terms cancel. In general $S_N = \frac{N}{N + 1}$, which heads to 1.` },
    ],
  };
};

// ── Lesson 3: The integral test ─────────────────────────────────────────────

const CONV = ["converges", "diverges"];

const pSeries: Generator = (r) => {
  const k = r.int(2, 5);
  const c = r.int(2, 9);
  const forms: { tex: string; p: Q; why: string }[] = [
    { tex: md`\frac{1}{n^{${k}}}`, p: [k, 1], why: md`Already in the form $\frac{1}{n^p}$ with $p = ${k}$.` },
    { tex: md`\frac{1}{n}`, p: [1, 1], why: md`The harmonic series: $p = 1$.` },
    { tex: md`\frac{1}{\sqrt{n}}`, p: [1, 2], why: md`$\sqrt{n} = n^{1/2}$, so $p = \frac{1}{2}$.` },
    { tex: md`\frac{1}{\sqrt[3]{n}}`, p: [1, 3], why: md`$\sqrt[3]{n} = n^{1/3}$, so $p = \frac{1}{3}$.` },
    { tex: md`\frac{1}{n\sqrt{n}}`, p: [3, 2], why: md`$n \cdot n^{1/2} = n^{3/2}$, so $p = \frac{3}{2}$.` },
    { tex: md`\frac{1}{\sqrt[3]{n^{4}}}`, p: [4, 3], why: md`$\sqrt[3]{n^4} = n^{4/3}$, so $p = \frac{4}{3}$.` },
    { tex: md`\frac{1}{\sqrt[3]{n^{2}}}`, p: [2, 3], why: md`$\sqrt[3]{n^2} = n^{2/3}$, so $p = \frac{2}{3}$.` },
    { tex: md`\frac{\sqrt{n}}{n^{2}}`, p: [3, 2], why: md`$\frac{n^{1/2}}{n^2} = n^{-3/2}$, so $p = \frac{3}{2}$.` },
    { tex: md`\frac{${c}}{n^{2}}`, p: [2, 1], why: md`A constant multiple of $\frac{1}{n^2}$; the constant doesn't affect convergence. $p = 2$.` },
    { tex: md`\frac{1}{\sqrt{n^{3}}}`, p: [3, 2], why: md`$\sqrt{n^3} = n^{3/2}$, so $p = \frac{3}{2}$.` },
    { tex: md`n^{-3/2}`, p: [3, 2], why: md`$n^{-3/2} = \frac{1}{n^{3/2}}$, so $p = \frac{3}{2}$.` },
    { tex: md`n^{-2/3}`, p: [2, 3], why: md`$p = \frac{2}{3}$.` },
    { tex: md`n^{-1/2}`, p: [1, 2], why: md`$p = \frac{1}{2}$.` },
    { tex: md`\frac{n^{2}}{n^{${k + 2}}}`, p: [k, 1], why: md`$\frac{n^2}{n^{${k + 2}}} = \frac{1}{n^{${k}}}$, so $p = ${k}$.` },
    { tex: md`\frac{1}{n^{1.01}}`, p: [101, 100], why: md`$p = 1.01$. Barely, but $p > 1$.` },
    { tex: md`\frac{1}{n^{0.99}}`, p: [99, 100], why: md`$p = 0.99$. Just under 1.` },
    { tex: md`\frac{n}{\sqrt{n^{5}}}`, p: [3, 2], why: md`$\frac{n}{n^{5/2}} = n^{-3/2}$, so $p = \frac{3}{2}$.` },
    { tex: md`\frac{\sqrt[3]{n}}{n}`, p: [2, 3], why: md`$\frac{n^{1/3}}{n} = n^{-2/3}$, so $p = \frac{2}{3}$.` },
  ];
  const f = r.pick(forms);
  const pv = f.p[0] / f.p[1];
  const conv = pv > 1;
  const ptex = f.p[1] === 1 ? String(f.p[0]) : f.p[1] === 100 ? (pv).toFixed(2) : fracTex(f.p[0], f.p[1]);
  return {
    prompt: md`Does $\sum_{n=1}^{\infty} ${f.tex}$ converge or diverge?`,
    choices: CONV,
    accept: [conv ? "converges" : "diverges"],
    hint: md`Write the term as $\frac{1}{n^p}$ (a constant in front doesn't matter). A $p$-series converges exactly when $p > 1$.`,
    solution: [
      { math: md`${f.tex} = ${f.tex.startsWith("\\frac{" + c) ? `${c} \\cdot ` : ""}\frac{1}{n^{${ptex}}}`, note: f.why },
      { math: md`p = ${ptex} ${conv ? ">" : "\\le"} 1`, note: conv ? md`$p > 1$: the integral $\int_1^\infty x^{-p}\,dx = \frac{1}{p - 1}$ is finite, so the series **converges**.` : pv === 1 ? md`$p = 1$: $\int_1^\infty \frac{dx}{x} = \lim \ln b = \infty$, so the series **diverges**.` : md`$p < 1$: $\int_1^\infty x^{-p}\,dx$ grows like $b^{1-p} \to \infty$, so the series **diverges**.` },
    ],
  };
};

const remainderBound: Generator = (r) => {
  const p = r.int(2, 4);
  const kind = r.int(0, 1);
  if (kind === 0) {
    const N = r.pick([4, 5, 10, 20, 100]);
    const den = (p - 1) * N ** (p - 1);
    return {
      prompt: md`You approximate $\sum_{n=1}^{\infty} \frac{1}{n^{${p}}}$ by its partial sum $S_{${N}}$. Use the remainder bound $R_N \le \int_N^{\infty} f(x)\,dx$ to find the largest the error $S - S_{${N}}$ could be. Give an exact fraction.`,
      answer: frac(1, den),
      verify: [`B = 0 - (-1/(${p - 1} * ${N}^${p - 1}))`],
      hint: md`Compute $\int_{${N}}^{\infty} x^{-${p}}\,dx$ as a limit. The antiderivative of $x^{-${p}}$ is $\frac{x^{-${p - 1}}}{-${p - 1}}$.`,
      solution: [
        { math: md`R_{${N}} \le \int_{${N}}^{\infty} \frac{dx}{x^{${p}}} = \lim_{b \to \infty} \left[-\frac{1}{${p - 1}x^{${p - 1}}}\right]_{${N}}^{b}`, note: md`The tail of the series is a sum of right-endpoint rectangles under $y = 1/x^{${p}}$ starting at $x = ${N}$, so it is at most the area under the curve from ${N} on.` },
        { math: md`= \lim_{b \to \infty}\left(-\frac{1}{${p - 1}b^{${p - 1}}} + \frac{1}{${p - 1} \cdot ${N}^{${p - 1}}}\right) = \frac{1}{${p - 1} \cdot ${N ** (p - 1)}}`, note: md`The $b$ term goes to 0.` },
        { math: md`R_{${N}} \le ${fracTex(1, den)}`, note: md`So $S_{${N}}$ is within $${fracTex(1, den)}$ of the true sum, and it is an underestimate: every term is positive, so the remainder $S - S_{${N}}$ is positive.` },
      ],
    };
  }
  const tol = r.pick(p === 2 ? [0.01, 0.02, 0.05] : p === 3 ? [0.01, 0.001, 0.005] : [0.01, 0.001]);
  // Smallest N with 1/((p-1) N^(p-1)) <= tol.
  const exact = Math.pow(1 / ((p - 1) * tol), 1 / (p - 1));
  let N = Math.max(1, Math.floor(exact) - 1);
  while (1 / ((p - 1) * N ** (p - 1)) > tol + 1e-12) N++;
  const tolTex = String(tol);
  return {
    prompt: md`How many terms of $\sum_{n=1}^{\infty} \frac{1}{n^{${p}}}$ are needed so that the remainder bound $\int_N^{\infty} x^{-${p}}\,dx$ is at most ${tolTex}? Give the smallest whole number $N$.`,
    answer: String(N),
    hint: md`First find $\int_N^\infty x^{-${p}}\,dx$ in terms of $N$: it is $\frac{1}{${p - 1}N^{${p - 1}}}$. Then make that at most ${tolTex} and solve for $N$.`,
    solution: [
      { math: md`R_N \le \int_N^{\infty} \frac{dx}{x^{${p}}} = \frac{1}{${p - 1}N^{${p - 1}}}`, note: md`Antiderivative $-\frac{1}{${p - 1}x^{${p - 1}}}$, evaluated from $N$ to $\infty$.` },
      { math: md`\frac{1}{${p - 1}N^{${p - 1}}} \le ${tolTex} \iff N^{${p - 1}} \ge \frac{1}{${p - 1} \cdot ${tolTex}} = ${(1 / ((p - 1) * tol)).toFixed(p === 2 ? 0 : 2).replace(/\.00$/, "")}`, note: "Flip both sides (positive quantities), then clear the constant." },
      { math: p === 2 ? md`N \ge ${N}` : md`N \ge \sqrt${p === 4 ? "[3]" : ""}{${(1 / ((p - 1) * tol)).toFixed(2).replace(/\.00$/, "")}} \approx ${exact.toFixed(2)}, \qquad N = ${N}`, note: md`$N = ${N}$ is the first whole number that works${N > 1 ? md`: at $N = ${N - 1}$ the bound is $${fracTex(1, (p - 1) * (N - 1) ** (p - 1))} \approx ${(1 / ((p - 1) * (N - 1) ** (p - 1))).toFixed(4)}$, which is too big` : ""}.` },
    ],
  };
};

const integralTestDecide: Generator = (r) => {
  const k = r.pick([1, 4, 9]);
  const s = Math.sqrt(k);
  const a = r.int(2, 4);
  const b = r.int(1, 5);
  const m = r.int(2, 3);
  const items: { tex: string; from: number; conv: boolean; steps: Step[] }[] = [
    {
      tex: md`\frac{1}{n^2 + ${k}}`,
      from: 1,
      conv: true,
      steps: [
        { math: md`\int_1^{\infty} \frac{dx}{x^2 + ${k}} = \lim_{b \to \infty} \left[\frac{1}{${s}}\arctan\frac{x}{${s}}\right]_1^{b}`, note: md`$f(x) = \frac{1}{x^2 + ${k}}$ is positive, continuous and decreasing for $x \ge 1$.` },
        { math: md`= \frac{1}{${s}}\left(\frac{\pi}{2} - \arctan\frac{1}{${s}}\right)`, note: md`$\arctan b \to \frac{\pi}{2}$. A finite number.` },
      ],
    },
    {
      tex: md`\frac{n}{n^2 + ${k}}`,
      from: 1,
      conv: false,
      steps: [
        { math: md`\int_1^{\infty} \frac{x\,dx}{x^2 + ${k}} = \lim_{b \to \infty}\left[\tfrac{1}{2}\ln(x^2 + ${k})\right]_1^{b}`, note: md`$u = x^2 + ${k}$, $du = 2x\,dx$. The function is positive and decreasing for $x \ge ${s === 1 ? 1 : s}$ (its derivative $\frac{${k} - x^2}{(x^2 + ${k})^2}$ is negative there), which is all the test needs.` },
        { math: md`= \lim_{b \to \infty} \tfrac{1}{2}\ln(b^2 + ${k}) - \tfrac{1}{2}\ln ${k + 1} = \infty`, note: "The log grows without bound." },
      ],
    },
    {
      tex: md`\frac{1}{n \ln n}`,
      from: 2,
      conv: false,
      steps: [
        { math: md`\int_2^{\infty} \frac{dx}{x \ln x} = \lim_{b \to \infty}\left[\ln(\ln x)\right]_2^{b}`, note: md`$u = \ln x$, $du = \frac{dx}{x}$: the integrand becomes $\frac{du}{u}$.` },
        { math: md`= \lim_{b \to \infty} \ln(\ln b) - \ln(\ln 2) = \infty`, note: md`$\ln(\ln b)$ grows extremely slowly, but it does pass every number.` },
      ],
    },
    {
      tex: md`\frac{1}{n (\ln n)^{${m}}}`,
      from: 2,
      conv: true,
      steps: [
        { math: md`\int_2^{\infty} \frac{dx}{x (\ln x)^{${m}}} = \int_{\ln 2}^{\infty} \frac{du}{u^{${m}}}`, note: md`$u = \ln x$, $du = \frac{dx}{x}$.` },
        { math: md`= \left[-\frac{1}{${m - 1}u^{${m - 1}}}\right]_{\ln 2}^{\infty} = \frac{1}{${m - 1}(\ln 2)^{${m - 1}}}`, note: md`A $p$-integral with $p = ${m} > 1$: finite.` },
      ],
    },
    {
      tex: md`n e^{-n^2}`,
      from: 1,
      conv: true,
      steps: [
        { math: md`\int_1^{\infty} x e^{-x^2}\,dx = \lim_{b \to \infty}\left[-\tfrac{1}{2}e^{-x^2}\right]_1^{b}`, note: md`$u = -x^2$, $du = -2x\,dx$. For $x \ge 1$ the function is positive and decreasing.` },
        { math: md`= 0 + \tfrac{1}{2}e^{-1} = \frac{1}{2e}`, note: md`$e^{-b^2} \to 0$. Finite.` },
      ],
    },
    {
      tex: md`\frac{\ln n}{n}`,
      from: 1,
      conv: false,
      steps: [
        { math: md`\int_1^{\infty} \frac{\ln x}{x}\,dx = \lim_{b \to \infty}\left[\tfrac{1}{2}(\ln x)^2\right]_1^{b}`, note: md`$u = \ln x$. The function decreases for $x \ge e$, which is enough.` },
        { math: md`= \lim_{b \to \infty} \tfrac{1}{2}(\ln b)^2 = \infty`, note: "Diverges." },
      ],
    },
    {
      tex: md`\frac{\ln n}{n^2}`,
      from: 1,
      conv: true,
      steps: [
        { math: md`\int_1^{\infty} \frac{\ln x}{x^2}\,dx = \left[-\frac{\ln x}{x} - \frac{1}{x}\right]_1^{\infty}`, note: md`Integration by parts with $u = \ln x$, $dv = x^{-2}dx$ (Unit 2).` },
        { math: md`= (0 - 0) - (0 - 1) = 1`, note: md`$\frac{\ln b}{b} \to 0$ by L'Hôpital. Finite.` },
      ],
    },
    {
      tex: md`\frac{1}{(${a}n + ${b})^2}`,
      from: 1,
      conv: true,
      steps: [
        { math: md`\int_1^{\infty} \frac{dx}{(${a}x + ${b})^2} = \lim_{b \to \infty}\left[-\frac{1}{${a}(${a}x + ${b})}\right]_1^{b}`, note: md`$u = ${a}x + ${b}$, $du = ${a}\,dx$.` },
        { math: md`= \frac{1}{${a}(${a + b})} = \frac{1}{${a * (a + b)}}`, note: "Finite." },
      ],
    },
    {
      tex: md`\frac{1}{\sqrt{n + ${b}}}`,
      from: 1,
      conv: false,
      steps: [
        { math: md`\int_1^{\infty} \frac{dx}{\sqrt{x + ${b}}} = \lim_{b \to \infty}\left[2\sqrt{x + ${b}}\right]_1^{b} = \infty`, note: md`$u = x + ${b}$. The square root grows without bound.` },
      ],
    },
    {
      tex: md`\frac{n}{e^{n}}`,
      from: 1,
      conv: true,
      steps: [
        { math: md`\int_1^{\infty} x e^{-x}\,dx = \lim_{b \to \infty}\left[-(x + 1)e^{-x}\right]_1^{b}`, note: md`Integration by parts: $u = x$, $dv = e^{-x}dx$. The function decreases for $x \ge 1$.` },
        { math: md`= 0 + 2e^{-1} = \frac{2}{e}`, note: md`$(b + 1)e^{-b} \to 0$ since exponentials beat powers. Finite.` },
      ],
    },
    {
      tex: md`\frac{1}{n^2 + n}`,
      from: 1,
      conv: true,
      steps: [
        { math: md`\int_1^{\infty} \frac{dx}{x(x + 1)} = \lim_{b \to \infty}\left[\ln\frac{x}{x + 1}\right]_1^{b}`, note: md`Partial fractions: $\frac{1}{x} - \frac{1}{x+1}$.` },
        { math: md`= \ln 1 - \ln\tfrac{1}{2} = \ln 2`, note: md`$\frac{b}{b+1} \to 1$. Finite.` },
      ],
    },
    {
      tex: md`\frac{\arctan n}{n^2 + 1}`,
      from: 1,
      conv: true,
      steps: [
        { math: md`\int_1^{\infty} \frac{\arctan x}{1 + x^2}\,dx = \left[\tfrac{1}{2}(\arctan x)^2\right]_1^{\infty}`, note: md`$u = \arctan x$, $du = \frac{dx}{1 + x^2}$.` },
        { math: md`= \tfrac{1}{2}\left(\frac{\pi}{2}\right)^2 - \tfrac{1}{2}\left(\frac{\pi}{4}\right)^2 = \frac{3\pi^2}{32}`, note: "Finite." },
      ],
    },
  ];
  const it = r.pick(items);
  return {
    prompt: md`Use the integral test to decide: does $\sum_{n=${it.from}}^{\infty} ${it.tex}$ converge or diverge?`,
    choices: CONV,
    accept: [it.conv ? "converges" : "diverges"],
    hint: md`Replace $n$ by $x$ and compute $\int_{${it.from}}^{\infty} f(x)\,dx$ as a limit. A finite integral means a convergent series; an infinite one means divergence. Check that $f$ is positive and eventually decreasing.`,
    solution: [...it.steps, { math: md`\text{${it.conv ? "converges" : "diverges"}}`, note: it.conv ? "The integral is finite, so by the integral test the series converges. (The sum itself is a different number from the integral.)" : "The integral is infinite, so by the integral test the series diverges." }],
  };
};

// ── Lesson 4: Comparison tests ──────────────────────────────────────────────

const directComparison: Generator = (r) => {
  const p = r.int(2, 3);
  const k = r.int(1, 9);
  const a = r.int(2, 5);
  const items: { tex: string; conv: boolean; steps: Step[] }[] = [
    {
      tex: md`\frac{1}{n^{${p}} + ${k}}`,
      conv: true,
      steps: [
        { math: md`0 < \frac{1}{n^{${p}} + ${k}} < \frac{1}{n^{${p}}}`, note: md`A bigger denominator makes a smaller fraction.` },
        { math: md`\sum \frac{1}{n^{${p}}} \text{ converges}`, note: md`$p$-series with $p = ${p} > 1$.` },
      ],
    },
    {
      tex: md`\frac{1}{\sqrt{n} + ${k}}`,
      conv: false,
      steps: [
        { math: md`\frac{1}{\sqrt{n} + ${k}} \ge \frac{1}{\sqrt{n} + ${k}\sqrt{n}} = \frac{1}{${k + 1}} \cdot \frac{1}{\sqrt{n}}`, note: md`For $n \ge 1$, $${k} \le ${k}\sqrt{n}$, so the denominator on the right is bigger and the fraction smaller.` },
        { math: md`\sum \frac{1}{${k + 1}\sqrt{n}} \text{ diverges}`, note: md`$p$-series with $p = \frac{1}{2}$, times a constant.` },
      ],
    },
    {
      tex: md`\frac{1}{n + ${k}}`,
      conv: false,
      steps: [
        { math: md`\frac{1}{n + ${k}} \ge \frac{1}{n + ${k}n} = \frac{1}{${k + 1}n}`, note: md`Since $${k} \le ${k}n$ for $n \ge 1$.` },
        { math: md`\sum \frac{1}{${k + 1}n} \text{ diverges}`, note: "A constant times the harmonic series." },
      ],
    },
    {
      tex: md`\frac{n}{n^{3} + ${k}}`,
      conv: true,
      steps: [
        { math: md`0 < \frac{n}{n^3 + ${k}} < \frac{n}{n^3} = \frac{1}{n^2}`, note: "Shrinking the denominator enlarges the fraction." },
        { math: md`\sum \frac{1}{n^2} \text{ converges}`, note: md`$p = 2$.` },
      ],
    },
    {
      tex: md`\frac{n + ${k}}{n^{2}}`,
      conv: false,
      steps: [
        { math: md`\frac{n + ${k}}{n^2} > \frac{n}{n^2} = \frac{1}{n}`, note: "Dropping a positive part of the numerator makes it smaller." },
        { math: md`\sum \frac{1}{n} \text{ diverges}`, note: "Harmonic series." },
      ],
    },
    {
      tex: md`\frac{${a} + \sin n}{n^{2}}`,
      conv: true,
      steps: [
        { math: md`0 < \frac{${a} + \sin n}{n^2} \le \frac{${a + 1}}{n^2}`, note: md`$-1 \le \sin n \le 1$, so the top is between ${a - 1} and ${a + 1}.` },
        { math: md`\sum \frac{${a + 1}}{n^2} \text{ converges}`, note: md`$p = 2$, times a constant.` },
      ],
    },
    {
      tex: md`\frac{${a} + \sin n}{n}`,
      conv: false,
      steps: [
        { math: md`\frac{${a} + \sin n}{n} \ge \frac{${a - 1}}{n}`, note: md`$\sin n \ge -1$, so the numerator is at least ${a - 1}.` },
        { math: md`\sum \frac{${a - 1}}{n} \text{ diverges}`, note: "A constant times the harmonic series." },
      ],
    },
    {
      tex: md`\frac{1}{${a}^{n} + ${k}}`,
      conv: true,
      steps: [
        { math: md`0 < \frac{1}{${a}^n + ${k}} < \frac{1}{${a}^n} = \left(\frac{1}{${a}}\right)^{n}`, note: "Bigger denominator, smaller fraction." },
        { math: md`\sum \left(\frac{1}{${a}}\right)^{n} \text{ converges}`, note: md`Geometric with $r = \frac{1}{${a}} < 1$.` },
      ],
    },
    {
      tex: md`\frac{1}{${a}^{n} - 1}`,
      conv: true,
      steps: [
        { math: md`${a}^n - 1 \ge \tfrac{1}{2} \cdot ${a}^n \quad (n \ge 1), \qquad \text{so } \frac{1}{${a}^n - 1} \le \frac{2}{${a}^n}`, note: md`Because $${a}^n \ge 2$ means $${a}^n - 1 \ge ${a}^n - \frac{1}{2}${a}^n$.` },
        { math: md`\sum \frac{2}{${a}^n} \text{ converges}`, note: md`Geometric, $r = \frac{1}{${a}}$.` },
      ],
    },
    {
      tex: md`\frac{\ln n}{n}`,
      conv: false,
      steps: [
        { math: md`\frac{\ln n}{n} \ge \frac{1}{n} \quad \text{for } n \ge 3`, note: md`$\ln n \ge 1$ once $n \ge e$. The first two terms don't affect convergence.` },
        { math: md`\sum \frac{1}{n} \text{ diverges}`, note: "Harmonic series." },
      ],
    },
    {
      tex: md`\frac{\sqrt{n}}{n^{2} + ${k}}`,
      conv: true,
      steps: [
        { math: md`0 < \frac{\sqrt{n}}{n^2 + ${k}} < \frac{\sqrt{n}}{n^2} = \frac{1}{n^{3/2}}`, note: "Drop the constant from the denominator." },
        { math: md`\sum \frac{1}{n^{3/2}} \text{ converges}`, note: md`$p = \frac{3}{2} > 1$.` },
      ],
    },
    {
      tex: md`\frac{1}{\sqrt{n^{2} + ${k}}}`,
      conv: false,
      steps: [
        { math: md`\sqrt{n^2 + ${k}} \le \sqrt{n^2 + ${k}n^2} = \sqrt{${k + 1}}\, n, \qquad \text{so } \frac{1}{\sqrt{n^2 + ${k}}} \ge \frac{1}{\sqrt{${k + 1}}\, n}`, note: md`For $n \ge 1$, $${k} \le ${k}n^2$.` },
        { math: md`\sum \frac{1}{\sqrt{${k + 1}}\, n} \text{ diverges}`, note: "A constant times the harmonic series." },
      ],
    },
    {
      tex: md`\frac{1}{n^{n}}`,
      conv: true,
      steps: [
        { math: md`\frac{1}{n^n} \le \frac{1}{2^n} \quad \text{for } n \ge 2`, note: md`$n^n \ge 2^n$ when $n \ge 2$.` },
        { math: md`\sum \frac{1}{2^n} \text{ converges}`, note: md`Geometric, $r = \frac{1}{2}$.` },
      ],
    },
  ];
  const it = r.pick(items);
  return {
    prompt: md`Use a direct comparison to decide: does $\sum_{n=1}^{\infty} ${it.tex}$ converge or diverge?`,
    choices: CONV,
    accept: [it.conv ? "converges" : "diverges"],
    hint: it.conv ? "Find a bigger series you know converges (a p-series with p > 1 or a geometric series). Smaller than convergent means convergent." : "Find a smaller series you know diverges (the harmonic series, or a p-series with p ≤ 1). Bigger than divergent means divergent.",
    solution: [...it.steps, { math: md`\sum ${it.tex} \text{ ${it.conv ? "converges" : "diverges"}}`, note: it.conv ? "Positive terms, each no bigger than those of a convergent series: the partial sums are bounded, so the series converges." : "Each term is at least as big as those of a divergent series, so the partial sums grow past every bound." }],
  };
};

const limitComparisonRatio: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.int(1, 6);
    const b = r.nonzero(-9, 9);
    const c = r.int(2, 5);
    const d = r.nonzero(-9, 9);
    const an = md`\frac{${poly([[a, "n"], [b, ""]])}}{${poly([[c, "n^3"], [d, "n"]])}}`;
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{n^2(${poly([[a, "n"], [b, ""]])})}{${poly([[c, "n^3"], [d, "n"]])}}$. This is $\frac{a_n}{b_n}$ for the limit comparison of $a_n = ${an}$ with $b_n = \frac{1}{n^2}$. Give an exact value, like 3/2.`,
      answer: frac(a, c),
      hint: md`Dividing by $\frac{1}{n^2}$ is multiplying by $n^2$. Expand the top; then compare leading terms.`,
      solution: [
        { math: md`\frac{a_n}{b_n} = ${an} \cdot n^2 = \frac{${poly([[a, "n^3"], [b, "n^2"]])}}{${poly([[c, "n^3"], [d, "n"]])}}`, note: md`Multiply out $n^2(${poly([[a, "n"], [b, ""]])})$.` },
        { math: md`\to \frac{${a}}{${c}}${frac(a, c) === `${a}/${c}` ? "" : ` = ${fracTex(a, c)}`}`, note: "Same degree top and bottom: ratio of leading coefficients." },
        { math: md`\sum ${an} \text{ converges}`, note: md`The limit is finite and positive, and $\sum \frac{1}{n^2}$ converges ($p = 2$), so $\sum a_n$ converges too.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 6);
    const b = r.nonzero(-9, 9);
    const c = r.int(2, 5);
    const d = r.int(1, 9);
    const an = md`\frac{${poly([[a, "n"], [b, ""]])}}{${poly([[c, "n^2"], [d, ""]])}}`;
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{n(${poly([[a, "n"], [b, ""]])})}{${poly([[c, "n^2"], [d, ""]])}}$. This is $\frac{a_n}{b_n}$ for the limit comparison of $a_n = ${an}$ with $b_n = \frac{1}{n}$. Give an exact value, like 3/2.`,
      answer: frac(a, c),
      hint: md`Dividing by $\frac{1}{n}$ is multiplying by $n$. Then it is a ratio of quadratics.`,
      solution: [
        { math: md`\frac{a_n}{b_n} = \frac{${poly([[a, "n^2"], [b, "n"]])}}{${poly([[c, "n^2"], [d, ""]])}} \to \frac{${a}}{${c}}${frac(a, c) === `${a}/${c}` ? "" : ` = ${fracTex(a, c)}`}`, note: "Ratio of leading coefficients." },
        { math: md`\sum ${an} \text{ diverges}`, note: md`Finite positive limit, and $\sum \frac{1}{n}$ diverges, so $\sum a_n$ diverges with it. The terms behave like $\frac{${a}}{${c}n}$.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(2, 7);
    const s = r.pick([2, 3, 4]);
    const d = r.int(1, 9);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{${a}n}{\sqrt{${s * s}n^2 + ${d}}}$. This is $\frac{a_n}{b_n}$ for the limit comparison of $a_n = \frac{${a}}{\sqrt{${s * s}n^2 + ${d}}}$ with $b_n = \frac{1}{n}$. Give an exact value, like 3/2.`,
      answer: frac(a, s),
      hint: md`Divide top and bottom by $n$; under the root that means dividing by $n^2$.`,
      solution: [
        { math: md`\frac{${a}n}{\sqrt{${s * s}n^2 + ${d}}} = \frac{${a}}{\sqrt{${s * s} + ${d}/n^2}} \to \frac{${a}}{${s}}${frac(a, s) === `${a}/${s}` ? "" : ` = ${fracTex(a, s)}`}`, note: md`$\frac{${d}}{n^2} \to 0$.` },
        { math: md`\sum \frac{${a}}{\sqrt{${s * s}n^2 + ${d}}} \text{ diverges}`, note: md`A finite positive limit against the harmonic series. For large $n$ the terms are essentially $\frac{${a}}{${s}n}$.` },
      ],
    };
  }
  const k = r.int(1, 9);
  const a = r.int(2, 5);
  const v = r.int(0, 1);
  const an = v === 0 ? md`\frac{1}{${a}^{n} + ${k}}` : md`\frac{1}{${a}^{n} - ${k}}`;
  const ratio = v === 0 ? md`\frac{${a}^{n}}{${a}^{n} + ${k}}` : md`\frac{${a}^{n}}{${a}^{n} - ${k}}`;
  const divided = v === 0 ? md`\frac{1}{1 + ${k} \cdot ${a}^{-n}}` : md`\frac{1}{1 - ${k} \cdot ${a}^{-n}}`;
  return {
    prompt: md`Find $\lim_{n \to \infty} ${divided}$. This is $\frac{a_n}{b_n} = ${ratio}$, after dividing top and bottom by $${a}^{n}$, for the limit comparison of $a_n = ${an}$ with $b_n = \frac{1}{${a}^{n}}$.`,
    answer: "1",
    hint: md`$${a}^{-n} = \left(\frac{1}{${a}}\right)^{n} \to 0$.`,
    solution: [
      { math: md`${divided} \to \frac{1}{1 ${v === 0 ? "+" : "-"} ${k} \cdot 0} = 1`, note: md`$${a}^{-n} \to 0$ since $\frac{1}{${a}} < 1$.` },
      { math: md`\sum ${an} \text{ converges}`, note: md`The limit is 1, finite and positive, and $\sum \frac{1}{${a}^n}$ is a convergent geometric series. ${v === 1 ? md`Direct comparison with $\frac{1}{${a}^n}$ would fail here: the inequality points the wrong way. The limit version doesn't care.` : ""}` },
    ],
  };
};

const pickComparison: Generator = (r) => {
  const k = r.int(1, 9);
  const a = r.int(2, 5);
  const b = r.int(2, 9);
  const C = {
    n: md`$\frac{1}{n}$`,
    n2: md`$\frac{1}{n^2}$`,
    n32: md`$\frac{1}{n^{3/2}}$`,
    rn: md`$\frac{1}{\sqrt{n}}$`,
    geo: md`$\frac{1}{${a}^n}$`,
  };
  const items: { tex: string; right: string; others: string[]; why: string; conv: boolean }[] = [
    { tex: md`\frac{n + ${k}}{n^{3} + ${b}}`, right: C.n2, others: [C.n, C.n32, C.geo], why: md`Keep the dominant term top and bottom: $\frac{n}{n^3} = \frac{1}{n^2}$.`, conv: true },
    { tex: md`\frac{\sqrt{n}}{n^{2} + ${k}}`, right: C.n32, others: [C.n, C.n2, C.rn], why: md`$\frac{\sqrt{n}}{n^2} = \frac{1}{n^{3/2}}$.`, conv: true },
    { tex: md`\frac{${a}n^{2} + ${k}}{n^{3} + ${b}n}`, right: C.n, others: [C.n2, C.n32, C.geo], why: md`$\frac{${a}n^2}{n^3} = \frac{${a}}{n}$; the constant doesn't matter, so compare with $\frac{1}{n}$.`, conv: false },
    { tex: md`\frac{1}{\sqrt{n^{2} + ${k}}}`, right: C.n, others: [C.n2, C.rn, C.n32], why: md`$\sqrt{n^2 + ${k}} \approx n$, so the terms behave like $\frac{1}{n}$.`, conv: false },
    { tex: md`\frac{n + ${k}}{n\sqrt{n}}`, right: C.rn, others: [C.n, C.n2, C.n32], why: md`$\frac{n}{n^{3/2}} = \frac{1}{n^{1/2}}$.`, conv: false },
    { tex: md`\frac{n^{2}}{${a}^{n} + n}`, right: md`$\frac{n^2}{${a}^n}$`, others: [C.n2, C.geo, C.n], why: md`Exponentials beat powers, so $${a}^n + n \approx ${a}^n$. Compare with $\frac{n^2}{${a}^n}$, which converges by the ratio test (next lesson) or by noting $n^2 < (\sqrt{${a}})^n$ eventually.`, conv: true },
    { tex: md`\frac{${k}}{${a}^{n} - n}`, right: C.geo, others: [C.n, C.n2, C.rn], why: md`For large $n$, $${a}^n - n \approx ${a}^n$. The constant $${k}$ on top is irrelevant.`, conv: true },
    { tex: md`\frac{\sqrt{n + ${k}}}{n^{2} - ${b}n + ${b * b}}`, right: C.n32, others: [C.n2, C.n, C.rn], why: md`$\frac{\sqrt{n}}{n^2} = n^{-3/2}$.`, conv: true },
    { tex: md`\frac{${a}n + 1}{\sqrt{n^{5} + ${k}}}`, right: C.n32, others: [C.n, C.n2, C.rn], why: md`$\frac{n}{n^{5/2}} = \frac{1}{n^{3/2}}$.`, conv: true },
    { tex: md`\frac{n^{2} + ${k}}{n^{2}\sqrt{n} + ${b}}`, right: C.rn, others: [C.n, C.n2, C.n32], why: md`$\frac{n^2}{n^{5/2}} = \frac{1}{\sqrt{n}}$.`, conv: false },
  ];
  const it = r.pick(items);
  const choices = [it.right, ...it.others];
  // Rotate so the right answer isn't always first.
  const shift = r.int(0, choices.length - 1);
  const shown = [...choices.slice(shift), ...choices.slice(0, shift)];
  const bTex = it.right.replace(/^\$|\$$/g, "");
  return {
    prompt: md`You want to use the limit comparison test on $\sum_{n=1}^{\infty} ${it.tex}$. Which $b_n$ gives a finite, nonzero limit $\lim \frac{a_n}{b_n}$?`,
    choices: shown,
    accept: [it.right],
    hint: "Keep only the fastest-growing term on top and on bottom. Constants in front don't matter, since they only scale the limit.",
    solution: [
      { math: md`a_n = ${it.tex} \;\approx\; ${bTex}`, note: it.why },
      { math: md`\lim_{n \to \infty} \frac{a_n}{b_n} \text{ is finite and nonzero with } b_n = ${bTex}`, note: md`Both have the same growth rate, so their ratio settles at a positive constant.` },
      { math: md`\sum ${it.tex} \text{ ${it.conv ? "converges" : "diverges"}}`, note: md`Because $\sum ${bTex}$ ${it.conv ? "converges" : "diverges"}, and the limit comparison test says the two series share their fate.` },
    ],
  };
};

// ── Lesson 5: Alternating series ────────────────────────────────────────────

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/** The alternating series families used in this lesson: b_n and its LaTeX. */
const ALT = [
  { name: "n", b: (n: number): Q => [1, n], tex: md`\frac{(-1)^{n+1}}{n}`, bTex: (n: string) => `\\frac{1}{${n}}` },
  { name: "n2", b: (n: number): Q => [1, n * n], tex: md`\frac{(-1)^{n+1}}{n^2}`, bTex: (n: string) => `\\frac{1}{${/^\d+$/.test(n) ? `${Number(n) ** 2}` : `(${n})^2`}}` },
  { name: "odd", b: (n: number): Q => [1, 2 * n - 1], tex: md`\frac{(-1)^{n+1}}{2n - 1}`, bTex: (n: string) => `\\frac{1}{${/^\d+$/.test(n) ? `${2 * Number(n) - 1}` : `2(${n}) - 1`}}` },
  { name: "pow2", b: (n: number): Q => [1, 2 ** n], tex: md`\frac{(-1)^{n+1}}{2^n}`, bTex: (n: string) => `\\frac{1}{${/^\d+$/.test(n) ? `${2 ** Number(n)}` : `2^{${n}}`}}` },
  { name: "fact", b: (n: number): Q => [1, factorial(n)], tex: md`\frac{(-1)^{n+1}}{n!}`, bTex: (n: string) => `\\frac{1}{${/^\d+$/.test(n) ? `${factorial(Number(n))}` : `(${n})!`}}` },
  { name: "n3", b: (n: number): Q => [1, n ** 3], tex: md`\frac{(-1)^{n+1}}{n^3}`, bTex: (n: string) => `\\frac{1}{${/^\d+$/.test(n) ? `${Number(n) ** 3}` : `(${n})^3`}}` },
];

const alternatingPartialSum: Generator = (r) => {
  const fam = r.pick(ALT);
  const N = r.int(3, fam.name === "fact" || fam.name === "pow2" ? 4 : 5);
  const terms = Array.from({ length: N }, (_, i) => fam.b(i + 1));
  let written = "1";
  let total: Q = [1, 1];
  for (let i = 1; i < N; i++) {
    const t = terms[i]!;
    written += i % 2 === 1 ? ` - ${qtex(t)}` : ` + ${qtex(t)}`;
    total = qadd(total, i % 2 === 1 ? [-t[0], t[1]] : t);
  }
  const next = fam.b(N + 1);
  return {
    prompt: md`Compute $${written}$, the partial sum $S_{${N}}$ of $\sum_{n=1}^{\infty} ${fam.tex}$. Give an exact fraction.`,
    answer: qtext(total),
    hint: "Put everything over a common denominator, or add left to right one fraction at a time.",
    solution: [
      { math: md`S_{${N}} = ${written} = ${qtex(total)}`, note: "Add the fractions. Signs alternate because of the factor $(-1)^{n+1}$." },
      { math: md`|S - S_{${N}}| \le b_{${N + 1}} = ${qtex(next)}`, note: md`Looking ahead: the alternating series estimate says the full sum $S$ is within $${qtex(next)}$ of this, on the ${N % 2 === 0 ? "high" : "low"} side (the next term is ${N % 2 === 0 ? "positive" : "negative"}).` },
    ],
  };
};

const alternatingErrorBound: Generator = (r) => {
  const fam = r.pick(ALT);
  const kind = r.int(0, 1);
  if (kind === 0) {
    const N = fam.name === "fact" ? r.int(3, 6) : fam.name === "pow2" ? r.int(3, 8) : fam.name === "n3" ? r.int(2, 6) : r.int(3, 12);
    const bound = fam.b(N + 1);
    const verifyEq =
      fam.name === "n" ? `B (${N + 1}) = 1` : fam.name === "n2" ? `B (${N + 1})^2 = 1` : fam.name === "n3" ? `B (${N + 1})^3 = 1` : fam.name === "odd" ? `B (2(${N + 1}) - 1) = 1` : fam.name === "pow2" ? `B 2^(${N + 1}) = 1` : `B (${N + 1})! = 1`;
    return {
      prompt: md`The series $\sum_{n=1}^{\infty} ${fam.tex}$ converges to some $S$. By the alternating series estimate, how far can the partial sum $S_{${N}}$ be from $S$ at most? Give an exact fraction.`,
      answer: qtext(bound),
      verify: [verifyEq],
      hint: md`The error after $N$ terms is at most the size of the first term left out, $b_{N+1}$. Here $b_n = ${fam.bTex("n")}$ and $N = ${N}$.`,
      solution: [
        { math: md`|S - S_{N}| \le b_{N+1}`, note: md`$S$ lies between $S_N$ and $S_{N+1}$, which differ by exactly $b_{N+1}$.` },
        { math: md`b_{${N + 1}} = ${fam.bTex(String(N + 1))}${qtex(bound) !== fam.bTex(String(N + 1)) ? ` = ${qtex(bound)}` : ""}`, note: md`Plug $n = ${N + 1}$ into $b_n = ${fam.bTex("n")}$.` },
        { math: md`|S - S_{${N}}| \le ${qtex(bound)}`, note: md`The error also has the sign of that first omitted term: $S_{${N}}$ is ${N % 2 === 0 ? "below" : "above"} $S$.` },
      ],
    };
  }
  const tol = r.pick(fam.name === "n" ? [0.1, 0.05, 0.02, 0.01] : fam.name === "fact" ? [0.01, 0.001, 0.0001] : [0.01, 0.001]);
  let N = 1;
  while (fam.b(N + 1)[0] / fam.b(N + 1)[1] > tol + 1e-12) N++;
  const bN1 = fam.b(N + 1);
  const bN = fam.b(N);
  const solve: string =
    fam.name === "n"
      ? md`\frac{1}{N + 1} \le ${tol} \iff N + 1 \ge ${Math.round(1 / tol)}`
      : fam.name === "n2"
        ? md`\frac{1}{(N + 1)^2} \le ${tol} \iff (N + 1)^2 \ge ${Math.round(1 / tol)} \iff N + 1 \ge \sqrt{${Math.round(1 / tol)}} \approx ${Math.sqrt(1 / tol).toFixed(2)}`
        : fam.name === "n3"
          ? md`\frac{1}{(N + 1)^3} \le ${tol} \iff (N + 1)^3 \ge ${Math.round(1 / tol)} \iff N + 1 \ge \sqrt[3]{${Math.round(1 / tol)}} \approx ${Math.cbrt(1 / tol).toFixed(2)}`
          : fam.name === "odd"
            ? md`\frac{1}{2(N + 1) - 1} \le ${tol} \iff 2N + 1 \ge ${Math.round(1 / tol)}`
            : fam.name === "pow2"
              ? md`\frac{1}{2^{N+1}} \le ${tol} \iff 2^{N+1} \ge ${Math.round(1 / tol)}`
              : md`\frac{1}{(N + 1)!} \le ${tol} \iff (N + 1)! \ge ${Math.round(1 / tol)}`;
  return {
    prompt: md`How many terms of $\sum_{n=1}^{\infty} ${fam.tex}$ are needed so that the alternating series estimate guarantees $|S - S_N| \le ${tol}$? Give the smallest whole number $N$.`,
    answer: String(N),
    hint: md`The guarantee is $|S - S_N| \le b_{N+1}$. So you need $b_{N+1} \le ${tol}$, with $b_n = ${fam.bTex("n")}$.`,
    solution: [
      { math: md`|S - S_N| \le b_{N+1} = ${fam.bTex("N + 1")}`, note: "The alternating series estimate." },
      { math: solve, note: "Set the bound no bigger than the tolerance and solve." },
      { math: md`N = ${N}`, note: md`Check: $b_{${N + 1}} = ${qtex(bN1)} \le ${tol}$, but $b_{${N}} = ${qtex(bN)} > ${tol}$, so $N = ${N - 1}$ would not be enough.` },
    ],
  };
};

const absOrConditional: Generator = (r) => {
  const p = r.int(2, 4);
  const k = r.int(1, 9);
  const items: { tex: string; verdict: string; steps: Step[] }[] = [
    {
      tex: md`\frac{(-1)^n}{n^{${p}}}`,
      verdict: "converges absolutely",
      steps: [{ math: md`\sum \left|\frac{(-1)^n}{n^{${p}}}\right| = \sum \frac{1}{n^{${p}}} \text{ converges}`, note: md`A $p$-series with $p = ${p} > 1$. The series of absolute values converges, so the series converges absolutely.` }],
    },
    {
      tex: md`\frac{(-1)^n}{\sqrt{n}}`,
      verdict: "converges conditionally",
      steps: [
        { math: md`\sum \frac{1}{\sqrt{n}} \text{ diverges}`, note: md`$p = \frac{1}{2}$. So there is no absolute convergence.` },
        { math: md`b_n = \frac{1}{\sqrt{n}} \text{ decreases to } 0`, note: "The alternating series test applies, so the series itself converges." },
      ],
    },
    {
      tex: md`\frac{(-1)^n n}{n + ${k}}`,
      verdict: "diverges",
      steps: [
        { math: md`\frac{n}{n + ${k}} \to 1 \ne 0`, note: "The terms don't shrink: they approach +1 and -1 in turn." },
        { math: md`\text{divergence test}`, note: "Any series whose terms don't go to 0 diverges. The alternating series test doesn't apply, since its hypothesis fails." },
      ],
    },
    {
      tex: md`\frac{(-1)^n n}{n^2 + ${k}}`,
      verdict: "converges conditionally",
      steps: [
        { math: md`\frac{n}{n^2 + ${k}} \ge \frac{n}{n^2 + ${k}n^2} = \frac{1}{${k + 1}n}`, note: "Compared with the harmonic series, the series of absolute values diverges." },
        { math: md`b_n = \frac{n}{n^2 + ${k}} \to 0, \text{ decreasing for } n \ge ${Math.ceil(Math.sqrt(k))}`, note: md`$f(x) = \frac{x}{x^2 + ${k}}$ has $f'(x) = \frac{${k} - x^2}{(x^2 + ${k})^2} < 0$ once $x > \sqrt{${k}}$. The alternating series test gives convergence.` },
      ],
    },
    {
      tex: md`\frac{(-1)^n}{${p}^{n}}`,
      verdict: "converges absolutely",
      steps: [{ math: md`\sum \frac{1}{${p}^n} \text{ converges}`, note: md`Geometric with $r = \frac{1}{${p}}$. Absolute convergence.` }],
    },
    {
      tex: md`\frac{(-1)^n}{n^2 + ${k}}`,
      verdict: "converges absolutely",
      steps: [{ math: md`\frac{1}{n^2 + ${k}} < \frac{1}{n^2}, \qquad \sum \frac{1}{n^2} \text{ converges}`, note: "Direct comparison. Absolute convergence." }],
    },
    {
      tex: md`\frac{(-1)^n \sqrt{n}}{n + ${k}}`,
      verdict: "converges conditionally",
      steps: [
        { math: md`\frac{\sqrt{n}}{n + ${k}} \ge \frac{\sqrt{n}}{${k + 1}n} = \frac{1}{${k + 1}\sqrt{n}}`, note: md`So the absolute series diverges by comparison with $\sum \frac{1}{\sqrt{n}}$.` },
        { math: md`b_n = \frac{\sqrt{n}}{n + ${k}} \to 0 \text{ and decreases for } n \ge ${k}`, note: md`$f(x) = \frac{\sqrt{x}}{x + ${k}}$ has $f'(x) = \frac{${k} - x}{2\sqrt{x}(x + ${k})^2}$, negative for $x > ${k}$. Alternating series test: converges.` },
      ],
    },
    {
      tex: md`\frac{(-1)^n (2n + 1)}{3n + ${k}}`,
      verdict: "diverges",
      steps: [{ math: md`\frac{2n + 1}{3n + ${k}} \to \frac{2}{3} \ne 0`, note: "Terms don't approach 0. Divergence test." }],
    },
    {
      tex: md`\frac{(-1)^n}{\sqrt[3]{n}}`,
      verdict: "converges conditionally",
      steps: [
        { math: md`\sum \frac{1}{n^{1/3}} \text{ diverges}`, note: md`$p = \frac{1}{3} \le 1$.` },
        { math: md`b_n = n^{-1/3} \text{ decreases to } 0`, note: "Alternating series test: converges, but only conditionally." },
      ],
    },
    {
      tex: md`\frac{(-1)^n \ln n}{n}`,
      verdict: "converges conditionally",
      steps: [
        { math: md`\frac{\ln n}{n} \ge \frac{1}{n} \text{ for } n \ge 3`, note: "The absolute series diverges by comparison with the harmonic series." },
        { math: md`b_n = \frac{\ln n}{n} \to 0, \text{ decreasing for } n \ge 3`, note: md`$\left(\frac{\ln x}{x}\right)' = \frac{1 - \ln x}{x^2} < 0$ for $x > e$. Alternating series test: converges.` },
      ],
    },
    {
      tex: md`\frac{(-1)^n n}{${p}^{n}}`,
      verdict: "converges absolutely",
      steps: [{ math: md`\frac{n}{${p}^n} \le \left(\frac{${p === 2 ? "1.5" : "2"}}{${p}}\right)^{n} \text{ for all } n \ge 1`, note: md`Powers of $n$ grow slower than any exponential: $n \le ${p === 2 ? "1.5" : "2"}^n$ for all $n \ge 1$. So $\sum \frac{n}{${p}^n}$ converges by comparison with a geometric series of ratio $\frac{${p === 2 ? "1.5" : "2"}}{${p}} < 1$. Absolute convergence.` }],
    },
  ];
  const it = r.pick(items);
  const choices = ["converges absolutely", "converges conditionally", "diverges"];
  return {
    prompt: md`Classify $\sum_{n=2}^{\infty} ${it.tex}$.`,
    choices,
    accept: [it.verdict],
    hint: "First: do the terms go to 0? If not, it diverges. If so, test the series of absolute values. If that converges, the convergence is absolute; if it diverges, see whether the alternating series test still gives convergence.",
    solution: [...it.steps, { math: md`\text{${it.verdict}}`, note: it.verdict === "converges conditionally" ? "Converges, but not absolutely: the cancellation between signs is doing the work." : it.verdict === "converges absolutely" ? "Absolute convergence implies convergence, so the series converges, and robustly: no cancellation needed." : "The partial sums never settle." }],
  };
};

// ── Lesson 6: Ratio and root tests ──────────────────────────────────────────

const RATIO_CHOICES = ["converges", "diverges", "the ratio test is inconclusive"];
const ROOT_CHOICES = ["converges", "diverges", "the root test is inconclusive"];

const ratioTestDecide: Generator = (r) => {
  const k = r.int(2, 3);
  const c = r.int(2, 5);
  const d = r.pick([2, 3, 4, 5].filter((x) => x !== c));
  const items: { tex: string; verdict: string; steps: Step[] }[] = [
    {
      tex: md`\frac{n^{${k}}}{${c}^{n}}`,
      verdict: "converges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{(n+1)^{${k}}}{${c}^{n+1}} \cdot \frac{${c}^{n}}{n^{${k}}} = \frac{1}{${c}}\left(\frac{n + 1}{n}\right)^{${k}}`, note: md`The powers of $${c}$ cancel down to one factor of $\frac{1}{${c}}$.` },
        { math: md`L = \frac{1}{${c}} \cdot 1^{${k}} = \frac{1}{${c}} < 1`, note: md`$\frac{n+1}{n} \to 1$.` },
      ],
    },
    {
      tex: md`\frac{${c}^{n}}{n!}`,
      verdict: "converges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{${c}^{n+1}}{(n+1)!} \cdot \frac{n!}{${c}^{n}} = \frac{${c}}{n + 1}`, note: md`$(n+1)! = (n+1) \cdot n!$, so the factorials cancel to $\frac{1}{n+1}$.` },
        { math: md`L = 0 < 1`, note: "Factorials beat exponentials." },
      ],
    },
    {
      tex: md`\frac{n!}{${c}^{n}}`,
      verdict: "diverges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{(n+1)!}{${c}^{n+1}} \cdot \frac{${c}^{n}}{n!} = \frac{n + 1}{${c}}`, note: "The reciprocal of the previous pattern." },
        { math: md`L = \infty > 1`, note: "The terms grow without bound; they don't even go to 0." },
      ],
    },
    {
      tex: md`\frac{${c}^{n}}{n^{${k}}}`,
      verdict: "diverges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{${c}^{n+1}}{(n+1)^{${k}}} \cdot \frac{n^{${k}}}{${c}^{n}} = ${c}\left(\frac{n}{n + 1}\right)^{${k}}`, note: "Cancel the powers." },
        { math: md`L = ${c} > 1`, note: "Exponentials beat powers." },
      ],
    },
    {
      tex: md`\frac{(n!)^2}{(2n)!}`,
      verdict: "converges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{((n+1)!)^2}{(2n+2)!} \cdot \frac{(2n)!}{(n!)^2} = \frac{(n+1)^2}{(2n+2)(2n+1)}`, note: md`$(n+1)! = (n+1)\,n!$ and $(2n+2)! = (2n+2)(2n+1)\,(2n)!$.` },
        { math: md`L = \lim \frac{n^2 + 2n + 1}{4n^2 + 6n + 2} = \frac{1}{4} < 1`, note: "Ratio of leading coefficients." },
      ],
    },
    {
      tex: md`\frac{(2n)!}{(n!)^2}`,
      verdict: "diverges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{(2n+2)(2n+1)}{(n+1)^2}`, note: "The same cancellation as before, upside down." },
        { math: md`L = 4 > 1`, note: "These are the central binomial coefficients; they grow roughly like $4^n$." },
      ],
    },
    {
      tex: md`\frac{n^{n}}{n!}`,
      verdict: "diverges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{(n+1)^{n+1}}{(n+1)!} \cdot \frac{n!}{n^n} = \frac{(n+1)^{n+1}}{(n+1) n^n} = \left(\frac{n+1}{n}\right)^{n}`, note: md`One factor of $n + 1$ cancels against the factorial.` },
        { math: md`L = \lim \left(1 + \frac{1}{n}\right)^{n} = e > 1`, note: "From Lesson 1." },
      ],
    },
    {
      tex: md`\frac{n!}{n^{n}}`,
      verdict: "converges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{(n+1)!}{(n+1)^{n+1}} \cdot \frac{n^n}{n!} = \left(\frac{n}{n+1}\right)^{n} = \frac{1}{\left(1 + \frac{1}{n}\right)^{n}}`, note: "Cancel one factor of n + 1." },
        { math: md`L = \frac{1}{e} < 1`, note: md`Since $\left(1 + \frac{1}{n}\right)^n \to e$.` },
      ],
    },
    {
      tex: md`\frac{1}{n^{2} + ${k}}`,
      verdict: "the ratio test is inconclusive",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{n^2 + ${k}}{(n+1)^2 + ${k}} \to 1`, note: "Same degree top and bottom." },
        { math: md`L = 1`, note: md`The ratio test says nothing. (The series does converge, by comparison with $\sum \frac{1}{n^2}$, but the ratio test can't see it.)` },
      ],
    },
    {
      tex: md`\frac{n}{n^{2} + ${k}}`,
      verdict: "the ratio test is inconclusive",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{n + 1}{(n+1)^2 + ${k}} \cdot \frac{n^2 + ${k}}{n} \to 1`, note: "Degree 3 over degree 3, leading coefficients both 1." },
        { math: md`L = 1`, note: md`Inconclusive. (Limit comparison with $\frac{1}{n}$ shows it diverges.)` },
      ],
    },
    {
      tex: md`\frac{1}{\sqrt{n}}`,
      verdict: "the ratio test is inconclusive",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \sqrt{\frac{n}{n + 1}} \to 1`, note: "" },
        { math: md`L = 1`, note: md`Inconclusive. Rational and algebraic terms almost always give $L = 1$; use a $p$-series or comparison instead. (It diverges: $p = \frac{1}{2}$.)` },
      ],
    },
    {
      tex: md`\frac{${c}^{n}}{n \cdot ${d}^{n}}`,
      verdict: c < d ? "converges" : "diverges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{${c}^{n+1}}{(n+1)${d}^{n+1}} \cdot \frac{n \cdot ${d}^{n}}{${c}^{n}} = \frac{${c}}{${d}} \cdot \frac{n}{n + 1}`, note: "Cancel the powers; one factor of each base remains." },
        { math: md`L = \frac{${c}}{${d}} ${c < d ? "< 1" : "> 1"}`, note: md`$\frac{n}{n+1} \to 1$. ${c < d ? "Converges." : "Diverges."}` },
      ],
    },
    {
      tex: md`\frac{${k + 1}^{n} \, n!}{(2n)!}`,
      verdict: "converges",
      steps: [
        { math: md`\frac{a_{n+1}}{a_n} = \frac{${k + 1}^{n+1}(n+1)!}{(2n+2)!} \cdot \frac{(2n)!}{${k + 1}^{n} n!} = \frac{${k + 1}(n+1)}{(2n+2)(2n+1)} = \frac{${k + 1}}{2(2n + 1)}`, note: md`$(2n+2) = 2(n+1)$ cancels with the $n + 1$ on top.` },
        { math: md`L = 0 < 1`, note: "Converges." },
      ],
    },
  ];
  const it = r.pick(items);
  return {
    prompt: md`Apply the ratio test to $\sum_{n=1}^{\infty} ${it.tex}$. What does it say?`,
    choices: RATIO_CHOICES,
    accept: [it.verdict],
    hint: md`Form $\frac{a_{n+1}}{a_n}$, cancel as much as you can (factorials: $(n+1)! = (n+1)\,n!$; powers: $c^{n+1} = c \cdot c^n$), then take the limit $L$. $L < 1$ converges, $L > 1$ diverges, $L = 1$ says nothing.`,
    solution: [...it.steps, { math: md`\text{${it.verdict}}`, note: it.verdict === "converges" ? "L < 1: beyond some point the terms shrink at least as fast as a geometric series with ratio below 1, so the series converges (absolutely)." : it.verdict === "diverges" ? "L > 1: eventually each term is bigger than the one before, so the terms can't go to 0." : "L = 1: this test gives no information either way." }],
  };
};

const ratioLimit: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const k = r.int(2, 3);
    const c = r.int(2, 6);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{(n + 1)^{${k}}}{${c}n^{${k}}}$. This is $\frac{a_{n+1}}{a_n}$ for $\sum \frac{n^{${k}}}{${c}^{n}}$ after cancelling the powers of ${c}. Give an exact value, like 1/3.`,
      answer: frac(1, c),
      hint: md`Write it as $\frac{1}{${c}}\left(\frac{n+1}{n}\right)^{${k}}$ and use $\frac{n + 1}{n} \to 1$.`,
      solution: [
        { math: md`\frac{(n+1)^{${k}}}{${c}n^{${k}}} = \frac{1}{${c}}\left(\frac{n + 1}{n}\right)^{${k}} = \frac{1}{${c}}\left(1 + \frac{1}{n}\right)^{${k}}`, note: "Separate the constant from the part that depends on n." },
        { math: md`\to \frac{1}{${c}} \cdot 1 = \frac{1}{${c}}`, note: md`$\left(1 + \frac{1}{n}\right)^{${k}} \to 1$: a fixed power, unlike $(1 + 1/n)^n$.` },
        { math: md`L = \frac{1}{${c}} < 1 \;\Rightarrow\; \sum \frac{n^{${k}}}{${c}^n} \text{ converges}`, note: "The ratio test verdict." },
      ],
    };
  }
  if (kind === 1) {
    const c = r.int(2, 9);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{${c}}{n + 1}$. This is $\frac{a_{n+1}}{a_n}$ for $\sum \frac{${c}^{n}}{n!}$ after cancelling.`,
      answer: "0",
      hint: "A fixed number over something that grows without bound.",
      solution: [
        { math: md`\frac{${c}}{n + 1} \to 0`, note: md`The denominator passes every bound.` },
        { math: md`L = 0 < 1 \;\Rightarrow\; \sum \frac{${c}^n}{n!} \text{ converges}`, note: md`The factorial eventually multiplies by numbers far bigger than ${c} at every step, so the terms collapse. (The sum is $e^{${c}}$, as Unit 4 will show.)` },
      ],
    };
  }
  if (kind === 2) {
    const flip = r.next() < 0.5;
    return {
      prompt: flip
        ? md`Find $\lim_{n \to \infty} \frac{(n + 1)^2}{(2n + 2)(2n + 1)}$. This is $\frac{a_{n+1}}{a_n}$ for $\sum \frac{(n!)^2}{(2n)!}$ after cancelling the factorials. Give an exact value, like 1/3.`
        : md`Find $\lim_{n \to \infty} \frac{(2n + 2)(2n + 1)}{(n + 1)^2}$. This is $\frac{a_{n+1}}{a_n}$ for $\sum \frac{(2n)!}{(n!)^2}$ after cancelling the factorials.`,
      answer: flip ? "1/4" : "4",
      hint: "Expand top and bottom. Both are quadratics, so the limit is the ratio of leading coefficients.",
      solution: flip
        ? [
            { math: md`\frac{(n+1)^2}{(2n+2)(2n+1)} = \frac{n^2 + 2n + 1}{4n^2 + 6n + 2} \to \frac{1}{4}`, note: "Leading coefficients 1 and 4." },
            { math: md`L = \frac{1}{4} < 1 \;\Rightarrow\; \sum \frac{(n!)^2}{(2n)!} \text{ converges}`, note: "" },
          ]
        : [
            { math: md`\frac{(2n+2)(2n+1)}{(n+1)^2} = \frac{4n^2 + 6n + 2}{n^2 + 2n + 1} \to 4`, note: "Leading coefficients 4 and 1." },
            { math: md`L = 4 > 1 \;\Rightarrow\; \sum \frac{(2n)!}{(n!)^2} \text{ diverges}`, note: "The terms grow roughly like $4^n / \\sqrt{\\pi n}$, so they certainly don't go to 0." },
          ],
    };
  }
  if (kind === 3) {
    const k = r.int(2, 3);
    const c = r.int(2, 5);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{${c}n^{${k}}}{(n + 1)^{${k}}}$. This is $\frac{a_{n+1}}{a_n}$ for $\sum \frac{${c}^{n}}{n^{${k}}}$ after cancelling the powers of ${c}.`,
      answer: String(c),
      hint: md`$\frac{n}{n+1} \to 1$, and a fixed power of something tending to 1 tends to 1.`,
      solution: [
        { math: md`\frac{${c}n^{${k}}}{(n+1)^{${k}}} = ${c}\left(\frac{n}{n + 1}\right)^{${k}} \to ${c} \cdot 1 = ${c}`, note: "" },
        { math: md`L = ${c} > 1 \;\Rightarrow\; \sum \frac{${c}^n}{n^{${k}}} \text{ diverges}`, note: "The exponential on top wins; the terms grow without bound." },
      ],
    };
  }
  const c = r.int(2, 7);
  const d = r.pick([2, 3, 4, 5, 6, 7].filter((x) => x !== c));
  return {
    prompt: md`Find $\lim_{n \to \infty} \frac{${c}(n + 1)}{${d}n}$. This is $\frac{a_{n+1}}{a_n}$ for $\sum \frac{n \cdot ${c}^{n}}{${d}^{n}}$ after cancelling. Give an exact value, like 2/3.`,
    answer: frac(c, d),
    hint: md`Pull the constants out: $\frac{${c}}{${d}} \cdot \frac{n + 1}{n}$.`,
    solution: [
      { math: md`\frac{${c}(n+1)}{${d}n} = \frac{${c}}{${d}} \cdot \frac{n + 1}{n} \to \frac{${c}}{${d}}${frac(c, d) === `${c}/${d}` ? "" : ` = ${fracTex(c, d)}`}`, note: md`$\frac{n+1}{n} \to 1$.` },
      { math: md`L = ${fracTex(c, d)} ${c < d ? "< 1" : "> 1"} \;\Rightarrow\; \sum \frac{n \cdot ${c}^n}{${d}^n} \text{ ${c < d ? "converges" : "diverges"}}`, note: c < d ? md`The factor $n$ can't save a geometric decay with ratio $\frac{${c}}{${d}} < 1$.` : md`Ratio bigger than 1: the terms blow up.` },
    ],
  };
};

const rootTestDecide: Generator = (r) => {
  const a = r.int(1, 5);
  const c = r.pick([1, 2, 3, 4, 5, 6].filter((x) => x !== a));
  const b = r.int(1, 5);
  const d = r.int(1, 5);
  const k = r.int(2, 3);
  const m = r.int(2, 5);
  const items: { tex: string; verdict: string; steps: Step[] }[] = [
    {
      tex: md`\left(\frac{${a}n + ${b}}{${c}n + ${d}}\right)^{n}`,
      verdict: a < c ? "converges" : "diverges",
      steps: [
        { math: md`\sqrt[n]{|a_n|} = \frac{${a}n + ${b}}{${c}n + ${d}} \to \frac{${a}}{${c}}`, note: "The nth root undoes the nth power exactly. That is what the root test is for." },
        { math: md`L = ${fracTex(a, c)} ${a < c ? "< 1" : "> 1"}`, note: a < c ? "Converges." : "Diverges." },
      ],
    },
    {
      tex: md`\left(\frac{n + ${b}}{n + ${d === b ? d + 1 : d}}\right)^{n}`,
      verdict: "the root test is inconclusive",
      steps: [
        { math: md`\sqrt[n]{a_n} = \frac{n + ${b}}{n + ${d === b ? d + 1 : d}} \to 1`, note: "Same leading coefficients." },
        { math: md`L = 1`, note: md`Inconclusive. (In fact $a_n \to e^{${b - (d === b ? d + 1 : d)}} \ne 0$ by the method of Lesson 1, so the series diverges by the divergence test, but the root test itself can't tell.)` },
      ],
    },
    {
      tex: md`\frac{n^{${k}}}{${m}^{n}}`,
      verdict: "converges",
      steps: [
        { math: md`\sqrt[n]{a_n} = \frac{(n^{1/n})^{${k}}}{${m}} \to \frac{1^{${k}}}{${m}} = \frac{1}{${m}}`, note: md`$n^{1/n} \to 1$ (Lesson 1).` },
        { math: md`L = \frac{1}{${m}} < 1`, note: "Converges." },
      ],
    },
    {
      tex: md`\frac{${m}^{n}}{n^{${k}}}`,
      verdict: "diverges",
      steps: [
        { math: md`\sqrt[n]{a_n} = \frac{${m}}{(n^{1/n})^{${k}}} \to ${m}`, note: md`$n^{1/n} \to 1$.` },
        { math: md`L = ${m} > 1`, note: "Diverges." },
      ],
    },
    {
      tex: md`\frac{1}{(\ln n)^{n}}`,
      verdict: "converges",
      steps: [
        { math: md`\sqrt[n]{a_n} = \frac{1}{\ln n} \to 0`, note: "The root strips the power cleanly." },
        { math: md`L = 0 < 1`, note: "Converges (the sum starts at n = 2, where the terms are defined)." },
      ],
    },
    {
      tex: md`\left(1 + \frac{1}{n}\right)^{n^2}`,
      verdict: "diverges",
      steps: [
        { math: md`\sqrt[n]{a_n} = \left(1 + \frac{1}{n}\right)^{n} \to e`, note: md`$\left(x^{n^2}\right)^{1/n} = x^{n}$.` },
        { math: md`L = e > 1`, note: "Diverges." },
      ],
    },
    {
      tex: md`\left(\frac{n}{n + 1}\right)^{n^2}`,
      verdict: "converges",
      steps: [
        { math: md`\sqrt[n]{a_n} = \left(\frac{n}{n + 1}\right)^{n} = \frac{1}{\left(1 + \frac{1}{n}\right)^{n}} \to \frac{1}{e}`, note: "" },
        { math: md`L = \frac{1}{e} < 1`, note: "Converges." },
      ],
    },
    {
      tex: md`\frac{${m}^{n}}{n^{n}}`,
      verdict: "converges",
      steps: [
        { math: md`\sqrt[n]{a_n} = \frac{${m}}{n} \to 0`, note: "" },
        { math: md`L = 0 < 1`, note: "Converges." },
      ],
    },
    {
      tex: md`\frac{n^{${k}}}{(n + 1)^{${k}}}`,
      verdict: "the root test is inconclusive",
      steps: [
        { math: md`\sqrt[n]{a_n} = \left(\frac{n}{n+1}\right)^{${k}/n} \to 1`, note: md`A fixed quantity (tending to 1) to a power $\frac{${k}}{n} \to 0$.` },
        { math: md`L = 1`, note: "Inconclusive. (The terms tend to 1, so the divergence test settles it: the series diverges.)" },
      ],
    },
  ];
  const it = r.pick(items);
  return {
    prompt: md`Apply the root test to $\sum_{n=2}^{\infty} ${it.tex}$. What does it say?`,
    choices: ROOT_CHOICES,
    accept: [it.verdict],
    hint: md`Compute $\sqrt[n]{|a_n|}$ and let $n \to \infty$. Remember $n^{1/n} \to 1$ and $c^{1/n} \to 1$ for any constant $c > 0$.`,
    solution: [...it.steps, { math: md`\text{${it.verdict}}`, note: it.verdict === "converges" ? "L < 1: beyond some point |a_n| is at most r^n for some r < 1, a convergent geometric series." : it.verdict === "diverges" ? "L > 1: eventually |a_n| > 1, so the terms don't go to 0." : "L = 1: no information from this test." }],
  };
};

// ── Lesson blocks ───────────────────────────────────────────────────────────

const altHarmonicSums = (() => {
  const out: number[] = [];
  let s = 0;
  for (let n = 1; n <= 14; n++) {
    s += (n % 2 === 1 ? 1 : -1) / n;
    out.push(s);
  }
  return out;
})();

const harmonicSums = (() => {
  const out: number[] = [];
  let s = 0;
  for (let n = 1; n <= 30; n++) {
    s += 1 / n;
    out.push(s);
  }
  return out;
})();

const lesson1Blocks: Block[] = [
  {
    kind: "text",
    body: md`A **sequence** is a list of numbers in order: $a_1, a_2, a_3, \ldots$. Usually a formula gives the $n$th term, like $a_n = \frac{1}{n}$ or $a_n = \frac{2n + 1}{n + 3}$. Sometimes a rule gives each term from the one before, like $a_{n+1} = \sqrt{a_n + 6}$ with $a_1 = 1$.

A sequence is really a function whose domain is the whole numbers $1, 2, 3, \ldots$. That is the key to this lesson: almost everything you know about limits of functions carries straight over.

The question we care about: as $n$ grows, do the terms settle down to one number? For $a_n = \frac{1}{n}$ the terms $1, \frac{1}{2}, \frac{1}{3}, \ldots$ crowd toward 0. For $a_n = (-1)^n$ the terms $-1, 1, -1, 1, \ldots$ never settle.`,
  },
  {
    kind: "key",
    title: "Limit of a sequence",
    body: md`$\lim_{n \to \infty} a_n = L$ means: however narrow a band you draw around $L$, all the terms from some point on lie inside it. Only finitely many terms are allowed to miss.

A sequence with a limit **converges**. One without a limit **diverges**. If the terms grow past every bound we say it *diverges to infinity* and write $a_n \to \infty$, but that is still divergence: $\infty$ is not a number.`,
  },
  {
    kind: "plot",
    x: [0, 13],
    y: [0.8, 3.2],
    points: seqPoints((n) => 2 + (n % 2 === 0 ? 1 : -1) / n, 12),
    hlines: [{ y: 2, label: "L = 2" }, { y: "2 + d" }, { y: "2 - d" }],
    params: [{ name: "d", tex: "\\varepsilon", min: 0.05, max: 1, step: 0.05, value: 0.4 }],
    caption: md`$a_n = 2 + \frac{(-1)^n}{n}$. Narrow the band around $L = 2$. However small it gets, only the first few terms are left outside.`,
  },
  {
    kind: "why",
    title: "Why function limits carry over",
    body: md`Suppose $f(x) \to L$ as $x \to \infty$: beyond some $X$, every value of $f$ is inside your band around $L$. The whole numbers $n > X$ are among those $x$, so $f(n)$ is inside the band too. That is exactly the statement $a_n = f(n) \to L$.

So every tool from Calculus 1 works: divide by the highest power, use the conjugate, use L'Hôpital's rule on $f(x)$, use the limit laws for sums, products and quotients, and the squeeze theorem.

The reverse is **false**. $a_n = \sin(n\pi)$ is $0, 0, 0, \ldots$ and converges to 0, but $f(x) = \sin(\pi x)$ swings forever. Sampling at whole numbers can hide oscillation.`,
  },
  {
    kind: "example",
    title: "A ratio of polynomials",
    problem: md`Find $\lim_{n \to \infty} \frac{3n^2 - n}{2n^2 + 5}$.`,
    steps: [
      { math: md`\frac{3n^2 - n}{2n^2 + 5} = \frac{3 - \frac{1}{n}}{2 + \frac{5}{n^2}}`, note: md`Divide top and bottom by $n^2$, the highest power.` },
      { math: md`\to \frac{3 - 0}{2 + 0} = \frac{3}{2}`, note: md`$\frac{1}{n} \to 0$ and $\frac{5}{n^2} \to 0$.` },
    ],
  },
  {
    kind: "example",
    title: "Infinity minus infinity",
    problem: md`Find $\lim_{n \to \infty} \left(\sqrt{n^2 + 4n} - n\right)$.`,
    steps: [
      { math: md`\left(\sqrt{n^2 + 4n} - n\right) \cdot \frac{\sqrt{n^2 + 4n} + n}{\sqrt{n^2 + 4n} + n} = \frac{4n}{\sqrt{n^2 + 4n} + n}`, note: md`Multiply by the conjugate: $(A - B)(A + B) = A^2 - B^2 = (n^2 + 4n) - n^2$.` },
      { math: md`= \frac{4}{\sqrt{1 + \frac{4}{n}} + 1} \to \frac{4}{1 + 1} = 2`, note: md`Divide top and bottom by $n$. Both pieces grew without bound, but their difference settles at 2.` },
    ],
  },
  {
    kind: "key",
    title: "Powers r^n, and the squeeze theorem",
    body: md`- If $|r| < 1$ then $r^n \to 0$. If $r = 1$ then $r^n = 1$. If $r = -1$ or $|r| > 1$ the sequence $r^n$ diverges.
- **Squeeze:** if $b_n \le a_n \le c_n$ for all large $n$, and $b_n \to L$ and $c_n \to L$, then $a_n \to L$.

The squeeze theorem is how you handle wiggles: $\left|\frac{\sin n}{n}\right| \le \frac{1}{n}$, so $\frac{\sin n}{n} \to 0$.`,
  },
  {
    kind: "proof",
    title: "r^n tends to 0 when 0 < r < 1",
    given: md`$0 < r < 1$`,
    prove: md`$r^n \to 0$`,
    steps: [
      { statement: md`Let $h = \frac{1}{r} - 1$. Then $h > 0$ and $\frac{1}{r} = 1 + h$.`, reason: md`$r < 1$ means $\frac{1}{r} > 1$.` },
      { statement: md`$(1 + h)^n \ge 1 + nh$ for every $n \ge 1$`, reason: md`Bernoulli's inequality: expand $(1 + h)^n$ by the binomial theorem. The first two terms are $1 + nh$ and every other term is positive.` },
      { statement: md`$0 < r^n = \frac{1}{(1 + h)^n} \le \frac{1}{1 + nh}$`, reason: "Reciprocals of positive numbers reverse the inequality." },
      { statement: md`$\frac{1}{1 + nh} \to 0$`, reason: md`$h$ is a fixed positive number, so $1 + nh \to \infty$.` },
      { statement: md`$r^n \to 0$`, reason: md`Squeeze theorem, between $0$ and $\frac{1}{1 + nh}$.` },
    ],
  },
  {
    kind: "plot",
    x: [0, 12],
    y: [0, 3],
    curves: [{ expr: "r^x", label: "y = r^x", dashed: true }],
    points: Array.from({ length: 11 }, (_, i) => ({ x: i + 1, y: `r^${i + 1}` })),
    params: [{ name: "r", tex: "r", min: 0.1, max: 1.1, step: 0.05, value: 0.7 }],
    caption: md`$a_n = r^n$ with $r = {r}$. Below 1 the terms die away, faster for smaller $r$. At exactly 1 they stay put. Above 1 they run off.`,
  },
  {
    kind: "why",
    title: "Why (1 + 1/n)^n tends to e",
    body: md`Call the sequence $a_n$ and take logs: $\ln a_n = n \ln\left(1 + \frac{1}{n}\right)$. Write $h = \frac{1}{n}$, so $h \to 0$ and

$$\ln a_n = \frac{\ln(1 + h)}{h} = \frac{\ln(1 + h) - \ln 1}{h}.$$

That is the difference quotient of $\ln x$ at $x = 1$. Its limit is the derivative there, $\frac{1}{1} = 1$. So $\ln a_n \to 1$, and since $e^x$ is continuous, $a_n = e^{\ln a_n} \to e^1 = e$.

The same argument gives $\left(1 + \frac{a}{n}\right)^n \to e^a$: with $h = \frac{a}{n}$ the log is $a \cdot \frac{\ln(1 + h)}{h} \to a$. Algebra 2 met $e$ this way through compound interest; now you know why the limit exists.`,
  },
  {
    kind: "plot",
    x: [0, 20],
    y: [1.5, 3],
    curves: [{ expr: "(1 + 1/x)^x", label: "(1 + 1/x)^x", color: 1 }],
    points: seqPoints((n) => (1 + 1 / n) ** n, 19, 2),
    hlines: [{ y: Math.E, label: "e" }],
    caption: md`The sequence $\left(1 + \frac{1}{n}\right)^n$ climbs toward $e \approx 2.718$. It never reaches it: $a_{20} \approx 2.653$, $a_{1000} \approx 2.717$.`,
  },
  {
    kind: "key",
    title: "Monotone bounded sequences converge",
    body: md`If a sequence is **increasing** ($a_{n+1} \ge a_n$) and **bounded above** (every $a_n \le M$ for some fixed $M$), then it converges. Likewise a decreasing sequence that is bounded below converges.

The reason, in brief: the terms keep climbing but can never pass $M$, so they pile up against some ceiling. The least such ceiling is the limit. (Making "pile up" precise is the completeness of the real numbers, which a later course handles. We will use the theorem as stated.)

This matters because it proves convergence *without knowing the limit*. That is exactly what series will need.`,
  },
  {
    kind: "why",
    title: "Why a recursive limit solves a fixed-point equation",
    body: md`Suppose $a_{n+1} = f(a_n)$ with $f$ continuous, and suppose we already know $a_n \to L$. Then $a_{n+1} \to L$ as well: it is the same list shifted by one. Taking limits on both sides of $a_{n+1} = f(a_n)$ and moving the limit inside the continuous $f$:

$$L = f(L).$$

So the limit is a solution of $L = f(L)$. **Order matters:** first show the sequence converges (usually with the monotone bounded theorem), then solve. Skipping the first step gives nonsense. For $a_{n+1} = 2a_n$ with $a_1 = 1$, the equation $L = 2L$ gives $L = 0$, but the sequence $1, 2, 4, 8, \ldots$ diverges.`,
  },
  {
    kind: "example",
    title: "A recursively defined sequence",
    problem: md`Let $a_1 = 1$ and $a_{n+1} = \sqrt{a_n + 6}$. Show it converges and find the limit.`,
    steps: [
      { math: md`a_1 = 1, \quad a_2 = \sqrt{7} \approx 2.65, \quad a_3 \approx 2.94, \quad a_4 \approx 2.99`, note: "The terms rise and seem to approach 3." },
      { math: md`a_n < 3 \;\Rightarrow\; a_{n+1} = \sqrt{a_n + 6} < \sqrt{9} = 3`, note: md`Bounded above by 3: if one term is below 3, so is the next, and $a_1 = 1 < 3$ starts it off.` },
      { math: md`a_n < 3 \;\Rightarrow\; a_n^2 < 3a_n < a_n + 6 \;\Rightarrow\; a_n < \sqrt{a_n + 6} = a_{n+1}`, note: md`Increasing: $3a_n < a_n + 6$ because $2a_n < 6$.` },
      { math: md`L = \sqrt{L + 6} \;\Rightarrow\; L^2 - L - 6 = 0 \;\Rightarrow\; (L - 3)(L + 2) = 0`, note: "Increasing and bounded above, so it converges. Now take limits of both sides." },
      { math: md`L = 3`, note: md`$L = -2$ is impossible since every term is positive.` },
    ],
  },
  {
    kind: "check",
    prompt: md`Find $\lim_{n \to \infty} \frac{5n + 1}{2n - 3}$. Give an exact value, like 3/4.`,
    answer: "5/2",
    explain: md`Divide top and bottom by $n$: $\frac{5 + 1/n}{2 - 3/n} \to \frac{5}{2}$.`,
  },
  {
    kind: "check",
    prompt: md`The sequence $a_1 = 0$, $a_{n+1} = \frac{a_n + 8}{3}$ converges. Find its limit.`,
    answer: "4",
    explain: md`Take limits: $L = \frac{L + 8}{3}$, so $3L = L + 8$ and $L = 4$. (The terms $0, \frac{8}{3}, \frac{32}{9}, \ldots$ climb toward 4.)`,
  },
];

const lesson2Blocks: Block[] = [
  {
    kind: "text",
    body: md`What could $\frac{1}{2} + \frac{1}{4} + \frac{1}{8} + \frac{1}{16} + \cdots$ possibly mean? You can't add infinitely many numbers one at a time. But you can add the first $N$ of them and watch what happens as $N$ grows:

$$S_1 = \tfrac{1}{2}, \quad S_2 = \tfrac{3}{4}, \quad S_3 = \tfrac{7}{8}, \quad S_4 = \tfrac{15}{16}, \quad \ldots$$

These **partial sums** form a sequence, and that sequence has a limit: 1. So we *define* the infinite sum to be 1. An infinite series is a sequence of partial sums in disguise, which is why the last lesson came first.`,
  },
  {
    kind: "key",
    title: "Series, partial sums, convergence",
    body: md`For a sequence $a_1, a_2, \ldots$ the **series** $\sum_{n=1}^{\infty} a_n$ has partial sums $S_N = a_1 + a_2 + \cdots + a_N$.

- If $S_N \to S$, the series **converges** and its sum is $S$.
- If $S_N$ has no limit, the series **diverges** and has no sum.

A series can start at any index: $\sum_{n=0}^{\infty}$ or $\sum_{n=5}^{\infty}$. Where it starts changes the sum but never whether it converges, since it only shifts the partial sums by a fixed amount.`,
  },
  {
    kind: "why",
    title: "Why a geometric series sums to a/(1 - r)",
    body: md`Take $S_N = a + ar + ar^2 + \cdots + ar^{N-1}$. Multiply the whole thing by $r$: every term slides one place to the right.

$$rS_N = ar + ar^2 + \cdots + ar^{N-1} + ar^N.$$

Subtract: all the middle terms cancel, leaving $S_N - rS_N = a - ar^N$, so for $r \ne 1$

$$S_N = a\,\frac{1 - r^N}{1 - r}.$$

Now let $N \to \infty$. From Lesson 1, $r^N \to 0$ exactly when $|r| < 1$, and then $S_N \to \frac{a}{1 - r}$. If $|r| \ge 1$ the terms $ar^N$ never shrink, the partial sums never settle, and the series diverges.`,
  },
  {
    kind: "key",
    title: "Geometric series",
    body: md`If $|r| < 1$,

$$\sum_{n=0}^{\infty} ar^n = a + ar + ar^2 + \cdots = \frac{a}{1 - r} = \frac{\text{first term}}{1 - \text{ratio}}.$$

If $|r| \ge 1$ the series diverges. The "first term" is whatever term the sum actually starts with. $\sum_{n=1}^{\infty} 3\left(\frac{1}{2}\right)^n$ starts at $\frac{3}{2}$, so its sum is $\frac{3/2}{1 - 1/2} = 3$.`,
  },
  {
    kind: "plot",
    x: [0, 11],
    y: [-1, 13],
    points: Array.from({ length: 10 }, (_, i) => ({ x: i + 1, y: `a (1 - r^${i + 1})/(1 - r)` })),
    hlines: [{ y: "a/(1 - r)", label: "a/(1 - r)" }],
    params: [
      { name: "a", tex: "a", min: 1, max: 3, step: 1, value: 3 },
      { name: "r", tex: "r", min: -0.75, max: 0.75, step: 0.05, value: 0.5 },
    ],
    caption: md`Partial sums $S_N$ of $\sum a r^{n}$ for $a = {a}$, $r = {r}$. The dashed line is $\frac{a}{1 - r} = {=a/(1 - r)}$. Try a negative $r$: the sums hop over the limit from side to side.`,
  },
  {
    kind: "example",
    title: "A geometric series in disguise",
    problem: md`Find $\sum_{n=1}^{\infty} \frac{2^n}{3^{n+1}}$.`,
    steps: [
      { math: md`\frac{2^n}{3^{n+1}} = \frac{1}{3} \cdot \frac{2^n}{3^n} = \frac{1}{3}\left(\frac{2}{3}\right)^{n}`, note: "Peel one 3 off the bottom to expose the ratio." },
      { math: md`\text{first term } (n = 1): \; \frac{1}{3} \cdot \frac{2}{3} = \frac{2}{9}, \qquad r = \frac{2}{3}`, note: md`$|r| < 1$, so it converges.` },
      { math: md`S = \frac{2/9}{1 - 2/3} = \frac{2/9}{1/3} = \frac{2}{3}`, note: "First term over one minus the ratio." },
    ],
  },
  {
    kind: "why",
    title: "Why telescoping sums collapse",
    body: md`Partial fractions (Algebra 3, Unit 4) turn $\frac{1}{n(n+1)}$ into $\frac{1}{n} - \frac{1}{n+1}$. Now write out a partial sum:

$$S_N = \left(1 - \tfrac{1}{2}\right) + \left(\tfrac{1}{2} - \tfrac{1}{3}\right) + \left(\tfrac{1}{3} - \tfrac{1}{4}\right) + \cdots + \left(\tfrac{1}{N} - \tfrac{1}{N+1}\right).$$

Each negative piece is cancelled by the positive piece right after it, like a telescope folding shut. Only $1 - \frac{1}{N+1}$ survives, and that tends to 1. So $\sum_{n=1}^{\infty} \frac{1}{n(n+1)} = 1$.

The method: split the term into a difference, write out $S_N$, cancel, then take the limit. Always finish with the limit. $\sum \left(\sqrt{n+1} - \sqrt{n}\right)$ telescopes to $S_N = \sqrt{N+1} - 1$, which diverges.`,
  },
  {
    kind: "example",
    title: "A telescoping series with a gap of two",
    problem: md`Find $\sum_{n=1}^{\infty} \frac{1}{n(n+2)}$.`,
    steps: [
      { math: md`\frac{1}{n(n+2)} = \frac{1}{2}\left(\frac{1}{n} - \frac{1}{n+2}\right)`, note: md`Check: $\frac{1}{n} - \frac{1}{n+2} = \frac{2}{n(n+2)}$.` },
      { math: md`S_N = \frac{1}{2}\left[\left(1 - \tfrac{1}{3}\right) + \left(\tfrac{1}{2} - \tfrac{1}{4}\right) + \left(\tfrac{1}{3} - \tfrac{1}{5}\right) + \cdots + \left(\tfrac{1}{N} - \tfrac{1}{N+2}\right)\right]`, note: "Each negative piece cancels a positive piece two places later." },
      { math: md`S_N = \frac{1}{2}\left(1 + \frac{1}{2} - \frac{1}{N+1} - \frac{1}{N+2}\right)`, note: "Two pieces survive at the front and two at the back." },
      { math: md`S = \frac{1}{2} \cdot \frac{3}{2} = \frac{3}{4}`, note: "The back pieces vanish in the limit." },
    ],
  },
  {
    kind: "key",
    title: "The divergence test",
    body: md`If $\sum a_n$ converges, then $a_n \to 0$.

Used the other way round: **if $a_n$ does not tend to 0, the series diverges.** This is the first thing to check.

The converse is false. $a_n \to 0$ does *not* guarantee convergence: the harmonic series $\sum \frac{1}{n}$ has terms going to 0 and still diverges.`,
  },
  {
    kind: "proof",
    title: "Convergent series have terms tending to 0",
    given: md`$\sum a_n$ converges, with partial sums $S_N \to S$`,
    prove: md`$a_n \to 0$`,
    steps: [
      { statement: md`$a_n = S_n - S_{n-1}$ for $n \ge 2$`, reason: md`$S_n$ adds one more term than $S_{n-1}$, namely $a_n$.` },
      { statement: md`$S_n \to S$ and $S_{n-1} \to S$`, reason: "The second is the same sequence shifted by one place; shifting doesn't change a limit." },
      { statement: md`$a_n = S_n - S_{n-1} \to S - S = 0$`, reason: "Limit law for a difference." },
    ],
  },
  {
    kind: "why",
    title: "Why the harmonic series diverges",
    body: md`Group the terms of $1 + \frac{1}{2} + \frac{1}{3} + \frac{1}{4} + \cdots$ in blocks that double in length:

$$1 + \tfrac{1}{2} + \left(\tfrac{1}{3} + \tfrac{1}{4}\right) + \left(\tfrac{1}{5} + \tfrac{1}{6} + \tfrac{1}{7} + \tfrac{1}{8}\right) + \cdots$$

Each block is at least $\frac{1}{2}$: the block ending at $\frac{1}{8}$ has 4 terms each at least $\frac{1}{8}$, the block ending at $\frac{1}{16}$ has 8 terms each at least $\frac{1}{16}$, and so on. So $S_{2^k} \ge 1 + \frac{k}{2}$, which passes every number. The partial sums grow without bound, though very slowly: it takes about $e^{100}$ terms to reach 100. The plot shows how $S_N$ hugs $\ln N$. The next lesson explains why.`,
  },
  {
    kind: "plot",
    x: [0, 31],
    y: [0, 4.5],
    points: seqPoints((n) => harmonicSums[n - 1]!, 30),
    curves: [{ expr: "ln(x) + 0.5772", label: "\\ln x + 0.577", dashed: true, color: 2, domain: [0.6, 31] }],
    caption: md`Partial sums of the harmonic series. They never level off; they track $\ln N$ plus a constant.`,
  },
  {
    kind: "key",
    title: "Algebra of series",
    body: md`If $\sum a_n = A$ and $\sum b_n = B$ converge, then $\sum (a_n + b_n) = A + B$ and $\sum c\,a_n = cA$. The reason is the limit laws applied to partial sums.

Changing, adding or removing finitely many terms never changes whether a series converges. It only shifts the sum. So "for all large $n$" is good enough in every test.`,
  },
  {
    kind: "check",
    prompt: md`Find $\sum_{n=0}^{\infty} 5\left(\frac{1}{4}\right)^{n}$. Give an exact fraction.`,
    answer: "20/3",
    explain: md`First term 5, ratio $\frac{1}{4}$: $\frac{5}{1 - 1/4} = \frac{5}{3/4} = \frac{20}{3}$.`,
  },
  {
    kind: "check",
    prompt: md`Does $\sum_{n=1}^{\infty} \frac{n}{2n + 1}$ converge?`,
    choices: ["No: the terms approach 1/2, not 0", "Yes: the terms are all less than 1", "Yes: the terms decrease"],
    accept: ["No: the terms approach 1/2, not 0"],
    explain: md`$\frac{n}{2n+1} \to \frac{1}{2} \ne 0$, so by the divergence test the series diverges. Bounded or decreasing terms are not enough.`,
  },
];

const squareSums = (() => {
  const out: number[] = [];
  let s = 0;
  for (let n = 1; n <= 20; n++) {
    s += 1 / (n * n);
    out.push(s);
  }
  return out;
})();

const lesson3Blocks: Block[] = [
  {
    kind: "text",
    body: md`The harmonic series $\sum \frac{1}{n}$ diverges. What about $\sum \frac{1}{n^2}$? Its terms also go to 0, so the divergence test is silent. The partial sums $1, 1.25, 1.361, 1.424, \ldots$ seem to level off near 1.64, but a picture of thirty terms is not a proof.

Here is the idea that settles it. Each term $a_n = f(n)$ is the area of a rectangle of width 1 and height $f(n)$. Line those rectangles up next to the graph of $f$ and compare their total area with the area under the curve. You already know how to compute the area under $y = \frac{1}{x^2}$ out to infinity: it is an improper integral from Unit 2.`,
  },
  {
    kind: "plot",
    x: [0, 10],
    y: [0, 1.1],
    curves: [{ expr: "1/x^p", label: "y = 1/x^p", domain: [0.95, 10] }],
    riemann: { expr: "1/x^p", from: 1, to: 9, n: 8, method: "right", color: 2 },
    params: [{ name: "p", tex: "p", min: 0.5, max: 3, step: 0.25, value: 2 }],
    caption: md`$f(x) = \frac{1}{x^p}$ with $p = {p}$. The rectangles have width 1 and heights $f(2), f(3), \ldots, f(9)$: the terms $a_2 + \cdots + a_9$. They fit under the curve, so their total is less than $\int_1^9 f(x)\,dx$. Slide the rectangles one unit left and they would poke above the curve instead.`,
  },
  {
    kind: "why",
    title: "Why rectangles trap the series between two integrals",
    body: md`Let $f$ be positive and decreasing for $x \ge 1$, and $a_n = f(n)$. On the interval $[k, k + 1]$ the biggest value of $f$ is at the left end and the smallest at the right end:

$$f(k + 1) \le f(x) \le f(k) \quad \text{for } k \le x \le k + 1.$$

Integrate across that interval of width 1: $a_{k+1} \le \int_k^{k+1} f(x)\,dx \le a_k$. Now add these up for $k = 1, 2, \ldots, N - 1$. The integrals join into one:

$$a_2 + a_3 + \cdots + a_N \;\le\; \int_1^N f(x)\,dx \;\le\; a_1 + a_2 + \cdots + a_{N-1}.$$

In terms of partial sums: $S_N - a_1 \le \int_1^N f(x)\,dx \le S_{N-1}$. The partial sums and the integral are never far apart. If one of them stays bounded, so does the other; if one runs off to infinity, so does the other.`,
  },
  {
    kind: "key",
    title: "The integral test",
    body: md`Suppose $f$ is positive, continuous and decreasing for $x \ge 1$, and $a_n = f(n)$. Then

$$\sum_{n=1}^{\infty} a_n \text{ converges} \iff \int_1^{\infty} f(x)\,dx \text{ converges}.$$

The series and the integral converge together or diverge together. **They are not equal**: $\sum \frac{1}{n^2} = \frac{\pi^2}{6}$ while $\int_1^\infty \frac{dx}{x^2} = 1$.

The conditions only need to hold from some point on. If $f$ decreases only for $x \ge 5$, start the integral at 5; the first few terms never affect convergence.`,
  },
  {
    kind: "proof",
    title: "The integral test",
    given: md`$f$ positive, continuous and decreasing for $x \ge 1$; $a_n = f(n)$; $S_N = a_1 + \cdots + a_N$`,
    prove: md`$\sum a_n$ converges exactly when $\int_1^\infty f(x)\,dx$ converges`,
    steps: [
      { statement: md`$S_N - a_1 \le \int_1^N f(x)\,dx \le S_{N-1}$`, reason: "Rectangles under and over the curve, added from 1 to N (the why box above)." },
      { statement: md`Suppose $\int_1^\infty f(x)\,dx = I$ is finite. Then $S_N \le a_1 + \int_1^N f(x)\,dx \le a_1 + I$ for every $N$.`, reason: md`Left half of step 1, and $\int_1^N f \le \int_1^\infty f$ because $f > 0$.` },
      { statement: md`$S_N$ is increasing and bounded above, so $S_N$ converges.`, reason: md`$S_{N+1} - S_N = a_{N+1} > 0$ gives increasing; the monotone bounded theorem (Lesson 1) gives the limit.` },
      { statement: md`Suppose instead $\int_1^\infty f(x)\,dx = \infty$. Then $S_{N-1} \ge \int_1^N f(x)\,dx \to \infty$.`, reason: "Right half of step 1." },
      { statement: md`So $S_N \to \infty$ and $\sum a_n$ diverges.`, reason: "The partial sums pass every bound." },
    ],
  },
  {
    kind: "why",
    title: "Why p-series converge exactly when p > 1",
    body: md`Apply the test to $f(x) = \frac{1}{x^p}$ with $p > 0$, which is positive, continuous and decreasing. For $p \ne 1$,

$$\int_1^b x^{-p}\,dx = \left[\frac{x^{1-p}}{1 - p}\right]_1^b = \frac{b^{1-p} - 1}{1 - p}.$$

- If $p > 1$ the exponent $1 - p$ is negative, so $b^{1-p} \to 0$ and the integral tends to $\frac{1}{p - 1}$. Finite: the series converges.
- If $p < 1$ the exponent is positive, so $b^{1-p} \to \infty$. The series diverges.
- If $p = 1$ the antiderivative is $\ln x$, and $\ln b \to \infty$. The harmonic series diverges, a second proof of what Lesson 2 showed by grouping.

If $p \le 0$ the terms don't even go to 0. So the dividing line is exactly $p = 1$, and $p = 1$ itself lands on the divergent side.`,
  },
  {
    kind: "key",
    title: "p-series",
    body: md`$$\sum_{n=1}^{\infty} \frac{1}{n^p} \quad \text{converges if } p > 1, \text{ diverges if } p \le 1.$$

These are the yardsticks for the next lesson. $\sum \frac{1}{n^2}$, $\sum \frac{1}{n^{3/2}}$ and $\sum \frac{1}{n^{1.01}}$ converge; $\sum \frac{1}{n}$, $\sum \frac{1}{\sqrt{n}}$ and $\sum \frac{1}{n^{0.99}}$ diverge. Write roots as powers first: $\frac{1}{\sqrt[3]{n^2}} = \frac{1}{n^{2/3}}$.`,
  },
  {
    kind: "plot",
    x: [0, 21],
    y: [0, 4],
    points: [...seqPoints((n) => squareSums[n - 1]!, 20, 1), ...seqPoints((n) => harmonicSums[n - 1]!, 20, 2)],
    hlines: [{ y: Math.PI ** 2 / 6, label: "\\pi^2/6" }],
    caption: md`Partial sums of $\sum \frac{1}{n^2}$ (blue) flatten out under $\frac{\pi^2}{6} \approx 1.645$. Partial sums of $\sum \frac{1}{n}$ (orange) keep climbing. Both sets of terms go to 0; only the first goes to 0 fast enough.`,
  },
  {
    kind: "example",
    title: "An integral test with arctan",
    problem: md`Does $\sum_{n=1}^{\infty} \frac{1}{n^2 + 1}$ converge?`,
    steps: [
      { math: md`f(x) = \frac{1}{x^2 + 1}`, note: "Positive, continuous, and decreasing for x ≥ 0: a bigger x makes a bigger denominator." },
      { math: md`\int_1^{\infty} \frac{dx}{x^2 + 1} = \lim_{b \to \infty} \left[\arctan x\right]_1^{b} = \frac{\pi}{2} - \frac{\pi}{4} = \frac{\pi}{4}`, note: md`$\arctan b \to \frac{\pi}{2}$ as $b \to \infty$.` },
      { math: md`\text{converges}`, note: md`The integral is finite, so the series converges. Its sum is some number between $\frac{\pi}{4}$ and $\frac{1}{2} + \frac{\pi}{4}$, not $\frac{\pi}{4}$ itself.` },
    ],
  },
  {
    kind: "example",
    title: "Slower than the harmonic series, still divergent",
    problem: md`Does $\sum_{n=2}^{\infty} \frac{1}{n \ln n}$ converge?`,
    steps: [
      { math: md`\int_2^{\infty} \frac{dx}{x \ln x} = \int_{\ln 2}^{\infty} \frac{du}{u}`, note: md`$u = \ln x$, $du = \frac{dx}{x}$. The function $\frac{1}{x \ln x}$ is positive and decreasing for $x \ge 2$.` },
      { math: md`= \lim_{b \to \infty} \left[\ln u\right]_{\ln 2}^{b} = \infty`, note: md`$\ln u$ grows without bound.` },
      { math: md`\text{diverges}`, note: md`Even though $\frac{1}{n \ln n}$ is smaller than $\frac{1}{n}$. By the same substitution, $\sum \frac{1}{n (\ln n)^2}$ converges: the integral becomes $\int \frac{du}{u^2}$, a $p$-integral with $p = 2$.` },
    ],
  },
  {
    kind: "key",
    title: "Remainder estimate",
    body: md`Suppose the integral test shows $\sum a_n = S$ converges, and you stop after $N$ terms. The **remainder** $R_N = S - S_N = a_{N+1} + a_{N+2} + \cdots$ satisfies

$$\int_{N+1}^{\infty} f(x)\,dx \;\le\; R_N \;\le\; \int_N^{\infty} f(x)\,dx.$$

So $S$ lies between $S_N + \int_{N+1}^\infty f$ and $S_N + \int_N^\infty f$. The width of that window is the uncertainty in your estimate.`,
  },
  {
    kind: "why",
    title: "Why the tail is trapped by two integrals",
    body: md`The tail $R_N = a_{N+1} + a_{N+2} + \cdots$ is the same rectangle picture, started at $x = N$ instead of $x = 1$.

As right-endpoint rectangles on $[N, N+1], [N+1, N+2], \ldots$, the heights $a_{N+1}, a_{N+2}, \ldots$ sit under the curve: $R_N \le \int_N^\infty f(x)\,dx$.

As left-endpoint rectangles on $[N+1, N+2], [N+2, N+3], \ldots$, the same heights poke above the curve: $R_N \ge \int_{N+1}^\infty f(x)\,dx$.

For $f(x) = \frac{1}{x^p}$, $\int_N^\infty x^{-p}\,dx = \frac{1}{(p - 1)N^{p-1}}$. The error after $N$ terms of $\sum \frac{1}{n^2}$ is at most $\frac{1}{N}$: to pin $\frac{\pi^2}{6}$ to three decimal places by brute force you would need about a thousand terms. The lower bound rescues the situation, as the next example shows.`,
  },
  {
    kind: "example",
    title: "Estimating a sum with a tail bound",
    problem: md`Use $S_{10} \approx 1.19753$ to estimate $\sum_{n=1}^{\infty} \frac{1}{n^3}$.`,
    steps: [
      { math: md`\int_N^{\infty} \frac{dx}{x^3} = \lim_{b \to \infty}\left[-\frac{1}{2x^2}\right]_N^{b} = \frac{1}{2N^2}`, note: "The tail integral for a general N." },
      { math: md`\frac{1}{2 \cdot 11^2} \le R_{10} \le \frac{1}{2 \cdot 10^2}, \qquad 0.00413 \le R_{10} \le 0.005`, note: md`Lower bound from $N + 1 = 11$, upper bound from $N = 10$.` },
      { math: md`1.20166 \le S \le 1.20253`, note: md`Add $S_{10}$ to both ends. The midpoint, $1.2021$, is within $0.0005$ of the true value $1.2020569\ldots$ Ten terms alone were off by $0.0045$.` },
    ],
  },
  {
    kind: "check",
    prompt: md`Does $\sum_{n=1}^{\infty} \frac{1}{\sqrt[3]{n^{2}}}$ converge or diverge?`,
    choices: CONV,
    accept: ["diverges"],
    explain: md`$\frac{1}{\sqrt[3]{n^2}} = \frac{1}{n^{2/3}}$, a $p$-series with $p = \frac{2}{3} \le 1$. It diverges.`,
  },
  {
    kind: "check",
    prompt: md`You approximate $\sum_{n=1}^{\infty} \frac{1}{n^{2}}$ by $S_{10}$. What is the largest the remainder $R_{10}$ could be, by the bound $R_N \le \int_N^\infty f(x)\,dx$? Give an exact fraction.`,
    answer: "1/10",
    explain: md`$\int_{10}^{\infty} \frac{dx}{x^2} = \left[-\frac{1}{x}\right]_{10}^{\infty} = \frac{1}{10}$. The true remainder is about $0.095$, close to the bound.`,
  },
];

const lesson4Blocks: Block[] = [
  {
    kind: "text",
    body: md`Most series are not geometric and not $p$-series, and their terms have no convenient antiderivative. $\sum \frac{1}{n^2 + 3}$, $\sum \frac{1}{2^n + n}$, $\sum \frac{\sqrt{n}}{n^2 - 1}$: the integral test would be painful or impossible.

But you don't need to integrate them. $\frac{1}{n^2 + 3}$ is smaller than $\frac{1}{n^2}$, and $\sum \frac{1}{n^2}$ converges. A series of positive terms, each smaller than the terms of a convergent series, must converge too: its partial sums can never climb past the other sum. That is the comparison test. The whole lesson is about making that idea exact and making it easy to apply.`,
  },
  {
    kind: "key",
    title: "The direct comparison test",
    body: md`Suppose $0 \le a_n \le b_n$ for all $n$ beyond some point.

- If $\sum b_n$ converges, then $\sum a_n$ converges.
- If $\sum a_n$ diverges, then $\sum b_n$ diverges.

Smaller than convergent is convergent. Bigger than divergent is divergent. The other two combinations tell you nothing: smaller than a divergent series, or bigger than a convergent one, could go either way.`,
  },
  {
    kind: "proof",
    title: "The direct comparison test",
    given: md`$0 \le a_n \le b_n$ for all $n \ge 1$, and $\sum b_n = B$ converges`,
    prove: md`$\sum a_n$ converges`,
    steps: [
      { statement: md`Let $S_N = a_1 + \cdots + a_N$ and $T_N = b_1 + \cdots + b_N$. Then $S_N \le T_N$.`, reason: "Add up N inequalities a_k ≤ b_k." },
      { statement: md`$T_N \le B$ for every $N$`, reason: md`$T_N$ is increasing (its terms are $\ge 0$) and tends to $B$, so it never exceeds $B$.` },
      { statement: md`$S_N \le B$ for every $N$`, reason: "Steps 1 and 2." },
      { statement: md`$S_N$ is increasing`, reason: md`$S_{N+1} - S_N = a_{N+1} \ge 0$.` },
      { statement: md`$S_N$ converges, so $\sum a_n$ converges`, reason: "Monotone bounded theorem (Lesson 1)." },
      { statement: md`If instead $\sum a_n$ diverges, then $\sum b_n$ diverges.`, reason: md`Contrapositive of what was just proved: if $\sum b_n$ converged, $\sum a_n$ would have to.` },
    ],
  },
  {
    kind: "why",
    title: "Why the terms must be positive, and why only the tail matters",
    body: md`The proof leaned on $S_N$ being increasing and bounded. Positive terms make it increasing; the comparison makes it bounded. Drop positivity and the test fails: $a_n = -1$ satisfies $a_n \le \frac{1}{n^2}$, and $\sum \frac{1}{n^2}$ converges, but $\sum (-1)$ diverges. Series with mixed signs get their own tests in the next lesson.

The inequality only needs to hold for $n \ge$ some $N_0$. The first $N_0 - 1$ terms add a fixed number to every partial sum, which changes the sum but not whether the partial sums settle. So "$\frac{\ln n}{n} \ge \frac{1}{n}$ for $n \ge 3$" is a perfectly good comparison.`,
  },
  {
    kind: "example",
    title: "Smaller than a convergent series",
    problem: md`Does $\sum_{n=1}^{\infty} \frac{1}{2^n + n}$ converge?`,
    steps: [
      { math: md`0 < \frac{1}{2^n + n} < \frac{1}{2^n}`, note: "Adding n to the denominator makes the fraction smaller." },
      { math: md`\sum_{n=1}^{\infty} \frac{1}{2^n} = \frac{1/2}{1 - 1/2} = 1`, note: md`Geometric, $r = \frac{1}{2}$: converges.` },
      { math: md`\sum \frac{1}{2^n + n} \text{ converges, with sum less than } 1`, note: "Smaller than convergent." },
    ],
  },
  {
    kind: "example",
    title: "Bigger than a divergent series",
    problem: md`Does $\sum_{n=1}^{\infty} \frac{n + 1}{n^2}$ converge?`,
    steps: [
      { math: md`\frac{n + 1}{n^2} = \frac{1}{n} + \frac{1}{n^2} > \frac{1}{n}`, note: "Split the fraction; the extra piece is positive." },
      { math: md`\sum \frac{1}{n} \text{ diverges}`, note: "Harmonic series." },
      { math: md`\sum \frac{n + 1}{n^2} \text{ diverges}`, note: "Bigger than divergent. Comparing with 1/n² instead would have told us nothing: the terms are bigger than those of a convergent series, which is no information." },
    ],
  },
  {
    kind: "plot",
    x: [0, 13],
    y: [0, 0.4],
    curves: [
      { expr: "1/x^2", label: "1/x^2", dashed: true, color: 1, domain: [1.6, 13] },
      { expr: "1/(x^2 - 1)", label: "1/(x^2 - 1)", dashed: true, color: 2, domain: [1.9, 13] },
    ],
    points: [...Array.from({ length: 11 }, (_, i) => ({ x: i + 2, y: 1 / (i + 2) ** 2, color: 1 as SeriesColor })), ...Array.from({ length: 11 }, (_, i) => ({ x: i + 2, y: 1 / ((i + 2) ** 2 - 1), color: 2 as SeriesColor }))],
    caption: md`$a_n = \frac{1}{n^2 - 1}$ (orange) sits *above* $b_n = \frac{1}{n^2}$ (blue), so "smaller than a convergent series" fails. Yet the two shrink at the same rate: their ratio tends to 1. The limit comparison test is built for this.`,
  },
  {
    kind: "key",
    title: "The limit comparison test",
    body: md`Suppose $a_n > 0$ and $b_n > 0$, and

$$\lim_{n \to \infty} \frac{a_n}{b_n} = L \quad \text{with } 0 < L < \infty.$$

Then $\sum a_n$ and $\sum b_n$ either both converge or both diverge.

In words: if two positive series have terms of the same size up to a constant factor, they share their fate. You no longer need the inequality to point the right way, only the sizes to match.`,
  },
  {
    kind: "why",
    title: "Why a finite positive limit is enough",
    body: md`If $\frac{a_n}{b_n} \to L$ with $L > 0$, then from some point on the ratio stays within $\frac{L}{2}$ of $L$:

$$\frac{L}{2} < \frac{a_n}{b_n} < \frac{3L}{2}, \qquad \text{so} \qquad \frac{L}{2}\,b_n < a_n < \frac{3L}{2}\,b_n.$$

Now use direct comparison twice. If $\sum b_n$ converges, so does $\sum \frac{3L}{2} b_n$ (a constant multiple), and $a_n$ is smaller: $\sum a_n$ converges. If $\sum b_n$ diverges, so does $\sum \frac{L}{2} b_n$, and $a_n$ is bigger: $\sum a_n$ diverges. The constants $\frac{L}{2}$ and $\frac{3L}{2}$ never matter, because a constant multiple never changes convergence.

The two edge cases are one-sided. If $L = 0$, then $a_n$ is eventually smaller than $b_n$: convergence of $\sum b_n$ passes to $\sum a_n$, but divergence does not. If $L = \infty$ it is the other way round.`,
  },
  {
    kind: "example",
    title: "A rational term",
    problem: md`Does $\sum_{n=1}^{\infty} \frac{3n + 1}{n^3 - 2n + 5}$ converge?`,
    steps: [
      { math: md`a_n = \frac{3n + 1}{n^3 - 2n + 5} \approx \frac{3n}{n^3} = \frac{3}{n^2}`, note: md`Keep the dominant term top and bottom. Choose $b_n = \frac{1}{n^2}$; the 3 is a constant and will show up in $L$.` },
      { math: md`\frac{a_n}{b_n} = \frac{n^2(3n + 1)}{n^3 - 2n + 5} = \frac{3n^3 + n^2}{n^3 - 2n + 5} \to 3`, note: "Same degree top and bottom: ratio of leading coefficients." },
      { math: md`\sum \frac{3n + 1}{n^3 - 2n + 5} \text{ converges}`, note: md`$L = 3$ is finite and positive, and $\sum \frac{1}{n^2}$ converges.` },
    ],
  },
  {
    kind: "example",
    title: "When direct comparison points the wrong way",
    problem: md`Does $\sum_{n=1}^{\infty} \frac{1}{2^n - n}$ converge?`,
    steps: [
      { math: md`\frac{1}{2^n - n} > \frac{1}{2^n}`, note: md`Bigger than the terms of a convergent series: direct comparison with $\frac{1}{2^n}$ says nothing.` },
      { math: md`\frac{a_n}{b_n} = \frac{2^n}{2^n - n} = \frac{1}{1 - n/2^n} \to \frac{1}{1 - 0} = 1`, note: md`$b_n = \frac{1}{2^n}$. Divide top and bottom by $2^n$; $\frac{n}{2^n} \to 0$ because exponentials beat powers (L'Hôpital on $\frac{x}{2^x}$).` },
      { math: md`\sum \frac{1}{2^n - n} \text{ converges}`, note: md`$L = 1$, and $\sum \frac{1}{2^n}$ converges.` },
    ],
  },
  {
    kind: "key",
    title: "Choosing what to compare with",
    body: md`Keep only the fastest-growing piece on top and on bottom, and drop constants. The growth ladder, slowest to fastest:

$$\ln n \;\ll\; n^{p} \;\ll\; c^{n} \;\ll\; n! \;\ll\; n^{n} \qquad (p > 0,\; c > 1).$$

- $\frac{\sqrt{n}}{n^2 + 5} \approx \frac{n^{1/2}}{n^2} = \frac{1}{n^{3/2}}$: converges.
- $\frac{2n^2 + 1}{n^3 + 4n} \approx \frac{2n^2}{n^3} = \frac{2}{n}$: diverges.
- $\frac{1}{\sqrt{n^2 + 1}} \approx \frac{1}{n}$: diverges.
- $\frac{n^2}{3^n + n} \approx \frac{n^2}{3^n}$: converges (the ratio test, next lesson, makes this official).

Use direct comparison when the inequality is obvious. Use limit comparison when it isn't, or when it points the wrong way.`,
  },
  {
    kind: "check",
    prompt: md`Does $\sum_{n=1}^{\infty} \frac{1}{n^{3} + 7}$ converge or diverge?`,
    choices: CONV,
    accept: ["converges"],
    explain: md`$0 < \frac{1}{n^3 + 7} < \frac{1}{n^3}$, and $\sum \frac{1}{n^3}$ converges ($p = 3$). Smaller than convergent.`,
  },
  {
    kind: "check",
    prompt: md`For the limit comparison of $a_n = \frac{2n + 3}{n^3 + 4}$ with $b_n = \frac{1}{n^2}$, find $\lim_{n \to \infty} \frac{n^2(2n + 3)}{n^3 + 4}$.`,
    answer: "2",
    explain: md`$\frac{2n^3 + 3n^2}{n^3 + 4} \to 2$, the ratio of leading coefficients. Since $0 < 2 < \infty$ and $\sum \frac{1}{n^2}$ converges, $\sum a_n$ converges.`,
  },
];

const lesson5Blocks: Block[] = [
  {
    kind: "text",
    body: md`The harmonic series $1 + \frac{1}{2} + \frac{1}{3} + \cdots$ diverges. Flip every other sign:

$$1 - \frac{1}{2} + \frac{1}{3} - \frac{1}{4} + \frac{1}{5} - \cdots$$

Now the partial sums are $1, 0.5, 0.833, 0.583, 0.783, 0.617, \ldots$. They swing back and forth, but each swing is shorter than the last, and they close in on a number near 0.69. This **alternating harmonic series** converges, to $\ln 2$ as Unit 4 will show. The signs are doing the work: positive terms push the sum up, negative terms pull it back, and the pushes shrink.

Every test so far needed positive terms. This lesson handles series whose terms alternate in sign, and then asks what role the signs really play.`,
  },
  {
    kind: "plot",
    x: [0, 15],
    y: [0.4, 1.05],
    points: seqPoints((n) => altHarmonicSums[n - 1]!, 14),
    hlines: [{ y: Math.log(2), label: "\\ln 2" }],
    caption: md`Partial sums of $\sum \frac{(-1)^{n+1}}{n}$. Odd-numbered sums come down from above, even-numbered sums come up from below, and the limit $\ln 2 \approx 0.693$ is trapped between them.`,
  },
  {
    kind: "key",
    title: "The alternating series test",
    body: md`Let $b_n > 0$. The alternating series

$$\sum_{n=1}^{\infty} (-1)^{n+1} b_n = b_1 - b_2 + b_3 - b_4 + \cdots$$

converges if the sizes $b_n$ **decrease** ($b_{n+1} \le b_n$) and **tend to 0**.

Both conditions matter. If $b_n \not\to 0$ the series diverges by the divergence test. If $b_n \to 0$ but not monotonically, the series can still diverge. Starting with $-b_1$ instead changes nothing but the sign of the sum.`,
  },
  {
    kind: "why",
    title: "Why the partial sums are nested",
    body: md`Follow the partial sums. $S_1 = b_1$. Then $S_2 = b_1 - b_2$, a step back of size $b_2$. Then $S_3 = S_2 + b_3$, a step forward, but $b_3 \le b_2$, so it doesn't reach $S_1$. Then $S_4 = S_3 - b_4$ steps back, but not past $S_2$ since $b_4 \le b_3$.

Each step reverses direction and is no longer than the step before. So the even partial sums creep up, the odd partial sums creep down, and every even sum sits below every odd sum:

$$S_2 \le S_4 \le S_6 \le \cdots \le S_5 \le S_3 \le S_1.$$

Two monotone bounded sequences, each converging. And the gap between $S_{2k}$ and $S_{2k+1}$ is exactly $b_{2k+1}$, which tends to 0. So both limits are the same number, and the whole sequence $S_N$ converges to it. That is the proof; the next block writes it out line by line.`,
  },
  {
    kind: "proof",
    title: "The alternating series test",
    given: md`$b_n > 0$, $b_{n+1} \le b_n$ for all $n$, $b_n \to 0$; $S_N = \sum_{n=1}^{N} (-1)^{n+1} b_n$`,
    prove: md`$S_N$ converges`,
    steps: [
      { statement: md`$S_{2k+2} = S_{2k} + (b_{2k+1} - b_{2k+2}) \ge S_{2k}$`, reason: md`$b_{2k+1} \ge b_{2k+2}$ since the $b_n$ decrease. The even partial sums increase.` },
      { statement: md`$S_{2k+1} = S_{2k-1} - (b_{2k} - b_{2k+1}) \le S_{2k-1}$`, reason: md`$b_{2k} \ge b_{2k+1}$. The odd partial sums decrease.` },
      { statement: md`$S_{2k} = S_{2k-1} - b_{2k} \le S_{2k-1} \le S_1$`, reason: md`$b_{2k} > 0$, and step 2 repeated.` },
      { statement: md`$S_{2k}$ converges to some $S$`, reason: md`Increasing (step 1) and bounded above by $S_1$ (step 3): monotone bounded theorem.` },
      { statement: md`$S_{2k+1} = S_{2k} + b_{2k+1} \to S + 0 = S$`, reason: md`Limit law for a sum, and $b_n \to 0$.` },
      { statement: md`$S_N \to S$`, reason: "Both the even and odd partial sums tend to S, so beyond some point every partial sum, of either parity, is within any given band around S." },
    ],
  },
  {
    kind: "key",
    title: "The alternating series error bound",
    body: md`Under the conditions of the test, if $S$ is the sum and $S_N$ a partial sum, then

$$|S - S_N| \le b_{N+1}.$$

The error is at most the size of the first term you left out. It also has that term's sign: if the next term is positive, $S_N$ is below $S$; if negative, above.`,
  },
  {
    kind: "why",
    title: "Why the first omitted term bounds the error",
    body: md`From the nesting, $S$ lies between any even partial sum and any odd one. In particular it lies between $S_N$ and $S_{N+1}$, whichever is the larger. Those two differ by exactly $b_{N+1}$:

$$S_{N+1} - S_N = (-1)^{N+2} b_{N+1}, \qquad |S_{N+1} - S_N| = b_{N+1}.$$

A number trapped between $S_N$ and $S_{N+1}$ can't be farther than $b_{N+1}$ from $S_N$. And since $S$ is on the $S_{N+1}$ side of $S_N$, the error $S - S_N$ has the sign of the step from $S_N$ to $S_{N+1}$, which is the sign of the omitted term.

Compare this with the integral test's remainder, which needed an integral. Here the bound is free: just look at the next term.`,
  },
  {
    kind: "example",
    title: "How good is a partial sum?",
    problem: md`$S_{10} = 1 - \frac{1}{2} + \frac{1}{3} - \cdots - \frac{1}{10} \approx 0.6456$. How far is this from $\ln 2 = \sum_{n=1}^{\infty} \frac{(-1)^{n+1}}{n}$?`,
    steps: [
      { math: md`|S - S_{10}| \le b_{11} = \frac{1}{11} \approx 0.0909`, note: "The first omitted term." },
      { math: md`S - S_{10} > 0`, note: md`The omitted term $+\frac{1}{11}$ is positive, so $S_{10}$ is an underestimate.` },
      { math: md`0.6456 < \ln 2 < 0.7365`, note: md`The truth is $\ln 2 \approx 0.6931$, error $0.0475$. The bound is loose by about a factor of 2 here, which is typical: the real error is roughly half the next term when the terms shrink slowly.` },
    ],
  },
  {
    kind: "example",
    title: "How many terms for a given accuracy",
    problem: md`How many terms of $\sum_{n=1}^{\infty} \frac{(-1)^{n+1}}{n^2}$ guarantee an error of at most $0.001$?`,
    steps: [
      { math: md`|S - S_N| \le b_{N+1} = \frac{1}{(N + 1)^2}`, note: "The error bound." },
      { math: md`\frac{1}{(N+1)^2} \le 0.001 \iff (N + 1)^2 \ge 1000 \iff N + 1 \ge 31.62\ldots`, note: "Flip (both sides positive) and take the square root." },
      { math: md`N = 31`, note: md`$N + 1 = 32$ is the first whole number past $31.62$. Check: $b_{32} = \frac{1}{1024} < 0.001$ but $b_{31} = \frac{1}{961} > 0.001$.` },
    ],
  },
  {
    kind: "key",
    title: "Absolute and conditional convergence",
    body: md`A series $\sum a_n$ **converges absolutely** if $\sum |a_n|$ converges. It **converges conditionally** if $\sum a_n$ converges but $\sum |a_n|$ diverges.

**Absolute convergence implies convergence.** So for a series with mixed signs you can test $\sum |a_n|$ with the positive-term tests from Lessons 3 and 4, and if that converges you are done.

$\sum \frac{(-1)^n}{n^2}$ converges absolutely ($\sum \frac{1}{n^2}$ converges). The alternating harmonic series converges only conditionally: it converges, but $\sum \frac{1}{n}$ does not.`,
  },
  {
    kind: "proof",
    title: "Absolute convergence implies convergence",
    given: md`$\sum |a_n|$ converges`,
    prove: md`$\sum a_n$ converges`,
    steps: [
      { statement: md`$0 \le a_n + |a_n| \le 2|a_n|$`, reason: md`If $a_n \ge 0$ the middle is $2|a_n|$; if $a_n < 0$ it is $0$. Either way it lands in $[0, 2|a_n|]$.` },
      { statement: md`$\sum (a_n + |a_n|)$ converges`, reason: md`Direct comparison with $\sum 2|a_n|$, a convergent series times 2. The terms are nonnegative, as the comparison test requires.` },
      { statement: md`$a_n = (a_n + |a_n|) - |a_n|$`, reason: "Algebra." },
      { statement: md`$\sum a_n$ converges`, reason: "The difference of two convergent series converges (algebra of series, Lesson 2)." },
    ],
  },
  {
    kind: "why",
    title: "Why conditional convergence is fragile",
    body: md`In a finite sum you may add the terms in any order. In an absolutely convergent series you still may: every rearrangement has the same sum. In a conditionally convergent series you may not.

Take the alternating harmonic series and reorder it as two positive terms, then one negative, repeating:

$$1 + \tfrac{1}{3} - \tfrac{1}{2} + \tfrac{1}{5} + \tfrac{1}{7} - \tfrac{1}{4} + \tfrac{1}{9} + \tfrac{1}{11} - \tfrac{1}{6} + \cdots = \tfrac{3}{2}\ln 2.$$

Same terms, different sum. The reason: the positive terms alone add up to $\infty$, and so do the negative ones. By spending positives faster than negatives you push the running total as high as you like before letting the negatives pull it back. Riemann proved that a conditionally convergent series can be rearranged to converge to **any** real number, or to diverge. Absolute convergence is what makes an infinite sum behave like a finite one.`,
  },
  {
    kind: "example",
    title: "Classifying a series",
    problem: md`Classify $\sum_{n=1}^{\infty} \frac{(-1)^n}{\sqrt{n}}$ as absolutely convergent, conditionally convergent, or divergent.`,
    steps: [
      { math: md`\sum \left|\frac{(-1)^n}{\sqrt{n}}\right| = \sum \frac{1}{n^{1/2}} \text{ diverges}`, note: md`A $p$-series with $p = \frac{1}{2}$. No absolute convergence.` },
      { math: md`b_n = \frac{1}{\sqrt{n}} \text{ decreases and } \to 0`, note: "The alternating series test applies." },
      { math: md`\text{converges conditionally}`, note: "The series converges because of the alternating signs, not because the terms are small enough on their own." },
    ],
  },
  {
    kind: "check",
    prompt: md`The series $\sum_{n=1}^{\infty} \frac{(-1)^{n+1}}{n^{2}}$ converges to $S$. By the alternating series error bound, how far can $S_4$ be from $S$ at most? Give an exact fraction.`,
    answer: "1/25",
    explain: md`The first omitted term is $b_5 = \frac{1}{5^2} = \frac{1}{25}$. Since that term is positive, $S_4$ is below $S$.`,
  },
  {
    kind: "check",
    prompt: md`Classify $\sum_{n=1}^{\infty} \frac{(-1)^n}{n^{3}}$.`,
    choices: ["converges absolutely", "converges conditionally", "diverges"],
    accept: ["converges absolutely"],
    explain: md`$\sum \frac{1}{n^3}$ converges ($p = 3 > 1$), so the series converges absolutely. No need for the alternating series test.`,
  },
];

const factorials = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600];

const lesson6Blocks: Block[] = [
  {
    kind: "text",
    body: md`Series like $\sum \frac{3^n}{n!}$ and $\sum \frac{n^5}{2^n}$ have terms built from factorials and exponentials. Comparing them with a $p$-series is awkward: $\frac{n^5}{2^n}$ is eventually smaller than $\frac{1}{n^2}$, but proving that takes work, and the integral test is hopeless with $n!$.

There is a better handle. A geometric series $\sum ar^n$ is the one where **each term is a fixed multiple $r$ of the one before**. For $\frac{3^n}{n!}$ the ratio of consecutive terms is $\frac{3}{n + 1}$: not fixed, but heading to 0. Terms that eventually shrink by a factor better than any $r < 1$ should be squeezed under a convergent geometric series. That is the ratio test, and the root test is its cousin.`,
  },
  {
    kind: "key",
    title: "The ratio test",
    body: md`Suppose $\lim_{n \to \infty} \left|\frac{a_{n+1}}{a_n}\right| = L$.

- If $L < 1$, the series $\sum a_n$ converges absolutely.
- If $L > 1$ (or the ratio tends to $\infty$), the series diverges.
- If $L = 1$, the test says nothing.

Factorials and exponentials cancel beautifully in the ratio: $\frac{(n+1)!}{n!} = n + 1$ and $\frac{c^{n+1}}{c^n} = c$.`,
  },
  {
    kind: "why",
    title: "Why a ratio below 1 forces convergence",
    body: md`Say $L < 1$ and pick a number $r$ strictly between $L$ and 1, such as $r = \frac{L + 1}{2}$. Since the ratios tend to $L$, from some index $N$ on they all stay below $r$:

$$|a_{n+1}| \le r\,|a_n| \quad \text{for } n \ge N.$$

Apply it repeatedly: $|a_{N+1}| \le r|a_N|$, then $|a_{N+2}| \le r|a_{N+1}| \le r^2|a_N|$, and in general $|a_{N+k}| \le |a_N|\,r^k$. The tail of $\sum |a_n|$ sits under the geometric series $|a_N| \sum r^k$, which converges because $r < 1$. Direct comparison finishes the job, and absolute convergence gives convergence.

If $L > 1$, the same reasoning with $r$ between 1 and $L$ gives $|a_{n+1}| \ge r|a_n| > |a_n|$ eventually: the terms grow, so they can't tend to 0, and the series diverges by the divergence test.`,
  },
  {
    kind: "proof",
    title: "The ratio test, convergent case",
    given: md`$a_n \ne 0$ and $\left|\frac{a_{n+1}}{a_n}\right| \to L < 1$`,
    prove: md`$\sum |a_n|$ converges`,
    steps: [
      { statement: md`Let $r = \frac{L + 1}{2}$. Then $L < r < 1$.`, reason: "The midpoint of L and 1." },
      { statement: md`There is an $N$ with $\left|\frac{a_{n+1}}{a_n}\right| < r$ for all $n \ge N$.`, reason: md`Definition of the limit, with a band of half-width $r - L > 0$ around $L$.` },
      { statement: md`$|a_{N+k}| \le |a_N|\, r^{k}$ for every $k \ge 0$`, reason: md`Apply $|a_{n+1}| < r|a_n|$ $k$ times in a row, starting at $n = N$.` },
      { statement: md`$\sum_{k=0}^{\infty} |a_N|\, r^{k} = \frac{|a_N|}{1 - r}$ converges`, reason: md`Geometric series with $0 < r < 1$.` },
      { statement: md`$\sum_{n=N}^{\infty} |a_n|$ converges, hence $\sum |a_n|$ converges`, reason: "Direct comparison (step 3 against step 4); the first N - 1 terms don't affect convergence." },
    ],
  },
  {
    kind: "example",
    title: "A power against an exponential",
    problem: md`Does $\sum_{n=1}^{\infty} \frac{n^3}{3^n}$ converge?`,
    steps: [
      { math: md`\frac{a_{n+1}}{a_n} = \frac{(n+1)^3}{3^{n+1}} \cdot \frac{3^n}{n^3} = \frac{1}{3}\left(\frac{n + 1}{n}\right)^{3}`, note: md`Flip and multiply; $\frac{3^n}{3^{n+1}} = \frac{1}{3}$.` },
      { math: md`L = \frac{1}{3} \cdot 1^3 = \frac{1}{3} < 1`, note: md`$\frac{n+1}{n} \to 1$, and a fixed cube of that tends to 1.` },
      { math: md`\text{converges}`, note: md`The first terms actually grow: $\frac{1}{3}, \frac{8}{9}, 1, \frac{64}{81}, \ldots$ Beyond $n = 3$ they fall, eventually by a factor close to $\frac{1}{3}$ each step.` },
    ],
  },
  {
    kind: "example",
    title: "A factorial against an exponential",
    problem: md`Does $\sum_{n=1}^{\infty} \frac{n!}{10^n}$ converge?`,
    steps: [
      { math: md`\frac{a_{n+1}}{a_n} = \frac{(n+1)!}{10^{n+1}} \cdot \frac{10^n}{n!} = \frac{n + 1}{10}`, note: md`$(n+1)! = (n+1) \cdot n!$.` },
      { math: md`\frac{n + 1}{10} \to \infty`, note: md`The ratio passes 1 at $n = 9$ and keeps growing.` },
      { math: md`\text{diverges}`, note: md`The first terms shrink: $0.1, 0.02, 0.006, \ldots$ down to $a_9 = a_{10} \approx 0.00036$. Then they turn around and blow up. Watching the first ten terms would have fooled you.` },
    ],
  },
  {
    kind: "plot",
    x: [0, 13],
    y: [0, 27],
    points: Array.from({ length: 12 }, (_, i) => ({ x: i + 1, y: `c^${i + 1}/${factorials[i + 1]}` })),
    params: [{ name: "c", tex: "c", min: 1, max: 5, step: 0.5, value: 3 }],
    caption: md`Terms $a_n = \frac{c^n}{n!}$ with $c = {c}$. Each term is the previous one times $\frac{c}{n}$: the terms rise while $n < c$, then collapse once the factorial's new factor $n$ outgrows $c$. The ratio test sees only the collapse, which is what matters.`,
  },
  {
    kind: "key",
    title: "The root test",
    body: md`Suppose $\lim_{n \to \infty} \sqrt[n]{|a_n|} = L$.

- If $L < 1$, $\sum a_n$ converges absolutely.
- If $L > 1$, it diverges.
- If $L = 1$, the test says nothing.

Reach for it when $a_n$ is something raised to the $n$th power, like $\left(\frac{2n}{3n + 1}\right)^{n}$ or $\frac{1}{(\ln n)^n}$. Useful limits: $\sqrt[n]{n} \to 1$ and $\sqrt[n]{c} \to 1$ for any constant $c > 0$ (Lesson 1).`,
  },
  {
    kind: "why",
    title: "Why the root test is the ratio test's twin",
    body: md`If $\sqrt[n]{|a_n|} \to L < 1$, pick $r$ between $L$ and 1. From some point on $\sqrt[n]{|a_n|} < r$, which is the same as

$$|a_n| < r^n.$$

That is a direct comparison with the convergent geometric series $\sum r^n$, with no chain of ratios needed. If $L > 1$, eventually $|a_n| > 1$, so the terms don't tend to 0 and the series diverges.

Both tests measure the same thing: how fast the terms shrink compared with a geometric series. When the ratio $\left|\frac{a_{n+1}}{a_n}\right|$ has a limit, $\sqrt[n]{|a_n|}$ has the same limit. So if the ratio test gives $L = 1$, the root test will too; switching tests won't rescue you. The root test earns its place when $a_n$ has an $n$th power that the root strips off cleanly.`,
  },
  {
    kind: "example",
    title: "Stripping an nth power",
    problem: md`Does $\sum_{n=1}^{\infty} \left(\frac{2n}{3n + 1}\right)^{n}$ converge?`,
    steps: [
      { math: md`\sqrt[n]{a_n} = \frac{2n}{3n + 1}`, note: md`The $n$th root undoes the $n$th power.` },
      { math: md`L = \lim_{n \to \infty} \frac{2n}{3n + 1} = \frac{2}{3} < 1`, note: "Ratio of leading coefficients." },
      { math: md`\text{converges}`, note: md`Eventually $a_n < \left(\frac{3}{4}\right)^n$, say. The ratio test would work too, but $\frac{a_{n+1}}{a_n}$ is a mess here.` },
    ],
  },
  {
    kind: "why",
    title: "Why L = 1 tells you nothing",
    body: md`For $a_n = \frac{1}{n}$, the ratio is $\frac{n}{n + 1} \to 1$. For $a_n = \frac{1}{n^2}$, the ratio is $\frac{n^2}{(n+1)^2} \to 1$. One series diverges and the other converges, with the same $L$. So $L = 1$ cannot decide.

The reason is in the proof. $L < 1$ gave a geometric series with ratio $r < 1$ to compare with. When $L = 1$ there is no such $r$: the terms shrink slower than every geometric series, and whether they shrink fast enough is exactly the question a $p$-series or a comparison test answers. **Every** series with terms that are a quotient of polynomials, roots or logs gives $L = 1$. Don't waste the ratio test on them.`,
  },
  {
    kind: "key",
    title: "Choosing a test",
    body: md`- Do the terms tend to 0? If not: **diverges** (divergence test).
- Geometric or telescoping? Sum it directly.
- A $p$-series, $\sum \frac{1}{n^p}$? Converges exactly when $p > 1$.
- Factorials, or $n$ in an exponent? **Ratio test**. Something to the $n$th power? **Root test**.
- Terms that look like a $p$-series up to lower-order junk? **Limit comparison** with the dominant terms; **direct comparison** when the inequality is obvious.
- Alternating signs? Test $\sum |a_n|$ first. If it diverges, try the **alternating series test**.
- A positive, decreasing $f(n)$ you can integrate? **Integral test**, also for error bounds.

Most series yield to the first test that fits. If one test is inconclusive, change tests, not effort.`,
  },
  {
    kind: "example",
    title: "Picking the tool",
    problem: md`Does $\sum_{n=1}^{\infty} \frac{n^2}{e^{n}}$ converge?`,
    steps: [
      { math: md`\frac{n^2}{e^n} \to 0`, note: "The divergence test is silent. There is an n in an exponent, which points to the ratio test." },
      { math: md`\frac{a_{n+1}}{a_n} = \frac{(n+1)^2}{e^{n+1}} \cdot \frac{e^n}{n^2} = \frac{1}{e}\left(\frac{n + 1}{n}\right)^2 \to \frac{1}{e}`, note: md`$\frac{1}{e} \approx 0.37 < 1$.` },
      { math: md`\text{converges}`, note: md`Absolutely, and by the proof the tail is squeezed under a geometric series with any ratio above $\frac{1}{e}$. The integral test would also work, with integration by parts twice.` },
    ],
  },
  {
    kind: "check",
    prompt: md`For $\sum_{n=1}^{\infty} \frac{n^{2}}{2^{n}}$, the ratio $\frac{a_{n+1}}{a_n}$ simplifies to $\frac{(n + 1)^2}{2n^2}$. Find $\lim_{n \to \infty} \frac{(n + 1)^2}{2n^2}$. Give an exact value, like 1/3.`,
    answer: "1/2",
    explain: md`$\frac{(n+1)^2}{2n^2} = \frac{1}{2}\left(1 + \frac{1}{n}\right)^2 \to \frac{1}{2}$. Since $L = \frac{1}{2} < 1$, the series converges.`,
  },
  {
    kind: "check",
    prompt: md`Apply the root test to $\sum_{n=1}^{\infty} \left(\frac{4n + 1}{3n + 5}\right)^{n}$. What does it say?`,
    choices: ROOT_CHOICES,
    accept: ["diverges"],
    explain: md`$\sqrt[n]{a_n} = \frac{4n + 1}{3n + 5} \to \frac{4}{3} > 1$. The terms eventually exceed 1, so the series diverges.`,
  },
];

// ── The unit ────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "Sequences and Series",
  lessons: [
    {
      id: slug("Sequences and their limits"),
      title: "Sequences and their limits",
      summary: "A sequence is a function on the whole numbers, so function limits carry over. Powers r^n, the squeeze theorem, (1 + 1/n)^n, and why monotone bounded sequences converge.",
      blocks: lesson1Blocks,
      practice: [rationalLimit, famousLimits, recursiveAndOscillating],
    },
    {
      id: slug("Series and partial sums"),
      title: "Series and partial sums",
      summary: "An infinite sum is the limit of its partial sums. Geometric series summed by the shift-and-subtract trick, telescoping series, and the divergence test with its proof.",
      blocks: lesson2Blocks,
      practice: [geometricSum, telescopingSum, partialSumCompute],
    },
    {
      id: slug("The integral test"),
      title: "The integral test",
      summary: "Terms as rectangles next to the graph of f trap the partial sums between two integrals. The integral test, p-series, and remainder estimates from the tail integral.",
      blocks: lesson3Blocks,
      practice: [pSeries, integralTestDecide, remainderBound],
    },
    {
      id: slug("Comparison tests"),
      title: "Comparison tests",
      summary: "Smaller than convergent is convergent; bigger than divergent is divergent. The limit comparison test for when the inequality points the wrong way, and how to choose what to compare with.",
      blocks: lesson4Blocks,
      practice: [directComparison, limitComparisonRatio, pickComparison],
    },
    {
      id: slug("Alternating series"),
      title: "Alternating series",
      summary: "Nested partial sums prove the alternating series test. The error is at most the first omitted term. Absolute versus conditional convergence, and why rearranging a conditionally convergent series is dangerous.",
      blocks: lesson5Blocks,
      practice: [alternatingPartialSum, alternatingErrorBound, absOrConditional],
    },
    {
      id: slug("Ratio and root tests"),
      title: "Ratio and root tests",
      summary: "Terms that shrink faster than some geometric series must converge. The ratio test for factorials and exponentials, the root test for nth powers, why L = 1 is inconclusive, and a strategy for choosing a test.",
      blocks: lesson6Blocks,
      practice: [ratioTestDecide, ratioLimit, rootTestDecide],
    },
  ],
};
