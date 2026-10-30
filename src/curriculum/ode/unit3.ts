import { frac, fracTex, gcd, poly, signed } from "../../math/random";
import { md, slug, type Generator, type Unit } from "../types";

// ── Formatting helpers ──────────────────────────────────────────────────────

/** e^{rt} in LaTeX. */
const eTex = (r: number, v = "t"): string => (r === 0 ? "1" : `e^{${r === 1 ? "" : r === -1 ? "-" : r}${v}}`);
/** e^(rt) in typed-answer syntax. */
const eText = (r: number, v = "t"): string => (r === 0 ? "1" : r === 1 ? `e^${v}` : `e^(${r === -1 ? "-" : r}${v})`);
/** poly() where the factor "1" means a constant term. */
const sum = (terms: [number, string][]): string => poly(terms.map(([c, f]) => [c, f === "1" ? "" : f]));
/** y'' + b y' + c y in LaTeX. */
const lhsTex = (b: number, c: number): string => poly([[1, "y''"], [b, "y'"], [c, "y"]]);
/** r^2 + b r + c, readable both as LaTeX and as typed syntax. */
const charTex = (b: number, c: number, a = 1): string => poly([[a, "r^2"], [b, "r"], [c, ""]]);
/** The argument of a trig function: t or 3t. */
const trigArg = (b: number): string => (b === 1 ? "t" : `${b}t`);
/** a + bi as text (also valid LaTeX). */
const cplx = (a: number, b: number): string => {
  const im = Math.abs(b) === 1 ? "i" : `${Math.abs(b)}i`;
  if (a === 0) return b < 0 ? `-${im}` : im;
  return `${a} ${b < 0 ? "-" : "+"} ${im}`;
};
/** A coefficient in front of a factor: 1 and -1 hidden. */
const coef = (c: number): string => (c === 1 ? "" : c === -1 ? "-" : String(c));
/** c times a factor, where the factor "1" means just the number: mono(2, "e^{3t}") = "2e^{3t}", mono(2, "1") = "2". */
const mono = (c: number, f: string): string => (f === "1" ? String(c) : `${coef(c)}${f}`);
/** e^{rt} as a prefix of something else: empty when r = 0. */
const ePre = (r: number): string => (r === 0 ? "" : eTex(r));
/** sqrt(n) simplified, as [text, tex]. */
const sqrtForms = (n: number): [string, string] => {
  let k = 1;
  for (let d = 2; d * d <= n; d++) if (n % (d * d) === 0) k = d;
  const rest = n / (k * k);
  if (rest === 1) return [String(k), String(k)];
  if (k === 1) return [`sqrt(${n})`, `\\sqrt{${n}}`];
  return [`${k}sqrt(${rest})`, `${k}\\sqrt{${rest}}`];
};
/** n pi / d reduced, as [text, tex]. */
const piFrac = (n: number, d: number): [string, string] => {
  const g = gcd(n, d);
  n /= g;
  d /= g;
  const top = n === 1 ? "pi" : `${n}pi`;
  const topTex = n === 1 ? "\\pi" : `${n}\\pi`;
  return d === 1 ? [top, topTex] : [`${top}/${d}`, `\\frac{${topTex}}{${d}}`];
};
const distinctPair = (r: { int(lo: number, hi: number): number }, lo: number, hi: number, nonzero = false): [number, number] => {
  for (;;) {
    const a = r.int(lo, hi);
    const b = r.int(lo, hi);
    if (a !== b && (!nonzero || (a !== 0 && b !== 0))) return a > b ? [a, b] : [b, a];
  }
};

// ── Lesson 1: Homogeneous equations with constant coefficients ──────────────

const solveCharacteristic: Generator = (r) => {
  if (r.next() < 0.7) {
    const [r1, r2] = distinctPair(r, -5, 5);
    const b = -(r1 + r2);
    const c = r1 * r2;
    return {
      prompt: md`Solve the characteristic equation $${charTex(b, c)} = 0$. Separate the two roots with a comma.`,
      answer: `${r1}, ${r2}`,
      form: "set",
      hint: md`Look for two numbers that multiply to ${c} and add to ${-b}, then factor.`,
      solution: [
        { math: md`(r ${signed(-r1)})(r ${signed(-r2)}) = 0`, note: md`The numbers $${-r1}$ and $${-r2}$ multiply to $${c}$ and add to $${b}$.` },
        { math: md`r = ${r1} \quad\text{or}\quad r = ${r2}`, note: md`So the equation $${lhsTex(b, c)} = 0$ has solutions $${eTex(r1)}$ and $${eTex(r2)}$.` },
      ],
    };
  }
  // A leading coefficient: (a r - p)(r - q) = 0.
  const a = r.pick([2, 3]);
  const q = r.nonzero(-4, 4);
  let p = r.nonzero(-5, 5);
  while (p % a === 0 || p === a * q) p = r.nonzero(-5, 5);
  const b = -(p + a * q);
  const c = p * q;
  return {
    prompt: md`Solve the characteristic equation $${charTex(b, c, a)} = 0$. Separate the two roots with a comma; fractions like 3/2 are fine.`,
    answer: `${frac(p, a)}, ${q}`,
    form: "set",
    hint: md`Factor, or use the quadratic formula with $a = ${a}$, $b = ${b}$, $c = ${c}$.`,
    solution: [
      { math: md`(${poly([[a, "r"], [-p, ""]])})(r ${signed(-q)}) = 0`, note: md`Check by expanding: $${a}r^2 ${signed(-a * q)}r ${signed(-p)}r ${signed(c)}$ combines to $${charTex(b, c, a)}$.` },
      { math: md`r = ${fracTex(p, a)} \quad\text{or}\quad r = ${q}`, note: "Set each factor to zero." },
    ],
  };
};

const realRootsIvp: Generator = (r) => {
  const [r1, r2] = distinctPair(r, -3, 3, true);
  const b = -(r1 + r2);
  const c = r1 * r2;
  const c1 = r.nonzero(-3, 3);
  const c2 = r.nonzero(-3, 3);
  const y0 = c1 + c2;
  const v0 = r1 * c1 + r2 * c2;
  const answer = sum([[c1, eText(r1)], [c2, eText(r2)]]);
  return {
    prompt: md`Find the solution of the initial value problem $${lhsTex(b, c)} = 0$, $y(0) = ${y0}$, $y'(0) = ${v0}$. Give $y$ as an expression in $t$, like 2e^(3t) - e^(-t).`,
    answer,
    hint: md`The characteristic equation is $${charTex(b, c)} = 0$. Write the general solution with $c_1$, $c_2$, then use $y(0)$ and $y'(0)$ to get two equations for them.`,
    solution: [
      { math: md`${charTex(b, c)} = (r ${signed(-r1)})(r ${signed(-r2)}) = 0`, note: md`Roots $r = ${r1}$ and $r = ${r2}$.` },
      { math: md`y = c_1 ${eTex(r1)} + c_2 ${eTex(r2)}`, note: "General solution." },
      { math: md`y(0) = c_1 + c_2 = ${y0}`, note: md`At $t = 0$ every exponential is 1.` },
      { math: md`y'(0) = ${coef(r1)}c_1 ${r2 < 0 ? "-" : "+"} ${coef(Math.abs(r2))}c_2 = ${v0}`, note: md`Differentiate first: $y' = ${coef(r1)}c_1 ${eTex(r1)} ${r2 < 0 ? "-" : "+"} ${coef(Math.abs(r2))}c_2 ${eTex(r2)}$, then set $t = 0$.` },
      { math: md`c_1 = ${c1}, \quad c_2 = ${c2}`, note: md`From the first equation $c_2 = ${y0} - c_1$; substitute into the second: $${coef(r1)}c_1 ${r2 < 0 ? "-" : "+"} ${coef(Math.abs(r2))}(${y0} - c_1) = ${v0}$ gives $${r1 - r2}c_1 = ${v0 - r2 * y0}$.` },
      { math: md`y = ${sum([[c1, eTex(r1)], [c2, eTex(r2)]])}`, note: "" },
    ],
  };
};

const equationFromSolutions: Generator = (r) => {
  const [r1, r2] = distinctPair(r, -5, 5, true);
  const b = -(r1 + r2);
  const c = r1 * r2;
  return {
    prompt: md`The functions $y_1 = ${eTex(r1)}$ and $y_2 = ${eTex(r2)}$ both solve $y'' + by' + cy = 0$. Find $b$ and $c$. Give them as (b, c).`,
    answer: `(${b}, ${c})`,
    form: "tuple",
    verify: [`${r1 * r1} + (${r1})*b + c = 0`, `${r2 * r2} + (${r2})*b + c = 0`],
    hint: md`$e^{rt}$ solves the equation exactly when $r$ is a root of $r^2 + br + c = 0$. So you know both roots of the characteristic equation.`,
    solution: [
      { math: md`r = ${r1} \text{ and } r = ${r2} \text{ are the roots of } r^2 + br + c`, note: md`$e^{rt}$ is a solution exactly when $r^2 + br + c = 0$.` },
      { math: md`r^2 + br + c = (r ${signed(-r1)})(r ${signed(-r2)}) = ${charTex(b, c)}`, note: "A monic quadratic is the product of its root factors." },
      { math: md`b = ${b}, \quad c = ${c}`, note: md`$b$ is minus the sum of the roots, $c$ is their product.` },
    ],
  };
};

// ── Lesson 2: Complex and repeated roots ────────────────────────────────────

const solveComplexCharacteristic: Generator = (r) => {
  if (r.next() < 0.65) {
    const a = r.int(-3, 2);
    const k = r.int(1, 4);
    const b = -2 * a;
    const c = a * a + k * k;
    return {
      prompt: md`Solve the characteristic equation $${charTex(b, c)} = 0$. Give both roots, separated by a comma; you may write ± as +/-, like -1 +/- 2i.`,
      answer: `${cplx(a, k)}, ${cplx(a, -k)}`,
      form: "set",
      complex: true,
      hint: md`Complete the square: $(r ${signed(-a)})^2 = ${-(k * k)}$. The discriminant is negative, so the roots are complex.`,
      solution: [
        { math: md`r = \frac{${-b} \pm \sqrt{${b * b} - ${4 * c}}}{2} = \frac{${-b} \pm \sqrt{${b * b - 4 * c}}}{2}`, note: "Quadratic formula." },
        { math: md`r = \frac{${-b} \pm ${2 * k}i}{2} = ${cplx(a, k)} \text{ or } ${cplx(a, -k)}`, note: md`$\sqrt{${b * b - 4 * c}} = ${2 * k}i$. The real part is $${a}$ and the imaginary part is $\pm ${k}$.` },
        { math: md`y = ${ePre(a)}(c_1 \cos ${trigArg(k)} + c_2 \sin ${trigArg(k)})`, note: "The general solution these roots give." },
      ],
    };
  }
  const rho = r.nonzero(-5, 5);
  const b = -2 * rho;
  const c = rho * rho;
  return {
    prompt: md`Solve the characteristic equation $${charTex(b, c)} = 0$. If the root is repeated, give it once.`,
    answer: String(rho),
    form: "set",
    hint: md`Check the discriminant $b^2 - 4c$. If it is zero, the quadratic is a perfect square.`,
    solution: [
      { math: md`${b * b} - 4 \cdot ${c} = 0`, note: "Discriminant zero: one repeated root." },
      { math: md`(r ${signed(-rho)})^2 = 0 \;\Rightarrow\; r = ${rho}`, note: md`So the solutions are $${eTex(rho)}$ and $t${eTex(rho)}$.` },
    ],
  };
};

const complexOrRepeatedIvp: Generator = (r) => {
  if (r.next() < 0.6) {
    const a = r.pick([-2, -1, 0, 1]);
    const k = r.int(1, 3);
    const b = -2 * a;
    const c = a * a + k * k;
    const c1 = r.nonzero(-3, 3);
    const c2 = r.nonzero(-3, 3);
    const y0 = c1;
    const v0 = a * c1 + k * c2;
    const innerText = sum([[c1, `cos(${trigArg(k)})`], [c2, `sin(${trigArg(k)})`]]);
    const innerTex = sum([[c1, `\\cos ${trigArg(k)}`], [c2, `\\sin ${trigArg(k)}`]]);
    const answer = a === 0 ? innerText : `${eText(a)}(${innerText})`;
    const answerTex = a === 0 ? innerTex : `${eTex(a)}(${innerTex})`;
    return {
      prompt: md`Find the solution of the initial value problem $${lhsTex(b, c)} = 0$, $y(0) = ${y0}$, $y'(0) = ${v0}$. Give $y$ as an expression in $t$, like e^(-t)(2cos(3t) - sin(3t)).`,
      answer,
      hint: md`The roots are $${cplx(a, k)}$ and $${cplx(a, -k)}$, so $y = ${ePre(a)}(c_1 \cos ${trigArg(k)} + c_2 \sin ${trigArg(k)})$. Remember the product rule when you compute $y'(0)$.`,
      solution: [
        { math: md`${charTex(b, c)} = 0 \;\Rightarrow\; r = ${cplx(a, k)}, \; ${cplx(a, -k)}`, note: a === 0 ? md`$r^2 = ${-(k * k)}$.` : md`Complete the square: $(r ${signed(-a)})^2 = ${-(k * k)}$.` },
        { math: md`y = ${ePre(a)}(c_1 \cos ${trigArg(k)} + c_2 \sin ${trigArg(k)})`, note: md`Real part $${a}$ goes in the exponential, imaginary part $${k}$ in the trig functions.` },
        { math: md`y(0) = c_1 = ${y0}`, note: md`$\cos 0 = 1$, $\sin 0 = 0$, $e^0 = 1$.` },
        { math: md`y'(0) = ${a === 0 ? "" : `${coef(a)}c_1 + `}${coef(k)}c_2 = ${v0}`, note: a === 0 ? md`$y' = ${k}(-c_1 \sin ${trigArg(k)} + c_2 \cos ${trigArg(k)})$; at $t = 0$ only the cosine term survives.` : md`Product rule: $y' = ${coef(a)}y + ${eTex(a)} \cdot ${k}(-c_1 \sin ${trigArg(k)} + c_2 \cos ${trigArg(k)})$. At $t = 0$ this is $${coef(a)}c_1 + ${coef(k)}c_2$.` },
        { math: md`c_2 = ${c2}`, note: md`$${k}c_2 = ${v0} ${signed(-a * c1)}$.` },
        { math: md`y = ${answerTex}`, note: "" },
      ],
    };
  }
  const rho = r.nonzero(-3, 3);
  const b = -2 * rho;
  const c = rho * rho;
  const c1 = r.nonzero(-3, 3);
  const c2 = r.nonzero(-4, 4);
  const y0 = c1;
  const v0 = rho * c1 + c2;
  const inner = sum([[c1, "1"], [c2, "t"]]);
  return {
    prompt: md`Find the solution of the initial value problem $${lhsTex(b, c)} = 0$, $y(0) = ${y0}$, $y'(0) = ${v0}$. Give $y$ as an expression in $t$, like (2 - 3t)e^(5t).`,
    answer: `(${inner})${eText(rho)}`,
    hint: md`The characteristic equation is a perfect square, so the root $r = ${rho}$ is repeated and $y = (c_1 + c_2 t)${eTex(rho)}$.`,
    solution: [
      { math: md`${charTex(b, c)} = (r ${signed(-rho)})^2 = 0`, note: md`One root, $r = ${rho}$, repeated.` },
      { math: md`y = (c_1 + c_2 t)${eTex(rho)}`, note: "The second solution carries a factor of t." },
      { math: md`y(0) = c_1 = ${y0}`, note: "" },
      { math: md`y' = c_2 ${eTex(rho)} + ${coef(rho)}(c_1 + c_2 t)${eTex(rho)}, \quad y'(0) = c_2 ${rho < 0 ? "-" : "+"} ${coef(Math.abs(rho))}c_1 = ${v0}`, note: "Product rule, then t = 0." },
      { math: md`c_2 = ${v0} ${signed(-rho * c1)} = ${c2}`, note: "" },
      { math: md`y = (${inner})${eTex(rho)}`, note: "" },
    ],
  };
};

const equationFromComplexRoots: Generator = (r) => {
  const a = r.int(-3, 3);
  const k = r.int(1, 4);
  const p = -2 * a;
  const q = a * a + k * k;
  return {
    prompt: md`The general solution of $y'' + py' + qy = 0$ is $y = ${ePre(a)}(c_1 \cos ${trigArg(k)} + c_2 \sin ${trigArg(k)})$. Find $p$ and $q$. Give them as (p, q).`,
    answer: `(${p}, ${q})`,
    form: "tuple",
    complex: true,
    verify: [`(${a} + ${k}i)^2 + p*(${a} + ${k}i) + q = 0`],
    hint: md`Read the roots off the solution: real part $${a}$, imaginary part $\pm ${k}$. Then rebuild the quadratic from its roots.`,
    solution: [
      { math: md`r = ${cplx(a, k)}, \quad \bar r = ${cplx(a, -k)}`, note: md`The exponential gives the real part, the trig argument gives the imaginary part.` },
      { math: md`(r - (${cplx(a, k)}))(r - (${cplx(a, -k)})) = (r ${signed(-a)})^2 + ${k * k}`, note: md`$(u - ki)(u + ki) = u^2 + k^2$ with $u = r ${signed(-a)}$.` },
      { math: md`r^2 ${signed(p)}r ${signed(q)} \;\Rightarrow\; p = ${p}, \; q = ${q}`, note: md`Expand: $(r ${signed(-a)})^2 + ${k * k} = r^2 ${signed(p)}r + ${a * a} + ${k * k}$.` },
    ],
  };
};

// ── Lesson 3: Undetermined coefficients ─────────────────────────────────────

const exponentialForcing: Generator = (r) => {
  const [r1, r2] = distinctPair(r, -3, 3, true);
  const b = -(r1 + r2);
  const c = r1 * r2;
  const resonant = r.next() < 0.3;
  if (!resonant) {
    let a = r.int(-3, 3);
    while (a === 0 || a === r1 || a === r2) a = r.int(-3, 3);
    const D = a * a + a * b + c;
    const k = r.nonzero(-6, 6);
    return {
      prompt: md`Find a particular solution of $${lhsTex(b, c)} = ${coef(k)}${eTex(a)}$ by trying $y_p = A${eTex(a)}$. Give the value of $A$; fractions like 3/4 are fine.`,
      answer: frac(k, D),
      verify: [`A*(${a})^2 + (${b})*(${a})*A + (${c})*A = ${k}`],
      hint: md`$y_p' = ${coef(a)}A${eTex(a)}$ and $y_p'' = ${a * a}A${eTex(a)}$. Substitute, then divide by $${eTex(a)}$ and match.`,
      solution: [
        { math: md`y_p = A${eTex(a)}, \quad y_p' = ${coef(a)}A${eTex(a)}, \quad y_p'' = ${a * a}A${eTex(a)}`, note: "Derivatives of the guess." },
        { math: md`${a * a}A${eTex(a)} ${signed(b)}(${coef(a)}A${eTex(a)}) ${signed(c)}A${eTex(a)} = ${coef(k)}${eTex(a)}`, note: "Substitute into the equation." },
        { math: md`(${a * a} ${signed(a * b)} ${signed(c)})A = ${k} \;\Rightarrow\; ${D}A = ${k}`, note: md`Every term has the factor $${eTex(a)}$, which is never zero, so divide it out.` },
        { math: md`A = ${fracTex(k, D)}`, note: md`So $y_p = ${fracTex(k, D)}${eTex(a)}$.` },
      ],
    };
  }
  const a = r1;
  const m = r.nonzero(-3, 3);
  const k = m * (r1 - r2);
  return {
    prompt: md`The forcing in $${lhsTex(b, c)} = ${coef(k)}${eTex(a)}$ already solves the homogeneous equation, so try $y_p = At${eTex(a)}$. Give the value of $A$; fractions like 3/4 are fine.`,
    answer: String(m),
    verify: [`A*(2*(${a}) + (${b})) = ${k}`, `A*(2*(${a}) + (${b})) + A*((${a})^2 + (${a})*(${b}) + (${c})) = ${k}`],
    hint: md`Product rule: $y_p' = A${eTex(a)}(1 ${signed(a)}t)$ and $y_p'' = A${eTex(a)}(${2 * a} ${signed(a * a)}t)$. The $t$ terms cancel because $${a}$ is a root.`,
    solution: [
      { math: md`y_p' = A${eTex(a)}(1 ${signed(a)}t), \quad y_p'' = A${eTex(a)}(${2 * a} ${signed(a * a)}t)`, note: "Product rule twice." },
      { math: md`A${eTex(a)}\left[(${2 * a} ${signed(a * a)}t) ${signed(b)}(1 ${signed(a)}t) ${signed(c)}t\right] = ${coef(k)}${eTex(a)}`, note: "Substitute." },
      { math: md`A${eTex(a)}\left[${2 * a + b} + (${a * a} ${signed(a * b)} ${signed(c)})t\right] = ${coef(k)}${eTex(a)}`, note: md`The coefficient of $t$ is $${a * a + a * b + c} = 0$: that's the characteristic polynomial at the root $${a}$.` },
      { math: md`${2 * a + b}A = ${k} \;\Rightarrow\; A = ${m}`, note: md`So $y_p = ${coef(m)}t${eTex(a)}$.` },
    ],
  };
};

const polynomialForcing: Generator = (r) => {
  const [r1, r2] = distinctPair(r, -3, 3, true);
  const b = -(r1 + r2);
  const c = r1 * r2;
  if (r.next() < 0.6) {
    const A = r.nonzero(-3, 3);
    const B = r.int(-3, 3);
    const p1 = c * A;
    const p0 = c * B + b * A;
    return {
      prompt: md`Find a particular solution of $${lhsTex(b, c)} = ${sum([[p1, "t"], [p0, "1"]])}$ of the form $y_p = At + B$. Give (A, B).`,
      answer: `(${A}, ${B})`,
      form: "tuple",
      verify: [`(${b})*A + (${c})*B = ${p0}`, `(${b})*A + (${c})*(A + B) = ${p0 + p1}`],
      hint: md`$y_p' = A$ and $y_p'' = 0$. Substitute, then match the $t$ terms and the constants separately.`,
      solution: [
        { math: md`0 ${signed(b)}A ${signed(c)}(At + B) = ${sum([[p1, "t"], [p0, "1"]])}`, note: md`$y_p' = A$, $y_p'' = 0$.` },
        { math: md`${coef(c)}A\,t + (${coef(b)}A ${signed(c)}B) = ${sum([[p1, "t"], [p0, "1"]])}`, note: "Collect by powers of t." },
        { math: md`${c}A = ${p1} \;\Rightarrow\; A = ${A}`, note: "Match the coefficients of t." },
        { math: md`${coef(b)}(${A}) ${signed(c)}B = ${p0} \;\Rightarrow\; B = ${B}`, note: "Match the constants." },
        { math: md`y_p = ${sum([[A, "t"], [B, "1"]])}`, note: "" },
      ],
    };
  }
  const A = r.nonzero(-2, 2);
  const B = r.int(-3, 3);
  const C = r.int(-3, 3);
  const p2 = c * A;
  const p1 = 2 * b * A + c * B;
  const p0 = 2 * A + b * B + c * C;
  const rhs = sum([[p2, "t^2"], [p1, "t"], [p0, "1"]]);
  const sub = (t: number) => `2*A + (${b})*(2*A*(${t}) + B) + (${c})*(A*(${t})^2 + B*(${t}) + C)`;
  return {
    prompt: md`Find a particular solution of $${lhsTex(b, c)} = ${rhs}$ of the form $y_p = At^2 + Bt + C$. Give (A, B, C).`,
    answer: `(${A}, ${B}, ${C})`,
    form: "tuple",
    verify: [`${sub(0)} = ${p0}`, `${sub(1)} = ${p2 + p1 + p0}`, `${sub(-1)} = ${p2 - p1 + p0}`],
    hint: md`$y_p' = 2At + B$ and $y_p'' = 2A$. Match $t^2$ terms first; that gives $A$. Then the $t$ terms give $B$, and the constants give $C$.`,
    solution: [
      { math: md`2A ${signed(b)}(2At + B) ${signed(c)}(At^2 + Bt + C) = ${rhs}`, note: "Substitute the guess and its derivatives." },
      { math: md`${coef(c)}A\,t^2 + (${2 * b}A ${signed(c)}B)\,t + (2A ${signed(b)}B ${signed(c)}C) = ${rhs}`, note: "Collect by powers of t." },
      { math: md`${c}A = ${p2} \;\Rightarrow\; A = ${A}`, note: md`$t^2$ terms.` },
      { math: md`${2 * b}(${A}) ${signed(c)}B = ${p1} \;\Rightarrow\; B = ${B}`, note: md`$t$ terms.` },
      { math: md`2(${A}) ${signed(b)}(${B}) ${signed(c)}C = ${p0} \;\Rightarrow\; C = ${C}`, note: "Constants." },
      { math: md`y_p = ${sum([[A, "t^2"], [B, "t"], [C, "1"]])}`, note: "" },
    ],
  };
};

const sinusoidalForcing: Generator = (r) => {
  const w = r.int(1, 3);
  const bCoef = r.pick([0, 0, 1, 2, 3]);
  const q = bCoef * w;
  // c - w^2 = p; choose p so that p^2 + q^2 is friendly.
  let p = r.int(-3, 3);
  while (bCoef === 0 && p === 0) p = r.int(-3, 3);
  const c = w * w + p;
  const D = p * p + q * q;
  const g = gcd(D, gcd(Math.abs(p), q));
  const k = (D / g) * r.pick([1, 1, 2, -1]);
  const A = (k * p) / D;
  const B = (k * q) / D;
  const arg = trigArg(w);
  return {
    prompt: md`Find a particular solution of $${lhsTex(bCoef, c)} = ${coef(k)}\cos ${arg}$ of the form $y_p = A\cos ${arg} + B\sin ${arg}$. Give (A, B).`,
    answer: `(${A}, ${B})`,
    form: "tuple",
    verify: [`(${c} - ${w * w})*A + ${q}*B = ${k}`, `-${q}*A + (${c} - ${w * w})*B = 0`],
    hint: md`$y_p' = -${w}A\sin ${arg} + ${w}B\cos ${arg}$ and $y_p'' = -${w * w}(A\cos ${arg} + B\sin ${arg})$. Substitute, then match the cosine terms and the sine terms as two separate equations.`,
    solution: [
      { math: md`y_p' = ${w}(-A\sin ${arg} + B\cos ${arg}), \quad y_p'' = -${w * w}(A\cos ${arg} + B\sin ${arg})`, note: "Derivatives of the guess." },
      { math: md`\cos ${arg}: \quad -${w * w}A ${signed(q)}B ${signed(c)}A = ${k}`, note: md`Collect the $\cos ${arg}$ terms from $y_p''$, $${bCoef}y_p'$ and $${c}y_p$.` },
      { math: md`\sin ${arg}: \quad -${w * w}B ${signed(-q)}A ${signed(c)}B = 0`, note: "The forcing has no sine term, so the sine terms must cancel." },
      { math: md`${p}A ${signed(q)}B = ${k}, \qquad ${-q}A ${signed(p)}B = 0`, note: md`Simplify: $${c} - ${w * w} = ${p}$.` },
      {
        math: md`A = ${A}, \quad B = ${B}`,
        note:
          q === 0
            ? md`With no damping the sine equation is $${p}B = 0$, so $B = 0$ and $A = ${k}/${p}$.`
            : p === 0
              ? md`The sine equation is $${-q}A = 0$, so $A = 0$. Then the cosine equation is $${q}B = ${k}$.`
              : md`The sine equation gives $B = ${fracTex(q, p)}A$. Substitute into the cosine equation: $(${p} + ${fracTex(q * q, p)})A = ${k}$, so $A = ${A}$.`,
      },
      { math: md`y_p = ${sum([[A, `\\cos ${arg}`], [B, `\\sin ${arg}`]])}`, note: "" },
    ],
  };
};

// ── Lesson 4: Variation of parameters ───────────────────────────────────────

const wronskian: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [r1, r2] = distinctPair(r, -4, 4, true);
    const W = r2 - r1;
    return {
      prompt: md`Find the Wronskian $W = y_1 y_2' - y_1' y_2$ of $y_1 = ${eTex(r1)}$ and $y_2 = ${eTex(r2)}$. Give an expression in $t$.`,
      answer: `${coef(W)}${eText(r1 + r2)}`,
      hint: md`$y_2' = ${coef(r2)}${eTex(r2)}$ and $y_1' = ${coef(r1)}${eTex(r1)}$. Exponents add when you multiply.`,
      solution: [
        { math: md`W = ${eTex(r1)} \cdot ${coef(r2)}${eTex(r2)} - ${coef(r1)}${eTex(r1)} \cdot ${eTex(r2)}`, note: "Definition." },
        { math: md`W = (${r2} - (${r1}))${eTex(r1 + r2)} = ${coef(W)}${eTex(r1 + r2)}`, note: md`Both products are multiples of $${eTex(r1 + r2)}$. The Wronskian is never zero, so the two solutions are independent.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(-2, 2);
    const k = r.int(1, 4);
    const arg = trigArg(k);
    const y1 = `${ePre(a)}\\cos(${arg})`;
    const y2 = `${ePre(a)}\\sin(${arg})`;
    if (a === 0) {
      return {
        prompt: md`Find the Wronskian $W = y_1 y_2' - y_1' y_2$ of $y_1 = ${y1}$ and $y_2 = ${y2}$. Give an expression in $t$.`,
        answer: String(k),
        hint: md`$y_1' = -${k}\sin(${arg})$ and $y_2' = ${k}\cos(${arg})$. Then use $\cos^2 + \sin^2 = 1$.`,
        solution: [
          { math: md`W = \cos(${arg}) \cdot ${k}\cos(${arg}) - (-${k}\sin(${arg}))\sin(${arg})`, note: "Definition." },
          { math: md`W = ${k}(\cos^2(${arg}) + \sin^2(${arg})) = ${k}`, note: "A constant, never zero: the pair is independent." },
        ],
      };
    }
    return {
      prompt: md`Find the Wronskian $W = y_1 y_2' - y_1' y_2$ of $y_1 = ${y1}$ and $y_2 = ${y2}$. Give an expression in $t$.`,
      answer: mono(k, eText(2 * a)),
      hint: md`Use the product rule for each derivative. The terms with $\cos \sin$ cancel, and $\cos^2 + \sin^2 = 1$ finishes it.`,
      solution: [
        { math: md`y_1' = ${eTex(a)}(${coef(a)}\cos ${arg} - ${k}\sin ${arg}), \quad y_2' = ${eTex(a)}(${coef(a)}\sin ${arg} + ${k}\cos ${arg})`, note: "Product rule." },
        { math: md`W = ${eTex(2 * a)}\left[\cos ${arg}(${coef(a)}\sin ${arg} + ${k}\cos ${arg}) - \sin ${arg}(${coef(a)}\cos ${arg} - ${k}\sin ${arg})\right]`, note: md`Each product carries $${eTex(a)} \cdot ${eTex(a)} = ${eTex(2 * a)}$.` },
        { math: md`W = ${eTex(2 * a)} \cdot ${k}(\cos^2 ${arg} + \sin^2 ${arg}) = ${mono(k, eTex(2 * a))}`, note: md`The $\cos\sin$ terms cancel.` },
      ],
    };
  }
  const rho = r.nonzero(-4, 4);
  return {
    prompt: md`Find the Wronskian $W = y_1 y_2' - y_1' y_2$ of $y_1 = ${eTex(rho)}$ and $y_2 = t${eTex(rho)}$. Give an expression in $t$.`,
    answer: eText(2 * rho),
    hint: md`$y_2' = ${eTex(rho)} + ${coef(rho)}t${eTex(rho)}$ by the product rule.`,
    solution: [
      { math: md`y_1' = ${coef(rho)}${eTex(rho)}, \quad y_2' = (1 ${signed(rho)}t)${eTex(rho)}`, note: "Product rule for the second." },
      { math: md`W = ${eTex(rho)}(1 ${signed(rho)}t)${eTex(rho)} - ${coef(rho)}${eTex(rho)} \cdot t${eTex(rho)}`, note: "Definition." },
      { math: md`W = ${eTex(2 * rho)}\left[(1 ${signed(rho)}t) ${signed(-rho)}t\right] = ${eTex(2 * rho)}`, note: "The t terms cancel. Never zero, so the pair is independent." },
    ],
  };
};

const variationDerivatives: Generator = (r) => {
  const [r1, r2] = distinctPair(r, -3, 3, true);
  const b = -(r1 + r2);
  const c = r1 * r2;
  const m = r.nonzero(-3, 3);
  const k = m * (r1 - r2);
  const kind = r.int(0, 1);
  // g = k e^{at} or g = k t.
  const a = r.int(-2, 2);
  const gTex = kind === 0 ? mono(k, eTex(a)) : `${coef(k)}t`;
  const gText = kind === 0 ? `${k}*(${eText(a)})` : `${k}*t`;
  const y1 = eTex(r1);
  const y2 = eTex(r2);
  // u1' = g e^{-r1 t}/(r1 - r2), u2' = -g e^{-r2 t}/(r1 - r2).
  const u1Text = kind === 0 ? mono(m, eText(a - r1)) : `${coef(m)}t${eText(-r1)}`;
  const u2Text = kind === 0 ? mono(-m, eText(a - r2)) : `${coef(-m)}t${eText(-r2)}`;
  const u1Tex = kind === 0 ? mono(m, eTex(a - r1)) : `${coef(m)}t${eTex(-r1)}`;
  const u2Tex = kind === 0 ? mono(-m, eTex(a - r2)) : `${coef(-m)}t${eTex(-r2)}`;
  return {
    prompt: md`For $${lhsTex(b, c)} = ${gTex}$ the homogeneous solutions are $y_1 = ${y1}$ and $y_2 = ${y2}$. Using variation of parameters, find $u_1'$ and $u_2'$. Give them as expressions in $t$, in the form (u_1', u_2').`,
    answer: `(${u1Text}, ${u2Text})`,
    form: "tuple",
    verify: [`p*(${eText(r1)}) + q*(${eText(r2)}) = 0`, `p*(${r1}*(${eText(r1)})) + q*(${r2}*(${eText(r2)})) = ${gText}`],
    hint: md`$W = y_1 y_2' - y_1' y_2 = ${r2 - r1}${eTex(r1 + r2)}$. Then $u_1' = -y_2 g / W$ and $u_2' = y_1 g / W$.`,
    solution: [
      { math: md`W = ${y1} \cdot ${coef(r2)}${y2} - ${coef(r1)}${y1} \cdot ${y2} = ${r2 - r1}${eTex(r1 + r2)}`, note: "Wronskian of the two exponentials." },
      { math: md`u_1' = \frac{-y_2 g}{W} = \frac{-${y2} \cdot ${gTex}}{${r2 - r1}${eTex(r1 + r2)}} = ${u1Tex}`, note: md`Subtract exponents: $${r2} ${kind === 0 ? signed(a) : ""} - (${r1 + r2}) = ${kind === 0 ? a - r1 : -r1}$, and $\frac{${k}}{${r1 - r2}} = ${m}$.` },
      { math: md`u_2' = \frac{y_1 g}{W} = \frac{${y1} \cdot ${gTex}}{${r2 - r1}${eTex(r1 + r2)}} = ${u2Tex}`, note: md`Exponent $${r1} ${kind === 0 ? signed(a) : ""} - (${r1 + r2}) = ${kind === 0 ? a - r2 : -r2}$, and $\frac{${k}}{${r2 - r1}} = ${-m}$.` },
      { math: md`\text{Check: } u_1' y_1 + u_2' y_2 = ${kind === 0 ? `${mono(m, eTex(a))} ${m < 0 ? "+" : "-"} ${mono(Math.abs(m), eTex(a))}` : `${coef(m)}t ${signed(-m)}t`} = 0`, note: "The constraint we imposed holds." },
    ],
  };
};

const variationParticular: Generator = (r) => {
  const [r1, r2] = distinctPair(r, -3, 3, true);
  const b = -(r1 + r2);
  const c = r1 * r2;
  const y1 = eTex(r1);
  const y2 = eTex(r2);
  if (r.next() < 0.6) {
    let a = r.int(-3, 3);
    while (a === r1 || a === r2) a = r.int(-3, 3);
    const D = (a - r1) * (a - r2);
    const k = r.pick([1, 1, 2, -1, D, -D, 2 * D]);
    return {
      prompt: md`Use variation of parameters to find a particular solution of $${lhsTex(b, c)} = ${mono(k, eTex(a))}$, whose homogeneous solutions are $y_1 = ${y1}$ and $y_2 = ${y2}$. Give $y_p$ as an expression in $t$, with no multiple of $y_1$ or $y_2$ added.`,
      answer: a === 0 ? frac(k, D) : `${frac(k, D)}*${eText(a)}`,
      verify: [`((${a})^2 + (${b})*(${a}) + (${c}))*y = ${k}*(${eText(a)})`],
      hint: md`$W = ${r2 - r1}${eTex(r1 + r2)}$. Find $u_1'$ and $u_2'$, integrate each (the integrands are plain exponentials), then $y_p = u_1 y_1 + u_2 y_2$.`,
      solution: [
        { math: md`W = ${r2 - r1}${eTex(r1 + r2)}`, note: md`$y_1 y_2' - y_1' y_2 = (${r2} - (${r1}))${eTex(r1 + r2)}$.` },
        { math: md`u_1' = \frac{-y_2 g}{W} = ${fracTex(k, r1 - r2)}${eTex(a - r1)}, \qquad u_2' = \frac{y_1 g}{W} = ${fracTex(-k, r1 - r2)}${eTex(a - r2)}`, note: "Subtract exponents." },
        { math: md`u_1 = ${fracTex(k, (r1 - r2) * (a - r1))}${eTex(a - r1)}, \qquad u_2 = ${fracTex(-k, (r1 - r2) * (a - r2))}${eTex(a - r2)}`, note: md`Integrate: $\int e^{st}\,dt = \frac{1}{s}e^{st}$. No constants needed; they'd only add homogeneous solutions.` },
        { math: md`y_p = u_1 y_1 + u_2 y_2 = \left(${fracTex(k, (r1 - r2) * (a - r1))} ${fracTex(-k, (r1 - r2) * (a - r2)).startsWith("-") ? "" : "+"} ${fracTex(-k, (r1 - r2) * (a - r2))}\right)${ePre(a)}`, note: a === 0 ? "The exponentials cancel: the forcing is a constant, so the particular solution is too." : md`Each product is a multiple of $${eTex(a)}$.` },
        { math: md`y_p = ${fracTex(k, D)}${ePre(a)}`, note: md`Combine the fractions. This matches undetermined coefficients: $A(${a * a} ${signed(a * b)} ${signed(c)}) = ${k}$.` },
      ],
    };
  }
  const a = r1;
  const m = r.pick([1, 1, 2, -1, r1 - r2]);
  const k = m * (r1 - r2);
  return {
    prompt: md`Use variation of parameters to find a particular solution of $${lhsTex(b, c)} = ${mono(k, eTex(a))}$, whose homogeneous solutions are $y_1 = ${y1}$ and $y_2 = ${y2}$. Give $y_p$ as an expression in $t$, with no multiple of $y_1$ or $y_2$ added.`,
    answer: `${coef(m)}t*${eText(a)}`,
    verify: [`(2*(${a}) + (${b}))*y = ${k}*t*(${eText(a)})`],
    hint: md`Here $g$ is a multiple of $y_1$. Then $u_1' = -y_2 g / W$ is a constant, so $u_1$ is a multiple of $t$. The $u_2 y_2$ term turns out to be a multiple of $y_1$, which you drop.`,
    solution: [
      { math: md`W = ${r2 - r1}${eTex(r1 + r2)}`, note: "" },
      { math: md`u_1' = \frac{-${y2} \cdot ${mono(k, eTex(a))}}{${r2 - r1}${eTex(r1 + r2)}} = ${m}, \qquad u_2' = \frac{${y1} \cdot ${mono(k, eTex(a))}}{${r2 - r1}${eTex(r1 + r2)}} = ${-m}${eTex(r1 - r2)}`, note: md`In $u_1'$ every exponential cancels: $${r2} ${signed(a)} - (${r1 + r2}) = 0$.` },
      { math: md`u_1 = ${m}t, \qquad u_2 = ${fracTex(-m, r1 - r2)}${eTex(r1 - r2)}`, note: "Integrate." },
      { math: md`y_p = ${m}t${eTex(r1)} ${fracTex(-m, r1 - r2).startsWith("-") ? "" : "+"} ${fracTex(-m, r1 - r2)}${eTex(r1)}`, note: md`$u_2 y_2 = ${fracTex(-m, r1 - r2)}${eTex(r1 - r2)} \cdot ${eTex(r2)}$ has exponent $${r1}$.` },
      { math: md`y_p = ${coef(m)}t${eTex(a)}`, note: md`The second term is a multiple of $y_1$, a homogeneous solution, so it can be dropped: it's absorbed into $c_1 y_1$.` },
    ],
  };
};

// ── Lesson 5: Springs, oscillation and resonance ────────────────────────────

const naturalFrequency: Generator = (r) => {
  const m = r.pick([1, 2, 4]);
  if (r.next() < 0.6) {
    const s = r.pick([2, 3, 4, 5, 8, 9, 12, 16, 25]);
    const k = m * s;
    const [text, tex] = sqrtForms(s);
    return {
      prompt: md`A mass of $${m}$ kg hangs on a spring with constant $k = ${k}$ N/m, with no damping. Find the natural angular frequency $\omega_0$ in rad/s. Give an exact value, like 2sqrt(3).`,
      answer: text,
      simplified: true,
      verify: [`${m}*w^2 = ${k}`],
      hint: md`$m x'' + kx = 0$ has characteristic equation $mr^2 + k = 0$, so $r = \pm i\sqrt{k/m}$.`,
      solution: [
        { math: md`${mono(m, "r^2")} + ${k} = 0 \;\Rightarrow\; r = \pm i\sqrt{${s}}`, note: md`Characteristic equation of $${mono(m, "x''")} + ${k}x = 0$.` },
        { math: md`\omega_0 = \sqrt{\frac{k}{m}} = \sqrt{${s}} = ${tex}`, note: "The imaginary part of the root is the angular frequency." },
      ],
    };
  }
  const w0 = r.int(1, 5);
  const k = m * w0 * w0;
  const [text, tex] = piFrac(2, w0);
  return {
    prompt: md`A mass of $${m}$ kg on a spring with constant $k = ${k}$ N/m oscillates with no damping. Find the period of the motion, in seconds. Give an exact value, like 2pi/3.`,
    answer: text,
    simplified: true,
    verify: [`${m}*(2*pi/T)^2 = ${k}`],
    hint: md`First find $\omega_0 = \sqrt{k/m}$. The solution $\cos \omega_0 t$ repeats when $\omega_0 t$ increases by $2\pi$.`,
    solution: [
      { math: md`\omega_0 = \sqrt{\frac{${k}}{${m}}} = ${w0}`, note: "Natural angular frequency." },
      { math: md`T = \frac{2\pi}{\omega_0} = ${tex}`, note: md`$\cos(\omega_0 t)$ completes one cycle when $\omega_0 t = 2\pi$.` },
    ],
  };
};

const dampingCases: Generator = (r) => {
  const kind = r.int(0, 2);
  const m = r.pick([1, 1, 2, 3]);
  if (kind === 0) {
    const k = r.pick([1, 2, 3, 4, 5, 6, 8, 9, 12]);
    const [text, tex] = sqrtForms(4 * m * k);
    return {
      prompt: md`A mass of $${m}$ kg is on a spring with constant $k = ${k}$ N/m. Find the damping constant $c$ that makes the system critically damped. Give an exact value, like 2sqrt(6).`,
      answer: text,
      simplified: true,
      verify: [`c^2 = 4*${m}*${k}`],
      hint: md`The roots of $mr^2 + cr + k = 0$ are repeated exactly when the discriminant $c^2 - 4mk$ is zero.`,
      solution: [
        { math: md`c^2 - 4mk = 0 \;\Rightarrow\; c^2 = ${4 * m * k}`, note: "Critical damping: a repeated root." },
        { math: md`c = \sqrt{${4 * m * k}} = ${tex}`, note: "Damping constants are positive." },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 9);
    const crit2 = 4 * m * k;
    const c = r.int(1, 8);
    const which = c * c < crit2 ? "underdamped" : c * c === crit2 ? "critically damped" : "overdamped";
    const sign = c * c < crit2 ? "<" : c * c === crit2 ? "=" : ">";
    return {
      prompt: md`The motion of a mass on a spring satisfies $${mono(m, "x''")} + ${c}x' + ${k}x = 0$. Is the system underdamped, critically damped or overdamped?`,
      choices: ["underdamped", "critically damped", "overdamped"],
      accept: [which],
      hint: md`Compare $c^2$ with $4mk$. Smaller means complex roots and oscillation; larger means two real roots and no oscillation.`,
      solution: [
        { math: md`c^2 = ${c * c}, \qquad 4mk = ${crit2}`, note: md`The discriminant of $${mono(m, "r^2")} + ${c}r + ${k}$ is $c^2 - 4mk$.` },
        { math: md`c^2 ${sign} 4mk`, note: which === "underdamped" ? "Negative discriminant: complex roots, so the mass oscillates while the amplitude decays." : which === "overdamped" ? "Positive discriminant: two negative real roots, so the mass creeps back without oscillating." : "Zero discriminant: a repeated root, the boundary between the two behaviours." },
      ],
    };
  }
  // Underdamped: quasi-frequency mu = sqrt(4mk - c^2) / (2m).
  const c = r.pick([2, 4, 6]);
  const d = r.pick([1, 4, 9, 16, 3, 8]);
  // 4mk - c^2 = 4 m^2 d  =>  k = m d + c^2 / (4m).
  const k4 = 4 * m * m * d + c * c;
  if (k4 % (4 * m) !== 0) return dampingCases(r);
  const k = k4 / (4 * m);
  const [text, tex] = sqrtForms(d);
  return {
    prompt: md`The motion of a mass on a spring satisfies $${mono(m, "x''")} + ${c}x' + ${k}x = 0$. Find the quasi-frequency $\mu$: the angular frequency of the decaying oscillation, in rad/s. Give an exact value, like sqrt(3).`,
    answer: text,
    simplified: true,
    complex: true,
    verify: [`${m}*(-${c}/(2*${m}) + u*i)^2 + ${c}*(-${c}/(2*${m}) + u*i) + ${k} = 0`],
    hint: md`The roots are $r = \frac{-c \pm \sqrt{c^2 - 4mk}}{2m}$. With $c^2 < 4mk$ they are $-\frac{c}{2m} \pm i\mu$. The imaginary part is $\mu$.`,
    solution: [
      { math: md`r = \frac{-${c} \pm \sqrt{${c * c} - ${4 * m * k}}}{${2 * m}} = \frac{-${c} \pm \sqrt{-${4 * m * k - c * c}}}{${2 * m}}`, note: "Quadratic formula." },
      { math: md`r = -${fracTex(c, 2 * m)} \pm i\frac{\sqrt{${4 * m * k - c * c}}}{${2 * m}} = -${fracTex(c, 2 * m)} \pm i${tex}`, note: md`$\sqrt{${4 * m * k - c * c}} = ${2 * m}${tex === "1" ? "" : ` \\cdot ${tex}`}$.` },
      { math: md`\mu = ${tex}`, note: md`$x = e^{-${fracTex(c, 2 * m)}t}(c_1 \cos \mu t + c_2 \sin \mu t)$: the oscillation runs at $\mu$, slower than the undamped $\omega_0 = \sqrt{k/m}$.` },
    ],
  };
};

const steadyStateAmplitude: Generator = (r) => {
  const m = r.pick([1, 1, 2]);
  const w = r.int(1, 3);
  // c w = q, k - m w^2 = p, with p^2 + q^2 a perfect square.
  const pairs: [number, number][] = [[3, 4], [-3, 4], [4, 3], [-4, 3], [0, 1], [0, 2], [0, 3], [0, 4], [6, 8], [8, 6], [1, 0], [2, 0], [3, 0], [-2, 0], [-3, 0], [4, 0]];
  const usable = pairs.filter(([p, q]) => q % w === 0 && p + m * w * w > 0);
  const [p, q] = r.pick(usable);
  const c = q / w;
  const k = p + m * w * w;
  const root = Math.sqrt(p * p + q * q);
  const F0 = r.next() < 0.5 ? root * r.int(1, 4) : r.int(1, 12);
  const Rtext = frac(F0, root);
  const arg = trigArg(w);
  const lhs = `${mono(m, "x''")}${c ? ` + ${mono(c, "x'")}` : ""} + ${mono(k, "x")}`;
  return {
    prompt: md`A forced spring satisfies $${lhs} = ${F0}\cos ${arg}$. Find the amplitude $R$ of the steady-state solution $x_p = R\cos(${arg} - \delta)$. Fractions like 3/5 are fine.`,
    answer: Rtext,
    verify: [`R^2*((${k} - ${m}*${w}^2)^2 + (${c}*${w})^2) = ${F0}^2`],
    hint: md`Try $x_p = A\cos ${arg} + B\sin ${arg}$: matching gives $(k - m\omega^2)A + c\omega B = F_0$ and $-c\omega A + (k - m\omega^2)B = 0$. Then $R = \sqrt{A^2 + B^2} = \dfrac{F_0}{\sqrt{(k - m\omega^2)^2 + (c\omega)^2}}$.`,
    solution: [
      { math: md`k - m\omega^2 = ${k} - ${m} \cdot ${w * w} = ${p}, \qquad c\omega = ${q}`, note: md`With $\omega = ${w}$.` },
      { math: md`R = \frac{F_0}{\sqrt{(k - m\omega^2)^2 + (c\omega)^2}} = \frac{${F0}}{\sqrt{${p * p} + ${q * q}}}`, note: c === 0 ? "With no damping the second term is zero, so R is just the forcing over the distance from resonance." : "Steady-state amplitude." },
      { math: md`R = \frac{${F0}}{${root}} = ${fracTex(F0, root)}`, note: p === 0 ? md`$k = m\omega^2$: the forcing is right at the natural frequency, and only the damping keeps the amplitude finite.` : "" },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "Second-Order Linear Equations",
  lessons: [
    {
      id: slug("Homogeneous equations with constant coefficients"),
      title: "Homogeneous equations with constant coefficients",
      summary: "Why e^(rt) is the right guess, the characteristic equation, and why two constants are needed.",
      blocks: [
        {
          kind: "text",
          body: md`A **second-order linear equation** has the form

$$a(t)\,y'' + b(t)\,y' + c(t)\,y = g(t).$$

It is **homogeneous** when $g(t) = 0$. This unit is about the case where $a$, $b$, $c$ are constants. That sounds narrow, but it covers springs, circuits, pendulums for small swings, and it is the model everything else is compared to.

Start with $y'' - y = 0$: a function equal to its own second derivative. $e^t$ works, since $(e^t)'' = e^t$. So does $e^{-t}$: its derivative is $-e^{-t}$, and the derivative of that is $e^{-t}$ again. And so does $3e^t - 5e^{-t}$. Those two facts, the exponential guess and the freedom to combine, are the whole lesson.`,
        },
        {
          kind: "why",
          title: "Why try y = e^(rt)?",
          body: md`The equation $ay'' + by' + cy = 0$ says that at every $t$, a fixed combination of $y$, $y'$ and $y''$ is zero. That is easiest to arrange when $y'$ and $y''$ are just multiples of $y$, because then the combination is a *number* times $y$, and a number is easy to make zero.

Only one kind of function has derivatives that are multiples of itself: $y = e^{rt}$, with $y' = re^{rt}$ and $y'' = r^2 e^{rt}$. Substituting,

$$a r^2 e^{rt} + b r e^{rt} + c e^{rt} = (ar^2 + br + c)\,e^{rt} = 0.$$

Since $e^{rt}$ is never zero, this holds exactly when $ar^2 + br + c = 0$. A differential equation has turned into a quadratic.`,
        },
        {
          kind: "key",
          title: "The characteristic equation",
          body: md`For $ay'' + by' + cy = 0$ with constant $a, b, c$, the **characteristic equation** is

$$ar^2 + br + c = 0.$$

$y = e^{rt}$ is a solution if and only if $r$ is a root. Each root gives one solution.`,
        },
        {
          kind: "example",
          title: "Two real roots",
          problem: md`Find two solutions of $y'' - 3y' + 2y = 0$.`,
          steps: [
            { math: md`r^2 - 3r + 2 = 0`, note: "Replace y'' by r², y' by r, y by 1." },
            { math: md`(r - 1)(r - 2) = 0 \;\Rightarrow\; r = 1, \; r = 2`, note: "Factor." },
            { math: md`y_1 = e^{t}, \qquad y_2 = e^{2t}`, note: md`Check $y_2$: $4e^{2t} - 3 \cdot 2e^{2t} + 2e^{2t} = 0$.` },
          ],
        },
        {
          kind: "text",
          body: md`Two solutions is a start. The next fact is that any combination $c_1 y_1 + c_2 y_2$ is also a solution. This is called **superposition**, and it is true of every linear homogeneous equation, not just this one. Here is the proof.`,
        },
        {
          kind: "proof",
          title: "Superposition",
          given: md`$y_1$ and $y_2$ both solve $ay'' + by' + cy = 0$, and $c_1, c_2$ are constants`,
          prove: md`$y = c_1 y_1 + c_2 y_2$ solves it too`,
          steps: [
            { statement: md`$y' = c_1 y_1' + c_2 y_2'$ and $y'' = c_1 y_1'' + c_2 y_2''$`, reason: "Derivatives of sums and constant multiples" },
            { statement: md`$ay'' + by' + cy = a(c_1 y_1'' + c_2 y_2'') + b(c_1 y_1' + c_2 y_2') + c(c_1 y_1 + c_2 y_2)$`, reason: "Substitute" },
            { statement: md`$= c_1(ay_1'' + by_1' + cy_1) + c_2(ay_2'' + by_2' + cy_2)$`, reason: md`Regroup by $c_1$ and $c_2$ (distributive property)` },
            { statement: md`$= c_1 \cdot 0 + c_2 \cdot 0 = 0$`, reason: md`$y_1$ and $y_2$ are solutions` },
          ],
        },
        {
          kind: "why",
          title: "Why two constants?",
          body: md`A first-order equation needed one constant, fixed by one initial value. A second-order equation is, loosely, two integrations deep. The simplest case shows it: $y'' = 0$ means $y'$ is a constant $c_2$, and integrating again gives $y = c_2 t + c_1$. Two integrations, two constants.

Physically, a second-order equation describes acceleration, and to predict a motion you need both where it starts, $y(0)$, and how fast it is moving, $y'(0)$. Two numbers in, two constants to fit them.

The two solutions must be genuinely different, not multiples of each other, or $c_1 y_1 + c_2 y_2$ collapses to one constant's worth of freedom. The test is the **Wronskian** $W = y_1 y_2' - y_1' y_2$: when $W \ne 0$ the pair is independent and every solution is a combination of them. For $e^{r_1 t}$ and $e^{r_2 t}$, $W = (r_2 - r_1)e^{(r_1 + r_2)t}$, which is never zero when $r_1 \ne r_2$.`,
        },
        {
          kind: "key",
          title: "General solution, distinct real roots",
          body: md`If $ar^2 + br + c = 0$ has two different real roots $r_1 \ne r_2$, then **every** solution of $ay'' + by' + cy = 0$ is

$$y = c_1 e^{r_1 t} + c_2 e^{r_2 t}$$

for some constants $c_1, c_2$. An initial value problem adds $y(0)$ and $y'(0)$, which pin the constants down: two linear equations in two unknowns.`,
        },
        {
          kind: "plot",
          x: [0, 4],
          y: [-4, 4],
          parametric: [{ x: "t", y: "c e^(-t) + d e^(-3t)", t: [0, 4], label: "y = c_1 e^{-t} + c_2 e^{-3t}", color: 1 }],
          curves: [
            { expr: "c e^(-x)", label: "c_1 e^{-t}", color: 2, dashed: true },
            { expr: "d e^(-3x)", label: "c_2 e^{-3t}", color: 3, dashed: true },
          ],
          points: [{ x: 0, y: "c + d", label: "y(0) = {=c + d}, \\; y'(0) = {=-c - 3d}", color: 1 }],
          params: [
            { name: "c", tex: "c_1", min: -3, max: 3, step: 0.5, value: 2 },
            { name: "d", tex: "c_2", min: -3, max: 3, step: 0.5, value: -1 },
          ],
          caption: md`Solutions of $y'' + 4y' + 3y = 0$, whose roots are $-1$ and $-3$. Slide $c_1$ and $c_2$: the start height is $c_1 + c_2$ and the start slope is $-c_1 - 3c_2$. Both exponentials decay, so every solution dies out, and the slower one, $e^{-t}$, decides the long-run shape.`,
        },
        {
          kind: "example",
          title: "An initial value problem",
          problem: md`Solve $y'' + 4y' + 3y = 0$, $y(0) = 2$, $y'(0) = -4$.`,
          steps: [
            { math: md`r^2 + 4r + 3 = (r + 1)(r + 3) = 0 \;\Rightarrow\; r = -1, -3`, note: "Characteristic equation." },
            { math: md`y = c_1 e^{-t} + c_2 e^{-3t}`, note: "General solution." },
            { math: md`y(0) = c_1 + c_2 = 2`, note: md`Set $t = 0$; both exponentials equal 1.` },
            { math: md`y' = -c_1 e^{-t} - 3c_2 e^{-3t}, \qquad y'(0) = -c_1 - 3c_2 = -4`, note: "Differentiate first, then substitute. Never the other way round." },
            { math: md`c_2 = 1, \quad c_1 = 1`, note: md`Add the two equations: $-2c_2 = -2$.` },
            { math: md`y = e^{-t} + e^{-3t}`, note: md`Check: $y(0) = 2$ and $y'(0) = -1 - 3 = -4$.` },
          ],
        },
        {
          kind: "text",
          body: md`**Reading the roots.** A negative root means its exponential decays; a positive root means it grows. If both roots are negative, every solution returns to zero: a stable system. If any root is positive, almost every solution runs off to infinity. The sign of the roots is the first thing to look at, before solving anything.

The roots can also be complex, or equal. The exponential guess still works, but it needs a little more care. That's the next lesson.`,
        },
        {
          kind: "check",
          prompt: md`Solve the characteristic equation $r^2 - r - 6 = 0$. Separate the roots with a comma.`,
          answer: "3, -2",
          form: "set",
          explain: md`$r^2 - r - 6 = (r - 3)(r + 2)$, so $r = 3$ or $r = -2$. The general solution of $y'' - y' - 6y = 0$ is $c_1 e^{3t} + c_2 e^{-2t}$.`,
        },
        {
          kind: "check",
          prompt: md`Find the solution of $y'' - y = 0$ with $y(0) = 3$ and $y'(0) = 1$. Give an expression in $t$, like 2e^(3t) - e^(-t).`,
          answer: "2e^t + e^(-t)",
          explain: md`Roots $\pm 1$, so $y = c_1 e^{t} + c_2 e^{-t}$. Then $c_1 + c_2 = 3$ and $c_1 - c_2 = 1$, giving $c_1 = 2$, $c_2 = 1$.`,
        },
      ],
      practice: [solveCharacteristic, realRootsIvp, equationFromSolutions],
    },
    {
      id: slug("Complex and repeated roots"),
      title: "Complex and repeated roots",
      summary: "Euler's formula from the series, real solutions from complex roots, and the extra factor of t when a root repeats.",
      blocks: [
        {
          kind: "text",
          body: md`Take $y'' + y = 0$. The characteristic equation is $r^2 + 1 = 0$, so $r = \pm i$. The recipe says $y = e^{it}$, but what is $e$ raised to an imaginary power?

We know the answer should involve $\cos t$ and $\sin t$, because both satisfy $y'' = -y$. The connection between them and $e^{it}$ is Euler's formula, and it comes straight out of the power series for $e^x$.`,
        },
        {
          kind: "why",
          title: "Euler's formula from the series",
          body: md`From Calculus 2, for every real $x$,

$$e^x = 1 + x + \frac{x^2}{2!} + \frac{x^3}{3!} + \frac{x^4}{4!} + \cdots$$

Use this series to *define* $e^{it}$: put $x = it$ and use $i^2 = -1$, $i^3 = -i$, $i^4 = 1$, repeating:

$$e^{it} = 1 + it - \frac{t^2}{2!} - i\frac{t^3}{3!} + \frac{t^4}{4!} + i\frac{t^5}{5!} - \cdots$$

Group the terms without $i$ and the terms with $i$:

$$e^{it} = \left(1 - \frac{t^2}{2!} + \frac{t^4}{4!} - \cdots\right) + i\left(t - \frac{t^3}{3!} + \frac{t^5}{5!} - \cdots\right) = \cos t + i\sin t.$$

The two brackets are exactly the series for cosine and sine. Nothing was assumed about complex exponents; the series did all the work, and the usual rule $e^{u + v} = e^u e^v$ still holds, because it's a fact about multiplying series.`,
        },
        {
          kind: "key",
          title: "Euler's formula",
          body: md`$$e^{it} = \cos t + i\sin t, \qquad e^{(a + bi)t} = e^{at}e^{ibt} = e^{at}(\cos bt + i\sin bt).$$

So a complex root $r = a + bi$ gives the complex-valued solution $e^{at}\cos bt + i\,e^{at}\sin bt$. We want real solutions, and the next proof says we can take the real and imaginary parts separately.`,
        },
        {
          kind: "proof",
          title: "Real and imaginary parts of a solution are solutions",
          given: md`$y = u(t) + i\,v(t)$ solves $ay'' + by' + cy = 0$, with $a, b, c$ real and $u, v$ real functions`,
          prove: md`$u$ and $v$ each solve the equation`,
          steps: [
            { statement: md`$a(u'' + iv'') + b(u' + iv') + c(u + iv) = 0$`, reason: md`Substitute $y = u + iv$; derivatives act on $u$ and $v$ separately` },
            { statement: md`$(au'' + bu' + cu) + i(av'' + bv' + cv) = 0$`, reason: md`Collect real and imaginary parts; $a, b, c$ are real` },
            { statement: md`$au'' + bu' + cu = 0$ and $av'' + bv' + cv = 0$`, reason: "A complex number is zero only when both its real and imaginary parts are zero" },
          ],
        },
        {
          kind: "key",
          title: "General solution, complex roots",
          body: md`If the characteristic equation has roots $r = a \pm bi$ with $b \ne 0$, then

$$y = e^{at}(c_1 \cos bt + c_2 \sin bt).$$

The real part $a$ controls growth or decay; the imaginary part $b$ is the angular frequency of the oscillation. The Wronskian of $e^{at}\cos bt$ and $e^{at}\sin bt$ is $b\,e^{2at} \ne 0$, so this really is every solution. The conjugate root $a - bi$ adds nothing new: it gives the same two functions, with the sign of the sine flipped.`,
        },
        {
          kind: "example",
          title: "Damped oscillation",
          problem: md`Solve $y'' + 2y' + 5y = 0$, $y(0) = 1$, $y'(0) = 1$.`,
          steps: [
            { math: md`r^2 + 2r + 5 = 0 \;\Rightarrow\; (r + 1)^2 = -4 \;\Rightarrow\; r = -1 \pm 2i`, note: "Complete the square." },
            { math: md`y = e^{-t}(c_1 \cos 2t + c_2 \sin 2t)`, note: md`$a = -1$, $b = 2$.` },
            { math: md`y(0) = c_1 = 1`, note: "" },
            { math: md`y' = -e^{-t}(c_1 \cos 2t + c_2 \sin 2t) + e^{-t}(-2c_1 \sin 2t + 2c_2 \cos 2t)`, note: "Product rule." },
            { math: md`y'(0) = -c_1 + 2c_2 = 1 \;\Rightarrow\; c_2 = 1`, note: "" },
            { math: md`y = e^{-t}(\cos 2t + \sin 2t)`, note: "An oscillation whose amplitude shrinks like e^{-t}." },
          ],
        },
        {
          kind: "plot",
          x: [0, 10],
          y: [-3, 3],
          parametric: [{ x: "t", y: "e^(a t) cos(b t)", t: [0, 10], label: "y = e^{at}\\cos bt", color: 1 }],
          curves: [
            { expr: "e^(a x)", label: "e^{at}", color: 2, dashed: true },
            { expr: "-e^(a x)", label: "-e^{at}", color: 2, dashed: true },
          ],
          params: [
            { name: "a", min: -1, max: 0.2, step: 0.1, value: -0.3 },
            { name: "b", min: 1, max: 6, step: 0.5, value: 3 },
          ],
          caption: md`The solution $e^{at}\cos bt$ for the root $a + bi$. Slide $a$: negative and the oscillation decays inside the envelope $\pm e^{at}$; zero and it holds steady; positive and it grows. Slide $b$: the wiggles come faster, with period $2\pi / b$, but the envelope doesn't change.`,
        },
        {
          kind: "text",
          body: md`**Repeated roots.** Now take $y'' - 4y' + 4y = 0$. The characteristic equation $r^2 - 4r + 4 = (r - 2)^2$ has only one root, $r = 2$, so the exponential guess gives only one solution, $e^{2t}$. We need a second one, independent of it. The trick is to look for it in the form $v(t)e^{2t}$: a function times the solution we have.`,
        },
        {
          kind: "why",
          title: "Reduction of order: where the factor of t comes from",
          body: md`Suppose $ar^2 + br + c$ has the repeated root $r$. Then $r = -\frac{b}{2a}$, so $2ar + b = 0$, and of course $ar^2 + br + c = 0$. Try $y = v(t)e^{rt}$ with $v$ unknown. By the product rule,

$$y' = (v' + rv)e^{rt}, \qquad y'' = (v'' + 2rv' + r^2 v)e^{rt}.$$

Substitute and collect by $v''$, $v'$, $v$:

$$ay'' + by' + cy = e^{rt}\left[a v'' + (2ar + b)v' + (ar^2 + br + c)v\right] = e^{rt} \cdot a v''.$$

Both brackets with $v'$ and $v$ vanish, precisely because the root is repeated. So the equation reduces to $v'' = 0$, whose solutions are $v = c_1 + c_2 t$. The second solution is $t e^{rt}$.

For a non-repeated root the $v'$ bracket survives, and this method gives nothing new. The factor of $t$ is special to repeated roots.`,
        },
        {
          kind: "key",
          title: "General solution, repeated root",
          body: md`If the characteristic equation has one repeated root $r$, then

$$y = (c_1 + c_2 t)e^{rt}.$$

The Wronskian of $e^{rt}$ and $te^{rt}$ is $e^{2rt} \ne 0$, so this is every solution. With $r < 0$ the solution still decays, since the exponential beats any power of $t$, but the $t$ lets it rise first before it falls.`,
        },
        {
          kind: "example",
          title: "A repeated root",
          problem: md`Solve $y'' + 6y' + 9y = 0$, $y(0) = 2$, $y'(0) = -1$.`,
          steps: [
            { math: md`r^2 + 6r + 9 = (r + 3)^2 = 0 \;\Rightarrow\; r = -3`, note: "Repeated." },
            { math: md`y = (c_1 + c_2 t)e^{-3t}`, note: "" },
            { math: md`y(0) = c_1 = 2`, note: "" },
            { math: md`y' = c_2 e^{-3t} - 3(c_1 + c_2 t)e^{-3t}, \qquad y'(0) = c_2 - 3c_1 = -1`, note: "Product rule." },
            { math: md`c_2 = -1 + 6 = 5`, note: "" },
            { math: md`y = (2 + 5t)e^{-3t}`, note: "" },
          ],
        },
        {
          kind: "text",
          body: md`**All three cases at once.** For $ay'' + by' + cy = 0$, the discriminant $b^2 - 4ac$ decides everything:

- Positive: two real roots, $y = c_1 e^{r_1 t} + c_2 e^{r_2 t}$.
- Zero: one repeated root, $y = (c_1 + c_2 t)e^{rt}$.
- Negative: complex roots $a \pm bi$, $y = e^{at}(c_1 \cos bt + c_2 \sin bt)$.

In every case there are two independent solutions and two constants. That's the shape every second-order linear homogeneous equation has.`,
        },
        {
          kind: "check",
          prompt: md`Solve the characteristic equation $r^2 + 4r + 13 = 0$. Separate the roots with a comma; you can write ± as +/-.`,
          answer: "-2 + 3i, -2 - 3i",
          form: "set",
          complex: true,
          explain: md`$(r + 2)^2 = -9$, so $r = -2 \pm 3i$. The general solution of $y'' + 4y' + 13y = 0$ is $e^{-2t}(c_1 \cos 3t + c_2 \sin 3t)$.`,
        },
        {
          kind: "check",
          prompt: md`Find the solution of $y'' - 2y' + y = 0$ with $y(0) = 1$ and $y'(0) = 3$. Give an expression in $t$, like (2 - 3t)e^(5t).`,
          answer: "(1 + 2t)e^t",
          explain: md`$(r - 1)^2 = 0$, so $y = (c_1 + c_2 t)e^{t}$. $y(0) = c_1 = 1$ and $y'(0) = c_2 + c_1 = 3$, so $c_2 = 2$.`,
        },
      ],
      practice: [solveComplexCharacteristic, complexOrRepeatedIvp, equationFromComplexRoots],
    },
    {
      id: slug("Undetermined coefficients"),
      title: "Undetermined coefficients",
      summary: "Nonhomogeneous equations: why the solution splits into particular plus homogeneous, why guessing within a family works, and the modification rule.",
      blocks: [
        {
          kind: "text",
          body: md`Now let the right side be nonzero:

$$ay'' + by' + cy = g(t).$$

The function $g$ is the **forcing**: a push applied from outside, like a motor shaking a spring or a voltage driving a circuit. The equation with $g$ replaced by zero is the **associated homogeneous equation**, and its solution $y_h$ you already know how to find. The first fact is that $y_h$ is most of the answer.`,
        },
        {
          kind: "proof",
          title: "Every solution is one particular solution plus a homogeneous one",
          given: md`$y_p$ is one solution of $ay'' + by' + cy = g$, and $y$ is any other solution`,
          prove: md`$y = y_p + y_h$ for some solution $y_h$ of the homogeneous equation`,
          steps: [
            { statement: md`Let $w = y - y_p$`, reason: "Definition" },
            { statement: md`$aw'' + bw' + cw = (ay'' + by' + cy) - (ay_p'' + by_p' + cy_p)$`, reason: "Derivatives of a difference, then regroup" },
            { statement: md`$= g - g = 0$`, reason: md`Both $y$ and $y_p$ solve the equation` },
            { statement: md`$w$ is a homogeneous solution, so $w = c_1 y_1 + c_2 y_2$`, reason: "Previous lessons: every homogeneous solution is a combination of the two basic ones" },
            { statement: md`$y = y_p + c_1 y_1 + c_2 y_2$`, reason: md`$y = y_p + w$` },
          ],
        },
        {
          kind: "key",
          title: "Structure of the general solution",
          body: md`$$y = y_p + y_h = y_p + c_1 y_1 + c_2 y_2.$$

Any one particular solution $y_p$ will do; they all differ by homogeneous solutions. So the job is: find $y_h$ as before, find one $y_p$ by any means, add. Use the initial conditions only at the end, on the full $y$, never on $y_p$ alone.`,
        },
        {
          kind: "why",
          title: "Why guessing works",
          body: md`The left side $L[y] = ay'' + by' + cy$ differentiates $y$ and takes combinations. Some families of functions are **closed** under that: differentiate a member and you stay in the family.

- Polynomials of degree $\le n$: derivatives are polynomials of degree $\le n$.
- Multiples of $e^{\alpha t}$: derivatives are multiples of $e^{\alpha t}$.
- Combinations $A\cos \omega t + B\sin \omega t$: derivatives are combinations of the same two functions.

So if $g$ is in one of these families, $L$ applied to a general member of the family lands back in the family, and we only have to pick the member's coefficients so that the result equals $g$. That's a finite system of linear equations for the coefficients, not a differential equation. The coefficients are "undetermined" only until we match.`,
        },
        {
          kind: "example",
          title: "Exponential forcing",
          problem: md`Find a particular solution of $y'' + 3y' + 2y = 12e^{2t}$.`,
          steps: [
            { math: md`y_p = Ae^{2t}, \quad y_p' = 2Ae^{2t}, \quad y_p'' = 4Ae^{2t}`, note: md`Guess in the family of $e^{2t}$.` },
            { math: md`4Ae^{2t} + 6Ae^{2t} + 2Ae^{2t} = 12e^{2t}`, note: "Substitute." },
            { math: md`12A = 12 \;\Rightarrow\; A = 1`, note: md`Divide by $e^{2t}$, which is never zero.` },
            { math: md`y_p = e^{2t}, \qquad y = e^{2t} + c_1 e^{-t} + c_2 e^{-2t}`, note: md`The homogeneous roots are $-1, -2$.` },
          ],
        },
        {
          kind: "example",
          title: "Polynomial forcing",
          problem: md`Find a particular solution of $y'' - y' - 2y = 4t$.`,
          steps: [
            { math: md`y_p = At + B, \quad y_p' = A, \quad y_p'' = 0`, note: md`$g$ has degree 1, so guess a general degree-1 polynomial. Include the constant $B$ even though $g$ has none.` },
            { math: md`0 - A - 2(At + B) = 4t`, note: "Substitute." },
            { math: md`-2A\,t + (-A - 2B) = 4t + 0`, note: "Collect by powers of t." },
            { math: md`-2A = 4, \quad -A - 2B = 0 \;\Rightarrow\; A = -2, \; B = 1`, note: "Two polynomials are equal only if every coefficient matches." },
            { math: md`y_p = -2t + 1`, note: md`Check: $0 - (-2) - 2(-2t + 1) = 2 + 4t - 2 = 4t$.` },
          ],
        },
        {
          kind: "example",
          title: "Sinusoidal forcing",
          problem: md`Find a particular solution of $y'' + 3y' + 2y = 10\cos t$.`,
          steps: [
            { math: md`y_p = A\cos t + B\sin t`, note: md`Even though $g$ has only a cosine, $y_p'$ will produce sines, so the guess needs both.` },
            { math: md`y_p' = -A\sin t + B\cos t, \qquad y_p'' = -A\cos t - B\sin t`, note: "" },
            { math: md`(-A + 3B + 2A)\cos t + (-B - 3A + 2B)\sin t = 10\cos t`, note: "Substitute and collect cosines and sines." },
            { math: md`A + 3B = 10, \qquad -3A + B = 0`, note: "Match the cosine coefficients, then the sine coefficients." },
            { math: md`B = 3A \;\Rightarrow\; 10A = 10 \;\Rightarrow\; A = 1, \; B = 3`, note: "" },
            { math: md`y_p = \cos t + 3\sin t`, note: md`Full solution: $y = \cos t + 3\sin t + c_1 e^{-t} + c_2 e^{-2t}$.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 12],
          y: [-5, 5],
          parametric: [
            { x: "t", y: "c e^(-t) + d e^(-2t) + cos(t) + 3 sin(t)", t: [0, 12], label: "y = y_p + c_1 e^{-t} + c_2 e^{-2t}", color: 1 },
            { x: "t", y: "cos(t) + 3 sin(t)", t: [0, 12], label: "y_p = \\cos t + 3\\sin t", color: 2, dashed: true },
          ],
          params: [
            { name: "c", tex: "c_1", min: -4, max: 4, step: 0.5, value: 3 },
            { name: "d", tex: "c_2", min: -4, max: 4, step: 0.5, value: -2 },
          ],
          caption: md`Solutions of $y'' + 3y' + 2y = 10\cos t$. Whatever $c_1, c_2$ you choose, the homogeneous part dies out and every solution settles onto $y_p$. The homogeneous part is the **transient**; $y_p$ is the **steady state**. That's why one particular solution is the one worth knowing.`,
        },
        {
          kind: "key",
          title: "What to guess",
          body: md`| Forcing $g(t)$ | Guess $y_p$ |
| --- | --- |
| polynomial of degree $n$ | general polynomial of degree $n$ |
| $ke^{\alpha t}$ | $Ae^{\alpha t}$ |
| $k\cos \omega t$ or $k\sin \omega t$ | $A\cos \omega t + B\sin \omega t$ |
| products, like $te^{\alpha t}$ | products of the guesses: $(At + B)e^{\alpha t}$ |
| sums | the sum of the guesses for each piece |

Always use the *whole* family: all the lower powers, both cosine and sine.`,
        },
        {
          kind: "why",
          title: "When the guess fails, and the fix",
          body: md`Try $y'' - y = e^t$ with $y_p = Ae^t$. Substituting gives $Ae^t - Ae^t = 0$, which can never equal $e^t$. The guess failed because $e^t$ is itself a homogeneous solution: $L$ sends it to zero, so no multiple of it can produce anything.

The fix is the same one repeated roots taught us: bring in a factor of $t$. Try $y_p = Ate^t$:

$$y_p' = A(1 + t)e^t, \qquad y_p'' = A(2 + t)e^t, \qquad y_p'' - y_p = A(2 + t)e^t - Ate^t = 2Ae^t.$$

So $2A = 1$, $A = \tfrac12$, and $y_p = \tfrac12 te^t$. The $t$ terms cancelled for the same reason as in reduction of order: $e^t$ solves the homogeneous equation. What survives is a clean multiple of $e^t$, and now it can be matched.`,
        },
        {
          kind: "key",
          title: "The modification rule",
          body: md`If any term of the usual guess solves the homogeneous equation, multiply the whole guess by $t$. If it still does (a repeated root), multiply by $t$ again. Always find $y_h$ **first**, so you can see the clash coming.

Examples: $y'' - y = e^t$ needs $Ate^t$. $y'' + 4y = \cos 2t$ needs $t(A\cos 2t + B\sin 2t)$. $y'' - 2y' + y = e^t$ has the repeated root 1, so it needs $At^2 e^t$.`,
        },
        {
          kind: "check",
          prompt: md`For $y'' + y = 2e^t$, try $y_p = Ae^t$. What is $A$?`,
          answer: "1",
          explain: md`$y_p'' + y_p = Ae^t + Ae^t = 2Ae^t = 2e^t$, so $A = 1$. No clash: $e^t$ isn't a homogeneous solution of $y'' + y = 0$.`,
        },
        {
          kind: "check",
          prompt: md`Find a particular solution of $y'' - 4y = 8$. Give $y_p$ as a number or expression.`,
          answer: "-2",
          explain: md`A constant forcing wants a constant guess $y_p = A$. Then $y_p'' = 0$, so $-4A = 8$ and $A = -2$.`,
        },
      ],
      practice: [exponentialForcing, polynomialForcing, sinusoidalForcing],
    },
    {
      id: slug("Variation of parameters"),
      title: "Variation of parameters",
      summary: "A method that works for any forcing: let the constants in the homogeneous solution vary, and derive the formulas for u1' and u2'.",
      blocks: [
        {
          kind: "text",
          body: md`Undetermined coefficients needs the forcing to live in a family closed under differentiation. For $y'' + y = \sec t$ there is no such family: the derivatives of $\sec t$ keep producing new functions. We need a method that doesn't depend on guessing.

The idea, due to Lagrange, is to start from the homogeneous solution $c_1 y_1 + c_2 y_2$ and let the constants become functions:

$$y_p = u_1(t)\,y_1 + u_2(t)\,y_2.$$

Two unknown functions is more freedom than one equation needs, and we will spend the extra freedom on making the algebra clean.`,
        },
        {
          kind: "why",
          title: "Deriving the method",
          body: md`Work with the equation in standard form, leading coefficient 1: $y'' + p\,y' + q\,y = g$ (divide through by $a$ if needed). Let $y_1, y_2$ be independent homogeneous solutions and try $y_p = u_1 y_1 + u_2 y_2$. By the product rule,

$$y_p' = (u_1' y_1 + u_2' y_2) + (u_1 y_1' + u_2 y_2').$$

The first bracket would make $y_p''$ contain $u_1''$ and $u_2''$, turning one second-order problem into two. We have freedom to spare, so **impose** $u_1' y_1 + u_2' y_2 = 0$. Then $y_p' = u_1 y_1' + u_2 y_2'$ and

$$y_p'' = u_1' y_1' + u_2' y_2' + u_1 y_1'' + u_2 y_2''.$$

Substitute into $y_p'' + p\,y_p' + q\,y_p$ and group by $u_1$ and $u_2$:

$$u_1(y_1'' + p y_1' + q y_1) + u_2(y_2'' + p y_2' + q y_2) + u_1' y_1' + u_2' y_2' = g.$$

Both brackets are zero because $y_1$, $y_2$ are homogeneous solutions. What's left is the second condition, $u_1' y_1' + u_2' y_2' = g$.`,
        },
        {
          kind: "key",
          title: "The system for u1' and u2'",
          body: md`For $y'' + p\,y' + q\,y = g$ with homogeneous solutions $y_1, y_2$:

$$u_1' y_1 + u_2' y_2 = 0, \qquad u_1' y_1' + u_2' y_2' = g.$$

Two linear equations in the two unknowns $u_1', u_2'$. Solving them and integrating gives $y_p = u_1 y_1 + u_2 y_2$.`,
        },
        {
          kind: "proof",
          title: "Solving the system",
          given: md`$u_1' y_1 + u_2' y_2 = 0$ and $u_1' y_1' + u_2' y_2' = g$, with $W = y_1 y_2' - y_1' y_2 \ne 0$`,
          prove: md`$u_1' = -\dfrac{y_2\,g}{W}$ and $u_2' = \dfrac{y_1\,g}{W}$`,
          steps: [
            { statement: md`$u_1' y_1 y_2' + u_2' y_2 y_2' = 0$`, reason: md`Multiply the first equation by $y_2'$` },
            { statement: md`$u_1' y_1' y_2 + u_2' y_2' y_2 = g\,y_2$`, reason: md`Multiply the second equation by $y_2$` },
            { statement: md`$u_1'(y_1 y_2' - y_1' y_2) = -g\,y_2$`, reason: md`Subtract: the $u_2'$ terms are identical and cancel` },
            { statement: md`$u_1' = -\dfrac{y_2\,g}{W}$`, reason: md`Divide by $W \ne 0$` },
            { statement: md`$u_2'(y_1 y_2' - y_1' y_2) = g\,y_1$`, reason: md`Same steps with the roles swapped: first equation times $y_1'$, second times $y_1$, subtract` },
            { statement: md`$u_2' = \dfrac{y_1\,g}{W}$`, reason: md`Divide by $W$` },
          ],
        },
        {
          kind: "key",
          title: "Variation of parameters",
          body: md`$$y_p = -y_1 \int \frac{y_2\,g}{W}\,dt + y_2 \int \frac{y_1\,g}{W}\,dt, \qquad W = y_1 y_2' - y_1' y_2.$$

Here is why the Wronskian matters: the method divides by it, and it is nonzero exactly when $y_1, y_2$ are independent. Constants of integration can be dropped; they only add multiples of $y_1$ and $y_2$, which belong in $y_h$.`,
        },
        {
          kind: "example",
          title: "A forcing no guess can handle",
          problem: md`Find a particular solution of $y'' + y = \sec t$ on $-\frac{\pi}{2} < t < \frac{\pi}{2}$.`,
          steps: [
            { math: md`y_1 = \cos t, \quad y_2 = \sin t, \quad W = \cos t \cdot \cos t - (-\sin t)\sin t = 1`, note: "Homogeneous solutions and their Wronskian." },
            { math: md`u_1' = -\frac{\sin t \sec t}{1} = -\tan t, \qquad u_2' = \frac{\cos t \sec t}{1} = 1`, note: md`$\sec t = 1/\cos t$.` },
            { math: md`u_1 = \ln|\cos t|, \qquad u_2 = t`, note: md`$\int \tan t\,dt = -\ln|\cos t|$.` },
            { math: md`y_p = \cos t \ln|\cos t| + t \sin t`, note: md`On this interval $\cos t > 0$, so the absolute value can go.` },
          ],
        },
        {
          kind: "plot",
          x: [-2, 2],
          y: [-1, 3],
          curves: [{ expr: "cos(x) ln(cos(x)) + x sin(x)", label: "y_p = \\cos t \\ln(\\cos t) + t\\sin t", color: 1, domain: [-1.5707, 1.5707] }],
          vlines: [{ x: -Math.PI / 2, label: "-\\pi/2" }, { x: Math.PI / 2, label: "\\pi/2" }],
          caption: md`The particular solution of $y'' + y = \sec t$. It exists only where $\sec t$ does. The forcing blows up at $\pm\pi/2$, and the solution climbs steeply toward the edges: $t\sin t$ pushes it up while $\cos t \ln(\cos t)$ heads to 0.`,
        },
        {
          kind: "example",
          title: "The same answer as undetermined coefficients",
          problem: md`Use variation of parameters on $y'' - 3y' + 2y = e^{3t}$.`,
          steps: [
            { math: md`y_1 = e^{t}, \quad y_2 = e^{2t}, \quad W = e^{t} \cdot 2e^{2t} - e^{t} \cdot e^{2t} = e^{3t}`, note: md`Roots 1 and 2.` },
            { math: md`u_1' = -\frac{e^{2t} e^{3t}}{e^{3t}} = -e^{2t}, \qquad u_2' = \frac{e^{t} e^{3t}}{e^{3t}} = e^{t}`, note: "" },
            { math: md`u_1 = -\tfrac12 e^{2t}, \qquad u_2 = e^{t}`, note: "Integrate." },
            { math: md`y_p = -\tfrac12 e^{2t} \cdot e^{t} + e^{t} \cdot e^{2t} = \tfrac12 e^{3t}`, note: md`Undetermined coefficients agrees: $A(9 - 9 + 2) = 1$ gives $A = \tfrac12$.` },
          ],
        },
        {
          kind: "why",
          title: "Why we were allowed to impose a condition",
          body: md`We are looking for two functions $u_1, u_2$ but only have one equation to satisfy. Any pair that works is fine, so we can narrow the search however we like, as long as some pair still exists. The condition $u_1' y_1 + u_2' y_2 = 0$ narrows it to a system we can always solve, because $W \ne 0$. The derivation then shows that a solution of the system really does solve the differential equation. The extra condition cost us nothing and bought us a method that never fails.`,
        },
        {
          kind: "text",
          body: md`**Which method when.** If $g$ is a polynomial, exponential, sine or cosine, or a product of those, undetermined coefficients is faster. For anything else ($\sec t$, $\tan t$, $1/t$, $e^{t}/t$, $\ln t$), variation of parameters is the tool. It also works when the coefficients aren't constant, as long as you know $y_1$ and $y_2$ by some other route.`,
        },
        {
          kind: "check",
          prompt: md`For $y'' + 4y = g(t)$, the homogeneous solutions are $y_1 = \cos 2t$ and $y_2 = \sin 2t$. Find their Wronskian $W$.`,
          answer: "2",
          explain: md`$W = \cos 2t \cdot 2\cos 2t - (-2\sin 2t)\sin 2t = 2(\cos^2 2t + \sin^2 2t) = 2$.`,
        },
        {
          kind: "check",
          prompt: md`For $y'' - y = e^{2t}$ with $y_1 = e^{t}$ and $y_2 = e^{-t}$, find $u_2'$. Give an expression in $t$.`,
          answer: "-e^(3t)/2",
          explain: md`$W = e^{t}(-e^{-t}) - e^{t}e^{-t} = -2$, so $u_2' = \dfrac{y_1 g}{W} = \dfrac{e^{t} e^{2t}}{-2} = -\tfrac12 e^{3t}$.`,
        },
      ],
      practice: [wronskian, variationDerivatives, variationParticular],
    },
    {
      id: slug("Springs, oscillation and resonance"),
      title: "Springs, oscillation and resonance",
      summary: "Derive m x'' + c x' + k x = F(t) from Newton's law, read the three damping cases off the discriminant, and see why forcing at the natural frequency makes the amplitude grow.",
      blocks: [
        {
          kind: "text",
          body: md`Everything in this unit was built for one model: a mass on a spring. A mass $m$ slides on a track, attached to a spring. Let $x(t)$ be its displacement from the rest position, positive to the right. We want an equation for $x$.`,
        },
        {
          kind: "diagram",
          view: [-0.5, 9, -2.2, 3],
          points: [
            { name: "W1", x: 0, y: -1.5, hidden: true, label: "" },
            { name: "W2", x: 0, y: 2.5, hidden: true, label: "" },
            { name: "S0", x: 0, y: 0.5, hidden: true, label: "" },
            { name: "S1", x: 0.6, y: 0.5, hidden: true, label: "" },
            { name: "S2", x: 0.9, y: 1.1, hidden: true, label: "" },
            { name: "S3", x: 1.5, y: -0.1, hidden: true, label: "" },
            { name: "S4", x: 2.1, y: 1.1, hidden: true, label: "" },
            { name: "S5", x: 2.7, y: -0.1, hidden: true, label: "" },
            { name: "S6", x: 3.3, y: 1.1, hidden: true, label: "" },
            { name: "S7", x: 3.9, y: -0.1, hidden: true, label: "" },
            { name: "S8", x: 4.2, y: 0.5, hidden: true, label: "" },
            { name: "S9", x: 4.8, y: 0.5, hidden: true, label: "" },
            { name: "M1", x: 4.8, y: -0.5, hidden: true, label: "" },
            { name: "M2", x: 6.8, y: -0.5, hidden: true, label: "" },
            { name: "M3", x: 6.8, y: 1.5, hidden: true, label: "" },
            { name: "M4", x: 4.8, y: 1.5, hidden: true, label: "" },
            { name: "E1", x: 4.3, y: -1.9, hidden: true, label: "" },
            { name: "E2", x: 4.3, y: 2.2, hidden: true, label: "" },
            { name: "C", x: 5.8, y: 0.5, hidden: true, label: "" },
            { name: "X", x: 7.6, y: 0.5, hidden: true, label: "" },
            { name: "F1", x: 4.8, y: -1.2, hidden: true, label: "" },
            { name: "F2", x: 3.2, y: -1.2, hidden: true, label: "" },
            { name: "G1", x: -0.3, y: -1.5, hidden: true, label: "" },
            { name: "G2", x: 9, y: -1.5, hidden: true, label: "" },
          ],
          segments: [
            { from: "W1", to: "W2" },
            { from: "G1", to: "G2" },
            { from: "S0", to: "S1" },
            { from: "S1", to: "S2", color: 2 },
            { from: "S2", to: "S3", color: 2 },
            { from: "S3", to: "S4", color: 2 },
            { from: "S4", to: "S5", color: 2 },
            { from: "S5", to: "S6", color: 2 },
            { from: "S6", to: "S7", color: 2 },
            { from: "S7", to: "S8", color: 2 },
            { from: "S8", to: "S9" },
            { from: "E1", to: "E2", dashed: true },
            { from: "C", to: "X", arrow: true, color: 1, label: "x" },
            { from: "F1", to: "F2", arrow: true, color: 4, label: "-kx" },
          ],
          polygons: [{ points: ["M1", "M2", "M3", "M4"], fill: 1 }],
          labels: [
            { x: 5.8, y: 1.9, text: "m" },
            { x: 2.4, y: 1.7, text: "k" },
            { x: 4.3, y: -2.1, text: "x = 0" },
          ],
          caption: md`The mass is pulled right by $x$ from its rest position. The stretched spring pulls it back with force $-kx$. If the mass were pushed left, $x$ would be negative and $-kx$ would point right. Either way the spring force points toward rest.`,
        },
        {
          kind: "why",
          title: "Deriving the spring equation",
          body: md`Newton's second law: mass times acceleration equals the total force, $m\,x'' = F_{\text{total}}$. List the forces.

- **The spring.** Hooke's law: the restoring force is proportional to the stretch and opposes it, $-kx$ with $k > 0$. When $x > 0$ the spring is stretched and pulls left (negative); when $x < 0$ it is compressed and pushes right. The one formula $-kx$ gives both.
- **Damping.** Friction or air resistance opposes the motion in proportion to the velocity: $-c\,x'$ with $c \ge 0$. Moving right, it pushes left.
- **An external push** $F(t)$, if there is one.

So $m\,x'' = -kx - cx' + F(t)$, or, rearranged,

$$m\,x'' + c\,x' + k\,x = F(t).$$

A second-order linear equation with constant coefficients. Position, velocity and acceleration are $x$, $x'$, $x''$, which is why the equation is exactly second order: forces determine acceleration, no higher.`,
        },
        {
          kind: "key",
          title: "The spring equation and the natural frequency",
          body: md`$$m\,x'' + c\,x' + k\,x = F(t), \qquad m, k > 0, \; c \ge 0.$$

With no damping and no forcing, $m x'' + kx = 0$ has characteristic equation $mr^2 + k = 0$, so $r = \pm i\sqrt{k/m}$. Define the **natural angular frequency**

$$\omega_0 = \sqrt{\frac{k}{m}}, \qquad x = c_1 \cos \omega_0 t + c_2 \sin \omega_0 t.$$

The period is $T = 2\pi/\omega_0$. A stiffer spring (bigger $k$) oscillates faster; a heavier mass oscillates slower. The amplitude doesn't affect the period at all: a small swing and a large swing take the same time.`,
        },
        {
          kind: "example",
          title: "Amplitude and phase",
          problem: md`Solve $x'' + 4x = 0$, $x(0) = 1$, $x'(0) = 2$, and write the answer as a single cosine.`,
          steps: [
            { math: md`\omega_0 = 2, \qquad x = c_1 \cos 2t + c_2 \sin 2t`, note: "" },
            { math: md`c_1 = 1, \qquad 2c_2 = 2 \;\Rightarrow\; c_2 = 1`, note: md`$x(0) = c_1$ and $x'(0) = 2c_2$.` },
            { math: md`x = \cos 2t + \sin 2t = R\cos(2t - \delta)`, note: md`Expand the right side: $R\cos\delta \cos 2t + R\sin\delta \sin 2t$. So $R\cos\delta = 1$, $R\sin\delta = 1$.` },
            { math: md`R = \sqrt{1^2 + 1^2} = \sqrt{2}, \qquad \tan\delta = 1 \;\Rightarrow\; \delta = \tfrac{\pi}{4}`, note: "Square and add for R; divide for the angle." },
            { math: md`x = \sqrt{2}\cos\!\left(2t - \tfrac{\pi}{4}\right)`, note: md`The mass swings between $\pm\sqrt{2}$, shifted a little later than a plain cosine.` },
          ],
        },
        {
          kind: "key",
          title: "Amplitude-phase form",
          body: md`$$c_1 \cos \omega t + c_2 \sin \omega t = R\cos(\omega t - \delta), \qquad R = \sqrt{c_1^2 + c_2^2}, \quad \cos\delta = \frac{c_1}{R}, \; \sin\delta = \frac{c_2}{R}.$$

It's the cosine subtraction formula read backwards. $R$ is the **amplitude**, the farthest the mass gets from rest; $\delta$ is the **phase**. Two numbers in, two numbers out, just repackaged so you can see the motion.`,
        },
        {
          kind: "proof",
          title: "An undamped spring conserves energy",
          given: md`$m\,x'' + k\,x = 0$, and $E = \tfrac12 m (x')^2 + \tfrac12 k x^2$`,
          prove: md`$E$ is constant`,
          steps: [
            { statement: md`$\dfrac{dE}{dt} = \tfrac12 m \cdot 2x' x'' + \tfrac12 k \cdot 2x x'$`, reason: "Chain rule on each square" },
            { statement: md`$= x'(m\,x'' + k\,x)$`, reason: md`Factor out $x'$` },
            { statement: md`$= x' \cdot 0 = 0$`, reason: "The equation of motion" },
            { statement: md`$E$ is constant`, reason: "A function with zero derivative is constant" },
          ],
        },
        {
          kind: "text",
          body: md`The two halves of $E$ are kinetic energy and the energy stored in the spring. At the extremes of the swing, $x' = 0$ and $E = \tfrac12 kR^2$; passing through rest, $x = 0$ and $E = \tfrac12 m v_{\max}^2$. Trading one for the other, forever, is what oscillation is. Damping is the term that makes $E$ decrease: with $c > 0$ the same computation gives $E' = -c(x')^2 \le 0$.

**Damping.** With $c > 0$ the characteristic equation $mr^2 + cr + k = 0$ has roots

$$r = \frac{-c \pm \sqrt{c^2 - 4mk}}{2m},$$

and the discriminant $c^2 - 4mk$ sorts the motion into three cases.`,
        },
        {
          kind: "key",
          title: "The three damping cases",
          body: md`- **Underdamped**, $c^2 < 4mk$: complex roots $-\frac{c}{2m} \pm i\mu$ with $\mu = \frac{\sqrt{4mk - c^2}}{2m}$. The mass oscillates at the **quasi-frequency** $\mu < \omega_0$ inside a shrinking envelope $e^{-ct/2m}$.
- **Critically damped**, $c^2 = 4mk$: repeated root $-\frac{c}{2m}$, $x = (c_1 + c_2 t)e^{-ct/2m}$. Returns to rest as fast as possible without oscillating.
- **Overdamped**, $c^2 > 4mk$: two negative real roots. The mass creeps back to rest, crossing it at most once.

In every damped case both roots have negative real part, so $x \to 0$. Damping always wins in the end; the discriminant only decides how.`,
        },
        {
          kind: "plot",
          x: [0, 12],
          y: [-1.2, 1.2],
          parametric: [{ x: "t", y: "e^(-c t/2) (cos(sqrt(4 - c^2/4) t) + (c/(2 sqrt(4 - c^2/4))) sin(sqrt(4 - c^2/4) t))", t: [0, 12], label: "x(t), \\; \\mu = {=sqrt(4 - c^2/4)}", color: 1 }],
          curves: [
            { expr: "e^(-c x/2)", label: "\\pm e^{-ct/2}", color: 2, dashed: true },
            { expr: "-e^(-c x/2)", color: 2, dashed: true },
          ],
          params: [{ name: "c", min: 0, max: 3.8, step: 0.1, value: 0.6 }],
          caption: md`Underdamped: $x'' + cx' + 4x = 0$ with $x(0) = 1$, $x'(0) = 0$, so $m = 1$, $k = 4$, $\omega_0 = 2$. Slide $c$ from 0 toward the critical value 4. The envelope tightens and the quasi-frequency $\mu = \sqrt{4 - c^2/4}$ drops, so the swings slow down as well as shrink.`,
        },
        {
          kind: "plot",
          x: [0, 6],
          y: [-0.2, 1.2],
          parametric: [{ x: "t", y: "e^(-c t/2) (cosh(sqrt(c^2/4 - 4) t) + (c/(2 sqrt(c^2/4 - 4))) sinh(sqrt(c^2/4 - 4) t))", t: [0, 6], label: "\\text{overdamped}, c = {c}", color: 1 }],
          curves: [{ expr: "(1 + 2x) e^(-2x)", label: "\\text{critical}, c = 4", color: 3, dashed: true }],
          params: [{ name: "c", min: 4.2, max: 10, step: 0.2, value: 5 }],
          caption: md`The same spring past critical damping. The dashed curve is the critically damped return, $(1 + 2t)e^{-2t}$. Increase $c$ and the return gets *slower*, not faster: heavy damping holds the mass back. The quickest return with no overshoot is at the critical value, which is why car suspensions and door closers are tuned near it.`,
        },
        {
          kind: "why",
          title: "Forced springs and the steady state",
          body: md`Push the mass periodically: $m x'' + cx' + kx = F_0 \cos \omega t$. The forcing frequency $\omega$ is ours to choose; the natural frequency $\omega_0 = \sqrt{k/m}$ belongs to the spring. Undetermined coefficients with $x_p = A\cos \omega t + B\sin \omega t$ gives, exactly as in the last lesson,

$$(k - m\omega^2)A + c\omega B = F_0, \qquad -c\omega A + (k - m\omega^2)B = 0.$$

Solving, with $\Delta = (k - m\omega^2)^2 + (c\omega)^2$:

$$A = \frac{F_0(k - m\omega^2)}{\Delta}, \quad B = \frac{F_0 c\omega}{\Delta}, \quad R = \sqrt{A^2 + B^2} = \frac{F_0}{\sqrt{(k - m\omega^2)^2 + (c\omega)^2}}.$$

The homogeneous part decays, so after the transient the mass settles into $x_p = R\cos(\omega t - \delta)$: it moves at the *forcing* frequency, with amplitude $R$. The question is how $R$ depends on $\omega$.`,
        },
        {
          kind: "key",
          title: "Resonance",
          body: md`$$R(\omega) = \frac{F_0}{\sqrt{(k - m\omega^2)^2 + (c\omega)^2}}.$$

The first term under the root vanishes when $m\omega^2 = k$, that is, when $\omega = \omega_0$. Near there $R$ is largest: forcing a system near its natural frequency produces a big response. That is **resonance**. With light damping the peak is tall and narrow; with none at all, $R = F_0 / |k - m\omega^2|$, which is infinite at $\omega = \omega_0$.`,
        },
        {
          kind: "plot",
          x: [0, 4],
          y: [0, 3],
          curves: [{ expr: "1/sqrt((4 - x^2)^2 + (c x)^2)", label: "R(\\omega), F_0 = 1", color: 1 }],
          vlines: [{ x: 2, label: "\\omega_0 = 2" }],
          params: [{ name: "c", min: 0.2, max: 3, step: 0.1, value: 0.5 }],
          caption: md`Steady-state amplitude against forcing frequency $\omega$ (horizontal axis) for $m = 1$, $k = 4$, $F_0 = 1$. Slide the damping $c$ down and the peak near $\omega_0 = 2$ shoots up. Far from $\omega_0$ the amplitude barely depends on $c$: damping only matters where the spring wants to respond.`,
        },
        {
          kind: "why",
          title: "Pure resonance: forcing at exactly the natural frequency with no damping",
          body: md`Take $c = 0$ and $\omega = \omega_0$: $x'' + \omega_0^2 x = \frac{F_0}{m}\cos \omega_0 t$. The usual guess $A\cos \omega_0 t + B\sin \omega_0 t$ solves the homogeneous equation, so the modification rule says to try $x_p = t(A\cos \omega_0 t + B\sin \omega_0 t)$. Differentiating twice,

$$x_p'' = -2A\omega_0 \sin \omega_0 t + 2B\omega_0 \cos \omega_0 t - \omega_0^2\, t(A\cos \omega_0 t + B\sin \omega_0 t),$$

and the last term cancels against $\omega_0^2 x_p$. What remains must equal $\frac{F_0}{m}\cos \omega_0 t$, so $A = 0$ and $2B\omega_0 = F_0/m$:

$$x_p = \frac{F_0}{2m\omega_0}\, t\sin \omega_0 t.$$

The amplitude grows like $t$ without bound. Every push arrives just as the mass is moving the same way, and adds energy every cycle. Real systems always have some damping, which caps the growth at the finite peak of $R(\omega)$, but if that peak is higher than the structure can take, it fails. The famous collapses of bridges, and the reason soldiers break step on them, are this formula.`,
        },
        {
          kind: "plot",
          x: [0, 20],
          y: [-6, 6],
          parametric: [{ x: "t", y: "t sin(2t)/4", t: [0, 20], label: "x_p = \\tfrac{1}{4} t \\sin 2t", color: 1 }],
          curves: [
            { expr: "x/4", label: "\\pm t/4", color: 2, dashed: true },
            { expr: "-x/4", color: 2, dashed: true },
          ],
          caption: md`Pure resonance for $x'' + 4x = \cos 2t$: $x_p = \tfrac14 t\sin 2t$. The oscillation runs at the natural frequency, and its envelope $\pm t/4$ is a straight line heading off the chart.`,
        },
        {
          kind: "check",
          prompt: md`A $2$ kg mass hangs on a spring with $k = 18$ N/m, undamped. Find $\omega_0$ in rad/s.`,
          answer: "3",
          explain: md`$\omega_0 = \sqrt{k/m} = \sqrt{18/2} = \sqrt{9} = 3$.`,
        },
        {
          kind: "check",
          prompt: md`A spring system satisfies $x'' + 6x' + 9x = 0$. Is it underdamped, critically damped or overdamped?`,
          choices: ["underdamped", "critically damped", "overdamped"],
          accept: ["critically damped"],
          explain: md`$c^2 = 36$ and $4mk = 36$. The discriminant is zero, the root $-3$ is repeated, and $x = (c_1 + c_2 t)e^{-3t}$.`,
        },
      ],
      practice: [naturalFrequency, dampingCases, steadyStateAmplitude],
    },
  ],
};
