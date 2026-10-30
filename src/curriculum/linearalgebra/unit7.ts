import { frac, fracTex, paren, poly, signed } from "../../math/random";
import type { Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

type Mat = number[][];

/** A matrix in LaTeX. */
const matTex = (rows: (number | string)[][]) => `\\begin{bmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{bmatrix}`;
/** A determinant in bars. */
const vmatTex = (rows: (number | string)[][]) => `\\begin{vmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{vmatrix}`;
/** A column vector in LaTeX. */
const vecTex = (v: (number | string)[]) => matTex(v.map((x) => [x]));
/** Answer text for a matrix: [[1, 2], [3, 4]]. */
const matAns = (rows: (number | string)[][]) => `[${rows.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
const mul = (A: Mat, B: Mat): Mat => A.map((row) => B[0]!.map((_, j) => row.reduce((s, v, k) => s + v * B[k]![j]!, 0)));
const mulVec = (A: Mat, v: number[]) => A.map((row) => row.reduce((s, x, k) => s + x * v[k]!, 0));
const trace = (A: Mat) => A.reduce((s, row, i) => s + row[i]!, 0);
const det2 = (A: Mat) => A[0]![0]! * A[1]![1]! - A[0]![1]! * A[1]![0]!;
function det3(M: Mat): number {
  const [a, b, c] = M[0] as [number, number, number];
  const [d, e, f] = M[1] as [number, number, number];
  const [g, h, i] = M[2] as [number, number, number];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}
/** The sum of the principal 2×2 minors of a 3×3 matrix: the λ coefficient of its characteristic polynomial. */
function minors3(M: Mat): number {
  const m = (i: number, j: number) => M[i]![i]! * M[j]![j]! - M[i]![j]! * M[j]![i]!;
  return m(0, 1) + m(0, 2) + m(1, 2);
}
/** "x^2 - 7x + 10" from high-degree-first coefficients, in any variable (LaTeX or typed). */
function polyIn(c: number[], v: string): string {
  const n = c.length - 1;
  return poly(c.map((k, i) => [k, n - i === 0 ? "" : n - i === 1 ? v : `${v}^${n - i}`] as [number, string]));
}
/** "(λ - 3)(λ + 2)" as LaTeX. */
const factorsTex = (roots: number[], v = "\\lambda") => roots.map((l) => `(${v} ${signed(-l)})`).join("");
/** The characteristic polynomial of a 2×2 matrix as "x^2 - (7) x + (10) = 0", for verify equations. */
const charEq2 = (A: Mat) => `x^2 - (${trace(A)}) x + (${det2(A)}) = 0`;
/** The characteristic polynomial of a 3×3 matrix as a verify equation. */
const charEq3 = (M: Mat) => `-x^3 + (${trace(M)}) x^2 - (${minors3(M)}) x + (${det3(M)}) = 0`;
/** A number multiplied out in front of a vector: "5", "-1", or "" for 1. */
const scal = (k: number) => (k === 1 ? "" : k === -1 ? "-" : String(k));
/** "3(2) + (-1)(4)" for a dot product shown as arithmetic. */
const dotTex = (row: number[], v: number[]) => row.map((a, i) => `${paren(a)}(${v[i]})`).join(" + ");

/**
 * The 2×2 matrix with eigenvectors (p, 1) and (q, 1) and eigenvalues l1, l2.
 * A = P D P⁻¹ with P = [[p, q], [1, 1]]; integer exactly when (p - q) divides (l1 - l2).
 */
function fromEigen(p: number, q: number, l1: number, l2: number): Mat | null {
  const s = p - q;
  if ((l1 - l2) % s !== 0) return null;
  const k = (l1 - l2) / s;
  const a = (p * l1 - q * l2) / s;
  const d = (p * l2 - q * l1) / s;
  if (!Number.isInteger(a) || !Number.isInteger(d)) return null;
  return [
    [a, -p * q * k],
    [k, d],
  ];
}

interface EigenData {
  A: Mat;
  /** Eigenvectors (p, 1) and (q, 1). */
  p: number;
  q: number;
  l1: number;
  l2: number;
}

/** Random eigen data with small integer entries and distinct integer eigenvalues. */
function eigenData(r: Rng, { unimodular = false, maxEntry = 9, maxEig = 6 } = {}): EigenData {
  for (let tries = 0; tries < 500; tries++) {
    const s = (unimodular ? 1 : r.pick([1, 1, 2, 3])) * r.sign();
    const p = r.nonzero(-3, 3);
    const q = p - s;
    if (q === 0) continue;
    const l2 = r.int(-3, 5);
    const k = r.nonzero(-3, 3);
    const l1 = l2 + k * s;
    if (Math.abs(l1) > maxEig || Math.abs(l2) > maxEig) continue;
    const A = fromEigen(p, q, l1, l2);
    if (!A || A.flat().some((v) => Math.abs(v) > maxEntry)) continue;
    return { A, p, q, l1, l2 };
  }
  return { A: [[3, 2], [1, 4]], p: 1, q: -2, l1: 5, l2: 2 };
}

/** The steps that find the eigenvalues of a 2×2 matrix from its characteristic polynomial. */
function eigenvalueSteps(A: Mat, l1: number, l2: number): Step[] {
  const [[a, b], [c, d]] = A as [[number, number], [number, number]];
  const t = trace(A);
  const D = det2(A);
  return [
    {
      math: md`\det(A - \lambda I) = ${vmatTex([[`${a} - \\lambda`, b], [c, `${d} - \\lambda`]])}`,
      note: md`Subtract $\lambda$ from each diagonal entry. The eigenvalues are the $\lambda$ that make this determinant $0$.`,
    },
    {
      math: md`(${a} - \lambda)(${d} - \lambda) - (${b})(${c}) = ${polyIn([1, -t, D], "\\lambda")}`,
      note: md`Expand. The $\lambda$ coefficient is minus the trace, $${a} + ${paren(d)} = ${t}$, and the constant is the determinant, $${a * d} - ${paren(b * c)} = ${D}$.`,
    },
    {
      math: md`${factorsTex([l1, l2])} = 0`,
      note: md`Two numbers with sum $${t}$ and product $${D}$: $${l1}$ and $${l2}$.`,
    },
    { math: md`\lambda = ${l1} \text{ or } \lambda = ${l2}`, note: "" },
  ];
}

/** The steps that find the eigenvector (x, 1) for a known eigenvalue of a 2×2 matrix. */
function eigenvectorSteps(A: Mat, l: number, x: string): Step[] {
  const [[a, b], [c, d]] = A as [[number, number], [number, number]];
  const B: Mat = [
    [a - l, b],
    [c, d - l],
  ];
  return [
    { math: md`A - ${paren(l)} I = ${matTex(B)}`, note: md`Subtract $${l}$ from the diagonal. We need the null space of this matrix.` },
    {
      math: md`${polyIn([B[0]![0]!, 0], "x")} ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}y = 0`,
      note: md`Row 1 of $(A - ${paren(l)} I)\mathbf{v} = \mathbf{0}$. Row 2 says the same thing, as it must: the matrix is singular.`,
    },
    { math: md`y = 1 \implies x = ${x}`, note: md`Set the second component to $1$ and solve for the first.` },
    {
      math: md`A ${vecTex([x, 1])} = ${vecTex([`${a}(${x}) ${signed(b)}`, `${c}(${x}) ${signed(d)}`])} = ${l} ${vecTex([x, 1])}`,
      note: md`Check by multiplying: the result is $${l}$ times the vector.`,
    },
  ];
}

// ── Lesson 1 generators ─────────────────────────────────────────────────────

/** Given an eigenvector of A, find its eigenvalue. */
const findEigenvalue: Generator = (r) => {
  const { A, p, q, l1, l2 } = eigenData(r);
  const first = r.next() < 0.5;
  const [x, l] = first ? [p, l1] : [q, l2];
  const s = r.pick([1, 1, 2, 3]);
  const v = [s * x, s];
  const Av = mulVec(A, v);
  const [[a, b], [c, d]] = A as [[number, number], [number, number]];
  return {
    prompt: md`The vector $\mathbf{v} = ${vecTex(v)}$ is an eigenvector of $A = ${matTex(A)}$. Find its eigenvalue $\lambda$. Type the number.`,
    answer: String(l),
    verify: [`${a} (${v[0]}) + ${b} (${v[1]}) = l (${v[0]})`, `${c} (${v[0]}) + ${d} (${v[1]}) = l (${v[1]})`],
    hint: md`Compute $A\mathbf{v}$. It must be a multiple of $\mathbf{v}$; the multiplier is $\lambda$.`,
    solution: [
      {
        math: md`A\mathbf{v} = ${vecTex([dotTex([a, b], v), dotTex([c, d], v)])} = ${vecTex(Av)}`,
        note: "Multiply row by column, as in Unit 3.",
      },
      {
        math: md`${vecTex(Av)} = ${scal(l)}${vecTex(v)}`,
        note: md`Each component of $A\mathbf{v}$ is $${l}$ times the matching component of $\mathbf{v}$: $${Av[0]} = ${l} \cdot ${paren(v[0]!)}$ and $${Av[1]} = ${l} \cdot ${v[1]}$.`,
      },
      { math: md`\lambda = ${l}`, note: md`So $A\mathbf{v} = ${l}\mathbf{v}$.` },
    ],
  };
};

/** Given an eigenvalue of A, find the eigenvector with second component 1. */
const findEigenvector: Generator = (r) => {
  const { A, p, q, l1, l2 } = eigenData(r);
  const first = r.next() < 0.5;
  const [x, l] = first ? [p, l1] : [q, l2];
  const [[a, b], [c, d]] = A as [[number, number], [number, number]];
  return {
    prompt: md`$\lambda = ${l}$ is an eigenvalue of $A = ${matTex(A)}$. Find the eigenvector with second component $1$. Type it as a vector, like (3, 1).`,
    answer: `(${x}, 1)`,
    form: "tuple",
    verify: [`${a} x + ${b} y = ${l} x`, `${c} x + ${d} y = ${l} y`],
    hint: md`Eigenvectors for $\lambda$ are the nonzero solutions of $(A - ${paren(l)} I)\mathbf{v} = \mathbf{0}$. Subtract $${l}$ from the diagonal, then read off the relation between $x$ and $y$ from the first row.`,
    solution: eigenvectorSteps(A, l, String(x)),
  };
};

/** Eigenvalues of a triangular matrix. */
const triangularEigenvalues: Generator = (r) => {
  const n = r.next() < 0.5 ? 2 : 3;
  const diag: number[] = [];
  while (diag.length < n) {
    const v = r.int(-5, 7);
    if (!diag.includes(v)) diag.push(v);
  }
  const upper = r.next() < 0.5;
  const M: Mat = diag.map((v, i) => diag.map((_, j) => (i === j ? v : (upper ? j > i : j < i) ? r.int(-4, 4) : 0)));
  const shape = upper ? "upper" : "lower";
  const lam = (i: number) => `${diag[i]} - \\lambda`;
  const B = M.map((row, i) => row.map((v, j) => (i === j ? lam(i) : v)));
  return {
    prompt: md`Find all the eigenvalues of the ${shape} triangular matrix $A = ${matTex(M)}$. Type them as a comma-separated list, like 2, 5.`,
    answer: diag.join(", "),
    form: "set",
    verify: [n === 2 ? charEq2(M) : charEq3(M)],
    hint: md`$A - \lambda I$ is still triangular. The determinant of a triangular matrix is the product of its diagonal entries (Unit 4).`,
    solution: [
      { math: md`A - \lambda I = ${matTex(B)}`, note: md`Subtracting $\lambda I$ only changes the diagonal, so the result is still ${shape} triangular.` },
      {
        math: md`\det(A - \lambda I) = ${diag.map((v) => `(${v} - \\lambda)`).join("")}`,
        note: "The determinant of a triangular matrix is the product of the diagonal entries.",
      },
      {
        math: md`\lambda = ${diag.join(", \\; ")}`,
        note: md`The product is $0$ exactly when one factor is $0$. The eigenvalues of a triangular matrix are its diagonal entries.`,
      },
    ],
  };
};

// ── Lesson 2 generators ─────────────────────────────────────────────────────

/** The characteristic polynomial of a 2×2 matrix, expanded in x. */
const characteristicPolynomial: Generator = (r) => {
  const [a, d] = [r.int(-4, 6), r.int(-4, 6)];
  const [b, c] = [r.int(-4, 5), r.int(-4, 5)];
  const A: Mat = [
    [a, b],
    [c, d],
  ];
  const t = trace(A);
  const D = det2(A);
  return {
    prompt: md`Find the characteristic polynomial $\det(A - \lambda I)$ of $A = ${matTex(A)}$. Type it as an expanded polynomial in $x$ (write $x$ for $\lambda$), like x^2 - 3x + 2.`,
    answer: polyIn([1, -t, D], "x"),
    expanded: true,
    verify: [`p = (${a} - x)(${d} - x) - (${b * c})`],
    hint: md`$\det(A - \lambda I) = (${a} - \lambda)(${d} - \lambda) - ${paren(b)}${paren(c)}$. Expand and collect. The result should be $\lambda^2 - (\text{trace})\lambda + \det A$.`,
    solution: [
      {
        math: md`A - \lambda I = ${matTex([[`${a} - \\lambda`, b], [c, `${d} - \\lambda`]])}`,
        note: md`Subtract $\lambda$ from the diagonal entries only.`,
      },
      {
        math: md`\det(A - \lambda I) = (${a} - \lambda)(${d} - \lambda) - ${paren(b)}${paren(c)}`,
        note: md`The 2×2 determinant: diagonal product minus off-diagonal product.`,
      },
      {
        math: md`= \lambda^2 ${signed(-a)}\lambda ${signed(-d)}\lambda + ${paren(a * d)} - ${paren(b * c)}`.replace(/\+ -/g, "- "),
        note: md`Multiply out $(${a} - \lambda)(${d} - \lambda)$.`,
      },
      {
        math: polyIn([1, -t, D], "\\lambda"),
        note: md`Collect: the $\lambda$ coefficient is $-(${a} + ${paren(d)}) = ${-t}$, minus the trace, and the constant is $${a * d} - ${paren(b * c)} = ${D}$, the determinant.`,
      },
    ],
  };
};

/** Eigenvalues of a 2×2 or a 3×3 with an easy row or column. */
const findEigenvalues: Generator = (r) => {
  const { A, l1, l2 } = eigenData(r);
  if (r.next() < 0.55) {
    return {
      prompt: md`Find the eigenvalues of $A = ${matTex(A)}$. Type them as a comma-separated list, like 2, 5.`,
      answer: `${l1}, ${l2}`,
      form: "set",
      verify: [charEq2(A)],
      hint: md`Solve $\det(A - \lambda I) = 0$. For a 2×2 matrix that is $\lambda^2 - (\operatorname{tr} A)\lambda + \det A = 0$.`,
      solution: eigenvalueSteps(A, l1, l2),
    };
  }
  // A 3×3 whose first or last row or column is zero off the diagonal, so one cofactor expansion does the work.
  let a = r.int(-4, 6);
  while (a === l1 || a === l2) a = r.int(-4, 6);
  const [u, w] = [r.int(-3, 3), r.int(-3, 3)];
  const [[p, q], [s, t]] = A as [[number, number], [number, number]];
  const kind = r.int(0, 3);
  const M: Mat =
    kind === 0
      ? [
          [a, 0, 0],
          [u, p, q],
          [w, s, t],
        ]
      : kind === 1
        ? [
            [a, u, w],
            [0, p, q],
            [0, s, t],
          ]
        : kind === 2
          ? [
              [p, q, u],
              [s, t, w],
              [0, 0, a],
            ]
          : [
              [p, q, 0],
              [s, t, 0],
              [u, w, a],
            ];
  const line = kind === 0 ? "the first row" : kind === 1 ? "the first column" : kind === 2 ? "the last row" : "the last column";
  const B = M.map((row, i) => row.map((v, j) => (i === j ? `${v} - \\lambda` : v)));
  const block = vmatTex([[`${p} - \\lambda`, q], [s, `${t} - \\lambda`]]);
  const all = [a, l1, l2].sort((x, y) => x - y);
  return {
    prompt: md`Find the eigenvalues of $A = ${matTex(M)}$. Type them as a comma-separated list, like 1, 2, 5.`,
    answer: all.join(", "),
    form: "set",
    verify: [charEq3(M)],
    hint: md`Look at ${line}: it has only one nonzero entry in $A - \lambda I$. Expand the determinant along it (Unit 4) and you are left with a 2×2 problem.`,
    solution: [
      { math: md`\det(A - \lambda I) = ${vmatTex(B)}`, note: md`Subtract $\lambda$ from the diagonal.` },
      {
        math: md`= (${a} - \lambda) \cdot ${block}`,
        note: md`Expand along ${line}. Its only nonzero entry is $${a} - \lambda$, in a diagonal position, so its sign is $+$ and its minor is the 2×2 block that remains.`,
      },
      {
        math: md`= (${a} - \lambda)\left(${polyIn([1, -(p + t), p * t - q * s], "\\lambda")}\right) = (${a} - \lambda)${factorsTex([l1, l2])}`,
        note: md`The 2×2 determinant is $\lambda^2 - (\text{trace})\lambda + \det$, with trace $${p + t}$ and determinant $${p * t - q * s}$. Factor it.`,
      },
      { math: md`\lambda = ${all.join(", \\; ")}`, note: "Three factors, three eigenvalues." },
    ],
  };
};

/** Find a missing entry so that a given number is an eigenvalue. */
const missingEntry: Generator = (r) => {
  for (;;) {
    const l = r.int(-3, 5);
    const e = r.nonzero(-3, 3);
    const a = l + e;
    const [b, c] = [r.nonzero(-6, 6), r.nonzero(-6, 6)];
    if ((b * c) % e !== 0) continue;
    const k = l + (b * c) / e;
    if (Math.abs(k) > 12) continue;
    return {
      prompt: md`Find the number $k$ so that $\lambda = ${l}$ is an eigenvalue of $A = ${matTex([[a, b], [c, "k"]])}$.`,
      answer: String(k),
      verify: [`(${a} - ${paren(l)})(k - ${paren(l)}) - (${b * c}) = 0`],
      hint: md`$${l}$ is an eigenvalue exactly when $\det(A - ${paren(l)} I) = 0$. Write that determinant in terms of $k$ and solve.`,
      solution: [
        {
          math: md`A - ${paren(l)} I = ${matTex([[e, b], [c, `k ${signed(-l)}`]])}`,
          note: md`Subtract $${l}$ from both diagonal entries.`,
        },
        {
          math: md`\det(A - ${paren(l)} I) = ${e}(k ${signed(-l)}) - ${paren(b)}${paren(c)} = 0`,
          note: md`$${l}$ is an eigenvalue exactly when this matrix is singular, that is, when its determinant is $0$.`,
        },
        {
          math: md`${e}(k ${signed(-l)}) = ${b * c} \implies k ${signed(-l)} = ${(b * c) / e}`,
          note: md`Move the product across and divide by $${e}$.`,
        },
        { math: md`k = ${k}`, note: md`Check: with $k = ${k}$ the trace is $${a + k}$ and the determinant is $${a * k - b * c}$, and $${paren(l)}^2 - ${paren(a + k)} \cdot ${paren(l)} + ${paren(a * k - b * c)} = 0$.` },
      ],
    };
  }
};

// ── Lesson 3 generators ─────────────────────────────────────────────────────

/** The 2×2 inverse of an integer matrix with determinant ±1, as integers. */
function inverseUnimodular(P: Mat): Mat {
  const [[p, q], [u, v]] = P as [[number, number], [number, number]];
  const s = p * v - q * u;
  return [
    [v / s, -q / s],
    [-u / s, p / s],
  ];
}

/** Given A and the eigenvector matrix P, find D. */
const findDiagonal: Generator = (r) => {
  const { A, p, q, l1, l2 } = eigenData(r);
  const swap = r.next() < 0.5;
  const cols = swap ? [[q, l2], [p, l1]] : [[p, l1], [q, l2]];
  const P: Mat = [
    [cols[0]![0]!, cols[1]![0]!],
    [1, 1],
  ];
  const D: Mat = [
    [cols[0]![1]!, 0],
    [0, cols[1]![1]!],
  ];
  const v1 = [P[0]![0]!, 1];
  const v2 = [P[0]![1]!, 1];
  const [Av1, Av2] = [mulVec(A, v1), mulVec(A, v2)];
  return {
    prompt: md`The columns of $P = ${matTex(P)}$ are eigenvectors of $A = ${matTex(A)}$. Find the diagonal matrix $D$ with $A = PDP^{-1}$. Type it row by row, like [[2, 0], [0, 5]].`,
    answer: matAns(D),
    form: "matrix",
    hint: md`$AP = PD$, so $D$ holds the eigenvalues in the same order as the columns of $P$. Multiply $A$ by each column and read off its stretch factor.`,
    solution: [
      {
        math: md`A ${vecTex(v1)} = ${vecTex(Av1)} = ${scal(D[0]![0]!)} ${vecTex(v1)}`,
        note: md`The first column of $P$ is stretched by $${D[0]![0]}$, so that is the first eigenvalue.`,
      },
      {
        math: md`A ${vecTex(v2)} = ${vecTex(Av2)} = ${scal(D[1]![1]!)} ${vecTex(v2)}`,
        note: md`The second column is stretched by $${D[1]![1]}$.`,
      },
      {
        math: md`D = ${matTex(D)}`,
        note: md`$AP = \begin{bmatrix} A\mathbf{v}_1 & A\mathbf{v}_2 \end{bmatrix} = \begin{bmatrix} ${D[0]![0]}\mathbf{v}_1 & ${D[1]![1]}\mathbf{v}_2 \end{bmatrix} = PD$. The order in $D$ must match the order of the columns of $P$.`,
      },
    ],
  };
};

/** Compute a power of A by diagonalizing. */
const matrixPower: Generator = (r) => {
  for (;;) {
    const { A, p, q, l1, l2 } = eigenData(r, { unimodular: true, maxEntry: 8, maxEig: 3 });
    const k = r.int(3, 5);
    const big = Math.max(Math.abs(l1), Math.abs(l2));
    // Eigenvalues of 0 and ±1 only make the power trivial; keep at least one that really grows.
    if (big < 2 || big ** k > 250) continue;
    const P: Mat = [
      [p, q],
      [1, 1],
    ];
    const D: Mat = [
      [l1, 0],
      [0, l2],
    ];
    const Pi = inverseUnimodular(P);
    const Dk: Mat = [
      [l1 ** k, 0],
      [0, l2 ** k],
    ];
    const PDk = mul(P, Dk);
    const Ak = mul(PDk, Pi);
    if (Ak.flat().some((v) => Math.abs(v) > 999)) continue;
    const given = r.next() < 0.5;
    const finish: Step[] = [
      { math: md`D^{${k}} = ${matTex(Dk)}`, note: md`A diagonal matrix is raised to a power entry by entry: $${paren(l1)}^{${k}} = ${l1 ** k}$ and $${paren(l2)}^{${k}} = ${l2 ** k}$.` },
      {
        math: md`P^{-1} = ${det2(P) === 1 ? "" : "-"}${matTex([[P[1]![1]!, -P[0]![1]!], [-P[1]![0]!, P[0]![0]!]])} = ${matTex(Pi)}`,
        note: md`The 2×2 inverse formula from Unit 3: swap the diagonal, negate the off-diagonal, divide by the determinant $${det2(P)}$.`,
      },
      { math: md`PD^{${k}} = ${matTex(PDk)}`, note: md`Multiplying by a diagonal matrix on the right scales the columns of $P$: column 1 by $${l1 ** k}$, column 2 by $${l2 ** k}$.` },
      { math: md`A^{${k}} = PD^{${k}}P^{-1} = ${matTex(PDk)}${matTex(Pi)} = ${matTex(Ak)}`, note: md`One ordinary matrix product finishes it. The $P^{-1}P$ pairs in the middle of $PDP^{-1}PDP^{-1}\cdots$ all cancel, which is why only one $P$ and one $P^{-1}$ survive.` },
    ];
    if (given) {
      return {
        prompt: md`$A = ${matTex(A)}$ can be written $A = PDP^{-1}$ with $P = ${matTex(P)}$ and $D = ${matTex(D)}$. Compute $A^{${k}}$. Type it row by row, like [[1, 2], [3, 4]].`,
        answer: matAns(Ak),
        form: "matrix",
        hint: md`$A^{${k}} = PD^{${k}}P^{-1}$. Raise the diagonal entries to the power $${k}$, find $P^{-1}$ with the 2×2 formula, then multiply.`,
        solution: finish,
      };
    }
    return {
      prompt: md`Let $A = ${matTex(A)}$. Compute $A^{${k}}$ by diagonalizing $A$. Type it row by row, like [[1, 2], [3, 4]].`,
      answer: matAns(Ak),
      form: "matrix",
      hint: md`Find the eigenvalues from $\lambda^2 - (\operatorname{tr} A)\lambda + \det A = 0$, an eigenvector for each, then $A^{${k}} = PD^{${k}}P^{-1}$.`,
      solution: [
        ...eigenvalueSteps(A, l1, l2),
        {
          math: md`\lambda = ${l1}: \; ${vecTex([p, 1])}, \qquad \lambda = ${l2}: \; ${vecTex([q, 1])}`,
          note: md`For each eigenvalue, solve $(A - \lambda I)\mathbf{v} = \mathbf{0}$ with second component $1$: row 1 gives $(${A[0]![0]} - \lambda)x + ${paren(A[0]![1]!)} = 0$.`,
        },
        { math: md`P = ${matTex(P)}, \qquad D = ${matTex(D)}`, note: "Eigenvectors in the columns of P, eigenvalues in the same order along D." },
        ...finish,
      ],
    };
  }
};

/** Eigenvalues of A^k. */
const powerEigenvalues: Generator = (r) => {
  for (;;) {
    const { A, l1, l2 } = eigenData(r, { maxEig: 4 });
    if (Math.abs(l1) === Math.abs(l2)) continue;
    const k = r.int(2, 6);
    if (Math.max(Math.abs(l1), Math.abs(l2)) ** k > 1000) continue;
    let Ak: Mat = [
      [1, 0],
      [0, 1],
    ];
    for (let i = 0; i < k; i++) Ak = mul(Ak, A);
    const ans = [l1 ** k, l2 ** k];
    return {
      prompt: md`Let $A = ${matTex(A)}$. Find the eigenvalues of $A^{${k}}$ without computing the power. Type them as a comma-separated list, like 8, 27.`,
      answer: ans.join(", "),
      form: "set",
      // The characteristic polynomial of A^k itself, from the multiplied-out matrix.
      verify: [charEq2(Ak)],
      hint: md`If $A\mathbf{v} = \lambda\mathbf{v}$, then $A^2\mathbf{v} = A(\lambda\mathbf{v}) = \lambda A\mathbf{v} = \lambda^2\mathbf{v}$, and so on. The eigenvalues of $A^{${k}}$ are the eigenvalues of $A$ raised to the power $${k}$.`,
      solution: [
        ...eigenvalueSteps(A, l1, l2),
        {
          math: md`A^{${k}}\mathbf{v} = \lambda^{${k}}\mathbf{v}`,
          note: md`Apply $A$ repeatedly to an eigenvector: each application multiplies it by $\lambda$ again, and the eigenvector itself never changes direction.`,
        },
        {
          math: md`${l1}^{${k}} = ${ans[0]}, \qquad ${paren(l2)}^{${k}} = ${ans[1]}`,
          note: md`Same eigenvectors, eigenvalues raised to the power $${k}$. (In the language of this lesson: $A^{${k}} = PD^{${k}}P^{-1}$, and $D^{${k}}$ holds these two numbers.)`,
        },
      ],
    };
  }
};

// ── Lesson 4 generators ─────────────────────────────────────────────────────

interface SymData {
  A: Mat;
  /** Eigenvalues, larger first. */
  hi: number;
  lo: number;
  /** Half the difference of the diagonal entries, and the off-diagonal entry; m² + b² = r². */
  m: number;
  b: number;
  rad: number;
}

/** A symmetric 2×2 matrix with distinct integer eigenvalues: a - d = 2m with (m, b, r) a Pythagorean triple or m = 0. */
function symData(r: Rng): SymData {
  const triple = r.pick([
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [3, 4],
    [3, 4],
    [4, 3],
    [4, 3],
  ] as const);
  const m = triple[0] * (r.next() < 0.5 ? 1 : -1);
  const b = triple[1] * r.sign();
  const rad = Math.hypot(m, b);
  const d = r.int(-3, 5);
  const a = d + 2 * m;
  const mid = (a + d) / 2;
  return { A: [[a, b], [b, d]], hi: mid + rad, lo: mid - rad, m, b, rad };
}

/** Eigenvalues of a symmetric matrix. */
const symmetricEigenvalues: Generator = (r) => {
  const { A, hi, lo } = symData(r);
  return {
    prompt: md`Find the eigenvalues of the symmetric matrix $A = ${matTex(A)}$. Type them as a comma-separated list, like 1, 5.`,
    answer: `${lo}, ${hi}`,
    form: "set",
    verify: [charEq2(A)],
    hint: md`$\lambda^2 - (\operatorname{tr} A)\lambda + \det A = 0$. For a symmetric matrix the discriminant is $(a - d)^2 + 4b^2$, never negative, so both roots are real.`,
    solution: [
      ...eigenvalueSteps(A, lo, hi).slice(0, 2),
      {
        math: md`\lambda = \frac{${trace(A)} \pm \sqrt{${trace(A)}^2 - 4 \cdot ${paren(det2(A))}}}{2} = \frac{${trace(A)} \pm \sqrt{${trace(A) ** 2 - 4 * det2(A)}}}{2} = \frac{${trace(A)} \pm ${2 * Math.hypot(A[0]![0]! - A[1]![1]!, 2 * A[0]![1]!) / 2}}{2}`,
        note: md`The quadratic formula. The discriminant is $(${A[0]![0]} - ${paren(A[1]![1]!)})^2 + 4 \cdot ${paren(A[0]![1]!)}^2 = ${(A[0]![0]! - A[1]![1]!) ** 2} + ${4 * A[0]![1]! ** 2}$, a perfect square here.`,
      },
      { math: md`\lambda = ${lo} \text{ or } \lambda = ${hi}`, note: md`Check: sum $${lo + hi}$ is the trace and product $${lo * hi}$ is the determinant.` },
    ],
  };
};

/** An eigenvector of a symmetric matrix, second component 1; it is perpendicular to the other one. */
const symmetricEigenvector: Generator = (r) => {
  const { A, hi, lo, b } = symData(r);
  const useHi = r.next() < 0.5;
  const l = useHi ? hi : lo;
  const other = useHi ? lo : hi;
  const [a] = A[0] as [number, number];
  // (a - l) x + b = 0
  const xn = -b;
  const xd = a - l;
  const x = frac(xn, xd);
  const xo = frac(-b, a - other);
  const xov = -b / (a - other);
  return {
    prompt: md`$\lambda = ${l}$ is an eigenvalue of the symmetric matrix $A = ${matTex(A)}$. Find the eigenvector with second component $1$. Type it as a vector, like (2, 1) or (-1/2, 1).`,
    answer: `(${x}, 1)`,
    form: "tuple",
    verify: [`${a} x + ${b} y = ${l} x`, `${b} x + ${A[1]![1]} y = ${l} y`],
    hint: md`Subtract $${l}$ from the diagonal and use the first row: $(${a} - ${paren(l)})x + ${paren(b)}y = 0$ with $y = 1$.`,
    solution: [
      ...eigenvectorSteps(A, l, fracTex(xn, xd)),
      {
        math: md`${vecTex([fracTex(xn, xd), 1])} \cdot ${vecTex([fracTex(-b, a - other), 1])} = ${fracTex(xn, xd)} \cdot ${xov < 0 ? `\\left(${fracTex(-b, a - other)}\\right)` : fracTex(-b, a - other)} + 1 = 0`,
        note: md`For comparison, the eigenvector for $\lambda = ${other}$ is $(${xo}, 1)$. The dot product is $0$: eigenvectors of a symmetric matrix for different eigenvalues are perpendicular.`,
      },
    ],
  };
};

/** The extreme value of a quadratic form on the unit circle. */
const quadraticFormExtreme: Generator = (r) => {
  const { A, hi, lo } = symData(r);
  const [[a, b], [, d]] = A as [[number, number], [number, number]];
  const q = poly([
    [a, "x^2"],
    [2 * b, "xy"],
    [d, "y^2"],
  ]);
  const max = r.next() < 0.5;
  const ans = max ? hi : lo;
  const word = max ? "largest" : "smallest";
  return {
    prompt: md`Let $q(x, y) = ${q}$. Find the ${word} value of $q$ on the unit circle $x^2 + y^2 = 1$.`,
    answer: String(ans),
    // The extreme value is an eigenvalue of the form's matrix.
    verify: [`(${a} - M)(${d} - M) - (${b * b}) = 0`],
    hint: md`Write $q = \mathbf{x}^T A \mathbf{x}$ with $A$ symmetric: the $xy$ coefficient splits in half across the two off-diagonal entries. On the unit circle, $q$ runs between the smallest and largest eigenvalues of $A$.`,
    solution: [
      { math: md`A = ${matTex(A)}`, note: md`$q = ${a}x^2 + 2 \cdot ${paren(b)}\,xy ${signed(d)}y^2$, so the matrix has $${a}$ and $${d}$ on the diagonal and $${b}$ in both off-diagonal spots.` },
      ...eigenvalueSteps(A, lo, hi).slice(0, 2),
      { math: md`\lambda = ${lo}, \; ${hi}`, note: md`Sum $${lo + hi}$, product $${lo * hi}$.` },
      {
        math: md`${lo} \le q(x, y) \le ${hi} \quad\text{when } x^2 + y^2 = 1`,
        note: md`In coordinates along the eigenvectors, $q = ${lo}u^2 + ${hi}v^2$ with $u^2 + v^2 = 1$: a weighted average of the eigenvalues. It reaches $${ans}$ at the unit eigenvector for $\lambda = ${ans}$.`,
      },
      { math: String(ans), note: md`The ${word} value is $${ans}$.` },
    ],
  };
};

// ── Figures ─────────────────────────────────────────────────────────────────

const stretchDiagram = {
  kind: "diagram" as const,
  view: [-6.5, 6.5, -6.5, 6.5] as [number, number, number, number],
  grid: true,
  points: [
    { name: "O", x: 0, y: 0, label: "", hidden: true },
    { name: "V", x: "2cos(t pi/180)", y: "2sin(t pi/180)", label: md`\mathbf{v}`, dir: "sw" as const },
    { name: "W", x: "4cos(t pi/180) + 2sin(t pi/180)", y: "2cos(t pi/180) + 4sin(t pi/180)", label: md`A\mathbf{v}` },
    { name: "P", x: -6, y: -6, label: "", hidden: true },
    { name: "Q", x: 6, y: 6, label: "", hidden: true },
    { name: "R", x: -6, y: 6, label: "", hidden: true },
    { name: "S", x: 6, y: -6, label: "", hidden: true },
  ],
  segments: [
    { from: "P", to: "Q", dashed: true, color: 3 as const },
    { from: "R", to: "S", dashed: true, color: 4 as const },
    { from: "O", to: "V", arrow: true, color: 1 as const },
    { from: "O", to: "W", arrow: true, color: 2 as const },
  ],
  params: [{ name: "t", label: "direction of v (degrees)", min: 0, max: 360, step: 5, value: 20 }],
  caption: md`$A = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}$ applied to a vector $\mathbf{v}$ of length $2$. Turn $\mathbf{v}$. Most of the time $A\mathbf{v}$ points somewhere new. Along the green line ($45^\circ$, $225^\circ$) it points the same way as $\mathbf{v}$ and is three times as long. Along the red line ($135^\circ$, $315^\circ$) $A\mathbf{v} = \mathbf{v}$ exactly. Those two lines are the eigenvector directions.`,
};

const powerDiagram = {
  kind: "diagram" as const,
  view: [-1.5, 5, -1.5, 5] as [number, number, number, number],
  grid: true,
  points: [
    { name: "O", x: 0, y: 0, label: "", hidden: true },
    { name: "V", x: 1, y: 0, label: md`\mathbf{v}`, dir: "s" as const },
    { name: "W", x: "0.5*1.5^k + 0.5*0.5^k", y: "0.5*1.5^k - 0.5*0.5^k", label: md`A^{k}\mathbf{v}` },
    { name: "E", x: "0.5*1.5^k", y: "0.5*1.5^k", label: md`\tfrac12 \cdot 1.5^{k}\,\mathbf{v}_1`, dir: "nw" as const },
    { name: "F", x: "0.5*0.5^k", y: "-0.5*0.5^k", label: md`\tfrac12 \cdot 0.5^{k}\,\mathbf{v}_2`, dir: "se" as const },
    { name: "P", x: -1.5, y: -1.5, label: "", hidden: true },
    { name: "Q", x: 5, y: 5, label: "", hidden: true },
    { name: "R", x: -1.5, y: 1.5, label: "", hidden: true },
    { name: "S", x: 1.5, y: -1.5, label: "", hidden: true },
  ],
  segments: [
    { from: "P", to: "Q", dashed: true, color: 3 as const },
    { from: "R", to: "S", dashed: true, color: 4 as const },
    { from: "O", to: "E", arrow: true, dashed: true, color: 3 as const },
    { from: "O", to: "F", arrow: true, dashed: true, color: 4 as const },
    { from: "O", to: "V", arrow: true, color: 1 as const },
    { from: "O", to: "W", arrow: true, color: 2 as const },
  ],
  params: [{ name: "k", label: "k", min: 0, max: 5, step: 1, value: 0 }],
  readouts: [
    { label: md`1.5^{k}`, value: "1.5^k" },
    { label: md`0.5^{k}`, value: "0.5^k" },
  ],
  caption: md`$A = \begin{bmatrix} 1 & 0.5 \\ 0.5 & 1 \end{bmatrix}$ has eigenvalues $1.5$ (along $\mathbf{v}_1 = (1, 1)$, green) and $0.5$ (along $\mathbf{v}_2 = (1, -1)$, red). The vector $\mathbf{v} = (1, 0)$ is $\tfrac12\mathbf{v}_1 + \tfrac12\mathbf{v}_2$. Step $k$ up. Each application of $A$ multiplies the green part by $1.5$ and the red part by $0.5$, so $A^k\mathbf{v}$ swings toward the green line and grows like $1.5^k$.`,
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit7: Unit = {
  title: "Eigenvalues",
  lessons: [
    {
      id: slug("Eigenvalues and eigenvectors"),
      title: "Eigenvalues and eigenvectors",
      summary: "The directions a matrix only stretches, and how to check and find them.",
      blocks: [
        {
          kind: "text",
          body: md`In Unit 3 a matrix was a transformation: $A$ takes each vector $\mathbf{x}$ to a new vector $A\mathbf{x}$. Usually the new vector points in a new direction. Take $A = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}$. It sends $(1, 0)$ to $(2, 1)$, turned up from the axis. It sends $(0, 1)$ to $(1, 2)$, turned the other way.

But try $(1, 1)$: $A\begin{bmatrix} 1 \\ 1 \end{bmatrix} = \begin{bmatrix} 3 \\ 3 \end{bmatrix}$, the same direction, three times as long. And $(1, -1)$: $A\begin{bmatrix} 1 \\ -1 \end{bmatrix} = \begin{bmatrix} 1 \\ -1 \end{bmatrix}$, not moved at all. Those two directions are special. On them, $A$ acts like a plain number.`,
        },
        stretchDiagram,
        {
          kind: "key",
          title: "Eigenvector and eigenvalue",
          body: md`A nonzero vector $\mathbf{v}$ is an **eigenvector** of the square matrix $A$ if

$$A\mathbf{v} = \lambda\mathbf{v}$$

for some number $\lambda$. That number is the **eigenvalue** belonging to $\mathbf{v}$. (Lambda, $\lambda$, is the traditional letter; when you type an eigenvalue, just type the number.)

The eigenvalue is the stretch factor along that direction. It may be negative ($\mathbf{v}$ is flipped), it may be $0$ ($\mathbf{v}$ is squashed to the origin), and it may be a fraction.`,
        },
        {
          kind: "why",
          title: "Why the eigenvector must be nonzero, but the eigenvalue may be zero",
          body: md`$A\mathbf{0} = \mathbf{0} = \lambda\mathbf{0}$ for every single $\lambda$. If $\mathbf{0}$ counted as an eigenvector, every number would be an eigenvalue of every matrix, and the word would say nothing. So we insist $\mathbf{v} \ne \mathbf{0}$.

$\lambda = 0$ is different. $A\mathbf{v} = 0\mathbf{v} = \mathbf{0}$ with $\mathbf{v} \ne \mathbf{0}$ says a nonzero vector is in the null space of $A$ (Unit 5). That happens exactly when $A$ is singular, which by Unit 4 means $\det A = 0$. So: **$0$ is an eigenvalue of $A$ if and only if $A$ is not invertible.** A projection squashes a whole line to the origin, and $0$ is one of its eigenvalues.`,
        },
        {
          kind: "example",
          title: "Checking a candidate",
          problem: md`Let $A = \begin{bmatrix} 3 & 2 \\ 1 & 4 \end{bmatrix}$. Is $(1, 1)$ an eigenvector? Is $(1, 0)$?`,
          steps: [
            { math: md`A\begin{bmatrix} 1 \\ 1 \end{bmatrix} = \begin{bmatrix} 3 + 2 \\ 1 + 4 \end{bmatrix} = \begin{bmatrix} 5 \\ 5 \end{bmatrix} = 5\begin{bmatrix} 1 \\ 1 \end{bmatrix}`, note: md`Yes. Both components came out $5$ times as big, so $(1, 1)$ is an eigenvector with eigenvalue $5$.` },
            { math: md`A\begin{bmatrix} 1 \\ 0 \end{bmatrix} = \begin{bmatrix} 3 \\ 1 \end{bmatrix}`, note: md`No. $(3, 1)$ is not a multiple of $(1, 0)$: the second component went from $0$ to $1$. A multiple of $(1, 0)$ would have to keep a $0$ there.` },
            { math: md`A\begin{bmatrix} -2 \\ 1 \end{bmatrix} = \begin{bmatrix} -6 + 2 \\ -2 + 4 \end{bmatrix} = \begin{bmatrix} -4 \\ 2 \end{bmatrix} = 2\begin{bmatrix} -2 \\ 1 \end{bmatrix}`, note: md`One more: $(-2, 1)$ is an eigenvector with eigenvalue $2$. We will meet this matrix again.` },
          ],
        },
        {
          kind: "why",
          title: "Why eigenvectors come in whole lines",
          body: md`Suppose $A\mathbf{v} = \lambda\mathbf{v}$ and $c$ is any nonzero number. Matrix multiplication is linear (Unit 3), so

$$A(c\mathbf{v}) = c(A\mathbf{v}) = c(\lambda\mathbf{v}) = \lambda(c\mathbf{v}).$$

So $c\mathbf{v}$ is also an eigenvector, with the same eigenvalue. Every nonzero multiple of an eigenvector is an eigenvector: what is really special is the **direction**, not any one vector on it. That is why we can pick a representative. In this course the convention is to scale so the **second component is $1$**: $(1, 1)$ stands for its line, and $(-2, 1)$ for its line.`,
        },
        {
          kind: "proof",
          title: "The eigenvectors for one eigenvalue form a subspace",
          given: md`$A\mathbf{v} = \lambda\mathbf{v}$ and $A\mathbf{w} = \lambda\mathbf{w}$ for the same number $\lambda$, and $c$ is a number`,
          prove: md`$\mathbf{v} + \mathbf{w}$ and $c\mathbf{v}$ also satisfy $A\mathbf{x} = \lambda\mathbf{x}$`,
          steps: [
            { statement: md`$A(\mathbf{v} + \mathbf{w}) = A\mathbf{v} + A\mathbf{w}$`, reason: md`Matrix multiplication distributes over vector addition (Unit 3)` },
            { statement: md`$= \lambda\mathbf{v} + \lambda\mathbf{w} = \lambda(\mathbf{v} + \mathbf{w})$`, reason: md`Given, then factor out $\lambda$` },
            { statement: md`$A(c\mathbf{v}) = cA\mathbf{v} = c\lambda\mathbf{v} = \lambda(c\mathbf{v})$`, reason: md`Scalars pass through matrix multiplication; given` },
            { statement: md`The set of all $\mathbf{x}$ with $A\mathbf{x} = \lambda\mathbf{x}$ is closed under addition and scaling, and contains $\mathbf{0}$`, reason: md`Steps 2 and 3; $A\mathbf{0} = \lambda\mathbf{0}$` },
            { statement: md`It is a subspace of $\mathbb{R}^n$`, reason: md`The subspace test (Unit 5)` },
          ],
        },
        {
          kind: "key",
          title: "Eigenspace",
          body: md`The **eigenspace** of $A$ for the eigenvalue $\lambda$ is the set of all solutions of $A\mathbf{x} = \lambda\mathbf{x}$: the eigenvectors for $\lambda$ together with $\mathbf{0}$. It is a subspace. For the matrix in the example, the eigenspace for $\lambda = 5$ is the line through $(1, 1)$, and the eigenspace for $\lambda = 2$ is the line through $(-2, 1)$. An eigenspace can also be a plane, or bigger.`,
        },
        {
          kind: "why",
          title: "Why we rewrite $A\mathbf{v} = \lambda\mathbf{v}$ as $(A - \lambda I)\mathbf{v} = \mathbf{0}$",
          body: md`We know how to find null spaces (Units 1 and 5), so turn the eigenvector equation into a null-space equation. Move everything to one side: $A\mathbf{v} - \lambda\mathbf{v} = \mathbf{0}$. We would like to factor out $\mathbf{v}$, but $A - \lambda$ makes no sense: you can't subtract a number from a matrix. The fix is the identity matrix: $\lambda\mathbf{v} = \lambda I\mathbf{v}$. Then

$$A\mathbf{v} - \lambda I\mathbf{v} = (A - \lambda I)\mathbf{v} = \mathbf{0}.$$

$A - \lambda I$ is just $A$ with $\lambda$ subtracted from each diagonal entry. The eigenspace for $\lambda$ is exactly the null space of $A - \lambda I$, and we find it by elimination.`,
        },
        {
          kind: "example",
          title: "Finding the eigenvectors for a known eigenvalue",
          problem: md`$\lambda = 2$ is an eigenvalue of $A = \begin{bmatrix} 3 & 2 \\ 1 & 4 \end{bmatrix}$. Find its eigenspace.`,
          steps: [
            { math: md`A - 2I = \begin{bmatrix} 3 - 2 & 2 \\ 1 & 4 - 2 \end{bmatrix} = \begin{bmatrix} 1 & 2 \\ 1 & 2 \end{bmatrix}`, note: md`Subtract $2$ from the diagonal.` },
            { math: md`\begin{bmatrix} 1 & 2 \\ 1 & 2 \end{bmatrix} \to \begin{bmatrix} 1 & 2 \\ 0 & 0 \end{bmatrix}`, note: md`$R_2 - R_1$. The rows were multiples of each other. They had to be: if $A - 2I$ were invertible, its only null vector would be $\mathbf{0}$ and $2$ would not be an eigenvalue.` },
            { math: md`x + 2y = 0 \implies x = -2y`, note: md`One free variable, $y$. The null space is a line.` },
            { math: md`\mathbf{v} = y\begin{bmatrix} -2 \\ 1 \end{bmatrix}`, note: md`With $y = 1$ the representative is $(-2, 1)$, matching the example above. Any nonzero $y$ gives an eigenvector.` },
          ],
        },
        {
          kind: "text",
          body: md`The transformations of Unit 3 have eigenvectors you can see.

- **Reflection** across the line $y = x$, $\begin{bmatrix} 0 & 1 \\ 1 & 0 \end{bmatrix}$: vectors on the mirror line don't move, $\lambda = 1$. Vectors perpendicular to it are flipped, $\lambda = -1$.
- **Projection** onto the $x$-axis, $\begin{bmatrix} 1 & 0 \\ 0 & 0 \end{bmatrix}$: vectors on the $x$-axis stay, $\lambda = 1$. Vectors on the $y$-axis are squashed to $\mathbf{0}$, $\lambda = 0$. The matrix is singular, as the why box predicted.
- **Rotation** by $90^\circ$, $\begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}$: every vector is turned. No real eigenvectors at all. The next lesson shows what the algebra does about that.
- **Shear** $\begin{bmatrix} 1 & 1 \\ 0 & 1 \end{bmatrix}$: the $x$-axis is fixed, $\lambda = 1$, and nothing else keeps its direction. Only one eigenvector line.`,
        },
        {
          kind: "key",
          title: "Triangular and diagonal matrices",
          body: md`The eigenvalues of a triangular matrix (and so of a diagonal one) are its diagonal entries.

For a diagonal matrix the eigenvectors are the standard basis vectors: $D\mathbf{e}_i = d_{ii}\mathbf{e}_i$. For a general triangular matrix the eigenvectors take a little work, but the eigenvalues are free.`,
        },
        {
          kind: "why",
          title: "Why the diagonal entries of a triangular matrix are its eigenvalues",
          body: md`$\lambda$ is an eigenvalue exactly when $A - \lambda I$ has a nonzero null vector, that is, when $A - \lambda I$ is singular. If $A$ is triangular, so is $A - \lambda I$, with diagonal entries $a_{11} - \lambda, \ldots, a_{nn} - \lambda$. Unit 4 showed that a triangular matrix's determinant is the product of its diagonal entries. That product is $0$ exactly when $\lambda$ equals one of the $a_{ii}$. Nothing else can make it singular.`,
        },
        {
          kind: "check",
          prompt: md`$(1, -1)$ is an eigenvector of $A = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}$. What is its eigenvalue? Type the number.`,
          answer: "1",
          explain: md`$A\begin{bmatrix} 1 \\ -1 \end{bmatrix} = \begin{bmatrix} 2 - 1 \\ 1 - 2 \end{bmatrix} = \begin{bmatrix} 1 \\ -1 \end{bmatrix} = 1 \cdot \begin{bmatrix} 1 \\ -1 \end{bmatrix}$. The vector is left exactly where it was, so $\lambda = 1$.`,
        },
        {
          kind: "check",
          prompt: md`$\lambda = 2$ is an eigenvalue of $\begin{bmatrix} 3 & 1 \\ 0 & 2 \end{bmatrix}$. Find the eigenvector with second component $1$. Type it like (3, 1).`,
          answer: "(-1, 1)",
          form: "tuple",
          explain: md`$A - 2I = \begin{bmatrix} 1 & 1 \\ 0 & 0 \end{bmatrix}$, so $x + y = 0$. With $y = 1$, $x = -1$. Check: $A(-1, 1) = (-3 + 1, 2) = (-2, 2) = 2(-1, 1)$.`,
        },
      ],
      practice: [findEigenvalue, findEigenvector, triangularEigenvalues],
    },
    {
      id: slug("The characteristic polynomial"),
      title: "The characteristic polynomial",
      summary: "Finding eigenvalues from A alone: det(A − λI) = 0, and what its roots can look like.",
      blocks: [
        {
          kind: "text",
          body: md`Last lesson we were always handed either $\lambda$ or $\mathbf{v}$. Now we start from $A$ alone. The trick is that the eigenvector equation $(A - \lambda I)\mathbf{v} = \mathbf{0}$ has two unknowns tangled together, but one of them can be removed. A nonzero solution $\mathbf{v}$ exists exactly when $A - \lambda I$ is singular, and Unit 4 gave us a test for singular that never mentions $\mathbf{v}$: the determinant is $0$.`,
        },
        {
          kind: "proof",
          title: "λ is an eigenvalue of A if and only if det(A − λI) = 0",
          given: md`$A$ is an $n \times n$ matrix and $\lambda$ is a number`,
          prove: md`$A$ has an eigenvector for $\lambda$ exactly when $\det(A - \lambda I) = 0$`,
          steps: [
            { statement: md`$\lambda$ is an eigenvalue of $A$ exactly when some $\mathbf{v} \ne \mathbf{0}$ has $A\mathbf{v} = \lambda\mathbf{v}$`, reason: "Definition" },
            { statement: md`exactly when some $\mathbf{v} \ne \mathbf{0}$ has $(A - \lambda I)\mathbf{v} = \mathbf{0}$`, reason: md`$\lambda\mathbf{v} = \lambda I\mathbf{v}$; rearranged (last lesson)` },
            { statement: md`exactly when the null space of $A - \lambda I$ is bigger than $\{\mathbf{0}\}$`, reason: "Definition of null space" },
            { statement: md`exactly when $A - \lambda I$ is not invertible`, reason: md`Invertible matrix theorem (Unit 3): invertible means the only solution of $M\mathbf{x} = \mathbf{0}$ is $\mathbf{0}$` },
            { statement: md`exactly when $\det(A - \lambda I) = 0$`, reason: md`$\det M = 0$ if and only if $M$ is singular (Unit 4)` },
          ],
        },
        {
          kind: "key",
          title: "The characteristic polynomial",
          body: md`$\det(A - \lambda I)$, worked out, is a polynomial in $\lambda$ of degree $n$: the **characteristic polynomial** of $A$. The equation

$$\det(A - \lambda I) = 0$$

is the **characteristic equation**, and its roots are the eigenvalues. A degree-$n$ polynomial has at most $n$ roots, so an $n \times n$ matrix has at most $n$ eigenvalues.

The recipe: subtract $\lambda$ from the diagonal, take the determinant, solve the polynomial equation, then find each eigenspace with elimination as in the last lesson.`,
        },
        {
          kind: "why",
          title: "Why the 2×2 characteristic polynomial is λ² − (trace)λ + det",
          body: md`For $A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$,

$$\det(A - \lambda I) = \begin{vmatrix} a - \lambda & b \\ c & d - \lambda \end{vmatrix} = (a - \lambda)(d - \lambda) - bc = \lambda^2 - (a + d)\lambda + (ad - bc).$$

The constant term is $\det A$. The sum of the diagonal entries, $a + d$, is called the **trace** of $A$, written $\operatorname{tr} A$. So

$$\det(A - \lambda I) = \lambda^2 - (\operatorname{tr} A)\lambda + \det A,$$

and for a 2×2 matrix you can write the characteristic polynomial down in one step.`,
        },
        {
          kind: "example",
          title: "Eigenvalues and eigenvectors from scratch",
          problem: md`Find the eigenvalues and eigenvectors of $A = \begin{bmatrix} 3 & 2 \\ 1 & 4 \end{bmatrix}$.`,
          steps: [
            { math: md`\det(A - \lambda I) = \lambda^2 - 7\lambda + 10`, note: md`Trace $3 + 4 = 7$, determinant $12 - 2 = 10$.` },
            { math: md`(\lambda - 2)(\lambda - 5) = 0 \implies \lambda = 2, \; 5`, note: md`Two numbers with sum $7$ and product $10$.` },
            { math: md`\lambda = 5: \; A - 5I = \begin{bmatrix} -2 & 2 \\ 1 & -1 \end{bmatrix} \implies -2x + 2y = 0 \implies \mathbf{v}_1 = \begin{bmatrix} 1 \\ 1 \end{bmatrix}`, note: md`Row 1 says $x = y$. Row 2 says the same, as it must.` },
            { math: md`\lambda = 2: \; A - 2I = \begin{bmatrix} 1 & 2 \\ 1 & 2 \end{bmatrix} \implies x + 2y = 0 \implies \mathbf{v}_2 = \begin{bmatrix} -2 \\ 1 \end{bmatrix}`, note: md`Second component $1$, so $x = -2$. These are the two eigenvectors we checked by hand last lesson, now found without guessing.` },
          ],
        },
        {
          kind: "plot",
          x: [-4, 9],
          y: [-12, 24],
          curves: [{ expr: "x^2 - (a + d) x + (a d - b c)", label: md`\det(A - xI)` }],
          params: [
            { name: "a", min: -3, max: 6, step: 1, value: 3 },
            { name: "b", min: -4, max: 4, step: 1, value: 2 },
            { name: "c", min: -4, max: 4, step: 1, value: 1 },
            { name: "d", min: -3, max: 6, step: 1, value: 4 },
          ],
          caption: md`The characteristic polynomial of $A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$, graphed with $x$ standing for $\lambda$. Its zeros are the eigenvalues: $2$ and $5$ to start. Slide $c$ down to $-1$: the parabola lifts clear of the axis and there are no real eigenvalues. Set $b = c = 0$ and the zeros sit at $a$ and $d$, the diagonal entries.`,
        },
        {
          kind: "key",
          title: "Trace and determinant from the eigenvalues",
          body: md`If a 2×2 matrix has eigenvalues $\lambda_1$ and $\lambda_2$, then

$$\lambda_1 + \lambda_2 = \operatorname{tr} A \qquad\text{and}\qquad \lambda_1\lambda_2 = \det A.$$

The same holds for $n \times n$: the sum of the eigenvalues is the trace and their product is the determinant (counting a repeated root as many times as it repeats). Use it to check your eigenvalues before you go looking for eigenvectors.`,
        },
        {
          kind: "why",
          title: "Why the eigenvalues add to the trace and multiply to the determinant",
          body: md`If the roots of the characteristic polynomial are $\lambda_1$ and $\lambda_2$, it factors as

$$(\lambda - \lambda_1)(\lambda - \lambda_2) = \lambda^2 - (\lambda_1 + \lambda_2)\lambda + \lambda_1\lambda_2.$$

But we already know the same polynomial is $\lambda^2 - (\operatorname{tr} A)\lambda + \det A$. Two polynomials that agree for every $\lambda$ have the same coefficients, so $\lambda_1 + \lambda_2 = \operatorname{tr} A$ and $\lambda_1\lambda_2 = \det A$. Setting $\lambda = 0$ in $\det(A - \lambda I) = (\lambda_1 - \lambda)\cdots(\lambda_n - \lambda)$ gives the product rule for any $n$.`,
        },
        {
          kind: "text",
          body: md`The discriminant of $\lambda^2 - (a + d)\lambda + (ad - bc)$ is $(a + d)^2 - 4(ad - bc) = (a - d)^2 + 4bc$, and it sorts 2×2 matrices into three kinds.

- **Positive:** two different real eigenvalues, two eigenvector lines. The example above.
- **Zero:** one repeated eigenvalue. The shear $\begin{bmatrix} 1 & 1 \\ 0 & 1 \end{bmatrix}$ has $(1 - \lambda)^2 = 0$, so $\lambda = 1$ twice. But $A - I = \begin{bmatrix} 0 & 1 \\ 0 & 0 \end{bmatrix}$ has a one-dimensional null space: a repeated eigenvalue with only one eigenvector line. Lesson 3 cares a lot about this.
- **Negative:** no real eigenvalues. Rotation by $90^\circ$, $\begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}$, has $\lambda^2 + 1 = 0$, so $\lambda = \pm i$. The algebra agrees with the picture: no real vector keeps its direction. Complex eigenvalues are a signal that the matrix rotates.`,
        },
        {
          kind: "example",
          title: "A 3×3 with a helpful row",
          problem: md`Find the eigenvalues of $A = \begin{bmatrix} 1 & 0 & 0 \\ 2 & 3 & 2 \\ -1 & 1 & 4 \end{bmatrix}$.`,
          steps: [
            { math: md`\det(A - \lambda I) = \begin{vmatrix} 1 - \lambda & 0 & 0 \\ 2 & 3 - \lambda & 2 \\ -1 & 1 & 4 - \lambda \end{vmatrix}`, note: md`Subtract $\lambda$ down the diagonal.` },
            { math: md`= (1 - \lambda)\begin{vmatrix} 3 - \lambda & 2 \\ 1 & 4 - \lambda \end{vmatrix}`, note: md`Cofactor expansion along the first row (Unit 4). Two of its three entries are $0$, so only one term survives, and its sign is $+$.` },
            { math: md`= (1 - \lambda)(\lambda^2 - 7\lambda + 10) = (1 - \lambda)(\lambda - 2)(\lambda - 5)`, note: md`The 2×2 block has trace $7$ and determinant $10$: the same polynomial as before.` },
            { math: md`\lambda = 1, \; 2, \; 5`, note: md`Check: $1 + 2 + 5 = 8 = \operatorname{tr} A$ and $1 \cdot 2 \cdot 5 = 10 = \det A$ (expand along row 1: $1 \cdot (12 - 2)$).` },
          ],
        },
        {
          kind: "key",
          title: "Shortcuts for bigger matrices",
          body: md`- Triangular: the eigenvalues are the diagonal entries (last lesson).
- A row or column that is zero except on the diagonal: expand along it. The factor $(a_{ii} - \lambda)$ comes out, leaving a smaller determinant.
- Always check: the eigenvalues must add to the trace and multiply to the determinant.

Everything you know about determinants still applies to $A - \lambda I$. Its entries happen to contain $\lambda$, but it is a matrix like any other.`,
        },
        {
          kind: "check",
          prompt: md`Find the characteristic polynomial of $\begin{bmatrix} 5 & 4 \\ 1 & 2 \end{bmatrix}$. Type it expanded, in $x$, like x^2 - 3x + 2.`,
          answer: "x^2 - 7x + 6",
          expanded: true,
          explain: md`Trace $5 + 2 = 7$, determinant $10 - 4 = 6$, so $\lambda^2 - 7\lambda + 6$. Its roots $1$ and $6$ are the eigenvalues.`,
        },
        {
          kind: "check",
          prompt: md`Find the eigenvalues of $\begin{bmatrix} 6 & -2 \\ 1 & 3 \end{bmatrix}$. Type them as a list, like 2, 5.`,
          answer: "4, 5",
          form: "set",
          explain: md`$\lambda^2 - 9\lambda + 20 = (\lambda - 4)(\lambda - 5)$. Trace $9$, determinant $18 + 2 = 20$. Sum $9$, product $20$: it checks.`,
        },
      ],
      practice: [characteristicPolynomial, findEigenvalues, missingEntry],
    },
    {
      id: slug("Diagonalization"),
      title: "Diagonalization",
      summary: "Writing A = PDP⁻¹ from its eigenvectors, when that is possible, and using it to compute powers.",
      blocks: [
        {
          kind: "text",
          body: md`Diagonal matrices are the easiest matrices there are: $D\mathbf{x}$ just scales each coordinate, and $D^k$ is the diagonal entries raised to the $k$. Eigenvectors let us see almost any matrix as a diagonal one in disguise.

Take $A = \begin{bmatrix} 3 & 2 \\ 1 & 4 \end{bmatrix}$ with its eigenvectors $\mathbf{v}_1 = (1, 1)$, $\lambda_1 = 5$, and $\mathbf{v}_2 = (-2, 1)$, $\lambda_2 = 2$. Put the eigenvectors side by side as the columns of a matrix $P$, and the eigenvalues in the same order down a diagonal matrix $D$:

$$P = \begin{bmatrix} 1 & -2 \\ 1 & 1 \end{bmatrix}, \qquad D = \begin{bmatrix} 5 & 0 \\ 0 & 2 \end{bmatrix}.$$`,
        },
        {
          kind: "why",
          title: "Why AP = PD",
          body: md`Unit 3's column picture: the $j$-th column of a product $AP$ is $A$ times the $j$-th column of $P$. So

$$AP = \begin{bmatrix} A\mathbf{v}_1 & A\mathbf{v}_2 \end{bmatrix} = \begin{bmatrix} \lambda_1\mathbf{v}_1 & \lambda_2\mathbf{v}_2 \end{bmatrix}.$$

Now look at $PD$. Multiplying by a diagonal matrix on the right scales the columns: the $j$-th column of $PD$ is $P$ times $\lambda_j\mathbf{e}_j$, which is $\lambda_j$ times the $j$-th column of $P$. So

$$PD = \begin{bmatrix} \lambda_1\mathbf{v}_1 & \lambda_2\mathbf{v}_2 \end{bmatrix}.$$

Same columns, so $AP = PD$. This is just $A\mathbf{v}_j = \lambda_j\mathbf{v}_j$ for all $j$ written as one matrix equation. The order matters: the eigenvalue in column $j$ of $D$ belongs to the eigenvector in column $j$ of $P$.

If $P$ is invertible, multiply on the right by $P^{-1}$: $A = PDP^{-1}$.`,
        },
        {
          kind: "key",
          title: "Diagonalization",
          body: md`An $n \times n$ matrix $A$ is **diagonalizable** if $A = PDP^{-1}$ for some invertible $P$ and diagonal $D$. Then the columns of $P$ are eigenvectors and the diagonal of $D$ holds their eigenvalues.

$A$ is diagonalizable exactly when it has $n$ **linearly independent** eigenvectors: that is what makes $P$ invertible (invertible matrix theorem, Unit 3). Eigenvectors for different eigenvalues are automatically independent (proved below), so a matrix with $n$ different eigenvalues is always diagonalizable.`,
        },
        {
          kind: "proof",
          title: "Eigenvectors for different eigenvalues are linearly independent",
          given: md`$A\mathbf{v}_1 = \lambda_1\mathbf{v}_1$ and $A\mathbf{v}_2 = \lambda_2\mathbf{v}_2$ with $\mathbf{v}_1, \mathbf{v}_2 \ne \mathbf{0}$ and $\lambda_1 \ne \lambda_2$`,
          prove: md`If $c_1\mathbf{v}_1 + c_2\mathbf{v}_2 = \mathbf{0}$ then $c_1 = c_2 = 0$`,
          steps: [
            { statement: md`Suppose $c_1\mathbf{v}_1 + c_2\mathbf{v}_2 = \mathbf{0}$`, reason: "Start of the independence test (Unit 2)" },
            { statement: md`$c_1\lambda_1\mathbf{v}_1 + c_2\lambda_2\mathbf{v}_2 = \mathbf{0}$`, reason: md`Multiply both sides by $A$; $A\mathbf{0} = \mathbf{0}$` },
            { statement: md`$c_1\lambda_1\mathbf{v}_1 + c_2\lambda_1\mathbf{v}_2 = \mathbf{0}$`, reason: md`Multiply the supposed equation by the number $\lambda_1$ instead` },
            { statement: md`$c_2(\lambda_2 - \lambda_1)\mathbf{v}_2 = \mathbf{0}$`, reason: "Subtract step 3 from step 2" },
            { statement: md`$c_2 = 0$`, reason: md`$\lambda_2 - \lambda_1 \ne 0$ and $\mathbf{v}_2 \ne \mathbf{0}$, so the scalar must be $0$` },
            { statement: md`$c_1\mathbf{v}_1 = \mathbf{0}$, so $c_1 = 0$`, reason: md`Put $c_2 = 0$ back into step 1; $\mathbf{v}_1 \ne \mathbf{0}$` },
          ],
        },
        {
          kind: "text",
          body: md`The same argument, repeated, handles any number of eigenvectors with distinct eigenvalues: assume a dependence, hit it with $A$, subtract $\lambda_1$ times the original to kill $\mathbf{v}_1$, and keep going until one coefficient is forced to be $0$. So **$n$ distinct eigenvalues guarantee $n$ independent eigenvectors**, and $P$ is invertible.`,
        },
        {
          kind: "why",
          title: "Why powers become easy",
          body: md`$$A^2 = (PDP^{-1})(PDP^{-1}) = PD(P^{-1}P)DP^{-1} = PD\,I\,DP^{-1} = PD^2P^{-1}.$$

Every extra factor of $A$ adds a $P^{-1}P$ pair in the middle that cancels to $I$, so

$$A^k = PD^kP^{-1}, \qquad D^k = \begin{bmatrix} \lambda_1^k & 0 \\ 0 & \lambda_2^k \end{bmatrix}.$$

A hundred multiplications of $A$ become two matrix products and some powers of numbers.

There is a picture behind the formula. Any vector can be written in the eigenvector basis, $\mathbf{x} = c_1\mathbf{v}_1 + c_2\mathbf{v}_2$ (that is what $P^{-1}\mathbf{x}$ computes: the coordinates). Then

$$A^k\mathbf{x} = c_1\lambda_1^k\mathbf{v}_1 + c_2\lambda_2^k\mathbf{v}_2.$$

Each eigen-component scales by its own eigenvalue, over and over. Whichever eigenvalue is largest in absolute value takes over as $k$ grows.`,
        },
        powerDiagram,
        {
          kind: "example",
          title: "A closed form for $A^k$",
          problem: md`Find $A^k$ for $A = \begin{bmatrix} 3 & 2 \\ 1 & 4 \end{bmatrix}$, and use it to compute $A^3$.`,
          steps: [
            { math: md`P = \begin{bmatrix} 1 & -2 \\ 1 & 1 \end{bmatrix}, \quad D = \begin{bmatrix} 5 & 0 \\ 0 & 2 \end{bmatrix}, \quad P^{-1} = \frac{1}{3}\begin{bmatrix} 1 & 2 \\ -1 & 1 \end{bmatrix}`, note: md`$\det P = 1 + 2 = 3$. Unit 3's 2×2 inverse: swap the diagonal, negate the off-diagonal, divide by the determinant.` },
            { math: md`PD^k = \begin{bmatrix} 5^k & -2 \cdot 2^k \\ 5^k & 2^k \end{bmatrix}`, note: md`Columns of $P$ scaled by $5^k$ and $2^k$.` },
            { math: md`A^k = \frac{1}{3}\begin{bmatrix} 5^k & -2 \cdot 2^k \\ 5^k & 2^k \end{bmatrix}\begin{bmatrix} 1 & 2 \\ -1 & 1 \end{bmatrix} = \frac{1}{3}\begin{bmatrix} 5^k + 2 \cdot 2^k & 2 \cdot 5^k - 2 \cdot 2^k \\ 5^k - 2^k & 2 \cdot 5^k + 2^k \end{bmatrix}`, note: md`Check $k = 1$: $\frac13\begin{bmatrix} 9 & 6 \\ 3 & 12 \end{bmatrix} = A$. Good.` },
            { math: md`A^3 = \frac{1}{3}\begin{bmatrix} 125 + 16 & 250 - 16 \\ 125 - 8 & 250 + 8 \end{bmatrix} = \begin{bmatrix} 47 & 78 \\ 39 & 86 \end{bmatrix}`, note: md`Compare with brute force: $A^2 = \begin{bmatrix} 11 & 14 \\ 7 & 18 \end{bmatrix}$ and $A^3 = A^2A = \begin{bmatrix} 47 & 78 \\ 39 & 86 \end{bmatrix}$. The formula also tells you what no amount of multiplying would: for large $k$, $A^k \approx \frac{5^k}{3}\begin{bmatrix} 1 & 2 \\ 1 & 2 \end{bmatrix}$, because $2^k$ is negligible next to $5^k$.` },
          ],
        },
        {
          kind: "key",
          title: "When diagonalization fails",
          body: md`A repeated eigenvalue is a warning, not a verdict. Count the dimension of each eigenspace.

- The shear $\begin{bmatrix} 1 & 1 \\ 0 & 1 \end{bmatrix}$ has $\lambda = 1$ twice, but its eigenspace is only the $x$-axis: one dimension. Two independent eigenvectors don't exist, so no invertible $P$ does either. **Not diagonalizable.**
- $\begin{bmatrix} 2 & 0 \\ 0 & 2 \end{bmatrix}$ also has $\lambda = 2$ twice, but $A - 2I$ is the zero matrix and every vector is an eigenvector: a two-dimensional eigenspace. It is diagonal already.

Diagonalizable means the eigenspace dimensions add up to $n$. A matrix with no real eigenvalues, like a rotation, can't be diagonalized with real matrices either.`,
        },
        {
          kind: "text",
          body: md`**Where powers come from.** Many processes repeat the same linear step: $\mathbf{x}_{k+1} = A\mathbf{x}_k$, so $\mathbf{x}_k = A^k\mathbf{x}_0$. Suppose each year $10\%$ of a city's residents move to the suburbs and $20\%$ of suburbanites move to the city:

$$A = \begin{bmatrix} 0.9 & 0.2 \\ 0.1 & 0.8 \end{bmatrix}, \qquad \lambda^2 - 1.7\lambda + 0.7 = (\lambda - 1)(\lambda - 0.7).$$

For $\lambda = 1$, $A - I = \begin{bmatrix} -0.1 & 0.2 \\ 0.1 & -0.2 \end{bmatrix}$ gives $x = 2y$: the eigenvector is $(2, 1)$. Write any starting population as $c_1(2, 1) + c_2\mathbf{v}_2$. After $k$ years it is $c_1 \cdot 1^k(2, 1) + c_2(0.7)^k\mathbf{v}_2$, and $(0.7)^k \to 0$. Whatever the start, the split settles to two-thirds city, one-third suburbs: the $\lambda = 1$ eigenvector is the steady state, and the eigenvalue $0.7$ says how fast it is reached.`,
        },
        {
          kind: "check",
          prompt: md`$A = PDP^{-1}$ with $D = \begin{bmatrix} 2 & 0 \\ 0 & -1 \end{bmatrix}$. What are the eigenvalues of $A^5$? Type them as a list, like 2, 5.`,
          answer: "32, -1",
          form: "set",
          explain: md`$A^5 = PD^5P^{-1}$ and $D^5 = \begin{bmatrix} 32 & 0 \\ 0 & -1 \end{bmatrix}$. The eigenvectors are unchanged; the eigenvalues are raised to the fifth power.`,
        },
        {
          kind: "check",
          prompt: md`Using the closed form $A^k = \frac13\begin{bmatrix} 5^k + 2 \cdot 2^k & 2 \cdot 5^k - 2 \cdot 2^k \\ 5^k - 2^k & 2 \cdot 5^k + 2^k \end{bmatrix}$ from the example, find the top-left entry of $A^4$.`,
          answer: "219",
          explain: md`$5^4 = 625$ and $2 \cdot 2^4 = 32$, so the entry is $\frac{625 + 32}{3} = \frac{657}{3} = 219$.`,
        },
      ],
      practice: [findDiagonal, matrixPower, powerEigenvalues],
    },
    {
      id: slug("Symmetric matrices"),
      title: "Symmetric matrices",
      summary: "Real eigenvalues, perpendicular eigenvectors, and what they say about quadratic forms.",
      blocks: [
        {
          kind: "text",
          body: md`A matrix is **symmetric** when $A^T = A$: the entry in row $i$, column $j$ equals the one in row $j$, column $i$. Symmetric matrices come up whenever a relationship is two-way (distances, correlations, the second derivatives of a function), and their eigenvectors behave unusually well.

Look back at $\begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}$: eigenvectors $(1, 1)$ and $(1, -1)$, perpendicular. Try $A = \begin{bmatrix} 2 & 2 \\ 2 & -1 \end{bmatrix}$: trace $1$, determinant $-6$, so $\lambda^2 - \lambda - 6 = (\lambda - 3)(\lambda + 2)$. For $\lambda = 3$, $A - 3I = \begin{bmatrix} -1 & 2 \\ 2 & -4 \end{bmatrix}$ gives $x = 2y$: eigenvector $(2, 1)$. For $\lambda = -2$, $A + 2I = \begin{bmatrix} 4 & 2 \\ 2 & 1 \end{bmatrix}$ gives $y = -2x$: eigenvector $(1, -2)$. And $(2, 1) \cdot (1, -2) = 2 - 2 = 0$. Perpendicular again. This is not luck.`,
        },
        {
          kind: "why",
          title: "Why A can hop across a dot product",
          body: md`Unit 6 wrote the dot product as a matrix product: $\mathbf{x} \cdot \mathbf{y} = \mathbf{x}^T\mathbf{y}$. Combine that with $(AB)^T = B^TA^T$ from Unit 3:

$$(A\mathbf{v}) \cdot \mathbf{w} = (A\mathbf{v})^T\mathbf{w} = \mathbf{v}^TA^T\mathbf{w} = \mathbf{v} \cdot (A^T\mathbf{w}).$$

So moving $A$ from one side of a dot product to the other turns it into $A^T$. When $A$ is symmetric, $A^T = A$, and

$$(A\mathbf{v}) \cdot \mathbf{w} = \mathbf{v} \cdot (A\mathbf{w}).$$

That one identity is behind everything in this lesson.`,
        },
        {
          kind: "proof",
          title: "Eigenvectors of a symmetric matrix for different eigenvalues are orthogonal",
          given: md`$A^T = A$, $A\mathbf{v}_1 = \lambda_1\mathbf{v}_1$, $A\mathbf{v}_2 = \lambda_2\mathbf{v}_2$, and $\lambda_1 \ne \lambda_2$`,
          prove: md`$\mathbf{v}_1 \cdot \mathbf{v}_2 = 0$`,
          steps: [
            { statement: md`$\lambda_1(\mathbf{v}_1 \cdot \mathbf{v}_2) = (\lambda_1\mathbf{v}_1) \cdot \mathbf{v}_2 = (A\mathbf{v}_1) \cdot \mathbf{v}_2$`, reason: md`Scalars pull out of a dot product; given` },
            { statement: md`$= \mathbf{v}_1 \cdot (A\mathbf{v}_2)$`, reason: md`$A$ hops across the dot product because $A^T = A$` },
            { statement: md`$= \mathbf{v}_1 \cdot (\lambda_2\mathbf{v}_2) = \lambda_2(\mathbf{v}_1 \cdot \mathbf{v}_2)$`, reason: "Given; scalars pull out" },
            { statement: md`$(\lambda_1 - \lambda_2)(\mathbf{v}_1 \cdot \mathbf{v}_2) = 0$`, reason: "Subtract the ends of the chain" },
            { statement: md`$\mathbf{v}_1 \cdot \mathbf{v}_2 = 0$`, reason: md`$\lambda_1 - \lambda_2 \ne 0$, so the other factor is $0$` },
          ],
        },
        {
          kind: "why",
          title: "Why a symmetric matrix always has real eigenvalues",
          body: md`For $A = \begin{bmatrix} a & b \\ b & d \end{bmatrix}$ the characteristic polynomial is $\lambda^2 - (a + d)\lambda + (ad - b^2)$, with discriminant

$$(a + d)^2 - 4(ad - b^2) = a^2 + 2ad + d^2 - 4ad + 4b^2 = (a - d)^2 + 4b^2 \ge 0.$$

A sum of squares is never negative, so the quadratic formula always gives real roots. The roots coincide only when $a = d$ and $b = 0$, and then $A = aI$, which has every vector as an eigenvector. Compare the rotation matrix of Lesson 2, where $bc = -1$ made the discriminant negative: that can't happen when $c = b$.

For $n \times n$ symmetric matrices the eigenvalues are real too. The proof uses complex conjugates and the same hopping trick: if $A\mathbf{v} = \lambda\mathbf{v}$ then $\bar\lambda(\bar{\mathbf{v}}^T\mathbf{v}) = (A\bar{\mathbf{v}})^T\mathbf{v} = \bar{\mathbf{v}}^T A\mathbf{v} = \lambda(\bar{\mathbf{v}}^T\mathbf{v})$, and $\bar{\mathbf{v}}^T\mathbf{v} > 0$ forces $\bar\lambda = \lambda$.`,
        },
        {
          kind: "key",
          title: "The spectral theorem",
          body: md`Every symmetric $n \times n$ matrix can be written

$$A = QDQ^T$$

with $D$ diagonal (the real eigenvalues) and $Q$ **orthogonal**: its columns are **unit** eigenvectors, perpendicular to each other. Since $Q^TQ = I$ (Unit 6: the entries of $Q^TQ$ are dot products of orthonormal columns), $Q^{-1} = Q^T$, so this is the diagonalization $PDP^{-1}$ with the inverse free.

We have proved the pieces for 2×2 matrices with distinct eigenvalues: real eigenvalues, perpendicular eigenvectors. The full theorem, including repeated eigenvalues and all $n$, is stated here without proof. Its message: a symmetric matrix is a pure stretch along some set of perpendicular axes.`,
        },
        {
          kind: "example",
          title: "Orthogonal diagonalization",
          problem: md`Write $A = \begin{bmatrix} 2 & 2 \\ 2 & -1 \end{bmatrix}$ as $QDQ^T$.`,
          steps: [
            { math: md`\lambda = 3: \; \begin{bmatrix} 2 \\ 1 \end{bmatrix}, \qquad \lambda = -2: \; \begin{bmatrix} 1 \\ -2 \end{bmatrix}`, note: "Found at the top of the lesson. Perpendicular, as the proof promised." },
            { math: md`\mathbf{q}_1 = \frac{1}{\sqrt5}\begin{bmatrix} 2 \\ 1 \end{bmatrix}, \qquad \mathbf{q}_2 = \frac{1}{\sqrt5}\begin{bmatrix} 1 \\ -2 \end{bmatrix}`, note: md`Divide each by its length $\sqrt{4 + 1} = \sqrt5$ to get unit vectors.` },
            { math: md`Q = \frac{1}{\sqrt5}\begin{bmatrix} 2 & 1 \\ 1 & -2 \end{bmatrix}, \qquad D = \begin{bmatrix} 3 & 0 \\ 0 & -2 \end{bmatrix}`, note: md`$Q^TQ = \frac15\begin{bmatrix} 5 & 0 \\ 0 & 5 \end{bmatrix} = I$, so $Q^{-1} = Q^T$ and no inverse needs computing.` },
            { math: md`A = QDQ^T = \frac15\begin{bmatrix} 2 & 1 \\ 1 & -2 \end{bmatrix}\begin{bmatrix} 3 & 0 \\ 0 & -2 \end{bmatrix}\begin{bmatrix} 2 & 1 \\ 1 & -2 \end{bmatrix}`, note: md`Multiply it back out if you like: $\frac15\begin{bmatrix} 6 & -2 \\ 3 & 4 \end{bmatrix}\begin{bmatrix} 2 & 1 \\ 1 & -2 \end{bmatrix} = \frac15\begin{bmatrix} 10 & 10 \\ 10 & -5 \end{bmatrix} = A$.` },
          ],
        },
        {
          kind: "key",
          title: "Quadratic forms",
          body: md`A **quadratic form** is a polynomial whose terms are all degree two: $q(x, y) = ax^2 + 2bxy + dy^2$. Every quadratic form is $\mathbf{x}^TA\mathbf{x}$ for a symmetric matrix:

$$\begin{bmatrix} x & y \end{bmatrix}\begin{bmatrix} a & b \\ b & d \end{bmatrix}\begin{bmatrix} x \\ y \end{bmatrix} = ax^2 + bxy + bxy + dy^2 = ax^2 + 2bxy + dy^2.$$

The squared terms sit on the diagonal. The cross term is split in half and shared between the two off-diagonal entries, which is what makes $A$ symmetric. So $5x^2 + 4xy + 5y^2$ has matrix $\begin{bmatrix} 5 & 2 \\ 2 & 5 \end{bmatrix}$.`,
        },
        {
          kind: "contour",
          x: [-3, 3],
          y: [-3, 3],
          expr: "5x^2 + 4x y + 5y^2",
          levels: [3, 7, 14, 28],
          arrows: [
            { x: 0, y: 0, dx: 1, dy: 1, label: md`\mathbf{v}_1`, color: 2 },
            { x: 0, y: 0, dx: 1, dy: -1, label: md`\mathbf{v}_2`, color: 3 },
          ],
          caption: md`Level curves of $q = 5x^2 + 4xy + 5y^2$. Its matrix $\begin{bmatrix} 5 & 2 \\ 2 & 5 \end{bmatrix}$ has eigenvalue $7$ along $\mathbf{v}_1 = (1, 1)$ and $3$ along $\mathbf{v}_2 = (1, -1)$. The level curves are ellipses whose axes are exactly the eigenvectors: $q$ climbs fastest along the $\lambda = 7$ direction, so the ellipse is thinnest there.`,
        },
        {
          kind: "why",
          title: "Why the eigenvectors are the axes of the ellipse",
          body: md`Measure positions in the eigenvector basis: $\mathbf{x} = Q\mathbf{u}$, where $\mathbf{u} = (u, v)$ are the coordinates along $\mathbf{q}_1$ and $\mathbf{q}_2$. Then

$$q = \mathbf{x}^TA\mathbf{x} = (Q\mathbf{u})^TA(Q\mathbf{u}) = \mathbf{u}^T(Q^TAQ)\mathbf{u} = \mathbf{u}^TD\mathbf{u} = \lambda_1u^2 + \lambda_2v^2.$$

The cross term is gone. In the eigenvector coordinates the form is a plain sum of squares, and $\lambda_1u^2 + \lambda_2v^2 = c$ is an ellipse when both eigenvalues are positive (a hyperbola when they have opposite signs). Its axes are the $u$- and $v$-axes, which are the eigenvectors. These are the **principal axes** of the form.

The signs of the eigenvalues classify the form: all positive, **positive definite** ($q > 0$ away from the origin, a bowl); all negative, **negative definite**; mixed, **indefinite** (a saddle).`,
        },
        {
          kind: "surface",
          x: [-2, 2],
          y: [-2, 2],
          expr: "a x^2 + 2 b x y + d y^2",
          params: [
            { name: "a", min: -3, max: 3, step: 1, value: 2 },
            { name: "b", min: -3, max: 3, step: 1, value: 1 },
            { name: "d", min: -3, max: 3, step: 1, value: 2 },
          ],
          caption: md`$z = ax^2 + 2bxy + dy^2$, the quadratic form of $\begin{bmatrix} a & b \\ b & d \end{bmatrix}$. With $a = d = 2$, $b = 1$ the eigenvalues are $3$ and $1$: a bowl. Slide $b$ to $3$: the eigenvalues become $5$ and $-1$ and the bowl tears into a saddle. The determinant $ad - b^2$ is the product of the eigenvalues, so it goes negative exactly when the form turns indefinite.`,
        },
        {
          kind: "key",
          title: "Extreme values on the unit circle",
          body: md`For a symmetric $A$ with eigenvalues $\lambda_{\min} \le \lambda_{\max}$,

$$\lambda_{\min} \le \mathbf{x}^TA\mathbf{x} \le \lambda_{\max} \qquad\text{whenever } \|\mathbf{x}\| = 1,$$

and both ends are reached, at the corresponding unit eigenvectors. The largest eigenvalue is the most a symmetric matrix can stretch a unit vector in its own direction; the smallest is the least. Unit 8 builds the singular value decomposition on this fact.`,
        },
        {
          kind: "why",
          title: "Why the eigenvalues are the extreme values",
          body: md`An orthogonal $Q$ preserves lengths (Unit 6), so $\|\mathbf{x}\| = 1$ means $\|\mathbf{u}\| = 1$: $u^2 + v^2 = 1$. In eigenvector coordinates,

$$q = \lambda_1u^2 + \lambda_2v^2$$

with weights $u^2, v^2 \ge 0$ adding to $1$. That is a weighted average of $\lambda_1$ and $\lambda_2$, so it can't be smaller than the smaller one or larger than the larger one. Putting all the weight on one eigenvector ($u = \pm 1$, $v = 0$) gives $q = \lambda_1$ exactly, and likewise for $\lambda_2$.`,
        },
        {
          kind: "example",
          title: "An indefinite form",
          problem: md`Classify $q(x, y) = x^2 + 4xy - 2y^2$ and find its largest and smallest values on the unit circle.`,
          steps: [
            { math: md`A = \begin{bmatrix} 1 & 2 \\ 2 & -2 \end{bmatrix}`, note: md`The $xy$ coefficient $4$ splits into $2$ and $2$.` },
            { math: md`\lambda^2 + \lambda - 6 = (\lambda + 3)(\lambda - 2) = 0 \implies \lambda = 2, \; -3`, note: md`Trace $-1$, determinant $-2 - 4 = -6$.` },
            { math: md`-3 \le q(x, y) \le 2 \quad\text{on } x^2 + y^2 = 1`, note: md`Opposite signs: indefinite, a saddle. The maximum $2$ is reached at the unit eigenvector for $\lambda = 2$, which is $\frac{1}{\sqrt5}(2, 1)$: check $q = \frac{4 + 8 - 2}{5} = 2$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the eigenvalues of $\begin{bmatrix} 3 & 2 \\ 2 & 3 \end{bmatrix}$. Type them as a list, like 2, 5.`,
          answer: "1, 5",
          form: "set",
          explain: md`$\lambda^2 - 6\lambda + 5 = (\lambda - 1)(\lambda - 5)$. The eigenvectors are $(1, -1)$ for $1$ and $(1, 1)$ for $5$, perpendicular as always for a symmetric matrix.`,
        },
        {
          kind: "check",
          prompt: md`What is the largest value of $3x^2 + 4xy + 3y^2$ on the unit circle $x^2 + y^2 = 1$?`,
          answer: "5",
          explain: md`The matrix is $\begin{bmatrix} 3 & 2 \\ 2 & 3 \end{bmatrix}$ with eigenvalues $1$ and $5$. The maximum on the unit circle is the largest eigenvalue, $5$, reached at $\frac{1}{\sqrt2}(1, 1)$: $\frac{3 + 4 + 3}{2} = 5$.`,
        },
      ],
      practice: [symmetricEigenvalues, symmetricEigenvector, quadraticFormExtreme],
    },
  ],
};
