import { frac, fracTex, gcd, poly, type Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Exact arithmetic and matrix helpers ─────────────────────────────────────

interface Q {
  n: number;
  d: number;
}
function q(n: number, d = 1): Q {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const qAdd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const qSub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const qMul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const qDiv = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const qZero = (a: Q) => a.n === 0;
const qOne = (a: Q) => a.n === 1 && a.d === 1;
const qTex = (a: Q) => fracTex(a.n, a.d);
const qText = (a: Q) => frac(a.n, a.d);

type Cell = number | Q | string;
const cellTex = (c: Cell) => (typeof c === "number" ? String(c) : typeof c === "string" ? c : qTex(c));
const cellText = (c: Cell) => (typeof c === "number" ? String(c) : typeof c === "string" ? c : qText(c));

/** A bmatrix, or an augmented matrix with a bar before the last `aug` columns. */
function matTex(rows: Cell[][], aug = 0): string {
  const body = rows.map((row) => row.map(cellTex).join(" & ")).join(" \\\\ ");
  if (!aug) return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
  const n = rows[0]!.length;
  return `\\left[\\begin{array}{${"c".repeat(n - aug)}|${"c".repeat(aug)}} ${body} \\end{array}\\right]`;
}
const colTex = (v: Cell[]) => matTex(v.map((x) => [x]));
const tup = (v: Cell[]) => `(${v.map(cellText).join(", ")})`;
const setTex = (vs: number[][]) => `\\{ ${vs.map((v) => tup(v)).join(",\\ ")} \\}`;
/** Matrix answer text: [[1, 2], [3, 4]]. */
const matText = (rows: Cell[][]) => `[${rows.map((row) => `[${row.map(cellText).join(", ")}]`).join(", ")}]`;
const pn = (v: number) => (v < 0 ? `(${v})` : String(v));

/** A linear form for verify equations with every letter present: "2a - 3b + 0c". */
function lin(coefs: number[], letters: string[]): string {
  return coefs
    .map((c, i) => {
      const mag = `${Math.abs(c)}${letters[i]}`;
      if (i === 0) return c < 0 ? `-${mag}` : mag;
      return c < 0 ? ` - ${mag}` : ` + ${mag}`;
    })
    .join("");
}
const LETTERS = ["a", "b", "c", "d"];
const xs = (n: number) => Array.from({ length: n }, (_, i) => `x_${i + 1}`);

const mul = (A: number[][], B: number[][]) => A.map((row) => B[0]!.map((_, j) => row.reduce((s, v, k) => s + v * B[k]![j]!, 0)));
const matVec = (A: number[][], v: number[]) => A.map((row) => row.reduce((s, a, k) => s + a * v[k]!, 0));
const transpose = (A: number[][]) => A[0]!.map((_, j) => A.map((row) => row[j]!));
const det2 = (M: number[][]) => M[0]![0]! * M[1]![1]! - M[0]![1]! * M[1]![0]!;
const det3 = (M: number[][]) =>
  M[0]![0]! * (M[1]![1]! * M[2]![2]! - M[1]![2]! * M[2]![1]!) -
  M[0]![1]! * (M[1]![0]! * M[2]![2]! - M[1]![2]! * M[2]![0]!) +
  M[0]![2]! * (M[1]![0]! * M[2]![1]! - M[1]![1]! * M[2]![0]!);

function shuffle<T>(r: Rng, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface Reduction {
  R: Q[][];
  pivots: number[];
  steps: Step[];
}

/** Row reduce to RREF, recording each operation as a solution step. The last `aug` columns are never pivot columns. */
function reduce(M: (number | Q)[][], aug = 0): Reduction {
  const A = M.map((row) => row.map((v) => (typeof v === "number" ? q(v) : v)));
  const m = A.length;
  const n = A[0]!.length;
  const steps: Step[] = [];
  const pivots: number[] = [];
  let row = 0;
  const coefTex = (f: Q) => (qOne(f) ? "" : qTex(f));
  for (let col = 0; col < n - aug && row < m; col++) {
    let p = -1;
    for (let i = row; i < m; i++) {
      if (qZero(A[i]![col]!)) continue;
      if (p < 0) p = i;
      if (qOne(A[i]![col]!)) {
        p = i;
        break;
      }
    }
    if (p < 0) continue;
    if (p !== row) {
      [A[p], A[row]] = [A[row]!, A[p]!];
      steps.push({ math: matTex(A, aug), note: md`Swap $R_${row + 1}$ and $R_${p + 1}$ to bring a nonzero entry into the pivot position.` });
    }
    const s = A[row]![col]!;
    if (!qOne(s)) {
      A[row] = A[row]!.map((v) => qDiv(v, s));
      steps.push({ math: matTex(A, aug), note: s.n === -1 && s.d === 1 ? md`Multiply $R_${row + 1}$ by $-1$ to make the pivot $1$.` : md`Divide $R_${row + 1}$ by $${qTex(s)}$ to make the pivot $1$.` });
    }
    const ops: string[] = [];
    for (let i = 0; i < m; i++) {
      if (i === row) continue;
      const f = A[i]![col]!;
      if (qZero(f)) continue;
      A[i] = A[i]!.map((v, k) => qSub(v, qMul(f, A[row]![k]!)));
      ops.push(`R_${i + 1} \\leftarrow R_${i + 1} ${f.n < 0 ? "+" : "-"} ${coefTex(q(Math.abs(f.n), f.d))}R_${row + 1}`);
    }
    if (ops.length) steps.push({ math: matTex(A, aug), note: md`Clear the rest of column ${col + 1}: $${ops.join(",\\ ")}$.` });
    pivots.push(col);
    row++;
  }
  if (!steps.length) steps.push({ math: matTex(A, aug), note: "The matrix is already in reduced row echelon form." });
  return { R: A, pivots, steps };
}

/** The null-space basis vector of an RREF with the free variable `chosen` set to 1 and the other free variables 0. */
function nullVector(red: Reduction, n: number, chosen: number): Q[] {
  const v: Q[] = Array.from({ length: n }, () => q(0));
  v[chosen] = q(1);
  red.pivots.forEach((pc, k) => {
    v[pc] = q(-red.R[k]![chosen]!.n, red.R[k]![chosen]!.d);
  });
  return v;
}

/** A random m×n integer matrix of exactly the given rank, with small entries. */
function rankMatrix(r: Rng, m: number, n: number, rank: number): number[][] {
  for (;;) {
    const L = Array.from({ length: m }, () => Array.from({ length: rank }, () => r.int(-2, 2)));
    const R = Array.from({ length: rank }, () => Array.from({ length: n }, () => r.int(-2, 2)));
    const A = mul(L, R);
    if (A.some((row) => row.some((v) => Math.abs(v) > 9))) continue;
    if (A.some((row) => row.every((v) => v === 0))) continue;
    if (transpose(A).some((col) => col.every((v) => v === 0)) && r.next() < 0.8) continue;
    const same = (u: number[], w: number[]) => u.every((x, i) => x === w[i]);
    const distinctRows = A.filter((row, i) => A.findIndex((w) => same(w, row)) === i).length;
    if (distinctRows < Math.min(m, rank + 1)) continue;
    if (reduce(A).pivots.length !== rank) continue;
    return A;
  }
}

/** A 2×2 integer matrix whose determinant has one of the given absolute values. */
function invertible2(r: Rng, dets: number[] = [1, 2]): number[][] {
  for (;;) {
    const M = [
      [r.int(-3, 3), r.int(-3, 3)],
      [r.int(-3, 3), r.int(-3, 3)],
    ];
    if (dets.includes(Math.abs(det2(M)))) return M;
  }
}

/** A 3×2 integer matrix with independent columns. */
function tall32(r: Rng): number[][] {
  for (;;) {
    const M = Array.from({ length: 3 }, () => [r.int(-2, 2), r.int(-2, 2)]);
    if (M.some((row) => row.every((v) => v === 0))) continue;
    if (reduce(M).pivots.length === 2) return M;
  }
}

const vecTex = (v: Cell[]) => `(${v.map(cellTex).join(", ")})`;

// ── Lesson 1 generators ─────────────────────────────────────────────────────

const SUB_CHOICES = [
  "Yes, it is a subspace",
  "No: the zero vector isn't in it",
  "No: it contains the zero vector but isn't closed under addition",
  "No: it's closed under addition but isn't closed under scalar multiplication",
];

interface SetCase {
  space: string;
  set: string;
  verdict: 0 | 1 | 2 | 3;
  steps: Step[];
}

function subspaceCases(r: Rng): SetCase[] {
  const m = r.nonzero(-4, 4);
  const c = r.nonzero(-5, 5);
  const R = r.int(1, 4);
  const [pa, pb] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const pc = r.pick([1, -1]);
  const plane = poly([[pa, "x"], [pb, "y"], [pc, "z"]]);
  const zeroOK = (what: string): Step => ({ math: "\\mathbf{0} \\in W", note: what });
  return [
    {
      space: "\\mathbb{R}^2",
      set: `\\{ (x, y) : y = ${poly([[m, "x"]])} \\}`,
      verdict: 0,
      steps: [
        { math: md`0 = ${m} \cdot 0`, note: md`The zero vector $(0, 0)$ satisfies the equation.` },
        { math: md`y_1 + y_2 = ${m}x_1 + ${m}x_2 = ${m}(x_1 + x_2)`, note: "If two points are on the line, their sum is too." },
        { math: md`cy = c(${m}x) = ${m}(cx)`, note: md`Scalar multiples stay on the line. All three checks pass: $W$ is a subspace. It is $\operatorname{Span}\{(1, ${m})\}$.` },
      ],
    },
    {
      space: "\\mathbb{R}^2",
      set: `\\{ (x, y) : y = ${poly([[m, "x"], [c, ""]])} \\}`,
      verdict: 1,
      steps: [{ math: md`${m} \cdot 0 ${c < 0 ? "-" : "+"} ${Math.abs(c)} = ${c} \ne 0`, note: md`At $x = 0$ the line has $y = ${c}$, so $(0, 0)$ isn't in $W$. A line that misses the origin is never a subspace.` }],
    },
    {
      space: "\\mathbb{R}^2",
      set: "\\{ (x, y) : xy = 0 \\}",
      verdict: 2,
      steps: [
        zeroOK(md`$0 \cdot 0 = 0$, so the zero vector is in $W$ (it is the two axes together).`),
        { math: "(1, 0) + (0, 1) = (1, 1), \\qquad 1 \\cdot 1 = 1 \\ne 0", note: md`Both $(1, 0)$ and $(0, 1)$ are in $W$, but their sum isn't. Not closed under addition.` },
      ],
    },
    {
      space: "\\mathbb{R}^2",
      set: "\\{ (x, y) : x \\ge 0 \\text{ and } y \\ge 0 \\}",
      verdict: 3,
      steps: [
        zeroOK(md`$0 \ge 0$, so $(0, 0)$ is in $W$.`),
        { math: "x_1 + x_2 \\ge 0, \\quad y_1 + y_2 \\ge 0", note: "Sums of nonnegative numbers are nonnegative: closed under addition." },
        { math: "(-1)(1, 1) = (-1, -1) \\notin W", note: "A negative multiple leaves the quadrant. Not closed under scalar multiplication." },
      ],
    },
    {
      space: "\\mathbb{R}^2",
      set: "\\{ (x, y) : y \\ge 0 \\}",
      verdict: 3,
      steps: [
        zeroOK(md`$(0, 0)$ has $y = 0 \ge 0$.`),
        { math: "y_1 + y_2 \\ge 0", note: "Closed under addition." },
        { math: "(-1)(0, 1) = (0, -1) \\notin W", note: "Multiplying by a negative scalar leaves the upper half-plane." },
      ],
    },
    {
      space: "\\mathbb{R}^2",
      set: `\\{ (x, y) : x^2 + y^2 \\le ${R * R} \\}`,
      verdict: 2,
      steps: [
        zeroOK(md`$0 + 0 \le ${R * R}$: the disk contains the origin.`),
        { math: md`(${R}, 0) + (${R}, 0) = (${2 * R}, 0), \qquad ${2 * R}^2 = ${4 * R * R} > ${R * R}`, note: "Two vectors in the disk add to one outside it. Not closed under addition." },
      ],
    },
    {
      space: "\\mathbb{R}^2",
      set: "\\{ (x, y) : y = x^2 \\}",
      verdict: 2,
      steps: [
        zeroOK(md`$0 = 0^2$, so $(0, 0)$ is on the parabola.`),
        { math: "(1, 1) + (2, 4) = (3, 5), \\qquad 5 \\ne 3^2", note: "Not closed under addition." },
      ],
    },
    {
      space: "\\mathbb{R}^2",
      set: "\\{ (x, y) : |x| = |y| \\}",
      verdict: 2,
      steps: [
        zeroOK(md`$|0| = |0|$. $W$ is the pair of lines $y = x$ and $y = -x$.`),
        { math: "(1, 1) + (1, -1) = (2, 0), \\qquad |2| \\ne |0|", note: "One vector from each line; the sum is on neither. Not closed under addition." },
      ],
    },
    {
      space: "\\mathbb{R}^2",
      set: "\\{ (x, y) : x \\text{ and } y \\text{ are integers} \\}",
      verdict: 3,
      steps: [
        zeroOK("Both coordinates of (0, 0) are integers."),
        { math: "x_1 + x_2, \\; y_1 + y_2 \\text{ are integers}", note: "Closed under addition." },
        { math: "\\tfrac{1}{2}(1, 0) = (\\tfrac{1}{2}, 0) \\notin W", note: "A fractional scalar leaves the grid. Not closed under scalar multiplication." },
      ],
    },
    {
      space: "\\mathbb{R}^2",
      set: `\\{ (x, y) : x = ${c} \\}`,
      verdict: 1,
      steps: [{ math: md`(0, 0): \quad 0 \ne ${c}`, note: md`The zero vector has $x = 0$, not $${c}$. This vertical line misses the origin.` }],
    },
    {
      space: "\\mathbb{R}^3",
      set: `\\{ (x, y, z) : ${plane} = 0 \\}`,
      verdict: 0,
      steps: [
        { math: md`${pa} \cdot 0 ${pb < 0 ? "-" : "+"} ${Math.abs(pb)} \cdot 0 ${pc < 0 ? "-" : "+"} 0 = 0`, note: "The zero vector satisfies the equation." },
        { math: md`(${plane})_{\mathbf{u} + \mathbf{v}} = (${plane})_{\mathbf{u}} + (${plane})_{\mathbf{v}} = 0 + 0`, note: "The left side is linear in the coordinates, so sums of solutions are solutions." },
        { math: md`(${plane})_{c\mathbf{u}} = c \cdot 0 = 0`, note: "Scalar multiples too. A plane through the origin is a subspace." },
      ],
    },
    {
      space: "\\mathbb{R}^3",
      set: `\\{ (x, y, z) : ${plane} = ${c} \\}`,
      verdict: 1,
      steps: [{ math: md`0 \ne ${c}`, note: md`Plugging in $(0, 0, 0)$ gives $0$ on the left, not $${c}$. The plane misses the origin.` }],
    },
    {
      space: "\\mathbb{R}^3",
      set: "\\{ (x, y, z) : x = y = z \\}",
      verdict: 0,
      steps: [
        zeroOK(md`$0 = 0 = 0$.`),
        { math: "(t, t, t) + (s, s, s) = (t + s, t + s, t + s)", note: "Closed under addition." },
        { math: "c(t, t, t) = (ct, ct, ct)", note: md`Closed under scalar multiplication. $W$ is the line $\operatorname{Span}\{(1, 1, 1)\}$.` },
      ],
    },
    {
      space: "\\mathbb{R}^3",
      set: "\\{ (x, y, z) : z = xy \\}",
      verdict: 2,
      steps: [
        zeroOK(md`$0 = 0 \cdot 0$.`),
        { math: "(1, 1, 1) + (1, 1, 1) = (2, 2, 2), \\qquad 2 \\ne 2 \\cdot 2", note: "Not closed under addition." },
      ],
    },
    {
      space: "\\mathbb{R}^3",
      set: "\\{ (x, y, z) : xyz = 0 \\}",
      verdict: 2,
      steps: [
        zeroOK(md`$0 \cdot 0 \cdot 0 = 0$. $W$ is the three coordinate planes together.`),
        { math: "(1, 0, 0) + (0, 1, 1) = (1, 1, 1), \\qquad 1 \\cdot 1 \\cdot 1 \\ne 0", note: "Not closed under addition." },
      ],
    },
    {
      space: "P_2",
      set: `\\{ p \\in P_2 : p(${R}) = 0 \\}`,
      verdict: 0,
      steps: [
        { math: md`\mathbf{0}(${R}) = 0`, note: "The zero polynomial is zero everywhere." },
        { math: md`(p + q)(${R}) = p(${R}) + q(${R}) = 0 + 0 = 0`, note: "Closed under addition." },
        { math: md`(cp)(${R}) = c \cdot p(${R}) = 0`, note: md`Closed under scalar multiplication. $W$ is a subspace (it is the polynomials with the factor $x - ${R}$).` },
      ],
    },
    {
      space: "P_2",
      set: `\\{ p \\in P_2 : p(0) = ${c} \\}`,
      verdict: 1,
      steps: [{ math: md`\mathbf{0}(0) = 0 \ne ${c}`, note: "The zero polynomial isn't in the set." }],
    },
    {
      space: "P_2",
      set: "\\{ p \\in P_2 : p \\text{ has degree exactly } 2 \\}",
      verdict: 1,
      steps: [{ math: "\\deg \\mathbf{0} \\ne 2", note: "The zero polynomial has no degree-2 term, so it isn't in the set. (Addition fails too: $x^2 + (-x^2) = 0$, but the zero-vector test comes first.)" }],
    },
    {
      space: "P_2",
      set: "\\{ p \\in P_2 : p(-x) = p(x) \\text{ for all } x \\}",
      verdict: 0,
      steps: [
        zeroOK("The zero polynomial is even."),
        { math: "(p + q)(-x) = p(-x) + q(-x) = p(x) + q(x)", note: "Sums of even polynomials are even." },
        { math: "(cp)(-x) = c\\,p(-x) = c\\,p(x)", note: md`Scalar multiples too. $W$ is a subspace: it is $\operatorname{Span}\{1, x^2\}$.` },
      ],
    },
    {
      space: "P_2",
      set: "\\{ p \\in P_2 : \\text{every coefficient of } p \\text{ is} \\ge 0 \\}",
      verdict: 3,
      steps: [
        zeroOK("All coefficients of the zero polynomial are 0."),
        { math: "(a_2 + b_2)x^2 + (a_1 + b_1)x + (a_0 + b_0)", note: "Sums of nonnegative coefficients are nonnegative: closed under addition." },
        { math: "(-1)(x^2 + 1) = -x^2 - 1 \\notin W", note: "Not closed under scalar multiplication." },
      ],
    },
    {
      space: "M_{2 \\times 2}",
      set: "\\{ A \\in M_{2 \\times 2} : a_{11} + a_{22} = 0 \\}",
      verdict: 0,
      steps: [
        zeroOK("The zero matrix has trace 0."),
        { math: "\\operatorname{tr}(A + B) = (a_{11} + b_{11}) + (a_{22} + b_{22}) = \\operatorname{tr} A + \\operatorname{tr} B = 0", note: "Closed under addition." },
        { math: "\\operatorname{tr}(cA) = c \\operatorname{tr} A = 0", note: "Closed under scalar multiplication. The trace-zero matrices are a subspace." },
      ],
    },
    {
      space: "M_{2 \\times 2}",
      set: "\\{ A \\in M_{2 \\times 2} : \\det A = 0 \\}",
      verdict: 2,
      steps: [
        zeroOK("The zero matrix has determinant 0."),
        { math: "\\begin{bmatrix} 1 & 0 \\\\ 0 & 0 \\end{bmatrix} + \\begin{bmatrix} 0 & 0 \\\\ 0 & 1 \\end{bmatrix} = I, \\qquad \\det I = 1", note: "Two singular matrices with an invertible sum. Not closed under addition." },
      ],
    },
    {
      space: "M_{2 \\times 2}",
      set: "\\{ A \\in M_{2 \\times 2} : A^T = A \\}",
      verdict: 0,
      steps: [
        zeroOK("The zero matrix is symmetric."),
        { math: "(A + B)^T = A^T + B^T = A + B", note: "Closed under addition." },
        { math: "(cA)^T = cA^T = cA", note: "Closed under scalar multiplication. The symmetric matrices are a subspace." },
      ],
    },
    {
      space: "M_{2 \\times 2}",
      set: "\\{ A \\in M_{2 \\times 2} : A \\text{ is invertible} \\}",
      verdict: 1,
      steps: [{ math: "\\det \\mathbf{0} = 0", note: "The zero matrix isn't invertible, so the zero vector is missing." }],
    },
    {
      space: "M_{2 \\times 2}",
      set: "\\{ A \\in M_{2 \\times 2} : a_{21} = 0 \\}",
      verdict: 0,
      steps: [
        zeroOK("The zero matrix is upper triangular."),
        { math: "(A + B)_{21} = 0 + 0 = 0", note: "Closed under addition." },
        { math: "(cA)_{21} = c \\cdot 0 = 0", note: "Closed under scalar multiplication. Upper triangular matrices form a subspace." },
      ],
    },
    {
      space: "C(\\mathbb{R}), \\text{ the continuous functions on } \\mathbb{R}",
      set: "\\{ f : f(0) = 0 \\}",
      verdict: 0,
      steps: [
        zeroOK("The zero function is 0 at 0."),
        { math: "(f + g)(0) = f(0) + g(0) = 0", note: "Closed under addition." },
        { math: "(cf)(0) = c \\cdot f(0) = 0", note: "Closed under scalar multiplication. A subspace." },
      ],
    },
    {
      space: "C(\\mathbb{R}), \\text{ the continuous functions on } \\mathbb{R}",
      set: `\\{ f : f(0) = ${c} \\}`,
      verdict: 1,
      steps: [{ math: md`\mathbf{0}(0) = 0 \ne ${c}`, note: "The zero function isn't in the set." }],
    },
    {
      space: "C(\\mathbb{R}), \\text{ the continuous functions on } \\mathbb{R}",
      set: "\\{ f : f(x) \\ge 0 \\text{ for all } x \\}",
      verdict: 3,
      steps: [
        zeroOK(md`$0 \ge 0$ everywhere.`),
        { math: "(f + g)(x) = f(x) + g(x) \\ge 0", note: "Closed under addition." },
        { math: "(-1)f = -f, \\qquad -f(x) < 0 \\text{ wherever } f(x) > 0", note: "Not closed under scalar multiplication." },
      ],
    },
  ];
}

const subspaceTest: Generator = (r) => {
  const cases = subspaceCases(r);
  const k = r.pick(cases);
  return {
    prompt: md`Is $W = ${k.set}$ a subspace of $${k.space}$? Run the three-part test in order: the zero vector first, then closure under addition, then closure under scalar multiplication. Pick the first check that fails, or say that it is a subspace.`,
    choices: SUB_CHOICES,
    accept: [SUB_CHOICES[k.verdict]!],
    hint: md`Is the zero vector of $${k.space}$ in $W$? If so, add two specific members of $W$ and see whether the sum qualifies. If it does, scale a member by $-1$ or $\tfrac{1}{2}$.`,
    solution: [...k.steps, { math: `\\text{${SUB_CHOICES[k.verdict]!.replace(/'/g, "")}}`, note: k.verdict === 0 ? "All three checks pass." : "The test stops at the first failure." }],
  };
};

const missingComponent: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [p, s] = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
    const t = r.pick([1, -1]);
    const [x0, y0] = [r.nonzero(-5, 5), r.nonzero(-5, 5)];
    const z = -(p * x0 + s * y0) / t;
    const eq = poly([[p, "x"], [s, "y"], [t, "z"]]);
    return {
      prompt: md`$W = \{ (x, y, z) : ${eq} = 0 \}$ is a plane through the origin, so it is a subspace of $\mathbb{R}^3$. Find $z$ so that $(${x0}, ${y0}, z)$ is in $W$.`,
      answer: String(z),
      verify: [`${p}*${pn(x0)} + ${s}*${pn(y0)} + ${t}*z = 0`],
      hint: md`A vector is in $W$ exactly when its coordinates satisfy the equation. Substitute $x = ${x0}$ and $y = ${y0}$ and solve for $z$.`,
      solution: [
        { math: md`${p}(${x0}) ${s < 0 ? "-" : "+"} ${Math.abs(s)}(${y0}) ${t < 0 ? "-" : "+"} z = 0`, note: "Substitute the known coordinates." },
        { math: md`${p * x0 + s * y0} ${t < 0 ? "-" : "+"} z = 0`, note: "Combine the numbers." },
        { math: md`z = ${z}`, note: md`So $(${x0}, ${y0}, ${z})$ lies on the plane.` },
      ],
    };
  }
  if (kind === 1) {
    const c = r.nonzero(-3, 3);
    const [a, b] = [r.pick([1, 1, 2, -1]), r.nonzero(-5, 5)];
    const k = -(a * c * c + b * c);
    const ptex = poly([[a, "x^2"], [b, "x"], [1, "k"]]);
    return {
      prompt: md`$W = \{ p \in P_2 : p(${c}) = 0 \}$ is a subspace of $P_2$. Find $k$ so that $p(x) = ${ptex}$ is in $W$.`,
      answer: String(k),
      verify: [`${a}*${pn(c)}^2 + ${b}*${pn(c)} + k = 0`],
      hint: md`Membership means $p(${c}) = 0$. Evaluate the polynomial at $x = ${c}$ and solve for $k$.`,
      solution: [
        { math: md`p(${c}) = ${a === 1 ? "" : a}(${c})^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}(${c}) + k`, note: md`Substitute $x = ${c}$.` },
        { math: md`${a * c * c} ${b * c < 0 ? "-" : "+"} ${Math.abs(b * c)} + k = ${a * c * c + b * c} + k`, note: "Simplify." },
        { math: md`k = ${k}`, note: md`Set $p(${c}) = 0$: this is the value that makes $x - (${c})$ a factor.` },
      ],
    };
  }
  const [u, w] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const y0 = r.nonzero(-4, 4);
  const v = [u * y0, y0, w * y0];
  return {
    prompt: md`$W = \{ (x, y, z) : x = ${poly([[u, "y"]])} \text{ and } z = ${poly([[w, "y"]])} \}$ is a line through the origin, so it is a subspace of $\mathbb{R}^3$. Find the vector in $W$ whose second coordinate is $y = ${y0}$. Give it as a vector like (2, -1, 3).`,
    answer: tup(v),
    form: "tuple",
    verify: [lin([1, -u, 0], LETTERS) + " = 0", lin([0, -w, 1], LETTERS) + " = 0", lin([0, 1, 0], LETTERS) + ` = ${y0}`],
    hint: md`Both $x$ and $z$ are determined by $y$. Substitute $y = ${y0}$ into each equation.`,
    solution: [
      { math: md`x = ${u}(${y0}) = ${u * y0}, \qquad z = ${w}(${y0}) = ${w * y0}`, note: "Each coordinate follows from y." },
      { math: vecTex(v), note: md`Every vector in $W$ is $y\,(${u}, 1, ${w})$, so $W = \operatorname{Span}\{(${u}, 1, ${w})\}$; this one has $y = ${y0}$.` },
    ],
  };
};

const polyCombination: Generator = (r) => {
  const kind = r.int(0, 1);
  const [a, b] = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
  const [m, n] = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
  if (kind === 0) {
    const p1 = poly([[1, "x^2"], [m, ""]]);
    const p2 = poly([[1, "x"], [n, ""]]);
    const c0 = a * m + b * n;
    const qtex = poly([[a, "x^2"], [b, "x"], [c0, ""]]);
    return {
      prompt: md`In $P_2$, let $p_1(x) = ${p1}$ and $p_2(x) = ${p2}$. Write $q(x) = ${qtex}$ as a combination $q = a\,p_1 + b\,p_2$. Give $(a, b)$.`,
      answer: `(${a}, ${b})`,
      form: "tuple",
      verify: [`a + 0b = ${a}`, `0a + b = ${b}`, `${m}a + ${n}b = ${c0}`],
      hint: md`Expand $a\,p_1(x) + b\,p_2(x)$ and match coefficients of $x^2$, $x$ and $1$ with those of $q$. The $x^2$ and $x$ coefficients each involve one unknown.`,
      solution: [
        { math: md`a(${p1}) + b(${p2}) = a x^2 + b x + (${m}a ${n < 0 ? "-" : "+"} ${Math.abs(n)}b)`, note: "Expand the combination and group by powers of x." },
        { math: md`x^2: \; a = ${a} \qquad x: \; b = ${b}`, note: md`Match the $x^2$ and $x$ coefficients of $q$.` },
        { math: md`${m}(${a}) ${n < 0 ? "-" : "+"} ${Math.abs(n)}(${b}) = ${c0}`, note: md`Check the constant term: it matches $q$'s constant $${c0}$, so $q$ really is in $\operatorname{Span}\{p_1, p_2\}$.` },
        { math: md`(a, b) = (${a}, ${b})`, note: "" },
      ],
    };
  }
  const p1 = poly([[1, "x^2"], [m, "x"]]);
  const p2 = poly([[1, "x"], [n, ""]]);
  const c1 = a * m + b;
  const c0 = b * n;
  const qtex = poly([[a, "x^2"], [c1, "x"], [c0, ""]]);
  return {
    prompt: md`In $P_2$, let $p_1(x) = ${p1}$ and $p_2(x) = ${p2}$. Write $q(x) = ${qtex}$ as a combination $q = a\,p_1 + b\,p_2$. Give $(a, b)$.`,
    answer: `(${a}, ${b})`,
    form: "tuple",
    verify: [`a + 0b = ${a}`, `${m}a + b = ${c1}`, `0a + ${n}b = ${c0}`],
    hint: md`Expand $a\,p_1(x) + b\,p_2(x)$ and match coefficients. Only $p_1$ has an $x^2$ term and only $p_2$ has a constant term.`,
    solution: [
      { math: md`a(${p1}) + b(${p2}) = a x^2 + (${m}a + b)x + ${n}b`, note: "Expand and group by powers of x." },
      { math: md`x^2: \; a = ${a} \qquad 1: \; ${n}b = ${c0} \Rightarrow b = ${b}`, note: md`The $x^2$ coefficient gives $a$; the constant term gives $b$.` },
      { math: md`${m}(${a}) ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${c1}`, note: md`Check the $x$ coefficient: it matches $q$'s $${c1}$.` },
      { math: md`(a, b) = (${a}, ${b})`, note: "" },
    ],
  };
};

// ── Lesson 2 generators ─────────────────────────────────────────────────────

/** Null-space solution steps after the reduction: pivot/free bookkeeping, the equations, the vector. */
function nullSteps(red: Reduction, n: number, chosen: number, v: Q[]): Step[] {
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => !red.pivots.includes(i));
  const names = xs(n);
  const eqs = red.pivots.map((pc, k) => {
    const rhs = poly(free.map((f) => [-red.R[k]![f]!.n / red.R[k]![f]!.d, names[f]!] as [number, string]));
    return `${names[pc]} = ${rhs}`;
  });
  return [
    {
      math: `\\text{pivot columns } ${red.pivots.map((p) => p + 1).join(", ")}; \\quad \\text{free: } ${free.map((f) => names[f]).join(", ")}`,
      note: "Each pivot column is a basic variable; the other columns are free variables.",
    },
    { math: eqs.join(", \\qquad "), note: "Each nonzero row gives one basic variable in terms of the free ones." },
    {
      math: `${names[chosen]} = 1${free.filter((f) => f !== chosen).map((f) => `,\\ ${names[f]} = 0`).join("")} \\;\\Rightarrow\\; \\mathbf{v} = ${vecTex(v)}`,
      note: "Set the chosen free variable to 1 and any other free variables to 0.",
    },
  ];
}

const nullBasis: Generator = (r) => {
  const variant = r.int(0, 3);
  let Rm: number[][];
  let free: number[];
  let chosen: number;
  if (variant === 0 || variant === 2) {
    Rm = [
      [1, 0, r.nonzero(-4, 4)],
      [0, 1, r.nonzero(-4, 4)],
    ];
    free = [2];
    chosen = 2;
  } else if (variant === 1) {
    Rm = [
      [1, r.nonzero(-4, 4), 0],
      [0, 0, 1],
    ];
    free = [1];
    chosen = 1;
  } else {
    Rm = [
      [1, 0, r.nonzero(-3, 3), r.nonzero(-3, 3)],
      [0, 1, r.nonzero(-3, 3), r.nonzero(-3, 3)],
    ];
    free = [2, 3];
    chosen = r.pick(free);
  }
  const L = variant === 2 ? tall32(r) : invertible2(r);
  const A = mul(L, Rm);
  const n = Rm[0]!.length;
  const red = reduce(A);
  const v = nullVector(red, n, chosen);
  const letters = LETTERS.slice(0, n);
  const other = free.filter((f) => f !== chosen);
  const verify = [
    ...A.map((row) => `${lin(row, letters)} = 0`),
    `${lin(letters.map((_, i) => (i === chosen ? 1 : 0)), letters)} = 1`,
    ...other.map((f) => `${lin(letters.map((_, i) => (i === f ? 1 : 0)), letters)} = 0`),
  ];
  const Av = matVec(A, v.map((x) => x.n / x.d));
  return {
    prompt: md`Let $$A = ${matTex(A)}.$$ Find the basis vector of $\operatorname{Nul} A$ that has the free variable $x_${chosen + 1} = 1$${other.length ? md` and $x_${other[0]! + 1} = 0$` : ""}. Give it as a vector like ${n === 4 ? "(2, -1, 1, 0)" : "(2, -1, 1)"}.`,
    answer: tup(v),
    form: "tuple",
    verify,
    hint: "Row reduce to reduced row echelon form. The pivot columns are the basic variables; write each in terms of the free variables, then set the chosen free variable to 1.",
    solution: [...red.steps, ...nullSteps(red, n, chosen, v), { math: `A\\mathbf{v} = ${colTex(Av)}`, note: "Check: every row of A dotted with v gives 0." }],
  };
};

const colCombination: Generator = (r) => {
  const M = tall32(r);
  const [c1, c2] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const b = M.map((row) => row[0]! * c1 + row[1]! * c2);
  const red = reduce(
    M.map((row, i) => [...row, b[i]!]),
    1,
  );
  return {
    prompt: md`Let $$A = ${matTex(M)}, \qquad \mathbf{b} = ${colTex(b)}.$$ The vector $\mathbf{b}$ is in $\operatorname{Col} A$. Write it as a combination of the columns, $\mathbf{b} = c_1 \mathbf{a}_1 + c_2 \mathbf{a}_2$, and give $(c_1, c_2)$.`,
    answer: `(${c1}, ${c2})`,
    form: "tuple",
    verify: M.map((row, i) => `${lin(row, ["a", "b"])} = ${b[i]}`),
    hint: md`$\mathbf{b}$ is in $\operatorname{Col} A$ exactly when $A\mathbf{x} = \mathbf{b}$ has a solution. Row reduce the augmented matrix $[A \mid \mathbf{b}]$.`,
    solution: [
      ...red.steps,
      { math: md`c_1 = ${c1}, \qquad c_2 = ${c2}`, note: "The last row is all zeros, so the system is consistent, and the first two rows give the weights." },
      { math: md`${c1}${colTex(M.map((row) => row[0]!))} ${c2 < 0 ? "-" : "+"} ${Math.abs(c2)}${colTex(M.map((row) => row[1]!))} = ${colTex(b)}`, note: "Check the combination." },
    ],
  };
};

const whichInNul: Generator = (r) => {
  const Rm = [
    [1, 0, r.nonzero(-3, 3)],
    [0, 1, r.nonzero(-3, 3)],
  ];
  const A = mul(invertible2(r), Rm);
  const scale = r.pick([1, 1, 2, -1]);
  const v = [-Rm[0]![2]! * scale, -Rm[1]![2]! * scale, scale];
  const isZero = (w: number[]) => matVec(A, w).every((x) => x === 0);
  const same = (u: number[], w: number[]) => u.every((x, i) => x === w[i]);
  const wrong: number[][] = [];
  const candidates = [
    [v[0]! + r.pick([1, -1, 2]), v[1]!, v[2]!],
    [v[0]!, v[1]! + r.pick([1, -1, 2]), v[2]!],
    [-v[0]!, v[1]!, v[2]!],
    [v[0]!, -v[1]!, v[2]!],
    [v[1]!, v[0]!, v[2]!],
    [r.int(-3, 3), r.int(-3, 3), r.nonzero(-2, 2)],
  ];
  for (const w of candidates) {
    if (wrong.length === 3) break;
    if (isZero(w) || same(w, v) || wrong.some((u) => same(u, w))) continue;
    wrong.push(w);
  }
  const choices = shuffle(r, [v, ...wrong].map((w) => tup(w)));
  const w0 = wrong[0]!;
  return {
    prompt: md`Let $$A = ${matTex(A)}.$$ Which of these vectors is in $\operatorname{Nul} A$?`,
    choices,
    accept: [tup(v)],
    hint: md`A vector is in $\operatorname{Nul} A$ exactly when $A\mathbf{v} = \mathbf{0}$. Multiply each candidate by $A$; no row reduction needed.`,
    solution: [
      { math: md`A${colTex(v)} = ${colTex(matVec(A, v))}`, note: md`Each row of $A$ dotted with $${tup(v)}$ gives $0$, so it is in the null space.` },
      { math: md`A${colTex(w0)} = ${colTex(matVec(A, w0))} \ne \mathbf{0}`, note: "The other candidates fail: at least one row gives a nonzero result." },
    ],
  };
};

// ── Lesson 3 generators ─────────────────────────────────────────────────────

const basisTest: Generator = (r) => {
  const n = r.pick([2, 3]);
  const kind = r.int(0, 3);
  const rnd = () => Array.from({ length: n }, () => r.int(-3, 3));
  const nonzeroVec = () => {
    for (;;) {
      const v = rnd();
      if (v.some((x) => x !== 0)) return v;
    }
  };
  let vs: number[][];
  if (kind === 0) {
    for (;;) {
      vs = Array.from({ length: n }, nonzeroVec);
      const M = transpose(vs);
      if ((n === 2 ? det2(M) : det3(M)) !== 0) break;
    }
  } else if (kind === 1) {
    vs = Array.from({ length: n - 1 }, nonzeroVec);
  } else if (kind === 2) {
    vs = Array.from({ length: n + 1 }, nonzeroVec);
  } else {
    for (;;) {
      const base = Array.from({ length: n - 1 }, nonzeroVec);
      const s = r.nonzero(-2, 2);
      const t = n === 3 ? r.nonzero(-2, 2) : 0;
      const last = base[0]!.map((x, i) => s * x + (n === 3 ? t * base[1]![i]! : 0));
      if (last.some((x) => Math.abs(x) > 6)) continue;
      vs = shuffle(r, [...base, last]);
      if (vs.some((v, i) => vs.some((w, j) => j !== i && same(v, w)))) continue;
      break;
    }
  }
  function same(u: number[], w: number[]) {
    return u.every((x, i) => x === w[i]);
  }
  const Rn = `\\mathbb{R}^${n}`;
  const choices = [
    md`Yes: they are a basis of $${Rn}$`,
    md`No: ${n - 1} vector${n - 1 === 1 ? "" : "s"} can't span $${Rn}$`,
    md`No: ${n + 1} vectors in $${Rn}$ can't be linearly independent`,
    md`No: there are ${n} of them, but they are linearly dependent`,
  ];
  const M = transpose(vs!);
  let steps: Step[];
  if (kind === 1) {
    steps = [{ math: md`\dim ${Rn} = ${n} > ${n - 1}`, note: md`A spanning set of $${Rn}$ needs at least $${n}$ vectors, since every basis has exactly $${n}$. With ${n - 1} vector${n - 1 === 1 ? "" : "s"} the span is at most a ${n - 1 === 1 ? "line" : "plane"}.` }];
  } else if (kind === 2) {
    steps = [{ math: md`${n + 1} > ${n} = \dim ${Rn}`, note: md`Any set of more than $${n}$ vectors in $${Rn}$ is linearly dependent (more columns than rows means a free variable), so it can't be a basis, whatever the vectors are.` }];
  } else if (n === 2) {
    const d = det2(M);
    steps = [
      { math: md`\det ${matTex(M)} = ${pn(M[0]![0]!)}${pn(M[1]![1]!)} - ${pn(M[0]![1]!)}${pn(M[1]![0]!)} = ${d}`, note: "Two vectors in the plane; put them in the columns of a matrix and take the determinant." },
      d !== 0
        ? { math: "\\det \\ne 0", note: md`The columns are independent. Two independent vectors in $\mathbb{R}^2$ are a basis.` }
        : { math: "\\det = 0", note: "The columns are dependent (one is a multiple of the other), so they aren't a basis." },
    ];
  } else {
    const red = reduce(M);
    steps = [
      { math: matTex(M), note: "Put the vectors in the columns of a matrix and row reduce." },
      ...red.steps,
      red.pivots.length === n
        ? { math: md`${n} \text{ pivots}`, note: md`A pivot in every column: the vectors are independent. $${n}$ independent vectors in $${Rn}$ form a basis.` }
        : { math: md`${red.pivots.length} \text{ pivots} < ${n}`, note: "A column without a pivot means a free variable, so the vectors are linearly dependent and not a basis." },
    ];
  }
  const verdict = kind === 0 ? 0 : kind;
  const finals = ["\\text{a basis}", `\\text{not a basis: too few vectors to span } ${Rn}`, `\\text{not a basis: too many vectors in } ${Rn} \\text{ to be independent}`, "\\text{not a basis: linearly dependent}"];
  return {
    prompt: md`Do the vectors $${setTex(vs!)}$ form a basis of $${Rn}$?`,
    choices,
    accept: [choices[verdict]!],
    hint: md`Count first: a basis of $${Rn}$ has exactly $${n}$ vectors. If the count is right, test independence with a determinant or by row reducing.`,
    solution: [...steps, { math: finals[verdict]!, note: "" }],
  };
};

const coordinates: Generator = (r) => {
  const three = r.next() < 0.4;
  let B: number[][];
  if (three) {
    const [a, b, c] = [r.nonzero(-2, 2), r.nonzero(-2, 2), r.nonzero(-2, 2)];
    B = shuffle(r, [
      [1, a, b],
      [0, 1, c],
      [0, 0, 1],
    ]);
  } else {
    for (;;) {
      const M = invertible2(r, [1, 2, 3]);
      B = [
        [M[0]![0]!, M[1]![0]!],
        [M[0]![1]!, M[1]![1]!],
      ];
      if (B.every((v) => v.some((x) => x !== 0))) break;
    }
  }
  const n = B.length;
  const cs = Array.from({ length: n }, () => r.nonzero(-3, 3));
  const v = Array.from({ length: n }, (_, i) => cs.reduce((s, c, j) => s + c * B[j]![i]!, 0));
  const P = transpose(B);
  const red = reduce(
    P.map((row, i) => [...row, v[i]!]),
    1,
  );
  const letters = LETTERS.slice(0, n);
  return {
    prompt: md`Let $\mathcal{B} = ${setTex(B)}$, a basis of $\mathbb{R}^${n}$, and $\mathbf{v} = ${vecTex(v)}$. Find the coordinate vector $[\mathbf{v}]_{\mathcal{B}}$. Give it as ${n === 3 ? "(c_1, c_2, c_3)" : "(c_1, c_2)"}, typed like ${n === 3 ? "(2, -1, 3)" : "(2, -1)"}.`,
    answer: tup(cs),
    form: "tuple",
    verify: P.map((row, i) => `${lin(row, letters)} = ${v[i]}`),
    hint: md`The coordinates are the weights $c_i$ with $c_1 \mathbf{b}_1 + \dots + c_${n} \mathbf{b}_${n} = \mathbf{v}$. That is the system $P_{\mathcal{B}}\,\mathbf{c} = \mathbf{v}$ whose matrix has the basis vectors as columns. Row reduce $[P_{\mathcal{B}} \mid \mathbf{v}]$.`,
    solution: [
      { math: md`${cs.map((_, j) => `c_${j + 1}${colTex(B[j]!)}`).join(" + ")} = ${colTex(v)}`, note: "Coordinates are the weights in the combination." },
      ...red.steps,
      { math: md`[\mathbf{v}]_{\mathcal{B}} = ${vecTex(cs)}`, note: "Read the weights from the last column." },
    ],
  };
};

const dependentK: Generator = (r) => {
  let v1: number[];
  let v2: number[];
  for (;;) {
    v1 = [r.nonzero(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    v2 = [r.int(-3, 3), r.nonzero(-3, 3), r.int(-3, 3)];
    if (v1[0]! * v2[1]! - v1[1]! * v2[0]! !== 0) break;
  }
  const [s, t] = [r.nonzero(-2, 2), r.nonzero(-2, 2)];
  const v3 = v1.map((x, i) => s * x + t * v2[i]!);
  const k = v3[2]!;
  const [a1, a2, a3] = v1 as [number, number, number];
  const [b1, b2, b3] = v2 as [number, number, number];
  const [c1, c2] = v3 as [number, number, number];
  const red = reduce([
    [a1, b1, c1],
    [a2, b2, c2],
  ], 1);
  return {
    prompt: md`Find $k$ so that the vectors $(${a1}, ${a2}, ${a3})$, $(${b1}, ${b2}, ${b3})$ and $(${c1}, ${c2}, k)$ are linearly dependent, and so fail to be a basis of $\mathbb{R}^3$.`,
    answer: String(k),
    verify: [`${pn(c1)}*(${pn(a2)}*${pn(b3)} - ${pn(a3)}*${pn(b2)}) - ${pn(c2)}*(${pn(a1)}*${pn(b3)} - ${pn(a3)}*${pn(b1)}) + k*(${pn(a1)}*${pn(b2)} - ${pn(a2)}*${pn(b1)}) = 0`],
    hint: md`The first two vectors are independent, so the three are dependent exactly when the third is a combination $s\,\mathbf{v}_1 + t\,\mathbf{v}_2$. Find $s$ and $t$ from the first two coordinates, then $k$ is forced.`,
    solution: [
      { math: md`s${colTex(v1)} + t${colTex(v2)} = ${colTex([c1, c2, "k"])}`, note: "Dependence means the third vector is a combination of the first two (they aren't parallel, so they are independent)." },
      ...red.steps,
      { math: md`s = ${s}, \qquad t = ${t}`, note: "The first two coordinates determine the weights." },
      { math: md`k = ${s}(${a3}) ${t < 0 ? "-" : "+"} ${Math.abs(t)}(${b3}) = ${k}`, note: md`The third coordinate must match. (Equivalently, the determinant of the $3 \times 3$ matrix with these columns is $0$ exactly when $k = ${k}$.)` },
    ],
  };
};

// ── Lesson 4 generators ─────────────────────────────────────────────────────

const SHAPES: [number, number][] = [
  [2, 2],
  [2, 3],
  [3, 3],
  [3, 4],
  [4, 3],
  [3, 2],
];

const rankOf: Generator = (r) => {
  const [m, n] = r.pick(SHAPES);
  const rank = r.int(1, Math.min(m, n));
  const A = rankMatrix(r, m, n, rank);
  const red = reduce(A);
  return {
    prompt: md`Find the rank of $$A = ${matTex(A)}.$$`,
    answer: String(rank),
    hint: "Row reduce. The rank is the number of pivot positions, which is the number of nonzero rows in echelon form.",
    solution: [
      ...red.steps,
      { math: md`\operatorname{rank} A = ${rank}`, note: md`There ${rank === 1 ? "is" : "are"} ${rank} pivot${rank === 1 ? "" : "s"} (column${rank === 1 ? "" : "s"} ${red.pivots.map((p) => p + 1).join(", ")}), so $\dim \operatorname{Col} A = ${rank}$.` },
    ],
  };
};

const rankNullity: Generator = (r) => {
  const kind = r.int(0, 4);
  const m = r.int(2, 6);
  const n = r.int(2, 7);
  const size = md`$${m} \times ${n}$`;
  if (kind === 0) {
    const rank = r.int(1, Math.min(m, n));
    return {
      prompt: md`$A$ is a ${size} matrix with rank $${rank}$. Find $\dim \operatorname{Nul} A$.`,
      answer: String(n - rank),
      verify: [`n + ${rank} = ${n}`],
      hint: md`Rank-nullity: $\operatorname{rank} A + \dim \operatorname{Nul} A = $ the number of columns.`,
      solution: [
        { math: md`\operatorname{rank} A + \dim \operatorname{Nul} A = ${n}`, note: md`$A$ has $${n}$ columns; each is a pivot column or a free column.` },
        { math: md`\dim \operatorname{Nul} A = ${n} - ${rank} = ${n - rank}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const nullity = r.int(Math.max(0, n - m), n - 1);
    return {
      prompt: md`$A$ is a ${size} matrix and $\dim \operatorname{Nul} A = ${nullity}$. Find $\operatorname{rank} A$.`,
      answer: String(n - nullity),
      verify: [`r + ${nullity} = ${n}`],
      hint: md`Rank-nullity: $\operatorname{rank} A + \dim \operatorname{Nul} A = $ the number of columns, here $${n}$.`,
      solution: [
        { math: md`\operatorname{rank} A + ${nullity} = ${n}`, note: md`Rank-nullity with $${n}$ columns.` },
        { math: md`\operatorname{rank} A = ${n - nullity}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const free = r.int(Math.max(0, n - m), n - 1);
    return {
      prompt: md`The reduced row echelon form of a ${size} matrix $A$ has $${free}$ free variable${free === 1 ? "" : "s"}. Find $\operatorname{rank} A$.`,
      answer: String(n - free),
      verify: [`r + ${free} = ${n}`],
      hint: "Every column is either a pivot column or a free column. The rank counts the pivot columns.",
      solution: [
        { math: md`\text{pivot columns} + \text{free columns} = ${n}`, note: md`There are $${n}$ columns.` },
        { math: md`\operatorname{rank} A = ${n} - ${free} = ${n - free}`, note: "The rank is the number of pivot columns." },
      ],
    };
  }
  if (kind === 3) {
    const rank = r.int(1, Math.min(m, n));
    return {
      prompt: md`$A$ is a ${size} matrix with rank $${rank}$. Find $\dim \operatorname{Nul} A^T$.`,
      answer: String(m - rank),
      verify: [`d + ${rank} = ${m}`],
      hint: md`$A^T$ is $${n} \times ${m}$ and has the same rank as $A$. Apply rank-nullity to $A^T$.`,
      solution: [
        { math: md`\operatorname{rank} A^T = \operatorname{rank} A = ${rank}`, note: "Row rank equals column rank." },
        { math: md`\operatorname{rank} A^T + \dim \operatorname{Nul} A^T = ${m}`, note: md`$A^T$ has $${m}$ columns (the rows of $A$).` },
        { math: md`\dim \operatorname{Nul} A^T = ${m} - ${rank} = ${m - rank}`, note: "" },
      ],
    };
  }
  const mm = r.int(2, 4);
  const nn = mm + r.int(1, 3);
  return {
    prompt: md`The columns of a $${mm} \times ${nn}$ matrix $A$ span $\mathbb{R}^${mm}$. Find $\dim \operatorname{Nul} A$.`,
    answer: String(nn - mm),
    verify: [`n + ${mm} = ${nn}`],
    hint: md`Spanning $\mathbb{R}^${mm}$ means $\operatorname{Col} A = \mathbb{R}^${mm}$, which tells you the rank.`,
    solution: [
      { math: md`\operatorname{rank} A = \dim \operatorname{Col} A = \dim \mathbb{R}^${mm} = ${mm}`, note: "The column space is the whole target space." },
      { math: md`\dim \operatorname{Nul} A = ${nn} - ${mm} = ${nn - mm}`, note: md`Rank-nullity with $${nn}$ columns.` },
    ],
  };
};

const fourDims: Generator = (r) => {
  const [m, n] = r.pick(SHAPES);
  const rank = r.int(1, Math.min(m, n));
  const A = rankMatrix(r, m, n, rank);
  const red = reduce(A);
  return {
    prompt: md`For the $${m} \times ${n}$ matrix $$A = ${matTex(A)}$$ give $(\operatorname{rank} A,\ \dim \operatorname{Nul} A,\ \dim \operatorname{Nul} A^T)$ as a triple like (2, 1, 0).`,
    answer: `(${rank}, ${n - rank}, ${m - rank})`,
    form: "tuple",
    verify: [`a + b + 0c = ${n}`, `a + 0b + c = ${m}`],
    hint: md`Row reduce to count pivots. Then rank-nullity for $A$ (with $${n}$ columns) and for $A^T$ (with $${m}$ columns, same rank).`,
    solution: [
      ...red.steps,
      { math: md`\operatorname{rank} A = ${rank}`, note: md`${rank} pivot${rank === 1 ? "" : "s"}.` },
      { math: md`\dim \operatorname{Nul} A = ${n} - ${rank} = ${n - rank}`, note: md`Rank-nullity: $${n}$ columns, $${rank}$ of them pivot columns.` },
      { math: md`\dim \operatorname{Nul} A^T = ${m} - ${rank} = ${m - rank}`, note: md`$A^T$ has rank $${rank}$ too and $${m}$ columns.` },
    ],
  };
};

// ── Lesson 5 generators ─────────────────────────────────────────────────────

/** Columns of a 2×2 as a list of basis vectors. */
const cols2 = (P: number[][]) => [
  [P[0]![0]!, P[1]![0]!],
  [P[0]![1]!, P[1]![1]!],
];
const inverse2 = (P: number[][]) => {
  const d = det2(P);
  return [
    [q(P[1]![1]!, d), q(-P[0]![1]!, d)],
    [q(-P[1]![0]!, d), q(P[0]![0]!, d)],
  ];
};
/** A 2×2 with determinant ±1 and no zero column. */
function unimodular(r: Rng): number[][] {
  for (;;) {
    const P = invertible2(r, [1]);
    if (cols2(P).every((v) => v.some((x) => x !== 0))) return P;
  }
}
const Bset = (P: number[][]) => setTex(cols2(P));

const changeMatrix: Generator = (r) => {
  const kind = r.int(0, 2);
  const PB = invertible2(r, kind === 1 ? [1] : [1, 2, 3]);
  if (kind === 0) {
    return {
      prompt: md`Let $\mathcal{B} = ${Bset(PB)}$, a basis of $\mathbb{R}^2$. Find the matrix $P_{\mathcal{B}}$ with $\mathbf{v} = P_{\mathcal{B}}[\mathbf{v}]_{\mathcal{B}}$ for every $\mathbf{v}$. Type it row by row like [[1, 2], [3, 4]].`,
      answer: matText(PB),
      form: "matrix",
      hint: md`$P_{\mathcal{B}}[\mathbf{v}]_{\mathcal{B}} = c_1 \mathbf{b}_1 + c_2 \mathbf{b}_2$: a matrix times a vector is a combination of its columns.`,
      solution: [
        { math: md`c_1 \mathbf{b}_1 + c_2 \mathbf{b}_2 = \begin{bmatrix} \mathbf{b}_1 & \mathbf{b}_2 \end{bmatrix} \begin{bmatrix} c_1 \\ c_2 \end{bmatrix}`, note: "The column picture of a matrix-vector product." },
        { math: md`P_{\mathcal{B}} = ${matTex(PB)}`, note: "The basis vectors are the columns, in order." },
      ],
    };
  }
  if (kind === 1) {
    const inv = inverse2(PB);
    const d = det2(PB);
    return {
      prompt: md`Let $\mathcal{B} = ${Bset(PB)}$, a basis of $\mathbb{R}^2$. Find the matrix $P_{\mathcal{B}}^{-1}$ that converts standard coordinates to $\mathcal{B}$-coordinates: $[\mathbf{v}]_{\mathcal{B}} = P_{\mathcal{B}}^{-1}\mathbf{v}$. Type it row by row like [[1, 2], [3, 4]].`,
      answer: matText(inv),
      form: "matrix",
      hint: md`$P_{\mathcal{B}}$ has the basis vectors as columns. Invert it with the $2 \times 2$ formula: swap the diagonal, negate the off-diagonal, divide by the determinant.`,
      solution: [
        { math: md`P_{\mathcal{B}} = ${matTex(PB)}, \qquad \det P_{\mathcal{B}} = ${pn(PB[0]![0]!)}${pn(PB[1]![1]!)} - ${pn(PB[0]![1]!)}${pn(PB[1]![0]!)} = ${d}`, note: "Columns are the basis vectors." },
        { math: md`P_{\mathcal{B}}^{-1} = \frac{1}{${d}}${matTex([[PB[1]![1]!, -PB[0]![1]!], [-PB[1]![0]!, PB[0]![0]!]])} = ${matTex(inv)}`, note: md`The $2 \times 2$ inverse formula.` },
      ],
    };
  }
  const PC = unimodular(r);
  const PCB = mul(inverse2(PC).map((row) => row.map((x) => x.n / x.d)), PB);
  const red = reduce(
    PC.map((row, i) => [...row, ...PB[i]!]),
    2,
  );
  return {
    prompt: md`Let $\mathcal{B} = ${Bset(PB)}$ and $\mathcal{C} = ${Bset(PC)}$, two bases of $\mathbb{R}^2$. Find the change-of-coordinates matrix $P_{\mathcal{C} \leftarrow \mathcal{B}}$ with $[\mathbf{v}]_{\mathcal{C}} = P_{\mathcal{C} \leftarrow \mathcal{B}}[\mathbf{v}]_{\mathcal{B}}$. Type it row by row like [[1, 2], [3, 4]].`,
    answer: matText(PCB),
    form: "matrix",
    hint: md`Its columns are $[\mathbf{b}_1]_{\mathcal{C}}$ and $[\mathbf{b}_2]_{\mathcal{C}}$. Get both at once by row reducing $[P_{\mathcal{C}} \mid P_{\mathcal{B}}]$ to $[I \mid P_{\mathcal{C} \leftarrow \mathcal{B}}]$.`,
    solution: [
      { math: md`[\,P_{\mathcal{C}} \mid P_{\mathcal{B}}\,] = ${matTex(PC.map((row, i) => [...row, ...PB[i]!]), 2)}`, note: md`Each column of $P_{\mathcal{C} \leftarrow \mathcal{B}}$ solves $P_{\mathcal{C}}\,\mathbf{x} = \mathbf{b}_j$; solve both systems together.` },
      ...red.steps,
      { math: md`P_{\mathcal{C} \leftarrow \mathcal{B}} = ${matTex(PCB)}`, note: md`The right block. Check the first column: $${PCB[0]![0]}${colTex(cols2(PC)[0]!)} ${PCB[1]![0]! < 0 ? "-" : "+"} ${Math.abs(PCB[1]![0]!)}${colTex(cols2(PC)[1]!)} = ${colTex(cols2(PB)[0]!)} = \mathbf{b}_1$.` },
    ],
  };
};

const convertCoords: Generator = (r) => {
  const PB = invertible2(r, [1, 2, 3]);
  const PC = unimodular(r);
  const xB = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const v = matVec(PB, xB);
  const xC = matVec(inverse2(PC).map((row) => row.map((x) => x.n / x.d)), v);
  const red = reduce(
    PC.map((row, i) => [...row, v[i]!]),
    1,
  );
  return {
    prompt: md`Let $\mathcal{B} = ${Bset(PB)}$ and $\mathcal{C} = ${Bset(PC)}$, two bases of $\mathbb{R}^2$. A vector has $[\mathbf{v}]_{\mathcal{B}} = ${vecTex(xB)}$. Find $[\mathbf{v}]_{\mathcal{C}}$. Give it as (c_1, c_2), typed like (2, -1).`,
    answer: tup(xC),
    form: "tuple",
    verify: PC.map((row, i) => `${lin(row, ["a", "b"])} = ${v[i]}`),
    hint: md`First find $\mathbf{v}$ itself: $\mathbf{v} = ${xB[0]}\mathbf{b}_1 ${xB[1]! < 0 ? "-" : "+"} ${Math.abs(xB[1]!)}\mathbf{b}_2$. Then solve $c_1 \mathbf{c}_1 + c_2 \mathbf{c}_2 = \mathbf{v}$.`,
    solution: [
      { math: md`\mathbf{v} = ${xB[0]}${colTex(cols2(PB)[0]!)} ${xB[1]! < 0 ? "-" : "+"} ${Math.abs(xB[1]!)}${colTex(cols2(PB)[1]!)} = ${colTex(v)}`, note: md`$\mathcal{B}$-coordinates are weights on the $\mathcal{B}$ vectors.` },
      { math: md`c_1 ${colTex(cols2(PC)[0]!)} + c_2 ${colTex(cols2(PC)[1]!)} = ${colTex(v)}`, note: md`Now ask for weights on the $\mathcal{C}$ vectors instead.` },
      ...red.steps,
      { math: md`[\mathbf{v}]_{\mathcal{C}} = ${vecTex(xC)}`, note: "Same vector, new coordinates." },
    ],
  };
};

const polyCoords: Generator = (r) => {
  const [p0, p1, p2] = [r.int(-5, 5), r.nonzero(-5, 5), r.pick([1, -1, 2, -2, 3])];
  const ptex = poly([[p2, "x^2"], [p1, "x"], [p0, ""]]);
  if (r.next() < 0.6) {
    const h = r.pick([1, -1, 2, -2, 3]);
    const c = p2;
    const b = p1 + 2 * h * c;
    const a = p0 + b * h - c * h * h;
    const xmh = poly([[1, "x"], [-h, ""]]);
    return {
      prompt: md`$\mathcal{B} = \{ 1,\ ${xmh},\ (${xmh})^2 \}$ is a basis of $P_2$. Find the coordinate vector of $p(x) = ${ptex}$ relative to $\mathcal{B}$: the $(a, b, c)$ with $p(x) = a + b(${xmh}) + c(${xmh})^2$. Type it like (2, -1, 3).`,
      answer: `(${a}, ${b}, ${c})`,
      form: "tuple",
      verify: [`${lin([1, -h, h * h], LETTERS)} = ${p0}`, `${lin([0, 1, -2 * h], LETTERS)} = ${p1}`, `${lin([0, 0, 1], LETTERS)} = ${p2}`],
      hint: md`Expand $a + b(${xmh}) + c(${xmh})^2$ and match coefficients with $p$, starting from $x^2$. Each step down uses the values already found.`,
      solution: [
        { math: md`a + b(${xmh}) + c(${xmh})^2 = c\,x^2 + (b ${2 * h < 0 ? "-" : "+"} ${Math.abs(2 * h)}c)x + (a ${-h < 0 ? "-" : "+"} ${Math.abs(h)}b + ${h * h}c)`, note: md`Expand: $(${xmh})^2 = x^2 ${-2 * h < 0 ? "-" : "+"} ${Math.abs(2 * h)}x + ${h * h}$.` },
        { math: md`x^2: \quad c = ${p2}`, note: "Match the leading coefficient." },
        { math: md`x: \quad b ${2 * h < 0 ? "-" : "+"} ${Math.abs(2 * h)}(${c}) = ${p1} \;\Rightarrow\; b = ${b}`, note: "" },
        { math: md`1: \quad a ${-h < 0 ? "-" : "+"} ${Math.abs(h)}(${b}) + ${h * h}(${c}) = ${p0} \;\Rightarrow\; a = ${a}`, note: "" },
        { math: md`[p]_{\mathcal{B}} = (${a}, ${b}, ${c})`, note: md`Check: $${a} ${b < 0 ? "-" : "+"} ${Math.abs(b)}(${xmh}) ${c < 0 ? "-" : "+"} ${Math.abs(c)}(${xmh})^2 = ${ptex}$.` },
      ],
    };
  }
  const c = p2;
  const b = p1 - c;
  const a = p0 - b - c;
  return {
    prompt: md`$\mathcal{B} = \{ 1,\ 1 + x,\ 1 + x + x^2 \}$ is a basis of $P_2$. Find the coordinate vector of $p(x) = ${ptex}$ relative to $\mathcal{B}$: the $(a, b, c)$ with $p(x) = a + b(1 + x) + c(1 + x + x^2)$. Type it like (2, -1, 3).`,
    answer: `(${a}, ${b}, ${c})`,
    form: "tuple",
    verify: [`a + b + c = ${p0}`, `0a + b + c = ${p1}`, `0a + 0b + c = ${p2}`],
    hint: md`Expand and match coefficients. Only the last basis polynomial has an $x^2$ term, so start there.`,
    solution: [
      { math: md`a + b(1 + x) + c(1 + x + x^2) = c\,x^2 + (b + c)x + (a + b + c)`, note: "Expand and group by powers of x." },
      { math: md`x^2: \; c = ${p2} \qquad x: \; b + ${c} = ${p1} \Rightarrow b = ${b}`, note: "" },
      { math: md`1: \; a + ${pn(b)} + ${pn(c)} = ${p0} \Rightarrow a = ${a}`, note: "" },
      { math: md`[p]_{\mathcal{B}} = (${a}, ${b}, ${c})`, note: "" },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit5: Unit = {
  title: "Vector Spaces",
  lessons: [
    {
      id: slug("Vector spaces and subspaces"),
      title: "Vector spaces and subspaces",
      summary: "The short list of rules that make vectors behave like vectors, where else those rules hold, and the three-part test for a subspace.",
      blocks: [
        {
          kind: "text",
          body: md`In $\mathbb{R}^n$ you can add two vectors and you can scale a vector by a number. Everything in this course so far, from elimination to spans to independence to determinants, used only those two operations and a short list of rules they obey: addition is commutative, there is a zero vector, scaling distributes over addition, and so on.

That raises a question. Lots of other things can be added and scaled: polynomials, functions, matrices. If they obey the same rules, every argument we made about vectors in $\mathbb{R}^n$ works for them too, word for word. A **vector space** is any collection where the rules hold.`,
        },
        {
          kind: "key",
          title: "Vector space",
          body: md`A **vector space** is a set $V$ of objects called vectors, with two operations, addition $\mathbf{u} + \mathbf{v}$ and scalar multiplication $c\mathbf{v}$ (with $c$ a real number), such that for all $\mathbf{u}, \mathbf{v}, \mathbf{w}$ in $V$ and all scalars $c, d$:

- $\mathbf{u} + \mathbf{v}$ is in $V$, and $c\mathbf{u}$ is in $V$ (closure).
- $\mathbf{u} + \mathbf{v} = \mathbf{v} + \mathbf{u}$ and $(\mathbf{u} + \mathbf{v}) + \mathbf{w} = \mathbf{u} + (\mathbf{v} + \mathbf{w})$.
- There is a zero vector $\mathbf{0}$ with $\mathbf{u} + \mathbf{0} = \mathbf{u}$, and each $\mathbf{u}$ has a negative $-\mathbf{u}$ with $\mathbf{u} + (-\mathbf{u}) = \mathbf{0}$.
- $c(\mathbf{u} + \mathbf{v}) = c\mathbf{u} + c\mathbf{v}$ and $(c + d)\mathbf{u} = c\mathbf{u} + d\mathbf{u}$.
- $c(d\mathbf{u}) = (cd)\mathbf{u}$ and $1\mathbf{u} = \mathbf{u}$.`,
        },
        {
          kind: "text",
          body: md`Some vector spaces, with their zero vectors:

- $\mathbb{R}^n$. The zero vector is $(0, \dots, 0)$.
- $P_n$, the polynomials of degree at most $n$: $(2x^2 + 1) + (x - 3) = 2x^2 + x - 2$ and $5(x - 3) = 5x - 15$. The zero vector is the zero polynomial.
- $M_{2 \times 2}$, the $2 \times 2$ matrices, added and scaled entry by entry. The zero vector is the zero matrix.
- The functions on an interval, with $(f + g)(x) = f(x) + g(x)$ and $(cf)(x) = c\,f(x)$. The zero vector is the function that is $0$ everywhere.

In each case the rules are inherited from ordinary arithmetic on the numbers inside: coefficients, entries or function values. Polynomial addition is commutative because the addition of each coefficient is.`,
        },
        {
          kind: "why",
          title: "Why this list is enough",
          body: md`The list looks long, but notice what is missing. It never says $0\mathbf{v} = \mathbf{0}$, or that $(-1)\mathbf{v}$ is the negative of $\mathbf{v}$. Those follow from the rules, which is the point: a short list that forces everything else.

Here is $0\mathbf{v} = \mathbf{0}$. Since $0 = 0 + 0$,
$$0\mathbf{v} = (0 + 0)\mathbf{v} = 0\mathbf{v} + 0\mathbf{v}.$$
Add the negative of $0\mathbf{v}$ to both sides. The left becomes $\mathbf{0}$ and the right becomes $0\mathbf{v}$. So $\mathbf{0} = 0\mathbf{v}$.

And $(-1)\mathbf{v}$ is the negative of $\mathbf{v}$ because $\mathbf{v} + (-1)\mathbf{v} = (1 + (-1))\mathbf{v} = 0\mathbf{v} = \mathbf{0}$.

Every fact about $\mathbb{R}^n$ that was proved from these rules alone, such as "a span is closed under addition" or "the solutions of a homogeneous system can be added", is now a fact about polynomials, matrices and functions as well.`,
        },
        {
          kind: "text",
          body: md`Most of the time we don't meet a vector space on its own. We meet a piece of one: a line through the origin inside $\mathbb{R}^2$, the plane $x + 2y - z = 0$ inside $\mathbb{R}^3$, the polynomials that vanish at $x = 1$ inside $P_2$. A piece that is itself a vector space, under the same addition and scaling, is called a **subspace**.`,
        },
        {
          kind: "key",
          title: "Subspace, and the three-part test",
          body: md`A subset $H$ of a vector space $V$ is a **subspace** of $V$ when

- the zero vector of $V$ is in $H$;
- $H$ is closed under addition: if $\mathbf{u}$ and $\mathbf{v}$ are in $H$, so is $\mathbf{u} + \mathbf{v}$;
- $H$ is closed under scalar multiplication: if $\mathbf{u}$ is in $H$ and $c$ is any scalar, $c\mathbf{u}$ is in $H$.

A subspace is a vector space in its own right. Every vector space has two trivial subspaces, $\{\mathbf{0}\}$ and $V$ itself.`,
        },
        {
          kind: "why",
          title: "Why three checks settle all ten axioms",
          body: md`The two closure checks are exactly the axioms that could fail: they say the operations never leave $H$. The six rules of the form "this equals that" (commutativity, associativity, the distributive laws, $1\mathbf{u} = \mathbf{u}$) hold for every vector in $V$, so they certainly hold for the vectors in $H$. That leaves the zero vector and negatives. The zero vector is the first check. Negatives come free from the third: $-\mathbf{u} = (-1)\mathbf{u}$, which is in $H$ whenever $\mathbf{u}$ is.

The first check is partly a shortcut. If $H$ has any vector $\mathbf{u}$ at all, the third check already gives $0\mathbf{u} = \mathbf{0}$. But it is the fastest way to throw out a candidate: a line that misses the origin, the plane $x + 2y - z = 3$, polynomials with $p(0) = 1$. No zero vector, no subspace, and you are done.`,
        },
        {
          kind: "diagram",
          view: [-3.5, 4.5, -2.5, 8.5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", hidden: true },
            { name: "A", x: -2.75, y: -2.5, label: "", hidden: true },
            { name: "B", x: 2.75, y: 8.5, label: "", hidden: true },
            { name: "C", x: -1.25, y: -2.5, label: "", hidden: true },
            { name: "D", x: 4.25, y: 8.5, label: "", hidden: true },
            { name: "U", x: 1, y: 5, label: "\\mathbf{u}", dir: "e" },
            { name: "V", x: -1, y: 1, label: "\\mathbf{v}", dir: "w" },
            { name: "S", x: 0, y: 6, label: "\\mathbf{u} + \\mathbf{v}", dir: "nw" },
            { name: "T", x: "t", y: "5t", label: "t\\mathbf{u}", dir: "e" },
          ],
          segments: [
            { from: "A", to: "B", kind: "line", color: 2, label: "y = 2x + 3" },
            { from: "C", to: "D", kind: "line", color: 3, label: "y = 2x" },
            { from: "O", to: "U", arrow: true, color: 2 },
            { from: "O", to: "V", arrow: true, color: 2 },
            { from: "O", to: "S", arrow: true, color: 4 },
            { from: "O", to: "T", arrow: true, color: 4, dashed: true },
          ],
          params: [{ name: "t", min: -0.5, max: 1.5, step: 0.25, value: 1.5 }],
          caption: md`Two lines in $\mathbb{R}^2$. The vectors $\mathbf{u}$ and $\mathbf{v}$ both end on the line $y = 2x + 3$, but $\mathbf{u} + \mathbf{v}$ does not, and neither does $t\mathbf{u}$ unless $t = 1$. The line $y = 2x$ through the origin has no such problem: sums and multiples of its vectors stay on it. Lines through the origin are subspaces; shifted lines are not.`,
        },
        {
          kind: "example",
          title: "A plane through the origin is a subspace",
          problem: md`Show that $W = \{ (x, y, z) : x + 2y - z = 0 \}$ is a subspace of $\mathbb{R}^3$.`,
          steps: [
            { math: md`0 + 2(0) - 0 = 0`, note: md`The zero vector satisfies the equation, so $\mathbf{0} \in W$.` },
            {
              math: md`(x_1 + x_2) + 2(y_1 + y_2) - (z_1 + z_2) = (x_1 + 2y_1 - z_1) + (x_2 + 2y_2 - z_2) = 0 + 0 = 0`,
              note: md`Take two vectors in $W$ and add them. Regroup: each bracket is $0$ because each vector was in $W$. The sum is in $W$.`,
            },
            { math: md`(cx) + 2(cy) - (cz) = c(x + 2y - z) = c \cdot 0 = 0`, note: md`Scale a vector in $W$ by $c$. The left side is $c$ times $0$. So $c\mathbf{u} \in W$.` },
            { math: md`W \text{ is a subspace of } \mathbb{R}^3`, note: "All three checks pass. The same argument works for any equation that is linear in the coordinates with a zero on the right." },
          ],
        },
        {
          kind: "example",
          title: "Two axes together are not a subspace",
          problem: md`Is $W = \{ (x, y) : xy = 0 \}$, the union of the two coordinate axes, a subspace of $\mathbb{R}^2$?`,
          steps: [
            { math: md`(0, 0) \in W`, note: md`$0 \cdot 0 = 0$. The origin is on both axes, so the first check passes.` },
            { math: md`(1, 0) \in W, \qquad (0, 1) \in W`, note: "Pick one vector from each axis." },
            { math: md`(1, 0) + (0, 1) = (1, 1), \qquad 1 \cdot 1 = 1 \ne 0`, note: md`The sum is on neither axis. $W$ is not closed under addition, so it is not a subspace.` },
          ],
        },
        {
          kind: "surface",
          x: [-3, 3],
          y: [-3, 3],
          z: [-12, 12],
          expr: "x + 2y + k",
          params: [{ name: "k", min: -4, max: 4, step: 1, value: 0 }],
          caption: md`The plane $z = x + 2y + k$, which is $x + 2y - z = -k$. Turn it, then slide $k$. Only at $k = 0$ does the plane pass through the origin, and only then is it a subspace of $\mathbb{R}^3$. The others are shifted copies: closed under neither sums nor scaling.`,
        },
        {
          kind: "proof",
          title: "Every span is a subspace",
          given: md`$\mathbf{v}_1, \dots, \mathbf{v}_p$ are vectors in a vector space $V$`,
          prove: md`$H = \operatorname{Span}\{\mathbf{v}_1, \dots, \mathbf{v}_p\}$ is a subspace of $V$`,
          steps: [
            { statement: md`$\mathbf{0} = 0\mathbf{v}_1 + \dots + 0\mathbf{v}_p$, so $\mathbf{0} \in H$`, reason: "A combination with every weight 0 is in the span" },
            { statement: md`Let $\mathbf{u} = a_1 \mathbf{v}_1 + \dots + a_p \mathbf{v}_p$ and $\mathbf{w} = b_1 \mathbf{v}_1 + \dots + b_p \mathbf{v}_p$ be in $H$`, reason: "Definition of span: every vector in it is a combination" },
            { statement: md`$\mathbf{u} + \mathbf{w} = (a_1 + b_1)\mathbf{v}_1 + \dots + (a_p + b_p)\mathbf{v}_p$`, reason: md`Commutativity and associativity to pair up terms, then $(c + d)\mathbf{v} = c\mathbf{v} + d\mathbf{v}$` },
            { statement: md`$\mathbf{u} + \mathbf{w} \in H$`, reason: "It is a combination of the v's" },
            { statement: md`$c\mathbf{u} = (ca_1)\mathbf{v}_1 + \dots + (ca_p)\mathbf{v}_p$`, reason: md`$c(\mathbf{x} + \mathbf{y}) = c\mathbf{x} + c\mathbf{y}$ and $c(d\mathbf{v}) = (cd)\mathbf{v}$` },
            { statement: md`$c\mathbf{u} \in H$`, reason: "It is a combination of the v's" },
            { statement: md`$H$ is a subspace of $V$`, reason: "Three-part test" },
          ],
        },
        {
          kind: "text",
          body: md`That proof used only the axioms, so it holds in every vector space: $\operatorname{Span}\{1, x^2\}$ is a subspace of $P_2$ just as $\operatorname{Span}\{(1, 2)\}$ is a subspace of $\mathbb{R}^2$. Spans are the main source of subspaces, and we will see in the next lesson that every subspace of $\mathbb{R}^n$ is a span.

The subspaces of $\mathbb{R}^2$ are $\{\mathbf{0}\}$, the lines through the origin, and $\mathbb{R}^2$ itself. The subspaces of $\mathbb{R}^3$ are $\{\mathbf{0}\}$, lines through the origin, planes through the origin, and $\mathbb{R}^3$. Nothing else: a subspace that contains a vector contains its whole line, and one that contains two non-parallel vectors contains their whole plane.`,
        },
        {
          kind: "check",
          prompt: md`Is $W = \{ (x, y) : y \ge 0 \}$, the upper half-plane, a subspace of $\mathbb{R}^2$? Run the three checks in order and pick the first that fails.`,
          choices: SUB_CHOICES,
          accept: [SUB_CHOICES[3]!],
          explain: md`$(0, 0)$ is in $W$, and adding two vectors with $y \ge 0$ gives $y \ge 0$. But $(-1)(0, 1) = (0, -1)$ has $y < 0$. Closed under addition, not under scalar multiplication.`,
        },
        {
          kind: "check",
          prompt: md`$W = \{ p \in P_2 : p(1) = 0 \}$ is a subspace of $P_2$. Find $k$ so that $p(x) = x^2 - 4x + k$ is in $W$.`,
          answer: "3",
          explain: md`Membership means $p(1) = 0$: $1 - 4 + k = 0$, so $k = 3$. Then $p(x) = x^2 - 4x + 3 = (x - 1)(x - 3)$, which does vanish at $1$.`,
        },
      ],
      practice: [subspaceTest, missingComponent, polyCombination],
    },
    {
      id: slug("Null space and column space"),
      title: "Null space and column space",
      summary: "The two subspaces every matrix carries: the inputs it sends to zero and the outputs it can reach, with a basis for each read off the reduced row echelon form.",
      blocks: [
        {
          kind: "text",
          body: md`An $m \times n$ matrix $A$ turns inputs $\mathbf{x}$ in $\mathbb{R}^n$ into outputs $A\mathbf{x}$ in $\mathbb{R}^m$. Two natural questions come with it. Which inputs does it send to $\mathbf{0}$? And which outputs can it reach at all? Each answer is a subspace.`,
        },
        {
          kind: "key",
          title: "Null space and column space",
          body: md`For an $m \times n$ matrix $A$:

- The **null space** $\operatorname{Nul} A$ is the set of all solutions of $A\mathbf{x} = \mathbf{0}$. It lives in $\mathbb{R}^n$, the input space.
- The **column space** $\operatorname{Col} A$ is the span of the columns of $A$, which is the same as the set of all outputs $A\mathbf{x}$. It lives in $\mathbb{R}^m$, the output space.

$\mathbf{b}$ is in $\operatorname{Col} A$ exactly when $A\mathbf{x} = \mathbf{b}$ has a solution.`,
        },
        {
          kind: "proof",
          title: "The null space is a subspace",
          given: md`$A$ is an $m \times n$ matrix`,
          prove: md`$\operatorname{Nul} A$ is a subspace of $\mathbb{R}^n$`,
          steps: [
            { statement: md`$A\mathbf{0} = \mathbf{0}$, so $\mathbf{0} \in \operatorname{Nul} A$`, reason: "Every entry of the product is a sum of zeros" },
            { statement: md`Let $\mathbf{u}, \mathbf{v} \in \operatorname{Nul} A$, so $A\mathbf{u} = \mathbf{0}$ and $A\mathbf{v} = \mathbf{0}$`, reason: "Definition of the null space" },
            { statement: md`$A(\mathbf{u} + \mathbf{v}) = A\mathbf{u} + A\mathbf{v} = \mathbf{0} + \mathbf{0} = \mathbf{0}$`, reason: "Matrix multiplication distributes over addition (Unit 3)" },
            { statement: md`$\mathbf{u} + \mathbf{v} \in \operatorname{Nul} A$`, reason: "It solves the homogeneous equation" },
            { statement: md`$A(c\mathbf{u}) = c(A\mathbf{u}) = c\mathbf{0} = \mathbf{0}$`, reason: "Scalars pull through a matrix product" },
            { statement: md`$c\mathbf{u} \in \operatorname{Nul} A$, so $\operatorname{Nul} A$ is a subspace`, reason: "Three-part test" },
          ],
        },
        {
          kind: "why",
          title: "Why the column space is a subspace, and why it is the set of outputs",
          body: md`$\operatorname{Col} A$ is defined as a span, and the last lesson proved that every span is a subspace. Done.

Why is it also the set of all outputs? The column picture from Unit 1: $A\mathbf{x} = x_1 \mathbf{a}_1 + \dots + x_n \mathbf{a}_n$. So every output $A\mathbf{x}$ is a combination of the columns, with the entries of $\mathbf{x}$ as weights, and every combination of the columns is an output. The two descriptions are the same set. In particular, $A\mathbf{x} = \mathbf{b}$ is consistent exactly when $\mathbf{b} \in \operatorname{Col} A$.`,
        },
        {
          kind: "diagram",
          view: [-5, 5, -4, 6],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", hidden: true },
            { name: "N1", x: 5, y: -2.5, label: "", hidden: true },
            { name: "N2", x: -5, y: 2.5, label: "", hidden: true },
            { name: "C1", x: -2, y: -4, label: "", hidden: true },
            { name: "C2", x: 3, y: 6, label: "", hidden: true },
            { name: "A1", x: 1, y: 2, label: "\\mathbf{a}_1 = (1, 2)", dir: "e" },
            { name: "A2", x: 2, y: 4, label: "\\mathbf{a}_2 = (2, 4)", dir: "e" },
            { name: "X", x: "2t", y: "-t", label: "\\mathbf{x} = ({=2t}, {=-t})", dir: "s" },
            { name: "P", x: 3, y: 5, label: "\\mathbf{b} = (3, 5)", dir: "e", },
          ],
          segments: [
            { from: "N1", to: "N2", kind: "line", color: 3, label: "\\operatorname{Nul} A" },
            { from: "C1", to: "C2", kind: "line", color: 2, label: "\\operatorname{Col} A" },
            { from: "O", to: "A1", arrow: true, color: 2 },
            { from: "O", to: "A2", arrow: true, color: 2 },
            { from: "O", to: "X", arrow: true, color: 3 },
            { from: "O", to: "P", arrow: true, color: 4, dashed: true },
          ],
          params: [{ name: "t", min: -2, max: 2, step: 0.5, value: 1 }],
          readouts: [
            { label: "x_1 + 2x_2", value: "2t + 2(-t)" },
            { label: "2x_1 + 4x_2", value: "2(2t) + 4(-t)" },
          ],
          caption: md`$A = \begin{bmatrix} 1 & 2 \\ 2 & 4 \end{bmatrix}$. Its columns are parallel, so $\operatorname{Col} A$ is the line through $(1, 2)$. Its null space is the line of vectors $(2t, -t)$: slide $t$ and watch both rows of $A\mathbf{x}$ stay at $0$. The vector $\mathbf{b} = (3, 5)$ is off the column line, so $A\mathbf{x} = \mathbf{b}$ has no solution.`,
        },
        {
          kind: "example",
          title: "A basis for the null space",
          problem: md`Find a basis for $\operatorname{Nul} A$ where $A = \begin{bmatrix} 1 & 3 & 0 & 2 \\ 2 & 6 & 1 & 7 \\ -1 & -3 & 1 & 1 \end{bmatrix}$.`,
          steps: [
            { math: md`\begin{bmatrix} 1 & 3 & 0 & 2 \\ 0 & 0 & 1 & 3 \\ 0 & 0 & 1 & 3 \end{bmatrix}`, note: md`$R_2 \leftarrow R_2 - 2R_1$ and $R_3 \leftarrow R_3 + R_1$. Row operations don't change the solutions of $A\mathbf{x} = \mathbf{0}$, so they don't change the null space.` },
            { math: md`\begin{bmatrix} 1 & 3 & 0 & 2 \\ 0 & 0 & 1 & 3 \\ 0 & 0 & 0 & 0 \end{bmatrix}`, note: md`$R_3 \leftarrow R_3 - R_2$. This is the reduced row echelon form. Pivot columns 1 and 3; free variables $x_2$ and $x_4$.` },
            { math: md`x_1 = -3x_2 - 2x_4, \qquad x_3 = -3x_4`, note: "Each nonzero row gives a basic variable in terms of the free ones." },
            {
              math: md`\mathbf{x} = \begin{bmatrix} -3x_2 - 2x_4 \\ x_2 \\ -3x_4 \\ x_4 \end{bmatrix} = x_2 \begin{bmatrix} -3 \\ 1 \\ 0 \\ 0 \end{bmatrix} + x_4 \begin{bmatrix} -2 \\ 0 \\ -3 \\ 1 \end{bmatrix}`,
              note: "Parametric vector form: split the solution by free variable.",
            },
            { math: md`\operatorname{Nul} A = \operatorname{Span}\left\{ (-3, 1, 0, 0),\ (-2, 0, -3, 1) \right\}`, note: md`The two vectors span the null space, and we will see they are independent, so they are a basis. The first comes from $x_2 = 1, x_4 = 0$; the second from $x_2 = 0, x_4 = 1$.` },
          ],
        },
        {
          kind: "key",
          title: "Basis for the null space",
          body: md`Row reduce $A$ to reduced row echelon form and write the solution of $A\mathbf{x} = \mathbf{0}$ in parametric vector form. The vectors multiplying the free variables form a basis of $\operatorname{Nul} A$: one basis vector for each free variable.

The convention: the basis vector for the free variable $x_j$ has $x_j = 1$ and every other free variable $0$. If there are no free variables, $\operatorname{Nul} A = \{\mathbf{0}\}$ and the basis is empty.`,
        },
        {
          kind: "why",
          title: "Why those vectors are independent and span",
          body: md`Call the vectors in the example $\mathbf{u}$ (from $x_2 = 1$) and $\mathbf{w}$ (from $x_4 = 1$). Every solution is $x_2 \mathbf{u} + x_4 \mathbf{w}$, so they span $\operatorname{Nul} A$. That is what parametric vector form says.

Why independent? Look only at the free positions, 2 and 4. There $\mathbf{u}$ reads $(1, 0)$ and $\mathbf{w}$ reads $(0, 1)$. If $c_1 \mathbf{u} + c_2 \mathbf{w} = \mathbf{0}$, position 2 says $c_1 = 0$ and position 4 says $c_2 = 0$. The same argument works for any number of free variables: each basis vector has a $1$ in its own free position where all the others have $0$, so no nontrivial combination can vanish.`,
        },
        {
          kind: "example",
          title: "A basis for the column space",
          problem: md`Find a basis for $\operatorname{Col} A$ for the same $A = \begin{bmatrix} 1 & 3 & 0 & 2 \\ 2 & 6 & 1 & 7 \\ -1 & -3 & 1 & 1 \end{bmatrix}$.`,
          steps: [
            { math: md`\text{RREF: } \begin{bmatrix} 1 & 3 & 0 & 2 \\ 0 & 0 & 1 & 3 \\ 0 & 0 & 0 & 0 \end{bmatrix}, \quad \text{pivot columns } 1 \text{ and } 3`, note: "Reuse the reduction." },
            { math: md`\operatorname{Col} A \text{ has basis } \left\{ \begin{bmatrix} 1 \\ 2 \\ -1 \end{bmatrix}, \begin{bmatrix} 0 \\ 1 \\ 1 \end{bmatrix} \right\}`, note: md`Take the pivot columns of the **original** $A$, not of the reduced matrix.` },
            { math: md`\mathbf{a}_2 = 3\mathbf{a}_1, \qquad \mathbf{a}_4 = 2\mathbf{a}_1 + 3\mathbf{a}_3`, note: md`Check that the other columns are combinations of these two: $(3, 6, -3) = 3(1, 2, -1)$ and $(2, 7, 1) = 2(1, 2, -1) + 3(0, 1, 1)$. The weights are exactly the entries of the non-pivot columns of the RREF.` },
          ],
        },
        {
          kind: "why",
          title: "Why the pivot columns of A (not of the RREF) are a basis",
          body: md`Row operations don't change $\operatorname{Nul} A$: a vector $\mathbf{x}$ solves $A\mathbf{x} = \mathbf{0}$ exactly when it solves $R\mathbf{x} = \mathbf{0}$ for the reduced form $R$. But $A\mathbf{x} = \mathbf{0}$ is a dependence relation among the columns of $A$, with weights from $\mathbf{x}$, and $R\mathbf{x} = \mathbf{0}$ is the same relation among the columns of $R$. So **the columns of $A$ and the columns of $R$ satisfy exactly the same dependence relations.**

In $R$ the story is plain. The pivot columns are columns of the identity, so they are independent, and each non-pivot column is visibly a combination of the pivot columns to its left (its entries are the weights). Because the relations are the same, the pivot columns of $A$ are independent too, and the other columns of $A$ are combinations of them with the same weights. So the pivot columns of $A$ span $\operatorname{Col} A$ and are independent: a basis.

The columns of $R$ themselves are usually **not** in $\operatorname{Col} A$. Here $\operatorname{Col} R$ contains $(1, 0, 0)$, but every vector in $\operatorname{Col} A$ has the form $s(1, 2, -1) + t(0, 1, 1)$, and $(1, 0, 0)$ is not one of those. Row operations change the column space; they only preserve the relations among the columns.`,
        },
        {
          kind: "proof",
          title: "Solutions of Ax = b are a particular solution plus the null space",
          given: md`$A\mathbf{x}_p = \mathbf{b}$`,
          prove: md`The solutions of $A\mathbf{x} = \mathbf{b}$ are exactly the vectors $\mathbf{x}_p + \mathbf{h}$ with $\mathbf{h} \in \operatorname{Nul} A$`,
          steps: [
            { statement: md`If $\mathbf{h} \in \operatorname{Nul} A$, then $A(\mathbf{x}_p + \mathbf{h}) = A\mathbf{x}_p + A\mathbf{h} = \mathbf{b} + \mathbf{0} = \mathbf{b}$`, reason: "Distributivity; so every such vector is a solution" },
            { statement: md`Now let $\mathbf{x}$ be any solution, and set $\mathbf{h} = \mathbf{x} - \mathbf{x}_p$`, reason: "We show every solution has this form" },
            { statement: md`$A\mathbf{h} = A\mathbf{x} - A\mathbf{x}_p = \mathbf{b} - \mathbf{b} = \mathbf{0}$`, reason: "Both are solutions" },
            { statement: md`$\mathbf{h} \in \operatorname{Nul} A$ and $\mathbf{x} = \mathbf{x}_p + \mathbf{h}$`, reason: "Definition of the null space; rearrange" },
          ],
        },
        {
          kind: "text",
          body: md`That is the geometry behind "infinitely many solutions" in Unit 1: the solution set of a consistent system is the null space shifted to pass through one particular solution. It is a subspace only when $\mathbf{b} = \mathbf{0}$.

The two spaces side by side:

- $\operatorname{Nul} A$ is in $\mathbb{R}^n$; $\operatorname{Col} A$ is in $\mathbb{R}^m$.
- $\operatorname{Nul} A$ is described implicitly (a condition to test: is $A\mathbf{v} = \mathbf{0}$?). $\operatorname{Col} A$ is described explicitly (vectors that are built, as combinations), and testing membership means solving a system.
- $\operatorname{Nul} A = \{\mathbf{0}\}$ exactly when the columns are independent, which is exactly when $A\mathbf{x} = \mathbf{b}$ never has more than one solution.
- $\operatorname{Col} A = \mathbb{R}^m$ exactly when there is a pivot in every row, which is exactly when $A\mathbf{x} = \mathbf{b}$ has a solution for every $\mathbf{b}$.`,
        },
        {
          kind: "check",
          prompt: md`$A = \begin{bmatrix} 1 & 2 & -1 \\ 2 & 4 & -2 \end{bmatrix}$ has reduced row echelon form $\begin{bmatrix} 1 & 2 & -1 \\ 0 & 0 & 0 \end{bmatrix}$. Give the basis vector of $\operatorname{Nul} A$ with $x_2 = 1$ and $x_3 = 0$, typed like (1, 2, 3).`,
          answer: "(-2, 1, 0)",
          form: "tuple",
          explain: md`The one nonzero row says $x_1 = -2x_2 + x_3$. With $x_2 = 1$, $x_3 = 0$: $x_1 = -2$. Check: $1(-2) + 2(1) - 1(0) = 0$.`,
        },
        {
          kind: "check",
          prompt: md`Is $\mathbf{b} = (1, 1)$ in the column space of $A = \begin{bmatrix} 1 & 2 \\ 2 & 4 \end{bmatrix}$?`,
          choices: ["Yes", "No"],
          accept: ["No"],
          explain: md`Both columns are multiples of $(1, 2)$, so $\operatorname{Col} A$ is the line of vectors $(t, 2t)$. $(1, 1)$ would need $t = 1$ and $2t = 1$ at once. Equivalently, $[A \mid \mathbf{b}]$ reduces to a row $[0\ 0 \mid -1]$.`,
        },
      ],
      practice: [nullBasis, colCombination, whichInNul],
    },
    {
      id: slug("Basis and dimension"),
      title: "Basis and dimension",
      summary: "A basis is a spanning set with nothing wasted. Every vector gets exactly one set of coordinates, every basis of a space has the same size, and that size is the dimension.",
      blocks: [
        {
          kind: "text",
          body: md`The standard vectors $\mathbf{e}_1, \dots, \mathbf{e}_n$ have two properties that make $\mathbb{R}^n$ easy to work in. They span: every vector is $x_1 \mathbf{e}_1 + \dots + x_n \mathbf{e}_n$. And they are independent: that way of writing a vector is the only one. Any set of vectors with both properties does the same job for its span.`,
        },
        {
          kind: "key",
          title: "Basis",
          body: md`A **basis** of a vector space (or subspace) $H$ is a set of vectors $\mathcal{B} = \{\mathbf{b}_1, \dots, \mathbf{b}_p\}$ that

- is linearly independent, and
- spans $H$.

Examples: $\{\mathbf{e}_1, \dots, \mathbf{e}_n\}$ is the **standard basis** of $\mathbb{R}^n$. $\{1, x, x^2\}$ is the standard basis of $P_2$. The pivot columns of $A$ are a basis of $\operatorname{Col} A$, and the parametric-form vectors are a basis of $\operatorname{Nul} A$. Any $n$ independent vectors in $\mathbb{R}^n$ are a basis of $\mathbb{R}^n$ (shown below).`,
        },
        {
          kind: "why",
          title: "Why both conditions",
          body: md`Spanning alone isn't enough. $\{(1, 0), (0, 1), (1, 1)\}$ spans $\mathbb{R}^2$, but $(2, 1) = 2(1, 0) + 1(0, 1)$ and also $(2, 1) = 1(1, 0) + 0(0, 1) + 1(1, 1)$. Two different sets of weights for one vector: no usable notion of "coordinates".

Independence alone isn't enough either. $\{(1, 0, 0), (0, 1, 0)\}$ is independent in $\mathbb{R}^3$, but $(0, 0, 1)$ can't be written with them at all.

Together, the two conditions say: every vector can be written as a combination (span), and in only one way (independence). That uniqueness is the next theorem.`,
        },
        {
          kind: "proof",
          title: "Unique representation",
          given: md`$\mathcal{B} = \{\mathbf{b}_1, \dots, \mathbf{b}_p\}$ is a basis of $H$, and $\mathbf{v} \in H$`,
          prove: md`There is exactly one list of weights $c_1, \dots, c_p$ with $\mathbf{v} = c_1 \mathbf{b}_1 + \dots + c_p \mathbf{b}_p$`,
          steps: [
            { statement: md`At least one list exists`, reason: md`$\mathcal{B}$ spans $H$` },
            { statement: md`Suppose $\mathbf{v} = c_1 \mathbf{b}_1 + \dots + c_p \mathbf{b}_p$ and also $\mathbf{v} = d_1 \mathbf{b}_1 + \dots + d_p \mathbf{b}_p$`, reason: "Two candidate lists" },
            { statement: md`$\mathbf{0} = \mathbf{v} - \mathbf{v} = (c_1 - d_1)\mathbf{b}_1 + \dots + (c_p - d_p)\mathbf{b}_p$`, reason: "Subtract and regroup" },
            { statement: md`$c_1 - d_1 = 0, \dots, c_p - d_p = 0$`, reason: md`$\mathcal{B}$ is independent: only the trivial combination gives $\mathbf{0}$` },
            { statement: md`$c_i = d_i$ for every $i$: the two lists are the same`, reason: "Add $d_i$ to both sides" },
          ],
        },
        {
          kind: "key",
          title: "Coordinates",
          body: md`If $\mathcal{B} = \{\mathbf{b}_1, \dots, \mathbf{b}_p\}$ is a basis of $H$ and $\mathbf{v} = c_1 \mathbf{b}_1 + \dots + c_p \mathbf{b}_p$, the weights are the **coordinates of $\mathbf{v}$ relative to $\mathcal{B}$**, and
$$[\mathbf{v}]_{\mathcal{B}} = \begin{bmatrix} c_1 \\ \vdots \\ c_p \end{bmatrix}$$
is the **coordinate vector**. To find it in $\mathbb{R}^n$, solve the system $c_1 \mathbf{b}_1 + \dots + c_p \mathbf{b}_p = \mathbf{v}$: row reduce the augmented matrix with the basis vectors as its columns.`,
        },
        {
          kind: "diagram",
          view: [-5, 6, -3, 6],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", hidden: true },
            { name: "B1", x: 2, y: 1, label: "\\mathbf{b}_1", dir: "se" },
            { name: "B2", x: -1, y: 1, label: "\\mathbf{b}_2", dir: "nw" },
            { name: "P", x: "2c", y: "c", label: "", hidden: true },
            { name: "V", x: "2c - d", y: "c + d", label: "\\mathbf{v} = ({=2c - d}, {=c + d})", dir: "ne" },
          ],
          segments: [
            { from: "O", to: "B1", arrow: true, color: 1 },
            { from: "O", to: "B2", arrow: true, color: 2 },
            { from: "O", to: "P", dashed: true, color: 1, label: "c_1 \\mathbf{b}_1" },
            { from: "P", to: "V", dashed: true, color: 2, label: "c_2 \\mathbf{b}_2" },
            { from: "O", to: "V", arrow: true, color: 4 },
          ],
          labels: [{ x: -4.2, y: 5.4, text: "[\\mathbf{v}]_{\\mathcal{B}} = ({c}, {d})" }],
          params: [
            { name: "c", tex: "c_1", min: -2, max: 2.5, step: 0.5, value: 2 },
            { name: "d", tex: "c_2", min: -2, max: 2.5, step: 0.5, value: 1 },
          ],
          caption: md`$\mathcal{B} = \{(2, 1), (-1, 1)\}$. Slide the coordinates: $\mathbf{v} = c_1 \mathbf{b}_1 + c_2 \mathbf{b}_2$ is built by walking $c_1$ steps along $\mathbf{b}_1$ and then $c_2$ steps along $\mathbf{b}_2$. The pair $(c_1, c_2)$ is the address of $\mathbf{v}$ in the slanted grid the basis defines, just as $(x, y)$ is its address in the square grid.`,
        },
        {
          kind: "example",
          title: "Finding coordinates",
          problem: md`Find $[\mathbf{v}]_{\mathcal{B}}$ for $\mathbf{v} = (1, 5)$ and $\mathcal{B} = \{(2, 1), (-1, 1)\}$.`,
          steps: [
            { math: md`c_1 \begin{bmatrix} 2 \\ 1 \end{bmatrix} + c_2 \begin{bmatrix} -1 \\ 1 \end{bmatrix} = \begin{bmatrix} 1 \\ 5 \end{bmatrix}`, note: "Coordinates are the weights that rebuild v." },
            { math: md`\left[\begin{array}{cc|c} 2 & -1 & 1 \\ 1 & 1 & 5 \end{array}\right] \to \left[\begin{array}{cc|c} 1 & 1 & 5 \\ 0 & -3 & -9 \end{array}\right] \to \left[\begin{array}{cc|c} 1 & 0 & 2 \\ 0 & 1 & 3 \end{array}\right]`, note: md`Swap rows, $R_2 \leftarrow R_2 - 2R_1$, divide $R_2$ by $-3$, then $R_1 \leftarrow R_1 - R_2$.` },
            { math: md`[\mathbf{v}]_{\mathcal{B}} = \begin{bmatrix} 2 \\ 3 \end{bmatrix}`, note: md`Check: $2(2, 1) + 3(-1, 1) = (4 - 3, 2 + 3) = (1, 5)$.` },
          ],
        },
        {
          kind: "text",
          body: md`**Where bases come from.** Start with any finite set that spans $H$. If it is dependent, some vector in it is a combination of the others; throw that vector out. The span doesn't shrink (see below). Repeat until what remains is independent: that is a basis. Going the other way, an independent set that doesn't yet span can be grown: add any vector of $H$ outside the current span, and the set stays independent. So every subspace of $\mathbb{R}^n$ has a basis, and every subspace of $\mathbb{R}^n$ is the span of a finite set.`,
        },
        {
          kind: "why",
          title: "Why dropping a redundant vector keeps the span",
          body: md`Suppose $\mathbf{v}_p = a_1 \mathbf{v}_1 + \dots + a_{p-1} \mathbf{v}_{p-1}$. Any vector in $\operatorname{Span}\{\mathbf{v}_1, \dots, \mathbf{v}_p\}$ is $c_1 \mathbf{v}_1 + \dots + c_p \mathbf{v}_p$. Replace $\mathbf{v}_p$ by its expression:
$$c_1 \mathbf{v}_1 + \dots + c_{p-1}\mathbf{v}_{p-1} + c_p(a_1 \mathbf{v}_1 + \dots + a_{p-1} \mathbf{v}_{p-1}) = (c_1 + c_p a_1)\mathbf{v}_1 + \dots + (c_{p-1} + c_p a_{p-1})\mathbf{v}_{p-1}.$$
It is a combination of the first $p - 1$ vectors alone. So the span with $\mathbf{v}_p$ removed is the same set.

And why adding a vector $\mathbf{w}$ outside the span keeps independence: if $c_1 \mathbf{v}_1 + \dots + c_p \mathbf{v}_p + c\mathbf{w} = \mathbf{0}$ with $c \ne 0$, then $\mathbf{w} = -\frac{1}{c}(c_1 \mathbf{v}_1 + \dots)$ would be in the span, which it isn't. So $c = 0$, and then independence of the $\mathbf{v}$'s forces the other weights to be $0$.`,
        },
        {
          kind: "text",
          body: md`A space can have many bases: $\{(1, 0), (0, 1)\}$ and $\{(2, 1), (-1, 1)\}$ are both bases of $\mathbb{R}^2$. But they both have two vectors, and that is no accident. The key fact is a counting lemma.`,
        },
        {
          kind: "proof",
          title: "More vectors than a spanning set has must be dependent",
          given: md`$\{\mathbf{u}_1, \dots, \mathbf{u}_p\}$ spans $H$, and $\mathbf{w}_1, \dots, \mathbf{w}_q$ are in $H$ with $q > p$`,
          prove: md`$\{\mathbf{w}_1, \dots, \mathbf{w}_q\}$ is linearly dependent`,
          steps: [
            { statement: md`Each $\mathbf{w}_j = a_{1j}\mathbf{u}_1 + \dots + a_{pj}\mathbf{u}_p$ for some weights $a_{ij}$`, reason: "The u's span H" },
            { statement: md`Let $A$ be the $p \times q$ matrix of the weights $a_{ij}$. Then $A\mathbf{c} = \mathbf{0}$ has a nonzero solution $\mathbf{c}$`, reason: md`$A$ has more columns than rows, so at most $p < q$ pivots and at least one free variable (Unit 1)` },
            { statement: md`$c_1 \mathbf{w}_1 + \dots + c_q \mathbf{w}_q = \sum_{j} c_j \sum_{i} a_{ij}\mathbf{u}_i = \sum_{i} \Big(\sum_{j} a_{ij} c_j\Big)\mathbf{u}_i$`, reason: "Substitute step 1 and regroup by the u's" },
            { statement: md`Each inner sum $\sum_j a_{ij} c_j$ is the $i$-th entry of $A\mathbf{c}$, which is $0$`, reason: "Definition of the matrix-vector product" },
            { statement: md`$c_1 \mathbf{w}_1 + \dots + c_q \mathbf{w}_q = \mathbf{0}$ with $\mathbf{c} \ne \mathbf{0}$: the w's are dependent`, reason: "Definition of linear dependence" },
          ],
        },
        {
          kind: "key",
          title: "Dimension",
          body: md`**Theorem.** Any two bases of a vector space have the same number of vectors.

*Proof.* Let $\mathcal{B}$ have $p$ vectors and $\mathcal{C}$ have $q$. $\mathcal{B}$ spans and $\mathcal{C}$ is independent, so by the lemma $q \le p$. Swap the roles: $\mathcal{C}$ spans and $\mathcal{B}$ is independent, so $p \le q$. Hence $p = q$.

That common size is the **dimension** $\dim H$. If $H = \{\mathbf{0}\}$, its basis is the empty set and $\dim H = 0$.

$\dim \mathbb{R}^n = n$, $\dim P_n = n + 1$ (basis $1, x, \dots, x^n$), $\dim M_{2 \times 2} = 4$. A line through the origin has dimension 1, a plane through the origin dimension 2. $\dim \operatorname{Nul} A$ is the number of free variables and $\dim \operatorname{Col} A$ the number of pivot columns.`,
        },
        {
          kind: "why",
          title: "Why n independent vectors in an n-dimensional space are automatically a basis",
          body: md`Let $\dim H = n$ and let $S$ be a set of $n$ independent vectors in $H$. If $S$ didn't span $H$, we could add a vector outside its span and get $n + 1$ independent vectors. But a basis of $H$ has $n$ vectors and spans, so by the lemma any $n + 1$ vectors are dependent. Contradiction. So $S$ spans, and it is a basis.

The mirror statement: $n$ vectors that span $H$ are automatically independent. If they were dependent, dropping a redundant one would leave $n - 1$ vectors spanning $H$, and then the $n$ vectors of a basis would be dependent by the lemma. Contradiction.

So for $n$ vectors in $\mathbb{R}^n$ there is only one thing to check, and Unit 4 gave the quickest test: they are a basis exactly when the matrix with those columns has nonzero determinant. Fewer than $n$ vectors can never span $\mathbb{R}^n$; more than $n$ can never be independent.`,
        },
        {
          kind: "check",
          prompt: md`Do $(1, 2)$, $(3, 4)$ and $(5, 6)$ form a basis of $\mathbb{R}^2$?`,
          choices: [md`Yes`, md`No: three vectors in $\mathbb{R}^2$ can't be independent`, md`No: they don't span $\mathbb{R}^2$`],
          accept: [md`No: three vectors in $\mathbb{R}^2$ can't be independent`],
          explain: md`$\dim \mathbb{R}^2 = 2$, so any three vectors are dependent (here $(5, 6) = -(1, 2) + 2(3, 4)$). They do span, but a basis must also be independent.`,
        },
        {
          kind: "check",
          prompt: md`$H = \{ p \in P_3 : p(0) = 0 \}$ is a subspace of $P_3$. Find $\dim H$.`,
          answer: "3",
          explain: md`$p(0)$ is the constant term, so $H$ is the polynomials $a_1 x + a_2 x^2 + a_3 x^3$: that is $\operatorname{Span}\{x, x^2, x^3\}$, and these three are independent. $\dim H = 3$, one less than $\dim P_3 = 4$.`,
        },
      ],
      practice: [basisTest, coordinates, dependentK],
    },
    {
      id: slug("Rank"),
      title: "Rank",
      summary: "One number that says how much of a matrix is really there: the dimension of its column space, which also counts its pivots and its independent rows, and which fixes the size of the null space.",
      blocks: [
        {
          kind: "text",
          body: md`A $3 \times 4$ matrix has twelve entries, but it might be hiding a much smaller object. If every row is a multiple of the first, all twelve numbers carry one row's worth of information. The **rank** measures this.`,
        },
        {
          kind: "key",
          title: "Rank",
          body: md`The **rank** of $A$ is the dimension of its column space:
$$\operatorname{rank} A = \dim \operatorname{Col} A = \text{the number of pivot columns of } A.$$
The second equality is the last lesson's result that the pivot columns are a basis of $\operatorname{Col} A$. For an $m \times n$ matrix, $\operatorname{rank} A \le m$ (at most one pivot per row) and $\operatorname{rank} A \le n$ (at most one per column).`,
        },
        {
          kind: "text",
          body: md`Columns are not the only way to look at a matrix. The **row space** $\operatorname{Row} A$ is the span of the rows of $A$, a subspace of $\mathbb{R}^n$. It is the column space of $A^T$. It might seem that rows and columns could tell different stories, since $\operatorname{Col} A$ lives in $\mathbb{R}^m$ and $\operatorname{Row} A$ in $\mathbb{R}^n$. They don't.`,
        },
        {
          kind: "proof",
          title: "Row rank equals column rank",
          given: md`$A$ is an $m \times n$ matrix with reduced row echelon form $R$`,
          prove: md`$\dim \operatorname{Row} A = \operatorname{rank} A$`,
          steps: [
            { statement: md`$\operatorname{Row} A = \operatorname{Row} R$`, reason: "Each row operation replaces a row by a combination of rows, so new rows are in the old row space; the operation is reversible, so old rows are in the new one (see below)" },
            { statement: md`The nonzero rows of $R$ span $\operatorname{Row} R$`, reason: "Zero rows contribute nothing to a span" },
            { statement: md`The nonzero rows of $R$ are linearly independent`, reason: "Each has a leading 1 in a pivot column where every other row has 0, so in a combination equal to $\mathbf{0}$, that row's weight must be 0" },
            { statement: md`The nonzero rows of $R$ are a basis of $\operatorname{Row} A$`, reason: "Steps 1 to 3" },
            { statement: md`$\dim \operatorname{Row} A$ = number of nonzero rows of $R$ = number of pivots = $\operatorname{rank} A$`, reason: "Each nonzero row of an echelon form holds exactly one pivot" },
          ],
        },
        {
          kind: "why",
          title: "Why row operations don't change the row space",
          body: md`Take one operation, say $R_2 \leftarrow R_2 + 3R_1$, turning rows $\mathbf{r}_1, \mathbf{r}_2, \dots$ into $\mathbf{r}_1, \mathbf{r}_2 + 3\mathbf{r}_1, \dots$. Every new row is a combination of old rows, so the new row space is inside the old one. But the operation can be undone ($R_2 \leftarrow R_2 - 3R_1$), so every old row is a combination of new rows: $\mathbf{r}_2 = (\mathbf{r}_2 + 3\mathbf{r}_1) - 3\mathbf{r}_1$. The old row space is inside the new one. Two sets each inside the other are equal. Swaps and scalings work the same way, and a chain of operations is a chain of equalities.

Contrast with columns: row operations **do** change the column space (last lesson), but they keep the row space and the null space. That is why bases for $\operatorname{Row} A$ come from the rows of $R$, while bases for $\operatorname{Col} A$ come from the columns of $A$.`,
        },
        {
          kind: "example",
          title: "Rank, with bases for the column space and row space",
          problem: md`Find the rank of $A = \begin{bmatrix} 1 & 2 & 1 & 3 \\ 2 & 4 & 0 & 2 \\ 3 & 6 & 1 & 5 \end{bmatrix}$ and give a basis for $\operatorname{Col} A$ and for $\operatorname{Row} A$.`,
          steps: [
            { math: md`\begin{bmatrix} 1 & 2 & 1 & 3 \\ 0 & 0 & -2 & -4 \\ 0 & 0 & -2 & -4 \end{bmatrix}`, note: md`$R_2 \leftarrow R_2 - 2R_1$, $R_3 \leftarrow R_3 - 3R_1$.` },
            { math: md`\begin{bmatrix} 1 & 2 & 0 & 1 \\ 0 & 0 & 1 & 2 \\ 0 & 0 & 0 & 0 \end{bmatrix}`, note: md`$R_3 \leftarrow R_3 - R_2$, divide $R_2$ by $-2$, then $R_1 \leftarrow R_1 - R_2$. Two pivots, in columns 1 and 3.` },
            { math: md`\operatorname{rank} A = 2`, note: "Two pivot columns." },
            { math: md`\operatorname{Col} A: \left\{ \begin{bmatrix} 1 \\ 2 \\ 3 \end{bmatrix}, \begin{bmatrix} 1 \\ 0 \\ 1 \end{bmatrix} \right\} \qquad \operatorname{Row} A: \left\{ (1, 2, 0, 1),\ (0, 0, 1, 2) \right\}`, note: md`Pivot columns of $A$ for the column space; nonzero rows of the RREF for the row space. Both have two vectors.` },
          ],
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-4, 4],
          field: { dx: "x + 2y", dy: "2x + 4y", density: 11 },
          curves: [
            { expr: "2x", label: "\\operatorname{Col} A", color: 2 },
            { expr: "-x/2", label: "\\operatorname{Nul} A", color: 3, dashed: true },
          ],
          caption: md`At each point $\mathbf{x}$ the arrow shows the output $A\mathbf{x}$ for the rank-1 matrix $A = \begin{bmatrix} 1 & 2 \\ 2 & 4 \end{bmatrix}$. Every arrow is parallel to $(1, 2)$: the whole plane is squashed onto the line $\operatorname{Col} A$. Along the dashed line $\operatorname{Nul} A$ the arrows shrink to nothing. One dimension of input survives, one is destroyed: $1 + 1 = 2$.`,
        },
        {
          kind: "key",
          title: "The rank-nullity theorem",
          body: md`For an $m \times n$ matrix $A$,
$$\operatorname{rank} A + \dim \operatorname{Nul} A = n.$$
The dimension of the null space is also called the **nullity**. In words: the number of columns splits into pivot columns (the rank) and free columns (the nullity).`,
        },
        {
          kind: "proof",
          title: "Rank-nullity",
          given: md`$A$ is $m \times n$`,
          prove: md`$\operatorname{rank} A + \dim \operatorname{Nul} A = n$`,
          steps: [
            { statement: md`$\operatorname{rank} A$ = the number of pivot columns`, reason: "The pivot columns are a basis of Col A" },
            { statement: md`$\dim \operatorname{Nul} A$ = the number of free variables`, reason: "The parametric-form vectors, one per free variable, are a basis of Nul A (last lesson)" },
            { statement: md`Every column is a pivot column or a free column, never both`, reason: "A free variable is one whose column has no pivot" },
            { statement: md`pivot columns + free columns $= n$`, reason: "There are n columns" },
          ],
        },
        {
          kind: "why",
          title: "What rank-nullity says in pictures",
          body: md`Think of $A$ as a machine from $\mathbb{R}^n$ to $\mathbb{R}^m$. The null space is the set of input directions that get flattened to nothing. The column space is the set of output directions that actually get hit. Rank-nullity says dimension is conserved: every input dimension is either destroyed (it lies in $\operatorname{Nul} A$) or survives as an output dimension (it contributes to $\operatorname{Col} A$). Nothing is created and nothing is lost in the count.

A $3 \times 5$ matrix with rank 2 sends five-dimensional space onto a plane in $\mathbb{R}^3$, and $5 - 2 = 3$ dimensions' worth of inputs collapse to the origin. The same theorem applied to $A^T$ (which is $n \times m$ and has the same rank) gives $\dim \operatorname{Nul} A^T = m - \operatorname{rank} A$: here $3 - 2 = 1$.`,
        },
        {
          kind: "text",
          body: md`**Rank and invertibility.** For a square $n \times n$ matrix, these all say the same thing (add them to the invertible matrix theorem from Unit 3):

- $A$ is invertible.
- $\operatorname{rank} A = n$ (a pivot in every column).
- $\operatorname{Nul} A = \{\mathbf{0}\}$ (nullity $0$, by rank-nullity).
- $\operatorname{Col} A = \mathbb{R}^n$ (the $n$ pivot columns are $n$ independent vectors in $\mathbb{R}^n$, hence a basis).
- $\det A \ne 0$.

Two more facts worth keeping. $\operatorname{rank} A^T = \operatorname{rank} A$, which is the row-rank theorem restated. And $\operatorname{rank}(AB) \le \operatorname{rank} A$, because every column of $AB$ is $A$ times something and so lies in $\operatorname{Col} A$; multiplying never creates rank.`,
        },
        {
          kind: "example",
          title: "All four dimensions from one reduction",
          problem: md`The reduced row echelon form of a $4 \times 6$ matrix $A$ has three pivots. Find $\dim \operatorname{Col} A$, $\dim \operatorname{Row} A$, $\dim \operatorname{Nul} A$ and $\dim \operatorname{Nul} A^T$.`,
          steps: [
            { math: md`\dim \operatorname{Col} A = \operatorname{rank} A = 3`, note: "Three pivot columns." },
            { math: md`\dim \operatorname{Row} A = 3`, note: "Row rank equals column rank." },
            { math: md`\dim \operatorname{Nul} A = 6 - 3 = 3`, note: md`Rank-nullity with $n = 6$ columns.` },
            { math: md`\dim \operatorname{Nul} A^T = 4 - 3 = 1`, note: md`$A^T$ is $6 \times 4$ with rank $3$; rank-nullity with $4$ columns.` },
          ],
        },
        {
          kind: "check",
          prompt: md`$A$ is a $5 \times 7$ matrix with rank $4$. Find $\dim \operatorname{Nul} A$.`,
          answer: "3",
          explain: md`Rank-nullity: $4 + \dim \operatorname{Nul} A = 7$, the number of columns. So the nullity is $3$. (The $5$ rows tell you $\dim \operatorname{Nul} A^T = 5 - 4 = 1$.)`,
        },
        {
          kind: "check",
          prompt: md`Find the rank of $\begin{bmatrix} 1 & 2 \\ 3 & 6 \end{bmatrix}$.`,
          answer: "1",
          explain: md`$R_2 \leftarrow R_2 - 3R_1$ gives a zero row, leaving one pivot. Equivalently the second column is twice the first, so the column space is a line.`,
        },
      ],
      practice: [rankOf, rankNullity, fourDims],
    },
    {
      id: slug("Change of basis"),
      title: "Change of basis",
      summary: "The same vector has different coordinates in different bases. The matrix that converts one coordinate vector into another, and why it is a product of two simpler ones.",
      blocks: [
        {
          kind: "text",
          body: md`The arrow from the origin to the point $(4, 3)$ is one object. "$(4, 3)$" is its description in the standard basis: $4\mathbf{e}_1 + 3\mathbf{e}_2$. In the basis $\mathcal{B} = \{(2, 1), (1, 1)\}$ the same arrow is $1(2, 1) + 2(1, 1)$, so $[\mathbf{v}]_{\mathcal{B}} = (1, 2)$. Different numbers, same arrow. This lesson is about converting between descriptions.`,
        },
        {
          kind: "key",
          title: "The matrix of a basis",
          body: md`For a basis $\mathcal{B} = \{\mathbf{b}_1, \dots, \mathbf{b}_n\}$ of $\mathbb{R}^n$, let $P_{\mathcal{B}} = \begin{bmatrix} \mathbf{b}_1 & \cdots & \mathbf{b}_n \end{bmatrix}$, the matrix with the basis vectors as columns. Then
$$\mathbf{v} = P_{\mathcal{B}}\,[\mathbf{v}]_{\mathcal{B}} \qquad \text{and} \qquad [\mathbf{v}]_{\mathcal{B}} = P_{\mathcal{B}}^{-1}\,\mathbf{v}.$$
$P_{\mathcal{B}}$ converts $\mathcal{B}$-coordinates to standard coordinates; its inverse converts back.`,
        },
        {
          kind: "why",
          title: "Why coordinates are a matrix product",
          body: md`$[\mathbf{v}]_{\mathcal{B}} = (c_1, \dots, c_n)$ means $\mathbf{v} = c_1 \mathbf{b}_1 + \dots + c_n \mathbf{b}_n$. The column picture of matrix multiplication says exactly that
$$\begin{bmatrix} \mathbf{b}_1 & \cdots & \mathbf{b}_n \end{bmatrix} \begin{bmatrix} c_1 \\ \vdots \\ c_n \end{bmatrix} = c_1 \mathbf{b}_1 + \dots + c_n \mathbf{b}_n.$$
So $\mathbf{v} = P_{\mathcal{B}}[\mathbf{v}]_{\mathcal{B}}$.

Why is $P_{\mathcal{B}}$ invertible? Its columns are $n$ independent vectors in $\mathbb{R}^n$, so it has $n$ pivots: rank $n$, invertible by the invertible matrix theorem. Multiply both sides by $P_{\mathcal{B}}^{-1}$ to get $[\mathbf{v}]_{\mathcal{B}} = P_{\mathcal{B}}^{-1}\mathbf{v}$. Finding coordinates by row reducing $[P_{\mathcal{B}} \mid \mathbf{v}]$, as in the last lesson, is solving this same equation.`,
        },
        {
          kind: "proof",
          title: "Taking coordinates is linear",
          given: md`$\mathcal{B}$ is a basis of a vector space $V$, and $\mathbf{u}, \mathbf{v} \in V$`,
          prove: md`$[\mathbf{u} + \mathbf{v}]_{\mathcal{B}} = [\mathbf{u}]_{\mathcal{B}} + [\mathbf{v}]_{\mathcal{B}}$ and $[c\mathbf{v}]_{\mathcal{B}} = c[\mathbf{v}]_{\mathcal{B}}$`,
          steps: [
            { statement: md`Write $\mathbf{u} = \sum a_i \mathbf{b}_i$ and $\mathbf{v} = \sum c_i \mathbf{b}_i$, so $[\mathbf{u}]_{\mathcal{B}} = (a_i)$ and $[\mathbf{v}]_{\mathcal{B}} = (c_i)$`, reason: "Definition of coordinates" },
            { statement: md`$\mathbf{u} + \mathbf{v} = \sum (a_i + c_i)\mathbf{b}_i$`, reason: "Vector space axioms: regroup" },
            { statement: md`$[\mathbf{u} + \mathbf{v}]_{\mathcal{B}} = (a_i + c_i) = [\mathbf{u}]_{\mathcal{B}} + [\mathbf{v}]_{\mathcal{B}}$`, reason: "Coordinates are unique, so this is the coordinate vector of the sum" },
            { statement: md`$c\mathbf{v} = \sum (c\,c_i)\mathbf{b}_i$, so $[c\mathbf{v}]_{\mathcal{B}} = (c\,c_i) = c[\mathbf{v}]_{\mathcal{B}}$`, reason: "Distributive law, then uniqueness again" },
          ],
        },
        {
          kind: "text",
          body: md`This is more than bookkeeping. The coordinate map $\mathbf{v} \mapsto [\mathbf{v}]_{\mathcal{B}}$ is linear, one-to-one (unique coordinates) and onto $\mathbb{R}^n$ (every coordinate list is some vector's). So any $n$-dimensional vector space is a relabelled copy of $\mathbb{R}^n$. Questions about polynomials in $P_2$ become questions about vectors in $\mathbb{R}^3$: $\{1, x, x^2\}$ turns $a + bx + cx^2$ into $(a, b, c)$, and independence, spans and dimensions carry over unchanged.`,
        },
        {
          kind: "diagram",
          view: [-4, 6, -3, 6],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", hidden: true },
            { name: "B1", x: 2, y: 1, label: "\\mathbf{b}_1", dir: "se" },
            { name: "B2", x: 1, y: 1, label: "\\mathbf{b}_2", dir: "nw" },
            { name: "P", x: "2(p - q)", y: "p - q", label: "", hidden: true },
            { name: "V", x: "p", y: "q", label: "\\mathbf{v} = ({p}, {q})", dir: "ne" },
          ],
          segments: [
            { from: "O", to: "B1", arrow: true, color: 1 },
            { from: "O", to: "B2", arrow: true, color: 2 },
            { from: "O", to: "P", dashed: true, color: 1, label: "c_1 \\mathbf{b}_1" },
            { from: "P", to: "V", dashed: true, color: 2, label: "c_2 \\mathbf{b}_2" },
            { from: "O", to: "V", arrow: true, color: 4 },
          ],
          params: [
            { name: "p", tex: "v_1", min: -3, max: 5, step: 1, value: 4 },
            { name: "q", tex: "v_2", min: -2, max: 5, step: 1, value: 3 },
          ],
          readouts: [
            { label: "c_1 = v_1 - v_2", value: "p - q" },
            { label: "c_2 = -v_1 + 2v_2", value: "-p + 2q" },
          ],
          caption: md`$\mathcal{B} = \{(2, 1), (1, 1)\}$, so $P_{\mathcal{B}} = \begin{bmatrix} 2 & 1 \\ 1 & 1 \end{bmatrix}$ and $P_{\mathcal{B}}^{-1} = \begin{bmatrix} 1 & -1 \\ -1 & 2 \end{bmatrix}$. Move $\mathbf{v}$ with the sliders; the readouts compute $[\mathbf{v}]_{\mathcal{B}} = P_{\mathcal{B}}^{-1}\mathbf{v}$, and the dashed path shows that $c_1 \mathbf{b}_1 + c_2 \mathbf{b}_2$ really lands on $\mathbf{v}$.`,
        },
        {
          kind: "example",
          title: "Coordinates through the inverse",
          problem: md`Find $[\mathbf{v}]_{\mathcal{B}}$ for $\mathbf{v} = (4, 3)$ and $\mathcal{B} = \{(2, 1), (1, 1)\}$ using $P_{\mathcal{B}}^{-1}$.`,
          steps: [
            { math: md`P_{\mathcal{B}} = \begin{bmatrix} 2 & 1 \\ 1 & 1 \end{bmatrix}, \qquad \det P_{\mathcal{B}} = 2 - 1 = 1`, note: "Basis vectors as columns." },
            { math: md`P_{\mathcal{B}}^{-1} = \frac{1}{1}\begin{bmatrix} 1 & -1 \\ -1 & 2 \end{bmatrix}`, note: md`The $2 \times 2$ inverse formula from Unit 3: swap the diagonal, negate the off-diagonal, divide by the determinant.` },
            { math: md`[\mathbf{v}]_{\mathcal{B}} = \begin{bmatrix} 1 & -1 \\ -1 & 2 \end{bmatrix}\begin{bmatrix} 4 \\ 3 \end{bmatrix} = \begin{bmatrix} 1 \\ 2 \end{bmatrix}`, note: md`Check: $1(2, 1) + 2(1, 1) = (4, 3)$.` },
          ],
        },
        {
          kind: "key",
          title: "Changing between two bases",
          body: md`Let $\mathcal{B}$ and $\mathcal{C}$ be two bases of an $n$-dimensional space. There is a unique $n \times n$ matrix, the **change-of-coordinates matrix** $P_{\mathcal{C} \leftarrow \mathcal{B}}$, with
$$[\mathbf{v}]_{\mathcal{C}} = P_{\mathcal{C} \leftarrow \mathcal{B}}\,[\mathbf{v}]_{\mathcal{B}} \quad \text{for every } \mathbf{v}.$$
Its columns are the $\mathcal{C}$-coordinates of the $\mathcal{B}$ vectors: $P_{\mathcal{C} \leftarrow \mathcal{B}} = \begin{bmatrix} [\mathbf{b}_1]_{\mathcal{C}} & \cdots & [\mathbf{b}_n]_{\mathcal{C}} \end{bmatrix}$. In $\mathbb{R}^n$,
$$P_{\mathcal{C} \leftarrow \mathcal{B}} = P_{\mathcal{C}}^{-1} P_{\mathcal{B}}, \qquad P_{\mathcal{B} \leftarrow \mathcal{C}} = (P_{\mathcal{C} \leftarrow \mathcal{B}})^{-1},$$
and it is found in one go by row reducing $[\,P_{\mathcal{C}} \mid P_{\mathcal{B}}\,]$ to $[\,I \mid P_{\mathcal{C} \leftarrow \mathcal{B}}\,]$.`,
        },
        {
          kind: "why",
          title: "Why the change matrix is a product, and why its columns are what they are",
          body: md`Go through standard coordinates. $\mathbf{v} = P_{\mathcal{B}}[\mathbf{v}]_{\mathcal{B}}$ turns $\mathcal{B}$-coordinates into the actual vector, and $[\mathbf{v}]_{\mathcal{C}} = P_{\mathcal{C}}^{-1}\mathbf{v}$ turns the vector into $\mathcal{C}$-coordinates. Chain them:
$$[\mathbf{v}]_{\mathcal{C}} = P_{\mathcal{C}}^{-1}\mathbf{v} = P_{\mathcal{C}}^{-1}P_{\mathcal{B}}[\mathbf{v}]_{\mathcal{B}}.$$
So $P_{\mathcal{C} \leftarrow \mathcal{B}} = P_{\mathcal{C}}^{-1}P_{\mathcal{B}}$. Composition of maps is multiplication of matrices, as in Unit 3, and reading the subscripts right to left tells the story: start in $\mathcal{B}$, end in $\mathcal{C}$.

The $j$-th column of $P_{\mathcal{C}}^{-1}P_{\mathcal{B}}$ is $P_{\mathcal{C}}^{-1}\mathbf{b}_j$, which is $[\mathbf{b}_j]_{\mathcal{C}}$. That is also what linearity alone gives in any vector space: $\mathbf{v} = \sum c_j \mathbf{b}_j$ implies $[\mathbf{v}]_{\mathcal{C}} = \sum c_j [\mathbf{b}_j]_{\mathcal{C}}$, a combination of the columns $[\mathbf{b}_j]_{\mathcal{C}}$ with weights from $[\mathbf{v}]_{\mathcal{B}}$.

Row reducing $[\,P_{\mathcal{C}} \mid P_{\mathcal{B}}\,]$ solves $P_{\mathcal{C}}\mathbf{x} = \mathbf{b}_j$ for every $j$ at once; that is Gauss-Jordan computing $P_{\mathcal{C}}^{-1}P_{\mathcal{B}}$, just as $[A \mid I]$ computes $A^{-1}I$.`,
        },
        {
          kind: "example",
          title: "A change-of-coordinates matrix",
          problem: md`$\mathcal{B} = \{(2, 1), (1, 1)\}$ and $\mathcal{C} = \{(1, 0), (1, 1)\}$. Find $P_{\mathcal{C} \leftarrow \mathcal{B}}$, and use it to convert $[\mathbf{v}]_{\mathcal{B}} = (1, 2)$ to $\mathcal{C}$-coordinates.`,
          steps: [
            { math: md`[\,P_{\mathcal{C}} \mid P_{\mathcal{B}}\,] = \left[\begin{array}{cc|cc} 1 & 1 & 2 & 1 \\ 0 & 1 & 1 & 1 \end{array}\right]`, note: md`$\mathcal{C}$ vectors on the left, $\mathcal{B}$ vectors on the right.` },
            { math: md`\left[\begin{array}{cc|cc} 1 & 0 & 1 & 0 \\ 0 & 1 & 1 & 1 \end{array}\right]`, note: md`$R_1 \leftarrow R_1 - R_2$. The left block is $I$.` },
            { math: md`P_{\mathcal{C} \leftarrow \mathcal{B}} = \begin{bmatrix} 1 & 0 \\ 1 & 1 \end{bmatrix}`, note: md`Check the first column: $[\mathbf{b}_1]_{\mathcal{C}} = (1, 1)$ because $(2, 1) = 1(1, 0) + 1(1, 1)$. The second: $(1, 1) = 0(1, 0) + 1(1, 1)$.` },
            { math: md`[\mathbf{v}]_{\mathcal{C}} = \begin{bmatrix} 1 & 0 \\ 1 & 1 \end{bmatrix}\begin{bmatrix} 1 \\ 2 \end{bmatrix} = \begin{bmatrix} 1 \\ 3 \end{bmatrix}`, note: md`Check: $\mathbf{v} = 1(2, 1) + 2(1, 1) = (4, 3)$ and $1(1, 0) + 3(1, 1) = (4, 3)$. Same arrow.` },
          ],
        },
        {
          kind: "text",
          body: md`**Other spaces.** The same ideas work wherever there is a basis. In $P_2$ the standard basis $\{1, x, x^2\}$ gives $[a + bx + cx^2] = (a, b, c)$, the coefficients. The basis $\{1,\ x - 2,\ (x - 2)^2\}$ gives coordinates that describe the polynomial near $x = 2$ instead of near $0$. To find them, expand and match coefficients, working down from the highest power.`,
        },
        {
          kind: "example",
          title: "Polynomial coordinates in a shifted basis",
          problem: md`Find the coordinates of $p(x) = x^2 + x + 1$ relative to $\mathcal{B} = \{1,\ x - 2,\ (x - 2)^2\}$.`,
          steps: [
            { math: md`a + b(x - 2) + c(x - 2)^2 = c\,x^2 + (b - 4c)x + (a - 2b + 4c)`, note: md`Expand $(x - 2)^2 = x^2 - 4x + 4$ and collect.` },
            { math: md`c = 1`, note: md`Match $x^2$.` },
            { math: md`b - 4(1) = 1 \;\Rightarrow\; b = 5`, note: md`Match $x$.` },
            { math: md`a - 2(5) + 4(1) = 1 \;\Rightarrow\; a = 7`, note: "Match the constants." },
            { math: md`[p]_{\mathcal{B}} = (7, 5, 1), \qquad p(x) = 7 + 5(x - 2) + (x - 2)^2`, note: md`Check at $x = 2$: $p(2) = 7$, and the first coordinate is $7$. (Readers who have met Taylor polynomials will recognise $p(2)$, $p'(2)$ and $p''(2)/2$.)` },
          ],
        },
        {
          kind: "text",
          body: md`**Why change basis at all?** Because some problems are simple in the right coordinates. A matrix that stretches the plane along two slanted directions looks messy in standard coordinates and is diagonal in a basis made of those directions. Unit 7 will write such a matrix as $A = PDP^{-1}$: convert to the good basis ($P^{-1}$), stretch ($D$), convert back ($P$). That sandwich is a change of basis, and everything in this lesson is the groundwork for it.`,
        },
        {
          kind: "check",
          prompt: md`$\mathcal{B} = \{(1, 2), (1, 3)\}$. Find $[\mathbf{v}]_{\mathcal{B}}$ for $\mathbf{v} = (3, 8)$, typed like (1, 2).`,
          answer: "(1, 2)",
          form: "tuple",
          explain: md`Solve $c_1 + c_2 = 3$, $2c_1 + 3c_2 = 8$. Subtract twice the first from the second: $c_2 = 2$, then $c_1 = 1$. Check: $1(1, 2) + 2(1, 3) = (3, 8)$.`,
        },
        {
          kind: "check",
          prompt: md`$P_{\mathcal{C} \leftarrow \mathcal{B}} = \begin{bmatrix} 2 & 1 \\ 1 & 1 \end{bmatrix}$ and $[\mathbf{v}]_{\mathcal{B}} = (1, 3)$. Find $[\mathbf{v}]_{\mathcal{C}}$, typed like (1, 2).`,
          answer: "(5, 4)",
          form: "tuple",
          explain: md`$[\mathbf{v}]_{\mathcal{C}} = P_{\mathcal{C} \leftarrow \mathcal{B}}[\mathbf{v}]_{\mathcal{B}} = (2 \cdot 1 + 1 \cdot 3,\ 1 \cdot 1 + 1 \cdot 3) = (5, 4)$.`,
        },
      ],
      practice: [changeMatrix, convertCoords, polyCoords],
    },
  ],
};
