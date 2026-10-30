import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import type { Rng } from "../../math/random";
import { md, slug, type Block, type Generator, type Step, type Unit } from "../types";

// ── Vector helpers ──────────────────────────────────────────────────────────

type V = [number, number, number];

/** A vector in LaTeX: ⟨1, -2, 3⟩. */
const vt = (v: V) => `\\langle ${v[0]}, ${v[1]}, ${v[2]} \\rangle`;
/** A point in LaTeX, and also the typed form of a tuple answer. */
const pt = (p: V) => `(${p[0]}, ${p[1]}, ${p[2]})`;
const dot = (u: V, v: V) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const sub = (u: V, v: V): V => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
const add = (u: V, v: V): V => [u[0] + v[0], u[1] + v[1], u[2] + v[2]];
const scale = (k: number, v: V): V => [k * v[0], k * v[1], k * v[2]];
const cross = (u: V, v: V): V => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const norm2 = (v: V) => dot(v, v);
const isZero = (v: V) => v.every((x) => x === 0);
/** The determinant with rows a, b, c by Sarrus' rule: a different route from the cofactor expansion the cross product uses. */
const sarrus = (a: V, b: V, c: V) =>
  a[0] * b[1] * c[2] + a[1] * b[2] * c[0] + a[2] * b[0] * c[1] - a[2] * b[1] * c[0] - a[0] * b[2] * c[1] - a[1] * b[0] * c[2];

function rvec(r: Rng, lo: number, hi: number): V {
  for (;;) {
    const v: V = [r.int(lo, hi), r.int(lo, hi), r.int(lo, hi)];
    if (!isZero(v)) return v;
  }
}

/** n = k² m with m square-free. */
function squareFree(n: number): [number, number] {
  let k = 1;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    while (m % (p * p) === 0) {
      m /= p * p;
      k *= p;
    }
  }
  return [k, m];
}

/** sqrt(n) as typed-answer text: "5", "sqrt(14)", "3 sqrt(2)". */
function rootText(n: number): string {
  const [k, m] = squareFree(n);
  if (m === 1) return String(k);
  return k === 1 ? `sqrt(${m})` : `${k} sqrt(${m})`;
}

/** sqrt(n) as LaTeX. */
function rootTex(n: number): string {
  const [k, m] = squareFree(n);
  if (m === 1) return String(k);
  return k === 1 ? `\\sqrt{${m}}` : `${k}\\sqrt{${m}}`;
}

/** sqrt(n)/2 as typed text, reduced. */
function halfRootText(n: number): string {
  const [k, m] = squareFree(n);
  if (m === 1) return frac(k, 2);
  if (k % 2 === 0) return k === 2 ? `sqrt(${m})` : `${k / 2} sqrt(${m})`;
  return k === 1 ? `sqrt(${m})/2` : `${k} sqrt(${m})/2`;
}

function halfRootTex(n: number): string {
  const [k, m] = squareFree(n);
  if (m === 1) return fracTex(k, 2);
  if (k % 2 === 0) return k === 2 ? `\\sqrt{${m}}` : `${k / 2}\\sqrt{${m}}`;
  return `\\frac{${k === 1 ? "" : k}\\sqrt{${m}}}{2}`;
}

/** (a)(b) + (c)(d) + (e)(f): a dot product written out. */
const dotTex = (u: V, v: V) => `(${u[0]})(${v[0]}) + (${u[1]})(${v[1]}) + (${u[2]})(${v[2]})`;
/** (q - p)^2 for the three coordinates. */
const diffSqTex = (p: V, q: V) => `(${q[0]} - ${paren(p[0])})^2 + (${q[1]} - ${paren(p[1])})^2 + (${q[2]} - ${paren(p[2])})^2`;
const sq = (x: number) => `(${x})^2`;

/** The cofactor expansion of det[u; v; w] as typed text, for verify equations. `k` may stand in for a component. */
function detText(u: (number | string)[], v: (number | string)[], w: (number | string)[]): string {
  const p = (x: number | string) => (typeof x === "number" ? paren(x) : x);
  return `${p(u[0]!)}*(${p(v[1]!)}*${p(w[2]!)} - ${p(v[2]!)}*${p(w[1]!)}) - ${p(u[1]!)}*(${p(v[0]!)}*${p(w[2]!)} - ${p(v[2]!)}*${p(w[0]!)}) + ${p(u[2]!)}*(${p(v[0]!)}*${p(w[1]!)} - ${p(v[1]!)}*${p(w[0]!)})`;
}

/**
 * One verify equation saying (a, b, c) - P is parallel to d: their cross product is the zero vector,
 * written as the sum of the squares of its components (each verify equation must involve all three unknowns).
 */
function parallelEqs(P: V, d: V): string[] {
  const [p1, p2, p3] = P;
  const [d1, d2, d3] = d;
  const x = `((b - ${paren(p2)})*${paren(d3)} - (c - ${paren(p3)})*${paren(d2)})`;
  const y = `((c - ${paren(p3)})*${paren(d1)} - (a - ${paren(p1)})*${paren(d3)})`;
  const z = `((a - ${paren(p1)})*${paren(d2)} - (b - ${paren(p2)})*${paren(d1)})`;
  return [`${x}^2 + ${y}^2 + ${z}^2 = 0`];
}

/** a·x + b·y + c·z as LaTeX, e.g. "2x - y + 3z". */
const planeLhs = (n: V) => poly([[n[0], "x"], [n[1], "y"], [n[2], "z"]]);

/** A rounded value is safe to ask for when it isn't within 0.03 of a rounding boundary. */
function safeRound(value: number, places: number): boolean {
  const f = (value * 10 ** places) % 1;
  return Math.abs(f - 0.5) > 0.03;
}

/** The 3x3 determinant in LaTeX with i, j, k on top. */
const detTex = (u: V, v: V) => `\\begin{vmatrix} \\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\ ${u[0]} & ${u[1]} & ${u[2]} \\\\ ${v[0]} & ${v[1]} & ${v[2]} \\end{vmatrix}`;
const det3Tex = (u: V, v: V, w: V) => `\\begin{vmatrix} ${u[0]} & ${u[1]} & ${u[2]} \\\\ ${v[0]} & ${v[1]} & ${v[2]} \\\\ ${w[0]} & ${w[1]} & ${w[2]} \\end{vmatrix}`;

/** The three 2x2 minors of a cross product, written out with numbers. */
const minorsTex = (u: V, v: V) =>
  `\\big((${u[1]})(${v[2]}) - (${u[2]})(${v[1]})\\big)\\mathbf{i} - \\big((${u[0]})(${v[2]}) - (${u[2]})(${v[0]})\\big)\\mathbf{j} + \\big((${u[0]})(${v[1]}) - (${u[1]})(${v[0]})\\big)\\mathbf{k}`;

// ── Lesson 1 generators: coordinates ────────────────────────────────────────

const TRIPLES: V[] = [
  [1, 2, 2],
  [2, 3, 6],
  [3, 4, 12],
  [1, 4, 8],
  [4, 4, 7],
  [2, 6, 9],
  [6, 6, 7],
  [3, 6, 2],
  [2, 10, 11],
];

const distanceInSpace: Generator = (r) => {
  const kind = r.int(0, 2);
  let P: V;
  let Q: V;
  if (kind === 2) {
    // A Pythagorean quadruple, so the distance is a whole number.
    const t = r.pick(TRIPLES);
    const order = r.pick([
      [0, 1, 2],
      [1, 2, 0],
      [2, 0, 1],
      [0, 2, 1],
    ]);
    const d: V = [r.sign() * t[order[0]!]!, r.sign() * t[order[1]!]!, r.sign() * t[order[2]!]!];
    P = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
    Q = add(P, d);
  } else if (kind === 1) {
    P = [0, 0, 0];
    Q = rvec(r, -6, 6);
    while (Q.filter((x) => x === 0).length > 1) Q = rvec(r, -6, 6);
  } else {
    P = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
    do Q = [r.int(-6, 6), r.int(-6, 6), r.int(-6, 6)];
    while (sub(Q, P).some((x) => x === 0));
  }
  const d = sub(Q, P);
  const N = norm2(d);
  const steps: Step[] =
    kind === 1
      ? [
          { math: md`d = \sqrt{${sq(Q[0])} + ${sq(Q[1])} + ${sq(Q[2])}}`, note: md`The distance from the origin to $(x, y, z)$ is $\sqrt{x^2 + y^2 + z^2}$: the distance formula with $(0, 0, 0)$ as the other point.` },
          { math: md`= \sqrt{${d[0] ** 2} + ${d[1] ** 2} + ${d[2] ** 2}} = \sqrt{${N}}`, note: "Square each coordinate and add." },
        ]
      : [
          { math: md`d = \sqrt{${diffSqTex(P, Q)}}`, note: "Subtract matching coordinates, then square each difference." },
          { math: md`= \sqrt{${sq(d[0])} + ${sq(d[1])} + ${sq(d[2])}} = \sqrt{${d[0] ** 2} + ${d[1] ** 2} + ${d[2] ** 2}}`, note: "The order of subtraction doesn't matter, because the differences get squared." },
          { math: md`= \sqrt{${N}}`, note: "" },
        ];
  if (rootTex(N) !== `\\sqrt{${N}}`) steps.push({ math: md`= ${rootTex(N)}`, note: squareFree(N)[1] === 1 ? "A perfect square." : md`Pull the square factor out: $${N} = ${squareFree(N)[0] ** 2} \cdot ${squareFree(N)[1]}$.` });
  return {
    prompt:
      kind === 1
        ? md`How far is $P = ${pt(Q)}$ from the origin? Give the exact value (like sqrt(14) or 3 sqrt(2)).`
        : md`Find the distance between $P = ${pt(P)}$ and $Q = ${pt(Q)}$. Give the exact value (like sqrt(14) or 3 sqrt(2)).`,
    answer: rootText(N),
    simplified: true,
    verify: [`d^2 = ${sq(d[0])} + ${sq(d[1])} + ${sq(d[2])}`],
    hint: md`$d = \sqrt{(\Delta x)^2 + (\Delta y)^2 + (\Delta z)^2}$: the differences are $${d[0]}$, $${d[1]}$ and $${d[2]}$.`,
    solution: steps,
  };
};

const midpointAndEndpoint: Generator = (r) => {
  const kind = r.int(0, 1);
  const P: V = [r.int(-6, 6), r.int(-6, 6), r.int(-6, 6)];
  if (kind === 0) {
    let h: V;
    do h = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
    while (h.filter((x) => x === 0).length > 1);
    const Q = add(P, scale(2, h));
    const M = add(P, h);
    return {
      prompt: md`Find the midpoint of the segment from $P = ${pt(P)}$ to $Q = ${pt(Q)}$. Give it as a point $(x, y, z)$.`,
      answer: pt(M),
      form: "tuple",
      verify: [`(a - ${paren(P[0])})^2 + (b - ${paren(P[1])})^2 + (c - ${paren(P[2])})^2 = (a - ${paren(Q[0])})^2 + (b - ${paren(Q[1])})^2 + (c - ${paren(Q[2])})^2`, ...parallelEqs(P, sub(Q, P))],
      hint: "Average each coordinate separately, just as in the plane: the midpoint is halfway along in x, in y and in z.",
      solution: [
        { math: md`M = \left(\frac{${P[0]} + ${paren(Q[0])}}{2},\; \frac{${P[1]} + ${paren(Q[1])}}{2},\; \frac{${P[2]} + ${paren(Q[2])}}{2}\right)`, note: "Average the x's, the y's and the z's." },
        { math: md`M = ${pt(M)}`, note: md`Check: $M$ is $${vt(h)}$ past $P$, and $Q$ is another $${vt(h)}$ past $M$.` },
      ],
    };
  }
  let M: V;
  do M = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
  while (sub(M, P).filter((x) => x === 0).length > 1);
  const Q = sub(scale(2, M), P);
  return {
    prompt: md`$M = ${pt(M)}$ is the midpoint of the segment from $P = ${pt(P)}$ to $Q$. Find $Q$. Give it as a point $(x, y, z)$.`,
    answer: pt(Q),
    form: "tuple",
    // M is as far from Q as from P, Q lies on the line PM, and Q is on the far side of M from P.
    verify: [
      `(a - ${paren(M[0])})^2 + (b - ${paren(M[1])})^2 + (c - ${paren(M[2])})^2 = ${norm2(sub(M, P))}`,
      ...parallelEqs(P, sub(M, P)),
      `(a - ${paren(M[0])})*${paren(M[0] - P[0])} + (b - ${paren(M[1])})*${paren(M[1] - P[1])} + (c - ${paren(M[2])})*${paren(M[2] - P[2])} = ${norm2(sub(M, P))}`,
    ],
    hint: md`Each coordinate of $M$ is the average of the matching coordinates of $P$ and $Q$. So $Q = 2M - P$, coordinate by coordinate.`,
    solution: [
      { math: md`\frac{${P[0]} + x}{2} = ${M[0]}, \quad \frac{${P[1]} + y}{2} = ${M[1]}, \quad \frac{${P[2]} + z}{2} = ${M[2]}`, note: "The midpoint formula, one coordinate at a time." },
      { math: md`x = 2(${M[0]}) - ${paren(P[0])} = ${Q[0]}, \quad y = 2(${M[1]}) - ${paren(P[1])} = ${Q[1]}, \quad z = 2(${M[2]}) - ${paren(P[2])} = ${Q[2]}`, note: "Double and subtract." },
      { math: md`Q = ${pt(Q)}`, note: md`Check: $M$ is the same step $${vt(sub(M, P))}$ from both $P$ and $Q$.` },
    ],
  };
};

/** x^2 - 2hx + h^2 for completing the square, or just x^2 when h = 0. */
const completeTex = (v: string, h: number) => (h === 0 ? `${v}^2` : `(${v}^2 ${signed(-2 * h)}${v} + ${h * h})`);
const shiftTex = (v: string, h: number) => (h === 0 ? `${v}^2` : `(${v} ${signed(-h)})^2`);

const sphereCenterRadius: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind < 2) {
    let C: V;
    do C = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
    while (C.filter((x) => x === 0).length > 1);
    const rad = r.int(1, 6);
    const rhs = rad * rad - norm2(C);
    const lhs = poly([[1, "x^2"], [1, "y^2"], [1, "z^2"], [-2 * C[0], "x"], [-2 * C[1], "y"], [-2 * C[2], "z"]]);
    // The equation's value at (X, Y, Z), for verifying the completed square at four points.
    const at = (X: number, Y: number, Z: number) => X * X + Y * Y + Z * Z - 2 * C[0] * X - 2 * C[1] * Y - 2 * C[2] * Z - rhs;
    const point = (X: number, Y: number, Z: number) => `(${X} - a)^2 + (${Y} - b)^2 + (${Z} - c)^2 - d^2 = ${at(X, Y, Z)}`;
    return {
      prompt: md`The sphere $${lhs} = ${rhs}$ has center $(h, k, l)$ and radius $r$. Find them. Give the answer as $(h, k, l, r)$.`,
      answer: `(${C[0]}, ${C[1]}, ${C[2]}, ${rad})`,
      form: "tuple",
      verify: [point(0, 0, 0), point(1, 0, 0), point(0, 1, 0), point(0, 0, 1)],
      hint: md`Complete the square in each variable: $x^2 ${signed(-2 * C[0])}x$ needs $${C[0] ** 2}$ added to become $${shiftTex("x", C[0])}$. Whatever you add on the left, add on the right.`,
      solution: [
        { math: md`${completeTex("x", C[0])} + ${completeTex("y", C[1])} + ${completeTex("z", C[2])} = ${rhs} + ${C[0] ** 2} + ${C[1] ** 2} + ${C[2] ** 2}`, note: md`Half of each linear coefficient, squared, completes that square. Add the same numbers to the right.` },
        { math: md`${shiftTex("x", C[0])} + ${shiftTex("y", C[1])} + ${shiftTex("z", C[2])} = ${rad * rad}`, note: "Each group is a perfect square." },
        { math: md`(h, k, l) = ${pt(C)}, \qquad r = \sqrt{${rad * rad}} = ${rad}`, note: md`Compare with $(x - h)^2 + (y - k)^2 + (z - l)^2 = r^2$. Signs flip: $(x ${signed(-C[0])})$ means $h = ${C[0]}$.` },
      ],
    };
  }
  const C: V = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
  let P: V;
  do P = [r.int(-6, 6), r.int(-6, 6), r.int(-6, 6)];
  while (sub(P, C).some((x) => x === 0));
  const N = norm2(sub(P, C));
  return {
    prompt: md`A sphere has center $C = ${pt(C)}$ and passes through $P = ${pt(P)}$. Write its equation as $(x - h)^2 + (y - k)^2 + (z - l)^2 = r^2$ and give $(h, k, l, r)$. Give $r$ exactly.`,
    answer: `(${C[0]}, ${C[1]}, ${C[2]}, ${rootText(N)})`,
    form: "tuple",
    simplified: true,
    // The sphere passes through P and through the six points one radius from C along the axes.
    verify: [
      `(${paren(P[0])} - a)^2 + (${paren(P[1])} - b)^2 + (${paren(P[2])} - c)^2 = d^2`,
      `(${paren(C[0])} + d - a)^2 + (${paren(C[1])} - b)^2 + (${paren(C[2])} - c)^2 = d^2`,
      `(${paren(C[0])} - d - a)^2 + (${paren(C[1])} - b)^2 + (${paren(C[2])} - c)^2 = d^2`,
      `(${paren(C[0])} - a)^2 + (${paren(C[1])} + d - b)^2 + (${paren(C[2])} - c)^2 = d^2`,
      `(${paren(C[0])} - a)^2 + (${paren(C[1])} - b)^2 + (${paren(C[2])} + d - c)^2 = d^2`,
    ],
    hint: "The radius is the distance from the center to any point on the sphere. Use the distance formula.",
    solution: [
      { math: md`r = |CP| = \sqrt{${diffSqTex(C, P)}}`, note: "Every point of the sphere is exactly r from the center, so P is." },
      { math: md`r = \sqrt{${N}}${rootTex(N) === `\\sqrt{${N}}` ? "" : ` = ${rootTex(N)}`}`, note: "" },
      { math: md`${shiftTex("x", C[0])} + ${shiftTex("y", C[1])} + ${shiftTex("z", C[2])} = ${N}`, note: md`So $(h, k, l, r) = (${C[0]}, ${C[1]}, ${C[2]}, ${rootTex(N)})$.` },
    ],
  };
};

// ── Lesson 2 generators: dot product ────────────────────────────────────────

const dotProducts: Generator = (r) => {
  if (r.next() < 0.6) {
    const u = rvec(r, -5, 5);
    const v = rvec(r, -5, 5);
    const d = dot(u, v);
    const s = add(u, v);
    return {
      prompt: md`Find $\mathbf{u} \cdot \mathbf{v}$ for $\mathbf{u} = ${vt(u)}$ and $\mathbf{v} = ${vt(v)}$.`,
      answer: String(d),
      verify: [`${norm2(u)} + ${norm2(v)} + 2*d = ${norm2(s)}`],
      hint: "Multiply matching components, then add the three products. The result is a number, not a vector.",
      solution: [
        { math: md`\mathbf{u} \cdot \mathbf{v} = ${dotTex(u, v)}`, note: "First with first, second with second, third with third." },
        { math: md`= ${u[0] * v[0]} ${signed(u[1] * v[1])} ${signed(u[2] * v[2])} = ${d}`, note: d === 0 ? "Zero: these two vectors are perpendicular." : d > 0 ? "Positive: the angle between them is acute." : "Negative: the angle between them is obtuse." },
      ],
    };
  }
  // Find k so that the vectors are perpendicular.
  const slot = r.int(0, 2);
  let u: V;
  let v: V;
  let rest: number;
  do {
    u = rvec(r, -5, 5);
    v = rvec(r, -5, 5);
    rest = dot(u, v) - u[slot]! * v[slot]!;
  } while (v[slot] === 0 || rest === 0);
  const k = frac(-rest, v[slot]!);
  const uTex: (number | string)[] = [...u];
  uTex[slot] = "k";
  const others = [0, 1, 2].filter((i) => i !== slot);
  const uText = [...u].map((x, i) => (i === slot ? "k" : paren(x)));
  return {
    prompt: md`Find $k$ so that $\mathbf{u} = \langle ${uTex.join(", ")} \rangle$ and $\mathbf{v} = ${vt(v)}$ are perpendicular.`,
    answer: k,
    verify: [`${uText[0]}*${paren(v[0])} + ${uText[1]}*${paren(v[1])} + ${uText[2]}*${paren(v[2])} = 0`],
    hint: "Perpendicular means the dot product is 0. Write out the dot product with k in it and solve.",
    solution: [
      { math: md`\mathbf{u} \cdot \mathbf{v} = ${v[slot]! < 0 ? `(${v[slot]})k` : `${v[slot]}k`} + (${u[others[0]!]})(${v[others[0]!]}) + (${u[others[1]!]})(${v[others[1]!]}) = 0`, note: "Perpendicular vectors have dot product zero." },
      { math: md`${v[slot]}k ${signed(rest)} = 0`, note: "Combine the two numbers." },
      { math: md`k = ${fracTex(-rest, v[slot]!)}`, note: "" },
    ],
  };
};

const angleBetween: Generator = (r) => {
  let u: V;
  let v: V;
  let c = 0;
  let deg = 0;
  do {
    u = rvec(r, -4, 4);
    v = rvec(r, -4, 4);
    c = dot(u, v) / Math.sqrt(norm2(u) * norm2(v));
    deg = (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  } while (Math.abs(c) > 0.999 || !safeRound(deg, 1));
  const d = dot(u, v);
  return {
    prompt: md`Find the angle between $\mathbf{u} = ${vt(u)}$ and $\mathbf{v} = ${vt(v)}$, in degrees, rounded to one decimal place. Type just the number.`,
    answer: deg.toFixed(1),
    tolerance: 0.05,
    hint: md`$\cos\theta = \dfrac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{u}|\,|\mathbf{v}|}$. Compute the dot product and both lengths, then use $\arccos$ in degree mode.`,
    solution: [
      { math: md`\mathbf{u} \cdot \mathbf{v} = ${dotTex(u, v)} = ${d}`, note: "" },
      { math: md`|\mathbf{u}| = \sqrt{${u[0] ** 2} + ${u[1] ** 2} + ${u[2] ** 2}} = ${rootTex(norm2(u))}, \qquad |\mathbf{v}| = ${rootTex(norm2(v))}`, note: "Lengths from the distance formula." },
      { math: md`\cos\theta = \frac{${d}}{${rootTex(norm2(u))} \cdot ${rootTex(norm2(v))}} \approx ${c.toFixed(4)}`, note: md`The angle formula, $\mathbf{u} \cdot \mathbf{v} = |\mathbf{u}|\,|\mathbf{v}| \cos\theta$, solved for $\cos\theta$.` },
      { math: md`\theta = \arccos(${c.toFixed(4)}) \approx ${deg.toFixed(1)}^\circ`, note: d === 0 ? "A zero dot product means a right angle." : d > 0 ? "Positive cosine: an acute angle." : "Negative cosine: an obtuse angle." },
    ],
  };
};

const projectionOnto: Generator = (r) => {
  const kind = r.int(0, 1);
  let u: V;
  let v: V;
  let d = 0;
  do {
    u = rvec(r, -4, 4);
    v = rvec(r, -3, 3);
    d = dot(u, v);
  } while (d === 0 || isZero(cross(u, v)));
  const N = norm2(v);
  const proj: string[] = v.map((x) => frac(d * x, N));
  const projTex = v.map((x) => fracTex(d * x, N));
  const parallel = parallelEqs([0, 0, 0], v);
  const steps: Step[] = [
    { math: md`\mathbf{u} \cdot \mathbf{v} = ${dotTex(u, v)} = ${d}, \qquad |\mathbf{v}|^2 = ${v[0] ** 2} + ${v[1] ** 2} + ${v[2] ** 2} = ${N}`, note: "The two numbers the formula needs." },
    { math: md`\operatorname{proj}_{\mathbf{v}} \mathbf{u} = \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|^2}\,\mathbf{v} = ${fracTex(d, N)} ${vt(v)}`, note: md`The shadow of $\mathbf{u}$ on the line of $\mathbf{v}$ has length $\frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|}$; dividing by $|\mathbf{v}|$ once more turns $\mathbf{v}$ into a unit vector.` },
    { math: md`= \left\langle ${projTex.join(", ")} \right\rangle`, note: "Multiply each component." },
  ];
  if (kind === 0) {
    return {
      prompt: md`Find $\operatorname{proj}_{\mathbf{v}} \mathbf{u}$, the vector projection of $\mathbf{u} = ${vt(u)}$ onto $\mathbf{v} = ${vt(v)}$. Give it as $(a, b, c)$; fractions are fine.`,
      answer: `(${proj.join(", ")})`,
      form: "tuple",
      verify: [...parallel, `(${paren(u[0])} - a)*${paren(v[0])} + (${paren(u[1])} - b)*${paren(v[1])} + (${paren(u[2])} - c)*${paren(v[2])} = 0`],
      hint: md`$\operatorname{proj}_{\mathbf{v}} \mathbf{u} = \dfrac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|^2}\,\mathbf{v}$. It's a multiple of $\mathbf{v}$, so start by finding the multiplier.`,
      solution: steps,
    };
  }
  const perp = u.map((x, i) => frac(x * N - d * v[i]!, N));
  const perpTex = u.map((x, i) => fracTex(x * N - d * v[i]!, N));
  return {
    prompt: md`Write $\mathbf{u} = ${vt(u)}$ as a part parallel to $\mathbf{v} = ${vt(v)}$ plus a part perpendicular to $\mathbf{v}$. Give the **perpendicular** part as $(a, b, c)$; fractions are fine.`,
    answer: `(${perp.join(", ")})`,
    form: "tuple",
    verify: [`a*${paren(v[0])} + b*${paren(v[1])} + c*${paren(v[2])} = 0`, ...parallelEqs(u, v)],
    hint: md`The parallel part is $\operatorname{proj}_{\mathbf{v}} \mathbf{u}$. Subtract it from $\mathbf{u}$ and what remains is perpendicular to $\mathbf{v}$.`,
    solution: [
      ...steps,
      { math: md`\mathbf{u} - \operatorname{proj}_{\mathbf{v}} \mathbf{u} = ${vt(u)} - \left\langle ${projTex.join(", ")} \right\rangle = \left\langle ${perpTex.join(", ")} \right\rangle`, note: "Take the parallel part away and the perpendicular part is what's left." },
      { math: md`\left\langle ${perpTex.join(", ")} \right\rangle \cdot ${vt(v)} = 0`, note: "Check: it really is perpendicular to v." },
    ],
  };
};

// ── Lesson 3 generators: cross product ──────────────────────────────────────

const crossProducts: Generator = (r) => {
  let u: V;
  let v: V;
  let w: V;
  do {
    u = rvec(r, -4, 4);
    v = rvec(r, -4, 4);
    w = cross(u, v);
  } while (isZero(w) || u.filter((x) => x === 0).length > 1 || v.filter((x) => x === 0).length > 1);
  // The length squared by Lagrange's identity, and the sign by a triple product computed with Sarrus' rule.
  const N = norm2(u) * norm2(v) - dot(u, v) ** 2;
  const probes: V[] = [
    [1, 1, 1],
    [1, 2, 3],
    [1, -1, 2],
    [2, 1, -1],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const p = probes.find((q) => sarrus(q, u, v) !== 0)!;
  return {
    prompt: md`Compute $\mathbf{u} \times \mathbf{v}$ for $\mathbf{u} = ${vt(u)}$ and $\mathbf{v} = ${vt(v)}$. Give it as $(a, b, c)$.`,
    answer: pt(w),
    form: "tuple",
    verify: [
      `a*${paren(u[0])} + b*${paren(u[1])} + c*${paren(u[2])} = 0`,
      `a*${paren(v[0])} + b*${paren(v[1])} + c*${paren(v[2])} = 0`,
      `a^2 + b^2 + c^2 = ${N}`,
      `${paren(p[0])}*a + ${paren(p[1])}*b + ${paren(p[2])}*c = ${sarrus(p, u, v)}`,
    ],
    hint: md`Write the determinant with $\mathbf{i}, \mathbf{j}, \mathbf{k}$ in the top row, $\mathbf{u}$ in the second and $\mathbf{v}$ in the third. Expand along the top row; the middle term gets a minus sign.`,
    solution: [
      { math: md`\mathbf{u} \times \mathbf{v} = ${detTex(u, v)}`, note: "Set up the determinant." },
      { math: md`= ${minorsTex(u, v)}`, note: "Each component is the 2×2 determinant you get by covering that component's column. The j term carries a minus sign." },
      { math: md`= ${vt(w)}`, note: md`Check: $${vt(w)} \cdot ${vt(u)} = ${dot(w, u)}$ and $${vt(w)} \cdot ${vt(v)} = ${dot(w, v)}$, so it's perpendicular to both.` },
    ],
  };
};

const areasFromCross: Generator = (r) => {
  const kind = r.int(0, 1);
  if (kind === 0) {
    let u: V;
    let v: V;
    let w: V;
    do {
      u = rvec(r, -4, 4);
      v = rvec(r, -4, 4);
      w = cross(u, v);
    } while (isZero(w));
    const N = norm2(w);
    return {
      prompt: md`Find the area of the parallelogram spanned by $\mathbf{u} = ${vt(u)}$ and $\mathbf{v} = ${vt(v)}$. Give the exact value.`,
      answer: rootText(N),
      simplified: true,
      verify: [`A^2 = ${norm2(u)}*${norm2(v)} - (${dot(u, v)})^2`],
      hint: md`The area is $|\mathbf{u} \times \mathbf{v}|$. Compute the cross product, then its length.`,
      solution: [
        { math: md`\mathbf{u} \times \mathbf{v} = ${detTex(u, v)} = ${vt(w)}`, note: "The cross product." },
        { math: md`A = |\mathbf{u} \times \mathbf{v}| = \sqrt{${sq(w[0])} + ${sq(w[1])} + ${sq(w[2])}} = ${rootTex(N)}`, note: md`Its length is $|\mathbf{u}|\,|\mathbf{v}| \sin\theta$, which is base times height.` },
      ],
    };
  }
  let P: V;
  let Q: V;
  let R: V;
  let w: V;
  do {
    P = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    Q = [r.int(-3, 4), r.int(-3, 4), r.int(-3, 4)];
    R = [r.int(-4, 3), r.int(-4, 3), r.int(-4, 3)];
    w = cross(sub(Q, P), sub(R, P));
  } while (isZero(w));
  const u = sub(Q, P);
  const v = sub(R, P);
  const N = norm2(w);
  return {
    prompt: md`Find the area of the triangle with vertices $P = ${pt(P)}$, $Q = ${pt(Q)}$ and $R = ${pt(R)}$. Give the exact value.`,
    answer: halfRootText(N),
    simplified: true,
    verify: [`4*A^2 = ${norm2(u)}*${norm2(v)} - (${dot(u, v)})^2`],
    hint: md`The triangle is half the parallelogram spanned by $\overrightarrow{PQ}$ and $\overrightarrow{PR}$, so its area is $\tfrac12 |\overrightarrow{PQ} \times \overrightarrow{PR}|$.`,
    solution: [
      { math: md`\overrightarrow{PQ} = ${vt(u)}, \qquad \overrightarrow{PR} = ${vt(v)}`, note: "Two sides from the same vertex, as vectors: tip minus tail." },
      { math: md`\overrightarrow{PQ} \times \overrightarrow{PR} = ${detTex(u, v)} = ${vt(w)}`, note: "" },
      { math: md`A = \tfrac12 |\overrightarrow{PQ} \times \overrightarrow{PR}| = \tfrac12 \sqrt{${N}} = ${halfRootTex(N)}`, note: "The parallelogram's area is the length of the cross product; the triangle is half of it." },
    ],
  };
};

const volumesAndCoplanar: Generator = (r) => {
  const kind = r.int(0, 1);
  if (kind === 0) {
    let u: V;
    let v: V;
    let w: V;
    let D = 0;
    do {
      u = rvec(r, -3, 3);
      v = rvec(r, -3, 3);
      w = rvec(r, -3, 3);
      D = sarrus(u, v, w);
    } while (D === 0);
    const c = cross(v, w);
    return {
      prompt: md`Find the volume of the parallelepiped with edges $\mathbf{u} = ${vt(u)}$, $\mathbf{v} = ${vt(v)}$ and $\mathbf{w} = ${vt(w)}$.`,
      answer: String(Math.abs(D)),
      verify: [`V^2 = (${detText(u, v, w)})^2`],
      hint: md`The volume is $|\mathbf{u} \cdot (\mathbf{v} \times \mathbf{w})|$, the absolute value of the determinant with rows $\mathbf{u}, \mathbf{v}, \mathbf{w}$.`,
      solution: [
        { math: md`\mathbf{v} \times \mathbf{w} = ${vt(c)}`, note: md`The base parallelogram has area $|\mathbf{v} \times \mathbf{w}|$, and this vector points straight up from it.` },
        { math: md`\mathbf{u} \cdot (\mathbf{v} \times \mathbf{w}) = ${dotTex(u, c)} = ${D}`, note: "The dot product with u is base area times the height of u above the base, with a sign." },
        { math: md`V = |${D}| = ${Math.abs(D)}`, note: D < 0 ? "Negative means u points to the other side of the base; the volume is the absolute value." : "A positive triple product: u, v, w are right-handed." },
      ],
    };
  }
  let u: V;
  let v: V;
  let w: V;
  let coefK = 0;
  let rest = 0;
  do {
    u = rvec(r, -3, 3);
    v = rvec(r, -3, 3);
    w = [r.int(-3, 3), r.int(-3, 3), 0];
    coefK = u[0] * v[1] - u[1] * v[0];
    rest = sarrus(u, v, w);
  } while (coefK === 0 || rest === 0);
  const k = frac(-rest, coefK);
  const wTex: (number | string)[] = [w[0], w[1], "k"];
  return {
    prompt: md`Find $k$ so that $\mathbf{u} = ${vt(u)}$, $\mathbf{v} = ${vt(v)}$ and $\mathbf{w} = \langle ${w[0]}, ${w[1]}, k \rangle$ all lie in one plane.`,
    answer: k,
    verify: [`${detText(u, v, wTex)} = 0`],
    hint: "Three vectors are coplanar exactly when the parallelepiped they span is flat: its volume, the scalar triple product, is zero.",
    solution: [
      { math: md`\mathbf{u} \cdot (\mathbf{v} \times \mathbf{w}) = \begin{vmatrix} ${u[0]} & ${u[1]} & ${u[2]} \\ ${v[0]} & ${v[1]} & ${v[2]} \\ ${w[0]} & ${w[1]} & k \end{vmatrix} = 0`, note: "Coplanar means zero volume." },
      { math: md`${rest} ${coefK < 0 ? "-" : "+"} ${Math.abs(coefK)}k = 0`, note: md`Expanding along the bottom row, the only term with $k$ is $k(${u[0]} \cdot ${paren(v[1])} - ${paren(u[1])} \cdot ${paren(v[0])}) = ${coefK}k$. The rest is the number $${rest}$.` },
      { math: md`k = ${fracTex(-rest, coefK)}`, note: "" },
    ],
  };
};

// ── Lesson 4 generators: lines and planes ───────────────────────────────────

const pointsOnLines: Generator = (r) => {
  const kind = r.int(0, 1);
  if (kind === 0) {
    const P: V = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
    let d: V;
    do d = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    while (d.filter((x) => x === 0).length > 1);
    const Q = add(P, d);
    const t = r.pick([2, 3, -1, -2, 4]);
    const A = add(P, scale(t, d));
    return {
      prompt: md`A line passes through $P = ${pt(P)}$ and $Q = ${pt(Q)}$. Parametrize it as $\mathbf{r}(t) = P + t\,\overrightarrow{PQ}$ and find the point at $t = ${t}$. Give it as $(x, y, z)$.`,
      answer: pt(A),
      form: "tuple",
      verify: [...parallelEqs(P, d), `(a - ${paren(P[0])})*${paren(d[0])} + (b - ${paren(P[1])})*${paren(d[1])} + (c - ${paren(P[2])})*${paren(d[2])} = ${t * norm2(d)}`],
      hint: md`The direction vector is $\overrightarrow{PQ} = Q - P$. Then $\mathbf{r}(${t}) = P + ${t}\,\overrightarrow{PQ}$, coordinate by coordinate.`,
      solution: [
        { math: md`\overrightarrow{PQ} = ${vt(d)}`, note: "Tip minus tail." },
        { math: md`\mathbf{r}(t) = \langle ${P[0]} ${d[0] < 0 ? "-" : "+"} ${Math.abs(d[0])}t,\; ${P[1]} ${d[1] < 0 ? "-" : "+"} ${Math.abs(d[1])}t,\; ${P[2]} ${d[2] < 0 ? "-" : "+"} ${Math.abs(d[2])}t \rangle`, note: md`Start at $P$ ($t = 0$) and move $t$ copies of the direction vector. At $t = 1$ you reach $Q$.` },
        { math: md`\mathbf{r}(${t}) = ${pt(A)}`, note: md`Substitute $t = ${t}$ into each coordinate.` },
      ],
    };
  }
  const plane = r.int(0, 2);
  const names = ["yz", "xz", "xy"];
  const coord = ["x", "y", "z"];
  let P: V;
  let d: V;
  do {
    P = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
    d = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
  } while (d[plane] === 0 || P[plane] === 0 || d.filter((x) => x === 0).length > 1);
  // t = -P[plane]/d[plane]
  const tn = -P[plane]!;
  const td = d[plane]!;
  const A = [0, 1, 2].map((i) => frac(P[i]! * td + tn * d[i]!, td));
  const ATex = [0, 1, 2].map((i) => fracTex(P[i]! * td + tn * d[i]!, td));
  // The coordinate plane as n · (a, b, c) = 0 with n its unit normal.
  const normal = [0, 1, 2].map((i) => (i === plane ? 1 : 0));
  return {
    prompt: md`Where does the line $\mathbf{r}(t) = ${vt(P)} + t\,${vt(d)}$ cross the $${names[plane]}$-plane? Give the point as $(x, y, z)$; fractions are fine.`,
    answer: `(${A.join(", ")})`,
    form: "tuple",
    verify: [...parallelEqs(P, d), `${normal[0]}*a + ${normal[1]}*b + ${normal[2]}*c = 0`],
    hint: md`On the $${names[plane]}$-plane, $${coord[plane]} = 0$. Set the $${coord[plane]}$-coordinate of $\mathbf{r}(t)$ equal to 0, solve for $t$, then find the other two coordinates.`,
    solution: [
      { math: md`${coord[plane]}(t) = ${P[plane]} ${td < 0 ? "-" : "+"} ${Math.abs(td)}t = 0`, note: md`The $${names[plane]}$-plane is where $${coord[plane]} = 0$.` },
      { math: md`t = ${fracTex(tn, td)}`, note: "" },
      { math: md`\mathbf{r}\!\left(${fracTex(tn, td)}\right) = \left(${ATex.join(",\\; ")}\right)`, note: md`Substitute that $t$ into all three coordinates. The $${coord[plane]}$-coordinate comes out 0, as it should.` },
    ],
  };
};

const planeThroughPoints: Generator = (r) => {
  let P: V;
  let Q: V;
  let R: V;
  let n: V;
  do {
    P = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    Q = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    R = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    n = cross(sub(Q, P), sub(R, P));
  } while (n[0] === 0 || isZero(n) || n.some((x) => Math.abs(x) > 12));
  const raw = n;
  const g = n.reduce((a, b) => gcd(a, b), 0);
  n = scale(1 / g, n);
  if (n[0] < 0) n = scale(-1, n);
  const d = dot(n, P);
  const u = sub(Q, P);
  const v = sub(R, P);
  const eq = `${planeLhs(n)} = ${d}`;
  const point = (X: V) => `${n[0]}*${paren(X[0])} + b*${paren(X[1])} + c*${paren(X[2])} = d`;
  const scaled = g !== 1 || raw[0] < 0;
  return {
    prompt: md`Find an equation of the plane through $P = ${pt(P)}$, $Q = ${pt(Q)}$ and $R = ${pt(R)}$. Write it as $${n[0] === 1 ? "" : n[0]}x + by + cz = d$ and give $(b, c, d)$.`,
    answer: `(${n[1]}, ${n[2]}, ${d})`,
    form: "tuple",
    verify: [point(P), point(Q), point(R)],
    hint: md`$\overrightarrow{PQ}$ and $\overrightarrow{PR}$ lie in the plane, so their cross product is a normal vector. Scale it so the $x$-coefficient is $${n[0]}$, then use $P$ to find $d$.`,
    solution: [
      { math: md`\overrightarrow{PQ} = ${vt(u)}, \qquad \overrightarrow{PR} = ${vt(v)}`, note: "Two vectors lying in the plane." },
      { math: md`\mathbf{n} = \overrightarrow{PQ} \times \overrightarrow{PR} = ${vt(raw)}`, note: "The cross product is perpendicular to both, so it's perpendicular to the plane." },
      ...(scaled ? [{ math: md`\mathbf{n} = ${vt(n)}`, note: md`Any nonzero multiple of a normal is a normal. ${g !== 1 ? `Divide by ${g}` : "Flip the sign"}${g !== 1 && raw[0] < 0 ? " and flip the sign" : ""} so the $x$-coefficient is $${n[0]}$.` }] : []),
      { math: md`${planeLhs(n)} = d`, note: md`The equation of a plane with normal $\langle a, b, c \rangle$ is $ax + by + cz = d$.` },
      { math: md`d = ${n[0]}(${P[0]}) ${signed(n[1] * P[1])} ${signed(n[2] * P[2])} = ${d}`, note: md`Substitute $P$; it's on the plane. $Q$ and $R$ give the same $d$.` },
      { math: eq, note: md`So $(b, c, d) = (${n[1]}, ${n[2]}, ${d})$.` },
    ],
  };
};

const linesMeetPlanes: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    // Choose the meeting point first so everything is an integer.
    let P: V;
    let v: V;
    let n: V;
    let t = 0;
    do {
      P = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
      v = rvec(r, -3, 3);
      n = rvec(r, -3, 3);
      t = r.pick([-2, -1, 1, 2, 3]);
    } while (dot(n, v) === 0 || v.filter((x) => x === 0).length > 1 || n.filter((x) => x === 0).length > 1);
    const A = add(P, scale(t, v));
    const d = dot(n, A);
    const nP = dot(n, P);
    const nv = dot(n, v);
    return {
      prompt: md`Find the point where the line $\mathbf{r}(t) = ${vt(P)} + t\,${vt(v)}$ meets the plane $${planeLhs(n)} = ${d}$. Give it as $(x, y, z)$.`,
      answer: pt(A),
      form: "tuple",
      verify: [...parallelEqs(P, v), `${paren(n[0])}*a + ${paren(n[1])}*b + ${paren(n[2])}*c = ${d}`],
      hint: md`Substitute $x = ${P[0]} ${signed(v[0])}t$, $y = \ldots$, $z = \ldots$ into the plane's equation. That gives one equation in $t$.`,
      solution: [
        { math: md`${n[0]}(${P[0]} ${signed(v[0])}t) ${signed(n[1])}(${P[1]} ${signed(v[1])}t) ${signed(n[2])}(${P[2]} ${signed(v[2])}t) = ${d}`, note: "The point of the line at time t must satisfy the plane's equation." },
        { math: md`${nP} ${signed(nv)}t = ${d}`, note: md`Collect: the constants give $\mathbf{n} \cdot P = ${nP}$ and the $t$-terms give $(\mathbf{n} \cdot \mathbf{v})\,t = ${nv}t$.` },
        { math: md`t = ${t}`, note: "" },
        { math: md`\mathbf{r}(${t}) = ${pt(A)}`, note: md`Check: $${planeLhs(n)} = ${dotTex(n, A)} = ${d}$.` },
      ],
    };
  }
  if (kind === 1) {
    // Foot of the perpendicular: choose the foot F on the plane and P = F + s n.
    let n: V;
    let F: V;
    let s = 0;
    do {
      n = rvec(r, -3, 3);
      F = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
      s = r.pick([-2, -1, 1, 2]);
    } while (n.filter((x) => x === 0).length > 1);
    const P = add(F, scale(s, n));
    const d = dot(n, F);
    const nP = dot(n, P);
    const N = norm2(n);
    return {
      prompt: md`Find the point on the plane $${planeLhs(n)} = ${d}$ that is closest to $P = ${pt(P)}$. Give it as $(x, y, z)$.`,
      answer: pt(F),
      form: "tuple",
      verify: [`${paren(n[0])}*a + ${paren(n[1])}*b + ${paren(n[2])}*c = ${d}`, ...parallelEqs(P, n)],
      hint: md`The closest point is the foot of the perpendicular, so it lies on the line through $P$ in the direction of the normal $\mathbf{n} = ${vt(n)}$. Find where that line meets the plane.`,
      solution: [
        { math: md`\mathbf{r}(t) = ${vt(P)} + t\,${vt(n)}`, note: "The line through P perpendicular to the plane: its direction is the normal." },
        { math: md`${nP} + ${N}t = ${d}`, note: md`Substitute into the plane's equation: $\mathbf{n} \cdot P + t\,(\mathbf{n} \cdot \mathbf{n}) = d$.` },
        { math: md`t = \frac{${d - nP}}{${N}} = ${-s}`, note: "" },
        { math: md`F = ${pt(F)}`, note: md`The distance from $P$ to the plane is $|PF| = |t|\,|\mathbf{n}| = ${Math.abs(s)}\sqrt{${N}}$.` },
      ],
    };
  }
  let n: V;
  let P: V;
  let d = 0;
  let num = 0;
  do {
    n = rvec(r, -3, 3);
    if (n.find((x) => x !== 0)! < 0) n = scale(-1, n);
    P = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
    d = r.int(-6, 6);
    num = dot(n, P) - d;
  } while (num === 0 || n.filter((x) => x === 0).length > 1);
  const N = norm2(n);
  const [k, m] = squareFree(N);
  // |num| / (k sqrt(m)) = |num| sqrt(m) / (k m), reduced.
  const g = gcd(Math.abs(num), k * m);
  const top = Math.abs(num) / g;
  const bottom = (k * m) / g;
  const answer = m === 1 ? frac(Math.abs(num), k) : `${top === 1 ? "" : `${top} `}sqrt(${m})${bottom === 1 ? "" : `/${bottom}`}`;
  const answerTex = m === 1 ? fracTex(Math.abs(num), k) : bottom === 1 ? `${top === 1 ? "" : top}\\sqrt{${m}}` : `\\frac{${top === 1 ? "" : top}\\sqrt{${m}}}{${bottom}}`;
  return {
    prompt: md`Find the distance from $P = ${pt(P)}$ to the plane $${planeLhs(n)} = ${d}$. Give the exact value (a form like 5/sqrt(14) is fine).`,
    answer,
    hint: md`$D = \dfrac{|ax_0 + by_0 + cz_0 - d|}{\sqrt{a^2 + b^2 + c^2}}$: how far the plane's equation misses at $P$, divided by the length of the normal.`,
    solution: [
      { math: md`\mathbf{n} = ${vt(n)}, \qquad |\mathbf{n}| = \sqrt{${n[0] ** 2} + ${n[1] ** 2} + ${n[2] ** 2}} = ${rootTex(N)}`, note: "Read the normal off the equation's coefficients." },
      { math: md`ax_0 + by_0 + cz_0 - d = ${dotTex(n, P)} - ${paren(d)} = ${num}`, note: md`Substitute $P$ into $ax + by + cz - d$. Nonzero, so $P$ is off the plane.` },
      { math: md`D = \frac{|${num}|}{${rootTex(N)}}${m === 1 ? "" : ` = \\frac{${Math.abs(num)}}{\\sqrt{${N}}}`} = ${answerTex}`, note: "The distance is the component of the displacement from the plane along the unit normal." },
    ],
  };
};

// ── Lesson 5 generators: surfaces ───────────────────────────────────────────

const QUADRICS = ["ellipsoid", "elliptic paraboloid", "hyperbolic paraboloid", "cone", "hyperboloid of one sheet", "hyperboloid of two sheets", "cylinder"];

/** Variable names in a random order; the last is the axis of symmetry. */
function axes(r: Rng): [string, string, string] {
  return r.pick([
    ["x", "y", "z"],
    ["y", "z", "x"],
    ["x", "z", "y"],
  ]) as [string, string, string];
}

const classifyQuadric: Generator = (r) => {
  const type = r.int(0, 6);
  const [X, Y, Z] = axes(r);
  const A = r.pick([1, 4, 9]);
  const B = r.pick([1, 4, 9]);
  const C = r.pick([1, 4]);
  const K = r.pick([1, 4, 36]);
  const term = (c: number, v: string) => (c === 1 ? `${v}^2` : `${c}${v}^2`);
  let tex = "";
  let why = "";
  switch (type) {
    case 0:
      tex = `${term(A, X)} + ${term(B, Y)} + ${term(C, Z)} = ${K}`;
      why = md`Three squared terms, all positive, equal to a positive constant: every trace is an ellipse (or a circle), and the surface is bounded. An ellipsoid.`;
      break;
    case 1:
      tex = r.next() < 0.5 ? `${Z} = ${term(A, X)} + ${term(B, Y)}` : `${term(A, X)} + ${term(B, Y)} = ${Z}`;
      why = md`One variable appears to the first power; the other two are squared with the **same** sign. Horizontal traces $${Z} = k$ are ellipses, vertical traces are parabolas: an elliptic paraboloid, opening along the $${Z}$-axis.`;
      break;
    case 2:
      tex = r.next() < 0.5 ? `${Z} = ${term(A, X)} - ${term(B, Y)}` : `${Z} = ${term(B, Y)} - ${term(A, X)}`;
      why = md`One variable to the first power, the other two squared with **opposite** signs. Traces $${Z} = k$ are hyperbolas and vertical traces are parabolas opening opposite ways: a saddle, the hyperbolic paraboloid.`;
      break;
    case 3:
      tex = r.next() < 0.5 ? `${term(C, Z)} = ${term(A, X)} + ${term(B, Y)}` : `${term(A, X)} + ${term(B, Y)} - ${term(C, Z)} = 0`;
      why = md`Three squared terms, two positive and one negative, equal to **zero**. Traces $${Z} = k$ are ellipses that shrink to a point at $k = 0$, and traces through the axis are pairs of lines: a cone along the $${Z}$-axis.`;
      break;
    case 4:
      tex = `${term(A, X)} + ${term(B, Y)} - ${term(C, Z)} = ${K}`;
      why = md`Three squared terms, two positive and one negative, equal to a positive constant. Every trace $${Z} = k$ is an ellipse, even at $k = 0$, so the surface is one connected tube: a hyperboloid of one sheet around the $${Z}$-axis.`;
      break;
    case 5:
      tex = r.next() < 0.5 ? `${term(C, Z)} - ${term(A, X)} - ${term(B, Y)} = ${K}` : `-${term(A, X)} - ${term(B, Y)} + ${term(C, Z)} = ${K}`;
      why = md`Three squared terms, one positive and two negative, equal to a positive constant. Where $${Z} = 0$ the left side is $\le 0$, so there are no points: the surface splits into two bowls. A hyperboloid of two sheets along the $${Z}$-axis.`;
      break;
    default: {
      const form = r.int(0, 2);
      tex = form === 0 ? `${term(A, X)} + ${term(B, Y)} = ${K}` : form === 1 ? `${Y} = ${term(A, X)}` : `${term(A, X)} - ${term(B, Y)} = ${K}`;
      why = md`The variable $${Z}$ is missing. Whatever curve the equation draws in the $${X}${Y}$-plane is repeated at every height $${Z}$: a cylinder with rulings parallel to the $${Z}$-axis.`;
    }
  }
  return {
    prompt: md`Which kind of surface is $${tex}$?`,
    choices: QUADRICS,
    accept: [QUADRICS[type]!],
    hint: "Count the squared variables and their signs. Is one variable missing? Is one variable not squared? Is the constant zero or positive?",
    solution: [{ math: md`\text{${QUADRICS[type]}}`, note: why }],
  };
};

const traceRadius: Generator = (r) => {
  const type = r.int(0, 3);
  const rho = r.int(1, 6);
  if (type === 0) {
    const k = r.nonzero(-5, 5);
    const R2 = rho * rho + k * k;
    return {
      prompt: md`The trace of the sphere $x^2 + y^2 + z^2 = ${R2}$ in the plane $z = ${k}$ is a circle. Find its radius.`,
      answer: String(rho),
      verify: [`r^2 + 0^2 + ${sq(k)} = ${R2}`],
      hint: md`Substitute $z = ${k}$ into the equation and read off $x^2 + y^2 = r^2$.`,
      solution: [
        { math: md`x^2 + y^2 + ${sq(k)} = ${R2}`, note: md`Set $z = ${k}$.` },
        { math: md`x^2 + y^2 = ${R2 - k * k}`, note: md`A circle in the plane $z = ${k}$, centered on the $z$-axis.` },
        { math: md`r = \sqrt{${rho * rho}} = ${rho}`, note: "Slices near the equator are big; near the poles they shrink to a point." },
      ],
    };
  }
  if (type === 1) {
    const k = rho * rho;
    return {
      prompt: md`The trace of the paraboloid $z = x^2 + y^2$ in the plane $z = ${k}$ is a circle. Find its radius.`,
      answer: String(rho),
      verify: [`${k} = r^2 + 0^2`],
      hint: md`Substitute $z = ${k}$: the trace is $x^2 + y^2 = ${k}$.`,
      solution: [
        { math: md`${k} = x^2 + y^2`, note: md`Set $z = ${k}$.` },
        { math: md`r = \sqrt{${k}} = ${rho}`, note: "The radius grows like the square root of the height, which is why the paraboloid widens slowly." },
      ],
    };
  }
  if (type === 2) {
    return {
      prompt: md`The trace of the cone $z^2 = x^2 + y^2$ in the plane $z = ${rho}$ is a circle. Find its radius.`,
      answer: String(rho),
      verify: [`${sq(rho)} = r^2 + 0^2`],
      hint: md`Substitute $z = ${rho}$.`,
      solution: [
        { math: md`${rho * rho} = x^2 + y^2`, note: md`Set $z = ${rho}$.` },
        { math: md`r = ${rho}`, note: "For a cone the radius equals the height: the slices grow in direct proportion, which is what makes the sides straight." },
      ],
    };
  }
  const k = r.int(1, rho - 1 >= 1 ? rho - 1 : 1);
  const c = rho * rho - k * k;
  if (c <= 0) {
    // rho = 1 leaves no room; fall back to the paraboloid.
    return {
      prompt: md`The trace of the paraboloid $z = x^2 + y^2$ in the plane $z = 4$ is a circle. Find its radius.`,
      answer: "2",
      verify: ["4 = r^2 + 0^2"],
      hint: md`Substitute $z = 4$: the trace is $x^2 + y^2 = 4$.`,
      solution: [
        { math: md`4 = x^2 + y^2`, note: md`Set $z = 4$.` },
        { math: md`r = 2`, note: "" },
      ],
    };
  }
  return {
    prompt: md`The trace of the hyperboloid $x^2 + y^2 - z^2 = ${c}$ in the plane $z = ${k}$ is a circle. Find its radius.`,
    answer: String(rho),
    verify: [`r^2 + 0^2 - ${sq(k)} = ${c}`],
    hint: md`Substitute $z = ${k}$ and move the constant to the right.`,
    solution: [
      { math: md`x^2 + y^2 - ${k * k} = ${c}`, note: md`Set $z = ${k}$.` },
      { math: md`x^2 + y^2 = ${rho * rho}`, note: md`The smallest trace is at $z = 0$, with radius $\sqrt{${c}}$; the circles grow as you move away from it. That's the waist of the hyperboloid of one sheet.` },
      { math: md`r = ${rho}`, note: "" },
    ],
  };
};

const AXES = ["the x-axis", "the y-axis", "the z-axis"];

const surfaceAxis: Generator = (r) => {
  const [X, Y, Z] = axes(r);
  const axis = AXES[["x", "y", "z"].indexOf(Z)]!;
  const A = r.pick([1, 4]);
  const B = r.pick([1, 9]);
  const term = (c: number, v: string) => (c === 1 ? `${v}^2` : `${c}${v}^2`);
  const kind = r.int(0, 5);
  const items: [string, string, string][] = [
    [`${Z} = ${term(A, X)} + ${term(B, Y)}`, md`Which coordinate axis is the axis of the paraboloid $${Z} = ${term(A, X)} + ${term(B, Y)}$?`, md`The unsquared variable is $${Z}$. Traces $${Z} = k$ are ellipses centered on the $${Z}$-axis, so the paraboloid opens along that axis.`],
    [`${term(A, X)} + ${term(B, Y)} = ${Z}^2`, md`Which coordinate axis is the axis of the cone $${term(A, X)} + ${term(B, Y)} = ${Z}^2$?`, md`The squared term on its own side, $${Z}^2$, is the odd one out. Traces $${Z} = k$ are ellipses that shrink to a point at $k = 0$: the cone's axis is the $${Z}$-axis.`],
    [`${term(A, X)} + ${term(B, Y)} - ${Z}^2 = 1`, md`Which coordinate axis is the axis of the hyperboloid $${term(A, X)} + ${term(B, Y)} - ${Z}^2 = 1$?`, md`The variable with the negative sign, $${Z}$, is the axis. Traces $${Z} = k$ are ellipses for every $k$: one sheet wrapped around the $${Z}$-axis.`],
    [`${Z}^2 - ${term(A, X)} - ${term(B, Y)} = 1`, md`Which coordinate axis is the axis of the hyperboloid $${Z}^2 - ${term(A, X)} - ${term(B, Y)} = 1$?`, md`The lone positive square is $${Z}^2$. The two sheets sit at $${Z} \ge 1$ and $${Z} \le -1$ along the $${Z}$-axis.`],
    [`${term(A, X)} + ${term(B, Y)} = 4`, md`The surface $${term(A, X)} + ${term(B, Y)} = 4$ is a cylinder. Its rulings (the straight lines on it) are parallel to which axis?`, md`$${Z}$ is missing from the equation, so every point can slide freely in the $${Z}$-direction and stay on the surface. The rulings are parallel to the $${Z}$-axis.`],
    [`${Y} = ${term(A, X)}`, md`The surface $${Y} = ${term(A, X)}$ is a parabolic cylinder. Its rulings are parallel to which axis?`, md`$${Z}$ doesn't appear, so the parabola $${Y} = ${term(A, X)}$ in the $${X}${Y}$-plane is repeated at every $${Z}$. The rulings run parallel to the $${Z}$-axis.`],
  ];
  const [tex, prompt, why] = items[kind]!;
  return {
    prompt,
    choices: AXES,
    accept: [axis],
    hint: kind >= 4 ? "Which variable is missing? That's the direction the curve gets dragged in." : "Which variable is the odd one out: not squared, or squared with the opposite sign? That's the axis.",
    solution: [{ math: tex, note: why }],
  };
};

// ── Figures ─────────────────────────────────────────────────────────────────

/** An oblique view of the point (a, b, c) with its coordinate box, drawn in 2D: x comes toward you and left, y goes right, z goes up. */
const pointBox: Block = {
  kind: "diagram",
  view: [-4.6, 7.4, -3.2, 7],
  points: [
    { name: "O", x: 0, y: 0, dir: "nw", label: "O" },
    { name: "X", x: -3.6, y: -2.1, label: "x", dir: "sw" },
    { name: "Y", x: 6.5, y: 0, label: "y", dir: "e" },
    { name: "Z", x: 0, y: 6.5, label: "z", dir: "n" },
    { name: "A", x: "-0.6a", y: "-0.35a", label: "({a}, 0, 0)", dir: "sw", hidden: true },
    { name: "B", x: "b - 0.6a", y: "-0.35a", label: "({a}, {b}, 0)", dir: "se", hidden: true },
    { name: "C", x: "b", y: 0, label: "", hidden: true },
    { name: "D", x: 0, y: "c", label: "", hidden: true },
    { name: "E", x: "-0.6a", y: "c - 0.35a", label: "", hidden: true },
    { name: "F", x: "b", y: "c", label: "", hidden: true },
    { name: "P", x: "b - 0.6a", y: "c - 0.35a", label: "P = ({a}, {b}, {c})", dir: "ne" },
  ],
  segments: [
    { from: "O", to: "X", arrow: true },
    { from: "O", to: "Y", arrow: true },
    { from: "O", to: "Z", arrow: true },
    { from: "O", to: "A", color: 2 },
    { from: "A", to: "B", color: 2 },
    { from: "B", to: "P", color: 2, arrow: true },
    { from: "C", to: "B", dashed: true },
    { from: "D", to: "E", dashed: true },
    { from: "D", to: "F", dashed: true },
    { from: "E", to: "P", dashed: true },
    { from: "F", to: "P", dashed: true },
    { from: "A", to: "E", dashed: true },
    { from: "C", to: "F", dashed: true },
  ],
  params: [
    { name: "a", tex: "x", min: 0, max: 5, step: 1, value: 2 },
    { name: "b", tex: "y", min: 0, max: 6, step: 1, value: 3 },
    { name: "c", tex: "z", min: 0, max: 5, step: 1, value: 4 },
  ],
  caption: md`To reach $P = (x, y, z)$: walk $x$ units along the $x$-axis (toward you), $y$ units parallel to the $y$-axis, then climb $z$. The dashed box has $P$ and the origin at opposite corners. Slide the coordinates and watch the box change.`,
};

/** The vertical cross-section through P and Q: the right triangle whose legs are the horizontal shadow and the rise. */
const distanceTriangle: Block = {
  kind: "diagram",
  view: [-1.5, 7, -1, 13.5],
  points: [
    { name: "P", x: 0, y: 0, label: "P = (1, -2, 3)", dir: "sw" },
    { name: "S", x: 5, y: 0, label: "", dir: "se", hidden: true },
    { name: "Q", x: 5, y: 12, label: "Q = (4, 2, 15)", dir: "ne" },
  ],
  segments: [
    { from: "P", to: "S", label: "\\sqrt{3^2 + 4^2} = 5", color: 2 },
    { from: "S", to: "Q", label: "\\Delta z = 12", color: 3 },
    { from: "P", to: "Q", label: "d" },
  ],
  angles: [{ at: "S", from: "P", to: "Q", right: true }],
  caption: md`The vertical plane through $P$ and $Q$, seen face on. The horizontal leg is the distance between the shadows of $P$ and $Q$ on the $xy$-plane, already found by Pythagoras: $\sqrt{3^2 + 4^2} = 5$. The vertical leg is the rise, $12$. Pythagoras again: $d = \sqrt{5^2 + 12^2} = 13$.`,
};

/** u, v and u - v in the plane they span, with the angle between them; v is adjustable. */
const dotAngleFigure: Block = {
  kind: "diagram",
  view: [-5, 6, -5, 6],
  grid: true,
  points: [
    { name: "O", x: 0, y: 0, label: "", dir: "sw" },
    { name: "U", x: 4, y: 1, label: "\\mathbf{u}", dir: "e" },
    { name: "V", x: "a", y: "b", label: "\\mathbf{v}", dir: "n" },
  ],
  segments: [
    { from: "O", to: "U", arrow: true, color: 1 },
    { from: "O", to: "V", arrow: true, color: 2 },
    { from: "V", to: "U", arrow: true, color: 3, label: "\\mathbf{u} - \\mathbf{v}", dashed: true },
  ],
  angles: [{ at: "O", from: "U", to: "V", label: "\\theta" }],
  params: [
    { name: "a", tex: "v_1", min: -4, max: 5, step: 1, value: 1 },
    { name: "b", tex: "v_2", min: -4, max: 5, step: 1, value: 3 },
  ],
  readouts: [
    { label: "\\mathbf{u} \\cdot \\mathbf{v}", value: "4a + b" },
    { label: "\\cos\\theta", value: "(4a + b)/(sqrt(17) sqrt(a^2 + b^2))" },
    { label: "\\theta", value: "acos((4a + b)/(sqrt(17) sqrt(a^2 + b^2))) 180/pi", unit: "^\\circ" },
  ],
  caption: md`Two vectors always lie in a common plane, so a 2D picture loses nothing. Here $\mathbf{u} = \langle 4, 1 \rangle$ is fixed; move $\mathbf{v}$. The dot product is positive when the angle is acute, zero at a right angle, negative when obtuse. The triangle with sides $\mathbf{u}$, $\mathbf{v}$ and $\mathbf{u} - \mathbf{v}$ is where the law of cosines enters.`,
};

/** The projection of u onto v: the shadow and the perpendicular. */
const projectionFigure: Block = {
  kind: "diagram",
  view: [-1, 6, -1, 4.5],
  points: [
    { name: "O", x: 0, y: 0, label: "", dir: "sw" },
    { name: "U", x: 2, y: 3, label: "\\mathbf{u}", dir: "n" },
    { name: "V", x: 5, y: 1, label: "\\mathbf{v}", dir: "e" },
    { name: "F", x: 2.5, y: 0.5, label: "", hidden: true },
  ],
  segments: [
    { from: "O", to: "U", arrow: true, color: 1 },
    { from: "O", to: "V", arrow: true, color: 2 },
    { from: "U", to: "F", dashed: true },
    { from: "O", to: "F", arrow: true, color: 3, label: "\\operatorname{proj}_{\\mathbf{v}} \\mathbf{u}" },
  ],
  angles: [
    { at: "F", from: "U", to: "O", right: true },
    { at: "O", from: "V", to: "U", label: "\\theta" },
  ],
  caption: md`Shine a light straight down onto the line of $\mathbf{v}$. The shadow of $\mathbf{u}$ is its projection. Its length is $|\mathbf{u}| \cos\theta$ (adjacent over hypotenuse in the right triangle), and the angle formula turns that into $\frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|}$. Here $\mathbf{u} = \langle 2, 3 \rangle$, $\mathbf{v} = \langle 5, 1 \rangle$, and the projection is $\frac{13}{26}\mathbf{v} = \langle 2.5, 0.5 \rangle$.`,
};

/** The parallelogram spanned by u and v with its height, in the plane of u and v. */
const parallelogramFigure: Block = {
  kind: "diagram",
  view: [-1, 8, -1, 5],
  points: [
    { name: "O", x: 0, y: 0, label: "", dir: "sw" },
    { name: "U", x: 5, y: 1, label: "\\mathbf{u}", dir: "se" },
    { name: "V", x: 2, y: 3, label: "\\mathbf{v}", dir: "nw" },
    { name: "W", x: 7, y: 4, label: "", hidden: true },
    { name: "H", x: 2.5, y: 0.5, label: "", hidden: true },
  ],
  polygons: [{ points: ["O", "U", "W", "V"], fill: 1 }],
  segments: [
    { from: "O", to: "U", arrow: true, color: 1 },
    { from: "O", to: "V", arrow: true, color: 2 },
    { from: "U", to: "W", dashed: true },
    { from: "V", to: "W", dashed: true },
    { from: "V", to: "H", dashed: true, color: 3, label: "h = |\\mathbf{v}| \\sin\\theta" },
  ],
  angles: [
    { at: "H", from: "V", to: "U", right: true },
    { at: "O", from: "U", to: "V", label: "\\theta" },
  ],
  caption: md`The parallelogram spanned by $\mathbf{u}$ and $\mathbf{v}$, seen in their common plane. Its base is $|\mathbf{u}|$ and its height is $|\mathbf{v}| \sin\theta$, so its area is $|\mathbf{u}|\,|\mathbf{v}| \sin\theta$. That is exactly $|\mathbf{u} \times \mathbf{v}|$.`,
};

/** A plane seen edge-on, with its normal and the perpendicular from a point. */
const planeDistanceFigure: Block = {
  kind: "diagram",
  view: [-2, 8, -1.5, 4.5],
  points: [
    { name: "A", x: -1.5, y: 0, label: "", hidden: true },
    { name: "B", x: 7.5, y: 0, label: "", hidden: true },
    { name: "P", x: 0, y: 0, label: "P_0", dir: "sw" },
    { name: "N", x: 0, y: 2, label: "\\mathbf{n}", dir: "w" },
    { name: "Q", x: 5, y: 3, label: "P_1", dir: "ne" },
    { name: "F", x: 5, y: 0, label: "", hidden: true },
  ],
  segments: [
    { from: "A", to: "B", label: "\\text{the plane, seen edge-on}" },
    { from: "P", to: "N", arrow: true, color: 2 },
    { from: "P", to: "Q", arrow: true, color: 1, label: "P_1 - P_0", dashed: true },
    { from: "Q", to: "F", color: 3, label: "D" },
  ],
  angles: [{ at: "F", from: "Q", to: "P", right: true }],
  caption: md`Look at the plane from the side so it appears as a line. The distance $D$ from $P_1$ to the plane is the length of the perpendicular, which is the component of $P_1 - P_0$ along the normal $\mathbf{n}$: $D = \frac{|\mathbf{n} \cdot (P_1 - P_0)|}{|\mathbf{n}|}$. Any point $P_0$ of the plane will do.`,
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit1: Unit = {
  title: "Vectors and 3D Space",
  lessons: [
    {
      id: slug("Coordinates in space"),
      title: "Coordinates in space",
      summary: "Three axes, ordered triples, the distance formula from Pythagoras twice, and spheres.",
      blocks: [
        {
          kind: "text",
          body: md`Two numbers locate a point in a plane. Three locate a point in space. Add a third axis, the $z$-axis, perpendicular to both the $x$- and $y$-axes through the origin, and every point gets an **ordered triple** $(x, y, z)$: go $x$ along the first axis, $y$ parallel to the second, $z$ parallel to the third.

The three axes are drawn **right-handed**: curl the fingers of your right hand from the positive $x$-axis toward the positive $y$-axis, and your thumb points along the positive $z$-axis. Every picture in this course follows that convention, and in Lesson 3 it decides the direction of the cross product.`,
        },
        pointBox,
        {
          kind: "key",
          title: "Coordinates in space",
          body: md`Space with coordinates is written $\mathbb{R}^3$: the set of all ordered triples of real numbers. The three **coordinate planes** are where one coordinate is zero: the $xy$-plane is $z = 0$, the $xz$-plane is $y = 0$, the $yz$-plane is $x = 0$. They cut space into eight **octants**; the first octant has $x, y, z$ all positive.

The distance from $(x, y, z)$ to the $xy$-plane is $|z|$, to the $xz$-plane $|y|$, to the $yz$-plane $|x|$. The projection (shadow) of $(x, y, z)$ onto the $xy$-plane is $(x, y, 0)$.`,
        },
        {
          kind: "text",
          body: md`An equation in $x$, $y$ and $z$ describes a set of points. In the plane, $x = 2$ is a vertical line. In space, $x = 2$ is a whole **plane**: every point with first coordinate 2, whatever $y$ and $z$ are. One equation in three variables usually leaves two degrees of freedom, and two degrees of freedom make a surface. Keep that in mind: $z = 3$ is a horizontal plane, not a line.`,
        },
        {
          kind: "why",
          title: "Why the distance formula has three squares",
          body: md`Take $P = (x_1, y_1, z_1)$ and $Q = (x_2, y_2, z_2)$ and build the box with $P$ and $Q$ at opposite corners: its edges are $a = |x_2 - x_1|$, $b = |y_2 - y_1|$ and $c = |z_2 - z_1|$.

First Pythagoras: the diagonal of the box's floor, from $P$ to the point directly below $Q$, has length $\sqrt{a^2 + b^2}$. That is the plane distance formula from Geometry.

Second Pythagoras: that floor diagonal and the vertical edge $c$ are perpendicular (the edge is vertical, the floor is horizontal), so they form a right triangle whose hypotenuse is $PQ$:

$$|PQ|^2 = \left(\sqrt{a^2 + b^2}\right)^2 + c^2 = a^2 + b^2 + c^2.$$

Squaring removes the absolute values, so the formula uses the signed differences directly.`,
        },
        distanceTriangle,
        {
          kind: "key",
          title: "Distance and midpoint in space",
          body: md`$$|PQ| = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2 + (z_2 - z_1)^2}$$

The midpoint of $PQ$ averages each coordinate:

$$M = \left(\frac{x_1 + x_2}{2},\; \frac{y_1 + y_2}{2},\; \frac{z_1 + z_2}{2}\right).$$

The distance from the origin to $(x, y, z)$ is $\sqrt{x^2 + y^2 + z^2}$.`,
        },
        {
          kind: "proof",
          title: "The distance formula, from the shadows",
          given: md`$P = (x_1, y_1, z_1)$ and $Q = (x_2, y_2, z_2)$`,
          prove: md`$|PQ|^2 = (x_2 - x_1)^2 + (y_2 - y_1)^2 + (z_2 - z_1)^2$`,
          steps: [
            { statement: md`Let $P' = (x_1, y_1, 0)$ and $Q' = (x_2, y_2, 0)$ be the shadows of $P$ and $Q$ on the $xy$-plane.`, reason: "Drop each point straight down (or up) to height 0." },
            { statement: md`$|P'Q'|^2 = (x_2 - x_1)^2 + (y_2 - y_1)^2$`, reason: md`The plane distance formula in the $xy$-plane, which is Pythagoras.` },
            { statement: md`The segment $PQ$ and the segment $P'Q'$ lie in one vertical plane, and in it $PQ$ is the hypotenuse of a right triangle with horizontal leg $|P'Q'|$ and vertical leg $|z_2 - z_1|$.`, reason: md`Slide $P$ horizontally to the point $S = (x_2, y_2, z_1)$ at $Q$'s shadow and $P$'s height: $PS$ is horizontal with length $|P'Q'|$, and $SQ$ is vertical with length $|z_2 - z_1|$. Horizontal meets vertical at a right angle.` },
            { statement: md`$|PQ|^2 = |P'Q'|^2 + (z_2 - z_1)^2 = (x_2 - x_1)^2 + (y_2 - y_1)^2 + (z_2 - z_1)^2$`, reason: "Pythagoras in that vertical plane, then the line above." },
          ],
        },
        {
          kind: "example",
          title: "Distance between two points",
          problem: md`Find the distance between $P = (1, -2, 3)$ and $Q = (4, 2, 15)$.`,
          steps: [
            { math: md`\Delta x = 4 - 1 = 3, \quad \Delta y = 2 - (-2) = 4, \quad \Delta z = 15 - 3 = 12`, note: "Subtract matching coordinates. The order doesn't matter once they're squared." },
            { math: md`d = \sqrt{3^2 + 4^2 + 12^2} = \sqrt{9 + 16 + 144} = \sqrt{169}`, note: "" },
            { math: md`d = 13`, note: md`Compare the figure above: the floor diagonal is 5, the rise is 12, and $5^2 + 12^2 = 13^2$.` },
          ],
        },
        {
          kind: "why",
          title: "Why a sphere's equation is the distance formula squared",
          body: md`A **sphere** is the set of points at a fixed distance $r$ from a center $C = (h, k, l)$. That is a sentence about distance, and we have a formula for distance. A point $(x, y, z)$ is on the sphere exactly when

$$\sqrt{(x - h)^2 + (y - k)^2 + (z - l)^2} = r,$$

and squaring both sides (both are nonnegative, so nothing is lost) gives the standard form. Nothing new was invented: the sphere's equation *is* the distance formula with the distance set to $r$. The same reasoning gave the circle $(x - h)^2 + (y - k)^2 = r^2$ in Algebra.`,
        },
        {
          kind: "key",
          title: "Equation of a sphere",
          body: md`The sphere with center $(h, k, l)$ and radius $r$:

$$(x - h)^2 + (y - k)^2 + (z - l)^2 = r^2.$$

An equation of the form $x^2 + y^2 + z^2 + Dx + Ey + Fz + G = 0$ is a sphere (or a single point, or nothing) and you find its center and radius by **completing the square** in each variable, exactly as for circles.`,
        },
        {
          kind: "example",
          title: "Completing the square",
          problem: md`Find the center and radius of $x^2 + y^2 + z^2 - 2x + 4y - 6z = 2$.`,
          steps: [
            { math: md`(x^2 - 2x + 1) + (y^2 + 4y + 4) + (z^2 - 6z + 9) = 2 + 1 + 4 + 9`, note: md`Half the coefficient of $x$ is $-1$, squared is 1; half of 4 is 2, squared is 4; half of $-6$ is $-3$, squared is 9. Add each to both sides.` },
            { math: md`(x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 16`, note: "Each group is a perfect square." },
            { math: md`\text{center } (1, -2, 3), \quad r = 4`, note: md`$(y + 2)^2 = (y - (-2))^2$, so $k = -2$. The radius is $\sqrt{16}$, not 16.` },
          ],
        },
        {
          kind: "surface",
          x: [-4, 4],
          y: [-4, 4],
          z: [0, 4.5],
          expr: "sqrt(16 - x^2 - y^2)",
          caption: md`The top half of the sphere $x^2 + y^2 + z^2 = 16$, drawn as $z = \sqrt{16 - x^2 - y^2}$. A surface plot shows one $z$ for each $(x, y)$, so a sphere needs two halves: the bottom is $z = -\sqrt{16 - x^2 - y^2}$. Turn it to see that every horizontal slice is a circle.`,
        },
        {
          kind: "check",
          prompt: md`How far is $(2, 3, 6)$ from the origin?`,
          answer: "7",
          explain: md`$\sqrt{2^2 + 3^2 + 6^2} = \sqrt{4 + 9 + 36} = \sqrt{49} = 7$.`,
        },
        {
          kind: "check",
          prompt: md`Find the center of the sphere $x^2 + y^2 + z^2 + 6x - 2z = 6$. Give it as $(h, k, l)$.`,
          answer: "(-3, 0, 1)",
          form: "tuple",
          explain: md`$(x^2 + 6x + 9) + y^2 + (z^2 - 2z + 1) = 6 + 9 + 1$, so $(x + 3)^2 + y^2 + (z - 1)^2 = 16$. The center is $(-3, 0, 1)$ and the radius is 4. No $y$-term means $k = 0$.`,
        },
      ],
      practice: [distanceInSpace, midpointAndEndpoint, sphereCenterRadius],
    },
    {
      id: slug("Vectors and the dot product"),
      title: "Vectors and the dot product",
      summary: "Vectors with three components, the dot product, the angle formula proved from the law of cosines, and projections.",
      blocks: [
        {
          kind: "text",
          body: md`In Trigonometry you met vectors in the plane: arrows with a length and a direction, written in components $\langle a, b \rangle$. Space needs one more component. Everything you learned carries over unchanged, because every rule was about components, and now there are three of them instead of two.`,
        },
        {
          kind: "key",
          title: "Vectors in space",
          body: md`A vector $\mathbf{v} = \langle v_1, v_2, v_3 \rangle$ is an arrow from the origin to $(v_1, v_2, v_3)$, or any arrow with the same length and direction. The vector from $P$ to $Q$ is $\overrightarrow{PQ} = Q - P$, tip minus tail.

- **Sum:** $\mathbf{u} + \mathbf{v} = \langle u_1 + v_1, u_2 + v_2, u_3 + v_3 \rangle$ (tip to tail).
- **Scalar multiple:** $c\mathbf{v} = \langle cv_1, cv_2, cv_3 \rangle$ (same line, stretched by $c$; reversed if $c < 0$).
- **Length:** $|\mathbf{v}| = \sqrt{v_1^2 + v_2^2 + v_3^2}$.
- **Unit vector** in the direction of $\mathbf{v}$: $\dfrac{\mathbf{v}}{|\mathbf{v}|}$.
- **Standard basis:** $\mathbf{i} = \langle 1, 0, 0 \rangle$, $\mathbf{j} = \langle 0, 1, 0 \rangle$, $\mathbf{k} = \langle 0, 0, 1 \rangle$, so $\langle a, b, c \rangle = a\mathbf{i} + b\mathbf{j} + c\mathbf{k}$.`,
        },
        {
          kind: "why",
          title: "Why the length is a square root of three squares",
          body: md`The arrow $\langle v_1, v_2, v_3 \rangle$ runs from $(0, 0, 0)$ to $(v_1, v_2, v_3)$, so its length is the distance between those points. Lesson 1's formula with the origin as one point gives $\sqrt{v_1^2 + v_2^2 + v_3^2}$. And $|c\mathbf{v}| = \sqrt{c^2 v_1^2 + c^2 v_2^2 + c^2 v_3^2} = |c|\,|\mathbf{v}|$, which is why dividing by $|\mathbf{v}|$ produces a vector of length 1.`,
        },
        {
          kind: "key",
          title: "Dot product",
          body: md`$$\mathbf{u} \cdot \mathbf{v} = u_1 v_1 + u_2 v_2 + u_3 v_3$$

Multiply matching components and add. The result is a **number**, not a vector. From the definition, for any vectors and any number $c$:

- $\mathbf{u} \cdot \mathbf{v} = \mathbf{v} \cdot \mathbf{u}$
- $\mathbf{u} \cdot (\mathbf{v} + \mathbf{w}) = \mathbf{u} \cdot \mathbf{v} + \mathbf{u} \cdot \mathbf{w}$ and $(c\mathbf{u}) \cdot \mathbf{v} = c(\mathbf{u} \cdot \mathbf{v})$
- $\mathbf{v} \cdot \mathbf{v} = |\mathbf{v}|^2$`,
        },
        {
          kind: "why",
          title: "Why those three properties hold",
          body: md`Each is a one-line check on components. Commutativity: $u_1 v_1 = v_1 u_1$ for each term. Distributivity: $u_1(v_1 + w_1) = u_1 v_1 + u_1 w_1$ in each slot, then regroup. And $\mathbf{v} \cdot \mathbf{v} = v_1^2 + v_2^2 + v_3^2$, which is exactly $|\mathbf{v}|^2$ by the length formula.

Together these let you expand dot products like ordinary products: $(\mathbf{u} - \mathbf{v}) \cdot (\mathbf{u} - \mathbf{v}) = \mathbf{u} \cdot \mathbf{u} - 2\,\mathbf{u} \cdot \mathbf{v} + \mathbf{v} \cdot \mathbf{v}$. That expansion is the engine of the next proof.`,
        },
        dotAngleFigure,
        {
          kind: "proof",
          title: "The angle formula",
          given: md`Nonzero vectors $\mathbf{u}$ and $\mathbf{v}$ with angle $\theta$ between them ($0 \le \theta \le \pi$)`,
          prove: md`$\mathbf{u} \cdot \mathbf{v} = |\mathbf{u}|\,|\mathbf{v}| \cos\theta$`,
          steps: [
            { statement: md`Draw $\mathbf{u}$ and $\mathbf{v}$ from a common tail. Their tips are joined by the vector $\mathbf{u} - \mathbf{v}$, so the three form a triangle with side lengths $|\mathbf{u}|$, $|\mathbf{v}|$ and $|\mathbf{u} - \mathbf{v}|$, and the angle between the first two sides is $\theta$.`, reason: "Tip-to-tail subtraction: v plus (u − v) is u." },
            { statement: md`$|\mathbf{u} - \mathbf{v}|^2 = |\mathbf{u}|^2 + |\mathbf{v}|^2 - 2|\mathbf{u}|\,|\mathbf{v}| \cos\theta$`, reason: "The law of cosines (Trigonometry), applied to that triangle." },
            { statement: md`$|\mathbf{u} - \mathbf{v}|^2 = (\mathbf{u} - \mathbf{v}) \cdot (\mathbf{u} - \mathbf{v}) = |\mathbf{u}|^2 - 2\,\mathbf{u} \cdot \mathbf{v} + |\mathbf{v}|^2$`, reason: md`$\mathbf{w} \cdot \mathbf{w} = |\mathbf{w}|^2$, then expand with the distributive and commutative properties.` },
            { statement: md`$|\mathbf{u}|^2 - 2\,\mathbf{u} \cdot \mathbf{v} + |\mathbf{v}|^2 = |\mathbf{u}|^2 + |\mathbf{v}|^2 - 2|\mathbf{u}|\,|\mathbf{v}| \cos\theta$`, reason: "Both lines compute the same number." },
            { statement: md`$\mathbf{u} \cdot \mathbf{v} = |\mathbf{u}|\,|\mathbf{v}| \cos\theta$`, reason: md`Cancel $|\mathbf{u}|^2 + |\mathbf{v}|^2$ from both sides and divide by $-2$.` },
          ],
        },
        {
          kind: "key",
          title: "What the dot product tells you",
          body: md`$$\cos\theta = \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{u}|\,|\mathbf{v}|}$$

- $\mathbf{u} \cdot \mathbf{v} > 0$: acute angle. $\mathbf{u} \cdot \mathbf{v} < 0$: obtuse angle.
- $\mathbf{u} \cdot \mathbf{v} = 0$ exactly when $\mathbf{u} \perp \mathbf{v}$ (for nonzero vectors), because $\cos\theta = 0$ only at $\theta = 90^\circ$.
- $|\mathbf{u} \cdot \mathbf{v}| \le |\mathbf{u}|\,|\mathbf{v}|$ always, since $|\cos\theta| \le 1$.

The dot product was defined by arithmetic on components, with no angle in sight. The angle formula is what makes it geometric.`,
        },
        {
          kind: "example",
          title: "The angle between two vectors",
          problem: md`Find the angle between $\mathbf{u} = \langle 1, 2, 2 \rangle$ and $\mathbf{v} = \langle 2, -1, 2 \rangle$.`,
          steps: [
            { math: md`\mathbf{u} \cdot \mathbf{v} = (1)(2) + (2)(-1) + (2)(2) = 4`, note: "" },
            { math: md`|\mathbf{u}| = \sqrt{1 + 4 + 4} = 3, \qquad |\mathbf{v}| = \sqrt{4 + 1 + 4} = 3`, note: "" },
            { math: md`\cos\theta = \frac{4}{3 \cdot 3} = \frac{4}{9}`, note: "Positive, so the angle is acute." },
            { math: md`\theta = \arccos\tfrac{4}{9} \approx 63.6^\circ`, note: "Calculator, in degree mode." },
          ],
        },
        {
          kind: "key",
          title: "Projections",
          body: md`The **scalar projection** of $\mathbf{u}$ onto $\mathbf{v}$ is the signed length of $\mathbf{u}$'s shadow on the line of $\mathbf{v}$:

$$\operatorname{comp}_{\mathbf{v}} \mathbf{u} = |\mathbf{u}| \cos\theta = \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|}.$$

The **vector projection** is that shadow as a vector, pointing along $\mathbf{v}$:

$$\operatorname{proj}_{\mathbf{v}} \mathbf{u} = \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|}\cdot\frac{\mathbf{v}}{|\mathbf{v}|} = \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|^2}\,\mathbf{v}.$$

What's left, $\mathbf{u} - \operatorname{proj}_{\mathbf{v}} \mathbf{u}$, is perpendicular to $\mathbf{v}$. Every vector splits into a part along $\mathbf{v}$ and a part perpendicular to it.`,
        },
        projectionFigure,
        {
          kind: "why",
          title: "Why the projection formula is what it is",
          body: md`Drop a perpendicular from the tip of $\mathbf{u}$ to the line of $\mathbf{v}$. In the right triangle that forms, $\mathbf{u}$ is the hypotenuse and the shadow is the side adjacent to $\theta$, so the shadow's length is $|\mathbf{u}| \cos\theta$. Replace $\cos\theta$ using the angle formula: $|\mathbf{u}| \cos\theta = |\mathbf{u}| \cdot \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{u}|\,|\mathbf{v}|} = \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|}$. When $\theta$ is obtuse the cosine is negative and the shadow points against $\mathbf{v}$, which the sign records.

To make it a vector, multiply that length by the unit vector $\frac{\mathbf{v}}{|\mathbf{v}|}$. That's the second $|\mathbf{v}|$ in the denominator.

Why is the leftover perpendicular? Dot it with $\mathbf{v}$: $\left(\mathbf{u} - \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|^2}\mathbf{v}\right) \cdot \mathbf{v} = \mathbf{u} \cdot \mathbf{v} - \frac{\mathbf{u} \cdot \mathbf{v}}{|\mathbf{v}|^2}|\mathbf{v}|^2 = 0$.`,
        },
        {
          kind: "example",
          title: "A vector projection",
          problem: md`Find $\operatorname{proj}_{\mathbf{v}} \mathbf{u}$ for $\mathbf{u} = \langle 4, 1, -1 \rangle$ and $\mathbf{v} = \langle 2, 1, 2 \rangle$.`,
          steps: [
            { math: md`\mathbf{u} \cdot \mathbf{v} = 8 + 1 - 2 = 7, \qquad |\mathbf{v}|^2 = 4 + 1 + 4 = 9`, note: "" },
            { math: md`\operatorname{proj}_{\mathbf{v}} \mathbf{u} = \frac{7}{9}\langle 2, 1, 2 \rangle = \left\langle \frac{14}{9}, \frac{7}{9}, \frac{14}{9} \right\rangle`, note: md`A multiple of $\mathbf{v}$, as a projection onto $\mathbf{v}$ must be.` },
            { math: md`\mathbf{u} - \operatorname{proj}_{\mathbf{v}} \mathbf{u} = \left\langle \frac{22}{9}, \frac{2}{9}, -\frac{23}{9} \right\rangle`, note: md`Check: $\frac{44 + 2 - 46}{9} = 0$, so this part is perpendicular to $\mathbf{v}$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Compute $\langle 2, -1, 3 \rangle \cdot \langle 1, 4, -2 \rangle$.`,
          answer: "-8",
          explain: md`$(2)(1) + (-1)(4) + (3)(-2) = 2 - 4 - 6 = -8$. Negative, so the angle between them is obtuse.`,
        },
        {
          kind: "check",
          prompt: md`Find $k$ so that $\langle k, 2, -1 \rangle$ is perpendicular to $\langle 3, 1, 4 \rangle$.`,
          answer: "2/3",
          explain: md`Perpendicular means the dot product is zero: $3k + 2 - 4 = 0$, so $k = \frac{2}{3}$.`,
        },
      ],
      practice: [dotProducts, angleBetween, projectionOnto],
    },
    {
      id: slug("The cross product"),
      title: "The cross product",
      summary: "A vector perpendicular to two given ones: the determinant definition, why it works, its length as an area, and the right-hand rule.",
      blocks: [
        {
          kind: "text",
          body: md`The dot product takes two vectors and gives a number. Space has room for a second product that gives a **vector**, and it answers a question that comes up constantly: given two vectors, find a third perpendicular to both. In the plane that question has no good answer (there is no room). In space there is exactly one direction perpendicular to two non-parallel vectors, and the cross product points along it.`,
        },
        {
          kind: "key",
          title: "Cross product",
          body: md`For $\mathbf{u} = \langle u_1, u_2, u_3 \rangle$ and $\mathbf{v} = \langle v_1, v_2, v_3 \rangle$,

$$\mathbf{u} \times \mathbf{v} = \begin{vmatrix} \mathbf{i} & \mathbf{j} & \mathbf{k} \\ u_1 & u_2 & u_3 \\ v_1 & v_2 & v_3 \end{vmatrix} = (u_2 v_3 - u_3 v_2)\,\mathbf{i} - (u_1 v_3 - u_3 v_1)\,\mathbf{j} + (u_1 v_2 - u_2 v_1)\,\mathbf{k}.$$

The determinant is a memory device: expand along the top row, and each component is the $2 \times 2$ determinant left when you cover that component's column. The middle term has a minus sign. The cross product is only defined in three dimensions.`,
        },
        {
          kind: "example",
          title: "Computing a cross product",
          problem: md`Compute $\langle 1, 2, 3 \rangle \times \langle 4, 5, 6 \rangle$.`,
          steps: [
            { math: md`\begin{vmatrix} \mathbf{i} & \mathbf{j} & \mathbf{k} \\ 1 & 2 & 3 \\ 4 & 5 & 6 \end{vmatrix}`, note: "Set up the determinant." },
            { math: md`= (2 \cdot 6 - 3 \cdot 5)\,\mathbf{i} - (1 \cdot 6 - 3 \cdot 4)\,\mathbf{j} + (1 \cdot 5 - 2 \cdot 4)\,\mathbf{k}`, note: "Cover the i column for the i component, and so on. Don't forget the minus on j." },
            { math: md`= -3\,\mathbf{i} + 6\,\mathbf{j} - 3\,\mathbf{k} = \langle -3, 6, -3 \rangle`, note: "" },
            { math: md`\langle -3, 6, -3 \rangle \cdot \langle 1, 2, 3 \rangle = -3 + 12 - 9 = 0, \qquad \langle -3, 6, -3 \rangle \cdot \langle 4, 5, 6 \rangle = -12 + 30 - 18 = 0`, note: "Always check: the result must be perpendicular to both inputs." },
          ],
        },
        {
          kind: "proof",
          title: "The cross product is perpendicular to both factors",
          given: md`$\mathbf{u} = \langle u_1, u_2, u_3 \rangle$, $\mathbf{v} = \langle v_1, v_2, v_3 \rangle$, and $\mathbf{w} = \mathbf{u} \times \mathbf{v}$`,
          prove: md`$\mathbf{w} \cdot \mathbf{u} = 0$ and $\mathbf{w} \cdot \mathbf{v} = 0$`,
          steps: [
            { statement: md`$\mathbf{w} = \langle u_2 v_3 - u_3 v_2,\; u_3 v_1 - u_1 v_3,\; u_1 v_2 - u_2 v_1 \rangle$`, reason: "The definition, with the j component's minus sign distributed." },
            { statement: md`$\mathbf{w} \cdot \mathbf{u} = u_1(u_2 v_3 - u_3 v_2) + u_2(u_3 v_1 - u_1 v_3) + u_3(u_1 v_2 - u_2 v_1)$`, reason: "Definition of the dot product." },
            { statement: md`$= u_1 u_2 v_3 - u_1 u_3 v_2 + u_2 u_3 v_1 - u_1 u_2 v_3 + u_1 u_3 v_2 - u_2 u_3 v_1 = 0$`, reason: "Expand. Every term appears twice with opposite signs." },
            { statement: md`$\mathbf{w} \cdot \mathbf{v} = v_1(u_2 v_3 - u_3 v_2) + v_2(u_3 v_1 - u_1 v_3) + v_3(u_1 v_2 - u_2 v_1) = 0$`, reason: "The same cancellation with v in place of u." },
            { statement: md`$\mathbf{w} \perp \mathbf{u}$ and $\mathbf{w} \perp \mathbf{v}$`, reason: "Zero dot product means perpendicular (Lesson 2)." },
          ],
        },
        {
          kind: "why",
          title: "Why swapping the factors flips the sign",
          body: md`Swapping $\mathbf{u}$ and $\mathbf{v}$ swaps the two bottom rows of the determinant. Each $2 \times 2$ minor $u_i v_j - u_j v_i$ becomes $v_i u_j - v_j u_i$, its negative. So

$$\mathbf{v} \times \mathbf{u} = -(\mathbf{u} \times \mathbf{v}).$$

The cross product is **not** commutative; it is anti-commutative. In particular $\mathbf{u} \times \mathbf{u} = -(\mathbf{u} \times \mathbf{u})$, which forces $\mathbf{u} \times \mathbf{u} = \mathbf{0}$. More generally, parallel vectors have cross product $\mathbf{0}$: if $\mathbf{v} = c\mathbf{u}$ then every minor is $u_i (c u_j) - u_j (c u_i) = 0$.

The distributive laws $\mathbf{u} \times (\mathbf{v} + \mathbf{w}) = \mathbf{u} \times \mathbf{v} + \mathbf{u} \times \mathbf{w}$ and $(c\mathbf{u}) \times \mathbf{v} = c(\mathbf{u} \times \mathbf{v})$ hold too, since each minor is linear in each row.`,
        },
        {
          kind: "proof",
          title: "The length of the cross product",
          given: md`Nonzero vectors $\mathbf{u}$, $\mathbf{v}$ with angle $\theta$ between them`,
          prove: md`$|\mathbf{u} \times \mathbf{v}| = |\mathbf{u}|\,|\mathbf{v}| \sin\theta$`,
          steps: [
            { statement: md`$|\mathbf{u} \times \mathbf{v}|^2 = (u_2 v_3 - u_3 v_2)^2 + (u_3 v_1 - u_1 v_3)^2 + (u_1 v_2 - u_2 v_1)^2$`, reason: "Length squared is the sum of the squared components." },
            { statement: md`$= (u_1^2 + u_2^2 + u_3^2)(v_1^2 + v_2^2 + v_3^2) - (u_1 v_1 + u_2 v_2 + u_3 v_3)^2$`, reason: md`Expand both sides fully: each has the six terms $u_i^2 v_j^2$ ($i \ne j$) and the cross terms $-2u_i u_j v_i v_j$. The nine products $u_i^2 v_i^2$ cancel on the right. (Lagrange's identity.)` },
            { statement: md`$= |\mathbf{u}|^2 |\mathbf{v}|^2 - (\mathbf{u} \cdot \mathbf{v})^2$`, reason: "Definitions of length and dot product." },
            { statement: md`$= |\mathbf{u}|^2 |\mathbf{v}|^2 - |\mathbf{u}|^2 |\mathbf{v}|^2 \cos^2\theta = |\mathbf{u}|^2 |\mathbf{v}|^2 \sin^2\theta$`, reason: md`The angle formula for $\mathbf{u} \cdot \mathbf{v}$, then $1 - \cos^2\theta = \sin^2\theta$.` },
            { statement: md`$|\mathbf{u} \times \mathbf{v}| = |\mathbf{u}|\,|\mathbf{v}| \sin\theta$`, reason: md`Take square roots; $\sin\theta \ge 0$ because $0 \le \theta \le \pi$.` },
          ],
        },
        parallelogramFigure,
        {
          kind: "key",
          title: "The geometry of u × v",
          body: md`- **Direction:** perpendicular to both $\mathbf{u}$ and $\mathbf{v}$, by the **right-hand rule**: point your fingers along $\mathbf{u}$, curl them toward $\mathbf{v}$, and your thumb gives $\mathbf{u} \times \mathbf{v}$.
- **Length:** $|\mathbf{u} \times \mathbf{v}| = |\mathbf{u}|\,|\mathbf{v}| \sin\theta$, the **area of the parallelogram** spanned by $\mathbf{u}$ and $\mathbf{v}$. The triangle with those two sides has half that area.
- $\mathbf{u} \times \mathbf{v} = \mathbf{0}$ exactly when $\mathbf{u}$ and $\mathbf{v}$ are parallel (or one is zero).
- $\mathbf{i} \times \mathbf{j} = \mathbf{k}$, $\mathbf{j} \times \mathbf{k} = \mathbf{i}$, $\mathbf{k} \times \mathbf{i} = \mathbf{j}$; reverse any pair and the sign flips.`,
        },
        {
          kind: "why",
          title: "Why the right-hand rule",
          body: md`Perpendicular to both leaves two possible directions, opposite to each other, and the formula picks one. Which? Compute $\mathbf{i} \times \mathbf{j}$: the only nonzero minor is $u_1 v_2 - u_2 v_1 = 1 \cdot 1 - 0 \cdot 0 = 1$, so $\mathbf{i} \times \mathbf{j} = \mathbf{k}$. Fingers along $\mathbf{i}$, curled toward $\mathbf{j}$, thumb along $\mathbf{k}$: that's the right-handed axes of Lesson 1.

Now turn $\mathbf{i}$ and $\mathbf{j}$ continuously into any other non-parallel pair $\mathbf{u}, \mathbf{v}$ without ever letting them become parallel. The cross product changes continuously with the components and never becomes $\mathbf{0}$ along the way (it is $\mathbf{0}$ only for parallel vectors), so it can't jump to the opposite side. The right-hand rule that held at the start still holds at the end.`,
        },
        {
          kind: "key",
          title: "The scalar triple product",
          body: md`$$\mathbf{u} \cdot (\mathbf{v} \times \mathbf{w}) = \begin{vmatrix} u_1 & u_2 & u_3 \\ v_1 & v_2 & v_3 \\ w_1 & w_2 & w_3 \end{vmatrix}$$

Its absolute value is the **volume of the parallelepiped** (the slanted box) with edges $\mathbf{u}$, $\mathbf{v}$, $\mathbf{w}$. It is zero exactly when the three vectors lie in one plane.`,
        },
        {
          kind: "why",
          title: "Why the triple product is a volume",
          body: md`Take $\mathbf{v}$ and $\mathbf{w}$ as the base. Its area is $|\mathbf{v} \times \mathbf{w}|$, and $\mathbf{v} \times \mathbf{w}$ points straight up from it. The box's height is how far $\mathbf{u}$ rises above the base, which is the length of the projection of $\mathbf{u}$ onto that normal: $|\mathbf{u}|\,|\cos\varphi|$, where $\varphi$ is the angle between $\mathbf{u}$ and $\mathbf{v} \times \mathbf{w}$. So

$$V = (\text{base})(\text{height}) = |\mathbf{v} \times \mathbf{w}|\,|\mathbf{u}| \,|\cos\varphi| = |\mathbf{u} \cdot (\mathbf{v} \times \mathbf{w})|$$

by the angle formula. The determinant form comes from writing out $\mathbf{u} \cdot (\mathbf{v} \times \mathbf{w})$ component by component: it is exactly the cofactor expansion along the first row. If the three vectors are coplanar, $\mathbf{u}$ has no height above the base and the volume is 0.`,
        },
        {
          kind: "example",
          title: "Area of a triangle in space",
          problem: md`Find the area of the triangle with vertices $P = (1, 0, 0)$, $Q = (0, 2, 0)$ and $R = (0, 0, 3)$.`,
          steps: [
            { math: md`\overrightarrow{PQ} = \langle -1, 2, 0 \rangle, \qquad \overrightarrow{PR} = \langle -1, 0, 3 \rangle`, note: "Two sides from the same vertex." },
            { math: md`\overrightarrow{PQ} \times \overrightarrow{PR} = \begin{vmatrix} \mathbf{i} & \mathbf{j} & \mathbf{k} \\ -1 & 2 & 0 \\ -1 & 0 & 3 \end{vmatrix} = \langle 6, 3, 2 \rangle`, note: md`$(2 \cdot 3 - 0)\mathbf{i} - (-3 - 0)\mathbf{j} + (0 - (-2))\mathbf{k}$.` },
            { math: md`A = \tfrac12 |\langle 6, 3, 2 \rangle| = \tfrac12 \sqrt{36 + 9 + 4} = \tfrac{7}{2}`, note: "The parallelogram has area 7; the triangle is half of it." },
          ],
        },
        {
          kind: "check",
          prompt: md`Compute $\langle 2, 0, 1 \rangle \times \langle 1, 3, 0 \rangle$. Give it as $(a, b, c)$.`,
          answer: "(-3, 1, 6)",
          form: "tuple",
          explain: md`$(0 \cdot 0 - 1 \cdot 3)\mathbf{i} - (2 \cdot 0 - 1 \cdot 1)\mathbf{j} + (2 \cdot 3 - 0 \cdot 1)\mathbf{k} = \langle -3, 1, 6 \rangle$. Check: $-6 + 0 + 6 = 0$ and $-3 + 3 + 0 = 0$.`,
        },
        {
          kind: "check",
          prompt: md`Find the area of the parallelogram spanned by $\langle 1, 1, 0 \rangle$ and $\langle 0, 1, 1 \rangle$. Give the exact value.`,
          answer: "sqrt(3)",
          explain: md`The cross product is $\langle 1 \cdot 1 - 0, -(1 \cdot 1 - 0), 1 \cdot 1 - 0 \rangle = \langle 1, -1, 1 \rangle$, of length $\sqrt{3}$.`,
        },
      ],
      practice: [crossProducts, areasFromCross, volumesAndCoplanar],
    },
    {
      id: slug("Lines and planes"),
      title: "Lines and planes",
      summary: "A line from a point and a direction, a plane from a point and a normal, and the distance from a point to a plane.",
      blocks: [
        {
          kind: "text",
          body: md`In the plane a line has a slope. In space "slope" doesn't make sense: a line can tilt in too many ways for one number. What works instead is a **direction vector**. A line is determined by one point on it and one vector along it.`,
        },
        {
          kind: "key",
          title: "Equations of a line",
          body: md`The line through $P_0 = (x_0, y_0, z_0)$ with direction $\mathbf{v} = \langle a, b, c \rangle$:

- **Vector form:** $\mathbf{r}(t) = \mathbf{r}_0 + t\mathbf{v}$, where $\mathbf{r}_0 = \langle x_0, y_0, z_0 \rangle$.
- **Parametric form:** $x = x_0 + at, \quad y = y_0 + bt, \quad z = z_0 + ct$.
- **Symmetric form** (when $a, b, c \ne 0$): $\dfrac{x - x_0}{a} = \dfrac{y - y_0}{b} = \dfrac{z - z_0}{c}$, which is the parametric form with $t$ eliminated.

Through two points $P$ and $Q$, use $\mathbf{v} = \overrightarrow{PQ}$. Then $t = 0$ gives $P$, $t = 1$ gives $Q$, and $0 \le t \le 1$ is the segment.`,
        },
        {
          kind: "why",
          title: "Why r₀ + tv covers exactly the line",
          body: md`Start at $P_0$ and add $t\mathbf{v}$. For $t = 1$ you move one copy of $\mathbf{v}$ along it; for $t = 2$, two copies; for $t = -\tfrac12$, half a copy backwards. Every multiple of $\mathbf{v}$ points along the same line through $P_0$, and every point of that line is some multiple of $\mathbf{v}$ away from $P_0$. So the tips of $\mathbf{r}_0 + t\mathbf{v}$, over all real $t$, are exactly the line.

Think of $t$ as time: $\mathbf{r}(t)$ is the position of a particle that starts at $P_0$ and moves with constant velocity $\mathbf{v}$. Different direction vectors for the same line (say $\mathbf{v}$ and $2\mathbf{v}$) give different speeds but trace the same path, so one line has many parametrizations.`,
        },
        {
          kind: "example",
          title: "A line through two points",
          problem: md`Find parametric equations for the line through $P = (1, 2, 3)$ and $Q = (4, 0, 5)$, and find where it crosses the $xy$-plane.`,
          steps: [
            { math: md`\mathbf{v} = \overrightarrow{PQ} = \langle 3, -2, 2 \rangle`, note: "Tip minus tail." },
            { math: md`x = 1 + 3t, \quad y = 2 - 2t, \quad z = 3 + 2t`, note: md`Start at $P$, move $t$ copies of $\mathbf{v}$.` },
            { math: md`z = 0 \;\Rightarrow\; 3 + 2t = 0 \;\Rightarrow\; t = -\tfrac32`, note: md`The $xy$-plane is $z = 0$.` },
            { math: md`\left(1 - \tfrac92,\; 2 + 3,\; 0\right) = \left(-\tfrac72, 5, 0\right)`, note: md`Substitute $t = -\frac32$ into $x$ and $y$. Negative $t$: the crossing is behind $P$, on the far side from $Q$.` },
          ],
        },
        {
          kind: "text",
          body: md`Two lines in space are **parallel** if their direction vectors are multiples of each other. If not, they either **intersect** or are **skew**: not parallel and never meeting, like two flight paths at different altitudes. To tell which, set the parametric equations equal (with *different* parameter names, $t$ and $s$, since the two particles needn't arrive at the same time) and see whether the three equations have a common solution.

A plane is the other basic flat object. The cleanest way to pin one down is also a point and a vector, but now the vector stands **perpendicular** to the plane.`,
        },
        {
          kind: "key",
          title: "Equation of a plane",
          body: md`The plane through $P_0 = (x_0, y_0, z_0)$ with **normal vector** $\mathbf{n} = \langle a, b, c \rangle$:

$$\mathbf{n} \cdot (\mathbf{r} - \mathbf{r}_0) = 0 \qquad\text{that is}\qquad a(x - x_0) + b(y - y_0) + c(z - z_0) = 0,$$

which rearranges to $ax + by + cz = d$ with $d = ax_0 + by_0 + cz_0 = \mathbf{n} \cdot \mathbf{r}_0$.

Read the normal straight off the equation: the coefficients of $x, y, z$. Any nonzero multiple of $\mathbf{n}$ is also a normal, so $2x + 4y - 6z = 2$ and $x + 2y - 3z = 1$ are the same plane. Two planes are parallel when their normals are, and the angle between two planes is the angle between their normals.`,
        },
        {
          kind: "why",
          title: "Why n · (r − r₀) = 0 describes the plane",
          body: md`Take any point $P$ on the plane and the vector $\mathbf{r} - \mathbf{r}_0 = \overrightarrow{P_0 P}$ from $P_0$ to it. That vector lies *in* the plane, and $\mathbf{n}$ is perpendicular to everything in the plane, so their dot product is 0.

Conversely, if a point $P$ satisfies $\mathbf{n} \cdot (\mathbf{r} - \mathbf{r}_0) = 0$ then $\overrightarrow{P_0 P}$ is perpendicular to $\mathbf{n}$, and the vectors perpendicular to one fixed direction through $P_0$ fill out exactly one plane. So the equation holds for the plane's points and for no others.

A plane through **three points** $P, Q, R$ has normal $\overrightarrow{PQ} \times \overrightarrow{PR}$, since both vectors lie in the plane and the cross product is perpendicular to both (Lesson 3). That is the most common way to find $\mathbf{n}$.`,
        },
        {
          kind: "surface",
          x: [-3, 3],
          y: [-3, 3],
          z: [-6, 10],
          expr: "2 - a x - b y",
          params: [
            { name: "a", min: -2, max: 2, step: 0.5, value: 1 },
            { name: "b", min: -2, max: 2, step: 0.5, value: 0.5 },
          ],
          caption: md`The plane $ax + by + z = 2$, with normal $\langle a, b, 1 \rangle$, drawn as $z = 2 - ax - by$. Slide $a$ and $b$: the normal tilts and the plane tilts with it, staying perpendicular to its normal. At $a = b = 0$ the normal is straight up and the plane is horizontal.`,
        },
        {
          kind: "example",
          title: "A plane through three points",
          problem: md`Find an equation of the plane through $P = (1, 0, 0)$, $Q = (0, 2, 0)$ and $R = (0, 0, 3)$.`,
          steps: [
            { math: md`\overrightarrow{PQ} = \langle -1, 2, 0 \rangle, \qquad \overrightarrow{PR} = \langle -1, 0, 3 \rangle`, note: "Two vectors in the plane." },
            { math: md`\mathbf{n} = \overrightarrow{PQ} \times \overrightarrow{PR} = \langle 6, 3, 2 \rangle`, note: "Computed in Lesson 3. Perpendicular to both, so perpendicular to the plane." },
            { math: md`6(x - 1) + 3(y - 0) + 2(z - 0) = 0`, note: md`$\mathbf{n} \cdot (\mathbf{r} - \mathbf{r}_0) = 0$ with $P$ as the point.` },
            { math: md`6x + 3y + 2z = 6`, note: md`Check all three points: $6 = 6$, $3 \cdot 2 = 6$, $2 \cdot 3 = 6$.` },
          ],
        },
        planeDistanceFigure,
        {
          kind: "proof",
          title: "Distance from a point to a plane",
          given: md`The plane $ax + by + cz = d$ and a point $P_1 = (x_1, y_1, z_1)$`,
          prove: md`The distance from $P_1$ to the plane is $D = \dfrac{|ax_1 + by_1 + cz_1 - d|}{\sqrt{a^2 + b^2 + c^2}}$`,
          steps: [
            { statement: md`Let $\mathbf{n} = \langle a, b, c \rangle$ and pick any point $P_0 = (x_0, y_0, z_0)$ on the plane, so $ax_0 + by_0 + cz_0 = d$.`, reason: "The coefficients are a normal; the plane is nonempty." },
            { statement: md`$D = |\operatorname{comp}_{\mathbf{n}} \overrightarrow{P_0 P_1}| = \dfrac{|\mathbf{n} \cdot \overrightarrow{P_0 P_1}|}{|\mathbf{n}|}$`, reason: md`The shortest path from $P_1$ to the plane is the perpendicular, which runs along $\mathbf{n}$. Its length is the size of the shadow of $\overrightarrow{P_0 P_1}$ on $\mathbf{n}$ (Lesson 2).` },
            { statement: md`$\mathbf{n} \cdot \overrightarrow{P_0 P_1} = a(x_1 - x_0) + b(y_1 - y_0) + c(z_1 - z_0) = (ax_1 + by_1 + cz_1) - (ax_0 + by_0 + cz_0)$`, reason: "Expand and regroup." },
            { statement: md`$= ax_1 + by_1 + cz_1 - d$`, reason: md`$P_0$ is on the plane.` },
            { statement: md`$D = \dfrac{|ax_1 + by_1 + cz_1 - d|}{\sqrt{a^2 + b^2 + c^2}}$`, reason: md`Substitute, with $|\mathbf{n}| = \sqrt{a^2 + b^2 + c^2}$. The choice of $P_0$ dropped out, as it must.` },
          ],
        },
        {
          kind: "example",
          title: "Distance to a plane",
          problem: md`Find the distance from $(2, -1, 3)$ to the plane $6x + 3y + 2z = 6$.`,
          steps: [
            { math: md`6(2) + 3(-1) + 2(3) - 6 = 12 - 3 + 6 - 6 = 9`, note: "How much the plane's equation misses at the point. Nonzero, so the point is off the plane." },
            { math: md`|\mathbf{n}| = \sqrt{36 + 9 + 4} = 7`, note: "" },
            { math: md`D = \frac{9}{7}`, note: md`The numerator's sign (here $+$) tells which side of the plane the point is on: the side $\mathbf{n}$ points to.` },
          ],
        },
        {
          kind: "text",
          body: md`**Where a line meets a plane.** Substitute the line's parametric equations into the plane's equation. The result is one linear equation in $t$: one solution means one crossing point; no solution means the line is parallel to the plane and misses it; every $t$ a solution means the line lies in the plane. The **closest point** on a plane to $P_1$ is found the same way, using the line through $P_1$ in the direction of $\mathbf{n}$.`,
        },
        {
          kind: "check",
          prompt: md`Find $d$ so that $3x + 2y - z = d$ is the plane through $(1, -1, 2)$ with normal $\langle 3, 2, -1 \rangle$.`,
          answer: "-1",
          explain: md`$d = \mathbf{n} \cdot \mathbf{r}_0 = 3(1) + 2(-1) + (-1)(2) = 3 - 2 - 2 = -1$.`,
        },
        {
          kind: "check",
          prompt: md`On the line $\mathbf{r}(t) = \langle 1, 2, 3 \rangle + t\langle 2, -1, 4 \rangle$, find the point at $t = 2$. Give it as $(x, y, z)$.`,
          answer: "(5, 0, 11)",
          form: "tuple",
          explain: md`$\langle 1 + 4, 2 - 2, 3 + 8 \rangle = \langle 5, 0, 11 \rangle$.`,
        },
      ],
      practice: [pointsOnLines, planeThroughPoints, linesMeetPlanes],
    },
    {
      id: slug("Surfaces"),
      title: "Surfaces",
      summary: "Cylinders from a missing variable, traces as slices, and the six quadric surfaces.",
      blocks: [
        {
          kind: "text",
          body: md`Planes and spheres are the two surfaces you can already draw. This lesson adds the rest of the standard catalog: **cylinders**, and the **quadric surfaces**, the graphs of second-degree equations in $x$, $y$ and $z$. The tool for understanding any of them is the same: slice.`,
        },
        {
          kind: "key",
          title: "Cylinders",
          body: md`When one variable is **missing** from an equation, the surface is a **cylinder**: the curve the equation draws in the plane of the other two variables, swept parallel to the missing variable's axis. The parallel lines on it are called **rulings**.

$x^2 + y^2 = 1$ is a round cylinder around the $z$-axis. $z = x^2$ is a parabolic cylinder running parallel to the $y$-axis. $y = \sin x$ is a wavy sheet.`,
        },
        {
          kind: "proof",
          title: "A missing variable gives a cylinder",
          given: md`An equation $F(x, y) = 0$ in which $z$ does not appear, and a point $(x_0, y_0, z_0)$ satisfying it`,
          prove: md`The whole vertical line through $(x_0, y_0, z_0)$ lies on the surface`,
          steps: [
            { statement: md`Any point of that vertical line is $(x_0, y_0, z)$ for some $z$.`, reason: "A vertical line keeps x and y fixed." },
            { statement: md`$F(x_0, y_0) = 0$`, reason: "The given point satisfies the equation, and the equation only involves x and y." },
            { statement: md`So $(x_0, y_0, z)$ satisfies the equation for every $z$.`, reason: md`The equation doesn't mention $z$, so changing $z$ can't break it.` },
            { statement: md`The surface is the plane curve $F(x, y) = 0$ with a vertical line through each of its points: a cylinder with rulings parallel to the $z$-axis.`, reason: "Previous line, applied at every point of the curve." },
          ],
        },
        {
          kind: "surface",
          x: [-2, 2],
          y: [-3, 3],
          z: [0, 4],
          expr: "x^2",
          caption: md`The parabolic cylinder $z = x^2$. The variable $y$ is missing, so the parabola in the $xz$-plane is repeated at every $y$. Turn the surface: the rulings run parallel to the $y$-axis.`,
        },
        {
          kind: "key",
          title: "Traces",
          body: md`A **trace** of a surface is its intersection with a plane, usually a coordinate plane or a plane parallel to one: set $x = k$, $y = k$ or $z = k$ in the equation and you get the equation of a curve in that slice. Horizontal traces $z = k$ are the **level curves** you'll meet again in Unit 3. A surface is understood when you know what its traces look like in all three directions.`,
        },
        {
          kind: "text",
          body: md`**Quadric surfaces.** A second-degree equation in $x, y, z$ describes a quadric surface. After rotating and shifting axes, every nondegenerate one is one of six types. In the standard forms below, $a, b, c$ are positive constants, and the role of $z$ (the axis of the surface) can be played by any variable.

- **Ellipsoid:** $\dfrac{x^2}{a^2} + \dfrac{y^2}{b^2} + \dfrac{z^2}{c^2} = 1$. A sphere is the case $a = b = c$.
- **Elliptic paraboloid:** $\dfrac{z}{c} = \dfrac{x^2}{a^2} + \dfrac{y^2}{b^2}$. A bowl.
- **Hyperbolic paraboloid:** $\dfrac{z}{c} = \dfrac{x^2}{a^2} - \dfrac{y^2}{b^2}$. A saddle.
- **Cone:** $\dfrac{z^2}{c^2} = \dfrac{x^2}{a^2} + \dfrac{y^2}{b^2}$.
- **Hyperboloid of one sheet:** $\dfrac{x^2}{a^2} + \dfrac{y^2}{b^2} - \dfrac{z^2}{c^2} = 1$. A tube with a waist.
- **Hyperboloid of two sheets:** $-\dfrac{x^2}{a^2} - \dfrac{y^2}{b^2} + \dfrac{z^2}{c^2} = 1$. Two bowls facing away from each other.`,
        },
        {
          kind: "surface",
          x: [-4, 4],
          y: [-3, 3],
          z: [0, 9],
          expr: "x^2/a + y^2/b",
          params: [
            { name: "a", min: 1, max: 4, step: 1, value: 4 },
            { name: "b", min: 1, max: 4, step: 1, value: 1 },
          ],
          caption: md`The elliptic paraboloid $z = \frac{x^2}{a} + \frac{y^2}{b}$. Slide $a$ and $b$ to stretch it. Vertical slices are parabolas; horizontal slices are ellipses that grow with height.`,
        },
        {
          kind: "contour",
          x: [-4, 4],
          y: [-3, 3],
          expr: "x^2/4 + y^2",
          levels: [0.5, 1, 2, 3, 4, 6, 8],
          caption: md`Horizontal traces of $z = \frac{x^2}{4} + y^2$, seen from above: the curves $\frac{x^2}{4} + y^2 = k$ for several heights $k$. Each is an ellipse twice as wide as it is tall, and they spread out as $k$ grows because the surface gets steeper away from the center.`,
        },
        {
          kind: "why",
          title: "Why the paraboloid's traces are ellipses and parabolas",
          body: md`Take $z = \frac{x^2}{4} + y^2$. Set $z = k$: $\frac{x^2}{4} + y^2 = k$, which for $k > 0$ is an ellipse with semi-axes $2\sqrt{k}$ and $\sqrt{k}$ (divide by $k$ to see the standard form). For $k = 0$ it is a single point, and for $k < 0$ there are no points: the surface sits above the $xy$-plane.

Set $x = k$ instead: $z = y^2 + \frac{k^2}{4}$, a parabola opening upward, shifted up by $\frac{k^2}{4}$. Set $y = k$: $z = \frac{x^2}{4} + k^2$, another parabola. Ellipses one way, parabolas the other: an *elliptic paraboloid*. The naming rule is the same for every quadric: the traces name the surface.`,
        },
        {
          kind: "surface",
          x: [-2, 2],
          y: [-2, 2],
          z: [-4, 4],
          expr: "x^2 - y^2",
          caption: md`The hyperbolic paraboloid $z = x^2 - y^2$. Along the $x$-direction it curves up; along the $y$-direction it curves down. The origin is a saddle point: the bottom of one parabola and the top of another.`,
        },
        {
          kind: "contour",
          x: [-3, 3],
          y: [-3, 3],
          expr: "x^2 - y^2",
          levels: [-4, -2, -1, 0, 1, 2, 4],
          caption: md`Horizontal traces of the saddle: $x^2 - y^2 = k$. For $k > 0$ the hyperbolas open left and right; for $k < 0$ they open up and down. At $k = 0$ the trace is the pair of lines $y = \pm x$, where the surface crosses its own height.`,
        },
        {
          kind: "surface",
          x: [-3, 3],
          y: [-3, 3],
          z: [0, 4],
          expr: "sqrt(x^2 + y^2 - c)",
          params: [{ name: "c", min: -2, max: 2, step: 0.5, value: 1 }],
          caption: md`The upper half of $x^2 + y^2 - z^2 = c$, drawn as $z = \sqrt{x^2 + y^2 - c}$. At $c = 1$ it's a hyperboloid of one sheet (the horizontal trace at $z = 0$ is a circle of radius 1, the waist). Slide $c$ to $0$ and the waist pinches to a point: a cone. Push $c$ negative and the top pulls free of the bottom: the upper bowl of a hyperboloid of two sheets. The three surfaces are one family.`,
        },
        {
          kind: "key",
          title: "Identifying a quadric",
          body: md`Put the equation in a standard form (divide so the constant is 1 or 0, or isolate the unsquared variable), then look:

- One variable **not squared**, the other two squared: a paraboloid. Same signs: elliptic. Opposite signs: hyperbolic. Its axis is the unsquared variable's.
- Three squares, constant **1**: all positive is an ellipsoid; one negative is one sheet; two negative is two sheets. The odd-signed variable is the axis.
- Three squares, constant **0**, mixed signs: a cone, with axis along the odd-signed variable.
- A variable **missing**: a cylinder, with rulings parallel to that axis.`,
        },
        {
          kind: "example",
          title: "Classifying from the equation",
          problem: md`Identify $4x^2 + y^2 - z^2 = 4$ and describe its horizontal traces.`,
          steps: [
            { math: md`x^2 + \frac{y^2}{4} - \frac{z^2}{4} = 1`, note: "Divide by 4 so the constant is 1." },
            { math: md`\text{two positive squares, one negative, constant } 1`, note: "A hyperboloid of one sheet. Its axis is the z-axis, the odd-signed variable." },
            { math: md`z = k: \quad x^2 + \frac{y^2}{4} = 1 + \frac{k^2}{4}`, note: md`Every horizontal trace is an ellipse, smallest at $k = 0$ (the waist) and growing with $|k|$. That's why it's one connected sheet.` },
          ],
        },
        {
          kind: "example",
          title: "A paraboloid opening down",
          problem: md`Identify $z = 4 - x^2 - y^2$ and find its trace in the $xy$-plane.`,
          steps: [
            { math: md`z - 4 = -(x^2 + y^2)`, note: md`$z$ is unsquared and $x^2, y^2$ have the same sign: an elliptic (here circular) paraboloid. The minus sign means it opens downward from its top at $(0, 0, 4)$.` },
            { math: md`z = 0: \quad x^2 + y^2 = 4`, note: md`The trace in the $xy$-plane is a circle of radius 2.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Which kind of surface is $\dfrac{x^2}{9} + \dfrac{y^2}{4} + z^2 = 1$?`,
          choices: QUADRICS,
          accept: ["ellipsoid"],
          explain: md`Three squared terms, all positive, equal to 1: an ellipsoid with semi-axes 3, 2 and 1.`,
        },
        {
          kind: "check",
          prompt: md`The trace of $z = x^2 + y^2$ in the plane $z = 9$ is a circle. What is its radius?`,
          answer: "3",
          explain: md`Set $z = 9$: $x^2 + y^2 = 9$, a circle of radius $\sqrt{9} = 3$.`,
        },
      ],
      practice: [classifyQuadric, traceRadius, surfaceAxis],
    },
  ],
};
