import { frac, fracTex, poly, signed } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** x^n in LaTeX ("x", "x^{3}", "" for n = 0). */
const xp = (n: number) => (n === 0 ? "" : n === 1 ? "x" : `x^{${n}}`);
/** x^n in typed-answer text ("x", "x^3", "" for n = 0). */
const xt = (n: number) => (n === 0 ? "" : n === 1 ? "x" : `x^${n}`);

/** A coefficient in front of something: 1 and -1 are hidden, 0 gives "0". */
const cmul = (c: number, body: string) => (c === 0 ? "0" : body === "" ? String(c) : c === 1 ? body : c === -1 ? `-${body}` : `${c}${body}`);
/** base^n with the exponent 1 hidden. */
const pw = (base: string, n: number) => (n === 1 ? base : `(${base})^${n}`);
/** The same in LaTeX. */
const pwTex = (base: string, n: number) => (n === 1 ? base : `(${base})^{${n}}`);
/** A number in parentheses when negative, for "\\cdot (-5)". */
const paren = (n: number) => (n < 0 ? `(${n})` : String(n));

/** Join signed terms the way a person writes them: ["3x", "-5", "2"] -> "3x - 5 + 2". Zero terms are dropped. */
function sum(terms: (string | null | undefined)[]): string {
  let out = "";
  for (const t of terms) {
    if (!t || t === "0") continue;
    if (!out) out = t;
    else if (t.startsWith("-")) out += ` - ${t.slice(1)}`;
    else out += ` + ${t}`;
  }
  return out || "0";
}

/** (ax + b) as LaTeX / text, with a coefficient of 1 hidden. */
const lin = (a: number, b: number) => poly([[a, "x"], [b, ""]]);
/** Wrap in parentheses unless it is a single term. */
const par = (s: string) => (/[+-]/.test(s.slice(1)) ? `(${s})` : s);

/** Exact values of sin and cos at the friendly angles, as n·√rad / 2. */
interface Half {
  n: number;
  rad: 1 | 2 | 3;
}
const ANGLES: { tex: string; sin: Half; cos: Half }[] = [
  { tex: "0", sin: { n: 0, rad: 1 }, cos: { n: 2, rad: 1 } },
  { tex: "\\frac{\\pi}{6}", sin: { n: 1, rad: 1 }, cos: { n: 1, rad: 3 } },
  { tex: "\\frac{\\pi}{4}", sin: { n: 1, rad: 2 }, cos: { n: 1, rad: 2 } },
  { tex: "\\frac{\\pi}{3}", sin: { n: 1, rad: 3 }, cos: { n: 1, rad: 1 } },
  { tex: "\\frac{\\pi}{2}", sin: { n: 2, rad: 1 }, cos: { n: 0, rad: 1 } },
  { tex: "\\pi", sin: { n: 0, rad: 1 }, cos: { n: -2, rad: 1 } },
];

/** Sum of k · (n√rad / 2) terms, combined by radicand, as answer text and LaTeX. */
function radicalSum(terms: [number, Half][]): { text: string; tex: string } {
  const c: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const [k, h] of terms) c[h.rad]! += k * h.n;
  const text: string[] = [];
  const tex: string[] = [];
  for (const rad of [1, 2, 3]) {
    const v = c[rad]!;
    if (!v) continue;
    if (rad === 1) {
      text.push(frac(v, 2));
      tex.push(fracTex(v, 2));
    } else if (v % 2 === 0) {
      text.push(cmul(v / 2, `sqrt(${rad})`));
      tex.push(cmul(v / 2, `\\sqrt{${rad}}`));
    } else {
      text.push(`${v}sqrt(${rad})/2`);
      tex.push(`${v < 0 ? "-" : ""}\\frac{${Math.abs(v) === 1 ? "" : Math.abs(v)}\\sqrt{${rad}}}{2}`);
    }
  }
  return { text: sum(text), tex: sum(tex) };
}

// ── Lesson 1: Power rule ────────────────────────────────────────────────────

const differentiatePolynomial: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const n = r.int(3, 6);
    const m = r.int(1, n - 1);
    const a = r.coef(-5, 5);
    const b = r.nonzero(-6, 6);
    const c = r.nonzero(-9, 9);
    const tex = sum([cmul(a, xp(n)), cmul(b, xp(m)), String(c)]);
    const answer = sum([cmul(a * n, xt(n - 1)), cmul(b * m, xt(m - 1))]);
    return {
      prompt: md`Differentiate $${tex}$. Give an expression in $x$.`,
      answer,
      hint: md`Work term by term. The power rule turns $x^{${n}}$ into $${n}x^{${n - 1}}$, and the constant ${c} has derivative 0.`,
      solution: [
        { math: md`\frac{d}{dx}\left(${cmul(a, xp(n))}\right) + \frac{d}{dx}\left(${cmul(b, xp(m))}\right) + \frac{d}{dx}(${c})`, note: "Sum rule: differentiate each term on its own." },
        { math: sum([`${a} \\cdot ${n}${xp(n - 1)}`, `${b} \\cdot ${m}${xp(m - 1)}`]), note: md`Power rule on each term, with the constant multiple carried along. The constant ${c} contributes 0.` },
        { math: sum([cmul(a * n, xp(n - 1)), cmul(b * m, xp(m - 1))]), note: "Multiply the coefficients." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.coef(-4, 4);
    const b = r.nonzero(-6, 6);
    const c = r.nonzero(-9, 9);
    const d = r.int(-9, 9);
    const tex = sum([cmul(a, "x^{3}"), cmul(b, "x^{2}"), cmul(c, "x"), d ? String(d) : null]);
    const answer = sum([cmul(3 * a, "x^2"), cmul(2 * b, "x"), String(c)]);
    return {
      prompt: md`Differentiate $${tex}$. Give an expression in $x$.`,
      answer,
      hint: md`Each power drops by one and its old exponent becomes a factor: $x^3 \to 3x^2$, $x^2 \to 2x$, $x \to 1$.`,
      solution: [
        { math: sum([`${a} \\cdot 3x^{2}`, `${b} \\cdot 2x`, `${c} \\cdot 1`]), note: md`Power rule on each term. The derivative of $${cmul(c, "x")}$ is $${c}$: a line's slope is its coefficient. The constant contributes 0.` },
        { math: answer.replace(/\^2/g, "^{2}"), note: "" },
      ],
    };
  }
  const a = r.coef(-9, 9);
  const n = r.int(4, 9);
  const c = r.nonzero(-20, 20);
  return {
    prompt: md`Differentiate $${cmul(a, xp(n))} ${signed(c)}$. Give an expression in $x$.`,
    answer: cmul(a * n, xt(n - 1)),
    hint: md`A constant multiple rides along: $\frac{d}{dx}(c \cdot x^n) = c \cdot n x^{n-1}$. The lone constant disappears.`,
    solution: [
      { math: md`${a} \cdot ${n}x^{${n - 1}}`, note: md`Bring the exponent ${n} down as a factor and lower it to ${n - 1}. The derivative of $${c}$ is 0.` },
      { math: cmul(a * n, xp(n - 1)), note: "" },
    ],
  };
};

const rootsAndReciprocals: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.int(1, 9) * r.sign();
    const n = r.int(1, 4);
    const tex = a < 0 ? `-\\frac{${-a}}{${xp(n)}}` : `\\frac{${a}}{${xp(n)}}`;
    const xn = n === 1 ? "x" : `x^{${n}}`;
    return {
      prompt: md`Differentiate $${tex}$. Write the answer without negative exponents.`,
      answer: `${-a * n}/x^${n + 1}`,
      positiveExponents: true,
      hint: md`Rewrite as $${cmul(a, `x^{-${n}}`)}$ first. The power rule works for negative exponents too: $n = -${n}$.`,
      solution: [
        { math: md`${cmul(a, `x^{-${n}}`)}`, note: md`$\frac{1}{${xn}} = x^{-${n}}$.` },
        { math: md`${a} \cdot (-${n}) x^{-${n} - 1} = ${cmul(-a * n, `x^{-${n + 1}}`)}`, note: md`Power rule: multiply by the exponent $-${n}$, then subtract 1 from it.` },
        { math: md`${-a * n < 0 ? "-" : ""}\frac{${Math.abs(a * n)}}{x^{${n + 1}}}`, note: "Back to a fraction." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.coef(-8, 8);
    const b = r.nonzero(-6, 6);
    const tex = sum([cmul(a, "\\sqrt{x}"), cmul(b, "x")]);
    return {
      prompt: md`Differentiate $${tex}$. Write roots as sqrt(x).`,
      answer: sum([`${a}/(2sqrt(x))`, String(b)]),
      hint: md`$\sqrt{x} = x^{1/2}$. Then the power rule gives $\frac12 x^{-1/2} = \frac{1}{2\sqrt{x}}$.`,
      solution: [
        { math: md`${cmul(a, "x^{1/2}")} ${b < 0 ? "-" : "+"} ${cmul(Math.abs(b), "x")}`, note: "Write the root as a power." },
        { math: md`${a} \cdot \tfrac{1}{2} x^{-1/2} ${b < 0 ? "-" : "+"} ${Math.abs(b)}`, note: md`Power rule with $n = \frac12$: the new exponent is $\frac12 - 1 = -\frac12$.` },
        { math: sum([`${a < 0 ? "-" : ""}\\frac{${Math.abs(a)}}{2\\sqrt{x}}`, String(b)]), note: md`$x^{-1/2} = \frac{1}{\sqrt{x}}$.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.coef(-6, 6);
    const [p, q] = r.pick<[number, number]>([[3, 2], [5, 2], [1, 3], [2, 3], [4, 3]]);
    const tex = `${cmul(a, `x^{${p}/${q}}`)}`;
    const num = a * p;
    const newExp = p - q; // over q
    const answerBody = newExp > 0 ? `x^(${newExp}/${q})` : `/x^(${-newExp}/${q})`;
    const coefText = frac(num, q);
    const answer = newExp > 0 ? (coefText.includes("/") ? `(${coefText})${answerBody}` : cmul(Number(coefText), answerBody)) : `${coefText}${answerBody}`;
    return {
      prompt: md`Differentiate $${tex}$. You may leave fractional exponents, like x^(1/2).`,
      answer,
      hint: md`The power rule holds for fractions: multiply by $\frac{${p}}{${q}}$ and subtract 1 from the exponent.`,
      solution: [
        { math: md`${a} \cdot \frac{${p}}{${q}} x^{${p}/${q} - 1}`, note: "Power rule." },
        { math: md`${fracTex(num, q)} x^{${newExp}/${q}}`, note: md`$\frac{${p}}{${q}} - 1 = \frac{${newExp}}{${q}}$.` },
        ...(newExp < 0 ? [{ math: md`\frac{${fracTex(num, q)}}{x^{${-newExp}/${q}}}`, note: "Or, with a positive exponent." }] : []),
      ],
    };
  }
  const a = r.coef(-9, 9);
  const b = r.int(1, 3);
  const tex = `\\frac{x^{${b + 1}} ${signed(a)}}{x}`;
  const answer = sum([cmul(b, xt(b - 1)), `${-a}/x^2`]);
  return {
    prompt: md`Differentiate $${tex}$. Write the answer without negative exponents.`,
    answer,
    positiveExponents: true,
    hint: "Divide first. Each term of the top divided by x is a power of x, and then the power rule applies term by term.",
    solution: [
      { math: md`${xp(b)} ${signed(a)}x^{-1}`, note: md`$\frac{x^{${b + 1}}}{x} = ${xp(b)}$ and $\frac{${a}}{x} = ${a}x^{-1}$.` },
      { math: md`${cmul(b, xp(b - 1))} ${a < 0 ? "+" : "-"} ${Math.abs(a)}x^{-2}`, note: md`Power rule on each term; $-1 \cdot x^{-2}$ picks up a minus sign.` },
      { math: sum([cmul(b, xp(b - 1)), `${-a < 0 ? "-" : ""}\\frac{${Math.abs(a)}}{x^{2}}`]), note: "" },
    ],
  };
};

const tangentLines: Generator = (r) => {
  if (r.next() < 0.5) {
    const a = r.coef(-3, 3);
    const b = r.nonzero(-7, 7);
    const c = r.int(-9, 9);
    const p = r.nonzero(-3, 3);
    const tex = sum([cmul(a, "x^{3}"), cmul(b, "x"), c ? String(c) : null]);
    const value = 3 * a * p * p + b;
    return {
      prompt: md`Find $f'(x)$ when $f(x) = ${tex}$ and $x = ${p}$. This is the slope of the tangent line there; give a number.`,
      answer: String(value),
      hint: md`Differentiate first, then substitute $x = ${p}$. Never substitute before differentiating: the derivative of a number is 0.`,
      solution: [
        { math: md`f'(x) = ${sum([cmul(3 * a, "x^{2}"), String(b)])}`, note: "Power rule term by term." },
        { math: md`f'(${p}) = ${3 * a}(${p})^2 ${signed(b)} = ${3 * a * p * p} ${signed(b)}`, note: md`Substitute $x = ${p}$ into the derivative.` },
        { math: String(value), note: "" },
      ],
    };
  }
  const a = r.coef(-3, 3);
  const B = r.int(-6, 6);
  const c = r.int(-8, 8);
  const p = r.nonzero(-3, 3);
  const fp = a * p * p + B * p + c;
  const m = 2 * a * p + B;
  const n = fp - m * p;
  const tex = sum([cmul(a, "x^{2}"), cmul(B, "x"), c ? String(c) : null]);
  return {
    prompt: md`Find the tangent line to $y = ${tex}$ at $x = ${p}$. Give its slope and $y$-intercept as a pair (m, b).`,
    answer: `(${m}, ${n})`,
    form: "tuple",
    // The line passes through the point of tangency and meets the parabola only once.
    verify: [`m(${p}) + n = ${fp}`, `(${B} - m)^2 - 4(${a})(${c} - n) = 0`],
    hint: md`The slope is $y'$ at $x = ${p}$. The line also passes through $(${p}, y(${p}))$, which pins down the intercept.`,
    solution: [
      { math: md`y' = ${sum([cmul(2 * a, "x"), B ? String(B) : null])}`, note: "Differentiate." },
      { math: md`m = y'(${p}) = ${m}`, note: md`$${2 * a}(${p}) ${B ? signed(B) : ""} = ${m}$.` },
      { math: md`y(${p}) = ${fp}`, note: md`$${a}(${p})^2 ${B ? signed(B * p) : ""} ${c ? signed(c) : ""}$: the point of tangency is $(${p}, ${fp})$.` },
      { math: md`${fp} = ${m}(${p}) + b \;\Rightarrow\; b = ${n}`, note: md`A line through $(${p}, ${fp})$ with slope $${m}$.` },
      { math: md`y = ${lin(m, n)}`, note: md`Slope $${m}$, intercept $${n}$.` },
    ],
  };
};

// ── Lesson 2: Product and quotient rules ────────────────────────────────────

const productRule: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.coef(-4, 4);
    const b = r.nonzero(-6, 6);
    const c = r.coef(-4, 4);
    const d = r.nonzero(-6, 6);
    const f = poly([[a, "x^2"], [b, ""]]);
    const g = lin(c, d);
    const answer = poly([[3 * a * c, "x^2"], [2 * a * d, "x"], [b * c, ""]]);
    return {
      prompt: md`Differentiate $(${f})(${g})$ using the product rule. Give an expression in $x$.`,
      answer,
      hint: md`$f = ${f}$ and $g = ${g}$. Then $(fg)' = f'g + fg'$ with $f' = ${cmul(2 * a, "x")}$ and $g' = ${c}$.`,
      solution: [
        { math: md`f' = ${cmul(2 * a, "x")}, \qquad g' = ${c}`, note: "Differentiate each factor by the power rule." },
        { math: md`(${cmul(2 * a, "x")})(${g}) + (${f})(${c})`, note: md`$f'g + fg'$.` },
        { math: sum([poly([[2 * a * c, "x^2"], [2 * a * d, "x"]]), poly([[a * c, "x^2"], [b * c, ""]])]), note: "Expand each product." },
        { math: answer, note: md`Combine like terms. Check: expanding $(${f})(${g})$ first and differentiating gives the same thing.` },
      ],
    };
  }
  if (kind === 1) {
    const c = r.nonzero(-9, 9);
    const n = r.int(2, 3);
    const f = `\\sqrt{x}`;
    const g = poly([[1, xp(n)], [c, ""]]);
    const answer = `(${poly([[1, xt(n)], [c, ""]])})/(2sqrt(x)) + ${n}${xt(n - 1)}sqrt(x)`;
    return {
      prompt: md`Differentiate $${f}\,(${g})$. Write roots as sqrt(x).`,
      answer,
      hint: md`Product rule with $f = \sqrt{x}$, $f' = \frac{1}{2\sqrt{x}}$, and $g = ${g}$.`,
      solution: [
        { math: md`f' = \frac{1}{2\sqrt{x}}, \qquad g' = ${n}${xp(n - 1)}`, note: md`$\sqrt{x} = x^{1/2}$ has derivative $\frac12 x^{-1/2}$.` },
        { math: md`\frac{${g}}{2\sqrt{x}} + \sqrt{x} \cdot ${n}${xp(n - 1)}`, note: md`$f'g + fg'$.` },
        { math: md`\frac{${g}}{2\sqrt{x}} + ${n}${xp(n - 1)}\sqrt{x}`, note: "Either form is a correct derivative." },
      ],
    };
  }
  const a = r.nonzero(-5, 5);
  const b = r.nonzero(-5, 5);
  const f = poly([[1, "x^2"], [a, ""]]);
  const g = poly([[1, "x^3"], [b, "x"]]);
  const answer = poly([[5, "x^4"], [3 * a + 3 * b, "x^2"], [a * b, ""]]);
  return {
    prompt: md`Differentiate $(${f})(${g})$. Give an expression in $x$.`,
    answer,
    hint: md`$(fg)' = f'g + fg'$ with $f' = 2x$ and $g' = ${poly([[3, "x^2"], [b, ""]])}$. Then expand and combine.`,
    solution: [
      { math: md`(2x)(${g}) + (${f})(${poly([[3, "x^2"], [b, ""]])})`, note: md`$f'g + fg'$.` },
      { math: sum([poly([[2, "x^4"], [2 * b, "x^2"]]), poly([[3, "x^4"], [b + 3 * a, "x^2"], [a * b, ""]])]), note: "Expand each product." },
      { math: answer, note: "Combine like terms." },
    ],
  };
};

const quotientRule: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let a: number, b: number, c: number, d: number;
    do {
      a = r.nonzero(-5, 5);
      b = r.nonzero(-7, 7);
      c = r.nonzero(-4, 4);
      d = r.nonzero(-7, 7);
    } while (a * d - b * c === 0);
    const top = lin(a, b);
    const bot = lin(c, d);
    const k = a * d - b * c;
    return {
      prompt: md`Differentiate $\frac{${top}}{${bot}}$. Give an expression in $x$; a power of a sum is typed like (2x + 1)^2.`,
      answer: `${k}/(${bot})^2`,
      hint: md`Quotient rule: $\left(\frac{f}{g}\right)' = \frac{f'g - fg'}{g^2}$ with $f' = ${a}$ and $g' = ${c}$. The $x$ terms on top cancel.`,
      solution: [
        { math: md`\frac{(${a})(${bot}) - (${top})(${c})}{(${bot})^2}`, note: md`$f'g - fg'$ over $g^2$. Keep the order: derivative of the top first.` },
        { math: md`\frac{${poly([[a * c, "x"], [a * d, ""]])} - (${poly([[a * c, "x"], [b * c, ""]])})}{(${bot})^2}`, note: "Expand the top." },
        { math: md`\frac{${k}}{(${bot})^2}`, note: md`The $x$ terms cancel, leaving $${a * d} - ${paren(b * c)} = ${k}$. This always happens for a quotient of two lines.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.nonzero(-9, 9);
    const b = r.nonzero(-5, 5);
    const top = poly([[1, "x^2"], [a, ""]]);
    const bot = lin(1, b);
    const num = poly([[1, "x^2"], [2 * b, "x"], [-a, ""]]);
    return {
      prompt: md`Differentiate $\frac{${top}}{${bot}}$. Give an expression in $x$.`,
      answer: `(${num})/(${bot})^2`,
      hint: md`$f = ${top}$, $f' = 2x$; $g = ${bot}$, $g' = 1$. Simplify the numerator after applying the rule.`,
      solution: [
        { math: md`\frac{2x(${bot}) - (${top})(1)}{(${bot})^2}`, note: md`$\frac{f'g - fg'}{g^2}$.` },
        { math: md`\frac{${poly([[2, "x^2"], [2 * b, "x"]])} - ${par(top)}}{(${bot})^2}`, note: "Expand the top." },
        { math: md`\frac{${num}}{(${bot})^2}`, note: "Combine like terms." },
      ],
    };
  }
  const a = r.coef(-9, 9);
  const b = r.int(1, 9);
  const bot = poly([[1, "x^2"], [b, ""]]);
  return {
    prompt: md`Differentiate $\frac{${a}}{${bot}}$. Give an expression in $x$.`,
    answer: `${-2 * a}x/(${bot})^2`,
    hint: md`With a constant on top, $f' = 0$ and the quotient rule shrinks to the reciprocal rule: $\left(\frac{c}{g}\right)' = -\frac{c\,g'}{g^2}$.`,
    solution: [
      { math: md`\frac{0 \cdot (${bot}) - ${paren(a)} \cdot 2x}{(${bot})^2}`, note: md`$f'g - fg'$ with $f' = 0$ and $g' = 2x$.` },
      { math: md`\frac{${-2 * a}x}{(${bot})^2}`, note: "" },
    ],
  };
};

const productQuotientAtPoint: Generator = (r) => {
  if (r.next() < 0.5) {
    const a = r.nonzero(-5, 5);
    const b = r.coef(-4, 4);
    const c = r.nonzero(-6, 6);
    const p = r.nonzero(-2, 2);
    const f = poly([[1, "x^2"], [a, ""]]);
    const g = lin(b, c);
    const value = 2 * p * (b * p + c) + (p * p + a) * b;
    return {
      prompt: md`Find $f'(x)$ when $f(x) = (${f})(${g})$ and $x = ${p}$. Give a number.`,
      answer: String(value),
      hint: md`Apply the product rule, then substitute $x = ${p}$ into every piece. There is no need to expand.`,
      solution: [
        { math: md`f'(x) = 2x(${g}) + (${f})(${b})`, note: md`$u'v + uv'$ with $u = ${f}$, $v = ${g}$.` },
        { math: md`f'(${p}) = 2(${p})(${b * p + c}) + (${p * p + a})(${b})`, note: md`At $x = ${p}$: $v(${p}) = ${b * p + c}$ and $u(${p}) = ${p * p + a}$.` },
        { math: md`${2 * p * (b * p + c)} ${signed((p * p + a) * b)} = ${value}`, note: "" },
      ],
    };
  }
  let a: number, b: number, c: number, d: number, p: number;
  do {
    a = r.nonzero(-5, 5);
    b = r.nonzero(-6, 6);
    c = r.nonzero(-3, 3);
    d = r.nonzero(-6, 6);
    p = r.int(-3, 3);
  } while (a * d - b * c === 0 || c * p + d === 0 || Math.abs(c * p + d) > 5);
  const top = lin(a, b);
  const bot = lin(c, d);
  const k = a * d - b * c;
  const den = (c * p + d) ** 2;
  return {
    prompt: md`Find $f'(x)$ when $f(x) = \frac{${top}}{${bot}}$ and $x = ${p}$. Give an exact fraction.`,
    answer: frac(k, den),
    hint: md`Quotient rule first. The numerator simplifies to the constant $${k}$, so only the denominator needs $x = ${p}$.`,
    solution: [
      { math: md`f'(x) = \frac{(${a})(${bot}) - (${top})(${c})}{(${bot})^2} = \frac{${k}}{(${bot})^2}`, note: md`The $x$ terms on top cancel.` },
      { math: md`f'(${p}) = \frac{${k}}{(${c * p + d})^2} = ${fracTex(k, den)}`, note: md`$${bot}$ at $x = ${p}$ is $${c * p + d}$.` },
    ],
  };
};

// ── Lesson 3: Trig derivatives ──────────────────────────────────────────────

const trigBasic: Generator = (r) => {
  const kind = r.int(0, 3);
  const a = r.coef(-6, 6);
  const b = r.nonzero(-6, 6);
  if (kind === 0) {
    const tex = sum([cmul(a, "\\sin x"), cmul(b, "\\cos x")]);
    return {
      prompt: md`Differentiate $${tex}$. Type sin(x) and cos(x).`,
      answer: sum([cmul(a, "cos(x)"), cmul(-b, "sin(x)")]),
      hint: md`$(\sin x)' = \cos x$ and $(\cos x)' = -\sin x$. Watch the sign on the cosine term.`,
      solution: [
        { math: md`${a} \cos x + ${b}(-\sin x)`, note: "Differentiate each term, carrying its coefficient." },
        { math: sum([cmul(a, "\\cos x"), cmul(-b, "\\sin x")]), note: "" },
      ],
    };
  }
  if (kind === 1) {
    const c = r.nonzero(-9, 9);
    const tex = sum([cmul(a, "\\tan x"), cmul(b, "x^{2}"), String(c)]);
    return {
      prompt: md`Differentiate $${tex}$. Type $\sec^2 x$ as (sec(x))^2.`,
      answer: sum([cmul(a, "(sec(x))^2"), cmul(2 * b, "x")]),
      hint: md`$(\tan x)' = \sec^2 x$, from the quotient rule on $\frac{\sin x}{\cos x}$.`,
      solution: [
        { math: md`${a} \sec^2 x + ${b} \cdot 2x + 0`, note: md`Tangent's derivative, then the power rule, and the constant drops.` },
        { math: sum([cmul(a, "\\sec^2 x"), cmul(2 * b, "x")]), note: "" },
      ],
    };
  }
  if (kind === 2) {
    const tex = sum([cmul(a, "\\sec x"), cmul(b, "x^{3}")]);
    return {
      prompt: md`Differentiate $${tex}$. Type sec(x) and tan(x).`,
      answer: sum([cmul(a, "sec(x)tan(x)"), cmul(3 * b, "x^2")]),
      hint: md`$(\sec x)' = \sec x \tan x$. It comes from the reciprocal rule on $\frac{1}{\cos x}$.`,
      solution: [
        { math: md`${a} \sec x \tan x + ${b} \cdot 3x^{2}`, note: "" },
        { math: sum([cmul(a, "\\sec x \\tan x"), cmul(3 * b, "x^{2}")]), note: "" },
      ],
    };
  }
  const tex = sum([cmul(a, "\\csc x"), cmul(b, "\\cot x")]);
  return {
    prompt: md`Differentiate $${tex}$. Type csc(x) and cot(x); write $\csc^2 x$ as (csc(x))^2.`,
    answer: sum([cmul(-a, "csc(x)cot(x)"), cmul(-b, "(csc(x))^2")]),
    hint: md`The co-functions both pick up a minus sign: $(\csc x)' = -\csc x \cot x$ and $(\cot x)' = -\csc^2 x$.`,
    solution: [
      { math: md`${a}(-\csc x \cot x) ${b < 0 ? "-" : "+"} ${Math.abs(b)}(-\csc^2 x)`, note: "" },
      { math: sum([cmul(-a, "\\csc x \\cot x"), cmul(-b, "\\csc^2 x")]), note: "" },
    ],
  };
};

const trigProductQuotient: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const n = r.int(2, 4);
    return {
      prompt: md`Differentiate $${xp(n)} \sin x$. Type sin(x) and cos(x).`,
      answer: `${n}${xt(n - 1)}sin(x) + ${xt(n)}cos(x)`,
      hint: md`Product rule: $f = x^{${n}}$, $g = \sin x$.`,
      solution: [
        { math: md`(${n}${xp(n - 1)})(\sin x) + (${xp(n)})(\cos x)`, note: md`$f'g + fg'$.` },
        { math: md`${n}${xp(n - 1)} \sin x + ${xp(n)} \cos x`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const a = r.coef(-6, 6);
    return {
      prompt: md`Differentiate $${cmul(a, "x \\cos x")}$. Type sin(x) and cos(x).`,
      answer: `${a}cos(x) - ${a}x sin(x)`,
      hint: md`Product rule with $f = ${cmul(a, "x")}$ and $g = \cos x$. Don't forget that $(\cos x)' = -\sin x$.`,
      solution: [
        { math: md`(${a})(\cos x) + (${cmul(a, "x")})(-\sin x)`, note: md`$f'g + fg'$.` },
        { math: sum([cmul(a, "\\cos x"), cmul(-a, "x \\sin x")]), note: "" },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`Differentiate $\frac{\sin x}{x}$. Type sin(x) and cos(x).`,
      answer: "(x cos(x) - sin(x))/x^2",
      hint: md`Quotient rule: $f = \sin x$, $g = x$.`,
      solution: [
        { math: md`\frac{(\cos x)(x) - (\sin x)(1)}{x^2}`, note: md`$\frac{f'g - fg'}{g^2}$.` },
        { math: md`\frac{x \cos x - \sin x}{x^2}`, note: "" },
      ],
    };
  }
  if (kind === 3) {
    const n = r.int(1, 2);
    return {
      prompt: md`Differentiate $\frac{\cos x}{${xp(n)}}$. Type sin(x) and cos(x).`,
      answer: `-(x sin(x) + ${cmul(n, "cos(x)")})/x^${n + 1}`,
      hint: md`Quotient rule, then cancel a common factor of $x$ from top and bottom.`,
      solution: [
        { math: md`\frac{(-\sin x)(${xp(n)}) - (\cos x)(${cmul(n, xp(n - 1))})}{x^{${2 * n}}}`, note: md`$\frac{f'g - fg'}{g^2}$.` },
        ...(n > 1
          ? [
              { math: md`\frac{-${xp(n - 1)}(x \sin x + ${n}\cos x)}{x^{${2 * n}}}`, note: md`Factor $-${xp(n - 1)}$ from the top.` },
              { math: md`-\frac{x \sin x + ${n}\cos x}{x^{${n + 1}}}`, note: md`Cancel $${xp(n - 1)}$.` },
            ]
          : [{ math: md`-\frac{x \sin x + \cos x}{x^{2}}`, note: "Pull the minus sign out front." }]),
      ],
    };
  }
  return {
    prompt: md`Differentiate $\sin x \cos x$. Type sin(x) and cos(x); a square like $\cos^2 x$ is (cos(x))^2.`,
    answer: "(cos(x))^2 - (sin(x))^2",
    hint: md`Product rule with $f = \sin x$ and $g = \cos x$.`,
    solution: [
      { math: md`(\cos x)(\cos x) + (\sin x)(-\sin x)`, note: md`$f'g + fg'$.` },
      { math: md`\cos^2 x - \sin^2 x`, note: md`This is $\cos 2x$: a double-angle identity falling out of the product rule.` },
    ],
  };
};

const trigAtPoint: Generator = (r) => {
  if (r.next() < 0.6) {
    const a = r.coef(-5, 5);
    const b = r.nonzero(-5, 5);
    const angle = r.pick(ANGLES);
    const tex = sum([cmul(a, "\\sin x"), cmul(b, "\\cos x")]);
    const value = radicalSum([[a, angle.cos], [-b, angle.sin]]);
    return {
      prompt: md`Find $f'(x)$ when $f(x) = ${tex}$ and $x = ${angle.tex}$. Give an exact value, like sqrt(3)/2.`,
      answer: value.text,
      hint: md`$f'(x) = ${sum([cmul(a, "\\cos x"), cmul(-b, "\\sin x")])}$. Then use the exact values of sine and cosine at $${angle.tex}$ from the unit circle.`,
      solution: [
        { math: md`f'(x) = ${sum([cmul(a, "\\cos x"), cmul(-b, "\\sin x")])}`, note: md`$(\sin x)' = \cos x$ and $(\cos x)' = -\sin x$.` },
        { math: md`\cos ${angle.tex} = ${radicalSum([[1, angle.cos]]).tex}, \qquad \sin ${angle.tex} = ${radicalSum([[1, angle.sin]]).tex}`, note: "Exact values from the unit circle." },
        { math: md`f'\left(${angle.tex}\right) = ${a}\left(${radicalSum([[1, angle.cos]]).tex}\right) ${-b < 0 ? "-" : "+"} ${Math.abs(b)}\left(${radicalSum([[1, angle.sin]]).tex}\right) = ${value.tex}`, note: "" },
      ],
    };
  }
  const a = r.coef(-6, 6);
  const [angleTex, sec2] = r.pick<[string, string]>([["0", "1"], ["\\frac{\\pi}{6}", "4/3"], ["\\frac{\\pi}{4}", "2"], ["\\frac{\\pi}{3}", "4"], ["\\pi", "1"]]);
  const [num, den] = sec2.includes("/") ? sec2.split("/").map(Number) : [Number(sec2), 1];
  return {
    prompt: md`Find $f'(x)$ when $f(x) = ${cmul(a, "\\tan x")}$ and $x = ${angleTex}$. Give an exact value.`,
    answer: frac(a * num!, den!),
    hint: md`$f'(x) = ${cmul(a, "\\sec^2 x")}$, and $\sec x = \frac{1}{\cos x}$.`,
    solution: [
      { math: md`f'(x) = ${cmul(a, "\\sec^2 x")}`, note: md`$(\tan x)' = \sec^2 x$.` },
      { math: md`\sec^2 ${angleTex} = \frac{1}{\cos^2 ${angleTex}} = ${fracTex(num!, den!)}`, note: md`Square the cosine value and take its reciprocal.` },
      { math: md`f'\left(${angleTex}\right) = ${a} \cdot ${fracTex(num!, den!)} = ${fracTex(a * num!, den!)}`, note: "" },
    ],
  };
};

// ── Lesson 4: Chain rule ────────────────────────────────────────────────────

const chainPower: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const a = r.coef(-5, 5);
    const b = r.nonzero(-7, 7);
    const n = r.int(3, 7);
    const inner = lin(a, b);
    return {
      prompt: md`Differentiate $(${inner})^{${n}}$. Leave the answer as a power of $${inner}$, typed like (2x + 1)^3.`,
      answer: `${n * a}(${inner})^${n - 1}`,
      hint: md`Outside: $u^{${n}}$, derivative $${n}u^{${n - 1}}$. Inside: $u = ${inner}$, derivative $${a}$. Multiply.`,
      solution: [
        { math: md`${n}(${inner})^{${n - 1}} \cdot \frac{d}{dx}(${inner})`, note: md`Power rule on the outside, evaluated at the inside, times the inside's derivative.` },
        { math: md`${n}(${inner})^{${n - 1}} \cdot ${paren(a)}`, note: md`$\frac{d}{dx}(${inner}) = ${a}$.` },
        { math: md`${n * a}(${inner})^{${n - 1}}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const c = r.nonzero(-9, 9);
    const n = r.int(3, 6);
    const inner = poly([[1, "x^2"], [c, ""]]);
    return {
      prompt: md`Differentiate $(${inner})^{${n}}$. Leave the answer as a power of $${inner}$.`,
      answer: `${2 * n}x(${inner})^${n - 1}`,
      hint: md`The inside is $u = ${inner}$ with $u' = 2x$. The chain rule gives $${n}u^{${n - 1}} \cdot u'$.`,
      solution: [
        { math: md`${n}(${inner})^{${n - 1}} \cdot 2x`, note: md`Outside derivative at the inside, times inside derivative $2x$.` },
        { math: md`${2 * n}x(${inner})^{${n - 1}}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const a = r.coef(2, 6);
    const b = r.nonzero(-3, 9);
    const inner = lin(a, b);
    return {
      prompt: md`Differentiate $\sqrt{${inner}}$. Type roots as sqrt(...).`,
      answer: `${a}/(2sqrt(${inner}))`,
      hint: md`$\sqrt{u} = u^{1/2}$ has derivative $\frac{1}{2\sqrt{u}} \cdot u'$.`,
      solution: [
        { math: md`\frac{1}{2}(${inner})^{-1/2} \cdot ${a}`, note: md`Power rule with $n = \frac12$ on the outside, then times the inside derivative $${a}$.` },
        { math: md`\frac{${a}}{2\sqrt{${inner}}}`, note: "" },
      ],
    };
  }
  if (kind === 3) {
    const a = r.coef(2, 4);
    const b = r.nonzero(-7, 7);
    const n = r.int(1, 3);
    const inner = lin(a, b);
    return {
      prompt: md`Differentiate $\frac{1}{${n === 1 ? inner : `(${inner})^{${n}}`}}$. Write the answer without negative exponents.`,
      answer: `${-n * a}/(${inner})^${n + 1}`,
      positiveExponents: true,
      hint: md`Rewrite as $(${inner})^{-${n}}$, then chain rule: $-${n}u^{-${n + 1}} \cdot u'$.`,
      solution: [
        { math: md`(${inner})^{-${n}}`, note: "Write the reciprocal as a negative power." },
        { math: md`-${n}(${inner})^{-${n + 1}} \cdot ${a}`, note: md`Outside: exponent $-${n}$ comes down, new exponent $-${n + 1}$. Inside derivative $${a}$.` },
        { math: md`${-n * a < 0 ? "-" : ""}\frac{${Math.abs(n * a)}}{(${inner})^{${n + 1}}}`, note: "" },
      ],
    };
  }
  const b = r.nonzero(-6, 6);
  const n = r.int(2, 5);
  const inner = poly([[1, "x^3"], [b, "x"]]);
  const innerD = poly([[3, "x^2"], [b, ""]]);
  return {
    prompt: md`Differentiate $(${inner})^{${n}}$. Leave the answer as a power of $${inner}$.`,
    answer: `${n}(${innerD})(${inner})^${n - 1}`,
    hint: md`Inside $u = ${inner}$, $u' = ${innerD}$. Then $${n}u^{${n - 1}} u'$.`,
    solution: [
      { math: md`${n}(${inner})^{${n - 1}} \cdot (${innerD})`, note: md`Outside derivative at the inside, times the inside derivative.` },
      { math: md`${n}(${innerD})(${inner})^{${n - 1}}`, note: "Usually written with the inside derivative in front." },
    ],
  };
};

const chainTrig: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const a = r.coef(-5, 5);
    const b = r.int(-6, 6);
    const inner = lin(a, b);
    return {
      prompt: md`Differentiate $\sin(${inner})$. Type sin(...) and cos(...).`,
      answer: `${a}cos(${inner})`,
      hint: md`Outside $\sin u$ has derivative $\cos u$. Inside $u = ${inner}$ has derivative $${a}$.`,
      solution: [
        { math: md`\cos(${inner}) \cdot ${paren(a)}`, note: md`$\cos$ of the inside, times the inside's derivative.` },
        { math: md`${a}\cos(${inner})`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([1, 2, 3, 4, 5]);
    const inner = cmul(a, "x^2");
    return {
      prompt: md`Differentiate $\cos(${inner})$. Type sin(...) and cos(...).`,
      answer: `${-2 * a}x sin(${inner})`,
      hint: md`Outside $\cos u$ has derivative $-\sin u$. Inside $u = ${inner}$ has derivative $${cmul(2 * a, "x")}$.`,
      solution: [
        { math: md`-\sin(${inner}) \cdot ${cmul(2 * a, "x")}`, note: md`$-\sin$ of the inside, times the inside's derivative.` },
        { math: md`-${2 * a}x\sin(${inner})`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const a = r.coef(-4, 4);
    return {
      prompt: md`Differentiate $\tan(${a}x)$. Type $\sec^2(${a}x)$ as (sec(${a}x))^2.`,
      answer: `${a}(sec(${a}x))^2`,
      hint: md`$(\tan u)' = \sec^2 u \cdot u'$ with $u = ${a}x$.`,
      solution: [
        { math: md`\sec^2(${a}x) \cdot ${paren(a)}`, note: "" },
        { math: md`${a}\sec^2(${a}x)`, note: "" },
      ],
    };
  }
  if (kind === 3) {
    const n = r.int(2, 5);
    return {
      prompt: md`Differentiate $\sin^{${n}} x$. Type a power of sine like (sin(x))^2.`,
      answer: `${n}${pw("sin(x)", n - 1)}cos(x)`,
      hint: md`$\sin^{${n}} x$ means $(\sin x)^{${n}}$: the outside is $u^{${n}}$ and the inside is $\sin x$.`,
      solution: [
        { math: md`${n}${pwTex("(\\sin x)", n - 1)} \cdot \cos x`, note: md`Power rule on the outside, then the derivative of the inside, $\cos x$.` },
        { math: md`${n}${n === 2 ? "\\sin x" : `\\sin^{${n - 1}} x`} \cos x`, note: "" },
      ],
    };
  }
  const a = r.coef(2, 6);
  return {
    prompt: md`Differentiate $x\sin(${a}x)$. Type sin(...) and cos(...).`,
    answer: `sin(${a}x) + ${a}x cos(${a}x)`,
    hint: md`Product rule first, with $f = x$ and $g = \sin(${a}x)$. The chain rule is needed for $g'$.`,
    solution: [
      { math: md`(1)\sin(${a}x) + x \cdot \frac{d}{dx}\sin(${a}x)`, note: md`$f'g + fg'$.` },
      { math: md`\sin(${a}x) + x \cdot ${a}\cos(${a}x)`, note: md`Chain rule: $\cos(${a}x)$ times the inside derivative $${a}$.` },
      { math: md`\sin(${a}x) + ${a}x\cos(${a}x)`, note: "" },
    ],
  };
};

const chainMixed: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    let a: number, b: number, p: number;
    do {
      a = r.coef(-3, 3);
      b = r.nonzero(-6, 6);
      p = r.int(-3, 3);
    } while (Math.abs(a * p + b) > 3 || a * p + b === 0);
    const n = r.int(2, 4);
    const inner = lin(a, b);
    const value = n * a * (a * p + b) ** (n - 1);
    return {
      prompt: md`Find $f'(x)$ when $f(x) = (${inner})^{${n}}$ and $x = ${p}$. Give a number.`,
      answer: String(value),
      hint: md`Chain rule gives $f'(x) = ${n * a}(${inner})^{${n - 1}}$. Then substitute.`,
      solution: [
        { math: md`f'(x) = ${n}(${inner})^{${n - 1}} \cdot ${paren(a)}`, note: "Chain rule." },
        { math: md`f'(${p}) = ${n * a}(${a * p + b})^{${n - 1}} = ${value}`, note: md`The inside at $x = ${p}$ is $${a * p + b}$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.coef(2, 5);
    return {
      prompt: md`Differentiate $\sin^{2}(${a}x)$. Type it with (sin(${a}x))^2 style powers.`,
      answer: `${2 * a}sin(${a}x)cos(${a}x)`,
      hint: md`Two layers: the outside is $u^2$, the middle is $\sin v$, the inside is $v = ${a}x$. Peel from the outside in.`,
      solution: [
        { math: md`2\sin(${a}x) \cdot \frac{d}{dx}\sin(${a}x)`, note: md`Outer layer: $u^2 \to 2u$, with $u = \sin(${a}x)$.` },
        { math: md`2\sin(${a}x) \cdot \cos(${a}x) \cdot ${a}`, note: md`Middle layer $\sin v \to \cos v$, inner layer $${a}x \to ${a}$.` },
        { math: md`${2 * a}\sin(${a}x)\cos(${a}x)`, note: md`Equal to $${a}\sin(${2 * a}x)$ by the double-angle identity.` },
      ],
    };
  }
  if (kind === 2) {
    const c = r.nonzero(-5, 5);
    const n = r.int(2, 4);
    const inner = `\\sin x ${signed(c)}`;
    return {
      prompt: md`Differentiate $(${inner})^{${n}}$. Leave the answer as a power of $${inner}$, typed like (sin(x) + 2)^2.`,
      answer: `${n}(sin(x) ${signed(c)})${n - 1 === 1 ? "" : `^${n - 1}`}cos(x)`,
      hint: md`Outside $u^{${n}}$, inside $u = ${inner}$ whose derivative is $\cos x$ (the constant contributes nothing).`,
      solution: [
        { math: md`${n}${pwTex(`(${inner})`, n - 1)} \cdot \cos x`, note: "Outside derivative at the inside, times the inside derivative." },
      ],
    };
  }
  const c = r.int(1, 9);
  const inner = `x^2 + ${c}`;
  return {
    prompt: md`Differentiate $\sqrt{${inner}}$. Type roots as sqrt(...).`,
    answer: `x/sqrt(${inner})`,
    hint: md`$\frac{1}{2\sqrt{u}} \cdot u'$ with $u = ${inner}$ and $u' = 2x$. The 2's cancel.`,
    solution: [
      { math: md`\frac{1}{2\sqrt{${inner}}} \cdot 2x`, note: md`Chain rule with the outside $\sqrt{u}$.` },
      { math: md`\frac{x}{\sqrt{${inner}}}`, note: "Cancel the 2." },
    ],
  };
};

// ── Lesson 5: Exponentials and logarithms ───────────────────────────────────

const expDerivatives: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const a = r.coef(-6, 6);
    const k = r.coef(-5, 5);
    return {
      prompt: md`Differentiate $${cmul(a, `e^{${k}x}`)}$. Type $e^{${k}x}$ as e^(${k}x).`,
      answer: `${a * k}e^(${k}x)`,
      hint: md`$e^u$ is its own derivative, times the inside derivative $u' = ${k}$ by the chain rule.`,
      solution: [
        { math: md`${a} \cdot e^{${k}x} \cdot ${paren(k)}`, note: md`$\frac{d}{dx}e^{u} = e^{u}u'$ with $u = ${k}x$.` },
        { math: md`${a * k}e^{${k}x}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([1, 2, 3, -1, -2]);
    const inner = cmul(a, "x^2");
    return {
      prompt: md`Differentiate $e^{${inner}}$. Type it as e^(${inner.replace("^2", "^2")}).`,
      answer: `${2 * a}x e^(${inner})`,
      hint: md`Chain rule: $e^{u}$ with $u = ${inner}$, $u' = ${cmul(2 * a, "x")}$.`,
      solution: [
        { math: md`e^{${inner}} \cdot ${cmul(2 * a, "x")}`, note: "" },
        { math: md`${2 * a}x\,e^{${inner}}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const n = r.int(1, 3);
    return {
      prompt: md`Differentiate $${xp(n)}e^{x}$. Type e^x for $e^x$.`,
      answer: n === 1 ? "e^x + x e^x" : `${n}${xt(n - 1)}e^x + ${xt(n)}e^x`,
      hint: md`Product rule: $f = ${xp(n)}$, $g = e^x$, and $g' = e^x$.`,
      solution: [
        { math: md`(${n === 1 ? "1" : `${n}${xp(n - 1)}`})e^{x} + ${xp(n)}e^{x}`, note: md`$f'g + fg'$.` },
        { math: md`(${poly([[1, xp(n)], [n, xp(n - 1)]])})e^{x}`, note: md`Factor out $e^x$; either form is fine.` },
      ],
    };
  }
  if (kind === 3) {
    const b = r.pick([2, 3, 5, 10]);
    const a = r.coef(-4, 4);
    return {
      prompt: md`Differentiate $${cmul(a, `\\cdot ${b}^{x}`)}$. Type $\ln ${b}$ as ln(${b}).`,
      answer: `${a}*${b}^x ln(${b})`,
      hint: md`$${b}^{x} = e^{x \ln ${b}}$, so its derivative is $${b}^{x} \ln ${b}$.`,
      solution: [
        { math: md`${a} \cdot ${b}^{x} \ln ${b}`, note: md`$\frac{d}{dx} b^x = b^x \ln b$: the slope factor of base $${b}$ is $\ln ${b} \approx ${Math.log(b).toFixed(3)}$.` },
      ],
    };
  }
  return {
    prompt: md`Differentiate $e^{\sin x}$. Type it as e^(sin(x)).`,
    answer: "cos(x) e^(sin(x))",
    hint: md`$e^{u}$ with $u = \sin x$.`,
    solution: [
      { math: md`e^{\sin x} \cdot \cos x`, note: md`$e^u u'$.` },
    ],
  };
};

const logDerivatives: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0) {
    const a = r.coef(2, 7);
    const b = r.nonzero(-9, 9);
    const inner = lin(a, b);
    return {
      prompt: md`Differentiate $\ln(${inner})$. Give an expression in $x$.`,
      answer: `${a}/(${inner})`,
      hint: md`$(\ln u)' = \frac{u'}{u}$ with $u = ${inner}$.`,
      solution: [
        { math: md`\frac{1}{${inner}} \cdot ${a}`, note: md`$\frac{1}{u}$ times the inside derivative.` },
        { math: md`\frac{${a}}{${inner}}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const c = r.int(1, 9);
    const inner = `x^2 + ${c}`;
    return {
      prompt: md`Differentiate $\ln(${inner})$. Give an expression in $x$.`,
      answer: `2x/(${inner})`,
      hint: md`$\frac{u'}{u}$ with $u = ${inner}$ and $u' = 2x$.`,
      solution: [{ math: md`\frac{2x}{${inner}}`, note: md`$\frac{u'}{u}$.` }],
    };
  }
  if (kind === 2) {
    const n = r.int(1, 3);
    return {
      prompt: md`Differentiate $${xp(n)} \ln x$. Type ln(x).`,
      answer: n === 1 ? "ln(x) + 1" : `${n}${xt(n - 1)}ln(x) + ${xt(n - 1)}`,
      hint: md`Product rule with $g = \ln x$, $g' = \frac{1}{x}$. The second term simplifies.`,
      solution: [
        { math: md`(${n === 1 ? "1" : `${n}${xp(n - 1)}`})\ln x + ${xp(n)} \cdot \frac{1}{x}`, note: md`$f'g + fg'$.` },
        { math: md`${n === 1 ? "" : `${n}${xp(n - 1)}`}\ln x + ${n === 1 ? "1" : xp(n - 1)}`, note: md`$\frac{${xp(n)}}{x} = ${n === 1 ? "1" : xp(n - 1)}$.` },
      ],
    };
  }
  if (kind === 3) {
    const b = r.pick([2, 3, 5, 10]);
    return {
      prompt: md`Differentiate $\log_{${b}} x$. Type $\ln ${b}$ as ln(${b}).`,
      answer: `1/(x ln(${b}))`,
      hint: md`Change of base: $\log_{${b}} x = \frac{\ln x}{\ln ${b}}$, and $\ln ${b}$ is just a constant.`,
      solution: [
        { math: md`\frac{d}{dx}\left(\frac{\ln x}{\ln ${b}}\right) = \frac{1}{\ln ${b}} \cdot \frac{1}{x}`, note: md`Constant multiple rule with the constant $\frac{1}{\ln ${b}}$.` },
        { math: md`\frac{1}{x \ln ${b}}`, note: "" },
      ],
    };
  }
  if (kind === 4) {
    const n = r.int(2, 4);
    return {
      prompt: md`Differentiate $(\ln x)^{${n}}$. Type ln(x).`,
      answer: `${n}${pw("ln(x)", n - 1)}/x`,
      hint: md`The outside is $u^{${n}}$ and the inside is $\ln x$.`,
      solution: [
        { math: md`${n}${pwTex("(\\ln x)", n - 1)} \cdot \frac{1}{x}`, note: "Chain rule." },
        { math: md`\frac{${n}${n === 2 ? "\\ln x" : `(\\ln x)^{${n - 1}}`}}{x}`, note: "" },
      ],
    };
  }
  return {
    prompt: md`Differentiate $\ln(\sin x)$. Type cot(x) for $\cot x$, or any equal form.`,
    answer: "cot(x)",
    hint: md`$\frac{u'}{u}$ with $u = \sin x$.`,
    solution: [
      { math: md`\frac{\cos x}{\sin x} = \cot x`, note: md`$\frac{u'}{u}$ with $u' = \cos x$.` },
    ],
  };
};

const logarithmicDifferentiation: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    return {
      prompt: md`Differentiate $x^{x}$ for $x > 0$. Type x^x and ln(x).`,
      answer: "x^x(ln(x) + 1)",
      positive: true,
      hint: md`Neither the power rule (the exponent isn't constant) nor the $b^x$ rule (the base isn't constant) applies. Take $\ln$ of both sides of $y = x^x$ first.`,
      solution: [
        { math: md`\ln y = x \ln x`, note: md`$\ln(x^x) = x \ln x$ by the power property of logs.` },
        { math: md`\frac{y'}{y} = \ln x + x \cdot \frac{1}{x} = \ln x + 1`, note: md`Differentiate both sides: chain rule on the left, product rule on the right.` },
        { math: md`y' = x^{x}(\ln x + 1)`, note: md`Multiply by $y = x^x$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(2, 4);
    return {
      prompt: md`Differentiate $x^{${k}x}$ for $x > 0$. Type x^(${k}x) and ln(x).`,
      answer: `${k}x^(${k}x)(ln(x) + 1)`,
      positive: true,
      hint: md`Take logs: $\ln y = ${k}x \ln x$. Differentiate, then multiply back by $y$.`,
      solution: [
        { math: md`\ln y = ${k}x \ln x`, note: "Power property of logs." },
        { math: md`\frac{y'}{y} = ${k}\ln x + ${k}x \cdot \frac{1}{x} = ${k}\ln x + ${k}`, note: "Product rule on the right." },
        { math: md`y' = ${k}x^{${k}x}(\ln x + 1)`, note: md`Multiply by $y$ and factor out $${k}$.` },
      ],
    };
  }
  if (kind === 2) {
    const n = r.int(2, 3);
    const k = r.coef(2, 4);
    return {
      prompt: md`Differentiate $${xp(n)}e^{${k}x}$. Type e^(${k}x).`,
      answer: `${n}${xt(n - 1)}e^(${k}x) + ${k}${xt(n)}e^(${k}x)`,
      hint: md`Product rule, or take logs: $\ln y = ${n}\ln x + ${k}x$, so $\frac{y'}{y} = \frac{${n}}{x} + ${k}$.`,
      solution: [
        { math: md`\ln y = ${n}\ln x + ${k}x`, note: "Log of a product is a sum; the exponents come down." },
        { math: md`\frac{y'}{y} = \frac{${n}}{x} + ${k}`, note: "Differentiate both sides." },
        { math: md`y' = ${xp(n)}e^{${k}x}\left(\frac{${n}}{x} + ${k}\right) = ${n}${xp(n - 1)}e^{${k}x} + ${k}${xp(n)}e^{${k}x}`, note: md`Multiply by $y$ and distribute. The product rule gives the same two terms.` },
      ],
    };
  }
  return {
    prompt: md`Differentiate $x^{\sqrt{x}}$ for $x > 0$. Type x^sqrt(x), ln(x) and sqrt(x).`,
    answer: "x^sqrt(x)(ln(x) + 2)/(2sqrt(x))",
    positive: true,
    hint: md`$\ln y = \sqrt{x}\,\ln x$. Differentiate with the product rule, then multiply by $y$.`,
    solution: [
      { math: md`\ln y = \sqrt{x} \ln x`, note: "Power property of logs." },
      { math: md`\frac{y'}{y} = \frac{1}{2\sqrt{x}}\ln x + \sqrt{x} \cdot \frac{1}{x} = \frac{\ln x}{2\sqrt{x}} + \frac{1}{\sqrt{x}}`, note: md`Product rule; $\frac{\sqrt{x}}{x} = \frac{1}{\sqrt{x}}$.` },
      { math: md`\frac{y'}{y} = \frac{\ln x + 2}{2\sqrt{x}}`, note: md`Common denominator $2\sqrt{x}$.` },
      { math: md`y' = \frac{x^{\sqrt{x}}(\ln x + 2)}{2\sqrt{x}}`, note: md`Multiply by $y = x^{\sqrt{x}}$.` },
    ],
  };
};

// ── Unit ────────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "Differentiation Rules",
  lessons: [
    {
      id: slug("Power rule, derived"),
      title: "Power rule, derived",
      summary: "The power rule from the binomial expansion, with the constant, constant-multiple and sum rules proved from the limit laws, so polynomials differentiate term by term.",
      blocks: [
        {
          kind: "text",
          body: md`In Unit 2 every derivative came from the definition,

$$f'(x) = \lim_{h \to 0} \frac{f(x + h) - f(x)}{h},$$

one function at a time. That was the right way to learn what a derivative *is*. It is a slow way to compute one. This unit builds a toolkit of rules, each one proved from the definition and the limit laws, so that after this unit you will almost never need the limit directly.

Start with what you already found: $\frac{d}{dx} x = 1$ and $\frac{d}{dx} x^2 = 2x$. Here is $x^3$.`,
        },
        {
          kind: "example",
          title: "The derivative of x³ from the definition",
          problem: md`Find $\frac{d}{dx} x^3$.`,
          steps: [
            { math: md`\lim_{h \to 0} \frac{(x + h)^3 - x^3}{h}`, note: "The definition." },
            { math: md`(x + h)^3 = x^3 + 3x^2 h + 3x h^2 + h^3`, note: md`Expand. Every term after $x^3$ carries at least one $h$.` },
            { math: md`\lim_{h \to 0} \frac{3x^2 h + 3x h^2 + h^3}{h} = \lim_{h \to 0} \left(3x^2 + 3xh + h^2\right)`, note: md`The $x^3$ cancels; divide each remaining term by $h$.` },
            { math: md`3x^2`, note: md`As $h \to 0$ the terms still holding an $h$ vanish.` },
          ],
        },
        {
          kind: "text",
          body: md`$x \to 1$, $x^2 \to 2x$, $x^3 \to 3x^2$. The exponent comes down as a factor and drops by one. That pattern is the power rule, and the example shows exactly why it happens: only the term with a single $h$ survives the division and the limit.`,
        },
        {
          kind: "key",
          title: "Power rule",
          body: md`For every real number $n$,

$$\frac{d}{dx} x^{n} = n x^{n - 1}.$$

Below it is proved for positive whole numbers. Negative whole numbers follow from the quotient rule (lesson 2), fractions from implicit differentiation (Unit 4), and every real exponent from logarithms (lesson 5). The rule itself never changes.`,
        },
        {
          kind: "why",
          title: "Why the binomial expansion has the shape it needs",
          body: md`$(x + h)^n$ is $n$ copies of $(x + h)$ multiplied together. Expanding means choosing $x$ or $h$ from each copy and multiplying the choices. Choose $x$ every time: that gives $x^n$. Choose $h$ from exactly one copy and $x$ from the other $n - 1$: there are $n$ ways to pick which copy, so those terms add to $n x^{n - 1} h$. Every other choice takes $h$ at least twice, so every other term contains $h^2$:

$$(x + h)^n = x^n + n x^{n - 1} h + h^2 \cdot (\text{a polynomial in } x \text{ and } h).$$

That is all the proof needs. The $x^n$ cancels, one $h$ divides out, and everything still carrying an $h$ goes to zero.`,
        },
        {
          kind: "proof",
          title: "Power rule for positive whole exponents",
          given: md`$f(x) = x^n$ with $n$ a positive whole number`,
          prove: md`$f'(x) = n x^{n - 1}$`,
          steps: [
            { statement: md`$f'(x) = \lim_{h \to 0} \dfrac{(x + h)^n - x^n}{h}$`, reason: "Definition of the derivative" },
            { statement: md`$(x + h)^n = x^n + n x^{n - 1} h + h^2 R(x, h)$, where $R$ is a polynomial`, reason: md`Binomial expansion: every term after the first two contains $h^2$ (see the why box)` },
            { statement: md`$(x + h)^n - x^n = n x^{n - 1} h + h^2 R(x, h)$`, reason: md`Subtract $x^n$` },
            { statement: md`$\dfrac{(x + h)^n - x^n}{h} = n x^{n - 1} + h\, R(x, h)$`, reason: md`Divide by $h \ne 0$` },
            { statement: md`$\lim_{h \to 0} h\, R(x, h) = 0 \cdot R(x, 0) = 0$`, reason: md`Product law for limits; a polynomial is continuous, so $R(x, h) \to R(x, 0)$` },
            { statement: md`$f'(x) = n x^{n - 1} + 0 = n x^{n - 1}$`, reason: md`Sum law for limits; $n x^{n - 1}$ does not depend on $h$` },
          ],
        },
        {
          kind: "plot",
          x: [-2.5, 2.5],
          y: [-4, 8],
          curves: [
            { expr: "x^n", label: "y = x^{n}" },
            { expr: "n a^(n-1) (x - a) + a^n", label: "\\text{tangent}", color: 2, dashed: true },
          ],
          points: [{ x: "a", y: "a^n", label: "(a, a^{n})", color: 2 }],
          params: [
            { name: "n", tex: "n", min: 1, max: 5, step: 1, value: 2 },
            { name: "a", tex: "a", min: -2, max: 2, step: 0.25, value: 1 },
          ],
          caption: md`Slide $a$ along $y = x^{n}$. The tangent slope is $n a^{n - 1}$, here ${"{=n a^(n-1)}"}. Change $n$ and watch how fast the slopes grow away from the origin.`,
        },
        {
          kind: "text",
          body: md`To handle $4x^5 - 3x^2 + 7$ we need three more facts: what a constant does, what a constant multiplier does, and what happens to a sum. Each is a one-line consequence of a limit law from Unit 1.`,
        },
        {
          kind: "key",
          title: "Constant, constant multiple and sum rules",
          body: md`For a constant $c$ and differentiable $f$, $g$:

- $\dfrac{d}{dx} c = 0$
- $\dfrac{d}{dx}\big(c \cdot f(x)\big) = c \cdot f'(x)$
- $\dfrac{d}{dx}\big(f(x) \pm g(x)\big) = f'(x) \pm g'(x)$

Together with the power rule they say: **differentiate a polynomial term by term**.`,
        },
        {
          kind: "why",
          title: "Why a constant has derivative zero, and a multiplier survives",
          body: md`The graph of $y = c$ is a horizontal line. Its slope is 0 everywhere, and the definition agrees: $\frac{c - c}{h} = 0$ for every $h$, so the limit is 0.

For $c \cdot f(x)$, the difference quotient is $\frac{c f(x + h) - c f(x)}{h} = c \cdot \frac{f(x + h) - f(x)}{h}$. The constant factors out of every quotient, so it factors out of the limit (constant multiple law, Unit 1). Stretching a graph vertically by $c$ stretches all its slopes by $c$.`,
        },
        {
          kind: "proof",
          title: "Sum rule",
          given: md`$f$ and $g$ are differentiable at $x$`,
          prove: md`$(f + g)'(x) = f'(x) + g'(x)$`,
          steps: [
            { statement: md`$(f + g)'(x) = \lim_{h \to 0} \dfrac{[f(x + h) + g(x + h)] - [f(x) + g(x)]}{h}$`, reason: "Definition of the derivative" },
            { statement: md`$= \lim_{h \to 0} \left[\dfrac{f(x + h) - f(x)}{h} + \dfrac{g(x + h) - g(x)}{h}\right]$`, reason: "Regroup the numerator and split the fraction" },
            { statement: md`$= \lim_{h \to 0} \dfrac{f(x + h) - f(x)}{h} + \lim_{h \to 0} \dfrac{g(x + h) - g(x)}{h}$`, reason: "Sum law for limits (Unit 1): both limits exist by hypothesis" },
            { statement: md`$= f'(x) + g'(x)$`, reason: "Definition of the derivative, twice" },
          ],
        },
        {
          kind: "example",
          title: "A polynomial, term by term",
          problem: md`Differentiate $4x^5 - 3x^2 + 7x - 9$.`,
          steps: [
            { math: md`4 \cdot 5x^4 - 3 \cdot 2x + 7 \cdot 1 - 0`, note: "Power rule on each term; constants multiply along; the lone constant vanishes." },
            { math: md`20x^4 - 6x + 7`, note: "" },
          ],
        },
        {
          kind: "text",
          body: md`Roots and reciprocals are powers in disguise: $\sqrt{x} = x^{1/2}$ and $\frac{1}{x^3} = x^{-3}$. The power rule handles them if it really holds for $n = \frac12$ and $n = -3$. Here is a check straight from the definition for $n = -1$.`,
        },
        {
          kind: "example",
          title: "The derivative of 1/x from the definition",
          problem: md`Find $\frac{d}{dx}\frac{1}{x}$ and compare with the power rule.`,
          steps: [
            { math: md`\lim_{h \to 0} \frac{\frac{1}{x + h} - \frac{1}{x}}{h}`, note: "The definition." },
            { math: md`\frac{1}{x + h} - \frac{1}{x} = \frac{x - (x + h)}{x(x + h)} = \frac{-h}{x(x + h)}`, note: "Common denominator." },
            { math: md`\lim_{h \to 0} \frac{-h}{h \cdot x(x + h)} = \lim_{h \to 0} \frac{-1}{x(x + h)}`, note: md`Cancel $h$.` },
            { math: md`-\frac{1}{x^2}`, note: md`The power rule says $\frac{d}{dx} x^{-1} = -1 \cdot x^{-2} = -\frac{1}{x^2}$. They agree.` },
          ],
        },
        {
          kind: "why",
          title: "Why the same check works for square roots",
          body: md`For $\sqrt{x}$ the difference quotient is $\frac{\sqrt{x + h} - \sqrt{x}}{h}$. Multiply top and bottom by $\sqrt{x + h} + \sqrt{x}$ (Unit 1 used this trick for limits):

$$\frac{(x + h) - x}{h\left(\sqrt{x + h} + \sqrt{x}\right)} = \frac{1}{\sqrt{x + h} + \sqrt{x}} \;\to\; \frac{1}{2\sqrt{x}}.$$

And the power rule predicts $\frac{1}{2} x^{-1/2} = \frac{1}{2\sqrt{x}}$. Both special cases match, which is good evidence while the general proofs wait for their turn. From here on, rewrite roots and reciprocals as powers and use the rule.`,
        },
        {
          kind: "example",
          title: "A tangent line",
          problem: md`Find the tangent line to $y = x^3 - 2x$ at $x = 2$.`,
          steps: [
            { math: md`y' = 3x^2 - 2`, note: "Differentiate." },
            { math: md`m = y'(2) = 12 - 2 = 10`, note: md`Substitute into the *derivative* to get the slope. (Substituting into $y$ first would leave a constant, whose derivative is 0.)` },
            { math: md`y(2) = 8 - 4 = 4`, note: md`The point of tangency is $(2, 4)$.` },
            { math: md`y - 4 = 10(x - 2) \;\Rightarrow\; y = 10x - 16`, note: "Point-slope form, then solve for y." },
          ],
        },
        {
          kind: "check",
          prompt: md`Differentiate $5x^4 - 2x^3 + x$.`,
          answer: "20x^3 - 6x^2 + 1",
          explain: md`Term by term: $5 \cdot 4x^3 = 20x^3$, $-2 \cdot 3x^2 = -6x^2$, and the derivative of $x$ is 1.`,
        },
        {
          kind: "check",
          prompt: md`Differentiate $\dfrac{3}{x^2}$. Write the answer without negative exponents.`,
          answer: "-6/x^3",
          positiveExponents: true,
          explain: md`$\frac{3}{x^2} = 3x^{-2}$, so the derivative is $3 \cdot (-2) x^{-3} = -6x^{-3} = -\frac{6}{x^3}$.`,
        },
      ],
      practice: [differentiatePolynomial, rootsAndReciprocals, tangentLines],
    },
    {
      id: slug("Product and quotient rules"),
      title: "Product and quotient rules",
      summary: "Why the derivative of a product is not the product of derivatives, the rectangle picture, both rules proved from the definition, and the power rule extended to negative exponents.",
      blocks: [
        {
          kind: "text",
          body: md`The sum rule is so clean that it is tempting to guess $(fg)' = f'g'$. Test the guess on $f(x) = x$ and $g(x) = x$. Then $fg = x^2$, whose derivative is $2x$. But $f'g' = 1 \cdot 1 = 1$. The guess is wrong, and not by a little.

What went wrong? When $x$ changes, *both* factors change, and each change is scaled by the other factor's current size. A picture makes the right formula almost obvious.`,
        },
        {
          kind: "why",
          title: "Why (fg)' = f'g + fg': the growing rectangle",
          body: md`Picture a rectangle with width $f(x)$ and height $g(x)$, so its area is $f(x) g(x)$. Move $x$ by a small step $h$. The width grows by $\Delta f = f(x + h) - f(x)$ and the height by $\Delta g$. The new area minus the old is three pieces:

$$\Delta(fg) = g\,\Delta f + f\,\Delta g + \Delta f\,\Delta g.$$

Divide by $h$: $\frac{\Delta(fg)}{h} = g \cdot \frac{\Delta f}{h} + f \cdot \frac{\Delta g}{h} + \frac{\Delta f}{h} \cdot \Delta g$. As $h \to 0$, the quotients become $f'$ and $g'$. The last term is $f'$ times $\Delta g$, and $\Delta g \to 0$ because a differentiable function is continuous (Unit 2). The little corner square disappears faster than everything else. Drag the slider to watch it.`,
        },
        {
          kind: "diagram",
          view: [-0.9, 5.3, -0.8, 3.9],
          points: [
            { name: "O", x: 0, y: 0, label: "" },
            { name: "P", x: 3, y: 0, label: "" },
            { name: "Q", x: 3, y: 2, label: "" },
            { name: "R", x: 0, y: 2, label: "" },
            { name: "A", x: "3 + d", y: 0, label: "" },
            { name: "B", x: "3 + d", y: 2, label: "" },
            { name: "C", x: "3 + d", y: "2 + 0.6d", label: "" },
            { name: "D", x: 3, y: "2 + 0.6d", label: "" },
            { name: "E", x: 0, y: "2 + 0.6d", label: "" },
          ],
          polygons: [
            { points: ["O", "P", "Q", "R"], fill: 1 },
            { points: ["P", "A", "B", "Q"], fill: 2 },
            { points: ["R", "Q", "D", "E"], fill: 3 },
            { points: ["Q", "B", "C", "D"], fill: 4 },
          ],
          labels: [
            { x: 1.5, y: -0.35, text: "f" },
            { x: -0.35, y: 1, text: "g" },
            { x: "3 + d/2", y: -0.35, text: "\\Delta f" },
            { x: -0.5, y: "2 + 0.3d", text: "\\Delta g" },
            { x: 1.5, y: 1, text: "f g" },
          ],
          params: [{ name: "d", tex: "h", min: 0.1, max: 1.8, step: 0.1, value: 1.2 }],
          readouts: [
            { label: "g\\,\\Delta f", value: "2d" },
            { label: "f\\,\\Delta g", value: "3 * 0.6d" },
            { label: "\\Delta f\\,\\Delta g", value: "0.6d^2" },
          ],
          caption: md`The old area is the blue rectangle. The two strips are $g\,\Delta f$ and $f\,\Delta g$. The red corner is $\Delta f\,\Delta g$: halve the step and the strips halve, but the corner quarters. In the limit the corner contributes nothing.`,
        },
        {
          kind: "key",
          title: "Product rule",
          body: md`If $f$ and $g$ are differentiable, so is $fg$, and

$$(fg)' = f'g + fg'.$$

In words: the derivative of the first times the second, plus the first times the derivative of the second.`,
        },
        {
          kind: "proof",
          title: "Product rule",
          given: md`$f$ and $g$ are differentiable at $x$`,
          prove: md`$(fg)'(x) = f'(x) g(x) + f(x) g'(x)$`,
          steps: [
            { statement: md`$(fg)'(x) = \lim_{h \to 0} \dfrac{f(x + h) g(x + h) - f(x) g(x)}{h}$`, reason: "Definition of the derivative" },
            { statement: md`$f(x + h) g(x + h) - f(x) g(x) = f(x + h) g(x + h) - f(x) g(x + h) + f(x) g(x + h) - f(x) g(x)$`, reason: md`Add and subtract $f(x) g(x + h)$: the key trick, which lets each factor change on its own` },
            { statement: md`$= \big[f(x + h) - f(x)\big] g(x + h) + f(x) \big[g(x + h) - g(x)\big]$`, reason: "Factor each pair" },
            { statement: md`$\dfrac{f(x + h) g(x + h) - f(x) g(x)}{h} = \dfrac{f(x + h) - f(x)}{h} \cdot g(x + h) + f(x) \cdot \dfrac{g(x + h) - g(x)}{h}$`, reason: md`Divide by $h$` },
            { statement: md`$\lim_{h \to 0} \dfrac{f(x + h) - f(x)}{h} = f'(x)$ and $\lim_{h \to 0} \dfrac{g(x + h) - g(x)}{h} = g'(x)$`, reason: "Definition of the derivative; both exist by hypothesis" },
            { statement: md`$\lim_{h \to 0} g(x + h) = g(x)$`, reason: "Differentiable implies continuous (Unit 2)" },
            { statement: md`$(fg)'(x) = f'(x) g(x) + f(x) g'(x)$`, reason: md`Sum and product laws for limits; $f(x)$ does not depend on $h$` },
          ],
        },
        {
          kind: "example",
          title: "Checking the rule against expansion",
          problem: md`Differentiate $(x^2 + 1)(x^3 - 2x)$ two ways.`,
          steps: [
            { math: md`f' = 2x, \qquad g' = 3x^2 - 2`, note: md`Product rule: with $f = x^2 + 1$ and $g = x^3 - 2x$.` },
            { math: md`(2x)(x^3 - 2x) + (x^2 + 1)(3x^2 - 2)`, note: md`$f'g + fg'$.` },
            { math: md`2x^4 - 4x^2 + 3x^4 - 2x^2 + 3x^2 - 2 = 5x^4 - 3x^2 - 2`, note: "Expand and combine." },
            { math: md`(x^2 + 1)(x^3 - 2x) = x^5 - x^3 - 2x \;\Rightarrow\; 5x^4 - 3x^2 - 2`, note: "Expanding first and using the power rule gives the same answer. For polynomials either way works; the product rule matters when the factors can't be multiplied out, like $x^2 \sin x$ next lesson." },
          ],
        },
        {
          kind: "example",
          title: "A root times a polynomial",
          problem: md`Differentiate $\sqrt{x}\,(x^2 + 3)$.`,
          steps: [
            { math: md`f = x^{1/2}, \; f' = \tfrac{1}{2} x^{-1/2} = \frac{1}{2\sqrt{x}}; \qquad g = x^2 + 3, \; g' = 2x`, note: "Differentiate each factor." },
            { math: md`\frac{x^2 + 3}{2\sqrt{x}} + 2x\sqrt{x}`, note: md`$f'g + fg'$. This is a complete answer.` },
            { math: md`\frac{x^2 + 3 + 4x^2}{2\sqrt{x}} = \frac{5x^2 + 3}{2\sqrt{x}}`, note: md`Optional tidying: $2x\sqrt{x} = \frac{4x^2}{2\sqrt{x}}$ since $\sqrt{x}\cdot\sqrt{x} = x$.` },
          ],
        },
        {
          kind: "text",
          body: md`Quotients come next. Rather than start over, notice that $\frac{f}{g} = f \cdot \frac{1}{g}$. If we know the derivative of a reciprocal, the product rule does the rest.`,
        },
        {
          kind: "why",
          title: "Why (1/g)' = −g'/g²",
          body: md`From the definition, with a common denominator:

$$\frac{\frac{1}{g(x + h)} - \frac{1}{g(x)}}{h} = \frac{g(x) - g(x + h)}{h \cdot g(x + h)\, g(x)} = -\frac{g(x + h) - g(x)}{h} \cdot \frac{1}{g(x + h)\, g(x)}.$$

As $h \to 0$ the first factor becomes $g'(x)$ and, since $g$ is continuous, $g(x + h) \to g(x)$. So the limit is $-\dfrac{g'(x)}{g(x)^2}$. The minus sign makes sense: when $g$ grows, $\frac{1}{g}$ shrinks. With $g = x$ this recovers $\frac{d}{dx}\frac{1}{x} = -\frac{1}{x^2}$ from lesson 1.`,
        },
        {
          kind: "key",
          title: "Quotient rule",
          body: md`If $f$ and $g$ are differentiable and $g(x) \ne 0$,

$$\left(\frac{f}{g}\right)' = \frac{f'g - fg'}{g^2}.$$

The order on top matters: derivative of the top first. A rhyme many people use: *low d-high minus high d-low, over the square of what's below.*`,
        },
        {
          kind: "proof",
          title: "Quotient rule",
          given: md`$f$ and $g$ are differentiable at $x$, and $g(x) \ne 0$`,
          prove: md`$\left(\dfrac{f}{g}\right)'(x) = \dfrac{f'(x) g(x) - f(x) g'(x)}{g(x)^2}$`,
          steps: [
            { statement: md`$\left(\dfrac{1}{g}\right)'(x) = -\dfrac{g'(x)}{g(x)^2}$`, reason: "Reciprocal rule (derived above from the definition)" },
            { statement: md`$\dfrac{f}{g} = f \cdot \dfrac{1}{g}$`, reason: "Dividing is multiplying by the reciprocal" },
            { statement: md`$\left(\dfrac{f}{g}\right)' = f' \cdot \dfrac{1}{g} + f \cdot \left(-\dfrac{g'}{g^2}\right)$`, reason: "Product rule, then step 1" },
            { statement: md`$= \dfrac{f' g}{g^2} - \dfrac{f g'}{g^2}$`, reason: md`Write both terms over $g^2$` },
            { statement: md`$= \dfrac{f' g - f g'}{g^2}$`, reason: "Combine the fractions" },
          ],
        },
        {
          kind: "why",
          title: "Why the power rule now holds for negative whole numbers",
          body: md`Let $n$ be a positive whole number and look at $x^{-n} = \frac{1}{x^n}$. The reciprocal rule with $g = x^n$, $g' = n x^{n - 1}$ (proved in lesson 1) gives

$$\frac{d}{dx} x^{-n} = -\frac{n x^{n - 1}}{(x^n)^2} = -\frac{n x^{n - 1}}{x^{2n}} = -n x^{n - 1 - 2n} = -n x^{-n - 1}.$$

That is exactly $n' x^{n' - 1}$ with $n' = -n$. One promise from lesson 1 is kept; two remain.`,
        },
        {
          kind: "example",
          title: "A quotient",
          problem: md`Differentiate $\dfrac{3x + 1}{x^2 + 2}$.`,
          steps: [
            { math: md`f = 3x + 1, \; f' = 3; \qquad g = x^2 + 2, \; g' = 2x`, note: "Name the pieces." },
            { math: md`\frac{3(x^2 + 2) - (3x + 1)(2x)}{(x^2 + 2)^2}`, note: md`$\frac{f'g - fg'}{g^2}$.` },
            { math: md`\frac{3x^2 + 6 - 6x^2 - 2x}{(x^2 + 2)^2} = \frac{-3x^2 - 2x + 6}{(x^2 + 2)^2}`, note: "Expand and combine the top. Leave the bottom factored." },
          ],
        },
        {
          kind: "text",
          body: md`Before reaching for the quotient rule, look at the denominator. If it is a single term, dividing first is quicker: $\frac{x^3 + 4}{x} = x^2 + 4x^{-1}$, whose derivative is $2x - \frac{4}{x^2}$. Use the quotient rule when the denominator is a genuine sum.`,
        },
        {
          kind: "check",
          prompt: md`Differentiate $(2x + 1)(x^2 - 3)$.`,
          answer: "6x^2 + 2x - 6",
          explain: md`$f'g + fg' = 2(x^2 - 3) + (2x + 1)(2x) = 2x^2 - 6 + 4x^2 + 2x = 6x^2 + 2x - 6$.`,
        },
        {
          kind: "check",
          prompt: md`Differentiate $\dfrac{x}{x + 1}$. Type a squared sum like (x + 1)^2.`,
          answer: "1/(x + 1)^2",
          explain: md`$\frac{(1)(x + 1) - x(1)}{(x + 1)^2} = \frac{1}{(x + 1)^2}$.`,
        },
      ],
      practice: [productRule, quotientRule, productQuotientAtPoint],
    },
    {
      id: slug("Derivatives of trig functions"),
      title: "Derivatives of trig functions",
      summary: "The derivative of sine is cosine, proved from the two limits of Unit 1 and the angle-addition formula; then cosine, tangent and the rest from the quotient rule.",
      blocks: [
        {
          kind: "text",
          body: md`Look at the graph of $y = \sin x$ and read off its slopes. At $x = 0$ the curve rises at a 45° angle: slope 1. At the top, $x = \frac{\pi}{2}$, it is flat: slope 0. At $x = \pi$ it falls at 45°: slope $-1$. Those are the values of $\cos x$ at the same points. Slide the point and compare the tangent slope with the dashed curve.`,
        },
        {
          kind: "plot",
          x: [-6.5, 6.5],
          y: [-2.2, 2.2],
          curves: [
            { expr: "sin(x)", label: "y = \\sin x" },
            { expr: "cos(x)", label: "y = \\cos x", color: 2, dashed: true },
            { expr: "cos(a)(x - a) + sin(a)", label: "\\text{tangent}", color: 3 },
          ],
          points: [
            { x: "a", y: "sin(a)", label: "", color: 1 },
            { x: "a", y: "cos(a)", label: "\\text{slope}", color: 2 },
          ],
          params: [{ name: "a", tex: "a", min: -6, max: 6, step: 0.25, value: 1 }],
          caption: md`At $x = a$ the tangent to $\sin x$ has slope ${"{=cos(a)}"}, and that is the height of the orange point on $y = \cos x$. The derivative of sine *is* cosine, everywhere.`,
        },
        {
          kind: "text",
          body: md`A picture is a conjecture, not a proof. The proof needs two limits. The first was proved in Unit 1 from areas in the unit circle. The second follows from it.`,
        },
        {
          kind: "key",
          title: "Two limits",
          body: md`$$\lim_{h \to 0} \frac{\sin h}{h} = 1 \qquad\text{and}\qquad \lim_{h \to 0} \frac{\cos h - 1}{h} = 0.$$

Both require $h$ in **radians**.`,
        },
        {
          kind: "why",
          title: "Why (cos h − 1)/h → 0",
          body: md`Multiply top and bottom by $\cos h + 1$ and use $\cos^2 h - 1 = -\sin^2 h$:

$$\frac{\cos h - 1}{h} = \frac{\cos^2 h - 1}{h(\cos h + 1)} = -\frac{\sin h}{h} \cdot \frac{\sin h}{\cos h + 1}.$$

As $h \to 0$, the first factor tends to 1 and the second to $\frac{0}{2} = 0$. So the product tends to 0. Geometrically: near $0$, $\cos h \approx 1 - \frac{h^2}{2}$, so $\cos h - 1$ shrinks like $h^2$, much faster than $h$.`,
        },
        {
          kind: "proof",
          title: "The derivative of sine",
          given: md`$\lim_{h \to 0} \frac{\sin h}{h} = 1$ and $\lim_{h \to 0} \frac{\cos h - 1}{h} = 0$`,
          prove: md`$\dfrac{d}{dx} \sin x = \cos x$`,
          steps: [
            { statement: md`$\dfrac{d}{dx}\sin x = \lim_{h \to 0} \dfrac{\sin(x + h) - \sin x}{h}$`, reason: "Definition of the derivative" },
            { statement: md`$\sin(x + h) = \sin x \cos h + \cos x \sin h$`, reason: "Angle-addition formula for sine" },
            { statement: md`$\sin(x + h) - \sin x = \sin x\,(\cos h - 1) + \cos x \sin h$`, reason: md`Substitute step 2 and group the two $\sin x$ terms` },
            { statement: md`$\dfrac{\sin(x + h) - \sin x}{h} = \sin x \cdot \dfrac{\cos h - 1}{h} + \cos x \cdot \dfrac{\sin h}{h}$`, reason: md`Divide each term by $h$` },
            { statement: md`$\lim_{h \to 0} = \sin x \cdot 0 + \cos x \cdot 1$`, reason: md`Limit laws; $\sin x$ and $\cos x$ don't depend on $h$; the two given limits` },
            { statement: md`$\dfrac{d}{dx}\sin x = \cos x$`, reason: "Simplify" },
          ],
        },
        {
          kind: "why",
          title: "Why the derivative of cosine is −sin x",
          body: md`Same plan, with $\cos(x + h) = \cos x \cos h - \sin x \sin h$:

$$\frac{\cos(x + h) - \cos x}{h} = \cos x \cdot \frac{\cos h - 1}{h} - \sin x \cdot \frac{\sin h}{h} \;\to\; \cos x \cdot 0 - \sin x \cdot 1 = -\sin x.$$

The minus sign is real: just after $x = 0$, cosine is heading *down* from its peak of 1, so its slope must be negative, and $-\sin x$ is negative there.`,
        },
        {
          kind: "key",
          title: "The six trig derivatives",
          body: md`$$\begin{aligned}
\frac{d}{dx}\sin x &= \cos x & \frac{d}{dx}\cos x &= -\sin x \\
\frac{d}{dx}\tan x &= \sec^2 x & \frac{d}{dx}\cot x &= -\csc^2 x \\
\frac{d}{dx}\sec x &= \sec x \tan x & \frac{d}{dx}\csc x &= -\csc x \cot x
\end{aligned}$$

Every **co**-function (cosine, cotangent, cosecant) carries a minus sign. When typing answers, write $\sec^2 x$ as **(sec(x))^2**.`,
        },
        {
          kind: "why",
          title: "Why calculus insists on radians",
          body: md`The whole derivation rests on $\frac{\sin h}{h} \to 1$. That limit is true only when $h$ is measured in radians, because it comes from comparing an arc of length $h$ with the chord beneath it. In degrees, $\frac{\sin h^\circ}{h} \to \frac{\pi}{180}$, and every derivative formula would carry a factor of $\frac{\pi}{180}$. Radians are the unit that makes the derivative of sine exactly cosine, with nothing extra.`,
        },
        {
          kind: "proof",
          title: "The derivative of tangent",
          given: md`$\tan x = \dfrac{\sin x}{\cos x}$, with $\cos x \ne 0$`,
          prove: md`$\dfrac{d}{dx}\tan x = \sec^2 x$`,
          steps: [
            { statement: md`$\dfrac{d}{dx}\tan x = \dfrac{(\cos x)(\cos x) - (\sin x)(-\sin x)}{\cos^2 x}$`, reason: md`Quotient rule with $f = \sin x$, $g = \cos x$` },
            { statement: md`$= \dfrac{\cos^2 x + \sin^2 x}{\cos^2 x}$`, reason: "Simplify the numerator" },
            { statement: md`$= \dfrac{1}{\cos^2 x}$`, reason: md`Pythagorean identity $\sin^2 x + \cos^2 x = 1$` },
            { statement: md`$= \sec^2 x$`, reason: md`Definition $\sec x = \frac{1}{\cos x}$` },
          ],
        },
        {
          kind: "why",
          title: "Why sec x gives sec x tan x, and where the other two come from",
          body: md`$\sec x = \frac{1}{\cos x}$, so the reciprocal rule gives

$$\frac{d}{dx}\sec x = -\frac{(\cos x)'}{\cos^2 x} = \frac{\sin x}{\cos^2 x} = \frac{1}{\cos x} \cdot \frac{\sin x}{\cos x} = \sec x \tan x.$$

For $\csc x = \frac{1}{\sin x}$ the same rule gives $-\frac{\cos x}{\sin^2 x} = -\csc x \cot x$. For $\cot x = \frac{\cos x}{\sin x}$ the quotient rule gives $\frac{-\sin^2 x - \cos^2 x}{\sin^2 x} = -\csc^2 x$. None of these need memorizing from scratch: each is one line from the two basic derivatives.`,
        },
        {
          kind: "example",
          title: "Product rule with a trig factor",
          problem: md`Differentiate $x^2 \sin x$.`,
          steps: [
            { math: md`(2x)(\sin x) + (x^2)(\cos x)`, note: md`$f'g + fg'$ with $f = x^2$, $g = \sin x$. The factors can't be multiplied out, so the product rule is essential here.` },
            { math: md`2x \sin x + x^2 \cos x`, note: "" },
          ],
        },
        {
          kind: "example",
          title: "A quotient that simplifies",
          problem: md`Differentiate $\dfrac{\sin x}{1 + \cos x}$.`,
          steps: [
            { math: md`\frac{\cos x\,(1 + \cos x) - \sin x\,(-\sin x)}{(1 + \cos x)^2}`, note: md`$\frac{f'g - fg'}{g^2}$.` },
            { math: md`\frac{\cos x + \cos^2 x + \sin^2 x}{(1 + \cos x)^2} = \frac{\cos x + 1}{(1 + \cos x)^2}`, note: md`$\cos^2 x + \sin^2 x = 1$.` },
            { math: md`\frac{1}{1 + \cos x}`, note: md`Cancel one factor of $1 + \cos x$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Differentiate $4\sin x - \cos x$. Type sin(x) and cos(x).`,
          answer: "4cos(x) + sin(x)",
          explain: md`$4\cos x - (-\sin x) = 4\cos x + \sin x$.`,
        },
        {
          kind: "check",
          prompt: md`What is the slope of $y = \tan x$ at $x = \frac{\pi}{4}$? Give an exact number.`,
          answer: "2",
          explain: md`$y' = \sec^2 x$, and $\cos\frac{\pi}{4} = \frac{\sqrt2}{2}$, so $\sec^2\frac{\pi}{4} = \frac{1}{1/2} = 2$.`,
        },
      ],
      practice: [trigBasic, trigProductQuotient, trigAtPoint],
    },
    {
      id: slug("The chain rule"),
      title: "The chain rule",
      summary: "Derivatives of compositions: why rates multiply, the rule in both notations, a proof sketch and its one subtle gap, and the general power rule.",
      blocks: [
        {
          kind: "text",
          body: md`How would you differentiate $(x^2 + 1)^3$? Expanding to $x^6 + 3x^4 + 3x^2 + 1$ works, and gives $6x^5 + 12x^3 + 6x$. For $(x^2 + 1)^{50}$ expanding is hopeless, and for $\sin(x^2)$ there is nothing to expand. These are **compositions**: an inside function $u = x^2 + 1$ fed into an outside function $u^3$. We need a rule for how the derivative of a composition comes from the derivatives of its parts.`,
        },
        {
          kind: "why",
          title: "Why rates multiply",
          body: md`Suppose $y$ depends on $u$ and $u$ depends on $x$. If $y$ changes 3 times as fast as $u$, and $u$ changes 2 times as fast as $x$, then $y$ changes $3 \cdot 2 = 6$ times as fast as $x$. Nudging $x$ by a little $\Delta x$ moves $u$ by about $2\,\Delta x$, which moves $y$ by about $3 \cdot 2\,\Delta x$.

Units make the same point. Speed in miles per hour times feet per mile gives feet per hour:

$$\frac{dy}{dx} = \frac{dy}{du} \cdot \frac{du}{dx}.$$

The $du$'s look as if they cancel. They don't literally (these are limits, not fractions), but the notation is designed so the formula is impossible to forget.`,
        },
        {
          kind: "key",
          title: "Chain rule",
          body: md`If $g$ is differentiable at $x$ and $f$ is differentiable at $g(x)$, then $f(g(x))$ is differentiable at $x$ and

$$\frac{d}{dx} f(g(x)) = f'(g(x)) \cdot g'(x), \qquad\text{or}\qquad \frac{dy}{dx} = \frac{dy}{du} \cdot \frac{du}{dx} \text{ with } y = f(u),\; u = g(x).$$

In words: **differentiate the outside, leaving the inside alone, then multiply by the derivative of the inside.**`,
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-3.5, 3.5],
          curves: [
            { expr: "sin(k x)", label: "y = \\sin(kx)" },
            { expr: "k cos(k x)", label: "y' = k\\cos(kx)", color: 2, dashed: true },
          ],
          params: [{ name: "k", tex: "k", min: 0.5, max: 3, step: 0.5, value: 2 }],
          caption: md`Compressing $\sin x$ horizontally by $k$ makes every slope $k$ times steeper: the inside $u = kx$ runs $k$ times as fast as $x$. The derivative $k\cos(kx)$ has amplitude ${"{k}"}, not 1.`,
        },
        {
          kind: "proof",
          title: "Chain rule (proof sketch)",
          given: md`$u = g(x)$ is differentiable at $x$, $y = f(u)$ is differentiable at $u$, and $\Delta u \ne 0$ whenever $\Delta x \ne 0$ is small`,
          prove: md`$\dfrac{dy}{dx} = f'(g(x))\, g'(x)$`,
          steps: [
            { statement: md`$\Delta u = g(x + \Delta x) - g(x)$ and $\Delta y = f(u + \Delta u) - f(u)$`, reason: md`The change in $u$ caused by $\Delta x$, and the change in $y$ caused by that $\Delta u$` },
            { statement: md`$\dfrac{\Delta y}{\Delta x} = \dfrac{\Delta y}{\Delta u} \cdot \dfrac{\Delta u}{\Delta x}$`, reason: md`Multiply and divide by $\Delta u \ne 0$` },
            { statement: md`As $\Delta x \to 0$, $\Delta u \to 0$`, reason: md`$g$ is differentiable, hence continuous (Unit 2)` },
            { statement: md`$\lim_{\Delta x \to 0} \dfrac{\Delta u}{\Delta x} = g'(x)$`, reason: "Definition of the derivative" },
            { statement: md`$\lim_{\Delta x \to 0} \dfrac{\Delta y}{\Delta u} = \lim_{\Delta u \to 0} \dfrac{f(u + \Delta u) - f(u)}{\Delta u} = f'(u)$`, reason: md`Step 3 lets us replace $\Delta x \to 0$ by $\Delta u \to 0$; definition of $f'(u)$` },
            { statement: md`$\dfrac{dy}{dx} = f'(u)\, g'(x) = f'(g(x))\, g'(x)$`, reason: "Product law for limits" },
          ],
        },
        {
          kind: "why",
          title: "Why this is only a sketch, and how the gap is closed",
          body: md`Step 2 divides by $\Delta u$, which may be 0 for some small $\Delta x$ (for instance if $g$ is constant near $x$). The fix is to define a helper $E(\Delta u) = \frac{\Delta y}{\Delta u} - f'(u)$ when $\Delta u \ne 0$ and $E(0) = 0$. Then $\Delta y = \big(f'(u) + E(\Delta u)\big)\Delta u$ holds in *every* case, with no division, and $E \to 0$ as $\Delta u \to 0$ because $f$ is differentiable. Dividing by $\Delta x$ and taking the limit gives $f'(u) g'(x)$ exactly as before. The idea of the proof is the sketch; the helper just handles the bookkeeping.`,
        },
        {
          kind: "example",
          title: "A power of a polynomial",
          problem: md`Differentiate $(3x^2 + 1)^5$.`,
          steps: [
            { math: md`u = 3x^2 + 1, \qquad y = u^5`, note: "Name the inside and the outside." },
            { math: md`\frac{dy}{du} = 5u^4, \qquad \frac{du}{dx} = 6x`, note: "Differentiate each layer." },
            { math: md`\frac{dy}{dx} = 5u^4 \cdot 6x = 30x(3x^2 + 1)^4`, note: md`Multiply, then put $u$ back in terms of $x$.` },
          ],
        },
        {
          kind: "key",
          title: "General power rule",
          body: md`For any differentiable $u$ and any real $n$,

$$\frac{d}{dx} u^{n} = n u^{n - 1} \cdot \frac{du}{dx}.$$

This is the chain rule with the power rule as the outside function. It covers $\sqrt{u} = u^{1/2}$ and $\frac{1}{u} = u^{-1}$ too.`,
        },
        {
          kind: "example",
          title: "A square root",
          problem: md`Differentiate $\sqrt{x^2 + 9}$.`,
          steps: [
            { math: md`(x^2 + 9)^{1/2}`, note: "A root is a power." },
            { math: md`\tfrac{1}{2}(x^2 + 9)^{-1/2} \cdot 2x`, note: md`General power rule: $n = \frac12$, then times the inside derivative $2x$.` },
            { math: md`\frac{x}{\sqrt{x^2 + 9}}`, note: md`The 2's cancel. Check at $x = 4$: $\sqrt{25} = 5$ and the slope is $\frac{4}{5}$, which looks right for a curve that is nearly the line $y = x$ for large $x$.` },
          ],
        },
        {
          kind: "example",
          title: "Two that look alike",
          problem: md`Differentiate $\sin(x^2)$ and $\sin^2 x$.`,
          steps: [
            { math: md`\frac{d}{dx}\sin(x^2) = \cos(x^2) \cdot 2x = 2x\cos(x^2)`, note: md`Outside $\sin u$, inside $u = x^2$.` },
            { math: md`\frac{d}{dx}(\sin x)^2 = 2\sin x \cdot \cos x`, note: md`Outside $u^2$, inside $u = \sin x$. The outside and inside have swapped roles, and so have the answers.` },
          ],
        },
        {
          kind: "why",
          title: "Why several layers just mean several factors",
          body: md`For $\cos\!\left(\sqrt{x^2 + 1}\right)$ there are three layers: $x^2 + 1$, then $\sqrt{\;}$, then $\cos$. Apply the chain rule twice, from the outside in, leaving the inside alone each time:

$$-\sin\!\left(\sqrt{x^2 + 1}\right) \cdot \frac{1}{2\sqrt{x^2 + 1}} \cdot 2x = -\frac{x \sin\!\left(\sqrt{x^2 + 1}\right)}{\sqrt{x^2 + 1}}.$$

Each layer contributes one factor, because $\frac{dy}{dx} = \frac{dy}{dv} \cdot \frac{dv}{du} \cdot \frac{du}{dx}$. Peel the onion one layer at a time and you can't lose track.`,
        },
        {
          kind: "example",
          title: "Chain rule inside a product",
          problem: md`Differentiate $x^2 \cos(5x)$.`,
          steps: [
            { math: md`(2x)\cos(5x) + x^2 \cdot \frac{d}{dx}\cos(5x)`, note: "Product rule first: the function is a product." },
            { math: md`\frac{d}{dx}\cos(5x) = -\sin(5x) \cdot 5`, note: md`Chain rule on the second factor: inside $5x$.` },
            { math: md`2x\cos(5x) - 5x^2 \sin(5x)`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`Differentiate $(2x + 5)^4$. Leave it as a power of $2x + 5$, like (2x + 5)^3.`,
          answer: "8(2x + 5)^3",
          explain: md`$4(2x + 5)^3 \cdot 2 = 8(2x + 5)^3$.`,
        },
        {
          kind: "check",
          prompt: md`Differentiate $\cos(x^3)$. Type sin(...) and cos(...).`,
          answer: "-3x^2 sin(x^3)",
          explain: md`Outside $\cos u \to -\sin u$, inside $x^3 \to 3x^2$: $-\sin(x^3) \cdot 3x^2$.`,
        },
      ],
      practice: [chainPower, chainTrig, chainMixed],
    },
    {
      id: slug("Exponential and logarithmic derivatives"),
      title: "Exponential and logarithmic derivatives",
      summary: "e defined as the base whose slope at 0 is 1, linked to (1 + 1/n)^n; the derivatives of e^x, ln x, b^x and log_b x; the power rule for every real exponent; logarithmic differentiation.",
      blocks: [
        {
          kind: "text",
          body: md`Take any base $b > 0$ and try the definition on $b^x$:

$$\frac{b^{x + h} - b^x}{h} = \frac{b^x b^h - b^x}{h} = b^x \cdot \frac{b^h - 1}{h}.$$

The factor $b^x$ came out untouched. What remains, $\frac{b^h - 1}{h}$, has no $x$ in it at all. Its limit as $h \to 0$ is the slope of $y = b^x$ at $x = 0$, a single number that depends only on $b$. Call it $L_b$. Then

$$\frac{d}{dx} b^x = L_b \cdot b^x.$$`,
        },
        {
          kind: "why",
          title: "Why one slope controls the whole curve",
          body: md`The exponent law $b^{x + h} = b^x b^h$ (Algebra 1) says that moving right by $h$ *multiplies* an exponential by the fixed factor $b^h$. So the curve near any point is a vertically scaled copy of the curve near $0$, scaled by $b^x$. Scaling a graph by $b^x$ scales its slopes by $b^x$. That is why the derivative of an exponential is proportional to the function itself: the rate of growth is a fixed fraction of the current size.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-1, 8],
          curves: [
            { expr: "b^x", label: "y = b^{x}" },
            { expr: "1 + ln(b) x", label: "\\text{tangent at } 0", color: 2, dashed: true },
          ],
          points: [{ x: 0, y: 1, label: "(0, 1)", color: 2 }],
          params: [{ name: "b", tex: "b", min: 1.2, max: 4, step: 0.05, value: 2 }],
          caption: md`With $b = {"{b}"}$ the slope at $0$ is $L_b \approx {"{=ln(b)}"}$. For $b = 2$ it is a bit under 1; for $b = 3$ a bit over. Somewhere between 2.7 and 2.75 the slope is exactly 1.`,
        },
        {
          kind: "key",
          title: "The number e",
          body: md`$e$ is the base whose exponential has slope exactly 1 at $x = 0$:

$$\lim_{h \to 0} \frac{e^h - 1}{h} = 1, \qquad e \approx 2.71828.$$

Consequently $e^x$ is its own derivative:

$$\frac{d}{dx} e^{x} = e^{x}.$$`,
        },
        {
          kind: "why",
          title: "Why this e is the same as the limit of (1 + 1/n)^n",
          body: md`Algebra 2 met $e$ as the limit of $\left(1 + \frac{1}{n}\right)^n$ from compound interest. The two descriptions agree. Slope 1 at $0$ means $\frac{e^h - 1}{h} \approx 1$ for small $h$, so $e^h \approx 1 + h$, so $e \approx (1 + h)^{1/h}$, and the approximation sharpens as $h \to 0$. Put $h = \frac{1}{n}$:

$$e = \lim_{n \to \infty} \left(1 + \tfrac{1}{n}\right)^{n}.$$

Compounding more and more often is the same thing as asking for an exponential whose growth rate equals its size.`,
        },
        {
          kind: "proof",
          title: "The derivative of eˣ",
          given: md`$\lim_{h \to 0} \dfrac{e^h - 1}{h} = 1$ (the definition of $e$)`,
          prove: md`$\dfrac{d}{dx} e^{x} = e^{x}$`,
          steps: [
            { statement: md`$\dfrac{d}{dx} e^x = \lim_{h \to 0} \dfrac{e^{x + h} - e^x}{h}$`, reason: "Definition of the derivative" },
            { statement: md`$e^{x + h} = e^x e^h$`, reason: "Product law for exponents" },
            { statement: md`$\dfrac{e^x e^h - e^x}{h} = e^x \cdot \dfrac{e^h - 1}{h}$`, reason: md`Factor out $e^x$` },
            { statement: md`$\lim_{h \to 0} e^x \cdot \dfrac{e^h - 1}{h} = e^x \cdot 1$`, reason: md`Constant multiple law: $e^x$ does not depend on $h$; the given limit` },
            { statement: md`$\dfrac{d}{dx} e^{x} = e^{x}$`, reason: "Simplify" },
          ],
        },
        {
          kind: "example",
          title: "Chain and product rules with eˣ",
          problem: md`Differentiate $e^{3x}$ and $x e^{x}$.`,
          steps: [
            { math: md`\frac{d}{dx} e^{3x} = e^{3x} \cdot 3 = 3e^{3x}`, note: md`Chain rule: outside $e^u$ (derivative $e^u$), inside $u = 3x$.` },
            { math: md`\frac{d}{dx}\left(x e^{x}\right) = 1 \cdot e^x + x \cdot e^x = (x + 1)e^{x}`, note: "Product rule." },
          ],
        },
        {
          kind: "text",
          body: md`The natural logarithm $\ln x$ is the inverse of $e^x$: for $x > 0$, $\ln x$ is the exponent that $e$ needs to produce $x$, so $e^{\ln x} = x$. That one identity, differentiated with the chain rule, gives the derivative of $\ln$.`,
        },
        {
          kind: "proof",
          title: "The derivative of ln x",
          given: md`$x > 0$ and $e^{\ln x} = x$`,
          prove: md`$\dfrac{d}{dx} \ln x = \dfrac{1}{x}$`,
          steps: [
            { statement: md`$e^{\ln x} = x$`, reason: md`$\ln$ is the inverse of $e^x$` },
            { statement: md`$\dfrac{d}{dx} e^{\ln x} = \dfrac{d}{dx} x = 1$`, reason: "Equal functions have equal derivatives" },
            { statement: md`$\dfrac{d}{dx} e^{\ln x} = e^{\ln x} \cdot \dfrac{d}{dx}\ln x$`, reason: md`Chain rule with outside $e^u$, inside $u = \ln x$` },
            { statement: md`$x \cdot \dfrac{d}{dx}\ln x = 1$`, reason: md`Step 1 replaces $e^{\ln x}$ by $x$; steps 2 and 3 are equal` },
            { statement: md`$\dfrac{d}{dx}\ln x = \dfrac{1}{x}$`, reason: md`Divide by $x \ne 0$` },
          ],
        },
        {
          kind: "why",
          title: "Why 1/x is the right shape",
          body: md`The graph of $\ln x$ is the graph of $e^x$ reflected across the line $y = x$. Reflecting swaps rise and run, so it turns a slope into its reciprocal. At the point $(a, e^a)$ the slope of $e^x$ is $e^a$; at the mirror point $(e^a, a)$ the slope of $\ln$ is $\frac{1}{e^a}$, which is $\frac{1}{x}$ with $x = e^a$.

It also matches the behavior: $\ln x$ climbs steeply near $0$ (where $\frac1x$ is huge) and ever more slowly for large $x$ (where $\frac1x$ is tiny), but its slope never reaches zero, so $\ln x$ keeps growing without bound.`,
        },
        {
          kind: "key",
          title: "General bases",
          body: md`For $b > 0$, $b \ne 1$:

$$\frac{d}{dx} b^{x} = b^{x} \ln b, \qquad \frac{d}{dx} \log_b x = \frac{1}{x \ln b}.$$

So the slope factor from the start of the lesson is $L_b = \ln b$, and $e$ is special because $\ln e = 1$. In particular $\frac{d}{dx} 2^x = 2^x \ln 2 \approx 0.693 \cdot 2^x$.`,
        },
        {
          kind: "why",
          title: "Why ln b appears",
          body: md`Since $b = e^{\ln b}$, we have $b^x = \left(e^{\ln b}\right)^x = e^{x \ln b}$. Now the chain rule with inside $u = x \ln b$, whose derivative is the constant $\ln b$:

$$\frac{d}{dx} e^{x \ln b} = e^{x \ln b} \cdot \ln b = b^{x} \ln b.$$

For the log, change of base gives $\log_b x = \frac{\ln x}{\ln b}$, a constant times $\ln x$, so its derivative is $\frac{1}{\ln b} \cdot \frac{1}{x}$. Every exponential and every logarithm is the natural one in disguise, stretched by a constant.`,
        },
        {
          kind: "proof",
          title: "The power rule for every real exponent",
          given: md`$x > 0$ and $n$ is any real number`,
          prove: md`$\dfrac{d}{dx} x^{n} = n x^{n - 1}$`,
          steps: [
            { statement: md`$x^n = \left(e^{\ln x}\right)^n = e^{n \ln x}$`, reason: md`$x = e^{\ln x}$, and $(e^a)^b = e^{ab}$` },
            { statement: md`$\dfrac{d}{dx} e^{n \ln x} = e^{n \ln x} \cdot \dfrac{d}{dx}(n \ln x)$`, reason: "Chain rule" },
            { statement: md`$= e^{n \ln x} \cdot \dfrac{n}{x}$`, reason: md`Constant multiple rule and $\frac{d}{dx}\ln x = \frac1x$` },
            { statement: md`$= x^n \cdot \dfrac{n}{x} = n x^{n - 1}$`, reason: md`Step 1 in reverse, then $\frac{x^n}{x} = x^{n - 1}$` },
          ],
        },
        {
          kind: "text",
          body: md`That closes the last promise from lesson 1: the power rule holds for $x^{\pi}$ and $x^{\sqrt2}$ as surely as for $x^3$. (For $x < 0$ with a whole-number exponent the earlier proofs already apply.)

The same trick, taking logs before differentiating, is a method in its own right.`,
        },
        {
          kind: "key",
          title: "Logarithmic differentiation",
          body: md`To differentiate $y = (\text{a tangle of products, quotients and powers})$:

1. Take $\ln$ of both sides and use the log properties to break it into a sum.
2. Differentiate both sides. The left side becomes $\dfrac{y'}{y}$ (chain rule).
3. Multiply by $y$.

It is the only way through functions like $x^x$, where both the base and the exponent vary.`,
        },
        {
          kind: "example",
          title: "x to the x",
          problem: md`Differentiate $y = x^{x}$ for $x > 0$.`,
          steps: [
            { math: md`\ln y = \ln(x^x) = x \ln x`, note: md`Power property of logs. Neither the power rule nor the $b^x$ rule applies to $x^x$ directly: the exponent isn't constant, and neither is the base.` },
            { math: md`\frac{y'}{y} = 1 \cdot \ln x + x \cdot \frac{1}{x} = \ln x + 1`, note: md`Differentiate both sides. Left: chain rule, $\frac{d}{dx}\ln y = \frac{1}{y} y'$. Right: product rule.` },
            { math: md`y' = x^{x}(\ln x + 1)`, note: md`Multiply by $y = x^x$.` },
          ],
        },
        {
          kind: "example",
          title: "A product that logs make easy",
          problem: md`Differentiate $y = x^3 e^{2x}$ by logarithmic differentiation.`,
          steps: [
            { math: md`\ln y = 3\ln x + 2x`, note: md`$\ln(ab) = \ln a + \ln b$, then the exponents come down.` },
            { math: md`\frac{y'}{y} = \frac{3}{x} + 2`, note: "Differentiate both sides." },
            { math: md`y' = x^3 e^{2x}\left(\frac{3}{x} + 2\right) = 3x^2 e^{2x} + 2x^3 e^{2x}`, note: "Multiply by y. The product rule gives the same two terms." },
          ],
        },
        {
          kind: "check",
          prompt: md`Differentiate $e^{5x}$. Type e^(5x).`,
          answer: "5e^(5x)",
          explain: md`Chain rule: $e^{5x} \cdot 5$.`,
        },
        {
          kind: "check",
          prompt: md`Differentiate $\ln(3x + 1)$.`,
          answer: "3/(3x + 1)",
          explain: md`$\frac{u'}{u}$ with $u = 3x + 1$ and $u' = 3$.`,
        },
      ],
      practice: [expDerivatives, logDerivatives, logarithmicDifferentiation],
    },
  ],
};
