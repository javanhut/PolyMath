import type { Rng } from "../../math/random";
import { paren, poly, signed } from "../../math/random";
import { md, slug, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

type Mat = number[][];
const VARS = ["x", "y", "z", "w"];

/** "2x - y + 3z" from a coefficient list (zero terms dropped). */
const lin = (c: number[]) => poly(c.map((k, i) => [k, VARS[i]!] as [number, string]));
/** "2x - y + 3z = 4". */
const eqn = (c: number[], rhs: number) => `${lin(c)} = ${rhs}`;
/** A row of an augmented matrix read as an equation: the last entry is the right side. */
const rowEqn = (row: number[]) => eqn(row.slice(0, -1), row[row.length - 1]!);
/** "2*x - 1*y + 0*z = 5": every unknown written out, as verify equations need. */
function vEq(c: number[], rhs: number, vars = VARS): string {
  const left = c.map((k, i) => `${i === 0 ? (k < 0 ? "-" : "") : k < 0 ? " - " : " + "}${Math.abs(k)}*${vars[i]}`).join("");
  return `${left} = ${rhs}`;
}
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i]!, 0);
const clone = (M: Mat): Mat => M.map((r) => [...r]);
const maxAbs = (M: Mat) => Math.max(...M.flat().map(Math.abs));
/** True when some row has every coefficient zero (an equation like 0 = 5 or 0 = 0). */
const hasZeroLeft = (M: Mat) => M.some((row) => row.slice(0, -1).every((v) => v === 0));
/** True when some equation mentions fewer than two unknowns, or two equations are identical. */
const hasThinRow = (M: Mat) => M.some((row) => row.slice(0, -1).filter((v) => v !== 0).length < 2) || new Set(M.map((row) => row.join())).size < M.length;
/** Fix -0 so it prints as 0. */
const tidy = (M: Mat): Mat => M.map((r) => r.map((v) => (v === 0 ? 0 : v)));

/** A matrix in LaTeX. With `aug`, the last column sits behind a bar. */
function matTex(rows: (number | string)[][], aug = false): string {
  const body = rows.map((r) => r.join(" & ")).join(" \\\\ ");
  if (!aug) return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
  const n = rows[0]!.length;
  return `\\left[\\begin{array}{${"c".repeat(n - 1)}|c} ${body} \\end{array}\\right]`;
}
/** A column vector in LaTeX. */
const colTex = (v: (number | string)[]) => `\\begin{bmatrix} ${v.join(" \\\\ ")} \\end{bmatrix}`;
/** A single row as a bracketed row vector. */
const rowTex = (row: (number | string)[]) => `\\begin{bmatrix} ${row.join(" & ")} \\end{bmatrix}`;
/** Answer text for a matrix: [[1, 2], [3, 4]]. */
const matAns = (rows: (number | string)[][]) => `[${rows.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
/** "R_2 - 3R_1" for the replacement R_i + k R_j. */
const combo = (i: number, k: number, j: number) => `R_${i} ${k < 0 ? "-" : "+"} ${Math.abs(k) === 1 ? "" : Math.abs(k)}R_${j}`;
/** The scale factor 1/p in LaTeX. */
const scaleTex = (p: number) => (p === -1 ? "-" : p < 0 ? `-\\tfrac{1}{${-p}}` : `\\tfrac{1}{${p}}`);
/** The typing hint for a matrix answer of the given shape. */
const LIKE: Record<string, string> = {
  "2x3": "[[1, 0, 2], [0, 1, -1]]",
  "3x4": "[[1, 0, 0, 2], [0, 1, 0, -1], [0, 0, 1, 3]]",
};
const likeMatrix = (rows: number, cols: number) => LIKE[`${rows}x${cols}`] ?? LIKE["3x4"]!;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface Reduction {
  steps: Step[];
  result: Mat;
  /** The pivot column of each pivot row. */
  pivots: number[];
  /** False when a step needed a fraction. Generators retry until every step is integer arithmetic. */
  integral: boolean;
}

/**
 * Gaussian elimination (or Gauss-Jordan with `rref`) that logs each stage as a solution step.
 * With `scaleFirst`, each pivot is scaled to 1 before clearing below it; without, the multiplier
 * entry/pivot is used directly, as in plain forward elimination.
 */
function reduce(M: Mat, opts: { aug: boolean; rref: boolean; scaleFirst: boolean }): Reduction {
  const A = clone(M);
  const m = A.length;
  const n = A[0]!.length;
  const steps: Step[] = [];
  const pivots: number[] = [];
  let integral = true;
  const show = (op: string, note: string) => steps.push({ math: md`\xrightarrow{${op}} ${matTex(tidy(A), opts.aug)}`, note });
  let row = 0;
  for (let col = 0; col < n && row < m; col++) {
    let best = -1;
    for (let i = row; i < m; i++) {
      const v = Math.abs(A[i]![col]!);
      if (v !== 0 && (best < 0 || v < Math.abs(A[best]![col]!))) best = i;
    }
    if (best < 0) continue;
    if (best !== row) {
      [A[row], A[best]] = [A[best]!, A[row]!];
      show(`R_${row + 1} \\leftrightarrow R_${best + 1}`, md`Column ${col + 1} needs a pivot in row ${row + 1}. Row ${best + 1} has the most convenient nonzero entry there, so swap it up.`);
    }
    let p = A[row]![col]!;
    if (opts.scaleFirst && p !== 1) {
      A[row] = A[row]!.map((v) => v / p);
      if (A[row]!.some((v) => !Number.isInteger(v))) integral = false;
      show(`R_${row + 1} \\to ${scaleTex(p)}R_${row + 1}`, md`Scale row ${row + 1} so its pivot is 1.`);
      p = 1;
    }
    const ops: string[] = [];
    for (let i = row + 1; i < m; i++) {
      const k = A[i]![col]! / p;
      if (k === 0) continue;
      if (!Number.isInteger(k)) integral = false;
      A[i] = A[i]!.map((v, c) => v - k * A[row]![c]!);
      ops.push(`R_${i + 1} \\to ${combo(i + 1, -k, row + 1)}`);
    }
    if (ops.length) {
      show(ops.join(",\\; "), md`Clear below the pivot ${p === 1 ? "" : `$${p}$ `}in column ${col + 1}: subtract the right multiple of row ${row + 1} from each row under it.`);
    }
    pivots.push(col);
    row++;
  }
  if (opts.rref) {
    for (let r = pivots.length - 1; r >= 1; r--) {
      const col = pivots[r]!;
      const ops: string[] = [];
      for (let i = 0; i < r; i++) {
        const k = A[i]![col]!;
        if (k === 0) continue;
        if (!Number.isInteger(k)) integral = false;
        A[i] = A[i]!.map((v, c) => v - k * A[r]![c]!);
        ops.push(combo(i + 1, -k, r + 1));
      }
      if (ops.length) show(ops.join(",\\; "), md`Clear above the pivot in row ${r + 1}, so that pivot is the only nonzero entry in its column.`);
    }
  }
  return { steps, result: tidy(A), pivots, integral };
}

/** A reduced row echelon matrix with the given pivot columns and small random entries elsewhere. */
function randomRref(r: Rng, rows: number, cols: number, pivotCols: number[]): Mat {
  const R: Mat = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  pivotCols.forEach((p, i) => {
    R[i]![p] = 1;
    for (let j = p + 1; j < cols; j++) if (!pivotCols.includes(j)) R[i]![j] = r.int(-3, 3);
  });
  return R;
}

/**
 * Hide an echelon matrix behind row operations. Multiples of lower rows are added to upper rows
 * (still echelon, same pivots), then each row gets integer multiples of the rows above it added,
 * then optionally a swap and a scaling. The reduced form of the result is the matrix we started with.
 */
function scramble(r: Rng, R: Mat, rank: number, opts: { swap?: boolean; scale?: boolean } = {}): Mat {
  const m = R.length;
  const U = clone(R);
  for (let i = 0; i < rank; i++) {
    for (let j = i + 1; j < rank; j++) {
      const c = r.int(-1, 1);
      if (c) U[i] = U[i]!.map((v, k) => v + c * R[j]![k]!);
    }
  }
  const M: Mat = [];
  for (let i = 0; i < m; i++) {
    let row = [...U[i]!];
    const ls = Array.from({ length: i }, () => r.int(-2, 2));
    if (i >= rank && ls.slice(0, rank).every((l) => l === 0)) ls[r.int(0, rank - 1)] = r.pick([1, -1, 2]);
    ls.forEach((l, j) => {
      if (l) row = row.map((v, k) => v + l * U[j]![k]!);
    });
    M.push(row);
  }
  if (opts.swap && m > 1) {
    const i = r.int(0, m - 1);
    let j = r.int(0, m - 1);
    while (j === i) j = r.int(0, m - 1);
    [M[i], M[j]] = [M[j]!, M[i]!];
  }
  if (opts.scale) {
    const i = r.int(0, m - 1);
    const s = r.pick([-1, 2, -2, 3]);
    M[i] = M[i]!.map((v) => s * v);
  }
  return tidy(M);
}

/** What a reduced augmented matrix says about its system, as a final solution step. */
function readRref(R: Mat, pivots: number[], n: number): Step {
  if (pivots.includes(n)) {
    return { math: md`0 = 1`, note: md`The last pivot sits in the constants column. That row says $0 = 1$, which nothing satisfies: the system is **inconsistent**.` };
  }
  if (pivots.length === n) {
    return {
      math: pivots.map((_, i) => `${VARS[i]} = ${R[i]![n]}`).join(", \\quad "),
      note: md`There is a pivot in every unknown's column, so each row names one unknown: **exactly one solution**.`,
    };
  }
  const free = [...Array(n).keys()].filter((j) => !pivots.includes(j)).map((j) => VARS[j]!);
  return {
    math: pivots.map((_, i) => rowEqn(R[i]!)).join(", \\quad "),
    note: md`The column${free.length > 1 ? "s" : ""} of $${free.join("$, $")}$ ${free.length > 1 ? "have" : "has"} no pivot, so ${free.length > 1 ? "those unknowns are" : "that unknown is"} **free**: choose ${free.length > 1 ? "them" : "it"} and the pivot unknowns follow. **Infinitely many solutions.**`,
  };
}

// ── Lesson 1 generators: rows and columns ───────────────────────────────────

/** Weights on two column vectors that land on a given b: the column picture. */
const columnWeights: Generator = (r) => {
  for (;;) {
    const a1 = [r.int(-3, 3), r.int(-3, 3)];
    const a2 = [r.int(-3, 3), r.int(-3, 3)];
    const det = a1[0]! * a2[1]! - a1[1]! * a2[0]!;
    if (det === 0 || a1[0] === 0) continue;
    const x0 = r.int(-2, 3);
    const y0 = r.int(-2, 3);
    if ((x0 === 0 && y0 === 0) || (x0 === 1 && y0 === 0) || (x0 === 0 && y0 === 1)) continue;
    const b = [x0 * a1[0]! + y0 * a2[0]!, x0 * a1[1]! + y0 * a2[1]!];
    const xs = [0, a1[0]!, a2[0]!, b[0]!];
    const ys = [0, a1[1]!, a2[1]!, b[1]!];
    const figure: Figure = {
      kind: "diagram",
      view: [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...ys) - 1, Math.max(...ys) + 1],
      grid: true,
      points: [
        { name: "O", x: 0, y: 0, label: "" },
        { name: "A", x: a1[0]!, y: a1[1]!, label: md`\mathbf{a}_1`, dir: "se" },
        { name: "B", x: a2[0]!, y: a2[1]!, label: md`\mathbf{a}_2`, dir: "nw" },
        { name: "T", x: b[0]!, y: b[1]!, label: md`\mathbf{b}`, dir: "ne" },
      ],
      segments: [
        { from: "O", to: "A", arrow: true, color: 1 },
        { from: "O", to: "B", arrow: true, color: 2 },
        { from: "O", to: "T", arrow: true, color: 4 },
      ],
      caption: md`How many of $\mathbf{a}_1$ and how many of $\mathbf{a}_2$ add up to $\mathbf{b}$?`,
    };
    const elim: Step[] =
      a1[1] === 0
        ? [{ math: md`${poly([[a2[1]!, "y"]])} = ${b[1]} \;\Rightarrow\; y = ${y0}`, note: md`The second equation has no $x$ in it, so it gives $y$ at once.` }]
        : [
            {
              math: md`${paren(a1[1]!)} \cdot (\text{first}) - ${paren(a1[0]!)} \cdot (\text{second}): \quad ${poly([[a1[1]! * a2[0]! - a1[0]! * a2[1]!, "y"]])} = ${a1[1]! * b[0]! - a1[0]! * b[1]!}`,
              note: md`Multiply each equation so the $x$-coefficients match (both become $${a1[0]! * a1[1]!}$), then subtract. The $x$ terms cancel.`,
            },
            { math: md`y = ${y0}`, note: md`Divide by ${a1[1]! * a2[0]! - a1[0]! * a2[1]!}.` },
          ];
    return {
      prompt: md`Find the weights $x$ and $y$ with $x ${colTex(a1)} + y ${colTex(a2)} = ${colTex(b)}$. Give them as $(x, y)$.`,
      answer: `(${x0}, ${y0})`,
      form: "tuple",
      figure,
      verify: [vEq([a1[0]!, a2[0]!], b[0]!), vEq([a1[1]!, a2[1]!], b[1]!)],
      hint: md`Two vectors are equal when their top entries match and their bottom entries match. That gives two ordinary equations in $x$ and $y$.`,
      solution: [
        { math: md`${eqn([a1[0]!, a2[0]!], b[0]!)}, \qquad ${eqn([a1[1]!, a2[1]!], b[1]!)}`, note: md`Top entries, then bottom entries. The column question has become the row picture: two lines.` },
        ...elim,
        { math: md`${poly([[a1[0]!, "x"]])} = ${b[0]} ${signed(-a2[0]! * y0)} = ${b[0]! - a2[0]! * y0} \;\Rightarrow\; x = ${x0}`, note: md`Back-substitute $y = ${y0}$ into the first equation.` },
        {
          math: md`${paren(x0)} ${colTex(a1)} + ${paren(y0)} ${colTex(a2)} = ${colTex([x0 * a1[0]!, x0 * a1[1]!])} + ${colTex([y0 * a2[0]!, y0 * a2[1]!])} = ${colTex(b)}`,
          note: md`Check in the column picture: the weights really do rebuild $\mathbf{b}$.`,
        },
      ],
    };
  }
};

/** A x computed as a combination of the columns; the hidden check uses the row rule instead. */
const matrixTimesVector: Generator = (r) => {
  for (;;) {
    const rows = r.int(2, 3);
    const cols = r.int(2, 3);
    const A: Mat = Array.from({ length: rows }, () => Array.from({ length: cols }, () => r.int(-4, 4)));
    const x = Array.from({ length: cols }, () => r.int(-3, 3));
    if (x.every((v) => v === 0) || A.some((row) => row.every((v) => v === 0))) continue;
    if (A.some((_, j) => A.every((row) => row[j] === 0))) continue;
    const b = A.map((row) => dot(row, x));
    const letters = ["a", "b", "c"].slice(0, rows);
    const column = (j: number) => A.map((row) => row[j]!);
    const products = (row: number[]) => row.map((v, j) => `${paren(x[j]!)}(${v})`).join(" + ");
    return {
      prompt: md`Compute $A\mathbf{x}$ for $A = ${matTex(A)}$ and $\mathbf{x} = ${colTex(x)}$. Give the result as ${rows === 2 ? "a pair like (3, -1)" : "a triple like (3, -1, 2)"}.`,
      answer: `(${b.join(", ")})`,
      form: "tuple",
      verify: b.map((_, i) => `${letters.map((L, j) => `${j === i ? 1 : 0}*${L}`).join(" + ")} = ${A[i]!.map((v, j) => `${paren(v)}*${paren(x[j]!)}`).join(" + ")}`),
      hint: md`$A\mathbf{x}$ is $x_1$ times column 1 plus $x_2$ times column 2${cols === 3 ? " plus $x_3$ times column 3" : ""}. Or take each row's dot product with $\mathbf{x}$; both rules give the same vector.`,
      solution: [
        {
          math: x.map((xi, j) => `${paren(xi)} ${colTex(column(j))}`).join(" + "),
          note: md`The column rule: $A\mathbf{x}$ is the combination of the columns of $A$ with the entries of $\mathbf{x}$ as weights.`,
        },
        { math: colTex(A.map((row) => products(row))), note: "Scale each column, then add entry by entry." },
        { math: md`A\mathbf{x} = ${colTex(b)}`, note: md`Row rule check: row 1 dotted with $\mathbf{x}$ is $${products(A[0]!)} = ${b[0]}$, the same first entry.` },
      ],
    };
  }
};

/** A 2x2 system with its row picture drawn. */
const solveRowPicture: Generator = (r) => {
  for (;;) {
    const x0 = r.int(-4, 4);
    const y0 = r.int(-4, 4);
    const b1 = r.nonzero(-3, 3);
    const a2 = r.nonzero(-3, 3);
    const b2 = r.nonzero(-4, 4);
    const m = b2 - a2 * b1;
    if (m === 0) continue;
    const c1 = x0 + b1 * y0;
    const c2 = a2 * x0 + b2 * y0;
    const figure: Figure = {
      kind: "plot",
      x: [-7, 7],
      y: [-7, 7],
      curves: [
        { expr: `(${c1} - x)/(${b1})`, label: eqn([1, b1], c1), color: 1 },
        { expr: `(${c2} - (${a2})*x)/(${b2})`, label: eqn([a2, b2], c2), color: 2 },
      ],
      caption: md`The row picture: each equation is a line, and the solution is the point on both.`,
    };
    return {
      prompt: md`Solve $${eqn([1, b1], c1)}$ and $${eqn([a2, b2], c2)}$. Give the answer as $(x, y)$.`,
      answer: `(${x0}, ${y0})`,
      form: "tuple",
      figure,
      hint: md`The first equation starts with $1x$, so ${a2 < 0 ? "add" : "subtract"} ${Math.abs(a2) === 1 ? "" : `${Math.abs(a2)} times `}it ${a2 < 0 ? "to" : "from"} the second to eliminate $x$.`,
      solution: [
        { math: md`E_2 ${a2 < 0 ? "+" : "-"} ${Math.abs(a2) === 1 ? "" : Math.abs(a2)}E_1: \quad ${poly([[m, "y"]])} = ${c2 - a2 * c1}`, note: md`${a2 < 0 ? "Adding" : "Subtracting"} ${Math.abs(a2) === 1 ? "" : `${Math.abs(a2)} times `}the first equation removes $x$ from the second.` },
        { math: md`y = ${y0}`, note: md`Divide by ${m}.` },
        { math: md`x = ${c1} ${signed(-b1 * y0)} = ${x0}`, note: md`Back-substitute into $E_1$: $x = ${c1} - ${paren(b1)}y$.` },
        { math: md`(x, y) = (${x0}, ${y0})`, note: md`In the column picture, $${x0} ${colTex([1, a2])} + ${paren(y0)} ${colTex([b1, b2])} = ${colTex([c1, c2])}$: the same two numbers are the weights on the columns.` },
      ],
    };
  }
};

// ── Lesson 2 generators: elimination ────────────────────────────────────────

/** Clear the first column below the pivot with the right multipliers. */
const clearColumn: Generator = (r) => {
  for (;;) {
    const p = r.pick([1, 1, -1, 2]);
    const both = r.next() < 0.5;
    const m2 = both ? r.int(-3, 3) : r.nonzero(-3, 3);
    const m3 = both ? r.nonzero(-3, 3) : r.int(-3, 3);
    if (both && m2 === 0 && m3 === 0) continue;
    const rest = () => Array.from({ length: 3 }, () => r.int(-5, 5));
    const M: Mat = [[p, ...rest()], [p * m2, ...rest()], [p * m3, ...rest()]];
    if (M.some((row) => row.slice(0, 3).every((v) => v === 0))) continue;
    const targets = both ? [1, 2] : [1];
    const result = clone(M);
    const steps: Step[] = [];
    for (const i of targets) {
      const k = M[i]![0]! / p;
      result[i] = M[i]!.map((v, c) => v - k * M[0]![c]!);
      if (k === 0) {
        steps.push({ math: md`${rowTex(M[i]!)}`, note: md`Row ${i + 1} already has a 0 in the first column. Leave it alone.` });
        continue;
      }
      steps.push({
        math: md`${rowTex(M[i]!)} ${k < 0 ? "+" : "-"} ${Math.abs(k) === 1 ? "" : Math.abs(k)}\,${rowTex(M[0]!)} = ${rowTex(tidy(result)[i]!)}`,
        note: md`The multiplier for row ${i + 1} is $\frac{${M[i]![0]}}{${p}} = ${k}$. Subtracting ${k} times the pivot row makes the first entry $${M[i]![0]} - ${paren(k)}\cdot${paren(p)} = 0$.`,
      });
    }
    if (maxAbs(result) > 20) continue;
    steps.push({ math: matTex(tidy(result), true), note: md`Row 1 is only read, never changed. The first column is now ${both ? "clear below the pivot: ready for the next column" : "clear in row 2"}.` });
    return {
      prompt: both
        ? md`Use the pivot in row 1 of $${matTex(M, true)}$ to clear the whole first column below it, with replacements $R_i \to R_i + kR_1$. Type the new matrix row by row, like ${likeMatrix(3, 4)}.`
        : md`Use the pivot in row 1 of $${matTex(M, true)}$ to clear the first entry of row 2 with a replacement $R_2 \to R_2 + kR_1$. Type the new matrix row by row, like ${likeMatrix(3, 4)}.`,
      answer: matAns(tidy(result)),
      form: "matrix",
      hint: md`The multiplier is (entry to clear) divided by (pivot). Subtract that many copies of row 1 from the row, every entry including the one behind the bar.`,
      solution: steps,
    };
  }
};

/** Solve a 3x3 system by elimination; built as L U so every multiplier is an integer. */
const eliminate3: Generator = (r) => {
  for (;;) {
    const sol = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    if (sol.filter((v) => v === 0).length > 1) continue;
    const U: Mat = [
      [1, r.nonzero(-2, 2), r.nonzero(-2, 2)],
      [0, r.pick([1, -1, 2]), r.nonzero(-3, 3)],
      [0, 0, r.pick([1, -1, 2, 3])],
    ];
    const L: Mat = [
      [1, 0, 0],
      [r.int(-2, 2), 1, 0],
      [r.int(-2, 2), r.int(-2, 2), 1],
    ];
    const A: Mat = L.map((lrow) => [0, 1, 2].map((j) => dot(lrow, U.map((urow) => urow[j]!))));
    if (maxAbs(A) > 9 || A.some((row) => row.filter((v) => v !== 0).length < 2)) continue;
    const b = A.map((row) => dot(row, sol));
    const M = A.map((row, i) => [...row, b[i]!]);
    const red = reduce(M, { aug: true, rref: false, scaleFirst: false });
    if (!red.integral || red.pivots.length !== 3) continue;
    const T = red.result;
    const [x, y, z] = sol as [number, number, number];
    const [p1, p2, p3] = [T[0]![0]!, T[1]![1]!, T[2]![2]!];
    return {
      prompt: md`Solve the system $${eqn(A[0]!, b[0]!)}$, $${eqn(A[1]!, b[1]!)}$, $${eqn(A[2]!, b[2]!)}$ by elimination. Give the answer as $(x, y, z)$.`,
      answer: `(${sol.join(", ")})`,
      form: "tuple",
      hint: md`Write the augmented matrix. Use the 1 in the top-left as the first pivot to clear column 1, then use the second pivot to clear below it. Back-substitute from the bottom row.`,
      solution: [
        { math: matTex(M, true), note: "The augmented matrix: coefficients left of the bar, constants right of it." },
        ...red.steps,
        { math: md`${rowEqn(T[2]!)} \;\Rightarrow\; z = ${z}`, note: p3 === 1 ? "The last row is triangular form's gift: one unknown on its own." : md`Divide the last row by ${p3}.` },
        { math: md`${rowEqn(T[1]!)} \;\Rightarrow\; ${poly([[p2, "y"]])} = ${T[1]![3]! - T[1]![2]! * z} \;\Rightarrow\; y = ${y}`, note: md`Substitute $z = ${z}$ into the middle row.` },
        { math: md`${rowEqn(T[0]!)} \;\Rightarrow\; ${poly([[p1, "x"]])} = ${T[0]![3]! - T[0]![1]! * y - T[0]![2]! * z} \;\Rightarrow\; x = ${x}`, note: md`Substitute $y = ${y}$ and $z = ${z}$ into the top row.` },
        { math: md`(x, y, z) = (${sol.join(", ")})`, note: md`Check in the original first equation: $${A[0]!.map((v, j) => `${paren(v)}${paren(sol[j]!)}`).join(" + ")} = ${b[0]}$.` },
      ],
    };
  }
};

/** The value of k that makes the second pivot vanish. */
const zeroPivot: Generator = (r) => {
  const a = r.pick([1, 2, 3, -1, -2]);
  const b = r.nonzero(-4, 4);
  const m = r.nonzero(-3, 3);
  const c = a * m;
  const k0 = b * m;
  const d1 = r.int(-5, 5);
  const d2 = r.int(-5, 5);
  return {
    prompt: md`Elimination on the system $${eqn([a, b], d1)}$, $${lin([c])} + ky = ${d2}$ starts by clearing the $x$ from the second equation. For which value of $k$ does that step leave a zero in the second pivot position, so the coefficient matrix has only one pivot?`,
    answer: String(k0),
    verify: [`${a}*k - ${b}*${paren(c)} = 0`],
    hint: md`The multiplier is $\frac{${c}}{${a}} = ${m}$. After $R_2 \to R_2 - ${paren(m)}R_1$ the $y$-coefficient of row 2 is $k - ${paren(m)}\cdot${paren(b)}$. Set it to zero.`,
    solution: [
      { math: md`m = \frac{${c}}{${a}} = ${m}`, note: md`The multiplier is the entry to clear divided by the pivot $${a}$.` },
      { math: md`R_2 \to R_2 ${m < 0 ? "+" : "-"} ${Math.abs(m) === 1 ? "" : Math.abs(m)}R_1: \quad 0x + (k ${signed(-m * b)})y = ${d2} ${signed(-m * d1)}`, note: md`The new second row. Its $y$-entry, $k ${signed(-m * b)}$, is the would-be second pivot.` },
      { math: md`k ${signed(-m * b)} = 0 \;\Rightarrow\; k = ${k0}`, note: md`A zero there means no second pivot.` },
      { math: md`${lin([c])} + ${paren(k0)}y = ${paren(m)}(${lin([a, b])})`, note: md`Check the meaning: with $k = ${k0}$ the left side of the second equation is exactly ${m} times the first. The two lines are parallel, or the same line if the right sides match too (${d2 === m * d1 ? "they do here" : "they don't here"}).` },
    ],
  };
};

// ── Lesson 3 generators: echelon forms and rank ─────────────────────────────

/** Reduce to RREF: the unique reduced form is built first, then hidden behind row operations. */
const toRref: Generator = (r) => {
  for (;;) {
    const kind = r.int(0, 3);
    const rows = kind < 2 ? 2 : 3;
    const cols = rows + 1;
    const pivotCols = kind === 0 ? [0, 1] : kind === 1 ? r.pick([[0], [0, 2]]) : kind === 2 ? [0, 1, 2] : r.pick([[0, 1], [0, 2], [0, 1, 3]]);
    const R = randomRref(r, rows, cols, pivotCols);
    const M = scramble(r, R, pivotCols.length, { swap: r.next() < 0.4, scale: r.next() < 0.4 });
    if (maxAbs(M) > 9 || hasZeroLeft(M) || hasThinRow(M)) continue;
    const red = reduce(M, { aug: true, rref: true, scaleFirst: true });
    if (!red.integral || red.steps.length > 8 || matAns(red.result) !== matAns(R)) continue;
    return {
      prompt: md`Row-reduce the augmented matrix $${matTex(M, true)}$ to reduced row echelon form. Type it row by row, like ${likeMatrix(rows, cols)}.`,
      answer: matAns(R),
      form: "matrix",
      hint: md`Work column by column: get a pivot (swap a 1 to the top if you can), scale it to 1, clear below it. When the staircase is done, clear above each pivot, starting from the last one.`,
      solution: [...red.steps, readRref(R, red.pivots, cols - 1)],
    };
  }
};

/** The rank of a matrix, found by counting pivots. */
const rankOf: Generator = (r) => {
  for (;;) {
    const [rows, cols] = r.pick([
      [2, 3],
      [3, 3],
      [3, 4],
    ]) as [number, number];
    const top = Math.min(rows, cols);
    const rank = r.pick([top, top - 1, top - 1, Math.max(1, top - 2)]);
    const others = [...Array(cols).keys()].slice(1);
    const pivotCols = [0];
    while (pivotCols.length < rank) {
      const c = r.pick(others);
      if (!pivotCols.includes(c)) pivotCols.push(c);
    }
    pivotCols.sort((a, b) => a - b);
    const R = randomRref(r, rows, cols, pivotCols);
    const M = scramble(r, R, rank, { swap: r.next() < 0.5, scale: r.next() < 0.5 });
    if (maxAbs(M) > 9 || M.some((row) => row.every((v) => v === 0)) || M[0]!.some((_, j) => M.every((row) => row[j] === 0))) continue;
    const red = reduce(M, { aug: false, rref: false, scaleFirst: true });
    if (!red.integral || red.pivots.length !== rank) continue;
    return {
      prompt: md`Find the rank of $${matTex(M)}$.`,
      answer: String(rank),
      hint: md`Reduce to echelon form and count the pivots. Every nonzero row of the echelon form has exactly one.`,
      solution: [
        ...red.steps,
        {
          math: md`\operatorname{rank} = ${rank}`,
          note: md`Echelon form, with ${plural(rank, "pivot")} (in column${rank > 1 ? "s" : ""} ${red.pivots.map((c) => c + 1).join(", ")})${rank < rows ? ` and ${plural(rows - rank, "zero row")}: ${rows - rank === 1 ? "one row was" : "those rows were"} a combination of the others` : ""}. The rank is the number of pivots.`,
        },
      ],
    };
  }
};

/** The right-hand value that makes a rank-deficient system consistent. */
const consistentValue: Generator = (r) => {
  if (r.next() < 0.5) {
    const a = r.nonzero(-3, 3);
    const b = r.nonzero(-4, 4);
    const k = r.pick([2, 3, -1, -2]);
    const d = r.int(-4, 4);
    const c0 = k * d;
    return {
      prompt: md`For which value of $c$ is the system $${eqn([a, b], d)}$, $${lin([k * a, k * b])} = c$ consistent?`,
      answer: String(c0),
      verify: [`${a}*c - ${paren(k * a)}*${paren(d)} = 0`],
      hint: md`The left side of the second equation is ${k} times the left side of the first. Apply $R_2 \to R_2 - ${paren(k)}R_1$ and look at what the second row says.`,
      solution: [
        { math: md`\left[\begin{array}{cc|c} ${a} & ${b} & ${d} \\ ${k * a} & ${k * b} & c \end{array}\right] \xrightarrow{R_2 \to R_2 ${k < 0 ? "+" : "-"} ${Math.abs(k)}R_1} \left[\begin{array}{cc|c} ${a} & ${b} & ${d} \\ 0 & 0 & c ${signed(-k * d)} \end{array}\right]`, note: md`Row 2 is ${k} times row 1 on the left, so the replacement wipes out its coefficients.` },
        { math: md`0 = c ${signed(-k * d)}`, note: md`The second row is a pivot in the constants column unless its right side is zero. Consistent exactly when $c ${signed(-k * d)} = 0$.` },
        { math: md`c = ${c0}`, note: md`Then the second equation is just ${k} times the first: the two lines coincide, and there are infinitely many solutions. For any other $c$ the lines are parallel and there are none.` },
      ],
    };
  }
  for (;;) {
    const r1 = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    const r2 = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    if (r1[0]! * r2[1]! - r1[1]! * r2[0]! === 0) continue;
    const p = r.int(-2, 2);
    const q = r.int(-2, 2);
    if (p === 0 || q === 0) continue;
    const r3 = r1.map((v, i) => p * v + q * r2[i]!);
    if (maxAbs([r3]) > 9 || r3.every((v) => v === 0)) continue;
    const d1 = r.int(-4, 4);
    const d2 = r.int(-4, 4);
    const c0 = p * d1 + q * d2;
    const [A, B, C, D, E, F, G, H] = [r1[0]!, r1[1]!, d1, r2[0]!, r2[1]!, d2, r3[0]!, r3[1]!];
    const combination = `${p < 0 ? "-" : ""}${Math.abs(p) === 1 ? "" : Math.abs(p)}R_1 ${q < 0 ? "-" : "+"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}R_2`;
    return {
      prompt: md`For which value of $c$ is the system $${eqn(r1, d1)}$, $${eqn(r2, d2)}$, $${lin(r3)} = c$ consistent?`,
      answer: String(c0),
      // The augmented 3x3 built from the first two coefficient columns and the constants must be singular.
      verify: [`${paren(A)}*(${paren(E)}*c - ${paren(F)}*${paren(H)}) - ${paren(B)}*(${paren(D)}*c - ${paren(F)}*${paren(G)}) + ${paren(C)}*(${paren(D)}*${paren(H)} - ${paren(E)}*${paren(G)}) = 0`],
      hint: md`The third equation's left side is a combination of the first two: $${combination}$ on the coefficients. Apply the matching replacement to the augmented matrix and read the last row.`,
      solution: [
        { math: md`${lin(r3)} = ${paren(p)}(${lin(r1)}) ${q < 0 ? "-" : "+"} ${Math.abs(q)}(${lin(r2)})`, note: md`Row 3 of the coefficient matrix is $${combination}$. Elimination will turn it into a zero row.` },
        { math: md`R_3 \to R_3 ${p < 0 ? "+" : "-"} ${Math.abs(p) === 1 ? "" : Math.abs(p)}R_1 ${q < 0 ? "+" : "-"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}R_2: \quad [\,0 \;\; 0 \;\; 0 \mid c ${signed(-c0)}\,]`, note: md`The coefficients vanish; the constant becomes $c - (${paren(p)}\cdot${paren(d1)} ${q < 0 ? "-" : "+"} ${Math.abs(q)}\cdot${paren(d2)}) = c ${signed(-c0)}$.` },
        { math: md`c = ${c0}`, note: md`That row says $0 = c ${signed(-c0)}$. The system is consistent exactly when this is $0 = 0$. The three planes then share a line; for any other $c$ they share nothing.` },
      ],
    };
  }
};

// ── Lesson 4 generators: solution sets ──────────────────────────────────────

/** A system with a free variable: the solution with z fixed. */
const particularSolution: Generator = (r) => {
  for (;;) {
    const rows = r.next() < 0.5 ? 2 : 3;
    const R = randomRref(r, rows, 4, [0, 1]);
    if (R[0]![2] === 0 && R[1]![2] === 0) continue;
    const M = scramble(r, R, 2, { swap: r.next() < 0.3 });
    if (maxAbs(M) > 9 || hasZeroLeft(M) || hasThinRow(M)) continue;
    const red = reduce(M, { aug: true, rref: true, scaleFirst: true });
    if (!red.integral || matAns(red.result) !== matAns(R)) continue;
    const t0 = r.int(-3, 3);
    const [p, q, s, u] = [R[0]![2]!, R[0]![3]!, R[1]![2]!, R[1]![3]!];
    const x0 = q - p * t0;
    const y0 = u - s * t0;
    return {
      prompt: md`Solve ${M.map((row) => `$${rowEqn(row)}$`).join(", ")} together with $z = ${t0}$. The system alone has infinitely many solutions; the extra condition picks one. Give it as $(x, y, z)$.`,
      answer: `(${x0}, ${y0}, ${t0})`,
      form: "tuple",
      hint: md`Reduce the augmented matrix. $z$ has no pivot, so it's free: solve for $x$ and $y$ in terms of $z$, then put in $z = ${t0}$.`,
      solution: [
        { math: matTex(M, true), note: "The augmented matrix." },
        ...red.steps,
        { math: md`x = ${poly([[q, ""], [-p, "t"]])}, \quad y = ${poly([[u, ""], [-s, "t"]])}, \quad z = t`, note: md`Columns 1 and 2 have pivots; column 3 doesn't, so $z$ is free. Call it $t$ and read the pivot unknowns from their rows. This is the whole solution set: a line in space.` },
        { math: md`t = ${t0}: \quad (x, y, z) = (${x0}, ${y0}, ${t0})`, note: md`Check in the first original equation: $${M[0]!.slice(0, 3).map((v, j) => `${paren(v)}${paren([x0, y0, t0][j]!)}`).join(" + ")} = ${M[0]![3]}$.` },
      ],
    };
  }
};

/** How many free variables a consistent system has. */
const freeVariables: Generator = (r) => {
  for (;;) {
    const n = r.pick([3, 3, 4]);
    const rows = r.pick([2, 3]);
    const top = Math.min(rows, n);
    const rank = r.pick([top, top - 1, top - 1, Math.max(1, top - 2)]);
    const pivotCols = [0];
    while (pivotCols.length < rank) {
      const c = r.int(1, n - 1);
      if (!pivotCols.includes(c)) pivotCols.push(c);
    }
    pivotCols.sort((a, b) => a - b);
    const R = randomRref(r, rows, n + 1, pivotCols);
    const M = scramble(r, R, rank, { swap: r.next() < 0.3 });
    if (maxAbs(M) > 9 || hasZeroLeft(M) || hasThinRow(M) || M[0]!.slice(0, n).some((_, j) => M.every((row) => row[j] === 0))) continue;
    const red = reduce(M, { aug: true, rref: true, scaleFirst: true });
    if (!red.integral || red.pivots.length !== rank || red.steps.length > 7) continue;
    const free = [...Array(n).keys()].filter((j) => !pivotCols.includes(j)).map((j) => VARS[j]!);
    const names = VARS.slice(0, n);
    return {
      prompt: md`How many free variables does the system ${M.map((row) => `$${rowEqn(row)}$`).join(", ")} have? The unknowns are $${names.slice(0, -1).join("$, $")}$ and $${names[n - 1]}$.`,
      answer: String(n - rank),
      hint: md`Reduce the augmented matrix. Each unknown whose column has no pivot is free. The count is (number of unknowns) minus (number of pivots).`,
      solution: [
        { math: matTex(M, true), note: md`The augmented matrix, with a column for each of the ${n} unknowns.` },
        ...red.steps,
        {
          math: md`${n} \text{ unknowns} - ${plural(rank, "pivot")} = ${plural(n - rank, "free variable")}`,
          note:
            free.length === 0
              ? md`Every unknown's column has a pivot, so none is free: the solution is unique.`
              : md`Pivots in the column${rank > 1 ? "s" : ""} of $${pivotCols.map((c) => VARS[c]).join("$, $")}$; no pivot in the column${free.length > 1 ? "s" : ""} of $${free.join("$, $")}$. ${free.length > 1 ? "Those are" : "That is"} the free variable${free.length > 1 ? "s" : ""}.`,
        },
      ],
    };
  }
};

/** Classify a system: one solution, none, or infinitely many. */
const howManySolutions: Generator = (r) => {
  const choices = ["Exactly one solution", "No solution", "Infinitely many solutions"];
  if (r.next() < 0.5) {
    for (;;) {
      const kind = r.int(0, 2);
      const a1 = r.nonzero(-3, 3);
      const b1 = r.nonzero(-3, 3);
      const c1 = r.int(-5, 5);
      const k = r.pick([2, -1, -2, 3]);
      let a2: number;
      let b2: number;
      let c2: number;
      if (kind === 0) {
        a2 = r.nonzero(-3, 3);
        b2 = r.nonzero(-4, 4);
        c2 = r.int(-5, 5);
        if (a1 * b2 - a2 * b1 === 0) continue;
      } else {
        a2 = k * a1;
        b2 = k * b1;
        c2 = kind === 2 ? k * c1 : k * c1 + r.nonzero(-4, 4);
      }
      const figure: Figure = {
        kind: "plot",
        x: [-7, 7],
        y: [-7, 7],
        curves: [
          { expr: `(${c1} - (${a1})*x)/(${b1})`, label: eqn([a1, b1], c1), color: 1 },
          { expr: `(${c2} - (${a2})*x)/(${b2})`, label: eqn([a2, b2], c2), color: 2, dashed: kind === 2 },
        ],
      };
      const solution: Step[] =
        kind === 0
          ? [
              { math: md`\begin{vmatrix} ${a1} & ${b1} \\ ${a2} & ${b2} \end{vmatrix} = ${a1 * b2 - a2 * b1} \ne 0`, note: md`The rows aren't proportional: $${a1} \cdot ${paren(b2)} \ne ${b1} \cdot ${paren(a2)}$. Elimination gives two pivots.` },
              { math: choices[0]!, note: md`Two pivots for two unknowns, and no pivot in the constants column: the lines cross once.` },
            ]
          : [
              { math: md`R_2 \to R_2 ${k < 0 ? "+" : "-"} ${Math.abs(k)}R_1: \quad [\,0 \;\; 0 \mid ${c2 - k * c1}\,]`, note: md`Row 2's coefficients are ${k} times row 1's, so the replacement clears them. The constant becomes $${c2} - ${paren(k)}\cdot${paren(c1)} = ${c2 - k * c1}$.` },
              kind === 1
                ? { math: choices[1]!, note: md`The last row says $0 = ${c2 - k * c1}$: a pivot in the constants column. The lines are parallel and never meet.` }
                : { math: choices[2]!, note: md`The last row is $0 = 0$: the second equation was ${k} times the first. One pivot, one free variable. The two equations are the same line.` },
            ];
      return {
        prompt: md`How many solutions does the system $${eqn([a1, b1], c1)}$, $${eqn([a2, b2], c2)}$ have?`,
        accept: [choices[kind]!],
        choices,
        figure,
        hint: md`Are the coefficient rows proportional? If not, there are two pivots. If so, check whether the constants are in the same proportion.`,
        solution,
      };
    }
  }
  for (;;) {
    const kind = r.int(0, 2);
    const pivotCols = kind === 0 ? [0, 1, 2] : kind === 1 ? [0, 1, 3] : r.pick([[0, 1], [0, 2]]);
    const R = randomRref(r, 3, 4, pivotCols);
    const M = scramble(r, R, pivotCols.length, { swap: r.next() < 0.3 });
    if (maxAbs(M) > 9 || hasZeroLeft(M) || hasThinRow(M)) continue;
    const red = reduce(M, { aug: true, rref: true, scaleFirst: true });
    if (!red.integral || red.steps.length > 7 || matAns(red.result) !== matAns(R)) continue;
    return {
      prompt: md`How many solutions does the system ${M.map((row) => `$${rowEqn(row)}$`).join(", ")} have?`,
      accept: [choices[kind]!],
      choices,
      hint: md`Reduce the augmented matrix. A pivot in the constants column means none; a pivot in every unknown's column means one; a free variable means infinitely many.`,
      solution: [{ math: matTex(M, true), note: "The augmented matrix." }, ...red.steps, readRref(R, red.pivots, 3), { math: choices[kind]!, note: "" }],
    };
  }
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit1: Unit = {
  title: "Linear Systems",
  lessons: [
    {
      id: slug("Systems as rows and as columns"),
      title: "Systems as rows and as columns",
      summary: "Two honest pictures of one system: each equation as a line or plane the solution must lie on, or the whole system as a single vector equation asking how to combine the columns.",
      blocks: [
        {
          kind: "text",
          body: md`Algebra 3 taught you to solve a system by elimination. Linear algebra begins by asking what a system *is*. Take

$$\begin{cases} x + 2y = 5 \\ 3x - y = 1 \end{cases}$$

There are two pictures of it, and they look nothing alike. The first is the one you already know. The second is the one this whole course is built on.`,
        },
        {
          kind: "key",
          title: "The row picture",
          body: md`Each equation, taken by itself, is a **line** in the plane (or a **plane** in space, when there are three unknowns). A solution of the system is a point that lies on every one of them. The solution set is the **intersection** of the lines or planes.

For the system above, $x + 2y = 5$ and $3x - y = 1$ are two lines, and they cross at $(1, 2)$. That point is the only solution.`,
        },
        {
          kind: "plot",
          x: [-6, 8],
          y: [-5, 7],
          curves: [
            { expr: "(5 - x)/2", label: "x + 2y = 5", color: 1 },
            { expr: "a x - b", label: "{a}x - y = {b}", color: 2 },
          ],
          points: [{ x: "(5 + 2b)/(1 + 2a)", y: "(5 - (5 + 2b)/(1 + 2a))/2", label: "P", color: 4 }],
          params: [
            { name: "a", tex: "a", min: -3, max: 3, step: 1, value: 3 },
            { name: "b", tex: "b", min: -4, max: 4, step: 1, value: 1 },
          ],
          caption: md`The row picture of $x + 2y = 5$ together with $ax - y = b$. Change the second equation and watch the solution $P$ slide along the fixed line. Every choice here gives exactly one crossing; the slider stops short of $a = -\frac{1}{2}$, where the lines would be parallel.`,
        },
        {
          kind: "key",
          title: "The column picture",
          body: md`Now read the same system down the columns instead of across the rows. Collect the $x$-coefficients into one vector and the $y$-coefficients into another:

$$x \begin{bmatrix} 1 \\ 3 \end{bmatrix} + y \begin{bmatrix} 2 \\ -1 \end{bmatrix} = \begin{bmatrix} 5 \\ 1 \end{bmatrix}$$

This is one **vector equation**. The unknowns $x$ and $y$ are **weights**, and the question is: how much of the first column and how much of the second column add up to the right side? A sum of scaled vectors like $x\mathbf{a}_1 + y\mathbf{a}_2$ is called a **linear combination** of $\mathbf{a}_1$ and $\mathbf{a}_2$.`,
        },
        {
          kind: "why",
          title: "Why the two pictures are the same system",
          body: md`Vectors are added and scaled entry by entry, so the left side of the vector equation is

$$x \begin{bmatrix} 1 \\ 3 \end{bmatrix} + y \begin{bmatrix} 2 \\ -1 \end{bmatrix} = \begin{bmatrix} x + 2y \\ 3x - y \end{bmatrix}.$$

Two vectors are equal exactly when their entries agree. So the vector equation holds exactly when $x + 2y = 5$ **and** $3x - y = 1$: the original two equations. Nothing was added and nothing was lost. The row picture reads the system one equation at a time; the column picture reads it one unknown at a time.`,
        },
        {
          kind: "proof",
          title: "The row picture and the column picture have the same solutions",
          given: md`A system of $m$ equations in $n$ unknowns with coefficients $a_{ij}$ and right sides $b_i$; $\mathbf{a}_j$ is the column of coefficients of the $j$-th unknown`,
          prove: md`$(x_1, \ldots, x_n)$ satisfies every equation if and only if $x_1\mathbf{a}_1 + \cdots + x_n\mathbf{a}_n = \mathbf{b}$`,
          steps: [
            { statement: md`Entry $i$ of $x_1\mathbf{a}_1 + \cdots + x_n\mathbf{a}_n$ is $a_{i1}x_1 + \cdots + a_{in}x_n$.`, reason: "Scalar multiples and sums of vectors are computed entry by entry." },
            { statement: md`The vector equation holds if and only if entry $i$ of the left side equals $b_i$ for every $i$.`, reason: "Two vectors are equal exactly when all their entries agree." },
            { statement: md`That is, if and only if $a_{i1}x_1 + \cdots + a_{in}x_n = b_i$ for every $i = 1, \ldots, m$.`, reason: "Steps 1 and 2 together." },
            { statement: md`These are exactly the $m$ equations of the system.`, reason: "Definition of the system: equation $i$ has coefficients $a_{i1}, \ldots, a_{in}$ and right side $b_i$." },
          ],
        },
        {
          kind: "diagram",
          view: [-5, 9, -2, 13],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "" },
            { name: "A", x: 2, y: 1, label: md`\mathbf{a}_1`, dir: "se" },
            { name: "B", x: -1, y: 2, label: md`\mathbf{a}_2`, dir: "nw" },
            { name: "S", x: "2c", y: "c", label: "", hidden: true },
            { name: "P", x: "2c - d", y: "c + 2d", label: md`({=2c - d},\, {=c + 2d})`, dir: "e" },
            { name: "T", x: 4, y: 7, label: md`\mathbf{b} = (4, 7)`, dir: "ne" },
          ],
          segments: [
            { from: "O", to: "A", arrow: true, color: 1 },
            { from: "O", to: "B", arrow: true, color: 2 },
            { from: "O", to: "S", arrow: true, color: 1, dashed: true, label: md`{c}\,\mathbf{a}_1` },
            { from: "S", to: "P", arrow: true, color: 2, dashed: true, label: md`{d}\,\mathbf{a}_2` },
            { from: "O", to: "P", arrow: true, color: 3 },
          ],
          params: [
            { name: "c", tex: "c", min: -1, max: 4, step: 1, value: 1 },
            { name: "d", tex: "d", min: -1, max: 4, step: 1, value: 1 },
          ],
          readouts: [
            { label: "2c - d", value: "2c - d" },
            { label: "c + 2d", value: "c + 2d" },
          ],
          caption: md`The column picture of $2x - y = 4$, $x + 2y = 7$. The columns are $\mathbf{a}_1 = (2, 1)$ and $\mathbf{a}_2 = (-1, 2)$. Slide the weights $c$ and $d$ until $c\,\mathbf{a}_1 + d\,\mathbf{a}_2$ (the green arrow) lands on $\mathbf{b}$. The weights that work are the solution $(x, y)$ of the system.`,
        },
        {
          kind: "example",
          title: "One system, both pictures",
          problem: md`Solve $x + 2y = 5$, $3x - y = 1$, then read the answer in the column picture.`,
          steps: [
            { math: md`E_2 - 3E_1: \quad -7y = -14`, note: md`Row picture, by elimination: subtract 3 times the first equation from the second so the $x$ disappears.` },
            { math: md`y = 2, \qquad x = 5 - 2(2) = 1`, note: "Solve for y, then back-substitute into the first equation." },
            { math: md`1 \begin{bmatrix} 1 \\ 3 \end{bmatrix} + 2 \begin{bmatrix} 2 \\ -1 \end{bmatrix} = \begin{bmatrix} 1 + 4 \\ 3 - 2 \end{bmatrix} = \begin{bmatrix} 5 \\ 1 \end{bmatrix}`, note: md`Column picture: one copy of the first column plus two copies of the second lands exactly on $\mathbf{b}$. Same numbers, different meaning: $(1, 2)$ is a point where two lines cross, and also the recipe for building $\mathbf{b}$ out of the columns.` },
          ],
        },
        {
          kind: "key",
          title: "The matrix form A x = b",
          body: md`Put the coefficients in a matrix $A$, the unknowns in a vector $\mathbf{x}$ and the right sides in a vector $\mathbf{b}$:

$$A = \begin{bmatrix} 1 & 2 \\ 3 & -1 \end{bmatrix}, \quad \mathbf{x} = \begin{bmatrix} x \\ y \end{bmatrix}, \quad \mathbf{b} = \begin{bmatrix} 5 \\ 1 \end{bmatrix}, \qquad A\mathbf{x} = \mathbf{b}.$$

The product $A\mathbf{x}$ is **defined** as the column picture: the linear combination of the columns of $A$ with the entries of $\mathbf{x}$ as weights,

$$A\mathbf{x} = x_1 \mathbf{a}_1 + x_2 \mathbf{a}_2 + \cdots + x_n \mathbf{a}_n.$$

It only makes sense when $\mathbf{x}$ has one entry per column of $A$. The result has one entry per row of $A$.`,
        },
        {
          kind: "why",
          title: "Why the row rule computes the same A x",
          body: md`Entry $i$ of $x_1\mathbf{a}_1 + \cdots + x_n\mathbf{a}_n$ is $a_{i1}x_1 + a_{i2}x_2 + \cdots + a_{in}x_n$. That is the dot product of **row $i$ of $A$** with $\mathbf{x}$. So there are two ways to compute $A\mathbf{x}$ and they always agree:

- **Column rule:** scale each column by its weight and add. This is the definition, and the one that explains things.
- **Row rule:** each entry of the answer is a row of $A$ dotted with $\mathbf{x}$. This is the fast way to compute by hand.

With $A\mathbf{x}$ defined, the whole system is the one equation $A\mathbf{x} = \mathbf{b}$, and the question "does the system have a solution?" becomes "is $\mathbf{b}$ a combination of the columns of $A$?"`,
        },
        {
          kind: "example",
          title: "Computing A x two ways",
          problem: md`Compute $A\mathbf{x}$ for $A = \begin{bmatrix} 1 & 2 & -1 \\ 0 & 3 & 2 \end{bmatrix}$ and $\mathbf{x} = \begin{bmatrix} 2 \\ -1 \\ 3 \end{bmatrix}$.`,
          steps: [
            { math: md`2 \begin{bmatrix} 1 \\ 0 \end{bmatrix} - 1 \begin{bmatrix} 2 \\ 3 \end{bmatrix} + 3 \begin{bmatrix} -1 \\ 2 \end{bmatrix}`, note: "Column rule: the three columns, weighted by 2, -1 and 3." },
            { math: md`\begin{bmatrix} 2 - 2 - 3 \\ 0 - 3 + 6 \end{bmatrix} = \begin{bmatrix} -3 \\ 3 \end{bmatrix}`, note: "Add entry by entry." },
            { math: md`\begin{bmatrix} 1(2) + 2(-1) + (-1)(3) \\ 0(2) + 3(-1) + 2(3) \end{bmatrix} = \begin{bmatrix} -3 \\ 3 \end{bmatrix}`, note: md`Row rule: row 1 dotted with $\mathbf{x}$, then row 2 dotted with $\mathbf{x}$. Same vector. Note the shape: a $2 \times 3$ matrix times a vector with 3 entries gives a vector with 2 entries.` },
          ],
        },
        {
          kind: "text",
          body: md`**Three unknowns.** With $x$, $y$, $z$ each equation $ax + by + cz = d$ is a plane, and the row picture of three equations is three planes, meeting (usually) in one point. The column picture is three arrows in space, and $\mathbf{b}$ is a fourth: can the first three be stretched and added to reach the fourth?

The column picture is harder to draw but easier to think with. When two lines are parallel, the row picture just says "they don't meet." The column picture says *why*: the two columns point the same way, so every combination of them lies on one line through the origin, and $\mathbf{b}$ is off that line. What the columns can reach is called their **span**; it's the subject of Unit 2. Which outcomes a system can have is the subject of Lesson 4.`,
        },
        {
          kind: "check",
          prompt: md`Write the coefficient matrix $A$ of the system $2x - y = 3$, $x + 4y = -2$. Type it row by row, like [[1, 2], [3, 4]].`,
          answer: "[[2, -1], [1, 4]]",
          form: "matrix",
          explain: md`One row per equation, one column per unknown: the $x$-coefficients $2, 1$ make the first column and the $y$-coefficients $-1, 4$ the second. The constants $3, -2$ are $\mathbf{b}$, not part of $A$.`,
        },
        {
          kind: "check",
          prompt: md`Find the weights $x$ and $y$ with $x \begin{bmatrix} 1 \\ 2 \end{bmatrix} + y \begin{bmatrix} 3 \\ 0 \end{bmatrix} = \begin{bmatrix} 5 \\ 4 \end{bmatrix}$. Give them as $(x, y)$.`,
          answer: "(2, 1)",
          form: "tuple",
          explain: md`Bottom entries: $2x + 0y = 4$, so $x = 2$. Top entries: $x + 3y = 5$, so $3y = 3$ and $y = 1$. Check: $2(1, 2) + 1(3, 0) = (5, 4)$.`,
        },
      ],
      practice: [columnWeights, matrixTimesVector, solveRowPicture],
    },
    {
      id: slug("Gaussian elimination"),
      title: "Gaussian elimination",
      summary: "The algorithm that solves every linear system: pivots and multipliers, why it always finishes, and a proof that no row operation ever loses or invents a solution.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 3, elimination was a set of legal moves. Here it becomes an **algorithm**: a fixed procedure that takes any system, of any size, to a form you can read off, in a known number of steps. Everything later in the course (rank, inverses, bases, eigenvectors) is computed by running it. So it's worth being exact about what it does and why each step is safe.`,
        },
        {
          kind: "key",
          title: "The three row operations",
          body: md`Working on the augmented matrix $[\,A \mid \mathbf{b}\,]$, where each row is one equation:

- **Swap** two rows: $R_i \leftrightarrow R_j$.
- **Scale** a row by a nonzero number: $R_i \to kR_i$, $k \ne 0$.
- **Replace** a row by itself plus a multiple of another: $R_i \to R_i + kR_j$.

Two matrices connected by a chain of these are **row equivalent**. The claim that makes elimination work: row-equivalent augmented matrices describe systems with exactly the same solution set.`,
        },
        {
          kind: "why",
          title: "Why replacement is safe, in both directions",
          body: md`Suppose $(x, y)$ satisfies equations $E_1$ and $E_2$. Then it certainly satisfies $E_2 + kE_1$: if two things are true, so is any combination of them. So every old solution is a new solution.

The worry is the other way: might the new system have *extra* solutions? No, because the move can be undone by a move of the same kind. From $E_1$ and $E_2 + kE_1$, subtract $k E_1$ and you have $E_2$ back. Any point satisfying the new pair satisfies the old pair by the same argument. Reversibility is the whole point: a scale by $k$ is undone by a scale by $\frac{1}{k}$, which is why $k = 0$ is forbidden. Multiplying by 0 turns an equation into $0 = 0$, which everything satisfies, and there is no way back.`,
        },
        {
          kind: "proof",
          title: "Row operations preserve the solution set",
          given: md`System $S'$ is obtained from system $S$ by one elementary row operation`,
          prove: md`$S$ and $S'$ have exactly the same solutions`,
          steps: [
            { statement: md`Every solution of $S$ is a solution of $S'$.`, reason: md`Swap: the same equations. Scale: if $L = R$ then $kL = kR$. Replace: if $L_i = R_i$ and $L_j = R_j$ then $L_i + kL_j = R_i + kR_j$.` },
            { statement: md`There is an elementary row operation taking $S'$ back to $S$.`, reason: md`Swap the same rows again; scale by $\frac{1}{k}$, which exists because $k \ne 0$; replace $R_i \to R_i - kR_j$.` },
            { statement: md`Every solution of $S'$ is a solution of $S$.`, reason: "Apply step 1 to the reverse operation of step 2." },
            { statement: md`The two solution sets are equal.`, reason: "Each is contained in the other." },
            { statement: md`Any chain of row operations preserves the solution set.`, reason: "Apply the result at each link of the chain." },
          ],
        },
        {
          kind: "plot",
          x: [-3, 7],
          y: [-3, 6],
          curves: [
            { expr: "x - 1", label: "E_1: x - y = 1", color: 1 },
            { expr: "(7 - x)/2", label: "E_2: x + 2y = 7", color: 2 },
            { expr: "(7 + k - (1 + k) x)/(2 - k)", label: "E_2 + kE_1", color: 3, dashed: true },
          ],
          points: [{ x: 3, y: 2, label: "(3, 2)", color: 4 }],
          params: [{ name: "k", tex: "k", min: -4, max: 1, step: 1, value: -1 }],
          caption: md`Replacement in the row picture. The dashed line is $E_2 + kE_1$. As $k$ changes it turns, but always about the solution $(3, 2)$, because that point satisfies $E_1$ and $E_2$ and therefore every combination of them. At $k = -1$ the $x$ terms cancel and the line is horizontal: $3y = 6$, the eliminated equation.`,
        },
        {
          kind: "key",
          title: "Gaussian elimination",
          body: md`**Forward phase.** Repeat on the rows not yet used:

1. Find the leftmost column that has a nonzero entry in an unused row. Swap such a row to the top of the unused block. That entry is the **pivot** for this column.
2. For each row below the pivot row, compute the **multiplier** $m = \dfrac{\text{entry in the pivot column}}{\text{pivot}}$ and replace the row by itself minus $m$ times the pivot row. The entry becomes 0.
3. Mark the pivot row as used and go back to step 1.

When the unused rows run out, or are all zero, the matrix is in **echelon form**: a staircase of pivots, zeros below each. **Back-substitution** then solves the last equation for its unknown and feeds it upward.`,
        },
        {
          kind: "why",
          title: "Why one multiplier clears the entry, and why the algorithm stops",
          body: md`If the pivot is $p$ and the entry below it is $a$, the replacement puts $a - \frac{a}{p} \cdot p = a - a = 0$ in that position. Entries to the left of the pivot column are already 0 in both rows, so they stay 0: clearing one column never undoes an earlier one. Entries to the right change, but we haven't dealt with those columns yet.

Each round uses up one row and moves at least one column to the right. A matrix has finitely many rows and columns, so the rounds run out. Elimination always ends, in at most $\min(m, n)$ rounds for an $m \times n$ coefficient matrix. The arithmetic is about $\frac{n^3}{3}$ multiplications for an $n \times n$ system, which is why computers solve systems with thousands of unknowns this way rather than by any formula.`,
        },
        {
          kind: "example",
          title: "Elimination in three unknowns",
          problem: md`Solve $x + y + z = 6$, $\;2x + 3y - z = 5$, $\;-x + 2y - 8z = -21$.`,
          steps: [
            { math: md`\left[\begin{array}{ccc|c} 1 & 1 & 1 & 6 \\ 2 & 3 & -1 & 5 \\ -1 & 2 & -8 & -21 \end{array}\right]`, note: "The augmented matrix. The first pivot is the 1 in the corner." },
            { math: md`\xrightarrow{R_2 \to R_2 - 2R_1,\; R_3 \to R_3 + R_1} \left[\begin{array}{ccc|c} 1 & 1 & 1 & 6 \\ 0 & 1 & -3 & -7 \\ 0 & 3 & -7 & -15 \end{array}\right]`, note: md`Multipliers $\frac{2}{1} = 2$ and $\frac{-1}{1} = -1$. Column 1 is clear below the pivot.` },
            { math: md`\xrightarrow{R_3 \to R_3 - 3R_2} \left[\begin{array}{ccc|c} 1 & 1 & 1 & 6 \\ 0 & 1 & -3 & -7 \\ 0 & 0 & 2 & 6 \end{array}\right]`, note: md`Second pivot: the 1 in row 2. Multiplier $\frac{3}{1} = 3$. Echelon form, pivots $1, 1, 2$.` },
            { math: md`2z = 6 \Rightarrow z = 3, \qquad y - 3(3) = -7 \Rightarrow y = 2, \qquad x + 2 + 3 = 6 \Rightarrow x = 1`, note: md`Back-substitute from the bottom up. The solution is $(1, 2, 3)$. Check the third original equation: $-1 + 4 - 24 = -21$.` },
          ],
        },
        {
          kind: "example",
          title: "When the pivot position holds a zero",
          problem: md`Solve $2y + z = 5$, $\;x + y - z = 2$, $\;3x + 4y + 2z = 13$.`,
          steps: [
            { math: md`\left[\begin{array}{ccc|c} 0 & 2 & 1 & 5 \\ 1 & 1 & -1 & 2 \\ 3 & 4 & 2 & 13 \end{array}\right] \xrightarrow{R_1 \leftrightarrow R_2} \left[\begin{array}{ccc|c} 1 & 1 & -1 & 2 \\ 0 & 2 & 1 & 5 \\ 3 & 4 & 2 & 13 \end{array}\right]`, note: "The corner entry is 0 and can't be a pivot (you can't divide by it). Swap a row with a nonzero first entry to the top." },
            { math: md`\xrightarrow{R_3 \to R_3 - 3R_1} \left[\begin{array}{ccc|c} 1 & 1 & -1 & 2 \\ 0 & 2 & 1 & 5 \\ 0 & 1 & 5 & 7 \end{array}\right]`, note: "Row 2 already has a 0 in column 1; only row 3 needs clearing." },
            { math: md`\xrightarrow{R_2 \leftrightarrow R_3} \left[\begin{array}{ccc|c} 1 & 1 & -1 & 2 \\ 0 & 1 & 5 & 7 \\ 0 & 2 & 1 & 5 \end{array}\right]`, note: md`Either row could supply the second pivot. Using the 2 would make the multiplier $\frac{1}{2}$ and bring in fractions. Swapping the 1 up keeps everything whole. Any nonzero entry works; a convenient one saves effort.` },
            { math: md`\xrightarrow{R_3 \to R_3 - 2R_2} \left[\begin{array}{ccc|c} 1 & 1 & -1 & 2 \\ 0 & 1 & 5 & 7 \\ 0 & 0 & -9 & -9 \end{array}\right]`, note: "Echelon form." },
            { math: md`z = 1, \qquad y = 7 - 5(1) = 2, \qquad x = 2 - 2 + 1 = 1`, note: md`Back-substitution gives $(1, 2, 1)$.` },
          ],
        },
        {
          kind: "text",
          body: md`**What elimination can turn up.** Sometimes a row comes out as $[\,0 \;\; 0 \;\; 0 \mid c\,]$ with $c \ne 0$. It says $0 = c$, and since row operations preserve solutions, the original system has none. Sometimes a row comes out as all zeros: that equation was a combination of the others and carried no new information, and the system will have a free choice somewhere. Lesson 4 sorts out exactly what happens in each case. For now, the point is that elimination never fails: it always reaches echelon form, and the echelon form always tells you the truth about the system.`,
        },
        {
          kind: "check",
          prompt: md`In $\left[\begin{array}{ccc|c} 2 & 1 & -1 & 4 \\ 1 & 3 & 0 & 2 \\ -6 & 2 & 5 & 1 \end{array}\right]$, with the 2 as the first pivot, what multiplier $m$ is used to clear the first entry of row 3 (that is, $R_3 \to R_3 - mR_1$)?`,
          answer: "-3",
          explain: md`$m = \frac{-6}{2} = -3$. Then $R_3 \to R_3 - (-3)R_1 = R_3 + 3R_1$, and the first entry becomes $-6 + 6 = 0$.`,
        },
        {
          kind: "check",
          prompt: md`Apply $R_2 \to R_2 - 3R_1$ to $\left[\begin{array}{cc|c} 1 & -2 & 4 \\ 3 & 1 & 5 \end{array}\right]$. Type the result row by row, like [[1, 2, 3], [4, 5, 6]].`,
          answer: "[[1, -2, 4], [0, 7, -7]]",
          form: "matrix",
          explain: md`Row 2 minus three times row 1: $[3 - 3,\; 1 + 6 \mid 5 - 12] = [0,\; 7 \mid -7]$. Row 1 is unchanged. The new second row says $7y = -7$.`,
        },
      ],
      practice: [clearColumn, eliminate3, zeroPivot],
    },
    {
      id: slug("Row echelon form"),
      title: "Row echelon form",
      summary: "Name elimination's end product precisely: echelon form, the unique reduced form, pivot columns and rank, and the test that tells a consistent system from an inconsistent one.",
      blocks: [
        {
          kind: "text",
          body: md`Elimination stops at a staircase. This lesson gives the staircase a precise definition, pushes it one step further to a form that is the *same for everyone*, and extracts from it a single number, the rank, that summarizes what a matrix can do.`,
        },
        {
          kind: "key",
          title: "Row echelon form",
          body: md`The first nonzero entry of a nonzero row is its **leading entry**. A matrix is in **row echelon form** when

- all rows of zeros are at the bottom, and
- each leading entry is strictly to the right of the leading entry of the row above.

The leading entries are the **pivots**, their positions are the **pivot positions**, and the columns that contain one are the **pivot columns**. Below every pivot there are only zeros. Elimination's forward phase produces exactly this.`,
        },
        {
          kind: "key",
          title: "Reduced row echelon form",
          body: md`A matrix is in **reduced row echelon form** (RREF) when it is in echelon form and, in addition,

- every pivot is 1, and
- each pivot is the only nonzero entry in its column.

Getting there from echelon form takes two more kinds of step: scale each pivot row to make the pivot 1, and clear **above** each pivot, working from the last pivot back to the first. The whole procedure, forward and backward, is **Gauss-Jordan elimination**.`,
        },
        {
          kind: "example",
          title: "All the way to reduced form",
          problem: md`Reduce $\left[\begin{array}{ccc|c} 1 & 1 & 1 & 4 \\ 2 & 3 & 1 & 11 \\ -1 & 0 & -2 & -1 \end{array}\right]$ to RREF.`,
          steps: [
            { math: md`\xrightarrow{R_2 \to R_2 - 2R_1,\; R_3 \to R_3 + R_1} \left[\begin{array}{ccc|c} 1 & 1 & 1 & 4 \\ 0 & 1 & -1 & 3 \\ 0 & 1 & -1 & 3 \end{array}\right]`, note: "Clear column 1 below the pivot." },
            { math: md`\xrightarrow{R_3 \to R_3 - R_2} \left[\begin{array}{ccc|c} 1 & 1 & 1 & 4 \\ 0 & 1 & -1 & 3 \\ 0 & 0 & 0 & 0 \end{array}\right]`, note: md`Clear column 2 below its pivot. Row 3 vanishes entirely: the third equation was a combination of the first two. Echelon form, with pivots in columns 1 and 2 only.` },
            { math: md`\xrightarrow{R_1 \to R_1 - R_2} \left[\begin{array}{ccc|c} 1 & 0 & 2 & 1 \\ 0 & 1 & -1 & 3 \\ 0 & 0 & 0 & 0 \end{array}\right]`, note: md`Both pivots are already 1. Clear above the second pivot. This is RREF: it reads $x + 2z = 1$ and $y - z = 3$, with nothing said about $z$. Column 3 is not a pivot column.` },
          ],
        },
        {
          kind: "why",
          title: "Why echelon forms vary but the reduced form doesn't",
          body: md`A matrix has many echelon forms. Scale a row, or add a lower row to an upper one, and it's still a staircase. So "the echelon form" of a matrix isn't a well-defined thing. The reduced form is.

Here is the reason, in outline. Row operations don't change the solutions of $A\mathbf{x} = \mathbf{0}$. In particular they don't change which columns can be written as combinations of the columns to their left: that is a statement about solutions of $A\mathbf{x} = \mathbf{0}$ with a particular pattern of zeros. A column is a pivot column exactly when it is **not** a combination of the columns before it, so the pivot columns are fixed by $A$ itself. And in RREF, each non-pivot column's entries are precisely the weights that express that column in terms of the earlier pivot columns, which are also fixed by $A$. Every entry of the RREF is therefore determined by $A$, not by the route taken.

**Theorem (uniqueness of RREF).** Every matrix is row equivalent to exactly one matrix in reduced row echelon form. Unit 5 has the tools to make the outline above a full proof.`,
        },
        {
          kind: "key",
          title: "Rank",
          body: md`The **rank** of a matrix is the number of pivots in its echelon form, which is also the number of nonzero rows there. By the uniqueness theorem, every route to echelon form gives the same pivot columns, so rank is well defined.

Since each pivot uses up a row and a column, $\operatorname{rank} A \le m$ and $\operatorname{rank} A \le n$ for an $m \times n$ matrix. A square matrix with $\operatorname{rank} A = n$ is said to have **full rank**: a pivot in every column, and every row.`,
        },
        {
          kind: "why",
          title: "What rank counts",
          body: md`Rank is the number of equations that carry independent information. In the example above, the third equation $-x - 2z = -1$ is exactly $E_2 - 3E_1$: it followed from the first two and told us nothing new. Elimination exposed that by turning it into a zero row. Three equations, rank 2: effectively two equations.

Read down the columns instead and rank counts the number of columns that aren't combinations of earlier ones. In Unit 2 this becomes the number of **linearly independent** columns, and in Unit 5 the dimension of the column space. All three descriptions give the same number; that is one of the central facts of the subject.`,
        },
        {
          kind: "plot",
          x: [-2, 8],
          y: [-2, 5],
          curves: [
            { expr: "(6 - 2x)/4", label: "2x + 4y = 6", color: 1 },
            { expr: "(c - x)/2", label: "x + 2y = {c}", color: 2, dashed: true },
          ],
          params: [{ name: "c", tex: "c", min: 0, max: 6, step: 1, value: 3 }],
          caption: md`The coefficient matrix $\begin{bmatrix} 2 & 4 \\ 1 & 2 \end{bmatrix}$ has rank 1 whatever $c$ is: its second row is half its first. The augmented matrix has rank 1 only when $c = 3$, when the two equations describe the same line. For every other $c$ the augmented matrix has rank 2, the extra pivot lands in the constants column, and the lines are parallel.`,
        },
        {
          kind: "key",
          title: "The consistency test",
          body: md`A system is **consistent** if it has at least one solution and **inconsistent** if it has none.

**Theorem.** A system is consistent if and only if an echelon form of its augmented matrix has **no pivot in the last column**. Equivalently, $\operatorname{rank} A = \operatorname{rank}[\,A \mid \mathbf{b}\,]$.

A pivot in the last column is a row $[\,0 \;\cdots\; 0 \mid c\,]$ with $c \ne 0$: the equation $0 = c$.`,
        },
        {
          kind: "proof",
          title: "The consistency test",
          given: md`The augmented matrix $[\,A \mid \mathbf{b}\,]$ has been row-reduced to an echelon form`,
          prove: md`The system has a solution if and only if no pivot lies in the last column`,
          steps: [
            { statement: md`Suppose a pivot lies in the last column, in row $i$. Then row $i$ is $[\,0 \;\cdots\; 0 \mid p\,]$ with $p \ne 0$.`, reason: "In echelon form every entry left of a pivot in its row is zero, and a pivot is nonzero." },
            { statement: md`That row says $0x_1 + \cdots + 0x_n = p$, which no choice of unknowns satisfies. The system is inconsistent.`, reason: md`$0 \ne p$, and row-equivalent systems have the same solutions (Lesson 2).` },
            { statement: md`Now suppose no pivot lies in the last column. Continue to RREF; every pivot still lies in a column of unknowns.`, reason: "Scaling rows and clearing above pivots never moves a pivot position." },
            { statement: md`Set every free unknown (no pivot in its column) to 0. Each nonzero row then reads $x_j = (\text{its right side})$ for its pivot unknown $x_j$; each zero row reads $0 = 0$.`, reason: "In RREF a pivot is the only nonzero entry in its column, so each pivot unknown appears in exactly one row, with coefficient 1, alongside only free unknowns." },
            { statement: md`This assignment satisfies every row, so it is a solution of the original system. The system is consistent.`, reason: "Row-equivalent systems have the same solutions." },
          ],
        },
        {
          kind: "example",
          title: "Rank of a 3 x 3 matrix",
          problem: md`Find the rank of $\begin{bmatrix} 1 & 2 & 3 \\ 2 & 4 & 6 \\ 1 & 1 & 1 \end{bmatrix}$.`,
          steps: [
            { math: md`\xrightarrow{R_2 \to R_2 - 2R_1,\; R_3 \to R_3 - R_1} \begin{bmatrix} 1 & 2 & 3 \\ 0 & 0 & 0 \\ 0 & -1 & -2 \end{bmatrix}`, note: md`Row 2 was twice row 1 and disappears.` },
            { math: md`\xrightarrow{R_2 \leftrightarrow R_3} \begin{bmatrix} 1 & 2 & 3 \\ 0 & -1 & -2 \\ 0 & 0 & 0 \end{bmatrix}`, note: md`Zero rows go to the bottom. Echelon form with pivots $1$ and $-1$ in columns 1 and 2.` },
            { math: md`\operatorname{rank} = 2`, note: md`Two pivots. In the column picture, the third column $(3, 6, 1)$ is $-1 \cdot (1, 2, 1) + 2 \cdot (2, 4, 1)$: a combination of the first two, so it adds no new direction.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Is $\begin{bmatrix} 1 & 0 & 3 \\ 0 & 2 & 1 \end{bmatrix}$ in reduced row echelon form?`,
          choices: ["Yes", "No: a pivot isn't 1", "No: a pivot column has another nonzero entry", "No: the pivots don't step to the right"],
          accept: ["No: a pivot isn't 1"],
          explain: md`It is in echelon form (the pivots 1 and 2 step right, nothing below them), and each pivot is alone in its column. But the second pivot is 2, not 1. Scaling row 2 by $\frac{1}{2}$ gives the RREF $\begin{bmatrix} 1 & 0 & 3 \\ 0 & 1 & \frac{1}{2} \end{bmatrix}$.`,
        },
        {
          kind: "check",
          prompt: md`Find the rank of $\begin{bmatrix} 1 & 2 & -1 \\ 2 & 4 & -2 \\ 0 & 1 & 3 \end{bmatrix}$.`,
          answer: "2",
          explain: md`$R_2 \to R_2 - 2R_1$ makes row 2 all zeros, since it was twice row 1. Swap the zero row to the bottom: pivots in columns 1 and 2, rank 2.`,
        },
      ],
      practice: [toRref, rankOf, consistentValue],
    },
    {
      id: slug("Solution sets"),
      title: "Solution sets",
      summary: "Everything a linear system's solution set can be: empty, one point, or a line, plane or more in parametric vector form, and why the homogeneous system A x = 0 decides the shape.",
      blocks: [
        {
          kind: "text",
          body: md`Two lines in a plane either cross once, never meet, or are the same line. Three planes in space do the same sort of thing with more variety: a point, nothing, a line, or a whole plane. This lesson shows that those are the only possibilities for any linear system of any size, says exactly how to read which one you have, and gives a clean way to write down an infinite solution set.`,
        },
        {
          kind: "key",
          title: "Reading the solution set from the reduced form",
          body: md`Reduce the augmented matrix. Then:

- A pivot in the **last column** (a row $0 = c$, $c \ne 0$): **no solution**.
- Otherwise, a pivot in **every unknown's column**: **exactly one solution**, read straight off the rows.
- Otherwise, some unknown's column has no pivot: **infinitely many solutions**.

An unknown whose column has a pivot is a **basic variable** (or pivot variable); one whose column doesn't is a **free variable**. Free variables can be anything; each basic variable is then fixed by its row. The number of free variables is $n - \operatorname{rank} A$.`,
        },
        {
          kind: "why",
          title: "Why A(u + tv) = Au + tAv",
          body: md`The column rule makes $A\mathbf{x}$ **linear**. If $\mathbf{u}$ and $\mathbf{v}$ have entries $u_j$ and $v_j$, then

$$A(\mathbf{u} + \mathbf{v}) = \sum_j (u_j + v_j)\mathbf{a}_j = \sum_j u_j \mathbf{a}_j + \sum_j v_j \mathbf{a}_j = A\mathbf{u} + A\mathbf{v},$$

and likewise $A(t\mathbf{v}) = \sum_j (t v_j)\mathbf{a}_j = t \sum_j v_j \mathbf{a}_j = t\,A\mathbf{v}$. Together: $A(\mathbf{u} + t\mathbf{v}) = A\mathbf{u} + tA\mathbf{v}$. This one identity is behind everything in this lesson, and it will be the definition of a linear transformation in Unit 3.`,
        },
        {
          kind: "proof",
          title: "A linear system has 0, 1 or infinitely many solutions",
          given: md`$\mathbf{u}$ and $\mathbf{v}$ are two different solutions of $A\mathbf{x} = \mathbf{b}$`,
          prove: md`$A\mathbf{x} = \mathbf{b}$ has infinitely many solutions`,
          steps: [
            { statement: md`For any real number $t$, let $\mathbf{w}_t = \mathbf{u} + t(\mathbf{v} - \mathbf{u})$.`, reason: "A point on the line through the two known solutions." },
            { statement: md`$A\mathbf{w}_t = A\mathbf{u} + t(A\mathbf{v} - A\mathbf{u})$`, reason: md`Linearity of $A\mathbf{x}$ (the why box above), applied twice.` },
            { statement: md`$A\mathbf{w}_t = \mathbf{b} + t(\mathbf{b} - \mathbf{b}) = \mathbf{b}$`, reason: md`$A\mathbf{u} = \mathbf{b}$ and $A\mathbf{v} = \mathbf{b}$.` },
            { statement: md`Different values of $t$ give different vectors $\mathbf{w}_t$.`, reason: md`$\mathbf{v} - \mathbf{u} \ne \mathbf{0}$, so $t(\mathbf{v} - \mathbf{u})$ takes a different value for each $t$.` },
            { statement: md`So there are infinitely many solutions. A system with two solutions has infinitely many; the only other possibilities are none and exactly one.`, reason: "Steps 3 and 4: every point of the line is a solution." },
          ],
        },
        {
          kind: "key",
          title: "Parametric vector form",
          body: md`With one free variable $t$, write each unknown in terms of $t$ and collect the result as one vector equation:

$$\mathbf{x} = \mathbf{p} + t\,\mathbf{v}.$$

That is a **line** through the point $\mathbf{p}$ in the direction $\mathbf{v}$. With two free variables $s$ and $t$ the solution set is $\mathbf{x} = \mathbf{p} + s\,\mathbf{v} + t\,\mathbf{w}$, a **plane**. The number of parameters is the number of free variables, $n - \operatorname{rank} A$.`,
        },
        {
          kind: "example",
          title: "From reduced form to parametric vector form",
          problem: md`Lesson 3 reduced a system to $\left[\begin{array}{ccc|c} 1 & 0 & 2 & 1 \\ 0 & 1 & -1 & 3 \\ 0 & 0 & 0 & 0 \end{array}\right]$. Write all its solutions.`,
          steps: [
            { math: md`x + 2z = 1, \qquad y - z = 3`, note: md`The nonzero rows as equations. Column 3 has no pivot, so $z$ is free. $x$ and $y$ are basic.` },
            { math: md`z = t, \qquad x = 1 - 2t, \qquad y = 3 + t`, note: md`Name the free variable $t$ and solve each row for its basic variable.` },
            { math: md`\begin{bmatrix} x \\ y \\ z \end{bmatrix} = \begin{bmatrix} 1 - 2t \\ 3 + t \\ t \end{bmatrix} = \begin{bmatrix} 1 \\ 3 \\ 0 \end{bmatrix} + t \begin{bmatrix} -2 \\ 1 \\ 1 \end{bmatrix}`, note: md`Split off the part with $t$. The solutions form a line in space through $(1, 3, 0)$ with direction $(-2, 1, 1)$. Setting $t = 2$, for instance, gives the solution $(-3, 5, 2)$.` },
          ],
        },
        {
          kind: "plot",
          x: [-4, 8],
          y: [-3, 5],
          curves: [{ expr: "(4 - x)/2", label: "x + 2y = 4", color: 1 }],
          points: [
            { x: 4, y: 0, label: "\\mathbf{p} = (4, 0)", color: 2 },
            { x: "4 - 2t", y: "t", label: "\\mathbf{p} + {t}\\mathbf{v}", color: 4 },
          ],
          params: [{ name: "t", tex: "t", min: -2, max: 4, step: 0.5, value: 1 }],
          caption: md`One equation in two unknowns, $x + 2y = 4$: rank 1, one free variable. Setting $y = t$ gives $x = 4 - 2t$, so the solutions are $\mathbf{x} = (4, 0) + t(-2, 1)$. Move $t$ and the point runs along the line. The parametric form is a way of naming every point of the solution set by one number.`,
        },
        {
          kind: "key",
          title: "Homogeneous systems and the null space",
          body: md`A system $A\mathbf{x} = \mathbf{0}$, with every right side zero, is **homogeneous**. It is always consistent: $\mathbf{x} = \mathbf{0}$ works, the **trivial solution**. It has other, **nontrivial** solutions exactly when it has a free variable, that is, when $\operatorname{rank} A < n$.

The set of all solutions of $A\mathbf{x} = \mathbf{0}$ is the **null space** of $A$, written $\operatorname{Nul} A$. In parametric form it is $t\,\mathbf{v}$, or $s\,\mathbf{v} + t\,\mathbf{w}$, and so on: always through the origin, since $\mathbf{p} = \mathbf{0}$. Unit 5 studies it properly.`,
        },
        {
          kind: "proof",
          title: "Solutions of A x = b are one particular solution plus the null space",
          given: md`$\mathbf{p}$ is one solution of $A\mathbf{x} = \mathbf{b}$`,
          prove: md`$\mathbf{x}$ solves $A\mathbf{x} = \mathbf{b}$ if and only if $\mathbf{x} = \mathbf{p} + \mathbf{h}$ for some $\mathbf{h}$ with $A\mathbf{h} = \mathbf{0}$`,
          steps: [
            { statement: md`If $A\mathbf{h} = \mathbf{0}$, then $A(\mathbf{p} + \mathbf{h}) = A\mathbf{p} + A\mathbf{h} = \mathbf{b} + \mathbf{0} = \mathbf{b}$.`, reason: "Linearity, then the two given equations." },
            { statement: md`Conversely, if $A\mathbf{x} = \mathbf{b}$, let $\mathbf{h} = \mathbf{x} - \mathbf{p}$. Then $A\mathbf{h} = A\mathbf{x} - A\mathbf{p} = \mathbf{b} - \mathbf{b} = \mathbf{0}$.`, reason: "Linearity again." },
            { statement: md`And $\mathbf{x} = \mathbf{p} + \mathbf{h}$ with $\mathbf{h}$ in the null space.`, reason: md`Rearranging $\mathbf{h} = \mathbf{x} - \mathbf{p}$.` },
            { statement: md`So the solution set of $A\mathbf{x} = \mathbf{b}$ is $\mathbf{p} + \operatorname{Nul} A$: the null space shifted to pass through $\mathbf{p}$.`, reason: "Steps 1 to 3 give both directions." },
          ],
        },
        {
          kind: "text",
          body: md`This explains the shape of every parametric form. In $\mathbf{x} = \mathbf{p} + t\mathbf{v}$, the vector $\mathbf{p}$ is a particular solution and $t\mathbf{v}$ runs through the null space. Change $\mathbf{b}$ and $\mathbf{p}$ changes, but the direction $\mathbf{v}$ does not: it depends only on $A$. The solution sets of $A\mathbf{x} = \mathbf{b}$ for different $\mathbf{b}$ are parallel copies of the null space, or empty.`,
        },
        {
          kind: "diagram",
          view: [-1, 7, -1, 6],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "" },
            { name: "A", x: 2, y: 1, label: md`\mathbf{a}_1`, dir: "se" },
            { name: "B", x: 4, y: 2, label: md`\mathbf{a}_2 = 2\mathbf{a}_1`, dir: "se" },
            { name: "T", x: 4, y: "h", label: md`\mathbf{b} = (4, {h})`, dir: "e" },
            { name: "L", x: -1, y: -0.5, label: "", hidden: true },
            { name: "M", x: 7, y: 3.5, label: "", hidden: true },
          ],
          segments: [
            { from: "L", to: "M", kind: "line", dashed: true },
            { from: "O", to: "A", arrow: true, color: 1 },
            { from: "O", to: "B", arrow: true, color: 2 },
            { from: "O", to: "T", arrow: true, color: 4 },
          ],
          params: [{ name: "h", tex: "h", min: 0, max: 5, step: 1, value: 3 }],
          caption: md`The column picture of $2x + 4y = 4$, $x + 2y = h$. The columns $\mathbf{a}_1 = (2, 1)$ and $\mathbf{a}_2 = (4, 2)$ point the same way, so every combination $x\mathbf{a}_1 + y\mathbf{a}_2$ lies on the dashed line. When $h = 2$, $\mathbf{b}$ is on the line and there are infinitely many ways to reach it (one free variable). For any other $h$ it is off the line and nothing reaches it: no solution.`,
        },
        {
          kind: "example",
          title: "Two free variables",
          problem: md`Find all solutions of $x + 2y - w = 3$, $\;x + 2y + z + w = 4$.`,
          steps: [
            { math: md`\left[\begin{array}{cccc|c} 1 & 2 & 0 & -1 & 3 \\ 1 & 2 & 1 & 1 & 4 \end{array}\right] \xrightarrow{R_2 \to R_2 - R_1} \left[\begin{array}{cccc|c} 1 & 2 & 0 & -1 & 3 \\ 0 & 0 & 1 & 2 & 1 \end{array}\right]`, note: md`Already reduced. Pivots in the columns of $x$ and $z$; the columns of $y$ and $w$ have none. Two equations, four unknowns, rank 2: two free variables.` },
            { math: md`y = s, \quad w = t, \qquad x = 3 - 2s + t, \quad z = 1 - 2t`, note: "Name the free variables and solve each row for its basic variable." },
            { math: md`\begin{bmatrix} x \\ y \\ z \\ w \end{bmatrix} = \begin{bmatrix} 3 \\ 0 \\ 1 \\ 0 \end{bmatrix} + s \begin{bmatrix} -2 \\ 1 \\ 0 \\ 0 \end{bmatrix} + t \begin{bmatrix} 1 \\ 0 \\ -2 \\ 1 \end{bmatrix}`, note: md`A plane in four-dimensional space, through the particular solution $(3, 0, 1, 0)$. The two direction vectors are the solutions of the homogeneous system with $(s, t) = (1, 0)$ and $(0, 1)$.` },
          ],
        },
        {
          kind: "example",
          title: "An inconsistent system",
          problem: md`Solve $x + y = 2$, $\;x - y = 0$, $\;x + 3y = 6$.`,
          steps: [
            { math: md`\left[\begin{array}{cc|c} 1 & 1 & 2 \\ 1 & -1 & 0 \\ 1 & 3 & 6 \end{array}\right] \xrightarrow{R_2 \to R_2 - R_1,\; R_3 \to R_3 - R_1} \left[\begin{array}{cc|c} 1 & 1 & 2 \\ 0 & -2 & -2 \\ 0 & 2 & 4 \end{array}\right]`, note: "Clear column 1." },
            { math: md`\xrightarrow{R_3 \to R_3 + R_2} \left[\begin{array}{cc|c} 1 & 1 & 2 \\ 0 & -2 & -2 \\ 0 & 0 & 2 \end{array}\right]`, note: md`The last row says $0 = 2$. A pivot in the constants column: **no solution**.` },
            { math: md`\text{rank } A = 2, \qquad \text{rank } [\,A \mid \mathbf{b}\,] = 3`, note: md`Three equations in two unknowns are three lines. Any two of them meet, at $(1, 1)$, $(0, 2)$ and $(1.5, 1.5)$, but no point is on all three.` },
          ],
        },
        {
          kind: "plot",
          x: [-2, 5],
          y: [-1, 4],
          curves: [
            { expr: "2 - x", label: "x + y = 2", color: 1 },
            { expr: "x", label: "x - y = 0", color: 2 },
            { expr: "(6 - x)/3", label: "x + 3y = 6", color: 3 },
          ],
          points: [
            { x: 1, y: 1, color: 4 },
            { x: 0, y: 2, color: 4 },
            { x: 1.5, y: 1.5, color: 4 },
          ],
          caption: md`The row picture of the inconsistent system: three lines, three different crossing points, no point common to all. Each pair of equations is consistent; the three together are not.`,
        },
        {
          kind: "check",
          prompt: md`The augmented matrix $\left[\begin{array}{cccc|c} 1 & 3 & 0 & 2 & 5 \\ 0 & 0 & 1 & -1 & 2 \end{array}\right]$ (unknowns $x, y, z, w$) is in reduced form. How many free variables does the system have?`,
          answer: "2",
          explain: md`Pivots in the columns of $x$ and $z$. The columns of $y$ and $w$ have no pivot, so $y$ and $w$ are free: $4 - 2 = 2$ free variables, and the solution set is a plane.`,
        },
        {
          kind: "check",
          prompt: md`The system $x + 2z = 1$, $y - z = 3$ has infinitely many solutions. Find the one with $z = 2$. Give it as $(x, y, z)$.`,
          answer: "(-3, 5, 2)",
          form: "tuple",
          explain: md`With $z = 2$: $x = 1 - 2(2) = -3$ and $y = 3 + 2 = 5$. This is the point $t = 2$ on the line $(1, 3, 0) + t(-2, 1, 1)$.`,
        },
      ],
      practice: [particularSolution, freeVariables, howManySolutions],
    },
  ],
};
