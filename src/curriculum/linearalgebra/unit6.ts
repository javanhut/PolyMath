import { frac, fracTex, gcd, paren, poly, type Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

type Vec = number[];

const dot = (u: Vec, v: Vec) => u.reduce((s, a, i) => s + a * v[i]!, 0);
const cross = (u: Vec, v: Vec): Vec => [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
const isZero = (v: Vec) => v.every((a) => a === 0);
const vec = (v: (number | string)[]) => `\\langle ${v.join(", ")} \\rangle`;
const tuple = (parts: string[]) => `(${parts.join(", ")})`;
const P = paren;

function rvec(r: Rng, n: number, lo: number, hi: number): Vec {
  for (;;) {
    const v = Array.from({ length: n }, () => r.int(lo, hi));
    if (!isZero(v)) return v;
  }
}

/** A sum of products written out, like "2 \cdot 3 + (-1) \cdot 4". */
const products = (u: Vec, v: Vec) => u.map((a, i) => `${P(a)} \\cdot ${P(v[i]!)}`).join(" + ");
/** A sum of squares written out, like "3^2 + (-4)^2". */
const squares = (v: Vec) => v.map((a) => `${P(a)}^2`).join(" + ");
/** The same sum of squares in answer syntax, for verify equations. */
const squaresText = (v: Vec) => v.map((a) => `(${a})^2`).join(" + ");

// Exact fractions.
interface Fr {
  n: number;
  d: number;
}
function fr(n: number, d = 1): Fr {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const fadd = (a: Fr, b: Fr) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const fsub = (a: Fr, b: Fr) => fr(a.n * b.d - b.n * a.d, a.d * b.d);
const fmul = (a: Fr, b: Fr) => fr(a.n * b.n, a.d * b.d);
const fdiv = (a: Fr, b: Fr) => fr(a.n * b.d, a.d * b.n);
const ftex = (a: Fr) => fracTex(a.n, a.d);
const ftxt = (a: Fr) => frac(a.n, a.d);
const fdot = (u: Fr[], v: Fr[]) => u.reduce((s, a, i) => fadd(s, fmul(a, v[i]!)), fr(0));
const fscale = (c: Fr, v: Fr[]) => v.map((a) => fmul(c, a));
const fvsub = (u: Fr[], v: Fr[]) => u.map((a, i) => fsub(a, v[i]!));
const toF = (v: Vec) => v.map((n) => fr(n));
/** The biggest denominator in a vector of fractions: a friendliness test. */
const maxDen = (v: Fr[]) => Math.max(...v.map((x) => x.d));
const fvec = (v: Fr[]) => vec(v.map(ftex));
const ftuple = (v: Fr[]) => tuple(v.map(ftxt));
/** A fraction in parentheses when it's negative or a fraction, for "c \langle ... \rangle". */
const fcoef = (a: Fr) => (a.d === 1 && a.n >= 0 ? String(a.n) : `\\left(${ftex(a)}\\right)`);

/** sqrt(S) = k sqrt(m) with m square-free. */
function sqrtParts(S: number): [number, number] {
  let k = 1;
  for (let i = 2; i * i <= S; i++) {
    while (S % (i * i) === 0) {
      S /= i * i;
      k *= i;
    }
  }
  return [k, S];
}
const sqrtText = (S: number) => {
  const [k, m] = sqrtParts(S);
  return m === 1 ? String(k) : k === 1 ? `sqrt(${m})` : `${k}sqrt(${m})`;
};
const sqrtTex = (S: number) => {
  const [k, m] = sqrtParts(S);
  return m === 1 ? String(k) : `${k === 1 ? "" : k}\\sqrt{${m}}`;
};
/** "\sqrt{S}" followed by its simplified form when that's different. */
const sqrtChain = (S: number) => (sqrtTex(S) === `\\sqrt{${S}}` ? `\\sqrt{${S}}` : `\\sqrt{${S}} = ${sqrtTex(S)}`);
/** "\frac{n}{d}" followed by the reduced fraction when that's different. */
function fracChain(n: number, d: number): string {
  const raw = d === 1 ? String(n) : `\\frac{${n}}{${d}}`;
  const reduced = fracTex(n, d);
  return raw === reduced ? raw : `${raw} = ${reduced}`;
}
/** "y = mx + b" with fractional m, b written the way a person would. */
function lineTex(m: Fr, b: Fr): string {
  const slope = m.d === 1 ? (m.n === 1 ? "" : m.n === -1 ? "-" : String(m.n)) : ftex(m);
  const intercept = b.n === 0 ? "" : ` ${b.n < 0 ? "-" : "+"} ${ftex(fr(Math.abs(b.n), b.d))}`;
  return `y = ${slope}x${intercept}`;
}
/** w / sqrt(S) with the denominator rationalized, as answer text and LaTeX. */
function overSqrt(w: number, S: number): { text: string; tex: string } {
  if (w === 0) return { text: "0", tex: "0" };
  const [k, m] = sqrtParts(S);
  const f = fr(w, k * m);
  if (m === 1) return { text: ftxt(f), tex: ftex(f) };
  const sgn = f.n < 0 ? "-" : "";
  const an = Math.abs(f.n);
  const c = an === 1 ? "" : String(an);
  return {
    text: f.d === 1 ? `${sgn}${c}sqrt(${m})` : `${sgn}${c}sqrt(${m})/${f.d}`,
    tex: f.d === 1 ? `${sgn}${c}\\sqrt{${m}}` : `${sgn}\\frac{${c}\\sqrt{${m}}}{${f.d}}`,
  };
}

// ── Lesson 1 generators ─────────────────────────────────────────────────────

const dotLengthDistance: Generator = (r) => {
  const kind = r.int(0, 3);
  const n = r.pick([2, 3]);
  if (kind === 0) {
    let u = rvec(r, n, -5, 5);
    let v = rvec(r, n, -5, 5);
    while (dot(u, v) === 0 && r.next() < 0.7) [u, v] = [rvec(r, n, -5, 5), rvec(r, n, -5, 5)];
    const d = dot(u, v);
    const sum = u.map((a, i) => a + v[i]!);
    return {
      prompt: md`Let $\mathbf{u} = ${vec(u)}$ and $\mathbf{v} = ${vec(v)}$. Find $\mathbf{u} \cdot \mathbf{v}$.`,
      answer: String(d),
      verify: [`2 * d = ${squaresText(sum)} - (${squaresText(u)}) - (${squaresText(v)})`],
      hint: "Multiply matching components, then add the products.",
      solution: [
        { math: md`\mathbf{u} \cdot \mathbf{v} = ${products(u, v)}`, note: "Pair the components." },
        { math: md`= ${u.map((a, i) => P(a * v[i]!)).join(" + ")} = ${d}`, note: d === 0 ? "The dot product is 0, so the vectors are orthogonal." : d > 0 ? "Positive: the angle between them is less than 90°." : "Negative: the angle between them is more than 90°." },
      ],
    };
  }
  if (kind === 1) {
    const v = rvec(r, n, -6, 6);
    const S = dot(v, v);
    return {
      prompt: md`Find the length of $\mathbf{v} = ${vec(v)}$. Give the exact value in simplest form, typed like **3sqrt(2)**.`,
      answer: sqrtText(S),
      simplified: true,
      verify: [`L^2 = ${squaresText(v)}`],
      hint: md`$\|\mathbf{v}\| = \sqrt{\mathbf{v} \cdot \mathbf{v}}$: square each component, add, take the square root.`,
      solution: [
        { math: md`\|\mathbf{v}\|^2 = ${squares(v)} = ${S}`, note: "Sum of the squared components." },
        { math: md`\|\mathbf{v}\| = ${sqrtChain(S)}`, note: sqrtParts(S)[1] === 1 ? "A perfect square." : sqrtParts(S)[0] === 1 ? "No square factor to pull out." : md`$${S} = ${sqrtParts(S)[0] ** 2} \cdot ${sqrtParts(S)[1]}$.` },
      ],
    };
  }
  if (kind === 2) {
    const p = rvec(r, n, -6, 6);
    let q = rvec(r, n, -6, 6);
    while (q.every((a, i) => a === p[i])) q = rvec(r, n, -6, 6);
    const diff = p.map((a, i) => a - q[i]!);
    const S = dot(diff, diff);
    return {
      prompt: md`Find the distance between the points $P${tuple(p.map(String))}$ and $Q${tuple(q.map(String))}$. Give the exact value in simplest form.`,
      answer: sqrtText(S),
      simplified: true,
      verify: [`D^2 = ${p.map((a, i) => `(${a} - ${P(q[i]!)})^2`).join(" + ")}`],
      hint: md`The distance is the length of $\mathbf{p} - \mathbf{q}$. Subtract first, then find the length.`,
      solution: [
        { math: md`\mathbf{p} - \mathbf{q} = ${vec(diff)}`, note: "Subtract component by component." },
        { math: md`\|\mathbf{p} - \mathbf{q}\| = \sqrt{${squares(diff)}} = ${sqrtChain(S)}`, note: "Length of the difference." },
      ],
    };
  }
  // Find k so that two vectors are orthogonal.
  const v = rvec(r, n, -5, 5).map((a) => a || 1);
  const slot = r.int(0, n - 1);
  const u: (number | string)[] = rvec(r, n, -5, 5);
  u[slot] = "k";
  const rest = u.reduce<number>((s, a, i) => (typeof a === "number" ? s + a * v[i]! : s), 0);
  const k = fr(-rest, v[slot]!);
  return {
    prompt: md`Find $k$ so that $${vec(u)}$ is orthogonal to $${vec(v)}$.`,
    answer: ftxt(k),
    verify: [u.map((a, i) => `(${a})*(${v[i]})`).join(" + ") + " = 0"],
    hint: "Orthogonal means the dot product is zero. Write out the dot product and solve for k.",
    solution: [
      { math: md`${u.map((a, i) => `${typeof a === "number" ? P(a) : a} \\cdot ${P(v[i]!)}`).join(" + ")} = 0`, note: "Set the dot product to zero." },
      { math: md`${v[slot]! < 0 ? "-" : ""}${Math.abs(v[slot]!) === 1 ? "" : Math.abs(v[slot]!)}k ${rest < 0 ? "-" : "+"} ${Math.abs(rest)} = 0`, note: "Collect the numbers." },
      { math: md`k = ${ftex(k)}`, note: "" },
    ],
  };
};

const unitVector: Generator = (r) => {
  const n = r.pick([2, 3]);
  let v = rvec(r, n, -5, 5);
  while (v.filter((a) => a !== 0).length < 2) v = rvec(r, n, -5, 5);
  const S = dot(v, v);
  const parts = v.map((a) => overSqrt(a, S));
  const letters = ["p", "q", "r"].slice(0, n);
  return {
    prompt: md`Find the unit vector in the direction of $\mathbf{v} = ${vec(v)}$. Give it as a tuple with rationalized denominators, like **(sqrt(2)/2, -sqrt(2)/2)**.`,
    answer: tuple(parts.map((p) => p.text)),
    form: "tuple",
    simplified: true,
    verify: [`${letters.map((l) => `${l}^2`).join(" + ")} = 1`, `${letters.map((l, i) => `${l}*(${v[i]})`).join(" + ")} = sqrt(${S})`],
    hint: md`Divide $\mathbf{v}$ by its own length. $\|\mathbf{v}\| = \sqrt{${S}}$.`,
    solution: [
      { math: md`\|\mathbf{v}\| = \sqrt{${squares(v)}} = ${sqrtTex(S)}`, note: "Length first." },
      { math: md`\frac{1}{\|\mathbf{v}\|}\mathbf{v} = ${vec(v.map((a) => `\\frac{${a}}{${sqrtTex(S)}}`))}`, note: "Divide every component by the length." },
      { math: tuple(parts.map((p) => p.tex)).replace(/^\(/, "\\left(").replace(/\)$/, "\\right)"), note: md`Rationalize each denominator. Check: the squares of the components add to 1.` },
    ],
  };
};

const angleBetween: Generator = (r) => {
  const kind = r.int(0, 4);
  let u: Vec;
  let v: Vec;
  let angle: number;
  if (kind <= 2) {
    // In the plane: 45°, 90° or 135° from a vector and its perpendicular.
    u = rvec(r, 2, -4, 4);
    const perp = [-u[1]!, u[0]!];
    const c = r.pick([1, 2]);
    const s = r.sign();
    if (kind === 0) [v, angle] = [perp.map((a) => c * s * a), 90];
    else if (kind === 1) [v, angle] = [perp.map((a, i) => c * (a + u[i]!)), 45];
    else [v, angle] = [perp.map((a, i) => c * (a - u[i]!)), 135];
    if (r.next() < 0.5) [u, v] = [v, u];
  } else {
    // In space: 60° or 120° from two vectors with two ±1 entries sharing one slot.
    const slots = r.pick([
      [0, 1, 2],
      [1, 2, 0],
      [2, 0, 1],
    ]);
    const [i, j, k] = slots as [number, number, number];
    u = [0, 0, 0];
    v = [0, 0, 0];
    u[i] = r.sign();
    u[j] = r.sign();
    v[k] = r.sign();
    v[j] = kind === 3 ? u[j]! : -u[j]!;
    angle = kind === 3 ? 60 : 120;
    const cu = r.pick([1, 2, 3]);
    const cv = r.pick([1, 2]);
    u = u.map((a) => cu * a);
    v = v.map((a) => cv * a);
  }
  const uv = dot(u, v);
  const uu = dot(u, u);
  const vv = dot(v, v);
  const cosTex = `\\frac{${uv}}{${sqrtTex(uu)} \\cdot ${sqrtTex(vv)}}`;
  const cosValue = { 90: "0", 45: "\\frac{\\sqrt{2}}{2}", 135: "-\\frac{\\sqrt{2}}{2}", 60: "\\frac{1}{2}", 120: "-\\frac{1}{2}" }[angle]!;
  return {
    prompt: md`Find the angle between $\mathbf{u} = ${vec(u)}$ and $\mathbf{v} = ${vec(v)}$, in degrees.`,
    answer: String(angle),
    verify: [`cos(A pi/180) * sqrt(${uu}) * sqrt(${vv}) = ${uv}`],
    hint: md`$\cos\theta = \dfrac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|\,\|\mathbf{v}\|}$. Work out the three pieces, then recognise the cosine.`,
    solution: [
      { math: md`\mathbf{u} \cdot \mathbf{v} = ${products(u, v)} = ${uv}`, note: "The dot product." },
      { math: md`\|\mathbf{u}\| = \sqrt{${uu}} = ${sqrtTex(uu)}, \qquad \|\mathbf{v}\| = \sqrt{${vv}} = ${sqrtTex(vv)}`, note: "The two lengths." },
      { math: md`\cos\theta = ${cosTex} = ${cosValue}`, note: angle === 90 ? "A zero dot product means a right angle." : "Simplify the fraction." },
      { math: md`\theta = ${angle}^\circ`, note: "" },
    ],
  };
};

// ── Lesson 2 generators ─────────────────────────────────────────────────────

/** The projection of b onto a, its coefficient and the leftover, all exact. */
function project(a: Vec, b: Vec) {
  const c = fr(dot(a, b), dot(a, a));
  const proj = fscale(c, toF(a));
  const z = fvsub(toF(b), proj);
  return { c, proj, z };
}

const projectOntoLine: Generator = (r) => {
  const kind = r.int(0, 2);
  const n = kind === 2 ? 3 : 2;
  let a = rvec(r, n, -4, 4);
  let b = rvec(r, n, -6, 6);
  while (dot(a, b) === 0 || a.some((x) => x === 0) || maxDen(project(a, b).proj) > 10) [a, b] = [rvec(r, n, -4, 4), rvec(r, n, -6, 6)];
  const { c, proj, z } = project(a, b);
  const letters = ["p", "q", "r"].slice(0, n);
  const residualPerp = `${letters.map((l, i) => `(${b[i]} - ${l})*(${a[i]})`).join(" + ")} = 0`;
  // Parallel to a: the 2D cross product is zero, or in 3D the whole cross product (every verify equation names every unknown).
  const parallel = n === 2 ? [`p*(${a[1]}) - q*(${a[0]}) = 0`] : [`(p*(${a[1]}) - q*(${a[0]}))^2 + (q*(${a[2]}) - r*(${a[1]}))^2 + (p*(${a[2]}) - r*(${a[0]}))^2 = 0`];
  const steps: Step[] = [
    { math: md`\mathbf{a} \cdot \mathbf{b} = ${products(a, b)} = ${dot(a, b)}, \qquad \mathbf{a} \cdot \mathbf{a} = ${squares(a)} = ${dot(a, a)}`, note: "The two dot products in the formula." },
    { math: md`c = \frac{\mathbf{a} \cdot \mathbf{b}}{\mathbf{a} \cdot \mathbf{a}} = ${fracChain(dot(a, b), dot(a, a))}`, note: "How far along a the shadow lands." },
    { math: md`\hat{\mathbf{b}} = ${fcoef(c)}${vec(a)} = ${fvec(proj)}`, note: "Scale a by c." },
  ];
  if (kind === 1) {
    return {
      prompt: md`Let $\mathbf{a} = ${vec(a)}$ and $\mathbf{b} = ${vec(b)}$. Find the component of $\mathbf{b}$ orthogonal to $\mathbf{a}$, that is $\mathbf{z} = \mathbf{b} - \operatorname{proj}_{\mathbf{a}} \mathbf{b}$. Give it as a tuple, fractions allowed.`,
      answer: ftuple(z),
      form: "tuple",
      verify: [`${letters.map((l, i) => `${l}*(${a[i]})`).join(" + ")} = 0`, `(${b[0]} - p)*(${a[1]}) - (${b[1]} - q)*(${a[0]}) = 0`],
      hint: md`First project $\mathbf{b}$ onto $\mathbf{a}$. The orthogonal component is what's left: $\mathbf{b} - \hat{\mathbf{b}}$.`,
      solution: [...steps, { math: md`\mathbf{z} = \mathbf{b} - \hat{\mathbf{b}} = ${fvec(z)}`, note: md`Check: $\mathbf{z} \cdot \mathbf{a} = ${z.map((x, i) => `${fcoef(x)} \\cdot ${P(a[i]!)}`).join(" + ")} = 0$.` }],
    };
  }
  return {
    prompt: md`Let $\mathbf{a} = ${vec(a)}$ and $\mathbf{b} = ${vec(b)}$. Find the orthogonal projection of $\mathbf{b}$ onto $\mathbf{a}$. Give it as a tuple, fractions allowed.`,
    answer: ftuple(proj),
    form: "tuple",
    verify: [residualPerp, ...parallel],
    hint: md`$\operatorname{proj}_{\mathbf{a}} \mathbf{b} = \dfrac{\mathbf{a} \cdot \mathbf{b}}{\mathbf{a} \cdot \mathbf{a}}\,\mathbf{a}$. The answer is a multiple of $\mathbf{a}$.`,
    solution: [...steps, { math: md`\mathbf{b} - \hat{\mathbf{b}} = ${fvec(z)}`, note: md`Check: the leftover is orthogonal to $\mathbf{a}$, since $${z.map((x, i) => `${fcoef(x)} \\cdot ${P(a[i]!)}`).join(" + ")} = 0$.` }],
  };
};

/** An orthogonal pair in R^2 or an orthogonal pair/triple in R^3, with small entries. */
function orthogonalBasis(r: Rng, n: number, count: number): Vec[] {
  if (n === 2) {
    let u = rvec(r, 2, -3, 3);
    while (u.some((x) => x === 0)) u = rvec(r, 2, -3, 3);
    const s = r.sign();
    const k = r.pick([1, 1, 2]);
    return [u, [-s * k * u[1]!, s * k * u[0]!]];
  }
  for (;;) {
    const u1 = rvec(r, 3, -2, 2);
    const u2 = rvec(r, 3, -2, 2);
    if (dot(u1, u2) !== 0 || isZero(cross(u1, u2))) continue;
    const u3 = cross(u1, u2);
    if (count === 3 && u3.some((x) => Math.abs(x) > 4)) continue;
    return count === 2 ? [u1, u2] : [u1, u2, u3];
  }
}

const orthogonalCoordinates: Generator = (r) => {
  const n = r.pick([2, 2, 3]);
  const basis = orthogonalBasis(r, n, n);
  const b = rvec(r, n, -6, 6);
  const coords = basis.map((u) => fr(dot(u, b), dot(u, u)));
  const letters = ["p", "q", "r"].slice(0, n);
  const names = basis.map((_, i) => `\\mathbf{u}_${i + 1}`);
  return {
    prompt: md`The vectors ${basis.map((u, i) => `$${names[i]} = ${vec(u)}$`).join(", ")} are orthogonal, so they form a basis of $\mathbb{R}^${n}$. Write $\mathbf{b} = ${vec(b)}$ as $${names.map((nm, i) => `c_${i + 1} ${nm}`).join(" + ")}$. Give $${tuple(names.map((_, i) => `c_${i + 1}`))}$ as a tuple, fractions allowed.`,
    answer: ftuple(coords),
    form: "tuple",
    verify: Array.from({ length: n }, (_, row) => `${letters.map((l, j) => `${l}*(${basis[j]![row]})`).join(" + ")} = ${b[row]}`),
    hint: md`No elimination needed: with an orthogonal basis, $c_i = \dfrac{\mathbf{b} \cdot \mathbf{u}_i}{\mathbf{u}_i \cdot \mathbf{u}_i}$.`,
    solution: [
      ...basis.map((u, i) => ({ math: md`c_${i + 1} = \frac{\mathbf{b} \cdot ${names[i]}}{${names[i]} \cdot ${names[i]}} = ${fracChain(dot(u, b), dot(u, u))}`, note: i === 0 ? md`Dot both sides of $\mathbf{b} = ${names.map((nm, j) => `c_${j + 1} ${nm}`).join(" + ")}$ with $${names[i]}$: every other term dies.` : "Same move with the next basis vector." })),
      { math: md`\mathbf{b} = ${coords.map((c, i) => `${fcoef(c)}${vec(basis[i]!)}`).join(" + ")}`, note: "Check by adding the scaled vectors; you get b back." },
    ],
  };
};

const projectOntoPlane: Generator = (r) => {
  const askDistance = r.next() < 0.35;
  const [u1, u2] = orthogonalBasis(r, 3, 2) as [Vec, Vec];
  const nrm = cross(u1, u2);
  const projection = (bb: Vec) => {
    const c1 = fr(dot(bb, u1), dot(u1, u1));
    const c2 = fr(dot(bb, u2), dot(u2, u2));
    return { c1, c2, proj: fscale(c1, toF(u1)).map((x, i) => fadd(x, fscale(c2, toF(u2))[i]!)) };
  };
  let b = rvec(r, 3, -5, 5);
  while (dot(b, nrm) === 0 || maxDen(projection(b).proj) > 12) b = rvec(r, 3, -5, 5);
  const { c1, c2, proj } = projection(b);
  const z = fvsub(toF(b), proj);
  const steps: Step[] = [
    { math: md`c_1 = \frac{\mathbf{b} \cdot \mathbf{u}_1}{\mathbf{u}_1 \cdot \mathbf{u}_1} = ${fracChain(dot(b, u1), dot(u1, u1))}, \qquad c_2 = \frac{\mathbf{b} \cdot \mathbf{u}_2}{\mathbf{u}_2 \cdot \mathbf{u}_2} = ${fracChain(dot(b, u2), dot(u2, u2))}`, note: "One coefficient per basis vector, each from a single dot product. This works because the basis is orthogonal." },
    { math: md`\hat{\mathbf{b}} = ${fcoef(c1)}${vec(u1)} + ${fcoef(c2)}${vec(u2)} = ${fvec(proj)}`, note: "Add the two line projections." },
    { math: md`\mathbf{z} = \mathbf{b} - \hat{\mathbf{b}} = ${fvec(z)}`, note: md`Check: $\mathbf{z} \cdot \mathbf{u}_1 = 0$ and $\mathbf{z} \cdot \mathbf{u}_2 = 0$.` },
  ];
  const setup = md`Let $W$ be the plane spanned by the orthogonal vectors $\mathbf{u}_1 = ${vec(u1)}$ and $\mathbf{u}_2 = ${vec(u2)}$, and let $\mathbf{b} = ${vec(b)}$.`;
  if (askDistance) {
    // |z|^2 is rational: write it as sqrt(num)/den.
    const zz = fdot(z, z);
    const num = zz.n * zz.d;
    const den = zz.d;
    const [k, m] = sqrtParts(num);
    const f = fr(k, den);
    const text = m === 1 ? ftxt(f) : f.d === 1 ? `${f.n === 1 ? "" : f.n}sqrt(${m})` : `${f.n === 1 ? "" : f.n}sqrt(${m})/${f.d}`;
    const tex = m === 1 ? ftex(f) : f.d === 1 ? `${f.n === 1 ? "" : f.n}\\sqrt{${m}}` : `\\frac{${f.n === 1 ? "" : f.n}\\sqrt{${m}}}{${f.d}}`;
    return {
      prompt: md`${setup} Find the distance from $\mathbf{b}$ to $W$. Give the exact value in simplest form.`,
      answer: text,
      simplified: true,
      verify: [`D * sqrt(${dot(nrm, nrm)}) = abs(${dot(b, nrm)})`],
      hint: md`The distance is $\|\mathbf{b} - \hat{\mathbf{b}}\|$, the length of the part of $\mathbf{b}$ orthogonal to $W$. Project first.`,
      solution: [...steps, { math: md`\|\mathbf{z}\| = \sqrt{${z.map((x) => `\\left(${ftex(x)}\\right)^2`).join(" + ")}} = \sqrt{${ftex(zz)}} = ${tex}`, note: "The length of the orthogonal component is the distance to the plane." }],
    };
  }
  return {
    prompt: md`${setup} Find $\operatorname{proj}_W \mathbf{b}$. Give it as a tuple, fractions allowed.`,
    answer: ftuple(proj),
    form: "tuple",
    verify: [
      `${["p", "q", "r"].map((l, i) => `(${b[i]} - ${l})*(${u1[i]})`).join(" + ")} = 0`,
      `${["p", "q", "r"].map((l, i) => `(${b[i]} - ${l})*(${u2[i]})`).join(" + ")} = 0`,
      `${["p", "q", "r"].map((l, i) => `${l}*(${nrm[i]})`).join(" + ")} = 0`,
    ],
    hint: md`$\operatorname{proj}_W \mathbf{b} = \dfrac{\mathbf{b} \cdot \mathbf{u}_1}{\mathbf{u}_1 \cdot \mathbf{u}_1}\mathbf{u}_1 + \dfrac{\mathbf{b} \cdot \mathbf{u}_2}{\mathbf{u}_2 \cdot \mathbf{u}_2}\mathbf{u}_2$: the sum of the two line projections.`,
    solution: steps,
  };
};

// ── Lesson 3 generators ─────────────────────────────────────────────────────

const gramSchmidtSecond: Generator = (r) => {
  const n = r.pick([2, 2, 3]);
  let x1 = rvec(r, n, -4, 4);
  let x2 = rvec(r, n, -4, 4);
  // Not parallel, and sometimes with a whole-number coefficient.
  const parallel = (a: Vec, b: Vec) => (n === 2 ? a[0]! * b[1]! - a[1]! * b[0]! === 0 : isZero(cross(a, b)));
  while (parallel(x1, x2) || dot(x1, x2) === 0 || maxDen(project(x1, x2).z) > 10 || (r.next() < 0.5 && dot(x1, x2) % dot(x1, x1) !== 0)) [x1, x2] = [rvec(r, n, -4, 4), rvec(r, n, -4, 4)];
  const { c, proj, z: v2 } = project(x1, x2);
  const letters = ["p", "q", "r"].slice(0, n);
  const verify = [`${letters.map((l, i) => `${l}*(${x1[i]})`).join(" + ")} = 0`];
  if (n === 2) verify.push(`(${x2[0]} - p)*(${x1[1]}) - (${x2[1]} - q)*(${x1[0]}) = 0`);
  else {
    const d = letters.map((l, i) => `(${x2[i]} - ${l})`);
    verify.push(`(${d[0]}*(${x1[1]}) - ${d[1]}*(${x1[0]}))^2 + (${d[1]}*(${x1[2]}) - ${d[2]}*(${x1[1]}))^2 + (${d[0]}*(${x1[2]}) - ${d[2]}*(${x1[0]}))^2 = 0`);
  }
  return {
    prompt: md`Apply Gram–Schmidt to $\mathbf{x}_1 = ${vec(x1)}$, $\mathbf{x}_2 = ${vec(x2)}$. With $\mathbf{v}_1 = \mathbf{x}_1$, find $\mathbf{v}_2$. Give it as a tuple, fractions allowed.`,
    answer: ftuple(v2),
    form: "tuple",
    verify,
    hint: md`$\mathbf{v}_2 = \mathbf{x}_2 - \dfrac{\mathbf{x}_2 \cdot \mathbf{v}_1}{\mathbf{v}_1 \cdot \mathbf{v}_1}\mathbf{v}_1$: subtract from $\mathbf{x}_2$ its shadow on $\mathbf{v}_1$.`,
    solution: [
      { math: md`\mathbf{x}_2 \cdot \mathbf{v}_1 = ${dot(x2, x1)}, \qquad \mathbf{v}_1 \cdot \mathbf{v}_1 = ${dot(x1, x1)}`, note: "The two dot products." },
      { math: md`\operatorname{proj}_{\mathbf{v}_1} \mathbf{x}_2 = ${fcoef(c)}${vec(x1)} = ${fvec(proj)}`, note: md`The coefficient is $${fracChain(dot(x2, x1), dot(x1, x1))}$.` },
      { math: md`\mathbf{v}_2 = \mathbf{x}_2 - \operatorname{proj}_{\mathbf{v}_1} \mathbf{x}_2 = ${fvec(v2)}`, note: md`Check: $\mathbf{v}_2 \cdot \mathbf{v}_1 = ${v2.map((x, i) => `${fcoef(x)} \\cdot ${P(x1[i]!)}`).join(" + ")} = 0$.` },
    ],
  };
};

const gramSchmidtThird: Generator = (r) => {
  let x1: Vec, x2: Vec, x3: Vec, nrm: Vec;
  for (;;) {
    x1 = rvec(r, 3, -2, 2);
    x2 = rvec(r, 3, -2, 2);
    x3 = rvec(r, 3, -3, 3);
    nrm = cross(x1, x2);
    if (isZero(nrm) || dot(x3, nrm) === 0 || dot(x1, x1) > 6 || dot(nrm, nrm) > 12) continue;
    if (dot(x1, x2) === 0 && r.next() < 0.7) continue;
    break;
  }
  const v1 = toF(x1);
  const c2 = fr(dot(x2, x1), dot(x1, x1));
  const v2 = fvsub(toF(x2), fscale(c2, v1));
  const a1 = fr(dot(x3, x1), dot(x1, x1));
  const x3f = toF(x3);
  const a2 = fdiv(fdot(x3f, v2), fdot(v2, v2));
  const v3 = fvsub(fvsub(x3f, fscale(a1, v1)), fscale(a2, v2));
  return {
    prompt: md`Apply Gram–Schmidt to $\mathbf{x}_1 = ${vec(x1)}$, $\mathbf{x}_2 = ${vec(x2)}$, $\mathbf{x}_3 = ${vec(x3)}$ and find the third vector $\mathbf{v}_3$. Give it as a tuple, fractions allowed.`,
    answer: ftuple(v3),
    form: "tuple",
    verify: [
      `${["p", "q", "r"].map((l, i) => `${l}*(${x1[i]})`).join(" + ")} = 0`,
      `${["p", "q", "r"].map((l, i) => `${l}*(${x2[i]})`).join(" + ")} = 0`,
      `${["p", "q", "r"].map((l, i) => `(${x3[i]} - ${l})*(${nrm[i]})`).join(" + ")} = 0`,
    ],
    hint: md`Find $\mathbf{v}_2$ first. Then $\mathbf{v}_3 = \mathbf{x}_3 - \dfrac{\mathbf{x}_3 \cdot \mathbf{v}_1}{\mathbf{v}_1 \cdot \mathbf{v}_1}\mathbf{v}_1 - \dfrac{\mathbf{x}_3 \cdot \mathbf{v}_2}{\mathbf{v}_2 \cdot \mathbf{v}_2}\mathbf{v}_2$. You may scale $\mathbf{v}_2$ to clear fractions before using it.`,
    solution: [
      { math: md`\mathbf{v}_1 = ${vec(x1)}`, note: "The first vector is kept as it is." },
      { math: md`\mathbf{v}_2 = \mathbf{x}_2 - ${fcoef(c2)}\mathbf{v}_1 = ${fvec(v2)}`, note: md`$\mathbf{x}_2 \cdot \mathbf{v}_1 = ${dot(x2, x1)}$ and $\mathbf{v}_1 \cdot \mathbf{v}_1 = ${dot(x1, x1)}$.` },
      { math: md`\frac{\mathbf{x}_3 \cdot \mathbf{v}_1}{\mathbf{v}_1 \cdot \mathbf{v}_1} = ${ftex(a1)}, \qquad \frac{\mathbf{x}_3 \cdot \mathbf{v}_2}{\mathbf{v}_2 \cdot \mathbf{v}_2} = \frac{${ftex(fdot(x3f, v2))}}{${ftex(fdot(v2, v2))}} = ${ftex(a2)}`, note: "The two coefficients for the third step." },
      { math: md`\mathbf{v}_3 = ${vec(x3)} - ${fcoef(a1)}${vec(x1)} - ${fcoef(a2)}${fvec(v2)}`, note: "Subtract both shadows." },
      { math: md`\mathbf{v}_3 = ${fvec(v3)}`, note: md`Check: $\mathbf{v}_3 \cdot \mathbf{x}_1 = 0$ and $\mathbf{v}_3 \cdot \mathbf{x}_2 = 0$. It's a multiple of $\mathbf{x}_1 \times \mathbf{x}_2 = ${vec(nrm)}$, the normal to the plane of the first two.` },
    ],
  };
};

const orthonormalSecond: Generator = (r) => {
  const n = r.pick([2, 3]);
  let x1 = rvec(r, n, -3, 3);
  let x2 = rvec(r, n, -3, 3);
  const parallel = (a: Vec, b: Vec) => (n === 2 ? a[0]! * b[1]! - a[1]! * b[0]! === 0 : isZero(cross(a, b)));
  while (parallel(x1, x2) || dot(x1, x2) === 0) [x1, x2] = [rvec(r, n, -3, 3), rvec(r, n, -3, 3)];
  const { c, z: v2 } = project(x1, x2);
  // Clear denominators: w is a positive multiple of v2 with whole entries.
  const den = v2.reduce((l, x) => (l * x.d) / gcd(l, x.d), 1);
  const w = v2.map((x) => (x.n * den) / x.d);
  const g = w.reduce((a, b) => gcd(a, b), 0) || 1;
  const wr = w.map((x) => x / g);
  const S = dot(wr, wr);
  const parts = wr.map((x) => overSqrt(x, S));
  const letters = ["p", "q", "r"].slice(0, n);
  return {
    prompt: md`Apply Gram–Schmidt to $\mathbf{x}_1 = ${vec(x1)}$, $\mathbf{x}_2 = ${vec(x2)}$, then normalize. Find the unit vector $\mathbf{q}_2 = \mathbf{v}_2 / \|\mathbf{v}_2\|$. Give it as a tuple with rationalized denominators.`,
    answer: tuple(parts.map((p) => p.text)),
    form: "tuple",
    simplified: true,
    verify: [`${letters.map((l) => `${l}^2`).join(" + ")} = 1`, `${letters.map((l, i) => `${l}*(${x1[i]})`).join(" + ")} = 0`, `${letters.map((l, i) => `${l}*(${wr[i]})`).join(" + ")} = sqrt(${S})`],
    hint: md`Find $\mathbf{v}_2 = \mathbf{x}_2 - \dfrac{\mathbf{x}_2 \cdot \mathbf{x}_1}{\mathbf{x}_1 \cdot \mathbf{x}_1}\mathbf{x}_1$, clear any fractions (scaling doesn't change the direction), then divide by the length.`,
    solution: [
      { math: md`\mathbf{v}_2 = \mathbf{x}_2 - ${fcoef(c)}\mathbf{x}_1 = ${fvec(v2)}`, note: md`The coefficient is $${fracChain(dot(x2, x1), dot(x1, x1))}$.` },
      ...(wr.every((x, i) => fr(x).n === v2[i]!.n && fr(x).d === v2[i]!.d) ? [] : [{ math: md`\mathbf{w} = ${vec(wr)}`, note: "A positive multiple of v2 points the same way, so normalizing it gives the same unit vector." }]),
      { math: md`\|\mathbf{w}\| = \sqrt{${squares(wr)}} = ${sqrtTex(S)}`, note: "Length." },
      { math: md`\mathbf{q}_2 = ${tuple(parts.map((p) => p.tex)).replace(/^\(/, "\\left(").replace(/\)$/, "\\right)")}`, note: md`Divide each component by $${sqrtTex(S)}$ and rationalize. Check: $\mathbf{q}_2 \cdot \mathbf{x}_1 = 0$ and $\|\mathbf{q}_2\| = 1$.` },
    ],
  };
};

// ── Lesson 4 generators ─────────────────────────────────────────────────────

const col = (v: (number | string)[]) => `\\begin{bmatrix} ${v.join(" \\\\ ")} \\end{bmatrix}`;
const mat2 = (c1: Vec, c2: Vec) => `\\begin{bmatrix} ${c1.map((a, i) => `${a} & ${c2[i]}`).join(" \\\\ ")} \\end{bmatrix}`;

/** Two independent columns in R^3 with small entries. */
function twoColumns(r: Rng): [Vec, Vec, Vec] {
  for (;;) {
    const c1 = rvec(r, 3, -2, 2);
    const c2 = rvec(r, 3, -2, 2);
    const nrm = cross(c1, c2);
    if (isZero(nrm) || dot(nrm, nrm) > 14) continue;
    if (c1.some((a, i) => a === 0 && c2[i] === 0)) continue;
    return [c1, c2, nrm];
  }
}

/** Exact least-squares solution of [c1 c2] x = b by the 2×2 normal equations. */
function normalSolve(c1: Vec, c2: Vec, b: Vec): [Fr, Fr, { a11: number; a12: number; a22: number; r1: number; r2: number; det: number }] {
  const a11 = dot(c1, c1);
  const a12 = dot(c1, c2);
  const a22 = dot(c2, c2);
  const r1 = dot(c1, b);
  const r2 = dot(c2, b);
  const det = a11 * a22 - a12 * a12;
  return [fr(a22 * r1 - a12 * r2, det), fr(a11 * r2 - a12 * r1, det), { a11, a12, a22, r1, r2, det }];
}

const leastSquaresSolve: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let a = rvec(r, 3, -3, 3);
    let b = rvec(r, 3, -5, 5);
    while (a.filter((x) => x !== 0).length < 2 || dot(a, b) === 0 || dot(a, b) % dot(a, a) === 0) [a, b] = [rvec(r, 3, -3, 3), rvec(r, 3, -5, 5)];
    const x = fr(dot(a, b), dot(a, a));
    return {
      prompt: md`The system $${col(a)} x = ${col(b)}$ (one unknown, three equations) has no solution. Find its least-squares solution $\hat{x}$.`,
      answer: ftxt(x),
      verify: [`${a.map((ai, i) => `(${b[i]} - p*(${ai}))*(${ai})`).join(" + ")} = 0`],
      hint: md`The normal equation here is just $\mathbf{a}^T\mathbf{a}\,\hat{x} = \mathbf{a}^T\mathbf{b}$: one equation, one unknown.`,
      solution: [
        { math: md`\mathbf{a}^T\mathbf{a} = ${squares(a)} = ${dot(a, a)}, \qquad \mathbf{a}^T\mathbf{b} = ${products(a, b)} = ${dot(a, b)}`, note: "Two dot products." },
        { math: md`${dot(a, a)}\hat{x} = ${dot(a, b)} \;\Rightarrow\; \hat{x} = ${fracChain(dot(a, b), dot(a, a))}`, note: md`This is the projection coefficient from Lesson 2: $\hat{x}\mathbf{a}$ is the projection of $\mathbf{b}$ onto the line through $\mathbf{a}$.` },
      ],
    };
  }
  const [c1, c2, nrm] = twoColumns(r);
  let b: Vec;
  let p: Fr, q: Fr, info: ReturnType<typeof normalSolve>[2];
  if (kind === 1) {
    // Random b: exact fractions from the normal equations.
    for (;;) {
      b = rvec(r, 3, -4, 4);
      [p, q, info] = normalSolve(c1, c2, b);
      if (dot(b, nrm) !== 0 && Math.max(p.d, q.d) <= 12) break;
    }
  } else {
    // Built so the answer is whole: b = A x + k n, with n orthogonal to both columns.
    const x = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const k = r.pick([-2, -1, 1, 2]);
    b = c1.map((a, i) => a * x[0]! + c2[i]! * x[1]! + k * nrm[i]!);
    [p, q, info] = normalSolve(c1, c2, b);
  }
  const { a11, a12, a22, r1, r2, det } = info!;
  return {
    prompt: md`Find the least-squares solution $\hat{\mathbf{x}}$ of $A\mathbf{x} = \mathbf{b}$ with $A = ${mat2(c1, c2)}$ and $\mathbf{b} = ${col(b!)}$. Give $\hat{\mathbf{x}} = (\hat{x}_1, \hat{x}_2)$ as a tuple, fractions allowed.`,
    answer: tuple([ftxt(p!), ftxt(q!)]),
    form: "tuple",
    verify: [`${c1.map((a, i) => `(${b![i]} - p*(${a}) - q*(${c2[i]}))*(${a})`).join(" + ")} = 0`, `${c2.map((a, i) => `(${b![i]} - p*(${c1[i]}) - q*(${a}))*(${a})`).join(" + ")} = 0`],
    hint: md`Solve the normal equations $A^TA\,\hat{\mathbf{x}} = A^T\mathbf{b}$. $A^TA$ is $2 \times 2$: its entries are the dot products of the columns of $A$.`,
    solution: [
      { math: md`A^TA = \begin{bmatrix} ${a11} & ${a12} \\ ${a12} & ${a22} \end{bmatrix}, \qquad A^T\mathbf{b} = ${col([r1, r2])}`, note: md`$(A^TA)_{ij}$ is column $i$ dotted with column $j$; $(A^T\mathbf{b})_i$ is column $i$ dotted with $\mathbf{b}$.` },
      { math: md`${poly([[a11, "\\hat{x}_1"], [a12, "\\hat{x}_2"]])} = ${r1}, \qquad ${poly([[a12, "\\hat{x}_1"], [a22, "\\hat{x}_2"]])} = ${r2}`, note: "The normal equations, written out." },
      { math: md`\hat{x}_1 = \frac{${a22} \cdot ${P(r1)} - ${P(a12)} \cdot ${P(r2)}}{${det}} = ${ftex(p!)}, \qquad \hat{x}_2 = \frac{${a11} \cdot ${P(r2)} - ${P(a12)} \cdot ${P(r1)}}{${det}} = ${ftex(q!)}`, note: md`Solve the $2 \times 2$ system (Cramer's rule, or eliminate). $\det(A^TA) = ${det}$.` },
      { math: md`\hat{\mathbf{x}} = ${tuple([ftex(p!), ftex(q!)]).replace(/^\(/, "\\left(").replace(/\)$/, "\\right)")}`, note: md`Check: the residual $\mathbf{b} - A\hat{\mathbf{x}}$ is orthogonal to both columns of $A$.` },
    ],
  };
};

const X_PATTERNS: Vec[] = [
  [0, 1, 2],
  [1, 2, 3],
  [0, 1, 2, 3],
  [1, 2, 3, 4],
  [-1, 0, 1, 2],
  [0, 2, 4, 6],
];

const fitLine: Generator = (r) => {
  const xs = r.pick(X_PATTERNS);
  const n = xs.length;
  let ys: Vec;
  if (r.next() < 0.5) {
    // Built from a whole-number line plus a residual orthogonal to both columns.
    const m = r.pick([-2, -1, 1, 2, 3]);
    const b0 = r.int(-2, 5);
    const k = r.pick([-1, 1]);
    const pattern = n === 3 ? [1, -2, 1] : [1, -1, -1, 1];
    ys = xs.map((x, i) => m * x + b0 + k * pattern[i]!);
  } else {
    ys = xs.map(() => r.int(-3, 8));
  }
  const sx = xs.reduce((a, b) => a + b, 0);
  const sxx = dot(xs, xs);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = dot(xs, ys);
  const det = n * sxx - sx * sx;
  const m = fr(n * sxy - sx * sy, det);
  const b = fr(sxx * sy - sx * sxy, det);
  const pts = xs.map((x, i) => `(${x}, ${ys[i]})`);
  const lo = Math.min(...ys, 0) - 1;
  const hi = Math.max(...ys, 0) + 1;
  const resid = (l: string) => xs.map((x, i) => `(${ys[i]} - p*(${x}) - ${l})`);
  return {
    prompt: md`Find the least-squares line $y = mx + b$ through the data points $${pts.join(", ")}$. Give $(m, b)$ as a tuple, fractions allowed.`,
    answer: tuple([ftxt(m), ftxt(b)]),
    form: "tuple",
    figure: {
      kind: "plot",
      x: [Math.min(...xs) - 1, Math.max(...xs) + 1],
      y: [lo, hi],
      points: xs.map((x, i) => ({ x, y: ys[i]!, color: 2 as const })),
    },
    verify: [`${resid("q").map((t, i) => `${t}*(${xs[i]})`).join(" + ")} = 0`, `${resid("q").join(" + ")} = 0`],
    hint: md`Each point gives an equation $m x_i + b = y_i$. The normal equations are $(\sum x_i^2)\,m + (\sum x_i)\,b = \sum x_i y_i$ and $(\sum x_i)\,m + ${n}b = \sum y_i$.`,
    solution: [
      { math: md`A = ${col(xs.map((x) => `${x} & 1`))}, \qquad \mathbf{y} = ${col(ys)}`, note: md`The system $A\begin{bmatrix} m \\ b \end{bmatrix} = \mathbf{y}$ asks the line to pass through every point. It can't, so we take the least-squares solution.` },
      { math: md`\sum x_i = ${sx}, \quad \sum x_i^2 = ${sxx}, \quad \sum y_i = ${sy}, \quad \sum x_i y_i = ${sxy}`, note: md`The entries of $A^TA$ and $A^T\mathbf{y}$.` },
      { math: md`${poly([[sxx, "m"], [sx, "b"]])} = ${sxy}, \qquad ${poly([[sx, "m"], [n, "b"]])} = ${sy}`, note: "The normal equations." },
      { math: md`m = \frac{${n} \cdot ${P(sxy)} - ${P(sx)} \cdot ${P(sy)}}{${n} \cdot ${sxx} - ${P(sx)}^2} = \frac{${n * sxy - sx * sy}}{${det}} = ${ftex(m)}`, note: "Eliminate b (or use Cramer's rule)." },
      { math: md`b = \frac{\sum y_i - m \sum x_i}{${n}} = ${ftex(b)}`, note: "Back-substitute into the second normal equation." },
      { math: lineTex(m, b), note: "The residuals (vertical gaps to the line) add to zero, as the second normal equation says they must." },
    ],
  };
};

const leastSquaresResidual: Generator = (r) => {
  const askError = r.next() < 0.5;
  const [c1, c2, nrm] = twoColumns(r);
  const x = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const k = r.pick([-2, -1, 1, 2]);
  const b = c1.map((a, i) => a * x[0]! + c2[i]! * x[1]! + k * nrm[i]!);
  const [p, q, info] = normalSolve(c1, c2, b);
  const fitted = c1.map((a, i) => a * x[0]! + c2[i]! * x[1]!);
  const resid = nrm.map((a) => k * a);
  const S = dot(resid, resid);
  const steps: Step[] = [
    { math: md`A^TA = \begin{bmatrix} ${info.a11} & ${info.a12} \\ ${info.a12} & ${info.a22} \end{bmatrix}, \qquad A^T\mathbf{b} = ${col([info.r1, info.r2])}`, note: "Set up the normal equations." },
    { math: md`\hat{\mathbf{x}} = ${col([ftex(p), ftex(q)])}`, note: md`Solve $A^TA\,\hat{\mathbf{x}} = A^T\mathbf{b}$.` },
    { math: md`A\hat{\mathbf{x}} = ${col(fitted)}, \qquad \mathbf{b} - A\hat{\mathbf{x}} = ${col(resid)}`, note: md`$A\hat{\mathbf{x}}$ is the projection of $\mathbf{b}$ onto the column space; the residual is what's left.` },
  ];
  const setup = md`Let $A = ${mat2(c1, c2)}$ and $\mathbf{b} = ${col(b)}$, and let $\hat{\mathbf{x}}$ be the least-squares solution of $A\mathbf{x} = \mathbf{b}$.`;
  if (askError) {
    return {
      prompt: md`${setup} Find the least-squares error $\|\mathbf{b} - A\hat{\mathbf{x}}\|$. Give the exact value in simplest form.`,
      answer: sqrtText(S),
      simplified: true,
      verify: [`E * sqrt(${dot(nrm, nrm)}) = abs(${dot(b, nrm)})`],
      hint: md`Find $\hat{\mathbf{x}}$, then the residual $\mathbf{b} - A\hat{\mathbf{x}}$, then its length.`,
      solution: [...steps, { math: md`\|\mathbf{b} - A\hat{\mathbf{x}}\| = \sqrt{${squares(resid)}} = ${sqrtTex(S)}`, note: "The smallest possible distance from b to any vector of the form Ax." }],
    };
  }
  return {
    prompt: md`${setup} Find the residual vector $\mathbf{b} - A\hat{\mathbf{x}}$. Give it as a tuple.`,
    answer: tuple(resid.map(String)),
    form: "tuple",
    verify: [
      `${["p", "q", "r"].map((l, i) => `${l}*(${c1[i]})`).join(" + ")} = 0`,
      `${["p", "q", "r"].map((l, i) => `${l}*(${c2[i]})`).join(" + ")} = 0`,
      `${["p", "q", "r"].map((l, i) => `(${b[i]} - ${l})*(${nrm[i]})`).join(" + ")} = 0`,
    ],
    hint: md`Solve the normal equations for $\hat{\mathbf{x}}$, then subtract $A\hat{\mathbf{x}}$ from $\mathbf{b}$. The residual must be orthogonal to both columns of $A$.`,
    solution: [...steps, { math: md`${vec(resid)} \cdot ${vec(c1)} = 0, \qquad ${vec(resid)} \cdot ${vec(c2)} = 0`, note: "Check: the residual is orthogonal to the column space." }],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit6: Unit = {
  title: "Orthogonality",
  lessons: [
    {
      id: slug("Inner products and length"),
      title: "Inner products and length",
      summary: "The dot product, the lengths, distances and angles it defines, and the Cauchy–Schwarz inequality proved.",
      blocks: [
        {
          kind: "text",
          body: md`So far vectors have been added and scaled, and that was enough to talk about span, independence and bases. Nothing in those operations measures anything. We can't yet say how long a vector is, or whether two vectors point the same way. One new operation gives us both. You met it in $\mathbb{R}^2$ and $\mathbb{R}^3$ in Trigonometry; here it works in $\mathbb{R}^n$.`,
        },
        {
          kind: "key",
          title: "The dot product (inner product)",
          body: md`For $\mathbf{u}, \mathbf{v}$ in $\mathbb{R}^n$,

$$\mathbf{u} \cdot \mathbf{v} = u_1 v_1 + u_2 v_2 + \cdots + u_n v_n = \mathbf{u}^T \mathbf{v}.$$

It takes two vectors and gives a **number**. For all vectors and every scalar $c$:

- $\mathbf{u} \cdot \mathbf{v} = \mathbf{v} \cdot \mathbf{u}$
- $(\mathbf{u} + \mathbf{v}) \cdot \mathbf{w} = \mathbf{u} \cdot \mathbf{w} + \mathbf{v} \cdot \mathbf{w}$
- $(c\mathbf{u}) \cdot \mathbf{v} = c(\mathbf{u} \cdot \mathbf{v})$
- $\mathbf{u} \cdot \mathbf{u} \ge 0$, and $\mathbf{u} \cdot \mathbf{u} = 0$ only when $\mathbf{u} = \mathbf{0}$.`,
        },
        {
          kind: "why",
          title: "Why those four properties hold",
          body: md`Each one is a fact about ordinary numbers, applied in every component at once. $u_i v_i = v_i u_i$, so the sum is the same in either order. $(u_i + v_i) w_i = u_i w_i + v_i w_i$ is the distributive law, summed. $(c u_i) v_i = c (u_i v_i)$, and a common factor $c$ comes out of a sum.

The last one is the important one. $\mathbf{u} \cdot \mathbf{u} = u_1^2 + \cdots + u_n^2$ is a sum of squares, so it can't be negative, and the only way a sum of squares is zero is for every square to be zero, which means every $u_i = 0$. This is what lets the dot product measure length.`,
        },
        {
          kind: "key",
          title: "Length, distance, unit vectors",
          body: md`$$\|\mathbf{v}\| = \sqrt{\mathbf{v} \cdot \mathbf{v}} = \sqrt{v_1^2 + \cdots + v_n^2}$$

The **distance** between $\mathbf{u}$ and $\mathbf{v}$ is $\|\mathbf{u} - \mathbf{v}\|$. Scaling scales the length: $\|c\mathbf{v}\| = |c|\,\|\mathbf{v}\|$. A **unit vector** has length 1; every nonzero $\mathbf{v}$ has exactly one unit vector in its direction, $\dfrac{1}{\|\mathbf{v}\|}\mathbf{v}$. Making that vector is called **normalizing**.`,
        },
        {
          kind: "why",
          title: "Why the square root of v · v is the length",
          body: md`In $\mathbb{R}^2$ this is Pythagoras: $\langle 3, 4 \rangle$ is the hypotenuse of a right triangle with legs 3 and 4, so its length is $\sqrt{3^2 + 4^2} = 5$. In $\mathbb{R}^3$ apply Pythagoras twice. The vector $\langle a, b, c \rangle$ reaches $\langle a, b, 0 \rangle$ along the floor, a distance $\sqrt{a^2 + b^2}$, then rises straight up by $c$. Those two legs are perpendicular, so the length is $\sqrt{(a^2 + b^2) + c^2}$.

In $\mathbb{R}^4$ and beyond there is no picture. We take the formula as the **definition** of length, chosen because it agrees with the pictures in two and three dimensions and keeps behaving like a length. For instance, $\|c\mathbf{v}\|^2 = (c\mathbf{v}) \cdot (c\mathbf{v}) = c^2 (\mathbf{v} \cdot \mathbf{v})$, so $\|c\mathbf{v}\| = |c|\,\|\mathbf{v}\|$: doubling a vector doubles its length, in any dimension.`,
        },
        {
          kind: "example",
          title: "Length and a unit vector",
          problem: md`Find the length of $\mathbf{v} = \langle 2, -1, 2, 4 \rangle$ and the unit vector in its direction.`,
          steps: [
            { math: md`\mathbf{v} \cdot \mathbf{v} = 4 + 1 + 4 + 16 = 25`, note: "Square every component and add." },
            { math: md`\|\mathbf{v}\| = \sqrt{25} = 5`, note: "" },
            { math: md`\frac{1}{5}\mathbf{v} = \left\langle \tfrac{2}{5}, -\tfrac{1}{5}, \tfrac{2}{5}, \tfrac{4}{5} \right\rangle`, note: md`Divide by the length. Check: $\frac{4 + 1 + 4 + 16}{25} = 1$.` },
          ],
        },
        {
          kind: "key",
          title: "Angle and orthogonality",
          body: md`For nonzero $\mathbf{u}, \mathbf{v}$ the angle $\theta$ between them satisfies

$$\mathbf{u} \cdot \mathbf{v} = \|\mathbf{u}\|\,\|\mathbf{v}\| \cos\theta.$$

So the sign of the dot product says whether the angle is acute, right or obtuse. Two vectors are **orthogonal** (perpendicular) when $\mathbf{u} \cdot \mathbf{v} = 0$, written $\mathbf{u} \perp \mathbf{v}$. The zero vector is orthogonal to everything.`,
        },
        {
          kind: "why",
          title: "Why the dot product knows the angle",
          body: md`Draw $\mathbf{u}$ and $\mathbf{v}$ from the same point. The third side of the triangle is $\mathbf{u} - \mathbf{v}$. The law of cosines (Geometry) says

$$\|\mathbf{u} - \mathbf{v}\|^2 = \|\mathbf{u}\|^2 + \|\mathbf{v}\|^2 - 2\|\mathbf{u}\|\,\|\mathbf{v}\|\cos\theta.$$

Now expand the left side with the dot product rules, exactly as you'd expand $(u - v)^2$:

$$\|\mathbf{u} - \mathbf{v}\|^2 = (\mathbf{u} - \mathbf{v}) \cdot (\mathbf{u} - \mathbf{v}) = \mathbf{u} \cdot \mathbf{u} - 2\,\mathbf{u} \cdot \mathbf{v} + \mathbf{v} \cdot \mathbf{v}.$$

Compare the two: $-2\,\mathbf{u} \cdot \mathbf{v} = -2\|\mathbf{u}\|\,\|\mathbf{v}\|\cos\theta$. Divide by $-2$. In $\mathbb{R}^n$ there is no triangle to draw, so we use the formula to **define** the angle. For that to make sense we need the right side of $\cos\theta = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|\|\mathbf{v}\|}$ to lie between $-1$ and $1$. That's the Cauchy–Schwarz inequality, proved below.`,
        },
        {
          kind: "diagram",
          view: [-5, 5, -5, 5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "U", x: 4, y: 1, label: "\\mathbf{u}", dir: "e" },
            { name: "V", x: "4cos(t pi/180)", y: "4sin(t pi/180)", label: "\\mathbf{v}", dir: "ne" },
          ],
          segments: [
            { from: "O", to: "U", arrow: true },
            { from: "O", to: "V", arrow: true, color: 2 },
          ],
          angles: [{ at: "O", from: "U", to: "V", label: "\\theta" }],
          params: [{ name: "t", tex: "\\text{direction of } \\mathbf{v}", min: 0, max: 360, step: 5, value: 60 }],
          readouts: [
            { label: "\\mathbf{u} \\cdot \\mathbf{v}", value: "16cos(t pi/180) + 4sin(t pi/180)" },
            { label: "\\theta", value: "180/pi * acos((16cos(t pi/180) + 4sin(t pi/180))/(4 sqrt(17)))", unit: "^\\circ" },
          ],
          caption: md`Turn $\mathbf{v}$. The dot product is positive while $\theta < 90^\circ$, zero at exactly $90^\circ$, and negative beyond. Its largest value, $\|\mathbf{u}\|\,\|\mathbf{v}\| = 4\sqrt{17}$, comes when the vectors line up.`,
        },
        {
          kind: "proof",
          title: "The Pythagorean theorem in R^n",
          given: md`$\mathbf{u} \perp \mathbf{v}$`,
          prove: md`$\|\mathbf{u} + \mathbf{v}\|^2 = \|\mathbf{u}\|^2 + \|\mathbf{v}\|^2$`,
          steps: [
            { statement: md`$\|\mathbf{u} + \mathbf{v}\|^2 = (\mathbf{u} + \mathbf{v}) \cdot (\mathbf{u} + \mathbf{v})$`, reason: "Definition of length" },
            { statement: md`$= \mathbf{u} \cdot \mathbf{u} + 2\,\mathbf{u} \cdot \mathbf{v} + \mathbf{v} \cdot \mathbf{v}$`, reason: "Distribute; the two cross terms are equal by symmetry" },
            { statement: md`$= \|\mathbf{u}\|^2 + 0 + \|\mathbf{v}\|^2$`, reason: md`$\mathbf{u} \cdot \mathbf{v} = 0$ (given)` },
          ],
        },
        {
          kind: "text",
          body: md`Read the proof backwards and you get the converse: if $\|\mathbf{u} + \mathbf{v}\|^2 = \|\mathbf{u}\|^2 + \|\mathbf{v}\|^2$ then $2\,\mathbf{u} \cdot \mathbf{v} = 0$. So in any dimension, the Pythagorean relation holds exactly when the vectors are orthogonal. The same expansion without the zero gives a useful identity: the dot product can be recovered from lengths alone,

$$\mathbf{u} \cdot \mathbf{v} = \tfrac{1}{2}\left(\|\mathbf{u} + \mathbf{v}\|^2 - \|\mathbf{u}\|^2 - \|\mathbf{v}\|^2\right).$$`,
        },
        {
          kind: "key",
          title: "The Cauchy–Schwarz inequality",
          body: md`For all $\mathbf{u}, \mathbf{v}$ in $\mathbb{R}^n$,

$$|\mathbf{u} \cdot \mathbf{v}| \le \|\mathbf{u}\|\,\|\mathbf{v}\|,$$

with equality exactly when one vector is a multiple of the other. It is what makes $\cos\theta = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|\|\mathbf{v}\|}$ a legitimate cosine in every dimension.`,
        },
        {
          kind: "proof",
          title: "Cauchy–Schwarz",
          given: md`$\mathbf{u}, \mathbf{v}$ in $\mathbb{R}^n$ with $\mathbf{v} \ne \mathbf{0}$ (if $\mathbf{v} = \mathbf{0}$ both sides are 0)`,
          prove: md`$(\mathbf{u} \cdot \mathbf{v})^2 \le \|\mathbf{u}\|^2 \|\mathbf{v}\|^2$`,
          steps: [
            { statement: md`For every real $t$, $q(t) = \|\mathbf{u} - t\mathbf{v}\|^2 \ge 0$`, reason: "A length squared is never negative" },
            { statement: md`$q(t) = \|\mathbf{v}\|^2 t^2 - 2(\mathbf{u} \cdot \mathbf{v})\,t + \|\mathbf{u}\|^2$`, reason: md`Expand $(\mathbf{u} - t\mathbf{v}) \cdot (\mathbf{u} - t\mathbf{v})$ with the dot product rules` },
            { statement: md`$q$ is a quadratic in $t$ with positive leading coefficient $\|\mathbf{v}\|^2$ that never goes below the axis` },
            { statement: md`Its discriminant is $\le 0$: $\;4(\mathbf{u} \cdot \mathbf{v})^2 - 4\|\mathbf{v}\|^2\|\mathbf{u}\|^2 \le 0$`, reason: "A quadratic with two real roots dips below the axis between them (Algebra 1)" },
            { statement: md`$(\mathbf{u} \cdot \mathbf{v})^2 \le \|\mathbf{u}\|^2\|\mathbf{v}\|^2$`, reason: "Divide by 4 and rearrange; take square roots for the stated form" },
            { statement: md`Equality holds exactly when $q(t) = 0$ for some $t$, i.e. $\mathbf{u} = t\mathbf{v}$`, reason: "Discriminant zero means a double root, where the length is 0" },
          ].map((s) => ({ ...s, reason: s.reason ?? "" })),
        },
        {
          kind: "plot",
          x: [-3, 5],
          y: [-2, 30],
          curves: [{ expr: "10 - 2x(3a + b) + x^2 (a^2 + b^2)", label: "q(x) = \\|\\mathbf{u} - x\\mathbf{v}\\|^2" }],
          points: [{ x: "(3a + b)/(a^2 + b^2)", y: "10 - (3a + b)^2/(a^2 + b^2)", label: "\\text{min} = {=10 - (3a + b)^2/(a^2 + b^2)}", color: 2 }],
          params: [
            { name: "a", tex: "v_1", min: 0.5, max: 4, step: 0.5, value: 1 },
            { name: "b", tex: "v_2", min: -4, max: 4, step: 0.5, value: 2 },
          ],
          caption: md`The quadratic from the proof, with $\mathbf{u} = \langle 3, 1 \rangle$ and $\mathbf{v} = \langle v_1, v_2 \rangle$. Whatever $\mathbf{v}$ you choose, the parabola never crosses the axis. Set $\mathbf{v} = \langle 3, 1 \rangle$ and it just touches, at $x = 1$: that's the equality case. The lowest point sits at $x = \frac{\mathbf{u} \cdot \mathbf{v}}{\mathbf{v} \cdot \mathbf{v}}$, a number that is the whole subject of the next lesson.`,
        },
        {
          kind: "text",
          body: md`Cauchy–Schwarz has a geometric corollary, the **triangle inequality** $\|\mathbf{u} + \mathbf{v}\| \le \|\mathbf{u}\| + \|\mathbf{v}\|$: a detour is never shorter than the direct route. Expand and apply the inequality to the cross term:

$$\|\mathbf{u} + \mathbf{v}\|^2 = \|\mathbf{u}\|^2 + 2\,\mathbf{u} \cdot \mathbf{v} + \|\mathbf{v}\|^2 \le \|\mathbf{u}\|^2 + 2\|\mathbf{u}\|\|\mathbf{v}\| + \|\mathbf{v}\|^2 = (\|\mathbf{u}\| + \|\mathbf{v}\|)^2.$$`,
        },
        {
          kind: "check",
          prompt: md`Find $k$ so that $\langle 2, k, 1 \rangle$ is orthogonal to $\langle 3, -2, 4 \rangle$.`,
          answer: "5",
          explain: md`Orthogonal means the dot product is 0: $6 - 2k + 4 = 0$, so $k = 5$.`,
        },
        {
          kind: "check",
          prompt: md`Find the length of $\langle 1, 3, -2 \rangle$. Type the exact value, like **sqrt(14)**.`,
          answer: "sqrt(14)",
          simplified: true,
          explain: md`$1 + 9 + 4 = 14$, and 14 has no square factor, so $\|\mathbf{v}\| = \sqrt{14}$.`,
        },
      ],
      practice: [dotLengthDistance, unitVector, angleBetween],
    },
    {
      id: slug("Orthogonal projections"),
      title: "Orthogonal projections",
      summary: "Projection onto a line and onto a subspace, the free coordinates an orthogonal basis gives, and why the projection is the closest point.",
      blocks: [
        {
          kind: "text",
          body: md`Hold a stick $\mathbf{b}$ above a line $L$ with the sun directly overhead. Its shadow on $L$ is the **orthogonal projection** of $\mathbf{b}$ onto $L$. Two questions come with it: how much of $\mathbf{b}$ points along $L$, and what is left over? The leftover turns out to be perpendicular to $L$, and that single fact drives everything in this unit.`,
        },
        {
          kind: "key",
          title: "Projection onto a line",
          body: md`Let $L$ be the line through $\mathbf{0}$ spanned by $\mathbf{a} \ne \mathbf{0}$. The orthogonal projection of $\mathbf{b}$ onto $L$ is

$$\hat{\mathbf{b}} = \operatorname{proj}_{\mathbf{a}} \mathbf{b} = \frac{\mathbf{a} \cdot \mathbf{b}}{\mathbf{a} \cdot \mathbf{a}}\,\mathbf{a}.$$

The leftover $\mathbf{z} = \mathbf{b} - \hat{\mathbf{b}}$ is orthogonal to $\mathbf{a}$, so $\mathbf{b} = \hat{\mathbf{b}} + \mathbf{z}$ splits $\mathbf{b}$ into a part along $L$ and a part perpendicular to $L$. The distance from the point $\mathbf{b}$ to the line is $\|\mathbf{z}\|$.`,
        },
        {
          kind: "why",
          title: "Where the coefficient comes from",
          body: md`The shadow lies on $L$, so it's some multiple $c\mathbf{a}$. The one thing we ask of the shadow is that the leftover $\mathbf{b} - c\mathbf{a}$ be perpendicular to the line:

$$(\mathbf{b} - c\mathbf{a}) \cdot \mathbf{a} = 0 \quad\Longrightarrow\quad \mathbf{b} \cdot \mathbf{a} - c\,(\mathbf{a} \cdot \mathbf{a}) = 0 \quad\Longrightarrow\quad c = \frac{\mathbf{a} \cdot \mathbf{b}}{\mathbf{a} \cdot \mathbf{a}}.$$

So the leftover is orthogonal by construction: that's the equation we solved. Notice the formula only cares about the direction of $\mathbf{a}$. Replace $\mathbf{a}$ by $2\mathbf{a}$ and the top doubles, the bottom quadruples, the vector doubles: same $\hat{\mathbf{b}}$. With a unit vector $\hat{\mathbf{a}}$ it reads $\hat{\mathbf{b}} = (\hat{\mathbf{a}} \cdot \mathbf{b})\,\hat{\mathbf{a}}$, and its length is $|\hat{\mathbf{a}} \cdot \mathbf{b}| = \|\mathbf{b}\|\,|\cos\theta|$, the shadow length from trigonometry.`,
        },
        {
          kind: "diagram",
          view: [-5, 5, -4, 5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "A", x: 4, y: 2, label: "\\mathbf{a}", dir: "se" },
            { name: "B", x: "4cos(t pi/180)", y: "4sin(t pi/180)", label: "\\mathbf{b}", dir: "n" },
            { name: "P", x: "(16cos(t pi/180) + 8sin(t pi/180))/5", y: "(16cos(t pi/180) + 8sin(t pi/180))/10", label: "\\hat{\\mathbf{b}}", dir: "s" },
          ],
          segments: [
            { from: "O", to: "A", kind: "line", dashed: true },
            { from: "O", to: "A", arrow: true },
            { from: "O", to: "B", arrow: true, color: 2 },
            { from: "O", to: "P", arrow: true, color: 3 },
            { from: "B", to: "P", dashed: true, color: 2, label: "\\mathbf{z}" },
          ],
          angles: [{ at: "P", from: "O", to: "B", right: true }],
          params: [{ name: "t", tex: "\\text{direction of } \\mathbf{b}", min: 0, max: 355, step: 5, value: 70 }],
          readouts: [{ label: "c = \\frac{\\mathbf{a}\\cdot\\mathbf{b}}{\\mathbf{a}\\cdot\\mathbf{a}}", value: "(16cos(t pi/180) + 8sin(t pi/180))/20" }],
          caption: md`$\mathbf{a} = \langle 4, 2 \rangle$ and $\|\mathbf{b}\| = 4$. The projection (green) slides along the line as $\mathbf{b}$ turns; the dashed leftover $\mathbf{z}$ always meets the line at a right angle. When $c < 0$ the shadow points backwards along $\mathbf{a}$.`,
        },
        {
          kind: "example",
          title: "Projecting onto a line",
          problem: md`Project $\mathbf{b} = \langle 3, 4 \rangle$ onto $\mathbf{a} = \langle 1, 2 \rangle$, and find the distance from the point $(3, 4)$ to the line $y = 2x$.`,
          steps: [
            { math: md`\mathbf{a} \cdot \mathbf{b} = 3 + 8 = 11, \qquad \mathbf{a} \cdot \mathbf{a} = 1 + 4 = 5`, note: "The two dot products." },
            { math: md`\hat{\mathbf{b}} = \frac{11}{5}\langle 1, 2 \rangle = \left\langle \tfrac{11}{5}, \tfrac{22}{5} \right\rangle`, note: "The shadow, a multiple of a." },
            { math: md`\mathbf{z} = \mathbf{b} - \hat{\mathbf{b}} = \left\langle \tfrac{4}{5}, -\tfrac{2}{5} \right\rangle`, note: md`Check: $\mathbf{z} \cdot \mathbf{a} = \frac{4}{5} - \frac{4}{5} = 0$.` },
            { math: md`\|\mathbf{z}\| = \sqrt{\tfrac{16}{25} + \tfrac{4}{25}} = \sqrt{\tfrac{20}{25}} = \frac{2\sqrt{5}}{5}`, note: md`The line $y = 2x$ is spanned by $\mathbf{a}$, so this is the distance from the point to the line.` },
          ],
        },
        {
          kind: "key",
          title: "Orthogonal sets and bases",
          body: md`A set of vectors is **orthogonal** when every pair is orthogonal, and **orthonormal** when in addition each has length 1. An orthogonal set of nonzero vectors is linearly independent, so it's a basis for its span, an **orthogonal basis**. In such a basis the coordinates of any $\mathbf{b}$ in the span come from dot products alone:

$$\mathbf{b} = c_1 \mathbf{u}_1 + \cdots + c_k \mathbf{u}_k \quad\text{with}\quad c_i = \frac{\mathbf{b} \cdot \mathbf{u}_i}{\mathbf{u}_i \cdot \mathbf{u}_i}.$$

For an orthonormal basis the denominators are 1 and $c_i = \mathbf{b} \cdot \mathbf{u}_i$.`,
        },
        {
          kind: "proof",
          title: "Orthogonal nonzero vectors are independent",
          given: md`$\mathbf{u}_1, \ldots, \mathbf{u}_k$ nonzero and mutually orthogonal`,
          prove: md`If $c_1 \mathbf{u}_1 + \cdots + c_k \mathbf{u}_k = \mathbf{0}$ then every $c_i = 0$`,
          steps: [
            { statement: md`$(c_1 \mathbf{u}_1 + \cdots + c_k \mathbf{u}_k) \cdot \mathbf{u}_j = \mathbf{0} \cdot \mathbf{u}_j = 0$`, reason: md`Dot both sides with $\mathbf{u}_j$` },
            { statement: md`$c_1 (\mathbf{u}_1 \cdot \mathbf{u}_j) + \cdots + c_k (\mathbf{u}_k \cdot \mathbf{u}_j) = 0$`, reason: "Distribute" },
            { statement: md`$c_j (\mathbf{u}_j \cdot \mathbf{u}_j) = 0$`, reason: md`Every $\mathbf{u}_i \cdot \mathbf{u}_j$ with $i \ne j$ is 0` },
            { statement: md`$c_j = 0$`, reason: md`$\mathbf{u}_j \cdot \mathbf{u}_j = \|\mathbf{u}_j\|^2 \ne 0$` },
            { statement: md`This holds for each $j$, so all the coefficients are 0`, reason: md`$j$ was arbitrary` },
          ],
        },
        {
          kind: "why",
          title: "Why coordinates come from dot products",
          body: md`Finding coordinates normally means solving a system by elimination (Unit 5). With an orthogonal basis, the same trick as in the proof does it in one line. Start from $\mathbf{b} = c_1 \mathbf{u}_1 + \cdots + c_k \mathbf{u}_k$ and dot both sides with $\mathbf{u}_j$. On the right, every term but one vanishes:

$$\mathbf{b} \cdot \mathbf{u}_j = c_j\,(\mathbf{u}_j \cdot \mathbf{u}_j), \qquad\text{so}\qquad c_j = \frac{\mathbf{b} \cdot \mathbf{u}_j}{\mathbf{u}_j \cdot \mathbf{u}_j}.$$

Each coefficient depends on its own basis vector only. That's the same formula as the projection coefficient: in an orthogonal basis, $\mathbf{b}$ is simply the sum of its shadows on the basis directions.`,
        },
        {
          kind: "key",
          title: "Projection onto a subspace",
          body: md`Let $W$ be a subspace with an orthogonal basis $\mathbf{u}_1, \ldots, \mathbf{u}_k$. The orthogonal projection of $\mathbf{b}$ onto $W$ is the sum of its line projections,

$$\hat{\mathbf{b}} = \operatorname{proj}_W \mathbf{b} = \frac{\mathbf{b} \cdot \mathbf{u}_1}{\mathbf{u}_1 \cdot \mathbf{u}_1}\mathbf{u}_1 + \cdots + \frac{\mathbf{b} \cdot \mathbf{u}_k}{\mathbf{u}_k \cdot \mathbf{u}_k}\mathbf{u}_k,$$

and $\mathbf{z} = \mathbf{b} - \hat{\mathbf{b}}$ is orthogonal to every vector in $W$. **Orthogonal decomposition theorem:** each $\mathbf{b}$ can be written in exactly one way as $\hat{\mathbf{b}} + \mathbf{z}$ with $\hat{\mathbf{b}}$ in $W$ and $\mathbf{z} \perp W$. If $\mathbf{b}$ is already in $W$, then $\hat{\mathbf{b}} = \mathbf{b}$.`,
        },
        {
          kind: "why",
          title: "Why a sum of line projections, and why the basis must be orthogonal",
          body: md`We want $\hat{\mathbf{b}} = c_1\mathbf{u}_1 + \cdots + c_k\mathbf{u}_k$ in $W$ with the leftover orthogonal to each basis vector. Dot the leftover with $\mathbf{u}_j$:

$$(\mathbf{b} - c_1\mathbf{u}_1 - \cdots - c_k\mathbf{u}_k) \cdot \mathbf{u}_j = \mathbf{b} \cdot \mathbf{u}_j - c_j\,(\mathbf{u}_j \cdot \mathbf{u}_j) = 0.$$

The cross terms dropped out **because** the basis is orthogonal, and that leaves one equation in one unknown, $c_j = \frac{\mathbf{b} \cdot \mathbf{u}_j}{\mathbf{u}_j \cdot \mathbf{u}_j}$. With a non-orthogonal basis the $k$ equations would all be tangled together; the next lesson shows how to make any basis orthogonal.

Orthogonal to each $\mathbf{u}_j$ means orthogonal to every combination of them, so $\mathbf{z} \perp W$. For uniqueness, suppose $\mathbf{b} = \mathbf{w} + \mathbf{z} = \mathbf{w}' + \mathbf{z}'$ with both $\mathbf{w}$'s in $W$ and both $\mathbf{z}$'s orthogonal to $W$. Then $\mathbf{w} - \mathbf{w}' = \mathbf{z}' - \mathbf{z}$ lies in $W$ and is orthogonal to $W$, so it's orthogonal to itself: $\|\mathbf{w} - \mathbf{w}'\|^2 = 0$, and the two decompositions agree.`,
        },
        {
          kind: "example",
          title: "Projecting onto a plane",
          problem: md`$W$ is spanned by the orthogonal vectors $\mathbf{u}_1 = \langle 1, 1, 0 \rangle$ and $\mathbf{u}_2 = \langle 1, -1, 1 \rangle$. Project $\mathbf{b} = \langle 2, 4, 3 \rangle$ onto $W$.`,
          steps: [
            { math: md`\mathbf{u}_1 \cdot \mathbf{u}_2 = 1 - 1 + 0 = 0`, note: "Confirm the basis is orthogonal first; the formula depends on it." },
            { math: md`\frac{\mathbf{b} \cdot \mathbf{u}_1}{\mathbf{u}_1 \cdot \mathbf{u}_1} = \frac{6}{2} = 3, \qquad \frac{\mathbf{b} \cdot \mathbf{u}_2}{\mathbf{u}_2 \cdot \mathbf{u}_2} = \frac{2 - 4 + 3}{3} = \frac{1}{3}`, note: "One coefficient per basis vector." },
            { math: md`\hat{\mathbf{b}} = 3\langle 1, 1, 0 \rangle + \tfrac{1}{3}\langle 1, -1, 1 \rangle = \left\langle \tfrac{10}{3}, \tfrac{8}{3}, \tfrac{1}{3} \right\rangle`, note: "Add the two shadows." },
            { math: md`\mathbf{z} = \mathbf{b} - \hat{\mathbf{b}} = \left\langle -\tfrac{4}{3}, \tfrac{4}{3}, \tfrac{8}{3} \right\rangle`, note: md`Check: $\mathbf{z} \cdot \mathbf{u}_1 = 0$ and $\mathbf{z} \cdot \mathbf{u}_2 = -\frac{4}{3} - \frac{4}{3} + \frac{8}{3} = 0$. The distance from $\mathbf{b}$ to the plane is $\|\mathbf{z}\| = \sqrt{\frac{96}{9}} = \frac{4\sqrt{6}}{3}$.` },
          ],
        },
        {
          kind: "proof",
          title: "The best approximation theorem",
          given: md`$W$ a subspace, $\hat{\mathbf{b}} = \operatorname{proj}_W \mathbf{b}$, and $\mathbf{w}$ any other vector in $W$`,
          prove: md`$\|\mathbf{b} - \hat{\mathbf{b}}\| < \|\mathbf{b} - \mathbf{w}\|$: the projection is the point of $W$ closest to $\mathbf{b}$`,
          steps: [
            { statement: md`$\mathbf{b} - \mathbf{w} = (\mathbf{b} - \hat{\mathbf{b}}) + (\hat{\mathbf{b}} - \mathbf{w})$`, reason: md`Add and subtract $\hat{\mathbf{b}}$` },
            { statement: md`$\hat{\mathbf{b}} - \mathbf{w}$ is in $W$`, reason: md`Both are in $W$, and $W$ is a subspace` },
            { statement: md`$\mathbf{b} - \hat{\mathbf{b}} \perp (\hat{\mathbf{b}} - \mathbf{w})$`, reason: md`$\mathbf{b} - \hat{\mathbf{b}}$ is orthogonal to every vector in $W$` },
            { statement: md`$\|\mathbf{b} - \mathbf{w}\|^2 = \|\mathbf{b} - \hat{\mathbf{b}}\|^2 + \|\hat{\mathbf{b}} - \mathbf{w}\|^2$`, reason: md`Pythagoras in $\mathbb{R}^n$ (Lesson 1)` },
            { statement: md`$\|\mathbf{b} - \mathbf{w}\|^2 > \|\mathbf{b} - \hat{\mathbf{b}}\|^2$`, reason: md`$\|\hat{\mathbf{b}} - \mathbf{w}\|^2 > 0$ since $\mathbf{w} \ne \hat{\mathbf{b}}$` },
          ],
        },
        {
          kind: "diagram",
          view: [-2, 8, -1.5, 5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "A", x: 4, y: 2, label: "\\mathbf{a}", dir: "se" },
            { name: "B", x: 1, y: 4, label: "\\mathbf{b}", dir: "n" },
            { name: "P", x: 2.4, y: 1.2, label: "\\hat{\\mathbf{b}}", dir: "se" },
            { name: "W", x: "4s", y: "2s", label: "\\mathbf{w}", dir: "s" },
          ],
          segments: [
            { from: "O", to: "A", kind: "line", dashed: true },
            { from: "O", to: "B", arrow: true, color: 2 },
            { from: "B", to: "P", dashed: true, color: 3 },
            { from: "B", to: "W", color: 4 },
          ],
          params: [{ name: "s", tex: "s \\;(\\mathbf{w} = s\\mathbf{a})", min: -0.4, max: 1.8, step: 0.05, value: 1.2 }],
          readouts: [{ label: "\\|\\mathbf{b} - \\mathbf{w}\\|", value: "sqrt((1 - 4s)^2 + (4 - 2s)^2)" }],
          caption: md`Slide $\mathbf{w}$ along the line and watch the red distance. It is smallest, $\frac{7}{\sqrt{5}} \approx 3.13$, at $s = 0.6$, exactly where $\mathbf{w}$ lands on the projection $\hat{\mathbf{b}}$. Every other point of the line is farther away, as the theorem says.`,
        },
        {
          kind: "check",
          prompt: md`Project $\mathbf{b} = \langle 2, 6 \rangle$ onto $\mathbf{a} = \langle 3, 1 \rangle$. Give the result as a tuple, like **(1/2, 3)**.`,
          answer: "(18/5, 6/5)",
          form: "tuple",
          explain: md`$\mathbf{a} \cdot \mathbf{b} = 12$ and $\mathbf{a} \cdot \mathbf{a} = 10$, so $\hat{\mathbf{b}} = \frac{6}{5}\langle 3, 1 \rangle = \left\langle \frac{18}{5}, \frac{6}{5} \right\rangle$.`,
        },
        {
          kind: "check",
          prompt: md`$\mathbf{u}_1 = \langle 1, 1 \rangle$ and $\mathbf{u}_2 = \langle 1, -1 \rangle$ are orthogonal. Write $\mathbf{b} = \langle 5, 1 \rangle$ as $c_1 \mathbf{u}_1 + c_2 \mathbf{u}_2$ and give $(c_1, c_2)$.`,
          answer: "(3, 2)",
          form: "tuple",
          explain: md`$c_1 = \frac{\mathbf{b} \cdot \mathbf{u}_1}{\mathbf{u}_1 \cdot \mathbf{u}_1} = \frac{6}{2} = 3$ and $c_2 = \frac{4}{2} = 2$. Check: $3\langle 1, 1 \rangle + 2\langle 1, -1 \rangle = \langle 5, 1 \rangle$.`,
        },
      ],
      practice: [projectOntoLine, orthogonalCoordinates, projectOntoPlane],
    },
    {
      id: slug("Gram–Schmidt"),
      title: "Gram–Schmidt",
      summary: "Turning any basis into an orthogonal one, one projection at a time, and why the span never changes.",
      blocks: [
        {
          kind: "text",
          body: md`Last lesson's formulas all began with "let $\mathbf{u}_1, \ldots, \mathbf{u}_k$ be an orthogonal basis". Most bases aren't. The **Gram–Schmidt process** takes any basis of a subspace and straightens it into an orthogonal basis of the same subspace, using nothing but the projection formula. The idea: keep the first vector, and from each later vector subtract its shadow on everything built so far. What remains is perpendicular to all of it.`,
        },
        {
          kind: "key",
          title: "The Gram–Schmidt process",
          body: md`Given a basis $\mathbf{x}_1, \ldots, \mathbf{x}_k$ of a subspace $W$:

$$\begin{aligned}
\mathbf{v}_1 &= \mathbf{x}_1 \\
\mathbf{v}_2 &= \mathbf{x}_2 - \frac{\mathbf{x}_2 \cdot \mathbf{v}_1}{\mathbf{v}_1 \cdot \mathbf{v}_1}\mathbf{v}_1 \\
\mathbf{v}_3 &= \mathbf{x}_3 - \frac{\mathbf{x}_3 \cdot \mathbf{v}_1}{\mathbf{v}_1 \cdot \mathbf{v}_1}\mathbf{v}_1 - \frac{\mathbf{x}_3 \cdot \mathbf{v}_2}{\mathbf{v}_2 \cdot \mathbf{v}_2}\mathbf{v}_2 \\
&\;\;\vdots
\end{aligned}$$

Each $\mathbf{v}_j$ is $\mathbf{x}_j$ minus its projection onto $\operatorname{span}\{\mathbf{v}_1, \ldots, \mathbf{v}_{j-1}\}$. Then $\mathbf{v}_1, \ldots, \mathbf{v}_k$ is an orthogonal basis of $W$. Dividing each $\mathbf{v}_j$ by its length gives an **orthonormal** basis $\mathbf{q}_1, \ldots, \mathbf{q}_k$.`,
        },
        {
          kind: "why",
          title: "Why each new vector is orthogonal to the earlier ones",
          body: md`Suppose $\mathbf{v}_1, \ldots, \mathbf{v}_{j-1}$ are already orthogonal and nonzero. Then they're an orthogonal basis of $W_{j-1} = \operatorname{span}\{\mathbf{v}_1, \ldots, \mathbf{v}_{j-1}\}$, so the projection formula from last lesson applies to it, and the subtracted sum is exactly $\operatorname{proj}_{W_{j-1}} \mathbf{x}_j$. So

$$\mathbf{v}_j = \mathbf{x}_j - \operatorname{proj}_{W_{j-1}} \mathbf{x}_j$$

is the leftover of a projection, and the leftover is orthogonal to the whole subspace $W_{j-1}$, in particular to each earlier $\mathbf{v}_i$. Each step therefore hands the next step exactly what it needs, an orthogonal set, and the argument repeats all the way to $\mathbf{v}_k$.`,
        },
        {
          kind: "why",
          title: "Why the span doesn't change, and why no v is zero",
          body: md`$\mathbf{v}_j$ is $\mathbf{x}_j$ minus a combination of $\mathbf{v}_1, \ldots, \mathbf{v}_{j-1}$. If those are combinations of $\mathbf{x}_1, \ldots, \mathbf{x}_{j-1}$ (true for $\mathbf{v}_1 = \mathbf{x}_1$, and then step by step), $\mathbf{v}_j$ is a combination of $\mathbf{x}_1, \ldots, \mathbf{x}_j$. Rearranging, $\mathbf{x}_j = \mathbf{v}_j + (\text{combination of earlier } \mathbf{v}\text{'s})$, so each $\mathbf{x}_j$ is a combination of the $\mathbf{v}$'s too. Same vectors reachable, same span, at every stage.

Could some $\mathbf{v}_j$ be $\mathbf{0}$? That would mean $\mathbf{x}_j = \operatorname{proj}_{W_{j-1}} \mathbf{x}_j$ lies in the span of $\mathbf{x}_1, \ldots, \mathbf{x}_{j-1}$, contradicting the independence of the $\mathbf{x}$'s. So we end with $k$ nonzero orthogonal vectors in $W$. They're independent (last lesson) and span $W$: a basis.`,
        },
        {
          kind: "diagram",
          view: [-4, 6, -3, 5],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, label: "", dir: "sw" },
            { name: "X", x: 4, y: 1, label: "\\mathbf{x}_1 = \\mathbf{v}_1", dir: "e" },
            { name: "Y", x: "3.5cos(t pi/180)", y: "3.5sin(t pi/180)", label: "\\mathbf{x}_2", dir: "ne" },
            { name: "P", x: "4(14cos(t pi/180) + 3.5sin(t pi/180))/17", y: "(14cos(t pi/180) + 3.5sin(t pi/180))/17", label: "", dir: "s" },
            { name: "V", x: "3.5cos(t pi/180) - 4(14cos(t pi/180) + 3.5sin(t pi/180))/17", y: "3.5sin(t pi/180) - (14cos(t pi/180) + 3.5sin(t pi/180))/17", label: "\\mathbf{v}_2", dir: "nw" },
          ],
          segments: [
            { from: "O", to: "X", kind: "line", dashed: true },
            { from: "O", to: "X", arrow: true },
            { from: "O", to: "Y", arrow: true, color: 2 },
            { from: "P", to: "Y", dashed: true, color: 3 },
            { from: "O", to: "V", arrow: true, color: 3 },
          ],
          angles: [{ at: "O", from: "X", to: "V", right: true }],
          params: [{ name: "t", tex: "\\text{direction of } \\mathbf{x}_2", min: 20, max: 160, step: 5, value: 70 }],
          readouts: [{ label: "\\mathbf{v}_1 \\cdot \\mathbf{v}_2", value: "4(3.5cos(t pi/180) - 4(14cos(t pi/180) + 3.5sin(t pi/180))/17) + (3.5sin(t pi/180) - (14cos(t pi/180) + 3.5sin(t pi/180))/17)" }],
          caption: md`$\mathbf{v}_2$ (green) is $\mathbf{x}_2$ with its shadow on $\mathbf{v}_1$ removed: the dashed leftover, moved to start at the origin. Whatever direction $\mathbf{x}_2$ has, $\mathbf{v}_2$ is perpendicular to $\mathbf{v}_1$, and $\mathbf{v}_1, \mathbf{v}_2$ span the same plane as $\mathbf{x}_1, \mathbf{x}_2$.`,
        },
        {
          kind: "example",
          title: "Two vectors in the plane",
          problem: md`Find an orthonormal basis for $\mathbb{R}^2$ starting from $\mathbf{x}_1 = \langle 3, 1 \rangle$, $\mathbf{x}_2 = \langle 2, 4 \rangle$.`,
          steps: [
            { math: md`\mathbf{v}_1 = \langle 3, 1 \rangle`, note: "Keep the first vector." },
            { math: md`\frac{\mathbf{x}_2 \cdot \mathbf{v}_1}{\mathbf{v}_1 \cdot \mathbf{v}_1} = \frac{6 + 4}{9 + 1} = 1`, note: "The projection coefficient." },
            { math: md`\mathbf{v}_2 = \langle 2, 4 \rangle - 1\langle 3, 1 \rangle = \langle -1, 3 \rangle`, note: md`Check: $\mathbf{v}_2 \cdot \mathbf{v}_1 = -3 + 3 = 0$.` },
            { math: md`\mathbf{q}_1 = \frac{1}{\sqrt{10}}\langle 3, 1 \rangle, \qquad \mathbf{q}_2 = \frac{1}{\sqrt{10}}\langle -1, 3 \rangle`, note: md`Both have length $\sqrt{10}$. Divide to normalize.` },
          ],
        },
        {
          kind: "proof",
          title: "The third vector is orthogonal to the first two",
          given: md`$\mathbf{v}_1 \perp \mathbf{v}_2$, both nonzero, and $\mathbf{v}_3 = \mathbf{x}_3 - c_1\mathbf{v}_1 - c_2\mathbf{v}_2$ with $c_i = \dfrac{\mathbf{x}_3 \cdot \mathbf{v}_i}{\mathbf{v}_i \cdot \mathbf{v}_i}$`,
          prove: md`$\mathbf{v}_3 \cdot \mathbf{v}_1 = 0$ and $\mathbf{v}_3 \cdot \mathbf{v}_2 = 0$`,
          steps: [
            { statement: md`$\mathbf{v}_3 \cdot \mathbf{v}_1 = \mathbf{x}_3 \cdot \mathbf{v}_1 - c_1 (\mathbf{v}_1 \cdot \mathbf{v}_1) - c_2 (\mathbf{v}_2 \cdot \mathbf{v}_1)$`, reason: "Distribute the dot product" },
            { statement: md`$= \mathbf{x}_3 \cdot \mathbf{v}_1 - \dfrac{\mathbf{x}_3 \cdot \mathbf{v}_1}{\mathbf{v}_1 \cdot \mathbf{v}_1}(\mathbf{v}_1 \cdot \mathbf{v}_1) - c_2 \cdot 0$`, reason: md`Definition of $c_1$; $\mathbf{v}_2 \cdot \mathbf{v}_1 = 0$ (given)` },
            { statement: md`$= \mathbf{x}_3 \cdot \mathbf{v}_1 - \mathbf{x}_3 \cdot \mathbf{v}_1 = 0$`, reason: "Cancel" },
            { statement: md`$\mathbf{v}_3 \cdot \mathbf{v}_2 = 0$`, reason: md`The same three lines with the roles of $\mathbf{v}_1$ and $\mathbf{v}_2$ swapped` },
          ],
        },
        {
          kind: "example",
          title: "Three vectors in space",
          problem: md`Apply Gram–Schmidt to $\mathbf{x}_1 = \langle 1, 1, 0 \rangle$, $\mathbf{x}_2 = \langle 1, 0, 1 \rangle$, $\mathbf{x}_3 = \langle 0, 1, 1 \rangle$.`,
          steps: [
            { math: md`\mathbf{v}_1 = \langle 1, 1, 0 \rangle`, note: "" },
            { math: md`\mathbf{v}_2 = \mathbf{x}_2 - \frac{1}{2}\mathbf{v}_1 = \left\langle \tfrac{1}{2}, -\tfrac{1}{2}, 1 \right\rangle`, note: md`$\mathbf{x}_2 \cdot \mathbf{v}_1 = 1$, $\mathbf{v}_1 \cdot \mathbf{v}_1 = 2$.` },
            { math: md`\mathbf{v}_2' = \langle 1, -1, 2 \rangle`, note: md`Doubling $\mathbf{v}_2$ keeps it orthogonal to $\mathbf{v}_1$ and keeps the span. Fractions gone (see the next box).` },
            { math: md`\frac{\mathbf{x}_3 \cdot \mathbf{v}_1}{\mathbf{v}_1 \cdot \mathbf{v}_1} = \frac{1}{2}, \qquad \frac{\mathbf{x}_3 \cdot \mathbf{v}_2'}{\mathbf{v}_2' \cdot \mathbf{v}_2'} = \frac{-1 + 2}{6} = \frac{1}{6}`, note: "Two coefficients for the third step." },
            { math: md`\mathbf{v}_3 = \langle 0, 1, 1 \rangle - \tfrac{1}{2}\langle 1, 1, 0 \rangle - \tfrac{1}{6}\langle 1, -1, 2 \rangle = \left\langle -\tfrac{2}{3}, \tfrac{2}{3}, \tfrac{2}{3} \right\rangle`, note: md`Check: $\mathbf{v}_3 \cdot \mathbf{v}_1 = 0$ and $\mathbf{v}_3 \cdot \mathbf{v}_2' = -\frac{2}{3} - \frac{2}{3} + \frac{4}{3} = 0$. Scaled, the orthogonal basis is $\langle 1, 1, 0 \rangle, \langle 1, -1, 2 \rangle, \langle -1, 1, 1 \rangle$.` },
          ],
        },
        {
          kind: "key",
          title: "Scaling along the way is allowed",
          body: md`Any nonzero multiple of $\mathbf{v}_j$ may replace it before the next step. Multiplying a vector doesn't change the line it spans, so the orthogonal set stays orthogonal and the span stays the same. Use this to clear fractions as you go; only at the very end, when normalizing, does the exact length matter.`,
        },
        {
          kind: "why",
          title: "Why scaling v changes nothing downstream",
          body: md`Replace $\mathbf{v}$ by $c\mathbf{v}$ in the projection formula:

$$\frac{\mathbf{x} \cdot (c\mathbf{v})}{(c\mathbf{v}) \cdot (c\mathbf{v})}\,(c\mathbf{v}) = \frac{c\,(\mathbf{x} \cdot \mathbf{v})}{c^2\,(\mathbf{v} \cdot \mathbf{v})}\,c\,\mathbf{v} = \frac{\mathbf{x} \cdot \mathbf{v}}{\mathbf{v} \cdot \mathbf{v}}\,\mathbf{v}.$$

The $c$'s cancel completely. The shadow of $\mathbf{x}$ depends on the line, not on which vector along it you used to describe it. So every later $\mathbf{v}$ comes out the same.`,
        },
        {
          kind: "text",
          body: md`**Where it leads.** Put the orthonormal vectors $\mathbf{q}_1, \ldots, \mathbf{q}_k$ into the columns of a matrix $Q$. Then $Q^TQ = I$, because the $(i, j)$ entry is $\mathbf{q}_i \cdot \mathbf{q}_j$. The Gram–Schmidt equations, read backwards, express each $\mathbf{x}_j$ as a combination of $\mathbf{q}_1, \ldots, \mathbf{q}_j$ only. In matrix form that's $A = QR$ with $R$ upper triangular: the **QR factorization**, which is how computers solve the least-squares problems of the next lesson without forming $A^TA$.`,
        },
        {
          kind: "check",
          prompt: md`Apply Gram–Schmidt to $\mathbf{x}_1 = \langle 1, 2 \rangle$, $\mathbf{x}_2 = \langle 3, 1 \rangle$. Give $\mathbf{v}_2$ as a tuple.`,
          answer: "(2, -1)",
          form: "tuple",
          explain: md`$\frac{\mathbf{x}_2 \cdot \mathbf{v}_1}{\mathbf{v}_1 \cdot \mathbf{v}_1} = \frac{5}{5} = 1$, so $\mathbf{v}_2 = \langle 3, 1 \rangle - \langle 1, 2 \rangle = \langle 2, -1 \rangle$. Check: $2 - 2 = 0$.`,
        },
        {
          kind: "check",
          prompt: md`Normalize $\mathbf{v} = \langle -1, 3 \rangle$. Give the unit vector as a tuple with rationalized denominators, like **(sqrt(2)/2, sqrt(2)/2)**.`,
          answer: "(-sqrt(10)/10, 3sqrt(10)/10)",
          form: "tuple",
          simplified: true,
          explain: md`$\|\mathbf{v}\| = \sqrt{10}$, so the unit vector is $\left\langle -\frac{1}{\sqrt{10}}, \frac{3}{\sqrt{10}} \right\rangle = \left\langle -\frac{\sqrt{10}}{10}, \frac{3\sqrt{10}}{10} \right\rangle$.`,
        },
      ],
      practice: [gramSchmidtSecond, gramSchmidtThird, orthonormalSecond],
    },
    {
      id: slug("Least squares"),
      title: "Least squares",
      summary: "When Ax = b has no solution, the best substitute: the normal equations derived from projection, and fitting a line to data.",
      blocks: [
        {
          kind: "text",
          body: md`Measure the same thing many times and you get more equations than unknowns, and they almost never agree exactly. Three data points are almost never on one line, so the system "a line $y = mx + b$ passes through all three" has no solution. Giving up is not an option; we want the line that comes **closest**. This lesson makes "closest" precise and shows that the answer is a projection.`,
        },
        {
          kind: "key",
          title: "Least-squares solution",
          body: md`For an $m \times n$ system $A\mathbf{x} = \mathbf{b}$, a **least-squares solution** is a vector $\hat{\mathbf{x}}$ that makes the error $\|\mathbf{b} - A\mathbf{x}\|$ as small as possible:

$$\|\mathbf{b} - A\hat{\mathbf{x}}\| \le \|\mathbf{b} - A\mathbf{x}\| \quad\text{for every } \mathbf{x}.$$

The vector $\mathbf{b} - A\hat{\mathbf{x}}$ is the **residual**. Minimizing its length means minimizing the sum of the squares of its components, hence the name.`,
        },
        {
          kind: "why",
          title: "Why the closest Ax is a projection",
          body: md`As $\mathbf{x}$ runs over all of $\mathbb{R}^n$, $A\mathbf{x}$ runs over every combination of the columns of $A$: the column space $\operatorname{Col} A$ (Units 3 and 5). So the question "which $A\mathbf{x}$ is closest to $\mathbf{b}$?" is "which point of the subspace $\operatorname{Col} A$ is closest to $\mathbf{b}$?", and the best approximation theorem answers it: the projection. Therefore

$$A\hat{\mathbf{x}} = \operatorname{proj}_{\operatorname{Col} A}\,\mathbf{b},$$

and $\hat{\mathbf{x}}$ is any $\mathbf{x}$ that produces that projection. We could compute the projection with Gram–Schmidt on the columns, but there's a shortcut that skips the orthogonal basis entirely.`,
        },
        {
          kind: "key",
          title: "The normal equations",
          body: md`The least-squares solutions of $A\mathbf{x} = \mathbf{b}$ are exactly the solutions of

$$A^TA\,\hat{\mathbf{x}} = A^T\mathbf{b}.$$

This system always has a solution. When the columns of $A$ are linearly independent, $A^TA$ is invertible and the least-squares solution is unique: $\hat{\mathbf{x}} = (A^TA)^{-1}A^T\mathbf{b}$.`,
        },
        {
          kind: "proof",
          title: "The normal equations",
          given: md`$\hat{\mathbf{x}}$ with $A\hat{\mathbf{x}} = \operatorname{proj}_{\operatorname{Col} A}\,\mathbf{b}$; columns of $A$ are $\mathbf{a}_1, \ldots, \mathbf{a}_n$`,
          prove: md`$A^TA\,\hat{\mathbf{x}} = A^T\mathbf{b}$`,
          steps: [
            { statement: md`$\mathbf{b} - A\hat{\mathbf{x}}$ is orthogonal to $\operatorname{Col} A$`, reason: "The leftover of a projection is orthogonal to the subspace (Lesson 2)" },
            { statement: md`$\mathbf{a}_j \cdot (\mathbf{b} - A\hat{\mathbf{x}}) = 0$ for each column $\mathbf{a}_j$`, reason: md`Each column lies in $\operatorname{Col} A$` },
            { statement: md`$A^T(\mathbf{b} - A\hat{\mathbf{x}}) = \mathbf{0}$`, reason: md`The rows of $A^T$ are the columns of $A$, so row $j$ of this product is $\mathbf{a}_j \cdot (\mathbf{b} - A\hat{\mathbf{x}})$` },
            { statement: md`$A^T\mathbf{b} - A^TA\,\hat{\mathbf{x}} = \mathbf{0}$`, reason: "Distribute" },
            { statement: md`$A^TA\,\hat{\mathbf{x}} = A^T\mathbf{b}$`, reason: "Rearrange" },
            { statement: md`Conversely, any solution of the normal equations has residual orthogonal to every column, hence to $\operatorname{Col} A$, so $A\hat{\mathbf{x}}$ is the projection`, reason: "Read the steps upwards; the orthogonal decomposition is unique" },
          ],
        },
        {
          kind: "why",
          title: "Why A^T A is invertible when the columns are independent",
          body: md`$A^TA$ is a square $n \times n$ matrix, so it's invertible exactly when $A^TA\,\mathbf{x} = \mathbf{0}$ forces $\mathbf{x} = \mathbf{0}$ (the invertible matrix theorem, Unit 3). Suppose $A^TA\,\mathbf{x} = \mathbf{0}$. Multiply on the left by $\mathbf{x}^T$:

$$0 = \mathbf{x}^TA^TA\,\mathbf{x} = (A\mathbf{x})^T(A\mathbf{x}) = \|A\mathbf{x}\|^2,$$

so $A\mathbf{x} = \mathbf{0}$. Independent columns mean the only combination giving $\mathbf{0}$ is the trivial one, so $\mathbf{x} = \mathbf{0}$. The same calculation shows $\mathbf{x}^TA^TA\,\mathbf{x} \ge 0$ for every $\mathbf{x}$; $A^TA$ is a *positive semidefinite* matrix, a type you'll meet again with eigenvalues.`,
        },
        {
          kind: "example",
          title: "A least-squares solution",
          problem: md`Find the least-squares solution of $A\mathbf{x} = \mathbf{b}$, where $A = \begin{bmatrix} 1 & 0 \\ 0 & 1 \\ 1 & 1 \end{bmatrix}$ and $\mathbf{b} = \begin{bmatrix} 1 \\ 2 \\ 4 \end{bmatrix}$.`,
          steps: [
            { math: md`A^TA = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}, \qquad A^T\mathbf{b} = \begin{bmatrix} 5 \\ 6 \end{bmatrix}`, note: md`Entry $(i, j)$ of $A^TA$ is column $i$ dotted with column $j$. The system itself is inconsistent: the third equation wants $x_1 + x_2 = 4$ while the first two give $1 + 2 = 3$.` },
            { math: md`2\hat{x}_1 + \hat{x}_2 = 5, \qquad \hat{x}_1 + 2\hat{x}_2 = 6`, note: "The normal equations." },
            { math: md`\hat{\mathbf{x}} = \begin{bmatrix} 4/3 \\ 7/3 \end{bmatrix}`, note: "Solve by elimination." },
            { math: md`\mathbf{b} - A\hat{\mathbf{x}} = \begin{bmatrix} 1 - \tfrac{4}{3} \\ 2 - \tfrac{7}{3} \\ 4 - \tfrac{11}{3} \end{bmatrix} = \begin{bmatrix} -\tfrac{1}{3} \\ -\tfrac{1}{3} \\ \tfrac{1}{3} \end{bmatrix}`, note: md`The residual. Check: it's orthogonal to both columns, $-\frac{1}{3} + \frac{1}{3} = 0$ each time. The error $\|\mathbf{b} - A\hat{\mathbf{x}}\| = \frac{\sqrt{3}}{3}$ is the smallest any $\mathbf{x}$ can achieve.` },
          ],
        },
        {
          kind: "key",
          title: "Fitting a line to data",
          body: md`Data points $(x_1, y_1), \ldots, (x_n, y_n)$ and a model $y = mx + b$. Asking the line to pass through every point gives $n$ equations in the two unknowns $m, b$:

$$\begin{bmatrix} x_1 & 1 \\ x_2 & 1 \\ \vdots & \vdots \\ x_n & 1 \end{bmatrix}\begin{bmatrix} m \\ b \end{bmatrix} = \begin{bmatrix} y_1 \\ y_2 \\ \vdots \\ y_n \end{bmatrix}.$$

Its least-squares solution is the **least-squares line** (regression line). The normal equations work out to

$$\left(\textstyle\sum x_i^2\right) m + \left(\textstyle\sum x_i\right) b = \textstyle\sum x_i y_i, \qquad \left(\textstyle\sum x_i\right) m + n\,b = \textstyle\sum y_i.$$`,
        },
        {
          kind: "why",
          title: "Why this is the line of 'least squares'",
          body: md`The $i$th component of the residual $\mathbf{y} - A\begin{bmatrix} m \\ b \end{bmatrix}$ is $y_i - (mx_i + b)$: the vertical gap between the data point and the line. So

$$\|\text{residual}\|^2 = \sum_{i=1}^n \bigl(y_i - (mx_i + b)\bigr)^2,$$

and the least-squares solution is the line that makes the **sum of the squared vertical gaps** as small as possible. Why squares rather than, say, absolute values? Because squared length is what the dot product measures, which turns the problem into a projection with a formula. (Squares also punish one big miss more than several small ones.) The second normal equation says $\sum (y_i - mx_i - b) = 0$: the gaps above and below the line cancel exactly.`,
        },
        {
          kind: "diagram",
          view: [-0.5, 5.2, -0.8, 7.8],
          grid: true,
          points: [
            { name: "D1", x: 1, y: 2, label: "", dir: "n" },
            { name: "D2", x: 2, y: 3, label: "", dir: "n" },
            { name: "D3", x: 3, y: 5, label: "", dir: "n" },
            { name: "D4", x: 4, y: 6, label: "", dir: "n" },
            { name: "R1", x: 1, y: "m + b", label: "", hidden: true },
            { name: "R2", x: 2, y: "2m + b", label: "", hidden: true },
            { name: "R3", x: 3, y: "3m + b", label: "", hidden: true },
            { name: "R4", x: 4, y: "4m + b", label: "", hidden: true },
            { name: "L0", x: 0, y: "b", label: "", hidden: true },
            { name: "L1", x: 5, y: "5m + b", label: "", hidden: true },
          ],
          segments: [
            { from: "L0", to: "L1", kind: "line", color: 1 },
            { from: "D1", to: "R1", dashed: true, color: 4 },
            { from: "D2", to: "R2", dashed: true, color: 4 },
            { from: "D3", to: "R3", dashed: true, color: 4 },
            { from: "D4", to: "R4", dashed: true, color: 4 },
          ],
          params: [
            { name: "m", tex: "m", min: 0, max: 3, step: 0.1, value: 1 },
            { name: "b", tex: "b", min: -2, max: 3, step: 0.1, value: 1 },
          ],
          readouts: [{ label: "\\textstyle\\sum (y_i - mx_i - b)^2", value: "(2 - (m + b))^2 + (3 - (2m + b))^2 + (5 - (3m + b))^2 + (6 - (4m + b))^2" }],
          caption: md`Data $(1, 2), (2, 3), (3, 5), (4, 6)$ and a trial line $y = mx + b$. The dashed gaps are the residual's components. Slide $m$ and $b$ to make the sum of their squares as small as you can; the least you'll find is $0.2$, at $m = 1.4$, $b = 0.5$.`,
        },
        {
          kind: "example",
          title: "The least-squares line",
          problem: md`Find the least-squares line for the data $(1, 2), (2, 3), (3, 5), (4, 6)$.`,
          steps: [
            { math: md`\sum x_i = 10, \quad \sum x_i^2 = 30, \quad \sum y_i = 16, \quad \sum x_i y_i = 2 + 6 + 15 + 24 = 47`, note: md`These are the entries of $A^TA$ and $A^T\mathbf{y}$, with $n = 4$.` },
            { math: md`30m + 10b = 47, \qquad 10m + 4b = 16`, note: "The normal equations." },
            { math: md`2b = 1 \;\Rightarrow\; b = \tfrac{1}{2}, \qquad m = \frac{47 - 5}{30} = \tfrac{7}{5}`, note: "Multiply the second equation by 3 and subtract the first." },
            { math: md`y = 1.4x + 0.5`, note: md`Residuals: $0.1, -0.3, 0.3, -0.1$. They sum to zero, and their squares sum to $0.2$, the minimum from the picture above.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 5],
          y: [0, 7],
          curves: [{ expr: "1.4x + 0.5", label: "y = 1.4x + 0.5" }],
          points: [
            { x: 1, y: 2, color: 2 },
            { x: 2, y: 3, color: 2 },
            { x: 3, y: 5, color: 2 },
            { x: 4, y: 6, color: 2 },
          ],
          caption: md`The data and its least-squares line. No line passes through all four points; this one misses them by the least total squared amount.`,
        },
        {
          kind: "text",
          body: md`**Other models.** The method never needed the model to be a line, only to be linear in the *unknowns*. To fit a parabola $y = c_0 + c_1 x + c_2 x^2$, use the rows $\begin{bmatrix} 1 & x_i & x_i^2 \end{bmatrix}$ and three unknowns; the normal equations are $3 \times 3$. A model like $y = a e^{kx}$ is not linear in $k$, but $\ln y = \ln a + kx$ is, so fit a line to $(x_i, \ln y_i)$ instead.`,
        },
        {
          kind: "check",
          prompt: md`Find the least-squares line $y = mx + b$ for the points $(0, 1), (1, 2), (2, 6)$. Give $(m, b)$ as a tuple, fractions allowed.`,
          answer: "(5/2, 1/2)",
          form: "tuple",
          explain: md`$\sum x = 3$, $\sum x^2 = 5$, $\sum y = 9$, $\sum xy = 14$, $n = 3$. Normal equations: $5m + 3b = 14$ and $3m + 3b = 9$. Subtracting, $2m = 5$, so $m = \frac{5}{2}$ and $b = \frac{9 - 15/2}{3} = \frac{1}{2}$.`,
        },
      ],
      practice: [leastSquaresSolve, fitLine, leastSquaresResidual],
    },
  ],
};
