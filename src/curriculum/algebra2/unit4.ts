import { leafCount, parse } from "../../math/expr";
import { frac, fracTex, gcd, poly, signed, type Rng } from "../../math/random";
import { NO_SOLUTION } from "../algebra1/unit2";
import { md, type Generator, type Step, type Unit } from "../types";

// ── Shared wording ──────────────────────────────────────────────────────────

const FRAC = "Type fractions with parentheses, like (x + 1)/(x - 2).";
const VALUES = "Separate the values with commas. Fractions are fine, like 3/2.";
const SOLS = md`Give every solution, separated by commas. If there are none, type **no solution**.`;

// ── Polynomials ─────────────────────────────────────────────────────────────

/** Coefficients, constant first: [c0, c1, c2] is c0 + c1 x + c2 x^2. */
type Poly = number[];

const X: Poly = [0, 1];
/** x - r */
const xm = (r: number): Poly => [-r, 1];
/** ax + b */
const lin = (a: number, b: number): Poly => [b, a];

function trim(p: Poly): Poly {
  const out = [...p];
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
}

function mul(...ps: Poly[]): Poly {
  return ps.reduce<Poly>(
    (acc, p) => {
      const out = new Array<number>(acc.length + p.length - 1).fill(0);
      acc.forEach((a, i) => p.forEach((b, j) => (out[i + j]! += a * b)));
      return out;
    },
    [1],
  );
}

function addP(p: Poly, q: Poly): Poly {
  return Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) + (q[i] ?? 0));
}

const scale = (p: Poly, k: number): Poly => p.map((c) => c * k + 0);
const at = (p: Poly, x: number) => p.reduce((s, c, k) => s + c * x ** k, 0);
const degree = (p: Poly) => trim(p).length - 1;
const content = (p: Poly) => p.reduce((g, c) => gcd(g, c), 0);

/** The polynomial written out, highest power first: "2x^2 - x + 3". */
function show(p: Poly): string {
  const terms: [number, string][] = [];
  for (let k = p.length - 1; k >= 0; k--) terms.push([p[k]!, k === 0 ? "" : k === 1 ? "x" : `x^${k}`]);
  return poly(terms);
}

/** p / (x - r) by synthetic division, when x - r is a factor. */
function divLin(p: Poly, r: number): Poly {
  const t = trim(p);
  const n = t.length - 1;
  const q = new Array<number>(n).fill(0);
  q[n - 1] = t[n]!;
  for (let k = n - 1; k >= 1; k--) q[k - 1] = t[k]! + r * q[k]!;
  return q;
}

function intRoots(p: Poly): number[] {
  const out: number[] = [];
  for (let x = -60; x <= 60; x++) if (at(p, x) === 0) out.push(x);
  return out;
}

// ── Products of factors ─────────────────────────────────────────────────────

/** k times a product of factors (each a Poly, usually linear). */
interface Prod {
  k: number;
  fs: Poly[];
}

interface RFrac {
  n: Prod;
  d: Prod;
}

const ONE: Prod = { k: 1, fs: [] };
const isOne = (p: Prod) => p.k === 1 && p.fs.length === 0;
const expand = (p: Prod) => trim(scale(mul(...p.fs), p.k));
const lead = (k: number) => (k === 1 ? "" : k === -1 ? "-" : String(k));
/** A factor ready to sit next to another: "x" or "(x - 3)". */
const fac = (f: Poly) => (show(f) === "x" ? "x" : `(${show(f)})`);
const sortX = (fs: Poly[]) => [...fs].sort((a, b) => Number(show(b) === "x") - Number(show(a) === "x"));

/** k·f1·f2·… as LaTeX, with the factors listed in `cancel` struck through (once each). */
function factTex(k: number, fs: Poly[], cancel: Poly[] = []): string {
  const todo = cancel.map(show);
  const parts = sortX(fs).map((f) => {
    const i = todo.indexOf(show(f));
    if (i < 0) return fac(f);
    todo.splice(i, 1);
    return md`\cancel{${fac(f)}}`;
  });
  if (parts.length === 0) return String(k);
  if (parts.length === 1 && cancel.length === 0) return k === 1 ? show(fs[0]!) : `${lead(k)}${fac(fs[0]!)}`;
  return lead(k) + parts.join("");
}

/** A product with repeated factors written as powers. Valid as LaTeX and as answer text. */
function prodTex(p: Prod): string {
  const groups: { f: Poly; n: number }[] = [];
  for (const f of sortX(p.fs)) {
    const g = groups.find((g) => show(g.f) === show(f));
    if (g) g.n++;
    else groups.push({ f, n: 1 });
  }
  if (groups.length === 0) return String(p.k);
  if (groups.length === 1 && groups[0]!.n === 1) return p.k === 1 ? show(groups[0]!.f) : `${lead(p.k)}${fac(groups[0]!.f)}`;
  return lead(p.k) + groups.map(({ f, n }) => (n === 1 ? fac(f) : `${fac(f)}^${n}`)).join("");
}

/** Equivalent ways a learner might write the same product. */
function prodForms(p: Prod): string[] {
  const e = expand(p);
  const forms = [prodTex(p), show(e)];
  const g = content(e);
  if (g > 1 && e.filter((c) => c !== 0).length > 1) forms.push(`${g}(${show(scale(e, 1 / g))})`);
  if (e.length === 3) {
    const rs = intRoots(e);
    if (rs.length === 2) forms.push(prodTex({ k: e[2]!, fs: rs.map(xm) }));
    if (rs.length === 1 && show(e) === show(scale(mul(xm(rs[0]!), xm(rs[0]!)), e[2]!))) forms.push(prodTex({ k: e[2]!, fs: [xm(rs[0]!), xm(rs[0]!)] }));
  }
  return forms;
}

/**
 * The answer key for n/d. The "simplified" check rejects answers with more symbols
 * than the key, so the key is the longest of the equally simplified ways to write it
 * (factored or multiplied out), and none of them gets rejected.
 */
function ratKey(n: Prod, d: Prod): string {
  const forms: string[] = [];
  for (const a of prodForms(n)) {
    if (isOne(d)) forms.push(a);
    else for (const b of prodForms(d)) forms.push(`(${a})/(${b})`);
  }
  return forms.reduce((best, f) => (leafCount(parse(f)) > leafCount(parse(best)) ? f : best));
}

function ratTex(n: Prod, d: Prod): string {
  if (isOne(d)) return prodTex(n);
  if (n.k < 0) return md`-\frac{${prodTex({ k: -n.k, fs: n.fs })}}{${prodTex(d)}}`;
  return md`\frac{${prodTex(n)}}{${prodTex(d)}}`;
}

/** Cancel the common number and make the denominator's constant positive. */
function reduceK(n: Prod, d: Prod): [Prod, Prod] {
  let g = gcd(n.k, d.k) || 1;
  if (d.k < 0) g = -g;
  return [
    { k: n.k / g, fs: n.fs },
    { k: d.k / g, fs: d.fs },
  ];
}

/** Factors that appear on both top and bottom, matched one for one. */
function cancelAll(nfs: Poly[], dfs: Poly[]): { n: Poly[]; d: Poly[]; common: Poly[] } {
  const d = [...dfs];
  const n: Poly[] = [];
  const common: Poly[] = [];
  for (const f of nfs) {
    const i = d.findIndex((g) => show(g) === show(f));
    if (i >= 0) {
      common.push(f);
      d.splice(i, 1);
    } else n.push(f);
  }
  return { n, d, common };
}

/** The distinct roots of some linear factors, as [answer text, LaTeX]. */
function roots(fs: Poly[]): [string, string][] {
  const out: [string, string][] = [];
  for (const f of fs) {
    const t = frac(-f[0]!, f[1]!);
    if (!out.some(([s]) => s === t)) out.push([t, fracTex(-f[0]!, f[1]!)]);
  }
  return out;
}

const rootList = (fs: Poly[]) => roots(fs).map(([, t]) => t).join(", ");
const rootAnswer = (fs: Poly[]) => roots(fs).map(([s]) => s).join(", ");
const orList = (vs: (number | string)[]) => vs.map((v) => md`x = ${v}`).join(md` \quad\text{or}\quad `);

function distinct(r: Rng, n: number, lo: number, hi: number, avoid: number[] = []): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const v = r.int(lo, hi);
    if (!out.includes(v) && !avoid.includes(v)) out.push(v);
  }
  return out;
}

/** "+ 3(x - 2)" or "- (x - 2)": a signed multiple of a factor, for the middle of a line. */
const times = (k: number, f: string) => `${k < 0 ? "-" : "+"} ${Math.abs(k) === 1 ? "" : Math.abs(k)}${f}`;

// ── Lesson 1: Simplifying rational expressions ──────────────────────────────

const excludedValues: Generator = (r) => {
  const kind = r.int(0, 3);
  let dfs: Poly[];
  if (kind === 0) {
    const [a, b] = distinct(r, 2, -8, 8);
    dfs = [xm(a!), xm(b!)];
  } else if (kind === 1) {
    const a = r.int(1, 9);
    dfs = [xm(a), xm(-a)];
  } else if (kind === 2) {
    dfs = [X, xm(-r.nonzero(-9, 9))];
  } else {
    const p = r.int(2, 3);
    let q = r.nonzero(-7, 7);
    while (gcd(p, q) !== 1) q = r.nonzero(-7, 7);
    dfs = [lin(p, q), xm(r.int(-5, 5))];
  }
  const D = expand({ k: 1, fs: dfs });
  const poles = dfs.map((f) => -f[0]! / f[1]!);
  const shared = r.next() < 0.5 ? dfs[r.int(0, 1)]! : null;
  let N: Poly;
  if (shared) {
    const [m] = distinct(r, 1, -6, 6, poles.filter(Number.isInteger));
    N = mul(shared, xm(m!));
  } else {
    do N = lin(r.int(1, 4), r.int(-9, 9));
    while (poles.some((p) => Math.abs(at(N, p)) < 1e-9));
  }
  const rs = roots(dfs);
  return {
    prompt: md`Find every value of $x$ that is excluded from the domain of $\frac{${show(N)}}{${show(D)}}$. ${VALUES}`,
    answer: rootAnswer(dfs),
    form: "set",
    verify: [`${show(D)} = 0`],
    hint: "Excluded values make the denominator 0. Set the denominator equal to 0 and solve by factoring.",
    solution: [
      { math: md`${show(D)} = 0`, note: "Only the denominator matters: dividing by 0 has no value." },
      { math: md`${factTex(1, dfs)} = 0`, note: "Factor." },
      {
        math: orList(rs.map(([, t]) => t)),
        note: shared
          ? md`Zero product property. The factor $${show(shared)}$ is also on top and would cancel, but the original expression is still undefined there, so it stays excluded.`
          : "Zero product property: each factor gives one excluded value.",
      },
    ],
  };
};

const simplifyRational: Generator = (r) => {
  const kind = r.int(0, 4);
  let common: Poly[] = [];
  let nk = 1;
  let nfs: Poly[] = [];
  let dk = 1;
  let dfs: Poly[] = [];
  let top: string | undefined;
  let bot: string | undefined;
  let factorNote = "Factor the numerator and the denominator completely.";
  if (kind === 0) {
    const [a, b, c] = distinct(r, 3, -7, 7);
    common = [xm(a!)];
    nfs = r.next() < 0.25 ? [] : [xm(b!)];
    dfs = [xm(c!)];
  } else if (kind === 1) {
    nk = r.pick([2, 3, 4, 5, -2, -3]);
    if (r.next() < 0.5) {
      const [a, c] = distinct(r, 2, -6, 6);
      common = [xm(a!)];
      dfs = [xm(c!)];
    } else {
      const a = r.nonzero(-6, 6);
      common = [xm(a)];
      nfs = [X];
      dfs = [xm(-a)];
    }
  } else if (kind === 2) {
    const a = r.nonzero(-6, 6);
    if (r.next() < 0.5) {
      const k = r.int(1, 5);
      common = [xm(a)];
      nk = -k;
      dfs = [xm(-a)];
      top = `${k * a} - ${lead(k)}x`;
      factorNote = md`On top, factor out $-${k}$ so the factor matches the bottom: $${top} = ${factTex(-k, [xm(a)])}$. The bottom is a difference of squares.`;
    } else {
      const [b] = distinct(r, 1, -6, 6, [a, -a]);
      common = [xm(a)];
      nfs = [xm(b!)];
      dk = -1;
      dfs = [xm(-a)];
      bot = `${a * a} - x^2`;
      factorNote = md`Factor the top. On the bottom, $${bot} = -(x^2 - ${a * a}) = ${factTex(-1, [xm(a), xm(-a)])}$: pulling out $-1$ makes a factor match the top.`;
    }
  } else if (kind === 3) {
    const [a, c] = distinct(r, 2, -6, 6);
    const p = r.int(2, 4);
    let q = r.nonzero(-7, 7);
    while (gcd(p, q) !== 1) q = r.nonzero(-7, 7);
    common = [xm(a!)];
    nfs = [lin(p, q)];
    dfs = [xm(c!)];
  } else {
    const [a, b, c] = distinct(r, 3, -5, 5);
    nk = r.pick([2, 3, 4, 6]) * r.sign();
    dk = r.pick([2, 3, 4, 6]);
    while (dk === Math.abs(nk)) dk = r.pick([2, 3, 4, 6]);
    common = [xm(a!)];
    nfs = [xm(b!)];
    dfs = [xm(c!)];
  }
  const allN = [...common, ...nfs];
  const allD = [...common, ...dfs];
  top ??= show(expand({ k: nk, fs: allN }));
  bot ??= show(expand({ k: dk, fs: allD }));
  const [N, D] = reduceK({ k: nk, fs: nfs }, { k: dk, fs: dfs });
  const g = Math.abs(gcd(nk, dk));
  const cf = show(common[0]!);
  return {
    prompt: md`Simplify $\frac{${top}}{${bot}}$. ${FRAC}`,
    answer: ratKey(N, D),
    simplified: true,
    hint: "Factor the top and the bottom completely, then cancel the factors (not terms) they share.",
    solution: [
      { math: md`\frac{${factTex(nk, allN)}}{${factTex(dk, allD)}}`, note: factorNote },
      {
        math: md`\frac{${factTex(nk, allN, common)}}{${factTex(dk, allD, common)}}`,
        note: md`Cancel the common factor $${cf}$${g > 1 ? ` and the common number ${g}` : ""}. That's allowed wherever $${cf} \ne 0$.`,
      },
      { math: md`${ratTex(N, D)}, \quad x \ne ${rootList(allD)}`, note: "The excluded values come from the original denominator, including the one whose factor cancelled." },
    ],
  };
};

// ── Lesson 2: Multiplying and dividing ──────────────────────────────────────

const fracShow = (f: RFrac) => md`\frac{${show(expand(f.n))}}{${show(expand(f.d))}}`;
const fracFact = (f: RFrac) => md`\frac{${factTex(f.n.k, f.n.fs)}}{${factTex(f.d.k, f.d.fs)}}`;

/** Multiply fractions given in factored form: the factor-and-cancel steps and the result. */
function combine(fs: RFrac[]): { N: Prod; D: Prod; steps: Step[] } {
  const nAll = fs.flatMap((f) => f.n.fs);
  const dAll = fs.flatMap((f) => f.d.fs);
  const nk = fs.reduce((p, f) => p * f.n.k, 1);
  const dk = fs.reduce((p, f) => p * f.d.k, 1);
  const { n, d, common } = cancelAll(nAll, dAll);
  const [N, D] = reduceK({ k: nk, fs: n }, { k: dk, fs: d });
  const g = Math.abs(gcd(nk, dk));
  return {
    N,
    D,
    steps: [
      { math: fs.map(fracFact).join(md` \cdot `), note: "Factor every numerator and every denominator." },
      {
        math: md`\frac{${factTex(nk, nAll, common)}}{${factTex(dk, dAll, common)}}`,
        note: `Multiply across into one fraction, then cancel each factor that appears on both top and bottom${g > 1 ? `, and the common number ${g}` : ""}.`,
      },
    ],
  };
}

const multiplyRational: Generator = (r) => {
  const kind = r.int(0, 2);
  let f1: RFrac;
  let f2: RFrac;
  if (kind === 0) {
    const [a, b, c, d] = distinct(r, 4, -6, 6);
    f1 = { n: { k: 1, fs: [xm(a!), xm(b!)] }, d: { k: 1, fs: [xm(c!), xm(d!)] } };
    f2 = { n: { k: 1, fs: [xm(c!)] }, d: { k: 1, fs: [xm(a!)] } };
  } else if (kind === 1) {
    const c = r.int(1, 6);
    const [a] = distinct(r, 1, -6, 6, [c, -c]);
    const k = r.pick([2, 3, 4, 6, -2, -3]);
    let m = r.pick([2, 3, 4, 6]);
    while (m === Math.abs(k)) m = r.pick([2, 3, 4, 6]);
    f1 = { n: { k, fs: [xm(a!)] }, d: { k: 1, fs: [xm(c), xm(-c)] } };
    f2 = { n: { k: 1, fs: [xm(c)] }, d: { k: m, fs: [xm(a!)] } };
  } else {
    const b = r.int(1, 6);
    const [a] = distinct(r, 1, -6, 6, [0, b, -b]);
    const [c] = distinct(r, 1, -6, 6, [0, a!, b, -b]);
    f1 = { n: { k: 1, fs: [X, xm(a!)] }, d: { k: 1, fs: [xm(b), xm(-b)] } };
    f2 = { n: { k: 1, fs: [xm(b)] }, d: { k: 1, fs: [xm(a!), xm(c!)] } };
  }
  const { N, D, steps } = combine([f1, f2]);
  return {
    prompt: md`Simplify $${fracShow(f1)} \cdot ${fracShow(f2)}$. ${FRAC}`,
    answer: ratKey(N, D),
    simplified: true,
    hint: "Factor everything first. Then any factor on a top can cancel a matching factor on a bottom.",
    solution: [...steps, { math: md`${ratTex(N, D)}, \quad x \ne ${rootList([...f1.d.fs, ...f2.d.fs])}`, note: "The excluded values come from both original denominators." }],
  };
};

const divideRational: Generator = (r) => {
  const kind = r.int(0, 2);
  let f1: RFrac;
  let f2: RFrac;
  if (kind === 0) {
    const [a, b, c, d] = distinct(r, 4, -6, 6);
    f1 = { n: { k: 1, fs: [xm(a!), xm(b!)] }, d: { k: 1, fs: [xm(c!), xm(d!)] } };
    f2 = { n: { k: 1, fs: [xm(a!)] }, d: { k: 1, fs: [xm(c!)] } };
  } else if (kind === 1) {
    const b = r.int(1, 6);
    const [a] = distinct(r, 1, -6, 6, [0, b, -b]);
    const m = r.pick([2, 3]);
    const t = r.pick([2, 3, -2]);
    f1 = { n: { k: m * t, fs: [xm(-a!)] }, d: { k: 1, fs: [xm(b)] } };
    f2 = { n: { k: m, fs: [xm(-a!)] }, d: { k: 1, fs: [xm(b), xm(-b)] } };
  } else {
    const q = r.int(1, 6);
    const [p] = distinct(r, 1, -6, 6, [0, q, -q]);
    f1 = { n: { k: 1, fs: [X, xm(-p!)] }, d: { k: 1, fs: [xm(q), xm(-q)] } };
    f2 = { n: { k: 1, fs: [X] }, d: { k: 1, fs: [xm(q)] } };
  }
  const flipped: RFrac = { n: f2.d, d: f2.n };
  const { N, D, steps } = combine([f1, flipped]);
  return {
    prompt: md`Simplify $${fracShow(f1)} \div ${fracShow(f2)}$. ${FRAC}`,
    answer: ratKey(N, D),
    simplified: true,
    hint: "Flip the second fraction and multiply. Then factor and cancel.",
    solution: [
      { math: md`${fracShow(f1)} \cdot ${fracShow(flipped)}`, note: "Dividing is multiplying by the reciprocal." },
      ...steps,
      {
        math: md`${ratTex(N, D)}, \quad x \ne ${rootList([...f1.d.fs, ...f2.d.fs, ...f2.n.fs])}`,
        note: "Excluded: zeros of both original denominators, and of the second numerator, which became a denominator when it flipped.",
      },
    ],
  };
};

const excludedProductQuotient: Generator = (r) => {
  const [a, b, c, d] = distinct(r, 4, -7, 7);
  const divide = r.next() < 0.6;
  const f1 = md`\frac{${show(xm(a!))}}{${show(xm(b!))}}`;
  const f2 = md`\frac{${show(xm(c!))}}{${show(xm(d!))}}`;
  const fs = divide ? [xm(b!), xm(d!), xm(c!)] : [xm(b!), xm(d!)];
  return {
    prompt: md`Find every value of $x$ excluded from $${f1} ${divide ? md`\div` : md`\cdot`} ${f2}$. ${VALUES}`,
    answer: rootAnswer(fs),
    form: "set",
    verify: [`${show(expand({ k: 1, fs }))} = 0`],
    hint: divide ? "Both denominators must be nonzero. After flipping, the second numerator is a denominator too." : "Both denominators must be nonzero.",
    solution: divide
      ? [
          { math: md`${f1} \cdot \frac{${show(xm(d!))}}{${show(xm(c!))}}`, note: "Rewrite as multiplying by the reciprocal." },
          { math: md`x \ne ${rootList(fs)}`, note: md`$${show(xm(b!))}$ and $${show(xm(d!))}$ are original denominators, and $${show(xm(c!))}$ is now a denominator. The top $${show(xm(a!))}$ can be 0 without trouble.` },
        ]
      : [{ math: md`x \ne ${rootList(fs)}`, note: md`Only the denominators $${show(xm(b!))}$ and $${show(xm(d!))}$ can't be 0. Numerators can be 0 without trouble.` }],
  };
};

// ── Lesson 3: Adding and subtracting ────────────────────────────────────────

const leastCommonDenominator: Generator = (r) => {
  const kind = r.int(0, 3);
  let d1: Poly[];
  let d2: Poly[];
  let lcd: Poly[];
  if (kind === 0) {
    if (r.next() < 0.5) {
      const [a, b] = distinct(r, 2, -7, 7);
      [d1, d2, lcd] = [[xm(a!)], [xm(b!)], [xm(a!), xm(b!)]];
    } else {
      const k = r.nonzero(-7, 7);
      [d1, d2, lcd] = [[X], [X, xm(-k)], [X, xm(-k)]];
    }
  } else if (kind === 1) {
    const [a, b, c] = distinct(r, 3, -6, 6);
    [d1, d2, lcd] = [[xm(a!), xm(b!)], [xm(b!), xm(c!)], [xm(a!), xm(b!), xm(c!)]];
  } else if (kind === 2) {
    const a = r.int(1, 6);
    const [c] = distinct(r, 1, -6, 6, [a, -a]);
    [d1, d2, lcd] = [[xm(a), xm(-a)], [xm(-a), xm(c!)], [xm(a), xm(-a), xm(c!)]];
  } else {
    const [a, b] = distinct(r, 2, -6, 6);
    [d1, d2, lcd] = [[xm(a!), xm(a!)], [xm(a!), xm(b!)], [xm(a!), xm(a!), xm(b!)]];
  }
  const [n1, n2] = [r.pick(["1", "2", "3", "x", "5"]), r.pick(["1", "4", "x", "7"])];
  const [D1, D2] = [show(mul(...d1)), show(mul(...d2))];
  const factored = [[D1, d1], [D2, d2]].filter(([D, fs]) => D !== prodTex({ k: 1, fs: fs as Poly[] }));
  const factorStep: Step = factored.length
    ? { math: factored.map(([D, fs]) => md`${D} = ${prodTex({ k: 1, fs: fs as Poly[] })}`).join(md`, \qquad `), note: "Factor each denominator." }
    : { math: md`${D1}, \quad ${D2}`, note: "Both denominators are already as factored as they get, and they share no factor." };
  return {
    prompt: md`Find the least common denominator of $\frac{${n1}}{${D1}}$ and $\frac{${n2}}{${D2}}$. Give it in factored form, like (x - 1)(x + 2).`,
    answer: prodTex({ k: 1, fs: lcd }),
    factored: true,
    hint: "Factor each denominator. The LCD uses every factor that appears, each as many times as it appears in whichever denominator has the most of it.",
    solution: [
      factorStep,
      { math: md`\text{LCD} = ${prodTex({ k: 1, fs: lcd })}`, note: "Take every factor, each to the highest power it has in either denominator. Shared factors are counted once, not twice." },
    ],
  };
};

const addSubtract: Generator = (r) => {
  const kind = r.int(0, 3);
  let expr: string;
  let num: Poly;
  let dfs: Poly[];
  let steps: Step[];
  if (kind === 0) {
    const a = r.int(-6, 6);
    const p = r.int(2, 6);
    const q = r.nonzero(-8, 8);
    let s: number;
    let t: number;
    if (r.next() < 0.5) {
      // The difference of the numerators is a multiple of x - a, so it cancels.
      let k: number;
      do {
        k = r.nonzero(-4, 4);
        s = p - k;
        t = q + k * a;
      } while (s === 0 && t === 0);
    } else {
      do {
        s = r.int(1, 5);
        t = r.nonzero(-8, 8);
      } while (p === s || (p - s) * a + (q - t) === 0);
    }
    num = [q - t, p - s];
    dfs = [xm(a)];
    const den = show(xm(a));
    expr = md`\frac{${show(lin(p, q))}}{${den}} - \frac{${show(lin(s, t))}}{${den}}`;
    steps = [
      { math: md`\frac{(${show(lin(p, q))}) - (${show(lin(s, t))})}{${den}}`, note: "Same denominator: subtract the numerators. The parentheses matter, because the minus applies to the whole second numerator." },
      { math: md`\frac{${show(num)}}{${den}}`, note: "Distribute the minus and combine like terms." },
    ];
  } else if (kind === 1) {
    const [a, b] = distinct(r, 2, -6, 6);
    const A = r.int(1, 6);
    const B = r.int(1, 6);
    const sg = r.sign();
    num = addP(scale(xm(b!), A), scale(xm(a!), sg * B));
    dfs = [xm(a!), xm(b!)];
    const op = sg > 0 ? "+" : "-";
    expr = md`\frac{${A}}{${show(xm(a!))}} ${op} \frac{${B}}{${show(xm(b!))}}`;
    steps = [
      { math: md`\text{LCD} = ${factTex(1, dfs)}`, note: "The denominators share no factor, so the LCD is their product." },
      { math: md`\frac{${lead(A)}${fac(xm(b!))} ${op} ${lead(B)}${fac(xm(a!))}}{${factTex(1, dfs)}}`, note: "Multiply each numerator by the factor its denominator is missing, then combine over the LCD." },
      { math: md`\frac{${show(num)}}{${factTex(1, dfs)}}`, note: "Distribute and combine like terms." },
    ];
  } else if (kind === 2) {
    const a = r.nonzero(-6, 6);
    const [b] = distinct(r, 1, -6, 6, [a, 0]);
    const B = r.int(1, 6);
    const sg = r.sign();
    num = addP(mul(X, xm(b!)), scale(xm(a), sg * B));
    dfs = [xm(a), xm(b!)];
    const op = sg > 0 ? "+" : "-";
    expr = md`\frac{x}{${show(xm(a))}} ${op} \frac{${B}}{${show(xm(b!))}}`;
    steps = [
      { math: md`\text{LCD} = ${factTex(1, dfs)}`, note: "The denominators share no factor, so the LCD is their product." },
      { math: md`\frac{x${fac(xm(b!))} ${op} ${lead(B)}${fac(xm(a))}}{${factTex(1, dfs)}}`, note: "Give each numerator the factor its denominator is missing." },
      { math: md`\frac{${show(num)}}{${factTex(1, dfs)}}`, note: "Multiply out and combine like terms." },
    ];
  } else {
    const a = r.int(1, 6);
    const B = r.int(1, 5);
    const sg = r.sign();
    let A = -2 * sg * B * a;
    if (r.next() < 0.65) while (A === -2 * sg * B * a) A = r.nonzero(-9, 9);
    num = addP([A], scale(xm(-a), sg * B));
    dfs = [xm(a), xm(-a)];
    const op = sg > 0 ? "+" : "-";
    expr = md`\frac{${A}}{x^2 - ${a * a}} ${op} \frac{${B}}{${show(xm(a))}}`;
    steps = [
      { math: md`\frac{${A}}{${factTex(1, dfs)}} ${op} \frac{${B}}{${show(xm(a))}}`, note: md`Factor $x^2 - ${a * a}$. It already contains $${show(xm(a))}$, so the LCD is $${factTex(1, dfs)}$.` },
      { math: md`\frac{${A} ${op} ${lead(B)}${fac(xm(-a))}}{${factTex(1, dfs)}}`, note: md`Only the second fraction needs a factor: $${show(xm(-a))}$.` },
      { math: md`\frac{${show(trim(num))}}{${factTex(1, dfs)}}`, note: "Distribute and combine like terms." },
    ];
  }
  // Cancel any factor the new numerator shares with the denominator.
  let n = trim(num);
  const left = [...dfs];
  for (const f of dfs) {
    const root = -f[0]!;
    if (degree(n) >= 1 && at(n, root) === 0) {
      const q = divLin(n, root);
      steps.push({
        math: md`\frac{${degree(q) === 0 ? lead(q[0]!) : fac(q)}\cancel{${fac(f)}}}{${factTex(1, left, [f])}}`,
        note: "Always check the numerator: here it factors, and it shares a factor with the denominator. Cancel it.",
      });
      n = q;
      left.splice(left.indexOf(f), 1);
    }
  }
  const N: Prod = degree(n) === 0 ? { k: n[0]!, fs: [] } : { k: 1, fs: [n] };
  const D: Prod = { k: 1, fs: left };
  const cancelled = left.length < dfs.length;
  if (kind === 0 || cancelled) {
    steps.push({
      math: md`${ratTex(N, D)}, \quad x \ne ${rootList(dfs)}`,
      note: cancelled ? "What's left, valid wherever the original was defined." : "No factor of the numerator matches the denominator, so this is the simplest form.",
    });
    return {
      prompt: md`Simplify $${expr}$. ${FRAC}`,
      answer: ratKey(N, D),
      simplified: true,
      hint: "Rewrite the fractions over a common denominator and combine the numerators. Then check whether the result simplifies.",
      solution: steps,
    };
  }
  // Here the sum never simplifies, so ask for the numerator over the LCD: a single answer,
  // and one that can't be satisfied by retyping the question.
  steps.push({ math: md`N = ${show(n)}`, note: "No factor of the numerator matches the denominator, so this fraction is already in simplest form." });
  return {
    prompt: md`Write $${expr}$ as one fraction, $\frac{N}{${factTex(1, dfs)}}$. What is the numerator $N$? Multiply it out, like 3x - 7.`,
    answer: show(n),
    expanded: true,
    simplified: true,
    hint: "Multiply each numerator by the factor its denominator is missing from the LCD, then add (or subtract) the numerators and multiply out.",
    solution: steps,
  };
};

const complexFraction: Generator = (r) => {
  const kind = r.int(0, 3);
  const s = r.sign();
  const op = s > 0 ? "+" : "-";
  if (kind === 0) {
    const a = r.int(2, 6);
    const N: Prod = { k: 1, fs: [X] };
    const D: Prod = { k: 1, fs: [xm(s * a)] };
    return {
      prompt: md`Simplify $\frac{1 ${op} \frac{${a}}{x}}{1 - \frac{${a * a}}{x^2}}$. ${FRAC}`,
      answer: ratKey(N, D),
      simplified: true,
      hint: md`Multiply the top and the bottom by $x^2$, the LCD of the small fractions.`,
      solution: [
        { math: md`\frac{x^2 \cdot 1 ${op} x^2 \cdot \frac{${a}}{x}}{x^2 \cdot 1 - x^2 \cdot \frac{${a * a}}{x^2}}`, note: md`Multiply top and bottom by $x^2$. That's multiplying by $\frac{x^2}{x^2} = 1$.` },
        { math: md`\frac{x^2 ${op} ${a}x}{x^2 - ${a * a}}`, note: "Every small denominator cancels." },
        { math: md`\frac{${factTex(1, [X, xm(-s * a)], [xm(-s * a)])}}{${factTex(1, [xm(a), xm(-a)], [xm(-s * a)])}}`, note: "Factor and cancel." },
        { math: md`${ratTex(N, D)}, \quad x \ne 0, ${a}, -${a}`, note: md`$x = 0$ is excluded by the small fractions, $\pm ${a}$ by the main denominator.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(2, 9);
    const N: Prod = { k: s, fs: [] };
    const D: Prod = { k: a, fs: [X] };
    return {
      prompt: md`Simplify $\frac{\frac{1}{x} ${op} \frac{1}{${a}}}{x ${op} ${a}}$. ${FRAC}`,
      answer: ratKey(N, D),
      simplified: true,
      hint: md`Multiply the top and the bottom by $${a}x$. ${s < 0 ? md`Then look for opposite factors, like $${a} - x = -(x - ${a})$.` : ""}`,
      solution: [
        { math: md`\frac{${a}x \cdot \frac{1}{x} ${op} ${a}x \cdot \frac{1}{${a}}}{${a}x(x ${op} ${a})}`, note: md`Multiply top and bottom by $${a}x$, the LCD of the small fractions.` },
        { math: md`\frac{${a} ${op} x}{${a}x(x ${op} ${a})}`, note: "The small denominators cancel." },
        s > 0
          ? { math: md`\frac{\cancel{(x + ${a})}}{${a}x\cancel{(x + ${a})}}`, note: md`$${a} + x$ is $x + ${a}$, so it cancels.` }
          : { math: md`\frac{-\cancel{(x - ${a})}}{${a}x\cancel{(x - ${a})}}`, note: md`$${a} - x = -(x - ${a})$, so it cancels and leaves $-1$.` },
        { math: md`${ratTex(N, D)}, \quad x \ne 0, ${s > 0 ? -a : a}`, note: md`$x = 0$ is excluded by $\frac{1}{x}$, and $x = ${s > 0 ? -a : a}$ makes the main denominator $x ${op} ${a}$ equal to 0.` },
      ],
    };
  }
  if (kind === 2) {
    const p = r.int(-5, 5);
    const a = r.nonzero(-6, 6);
    let b = r.nonzero(-6, 6);
    while (b === -a) b = r.nonzero(-6, 6);
    const inner = show(xm(p));
    const N: Prod = { k: 1, fs: [xm(p - a)] };
    const D: Prod = { k: 1, fs: [xm(p + b)] };
    return {
      prompt: md`Simplify $\frac{1 ${a > 0 ? "+" : "-"} \frac{${Math.abs(a)}}{${inner}}}{1 ${b > 0 ? "-" : "+"} \frac{${Math.abs(b)}}{${inner}}}$. ${FRAC}`,
      answer: ratKey(N, D),
      simplified: true,
      hint: md`There's only one small denominator, $${inner}$. Multiply the top and the bottom by it.`,
      solution: [
        {
          math: md`\frac{${fac(xm(p))} \cdot 1 ${a > 0 ? "+" : "-"} ${fac(xm(p))} \cdot \frac{${Math.abs(a)}}{${inner}}}{${fac(xm(p))} \cdot 1 ${b > 0 ? "-" : "+"} ${fac(xm(p))} \cdot \frac{${Math.abs(b)}}{${inner}}}`,
          note: md`Multiply top and bottom by $${inner}$, the only small denominator.`,
        },
        ...(p !== 0 ? [{ math: md`\frac{${inner} ${signed(a)}}{${inner} ${signed(-b)}}`, note: "The small fractions lose their denominators." }] : []),
        { math: md`\frac{${show(xm(p - a))}}{${show(xm(p + b))}}`, note: "Combine. Top and bottom are different linear factors, so nothing cancels." },
        { math: md`${ratTex(N, D)}, \quad x \ne ${p}, ${p + b}`, note: md`$x = ${p}$ is excluded by the small fractions. $x = ${p + b}$ makes the main denominator $1 ${b > 0 ? "-" : "+"} \frac{${Math.abs(b)}}{${inner}}$ equal to 0.` },
      ],
    };
  }
  const a = r.int(2, 6);
  const N: Prod = { k: 1, fs: [xm(s * a)] };
  return {
    prompt: md`Simplify $\frac{x - \frac{${a * a}}{x}}{1 ${op} \frac{${a}}{x}}$. ${FRAC}`,
    answer: ratKey(N, ONE),
    simplified: true,
    hint: md`Multiply the top and the bottom by $x$, then factor.`,
    solution: [
      { math: md`\frac{x^2 - ${a * a}}{x ${op} ${a}}`, note: md`Multiply top and bottom by $x$.` },
      { math: md`\frac{${factTex(1, [xm(a), xm(-a)], [xm(-s * a)])}}{\cancel{(x ${op} ${a})}}`, note: "Difference of squares, then cancel." },
      { math: md`${show(xm(s * a))}, \quad x \ne 0, ${-s * a}`, note: "The result is a polynomial, with the original's excluded values." },
    ],
  };
};

// ── Lesson 4: Rational equations ────────────────────────────────────────────

const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

/** 1/x + 1/a = 1/b with a whole-number solution x = ab/(a - b). */
const UNIT_PAIRS: [number, number][] = [];
for (let a = 3; a <= 12; a++) for (let b = 2; b < a; b++) if ((a * b) % (a - b) === 0 && (a * b) / (a - b) <= 40) UNIT_PAIRS.push([a, b]);

const linearRational: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const x0 = r.nonzero(-8, 8);
    const B = r.nonzero(-5, 5);
    let A: number;
    do A = r.nonzero(-9, 9);
    while (A + B * x0 === 0);
    const C = A + B * x0;
    return {
      prompt: md`Solve $\frac{${A}}{x} ${signed(B)} = \frac{${C}}{x}$. ${SOLS}`,
      answer: String(x0),
      form: "set",
      hint: md`Multiply every term by $x$. Remember that $x = 0$ is excluded.`,
      solution: [
        { math: md`${poly([[A, ""], [B, "x"]])} = ${C}`, note: md`Multiply every term by $x$ (excluded: $x = 0$).` },
        { math: md`${poly([[B, "x"]])} = ${C - A}`, note: md`${A > 0 ? "Subtract" : "Add"} ${Math.abs(A)}.` },
        { math: md`x = ${x0}`, note: md`${B === 1 ? "" : `Divide by ${B}. `}It isn't 0, so it's allowed.` },
      ],
    };
  }
  if (kind === 1) {
    const x0 = r.int(-6, 6);
    const [u, v] = distinct(r, 2, -6, 6, [0]);
    const g = gcd(u!, v!);
    const [a, b] = [u! / g, v! / g];
    const [p, q] = [u! - x0, v! - x0];
    const [dp, dq] = [show(lin(1, p)), show(lin(1, q))];
    return {
      prompt: md`Solve $\frac{${a}}{${dp}} = \frac{${b}}{${dq}}$. ${SOLS}`,
      answer: String(x0),
      form: "set",
      hint: md`Multiply both sides by both denominators (cross-multiply), then solve the linear equation.`,
      solution: [
        { math: md`${factTex(a, [lin(1, q)])} = ${factTex(b, [lin(1, p)])}`, note: md`Multiply both sides by $${factTex(1, [lin(1, p), lin(1, q)])}$. Excluded: $x = ${-p}$ and $x = ${-q}$.` },
        { math: md`${show(lin(a, a * q))} = ${show(lin(b, b * p))}`, note: "Distribute." },
        { math: md`${show(lin(a - b, 0))} = ${b * p - a * q}`, note: "Collect the x-terms on the left and the numbers on the right." },
        { math: md`x = ${x0}`, note: md`It isn't an excluded value, so it's a real solution.` },
      ],
    };
  }
  if (kind === 2) {
    const [a, b] = r.pick(UNIT_PAIRS);
    const x0 = (a * b) / (a - b);
    const L = lcm(a, b);
    return {
      prompt: md`Solve $\frac{1}{x} + \frac{1}{${a}} = \frac{1}{${b}}$. ${SOLS}`,
      answer: String(x0),
      form: "set",
      hint: md`Multiply every term by $${L}x$, the LCD.`,
      solution: [
        { math: md`${L} + ${L / a === 1 ? "" : L / a}x = ${L / b}x`, note: md`Multiply every term by $${L}x$.` },
        { math: md`${L} = ${L / b - L / a === 1 ? "" : L / b - L / a}x`, note: md`Subtract $${L / a === 1 ? "" : L / a}x$.` },
        { math: md`x = ${x0}`, note: md`Check: $\frac{1}{${x0}} + \frac{1}{${a}} = \frac{1}{${b}}$ ✓.` },
      ],
    };
  }
  const k = r.pick([2, 3, 4, -1, -2, -3]);
  const [x0, q] = distinct(r, 2, -6, 6);
  const p = k * (x0! - q!) - x0!;
  return {
    prompt: md`Solve $\frac{${show(lin(1, p))}}{${show(xm(q!))}} = ${k}$. ${SOLS}`,
    answer: String(x0),
    form: "set",
    hint: md`Multiply both sides by $${show(xm(q!))}$.`,
    solution: [
      { math: md`${show(lin(1, p))} = ${lead(k)}${fac(xm(q!))}`, note: md`Multiply both sides by $${show(xm(q!))}$. Excluded: $x = ${q}$.` },
      { math: md`${show(lin(1, p))} = ${show(lin(k, -k * q!))}`, note: "Distribute." },
      { math: md`${show(lin(1 - k, 0))} = ${-k * q! - p}`, note: "Collect terms." },
      { math: md`x = ${x0}`, note: md`Not excluded, so it's a solution.` },
    ],
  };
};

const quadraticRational: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.nonzero(-5, 5);
    let k: number;
    do k = r.int(-6, 6);
    while (k === -a || k === -2 * a);
    const rhs = a * a + k * a;
    const other = -a - k;
    const den = show(xm(a));
    return {
      prompt: md`Solve $\frac{${show([0, k, 1])}}{${den}} = \frac{${rhs}}{${den}}$. ${SOLS}`,
      answer: String(other),
      form: "set",
      hint: md`Multiply both sides by $${den}$, solve the quadratic, then check each candidate against the excluded value $x = ${a}$.`,
      solution: [
        { math: md`${show([0, k, 1])} = ${rhs}`, note: md`Multiply both sides by $${den}$. Excluded: $x = ${a}$.` },
        { math: md`${show([-rhs, k, 1])} = 0`, note: "Move everything to one side." },
        { math: md`${fac(xm(a))}${fac(xm(other))} = 0`, note: "Factor." },
        { math: orList([a, other]), note: "Zero product property gives two candidates." },
        { math: md`x = ${other}`, note: md`Reject $x = ${a}$: it makes the original denominators 0. It's extraneous.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.nonzero(-6, 6);
    const [b] = distinct(r, 1, -6, 6, [-a]);
    const k = r.pick([2, 3, 4, -1, -2, -3]);
    const den = show(xm(a));
    return {
      prompt: md`Solve $\frac{${show(lin(1, b!))}}{${den}} = \frac{${a + b!}}{${den}} ${signed(k)}$. ${SOLS}`,
      accept: NO_SOLUTION,
      form: "set",
      hint: md`Multiply every term by $${den}$ and solve. Then compare the candidate with the excluded value.`,
      solution: [
        { math: md`${show(lin(1, b!))} = ${a + b!} ${times(k, fac(xm(a)))}`, note: md`Multiply every term by $${den}$. Excluded: $x = ${a}$.` },
        { math: md`${show(lin(1, b!))} = ${show(lin(k, a + b! - k * a))}`, note: "Distribute and combine." },
        { math: md`${show(lin(1 - k, 0))} = ${(1 - k) * a}`, note: "Collect terms." },
        { math: md`x = ${a}`, note: "The only candidate." },
        { math: md`\text{no solution}`, note: md`$x = ${a}$ makes the denominators 0, so it's extraneous. Nothing is left.` },
      ],
    };
  }
  // x/(x - a) + B/(x + b) = C/((x - a)(x + b)) clears to x^2 + (b + B)x - (Ba + C) = 0.
  const type = r.pick([0, 0, 1, 2]);
  let a: number, b: number, r1: number, r2: number, B: number, C: number;
  for (;;) {
    a = r.nonzero(-5, 5);
    b = r.int(-5, 5);
    if (a === -b) continue;
    if (type === 2) [r1, r2] = [a, -b];
    else if (type === 0) [r1, r2] = [a, r.int(-6, 6)];
    else [r1, r2] = distinct(r, 2, -6, 6) as [number, number];
    B = -(r1 + r2) - b;
    C = -r1 * r2 - B * a;
    const valid = (v: number) => v !== a && v !== -b;
    if (r1 === r2 || B === 0 || C === 0) continue;
    if (type === 0 && !valid(r2)) continue;
    if (type === 1 && !(valid(r1) && valid(r2))) continue;
    break;
  }
  const quad = [-(B * a + C), b + B, 1];
  const prodDen = show(mul(xm(a), xm(-b)));
  const cTex = C < 0 ? md`-\frac{${-C}}{${prodDen}}` : md`\frac{${C}}{${prodDen}}`;
  const keep = [r1, r2].filter((v) => v !== a && v !== -b);
  const rejected = [r1, r2].filter((v) => v === a || v === -b);
  return {
    prompt: md`Solve $\frac{x}{${show(xm(a))}} ${B > 0 ? "+" : "-"} \frac{${Math.abs(B)}}{${show(xm(-b))}} = ${cTex}$. ${SOLS}`,
    ...(keep.length ? { answer: keep.join(", ") } : { accept: NO_SOLUTION }),
    form: "set",
    hint: md`Factor the last denominator: it's $${factTex(1, [xm(a), xm(-b)])}$, the LCD. Multiply every term by it, solve, and check each candidate.`,
    solution: [
      { math: md`x \ne ${a}, \quad x \ne ${-b}`, note: md`The right side's denominator is $${factTex(1, [xm(a), xm(-b)])}$, the LCD. These are the excluded values.` },
      { math: md`${prodTex({ k: 1, fs: [X, xm(-b)] })} ${times(B, fac(xm(a)))} = ${C}`, note: "Multiply every term by the LCD. Each fraction loses its denominator." },
      { math: md`${show(quad)} = 0`, note: "Multiply out and move everything to one side." },
      { math: md`${fac(xm(r1))}${fac(xm(r2))} = 0`, note: "Factor." },
      { math: orList([r1, r2]), note: "Two candidates." },
      {
        math: keep.length ? orList(keep) : md`\text{no solution}`,
        note: rejected.length ? md`Reject ${rejected.map((v) => `$${v}$`).join(" and ")}: excluded, so extraneous.${keep.length ? "" : " Nothing is left."}` : "Neither is excluded, so both are solutions.",
      },
    ],
  };
};

/** Pairs of times a < b (hours) whose combined time ab/(a + b) is whole. */
const WORK_PAIRS: [number, number][] = [];
for (let a = 2; a <= 30; a++) for (let b = a + 1; b <= 30; b++) if ((a * b) % (a + b) === 0) WORK_PAIRS.push([a, b]);

const WORK_JOBS = [
  { one: "Pipe A", two: "pipe B", job: "fill a tank", both: "pipes A and B" },
  { one: "Ana", two: "Ben", job: "paint a fence", both: "Ana and Ben" },
  { one: "The old printer", two: "the new printer", job: "print a batch of flyers", both: "both printers" },
  { one: "Kai", two: "Lena", job: "mow the field", both: "Kai and Lena" },
];

const workRate: Generator = (r) => {
  const [a, b] = r.pick(WORK_PAIRS);
  const t = (a * b) / (a + b);
  const w = r.pick(WORK_JOBS);
  const [p, q] = r.next() < 0.5 ? [a, b] : [b, a];
  const L = lcm(a, b);
  if (r.next() < 0.55) {
    return {
      prompt: md`${w.one} can ${w.job} in ${p} hours. ${w.two[0]!.toUpperCase() + w.two.slice(1)} can do it in ${q} hours. How many hours does it take ${w.both} working together? Type a number.`,
      answer: String(t),
      verify: [`1/${p} + 1/${q} = 1/t`],
      hint: md`Add rates, not times. In one hour the first does $\frac{1}{${p}}$ of the job and the second $\frac{1}{${q}}$. Together they do $\frac{1}{t}$.`,
      solution: [
        { math: md`\frac{1}{${p}} + \frac{1}{${q}} = \frac{1}{t}`, note: "Rates (jobs per hour) add." },
        { math: md`${poly([[L / p, "t"], [L / q, "t"]])} = ${L}`, note: md`Multiply every term by $${L}t$.` },
        { math: md`${poly([[L / p + L / q, "t"]])} = ${L}`, note: "Combine." },
        { math: md`t = ${t}`, note: md`Together they finish in ${t} hours, faster than either alone, as it should be.` },
      ],
    };
  }
  const L2 = lcm(p, t);
  return {
    prompt: md`Working together, ${w.both} ${w.job} in ${t} hours. ${w.one} alone takes ${p} hours. How many hours would ${w.two} take alone? Type a number.`,
    answer: String(q),
    verify: [`1/${p} + 1/q = 1/${t}`],
    hint: md`Rates add: $\frac{1}{${p}} + \frac{1}{q} = \frac{1}{${t}}$, where $q$ is the unknown time.`,
    solution: [
      { math: md`\frac{1}{${p}} + \frac{1}{q} = \frac{1}{${t}}`, note: "Each rate is one job per that many hours. The rates add up to the combined rate." },
      { math: md`${poly([[L2 / p, "q"], [L2, ""]])} = ${poly([[L2 / t, "q"]])}`, note: md`Multiply every term by $${L2}q$.` },
      { math: md`${L2} = ${poly([[L2 / t - L2 / p, "q"]])}`, note: "Collect the q-terms." },
      { math: md`q = ${q}`, note: md`Check: $\frac{1}{${p}} + \frac{1}{${q}} = \frac{1}{${t}}$ ✓.` },
    ],
  };
};

// ── Lesson 5: Graphs and asymptotes ─────────────────────────────────────────

/** p(10^12) written out, for a hidden check of the far-away value. */
const farAway = (p: Poly) => p.map((c, k) => `(${c})*(10^12)^${k}`).join(" + ");

const verticalAsymptotes: Generator = (r) => {
  const kind = r.int(0, 3);
  let nfs: Poly[];
  let dfs: Poly[];
  let nk = 1;
  if (kind === 0) {
    const c = r.int(-6, 6);
    let n: Poly;
    do n = lin(r.nonzero(-4, 4), r.int(-8, 8));
    while (at(n, c) === 0);
    nfs = [n];
    dfs = [xm(c)];
  } else if (kind === 1) {
    const [a, b, c] = distinct(r, 3, -6, 6);
    nfs = [xm(a!), xm(b!)];
    dfs = [xm(a!), xm(c!)];
  } else if (kind === 2) {
    const a = r.int(1, 6);
    const [n] = distinct(r, 1, -6, 6, [a, -a]);
    nfs = [xm(n!)];
    dfs = [xm(a), xm(-a)];
  } else {
    const [a, c, d] = distinct(r, 3, -6, 6);
    nk = r.pick([1, 2, 3, -1]);
    nfs = r.next() < 0.5 ? [xm(a!)] : [];
    dfs = [xm(c!), xm(d!)];
    if (nfs.length === 0) nk = r.pick([2, 3, 5, -4]);
  }
  const Np = expand({ k: nk, fs: nfs });
  const Dp = expand({ k: 1, fs: dfs });
  const { n, d, common } = cancelAll(nfs, dfs);
  const verify = [`${show(Dp)} = 0`];
  if (degree(Np) >= 1) verify.push(`(${show(Np)})/(${show(Np)}) = 1`);
  return {
    prompt: md`Find every vertical asymptote of $f(x) = \frac{${show(Np)}}{${show(Dp)}}$. Type the $x$-values, separated by commas.`,
    answer: rootAnswer(d),
    form: "set",
    verify,
    hint: "Factor and cancel first. A zero of the denominator gives an asymptote only if its factor is still in the denominator afterward.",
    solution: [
      { math: md`f(x) = \frac{${factTex(nk, nfs, common)}}{${factTex(1, dfs, common)}}`, note: common.length ? "Factor, and cancel the common factor. Its zero is a hole, not an asymptote." : "Factor. Nothing cancels." },
      ...(common.length ? [{ math: md`f(x) = ${ratTex({ k: nk, fs: n }, { k: 1, fs: d })}`, note: "The simplified form." }] : []),
      { math: d.map((f) => md`x = ${fracTex(-f[0]!, f[1]!)}`).join(md`,\quad `), note: "Near each of these the denominator is close to 0 but the numerator isn't, so the values blow up." },
    ],
  };
};

const horizontalAsymptote: Generator = (r) => {
  const kind = r.int(0, 3);
  const a = r.nonzero(-6, 6);
  const c = r.coef(-5, 5);
  let N: Poly;
  let D: Poly;
  if (kind === 0) {
    let b: number, d: number;
    do [b, d] = [r.int(-9, 9), r.nonzero(-9, 9)];
    while (a * d === b * c);
    [N, D] = [lin(a, b), lin(c, d)];
  } else if (kind === 1) {
    N = [r.int(-9, 9), r.int(-6, 6), a];
    D = [r.nonzero(-9, 9), r.int(-6, 6), c];
  } else if (kind === 2) {
    N = lin(a, r.int(-9, 9));
    D = [r.nonzero(-9, 9), r.int(-6, 6), r.pick([1, 1, 2, 3])];
  } else {
    // Multiple choice across the three cases.
    const which = r.int(0, 2);
    if (which === 0) [N, D] = [lin(a, r.int(-9, 9)), [r.nonzero(-9, 9), r.int(-6, 6), c]];
    else if (which === 1) [N, D] = [[r.int(-9, 9), r.int(-6, 6), a], [r.nonzero(-9, 9), r.int(-6, 6), c]];
    else [N, D] = [[r.int(-9, 9), r.int(-6, 6), a], lin(c, r.nonzero(-9, 9))];
    const choices = [md`$y = 0$`, md`$y = ${fracTex(a, c)}$`, "There is no horizontal asymptote"];
    const right = choices[which]!;
    return {
      prompt: md`Which describes the horizontal asymptote of $f(x) = \frac{${show(N)}}{${show(D)}}$?`,
      choices,
      accept: [right],
      hint: "Compare the degree of the numerator with the degree of the denominator.",
      solution: [
        { math: md`\deg(\text{top}) = ${degree(N)}, \quad \deg(\text{bottom}) = ${degree(D)}`, note: "Find the degrees." },
        {
          math: which === 0 ? md`y = 0` : which === 1 ? md`y = \frac{${a}}{${c}} = ${fracTex(a, c)}` : md`\text{no horizontal asymptote}`,
          note:
            which === 0
              ? "The bottom grows faster, so the fraction shrinks toward 0."
              : which === 1
                ? "Equal degrees: the ratio of the leading coefficients."
                : "The top grows faster than the bottom, so the values never level off.",
        },
      ],
    };
  }
  const n = degree(N);
  const m = degree(D);
  const lc = N[n]!;
  const ld = D[m]!;
  const value = n < m ? "0" : frac(lc, ld);
  return {
    prompt: md`Find the horizontal asymptote of $f(x) = \frac{${show(N)}}{${show(D)}}$. Type its $y$-value, like 3/2.`,
    answer: value,
    verify: [`y = (${farAway(N)})/(${farAway(D)})`],
    hint: "Compare degrees. Equal degrees: divide the leading coefficients. A smaller top degree: the asymptote is y = 0.",
    solution:
      n < m
        ? [
            { math: md`\deg(\text{top}) = ${n} < ${m} = \deg(\text{bottom})`, note: "The bottom has the higher power." },
            { math: md`\frac{${show(N)}}{${show(D)}} = \frac{\frac{${lc}}{x} + \cdots}{${ld} + \cdots}`, note: md`Divide top and bottom by $x^${m}$. Every term on top now has an $x$ in its denominator.` },
            { math: md`y = 0`, note: "Far out, the top shrinks to 0 while the bottom approaches a nonzero number." },
          ]
        : [
            { math: md`\deg(\text{top}) = \deg(\text{bottom}) = ${n}`, note: "Equal degrees." },
            { math: md`\frac{${show(N)}}{${show(D)}} = \frac{${lc} + \cdots}{${ld} + \cdots}`, note: md`Divide top and bottom by $x${n === 1 ? "" : `^${n}`}$. The terms in the dots all have $x$ in a denominator, so they shrink to 0.` },
            { math: md`y = \frac{${lc}}{${ld}} = ${fracTex(lc, ld)}`, note: "The ratio of the leading coefficients." },
          ],
  };
};

const findHole: Generator = (r) => {
  const kind = r.int(0, 2);
  let nfs: Poly[];
  let dfs: Poly[];
  let a: number;
  if (kind === 0) {
    const [p, b, c] = distinct(r, 3, -6, 6);
    a = p!;
    nfs = [xm(a), xm(b!)];
    dfs = [xm(a), xm(c!)];
  } else if (kind === 1) {
    a = r.nonzero(-6, 6);
    nfs = [xm(a), xm(-a)];
    dfs = [xm(a)];
  } else {
    const [p, c] = distinct(r, 2, -5, 5);
    a = p!;
    const k = r.int(2, 3);
    let q = r.nonzero(-7, 7);
    while (gcd(k, q) !== 1) q = r.nonzero(-7, 7);
    nfs = [lin(k, q), xm(a)];
    dfs = [xm(a), xm(c!)];
  }
  const { n, d, common } = cancelAll(nfs, dfs);
  const rest: RFrac = { n: { k: 1, fs: n }, d: { k: 1, fs: d } };
  const top = expand(rest.n);
  const bot = expand(rest.d);
  const yNum = at(top, a);
  const yDen = at(bot, a);
  const simplified = ratKey(rest.n, rest.d);
  const Dp = expand({ k: 1, fs: dfs });
  const y = frac(yNum, yDen);
  return {
    prompt: md`The graph of $f(x) = \frac{${show(expand({ k: 1, fs: nfs }))}}{${show(Dp)}}$ has a hole. Find it, as a point (x, y). Fractions are fine, like (2, 3/4).`,
    answer: `(${a}, ${y})`,
    form: "tuple",
    verify: [`y = ${simplified}`, `${show(Dp)} + y = y`],
    hint: "Factor and cancel. The cancelled factor gives the x-coordinate; the simplified expression at that x gives the height.",
    solution: [
      { math: md`f(x) = \frac{${factTex(1, nfs, common)}}{${factTex(1, dfs, common)}}`, note: md`Factor. $${show(xm(a))}$ cancels, so $x = ${a}$ is a hole, not an asymptote.` },
      { math: md`f(x) = ${ratTex(rest.n, rest.d)}, \quad x \ne ${a}`, note: "The simplified form matches f everywhere else." },
      { math: md`${ratTex(rest.n, rest.d).replace(/x/g, `(${a})`)} = ${fracTex(yNum, yDen)}`, note: "The height the graph approaches at the hole." },
      { math: md`\left(${a}, ${fracTex(yNum, yDen)}\right)`, note: "The missing point." },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit4: Unit = {
  title: "Rational Expressions",
  lessons: [
    {
      id: "simplifying-rational-expressions",
      title: "Simplifying rational expressions",
      summary: "Fractions built from polynomials: where they're undefined, how to reduce them, and what reducing quietly changes.",
      blocks: [
        {
          kind: "text",
          body: md`A **rational number** is a quotient of integers, like $\frac{3}{4}$. A **rational expression** is a quotient of polynomials, like
$$\frac{x + 1}{x^2 - 4}.$$
Substitute a number for $x$ and it becomes an ordinary fraction. At $x = 3$ it's $\frac{4}{5}$. At $x = 0$ it's $\frac{1}{-4} = -\frac{1}{4}$. At $x = 2$ the denominator is $0$, and there's no value at all.`,
        },
        {
          kind: "key",
          title: "Rational expressions and excluded values",
          body: md`A **rational expression** is $\frac{P}{Q}$, where $P$ and $Q$ are polynomials and $Q$ isn't the zero polynomial.

Its **excluded values** are the numbers that make $Q = 0$. Its domain is every real number except those. To find them, set the denominator equal to 0 and solve, usually by factoring. The numerator plays no part.`,
        },
        {
          kind: "why",
          title: "Why is there no value when the denominator is 0?",
          body: md`Division is defined through multiplication: $\frac{a}{b}$ is the number $c$ with $b \cdot c = a$. That's why $\frac{12}{3} = 4$: because $3 \cdot 4 = 12$.

Now try $b = 0$. If $a \ne 0$, we'd need $0 \cdot c = a$, but $0 \cdot c = 0$ for every $c$, so no number works. If $a = 0$, then $0 \cdot c = 0$ for **every** $c$, so no single number is *the* answer. Either way, $\frac{a}{0}$ has no value. A rational expression simply doesn't exist at its excluded values.`,
        },
        {
          kind: "check",
          prompt: md`Find the excluded values of $\frac{x + 5}{x^2 - x - 12}$. Separate them with commas.`,
          answer: "4, -3",
          form: "set",
          explain: md`$x^2 - x - 12 = (x - 4)(x + 3)$, which is 0 at $x = 4$ and at $x = -3$. The numerator doesn't matter.`,
        },
        {
          kind: "text",
          body: md`**Reducing.** You already reduce number fractions by cancelling a common factor:
$$\frac{12}{18} = \frac{2 \cdot 6}{3 \cdot 6} = \frac{2}{3}.$$
Rational expressions work the same way. Factor the top and the bottom completely, then cancel the factors they share.`,
        },
        {
          kind: "key",
          title: "Cancelling a common factor",
          body: md`$$\frac{ac}{bc} = \frac{a}{b} \quad \text{whenever } b \ne 0 \text{ and } c \ne 0.$$
A rational expression is in **simplest form** when its numerator and denominator share no factor other than 1 and $-1$: no common polynomial factor and no common whole-number factor.`,
        },
        {
          kind: "why",
          title: "Why cancelling works, and where it doesn't",
          body: md`Use the definition of division from above: $\frac{ac}{bc}$ is the number that gives $ac$ when multiplied by $bc$. Try $\frac{a}{b}$. Since $b \cdot \frac{a}{b} = a$,
$$bc \cdot \frac{a}{b} = c \cdot \left(b \cdot \frac{a}{b}\right) = c \cdot a.$$
That's $ac$, so $\frac{ac}{bc} = \frac{a}{b}$.

That needs $bc \ne 0$, so $c \ne 0$. When $c = 0$, $\frac{ac}{bc}$ is $\frac{0}{0}$, which has no value. So the rule holds exactly where $c \ne 0$, and we write that condition down.`,
        },
        {
          kind: "example",
          title: "Factor, then cancel",
          problem: md`Simplify $\frac{x^2 - 9}{x^2 + 5x + 6}$.`,
          steps: [
            { math: md`\frac{(x - 3)(x + 3)}{(x + 2)(x + 3)}`, note: "Factor: a difference of squares on top, a trinomial on the bottom." },
            { math: md`x \ne -2, \quad x \ne -3`, note: "Record the excluded values now, from the **original** denominator, before anything disappears." },
            { math: md`\frac{(x - 3)\cancel{(x + 3)}}{(x + 2)\cancel{(x + 3)}}`, note: md`Cancel the common factor $x + 3$.` },
            { math: md`\frac{x - 3}{x + 2}, \quad x \ne -3`, note: md`The new denominator still shows $x \ne -2$. It no longer shows $x \ne -3$, so state that one.` },
          ],
        },
        {
          kind: "plot",
          x: [-8, 6],
          y: [-8, 12],
          curves: [{ expr: "(x^2 - 9)/(x^2 + 5x + 6)", label: md`y = \frac{x^2 - 9}{x^2 + 5x + 6}` }],
          points: [{ x: -3, y: 6, open: true, label: md`(-3, 6)`, color: 2 }],
          vlines: [{ x: -2, label: "x = -2" }],
          caption: md`The graph of the original expression. It's the graph of $\frac{x - 3}{x + 2}$ with one point missing. At $x = -3$ the simplified form gives $\frac{-6}{-1} = 6$, but the original gives $\frac{0}{0}$, so the open circle marks a gap. Lesson 5 calls it a **hole**.`,
        },
        {
          kind: "why",
          title: "Equal, except at one point",
          body: md`Are $\frac{x^2 - 9}{x^2 + 5x + 6}$ and $\frac{x - 3}{x + 2}$ the same? At $x = -3$ the first is $\frac{0}{0}$, undefined, while the second is $6$. So they are **not** equal everywhere. They agree at every other number, because the cancelling step is valid wherever $x + 3 \ne 0$.

That's what "simplify" means for rational expressions: a cleaner expression that has the same value at every allowed $x$. The restriction $x \ne -3$ keeps track of the one place the two differ.`,
        },
        {
          kind: "example",
          title: "Opposite factors",
          problem: md`Simplify $\frac{2x^2 - 8x}{16 - x^2}$.`,
          steps: [
            { math: md`\frac{2x(x - 4)}{(4 - x)(4 + x)}`, note: "A common factor on top, a difference of squares on the bottom." },
            { math: md`\frac{2x(x - 4)}{-(x - 4)(x + 4)}`, note: md`$4 - x$ and $x - 4$ are opposites: $4 - x = -(x - 4)$.` },
            { math: md`-\frac{2x}{x + 4}, \quad x \ne 4`, note: md`Cancel $x - 4$. The excluded values are $4$ and $-4$.` },
          ],
        },
        {
          kind: "why",
          title: "Only factors cancel, never terms",
          body: md`In $\frac{x + 3}{3}$ it's tempting to cancel the 3s and get $x$. Test it at $x = 3$: $\frac{3 + 3}{3} = 2$, not $3$.

The rule $\frac{ac}{bc} = \frac{a}{b}$ needs $c$ to multiply **everything** on top and **everything** on the bottom. Here 3 is added to $x$, not multiplied, so nothing cancels. That's why factoring always comes first: it turns sums into products, and only products can cancel.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $\frac{x^2 - 4}{x^2 - x - 2}$. Type the answer like (x + 1)/(x - 2).`,
          answer: "(x + 2)/(x + 1)",
          simplified: true,
          explain: md`$\frac{(x - 2)(x + 2)}{(x - 2)(x + 1)} = \frac{x + 2}{x + 1}$, for $x \ne 2$ and $x \ne -1$.`,
        },
      ],
      practice: [excludedValues, simplifyRational],
    },
    {
      id: "multiplying-and-dividing",
      title: "Multiplying and dividing",
      summary: "Multiply tops and bottoms, divide by multiplying by the reciprocal, and factor first so the cancelling is easy to see.",
      blocks: [
        {
          kind: "text",
          body: md`At every allowed $x$, a rational expression is a number. So the rules for multiplying and dividing number fractions carry over unchanged. Before leaning on them, let's see why they're true.`,
        },
        {
          kind: "key",
          title: "Multiplying and dividing fractions",
          body: md`$$\frac{a}{b} \cdot \frac{c}{d} = \frac{ac}{bd}, \qquad \frac{a}{b} \div \frac{c}{d} = \frac{a}{b} \cdot \frac{d}{c}$$
with $b$, $d$ (and, for dividing, $c$) not 0.`,
        },
        {
          kind: "why",
          title: "Why multiply straight across?",
          body: md`By the definition of division, $\frac{a}{b} = a \cdot \frac{1}{b}$. So, regrouping with the commutative and associative properties,
$$\frac{a}{b} \cdot \frac{c}{d} = (ac) \cdot \left(\frac{1}{b} \cdot \frac{1}{d}\right).$$
Now multiply $\frac{1}{b} \cdot \frac{1}{d}$ by $bd$: you get $\left(b \cdot \frac{1}{b}\right)\left(d \cdot \frac{1}{d}\right) = 1 \cdot 1 = 1$. The only number that gives 1 when multiplied by $bd$ is $\frac{1}{bd}$. So the product is $ac \cdot \frac{1}{bd} = \frac{ac}{bd}$.`,
        },
        {
          kind: "why",
          title: "Why does dividing flip the second fraction?",
          body: md`$p \div q$ is the number that gives $p$ when multiplied by $q$. Test the claimed answer $\frac{a}{b} \cdot \frac{d}{c}$:
$$\left(\frac{a}{b} \cdot \frac{d}{c}\right) \cdot \frac{c}{d} = \frac{a}{b} \cdot \frac{dc}{cd} = \frac{a}{b}.$$
It does the job, so it's the quotient. Notice what this needed: $c \ne 0$ and $d \ne 0$, or $\frac{d}{c}$ wouldn't exist.`,
        },
        {
          kind: "text",
          body: md`**Factor first.** You could multiply the numerators out, multiply the denominators out, and then try to simplify. But you'd have to factor a big polynomial back apart. Factoring first keeps every factor in view. And since multiplying puts everything into one fraction, a factor on **any** top can cancel a matching factor on **any** bottom.`,
        },
        {
          kind: "example",
          title: "Multiplying",
          problem: md`Simplify $\frac{x^2 - 4}{x^2 + 3x} \cdot \frac{x + 3}{x - 2}$.`,
          steps: [
            { math: md`\frac{(x - 2)(x + 2)}{x(x + 3)} \cdot \frac{x + 3}{x - 2}`, note: "Factor everything." },
            { math: md`\frac{\cancel{(x - 2)}(x + 2)\cancel{(x + 3)}}{x\cancel{(x + 3)}\cancel{(x - 2)}}`, note: "Multiply across into one fraction, then cancel the factors that appear on both top and bottom." },
            { math: md`\frac{x + 2}{x}, \quad x \ne 0, -3, 2`, note: "The excluded values come from both original denominators." },
          ],
        },
        {
          kind: "check",
          prompt: md`Simplify $\frac{x + 1}{x - 4} \cdot \frac{x^2 - 16}{x^2 + x}$. Type the answer like (x + 1)/(x - 2).`,
          answer: "(x + 4)/x",
          simplified: true,
          explain: md`Factor: $\frac{x + 1}{x - 4} \cdot \frac{(x - 4)(x + 4)}{x(x + 1)}$. Cancel $x + 1$ and $x - 4$ to get $\frac{x + 4}{x}$.`,
        },
        {
          kind: "key",
          title: "Excluded values in a quotient",
          body: md`In $\frac{a}{b} \div \frac{c}{d}$, three things must be nonzero: $b$, $d$, **and** $c$. After flipping, the divisor's numerator $c$ sits in a denominator, so its zeros are excluded too.`,
        },
        {
          kind: "example",
          title: "Dividing",
          problem: md`Simplify $\frac{x^2 - 9}{2x + 4} \div \frac{x - 3}{x^2 + 2x}$.`,
          steps: [
            { math: md`\frac{x^2 - 9}{2x + 4} \cdot \frac{x^2 + 2x}{x - 3}`, note: "Multiply by the reciprocal." },
            { math: md`\frac{(x - 3)(x + 3)}{2(x + 2)} \cdot \frac{x(x + 2)}{x - 3}`, note: "Factor." },
            { math: md`\frac{\cancel{(x - 3)}(x + 3) \cdot x\cancel{(x + 2)}}{2\cancel{(x + 2)}\cancel{(x - 3)}}`, note: "Cancel." },
            { math: md`\frac{x(x + 3)}{2}, \quad x \ne -2, 0, 3`, note: md`$-2$ comes from the first denominator, $0$ from the second, and $3$ from the divisor's numerator.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Which values of $x$ are excluded from $\frac{x}{x - 1} \div \frac{x + 2}{x - 5}$? Separate them with commas.`,
          answer: "1, 5, -2",
          form: "set",
          explain: md`The denominators give $x \ne 1$ and $x \ne 5$. Flipping puts $x + 2$ in a denominator, so $x \ne -2$ as well.`,
        },
      ],
      practice: [multiplyRational, divideRational, excludedProductQuotient],
    },
    {
      id: "adding-and-subtracting",
      title: "Adding and subtracting",
      summary: "Common denominators for polynomials: the LCD from factors, combining numerators, and complex fractions.",
      blocks: [
        {
          kind: "text",
          body: md`Adding fractions needs a common denominator. With the same denominator it's direct: $\frac{2}{7} + \frac{3}{7} = \frac{5}{7}$. The same goes for rational expressions:
$$\frac{x}{x + 1} + \frac{3}{x + 1} = \frac{x + 3}{x + 1}.$$`,
        },
        {
          kind: "why",
          title: "Why add only the numerators?",
          body: md`Division is multiplication by a reciprocal, so $\frac{a}{c} = a \cdot \frac{1}{c}$. The distributive property does the rest:
$$\frac{a}{c} + \frac{b}{c} = a \cdot \frac{1}{c} + b \cdot \frac{1}{c} = (a + b) \cdot \frac{1}{c} = \frac{a + b}{c}.$$
The $\frac{1}{c}$ is a common factor, and you're factoring it out. That's also why adding the denominators is wrong ($\frac{1}{2} + \frac{1}{2}$ is 1, not $\frac{2}{4}$): nothing in the distributive property does that.`,
        },
        {
          kind: "example",
          title: "Subtracting a whole numerator",
          problem: md`Simplify $\frac{3x + 1}{x - 2} - \frac{x + 5}{x - 2}$.`,
          steps: [
            { math: md`\frac{(3x + 1) - (x + 5)}{x - 2}`, note: md`The fraction bar groups the numerator, so the minus applies to all of $x + 5$.` },
            { math: md`\frac{2x - 4}{x - 2}`, note: md`Distribute the minus: $3x + 1 - x - 5$.` },
            { math: md`\frac{2\cancel{(x - 2)}}{\cancel{x - 2}}`, note: "Always check whether the result simplifies. Here the numerator factors." },
            { math: md`2, \quad x \ne 2`, note: "Cancel." },
          ],
        },
        {
          kind: "text",
          body: md`**Different denominators.** Rewrite each fraction so the denominators match, by multiplying its top and bottom by the factors it's missing. The tidiest choice is the **least common denominator** (LCD): the simplest expression that every denominator divides into.`,
        },
        {
          kind: "key",
          title: "Finding the LCD",
          body: md`Factor each denominator completely. The LCD is the product of every factor that appears, each raised to the highest power it has in any one denominator.

For $x^2 - 9 = (x - 3)(x + 3)$ and $x^2 - 6x + 9 = (x - 3)^2$, the LCD is $(x - 3)^2(x + 3)$.`,
        },
        {
          kind: "why",
          title: "Why the LCD works, and why highest powers",
          body: md`Multiplying a fraction's top and bottom by the same nonzero expression is cancelling run backwards, $\frac{a}{b} = \frac{ac}{bc}$, so it doesn't change the value.

For a denominator to divide the LCD, each of its factors must be in the LCD at least as many times as it appears there. Taking each factor at its highest power is exactly enough. Any less, and some denominator wouldn't fit. It's the same idea as with numbers: $12 = 2^2 \cdot 3$ and $18 = 2 \cdot 3^2$ give LCD $2^2 \cdot 3^2 = 36$.`,
        },
        {
          kind: "example",
          title: "Two linear denominators",
          problem: md`Simplify $\frac{3}{x - 2} + \frac{2}{x + 1}$.`,
          steps: [
            { math: md`\text{LCD} = (x - 2)(x + 1)`, note: "The denominators share no factor, so the LCD is their product." },
            { math: md`\frac{3(x + 1)}{(x - 2)(x + 1)} + \frac{2(x - 2)}{(x - 2)(x + 1)}`, note: "Each fraction gets the factor it's missing." },
            { math: md`\frac{3x + 3 + 2x - 4}{(x - 2)(x + 1)}`, note: "Add the numerators." },
            { math: md`\frac{5x - 1}{(x - 2)(x + 1)}`, note: md`Combine. $5x - 1$ shares no factor with the denominator, so this is simplest.` },
          ],
        },
        {
          kind: "example",
          title: "One denominator inside another",
          problem: md`Simplify $\frac{x}{x^2 - 9} - \frac{1}{x - 3}$.`,
          steps: [
            { math: md`\frac{x}{(x - 3)(x + 3)} - \frac{1}{x - 3}`, note: md`Factor. The LCD is $(x - 3)(x + 3)$.` },
            { math: md`\frac{x - (x + 3)}{(x - 3)(x + 3)}`, note: md`Only the second fraction needs a factor, $x + 3$. Keep the parentheses.` },
            { math: md`\frac{-3}{(x - 3)(x + 3)} = -\frac{3}{x^2 - 9}`, note: "Either form of the denominator is fine." },
          ],
        },
        {
          kind: "check",
          prompt: md`Write $\frac{2}{x} + \frac{3}{x + 1}$ as one fraction, $\frac{N}{x(x + 1)}$. What is the numerator $N$? Multiply it out, like 3x - 7.`,
          answer: "5x + 2",
          expanded: true,
          simplified: true,
          explain: md`The LCD is $x(x + 1)$. $\frac{2(x + 1) + 3x}{x(x + 1)} = \frac{5x + 2}{x(x + 1)}$, so $N = 5x + 2$.`,
        },
        {
          kind: "text",
          body: md`**Complex fractions.** A complex fraction has fractions inside its numerator or denominator, like
$$\frac{1 + \frac{1}{x}}{1 - \frac{1}{x^2}}.$$
The quick way to simplify one: multiply its top and bottom by the LCD of all the small fractions inside. Every small denominator then cancels.`,
        },
        {
          kind: "why",
          title: "Why that's allowed",
          body: md`It's the cancelling rule used backwards: $\frac{A}{B} = \frac{A \cdot M}{B \cdot M}$ for any nonzero $M$. Pick $M$ to be the LCD, and the distributive property sends it to every term, which clears each inner fraction.

You could instead combine the top into one fraction, combine the bottom into one fraction, and divide by flipping. Both ways give the same answer. The LCD way is usually shorter.`,
        },
        {
          kind: "example",
          title: "A complex fraction",
          problem: md`Simplify $\frac{1 + \frac{1}{x}}{1 - \frac{1}{x^2}}$.`,
          steps: [
            { math: md`\frac{x^2 \cdot 1 + x^2 \cdot \frac{1}{x}}{x^2 \cdot 1 - x^2 \cdot \frac{1}{x^2}}`, note: md`Multiply top and bottom by $x^2$, the LCD of $\frac{1}{x}$ and $\frac{1}{x^2}$.` },
            { math: md`\frac{x^2 + x}{x^2 - 1}`, note: "The small denominators cancel." },
            { math: md`\frac{x\cancel{(x + 1)}}{(x - 1)\cancel{(x + 1)}}`, note: "Factor and cancel." },
            { math: md`\frac{x}{x - 1}, \quad x \ne 0, -1, 1`, note: md`$x = 0$ is excluded by the small fractions, $\pm 1$ by the main denominator.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Simplify $\frac{\frac{1}{x} - \frac{1}{2}}{x - 2}$. Type the answer like (x + 1)/(x - 2).`,
          answer: "-1/(2x)",
          simplified: true,
          explain: md`Multiply top and bottom by $2x$: $\frac{2 - x}{2x(x - 2)}$. Since $2 - x = -(x - 2)$, this is $-\frac{1}{2x}$.`,
        },
      ],
      practice: [leastCommonDenominator, addSubtract, complexFraction],
    },
    {
      id: "rational-equations",
      title: "Rational equations",
      summary: "Clear the denominators, solve, and check every candidate, because clearing can add solutions that aren't real.",
      blocks: [
        {
          kind: "text",
          body: md`A **rational equation** has the variable in a denominator, like $\frac{1}{x} + \frac{1}{3} = \frac{1}{2}$. In Algebra 1 you cleared number denominators by multiplying both sides by the LCD. The same move works here. The LCD of $x$, $3$ and $2$ is $6x$.`,
        },
        {
          kind: "example",
          title: "Clearing the denominators",
          problem: md`Solve $\frac{1}{x} + \frac{1}{3} = \frac{1}{2}$.`,
          steps: [
            { math: md`6x \cdot \frac{1}{x} + 6x \cdot \frac{1}{3} = 6x \cdot \frac{1}{2}`, note: md`Multiply every term by $6x$.` },
            { math: md`6 + 2x = 3x`, note: "Every denominator cancels." },
            { math: md`x = 6`, note: md`Subtract $2x$.` },
            { math: md`\frac{1}{6} + \frac{2}{6} = \frac{3}{6} = \frac{1}{2} \;\checkmark`, note: "Check in the original." },
          ],
        },
        {
          kind: "text",
          body: md`That check matters more than it did in Algebra 1. Watch what happens here.`,
        },
        {
          kind: "example",
          title: "A solution that isn't one",
          problem: md`Solve $\frac{x}{x - 3} = \frac{3}{x - 3} + 2$.`,
          steps: [
            { math: md`x = 3 + 2(x - 3)`, note: md`Multiply every term by $x - 3$.` },
            { math: md`x = 2x - 3`, note: "Distribute and combine." },
            { math: md`x = 3`, note: "Solve." },
            { math: md`\frac{3}{3 - 3} = \frac{3}{0}\ \text{is undefined}`, note: md`Check: $x = 3$ makes the denominators 0, so it isn't a solution. It was the only candidate, so there is **no solution**.` },
          ],
        },
        {
          kind: "why",
          title: "Where did the fake solution come from?",
          body: md`The multiplication property of equality runs one way: if $A = B$, then $AM = BM$. So every solution of the original equation is still a solution after multiplying. Going back needs dividing by $M$, which is only allowed where $M \ne 0$.

So the cleared equation can have **extra** solutions, and they can only be values where $M = 0$. Multiplying by 0 makes anything equal: $3 \cdot 0 = 5 \cdot 0$, though $3 \ne 5$. Here $M = x - 3$, and $x = 3$ is exactly where it's 0.`,
        },
        {
          kind: "key",
          title: "Extraneous solutions",
          body: md`As with radical equations in Algebra 1, Unit 9, an **extraneous solution** is a value the solving steps produce that doesn't satisfy the original equation. To solve a rational equation:

- List the excluded values: the zeros of every denominator.
- Multiply every term by the LCD and solve.
- Reject any candidate on the excluded list, and check the rest.`,
        },
        {
          kind: "example",
          title: "One kept, one rejected",
          problem: md`Solve $\frac{x^2}{x - 3} = \frac{9}{x - 3}$.`,
          steps: [
            { math: md`x^2 = 9`, note: md`Multiply both sides by $x - 3$. Excluded: $x = 3$.` },
            { math: md`x = 3 \quad\text{or}\quad x = -3`, note: "Two candidates." },
            { math: md`x = -3`, note: md`Reject 3. Check $-3$: both sides are $\frac{9}{-6} = -\frac{3}{2}$ ✓.` },
          ],
        },
        {
          kind: "plot",
          x: [-9, 10],
          y: [-14, 22],
          curves: [
            { expr: "x^2/(x - 3)", label: md`y = \frac{x^2}{x - 3}` },
            { expr: "9/(x - 3)", label: md`y = \frac{9}{x - 3}`, color: 2 },
          ],
          points: [{ x: -3, y: -1.5, label: md`\left(-3, -\tfrac{3}{2}\right)`, color: 3 }],
          vlines: [{ x: 3, label: "x = 3" }],
          caption: md`Each side of the equation as a graph. They cross once, at $x = -3$. At $x = 3$ neither side exists, so the "solution" $x = 3$ that the algebra produced isn't a crossing at all.`,
        },
        {
          kind: "why",
          title: "Cross-multiplying is the same move",
          body: md`For a proportion $\frac{a}{b} = \frac{c}{d}$, multiply both sides by $bd$: the $b$ cancels on the left, the $d$ on the right, and you get $ad = bc$. That's all cross-multiplying is. So the same warning applies: a candidate that makes $b$ or $d$ zero must be rejected.`,
        },
        {
          kind: "example",
          title: "A proportion",
          problem: md`Solve $\frac{4}{x + 1} = \frac{2}{x - 3}$.`,
          steps: [
            { math: md`4(x - 3) = 2(x + 1)`, note: md`Cross-multiply. Excluded: $x = -1$ and $x = 3$.` },
            { math: md`4x - 12 = 2x + 2`, note: "Distribute." },
            { math: md`x = 7`, note: md`Not excluded. Check: $\frac{4}{8} = \frac{1}{2}$ and $\frac{2}{4} = \frac{1}{2}$ ✓.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $\frac{x}{x - 4} = \frac{4}{x - 4} + 3$. If there are no solutions, type **no solution**.`,
          accept: NO_SOLUTION,
          form: "set",
          explain: md`Multiply by $x - 4$: $x = 4 + 3(x - 4) = 3x - 8$, so $x = 4$. But 4 is excluded, so it's extraneous. There is no solution.`,
        },
        {
          kind: "example",
          title: "Rates add, times don't",
          problem: md`Pipe A fills a tank in 3 hours and pipe B fills it in 6 hours. How long do they take together?`,
          steps: [
            { math: md`\frac{1}{3} + \frac{1}{6} = \frac{1}{t}`, note: md`In one hour A fills $\frac{1}{3}$ of the tank and B fills $\frac{1}{6}$. Together they fill $\frac{1}{t}$, where $t$ is the time together.` },
            { math: md`2t + t = 6`, note: md`Multiply every term by $6t$.` },
            { math: md`t = 2`, note: "Two hours. Less than either pipe alone, as it should be." },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $\frac{6}{x} - 1 = \frac{2}{x}$. If there are no solutions, type **no solution**.`,
          answer: "4",
          form: "set",
          explain: md`Multiply by $x$: $6 - x = 2$, so $x = 4$. It isn't excluded (only 0 is), and $\frac{6}{4} - 1 = \frac{1}{2} = \frac{2}{4}$ ✓.`,
        },
      ],
      practice: [linearRational, quadraticRational, workRate],
    },
    {
      id: "graphs-and-asymptotes",
      title: "Graphs and asymptotes",
      summary: "Vertical asymptotes, holes and horizontal asymptotes, each explained by what the numerator and denominator are doing.",
      blocks: [
        {
          kind: "text",
          body: md`The simplest rational function is $f(x) = \frac{1}{x}$. Near $x = 0$ its values are huge: $f(0.01) = 100$ and $f(0.001) = 1000$. Far from 0 they're tiny: $f(1000) = 0.001$. So the graph gets closer and closer to two lines: the $y$-axis near $x = 0$, and the $x$-axis far out. Lines like these, which a graph approaches more and more closely, are called **asymptotes**.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [{ expr: "1/x", label: md`y = \frac{1}{x}` }],
          caption: md`As $x$ approaches 0 from the right, $\frac{1}{x}$ shoots up. From the left it plunges down. As $x$ moves far out either way, the curve flattens toward $y = 0$.`,
        },
        {
          kind: "why",
          title: "Why the graph shoots up next to a zero of the denominator",
          body: md`Take $f(x) = \frac{x + 1}{x - 2}$ near $x = 2$. The numerator is close to 3, and the denominator is close to 0:
$$f(2.1) = \frac{3.1}{0.1} = 31, \qquad f(2.01) = \frac{3.01}{0.01} = 301, \qquad f(2.001) = 3001.$$
A number near 3 divided by a number near 0 is enormous. Just left of 2 the denominator is negative, so the values plunge instead: $f(1.99) = -299$. The line $x = 2$ is a **vertical asymptote**.`,
        },
        {
          kind: "why",
          title: "Why a cancelled factor makes a hole instead",
          body: md`Now take $g(x) = \frac{(x - 2)(x + 1)}{(x - 2)(x - 3)}$. At $x = 2$ the denominator is 0, but so is the numerator. For every $x \ne 2$, $g(x) = \frac{x + 1}{x - 3}$, and near $x = 2$ that's close to $\frac{3}{-1} = -3$, an ordinary number.

So the graph runs smoothly toward height $-3$ and is missing just one point, at $(2, -3)$. That's a **hole**. Nothing blows up, because after cancelling, the denominator isn't near 0 at $x = 2$.`,
        },
        {
          kind: "key",
          title: "Vertical asymptotes and holes",
          body: md`Factor $f = \frac{P}{Q}$ and cancel common factors first.

- If a factor $x - a$ cancels completely, the graph has a **hole** at $x = a$. Its height is the simplified expression evaluated at $a$.
- If $x - a$ is still in the denominator, the line $x = a$ is a **vertical asymptote**.`,
        },
        {
          kind: "plot",
          x: [-5, 9],
          y: [-8, 10],
          curves: [
            { expr: "(x^2 - x - 2)/(x^2 - 5x + 6)", label: md`y = g(x)` },
            { expr: "1", label: md`y = 1`, color: 3, dashed: true },
          ],
          points: [{ x: 2, y: -3, open: true, label: md`\text{hole } (2, -3)`, color: 2 }],
          vlines: [{ x: 3, label: "x = 3" }],
          caption: md`$g(x) = \frac{x^2 - x - 2}{x^2 - 5x + 6} = \frac{(x - 2)(x + 1)}{(x - 2)(x - 3)}$: a hole at $(2, -3)$, a vertical asymptote at $x = 3$, and a dashed line $y = 1$ that the curve levels off toward.`,
        },
        {
          kind: "text",
          body: md`**Horizontal asymptotes** describe far-away behavior: the height $f(x)$ approaches as $x$ grows large in either direction. When $x$ is huge, the highest-power term of a polynomial outweighs the rest. In $3x^2 + 5x - 7$ at $x = 1000$, the $3x^2$ term is $3{,}000{,}000$, and the other two terms together are only about $5{,}000$.`,
        },
        {
          kind: "why",
          title: "Divide everything by the highest power",
          body: md`Take $f(x) = \frac{3x^2 + 5x - 7}{2x^2 - x + 4}$. For $x \ne 0$, divide the top and the bottom by $x^2$ (cancelling run backwards):
$$f(x) = \frac{3 + \frac{5}{x} - \frac{7}{x^2}}{2 - \frac{1}{x} + \frac{4}{x^2}}.$$
As $x$ grows, every term with an $x$ in its denominator shrinks toward 0. What's left is $\frac{3}{2}$, so the graph levels off at $y = \frac{3}{2}$.

If the top has the smaller degree, as in $\frac{4x + 1}{x^2 + 1}$, dividing by $x^2$ leaves $\frac{\frac{4}{x} + \frac{1}{x^2}}{1 + \frac{1}{x^2}}$, which approaches $\frac{0}{1} = 0$. If the top has the bigger degree, as in $\frac{x^2 + 1}{x - 2}$, divide by $x$, the bottom's highest power: $\frac{x + \frac{1}{x}}{1 - \frac{2}{x}}$. The bottom approaches 1, but the top keeps growing with $x$, so the values never settle on a level.`,
        },
        {
          kind: "key",
          title: "Horizontal asymptotes from degrees",
          body: md`Say the numerator has degree $n$ and leading coefficient $a$, and the denominator has degree $m$ and leading coefficient $b$.

- $n < m$: the horizontal asymptote is $y = 0$.
- $n = m$: the horizontal asymptote is $y = \frac{a}{b}$.
- $n > m$: there is no horizontal asymptote.

The graph may cross a horizontal asymptote at moderate $x$. The asymptote only describes what happens far out.`,
        },
        {
          kind: "plot",
          x: [-6, 10],
          y: [-8, 10],
          curves: [
            { expr: "(a x + 1)/(x - 2)", label: md`y = \frac{ax + 1}{x - 2}` },
            { expr: "a", label: md`y = {a}`, color: 3, dashed: true },
          ],
          vlines: [{ x: 2, label: "x = 2" }],
          params: [{ name: "a", tex: "a", min: -3, max: 3, step: 0.5, value: 2 }],
          caption: md`For $a \ne 0$ the degrees are equal, so the curve levels off at $y = \frac{a}{1} = a$. At $a = 0$ the top is just 1, a smaller degree, so the asymptote is $y = 0$, which is still $a$. Try $a = -0.5$: the numerator becomes $-0.5(x - 2)$, the factor cancels, and the graph turns into the flat line $y = -0.5$ with a hole at $(2, -0.5)$. The dashed line $x = 2$ stays on screen, but at that setting it's no longer an asymptote.`,
        },
        {
          kind: "example",
          title: "Reading the graph from the formula",
          problem: md`Find the holes and asymptotes of $f(x) = \frac{2x^2 - 8}{x^2 - x - 2}$.`,
          steps: [
            { math: md`f(x) = \frac{2(x - 2)(x + 2)}{(x - 2)(x + 1)}`, note: "Factor." },
            { math: md`f(x) = \frac{2(x + 2)}{x + 1}, \quad x \ne 2`, note: md`Cancel $x - 2$.` },
            { math: md`\text{hole at } \left(2, \tfrac{8}{3}\right)`, note: md`$x - 2$ cancelled. The height is $\frac{2(2 + 2)}{2 + 1} = \frac{8}{3}$.` },
            { math: md`x = -1`, note: md`A vertical asymptote: $x + 1$ is still in the denominator.` },
            { math: md`y = 2`, note: md`A horizontal asymptote: equal degrees, so $y = \frac{2}{1}$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the horizontal asymptote of $f(x) = \frac{6x - 1}{3x + 4}$. Type its $y$-value.`,
          answer: "2",
          explain: md`Equal degrees, so the asymptote is the ratio of leading coefficients: $y = \frac{6}{3} = 2$.`,
        },
        {
          kind: "check",
          prompt: md`The graph of $f(x) = \frac{x^2 - 1}{x - 1}$ has a hole. Give it as a point (x, y).`,
          answer: "(1, 2)",
          form: "tuple",
          explain: md`$\frac{(x - 1)(x + 1)}{x - 1} = x + 1$ for $x \ne 1$. At $x = 1$ that's 2, so the hole is at $(1, 2)$. The graph is the line $y = x + 1$ with that one point missing.`,
        },
      ],
      practice: [verticalAsymptotes, horizontalAsymptote, findHole],
    },
  ],
};
