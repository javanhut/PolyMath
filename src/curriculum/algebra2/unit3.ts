import { frac, fracTex, gcd, paren, poly, type Rng } from "../../math/random";
import { md, type Generator, type Problem, type Step, type Unit } from "../types";

// ── Polynomial helpers ──────────────────────────────────────────────────────
// A polynomial is its list of coefficients, highest power first: [2, 0, -3, 1] is 2x^3 - 3x + 1.

type Poly = number[];

function trim(p: Poly): Poly {
  let i = 0;
  while (i < p.length - 1 && p[i] === 0) i++;
  return p.slice(i);
}

function mul(a: Poly, b: Poly): Poly {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j]! += x * y)));
  return out;
}

const mulAll = (...ps: Poly[]): Poly => ps.reduce(mul, [1]);

function add(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const pad = (p: Poly) => [...new Array<number>(n - p.length).fill(0), ...p];
  const [x, y] = [pad(a), pad(b)];
  return trim(x.map((v, i) => v + y[i]!));
}

const sub = (a: Poly, b: Poly): Poly => add(a, b.map((c) => -c));
const scale = (p: Poly, k: number): Poly => p.map((c) => c * k);
const power = (p: Poly, m: number): Poly => mulAll(...new Array<Poly>(m).fill(p));
/** Value at x, by nested multiplication. */
const at = (p: Poly, x: number) => p.reduce((acc, c) => acc * x + c, 0);
const deriv = (p: Poly): Poly => (p.length === 1 ? [0] : p.slice(0, -1).map((c, i) => c * (p.length - 1 - i)));

const xPow = (k: number) => (k === 0 ? "" : k === 1 ? "x" : k < 10 ? `x^${k}` : `x^{${k}}`);
/** Standard form; the same text works as LaTeX and as a typed answer. */
const ptext = (p: Poly) => {
  const n = p.length - 1;
  return poly(p.map((c, i): [number, string] => [c, xPow(n - i)]));
};
const mono = (c: number, k: number) => poly([[c, xPow(k)]]);
/** The factor x - r: "(x - 3)", "(x + 2)", or "x". */
const lin = (r: number) => (r === 0 ? "x" : `(${poly([[1, "x"], [-r, ""]])})`);
const pw = (t: string, m: number) => (m === 1 ? t : `${t}^${m}`);
const linPow = (r: number, m: number) => pw(lin(r), m);
/** The factor qx - p. */
const linQP = (q: number, p: number) => (p === 0 ? mono(q, 1) : `(${poly([[q, "x"], [-p, ""]])})`);
const lead = (k: number) => (k === 1 ? "" : k === -1 ? "-" : String(k));
/** h + ki as text: "2 - 3i", "i", "-4i". */
const cx = (h: number, k: number) => poly([[h, ""], [k, "i"]]);
/** Substitute a value for x in polynomial text. */
const subst = (text: string, v: string | number) => text.replace(/x/g, `(${v})`);
/** The nonzero term values of p at x, summed in order: "16 - 12 + 2 - 5". */
const termSum = (p: Poly, x: number) => poly(p.map((c, i): [number, string] => [c * x ** (p.length - 1 - i), ""]).filter(([v]) => v !== 0));
/** The factor x - z for z = h + ki: "(x - 2i)", "(x + i)", "(x - (1 + 2i))". */
const zFactor = (h: number, k: number) => (h === 0 ? (k > 0 ? `(x - ${cx(0, k)})` : `(x + ${cx(0, -k)})`) : `(x - (${cx(h, k)}))`);
/** (ki)^2 written for a difference of squares. */
const iSq = (k: number) => (Math.abs(k) === 1 ? "i^2" : `(${Math.abs(k)}i)^2`);
/** "x - c" as LaTeX/text. */
const minus = (c: number) => ptext([1, -c]);
/** "x - n/d" as LaTeX, with "x + 3/2" rather than "x - -3/2". */
const minusFrac = (n: number, d: number) => (n < 0 ? md`x + ${fracTex(-n, d)}` : md`x - ${fracTex(n, d)}`);
/** h ± sqrt(s) as two answer items. */
const surdPair = (h: number, s: number) => (h === 0 ? [`sqrt(${s})`, `-sqrt(${s})`] : [`${h} + sqrt(${s})`, `${h} - sqrt(${s})`]);
const surdTex = (h: number, s: number) => (h === 0 ? md`\pm\sqrt{${s}}` : md`${h} \pm \sqrt{${s}}`);

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function divisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= Math.abs(n); d++) if (n % d === 0) out.push(d);
  return out;
}

/** Synthetic division of p by x - num/den. */
function synth(p: Poly, num: number, den = 1) {
  const mid: number[] = [];
  const bottom: number[] = [p[0]!];
  for (let i = 1; i < p.length; i++) {
    const m = (bottom[i - 1]! * num) / den;
    mid.push(m);
    bottom.push(p[i]! + m);
  }
  return { q: bottom.slice(0, -1), rem: bottom[bottom.length - 1]!, mid, bottom };
}

function synthTex(p: Poly, num: number, den = 1): string {
  const { mid, bottom } = synth(p, num, den);
  return md`\begin{array}{r|${"r".repeat(p.length)}} ${fracTex(num, den)} & ${p.join(" & ")} \\ & & ${mid.join(" & ")} \\ \hline & ${bottom.join(" & ")} \end{array}`;
}

/** Long division of p by d, with one step of working per quotient term. */
function longDivision(p: Poly, d: Poly) {
  let cur = trim(p);
  const dd = d.length - 1;
  const qlen = Math.max(cur.length - dd, 1);
  const q = new Array<number>(qlen).fill(0);
  const steps: Step[] = [];
  while (cur.length - 1 >= dd && !(cur.length === 1 && cur[0] === 0)) {
    const k = cur.length - 1 - dd;
    const t = cur[0]! / d[0]!;
    q[qlen - 1 - k] = t;
    const next = sub(cur, mul([t, ...new Array<number>(k).fill(0)], d));
    steps.push({
      math: md`(${ptext(cur)}) - (${mono(t, k)})(${ptext(d)}) = ${ptext(next)}`,
      note: md`$\dfrac{${mono(cur[0]!, cur.length - 1)}}{${mono(d[0]!, dd)}} = ${mono(t, k)}$. Multiply the divisor by it and subtract, which cancels the leading term.`,
    });
    cur = next;
  }
  return { q: trim(q), rem: cur, steps };
}

// ── Lesson 1: End behavior and degree ───────────────────────────────────────

const END = {
  uu: "left end up, right end up",
  dd: "left end down, right end down",
  du: "left end down, right end up",
  ud: "left end up, right end down",
};
const END_CHOICES = [END.uu, END.dd, END.du, END.ud];
const endOf = (n: number, a: number) => (n % 2 === 0 ? (a > 0 ? END.uu : END.dd) : a > 0 ? END.du : END.ud);

/** A standard-form polynomial written with its terms out of order. */
function scrambled(r: Rng) {
  const n = r.int(2, 7);
  const a = r.coef(-6, 6);
  const lower = shuffle(
    r,
    Array.from({ length: n }, (_, i) => i),
  ).slice(0, Math.min(n, r.int(2, 3)));
  const terms: [number, string][] = [[a, xPow(n)], ...lower.map((k): [number, string] => [r.coef(-9, 9), xPow(k)])];
  let order = shuffle(r, terms);
  if (order[0]![1] === xPow(n)) order = [...order.slice(1), order[0]!];
  return { text: poly(order), n, a };
}

/** A product of linear factors such as -2(x - 1)^2(3 - x)(2x + 5). */
function randomFactored(r: Rng) {
  const k = r.pick([1, 1, -1, 2, -2, 3]);
  const count = r.int(2, 3);
  const used = new Set<number>();
  const parts: { text: string; leadTex: string; lead: number; m: number }[] = [];
  let bUsed = false;
  for (let i = 0; i < count; i++) {
    let c = r.nonzero(-5, 5);
    while (used.has(Math.abs(c))) c = r.nonzero(-5, 5);
    used.add(Math.abs(c));
    const m = r.int(1, count === 3 ? 2 : 3);
    const type = r.int(0, 2);
    if (type === 2 && !bUsed) {
      bUsed = true;
      let b = r.int(2, 3);
      // Keep bx + c reduced: no (2x - 4) or (3x + 3).
      if (gcd(b, c) !== 1) b = 5 - b;
      const mm = Math.min(m, 2);
      parts.push({ text: pw(`(${poly([[b, "x"], [c, ""]])})`, mm), leadTex: pw(`(${b}x)`, mm), lead: b ** mm, m: mm });
    } else if (type === 1) {
      parts.push({ text: pw(`(${Math.abs(c)} - x)`, m), leadTex: pw("(-x)", m), lead: (-1) ** m, m });
    } else {
      parts.push({ text: pw(lin(c), m), leadTex: pw("x", m), lead: 1, m });
    }
  }
  const n = parts.reduce((s, p) => s + p.m, 0);
  const L = parts.reduce((s, p) => s * p.lead, k);
  const kTex = k === 1 ? "" : md`${paren(k)} \cdot `;
  return {
    text: lead(k) + parts.map((p) => p.text).join(""),
    n,
    L,
    leadMath: md`${kTex}${parts.map((p) => p.leadTex).join(md` \cdot `)} = ${mono(L, n)}`,
  };
}

/** Pick the graph's equation from four that differ in sign, zero locations or multiplicity. */
function graphMatch(r: Rng): Problem {
  for (;;) {
    const type = r.int(0, 2); // 0: three simple zeros; 1: a double and two simple; 2: a double and a simple
    const count = type === 2 ? 2 : 3;
    const zs = shuffle(r, [-3, -2, -1, 0, 1, 2, 3])
      .slice(0, count)
      .sort((a, b) => a - b);
    const ms = type === 0 ? [1, 1, 1] : type === 1 ? shuffle(r, [2, 1, 1]) : shuffle(r, [2, 1]);
    const s = r.sign();
    const make = (sign: number, zeros: number[], mult: number[]) => {
      const order = zeros.map((z, i) => ({ z, m: mult[i]! })).sort((a, b) => (a.z === 0 ? -1 : b.z === 0 ? 1 : a.z - b.z));
      const expr = (sign < 0 ? "-" : "") + order.map(({ z, m }) => linPow(z, m)).join("");
      return { expr, p: scale(mulAll(...order.map(({ z, m }) => power([1, -z], m))), sign) };
    };
    const right = make(s, zs, ms);
    const wrongSign = make(-s, zs, ms);
    const wrongZeros = make(
      s,
      zs.map((z) => -z),
      ms,
    );
    const wrongMult =
      type === 0 ? make(s, zs, shuffle(r, [2, 1, 1])) : type === 1 ? make(s, zs, [ms[2]!, ms[0]!, ms[1]!]) : make(s, zs, [ms[1]!, ms[0]!]);
    const options = [right, wrongSign, wrongZeros, wrongMult];
    const keys = options.map((o) => JSON.stringify(o.p));
    if (new Set(keys).size !== 4) continue;

    const n = right.p.length - 1;
    const lo = zs[0]!;
    const hi = zs[zs.length - 1]!;
    const half = Math.max((hi - lo) / 2 + 1.8, 3);
    const mid = (lo + hi) / 2;
    // Height of the hump between each pair of neighbouring zeros. If one dwarfs another, the
    // small one (and whether the graph touches or crosses there) would be invisible.
    const humps = zs.slice(1).map((z, i) => {
      let h = 0;
      for (let x = zs[i]!; x <= z; x += 0.02) h = Math.max(h, Math.abs(at(right.p, x)));
      return h;
    });
    const M = Math.max(...humps);
    if (M > 6 * Math.min(...humps)) continue;
    const Y = Math.max(3, Math.ceil(M * 1.4));
    // The window has a floor of 3, so a short hump between close zeros can still be too small to read.
    if (Math.min(...humps) < 0.12 * Y) continue;
    const double = zs.find((_, i) => ms[i] === 2);
    const choiceText = (e: string) => md`$y = ${e}$`;
    return {
      prompt: "The graph shows a polynomial function. Which equation matches it?",
      figure: {
        kind: "plot",
        x: [mid - half, mid + half],
        y: [-Y, Y],
        curves: [{ expr: right.expr }],
        points: zs.map((z) => ({ x: z, y: 0 })),
      },
      choices: shuffle(
        r,
        options.map((o) => choiceText(o.expr)),
      ),
      accept: [choiceText(right.expr)],
      hint: "Check three things: where the graph meets the x-axis, whether it crosses or only touches at each zero, and which way the two ends point.",
      solution: [
        { math: md`\text{zeros at } x = ${zs.join(", ")}`, note: md`Each zero $r$ comes from a factor $x - r$. An equation with $x + r$ in place of $x - r$ puts the zero on the wrong side.` },
        double === undefined
          ? { math: md`\text{crosses at every zero}`, note: "Crossing means odd multiplicity, so no factor is squared." }
          : { math: md`\text{touches at } x = ${double}`, note: md`Touching and turning back means even multiplicity: the factor is $${linPow(double, 2)}$.` },
        { math: md`\text{${endOf(n, s)}}`, note: md`Degree ${n} is ${n % 2 ? "odd" : "even"} and the leading coefficient is ${s > 0 ? "positive" : "negative"}, which gives these ends.` },
        { math: md`y = ${right.expr}`, note: "Only this equation has all three features." },
      ],
    };
  }
}

const endBehavior: Generator = (r) => {
  if (r.next() < 0.4) return graphMatch(r);
  let text: string, n: number, a: number;
  const steps: Step[] = [];
  if (r.next() < 0.5) {
    ({ text, n, a } = scrambled(r));
    steps.push({ math: md`\text{leading term: } ${mono(a, n)}`, note: "Find the highest power, wherever it sits in the list. Its term is the leading term." });
  } else {
    const f = randomFactored(r);
    ({ text, n } = f);
    a = f.L;
    steps.push({ math: f.leadMath, note: "Multiply only the leading term of each factor. Every other product has a lower power." });
  }
  steps.push({
    math: md`\text{degree } ${n} \text{ (${n % 2 ? "odd" : "even"})}, \quad \text{leading coefficient } ${a} ${a > 0 ? ">" : "<"} 0`,
    note: n % 2 ? "Odd degree: the two ends point in opposite directions." : "Even degree: both ends point the same way.",
  });
  steps.push({
    math: md`\text{${endOf(n, a)}}`,
    note: a > 0 ? "A positive leading coefficient sends the right end up." : "A negative leading coefficient sends the right end down.",
  });
  return {
    prompt: md`Describe the end behavior of $f(x) = ${text}$.`,
    choices: shuffle(r, END_CHOICES),
    accept: [endOf(n, a)],
    hint: "Only the leading term matters at the ends. Is its power even or odd? Is its coefficient positive or negative?",
    solution: steps,
  };
};

const degreeLead: Generator = (r) => {
  const kind = r.int(0, 2);
  let text: string, n: number, L: number;
  const steps: Step[] = [];
  if (kind === 0) {
    const s = scrambled(r);
    ({ text, n } = s);
    L = s.a;
    steps.push({ math: md`${mono(L, n)}`, note: "The term with the highest power is the leading term, even when it isn't written first." });
  } else if (kind === 1) {
    const f = randomFactored(r);
    ({ text, n, L } = f);
    steps.push({ math: f.leadMath, note: "Expanding would take a while. The leading term of a product is the product of the leading terms, so multiply just those." });
  } else {
    // Two sums, each written with its leading term out of front.
    const j = r.int(2, 4);
    const k = r.int(1, 3);
    const [a, b] = [r.coef(-5, 5), r.nonzero(-7, 7)];
    const [c, d] = [r.coef(-4, 4), r.nonzero(-7, 7)];
    const first = poly([[b, ""], [a, xPow(j)]]);
    const second = poly([[d, ""], [c, xPow(k)]]);
    text = `(${first})(${second})`;
    n = j + k;
    L = a * c;
    steps.push({ math: md`(${mono(a, j)})(${mono(c, k)}) = ${mono(L, n)}`, note: "Each factor's leading term is its highest-power term. Their product is the only term of degree " + n + "." });
  }
  steps.push({ math: md`(${n}, ${L})`, note: md`Degree ${n}, leading coefficient ${L}.` });
  return {
    prompt: md`Find the degree and the leading coefficient of $f(x) = ${text}$. Give them as (degree, leading coefficient), like (5, -2).`,
    answer: `(${n}, ${L})`,
    form: "tuple",
    // For huge x the leading term is all that's left.
    verify: [`l * (10^12)^d = ${subst(text, "10^12")}`],
    hint:
      kind === 0
        ? "Find the term with the highest power of x, wherever it sits in the list. Its exponent is the degree and its coefficient is the leading coefficient."
        : "You don't need to expand. Find the highest-power term of each factor and multiply them.",
    solution: steps,
  };
};

const zerosMultiplicity: Generator = (r) => {
  const variant = r.next() < 0.45 ? 0 : r.int(1, 2);
  const count = r.int(2, 3);
  const zs = shuffle(r, [-4, -3, -2, -1, 0, 1, 2, 3, 4]).slice(0, count);
  let ms: number[];
  for (;;) {
    ms = zs.map(() => (variant === 0 ? r.int(1, 2) : r.int(1, 3)));
    const even = ms.some((m) => m % 2 === 0);
    const odd = ms.some((m) => m % 2 === 1);
    if (even && odd && ms.reduce((s, m) => s + m, 0) <= 6) break;
  }
  const k = r.pick([1, -1, 2, -2]);
  const order = zs.map((z, i) => ({ z, m: ms[i]! })).sort((a, b) => (a.z === 0 ? -1 : b.z === 0 ? 1 : 0));
  const text = lead(k) + order.map(({ z, m }) => linPow(z, m)).join("");
  const p = scale(mulAll(...order.map(({ z, m }) => power([1, -z], m))), k);
  const touch = order.filter((o) => o.m % 2 === 0).map((o) => o.z);
  const cross = order.filter((o) => o.m % 2 === 1).map((o) => o.z);
  const steps: Step[] = [
    {
      math: order.map(({ z, m }) => md`x = ${z}: \text{ multiplicity } ${m}`).join(md`, \quad `),
      note: md`A factor $(x - r)^m$ gives the zero $r$ with multiplicity $m$.${order.some((o) => o.z === 0) ? md` The factor $x$ is $x - 0$.` : ""}`,
    },
    {
      math: md`\text{touches at } ${touch.join(", ")}, \quad \text{crosses at } ${cross.join(", ")}`,
      note: md`Near an even-multiplicity zero, $(x - r)^m$ is never negative, so $f$ keeps its sign and the graph turns back. An odd power changes sign, so the graph crosses.`,
    },
  ];
  if (variant === 0) {
    return {
      prompt: md`At which zeros does the graph of $f(x) = ${text}$ touch the $x$-axis and turn back without crossing? If there is more than one, separate them with commas.`,
      answer: touch.join(", "),
      form: "set",
      // A double zero is a zero of f and of its slope.
      verify: [`${text} = 0`, `${ptext(deriv(p))} = 0`],
      hint: "Read each factor's exponent. Even exponent: touch. Odd exponent: cross.",
      solution: steps,
    };
  }
  if (variant === 1) {
    return {
      prompt: md`At which zeros does the graph of $f(x) = ${text}$ cross the $x$-axis? If there is more than one, separate them with commas.`,
      answer: cross.join(", "),
      form: "set",
      hint: "Read each factor's exponent. Odd exponent: the sign changes, so the graph crosses.",
      solution: steps,
    };
  }
  const pick = r.pick(order);
  return {
    prompt: md`What is the multiplicity of the zero $x = ${pick.z}$ of $f(x) = ${text}$?`,
    answer: String(pick.m),
    hint: md`Find the factor that is 0 at $x = ${pick.z}$ and read its exponent.`,
    solution: [
      steps[0]!,
      { math: String(pick.m), note: md`The factor $${linPow(pick.z, pick.m)}$ has exponent ${pick.m}, so the graph ${pick.m % 2 ? "crosses" : "touches"} there${pick.m === 3 ? ", flattening out as it goes through" : ""}.` },
    ],
  };
};

// ── Lesson 2: Polynomial division ───────────────────────────────────────────

const syntheticDivide: Generator = (r) => {
  let p: Poly;
  let c: number;
  if (r.next() < 0.35) {
    // A dividend with missing powers.
    c = r.nonzero(-3, 3);
    const n = r.int(3, 4);
    p = [r.pick([1, 1, 2, -1]), ...new Array<number>(n).fill(0)];
    p[n] = r.nonzero(-9, 9);
    if (r.next() < 0.6) p[r.int(1, n - 1)] = r.nonzero(-6, 6);
  } else {
    c = r.nonzero(-4, 4);
    const q = [r.pick([1, 1, 2, 3, -1, -2]), ...Array.from({ length: r.int(2, 3) }, () => r.int(-5, 5))];
    p = add(mul([1, -c], q), [r.int(-9, 9)]);
  }
  const { q, rem } = synth(p, c);
  const missing = p.some((v) => v === 0);
  return {
    prompt: md`Divide $${ptext(p)}$ by $${minus(c)}$. Give the answer as (quotient, remainder), like (x^2 + 3x - 1, 4).`,
    answer: `(${ptext(q)}, ${rem})`,
    form: "tuple",
    hint: md`Use synthetic division with $c = ${c}$${c < 0 ? md`, since $${minus(c)} = x - (${c})$` : ""}.${missing ? " Write a 0 for every missing power." : ""}`,
    solution: [
      {
        math: synthTex(p, c),
        note: md`Coefficients ${missing ? "(with 0 for missing powers) " : ""}along the top. Bring down the first, then repeat: multiply by ${c}, write it under the next coefficient, add.`,
      },
      { math: md`q(x) = ${ptext(q)}, \quad r = ${rem}`, note: md`The last number is the remainder. The others are the quotient's coefficients, starting one power lower than the dividend's: $x^${q.length - 1}$.` },
      {
        math: md`${ptext(p)} = (${minus(c)})(${ptext(q)})${rem === 0 ? "" : rem < 0 ? ` - ${-rem}` : ` + ${rem}`}`,
        note: "The division algorithm: dividend = divisor times quotient, plus remainder.",
      },
    ],
  };
};

const longDivide: Generator = (r) => {
  const kind = r.int(0, 2);
  let d: Poly;
  if (kind === 0) d = [1, r.nonzero(-3, 3), r.nonzero(-4, 4)];
  else if (kind === 1) d = [1, 0, r.nonzero(-4, 4)];
  else {
    const a = r.int(2, 3);
    let b = r.nonzero(-4, 4);
    while (gcd(a, b) !== 1) b = r.nonzero(-4, 4);
    d = [a, b];
  }
  const qdeg = d.length === 3 ? r.int(1, 2) : 2;
  const qIn = [r.pick([1, 2, -1, 3]), ...Array.from({ length: qdeg }, () => r.int(-4, 4))];
  const remIn = d.length === 3 ? trim([r.int(-6, 6), r.int(-9, 9)]) : [r.int(-9, 9)];
  const p = add(mul(d, qIn), remIn);
  const { q, rem, steps } = longDivision(p, d);
  const like = d.length === 3 ? "(2x + 1, 3x - 4)" : "(x^2 + 2x - 1, 5)";
  const missing = p.some((v) => v === 0) || d.some((v) => v === 0);
  return {
    prompt: md`Divide $${ptext(p)}$ by $${ptext(d)}$. Give the answer as (quotient, remainder), like ${like}.`,
    answer: `(${ptext(q)}, ${ptext(rem)})`,
    form: "tuple",
    hint: md`Long division: divide the leading term of what's left by $${mono(d[0]!, d.length - 1)}$, multiply, subtract, repeat. Stop when what's left has degree less than ${d.length - 1}.${missing ? " Keep missing powers in mind as 0 terms." : ""}`,
    solution: [
      ...steps,
      {
        math: md`q(x) = ${ptext(q)}, \quad r(x) = ${ptext(rem)}`,
        note: md`What's left has degree less than the divisor's, so it is the remainder.`,
      },
    ],
  };
};

// ── Lesson 3: The remainder and factor theorems ─────────────────────────────

const remainderValue: Generator = (r) => {
  const roll = r.next();
  if (roll < 0.5) {
    const c = r.nonzero(-3, 3);
    const n = r.int(3, Math.abs(c) === 3 ? 4 : 5);
    const p = [r.pick([1, 2, -1, 3]), ...Array.from({ length: n }, () => (r.next() < 0.3 ? 0 : r.int(-6, 6)))];
    if (p[n] === 0) p[n] = r.nonzero(-6, 6);
    const value = at(p, c);
    return {
      prompt: md`Find the remainder when $${ptext(p)}$ is divided by $${minus(c)}$.`,
      answer: String(value),
      verify: [`r = ${subst(ptext(p), c)}`],
      hint: md`By the remainder theorem, the remainder is $p(${c})$.${c < 0 ? md` Careful: $${minus(c)} = x - (${c})$.` : ""}`,
      solution: [
        { math: md`p(${c}) = ${subst(ptext(p), c)}`, note: md`The remainder on dividing by $x - c$ is $p(c)$, here with $c = ${c}$.` },
        { math: md`= ${termSum(p, c)}`, note: "Powers first, then the products." },
        { math: String(value), note: "That number is the remainder." },
      ],
    };
  }
  if (roll < 0.75) {
    // A huge power: the theorem's real advantage.
    const c = r.pick([1, -1]);
    const N = r.pick([20, 25, 50, 75, 100]);
    const k = r.int(2, 7);
    const a = r.coef(-5, 5);
    const b = r.nonzero(-9, 9);
    const p = new Array<number>(N + 1).fill(0);
    p[0] = 1;
    p[N - k] = a;
    p[N] = b;
    const value = at(p, c);
    return {
      prompt: md`Find the remainder when $${ptext(p)}$ is divided by $${minus(c)}$.`,
      answer: String(value),
      verify: [`r = ${subst(ptext(p), c)}`],
      hint: md`Long division would take ${N} steps. The remainder theorem says it is $p(${c})$. ${c < 0 ? "An even power of -1 is 1; an odd power is -1." : "Every power of 1 is 1."}`,
      solution: [
        { math: md`p(${c}) = ${subst(ptext(p), c)}`, note: md`Remainder theorem with $c = ${c}$.` },
        { math: md`= ${termSum(p, c)}`, note: c < 0 ? md`$(-1)^{${N}} = ${(-1) ** N}$ because ${N} is ${N % 2 ? "odd" : "even"}, and $(-1)^${k} = ${(-1) ** k}$.` : "Every power of 1 is 1." },
        { math: String(value), note: "" },
      ],
    };
  }
  // Dividing by ax - b: the remainder is p(b/a).
  const a = r.int(2, 3);
  let b = r.nonzero(-3, 3);
  while (gcd(a, b) !== 1) b = r.nonzero(-3, 3);
  const n = r.int(2, 3);
  const p = [r.pick([1, 2, 4, -2]), ...Array.from({ length: n }, () => r.int(-6, 6))];
  if (p[n] === 0) p[n] = r.nonzero(-6, 6);
  const nums = p.map((c, i) => c * b ** (n - i) * a ** i);
  const N = nums.reduce((s, v) => s + v, 0);
  const D = a ** n;
  const xTex = md`\left(${fracTex(b, a)}\right)`;
  return {
    prompt: md`Find the remainder when $${ptext(p)}$ is divided by $${ptext([a, -b])}$. Fractions are fine, like 7/4.`,
    answer: frac(N, D),
    verify: [`r = ${subst(ptext(p), `${b}/${a}`)}`],
    hint: md`$${ptext([a, -b])} = 0$ when $x = ${fracTex(b, a)}$. Substituting that into $p(x) = (${ptext([a, -b])})q(x) + r$ wipes out the first part.`,
    solution: [
      { math: md`${ptext([a, -b])} = 0 \iff x = ${fracTex(b, a)}`, note: "The value of x that makes the divisor 0." },
      { math: md`p\left(${fracTex(b, a)}\right) = ${ptext(p).replace(/x/g, xTex)}`, note: md`In $p(x) = (${ptext([a, -b])})q(x) + r$, this value makes the first product 0, so $r = p\left(${fracTex(b, a)}\right)$.` },
      { math: md`= \frac{${poly(nums.map((v): [number, string] => [v, ""]).filter(([v]) => v !== 0))}}{${D}}`, note: md`Put every term over the common denominator $${a}^${n} = ${D}$.` },
      { math: fracTex(N, D), note: "" },
    ],
  };
};

const findK: Generator = (r) => {
  const c = r.nonzero(-3, 3);
  const j = r.int(1, 2); // the power k multiplies
  const a = r.pick([1, 1, 2, -1]);
  const k = r.nonzero(-6, 6);
  const other = r.int(-6, 6);
  const otherPow = 3 - j; // the remaining middle power (2 or 1)
  const factor = r.next() < 0.6;
  const target = factor ? 0 : r.nonzero(-8, 8);
  const base0 = a * c ** 3 + other * c ** otherPow;
  const B0 = target - (base0 + k * c ** j);
  // Build the text term by term so k can sit in its place.
  let text = mono(a, 3);
  for (const pwr of [2, 1, 0]) {
    if (pwr === j) {
      text += ` + k${xPow(pwr)}`;
      continue;
    }
    const v = pwr === otherPow ? other : pwr === 0 ? B0 : 0;
    if (v === 0) continue;
    const mag = Math.abs(v) === 1 && pwr > 0 ? xPow(pwr) : `${Math.abs(v)}${xPow(pwr)}`;
    text += v < 0 ? ` - ${mag}` : ` + ${mag}`;
  }
  const atC = subst(text, c);
  const base = base0 + B0;
  const cj = c ** j;
  return {
    prompt: factor
      ? md`Find the value of $k$ that makes $${minus(c)}$ a factor of $${text}$.`
      : md`When $${text}$ is divided by $${minus(c)}$, the remainder is $${target}$. Find the value of $k$.`,
    answer: String(k),
    verify: [`${atC} = ${target}`],
    hint: factor
      ? md`By the factor theorem, $${minus(c)}$ is a factor exactly when $p(${c}) = 0$. Substitute and solve for $k$.`
      : md`By the remainder theorem, the remainder is $p(${c})$. Set it equal to ${target} and solve for $k$.`,
    solution: [
      { math: md`p(${c}) = ${atC} = ${target}`, note: factor ? "Factor theorem: the remainder must be 0." : "Remainder theorem: the remainder is p(c)." },
      { math: md`${poly([[cj, "k"], [base, ""]])} = ${target}`, note: "Work out every number. Only k is left." },
      // Skip a step when it would repeat the line above it.
      ...(base === 0 ? [] : [{ math: md`${poly([[cj, "k"]])} = ${target - base}`, note: md`${base > 0 ? "Subtract" : "Add"} ${Math.abs(base)}.` }]),
      ...(cj === 1 ? [] : [{ math: md`k = ${k}`, note: md`Divide by ${cj}.` }]),
    ],
  };
};

const factorGiven: Generator = (r) => {
  const c = r.nonzero(-4, 4);
  if (r.next() < 0.6) {
    const kind = r.int(0, 2);
    let Q: Poly;
    let qText: string;
    if (kind === 0) {
      let s = r.nonzero(-5, 5);
      while (s === c) s = r.nonzero(-5, 5);
      let t = r.nonzero(-5, 5);
      while (t === c || t === s) t = r.nonzero(-5, 5);
      Q = mul([1, -s], [1, -t]);
      qText = lin(s) + lin(t);
    } else if (kind === 1) {
      const qa = r.int(2, 3);
      let qb = r.nonzero(-5, 5);
      while (gcd(qa, qb) !== 1) qb = r.nonzero(-5, 5);
      let s = r.nonzero(-4, 4);
      while (s === c) s = r.nonzero(-4, 4);
      Q = mul([qa, -qb], [1, -s]);
      qText = linQP(qa, qb) + lin(s);
    } else {
      // A quadratic with no rational roots.
      let b: number, e: number;
      for (;;) {
        b = r.int(-3, 3);
        e = r.nonzero(-5, 6);
        const D = b * b - 4 * e;
        if (D < 0 || Math.round(Math.sqrt(D)) ** 2 !== D) break;
      }
      Q = [1, b, e];
      qText = `(${ptext(Q)})`;
    }
    const p = mul([1, -c], Q);
    const answer = lin(c) + qText;
    const D = Q[1]! ** 2 - 4 * Q[0]! * Q[2]!;
    return {
      prompt: md`Factor $${ptext(p)}$ completely. One factor is $${minus(c)}$.`,
      answer,
      factored: true,
      hint: md`Divide by $${minus(c)}$ with synthetic division ($c = ${c}$). The quotient is a quadratic; factor it if you can.`,
      solution: [
        { math: synthTex(p, c), note: md`Remainder 0, as the factor theorem promises, since $p(${c}) = 0$.` },
        { math: md`${ptext(p)} = (${minus(c)})(${ptext(Q)})`, note: "The bottom row gives the quadratic quotient." },
        kind === 2
          ? { math: answer, note: md`The discriminant of $${ptext(Q)}$ is $${D}$, ${D < 0 ? "negative" : "not a perfect square"}, so it has no rational roots and doesn't factor over the integers.` }
          : { math: answer, note: md`Factor the quadratic (Algebra 1, Unit 7).` },
      ],
    };
  }
  // Solve: the leftover quadratic has irrational roots.
  const h = r.int(-2, 2);
  const s = r.pick([2, 3, 5, 6, 7]);
  const Q = [1, -2 * h, h * h - s];
  const p = mul([1, -c], Q);
  return {
    prompt: md`Solve $${ptext(p)} = 0$. One solution is $x = ${c}$. Give all solutions, separated by commas, with square roots like 1 + sqrt(2).`,
    answer: [String(c), ...surdPair(h, s)].join(", "),
    form: "set",
    simplified: true,
    hint: md`Since $x = ${c}$ is a solution, $${minus(c)}$ is a factor. Divide it out, then solve the quadratic that's left.`,
    solution: [
      { math: synthTex(p, c), note: md`Synthetic division by $${minus(c)}$. The remainder is 0, as it must be.` },
      { math: md`(${minus(c)})(${ptext(Q)}) = 0`, note: "Zero product property: either factor can be 0." },
      { math: md`${h === 0 ? "x^2" : `(${minus(h)})^2`} = ${s}`, note: h === 0 ? "Isolate the square." : md`Complete the square: $${ptext(Q)} = (${minus(h)})^2 - ${s}$.` },
      { math: md`x = ${c} \quad\text{or}\quad x = ${surdTex(h, s)}`, note: "Take square roots. All three solutions together." },
    ],
  };
};

// ── Lesson 4: Rational root theorem ─────────────────────────────────────────

const candidateList: Generator = (r) => {
  let an: number, a0: number, values: [number, number][];
  for (;;) {
    an = r.pick([1, 2, 2, 3, 3, 4]);
    a0 = r.sign() * r.pick([2, 3, 4, 5, 6, 8, 9, 10]);
    const seen = new Set<string>();
    values = [];
    for (const q of divisors(an)) {
      for (const p of divisors(a0)) {
        const key = frac(p, q);
        if (!seen.has(key)) {
          seen.add(key);
          values.push([p, q]);
        }
      }
    }
    if (values.length <= 8) break;
  }
  const n = r.int(3, 4);
  const poly0 = [an, ...Array.from({ length: n - 1 }, () => r.int(-7, 7)), a0];
  values.sort((x, y) => x[0] / x[1] - y[0] / y[1]);
  const items = values.flatMap(([p, q]) => [frac(p, q), frac(-p, q)]);
  return {
    prompt: md`List every possible rational zero of $f(x) = ${ptext(poly0)}$ that the rational root theorem allows. Separate them with commas; you can write ± as +/-, like +/-1, +/-1/2.`,
    answer: items.join(", "),
    form: "set",
    simplified: true,
    hint: md`Each candidate is $\pm\frac{p}{q}$, with $p$ a factor of the constant term ${a0} and $q$ a factor of the leading coefficient ${an}.`,
    solution: [
      { math: md`p \in \{${divisors(a0).join(", ")}\}, \quad q \in \{${divisors(an).join(", ")}\}`, note: md`Factors of the constant term ${a0}${a0 < 0 ? " (ignore the sign for now)" : ""}, and of the leading coefficient ${an}.` },
      {
        math: values.map(([p, q]) => md`\pm ${fracTex(p, q)}`).join(", "),
        note: "Every p over every q, reduced, with repeats removed. Each can be positive or negative.",
      },
    ],
  };
};

const solveRational: Generator = (r) => {
  const kind = r.int(0, 2);
  const a = r.int(2, 3);
  let b = r.nonzero(-5, 5);
  while (gcd(a, b) !== 1) b = r.nonzero(-5, 5);
  let s = r.nonzero(-4, 4);
  let p: Poly, rest: Poly, roots: string[], finish: Step[];
  if (kind === 0) {
    let t = r.nonzero(-4, 4);
    while (t === s) t = r.nonzero(-4, 4);
    p = mulAll([a, -b], [1, -s], [1, -t]);
    rest = mul([a, -b], [1, -t]);
    roots = [String(s), frac(b, a), String(t)];
    finish = [
      { math: md`${ptext(rest)} = ${linQP(a, b)}${lin(t)}`, note: "Factor the quadratic quotient." },
      { math: md`x = ${s}, \quad x = ${fracTex(b, a)}, \quad x = ${t}`, note: "Set each factor to 0." },
    ];
  } else if (kind === 1) {
    const h = r.int(-2, 2);
    const m = r.pick([2, 3, 5]);
    const Q = [1, -2 * h, h * h - m];
    p = mul([a, -b], Q);
    // The integer test is replaced by the fractional root b/a.
    s = NaN;
    rest = scale(Q, a);
    roots = [frac(b, a), ...surdPair(h, m)];
    finish = [
      { math: md`${ptext(rest)} = ${a}(${ptext(Q)})`, note: md`The quotient has a common factor ${a}. Divide it out.` },
      { math: md`${h === 0 ? "x^2" : `(${minus(h)})^2`} = ${m}`, note: h === 0 ? "Isolate the square." : "Complete the square." },
      { math: md`x = ${fracTex(b, a)}, \quad x = ${surdTex(h, m)}`, note: "The rational root and the two irrational ones the theorem could never have listed." },
    ];
  } else {
    const c2 = a === 2 ? 3 : 2;
    let d2 = r.nonzero(-4, 4);
    while (gcd(c2, d2) !== 1) d2 = r.nonzero(-4, 4);
    p = mulAll([a, -b], [c2, -d2], [1, -s]);
    rest = mul([a, -b], [c2, -d2]);
    roots = [String(s), frac(b, a), frac(d2, c2)];
    finish = [
      { math: md`${ptext(rest)} = ${linQP(a, b)}${linQP(c2, d2)}`, note: "Factor the quadratic quotient (by grouping or the ac method)." },
      { math: md`x = ${s}, \quad x = ${fracTex(b, a)}, \quad x = ${fracTex(d2, c2)}`, note: "Set each factor to 0." },
    ];
  }
  const an = p[0]!;
  const a0 = p[p.length - 1]!;
  const testStep: Step = Number.isNaN(s)
    ? { math: md`f\left(${fracTex(b, a)}\right) = 0`, note: md`No integer candidate works, but $${fracTex(b, a)}$ does: its numerator divides ${a0} and its denominator divides ${an}.` }
    : { math: md`f(${s}) = ${termSum(p, s)} = 0`, note: md`Test candidates. $x = ${s}$ works: ${Math.abs(s)} divides the constant term ${a0}.` };
  const [num, den] = Number.isNaN(s) ? [b, a] : [s, 1];
  return {
    prompt: md`Solve $${ptext(p)} = 0$. Give all real solutions, separated by commas. Use fractions like 3/2, and sqrt for square roots, like 1 + sqrt(3).`,
    answer: roots.join(", "),
    form: "set",
    simplified: true,
    hint: md`Rational candidates are $\pm\frac{p}{q}$ with $p$ dividing ${Math.abs(a0)} and $q$ dividing ${an}. Find one that works, divide it out, then solve the quadratic.`,
    solution: [
      { math: md`\pm\frac{\text{factors of } ${Math.abs(a0)}}{\text{factors of } ${an}}`, note: "The rational root theorem's list of candidates." },
      testStep,
      { math: synthTex(p, num, den), note: md`Divide by $${Number.isNaN(s) ? minusFrac(b, a) : minus(s)}$ with synthetic division. Remainder 0.` },
      ...finish,
    ],
  };
};

const factorRational: Generator = (r) => {
  const kind = r.int(0, 2);
  const a = r.int(2, 3);
  let b = r.nonzero(-5, 5);
  while (gcd(a, b) !== 1) b = r.nonzero(-5, 5);
  let s = r.nonzero(-3, 3);
  let t = r.nonzero(-3, 3);
  while (t === s) t = r.nonzero(-3, 3);
  let p: Poly, answer: string, steps: Step[];
  if (kind === 0) {
    p = mulAll([a, -b], [1, -s], [1, -t]);
    answer = linQP(a, b) + lin(s) + lin(t);
    const { q } = synth(p, s);
    steps = [
      { math: md`f(${s}) = ${termSum(p, s)} = 0`, note: md`$${s}$ is on the candidate list ($\pm$ factors of ${Math.abs(p[3]!)} over factors of ${p[0]}), and it works.` },
      { math: synthTex(p, s), note: md`Divide out $${minus(s)}$.` },
      { math: md`${ptext(p)} = (${minus(s)})(${ptext(q)})`, note: "" },
      { math: answer, note: "Factor the quadratic quotient." },
    ];
  } else if (kind === 1) {
    const m = r.pick([1, 2, 3, 5, -2, -3]);
    const Q = [1, 0, m];
    p = mulAll([a, -b], [1, -s], Q);
    answer = linQP(a, b) + lin(s) + `(${ptext(Q)})`;
    const { q } = synth(p, s);
    steps = [
      { math: md`f(${s}) = ${termSum(p, s)} = 0`, note: md`$${s}$ is a candidate (it divides the constant term ${p[4]}), and it works.` },
      { math: synthTex(p, s), note: md`Divide out $${minus(s)}$. The quotient is a cubic.` },
      { math: md`${ptext(q)} = ${linQP(a, b)}(${ptext(Q)})`, note: md`The cubic factors by grouping, or test $x = ${fracTex(b, a)}$ again with the theorem.` },
      { math: answer, note: m > 0 ? md`$${ptext(Q)}$ is always positive, so it has no real roots at all.` : md`$${ptext(Q)}$ has roots $\pm\sqrt{${-m}}$, which are irrational, so it doesn't factor over the integers.` },
    ];
  } else {
    const k = r.pick([2, 3, -2, -1]);
    let u = r.nonzero(-4, 4);
    while (u === s || u === t) u = r.nonzero(-4, 4);
    const monic = mulAll([1, -s], [1, -t], [1, -u]);
    p = scale(monic, k);
    answer = lead(k) + lin(s) + lin(t) + lin(u);
    const { q } = synth(monic, s);
    steps = [
      { math: md`${ptext(p)} = ${k === -1 ? "-" : k}(${ptext(monic)})`, note: md`Take out the common factor ${k} first. Now the leading coefficient is 1, so every rational root is an integer that divides ${monic[3]}.` },
      { math: synthTex(monic, s), note: md`$x = ${s}$ works. Divide it out.` },
      { math: md`${ptext(q)} = ${lin(t)}${lin(u)}`, note: "Factor the quadratic quotient." },
      { math: answer, note: "" },
    ];
  }
  return {
    prompt: md`Factor $${ptext(p)}$ completely.`,
    answer,
    factored: true,
    hint: "Use the rational root theorem to find a zero c, divide out x - c, and keep going until every factor is linear or can't be factored over the integers.",
    solution: steps,
  };
};

// ── Lesson 5: The fundamental theorem of algebra ────────────────────────────

const COMPLEX_FORM = "Give all solutions, separated by commas, in a + bi form, like 2 + 3i, 2 - 3i, or 1 + sqrt(3)i.";

/** x^2 - 2hx + (h^2 + k^2), whose roots are h ± ki. */
const pairQuad = (h: number, k: number): Poly => [1, -2 * h, h * h + k * k];

const pairSteps = (h: number, k: number): Step[] => {
  const Q = pairQuad(h, k);
  const ki = `${k === 1 ? "" : k}i`;
  if (h === 0) {
    // x^2 + k^2 = 0 needs no formula.
    return [
      { math: md`x^2 = ${-k * k}`, note: md`Solve $${ptext(Q)} = 0$ for $x^2$.` },
      { math: md`x = \pm ${ki}`, note: md`$\sqrt{${-k * k}} = ${ki}$ (Unit 2), and its opposite. The two roots are conjugates.` },
    ];
  }
  return [
    { math: md`x = \frac{${2 * h} \pm \sqrt{${4 * h * h} - ${4 * Q[2]!}}}{2} = \frac{${2 * h} \pm \sqrt{${-4 * k * k}}}{2}`, note: md`Quadratic formula on $${ptext(Q)} = 0$. The discriminant is negative.` },
    { math: md`x = \frac{${2 * h} \pm ${2 * k}i}{2} = ${h} \pm ${ki}`, note: md`$\sqrt{${-4 * k * k}} = ${2 * k}i$ (Unit 2). The two roots are conjugates.` },
  ];
};

const complexSolve: Generator = (r) => {
  const kind = r.next() < 0.5 ? 0 : r.int(1, 2);
  if (kind === 0) {
    const h = r.int(-3, 3);
    const k = r.int(1, 3);
    const Q = pairQuad(h, k);
    const a = r.next() < 0.3 ? 2 : 1;
    let b = r.nonzero(-3, 3);
    while (gcd(a, b) !== 1) b = r.nonzero(-3, 3);
    const p = mul([a, -b], Q);
    const rest = scale(Q, a);
    return {
      prompt: md`Solve $${ptext(p)} = 0$ over the complex numbers. ${COMPLEX_FORM}`,
      answer: [frac(b, a), cx(h, k), cx(h, -k)].join(", "),
      form: "set",
      complex: true,
      simplified: true,
      hint: md`Degree 3, so there are 3 solutions. Find a rational one with the rational root theorem, divide it out, and use the quadratic formula on what's left.`,
      solution: [
        { math: a === 1 ? md`f(${b}) = ${termSum(p, b)} = 0` : md`f\left(${fracTex(b, a)}\right) = 0`, note: md`Test candidates $\pm\frac{\text{factors of } ${Math.abs(p[3]!)}}{\text{factors of } ${a}}$. This one works.` },
        { math: synthTex(p, b, a), note: md`Divide out $${a === 1 ? minus(b) : minusFrac(b, a)}$.` },
        ...(a === 1 ? [] : [{ math: md`${ptext(rest)} = ${a}(${ptext(Q)})`, note: md`Divide the quotient by ${a}; it doesn't change the roots.` }]),
        ...pairSteps(h, k),
      ],
    };
  }
  if (kind === 1) {
    const real = r.next() < 0.5;
    const m = r.int(1, 4);
    let k = r.int(1, 4);
    while (k === m) k = r.int(1, 4);
    const first: Poly = real ? [1, 0, -m * m] : [1, 0, m * m];
    const p = mul(first, [1, 0, k * k]);
    const firstRoots = real ? [String(m), String(-m)] : [cx(0, m), cx(0, -m)];
    return {
      prompt: md`Solve $${ptext(p)} = 0$ over the complex numbers. ${COMPLEX_FORM}`,
      answer: [...firstRoots, cx(0, k), cx(0, -k)].join(", "),
      form: "set",
      complex: true,
      simplified: true,
      hint: md`Only even powers appear. Treat $x^2$ as one unknown, $u$, and factor the quadratic in $u$.`,
      solution: [
        { math: md`${ptext([1, p[2]!, p[4]!]).replace(/x/g, "u")} = 0`, note: md`Write $u = x^2$, so $x^4 = u^2$.` },
        { math: md`(${ptext([1, first[2]!]).replace(/x/g, "u")})(${ptext([1, k * k]).replace(/x/g, "u")}) = 0`, note: "Factor the quadratic in u." },
        { math: md`x^2 = ${real ? m * m : -m * m} \quad\text{or}\quad x^2 = ${-k * k}`, note: md`Put $x^2$ back for $u$.` },
        { math: md`x = ${real ? md`\pm ${m}` : md`\pm ${m === 1 ? "" : m}i`} \quad\text{or}\quad x = \pm ${k === 1 ? "" : k}i`, note: md`A negative number has two imaginary square roots: $\sqrt{-${k * k}} = ${k === 1 ? "" : k}i$, and its opposite.` },
      ],
    };
  }
  // x^3 - c^3 or x^3 + c^3.
  const c = r.pick([1, 2, 3]);
  const sign = r.sign(); // root of the real factor
  const real = sign * c;
  const p: Poly = [1, 0, 0, -(real ** 3)];
  const Q = [1, real, real * real]; // x^3 - real^3 = (x - real)(x^2 + real x + real^2)
  // Roots of Q: (-real ± sqrt(-3 real^2))/2 = -real/2 ± (c sqrt(3)/2) i
  const re = frac(-real, 2);
  // Written (1/2)sqrt(3), not sqrt(3)/2: the simplified check compares sizes, and the longer key lets (1/2)sqrt(3)i through too.
  const im = c === 2 ? "sqrt(3)" : `(${c}/2)sqrt(3)`;
  const reTex = fracTex(-real, 2);
  const imTex = c === 2 ? md`\sqrt{3}` : md`\frac{${c === 1 ? "" : c}\sqrt{3}}{2}`;
  return {
    prompt: md`Solve $${ptext(p)} = 0$ over the complex numbers. ${COMPLEX_FORM}`,
    answer: [String(real), `${re} + ${im}i`, `${re} - ${im}i`].join(", "),
    form: "set",
    complex: true,
    simplified: true,
    hint: md`One solution is real: $x = ${real}$. Divide out $${minus(real)}$ and use the quadratic formula on the rest.`,
    solution: [
      { math: md`x^3 = ${real ** 3} \implies x = ${real} \text{ is one solution}`, note: md`$(${real})^3 = ${real ** 3}$. But a cubic has three roots.` },
      { math: synthTex(p, real), note: md`Divide by $${minus(real)}$, with zeros for the missing $x^2$ and $x$ terms.` },
      { math: md`x = \frac{${-real} \pm \sqrt{${real * real} - ${4 * real * real}}}{2} = \frac{${-real} \pm \sqrt{${-3 * real * real}}}{2}`, note: md`Quadratic formula on $${ptext(Q)} = 0$.` },
      { math: md`x = ${reTex} \pm ${imTex}\,i`, note: md`$\sqrt{${-3 * real * real}} = ${c === 1 ? "" : c}\sqrt{3}\,i$. These two and $x = ${real}$ are all three solutions.` },
    ],
  };
};

const buildPolynomial: Generator = (r) => {
  const kind = r.int(0, 2);
  let p: Poly, zerosTex: string, steps: Step[];
  if (kind === 0) {
    const r0 = r.nonzero(-4, 4);
    const h = r.int(-3, 3);
    const k = r.sign() * r.int(1, 3);
    const Q = pairQuad(h, k);
    p = mul([1, -r0], Q);
    zerosTex = md`zeros $${r0}$ and $${cx(h, k)}$`;
    steps = [
      { math: md`${cx(h, -k)} \text{ is also a zero}`, note: "Real coefficients force complex zeros to come in conjugate pairs. That makes three zeros, so degree 3 is the least possible." },
      { math: md`${zFactor(h, k)}${zFactor(h, -k)} = ${h === 0 ? "x^2" : `(${minus(h)})^2`} - ${iSq(k)} = ${ptext(Q)}`, note: md`A conjugate pair multiplies like a difference of squares, and $${iSq(k)} = ${-k * k}$.` },
      { math: md`(${minus(r0)})(${ptext(Q)}) = ${ptext(p)}`, note: "Multiply by the factor for the real zero and expand." },
    ];
  } else if (kind === 1) {
    const r0 = r.nonzero(-3, 3);
    const k = r.int(1, 3);
    const Q: Poly = [1, 0, k * k];
    const sq = power([1, -r0], 2);
    p = mul(Q, sq);
    zerosTex = md`a zero $${cx(0, k)}$ and a zero $${r0}$ of multiplicity 2`;
    steps = [
      { math: md`${cx(0, -k)} \text{ is also a zero}`, note: md`Its conjugate. With $${r0}$ counted twice, that's four zeros: degree 4.` },
      { math: md`(x - ${cx(0, k)})(x + ${cx(0, k)}) = ${ptext(Q)}`, note: md`Difference of squares: $x^2 - ${iSq(k)} = x^2 + ${k * k}$.` },
      { math: md`${lin(r0)}^2 = ${ptext(sq)}`, note: "Multiplicity 2 means the factor appears twice." },
      { math: md`(${ptext(Q)})(${ptext(sq)}) = ${ptext(p)}`, note: "Multiply and expand." },
    ];
  } else {
    const r1 = r.nonzero(-3, 3);
    let r2 = r.nonzero(-3, 3);
    while (r2 === r1) r2 = r.nonzero(-3, 3);
    const h = r.int(-2, 2);
    const k = r.int(1, 2);
    const Q = pairQuad(h, k);
    const L = mul([1, -r1], [1, -r2]);
    p = mul(L, Q);
    zerosTex = md`zeros $${r1}$, $${r2}$ and $${cx(h, k)}$`;
    steps = [
      { math: md`${cx(h, -k)} \text{ is also a zero}`, note: "The conjugate comes along, so there are four zeros: degree 4." },
      { math: md`${zFactor(h, k)}${zFactor(h, -k)} = ${ptext(Q)}`, note: md`Conjugate pair: ${h === 0 ? md`$x^2 - ${iSq(k)}$` : md`$(${minus(h)})^2 - ${iSq(k)}$`}.` },
      { math: md`${lin(r1)}${lin(r2)} = ${ptext(L)}`, note: "The two real zeros." },
      { math: md`(${ptext(L)})(${ptext(Q)}) = ${ptext(p)}`, note: "Multiply and expand." },
    ];
  }
  return {
    prompt: md`Find the polynomial of least degree, with real coefficients and leading coefficient 1, that has ${zerosTex}. Write it expanded, in standard form.`,
    answer: ptext(p),
    expanded: true,
    simplified: true,
    hint: "A polynomial with real coefficients that has a complex zero a + bi also has the zero a - bi. Write a factor x - z for every zero, then multiply.",
    solution: steps,
  };
};

const complexGivenZero: Generator = (r) => {
  const kind = r.int(0, 2);
  const h = r.int(-2, 2);
  const k = r.int(1, 3);
  const Q = pairQuad(h, k);
  const given = r.next() < 0.5 ? cx(h, k) : cx(h, -k);
  let rest: Poly, restRoots: string[], restSteps: Step[];
  if (kind === 0) {
    const s = r.nonzero(-3, 3);
    let t = r.nonzero(-3, 3);
    while (t === s) t = r.nonzero(-3, 3);
    rest = mul([1, -s], [1, -t]);
    restRoots = [String(s), String(t)];
    restSteps = [{ math: md`${ptext(rest)} = ${lin(s)}${lin(t)} = 0 \implies x = ${s}, \; x = ${t}`, note: "Factor the quotient." }];
  } else if (kind === 1) {
    const a = r.int(1, 3);
    let b = r.nonzero(-4, 4);
    while (gcd(a, b) !== 1) b = r.nonzero(-4, 4);
    rest = [a, -b];
    restRoots = [frac(b, a)];
    restSteps = [{ math: md`${ptext(rest)} = 0 \implies x = ${fracTex(b, a)}`, note: "The quotient is linear." }];
  } else {
    let m = r.int(1, 3);
    while (h === 0 && m === k) m = r.int(1, 3);
    rest = [1, 0, m * m];
    restRoots = [cx(0, m), cx(0, -m)];
    restSteps = [{ math: md`${ptext(rest)} = 0 \implies x^2 = ${-m * m} \implies x = \pm ${m === 1 ? "" : m}i`, note: "The quotient has two imaginary roots of its own." }];
  }
  const p = mul(Q, rest);
  const { steps } = longDivision(p, Q);
  return {
    prompt: md`Solve $${ptext(p)} = 0$ over the complex numbers, given that $${given}$ is a solution. ${COMPLEX_FORM}`,
    answer: [cx(h, k), cx(h, -k), ...restRoots].join(", "),
    form: "set",
    complex: true,
    simplified: true,
    hint: md`The coefficients are real, so the conjugate of $${given}$ is a solution too. Multiply the two factors to get a real quadratic, divide it out, and solve what's left.`,
    solution: [
      { math: md`${cx(h, k)} \text{ and } ${cx(h, -k)}`, note: "Conjugate pair theorem: both are solutions." },
      { math: md`${zFactor(h, k)}${zFactor(h, -k)} = ${ptext(Q)}`, note: md`${h === 0 ? md`$x^2 - ${iSq(k)}$` : md`$(${minus(h)})^2 - ${iSq(k)}$`}: a difference of squares with real coefficients.` },
      ...steps,
      { math: md`${ptext(p)} = (${ptext(Q)})(${ptext(rest)})`, note: "Remainder 0. The quotient collects the terms found in each step." },
      ...restSteps,
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "Polynomial Functions",
  lessons: [
    {
      id: "end-behavior-and-degree",
      title: "End behavior and degree",
      summary: "Why the leading term alone decides where a polynomial's graph goes at the ends, and how a zero's multiplicity shapes the graph there.",
      blocks: [
        {
          kind: "text",
          body: md`Polynomials got their name in Algebra 1, Unit 6, and Algebra 1 graphed two kinds of them: lines and parabolas. This unit takes on all of them. Two questions tell you most of what a polynomial graph looks like:

- What happens far out to the left and right? That's its **end behavior**.
- What happens where it meets the $x$-axis? That's its **zeros**.

Both answers can be read off the formula, without plotting a single point.`,
        },
        {
          kind: "key",
          title: "Polynomial function",
          body: md`$$f(x) = a_nx^n + a_{n-1}x^{n-1} + \cdots + a_1x + a_0, \qquad a_n \ne 0$$

The exponents are whole numbers. $n$ is the **degree**, $a_nx^n$ is the **leading term**, and $a_n$ is the **leading coefficient**. The constant term is $a_0 = f(0)$, the $y$-intercept.`,
        },
        {
          kind: "text",
          body: md`Take $f(x) = x^3 - 3x^2 - 6x + 8$ and compare it with its leading term $x^3$ as $x$ grows:

$$\begin{array}{c|c|c|c} x & f(x) & x^3 & f(x)/x^3 \\ \hline 10 & 648 & 1000 & 0.648 \\ 100 & 969\,408 & 1\,000\,000 & 0.969408 \\ 1000 & 996\,994\,008 & 1\,000\,000\,000 & 0.996994 \end{array}$$

The ratio is heading to 1. Far out, $f$ and $x^3$ are nearly the same number.`,
        },
        {
          kind: "why",
          title: "Why the leading term wins",
          body: md`Factor the leading term out of every term:

$$f(x) = x^3\left(1 - \frac{3}{x} - \frac{6}{x^2} + \frac{8}{x^3}\right).$$

When $x$ is huge, a fixed number divided by $x$ is tiny: $\frac{3}{1000} = 0.003$. So every fraction in the bracket shrinks toward 0 and the bracket itself gets close to 1. What's left is $f(x) \approx x^3$. The same is true for large negative $x$, since $\frac{3}{x}$ is tiny then too.

Nothing here is special to this $f$. For any polynomial,

$$f(x) = a_nx^n\left(1 + \frac{a_{n-1}}{a_n x} + \cdots + \frac{a_0}{a_n x^n}\right),$$

and the bracket goes to 1. Each lower term has fewer factors of $x$, so it loses to the leading term once $x$ is big enough.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-12, 12],
          curves: [
            { expr: "((s x)^3 - 3(s x)^2 - 6(s x) + 8)/s^3", label: "f, zoomed out", color: 1 },
            { expr: "x^3", label: "y = x^3", color: 2, dashed: true },
          ],
          params: [{ name: "s", label: "zoom out", min: 1, max: 20, step: 1, value: 1 }],
          caption: md`The slider zooms out: at zoom $s$, the window shows $s$ times as much of the $x$-axis and $s^3$ times as much of the $y$-axis. $y = x^3$ looks the same at every zoom, because $\frac{(sx)^3}{s^3} = x^3$. Watch the bumps of $f$ (zeros at $-2$, $1$ and $4$) shrink into the origin until $f$ is just $x^3$.`,
        },
        {
          kind: "key",
          title: "End behavior",
          body: md`The ends of the graph follow the leading term $a_nx^n$:

- **Even degree, $a_n > 0$:** left end up, right end up (like $x^2$).
- **Even degree, $a_n < 0$:** left end down, right end down (like $-x^2$).
- **Odd degree, $a_n > 0$:** left end down, right end up (like $x^3$).
- **Odd degree, $a_n < 0$:** left end up, right end down (like $-x^3$).

"Right end up" is written $f(x) \to \infty$ as $x \to \infty$: the outputs grow without bound as $x$ does.`,
        },
        {
          kind: "why",
          title: "Why the parity of the degree matters",
          body: md`For large positive $x$, every power $x^n$ is large and positive. For large negative $x$, write $x = -t$ with $t$ large and positive. Then

$$x^n = (-t)^n = (-1)^n t^n.$$

If $n$ is even, the minus signs pair off and $(-1)^n = 1$: the left end goes the same way as the right. If $n$ is odd, one minus sign is left over: the left end goes the opposite way. Finally, multiplying by $a_n$ keeps both directions if $a_n > 0$ and flips both if $a_n < 0$.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-6, 6],
          curves: [{ expr: "a x^n", label: "y = a x^n" }],
          params: [
            { name: "n", label: "degree n", min: 1, max: 6, step: 1, value: 3 },
            { name: "a", min: -2, max: 2, step: 0.5, value: 1 },
          ],
          caption: md`Step $n$ through even and odd values, then make $a$ negative. Even powers keep both ends together; odd powers send them apart. A negative $a$ flips the whole graph upside down.`,
        },
        {
          kind: "example",
          title: "End behavior from factored form",
          problem: md`Describe the end behavior of $f(x) = -2(x - 1)^2(x + 3)(4 - x)$.`,
          steps: [
            { math: md`(-2) \cdot x^2 \cdot x \cdot (-x) = 2x^4`, note: md`Expanding fully isn't needed. The leading term of a product is the product of the leading terms. Note the $-x$ from $(4 - x)$.` },
            { math: md`\text{degree } 4, \quad a_n = 2 > 0`, note: md`The $-2$ out front is cancelled by the $-x$. Easy to miss.` },
            { math: md`\text{left end up, right end up}`, note: md`Like $2x^4$: as $x \to \pm\infty$, $f(x) \to \infty$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Describe the end behavior of $f(x) = 7 + 4x^2 - 3x^5$.`,
          choices: END_CHOICES,
          accept: [END.ud],
          explain: md`The leading term is $-3x^5$: odd degree, negative coefficient. Like $-x^3$, it rises on the left and falls on the right.`,
        },
        {
          kind: "key",
          title: "Zeros and multiplicity",
          body: md`If $(x - r)$ appears exactly $m$ times as a factor of $f$, that is, $f(x) = (x - r)^m g(x)$ with $g(r) \ne 0$, then $r$ is a **zero of multiplicity $m$**. At such a zero:

- **Odd $m$:** the graph **crosses** the $x$-axis.
- **Even $m$:** the graph **touches** the axis and turns back.

The larger $m$ is, the flatter the graph is as it meets the axis.`,
        },
        {
          kind: "why",
          title: "Why even multiplicity touches",
          body: md`Look near $x = r$. The other factor $g(x)$ is close to $g(r)$, which isn't 0, so for $x$ near $r$ it keeps one sign. The sign of $f(x) = (x - r)^m g(x)$ is then decided by $(x - r)^m$.

- If $m$ is even, $(x - r)^m$ is never negative: it's a square. So $f$ has the same sign on both sides of $r$, and the graph can't cross.
- If $m$ is odd, $(x - r)^m$ is negative just left of $r$ and positive just right of it. So $f$ changes sign, and the graph crosses.

The flattening comes from small numbers getting smaller when raised to powers: at $0.1$ from the zero, $(0.1)^2 = 0.01$ and $(0.1)^3 = 0.001$.`,
        },
        {
          kind: "plot",
          x: [-3, 4],
          y: [-6, 6],
          curves: [{ expr: "0.5(x + 1)^m (x - 2)^n", label: "y = 0.5(x + 1)^m(x - 2)^n" }],
          points: [
            { x: -1, y: 0, label: md`\text{multiplicity } {m}`, color: 2 },
            { x: 2, y: 0, label: md`\text{multiplicity } {n}`, color: 4 },
          ],
          params: [
            { name: "m", min: 1, max: 4, step: 1, value: 1 },
            { name: "n", min: 1, max: 4, step: 1, value: 2 },
          ],
          caption: md`Odd multiplicity crosses, even multiplicity bounces. Push a multiplicity to 3 or 4 and the graph flattens against the axis there.`,
        },
        {
          kind: "check",
          prompt: md`At which zero does the graph of $f(x) = x^3(x - 2)^2(x + 1)$ touch the $x$-axis without crossing?`,
          answer: "2",
          explain: md`The zeros are $0$ (multiplicity 3), $2$ (multiplicity 2) and $-1$ (multiplicity 1). Only the even one, $x = 2$, is a touch.`,
        },
      ],
      practice: [endBehavior, degreeLead, zerosMultiplicity],
    },
    {
      id: "polynomial-division",
      title: "Polynomial division",
      summary: "Dividing polynomials the way you divide whole numbers, why the process always ends with a unique answer, and the shortcut called synthetic division.",
      blocks: [
        {
          kind: "text",
          body: md`Divide 47 by 5: it goes in 9 times with 2 left over. Written as one equation,

$$47 = 5 \cdot 9 + 2, \qquad 0 \le 2 < 5.$$

The remainder has to be smaller than the divisor. If it weren't, another 5 would fit. Polynomials divide the same way, with **degree** playing the part of size.`,
        },
        {
          kind: "key",
          title: "The division algorithm",
          body: md`For polynomials $p(x)$ and $d(x)$, with $d$ not zero, there are unique polynomials $q(x)$ and $r(x)$ with

$$p(x) = d(x)\,q(x) + r(x),$$

where $r = 0$ or $\deg r < \deg d$. Here $p$ is the **dividend**, $d$ the **divisor**, $q$ the **quotient** and $r$ the **remainder**. Dividing through by $d$ gives the same fact as a fraction: $\frac{p}{d} = q + \frac{r}{d}$.`,
        },
        {
          kind: "text",
          body: md`**Long division** finds $q$ and $r$ one term at a time. Repeat these steps on whatever is left:

- Divide the leading term of what's left by the leading term of $d$. That's the next term of the quotient.
- Multiply $d$ by that term and subtract.

Stop when what's left has a smaller degree than $d$. That leftover is the remainder.`,
        },
        {
          kind: "example",
          title: "Long division by x − 2",
          problem: md`Divide $2x^3 - 3x^2 + 4x - 5$ by $x - 2$.`,
          steps: [
            { math: md`(2x^3 - 3x^2 + 4x - 5) - 2x^2(x - 2) = x^2 + 4x - 5`, note: md`$\frac{2x^3}{x} = 2x^2$. Then $2x^2(x - 2) = 2x^3 - 4x^2$, and subtracting it cancels the $2x^3$.` },
            { math: md`(x^2 + 4x - 5) - x(x - 2) = 6x - 5`, note: md`$\frac{x^2}{x} = x$. Subtract $x^2 - 2x$.` },
            { math: md`(6x - 5) - 6(x - 2) = 7`, note: md`$\frac{6x}{x} = 6$. Subtract $6x - 12$. What's left, 7, has degree 0, less than 1: stop.` },
            { math: md`q(x) = 2x^2 + x + 6, \quad r = 7`, note: "The quotient collects the three terms we found." },
            { math: md`(x - 2)(2x^2 + x + 6) + 7 = 2x^3 - 3x^2 + 4x - 5 \;\checkmark`, note: "Check by multiplying back." },
          ],
        },
        {
          kind: "why",
          title: "Why long division always stops, and is right",
          body: md`Each step picks the quotient term so that the leading terms cancel. So the degree of what's left drops by at least 1 every step. Degrees are whole numbers, and they can't drop forever, so eventually the degree falls below $\deg d$ and the process ends.

It's also right at every stage. Each step moves a multiple of $d$ out of "what's left" and into "$d$ times the quotient so far", so

$$p = d \cdot (\text{quotient so far}) + (\text{what's left})$$

stays true the whole way through. When it ends, that is exactly $p = dq + r$ with $\deg r < \deg d$.`,
        },
        {
          kind: "proof",
          title: "The quotient and remainder are unique",
          given: md`$p = dq_1 + r_1 = dq_2 + r_2$, where each $r_i$ is 0 or has degree less than $\deg d$`,
          prove: md`$q_1 = q_2$ and $r_1 = r_2$`,
          steps: [
            { statement: md`$d(q_1 - q_2) = r_2 - r_1$`, reason: "Subtract one equation from the other and rearrange." },
            { statement: md`If $q_1 \ne q_2$, the left side has degree $\deg d + \deg(q_1 - q_2) \ge \deg d$`, reason: "Multiplying polynomials adds degrees: the leading coefficients multiply to something nonzero." },
            { statement: md`The right side is 0 or has degree less than $\deg d$`, reason: md`Both $r_1$ and $r_2$ are, so their difference is too.` },
            { statement: md`$q_1 = q_2$`, reason: "Otherwise the two sides would have different degrees, but they are equal." },
            { statement: md`$r_2 - r_1 = d \cdot 0 = 0$, so $r_1 = r_2$`, reason: "Substitute into the first line." },
          ],
        },
        {
          kind: "example",
          title: "Missing terms and a quadratic divisor",
          problem: md`Divide $x^4 + 3x^2 - x + 2$ by $x^2 + 1$.`,
          steps: [
            { math: md`x^4 + 0x^3 + 3x^2 - x + 2`, note: md`Write the missing $x^3$ term as $0x^3$, so like powers stay lined up.` },
            { math: md`(x^4 + 0x^3 + 3x^2 - x + 2) - x^2(x^2 + 1) = 2x^2 - x + 2`, note: md`$\frac{x^4}{x^2} = x^2$. Subtract $x^4 + x^2$.` },
            { math: md`(2x^2 - x + 2) - 2(x^2 + 1) = -x`, note: md`$\frac{2x^2}{x^2} = 2$. Subtract $2x^2 + 2$. Now $-x$ has degree 1, less than 2: stop.` },
            { math: md`q(x) = x^2 + 2, \quad r(x) = -x`, note: md`The remainder can be a polynomial too, as long as its degree is below the divisor's.` },
          ],
        },
        {
          kind: "text",
          body: md`When the divisor is $x - c$, long division repeats the same few moves with a lot of copying. **Synthetic division** keeps only the coefficients and does the same arithmetic in a small table.`,
        },
        {
          kind: "why",
          title: "Where synthetic division comes from",
          body: md`Divide by $x - c$. Say what's left has leading term $bx^{k+1}$. Long division says:

- The next quotient term is $\frac{bx^{k+1}}{x} = bx^k$. Its coefficient is just $b$, the current leading coefficient.
- Subtract $bx^k(x - c) = bx^{k+1} - bcx^k$. The $bx^{k+1}$ cancels, and subtracting $-bcx^k$ **adds** $bc$ to the next coefficient.

So each step is: take the current leading coefficient $b$, multiply it by $c$, and add the result to the next coefficient. That's the whole of synthetic division. Using $c$ instead of $-c$ is what turns every subtraction into an addition.`,
        },
        {
          kind: "example",
          title: "The same division, synthetically",
          problem: md`Divide $2x^3 - 3x^2 + 4x - 5$ by $x - 2$ with synthetic division.`,
          steps: [
            { math: md`\begin{array}{r|rrrr} 2 & 2 & -3 & 4 & -5 \\ & & & & \\ \hline & & & & \end{array}`, note: md`Put $c = 2$ on the left and the coefficients across the top.` },
            { math: md`\begin{array}{r|rrrr} 2 & 2 & -3 & 4 & -5 \\ & & 4 & 2 & 12 \\ \hline & 2 & 1 & 6 & 7 \end{array}`, note: md`Bring down the 2. Then $2 \cdot 2 = 4$, and $-3 + 4 = 1$. Then $1 \cdot 2 = 2$, and $4 + 2 = 6$. Then $6 \cdot 2 = 12$, and $-5 + 12 = 7$.` },
            { math: md`q(x) = 2x^2 + x + 6, \quad r = 7`, note: "The last number is the remainder. The others are the quotient's coefficients, one degree lower than the dividend. Same answer as long division." },
          ],
        },
        {
          kind: "key",
          title: "Synthetic division, dividing by x − c",
          body: md`- Write $c$ on the left. For $x + 3$, that's $c = -3$, since $x + 3 = x - (-3)$.
- Write every coefficient of the dividend across the top, with 0 for each missing power.
- Bring down the first coefficient. Then repeatedly: multiply by $c$, write the product under the next coefficient, and add.
- The last number is the remainder. The rest are the quotient's coefficients, starting one degree lower.

It only works for divisors of the form $x - c$. For anything else, use long division. Even $3x - 1$ needs it: since $3x - 1 = 3\left(x - \frac{1}{3}\right)$, dividing by $x - \frac{1}{3}$ instead gives a quotient 3 times too big.`,
        },
        {
          kind: "check",
          prompt: md`Divide $x^3 + 2x^2 - 5x + 1$ by $x - 1$. Give the answer as (quotient, remainder), like (x^2 + 3x - 1, 4).`,
          answer: "(x^2 + 3x - 2, -1)",
          form: "tuple",
          explain: md`With $c = 1$: bring down 1; $1 + 2 = 3$; $3 - 5 = -2$; $-2 + 1 = -1$. So $q = x^2 + 3x - 2$ and $r = -1$.`,
        },
        {
          kind: "check",
          prompt: md`Divide $x^3 - 8$ by $x - 2$. Give the answer as (quotient, remainder).`,
          answer: "(x^2 + 2x + 4, 0)",
          form: "tuple",
          explain: md`The coefficients are $1, 0, 0, -8$. With $c = 2$: $1$; $0 + 2 = 2$; $0 + 4 = 4$; $-8 + 8 = 0$. The remainder is 0, so $x^3 - 8 = (x - 2)(x^2 + 2x + 4)$.`,
        },
      ],
      practice: [syntheticDivide, longDivide],
    },
    {
      id: "the-remainder-and-factor-theorems",
      title: "The remainder and factor theorems",
      summary: "Why the remainder on dividing by x - c is exactly p(c), and why that makes zeros and factors the same thing.",
      blocks: [
        {
          kind: "text",
          body: md`Last lesson, dividing $p(x) = 2x^3 - 3x^2 + 4x - 5$ by $x - 2$ left a remainder of 7. Now just evaluate $p$ at 2:

$$p(2) = 2(8) - 3(4) + 4(2) - 5 = 16 - 12 + 8 - 5 = 7.$$

The same number. That isn't luck.`,
        },
        {
          kind: "key",
          title: "Remainder theorem",
          body: md`When a polynomial $p(x)$ is divided by $x - c$, the remainder is $p(c)$.`,
        },
        {
          kind: "proof",
          title: "The remainder theorem",
          given: md`A polynomial $p(x)$ and a number $c$`,
          prove: md`The remainder on dividing $p(x)$ by $x - c$ is $p(c)$`,
          steps: [
            { statement: md`$p(x) = (x - c)\,q(x) + r$`, reason: md`Division algorithm. The divisor has degree 1, so the remainder has degree 0 or is 0: it's a number $r$.` },
            { statement: md`$p(c) = (c - c)\,q(c) + r$`, reason: md`The equation holds for every $x$, so it holds at $x = c$.` },
            { statement: md`$p(c) = 0 \cdot q(c) + r = r$`, reason: "Arithmetic: zero times anything is zero." },
          ],
        },
        {
          kind: "why",
          title: "Why substituting is the whole trick",
          body: md`The division algorithm gives an **identity**: $p(x)$ and $(x - c)q(x) + r$ are the same polynomial, so they agree at every $x$. We get to choose which $x$ to look at, and $x = c$ is the clever choice, because it makes the factor $x - c$ equal 0 and takes the unknown quotient with it. Only $r$ survives.

The same idea handles divisors like $2x - 1$. From $p(x) = (2x - 1)q(x) + r$, choose the $x$ that makes $2x - 1 = 0$, namely $x = \frac{1}{2}$. Then $r = p\left(\frac{1}{2}\right)$.`,
        },
        {
          kind: "example",
          title: "A remainder without dividing",
          problem: md`Find the remainder when $x^5 - 3x^3 + 2x - 4$ is divided by $x + 2$.`,
          steps: [
            { math: md`x + 2 = x - (-2) \implies c = -2`, note: md`Match the divisor to the form $x - c$.` },
            { math: md`p(-2) = (-2)^5 - 3(-2)^3 + 2(-2) - 4`, note: "Remainder theorem: just evaluate." },
            { math: md`= -32 + 24 - 4 - 4 = -16`, note: md`$(-2)^5 = -32$ and $-3(-8) = 24$.` },
          ],
        },
        {
          kind: "plot",
          x: [-4, 5],
          y: [-25, 20],
          curves: [{ expr: "x^3 - 2x^2 - 5x + 6", label: "y = p(x)" }],
          points: [{ x: "c", y: "c^3 - 2c^2 - 5c + 6", label: md`\text{remainder} = p({c}) = {=c^3 - 2c^2 - 5c + 6}`, color: 2 }],
          params: [{ name: "c", min: -3, max: 4, step: 0.5, value: 2 }],
          caption: md`For $p(x) = x^3 - 2x^2 - 5x + 6$: the remainder on dividing by $x - c$ is the height of the graph at $c$. Slide $c$ to $-2$, $1$ or $3$, where the graph meets the axis. There the remainder is 0, and $x - c$ divides $p$ exactly.`,
        },
        {
          kind: "key",
          title: "Factor theorem",
          body: md`$x - c$ is a factor of $p(x)$ if and only if $p(c) = 0$.

In words: $c$ is a zero of $p$ exactly when $x - c$ is a factor of $p$.`,
        },
        {
          kind: "proof",
          title: "The factor theorem",
          given: md`A polynomial $p(x)$ and a number $c$`,
          prove: md`$x - c$ is a factor of $p(x)$ if and only if $p(c) = 0$`,
          steps: [
            { statement: md`$p(x) = (x - c)\,q(x) + p(c)$`, reason: "Division algorithm, with the remainder theorem naming the remainder." },
            { statement: md`If $p(c) = 0$, then $p(x) = (x - c)\,q(x)$`, reason: md`Substitute $p(c) = 0$. So $x - c$ is a factor.` },
            { statement: md`If $p(x) = (x - c)\,s(x)$ for some polynomial $s$, then $p(c) = (c - c)\,s(c) = 0$`, reason: md`Substitute $x = c$. This is the other direction.` },
          ],
        },
        {
          kind: "why",
          title: "Why this matters",
          body: md`The factor theorem joins three ideas that looked separate:

- a **zero** of the function (where the graph meets the $x$-axis),
- a **root** of the equation $p(x) = 0$,
- a **factor** $x - c$ of the polynomial.

Each zero you find lets you divide out a factor and lower the degree by 1. Find one zero of a cubic, divide, and what's left is a quadratic, which the quadratic formula always finishes. When its discriminant is negative, the complex numbers of Unit 2 finish the job.`,
        },
        {
          kind: "example",
          title: "Factoring with one zero known",
          problem: md`Factor $x^3 - 7x + 6$ completely, given that $x = 1$ is a zero.`,
          steps: [
            { math: md`\begin{array}{r|rrrr} 1 & 1 & 0 & -7 & 6 \\ & & 1 & 1 & -6 \\ \hline & 1 & 1 & -6 & 0 \end{array}`, note: md`Divide by $x - 1$, with 0 for the missing $x^2$ term. Remainder 0, as the factor theorem promised.` },
            { math: md`x^3 - 7x + 6 = (x - 1)(x^2 + x - 6)`, note: "Read off the quotient." },
            { math: md`= (x - 1)(x + 3)(x - 2)`, note: md`Factor the quadratic: $3 \cdot (-2) = -6$ and $3 + (-2) = 1$.` },
          ],
        },
        {
          kind: "example",
          title: "Choosing a coefficient",
          problem: md`Find $k$ so that $x - 2$ is a factor of $x^3 + kx^2 - 4x + 12$.`,
          steps: [
            { math: md`p(2) = 0`, note: "Factor theorem." },
            { math: md`8 + 4k - 8 + 12 = 0`, note: md`Substitute $x = 2$.` },
            { math: md`4k + 12 = 0 \implies k = -3`, note: md`Check: $x^3 - 3x^2 - 4x + 12 = (x - 2)(x^2 - x - 6)$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the remainder when $x^4 - 3x^2 + x - 5$ is divided by $x - 2$.`,
          answer: "1",
          explain: md`$p(2) = 16 - 12 + 2 - 5 = 1$.`,
        },
        {
          kind: "check",
          prompt: md`Is $x + 1$ a factor of $x^3 + 2x^2 - x - 2$?`,
          choices: ["yes", "no"],
          accept: ["yes"],
          explain: md`$x + 1 = x - (-1)$, and $p(-1) = -1 + 2 + 1 - 2 = 0$. By the factor theorem, yes: $x^3 + 2x^2 - x - 2 = (x + 1)(x - 1)(x + 2)$.`,
        },
      ],
      practice: [remainderValue, findK, factorGiven],
    },
    {
      id: "rational-root-theorem",
      title: "Rational root theorem",
      summary: "A short list that contains every possible fraction zero of a polynomial with integer coefficients, proved from divisibility.",
      blocks: [
        {
          kind: "text",
          body: md`The factor theorem turns factoring into a hunt for zeros. But where do you look? For $2x^3 - 3x^2 - 11x + 6$, there are infinitely many numbers to try. If a zero happens to be a fraction, though, the coefficients pin it to a short list.`,
        },
        {
          kind: "why",
          title: "Where the list comes from",
          body: md`Start small. The zero of $2x - 3$ is $\frac{3}{2}$: the numerator comes from the constant, the denominator from the leading coefficient.

Multiply two such factors: $(2x - 3)(x + 5) = 2x^2 + 7x - 15$. Its zeros are $\frac{3}{2}$ and $-5$. The leading coefficient $2 = 2 \cdot 1$ is the product of the denominators, and the constant $-15 = (-3)(5)$ is a product of the numerators. So each numerator divides the constant, and each denominator divides the leading coefficient.

That's the pattern. The proof below shows it holds even when some zeros aren't rational at all.`,
        },
        {
          kind: "key",
          title: "Rational root theorem",
          body: md`Let $f(x) = a_nx^n + \cdots + a_1x + a_0$ have **integer** coefficients, with $a_n \ne 0$ and $a_0 \ne 0$. If $\frac{p}{q}$ is a zero, written in lowest terms, then

- $p$ divides the constant term $a_0$, and
- $q$ divides the leading coefficient $a_n$.

So every rational zero is on the list $\pm\dfrac{\text{factors of } a_0}{\text{factors of } a_n}$.`,
        },
        {
          kind: "proof",
          title: "The rational root theorem",
          given: md`$f(x) = a_nx^n + \cdots + a_1x + a_0$ with integer coefficients, and $f\left(\frac{p}{q}\right) = 0$ with $\frac{p}{q}$ in lowest terms`,
          prove: md`$p$ divides $a_0$ and $q$ divides $a_n$`,
          steps: [
            { statement: md`$a_n\frac{p^n}{q^n} + a_{n-1}\frac{p^{n-1}}{q^{n-1}} + \cdots + a_1\frac{p}{q} + a_0 = 0$`, reason: md`$\frac{p}{q}$ is a zero.` },
            { statement: md`$a_np^n + a_{n-1}p^{n-1}q + \cdots + a_1pq^{n-1} + a_0q^n = 0$`, reason: md`Multiply both sides by $q^n$ to clear every denominator.` },
            { statement: md`$a_0q^n = -p\left(a_np^{n-1} + a_{n-1}p^{n-2}q + \cdots + a_1q^{n-1}\right)$`, reason: md`Move $a_0q^n$ to one side. Every other term has a factor of $p$; factor it out.` },
            { statement: md`$p$ divides $a_0q^n$`, reason: "The bracket is an integer, so the right side is p times an integer." },
            { statement: md`$p$ divides $a_0$`, reason: md`Lowest terms: $p$ and $q$ share no prime factor, so $p$ shares none with $q^n$. Prime factorizations are unique, so every prime in $p$, counted as many times as it appears there, is in the factorization of $a_0q^n$. None of those copies can come from $q^n$, so they all come from $a_0$.` },
            { statement: md`$a_np^n = -q\left(a_{n-1}p^{n-1} + \cdots + a_0q^{n-1}\right)$, so $q$ divides $a_n$`, reason: md`Same argument the other way: isolate $a_np^n$ instead, and $q$ shares no prime factor with $p^n$.` },
          ],
        },
        {
          kind: "why",
          title: "What the theorem does and doesn't say",
          body: md`- **Lowest terms matters.** The step "$p$ shares no factor with $q^n$" needs it. ($\frac{6}{4}$ is a zero of $2x - 3$, but 6 doesn't divide 3.)
- **It lists candidates, not zeros.** It says *if* there's a rational zero, it's on the list. Each candidate still has to be tested, and some polynomials have no rational zeros at all.
- **Irrational and complex zeros slip past it.** Once you've divided out the rational zeros, finish the leftover quadratic with the quadratic formula.`,
        },
        {
          kind: "example",
          title: "Solving a cubic from scratch",
          problem: md`Solve $2x^3 - 3x^2 - 11x + 6 = 0$.`,
          steps: [
            { math: md`\pm 1, \pm 2, \pm 3, \pm 6, \pm \tfrac{1}{2}, \pm \tfrac{3}{2}`, note: md`Factors of 6 over factors of 2: $p \in \{1, 2, 3, 6\}$, $q \in \{1, 2\}$. Twelve candidates.` },
            { math: md`f(1) = -6, \quad f(-1) = 12, \quad f(2) = -12, \quad f(-2) = 0`, note: md`Test them. $x = -2$ works.` },
            { math: md`\begin{array}{r|rrrr} -2 & 2 & -3 & -11 & 6 \\ & & -4 & 14 & -6 \\ \hline & 2 & -7 & 3 & 0 \end{array}`, note: md`Divide out $x + 2$.` },
            { math: md`2x^2 - 7x + 3 = (2x - 1)(x - 3)`, note: "Factor the quotient." },
            { math: md`x = -2, \quad x = \tfrac{1}{2}, \quad x = 3`, note: "All three zeros were on the list, as they had to be." },
          ],
        },
        {
          kind: "plot",
          x: [-6.5, 6.5],
          y: [-20, 20],
          curves: [{ expr: "2x^3 - 3x^2 - 11x + 6", label: "y = 2x^3 - 3x^2 - 11x + 6" }],
          points: [
            ...[1, -1, 2, 6, -6, -3, 1.5, -1.5, -0.5].map((x) => ({ x, y: 0, color: 3 as const })),
            { x: -2, y: 0, label: "-2", color: 4 },
            { x: 0.5, y: 0, label: md`\tfrac{1}{2}`, color: 4 },
            { x: 3, y: 0, label: "3", color: 4 },
          ],
          caption: md`The twelve candidates sit on the $x$-axis (green). The graph crosses at three of them (red). No zero can hide anywhere else among the fractions.`,
        },
        {
          kind: "why",
          title: "A payoff: why the square root of 2 is irrational",
          body: md`$\sqrt{2}$ is a zero of $x^2 - 2$. The theorem's candidates are $\pm 1$ and $\pm 2$, and none works: $1 - 2 \ne 0$ and $4 - 2 \ne 0$. So $x^2 - 2$ has no rational zeros, and $\sqrt{2}$ can't be a fraction.

The same argument shows $\sqrt{3}$ is irrational, and so is $\sqrt[3]{5}$, the number whose cube is 5 (Unit 5 studies these $n$th roots). When $a_n = 1$, the theorem says every rational zero is an integer. So for a positive integer $m$, the positive number $\sqrt[n]{m}$ whose $n$th power is $m$ is irrational unless $m$ is a perfect $n$th power: it's a zero of $x^n - m$, and no integer has $n$th power $m$. The power has to match. $8 = 2^3$, but 8 isn't a perfect square, so $\sqrt{8}$ is irrational.`,
        },
        {
          kind: "check",
          prompt: md`List every possible rational zero of $3x^3 - 2x^2 + 3x - 2$. Separate them with commas; you can write ± as +/-.`,
          answer: "1, -1, 2, -2, 1/3, -1/3, 2/3, -2/3",
          form: "set",
          simplified: true,
          explain: md`Factors of 2 over factors of 3: $\pm 1, \pm 2, \pm\frac{1}{3}, \pm\frac{2}{3}$. (Testing them, only $\frac{2}{3}$ is actually a zero: $3x^3 - 2x^2 + 3x - 2 = (3x - 2)(x^2 + 1)$.)`,
        },
        {
          kind: "check",
          prompt: md`Solve $x^3 - 2x^2 - 5x + 6 = 0$. Give all solutions, separated by commas.`,
          answer: "1, -2, 3",
          form: "set",
          explain: md`The leading coefficient is 1, so try integers dividing 6. $f(1) = 0$; dividing gives $x^2 - x - 6 = (x - 3)(x + 2)$.`,
        },
      ],
      practice: [candidateList, solveRational, factorRational],
    },
    {
      id: "the-fundamental-theorem-of-algebra",
      title: "The fundamental theorem of algebra",
      summary: "Why a polynomial of degree n has exactly n complex zeros counted with multiplicity, and why the nonreal ones of a real polynomial come in conjugate pairs.",
      blocks: [
        {
          kind: "text",
          body: md`Every extension of the number system so far was forced by an equation. $x + 5 = 2$ needs negatives. $3x = 2$ needs fractions. $x^2 = 2$ needs irrationals. $x^2 = -1$ needs $i$ (Unit 2).

So you might expect it to go on forever: some fifth-degree equation needing yet another new kind of number. It doesn't. The complex numbers are enough for every polynomial equation.`,
        },
        {
          kind: "key",
          title: "Fundamental theorem of algebra",
          body: md`Every polynomial of degree $n \ge 1$, with complex coefficients, has at least one complex zero.

Real coefficients count: every real number is a complex number $a + 0i$.`,
        },
        {
          kind: "text",
          body: md`An honest note: this course won't prove it. Every proof needs ideas beyond algebra, such as continuity or calculus with complex numbers, and you'll meet one in a later course. Gauss gave the first widely accepted proof in 1799. Here we take the theorem as given and prove what follows from it, which is a lot.`,
        },
        {
          kind: "why",
          title: "A case you can see: odd degree",
          body: md`If $f$ has real coefficients and odd degree, its two ends point in opposite directions (Lesson 1): one end is below the $x$-axis, the other above. A polynomial's graph is one unbroken curve, so to get from one end to the other it must cross the axis. That crossing is a real zero.

Even degree gives no such promise. $x^2 + 1$ stays above the axis forever. Its zeros, $\pm i$, exist, but not on the real number line.`,
        },
        {
          kind: "proof",
          title: "A degree-n polynomial has exactly n zeros",
          given: md`$p(x)$ of degree $n \ge 1$ with leading coefficient $a$`,
          prove: md`$p(x) = a(x - z_1)(x - z_2)\cdots(x - z_n)$ for complex numbers $z_1, \ldots, z_n$, and these are its only zeros`,
          steps: [
            { statement: md`$p$ has a zero $z_1$`, reason: "Fundamental theorem of algebra." },
            { statement: md`$p(x) = (x - z_1)\,q_1(x)$, with $\deg q_1 = n - 1$`, reason: "Factor theorem. Its proof used only the rules of arithmetic, which complex numbers keep (Unit 2), so it works with complex c too." },
            { statement: md`If $n - 1 \ge 1$: $q_1(x) = (x - z_2)\,q_2(x)$, with $\deg q_2 = n - 2$`, reason: md`The theorem again, applied to $q_1$.` },
            { statement: md`$p(x) = (x - z_1)(x - z_2)\cdots(x - z_n)\,q_n$, with $q_n$ a constant`, reason: "Repeat. Each step lowers the degree by 1, so after n steps the degree is 0." },
            { statement: md`$q_n = a$`, reason: md`Compare leading terms: the product's leading term is $q_nx^n$.` },
            { statement: md`If $p(w) = 0$, then $a(w - z_1)\cdots(w - z_n) = 0$, so $w$ is one of the $z_k$`, reason: md`Zero product property. It holds for complex numbers since every nonzero complex number has a reciprocal, and $a \ne 0$.` },
          ],
        },
        {
          kind: "key",
          title: "Counting zeros",
          body: md`A polynomial of degree $n$ has exactly $n$ complex zeros, **counted with multiplicity**. (A zero of multiplicity 2 counts twice.)

The real zeros are the graph's $x$-intercepts. The rest are nonreal and don't appear on the graph at all.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-8, 8],
          curves: [{ expr: "(x - 1)(x^2 + k)", label: "y = (x - 1)(x^2 + k)" }],
          points: [{ x: 1, y: 0, label: "x = 1", color: 4 }],
          params: [{ name: "k", min: -4, max: 4, step: 0.5, value: -4 }],
          caption: md`Three zeros always: $1$ and the two solutions of $x^2 = -k$. While $k < 0$ those are $\pm\sqrt{-k}$, two more crossings. (At $k = -1$ one of them lands on $1$, and the graph touches there: a double zero.) Raise $k$: they slide together and merge at $k = 0$ (a double zero at the origin). For $k > 0$ they leave the real line as $\pm i\sqrt{k}$. The graph shows one crossing, but the count is still three.`,
        },
        {
          kind: "why",
          title: "The quadratic argument works for any degree",
          body: md`Unit 2 proved that a real quadratic's nonreal solutions come in conjugate pairs. The proof used three facts about the bar: $\overline{z + w} = \overline{z} + \overline{w}$, $\overline{zw} = \overline{z}\,\overline{w}$, and $\overline{r} = r$ for real $r$. Nothing in it needed the degree to be 2. A power is a repeated product, so conjugating a polynomial's value is the same as conjugating its input, as long as the coefficients are real.`,
        },
        {
          kind: "proof",
          title: "Complex zeros come in conjugate pairs",
          given: md`$p(x) = a_nx^n + \cdots + a_0$ with **real** coefficients, and $p(z) = 0$`,
          prove: md`$p(\overline{z}) = 0$`,
          steps: [
            { statement: md`$\overline{p(z)} = \overline{a_n}\,\overline{z}^{\,n} + \cdots + \overline{a_1}\,\overline{z} + \overline{a_0}$`, reason: "The conjugate of a sum is the sum of the conjugates, and of a product, the product. A power is a repeated product." },
            { statement: md`$\overline{p(z)} = a_n\overline{z}^{\,n} + \cdots + a_1\overline{z} + a_0 = p(\overline{z})$`, reason: "Real coefficients are their own conjugates." },
            { statement: md`$p(\overline{z}) = \overline{0} = 0$`, reason: md`$p(z) = 0$, and the conjugate of 0 is 0.` },
          ],
        },
        {
          kind: "diagram",
          view: [-3, 5, -4, 4],
          grid: true,
          points: [
            { name: "Z", x: "a", y: "b", label: md`z = {a} + {b}i`, dir: "e" },
            { name: "W", x: "a", y: "-b", label: md`\overline{z} = {a} - {b}i`, dir: "e" },
          ],
          segments: [{ from: "Z", to: "W", dashed: true }],
          params: [
            { name: "a", min: -2, max: 3, step: 1, value: 2 },
            { name: "b", min: 1, max: 3, step: 1, value: 3 },
          ],
          caption: md`In the complex plane, conjugation reflects a point across the real axis. Zeros of a real polynomial are symmetric this way: off the real line, they come in mirror-image pairs.`,
        },
        {
          kind: "example",
          title: "All the zeros of a cubic",
          problem: md`Find all zeros of $x^3 - 3x^2 + 4x - 2$.`,
          steps: [
            { math: md`f(1) = 1 - 3 + 4 - 2 = 0`, note: md`Rational root candidates are $\pm 1, \pm 2$. The first one works.` },
            { math: md`\begin{array}{r|rrrr} 1 & 1 & -3 & 4 & -2 \\ & & 1 & -2 & 2 \\ \hline & 1 & -2 & 2 & 0 \end{array}`, note: md`Divide out $x - 1$.` },
            { math: md`x = \frac{2 \pm \sqrt{4 - 8}}{2} = \frac{2 \pm 2i}{2} = 1 \pm i`, note: md`Quadratic formula on $x^2 - 2x + 2$. A conjugate pair, as the theorem predicts.` },
            { math: md`x = 1, \quad 1 + i, \quad 1 - i`, note: "Degree 3, three zeros. Only one is an x-intercept." },
          ],
        },
        {
          kind: "example",
          title: "Building a polynomial from its zeros",
          problem: md`Find the polynomial of least degree with real coefficients and leading coefficient 1 that has zeros $3$ and $2 - i$.`,
          steps: [
            { math: md`2 + i \text{ is also a zero}`, note: "Real coefficients force the conjugate in. Three zeros: degree 3." },
            { math: md`(x - (2 - i))(x - (2 + i)) = (x - 2)^2 - i^2 = x^2 - 4x + 5`, note: md`Group as $((x - 2) + i)((x - 2) - i)$, a difference of squares. The $i$'s disappear.` },
            { math: md`(x - 3)(x^2 - 4x + 5) = x^3 - 7x^2 + 17x - 15`, note: "Multiply by the real zero's factor and expand." },
          ],
        },
        {
          kind: "example",
          title: "A quartic in disguise",
          problem: md`Solve $x^4 + 5x^2 - 36 = 0$ over the complex numbers.`,
          steps: [
            { math: md`u^2 + 5u - 36 = 0`, note: md`Only even powers appear. Write $u = x^2$, so $x^4 = u^2$.` },
            { math: md`(u - 4)(u + 9) = 0`, note: md`Factor as in Algebra 1, Unit 7: $(-4) \cdot 9 = -36$ and $-4 + 9 = 5$.` },
            { math: md`x^2 = 4 \quad\text{or}\quad x^2 = -9`, note: md`Put $x^2$ back for $u$.` },
            { math: md`x = \pm 2 \quad\text{or}\quad x = \pm 3i`, note: "Four zeros for degree 4. Two are real, and two are a conjugate pair." },
          ],
        },
        {
          kind: "check",
          prompt: md`A polynomial with real coefficients has degree 5. Three of its zeros are $2$, $i$ and $1 - 3i$. How many of its zeros, counted with multiplicity, are real?`,
          answer: "1",
          explain: md`The conjugates $-i$ and $1 + 3i$ are zeros too. That's five zeros already, the most a degree-5 polynomial has, so the only real one is $2$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x^4 - 16 = 0$ over the complex numbers. Give all solutions, separated by commas.`,
          answer: "2, -2, 2i, -2i",
          form: "set",
          complex: true,
          explain: md`$x^4 - 16 = (x^2 - 4)(x^2 + 4)$. So $x^2 = 4$ gives $\pm 2$, and $x^2 = -4$ gives $\pm 2i$. Four zeros for degree 4.`,
        },
      ],
      practice: [complexSolve, buildPolynomial, complexGivenZero],
    },
  ],
};
