import { frac, fracTex, paren, poly, signed } from "../../math/random";
import { md, slug, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Matrix helpers ──────────────────────────────────────────────────────────

type M = number[][];

const rows = (m: M) => m.map((r) => r.join(" & ")).join(" \\\\ ");
/** A matrix in square brackets. */
const bmat = (m: M) => `\\begin{bmatrix} ${rows(m)} \\end{bmatrix}`;
/** A determinant in vertical bars. */
const vmat = (m: M) => `\\begin{vmatrix} ${rows(m)} \\end{vmatrix}`;
const det2 = (m: M) => m[0]![0]! * m[1]![1]! - m[0]![1]! * m[1]![0]!;
/** The matrix with row i and column j removed. */
const minor = (m: M, i: number, j: number): M => m.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
const det3 = (m: M) => [0, 1, 2].reduce((s, j) => s + (j % 2 ? -1 : 1) * m[0]![j]! * det2(minor(m, 0, j)), 0);
/** "3 \cdot (-5)" with negatives in parentheses. */
const times = (p: number, q: number) => `${paren(p)} \\cdot ${paren(q)}`;
/** "3(5) - (-2)(4)", the 2 by 2 formula with numbers in. */
const expand2 = (m: M) => `${paren(m[0]![0]!)}(${m[1]![1]}) - ${paren(m[0]![1]!)}(${m[1]![0]})`;
/** A column vector with angle brackets. */
const vec = (x: number, y: number) => `\\langle ${x}, ${y} \\rangle`;
/** "+ 3" or "- 3" in front of a factor, or the bare sign for 1 and -1. */
const coefSign = (c: number, first: boolean) => {
  const mag = Math.abs(c) === 1 ? "" : String(Math.abs(c));
  if (first) return c < 0 ? `-${mag}` : mag;
  return c < 0 ? ` - ${mag}` : ` + ${mag}`;
};
/** Replace column j of m by the column vector b. */
const replaceCol = (m: M, j: number, b: number[]): M => m.map((row, i) => row.map((v, c) => (c === j ? b[i]! : v)));
/** Which row of a 3 by 3 has the most zeros (the first such). */
const bestRow = (m: M) => m.map((row, i) => [row.filter((v) => v === 0).length, i] as const).sort((p, q) => q[0] - p[0] || p[1] - q[1])[0]![1];

/** The steps of a cofactor expansion of a 3 by 3 determinant along row i. */
function expansionSteps(m: M, i: number): Step[] {
  const terms = [0, 1, 2].filter((j) => m[i]![j] !== 0);
  const sign = (j: number) => ((i + j) % 2 === 0 ? 1 : -1);
  const line1 = terms.map((j, k) => `${coefSign(sign(j) * m[i]![j]!, k === 0)}${vmat(minor(m, i, j))}`).join("");
  const line2 = terms.map((j, k) => `${coefSign(sign(j) * m[i]![j]!, k === 0)}(${expand2(minor(m, i, j))})`).join("");
  const line3 = terms.map((j, k) => `${coefSign(sign(j) * m[i]![j]!, k === 0)}(${det2(minor(m, i, j))})`).join("");
  const line4 = terms.map((j, k) => (k === 0 ? String(sign(j) * m[i]![j]! * det2(minor(m, i, j))) : signed(sign(j) * m[i]![j]! * det2(minor(m, i, j))))).join(" ");
  const zeros = 3 - terms.length;
  const signsRow = ["+ \\; - \\; +", "- \\; + \\; -", "+ \\; - \\; +"][i];
  return [
    {
      math: md`\det A = ${line1 || "0"}`,
      note: md`Expand along row ${i + 1}${zeros ? `: its ${zeros === 1 ? "zero entry contributes nothing" : "zero entries contribute nothing"}, so there ${terms.length === 1 ? "is only one term" : "are only two terms"}` : ""}. Each entry is multiplied by its minor (cross out the entry's row and column) with the sign pattern $${signsRow}$ for this row.`,
    },
    { math: md`= ${line2}`, note: "Each minor is a 2 by 2 determinant: down-right product minus up-right product." },
    { math: md`= ${line3}`, note: "Work out the minors." },
    { math: md`= ${line4} = ${det3(m)}`, note: "Multiply and add." },
  ];
}

/** A grid diagram of a filled polygon, the view fitted to its corners. */
function polygonFigure(points: { name: string; x: number; y: number; label?: string }[], extra: Partial<Figure & { kind: "diagram" }> = {}): Figure {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    kind: "diagram",
    view: [Math.min(0, ...xs) - 1, Math.max(0, ...xs) + 1, Math.min(0, ...ys) - 1, Math.max(0, ...ys) + 1],
    grid: true,
    points: points.map((p) => ({ name: p.name, x: p.x, y: p.y, label: p.label ?? `(${p.x}, ${p.y})`, dir: p.y >= 0 ? "n" : "s" })),
    polygons: [{ points: points.map((p) => p.name), fill: 1 }],
    ...extra,
  };
}

// ── Practice generators ─────────────────────────────────────────────────────

/** Lesson 1: the 2 by 2 formula, as a matrix or as a signed area. */
const detTwoByTwo: Generator = (r) => {
  let m: M;
  do {
    m = [
      [r.int(-6, 6), r.int(-6, 6)],
      [r.int(-6, 6), r.int(-6, 6)],
    ];
  } while (m.flat().filter((v) => v === 0).length > 1 || (r.next() < 0.8 && det2(m) === 0));
  const [[a, b], [c, d]] = m as [[number, number], [number, number]];
  const D = det2(m);
  const kind = r.int(0, 1);
  const meaning =
    D === 0
      ? md`The determinant is $0$: the columns $${vec(a, c)}$ and $${vec(b, d)}$ are parallel, the parallelogram is flattened to a segment, and $A$ is singular.`
      : md`The parallelogram with sides $${vec(a, c)}$ and $${vec(b, d)}$ has area $${Math.abs(D)}$, and the turn from the first column to the second is ${D > 0 ? "counterclockwise, so the sign is positive" : "clockwise, so the sign is negative"}.`;
  const steps: Step[] = [
    { math: md`\det A = ad - bc`, note: "Down-right diagonal product minus up-right diagonal product." },
    { math: md`= ${expand2(m)}`, note: "Substitute, keeping negatives in parentheses." },
    { math: md`= ${a * d} ${signed(-b * c)} = ${D}`, note: meaning },
  ];
  if (kind === 0) {
    return {
      prompt: md`Find the determinant of $A = ${bmat(m)}$.`,
      answer: String(D),
      simplified: true,
      hint: md`For $\begin{bmatrix} a & b \\ c & d \end{bmatrix}$ the determinant is $ad - bc$. Watch the signs: here $b = ${b}$ and $c = ${c}$.`,
      solution: steps,
    };
  }
  return {
    prompt: md`Find the signed area of the parallelogram with sides $\mathbf{u} = ${vec(a, c)}$ and $\mathbf{v} = ${vec(b, d)}$, taken in the order $\mathbf{u}$ then $\mathbf{v}$.`,
    answer: String(D),
    simplified: true,
    hint: md`The signed area is $\det \begin{bmatrix} \mathbf{u} & \mathbf{v} \end{bmatrix}$ with $\mathbf{u}$ and $\mathbf{v}$ as the columns: $${a} \cdot ${paren(d)} - ${paren(b)} \cdot ${paren(c)}$.`,
    solution: [{ math: md`A = ${bmat(m)}`, note: md`Put $\mathbf{u}$ in the first column and $\mathbf{v}$ in the second.` }, ...steps],
  };
};

/** Lesson 1: areas of parallelograms and triangles from coordinates. */
const parallelogramArea: Generator = (r) => {
  if (r.int(0, 1) === 0) {
    let a = 0;
    let b = 0;
    let c = 0;
    let d = 0;
    do {
      [a, c, b, d] = [r.int(-4, 5), r.int(-4, 5), r.int(-4, 5), r.int(-4, 5)];
    } while (Math.abs(a * d - b * c) < 2 || (a === 0 && c === 0) || (b === 0 && d === 0));
    const D = a * d - b * c;
    return {
      prompt: md`Find the area of the parallelogram with vertices $(0, 0)$, $(${a}, ${c})$, $(${a + b}, ${c + d})$ and $(${b}, ${d})$.`,
      figure: polygonFigure([
        { name: "O", x: 0, y: 0 },
        { name: "P", x: a, y: c },
        { name: "W", x: a + b, y: c + d },
        { name: "Q", x: b, y: d },
      ]),
      answer: String(Math.abs(D)),
      simplified: true,
      // Lagrange's identity: area^2 = |u|^2 |v|^2 - (u . v)^2, since area = |u| |v| sin(theta).
      verify: [`A^2 = (${paren(a)}^2 + ${paren(c)}^2)(${paren(b)}^2 + ${paren(d)}^2) - (${times(a, b).replace("\\cdot", "*")} + ${times(c, d).replace("\\cdot", "*")})^2`],
      hint: md`Two sides leave the origin: $\mathbf{u} = ${vec(a, c)}$ and $\mathbf{v} = ${vec(b, d)}$. The area is the absolute value of the determinant with those columns.`,
      solution: [
        { math: md`\mathbf{u} = ${vec(a, c)}, \quad \mathbf{v} = ${vec(b, d)}`, note: md`The sides from the origin. The fourth vertex $(${a + b}, ${c + d})$ is $\mathbf{u} + \mathbf{v}$, which confirms the pairing.` },
        { math: md`${vmat([[a, b], [c, d]])} = ${expand2([[a, b], [c, d]])} = ${D}`, note: "The signed area." },
        { math: md`\text{area} = |${D}| = ${Math.abs(D)}`, note: D < 0 ? md`The sign only records that the turn from $\mathbf{u}$ to $\mathbf{v}$ is clockwise. Area is the absolute value.` : "The determinant is already positive." },
      ],
    };
  }
  let P: [number, number] = [0, 0];
  let Q: [number, number] = [0, 0];
  let R: [number, number] = [0, 0];
  let D = 0;
  do {
    P = [r.int(-3, 3), r.int(-3, 3)];
    Q = [r.int(-3, 5), r.int(-3, 5)];
    R = [r.int(-3, 5), r.int(-3, 5)];
    D = (Q[0] - P[0]) * (R[1] - P[1]) - (R[0] - P[0]) * (Q[1] - P[1]);
  } while (Math.abs(D) < 3 || (P[0] === 0 && P[1] === 0));
  const u: [number, number] = [Q[0] - P[0], Q[1] - P[1]];
  const v: [number, number] = [R[0] - P[0], R[1] - P[1]];
  const area = frac(Math.abs(D), 2);
  return {
    prompt: md`Find the area of the triangle with vertices $P(${P[0]}, ${P[1]})$, $Q(${Q[0]}, ${Q[1]})$ and $R(${R[0]}, ${R[1]})$. Give an exact value (a fraction if needed, like 15/2).`,
    figure: polygonFigure([
      { name: "P", x: P[0], y: P[1], label: `P(${P[0]}, ${P[1]})` },
      { name: "Q", x: Q[0], y: Q[1], label: `Q(${Q[0]}, ${Q[1]})` },
      { name: "R", x: R[0], y: R[1], label: `R(${R[0]}, ${R[1]})` },
    ]),
    answer: area,
    simplified: true,
    // Twice the area is the parallelogram's area, and Lagrange's identity gives its square.
    verify: [`(2A)^2 = (${paren(u[0])}^2 + ${paren(u[1])}^2)(${paren(v[0])}^2 + ${paren(v[1])}^2) - (${paren(u[0])} * ${paren(v[0])} + ${paren(u[1])} * ${paren(v[1])})^2`],
    hint: md`Move $P$ to the origin: the sides from $P$ are $\mathbf{u} = Q - P$ and $\mathbf{v} = R - P$. The triangle is half of the parallelogram they span.`,
    solution: [
      { math: md`\mathbf{u} = Q - P = ${vec(u[0], u[1])}, \quad \mathbf{v} = R - P = ${vec(v[0], v[1])}`, note: md`Subtract $P$ from the other two vertices. Sliding the triangle doesn't change its area.` },
      { math: md`${vmat([[u[0], v[0]], [u[1], v[1]]])} = ${expand2([[u[0], v[0]], [u[1], v[1]]])} = ${D}`, note: "The signed area of the parallelogram with those sides." },
      { math: md`\text{area} = \tfrac{1}{2}|${D}| = ${fracTex(Math.abs(D), 2)}`, note: "A triangle is half the parallelogram on the same two sides." },
    ],
  };
};

/** Lesson 1: read the sign of a determinant from a picture. */
const orientationChoice: Generator = (r) => {
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  const parallel = r.next() < 0.25;
  do {
    [a, c] = [r.int(-4, 4), r.int(-4, 4)];
    if (parallel) {
      const k = r.pick([-1, 2, -2]);
      [b, d] = [k * a, k * c];
    } else {
      [b, d] = [r.int(-4, 4), r.int(-4, 4)];
    }
  } while ((a === 0 && c === 0) || (b === 0 && d === 0) || Math.abs(b) > 4 || Math.abs(d) > 4 || (!parallel && a * d - b * c === 0));
  const D = a * d - b * c;
  const answer = D > 0 ? "positive" : D < 0 ? "negative" : "zero";
  const reading =
    D > 0 ? md`Turning from $\mathbf{u}$ to $\mathbf{v}$ (the short way) is counterclockwise, like turning from $\mathbf{e}_1$ to $\mathbf{e}_2$. Orientation is kept, so the determinant is positive.` : D < 0 ? md`Turning from $\mathbf{u}$ to $\mathbf{v}$ (the short way) is clockwise, the opposite of $\mathbf{e}_1$ to $\mathbf{e}_2$. The plane is flipped over, so the determinant is negative.` : md`$\mathbf{v}$ lies along the same line as $\mathbf{u}$. The parallelogram has no width, so its area is $0$.`;
  return {
    prompt: md`The figure shows $\mathbf{u} = ${vec(a, c)}$ and $\mathbf{v} = ${vec(b, d)}$. Is $\det \begin{bmatrix} \mathbf{u} & \mathbf{v} \end{bmatrix} = ${vmat([[a, b], [c, d]])}$ positive, negative or zero? Decide from the picture first, then confirm with the formula.`,
    figure: {
      kind: "diagram",
      view: [-5, 5, -5, 5],
      grid: true,
      points: [
        { name: "O", x: 0, y: 0, label: "" },
        { name: "U", x: a, y: c, label: "\\mathbf{u}", dir: c >= 0 ? "n" : "s" },
        { name: "V", x: b, y: d, label: "\\mathbf{v}", dir: d >= 0 ? "n" : "s" },
      ],
      segments: [
        { from: "O", to: "U", arrow: true, color: 1 },
        { from: "O", to: "V", arrow: true, color: 2 },
      ],
    },
    choices: ["positive", "negative", "zero"],
    accept: [answer],
    hint: md`Stand at the origin and look along $\mathbf{u}$. Is $\mathbf{v}$ on your left (counterclockwise, positive) or your right (clockwise, negative)? If it's straight ahead or behind, the vectors are parallel.`,
    solution: [
      { math: md`\det \begin{bmatrix} \mathbf{u} & \mathbf{v} \end{bmatrix} \text{ is ${answer}}`, note: reading },
      { math: md`${vmat([[a, b], [c, d]])} = ${expand2([[a, b], [c, d]])} = ${D}`, note: md`The formula agrees${D === 0 ? "" : `: the parallelogram has area $${Math.abs(D)}$ and the sign is ${answer}`}.` },
    ],
  };
};

/** Lesson 2: a 3 by 3 determinant by cofactor expansion. */
const detThreeByThree: Generator = (r) => {
  let m: M;
  do {
    m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => r.int(-3, 3)));
    if (r.next() < 0.6) m[r.int(0, 2)]![r.int(0, 2)] = 0;
  } while (m.flat().filter((v) => v === 0).length > 2 || m.some((row) => row.every((v) => v === 0)) || [0, 1, 2].some((j) => m.every((row) => row[j] === 0)));
  const i = bestRow(m);
  const zeros = m[i]!.filter((v) => v === 0).length;
  return {
    prompt: md`Find the determinant of $A = ${bmat(m)}$.`,
    answer: String(det3(m)),
    simplified: true,
    hint: zeros ? md`Row ${i + 1} has ${zeros === 1 ? "a zero" : "two zeros"}. Expand along it: fewer minors to compute. The signs for row ${i + 1} are $${i === 1 ? "-, +, -" : "+, -, +"}$.` : md`Expand along any row or column. For row 1 the signs are $+, -, +$: $a_{11} M_{11} - a_{12} M_{12} + a_{13} M_{13}$, each $M$ the 2 by 2 determinant left after crossing out that entry's row and column.`,
    solution: expansionSteps(m, i),
  };
};

/** Lesson 2: finish a cofactor expansion that has been set up. */
const finishExpansion: Generator = (r) => {
  let m: M;
  do {
    m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => r.int(-4, 4)));
  } while (m.flat().some((v) => v === 0) && r.next() < 0.7);
  const [[a, b, c], [d, e, f], [g, h, i]] = m as [[number, number, number], [number, number, number], [number, number, number]];
  const minors = [e * i - f * h, d * i - f * g, d * h - e * g];
  const expansion = `${a}(${times(e, i)} - ${times(f, h)}) - ${paren(b)}(${times(d, i)} - ${times(f, g)}) + ${paren(c)}(${times(d, h)} - ${times(e, g)})`;
  const D = a * minors[0]! - b * minors[1]! + c * minors[2]!;
  return {
    prompt: md`Compute $${expansion}$, the cofactor expansion of $\det ${bmat(m)}$ along its first row.`,
    answer: String(D),
    simplified: true,
    hint: "Work out the three brackets first: each is a 2 by 2 minor. Then multiply each by the entry in front of it, keep the signs + - + between the terms, and add.",
    solution: [
      { math: md`${vmat([[e, f], [h, i]])} = ${minors[0]}, \quad ${vmat([[d, f], [g, i]])} = ${minors[1]}, \quad ${vmat([[d, e], [g, h]])} = ${minors[2]}`, note: "The three minors: cross out row 1 and, in turn, columns 1, 2 and 3." },
      { math: md`${a}(${minors[0]}) - ${paren(b)}(${minors[1]}) + ${paren(c)}(${minors[2]})`, note: "Entry times minor, with the row-1 signs + - +." },
      { math: md`${a * minors[0]!} ${signed(-b * minors[1]!)} ${signed(c * minors[2]!)} = ${D}`, note: "Multiply and add." },
    ],
  };
};

/** Lesson 2: the product rule, transposes, inverses, scalars and row operations. */
const detProperties: Generator = (r) => {
  const p = r.coef(-6, 6);
  const q = r.coef(-5, 5);
  const kind = r.int(0, 7);
  const setup = md`$A$ and $B$ are $3 \times 3$ matrices with $\det A = ${p}$ and $\det B = ${q}$.`;
  const ask = (what: string, answer: string, hint: string, steps: Step[]) => ({
    prompt: md`${setup} Find $\det(${what})$.${answer.includes("/") ? " Give an exact fraction." : ""}`,
    answer,
    simplified: true,
    hint,
    solution: steps,
  });
  switch (kind) {
    case 0:
      return ask("AB", String(p * q), "The determinant of a product is the product of the determinants.", [
        { math: md`\det(AB) = \det A \cdot \det B`, note: md`$B$ scales volume by $${q}$, then $A$ scales it by $${p}$.` },
        { math: md`= ${paren(p)}${paren(q)} = ${p * q}`, note: "" },
      ]);
    case 1:
      return ask("A^T B", String(p * q), md`$\det A^T = \det A$, then use the product rule.`, [
        { math: md`\det(A^T B) = \det A^T \cdot \det B = \det A \cdot \det B`, note: "Transposing doesn't change a determinant." },
        { math: md`= ${paren(p)}${paren(q)} = ${p * q}`, note: "" },
      ]);
    case 2:
      return ask("A^{-1}", frac(1, p), md`$A A^{-1} = I$ and $\det I = 1$. Take determinants of both sides.`, [
        { math: md`\det A \cdot \det A^{-1} = \det(A A^{-1}) = \det I = 1`, note: "Product rule on the left." },
        { math: md`\det A^{-1} = \frac{1}{\det A} = ${fracTex(1, p)}`, note: md`Undoing $A$ undoes its volume scaling.` },
      ]);
    case 3: {
      const k = r.pick([2, 3, -1, -2]);
      return ask(`${k}A`, String(k ** 3 * p), md`$${k}A$ multiplies **every row** by $${k}$, and there are three rows.`, [
        { math: md`\det(${k}A) = ${k}^3 \det A`, note: md`Each of the three rows is scaled by $${k}$, and each scaling multiplies the determinant by $${k}$. (A $3 \times 3$ box scaled by $${k}$ in every direction has $${k}^3$ times the volume.)` },
        { math: md`= ${k ** 3} \cdot ${paren(p)} = ${k ** 3 * p}`, note: "" },
      ]);
    }
    case 4:
      return ask("A^2 B", String(p * p * q), "Product rule, three factors.", [
        { math: md`\det(A^2 B) = \det A \cdot \det A \cdot \det B`, note: "" },
        { math: md`= ${paren(p)}^2 \cdot ${paren(q)} = ${p * p * q}`, note: "" },
      ]);
    case 5:
      return ask("A B^{-1}", frac(p, q), md`$\det B^{-1} = 1 / \det B$, then the product rule. Give a reduced fraction.`, [
        { math: md`\det(A B^{-1}) = \det A \cdot \frac{1}{\det B}`, note: md`From $\det B \cdot \det B^{-1} = \det I = 1$.` },
        { math: md`= \frac{${p}}{${q}} = ${fracTex(p, q)}`, note: "" },
      ]);
    case 6: {
      const k = r.pick([2, 3, -2, 5]);
      return {
        prompt: md`$A$ is a $3 \times 3$ matrix with $\det A = ${p}$. Matrix $B$ is made from $A$ by swapping rows 1 and 3 and then multiplying row 2 by $${k}$. Find $\det B$.`,
        answer: String(-k * p),
        simplified: true,
        hint: "A row swap flips the sign. Scaling a row by k multiplies the determinant by k.",
        solution: [
          { math: md`\text{after the swap: } -\det A = ${-p}`, note: "Swapping two rows reverses orientation, so the sign changes." },
          { math: md`\text{after scaling row 2 by } ${k}: \; ${k}(${-p}) = ${-k * p}`, note: "Stretching one edge of the box by k multiplies the volume by k." },
        ],
      };
    }
    default: {
      const k = r.pick([2, 3, -4, 5]);
      return {
        prompt: md`$A$ is a $3 \times 3$ matrix with $\det A = ${p}$. Matrix $B$ is made from $A$ by adding $${k}$ times row 1 to row 3. Find $\det B$.`,
        answer: String(p),
        simplified: true,
        hint: "Adding a multiple of one row to another is a shear. What does a shear do to volume?",
        solution: [{ math: md`\det B = \det A = ${p}`, note: "Adding a multiple of one row to another row leaves the determinant unchanged: same base, same height." }],
      };
    }
  }
};

/** Lesson 3: Cramer's rule for a 2 by 2 system. */
const cramerTwo: Generator = (r) => {
  const fractional = r.int(0, 2) === 2;
  let m: M;
  let x = 0;
  let y = 0;
  let b: number[] = [];
  do {
    m = [
      [r.nonzero(-5, 5), r.nonzero(-5, 5)],
      [r.nonzero(-5, 5), r.nonzero(-5, 5)],
    ];
    if (fractional) {
      b = [r.nonzero(-7, 7), r.nonzero(-7, 7)];
    } else {
      [x, y] = [r.nonzero(-5, 5), r.nonzero(-5, 5)];
      b = [m[0]![0]! * x + m[0]![1]! * y, m[1]![0]! * x + m[1]![1]! * y];
    }
  } while (det2(m) === 0 || (fractional && (det2(replaceCol(m, 0, b)) % det2(m) === 0 || det2(replaceCol(m, 1, b)) % det2(m) === 0)));
  const D = det2(m);
  const Dx = det2(replaceCol(m, 0, b));
  const Dy = det2(replaceCol(m, 1, b));
  const eq = (i: number) => `${poly([[m[i]![0]!, "x"], [m[i]![1]!, "y"]])} = ${b[i]}`;
  return {
    prompt: md`Solve the system $${eq(0)}$, $${eq(1)}$ with Cramer's rule. Give the answer as (x, y)${fractional ? ", with exact fractions" : ""}.`,
    answer: `(${frac(Dx, D)}, ${frac(Dy, D)})`,
    form: "tuple",
    simplified: true,
    hint: md`$D$ is the determinant of the coefficient matrix. For $D_x$ replace the $x$-column by the right-hand sides; for $D_y$ replace the $y$-column. Then $x = D_x / D$ and $y = D_y / D$.`,
    solution: [
      { math: md`D = ${vmat(m)} = ${expand2(m)} = ${D}`, note: md`The coefficient determinant. It isn't zero, so there is exactly one solution.` },
      { math: md`D_x = ${vmat(replaceCol(m, 0, b))} = ${expand2(replaceCol(m, 0, b))} = ${Dx}`, note: md`Replace the $x$-column by the constants $${b[0]}$, $${b[1]}$.` },
      { math: md`D_y = ${vmat(replaceCol(m, 1, b))} = ${expand2(replaceCol(m, 1, b))} = ${Dy}`, note: md`Replace the $y$-column instead.` },
      { math: md`x = \frac{D_x}{D} = \frac{${Dx}}{${D}} = ${fracTex(Dx, D)}, \qquad y = \frac{D_y}{D} = \frac{${Dy}}{${D}} = ${fracTex(Dy, D)}`, note: fractional ? "Reduce each fraction." : md`Check in the first equation: $${m[0]![0]}(${x}) ${signed(m[0]![1]! * y)} = ${b[0]}$. ✓` },
    ],
  };
};

/** Lesson 3: Cramer's rule for a 3 by 3 system. */
const cramerThree: Generator = (r) => {
  let m: M;
  let sol: number[];
  let b: number[];
  do {
    m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => r.int(-3, 3)));
    if (r.next() < 0.5) m[r.int(0, 2)]![r.int(0, 2)] = 0;
    sol = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
    b = m.map((row) => row[0]! * sol[0]! + row[1]! * sol[1]! + row[2]! * sol[2]!);
  } while (
    det3(m) === 0 ||
    Math.abs(det3(m)) > 24 ||
    m.flat().filter((v) => v === 0).length > 2 ||
    m.some((row) => row.filter((v) => v !== 0).length < 2) ||
    [0, 1, 2].some((j) => m.every((row) => row[j] === 0)) ||
    sol.filter((v) => v !== 0).length < 2
  );
  const D = det3(m);
  const cols = ["x", "y", "z"];
  const Ds = [0, 1, 2].map((j) => det3(replaceCol(m, j, b)));
  const eq = (i: number) => `${poly([[m[i]![0]!, "x"], [m[i]![1]!, "y"], [m[i]![2]!, "z"]])} = ${b[i]}`;
  const row = bestRow(m);
  return {
    prompt: md`Solve the system $${eq(0)}$, $${eq(1)}$, $${eq(2)}$ with Cramer's rule. Give the answer as (x, y, z).`,
    answer: `(${sol.join(", ")})`,
    form: "tuple",
    simplified: true,
    hint: md`Four 3 by 3 determinants: $D$ from the coefficients, then $D_x$, $D_y$, $D_z$ by replacing one column at a time with the constants $${b.join(", ")}$. Each unknown is its determinant over $D$.`,
    solution: [
      { math: md`D = ${vmat(m)} = ${D}`, note: md`Expand along row ${row + 1}: $${expansionSteps(m, row)[1]!.math.replace(/^= /, "")}$.` },
      ...[0, 1, 2].map((j) => ({
        math: md`D_${cols[j]} = ${vmat(replaceCol(m, j, b))} = ${Ds[j]}`,
        note: md`Replace the $${cols[j]}$-column by the constants and expand.`,
      })),
      { math: md`x = \frac{${Ds[0]}}{${D}} = ${sol[0]}, \quad y = \frac{${Ds[1]}}{${D}} = ${sol[1]}, \quad z = \frac{${Ds[2]}}{${D}} = ${sol[2]}`, note: md`Check in the first equation: $${eq(0).replace(/[xyz]/g, (v) => `(${sol[cols.indexOf(v)]})`)}$. ✓` },
    ],
  };
};

/** Lesson 3: the value of a parameter that makes the system singular. */
const singularParameter: Generator = (r) => {
  if (r.int(0, 2) < 2) {
    // 2 by 2 with k in one entry.
    let m: M;
    let pos: [number, number];
    do {
      m = [
        [r.nonzero(-5, 5), r.nonzero(-5, 5)],
        [r.nonzero(-5, 5), r.nonzero(-5, 5)],
      ];
      pos = [r.int(0, 1), r.int(0, 1)];
    } while (m[1 - pos[0]]![1 - pos[1]] === 0);
    const [i, j] = pos;
    const b = [r.nonzero(-6, 6), r.nonzero(-6, 6)];
    const entry = (ri: number, ci: number) => (ri === i && ci === j ? "k" : String(m[ri]![ci]));
    const show: string[][] = [
      [entry(0, 0), entry(0, 1)],
      [entry(1, 0), entry(1, 1)],
    ];
    // det = (k)(opposite) - (other diagonal) when k is on the main diagonal, else other diagonal - k(opposite).
    const opposite = m[1 - i]![1 - j]!;
    const other = m[1 - i]![j]! * m[i]![1 - j]!;
    const onDiagonal = i === j;
    const k = onDiagonal ? frac(other, opposite) : frac(m[i]![i]! * m[1 - i]![1 - i]!, opposite);
    const kTex = onDiagonal ? fracTex(other, opposite) : fracTex(m[i]![i]! * m[1 - i]![1 - i]!, opposite);
    const term = (ri: number, ci: number) => (ri === i && ci === j ? `${paren(m[1 - ri]![1 - ci]!)}k` : ri === 1 - i && ci === 1 - j ? `${paren(m[ri]![ci]!)}k` : times(m[ri]![ci]!, m[1 - ri]![1 - ci]!));
    const yTerm = (c: number) => (c === 1 ? "+ y" : c === -1 ? "- y" : `${signed(c)}y`);
    const eqText = (ri: number) => `${show[ri]![0] === "k" ? "kx" : poly([[m[ri]![0]!, "x"]])} ${show[ri]![1] === "k" ? "+ ky" : yTerm(m[ri]![1]!)} = ${b[ri]}`;
    const verify = `${entry(0, 0)}*(${entry(1, 1)}) - (${entry(0, 1)})*(${entry(1, 0)}) = 0`;
    return {
      prompt: md`The system $${eqText(0)}$, $${eqText(1)}$ has no unique solution for exactly one value of $k$. Find it. Give an exact fraction if needed.`,
      answer: k,
      simplified: true,
      verify: [verify],
      hint: md`A square system has a unique solution exactly when the coefficient determinant isn't zero. Set $\begin{vmatrix} ${show[0]![0]} & ${show[0]![1]} \\ ${show[1]![0]} & ${show[1]![1]} \end{vmatrix} = 0$ and solve for $k$.`,
      solution: [
        { math: md`\begin{vmatrix} ${show[0]![0]} & ${show[0]![1]} \\ ${show[1]![0]} & ${show[1]![1]} \end{vmatrix} = ${term(0, 0)} - ${term(0, 1)}`, note: md`Cramer's rule divides by this determinant. It fails, and the solution stops being unique, exactly when the determinant is $0$.` },
        { math: md`${term(0, 0)} - ${term(0, 1)} = 0`, note: "Set it to zero." },
        { math: md`k = ${kTex}`, note: md`At this $k$ the two equations have parallel left-hand sides, so they describe parallel or identical lines: no solution or infinitely many.` },
      ],
    };
  }
  // 3 by 3 with k in one entry; the determinant is linear in k.
  let m: M;
  let i = 0;
  let j = 0;
  let alpha = 0;
  let beta = 0;
  do {
    m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => r.int(-3, 3)));
    [i, j] = [r.int(0, 2), r.int(0, 2)];
    m[i]![j] = 0;
    alpha = ((i + j) % 2 === 0 ? 1 : -1) * det2(minor(m, i, j));
    beta = det3(m);
  } while (alpha === 0 || beta === 0 || m.flat().filter((v) => v === 0).length > 2);
  const k = frac(-beta, alpha);
  const entry = (ri: number, ci: number) => (ri === i && ci === j ? "k" : paren(m[ri]![ci]!));
  const shown = m.map((row, ri) => row.map((v, ci) => (ri === i && ci === j ? "k" : String(v))).join(" & ")).join(" \\\\ ");
  const sign = (c: number) => ((i + c) % 2 === 0 ? 1 : -1);
  const terms = [0, 1, 2].map((c) => {
    const s = sign(c);
    const e = c === j ? "k" : String(m[i]![c]);
    return { e, s, M: det2(minor(m, i, c)), tex: vmat(minor(m, i, c)) };
  });
  const line = terms.map((t, idx) => `${idx === 0 ? (t.s < 0 ? "-" : "") : t.s < 0 ? " - " : " + "}${t.e === "k" ? "k" : paren(Number(t.e))} \\cdot ${t.tex}`).join("");
  const line2 = terms.map((t, idx) => `${idx === 0 ? (t.s < 0 ? "-" : "") : t.s < 0 ? " - " : " + "}${t.e === "k" ? "k" : paren(Number(t.e))}(${t.M})`).join("");
  const verify = `${entry(0, 0)}*(${entry(1, 1)}*${entry(2, 2)} - ${entry(1, 2)}*${entry(2, 1)}) - ${entry(0, 1)}*(${entry(1, 0)}*${entry(2, 2)} - ${entry(1, 2)}*${entry(2, 0)}) + ${entry(0, 2)}*(${entry(1, 0)}*${entry(2, 1)} - ${entry(1, 1)}*${entry(2, 0)}) = 0`;
  return {
    prompt: md`For which value of $k$ is $A = \begin{bmatrix} ${shown} \end{bmatrix}$ singular, so that $A\mathbf{x} = \mathbf{b}$ has no unique solution? Give an exact fraction if needed.`,
    answer: k,
    simplified: true,
    verify: [verify],
    hint: md`Singular means $\det A = 0$. Expand along row ${i + 1}, the row that holds $k$; the determinant comes out as a linear expression in $k$.`,
    solution: [
      { math: md`\det A = ${line}`, note: md`Cofactor expansion along row ${i + 1}, signs $${i === 1 ? "-, +, -" : "+, -, +"}$.` },
      { math: md`= ${line2} = ${poly([[alpha, "k"], [beta, ""]])}`, note: md`Work out the three minors. Only one term contains $k$, so the determinant is linear in $k$.` },
      { math: md`${poly([[alpha, "k"], [beta, ""]])} = 0 \quad\Rightarrow\quad k = ${fracTex(-beta, alpha)}`, note: md`For every other $k$ the determinant is nonzero and Cramer's rule gives the one solution.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit4: Unit = {
  title: "Determinants",
  lessons: [
    {
      id: slug("Determinants as signed volume"),
      title: "Determinants as signed volume",
      summary: "The number that says how much a matrix scales area, where the 2 by 2 formula comes from, and the three rules it obeys.",
      blocks: [
        {
          kind: "text",
          body: md`A $2 \times 2$ matrix $A$ moves the plane (Unit 3). It sends $\mathbf{e}_1$ to the first column $\mathbf{u}$ and $\mathbf{e}_2$ to the second column $\mathbf{v}$, so the unit square, with corners $\mathbf{0}$, $\mathbf{e}_1$, $\mathbf{e}_1 + \mathbf{e}_2$ and $\mathbf{e}_2$, lands on the parallelogram with sides $\mathbf{u}$ and $\mathbf{v}$. Every other grid square lands on a copy of that same parallelogram, because $A$ is linear.

So one number tells you how much $A$ scales every area: the area of that parallelogram. Give it a sign that records whether $A$ flips the plane over, and you have the **determinant**.`,
        },
        {
          kind: "diagram",
          view: [-4, 7, -4, 7],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "O", dir: "sw" },
            { name: "E1", x: 1, y: 0, label: "", hidden: true },
            { name: "E2", x: 0, y: 1, label: "", hidden: true },
            { name: "E3", x: 1, y: 1, label: "", hidden: true },
            { name: "U", x: "a", y: "c", label: "\\mathbf{u} = ({a}, {c})", dir: "e" },
            { name: "V", x: "b", y: "d", label: "\\mathbf{v} = ({b}, {d})", dir: "n" },
            { name: "W", x: "a + b", y: "c + d", label: "\\mathbf{u} + \\mathbf{v}", dir: "ne" },
          ],
          polygons: [
            { points: ["O", "E1", "E3", "E2"], dashed: true },
            { points: ["O", "U", "W", "V"], fill: 1 },
          ],
          segments: [
            { from: "O", to: "U", arrow: true, color: 1 },
            { from: "O", to: "V", arrow: true, color: 2 },
          ],
          params: [
            { name: "a", min: -3, max: 4, step: 1, value: 3 },
            { name: "b", min: -3, max: 4, step: 1, value: 1 },
            { name: "c", min: -3, max: 4, step: 1, value: 1 },
            { name: "d", min: -3, max: 4, step: 1, value: 2 },
          ],
          readouts: [
            { label: "ad - bc", value: "a d - b c" },
            { label: "\\text{area}", value: "abs(a d - b c)" },
          ],
          caption: md`The dashed unit square and its image under $A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$. Slide the entries. The readout $ad - bc$ always matches the area, up to sign. Try to make it negative: what has to happen to the order of $\mathbf{u}$ and $\mathbf{v}$? Try to make it zero.`,
        },
        {
          kind: "why",
          title: "Why the area is ad − bc",
          body: md`Take $\mathbf{u} = (a, c)$ and $\mathbf{v} = (b, d)$ with all four numbers positive and $\mathbf{u}$ the lower of the two (so $\frac{c}{a} < \frac{d}{b}$, which is $bc < ad$). Box the parallelogram in the rectangle with corners $(0, 0)$ and $(a + b, c + d)$. Its area is $(a + b)(c + d)$.

Inside the box but outside the parallelogram are six pieces: two right triangles with legs $a$ and $c$ (together one $a \times c$ rectangle, area $ac$), two with legs $b$ and $d$ (together $bd$), and two small $b \times c$ rectangles in the corners ($2bc$). Subtract them:

$$(a + b)(c + d) - ac - bd - 2bc = ac + ad + bc + bd - ac - bd - 2bc = ad - bc.$$

Other sign patterns of $a, b, c, d$ rearrange the picture but give the same formula. The trigonometric argument below handles every case at once, and explains the sign.`,
        },
        {
          kind: "key",
          title: "The 2 by 2 determinant",
          body: md`$$\det \begin{bmatrix} a & b \\ c & d \end{bmatrix} = \begin{vmatrix} a & b \\ c & d \end{vmatrix} = ad - bc.$$

It is the **signed area** of the parallelogram with sides $\mathbf{u} = (a, c)$ and $\mathbf{v} = (b, d)$, the columns of the matrix: down-right diagonal product minus up-right diagonal product. $|\det A|$ is the area, and the factor by which $A$ multiplies every area in the plane. The vertical bars are the usual notation; they don't mean absolute value.`,
        },
        {
          kind: "why",
          title: "Why the sign tells you the turn",
          body: md`Write the columns in polar form: $\mathbf{u} = |\mathbf{u}|(\cos\alpha, \sin\alpha)$ and $\mathbf{v} = |\mathbf{v}|(\cos\beta, \sin\beta)$. Then

$$ad - bc = |\mathbf{u}||\mathbf{v}|(\cos\alpha\sin\beta - \sin\alpha\cos\beta) = |\mathbf{u}||\mathbf{v}|\sin(\beta - \alpha),$$

by the sine difference formula. The angle $\theta = \beta - \alpha$ is the turn **from** $\mathbf{u}$ **to** $\mathbf{v}$, measured counterclockwise. So $\det = |\mathbf{u}||\mathbf{v}|\sin\theta$.

- $|\mathbf{v}|\sin\theta$ is the height of the parallelogram above the base $\mathbf{u}$, so $|\det|$ is base times height: the area, in every case.
- $\sin\theta > 0$ when the turn is counterclockwise (less than a half turn), like $\mathbf{e}_1$ to $\mathbf{e}_2$: $A$ keeps orientation.
- $\sin\theta < 0$ when the turn is clockwise: $A$ flips the plane over, like a reflection.
- $\sin\theta = 0$ when $\mathbf{u}$ and $\mathbf{v}$ are parallel: the parallelogram is flat.`,
        },
        {
          kind: "diagram",
          view: [-4, 4, -3, 4],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", hidden: true },
            { name: "U", x: 3, y: 1, label: "\\mathbf{u}", dir: "e" },
            { name: "V", x: "2.5cos(t pi/180)", y: "2.5sin(t pi/180)", label: "\\mathbf{v}", dir: "n" },
            { name: "W", x: "3 + 2.5cos(t pi/180)", y: "1 + 2.5sin(t pi/180)", label: "", hidden: true },
          ],
          polygons: [{ points: ["O", "U", "W", "V"], fill: 1 }],
          segments: [
            { from: "O", to: "U", arrow: true, color: 1 },
            { from: "O", to: "V", arrow: true, color: 2 },
          ],
          angles: [{ at: "O", from: "U", to: "V", label: "\\theta" }],
          params: [{ name: "t", label: "direction of v", tex: md`\text{direction of } \mathbf{v}`, min: -60, max: 200, step: 2, value: 80 }],
          readouts: [
            { label: "ad - bc", value: "3 * 2.5 sin(t pi/180) - 2.5 cos(t pi/180) * 1" },
            { label: "|\\mathbf{u}||\\mathbf{v}|\\sin\\theta", value: "sqrt(10) * 2.5 * sin((t - atan(1/3) * 180/pi) pi/180)" },
          ],
          caption: md`$\mathbf{u} = (3, 1)$ is fixed and $\mathbf{v}$ has length $2.5$. Turn $\mathbf{v}$. The two readouts agree always. The determinant is largest when $\theta$ is a right angle, drops to $0$ as $\mathbf{v}$ lines up with $\mathbf{u}$ (near $18^\circ$ and near $198^\circ$), and is negative whenever $\mathbf{v}$ sits clockwise of $\mathbf{u}$: below about $18^\circ$ or above about $198^\circ$.`,
        },
        {
          kind: "key",
          title: "Sign, zero, singular",
          body: md`- $\det A > 0$: $A$ preserves orientation (counterclockwise stays counterclockwise).
- $\det A < 0$: $A$ reverses orientation, like a mirror.
- $\det A = 0$: the columns are parallel (one is a multiple of the other), the image of the unit square has no area, and $A$ squashes the whole plane onto a line. Such an $A$ is **singular**: it has no inverse, because no map can un-squash a line back into a plane. This is why the $2 \times 2$ inverse formula from Unit 3 divides by $ad - bc$.

Swapping the two columns swaps $b$ with $a$ and $d$ with $c$, turning $ad - bc$ into $bc - ad$. The area is the same; the sign flips, because the turn from the first column to the second now goes the other way.`,
        },
        {
          kind: "example",
          title: "A determinant and what it says",
          problem: md`Find $\det A$ for $A = \begin{bmatrix} 2 & -1 \\ 3 & 4 \end{bmatrix}$, and describe what $A$ does to areas.`,
          steps: [
            { math: md`\det A = (2)(4) - (-1)(3)`, note: md`$ad - bc$ with $a = 2$, $b = -1$, $c = 3$, $d = 4$. Keep the negative in parentheses.` },
            { math: md`= 8 + 3 = 11`, note: "Subtracting a negative adds." },
            { math: md`\text{area} \times 11, \text{ orientation kept}`, note: md`The unit square becomes a parallelogram of area $11$ with sides $(2, 3)$ and $(-1, 4)$, and since $11 > 0$ the turn from $(2, 3)$ to $(-1, 4)$ is counterclockwise. Every region's area is multiplied by $11$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\det \begin{bmatrix} 3 & 4 \\ 1 & 2 \end{bmatrix}$.`,
          answer: "2",
          simplified: true,
          explain: md`$3 \cdot 2 - 4 \cdot 1 = 6 - 4 = 2$. The parallelogram with sides $(3, 1)$ and $(4, 2)$ has area $2$, and the turn from $(3, 1)$ to $(4, 2)$ is counterclockwise.`,
        },
        {
          kind: "text",
          body: md`The formula is useful, but the picture is what carries over to bigger matrices. Three facts about area are obvious from the picture, and they are all a determinant ever needs.

**Identity.** The unit square has area $1$, so $\det I = 1$.

**Scaling a side.** Doubling $\mathbf{u}$ doubles the parallelogram's area: $\det\begin{bmatrix} k\mathbf{u} & \mathbf{v} \end{bmatrix} = k \det\begin{bmatrix} \mathbf{u} & \mathbf{v} \end{bmatrix}$. (A negative $k$ reverses $\mathbf{u}$ and so reverses the turn; the sign takes care of itself.) Likewise, if $\mathbf{u}$ is a sum, the area splits: $\det\begin{bmatrix} \mathbf{u} + \mathbf{u}' & \mathbf{v} \end{bmatrix} = \det\begin{bmatrix} \mathbf{u} & \mathbf{v} \end{bmatrix} + \det\begin{bmatrix} \mathbf{u}' & \mathbf{v} \end{bmatrix}$. Together: the determinant is **linear in each column** separately.

**Shearing.** Adding a multiple of one side to the other side doesn't change the area at all. Slide $k$ below to see it.`,
        },
        {
          kind: "diagram",
          view: [-3, 9, -2, 5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "O", dir: "sw" },
            { name: "U", x: 3, y: 1, label: "\\mathbf{u}", dir: "se" },
            { name: "V0", x: 1, y: 2, label: "", hidden: true },
            { name: "V", x: "1 + 3k", y: "2 + k", label: "\\mathbf{v} + k\\mathbf{u}", dir: "n" },
            { name: "W", x: "4 + 3k", y: "3 + k", label: "", hidden: true },
            { name: "L1", x: -5, y: 0, label: "", hidden: true },
            { name: "L2", x: 10, y: 5, label: "", hidden: true },
          ],
          polygons: [{ points: ["O", "U", "W", "V"], fill: 1 }],
          segments: [
            { from: "L1", to: "L2", dashed: true },
            { from: "O", to: "U", arrow: true, color: 1 },
            { from: "O", to: "V", arrow: true, color: 2 },
            { from: "O", to: "V0", arrow: true, color: 2, dashed: true, label: "\\mathbf{v}" },
          ],
          params: [{ name: "k", min: -1, max: 2, step: 0.25, value: 0 }],
          readouts: [{ label: "\\det", value: "3(2 + k) - (1 + 3k)(1)" }],
          caption: md`$\mathbf{u} = (3, 1)$ and $\mathbf{v} = (1, 2)$. Replacing $\mathbf{v}$ by $\mathbf{v} + k\mathbf{u}$ slides its tip along the dashed line, which is parallel to $\mathbf{u}$. The parallelogram leans but keeps its base and its height, and the determinant stays at $5$.`,
        },
        {
          kind: "why",
          title: "Why a shear keeps the area",
          body: md`The area of a parallelogram is base times height. Take $\mathbf{u}$ as the base. The height is the distance from the tip of $\mathbf{v}$ to the line through $\mathbf{u}$. Moving the tip by $k\mathbf{u}$ moves it *along* a line parallel to that base line, so its distance to the base doesn't change. Same base, same height, same area. And the turn from $\mathbf{u}$ to $\mathbf{v} + k\mathbf{u}$ stays on the same side, so the sign doesn't change either.

Algebra confirms it: $a(d + kc) - (b + ka)c = ad + kac - bc - kac = ad - bc$.`,
        },
        {
          kind: "key",
          title: "The three rules of signed area",
          body: md`For columns $\mathbf{u}, \mathbf{v}$ (and, in $n$ dimensions, any number of columns):

1. $\det I = 1$.
2. $\det$ is linear in each column: scaling one column by $k$ scales the determinant by $k$, and a column that is a sum splits the determinant into a sum.
3. Swapping two columns changes the sign.

Two consequences come for free. A matrix with two equal columns has determinant $0$ (swapping them changes nothing but must flip the sign, and only $0$ equals its own negative). And adding a multiple of one column to another leaves the determinant alone: by rule 2 the new determinant is the old one plus $k$ times a determinant with a repeated column, which is $k \cdot 0$.`,
        },
        {
          kind: "why",
          title: "Why the three rules are all you need",
          body: md`Suppose you knew nothing about the formula, only rules 1 to 3. Write the columns in terms of $\mathbf{e}_1, \mathbf{e}_2$: $\mathbf{u} = a\mathbf{e}_1 + c\mathbf{e}_2$ and $\mathbf{v} = b\mathbf{e}_1 + d\mathbf{e}_2$. Linearity in the first column, then in the second, splits $\det\begin{bmatrix} \mathbf{u} & \mathbf{v} \end{bmatrix}$ into four pieces:

$$ab\det\begin{bmatrix} \mathbf{e}_1 & \mathbf{e}_1 \end{bmatrix} + ad\det\begin{bmatrix} \mathbf{e}_1 & \mathbf{e}_2 \end{bmatrix} + cb\det\begin{bmatrix} \mathbf{e}_2 & \mathbf{e}_1 \end{bmatrix} + cd\det\begin{bmatrix} \mathbf{e}_2 & \mathbf{e}_2 \end{bmatrix}.$$

The first and last have a repeated column: $0$. The second is $\det I = 1$. The third is $I$ with its columns swapped: $-1$. Total: $ad - bc$. The rules force the formula. That is why they, and not the formula, are the definition that scales up: for a $3 \times 3$ matrix the same rules describe the signed **volume** of the box (parallelepiped) with edges along the three columns, and the next lesson turns them into a way of computing it.`,
        },
        {
          kind: "text",
          body: md`One more observation before moving on. Swapping $b$ and $c$ in $ad - bc$ changes nothing, so a $2 \times 2$ matrix and its transpose have the same determinant. The rows of $A$ span a parallelogram of the same area as its columns. This is true for every square matrix, $\det A^T = \det A$; we'll state it and check it in the next lesson. It means every column rule above is also a row rule.`,
        },
        {
          kind: "check",
          prompt: md`Find the area of the parallelogram with sides $\mathbf{u} = \langle 4, 1 \rangle$ and $\mathbf{v} = \langle 2, 3 \rangle$.`,
          answer: "10",
          simplified: true,
          explain: md`$\begin{vmatrix} 4 & 2 \\ 1 & 3 \end{vmatrix} = 4 \cdot 3 - 2 \cdot 1 = 10$. It's positive, so the turn from $\mathbf{u}$ to $\mathbf{v}$ is counterclockwise, and the area is $10$.`,
        },
      ],
      practice: [detTwoByTwo, parallelogramArea, orientationChoice],
    },
    {
      id: slug("Computing determinants"),
      title: "Computing determinants",
      summary: "Row operations, triangular matrices, cofactor expansion, the product rule, and why a zero determinant means singular.",
      blocks: [
        {
          kind: "text",
          body: md`The three rules of the last lesson say what a determinant *is*. This lesson turns them into two ways to *compute* one: elimination, which you already know, and cofactor expansion, a formula built from smaller determinants.

Because $\det A^T = \det A$, every rule about columns is also a rule about rows, and rows are what elimination works with. So from here on, think rows.`,
        },
        {
          kind: "key",
          title: "Row operations and the determinant",
          body: md`- **Swap** two rows: the determinant changes sign.
- **Scale** a row by $k$: the determinant is multiplied by $k$.
- **Add** a multiple of one row to another row: the determinant doesn't change.

So if elimination takes $A$ to $B$ using $s$ swaps and row scalings by $k_1, k_2, \ldots$, then $\det B = (-1)^s k_1 k_2 \cdots \det A$, and $\det A$ can be read off from $\det B$.`,
        },
        {
          kind: "why",
          title: "Why a zero row, or a repeated row, means zero",
          body: md`Say row 2 of $A$ is all zeros. Multiply that row by $2$: the matrix is unchanged, since $2 \cdot 0 = 0$. But scaling a row by $2$ doubles the determinant. So $\det A = 2\det A$, and the only number equal to its own double is $0$.

Now say two rows are equal. Swap them: the matrix is unchanged, but the determinant changes sign. So $\det A = -\det A$, and again $\det A = 0$. Geometrically, two equal edges span a flat box with no volume.`,
        },
        {
          kind: "diagram",
          view: [-1, 8, -1, 4],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "O", dir: "sw" },
            { name: "P", x: 3, y: 0, label: "(a, 0)", dir: "s" },
            { name: "Q", x: "b", y: 2, label: "(b, d)", dir: "n" },
            { name: "W", x: "3 + b", y: 2, label: "", hidden: true },
          ],
          polygons: [{ points: ["O", "P", "W", "Q"], fill: 1 }],
          segments: [
            { from: "O", to: "P", arrow: true, color: 1 },
            { from: "O", to: "Q", arrow: true, color: 2 },
          ],
          params: [{ name: "b", min: -1, max: 4, step: 0.5, value: 1 }],
          readouts: [{ label: "\\text{area} = ad", value: "3 * 2" }],
          caption: md`The columns of the triangular matrix $\begin{bmatrix} a & b \\ 0 & d \end{bmatrix}$, here with $a = 3$ and $d = 2$. The base lies along the $x$-axis and the height is $d$ no matter what $b$ is: the area is $ad$, the product of the diagonal. The off-diagonal entry only leans the shape.`,
        },
        {
          kind: "proof",
          title: "The determinant of a triangular matrix is the product of its diagonal",
          given: md`$A$ is an $n \times n$ upper triangular matrix (every entry below the diagonal is $0$) with diagonal entries $a_{11}, a_{22}, \ldots, a_{nn}$`,
          prove: md`$\det A = a_{11} a_{22} \cdots a_{nn}$`,
          steps: [
            { statement: md`Case 1: some diagonal entry is $0$. Let $a_{ii}$ be the **last** zero on the diagonal.`, reason: "Case split" },
            { statement: md`Rows $i + 1, \ldots, n$ have nonzero pivots $a_{i+1,i+1}, \ldots, a_{nn}$ in columns $i + 1, \ldots, n$, and zeros to the left of them.`, reason: md`$A$ is upper triangular, and $a_{ii}$ was the last zero` },
            { statement: md`Adding suitable multiples of rows $i + 1, \ldots, n$ to row $i$ clears every entry of row $i$ in columns $i + 1, \ldots, n$, leaving row $i$ all zeros.`, reason: md`Row $i$ is $0$ in columns $1, \ldots, i$ already (upper triangular, $a_{ii} = 0$). Work left to right: each pivot row is $0$ to the left of its pivot, so columns already cleared stay clear` },
            { statement: md`$\det A = 0 = a_{11} \cdots a_{nn}$.`, reason: "Row additions don't change the determinant, and a zero row gives determinant 0; the product contains the factor 0" },
            { statement: md`Case 2: every diagonal entry is nonzero. Scale row $i$ by $\frac{1}{a_{ii}}$ for each $i$.`, reason: "Case split; row scaling" },
            { statement: md`The result $B$ has $1$s on the diagonal, and $\det B = \frac{1}{a_{11} a_{22} \cdots a_{nn}} \det A$.`, reason: md`Each scaling multiplies the determinant by $\frac{1}{a_{ii}}$` },
            { statement: md`Working from the bottom row up, add multiples of each row to the rows above it to clear everything above the diagonal. The result is $I$.`, reason: md`Row $n$ is $\mathbf{e}_n^T$, so it clears column $n$ without disturbing other columns; then row $n - 1$ clears column $n - 1$, and so on` },
            { statement: md`$\det B = \det I = 1$.`, reason: "Row additions don't change the determinant; rule 1" },
            { statement: md`$\det A = a_{11} a_{22} \cdots a_{nn}$.`, reason: md`Multiply step 6 by $a_{11} \cdots a_{nn}$` },
          ],
        },
        {
          kind: "text",
          body: md`The same holds for lower triangular matrices (transpose, or run the argument with rows going the other way), and for diagonal matrices. Together with the row rules this gives the first method: **eliminate to triangular form, keeping track of the swaps and scalings, then multiply the diagonal.**`,
        },
        {
          kind: "example",
          title: "A determinant by elimination",
          problem: md`Find $\det A$ for $A = \begin{bmatrix} 2 & 1 & 3 \\ 4 & 1 & 7 \\ -2 & 3 & 1 \end{bmatrix}$.`,
          steps: [
            { math: md`\begin{vmatrix} 2 & 1 & 3 \\ 0 & -1 & 1 \\ 0 & 4 & 4 \end{vmatrix}`, note: md`$R_2 - 2R_1$ and $R_3 + R_1$. Row additions: the determinant is unchanged.` },
            { math: md`\begin{vmatrix} 2 & 1 & 3 \\ 0 & -1 & 1 \\ 0 & 0 & 8 \end{vmatrix}`, note: md`$R_3 + 4R_2$. Unchanged again, and now triangular.` },
            { math: md`\det A = 2 \cdot (-1) \cdot 8 = -16`, note: "The product of the diagonal. No swaps or scalings were used, so this is the determinant of the original matrix." },
          ],
        },
        {
          kind: "why",
          title: "Where cofactor expansion comes from",
          body: md`Take $A = \begin{bmatrix} a & b & c \\ d & e & f \\ g & h & i \end{bmatrix}$ and write its first row as $a\mathbf{e}_1^T + b\mathbf{e}_2^T + c\mathbf{e}_3^T$. Linearity in that row splits $\det A$ into three determinants, each with a single $1$ in the first row:

$$\det A = a\begin{vmatrix} 1 & 0 & 0 \\ d & e & f \\ g & h & i \end{vmatrix} + b\begin{vmatrix} 0 & 1 & 0 \\ d & e & f \\ g & h & i \end{vmatrix} + c\begin{vmatrix} 0 & 0 & 1 \\ d & e & f \\ g & h & i \end{vmatrix}.$$

In the first, subtract $d$ times row 1 from row 2 and $g$ times row 1 from row 3 (no change): the first column becomes $\mathbf{e}_1$ and the matrix is $\begin{bmatrix} 1 & 0 & 0 \\ 0 & e & f \\ 0 & h & i \end{bmatrix}$. Its columns are $\mathbf{e}_1$ and two vectors lying in the plane $x = 0$. The box they span has a base of area $\begin{vmatrix} e & f \\ h & i \end{vmatrix}$ in that plane and height $1$ perpendicular to it, so its signed volume is $ei - fh$, the determinant of what's left when you cross out the row and column of the $1$.

In the second, swap columns 1 and 2 to bring the $1$ to the corner: one swap, so a factor $-1$, and crossing out gives $\begin{vmatrix} d & f \\ g & i \end{vmatrix}$. In the third, moving column 3 to the front takes two swaps: factor $+1$, minor $\begin{vmatrix} d & e \\ g & h \end{vmatrix}$. Altogether:

$$\det A = a\begin{vmatrix} e & f \\ h & i \end{vmatrix} - b\begin{vmatrix} d & f \\ g & i \end{vmatrix} + c\begin{vmatrix} d & e \\ g & h \end{vmatrix}.$$

Nothing here used that it was the first row; splitting any row, or any column, works the same way. The sign of each term is $(-1)^{\text{row} + \text{column}}$, the number of swaps needed to bring the entry to the top-left corner.`,
        },
        {
          kind: "key",
          title: "Cofactor expansion",
          body: md`For an $n \times n$ matrix $A$, the **minor** $M_{ij}$ is the determinant of the $(n - 1) \times (n - 1)$ matrix left after deleting row $i$ and column $j$. The **cofactor** is the signed minor $C_{ij} = (-1)^{i + j} M_{ij}$; the signs form a checkerboard starting with $+$ in the corner:

$$\begin{bmatrix} + & - & + \\ - & + & - \\ + & - & + \end{bmatrix}.$$

Expanding along any row $i$ or any column $j$:

$$\det A = \sum_{j} a_{ij} C_{ij} = \sum_{i} a_{ij} C_{ij}.$$

Every choice gives the same number. Pick the row or column with the most zeros: each zero kills a term. A $3 \times 3$ determinant costs three $2 \times 2$ ones; a $4 \times 4$ costs four $3 \times 3$ ones. For anything bigger, eliminate instead.`,
        },
        {
          kind: "example",
          title: "Two expansions, one answer",
          problem: md`Find $\det A$ for $A = \begin{bmatrix} 1 & 0 & 2 \\ 3 & 4 & 0 \\ 5 & 6 & 7 \end{bmatrix}$, along row 1 and again along column 2.`,
          steps: [
            { math: md`\det A = 1\begin{vmatrix} 4 & 0 \\ 6 & 7 \end{vmatrix} - 0\begin{vmatrix} 3 & 0 \\ 5 & 7 \end{vmatrix} + 2\begin{vmatrix} 3 & 4 \\ 5 & 6 \end{vmatrix}`, note: md`Along row 1, signs $+, -, +$. The middle term is $0$.` },
            { math: md`= 1(28 - 0) + 2(18 - 20) = 28 - 4 = 24`, note: "Work the minors." },
            { math: md`\det A = -0\begin{vmatrix} 3 & 0 \\ 5 & 7 \end{vmatrix} + 4\begin{vmatrix} 1 & 2 \\ 5 & 7 \end{vmatrix} - 6\begin{vmatrix} 1 & 2 \\ 3 & 0 \end{vmatrix}`, note: md`Along column 2, signs $-, +, -$ (read the checkerboard down the second column).` },
            { math: md`= 4(7 - 10) - 6(0 - 6) = -12 + 36 = 24`, note: "The same, as it must be." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\det \begin{bmatrix} 2 & 0 & 1 \\ 1 & 3 & 0 \\ 0 & 1 & 4 \end{bmatrix}$.`,
          answer: "25",
          simplified: true,
          explain: md`Along row 1: $2(3 \cdot 4 - 0 \cdot 1) - 0 + 1(1 \cdot 1 - 3 \cdot 0) = 24 + 1 = 25$.`,
        },
        {
          kind: "key",
          title: "The product rule and its consequences",
          body: md`For $n \times n$ matrices $A$ and $B$:

$$\det(AB) = \det A \cdot \det B.$$

Consequences:

- $\det A^{-1} = \dfrac{1}{\det A}$ when $A$ is invertible, since $\det A \cdot \det A^{-1} = \det I = 1$.
- $\det(kA) = k^n \det A$: $kA$ scales all $n$ rows by $k$.
- $\det A^T = \det A$. (Stated. For $3 \times 3$ you can check it: expand $\det A^T$ along its first row, which is the first column of $A$, and you get $a(ei - fh) - d(bi - ch) + g(bf - ce)$; multiply out and it is exactly $aei - afh - bdi + bfg + cdh - ceg$, the same six terms as $\det A$.)

In general $\det(A + B) \neq \det A + \det B$. Determinants respect products, not sums.`,
        },
        {
          kind: "why",
          title: "Why det(AB) = det A det B",
          body: md`$AB$ means: apply $B$, then $A$. $B$ multiplies every volume by $\det B$ (with its sign recording orientation); $A$ then multiplies every volume by $\det A$. Doing one after the other multiplies volumes by $\det A \cdot \det B$, and flips orientation an even or odd number of times according to the signs. That is the geometric reason. The algebraic proof tracks how the elimination steps that reduce $A$ act on $AB$, and we leave it stated.

A numerical check: $A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}$ has $\det A = -2$ and $B = \begin{bmatrix} 2 & 0 \\ 1 & 1 \end{bmatrix}$ has $\det B = 2$. Then $AB = \begin{bmatrix} 4 & 2 \\ 10 & 4 \end{bmatrix}$, and $\det(AB) = 16 - 20 = -4 = (-2)(2)$.`,
        },
        {
          kind: "proof",
          title: "A square matrix is invertible if and only if its determinant is not zero",
          given: md`$A$ is an $n \times n$ matrix`,
          prove: md`$A$ is invertible exactly when $\det A \neq 0$`,
          steps: [
            { statement: md`Row reduce $A$ to its reduced row echelon form $R$ using $s$ swaps, scalings by nonzero $k_1, \ldots, k_m$, and some row additions.`, reason: "Gaussian elimination (Unit 1)" },
            { statement: md`$\det R = (-1)^s k_1 \cdots k_m \det A$, and the factor $(-1)^s k_1 \cdots k_m$ is not zero.`, reason: "The three row rules; scalings in elimination are never by 0" },
            { statement: md`So $\det A = 0$ exactly when $\det R = 0$.`, reason: "A nonzero multiple of a number is zero exactly when the number is" },
            { statement: md`If $A$ is invertible, $R = I$ and $\det R = 1 \neq 0$.`, reason: "Invertible matrix theorem (Unit 3): an invertible matrix row reduces to the identity; rule 1" },
            { statement: md`If $A$ is not invertible, $R$ has fewer than $n$ pivots, so its last row is all zeros, and $\det R = 0$.`, reason: md`A square RREF with $n$ pivots is $I$; with fewer, some row has no pivot and is zero. A zero row gives determinant 0` },
            { statement: md`$A$ is invertible if and only if $\det A \neq 0$.`, reason: "Steps 3, 4 and 5 together" },
          ],
        },
        {
          kind: "text",
          body: md`This adds a line to the invertible matrix theorem: $A$ invertible, $A\mathbf{x} = \mathbf{b}$ uniquely solvable for every $\mathbf{b}$, columns independent, rank $n$, and now $\det A \neq 0$, are all the same condition. The determinant is a single number that tests all of them at once. Geometrically it is the obvious statement: $A$ can be undone exactly when it doesn't flatten space.`,
        },
        {
          kind: "check",
          prompt: md`$A$ and $B$ are $3 \times 3$ with $\det A = 3$ and $\det B = -2$. Find $\det(2AB^T)$.`,
          answer: "-48",
          simplified: true,
          explain: md`$\det(2AB^T) = 2^3 \det A \det B^T = 8 \cdot 3 \cdot (-2) = -48$. The $2$ scales three rows, so it contributes $2^3$, and transposing $B$ doesn't change its determinant.`,
        },
      ],
      practice: [detThreeByThree, finishExpansion, detProperties],
    },
    {
      id: slug("Cramer's rule"),
      title: "Cramer's rule",
      summary: "A formula for the solution of a square system, proved from the column picture and the rules of the determinant.",
      blocks: [
        {
          kind: "text",
          body: md`Unit 1 solved $A\mathbf{x} = \mathbf{b}$ by elimination. When $A$ is square and $\det A \neq 0$ there is exactly one solution, and this lesson finds a **formula** for it, one determinant per unknown.

Start with two unknowns. Write $A = \begin{bmatrix} \mathbf{u} & \mathbf{v} \end{bmatrix}$ with columns $\mathbf{u}$ and $\mathbf{v}$, and $\mathbf{x} = (x, y)$. The column picture says the system means

$$x\mathbf{u} + y\mathbf{v} = \mathbf{b}:$$

how much of $\mathbf{u}$ and how much of $\mathbf{v}$ does it take to reach $\mathbf{b}$?`,
        },
        {
          kind: "diagram",
          view: [-1, 9, -1, 6],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "O", dir: "sw" },
            { name: "U", x: 3, y: 1, label: "\\mathbf{u}", dir: "se" },
            { name: "V", x: 1, y: 2, label: "\\mathbf{v}", dir: "nw" },
            { name: "W", x: 4, y: 3, label: "", hidden: true },
            { name: "B", x: "3x + y", y: "x + 2y", label: "\\mathbf{b}", dir: "e" },
            { name: "BV", x: "3x + y + 1", y: "x + 2y + 2", label: "", hidden: true },
            { name: "XU", x: "3x", y: "x", label: "x\\mathbf{u}", dir: "s" },
          ],
          polygons: [
            { points: ["O", "U", "W", "V"], dashed: true },
            { points: ["O", "B", "BV", "V"], fill: 2 },
          ],
          segments: [
            { from: "O", to: "U", arrow: true, color: 1 },
            { from: "O", to: "V", arrow: true, color: 1 },
            { from: "O", to: "B", arrow: true, color: 2 },
            { from: "XU", to: "B", dashed: true, label: "y\\mathbf{v}" },
          ],
          params: [
            { name: "x", min: 0.5, max: 2, step: 0.25, value: 1.5 },
            { name: "y", min: 0, max: 1.5, step: 0.25, value: 0.5 },
          ],
          readouts: [
            { label: "\\det[\\mathbf{u}\\;\\mathbf{v}]", value: "3 * 2 - 1 * 1" },
            { label: "\\det[\\mathbf{b}\\;\\mathbf{v}]", value: "(3x + y) * 2 - 1 * (x + 2y)" },
            { label: "\\det[\\mathbf{b}\\;\\mathbf{v}] / \\det[\\mathbf{u}\\;\\mathbf{v}]", value: "((3x + y) * 2 - (x + 2y)) / 5" },
          ],
          caption: md`$\mathbf{u} = (3, 1)$, $\mathbf{v} = (1, 2)$ and $\mathbf{b} = x\mathbf{u} + y\mathbf{v}$. The shaded parallelogram has sides $\mathbf{b}$ and $\mathbf{v}$. Slide $y$: $\mathbf{b}$ moves parallel to $\mathbf{v}$, a shear, and the shaded area doesn't change. Slide $x$: the area scales with $x$. The last readout is always exactly $x$.`,
        },
        {
          kind: "why",
          title: "Why x is a ratio of two determinants",
          body: md`Replace the first column of $A$ by $\mathbf{b}$ and take the determinant:

$$\det\begin{bmatrix} \mathbf{b} & \mathbf{v} \end{bmatrix} = \det\begin{bmatrix} x\mathbf{u} + y\mathbf{v} & \mathbf{v} \end{bmatrix} = x\det\begin{bmatrix} \mathbf{u} & \mathbf{v} \end{bmatrix} + y\det\begin{bmatrix} \mathbf{v} & \mathbf{v} \end{bmatrix}.$$

That is linearity in the first column. The last determinant has two equal columns, so it is $0$. What's left is $\det\begin{bmatrix} \mathbf{b} & \mathbf{v} \end{bmatrix} = x\det A$, and since $\det A \neq 0$,

$$x = \frac{\det\begin{bmatrix} \mathbf{b} & \mathbf{v} \end{bmatrix}}{\det A}.$$

In the picture: the parallelogram on $\mathbf{b}$ and $\mathbf{v}$ is the parallelogram on $x\mathbf{u}$ and $\mathbf{v}$ sheared by $y\mathbf{v}$, so its area is $x$ times the area on $\mathbf{u}$ and $\mathbf{v}$. The same argument with the second column replaced gives $y = \det\begin{bmatrix} \mathbf{u} & \mathbf{b} \end{bmatrix} / \det A$.`,
        },
        {
          kind: "key",
          title: "Cramer's rule",
          body: md`Let $A$ be $n \times n$ with $\det A \neq 0$, and let $A_j$ be $A$ with its $j$th column replaced by $\mathbf{b}$. The unique solution of $A\mathbf{x} = \mathbf{b}$ is

$$x_j = \frac{\det A_j}{\det A}, \qquad j = 1, \ldots, n.$$

For two unknowns, with $D = \det A$:

$$x = \frac{D_x}{D} = \frac{\begin{vmatrix} b_1 & a_{12} \\ b_2 & a_{22} \end{vmatrix}}{\begin{vmatrix} a_{11} & a_{12} \\ a_{21} & a_{22} \end{vmatrix}}, \qquad y = \frac{D_y}{D} = \frac{\begin{vmatrix} a_{11} & b_1 \\ a_{21} & b_2 \end{vmatrix}}{\begin{vmatrix} a_{11} & a_{12} \\ a_{21} & a_{22} \end{vmatrix}}.$$

The constants go into the column of the unknown you're solving for.`,
        },
        {
          kind: "proof",
          title: "Cramer's rule",
          given: md`$A = \begin{bmatrix} \mathbf{a}_1 & \cdots & \mathbf{a}_n \end{bmatrix}$ with $\det A \neq 0$, and $\mathbf{x} = (x_1, \ldots, x_n)$ satisfies $A\mathbf{x} = \mathbf{b}$`,
          prove: md`$x_j \det A = \det A_j$, where $A_j$ is $A$ with column $j$ replaced by $\mathbf{b}$`,
          steps: [
            { statement: md`$\mathbf{b} = x_1\mathbf{a}_1 + x_2\mathbf{a}_2 + \cdots + x_n\mathbf{a}_n$`, reason: md`$A\mathbf{x}$ is the combination of the columns of $A$ with weights $x_1, \ldots, x_n$ (Unit 3)` },
            { statement: md`$\det A_j = \det\begin{bmatrix} \mathbf{a}_1 & \cdots & \sum_k x_k\mathbf{a}_k & \cdots & \mathbf{a}_n \end{bmatrix}$`, reason: "Substitute step 1 into column j" },
            { statement: md`$\det A_j = \sum_{k} x_k \det\begin{bmatrix} \mathbf{a}_1 & \cdots & \mathbf{a}_k & \cdots & \mathbf{a}_n \end{bmatrix}$, where $\mathbf{a}_k$ sits in column $j$`, reason: "Rule 2: the determinant is linear in column j" },
            { statement: md`For $k \neq j$, the matrix in the $k$th term has $\mathbf{a}_k$ in both column $k$ and column $j$, so its determinant is $0$.`, reason: "Two equal columns give determinant 0 (swap them: the sign flips but nothing changes)" },
            { statement: md`$\det A_j = x_j \det A$`, reason: md`Only the $k = j$ term survives, and its matrix is $A$ itself` },
            { statement: md`$x_j = \dfrac{\det A_j}{\det A}$`, reason: md`Divide by $\det A \neq 0$` },
          ],
        },
        {
          kind: "example",
          title: "Two equations",
          problem: md`Solve $2x + 3y = 8$, $x - y = -1$ with Cramer's rule.`,
          steps: [
            { math: md`D = \begin{vmatrix} 2 & 3 \\ 1 & -1 \end{vmatrix} = 2(-1) - 3(1) = -5`, note: md`The coefficient determinant. Not zero, so the rule applies.` },
            { math: md`D_x = \begin{vmatrix} 8 & 3 \\ -1 & -1 \end{vmatrix} = 8(-1) - 3(-1) = -5`, note: md`Constants $8, -1$ replace the $x$-column.` },
            { math: md`D_y = \begin{vmatrix} 2 & 8 \\ 1 & -1 \end{vmatrix} = 2(-1) - 8(1) = -10`, note: md`Constants replace the $y$-column.` },
            { math: md`x = \frac{-5}{-5} = 1, \qquad y = \frac{-10}{-5} = 2`, note: md`Check: $2(1) + 3(2) = 8$ and $1 - 2 = -1$. ✓` },
          ],
        },
        {
          kind: "example",
          title: "One unknown out of three",
          problem: md`Find $z$ only: $x + y + z = 6$, $2x - y + z = 3$, $x + 2y - z = 2$.`,
          steps: [
            { math: md`D = \begin{vmatrix} 1 & 1 & 1 \\ 2 & -1 & 1 \\ 1 & 2 & -1 \end{vmatrix} = 1(1 - 2) - 1(-2 - 1) + 1(4 + 1) = 7`, note: "Expand along row 1." },
            { math: md`D_z = \begin{vmatrix} 1 & 1 & 6 \\ 2 & -1 & 3 \\ 1 & 2 & 2 \end{vmatrix} = 1(-2 - 6) - 1(4 - 3) + 6(4 + 1) = 21`, note: md`The constants $6, 3, 2$ replace the third column.` },
            { math: md`z = \frac{21}{7} = 3`, note: md`Two determinants and no elimination. (The full solution is $x = 1$, $y = 2$, $z = 3$; check the first equation: $1 + 2 + 3 = 6$.) This is where Cramer's rule shines: when you need one unknown, not all of them.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $3x + y = 7$, $x - 2y = -7$ with Cramer's rule. Give the answer as (x, y).`,
          answer: "(1, 4)",
          form: "tuple",
          explain: md`$D = 3(-2) - 1(1) = -7$, $D_x = 7(-2) - 1(-7) = -7$, $D_y = 3(-7) - 7(1) = -28$. So $x = 1$ and $y = 4$.`,
        },
        {
          kind: "key",
          title: "When the determinant is zero",
          body: md`If $\det A = 0$, Cramer's rule divides by zero and tells you nothing, and that is the right message: there is **no unique solution**. The columns of $A$ are dependent, so their combinations fill only a line (or plane, or some smaller space). If $\mathbf{b}$ lies in it there are infinitely many solutions; if not, none. Which one happens is a question for elimination, not for determinants.

So for a square system: unique solution $\iff \det A \neq 0$. A single number decides it.`,
        },
        {
          kind: "why",
          title: "Why the two-equation case fails exactly when ad = bc",
          body: md`Two lines $ax + by = e$ and $cx + dy = f$ meet in one point exactly when their slopes differ. The slopes are $-\frac{a}{b}$ and $-\frac{c}{d}$, and they are equal when $ad = bc$, that is, when $\begin{vmatrix} a & b \\ c & d \end{vmatrix} = 0$. (If $b = 0$ or $d = 0$ the line is vertical, and the same condition still says the two directions agree.) Parallel lines either coincide, giving infinitely many solutions, or never meet, giving none. In the column picture, $\mathbf{u}$ and $\mathbf{v}$ point along one line, and $\mathbf{b}$ is reachable only if it lies on that line.`,
        },
        {
          kind: "key",
          title: "The inverse by cofactors",
          body: md`Cramer's rule also gives a formula for $A^{-1}$. The **adjugate** $\operatorname{adj} A$ is the transpose of the matrix of cofactors: its $(i, j)$ entry is $C_{ji}$. Then

$$A^{-1} = \frac{1}{\det A}\operatorname{adj} A.$$

For $2 \times 2$: the cofactors of $\begin{bmatrix} a & b \\ c & d \end{bmatrix}$ are $C_{11} = d$, $C_{12} = -c$, $C_{21} = -b$, $C_{22} = a$, so $\operatorname{adj} A = \begin{bmatrix} d & -b \\ -c & a \end{bmatrix}$ and $A^{-1} = \frac{1}{ad - bc}\begin{bmatrix} d & -b \\ -c & a \end{bmatrix}$, the formula from Unit 3. For $3 \times 3$ it costs nine $2 \times 2$ determinants plus one $3 \times 3$; Gauss-Jordan is usually quicker, but the formula shows that every entry of $A^{-1}$ is a polynomial in the entries of $A$ divided by $\det A$.`,
        },
        {
          kind: "why",
          title: "Why the adjugate formula is Cramer's rule in disguise",
          body: md`Column $j$ of $A^{-1}$ is the solution $\mathbf{x}$ of $A\mathbf{x} = \mathbf{e}_j$, because $A A^{-1} = I$ column by column. Cramer's rule gives its $i$th entry as $\det A_i / \det A$, where $A_i$ is $A$ with column $i$ replaced by $\mathbf{e}_j$. Expand $\det A_i$ along that column: it has a single $1$, in row $j$, so the expansion is just $(-1)^{i + j} M_{ji} = C_{ji}$. Hence the $(i, j)$ entry of $A^{-1}$ is $C_{ji} / \det A$: the cofactor matrix, transposed, over the determinant.`,
        },
        {
          kind: "text",
          body: md`**When to use which.** Cramer's rule needs $n + 1$ determinants of size $n$, and a cofactor expansion of an $n \times n$ determinant has $n!$ terms: for $n = 10$ that is millions of multiplications, where elimination needs a few hundred. So elimination is how computers solve systems. Cramer's rule earns its place elsewhere: for $2 \times 2$ and $3 \times 3$ systems by hand, for picking out a single unknown, and in proofs and formulas, where "the solution is a ratio of determinants" is exactly the fact you need. The adjugate formula, for instance, shows that $A^{-1}$ depends continuously on $A$ as long as $\det A$ stays away from $0$.`,
        },
        {
          kind: "check",
          prompt: md`The system $kx + 3y = 1$, $2x + 4y = 5$ has no unique solution for one value of $k$. Find it.`,
          answer: "3/2",
          simplified: true,
          explain: md`No unique solution means $\begin{vmatrix} k & 3 \\ 2 & 4 \end{vmatrix} = 4k - 6 = 0$, so $k = \frac{3}{2}$. Then the left-hand sides are $\frac{3}{2}x + 3y$ and $2x + 4y$, one $\frac{4}{3}$ times the other: parallel lines.`,
        },
      ],
      practice: [cramerTwo, cramerThree, singularParameter],
    },
  ],
};
