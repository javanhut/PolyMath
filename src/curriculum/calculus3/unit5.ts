import { frac, fracTex, gcd, type Rng } from "../../math/random";
import { md, slug, type Block, type Figure, type Generator, type Problem, type Step, type Unit } from "../types";

// ── Exact arithmetic ────────────────────────────────────────────────────────

/** A reduced fraction n/d with d > 0. */
interface Q {
  n: number;
  d: number;
}
const q = (n: number, d = 1): Q => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const qadd = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
const qsub = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d);
const qmul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
const qnum = (a: Q) => a.n / a.d;
const qtext = (a: Q) => frac(a.n, a.d);
const qtex = (a: Q) => fracTex(a.n, a.d);
const qzero = (a: Q) => a.n === 0;
const toQ = (v: number | Q): Q => (typeof v === "number" ? q(v) : v);

/** A number or fraction in parentheses when it is negative or a fraction, for substitution. */
const par = (v: number | Q) => {
  const t = qtext(toQ(v));
  return /^[0-9]+$/.test(t) ? t : `(${t})`;
};
/** A number as LaTeX, in parentheses when negative. */
const parTex = (v: number | Q) => {
  const f = toQ(v);
  return f.n < 0 ? `(${qtex(f)})` : qtex(f);
};

// ── Polynomials in x, y, z, t ───────────────────────────────────────────────
//
// Every field, potential and path in this unit is a polynomial with fraction
// coefficients, so partial derivatives, substitutions and definite integrals
// can be done exactly. A polynomial is a map from an exponent key "i,j,k,l"
// (the powers of x, y, z, t) to its coefficient.

type Var = "x" | "y" | "z" | "t";
const VARS: Var[] = ["x", "y", "z", "t"];
type Poly = Map<string, Q>;

const K = (e: number[]) => e.join(",");
const E = (k: string) => k.split(",").map(Number);
const vi = (v: Var) => VARS.indexOf(v);

/** A single term c x^i y^j z^k t^l. */
function term(c: number | Q, ex: Partial<Record<Var, number>> = {}): Poly {
  const coef = toQ(c);
  const p: Poly = new Map();
  if (!qzero(coef)) p.set(K(VARS.map((v) => ex[v] ?? 0)), coef);
  return p;
}
function padd(...ps: Poly[]): Poly {
  const out: Poly = new Map();
  for (const p of ps) {
    for (const [k, c] of p) {
      const s = qadd(out.get(k) ?? q(0), c);
      if (qzero(s)) out.delete(k);
      else out.set(k, s);
    }
  }
  return out;
}
function pscale(p: Poly, c: number | Q): Poly {
  const cc = toQ(c);
  const out: Poly = new Map();
  if (qzero(cc)) return out;
  for (const [k, v] of p) out.set(k, qmul(v, cc));
  return out;
}
const psub = (a: Poly, b: Poly) => padd(a, pscale(b, -1));
function pmul(a: Poly, b: Poly): Poly {
  const out: Poly = new Map();
  for (const [ka, ca] of a) {
    for (const [kb, cb] of b) {
      const eb = E(kb);
      const k = K(E(ka).map((e, i) => e + eb[i]!));
      const s = qadd(out.get(k) ?? q(0), qmul(ca, cb));
      if (qzero(s)) out.delete(k);
      else out.set(k, s);
    }
  }
  return out;
}
const pequal = (a: Poly, b: Poly) => psub(a, b).size === 0;
function pderiv(p: Poly, v: Var): Poly {
  const i = vi(v);
  const out: Poly = new Map();
  for (const [k, c] of p) {
    const e = E(k);
    const n = e[i]!;
    if (n === 0) continue;
    e[i] = n - 1;
    out.set(K(e), qmul(c, q(n)));
  }
  return out;
}
/** An antiderivative in v (no constant). */
function pint(p: Poly, v: Var): Poly {
  const i = vi(v);
  const out: Poly = new Map();
  for (const [k, c] of p) {
    const e = E(k);
    const n = e[i]! + 1;
    e[i] = n;
    out.set(K(e), qmul(c, q(1, n)));
  }
  return out;
}
/** Substitute a polynomial for a variable. */
function psubst(p: Poly, v: Var, by: Poly): Poly {
  const i = vi(v);
  let out: Poly = new Map();
  for (const [k, c] of p) {
    const e = E(k);
    const n = e[i]!;
    e[i] = 0;
    let t: Poly = new Map([[K(e), c]]);
    for (let m = 0; m < n; m++) t = pmul(t, by);
    out = padd(out, t);
  }
  return out;
}
const at = (p: Poly, v: Var, value: number | Q) => psubst(p, v, term(value));
/** The value of a constant polynomial. */
function pconst(p: Poly): Q {
  for (const k of p.keys()) if (E(k).some((e) => e !== 0)) throw new Error(`not constant: ${ptext(p)}`);
  return p.get(K([0, 0, 0, 0])) ?? q(0);
}
function pvars(p: Poly): Set<Var> {
  const s = new Set<Var>();
  for (const k of p.keys()) E(k).forEach((e, i) => e && s.add(VARS[i]!));
  return s;
}
/** ∫ from lo to hi in v, where the bounds may be polynomials in the other variables. */
function pdef(p: Poly, v: Var, lo: number | Q | Poly, hi: number | Q | Poly): Poly {
  const F = pint(p, v);
  const bound = (b: number | Q | Poly) => (b instanceof Map ? psubst(F, v, b) : at(F, v, b));
  return psub(bound(hi), bound(lo));
}
/** Evaluate at a point (every variable of p must be given). */
const peval = (p: Poly, pt: Partial<Record<Var, number | Q>>): Q => {
  let r = p;
  for (const v of pvars(p)) r = at(r, v, pt[v] ?? 0);
  return pconst(r);
};

/** Terms in a readable order: higher total degree first, then x before y before z before t. */
function pterms(p: Poly): [number[], Q][] {
  return [...p.entries()]
    .map(([k, c]) => [E(k), c] as [number[], Q])
    .sort((a, b) => {
      const da = a[0].reduce((s, e) => s + e, 0);
      const db = b[0].reduce((s, e) => s + e, 0);
      if (da !== db) return db - da;
      for (let i = 0; i < 4; i++) if (a[0][i] !== b[0][i]) return b[0][i]! - a[0][i]!;
      return 0;
    });
}

/**
 * Typed-answer text, e.g. "3 x^2 y - 1/2 y^3 + 4". The parser reads products
 * left to right, so "1/2 y^3" is (1/2) y^3. `sub` replaces variables by text,
 * e.g. { x: "(x + 1)" } or { y: "(-2)" }, for verify equations.
 */
function ptext(p: Poly, sub: Partial<Record<Var, string>> = {}): string {
  const terms = pterms(p);
  if (!terms.length) return "0";
  let out = "";
  for (const [e, c] of terms) {
    const vars = VARS.map((v, i) => (e[i] === 0 ? "" : e[i] === 1 ? (sub[v] ?? v) : `${sub[v] ?? v}^${e[i]}`))
      .filter(Boolean)
      .join(" ");
    const mag = q(Math.abs(c.n), c.d);
    const coef = qtext(mag);
    const body = !vars ? coef : mag.n === 1 && mag.d === 1 ? vars : `${coef} ${vars}`;
    out += out ? `${c.n < 0 ? " - " : " + "}${body}` : `${c.n < 0 ? "-" : ""}${body}`;
  }
  return out;
}
/** LaTeX for a polynomial. */
function ptex(p: Poly): string {
  const terms = pterms(p);
  if (!terms.length) return "0";
  let out = "";
  for (const [e, c] of terms) {
    const vars = VARS.map((v, i) => (e[i] === 0 ? "" : e[i] === 1 ? v : `${v}^${e[i]}`)).join("");
    const mag = q(Math.abs(c.n), c.d);
    const coef = qtex(mag);
    const body = !vars ? coef : mag.n === 1 && mag.d === 1 ? vars : `${coef}${vars}`;
    out += out ? `${c.n < 0 ? " - " : " + "}${body}` : `${c.n < 0 ? "-" : ""}${body}`;
  }
  return out;
}
/** LaTeX for a polynomial with numbers substituted for its variables, factors joined by \cdot: "-3 \cdot 0 \cdot (-1) + 3". */
function ptexAt(p: Poly, pt: Partial<Record<Var, number | Q>>): string {
  const terms = pterms(p);
  if (!terms.length) return "0";
  let out = "";
  for (const [e, c] of terms) {
    const factors = VARS.map((v, i) => (e[i] === 0 ? "" : e[i] === 1 ? parTex(pt[v] ?? 0) : `${parTex(pt[v] ?? 0)}^${e[i]}`)).filter(Boolean);
    const mag = q(Math.abs(c.n), c.d);
    const coef = qtex(mag);
    const body = !factors.length ? coef : mag.n === 1 && mag.d === 1 ? factors.join(" \\cdot ") : [coef, ...factors].join(" \\cdot ");
    out += out ? `${c.n < 0 ? " - " : " + "}${body}` : `${c.n < 0 ? "-" : ""}${body}`;
  }
  return out;
}
/** The polynomial's text with every variable replaced by a number, in parentheses. */
const evalText = (p: Poly, pt: Partial<Record<Var, number | Q>>) =>
  ptext(p, Object.fromEntries([...pvars(p)].map((v) => [v, par(pt[v] ?? 0)])));

/**
 * Text for ∂p/∂v at a point, by the five-point stencil
 * (p(v-2h) - 8p(v-h) + 8p(v+h) - p(v+2h)) / 12h with h = 1, which is exact for
 * polynomials of degree at most 4 in v. Variables in `free` stay symbolic; the
 * others take their values from `pt`. Used in verify equations, so that the
 * validator re-derives derivatives from the field's own formula.
 */
function dText(p: Poly, v: Var, pt: Partial<Record<Var, number | Q>> = {}, free: Set<Var> = new Set()): string {
  const sub = (k: number): Partial<Record<Var, string>> => {
    const s: Partial<Record<Var, string>> = {};
    for (const w of pvars(p)) {
      if (w === v) s[w] = free.has(w) ? `(${w} ${k < 0 ? "-" : "+"} ${Math.abs(k)})` : par(qadd(toQ(pt[w] ?? 0), q(k)));
      else s[w] = free.has(w) ? w : par(pt[w] ?? 0);
    }
    return s;
  };
  const T = (k: number) => `(${ptext(p, sub(k))})`;
  return `(${T(-2)} - 8${T(-1)} + 8${T(1)} - ${T(2)})/12`;
}
/** Text for ∂²p/∂v² the same way: (-p(v+2) + 16p(v+1) - 30p(v) + 16p(v-1) - p(v-2))/12, exact to degree 5. */
function d2Text(p: Poly, v: Var, pt: Partial<Record<Var, number | Q>> = {}, free: Set<Var> = new Set()): string {
  const sub = (k: number): Partial<Record<Var, string>> => {
    const s: Partial<Record<Var, string>> = {};
    for (const w of pvars(p)) {
      if (w === v) s[w] = free.has(w) ? (k === 0 ? w : `(${w} ${k < 0 ? "-" : "+"} ${Math.abs(k)})`) : par(qadd(toQ(pt[w] ?? 0), q(k)));
      else s[w] = free.has(w) ? w : par(pt[w] ?? 0);
    }
    return s;
  };
  const T = (k: number) => `(${ptext(p, sub(k))})`;
  return `(-${T(2)} + 16${T(1)} - 30${T(0)} + 16${T(-1)} - ${T(-2)})/12`;
}
/** Sample values for variables that a verify equation must pin down (ones the answer doesn't contain). */
const FIX: Record<Var, Q> = { x: q(1, 2), y: q(-1, 3), z: q(2, 5), t: q(3, 7) };

/** A potential f with ∇f = ⟨P, Q⟩, or null when P_y ≠ Q_x. */
function potential(P: Poly, Q: Poly): Poly | null {
  if (!pequal(pderiv(P, "y"), pderiv(Q, "x"))) return null;
  const fx = pint(P, "x");
  const rest = psub(Q, pderiv(fx, "y"));
  if (pvars(rest).has("x")) return null;
  return padd(fx, pint(rest, "y"));
}

/** ∫_C F·dr for F = ⟨P, Q⟩ along r(t) = ⟨X(t), Y(t)⟩, a ≤ t ≤ b, done exactly. */
function work(P: Poly, Q: Poly, X: Poly, Y: Poly, a: number, b: number): { FX: Poly; FY: Poly; integrand: Poly; value: Q } {
  const sub = (p: Poly) => psubst(psubst(p, "x", X), "y", Y);
  const [FX, FY] = [sub(P), sub(Q)];
  const integrand = padd(pmul(FX, pderiv(X, "t")), pmul(FY, pderiv(Y, "t")));
  return { FX, FY, integrand, value: pconst(pdef(integrand, "t", a, b)) };
}

// ── Formatting helpers ──────────────────────────────────────────────────────

/** ⟨a, b, c⟩ in LaTeX. */
const vec = (...c: (string | number)[]) => `\\langle ${c.join(", ")} \\rangle`;
/** F·dr, F·dS and friends. */
const Fdr = `\\mathbf{F} \\cdot d\\mathbf{r}`;
const FdS = `\\mathbf{F} \\cdot d\\mathbf{S}`;

/** sqrt(n) simplified: k sqrt(m), as typed text and LaTeX. */
function root(n: number): { k: number; m: number; text: string; tex: string } {
  let k = 1;
  let m = n;
  for (let d = 2; d * d <= m; d++) {
    while (m % (d * d) === 0) {
      m /= d * d;
      k *= d;
    }
  }
  const text = m === 1 ? String(k) : k === 1 ? `sqrt(${m})` : `${k}sqrt(${m})`;
  const tex = m === 1 ? String(k) : k === 1 ? `\\sqrt{${m}}` : `${k}\\sqrt{${m}}`;
  return { k, m, text, tex };
}

/** c·π (times an optional sqrt(m)) as typed text and LaTeX: "12pi", "3pi/2", "9pi sqrt(2)". */
function piText(c: Q, m = 1): { text: string; tex: string } {
  if (qzero(c)) return { text: "0", tex: "0" };
  const rt = m === 1 ? { text: "", tex: "" } : { text: ` sqrt(${m})`, tex: `\\sqrt{${m}}` };
  const sign = c.n < 0 ? "-" : "";
  const n = Math.abs(c.n);
  const num = n === 1 ? "" : String(n);
  if (c.d === 1) return { text: `${sign}${num}pi${rt.text}`, tex: `${sign}${num}${rt.tex}\\pi` };
  return { text: `${sign}${num}pi${rt.text}/${c.d}`, tex: `${sign}\\frac{${num}${rt.tex}\\pi}{${c.d}}` };
}

/** Shuffle a copy of an array with the seeded rng. */
function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A field plot of ⟨dx, dy⟩ on [-3, 3]². */
const fieldPlot = (dx: string, dy: string): Figure => ({ kind: "plot", x: [-3, 3], y: [-3, 3], field: { dx, dy } });

/** Steps that evaluate a polynomial integrand in t over [a, b]. */
function integrateSteps(g: Poly, a: number, b: number, letter = "t"): Step[] {
  const G = pint(g, "t");
  const value = pconst(pdef(g, "t", a, b));
  return [
    { math: md`\int_{${a}}^{${b}} \left(${ptex(g)}\right) dt = \left[${ptex(G)}\right]_{${a}}^{${b}}`, note: md`Antidifferentiate term by term in $${letter}$.` },
    { math: md`= ${qtex(value)}`, note: md`Evaluate at $${letter} = ${b}$ and subtract the value at $${letter} = ${a}$.` },
  ];
}

// ── Lesson 1 generators: vector fields ──────────────────────────────────────

const gradientComponent: Generator = (r) => {
  const [a, b, c] = [r.coef(-4, 4), r.nonzero(-4, 4), r.nonzero(-5, 5)];
  const templates: Poly[] = [
    padd(term(a, { x: 2, y: 1 }), term(b, { y: 3 })),
    padd(term(a, { x: 3 }), term(b, { x: 1, y: 2 })),
    padd(term(a, { x: 1, y: 1 }), term(b, { x: 2 }), term(c, { y: 1 })),
    padd(term(a, { x: 2, y: 2 }), term(b, { x: 1 }), term(c, { y: 2 })),
    padd(term(a, { x: 1, y: 3 }), term(b, { x: 2, y: 1 })),
    padd(term(a, { x: 3, y: 1 }), term(b, { x: 1, y: 1 }), term(c, { x: 1 })),
  ];
  const f = r.pick(templates);
  const v: Var = r.pick(["x", "y"]);
  const other = v === "x" ? "y" : "x";
  const d = pderiv(f, v);
  const pieces = pterms(f).map(([e, c]) => {
    const t: Poly = new Map([[K(e), c]]);
    return md`\frac{\partial}{\partial ${v}}\left(${ptex(t)}\right) = ${ptex(pderiv(t, v))}`;
  });
  return {
    prompt: md`Find $\frac{\partial f}{\partial ${v}}$ when $f(x, y) = ${ptex(f)}$. It is the $${v}$-component of the gradient field $\nabla f = \langle f_x, f_y \rangle$.`,
    answer: ptext(d),
    simplified: true,
    hint: md`Treat $${other}$ as a constant and differentiate each term with respect to $${v}$ by the power rule.`,
    solution: [
      { math: pieces.join(", \\quad "), note: md`Term by term, with $${other}$ riding along as a constant factor. A term with no $${v}$ in it has derivative 0.` },
      { math: md`\frac{\partial f}{\partial ${v}} = ${ptex(d)}`, note: md`Add the pieces. Together with $f_${other}$ this gives the arrow $\nabla f$ at every point.` },
    ],
  };
};

const fieldAtPoint: Generator = (r) => {
  const [a, b, c] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const fields: [Poly, Poly][] = [
    [padd(term(a, { x: 1 }), term(b, { y: 1 })), term(c, { x: 1, y: 1 })],
    [padd(term(1, { x: 2 }), term(-1, { y: 1 })), padd(term(a, { x: 1 }), term(b, { y: 2 }))],
    [term(a, { y: 1 }), padd(term(b, { x: 1 }), term(c))],
    [padd(term(a, { x: 1, y: 1 }), term(c)), padd(term(b, { x: 2 }), term(-1, { y: 1 }))],
    [padd(term(a, { y: 2 }), term(b, { x: 1 })), term(c, { x: 1, y: 1 })],
  ];
  const [P, Q] = r.pick(fields);
  let x0 = 0;
  let y0 = 0;
  let P0 = q(0);
  let Q0 = q(0);
  do {
    [x0, y0] = [r.int(-3, 3), r.int(-3, 3)];
    [P0, Q0] = [peval(P, { x: x0, y: y0 }), peval(Q, { x: x0, y: y0 })];
  } while (qzero(P0) && qzero(Q0));
  const pt = { x: x0, y: y0 };
  const F = vec(ptex(P), ptex(Q));
  const substituted = md`\langle ${ptexAt(P, pt)}, ${ptexAt(Q, pt)} \rangle`;
  if (r.int(0, 1) === 0) {
    return {
      prompt: md`Let $\mathbf{F}(x, y) = ${F}$. Find the vector $\mathbf{F}(${x0}, ${y0})$, the arrow the field places at the point $(${x0}, ${y0})$. Type it as a vector like <3, -2>.`,
      answer: `(${qtext(P0)}, ${qtext(Q0)})`,
      form: "tuple",
      verify: [`a + b = (${evalText(P, pt)}) + (${evalText(Q, pt)})`, `a - b = (${evalText(P, pt)}) - (${evalText(Q, pt)})`],
      hint: md`Substitute $x = ${x0}$ and $y = ${y0}$ into each component. The result is a vector, not a number.`,
      solution: [
        { math: substituted, note: "Substitute into both components, keeping negatives in parentheses." },
        { math: md`\mathbf{F}(${x0}, ${y0}) = ${vec(qtex(P0), qtex(Q0))}`, note: md`At $(${x0}, ${y0})$ the field draws an arrow with these components.` },
      ],
    };
  }
  const m2 = P0.n * P0.n + Q0.n * Q0.n;
  const rt = root(m2);
  return {
    prompt: md`Let $\mathbf{F}(x, y) = ${F}$. Find $|\mathbf{F}(${x0}, ${y0})|$, the length of the arrow drawn at $(${x0}, ${y0})$. Give an exact value, with any radical simplified.`,
    answer: rt.text,
    simplified: true,
    verify: [`m^2 = (${evalText(P, pt)})^2 + (${evalText(Q, pt)})^2`],
    hint: md`First find the vector $\mathbf{F}(${x0}, ${y0})$, then its length by the Pythagorean theorem.`,
    solution: [
      { math: md`\mathbf{F}(${x0}, ${y0}) = ${substituted} = ${vec(qtex(P0), qtex(Q0))}`, note: "Substitute the point into both components." },
      { math: md`|\mathbf{F}(${x0}, ${y0})| = \sqrt{${parTex(P0)}^2 + ${parTex(Q0)}^2} = \sqrt{${m2}} = ${rt.tex}`, note: "Length of a vector: the square root of the sum of the squared components." },
    ],
  };
};

const FIELD_DESCRIPTIONS = [
  "Turns counterclockwise around the origin",
  "Turns clockwise around the origin",
  "Points straight away from the origin",
  "Points straight toward the origin",
  "Horizontal arrows that grow longer farther from the x-axis",
  "Every arrow is the same",
];

const describeField: Generator = (r) => {
  const kind = r.int(0, 5);
  const k = r.int(1, 3);
  const [ca, cb] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const fields: [Poly, Poly][] = [
    [term(-k, { y: 1 }), term(k, { x: 1 })],
    [term(k, { y: 1 }), term(-k, { x: 1 })],
    [term(k, { x: 1 }), term(k, { y: 1 })],
    [term(-k, { x: 1 }), term(-k, { y: 1 })],
    [term(k, { y: 1 }), term(0)],
    [term(ca), term(cb)],
  ];
  const [P, Q] = fields[kind]!;
  const probe = (x: number, y: number) => vec(qtex(peval(P, { x, y })), qtex(peval(Q, { x, y })));
  const reasons = [
    md`At $(1, 0)$ the arrow is $${probe(1, 0)}$ (straight up); at $(0, 1)$ it is $${probe(0, 1)}$ (to the left). Each arrow is perpendicular to the position vector and turns the same way as the hands of a clock run backwards: counterclockwise rotation, faster farther out.`,
    md`At $(1, 0)$ the arrow is $${probe(1, 0)}$ (straight down); at $(0, 1)$ it is $${probe(0, 1)}$ (to the right). Each arrow is perpendicular to the position vector, turning the way a clock's hands do: clockwise rotation.`,
    md`At every point the arrow is $${k === 1 ? "" : k}\langle x, y \rangle$, a positive multiple of the position vector, so it points directly away from the origin and grows with distance.`,
    md`At every point the arrow is $-${k === 1 ? "" : k}\langle x, y \rangle$, pointing back along the position vector toward the origin.`,
    md`The $y$-component is always 0, so every arrow is horizontal. The $x$-component $${ptex(P)}$ grows with $|y|$: arrows point right above the $x$-axis, left below it, and get longer away from it.`,
    md`Neither component depends on $x$ or $y$, so the same arrow $${vec(ca, cb)}$ sits at every point.`,
  ];
  return {
    prompt: md`The field $\mathbf{F}(x, y) = ${vec(ptex(P), ptex(Q))}$ is drawn below. Which description fits it?`,
    figure: fieldPlot(ptext(P), ptext(Q)),
    choices: FIELD_DESCRIPTIONS,
    accept: [FIELD_DESCRIPTIONS[kind]!],
    hint: md`Work out the arrows at a few easy points: $(1, 0)$, $(0, 1)$, $(-1, 0)$. Is each arrow along the position vector, perpendicular to it, or unrelated?`,
    solution: [
      { math: md`\mathbf{F}(1, 0) = ${probe(1, 0)}, \quad \mathbf{F}(0, 1) = ${probe(0, 1)}, \quad \mathbf{F}(-1, 0) = ${probe(-1, 0)}`, note: "Evaluate at three easy points." },
      { math: md`\text{${FIELD_DESCRIPTIONS[kind]}}`, note: reasons[kind]! },
    ],
  };
};

// ── Lesson 2 generators: line integrals ─────────────────────────────────────

const TRIPLES: [number, number][] = [
  [3, 4],
  [4, 3],
  [6, 8],
  [8, 6],
  [5, 12],
  [12, 5],
];

const scalarLineIntegral: Generator = (r) => {
  if (r.int(0, 2) < 2) {
    const [p, qq] = r.pick(TRIPLES);
    const L = Math.hypot(p, qq);
    const [x1, y1] = r.pick([
      [0, 0],
      [0, 0],
      [1, 0],
      [0, 1],
      [-1, 1],
      [2, -1],
    ]);
    const [x2, y2] = [x1 + p, y1 + qq];
    const [a, b, c] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.int(0, 4)];
    const f = padd(term(a, { x: 1 }), term(b, { y: 1 }), term(c));
    const X = padd(term(x1), term(p, { t: 1 }));
    const Y = padd(term(y1), term(qq, { t: 1 }));
    const g = psubst(psubst(f, "x", X), "y", Y);
    const inner = pconst(pdef(g, "t", 0, 1));
    const value = qmul(inner, q(L));
    return {
      prompt: md`Find $\int_C (${ptex(f)}) \, ds$, where $C$ is the straight segment from $(${x1}, ${y1})$ to $(${x2}, ${y2})$. Give an exact fraction.`,
      answer: qtext(value),
      simplified: true,
      // The average of a linear function along a segment is its value at the midpoint, so the integral is f(midpoint) times the length.
      verify: [`W = ${L} * (${evalText(f, { x: q(x1 + x2, 2), y: q(y1 + y2, 2) })})`],
      hint: md`Parametrize the segment as $\mathbf{r}(t) = \langle ${ptex(X)}, ${ptex(Y)} \rangle$ for $0 \le t \le 1$. Then $ds = |\mathbf{r}'(t)|\,dt$, and $|\mathbf{r}'(t)|$ is a constant here.`,
      solution: [
        { math: md`\mathbf{r}(t) = \langle ${ptex(X)}, ${ptex(Y)} \rangle, \quad 0 \le t \le 1`, note: "Start point plus t times the displacement." },
        { math: md`|\mathbf{r}'(t)| = \sqrt{${p}^2 + ${qq}^2} = ${L}`, note: md`So $ds = ${L}\,dt$: each unit of $t$ covers ${L} units of length.` },
        { math: md`f(\mathbf{r}(t)) = ${ptex(g)}`, note: md`Substitute $x = ${ptex(X)}$ and $y = ${ptex(Y)}$.` },
        { math: md`\int_C f\,ds = ${L}\int_0^1 \left(${ptex(g)}\right) dt = ${L} \cdot ${qtex(inner)} = ${qtex(value)}`, note: "Integrate in t and multiply by the constant speed." },
      ],
    };
  }
  const R = r.int(1, 3);
  const c = r.int(0, 3);
  const arc = r.int(0, 2);
  const theta: [Q, string, string][] = [
    [q(1, 2), md`the quarter circle $x^2 + y^2 = ${R * R}$ from $(${R}, 0)$ to $(0, ${R})$`, "\\pi/2"],
    [q(1), md`the upper half of the circle $x^2 + y^2 = ${R * R}$ from $(${R}, 0)$ to $(-${R}, 0)$`, "\\pi"],
    [q(2), md`the whole circle $x^2 + y^2 = ${R * R}$`, "2\\pi"],
  ];
  const [frac2, desc, upper] = theta[arc]!;
  const f = padd(term(1, { x: 2 }), term(1, { y: 2 }), term(c));
  const onCircle = R * R + c;
  const value = qmul(q(onCircle * R), frac2);
  const pt = piText(value);
  return {
    prompt: md`Find $\int_C (${ptex(f)}) \, ds$, where $C$ is ${desc}. Give the exact answer in terms of $\pi$ (type pi).`,
    answer: pt.text,
    simplified: true,
    hint: md`On the circle, $x^2 + y^2$ is a constant. Parametrize with $\mathbf{r}(t) = \langle ${R}\cos t, ${R}\sin t \rangle$ and find $|\mathbf{r}'(t)|$.`,
    solution: [
      { math: md`\mathbf{r}(t) = \langle ${R}\cos t, ${R}\sin t \rangle, \quad 0 \le t \le ${upper}`, note: "The standard parametrization of a circle; the angle range covers the arc described." },
      { math: md`|\mathbf{r}'(t)| = \sqrt{${R * R}\sin^2 t + ${R * R}\cos^2 t} = ${R}`, note: md`So $ds = ${R}\,dt$.` },
      { math: md`f(\mathbf{r}(t)) = ${R * R}\cos^2 t + ${R * R}\sin^2 t ${c ? `+ ${c}` : ""} = ${onCircle}`, note: md`On the circle $x^2 + y^2 = ${R * R}$, so the integrand is constant.` },
      { math: md`\int_C f\,ds = \int_0^{${upper}} ${onCircle} \cdot ${R}\,dt = ${onCircle * R} \cdot ${upper} = ${pt.tex}`, note: "A constant times the arc length." },
    ],
  };
};

/** A random polynomial field ⟨P, Q⟩, flagged conservative or not. */
function randomField(r: Rng, conservative: boolean): [Poly, Poly] {
  const [a, b, c] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-4, 4)];
  if (conservative) {
    const list: [Poly, Poly][] = [
      [term(a, { y: 1 }), term(a, { x: 1 })],
      [term(2 * a, { x: 1, y: 1 }), term(a, { x: 2 })],
      [term(a, { y: 2 }), term(2 * a, { x: 1, y: 1 })],
      [padd(term(2 * a, { x: 1 }), term(b, { y: 1 })), padd(term(b, { x: 1 }), term(c))],
      [term(3 * a, { x: 2, y: 1 }), padd(term(a, { x: 3 }), term(b))],
      [padd(term(a, { y: 1 }), term(c)), padd(term(a, { x: 1 }), term(2 * b, { y: 1 }))],
    ];
    return r.pick(list);
  }
  const b2 = b === a ? -a : b;
  const list: [Poly, Poly][] = [
    [term(a, { y: 1 }), term(b2, { x: 1 })],
    [term(a, { y: 2 }), term(b, { x: 1 })],
    [term(a, { x: 1, y: 1 }), term(b, { y: 1 })],
    [term(-a, { y: 1 }), term(a, { x: 1 })],
    [term(a, { x: 2 }), term(b, { x: 1, y: 1 })],
    [padd(term(a, { y: 1 }), term(c)), term(b, { x: 2 })],
  ];
  return r.pick(list);
}

interface Path {
  X: Poly;
  Y: Poly;
  T: number;
}
function randomPath(r: Rng): Path {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const [p, qq] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
    return { X: term(p, { t: 1 }), Y: term(qq, { t: 1 }), T: 1 };
  }
  if (kind === 1) return { X: term(1, { t: 1 }), Y: term(1, { t: 2 }), T: r.int(1, 2) };
  if (kind === 2) return { X: term(1, { t: 2 }), Y: term(1, { t: 1 }), T: 1 };
  return { X: term(1, { t: 1 }), Y: term(1, { t: 3 }), T: 1 };
}

const workAlongPath: Generator = (r) => {
  const conservative = r.int(0, 1) === 0;
  const [P, Q] = randomField(r, conservative);
  const { X, Y, T } = randomPath(r);
  const w = work(P, Q, X, Y, 0, T);
  const A = { x: peval(X, { t: 0 }), y: peval(Y, { t: 0 }) };
  const B = { x: peval(X, { t: T }), y: peval(Y, { t: T }) };
  const f = conservative ? potential(P, Q) : null;
  const problem: Problem = {
    prompt: md`Find the work done by $\mathbf{F} = ${vec(ptex(P), ptex(Q))}$ along the curve $C$: $\mathbf{r}(t) = ${vec(ptex(X), ptex(Y))}$, $0 \le t \le ${T}$. That is, find $\int_C ${Fdr}$. Give an exact fraction.`,
    answer: qtext(w.value),
    simplified: true,
    hint: md`Substitute $x = ${ptex(X)}$ and $y = ${ptex(Y)}$ into $\mathbf{F}$, dot with $\mathbf{r}'(t) = ${vec(ptex(pderiv(X, "t")), ptex(pderiv(Y, "t")))}$, and integrate from 0 to ${T}.`,
    solution: [
      { math: md`\mathbf{r}'(t) = ${vec(ptex(pderiv(X, "t")), ptex(pderiv(Y, "t")))}`, note: "Differentiate each component." },
      { math: md`\mathbf{F}(\mathbf{r}(t)) = ${vec(ptex(w.FX), ptex(w.FY))}`, note: "The field along the curve, as a function of t." },
      { math: md`\mathbf{F}(\mathbf{r}(t)) \cdot \mathbf{r}'(t) = ${ptex(w.integrand)}`, note: "Dot product: multiply matching components and add." },
      ...integrateSteps(w.integrand, 0, T),
    ],
  };
  // For a gradient field the work is a difference of potential values (next lesson), which checks the integration independently.
  if (f) problem.verify = [`W = (${evalText(f, B)}) - (${evalText(f, A)})`];
  return problem;
};

const differentialForm: Generator = (r) => {
  const [P, Q] = randomField(r, r.int(0, 3) === 0);
  const kind = r.int(0, 3);
  let X: Poly;
  let Y: Poly;
  let T = 1;
  let desc: string;
  let param: string;
  const reversed = r.int(0, 2) === 0;
  if (kind === 0) {
    T = r.int(1, 2);
    [X, Y] = [term(1, { t: 1 }), term(1, { t: 2 })];
    desc = md`the parabola $y = x^2$`;
    param = md`\mathbf{r}(t) = \langle t, t^2 \rangle`;
  } else if (kind === 1) {
    [X, Y] = [term(1, { t: 2 }), term(1, { t: 1 })];
    desc = md`the parabola $x = y^2$`;
    param = md`\mathbf{r}(t) = \langle t^2, t \rangle`;
  } else if (kind === 2) {
    [X, Y] = [term(1, { t: 1 }), term(1, { t: 3 })];
    desc = md`the curve $y = x^3$`;
    param = md`\mathbf{r}(t) = \langle t, t^3 \rangle`;
  } else {
    const [p, qq] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
    [X, Y] = [term(p, { t: 1 }), term(qq, { t: 1 })];
    desc = "the straight line";
    param = md`\mathbf{r}(t) = \langle ${ptex(X)}, ${ptex(Y)} \rangle`;
  }
  const A = [peval(X, { t: 0 }), peval(Y, { t: 0 })].map(qtext);
  const B = [peval(X, { t: T }), peval(Y, { t: T })].map(qtex);
  const w = work(P, Q, X, Y, 0, T);
  const value = reversed ? qmul(w.value, q(-1)) : w.value;
  const [from, to] = reversed ? [`(${B.join(", ")})`, `(${A.join(", ")})`] : [`(${A.join(", ")})`, `(${B.join(", ")})`];
  return {
    prompt: md`Find $\int_C (${ptex(P)}) \, dx + (${ptex(Q)}) \, dy$, where $C$ runs along ${desc} from $${from}$ to $${to}$. Give an exact fraction.`,
    answer: qtext(value),
    simplified: true,
    hint: md`Parametrize the curve: $${param}$, $0 \le t \le ${T}$, runs from $(${A.join(", ")})$ to $(${B.join(", ")})$. Then $dx = x'(t)\,dt$ and $dy = y'(t)\,dt$.${reversed ? " Your parametrization runs the wrong way, so flip the sign at the end." : ""}`,
    solution: [
      { math: md`${param}, \quad 0 \le t \le ${T}`, note: md`This traces the curve from $(${A.join(", ")})$ to $(${B.join(", ")})$${reversed ? ", the opposite of the direction asked for. Compute with it, then change the sign" : ""}.` },
      { math: md`dx = ${ptex(pderiv(X, "t"))}\,dt, \quad dy = ${ptex(pderiv(Y, "t"))}\,dt`, note: "Differentiate the parametrization." },
      { math: md`P\,dx + Q\,dy = \left(${ptex(w.integrand)}\right) dt`, note: md`Substitute $x = ${ptex(X)}$, $y = ${ptex(Y)}$ into $P$ and $Q$, then multiply by $dx$ and $dy$.` },
      ...integrateSteps(w.integrand, 0, T),
      ...(reversed ? [{ math: md`\int_C P\,dx + Q\,dy = -\left(${qtex(w.value)}\right) = ${qtex(value)}`, note: "Reversing the direction of a curve reverses the sign of a line integral of a vector field." }] : []),
    ],
  };
};

// ── Lesson 3 generators: conservative fields ────────────────────────────────

/** A random polynomial potential with integer coefficients. */
function randomPotential(r: Rng): Poly {
  const [a, b, c] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-4, 4)];
  const list: Poly[] = [
    padd(term(a, { x: 2, y: 1 }), term(b, { y: 3 })),
    padd(term(a, { x: 1, y: 2 }), term(b, { x: 2 })),
    padd(term(a, { x: 3 }), term(b, { x: 1, y: 1 }), term(c, { y: 2 })),
    padd(term(a, { x: 1, y: 1 }), term(b, { x: 1 }), term(c, { y: 2 })),
    padd(term(a, { x: 2, y: 2 }), term(b, { x: 1 })),
    padd(term(a, { x: 3, y: 1 }), term(b, { y: 2 })),
    padd(term(a, { x: 2 }), term(b, { x: 1, y: 1 }), term(c, { y: 1 })),
  ];
  return r.pick(list);
}

const conservativeTest: Generator = (r) => {
  const f = randomPotential(r);
  const P = pderiv(f, "x");
  let Q = pderiv(f, "y");
  const conservative = r.int(0, 1) === 0;
  if (!conservative) {
    const k = r.nonzero(-3, 3);
    // Spoil Q with a term whose x-derivative is not zero, so P_y ≠ Q_x.
    const spoil = r.pick([term(k, { x: 1, y: 1 }), term(k, { x: 2 }), term(k, { x: 1 }), term(k, { x: 1, y: 2 })]);
    Q = padd(Q, spoil);
  }
  const [Py, Qx] = [pderiv(P, "y"), pderiv(Q, "x")];
  const same = pequal(Py, Qx);
  return {
    prompt: md`Is $\mathbf{F} = ${vec(ptex(P), ptex(Q))}$ conservative on the whole plane?`,
    choices: ["Conservative", "Not conservative"],
    accept: [same ? "Conservative" : "Not conservative"],
    hint: md`Compare $\frac{\partial P}{\partial y}$ with $\frac{\partial Q}{\partial x}$. The plane has no holes, so equal partials mean conservative, and unequal partials mean not.`,
    solution: [
      { math: md`\frac{\partial P}{\partial y} = ${ptex(Py)}, \qquad \frac{\partial Q}{\partial x} = ${ptex(Qx)}`, note: md`$P$ is the first component, $Q$ the second.` },
      same
        ? { math: md`\frac{\partial P}{\partial y} = \frac{\partial Q}{\partial x}`, note: md`The partials agree everywhere, and the plane is simply connected, so $\mathbf{F}$ is conservative. (A potential is $f = ${ptex(f)}$: check that $\nabla f = \mathbf{F}$.)` }
        : { math: md`\frac{\partial P}{\partial y} \ne \frac{\partial Q}{\partial x}`, note: md`If $\mathbf{F}$ were $\nabla f$, these would both equal $f_{xy}$ by Clairaut's theorem. They differ, so no potential exists.` },
    ],
  };
};

/** Steps that find a potential for ∇f = ⟨P, Q⟩ by integrating P in x and matching Q. */
function potentialSteps(P: Poly, Q: Poly, f: Poly): Step[] {
  const fx = pint(P, "x");
  const fxy = pderiv(fx, "y");
  const gPrime = psub(Q, fxy);
  const g = pint(gPrime, "y");
  return [
    { math: md`f = \int (${ptex(P)})\,dx = ${ptex(fx)} + g(y)`, note: md`Since $f_x = P$, integrate $P$ with respect to $x$. The "constant" of integration may depend on $y$.` },
    { math: md`f_y = ${ptex(fxy)} + g'(y) = ${ptex(Q)}`, note: md`Differentiate in $y$ and set it equal to $Q$.` },
    { math: md`g'(y) = ${ptex(gPrime)}, \quad g(y) = ${ptex(g)}`, note: md`Everything with an $x$ cancels, as it must for a conservative field. Integrate what's left.` },
    { math: md`f(x, y) = ${ptex(f)}`, note: "Any constant can be added. Check: differentiate in x and in y to recover P and Q." },
  ];
}

const findPotential: Generator = (r) => {
  const f = randomPotential(r);
  const [P, Q] = [pderiv(f, "x"), pderiv(f, "y")];
  return {
    prompt: md`$\mathbf{F} = ${vec(ptex(P), ptex(Q))}$ is conservative. Find a potential function $f(x, y)$ with $\nabla f = \mathbf{F}$. Write it as an expression in $x$ and $y$; any constant may be added.`,
    answer: ptext(f),
    upToConstant: true,
    hint: md`$f_x = ${ptex(P)}$, so start with $f = \int (${ptex(P)})\,dx + g(y)$. Then differentiate in $y$ and compare with $Q$ to find $g$.`,
    solution: potentialSteps(P, Q, f),
  };
};

const ftliWork: Generator = (r) => {
  const f = randomPotential(r);
  const [P, Q] = [pderiv(f, "x"), pderiv(f, "y")];
  const kind = r.int(0, 4);
  let A: [number, number];
  let B: [number, number];
  let desc: string;
  if (kind <= 1) {
    A = [r.int(-2, 2), r.int(-2, 2)];
    do B = [r.int(-3, 3), r.int(-3, 3)];
    while (B[0] === A[0] && B[1] === A[1]);
    desc = md`any path from $(${A[0]}, ${A[1]})$ to $(${B[0]}, ${B[1]})$`;
  } else if (kind === 2) {
    const T = r.int(1, 2);
    A = [0, 0];
    B = [T, T * T];
    desc = md`the parabola $\mathbf{r}(t) = \langle t, t^2 \rangle$ for $0 \le t \le ${T}$`;
  } else if (kind === 3) {
    const R = r.int(1, 3);
    A = [R, 0];
    B = [0, R];
    desc = md`the quarter of the circle $x^2 + y^2 = ${R * R}$ from $(${R}, 0)$ to $(0, ${R})$`;
  } else {
    const R = r.int(1, 3);
    A = [R, 0];
    B = [R, 0];
    desc = md`the circle $x^2 + y^2 = ${R * R}$, traversed once counterclockwise`;
  }
  // The key comes from integrating F directly along the straight segment from A to B; the verify equation uses the potential.
  const X = padd(term(A[0]), term(B[0] - A[0], { t: 1 }));
  const Y = padd(term(A[1]), term(B[1] - A[1], { t: 1 }));
  const value = work(P, Q, X, Y, 0, 1).value;
  const [fA, fB] = [peval(f, { x: A[0], y: A[1] }), peval(f, { x: B[0], y: B[1] })];
  return {
    prompt: md`$\mathbf{F} = ${vec(ptex(P), ptex(Q))}$ is conservative. Find $\int_C ${Fdr}$, where $C$ is ${desc}.`,
    answer: qtext(value),
    simplified: true,
    verify: [`W = (${evalText(f, { x: B[0], y: B[1] })}) - (${evalText(f, { x: A[0], y: A[1] })})`],
    hint: md`Find a potential $f$ with $\nabla f = \mathbf{F}$. By the fundamental theorem for line integrals the answer is $f(\text{end}) - f(\text{start})$; the shape of the path doesn't matter.${kind === 4 ? " Where does this closed curve start and end?" : ""}`,
    solution: [
      ...potentialSteps(P, Q, f).slice(0, 3),
      { math: md`f(x, y) = ${ptex(f)}`, note: md`A potential for $\mathbf{F}$.` },
      kind === 4
        ? { math: md`\int_C ${Fdr} = f(${A[0]}, ${A[1]}) - f(${A[0]}, ${A[1]}) = 0`, note: "A closed curve ends where it starts, so the potential difference is 0. Every conservative field does no net work around a loop." }
        : { math: md`\int_C ${Fdr} = f(${B[0]}, ${B[1]}) - f(${A[0]}, ${A[1]}) = ${parTex(fB)} - ${parTex(fA)} = ${qtex(value)}`, note: "Fundamental theorem for line integrals: evaluate the potential at the endpoints. The path in between is irrelevant." },
    ],
  };
};

// ── Lesson 4 generators: Green's theorem ────────────────────────────────────

/** A field of degree ≤ 2 whose scalar curl Q_x - P_y is affine (degree ≤ 1) and not identically zero. */
function affineCurlField(r: Rng): [Poly, Poly] {
  for (;;) {
    const [a, b] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const P = r.pick([term(a, { y: 2 }), term(a, { x: 1, y: 1 }), term(a, { y: 1 }), term(a, { x: 2 }), term(a, { x: 1 }), term(a, { x: 1, y: 1 })]);
    const Q = r.pick([term(b, { x: 2 }), term(b, { x: 1, y: 1 }), term(b, { x: 1 }), term(b, { y: 2 }), term(b, { y: 1 }), term(b, { x: 1, y: 1 })]);
    const curl = psub(pderiv(Q, "x"), pderiv(P, "y"));
    if (curl.size) return [P, Q];
  }
}

const greenRegion: Generator = (r) => {
  const [P, Q] = affineCurlField(r);
  const [Qx, Py] = [pderiv(Q, "x"), pderiv(P, "y")];
  const g = psub(Qx, Py);
  const triangle = r.int(0, 2) === 0;
  let value: Q;
  let desc: string;
  let setup: Step[];
  let centroid: { x: Q; y: Q };
  let areaText: string;
  if (triangle) {
    const [p, qq] = [r.int(1, 4), r.int(1, 4)];
    const top = padd(term(qq), term(q(-qq, p), { x: 1 }));
    const inner = pdef(g, "y", 0, top);
    value = pconst(pdef(inner, "x", 0, p));
    desc = md`the triangle with vertices $(0, 0)$, $(${p}, 0)$ and $(0, ${qq})$`;
    centroid = { x: q(p, 3), y: q(qq, 3) };
    areaText = qtext(q(p * qq, 2));
    setup = [
      { math: md`\iint_D \left(${ptex(g)}\right) dA = \int_0^{${p}} \int_0^{${ptex(top)}} \left(${ptex(g)}\right) dy\,dx`, note: md`The slanted side is the line from $(${p}, 0)$ to $(0, ${qq})$: $y = ${ptex(top)}$. For each $x$ in $[0, ${p}]$, $y$ runs from 0 up to it.` },
      { math: md`= \int_0^{${p}} \left(${ptex(inner)}\right) dx = ${qtex(value)}`, note: "Inner integral in y, then the outer in x." },
    ];
  } else {
    const [x1, y1] = [r.int(-1, 1), r.int(-1, 1)];
    const [x2, y2] = [x1 + r.int(1, 3), y1 + r.int(1, 3)];
    const inner = pdef(g, "y", y1, y2);
    value = pconst(pdef(inner, "x", x1, x2));
    desc = md`the rectangle $${x1} \le x \le ${x2}$, $${y1} \le y \le ${y2}$`;
    centroid = { x: q(x1 + x2, 2), y: q(y1 + y2, 2) };
    areaText = String((x2 - x1) * (y2 - y1));
    setup = [
      { math: md`\iint_D \left(${ptex(g)}\right) dA = \int_{${x1}}^{${x2}} \int_{${y1}}^{${y2}} \left(${ptex(g)}\right) dy\,dx`, note: "Over a rectangle the bounds are constants." },
      { math: md`= \int_{${x1}}^{${x2}} \left(${ptex(inner)}\right) dx = ${qtex(value)}`, note: "Inner integral in y, then the outer in x." },
    ];
  }
  return {
    prompt: md`Apply Green's theorem to find $\oint_C (${ptex(P)}) \, dx + (${ptex(Q)}) \, dy$, where $C$ is the boundary of ${desc}, traversed counterclockwise. Give an exact fraction.`,
    answer: qtext(value),
    simplified: true,
    // The scalar curl is affine, so its integral over the region is its value at the centroid times the area.
    verify: [`W = (${dText(Q, "x", centroid)} - ${dText(P, "y", centroid)}) * ${areaText}`],
    hint: md`Green's theorem: $\oint_C P\,dx + Q\,dy = \iint_D \left(\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y}\right) dA$. Compute the two partials, then set up the double integral over the region.`,
    solution: [
      { math: md`\frac{\partial Q}{\partial x} = ${ptex(Qx)}, \qquad \frac{\partial P}{\partial y} = ${ptex(Py)}`, note: md`$P = ${ptex(P)}$ multiplies $dx$ and $Q = ${ptex(Q)}$ multiplies $dy$.` },
      { math: md`\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y} = ${ptex(g)}`, note: "The scalar curl: circulation per unit area." },
      ...setup,
      { math: md`\oint_C P\,dx + Q\,dy = ${qtex(value)}`, note: "The curve is traversed counterclockwise, so Green's theorem applies with no sign change." },
    ],
  };
};

const areaByLineIntegral: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [a, b] = [r.int(1, 4), r.int(1, 4)];
    const pt = piText(q(a * b));
    return {
      prompt: md`Find the area enclosed by the ellipse $\mathbf{r}(t) = \langle ${a}\cos t, ${b}\sin t \rangle$, $0 \le t \le 2\pi$, using the line integral $A = \frac{1}{2}\oint_C x\,dy - y\,dx$. Give the exact answer in terms of $\pi$ (type pi).`,
      answer: pt.text,
      simplified: true,
      hint: md`$x = ${a}\cos t$, $y = ${b}\sin t$, so $dx = -${a}\sin t\,dt$ and $dy = ${b}\cos t\,dt$. The integrand collapses using $\cos^2 t + \sin^2 t = 1$.`,
      solution: [
        { math: md`x\,dy - y\,dx = (${a}\cos t)(${b}\cos t)\,dt - (${b}\sin t)(-${a}\sin t)\,dt = ${a * b}(\cos^2 t + \sin^2 t)\,dt = ${a * b}\,dt`, note: "Substitute the parametrization; the Pythagorean identity removes the t-dependence." },
        { math: md`A = \frac{1}{2}\int_0^{2\pi} ${a * b}\,dt = \frac{1}{2} \cdot ${a * b} \cdot 2\pi = ${pt.tex}`, note: md`For a circle ($a = b$) this is the familiar $\pi r^2$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 4);
    const pt = piText(q(3 * a * a, 8));
    const ac = a === 1 ? "" : String(a);
    return {
      prompt: md`Find the area enclosed by the astroid $\mathbf{r}(t) = \langle ${ac}\cos^3 t, ${ac}\sin^3 t \rangle$, $0 \le t \le 2\pi$, using $A = \frac{1}{2}\oint_C x\,dy - y\,dx$. Give the exact answer in terms of $\pi$ (type pi). You may use $\int_0^{2\pi} \sin^2 t \cos^2 t\,dt = \frac{\pi}{4}$.`,
      answer: pt.text,
      simplified: true,
      hint: md`$dx = -3${a === 1 ? "" : a}\cos^2 t \sin t\,dt$ and $dy = 3${a === 1 ? "" : a}\sin^2 t \cos t\,dt$. After substituting, factor out $\sin^2 t \cos^2 t$ and use the identity.`,
      solution: [
        { math: md`x\,dy = ${a}\cos^3 t \cdot 3${a === 1 ? "" : a}\sin^2 t\cos t\,dt = ${3 * a * a}\cos^4 t \sin^2 t\,dt`, note: "Chain rule on sin³ t." },
        { math: md`-y\,dx = ${a}\sin^3 t \cdot 3${a === 1 ? "" : a}\cos^2 t \sin t\,dt = ${3 * a * a}\sin^4 t \cos^2 t\,dt`, note: "The two minus signs cancel." },
        { math: md`x\,dy - y\,dx = ${3 * a * a}\sin^2 t\cos^2 t(\cos^2 t + \sin^2 t)\,dt = ${3 * a * a}\sin^2 t \cos^2 t\,dt`, note: "Factor, then use the Pythagorean identity." },
        { math: md`A = \frac{1}{2} \cdot ${3 * a * a} \cdot \frac{\pi}{4} = ${pt.tex}`, note: md`The given integral finishes it. The astroid encloses $\frac{3}{8}$ of the area of the circle of radius $${a}$ around it.` },
      ],
    };
  }
  let v: [number, number][];
  let twice: number;
  do {
    v = [
      [r.int(-2, 2), r.int(-2, 2)],
      [r.int(-2, 4), r.int(-2, 4)],
      [r.int(-2, 4), r.int(-2, 4)],
    ];
    twice = (v[1]![0] - v[0]![0]) * (v[2]![1] - v[0]![1]) - (v[2]![0] - v[0]![0]) * (v[1]![1] - v[0]![1]);
    if (twice < 0) {
      [v[1], v[2]] = [v[2]!, v[1]!];
      twice = -twice;
    }
  } while (twice === 0);
  const area = q(twice, 2);
  // On an edge from (xi, yi) to (xj, yj): x = xi + (xj - xi)t, dy = (yj - yi)dt, so ∫ x dy = (yj - yi)(xi + xj)/2.
  const edges = [0, 1, 2].map((i) => {
    const [xi, yi] = v[i]!;
    const [xj, yj] = v[(i + 1) % 3]!;
    return { xi, yi, xj, yj, value: q((yj - yi) * (xi + xj), 2) };
  });
  const [p0, p1, p2] = v as [[number, number], [number, number], [number, number]];
  return {
    prompt: md`Find the area of the triangle with vertices $(${p0[0]}, ${p0[1]})$, $(${p1[0]}, ${p1[1]})$ and $(${p2[0]}, ${p2[1]})$ (listed counterclockwise) by computing $\oint_C x\,dy$ around its boundary. Give an exact fraction.`,
    answer: qtext(area),
    simplified: true,
    // Twice the area is the magnitude of the cross product of two edge vectors.
    verify: [`2A = abs((${p1[0] - p0[0]})(${p2[1] - p0[1]}) - (${p2[0] - p0[0]})(${p1[1] - p0[1]}))`],
    hint: md`Do one edge at a time. On the edge from $(x_i, y_i)$ to $(x_j, y_j)$, parametrize $x = x_i + (x_j - x_i)t$, $y = y_i + (y_j - y_i)t$ for $0 \le t \le 1$; then $\int x\,dy = (y_j - y_i)\int_0^1 x\,dt = (y_j - y_i)\frac{x_i + x_j}{2}$.`,
    solution: [
      ...edges.map((e) => ({
        math: md`\text{edge } (${e.xi}, ${e.yi}) \to (${e.xj}, ${e.yj}): \int x\,dy = (${e.yj} - ${parTex(e.yi)}) \cdot \frac{${e.xi} + ${parTex(e.xj)}}{2} = ${qtex(e.value)}`,
        note: md`$dy = (y_j - y_i)\,dt$ is constant on a straight edge, and the average of $x$ along the edge is the midpoint value.`,
      })),
      { math: md`A = \oint_C x\,dy = ${edges.map((e) => parTex(e.value)).join(" + ")} = ${qtex(area)}`, note: md`Green's theorem with $P = 0$, $Q = x$: the integrand $Q_x - P_y = 1$, so the line integral is the area. This is the shoelace formula.` },
    ],
  };
};

const greenDisk: Generator = (r) => {
  const [a, b] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const R = r.int(1, 3);
  const kind = r.int(0, 4);
  const b2 = b === a ? -a : b;
  const fields: [Poly, Poly][] = [
    [term(-a, { y: 1 }), term(a, { x: 1 })],
    [term(a, { y: 1 }), term(b2, { x: 1 })],
    [padd(term(a, { x: 1 }), term(-b, { y: 1 })), padd(term(b, { x: 1 }), term(a, { y: 1 }))],
    [term(-a, { y: 3 }), term(a, { x: 3 })],
    [term(-a, { x: 2, y: 1 }), term(a, { x: 1, y: 2 })],
  ];
  const [P, Q] = fields[kind]!;
  const [Qx, Py] = [pderiv(Q, "x"), pderiv(P, "y")];
  const g = psub(Qx, Py);
  const c0 = g.get(K([0, 0, 0, 0])) ?? q(0);
  const k2 = g.get(K([2, 0, 0, 0])) ?? q(0);
  const constant = kind <= 2;
  // ∬ c0 dA = c0 π R²;  ∬ k(x² + y²) dA = k ∫∫ r² · r dr dθ = k π R⁴ / 2.
  const value = constant ? qmul(c0, q(R * R)) : qmul(k2, q(R ** 4, 2));
  const pt = piText(value);
  const problem: Problem = {
    prompt: md`Apply Green's theorem to find $\oint_C (${ptex(P)}) \, dx + (${ptex(Q)}) \, dy$, where $C$ is the circle $x^2 + y^2 = ${R * R}$ traversed counterclockwise. Give the exact answer in terms of $\pi$ (type pi).`,
    answer: pt.text,
    simplified: true,
    hint: constant
      ? md`Compute $\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y}$. It is a constant here, so the double integral is that constant times the area of the disk.`
      : md`Compute $\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y}$ and write it in terms of $x^2 + y^2 = r^2$. Then integrate in polar coordinates with $dA = r\,dr\,d\theta$.`,
    solution: [
      { math: md`\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y} = ${ptex(Qx)} - (${ptex(Py)}) = ${ptex(g)}`, note: "The scalar curl." },
      constant
        ? { math: md`\oint_C P\,dx + Q\,dy = \iint_D ${ptex(g)}\,dA = ${ptex(g)} \cdot \pi \cdot ${R}^2 = ${pt.tex}`, note: md`A constant integrand: multiply by the area $\pi R^2$ of the disk.` }
        : { math: md`\iint_D ${qtex(k2)}(x^2 + y^2)\,dA = \int_0^{2\pi}\int_0^{${R}} ${qtex(k2)} r^2 \cdot r\,dr\,d\theta = 2\pi \cdot ${qtex(k2)} \cdot \frac{${R}^4}{4} = ${pt.tex}`, note: md`In polar coordinates $x^2 + y^2 = r^2$ and $dA = r\,dr\,d\theta$ (Unit 4).` },
    ],
  };
  // A constant integrand over the disk is its value at the center times the area.
  if (constant) problem.verify = [`W = (${dText(Q, "x", { x: 0, y: 0 })} - ${dText(P, "y", { x: 0, y: 0 })}) * pi * ${R}^2`];
  return problem;
};

// ── Lesson 5 generators: curl and divergence ────────────────────────────────

/** A random polynomial field in space. */
function randomField3(r: Rng): [Poly, Poly, Poly] {
  const [a, b, c] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const list: [Poly, Poly, Poly][] = [
    [term(a, { x: 1, y: 1 }), term(b, { y: 1, z: 1 }), term(c, { x: 1, z: 1 })],
    [term(a, { x: 2 }), term(b, { x: 1, y: 1 }), term(c, { z: 2 })],
    [term(a, { x: 1, z: 1 }), term(b, { y: 2 }), term(c, { y: 1, z: 1 })],
    [term(a, { x: 1, y: 1, z: 1 }), term(b, { y: 1 }), term(c, { x: 1, z: 1 })],
    [term(a, { y: 2 }), term(b, { z: 2 }), term(c, { x: 2 })],
    [padd(term(a, { x: 1 }), term(b, { z: 1 })), term(c, { x: 1, y: 1 }), term(a, { y: 1, z: 1 })],
    [term(a, { y: 1, z: 1 }), term(b, { x: 1, z: 1 }), term(c, { x: 1, y: 1 })],
    [term(a, { x: 2, y: 1 }), term(b, { y: 1, z: 2 }), term(c, { x: 1, y: 1, z: 1 })],
  ];
  return r.pick(list);
}

const curlOf = (P: Poly, Q: Poly, R: Poly): [Poly, Poly, Poly] => [
  psub(pderiv(R, "y"), pderiv(Q, "z")),
  psub(pderiv(P, "z"), pderiv(R, "x")),
  psub(pderiv(Q, "x"), pderiv(P, "y")),
];
const divOf = (P: Poly, Q: Poly, R: Poly) => padd(pderiv(P, "x"), pderiv(Q, "y"), pderiv(R, "z"));

const divergence3D: Generator = (r) => {
  const [P, Q, R] = randomField3(r);
  const D = divOf(P, Q, R);
  const F = vec(ptex(P), ptex(Q), ptex(R));
  const partials = { math: md`\frac{\partial P}{\partial x} = ${ptex(pderiv(P, "x"))}, \quad \frac{\partial Q}{\partial y} = ${ptex(pderiv(Q, "y"))}, \quad \frac{\partial R}{\partial z} = ${ptex(pderiv(R, "z"))}`, note: "Each component is differentiated with respect to its own variable only." };
  if (r.int(0, 1) === 0) {
    const free = pvars(D);
    return {
      prompt: md`Let $\mathbf{F} = ${F}$. Find $\operatorname{div} \mathbf{F} = \nabla \cdot \mathbf{F}$ as an expression in $x$, $y$ and $z$.`,
      answer: ptext(D),
      simplified: true,
      verify: [`D = ${dText(P, "x", FIX, free)} + ${dText(Q, "y", FIX, free)} + ${dText(R, "z", FIX, free)}`],
      hint: md`$\operatorname{div} \mathbf{F} = \frac{\partial P}{\partial x} + \frac{\partial Q}{\partial y} + \frac{\partial R}{\partial z}$: the $x$-derivative of the first component plus the $y$-derivative of the second plus the $z$-derivative of the third.`,
      solution: [partials, { math: md`\operatorname{div} \mathbf{F} = ${ptex(D)}`, note: "Add the three. The result is a scalar function: the net outflow per unit volume at each point." }],
    };
  }
  const pt = { x: r.int(-2, 2), y: r.int(-2, 2), z: r.int(-2, 2) };
  const value = peval(D, pt);
  return {
    prompt: md`Let $\mathbf{F} = ${F}$. Find $\operatorname{div} \mathbf{F}$ at the point $(${pt.x}, ${pt.y}, ${pt.z})$.`,
    answer: qtext(value),
    verify: [`D = ${dText(P, "x", pt)} + ${dText(Q, "y", pt)} + ${dText(R, "z", pt)}`],
    hint: md`First find $\operatorname{div} \mathbf{F} = P_x + Q_y + R_z$ as a function, then substitute the point.`,
    solution: [
      partials,
      { math: md`\operatorname{div} \mathbf{F} = ${ptex(D)}`, note: "Add the three partials." },
      { math: md`\operatorname{div} \mathbf{F}(${pt.x}, ${pt.y}, ${pt.z}) = ${qtex(value)}`, note: value.n > 0 ? "Positive: near this point the field spreads out, like a source." : value.n < 0 ? "Negative: near this point the field converges, like a sink." : "Zero: at this point the field neither spreads nor converges." },
    ],
  };
};

const curl3D: Generator = (r) => {
  const [P, Q, R] = randomField3(r);
  const [C1, C2, C3] = curlOf(P, Q, R);
  const F = vec(ptex(P), ptex(Q), ptex(R));
  const determinant = md`\operatorname{curl} \mathbf{F} = \begin{vmatrix} \mathbf{i} & \mathbf{j} & \mathbf{k} \\ \partial_x & \partial_y & \partial_z \\ P & Q & R \end{vmatrix} = \langle R_y - Q_z,\; P_z - R_x,\; Q_x - P_y \rangle`;
  const components = { math: md`R_y - Q_z = ${ptex(pderiv(R, "y"))} - (${ptex(pderiv(Q, "z"))}), \quad P_z - R_x = ${ptex(pderiv(P, "z"))} - (${ptex(pderiv(R, "x"))}), \quad Q_x - P_y = ${ptex(pderiv(Q, "x"))} - (${ptex(pderiv(P, "y"))})`, note: "Six partial derivatives, paired up." };
  if (r.int(0, 1) === 0) {
    const pt = { x: r.int(-2, 2), y: r.int(-2, 2), z: r.int(-2, 2) };
    const vals = [C1, C2, C3].map((c) => peval(c, pt));
    const S = (c: Poly, v: Var, d: Poly, w: Var) => `(${dText(c, v, pt)} - ${dText(d, w, pt)})`;
    const [s1, s2, s3] = [S(R, "y", Q, "z"), S(P, "z", R, "x"), S(Q, "x", P, "y")];
    return {
      prompt: md`Let $\mathbf{F} = ${F}$. Find $\operatorname{curl} \mathbf{F} = \nabla \times \mathbf{F}$ at the point $(${pt.x}, ${pt.y}, ${pt.z})$. Type it as a vector like <1, -2, 0>.`,
      answer: `(${vals.map(qtext).join(", ")})`,
      form: "tuple",
      verify: [`a + b + c = ${s1} + ${s2} + ${s3}`, `a - b + c = ${s1} - ${s2} + ${s3}`, `a + b - c = ${s1} + ${s2} - ${s3}`],
      hint: md`Expand the determinant: $\operatorname{curl} \mathbf{F} = \langle R_y - Q_z, P_z - R_x, Q_x - P_y \rangle$. Then substitute the point.`,
      solution: [
        { math: determinant, note: "The curl as a symbolic determinant, expanded along the top row." },
        components,
        { math: md`\operatorname{curl} \mathbf{F} = ${vec(ptex(C1), ptex(C2), ptex(C3))}`, note: "Simplify each component." },
        { math: md`\operatorname{curl} \mathbf{F}(${pt.x}, ${pt.y}, ${pt.z}) = ${vec(...vals.map(qtex))}`, note: "Substitute the point. This vector is the axis about which the field spins fastest there, with length twice the angular speed." },
      ],
    };
  }
  const i = r.int(0, 2);
  const comp = [C1, C2, C3][i]!;
  const names = ["\\mathbf{i}", "\\mathbf{j}", "\\mathbf{k}"];
  const formulas = ["R_y - Q_z", "P_z - R_x", "Q_x - P_y"];
  const stencil = [() => `${dText(R, "y", FIX, pvars(comp))} - ${dText(Q, "z", FIX, pvars(comp))}`, () => `${dText(P, "z", FIX, pvars(comp))} - ${dText(R, "x", FIX, pvars(comp))}`, () => `${dText(Q, "x", FIX, pvars(comp))} - ${dText(P, "y", FIX, pvars(comp))}`][i]!;
  return {
    prompt: md`Let $\mathbf{F} = ${F}$. Find the $${names[i]}$-component of $\operatorname{curl} \mathbf{F}$, that is, $${formulas[i]}$, as an expression.`,
    answer: ptext(comp),
    simplified: true,
    verify: [`D = ${stencil()}`],
    hint: md`Only two of the six partials are needed: $${formulas[i]}$. Remember which component is $P$, $Q$ and $R$.`,
    solution: [
      { math: determinant, note: "The curl as a determinant." },
      components,
      { math: md`(\operatorname{curl} \mathbf{F}) \cdot ${names[i]} = ${ptex(comp)}`, note: md`This component measures the circulation density around an axis parallel to $${names[i]}$.` },
    ],
  };
};

const laplacian: Generator = (r) => {
  const [a, b, c] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const list: Poly[] = [
    padd(term(a, { x: 3 }), term(b, { x: 1, y: 2 })),
    padd(term(a, { x: 2, y: 1 }), term(b, { y: 3 })),
    padd(term(a, { x: 2 }), term(b, { y: 2 }), term(c, { x: 1, y: 1 })),
    padd(term(a, { x: 1, y: 1, z: 1 }), term(b, { z: 3 })),
    padd(term(a, { x: 2, z: 1 }), term(b, { x: 1, y: 2 }), term(c, { z: 2 })),
    padd(term(a, { x: 3 }), term(b, { y: 2, z: 1 }), term(c, { x: 1, y: 1 })),
  ];
  const f = r.pick(list);
  const parts = (["x", "y", "z"] as Var[]).map((v) => pderiv(pderiv(f, v), v));
  const L = padd(...parts);
  const hasZ = pvars(f).has("z");
  const free = pvars(L);
  const vars = hasZ ? "x, y, z" : "x, y";
  const formula = hasZ ? "f_{xx} + f_{yy} + f_{zz}" : "f_{xx} + f_{yy}";
  return {
    prompt: md`Find the Laplacian $\nabla^2 f = \operatorname{div}(\nabla f) = ${formula}$ of $f(${vars}) = ${ptex(f)}$.`,
    answer: ptext(L),
    simplified: true,
    verify: [`L = ${d2Text(f, "x", FIX, free)} + ${d2Text(f, "y", FIX, free)}${hasZ ? ` + ${d2Text(f, "z", FIX, free)}` : ""}`],
    hint: md`Differentiate twice in $x$, twice in $y$${hasZ ? ", twice in $z$" : ""}, and add. Mixed partials don't appear.`,
    solution: [
      { math: md`\nabla f = ${vec(...(hasZ ? (["x", "y", "z"] as Var[]) : (["x", "y"] as Var[])).map((v) => ptex(pderiv(f, v))))}`, note: "The gradient first." },
      { math: md`f_{xx} = ${ptex(parts[0]!)}, \quad f_{yy} = ${ptex(parts[1]!)}${hasZ ? md`, \quad f_{zz} = ${ptex(parts[2]!)}` : ""}`, note: "Differentiate each gradient component with respect to its own variable: that is the divergence of the gradient." },
      { math: md`\nabla^2 f = ${ptex(L)}`, note: L.size === 0 ? "The Laplacian is 0: f is harmonic." : "Add them up." },
    ],
  };
};

// ── Lesson 6 generators: surface integrals ──────────────────────────────────

const surfaceArea: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0 || kind === 1) {
    const R = r.int(1, 5);
    const hemi = kind === 1;
    const pt = piText(q((hemi ? 2 : 4) * R * R));
    return {
      prompt: md`Find the surface area of the ${hemi ? `hemisphere $x^2 + y^2 + z^2 = ${R * R}$, $z \ge 0$` : `sphere $x^2 + y^2 + z^2 = ${R * R}$`}. Give the exact answer in terms of $\pi$ (type pi).`,
      answer: pt.text,
      simplified: true,
      hint: md`Parametrize by spherical angles: $\mathbf{r}(\phi, \theta) = \langle ${R}\sin\phi\cos\theta, ${R}\sin\phi\sin\theta, ${R}\cos\phi \rangle$, with $|\mathbf{r}_\phi \times \mathbf{r}_\theta| = ${R * R}\sin\phi$.${hemi ? " The hemisphere has $0 \\le \\phi \\le \\pi/2$." : ""}`,
      solution: [
        { math: md`|\mathbf{r}_\phi \times \mathbf{r}_\theta| = ${R}^2 \sin\phi`, note: "The area element of a sphere, derived in the lesson." },
        { math: md`A = \int_0^{2\pi} \int_0^{${hemi ? "\\pi/2" : "\\pi"}} ${R * R}\sin\phi \,d\phi\,d\theta = 2\pi \cdot ${R * R} \cdot ${hemi ? 1 : 2} = ${pt.tex}`, note: md`$\int_0^{${hemi ? "\\pi/2" : "\\pi"}} \sin\phi\,d\phi = ${hemi ? 1 : 2}$.` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(1, 2);
    const R = r.int(1, 3);
    const h = k * R;
    const m = 1 + k * k;
    const pt = piText(q(R * R), m);
    return {
      prompt: md`Find the surface area of the cone $z = ${k === 1 ? "" : k}\sqrt{x^2 + y^2}$ for $0 \le z \le ${h}$. Give the exact answer in terms of $\pi$ (type pi), with any radical simplified.`,
      answer: pt.text,
      simplified: true,
      hint: md`Write $g(x, y) = ${k === 1 ? "" : k}\sqrt{x^2 + y^2}$ and use $dS = \sqrt{1 + g_x^2 + g_y^2}\,dA$. The square root turns out to be constant, and the shadow is the disk of radius ${R}.`,
      solution: [
        { math: md`g_x = \frac{${k}x}{\sqrt{x^2 + y^2}}, \quad g_y = \frac{${k}y}{\sqrt{x^2 + y^2}}, \quad 1 + g_x^2 + g_y^2 = 1 + ${k * k}\,\frac{x^2 + y^2}{x^2 + y^2} = ${m}`, note: "The slope of a cone is the same everywhere, so the area factor is constant." },
        { math: md`A = \iint_D \sqrt{${m}}\,dA = \sqrt{${m}} \cdot \pi \cdot ${R}^2 = ${pt.tex}`, note: md`The shadow $D$ is the disk $x^2 + y^2 \le ${R * R}$, since $z = ${h}$ when $\sqrt{x^2 + y^2} = ${R}$.` },
      ],
    };
  }
  if (kind === 3) {
    const [h, s] = r.pick<[number, number]>([
      [2, 3],
      [6, 5],
      [12, 7],
    ]);
    const value = q(s ** 3 - 1, 6);
    const pt = piText(value);
    return {
      prompt: md`Find the surface area of the part of the paraboloid $z = x^2 + y^2$ below the plane $z = ${h}$. Give the exact answer in terms of $\pi$ (type pi).`,
      answer: pt.text,
      simplified: true,
      hint: md`$dS = \sqrt{1 + 4x^2 + 4y^2}\,dA$ over the disk $x^2 + y^2 \le ${h}$. Switch to polar coordinates and substitute $u = 1 + 4r^2$.`,
      solution: [
        { math: md`g_x = 2x, \quad g_y = 2y, \quad dS = \sqrt{1 + 4x^2 + 4y^2}\,dA = \sqrt{1 + 4r^2}\,r\,dr\,d\theta`, note: md`The shadow is the disk of radius $\sqrt{${h}}$.` },
        { math: md`A = \int_0^{2\pi}\int_0^{\sqrt{${h}}} r\sqrt{1 + 4r^2}\,dr\,d\theta = 2\pi \left[\frac{(1 + 4r^2)^{3/2}}{12}\right]_0^{\sqrt{${h}}}`, note: md`With $u = 1 + 4r^2$, $du = 8r\,dr$, so $\int r\sqrt{1 + 4r^2}\,dr = \frac{1}{8} \cdot \frac{2}{3}u^{3/2}$.` },
        { math: md`= \frac{2\pi}{12}\left(${s * s}^{3/2} - 1\right) = \frac{\pi}{6}(${s ** 3} - 1) = ${pt.tex}`, note: md`$1 + 4 \cdot ${h} = ${s * s}$, and $${s * s}^{3/2} = ${s}^3 = ${s ** 3}$.` },
      ],
    };
  }
  if (kind === 4) {
    const [a, b] = [r.int(0, 3), r.int(1, 3)];
    const [p, qq] = [r.int(1, 4), r.int(1, 4)];
    const m = 1 + a * a + b * b;
    const rt = root(m);
    const total = p * qq * rt.k;
    const plane = padd(term(a, { x: 1 }), term(b, { y: 1 }), term(r.int(0, 3)));
    const text = rt.m === 1 ? String(total) : total === 1 ? `sqrt(${rt.m})` : `${total}sqrt(${rt.m})`;
    const tex = rt.m === 1 ? String(total) : total === 1 ? `\\sqrt{${rt.m}}` : `${total}\\sqrt{${rt.m}}`;
    return {
      prompt: md`Find the area of the part of the plane $z = ${ptex(plane)}$ that lies above the rectangle $0 \le x \le ${p}$, $0 \le y \le ${qq}$. Give an exact value, with any radical simplified.`,
      answer: text,
      simplified: true,
      hint: md`For a graph $z = g(x, y)$, $dS = \sqrt{1 + g_x^2 + g_y^2}\,dA$. For a plane the partials are constants.`,
      solution: [
        { math: md`g_x = ${a}, \quad g_y = ${b}, \quad dS = \sqrt{1 + ${a}^2 + ${b}^2}\,dA = \sqrt{${m}}\,dA`, note: "A tilted plane stretches every patch of its shadow by the same factor." },
        { math: md`A = \sqrt{${m}} \cdot (\text{area of the rectangle}) = \sqrt{${m}} \cdot ${p * qq} = ${tex}`, note: "The constant in the integral is being held." },
      ],
    };
  }
  const R = r.int(1, 4);
  const h = r.int(1, 5);
  const pt = piText(q(2 * R * h));
  return {
    prompt: md`Find the area of the curved side of the cylinder $x^2 + y^2 = ${R * R}$ for $0 \le z \le ${h}$ (not counting the top and bottom). Give the exact answer in terms of $\pi$ (type pi).`,
    answer: pt.text,
    simplified: true,
    hint: md`Parametrize by angle and height: $\mathbf{r}(\theta, z) = \langle ${R}\cos\theta, ${R}\sin\theta, z \rangle$. Find $|\mathbf{r}_\theta \times \mathbf{r}_z|$.`,
    solution: [
      { math: md`\mathbf{r}_\theta = \langle -${R}\sin\theta, ${R}\cos\theta, 0 \rangle, \quad \mathbf{r}_z = \langle 0, 0, 1 \rangle, \quad \mathbf{r}_\theta \times \mathbf{r}_z = \langle ${R}\cos\theta, ${R}\sin\theta, 0 \rangle`, note: "The normal points straight out from the axis, as it should." },
      { math: md`|\mathbf{r}_\theta \times \mathbf{r}_z| = ${R}, \quad A = \int_0^{${h}}\int_0^{2\pi} ${R}\,d\theta\,dz = ${pt.tex}`, note: md`Unrolled, the side is a $2\pi R$ by $h$ rectangle.` },
    ],
  };
};

/** A random field in space whose components are affine. */
function affineField3(r: Rng): [Poly, Poly, Poly] {
  const [a, b, c] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const list: [Poly, Poly, Poly][] = [
    [term(1, { x: 1 }), term(1, { y: 1 }), term(1, { z: 1 })],
    [term(a, { y: 1 }), term(b, { x: 1 }), term(c)],
    [term(a, { z: 1 }), term(0), term(b, { x: 1 })],
    [term(a), term(b), term(c)],
    [term(a, { y: 1 }), term(b, { z: 1 }), term(c, { x: 1 })],
    [term(a, { x: 1 }), term(b, { y: 1 }), term(c, { z: 1 })],
    [padd(term(a, { x: 1 }), term(b)), term(c, { z: 1 }), term(a, { y: 1 })],
  ];
  return r.pick(list);
}

const fluxPlanePiece: Generator = (r) => {
  const [a, b, c] = [r.int(-2, 2), r.int(-2, 2), r.int(0, 3)];
  const [p, qq] = [r.int(1, 4), r.int(1, 4)];
  const [P, Q, R] = affineField3(r);
  const plane = padd(term(a, { x: 1 }), term(b, { y: 1 }), term(c));
  const onS = (f: Poly) => psubst(f, "z", plane);
  // Upward normal of a graph: ⟨-g_x, -g_y, 1⟩, so F·n dS = (-a P - b Q + R) dA.
  const h = padd(pscale(onS(P), -a), pscale(onS(Q), -b), onS(R));
  const inner = pdef(h, "y", 0, qq);
  const value = pconst(pdef(inner, "x", 0, p));
  const centre = { x: q(p, 2), y: q(qq, 2), z: peval(plane, { x: q(p, 2), y: q(qq, 2) }) };
  return {
    prompt: md`Let $S$ be the part of the plane $z = ${ptex(plane)}$ above the rectangle $0 \le x \le ${p}$, $0 \le y \le ${qq}$, with upward normal. Find the flux $\iint_S ${FdS}$ of $\mathbf{F} = ${vec(ptex(P), ptex(Q), ptex(R))}$ through $S$. Give an exact fraction.`,
    answer: qtext(value),
    simplified: true,
    // F·n is affine on the flat piece, so the flux is its value at the centre of the rectangle times the area.
    verify: [`N = (-(${a})*(${evalText(P, centre)}) - (${b})*(${evalText(Q, centre)}) + (${evalText(R, centre)})) * ${p * qq}`],
    hint: md`For a graph $z = g(x, y)$ with upward normal, $\iint_S ${FdS} = \iint_D \left(-P\,g_x - Q\,g_y + R\right) dA$, with $z = g(x, y)$ substituted into $P$, $Q$, $R$. Here $g_x = ${a}$ and $g_y = ${b}$.`,
    solution: [
      { math: md`\mathbf{r}_x \times \mathbf{r}_y = \langle -g_x, -g_y, 1 \rangle = ${vec(-a, -b, 1)}`, note: md`For $\mathbf{r}(x, y) = \langle x, y, g(x, y) \rangle$. The $z$-component is positive, so this is the upward normal.` },
      { math: md`\mathbf{F} \cdot (\mathbf{r}_x \times \mathbf{r}_y) = ${parTex(-a)}(${ptex(onS(P))}) + ${parTex(-b)}(${ptex(onS(Q))}) + (${ptex(onS(R))}) = ${ptex(h)}`, note: md`With $z = ${ptex(plane)}$ substituted, everything is in terms of $x$ and $y$.` },
      { math: md`\iint_S ${FdS} = \int_0^{${p}}\int_0^{${qq}} \left(${ptex(h)}\right) dy\,dx = \int_0^{${p}} \left(${ptex(inner)}\right) dx = ${qtex(value)}`, note: "Integrate over the shadow rectangle. No square root appears: the normal's length cancels the area factor." },
    ],
  };
};

const normalVector: Generator = (r) => {
  const [a, b] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const g = r.pick([
    padd(term(a, { x: 2 }), term(b, { y: 2 })),
    padd(term(a, { x: 1, y: 1 }), term(b, { x: 1 })),
    term(a, { x: 2, y: 1 }),
    padd(term(a, { x: 3 }), term(b, { y: 1 })),
    padd(term(a, { x: 1, y: 2 }), term(b, { y: 1 })),
  ]);
  const pt = { x: r.int(-2, 2), y: r.int(-2, 2) };
  const [gx, gy] = [pderiv(g, "x"), pderiv(g, "y")];
  const [gx0, gy0] = [peval(gx, pt), peval(gy, pt)];
  const [sx, sy] = [dText(g, "x", pt), dText(g, "y", pt)];
  return {
    prompt: md`The surface $S$ is the graph $z = ${ptex(g)}$, parametrized by $\mathbf{r}(x, y) = \langle x, y, ${ptex(g)} \rangle$. Find the normal vector $\mathbf{r}_x \times \mathbf{r}_y$ at the point of $S$ above $(x, y) = (${pt.x}, ${pt.y})$. Type it as a vector like <1, -2, 1>.`,
    answer: `(${qtext(qmul(gx0, q(-1)))}, ${qtext(qmul(gy0, q(-1)))}, 1)`,
    form: "tuple",
    // The normal is perpendicular to both tangent vectors ⟨1, 0, g_x⟩ and ⟨0, 1, g_y⟩, and its length is given by Lagrange's identity.
    verify: [`1 a + 0 b + (${sx}) c = 0`, `0 a + 1 b + (${sy}) c = 0`, `a^2 + b^2 + c^2 = (1 + (${sx})^2)(1 + (${sy})^2) - ((${sx})(${sy}))^2`],
    hint: md`$\mathbf{r}_x = \langle 1, 0, g_x \rangle$ and $\mathbf{r}_y = \langle 0, 1, g_y \rangle$. Their cross product is $\langle -g_x, -g_y, 1 \rangle$; evaluate the partials at the point.`,
    solution: [
      { math: md`\mathbf{r}_x = \langle 1, 0, ${ptex(gx)} \rangle, \quad \mathbf{r}_y = \langle 0, 1, ${ptex(gy)} \rangle`, note: "Partial derivatives of the parametrization: the tangent vectors along the x- and y-grid lines." },
      { math: md`\mathbf{r}_x \times \mathbf{r}_y = \langle 0 \cdot g_y - g_x \cdot 1,\; g_x \cdot 0 - 1 \cdot g_y,\; 1 \cdot 1 - 0 \rangle = \langle -g_x, -g_y, 1 \rangle`, note: "The cross product, by the determinant rule." },
      { math: md`g_x(${pt.x}, ${pt.y}) = ${qtex(gx0)}, \quad g_y(${pt.x}, ${pt.y}) = ${qtex(gy0)}`, note: "Evaluate at the point." },
      { math: md`\mathbf{r}_x \times \mathbf{r}_y = ${vec(qtex(qmul(gx0, q(-1))), qtex(qmul(gy0, q(-1))), 1)}`, note: "The upward normal: its z-component is positive. The surface element there is this vector's length times dA." },
    ],
  };
};

// ── Lesson 7 generators: Stokes' theorem ────────────────────────────────────

/** A field in space whose curl has an affine k-component, with z appearing in P or Q. */
function affineKCurlField(r: Rng): [Poly, Poly, Poly] {
  for (;;) {
    const [a, b, c] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const P = r.pick([term(a, { y: 2 }), term(a, { y: 1, z: 1 }), term(a, { y: 1 }), term(a, { z: 2 }), term(a, { x: 1, y: 1 }), padd(term(a, { y: 1 }), term(c, { z: 1 }))]);
    const Q = r.pick([term(b, { x: 2 }), term(b, { x: 1, z: 1 }), term(b, { x: 1 }), term(b, { z: 1 }), term(b, { x: 1, y: 1 }), padd(term(b, { x: 1 }), term(c, { z: 2 }))]);
    const R = r.pick([term(c, { x: 1, z: 1 }), term(c, { y: 1 }), term(c, { x: 1, y: 1 }), term(0), term(c, { z: 2 })]);
    if (psub(pderiv(Q, "x"), pderiv(P, "y")).size) return [P, Q, R];
  }
}

const stokesFlat: Generator = (r) => {
  const [P, Q, R] = affineKCurlField(r);
  const [C1, C2, C3] = curlOf(P, Q, R);
  const h = r.int(0, 3);
  const g = at(C3, "z", h);
  const kind = r.int(0, 2);
  let desc: string;
  let value: Q;
  let answer: string;
  let answerTex: string;
  let areaText: string;
  let centre: { x: Q; y: Q; z: number };
  let integrate: Step;
  let format: string;
  if (kind === 0) {
    const [p, qq] = [r.int(1, 3), r.int(1, 3)];
    desc = md`the boundary of the rectangle $0 \le x \le ${p}$, $0 \le y \le ${qq}$ in the plane $z = ${h}$`;
    const inner = pdef(g, "y", 0, qq);
    value = pconst(pdef(inner, "x", 0, p));
    [answer, answerTex] = [qtext(value), qtex(value)];
    areaText = String(p * qq);
    centre = { x: q(p, 2), y: q(qq, 2), z: h };
    integrate = { math: md`\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S} = \int_0^{${p}}\int_0^{${qq}} \left(${ptex(g)}\right) dy\,dx = \int_0^{${p}} \left(${ptex(inner)}\right) dx = ${answerTex}`, note: "A double integral over the rectangle." };
    format = "Give an exact fraction.";
  } else if (kind === 1) {
    const [p, qq] = [r.int(1, 4), r.int(1, 4)];
    desc = md`the triangle with vertices $(0, 0, ${h})$, $(${p}, 0, ${h})$ and $(0, ${qq}, ${h})$`;
    const top = padd(term(qq), term(q(-qq, p), { x: 1 }));
    const inner = pdef(g, "y", 0, top);
    value = pconst(pdef(inner, "x", 0, p));
    [answer, answerTex] = [qtext(value), qtex(value)];
    areaText = qtext(q(p * qq, 2));
    centre = { x: q(p, 3), y: q(qq, 3), z: h };
    integrate = { math: md`\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S} = \int_0^{${p}}\int_0^{${ptex(top)}} \left(${ptex(g)}\right) dy\,dx = \int_0^{${p}} \left(${ptex(inner)}\right) dx = ${answerTex}`, note: md`The slanted edge is $y = ${ptex(top)}$.` };
    format = "Give an exact fraction.";
  } else {
    const Rr = r.int(1, 3);
    desc = md`the circle $x^2 + y^2 = ${Rr * Rr}$ in the plane $z = ${h}$`;
    // g is affine, so its integral over the disk is its value at the centre times the area.
    const c0 = peval(g, { x: 0, y: 0 });
    value = qmul(c0, q(Rr * Rr));
    const pt = piText(value);
    [answer, answerTex] = [pt.text, pt.tex];
    areaText = `pi * ${Rr}^2`;
    centre = { x: q(0), y: q(0), z: h };
    integrate = { math: md`\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S} = \iint_D \left(${ptex(g)}\right) dA = ${qtex(c0)} \cdot \pi \cdot ${Rr}^2 = ${answerTex}`, note: g.size <= 1 ? "A constant integrand: multiply by the area of the disk." : md`The terms with $x$ or $y$ integrate to 0 over the disk by symmetry (the disk is centred at the origin), leaving the constant term ${qtex(c0)} times the area $\pi \cdot ${Rr}^2$.` };
    format = "Give the exact answer in terms of $\\pi$ (type pi).";
  }
  return {
    prompt: md`Let $\mathbf{F} = ${vec(ptex(P), ptex(Q), ptex(R))}$ and let $C$ be ${desc}, oriented counterclockwise when seen from above. Use Stokes' theorem to find $\oint_C ${Fdr}$. ${format}`,
    answer,
    simplified: true,
    verify: [`W = (${dText(Q, "x", centre)} - ${dText(P, "y", centre)}) * ${areaText}`],
    hint: md`Take $S$ to be the flat region inside $C$ in the plane $z = ${h}$, with upward normal $\mathbf{k}$. Then $\operatorname{curl}\mathbf{F} \cdot \mathbf{k} = Q_x - P_y$; substitute $z = ${h}$ and integrate over the region.`,
    solution: [
      { math: md`\operatorname{curl}\mathbf{F} = ${vec(ptex(C1), ptex(C2), ptex(C3))}`, note: md`$\langle R_y - Q_z, P_z - R_x, Q_x - P_y \rangle$.` },
      { math: pvars(C3).has("z") ? md`\operatorname{curl}\mathbf{F} \cdot \mathbf{k} = ${ptex(C3)} = ${ptex(g)} \text{ on } z = ${h}` : md`\operatorname{curl}\mathbf{F} \cdot \mathbf{k} = ${ptex(C3)}`, note: "The flat surface has normal k (upward, matching the counterclockwise orientation by the right-hand rule), so only the k-component of the curl matters." },
      integrate,
      { math: md`\oint_C ${Fdr} = ${answerTex}`, note: "By Stokes' theorem the circulation equals the flux of the curl through the flat surface." },
    ],
  };
};

const stokesTilted: Generator = (r) => {
  // Affine components give a constant curl.
  const coef = () => r.int(-3, 3);
  let P: Poly;
  let Q: Poly;
  let R: Poly;
  let G: [Poly, Poly, Poly];
  do {
    P = padd(term(coef(), { y: 1 }), term(coef(), { z: 1 }));
    Q = padd(term(coef(), { x: 1 }), term(coef(), { z: 1 }));
    R = padd(term(coef(), { x: 1 }), term(coef(), { y: 1 }));
    G = curlOf(P, Q, R);
  } while (G.every((c) => c.size === 0) || P.size === 0 || Q.size === 0 || R.size === 0);
  const Gv = G.map((c) => pconst(c));
  const [p, qq, s] = [r.int(1, 4), r.int(1, 4), r.int(1, 4)];
  // (B - A) × (C - A) for A = (p, 0, 0), B = (0, q, 0), C = (0, 0, s) is ⟨qs, ps, pq⟩.
  const N = [q(qq * s, 2), q(p * s, 2), q(p * qq, 2)];
  const value = N.reduce((sum, n, i) => qadd(sum, qmul(n, Gv[i]!)), q(0));
  const stencils = [`(${dText(R, "y")} - ${dText(Q, "z")})`, `(${dText(P, "z")} - ${dText(R, "x")})`, `(${dText(Q, "x")} - ${dText(P, "y")})`];
  return {
    prompt: md`Let $\mathbf{F} = ${vec(ptex(P), ptex(Q), ptex(R))}$ and let $C$ be the triangle with vertices $A = (${p}, 0, 0)$, $B = (0, ${qq}, 0)$ and $D = (0, 0, ${s})$, traversed $A \to B \to D \to A$. Use Stokes' theorem to find $\oint_C ${Fdr}$. Give an exact fraction.`,
    answer: qtext(value),
    simplified: true,
    // Flux of the constant curl through the flat triangle: curl F dotted with the area vector ½(B - A) × (D - A).
    verify: [`W = ${stencils[0]} * (${qtext(N[0]!)}) + ${stencils[1]} * (${qtext(N[1]!)}) + ${stencils[2]} * (${qtext(N[2]!)})`],
    hint: md`The curl is a constant vector. The flux of a constant vector $\mathbf{G}$ through a flat triangle is $\mathbf{G} \cdot \mathbf{N}$ where $\mathbf{N} = \frac{1}{2}(B - A) \times (D - A)$ is the area vector; this cross product also gives the orientation that matches $A \to B \to D$.`,
    solution: [
      { math: md`\operatorname{curl}\mathbf{F} = ${vec(...Gv.map(qtex))}`, note: "Every component of F is linear, so each partial derivative is a constant." },
      { math: md`B - A = ${vec(-p, qq, 0)}, \quad D - A = ${vec(-p, 0, s)}, \quad (B - A) \times (D - A) = ${vec(qq * s, p * s, p * qq)}`, note: "Two edges from A, and their cross product. Walking A to B to D with this normal pointing at you, the triangle is on your left, so it is the right orientation (right-hand rule)." },
      { math: md`\mathbf{N} = \tfrac{1}{2}(B - A) \times (D - A) = ${vec(...N.map(qtex))}`, note: "Half the cross product: a vector normal to the triangle whose length is its area." },
      { math: md`\oint_C ${Fdr} = \iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S} = \operatorname{curl}\mathbf{F} \cdot \mathbf{N} = ${qtex(value)}`, note: "For a constant vector the flux through a flat surface is the dot product with the area vector." },
    ],
  };
};

const stokesSwap: Generator = (r) => {
  const [P, Q, R] = affineKCurlField(r);
  const [C1, C2, C3] = curlOf(P, Q, R);
  const Rr = r.int(1, 3);
  const cap = r.int(0, 1) === 0;
  const desc = cap ? md`paraboloid cap $z = ${Rr * Rr} - x^2 - y^2$, $z \ge 0$` : md`hemisphere $x^2 + y^2 + z^2 = ${Rr * Rr}$, $z \ge 0$`;
  const g = at(C3, "z", 0);
  const c0 = peval(g, { x: 0, y: 0 });
  const value = qmul(c0, q(Rr * Rr));
  const pt = piText(value);
  return {
    prompt: md`Let $\mathbf{F} = ${vec(ptex(P), ptex(Q), ptex(R))}$ and let $S$ be the ${desc}, with upward normal. Find $\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S}$. Give the exact answer in terms of $\pi$ (type pi).`,
    answer: pt.text,
    simplified: true,
    verify: [`N = (${dText(Q, "x", { x: 0, y: 0, z: 0 })} - ${dText(P, "y", { x: 0, y: 0, z: 0 })}) * pi * ${Rr}^2`],
    hint: md`Don't integrate over the curved surface. Its boundary is the circle $x^2 + y^2 = ${Rr * Rr}$ in the plane $z = 0$, and the flat disk $D$ inside that circle has the same boundary. By Stokes' theorem both surfaces give the same flux of the curl.`,
    solution: [
      { math: md`\partial S: \; x^2 + y^2 = ${Rr * Rr}, \; z = 0`, note: md`Where the surface meets the plane $z = 0$. The upward normal on $S$ matches the counterclockwise direction on this circle.` },
      { math: md`\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S} = \oint_{\partial S} ${Fdr} = \iint_D \operatorname{curl}\mathbf{F} \cdot \mathbf{k}\,dA`, note: md`Stokes twice: once for $S$, once for the flat disk $D$ with normal $\mathbf{k}$, which has the same oriented boundary.` },
      { math: md`\operatorname{curl}\mathbf{F} = ${vec(ptex(C1), ptex(C2), ptex(C3))}, \quad \operatorname{curl}\mathbf{F} \cdot \mathbf{k} = ${ptex(g)}${pvars(C3).has("z") ? md` \text{ on } z = 0` : ""}`, note: "Only the k-component is needed, with z = 0 on the disk." },
      { math: md`\iint_D \left(${ptex(g)}\right) dA = ${qtex(c0)} \cdot \pi \cdot ${Rr}^2 = ${pt.tex}`, note: g.size <= 1 ? "A constant times the area of the disk." : md`Terms with $x$ or $y$ integrate to 0 over a disk centred at the origin, by symmetry. The constant ${qtex(c0)} times the area remains.` },
    ],
  };
};

// ── Lesson 8 generators: the divergence theorem ─────────────────────────────

/** A field in space whose divergence is affine and not identically zero. */
function affineDivField(r: Rng): [Poly, Poly, Poly] {
  for (;;) {
    const [a, b, c] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const P = r.pick([term(a, { x: 2 }), term(a, { x: 1, y: 1 }), term(a, { x: 1 }), term(a, { y: 1, z: 1 }), term(a, { z: 1 }), term(a, { x: 1, z: 1 })]);
    const Q = r.pick([term(b, { y: 2 }), term(b, { x: 1, y: 1 }), term(b, { y: 1 }), term(b, { x: 1, z: 1 }), term(b, { y: 1, z: 1 }), term(b, { x: 1 })]);
    const R = r.pick([term(c, { z: 2 }), term(c, { x: 1, z: 1 }), term(c, { z: 1 }), term(c, { x: 1, y: 1 }), term(c, { y: 1, z: 1 }), term(c, { y: 1 })]);
    if (divOf(P, Q, R).size) return [P, Q, R];
  }
}

const fluxBox: Generator = (r) => {
  const [P, Q, R] = affineDivField(r);
  const D = divOf(P, Q, R);
  const [p, qq, s] = [r.int(1, 3), r.int(1, 3), r.int(1, 3)];
  const inZ = pdef(D, "z", 0, s);
  const inY = pdef(inZ, "y", 0, qq);
  const value = pconst(pdef(inY, "x", 0, p));
  const centre = { x: q(p, 2), y: q(qq, 2), z: q(s, 2) };
  return {
    prompt: md`Let $\mathbf{F} = ${vec(ptex(P), ptex(Q), ptex(R))}$. Use the divergence theorem to find the outward flux of $\mathbf{F}$ through the surface of the box $0 \le x \le ${p}$, $0 \le y \le ${qq}$, $0 \le z \le ${s}$. Give an exact fraction.`,
    answer: qtext(value),
    simplified: true,
    // The divergence is affine, so its integral over the box is its value at the centre times the volume.
    verify: [`N = (${dText(P, "x", centre)} + ${dText(Q, "y", centre)} + ${dText(R, "z", centre)}) * ${p * qq * s}`],
    hint: md`$\iint_S ${FdS} = \iiint_E \operatorname{div}\mathbf{F}\,dV$. Find $\operatorname{div}\mathbf{F} = P_x + Q_y + R_z$ and integrate it over the box.`,
    solution: [
      { math: md`\operatorname{div}\mathbf{F} = ${ptex(pderiv(P, "x"))} + (${ptex(pderiv(Q, "y"))}) + (${ptex(pderiv(R, "z"))}) = ${ptex(D)}`, note: "Each component differentiated with respect to its own variable." },
      { math: md`\iiint_E \operatorname{div}\mathbf{F}\,dV = \int_0^{${p}}\int_0^{${qq}}\int_0^{${s}} \left(${ptex(D)}\right) dz\,dy\,dx`, note: "Constant bounds over a box." },
      { math: md`= \int_0^{${p}}\int_0^{${qq}} \left(${ptex(inZ)}\right) dy\,dx = \int_0^{${p}} \left(${ptex(inY)}\right) dx = ${qtex(value)}`, note: "Inside out: z, then y, then x." },
      { math: md`\iint_S ${FdS} = ${qtex(value)}`, note: "The total outward flux through all six faces, without touching a single face." },
    ],
  };
};

const fluxSphere: Generator = (r) => {
  const Rr = r.int(1, 3);
  const kind = r.int(0, 3);
  if (kind === 3) {
    const k = r.int(1, 3);
    const value = q(12 * k * Rr ** 5, 5);
    const pt = piText(value);
    const kt = k === 1 ? "" : String(k);
    return {
      prompt: md`Let $\mathbf{F} = ${vec(`${kt}x^3`, `${kt}y^3`, `${kt}z^3`)}$. Find the outward flux of $\mathbf{F}$ through the sphere $x^2 + y^2 + z^2 = ${Rr * Rr}$. Give the exact answer in terms of $\pi$ (type pi).`,
      answer: pt.text,
      simplified: true,
      hint: md`$\operatorname{div}\mathbf{F} = ${3 * k}(x^2 + y^2 + z^2) = ${3 * k}\rho^2$. Integrate over the ball in spherical coordinates, with $dV = \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$.`,
      solution: [
        { math: md`\operatorname{div}\mathbf{F} = ${3 * k}x^2 + ${3 * k}y^2 + ${3 * k}z^2 = ${3 * k}\rho^2`, note: "Not constant, so the sphere's symmetry is the way in: use spherical coordinates." },
        { math: md`\iiint_E ${3 * k}\rho^2\,dV = \int_0^{2\pi}\int_0^{\pi}\int_0^{${Rr}} ${3 * k}\rho^2 \cdot \rho^2\sin\phi\,d\rho\,d\phi\,d\theta`, note: md`$dV = \rho^2 \sin\phi\,d\rho\,d\phi\,d\theta$ from Unit 4.` },
        { math: md`= ${3 * k} \cdot \frac{${Rr}^5}{5} \cdot 2 \cdot 2\pi = ${pt.tex}`, note: md`$\int_0^{${Rr}} \rho^4\,d\rho = \frac{${Rr}^5}{5}$, $\int_0^\pi \sin\phi\,d\phi = 2$, $\int_0^{2\pi} d\theta = 2\pi$.` },
      ],
    };
  }
  let a: number;
  let b: number;
  let c: number;
  do [a, b, c] = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
  while (a + b + c === 0);
  // Cross terms with zero divergence make the field look less trivial.
  const extras: [Poly, Poly, Poly][] = [
    [term(0), term(0), term(0)],
    [term(1, { y: 1 }), term(1, { z: 1 }), term(1, { x: 1 })],
    [term(-1, { z: 1 }), term(2, { x: 1 }), term(1, { y: 2 })],
    [term(1, { y: 1, z: 1 }), term(0), term(-1, { x: 1, y: 1 })],
  ];
  const [ex, ey, ez] = r.pick(extras);
  const [P, Q, R] = [padd(term(a, { x: 1 }), ex), padd(term(b, { y: 1 }), ey), padd(term(c, { z: 1 }), ez)];
  const D = divOf(P, Q, R);
  const d = pconst(D);
  const cylinder = kind === 2;
  const h = r.int(1, 4);
  const volume = cylinder ? q(Rr * Rr * h) : q(4 * Rr ** 3, 3);
  const value = qmul(d, volume);
  const pt = piText(value);
  const surface = cylinder ? md`closed cylinder $x^2 + y^2 \le ${Rr * Rr}$, $0 \le z \le ${h}$ (side, top and bottom)` : md`sphere $x^2 + y^2 + z^2 = ${Rr * Rr}$`;
  const volumeTex = cylinder ? md`\pi \cdot ${Rr}^2 \cdot ${h}` : md`\tfrac{4}{3}\pi \cdot ${Rr}^3`;
  return {
    prompt: md`Let $\mathbf{F} = ${vec(ptex(P), ptex(Q), ptex(R))}$. Find the outward flux of $\mathbf{F}$ through the ${surface}. Give the exact answer in terms of $\pi$ (type pi).`,
    answer: pt.text,
    simplified: true,
    // Constant divergence: the flux is the divergence times the volume enclosed.
    verify: [`N = (${dText(P, "x", { x: 0, y: 0, z: 0 })} + ${dText(Q, "y", { x: 0, y: 0, z: 0 })} + ${dText(R, "z", { x: 0, y: 0, z: 0 })}) * ${cylinder ? `pi * ${Rr}^2 * ${h}` : `(4/3) * pi * ${Rr}^3`}`],
    hint: md`Find $\operatorname{div}\mathbf{F}$. It is a constant, so by the divergence theorem the flux is that constant times the volume enclosed.`,
    solution: [
      { math: md`\operatorname{div}\mathbf{F} = ${ptex(pderiv(P, "x"))} + (${ptex(pderiv(Q, "y"))}) + (${ptex(pderiv(R, "z"))}) = ${qtex(d)}`, note: "The extra terms contribute nothing to the divergence: each depends on variables other than its own." },
      { math: md`\iint_S ${FdS} = \iiint_E ${qtex(d)}\,dV = ${qtex(d)} \cdot ${volumeTex} = ${pt.tex}`, note: cylinder ? "The volume of a cylinder is base area times height." : "The volume of a ball of radius R is (4/3)πR³." },
    ],
  };
};

const fluxFaces: Generator = (r) => {
  const mono = (v: Var, c: number) => (c === 0 ? term(0) : r.int(0, 1) === 0 ? term(c, { [v]: 1 } as Partial<Record<Var, number>>) : term(c, { [v]: 2 } as Partial<Record<Var, number>>));
  let P: Poly;
  let Q: Poly;
  let R: Poly;
  do {
    [P, Q, R] = [mono("x", r.int(-3, 3)), mono("y", r.int(-3, 3)), mono("z", r.int(-3, 3))];
  } while ([P, Q, R].filter((f) => f.size).length < 2);
  const [x1, y1, z1] = [r.int(-1, 1), r.int(-1, 1), r.int(0, 1)];
  const [x2, y2, z2] = [x1 + r.int(1, 3), y1 + r.int(1, 2), z1 + r.int(1, 2)];
  const D = divOf(P, Q, R);
  const value = pconst(pdef(pdef(pdef(D, "z", z1, z2), "y", y1, y2), "x", x1, x2));
  const faceX = qmul(qsub(peval(P, { x: x2 }), peval(P, { x: x1 })), q((y2 - y1) * (z2 - z1)));
  const faceY = qmul(qsub(peval(Q, { y: y2 }), peval(Q, { y: y1 })), q((x2 - x1) * (z2 - z1)));
  const faceZ = qmul(qsub(peval(R, { z: z2 }), peval(R, { z: z1 })), q((x2 - x1) * (y2 - y1)));
  return {
    prompt: md`Let $\mathbf{F} = ${vec(ptex(P), ptex(Q), ptex(R))}$ and let $E$ be the box $${x1} \le x \le ${x2}$, $${y1} \le y \le ${y2}$, $${z1} \le z \le ${z2}$. Find the outward flux of $\mathbf{F}$ through the six faces of the box, face by face or with the divergence theorem. Give an exact fraction.`,
    answer: qtext(value),
    simplified: true,
    // The surface side of the theorem, computed directly: each component only crosses its own pair of faces.
    verify: [
      `N = ((${evalText(P, { x: x2 })}) - (${evalText(P, { x: x1 })})) * ${(y2 - y1) * (z2 - z1)} + ((${evalText(Q, { y: y2 })}) - (${evalText(Q, { y: y1 })})) * ${(x2 - x1) * (z2 - z1)} + ((${evalText(R, { z: z2 })}) - (${evalText(R, { z: z1 })})) * ${(x2 - x1) * (y2 - y1)}`,
    ],
    hint: md`On the face $x = ${x2}$ the outward normal is $\mathbf{i}$ and $\mathbf{F} \cdot \mathbf{n} = P$; on $x = ${x1}$ it is $-\mathbf{i}$ and $\mathbf{F} \cdot \mathbf{n} = -P$. Each component is constant on its own faces here. Or compute $\iiint_E \operatorname{div}\mathbf{F}\,dV$ and compare.`,
    solution: [
      { math: md`x\text{-faces: } \left[(${ptexAt(P, { x: x2 })}) - (${ptexAt(P, { x: x1 })})\right] \cdot ${(y2 - y1) * (z2 - z1)} = ${qtex(faceX)}`, note: md`$P$ is constant on each face $x = \text{const}$; the face has area $${y2 - y1} \cdot ${z2 - z1}$. Flux out through $x = ${x2}$ minus flux in through $x = ${x1}$. $Q$ and $R$ are tangent to these faces and contribute nothing.` },
      { math: md`y\text{-faces: } \left[(${ptexAt(Q, { y: y2 })}) - (${ptexAt(Q, { y: y1 })})\right] \cdot ${(x2 - x1) * (z2 - z1)} = ${qtex(faceY)}`, note: "Same idea with Q." },
      { math: md`z\text{-faces: } \left[(${ptexAt(R, { z: z2 })}) - (${ptexAt(R, { z: z1 })})\right] \cdot ${(x2 - x1) * (y2 - y1)} = ${qtex(faceZ)}`, note: "And with R." },
      { math: md`\iint_S ${FdS} = ${qtex(faceX)} + ${parTex(faceY)} + ${parTex(faceZ)} = ${qtex(value)}`, note: "Add the three pairs." },
      { math: md`\iiint_E \operatorname{div}\mathbf{F}\,dV = \int_{${x1}}^{${x2}}\int_{${y1}}^{${y2}}\int_{${z1}}^{${z2}} \left(${ptex(D)}\right) dz\,dy\,dx = ${qtex(value)}`, note: "The divergence theorem gives the same number: the two sides of the theorem agree." },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

const rotationPlot: Block = {
  kind: "plot",
  x: [-3, 3],
  y: [-3, 3],
  field: { dx: "-y", dy: "x" },
  parametric: [{ x: "2cos(t)", y: "2sin(t)", t: [0, 2 * Math.PI], color: 2, dashed: true }],
  points: [
    { x: 1, y: 0, label: "(1, 0)", color: 2 },
    { x: 0, y: 1, label: "(0, 1)", color: 2 },
  ],
  caption: md`The field $\mathbf{F} = \langle -y, x \rangle$. At $(1, 0)$ the arrow is $\langle 0, 1 \rangle$, straight up; at $(0, 1)$ it is $\langle -1, 0 \rangle$, to the left. Every arrow is perpendicular to the position vector, so the field runs around circles, counterclockwise, faster farther out.`,
};

const spiralPlot: Block = {
  kind: "plot",
  x: [-3, 3],
  y: [-3, 3],
  field: { dx: "a x - b y", dy: "b x + a y" },
  params: [
    { name: "a", tex: md`a`, min: -1, max: 1, step: 0.25, value: 1 },
    { name: "b", tex: md`b`, min: -1, max: 1, step: 0.25, value: 0 },
  ],
  caption: md`$\mathbf{F} = \langle ax - by, bx + ay \rangle = a\langle x, y \rangle + b\langle -y, x \rangle$. The $a$ part pushes straight out from the origin (or in, when $a < 0$); the $b$ part turns around it. Mix them and the arrows spiral. Right now $a = $ {a} and $b = $ {b}.`,
};

const gradientContour: Block = {
  kind: "contour",
  x: [-3, 3],
  y: [-3, 3],
  expr: "x^2 + y^2",
  levels: [1, 2, 4, 6, 8],
  arrows: [
    { x: 1, y: 1, dx: 1, dy: 1, label: md`\nabla f`, color: 2 },
    { x: -1, y: 0.5, dx: -1, dy: 0.5, color: 2 },
    { x: 0.5, y: -1.5, dx: 0.5, dy: -1.5, color: 2 },
    { x: -1.5, y: -1, dx: -1.5, dy: -1, color: 2 },
  ],
  caption: md`Level curves of $f = x^2 + y^2$ with a few gradient vectors $\nabla f = \langle 2x, 2y \rangle$ (drawn at half length so they fit). Each one crosses the level curve through its base at a right angle and points toward higher values of $f$.`,
};

const saddleGradientPlot: Block = {
  kind: "plot",
  x: [-3, 3],
  y: [-3, 3],
  field: { dx: "2x", dy: "-2y" },
  caption: md`The gradient field of $f = x^2 - y^2$: $\nabla f = \langle 2x, -2y \rangle$. Arrows flow away from the $y$-axis and toward the $x$-axis, always uphill on the saddle $z = x^2 - y^2$.`,
};

const twoPathsPlot: Block = {
  kind: "plot",
  x: [-0.5, 1.6],
  y: [-0.5, 1.6],
  field: { dx: "y^2", dy: "x", density: 9 },
  parametric: [
    { x: "t", y: "t^2", t: [0, 1], label: md`y = x^2`, color: 2 },
    { x: "t", y: "t", t: [0, 1], label: md`y = x`, color: 3 },
  ],
  points: [
    { x: 0, y: 0, label: "(0, 0)" },
    { x: 1, y: 1, label: "(1, 1)" },
  ],
  caption: md`The field $\mathbf{F} = \langle y^2, x \rangle$ and two paths from $(0, 0)$ to $(1, 1)$. Along the parabola the work is $\frac{13}{15}$; along the straight line it is $\frac{5}{6}$. Same endpoints, different work.`,
};

const movingPointPlot: Block = {
  kind: "plot",
  x: [-0.5, 2.6],
  y: [-0.5, 2.6],
  parametric: [{ x: "2cos(t)", y: "2sin(t)", t: [0, Math.PI / 2], color: 1 }],
  points: [{ x: "2cos(s)", y: "2sin(s)", label: md`\mathbf{r}(t)`, color: 2 }],
  params: [{ name: "s", tex: md`t`, min: 0, max: 1.5708, step: 0.0491, value: 0.5 }],
  caption: md`The quarter circle $\mathbf{r}(t) = \langle 2\cos t, 2\sin t \rangle$. The point moves at speed $|\mathbf{r}'(t)| = 2$, so in a short time $\Delta t$ it covers arc length $\Delta s \approx 2\,\Delta t$. Here $x\,y = $ {=4cos(s)sin(s)}, the value the integrand $f = xy$ takes at the moving point.`,
};

const loopPlot: Block = {
  kind: "plot",
  x: [-3, 3],
  y: [-3, 3],
  field: { dx: "-y", dy: "x" },
  parametric: [{ x: "2cos(t)", y: "2sin(t)", t: [0, 2 * Math.PI], color: 2 }],
  caption: md`$\mathbf{F} = \langle -y, x \rangle$ around the circle of radius 2. The field points along the direction of travel at every point of the loop, so the work around it is positive ($8\pi$, as it turns out), not 0. A conservative field could never do this.`,
};

const greenRegionDiagram: Block = {
  kind: "diagram",
  view: [-3.2, 3.6, -2.6, 3],
  points: [
    { name: "A", x: -2, y: -1.5, label: "", hidden: true },
    { name: "B", x: 2.2, y: -2, label: "", hidden: true },
    { name: "C", x: 3, y: 1.2, label: "", hidden: true },
    { name: "D", x: 0.6, y: 2.4, label: "", hidden: true },
    { name: "E", x: -2.6, y: 1.4, label: "", hidden: true },
  ],
  polygons: [{ points: ["A", "B", "C", "D", "E"], fill: 1 }],
  segments: [
    { from: "A", to: "B", arrow: true, color: 2 },
    { from: "B", to: "C", arrow: true, color: 2 },
    { from: "C", to: "D", arrow: true, color: 2 },
    { from: "D", to: "E", arrow: true, color: 2 },
    { from: "E", to: "A", arrow: true, color: 2 },
  ],
  labels: [
    { x: 0.2, y: 0.2, text: "D" },
    { x: 2.9, y: -0.6, text: "C" },
  ],
  caption: md`A region $D$ and its boundary $C$ with the positive (counterclockwise) orientation: walking along $C$, the region is always on your left.`,
};

const tinyRectangleDiagram: Block = {
  kind: "diagram",
  view: [-0.6, 4.2, -0.8, 3.2],
  points: [
    { name: "P", x: 0, y: 0, label: "(x, y)", dir: "sw" },
    { name: "Q", x: 3, y: 0, label: "(x + \\Delta x, y)", dir: "se" },
    { name: "R", x: 3, y: 2, label: "", dir: "ne" },
    { name: "S", x: 0, y: 2, label: "(x, y + \\Delta y)", dir: "nw" },
  ],
  polygons: [{ points: ["P", "Q", "R", "S"], fill: 1 }],
  segments: [
    { from: "P", to: "Q", arrow: true, color: 2, label: "P(x, y)\\,\\Delta x" },
    { from: "Q", to: "R", arrow: true, color: 2, label: "Q(x + \\Delta x, y)\\,\\Delta y" },
    { from: "R", to: "S", arrow: true, color: 2, label: "-P(x, y + \\Delta y)\\,\\Delta x" },
    { from: "S", to: "P", arrow: true, color: 2, label: "-Q(x, y)\\,\\Delta y" },
  ],
  caption: md`Circulation around a tiny rectangle, edge by edge. Along each edge the field is nearly constant, and only the component along the edge counts: $P$ on the horizontal edges, $Q$ on the vertical ones. The top and left edges run backwards, hence the minus signs.`,
};

const paraboloidSurface: Block = {
  kind: "surface",
  x: [-2, 2],
  y: [-2, 2],
  expr: "x^2 + y^2",
  caption: md`The paraboloid $z = x^2 + y^2$. Above each small square of the floor sits a tilted patch of the surface. The steeper the patch, the bigger it is compared with its shadow: by a factor of $\sqrt{1 + 4x^2 + 4y^2}$ here.`,
};

const capSurface: Block = {
  kind: "surface",
  x: [-2, 2],
  y: [-2, 2],
  z: [-1, 4],
  expr: "4 - x^2 - y^2",
  caption: md`The cap $z = 4 - x^2 - y^2$ above the disk $x^2 + y^2 \le 4$. Its rim is the circle $x^2 + y^2 = 4$ in the plane $z = 0$. The flat disk inside that circle has the same rim, and Stokes' theorem says the flux of $\operatorname{curl}\mathbf{F}$ through the cap equals the flux through the disk.`,
};

const divergencePlot: Block = {
  kind: "plot",
  x: [-3, 3],
  y: [-3, 3],
  field: { dx: "a x - b y", dy: "b x + a y" },
  params: [
    { name: "a", tex: md`a`, min: -1, max: 1, step: 0.25, value: 1 },
    { name: "b", tex: md`b`, min: -1, max: 1, step: 0.25, value: 0 },
  ],
  caption: md`$\mathbf{F} = \langle ax - by, bx + ay \rangle$ has $\operatorname{div}\mathbf{F} = 2a = $ {=2a} and scalar curl $Q_x - P_y = 2b = $ {=2b}. Slide $a$ for spreading, $b$ for spinning. The two numbers are independent: a field can do either, both, or neither.`,
};

const shearPlot: Block = {
  kind: "plot",
  x: [-3, 3],
  y: [-3, 3],
  field: { dx: "x", dy: "-y" },
  caption: md`$\mathbf{F} = \langle x, -y \rangle$: divergence $1 - 1 = 0$ and scalar curl $0 - 0 = 0$. Fluid is squeezed toward the $x$-axis and stretched along it, but none is created and nothing spins. Incompressible and irrotational at once.`,
};

const outflowPlot: Block = {
  kind: "plot",
  x: [-3, 3],
  y: [-3, 3],
  field: { dx: "x", dy: "y" },
  parametric: [{ x: "2cos(t)", y: "2sin(t)", t: [0, 2 * Math.PI], color: 2 }],
  caption: md`$\mathbf{F} = \langle x, y \rangle$ has divergence 2 everywhere. On the circle of radius 2 the field is $2\mathbf{n}$, so the outward flux is $2 \cdot 2\pi \cdot 2 = 8\pi$. And $\iint \operatorname{div}\mathbf{F}\,dA = 2 \cdot \pi \cdot 2^2 = 8\pi$: the plane version of the divergence theorem.`,
};

export const unit5: Unit = {
  title: "Vector Calculus",
  lessons: [
    {
      id: slug("Vector fields"),
      title: "Vector fields",
      summary: "A vector attached to every point: wind maps, force fields, gradient fields, and how to read a field plot.",
      blocks: [
        {
          kind: "text",
          body: md`A weather map shows the wind at each place as an arrow: its direction is where the air is going and its length is how fast. Water in a river, the pull of gravity around a planet, the push of an electric charge: all of these attach a vector to every point of space. A rule that does that is a **vector field**. Up to now our functions produced numbers, or a vector from a single number $t$. Now the input is a point and the output is an arrow.`,
        },
        {
          kind: "key",
          title: "Vector field",
          body: md`A vector field on a region of the plane assigns a vector to each point:

$$\mathbf{F}(x, y) = \langle P(x, y), Q(x, y) \rangle = P\,\mathbf{i} + Q\,\mathbf{j}.$$

In space, $\mathbf{F}(x, y, z) = \langle P, Q, R \rangle$. The functions $P$, $Q$, $R$ are the **component functions**. Unless we say otherwise, they have continuous partial derivatives.`,
        },
        rotationPlot,
        {
          kind: "why",
          title: "How to read a field plot",
          body: md`The arrow drawn at $(x, y)$ is $\mathbf{F}(x, y)$, placed with its tail at the point. To understand a field, evaluate it at a few easy points and draw the arrows. For $\mathbf{F} = \langle -y, x \rangle$:

- at $(1, 0)$: $\langle 0, 1 \rangle$, pointing up;
- at $(0, 1)$: $\langle -1, 0 \rangle$, pointing left;
- at $(-1, 0)$: $\langle 0, -1 \rangle$, pointing down.

The arrows chase each other around the origin counterclockwise. Their length is $|\mathbf{F}| = \sqrt{y^2 + x^2}$, the distance from the origin, so the rotation is faster farther out. Plots scale all arrows by one common factor so they don't overlap; compare lengths within a plot, not across plots.`,
        },
        {
          kind: "example",
          title: "Describing a field from its formula",
          problem: md`Describe the field $\mathbf{F}(x, y) = \langle x, y \rangle$.`,
          steps: [
            { math: md`\mathbf{F}(x, y) = \langle x, y \rangle = \text{the position vector of } (x, y)`, note: "The arrow at each point is the vector from the origin to that point." },
            { math: md`\text{direction: away from the origin}, \quad |\mathbf{F}| = \sqrt{x^2 + y^2}`, note: "Every arrow points radially outward and is as long as the point is far from the origin. The origin itself gets the zero vector." },
            { math: md`-\mathbf{F} = \langle -x, -y \rangle \text{ points inward}`, note: "Negating a field reverses every arrow. A field like this one models gravity pointing toward a center, with the strength fixed later." },
          ],
        },
        spiralPlot,
        {
          kind: "key",
          title: "Gradient fields",
          body: md`Every scalar function $f(x, y)$ produces a vector field, its **gradient field**

$$\nabla f = \left\langle \frac{\partial f}{\partial x}, \frac{\partial f}{\partial y} \right\rangle,$$

and likewise $\nabla f = \langle f_x, f_y, f_z \rangle$ in space. A field that arises this way is called a gradient field, or (for reasons that come in lesson 3) a **conservative** field, and $f$ is a **potential function** for it.`,
        },
        {
          kind: "why",
          title: "Why gradient arrows cross the level curves at right angles",
          body: md`This is Unit 3 again, and it is worth re-deriving because it makes gradient fields easy to recognize in a picture. Let $\mathbf{r}(t)$ trace a level curve of $f$, so $f(\mathbf{r}(t)) = c$ for all $t$. Differentiate both sides with the chain rule:

$$\nabla f(\mathbf{r}(t)) \cdot \mathbf{r}'(t) = 0.$$

The gradient is perpendicular to the tangent of the level curve. And since $D_{\mathbf{u}} f = \nabla f \cdot \mathbf{u}$ is largest when $\mathbf{u}$ points along $\nabla f$, the gradient points in the direction in which $f$ increases fastest. So the arrows of a gradient field pierce the contour lines of $f$ at right angles, heading uphill.`,
        },
        gradientContour,
        {
          kind: "example",
          title: "A gradient field, and its value at a point",
          problem: md`Find the gradient field of $f(x, y) = x^2 y - y^3$ and evaluate it at $(2, 1)$.`,
          steps: [
            { math: md`f_x = 2xy, \qquad f_y = x^2 - 3y^2`, note: "Partial derivatives: treat the other variable as a constant." },
            { math: md`\nabla f = \langle 2xy, x^2 - 3y^2 \rangle`, note: "The gradient field. Its first component is P, its second is Q." },
            { math: md`\nabla f(2, 1) = \langle 2 \cdot 2 \cdot 1, 2^2 - 3 \cdot 1^2 \rangle = \langle 4, 1 \rangle`, note: md`The arrow at $(2, 1)$ points mostly to the right and a little up. It is perpendicular to the level curve $x^2 y - y^3 = 3$ through that point.` },
          ],
        },
        saddleGradientPlot,
        {
          kind: "text",
          body: md`Not every field is a gradient field. Take $\mathbf{F} = \langle -y, x \rangle$ from the first plot. If it were $\nabla f$, we would need $f_x = -y$ and $f_y = x$. Then $f_{xy} = -1$ while $f_{yx} = 1$, and Clairaut's theorem says those mixed partials must agree. So no such $f$ exists. Lesson 3 turns this observation into a test.`,
        },
        {
          kind: "check",
          prompt: md`Find $\nabla f$ at the point $(1, 2)$ for $f(x, y) = x^2 y + y$. Type it as a vector like <3, -2>.`,
          answer: "(4, 2)",
          form: "tuple",
          explain: md`$\nabla f = \langle 2xy, x^2 + 1 \rangle$. At $(1, 2)$: $\langle 2 \cdot 1 \cdot 2, 1 + 1 \rangle = \langle 4, 2 \rangle$.`,
        },
        {
          kind: "check",
          prompt: md`Let $\mathbf{F}(x, y) = \langle xy, x - y^2 \rangle$. Find $\mathbf{F}(3, -1)$. Type it as a vector like <3, -2>.`,
          answer: "(-3, 2)",
          form: "tuple",
          explain: md`$P = 3 \cdot (-1) = -3$ and $Q = 3 - (-1)^2 = 2$.`,
        },
      ],
      practice: [gradientComponent, fieldAtPoint, describeField],
    },
    {
      id: slug("Line integrals"),
      title: "Line integrals",
      summary: "Adding up a function along a curve: the mass of a bent wire, and the work done by a force along a path.",
      blocks: [
        {
          kind: "text",
          body: md`A thin wire is bent into a curve $C$, and its density (mass per unit length) varies from point to point: $\rho(x, y)$. What is its mass? If the density were constant, mass would be density times length. It isn't, so we do what calculus always does: cut the wire into tiny pieces, treat the density as constant on each, add, and take a limit. The result is an integral along a curve, a **line integral**.`,
        },
        {
          kind: "why",
          title: "Deriving the formula",
          body: md`Let $\mathbf{r}(t)$, $a \le t \le b$, trace $C$ once. Split $[a, b]$ into $n$ pieces of width $\Delta t$. The piece of curve traced during the $i$-th time step has length

$$\Delta s_i \approx |\mathbf{r}'(t_i)|\,\Delta t,$$

since $|\mathbf{r}'|$ is the speed and distance is speed times time (that is how arc length was derived in Unit 2). On that short piece $f$ is nearly the constant $f(\mathbf{r}(t_i))$, so its contribution is about $f(\mathbf{r}(t_i))\,|\mathbf{r}'(t_i)|\,\Delta t$. Add up and let $n \to \infty$:

$$\sum_{i} f(\mathbf{r}(t_i))\,|\mathbf{r}'(t_i)|\,\Delta t \;\to\; \int_a^b f(\mathbf{r}(t))\,|\mathbf{r}'(t)|\,dt.$$

The limit on the right is an ordinary one-variable integral, which is why line integrals are computable.`,
        },
        {
          kind: "key",
          title: "Line integral of a scalar function",
          body: md`For a curve $C$ traced by $\mathbf{r}(t)$, $a \le t \le b$,

$$\int_C f\,ds = \int_a^b f(\mathbf{r}(t))\,|\mathbf{r}'(t)|\,dt.$$

Here $ds = |\mathbf{r}'(t)|\,dt$ is the **arc length element**. Taking $f = 1$ gives the length of $C$. The value does not depend on how $C$ is parametrized, nor on the direction of travel: $ds$ is a positive length either way.`,
        },
        movingPointPlot,
        {
          kind: "example",
          title: "A line integral over a quarter circle",
          problem: md`Find $\int_C xy\,ds$ where $C$ is the quarter of the circle $x^2 + y^2 = 4$ from $(2, 0)$ to $(0, 2)$.`,
          steps: [
            { math: md`\mathbf{r}(t) = \langle 2\cos t, 2\sin t \rangle, \quad 0 \le t \le \tfrac{\pi}{2}`, note: "Parametrize the arc." },
            { math: md`|\mathbf{r}'(t)| = \sqrt{4\sin^2 t + 4\cos^2 t} = 2, \quad ds = 2\,dt`, note: "The speed is constant on a circle traced at a steady angular rate." },
            { math: md`\int_C xy\,ds = \int_0^{\pi/2} (2\cos t)(2\sin t) \cdot 2\,dt = \int_0^{\pi/2} 8\sin t\cos t\,dt`, note: "Substitute x, y and ds." },
            { math: md`= \left[4\sin^2 t\right]_0^{\pi/2} = 4`, note: md`$\frac{d}{dt}\sin^2 t = 2\sin t\cos t$.` },
          ],
        },
        {
          kind: "text",
          body: md`The second kind of line integral measures **work**. In Unit 1, a constant force $\mathbf{F}$ pushing an object along a straight displacement $\mathbf{d}$ does work $\mathbf{F} \cdot \mathbf{d}$: only the component of force along the motion counts. Now let the force vary from point to point and the path bend.`,
        },
        {
          kind: "why",
          title: "Deriving the work integral",
          body: md`Chop the path into short displacements. During the $i$-th time step the object moves by

$$\Delta \mathbf{r}_i = \mathbf{r}(t_i + \Delta t) - \mathbf{r}(t_i) \approx \mathbf{r}'(t_i)\,\Delta t,$$

a nearly straight step, during which the force is nearly the constant $\mathbf{F}(\mathbf{r}(t_i))$. The work on that step is about $\mathbf{F}(\mathbf{r}(t_i)) \cdot \mathbf{r}'(t_i)\,\Delta t$. Summing and passing to the limit,

$$W = \int_a^b \mathbf{F}(\mathbf{r}(t)) \cdot \mathbf{r}'(t)\,dt.$$

Writing $d\mathbf{r} = \mathbf{r}'(t)\,dt$ makes this $\int_C \mathbf{F} \cdot d\mathbf{r}$: "sum up force dot displacement along the curve".`,
        },
        {
          kind: "key",
          title: "Line integral of a vector field (work)",
          body: md`$$\int_C \mathbf{F} \cdot d\mathbf{r} = \int_a^b \mathbf{F}(\mathbf{r}(t)) \cdot \mathbf{r}'(t)\,dt = \int_C P\,dx + Q\,dy = \int_C \mathbf{F} \cdot \mathbf{T}\,ds.$$

The three right-hand forms are the same integral written three ways. Unlike $\int_C f\,ds$, this one depends on direction: traversing $C$ backwards changes the sign.`,
        },
        {
          kind: "why",
          title: "Why the three forms agree",
          body: md`Since $\mathbf{r}'(t) = \langle x'(t), y'(t) \rangle$, the dot product spelled out is $P\,x'(t)\,dt + Q\,y'(t)\,dt$, and $x'(t)\,dt = dx$, $y'(t)\,dt = dy$. That is the **differential form** $\int_C P\,dx + Q\,dy$.

For the third form, $\mathbf{r}'(t) = |\mathbf{r}'(t)|\,\mathbf{T}$ where $\mathbf{T}$ is the unit tangent, so $\mathbf{F} \cdot \mathbf{r}'\,dt = (\mathbf{F} \cdot \mathbf{T})\,|\mathbf{r}'|\,dt = (\mathbf{F} \cdot \mathbf{T})\,ds$. Work is the integral of the tangential component of the force with respect to arc length. Reversing the direction flips $\mathbf{T}$ and therefore the sign, while $ds$ stays positive. That is why scalar line integrals don't care about direction but work integrals do.`,
        },
        {
          kind: "example",
          title: "Work along a parabola",
          problem: md`Find the work done by $\mathbf{F} = \langle y^2, x \rangle$ along $\mathbf{r}(t) = \langle t, t^2 \rangle$, $0 \le t \le 1$.`,
          steps: [
            { math: md`\mathbf{r}'(t) = \langle 1, 2t \rangle`, note: "Differentiate the parametrization." },
            { math: md`\mathbf{F}(\mathbf{r}(t)) = \langle (t^2)^2, t \rangle = \langle t^4, t \rangle`, note: md`Substitute $x = t$, $y = t^2$ into the field.` },
            { math: md`\mathbf{F} \cdot \mathbf{r}' = t^4 \cdot 1 + t \cdot 2t = t^4 + 2t^2`, note: "Dot product." },
            { math: md`W = \int_0^1 (t^4 + 2t^2)\,dt = \frac{1}{5} + \frac{2}{3} = \frac{13}{15}`, note: "An ordinary integral finishes it." },
          ],
        },
        {
          kind: "example",
          title: "Same field, same endpoints, straight path",
          problem: md`Find the work done by $\mathbf{F} = \langle y^2, x \rangle$ along the straight segment from $(0, 0)$ to $(1, 1)$.`,
          steps: [
            { math: md`\mathbf{r}(t) = \langle t, t \rangle, \quad 0 \le t \le 1, \quad \mathbf{r}'(t) = \langle 1, 1 \rangle`, note: "Parametrize the segment." },
            { math: md`\mathbf{F} \cdot \mathbf{r}' = t^2 \cdot 1 + t \cdot 1 = t^2 + t`, note: md`On this path $x = y = t$.` },
            { math: md`W = \int_0^1 (t^2 + t)\,dt = \frac{1}{3} + \frac{1}{2} = \frac{5}{6}`, note: md`Not $\frac{13}{15}$. Between the same two points, this field does different work along different paths. The next lesson is about the fields for which that never happens.` },
          ],
        },
        twoPathsPlot,
        {
          kind: "check",
          prompt: md`Find $\int_C x\,ds$ where $C$ is the straight segment from $(0, 0)$ to $(3, 4)$. Give an exact fraction.`,
          answer: "15/2",
          explain: md`$\mathbf{r}(t) = \langle 3t, 4t \rangle$, $0 \le t \le 1$, with $|\mathbf{r}'| = 5$. So $\int_0^1 3t \cdot 5\,dt = 15 \cdot \frac{1}{2} = \frac{15}{2}$.`,
        },
        {
          kind: "check",
          prompt: md`Find the work done by $\mathbf{F} = \langle x, y \rangle$ along $\mathbf{r}(t) = \langle t, t^2 \rangle$, $0 \le t \le 1$.`,
          answer: "1",
          explain: md`$\mathbf{F}(\mathbf{r}(t)) \cdot \mathbf{r}'(t) = \langle t, t^2 \rangle \cdot \langle 1, 2t \rangle = t + 2t^3$, and $\int_0^1 (t + 2t^3)\,dt = \frac{1}{2} + \frac{1}{2} = 1$.`,
        },
      ],
      practice: [scalarLineIntegral, workAlongPath, differentialForm],
    },
    {
      id: slug("Conservative fields"),
      title: "Conservative fields",
      summary: "When work depends only on the endpoints: the fundamental theorem for line integrals, finding potentials, and the curl test.",
      blocks: [
        {
          kind: "text",
          body: md`In the last lesson the field $\langle y^2, x \rangle$ did different work along two paths with the same endpoints. For gradient fields that can't happen, and the reason is the chain rule.`,
        },
        {
          kind: "proof",
          title: "The fundamental theorem for line integrals",
          given: md`$\mathbf{F} = \nabla f$ where $f$ has continuous partial derivatives, and $C$ is a smooth curve $\mathbf{r}(t)$, $a \le t \le b$, from $A = \mathbf{r}(a)$ to $B = \mathbf{r}(b)$`,
          prove: md`$\displaystyle\int_C \nabla f \cdot d\mathbf{r} = f(B) - f(A)$`,
          steps: [
            { statement: md`$\displaystyle\int_C \nabla f \cdot d\mathbf{r} = \int_a^b \nabla f(\mathbf{r}(t)) \cdot \mathbf{r}'(t)\,dt$`, reason: "Definition of the line integral of a vector field." },
            { statement: md`$\displaystyle\frac{d}{dt} f(\mathbf{r}(t)) = f_x\,x'(t) + f_y\,y'(t) = \nabla f(\mathbf{r}(t)) \cdot \mathbf{r}'(t)$`, reason: "The multivariable chain rule (Unit 3), written as a dot product." },
            { statement: md`$\displaystyle\int_C \nabla f \cdot d\mathbf{r} = \int_a^b \frac{d}{dt}\big[f(\mathbf{r}(t))\big]\,dt$`, reason: "Substitute step 2 into step 1." },
            { statement: md`$= f(\mathbf{r}(b)) - f(\mathbf{r}(a))$`, reason: md`The fundamental theorem of calculus: $f(\mathbf{r}(t))$ is an antiderivative of its own derivative.` },
            { statement: md`$= f(B) - f(A)$`, reason: md`$\mathbf{r}(a) = A$ and $\mathbf{r}(b) = B$.` },
          ],
        },
        {
          kind: "key",
          title: "Conservative fields and path independence",
          body: md`A field $\mathbf{F}$ is **conservative** if $\mathbf{F} = \nabla f$ for some **potential** $f$. Then for any curve $C$ from $A$ to $B$,

$$\int_C \mathbf{F} \cdot d\mathbf{r} = f(B) - f(A).$$

Consequences: the work is **path independent** (any two curves from $A$ to $B$ give the same value), and around any **closed** curve ($A = B$) the work is 0. The proof works just as well in space, with $f(x, y, z)$.`,
        },
        {
          kind: "why",
          title: "Why the word conservative",
          body: md`Gravity near a planet is $\mathbf{F} = -\nabla U$ for a potential energy $U$. The work gravity does moving an object from $A$ to $B$ is $U(A) - U(B)$, the drop in potential energy, whatever route is taken, and that work becomes kinetic energy. Potential plus kinetic stays constant: energy is conserved. Fields with this property got the name, and the name stuck for the mathematical idea.`,
        },
        {
          kind: "example",
          title: "Using the theorem",
          problem: md`Find $\int_C \mathbf{F} \cdot d\mathbf{r}$ for $\mathbf{F} = \langle 2xy, x^2 + 3y^2 \rangle$ along the curve $\mathbf{r}(t) = \langle 2t^3, \sin(\tfrac{\pi}{2} t) \rangle$, $0 \le t \le 1$.`,
          steps: [
            { math: md`f(x, y) = x^2 y + y^3 \quad\Rightarrow\quad \nabla f = \langle 2xy, x^2 + 3y^2 \rangle = \mathbf{F}`, note: "A potential. (How to find one systematically comes next.) Check by differentiating." },
            { math: md`A = \mathbf{r}(0) = (0, 0), \qquad B = \mathbf{r}(1) = (2, 1)`, note: "Only the endpoints matter, so the awkward path is irrelevant." },
            { math: md`\int_C \mathbf{F} \cdot d\mathbf{r} = f(2, 1) - f(0, 0) = (4 + 1) - 0 = 5`, note: "No parametrizing, no dot product, no integral." },
          ],
        },
        {
          kind: "why",
          title: "Finding a potential",
          body: md`We need $f$ with $f_x = P$ and $f_y = Q$. Integrate the first equation with respect to $x$:

$$f(x, y) = \int P\,dx + g(y),$$

where the "constant" of integration may be any function of $y$, since $y$ is held fixed while integrating in $x$. Then differentiate this $f$ with respect to $y$ and set it equal to $Q$. Everything involving $x$ must cancel (if it doesn't, the field is not conservative), leaving an equation $g'(y) = \ldots$ that determines $g$ up to a constant.`,
        },
        {
          kind: "example",
          title: "Finding a potential",
          problem: md`Find a potential for $\mathbf{F} = \langle 3x^2 y + 2x, x^3 - 4y \rangle$.`,
          steps: [
            { math: md`f = \int (3x^2 y + 2x)\,dx = x^3 y + x^2 + g(y)`, note: md`Integrate $P$ in $x$, treating $y$ as a constant.` },
            { math: md`f_y = x^3 + g'(y) = x^3 - 4y`, note: md`Differentiate in $y$ and match with $Q$. The $x^3$ terms cancel, as they must.` },
            { math: md`g'(y) = -4y, \quad g(y) = -2y^2`, note: "Integrate what remains." },
            { math: md`f(x, y) = x^3 y + x^2 - 2y^2`, note: "Any constant may be added. Check: f_x = 3x²y + 2x and f_y = x³ - 4y." },
          ],
        },
        {
          kind: "key",
          title: "The test for a conservative field",
          body: md`If $\mathbf{F} = \langle P, Q \rangle$ is conservative (with continuous partials), then

$$\frac{\partial P}{\partial y} = \frac{\partial Q}{\partial x}.$$

Conversely, if $P_y = Q_x$ throughout a **simply connected** region (one with no holes, such as the whole plane or any disk), then $\mathbf{F}$ is conservative there.`,
        },
        {
          kind: "why",
          title: "Why a conservative field has P_y = Q_x",
          body: md`If $\mathbf{F} = \nabla f$ then $P = f_x$ and $Q = f_y$, so $P_y = f_{xy}$ and $Q_x = f_{yx}$. Clairaut's theorem says the two mixed partials are equal. That is the whole argument, and it is the same one that ruled out $\langle -y, x \rangle$ in lesson 1: there $P_y = -1$ and $Q_x = 1$.

The converse (equal partials imply a potential, when there are no holes) is harder. It follows from Green's theorem in the next lesson: equal partials make the work around every closed curve 0, and that makes $f(X) = \int_A^X \mathbf{F} \cdot d\mathbf{r}$ well defined, with $\nabla f = \mathbf{F}$.`,
        },
        {
          kind: "text",
          body: md`**Why the region matters.** Let $\mathbf{F} = \left\langle \dfrac{-y}{x^2 + y^2}, \dfrac{x}{x^2 + y^2} \right\rangle$ on the plane with the origin removed. A computation gives $P_y = Q_x = \dfrac{y^2 - x^2}{(x^2 + y^2)^2}$ everywhere. Yet around the unit circle $\mathbf{r}(t) = \langle \cos t, \sin t \rangle$ the field is $\langle -\sin t, \cos t \rangle = \mathbf{r}'(t)$, so

$$\oint_C \mathbf{F} \cdot d\mathbf{r} = \int_0^{2\pi} (\sin^2 t + \cos^2 t)\,dt = 2\pi \ne 0.$$

A conservative field would give 0. The test passed and the field still isn't conservative, because the region has a hole. On any region that avoids the origin and has no holes, this same field is conservative; one potential is the polar angle $\theta$, which is exactly what fails to be a single-valued function all the way around.`,
        },
        loopPlot,
        {
          kind: "check",
          prompt: md`Is $\mathbf{F} = \langle 2xy + y, x^2 + x \rangle$ conservative on the plane?`,
          choices: ["Yes", "No"],
          accept: ["Yes"],
          explain: md`$P_y = 2x + 1$ and $Q_x = 2x + 1$. Equal, on a region with no holes, so yes. A potential is $f = x^2 y + xy$.`,
        },
        {
          kind: "check",
          prompt: md`$\mathbf{F} = \langle 2x, 2y \rangle$. Find $\int_C \mathbf{F} \cdot d\mathbf{r}$ along any path from $(0, 0)$ to $(3, 4)$.`,
          answer: "25",
          explain: md`$\mathbf{F} = \nabla(x^2 + y^2)$, so the work is $f(3, 4) - f(0, 0) = 25 - 0 = 25$.`,
        },
      ],
      practice: [conservativeTest, findPotential, ftliWork],
    },
    {
      id: slug("Green's theorem"),
      title: "Green's theorem",
      summary: "Circulation around a boundary equals the total scalar curl inside: a proof for simple regions, and area by line integrals.",
      blocks: [
        {
          kind: "text",
          body: md`The fundamental theorem for line integrals related an integral over a curve to values at its two endpoints, the curve's boundary. Green's theorem goes one dimension up: it relates an integral around a closed curve to a double integral over the region the curve encloses. It converts hard line integrals into easy double integrals, and sometimes the other way around.`,
        },
        {
          kind: "key",
          title: "Green's theorem",
          body: md`Let $C$ be a simple closed curve in the plane, piecewise smooth, traversed **counterclockwise**, and let $D$ be the region it encloses. If $P$ and $Q$ have continuous partial derivatives on $D$, then

$$\oint_C P\,dx + Q\,dy = \iint_D \left( \frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y} \right) dA.$$

The circle on $\oint$ is a reminder that $C$ is closed. Counterclockwise is the **positive orientation**: the region stays on your left as you walk. Clockwise reverses the sign.`,
        },
        greenRegionDiagram,
        {
          kind: "why",
          title: "What Q_x − P_y measures",
          body: md`Take a tiny rectangle with corner $(x, y)$ and sides $\Delta x$, $\Delta y$, and compute the work around it counterclockwise, edge by edge. Along the bottom edge the motion is in the $x$ direction, so only $P$ contributes: about $P(x, y)\,\Delta x$. Along the top edge the motion is backwards: about $-P(x, y + \Delta y)\,\Delta x$. The right edge gives $Q(x + \Delta x, y)\,\Delta y$ and the left edge $-Q(x, y)\,\Delta y$. Pair them up:

$$\big[Q(x + \Delta x, y) - Q(x, y)\big]\Delta y - \big[P(x, y + \Delta y) - P(x, y)\big]\Delta x \approx \left(\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y}\right)\Delta x\,\Delta y.$$

So $Q_x - P_y$ is **circulation per unit area**: how much the field tends to spin a tiny paddle wheel placed at the point. It is called the **scalar curl** of $\mathbf{F}$. Green's theorem adds up these tiny circulations over the whole region. When two neighbouring rectangles share an edge, they traverse it in opposite directions, so those contributions cancel; only the outer boundary survives. That is the idea of the proof. The proof below makes it exact for a basic kind of region.`,
        },
        tinyRectangleDiagram,
        {
          kind: "proof",
          title: "Green's theorem for a region between two graphs (the P part)",
          given: md`$D = \{(x, y) : a \le x \le b,\; g_1(x) \le y \le g_2(x)\}$ with $g_1, g_2$ continuous, and $P$ with continuous partials on $D$`,
          prove: md`$\displaystyle\oint_C P\,dx = -\iint_D \frac{\partial P}{\partial y}\,dA$`,
          steps: [
            { statement: md`$\displaystyle\iint_D \frac{\partial P}{\partial y}\,dA = \int_a^b \int_{g_1(x)}^{g_2(x)} \frac{\partial P}{\partial y}\,dy\,dx$`, reason: "Fubini's theorem (Unit 4), integrating in y first on this type of region." },
            { statement: md`$\displaystyle = \int_a^b \big[P(x, g_2(x)) - P(x, g_1(x))\big]\,dx$`, reason: md`The fundamental theorem of calculus in $y$, with $x$ fixed.` },
            { statement: md`$C$ consists of the bottom graph $C_1$ ($y = g_1$, left to right), the right side $C_2$ ($x = b$), the top graph $C_3$ ($y = g_2$, right to left) and the left side $C_4$ ($x = a$).`, reason: "The boundary of the region, counterclockwise. (A side may be a single point.)" },
            { statement: md`$\displaystyle\int_{C_2} P\,dx = \int_{C_4} P\,dx = 0$`, reason: md`On a vertical side $x$ is constant, so $dx = 0$.` },
            { statement: md`$\displaystyle\int_{C_1} P\,dx = \int_a^b P(x, g_1(x))\,dx$`, reason: md`Parametrize $C_1$ by $x$ itself: $\mathbf{r}(x) = \langle x, g_1(x) \rangle$, $a \le x \le b$, so $dx = dx$.` },
            { statement: md`$\displaystyle\int_{C_3} P\,dx = -\int_a^b P(x, g_2(x))\,dx$`, reason: md`$C_3$ runs from $x = b$ back to $x = a$; reversing a curve reverses the sign.` },
            { statement: md`$\displaystyle\oint_C P\,dx = \int_a^b \big[P(x, g_1(x)) - P(x, g_2(x))\big]\,dx = -\iint_D \frac{\partial P}{\partial y}\,dA$`, reason: "Add steps 4 to 6 and compare with step 2." },
          ],
        },
        {
          kind: "text",
          body: md`The $Q$ part is the same argument with the roles of $x$ and $y$ swapped: for a region between two graphs $x = h_1(y)$ and $x = h_2(y)$, the same steps give $\oint_C Q\,dy = \iint_D Q_x\,dA$ (with a plus sign, because the orientation now runs up the right graph and down the left one). A region that is of both types at once, like a disk, a rectangle or a triangle, gets the full theorem by adding the two parts. A more complicated region is cut into pieces of that kind; the cuts are traversed once in each direction by neighbouring pieces, so their line integrals cancel and only the outer boundary remains.`,
        },
        {
          kind: "example",
          title: "A line integral turned into a double integral",
          problem: md`Find $\oint_C xy\,dx + x^2\,dy$ where $C$ is the boundary of the triangle with vertices $(0, 0)$, $(1, 0)$ and $(1, 2)$, counterclockwise.`,
          steps: [
            { math: md`P = xy, \quad Q = x^2, \quad \frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y} = 2x - x = x`, note: "The scalar curl. Done directly, this would be three separate line integrals." },
            { math: md`\iint_D x\,dA = \int_0^1 \int_0^{2x} x\,dy\,dx`, note: md`For each $x$ in $[0, 1]$, $y$ runs from the bottom edge $y = 0$ to the slanted edge $y = 2x$.` },
            { math: md`= \int_0^1 2x^2\,dx = \frac{2}{3}`, note: "By Green's theorem this is the value of the line integral." },
          ],
        },
        {
          kind: "key",
          title: "Area by a line integral",
          body: md`Choosing $P$ and $Q$ with $Q_x - P_y = 1$ turns Green's theorem into a formula for the area of $D$:

$$A = \oint_C x\,dy = -\oint_C y\,dx = \frac{1}{2}\oint_C x\,dy - y\,dx.$$

The first uses $P = 0$, $Q = x$; the second $P = -y$, $Q = 0$; the third is their average. A planimeter, a mechanical instrument for measuring areas on maps, is a physical realization of this formula.`,
        },
        {
          kind: "example",
          title: "The area of an ellipse",
          problem: md`Find the area enclosed by $\mathbf{r}(t) = \langle a\cos t, b\sin t \rangle$, $0 \le t \le 2\pi$.`,
          steps: [
            { math: md`x\,dy - y\,dx = (a\cos t)(b\cos t)\,dt - (b\sin t)(-a\sin t)\,dt = ab\,dt`, note: md`$\cos^2 t + \sin^2 t = 1$.` },
            { math: md`A = \frac{1}{2}\int_0^{2\pi} ab\,dt = \pi ab`, note: md`With $a = b = r$ this is $\pi r^2$. Without Green's theorem this area needs a trigonometric substitution.` },
          ],
        },
        {
          kind: "example",
          title: "A double integral in polar form",
          problem: md`Find $\oint_C -y^3\,dx + x^3\,dy$ where $C$ is the circle $x^2 + y^2 = 4$, counterclockwise.`,
          steps: [
            { math: md`\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y} = 3x^2 + 3y^2 = 3r^2`, note: md`$P = -y^3$ and $Q = x^3$. The integrand is radial, so use polar coordinates.` },
            { math: md`\iint_D 3r^2\,dA = \int_0^{2\pi}\int_0^2 3r^2 \cdot r\,dr\,d\theta = 2\pi \cdot \frac{3 \cdot 16}{4} = 24\pi`, note: md`$dA = r\,dr\,d\theta$ (Unit 4).` },
          ],
        },
        {
          kind: "text",
          body: md`Green's theorem also finishes the converse of lesson 3's test. If $P_y = Q_x$ on a simply connected region, then any simple closed curve in it encloses a region $D$ that lies entirely in the domain (that is what "no holes" buys), so $\oint_C \mathbf{F} \cdot d\mathbf{r} = \iint_D 0\,dA = 0$. Zero work around every closed curve means path independence, and path independence means a potential exists: define $f(X)$ as the work from a fixed base point to $X$.`,
        },
        {
          kind: "check",
          prompt: md`Find $\oint_C -y\,dx + 3x\,dy$ where $C$ is the boundary of the unit square $0 \le x \le 1$, $0 \le y \le 1$, counterclockwise.`,
          answer: "4",
          explain: md`$Q_x - P_y = 3 - (-1) = 4$, a constant, times the area 1.`,
        },
        {
          kind: "check",
          prompt: md`Find $\oint_C x\,dy$ where $C$ is the boundary of the triangle with vertices $(0, 0)$, $(4, 0)$ and $(0, 3)$, counterclockwise.`,
          answer: "6",
          explain: md`$\oint_C x\,dy$ is the area enclosed: $\frac{1}{2} \cdot 4 \cdot 3 = 6$.`,
        },
      ],
      practice: [greenRegion, areaByLineIntegral, greenDisk],
    },
    {
      id: slug("Curl and divergence"),
      title: "Curl and divergence",
      summary: "Two derivatives of a vector field, how much it spins and how much it spreads, and the identities that connect them.",
      blocks: [
        {
          kind: "text",
          body: md`Green's theorem produced a derivative of a vector field, the scalar curl $Q_x - P_y$, with a clear meaning: circulation per unit area. This lesson defines its three-dimensional version and a second derivative with an equally clear meaning: how much the field flows outward from a point.`,
        },
        {
          kind: "key",
          title: "Divergence",
          body: md`For $\mathbf{F} = \langle P, Q, R \rangle$,

$$\operatorname{div}\mathbf{F} = \nabla \cdot \mathbf{F} = \frac{\partial P}{\partial x} + \frac{\partial Q}{\partial y} + \frac{\partial R}{\partial z}.$$

In the plane, $\operatorname{div}\mathbf{F} = P_x + Q_y$. The divergence is a scalar function. The notation $\nabla \cdot \mathbf{F}$ reads the symbol $\nabla = \langle \partial_x, \partial_y, \partial_z \rangle$ as a vector of derivative operators and takes a formal dot product.`,
        },
        {
          kind: "why",
          title: "Why divergence is outflow per unit area",
          body: md`Think of $\mathbf{F}$ as the velocity of a fluid in the plane, and take the same tiny rectangle as in Green's theorem. Fluid leaves through the right edge at a rate of about $P(x + \Delta x, y)\,\Delta y$ (the normal component of velocity, $P$, times the edge length) and enters through the left edge at about $P(x, y)\,\Delta y$. Through the top it leaves at $Q(x, y + \Delta y)\,\Delta x$ and through the bottom it enters at $Q(x, y)\,\Delta x$. Net outflow:

$$\big[P(x + \Delta x, y) - P(x, y)\big]\Delta y + \big[Q(x, y + \Delta y) - Q(x, y)\big]\Delta x \approx \left(\frac{\partial P}{\partial x} + \frac{\partial Q}{\partial y}\right)\Delta x\,\Delta y.$$

So $\operatorname{div}\mathbf{F}$ is the net outflow per unit area (per unit volume in space). Positive divergence means fluid appears there, a **source**; negative means it disappears, a **sink**; zero everywhere means the flow is **incompressible**. The same count over a tiny box, with the two $z$-faces contributing $R_z$, gives the three-dimensional formula.`,
        },
        divergencePlot,
        shearPlot,
        {
          kind: "key",
          title: "Curl",
          body: md`For $\mathbf{F} = \langle P, Q, R \rangle$,

$$\operatorname{curl}\mathbf{F} = \nabla \times \mathbf{F} = \begin{vmatrix} \mathbf{i} & \mathbf{j} & \mathbf{k} \\ \partial_x & \partial_y & \partial_z \\ P & Q & R \end{vmatrix} = \left\langle \frac{\partial R}{\partial y} - \frac{\partial Q}{\partial z},\; \frac{\partial P}{\partial z} - \frac{\partial R}{\partial x},\; \frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y} \right\rangle.$$

The curl is a vector field. Its $\mathbf{k}$-component is the scalar curl $Q_x - P_y$ from Green's theorem. A field with $\operatorname{curl}\mathbf{F} = \mathbf{0}$ is **irrotational**.`,
        },
        {
          kind: "why",
          title: "Why those three components",
          body: md`Green's theorem showed that $Q_x - P_y$ is the circulation per unit area around a tiny loop lying in the $xy$-plane, a loop whose axis is $\mathbf{k}$. Now place the tiny loop in the $yz$-plane, with axis $\mathbf{i}$. Seen from the positive $x$-axis, the $y$-axis plays the part of $x$ and the $z$-axis the part of $y$, and the field's components in that plane are $Q$ and $R$. The same computation gives circulation density $R_y - Q_z$. A loop in the $zx$-plane, with axis $\mathbf{j}$, gives $P_z - R_x$ (the cyclic order $z, x$ matters for the sign).

So $\operatorname{curl}\mathbf{F} \cdot \mathbf{n}$ is the circulation density around the axis $\mathbf{n}$, for the three coordinate axes, and, since the dot product is linear, for every unit vector $\mathbf{n}$. It is largest when $\mathbf{n}$ points along $\operatorname{curl}\mathbf{F}$: the curl vector is the axis about which the field spins fastest, oriented by the right-hand rule, and its length is the circulation density about that axis.`,
        },
        {
          kind: "example",
          title: "Curl and divergence of a field in space",
          problem: md`Find $\operatorname{div}\mathbf{F}$ and $\operatorname{curl}\mathbf{F}$ for $\mathbf{F} = \langle xy, yz, zx \rangle$.`,
          steps: [
            { math: md`\operatorname{div}\mathbf{F} = \frac{\partial}{\partial x}(xy) + \frac{\partial}{\partial y}(yz) + \frac{\partial}{\partial z}(zx) = y + z + x`, note: "Each component differentiated with respect to its own variable." },
            { math: md`R_y - Q_z = 0 - y, \quad P_z - R_x = 0 - z, \quad Q_x - P_y = 0 - x`, note: md`Here $P = xy$, $Q = yz$, $R = zx$. Six partials, two per component.` },
            { math: md`\operatorname{curl}\mathbf{F} = \langle -y, -z, -x \rangle`, note: "The curl is a vector field; the divergence is a scalar one." },
          ],
        },
        {
          kind: "example",
          title: "A rigid rotation",
          problem: md`Find the curl of $\mathbf{F} = \langle -\omega y, \omega x, 0 \rangle$, the velocity field of a body rotating about the $z$-axis with angular speed $\omega$.`,
          steps: [
            { math: md`R_y - Q_z = 0, \quad P_z - R_x = 0, \quad Q_x - P_y = \omega - (-\omega) = 2\omega`, note: md`$P = -\omega y$, $Q = \omega x$, $R = 0$.` },
            { math: md`\operatorname{curl}\mathbf{F} = \langle 0, 0, 2\omega \rangle`, note: "The curl points along the axis of rotation and has length twice the angular speed. For any field, a tiny paddle wheel at a point spins fastest with its axis along the curl, at angular speed half the curl's length." },
          ],
        },
        {
          kind: "proof",
          title: "The curl of a gradient is zero",
          given: md`$f$ has continuous second partial derivatives`,
          prove: md`$\operatorname{curl}(\nabla f) = \mathbf{0}$`,
          steps: [
            { statement: md`$\nabla f = \langle f_x, f_y, f_z \rangle$, so $P = f_x$, $Q = f_y$, $R = f_z$.`, reason: "Definition of the gradient." },
            { statement: md`First component: $R_y - Q_z = f_{zy} - f_{yz} = 0$.`, reason: "Clairaut's theorem: mixed partials in either order agree when they are continuous." },
            { statement: md`Second component: $P_z - R_x = f_{xz} - f_{zx} = 0$.`, reason: "Clairaut's theorem." },
            { statement: md`Third component: $Q_x - P_y = f_{yx} - f_{xy} = 0$.`, reason: "Clairaut's theorem." },
            { statement: md`$\operatorname{curl}(\nabla f) = \mathbf{0}$.`, reason: "All three components vanish. A conservative field is irrotational." },
          ],
        },
        {
          kind: "why",
          title: "The divergence of a curl is zero, and what it means",
          body: md`Write it out:

$$\operatorname{div}(\operatorname{curl}\mathbf{F}) = (R_y - Q_z)_x + (P_z - R_x)_y + (Q_x - P_y)_z = R_{yx} - Q_{zx} + P_{zy} - R_{xy} + Q_{xz} - P_{yz}.$$

The terms cancel in pairs by Clairaut's theorem: $R_{yx} = R_{xy}$, $Q_{xz} = Q_{zx}$, $P_{zy} = P_{yz}$. So a curl field has no sources or sinks.

The two identities are the three-dimensional version of the test from lesson 3. If $\mathbf{F}$ is conservative then $\operatorname{curl}\mathbf{F} = \mathbf{0}$. Conversely, if $\operatorname{curl}\mathbf{F} = \mathbf{0}$ on a simply connected region of space (one where every loop can be shrunk to a point without leaving the region), then $\mathbf{F}$ is conservative. That converse will follow from Stokes' theorem in lesson 7.`,
        },
        {
          kind: "key",
          title: "The Laplacian and other identities",
          body: md`The divergence of a gradient is the **Laplacian**:

$$\nabla^2 f = \operatorname{div}(\nabla f) = f_{xx} + f_{yy} + f_{zz}.$$

Functions with $\nabla^2 f = 0$ are **harmonic**; they describe steady temperatures and electric potentials in empty space. Two product rules, each checked by writing out components:

- $\operatorname{div}(f\mathbf{F}) = f\,\operatorname{div}\mathbf{F} + \nabla f \cdot \mathbf{F}$
- $\operatorname{curl}(f\mathbf{F}) = f\,\operatorname{curl}\mathbf{F} + \nabla f \times \mathbf{F}$`,
        },
        {
          kind: "check",
          prompt: md`Find $\operatorname{div}\mathbf{F}$ for $\mathbf{F} = \langle x^2, xy, -2xz \rangle$.`,
          answer: "x",
          simplified: true,
          explain: md`$P_x + Q_y + R_z = 2x + x - 2x = x$.`,
        },
        {
          kind: "check",
          prompt: md`Find the $\mathbf{k}$-component of $\operatorname{curl}\mathbf{F}$ for $\mathbf{F} = \langle y^2, xy, z \rangle$.`,
          answer: "-y",
          simplified: true,
          explain: md`$Q_x - P_y = y - 2y = -y$.`,
        },
      ],
      practice: [divergence3D, curl3D, laplacian],
    },
    {
      id: slug("Surface integrals"),
      title: "Surface integrals",
      summary: "Integrating over a curved surface: parametrizations, the area element |r_u × r_v|, surface area, and flux.",
      blocks: [
        {
          kind: "text",
          body: md`A curve is one-dimensional, so one parameter $t$ describes it. A surface is two-dimensional, so it takes two:

$$\mathbf{r}(u, v) = \langle x(u, v), y(u, v), z(u, v) \rangle, \quad (u, v) \in D,$$

where $D$ is a region in the $uv$-plane. Three parametrizations come up constantly. A **graph** $z = g(x, y)$: $\mathbf{r}(x, y) = \langle x, y, g(x, y) \rangle$. A **sphere** of radius $R$, by the spherical angles of Unit 4: $\mathbf{r}(\phi, \theta) = \langle R\sin\phi\cos\theta, R\sin\phi\sin\theta, R\cos\phi \rangle$ with $0 \le \phi \le \pi$, $0 \le \theta \le 2\pi$. A **cylinder** $x^2 + y^2 = R^2$: $\mathbf{r}(\theta, z) = \langle R\cos\theta, R\sin\theta, z \rangle$.`,
        },
        {
          kind: "why",
          title: "Why the area element is |r_u × r_v| du dv",
          body: md`Take a small rectangle in the parameter plane with corner $(u, v)$ and sides $\Delta u$, $\Delta v$. The map $\mathbf{r}$ carries it to a small patch of the surface. Moving $\Delta u$ in the $u$ direction moves the point by about $\mathbf{r}_u\,\Delta u$, and moving $\Delta v$ moves it by about $\mathbf{r}_v\,\Delta v$: that is what the partial derivatives mean (linear approximation, Unit 3). So the patch is nearly the parallelogram spanned by $\mathbf{r}_u\,\Delta u$ and $\mathbf{r}_v\,\Delta v$, and the area of a parallelogram is the length of the cross product of its sides (Unit 1):

$$\Delta S \approx |\mathbf{r}_u\,\Delta u \times \mathbf{r}_v\,\Delta v| = |\mathbf{r}_u \times \mathbf{r}_v|\,\Delta u\,\Delta v.$$

Add the patches and take the limit. The cross product $\mathbf{r}_u \times \mathbf{r}_v$ is also perpendicular to both tangent vectors, so it is a **normal vector** to the surface; it will do double duty when we get to flux.`,
        },
        {
          kind: "key",
          title: "Surface area and surface integrals",
          body: md`$$A(S) = \iint_D |\mathbf{r}_u \times \mathbf{r}_v|\,dA, \qquad \iint_S f\,dS = \iint_D f(\mathbf{r}(u, v))\,|\mathbf{r}_u \times \mathbf{r}_v|\,dA.$$

For a graph $z = g(x, y)$, $\mathbf{r}_x = \langle 1, 0, g_x \rangle$ and $\mathbf{r}_y = \langle 0, 1, g_y \rangle$, so $\mathbf{r}_x \times \mathbf{r}_y = \langle -g_x, -g_y, 1 \rangle$ and

$$dS = \sqrt{1 + g_x^2 + g_y^2}\,dA.$$`,
        },
        paraboloidSurface,
        {
          kind: "example",
          title: "The area of a sphere",
          problem: md`Find the surface area of the sphere of radius $R$.`,
          steps: [
            { math: md`\mathbf{r}_\phi = \langle R\cos\phi\cos\theta, R\cos\phi\sin\theta, -R\sin\phi \rangle, \quad \mathbf{r}_\theta = \langle -R\sin\phi\sin\theta, R\sin\phi\cos\theta, 0 \rangle`, note: "Partial derivatives of the spherical parametrization." },
            { math: md`\mathbf{r}_\phi \times \mathbf{r}_\theta = R^2\sin\phi\,\langle \sin\phi\cos\theta, \sin\phi\sin\theta, \cos\phi \rangle`, note: md`The determinant, simplified with $\cos^2\theta + \sin^2\theta = 1$. The vector in brackets is the unit radial vector, so the normal points straight out.` },
            { math: md`|\mathbf{r}_\phi \times \mathbf{r}_\theta| = R^2\sin\phi`, note: md`The bracketed vector has length 1. Compare the volume element $\rho^2\sin\phi$ from Unit 4: the same factor, for the same reason.` },
            { math: md`A = \int_0^{2\pi}\int_0^{\pi} R^2\sin\phi\,d\phi\,d\theta = 2\pi \cdot R^2 \cdot 2 = 4\pi R^2`, note: md`$\int_0^\pi \sin\phi\,d\phi = 2$.` },
          ],
        },
        {
          kind: "example",
          title: "The area of a paraboloid",
          problem: md`Find the area of the part of $z = x^2 + y^2$ below $z = 1$.`,
          steps: [
            { math: md`dS = \sqrt{1 + (2x)^2 + (2y)^2}\,dA = \sqrt{1 + 4r^2}\,r\,dr\,d\theta`, note: md`A graph with $g_x = 2x$, $g_y = 2y$. The shadow is the unit disk, so polar coordinates.` },
            { math: md`A = \int_0^{2\pi}\int_0^1 r\sqrt{1 + 4r^2}\,dr\,d\theta = 2\pi\left[\frac{(1 + 4r^2)^{3/2}}{12}\right]_0^1`, note: md`Substitute $u = 1 + 4r^2$, $du = 8r\,dr$.` },
            { math: md`= \frac{\pi}{6}\left(5\sqrt{5} - 1\right)`, note: md`About $5.33$, against $\pi \approx 3.14$ for the flat shadow.` },
          ],
        },
        {
          kind: "text",
          body: md`**Flux.** Now let $\mathbf{F}$ be the velocity of a fluid and ask how much fluid crosses a surface $S$ per unit time. To make "crosses" meaningful, $S$ needs a chosen side: a unit normal $\mathbf{n}$ that varies continuously over $S$. A surface with such a choice is **oriented**; a sphere can be oriented outward or inward, a graph upward or downward. (The Möbius strip has no consistent choice and is excluded.) Through a small patch of area $\Delta S$, the volume crossing per unit time is a slanted column with base $\Delta S$ and height $\mathbf{F} \cdot \mathbf{n}$, the normal component of velocity: about $(\mathbf{F} \cdot \mathbf{n})\,\Delta S$. Fluid moving along the surface crosses nothing, and that is what the dot product takes care of.`,
        },
        {
          kind: "key",
          title: "Flux integral",
          body: md`The **flux** of $\mathbf{F}$ through an oriented surface $S$ is

$$\iint_S \mathbf{F} \cdot d\mathbf{S} = \iint_S \mathbf{F} \cdot \mathbf{n}\,dS = \iint_D \mathbf{F}(\mathbf{r}(u, v)) \cdot (\mathbf{r}_u \times \mathbf{r}_v)\,dA,$$

provided $\mathbf{r}_u \times \mathbf{r}_v$ points to the chosen side (otherwise, swap the sign). For a graph $z = g(x, y)$ with upward normal,

$$\iint_S \mathbf{F} \cdot d\mathbf{S} = \iint_D \left(-P\,g_x - Q\,g_y + R\right) dA,$$

with $z = g(x, y)$ substituted into $P$, $Q$ and $R$.`,
        },
        {
          kind: "why",
          title: "Why the normal and the area element combine so neatly",
          body: md`The unit normal is $\mathbf{n} = \dfrac{\mathbf{r}_u \times \mathbf{r}_v}{|\mathbf{r}_u \times \mathbf{r}_v|}$ and the area element is $dS = |\mathbf{r}_u \times \mathbf{r}_v|\,dA$. Multiply:

$$\mathbf{n}\,dS = (\mathbf{r}_u \times \mathbf{r}_v)\,dA.$$

The length cancels. That is why flux integrals are usually easier than area integrals: the square root never appears. For a graph, $\mathbf{r}_x \times \mathbf{r}_y = \langle -g_x, -g_y, 1 \rangle$ dotted with $\langle P, Q, R \rangle$ gives the formula in the box.`,
        },
        {
          kind: "example",
          title: "Flux through a sphere",
          problem: md`Find the outward flux of $\mathbf{F} = \langle x, y, z \rangle$ through the sphere $x^2 + y^2 + z^2 = R^2$.`,
          steps: [
            { math: md`\mathbf{n} = \frac{\langle x, y, z \rangle}{R} \quad\text{on the sphere}`, note: "The outward unit normal of a sphere points along the position vector." },
            { math: md`\mathbf{F} \cdot \mathbf{n} = \frac{x^2 + y^2 + z^2}{R} = \frac{R^2}{R} = R`, note: "On the sphere the field is radial with length R, so its normal component is R everywhere." },
            { math: md`\iint_S \mathbf{F} \cdot d\mathbf{S} = \iint_S R\,dS = R \cdot 4\pi R^2 = 4\pi R^3`, note: "A constant times the area. Lesson 8 gets the same number another way." },
          ],
        },
        {
          kind: "example",
          title: "Flux through a graph",
          problem: md`Find the upward flux of $\mathbf{F} = \langle 0, 0, z \rangle$ through the part of $z = 4 - x^2 - y^2$ above the $xy$-plane.`,
          steps: [
            { math: md`g_x = -2x, \quad g_y = -2y, \quad -P\,g_x - Q\,g_y + R = z = 4 - x^2 - y^2`, note: md`Only $R$ survives since $P = Q = 0$; then substitute $z = g(x, y)$.` },
            { math: md`\iint_D (4 - x^2 - y^2)\,dA = \int_0^{2\pi}\int_0^2 (4 - r^2)\,r\,dr\,d\theta`, note: md`The shadow $D$ is the disk $x^2 + y^2 \le 4$ where $z \ge 0$.` },
            { math: md`= 2\pi\left[2r^2 - \frac{r^4}{4}\right]_0^2 = 2\pi(8 - 4) = 8\pi`, note: "No square root anywhere." },
          ],
        },
        {
          kind: "check",
          prompt: md`A region $D$ in the $xy$-plane has area 5. Find the area of the part of the plane $z = 2x + 2y + 1$ above $D$.`,
          answer: "15",
          explain: md`$dS = \sqrt{1 + 2^2 + 2^2}\,dA = 3\,dA$, so the area is $3 \cdot 5 = 15$.`,
        },
        {
          kind: "check",
          prompt: md`Find the upward flux of $\mathbf{F} = \langle 0, 0, 3 \rangle$ through the part of the plane $z = x + y$ above the rectangle $0 \le x \le 2$, $0 \le y \le 1$.`,
          answer: "6",
          explain: md`$-P\,g_x - Q\,g_y + R = 0 - 0 + 3 = 3$, times the shadow's area 2.`,
        },
      ],
      practice: [surfaceArea, fluxPlanePiece, normalVector],
    },
    {
      id: slug("Stokes' theorem"),
      title: "Stokes' theorem",
      summary: "Green's theorem lifted into space: the circulation around a boundary equals the flux of the curl through any surface it bounds.",
      blocks: [
        {
          kind: "text",
          body: md`Green's theorem says $\oint_C \mathbf{F} \cdot d\mathbf{r} = \iint_D (Q_x - P_y)\,dA$. Read with lesson 5 in mind, $Q_x - P_y = \operatorname{curl}\mathbf{F} \cdot \mathbf{k}$, and $\mathbf{k}$ is the upward unit normal of the flat region $D$. So Green's theorem says: the circulation around $C$ equals the flux of $\operatorname{curl}\mathbf{F}$ through the surface $D$ that $C$ bounds. Stokes' theorem says the same thing when the surface is allowed to bend.`,
        },
        {
          kind: "key",
          title: "Stokes' theorem",
          body: md`Let $S$ be an oriented piecewise-smooth surface whose boundary is a simple closed piecewise-smooth curve $C$, oriented to match $S$: walking along $C$ with your head pointing along $\mathbf{n}$, the surface is on your left. If $\mathbf{F}$ has continuous partial derivatives on a region containing $S$, then

$$\oint_C \mathbf{F} \cdot d\mathbf{r} = \iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S}.$$

For a graph with upward normal, "matching" means counterclockwise when seen from above.`,
        },
        capSurface,
        {
          kind: "why",
          title: "Why it should be true",
          body: md`Tile $S$ with tiny patches. Each patch is nearly flat with normal $\mathbf{n}$, and by lesson 5 the circulation around it is about $(\operatorname{curl}\mathbf{F} \cdot \mathbf{n})\,\Delta S$: circulation density times area. Add up all the patches. Every interior edge is shared by two patches that traverse it in opposite directions, so those contributions cancel, and only the outer boundary $C$ survives. The sum of the circulations is $\oint_C \mathbf{F} \cdot d\mathbf{r}$ on one side and $\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S}$ on the other. The proof below makes this exact for a graph surface by reducing it to Green's theorem.`,
        },
        {
          kind: "proof",
          title: "Stokes' theorem for a graph surface",
          given: md`$S$ is the graph $z = g(x, y)$ over a region $D$ with upward normal, $g$ has continuous second partials, $C$ is the boundary of $S$ and $C'$ the boundary of $D$ (counterclockwise), and $\mathbf{F} = \langle P, Q, R \rangle$`,
          prove: md`$\displaystyle\oint_C \mathbf{F} \cdot d\mathbf{r} = \iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S}$`,
          steps: [
            { statement: md`On $C$, $z = g(x, y)$, so $dz = g_x\,dx + g_y\,dy$.`, reason: md`Chain rule: $C$ sits directly above $C'$.` },
            { statement: md`$\displaystyle\oint_C P\,dx + Q\,dy + R\,dz = \oint_{C'} (P + R\,g_x)\,dx + (Q + R\,g_y)\,dy$, with $P, Q, R$ evaluated at $(x, y, g(x, y))$.`, reason: "Substitute step 1 and collect the dx and dy terms. The line integral is now in the plane." },
            { statement: md`$\displaystyle = \iint_D \left[\frac{\partial}{\partial x}(Q + R\,g_y) - \frac{\partial}{\partial y}(P + R\,g_x)\right] dA$`, reason: md`Green's theorem on $D$.` },
            { statement: md`$\displaystyle\frac{\partial}{\partial x}(Q + R\,g_y) = Q_x + Q_z g_x + R_x g_y + R_z g_x g_y + R\,g_{yx}$`, reason: md`Chain rule, since $Q$ and $R$ depend on $x$ directly and through $z = g$; product rule on $R\,g_y$.` },
            { statement: md`$\displaystyle\frac{\partial}{\partial y}(P + R\,g_x) = P_y + P_z g_y + R_y g_x + R_z g_y g_x + R\,g_{xy}$`, reason: "The same, with x and y swapped." },
            { statement: md`Difference: $(Q_x - P_y) - g_x(R_y - Q_z) - g_y(P_z - R_x)$`, reason: md`Subtract: the $R_z g_x g_y$ terms cancel, and $R\,g_{yx} = R\,g_{xy}$ by Clairaut's theorem. Regroup the rest.` },
            { statement: md`$= \operatorname{curl}\mathbf{F} \cdot \langle -g_x, -g_y, 1 \rangle$`, reason: md`$\operatorname{curl}\mathbf{F} = \langle R_y - Q_z, P_z - R_x, Q_x - P_y \rangle$ dotted with the upward normal of a graph.` },
            { statement: md`$\displaystyle\oint_C \mathbf{F} \cdot d\mathbf{r} = \iint_D \operatorname{curl}\mathbf{F} \cdot \langle -g_x, -g_y, 1 \rangle\,dA = \iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S}$`, reason: "The flux integral through a graph with upward normal (lesson 6)." },
          ],
        },
        {
          kind: "example",
          title: "Both sides of Stokes' theorem",
          problem: md`Let $\mathbf{F} = \langle -y, x, z \rangle$, let $S$ be the cap $z = 4 - x^2 - y^2$, $z \ge 0$, with upward normal, and let $C$ be its boundary. Compute $\oint_C \mathbf{F} \cdot d\mathbf{r}$ directly and as a flux.`,
          steps: [
            { math: md`C: \; \mathbf{r}(t) = \langle 2\cos t, 2\sin t, 0 \rangle, \quad 0 \le t \le 2\pi`, note: md`The rim, where $z = 0$: the circle $x^2 + y^2 = 4$, counterclockwise from above.` },
            { math: md`\mathbf{F} \cdot \mathbf{r}' = \langle -2\sin t, 2\cos t, 0 \rangle \cdot \langle -2\sin t, 2\cos t, 0 \rangle = 4, \quad \oint_C \mathbf{F} \cdot d\mathbf{r} = \int_0^{2\pi} 4\,dt = 8\pi`, note: "Direct computation of the circulation." },
            { math: md`\operatorname{curl}\mathbf{F} = \langle 0 - 0, 0 - 0, 1 - (-1) \rangle = \langle 0, 0, 2 \rangle`, note: "A constant curl." },
            { math: md`\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S} = \iint_D \langle 0, 0, 2 \rangle \cdot \langle 2x, 2y, 1 \rangle\,dA = \iint_D 2\,dA = 2 \cdot 4\pi = 8\pi`, note: md`Flux through the graph with upward normal $\langle -g_x, -g_y, 1 \rangle = \langle 2x, 2y, 1 \rangle$; the shadow $D$ is the disk of radius 2. The two sides agree.` },
          ],
        },
        {
          kind: "key",
          title: "What Stokes' theorem buys",
          body: md`- **Surface independence.** Two surfaces with the same oriented boundary have the same flux of $\operatorname{curl}\mathbf{F}$, since both equal the circulation around that boundary. A hard curved surface can be swapped for a flat one.
- **Closed surfaces.** A closed surface (a sphere, say) has no boundary, so $\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S} = 0$ over it.
- **The curl test in space.** If $\operatorname{curl}\mathbf{F} = \mathbf{0}$ on a simply connected region, then every closed curve in it bounds a surface inside the region, so $\oint_C \mathbf{F} \cdot d\mathbf{r} = 0$ for every closed curve, and $\mathbf{F}$ is conservative.`,
        },
        {
          kind: "example",
          title: "Swapping a curved surface for a flat one",
          problem: md`Let $\mathbf{F} = \langle z^2, 2x, y^3 \rangle$ and let $S$ be the hemisphere $x^2 + y^2 + z^2 = 9$, $z \ge 0$, with upward normal. Find $\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S}$.`,
          steps: [
            { math: md`\partial S: \; x^2 + y^2 = 9, \; z = 0`, note: "The rim of the hemisphere, counterclockwise from above. The flat disk D inside it has the same oriented boundary." },
            { math: md`\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S} = \oint_{\partial S} \mathbf{F} \cdot d\mathbf{r} = \iint_D \operatorname{curl}\mathbf{F} \cdot \mathbf{k}\,dA`, note: "Stokes' theorem twice: for the hemisphere and for the disk." },
            { math: md`\operatorname{curl}\mathbf{F} \cdot \mathbf{k} = Q_x - P_y = 2 - 0 = 2`, note: md`Only the $\mathbf{k}$-component is needed. The $z^2$ in $P$ has no effect: $P_y = 0$.` },
            { math: md`\iint_D 2\,dA = 2 \cdot 9\pi = 18\pi`, note: "A constant times the area of the disk of radius 3. The hemisphere was never parametrized." },
          ],
        },
        {
          kind: "why",
          title: "Why curl · n is circulation density, made precise",
          body: md`Apply Stokes' theorem to a tiny flat disk $S_\varepsilon$ of radius $\varepsilon$ centred at a point $p$ with normal $\mathbf{n}$. On such a small disk $\operatorname{curl}\mathbf{F} \cdot \mathbf{n}$ is nearly its value at $p$, so

$$\oint_{C_\varepsilon} \mathbf{F} \cdot d\mathbf{r} = \iint_{S_\varepsilon} \operatorname{curl}\mathbf{F} \cdot \mathbf{n}\,dS \approx \operatorname{curl}\mathbf{F}(p) \cdot \mathbf{n}\;\pi\varepsilon^2.$$

Dividing by the area and letting $\varepsilon \to 0$: $\operatorname{curl}\mathbf{F}(p) \cdot \mathbf{n}$ is the limit of circulation per unit area around the axis $\mathbf{n}$. This is the definition-free meaning of curl that lesson 5 promised, and it shows the curl does not depend on the coordinate system used to compute it.`,
        },
        {
          kind: "check",
          prompt: md`Let $\mathbf{F} = \langle -2y, 2x, 5z \rangle$ and let $C$ be the circle $x^2 + y^2 = 1$ in the plane $z = 3$, counterclockwise seen from above. Find $\oint_C \mathbf{F} \cdot d\mathbf{r}$. Give the exact answer in terms of $\pi$ (type pi).`,
          answer: "4pi",
          explain: md`$\operatorname{curl}\mathbf{F} = \langle 0, 0, 4 \rangle$. Through the flat unit disk with normal $\mathbf{k}$ the flux is $4 \cdot \pi \cdot 1^2 = 4\pi$.`,
        },
        {
          kind: "check",
          prompt: md`Let $\mathbf{F} = \langle y^2, x, xyz \rangle$ and let $C$ be the boundary of the square $0 \le x \le 2$, $0 \le y \le 2$ in the plane $z = 1$, counterclockwise seen from above. Find $\oint_C \mathbf{F} \cdot d\mathbf{r}$.`,
          answer: "-4",
          explain: md`$\operatorname{curl}\mathbf{F} \cdot \mathbf{k} = Q_x - P_y = 1 - 2y$. Over the square, $\int_0^2\int_0^2 (1 - 2y)\,dy\,dx = \int_0^2 (2 - 4)\,dx = -4$.`,
        },
      ],
      practice: [stokesFlat, stokesTilted, stokesSwap],
    },
    {
      id: slug("The divergence theorem"),
      title: "The divergence theorem",
      summary: "Flux out of a closed surface equals the total divergence inside: statement, proof for a box, and what it says about sources and sinks.",
      blocks: [
        {
          kind: "text",
          body: md`Lesson 5 found that divergence is outflow per unit volume. Add that up over a solid region, and the total should be the net outflow through the region's surface: fluid created inside has to leave through the boundary. That is the divergence theorem, the last of the three big theorems, and the same cancellation idea proves it.`,
        },
        {
          kind: "key",
          title: "The divergence theorem (Gauss's theorem)",
          body: md`Let $E$ be a solid region whose boundary $S$ is a closed piecewise-smooth surface with **outward** normal, and let $\mathbf{F}$ have continuous partial derivatives on $E$. Then

$$\iint_S \mathbf{F} \cdot d\mathbf{S} = \iiint_E \operatorname{div}\mathbf{F}\,dV.$$`,
        },
        {
          kind: "proof",
          title: "The divergence theorem for a box",
          given: md`$E = [0, a] \times [0, b] \times [0, c]$ and $\mathbf{F} = \langle 0, 0, R \rangle$`,
          prove: md`$\displaystyle\iint_S \mathbf{F} \cdot d\mathbf{S} = \iiint_E \frac{\partial R}{\partial z}\,dV$`,
          steps: [
            { statement: md`On the four vertical faces, $\mathbf{n} = \pm\mathbf{i}$ or $\pm\mathbf{j}$, so $\mathbf{F} \cdot \mathbf{n} = 0$.`, reason: md`$\mathbf{F}$ has only a $\mathbf{k}$-component, which is tangent to those faces.` },
            { statement: md`On the top face $z = c$, $\mathbf{n} = \mathbf{k}$: $\displaystyle\iint_{\text{top}} \mathbf{F} \cdot d\mathbf{S} = \int_0^a\int_0^b R(x, y, c)\,dy\,dx$.`, reason: md`$\mathbf{F} \cdot \mathbf{k} = R$, and $dS = dA$ on a horizontal face.` },
            { statement: md`On the bottom face $z = 0$, $\mathbf{n} = -\mathbf{k}$: $\displaystyle\iint_{\text{bottom}} \mathbf{F} \cdot d\mathbf{S} = -\int_0^a\int_0^b R(x, y, 0)\,dy\,dx$.`, reason: "Outward on the bottom means downward." },
            { statement: md`$\displaystyle\iint_S \mathbf{F} \cdot d\mathbf{S} = \int_0^a\int_0^b \big[R(x, y, c) - R(x, y, 0)\big]\,dy\,dx$`, reason: "Add the six faces: only the top and bottom contribute." },
            { statement: md`$\displaystyle R(x, y, c) - R(x, y, 0) = \int_0^c \frac{\partial R}{\partial z}\,dz$`, reason: md`The fundamental theorem of calculus in $z$, with $x$ and $y$ fixed.` },
            { statement: md`$\displaystyle\iint_S \mathbf{F} \cdot d\mathbf{S} = \int_0^a\int_0^b\int_0^c \frac{\partial R}{\partial z}\,dz\,dy\,dx = \iiint_E \frac{\partial R}{\partial z}\,dV$`, reason: "Substitute step 5 into step 4; the iterated integral is the triple integral over the box." },
            { statement: md`For a general $\mathbf{F} = \langle P, Q, R \rangle$, the same argument on the $x$-faces and $y$-faces gives $\iiint_E P_x\,dV$ and $\iiint_E Q_y\,dV$; adding the three gives $\iiint_E \operatorname{div}\mathbf{F}\,dV$.`, reason: "Flux and divergence are both linear in F." },
          ],
        },
        {
          kind: "why",
          title: "From boxes to any solid",
          body: md`Cut a solid $E$ into many tiny boxes and apply the theorem to each. Where two boxes share a face, their outward normals point in opposite directions, so the flux out of one is the flux into the other and the two cancel. Adding all the box equations, the left side collapses to the flux through the outer surface of $E$ (the faces that aren't shared, which approximate $S$), and the right side is the sum of the triple integrals, which is $\iiint_E \operatorname{div}\mathbf{F}\,dV$. A rigorous version proves the theorem for regions between two graphs, like the proof of Green's theorem, and cuts a general region into such pieces. It is the third time the same pattern has appeared: interior contributions cancel in pairs, and only the boundary is left.`,
        },
        {
          kind: "example",
          title: "The sphere again",
          problem: md`Find the outward flux of $\mathbf{F} = \langle x, y, z \rangle$ through the sphere of radius $R$.`,
          steps: [
            { math: md`\operatorname{div}\mathbf{F} = 1 + 1 + 1 = 3`, note: "A constant." },
            { math: md`\iint_S \mathbf{F} \cdot d\mathbf{S} = \iiint_E 3\,dV = 3 \cdot \frac{4}{3}\pi R^3 = 4\pi R^3`, note: "The same answer lesson 6 got by computing F·n on the sphere, now without touching the surface." },
          ],
        },
        {
          kind: "example",
          title: "A flux that is hard directly",
          problem: md`Find the outward flux of $\mathbf{F} = \langle x^3, y^3, z^3 \rangle$ through the sphere of radius $R$.`,
          steps: [
            { math: md`\operatorname{div}\mathbf{F} = 3x^2 + 3y^2 + 3z^2 = 3\rho^2`, note: "Not constant, but radial: spherical coordinates (Unit 4)." },
            { math: md`\iiint_E 3\rho^2\,dV = \int_0^{2\pi}\int_0^\pi\int_0^R 3\rho^2 \cdot \rho^2\sin\phi\,d\rho\,d\phi\,d\theta`, note: md`$dV = \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$.` },
            { math: md`= 3 \cdot \frac{R^5}{5} \cdot 2 \cdot 2\pi = \frac{12\pi R^5}{5}`, note: md`$\int_0^R \rho^4\,d\rho = \frac{R^5}{5}$ and $\int_0^\pi \sin\phi\,d\phi = 2$.` },
          ],
        },
        {
          kind: "example",
          title: "Flux out of a cube",
          problem: md`Find the outward flux of $\mathbf{F} = \langle xy, yz, zx \rangle$ through the surface of the unit cube $[0, 1]^3$.`,
          steps: [
            { math: md`\operatorname{div}\mathbf{F} = y + z + x`, note: "From lesson 5." },
            { math: md`\iiint_E (x + y + z)\,dV = 3\int_0^1\int_0^1\int_0^1 x\,dz\,dy\,dx = 3 \cdot \frac{1}{2} = \frac{3}{2}`, note: "By symmetry the three variables contribute equally; each integrates to 1/2 over the cube. Six face integrals avoided." },
          ],
        },
        {
          kind: "why",
          title: "Sources, sinks and the inverse-square field",
          body: md`If $\operatorname{div}\mathbf{F}(p) > 0$, then for a tiny ball around $p$ the right side of the theorem is positive, so more fluid leaves the ball than enters: $p$ is a source. If $\operatorname{div}\mathbf{F} = 0$ everywhere, what flows into any region flows out again.

Now take $\mathbf{F} = \dfrac{\langle x, y, z \rangle}{(x^2 + y^2 + z^2)^{3/2}}$, the inverse-square field of gravity or of a point charge at the origin. Away from the origin a (patient) computation gives $\operatorname{div}\mathbf{F} = 0$. Yet on a sphere of radius $R$ centred at the origin, $\mathbf{F} = \mathbf{n}/R^2$, so the outward flux is $\frac{1}{R^2} \cdot 4\pi R^2 = 4\pi$, not 0. There is no contradiction: the theorem needs $\mathbf{F}$ to have continuous partials throughout $E$, and it fails to exist at the origin. Apply the theorem instead to the region between a sphere of radius $R$ and any closed surface $S$ enclosing it: there $\operatorname{div}\mathbf{F} = 0$, so the flux through $S$ equals the flux through the sphere, $4\pi$. The flux of an inverse-square field through any closed surface around its source is the same. That is Gauss's law, and it is the divergence theorem at work.`,
        },
        outflowPlot,
        {
          kind: "key",
          title: "One pattern, three theorems",
          body: md`Each big theorem of this unit says: the integral of a derivative over a region equals the integral of the original quantity over the region's boundary.

- **Fundamental theorem for line integrals:** $\int_C \nabla f \cdot d\mathbf{r} = f(B) - f(A)$. Region: a curve. Boundary: two points.
- **Green's and Stokes' theorems:** $\iint_S \operatorname{curl}\mathbf{F} \cdot d\mathbf{S} = \oint_C \mathbf{F} \cdot d\mathbf{r}$. Region: a surface. Boundary: a closed curve.
- **Divergence theorem:** $\iiint_E \operatorname{div}\mathbf{F}\,dV = \iint_S \mathbf{F} \cdot d\mathbf{S}$. Region: a solid. Boundary: a closed surface.

The one-variable fundamental theorem, $\int_a^b F'(x)\,dx = F(b) - F(a)$, is the first case of all of them.`,
        },
        {
          kind: "check",
          prompt: md`Find the outward flux of $\mathbf{F} = \langle 2x, 3y, -z \rangle$ through the sphere $x^2 + y^2 + z^2 = 9$. Give the exact answer in terms of $\pi$ (type pi).`,
          answer: "144pi",
          explain: md`$\operatorname{div}\mathbf{F} = 2 + 3 - 1 = 4$, times the volume $\frac{4}{3}\pi \cdot 27 = 36\pi$: $144\pi$.`,
        },
        {
          kind: "check",
          prompt: md`Find the outward flux of $\mathbf{F} = \langle x^2, 0, 0 \rangle$ through the surface of the box $0 \le x \le 2$, $0 \le y \le 1$, $0 \le z \le 3$.`,
          answer: "12",
          explain: md`$\operatorname{div}\mathbf{F} = 2x$, and $\iiint_E 2x\,dV = \left(\int_0^2 2x\,dx\right) \cdot 1 \cdot 3 = 4 \cdot 3 = 12$. Directly: only the face $x = 2$ carries flux, $2^2 \cdot (1 \cdot 3) = 12$.`,
        },
      ],
      practice: [fluxBox, fluxSphere, fluxFaces],
    },
  ],
};
