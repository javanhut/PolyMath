import { frac, fracTex, poly, signed, type Rng } from "../../math/random";
import { md, slug, type Generator, type Problem, type Step, type Unit } from "../types";

// ── Polynomial helpers ──────────────────────────────────────────────────────
// A polynomial is its list of coefficients, highest power first: [1, 0, -4] is x^2 - 4.

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

const xPow = (k: number) => (k === 0 ? "" : k === 1 ? "x" : `x^${k}`);
/** Standard form; the same text works as LaTeX and as a typed answer. */
const ptext = (p: Poly) => {
  const n = p.length - 1;
  return poly(p.map((c, i): [number, string] => [c, xPow(n - i)]));
};
const mono = (c: number, k: number) => poly([[c, xPow(k)]]);
/** The factor x - r as a polynomial. */
const linPoly = (r: number): Poly => [1, -r];
/** The factor x - r: "(x - 3)", "(x + 2)", or "x". */
const lin = (r: number) => (r === 0 ? "x" : `(${poly([[1, "x"], [-r, ""]])})`);
/** The factor without its parentheses: "x - 3". */
const linBare = (r: number) => poly([[1, "x"], [-r, ""]]);
const linPow = (r: number, m: number) => (m === 1 ? lin(r) : `${lin(r)}^${m}`);
const lead = (k: number) => (k === 1 ? "" : k === -1 ? "-" : String(k));
/** Substitute a value for x in polynomial text. */
const subst = (text: string, v: string | number) => text.replace(/x/g, `(${v})`);
/** The nonzero term values of p at x, summed in order: "16 - 12 + 2 - 5". */
const termSum = (p: Poly, x: number) => poly(p.map((c, i): [number, string] => [c * x ** (p.length - 1 - i), ""]).filter(([v]) => v !== 0));
/** "x - c" as LaTeX/text. */
const minus = (c: number) => ptext([1, -c]);

interface ZeroM {
  r: number;
  m: number;
}

/** c (x - r1)^m1 (x - r2)^m2 ... as text that is also LaTeX. A plain x factor goes first, so "x^2(x + 4)^2" rather than "(x + 4)^2x^2". */
const factorsText = (c: number, fs: ZeroM[]) =>
  `${lead(c)}${[...fs]
    .sort((a, b) => (a.r === 0 ? -1 : b.r === 0 ? 1 : 0))
    .map((f) => linPow(f.r, f.m))
    .join("")}`;
const factorsPoly = (c: number, fs: ZeroM[]): Poly => scale(mulAll(...fs.map((f) => power(linPoly(f.r), f.m))), c);
/** (x - r1)(x - r2)... with a plain x factor first. */
const prod = (rs: number[]) => factorsText(1, rs.map((r) => ({ r, m: 1 })));
/** How to factor a monic quadratic with the given zeros, as a note. */
const quadNote = (u: number, v: number) => (u * v === 0 ? md`Factor out the common $x$.` : md`product $${u * v}$, sum $${-(u + v)}$`);
const ratTex = (N: Poly, D: Poly) => md`\frac{${ptext(N)}}{${ptext(D)}}`;

function distinct(r: Rng, n: number, lo: number, hi: number, exclude: number[] = []): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const v = r.int(lo, hi);
    if (!exclude.includes(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Synthetic division of p by x - c. */
function synth(p: Poly, c: number) {
  const mid: number[] = [];
  const bottom: number[] = [p[0]!];
  for (let i = 1; i < p.length; i++) {
    const m = bottom[i - 1]! * c;
    mid.push(m);
    bottom.push(p[i]! + m);
  }
  return { q: bottom.slice(0, -1), rem: bottom[bottom.length - 1]!, mid, bottom };
}

function synthTex(p: Poly, c: number): string {
  const { mid, bottom } = synth(p, c);
  return md`\begin{array}{r|${"r".repeat(p.length)}} ${c} & ${p.join(" & ")} \\ & & ${mid.join(" & ")} \\ \hline & ${bottom.join(" & ")} \end{array}`;
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

/** The factoring of p = (x - a)^2 (x - b), the way a learner would find it. */
function doubleRootCubic(a: number, b: number) {
  const p = mul(power(linPoly(a), 2), linPoly(b));
  const c = Math.abs(b) <= Math.abs(a) ? b : a;
  const { q } = synth(p, c);
  const qFactored = c === b ? linPow(a, 2) : `${lin(a)}${lin(b)}`;
  const steps: Step[] = [
    { math: md`p(${c}) = ${termSum(p, c)} = 0`, note: md`A rational zero must divide the constant term $${p[3]}$ (rational root theorem, Algebra 2). Testing the small divisors, $x = ${c}$ works.` },
    { math: synthTex(p, c), note: md`Synthetic division by $${minus(c)}$. The remainder is 0, as it must be.` },
    { math: md`p(x) = ${lin(c)}(${ptext(q)}) = ${lin(c)}${qFactored}`, note: c === b ? md`The quotient is a perfect square: $${ptext(q)} = ${qFactored}$.` : md`Factor the quotient: two numbers with product $${q[2]}$ and sum $${-q[1]!}$ are $${-a}$ and $${-b}$.` },
    { math: md`p(x) = ${linPow(a, 2)}${lin(b)}`, note: md`So $${a}$ is a zero of multiplicity 2 and $${b}$ has multiplicity 1.` },
  ];
  return { p, steps };
}

// ── Sign charts ─────────────────────────────────────────────────────────────

type Op = "<" | "<=" | ">" | ">=";
const OPS: Op[] = ["<", "<=", ">", ">="];
const OP_TEX: Record<Op, string> = { "<": "<", "<=": "\\le", ">": ">", ">=": "\\ge" };
const isStrict = (op: Op) => op === "<" || op === ">";

interface Factor extends ZeroM {
  /** Row label in the sign chart, e.g. "x - 1" or "(x - 1)^2". */
  tex: string;
  /** A zero of the denominator: never part of the solution. */
  pole?: boolean;
}

interface Iv {
  lo: number;
  loOpen: boolean;
  hi: number;
  hiOpen: boolean;
}

const factor = (r: number, m = 1, pole = false): Factor => ({ r, m, pole, tex: m === 1 ? linBare(r) : linPow(r, m) });

/** Sign of lead * prod (x - r)^m at x. */
function signAt(fs: Factor[], leadCoef: number, x: number): number {
  let s = Math.sign(leadCoef);
  for (const f of fs) s *= Math.sign((x - f.r) ** f.m);
  return s;
}

/**
 * Solve lead * prod (x - r_i)^{m_i} op 0 by sign chart. Returns null when the
 * solution set would have an isolated point (awkward to type) or is empty.
 */
function solveSign(fs: Factor[], leadCoef: number, op: Op): Iv[] | null {
  const sorted = [...fs].sort((a, b) => a.r - b.r);
  const bounds = [-Infinity, ...sorted.map((f) => f.r), Infinity];
  const wantPos = op === ">" || op === ">=";
  const intervals: Iv[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const [lo, hi] = [bounds[i]!, bounds[i + 1]!];
    const test = lo === -Infinity ? hi - 1 : hi === Infinity ? lo + 1 : (lo + hi) / 2;
    if (signAt(sorted, leadCoef, test) > 0 === wantPos) intervals.push({ lo, loOpen: true, hi, hiOpen: true });
  }
  if (!intervals.length) return null;
  if (!isStrict(op)) {
    for (const f of sorted) {
      if (f.pole) continue;
      let touched = false;
      for (const iv of intervals) {
        if (iv.lo === f.r) (iv.loOpen = false), (touched = true);
        if (iv.hi === f.r) (iv.hiOpen = false), (touched = true);
      }
      if (!touched) return null;
    }
  }
  const out: Iv[] = [];
  for (const iv of intervals) {
    const last = out[out.length - 1];
    if (last && last.hi === iv.lo && !last.hiOpen && !iv.loOpen) {
      last.hi = iv.hi;
      last.hiOpen = iv.hiOpen;
    } else out.push({ ...iv });
  }
  return out;
}

const ivText = (iv: Iv) =>
  iv.lo === -Infinity
    ? `x ${iv.hiOpen ? "<" : "<="} ${iv.hi}`
    : iv.hi === Infinity
      ? `x ${iv.loOpen ? ">" : ">="} ${iv.lo}`
      : `${iv.lo} ${iv.loOpen ? "<" : "<="} x ${iv.hiOpen ? "<" : "<="} ${iv.hi}`;
const ivTex = (iv: Iv) =>
  iv.lo === -Infinity
    ? md`x ${iv.hiOpen ? "<" : "\\le"} ${iv.hi}`
    : iv.hi === Infinity
      ? md`x ${iv.loOpen ? ">" : "\\ge"} ${iv.lo}`
      : md`${iv.lo} ${iv.loOpen ? "<" : "\\le"} x ${iv.hiOpen ? "<" : "\\le"} ${iv.hi}`;
const intervalTex = (iv: Iv) =>
  `${iv.loOpen ? "(" : "["}${iv.lo === -Infinity ? "-\\infty" : iv.lo}, ${iv.hi === Infinity ? "\\infty" : iv.hi}${iv.hiOpen ? ")" : "]"}`;
const solText = (ivs: Iv[]) => ivs.map(ivText).join(" or ");
const solTex = (ivs: Iv[]) => ivs.map(ivTex).join(" \\quad\\text{or}\\quad ");
const solInterval = (ivs: Iv[]) => ivs.map(intervalTex).join(" \\cup ");

/** A sign chart as a LaTeX array: one row per factor, one column per interval. */
function signChartTex(fs: Factor[], leadCoef: number, fTex: string): string {
  const sorted = [...fs].sort((a, b) => a.r - b.r);
  const rs = sorted.map((f) => f.r);
  const tests = rs.map((r, i) => (i === 0 ? r - 1 : (rs[i - 1]! + r) / 2)).concat(rs[rs.length - 1]! + 1);
  const heads = tests.map((_, i) => (i === 0 ? `x < ${rs[0]}` : i === rs.length ? `x > ${rs[i - 1]}` : `${rs[i - 1]} < x < ${rs[i]}`));
  const sgn = (v: number) => (v > 0 ? "+" : "-");
  const rows: string[] = [];
  if (leadCoef !== 1) rows.push(`${leadCoef} & ${tests.map(() => sgn(leadCoef)).join(" & ")}`);
  for (const f of sorted) rows.push(`${f.tex} & ${tests.map((t) => sgn((t - f.r) ** f.m)).join(" & ")}`);
  const product = tests.map((t) => sgn(signAt(sorted, leadCoef, t))).join(" & ");
  return md`\begin{array}{c|${"c".repeat(tests.length)}} & ${heads.join(" & ")} \\ \hline ${rows.join(" \\\\ ")} \\ \hline ${fTex} & ${product} \end{array}`;
}

const FORMAT = "Give the solution with inequalities or interval notation, like x < -2 or 1 <= x < 4.";

/** The chart and reading-off steps shared by every inequality solution. */
function signSteps(fTex: string, fs: Factor[], leadCoef: number, op: Op, ivs: Iv[]): Step[] {
  const sorted = [...fs].sort((a, b) => a.r - b.r);
  const poles = sorted.filter((f) => f.pole);
  const evens = sorted.filter((f) => f.m % 2 === 0 && !f.pole);
  const endNote = isStrict(op)
    ? md`Strict inequality, so the zeros themselves are left out${poles.length ? md`, and $x = ${poles.map((f) => f.r).join(", ")}$ is excluded anyway: the function isn't defined there` : ""}.`
    : md`The zeros of the ${poles.length ? "numerator" : "polynomial"} are included, since the value is 0 there${poles.length ? md`. The zero of the denominator, $x = ${poles.map((f) => f.r).join(", ")}$, is never included: there is no value to compare` : ""}.`;
  return [
    {
      math: signChartTex(sorted, leadCoef, fTex),
      note: md`The sign can change only at $x = ${sorted.map((f) => f.r).join(", ")}$${poles.length ? " (zeros of the top and of the bottom)" : ""}. Between those, each factor keeps one sign, so each column is read off the factors.${evens.length ? md` The squared factor is never negative, so the sign doesn't flip at $x = ${evens.map((f) => f.r).join(", ")}$.` : ""}`,
    },
    { math: md`${solTex(ivs)} \qquad\text{that is,}\qquad ${solInterval(ivs)}`, note: endNote },
  ];
}

// ── Lesson 1: Zeros and multiplicity ────────────────────────────────────────

const solveRepeatedZero: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const k = r.int(1, 2);
    const [u, v] = distinct(r, 2, -5, 5, [0]) as [number, number];
    const quad = mul(linPoly(u), linPoly(v));
    const text = `${xPow(k)}(${ptext(quad)})`;
    return {
      prompt: md`Solve $${text} = 0$. List each zero once, separated by commas.`,
      answer: [0, u, v].join(", "),
      form: "set",
      hint: md`A product is 0 exactly when one of its factors is 0. Factor the quadratic, then set every factor equal to 0.`,
      solution: [
        { math: md`${xPow(k)}${lin(u)}${lin(v)} = 0`, note: md`Factor the quadratic: two numbers with product $${u * v}$ and sum $${-(u + v)}$ are $${-u}$ and $${-v}$.` },
        { math: md`x = 0, \quad x = ${u}, \quad x = ${v}`, note: md`Zero-product property. ${k === 2 ? md`The zero $0$ has multiplicity 2 (the factor is $x^2$), so the graph touches the axis there and crosses at the other two.` : "Every factor is linear and appears once, so all three zeros have multiplicity 1: the graph crosses at each."}` },
      ],
    };
  }
  if (kind === 1) {
    const [u, v] = distinct(r, 2, -5, 5, [0]) as [number, number];
    const quad = mul(linPoly(u), linPoly(v));
    const p = mul([1, 0, 0], quad);
    return {
      prompt: md`Solve $${ptext(p)} = 0$. List each zero once, separated by commas.`,
      answer: [0, u, v].join(", "),
      form: "set",
      hint: md`Every term has a factor of $x^2$. Pull it out first, then factor what's left.`,
      solution: [
        { math: md`x^2(${ptext(quad)}) = 0`, note: md`Factor out the greatest common factor, $x^2$.` },
        { math: md`x^2${lin(u)}${lin(v)} = 0`, note: md`Factor the quadratic: product $${u * v}$, sum $${-(u + v)}$.` },
        { math: md`x = 0, \quad x = ${u}, \quad x = ${v}`, note: md`The zero $0$ has multiplicity 2, from $x^2$; the graph touches the axis at the origin and crosses at $${u}$ and $${v}$.` },
      ],
    };
  }
  const [a, b] = distinct(r, 2, -4, 4, [0]) as [number, number];
  const { p, steps } = doubleRootCubic(a, b);
  return {
    prompt: md`Solve $${ptext(p)} = 0$. List each zero once, separated by commas.`,
    answer: `${a}, ${b}`,
    form: "set",
    hint: md`Find one rational zero by testing the divisors of $${p[3]}$, divide it out, and factor the quadratic quotient. One zero is repeated: list it once.`,
    solution: [...steps, { math: md`x = ${a}, \quad x = ${b}`, note: md`Two distinct zeros. The cubic has degree 3, and the multiplicities $2 + 1 = 3$ account for all of it.` }],
  };
};

const touchZero: Generator = (r) => {
  if (r.next() < 0.5) {
    const c = r.pick([1, -1, 2, -2, 3]);
    const n = r.int(2, 3);
    const zs = distinct(r, n, -4, 4);
    const evenIdx = r.int(0, n - 1);
    const fs: ZeroM[] = zs.map((z, i) => ({ r: z, m: i === evenIdx ? r.pick([2, 2, 4]) : r.pick([1, 1, 3]) }));
    const F = factorsPoly(c, fs);
    const touch = fs[evenIdx]!;
    return {
      prompt: md`The graph of $f(x) = ${factorsText(c, fs)}$ touches the $x$-axis at one point without crossing it. Find the $x$-value of that point.`,
      answer: String(touch.r),
      verify: [`${subst(ptext(F), "z")} = 0`, `${subst(ptext(deriv(F)), "z")} = 0`],
      hint: "Each factor's exponent is the multiplicity of its zero. Even multiplicity touches; odd multiplicity crosses.",
      solution: [
        { math: fs.map((f) => md`x = ${f.r}: \text{ multiplicity } ${f.m}`).join(", \\quad "), note: md`Read the exponent on each factor. The constant $${c}$ changes no zero.` },
        { math: md`x = ${touch.r}`, note: md`Only this multiplicity is even. Near $x = ${touch.r}$ the factor $${linPow(touch.r, touch.m)}$ is never negative while the other factors keep one sign, so $f$ stays on one side of the axis there.` },
      ],
    };
  }
  const [a, b] = distinct(r, 2, -4, 4, [0]) as [number, number];
  const { p, steps } = doubleRootCubic(a, b);
  return {
    prompt: md`The graph of $f(x) = ${ptext(p)}$ touches the $x$-axis at one point without crossing it. Find the $x$-value of that point.`,
    answer: String(a),
    verify: [`${subst(ptext(p), "z")} = 0`, `${subst(ptext(deriv(p)), "z")} = 0`],
    hint: md`A touch means a repeated factor. Find one rational zero (test divisors of $${p[3]}$), divide it out, and factor the quadratic.`,
    solution: [...steps, { math: md`x = ${a}`, note: md`Multiplicity 2 is even, so the graph touches at $x = ${a}$ and crosses at $x = ${b}$.` }],
  };
};

const buildPolynomial: Generator = (r) => {
  for (;;) {
    const shape = r.pick<number[]>([[2, 1], [1, 2], [3, 1], [2, 2], [1, 1, 2]]);
    const zs = distinct(r, shape.length, -4, 4);
    const fs: ZeroM[] = zs.map((z, i) => ({ r: z, m: shape[i]! }));
    const a = r.pick([1, -1, 2, -2, 3, -3]);
    const degree = shape.reduce((s, m) => s + m, 0);
    const text = factorsText(a, fs);
    const list = fs.map((f) => md`$x = ${f.r}$ with multiplicity ${f.m}`);
    const zeroWords = list.length === 2 ? `${list[0]} and ${list[1]}` : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
    const form: Step = { math: md`f(x) = a${factorsText(1, fs)}`, note: md`A zero of multiplicity $m$ means the factor $(x - r)^m$. The degree is $${shape.join(" + ")} = ${degree}$, the least possible, so nothing else can be a factor except a constant $a$.` };
    if (r.next() < 0.5) {
      return {
        prompt: md`Write a polynomial $f(x)$ of least degree with leading coefficient $${a}$ whose zeros are ${zeroWords}. Any equivalent form is fine, like 5(x - 2)^2(x + 1).`,
        answer: text,
        hint: md`Each zero $r$ of multiplicity $m$ contributes the factor $(x - r)^m$. Multiply them, then put the leading coefficient in front.`,
        solution: [form, { math: md`f(x) = ${text}`, note: md`Multiplying out, the leading term would be $a x^${degree}$, so $a$ is the leading coefficient: $a = ${a}$.` }],
      };
    }
    const candidates = [-2, -1, 0, 1, 2].filter((p) => !zs.includes(p));
    const px = r.pick(candidates);
    const prod = fs.reduce((acc, f) => acc * (px - f.r) ** f.m, 1);
    const q = a * prod;
    if (Math.abs(q) > 80) continue;
    return {
      prompt: md`Write a polynomial $f(x)$ of least degree whose zeros are ${zeroWords} and whose graph passes through $(${px}, ${q})$. Any equivalent form is fine, like 5(x - 2)^2(x + 1).`,
      answer: text,
      hint: md`Write $f(x) = a \cdot (\text{factors})$, then substitute $x = ${px}$ and solve for $a$.`,
      solution: [
        form,
        { math: md`f(${px}) = a${fs.map((f) => (f.m === 1 ? `(${px - f.r})` : `(${px - f.r})^${f.m}`)).join("")} = ${prod}a`, note: md`Substitute $x = ${px}$ into every factor.` },
        { math: md`${prod}a = ${q} \;\Rightarrow\; a = ${a}`, note: md`The graph passes through $(${px}, ${q})$, so $f(${px}) = ${q}$.` },
        { math: md`f(x) = ${text}`, note: "" },
      ],
    };
  }
};

// ── Lesson 2: Polynomial inequalities ───────────────────────────────────────

const factoredInequality: Generator = (r) => {
  for (;;) {
    const n = r.int(2, 3);
    const zs = distinct(r, n, -5, 5);
    const c = r.pick([1, 1, 1, -1, 2]);
    const op = r.pick(OPS);
    const fs = zs.map((z) => factor(z));
    const ivs = solveSign(fs, c, op);
    if (!ivs) continue;
    const text = factorsText(c, fs);
    return {
      prompt: md`Solve $${text} ${OP_TEX[op]} 0$. ${FORMAT}`,
      answer: solText(ivs),
      form: "inequality",
      hint: md`The zeros are $${[...zs].sort((a, b) => a - b).join(", ")}$. Between consecutive zeros the sign can't change, so test one point in each interval.${c < 0 ? " Don't forget the negative constant out front." : ""}`,
      solution: [
        { math: md`\text{zeros: } x = ${[...zs].sort((a, b) => a - b).join(", ")}`, note: md`Already factored. Set each factor to 0.` },
        ...signSteps("f(x)", fs, c, op, ivs),
      ],
    };
  }
};

const expandedInequality: Generator = (r) => {
  for (;;) {
    const kind = r.int(0, 2);
    const op = r.pick(OPS);
    if (kind === 0) {
      const c = r.int(1, 4);
      const p: Poly = [1, 0, -c * c, 0];
      const fs = [factor(0), factor(c), factor(-c)];
      const ivs = solveSign(fs, 1, op);
      if (!ivs) continue;
      return {
        prompt: md`Solve $${ptext(p)} ${OP_TEX[op]} 0$. ${FORMAT}`,
        answer: solText(ivs),
        form: "inequality",
        hint: md`Factor out $x$, then use the difference of squares. Don't divide both sides by $x$: its sign is unknown.`,
        solution: [
          { math: md`x(x^2 - ${c * c}) = x${lin(c)}${lin(-c)} ${OP_TEX[op]} 0`, note: md`Factor completely. The zeros are $-${c}, 0, ${c}$.` },
          ...signSteps(ptext(p), fs, 1, op, ivs),
        ],
      };
    }
    if (kind === 1) {
      const [u, v] = distinct(r, 2, -5, 5, [0]) as [number, number];
      const quad = mul(linPoly(u), linPoly(v));
      const p = mul([1, 0], quad);
      const fs = [factor(0), factor(u), factor(v)];
      const ivs = solveSign(fs, 1, op);
      if (!ivs) continue;
      return {
        prompt: md`Solve $${ptext(p)} ${OP_TEX[op]} 0$. ${FORMAT}`,
        answer: solText(ivs),
        form: "inequality",
        hint: md`Every term has a factor of $x$. Factor it out, then factor the quadratic.`,
        solution: [
          { math: md`x(${ptext(quad)}) = x${lin(u)}${lin(v)} ${OP_TEX[op]} 0`, note: md`Factor out $x$, then the quadratic: product $${u * v}$, sum $${-(u + v)}$.` },
          ...signSteps(ptext(p), fs, 1, op, ivs),
        ],
      };
    }
    const a = r.int(1, 3);
    const b = r.int(a + 1, 4);
    const p: Poly = [1, 0, -(a * a + b * b), 0, a * a * b * b];
    const fs = [factor(a), factor(-a), factor(b), factor(-b)];
    const ivs = solveSign(fs, 1, op);
    if (!ivs) continue;
    return {
      prompt: md`Solve $${ptext(p)} ${OP_TEX[op]} 0$. ${FORMAT}`,
      answer: solText(ivs),
      form: "inequality",
      hint: md`Treat it as a quadratic in $x^2$: two numbers with product $${a * a * b * b}$ and sum $${-(a * a + b * b)}$. Then each difference of squares splits again.`,
      solution: [
        { math: md`(x^2 - ${a * a})(x^2 - ${b * b}) ${OP_TEX[op]} 0`, note: md`Factor as a quadratic in $x^2$.` },
        { math: md`${lin(a)}${lin(-a)}${lin(b)}${lin(-b)} ${OP_TEX[op]} 0`, note: md`Each factor is a difference of squares. Four zeros: $\pm ${a}$ and $\pm ${b}$.` },
        ...signSteps(ptext(p), fs, 1, op, ivs),
      ],
    };
  }
};

const movedInequality: Generator = (r) => {
  for (;;) {
    const kind = r.int(0, 2);
    const op = r.pick(OPS);
    if (kind === 0) {
      const [a, b] = distinct(r, 2, -4, 4) as [number, number];
      const c = r.pick([1, 1, -1]);
      const fs = [factor(a, 2), factor(b)];
      const ivs = solveSign(fs, c, op);
      if (!ivs) continue;
      const text = factorsText(c, fs);
      return {
        prompt: md`Solve $${text} ${OP_TEX[op]} 0$. ${FORMAT}`,
        answer: solText(ivs),
        form: "inequality",
        hint: md`The squared factor is never negative, so the sign of the product changes only at $x = ${b}$. Decide separately whether $x = ${a}$ itself belongs.`,
        solution: [
          { math: md`\text{zeros: } x = ${a} \text{ (multiplicity 2)}, \quad x = ${b}`, note: "Already factored." },
          ...signSteps("f(x)", fs, c, op, ivs),
        ],
      };
    }
    if (kind === 1) {
      const [u, v] = distinct(r, 2, -5, 5, [0]) as [number, number];
      const rhs = poly([[u + v, "x^2"], [-u * v, "x"]]);
      const quad = mul(linPoly(u), linPoly(v));
      const p = mul([1, 0], quad);
      const fs = [factor(0), factor(u), factor(v)];
      const ivs = solveSign(fs, 1, op);
      if (!ivs) continue;
      return {
        prompt: md`Solve $x^3 ${OP_TEX[op]} ${rhs}$. ${FORMAT}`,
        answer: solText(ivs),
        form: "inequality",
        hint: md`Bring everything to the left so the right side is 0. A sign chart only works against 0.`,
        solution: [
          { math: md`${ptext(p)} ${OP_TEX[op]} 0`, note: md`Subtract $${rhs}$ from both sides. Adding the same thing to both sides never changes an inequality.` },
          { math: md`x${lin(u)}${lin(v)} ${OP_TEX[op]} 0`, note: md`Factor out $x$, then the quadratic. Zeros: $${[0, u, v].sort((x, y) => x - y).join(", ")}$.` },
          ...signSteps(ptext(p), fs, 1, op, ivs),
        ],
      };
    }
    const a = r.int(1, 4);
    const fs = [factor(0, 2), factor(a), factor(-a)];
    const ivs = solveSign(fs, 1, op);
    if (!ivs) continue;
    return {
      prompt: md`Solve $x^4 ${OP_TEX[op]} ${a * a}x^2$. ${FORMAT}`,
      answer: solText(ivs),
      form: "inequality",
      hint: md`Don't divide by $x^2$: it could be 0. Move everything to one side and factor out $x^2$.`,
      solution: [
        { math: md`x^4 - ${a * a}x^2 ${OP_TEX[op]} 0`, note: md`Subtract $${a * a}x^2$ from both sides.` },
        { math: md`x^2${lin(a)}${lin(-a)} ${OP_TEX[op]} 0`, note: md`Factor out $x^2$, then the difference of squares. Zeros: $-${a}$, $0$ (multiplicity 2), $${a}$.` },
        ...signSteps(md`x^4 - ${a * a}x^2`, fs, 1, op, ivs),
      ],
    };
  }
};

// ── Lesson 3: Rational functions in full ────────────────────────────────────

const slantAsymptote: Generator = (r) => {
  if (r.next() < 0.65) {
    const d = r.nonzero(-4, 4);
    const a = r.pick([1, 1, 2, 3, -1, -2]);
    const b = r.int(-5, 5);
    const R = r.nonzero(-6, 6);
    const D = linPoly(d);
    const q: Poly = [a, b];
    const N = add(mul(q, D), [R]);
    const { steps } = longDivision(N, D);
    return {
      prompt: md`Find the slant asymptote of $f(x) = ${ratTex(N, D)}$. Give it as an expression in $x$ (the right side of $y = \ldots$), like 2x - 1.`,
      answer: ptext(q),
      simplified: true,
      verify: [`${ptext(N)} = (${ptext(D)}) q + (${R})`],
      hint: md`The numerator's degree is one more than the denominator's, so divide. The quotient is the line; the remainder term shrinks to 0 far out.`,
      solution: [
        ...steps,
        { math: md`f(x) = ${ptext(q)} + \frac{${R}}{${ptext(D)}}`, note: md`$N = qD + R$ divided through by $D$: quotient $${ptext(q)}$, remainder $${R}$.` },
        { math: md`y = ${ptext(q)}`, note: md`As $x \to \pm\infty$, $\frac{${R}}{${ptext(D)}} \to 0$, so $f(x) - (${ptext(q)}) \to 0$. The line $y = ${ptext(q)}$ is the slant asymptote.` },
      ],
    };
  }
  const s = r.pick([1, 2, 4, -1, -4, -9]);
  const D: Poly = [1, 0, s];
  const b = r.nonzero(-4, 4);
  const q: Poly = [1, b];
  const R: Poly = [r.nonzero(-4, 4), r.int(-5, 5)];
  const N = add(mul(q, D), R);
  const { steps } = longDivision(N, D);
  return {
    prompt: md`Find the slant asymptote of $f(x) = ${ratTex(N, D)}$. Give it as an expression in $x$ (the right side of $y = \ldots$), like 2x - 1.`,
    answer: ptext(q),
    simplified: true,
    verify: [`${ptext(N)} = (${ptext(D)}) q + (${ptext(R)})`],
    hint: md`Degree 3 over degree 2: one more on top, so there is a slant asymptote. Long division; stop when the remainder has degree below 2.`,
    solution: [
      ...steps,
      { math: md`f(x) = ${ptext(q)} + \frac{${ptext(R)}}{${ptext(D)}}`, note: md`Quotient $${ptext(q)}$, remainder $${ptext(R)}$ (degree 1, below the divisor's degree 2).` },
      { math: md`y = ${ptext(q)}`, note: md`The remainder fraction has a smaller degree on top than on the bottom, so it goes to 0 as $x \to \pm\infty$. What's left is the line.` },
    ],
  };
};

const rationalFeatures: Generator = (r) => {
  if (r.next() < 0.5) {
    for (;;) {
      const c = r.pick([1, 1, 2, -1]);
      const [h, u, v] = distinct(r, 3, -4, 4) as [number, number, number];
      const height = (c * (h - u)) / (h - v);
      if (height === 0 || Math.abs(height) > 12) continue;
      const N = scale(mul(linPoly(h), linPoly(u)), c);
      const D = mul(linPoly(h), linPoly(v));
      const Ns: Poly = scale(linPoly(u), c);
      const Ds = linPoly(v);
      const k = frac(c * (h - u), h - v);
      return {
        prompt: md`The graph of $f(x) = ${ratTex(N, D)}$ has a hole. Give it as a point (x, y). Fractions are fine, like (2, 5/3).`,
        answer: `(${h}, ${k})`,
        form: "tuple",
        verify: [
          `k (${subst(ptext(deriv(D)), "h")}) = ${subst(ptext(deriv(N)), "h")}`,
          `(${subst(ptext(N), "h")})^2 + (${subst(ptext(D), "h")})^2 + (k (${subst(ptext(Ds), "h")}) - (${subst(ptext(Ns), "h")}))^2 = 0`,
        ],
        hint: "Factor top and bottom. The factor that cancels marks the hole; its height is the simplified expression evaluated there.",
        solution: [
          { math: md`f(x) = \frac{${factorsText(c, [{ r: h, m: 1 }, { r: u, m: 1 }])}}{${prod([h, v])}}`, note: "Factor the numerator and the denominator." },
          { math: md`f(x) = \frac{${ptext(Ns)}}{${ptext(Ds)}}, \quad x \ne ${h}`, note: md`Cancel $${linBare(h)}$. The original is undefined at $x = ${h}$, so the simplified form is only equal to it elsewhere.` },
          { math: md`\left(${h}, ${fracTex(c * (h - u), h - v)}\right)`, note: md`The hole: $x = ${h}$, at the height the simplified form gives, $\frac{${c * (h - u)}}{${h - v}}$. (The other zero of the bottom, $x = ${v}$, is a vertical asymptote.)` },
        ],
      };
    }
  }
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [v1, v2, w] = distinct(r, 3, -4, 4) as [number, number, number];
    const c = r.pick([1, 2, -1, 3]);
    const N = scale(linPoly(w), c);
    const D = mul(linPoly(v1), linPoly(v2));
    const sorted = [v1, v2].sort((a, b) => a - b);
    return {
      prompt: md`Find every vertical asymptote of $f(x) = ${ratTex(N, D)}$. Type the $x$-values separated by commas, like -1, 3.`,
      answer: sorted.join(", "),
      form: "set",
      verify: [`${subst(ptext(D), "v")} = 0`],
      hint: "Factor the denominator. Each zero of the bottom that doesn't cancel with the top is a vertical asymptote.",
      solution: [
        { math: md`f(x) = \frac{${ptext(N)}}{${prod([v1, v2])}}`, note: md`Factor the denominator${v1 * v2 === 0 ? md`: factor out the common $x$` : md` (product $${v1 * v2}$, sum $${-(v1 + v2)}$)`}. Nothing cancels with the numerator, whose only zero is $x = ${w}$.` },
        { math: md`x = ${sorted[0]}, \quad x = ${sorted[1]}`, note: md`Near each one the bottom goes to 0 while the top stays near a nonzero number, so the values blow up.` },
      ],
    };
  }
  if (kind === 1) {
    const [v1, v2, w] = distinct(r, 3, -4, 4) as [number, number, number];
    const c = r.pick([1, 1, 2, -1]);
    const N = scale(mul(linPoly(v1), linPoly(w)), c);
    const D = mul(linPoly(v1), linPoly(v2));
    return {
      prompt: md`Find every vertical asymptote of $f(x) = ${ratTex(N, D)}$. Type the $x$-values separated by commas, like -1, 3. If there is only one, type just that number.`,
      answer: String(v2),
      form: "set",
      verify: [`${subst(ptext(D), "v")} = 0`],
      hint: "Factor both top and bottom and cancel first. A cancelled factor gives a hole, not an asymptote.",
      solution: [
        { math: md`f(x) = \frac{${factorsText(c, [{ r: v1, m: 1 }, { r: w, m: 1 }])}}{${prod([v1, v2])}}`, note: "Factor top and bottom." },
        { math: md`f(x) = \frac{${ptext(scale(linPoly(w), c))}}{${linBare(v2)}}, \quad x \ne ${v1}`, note: md`$${linBare(v1)}$ cancels, so $x = ${v1}$ is a hole: nearby, $f$ stays close to an ordinary number.` },
        { math: md`x = ${v2}`, note: md`The only factor left in the denominator. This is the one vertical asymptote.` },
      ],
    };
  }
  const [v2, v3, w] = distinct(r, 3, -4, 4, [0]) as [number, number, number];
  const N = linPoly(w);
  const D = mul([1, 0], mul(linPoly(v2), linPoly(v3)));
  const sorted = [0, v2, v3].sort((a, b) => a - b);
  return {
    prompt: md`Find every vertical asymptote of $f(x) = ${ratTex(N, D)}$. Type the $x$-values separated by commas, like -1, 3.`,
    answer: sorted.join(", "),
    form: "set",
    verify: [`${subst(ptext(D), "v")} = 0`],
    hint: md`Every term of the denominator has a factor of $x$. Factor it out, then factor the quadratic.`,
    solution: [
      { math: md`f(x) = \frac{${ptext(N)}}{x${lin(v2)}${lin(v3)}}`, note: md`Factor out $x$, then the quadratic (${quadNote(v2, v3)}). The numerator's zero $x = ${w}$ matches none of them.` },
      { math: md`x = ${sorted.join(", \\quad x = ")}`, note: "Three zeros of the denominator, none cancelled: three vertical asymptotes." },
    ],
  };
};

/** A rational inequality N/D op rhs, solved by sign chart. */
function rationalProblem(lhsTex: string, rhsTex: string, fTex: string, fs: Factor[], c: number, op: Op, pre: Step[], hint: string): Problem | null {
  const ivs = solveSign(fs, c, op);
  if (!ivs) return null;
  const strict = isStrict(op);
  return {
    prompt: strict ? md`Solve $${lhsTex} ${OP_TEX[op]} ${rhsTex}$. ${FORMAT}` : md`Find every $x$ for which $${lhsTex} ${OP_TEX[op]} ${rhsTex}$. ${FORMAT}`,
    answer: solText(ivs),
    form: "inequality",
    hint,
    solution: [...pre, ...signSteps(fTex, fs, c, op, ivs)],
  };
}

const rationalInequality: Generator = (r) => {
  for (;;) {
    const kind = r.int(0, 2);
    const op = r.pick(OPS);
    if (kind === 0) {
      const [a, b] = distinct(r, 2, -5, 5) as [number, number];
      const c = r.pick([1, 1, -1]);
      const N = scale(linPoly(a), c);
      const D = linPoly(b);
      const fTex = ratTex(N, D);
      const p = rationalProblem(fTex, "0", fTex, [factor(a), factor(b, 1, true)], c, op, [{ math: md`\text{zero of the top: } x = ${a}; \quad \text{zero of the bottom: } x = ${b}`, note: md`Both kinds of zero are critical numbers: the sign of a fraction can change where the numerator is 0 and where the denominator is 0.` }], md`The fraction can change sign at $x = ${a}$ (top is 0) and at $x = ${b}$ (bottom is 0). Never include $x = ${b}$.`);
      if (p) return p;
      continue;
    }
    if (kind === 1) {
      const [a, b, d] = distinct(r, 3, -5, 5) as [number, number, number];
      const topTwo = r.next() < 0.5;
      const N = topTwo ? mul(linPoly(a), linPoly(d)) : linPoly(a);
      const D = topTwo ? linPoly(b) : mul(linPoly(b), linPoly(d));
      const fs = topTwo ? [factor(a), factor(d), factor(b, 1, true)] : [factor(a), factor(b, 1, true), factor(d, 1, true)];
      const fTex = ratTex(N, D);
      const factoredTex = topTwo ? md`\frac{${prod([a, d])}}{${linBare(b)}}` : md`\frac{${linBare(a)}}{${prod([b, d])}}`;
      const p = rationalProblem(fTex, "0", fTex, fs, 1, op, [{ math: md`${factoredTex} ${OP_TEX[op]} 0`, note: md`Factor. Critical numbers: $${[a, b, d].sort((x, y) => x - y).join(", ")}$. ${topTwo ? md`Of these, $x = ${b}$ makes` : md`Of these, $x = ${b}$ and $x = ${d}$ make`} the denominator 0.` }], "Factor top and bottom. Every zero of either one is a critical number; only zeros of the top can be included in the answer.");
      if (p) return p;
      continue;
    }
    const b = r.int(-4, 4);
    const k = r.pick([2, 3, -1, -2]);
    const pp = r.int(-5, 5);
    const num: Poly = [1 - k, pp + k * b];
    const rho = (pp + k * b) / (k - 1);
    if (!Number.isInteger(rho) || rho === b || Math.abs(rho) > 8) continue;
    const Nrat: Poly = [1, pp];
    const D = linPoly(b);
    const lhsTex = ratTex(Nrat, D);
    const fTex = md`\frac{${ptext(num)}}{${ptext(D)}}`;
    const pre: Step[] = [
      { math: md`${lhsTex} - ${k < 0 ? `(${k})` : k} ${OP_TEX[op]} 0`, note: md`Bring the ${k} over. Multiplying both sides by $${ptext(D)}$ would be a mistake: it is negative for some $x$ and positive for others, so you wouldn't know whether to flip the sign.` },
      { math: md`\frac{${ptext(Nrat)} - ${k < 0 ? `(${k})` : k}${lin(b)}}{${ptext(D)}} ${OP_TEX[op]} 0`, note: md`Write ${k} over the common denominator $${ptext(D)}$ and combine.` },
      { math: md`${fTex} ${OP_TEX[op]} 0`, note: md`Simplify the numerator. Its zero is $x = ${rho}$; the denominator's zero is $x = ${b}$.` },
    ];
    const p = rationalProblem(lhsTex, String(k), fTex, [factor(rho), factor(b, 1, true)], 1 - k, op, pre, md`Don't multiply by $${ptext(D)}$. Subtract ${k} from both sides, combine into one fraction, and make a sign chart.`);
    if (p) return p;
  }
};

// ── The unit ────────────────────────────────────────────────────────────────

export const unit2: Unit = {
  title: "Polynomial and Rational Analysis",
  lessons: [
    {
      id: slug("Zeros and multiplicity"),
      title: "Zeros and multiplicity",
      summary: "Why a repeated factor flattens the graph at a zero, why the degree caps the number of zeros, and how to build a polynomial from its zeros.",
      blocks: [
        {
          kind: "text",
          body: md`Algebra 2 gave you the rule: at a zero of odd multiplicity the graph crosses the $x$-axis, at a zero of even multiplicity it touches and turns back. This lesson slows down and asks why, then uses the answer to count zeros and to build polynomials to order. Everything rests on one connection: zeros are factors.`,
        },
        {
          kind: "key",
          title: "Zeros, factors and multiplicity",
          body: md`For a polynomial $f$, the number $r$ is a **zero** when $f(r) = 0$. By the factor theorem, that happens exactly when $x - r$ is a factor of $f$.

If $f(x) = (x - r)^m g(x)$ with $g(r) \ne 0$, then $r$ is a zero of **multiplicity** $m$: the factor $x - r$ appears exactly $m$ times.`,
        },
        {
          kind: "why",
          title: "Why zeros and factors are the same thing",
          body: md`Divide $f$ by $x - r$. The remainder has degree less than 1, so it is a constant, and $f(x) = (x - r)q(x) + R$. Put in $x = r$: the first term dies and $f(r) = R$. So the remainder is $f(r)$ (the remainder theorem), and $f(r) = 0$ exactly when the remainder is 0, which is exactly when $x - r$ divides $f$.

Multiplicity just repeats the idea. If $r$ is still a zero of the quotient $q$, divide again. Stop when the quotient is no longer 0 at $r$; the number of divisions is $m$.`,
        },
        {
          kind: "example",
          title: "Finding multiplicities from standard form",
          problem: md`Find the zeros of $f(x) = x^3 - 3x + 2$ and their multiplicities.`,
          steps: [
            { math: md`f(1) = 1 - 3 + 2 = 0`, note: md`Rational zeros must divide the constant term 2, so try $\pm 1, \pm 2$. The first one works.` },
            { math: md`f(x) = (x - 1)(x^2 + x - 2)`, note: md`Synthetic division by $x - 1$: coefficients $1, 1, -2$, remainder 0.` },
            { math: md`f(x) = (x - 1)(x - 1)(x + 2) = (x - 1)^2(x + 2)`, note: md`$x^2 + x - 2 = (x - 1)(x + 2)$. The factor $x - 1$ appears again.` },
            { math: md`x = 1 \text{ (multiplicity 2)}, \quad x = -2 \text{ (multiplicity 1)}`, note: md`So the graph touches at $1$ and crosses at $-2$. Check: $g(x) = x + 2$ has $g(1) = 3 \ne 0$, so the multiplicity of 1 is exactly 2.` },
          ],
        },
        {
          kind: "why",
          title: "Why the graph near a zero looks like a power",
          body: md`Write $f(x) = (x - r)^m g(x)$ with $g(r) \ne 0$. For $x$ close to $r$, the factor $g(x)$ is close to the fixed number $g(r)$: it barely moves. So near $r$,

$$f(x) \approx g(r)\,(x - r)^m.$$

That is a stretched power function centered at $r$. If $m = 1$ it is a line through the axis, so the graph crosses at a slant. If $m = 2$ it is a parabola touching the axis from one side. If $m = 3$ it is a cubic that flattens out, then crosses. The sign of $(x - r)^m$ decides everything: an even power is never negative, so the graph can't get to the other side of the axis; an odd power changes sign at $r$, so it must.

Bigger $m$ means flatter, because small numbers shrink when raised to powers: at $0.1$ from the zero, $(0.1)^2 = 0.01$ and $(0.1)^3 = 0.001$.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-6, 6],
          curves: [
            { expr: "(x - 1)^m (x + 2)", label: "y = (x - 1)^{m}(x + 2)" },
            { expr: "3(x - 1)^m", label: "y = 3(x - 1)^{m}", color: 2, dashed: true },
          ],
          points: [{ x: 1, y: 0, label: "(1, 0)", color: 2 }],
          params: [{ name: "m", label: "multiplicity m", min: 1, max: 4, step: 1, value: 2 }],
          caption: md`$f(x) = (x - 1)^m(x + 2)$ and its local stand-in $3(x - 1)^m$, where $3 = g(1)$. Near $x = 1$ the two are almost the same curve. Odd $m$ crosses, even $m$ touches, and the graph gets flatter at the zero as $m$ grows.`,
        },
        {
          kind: "key",
          title: "Reading a graph at its zeros",
          body: md`- **Multiplicity 1:** the graph crosses the axis at a slant, like a line.
- **Odd multiplicity 3 or more:** the graph flattens against the axis, then crosses.
- **Even multiplicity:** the graph touches the axis and turns back, flatter for larger $m$.

Multiplicities add up to at most the degree. A graph with $k$ crossings and touches comes from a polynomial of degree at least $k$.`,
        },
        {
          kind: "proof",
          title: "A polynomial of degree n has at most n zeros, counted with multiplicity",
          given: md`$f$ is a polynomial of degree $n \ge 1$ with distinct zeros $r_1, \ldots, r_k$ of multiplicities $m_1, \ldots, m_k$`,
          prove: md`$m_1 + m_2 + \cdots + m_k \le n$`,
          steps: [
            { statement: md`$f(x) = (x - r_1)^{m_1} g_1(x)$ with $g_1(r_1) \ne 0$`, reason: "Definition of multiplicity (the factor theorem applied $m_1$ times)" },
            { statement: md`$g_1(r_2) = 0$`, reason: md`$0 = f(r_2) = (r_2 - r_1)^{m_1} g_1(r_2)$ and $(r_2 - r_1)^{m_1} \ne 0$ since $r_2 \ne r_1$; zero-product property` },
            { statement: md`$g_1(x) = (x - r_2)^{m_2} g_2(x)$ with $g_2(r_2) \ne 0$, so $f(x) = (x - r_1)^{m_1}(x - r_2)^{m_2} g_2(x)$`, reason: md`Factor theorem applied to $g_1$ at $r_2$. The multiplicity of $r_2$ in $f$ is still $m_2$, because $(x - r_1)^{m_1}$ is not 0 at $r_2$` },
            { statement: md`$f(x) = (x - r_1)^{m_1} \cdots (x - r_k)^{m_k} \, g_k(x)$`, reason: "Repeat for each remaining zero" },
            { statement: md`$n = m_1 + \cdots + m_k + \deg g_k$`, reason: "The degree of a product is the sum of the degrees (leading terms multiply)" },
            { statement: md`$m_1 + \cdots + m_k \le n$`, reason: md`$\deg g_k \ge 0$. Equality holds exactly when $g_k$ is a constant` },
          ],
        },
        {
          kind: "text",
          body: md`The proof gives more than a bound. When the multiplicities add up to exactly $n$, the leftover factor $g_k$ is a constant $a$, and

$$f(x) = a(x - r_1)^{m_1}(x - r_2)^{m_2} \cdots (x - r_k)^{m_k}.$$

So a polynomial of degree $n$ is pinned down by its $n$ zeros (with multiplicity) and one more number, the leading coefficient $a$. Any single extra point on the graph fixes $a$.`,
        },
        {
          kind: "example",
          title: "Building a polynomial to order",
          problem: md`Find the polynomial of least degree with zeros $-3$ (multiplicity 1) and $1$ (multiplicity 2) whose graph passes through $(0, 6)$.`,
          steps: [
            { math: md`f(x) = a(x + 3)(x - 1)^2`, note: md`One factor per zero, raised to its multiplicity. Degree $1 + 2 = 3$ is the least possible, so no other factor is allowed except a constant.` },
            { math: md`f(0) = a(3)(-1)^2 = 3a`, note: md`Substitute $x = 0$.` },
            { math: md`3a = 6 \;\Rightarrow\; a = 2`, note: md`The graph passes through $(0, 6)$.` },
            { math: md`f(x) = 2(x + 3)(x - 1)^2`, note: md`Expanded, that's $2x^3 + 2x^2 - 10x + 6$. Either form is the answer.` },
          ],
        },
        {
          kind: "plot",
          x: [-5, 4],
          y: [-12, 14],
          curves: [{ expr: "a (x + 3)(x - 1)^2", label: "y = a(x + 3)(x - 1)^2" }],
          points: [
            { x: 0, y: "3a", label: "(0, {=3a})", color: 2 },
            { x: -3, y: 0, color: 3 },
            { x: 1, y: 0, color: 3 },
          ],
          params: [{ name: "a", tex: "a", min: -2, max: 2, step: 0.5, value: 2 }],
          caption: md`Every member of the family $a(x + 3)(x - 1)^2$ has the same zeros, the same crossing at $-3$ and the same touch at $1$. The slider only stretches the graph vertically (and flips it when $a < 0$). One point off the axis, like the $y$-intercept, picks out one member.`,
        },
        {
          kind: "why",
          title: "Why one extra point is enough, and why it can't be a zero",
          body: md`Two polynomials with the same zeros and multiplicities, adding up to the degree, are $a \cdot p(x)$ and $b \cdot p(x)$ for the same product $p$. At any point $x_0$ that isn't a zero, $p(x_0) \ne 0$, so $a\,p(x_0) = b\,p(x_0)$ forces $a = b$. One point decides.

A zero can't do the job: every member of the family passes through $(r, 0)$, so that point says nothing about $a$.`,
        },
        {
          kind: "check",
          prompt: md`What is the multiplicity of the zero $x = 2$ of $f(x) = (x - 2)^3(x + 5)^2 x$?`,
          answer: "3",
          explain: md`The factor $x - 2$ appears with exponent 3. Since $(x + 5)^2 x$ is not 0 at $x = 2$, the multiplicity is exactly 3: the graph flattens and crosses there.`,
        },
        {
          kind: "check",
          prompt: md`Write a polynomial of least degree with leading coefficient 1 whose zeros are $0$ with multiplicity 2 and $-4$ with multiplicity 1. Any equivalent form is fine.`,
          answer: "x^2(x + 4)",
          explain: md`The factors are $x^2$ (the zero $0$, twice) and $x + 4$. Leading coefficient 1 means nothing in front: $f(x) = x^2(x + 4) = x^3 + 4x^2$.`,
        },
      ],
      practice: [solveRepeatedZero, touchZero, buildPolynomial],
    },
    {
      id: slug("Polynomial inequalities"),
      title: "Polynomial inequalities",
      summary: "Why a polynomial can change sign only at a zero, and how a sign chart turns that fact into a method.",
      blocks: [
        {
          kind: "text",
          body: md`For which $x$ is $x^3 - 4x > 0$? The first instinct, divide by $x$, is a trap: $x$ might be negative, and dividing by a negative flips the inequality. We don't know which way it should point.

The way out is to compare with 0 and look at the graph. $x^3 - 4x > 0$ exactly where the graph of $y = x^3 - 4x$ is above the $x$-axis.`,
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-8, 8],
          curves: [{ expr: "x^3 - 4x", label: "y = x^3 - 4x" }],
          shade: [
            { expr: "x^3 - 4x", from: -2, to: 0, color: 3 },
            { expr: "x^3 - 4x", from: 2, to: 3.2, color: 3 },
          ],
          vlines: [{ x: -2, label: "x = -2" }, { x: 0, label: "x = 0" }, { x: 2, label: "x = 2" }],
          caption: md`$y = x^3 - 4x = x(x - 2)(x + 2)$. The shaded parts are where the graph is above the axis: $-2 < x < 0$ and $x > 2$. Notice where the sign changes: only at the zeros $-2$, $0$, $2$.`,
        },
        {
          kind: "why",
          title: "Why the sign can change only at a zero",
          body: md`Picture first: a polynomial's graph is one unbroken curve. To get from below the axis to above it, the curve has to pass through the axis, and the point where it does is a zero. No zero, no sign change.

The picture can be made exact with factors. Algebra 2 showed that every polynomial with real coefficients factors into linear factors $x - r$ and quadratic factors with no real zeros. Each linear factor changes sign only at its own zero. A quadratic factor with no real zeros never changes sign at all. And the sign of a product is set by the signs of its factors. So between two consecutive zeros, where no factor changes sign, the product can't either.`,
        },
        {
          kind: "proof",
          title: "Between consecutive zeros, a polynomial keeps one sign",
          given: md`$f(x) = a(x - r_1)^{m_1} \cdots (x - r_k)^{m_k}\, q(x)$, where $q$ is a product of quadratics with no real zeros (or the constant 1), and $r_i < x < r_{i+1}$ are consecutive zeros`,
          prove: md`$f$ has the same sign at every $x$ with $r_i < x < r_{i+1}$`,
          steps: [
            { statement: md`For each $j$, $x - r_j$ is positive for every $x$ in the interval, or negative for every $x$ in it`, reason: md`A difference is positive when the first number is bigger. The interval lies entirely on one side of $r_j$, since it contains no zero` },
            { statement: md`Each $(x - r_j)^{m_j}$ keeps one sign on the interval`, reason: "A power of a positive number is positive; a power of a negative number has the sign fixed by whether the exponent is even or odd" },
            { statement: md`Each quadratic factor $x^2 + bx + c$ of $q$ with $b^2 - 4c < 0$ equals $\left(x + \frac{b}{2}\right)^2 + \left(c - \frac{b^2}{4}\right)$, which is positive for every $x$`, reason: md`Completing the square; the first term is a square and the second is $\frac{4c - b^2}{4} > 0$` },
            { statement: md`$f(x)$ has the same sign for every $x$ in the interval`, reason: "Sign rules: a product of factors that each keep one sign keeps one sign (the number of negative factors doesn't change)" },
          ],
        },
        {
          kind: "key",
          title: "Solving a polynomial inequality with a sign chart",
          body: md`1. Rearrange so one side is 0: $f(x) > 0$, $\ge 0$, $< 0$ or $\le 0$.
2. Factor $f$ and find its zeros. Mark them on a number line.
3. In each interval between zeros, find the sign of $f$: test one point, or read the sign of each factor.
4. Pick the intervals with the sign you want. For $\ge$ or $\le$, include the zeros (there $f = 0$); for $>$ or $<$, leave them out.

Type the answer like **x < -2 or 1 <= x <= 4**, or in interval notation, **(-inf, -2) U [1, 4]**.`,
        },
        {
          kind: "example",
          title: "The opening question",
          problem: md`Solve $x^3 - 4x > 0$.`,
          steps: [
            { math: md`x(x - 2)(x + 2) > 0`, note: md`Factor: $x(x^2 - 4)$, then the difference of squares. Zeros at $-2, 0, 2$.` },
            {
              math: md`\begin{array}{c|cccc} & x < -2 & -2 < x < 0 & 0 < x < 2 & x > 2 \\ \hline x + 2 & - & + & + & + \\ x & - & - & + & + \\ x - 2 & - & - & - & + \\ \hline f(x) & - & + & - & + \end{array}`,
              note: md`Each factor flips sign at its own zero and nowhere else. The bottom row multiplies the signs: three negatives give a negative, two give a positive.`,
            },
            { math: md`-2 < x < 0 \quad\text{or}\quad x > 2`, note: md`The intervals with $+$. The zeros are left out, because $f = 0$ there and we need $f > 0$. In interval notation: $(-2, 0) \cup (2, \infty)$.` },
          ],
        },
        {
          kind: "numberline",
          range: [-4, 4],
          intervals: [
            { from: -2, to: 0, fromOpen: true, toOpen: true },
            { from: 2, to: null, fromOpen: true },
          ],
          points: [{ at: -2, open: true }, { at: 0, open: true }, { at: 2, open: true }],
          caption: md`The solution of $x^3 - 4x > 0$: open circles at the zeros, since a strict inequality excludes them. Compare with the shaded graph above.`,
        },
        {
          kind: "why",
          title: "Why one test point per interval is enough",
          body: md`The theorem says $f$ keeps one sign on each interval between consecutive zeros. So whatever sign $f$ has at one point of the interval, it has at every point. Testing $x = 3$ in $x^3 - 4x$ gives $27 - 12 = 15 > 0$, and that settles the whole interval $x > 2$.

Reading the factors is the same idea organised: the sign of $x - 2$ at a test point is just whether the point is to the right of 2.`,
        },
        {
          kind: "why",
          title: "Why an even multiplicity doesn't flip the sign",
          body: md`Lesson 1 showed that near a zero $r$ of multiplicity $m$, $f(x) \approx g(r)(x - r)^m$. If $m$ is even, $(x - r)^m$ is positive on both sides of $r$, so $f$ has the same sign on both sides: the chart doesn't flip there. If $m$ is odd, it flips.

This creates a special case. In $(x - 1)^2(x + 3) \le 0$, the product is negative for $x < -3$, zero at $-3$ and at $1$, and positive everywhere else. So the solution is $x \le -3$ **together with the single point $x = 1$**, where the value is exactly 0. Change $\le$ to $<$ and the lonely point disappears: just $x < -3$.`,
        },
        {
          kind: "plot",
          x: [-5, 4],
          y: [-10, 10],
          curves: [{ expr: "(x - 1)^m (x + 3)", label: "y = (x - 1)^{m}(x + 3)" }],
          vlines: [{ x: -3, label: "x = -3" }, { x: 1, label: "x = 1" }],
          params: [{ name: "m", label: "multiplicity m", min: 1, max: 3, step: 1, value: 2 }],
          caption: md`With $m = 2$ the graph touches at $x = 1$ and stays positive on both sides: the sign chart has $+$ in both neighboring columns. With $m = 1$ or $m = 3$ it crosses, and the sign flips.`,
        },
        {
          kind: "numberline",
          range: [-5, 3],
          intervals: [{ from: null, to: -3 }],
          points: [{ at: -3 }, { at: 1 }],
          caption: md`The solution of $(x - 1)^2(x + 3) \le 0$: the ray $x \le -3$ plus the isolated point $x = 1$.`,
        },
        {
          kind: "example",
          title: "Rearranging first",
          problem: md`Solve $x^4 \le 5x^2 - 4$.`,
          steps: [
            { math: md`x^4 - 5x^2 + 4 \le 0`, note: md`Subtract $5x^2 - 4$ from both sides. Adding the same quantity to both sides never changes an inequality, so the right side can always be made 0.` },
            { math: md`(x^2 - 1)(x^2 - 4) \le 0`, note: md`A quadratic in $x^2$: product 4, sum $-5$.` },
            { math: md`(x - 1)(x + 1)(x - 2)(x + 2) \le 0`, note: md`Zeros at $-2, -1, 1, 2$.` },
            {
              math: md`\begin{array}{c|ccccc} & x < -2 & -2 < x < -1 & -1 < x < 1 & 1 < x < 2 & x > 2 \\ \hline f(x) & + & - & + & - & + \end{array}`,
              note: md`Test points: $f(0) = 4 > 0$ in the middle. Every zero has multiplicity 1, so the sign flips at each one. Fill in the rest by alternating.`,
            },
            { math: md`-2 \le x \le -1 \quad\text{or}\quad 1 \le x \le 2`, note: md`The $-$ intervals, with endpoints included because of $\le$. In interval notation, $[-2, -1] \cup [1, 2]$.` },
          ],
        },
        {
          kind: "text",
          body: md`Alternating signs is a shortcut, not a rule: it only works when every zero has odd multiplicity. Whenever a factor is squared, write out the chart or you will flip a sign that shouldn't flip.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x(x - 3)^2 > 0$. Type the answer like x < -2 or 1 < x < 4.`,
          answer: "0 < x < 3 or x > 3",
          form: "inequality",
          explain: md`$(x - 3)^2 \ge 0$ always, so the product has the sign of $x$ except where it is 0. Positive means $x > 0$, but $x = 3$ must come out, since there the product is 0, not positive: $0 < x < 3$ or $x > 3$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x^3 \le 9x$. Type the answer like x <= -2 or 1 <= x <= 4.`,
          answer: "x <= -3 or 0 <= x <= 3",
          form: "inequality",
          explain: md`$x^3 - 9x = x(x - 3)(x + 3) \le 0$. Signs: $-$, $+$, $-$, $+$ on the four intervals. Take the negative ones and include the zeros: $x \le -3$ or $0 \le x \le 3$.`,
        },
      ],
      practice: [factoredInequality, expandedInequality, movedInequality],
    },
    {
      id: slug("Rational functions in full"),
      title: "Rational functions in full",
      summary: "Slant asymptotes from long division, what happens on each side of a vertical asymptote, and sign charts that handle denominators.",
      blocks: [
        {
          kind: "text",
          body: md`Algebra 2 read holes, vertical asymptotes and horizontal asymptotes off a rational function $f(x) = \frac{N(x)}{D(x)}$. Two things were left open. When the top's degree is bigger than the bottom's there is no horizontal asymptote, but the graph still heads somewhere definite. And inequalities with $x$ in a denominator need care, because multiplying through by the denominator is a trap of the same kind as dividing by $x$ in the last lesson.`,
        },
        {
          kind: "key",
          title: "The full checklist for f = N/D",
          body: md`1. Factor $N$ and $D$. Cancel common factors: each cancelled zero is a **hole**.
2. The remaining zeros of $D$ are the **vertical asymptotes**.
3. Far-out behavior, comparing degrees $n$ of $N$ and $m$ of $D$: $n < m$ gives the asymptote $y = 0$; $n = m$ gives $y = \frac{a}{b}$ (leading coefficients); $n = m + 1$ gives a **slant asymptote**, the line $y = q(x)$ where $q$ is the quotient on dividing $N$ by $D$.
4. $x$-intercepts: zeros of $N$ that didn't cancel. $y$-intercept: $f(0)$.
5. Sign chart with the zeros of both $N$ and $D$ as the dividing points.`,
        },
        {
          kind: "why",
          title: "Why long division finds the far-out shape",
          body: md`Take $f(x) = \frac{x^2 + 1}{x - 1}$. Divide: $x^2 + 1 = (x - 1)(x + 1) + 2$, so

$$f(x) = x + 1 + \frac{2}{x - 1}.$$

The piece $\frac{2}{x - 1}$ is a fixed number over something that grows, so it shrinks toward 0 as $x$ moves far out either way. At $x = 100$ it is about $0.02$. So far out, $f(x)$ is within a hair of $x + 1$: the graph hugs the line $y = x + 1$. Close in, the remainder term is what makes the graph curve away from the line, and it blows up at the vertical asymptote $x = 1$.`,
        },
        {
          kind: "plot",
          x: [-6, 8],
          y: [-8, 12],
          curves: [
            { expr: "(x^2 + 1)/(x - 1)", label: md`y = \frac{x^2 + 1}{x - 1}` },
            { expr: "x + 1", label: "y = x + 1", color: 3, dashed: true },
          ],
          vlines: [{ x: 1, label: "x = 1" }],
          caption: md`The curve approaches the dashed line $y = x + 1$ at both ends. The gap between them is exactly $\frac{2}{x - 1}$: positive to the right of 1 (curve above the line), negative to the left (curve below).`,
        },
        {
          kind: "proof",
          title: "The quotient is an asymptote",
          given: md`$f(x) = \frac{N(x)}{D(x)}$ with $N = qD + R$, where $\deg R < \deg D = m$ and $D$ has leading coefficient $b \ne 0$`,
          prove: md`$f(x) - q(x) \to 0$ as $x \to \infty$ and as $x \to -\infty$`,
          steps: [
            { statement: md`$f(x) = q(x) + \dfrac{R(x)}{D(x)}$ wherever $D(x) \ne 0$`, reason: md`Divide $N = qD + R$ through by $D$` },
            { statement: md`$\dfrac{R(x)}{D(x)} = \dfrac{R(x)/x^m}{D(x)/x^m}$ for $x \ne 0$`, reason: "Multiplying top and bottom by the same nonzero number" },
            { statement: md`$D(x)/x^m \to b$ as $x \to \pm\infty$`, reason: md`$D(x)/x^m = b + \frac{(\text{lower terms})}{x^m}$, and each lower term over $x^m$ is a constant over a power of $x$, which goes to 0` },
            { statement: md`$R(x)/x^m \to 0$ as $x \to \pm\infty$`, reason: md`Every term of $R$ has degree less than $m$, so each becomes a constant over a positive power of $x$` },
            { statement: md`$\dfrac{R(x)}{D(x)} \to \dfrac{0}{b} = 0$, so $f(x) - q(x) \to 0$`, reason: "The quotient of the limits, since the bottom limit isn't 0" },
          ],
        },
        {
          kind: "key",
          title: "Slant asymptotes",
          body: md`When $\deg N = \deg D + 1$, divide: $N = qD + R$. The quotient $q$ is linear, and the line $y = q(x)$ is the **slant asymptote**. The sign of $\frac{R}{D}$ tells which side of the line the curve is on.

The same proof works when the top's degree is bigger by more than 1: the graph then follows the curve $y = q(x)$, which is a polynomial of degree $\deg N - \deg D$.`,
        },
        {
          kind: "example",
          title: "A complete analysis",
          problem: md`Describe the graph of $f(x) = \dfrac{2x^2 - 3x - 5}{x - 3}$.`,
          steps: [
            { math: md`f(x) = \frac{(2x - 5)(x + 1)}{x - 3}`, note: md`Factor. Nothing cancels, so there are no holes. $x$-intercepts at $\frac52$ and $-1$; $y$-intercept $f(0) = \frac{-5}{-3} = \frac53$.` },
            { math: md`x = 3`, note: "The vertical asymptote: the one zero of the denominator." },
            { math: md`2x^2 - 3x - 5 = (x - 3)(2x + 3) + 4`, note: md`Long division: $2x^2 \div x = 2x$, subtract $2x(x - 3) = 2x^2 - 6x$ to leave $3x - 5$; then $3x \div x = 3$, subtract $3(x - 3)$ to leave $4$.` },
            { math: md`f(x) = 2x + 3 + \frac{4}{x - 3}`, note: md`Slant asymptote $y = 2x + 3$. For $x > 3$ the remainder term is positive, so the curve runs above the line; for $x < 3$, below.` },
          ],
        },
        {
          kind: "plot",
          x: [-6, 8],
          y: [-10, 14],
          curves: [
            { expr: "(x^2 + k)/(x - 1)", label: md`y = \frac{x^2 + k}{x - 1}` },
            { expr: "x + 1", label: "y = x + 1", color: 3, dashed: true },
          ],
          vlines: [{ x: 1, label: "x = 1" }],
          params: [{ name: "k", tex: "k", min: -4, max: 4, step: 1, value: 1 }],
          caption: md`$x^2 + k = (x - 1)(x + 1) + (k + 1)$, so the slant asymptote is $y = x + 1$ for every $k$, and the remainder is $k + 1 = {=k+1}$. Slide $k$: the line never moves, only how the curve approaches it. At $k = -1$ the remainder is 0, the factor $x - 1$ cancels, and the graph *is* the line with a hole at $(1, 2)$.`,
        },
        {
          kind: "why",
          title: "Why the two branches at a vertical asymptote can match or oppose",
          body: md`Near a vertical asymptote $x = a$, after cancelling, $f(x) = \frac{h(x)}{(x - a)^m}$ with $h(a) \ne 0$. As in Lesson 1, $h(x)$ barely moves near $a$, so

$$f(x) \approx \frac{h(a)}{(x - a)^m}.$$

If $m$ is odd, $(x - a)^m$ is negative just left of $a$ and positive just right, so the two branches go opposite ways: one up, one down. If $m$ is even, $(x - a)^m$ is positive on both sides and both branches go the same way. Either way the size $\frac{|h(a)|}{|x - a|^m}$ grows without bound as $x \to a$.

So for a sign chart, a vertical asymptote of odd multiplicity is a place where the sign flips, just like a simple zero. One of even multiplicity doesn't flip it.`,
        },
        {
          kind: "plot",
          x: [-3, 5],
          y: [-8, 8],
          curves: [{ expr: "2/(x - 1)^n", label: md`y = \frac{2}{(x - 1)^{n}}` }],
          vlines: [{ x: 1, label: "x = 1" }],
          hlines: [{ y: 0 }],
          params: [{ name: "n", label: "multiplicity n", min: 1, max: 3, step: 1, value: 1 }],
          caption: md`$n = 1$ or $3$: the branches go opposite ways and the sign changes across $x = 1$. $n = 2$: both branches shoot up and the sign doesn't change.`,
        },
        {
          kind: "key",
          title: "Sign charts for rational functions",
          body: md`Write the inequality as a single fraction compared with 0. The **critical numbers** are the zeros of the numerator *and* the zeros of the denominator. The sign can change only at a critical number, so test one point in each interval.

- Zeros of the numerator are included for $\le$ and $\ge$ (the value is 0 there).
- Zeros of the denominator are **never** included: the function has no value there.
- Never multiply both sides by an expression containing $x$ unless you know its sign.`,
        },
        {
          kind: "why",
          title: "Why you can't just multiply by the denominator",
          body: md`Take $\frac{x + 1}{x - 2} \ge 2$. Multiplying by $x - 2$ would give $x + 1 \ge 2x - 4$, that is $x \le 5$. But $x = 0$ satisfies that and fails the original: $\frac{1}{-2} = -\frac12$, not $\ge 2$. The problem: for $x < 2$ the multiplier $x - 2$ is negative, so the inequality should have flipped there. Multiplying splits into two cases, one per sign of the denominator.

Subtracting 2 from both sides instead is always legal, and it leads to a single fraction whose sign chart handles both cases at once.`,
        },
        {
          kind: "example",
          title: "A rational inequality",
          problem: md`Solve $\dfrac{x + 1}{x - 2} \ge 2$.`,
          steps: [
            { math: md`\frac{x + 1}{x - 2} - 2 \ge 0`, note: "Subtract 2 from both sides. Compare with 0." },
            { math: md`\frac{x + 1 - 2(x - 2)}{x - 2} \ge 0`, note: md`Write $2$ as $\frac{2(x - 2)}{x - 2}$ and combine.` },
            { math: md`\frac{5 - x}{x - 2} \ge 0`, note: md`Simplify the numerator: $x + 1 - 2x + 4 = 5 - x$. Critical numbers: $x = 5$ (top) and $x = 2$ (bottom).` },
            {
              math: md`\begin{array}{c|ccc} & x < 2 & 2 < x < 5 & x > 5 \\ \hline 5 - x & + & + & - \\ x - 2 & - & + & + \\ \hline f(x) & - & + & - \end{array}`,
              note: md`Note that $5 - x$ is positive to the *left* of 5: a factor written as $c - x$ has its signs reversed.`,
            },
            { math: md`2 < x \le 5`, note: md`The $+$ interval. Include $5$, where the fraction is 0. Exclude $2$, where it is undefined. In interval notation, $(2, 5]$.` },
          ],
        },
        {
          kind: "numberline",
          range: [-1, 7],
          intervals: [{ from: 2, to: 5, fromOpen: true }],
          points: [{ at: 2, open: true }, { at: 5 }],
          caption: md`The solution of $\frac{x + 1}{x - 2} \ge 2$: open at the asymptote $x = 2$, closed at the zero $x = 5$.`,
        },
        {
          kind: "example",
          title: "Everything at once, with a hole",
          problem: md`Describe the graph of $f(x) = \dfrac{x^2 - 2x - 3}{x^2 - 1}$.`,
          steps: [
            { math: md`f(x) = \frac{(x - 3)(x + 1)}{(x - 1)(x + 1)} = \frac{x - 3}{x - 1}, \quad x \ne -1`, note: md`Factor and cancel. Hole at $x = -1$, height $\frac{-4}{-2} = 2$: the point $(-1, 2)$.` },
            { math: md`x = 1`, note: md`Vertical asymptote: $x - 1$ stays in the denominator.` },
            { math: md`y = 1`, note: md`Equal degrees, leading coefficients $1$ and $1$. Also visible from $\frac{x - 3}{x - 1} = 1 - \frac{2}{x - 1}$.` },
            { math: md`(3, 0) \text{ and } (0, 3)`, note: md`$x$-intercept where the simplified top is 0; $y$-intercept $f(0) = \frac{-3}{-1} = 3$.` },
            { math: md`f > 0 \text{ for } x < 1 \ (x \ne -1), \quad f < 0 \text{ for } 1 < x < 3, \quad f > 0 \text{ for } x > 3`, note: md`Sign chart of $\frac{x - 3}{x - 1}$ with critical numbers $1$ and $3$. The hole doesn't change the sign: the cancelled factor $\frac{x + 1}{x + 1}$ is $1$ on both sides of $-1$.` },
          ],
        },
        {
          kind: "plot",
          x: [-5, 7],
          y: [-6, 8],
          curves: [{ expr: "(x^2 - 2x - 3)/(x^2 - 1)", label: md`y = \frac{x^2 - 2x - 3}{x^2 - 1}` }],
          points: [
            { x: -1, y: 2, open: true, label: md`\text{hole } (-1, 2)`, color: 2 },
            { x: 3, y: 0, label: "(3, 0)", color: 3 },
            { x: 0, y: 3, label: "(0, 3)", color: 3 },
          ],
          vlines: [{ x: 1, label: "x = 1" }],
          hlines: [{ y: 1, label: "y = 1" }],
          caption: md`Everything from the example: the hole, the vertical asymptote, the horizontal asymptote $y = 1$, and the two intercepts. The curve dips below $y = 1$ to the right of the asymptote and sits above it to the left.`,
        },
        {
          kind: "check",
          prompt: md`Find the slant asymptote of $f(x) = \dfrac{x^2 + 3x - 1}{x + 1}$. Give it as an expression in $x$, like 2x - 1.`,
          answer: "x + 2",
          simplified: true,
          explain: md`$x^2 + 3x - 1 = (x + 1)(x + 2) - 3$, so $f(x) = x + 2 - \frac{3}{x + 1}$. The remainder term goes to 0, leaving $y = x + 2$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\dfrac{x - 3}{x + 1} > 0$. Type the answer like x < -2 or x > 4.`,
          answer: "x < -1 or x > 3",
          form: "inequality",
          explain: md`Critical numbers $-1$ (bottom) and $3$ (top). Signs on the three intervals: $+$, $-$, $+$. The fraction is positive for $x < -1$ and for $x > 3$; neither endpoint is included.`,
        },
      ],
      practice: [slantAsymptote, rationalFeatures, rationalInequality],
    },
  ],
};
