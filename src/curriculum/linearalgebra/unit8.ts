import { frac, fracTex, gcd, paren } from "../../math/random";
import { md, slug, type Generator, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

type M2 = [[number, number], [number, number]];

/** A matrix as LaTeX. */
const matTex = (m: (number | string)[][]): string => md`\begin{bmatrix} ${m.map((row) => row.join(" & ")).join(" \\\\ ")} \end{bmatrix}`;
/** A matrix as a typed answer: [[a, b], [c, d]]. */
const matAns = (m: (number | string)[][]): string => `[[${m.map((row) => row.join(", ")).join("], [")}]]`;

/** n = k^2 f with f square-free. */
function squareFree(n: number): { k: number; f: number } {
  let k = 1;
  let f = n;
  for (let d = 2; d * d <= f; d++) while (f % (d * d) === 0) {
    f /= d * d;
    k *= d;
  }
  return { k, f };
}

/** sqrt(n) in simplest typed form: "3sqrt(5)", "sqrt(5)", "2", "0". */
function sqrtText(n: number): string {
  if (n === 0) return "0";
  const { k, f } = squareFree(n);
  if (f === 1) return String(k);
  return k === 1 ? `sqrt(${f})` : `${k}sqrt(${f})`;
}

/** sqrt(n) in simplest LaTeX. */
function sqrtTex(n: number): string {
  if (n === 0) return "0";
  const { k, f } = squareFree(n);
  if (f === 1) return String(k);
  return k === 1 ? `\\sqrt{${f}}` : `${k}\\sqrt{${f}}`;
}

/** m / sqrt(N) rationalized and reduced, as [typed, LaTeX]. */
function surd(m: number, N: number): [string, string] {
  const { k, f } = squareFree(N);
  if (f === 1) return [frac(m, k), fracTex(m, k)];
  // m / (k sqrt f) = m sqrt f / (k f)
  let num = m;
  let den = k * f;
  const g = gcd(num, den) || 1;
  num /= g;
  den /= g;
  if (num === 0) return ["0", "0"];
  const sign = num < 0 ? "-" : "";
  const a = Math.abs(num);
  const coef = a === 1 ? "" : String(a);
  const text = den === 1 ? `${sign}${coef}sqrt(${f})` : `${sign}${coef}sqrt(${f})/${den}`;
  const tex = den === 1 ? `${sign}${coef}\\sqrt{${f}}` : `${sign}\\frac{${coef}\\sqrt{${f}}}{${den}}`;
  return [text, tex];
}

/** The pieces of A^T A for a 2×2 matrix and its eigenvalues. */
function gram(A: M2) {
  const [[a, b], [c, d]] = A;
  const P = a * a + c * c;
  const Q = b * b + d * d;
  const R = a * b + c * d;
  const disc = (P - Q) ** 2 + 4 * R * R;
  const s = Math.sqrt(disc);
  return { a, b, c, d, P, Q, R, T: P + Q, D: (a * d - b * c) ** 2, disc, l1: (P + Q + s) / 2, l2: (P + Q - s) / 2, det: a * d - b * c };
}

/** Right singular vector v1 = (vx, vy)/sqrt(n) with integer vx, vy, for a matrix whose A^T A has integer eigenvalues. */
function topVector(A: M2) {
  const g = gram(A);
  let vx = g.R;
  let vy = g.l1 - g.P;
  if (vx === 0 && vy === 0) [vx, vy] = [1, 0];
  const h = gcd(vx, vy) || 1;
  vx /= h;
  vy /= h;
  if (vx < 0 || (vx === 0 && vy < 0)) [vx, vy] = [-vx, -vy];
  const n = vx * vx + vy * vy;
  // A v (not yet normalized)
  const m1 = g.a * vx + g.b * vy;
  const m2 = g.c * vx + g.d * vy;
  return { vx, vy, n, m1, m2 };
}

const isSquare = (n: number) => Number.isInteger(Math.sqrt(n));

/** Small integer matrices whose A^T A has distinct positive integer eigenvalues and isn't diagonal. */
const NICE: M2[] = [];
/** Small rank-one matrices with no zero row. */
const RANK1: M2[] = [];
for (let a = -5; a <= 5; a++) {
  for (let b = -5; b <= 5; b++) {
    for (let c = -5; c <= 5; c++) {
      for (let d = -5; d <= 5; d++) {
        const A: M2 = [[a, b], [c, d]];
        const g = gram(A);
        if (g.R === 0 || !isSquare(g.disc)) continue;
        if (g.l2 === 0) {
          if ((a || b) && (c || d)) RANK1.push(A);
          continue;
        }
        if (g.l1 !== g.l2) NICE.push(A);
      }
    }
  }
}

/** The raw-entry expression for the entries of A^T A, so verify equations don't reuse the generator's arithmetic. */
function gramText(A: M2) {
  const [[a, b], [c, d]] = A;
  const p = (v: number) => `(${v})`;
  return {
    P: `(${p(a)}^2 + ${p(c)}^2)`,
    Q: `(${p(b)}^2 + ${p(d)}^2)`,
    R: `(${p(a)} ${p(b)} + ${p(c)} ${p(d)})`,
  };
}

const sigTex = (g: ReturnType<typeof gram>) => md`\sigma_1 = ${sqrtTex(g.l1)}, \; \sigma_2 = ${sqrtTex(g.l2)}`;

/** Steps that compute A^T A and its eigenvalues. */
function gramSteps(A: M2) {
  const g = gram(A);
  const G = [[g.P, g.R], [g.R, g.Q]];
  return [
    {
      math: md`A^{\mathsf T}A = ${matTex([[g.a, g.c], [g.b, g.d]])}${matTex(A)} = ${matTex(G)}`,
      note: md`Each entry is a dot product of two columns of $A$: $(${g.a}, ${g.c}) \cdot (${g.a}, ${g.c}) = ${g.P}$, $(${g.a}, ${g.c}) \cdot (${g.b}, ${g.d}) = ${g.R}$, $(${g.b}, ${g.d}) \cdot (${g.b}, ${g.d}) = ${g.Q}$.`,
    },
    {
      math: md`\lambda^2 - ${g.T}\lambda + ${g.D} = (\lambda - ${g.l1})(\lambda - ${g.l2}) = 0`,
      note: md`The characteristic polynomial of a $2 \times 2$ matrix is $\lambda^2 - (\text{trace})\lambda + \det$. Here the trace is $${g.P} + ${g.Q} = ${g.T}$ and the determinant is $${g.P} \cdot ${g.Q} - ${paren(g.R)}^2 = ${g.D}$.`,
    },
  ];
}

// ── Practice generators: lesson 1 ───────────────────────────────────────────

const singularValues: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let a = r.nonzero(-6, 6);
    let d = r.nonzero(-6, 6);
    while (Math.abs(a) === Math.abs(d)) d = r.nonzero(-6, 6);
    if (r.next() < 0.5 && a > 0 && d > 0) a = -a;
    const A: M2 = [[a, 0], [0, d]];
    const [s1, s2] = [Math.max(Math.abs(a), Math.abs(d)), Math.min(Math.abs(a), Math.abs(d))];
    const gt = gramText(A);
    return {
      prompt: md`Find the singular values of $A = ${matTex(A)}$. Separate them with commas, largest first.`,
      answer: `${s1}, ${s2}`,
      form: "set",
      simplified: true,
      verify: [`(${gt.P} - s^2)(${gt.Q} - s^2) - ${gt.R}^2 = 0`],
      hint: md`$A^{\mathsf T}A$ is diagonal here, so its eigenvalues are just the diagonal entries. Singular values are their square roots, never negative.`,
      solution: [
        { math: md`A^{\mathsf T}A = ${matTex([[a * a, 0], [0, d * d]])}`, note: md`Squaring the diagonal entries. A diagonal matrix has its diagonal entries as eigenvalues: $\lambda = ${a * a}$ and $\lambda = ${d * d}$.` },
        { math: md`\sigma_1 = \sqrt{${s1 * s1}} = ${s1}, \quad \sigma_2 = \sqrt{${s2 * s2}} = ${s2}`, note: md`A singular value is a stretch factor, so it is $|${a}|$ and $|${d}|$, not the signed entries. ${a < 0 || d < 0 ? "The sign only records a flip, and a flip doesn't change lengths." : ""}` },
      ],
    };
  }
  if (kind === 1) {
    const A = r.pick(RANK1);
    const g = gram(A);
    return {
      prompt: md`Find the singular values of $A = ${matTex(A)}$. Separate them with commas, largest first, in exact form (like 3sqrt(2), sqrt(2)).`,
      answer: `${sqrtText(g.l1)}, 0`,
      form: "set",
      simplified: true,
      verify: [`(${gramText(A).P} - s^2)(${gramText(A).Q} - s^2) - ${gramText(A).R}^2 = 0`],
      hint: md`The second column is a multiple of the first, so $\det A = 0$ and one singular value is $0$. The other one makes $\sigma_1^2 + \sigma_2^2$ equal the sum of the squares of all four entries.`,
      solution: [
        ...gramSteps(A),
        { math: md`\sigma_1 = \sqrt{${g.l1}} = ${sqrtTex(g.l1)}, \quad \sigma_2 = \sqrt{0} = 0`, note: md`A rank-1 matrix squashes the plane onto a line: one direction is stretched by $${sqrtTex(g.l1)}$ and the perpendicular direction is crushed to nothing. Check: $${g.a}^2 + ${g.b}^2 + ${g.c}^2 + ${g.d}^2 = ${g.l1} = \sigma_1^2 + 0$.` },
      ],
    };
  }
  const A = r.pick(NICE);
  const g = gram(A);
  const gt = gramText(A);
  return {
    prompt: md`Find the singular values of $A = ${matTex(A)}$. Separate them with commas, largest first, in exact form (like 3sqrt(2), sqrt(2)).`,
    answer: `${sqrtText(g.l1)}, ${sqrtText(g.l2)}`,
    form: "set",
    simplified: true,
    verify: [`(${gt.P} - s^2)(${gt.Q} - s^2) - ${gt.R}^2 = 0`],
    hint: md`Form $A^{\mathsf T}A$, find its two eigenvalues from $\lambda^2 - (\text{trace})\lambda + \det = 0$, and take square roots.`,
    solution: [
      ...gramSteps(A),
      { math: sigTex(g), note: md`Square roots of the eigenvalues, largest first. Check: $\sigma_1\sigma_2 = \sqrt{${g.l1} \cdot ${g.l2}} = ${Math.abs(g.det)} = |\det A|$.` },
    ],
  };
};

const leftSingularVector: Generator = (r) => {
  const A = r.pick(NICE.filter((M) => topVector(M).n <= 5));
  const g = gram(A);
  const v = topVector(A);
  const N = v.n * g.l1;
  const [u1Text, u1Tex] = surd(v.m1, N);
  const [u2Text, u2Tex] = surd(v.m2, N);
  const v1Tex = md`\frac{1}{\sqrt{${v.n}}}\begin{bmatrix} ${v.vx} \\ ${v.vy} \end{bmatrix}`;
  const AAt = { P: g.a * g.a + g.b * g.b, Q: g.c * g.c + g.d * g.d, R: g.a * g.c + g.b * g.d };
  const term = (coef: number, x: number) => `${paren(coef)}(${x})`;
  return {
    prompt: md`The matrix $A = ${matTex(A)}$ has largest singular value $\sigma_1 = ${sqrtTex(g.l1)}$, with right singular vector $\mathbf{v}_1 = ${v1Tex}$. Find the left singular vector $\mathbf{u}_1$. Type it as a vector, like (3/5, -4/5) or (1/sqrt(2), 1/sqrt(2)).`,
    answer: `(${u1Text}, ${u2Text})`,
    form: "tuple",
    // u1 is a unit vector, an eigenvector of A A^T for sigma_1^2, and points the same way as A v1.
    verify: [
      "a^2 + b^2 = 1",
      `${AAt.P} a + ${AAt.R} b = ${g.l1} a`,
      `${AAt.R} a + ${AAt.Q} b = ${g.l1} b`,
      `${v.m1} a + ${v.m2} b = ${sqrtText(N)}`,
    ],
    hint: md`By construction $A\mathbf{v}_1 = \sigma_1 \mathbf{u}_1$, so $\mathbf{u}_1 = \dfrac{A\mathbf{v}_1}{\sigma_1}$. Multiply first, then divide by $\sigma_1$ and tidy the square roots.`,
    solution: [
      {
        math: md`A\mathbf{v}_1 = ${matTex(A)} ${v1Tex} = \frac{1}{\sqrt{${v.n}}}\begin{bmatrix} ${v.m1} \\ ${v.m2} \end{bmatrix}`,
        note: md`Keep the $\frac{1}{\sqrt{${v.n}}}$ outside and multiply the integer vector $(${v.vx}, ${v.vy})$: row 1 gives $${term(g.a, v.vx)} + ${term(g.b, v.vy)} = ${v.m1}$, row 2 gives $${term(g.c, v.vx)} + ${term(g.d, v.vy)} = ${v.m2}$.`,
      },
      {
        math: md`|A\mathbf{v}_1| = \frac{\sqrt{${v.m1 * v.m1 + v.m2 * v.m2}}}{\sqrt{${v.n}}} = \sqrt{${g.l1}} = \sigma_1`,
        note: md`A good check before dividing: the image of $\mathbf{v}_1$ really does have length $\sigma_1$.`,
      },
      {
        math: md`\mathbf{u}_1 = \frac{A\mathbf{v}_1}{\sigma_1} = \frac{1}{\sqrt{${v.n}} \cdot ${sqrtTex(g.l1)}}\begin{bmatrix} ${v.m1} \\ ${v.m2} \end{bmatrix} = \begin{bmatrix} ${u1Tex} \\ ${u2Tex} \end{bmatrix}`,
        note: md`Divide each entry by $\sqrt{${v.n}} \cdot ${sqrtTex(g.l1)} = ${sqrtTex(N)}$ and rationalize. The result is a unit vector: $(${u1Tex})^2 + (${u2Tex})^2 = 1$.`,
      },
    ],
  };
};

const singularFacts: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let A: M2;
    do A = [[r.nonzero(-5, 5), r.int(-5, 5)], [r.int(-5, 5), r.nonzero(-5, 5)]];
    while (A[0][0] * A[1][1] - A[0][1] * A[1][0] === 0);
    const g = gram(A);
    const gt = gramText(A);
    return {
      prompt: md`Without finding the singular values themselves, find the product $\sigma_1 \sigma_2$ of the singular values of $A = ${matTex(A)}$.`,
      answer: String(Math.abs(g.det)),
      verify: [`p^2 = ${gt.P} ${gt.Q} - ${gt.R}^2`],
      hint: md`$\sigma_1^2 \sigma_2^2 = \det(A^{\mathsf T}A) = (\det A)^2$. So the product of the singular values is $|\det A|$.`,
      solution: [
        { math: md`\det A = (${g.a})(${g.d}) - (${g.b})(${g.c}) = ${g.det}`, note: "The determinant of A." },
        { math: md`\sigma_1 \sigma_2 = \sqrt{\det(A^{\mathsf T}A)} = \sqrt{(\det A)^2} = |\det A| = ${Math.abs(g.det)}`, note: md`The eigenvalues of $A^{\mathsf T}A$ multiply to its determinant, and $\det(A^{\mathsf T}A) = \det(A^{\mathsf T})\det A = (\det A)^2$. ${g.det < 0 ? "The negative sign of $\\det A$ records a flip; the stretch factors themselves are positive." : ""}` },
      ],
    };
  }
  if (kind === 1) {
    const A = r.pick(NICE);
    const g = gram(A);
    return {
      prompt: md`The matrix $A = ${matTex(A)}$ has largest singular value $\sigma_1 = ${sqrtTex(g.l1)}$. Find $\sigma_2$ in exact form (like sqrt(2) or 2sqrt(3)).`,
      answer: sqrtText(g.l2),
      simplified: true,
      verify: [`s (${sqrtText(g.l1)}) = ${Math.abs(g.det)}`],
      hint: md`Either compute $A^{\mathsf T}A$ and its second eigenvalue, or use $\sigma_1 \sigma_2 = |\det A|$ and divide.`,
      solution: [
        { math: md`\det A = (${g.a})(${g.d}) - (${g.b})(${g.c}) = ${g.det}`, note: md`So $\sigma_1\sigma_2 = |\det A| = ${Math.abs(g.det)}$.` },
        { math: md`\sigma_2 = \frac{${Math.abs(g.det)}}{${sqrtTex(g.l1)}} = ${sqrtTex(g.l2)}`, note: md`Rationalize: $\frac{${Math.abs(g.det)}}{${sqrtTex(g.l1)}} = \frac{${Math.abs(g.det)} \cdot ${sqrtTex(g.l1)}}{${g.l1}}$, which simplifies to $${sqrtTex(g.l2)}$. Check: $\sigma_2^2 = ${g.l2}$ and $\sigma_1^2 + \sigma_2^2 = ${g.l1} + ${g.l2} = ${g.T}$, the sum of the squares of the entries of $A$.` },
      ],
    };
  }
  const A = r.pick(NICE);
  const g = gram(A);
  const gt = gramText(A);
  return {
    prompt: md`Over all unit vectors $\mathbf{x}$ in $\mathbb{R}^2$, find the largest possible value of $|A\mathbf{x}|$ when $A = ${matTex(A)}$. Give it in exact form (like 2sqrt(3)).`,
    answer: sqrtText(g.l1),
    simplified: true,
    verify: [`2 s^2 = (${gt.P} + ${gt.Q}) + sqrt((${gt.P} - ${gt.Q})^2 + 4 ${gt.R}^2)`],
    hint: md`The longest a unit vector can get is the long semi-axis of the ellipse, which is $\sigma_1$, the square root of the largest eigenvalue of $A^{\mathsf T}A$.`,
    solution: [
      ...gramSteps(A),
      { math: md`\max |A\mathbf{x}| = \sigma_1 = \sqrt{${g.l1}} = ${sqrtTex(g.l1)}`, note: md`For a unit vector $\mathbf{x} = c_1\mathbf{v}_1 + c_2\mathbf{v}_2$, $|A\mathbf{x}|^2 = \sigma_1^2 c_1^2 + \sigma_2^2 c_2^2 \le \sigma_1^2$, with equality at $\mathbf{x} = \mathbf{v}_1$.` },
    ],
  };
};

// ── Practice generators: lesson 2 ───────────────────────────────────────────

const frobeniusAndError: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let A: M2;
    let total: number;
    do {
      A = [[r.int(-5, 5), r.int(-5, 5)], [r.int(-5, 5), r.int(-5, 5)]];
      total = A.flat().reduce((s, v) => s + v * v, 0);
    } while (total === 0 || isSquare(total));
    const [[a, b], [c, d]] = A;
    return {
      prompt: md`Find the Frobenius norm $\|A\|_F$ of $A = ${matTex(A)}$, in exact form (like 2sqrt(3)).`,
      answer: sqrtText(total),
      simplified: true,
      verify: [`n^2 = (${a})^2 + (${b})^2 + (${c})^2 + (${d})^2`],
      hint: "Square every entry, add, take the square root. Then pull any square factor out of the root.",
      solution: [
        { math: md`\|A\|_F^2 = ${paren(a)}^2 + ${paren(b)}^2 + ${paren(c)}^2 + ${paren(d)}^2 = ${total}`, note: md`The sum of the squares of all four entries. It also equals $\sigma_1^2 + \sigma_2^2$.` },
        { math: squareFree(total).k === 1 ? md`\|A\|_F = \sqrt{${total}}` : md`\|A\|_F = \sqrt{${total}} = ${sqrtTex(total)}`, note: squareFree(total).k === 1 ? md`$${total}$ has no square factor, so the root stays as it is.` : md`$${total} = ${squareFree(total).k}^2 \cdot ${squareFree(total).f}$, so the square factor comes out of the root.` },
      ],
    };
  }
  if (kind === 1) {
    const A = r.pick(NICE);
    const g = gram(A);
    const gt = gramText(A);
    return {
      prompt: md`Let $A_1$ be the best rank-1 approximation of $A = ${matTex(A)}$. Find the error $\|A - A_1\|_F$ in exact form (like sqrt(2) or 2sqrt(3)).`,
      answer: sqrtText(g.l2),
      simplified: true,
      verify: [`2 s^2 = (${gt.P} + ${gt.Q}) - sqrt((${gt.P} - ${gt.Q})^2 + 4 ${gt.R}^2)`],
      hint: md`The piece you drop is $\sigma_2 \mathbf{u}_2 \mathbf{v}_2^{\mathsf T}$, whose Frobenius norm is exactly $\sigma_2$. So find the smaller singular value.`,
      solution: [
        ...gramSteps(A),
        { math: md`\|A - A_1\|_F = \sigma_2 = \sqrt{${g.l2}} = ${sqrtTex(g.l2)}`, note: md`$A - A_1 = \sigma_2 \mathbf{u}_2 \mathbf{v}_2^{\mathsf T}$, and a rank-1 piece $\sigma \mathbf{u}\mathbf{v}^{\mathsf T}$ built from unit vectors has Frobenius norm $\sigma$.` },
      ],
    };
  }
  const count = r.int(3, 4);
  const sig: number[] = [];
  let x = r.int(6, 12);
  for (let i = 0; i < count; i++) {
    sig.push(x);
    x = Math.max(1, x - r.int(1, Math.max(1, Math.floor(x / 2))));
  }
  for (let i = 1; i < sig.length; i++) if (sig[i]! >= sig[i - 1]!) sig[i] = Math.max(1, sig[i - 1]! - 1);
  const k = r.int(1, count - 2);
  const tail = sig.slice(k).reduce((s, v) => s + v * v, 0);
  const head = sig.slice(0, k).reduce((s, v) => s + v * v, 0);
  const sq = (v: number) => `${v}^2`;
  return {
    prompt: md`A $${count} \times ${count}$ matrix $A$ has singular values $${sig.join(", ")}$. Find $\|A - A_${k}\|_F$, the error of its best rank-${k} approximation, in exact form (like 2sqrt(3)).`,
    answer: sqrtText(tail),
    simplified: true,
    // Pythagoras for the pieces: |A|_F^2 = |A_k|_F^2 + |A - A_k|_F^2.
    verify: [`d^2 + ${sig.slice(0, k).map(sq).join(" + ")} = ${sig.map(sq).join(" + ")}`],
    hint: md`$A_${k}$ keeps the ${k === 1 ? "first piece" : `first ${k} pieces`}. The error is the square root of the sum of the squares of the singular values you drop.`,
    solution: [
      { math: md`A - A_${k} = ${sig.slice(k).map((v, i) => `${v}\\,\\mathbf{u}_{${k + i + 1}}\\mathbf{v}_{${k + i + 1}}^{\\mathsf T}`).join(" + ")}`, note: md`The dropped pieces. Their rank-1 terms are perpendicular to each other in the Frobenius sense, so their squared norms add.` },
      { math: md`\|A - A_${k}\|_F = \sqrt{${sig.slice(k).map(sq).join(" + ")}} = \sqrt{${tail}} = ${sqrtTex(tail)}`, note: md`Compare $\|A\|_F = \sqrt{${head + tail}}$: the approximation keeps $${head}$ of the $${head + tail}$ units of $\|A\|_F^2$.` },
    ],
  };
};

const rankOneApproximation: Generator = (r) => {
  const exact = r.next() < 0.6;
  if (exact) {
    const A = r.pick(NICE.filter((M) => topVector(M).n <= 5));
    const g = gram(A);
    const v = topVector(A);
    const entries = [[v.m1 * v.vx, v.m1 * v.vy], [v.m2 * v.vx, v.m2 * v.vy]];
    const [vxText, vxTex] = surd(v.vx, v.n);
    const [vyText, vyTex] = surd(v.vy, v.n);
    void vxText;
    void vyText;
    return {
      prompt: md`Find the best rank-1 approximation $A_1 = \sigma_1 \mathbf{u}_1 \mathbf{v}_1^{\mathsf T}$ of $A = ${matTex(A)}$. Type it row by row, like [[1/2, 3], [0, -2]]. Fractions are fine.`,
      answer: matAns(entries.map((row) => row.map((e) => frac(e, v.n)))),
      form: "matrix",
      hint: md`Since $\sigma_1 \mathbf{u}_1 = A\mathbf{v}_1$, you can write $A_1 = (A\mathbf{v}_1)\mathbf{v}_1^{\mathsf T}$: find $\mathbf{v}_1$, multiply it by $A$, then form the outer product. No square roots survive.`,
      solution: [
        ...gramSteps(A),
        {
          math: md`(A^{\mathsf T}A - ${g.l1} I)\mathbf{v} = \mathbf{0} \;\Rightarrow\; \mathbf{v}_1 = \frac{1}{\sqrt{${v.n}}}\begin{bmatrix} ${v.vx} \\ ${v.vy} \end{bmatrix} = \begin{bmatrix} ${vxTex} \\ ${vyTex} \end{bmatrix}`,
          note: md`The eigenvector for the larger eigenvalue $\lambda_1 = ${g.l1}$, scaled to unit length.`,
        },
        {
          math: md`\sigma_1 \mathbf{u}_1 = A\mathbf{v}_1 = \frac{1}{\sqrt{${v.n}}}\begin{bmatrix} ${v.m1} \\ ${v.m2} \end{bmatrix}`,
          note: md`No need to split this into $\sigma_1$ and $\mathbf{u}_1$ separately; the product is all the formula uses.`,
        },
        {
          math: md`A_1 = (A\mathbf{v}_1)\mathbf{v}_1^{\mathsf T} = \frac{1}{${v.n}}\begin{bmatrix} ${v.m1} \\ ${v.m2} \end{bmatrix}\begin{bmatrix} ${v.vx} & ${v.vy} \end{bmatrix} = ${matTex(entries.map((row) => row.map((e) => fracTex(e, v.n))))}`,
          note: md`The two $\frac{1}{\sqrt{${v.n}}}$ factors combine into $\frac{1}{${v.n}}$. Entry $(i, j)$ is (entry $i$ of $A\mathbf{v}_1$) times (entry $j$ of $\mathbf{v}_1$). Every row of $A_1$ is a multiple of $\mathbf{v}_1^{\mathsf T}$: rank 1.`,
        },
      ],
    };
  }
  let A: M2;
  let g: ReturnType<typeof gram>;
  do {
    A = [[r.nonzero(-5, 5), r.nonzero(-5, 5)], [r.nonzero(-5, 5), r.nonzero(-5, 5)]];
    g = gram(A);
  } while (g.det === 0 || isSquare(g.disc) || g.l1 - g.l2 < 3);
  const vx = g.R;
  const vy = g.l1 - g.P;
  const norm = Math.hypot(vx, vy);
  const [ux, uy] = [vx / norm, vy / norm];
  const m1 = g.a * ux + g.b * uy;
  const m2 = g.c * ux + g.d * uy;
  const A1 = [[m1 * ux, m1 * uy], [m2 * ux, m2 * uy]];
  const f3 = (x: number) => (Math.abs(x) < 0.0005 ? "0" : x.toFixed(3));
  const f4 = (x: number) => x.toFixed(4);
  return {
    prompt: md`Find the best rank-1 approximation $A_1$ of $A = ${matTex(A)}$. Round each entry to 3 decimal places and type the matrix row by row, like [[1.25, -0.5], [2, 0.125]].`,
    answer: matAns(A1.map((row) => row.map(f3))),
    form: "matrix",
    tolerance: 0.0005,
    hint: md`$A_1 = (A\mathbf{v}_1)\mathbf{v}_1^{\mathsf T}$ where $\mathbf{v}_1$ is the unit eigenvector of $A^{\mathsf T}A$ for its larger eigenvalue. The eigenvalue is irrational here, so carry four decimals through the working.`,
    solution: [
      { math: md`A^{\mathsf T}A = ${matTex([[g.P, g.R], [g.R, g.Q]])}`, note: "Columns of A dotted with columns of A." },
      { math: md`\lambda_1 = \frac{${g.T} + \sqrt{${g.disc}}}{2} \approx ${f4(g.l1)}`, note: md`From $\lambda^2 - ${g.T}\lambda + ${g.D} = 0$ with the quadratic formula; the discriminant is $${g.T}^2 - 4 \cdot ${g.D} = ${g.disc}$.` },
      { math: md`\mathbf{v} = \begin{bmatrix} ${g.R} \\ \lambda_1 - ${g.P} \end{bmatrix} \approx \begin{bmatrix} ${f4(vx)} \\ ${f4(vy)} \end{bmatrix}, \qquad \mathbf{v}_1 = \frac{\mathbf{v}}{|\mathbf{v}|} \approx \begin{bmatrix} ${f4(ux)} \\ ${f4(uy)} \end{bmatrix}`, note: md`The first row of $A^{\mathsf T}A - \lambda_1 I$ is $(${g.P} - \lambda_1,\; ${g.R})$, and $(${g.R},\; \lambda_1 - ${g.P})$ is perpendicular to it. Divide by its length $\approx ${f4(norm)}$.` },
      { math: md`A\mathbf{v}_1 \approx \begin{bmatrix} ${f4(m1)} \\ ${f4(m2)} \end{bmatrix}`, note: md`This is $\sigma_1 \mathbf{u}_1$; its length $\approx ${f4(Math.hypot(m1, m2))}$ should match $\sqrt{\lambda_1} \approx ${f4(Math.sqrt(g.l1))}$.` },
      { math: md`A_1 = (A\mathbf{v}_1)\mathbf{v}_1^{\mathsf T} \approx ${matTex(A1.map((row) => row.map(f3)))}`, note: md`Outer product: entry $(i, j)$ is (entry $i$ of $A\mathbf{v}_1$)(entry $j$ of $\mathbf{v}_1$). The leftover $A - A_1$ has Frobenius norm $\sigma_2 \approx ${f4(Math.sqrt(g.l2))}$.` },
    ],
  };
};

const compression: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const m = r.pick([200, 300, 400, 500, 600, 800, 1000]);
    const n = r.pick([150, 200, 250, 300, 400, 600, 800]);
    const k = r.pick([5, 8, 10, 12, 20, 25, 40, 50]);
    const stored = k * (m + n + 1);
    return {
      prompt: md`A grayscale image is stored as a $${m} \times ${n}$ matrix of brightness values. It is replaced by its best rank-${k} approximation, stored as ${k} singular values, ${k} left singular vectors and ${k} right singular vectors. How many numbers are stored?`,
      answer: String(stored),
      hint: md`Each piece $\sigma_i \mathbf{u}_i \mathbf{v}_i^{\mathsf T}$ costs one number for $\sigma_i$, $${m}$ for $\mathbf{u}_i$ and $${n}$ for $\mathbf{v}_i$.`,
      solution: [
        { math: md`${k}(${m} + ${n} + 1) = ${k} \cdot ${m + n + 1} = ${stored}`, note: md`Per piece: $${m}$ entries of $\mathbf{u}_i$, $${n}$ entries of $\mathbf{v}_i$, and $\sigma_i$ itself.` },
        { math: md`\frac{${stored}}{${m} \cdot ${n}} = \frac{${stored}}{${m * n}} \approx ${(100 * stored / (m * n)).toFixed(1)}\%`, note: md`Compared with the $${m * n}$ entries of the full matrix. The picture is recognisable because the singular values of real images drop off quickly.` },
      ],
    };
  }
  if (kind === 1) {
    const count = r.int(3, 4);
    const sig: number[] = [];
    let x = r.int(5, 10);
    for (let i = 0; i < count; i++) {
      sig.push(x);
      x = Math.max(1, x - r.int(1, Math.max(1, Math.floor(x / 2))));
    }
    for (let i = 1; i < sig.length; i++) if (sig[i]! >= sig[i - 1]!) sig[i] = Math.max(1, sig[i - 1]! - 1);
    const k = r.int(1, count - 2);
    const sq = (v: number) => v * v;
    const head = sig.slice(0, k).reduce((s, v) => s + sq(v), 0);
    const total = sig.reduce((s, v) => s + sq(v), 0);
    return {
      prompt: md`A matrix has singular values $${sig.join(", ")}$. What fraction of $\|A\|_F^2$ is kept by its best rank-${k} approximation $A_${k}$? Give a reduced fraction, like 9/10.`,
      answer: frac(head, total),
      simplified: true,
      verify: [`f (${sig.map((v) => `${v}^2`).join(" + ")}) = ${sig.slice(0, k).map((v) => `${v}^2`).join(" + ")}`],
      hint: md`$\|A\|_F^2 = \sigma_1^2 + \cdots + \sigma_${count}^2$ and $\|A_${k}\|_F^2$ is the sum of the first ${k} of those squares.`,
      solution: [
        { math: md`\|A\|_F^2 = ${sig.map((v) => `${v}^2`).join(" + ")} = ${total}`, note: "Squares of all the singular values." },
        { math: md`\|A_${k}\|_F^2 = ${sig.slice(0, k).map((v) => `${v}^2`).join(" + ")} = ${head}`, note: md`Only the ${k === 1 ? "first piece" : `first ${k} pieces`} survive.` },
        { math: md`\frac{${head}}{${total}} = ${fracTex(head, total)}`, note: md`About $${(100 * head / total).toFixed(0)}\%$ of the "energy" of $A$ in rank ${k}.` },
      ],
    };
  }
  // Smallest rank that keeps at least p% of |A|_F^2.
  const sig = [r.int(8, 12), r.int(4, 7), r.int(2, 3), 1];
  const sq = (v: number) => v * v;
  const total = sig.reduce((s, v) => s + sq(v), 0);
  const cum: number[] = [];
  sig.reduce((s, v) => (cum.push(s + sq(v)), s + sq(v)), 0);
  const pct = r.pick([80, 90, 95, 99]);
  const k = cum.findIndex((c) => 100 * c >= pct * total) + 1;
  return {
    prompt: md`A $4 \times 4$ matrix has singular values $${sig.join(", ")}$. What is the smallest rank $k$ for which $A_k$ keeps at least $${pct}\%$ of $\|A\|_F^2$?`,
    answer: String(k),
    hint: md`Add the squared singular values from the largest down until the running total reaches $${pct}\%$ of $${total}$.`,
    solution: [
      { math: md`\|A\|_F^2 = ${sig.map((v) => `${v}^2`).join(" + ")} = ${total}, \qquad ${pct}\% \text{ of } ${total} = ${(pct * total / 100).toFixed(2)}`, note: "The target." },
      { math: md`${cum.map((c, i) => `k = ${i + 1}: ${c}`).join(", \\quad ")}`, note: md`Running totals of $\sigma_1^2 + \cdots + \sigma_k^2$.` },
      { math: md`k = ${k}`, note: md`The first running total that reaches $${(pct * total / 100).toFixed(2)}$ is $${cum[k - 1]}$, at $k = ${k}$. ${k < 4 ? `A rank-${k} matrix holds ${pct}% of the energy of a rank-4 one.` : "Here nothing can be dropped."}` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit8: Unit = {
  title: "Singular Value Decomposition",
  lessons: [
    {
      id: slug("The SVD"),
      title: "The SVD",
      summary: "Every matrix turns the unit circle into an ellipse. The singular values are its semi-axes, and the SVD A = UΣVᵀ writes any matrix as rotate, stretch, rotate.",
      blocks: [
        {
          kind: "text",
          body: md`Diagonalization (Unit 7) was powerful but picky. It needs a square matrix with enough eigenvectors, and even then the eigenvectors of a non-symmetric matrix lean at odd angles to each other. The **singular value decomposition** fixes all of that. It works for every matrix, square or not, and both of its sets of directions are perpendicular.

The idea starts with a picture. Take every unit vector $\mathbf{x}$ in the plane and look at where $A$ sends it. The unit circle comes out as an ellipse. Drag the sliders below and watch.`,
        },
        {
          kind: "plot",
          x: [-7, 7],
          y: [-7, 7],
          parametric: [
            { x: "cos(t)", y: "sin(t)", t: [0, 6.2832], label: "\\text{unit circle}", color: 3, dashed: true },
            { x: "a cos(t) + b sin(t)", y: "c cos(t) + d sin(t)", t: [0, 6.2832], label: "A\\mathbf{x} \\text{ for } |\\mathbf{x}| = 1", color: 1 },
          ],
          points: [
            { x: "a", y: "c", label: "A\\mathbf{e}_1", color: 2 },
            { x: "b", y: "d", label: "A\\mathbf{e}_2", color: 2 },
            { x: 0, y: 0, label: "\\sigma_1 \\approx {=sqrt((a^2+b^2+c^2+d^2 + sqrt((a^2+c^2-b^2-d^2)^2 + 4(ab+cd)^2))/2)},\\; \\sigma_2 \\approx {=sqrt((a^2+b^2+c^2+d^2 - sqrt((a^2+c^2-b^2-d^2)^2 + 4(ab+cd)^2))/2)}", color: 1 },
          ],
          params: [
            { name: "a", min: -5, max: 5, step: 0.5, value: 3 },
            { name: "b", min: -5, max: 5, step: 0.5, value: 0 },
            { name: "c", min: -5, max: 5, step: 0.5, value: 4 },
            { name: "d", min: -5, max: 5, step: 0.5, value: 5 },
          ],
          caption: md`$A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$ applied to the unit circle. Every point is $A(\cos t, \sin t) = \cos t \, A\mathbf{e}_1 + \sin t \, A\mathbf{e}_2$. The images of the axis vectors are marked, and notice that they are usually *not* the axes of the ellipse. The label at the origin shows the lengths of the two semi-axes, $\sigma_1$ and $\sigma_2$, which we learn to compute next. Set $b = c = 0$ to see a plain stretch; set $a = d$ and $b = -c$ to see a rotation keep the circle round.`,
        },
        {
          kind: "text",
          body: md`The lengths of the ellipse's semi-axes are the two most important numbers about $A$. They say the most and the least that $A$ can stretch anything. To find them we look at lengths: $|A\mathbf{x}|^2 = (A\mathbf{x}) \cdot (A\mathbf{x}) = \mathbf{x}^{\mathsf T} A^{\mathsf T} A \mathbf{x}$. So the matrix that controls lengths is not $A$ but $A^{\mathsf T}A$.`,
        },
        {
          kind: "key",
          title: "Singular values",
          body: md`For any $m \times n$ matrix $A$, the matrix $A^{\mathsf T}A$ is $n \times n$, symmetric, and has eigenvalues $\lambda_1 \ge \lambda_2 \ge \cdots \ge \lambda_n \ge 0$. The **singular values** of $A$ are

$$\sigma_i = \sqrt{\lambda_i}, \qquad \sigma_1 \ge \sigma_2 \ge \cdots \ge 0.$$

For a $2 \times 2$ matrix, $\sigma_1$ and $\sigma_2$ are the semi-axes of the ellipse. In general $\sigma_1$ is the largest factor by which $A$ stretches any vector, and the number of nonzero singular values is the rank of $A$.`,
        },
        {
          kind: "why",
          title: "Why $A^{\mathsf T}A$ is symmetric with eigenvalues that are never negative",
          body: md`Symmetric: $(A^{\mathsf T}A)^{\mathsf T} = A^{\mathsf T}(A^{\mathsf T})^{\mathsf T} = A^{\mathsf T}A$, by the rule $(BC)^{\mathsf T} = C^{\mathsf T}B^{\mathsf T}$ from Unit 3. So the spectral theorem of Unit 7 applies: $A^{\mathsf T}A$ has real eigenvalues and an orthonormal basis of eigenvectors $\mathbf{v}_1, \ldots, \mathbf{v}_n$.

Never negative: let $\mathbf{v}$ be a unit eigenvector with $A^{\mathsf T}A\mathbf{v} = \lambda\mathbf{v}$. Then

$$|A\mathbf{v}|^2 = \mathbf{v}^{\mathsf T}A^{\mathsf T}A\mathbf{v} = \mathbf{v}^{\mathsf T}(\lambda\mathbf{v}) = \lambda\,|\mathbf{v}|^2 = \lambda.$$

A squared length can't be negative, so $\lambda \ge 0$, and the square root $\sigma = \sqrt{\lambda}$ makes sense. Better still, this line says exactly what $\sigma$ means: $\sigma = |A\mathbf{v}|$ is how much $A$ stretches the eigenvector $\mathbf{v}$.`,
        },
        {
          kind: "why",
          title: "Why the image of the unit circle is an ellipse with semi-axes $\sigma_1, \sigma_2$",
          body: md`Let $\mathbf{v}_1, \mathbf{v}_2$ be orthonormal eigenvectors of $A^{\mathsf T}A$ with eigenvalues $\lambda_1 \ge \lambda_2$. The key fact is that their images are perpendicular too:

$$(A\mathbf{v}_1) \cdot (A\mathbf{v}_2) = \mathbf{v}_1^{\mathsf T}A^{\mathsf T}A\mathbf{v}_2 = \mathbf{v}_1^{\mathsf T}(\lambda_2 \mathbf{v}_2) = \lambda_2\,(\mathbf{v}_1 \cdot \mathbf{v}_2) = 0.$$

Their lengths are $|A\mathbf{v}_1| = \sigma_1$ and $|A\mathbf{v}_2| = \sigma_2$ by the previous box. Now any unit vector is $\mathbf{x} = \cos t\,\mathbf{v}_1 + \sin t\,\mathbf{v}_2$ (coordinates in an orthonormal basis, Unit 6), so

$$A\mathbf{x} = \cos t\,(A\mathbf{v}_1) + \sin t\,(A\mathbf{v}_2).$$

That is $\cos t$ along one direction of length $\sigma_1$ plus $\sin t$ along a perpendicular direction of length $\sigma_2$: the parametric equation of an ellipse with those semi-axes. The directions $\mathbf{v}_1, \mathbf{v}_2$ are the special unit vectors that land *on* the axes of the ellipse. If $\sigma_2 = 0$ the ellipse collapses to a segment: $A$ has rank 1.`,
        },
        {
          kind: "example",
          title: "Singular values of a 2×2 matrix",
          problem: md`Find the singular values of $A = \begin{bmatrix} 3 & 0 \\ 4 & 5 \end{bmatrix}$.`,
          steps: [
            { math: md`A^{\mathsf T}A = \begin{bmatrix} 3 & 4 \\ 0 & 5 \end{bmatrix}\begin{bmatrix} 3 & 0 \\ 4 & 5 \end{bmatrix} = \begin{bmatrix} 25 & 20 \\ 20 & 25 \end{bmatrix}`, note: md`Each entry is a dot product of two columns of $A$: $(3, 4) \cdot (3, 4) = 25$, $(3, 4) \cdot (0, 5) = 20$, $(0, 5) \cdot (0, 5) = 25$. Symmetric, as promised.` },
            { math: md`\lambda^2 - 50\lambda + 225 = (\lambda - 45)(\lambda - 5) = 0`, note: md`Characteristic polynomial $\lambda^2 - (\text{trace})\lambda + \det$, with trace $50$ and determinant $625 - 400 = 225$.` },
            { math: md`\sigma_1 = \sqrt{45} = 3\sqrt5, \qquad \sigma_2 = \sqrt5`, note: md`Square roots, largest first. Check: $\sigma_1\sigma_2 = 15 = |\det A|$, and $\sigma_1^2 + \sigma_2^2 = 50 = 3^2 + 0^2 + 4^2 + 5^2$. Both are general facts; see below.` },
          ],
        },
        {
          kind: "key",
          title: "The singular value decomposition",
          body: md`Every $m \times n$ matrix $A$ can be written as

$$A = U\Sigma V^{\mathsf T}$$

where $V$ is an $n \times n$ orthogonal matrix (columns $\mathbf{v}_i$, the **right singular vectors**), $U$ is an $m \times m$ orthogonal matrix (columns $\mathbf{u}_i$, the **left singular vectors**), and $\Sigma$ is $m \times n$ with the singular values $\sigma_1 \ge \sigma_2 \ge \cdots$ down its diagonal and zeros elsewhere.

**How to build it.**
- $\mathbf{v}_i$: orthonormal eigenvectors of $A^{\mathsf T}A$, ordered by decreasing eigenvalue.
- $\sigma_i = \sqrt{\lambda_i}$.
- $\mathbf{u}_i = \dfrac{A\mathbf{v}_i}{\sigma_i}$ for each $\sigma_i \ne 0$ (then extend to an orthonormal basis if needed).

Column by column this says $A\mathbf{v}_i = \sigma_i\mathbf{u}_i$: $A$ sends the $i$-th right singular vector to $\sigma_i$ times the $i$-th left singular vector.`,
        },
        {
          kind: "proof",
          title: "The construction really gives A = UΣVᵀ",
          given: md`$A$ is $2 \times 2$; $\mathbf{v}_1, \mathbf{v}_2$ are orthonormal eigenvectors of $A^{\mathsf T}A$ with eigenvalues $\lambda_1 \ge \lambda_2 > 0$; $\sigma_i = \sqrt{\lambda_i}$ and $\mathbf{u}_i = A\mathbf{v}_i / \sigma_i$`,
          prove: md`$\mathbf{u}_1, \mathbf{u}_2$ are orthonormal and $A = U\Sigma V^{\mathsf T}$`,
          steps: [
            { statement: md`$(A\mathbf{v}_i) \cdot (A\mathbf{v}_j) = \mathbf{v}_i^{\mathsf T}A^{\mathsf T}A\mathbf{v}_j = \lambda_j\,(\mathbf{v}_i \cdot \mathbf{v}_j)$`, reason: md`$\mathbf{x} \cdot \mathbf{y} = \mathbf{x}^{\mathsf T}\mathbf{y}$, $(A\mathbf{x})^{\mathsf T} = \mathbf{x}^{\mathsf T}A^{\mathsf T}$, and $\mathbf{v}_j$ is an eigenvector` },
            { statement: md`$|A\mathbf{v}_i|^2 = \lambda_i$, so $|\mathbf{u}_i| = \dfrac{\sqrt{\lambda_i}}{\sigma_i} = 1$`, reason: md`Step 1 with $i = j$ and $\mathbf{v}_i \cdot \mathbf{v}_i = 1$` },
            { statement: md`$\mathbf{u}_1 \cdot \mathbf{u}_2 = \dfrac{\lambda_2 (\mathbf{v}_1 \cdot \mathbf{v}_2)}{\sigma_1\sigma_2} = 0$`, reason: md`Step 1 with $i \ne j$ and $\mathbf{v}_1 \cdot \mathbf{v}_2 = 0$` },
            { statement: md`$AV = \begin{bmatrix} A\mathbf{v}_1 & A\mathbf{v}_2 \end{bmatrix} = \begin{bmatrix} \sigma_1\mathbf{u}_1 & \sigma_2\mathbf{u}_2 \end{bmatrix} = U\Sigma$`, reason: md`A matrix times a matrix acts column by column (Unit 3); the definition of $\mathbf{u}_i$; and $U\Sigma$ scales column $i$ of $U$ by $\sigma_i$` },
            { statement: md`$V^{\mathsf T}V = I$, so $V^{-1} = V^{\mathsf T}$`, reason: md`The columns of $V$ are orthonormal: entry $(i, j)$ of $V^{\mathsf T}V$ is $\mathbf{v}_i \cdot \mathbf{v}_j$` },
            { statement: md`$A = AVV^{\mathsf T} = U\Sigma V^{\mathsf T}$`, reason: md`Multiply step 4 on the right by $V^{\mathsf T}$` },
          ],
        },
        {
          kind: "text",
          body: md`The proof covered the case where every $\sigma_i$ is positive. If some $\sigma_i = 0$, then $A\mathbf{v}_i = \mathbf{0}$ (its length is $\sigma_i$), so those columns of $AV$ are zero whatever $\mathbf{u}_i$ we choose; pick any unit vectors perpendicular to the $\mathbf{u}$'s already found. For an $m \times n$ matrix the same steps go through with $\Sigma$ an $m \times n$ rectangle of zeros carrying the singular values on its diagonal.`,
        },
        {
          kind: "example",
          title: "The full SVD",
          problem: md`Find an SVD of $A = \begin{bmatrix} 3 & 0 \\ 4 & 5 \end{bmatrix}$.`,
          steps: [
            { math: md`A^{\mathsf T}A = \begin{bmatrix} 25 & 20 \\ 20 & 25 \end{bmatrix}, \quad \lambda_1 = 45, \; \lambda_2 = 5, \quad \sigma_1 = 3\sqrt5, \; \sigma_2 = \sqrt5`, note: "From the previous example." },
            { math: md`(A^{\mathsf T}A - 45I)\mathbf{v} = \begin{bmatrix} -20 & 20 \\ 20 & -20 \end{bmatrix}\mathbf{v} = \mathbf{0} \;\Rightarrow\; \mathbf{v}_1 = \frac{1}{\sqrt2}\begin{bmatrix} 1 \\ 1 \end{bmatrix}`, note: md`The eigenvector for $\lambda_1$, made unit length.` },
            { math: md`\mathbf{v}_2 = \frac{1}{\sqrt2}\begin{bmatrix} 1 \\ -1 \end{bmatrix}`, note: md`Perpendicular to $\mathbf{v}_1$; check $(A^{\mathsf T}A)\mathbf{v}_2 = 5\mathbf{v}_2$. Together they form $V = \frac{1}{\sqrt2}\begin{bmatrix} 1 & 1 \\ 1 & -1 \end{bmatrix}$.` },
            { math: md`A\mathbf{v}_1 = \frac{1}{\sqrt2}\begin{bmatrix} 3 \\ 9 \end{bmatrix}, \qquad \mathbf{u}_1 = \frac{A\mathbf{v}_1}{\sigma_1} = \frac{1}{\sqrt2 \cdot 3\sqrt5}\begin{bmatrix} 3 \\ 9 \end{bmatrix} = \frac{1}{\sqrt{10}}\begin{bmatrix} 1 \\ 3 \end{bmatrix}`, note: md`$|A\mathbf{v}_1| = \sqrt{90/2} = \sqrt{45} = \sigma_1$, as it must be.` },
            { math: md`A\mathbf{v}_2 = \frac{1}{\sqrt2}\begin{bmatrix} 3 \\ -1 \end{bmatrix}, \qquad \mathbf{u}_2 = \frac{A\mathbf{v}_2}{\sigma_2} = \frac{1}{\sqrt{10}}\begin{bmatrix} 3 \\ -1 \end{bmatrix}`, note: md`$\mathbf{u}_1 \cdot \mathbf{u}_2 = \frac{3 - 3}{10} = 0$: perpendicular, with no extra work, exactly as the proof predicted.` },
            { math: md`A = \underbrace{\frac{1}{\sqrt{10}}\begin{bmatrix} 1 & 3 \\ 3 & -1 \end{bmatrix}}_{U}\;\underbrace{\begin{bmatrix} 3\sqrt5 & 0 \\ 0 & \sqrt5 \end{bmatrix}}_{\Sigma}\;\underbrace{\frac{1}{\sqrt2}\begin{bmatrix} 1 & 1 \\ 1 & -1 \end{bmatrix}}_{V^{\mathsf T}}`, note: md`Multiply it out to check: $\Sigma V^{\mathsf T} = \frac{1}{\sqrt2}\begin{bmatrix} 3\sqrt5 & 3\sqrt5 \\ \sqrt5 & -\sqrt5 \end{bmatrix}$, then $U$ times that is $\frac{1}{\sqrt{20}}\begin{bmatrix} 6\sqrt5 & 0 \\ 8\sqrt5 & 10\sqrt5 \end{bmatrix} = \begin{bmatrix} 3 & 0 \\ 4 & 5 \end{bmatrix}$.` },
          ],
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-7, 7],
          parametric: [
            { x: "cos(t)", y: "sin(t)", t: [0, 6.2832], label: "\\text{unit circle}", color: 3, dashed: true },
            { x: "3cos(t)", y: "4cos(t) + 5sin(t)", t: [0, 6.2832], label: "\\text{its image under } A", color: 1 },
          ],
          points: [
            { x: "1/sqrt(2)", y: "1/sqrt(2)", label: "\\mathbf{v}_1", color: 3 },
            { x: "1/sqrt(2)", y: "-1/sqrt(2)", label: "\\mathbf{v}_2", color: 3 },
            { x: "3/sqrt(2)", y: "9/sqrt(2)", label: "A\\mathbf{v}_1 = \\sigma_1\\mathbf{u}_1", color: 2 },
            { x: "3/sqrt(2)", y: "-1/sqrt(2)", label: "A\\mathbf{v}_2 = \\sigma_2\\mathbf{u}_2", color: 2 },
          ],
          caption: md`The right singular vectors $\mathbf{v}_1, \mathbf{v}_2$ sit on the unit circle at $45°$. Their images land on the axes of the ellipse, at distances $\sigma_1 = 3\sqrt5 \approx 6.7$ and $\sigma_2 = \sqrt5 \approx 2.2$ from the origin, in the perpendicular directions $\mathbf{u}_1, \mathbf{u}_2$.`,
        },
        {
          kind: "text",
          body: md`**Reading $A = U\Sigma V^{\mathsf T}$ as three moves.** Apply it to a vector from right to left.

- $V^{\mathsf T}$ is orthogonal, so it preserves lengths and angles: a rotation or reflection. It turns $\mathbf{v}_1$ into $\mathbf{e}_1$ and $\mathbf{v}_2$ into $\mathbf{e}_2$ (because $V^{\mathsf T}\mathbf{v}_i$ has entries $\mathbf{v}_j \cdot \mathbf{v}_i$).
- $\Sigma$ stretches the first axis by $\sigma_1$ and the second by $\sigma_2$. This is where the circle becomes an ellipse.
- $U$ is orthogonal again: it turns the axes to point along $\mathbf{u}_1$ and $\mathbf{u}_2$.

So every linear map, however lopsided, is *rotate, stretch along perpendicular axes, rotate*. Eigenvalues ask "which directions stay put?", and some matrices have no good answer. Singular values ask "which perpendicular directions map to perpendicular directions?", and every matrix has an answer.`,
        },
        {
          kind: "why",
          title: "Why $\sigma_1\sigma_2 = |\det A|$, why $\sigma_1$ is the biggest stretch, and how this differs from eigenvalues",
          body: md`**Product.** $\det(A^{\mathsf T}A) = \det(A^{\mathsf T})\det(A) = (\det A)^2$ by Unit 4. The determinant of $A^{\mathsf T}A$ is also the product of its eigenvalues, $\lambda_1\lambda_2 = \sigma_1^2\sigma_2^2$. So $\sigma_1\sigma_2 = |\det A|$: the ellipse's area $\pi\sigma_1\sigma_2$ is $|\det A|$ times the circle's area $\pi$, which is exactly what the determinant measures.

**Biggest stretch.** Write a unit vector as $\mathbf{x} = c_1\mathbf{v}_1 + c_2\mathbf{v}_2$ with $c_1^2 + c_2^2 = 1$. Since $A\mathbf{v}_1 \perp A\mathbf{v}_2$, Pythagoras gives
$$|A\mathbf{x}|^2 = c_1^2\sigma_1^2 + c_2^2\sigma_2^2 \le (c_1^2 + c_2^2)\sigma_1^2 = \sigma_1^2.$$
So $|A\mathbf{x}| \le \sigma_1|\mathbf{x}|$ for every $\mathbf{x}$, with equality along $\mathbf{v}_1$. Likewise $|A\mathbf{x}| \ge \sigma_2|\mathbf{x}|$.

**Not eigenvalues.** $A = \begin{bmatrix} 0 & 1 \\ 0 & 0 \end{bmatrix}$ has both eigenvalues $0$, but it is not the zero map: it sends $\mathbf{e}_2$ to $\mathbf{e}_1$. Its $A^{\mathsf T}A = \begin{bmatrix} 0 & 0 \\ 0 & 1 \end{bmatrix}$ has eigenvalues $1, 0$, so its singular values are $1$ and $0$. Singular values measure size; eigenvalues measure fixed directions. For a symmetric matrix with nonnegative eigenvalues the two agree, because then $A^{\mathsf T}A = A^2$ has eigenvalues $\lambda_i^2$. For a symmetric matrix with negative eigenvalues, $\sigma_i = |\lambda_i|$.`,
        },
        {
          kind: "check",
          prompt: md`Find the singular values of $\begin{bmatrix} 2 & 0 \\ 0 & -3 \end{bmatrix}$. Separate them with commas, largest first.`,
          answer: "3, 2",
          form: "set",
          simplified: true,
          explain: md`$A^{\mathsf T}A = \begin{bmatrix} 4 & 0 \\ 0 & 9 \end{bmatrix}$ has eigenvalues $9$ and $4$, so $\sigma_1 = 3$, $\sigma_2 = 2$. The eigenvalues of $A$ are $2$ and $-3$; the singular values are their absolute values, because a flip doesn't change a length.`,
        },
        {
          kind: "check",
          prompt: md`Find the singular values of $\begin{bmatrix} 1 & 2 \\ 2 & 4 \end{bmatrix}$. Separate them with commas, largest first.`,
          answer: "5, 0",
          form: "set",
          simplified: true,
          explain: md`$A^{\mathsf T}A = \begin{bmatrix} 5 & 10 \\ 10 & 20 \end{bmatrix}$ has trace $25$ and determinant $0$, so $\lambda^2 - 25\lambda = 0$ gives $\lambda = 25, 0$ and $\sigma = 5, 0$. The second column is twice the first, the rank is 1, and the ellipse is a flat segment of half-length 5. Also $\sigma_1^2 = 25 = 1 + 4 + 4 + 16$.`,
        },
      ],
      practice: [singularValues, leftSingularVector, singularFacts],
    },
    {
      id: slug("Low-rank approximation"),
      title: "Low-rank approximation",
      summary: "The SVD writes a matrix as a sum of rank-1 pieces in order of importance. Keeping the first few gives the best possible approximation of lower rank, which is how images and data get compressed.",
      blocks: [
        {
          kind: "text",
          body: md`$A = U\Sigma V^{\mathsf T}$ looks like three matrices. There is a second way to read it that looks like a list: a sum of simple pieces, each weighted by one singular value. Big singular values come first. Cut the list short and you get a smaller matrix that is almost $A$. This lesson is about why "almost" is as good as it can possibly be.`,
        },
        {
          kind: "key",
          title: "Rank-1 matrices and the outer product",
          body: md`The **outer product** of a column $\mathbf{u}$ (in $\mathbb{R}^m$) and a column $\mathbf{v}$ (in $\mathbb{R}^n$) is the $m \times n$ matrix $\mathbf{u}\mathbf{v}^{\mathsf T}$, with entry $(i, j)$ equal to $u_i v_j$:

$$\begin{bmatrix} 1 \\ 3 \end{bmatrix}\begin{bmatrix} 2 & 5 \end{bmatrix} = \begin{bmatrix} 2 & 5 \\ 6 & 15 \end{bmatrix}.$$

Every column of $\mathbf{u}\mathbf{v}^{\mathsf T}$ is a multiple of $\mathbf{u}$ (column $j$ is $v_j\mathbf{u}$) and every row is a multiple of $\mathbf{v}^{\mathsf T}$. So its column space is the line through $\mathbf{u}$: it has **rank 1**. Conversely every rank-1 matrix is an outer product. A rank-1 $m \times n$ matrix is described by $m + n$ numbers instead of $mn$.`,
        },
        {
          kind: "why",
          title: "Why $A = \sigma_1\mathbf{u}_1\mathbf{v}_1^{\mathsf T} + \sigma_2\mathbf{u}_2\mathbf{v}_2^{\mathsf T} + \cdots$",
          body: md`Multiply $U\Sigma V^{\mathsf T}$ from the inside out. $\Sigma V^{\mathsf T}$ scales the rows of $V^{\mathsf T}$: its $i$-th row is $\sigma_i\mathbf{v}_i^{\mathsf T}$. Then $U(\Sigma V^{\mathsf T})$ is a product of a matrix with columns $\mathbf{u}_i$ and a matrix with rows $\sigma_i\mathbf{v}_i^{\mathsf T}$. A product of matrices is the sum over $i$ of (column $i$ of the left) times (row $i$ of the right): that is just the row-column rule of Unit 3 with the sum over $i$ pulled outside. Hence

$$A = \sum_i \mathbf{u}_i\,(\sigma_i\mathbf{v}_i^{\mathsf T}) = \sigma_1\mathbf{u}_1\mathbf{v}_1^{\mathsf T} + \sigma_2\mathbf{u}_2\mathbf{v}_2^{\mathsf T} + \cdots + \sigma_r\mathbf{u}_r\mathbf{v}_r^{\mathsf T},$$

where $r$ is the rank, because pieces with $\sigma_i = 0$ contribute nothing. Each piece is a rank-1 matrix of "size" $\sigma_i$, and the pieces come sorted from largest to smallest. A matrix of rank $r$ is a sum of $r$ rank-1 pieces, and no fewer, since each piece adds at most one dimension to the column space.`,
        },
        {
          kind: "example",
          title: "A matrix as a sum of two pieces",
          problem: md`Split $A = \begin{bmatrix} 3 & 0 \\ 4 & 5 \end{bmatrix}$ into its rank-1 pieces, using the SVD from the last lesson.`,
          steps: [
            { math: md`\sigma_1 = 3\sqrt5, \; \mathbf{u}_1 = \tfrac{1}{\sqrt{10}}\begin{bmatrix} 1 \\ 3 \end{bmatrix}, \; \mathbf{v}_1 = \tfrac{1}{\sqrt2}\begin{bmatrix} 1 \\ 1 \end{bmatrix}; \qquad \sigma_2 = \sqrt5, \; \mathbf{u}_2 = \tfrac{1}{\sqrt{10}}\begin{bmatrix} 3 \\ -1 \end{bmatrix}, \; \mathbf{v}_2 = \tfrac{1}{\sqrt2}\begin{bmatrix} 1 \\ -1 \end{bmatrix}`, note: "The ingredients found last lesson." },
            { math: md`\sigma_1\mathbf{u}_1\mathbf{v}_1^{\mathsf T} = \frac{3\sqrt5}{\sqrt{10}\sqrt2}\begin{bmatrix} 1 \\ 3 \end{bmatrix}\begin{bmatrix} 1 & 1 \end{bmatrix} = \frac32\begin{bmatrix} 1 & 1 \\ 3 & 3 \end{bmatrix} = \begin{bmatrix} 1.5 & 1.5 \\ 4.5 & 4.5 \end{bmatrix}`, note: md`$\sqrt{10}\sqrt2 = \sqrt{20} = 2\sqrt5$, so the scalar is $\frac{3\sqrt5}{2\sqrt5} = \frac32$. Both rows are multiples of $(1, 1)$: rank 1.` },
            { math: md`\sigma_2\mathbf{u}_2\mathbf{v}_2^{\mathsf T} = \frac{\sqrt5}{2\sqrt5}\begin{bmatrix} 3 \\ -1 \end{bmatrix}\begin{bmatrix} 1 & -1 \end{bmatrix} = \begin{bmatrix} 1.5 & -1.5 \\ -0.5 & 0.5 \end{bmatrix}`, note: "The second, smaller piece." },
            { math: md`\begin{bmatrix} 1.5 & 1.5 \\ 4.5 & 4.5 \end{bmatrix} + \begin{bmatrix} 1.5 & -1.5 \\ -0.5 & 0.5 \end{bmatrix} = \begin{bmatrix} 3 & 0 \\ 4 & 5 \end{bmatrix} = A`, note: "They add back up to A. The first piece carries most of A; the second is a correction." },
          ],
        },
        {
          kind: "text",
          body: md`To say "most of $A$" we need a way to measure the size of a matrix, and the natural one treats the matrix as a long list of numbers.`,
        },
        {
          kind: "key",
          title: "The Frobenius norm",
          body: md`The **Frobenius norm** of a matrix is the square root of the sum of the squares of all its entries, as if the matrix were one long vector:

$$\|A\|_F = \sqrt{\sum_{i, j} a_{ij}^2}.$$

It can be read off the singular values too:

$$\|A\|_F^2 = \sigma_1^2 + \sigma_2^2 + \cdots + \sigma_r^2.$$

For a rank-1 piece built from unit vectors, $\|\sigma\mathbf{u}\mathbf{v}^{\mathsf T}\|_F = \sigma$.`,
        },
        {
          kind: "why",
          title: "Why $\|A\|_F^2$ is the sum of the squared singular values",
          body: md`The sum of the squares of the entries of $A$ is the sum of $|\text{column}_j|^2$ over the columns. But $|\text{column}_j|^2$ is entry $(j, j)$ of $A^{\mathsf T}A$ (column $j$ dotted with itself). So

$$\|A\|_F^2 = \operatorname{trace}(A^{\mathsf T}A),$$

the sum of the diagonal entries. For a $2 \times 2$ matrix the characteristic polynomial is $\lambda^2 - (\text{trace})\lambda + \det$, and factoring it as $(\lambda - \lambda_1)(\lambda - \lambda_2) = \lambda^2 - (\lambda_1 + \lambda_2)\lambda + \lambda_1\lambda_2$ shows the trace is $\lambda_1 + \lambda_2$. (The same holds for any size: the trace is the sum of the eigenvalues, from the $\lambda^{n-1}$ coefficient.) With $\lambda_i = \sigma_i^2$ for $A^{\mathsf T}A$,

$$\|A\|_F^2 = \lambda_1 + \lambda_2 = \sigma_1^2 + \sigma_2^2.$$

For the rank-1 piece: entry $(i, j)$ of $\sigma\mathbf{u}\mathbf{v}^{\mathsf T}$ is $\sigma u_i v_j$, so the sum of squares is $\sigma^2\left(\sum_i u_i^2\right)\left(\sum_j v_j^2\right) = \sigma^2 \cdot 1 \cdot 1$.

Check on the example: $3^2 + 0^2 + 4^2 + 5^2 = 50 = 45 + 5$.`,
        },
        {
          kind: "key",
          title: "Best low-rank approximation (Eckart–Young theorem)",
          body: md`Let $A = \sigma_1\mathbf{u}_1\mathbf{v}_1^{\mathsf T} + \cdots + \sigma_r\mathbf{u}_r\mathbf{v}_r^{\mathsf T}$ and keep only the first $k$ pieces:

$$A_k = \sigma_1\mathbf{u}_1\mathbf{v}_1^{\mathsf T} + \cdots + \sigma_k\mathbf{u}_k\mathbf{v}_k^{\mathsf T}.$$

Then $A_k$ has rank $k$, and among **all** matrices of rank at most $k$ it is the closest to $A$:

$$\|A - A_k\|_F = \sqrt{\sigma_{k+1}^2 + \cdots + \sigma_r^2} \le \|A - B\|_F \quad \text{for every } B \text{ of rank} \le k.$$

The same $A_k$ also wins when distance is measured by the largest stretch, with $\|A - A_k\| = \sigma_{k+1}$. We state the "no $B$ does better" part without proof; the error formula is proved below.`,
        },
        {
          kind: "proof",
          title: "The error of dropping the last piece",
          given: md`$A = \sigma_1\mathbf{u}_1\mathbf{v}_1^{\mathsf T} + \sigma_2\mathbf{u}_2\mathbf{v}_2^{\mathsf T}$ with $\mathbf{u}_1, \mathbf{u}_2$ orthonormal and $\mathbf{v}_1, \mathbf{v}_2$ orthonormal; $A_1 = \sigma_1\mathbf{u}_1\mathbf{v}_1^{\mathsf T}$`,
          prove: md`$\|A - A_1\|_F = \sigma_2$ and $\|A\|_F^2 = \|A_1\|_F^2 + \|A - A_1\|_F^2$`,
          steps: [
            { statement: md`$A - A_1 = \sigma_2\mathbf{u}_2\mathbf{v}_2^{\mathsf T}$`, reason: "Subtract the first piece from the sum" },
            { statement: md`$\|A - A_1\|_F^2 = \sum_{i,j} (\sigma_2 u_{2i} v_{2j})^2 = \sigma_2^2 \left(\sum_i u_{2i}^2\right)\left(\sum_j v_{2j}^2\right) = \sigma_2^2$`, reason: md`Entry $(i, j)$ of an outer product is $u_i v_j$; the double sum factors; $|\mathbf{u}_2| = |\mathbf{v}_2| = 1$` },
            { statement: md`$\|A_1\|_F^2 = \sigma_1^2$`, reason: "The same computation for the first piece" },
            { statement: md`$\|A\|_F^2 = \sigma_1^2 + \sigma_2^2 = \|A_1\|_F^2 + \|A - A_1\|_F^2$`, reason: "The Frobenius norm formula from the key box above, then steps 2 and 3" },
          ],
        },
        {
          kind: "text",
          body: md`The last line is Pythagoras for matrices: the kept piece and the dropped piece are perpendicular, and their squared sizes add up to the whole. With more pieces the argument is identical, because $\sigma_i\mathbf{u}_i\mathbf{v}_i^{\mathsf T}$ and $\sigma_j\mathbf{u}_j\mathbf{v}_j^{\mathsf T}$ have zero "dot product" (sum of products of matching entries) when $i \ne j$: that sum factors as $\sigma_i\sigma_j(\mathbf{u}_i \cdot \mathbf{u}_j)(\mathbf{v}_i \cdot \mathbf{v}_j) = 0$. So dropping pieces $k+1, \ldots, r$ costs exactly $\sqrt{\sigma_{k+1}^2 + \cdots + \sigma_r^2}$, and keeping them in order of size drops as little as possible.

Geometrically, $A_1$ keeps the long axis of the ellipse and flattens the short one.`,
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-7, 7],
          parametric: [
            { x: "cos(t)", y: "sin(t)", t: [0, 6.2832], label: "\\text{unit circle}", color: 3, dashed: true },
            { x: "3cos(t)", y: "4cos(t) + 5sin(t)", t: [0, 6.2832], label: "A", color: 3, dashed: true },
            { x: "(1.5 + 1.5k) cos(t) + (1.5 - 1.5k) sin(t)", y: "(4.5 - 0.5k) cos(t) + (4.5 + 0.5k) sin(t)", t: [0, 6.2832], label: "A_1 + k(A - A_1)", color: 1 },
          ],
          points: [
            { x: "3/sqrt(2)", y: "9/sqrt(2)", label: "\\sigma_1\\mathbf{u}_1", color: 2 },
            { x: "3/sqrt(2)", y: "-1/sqrt(2)", label: "\\sigma_2\\mathbf{u}_2", color: 2 },
          ],
          params: [{ name: "k", min: 0, max: 1, step: 0.05, value: 1 }],
          caption: md`The image of the unit circle under $A_1 + k(A - A_1)$ for $A = \begin{bmatrix} 3 & 0 \\ 4 & 5 \end{bmatrix}$. At $k = 1$ it is the ellipse of $A$. Slide $k$ to $0$: the short axis shrinks to nothing and the ellipse collapses onto the long axis, the segment from $-\sigma_1\mathbf{u}_1$ to $\sigma_1\mathbf{u}_1$. That flat picture is the rank-1 matrix $A_1$. Everything $A$ did along $\mathbf{u}_1$ is kept; only the $\sigma_2$ stretch is lost.`,
        },
        {
          kind: "example",
          title: "Best rank-1 approximation",
          problem: md`Find the best rank-1 approximation of $A = \begin{bmatrix} 3 & 0 \\ 4 & 5 \end{bmatrix}$ and its error.`,
          steps: [
            { math: md`A_1 = \sigma_1\mathbf{u}_1\mathbf{v}_1^{\mathsf T} = \begin{bmatrix} 1.5 & 1.5 \\ 4.5 & 4.5 \end{bmatrix}`, note: "The first piece from the earlier example." },
            { math: md`A_1 = (A\mathbf{v}_1)\mathbf{v}_1^{\mathsf T} = \frac{1}{\sqrt2}\begin{bmatrix} 3 \\ 9 \end{bmatrix}\cdot\frac{1}{\sqrt2}\begin{bmatrix} 1 & 1 \end{bmatrix} = \frac12\begin{bmatrix} 3 & 3 \\ 9 & 9 \end{bmatrix}`, note: md`A shortcut worth knowing: since $\sigma_1\mathbf{u}_1 = A\mathbf{v}_1$, you never need $\sigma_1$ or $\mathbf{u}_1$ separately. $A_1 = A(\mathbf{v}_1\mathbf{v}_1^{\mathsf T})$ is $A$ applied after projecting onto the line of $\mathbf{v}_1$ (Unit 6), which is why the entries come out rational.` },
            { math: md`A - A_1 = \begin{bmatrix} 1.5 & -1.5 \\ -0.5 & 0.5 \end{bmatrix}, \qquad \|A - A_1\|_F = \sqrt{2.25 + 2.25 + 0.25 + 0.25} = \sqrt5 = \sigma_2`, note: md`The error is exactly the dropped singular value. No matrix of rank 1 comes closer to $A$ than this.` },
          ],
        },
        {
          kind: "key",
          title: "Compression: what a rank-$k$ approximation costs to store",
          body: md`An $m \times n$ matrix has $mn$ entries. Its rank-$k$ approximation $A_k$ is determined by $k$ singular values, $k$ vectors $\mathbf{u}_i$ of length $m$ and $k$ vectors $\mathbf{v}_i$ of length $n$:

$$k(m + n + 1) \text{ numbers instead of } mn.$$

When the singular values fall off quickly, a small $k$ keeps most of $\|A\|_F^2$ (the fraction kept is $\frac{\sigma_1^2 + \cdots + \sigma_k^2}{\sigma_1^2 + \cdots + \sigma_r^2}$) at a fraction of the storage. A photograph, a table of ratings, a word-document matrix: all have singular values that decay fast, because their rows are far from independent.`,
        },
        {
          kind: "contour",
          x: [0, 6.2832],
          y: [0, 6.2832],
          expr: "(2 + sin(x))(2 + cos(y)) + k (cos(2x))(sin(2y))",
          levels: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          params: [{ name: "k", min: 0, max: 3, step: 0.25, value: 3 }],
          caption: md`A picture as a matrix: think of the height at each grid point as the brightness of a pixel. At $k = 0$ the picture is $f(x)\,g(y)$, a single rank-1 piece: every row is a multiple of one row, so the pattern is a plain grid of light and dark bands. Slide $k$ up to add a second rank-1 piece; the picture gains detail. Compressing an image runs this backwards: drop the small pieces and keep the bands that carry most of the brightness.`,
        },
        {
          kind: "example",
          title: "Compressing an image",
          problem: md`A $1000 \times 800$ grayscale photo is stored as its best rank-20 approximation. How many numbers are stored, and what fraction of the original?`,
          steps: [
            { math: md`20(1000 + 800 + 1) = 20 \cdot 1801 = 36{,}020`, note: md`Each of the 20 pieces needs $\sigma_i$, a $\mathbf{u}_i$ with 1000 entries and a $\mathbf{v}_i$ with 800 entries.` },
            { math: md`\frac{36{,}020}{800{,}000} \approx 0.045`, note: md`About $4.5\%$ of the storage. For a typical photo the singular values past the 20th are small, so the error $\sqrt{\sigma_{21}^2 + \cdots}$ is a faint blur, not a different picture.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the Frobenius norm of $\begin{bmatrix} 1 & 2 \\ 2 & 1 \end{bmatrix}$ in exact form (like sqrt(5)).`,
          answer: "sqrt(10)",
          simplified: true,
          explain: md`$1 + 4 + 4 + 1 = 10$, so $\|A\|_F = \sqrt{10}$. Through the singular values: this symmetric matrix has eigenvalues $3$ and $-1$, so $\sigma_1 = 3$, $\sigma_2 = 1$, and $\sigma_1^2 + \sigma_2^2 = 10$ agrees.`,
        },
        {
          kind: "check",
          prompt: md`Find the best rank-1 approximation of $\begin{bmatrix} 2 & 0 \\ 0 & -1 \end{bmatrix}$. Type it row by row, like [[1, 2], [3, 4]].`,
          answer: "[[2, 0], [0, 0]]",
          form: "matrix",
          explain: md`$A^{\mathsf T}A = \begin{bmatrix} 4 & 0 \\ 0 & 1 \end{bmatrix}$, so $\sigma_1 = 2$ with $\mathbf{v}_1 = \mathbf{e}_1$, and $A\mathbf{v}_1 = 2\mathbf{e}_1$. Then $A_1 = (A\mathbf{v}_1)\mathbf{v}_1^{\mathsf T} = 2\mathbf{e}_1\mathbf{e}_1^{\mathsf T} = \begin{bmatrix} 2 & 0 \\ 0 & 0 \end{bmatrix}$. The error is $\sigma_2 = 1$: the dropped entry.`,
        },
      ],
      practice: [frobeniusAndError, rankOneApproximation, compression],
    },
  ],
};
