import { gcd, paren, poly, signed, type Rng } from "../../math/random";
import { md, slug, type Generator, type Problem, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** v to the power p: "", "x", "x^3". */
const pw = (v: string, p: number) => (p === 0 || !v ? "" : p === 1 ? v : `${v}^${p}`);
/** ax + b (or ax + by when w is given). */
const lin = (a: number, b: number, v = "x", w = "") => poly([[a, v], [b, w]]);
const bin = (a: number, b: number, v = "x", w = "") => `(${lin(a, b, v, w)})`;
/** "+ 3" or "- 3", always showing the number, for "+ 3(x + 2)". */
const plusMinus = (n: number, rest = "") => `${n < 0 ? "-" : "+"} ${poly([[Math.abs(n), rest]])}`;
const isSquare = (n: number) => n >= 0 && Math.round(Math.sqrt(n)) ** 2 === n;

function coprimeTo(r: Rng, lo: number, hi: number, m: number): number {
  for (;;) {
    const n = r.nonzero(lo, hi);
    if (gcd(n, m) === 1) return n;
  }
}

/** The positive factor pairs of |c|, as markup: "$1 \cdot 12$, $2 \cdot 6$, $3 \cdot 4$". */
function pairList(c: number): string {
  const n = Math.abs(c);
  const out: string[] = [];
  for (let i = 1; i * i <= n; i++) if (n % i === 0) out.push(md`$${i} \cdot ${n / i}$`);
  return out.join(", ");
}

/** Every sum p + q over integer pairs with pq = c, sorted. */
function pairSums(c: number): number[] {
  const n = Math.abs(c);
  const sums = new Set<number>();
  for (let i = 1; i * i <= n; i++) {
    if (n % i !== 0) continue;
    const j = n / i;
    if (c > 0) [i + j, -(i + j)].forEach((s) => sums.add(s));
    else [j - i, i - j].forEach((s) => sums.add(s));
  }
  return [...sums].sort((a, b) => a - b);
}

const PRIME = [
  "prime",
  "it is prime",
  "its prime",
  "not factorable",
  "unfactorable",
  "does not factor",
  "doesnt factor",
  "cannot be factored",
  "cant be factored",
  "cannot factor",
  "cant factor",
  "irreducible",
];

/** A factoring job: the expression, its factored form, and the working. */
interface Built {
  expr: string;
  answer: string;
  steps: Step[];
  hint: string;
  /** For one-variable quadratics: coefficients of x^2, x, 1. */
  coefs: [number, number, number];
}

const toProblem = (b: Built, suffix = ""): Problem => ({
  prompt: md`Factor $${b.expr}$.${suffix}`,
  answer: b.answer,
  factored: true,
  hint: b.hint,
  solution: b.steps,
});

// ── Building blocks shared by several lessons ──────────────────────────────

/** x^2 + (p+q)x + pq = (x + p)(x + q), or with a second variable w: x^2 + (p+q)xw + pqw^2. */
function monic(p: number, q: number, v = "x", w = ""): Built {
  const b = p + q;
  const c = p * q;
  const vw = v + w;
  const w2 = pw(w, 2);
  const expr = poly([[1, pw(v, 2)], [b, vw], [c, w2]]);
  const answer = `${bin(1, p, v, w)}${bin(1, q, v, w)}`;
  const signNote =
    c > 0
      ? md`The product $${c}$ is positive, so the two numbers have the same sign. Their sum $${b}$ is ${b > 0 ? "positive, so both are positive" : "negative, so both are negative"}.`
      : md`The product $${c}$ is negative, so one number is positive and one is negative. The one with the bigger size takes the sign of the sum, $${b}$.`;
  return {
    expr,
    answer,
    coefs: [1, b, c],
    hint: w
      ? md`Treat it like $${v}^2 + b${v} + c$ with $${w}$ riding along: find two numbers that multiply to $${c}$ and add to $${b}$.`
      : md`Find two numbers that multiply to $${c}$ and add to $${b}$.`,
    steps: [
      { math: md`pq = ${c}, \quad p + q = ${b}`, note: signNote },
      {
        math: md`${p} \cdot ${paren(q)} = ${c}, \quad ${p} + ${paren(q)} = ${b}`,
        note: md`Factor pairs of ${Math.abs(c)}: ${pairList(c)}. With the right signs, only $${p}$ and $${q}$ add to $${b}$.`,
      },
      { math: answer, note: w ? md`Each number goes into its own factor, attached to $${w}$.` : "Each number goes into its own factor." },
      { math: md`${poly([[1, pw(v, 2)], [q, vw], [p, vw], [c, w2]])} = ${expr} \;\checkmark`, note: "Multiply back out to check." },
    ],
  };
}

/** (kx + l)(mx + n) by the ac method. Needs m, k > 0, gcd(k, l) = 1, gcd(m, n) = 1. */
function acMethod(m: number, n: number, k: number, l: number, v = "x", w = ""): Built {
  const a = m * k;
  const b = m * l + n * k;
  const c = n * l;
  const [s1, s2] = [m * l, n * k];
  const vw = v + w;
  const w2 = pw(w, 2);
  const expr = poly([[a, pw(v, 2)], [b, vw], [c, w2]]);
  const inner = lin(k, l, v, w);
  const answer = `(${inner})${bin(m, n, v, w)}`;
  const first = poly([[m, v]]);
  const second = poly([[n, w]]);
  return {
    expr,
    answer,
    coefs: [a, b, c],
    hint: md`Compute $ac = ${a} \cdot ${paren(c)}$. Find two numbers with that product and sum $${b}$, split the middle term into them, then group.`,
    steps: [
      { math: md`ac = ${a} \cdot ${paren(c)} = ${a * c}`, note: "Multiply the first and last coefficients." },
      { math: md`${s1} \cdot ${paren(s2)} = ${a * c}, \quad ${s1} + ${paren(s2)} = ${b}`, note: md`Two numbers with product $${a * c}$ and sum $${b}$.` },
      {
        math: poly([[a, pw(v, 2)], [s1, vw], [s2, vw], [c, w2]]),
        note: md`Split $${poly([[b, vw]])}$ into $${poly([[s1, vw]])}$ and $${poly([[s2, vw]])}$. The value hasn't changed.`,
      },
      {
        math: md`${first}(${inner}) ${plusMinus(n, w)}(${inner})`,
        note: md`Take $${first}$ out of the first pair and $${second === "-1" ? "-1" : second}$ out of the second.${n < 0 ? " Taking out the negative makes the binomials match." : ""} Both leave $(${inner})$.`,
      },
      { math: answer, note: "Pull out the common binomial. Multiply back out to check." },
    ],
  };
}

/** (kx)^2 - (n w)^2, or reversed: (n w)^2 - (kx)^2. */
function diffSquares(k: number, n: number, opts: { v?: string; w?: string; reversed?: boolean } = {}): Built {
  const v = opts.v ?? "x";
  const w = opts.w ?? "";
  const A = poly([[k, v]]);
  const B = poly([[n, w]]);
  const sqA = k === 1 ? `${A}^2` : `(${A})^2`;
  const sqB = w === "" || n === 1 ? `${B}^2` : `(${B})^2`;
  const A2 = poly([[k * k, pw(v, 2)]]);
  const B2 = poly([[n * n, pw(w, 2)]]);
  const expr = opts.reversed ? `${B2} - ${A2}` : `${A2} - ${B2}`;
  const [P, Q] = opts.reversed ? [B, A] : [A, B];
  const answer = `(${P} + ${Q})(${P} - ${Q})`;
  const shows: string[] = [];
  if (k > 1) shows.push(md`$${A2} = ${sqA}$`);
  if (!(n === 1 && w)) shows.push(md`$${B2} = ${sqB}$`);
  return {
    expr,
    answer,
    coefs: [k * k, 0, -n * n],
    hint: md`Write both terms as squares, then use $a^2 - b^2 = (a + b)(a - b)$.`,
    steps: [
      {
        math: opts.reversed ? `${sqB} - ${sqA}` : `${sqA} - ${sqB}`,
        note: md`Two perfect squares with a minus between them.${shows.length ? ` ${shows.join(" and ")}.` : ""}`,
      },
      { math: answer, note: md`$a^2 - b^2 = (a + b)(a - b)$ with $a = ${P}$ and $b = ${Q}$. Multiplying back, the middle terms cancel.` },
    ],
  };
}

/** (kx + s n w)^2 written out as a trinomial. */
function perfectSquare(k: number, n: number, s: 1 | -1, v = "x", w = ""): Built {
  const A = poly([[k, v]]);
  const B = poly([[n, w]]);
  const A2 = poly([[k * k, pw(v, 2)]]);
  const B2 = poly([[n * n, pw(w, 2)]]);
  const sqA = k === 1 ? `${A}^2` : `(${A})^2`;
  const sqB = w === "" || n === 1 ? `${B}^2` : `(${B})^2`;
  const mid = poly([[2 * k * n, v + w]]);
  const expr = poly([[k * k, pw(v, 2)], [2 * k * n * s, v + w], [n * n, pw(w, 2)]]);
  const answer = `(${A} ${s < 0 ? "-" : "+"} ${B})^2`;
  const ends = [k > 1 ? `${A2} = ${sqA}` : A2, n === 1 && w ? B2 : `${B2} = ${sqB}`].join(md`, \quad `);
  return {
    expr,
    answer,
    coefs: [k * k, 2 * k * n * s, n * n],
    hint: md`Are both ends perfect squares? If so, is the middle term twice the product of the things being squared?`,
    steps: [
      { math: ends, note: "Both ends are perfect squares, and the last one is positive." },
      {
        math: md`2 \cdot ${A} \cdot ${B} = ${mid}`,
        note: s < 0 ? md`The middle term is $-${mid}$, minus twice the product. It's a perfect square.` : md`The middle term is $${mid}$, exactly twice the product. It's a perfect square.`,
      },
      { math: answer, note: md`$a^2 ${s < 0 ? "-" : "+"} 2ab + b^2 = (a ${s < 0 ? "-" : "+"} b)^2$ with $a = ${A}$ and $b = ${B}$.` },
    ],
  };
}

/** (ax + b)(x^2 + q) written out as four terms, factored by grouping. Needs gcd(a, b) = 1. */
function groupCubic(a: number, b: number, q: number): Built {
  const inner = lin(a, b);
  const quad = poly([[1, "x^2"], [q, ""]]);
  const ans = `(${inner})(${quad})`;
  return {
    expr: poly([[a, "x^3"], [b, "x^2"], [a * q, "x"], [b * q, ""]]),
    answer: ans,
    coefs: [0, 0, 0],
    hint: md`Group the first two terms and the last two. Take the GCF out of each pair so the same binomial is left in both.`,
    steps: [
      { math: md`(${poly([[a, "x^3"], [b, "x^2"]])}) + (${poly([[a * q, "x"], [b * q, ""]])})`, note: "No GCF for all four terms. Group them in pairs." },
      {
        math: md`x^2(${inner}) ${plusMinus(q)}(${inner})`,
        note: md`Take $x^2$ out of the first pair and $${q}$ out of the second.${q < 0 ? " Taking out the negative makes the binomials match." : ""}`,
      },
      { math: ans, note: md`$(${inner})$ is now a common factor. Pull it out.` },
    ],
  };
}

// ── Lesson 1: Greatest common factor ───────────────────────────────────────

const gcfOut: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const g = r.int(2, 9);
    const b = r.int(1, 7);
    const c = coprimeTo(r, -9, 9, b);
    const ans = `${g}${bin(b, c)}`;
    return {
      prompt: md`Factor $${lin(g * b, g * c)}$.`,
      answer: ans,
      factored: true,
      hint: md`Find the largest number that divides both $${g * b}$ and $${Math.abs(g * c)}$. Divide each term by it.`,
      solution: [
        { math: md`\text{GCF}(${g * b}, ${Math.abs(g * c)}) = ${g}`, note: "The largest number that divides both coefficients." },
        { math: md`\frac{${poly([[g * b, "x"]])}}{${g}} = ${poly([[b, "x"]])}, \qquad \frac{${g * c}}{${g}} = ${c}`, note: "Divide each term by the GCF." },
        { math: ans, note: md`GCF in front, what's left inside. Check: $${g} \cdot ${poly([[b, "x"]])} = ${poly([[g * b, "x"]])}$ and $${g} \cdot ${paren(c)} = ${g * c}$.` },
      ],
    };
  }
  if (kind === 1) {
    const g = r.int(2, 6);
    const p = r.int(1, 3);
    const d = r.int(1, 2);
    const b = r.int(1, 5);
    let c = coprimeTo(r, -7, 7, b);
    // Keep the inner part prime: x^2 - 4 left inside would still factor.
    while (d === 2 && c < 0 && isSquare(-c * b)) c = coprimeTo(r, -7, 7, b);
    const G = poly([[g, pw("x", p)]]);
    const T1 = poly([[g * b, pw("x", p + d)]]);
    const T2 = poly([[g * c, pw("x", p)]]);
    const inner = poly([[b, pw("x", d)], [c, ""]]);
    const ans = `${G}(${inner})`;
    return {
      prompt: md`Factor $${poly([[g * b, pw("x", p + d)], [g * c, pw("x", p)]])}$.`,
      answer: ans,
      factored: true,
      hint: md`The GCF has a number part and an $x$ part. For the $x$ part, take the **smaller** power.`,
      solution: [
        { math: md`\text{GCF} = ${G}`, note: md`$${g}$ is the largest number dividing $${g * b}$ and $${Math.abs(g * c)}$. Both terms contain $x$, and the smaller power is $${pw("x", p)}$.` },
        { math: md`\frac{${T1}}{${G}} = ${poly([[b, pw("x", d)]])}, \qquad \frac{${T2}}{${G}} = ${c}`, note: "Divide each term by the GCF. The exponents subtract." },
        { math: ans, note: "GCF in front, the quotients inside. Multiply back out to check." },
      ],
    };
  }
  // Three terms, with a quadratic left inside that doesn't factor further.
  for (;;) {
    const g = r.int(2, 5);
    const b = r.int(1, 4);
    const c = r.nonzero(-6, 6);
    const d = r.nonzero(-6, 6);
    if (gcd(b, gcd(c, d)) !== 1 || isSquare(c * c - 4 * b * d)) continue;
    const G = poly([[g, "x"]]);
    const inner = poly([[b, "x^2"], [c, "x"], [d, ""]]);
    const ans = `${G}(${inner})`;
    return {
      prompt: md`Factor $${poly([[g * b, "x^3"], [g * c, "x^2"], [g * d, "x"]])}$.`,
      answer: ans,
      factored: true,
      hint: md`Every term has a factor of $x$. What's the largest number that divides all three coefficients?`,
      solution: [
        { math: md`\text{GCF} = ${G}`, note: md`$${g}$ divides $${g * b}$, $${Math.abs(g * c)}$ and $${Math.abs(g * d)}$. The smallest power of $x$ is $x$ itself.` },
        {
          math: md`\frac{${poly([[g * b, "x^3"]])}}{${G}} = ${poly([[b, "x^2"]])}, \quad \frac{${poly([[g * c, "x^2"]])}}{${G}} = ${poly([[c, "x"]])}, \quad \frac{${poly([[g * d, "x"]])}}{${G}} = ${d}`,
          note: Math.abs(d) === 1 ? md`Divide each term by the GCF. The last one leaves $${d}$, not 0: keep it.` : "Divide each term by the GCF.",
        },
        { math: ans, note: "GCF in front, the quotients inside." },
      ],
    };
  }
};

const gcfMore: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    // Two variables.
    const g = r.int(2, 6);
    const i = r.int(1, 2);
    const j = r.int(1, 2);
    const b = r.int(1, 5);
    const c = coprimeTo(r, -6, 6, b);
    const G = poly([[g, "xy"]]);
    const T1 = poly([[g * b, `${pw("x", i + 1)}y`]]);
    const T2 = poly([[g * c, `x${pw("y", j + 1)}`]]);
    const inner = poly([[b, pw("x", i)], [c, pw("y", j)]]);
    const ans = `${G}(${inner})`;
    return {
      prompt: md`Factor $${poly([[g * b, `${pw("x", i + 1)}y`], [g * c, `x${pw("y", j + 1)}`]])}$.`,
      answer: ans,
      factored: true,
      hint: md`Handle each variable separately: take the smaller power of $x$ and the smaller power of $y$.`,
      solution: [
        { math: md`\text{GCF} = ${G}`, note: md`$${g}$ divides both coefficients. The smaller power of $x$ is $x$, and the smaller power of $y$ is $y$.` },
        { math: md`\frac{${T1}}{${G}} = ${poly([[b, pw("x", i)]])}, \qquad \frac{${T2}}{${G}} = ${poly([[c, pw("y", j)]])}`, note: "Divide each term by the GCF." },
        { math: ans, note: "GCF in front, the quotients inside." },
      ],
    };
  }
  if (kind === 1) {
    // Negative leading term, two terms.
    const g = r.int(2, 6);
    const e = r.int(0, 1);
    const b = r.int(1, 5);
    const c = coprimeTo(r, 1, 7, b);
    const G = poly([[-g, pw("x", e)]]);
    const inner = poly([[b, pw("x", 1)], [-c, ""]]);
    const ans = `${G}(${inner})`;
    return {
      prompt: md`Factor $${poly([[-g * b, pw("x", e + 1)], [g * c, pw("x", e)]])}$, taking out a negative GCF.`,
      answer: ans,
      factored: true,
      hint: md`Take out $${G}$. Dividing by a negative flips the sign of each term.`,
      solution: [
        { math: md`\text{GCF} = ${G}`, note: "The first term is negative, so take out the negative of the GCF." },
        {
          math: md`\frac{${poly([[-g * b, pw("x", e + 1)]])}}{${G}} = ${poly([[b, "x"]])}, \qquad \frac{${poly([[g * c, pw("x", e)]])}}{${G}} = ${-c}`,
          note: "Divide each term by the GCF. Each sign flips.",
        },
        { math: ans, note: md`Check: $${G} \cdot ${poly([[b, "x"]])}$ gives back the first term, and $${G} \cdot (${-c})$ gives back the second.` },
      ],
    };
  }
  // Negative leading term, three terms.
  for (;;) {
    const g = r.int(2, 5);
    const b = r.nonzero(-6, 6);
    const c = r.nonzero(-7, 7);
    if (isSquare(b * b - 4 * c)) continue;
    const inner = poly([[1, "x^2"], [b, "x"], [c, ""]]);
    const ans = `${-g}(${inner})`;
    return {
      prompt: md`Factor $${poly([[-g, "x^2"], [-g * b, "x"], [-g * c, ""]])}$, taking out a negative GCF.`,
      answer: ans,
      factored: true,
      hint: md`Take out $${-g}$. Every sign inside the parentheses comes out opposite to the original.`,
      solution: [
        { math: md`\text{GCF} = ${-g}`, note: md`$${g}$ divides every coefficient, and the first term is negative, so use $${-g}$.` },
        { math: md`\frac{${-g}x^2}{${-g}} = x^2, \quad \frac{${-g * b}x}{${-g}} = ${poly([[b, "x"]])}, \quad \frac{${-g * c}}{${-g}} = ${c}`, note: "Divide each term by the GCF. Each sign flips." },
        { math: ans, note: "GCF in front, the quotients inside." },
      ],
    };
  }
};

const commonBinomial: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.int(1, 6);
    const b = coprimeTo(r, -9, 9, a);
    const p = r.nonzero(-9, 9);
    const B = bin(1, p);
    const ans = `${B}${bin(a, b)}`;
    return {
      prompt: md`Factor $${poly([[a, "x"]])}${B} ${Math.abs(b) === 1 ? (b < 0 ? "- " : "+ ") : plusMinus(b)}${B}$.`,
      answer: ans,
      factored: true,
      hint: md`Both terms contain the same binomial, $${B}$. Treat it as a single thing and pull it out.`,
      solution: [
        { math: md`${poly([[a, "x"]])} \cdot u ${plusMinus(b)} \cdot u, \quad u = ${B}`, note: "Both terms share the binomial. Give it a short name if that helps." },
        { math: md`(${lin(a, b)}) \cdot u`, note: "The distributive property, backwards." },
        { math: ans, note: "Put the binomial back. Either order of the factors is fine." },
      ],
    };
  }
  if (kind === 1 || kind === 3) {
    const a = kind === 1 ? 1 : r.int(2, 4);
    const b = coprimeTo(r, -7, 7, a);
    const q = r.pick([1, 2, 3, 4, 5, 6, 7, -2, -3, -5, -6, -7]);
    const built = groupCubic(a, b, q);
    return toProblem(built, " Use grouping.");
  }
  // (x + p)(y + q) = xy + qx + py + pq
  const p = r.nonzero(-7, 7);
  const q = r.nonzero(-7, 7);
  const yq = lin(1, q, "y");
  const ans = `(${yq})${bin(1, p)}`;
  return {
    prompt: md`Factor $${poly([[1, "xy"], [q, "x"], [p, "y"], [p * q, ""]])}$. Use grouping.`,
    answer: ans,
    factored: true,
    hint: md`Group the first two terms and the last two. Each pair should leave $(${yq})$.`,
    solution: [
      { math: md`(${poly([[1, "xy"], [q, "x"]])}) + (${poly([[p, "y"], [p * q, ""]])})`, note: "Group in pairs." },
      {
        math: md`x(${yq}) ${plusMinus(p)}(${yq})`,
        note: md`Take $x$ out of the first pair and $${p}$ out of the second.${p < 0 ? " The negative makes the binomials match." : ""}`,
      },
      { math: ans, note: md`Pull out the common binomial $(${yq})$.` },
    ],
  };
};

// ── Lesson 2: Factoring trinomials ─────────────────────────────────────────

function monicPair(r: Rng, kind: number, max = 9): [number, number] {
  for (;;) {
    let p: number;
    let q: number;
    if (kind === 0) [p, q] = [r.int(1, max), r.int(1, max)];
    else if (kind === 1) [p, q] = [-r.int(1, max), -r.int(1, max)];
    else [p, q] = [r.int(1, max), -r.int(1, max)];
    if (p !== q && p !== -q) return Math.abs(p) <= Math.abs(q) ? [p, q] : [q, p];
  }
}

const monicTrinomial: Generator = (r) => {
  const [p, q] = monicPair(r, r.int(0, 2));
  return toProblem(monic(p, q));
};

function acParams(r: Rng, mixed: boolean): [number, number, number, number] {
  for (;;) {
    const m = r.int(2, 5);
    const k = r.int(1, 3);
    const n = mixed ? coprimeTo(r, -6, 6, m) : coprimeTo(r, 1, 6, m);
    const l = mixed ? coprimeTo(r, -6, 6, k) : coprimeTo(r, 1, 6, k);
    // b = 0 is a difference of squares, and (kx + l) = (mx + n) a perfect square: both have their own lesson.
    if (m * l + n * k === 0 || (m === k && n === l) || Math.abs(m * k * n * l) > 72) continue;
    return [m, n, k, l];
  }
}

const acTrinomial: Generator = (r) => {
  const [m, n, k, l] = acParams(r, r.next() < 0.6);
  return toProblem(acMethod(m, n, k, l));
};

const trinomialMore: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [p, q] = monicPair(r, r.int(0, 2), 7);
    return toProblem(monic(p, q, "x", "y"));
  }
  if (kind === 1) {
    const [p, q] = monicPair(r, r.int(0, 2), 7);
    const inner = monic(p, q);
    const [, b, c] = inner.coefs;
    return {
      prompt: md`Factor $${poly([[-1, "x^2"], [-b, "x"], [-c, ""]])}$.`,
      answer: `-${inner.answer}`,
      factored: true,
      hint: md`Take out $-1$ first so the $x^2$ term is positive. Then find two numbers that multiply to $${c}$ and add to $${b}$.`,
      solution: [
        { math: md`-(${inner.expr})`, note: md`Take out $-1$. Every sign inside flips.` },
        ...inner.steps.slice(0, 2),
        { math: md`-${inner.answer}`, note: "Each number goes into its own factor, and the $-1$ stays in front." },
      ],
    };
  }
  const [m, n, k, l] = acParams(r, true);
  return toProblem(acMethod(m, n, k, l, "x", "y"));
};

// ── Lesson 3: Difference of squares and perfect squares ────────────────────

const differenceOfSquares: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) return toProblem(diffSquares(1, r.int(1, 12)));
  if (kind === 1) {
    const k = r.int(2, 5);
    return toProblem(diffSquares(k, coprimeTo(r, 1, 9, k)));
  }
  if (kind === 2) {
    const k = r.pick([1, 1, 2, 3]);
    return toProblem(diffSquares(k, coprimeTo(r, 1, 10, k), { reversed: true }));
  }
  const k = r.int(1, 4);
  return toProblem(diffSquares(k, coprimeTo(r, 1, 7, k), { w: "y" }));
};

const perfectSquareTrinomial: Generator = (r) => {
  const kind = r.int(0, 2);
  const s = r.sign();
  if (kind === 0) return toProblem(perfectSquare(1, r.int(1, 9), s));
  if (kind === 1) {
    const k = r.int(2, 4);
    return toProblem(perfectSquare(k, coprimeTo(r, 1, 7, k), s));
  }
  return toProblem(perfectSquare(1, r.int(1, 6), s, "x", "y"));
};

/** x^2 + bx + c with no integer pair, as a "prime" problem. */
function primeTrinomial(b: number, c: number): Problem {
  const sums = pairSums(c);
  return {
    prompt: md`Factor $${poly([[1, "x^2"], [b, "x"], [c, ""]])}$. If it can't be factored, type **prime**.`,
    accept: PRIME,
    hint: md`List the factor pairs of $${c}$ and their sums. Is $${b}$ one of the sums?`,
    solution: [
      { math: md`pq = ${c}, \quad p + q = ${b}`, note: "We'd need two integers with this product and sum." },
      { math: md`\text{possible sums: } ${sums.join(", ")}`, note: md`These are the sums of every integer pair with product $${c}$. None of them is $${b}$.` },
      { math: md`\text{prime}`, note: "No pair works, so it can't be factored using integers." },
    ],
  };
}

const recognizePattern: Generator = (r) => {
  const suffix = " If it can't be factored, type **prime**.";
  const kind = r.int(0, 4);
  if (kind === 0) {
    // Square ends, but not a perfect square: factors the ordinary way.
    const [p, q] = r.pick([[1, 4], [1, 9], [2, 8], [1, 16], [4, 9], [3, 12], [1, 25], [2, 18]] as const);
    const s = r.sign();
    const built = monic(s * p, s * q);
    const n = Math.sqrt(p * q);
    built.hint = md`The ends are squares, but test the middle: is it $2 \cdot x \cdot ${n}$? If not, use product and sum.`;
    built.steps.unshift({
      math: md`2 \cdot x \cdot ${n} = ${2 * n}x \ne ${Math.abs(s * (p + q))}x`,
      note: md`Both ends are squares, but the middle isn't twice the product, so this is **not** a perfect square. Factor it the ordinary way.`,
    });
    return toProblem(built, suffix);
  }
  if (kind === 1) {
    const k = r.int(1, 3);
    return toProblem(perfectSquare(k, coprimeTo(r, 1, 6, k), r.sign()), suffix);
  }
  if (kind === 2) {
    const k = r.int(1, 4);
    return toProblem(diffSquares(k, coprimeTo(r, 1, 9, k)), suffix);
  }
  if (kind === 3) {
    // Sum of squares.
    const n = r.int(1, 9);
    return {
      prompt: md`Factor $x^2 + ${n * n}$.${suffix}`,
      accept: PRIME,
      hint: md`Two terms with a **plus** between them. Does the difference-of-squares pattern apply?`,
      solution: [
        { math: md`x^2 + ${n}^2`, note: "A sum of two squares, not a difference." },
        { math: md`pq = ${n * n}, \quad p + q = 0`, note: md`Think of it as $x^2 + 0x + ${n * n}$. A sum of 0 needs opposites, like $${n}$ and $-${n}$, but opposites have a negative product.` },
        { math: md`\text{prime}`, note: "No pair works, so a sum of squares can't be factored using integers." },
      ],
    };
  }
  // Square ends with a middle that matches nothing: prime.
  for (;;) {
    const n = r.int(2, 5);
    const b = r.nonzero(-10, 10);
    if (pairSums(n * n).includes(b)) continue;
    return primeTrinomial(b, n * n);
  }
};

// ── Lesson 4: A factoring strategy ─────────────────────────────────────────

const STRATEGY_HINT = md`Check for a GCF, then count the terms. Two terms: difference of squares. Three: test for a perfect square, otherwise product and sum (the ac method if the first coefficient isn't 1). Four: grouping.`;

const chooseMethod: Generator = (r) => {
  const kind = r.int(0, 4);
  let built: Built;
  let note: string;
  if (kind === 0) {
    const [p, q] = monicPair(r, r.int(0, 2));
    built = monic(p, q);
    note = "Three terms, first coefficient 1, and it fails the perfect-square test: look for product and sum.";
  } else if (kind === 1) {
    const [m, n, k, l] = acParams(r, true);
    built = acMethod(m, n, k, l);
    note = md`Three terms, and the first coefficient is $${m * k}$: use the ac method.`;
  } else if (kind === 2) {
    const k = r.int(1, 5);
    built = diffSquares(k, coprimeTo(r, 1, 9, k));
    note = "Two terms, both perfect squares, with a minus: difference of squares.";
  } else if (kind === 3) {
    const k = r.int(1, 4);
    built = perfectSquare(k, coprimeTo(r, 1, 7, k), r.sign());
    note = "Three terms with square ends: test for a perfect square.";
  } else {
    const a = r.int(1, 3);
    built = groupCubic(a, coprimeTo(r, -7, 7, a), r.pick([1, 2, 3, 5, 7, -2, -3, -5, -6]));
    note = "Four terms: try grouping.";
  }
  return {
    ...toProblem(built),
    hint: STRATEGY_HINT,
    solution: [{ math: md`\text{GCF} = 1`, note: md`No common factor. ${note}` }, ...built.steps],
  };
};

/** "3", "2x", "x", "-" (for -1), "-2": the GCF as it is written in front of parentheses. */
const gcfTex = (g: number, e: number) => (g === -1 && e === 0 ? "-" : poly([[g, pw("x", e)]]));

const factorCompletely: Generator = (r) => {
  const kind = r.int(0, 4);
  let g: number;
  let e: number;
  let inner: Built;
  if (kind === 0) {
    [g, e] = [r.int(2, 5), 0];
    inner = diffSquares(1, r.int(1, 7));
  } else if (kind === 1) {
    [g, e] = [r.int(1, 3), 1];
    const [p, q] = monicPair(r, r.int(0, 2), 7);
    inner = monic(p, q);
  } else if (kind === 2) {
    [g, e] = [r.int(2, 4), 0];
    inner = perfectSquare(1, r.int(1, 6), r.sign());
  } else if (kind === 3) {
    [g, e] = [r.pick([-1, -2, -3]), 0];
    const [p, q] = monicPair(r, r.int(0, 2), 7);
    inner = monic(p, q);
  } else {
    [g, e] = [r.int(1, 3), 1];
    const k = r.int(1, 3);
    inner = diffSquares(k, coprimeTo(r, 1, 6, k));
  }
  const [A, B, C] = inner.coefs;
  const expr = poly([[g * A, pw("x", 2 + e)], [g * B, pw("x", 1 + e)], [g * C, pw("x", e)]]);
  const G = gcfTex(g, e);
  const ans = `${G}${inner.answer}`;
  return {
    prompt: md`Factor $${expr}$ completely.`,
    answer: ans,
    factored: true,
    hint: md`Take out the GCF first${g < 0 ? ", including the negative sign" : ""}. Then factor what's left, and check that no factor can be split again.`,
    solution: [
      { math: md`${G}(${inner.expr})`, note: md`The GCF is $${G === "-" ? "-1" : G}$.${g < 0 ? " Taking out a negative flips every sign inside." : ""}` },
      ...inner.steps.slice(0, -1).map((s, i) => (i === 0 ? { ...s, note: `Now factor the inside. ${s.note ?? ""}` } : s)),
      { math: ans, note: "Factor the inside and keep the GCF in front. No factor can be split further, so this is complete." },
    ],
  };
};

const multiStep: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    // k^4 x^4 - n^4 = (k^2x^2 + n^2)(kx + n)(kx - n)
    const k = r.pick([1, 1, 2]);
    const n = k === 2 ? r.pick([1, 3]) : r.int(1, 3);
    const K2 = poly([[k * k, "x^2"]]);
    const kx = poly([[k, "x"]]);
    const ans = `(${K2} + ${n * n})(${kx} + ${n})(${kx} - ${n})`;
    return {
      prompt: md`Factor $${poly([[k ** 4, "x^4"], [-(n ** 4), ""]])}$ completely.`,
      answer: ans,
      factored: true,
      hint: md`$${poly([[k ** 4, "x^4"]])} = (${K2})^2$, so this is a difference of squares. One of the factors you get is another one.`,
      solution: [
        { math: md`(${K2})^2 - ${n * n}^2`, note: "Both terms are squares, with a minus between them." },
        { math: md`(${K2} + ${n * n})(${K2} - ${n * n})`, note: md`Difference of squares. Not done yet: $${K2} - ${n * n}$ is a difference of squares too.` },
        { math: ans, note: md`$${K2} + ${n * n}$ is a sum of squares, which is prime. Every factor is finished.` },
      ],
    };
  }
  if (kind === 1) {
    // (x + p)(x^2 - n^2), written out, grouped, then split again.
    const n = r.int(1, 5);
    let p = r.nonzero(-6, 6);
    while (Math.abs(p) === n) p = r.nonzero(-6, 6);
    const xp = lin(1, p);
    const ans = `(${xp})(x + ${n})(x - ${n})`;
    return {
      prompt: md`Factor $${poly([[1, "x^3"], [p, "x^2"], [-n * n, "x"], [-p * n * n, ""]])}$ completely.`,
      answer: ans,
      factored: true,
      hint: md`Four terms: group them in pairs. Then look at each factor you get. Can one be factored again?`,
      solution: [
        { math: md`(${poly([[1, "x^3"], [p, "x^2"]])}) + (${poly([[-n * n, "x"], [-p * n * n, ""]])})`, note: "No GCF for all four terms. Group in pairs." },
        { math: md`x^2(${xp}) - ${n * n}(${xp})`, note: md`Take $x^2$ out of the first pair and $-${n * n}$ out of the second, so the binomials match.` },
        { math: md`(${xp})(x^2 - ${n * n})`, note: md`Pull out $(${xp})$. Not done: $x^2 - ${n * n}$ is a difference of squares.` },
        { math: ans, note: "Every factor is now finished." },
      ],
    };
  }
  // g x^3 y - g n^2 x y^3 = gxy(x + ny)(x - ny)
  const g = r.int(1, 3);
  const n = r.int(1, 5);
  const G = poly([[g, "xy"]]);
  const inner = diffSquares(1, n, { w: "y" });
  const ans = `${G}${inner.answer}`;
  return {
    prompt: md`Factor $${poly([[g, "x^3y"], [-g * n * n, "xy^3"]])}$ completely.`,
    answer: ans,
    factored: true,
    hint: md`Take out the GCF, including the variables. What's left is a familiar pattern.`,
    solution: [
      { math: md`${G}(${inner.expr})`, note: md`The GCF is $${G}$: ${g > 1 ? `$${g}$ divides both coefficients, and ` : ""}each variable appears in both terms, smallest power 1.` },
      inner.steps[0]!,
      { math: ans, note: md`Difference of squares inside, GCF kept in front. Every factor is finished.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit7: Unit = {
  title: "Factoring",
  lessons: [
    {
      id: slug("Greatest common factor"),
      title: "Greatest common factor",
      summary: "Factoring as the distributive property run backwards: pulling out the biggest shared factor.",
      blocks: [
        {
          kind: "text",
          body: md`In Unit 6 you multiplied: $3x(2x + 5) = 6x^2 + 15x$. **Factoring** runs that the other way. You're handed the result, $6x^2 + 15x$, and asked what was multiplied to make it.

You've done this with numbers for years. $12 = 3 \cdot 4$ is a factorization of 12. Algebra does the same thing to expressions.`,
        },
        {
          kind: "key",
          title: "Factoring",
          body: md`To **factor** an expression is to rewrite it as a product. The pieces being multiplied are its **factors**.

- $6x^2 + 15x$ is a sum. It is not factored.
- $3x(2x + 5)$ is a product. It is factored.

They are the same expression, so they agree for every $x$. Only the shape differs.`,
        },
        {
          kind: "why",
          title: "Factoring is the distributive property, backwards",
          body: md`The distributive property from Unit 1 says $a(b + c) = ab + ac$. Read left to right, it multiplies out. Read right to left, it says: if every term has the same factor $a$, you can pull it out front.

$$ab + ac = a(b + c)$$

So factoring needs no new rule. It is the oldest rule you have, read in the other direction. The area picture shows both directions. Multiplying finds the total area from the side lengths. Factoring starts from the two areas $ab$ and $ac$, sees that they share the side $a$, and rebuilds the whole rectangle: $a$ by $b + c$.`,
        },
        { kind: "widget", widget: "area-model" },
        {
          kind: "text",
          body: md`To pull out as much as possible, look for the **greatest common factor** (GCF): the biggest factor that divides every term.

For numbers, break each one into primes and keep what they share. $12 = 2 \cdot 2 \cdot 3$ and $18 = 2 \cdot 3 \cdot 3$ share one 2 and one 3, so their GCF is $2 \cdot 3 = 6$.`,
        },
        {
          kind: "why",
          title: "Why the smaller power of x?",
          body: md`Write the powers out as repeated multiplication, as in Unit 6:

$$x^5 = x \cdot x \cdot x \cdot x \cdot x, \qquad x^3 = x \cdot x \cdot x.$$

They share three $x$'s and no more, because $x^3$ only has three to give. So the common factor is $x^3$, the **smaller** power. The same goes for every variable: a term can only give up as many copies as it has.`,
        },
        {
          kind: "key",
          title: "Pulling out the GCF",
          body: md`- **Number part:** the largest number that divides every coefficient.
- **Variable part:** each variable that appears in **every** term, to its smallest power.
- **Divide** each term by the GCF. The quotients go in the parentheses.
- **Check** by multiplying back out.

Dividing is the right move because $\text{GCF} \cdot \frac{\text{term}}{\text{GCF}} = \text{term}$: multiplying back gives every original term.`,
        },
        {
          kind: "example",
          title: "A number and a power",
          problem: md`Factor $12x^3 + 18x^2$.`,
          steps: [
            { math: md`\text{GCF} = 6x^2`, note: md`6 is the largest number dividing 12 and 18. Both terms contain $x$, and the smaller power is $x^2$.` },
            { math: md`\frac{12x^3}{6x^2} = 2x, \qquad \frac{18x^2}{6x^2} = 3`, note: "Divide each term by the GCF. Exponents subtract, as in Unit 6." },
            { math: md`6x^2(2x + 3)`, note: "GCF in front, the quotients inside." },
            { math: md`6x^2 \cdot 2x + 6x^2 \cdot 3 = 12x^3 + 18x^2 \;\checkmark`, note: "Multiply back out to check." },
          ],
        },
        {
          kind: "example",
          title: "Three terms, and the 1 left behind",
          problem: md`Factor $8x^3 - 4x^2 + 4x$.`,
          steps: [
            { math: md`\text{GCF} = 4x`, note: md`4 divides 8, 4 and 4. Every term has at least one $x$.` },
            { math: md`\frac{8x^3}{4x} = 2x^2, \quad \frac{-4x^2}{4x} = -x, \quad \frac{4x}{4x} = 1`, note: "The last term divided by itself is 1, not 0." },
            { math: md`4x(2x^2 - x + 1)`, note: md`Keep the 1. Without it, multiplying back gives only $8x^3 - 4x^2$, and a term has gone missing.` },
          ],
        },
        {
          kind: "text",
          body: md`**Pulling out a negative.** When the first term is negative, it's tidier to take out a negative GCF. Every sign inside flips, just as when you distributed $-1$ in Unit 1:

$$-6x^2 + 15x = -3x(2x - 5).$$

Check: $-3x \cdot 2x = -6x^2$ and $-3x \cdot (-5) = 15x$. Taking out $3x$ instead, $3x(-2x + 5)$, is also correct. It just leaves the inside starting with a minus.`,
        },
        {
          kind: "text",
          body: md`**The common factor can be a whole binomial.** In $3x(x + 2) + 5(x + 2)$ both terms contain $(x + 2)$, so pull it out:

$$3x(x + 2) + 5(x + 2) = (x + 2)(3x + 5).$$`,
        },
        {
          kind: "why",
          title: "Why a binomial can come out",
          body: md`Give $(x + 2)$ a short name, say $u$. The expression becomes $3x \cdot u + 5 \cdot u$, and the distributive property turns that into $(3x + 5)u$. The rule $ab + ac = a(b + c)$ never cared what $a$ is: a number, a variable, or a whole expression in parentheses.

This gives a method for four terms with no common factor, called **grouping**. Split them into two pairs, take the GCF out of each pair, and hope the same binomial is left in both.`,
        },
        {
          kind: "example",
          title: "Factoring by grouping",
          problem: md`Factor $x^3 + 2x^2 - 5x - 10$.`,
          steps: [
            { math: md`(x^3 + 2x^2) + (-5x - 10)`, note: "No factor is shared by all four terms. Group them in pairs." },
            { math: md`x^2(x + 2) - 5(x + 2)`, note: md`Take $x^2$ out of the first pair. From the second take out $-5$, not $5$, so it also leaves $(x + 2)$.` },
            { math: md`(x + 2)(x^2 - 5)`, note: md`Now $(x + 2)$ is a common factor. Pull it out.` },
            { math: md`x^3 - 5x + 2x^2 - 10 \;\checkmark`, note: "Multiply back out to check: the same four terms." },
          ],
        },
        {
          kind: "check",
          prompt: md`Factor $15x^2 - 10x$.`,
          answer: "5x(3x - 2)",
          factored: true,
          explain: md`5 is the largest number dividing 15 and 10, and the smaller power of $x$ is $x$. So the GCF is $5x$, and $\frac{15x^2}{5x} = 3x$, $\frac{-10x}{5x} = -2$.`,
        },
        {
          kind: "check",
          prompt: md`Factor $x(x - 4) + 7(x - 4)$.`,
          answer: "(x - 4)(x + 7)",
          factored: true,
          explain: md`Both terms contain $(x - 4)$. Pulling it out leaves $x + 7$.`,
        },
      ],
      practice: [gcfOut, gcfMore, commonBinomial],
    },
    {
      id: slug("Factoring trinomials"),
      title: "Factoring trinomials",
      summary: "Undoing (x + p)(x + q) with product and sum, and the ac method when the first coefficient isn't 1.",
      blocks: [
        {
          kind: "text",
          body: md`In Unit 6 you multiplied two binomials: $(x + 2)(x + 3) = x^2 + 5x + 6$. A three-term expression like $x^2 + 5x + 6$ is a **trinomial**. This lesson runs that multiplication backwards: given the trinomial, find the two binomials.

There's no common factor to pull out, so we need a new idea. It comes from watching closely what multiplying does.`,
        },
        {
          kind: "why",
          title: "Where b and c come from",
          body: md`Multiply $(x + p)(x + q)$ for any numbers $p$ and $q$:

$$(x + p)(x + q) = x^2 + px + qx + pq = x^2 + (p + q)x + pq.$$

The last step combines like terms, which is the distributive property again. Look at what came out. The constant term is the **product** $pq$. The coefficient of $x$ is the **sum** $p + q$.

So if $x^2 + bx + c$ is going to equal $(x + p)(x + q)$, we need $pq = c$ and $p + q = b$. That's the whole method.`,
        },
        {
          kind: "key",
          title: "Factoring x² + bx + c",
          body: md`Find two integers $p$ and $q$ with

- product $pq = c$, and
- sum $p + q = b$.

Then $x^2 + bx + c = (x + p)(x + q)$. To search, list the factor pairs of $c$. There are only a few.`,
        },
        {
          kind: "example",
          title: "Listing factor pairs",
          problem: md`Factor $x^2 + 7x + 12$.`,
          steps: [
            { math: md`1 \cdot 12, \quad 2 \cdot 6, \quad 3 \cdot 4`, note: "The pairs of positive integers with product 12." },
            { math: md`1 + 12 = 13, \quad 2 + 6 = 8, \quad 3 + 4 = 7`, note: md`We need a sum of 7. Only $3$ and $4$ work.` },
            { math: md`(x + 3)(x + 4)`, note: "One number in each factor." },
            { math: md`x^2 + 4x + 3x + 12 = x^2 + 7x + 12 \;\checkmark`, note: "Multiply back out to check." },
          ],
        },
        {
          kind: "why",
          title: "Reading the signs first",
          body: md`The signs of $b$ and $c$ tell you the signs of $p$ and $q$ before you search, by the sign rules for multiplying.

- **$c$ positive:** the product is positive, so $p$ and $q$ have the same sign. Their sum has that sign too, so both match the sign of $b$.
- **$c$ negative:** the product is negative, so one is positive and one is negative. Their sum is the difference of their sizes, so the bigger one (in size) takes the sign of $b$.`,
        },
        {
          kind: "example",
          title: "A negative constant",
          problem: md`Factor $x^2 - 2x - 15$.`,
          steps: [
            { math: md`pq = -15, \quad p + q = -2`, note: md`$c$ is negative, so the signs are opposite, and the bigger number is negative because $b$ is.` },
            { math: md`3 \cdot (-5) = -15, \quad 3 + (-5) = -2`, note: md`The pairs for 15 are $1, 15$ and $3, 5$. Only 3 and 5 differ by 2.` },
            { math: md`(x + 3)(x - 5)`, note: md`Check: $x^2 - 5x + 3x - 15 = x^2 - 2x - 15$.` },
          ],
        },
        {
          kind: "plot",
          x: [-8, 8],
          y: [-10, 10],
          curves: [{ expr: "(x + p)(x + q)", label: "y = (x + p)(x + q)", color: 1 }],
          points: [
            { x: "-p", y: 0, label: "-p", color: 2 },
            { x: "-q", y: 0, label: "-q", color: 2 },
          ],
          params: [
            { name: "p", min: -5, max: 5, step: 1, value: 2 },
            { name: "q", min: -5, max: 5, step: 1, value: 3 },
          ],
          caption: md`Each factor is zero at one value of $x$: $x + p = 0$ when $x = -p$. A product is zero when one of its factors is, so the graph crosses the $x$-axis exactly at $-p$ and $-q$. Unit 8 uses this to solve equations.`,
        },
        {
          kind: "text",
          body: md`**When the first coefficient isn't 1.** In $2x^2 + 7x + 3$ the $x^2$ term has coefficient 2. You could guess binomials until one works, but the guessing can drag on. The **ac method** turns the problem back into "product and sum", then finishes with grouping from the last lesson.`,
        },
        {
          kind: "why",
          title: "Why the ac method works",
          body: md`Multiply $(mx + n)(kx + l)$ in general:

$$(mx + n)(kx + l) = mk\,x^2 + ml\,x + nk\,x + nl.$$

So $a = mk$, $c = nl$, and the middle coefficient $b$ is the sum of two pieces, $ml$ and $nk$. Multiply those two pieces: $ml \cdot nk = mk \cdot nl = ac$. So **the two pieces have product $ac$ and sum $b$**.

That means we can find the pieces without knowing $m, n, k, l$. Once $bx$ is split into $ml\,x + nk\,x$, we're looking at the four-term expansion above, and grouping undoes it: the first pair shares $mx$, the second shares $n$, and both leave $(kx + l)$.`,
        },
        {
          kind: "key",
          title: "The ac method for ax² + bx + c",
          body: md`- Compute $ac$.
- Find two integers with product $ac$ and sum $b$.
- Split $bx$ into two terms using those numbers.
- Factor by grouping.`,
        },
        {
          kind: "example",
          title: "The ac method",
          problem: md`Factor $2x^2 + 7x + 3$.`,
          steps: [
            { math: md`ac = 2 \cdot 3 = 6`, note: "Multiply the first and last coefficients." },
            { math: md`1 \cdot 6 = 6, \quad 1 + 6 = 7`, note: "Two numbers with product 6 and sum 7." },
            { math: md`2x^2 + x + 6x + 3`, note: md`Split $7x$ into $x + 6x$. The value hasn't changed.` },
            { math: md`x(2x + 1) + 3(2x + 1)`, note: "Group in pairs and take the GCF out of each." },
            { math: md`(2x + 1)(x + 3)`, note: md`Pull out the common binomial. Check: $2x^2 + 6x + x + 3 = 2x^2 + 7x + 3$.` },
          ],
        },
        {
          kind: "example",
          title: "The ac method with negatives",
          problem: md`Factor $6x^2 - x - 2$.`,
          steps: [
            { math: md`ac = 6 \cdot (-2) = -12`, note: "Multiply the first and last coefficients." },
            { math: md`3 \cdot (-4) = -12, \quad 3 + (-4) = -1`, note: "Opposite signs whose sizes differ by 1: 3 and 4, with the bigger one negative." },
            { math: md`6x^2 + 3x - 4x - 2`, note: md`Split $-x$ into $3x - 4x$.` },
            { math: md`3x(2x + 1) - 2(2x + 1)`, note: md`From the second pair take out $-2$, not $2$, so the binomials match.` },
            { math: md`(2x + 1)(3x - 2)`, note: "Pull out the common binomial." },
          ],
        },
        {
          kind: "text",
          body: md`**Not every trinomial factors.** For $x^2 + x + 1$ we'd need a product of 1 and a sum of 1. The only integer pairs with product 1 are $1, 1$ and $-1, -1$, with sums 2 and $-2$. No pair works, so $x^2 + x + 1$ is **prime**: it can't be factored using integers.

**Take out a GCF first.** In $2x^2 + 10x + 12$ every term is even. Writing $2(x^2 + 5x + 6) = 2(x + 2)(x + 3)$ keeps the numbers small, and it's the complete answer. Lesson 4 makes this a habit.`,
        },
        {
          kind: "check",
          prompt: md`Factor $x^2 + 8x + 15$.`,
          answer: "(x + 3)(x + 5)",
          factored: true,
          explain: md`We need product 15 and sum 8. The pairs are $1, 15$ (sum 16) and $3, 5$ (sum 8). So $(x + 3)(x + 5)$.`,
        },
        {
          kind: "check",
          prompt: md`Factor $3x^2 + 10x + 8$.`,
          answer: "(3x + 4)(x + 2)",
          factored: true,
          explain: md`$ac = 24$, and $4 \cdot 6 = 24$ with $4 + 6 = 10$. Split: $3x^2 + 4x + 6x + 8 = x(3x + 4) + 2(3x + 4) = (3x + 4)(x + 2)$.`,
        },
      ],
      practice: [monicTrinomial, acTrinomial, trinomialMore],
    },
    {
      id: slug("Difference of squares and perfect squares"),
      title: "Difference of squares and perfect squares",
      summary: "Two special products from Unit 6, recognized and run backwards.",
      blocks: [
        {
          kind: "text",
          body: md`Some products from Unit 6 have a shape worth memorizing. Once you recognize the shape, you can factor in one step, with no search at all.`,
        },
        {
          kind: "why",
          title: "Where the difference of squares comes from",
          body: md`Multiply a sum by the matching difference:

$$(a + b)(a - b) = a^2 - ab + ab - b^2 = a^2 - b^2.$$

The two middle terms are opposites, so they cancel and only two squares are left. It also fits the last lesson: $x^2 - 9$ is $x^2 + 0x - 9$, so we need a product of $-9$ and a sum of 0. Numbers that add to 0 are opposites, and $3$ and $-3$ do it.`,
        },
        {
          kind: "why",
          title: "The picture: cut and rearrange",
          body: md`Start with a square of side $a$. Its area is $a^2$. Cut a small square of side $b$ out of one corner. What's left is an L-shape with area $a^2 - b^2$.

Now slice the L into two rectangles. One is $a - b$ wide and $a$ tall. The other is $b$ wide and $a - b$ tall. Turn the second one on its side and stack it on top of the first. Both are now $a - b$ wide, so together they make one rectangle, $a - b$ wide and $a + b$ tall.

Nothing was added or thrown away, so the areas match: $a^2 - b^2 = (a + b)(a - b)$.`,
        },
        {
          kind: "key",
          title: "Difference of squares",
          body: md`$$a^2 - b^2 = (a + b)(a - b)$$

Look for **two terms**, **both perfect squares**, with a **minus** between them.`,
        },
        {
          kind: "example",
          title: "The plain case",
          problem: md`Factor $x^2 - 49$.`,
          steps: [
            { math: md`x^2 - 7^2`, note: md`49 is $7^2$, so this is a difference of squares.` },
            { math: md`(x + 7)(x - 7)`, note: md`Here $a = x$ and $b = 7$.` },
          ],
        },
        {
          kind: "example",
          title: "A coefficient in the square",
          problem: md`Factor $9x^2 - 25$.`,
          steps: [
            { math: md`(3x)^2 - 5^2`, note: md`$9x^2 = (3x)^2$, since $(3x)^2 = 3x \cdot 3x = 9x^2$.` },
            { math: md`(3x + 5)(3x - 5)`, note: md`Here $a = 3x$ and $b = 5$.` },
            { math: md`9x^2 - 15x + 15x - 25 = 9x^2 - 25 \;\checkmark`, note: "Multiply back out: the middle terms cancel." },
          ],
        },
        {
          kind: "text",
          body: md`**A sum of squares doesn't factor.** For $x^2 + 9$ we'd need a product of 9 and a sum of 0. A sum of 0 means opposites, like $3$ and $-3$, but opposites always have a negative product. No pair works, so $x^2 + 9$ is prime.`,
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-10, 12],
          curves: [
            { expr: "x^2 - a^2", label: "y = x^2 - a^2", color: 1 },
            { expr: "x^2 + a^2", label: "y = x^2 + a^2", color: 2, dashed: true },
          ],
          points: [
            { x: "-a", y: 0, label: "-a", color: 1 },
            { x: "a", y: 0, label: "a", color: 1 },
          ],
          params: [{ name: "a", min: 1, max: 3, step: 0.5, value: 2 }],
          caption: md`$x^2 - a^2$ has the factors $x + a$ and $x - a$, so it hits zero at $x = -a$ and $x = a$. $x^2 + a^2$ is never less than $a^2$, so it is never zero, which fits the fact that it has no factors like these.`,
        },
        {
          kind: "why",
          title: "Where perfect square trinomials come from",
          body: md`Square a binomial:

$$(a + b)^2 = (a + b)(a + b) = a^2 + ab + ab + b^2 = a^2 + 2ab + b^2.$$

As a picture: a square of side $a + b$ splits into an $a$ by $a$ square, a $b$ by $b$ square, and **two** $a$ by $b$ rectangles. That's where the 2 in $2ab$ comes from. Replacing $b$ with $-b$ gives $(a - b)^2 = a^2 - 2ab + b^2$.`,
        },
        {
          kind: "key",
          title: "Perfect square trinomials",
          body: md`$$a^2 + 2ab + b^2 = (a + b)^2 \qquad a^2 - 2ab + b^2 = (a - b)^2$$

Test all three parts: the first term is a square, the last term is a square (and positive), and the middle term is **twice** the product of the things being squared. The sign of the middle term is the sign inside the binomial.`,
        },
        {
          kind: "example",
          title: "Testing the middle",
          problem: md`Factor $4x^2 - 12x + 9$.`,
          steps: [
            { math: md`4x^2 = (2x)^2, \quad 9 = 3^2`, note: "Both ends are perfect squares." },
            { math: md`2 \cdot 2x \cdot 3 = 12x`, note: md`The middle term is $-12x$: minus twice the product. It's a perfect square.` },
            { math: md`(2x - 3)^2`, note: md`Check: $(2x - 3)(2x - 3) = 4x^2 - 6x - 6x + 9$.` },
          ],
        },
        {
          kind: "text",
          body: md`**Always test the middle.** $x^2 + 6x + 4$ has square ends, $x^2$ and $2^2$, but $2 \cdot x \cdot 2 = 4x$, not $6x$. It isn't a perfect square. (It's prime: no integers multiply to 4 and add to 6.) And $x^2 + 10x + 16$ fails the test too, yet it factors the ordinary way: $(x + 2)(x + 8)$.`,
        },
        {
          kind: "check",
          prompt: md`Factor $x^2 - 64$.`,
          answer: "(x + 8)(x - 8)",
          factored: true,
          explain: md`$64 = 8^2$, so $x^2 - 8^2 = (x + 8)(x - 8)$.`,
        },
        {
          kind: "check",
          prompt: md`Factor $x^2 + 10x + 25$.`,
          answer: "(x + 5)^2",
          factored: true,
          explain: md`$25 = 5^2$ and $2 \cdot x \cdot 5 = 10x$ matches the middle term, so it's $(x + 5)^2$.`,
        },
      ],
      practice: [differenceOfSquares, perfectSquareTrinomial, recognizePattern],
    },
    {
      id: slug("A factoring strategy"),
      title: "A factoring strategy",
      summary: "Which tool to use when, and how to know you've factored completely.",
      blocks: [
        {
          kind: "text",
          body: md`You now have four tools: the GCF, grouping, trinomials, and the special patterns. A tough expression often needs two or three of them, one after another. The hard part is knowing which to reach for, so here is an order that always works.`,
        },
        {
          kind: "key",
          title: "Factoring checklist",
          body: md`- **1. GCF first.** Take out the greatest common factor, including $-1$ if the first term is negative.
- **2. Two terms?** Look for a difference of squares, $a^2 - b^2$.
- **3. Three terms?** Test for a perfect square. Otherwise use product and sum, or the ac method if the first coefficient isn't 1.
- **4. Four terms?** Try grouping.
- **5. Look at every factor again.** If one can still be factored, factor it.
- **6. Check** by multiplying out, or by substituting a number.`,
        },
        {
          kind: "why",
          title: "Why the GCF goes first",
          body: md`It makes every later step easier, and sometimes possible. $2x^2 - 18$ isn't a difference of squares: neither 2 nor 18 is a perfect square. Take out the 2 and the pattern appears:

$$2x^2 - 18 = 2(x^2 - 9) = 2(x + 3)(x - 3).$$

It also keeps the numbers small. Product and sum on $x^2 + 5x + 6$ is quicker than the ac method on $3x^2 + 15x + 18$.`,
        },
        {
          kind: "why",
          title: "What \"completely\" means, and why it stops",
          body: md`Compare numbers. $60 = 2 \cdot 30$ is true, but 30 can still be broken down. $60 = 2 \cdot 2 \cdot 3 \cdot 5$ is finished, because every factor is prime.

Expressions work the same way. An expression is **factored completely** when no factor (other than a plain number out front) can be factored again using integers. The process always ends: every time you split a factor, the new pieces have smaller exponents than the factor they came from, and exponents can't keep shrinking forever.`,
        },
        {
          kind: "example",
          title: "GCF, then a pattern",
          problem: md`Factor $3x^3 - 12x$ completely.`,
          steps: [
            { math: md`3x(x^2 - 4)`, note: md`The GCF is $3x$.` },
            { math: md`3x(x + 2)(x - 2)`, note: md`$x^2 - 4$ is a difference of squares. Look again: $3x$, $x + 2$ and $x - 2$ can't be split further.` },
          ],
        },
        {
          kind: "example",
          title: "GCF, then a trinomial",
          problem: md`Factor $2x^3 + 4x^2 - 30x$ completely.`,
          steps: [
            { math: md`2x(x^2 + 2x - 15)`, note: md`The GCF is $2x$.` },
            { math: md`5 \cdot (-3) = -15, \quad 5 + (-3) = 2`, note: "Product and sum on what's left." },
            { math: md`2x(x + 5)(x - 3)`, note: "Every factor is finished." },
          ],
        },
        {
          kind: "example",
          title: "A pattern inside a pattern",
          problem: md`Factor $x^4 - 16$ completely.`,
          steps: [
            { math: md`(x^2)^2 - 4^2`, note: md`$x^4 = (x^2)^2$, so this is a difference of squares.` },
            { math: md`(x^2 + 4)(x^2 - 4)`, note: md`Not done: $x^2 - 4$ is itself a difference of squares.` },
            { math: md`(x^2 + 4)(x + 2)(x - 2)`, note: md`$x^2 + 4$ is a sum of squares, which is prime. Now every factor is finished.` },
          ],
        },
        {
          kind: "example",
          title: "Grouping, then a pattern",
          problem: md`Factor $x^3 - 3x^2 - 4x + 12$ completely.`,
          steps: [
            { math: md`x^2(x - 3) - 4(x - 3)`, note: md`Four terms: group in pairs. Take $-4$ out of the second pair so the binomials match.` },
            { math: md`(x - 3)(x^2 - 4)`, note: md`Pull out $(x - 3)$. Look again: $x^2 - 4$ splits.` },
            { math: md`(x - 3)(x + 2)(x - 2)`, note: "Difference of squares. Every factor is finished." },
          ],
        },
        {
          kind: "plot",
          x: [-4, 5],
          y: [-15, 20],
          curves: [{ expr: "(x - 3)(x + 2)(x - 2)", label: "y = x^3 - 3x^2 - 4x + 12", color: 1 }],
          points: [
            { x: -2, y: 0, label: "-2", color: 2 },
            { x: 2, y: 0, label: "2", color: 2 },
            { x: 3, y: 0, label: "3", color: 2 },
          ],
          caption: md`The complete factorization $(x - 3)(x + 2)(x - 2)$ shows every place the graph crosses zero: $x = 3$, $x = -2$ and $x = 2$. Stopping at $(x - 3)(x^2 - 4)$ would hide two of them.`,
        },
        {
          kind: "text",
          body: md`**Checking with one number.** Substitute an easy value into the original and into your answer. For the last example with $x = 1$: $1 - 3 - 4 + 12 = 6$, and $(1 - 3)(1 + 2)(1 - 2) = (-2)(3)(-1) = 6$. They agree. A disagreement would mean a mistake.

Agreement doesn't show you're finished, though: $(x - 3)(x^2 - 4)$ passes the same test. Substituting tells you the product is *right*; only step 5 of the checklist tells you it's *complete*. PolyMath checks both, so an answer like $(x - 3)(x^2 - 4)$ comes back as "not factored completely".`,
        },
        {
          kind: "check",
          prompt: md`Factor $5x^2 - 45$ completely.`,
          answer: "5(x + 3)(x - 3)",
          factored: true,
          explain: md`GCF first: $5(x^2 - 9)$. Then the difference of squares: $5(x + 3)(x - 3)$.`,
        },
        {
          kind: "check",
          prompt: md`Factor $x^3 + 2x^2 - 9x - 18$ completely.`,
          answer: "(x + 2)(x + 3)(x - 3)",
          factored: true,
          explain: md`Group: $x^2(x + 2) - 9(x + 2) = (x + 2)(x^2 - 9)$. Then $x^2 - 9 = (x + 3)(x - 3)$.`,
        },
      ],
      practice: [chooseMethod, factorCompletely, multiStep],
    },
  ],
};
