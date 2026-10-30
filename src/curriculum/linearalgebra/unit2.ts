import { fracTex, gcd, paren, poly, type Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

type Vec = number[];

const U = "\\mathbf{u}";
const V = "\\mathbf{v}";
const W = "\\mathbf{w}";
const B = "\\mathbf{b}";
const ZERO = "\\mathbf{0}";

/** A column vector in LaTeX. */
const col = (v: (number | string)[]): string => `\\begin{bmatrix} ${v.join(" \\\\ ")} \\end{bmatrix}`;
/** A matrix in LaTeX from its rows. */
const mat = (rows: (number | string)[][]): string => `\\begin{bmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{bmatrix}`;
/** Several equations stacked and aligned on "=". */
const aligned = (lines: [string, string][]): string => `\\begin{aligned} ${lines.map(([l, r]) => `${l} &= ${r}`).join(" \\\\ ")} \\end{aligned}`;
/** A vector as typed-answer text. */
const tuple = (v: Vec): string => `(${v.join(", ")})`;
const span = (...vs: string[]): string => `\\operatorname{span}\\{${vs.join(", ")}\\}`;
const coefTex = (c: number): string => (c === 1 ? "" : c === -1 ? "-" : String(c));

const add = (u: Vec, v: Vec): Vec => u.map((x, i) => x + v[i]!);
const scale = (c: number, v: Vec): Vec => v.map((x) => c * x);
const combo = (cs: number[], vs: Vec[]): Vec => vs.reduce((acc, v, i) => add(acc, scale(cs[i]!, v)), vs[0]!.map(() => 0));
const det2 = (a: number, b: number, c: number, d: number): number => a * d - b * c;

/** A random nonzero vector with small integer entries. */
function vec(r: Rng, n: number, lo = -3, hi = 3): Vec {
  for (;;) {
    const v = Array.from({ length: n }, () => r.int(lo, hi));
    if (v.some((x) => x !== 0)) return v;
  }
}

/** Are u and v scalar multiples of each other (the zero vector counts as parallel to everything)? */
function parallel(u: Vec, v: Vec): boolean {
  for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) if (u[i]! * v[j]! - u[j]! * v[i]! !== 0) return false;
  return true;
}

function det3(u: Vec, v: Vec, w: Vec): number {
  return u[0]! * (v[1]! * w[2]! - v[2]! * w[1]!) - v[0]! * (u[1]! * w[2]! - u[2]! * w[1]!) + w[0]! * (u[1]! * v[2]! - u[2]! * v[1]!);
}

/** The 3x3 determinant of a matrix whose entries may be letters, as checker text (cofactor expansion along row 1). */
function det3Text(m: (number | string)[][]): string {
  const e = (x: number | string) => `(${x})`;
  const [[a, b, c], [d, f, g], [h, k, l]] = m as [[number | string, number | string, number | string], [number | string, number | string, number | string], [number | string, number | string, number | string]];
  return `${e(a)}*(${e(f)}*${e(l)} - ${e(g)}*${e(k)}) - ${e(b)}*(${e(d)}*${e(l)} - ${e(g)}*${e(h)}) + ${e(c)}*(${e(d)}*${e(k)} - ${e(f)}*${e(h)})`;
}

/** "2(1) - 3(-2) + (4)": one component of a combination, written out. */
function expandEntry(cs: number[], xs: number[]): string {
  let out = "";
  cs.forEach((c, j) => {
    const mag = Math.abs(c) === 1 ? `(${xs[j]})` : `${Math.abs(c)}(${xs[j]})`;
    out += !out ? (c < 0 ? `-${mag}` : mag) : c < 0 ? ` - ${mag}` : ` + ${mag}`;
  });
  return out;
}

/**
 * Solve a x + b y = p, c x + d y = q by elimination, where the solution is known to be
 * integers. Returns the worked steps with the unknowns named n1 and n2 (LaTeX).
 */
function solve2(a: number, b: number, p: number, c: number, d: number, q: number, n1: string, n2: string, labels: [string, string] = ["first", "second"]): { steps: Step[]; x: number; y: number } {
  const det = a * d - b * c;
  const y = (a * q - c * p) / det;
  const x = a !== 0 ? (p - b * y) / a : (q - d * y) / c;
  const [L1, L2] = labels;
  const eq = (l: number, m: number, rhs: number) => `${poly([[l, n1], [m, n2]])} = ${rhs}`;
  const steps: Step[] = [{ math: `${eq(a, b, p)}, \\qquad ${eq(c, d, q)}`, note: md`The ${L1} and ${L2} components, one equation each.` }];
  /** "3x = 7 ⇒ x = …", or just "x = …" when the coefficient is 1. */
  const direct = (coef: number, name: string, rhs: number, value: number) => (coef === 1 ? `${name} = ${value}` : `${poly([[coef, name]])} = ${rhs} \\quad\\Rightarrow\\quad ${name} = ${value}`);
  /** Substitute the known unknown and solve for the other. */
  const sub = (coef: number, name: string, rhs: number, other: number, otherVal: number, value: number) => {
    const scaled = other === 1 ? `(${otherVal})` : `${paren(other)}(${otherVal})`;
    const work = `${poly([[coef, name]])} = ${rhs}${other ? ` - ${scaled}` : ""} = ${rhs - other * otherVal}`;
    return coef === 1 ? work : `${work}, \\qquad ${name} = ${value}`;
  };
  if (a === 0) {
    steps.push({ math: direct(b, n2, p, y), note: md`The ${L1} equation has no $${n1}$ term, so it gives $${n2}$ at once.` });
    steps.push({ math: sub(c, n1, q, d, y, x), note: md`Substitute into the ${L2} equation.` });
  } else if (c === 0) {
    steps.push({ math: direct(d, n2, q, y), note: md`The ${L2} equation has no $${n1}$ term, so it gives $${n2}$ at once.` });
    steps.push({ math: sub(a, n1, p, b, y, x), note: md`Substitute into the ${L1} equation.` });
  } else if (b === 0) {
    steps.push({ math: direct(a, n1, p, x), note: md`The ${L1} equation has no $${n2}$ term, so it gives $${n1}$ at once.` });
    steps.push({ math: sub(d, n2, q, c, x, y), note: md`Substitute into the ${L2} equation.` });
  } else if (d === 0) {
    steps.push({ math: direct(c, n1, q, x), note: md`The ${L2} equation has no $${n2}$ term, so it gives $${n1}$ at once.` });
    steps.push({ math: sub(b, n2, p, a, x, y), note: md`Substitute into the ${L1} equation.` });
  } else {
    const how =
      a === 1 && c === 1
        ? md`The $${n1}$ terms already match.`
        : c === 1
          ? md`Multiply the ${L2} equation by ${a}, so the $${n1}$ terms match.`
          : a === 1
            ? md`Multiply the ${L1} equation by ${c}, so the $${n1}$ terms match.`
            : md`Multiply the ${L1} equation by ${c} and the ${L2} by ${a}, so the $${n1}$ terms match.`;
    if (!(a === 1 && c === 1)) steps.push({ math: `${eq(a * c, b * c, p * c)}, \\qquad ${eq(a * c, a * d, a * q)}`, note: how });
    steps.push({ math: `${poly([[b * c - a * d, n2]])} = ${p * c - a * q} \\quad\\Rightarrow\\quad ${n2} = ${y}`, note: md`Subtract the ${L2} equation from the ${L1}.` });
    steps.push({ math: sub(a, n1, p, b, y, x), note: md`Back-substitute into the ${L1} equation.` });
  }
  return { steps, x, y };
}

/**
 * Fraction-free row reduction to echelon form, with the matrix after each column as a step.
 * Rows stay integers: R_i <- p R_i - a R_pivot, then divided by any common factor.
 */
function reduce(rows: number[][]): { steps: Step[]; rank: number } {
  const m = rows.map((r) => [...r]);
  const n = m.length;
  const k = m[0]!.length;
  const steps: Step[] = [];
  let row = 0;
  let rank = 0;
  for (let c = 0; c < k && row < n; c++) {
    let p = -1;
    for (let i = row; i < n; i++) if (m[i]![c] !== 0 && (p < 0 || Math.abs(m[i]![c]!) < Math.abs(m[p]![c]!))) p = i;
    if (p < 0) continue;
    const notes: string[] = [];
    if (p !== row) {
      [m[p], m[row]] = [m[row]!, m[p]!];
      notes.push(md`swap $R_${row + 1}$ and $R_${p + 1}$`);
    }
    const piv = m[row]![c]!;
    for (let i = row + 1; i < n; i++) {
      const a = m[i]![c]!;
      if (a === 0) continue;
      const P = Math.abs(piv);
      const Q = piv > 0 ? -a : a;
      let newRow = m[i]!.map((x, j) => P * x + Q * m[row]![j]!);
      const g = newRow.reduce((acc, x) => gcd(acc, x), 0);
      let op = md`$R_${i + 1} \to ${P === 1 ? "" : P}R_${i + 1} ${Q < 0 ? "-" : "+"} ${Math.abs(Q) === 1 ? "" : Math.abs(Q)}R_${row + 1}$`;
      if (g > 1) {
        newRow = newRow.map((x) => x / g);
        op += md`, then divide $R_${i + 1}$ by ${g}`;
      }
      notes.push(op);
      m[i] = newRow;
    }
    rank++;
    row++;
    steps.push({ math: mat(m), note: notes.length ? notes.join("; ") + "." : md`Column ${c + 1} already has its pivot in place.` });
  }
  return { steps, rank };
}

/** Two non-parallel vectors in R^3 together with a "check row": the other two rows form an invertible 2x2. */
function pairWithCheckRow(r: Rng): { u: Vec; v: Vec; kr: number; i: number; j: number } {
  for (;;) {
    const u = vec(r, 3);
    const v = vec(r, 3);
    const kr = r.int(0, 2);
    const [i, j] = [0, 1, 2].filter((x) => x !== kr) as [number, number];
    if (det2(u[i]!, v[i]!, u[j]!, v[j]!) !== 0) return { u, v, kr, i, j };
  }
}

const ordinal = ["first", "second", "third", "fourth"];

// ── Lesson 1 generators ─────────────────────────────────────────────────────

const computeCombination: Generator = (r) => {
  const n = r.pick([2, 3, 3]);
  const count = r.next() < 0.6 ? 2 : 3;
  const names = [U, V, W].slice(0, count);
  const vs = Array.from({ length: count }, () => vec(r, n));
  const cs = Array.from({ length: count }, () => r.nonzero(-3, 3));
  if (cs.every((c) => Math.abs(c) === 1)) cs[0] = r.pick([2, -2, 3]);
  const result = combo(cs, vs);
  const exprTex = poly(cs.map((c, i) => [c, names[i]!]));
  const vars = n === 2 ? ["p", "q"] : ["p", "q", "r"];
  const weights = n === 2 ? [[1, 1], [1, -1]] : [[1, 1, 1], [1, -1, 1], [1, 1, -1]];
  const entry = (i: number) => cs.map((c, j) => `(${c})*(${vs[j]![i]})`).join(" + ");
  const verify = weights.map((w) => {
    const rhs = w.map((x, i) => (i === 0 ? `(${entry(i)})` : ` ${x < 0 ? "-" : "+"} (${entry(i)})`)).join("");
    return `${poly(w.map((x, i) => [x, vars[i]!]))} = ${rhs}`;
  });
  const given = vs.map((v, i) => `$${names[i]} = ${col(v)}$`);
  return {
    prompt: md`Let ${given.slice(0, -1).join(", ")} and ${given[given.length - 1]}. Find $${exprTex}$. Type the vector as ${n === 2 ? "(a, b)" : "(a, b, c)"}.`,
    answer: tuple(result),
    form: "tuple",
    verify,
    hint: "Scale each vector first (every component gets multiplied), then add matching components.",
    solution: [
      { math: cs.map((c, i) => `${coefTex(c)}${names[i]} = ${col(scale(c, vs[i]!))}`).join(", \\qquad "), note: "A scalar multiplies every component." },
      { math: `${exprTex} = ${col(result.map((_, i) => expandEntry(cs, vs.map((v) => v[i]!))))}`, note: "Add matching components." },
      { math: col(result), note: md`Typed as ${tuple(result)}.` },
    ],
  };
};

const findWeights2: Generator = (r) => {
  let u: Vec;
  let v: Vec;
  do {
    u = vec(r, 2);
    v = vec(r, 2);
  } while (parallel(u, v));
  const c1 = r.nonzero(-4, 4);
  const c2 = r.nonzero(-4, 4);
  const target = combo([c1, c2], [u, v]);
  const { steps } = solve2(u[0]!, v[0]!, target[0]!, u[1]!, v[1]!, target[1]!, "c_1", "c_2");
  return {
    prompt: md`Let $${U} = ${col(u)}$, $${V} = ${col(v)}$ and $${B} = ${col(target)}$. Find the weights $(c_1, c_2)$ with $c_1${U} + c_2${V} = ${B}$. Type them as (c1, c2).`,
    answer: tuple([c1, c2]),
    form: "tuple",
    verify: [`(${u[0]})*c + (${v[0]})*d = ${target[0]}`, `(${u[1]})*c + (${v[1]})*d = ${target[1]}`],
    hint: md`Match components. The first components give one equation in $c_1$ and $c_2$, the second components give another. Solve the pair by elimination.`,
    solution: [
      ...steps,
      {
        math: `(c_1, c_2) = ${tuple([c1, c2])}`,
        note: md`Check: $${expandEntry([c1, c2], [u[0]!, v[0]!])} = ${target[0]}$ and $${expandEntry([c1, c2], [u[1]!, v[1]!])} = ${target[1]}$.`,
      },
    ],
  };
};

const findWeights3: Generator = (r) => {
  if (r.next() < 0.5) {
    // Three vectors in R^3 arranged so the equations are triangular.
    const u = [r.pick([1, -1, 2]), r.int(-3, 3), r.int(-3, 3)];
    const v = [0, r.pick([1, -1, 2]), r.int(-3, 3)];
    const w = [0, 0, r.pick([1, -1, 2, 3])];
    const cs = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const target = combo(cs, [u, v, w]);
    const [c1, c2, c3] = cs as [number, number, number];
    const eq2 = `${poly([[v[1]!, "c_2"]])} = ${target[1]}${u[1] ? ` - ${paren(u[1]!)}(${c1})` : ""}`;
    const eq3rest = [u[2]! ? ` - ${paren(u[2]!)}(${c1})` : "", v[2]! ? ` - ${paren(v[2]!)}(${c2})` : ""].join("");
    return {
      prompt: md`Let $${U} = ${col(u)}$, $${V} = ${col(v)}$, $${W} = ${col(w)}$ and $${B} = ${col(target)}$. Find the weights $(c_1, c_2, c_3)$ with $c_1${U} + c_2${V} + c_3${W} = ${B}$. Type them as (c1, c2, c3).`,
      answer: tuple(cs),
      form: "tuple",
      verify: [0, 1, 2].map((i) => `(${u[i]})*a + (${v[i]})*b + (${w[i]})*c = ${target[i]}`),
      hint: md`Write one equation per component. The zeros in $${V}$ and $${W}$ make the system triangular: the first equation has only $c_1$ in it.`,
      solution: [
        {
          math: aligned([
            [poly([[u[0]!, "c_1"]]), String(target[0])],
            [poly([[u[1]!, "c_1"], [v[1]!, "c_2"]]), String(target[1])],
            [poly([[u[2]!, "c_1"], [v[2]!, "c_2"], [w[2]!, "c_3"]]), String(target[2])],
          ]),
          note: "One equation per component. Solve from the top down.",
        },
        { math: `c_1 = ${c1}`, note: md`From the first equation: divide by ${u[0]}.` },
        { math: `${eq2} = ${target[1]! - u[1]! * c1}, \\qquad c_2 = ${c2}`, note: md`Substitute $c_1 = ${c1}$ into the second equation.` },
        { math: `${poly([[w[2]!, "c_3"]])} = ${target[2]}${eq3rest} = ${target[2]! - u[2]! * c1 - v[2]! * c2}, \\qquad c_3 = ${c3}`, note: "Substitute both into the third equation." },
        { math: `(c_1, c_2, c_3) = ${tuple(cs)}`, note: "Check by recomputing the combination if you like: every component should match." },
      ],
    };
  }
  // Two vectors in R^3 with b in their span: two equations find the weights, the third confirms.
  const { u, v, kr, i, j } = pairWithCheckRow(r);
  const c1 = r.nonzero(-3, 3);
  const c2 = r.nonzero(-3, 3);
  const target = combo([c1, c2], [u, v]);
  const { steps } = solve2(u[i]!, v[i]!, target[i]!, u[j]!, v[j]!, target[j]!, "c_1", "c_2", [ordinal[i]!, ordinal[j]!]);
  return {
    prompt: md`Let $${U} = ${col(u)}$, $${V} = ${col(v)}$ and $${B} = ${col(target)}$. The vector $${B}$ is a combination of $${U}$ and $${V}$. Find the weights $(c_1, c_2)$ with $c_1${U} + c_2${V} = ${B}$. Type them as (c1, c2).`,
    answer: tuple([c1, c2]),
    form: "tuple",
    verify: [0, 1, 2].map((k) => `(${u[k]})*c + (${v[k]})*d = ${target[k]}`),
    hint: md`Three equations, two unknowns. Pick two of the equations (the ${ordinal[i]} and ${ordinal[j]} work well) and solve them; the third must agree.`,
    solution: [
      {
        math: aligned([0, 1, 2].map((k) => [poly([[u[k]!, "c_1"], [v[k]!, "c_2"]]), String(target[k])] as [string, string])),
        note: md`One equation per component. Use the ${ordinal[i]} and ${ordinal[j]} to find the weights.`,
      },
      ...steps.slice(1),
      {
        math: `${expandEntry([c1, c2], [u[kr]!, v[kr]!])} = ${target[kr]}`,
        note: md`The ${ordinal[kr]} equation agrees, as it must when $${B}$ is in the span. So $(c_1, c_2) = ${tuple([c1, c2])}$.`,
      },
    ],
  };
};

// ── Lesson 2 generators ─────────────────────────────────────────────────────

const inSpanQ: Generator = (r) => {
  if (r.next() < 0.3) {
    // One vector: b must be a multiple of v.
    const v = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const m = r.coef(-3, 3);
    const yes = r.next() < 0.5;
    const target = scale(m, v);
    const bad = r.int(1, 2);
    if (!yes) target[bad] = target[bad]! + r.nonzero(-2, 2);
    const mv = scale(m, v);
    return {
      prompt: md`Let $${V} = ${col(v)}$. Is $${B} = ${col(target)}$ in $${span(V)}$?`,
      choices: ["yes", "no"],
      accept: [yes ? "yes" : "no"],
      hint: md`The span of one vector is its multiples. If $${B} = c${V}$, the first components force a particular $c$. Does that $c$ work in every component?`,
      solution: [
        { math: `c = \\frac{${target[0]}}{${v[0]}} = ${m}`, note: md`If $${B} = c${V}$, the first components say $${v[0]}c = ${target[0]}$.` },
        { math: `${m}${V} = ${col(mv)}`, note: "The only candidate." },
        yes
          ? { math: `${B} = ${m}${V}`, note: md`Every component matches, so $${B}$ is in the span: **yes**.` }
          : { math: `${mv[bad]} \\ne ${target[bad]}`, note: md`The ${ordinal[bad]} components disagree. No multiple of $${V}$ equals $${B}$: **no**.` },
      ],
    };
  }
  const { u, v, kr, i, j } = pairWithCheckRow(r);
  const c1 = r.nonzero(-3, 3);
  const c2 = r.nonzero(-3, 3);
  const target = combo([c1, c2], [u, v]);
  const yes = r.next() < 0.5;
  if (!yes) target[kr] = target[kr]! + r.nonzero(-3, 3);
  const { steps } = solve2(u[i]!, v[i]!, target[i]!, u[j]!, v[j]!, target[j]!, "c_1", "c_2", [ordinal[i]!, ordinal[j]!]);
  const got = c1 * u[kr]! + c2 * v[kr]!;
  return {
    prompt: md`Let $${U} = ${col(u)}$ and $${V} = ${col(v)}$. Is $${B} = ${col(target)}$ in $${span(U, V)}$?`,
    choices: ["yes", "no"],
    accept: [yes ? "yes" : "no"],
    hint: md`$${B}$ is in the span exactly when $c_1${U} + c_2${V} = ${B}$ has a solution. Solve two of the component equations, then test the third.`,
    solution: [
      {
        math: aligned([0, 1, 2].map((k) => [poly([[u[k]!, "c_1"], [v[k]!, "c_2"]]), String(target[k])] as [string, string])),
        note: md`One equation per component. The ${ordinal[i]} and ${ordinal[j]} decide the weights.`,
      },
      ...steps.slice(1),
      {
        math: `${expandEntry([c1, c2], [u[kr]!, v[kr]!])} = ${got} ${yes ? "=" : "\\ne"} ${target[kr]}`,
        note: yes
          ? md`The ${ordinal[kr]} equation holds too, so $${B} = ${poly([[c1, U], [c2, V]])}$: **yes**.`
          : md`The only weights that fit the other two components fail the ${ordinal[kr]}. No combination reaches $${B}$: **no**.`,
      },
    ],
  };
};

const shapeOf = (rank: number, n: number): string =>
  rank === 1 ? "a line through the origin" : rank === n ? `all of $\\mathbb{R}^${n}$` : rank === 2 ? "a plane through the origin" : "the origin alone";

const spanDimension: Generator = (r) => {
  const kind = r.int(0, 4);
  let vs: Vec[];
  let n = 3;
  if (kind === 0) {
    // Two parallel vectors.
    n = r.pick([2, 3]);
    const u = vec(r, n);
    vs = [u, scale(r.pick([-2, -1, 2, 3]), u)];
  } else if (kind === 1) {
    // Two non-parallel vectors in R^3.
    let u: Vec;
    let v: Vec;
    do {
      u = vec(r, 3);
      v = vec(r, 3);
    } while (parallel(u, v));
    vs = [u, v];
  } else if (kind === 2) {
    // Three vectors, one a combination of the other two.
    let u: Vec;
    let v: Vec;
    do {
      u = vec(r, 3);
      v = vec(r, 3);
    } while (parallel(u, v));
    const w = combo([r.nonzero(-2, 2), r.nonzero(-2, 2)], [u, v]);
    vs = [u, v, w];
    const slot = r.int(0, 2);
    [vs[2], vs[slot]] = [vs[slot]!, vs[2]!];
  } else if (kind === 3) {
    // Three independent vectors.
    let u: Vec;
    let v: Vec;
    let w: Vec;
    do {
      u = vec(r, 3);
      v = vec(r, 3);
      w = vec(r, 3);
    } while (det3(u, v, w) === 0);
    vs = [u, v, w];
  } else {
    // Three vectors all on one line.
    const u = vec(r, 3, -2, 2);
    vs = [u, scale(r.pick([-1, 2, -2]), u), scale(r.pick([3, -3, 2]), u)];
  }
  const rows = vs[0]!.map((_, i) => vs.map((v) => v[i]!));
  const { steps, rank } = reduce(rows);
  return {
    prompt: md`Find the dimension of $${span(...vs.map((v) => col(v)))}$: the number of independent directions in it. Type a number.`,
    answer: String(rank),
    hint: "Put the vectors in as the columns of a matrix and row reduce. The dimension is the number of pivot columns.",
    solution: [
      { math: mat(rows), note: "The vectors as columns." },
      ...steps,
      { math: String(rank), note: md`${rank} pivot column${rank === 1 ? "" : "s"}, so the span has dimension ${rank}: ${shapeOf(rank, n)}.` },
    ],
  };
};

const spanParameter: Generator = (r) => {
  if (r.next() < 0.4) {
    const v = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
    const m = r.coef(-4, 4);
    const b1 = m * v[0]!;
    const k = m * v[1]!;
    return {
      prompt: md`Let $${V} = ${col(v)}$. For which value of $k$ is $${col([b1, "k"])}$ in $${span(V)}$? Type a number.`,
      answer: String(k),
      verify: [`(${b1})*(${v[1]}) = k*(${v[0]})`],
      hint: md`A vector in $${span(V)}$ is $c${V}$ for some $c$. The first component tells you $c$.`,
      solution: [
        { math: `${v[0]}c = ${b1} \\quad\\Rightarrow\\quad c = ${m}`, note: "The first components must match." },
        { math: `k = ${m}(${v[1]}) = ${k}`, note: md`Then the second component of $c${V}$ is $k$.` },
      ],
    };
  }
  const { u, v, kr, i, j } = pairWithCheckRow(r);
  const c1 = r.nonzero(-3, 3);
  const c2 = r.nonzero(-3, 3);
  const target = combo([c1, c2], [u, v]);
  const k = target[kr]!;
  const shown: (number | string)[] = target.map((x, idx) => (idx === kr ? "k" : x));
  const { steps } = solve2(u[i]!, v[i]!, target[i]!, u[j]!, v[j]!, target[j]!, "c_1", "c_2", [ordinal[i]!, ordinal[j]!]);
  return {
    prompt: md`Let $${U} = ${col(u)}$ and $${V} = ${col(v)}$. For which value of $k$ is $${col(shown)}$ in $${span(U, V)}$? Type a number.`,
    answer: String(k),
    verify: [`${det3Text([0, 1, 2].map((row) => [u[row]!, v[row]!, shown[row]!]))} = 0`],
    hint: md`The ${ordinal[i]} and ${ordinal[j]} components don't involve $k$. Use them to find the weights $c_1, c_2$, then compute the ${ordinal[kr]} component of $c_1${U} + c_2${V}$.`,
    solution: [
      {
        math: aligned([0, 1, 2].map((row) => [poly([[u[row]!, "c_1"], [v[row]!, "c_2"]]), String(shown[row])] as [string, string])),
        note: md`$c_1${U} + c_2${V} = ${col(shown)}$, one equation per component. Solve the two without $k$.`,
      },
      ...steps.slice(1),
      { math: `k = ${expandEntry([c1, c2], [u[kr]!, v[kr]!])} = ${k}`, note: md`The ${ordinal[kr]} component of $${poly([[c1, U], [c2, V]])}$ is the only value of $k$ that works.` },
    ],
  };
};

// ── Lesson 3 generators ─────────────────────────────────────────────────────

const independentQ: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind <= 1) {
    // Two vectors: a multiple or not.
    const n = r.pick([2, 3]);
    const u = vec(r, n);
    let v: Vec;
    if (kind === 0) v = scale(r.pick([-3, -2, -1, 2, 3]), u);
    else do v = vec(r, n); while (parallel(u, v));
    const dep = parallel(u, v);
    const i = u.findIndex((x) => x !== 0);
    const mTex = fracTex(v[i]!, u[i]!);
    const other = [...u.keys()].filter((k) => k !== i);
    const bad = other.find((k) => v[i]! * u[k]! !== v[k]! * u[i]!);
    return {
      prompt: md`Are $${col(u)}$ and $${col(v)}$ linearly independent?`,
      choices: ["yes", "no"],
      accept: [dep ? "no" : "yes"],
      hint: "Two vectors are dependent exactly when one is a scalar multiple of the other. Try to find the multiple from one component, then test it on the rest.",
      solution: [
        { math: `${V} = m${U} \\quad\\Rightarrow\\quad m = ${mTex}`, note: md`If $${V}$ is a multiple of $${U}$, the ${ordinal[i]} components fix $m$.` },
        dep
          ? { math: `${mTex}${col(u)} = ${col(v)}`, note: md`It works in every component, so $${V} = ${mTex}${U}$ and $${mTex}${U} - ${V} = ${ZERO}$ is a dependence relation: **no**, they are dependent.` }
          : {
              math: `${mTex}(${u[bad!]}) = ${fracTex(v[i]! * u[bad!]!, u[i]!)} \\ne ${v[bad!]}`,
              note: md`The ${ordinal[bad!]} components don't fit, so neither vector is a multiple of the other: **yes**, they are independent.`,
            },
      ],
    };
  }
  if (kind === 5) {
    // Four vectors in R^3: always dependent.
    const vs = Array.from({ length: 4 }, () => vec(r, 3));
    return {
      prompt: md`Are the four vectors $${vs.map((v) => col(v)).join(",\\; ")}$ in $\mathbb{R}^3$ linearly independent?`,
      choices: ["yes", "no"],
      accept: ["no"],
      hint: md`Count: how many vectors, and how many components? Remember the theorem about more than $n$ vectors in $\mathbb{R}^n$.`,
      solution: [
        { math: `4 > 3`, note: md`Four vectors in $\mathbb{R}^3$. Their $3 \times 4$ matrix has at most 3 pivots, so at least one column is free and $A\mathbf{c} = ${ZERO}$ has a nonzero solution.` },
        { math: `\\text{dependent}`, note: "More than three vectors in three-dimensional space are always dependent: **no**." },
      ],
    };
  }
  // Three vectors in R^3.
  let vs: Vec[];
  if (kind === 2) {
    let u: Vec;
    let v: Vec;
    let w: Vec;
    do {
      u = vec(r, 3);
      v = vec(r, 3);
      w = vec(r, 3);
    } while (det3(u, v, w) === 0);
    vs = [u, v, w];
  } else if (kind === 3) {
    let u: Vec;
    let v: Vec;
    do {
      u = vec(r, 3);
      v = vec(r, 3);
    } while (parallel(u, v));
    vs = [u, v, combo([r.nonzero(-2, 2), r.nonzero(-2, 2)], [u, v])];
    const slot = r.int(0, 2);
    [vs[2], vs[slot]] = [vs[slot]!, vs[2]!];
  } else {
    // One of them is the zero vector.
    vs = [vec(r, 3), vec(r, 3), [0, 0, 0]];
    const slot = r.int(0, 2);
    [vs[2], vs[slot]] = [vs[slot]!, vs[2]!];
  }
  const rows = vs[0]!.map((_, i) => vs.map((v) => v[i]!));
  const { steps, rank } = reduce(rows);
  const dep = rank < 3;
  return {
    prompt: md`Are the vectors $${vs.map((v) => col(v)).join(",\\; ")}$ linearly independent?`,
    choices: ["yes", "no"],
    accept: [dep ? "no" : "yes"],
    hint: md`Put the vectors in as columns and row reduce. Independent means every column gets a pivot, so $A\mathbf{c} = ${ZERO}$ has only the trivial solution.`,
    solution: [
      { math: mat(rows), note: md`The vectors as columns of $A$. Solve $A\mathbf{c} = ${ZERO}$ by reducing $A$.` },
      ...steps,
      dep
        ? { math: `${rank} \\text{ pivots for } 3 \\text{ columns}`, note: md`A column without a pivot is a free variable, so $A\mathbf{c} = ${ZERO}$ has nonzero solutions: **no**, the set is dependent.` }
        : { math: `3 \\text{ pivots for } 3 \\text{ columns}`, note: md`No free variables, so $A\mathbf{c} = ${ZERO}$ forces $\mathbf{c} = ${ZERO}$: **yes**, the set is independent.` },
    ],
  };
};

const dependParameter: Generator = (r) => {
  if (r.next() < 0.4) {
    const u = [r.nonzero(-4, 4), r.int(-4, 4)];
    const m = r.coef(-3, 3);
    const v1 = m * u[0]!;
    const k = m * u[1]!;
    return {
      prompt: md`Let $${U} = ${col(u)}$ and $${V} = ${col([v1, "k"])}$. For which value of $k$ are $${U}$ and $${V}$ linearly dependent? Type a number.`,
      answer: String(k),
      verify: [`(${u[0]})*k = (${u[1]})*(${v1})`],
      hint: md`Two vectors are dependent exactly when one is a multiple of the other. The first components tell you which multiple.`,
      solution: [
        { math: `${V} = m${U}, \\qquad ${v1} = ${u[0]}m \\quad\\Rightarrow\\quad m = ${m}`, note: "Dependent means a multiple. The first components fix the multiple." },
        { math: `k = ${m}(${u[1]}) = ${k}`, note: md`The second component of $${m}${U}$. For any other $k$ the two vectors point in different directions and are independent.` },
      ],
    };
  }
  const { u, v, kr, i, j } = pairWithCheckRow(r);
  const a = r.nonzero(-3, 3);
  const b = r.nonzero(-3, 3);
  const w = combo([a, b], [u, v]);
  const k = w[kr]!;
  const shown: (number | string)[] = w.map((x, idx) => (idx === kr ? "k" : x));
  const { steps } = solve2(u[i]!, v[i]!, w[i]!, u[j]!, v[j]!, w[j]!, "a", "b", [ordinal[i]!, ordinal[j]!]);
  return {
    prompt: md`Let $${U} = ${col(u)}$, $${V} = ${col(v)}$ and $${W} = ${col(shown)}$. For which value of $k$ is the set $\{${U}, ${V}, ${W}\}$ linearly dependent? Type a number.`,
    answer: String(k),
    verify: [`${det3Text([0, 1, 2].map((row) => [u[row]!, v[row]!, shown[row]!]))} = 0`],
    hint: md`$${U}$ and $${V}$ are not parallel, so the set is dependent exactly when $${W}$ is a combination $a${U} + b${V}$. Find $a$ and $b$ from the components without $k$.`,
    solution: [
      {
        math: aligned([0, 1, 2].map((row) => [poly([[u[row]!, "a"], [v[row]!, "b"]]), String(shown[row])] as [string, string])),
        note: md`$${U}$ and $${V}$ aren't multiples of each other, so they are independent on their own. The set is dependent exactly when $${W} = a${U} + b${V}$. Solve the two equations without $k$.`,
      },
      ...steps.slice(1),
      { math: `k = ${expandEntry([a, b], [u[kr]!, v[kr]!])} = ${k}`, note: md`With $k = ${k}$, $${W} = ${poly([[a, U], [b, V]])}$ and $${poly([[a, U], [b, V], [-1, W]])} = ${ZERO}$. Any other $k$ leaves the set independent.` },
    ],
  };
};

const dependenceRelation: Generator = (r) => {
  const { u, v, kr, i, j } = pairWithCheckRow(r);
  const a = r.nonzero(-3, 3);
  const b = r.nonzero(-3, 3);
  const w = scale(-1, combo([a, b], [u, v]));
  const { steps } = solve2(u[i]!, v[i]!, -w[i]!, u[j]!, v[j]!, -w[j]!, "a", "b", [ordinal[i]!, ordinal[j]!]);
  return {
    prompt: md`The vectors $${U} = ${col(u)}$, $${V} = ${col(v)}$ and $${W} = ${col(w)}$ are linearly dependent. Find the scalars $(a, b)$ with $a${U} + b${V} + ${W} = ${ZERO}$. Type them as (a, b).`,
    answer: tuple([a, b]),
    form: "tuple",
    verify: [0, 1, 2].map((row) => `(${u[row]})*a + (${v[row]})*b + (${w[row]}) = 0`),
    hint: md`Move $${W}$ across: $a${U} + b${V} = -${W}$. That is three equations in $a$ and $b$; two of them determine the answer and the third agrees.`,
    solution: [
      {
        math: aligned([0, 1, 2].map((row) => [poly([[u[row]!, "a"], [v[row]!, "b"]]), String(-w[row]!)] as [string, string])),
        note: md`$a${U} + b${V} = -${W}$, one equation per component. Use the ${ordinal[i]} and ${ordinal[j]}.`,
      },
      ...steps.slice(1),
      {
        math: `${expandEntry([a, b], [u[kr]!, v[kr]!])} = ${-w[kr]!}`,
        note: md`The ${ordinal[kr]} equation agrees. So $${poly([[a, U], [b, V], [1, W]])} = ${ZERO}$ with $(a, b) = ${tuple([a, b])}$: the relation says $${W} = ${poly([[-a, U], [-b, V]])}$.`,
      },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit2: Unit = {
  title: "Vectors",
  lessons: [
    {
      id: slug("Vectors and linear combinations"),
      title: "Vectors and linear combinations",
      summary: "Vectors in R^n as lists of numbers, the two operations on them, and the combinations they build.",
      blocks: [
        {
          kind: "text",
          body: md`Trigonometry, Unit 8 gave you vectors in the plane: arrows with components $\langle a, b \rangle$. Linear algebra keeps the components and drops the limit on how many there are. A vector in $\mathbb{R}^n$ is an ordered list of $n$ real numbers. In $\mathbb{R}^2$ it is an arrow in the plane, in $\mathbb{R}^3$ an arrow in space. In $\mathbb{R}^4$ and beyond there is no picture, and the arithmetic does not care.

We usually write vectors as columns, because they are about to become the columns of matrices:

$$${U} = ${col([2, -1, 3])} \quad\text{is a vector in } \mathbb{R}^3, \text{ with components } u_1 = 2,\; u_2 = -1,\; u_3 = 3.$$`,
        },
        {
          kind: "key",
          title: "Vectors in R^n",
          body: md`$\mathbb{R}^n$ is the set of all lists of $n$ real numbers. A **vector** $${U}$ in $\mathbb{R}^n$ has **components** $u_1, \ldots, u_n$. Two vectors are equal when every component agrees. The **zero vector** $${ZERO}$ has every component $0$.

A column $${col(["u_1", "\\vdots", "u_n"])}$ and a tuple $(u_1, \ldots, u_n)$ mean the same vector. On this site, type a vector as a tuple: (2, -1, 3).`,
        },
        {
          kind: "key",
          title: "The two operations",
          body: md`**Addition** is component by component, and **scalar multiplication** by a real number $c$ multiplies every component:

$$${col(["u_1", "u_2", "u_3"])} + ${col(["v_1", "v_2", "v_3"])} = ${col(["u_1 + v_1", "u_2 + v_2", "u_3 + v_3"])}, \qquad c${col(["u_1", "u_2", "u_3"])} = ${col(["cu_1", "cu_2", "cu_3"])}.$$

These are the only two operations. There is no product of two vectors here (the dot product returns in Unit 6), and you can only add vectors with the same number of components.`,
        },
        {
          kind: "why",
          title: "Why adding components is tip to tail",
          body: md`Read a vector as a trip: $${U} = (u_1, u_2)$ says "go $u_1$ across and $u_2$ up." Make the trip $${U}$, then from where you land make the trip $${V}$. Across, you moved $u_1$ and then $v_1$, for $u_1 + v_1$ in total; up, $u_2 + v_2$. So the arrow from the start to the final point has components $(u_1 + v_1, u_2 + v_2)$. That is the tip-to-tail picture from Trigonometry, and it is exactly componentwise addition.

Scaling: $c${U} = (cu_1, cu_2)$ keeps the ratio $u_2 : u_1$, so $c${U}$ points along the same line as $${U}$. It is $|c|$ times as long, and for $c < 0$ it points the opposite way. Every component is scaled, so the direction is not.`,
        },
        {
          kind: "key",
          title: "Linear combination",
          body: md`A **linear combination** of $\mathbf{v}_1, \ldots, \mathbf{v}_k$ is any vector of the form

$$c_1\mathbf{v}_1 + c_2\mathbf{v}_2 + \cdots + c_k\mathbf{v}_k,$$

where the scalars $c_1, \ldots, c_k$ are the **weights**. "Linear" means the only things done to the vectors are scaling and adding. Every vector in $\mathbb{R}^2$ is a combination of $\mathbf{e}_1 = (1, 0)$ and $\mathbf{e}_2 = (0, 1)$: $(x, y) = x\mathbf{e}_1 + y\mathbf{e}_2$.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-8, 8, -9, 9],
          params: [
            { name: "a", tex: "c_1", min: -2, max: 2, step: 0.5, value: 1 },
            { name: "b", tex: "c_2", min: -2, max: 2, step: 0.5, value: 1 },
          ],
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "U", x: 2, y: 1, label: U, dir: "se" },
            { name: "V", x: 1, y: 3, label: V, dir: "nw" },
            { name: "A", x: "2a", y: "a", label: "", hidden: true },
            { name: "P", x: "2a + b", y: "a + 3b", label: "c_1\\mathbf{u} + c_2\\mathbf{v} = ({=2a + b},\\; {=a + 3b})", dir: "ne" },
          ],
          segments: [
            { from: "O", to: "U", arrow: true, color: 1 },
            { from: "O", to: "V", arrow: true, color: 2 },
            { from: "O", to: "A", arrow: true, color: 1, dashed: true, label: "c_1\\mathbf{u}" },
            { from: "A", to: "P", arrow: true, color: 2, dashed: true, label: "c_2\\mathbf{v}" },
            { from: "O", to: "P", arrow: true, color: 3 },
          ],
          caption: md`$${U} = (2, 1)$ and $${V} = (1, 3)$. Slide the weights. The dashed arrows are $c_1${U}$ and then $c_2${V}$ tip to tail; the green arrow is their sum. Negative weights reverse an arrow. Notice that every point of the plane is reachable with the right pair of weights.`,
        },
        {
          kind: "proof",
          title: "The rules of arithmetic carry over",
          given: md`$${U}, ${V}$ in $\mathbb{R}^n$ and a scalar $c$`,
          prove: md`$${U} + ${V} = ${V} + ${U}$ and $c(${U} + ${V}) = c${U} + c${V}$`,
          steps: [
            { statement: md`The $i$-th component of $${U} + ${V}$ is $u_i + v_i$`, reason: "Definition of vector addition" },
            { statement: md`$u_i + v_i = v_i + u_i$`, reason: "Addition of real numbers is commutative" },
            { statement: md`$v_i + u_i$ is the $i$-th component of $${V} + ${U}$`, reason: "Definition of vector addition" },
            { statement: md`$${U} + ${V} = ${V} + ${U}$`, reason: "Every component agrees, so the vectors are equal" },
            { statement: md`The $i$-th component of $c(${U} + ${V})$ is $c(u_i + v_i)$`, reason: "Definitions of addition and scalar multiplication" },
            { statement: md`$c(u_i + v_i) = cu_i + cv_i$`, reason: "Distributive property of real numbers" },
            { statement: md`$cu_i + cv_i$ is the $i$-th component of $c${U} + c${V}$`, reason: "Definitions of scalar multiplication and addition" },
            { statement: md`$c(${U} + ${V}) = c${U} + c${V}$`, reason: "Every component agrees" },
          ],
        },
        {
          kind: "text",
          body: md`The same one-component-at-a-time argument proves the rest: $(${U} + ${V}) + ${W} = ${U} + (${V} + ${W})$, $${U} + ${ZERO} = ${U}$, $${U} + (-${U}) = ${ZERO}$, $(c + d)${U} = c${U} + d${U}$, $c(d${U}) = (cd)${U}$ and $1${U} = ${U}$. Each one is a fact about real numbers, applied in every component. Unit 5 will take exactly these eight rules as the definition of a vector space.`,
        },
        {
          kind: "example",
          title: "Computing a combination",
          problem: md`Let $${U} = ${col([1, 0, -2])}$, $${V} = ${col([2, 1, 1])}$ and $${W} = ${col([0, 4, 3])}$. Find $2${U} - 3${V} + ${W}$.`,
          steps: [
            { math: md`2${U} = ${col([2, 0, -4])}, \qquad 3${V} = ${col([6, 3, 3])}`, note: "Scale first. Every component is multiplied." },
            { math: md`${col(["2 - 6 + 0", "0 - 3 + 4", "-4 - 3 + 3"])}`, note: "Then add matching components, sign by sign." },
            { math: md`${col([-4, 1, -4])}`, note: "Typed as (-4, 1, -4)." },
          ],
        },
        {
          kind: "why",
          title: "Why finding the weights is a linear system",
          body: md`Turn the question around: given $${U}, ${V}$ and a target $${B}$, which weights make $c_1${U} + c_2${V} = ${B}$? Write out the components:

$$c_1${col(["u_1", "u_2"])} + c_2${col(["v_1", "v_2"])} = ${col(["b_1", "b_2"])} \quad\Longleftrightarrow\quad \begin{aligned} u_1 c_1 + v_1 c_2 &= b_1 \\ u_2 c_1 + v_2 c_2 &= b_2. \end{aligned}$$

That is a linear system in the unknowns $c_1, c_2$, with augmented matrix $[\,${U}\;\; ${V} \mid ${B}\,]$. This is the column picture from Unit 1, read backwards: a system $A\mathbf{x} = ${B}$ asks for the weights that combine the columns of $A$ into $${B}$. Everything Unit 1 taught about elimination now answers questions about combinations.`,
        },
        {
          kind: "example",
          title: "Finding the weights",
          problem: md`Find $c_1, c_2$ with $c_1${col([1, 2])} + c_2${col([3, -1])} = ${col([9, 4])}$.`,
          steps: [
            { math: md`c_1 + 3c_2 = 9, \qquad 2c_1 - c_2 = 4`, note: "One equation per component." },
            { math: md`2c_1 + 6c_2 = 18, \qquad 2c_1 - c_2 = 4`, note: md`Double the first so the $c_1$ terms match.` },
            { math: md`7c_2 = 14 \quad\Rightarrow\quad c_2 = 2`, note: "Subtract." },
            { math: md`c_1 = 9 - 3(2) = 3`, note: "Back-substitute." },
            { math: md`3${col([1, 2])} + 2${col([3, -1])} = ${col(["3 + 6", "6 - 2"])} = ${col([9, 4])}`, note: "Check. The weights are (3, 2)." },
          ],
        },
        {
          kind: "text",
          body: md`Unit 1 showed that a system can have one solution, none, or infinitely many. Each case now has a meaning for vectors. One solution: $${B}$ is reached by exactly one choice of weights. None: $${B}$ cannot be built from these vectors at all. Infinitely many: the vectors overlap, and the same $${B}$ can be built in many ways. The next two lessons are about those last two cases. They are called *span* and *linear independence*.`,
        },
        {
          kind: "check",
          prompt: md`Let $${U} = ${col([1, -2, 3])}$ and $${V} = ${col([4, 0, -1])}$. Find $2${U} - ${V}$. Type it as (a, b, c).`,
          answer: "(-2, -4, 7)",
          form: "tuple",
          explain: md`$2${U} = (2, -4, 6)$. Subtract $${V}$ component by component: $(2 - 4, -4 - 0, 6 + 1) = (-2, -4, 7)$.`,
        },
        {
          kind: "check",
          prompt: md`Find the weights $(c_1, c_2)$ with $c_1${col([1, 1])} + c_2${col([1, -1])} = ${col([5, 1])}$. Type them as (c1, c2).`,
          answer: "(3, 2)",
          form: "tuple",
          explain: md`The components give $c_1 + c_2 = 5$ and $c_1 - c_2 = 1$. Adding: $2c_1 = 6$, so $c_1 = 3$ and $c_2 = 2$.`,
        },
      ],
      practice: [computeCombination, findWeights2, findWeights3],
    },
    {
      id: slug("Span"),
      title: "Span",
      summary: "Everything you can reach with linear combinations: lines, planes, and how to test whether a vector is reachable.",
      blocks: [
        {
          kind: "text",
          body: md`Start with a few vectors and ask: what can you build from them? Scaling one vector gives its multiples. Adding multiples of two gives more. The collection of everything you can reach is the span, and it is the first big idea of linear algebra.`,
        },
        {
          kind: "key",
          title: "Span",
          body: md`The **span** of $\mathbf{v}_1, \ldots, \mathbf{v}_k$ is the set of all their linear combinations:

$$\operatorname{span}\{\mathbf{v}_1, \ldots, \mathbf{v}_k\} = \{\, c_1\mathbf{v}_1 + \cdots + c_k\mathbf{v}_k : c_1, \ldots, c_k \text{ real} \,\}.$$

It always contains $${ZERO}$ (all weights zero) and each $\mathbf{v}_i$ (one weight 1, the rest 0). "$${B}$ is in the span" means "$${B}$ can be built from these vectors."`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-7, 7, -5, 5],
          params: [{ name: "c", min: -3, max: 3, step: 0.25, value: 1.5 }],
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "V", x: 2, y: 1, label: V, dir: "se" },
            { name: "P", x: "2c", y: "c", label: "c\\mathbf{v} = ({=2c},\\; {c})", dir: "n" },
          ],
          segments: [
            { from: "O", to: "V", kind: "line", dashed: true },
            { from: "O", to: "V", arrow: true, color: 1 },
            { from: "O", to: "P", arrow: true, color: 3 },
          ],
          caption: md`The span of one vector. As $c$ runs through the real numbers, $c${V}$ sweeps out the dashed line through the origin in the direction of $${V}$. Nothing off that line is reachable.`,
        },
        {
          kind: "why",
          title: "Why one vector spans a line, and two can fill the plane",
          body: md`**One vector.** $c${V} = (2c, c)$ always has second component half the first, so every multiple lies on the line $y = \tfrac12 x$. Conversely, every point $(2c, c)$ on that line is reached by the weight $c$. The span of a nonzero vector is the whole line through the origin in its direction.

**Two vectors in the plane.** Take any target $${B} = (b_1, b_2)$ and ask for $c_1${U} + c_2${V} = ${B}$:

$$u_1 c_1 + v_1 c_2 = b_1, \qquad u_2 c_1 + v_2 c_2 = b_2.$$

Say $u_1 \ne 0$ (if not, swap the two equations; $${U}$ isn't the zero vector). Multiply the first by $u_2$, the second by $u_1$, and subtract to eliminate $c_1$:

$$(u_1 v_2 - u_2 v_1)\, c_2 = u_1 b_2 - u_2 b_1.$$

The number $u_1 v_2 - u_2 v_1$ is zero exactly when $v_2 / v_1 = u_2 / u_1$, that is, when $${V}$ is a multiple of $${U}$. If $${V}$ is **not** parallel to $${U}$, that number is nonzero, $c_2$ is determined, and then $c_1 = (b_1 - v_1 c_2)/u_1$. One solution for every $${B}$: two non-parallel vectors span all of $\mathbb{R}^2$. (Algebra 3 called $u_1 v_2 - u_2 v_1$ the determinant. Unit 4 returns to it.)`,
        },
        {
          kind: "surface",
          x: [-2, 2],
          y: [-2, 2],
          z: [-6, 6],
          expr: "a*x + b*y",
          params: [
            { name: "a", min: -2, max: 2, step: 0.5, value: 1 },
            { name: "b", min: -2, max: 2, step: 0.5, value: -0.5 },
          ],
          caption: md`In $\mathbb{R}^3$, two non-parallel vectors span a plane through the origin. Here it is $${span(col([1, 0, "a"]), col([0, 1, "b"]))}$: a combination $s(1, 0, a) + t(0, 1, b) = (s, t, as + bt)$ is the point above $(x, y) = (s, t)$ at height $z = ax + by$. Turn the plane with the sliders. A third vector off this plane is not in the span.`,
        },
        {
          kind: "key",
          title: "The shape of a span",
          body: md`- The zero vector alone spans just the point $${ZERO}$.
- One nonzero vector spans a **line** through the origin.
- Two non-parallel vectors span a **plane** through the origin (all of $\mathbb{R}^2$ if that's where they live).
- Three vectors in $\mathbb{R}^3$ that don't lie in one plane span all of $\mathbb{R}^3$.

A span always passes through the origin, and it is always a "flat" object: a point, a line, a plane, or a higher-dimensional flat. The number of independent directions in it is its **dimension**: 1 for a line, 2 for a plane, 3 for space.`,
        },
        {
          kind: "key",
          title: "Testing membership",
          body: md`$${B}$ is in $\operatorname{span}\{\mathbf{v}_1, \ldots, \mathbf{v}_k\}$ exactly when the system with augmented matrix $[\,\mathbf{v}_1 \;\cdots\; \mathbf{v}_k \mid ${B}\,]$ is consistent.

This is the column picture of the last lesson: weights exist precisely when the system has a solution. Reduce to echelon form; a row $[\,0 \;\cdots\; 0 \mid \text{nonzero}\,]$ means no, anything else means yes.`,
        },
        {
          kind: "example",
          title: "Is it in the span?",
          problem: md`Is $${B} = ${col([1, 4, 1])}$ in $${span(col([1, 2, 0]), col([0, 1, 1]))}$? What about $${col([1, 4, 2])}$?`,
          steps: [
            { math: md`c_1 = 1, \qquad 2c_1 + c_2 = 4, \qquad c_2 = 1`, note: md`$c_1${col([1, 2, 0])} + c_2${col([0, 1, 1])} = ${B}$, one equation per component.` },
            { math: md`c_1 = 1 \quad\Rightarrow\quad c_2 = 4 - 2 = 2`, note: "The first two equations fix both weights." },
            { math: md`c_2 = 2 \ne 1`, note: md`The third equation fails. No weights work, so $(1, 4, 1)$ is **not** in the span.` },
            { math: md`1${col([1, 2, 0])} + 2${col([0, 1, 1])} = ${col([1, 4, 2])}`, note: md`With third component 2 instead, the same weights satisfy all three equations: $(1, 4, 2)$ **is** in the span. The span is a plane, and $(1, 4, 1)$ sits just off it.` },
          ],
        },
        {
          kind: "proof",
          title: "A vector already in the span adds nothing",
          given: md`$${W} = a${U} + b${V}$ for some scalars $a, b$`,
          prove: md`$${span(U, V, W)} = ${span(U, V)}$`,
          steps: [
            { statement: md`Let $\mathbf{x} = c_1${U} + c_2${V}$ be any vector in $${span(U, V)}$`, reason: "Definition of span" },
            { statement: md`$\mathbf{x} = c_1${U} + c_2${V} + 0${W}$`, reason: md`$0${W} = ${ZERO}$` },
            { statement: md`$\mathbf{x}$ is in $${span(U, V, W)}$`, reason: "It is a combination of the three vectors" },
            { statement: md`Now let $\mathbf{y} = c_1${U} + c_2${V} + c_3${W}$ be any vector in $${span(U, V, W)}$`, reason: "Definition of span" },
            { statement: md`$\mathbf{y} = c_1${U} + c_2${V} + c_3(a${U} + b${V})$`, reason: "Given" },
            { statement: md`$\mathbf{y} = (c_1 + c_3 a)${U} + (c_2 + c_3 b)${V}$`, reason: "Distribute and collect, using the rules proved in Lesson 1" },
            { statement: md`$\mathbf{y}$ is in $${span(U, V)}$`, reason: md`It is a combination of $${U}$ and $${V}$` },
            { statement: md`$${span(U, V, W)} = ${span(U, V)}$`, reason: "Each set contains the other" },
          ],
        },
        {
          kind: "why",
          title: "Why pivots count the directions",
          body: md`To find the dimension of a span, put the vectors in as the **columns** of a matrix and reduce it to echelon form. The dimension is the number of pivot columns.

Here is the reason. A column with no pivot belongs to a free variable. Unit 1 showed that setting that free variable to 1 and the other free variables to 0 solves the homogeneous system, and that solution writes the free column as a combination of the pivot columns before it. By the proof above, a vector that is a combination of the others adds nothing to the span, so the free columns can be dropped. The pivot columns that remain each point in a direction the earlier ones cannot produce (if one could be produced, elimination would have cleared its column to zero below the pivots). So the pivot columns are the independent directions, and their count is the dimension. Unit 5 makes "dimension" precise; this is the calculation behind it.`,
        },
        {
          kind: "example",
          title: "The dimension of a span",
          problem: md`Find the dimension of $${span(col([1, 2, 1]), col([0, 1, 1]), col([1, 1, 0]))}$.`,
          steps: [
            { math: md`${mat([[1, 0, 1], [2, 1, 1], [1, 1, 0]])}`, note: "The vectors as columns." },
            { math: md`${mat([[1, 0, 1], [0, 1, -1], [0, 1, -1]])}`, note: md`$R_2 \to R_2 - 2R_1$ and $R_3 \to R_3 - R_1$.` },
            { math: md`${mat([[1, 0, 1], [0, 1, -1], [0, 0, 0]])}`, note: md`$R_3 \to R_3 - R_2$. Two pivots.` },
            { math: md`\dim = 2`, note: md`The span is a plane through the origin. Indeed $(1, 1, 0) = (1, 2, 1) - (0, 1, 1)$: the third vector was already in the span of the first two.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Is $${col([2, 5])}$ in $${span(col([1, 2]))}$?`,
          choices: ["yes", "no"],
          accept: ["no"],
          explain: md`The span is the line of multiples $c(1, 2) = (c, 2c)$. The first component forces $c = 2$, but then the second is $4$, not $5$. So no.`,
        },
        {
          kind: "check",
          prompt: md`Find the dimension of $${span(col([1, 2, 3]), col([2, 4, 6]))}$. Type a number.`,
          answer: "1",
          explain: md`$(2, 4, 6) = 2(1, 2, 3)$, so the second vector adds nothing. The span is the line through $(1, 2, 3)$: dimension 1. Reducing the matrix with these columns gives a single pivot.`,
        },
      ],
      practice: [inSpanQ, spanDimension, spanParameter],
    },
    {
      id: slug("Linear independence"),
      title: "Linear independence",
      summary: "When a set of vectors has no redundancy, how to test it by elimination, and why R^n holds at most n independent directions.",
      blocks: [
        {
          kind: "text",
          body: md`In the last lesson, $(1, 1, 0)$ added nothing to the span of $(1, 2, 1)$ and $(0, 1, 1)$, because it was already a combination of them. That vector was redundant. **Linear independence** is the name for a set with no redundancy: no vector in it can be built from the others. The official definition looks different at first, and the first job is to see why it says the same thing.`,
        },
        {
          kind: "key",
          title: "Linear independence",
          body: md`Vectors $\mathbf{v}_1, \ldots, \mathbf{v}_k$ are **linearly independent** when the only solution of

$$c_1\mathbf{v}_1 + c_2\mathbf{v}_2 + \cdots + c_k\mathbf{v}_k = ${ZERO}$$

is $c_1 = c_2 = \cdots = c_k = 0$. If some other choice of weights, not all zero, also gives $${ZERO}$, the vectors are **linearly dependent**, and that equation is a **dependence relation**.`,
        },
        {
          kind: "why",
          title: "Why this is the right definition",
          body: md`**Dependent means someone is redundant.** Suppose $c_1\mathbf{v}_1 + \cdots + c_k\mathbf{v}_k = ${ZERO}$ with, say, $c_j \ne 0$. Move everything else across and divide by $c_j$:

$$\mathbf{v}_j = -\frac{c_1}{c_j}\mathbf{v}_1 - \cdots - \frac{c_k}{c_j}\mathbf{v}_k \quad (\text{without the } \mathbf{v}_j \text{ term}).$$

So $\mathbf{v}_j$ is a combination of the others. **Redundant means dependent.** Conversely, if $\mathbf{v}_j = a_1\mathbf{v}_1 + \cdots$ is a combination of the others, then $a_1\mathbf{v}_1 + \cdots - 1\cdot\mathbf{v}_j + \cdots = ${ZERO}$ with the weight $-1$ on $\mathbf{v}_j$, which is not zero. The two descriptions are the same.

The $= ${ZERO}$ version is the one we use because it treats every vector alike. You don't have to guess which vector might be redundant: there is one system to solve, and it is homogeneous, exactly the kind Unit 1 handled.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-6, 6, -5, 5],
          params: [
            { name: "a", tex: "v_1", min: -4, max: 4, step: 1, value: 1 },
            { name: "b", tex: "v_2", min: -4, max: 4, step: 1, value: 2 },
          ],
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "U", x: 3, y: 1, label: U, dir: "se" },
            { name: "P", x: "a", y: "b", label: "\\mathbf{v} = ({a},\\; {b})", dir: "ne" },
          ],
          segments: [
            { from: "O", to: "U", kind: "line", dashed: true },
            { from: "O", to: "U", arrow: true, color: 1 },
            { from: "O", to: "P", arrow: true, color: 2 },
          ],
          readouts: [{ label: "u_1 v_2 - u_2 v_1 = 3v_2 - v_1", value: "3b - a" }],
          caption: md`$${U} = (3, 1)$ is fixed; slide $${V}$. The set $\{${U}, ${V}\}$ is dependent exactly when $${V}$ lands on the dashed line, that is, when $${V}$ is a multiple of $${U}$. Watch the readout: it is zero in exactly those positions. Try $(3, 1)$, $(-3, -1)$ and $(0, 0)$.`,
        },
        {
          kind: "key",
          title: "The test",
          body: md`Put the vectors in as the columns of a matrix $A$ and row reduce. The vectors are independent exactly when **every column has a pivot**. A column without a pivot means a free variable, and a free variable means a dependence relation.`,
        },
        {
          kind: "why",
          title: "Why the pivot test works",
          body: md`The equation $c_1\mathbf{v}_1 + \cdots + c_k\mathbf{v}_k = ${ZERO}$ is the homogeneous system $A\mathbf{c} = ${ZERO}$, where the columns of $A$ are the vectors (the column picture again). A homogeneous system always has the trivial solution $\mathbf{c} = ${ZERO}$. Unit 1 showed it has *other* solutions exactly when there is a free variable, and a free variable is a column with no pivot. So: every column has a pivot $\Leftrightarrow$ only the trivial solution $\Leftrightarrow$ independent.

The test also hands you the dependence relation when there is one: set the free variable to 1 and back-substitute.`,
        },
        {
          kind: "example",
          title: "An independent set",
          problem: md`Are $${col([1, 1, 0])}$, $${col([0, 1, 1])}$ and $${col([1, 0, 1])}$ linearly independent?`,
          steps: [
            { math: md`${mat([[1, 0, 1], [1, 1, 0], [0, 1, 1]])}`, note: md`The vectors as columns of $A$. Solve $A\mathbf{c} = ${ZERO}$.` },
            { math: md`${mat([[1, 0, 1], [0, 1, -1], [0, 1, 1]])}`, note: md`$R_2 \to R_2 - R_1$.` },
            { math: md`${mat([[1, 0, 1], [0, 1, -1], [0, 0, 2]])}`, note: md`$R_3 \to R_3 - R_2$. Three pivots for three columns.` },
            { math: md`c_3 = 0, \quad c_2 = 0, \quad c_1 = 0`, note: md`No free variables, so back-substitution gives only the trivial solution. The set is **independent**.` },
          ],
        },
        {
          kind: "example",
          title: "A dependent set, and its relation",
          problem: md`Are $${U} = ${col([1, 2, 1])}$, $${V} = ${col([2, 1, 0])}$ and $${W} = ${col([5, 4, 1])}$ linearly independent? If not, find a dependence relation.`,
          steps: [
            { math: md`${mat([[1, 2, 5], [2, 1, 4], [1, 0, 1]])}`, note: "The vectors as columns." },
            { math: md`${mat([[1, 2, 5], [0, -3, -6], [0, -2, -4]])}`, note: md`$R_2 \to R_2 - 2R_1$ and $R_3 \to R_3 - R_1$.` },
            { math: md`${mat([[1, 2, 5], [0, 1, 2], [0, 0, 0]])}`, note: md`Divide $R_2$ by $-3$, then $R_3 \to R_3 + 2R_2$. Only two pivots: column 3 is free, so the set is **dependent**.` },
            { math: md`c_3 = 1, \quad c_2 = -2c_3 = -2, \quad c_1 = -2c_2 - 5c_3 = -1`, note: "Set the free variable to 1 and back-substitute." },
            { math: md`-${U} - 2${V} + ${W} = ${ZERO}, \qquad\text{so}\qquad ${W} = ${U} + 2${V}`, note: md`Check: $(1, 2, 1) + 2(2, 1, 0) = (5, 4, 1)$. The third vector was redundant.` },
          ],
        },
        {
          kind: "key",
          title: "Quick facts",
          body: md`- A single nonzero vector is independent: $c${V} = ${ZERO}$ forces $c = 0$.
- **Two** vectors are dependent exactly when one is a multiple of the other: $c_1${U} + c_2${V} = ${ZERO}$ with $c_2 \ne 0$ gives $${V} = -\tfrac{c_1}{c_2}${U}$.
- Any set containing $${ZERO}$ is dependent: $1 \cdot ${ZERO} + 0\mathbf{v}_2 + \cdots = ${ZERO}$ is a relation with a nonzero weight.
- A set is dependent as soon as one vector lies in the span of the others.`,
        },
        {
          kind: "proof",
          title: "More than n vectors in R^n are dependent",
          given: md`$\mathbf{v}_1, \ldots, \mathbf{v}_k$ in $\mathbb{R}^n$ with $k > n$`,
          prove: md`the set is linearly dependent`,
          steps: [
            { statement: md`Let $A$ be the $n \times k$ matrix with columns $\mathbf{v}_1, \ldots, \mathbf{v}_k$. The set is dependent exactly when $A\mathbf{c} = ${ZERO}$ has a solution $\mathbf{c} \ne ${ZERO}$`, reason: "Definition of dependence, in the column picture" },
            { statement: md`Row reduce $A$ to echelon form. Each pivot sits in its own row`, reason: "Echelon form (Unit 1): pivots step down and to the right" },
            { statement: md`There are at most $n$ pivots`, reason: md`$A$ has only $n$ rows` },
            { statement: md`At least one of the $k$ columns has no pivot`, reason: md`$k > n$` },
            { statement: md`That column's variable is free`, reason: "Columns without pivots are free variables (Unit 1)" },
            { statement: md`Set the free variable to 1 and back-substitute: this gives a solution $\mathbf{c}$ with a component equal to 1`, reason: "A free variable may take any value; the pivot variables are then determined" },
            { statement: md`The set is linearly dependent`, reason: md`$\mathbf{c} \ne ${ZERO}$ solves $A\mathbf{c} = ${ZERO}$ (step 1)` },
          ],
        },
        {
          kind: "text",
          body: md`So $\mathbb{R}^n$ has room for at most $n$ independent directions. Any three vectors in the plane are dependent: one of them is always a combination of the other two, which you can see by trying to draw three arrows in the plane with none of them in the span of the others. Any four vectors in space are dependent, with no calculation needed.

The two ideas of this unit fit together. A set that **spans** $\mathbb{R}^n$ reaches everything; a set that is **independent** has nothing wasted. A set that does both is called a basis, and Unit 5 shows that every basis of $\mathbb{R}^n$ has exactly $n$ vectors.`,
        },
        {
          kind: "check",
          prompt: md`Are $${col([1, 0, 1])}$, $${col([0, 1, 1])}$ and $${col([1, 1, 2])}$ linearly independent?`,
          choices: ["yes", "no"],
          accept: ["no"],
          explain: md`$(1, 1, 2) = (1, 0, 1) + (0, 1, 1)$, so $${U} + ${V} - ${W} = ${ZERO}$ is a dependence relation. Reducing the matrix with these columns gives only two pivots.`,
        },
        {
          kind: "check",
          prompt: md`For which value of $k$ are $${col([1, 3])}$ and $${col([2, "k"])}$ linearly dependent? Type a number.`,
          answer: "6",
          explain: md`Two vectors are dependent exactly when one is a multiple of the other. The first components make the multiple 2, so $k = 2 \cdot 3 = 6$.`,
        },
      ],
      practice: [independentQ, dependParameter, dependenceRelation],
    },
  ],
};
