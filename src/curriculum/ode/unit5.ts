import { frac, fracTex, paren, poly, signed } from "../../math/random";
import type { Rng } from "../../math/random";
import { md, slug, type Figure, type Generator, type Step, type Unit } from "../types";

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
const trace = (A: Mat) => A[0]![0]! + A[1]![1]!;
const det2 = (A: Mat) => A[0]![0]! * A[1]![1]! - A[0]![1]! * A[1]![0]!;
/** "x^2 - 7x + 10" from high-degree-first coefficients, in any variable (LaTeX or typed). */
function polyIn(c: number[], v: string): string {
  const n = c.length - 1;
  return poly(c.map((k, i) => [k, n - i === 0 ? "" : n - i === 1 ? v : `${v}^${n - i}`] as [number, string]));
}
/** The characteristic polynomial of a 2×2 matrix as a verify equation in x. */
const charEq = (A: Mat) => `x^2 - (${trace(A)}) x + (${det2(A)}) = 0`;
/** "2x - 3y" in LaTeX or typed form. */
const lin = (a: number, b: number) => poly([[a, "x"], [b, "y"]]);
/** A - λI in LaTeX, with a number in place of λ. */
const shifted = (A: Mat, l: number) => matTex([[A[0]![0]! - l, A[0]![1]!], [A[1]![0]!, A[1]![1]! - l]]);

/** "e^{3t}" / "e^(3t)", with "e^{t}", "e^{-t}" and "1" for k = 0. */
function expo(k: number, tex: boolean): string {
  if (k === 0) return "1";
  const kt = k === 1 ? "t" : k === -1 ? "-t" : `${k}t`;
  return tex ? `e^{${kt}}` : `e^(${kt})`;
}
/** A sum of c e^{kt} terms written the way a person would: "2e^{5t} - e^{2t}". */
function expSum(terms: [number, number][], tex: boolean): string {
  let out = "";
  for (const [c, k] of terms) {
    if (c === 0) continue;
    const base = expo(k, tex);
    const mag = k === 0 ? String(Math.abs(c)) : Math.abs(c) === 1 ? base : `${Math.abs(c)}${base}`;
    if (!out) out = (c < 0 ? "-" : "") + mag;
    else out += c < 0 ? ` - ${mag}` : ` + ${mag}`;
  }
  return out || "0";
}
/** "3cos(2t) - sin(2t)" in LaTeX or typed form. */
function trig(c: number, s: number, b: number, tex: boolean): string {
  const bt = b === 1 ? "t" : `${b}t`;
  const cosT = tex ? `\\cos ${bt}` : `cos(${bt})`;
  const sinT = tex ? `\\sin ${bt}` : `sin(${bt})`;
  return poly([[c, cosT], [s, sinT]]);
}
/** e^{at}(c cos bt + s sin bt). */
function expTrig(a: number, c: number, s: number, b: number, tex: boolean): string {
  const inner = trig(c, s, b, tex);
  if (a === 0) return inner;
  const single = (c === 0) !== (s === 0) && Math.abs(c + s) === 1;
  return single ? `${expo(a, tex)}${inner}` : `${expo(a, tex)}(${inner})`;
}

/**
 * The 2×2 matrix with eigenvectors (1, m1), (1, m2) and eigenvalues l1, l2.
 * Integer exactly when (m2 - m1) divides (l1 - l2).
 */
function fromEigen(m1: number, m2: number, l1: number, l2: number): Mat | null {
  const s = m2 - m1;
  if (s === 0 || (l1 - l2) % s !== 0) return null;
  const k = (l1 - l2) / s;
  return [
    [(l1 * m2 - l2 * m1) / s, -k],
    [m1 * m2 * k, (m2 * l2 - m1 * l1) / s],
  ];
}

interface RealEigen {
  A: Mat;
  l1: number;
  l2: number;
  m1: number;
  m2: number;
}

/** A 2×2 with real distinct nonzero eigenvalues of the requested signs and integer eigenvectors (1, m). */
function realEigen(r: Rng, kind: "stable" | "unstable" | "saddle" | "any", maxEig = 5): RealEigen {
  for (;;) {
    let l1 = r.nonzero(-maxEig, maxEig);
    let l2 = r.nonzero(-maxEig, maxEig);
    if (l1 === l2) continue;
    if (kind === "stable" && (l1 > 0 || l2 > 0)) continue;
    if (kind === "unstable" && (l1 < 0 || l2 < 0)) continue;
    if (kind === "saddle" && l1 * l2 > 0) continue;
    if (l1 < l2) [l1, l2] = [l2, l1];
    const m1 = r.int(-3, 3);
    const m2 = r.int(-3, 3);
    if (m1 === m2) continue;
    const A = fromEigen(m1, m2, l1, l2);
    if (!A || A.flat().some((v) => Math.abs(v) > 12)) continue;
    return { A, l1, l2, m1, m2 };
  }
}

/** A 2×2 with eigenvalues a ± bi (b > 0), not in the obvious rotation form. */
function complexEigen(r: Rng, a: number): { A: Mat; a: number; b: number } {
  for (;;) {
    const b = r.int(1, 3);
    const m = r.int(0, 3);
    const sum = m * m + b * b;
    const divisors = [1, 2, 4, 5, 8, 10, 13, 9, 18, 3, 6].filter((d) => sum % d === 0 && sum / d <= 10 && d <= 10);
    const n = r.sign() * r.pick(divisors);
    const A: Mat = [
      [a + m, n],
      [-sum / n, a - m],
    ];
    if (A.flat().some((v) => Math.abs(v) > 12)) continue;
    return { A, a, b };
  }
}

type Portrait = "stable node" | "unstable node" | "saddle" | "stable spiral" | "unstable spiral" | "center";
const PORTRAITS: Portrait[] = ["stable node", "unstable node", "saddle", "stable spiral", "unstable spiral", "center"];

/** Classify the origin of x' = Ax from trace and determinant; null for the borderline cases. */
function classify(A: Mat): Portrait | null {
  const t = trace(A);
  const d = det2(A);
  if (Math.abs(d) < 1e-9) return null;
  if (d < 0) return "saddle";
  const disc = t * t - 4 * d;
  if (Math.abs(disc) < 1e-9) return null;
  if (disc > 0) return t < 0 ? "stable node" : "unstable node";
  if (Math.abs(t) < 1e-9) return "center";
  return t < 0 ? "stable spiral" : "unstable spiral";
}

/** A matrix of the given portrait type. */
function matrixOfType(r: Rng, type: Portrait): Mat {
  if (type === "stable node") return realEigen(r, "stable", 4).A;
  if (type === "unstable node") return realEigen(r, "unstable", 4).A;
  if (type === "saddle") return realEigen(r, "saddle", 4).A;
  const a = type === "center" ? 0 : type === "stable spiral" ? -r.int(1, 2) : r.int(1, 2);
  return complexEigen(r, a).A;
}

/** A phase-plane field for x' = Ax. */
function fieldFigure(A: Mat): Figure {
  return {
    kind: "plot",
    x: [-3, 3],
    y: [-3, 3],
    field: { dx: lin(A[0]![0]!, A[0]![1]!), dy: lin(A[1]![0]!, A[1]![1]!) },
    caption: md`Direction field of the system. Each arrow points along $\mathbf{x}' = A\mathbf{x}$ at that point.`,
  };
}

/** The eigenvalue computation for a 2×2, as solution steps. */
function eigenSteps(A: Mat, roots: string): Step[] {
  const t = trace(A);
  const d = det2(A);
  return [
    { math: md`\det(A - \lambda I) = ${vmatTex([[`${A[0]![0]} - \\lambda`, A[0]![1]!], [A[1]![0]!, `${A[1]![1]} - \\lambda`]])} = 0`, note: "The characteristic equation." },
    { math: md`${polyIn([1, -t, d], "\\lambda")} = 0`, note: md`For a $2 \times 2$ matrix this is always $\lambda^2 - (\text{trace})\lambda + \det A$. Trace $${t}$, determinant $${d}$.` },
    { math: roots, note: "Solve the quadratic." },
  ];
}

// ── Practice generators: Lesson 1 ───────────────────────────────────────────

const matrixForm: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [a, b, c, d] = [r.nonzero(-5, 5), r.nonzero(-5, 5), r.nonzero(-5, 5), r.nonzero(-5, 5)];
    return {
      prompt: md`Write the system $x' = ${lin(a, b)}$, $y' = ${lin(c, d)}$ in matrix form $\mathbf{x}' = A\mathbf{x}$ with $\mathbf{x} = (x, y)$. Give $A$, typed like [[1, 2], [3, 4]].`,
      answer: matAns([[a, b], [c, d]]),
      form: "matrix",
      hint: md`Each row of $A$ holds the coefficients of one equation, in the order $x$, then $y$.`,
      solution: [
        { math: md`\begin{bmatrix} x' \\ y' \end{bmatrix} = \begin{bmatrix} ${a} & ${b} \\ ${c} & ${d} \end{bmatrix}\begin{bmatrix} x \\ y \end{bmatrix}`, note: md`Row 1 times $(x, y)$ gives $${lin(a, b)}$, which is $x'$. Row 2 gives $y'$.` },
      ],
    };
  }
  if (kind === 1) {
    const lead = r.pick([1, 1, 1, 2, 3]);
    const b = r.nonzero(-6, 6);
    const c = r.nonzero(-9, 9);
    const eq = poly([[lead, "y''"], [b, "y'"], [c, "y"]]);
    const A = [["0", "1"], [frac(-c, lead), frac(-b, lead)]];
    const row2 = lead === 1 ? md`${poly([[-c, "x_1"], [-b, "x_2"]])}` : md`${fracTex(-c, lead)} x_1 ${fracTex(-b, lead).startsWith("-") ? "-" : "+"} ${fracTex(Math.abs(b), lead)} x_2`;
    return {
      prompt: md`Rewrite $${eq} = 0$ as a first-order system $\mathbf{x}' = A\mathbf{x}$ using $x_1 = y$ and $x_2 = y'$. Give $A$, typed like [[0, 1], [-2, -3]]${lead === 1 ? "" : " (fractions are fine)"}.`,
      answer: matAns(A),
      form: "matrix",
      hint: md`$x_1' = y' = x_2$ gives the first row. For the second row, solve the equation for $y''$ and write it in terms of $x_1$ and $x_2$.`,
      solution: [
        { math: md`x_1' = y' = x_2`, note: "The first row is always (0, 1): the derivative of position is velocity." },
        { math: md`${lead === 1 ? "" : lead}y'' = ${poly([[-b, "y'"], [-c, "y"]])}`, note: md`Solve the equation for $${lead === 1 ? "" : lead}y''$.` },
        { math: md`x_2' = y'' = ${row2}`, note: md`${lead === 1 ? "" : `Divide by ${lead}, then `}replace $y$ by $x_1$ and $y'$ by $x_2$.` },
        { math: md`A = ${matTex([["0", "1"], [fracTex(-c, lead), fracTex(-b, lead)]])}`, note: "" },
      ],
    };
  }
  const a = r.nonzero(-4, 4);
  const b = r.nonzero(-5, 5);
  const c = r.nonzero(-6, 6);
  const eq = poly([[1, "y'''"], [a, "y''"], [b, "y'"], [c, "y"]]);
  return {
    prompt: md`Rewrite $${eq} = 0$ as a first-order system $\mathbf{x}' = A\mathbf{x}$ using $x_1 = y$, $x_2 = y'$, $x_3 = y''$. Give the $3 \times 3$ matrix $A$, typed row by row like [[0, 1, 0], [0, 0, 1], [1, 2, 3]].`,
    answer: matAns([[0, 1, 0], [0, 0, 1], [-c, -b, -a]]),
    form: "matrix",
    hint: md`$x_1' = x_2$ and $x_2' = x_3$ are the first two rows. The last row comes from solving for $y'''$.`,
    solution: [
      { math: md`x_1' = x_2, \qquad x_2' = x_3`, note: "Each variable's derivative is the next one." },
      { math: md`x_3' = y''' = ${poly([[-a, "y''"], [-b, "y'"], [-c, "y"]])} = ${poly([[-c, "x_1"], [-b, "x_2"], [-a, "x_3"]])}`, note: md`Solve for $y'''$, then rename.` },
      { math: md`A = ${matTex([[0, 1, 0], [0, 0, 1], [-c, -b, -a]])}`, note: "The coefficients of the equation appear, negated and reversed, in the last row." },
    ],
  };
};

const solutionCheck: Generator = (r) => {
  const { A, l1, l2, m1, m2 } = realEigen(r, "any");
  const [a, b, c, d] = [A[0]![0]!, A[0]![1]!, A[1]![0]!, A[1]![1]!];
  const useFirst = r.next() < 0.5;
  const [l, m] = useFirst ? [l1, m1] : [l2, m2];
  const Av = [a + b * m, c + d * m];
  if (m !== 0 && r.next() < 0.5) {
    return {
      prompt: md`For which value of $k$ is $\mathbf{x}(t) = e^{kt}${vecTex([1, m])}$ a solution of $\mathbf{x}' = A\mathbf{x}$, where $A = ${matTex(A)}$?`,
      answer: String(l),
      verify: [`${a} + ${paren(b)} * ${paren(m)} = k`, `${c} + ${paren(d)} * ${paren(m)} = k * ${paren(m)}`],
      hint: md`Differentiate: $\mathbf{x}' = k e^{kt}(1, ${m})$. Compute $A\mathbf{x} = e^{kt} A(1, ${m})$. For the two to match, $A(1, ${m})$ must be $k$ times $(1, ${m})$.`,
      solution: [
        { math: md`\mathbf{x}' = k e^{kt}${vecTex([1, m])}`, note: "Differentiate each component." },
        { math: md`A\mathbf{x} = e^{kt}${matTex(A)}${vecTex([1, m])} = e^{kt}${vecTex(Av)}`, note: "Multiply the matrix by the constant vector." },
        { math: md`${vecTex(Av)} = ${l}${vecTex([1, m])}`, note: md`Both components are $${l}$ times the original: $${Av[0]} = ${l} \cdot 1$ and $${Av[1]} = ${l} \cdot ${paren(m)}$.` },
        { math: md`k = ${l}`, note: md`So $(1, ${m})$ is an eigenvector with eigenvalue $${l}$, and the solution works exactly when $k = ${l}$.` },
      ],
    };
  }
  return {
    prompt: md`The vector function $\mathbf{x}(t) = e^{${l}t}\begin{bmatrix} 1 \\ m \end{bmatrix}$ solves $\mathbf{x}' = A\mathbf{x}$ with $A = ${matTex(A)}$. Find $m$.`,
    answer: String(m),
    verify: [`${a} + ${paren(b)} m = ${l}`, `${c} + ${paren(d)} m = ${l} m`],
    hint: md`Substitute. After cancelling $e^{${l}t}$ you need $A(1, m) = ${l}(1, m)$. The first component gives $m$ directly; the second must agree.`,
    solution: [
      { math: md`\mathbf{x}' = ${l} e^{${l}t}\begin{bmatrix} 1 \\ m \end{bmatrix}, \qquad A\mathbf{x} = e^{${l}t}\begin{bmatrix} ${a} ${signed(b)} m \\ ${c} ${signed(d)} m \end{bmatrix}`, note: "Differentiate, and multiply out." },
      { math: md`${a} ${signed(b)} m = ${l}`, note: md`Match the first components (the $e^{${l}t}$ cancels).` },
      { math: md`m = ${m}`, note: md`Solve: $${b}m = ${l - a}$.` },
      { math: md`${c} ${signed(d)}(${m}) = ${c + d * m} = ${l} \cdot ${paren(m)}`, note: "The second components agree too, as they must for an eigenvector." },
    ],
  };
};

const fitConstants: Generator = (r) => {
  const vectors: [number, number][] = [[1, 1], [1, -1], [1, 2], [2, 1], [1, -2], [2, -1], [1, 3], [3, 1], [1, -3], [2, 3], [3, -2]];
  let v1 = r.pick(vectors);
  let v2 = r.pick(vectors);
  while (v1[0] * v2[1] - v1[1] * v2[0] === 0) v2 = r.pick(vectors);
  if (r.next() < 0.3) v1 = [v1[0], -v1[1]] as [number, number];
  const l1 = r.nonzero(-4, 4);
  let l2 = r.nonzero(-4, 4);
  while (l2 === l1) l2 = r.nonzero(-4, 4);
  const c1 = r.nonzero(-3, 3);
  const c2 = r.nonzero(-3, 3);
  const x0 = c1 * v1[0] + c2 * v2[0];
  const y0 = c1 * v1[1] + c2 * v2[1];
  const D = v1[0] * v2[1] - v1[1] * v2[0];
  return {
    prompt: md`The general solution of a system is $\mathbf{x}(t) = c_1 ${expo(l1, true)}${vecTex(v1)} + c_2 ${expo(l2, true)}${vecTex(v2)}$. Find the constants that give $\mathbf{x}(0) = ${vecTex([x0, y0])}$. Type them as $(c_1, c_2)$.`,
    answer: `(${c1}, ${c2})`,
    form: "tuple",
    verify: [`${v1[0]} p + ${paren(v2[0])} q = ${x0}`, `${v1[1]} p + ${paren(v2[1])} q = ${y0}`],
    hint: md`At $t = 0$ every exponential is $1$, so $c_1 ${vecTex(v1)} + c_2 ${vecTex(v2)} = ${vecTex([x0, y0])}$: two linear equations in $c_1, c_2$.`,
    solution: [
      { math: md`\mathbf{x}(0) = c_1${vecTex(v1)} + c_2${vecTex(v2)} = ${vecTex([x0, y0])}`, note: md`Set $t = 0$; $e^{0} = 1$.` },
      { math: md`${poly([[v1[0], "c_1"], [v2[0], "c_2"]])} = ${x0}, \qquad ${poly([[v1[1], "c_1"], [v2[1], "c_2"]])} = ${y0}`, note: "Read off the two components." },
      { math: md`c_1 = ${fracTex(v2[1] * x0 - v2[0] * y0, D)}, \quad c_2 = ${fracTex(-v1[1] * x0 + v1[0] * y0, D)}`, note: md`Solve the $2 \times 2$ system (elimination, or Cramer's rule with determinant $${D}$).` },
      { math: md`\mathbf{x}(t) = ${expSum([[c1, l1]], true) === "1" ? "" : `${c1 === 1 ? "" : c1 === -1 ? "-" : c1}`}${expo(l1, true)}${vecTex(v1)} ${c2 < 0 ? "-" : "+"} ${Math.abs(c2) === 1 ? "" : Math.abs(c2)}${expo(l2, true)}${vecTex(v2)}`, note: "The particular solution through the given starting point." },
    ],
  };
};

// ── Practice generators: Lesson 2 ───────────────────────────────────────────

const findEigenvalues: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind <= 1) {
    const { A, l1, l2 } = realEigen(r, "any");
    return {
      prompt: md`Find the eigenvalues of $A = ${matTex(A)}$, the matrix of the system $\mathbf{x}' = A\mathbf{x}$. Type them as a comma-separated list, like 2, -3.`,
      answer: `${l1}, ${l2}`,
      form: "set",
      verify: [charEq(A)],
      hint: md`Solve $\lambda^2 - (\text{trace})\lambda + \det A = 0$. The trace is $${trace(A)}$ and the determinant is $${det2(A)}$.`,
      solution: eigenSteps(A, md`(\lambda ${signed(-l1)})(\lambda ${signed(-l2)}) = 0 \;\Rightarrow\; \lambda = ${l1}, \; ${l2}`),
    };
  }
  if (kind === 2) {
    const a = r.int(-2, 2);
    const { A, b } = complexEigen(r, a);
    const t = trace(A);
    const d = det2(A);
    const re = a === 0 ? "" : `${a} `;
    return {
      prompt: md`Find the eigenvalues of $A = ${matTex(A)}$. They are complex: type them as a comma-separated list, like 1 + 2i, 1 - 2i.`,
      answer: `${a} + ${b}i, ${a} - ${b}i`,
      form: "set",
      complex: true,
      verify: [charEq(A)],
      hint: md`The characteristic equation is $\lambda^2 ${signed(-t)}\lambda ${signed(d)} = 0$. Its discriminant $${t * t - 4 * d}$ is negative, so use the quadratic formula and write $\sqrt{-n}$ as $i\sqrt{n}$.`,
      solution: eigenSteps(A, md`\lambda = \frac{${t} \pm \sqrt{${t * t} - ${4 * d}}}{2} = \frac{${t} \pm \sqrt{${t * t - 4 * d}}}{2} = ${re}\pm ${b === 1 ? "" : b}i`),
    };
  }
  const l = r.nonzero(-4, 4);
  for (;;) {
    const m = r.nonzero(-3, 3);
    const n = r.sign() * r.pick([1, Math.abs(m), m * m].filter((v) => v <= 9));
    const A: Mat = [
      [l + m, n],
      [-(m * m) / n, l - m],
    ];
    if (A.flat().some((v) => !Number.isInteger(v) || Math.abs(v) > 12)) continue;
    return {
      prompt: md`Find the eigenvalues of $A = ${matTex(A)}$. Type them as a comma-separated list; if an eigenvalue is repeated, type it once.`,
      answer: String(l),
      form: "set",
      verify: [charEq(A)],
      hint: md`Trace $${trace(A)}$, determinant $${det2(A)}$. Check the discriminant before you look for two different roots.`,
      solution: eigenSteps(A, md`(\lambda ${signed(-l)})^2 = 0 \;\Rightarrow\; \lambda = ${l} \text{ (repeated)}`),
    };
  }
};

const findEigenvector: Generator = (r) => {
  const { A, l1, l2, m1, m2 } = realEigen(r, "any");
  const [a, b, c, d] = [A[0]![0]!, A[0]![1]!, A[1]![0]!, A[1]![1]!];
  const larger = r.next() < 0.5;
  const [l, m, other] = larger ? [l1, m1, l2] : [l2, m2, l1];
  const B = shifted(A, l);
  const rowSteps: Step[] = [
    { math: md`(A - ${paren(l)} I)\mathbf{v} = ${B}\begin{bmatrix} 1 \\ m \end{bmatrix} = \mathbf{0}`, note: md`An eigenvector is a nonzero solution of $(A - \lambda I)\mathbf{v} = \mathbf{0}$. Scale it so the first component is $1$.` },
    { math: md`${a - l} ${signed(b)}m = 0 \;\Rightarrow\; m = ${fracTex(l - a, b)} = ${m}`, note: md`The first row. (The second row, $${c} ${signed(d - l)}m = 0$, gives the same $m$: the rows of $A - \lambda I$ are dependent, which is exactly what $\det(A - \lambda I) = 0$ means.)` },
  ];
  if (r.next() < 0.5) {
    return {
      prompt: md`$\lambda = ${l}$ is an eigenvalue of $A = ${matTex(A)}$. Find the eigenvector scaled so its first component is $1$. Type it as $(1, m)$.`,
      answer: `(1, ${m})`,
      form: "tuple",
      verify: [`${a} p + ${paren(b)} q = ${l} p`, `${c} p + ${paren(d)} q = ${l} q`],
      hint: md`Solve $(A - ${paren(l)}I)\mathbf{v} = \mathbf{0}$. Write $\mathbf{v} = (1, m)$ and use the first row.`,
      solution: [...rowSteps, { math: md`\mathbf{v} = ${vecTex([1, m])}`, note: md`Check: $A\mathbf{v} = ${vecTex([a + b * m, c + d * m])} = ${l}\mathbf{v}$. The straight-line solution is $e^{${l}t}(1, ${m})$.` }],
    };
  }
  return {
    prompt: md`$A = ${matTex(A)}$ has eigenvalues $${other}$ and $${l}$. Find the straight-line solution $\mathbf{x}(t) = e^{\lambda t}(1, m)$ that belongs to $\lambda = ${l}$. Give the pair $(\lambda, m)$.`,
    answer: `(${l}, ${m})`,
    form: "tuple",
    verify: [`${a} + ${paren(b)} m = l`, `${c} + ${paren(d)} m = l m`],
    hint: md`$\lambda$ is given. The direction $(1, m)$ must satisfy $A(1, m) = \lambda(1, m)$; the first component gives $m$.`,
    solution: [...rowSteps, { math: md`\mathbf{x}(t) = e^{${l}t}${vecTex([1, m])}`, note: md`The solution runs along the line through the origin with slope $${m}$, ${l > 0 ? "away from" : "toward"} the origin since $\lambda ${l > 0 ? ">" : "<"} 0$.` }],
  };
};

const solveSystemIvp: Generator = (r) => {
  if (r.next() < 0.65) {
    const { A, l1, l2, m1, m2 } = realEigen(r, "any", 4);
    const c1 = r.nonzero(-3, 3);
    const c2 = r.nonzero(-3, 3);
    const x0 = c1 + c2;
    const y0 = c1 * m1 + c2 * m2;
    const xT: [number, number][] = [[c1, l1], [c2, l2]];
    const yT: [number, number][] = [[c1 * m1, l1], [c2 * m2, l2]];
    const K1 = m2 * x0 - y0;
    const K2 = m1 * x0 - y0;
    const term = (c: number, l: number, v: number[]) => `${c === 1 ? "" : c === -1 ? "-" : c}${expo(l, true)}${vecTex(v)}`;
    return {
      prompt: md`Solve $\mathbf{x}' = ${matTex(A)}\mathbf{x}$ with $\mathbf{x}(0) = ${vecTex([x0, y0])}$. Give $\mathbf{x}(t)$ as a pair of functions of $t$, typed like (2e^(3t) - e^(-t), e^(3t)).`,
      answer: `(${expSum(xT, false)}, ${expSum(yT, false)})`,
      form: "tuple",
      verify: [`${m2} p - q = ${K1} e^(${l1} t)`, `${m1} p - q = ${K2} e^(${l2} t)`],
      hint: md`Eigenvalues first: trace $${trace(A)}$, determinant $${det2(A)}$. Then an eigenvector $(1, m)$ for each. Then choose $c_1, c_2$ to match $\mathbf{x}(0)$.`,
      solution: [
        ...eigenSteps(A, md`\lambda = ${l1}, \; ${l2}`),
        { math: md`\lambda = ${l1}: \; \mathbf{v}_1 = ${vecTex([1, m1])}, \qquad \lambda = ${l2}: \; \mathbf{v}_2 = ${vecTex([1, m2])}`, note: md`From the first row of $A - \lambda I$: $${A[0]![0]! - l1} ${signed(A[0]![1]!)}m = 0$ gives $m = ${m1}$; $${A[0]![0]! - l2} ${signed(A[0]![1]!)}m = 0$ gives $m = ${m2}$.` },
        { math: md`\mathbf{x}(t) = c_1 ${expo(l1, true)}${vecTex([1, m1])} + c_2 ${expo(l2, true)}${vecTex([1, m2])}`, note: "The general solution: a combination of the two straight-line solutions." },
        { math: md`c_1 + c_2 = ${x0}, \qquad ${poly([[m1, "c_1"], [m2, "c_2"]])} = ${y0}`, note: md`Set $t = 0$ and match components.` },
        { math: md`c_1 = ${c1}, \quad c_2 = ${c2}`, note: "Solve the pair of equations." },
        { math: md`\mathbf{x}(t) = ${term(c1, l1, [1, m1])} ${c2 < 0 ? "-" : "+"} ${term(Math.abs(c2), l2, [1, m2])} = \begin{bmatrix} ${expSum(xT, true)} \\ ${expSum(yT, true)} \end{bmatrix}`, note: "Written out by components." },
      ],
    };
  }
  const a = r.int(-2, 2);
  const b = r.int(1, 3);
  const x0 = r.nonzero(-3, 3);
  const y0 = r.nonzero(-3, 3);
  const A: Mat = [
    [a, -b],
    [b, a],
  ];
  const bi = `${b === 1 ? "" : b}i`;
  const bt = b === 1 ? "t" : `${b}t`;
  const eAt = a === 0 ? "" : expo(a, true);
  return {
    prompt: md`Solve $\mathbf{x}' = ${matTex(A)}\mathbf{x}$ with $\mathbf{x}(0) = ${vecTex([x0, y0])}$. Give $\mathbf{x}(t)$ as a pair of real functions of $t$, typed like (e^(2t)(3cos(t) - sin(t)), e^(2t)(cos(t) + 3sin(t))).`,
    answer: `(${expTrig(a, x0, -y0, b, false)}, ${expTrig(a, y0, x0, b, false)})`,
    form: "tuple",
    verify: [`p cos(${b} t) + q sin(${b} t) = ${x0} e^(${a} t)`, `-p sin(${b} t) + q cos(${b} t) = ${y0} e^(${a} t)`],
    hint: md`The eigenvalues are $${a === 0 ? "" : `${a} `}\pm ${bi}$. Find a complex eigenvector for $${a === 0 ? "" : `${a} + `}${bi}$, multiply by $e^{\lambda t}$, and take real and imaginary parts to get two real solutions.`,
    solution: [
      ...eigenSteps(A, md`\lambda = \frac{${2 * a} \pm \sqrt{${4 * a * a} - ${4 * (a * a + b * b)}}}{2} = ${a === 0 ? "" : `${a} `}\pm ${bi}`),
      { math: md`(A - \lambda I)\mathbf{v} = \begin{bmatrix} -${bi} & ${-b} \\ ${b} & -${bi} \end{bmatrix}\mathbf{v} = \mathbf{0} \;\Rightarrow\; \mathbf{v} = \begin{bmatrix} 1 \\ -i \end{bmatrix}`, note: md`First row with $\mathbf{v} = (1, v_2)$: $-${bi} - ${b}v_2 = 0$, so $v_2 = -i$.` },
      { math: md`e^{\lambda t}\mathbf{v} = ${eAt}(\cos ${bt} + i\sin ${bt})\left(\begin{bmatrix} 1 \\ 0 \end{bmatrix} + i\begin{bmatrix} 0 \\ -1 \end{bmatrix}\right)`, note: md`Euler's formula, and $\mathbf{v} = \mathbf{p} + i\mathbf{q}$ with $\mathbf{p} = (1, 0)$, $\mathbf{q} = (0, -1)$.` },
      { math: md`\mathbf{x}_1 = ${eAt}\begin{bmatrix} \cos ${bt} \\ \sin ${bt} \end{bmatrix}, \qquad \mathbf{x}_2 = ${eAt}\begin{bmatrix} \sin ${bt} \\ -\cos ${bt} \end{bmatrix}`, note: md`Real part $e^{at}(\mathbf{p}\cos bt - \mathbf{q}\sin bt)$ and imaginary part $e^{at}(\mathbf{p}\sin bt + \mathbf{q}\cos bt)$.` },
      { math: md`\mathbf{x}(0) = c_1\begin{bmatrix} 1 \\ 0 \end{bmatrix} + c_2\begin{bmatrix} 0 \\ -1 \end{bmatrix} = ${vecTex([x0, y0])} \;\Rightarrow\; c_1 = ${x0}, \; c_2 = ${-y0}`, note: "Match the initial condition." },
      { math: md`\mathbf{x}(t) = \begin{bmatrix} ${expTrig(a, x0, -y0, b, true)} \\ ${expTrig(a, y0, x0, b, true)} \end{bmatrix}`, note: md`${a === 0 ? "No exponential factor: the solution goes round and round without growing or shrinking." : a < 0 ? "The factor $e^{" + (a === -1 ? "-t" : `${a}t`) + "}$ shrinks the loop each turn: a spiral inward." : "The factor $e^{" + (a === 1 ? "t" : `${a}t`) + "}$ grows the loop each turn: a spiral outward."}` },
    ],
  };
};

// ── Practice generators: Lesson 3 ───────────────────────────────────────────

const CHOICES = [...PORTRAITS];

const classifyPortrait: Generator = (r) => {
  const type = r.pick(PORTRAITS);
  const A = matrixOfType(r, type);
  const t = trace(A);
  const d = det2(A);
  const disc = t * t - 4 * d;
  const reason =
    d < 0
      ? md`$\det A < 0$, so the eigenvalues are real with opposite signs: a saddle.`
      : disc > 0
        ? md`$\det A > 0$ and $\tau^2 - 4\Delta = ${disc} > 0$: two real eigenvalues of the same sign, the sign of the trace. The trace is ${t < 0 ? "negative" : "positive"}, so the origin is a${t < 0 ? " stable" : "n unstable"} node.`
        : t === 0
          ? md`$\tau^2 - 4\Delta = ${disc} < 0$ gives complex eigenvalues, and the trace is $0$, so their real part is $0$: a center.`
          : md`$\tau^2 - 4\Delta = ${disc} < 0$ gives complex eigenvalues with real part $\tau/2 = ${fracTex(t, 2)}$, which is ${t < 0 ? "negative: a stable spiral" : "positive: an unstable spiral"}.`;
  return {
    prompt: md`Classify the equilibrium at the origin of $\mathbf{x}' = ${matTex(A)}\mathbf{x}$.`,
    choices: CHOICES,
    accept: [type],
    figure: fieldFigure(A),
    hint: md`Trace $\tau = ${t}$, determinant $\Delta = ${d}$. Is $\Delta$ negative? If not, compare $\tau^2$ with $4\Delta$, then look at the sign of $\tau$.`,
    solution: [
      { math: md`\tau = ${t}, \quad \Delta = ${d}, \quad \tau^2 - 4\Delta = ${disc}`, note: "The three numbers that decide the picture." },
      { math: md`\text{${type}}`, note: reason },
    ],
  };
};

const straightLineSolutions: Generator = (r) => {
  const { A, l1, l2, m1, m2 } = realEigen(r, "any");
  const [a, b, c, d] = [A[0]![0]!, A[0]![1]!, A[1]![0]!, A[1]![1]!];
  return {
    prompt: md`Two lines through the origin are themselves trajectories of $\mathbf{x}' = ${matTex(A)}\mathbf{x}$. Find their slopes. Type them as a comma-separated list, like 2, -1.`,
    answer: `${m1}, ${m2}`,
    form: "set",
    verify: [`${c} + ${paren(d)} x = x (${a} + ${paren(b)} x)`],
    figure: fieldFigure(A),
    hint: md`A straight-line trajectory runs along an eigenvector. Find the eigenvalues, then an eigenvector $(1, m)$ for each; $m$ is the slope.`,
    solution: [
      ...eigenSteps(A, md`\lambda = ${l1}, \; ${l2}`),
      { math: md`\lambda = ${l1}: \; ${a - l1} ${signed(b)}m = 0 \;\Rightarrow\; m = ${m1}`, note: md`First row of $(A - ${paren(l1)}I)(1, m) = \mathbf{0}$.` },
      { math: md`\lambda = ${l2}: \; ${a - l2} ${signed(b)}m = 0 \;\Rightarrow\; m = ${m2}`, note: md`Same for the other eigenvalue.` },
      { math: md`y = ${m1}x, \qquad y = ${m2}x`, note: md`On $y = ${m1}x$ solutions move ${l1 > 0 ? "away from" : "toward"} the origin ($\lambda = ${l1}$); on $y = ${m2}x$ they move ${l2 > 0 ? "away from" : "toward"} it ($\lambda = ${l2}$).` },
    ],
  };
};

const parameterBoundary: Generator = (r) => {
  const kind = r.int(0, 2);
  const a = r.nonzero(-3, 3);
  if (kind === 0) {
    const m = r.int(1, 3);
    const [b, c] = r.pick([[m, -m], [-m, m], [1, -m * m], [-1, m * m], [m * m, -1]] as [number, number][]);
    const A = [[a, b], [c, "k"]];
    return {
      prompt: md`For which values of $k$ does $\mathbf{x}' = ${matTex(A)}\mathbf{x}$ have a repeated eigenvalue? Type them as a comma-separated list.`,
      answer: `${a - 2 * m}, ${a + 2 * m}`,
      form: "set",
      verify: [`(${a} + x)^2 = 4 (${a} x - (${b * c}))`],
      hint: md`The eigenvalues are repeated when the discriminant $\tau^2 - 4\Delta$ is zero, with $\tau = ${a} + k$ and $\Delta = ${a}k ${signed(-b * c)}$.`,
      solution: [
        { math: md`\tau = ${a} + k, \qquad \Delta = ${a}k - (${b})(${c}) = ${a}k ${signed(-b * c)}`, note: "Trace and determinant, with k left in." },
        { math: md`(${a} + k)^2 - 4(${a}k ${signed(-b * c)}) = 0`, note: "Discriminant zero." },
        { math: md`(k ${signed(-a)})^2 ${signed(4 * b * c)} = 0`, note: md`Expand and regroup: $(a + k)^2 - 4ak = (k - a)^2$.` },
        { math: md`k ${signed(-a)} = \pm ${2 * m} \;\Rightarrow\; k = ${a - 2 * m}, \; ${a + 2 * m}`, note: md`Between these two values the eigenvalues are complex (spirals); outside them they are real.` },
      ],
    };
  }
  if (kind === 1) {
    let b = r.nonzero(-4, 4);
    let c = r.nonzero(-4, 4);
    while (b * c >= -(a * a)) {
      b = r.nonzero(-4, 4);
      c = r.nonzero(-4, 4);
    }
    const A = [[a, b], [c, "k"]];
    const d = -a * a - b * c;
    return {
      prompt: md`For which value of $k$ is the origin a center for $\mathbf{x}' = ${matTex(A)}\mathbf{x}$?`,
      answer: String(-a),
      verify: [`${a} + k = 0`],
      hint: md`A center needs purely imaginary eigenvalues: trace $0$ and determinant positive.`,
      solution: [
        { math: md`\tau = ${a} + k = 0 \;\Rightarrow\; k = ${-a}`, note: "Complex eigenvalues have real part τ/2, so a center forces the trace to be zero." },
        { math: md`\Delta = ${a}(${-a}) - (${b})(${c}) = ${d} > 0`, note: md`Check the determinant at that $k$: positive, so the eigenvalues really are $\pm i\sqrt{${d}}$ and not a real pair.` },
      ],
    };
  }
  const b = r.nonzero(-4, 4);
  const k = r.nonzero(-4, 4);
  const c = (a * k) / b;
  if (!Number.isInteger(c) || c === 0) return parameterBoundary(r);
  const A = [[a, b], [c, "k"]];
  return {
    prompt: md`For which value of $k$ does $\mathbf{x}' = ${matTex(A)}\mathbf{x}$ have a whole line of equilibria instead of just the origin?`,
    answer: String(k),
    verify: [`${a} k - (${b * c}) = 0`],
    hint: md`Equilibria solve $A\mathbf{x} = \mathbf{0}$. There are more than one exactly when $A$ is singular.`,
    solution: [
      { math: md`\det A = ${a}k - (${b})(${c}) = 0`, note: md`A nonzero solution of $A\mathbf{x} = \mathbf{0}$ exists exactly when $\det A = 0$ (Linear Algebra, Unit 4).` },
      { math: md`k = ${fracTex(b * c, a)} = ${k}`, note: md`Then $0$ is an eigenvalue, and every point on its eigenvector line stays put forever.` },
    ],
  };
};

// ── Practice generators: Lesson 4 ───────────────────────────────────────────

const findEquilibrium: Generator = (r) => {
  if (r.next() < 0.6) {
    const p = r.int(1, 4);
    const q = r.int(1, 4);
    let [b, c, e, f] = [r.int(1, 3), r.int(1, 3), r.int(1, 3), r.int(1, 3)];
    while (b * f === c * e) [e, f] = [r.int(1, 3), r.int(1, 3)];
    const a = b * p + c * q;
    const d = e * p + f * q;
    const fx = `x(${poly([[a, ""], [-b, "x"], [-c, "y"]])})`;
    const gy = `y(${poly([[d, ""], [-e, "x"], [-f, "y"]])})`;
    return {
      prompt: md`Two species compete: $x' = ${fx}$ and $y' = ${gy}$. Find the equilibrium at which both populations are positive. Type it as $(x, y)$.`,
      answer: `(${p}, ${q})`,
      form: "tuple",
      verify: [`${a} - ${b} p - ${c} q = 0`, `${d} - ${e} p - ${f} q = 0`],
      hint: md`With $x \ne 0$ and $y \ne 0$ the brackets must vanish: $${poly([[b, "x"], [c, "y"]])} = ${a}$ and $${poly([[e, "x"], [f, "y"]])} = ${d}$.`,
      solution: [
        { math: md`x' = 0: \; x = 0 \;\text{or}\; ${poly([[b, "x"], [c, "y"]])} = ${a}`, note: "A product is zero when a factor is zero." },
        { math: md`y' = 0: \; y = 0 \;\text{or}\; ${poly([[e, "x"], [f, "y"]])} = ${d}`, note: md`The equilibria with a zero population are $(0, 0)$, $(${frac(a, b)}, 0)$ and $(0, ${frac(d, f)})$.` },
        { math: md`${poly([[b, "x"], [c, "y"]])} = ${a}, \qquad ${poly([[e, "x"], [f, "y"]])} = ${d}`, note: "Both populations positive: both brackets zero." },
        { math: md`(x, y) = (${p}, ${q})`, note: md`Solve the linear pair (its determinant $${b * f - c * e}$ is not zero, so there is exactly one solution).` },
      ],
    };
  }
  const [a, b, c, d] = [r.int(1, 6), r.int(1, 4), r.int(1, 6), r.int(1, 4)];
  const fx = `x(${poly([[a, ""], [-b, "y"]])})`;
  const gy = `y(${poly([[d, "x"], [-c, ""]])})`;
  return {
    prompt: md`Prey $x$ and predators $y$ follow $x' = ${fx}$, $y' = ${gy}$. Find the equilibrium at which both populations are positive. Type it as $(x, y)$; fractions are fine.`,
    answer: `(${frac(c, d)}, ${frac(a, b)})`,
    form: "tuple",
    verify: [`${a} - ${b} q = 0`, `${d} p - ${c} = 0`],
    hint: md`Set both rates to zero and discard the factors $x = 0$, $y = 0$. Notice that the prey equation fixes $y$ and the predator equation fixes $x$.`,
    solution: [
      { math: md`x(${poly([[a, ""], [-b, "y"]])}) = 0 \;\Rightarrow\; y = ${fracTex(a, b)}`, note: md`With $x \ne 0$, the prey stop changing exactly when the predators number $${fracTex(a, b)}$.` },
      { math: md`y(${poly([[d, "x"], [-c, ""]])}) = 0 \;\Rightarrow\; x = ${fracTex(c, d)}`, note: md`With $y \ne 0$, the predators stop changing when the prey number $${fracTex(c, d)}$.` },
      { math: md`(x, y) = \left(${fracTex(c, d)}, ${fracTex(a, b)}\right)`, note: "The only equilibrium away from the axes." },
    ],
  };
};

type Term = "x^2" | "xy" | "y^2";
const TERMS: Term[] = ["x^2", "xy", "y^2"];
/** Partial derivatives of a quadratic monomial at (x, y). */
const dTerm = (t: Term, x: number, y: number): [number, number] => (t === "x^2" ? [2 * x, 0] : t === "xy" ? [y, x] : [0, 2 * y]);

const jacobianAt: Generator = (r) => {
  const [a, b, d, e] = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
  const [c, h] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const t1 = r.pick(TERMS);
  const t2 = r.pick(TERMS);
  const x0 = r.int(-2, 2);
  const y0 = r.int(-2, 2);
  const fTex = poly([[a, "x"], [b, "y"], [c, t1]]);
  const gTex = poly([[d, "x"], [e, "y"], [h, t2]]);
  const [f1, f2] = dTerm(t1, x0, y0);
  const [g1, g2] = dTerm(t2, x0, y0);
  const J = [[a + c * f1, b + c * f2], [d + h * g1, e + h * g2]];
  const dx = (t: Term) => (t === "x^2" ? "2x" : t === "xy" ? "y" : "0");
  const dy = (t: Term) => (t === "x^2" ? "0" : t === "xy" ? "x" : "2y");
  const generalJ = matTex([[poly([[a, ""], [c, dx(t1)]]), poly([[b, ""], [c, dy(t1)]])], [poly([[d, ""], [h, dx(t2)]]), poly([[e, ""], [h, dy(t2)]])]]);
  return {
    prompt: md`Find the Jacobian matrix of the system $x' = ${fTex}$, $y' = ${gTex}$ at the point $(${x0}, ${y0})$. Type it like [[1, 2], [3, 4]].`,
    answer: matAns(J),
    form: "matrix",
    hint: md`$J = \begin{bmatrix} f_x & f_y \\ g_x & g_y \end{bmatrix}$ where $f$ is the right side of $x'$ and $g$ the right side of $y'$. Differentiate first, then substitute the point.`,
    solution: [
      { math: md`J(x, y) = ${generalJ}`, note: md`Row 1: partials of $f = ${fTex}$. Row 2: partials of $g = ${gTex}$.` },
      { math: md`J(${x0}, ${y0}) = ${matTex(J)}`, note: md`Substitute $x = ${x0}$, $y = ${y0}$.` },
    ],
  };
};

const NONLINEAR_CHOICES = [...PORTRAITS, "cannot tell from the linearization"];

const classifyNonlinear: Generator = (r) => {
  if (r.next() < 0.6) {
    const type = r.pick(PORTRAITS);
    const J = matrixOfType(r, type);
    const [a, b, c, d] = [J[0]![0]!, J[0]![1]!, J[1]![0]!, J[1]![1]!];
    const k1 = r.nonzero(-2, 2);
    const k2 = r.nonzero(-2, 2);
    const t1 = r.pick(TERMS);
    const t2 = r.pick(TERMS);
    const fTex = poly([[a, "x"], [b, "y"], [k1, t1]]);
    const gTex = poly([[c, "x"], [d, "y"], [k2, t2]]);
    const right = type === "center" ? "cannot tell from the linearization" : type;
    const t = trace(J);
    const dd = det2(J);
    return {
      prompt: md`The system $x' = ${fTex}$, $y' = ${gTex}$ has an equilibrium at the origin $(0, 0)$. Linearize there. What does the linearization tell you about that equilibrium?`,
      choices: NONLINEAR_CHOICES,
      accept: [right],
      figure: {
        kind: "plot",
        x: [-2, 2],
        y: [-2, 2],
        field: { dx: fTex, dy: gTex },
        caption: md`The direction field of the nonlinear system near the origin.`,
      },
      hint: md`The quadratic terms have zero derivatives at the origin, so the Jacobian there is just the matrix of the linear terms. Classify it by trace and determinant, then remember which case the linearization cannot decide.`,
      solution: [
        { math: md`J(0, 0) = ${matTex(J)}`, note: md`The partials of $${t1}$ and $${t2}$ vanish at $(0, 0)$. Only the linear coefficients survive.` },
        { math: md`\tau = ${t}, \quad \Delta = ${dd}, \quad \tau^2 - 4\Delta = ${t * t - 4 * dd}`, note: "Classify the linear system." },
        { math: md`\text{${right}}`, note: type === "center" ? md`The linearization is a center: eigenvalues $\pm i\sqrt{${dd}}$ with real part $0$. That is the borderline case, and the dropped quadratic terms can turn it into a spiral either way. Linearization alone cannot decide.` : md`The linearization is a${type.startsWith("u") ? "n" : ""} ${type}. Its eigenvalues have nonzero real part, so the nonlinear equilibrium is the same type.` },
      ],
    };
  }
  const p = r.int(1, 3);
  const q = r.int(1, 3);
  let [b, c, e, f] = [r.int(1, 3), r.int(1, 3), r.int(1, 3), r.int(1, 3)];
  while (b * f === c * e) [e, f] = [r.int(1, 3), r.int(1, 3)];
  const a = b * p + c * q;
  const d = e * p + f * q;
  const fTex = `x(${poly([[a, ""], [-b, "x"], [-c, "y"]])})`;
  const gTex = `y(${poly([[d, ""], [-e, "x"], [-f, "y"]])})`;
  const J = [[-b * p, -c * p], [-e * q, -f * q]];
  const right: Portrait = b * f < c * e ? "saddle" : "stable node";
  const t = trace(J);
  const dd = det2(J);
  return {
    prompt: md`The competing species $x' = ${fTex}$, $y' = ${gTex}$ have an equilibrium at $(${p}, ${q})$ with both species present. Linearize there and classify it.`,
    choices: NONLINEAR_CHOICES,
    accept: [right],
    figure: {
      kind: "plot",
      x: [0, Math.max(a / b, d / e) + 0.5],
      y: [0, Math.max(a / c, d / f) + 0.5],
      field: { dx: fTex, dy: gTex },
      points: [{ x: p, y: q, label: md`(${p}, ${q})`, color: 2 }],
      caption: md`The direction field of the competing-species model, with the coexistence equilibrium marked.`,
    },
    hint: md`$f_x = ${a} - ${2 * b}x - ${c}y$, $f_y = -${c}x$, $g_x = -${e}y$, $g_y = ${d} - ${e}x - ${2 * f}y$. At the equilibrium the brackets are zero, which simplifies the diagonal entries a lot.`,
    solution: [
      { math: md`J(x, y) = \begin{bmatrix} ${a} - ${2 * b}x - ${c}y & -${c}x \\ -${e}y & ${d} - ${e}x - ${2 * f}y \end{bmatrix}`, note: md`Partials of $f = ${fTex}$ and $g = ${gTex}$ (product rule).` },
      { math: md`J(${p}, ${q}) = ${matTex(J)}`, note: md`At the equilibrium $${a} - ${b}(${p}) - ${c}(${q}) = 0$, so $f_x = -${b}x = ${-b * p}$; likewise $g_y = -${f}y = ${-f * q}$.` },
      { math: md`\tau = ${t}, \quad \Delta = ${dd}`, note: md`$\Delta = ${p * q}\,(${b} \cdot ${f} - ${c} \cdot ${e})$ is ${dd < 0 ? "negative" : "positive"}.` },
      { math: md`\text{${right}}`, note: right === "saddle" ? md`A saddle: coexistence is unstable. Almost every starting point drifts away to one species winning (competitive exclusion).` : md`The trace is negative and $\tau^2 - 4\Delta = ${t * t - 4 * dd} > 0$, so both eigenvalues are real and negative: a stable node. The two species settle into coexistence at $(${p}, ${q})$.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit5: Unit = {
  title: "Systems of Equations",
  lessons: [
    {
      id: slug("Systems as matrices"),
      title: "Systems as matrices",
      summary: "Writing coupled equations as x' = Ax, turning higher-order equations into systems, and checking vector solutions.",
      blocks: [
        {
          kind: "text",
          body: md`Units 1 to 4 handled one unknown function at a time. Many situations have two or more quantities whose rates depend on each other. Two tanks of brine joined by pipes: the salt in each tank changes at a rate that depends on the salt in the other. Rabbits and foxes: each population's growth depends on the other. A spring: position drives velocity and velocity drives position.

Here is the simplest kind of example:

$$x' = x + 2y, \qquad y' = 3x.$$

You cannot solve the first equation on its own, because it contains $y$, and you cannot solve the second on its own, because it contains $x$. The two have to be solved together. That is a **system** of differential equations.`,
        },
        {
          kind: "key",
          title: "First-order linear system",
          body: md`A **first-order linear system with constant coefficients** has the form

$$x_1' = a_{11} x_1 + a_{12} x_2, \qquad x_2' = a_{21} x_1 + a_{22} x_2.$$

Collect the unknowns into a vector and the coefficients into a matrix:

$$\mathbf{x}' = A\mathbf{x}, \qquad \mathbf{x}(t) = \begin{bmatrix} x_1(t) \\ x_2(t) \end{bmatrix}, \qquad A = \begin{bmatrix} a_{11} & a_{12} \\ a_{21} & a_{22} \end{bmatrix}.$$

The derivative of a vector function is taken one component at a time. The system is **homogeneous** because nothing is added that doesn't involve $\mathbf{x}$. This unit works with $n = 2$ unless it says otherwise, but every idea carries over to any size.`,
        },
        {
          kind: "why",
          title: "Why a matrix is the right way to write it",
          body: md`Look at what the right-hand side does. It takes the current values $x_1, x_2$ and forms two linear combinations of them. Forming linear combinations of the entries of a vector is exactly what multiplying by a matrix does (Linear Algebra, Unit 3). So the two equations are really one equation about one object, the vector $\mathbf{x}$, and the matrix $A$ carries all the coefficients.

The payoff is large. Everything we know about matrices, above all eigenvalues, becomes a tool for solving differential equations. The example above is $\mathbf{x}' = \begin{bmatrix} 1 & 2 \\ 3 & 0 \end{bmatrix}\mathbf{x}$.`,
        },
        {
          kind: "text",
          body: md`Systems also arise from single equations of higher order. Unit 3 solved $y'' + py' + qy = 0$ directly. There is another way to look at it: introduce the velocity as a second unknown. Let $x_1 = y$ and $x_2 = y'$. Then the one second-order equation becomes two first-order equations.`,
        },
        {
          kind: "why",
          title: "Why a second-order equation is a 2 × 2 system",
          body: md`With $x_1 = y$ and $x_2 = y'$:

- $x_1' = y' = x_2$. That's the definition of $x_2$.
- $x_2' = y'' = -qy - py' = -q x_1 - p x_2$. That's the original equation, solved for $y''$.

So

$$\begin{bmatrix} x_1 \\ x_2 \end{bmatrix}' = \begin{bmatrix} 0 & 1 \\ -q & -p \end{bmatrix}\begin{bmatrix} x_1 \\ x_2 \end{bmatrix}.$$

Nothing was lost: a solution $y$ of the old equation gives the vector $(y, y')$ solving the new one, and the first component of any solution of the new system solves the old equation. Notice the characteristic polynomial of this matrix: $\det(A - \lambda I) = \lambda(\lambda + p) + q = \lambda^2 + p\lambda + q$. It is exactly the characteristic equation from Unit 3. That is no coincidence, and Lesson 2 explains why.`,
        },
        {
          kind: "example",
          title: "Reducing y'' + 3y' + 2y = 0",
          problem: md`Write $y'' + 3y' + 2y = 0$ as a first-order system.`,
          steps: [
            { math: md`x_1 = y, \qquad x_2 = y'`, note: "Name the position and the velocity." },
            { math: md`x_1' = x_2`, note: "The derivative of position is velocity." },
            { math: md`x_2' = y'' = -3y' - 2y = -2x_1 - 3x_2`, note: md`Solve the equation for $y''$ and rename.` },
            { math: md`\mathbf{x}' = \begin{bmatrix} 0 & 1 \\ -2 & -3 \end{bmatrix}\mathbf{x}`, note: md`The solutions of the original equation were $e^{-t}$ and $e^{-2t}$. Keep that in mind: $-1$ and $-2$ are the eigenvalues of this matrix.` },
          ],
        },
        {
          kind: "key",
          title: "Solutions, and how to check one",
          body: md`A **solution** of $\mathbf{x}' = A\mathbf{x}$ is a vector function $\mathbf{x}(t)$ that makes both sides equal for every $t$. To check a candidate:

- differentiate each component to get $\mathbf{x}'$,
- multiply the matrix by the candidate to get $A\mathbf{x}$,
- compare, component by component.

A **general solution** contains enough constants to match any starting vector $\mathbf{x}(0)$. For a $2 \times 2$ system that is two constants. Fixing them from $\mathbf{x}(0) = \mathbf{x}_0$ is an **initial value problem**.`,
        },
        {
          kind: "example",
          title: "Checking a vector solution",
          problem: md`Show that $\mathbf{x}(t) = e^{3t}\begin{bmatrix} 1 \\ 1 \end{bmatrix}$ solves $\mathbf{x}' = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}\mathbf{x}$.`,
          steps: [
            { math: md`\mathbf{x}' = 3e^{3t}\begin{bmatrix} 1 \\ 1 \end{bmatrix} = \begin{bmatrix} 3e^{3t} \\ 3e^{3t} \end{bmatrix}`, note: "Differentiate each component. The constant vector just rides along." },
            { math: md`A\mathbf{x} = e^{3t}\begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}\begin{bmatrix} 1 \\ 1 \end{bmatrix} = e^{3t}\begin{bmatrix} 3 \\ 3 \end{bmatrix}`, note: md`The scalar $e^{3t}$ can be pulled out in front of the matrix product.` },
            { math: md`\mathbf{x}' = A\mathbf{x} \; \checkmark`, note: md`Both are $(3e^{3t}, 3e^{3t})$. The same check shows $e^{t}(1, -1)$ is a solution too: $A(1, -1) = (1, -1)$.` },
          ],
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-3, 3],
          field: { dx: "2x + y", dy: "x + 2y" },
          curves: [
            { expr: "x", dashed: true, color: 2 },
            { expr: "-x", dashed: true, color: 3 },
          ],
          parametric: [
            { x: "0.1e^(3t) + 2e^t", y: "0.1e^(3t) - 2e^t", t: [-3, 0.55], color: 4 },
            { x: "-0.1e^(3t) - 2e^t", y: "-0.1e^(3t) + 2e^t", t: [-3, 0.55], color: 4 },
            { x: "0.1e^(3t) - 2e^t", y: "0.1e^(3t) + 2e^t", t: [-3, 0.55], color: 4 },
            { x: "-0.1e^(3t) + 2e^t", y: "-0.1e^(3t) - 2e^t", t: [-3, 0.55], color: 4 },
          ],
          caption: md`The system $\mathbf{x}' = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}\mathbf{x}$ drawn in the plane of $(x_1, x_2)$. Each arrow shows the direction of $\mathbf{x}'$ at that point. A solution is a curve that follows the arrows. Along the dashed line $y = x$ the arrows point straight out: that is the solution $e^{3t}(1, 1)$. Along $y = -x$ they also point out, more slowly: the solution $e^{t}(1, -1)$. The red curves are combinations of the two; they start near the slow line and bend toward the fast one.`,
        },
        {
          kind: "proof",
          title: "Superposition for systems",
          given: md`$\mathbf{x}_1(t)$ and $\mathbf{x}_2(t)$ both solve $\mathbf{x}' = A\mathbf{x}$; $c_1, c_2$ are constants`,
          prove: md`$\mathbf{x} = c_1\mathbf{x}_1 + c_2\mathbf{x}_2$ also solves $\mathbf{x}' = A\mathbf{x}$`,
          steps: [
            { statement: md`$\mathbf{x}' = c_1\mathbf{x}_1' + c_2\mathbf{x}_2'$`, reason: "The derivative is taken component by component, and the derivative of a sum of multiples is the sum of multiples of the derivatives" },
            { statement: md`$\mathbf{x}' = c_1 A\mathbf{x}_1 + c_2 A\mathbf{x}_2$`, reason: md`$\mathbf{x}_1' = A\mathbf{x}_1$ and $\mathbf{x}_2' = A\mathbf{x}_2$ (given)` },
            { statement: md`$\mathbf{x}' = A(c_1\mathbf{x}_1 + c_2\mathbf{x}_2) = A\mathbf{x}$`, reason: md`Matrix multiplication is linear: $A(c\mathbf{u} + d\mathbf{v}) = cA\mathbf{u} + dA\mathbf{v}$` },
          ],
        },
        {
          kind: "text",
          body: md`Superposition is why two solutions are enough for a $2 \times 2$ system. If $\mathbf{x}_1$ and $\mathbf{x}_2$ are solutions that aren't multiples of each other, then $c_1\mathbf{x}_1 + c_2\mathbf{x}_2$ is a solution for every choice of constants, and the two constants can be chosen to hit any starting vector. For the matrix above, that gives

$$\mathbf{x}(t) = c_1 e^{3t}\begin{bmatrix} 1 \\ 1 \end{bmatrix} + c_2 e^{t}\begin{bmatrix} 1 \\ -1 \end{bmatrix}.$$`,
        },
        {
          kind: "example",
          title: "Fitting the constants to a starting point",
          problem: md`Find the solution of $\mathbf{x}' = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}\mathbf{x}$ with $\mathbf{x}(0) = \begin{bmatrix} 5 \\ 1 \end{bmatrix}$.`,
          steps: [
            { math: md`\mathbf{x}(0) = c_1\begin{bmatrix} 1 \\ 1 \end{bmatrix} + c_2\begin{bmatrix} 1 \\ -1 \end{bmatrix} = \begin{bmatrix} 5 \\ 1 \end{bmatrix}`, note: md`Set $t = 0$ in the general solution; both exponentials become $1$.` },
            { math: md`c_1 + c_2 = 5, \qquad c_1 - c_2 = 1`, note: "Two components, two equations." },
            { math: md`c_1 = 3, \qquad c_2 = 2`, note: "Add the equations to get $2c_1 = 6$." },
            { math: md`\mathbf{x}(t) = 3e^{3t}\begin{bmatrix} 1 \\ 1 \end{bmatrix} + 2e^{t}\begin{bmatrix} 1 \\ -1 \end{bmatrix} = \begin{bmatrix} 3e^{3t} + 2e^{t} \\ 3e^{3t} - 2e^{t} \end{bmatrix}`, note: "The one solution through (5, 1)." },
          ],
        },
        {
          kind: "check",
          prompt: md`Write $y'' - 4y' + 5y = 0$ as a system $\mathbf{x}' = A\mathbf{x}$ with $x_1 = y$, $x_2 = y'$. Give $A$, typed like [[0, 1], [2, 3]].`,
          answer: "[[0, 1], [-5, 4]]",
          form: "matrix",
          explain: md`$x_1' = x_2$, and $x_2' = y'' = 4y' - 5y = -5x_1 + 4x_2$. Watch the signs: moving the terms across the equals sign flips them.`,
        },
        {
          kind: "check",
          prompt: md`For which value of $k$ is $\mathbf{x}(t) = e^{kt}\begin{bmatrix} 1 \\ -1 \end{bmatrix}$ a solution of $\mathbf{x}' = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}\mathbf{x}$?`,
          answer: "1",
          explain: md`$\mathbf{x}' = ke^{kt}(1, -1)$ while $A\mathbf{x} = e^{kt}(2 - 1, 1 - 2) = e^{kt}(1, -1)$. They match exactly when $k = 1$.`,
        },
      ],
      practice: [matrixForm, solutionCheck, fitConstants],
    },
    {
      id: slug("The eigenvalue method"),
      title: "The eigenvalue method",
      summary: "Why e^(λt)v solves x' = Ax, and how real, complex and repeated eigenvalues each give the general solution.",
      blocks: [
        {
          kind: "text",
          body: md`In Unit 3 we guessed $y = e^{rt}$ because the exponential is the one function whose derivative is a constant multiple of itself. A system needs the same idea with one addition: a direction. Guess

$$\mathbf{x}(t) = e^{\lambda t}\mathbf{v},$$

a fixed vector $\mathbf{v}$ whose length grows or shrinks exponentially. Lesson 1 already found two of these for one matrix. Now we find them for any matrix.`,
        },
        {
          kind: "why",
          title: "Why try e^(λt) v",
          body: md`Substitute the guess into $\mathbf{x}' = A\mathbf{x}$. On the left, the vector is constant, so

$$\mathbf{x}' = \lambda e^{\lambda t}\mathbf{v}.$$

On the right, the scalar $e^{\lambda t}$ comes out in front:

$$A\mathbf{x} = e^{\lambda t}A\mathbf{v}.$$

Divide both sides by $e^{\lambda t}$, which is never zero:

$$A\mathbf{v} = \lambda\mathbf{v}.$$

The guess works exactly when $\mathbf{v}$ is an eigenvector of $A$ with eigenvalue $\lambda$ (Linear Algebra, Unit 7). Every eigenpair hands us a solution, and the differential equation has turned into pure algebra.`,
        },
        {
          kind: "key",
          title: "The eigenvalue method",
          body: md`To solve $\mathbf{x}' = A\mathbf{x}$:

1. Find the eigenvalues from $\det(A - \lambda I) = 0$. For a $2 \times 2$ matrix that is $\lambda^2 - (\text{trace}\,A)\lambda + \det A = 0$.
2. For each eigenvalue find an eigenvector $\mathbf{v}$, a nonzero solution of $(A - \lambda I)\mathbf{v} = \mathbf{0}$.
3. Each pair gives a solution $e^{\lambda t}\mathbf{v}$. With **real, distinct** eigenvalues $\lambda_1 \ne \lambda_2$, the general solution is

$$\mathbf{x}(t) = c_1 e^{\lambda_1 t}\mathbf{v}_1 + c_2 e^{\lambda_2 t}\mathbf{v}_2.$$

Complex and repeated eigenvalues need one more step each, below.`,
        },
        {
          kind: "proof",
          title: "Distinct eigenvalues give independent eigenvectors",
          given: md`$A\mathbf{v}_1 = \lambda_1\mathbf{v}_1$, $A\mathbf{v}_2 = \lambda_2\mathbf{v}_2$, with $\lambda_1 \ne \lambda_2$ and $\mathbf{v}_1, \mathbf{v}_2 \ne \mathbf{0}$`,
          prove: md`$\mathbf{v}_1$ and $\mathbf{v}_2$ are linearly independent, so $c_1 e^{\lambda_1 t}\mathbf{v}_1 + c_2 e^{\lambda_2 t}\mathbf{v}_2$ can match any $\mathbf{x}(0)$`,
          steps: [
            { statement: md`Suppose $a\mathbf{v}_1 + b\mathbf{v}_2 = \mathbf{0}$`, reason: "We'll show a = b = 0 is forced" },
            { statement: md`$a\lambda_1\mathbf{v}_1 + b\lambda_2\mathbf{v}_2 = \mathbf{0}$`, reason: md`Multiply the equation by $A$ and use $A\mathbf{v}_i = \lambda_i\mathbf{v}_i$` },
            { statement: md`$b(\lambda_2 - \lambda_1)\mathbf{v}_2 = \mathbf{0}$`, reason: md`Subtract $\lambda_1$ times the first equation from the second` },
            { statement: md`$b = 0$, and then $a = 0$`, reason: md`$\lambda_2 - \lambda_1 \ne 0$ and $\mathbf{v}_2 \ne \mathbf{0}$ force $b = 0$; then $a\mathbf{v}_1 = \mathbf{0}$ with $\mathbf{v}_1 \ne \mathbf{0}$ forces $a = 0$` },
            { statement: md`$\det\begin{bmatrix} \mathbf{v}_1 & \mathbf{v}_2 \end{bmatrix} \ne 0$`, reason: "Independent columns make an invertible matrix (Linear Algebra, Unit 4)" },
            { statement: md`$c_1\mathbf{v}_1 + c_2\mathbf{v}_2 = \mathbf{x}_0$ has exactly one solution $(c_1, c_2)$ for every $\mathbf{x}_0$`, reason: md`That system's matrix is $\begin{bmatrix} \mathbf{v}_1 & \mathbf{v}_2 \end{bmatrix}$, which is invertible; at $t = 0$ the exponentials are $1$` },
          ],
        },
        {
          kind: "text",
          body: md`The determinant in the proof, with the exponentials kept in, is the **Wronskian** of the two solutions: $W(t) = \det\begin{bmatrix} e^{\lambda_1 t}\mathbf{v}_1 & e^{\lambda_2 t}\mathbf{v}_2 \end{bmatrix} = e^{(\lambda_1 + \lambda_2)t}\det\begin{bmatrix} \mathbf{v}_1 & \mathbf{v}_2 \end{bmatrix}$. It is never zero, which is the systems version of the independence test from Unit 3.`,
        },
        {
          kind: "example",
          title: "Real distinct eigenvalues, start to finish",
          problem: md`Solve $\mathbf{x}' = \begin{bmatrix} 4 & 1 \\ 2 & 3 \end{bmatrix}\mathbf{x}$ with $\mathbf{x}(0) = \begin{bmatrix} 3 \\ 0 \end{bmatrix}$.`,
          steps: [
            { math: md`\lambda^2 - 7\lambda + 10 = 0 \;\Rightarrow\; (\lambda - 2)(\lambda - 5) = 0`, note: md`Trace $7$, determinant $12 - 2 = 10$.` },
            { math: md`\lambda = 5: \; \begin{bmatrix} -1 & 1 \\ 2 & -2 \end{bmatrix}\mathbf{v} = \mathbf{0} \;\Rightarrow\; \mathbf{v}_1 = \begin{bmatrix} 1 \\ 1 \end{bmatrix}`, note: md`$A - 5I$. The first row says $-v_1 + v_2 = 0$. The second row says the same thing twice over, as it must.` },
            { math: md`\lambda = 2: \; \begin{bmatrix} 2 & 1 \\ 2 & 1 \end{bmatrix}\mathbf{v} = \mathbf{0} \;\Rightarrow\; \mathbf{v}_2 = \begin{bmatrix} 1 \\ -2 \end{bmatrix}`, note: md`$2v_1 + v_2 = 0$.` },
            { math: md`\mathbf{x}(t) = c_1 e^{5t}\begin{bmatrix} 1 \\ 1 \end{bmatrix} + c_2 e^{2t}\begin{bmatrix} 1 \\ -2 \end{bmatrix}`, note: "The general solution." },
            { math: md`c_1 + c_2 = 3, \quad c_1 - 2c_2 = 0 \;\Rightarrow\; c_2 = 1, \; c_1 = 2`, note: md`$\mathbf{x}(0) = (3, 0)$.` },
            { math: md`\mathbf{x}(t) = \begin{bmatrix} 2e^{5t} + e^{2t} \\ 2e^{5t} - 2e^{2t} \end{bmatrix}`, note: md`Check at $t = 0$: $(3, 0)$.` },
          ],
        },
        {
          kind: "text",
          body: md`**Complex eigenvalues.** The characteristic equation is a quadratic, so its roots may be a complex pair $a \pm bi$. The eigenvectors are complex too, and $e^{\lambda t}\mathbf{v}$ still solves the system; the algebra in the why box above never assumed anything was real. But we want real solutions, since the system is real.`,
        },
        {
          kind: "why",
          title: "Why complex eigenvalues give sines and cosines",
          body: md`Take $\lambda = a + bi$ with eigenvector $\mathbf{v} = \mathbf{p} + i\mathbf{q}$, where $\mathbf{p}$ and $\mathbf{q}$ are real vectors. Euler's formula (Unit 3) gives $e^{\lambda t} = e^{at}(\cos bt + i\sin bt)$. Multiply out:

$$e^{\lambda t}\mathbf{v} = e^{at}\big(\mathbf{p}\cos bt - \mathbf{q}\sin bt\big) + i\,e^{at}\big(\mathbf{p}\sin bt + \mathbf{q}\cos bt\big).$$

Call the real part $\mathbf{x}_1(t)$ and the imaginary part $\mathbf{x}_2(t)$. Each solves the system on its own. Here is why: $\mathbf{x}_1 + i\mathbf{x}_2$ satisfies $(\mathbf{x}_1 + i\mathbf{x}_2)' = A(\mathbf{x}_1 + i\mathbf{x}_2)$. Since $A$ is real, the real parts of both sides are $\mathbf{x}_1' $ and $A\mathbf{x}_1$, and the imaginary parts are $\mathbf{x}_2'$ and $A\mathbf{x}_2$. Equal complex vectors have equal real parts and equal imaginary parts.

So the general solution is $c_1\mathbf{x}_1 + c_2\mathbf{x}_2$. The conjugate eigenvalue $a - bi$ gives the same two functions (with a sign on $\mathbf{x}_2$), so one eigenvalue of the pair is all you need to work with.`,
        },
        {
          kind: "example",
          title: "A complex pair",
          problem: md`Find the general solution of $\mathbf{x}' = \begin{bmatrix} 1 & -2 \\ 2 & 1 \end{bmatrix}\mathbf{x}$.`,
          steps: [
            { math: md`\lambda^2 - 2\lambda + 5 = 0 \;\Rightarrow\; \lambda = \frac{2 \pm \sqrt{4 - 20}}{2} = 1 \pm 2i`, note: md`Trace $2$, determinant $1 + 4 = 5$.` },
            { math: md`\lambda = 1 + 2i: \; \begin{bmatrix} -2i & -2 \\ 2 & -2i \end{bmatrix}\mathbf{v} = \mathbf{0}`, note: md`$A - (1 + 2i)I$. Use the first row with $\mathbf{v} = (1, v_2)$.` },
            { math: md`-2i - 2v_2 = 0 \;\Rightarrow\; v_2 = -i, \qquad \mathbf{v} = \begin{bmatrix} 1 \\ 0 \end{bmatrix} + i\begin{bmatrix} 0 \\ -1 \end{bmatrix}`, note: md`So $\mathbf{p} = (1, 0)$ and $\mathbf{q} = (0, -1)$.` },
            { math: md`\mathbf{x}_1 = e^{t}\begin{bmatrix} \cos 2t \\ \sin 2t \end{bmatrix}, \qquad \mathbf{x}_2 = e^{t}\begin{bmatrix} \sin 2t \\ -\cos 2t \end{bmatrix}`, note: md`$\mathbf{p}\cos 2t - \mathbf{q}\sin 2t = (\cos 2t, \sin 2t)$ and $\mathbf{p}\sin 2t + \mathbf{q}\cos 2t = (\sin 2t, -\cos 2t)$.` },
            { math: md`\mathbf{x}(t) = e^{t}\left(c_1\begin{bmatrix} \cos 2t \\ \sin 2t \end{bmatrix} + c_2\begin{bmatrix} \sin 2t \\ -\cos 2t \end{bmatrix}\right)`, note: md`The point goes round the origin with angular speed $2$ while $e^{t}$ pushes it outward: a spiral.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 8],
          y: [-4, 4],
          curves: [
            { expr: "e^(a x) cos(b x)", label: "x_1(t) = e^{at}\\cos bt", color: 1 },
            { expr: "e^(a x)", label: "e^{at}", color: 2, dashed: true },
            { expr: "-e^(a x)", color: 2, dashed: true },
          ],
          params: [
            { name: "a", tex: "a", min: -1, max: 0.5, step: 0.1, value: -0.3 },
            { name: "b", tex: "b", min: 0.5, max: 4, step: 0.5, value: 2 },
          ],
          caption: md`One component of a complex-eigenvalue solution, plotted against $t$ (the horizontal axis). The real part $a$ sets the envelope $\pm e^{at}$; the imaginary part $b$ sets how fast it oscillates. Negative $a$: decaying oscillation. Positive $a$: growing. $a = 0$: a pure wave that never dies out.`,
        },
        {
          kind: "text",
          body: md`**Repeated eigenvalues.** When the characteristic equation has a double root $\lambda$, there are two possibilities. If $A = \lambda I$, every vector is an eigenvector and $e^{\lambda t}\mathbf{v}$ works for every $\mathbf{v}$: done. Otherwise there is only one line of eigenvectors, so the method hands us one solution $e^{\lambda t}\mathbf{v}$ and we need a second.`,
        },
        {
          kind: "why",
          title: "Why t e^(λt) appears again",
          body: md`Unit 3 met this: a repeated root $r$ gave $e^{rt}$ and $te^{rt}$. Try the same shape here, with a correction vector $\mathbf{w}$ to be found:

$$\mathbf{x} = te^{\lambda t}\mathbf{v} + e^{\lambda t}\mathbf{w}.$$

Differentiate (product rule on the first term):

$$\mathbf{x}' = e^{\lambda t}\mathbf{v} + \lambda te^{\lambda t}\mathbf{v} + \lambda e^{\lambda t}\mathbf{w}.$$

And $A\mathbf{x} = te^{\lambda t}A\mathbf{v} + e^{\lambda t}A\mathbf{w} = \lambda te^{\lambda t}\mathbf{v} + e^{\lambda t}A\mathbf{w}$, using $A\mathbf{v} = \lambda\mathbf{v}$. The $te^{\lambda t}$ terms already agree. Matching the $e^{\lambda t}$ terms:

$$\mathbf{v} + \lambda\mathbf{w} = A\mathbf{w}, \qquad\text{that is}\qquad (A - \lambda I)\mathbf{w} = \mathbf{v}.$$

So $\mathbf{w}$ is any vector that $A - \lambda I$ sends onto the eigenvector. Such a $\mathbf{w}$ always exists: for a $2 \times 2$ matrix with a double eigenvalue, $(A - \lambda I)^2 = 0$ (its characteristic polynomial is $(\lambda - \lambda)^2$, and a matrix satisfies its own characteristic equation), so $A - \lambda I$ sends every vector into the eigenvector line. In practice: pick any $\mathbf{w}$ with $(A - \lambda I)\mathbf{w} \ne \mathbf{0}$ and *define* $\mathbf{v}$ to be that result.`,
        },
        {
          kind: "example",
          title: "A double eigenvalue",
          problem: md`Find the general solution of $\mathbf{x}' = \begin{bmatrix} 3 & 1 \\ -1 & 1 \end{bmatrix}\mathbf{x}$.`,
          steps: [
            { math: md`\lambda^2 - 4\lambda + 4 = (\lambda - 2)^2 = 0 \;\Rightarrow\; \lambda = 2`, note: md`Trace $4$, determinant $3 + 1 = 4$. One eigenvalue, twice.` },
            { math: md`A - 2I = \begin{bmatrix} 1 & 1 \\ -1 & -1 \end{bmatrix} \;\Rightarrow\; \mathbf{v} = \begin{bmatrix} 1 \\ -1 \end{bmatrix}`, note: md`Only one eigenvector line: $v_1 + v_2 = 0$. The first solution is $e^{2t}(1, -1)$.` },
            { math: md`(A - 2I)\mathbf{w} = \mathbf{v}: \quad w_1 + w_2 = 1 \;\Rightarrow\; \mathbf{w} = \begin{bmatrix} 1 \\ 0 \end{bmatrix}`, note: md`Any solution will do; $(1, 0)$ is the simplest.` },
            { math: md`\mathbf{x}(t) = c_1 e^{2t}\begin{bmatrix} 1 \\ -1 \end{bmatrix} + c_2\left(te^{2t}\begin{bmatrix} 1 \\ -1 \end{bmatrix} + e^{2t}\begin{bmatrix} 1 \\ 0 \end{bmatrix}\right)`, note: md`Check the $t = 0$ vectors: $(1, -1)$ and $(1, 0)$ are independent, so any $\mathbf{x}(0)$ can be matched.` },
          ],
        },
        {
          kind: "key",
          title: "The three cases for a 2 × 2 system",
          body: md`- **Real, distinct** $\lambda_1 \ne \lambda_2$: $\;\mathbf{x} = c_1 e^{\lambda_1 t}\mathbf{v}_1 + c_2 e^{\lambda_2 t}\mathbf{v}_2$.
- **Complex** $a \pm bi$ with eigenvector $\mathbf{p} + i\mathbf{q}$: $\;\mathbf{x} = c_1 e^{at}(\mathbf{p}\cos bt - \mathbf{q}\sin bt) + c_2 e^{at}(\mathbf{p}\sin bt + \mathbf{q}\cos bt)$.
- **Repeated** $\lambda$ with one eigenvector $\mathbf{v}$ and $(A - \lambda I)\mathbf{w} = \mathbf{v}$: $\;\mathbf{x} = c_1 e^{\lambda t}\mathbf{v} + c_2(te^{\lambda t}\mathbf{v} + e^{\lambda t}\mathbf{w})$.

Compare with Unit 3: $e^{r_1 t}, e^{r_2 t}$; $e^{at}\cos bt, e^{at}\sin bt$; $e^{rt}, te^{rt}$. The same three cases, now with directions attached.`,
        },
        {
          kind: "check",
          prompt: md`Find the eigenvalues of $A = \begin{bmatrix} 2 & 3 \\ 1 & 4 \end{bmatrix}$. Type them as a comma-separated list.`,
          answer: "1, 5",
          form: "set",
          explain: md`Trace $6$, determinant $8 - 3 = 5$: $\lambda^2 - 6\lambda + 5 = (\lambda - 1)(\lambda - 5) = 0$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\mathbf{x}' = \begin{bmatrix} 1 & 1 \\ 4 & 1 \end{bmatrix}\mathbf{x}$ with $\mathbf{x}(0) = \begin{bmatrix} 1 \\ 2 \end{bmatrix}$. Type $\mathbf{x}(t)$ as a pair, like (e^(3t), 2e^(3t)).`,
          answer: "(e^(3t), 2e^(3t))",
          form: "tuple",
          explain: md`$\lambda^2 - 2\lambda - 3 = 0$ gives $\lambda = 3, -1$ with eigenvectors $(1, 2)$ and $(1, -2)$. The starting vector $(1, 2)$ is already the first eigenvector, so $c_1 = 1$, $c_2 = 0$ and $\mathbf{x}(t) = e^{3t}(1, 2)$: a straight-line solution.`,
        },
      ],
      practice: [findEigenvalues, findEigenvector, solveSystemIvp],
    },
    {
      id: slug("Phase portraits"),
      title: "Phase portraits",
      summary: "Drawing every solution at once in the phase plane, and reading the picture off the eigenvalues: nodes, saddles, spirals and centers.",
      blocks: [
        {
          kind: "text",
          body: md`A solution of a $2 \times 2$ system is two functions, $x_1(t)$ and $x_2(t)$. Instead of graphing each against $t$, plot the point $(x_1, x_2)$ and watch it move as $t$ runs. The path it traces is a **trajectory**, and the plane it lives in is the **phase plane**. The velocity of the moving point is $(x_1', x_2') = A\mathbf{x}$, so at every point of the plane the system tells you which way to go. That's the field of arrows you saw in Lesson 1.

A picture of several trajectories is a **phase portrait**. It shows the behaviour of every solution at once, without a formula for any of them.`,
        },
        {
          kind: "key",
          title: "Equilibrium",
          body: md`A point where $\mathbf{x}' = \mathbf{0}$ is an **equilibrium**: a solution that sits still forever. For $\mathbf{x}' = A\mathbf{x}$ the origin is always an equilibrium, since $A\mathbf{0} = \mathbf{0}$, and when $\det A \ne 0$ it is the only one. The whole question of a phase portrait is what happens near the origin: do trajectories fall into it, run away from it, circle it, or some mix?`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-3, 3],
          field: { dx: "a x + b y", dy: "c x + d y" },
          points: [{ x: -2.9, y: 2.7, label: "\\tau = {=a + d},\\; \\Delta = {=a d - b c}", color: 2 }],
          params: [
            { name: "a", tex: "a", min: -3, max: 3, step: 1, value: -1 },
            { name: "b", tex: "b", min: -3, max: 3, step: 1, value: 2 },
            { name: "c", tex: "c", min: -3, max: 3, step: 1, value: -2 },
            { name: "d", tex: "d", min: -3, max: 3, step: 1, value: -1 },
          ],
          caption: md`The direction field of $\mathbf{x}' = \begin{bmatrix} a & b \\ c & d \end{bmatrix}\mathbf{x}$. Move the sliders and watch the portrait change type. The trace $\tau = a + d$ and determinant $\Delta = ad - bc$ are shown in the corner; by the end of this lesson those two numbers will tell you the picture before you look.`,
        },
        {
          kind: "key",
          title: "The portraits of a linear system",
          body: md`With $\det A \ne 0$ and no repeated eigenvalue, there are six pictures:

- **Real eigenvalues, both negative:** every trajectory heads into the origin. A **stable node** (sink).
- **Real, both positive:** every trajectory leaves. An **unstable node** (source).
- **Real, opposite signs:** trajectories come in along one line and leave along another. A **saddle**, always unstable.
- **Complex $a \pm bi$, $a < 0$:** trajectories spiral in. A **stable spiral**.
- **Complex, $a > 0$:** they spiral out. An **unstable spiral**.
- **Complex, $a = 0$:** closed loops around the origin. A **center**, stable but not attracting.

Each picture is a consequence of the solution formulas from Lesson 2.`,
        },
        {
          kind: "why",
          title: "Why a saddle looks like a saddle",
          body: md`Let $\lambda_1 < 0 < \lambda_2$. Every solution is

$$\mathbf{x}(t) = c_1 e^{\lambda_1 t}\mathbf{v}_1 + c_2 e^{\lambda_2 t}\mathbf{v}_2.$$

As $t \to \infty$ the first term dies ($\lambda_1 < 0$) and the second explodes, so the trajectory lines up with $\mathbf{v}_2$ and runs off along that line. As $t \to -\infty$ the roles swap: far in the past the trajectory was hugging the line of $\mathbf{v}_1$. So trajectories arrive parallel to one eigenvector line and leave parallel to the other, bending in between like the contour lines of a mountain pass.

Only trajectories with $c_2 = 0$ ever reach the origin: those that start exactly on the line of $\mathbf{v}_1$. Every other starting point, however close, eventually escapes. That is why a saddle counts as unstable.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-3, 3],
          field: { dx: "x + 2y", dy: "2x + y" },
          curves: [
            { expr: "x", dashed: true, color: 2 },
            { expr: "-x", dashed: true, color: 3 },
          ],
          parametric: [
            { x: "0.05e^(3t) + e^(-t)", y: "0.05e^(3t) - e^(-t)", t: [-1.1, 1.35], color: 4 },
            { x: "0.05e^(3t) - e^(-t)", y: "0.05e^(3t) + e^(-t)", t: [-1.1, 1.35], color: 4 },
            { x: "-0.05e^(3t) + e^(-t)", y: "-0.05e^(3t) - e^(-t)", t: [-1.1, 1.35], color: 4 },
            { x: "-0.05e^(3t) - e^(-t)", y: "-0.05e^(3t) + e^(-t)", t: [-1.1, 1.35], color: 4 },
          ],
          caption: md`A saddle: $\mathbf{x}' = \begin{bmatrix} 1 & 2 \\ 2 & 1 \end{bmatrix}\mathbf{x}$ has $\lambda = 3$ along $y = x$ (orange) and $\lambda = -1$ along $y = -x$ (green). Trajectories come in along the green line and are flung out along the orange one.`,
        },
        {
          kind: "why",
          title: "Why complex eigenvalues make spirals and centers",
          body: md`With $\lambda = a \pm bi$ the solutions are

$$\mathbf{x}(t) = e^{at}\big(c_1(\mathbf{p}\cos bt - \mathbf{q}\sin bt) + c_2(\mathbf{p}\sin bt + \mathbf{q}\cos bt)\big).$$

Look at the bracket alone. Its components are combinations of $\cos bt$ and $\sin bt$, so it repeats every $2\pi/b$: the point traces a closed loop (an ellipse) over and over. When $a = 0$ that is the whole story: a center.

Now put back $e^{at}$. Each time round the loop, the point is multiplied by $e^{2\pi a/b}$. If $a < 0$ that factor is less than $1$, so each lap is smaller than the last and the loop closes in on the origin: a stable spiral. If $a > 0$ each lap is bigger: an unstable spiral. The imaginary part sets the speed of rotation; the real part sets growth or decay. Exactly as in Unit 3, where $e^{at}\cos bt$ was a damped or growing oscillation.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-3, 3],
          field: { dx: "-0.5x - 2y", dy: "2x - 0.5y" },
          parametric: [{ x: "2.8e^(-0.5t) cos(2t)", y: "2.8e^(-0.5t) sin(2t)", t: [0, 7], color: 4 }],
          caption: md`A stable spiral: $\mathbf{x}' = \begin{bmatrix} -0.5 & -2 \\ 2 & -0.5 \end{bmatrix}\mathbf{x}$ has $\lambda = -0.5 \pm 2i$. The trajectory circles with angular speed $2$ while $e^{-0.5t}$ pulls it in. Set the real part to $0$ and the same curve would be a circle.`,
        },
        {
          kind: "key",
          title: "Trace and determinant decide",
          body: md`For a $2 \times 2$ matrix with trace $\tau$ and determinant $\Delta$, the eigenvalues are

$$\lambda = \frac{\tau \pm \sqrt{\tau^2 - 4\Delta}}{2}.$$

- $\Delta < 0$: **saddle**.
- $\Delta > 0$ and $\tau^2 > 4\Delta$: real eigenvalues of one sign. **Node**, stable if $\tau < 0$, unstable if $\tau > 0$.
- $\Delta > 0$ and $\tau^2 < 4\Delta$: complex eigenvalues with real part $\tau/2$. **Spiral**, stable if $\tau < 0$, unstable if $\tau > 0$; **center** if $\tau = 0$.
- $\tau^2 = 4\Delta$ (repeated) and $\Delta = 0$ (a zero eigenvalue) are the borderline cases.`,
        },
        {
          kind: "why",
          title: "Why two numbers are enough",
          body: md`Linear Algebra, Unit 7: the eigenvalues of a $2 \times 2$ matrix multiply to $\Delta$ and add to $\tau$.

If $\Delta < 0$ the product of the eigenvalues is negative. A complex pair $a \pm bi$ has product $a^2 + b^2 > 0$, so the eigenvalues must be real, and real numbers with a negative product have opposite signs: a saddle.

If $\Delta > 0$ and the eigenvalues are real, their product is positive so they share a sign, and their sum $\tau$ tells you which sign.

If they are complex, $a \pm bi$, their sum is $2a = \tau$, so the real part is $\tau/2$ and the sign of $\tau$ decides growth or decay. Whether they are real or complex is the sign of the discriminant $\tau^2 - 4\Delta$.`,
        },
        {
          kind: "plot",
          x: [-4.5, 4.5],
          y: [-2.5, 4.5],
          curves: [{ expr: "x^2/4", label: "\\Delta = \\tau^2/4", color: 2 }],
          points: [
            { x: 0, y: -1.4, label: "\\text{saddle}", color: 3 },
            { x: -3.6, y: 1.2, label: "\\text{stable node}", color: 1 },
            { x: 3.6, y: 1.2, label: "\\text{unstable node}", color: 4 },
            { x: -1.7, y: 3.6, label: "\\text{stable spiral}", color: 1 },
            { x: 1.7, y: 3.6, label: "\\text{unstable spiral}", color: 4 },
            { x: 0, y: 2.6, label: "\\text{center}", color: 3 },
          ],
          caption: md`The trace-determinant plane: trace $\tau$ across, determinant $\Delta$ up. Below the horizontal axis, saddles. Above the parabola $\Delta = \tau^2/4$, spirals (centers on the vertical axis). Between the axis and the parabola, nodes. Left of center is stable, right is unstable. The parabola itself is the repeated-eigenvalue case.`,
        },
        {
          kind: "proof",
          title: "Negative real parts mean every solution dies out",
          given: md`Every eigenvalue of $A$ has negative real part`,
          prove: md`Every solution of $\mathbf{x}' = A\mathbf{x}$ satisfies $\mathbf{x}(t) \to \mathbf{0}$ as $t \to \infty$`,
          steps: [
            { statement: md`Real distinct case: $\mathbf{x} = c_1 e^{\lambda_1 t}\mathbf{v}_1 + c_2 e^{\lambda_2 t}\mathbf{v}_2$ with $\lambda_1, \lambda_2 < 0$`, reason: "Lesson 2" },
            { statement: md`$e^{\lambda_i t} \to 0$, so $\mathbf{x}(t) \to \mathbf{0}$`, reason: md`$e^{\lambda t} \to 0$ as $t \to \infty$ whenever $\lambda < 0$; a fixed vector times something that goes to $0$ goes to $\mathbf{0}$` },
            { statement: md`Complex case: $\mathbf{x} = e^{at}(\text{bounded vector})$ with $a < 0$`, reason: md`The bracket in the solution formula is made of $\cos bt$ and $\sin bt$, which never exceed $1$ in size` },
            { statement: md`$\mathbf{x}(t) \to \mathbf{0}$`, reason: md`$e^{at} \to 0$ times a bounded quantity goes to $0$` },
            { statement: md`Repeated case: $te^{\lambda t} \to 0$ as well, so again $\mathbf{x}(t) \to \mathbf{0}$`, reason: md`$te^{\lambda t} = t/e^{|\lambda| t}$, and exponentials outgrow polynomials (Calculus 1, l'Hôpital)` },
          ],
        },
        {
          kind: "text",
          body: md`An equilibrium that every nearby solution approaches is called **asymptotically stable**. The proof shows that for linear systems this happens exactly when all eigenvalues have negative real part, and then *every* solution approaches, not just nearby ones. If any eigenvalue has positive real part, some solutions grow without bound: **unstable**. A center is the in-between case: solutions stay close but never arrive.`,
        },
        {
          kind: "example",
          title: "Classifying two systems",
          problem: md`Classify the origin for $A = \begin{bmatrix} 1 & 3 \\ -2 & -4 \end{bmatrix}$ and for $B = \begin{bmatrix} 1 & -4 \\ 2 & -3 \end{bmatrix}$.`,
          steps: [
            { math: md`A: \; \tau = -3, \quad \Delta = -4 + 6 = 2, \quad \tau^2 - 4\Delta = 9 - 8 = 1 > 0`, note: md`Positive determinant and positive discriminant: real eigenvalues of one sign.` },
            { math: md`\lambda = \frac{-3 \pm 1}{2} = -1, -2 \;\Rightarrow\; \text{stable node}`, note: md`Both negative, as the negative trace promised.` },
            { math: md`B: \; \tau = -2, \quad \Delta = -3 + 8 = 5, \quad \tau^2 - 4\Delta = 4 - 20 = -16 < 0`, note: "Negative discriminant: complex." },
            { math: md`\lambda = -1 \pm 2i \;\Rightarrow\; \text{stable spiral}`, note: md`Real part $\tau/2 = -1 < 0$: the spiral winds inward.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Classify the origin of $\mathbf{x}' = \begin{bmatrix} 0 & 1 \\ -4 & 0 \end{bmatrix}\mathbf{x}$.`,
          choices: CHOICES,
          accept: ["center"],
          explain: md`$\tau = 0$ and $\Delta = 4 > 0$, so $\lambda = \pm 2i$: pure rotation, a center. This is the system version of $y'' + 4y = 0$, whose solutions $\cos 2t$ and $\sin 2t$ oscillate forever.`,
        },
        {
          kind: "check",
          prompt: md`Two lines through the origin are trajectories of $\mathbf{x}' = \begin{bmatrix} 1 & 2 \\ 2 & 1 \end{bmatrix}\mathbf{x}$. Give their slopes as a comma-separated list.`,
          answer: "1, -1",
          form: "set",
          explain: md`Straight-line trajectories run along eigenvectors. $\lambda = 3$ has eigenvector $(1, 1)$, slope $1$; $\lambda = -1$ has eigenvector $(1, -1)$, slope $-1$.`,
        },
      ],
      practice: [classifyPortrait, straightLineSolutions, parameterBoundary],
    },
    {
      id: slug("Nonlinear systems and stability"),
      title: "Nonlinear systems and stability",
      summary: "Equilibria of nonlinear systems, linearization with the Jacobian, what the linear picture can and cannot tell you, and predator and prey.",
      blocks: [
        {
          kind: "text",
          body: md`Real models are rarely linear. Rabbits $x$ and foxes $y$: left alone, rabbits multiply at a rate proportional to $x$, and foxes starve at a rate proportional to $y$. Meetings between the two happen at a rate proportional to the product $xy$; each meeting is bad for a rabbit and good for a fox. That gives the **Lotka-Volterra** equations

$$x' = x(a - by), \qquad y' = y(-c + dx).$$

The products $xy$ make this nonlinear. Superposition fails, the eigenvalue method doesn't apply, and in general there is no formula for the solutions. Yet the questions that matter (do the populations settle down, die out, or cycle?) can still be answered. The tools are equilibria, linearization and the phase plane.`,
        },
        {
          kind: "key",
          title: "Equilibrium of a nonlinear system",
          body: md`For a system $x' = f(x, y)$, $y' = g(x, y)$, an **equilibrium** is a point where $f = 0$ and $g = 0$ at the same time. A solution that starts there stays there. Find equilibria by solving the two equations simultaneously. Unlike a linear system, a nonlinear one can have several equilibria, or none, and they need not be at the origin.`,
        },
        {
          kind: "example",
          title: "Equilibria of two competing species",
          problem: md`Find all equilibria of $x' = x(3 - x - 2y)$, $y' = y(2 - x - y)$.`,
          steps: [
            { math: md`x(3 - x - 2y) = 0 \;\Rightarrow\; x = 0 \;\text{ or }\; x + 2y = 3`, note: "A product is zero when one factor is zero." },
            { math: md`y(2 - x - y) = 0 \;\Rightarrow\; y = 0 \;\text{ or }\; x + y = 2`, note: "Same for the second equation." },
            { math: md`(0, 0), \quad (3, 0), \quad (0, 2)`, note: md`Pair the cases: $x = 0$ with $y = 0$; $x + 2y = 3$ with $y = 0$; $x = 0$ with $x + y = 2$.` },
            { math: md`x + 2y = 3, \; x + y = 2 \;\Rightarrow\; (1, 1)`, note: md`The fourth pairing. Subtracting gives $y = 1$, then $x = 1$. Four equilibria in all: extinction, each species alone, and coexistence.` },
          ],
        },
        {
          kind: "text",
          body: md`What happens near each equilibrium? Zoom in. Close to a point, a smooth function looks like its tangent plane (Calculus 3), which is linear. So close to an equilibrium, a nonlinear system looks like a linear one, and Lesson 3 tells us everything about linear ones.`,
        },
        {
          kind: "why",
          title: "Why the Jacobian is the right matrix",
          body: md`Let $(x^*, y^*)$ be an equilibrium and write $x = x^* + u$, $y = y^* + v$ with $u, v$ small. The tangent-plane approximation of $f$ at the equilibrium is

$$f(x^* + u, y^* + v) \approx f(x^*, y^*) + f_x\,u + f_y\,v = f_x\,u + f_y\,v,$$

because $f(x^*, y^*) = 0$. The error is made of terms like $u^2$, $uv$, $v^2$, which are tiny compared with $u$ and $v$ themselves when both are small. The same holds for $g$. Since $u' = x'$ and $v' = y'$ (the equilibrium is a constant),

$$\begin{bmatrix} u \\ v \end{bmatrix}' \approx \begin{bmatrix} f_x & f_y \\ g_x & g_y \end{bmatrix}\begin{bmatrix} u \\ v \end{bmatrix},$$

with the partial derivatives evaluated at $(x^*, y^*)$. That matrix of partials is the **Jacobian**, $J$. Near the equilibrium, the displacement $(u, v)$ obeys the linear system $\mathbf{u}' = J\mathbf{u}$, up to small errors.`,
        },
        {
          kind: "key",
          title: "Linearization",
          body: md`At an equilibrium $(x^*, y^*)$ of $x' = f$, $y' = g$, form

$$J = \begin{bmatrix} f_x & f_y \\ g_x & g_y \end{bmatrix}\Bigg|_{(x^*, y^*)}$$

and classify $J$ by its eigenvalues as in Lesson 3. **If every eigenvalue has nonzero real part**, the nonlinear equilibrium has the same type as the linear one: a stable node, unstable node, saddle, stable spiral or unstable spiral, slightly bent. This is the Hartman-Grobman theorem. **If the linearization is a center** (or has a zero eigenvalue), it tells you nothing for certain: the dropped terms decide.`,
        },
        {
          kind: "why",
          title: "Why a center is inconclusive but a spiral isn't",
          body: md`A linear spiral has $e^{at}$ with $a \ne 0$ driving every solution definitely in or definitely out. The dropped terms are much smaller than the linear ones near the equilibrium, so they can bend the spiral but can't reverse an exponential trend. The same goes for nodes and saddles.

A center has $a = 0$: no trend at all. The linear part says "go round in a loop and come back exactly where you started". Then the tiny dropped terms are the only thing deciding whether each lap ends a little inside or a little outside the last one. Here is a system that shows it:

$$x' = -y + \epsilon x(x^2 + y^2), \qquad y' = x + \epsilon y(x^2 + y^2).$$

Its Jacobian at the origin is $\begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}$ for every $\epsilon$: a center. But with $r^2 = x^2 + y^2$, differentiate: $rr' = xx' + yy' = \epsilon(x^2 + y^2)^2 = \epsilon r^4$, so $r' = \epsilon r^3$. For $\epsilon < 0$ the distance shrinks, a stable spiral; for $\epsilon > 0$ it grows, an unstable spiral; only $\epsilon = 0$ is a true center. The linearization was identical in all three cases.`,
        },
        {
          kind: "example",
          title: "Classifying the equilibria of the competing species",
          problem: md`For $x' = x(3 - x - 2y)$, $y' = y(2 - x - y)$, classify the equilibria $(1, 1)$ and $(3, 0)$.`,
          steps: [
            { math: md`J(x, y) = \begin{bmatrix} 3 - 2x - 2y & -2x \\ -y & 2 - x - 2y \end{bmatrix}`, note: md`Expand $f = 3x - x^2 - 2xy$ and $g = 2y - xy - y^2$, then take partials.` },
            { math: md`J(1, 1) = \begin{bmatrix} -1 & -2 \\ -1 & -1 \end{bmatrix}: \quad \tau = -2, \; \Delta = 1 - 2 = -1 < 0`, note: "Negative determinant." },
            { math: md`\text{saddle: coexistence is unstable}`, note: md`Almost every nearby start drifts away from $(1, 1)$. One species will win. This is competitive exclusion.` },
            { math: md`J(3, 0) = \begin{bmatrix} -3 & -6 \\ 0 & -1 \end{bmatrix}: \quad \lambda = -3, -1`, note: md`Upper triangular, so the eigenvalues are on the diagonal.` },
            { math: md`\text{stable node}`, note: md`Both negative. Species $x$ alone at its carrying capacity $3$ is a stable outcome. By the same computation $(0, 2)$ is also a stable node and $(0, 0)$ is an unstable node ($\lambda = 3, 2$).` },
          ],
        },
        {
          kind: "plot",
          x: [0, 3.6],
          y: [0, 2.6],
          field: { dx: "x(3 - x - 2y)", dy: "y(2 - x - y)" },
          points: [
            { x: 1, y: 1, label: "(1, 1)", color: 4 },
            { x: 3, y: 0, label: "(3, 0)", color: 3 },
            { x: 0, y: 2, label: "(0, 2)", color: 3 },
          ],
          caption: md`The competing-species field. Near $(1, 1)$ the arrows show the saddle: in along one direction, out along another. The two single-species equilibria $(3, 0)$ and $(0, 2)$ draw trajectories in. Which one wins depends on which side of the saddle's incoming line you start.`,
        },
        {
          kind: "text",
          body: md`**Back to predator and prey.** Scale the Lotka-Volterra equations so all the constants are $1$: $x' = x(1 - y)$, $y' = y(x - 1)$. The equilibria are $(0, 0)$ and $(1, 1)$. The Jacobian is

$$J(x, y) = \begin{bmatrix} 1 - y & -x \\ y & x - 1 \end{bmatrix}, \qquad J(0, 0) = \begin{bmatrix} 1 & 0 \\ 0 & -1 \end{bmatrix}, \qquad J(1, 1) = \begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}.$$

The origin is a saddle (prey grow, predators starve). At $(1, 1)$ the linearization is a center, $\lambda = \pm i$, and we have just seen that a center proves nothing. We need a different tool: a quantity that doesn't change along trajectories.`,
        },
        {
          kind: "proof",
          title: "H(x, y) = x − ln x + y − ln y is constant on every trajectory",
          given: md`$x' = x(1 - y)$, $y' = y(x - 1)$, with $x, y > 0$`,
          prove: md`$\dfrac{d}{dt}H(x(t), y(t)) = 0$`,
          steps: [
            { statement: md`$\dfrac{dH}{dt} = H_x x' + H_y y'$`, reason: "Chain rule for a function of two variables (Calculus 3)" },
            { statement: md`$H_x = 1 - \dfrac{1}{x}$, $\quad H_y = 1 - \dfrac{1}{y}$`, reason: "Differentiate" },
            { statement: md`$\dfrac{dH}{dt} = \left(1 - \dfrac{1}{x}\right)x(1 - y) + \left(1 - \dfrac{1}{y}\right)y(x - 1)$`, reason: "Substitute the system" },
            { statement: md`$\dfrac{dH}{dt} = (x - 1)(1 - y) + (y - 1)(x - 1)$`, reason: md`$\left(1 - \frac{1}{x}\right)x = x - 1$ and $\left(1 - \frac{1}{y}\right)y = y - 1$` },
            { statement: md`$\dfrac{dH}{dt} = (x - 1)\big((1 - y) + (y - 1)\big) = 0$`, reason: md`Factor out $(x - 1)$; the bracket is $0$` },
          ],
        },
        {
          kind: "text",
          body: md`So every trajectory stays on one level curve of $H$. Those level curves are closed loops around $(1, 1)$, which is where $H$ has its minimum ($H_x = H_y = 0$ there, and $H$ grows without bound toward every edge). A trajectory that stays on a closed loop forever is a periodic orbit: $(1, 1)$ really is a center, and the populations cycle. Rabbits boom, foxes follow, rabbits crash, foxes starve, rabbits recover. The linearization couldn't decide; the conserved quantity could.`,
        },
        {
          kind: "contour",
          x: [0.05, 4],
          y: [0.05, 4],
          expr: "x - ln(x) + y - ln(y)",
          levels: [2.1, 2.3, 2.6, 3, 3.5, 4.2],
          points: [{ x: 1, y: 1, label: "(1, 1)", color: 4 }],
          caption: md`Level curves of $H(x, y) = x - \ln x + y - \ln y$. Each closed loop is one trajectory of the predator-prey system, travelled counterclockwise forever. The minimum of $H$, value $2$, sits at the equilibrium.`,
        },
        {
          kind: "plot",
          x: [0, 4],
          y: [0, 4],
          field: { dx: "x(1 - y)", dy: "y(x - 1)" },
          points: [{ x: 1, y: 1, label: "(1, 1)", color: 4 }],
          caption: md`The same system as a direction field. Below $y = 1$ the prey increase; right of $x = 1$ the predators increase. The arrows circulate counterclockwise around the equilibrium, matching the loops above.`,
        },
        {
          kind: "check",
          prompt: md`Find the equilibrium with both populations positive for $x' = x(6 - 2y)$, $y' = y(x - 3)$. Type it as $(x, y)$.`,
          answer: "(3, 3)",
          form: "tuple",
          explain: md`With $x, y \ne 0$: $6 - 2y = 0$ gives $y = 3$, and $x - 3 = 0$ gives $x = 3$.`,
        },
        {
          kind: "check",
          prompt: md`A damped pendulum obeys $x' = y$, $y' = -\sin x - y$. Linearize at the origin and classify it.`,
          choices: NONLINEAR_CHOICES,
          accept: ["stable spiral"],
          explain: md`$J(0, 0) = \begin{bmatrix} 0 & 1 \\ -\cos 0 & -1 \end{bmatrix} = \begin{bmatrix} 0 & 1 \\ -1 & -1 \end{bmatrix}$: $\tau = -1$, $\Delta = 1$, discriminant $1 - 4 < 0$. A stable spiral, and since the real part is nonzero the nonlinear pendulum spirals in too: it swings with decreasing amplitude and comes to rest.`,
        },
      ],
      practice: [findEquilibrium, jacobianAt, classifyNonlinear],
    },
  ],
};
