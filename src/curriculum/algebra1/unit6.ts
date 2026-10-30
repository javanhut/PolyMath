import { frac, fracTex, paren, poly, signed, type Rng } from "../../math/random";
import { md, type Generator, type Step, type Unit } from "../types";

// ── Formatting helpers ──────────────────────────────────────────────────────

/** v^n as LaTeX: "" for n = 0, "v" for n = 1, and no braces for one-digit powers so fractions stay readable to the validator. */
const texPow = (v: string, n: number) => (n === 0 ? "" : n === 1 ? v : n > 1 && n < 10 ? `${v}^${n}` : `${v}^{${n}}`);
/** v^n as answer text. */
const txtPow = (v: string, n: number) => (n === 0 ? "" : n === 1 ? v : `${v}^${n}`);

type Factors = [string, number][];

/** A monomial such as -3x^2y in LaTeX; coefficients of 1 and -1 are hidden. */
function monoTex(c: number, f: Factors): string {
  const vars = f.map(([v, n]) => texPow(v, n)).join("");
  if (!vars) return String(c);
  return (c === 1 ? "" : c === -1 ? "-" : String(c)) + vars;
}

function monoTxt(c: number, f: Factors): string {
  const vars = f.map(([v, n]) => txtPow(v, n)).join("");
  if (!vars) return String(c);
  return (c === 1 ? "" : c === -1 ? "-" : String(c)) + vars;
}

/** A monomial with an integer coefficient, written with positive exponents only (negative powers go below the bar). */
function positive(c: number, f: Factors): { tex: string; txt: string } {
  const top = f.filter(([, n]) => n > 0);
  const bottom: Factors = f.filter(([, n]) => n < 0).map(([v, n]) => [v, -n]);
  if (!bottom.length) return { tex: monoTex(c, top), txt: monoTxt(c, top) };
  const sign = c < 0 ? "-" : "";
  const den = monoTex(1, bottom);
  return {
    tex: md`${sign}\frac{${monoTex(Math.abs(c), top)}}{${den}}`,
    txt: `${sign}${monoTxt(Math.abs(c), top)}/${bottom.length > 1 ? `(${monoTxt(1, bottom)})` : monoTxt(1, bottom)}`,
  };
}

/** A polynomial from its coefficients, lowest degree first: [5, 0, 3] is 3x^2 + 5. Same text works as LaTeX and as an answer. */
const polyOf = (cs: number[], v = "x") => poly(cs.map((c, k) => [c, texPow(v, k)] as [number, string]).reverse());

/** The terms of a polynomial (lowest degree first) as [coefficient, power] pairs, highest power first. */
const termsOf = (cs: number[], v = "x"): [number, string][] => cs.map((c, k) => [c, texPow(v, k)] as [number, string]).reverse();

function addPolys(...ps: number[][]): number[] {
  const out: number[] = [];
  for (const p of ps) p.forEach((c, k) => (out[k] = (out[k] ?? 0) + c));
  return Array.from(out, (c) => c ?? 0);
}

function mulPolys(p: number[], q: number[]): number[] {
  const out = new Array(p.length + q.length - 1).fill(0);
  p.forEach((a, i) => q.forEach((b, j) => (out[i + j] += a * b)));
  return out;
}

const scale = (p: number[], k: number) => p.map((c) => c * k);

/** "(3x^2 + x^2) + (-5x + 4x) + (2 - 7)": like terms of several (already signed) polynomials grouped by power. */
function groupLike(ps: number[][], v = "x"): string {
  const top = Math.max(...ps.map((p) => p.length)) - 1;
  const groups: string[] = [];
  for (let k = top; k >= 0; k--) {
    const terms = ps.map((p) => p[k] ?? 0).filter((c) => c !== 0);
    if (!terms.length) continue;
    const body = poly(terms.map((c) => [c, texPow(v, k)]));
    groups.push(terms.length > 1 ? `(${body})` : body);
  }
  return groups.reduce((acc, g) => (!acc ? g : g.startsWith("-") ? `${acc} - ${g.slice(1)}` : `${acc} + ${g}`), "");
}

/** A random polynomial of the given degree, lowest degree first, every coefficient nonzero. */
function randPoly(r: Rng, deg: number, big = 9): number[] {
  const cs = Array.from({ length: deg }, () => r.nonzero(-big, big));
  cs.push(r.nonzero(-6, 7));
  return cs;
}

// Scientific notation. A number is held exactly as an integer M times 10^E.

function stripZeros(M: number, E: number): [string, number] {
  let m = Math.abs(M);
  while (m !== 0 && m % 10 === 0) {
    m /= 10;
    E++;
  }
  return [String(m), E];
}

/** M · 10^E as an ordinary decimal: plain(32, 3) === "32000", plain(72, -5) === "0.00072". */
function plain(M: number, E: number): string {
  const [d, e] = stripZeros(M, E);
  const sign = M < 0 ? "-" : "";
  if (e >= 0) return sign + d + "0".repeat(e);
  const p = d.length + e;
  return sign + (p > 0 ? `${d.slice(0, p)}.${d.slice(p)}` : `0.${"0".repeat(-p)}${d}`);
}

/** M · 10^E in scientific notation. */
function sci(M: number, E: number): { mant: string; n: number; tex: string; txt: string } {
  const [d, e] = stripZeros(M, E);
  const n = e + d.length - 1;
  const mant = (M < 0 ? "-" : "") + d[0] + (d.length > 1 ? `.${d.slice(1)}` : "");
  return { mant, n, tex: md`${mant} \times 10^{${n}}`, txt: `${mant}*10^${n}` };
}

/** One to three significant digits, never ending in 0: "4", "32", "407". */
function sigDigits(r: Rng): string {
  const len = r.int(1, 3);
  let d = String(r.int(1, 9));
  for (let i = 1; i < len; i++) d += String(i === len - 1 ? r.int(1, 9) : r.int(0, 9));
  return d;
}

const VARS = ["x", "x", "x", "y", "a", "t"] as const;

/** t squared in LaTeX, with parentheses only when t is more than one symbol: x^2, (3x)^2. */
const sq = (t: string) => (t.length === 1 ? `${t}^2` : `(${t})^2`);

// ── Lesson 1: exponent rules ────────────────────────────────────────────────

const productRule: Generator = (r) => {
  const kind = r.int(0, 2);
  const v = r.pick(VARS);
  if (kind === 0) {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return {
      prompt: md`Simplify $${texPow(v, a)} \cdot ${texPow(v, b)}$.`,
      answer: txtPow(v, a + b),
      simplified: true,
      hint: md`Count factors: $${a}$ factors of $${v}$, then $${b}$ more.`,
      solution: [
        { math: md`${texPow(v, a)} \cdot ${texPow(v, b)} = ${v}^{${a} + ${b}}`, note: "Same base, so the factors simply line up in one long product. Add the counts." },
        { math: texPow(v, a + b), note: md`${a} factors and ${b} factors make ${a + b} factors of $${v}$.` },
      ],
    };
  }
  if (kind === 1) {
    const c1 = r.coef(-7, 7);
    const c2 = r.coef(-6, 6);
    const a = r.int(1, 6);
    const b = r.int(2, 6);
    return {
      prompt: md`Simplify $(${monoTex(c1, [[v, a]])})(${monoTex(c2, [[v, b]])})$.`,
      answer: monoTxt(c1 * c2, [[v, a + b]]),
      simplified: true,
      hint: md`Multiply the numbers, then multiply the powers of $${v}$ by adding exponents.${a === 1 ? md` A bare $${v}$ is $${v}^1$.` : ""}`,
      solution: [
        { math: md`(${c1} \cdot ${paren(c2)})(${texPow(v, a)} \cdot ${texPow(v, b)})`, note: md`Multiplication can be reordered and regrouped, so put the numbers together and the powers of $${v}$ together.` },
        { math: monoTex(c1 * c2, [[v, a + b]]), note: md`$${c1} \cdot ${paren(c2)} = ${c1 * c2}$, and $${a} + ${b} = ${a + b}$ factors of $${v}$.` },
      ],
    };
  }
  const c1 = r.int(2, 6);
  const c2 = r.coef(-5, 5);
  const [a, b, c, d] = [r.int(1, 5), r.int(1, 5), r.int(1, 5), r.int(1, 5)];
  const ans: Factors = [["x", a + c], ["y", b + d]];
  return {
    prompt: md`Simplify $(${monoTex(c1, [["x", a], ["y", b]])})(${monoTex(c2, [["x", c], ["y", d]])})$.`,
    answer: monoTxt(c1 * c2, ans),
    simplified: true,
    hint: md`Handle each kind of factor separately: numbers, then $x$'s, then $y$'s.`,
    solution: [
      {
        math: md`(${c1} \cdot ${paren(c2)})(${texPow("x", a)} \cdot ${texPow("x", c)})(${texPow("y", b)} \cdot ${texPow("y", d)})`,
        note: "Regroup the factors by kind. Only powers of the same base can be combined.",
      },
      { math: monoTex(c1 * c2, ans), note: md`Multiply the numbers; add the exponents on $x$ (${a} + ${c}) and on $y$ (${b} + ${d}).` },
    ],
  };
};

const powerRule: Generator = (r) => {
  const kind = r.int(0, 2);
  const v = r.pick(VARS);
  if (kind === 0) {
    const a = r.int(2, 6);
    const b = r.int(2, 5);
    return {
      prompt: md`Simplify $(${texPow(v, a)})^{${b}}$.`,
      answer: txtPow(v, a * b),
      simplified: true,
      hint: md`The outer exponent says how many copies of $${texPow(v, a)}$ are multiplied together.`,
      solution: [
        { math: Array(b).fill(texPow(v, a)).join(md` \cdot `), note: md`${b} copies of $${texPow(v, a)}$.` },
        { math: md`${v}^{${a} \cdot ${b}}`, note: md`${b} groups of ${a} factors each.` },
        { math: texPow(v, a * b), note: "" },
      ],
    };
  }
  if (kind === 1) {
    const c = r.pick([2, 3, 4, 5, -2, -3]);
    const n = Math.abs(c) === 2 ? r.int(2, 4) : Math.abs(c) === 3 ? r.int(2, 3) : 2;
    const a = r.int(1, 4);
    const cn = c ** n;
    return {
      prompt: md`Simplify $(${monoTex(c, [[v, a]])})^{${n}}$.`,
      answer: monoTxt(cn, [[v, a * n]]),
      simplified: true,
      hint: md`The exponent ${n} applies to **every** factor inside the parentheses, including the number ${c}.`,
      solution: [
        { math: md`${paren(c)}^{${n}} \cdot ${a === 1 ? `${v}^{${n}}` : `(${texPow(v, a)})^{${n}}`}`, note: md`Power of a product: $${n}$ copies of $${monoTex(c, [[v, a]])}$ regroup into $${n}$ copies of $${c}$ times $${n}$ copies of $${texPow(v, a)}$.` },
        { math: monoTex(cn, [[v, a * n]]), note: md`$${paren(c)}^{${n}} = ${cn}$${c < 0 ? (n % 2 ? " (an odd number of negatives is negative)" : " (an even number of negatives is positive)") : ""}, and $${a} \cdot ${n} = ${a * n}$.` },
      ],
    };
  }
  const c = r.int(2, 3);
  const a = r.int(1, 4);
  const d = r.coef(-5, 5);
  const b = r.int(1, 5);
  const ans = monoTex(c * c * d, [[v, 2 * a + b]]);
  return {
    prompt: md`Simplify $(${monoTex(c, [[v, a]])})^{2}(${monoTex(d, [[v, b]])})$.`,
    answer: monoTxt(c * c * d, [[v, 2 * a + b]]),
    simplified: true,
    hint: "Exponents come before multiplication: deal with the power first, then multiply.",
    solution: [
      { math: md`(${monoTex(c * c, [[v, 2 * a]])})(${monoTex(d, [[v, b]])})`, note: md`Square first: $${c}^2 = ${c * c}$ and $(${texPow(v, a)})^2 = ${texPow(v, 2 * a)}$.` },
      { math: ans, note: md`Multiply: $${c * c} \cdot ${paren(d)} = ${c * c * d}$, and add exponents $${2 * a} + ${b} = ${2 * a + b}$.` },
    ],
  };
};

const quotientRule: Generator = (r) => {
  const kind = r.int(0, 3);
  const v = r.pick(VARS);
  if (kind === 0) {
    const a = r.int(4, 9);
    const b = r.int(1, a - 2);
    return {
      prompt: md`Simplify $\frac{${texPow(v, a)}}{${texPow(v, b)}}$.`,
      answer: txtPow(v, a - b),
      simplified: true,
      hint: md`Each $${v}$ on the bottom cancels one $${v}$ on top, because $\frac{${v}}{${v}} = 1$.`,
      solution: [
        { math: md`${v}^{${a} - ${b}}`, note: md`${b} factors on the bottom cancel ${b} of the ${a} on top.` },
        { math: texPow(v, a - b), note: "" },
      ],
    };
  }
  if (kind === 1) {
    const d = r.int(2, 6);
    const q = r.coef(-6, 6);
    const a = r.int(3, 9);
    const b = r.int(1, a - 1);
    return {
      prompt: md`Simplify $\frac{${monoTex(q * d, [[v, a]])}}{${monoTex(d, [[v, b]])}}$.`,
      answer: monoTxt(q, [[v, a - b]]),
      simplified: true,
      hint: "Divide the numbers, then subtract exponents: top minus bottom.",
      solution: [
        { math: md`\frac{${q * d}}{${d}} \cdot \frac{${texPow(v, a)}}{${texPow(v, b)}}`, note: "Split the fraction into a number part and a variable part." },
        { math: monoTex(q, [[v, a - b]]), note: md`$${q * d} \div ${d} = ${q}$, and $${a} - ${b} = ${a - b}$.` },
      ],
    };
  }
  if (kind === 2) {
    const d = r.int(2, 5);
    const q = r.coef(-6, 6);
    const [c, g] = [r.int(1, 4), r.int(1, 4)];
    const [a, b] = [c + r.int(1, 5), g + r.int(1, 5)];
    const ans: Factors = [["x", a - c], ["y", b - g]];
    return {
      prompt: md`Simplify $\frac{${monoTex(q * d, [["x", a], ["y", b]])}}{${monoTex(d, [["x", c], ["y", g]])}}$.`,
      answer: monoTxt(q, ans),
      simplified: true,
      hint: md`Three separate jobs: the numbers, the $x$'s, the $y$'s.`,
      solution: [
        { math: md`\frac{${q * d}}{${d}} \cdot \frac{${texPow("x", a)}}{${texPow("x", c)}} \cdot \frac{${texPow("y", b)}}{${texPow("y", g)}}`, note: "Split by kind of factor." },
        { math: monoTex(q, ans), note: md`Divide the numbers; subtract exponents: $${a} - ${c} = ${a - c}$ for $x$ and $${b} - ${g} = ${b - g}$ for $y$.` },
      ],
    };
  }
  const [a, b, n] = [r.int(2, 4), r.int(2, 4), r.int(2, 3)];
  return {
    prompt: md`Simplify $\left(\frac{${texPow("x", a)}}{${texPow("y", b)}}\right)^{${n}}$.`,
    answer: `${txtPow("x", a * n)}/${txtPow("y", b * n)}`,
    simplified: true,
    hint: "Raising a fraction to a power raises the top and the bottom to that power.",
    solution: [
      { math: md`\frac{(${texPow("x", a)})^{${n}}}{(${texPow("y", b)})^{${n}}}`, note: md`$${n}$ copies of the fraction multiply tops together and bottoms together.` },
      { math: md`\frac{${texPow("x", a * n)}}{${texPow("y", b * n)}}`, note: "Power of a power: multiply the exponents." },
    ],
  };
};

// ── Lesson 2: zero and negative exponents ───────────────────────────────────

const evaluateZeroNegative: Generator = (r) => {
  const kind = r.int(0, 4);
  const flags = { simplified: true, positiveExponents: true } as const;
  if (kind === 0) {
    const b = r.int(2, 5);
    const n = b === 2 ? r.int(1, 5) : b === 3 ? r.int(1, 3) : r.int(1, 2);
    return {
      prompt: md`Evaluate $${b}^{-${n}}$. Give an exact answer, like 1/9.`,
      answer: `1/${b ** n}`,
      ...flags,
      hint: md`A negative exponent means "one over the positive power": $${b}^{-${n}} = \frac{1}{${texPow(String(b), n)}}$.`,
      solution: [
        { math: md`${b}^{-${n}} = \frac{1}{${texPow(String(b), n)}}`, note: "Negative exponent: take the reciprocal of the positive power." },
        { math: md`\frac{1}{${b ** n}}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const [p, q] = r.pick([[2, 3], [3, 4], [1, 2], [2, 5], [3, 2], [4, 3], [1, 3], [3, 5]] as const);
    const n = r.int(1, 2);
    return {
      prompt: md`Evaluate $\left(\frac{${p}}{${q}}\right)^{-${n}}$. Give an exact answer.`,
      answer: frac(q ** n, p ** n),
      ...flags,
      hint: md`$x^{-n} = \frac{1}{x^n}$, and one over a fraction is the fraction flipped.`,
      solution: [
        { math: md`\left(\frac{${q}}{${p}}\right)^{${n}}`, note: md`$\left(\frac{${p}}{${q}}\right)^{-${n}} = \frac{1}{(${p}/${q})^{${n}}}$, and dividing by $\frac{${p}}{${q}}$ is multiplying by $\frac{${q}}{${p}}$. So: flip, and make the exponent positive.` },
        { math: fracTex(q ** n, p ** n), note: n === 1 ? "" : "Square the top and the bottom." },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(2, 9);
    if (r.next() < 0.5) {
      const grouped = r.next() < 0.5;
      return {
        prompt: grouped ? md`Evaluate $(-${a})^{0}$.` : md`Evaluate $-${a}^{0}$.`,
        answer: grouped ? "1" : "-1",
        ...flags,
        hint: grouped ? md`The parentheses make $-${a}$ the base.` : md`The exponent belongs only to the ${a}; the minus sign waits, as in $-3^2 = -9$.`,
        solution: grouped
          ? [{ math: md`(-${a})^{0} = 1`, note: "Any nonzero number to the power 0 is 1, negatives included." }]
          : [
              { math: md`-(${a}^{0})`, note: "The exponent applies before the negation." },
              { math: md`-1`, note: md`$${a}^0 = 1$, and its opposite is $-1$.` },
            ],
      };
    }
    const b = r.int(2, 9);
    return {
      prompt: md`Evaluate $${a}^{0} + ${b}^{-1}$. Give an exact answer.`,
      answer: frac(b + 1, b),
      ...flags,
      hint: md`Evaluate each power on its own first. $${b}^{-1}$ is the reciprocal of ${b}.`,
      solution: [
        { math: md`1 + \frac{1}{${b}}`, note: md`$${a}^0 = 1$ and $${b}^{-1} = \frac{1}{${b}}$.` },
        { math: fracTex(b + 1, b), note: md`$1 = \frac{${b}}{${b}}$, so the sum is $\frac{${b + 1}}{${b}}$.` },
      ],
    };
  }
  if (kind === 3) {
    const b = r.int(2, 4);
    let c = r.int(2, 9);
    while (c % b === 0) c = r.int(2, 9);
    return {
      prompt: md`Evaluate $${c} \cdot ${b}^{-2}$. Give an exact answer.`,
      answer: frac(c, b * b),
      ...flags,
      hint: md`The exponent belongs only to the ${b}, not to the ${c}.`,
      solution: [
        { math: md`${c} \cdot \frac{1}{${b}^2}`, note: md`Only the base $${b}$ is raised to $-2$.` },
        { math: fracTex(c, b * b), note: md`$${b}^2 = ${b * b}$.` },
      ],
    };
  }
  const b = r.int(2, 3);
  const n = r.int(2, 3);
  const den = (-b) ** n;
  return {
    prompt: md`Evaluate $(-${b})^{-${n}}$. Give an exact answer.`,
    answer: frac(1, den),
    ...flags,
    hint: md`First rewrite as one over $(-${b})^{${n}}$. Then decide the sign: is ${n} even or odd?`,
    solution: [
      { math: md`\frac{1}{(-${b})^{${n}}}`, note: "The negative exponent makes a reciprocal. It doesn't change the sign." },
      { math: fracTex(1, den), note: n % 2 ? md`$(-${b})^{${n}} = ${den}$: an odd number of negative factors is negative.` : md`$(-${b})^{${n}} = ${den}$: an even number of negative factors is positive.` },
    ],
  };
};

const POSITIVE_ONLY = "Write the answer with positive exponents only.";

const simplifyNegative: Generator = (r) => {
  const kind = r.int(0, 4);
  const v = r.pick(VARS);
  const flags = { simplified: true, positiveExponents: true } as const;
  if (kind === 0) {
    const a = r.int(1, 7);
    const b = r.int(2, 8);
    const e = a - b;
    const ans = positive(1, [[v, e]]);
    return {
      prompt: md`Simplify $${texPow(v, a)} \cdot ${v}^{-${b}}$. ${POSITIVE_ONLY}`,
      answer: ans.txt,
      ...flags,
      hint: md`The product rule still works with negative exponents: add $${a} + (-${b})$.`,
      solution: [
        { math: md`${v}^{${a} + (-${b})} = ${v}^{${e}}`, note: "Product rule: add the exponents." },
        { math: ans.tex, note: e < 0 ? md`$${v}^{${e}} = ${ans.tex}$: a negative exponent means one over the positive power.` : e === 0 ? md`$${v}^0 = 1$ (for $${v} \ne 0$).` : "" },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 4);
    const s = r.int(2, 3) * r.sign();
    const ans = positive(1, [[v, -a * s]]);
    return {
      prompt: md`Simplify $(${v}^{-${a}})^{${s}}$. ${POSITIVE_ONLY}`,
      answer: ans.txt,
      ...flags,
      hint: "Power of a power: multiply the exponents, signs included.",
      solution: [
        { math: md`${v}^{(-${a})(${s})} = ${v}^{${-a * s}}`, note: "Multiply the exponents." },
        { math: ans.tex, note: s < 0 ? "Negative times negative is positive, so nothing needs to move." : "Move the negative power below the fraction bar." },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(1, 6);
    const b = r.int(a + 1, 9);
    const ans = positive(1, [[v, a - b]]);
    return {
      prompt: md`Simplify $\frac{${texPow(v, a)}}{${texPow(v, b)}}$. ${POSITIVE_ONLY}`,
      answer: ans.txt,
      ...flags,
      hint: "Subtract exponents, top minus bottom. More factors on the bottom means a negative result.",
      solution: [
        { math: md`${v}^{${a} - ${b}} = ${v}^{${a - b}}`, note: "Quotient rule." },
        { math: ans.tex, note: md`${b - a} factors of $${v}$ are left on the bottom.` },
      ],
    };
  }
  if (kind === 3) {
    const a = r.int(1, 3);
    if (r.next() < 0.5) {
      const c = r.int(2, 9);
      const ans = positive(c, [[v, -a]]);
      return {
        prompt: md`Simplify $${c}${v}^{-${a}}$. ${POSITIVE_ONLY}`,
        answer: ans.txt,
        ...flags,
        hint: md`The exponent belongs only to $${v}$. The ${c} stays on top.`,
        solution: [{ math: md`${c} \cdot \frac{1}{${texPow(v, a)}} = ${ans.tex}`, note: md`Only $${v}$ is raised to $-${a}$.` }],
      };
    }
    const c = r.int(2, 4);
    const k = r.int(1, 2);
    const ca = c ** k;
    return {
      prompt: md`Simplify $(${c}${v})^{-${k}}$. ${POSITIVE_ONLY}`,
      answer: `1/(${ca}${txtPow(v, k)})`,
      ...flags,
      hint: md`The parentheses make $${c}${v}$ the base, so the whole product goes to the bottom.`,
      solution: [
        ...(k === 1 ? [] : [{ math: md`\frac{1}{(${c}${v})^{${k}}}`, note: "Reciprocal of the positive power." }]),
        { math: md`\frac{1}{${ca}${texPow(v, k)}}`, note: k === 1 ? md`An exponent of $-1$ means the reciprocal of the whole base, $${c}${v}$.` : md`Power of a product: $${c}^{${k}} = ${ca}$ and $${v}^{${k}}$ both go to the bottom.` },
      ],
    };
  }
  // A quotient with negative exponents mixed in. The prompt starts with "Write" because the validator
  // can't read negative exponents inside \frac; its key was checked separately.
  const d = r.int(2, 4);
  const q = r.pick([1, 2, 3, -1, -2, 5]);
  let ex: number[];
  do ex = [r.nonzero(-4, 5), r.nonzero(-4, 5), r.nonzero(-4, 5), r.nonzero(-4, 5)];
  while (!ex.some((n) => n < 0));
  const [ax, ay, bx, by] = ex as [number, number, number, number];
  const [rx, ry] = [ax - bx, ay - by];
  const ans = positive(q, [["x", rx], ["y", ry]]);
  return {
    prompt: md`Write $\frac{${monoTex(q * d, [["x", ax], ["y", ay]])}}{${monoTex(d, [["x", bx], ["y", by]])}}$ in simplest form, with positive exponents only.`,
    answer: ans.txt,
    ...flags,
    hint: "Divide the numbers. For each letter, subtract exponents (top minus bottom), being careful with minus a negative. Then move any negative powers to the bottom.",
    solution: [
      { math: md`\frac{${q * d}}{${d}} \cdot x^{${ax} - ${paren(bx)}} \cdot y^{${ay} - ${paren(by)}}`, note: "Quotient rule for each letter." },
      { math: monoTex(q, [["x", rx], ["y", ry]]), note: md`$${ax} - ${paren(bx)} = ${rx}$ and $${ay} - ${paren(by)} = ${ry}$.` },
      { math: ans.tex, note: rx < 0 || ry < 0 ? "Each negative power becomes a positive power on the bottom." : rx === 0 || ry === 0 ? "A zero power is 1, so that letter disappears." : "" },
    ],
  };
};

// ── Lesson 3: scientific notation ───────────────────────────────────────────

const sciConvert: Generator = (r) => {
  const kind = r.int(0, 2);
  const d = sigDigits(r);
  const n = kind === 1 ? r.int(-6, -1) : r.int(3, 8);
  const s = sci(Number(d), n - (d.length - 1));
  const p = plain(Number(d), n - (d.length - 1));
  const dir = n > 0 ? "right" : "left";
  if (kind < 2) {
    return {
      prompt: md`Solve $${s.mant} \times 10^{n} = ${p}$. The answer is the power of ten that writes ${p} in scientific notation.`,
      answer: String(n),
      hint: md`Start at ${s.mant} and count how many places the decimal point has to move to reach ${p}. Moving right is a positive power; moving left is negative.`,
      solution: [
        { math: md`${s.mant} \;\to\; ${p}`, note: md`The point moves ${Math.abs(n)} place${Math.abs(n) === 1 ? "" : "s"} to the ${dir}.` },
        { math: md`n = ${n}`, note: n > 0 ? md`Multiplying by $10^{${n}}$ moves the point ${n} places right.` : md`Multiplying by $10^{${n}}$ divides by $10^{${-n}}$, which moves the point ${-n} place${n === -1 ? "" : "s"} left.` },
      ],
    };
  }
  const m = r.next() < 0.5 ? n : r.int(-5, -1);
  const s2 = sci(Number(d), m - (d.length - 1));
  const p2 = plain(Number(d), m - (d.length - 1));
  return {
    prompt: md`Evaluate $${s2.tex}$. Write it as an ordinary number.`,
    answer: p2,
    simplified: true,
    hint: m > 0 ? md`Multiplying by $10^{${m}}$ moves the decimal point ${m} places to the right. Fill empty places with zeros.` : md`$10^{${m}} = \frac{1}{10^{${-m}}}$, so the decimal point moves ${-m} place${m === -1 ? "" : "s"} to the left. Fill empty places with zeros.`,
    solution: [
      { math: md`${s2.mant} \;\to\; ${p2}`, note: md`Move the point ${Math.abs(m)} place${Math.abs(m) === 1 ? "" : "s"} to the ${m > 0 ? "right" : "left"}.` },
    ],
  };
};

const TENTHS = [12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 80];
const SCI_FORMAT = "Answer in scientific notation, typed like 1.5*10^7.";

const sciOperations: Generator = (r) => {
  const kind = r.int(0, 2);
  const product = kind === 0 || (kind === 2 && r.next() < 0.5);
  let At = r.pick(TENTHS);
  let B = r.int(2, 6);
  if (kind === 2) {
    // Always needs re-normalizing: the front numbers multiply to 10 or more.
    while (At * B < 100) {
      At = r.pick(TENTHS);
      B = r.int(2, 6);
    }
  }
  const q = r.nonzero(-4, 6);
  if (product) {
    const p = r.nonzero(-4, 7);
    const a = sci(At, p - 1);
    const b = sci(B, q);
    const raw = plain(At * B, -1);
    const res = sci(At * B, p + q - 1);
    const steps: Step[] = [
      { math: md`(${a.mant} \cdot ${b.mant}) \times (10^{${p}} \cdot 10^{${q}})`, note: "Regroup: front numbers together, powers of ten together." },
      { math: md`${raw} \times 10^{${p + q}}`, note: md`$${a.mant} \cdot ${b.mant} = ${raw}$, and the product rule adds the exponents: $${p} + ${paren(q)} = ${p + q}$.` },
    ];
    if (res.n !== p + q) steps.push({ math: res.tex, note: md`$${raw}$ is too big for the front number, which must be less than 10. Write $${raw} = ${sci(At * B, -1).mant} \times 10^{1}$, so the exponent goes up by one.` });
    if (kind === 2) {
      return {
        prompt: md`Solve $(${a.tex})(${b.tex}) = ${res.mant} \times 10^{n}$.`,
        answer: String(res.n),
        hint: "Multiply the front numbers and add the exponents. Then fix the front number so it is between 1 and 10, and adjust the exponent to match.",
        solution: [...steps, { math: md`n = ${res.n}`, note: "" }],
      };
    }
    return {
      prompt: md`Compute $(${a.tex})(${b.tex})$. ${SCI_FORMAT}`,
      answer: res.txt,
      simplified: true,
      hint: md`Multiply ${a.mant} by ${b.mant}, and add the exponents. If the front number reaches 10, shift one power of ten into the exponent.`,
      solution: steps,
    };
  }
  const k = r.nonzero(-4, 7);
  const num = sci(At * B, k + q - 1);
  const den = sci(B, q);
  const res = sci(At, k - 1);
  const e = num.n - q;
  const qm = plain(At, k - 1 - e);
  const steps: Step[] = [
    { math: md`\frac{${num.mant}}{${den.mant}} \times 10^{${num.n} - ${paren(q)}}`, note: "Divide the front numbers, and subtract the exponents (quotient rule)." },
    { math: md`${qm} \times 10^{${e}}`, note: md`$${num.mant} \div ${den.mant} = ${qm}$ and $${num.n} - ${paren(q)} = ${e}$.` },
  ];
  if (res.n !== e) steps.push({ math: res.tex, note: md`$${qm}$ is less than 1. Write $${qm} = ${res.mant} \times 10^{-1}$, so the exponent goes down by one.` });
  if (kind === 2) {
    return {
      prompt: md`Solve $(${num.tex}) \div (${den.tex}) = ${res.mant} \times 10^{n}$.`,
      answer: String(res.n),
      hint: "Divide the front numbers and subtract the exponents. If the front number comes out less than 1, borrow a power of ten from the exponent.",
      solution: [...steps, { math: md`n = ${res.n}`, note: "" }],
    };
  }
  return {
    prompt: md`Compute $(${num.tex}) \div (${den.tex})$. ${SCI_FORMAT}`,
    answer: res.txt,
    simplified: true,
    hint: md`Divide ${num.mant} by ${den.mant}, and subtract the exponents. If the front number drops below 1, take one power of ten out of the exponent.`,
    solution: steps,
  };
};

// ── Lesson 4: adding and subtracting polynomials ────────────────────────────

const POLY_FLAGS = { simplified: true, expanded: true } as const;

const addPolynomials: Generator = (r) => {
  const cubic = r.next() < 0.3;
  const P = randPoly(r, cubic ? 3 : 2);
  const Q = randPoly(r, 2);
  while (!cubic && P[2]! + Q[2]! === 0) Q[2] = r.nonzero(-6, 7);
  const S = addPolys(P, Q);
  return {
    prompt: md`Simplify $(${polyOf(P)}) + (${polyOf(Q)})$.`,
    answer: polyOf(S),
    ...POLY_FLAGS,
    hint: "Adding: drop the parentheses, then combine terms with the same power of x.",
    solution: [
      { math: poly([...termsOf(P), ...termsOf(Q)]), note: "A plus sign in front of parentheses changes nothing, so drop them." },
      { math: groupLike([P, Q]), note: "Gather like terms: same power of x." },
      { math: polyOf(S), note: "Add the coefficients in each group." },
    ],
  };
};

const subtractPolynomials: Generator = (r) => {
  const cubic = r.next() < 0.3;
  const P = randPoly(r, cubic ? 3 : 2);
  const Q = randPoly(r, 2);
  while (!cubic && P[2]! === Q[2]!) Q[2] = r.nonzero(-6, 7);
  const negQ = scale(Q, -1);
  const S = addPolys(P, negQ);
  return {
    prompt: md`Simplify $(${polyOf(P)}) - (${polyOf(Q)})$.`,
    answer: polyOf(S),
    ...POLY_FLAGS,
    hint: "The minus sign applies to every term of the second polynomial. Flip each of its signs first, then combine like terms.",
    solution: [
      { math: poly([...termsOf(P), ...termsOf(negQ)]), note: md`Subtracting is adding $-1$ times the second polynomial: every sign in it flips.` },
      { math: groupLike([P, negQ]), note: "Gather like terms." },
      { math: polyOf(S), note: "Add the coefficients." },
    ],
  };
};

const mixedPolynomials: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [k1, k2] = [r.int(2, 4), r.int(2, 4)];
    const P = randPoly(r, r.int(1, 2), 6);
    const Q = randPoly(r, 2, 6);
    const A = scale(P, k1);
    const B = scale(Q, -k2);
    const S = addPolys(A, B);
    return {
      prompt: md`Simplify $${k1}(${polyOf(P)}) - ${k2}(${polyOf(Q)})$.`,
      answer: polyOf(S),
      ...POLY_FLAGS,
      hint: md`Distribute $${k1}$ into the first parentheses and $-${k2}$ into the second, then combine like terms.`,
      solution: [
        { math: poly([...termsOf(A), ...termsOf(B)]), note: md`Distribute. The second multiplier is $-${k2}$, so every sign there flips.` },
        { math: groupLike([A, B]), note: "Gather like terms." },
        { math: polyOf(S), note: "Combine." },
      ],
    };
  }
  if (kind === 1) {
    // Cubic with gaps: missing powers are zero coefficients.
    const P = [r.nonzero(-9, 9), 0, r.nonzero(-6, 6), r.nonzero(-5, 6)];
    const Q = [r.nonzero(-9, 9), r.nonzero(-6, 6), 0, r.nonzero(-5, 6)];
    while (P[3] === Q[3]) Q[3] = r.nonzero(-5, 6);
    const negQ = scale(Q, -1);
    const S = addPolys(P, negQ);
    return {
      prompt: md`Simplify $(${polyOf(P)}) - (${polyOf(Q)})$.`,
      answer: polyOf(S),
      ...POLY_FLAGS,
      hint: "Some powers are missing from one polynomial. Those terms have nothing to combine with and just come along.",
      solution: [
        { math: poly([...termsOf(P), ...termsOf(negQ)]), note: "Flip every sign in the subtracted polynomial." },
        { math: groupLike([P, negQ]), note: "Gather like terms. A term with no partner stays as it is." },
        { math: polyOf(S), note: "Combine." },
      ],
    };
  }
  const names = ["x^2", "xy", "y^2"];
  const P = [r.nonzero(-6, 6), r.nonzero(-6, 6), r.nonzero(-6, 6)];
  const Q = [r.nonzero(-6, 6), r.nonzero(-6, 6), r.nonzero(-6, 6)];
  while (P[0] === Q[0]) Q[0] = r.nonzero(-6, 6);
  const terms = (cs: number[]) => cs.map((c, i) => [c, names[i]!] as [number, string]);
  const S = P.map((c, i) => c - Q[i]!);
  const grouped = names
    .map((n, i) => `(${poly([[P[i]!, n], [-Q[i]!, n]])})`)
    .join(" + ");
  return {
    prompt: md`Simplify $(${poly(terms(P))}) - (${poly(terms(Q))})$.`,
    answer: poly(terms(S)),
    ...POLY_FLAGS,
    hint: md`$x^2$, $xy$ and $y^2$ are three different kinds of term. Flip the signs of the second polynomial, then combine each kind.`,
    solution: [
      { math: poly([...terms(P), ...terms(scale(Q, -1))]), note: "Flip every sign in the subtracted polynomial." },
      { math: grouped, note: "Gather like terms." },
      { math: poly(terms(S)), note: "Combine." },
    ],
  };
};

// ── Lesson 5: multiplying polynomials ───────────────────────────────────────

const monomialTimesPolynomial: Generator = (r) => {
  const c = r.pick([2, 3, 4, 5, -2, -3, -4, 1, -1]);
  const k = r.int(1, 3);
  const P = randPoly(r, r.int(1, 2), 7);
  const M = [...Array(k).fill(0), c];
  const S = mulPolys(M, P);
  const m = monoTex(c, [["x", k]]);
  const parts = termsOf(P)
    .filter(([pc]) => pc !== 0)
    .map(([pc, pv]) => `(${m})(${pc === 1 && pv ? pv : pc === -1 && pv ? `-${pv}` : `${pc}${pv}`})`)
    .join(" + ");
  return {
    prompt: md`Multiply $${m}(${polyOf(P)})$.`,
    answer: polyOf(S),
    ...POLY_FLAGS,
    hint: md`Distribute: multiply $${m}$ by each term inside. Multiply the numbers and add the exponents.`,
    solution: [
      { math: parts, note: "The distributive property: the outside term multiplies every term inside." },
      { math: polyOf(S), note: "In each product, multiply the numbers and add the exponents on x (a bare x is x to the first power)." },
    ],
  };
};

const binomialTimesBinomial: Generator = (r) => {
  const a = r.pick([1, 1, 1, 2, 3]);
  const c = r.pick([1, 1, 2]);
  const b = r.nonzero(-9, 9);
  const d = r.nonzero(-9, 9);
  const P = [b, a];
  const Q = [d, c];
  const S = mulPolys(P, Q);
  const ax = monoTex(a, [["x", 1]]);
  const cx = monoTex(c, [["x", 1]]);
  return {
    prompt: md`Multiply $(${polyOf(P)})(${polyOf(Q)})$.`,
    answer: polyOf(S),
    ...POLY_FLAGS,
    hint: "Four products: each term of the first binomial times each term of the second. Then combine the two x-terms.",
    solution: [
      { math: md`(${ax})(${cx}) + (${ax})(${d}) + (${b})(${cx}) + (${b})(${d})`, note: "Every term of the first times every term of the second: the four boxes of the grid." },
      { math: poly([[a * c, "x^2"], [a * d, "x"], [b * c, "x"], [b * d, ""]]), note: "Do each multiplication, keeping its sign." },
      { math: polyOf(S), note: S[1] === 0 ? "The two x-terms cancel." : "Combine the two x-terms, which are like terms." },
    ],
  };
};

const largerProducts: Generator = (r) => {
  if (r.next() < 0.55) {
    const a = r.pick([1, 1, 2]);
    const b = r.nonzero(-5, 5);
    const Q = [r.nonzero(-6, 6), r.nonzero(-5, 5), r.pick([1, 1, 2])];
    const P = [b, a];
    const S = mulPolys(P, Q);
    const ax = monoTex(a, [["x", 1]]);
    const first = mulPolys([0, a], Q);
    const second = scale(Q, b);
    return {
      prompt: md`Multiply $(${polyOf(P)})(${polyOf(Q)})$.`,
      answer: polyOf(S),
      ...POLY_FLAGS,
      hint: "Six products: each of the 2 terms in the binomial times each of the 3 terms in the trinomial. Then combine like terms.",
      solution: [
        { math: md`${ax}(${polyOf(Q)}) ${b < 0 ? "-" : "+"} ${Math.abs(b)}(${polyOf(Q)})`, note: "Distribute the second factor over the first: one copy for each term." },
        { math: poly([...termsOf(first), ...termsOf(second)]), note: "Distribute again." },
        { math: groupLike([first, second]), note: "Gather like terms." },
        { math: polyOf(S), note: "Combine." },
      ],
    };
  }
  const [a, c] = [r.pick([1, 1, 2, 3]), r.pick([1, 1, 2])];
  const [b, d] = [r.nonzero(-5, 5), r.nonzero(-5, 5)];
  const term = (k: number, v: string) => monoTex(k, [[v, 1]]);
  const S: [number, string][] = [[a * c, "x^2"], [a * d + b * c, "xy"], [b * d, "y^2"]];
  return {
    prompt: md`Multiply $(${poly([[a, "x"], [b, "y"]])})(${poly([[c, "x"], [d, "y"]])})$.`,
    answer: poly(S),
    ...POLY_FLAGS,
    hint: md`Same four products as with one variable. $xy$ terms combine with each other, not with $x^2$ or $y^2$.`,
    solution: [
      { math: md`(${term(a, "x")})(${term(c, "x")}) + (${term(a, "x")})(${term(d, "y")}) + (${term(b, "y")})(${term(c, "x")}) + (${term(b, "y")})(${term(d, "y")})`, note: "Every term of the first times every term of the second." },
      { math: poly([[a * c, "x^2"], [a * d, "xy"], [b * c, "xy"], [b * d, "y^2"]]), note: md`Multiply. $yx$ is the same as $xy$.` },
      { math: poly(S), note: "Combine the middle terms." },
    ],
  };
};

// ── Lesson 6: special products ──────────────────────────────────────────────

const squareOfBinomial: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.pick([1, 1, 2, 3, 4, 5]);
    const b = r.nonzero(-9, 9);
    const A = monoTex(a, [["x", 1]]);
    const S = [b * b, 2 * a * b, a * a];
    const pm = b < 0 ? "-" : "+";
    return {
      prompt: md`Expand $(${polyOf([b, a])})^{2}$.`,
      answer: polyOf(S),
      ...POLY_FLAGS,
      hint: md`Use $(a ${pm} b)^2 = a^2 ${pm} 2ab + b^2$ with $a = ${A}$ and $b = ${Math.abs(b)}$. Don't forget the middle term.`,
      solution: [
        { math: md`${sq(A)} ${pm} 2(${A})(${Math.abs(b)}) + ${Math.abs(b)}^2`, note: md`The pattern $(a ${pm} b)^2 = a^2 ${pm} 2ab + b^2$, with $a = ${A}$ and $b = ${Math.abs(b)}$.` },
        { math: polyOf(S), note: "Square the first term, twice the product, square the last term." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([1, 1, 2, 3]);
    const b = r.int(1, 5) * r.sign();
    const A = monoTex(a, [["x", 1]]);
    const B = monoTex(Math.abs(b), [["y", 1]]);
    const S: [number, string][] = [[a * a, "x^2"], [2 * a * b, "xy"], [b * b, "y^2"]];
    const pm = b < 0 ? "-" : "+";
    return {
      prompt: md`Expand $(${poly([[a, "x"], [b, "y"]])})^{2}$.`,
      answer: poly(S),
      ...POLY_FLAGS,
      hint: md`Same pattern with $a = ${A}$ and $b = ${B}$.`,
      solution: [
        { math: md`${sq(A)} ${pm} 2(${A})(${B}) + ${sq(B)}`, note: md`$(a ${pm} b)^2 = a^2 ${pm} 2ab + b^2$ with $a = ${A}$, $b = ${B}$.` },
        { math: poly(S), note: "" },
      ],
    };
  }
  const b = r.nonzero(-9, 9);
  const pm = b < 0 ? "-" : "+";
  const S = [b * b, 2 * b];
  return {
    prompt: md`Simplify $(${polyOf([b, 1])})^{2} - x^2$.`,
    answer: polyOf(S),
    ...POLY_FLAGS,
    hint: md`Expand $(x ${pm} ${Math.abs(b)})^2$ fully first. It is not $x^2 + ${b * b}$: there is a middle term.`,
    solution: [
      { math: md`x^2 ${pm} ${Math.abs(2 * b)}x + ${b * b} - x^2`, note: md`$(x ${pm} ${Math.abs(b)})^2 = x^2 ${pm} 2 \cdot ${Math.abs(b)}x + ${Math.abs(b)}^2$.` },
      { math: polyOf(S), note: md`The $x^2$ terms cancel. Squaring each term separately would have left only $${b * b}$, missing the $${2 * b}x$.` },
    ],
  };
};

const sumTimesDifference: Generator = (r) => {
  const kind = r.int(0, 2);
  const b = r.int(1, 9);
  if (kind === 0) {
    const a = r.pick([1, 1, 2, 3, 4]);
    const A = monoTex(a, [["x", 1]]);
    const constFirst = r.next() < 0.25;
    const plus = constFirst ? `${b} + ${A}` : polyOf([b, a]);
    const minus = constFirst ? `${b} - ${A}` : polyOf([-b, a]);
    const [f1, f2] = r.next() < 0.5 ? [plus, minus] : [minus, plus];
    const S = constFirst ? [b * b, 0, -a * a] : [-b * b, 0, a * a];
    const [first, last] = constFirst ? [String(b), A] : [A, String(b)];
    return {
      prompt: md`Multiply $(${f1})(${f2})$.`,
      answer: polyOf(S),
      ...POLY_FLAGS,
      hint: md`This is $(a + b)(a - b)$ with $a = ${first}$ and $b = ${last}$. The middle terms cancel.`,
      solution: [
        { math: md`${sq(first)} - ${sq(last)}`, note: md`$(a + b)(a - b) = a^2 - b^2$: the products $+ab$ and $-ab$ cancel.` },
        { math: polyOf(S), note: "" },
      ],
    };
  }
  if (kind === 1) {
    const S = [-b * b, 0, 0, 0, 1];
    return {
      prompt: md`Multiply $(x^2 + ${b})(x^2 - ${b})$.`,
      answer: polyOf(S),
      ...POLY_FLAGS,
      hint: md`Here the first term is $x^2$, and $(x^2)^2 = x^4$.`,
      solution: [
        { math: md`(x^2)^2 - ${b}^2`, note: md`Sum times difference, with $a = x^2$ and $b = ${b}$.` },
        { math: polyOf(S), note: "Power of a power for the first term." },
      ],
    };
  }
  const a = r.pick([1, 2, 3, 5]);
  const A = monoTex(a, [["x", 1]]);
  const B = monoTex(b, [["y", 1]]);
  const S: [number, string][] = [[a * a, "x^2"], [-b * b, "y^2"]];
  return {
    prompt: md`Multiply $(${A} - ${B})(${A} + ${B})$.`,
    answer: poly(S),
    ...POLY_FLAGS,
    hint: "Order doesn't matter: a difference times a sum of the same two terms is still a difference of squares.",
    solution: [
      { math: md`${sq(A)} - ${sq(B)}`, note: md`$a^2 - b^2$ with $a = ${A}$ and $b = ${B}$.` },
      { math: poly(S), note: "" },
    ],
  };
};

const specialMentalMath: Generator = (r) => {
  if (r.next() < 0.5) {
    const k = r.int(2, 9);
    const d = r.int(1, 2) * r.sign();
    const n = 10 * k + d;
    const pm = d < 0 ? "-" : "+";
    return {
      prompt: md`Use a special product to compute $${n}^2$ without a calculator.`,
      answer: String(n * n),
      simplified: true,
      hint: md`Write ${n} as $${10 * k} ${pm} ${Math.abs(d)}$ and use $(a ${pm} b)^2 = a^2 ${pm} 2ab + b^2$.`,
      solution: [
        { math: md`(${10 * k} ${pm} ${Math.abs(d)})^2`, note: "Split into a round number and a small one." },
        { math: md`${100 * k * k} ${pm} ${20 * k * Math.abs(d)} + ${d * d}`, note: md`$${10 * k}^2 = ${100 * k * k}$, $2 \cdot ${10 * k} \cdot ${Math.abs(d)} = ${20 * k * Math.abs(d)}$, $${Math.abs(d)}^2 = ${d * d}$.` },
        { math: String(n * n), note: "" },
      ],
    };
  }
  const m = 10 * r.int(2, 9);
  const d = r.int(1, 4);
  return {
    prompt: md`Use a special product to compute $${m - d} \cdot ${m + d}$ without a calculator.`,
    answer: String(m * m - d * d),
    simplified: true,
    hint: md`Both numbers are ${d} away from ${m}.`,
    solution: [
      { math: md`(${m} - ${d})(${m} + ${d})`, note: "A difference times a sum." },
      { math: md`${m}^2 - ${d}^2 = ${m * m} - ${d * d}`, note: md`$(a - b)(a + b) = a^2 - b^2$.` },
      { math: String(m * m - d * d), note: "" },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit6: Unit = {
  title: "Exponents and Polynomials",
  lessons: [
    {
      id: "exponent-rules-from-repeated-multiplication",
      title: "Exponent rules from repeated multiplication",
      summary: "Product, power and quotient rules, each found by counting factors.",
      blocks: [
        {
          kind: "text",
          body: md`You've used exponents since Unit 1: $x^2$ means $x \cdot x$, and $4^3 = 4 \cdot 4 \cdot 4$. In this lesson you'll see that every rule for working with exponents comes from that one definition. No rule needs memorizing on faith, because each one is a count.`,
        },
        {
          kind: "key",
          title: "Exponents",
          body: md`For a whole number $n \ge 1$,

$$x^n = \underbrace{x \cdot x \cdots x}_{n \text{ factors}}$$

$x$ is the **base** and $n$ is the **exponent**. The exponent counts how many times the base appears as a factor. In particular $x^1 = x$.`,
        },
        {
          kind: "why",
          title: "Product rule: multiplying adds the counts",
          body: md`Write out $x^3 \cdot x^4$:

$$x^3 \cdot x^4 = (x \cdot x \cdot x)(x \cdot x \cdot x \cdot x).$$

Multiplication is associative, so the parentheses don't matter. What's left is one long product with $3 + 4 = 7$ factors of $x$. So $x^3 \cdot x^4 = x^7$. The same counting works for any whole numbers:

$$x^m \cdot x^n = x^{m+n}.$$

The bases must match. In $x^3 y^4$ there is nothing to count together, so it stays as it is.`,
        },
        {
          kind: "example",
          title: "Numbers and powers together",
          problem: md`Simplify $(4x^3)(-2x^5)$.`,
          steps: [
            { math: md`(4 \cdot (-2))(x^3 \cdot x^5)`, note: "Commutative and associative properties: put the numbers together and the powers of x together." },
            { math: md`-8x^8`, note: md`$4 \cdot (-2) = -8$, and 3 factors of $x$ plus 5 factors make 8.` },
          ],
        },
        {
          kind: "why",
          title: "Power rule: a power of a power multiplies",
          body: md`$(x^4)^3$ means three copies of $x^4$ multiplied together:

$$(x^4)^3 = x^4 \cdot x^4 \cdot x^4.$$

That's 3 groups of 4 factors, which is $3 \cdot 4 = 12$ factors. So $(x^4)^3 = x^{12}$, and in general

$$(x^m)^n = x^{mn}.$$`,
        },
        {
          kind: "why",
          title: "A power of a product reaches every factor",
          body: md`$(3x)^4$ is four copies of $3x$:

$$(3x)^4 = (3x)(3x)(3x)(3x) = (3 \cdot 3 \cdot 3 \cdot 3)(x \cdot x \cdot x \cdot x) = 3^4 x^4 = 81x^4.$$

We only regrouped, so in general $(ab)^n = a^n b^n$. Fractions work the same way, because multiplying fractions multiplies the tops and the bottoms separately: $\left(\frac{a}{b}\right)^n = \frac{a^n}{b^n}$.`,
        },
        {
          kind: "example",
          title: "Every factor gets the exponent",
          problem: md`Simplify $(-2x^3y)^3$.`,
          steps: [
            { math: md`(-2)^3 (x^3)^3 y^3`, note: "Power of a product: the cube applies to $-2$, to $x^3$ and to $y$." },
            { math: md`-8x^9y^3`, note: md`$(-2)^3 = -8$ (three negatives make a negative), and $(x^3)^3 = x^{3 \cdot 3}$.` },
          ],
        },
        {
          kind: "why",
          title: "Quotient rule: dividing subtracts the counts",
          body: md`Write out $\frac{x^6}{x^2}$ and cancel. Each $\frac{x}{x}$ is 1 (as long as $x \ne 0$):

$$\frac{x^6}{x^2} = \frac{\cancel{x} \cdot \cancel{x} \cdot x \cdot x \cdot x \cdot x}{\cancel{x} \cdot \cancel{x}} = x^4.$$

The 2 factors on the bottom cancel 2 of the 6 on top, leaving $6 - 2 = 4$. In general

$$\frac{x^m}{x^n} = x^{m-n} \quad (x \ne 0).$$

For now take $m > n$, so there is something left on top. The next lesson asks what happens when there isn't.`,
        },
        {
          kind: "key",
          title: "The exponent rules",
          body: md`For the same base $x$ (and $x \ne 0$ when dividing):

- **Product:** $x^m \cdot x^n = x^{m+n}$
- **Quotient:** $\frac{x^m}{x^n} = x^{m-n}$
- **Power of a power:** $(x^m)^n = x^{mn}$
- **Power of a product:** $(ab)^n = a^n b^n$, and $\left(\frac{a}{b}\right)^n = \frac{a^n}{b^n}$`,
        },
        {
          kind: "text",
          body: md`**Three traps**, each one a rule used where it doesn't apply:

- $x^3 + x^4$ is **not** $x^7$. The product rule is about multiplying. $x^3$ and $x^4$ aren't like terms, so a sum of them can't be combined. Check with $x = 2$: $8 + 16 = 24$, but $2^7 = 128$.
- $2^3 \cdot 2^4 = 2^7$, **not** $4^7$. You are counting factors of 2; the base doesn't change.
- $(x + y)^2$ is **not** $x^2 + y^2$. The power-of-a-product rule is for products, and $x + y$ is a sum. Lesson 6 shows what $(x + y)^2$ really is.`,
        },
        {
          kind: "example",
          title: "A quotient with two variables",
          problem: md`Simplify $\frac{15x^7y^4}{3x^2y}$.`,
          steps: [
            { math: md`\frac{15}{3} \cdot \frac{x^7}{x^2} \cdot \frac{y^4}{y}`, note: md`Split by kind of factor. This is multiplying fractions read backwards: $\frac{a}{c} \cdot \frac{b}{d} = \frac{ab}{cd}$.` },
            { math: md`5x^5y^3`, note: md`$15 \div 3 = 5$; $7 - 2 = 5$; $4 - 1 = 3$ (a bare $y$ is $y^1$).` },
          ],
        },
        {
          kind: "check",
          prompt: md`Simplify $x^4 \cdot x^5$.`,
          answer: "x^9",
          simplified: true,
          explain: md`Four factors of $x$ followed by five more is nine factors: $x^{4+5} = x^9$.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $(2x^3)^4$.`,
          answer: "16x^12",
          simplified: true,
          explain: md`The 4 applies to both factors: $2^4 = 16$ and $(x^3)^4 = x^{12}$. So $16x^{12}$.`,
        },
      ],
      practice: [productRule, powerRule, quotientRule],
    },
    {
      id: "zero-and-negative-exponents",
      title: "Zero and negative exponents",
      summary: "What x⁰ and x⁻ⁿ have to mean if the rules are going to keep working.",
      blocks: [
        {
          kind: "text",
          body: md`"$x^n$ is $n$ factors of $x$" makes no sense for $n = 0$ or $n = -3$. You can't write down zero factors, or negative three. So these exponents need a definition. We get to choose it, and there is exactly one choice that keeps every rule from the last lesson working.`,
        },
        {
          kind: "why",
          title: "Follow the pattern",
          body: md`Read these powers of 2 from left to right. Each time the exponent drops by 1, you remove one factor of 2, so the value is divided by 2:

$$2^4 = 16, \quad 2^3 = 8, \quad 2^2 = 4, \quad 2^1 = 2.$$

Keep going, still dividing by 2 each step:

$$2^0 = 1, \quad 2^{-1} = \tfrac{1}{2}, \quad 2^{-2} = \tfrac{1}{4}, \quad 2^{-3} = \tfrac{1}{8}.$$

The pattern says $2^0$ should be 1, and $2^{-n}$ should be $\frac{1}{2^n}$.`,
        },
        {
          kind: "plot",
          x: [-3.5, 3.5],
          y: [-0.5, 8.5],
          curves: [{ expr: "2^x", label: "y = 2^x", dashed: true }],
          points: [
            { x: -3, y: 0.125 },
            { x: -2, y: 0.25, label: md`\tfrac{1}{4}` },
            { x: -1, y: 0.5, label: md`\tfrac{1}{2}` },
            { x: 0, y: 1, label: "1", color: 2 },
            { x: 1, y: 2, label: "2" },
            { x: 2, y: 4, label: "4" },
            { x: 3, y: 8, label: "8" },
          ],
          caption: "Each step to the left halves the height. Stepping left past 0 keeps halving: it never reaches 0 or goes negative.",
        },
        {
          kind: "why",
          title: "The quotient rule says the same thing",
          body: md`Any nonzero number divided by itself is 1, so $\frac{x^5}{x^5} = 1$. The quotient rule, applied anyway, says $\frac{x^5}{x^5} = x^{5-5} = x^0$. For the rule to keep working, $x^0$ **must** be 1.

Now try more factors on the bottom. Cancelling gives

$$\frac{x^2}{x^5} = \frac{\cancel{x} \cdot \cancel{x}}{\cancel{x} \cdot \cancel{x} \cdot x \cdot x \cdot x} = \frac{1}{x^3},$$

while the rule says $x^{2-5} = x^{-3}$. So $x^{-3}$ must mean $\frac{1}{x^3}$. Two different arguments, the pattern and the quotient rule, agree.`,
        },
        {
          kind: "key",
          title: "Zero and negative exponents",
          body: md`For $x \ne 0$ and any whole number $n$:

$$x^0 = 1 \qquad x^{-n} = \frac{1}{x^n} \qquad \frac{1}{x^{-n}} = x^n$$

A negative exponent means **reciprocal**, not a negative number: $2^{-3} = \frac{1}{8}$, which is positive. With these meanings, every exponent rule from the last lesson works for all integer exponents.`,
        },
        {
          kind: "why",
          title: "Why 0⁰ is left aside",
          body: md`Two patterns collide at $0^0$. Powers of zero, $0^3 = 0$, $0^2 = 0$, $0^1 = 0$, suggest $0^0 = 0$. The rule $x^0 = 1$ suggests $0^0 = 1$. And the quotient argument that gave us $x^0 = 1$ needs $\frac{0^5}{0^5}$, which divides by zero, so it proves nothing here.

No single value keeps every rule working, so in algebra $0^0$ is left undefined, and $x^0 = 1$ comes with "$x \ne 0$". Negative powers of zero fail for a plainer reason: $0^{-1} = \frac{1}{0}$ is a division by zero. (Some later courses agree to set $0^0 = 1$ because it's convenient there. That's an agreement, not a consequence of the rules.)`,
        },
        {
          kind: "text",
          body: md`Check that an old rule really does still work: $x^5 \cdot x^{-2} = x^5 \cdot \frac{1}{x^2} = \frac{x^5}{x^2} = x^3$, and the product rule gives $x^{5 + (-2)} = x^3$. They agree.

As always, an exponent belongs only to its base:

- $3x^{-2} = \frac{3}{x^2}$, but $(3x)^{-2} = \frac{1}{9x^2}$.
- $-2^0 = -(2^0) = -1$, but $(-2)^0 = 1$.`,
        },
        {
          kind: "example",
          title: "Evaluating",
          problem: md`Evaluate $2^{-3} + 4^0$.`,
          steps: [
            { math: md`\frac{1}{2^3} + 1`, note: md`$2^{-3}$ is the reciprocal of $2^3$; $4^0 = 1$.` },
            { math: md`\frac{1}{8} + \frac{8}{8} = \frac{9}{8}`, note: "Common denominator, then add." },
          ],
        },
        {
          kind: "example",
          title: "A negative power of a fraction",
          problem: md`Evaluate $\left(\frac{2}{3}\right)^{-2}$.`,
          steps: [
            { math: md`\frac{1}{\left(\frac{2}{3}\right)^2}`, note: "Negative exponent: reciprocal of the positive power." },
            { math: md`\left(\frac{3}{2}\right)^2`, note: md`Dividing by $\frac{2}{3}$ (twice) is multiplying by $\frac{3}{2}$ (twice). So a negative power of a fraction flips it.` },
            { math: md`\frac{9}{4}`, note: "Square the top and the bottom." },
          ],
        },
        {
          kind: "example",
          title: "Simplifying to positive exponents",
          problem: md`Simplify $\frac{6x^{-2}y^3}{2x^4y^{-1}}$ and write it with positive exponents.`,
          steps: [
            { math: md`\frac{6}{2} \cdot x^{-2-4} \cdot y^{3-(-1)}`, note: "The quotient rule works for every integer exponent: top minus bottom." },
            { math: md`3x^{-6}y^4`, note: md`$-2 - 4 = -6$, and $3 - (-1) = 4$.` },
            { math: md`\frac{3y^4}{x^6}`, note: md`$x^{-6} = \frac{1}{x^6}$, so $x^6$ goes to the bottom. The 3 and $y^4$ stay on top.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $5^{-2}$. Give an exact answer.`,
          answer: "1/25",
          simplified: true,
          positiveExponents: true,
          explain: md`$5^{-2} = \frac{1}{5^2} = \frac{1}{25}$. It's positive: the negative exponent means "reciprocal".`,
        },
        {
          kind: "check",
          prompt: md`Simplify $\frac{x^2}{x^6}$, using positive exponents only.`,
          answer: "1/x^4",
          simplified: true,
          positiveExponents: true,
          explain: md`The quotient rule gives $x^{2-6} = x^{-4} = \frac{1}{x^4}$. Cancelling directly agrees: 4 factors of $x$ are left on the bottom.`,
        },
      ],
      practice: [evaluateZeroNegative, simplifyNegative],
    },
    {
      id: "scientific-notation",
      title: "Scientific notation",
      summary: "Writing very large and very small numbers with powers of ten, and computing with them.",
      blocks: [
        {
          kind: "text",
          body: md`The Sun is about $150{,}000{,}000{,}000$ meters from Earth. A red blood cell is about $0.000008$ meters across. Numbers like these are hard to read and easy to miscopy: one lost zero is an error by a factor of ten. Powers of ten count the zeros for us.`,
        },
        {
          kind: "why",
          title: "Why multiplying by 10 moves the decimal point",
          body: md`In our number system each place is worth 10 times the place to its right. Multiplying by 10 makes every digit worth ten times as much, so every digit shifts one place to the left. That looks like the decimal point moving one place to the **right**: $3.2 \times 10 = 32$.

$10^n$ is $n$ factors of 10, so multiplying by $10^n$ moves the point $n$ places right. From the last lesson, $10^{-n} = \frac{1}{10^n}$, so multiplying by $10^{-n}$ divides by 10 $n$ times and moves the point $n$ places **left**:

$$10^3 = 1000, \qquad 10^0 = 1, \qquad 10^{-2} = \frac{1}{100} = 0.01.$$`,
        },
        {
          kind: "key",
          title: "Scientific notation",
          body: md`A number is in **scientific notation** when it is written as

$$a \times 10^n, \qquad 1 \le a < 10, \quad n \text{ an integer}.$$

The front number $a$ has exactly one nonzero digit before the decimal point. For example $150{,}000{,}000{,}000 = 1.5 \times 10^{11}$ and $0.000008 = 8 \times 10^{-6}$. Large numbers get positive exponents; numbers between 0 and 1 get negative ones.`,
        },
        {
          kind: "example",
          title: "A small number",
          problem: md`Write $0.00072$ in scientific notation.`,
          steps: [
            { math: md`a = 7.2`, note: "Put the point just after the first nonzero digit." },
            { math: md`0.00072 \;\to\; 7.2`, note: md`To get from 0.00072 to 7.2 the point moved 4 places right, which multiplied by $10^4$.` },
            { math: md`0.00072 = 7.2 \times 10^{-4}`, note: md`Undo that multiplication: $7.2 \times 10^{-4}$ divides by $10^4$ again. Check: $7.2 \times 0.0001 = 0.00072$.` },
          ],
        },
        {
          kind: "why",
          title: "Why products are easy",
          body: md`To multiply $(3 \times 10^4)(6 \times 10^5)$, use the commutative and associative properties to put the front numbers together and the powers of ten together, then the product rule:

$$(3 \cdot 6)(10^4 \cdot 10^5) = 18 \times 10^9.$$

That's the right value, but 18 isn't between 1 and 10. Since $18 = 1.8 \times 10^1$, one more factor of ten moves into the exponent:

$$18 \times 10^9 = 1.8 \times 10^1 \times 10^9 = 1.8 \times 10^{10}.$$`,
        },
        {
          kind: "example",
          title: "A quotient",
          problem: md`Compute $(4.8 \times 10^{3}) \div (1.6 \times 10^{-2})$.`,
          steps: [
            { math: md`\frac{4.8}{1.6} \times 10^{3 - (-2)}`, note: "Divide the front numbers; the quotient rule subtracts the exponents." },
            { math: md`3 \times 10^{5}`, note: md`$4.8 \div 1.6 = 3$, and $3 - (-2) = 5$. The front number is already between 1 and 10.` },
          ],
        },
        {
          kind: "example",
          title: "When the front number is too small",
          problem: md`Compute $(1.2 \times 10^{5}) \div (4 \times 10^{2})$.`,
          steps: [
            { math: md`0.3 \times 10^{3}`, note: md`$1.2 \div 4 = 0.3$, and $5 - 2 = 3$.` },
            { math: md`3 \times 10^{-1} \times 10^{3}`, note: md`0.3 is less than 1. Write it as $3 \times 10^{-1}$.` },
            { math: md`3 \times 10^{2}`, note: md`Product rule: $-1 + 3 = 2$.` },
          ],
        },
        {
          kind: "text",
          body: md`**Typing answers.** Type $1.8 \times 10^{10}$ as **1.8*10^10** and $7.2 \times 10^{-4}$ as **7.2*10^-4**. Don't use the letter x for "times" (here it would be a variable), and don't use calculator "e" notation: in math, e is a number, about 2.718.

Any form with the right value is accepted, since it is the same number. But practise putting the result in scientific notation: that final adjusting step is the skill.`,
        },
        {
          kind: "check",
          prompt: md`$46000$ is written as $4.6 \times 10^{n}$. What is $n$?`,
          answer: "4",
          explain: md`From 4.6 the point moves 4 places right to reach 46000, so $46000 = 4.6 \times 10^4$.`,
        },
        {
          kind: "check",
          prompt: md`Compute $(2 \times 10^{3})(4 \times 10^{5})$. Answer in scientific notation.`,
          answer: "8*10^8",
          simplified: true,
          explain: md`$2 \cdot 4 = 8$ and $10^3 \cdot 10^5 = 10^8$. The front number 8 is already between 1 and 10, so the answer is $8 \times 10^8$.`,
        },
      ],
      practice: [sciConvert, sciOperations],
    },
    {
      id: "adding-and-subtracting-polynomials",
      title: "Adding and subtracting polynomials",
      summary: "The vocabulary of polynomials, and why adding them is just combining like terms.",
      blocks: [
        {
          kind: "text",
          body: md`You've been combining like terms since Unit 1. Expressions such as $3x^2 - 5x + 2$ have a name, and they are the main objects of the next few units, so it's worth fixing the vocabulary now.`,
        },
        {
          kind: "key",
          title: "Polynomials",
          body: md`- A **monomial** is a number, a variable, or a product of them with whole-number exponents: $7$, $x$, $-3x^2$, $4xy^3$.
- A **polynomial** is a sum of monomials, called its **terms**. Two terms make a **binomial**, three a **trinomial**.
- The **degree** of a term is its exponent (with several variables, add their exponents: $4xy^3$ has degree 4). The **degree of the polynomial** is the highest degree of its terms.
- **Standard form** lists terms from highest degree to lowest. The coefficient of the first term is the **leading coefficient**.`,
        },
        {
          kind: "text",
          body: md`Exponents in a polynomial must be whole numbers $0, 1, 2, \ldots$. So $\frac{1}{x} = x^{-1}$ is not a polynomial, and neither is anything with $x$ in a denominator.`,
        },
        {
          kind: "example",
          title: "Reading a polynomial",
          problem: md`Put $4x - 2x^5 + 7 + x^3$ in standard form and find its degree and leading coefficient.`,
          steps: [
            { math: md`-2x^5 + x^3 + 4x + 7`, note: "Reorder from highest power to lowest. Each sign travels with its term." },
            { math: md`\text{degree } 5, \text{ leading coefficient } -2`, note: md`The highest power is $x^5$, and its coefficient is $-2$. It has 4 terms.` },
          ],
        },
        {
          kind: "check",
          prompt: md`What is the degree of $3x^2 - 8x^4 + x$?`,
          answer: "4",
          explain: md`The term with the highest power is $-8x^4$, so the degree is 4. Position in the list doesn't matter.`,
        },
        {
          kind: "why",
          title: "Adding is regrouping",
          body: md`Add $(3x^2 - 5x + 2) + (x^2 + 4x - 7)$. A plus sign in front of parentheses changes nothing (associative property), so drop them. The commutative property lets you reorder the terms so like terms sit together, and the distributive property combines them, exactly as in Unit 1:

$$(3x^2 + x^2) + (-5x + 4x) + (2 - 7) = 4x^2 - x - 5.$$

There is no new rule. Adding polynomials is combining like terms.`,
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-4, 8],
          curves: [
            { expr: "x^2 - 2", label: "p = x^2 - 2", color: 1 },
            { expr: "x + 1", label: "q = x + 1", color: 2 },
            { expr: "x^2 + x - 1", label: "p + q = x^2 + x - 1", color: 3, dashed: true },
          ],
          points: [
            { x: 1, y: -1, color: 1 },
            { x: 1, y: 2, color: 2 },
            { x: 1, y: 1, label: "-1 + 2", color: 3 },
          ],
          caption: "At every x, the height of p + q is the height of p plus the height of q. At x = 1: −1 + 2 = 1.",
        },
        {
          kind: "why",
          title: "Subtracting flips every sign",
          body: md`Subtracting is adding the opposite, and the opposite of a sum is $-1$ times it. By the distributive property,

$$a - (b + c) = a + (-1)(b + c) = a - b - c.$$

So subtracting a polynomial means subtracting **each** of its terms: every sign inside flips. Numbers show why it can't be just the first term: $10 - (4 + 3) = 3$ and $10 - 4 - 3 = 3$, but $10 - 4 + 3 = 9$.`,
        },
        {
          kind: "example",
          title: "Subtracting",
          problem: md`Simplify $(5x^2 + 2x - 1) - (2x^2 - 3x + 4)$.`,
          steps: [
            { math: md`5x^2 + 2x - 1 - 2x^2 + 3x - 4`, note: "Flip every sign in the second polynomial: $2x^2 \to -2x^2$, $-3x \to +3x$, $4 \to -4$." },
            { math: md`(5x^2 - 2x^2) + (2x + 3x) + (-1 - 4)`, note: "Gather like terms." },
            { math: md`3x^2 + 5x - 5`, note: "Combine." },
          ],
        },
        {
          kind: "text",
          body: md`**Working in columns.** Some people like to write one polynomial under the other, lining up like terms in columns, the way you add multi-digit numbers. If a power is missing, leave a gap or write a $0$ term ($0x^2$) so the columns stay lined up. For subtraction, flip the signs of the bottom row first, then add the columns.`,
        },
        {
          kind: "key",
          title: "Adding and subtracting polynomials",
          body: md`- Remove the parentheses. After a minus sign, flip every sign inside.
- Combine like terms: same variables, same powers.
- Write the result in standard form.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $(4x^2 - 3x + 1) - (x^2 - 5x + 6)$.`,
          answer: "3x^2 + 2x - 5",
          simplified: true,
          expanded: true,
          explain: md`Flip the signs: $4x^2 - 3x + 1 - x^2 + 5x - 6$. Combine: $3x^2 + 2x - 5$.`,
        },
      ],
      practice: [addPolynomials, subtractPolynomials, mixedPolynomials],
    },
    {
      id: "multiplying-polynomials",
      title: "Multiplying polynomials",
      summary: "Every term times every term: the distributive property, pictured as an area grid.",
      blocks: [
        {
          kind: "text",
          body: md`You already have both tools for multiplying polynomials. The exponent rules multiply single terms: $(3x^2)(4x^5) = 12x^7$. The distributive property spreads a multiplication across a sum. Multiplying polynomials is these two, used over and over.`,
        },
        {
          kind: "why",
          title: "A monomial times a polynomial",
          body: md`The distributive property, $a(b + c + d) = ab + ac + ad$, says the outside term multiplies **each** term inside:

$$2x(3x^2 - 4x + 5) = (2x)(3x^2) + (2x)(-4x) + (2x)(5) = 6x^3 - 8x^2 + 10x.$$

Each of those small products is a job for the product rule.`,
        },
        {
          kind: "example",
          title: "Distributing a negative monomial",
          problem: md`Multiply $-3x^2(2x^2 - x + 4)$.`,
          steps: [
            { math: md`(-3x^2)(2x^2) + (-3x^2)(-x) + (-3x^2)(4)`, note: md`The outside term, sign included, multiplies every term inside.` },
            { math: md`-6x^4 + 3x^3 - 12x^2`, note: md`Multiply the numbers and add the exponents. $(-3)(-1) = 3$, so the middle term is positive.` },
          ],
        },
        {
          kind: "why",
          title: "Two binomials: distribute twice",
          body: md`In $(x + 3)(x + 5)$, treat $(x + 5)$ as a single number for a moment and distribute it over $x + 3$:

$$(x + 3)(x + 5) = x(x + 5) + 3(x + 5).$$

Now distribute again: $x^2 + 5x + 3x + 15 = x^2 + 8x + 15$.

As a picture: a rectangle $x + 3$ tall and $x + 5$ wide has area $(x + 3)(x + 5)$. Cut it with one line across and one line down, and you get four smaller rectangles, with areas $x^2$, $5x$, $3x$ and $15$. Cutting doesn't change the total area, so the four pieces add up to the product. It is the Unit 1 area model, cut in both directions.`,
        },
        {
          kind: "text",
          body: md`**The grid (box) method** writes that picture as a table. One factor's terms go along the top, the other's down the side, and each box holds the product of its row and column:

$$\begin{array}{c|cc} \times & x & 5 \\ \hline x & x^2 & 5x \\ 3 & 3x & 15 \end{array}$$

Add up the boxes: $x^2 + 5x + 3x + 15 = x^2 + 8x + 15$. Like terms often sit on a diagonal.`,
        },
        {
          kind: "key",
          title: "Multiplying polynomials",
          body: md`Multiply **every term of the first** by **every term of the second**, then combine like terms.

A binomial times a binomial makes $2 \cdot 2 = 4$ products; a binomial times a trinomial makes $2 \cdot 3 = 6$. Counting them is a good way to know you haven't skipped one. (You may hear "FOIL", for First, Outer, Inner, Last. It is a name for the four products in the $2 \times 2$ case only; the grid works for any size.)`,
        },
        {
          kind: "example",
          title: "Two binomials with a negative",
          problem: md`Multiply $(2x - 3)(x + 4)$.`,
          steps: [
            { math: md`(2x)(x) + (2x)(4) + (-3)(x) + (-3)(4)`, note: md`Four products. The $-3$ keeps its sign.` },
            { math: md`2x^2 + 8x - 3x - 12`, note: "Multiply each pair." },
            { math: md`2x^2 + 5x - 12`, note: "The two x-terms are like terms: combine them." },
          ],
        },
        {
          kind: "example",
          title: "A binomial times a trinomial",
          problem: md`Multiply $(x + 2)(x^2 - 3x + 1)$.`,
          steps: [
            { math: md`x(x^2 - 3x + 1) + 2(x^2 - 3x + 1)`, note: "Distribute the trinomial over the binomial." },
            { math: md`x^3 - 3x^2 + x + 2x^2 - 6x + 2`, note: "Six products." },
            { math: md`x^3 - x^2 - 5x + 2`, note: md`Combine: $-3x^2 + 2x^2 = -x^2$ and $x - 6x = -5x$.` },
          ],
        },
        {
          kind: "text",
          body: md`**Check by substituting**, as in Unit 1. With $x = 1$: $(2 \cdot 1 - 3)(1 + 4) = -5$, and $2 + 5 - 12 = -5$. The two forms agree, as they must, because they are the same polynomial. The graph below makes the same point: the factored form and the multiplied-out form draw one curve.`,
        },
        {
          kind: "plot",
          x: [-4, 5],
          y: [-4, 8],
          curves: [
            { expr: "(x + 1)(x - 2)", label: "y = (x + 1)(x - 2)", color: 1 },
            { expr: "x^2 - x - 2", label: "y = x^2 - x - 2", color: 2, dashed: true },
          ],
          caption: "Two ways of writing one polynomial give exactly the same graph.",
        },
        {
          kind: "check",
          prompt: md`Multiply $(x + 4)(x - 2)$.`,
          answer: "x^2 + 2x - 8",
          simplified: true,
          expanded: true,
          explain: md`Four products: $x^2 - 2x + 4x - 8$. Combine the middle: $x^2 + 2x - 8$.`,
        },
        {
          kind: "check",
          prompt: md`Multiply $(3x + 1)(2x - 5)$.`,
          answer: "6x^2 - 13x - 5",
          simplified: true,
          expanded: true,
          explain: md`$6x^2 - 15x + 2x - 5 = 6x^2 - 13x - 5$.`,
        },
      ],
      practice: [monomialTimesPolynomial, binomialTimesBinomial, largerProducts],
    },
    {
      id: "special-products",
      title: "Special products",
      summary: "Squares of binomials and the difference of squares, seen geometrically.",
      blocks: [
        {
          kind: "text",
          body: md`A few products come up so often that it pays to know their results on sight. They aren't new rules: each is an ordinary product of binomials that turns out to have a tidy shape. Knowing them makes multiplying faster now, and factoring (next unit) much easier.`,
        },
        {
          kind: "why",
          title: "The square of a sum, as a picture",
          body: md`$(a + b)^2$ is the area of a square with side $a + b$. Cut each side into a piece of length $a$ and a piece of length $b$, and draw the cuts across the square. You get four pieces:

- an $a$ by $a$ square, area $a^2$,
- a $b$ by $b$ square, area $b^2$,
- two $a$ by $b$ rectangles, each of area $ab$.

$$\begin{array}{c|cc} \times & a & b \\ \hline a & a^2 & ab \\ b & ab & b^2 \end{array}$$

So $(a + b)^2 = a^2 + 2ab + b^2$. The algebra agrees: $(a + b)(a + b) = a^2 + ab + ba + b^2$.`,
        },
        {
          kind: "why",
          title: "Why (a + b)² is not a² + b²",
          body: md`Try numbers: $(3 + 4)^2 = 7^2 = 49$, but $3^2 + 4^2 = 9 + 16 = 25$. The missing $24$ is $2 \cdot 3 \cdot 4$: the two rectangles in the picture.

The power-of-a-product rule $(ab)^2 = a^2 b^2$ is about products. A sum is a different thing, and squaring it produces the cross terms. Forgetting $2ab$ is the single most common algebra mistake, so watch for it.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-2, 14],
          params: [{ name: "b", label: "b", min: -3, max: 3, step: 1, value: 2 }],
          curves: [
            { expr: "(x + b)^2", label: "y = (x + b)^2", color: 1 },
            { expr: "x^2 + b^2", label: "y = x^2 + b^2", color: 4, dashed: true },
          ],
          caption: "The two curves only meet at x = 0, where the missing 2bx is zero. Set b = 0 and the difference disappears.",
        },
        {
          kind: "why",
          title: "The square of a difference",
          body: md`Write $a - b$ as $a + (-b)$ and use the pattern you just found:

$$(a - b)^2 = a^2 + 2a(-b) + (-b)^2 = a^2 - 2ab + b^2.$$

The middle term turns negative. The last term stays positive, because $(-b)^2 = b^2$.`,
        },
        {
          kind: "why",
          title: "A sum times a difference",
          body: md`Multiply $(a + b)(a - b)$ term by term:

$$(a + b)(a - b) = a^2 - ab + ba - b^2 = a^2 - b^2.$$

The two middle products are $-ab$ and $+ab$, and they cancel. What's left is a **difference of squares**. Check with numbers: $(5 + 2)(5 - 2) = 7 \cdot 3 = 21$, and $25 - 4 = 21$.`,
        },
        {
          kind: "key",
          title: "Special products",
          body: md`- $(a + b)^2 = a^2 + 2ab + b^2$
- $(a - b)^2 = a^2 - 2ab + b^2$
- $(a + b)(a - b) = a^2 - b^2$

Here $a$ and $b$ can be any terms: $3x$, $5$, $2y$, even $x^2$.`,
        },
        {
          kind: "example",
          title: "Squaring a binomial",
          problem: md`Expand $(3x - 5)^2$.`,
          steps: [
            { math: md`(3x)^2 - 2(3x)(5) + 5^2`, note: md`$(a - b)^2$ with $a = 3x$ and $b = 5$.` },
            { math: md`9x^2 - 30x + 25`, note: md`$(3x)^2 = 9x^2$ by the power-of-a-product rule.` },
          ],
        },
        {
          kind: "example",
          title: "A difference of squares",
          problem: md`Multiply $(2x + 7)(2x - 7)$.`,
          steps: [
            { math: md`(2x)^2 - 7^2`, note: md`Sum times difference of the same two terms, $a = 2x$ and $b = 7$.` },
            { math: md`4x^2 - 49`, note: md`No middle term: $-14x$ and $+14x$ cancelled.` },
          ],
        },
        {
          kind: "example",
          title: "Mental arithmetic",
          problem: md`Compute $49 \cdot 51$ and $31^2$ without a calculator.`,
          steps: [
            { math: md`49 \cdot 51 = (50 - 1)(50 + 1) = 2500 - 1 = 2499`, note: "Both numbers are 1 away from 50: a difference of squares." },
            { math: md`31^2 = (30 + 1)^2 = 900 + 60 + 1 = 961`, note: md`$30^2 = 900$, $2 \cdot 30 \cdot 1 = 60$, $1^2 = 1$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Expand $(x + 6)^2$.`,
          answer: "x^2 + 12x + 36",
          simplified: true,
          expanded: true,
          explain: md`$x^2 + 2 \cdot 6 \cdot x + 6^2 = x^2 + 12x + 36$. Not $x^2 + 36$: the middle term is $12x$.`,
        },
        {
          kind: "check",
          prompt: md`Use a special product to compute $21 \cdot 19$.`,
          answer: "399",
          simplified: true,
          explain: md`$(20 + 1)(20 - 1) = 400 - 1 = 399$.`,
        },
      ],
      practice: [squareOfBinomial, sumTimesDifference, specialMentalMath],
    },
  ],
};
