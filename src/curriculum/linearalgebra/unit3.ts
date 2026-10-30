import { frac, fracTex, paren, type Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

type Mat = (number | string)[][];

/** A matrix in LaTeX brackets. */
const matTex = (rows: Mat) => `\\begin{bmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{bmatrix}`;
/** A column vector in LaTeX brackets. */
const colTex = (v: (number | string)[]) => matTex(v.map((x) => [x]));
/** Answer text for a matrix: [[1, 2], [3, 4]]. */
const matAns = (rows: Mat) => `[${rows.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
/** Answer text for a vector: (1, 2). */
const tupleAns = (v: (number | string)[]) => `(${v.join(", ")})`;
const LIKE = "Type the matrix row by row, like [[1, 2], [3, 4]].";

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i]!, 0);
const det2 = (M: number[][]) => M[0]![0]! * M[1]![1]! - M[0]![1]! * M[1]![0]!;
const matVec = (A: number[][], x: number[]) => A.map((row) => dot(row, x));
const mul = (A: number[][], B: number[][]) => A.map((row) => B[0]!.map((_, j) => dot(row, B.map((r) => r[j]!))));
const transpose = (A: number[][]) => A[0]!.map((_, j) => A.map((row) => row[j]!));
const addM = (A: number[][], B: number[][], k = 1, m = 1) => A.map((row, i) => row.map((v, j) => k * v + m * B[i]![j]!));
const scaleM = (k: number, A: number[][]) => A.map((row) => row.map((v) => k * v));
const col = (A: number[][], j: number) => A.map((row) => row[j]!);
const randMat = (r: Rng, m: number, n: number, lo: number, hi: number) => Array.from({ length: m }, () => Array.from({ length: n }, () => r.int(lo, hi)));
const noZeros = (A: number[][]) => A.every((row) => row.every((v) => v !== 0));

/** "2(3) + (-1)(-2)": a row dotted with a vector, products shown. */
const rowDotTex = (row: number[], x: number[]) => row.map((a, i) => `${paren(a)}(${x[i]})`).join(" + ");
/** "2*(3) + (-1)*(-2)": the same in typed syntax, for verify equations. */
const rowDotText = (row: number[], x: number[]) => row.map((a, i) => `${paren(a)}*(${x[i]})`).join(" + ");
/** "2A - B" style scalar combinations as LaTeX. */
const comboTex = (k: number, m: number) => {
  const first = k === 1 ? "A" : k === -1 ? "-A" : `${k}A`;
  const second = m === 0 ? "" : m === 1 ? " + B" : m === -1 ? " - B" : m < 0 ? ` - ${-m}B` : ` + ${m}B`;
  return first + second;
};
/** Letters p, q, r for the parts of a tuple answer, with "0*q" fill so every verify equation names each unknown. */
const tupleLetters = (n: number) => ["p", "q", "r", "s"].slice(0, n);
const onlyLetter = (letters: string[], i: number) => letters.map((l, k) => (k === i ? l : `0*${l}`)).join(" + ");

// Exact entries for rotation matrices: typed text and LaTeX.
type E = { t: string; x: string };
const num = (k: number): E => ({ t: String(k), x: String(k) });
const S2: E = { t: "sqrt(2)/2", x: "\\frac{\\sqrt{2}}{2}" };
const nS2: E = { t: "-sqrt(2)/2", x: "-\\frac{\\sqrt{2}}{2}" };
const S3: E = { t: "sqrt(3)/2", x: "\\frac{\\sqrt{3}}{2}" };
const nS3: E = { t: "-sqrt(3)/2", x: "-\\frac{\\sqrt{3}}{2}" };
const H: E = { t: "1/2", x: "\\frac{1}{2}" };
const nH: E = { t: "-1/2", x: "-\\frac{1}{2}" };
const ints = (M: number[][]): E[][] => M.map((row) => row.map(num));

interface Tf {
  /** Completes "the linear transformation that ...". */
  desc: string;
  M: E[][];
  /** Why the first and second columns are what they are. */
  e1: string;
  e2: string;
  /** Integer entries, when the matrix has them (for image-of-a-point problems). */
  int?: number[][];
  /** Difficulty tier 0, 1, 2. */
  tier: number;
}

function transformations(r: Rng): Tf[] {
  const k = r.pick([2, 3, -2, 4]);
  const s = r.pick([2, 3, 4]);
  const t = r.pick([2, 3, -1]);
  const basic = (M: number[][], desc: string, e1: string, e2: string, tier: number): Tf => ({ desc, M: ints(M), e1, e2, int: M, tier });
  return [
    basic([[0, -1], [1, 0]], md`rotates the plane $90^\circ$ counterclockwise about the origin`, md`$\mathbf{e}_1$ on the positive $x$-axis turns to the positive $y$-axis.`, md`$\mathbf{e}_2$ on the positive $y$-axis turns to the negative $x$-axis.`, 0),
    basic([[-1, 0], [0, -1]], md`rotates the plane $180^\circ$ about the origin`, md`A half turn sends every vector to its opposite.`, md`Same for $\mathbf{e}_2$.`, 0),
    basic([[0, 1], [-1, 0]], md`rotates the plane $90^\circ$ clockwise about the origin`, md`Turning $\mathbf{e}_1$ clockwise a quarter turn lands on the negative $y$-axis.`, md`Turning $\mathbf{e}_2$ clockwise a quarter turn lands on the positive $x$-axis.`, 0),
    basic([[1, 0], [0, -1]], md`reflects the plane across the $x$-axis`, md`$\mathbf{e}_1$ lies on the mirror, so it stays put.`, md`$\mathbf{e}_2$ is perpendicular to the mirror, so it flips to its opposite.`, 0),
    basic([[-1, 0], [0, 1]], md`reflects the plane across the $y$-axis`, md`$\mathbf{e}_1$ is perpendicular to the mirror, so it flips.`, md`$\mathbf{e}_2$ lies on the mirror and stays put.`, 0),
    basic([[0, 1], [1, 0]], md`reflects the plane across the line $y = x$`, md`Reflecting across $y = x$ swaps the coordinates: $(1, 0) \mapsto (0, 1)$.`, md`$(0, 1) \mapsto (1, 0)$.`, 1),
    basic([[0, -1], [-1, 0]], md`reflects the plane across the line $y = -x$`, md`Reflecting across $y = -x$ swaps the coordinates and negates both: $(1, 0) \mapsto (0, -1)$.`, md`$(0, 1) \mapsto (-1, 0)$.`, 1),
    basic([[1, 0], [0, 0]], md`projects the plane onto the $x$-axis`, md`$\mathbf{e}_1$ is already on the axis.`, md`$\mathbf{e}_2$ drops straight down to the origin.`, 1),
    basic([[0, 0], [0, 1]], md`projects the plane onto the $y$-axis`, md`$\mathbf{e}_1$ is squashed to the origin.`, md`$\mathbf{e}_2$ is already on the axis.`, 1),
    basic([[1, k], [0, 1]], md`is the horizontal shear $(x, y) \mapsto (x ${k < 0 ? "-" : "+"} ${Math.abs(k)}y,\; y)$`, md`Put $x = 1, y = 0$ into the rule: $(1, 0)$ doesn't move.`, md`Put $x = 0, y = 1$: $(0, 1) \mapsto (${k}, 1)$.`, 1),
    basic([[1, 0], [k, 1]], md`is the vertical shear $(x, y) \mapsto (x,\; y ${k < 0 ? "-" : "+"} ${Math.abs(k)}x)$`, md`Put $x = 1, y = 0$: $(1, 0) \mapsto (1, ${k})$.`, md`Put $x = 0, y = 1$: $(0, 1)$ doesn't move.`, 1),
    basic([[s, 0], [0, t]], md`is the scaling $(x, y) \mapsto (${s}x,\; ${t}y)$`, md`$(1, 0) \mapsto (${s}, 0)$.`, md`$(0, 1) \mapsto (0, ${t})$.`, 0),
    basic([[s, 0], [0, s]], md`stretches every vector by a factor of ${s} from the origin`, md`$\mathbf{e}_1$ becomes ${s} times as long.`, md`So does $\mathbf{e}_2$.`, 0),
    { desc: md`rotates the plane $45^\circ$ counterclockwise about the origin`, M: [[S2, nS2], [S2, S2]], e1: md`$T(\mathbf{e}_1) = (\cos 45^\circ, \sin 45^\circ)$.`, e2: md`$T(\mathbf{e}_2) = (-\sin 45^\circ, \cos 45^\circ)$: $\mathbf{e}_2$ is $\mathbf{e}_1$ turned a further quarter turn.`, tier: 2 },
    { desc: md`rotates the plane $30^\circ$ counterclockwise about the origin`, M: [[S3, nH], [H, S3]], e1: md`$T(\mathbf{e}_1) = (\cos 30^\circ, \sin 30^\circ)$.`, e2: md`$T(\mathbf{e}_2) = (-\sin 30^\circ, \cos 30^\circ)$.`, tier: 2 },
    { desc: md`rotates the plane $60^\circ$ counterclockwise about the origin`, M: [[H, nS3], [S3, H]], e1: md`$T(\mathbf{e}_1) = (\cos 60^\circ, \sin 60^\circ)$.`, e2: md`$T(\mathbf{e}_2) = (-\sin 60^\circ, \cos 60^\circ)$.`, tier: 2 },
    { desc: md`rotates the plane $45^\circ$ clockwise about the origin`, M: [[S2, S2], [nS2, S2]], e1: md`A clockwise turn by $45^\circ$ is a counterclockwise turn by $-45^\circ$: $T(\mathbf{e}_1) = (\cos(-45^\circ), \sin(-45^\circ))$.`, e2: md`$T(\mathbf{e}_2) = (-\sin(-45^\circ), \cos(-45^\circ))$.`, tier: 2 },
  ];
}

const eTex = (M: E[][]) => matTex(M.map((row) => row.map((e) => e.x)));
const eAns = (M: E[][]) => matAns(M.map((row) => row.map((e) => e.t)));

// ── Lesson 1: Matrix operations ─────────────────────────────────────────────

const combineMatrices: Generator = (r) => {
  const cols = r.pick([2, 2, 3]);
  const A = randMat(r, 2, cols, -5, 6);
  const B = randMat(r, 2, cols, -5, 6);
  const kind = r.int(0, 3);
  if (kind === 0 || kind === 1) {
    const m = kind === 0 ? 1 : -1;
    const result = addM(A, B, 1, m);
    return {
      prompt: md`Let $A = ${matTex(A)}$ and $B = ${matTex(B)}$. Compute $${comboTex(1, m)}$. ${LIKE}`,
      answer: matAns(result),
      form: "matrix",
      hint: md`${m === 1 ? "Add" : "Subtract"} the entries that sit in the same position. The matrices have the same size, so every entry has a partner.`,
      solution: [
        {
          math: md`${matTex(A.map((row, i) => row.map((v, j) => `${v} ${m === 1 ? "+" : "-"} ${paren(B[i]![j]!)}`)))}`,
          note: md`Pair each entry of $A$ with the entry of $B$ in the same row and column.`,
        },
        { math: matTex(result), note: "" },
      ],
    };
  }
  if (kind === 2) {
    const k = r.pick([2, 3, -1, -2, 4]);
    const result = scaleM(k, A);
    return {
      prompt: md`Let $A = ${matTex(A)}$. Compute $${k === -1 ? "-A" : `${k}A`}$. ${LIKE}`,
      answer: matAns(result),
      form: "matrix",
      hint: md`Multiply every entry by ${k}. A scalar multiple scales each column, so it scales each entry.`,
      solution: [
        { math: matTex(A.map((row) => row.map((v) => `${paren(k)}(${v})`))), note: md`${k} times each entry.` },
        { math: matTex(result), note: "" },
      ],
    };
  }
  const k = r.pick([2, 3, -2]);
  const m = r.pick([-1, 2, -3, 3]);
  const result = addM(A, B, k, m);
  return {
    prompt: md`Let $A = ${matTex(A)}$ and $B = ${matTex(B)}$. Compute $${comboTex(k, m)}$. ${LIKE}`,
    answer: matAns(result),
    form: "matrix",
    hint: md`Scale first, then combine: work out $${k}A$ and $${m}B$ entry by entry, then add them.`,
    solution: [
      { math: md`${k}A = ${matTex(scaleM(k, A))}, \qquad ${m}B = ${matTex(scaleM(m, B))}`, note: "Multiply every entry by the scalar." },
      { math: md`${matTex(A.map((row, i) => row.map((v, j) => `${k * v} ${m * B[i]![j]! < 0 ? "-" : "+"} ${Math.abs(m * B[i]![j]!)}`)))}`, note: "Add position by position." },
      { math: matTex(result), note: "" },
    ],
  };
};

const matrixTimesVector: Generator = (r) => {
  const shape = r.pick([[2, 2], [2, 2], [2, 3], [3, 2]]) as [number, number];
  const [m, n] = shape;
  const A = randMat(r, m, n, -4, 4);
  const x = Array.from({ length: n }, () => r.nonzero(-3, 3));
  const result = matVec(A, x);
  const letters = tupleLetters(m);
  const columns = A[0]!.map((_, j) => col(A, j));
  return {
    prompt: md`Let $A = ${matTex(A)}$ and $\mathbf{x} = ${colTex(x)}$. Compute $A\mathbf{x}$. Give it as a vector, like $(${letters.join(", ")})$.`,
    answer: tupleAns(result),
    form: "tuple",
    // Row i of A dotted with x is the i-th entry of the product.
    verify: A.map((row, i) => `${onlyLetter(letters, i)} = ${rowDotText(row, x)}`),
    hint: md`$A\mathbf{x}$ is the combination of the columns of $A$ with weights ${x.map((v) => `$${v}$`).join(", ")}. Or dot each row of $A$ with $\mathbf{x}$.`,
    solution: [
      {
        math: columns.map((c, j) => `${paren(x[j]!)}${colTex(c)}`).join(" + "),
        note: md`Column picture: each entry of $\mathbf{x}$ weights the matching column of $A$.`,
      },
      {
        math: md`${colTex(result.map((_, i) => rowDotTex(A[i]!, x)))}`,
        note: "Collect the first entries together, then the second entries, and so on. Each line is a row of A dotted with x.",
      },
      { math: colTex(result), note: md`So $A\mathbf{x} = ${tupleAns(result)}$.` },
    ],
  };
};

const solveColumnPicture: Generator = (r) => {
  for (;;) {
    const A = randMat(r, 2, 2, -4, 4);
    if (!noZeros(A) || det2(A) === 0) continue;
    const x = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
    const b = matVec(A, x);
    const [[a, bb], [c, d]] = A as [[number, number], [number, number]];
    // Eliminate x: c*(row 1) - a*(row 2).
    const coef = c * bb - a * d;
    const rhs = c * b[0]! - a * b[1]!;
    return {
      prompt: md`Find the vector $\mathbf{x}$ with $A\mathbf{x} = \mathbf{b}$, where $A = ${matTex(A)}$ and $\mathbf{b} = ${colTex(b)}$. Give it as $(x, y)$.`,
      answer: tupleAns(x),
      form: "tuple",
      verify: A.map((row, i) => `${row[0]}x + ${paren(row[1]!)}y = ${b[i]}`),
      hint: md`$A\mathbf{x} = \mathbf{b}$ is a system of two equations: row 1 of $A$ dotted with $(x, y)$ equals ${b[0]}, and row 2 dotted with $(x, y)$ equals ${b[1]}. Solve it by elimination.`,
      solution: [
        { math: md`\begin{cases} ${a}x ${bb < 0 ? "-" : "+"} ${Math.abs(bb)}y = ${b[0]} \\ ${c}x ${d < 0 ? "-" : "+"} ${Math.abs(d)}y = ${b[1]} \end{cases}`, note: md`Each row of $A\mathbf{x}$ is a row of $A$ dotted with $\mathbf{x}$, and it must match the entry of $\mathbf{b}$.` },
        { math: md`${coef}y = ${rhs}`, note: md`Multiply the first equation by ${c} and the second by ${a}, then subtract. The $x$-terms cancel.` },
        { math: md`y = ${x[1]}`, note: "" },
        { math: md`x = ${x[0]}`, note: md`Substitute $y = ${x[1]}$ into the first equation: $${a}x = ${b[0]} ${-bb * x[1]! < 0 ? "-" : "+"} ${Math.abs(bb * x[1]!)} = ${b[0]! - bb * x[1]!}$.` },
        { math: md`${paren(x[0]!)}${colTex(col(A, 0))} + ${paren(x[1]!)}${colTex(col(A, 1))} = ${colTex(b)}`, note: md`Check in the column picture: $\mathbf{b}$ is this combination of the columns.` },
      ],
    };
  }
};

// ── Lesson 2: Matrices as linear transformations ────────────────────────────

const standardMatrix: Generator = (r) => {
  const all = transformations(r);
  const tier = r.pick([0, 0, 1, 1, 2]);
  const T = r.pick(all.filter((t) => t.tier === tier));
  const col1 = T.M.map((row) => row[0]!.x);
  const col2 = T.M.map((row) => row[1]!.x);
  return {
    prompt: md`Find the standard matrix of the linear transformation $T$ that ${T.desc}. ${LIKE}${tier === 2 ? " Exact entries, like sqrt(2)/2." : ""}`,
    answer: eAns(T.M),
    form: "matrix",
    hint: md`The columns of the standard matrix are $T(\mathbf{e}_1)$ and $T(\mathbf{e}_2)$, the images of $(1, 0)$ and $(0, 1)$. Work out where each one goes.`,
    solution: [
      { math: md`T(\mathbf{e}_1) = ${colTex(col1)}`, note: T.e1 },
      { math: md`T(\mathbf{e}_2) = ${colTex(col2)}`, note: T.e2 },
      { math: md`A = ${eTex(T.M)}`, note: md`The first column is $T(\mathbf{e}_1)$, the second is $T(\mathbf{e}_2)$.` },
    ],
  };
};

const imageOfPoint: Generator = (r) => {
  const described = r.next() < 0.45;
  const v = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
  let A: number[][];
  let lead: string;
  let hint: string;
  let first: Step;
  if (described) {
    const T = r.pick(transformations(r).filter((t) => t.int));
    A = T.int!;
    lead = md`$T$ is the linear transformation that ${T.desc}. Find $T(${v[0]}, ${v[1]})$.`;
    hint = md`Write down the standard matrix first (its columns are $T(\mathbf{e}_1)$ and $T(\mathbf{e}_2)$), then multiply it by the vector.`;
    first = { math: md`A = ${matTex(A)}`, note: md`Columns: $T(\mathbf{e}_1) = (${A[0]![0]}, ${A[1]![0]})$ and $T(\mathbf{e}_2) = (${A[0]![1]}, ${A[1]![1]})$.` };
  } else {
    A = randMat(r, 2, 2, -3, 3);
    lead = md`$T(\mathbf{x}) = A\mathbf{x}$ with $A = ${matTex(A)}$. Find the image of the point $(${v[0]}, ${v[1]})$.`;
    hint = md`The image is $A\mathbf{x}$: dot each row of $A$ with $(${v[0]}, ${v[1]})$.`;
    first = { math: md`T(${v[0]}, ${v[1]}) = ${matTex(A)} ${colTex(v)}`, note: "Multiply the matrix by the point written as a column." };
  }
  const img = matVec(A, v);
  return {
    prompt: md`${lead} Give the answer as a point $(p, q)$.`,
    answer: tupleAns(img),
    form: "tuple",
    verify: A.map((row, i) => `${onlyLetter(["p", "q"], i)} = ${rowDotText(row, v)}`),
    hint,
    solution: [
      first,
      { math: md`= ${colTex(img.map((_, i) => rowDotTex(A[i]!, v)))} = ${colTex(img)}`, note: "Row times column for each entry." },
      { math: md`T(${v[0]}, ${v[1]}) = (${img[0]}, ${img[1]})`, note: "" },
    ],
  };
};

const fromBasisImages: Generator = (r) => {
  const kind = r.int(0, 2);
  let A = randMat(r, 2, 2, -3, 3);
  // Neither image may be the zero vector: the formula must mention both x and y.
  while (col(A, 0).every((v) => v === 0) || col(A, 1).every((v) => v === 0)) A = randMat(r, 2, 2, -3, 3);
  const [a, c] = col(A, 0) as [number, number];
  const [b, d] = col(A, 1) as [number, number];
  if (kind === 0) {
    const v = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
    const img = matVec(A, v);
    return {
      prompt: md`$T$ is linear, with $T(1, 0) = (${a}, ${c})$ and $T(0, 1) = (${b}, ${d})$. Find $T(${v[0]}, ${v[1]})$. Give it as $(p, q)$.`,
      answer: tupleAns(img),
      form: "tuple",
      // Linearity: T(v) = v1 T(e1) + v2 T(e2).
      verify: [`p + 0*q = ${paren(v[0]!)}*(${a}) + ${paren(v[1]!)}*(${b})`, `0*p + q = ${paren(v[0]!)}*(${c}) + ${paren(v[1]!)}*(${d})`],
      hint: md`$(${v[0]}, ${v[1]}) = ${v[0]}\,\mathbf{e}_1 ${v[1]! < 0 ? "-" : "+"} ${Math.abs(v[1]!)}\,\mathbf{e}_2$. Linearity lets you push $T$ through the sum and the scalars.`,
      solution: [
        { math: md`T(${v[0]}, ${v[1]}) = T(${v[0]}\,\mathbf{e}_1 + ${paren(v[1]!)}\,\mathbf{e}_2) = ${v[0]}\,T(\mathbf{e}_1) + ${paren(v[1]!)}\,T(\mathbf{e}_2)`, note: "Linearity: T of a combination is the same combination of the images." },
        { math: md`= ${v[0]}${colTex([a, c])} + ${paren(v[1]!)}${colTex([b, d])} = ${colTex(img)}`, note: "Substitute the two given images and combine." },
      ],
    };
  }
  if (kind === 1) {
    const lin = (p: number, q: number) => {
      const s = p === 0 ? "" : p === 1 ? "x" : p === -1 ? "-x" : `${p}x`;
      const t = q === 0 ? "" : `${q < 0 ? "-" : s ? "+" : ""} ${Math.abs(q) === 1 ? "" : Math.abs(q)}y`;
      return (s + " " + t).trim() || "0";
    };
    const row1 = lin(a, b);
    const row2 = lin(c, d);
    return {
      prompt: md`$T$ is linear, with $T(1, 0) = (${a}, ${c})$ and $T(0, 1) = (${b}, ${d})$. Find a formula for $T(x, y)$. Give it as a pair of expressions in $x$ and $y$, like $(2x - y, x + 3y)$.`,
      answer: `(${row1}, ${row2})`,
      form: "tuple",
      verify: [`p + 0*q = x*(${a}) + y*(${b})`, `0*p + q = x*(${c}) + y*(${d})`],
      hint: md`$(x, y) = x\,\mathbf{e}_1 + y\,\mathbf{e}_2$, so $T(x, y) = x\,T(\mathbf{e}_1) + y\,T(\mathbf{e}_2)$.`,
      solution: [
        { math: md`T(x, y) = x\,T(\mathbf{e}_1) + y\,T(\mathbf{e}_2) = x${colTex([a, c])} + y${colTex([b, d])}`, note: "Linearity." },
        { math: md`= ${colTex([row1, row2])}`, note: md`Or read it off the matrix $${matTex(A)}$ times $(x, y)$: each row dotted with $(x, y)$.` },
      ],
    };
  }
  // Images of (1, 0) and (1, 1): recover T(0, 1) by subtracting.
  const s = [a + b, c + d];
  return {
    prompt: md`$T$ is linear, with $T(1, 0) = (${a}, ${c})$ and $T(1, 1) = (${s[0]}, ${s[1]})$. Find $T(0, 1)$. Give it as $(p, q)$.`,
    answer: tupleAns([b, d]),
    form: "tuple",
    // T(1, 1) = T(1, 0) + T(0, 1).
    verify: [`${a} + p + 0*q = ${s[0]}`, `${c} + 0*p + q = ${s[1]}`],
    hint: md`$(0, 1) = (1, 1) - (1, 0)$. Linearity turns that subtraction of inputs into a subtraction of outputs.`,
    solution: [
      { math: md`T(0, 1) = T\big((1, 1) - (1, 0)\big) = T(1, 1) - T(1, 0)`, note: "Linearity: T of a difference is the difference of the images." },
      { math: md`= ${colTex(s)} - ${colTex([a, c])} = ${colTex([b, d])}`, note: "" },
    ],
  };
};

// ── Lesson 3: Composition and matrix multiplication ─────────────────────────

/** Steps that show a product entry by entry. */
function productSteps(A: number[][], B: number[][], name: string): Step[] {
  const P = mul(A, B);
  const entries = A.map((row, i) => B[0]!.map((_, j) => rowDotTex(row, col(B, j))));
  return [
    { math: md`${name} = ${matTex(entries)}`, note: md`Entry $(i, j)$ is row $i$ of the left matrix dotted with column $j$ of the right matrix.` },
    { math: md`${name} = ${matTex(P)}`, note: "" },
  ];
}

const multiplySquare: Generator = (r) => {
  const A = randMat(r, 2, 2, -3, 4);
  const B = randMat(r, 2, 2, -3, 4);
  const kind = r.int(0, 2);
  if (kind === 2) {
    return {
      prompt: md`Let $A = ${matTex(A)}$. Compute $A^2$. ${LIKE}`,
      answer: matAns(mul(A, A)),
      form: "matrix",
      hint: md`$A^2 = AA$: the transformation applied twice. Row $i$ of $A$ dotted with column $j$ of $A$ gives entry $(i, j)$.`,
      solution: productSteps(A, A, "A^2"),
    };
  }
  const [L, R, name] = kind === 0 ? [A, B, "AB"] : [B, A, "BA"];
  return {
    prompt: md`Let $A = ${matTex(A)}$ and $B = ${matTex(B)}$. Compute $${name}$. ${LIKE}`,
    answer: matAns(mul(L, R)),
    form: "matrix",
    hint: md`In $${name}$ the matrix on the right, $${name[1]}$, acts first. Entry $(i, j)$ is row $i$ of $${name[0]}$ dotted with column $j$ of $${name[1]}$.`,
    solution: productSteps(L, R, name),
  };
};

const multiplyRectangular: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 3) {
    // Sizes that don't match: the product isn't defined.
    const m = r.int(2, 3);
    const n = r.int(2, 3);
    const p = r.pick([2, 3].filter((v) => v !== n));
    const A = randMat(r, m, n, -3, 3);
    const B = randMat(r, p, 2, -3, 3);
    return {
      prompt: md`Let $A = ${matTex(A)}$ and $B = ${matTex(B)}$. Compute $AB$, or type **undefined** if the product does not exist.`,
      accept: ["undefined", "not defined", "does not exist"],
      hint: md`$AB$ exists only when the number of columns of $A$ equals the number of rows of $B$. Count them.`,
      solution: [
        { math: md`A: ${m} \times ${n}, \qquad B: ${p} \times 2`, note: md`$A$ has ${n} columns but $B$ has ${p} rows.` },
        { math: md`AB \text{ is undefined}`, note: md`$A$ eats vectors in $\mathbb{R}^${n}$, but $B$ produces vectors in $\mathbb{R}^${p}$. The composition makes no sense, so neither does the product.` },
      ],
    };
  }
  const shapes: [number, number, number][] = [
    [2, 3, 2],
    [3, 2, 2],
    [2, 2, 3],
  ];
  const [m, n, p] = shapes[kind]!;
  const A = randMat(r, m, n, -3, 3);
  const B = randMat(r, n, p, -3, 3);
  return {
    prompt: md`Let $A = ${matTex(A)}$ and $B = ${matTex(B)}$. Compute $AB$. ${LIKE}`,
    answer: matAns(mul(A, B)),
    form: "matrix",
    hint: md`$A$ is $${m} \times ${n}$ and $B$ is $${n} \times ${p}$, so $AB$ is $${m} \times ${p}$. Each entry is a row of $A$ dotted with a column of $B$.`,
    solution: [{ math: md`(${m} \times ${n})(${n} \times ${p}) = ${m} \times ${p}`, note: "The inner sizes match, so the product exists, with the outer sizes." }, ...productSteps(A, B, "AB")],
  };
};

const entryOrTranspose: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 2]);
  if (kind === 0) {
    const A = randMat(r, 2, 3, -4, 4);
    const B = randMat(r, 3, 2, -4, 4);
    const i = r.int(1, 2);
    const j = r.int(1, 2);
    const row = A[i - 1]!;
    const column = col(B, j - 1);
    const value = dot(row, column);
    return {
      prompt: md`Let $A = ${matTex(A)}$ and $B = ${matTex(B)}$. Find the entry in row ${i}, column ${j} of $AB$, without computing the whole product.`,
      answer: String(value),
      verify: [`v = ${rowDotText(row, column)}`],
      hint: md`Entry $(${i}, ${j})$ of $AB$ is row ${i} of $A$ dotted with column ${j} of $B$. You need only those ${row.length} products.`,
      solution: [
        { math: md`\text{row ${i} of } A = ${matTex([row])}, \qquad \text{column ${j} of } B = ${colTex(column)}`, note: "Pick out the one row and one column that matter." },
        { math: md`(AB)_{${i}${j}} = ${rowDotTex(row, column)} = ${value}`, note: "Dot them." },
      ],
    };
  }
  if (kind === 1) {
    const A = randMat(r, r.pick([2, 3]), r.pick([2, 3]), -5, 6);
    const T = transpose(A);
    return {
      prompt: md`Let $A = ${matTex(A)}$. Compute $A^T$. ${LIKE}`,
      answer: matAns(T),
      form: "matrix",
      hint: md`Rows become columns: the first row of $A$ is the first column of $A^T$. A $${A.length} \times ${A[0]!.length}$ matrix has a $${A[0]!.length} \times ${A.length}$ transpose.`,
      solution: [{ math: md`A^T = ${matTex(T)}`, note: md`Entry $(i, j)$ of $A^T$ is entry $(j, i)$ of $A$: the matrix is flipped over its main diagonal.` }],
    };
  }
  const A = randMat(r, 2, 2, -3, 3);
  const B = randMat(r, 2, 2, -3, 3);
  const P = mul(A, B);
  return {
    prompt: md`Let $A = ${matTex(A)}$ and $B = ${matTex(B)}$. Compute $(AB)^T$. ${LIKE}`,
    answer: matAns(transpose(P)),
    form: "matrix",
    hint: md`Either multiply and then flip, or use $(AB)^T = B^T A^T$. Both must agree.`,
    solution: [
      ...productSteps(A, B, "AB"),
      { math: md`(AB)^T = ${matTex(transpose(P))}`, note: md`Flip rows and columns. Check: $B^T A^T = ${matTex(transpose(B))}${matTex(transpose(A))}$ gives the same matrix.` },
    ],
  };
};

// ── Lesson 4: The inverse of a matrix ───────────────────────────────────────

/** The 2×2 inverse's entries as typed text and LaTeX. */
function inverse2(A: number[][]): { text: string[][]; tex: string[][]; det: number } {
  const [[a, b], [c, d]] = A as [[number, number], [number, number]];
  const det = a * d - b * c;
  const adj = [
    [d, -b],
    [-c, a],
  ];
  return { det, text: adj.map((row) => row.map((v) => frac(v, det))), tex: adj.map((row) => row.map((v) => fracTex(v, det))) };
}

const inverse2x2: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 1, 2]);
  for (;;) {
    const A = randMat(r, 2, 2, -4, 5);
    const det = det2(A);
    if (kind === 2) {
      // Singular: make the second row a multiple of the first.
      const k = r.pick([2, -1, 3, -2]);
      const row = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
      const S = [row, row.map((v) => k * v)];
      if (r.next() < 0.5) S.reverse();
      return {
        prompt: md`Find $A^{-1}$ for $A = ${matTex(S)}$, or type **singular** if the matrix has no inverse.`,
        accept: ["singular", "not invertible", "no inverse"],
        hint: md`Compute $ad - bc$ first. If it is 0 the formula divides by zero, and no inverse exists.`,
        solution: [
          { math: md`ad - bc = ${rowDotTex([S[0]![0]!, -S[0]![1]!], [S[1]![1]!, S[1]![0]!])} = 0`, note: md`One row is ${k} times the other, so the columns are parallel.` },
          { math: md`A \text{ is singular}`, note: md`$A$ flattens the plane onto a line. Two different inputs share an output, so nothing can undo $A$.` },
        ],
      };
    }
    if (det === 0) continue;
    if (kind === 0 && Math.abs(det) !== 1) continue;
    if (kind === 1 && (Math.abs(det) === 1 || Math.abs(det) > 6)) continue;
    const inv = inverse2(A);
    const [[a, b], [c, d]] = A as [[number, number], [number, number]];
    return {
      prompt: md`Find $A^{-1}$ for $A = ${matTex(A)}$. ${LIKE}${kind === 1 ? " Entries may be fractions, like 1/2." : ""}`,
      answer: matAns(inv.text),
      form: "matrix",
      hint: md`For a $2 \times 2$ matrix, swap the diagonal entries, negate the other two, and divide everything by $ad - bc$.`,
      solution: [
        { math: md`ad - bc = ${paren(a)}(${d}) - ${paren(b)}(${c}) = ${det}`, note: md`Nonzero, so the inverse exists.` },
        { math: md`A^{-1} = ${det === 1 ? "" : det === -1 ? "-" : `\\frac{1}{${det}}`}${matTex([[d, -b], [-c, a]])}`, note: md`Swap $a$ and $d$, negate $b$ and $c$${Math.abs(det) === 1 ? `, and divide by ${det}` : ""}.` },
        { math: md`A^{-1} = ${matTex(inv.tex)}`, note: md`Check: $A A^{-1}$ has diagonal entries $\frac{${a}\cdot${d} - ${b}\cdot${c}}{${det}} = 1$ and off-diagonal entries $0$.` },
      ],
    };
  }
};

const solveWithInverse: Generator = (r) => {
  for (;;) {
    const A = randMat(r, 2, 2, -4, 4);
    const det = det2(A);
    if (!noZeros(A) || det === 0 || Math.abs(det) > 3) continue;
    const x = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
    const b = matVec(A, x);
    const inv = inverse2(A);
    const [[a, bb], [c, d]] = A as [[number, number], [number, number]];
    // A^{-1} b computed with the adjugate, then divided by det.
    const adjB = matVec([[d, -bb], [-c, a]], b);
    return {
      prompt: md`Use $A^{-1}$ to solve $A\mathbf{x} = \mathbf{b}$, where $A = ${matTex(A)}$ and $\mathbf{b} = ${colTex(b)}$. Give $\mathbf{x}$ as $(x, y)$.`,
      answer: tupleAns(x),
      form: "tuple",
      verify: A.map((row, i) => `${row[0]}x + ${paren(row[1]!)}y = ${b[i]}`),
      hint: md`Multiply both sides by $A^{-1}$ on the left: $\mathbf{x} = A^{-1}\mathbf{b}$. Find $A^{-1}$ with the $2 \times 2$ formula.`,
      solution: [
        { math: md`ad - bc = ${paren(a)}(${d}) - ${paren(bb)}(${c}) = ${det}`, note: "The inverse exists, so the system has exactly one solution." },
        { math: md`A^{-1} = ${Math.abs(det) === 1 ? "" : `\\frac{1}{${det}}`}${matTex(det === 1 ? [[d, -bb], [-c, a]] : det === -1 ? [[-d, bb], [c, -a]] : [[d, -bb], [-c, a]])}`, note: "Swap the diagonal, negate the rest, divide by the determinant." },
        {
          math: md`\mathbf{x} = A^{-1}\mathbf{b} = ${Math.abs(det) === 1 ? "" : `\\frac{1}{${det}}`}${colTex(adjB.map((v) => (Math.abs(det) === 1 ? v / det : v)))} = ${colTex(x)}`,
          note: md`Multiplying $A\mathbf{x} = \mathbf{b}$ on the left by $A^{-1}$ gives $I\mathbf{x} = A^{-1}\mathbf{b}$.`,
        },
        { math: md`${rowDotTex([a, bb], x)} = ${b[0]}, \qquad ${rowDotTex([c, d], x)} = ${b[1]}`, note: "Check both rows." },
      ],
    };
  }
};

const singularAndProducts: Generator = (r) => {
  const kind = r.pick([0, 0, 1]);
  if (kind === 0) {
    for (;;) {
      const a = r.nonzero(-4, 4);
      const c = r.nonzero(-4, 4);
      const kVal = r.nonzero(-5, 5);
      // Place k so that det = 0 exactly at k = kVal with integer entries.
      const where = r.int(0, 1);
      // where 0: A = [[a, k], [c, d]] with det = a d - k c = 0 => d = k c / a. Need a | k c.
      const d = where === 0 ? (kVal * c) / a : (kVal * a) / c;
      if (!Number.isInteger(d) || Math.abs(d) > 9) continue;
      const M: (number | string)[][] = where === 0 ? [[a, "k"], [c, d]] : [[a, d], [c, "k"]];
      const detTex = where === 0 ? `${paren(a)}(${d}) - k(${c})` : `${paren(a)}k - ${paren(d)}(${c})`;
      const detText = where === 0 ? `${a}*(${d}) - k*(${c})` : `${a}*k - (${d})*(${c})`;
      return {
        prompt: md`For which value of $k$ is $A = ${matTex(M)}$ **not** invertible?`,
        answer: String(kVal),
        verify: [`${detText} = 0`],
        hint: md`A $2 \times 2$ matrix has no inverse exactly when $ad - bc = 0$. Set the determinant equal to zero and solve for $k$.`,
        solution: [
          { math: md`ad - bc = ${detTex}`, note: "The determinant, with k left as a letter." },
          { math: md`${detTex} = 0`, note: "No inverse means the determinant is zero." },
          { math: md`k = ${kVal}`, note: md`At that value one column is a multiple of the other, so $A$ squashes the plane onto a line.` },
        ],
      };
    }
  }
  // (AB)^{-1} from the two inverses, which must themselves be invertible.
  let P = randMat(r, 2, 2, -3, 3); // A^{-1}
  let Q = randMat(r, 2, 2, -3, 3); // B^{-1}
  while (det2(P) === 0) P = randMat(r, 2, 2, -3, 3);
  while (det2(Q) === 0) Q = randMat(r, 2, 2, -3, 3);
  const result = mul(Q, P);
  return {
    prompt: md`$A^{-1} = ${matTex(P)}$ and $B^{-1} = ${matTex(Q)}$. Compute $(AB)^{-1}$. ${LIKE}`,
    answer: matAns(result),
    form: "matrix",
    hint: md`$(AB)^{-1} = B^{-1}A^{-1}$: undo the last step first. Multiply the two given matrices in that order.`,
    solution: [
      { math: md`(AB)^{-1} = B^{-1}A^{-1}`, note: md`$AB$ does $B$ first and then $A$. To undo it, undo $A$ first and then $B$.` },
      ...productSteps(Q, P, "B^{-1}A^{-1}"),
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "Matrices",
  lessons: [
    {
      id: slug("Matrix operations"),
      title: "Matrix operations",
      summary: "Adding and scaling matrices entry by entry, and multiplying a matrix by a vector as a combination of its columns.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 3 a matrix was a bookkeeping device: the augmented matrix held the coefficients of a system while you row-reduced it. From here on a matrix is an object in its own right, with its own arithmetic. The arithmetic is not arbitrary. Every rule comes from one idea: **a matrix is a row of column vectors standing side by side.**

A matrix with $m$ rows and $n$ columns is an $m \times n$ matrix (rows first, always). The entry in row $i$, column $j$ is written $a_{ij}$.

$$A = \begin{bmatrix} 2 & -1 & 3 \\ 0 & 4 & 1 \end{bmatrix} \quad \text{is } 2 \times 3, \text{ with } a_{12} = -1 \text{ and } a_{23} = 1.$$

Its columns $\begin{bmatrix} 2 \\ 0 \end{bmatrix}, \begin{bmatrix} -1 \\ 4 \end{bmatrix}, \begin{bmatrix} 3 \\ 1 \end{bmatrix}$ are three vectors in $\mathbb{R}^2$. A vector in $\mathbb{R}^m$ is itself an $m \times 1$ matrix.`,
        },
        {
          kind: "key",
          title: "Matrix, size, entries, columns",
          body: md`An $m \times n$ **matrix** has $m$ rows and $n$ columns. Its entries are $a_{ij}$ (row $i$, column $j$). Writing its columns as vectors $\mathbf{a}_1, \dots, \mathbf{a}_n$ in $\mathbb{R}^m$,

$$A = \begin{bmatrix} \mathbf{a}_1 & \mathbf{a}_2 & \cdots & \mathbf{a}_n \end{bmatrix}.$$

Two matrices are **equal** when they have the same size and every entry agrees. A matrix with $m = n$ is **square**.`,
        },
        {
          kind: "key",
          title: "Addition and scalar multiplication",
          body: md`For matrices $A$ and $B$ of the **same size**, and a number $c$:

- $A + B$ has entries $a_{ij} + b_{ij}$: add the entries that sit in the same position.
- $cA$ has entries $c\,a_{ij}$: multiply every entry by $c$.
- $A - B$ means $A + (-1)B$.

Matrices of different sizes cannot be added.`,
        },
        {
          kind: "why",
          title: "Why entry by entry",
          body: md`Vectors add component by component and scale component by component (Unit 2). A matrix is its columns, so adding two matrices should add matching columns, and scaling a matrix should scale each column. Adding matching columns component by component is exactly adding matching entries. That is the whole rule.

Two consequences come for free. Since each entry obeys the ordinary rules of arithmetic, so does the matrix: $A + B = B + A$, $(A + B) + C = A + (B + C)$, $c(A + B) = cA + cB$, $(c + d)A = cA + dA$. And different sizes cannot be added because some entry would have no partner.`,
        },
        {
          kind: "example",
          title: "A scalar combination",
          problem: md`Let $A = \begin{bmatrix} 1 & -2 \\ 0 & 3 \end{bmatrix}$ and $B = \begin{bmatrix} 4 & 1 \\ -2 & 5 \end{bmatrix}$. Compute $2A - B$.`,
          steps: [
            { math: md`2A = \begin{bmatrix} 2 & -4 \\ 0 & 6 \end{bmatrix}`, note: "Double every entry." },
            { math: md`2A - B = \begin{bmatrix} 2 - 4 & -4 - 1 \\ 0 - (-2) & 6 - 5 \end{bmatrix}`, note: "Subtract position by position." },
            { math: md`2A - B = \begin{bmatrix} -2 & -5 \\ 2 & 1 \end{bmatrix}`, note: "" },
          ],
        },
        {
          kind: "text",
          body: md`Now the product that makes matrices worth studying: a matrix times a vector. Recall the column picture of a system from Unit 1. The system

$$\begin{cases} 2x - y = 3 \\ x + 2y = 4 \end{cases}$$

asks for the weights $x, y$ that combine the column vectors into the right-hand side:

$$x\begin{bmatrix} 2 \\ 1 \end{bmatrix} + y\begin{bmatrix} -1 \\ 2 \end{bmatrix} = \begin{bmatrix} 3 \\ 4 \end{bmatrix}.$$

The left side is "the columns of $A = \begin{bmatrix} 2 & -1 \\ 1 & 2 \end{bmatrix}$, weighted by the entries of $\mathbf{x} = \begin{bmatrix} x \\ y \end{bmatrix}$". We give that combination a name: $A\mathbf{x}$.`,
        },
        {
          kind: "key",
          title: "The product $A\mathbf{x}$",
          body: md`For an $m \times n$ matrix $A$ with columns $\mathbf{a}_1, \dots, \mathbf{a}_n$ and a vector $\mathbf{x}$ in $\mathbb{R}^n$,

$$A\mathbf{x} = x_1\mathbf{a}_1 + x_2\mathbf{a}_2 + \cdots + x_n\mathbf{a}_n.$$

The result is a vector in $\mathbb{R}^m$. The number of columns of $A$ must equal the number of entries of $\mathbf{x}$: one weight per column.`,
        },
        {
          kind: "why",
          title: "Why the row rule gives the same answer",
          body: md`The definition is a combination of columns. There is a second way to compute it, one entry at a time. Look at entry $i$ of the combination. Entry $i$ of $x_1\mathbf{a}_1$ is $x_1 a_{i1}$, entry $i$ of $x_2\mathbf{a}_2$ is $x_2 a_{i2}$, and so on. Adding,

$$(A\mathbf{x})_i = a_{i1}x_1 + a_{i2}x_2 + \cdots + a_{in}x_n,$$

which is row $i$ of $A$ dotted with $\mathbf{x}$. So:

- **Column picture:** $A\mathbf{x}$ is a weighted sum of the columns. This is the meaning.
- **Row rule:** entry $i$ of $A\mathbf{x}$ is (row $i$) $\cdot$ $\mathbf{x}$. This is the fast arithmetic.

Both are the same calculation, grouped differently. Use the one that answers the question in front of you.`,
        },
        {
          kind: "diagram",
          view: [-6.5, 6.5, -6.5, 6.5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "A1", x: 2, y: 1, label: "\\mathbf{a}_1", dir: "se" },
            { name: "A2", x: -1, y: 2, label: "\\mathbf{a}_2", dir: "nw" },
            { name: "S", x: "2x", y: "x", label: "x_1\\mathbf{a}_1", dir: "se", hidden: true },
            { name: "P", x: "2x - y", y: "x + 2y", label: "A\\mathbf{x} = ({=2x - y}, {=x + 2y})", dir: "ne" },
          ],
          segments: [
            { from: "O", to: "A1", arrow: true, color: 1 },
            { from: "O", to: "A2", arrow: true, color: 2 },
            { from: "O", to: "S", dashed: true, color: 1 },
            { from: "S", to: "P", dashed: true, color: 2 },
            { from: "O", to: "P", arrow: true, color: 3 },
          ],
          params: [
            { name: "x", tex: "x_1", min: -2, max: 2, step: 0.5, value: 1.5 },
            { name: "y", tex: "x_2", min: -2, max: 2, step: 0.5, value: 1 },
          ],
          readouts: [{ label: "A\\mathbf{x}", value: "2x - y" }, { label: "\\text{second entry}", value: "x + 2y" }],
          caption: md`$A = \begin{bmatrix} 2 & -1 \\ 1 & 2 \end{bmatrix}$ has columns $\mathbf{a}_1$ (blue) and $\mathbf{a}_2$ (orange). Drag the weights $x_1, x_2$: the green vector $A\mathbf{x} = x_1\mathbf{a}_1 + x_2\mathbf{a}_2$ follows the dashed path, $x_1$ copies of $\mathbf{a}_1$ then $x_2$ copies of $\mathbf{a}_2$.`,
        },
        {
          kind: "example",
          title: "A product both ways",
          problem: md`Compute $A\mathbf{x}$ for $A = \begin{bmatrix} 2 & -1 & 3 \\ 1 & 0 & 4 \end{bmatrix}$ and $\mathbf{x} = \begin{bmatrix} 1 \\ 2 \\ -1 \end{bmatrix}$.`,
          steps: [
            { math: md`A\mathbf{x} = 1\begin{bmatrix} 2 \\ 1 \end{bmatrix} + 2\begin{bmatrix} -1 \\ 0 \end{bmatrix} + (-1)\begin{bmatrix} 3 \\ 4 \end{bmatrix}`, note: md`Column picture: $A$ is $2 \times 3$ and $\mathbf{x}$ has 3 entries, one weight per column.` },
            { math: md`= \begin{bmatrix} 2 - 2 - 3 \\ 1 + 0 - 4 \end{bmatrix} = \begin{bmatrix} -3 \\ -3 \end{bmatrix}`, note: "Combine component by component." },
            { math: md`\text{Row rule: } \begin{bmatrix} 2(1) + (-1)(2) + 3(-1) \\ 1(1) + 0(2) + 4(-1) \end{bmatrix} = \begin{bmatrix} -3 \\ -3 \end{bmatrix}`, note: "Each row of A dotted with x. Same answer, as it must be." },
          ],
        },
        {
          kind: "proof",
          title: "Multiplying by $A$ respects sums and scalars",
          given: md`An $m \times n$ matrix $A$, vectors $\mathbf{u}, \mathbf{v}$ in $\mathbb{R}^n$, and a number $c$`,
          prove: md`$A(\mathbf{u} + \mathbf{v}) = A\mathbf{u} + A\mathbf{v}$ and $A(c\mathbf{u}) = c\,A\mathbf{u}$`,
          steps: [
            { statement: md`$A(\mathbf{u} + \mathbf{v}) = (u_1 + v_1)\mathbf{a}_1 + \cdots + (u_n + v_n)\mathbf{a}_n$`, reason: md`Definition of $A\mathbf{x}$: the entries of $\mathbf{u} + \mathbf{v}$ are $u_i + v_i$.` },
            { statement: md`$= (u_1\mathbf{a}_1 + \cdots + u_n\mathbf{a}_n) + (v_1\mathbf{a}_1 + \cdots + v_n\mathbf{a}_n)$`, reason: "Distribute each scalar over the column and regroup (vector rules from Unit 2)." },
            { statement: md`$= A\mathbf{u} + A\mathbf{v}$`, reason: md`Definition of $A\mathbf{x}$, twice.` },
            { statement: md`$A(c\mathbf{u}) = (cu_1)\mathbf{a}_1 + \cdots + (cu_n)\mathbf{a}_n = c(u_1\mathbf{a}_1 + \cdots + u_n\mathbf{a}_n) = c\,A\mathbf{u}$`, reason: "Definition, then factor out c from every term." },
          ],
        },
        {
          kind: "key",
          title: "A system is one matrix equation",
          body: md`Any linear system with coefficient matrix $A$ and right-hand side $\mathbf{b}$ is the single equation

$$A\mathbf{x} = \mathbf{b}.$$

Solving it means finding which combination of the columns of $A$ produces $\mathbf{b}$. The system is consistent exactly when $\mathbf{b}$ is in the span of the columns. The **homogeneous** system $A\mathbf{x} = \mathbf{0}$ always has the solution $\mathbf{x} = \mathbf{0}$; its other solutions, if any, come from linear dependence among the columns (Unit 2).`,
        },
        {
          kind: "check",
          prompt: md`Compute $A\mathbf{x}$ for $A = \begin{bmatrix} 1 & 2 \\ 3 & -1 \end{bmatrix}$ and $\mathbf{x} = \begin{bmatrix} 2 \\ 1 \end{bmatrix}$. Give it as $(p, q)$.`,
          answer: "(4, 5)",
          form: "tuple",
          explain: md`Columns: $2\begin{bmatrix} 1 \\ 3 \end{bmatrix} + 1\begin{bmatrix} 2 \\ -1 \end{bmatrix} = \begin{bmatrix} 4 \\ 5 \end{bmatrix}$. Rows: $1(2) + 2(1) = 4$ and $3(2) + (-1)(1) = 5$.`,
        },
        {
          kind: "check",
          prompt: md`Let $A = \begin{bmatrix} 3 & 0 \\ -1 & 2 \end{bmatrix}$ and $B = \begin{bmatrix} 1 & -4 \\ 2 & 2 \end{bmatrix}$. Compute $A + 2B$. ${LIKE}`,
          answer: "[[5, -8], [3, 6]]",
          form: "matrix",
          explain: md`$2B = \begin{bmatrix} 2 & -8 \\ 4 & 4 \end{bmatrix}$, then add entry by entry: $\begin{bmatrix} 5 & -8 \\ 3 & 6 \end{bmatrix}$.`,
        },
      ],
      practice: [combineMatrices, matrixTimesVector, solveColumnPicture],
    },
    {
      id: slug("Matrices as linear transformations"),
      title: "Matrices as linear transformations",
      summary: "Seeing x ↦ Ax as a function that moves the plane, and reading its matrix off the images of e₁ and e₂.",
      blocks: [
        {
          kind: "text",
          body: md`A matrix $A$ turns each input vector $\mathbf{x}$ into an output vector $A\mathbf{x}$. That is a function. We write it

$$T(\mathbf{x}) = A\mathbf{x},$$

and call $T$ a **transformation** because it moves points: if $A$ is $m \times n$, then $T$ takes points of $\mathbb{R}^n$ to points of $\mathbb{R}^m$. For a $2 \times 2$ matrix, $T$ moves the plane onto itself. Rotations, reflections, stretches and shears will all turn out to be matrices. Translations will not.`,
        },
        {
          kind: "key",
          title: "Linear transformation",
          body: md`A function $T$ from $\mathbb{R}^n$ to $\mathbb{R}^m$ is **linear** when for all vectors $\mathbf{u}, \mathbf{v}$ and all numbers $c$:

$$T(\mathbf{u} + \mathbf{v}) = T(\mathbf{u}) + T(\mathbf{v}) \qquad \text{and} \qquad T(c\mathbf{u}) = c\,T(\mathbf{u}).$$

Together: $T(c\mathbf{u} + d\mathbf{v}) = c\,T(\mathbf{u}) + d\,T(\mathbf{v})$. A linear map sends combinations to the same combinations of the images. Every matrix map $T(\mathbf{x}) = A\mathbf{x}$ is linear: that is exactly the proof at the end of the last lesson.`,
        },
        {
          kind: "why",
          title: "What linearity does to a picture",
          body: md`Put $\mathbf{u} = \mathbf{v} = \mathbf{0}$ in the first rule: $T(\mathbf{0}) = T(\mathbf{0}) + T(\mathbf{0})$, so $T(\mathbf{0}) = \mathbf{0}$. **The origin never moves.** That already rules out translations.

Points on the line through $\mathbf{0}$ in direction $\mathbf{v}$ are $t\mathbf{v}$. Their images are $T(t\mathbf{v}) = t\,T(\mathbf{v})$: the line through $\mathbf{0}$ in direction $T(\mathbf{v})$ (or just the origin, if $T(\mathbf{v}) = \mathbf{0}$). **Lines through the origin go to lines through the origin**, with even spacing kept.

The unit square has corners $\mathbf{0}, \mathbf{e}_1, \mathbf{e}_2, \mathbf{e}_1 + \mathbf{e}_2$, and its points are $s\mathbf{e}_1 + t\mathbf{e}_2$ with $0 \le s, t \le 1$. Their images are $s\,T(\mathbf{e}_1) + t\,T(\mathbf{e}_2)$: **the square becomes the parallelogram** with sides $T(\mathbf{e}_1)$ and $T(\mathbf{e}_2)$. Drag the entries below and watch.`,
        },
        {
          kind: "diagram",
          view: [-3.5, 3.5, -3.5, 3.5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "E1", x: 1, y: 0, label: "\\mathbf{e}_1", dir: "s" },
            { name: "E2", x: 0, y: 1, label: "\\mathbf{e}_2", dir: "w" },
            { name: "K", x: 1, y: 1, label: "", hidden: true },
            { name: "P1", x: "a", y: "c", label: "T(\\mathbf{e}_1) = ({a}, {c})", dir: "se" },
            { name: "P2", x: "b", y: "d", label: "T(\\mathbf{e}_2) = ({b}, {d})", dir: "nw" },
            { name: "Q", x: "a + b", y: "c + d", label: "", hidden: true },
          ],
          polygons: [
            { points: ["O", "E1", "K", "E2"], fill: 1 },
            { points: ["O", "P1", "Q", "P2"], fill: 2 },
          ],
          segments: [
            { from: "O", to: "P1", arrow: true, color: 2 },
            { from: "O", to: "P2", arrow: true, color: 2 },
          ],
          params: [
            { name: "a", tex: "a", min: -2, max: 2, step: 0.5, value: 2 },
            { name: "b", tex: "b", min: -2, max: 2, step: 0.5, value: 1 },
            { name: "c", tex: "c", min: -2, max: 2, step: 0.5, value: 0 },
            { name: "d", tex: "d", min: -2, max: 2, step: 0.5, value: 1 },
          ],
          caption: md`$T(\mathbf{x}) = \begin{bmatrix} a & b \\ c & d \end{bmatrix}\mathbf{x}$. The blue unit square becomes the orange parallelogram spanned by $T(\mathbf{e}_1) = (a, c)$ and $T(\mathbf{e}_2) = (b, d)$, the two columns. Try $a = d = 0$, $b = -1$, $c = 1$ for a quarter turn, or $c = 0$, $d = 0$ to flatten the square.`,
        },
        {
          kind: "proof",
          title: "Every linear transformation is a matrix map",
          given: md`A linear transformation $T$ from $\mathbb{R}^n$ to $\mathbb{R}^m$`,
          prove: md`$T(\mathbf{x}) = A\mathbf{x}$ for every $\mathbf{x}$, where $A = \begin{bmatrix} T(\mathbf{e}_1) & \cdots & T(\mathbf{e}_n) \end{bmatrix}$, and no other matrix works`,
          steps: [
            { statement: md`$\mathbf{x} = x_1\mathbf{e}_1 + x_2\mathbf{e}_2 + \cdots + x_n\mathbf{e}_n$`, reason: md`Every vector is this combination of the standard basis vectors: $\mathbf{e}_i$ has a 1 in slot $i$ and zeros elsewhere.` },
            { statement: md`$T(\mathbf{x}) = x_1 T(\mathbf{e}_1) + x_2 T(\mathbf{e}_2) + \cdots + x_n T(\mathbf{e}_n)$`, reason: "Linearity, applied to the whole combination." },
            { statement: md`$= A\mathbf{x}$ where the columns of $A$ are $T(\mathbf{e}_1), \dots, T(\mathbf{e}_n)$`, reason: md`That sum is exactly the definition of $A\mathbf{x}$: the columns weighted by the entries of $\mathbf{x}$.` },
            { statement: md`If $T(\mathbf{x}) = B\mathbf{x}$ for all $\mathbf{x}$, then column $i$ of $B$ is $B\mathbf{e}_i = T(\mathbf{e}_i)$, so $B = A$.`, reason: md`$B\mathbf{e}_i$ picks out column $i$ (weight 1 on that column, 0 on the rest).` },
          ],
        },
        {
          kind: "key",
          title: "The standard matrix",
          body: md`The **standard matrix** of a linear transformation $T$ is the matrix whose columns are the images of the standard basis vectors:

$$A = \begin{bmatrix} T(\mathbf{e}_1) & T(\mathbf{e}_2) & \cdots & T(\mathbf{e}_n) \end{bmatrix}.$$

To find the matrix of a transformation described in words, ask only two questions: where does $(1, 0)$ go, and where does $(0, 1)$ go? Those answers are the columns. Linearity does the rest.`,
        },
        {
          kind: "example",
          title: "Reflection across the line $y = x$",
          problem: md`Find the standard matrix of the reflection $T$ across the line $y = x$, and find $T(3, -2)$.`,
          steps: [
            { math: md`T(\mathbf{e}_1) = T(1, 0) = (0, 1)`, note: md`Reflecting across $y = x$ swaps the two coordinates.` },
            { math: md`T(\mathbf{e}_2) = T(0, 1) = (1, 0)`, note: "" },
            { math: md`A = \begin{bmatrix} 0 & 1 \\ 1 & 0 \end{bmatrix}`, note: "Images as columns, in order." },
            { math: md`T(3, -2) = \begin{bmatrix} 0 & 1 \\ 1 & 0 \end{bmatrix}\begin{bmatrix} 3 \\ -2 \end{bmatrix} = \begin{bmatrix} -2 \\ 3 \end{bmatrix}`, note: "The coordinates swap, as a reflection across y = x should." },
          ],
        },
        {
          kind: "why",
          title: "The rotation matrix",
          body: md`Rotate the plane counterclockwise by an angle $t$ (we write $t$ for $\theta$) about the origin. Where does $\mathbf{e}_1$ go? It stays length 1 and ends at angle $t$ from the positive $x$-axis: on the unit circle at $(\cos t, \sin t)$. Where does $\mathbf{e}_2$ go? It starts a quarter turn ahead of $\mathbf{e}_1$ and the rotation keeps it there, so it lands at angle $t + 90^\circ$:

$$(\cos(t + 90^\circ), \sin(t + 90^\circ)) = (-\sin t, \cos t).$$

Columns in place:

$$R_t = \begin{bmatrix} \cos t & -\sin t \\ \sin t & \cos t \end{bmatrix}.$$

So rotation is linear with this matrix, and the formula $R_t\begin{bmatrix} x \\ y \end{bmatrix} = (x\cos t - y\sin t,\; x\sin t + y\cos t)$ from Trigonometry is nothing but $x\,T(\mathbf{e}_1) + y\,T(\mathbf{e}_2)$.`,
        },
        {
          kind: "diagram",
          view: [-1.6, 1.6, -1.6, 1.6],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "E1", x: 1, y: 0, label: "\\mathbf{e}_1", dir: "se" },
            { name: "E2", x: 0, y: 1, label: "\\mathbf{e}_2", dir: "nw" },
            { name: "K", x: 1, y: 1, label: "", hidden: true },
            { name: "R1", x: "cos(t pi/180)", y: "sin(t pi/180)", label: "(\\cos t, \\sin t)", dir: "e" },
            { name: "R2", x: "-sin(t pi/180)", y: "cos(t pi/180)", label: "(-\\sin t, \\cos t)", dir: "n" },
            { name: "RK", x: "cos(t pi/180) - sin(t pi/180)", y: "sin(t pi/180) + cos(t pi/180)", label: "", hidden: true },
          ],
          polygons: [
            { points: ["O", "E1", "K", "E2"], fill: 1 },
            { points: ["O", "R1", "RK", "R2"], fill: 2 },
          ],
          segments: [
            { from: "O", to: "R1", arrow: true, color: 2 },
            { from: "O", to: "R2", arrow: true, color: 2 },
          ],
          circles: [{ center: "O", radius: 1, dashed: true }],
          angles: [{ at: "O", from: "E1", to: "R1", label: "{t}^\\circ" }],
          params: [{ name: "t", tex: "t", min: 0, max: 360, step: 15, value: 30 }],
          readouts: [
            { label: "\\cos t", value: "cos(t pi/180)" },
            { label: "\\sin t", value: "sin(t pi/180)" },
          ],
          caption: md`Rotation by $t$. Both columns of $R_t$ stay on the unit circle, a quarter turn apart. At $t = 90^\circ$ the matrix is $\begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}$; at $t = 180^\circ$ it is $-I$.`,
        },
        {
          kind: "key",
          title: "A gallery of standard matrices",
          body: md`Each comes from the two questions: where do $\mathbf{e}_1$ and $\mathbf{e}_2$ go?

- Rotation by $t$ counterclockwise: $\begin{bmatrix} \cos t & -\sin t \\ \sin t & \cos t \end{bmatrix}$. Quarter turn: $\begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}$.
- Reflection across the $x$-axis: $\begin{bmatrix} 1 & 0 \\ 0 & -1 \end{bmatrix}$. Across the $y$-axis: $\begin{bmatrix} -1 & 0 \\ 0 & 1 \end{bmatrix}$. Across $y = x$: $\begin{bmatrix} 0 & 1 \\ 1 & 0 \end{bmatrix}$. Across $y = -x$: $\begin{bmatrix} 0 & -1 \\ -1 & 0 \end{bmatrix}$.
- Projection onto the $x$-axis, $(x, y) \mapsto (x, 0)$: $\begin{bmatrix} 1 & 0 \\ 0 & 0 \end{bmatrix}$.
- Scaling $(x, y) \mapsto (sx, ty)$: $\begin{bmatrix} s & 0 \\ 0 & t \end{bmatrix}$.
- Horizontal shear $(x, y) \mapsto (x + ky, y)$: $\begin{bmatrix} 1 & k \\ 0 & 1 \end{bmatrix}$. Vertical shear $(x, y) \mapsto (x, y + kx)$: $\begin{bmatrix} 1 & 0 \\ k & 1 \end{bmatrix}$.

Don't memorize these. Rebuild any one in ten seconds from the images of $\mathbf{e}_1$ and $\mathbf{e}_2$.`,
        },
        {
          kind: "example",
          title: "A shear",
          problem: md`$T(x, y) = (x + 2y,\; y)$. Find the standard matrix and describe what $T$ does to the unit square.`,
          steps: [
            { math: md`T(1, 0) = (1, 0), \qquad T(0, 1) = (2, 1)`, note: md`Substitute $(x, y) = (1, 0)$ and then $(0, 1)$ into the rule.` },
            { math: md`A = \begin{bmatrix} 1 & 2 \\ 0 & 1 \end{bmatrix}`, note: "Columns are the two images." },
            { math: md`(0, 0) \mapsto (0, 0), \quad (1, 0) \mapsto (1, 0), \quad (1, 1) \mapsto (3, 1), \quad (0, 1) \mapsto (2, 1)`, note: "The bottom edge stays. The top edge slides 2 units right. The square leans into a parallelogram of the same height." },
          ],
        },
        {
          kind: "why",
          title: "Which functions are not linear",
          body: md`Test the two rules, or look for a broken consequence.

- $f(x, y) = (x + 1, y)$, a translation. $f(0, 0) = (1, 0) \ne (0, 0)$. Not linear: the origin moved.
- $f(x, y) = (xy, y)$. Then $f(2, 2) = (4, 2)$ but $2f(1, 1) = (2, 2)$. Scaling the input by 2 didn't scale the output by 2. Not linear.
- $f(x, y) = (x^2, y)$ fails the same test.

Linear means every output coordinate is a plain combination $a x + b y$ with constant coefficients: no constants added, no products of variables, no powers. That is exactly what a matrix row produces.`,
        },
        {
          kind: "check",
          prompt: md`Find the standard matrix of the rotation by $90^\circ$ counterclockwise about the origin. ${LIKE}`,
          answer: "[[0, -1], [1, 0]]",
          form: "matrix",
          explain: md`$\mathbf{e}_1 = (1, 0)$ turns to $(0, 1)$ and $\mathbf{e}_2 = (0, 1)$ turns to $(-1, 0)$. Those are the columns: $\begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}$. It matches $R_t$ with $\cos 90^\circ = 0$, $\sin 90^\circ = 1$.`,
        },
        {
          kind: "check",
          prompt: md`$T(\mathbf{x}) = \begin{bmatrix} 1 & 2 \\ 0 & 3 \end{bmatrix}\mathbf{x}$. Find the image of $(2, -1)$. Give it as $(p, q)$.`,
          answer: "(0, -3)",
          form: "tuple",
          explain: md`$2\begin{bmatrix} 1 \\ 0 \end{bmatrix} + (-1)\begin{bmatrix} 2 \\ 3 \end{bmatrix} = \begin{bmatrix} 0 \\ -3 \end{bmatrix}$.`,
        },
      ],
      practice: [standardMatrix, imageOfPoint, fromBasisImages],
    },
    {
      id: slug("Composition and matrix multiplication"),
      title: "Composition and matrix multiplication",
      summary: "Doing one transformation after another, and the row-column rule that composition forces on matrix products.",
      blocks: [
        {
          kind: "text",
          body: md`Rotate the plane, then shear it. Two transformations in a row make a new transformation: first $\mathbf{x} \mapsto B\mathbf{x}$, then apply $A$ to the result,

$$\mathbf{x} \mapsto A(B\mathbf{x}).$$

This is the **composition** of the two maps. Is it linear? If so it has a standard matrix, and we will call that matrix $AB$. Everything about matrix multiplication, including its odd-looking rule, falls out of this one decision.`,
        },
        {
          kind: "why",
          title: "A composition of linear maps is linear, so it has a matrix",
          body: md`Let $S(\mathbf{x}) = B\mathbf{x}$ and $T(\mathbf{y}) = A\mathbf{y}$, with $B$ an $n \times p$ matrix and $A$ an $m \times n$ matrix, so that the output of $S$ (in $\mathbb{R}^n$) is a legal input for $T$. For the composition $T(S(\mathbf{x}))$:

$$T(S(\mathbf{u} + \mathbf{v})) = T(S(\mathbf{u}) + S(\mathbf{v})) = T(S(\mathbf{u})) + T(S(\mathbf{v})),$$

using linearity of $S$, then of $T$. Scalars pass through the same way. So the composition is linear, and by the last lesson it is multiplication by one matrix: the one whose columns are the images of $\mathbf{e}_1, \dots, \mathbf{e}_p$. Column $j$ is

$$T(S(\mathbf{e}_j)) = A(B\mathbf{e}_j) = A\mathbf{b}_j,$$

because $B\mathbf{e}_j$ is the $j$-th column of $B$. That is the definition.`,
        },
        {
          kind: "key",
          title: "Matrix multiplication",
          body: md`For $A$ of size $m \times n$ and $B$ of size $n \times p$ with columns $\mathbf{b}_1, \dots, \mathbf{b}_p$,

$$AB = \begin{bmatrix} A\mathbf{b}_1 & A\mathbf{b}_2 & \cdots & A\mathbf{b}_p \end{bmatrix},$$

an $m \times p$ matrix. It is the matrix of "do $B$, then do $A$": $(AB)\mathbf{x} = A(B\mathbf{x})$ for every $\mathbf{x}$. The product exists only when the **inner sizes match**: columns of $A$ = rows of $B$. The outer sizes give the answer's size: $(m \times n)(n \times p) = m \times p$.`,
        },
        {
          kind: "why",
          title: "The row-column rule",
          body: md`Column $j$ of $AB$ is $A\mathbf{b}_j$. By the row rule from lesson 1, entry $i$ of $A\mathbf{b}_j$ is row $i$ of $A$ dotted with $\mathbf{b}_j$. So

$$(AB)_{ij} = (\text{row } i \text{ of } A) \cdot (\text{column } j \text{ of } B) = a_{i1}b_{1j} + a_{i2}b_{2j} + \cdots + a_{in}b_{nj}.$$

To fill entry $(i, j)$, run your left finger along row $i$ of $A$ and your right finger down column $j$ of $B$, multiplying pairs and adding. The rule looks strange on its own. It is forced by wanting $AB$ to mean "$B$ then $A$".`,
        },
        {
          kind: "example",
          title: "A $2 \times 2$ product",
          problem: md`Compute $AB$ for $A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}$ and $B = \begin{bmatrix} 0 & -1 \\ 2 & 5 \end{bmatrix}$.`,
          steps: [
            { math: md`A\mathbf{b}_1 = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}\begin{bmatrix} 0 \\ 2 \end{bmatrix} = \begin{bmatrix} 4 \\ 8 \end{bmatrix}`, note: "First column of AB: A times the first column of B." },
            { math: md`A\mathbf{b}_2 = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}\begin{bmatrix} -1 \\ 5 \end{bmatrix} = \begin{bmatrix} 9 \\ 17 \end{bmatrix}`, note: "Second column." },
            { math: md`AB = \begin{bmatrix} 4 & 9 \\ 8 & 17 \end{bmatrix}`, note: md`Row-column check of entry $(2, 1)$: $3(0) + 4(2) = 8$. Entry $(1, 2)$: $1(-1) + 2(5) = 9$.` },
          ],
        },
        {
          kind: "example",
          title: "Rectangular sizes",
          problem: md`$A = \begin{bmatrix} 1 & 2 & 0 \\ -1 & 3 & 2 \end{bmatrix}$ ($2 \times 3$) and $B = \begin{bmatrix} 2 & 1 \\ 0 & -1 \\ 1 & 4 \end{bmatrix}$ ($3 \times 2$). Find $AB$ and the size of $BA$.`,
          steps: [
            { math: md`(2 \times 3)(3 \times 2) = 2 \times 2`, note: "Inner sizes 3 and 3 match; the product is 2 × 2." },
            { math: md`AB = \begin{bmatrix} 1(2) + 2(0) + 0(1) & 1(1) + 2(-1) + 0(4) \\ -1(2) + 3(0) + 2(1) & -1(1) + 3(-1) + 2(4) \end{bmatrix}`, note: "Each entry: a row of A dotted with a column of B, three products each." },
            { math: md`AB = \begin{bmatrix} 2 & -1 \\ 0 & 4 \end{bmatrix}`, note: "" },
            { math: md`BA: (3 \times 2)(2 \times 3) = 3 \times 3`, note: md`Also defined, but a different size. $AB$ and $BA$ can't even be compared here.` },
          ],
        },
        {
          kind: "diagram",
          view: [-2.2, 2.6, -1.8, 2.2],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "E1", x: 1, y: 0, label: "", dir: "se" },
            { name: "E2", x: 0, y: 1, label: "", dir: "nw" },
            { name: "K", x: 1, y: 1, label: "", hidden: true },
            { name: "B1", x: "cos(t pi/180)", y: "sin(t pi/180)", label: "B\\mathbf{e}_1", dir: "se" },
            { name: "B2", x: "-sin(t pi/180)", y: "cos(t pi/180)", label: "B\\mathbf{e}_2", dir: "nw" },
            { name: "BK", x: "cos(t pi/180) - sin(t pi/180)", y: "sin(t pi/180) + cos(t pi/180)", label: "", hidden: true },
            { name: "C1", x: "cos(t pi/180) + k sin(t pi/180)", y: "sin(t pi/180)", label: "AB\\mathbf{e}_1", dir: "e" },
            { name: "C2", x: "-sin(t pi/180) + k cos(t pi/180)", y: "cos(t pi/180)", label: "AB\\mathbf{e}_2", dir: "n" },
            { name: "CK", x: "cos(t pi/180) - sin(t pi/180) + k(sin(t pi/180) + cos(t pi/180))", y: "sin(t pi/180) + cos(t pi/180)", label: "", hidden: true },
          ],
          polygons: [
            { points: ["O", "E1", "K", "E2"], fill: 1 },
            { points: ["O", "B1", "BK", "B2"], fill: 2 },
            { points: ["O", "C1", "CK", "C2"], fill: 3 },
          ],
          segments: [
            { from: "O", to: "C1", arrow: true, color: 3 },
            { from: "O", to: "C2", arrow: true, color: 3 },
          ],
          params: [
            { name: "t", tex: "t", min: 0, max: 90, step: 5, value: 30 },
            { name: "k", tex: "k", min: -1.5, max: 1.5, step: 0.25, value: 0.75 },
          ],
          caption: md`First the rotation $B = R_t$ takes the blue square to the orange one. Then the shear $A = \begin{bmatrix} 1 & k \\ 0 & 1 \end{bmatrix}$ slides each point right by $k$ times its height, giving the green parallelogram. Its sides are the columns of $AB$: $A$ applied to each column of $B$.`,
        },
        {
          kind: "key",
          title: "$AB$ is not $BA$",
          body: md`Order matters, because doing $B$ then $A$ is not doing $A$ then $B$. Let $R = \begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}$ (quarter turn) and $F = \begin{bmatrix} 1 & 0 \\ 0 & -1 \end{bmatrix}$ (reflect across the $x$-axis). Then

$$FR = \begin{bmatrix} 0 & -1 \\ -1 & 0 \end{bmatrix} \quad (\text{rotate, then reflect: reflection across } y = -x),$$
$$RF = \begin{bmatrix} 0 & 1 \\ 1 & 0 \end{bmatrix} \quad (\text{reflect, then rotate: reflection across } y = x).$$

Different matrices, different motions. In a product $AB$ the matrix on the **right acts first**, because $(AB)\mathbf{x} = A(B\mathbf{x})$ and $B$ is the one touching $\mathbf{x}$. Sometimes $BA$ isn't even defined when $AB$ is.`,
        },
        {
          kind: "proof",
          title: "Matrix multiplication is associative",
          given: md`Matrices $A$ ($m \times n$), $B$ ($n \times p$) and $C$ ($p \times q$)`,
          prove: md`$(AB)C = A(BC)$`,
          steps: [
            { statement: md`For every $\mathbf{x}$: $((AB)C)\mathbf{x} = (AB)(C\mathbf{x}) = A(B(C\mathbf{x}))$`, reason: md`$(PQ)\mathbf{x} = P(Q\mathbf{x})$ is what the product means, used twice.` },
            { statement: md`For every $\mathbf{x}$: $(A(BC))\mathbf{x} = A((BC)\mathbf{x}) = A(B(C\mathbf{x}))$`, reason: "The same fact, twice." },
            { statement: md`$(AB)C$ and $A(BC)$ are both the standard matrix of $\mathbf{x} \mapsto A(B(C\mathbf{x}))$`, reason: "They agree on every input." },
            { statement: md`$(AB)C = A(BC)$`, reason: md`A linear map has only one standard matrix (last lesson: column $i$ must be the image of $\mathbf{e}_i$).` },
          ],
        },
        {
          kind: "text",
          body: md`The same argument gives the distributive laws $A(B + C) = AB + AC$ and $(A + B)C = AC + BC$: both sides are the matrix of the same map, by linearity. So you may expand products of sums the usual way, as long as you **never swap the order** of a product. For instance $(A + B)^2 = A^2 + AB + BA + B^2$, and the middle terms don't combine.`,
        },
        {
          kind: "key",
          title: "The identity matrix and the transpose",
          body: md`The $n \times n$ **identity matrix** $I$ has 1s on the main diagonal and 0s elsewhere. Its columns are $\mathbf{e}_1, \dots, \mathbf{e}_n$, so $I\mathbf{x} = x_1\mathbf{e}_1 + \cdots + x_n\mathbf{e}_n = \mathbf{x}$: it is the do-nothing transformation, and $AI = IA = A$.

The **transpose** $A^T$ of an $m \times n$ matrix is the $n \times m$ matrix with $(A^T)_{ij} = a_{ji}$: rows become columns. For example $\begin{bmatrix} 1 & 2 & 3 \\ 4 & 5 & 6 \end{bmatrix}^T = \begin{bmatrix} 1 & 4 \\ 2 & 5 \\ 3 & 6 \end{bmatrix}$. Rules: $(A^T)^T = A$, $(A + B)^T = A^T + B^T$, and

$$(AB)^T = B^T A^T.$$

The transpose reverses the order, just as inverses will in the next lesson.`,
        },
        {
          kind: "why",
          title: "Why $(AB)^T = B^T A^T$",
          body: md`Compare entry $(i, j)$ on each side. On the left, $((AB)^T)_{ij} = (AB)_{ji}$, which is row $j$ of $A$ dotted with column $i$ of $B$. On the right, $(B^T A^T)_{ij}$ is row $i$ of $B^T$ dotted with column $j$ of $A^T$. Row $i$ of $B^T$ is column $i$ of $B$; column $j$ of $A^T$ is row $j$ of $A$. Same two vectors, same dot product. Every entry agrees, so the matrices are equal. Writing $A^T B^T$ instead would usually not even have matching sizes.`,
        },
        {
          kind: "example",
          title: "Two rotations by $45^\circ$",
          problem: md`Let $R = \begin{bmatrix} c & -c \\ c & c \end{bmatrix}$ with $c = \frac{\sqrt{2}}{2}$ be rotation by $45^\circ$. Compute $R^2 = RR$.`,
          steps: [
            { math: md`R^2 = \begin{bmatrix} c \cdot c + (-c)(c) & c(-c) + (-c)(c) \\ c \cdot c + c \cdot c & c(-c) + c \cdot c \end{bmatrix}`, note: "Row-column rule, four entries." },
            { math: md`= \begin{bmatrix} 0 & -2c^2 \\ 2c^2 & 0 \end{bmatrix} = \begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}`, note: md`$2c^2 = 2 \cdot \frac{2}{4} = 1$.` },
            { math: md`R^2 = R_{90^\circ}`, note: "Two turns of 45° make a quarter turn. The arithmetic knows the geometry." },
          ],
        },
        {
          kind: "check",
          prompt: md`Compute $\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}\begin{bmatrix} 0 & 1 \\ 1 & 0 \end{bmatrix}$. ${LIKE}`,
          answer: "[[2, 1], [4, 3]]",
          form: "matrix",
          explain: md`Column 1 of the product is $A\mathbf{e}_2 = (2, 4)$; column 2 is $A\mathbf{e}_1 = (1, 3)$. Multiplying by the swap matrix on the right swaps the columns of $A$: $\begin{bmatrix} 2 & 1 \\ 4 & 3 \end{bmatrix}$.`,
        },
        {
          kind: "check",
          prompt: md`$A$ is $3 \times 2$ and $B$ is $2 \times 4$. What is the size of $AB$?`,
          choices: ["3 × 4", "2 × 2", "4 × 3", "not defined"],
          accept: ["3 × 4"],
          explain: md`Inner sizes 2 and 2 match, so the product exists with the outer sizes: $3 \times 4$. ($BA$ would be $(2 \times 4)(3 \times 2)$, undefined.)`,
        },
      ],
      practice: [multiplySquare, multiplyRectangular, entryOrTranspose],
    },
    {
      id: slug("The inverse of a matrix"),
      title: "The inverse of a matrix",
      summary: "Undoing a transformation: when an inverse matrix exists, how to compute it, and what it says about solving Ax = b.",
      blocks: [
        {
          kind: "text",
          body: md`A rotation by $30^\circ$ is undone by a rotation by $-30^\circ$. The shear $(x, y) \mapsto (x + 2y, y)$ is undone by $(x, y) \mapsto (x - 2y, y)$. The projection onto the $x$-axis cannot be undone: once $(3, 5)$ and $(3, -1)$ have both become $(3, 0)$, no function can tell them apart again.

When an undo exists it is linear too, so it is a matrix. Doing $A$ and then the undo is doing nothing, and the matrix of doing nothing is $I$.`,
        },
        {
          kind: "key",
          title: "Inverse matrix",
          body: md`A square matrix $A$ is **invertible** if there is a matrix $A^{-1}$ with

$$A^{-1}A = I \qquad \text{and} \qquad AA^{-1} = I.$$

Then $A^{-1}$ is the **inverse** of $A$. A square matrix with no inverse is **singular**. The inverse, when it exists, is unique: if $B$ and $C$ are both inverses, then $B = BI = B(AC) = (BA)C = IC = C$, by associativity.`,
        },
        {
          kind: "why",
          title: "The $2 \times 2$ inverse formula, derived",
          body: md`Let $A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$ and look for $X$ with $AX = I$. The columns of $AX$ are $A$ times the columns of $X$, so column 1 of $X$ solves $A\mathbf{x} = \mathbf{e}_1$:

$$\begin{cases} ax + bz = 1 \\ cx + dz = 0 \end{cases}$$

Multiply the first equation by $d$ and the second by $b$, subtract: $(ad - bc)x = d$. Multiply the first by $c$, the second by $a$, subtract: $(bc - ad)z = c$. If $ad - bc \ne 0$,

$$x = \frac{d}{ad - bc}, \qquad z = \frac{-c}{ad - bc}.$$

Column 2 solves $A\mathbf{x} = \mathbf{e}_2$, the same system with right-hand side $(0, 1)$: $y = \frac{-b}{ad - bc}$, $w = \frac{a}{ad - bc}$. Put the columns together:

$$A^{-1} = \frac{1}{ad - bc}\begin{bmatrix} d & -b \\ -c & a \end{bmatrix}.$$

Multiply it out and you'll find $A^{-1}A = I$ as well, so this is a two-sided inverse.`,
        },
        {
          kind: "key",
          title: "The $2 \times 2$ inverse",
          body: md`$$\begin{bmatrix} a & b \\ c & d \end{bmatrix}^{-1} = \frac{1}{ad - bc}\begin{bmatrix} d & -b \\ -c & a \end{bmatrix}, \qquad \text{provided } ad - bc \ne 0.$$

Swap the diagonal entries, negate the other two, divide by $ad - bc$. The number $ad - bc$ is the **determinant** $\det A$ from Algebra 3. A $2 \times 2$ matrix is invertible exactly when its determinant is not zero.`,
        },
        {
          kind: "why",
          title: "Why $ad - bc = 0$ means no inverse",
          body: md`If $ad - bc = 0$ then $ad = bc$, and the two columns $(a, c)$ and $(b, d)$ are parallel: one is a multiple of the other, or one is zero. Every output $A\mathbf{x} = x_1(a, c) + x_2(b, d)$ then lies on a single line through the origin (or is the origin). $A$ **squashes the plane onto a line.**

A squashed plane can't be unsquashed. Infinitely many inputs share each output, so no function, let alone a matrix, can send each output back to the one input it came from. Algebraically: there is a nonzero $\mathbf{v}$ with $A\mathbf{v} = \mathbf{0}$, and if $A^{-1}$ existed we would get $\mathbf{v} = A^{-1}A\mathbf{v} = A^{-1}\mathbf{0} = \mathbf{0}$, a contradiction.

In the figure, $ad - bc$ is also the signed area of the image of the unit square (Unit 4 proves this). Watch it hit 0 exactly when the parallelogram flattens.`,
        },
        {
          kind: "diagram",
          view: [-3.5, 3.5, -3.5, 3.5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "E1", x: 1, y: 0, label: "", dir: "s" },
            { name: "E2", x: 0, y: 1, label: "", dir: "w" },
            { name: "K", x: 1, y: 1, label: "", hidden: true },
            { name: "P1", x: "a", y: "c", label: "(a, c)", dir: "se" },
            { name: "P2", x: "b", y: "d", label: "(b, d)", dir: "nw" },
            { name: "Q", x: "a + b", y: "c + d", label: "", hidden: true },
          ],
          polygons: [
            { points: ["O", "E1", "K", "E2"], fill: 1 },
            { points: ["O", "P1", "Q", "P2"], fill: 2 },
          ],
          segments: [
            { from: "O", to: "P1", arrow: true, color: 2 },
            { from: "O", to: "P2", arrow: true, color: 2 },
          ],
          params: [
            { name: "a", tex: "a", min: -2, max: 2, step: 0.5, value: 2 },
            { name: "b", tex: "b", min: -2, max: 2, step: 0.5, value: 1 },
            { name: "c", tex: "c", min: -2, max: 2, step: 0.5, value: 1 },
            { name: "d", tex: "d", min: -2, max: 2, step: 0.5, value: 0.5 },
          ],
          readouts: [{ label: "ad - bc", value: "a d - b c" }],
          caption: md`The image of the unit square under $\begin{bmatrix} a & b \\ c & d \end{bmatrix}$. Slide $d$ to $0.5$ with $a = 2, b = 1, c = 1$: the determinant is $0$, the columns line up and the square collapses to a segment. No inverse exists there.`,
        },
        {
          kind: "example",
          title: "Two inverses by formula",
          problem: md`Find the inverses of $A = \begin{bmatrix} 2 & 5 \\ 1 & 3 \end{bmatrix}$ and $B = \begin{bmatrix} 4 & 2 \\ 1 & 3 \end{bmatrix}$.`,
          steps: [
            { math: md`\det A = 2(3) - 5(1) = 1`, note: "Nonzero: invertible. Dividing by 1 changes nothing." },
            { math: md`A^{-1} = \begin{bmatrix} 3 & -5 \\ -1 & 2 \end{bmatrix}`, note: md`Check: $AA^{-1} = \begin{bmatrix} 6 - 5 & -10 + 10 \\ 3 - 3 & -5 + 6 \end{bmatrix} = I$.` },
            { math: md`\det B = 4(3) - 2(1) = 10`, note: "" },
            { math: md`B^{-1} = \frac{1}{10}\begin{bmatrix} 3 & -2 \\ -1 & 4 \end{bmatrix} = \begin{bmatrix} \frac{3}{10} & -\frac{1}{5} \\ -\frac{1}{10} & \frac{2}{5} \end{bmatrix}`, note: "Fractions are normal. Swap, negate, divide." },
          ],
        },
        {
          kind: "key",
          title: "Gauss-Jordan: $[\\,A \\mid I\\,] \\to [\\,I \\mid A^{-1}\\,]$",
          body: md`For any square matrix, write $A$ and $I$ side by side in one augmented matrix and row-reduce until the left half is $I$. The right half is then $A^{-1}$:

$$[\,A \mid I\,] \xrightarrow{\text{row operations}} [\,I \mid A^{-1}\,].$$

If the left half cannot be reduced to $I$ (a row of zeros appears), $A$ is singular.`,
        },
        {
          kind: "why",
          title: "Why Gauss-Jordan finds the inverse",
          body: md`We want $X$ with $AX = I$. Column $j$ of $X$ solves $A\mathbf{x}_j = \mathbf{e}_j$, a linear system with coefficient matrix $A$. You know how to solve it: row-reduce $[\,A \mid \mathbf{e}_j\,]$. Row operations never change the solution set (Algebra 3), so when the left side becomes $I$ the right side reads off $\mathbf{x}_j$.

The $n$ systems share the same coefficient matrix, so the same row operations work for all of them. Do them all at once: the right-hand sides $\mathbf{e}_1, \dots, \mathbf{e}_n$ side by side are exactly $I$. That is $[\,A \mid I\,]$, and the right half ends up as $[\,\mathbf{x}_1 \cdots \mathbf{x}_n\,] = X$.

If $A$ can't be reduced to $I$, it has fewer than $n$ pivots, so some system $A\mathbf{x} = \mathbf{e}_j$ has no solution or infinitely many. Either way there is no $X$, and $A$ is singular.`,
        },
        {
          kind: "example",
          title: "A $3 \times 3$ inverse by Gauss-Jordan",
          problem: md`Find $A^{-1}$ for $A = \begin{bmatrix} 1 & 2 & 1 \\ 0 & 1 & 0 \\ 1 & 1 & 2 \end{bmatrix}$.`,
          steps: [
            { math: md`\left[\begin{array}{ccc|ccc} 1 & 2 & 1 & 1 & 0 & 0 \\ 0 & 1 & 0 & 0 & 1 & 0 \\ 1 & 1 & 2 & 0 & 0 & 1 \end{array}\right]`, note: "A on the left, I on the right." },
            { math: md`\xrightarrow{R_3 \to R_3 - R_1} \left[\begin{array}{ccc|ccc} 1 & 2 & 1 & 1 & 0 & 0 \\ 0 & 1 & 0 & 0 & 1 & 0 \\ 0 & -1 & 1 & -1 & 0 & 1 \end{array}\right]`, note: "Clear below the first pivot." },
            { math: md`\xrightarrow{R_3 \to R_3 + R_2} \left[\begin{array}{ccc|ccc} 1 & 2 & 1 & 1 & 0 & 0 \\ 0 & 1 & 0 & 0 & 1 & 0 \\ 0 & 0 & 1 & -1 & 1 & 1 \end{array}\right]`, note: "Clear below the second pivot. The left half is now in echelon form with three pivots: A is invertible." },
            { math: md`\xrightarrow{R_1 \to R_1 - 2R_2} \left[\begin{array}{ccc|ccc} 1 & 0 & 1 & 1 & -2 & 0 \\ 0 & 1 & 0 & 0 & 1 & 0 \\ 0 & 0 & 1 & -1 & 1 & 1 \end{array}\right]`, note: "Now clear above the pivots." },
            { math: md`\xrightarrow{R_1 \to R_1 - R_3} \left[\begin{array}{ccc|ccc} 1 & 0 & 0 & 2 & -3 & -1 \\ 0 & 1 & 0 & 0 & 1 & 0 \\ 0 & 0 & 1 & -1 & 1 & 1 \end{array}\right]`, note: "The left half is I." },
            { math: md`A^{-1} = \begin{bmatrix} 2 & -3 & -1 \\ 0 & 1 & 0 \\ -1 & 1 & 1 \end{bmatrix}`, note: md`Check one entry of $AA^{-1}$: row 3 of $A$ dotted with column 1, $1(2) + 1(0) + 2(-1) = 0$. Right, that's off the diagonal.` },
          ],
        },
        {
          kind: "proof",
          title: "$(AB)^{-1} = B^{-1}A^{-1}$",
          given: md`Invertible $n \times n$ matrices $A$ and $B$`,
          prove: md`$AB$ is invertible, with inverse $B^{-1}A^{-1}$`,
          steps: [
            { statement: md`$(AB)(B^{-1}A^{-1}) = A(BB^{-1})A^{-1}$`, reason: "Associativity: regroup the four factors." },
            { statement: md`$= AIA^{-1} = AA^{-1} = I$`, reason: md`$BB^{-1} = I$ and $AI = A$.` },
            { statement: md`$(B^{-1}A^{-1})(AB) = B^{-1}(A^{-1}A)B = B^{-1}IB = B^{-1}B = I$`, reason: "Same steps on the other side." },
            { statement: md`$B^{-1}A^{-1}$ is the inverse of $AB$`, reason: "It satisfies both equations in the definition, and inverses are unique." },
          ],
        },
        {
          kind: "text",
          body: md`The order flips for a reason you already know from getting dressed: $AB$ means "$B$, then $A$" (socks, then shoes). To undo it, undo the last thing first: $A^{-1}$ (shoes off), then $B^{-1}$ (socks off). Reading right to left, that's $B^{-1}A^{-1}$.`,
        },
        {
          kind: "key",
          title: "Solving $A\\mathbf{x} = \\mathbf{b}$ with the inverse",
          body: md`If $A$ is invertible, then $A\mathbf{x} = \mathbf{b}$ has exactly one solution:

$$\mathbf{x} = A^{-1}\mathbf{b}.$$

Multiply both sides on the left by $A^{-1}$: $A^{-1}A\mathbf{x} = A^{-1}\mathbf{b}$, and $A^{-1}A = I$. Checking that it works: $A(A^{-1}\mathbf{b}) = I\mathbf{b} = \mathbf{b}$. For $A = \begin{bmatrix} 2 & 5 \\ 1 & 3 \end{bmatrix}$ and $\mathbf{b} = (1, 4)$, $\mathbf{x} = \begin{bmatrix} 3 & -5 \\ -1 & 2 \end{bmatrix}\begin{bmatrix} 1 \\ 4 \end{bmatrix} = \begin{bmatrix} -17 \\ 7 \end{bmatrix}$. Check: $2(-17) + 5(7) = 1$ and $-17 + 3(7) = 4$.

For a single right-hand side, plain elimination is less work than finding $A^{-1}$. The inverse pays off when the same $A$ must be solved against many different $\mathbf{b}$.`,
        },
        {
          kind: "key",
          title: "The invertible matrix theorem",
          body: md`For a square $n \times n$ matrix $A$, these statements are all true or all false:

- $A$ is invertible.
- $\det A \ne 0$ (for $2 \times 2$, $ad - bc \ne 0$; Unit 4 does $n \times n$).
- The reduced row echelon form of $A$ is $I$ ($A$ has $n$ pivots).
- $A\mathbf{x} = \mathbf{0}$ has only the solution $\mathbf{x} = \mathbf{0}$.
- $A\mathbf{x} = \mathbf{b}$ has exactly one solution for every $\mathbf{b}$.
- The columns of $A$ are linearly independent, and they span $\mathbb{R}^n$.
- The transformation $\mathbf{x} \mapsto A\mathbf{x}$ is one-to-one and onto.

The links: $n$ pivots means every column is a pivot column (independent columns, no free variables, only the zero solution to $A\mathbf{x} = \mathbf{0}$) and every row has a pivot (every $\mathbf{b}$ reachable). Gauss-Jordan ties $n$ pivots to the existence of $A^{-1}$. Fewer than $n$ pivots breaks every item at once.`,
        },
        {
          kind: "check",
          prompt: md`Find the inverse of $\begin{bmatrix} 3 & 1 \\ 5 & 2 \end{bmatrix}$. ${LIKE}`,
          answer: "[[2, -1], [-5, 3]]",
          form: "matrix",
          explain: md`$ad - bc = 6 - 5 = 1$. Swap the diagonal, negate the rest: $\begin{bmatrix} 2 & -1 \\ -5 & 3 \end{bmatrix}$. Check: $\begin{bmatrix} 3 & 1 \\ 5 & 2 \end{bmatrix}\begin{bmatrix} 2 & -1 \\ -5 & 3 \end{bmatrix} = \begin{bmatrix} 1 & 0 \\ 0 & 1 \end{bmatrix}$.`,
        },
        {
          kind: "check",
          prompt: md`For which value of $k$ is $\begin{bmatrix} 2 & k \\ 3 & 6 \end{bmatrix}$ singular?`,
          answer: "4",
          explain: md`Singular means $ad - bc = 0$: $2(6) - 3k = 0$, so $k = 4$. Then the columns $(2, 3)$ and $(4, 6)$ are parallel.`,
        },
      ],
      practice: [inverse2x2, solveWithInverse, singularAndProducts],
    },
  ],
};
