import { frac, fracTex, gcd, poly, type Rng } from "../../math/random";
import { md, slug, type Block, type Generator, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

/** ⟨a, b, c⟩ in LaTeX. */
const vec = (...c: (string | number)[]) => `\\langle ${c.join(", ")} \\rangle`;
/** A coefficient in front of a symbol: 1 and -1 are hidden. */
const cf = (c: number) => (c === 1 ? "" : c === -1 ? "-" : String(c));
/** t^n in LaTeX, with t^1 written as t and t^0 dropped. */
const tpow = (n: number) => (n === 0 ? "" : n === 1 ? "t" : `t^{${n}}`);
/** t^n in typed-answer syntax. */
const tpowText = (n: number) => (n === 0 ? "" : n === 1 ? "t" : `t^${n}`);
/** A monomial c t^n in LaTeX. */
const mono = (c: number, n: number) => (n === 0 ? String(c) : `${cf(c)}${tpow(n)}`);
/** A monomial c t^n in typed syntax. */
const monoText = (c: number, n: number) => (n === 0 ? String(c) : `${cf(c)}${tpowText(n)}`);
/** A number in parentheses when negative, for substitution into formulas. */
const par = (n: number) => (n < 0 ? `(${n})` : String(n));
/** Shuffle a copy of an array with the seeded rng. */
function shuffle<T>(r: Rng, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** sqrt(n) simplified: k sqrt(m), as typed text and LaTeX, with the parts k and m. */
function root(n: number): { text: string; tex: string; k: number; m: number } {
  let k = 1;
  let m = n;
  for (let d = 2; d * d <= m; d++) {
    while (m % (d * d) === 0) {
      m /= d * d;
      k *= d;
    }
  }
  if (m === 1) return { text: String(k), tex: String(k), k, m };
  if (k === 1) return { text: `sqrt(${m})`, tex: `\\sqrt{${m}}`, k, m };
  return { text: `${k}sqrt(${m})`, tex: `${k}\\sqrt{${m}}`, k, m };
}

/** "t - c" with the sign folded in and c = 0 dropped: "t + 3", "t - 2", "t". */
const tMinus = (c: number) => (c === 0 ? "t" : c < 0 ? `t + ${-c}` : `t - ${c}`);
/** "b - t" with b = 0 written as "-t". */
const minusT = (b: number) => (b === 0 ? "-t" : `${b} - t`);

// ── Lesson 1 generators: space curves ───────────────────────────────────────

const lineMeetsPlane: Generator = (r) => {
  const a = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const b = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
  const t0 = r.int(-3, 3);
  const comps = a.map((ai, i) => poly([[ai, "t"], [b[i]!, ""]]));
  const rt = vec(...comps);
  const point = a.map((ai, i) => ai * t0 + b[i]!);
  if (r.next() < 0.5) {
    // Meeting a coordinate plane: read off t from one component.
    const axis = r.int(0, 2);
    const name = "xyz"[axis]!;
    const k = point[axis]!;
    return {
      prompt: md`The line $\mathbf{r}(t) = ${rt}$ meets the plane $${name} = ${k}$ at one point. Find that point. Give it as $(x, y, z)$.`,
      answer: `(${point.join(", ")})`,
      form: "tuple",
      // The point is on the plane, and on the line (its symmetric equations).
      verify: [
        `${axis === 0 ? "x" : "0*x"} + ${axis === 1 ? "y" : "0*y"} + ${axis === 2 ? "z" : "0*z"} = ${k}`,
        `${a[1]}*(x - ${par(b[0]!)}) + 0*z = ${a[0]}*(y - ${par(b[1]!)})`,
        `${a[2]}*(x - ${par(b[0]!)}) + 0*y = ${a[0]}*(z - ${par(b[2]!)})`,
      ],
      hint: md`Only the $${name}$-component matters for reaching the plane. Set it equal to $${k}$ and solve for $t$, then put that $t$ into all three components.`,
      solution: [
        { math: `${comps[axis]} = ${k}`, note: md`A point is on the plane $${name} = ${k}$ exactly when its $${name}$-coordinate is $${k}$.` },
        { math: `t = ${t0}`, note: md`Solve the linear equation.` },
        { math: `\\mathbf{r}(${t0}) = ${vec(...point)}`, note: md`Substitute $t = ${t0}$ into every component. The $${name}$-component comes out as $${k}$, as it should.` },
      ],
    };
  }
  // Meeting a general plane: substitute the components into its equation.
  let n: number[];
  do n = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
  while (n[0]! * a[0]! + n[1]! * a[1]! + n[2]! * a[2]! === 0);
  const k = n[0]! * point[0]! + n[1]! * point[1]! + n[2]! * point[2]!;
  const planeTex = poly([[n[0]!, "x"], [n[1]!, "y"], [n[2]!, "z"]]);
  const coefT = n[0]! * a[0]! + n[1]! * a[1]! + n[2]! * a[2]!;
  const constant = n[0]! * b[0]! + n[1]! * b[1]! + n[2]! * b[2]!;
  return {
    prompt: md`For which value of $t$ is the point $\mathbf{r}(t) = ${rt}$ on the plane $${planeTex} = ${k}$?`,
    answer: String(t0),
    verify: [`${n[0]}*(${a[0]}*t + ${par(b[0]!)}) + ${n[1]}*(${a[1]}*t + ${par(b[1]!)}) + ${n[2]}*(${a[2]}*t + ${par(b[2]!)}) = ${k}`],
    hint: md`A point $(x, y, z)$ is on the plane when its coordinates satisfy the plane's equation. The coordinates of $\mathbf{r}(t)$ are its components, so substitute them for $x$, $y$ and $z$.`,
    solution: [
      { math: `${n[0]}(${comps[0]}) ${n[1]! < 0 ? "-" : "+"} ${Math.abs(n[1]!)}(${comps[1]}) ${n[2]! < 0 ? "-" : "+"} ${Math.abs(n[2]!)}(${comps[2]}) = ${k}`, note: md`Put $x = ${comps[0]}$, $y = ${comps[1]}$, $z = ${comps[2]}$ into $${planeTex} = ${k}$.` },
      { math: `${poly([[coefT, "t"], [constant, ""]])} = ${k}`, note: "Collect the t terms and the constants." },
      { math: `t = ${t0}`, note: md`Check: $\mathbf{r}(${t0}) = ${vec(...point)}$ and $${n[0]}(${par(point[0]!)}) ${n[1]! < 0 ? "-" : "+"} ${Math.abs(n[1]!)}(${par(point[1]!)}) ${n[2]! < 0 ? "-" : "+"} ${Math.abs(n[2]!)}(${par(point[2]!)}) = ${k}$.` },
    ],
  };
};

interface LimitItem {
  tex: string;
  value: string;
  valueTex: string;
  why: string;
}

function limitItem(kind: number, r: Rng): LimitItem {
  const k = r.int(2, 5);
  switch (kind) {
    case 0:
      return { tex: `\\frac{\\sin(${k}t)}{t}`, value: String(k), valueTex: String(k), why: md`$\frac{\sin(${k}t)}{t} = ${k} \cdot \frac{\sin(${k}t)}{${k}t}$, and $\frac{\sin u}{u} \to 1$ as $u \to 0$. So the limit is $${k}$.` };
    case 1:
      return { tex: `\\frac{\\tan(${k}t)}{t}`, value: String(k), valueTex: String(k), why: md`$\frac{\tan(${k}t)}{t} = \frac{\sin(${k}t)}{${k}t} \cdot \frac{${k}}{\cos(${k}t)} \to 1 \cdot ${k}$.` };
    case 2:
      return { tex: `\\frac{e^{${k}t} - 1}{t}`, value: String(k), valueTex: String(k), why: md`This is the derivative of $e^{${k}t}$ at $t = 0$, which is $${k}e^0 = ${k}$. (Or use L'Hôpital.)` };
    case 3:
      return { tex: `\\frac{1 - \\cos(t)}{t^2}`, value: "1/2", valueTex: "\\tfrac{1}{2}", why: md`Multiply top and bottom by $1 + \cos t$: $\frac{\sin^2 t}{t^2(1 + \cos t)} \to 1 \cdot \frac{1}{2}$.` };
    case 4:
      return { tex: `\\frac{\\ln(1 + ${k}t)}{t}`, value: String(k), valueTex: String(k), why: md`This is the derivative of $\ln(1 + ${k}t)$ at $t = 0$: $\frac{${k}}{1 + 0} = ${k}$.` };
    case 5:
      return { tex: `\\frac{t^2 + ${k}t}{t}`, value: String(k), valueTex: String(k), why: md`Cancel $t$: $t + ${k} \to ${k}$.` };
    case 6:
      return { tex: `\\cos(${k}t)`, value: "1", valueTex: "1", why: md`Cosine is continuous, so just substitute: $\cos 0 = 1$.` };
    case 7:
      return { tex: `e^{t} + ${k}`, value: String(k + 1), valueTex: String(k + 1), why: md`Continuous, so substitute $t = 0$: $1 + ${k} = ${k + 1}$.` };
    default:
      return { tex: `\\frac{\\sqrt{1 + ${k}t} - 1}{t}`, value: frac(k, 2), valueTex: fracTex(k, 2), why: md`Multiply by the conjugate: $\frac{${k}t}{t(\sqrt{1 + ${k}t} + 1)} = \frac{${k}}{\sqrt{1 + ${k}t} + 1} \to \frac{${k}}{2}$.` };
  }
}

const vectorLimit: Generator = (r) => {
  const kinds = shuffle(r, [0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 3);
  const items = kinds.map((k) => limitItem(k, r));
  return {
    prompt: md`Find $\lim_{t \to 0} \mathbf{r}(t)$ for $\mathbf{r}(t) = ${vec(...items.map((i) => i.tex))}$. Give it as a vector $(x, y, z)$.`,
    answer: `(${items.map((i) => i.value).join(", ")})`,
    form: "tuple",
    hint: "The limit of a vector function is taken one component at a time. Each component is an ordinary one-variable limit from Calculus 1.",
    solution: [
      ...items.map((item, i) => ({ math: `\\lim_{t \\to 0} ${item.tex} = ${item.valueTex}`, note: md`${"xyz"[i]}-component. ${item.why}` })),
      { math: `\\lim_{t \\to 0} \\mathbf{r}(t) = ${vec(...items.map((i) => i.valueTex))}`, note: "Assemble the three component limits into one vector." },
    ],
  };
};

const vectorDomain: Generator = (r) => {
  const kind = r.int(0, 2);
  const a = r.int(-4, 3);
  const b = a + r.int(3, 6);
  const c = r.int(a + 1, b - 1);
  const filler = r.pick([
    { tex: "\\cos(t)", why: md`$\cos t$ is defined for every $t$.` },
    { tex: "t^2", why: md`$t^2$ is defined for every $t$.` },
    { tex: "e^{t}", why: md`$e^t$ is defined for every $t$.` },
  ]);
  const sqrtFrom = { tex: `\\sqrt{${tMinus(a)}}`, why: md`$\sqrt{${tMinus(a)}}$ needs $${tMinus(a)} \ge 0$, so $t \ge ${a}$.` };
  const lnTo = { tex: `\\ln(${minusT(b)})`, why: md`$\ln(${minusT(b)})$ needs $${minusT(b)} > 0$, so $t < ${b}$.` };
  const recip = { tex: `\\frac{1}{${tMinus(c)}}`, why: md`$\frac{1}{${tMinus(c)}}$ is defined except at $t = ${c}$.` };
  const lnFrom = { tex: `\\ln(${tMinus(a)})`, why: md`$\ln(${tMinus(a)})$ needs $${tMinus(a)} > 0$, so $t > ${a}$.` };
  const sqrtTo = { tex: `\\sqrt{${minusT(b)}}`, why: md`$\sqrt{${minusT(b)}}$ needs $${minusT(b)} \ge 0$, so $t \le ${b}$.` };
  let parts: { tex: string; why: string }[];
  let answer: string;
  let answerTex: string;
  if (kind === 0) {
    parts = shuffle(r, [sqrtFrom, lnTo, filler]);
    answer = `[${a}, ${b})`;
    answerTex = `[${a}, ${b})`;
  } else if (kind === 1) {
    parts = shuffle(r, [sqrtFrom, recip, filler]);
    answer = `[${a}, ${c}) U (${c}, inf)`;
    answerTex = `[${a}, ${c}) \\cup (${c}, \\infty)`;
  } else {
    parts = shuffle(r, [lnFrom, sqrtTo, recip]);
    answer = `(${a}, ${c}) U (${c}, ${b}]`;
    answerTex = `(${a}, ${c}) \\cup (${c}, ${b}]`;
  }
  return {
    prompt: md`Find the domain of $\mathbf{r}(t) = ${vec(...parts.map((p) => p.tex))}$. Give it in interval notation, like [1, 4) U (4, inf).`,
    answer,
    form: "inequality",
    hint: "The vector is defined only where all three components are. Find each component's condition, then keep the t values that satisfy every one of them.",
    solution: [
      ...parts.map((p) => ({ math: p.tex, note: p.why })),
      { math: answerTex, note: "Intersect the three conditions: the domain is where all of them hold at once." },
    ],
  };
};

// ── Lesson 2 generators: derivatives and integrals ──────────────────────────

interface Comp {
  tex: string;
  dTex: string;
  dText: string;
  rule: string;
}

function makeComp(kind: number, r: Rng): Comp {
  const k = r.int(2, 5);
  switch (kind) {
    case 0: {
      const a = r.coef(-5, 5);
      const n = r.int(2, 4);
      return { tex: mono(a, n), dTex: mono(a * n, n - 1), dText: monoText(a * n, n - 1), rule: md`Power rule: $(t^{${n}})' = ${n}t^{${n - 1}}$, times the constant $${a}$.` };
    }
    case 1:
      return { tex: `\\sin(${k}t)`, dTex: `${k}\\cos(${k}t)`, dText: `${k}cos(${k}t)`, rule: md`Chain rule: the derivative of $\sin(${k}t)$ is $\cos(${k}t)$ times the inner derivative $${k}$.` };
    case 2:
      return { tex: `\\cos(${k}t)`, dTex: `-${k}\\sin(${k}t)`, dText: `-${k}sin(${k}t)`, rule: md`Chain rule: $(\cos u)' = -\sin u \cdot u'$ with $u = ${k}t$.` };
    case 3:
      return { tex: `e^{${k}t}`, dTex: `${k}e^{${k}t}`, dText: `${k}e^(${k}t)`, rule: md`$(e^{u})' = e^{u} u'$ with $u = ${k}t$.` };
    case 4:
      return { tex: `t\\sin(t)`, dTex: `\\sin(t) + t\\cos(t)`, dText: `sin(t) + t cos(t)`, rule: md`Product rule: $(t)'\sin t + t(\sin t)'$.` };
    case 5:
      return { tex: `te^{t}`, dTex: `e^{t} + te^{t}`, dText: `e^t + t e^t`, rule: md`Product rule: $(t)' e^t + t (e^t)'$.` };
    case 6:
      return { tex: `\\ln(t^2 + 1)`, dTex: `\\frac{2t}{t^2 + 1}`, dText: `2t/(t^2 + 1)`, rule: md`$(\ln u)' = \frac{u'}{u}$ with $u = t^2 + 1$.` };
    case 7:
      return { tex: `\\sqrt{t^2 + ${k}}`, dTex: `\\frac{t}{\\sqrt{t^2 + ${k}}}`, dText: `t/sqrt(t^2 + ${k})`, rule: md`$(\sqrt{u})' = \frac{u'}{2\sqrt{u}}$ with $u = t^2 + ${k}$; the 2 cancels with $u' = 2t$.` };
    case 8:
      return { tex: `\\frac{1}{t}`, dTex: `-\\frac{1}{t^2}`, dText: `-1/t^2`, rule: md`$\frac{1}{t} = t^{-1}$, so the derivative is $-t^{-2}$.` };
    default:
      return { tex: `t^2\\cos(t)`, dTex: `2t\\cos(t) - t^2\\sin(t)`, dText: `2t cos(t) - t^2 sin(t)`, rule: md`Product rule: $(t^2)'\cos t + t^2(\cos t)'$.` };
  }
}

const differentiateComponent: Generator = (r) => {
  const kinds = shuffle(r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
  const comps = kinds.map((k) => makeComp(k, r));
  const i = r.int(0, 2);
  const name = "xyz"[i]!;
  const c = comps[i]!;
  return {
    prompt: md`Differentiate $${c.tex}$ with respect to $t$. It is the $${name}$-component of $\mathbf{r}(t) = ${vec(...comps.map((x) => x.tex))}$, so your answer is the $${name}$-component of $\mathbf{r}'(t)$.`,
    answer: c.dText,
    hint: md`A vector function is differentiated one component at a time, with the ordinary rules. ${c.rule}`,
    solution: [
      { math: `\\mathbf{r}'(t) = ${vec(...comps.map((x) => x.dTex))}`, note: "Differentiate each component with the one-variable rules." },
      { math: `\\frac{d}{dt}\\left[${c.tex}\\right] = ${c.dTex}`, note: c.rule },
    ],
  };
};

const derivativeAtPoint: Generator = (r) => {
  if (r.next() < 0.5) {
    // Polynomial components at an integer t.
    const t0 = r.pick([1, 2, -1]);
    const [a, b, c, d, e] = [r.coef(-3, 3), r.nonzero(-5, 5), r.coef(-3, 3), r.nonzero(-5, 5), r.int(-5, 5)];
    const comps = shuffle(r, [
      { tex: poly([[a, "t^2"], [b, "t"]]), dTex: poly([[2 * a, "t"], [b, ""]]), at: 2 * a * t0 + b, sub: `${2 * a}(${t0}) ${b < 0 ? "-" : "+"} ${Math.abs(b)}` },
      { tex: mono(c, 3), dTex: mono(3 * c, 2), at: 3 * c * t0 * t0, sub: `${3 * c}(${t0})^2` },
      { tex: poly([[d, "t"], [e, ""]]), dTex: String(d), at: d, sub: String(d) },
    ]);
    return {
      prompt: md`Find $\mathbf{r}'(${t0})$ when $\mathbf{r}(t) = ${vec(...comps.map((x) => x.tex))}$. Give it as a vector $(x, y, z)$.`,
      answer: `(${comps.map((x) => x.at).join(", ")})`,
      form: "tuple",
      hint: md`First find $\mathbf{r}'(t)$ by differentiating each component. Then substitute $t = ${t0}$.`,
      solution: [
        { math: `\\mathbf{r}'(t) = ${vec(...comps.map((x) => x.dTex))}`, note: "Differentiate component by component." },
        { math: `\\mathbf{r}'(${t0}) = ${vec(...comps.map((x) => x.sub))} = ${vec(...comps.map((x) => x.at))}`, note: md`Substitute $t = ${t0}$. This is the tangent vector to the curve at the point $\mathbf{r}(${t0})$.` },
      ],
    };
  }
  // Transcendental components at t = 0, where the values come out whole.
  const bank = [
    () => {
      const k = r.int(2, 6);
      return { tex: `\\sin(${k}t)`, dTex: `${k}\\cos(${k}t)`, at: k, sub: `${k}\\cos 0` };
    },
    () => {
      const k = r.int(2, 6);
      return { tex: `\\cos(${k}t)`, dTex: `-${k}\\sin(${k}t)`, at: 0, sub: `-${k}\\sin 0` };
    },
    () => {
      const k = r.int(2, 6);
      return { tex: `e^{${k}t}`, dTex: `${k}e^{${k}t}`, at: k, sub: `${k}e^{0}` };
    },
    () => {
      const k = r.nonzero(-6, 6);
      return { tex: poly([[1, "t^2"], [k, "t"]]), dTex: poly([[2, "t"], [k, ""]]), at: k, sub: `2(0) ${k < 0 ? "-" : "+"} ${Math.abs(k)}` };
    },
    () => {
      const k = r.int(2, 6);
      return { tex: `\\ln(1 + ${k}t)`, dTex: `\\frac{${k}}{1 + ${k}t}`, at: k, sub: `\\frac{${k}}{1 + 0}` };
    },
    () => {
      const a = r.coef(-4, 4);
      const b = r.nonzero(-6, 6);
      return { tex: poly([[a, "t^3"], [-b, "t"]]), dTex: poly([[3 * a, "t^2"], [-b, ""]]), at: -b, sub: `${3 * a}(0)^2 ${-b < 0 ? "-" : "+"} ${Math.abs(b)}` };
    },
  ];
  const comps = shuffle(r, bank).slice(0, 3).map((f) => f());
  return {
    prompt: md`Find $\mathbf{r}'(0)$ when $\mathbf{r}(t) = ${vec(...comps.map((x) => x.tex))}$. Give it as a vector $(x, y, z)$.`,
    answer: `(${comps.map((x) => x.at).join(", ")})`,
    form: "tuple",
    hint: md`Differentiate each component (chain rule where needed), then put in $t = 0$. Remember $\sin 0 = 0$, $\cos 0 = 1$, $e^0 = 1$.`,
    solution: [
      { math: `\\mathbf{r}'(t) = ${vec(...comps.map((x) => x.dTex))}`, note: "Differentiate component by component." },
      { math: `\\mathbf{r}'(0) = ${vec(...comps.map((x) => x.sub))} = ${vec(...comps.map((x) => x.at))}`, note: md`Substitute $t = 0$.` },
    ],
  };
};

const integrateComponent: Generator = (r) => {
  const kind = r.int(0, 2);
  const i = r.int(0, 2);
  const name = "xyz"[i]!;
  if (kind === 0) {
    // Definite integral of a polynomial component.
    const b = r.int(1, 3);
    const [p, q, s] = [r.coef(-4, 4), r.nonzero(-5, 5), r.nonzero(-4, 4)];
    const others = shuffle(r, [`${cf(s)}t`, `\\cos(t)`, `e^{t}`, `t^3`]).slice(0, 2);
    const comps = [...others];
    const target = poly([[p, "t^2"], [q, ""]]);
    comps.splice(i, 0, target);
    // ∫_0^b (p t^2 + q) dt = p b^3 / 3 + q b
    const num = p * b * b * b + 3 * q * b;
    return {
      prompt: md`Evaluate $\int_{0}^{${b}} (${target}) \, dt$. It is the $${name}$-component of the integral of $\mathbf{r}(t) = ${vec(...comps)}$ over $[0, ${b}]$.`,
      answer: frac(num, 3),
      hint: md`Integrate the component on its own with the one-variable rules: $\int t^2 \, dt = \frac{t^3}{3}$.`,
      solution: [
        { math: `\\left[${poly([[p, "\\tfrac{t^3}{3}"], [q, "t"]])}\\right]_0^{${b}}`, note: "Antidifferentiate term by term." },
        { math: `${cf(p)}\\frac{${b * b * b}}{3} ${q < 0 ? "-" : "+"} ${Math.abs(q)}(${b}) = ${fracTex(num, 3)}`, note: md`Evaluate at $${b}$; the lower limit $0$ contributes nothing.` },
      ],
    };
  }
  if (kind === 1) {
    // Definite integral of a trig or exponential component.
    const k = r.int(1, 3);
    const choice = r.int(0, 2);
    const item =
      choice === 0
        ? { tex: `\\sin(t)`, lo: "0", hi: "\\pi", answer: "2", anti: "-\\cos(t)", work: `-\\cos \\pi + \\cos 0 = 1 + 1 = 2` }
        : choice === 1
          ? { tex: `\\cos(t)`, lo: "0", hi: "\\pi/2", answer: "1", anti: "\\sin(t)", work: `\\sin\\tfrac{\\pi}{2} - \\sin 0 = 1` }
          : { tex: `e^{${k === 1 ? "" : k}t}`, lo: "0", hi: "1", answer: k === 1 ? "e - 1" : `(e^${k} - 1)/${k}`, anti: k === 1 ? "e^{t}" : `\\tfrac{1}{${k}}e^{${k}t}`, work: k === 1 ? `e^1 - e^0 = e - 1` : `\\tfrac{1}{${k}}(e^{${k}} - 1)` };
    const others = shuffle(r, [`t^2`, `${r.int(2, 5)}t`, `\\sqrt{t}`]).slice(0, 2);
    const comps = [...others];
    comps.splice(i, 0, item.tex);
    return {
      prompt: md`Evaluate $\int_{${item.lo}}^{${item.hi}} ${item.tex} \, dt$. It is the $${name}$-component of the integral of $\mathbf{r}(t) = ${vec(...comps)}$ over the same interval. Give an exact answer.`,
      answer: item.answer,
      hint: md`Each component of a vector integral is an ordinary definite integral. Find an antiderivative of $${item.tex}$ and evaluate it at the limits.`,
      solution: [
        { math: `\\left[${item.anti}\\right]_{${item.lo}}^{${item.hi}}`, note: "Antiderivative of the component." },
        { math: item.work, note: "Upper limit minus lower limit." },
      ],
    };
  }
  // Antiderivative with an initial condition read off separately: here just the antiderivative.
  const choice = r.int(0, 3);
  const k = r.int(2, 4);
  const a = r.coef(-4, 4);
  const c = r.nonzero(-5, 5);
  // Polynomial case: ∫ (a k t^{k-1} + c) dt = a t^k + c t.
  const item =
    choice === 0
      ? { tex: poly([[a * k, tpow(k - 1)], [c, ""]]), answer: poly([[a, tpowText(k)], [c, "t"]]), antiTex: poly([[a, tpow(k)], [c, "t"]]), rule: md`$\int t^{n} \, dt = \frac{t^{n+1}}{n+1}$ for each term.` }
      : choice === 1
        ? { tex: `\\cos(${k}t)`, answer: `sin(${k}t)/${k}`, antiTex: `\\frac{\\sin(${k}t)}{${k}}`, rule: md`$\int \cos(kt) \, dt = \frac{\sin(kt)}{k}$: the chain rule in reverse.` }
        : choice === 2
          ? { tex: `e^{${k}t}`, answer: `e^(${k}t)/${k}`, antiTex: `\\frac{e^{${k}t}}{${k}}`, rule: md`$\int e^{kt} \, dt = \frac{e^{kt}}{k}$.` }
          : { tex: `\\frac{${k}}{t}`, answer: `${k}ln(t)`, antiTex: `${k}\\ln t`, rule: md`$\int \frac{1}{t} \, dt = \ln|t|$; for $t > 0$ that is $\ln t$.` };
  const { answer, antiTex } = item;
  const others = shuffle(r, [`t^2`, `\\sin(t)`, `e^{t}`, `${r.int(2, 5)}t`]).slice(0, 2);
  const comps = [...others];
  comps.splice(i, 0, item.tex);
  return {
    prompt: md`Find $\int ${item.tex} \, dt$. It is the $${name}$-component of an antiderivative of $\mathbf{r}(t) = ${vec(...comps)}$${choice === 3 ? " for $t > 0$" : ""}. A constant of integration is optional.`,
    answer,
    upToConstant: true,
    hint: item.rule,
    solution: [
      { math: `\\int ${item.tex} \\, dt = ${antiTex} + C`, note: item.rule },
      { math: antiTex, note: "Any constant works, so this is one correct answer. In a vector antiderivative each component gets its own constant." },
    ],
  };
};

// ── Lesson 3 generators: arc length and curvature ───────────────────────────

const HELIX_PAIRS: [number, number][] = [[3, 4], [4, 3], [5, 12], [12, 5], [6, 8], [8, 6], [8, 15], [1, 1], [2, 2], [1, 2], [2, 1], [3, 1]];
const T_CHOICES: { tex: string; text: string; coef: number; piCoef: string; piCoefTex: string }[] = [
  { tex: "\\pi", text: "pi", coef: 1, piCoef: "", piCoefTex: "" },
  { tex: "2\\pi", text: "2pi", coef: 2, piCoef: "", piCoefTex: "" },
  { tex: "4\\pi", text: "4pi", coef: 4, piCoef: "", piCoefTex: "" },
  { tex: "\\tfrac{\\pi}{2}", text: "pi/2", coef: 1, piCoef: "/2 * ", piCoefTex: "/2 \\cdot " },
];

const helixLengthSetup: Generator = (r) => {
  const [a, b] = r.pick(HELIX_PAIRS);
  const T = r.pick(T_CHOICES.slice(0, 3));
  const rt = root(a * a + b * b);
  const zFirst = r.next() < 0.3;
  const A = cf(a);
  const A2 = cf(a * a);
  const comps = zFirst ? [`${cf(b)}t`, `${A}\\cos(t)`, `${A}\\sin(t)`] : [`${A}\\cos(t)`, `${A}\\sin(t)`, `${cf(b)}t`];
  const speedTex = zFirst ? `\\sqrt{${b * b} + ${A2}\\sin^2 t + ${A2}\\cos^2 t}` : `\\sqrt{${A2}\\sin^2 t + ${A2}\\cos^2 t + ${b * b}}`;
  // Length = T.coef * pi * k sqrt(m): "10pi", "2pi sqrt(2)", "pi sqrt(5)".
  const coef = T.coef * rt.k;
  const answer = rt.m === 1 ? `${coef}pi` : `${coef === 1 ? "" : coef}pi sqrt(${rt.m})`;
  const answerTex = rt.m === 1 ? `${coef}\\pi` : `${coef === 1 ? "" : coef}\\pi\\sqrt{${rt.m}}`;
  return {
    prompt: md`Find the length of the helix $\mathbf{r}(t) = ${vec(...comps)}$ for $0 \le t \le ${T.tex}$. Its speed is $|\mathbf{r}'(t)| = ${speedTex}$, so the length is $\int_{0}^{${T.tex}} ${speedTex} \, dt$. Give an exact answer, like 10pi or 2pi sqrt(2).`,
    answer,
    hint: md`Simplify under the square root first: $${A2}\sin^2 t + ${A2}\cos^2 t = ${a * a}$. The speed is constant, so the integral is speed times the length of the $t$ interval.`,
    solution: [
      { math: `|\\mathbf{r}'(t)| = \\sqrt{${A2}(\\sin^2 t + \\cos^2 t) + ${b * b}} = \\sqrt{${a * a + b * b}} = ${rt.tex}`, note: md`$\sin^2 t + \cos^2 t = 1$. The helix moves at constant speed.` },
      { math: `L = \\int_{0}^{${T.tex}} ${rt.tex} \\, dt = ${rt.tex} \\cdot ${T.tex} = ${answerTex}`, note: "A constant integrand integrates to the constant times the interval length." },
    ],
  };
};

const niceSpeedLength: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0) {
    const T = r.int(1, 3);
    const L = frac(T * T * T + 6 * T, 3);
    return {
      prompt: md`Find the length of the curve $\mathbf{r}(t) = ${vec("2t", "t^2", "\\tfrac{1}{3}t^3")}$ for $0 \le t \le ${T}$.`,
      answer: L,
      hint: md`$\mathbf{r}'(t) = \langle 2, 2t, t^2 \rangle$, and $4 + 4t^2 + t^4$ is a perfect square.`,
      solution: [
        { math: `\\mathbf{r}'(t) = \\langle 2, 2t, t^2 \\rangle`, note: "Differentiate each component." },
        { math: `|\\mathbf{r}'(t)| = \\sqrt{4 + 4t^2 + t^4} = \\sqrt{(t^2 + 2)^2} = t^2 + 2`, note: md`$(t^2 + 2)^2 = t^4 + 4t^2 + 4$. The root disappears.` },
        { math: `L = \\int_0^{${T}} (t^2 + 2) \\, dt = \\left[\\tfrac{t^3}{3} + 2t\\right]_0^{${T}} = ${fracTex(T * T * T + 6 * T, 3)}`, note: "Integrate the speed." },
      ],
    };
  }
  if (kind === 1) {
    const T = r.pick([2, 3]);
    return {
      prompt: md`Find the length of the curve $\mathbf{r}(t) = ${vec("t^2", "2t", "\\ln(t)")}$ for $1 \le t \le ${T}$. Give an exact answer.`,
      answer: `${T * T - 1} + ln(${T})`,
      hint: md`$\mathbf{r}'(t) = \langle 2t, 2, \tfrac{1}{t} \rangle$. Put $4t^2 + 4 + \tfrac{1}{t^2}$ over a common denominator, or notice it is $(2t + \tfrac{1}{t})^2$.`,
      solution: [
        { math: `\\mathbf{r}'(t) = \\left\\langle 2t, 2, \\tfrac{1}{t} \\right\\rangle`, note: "Differentiate each component." },
        { math: `|\\mathbf{r}'(t)| = \\sqrt{4t^2 + 4 + \\tfrac{1}{t^2}} = \\sqrt{\\left(2t + \\tfrac{1}{t}\\right)^2} = 2t + \\tfrac{1}{t}`, note: md`$(2t + \tfrac1t)^2 = 4t^2 + 4 + \tfrac{1}{t^2}$, and $2t + \tfrac1t > 0$ for $t \ge 1$.` },
        { math: `L = \\int_1^{${T}} \\left(2t + \\tfrac{1}{t}\\right) dt = \\left[t^2 + \\ln t\\right]_1^{${T}} = ${T * T - 1} + \\ln ${T}`, note: md`$\ln 1 = 0$.` },
      ],
    };
  }
  if (kind === 2) {
    const T = r.int(1, 2);
    return {
      prompt: md`Find the length of the curve $\mathbf{r}(t) = ${vec("e^{t}\\cos(t)", "e^{t}\\sin(t)", "e^{t}")}$ for $0 \le t \le ${T}$. Give an exact answer.`,
      answer: `sqrt(3)(e^${T} - 1)`,
      hint: md`Use the product rule on the first two components. When you square and add, every cross term cancels and $\sin^2 + \cos^2 = 1$ twice.`,
      solution: [
        { math: `\\mathbf{r}'(t) = \\langle e^t(\\cos t - \\sin t), e^t(\\sin t + \\cos t), e^t \\rangle`, note: "Product rule in the first two components." },
        { math: `|\\mathbf{r}'(t)|^2 = e^{2t}\\left[(\\cos t - \\sin t)^2 + (\\sin t + \\cos t)^2 + 1\\right] = e^{2t}(2 + 1) = 3e^{2t}`, note: md`$(\cos t - \sin t)^2 + (\sin t + \cos t)^2 = 2\cos^2 t + 2\sin^2 t = 2$.` },
        { math: `L = \\int_0^{${T}} \\sqrt{3}\\,e^{t} \\, dt = \\sqrt{3}\\,(e^{${T}} - 1)`, note: "Integrate the speed." },
      ],
    };
  }
  if (kind === 3) {
    const T = r.pick([1, 2, 3, 4]);
    return {
      prompt: md`Find the length of the curve $\mathbf{r}(t) = ${vec("t", "\\tfrac{2\\sqrt{2}}{3} t^{3/2}", "\\tfrac{1}{2}t^2")}$ for $0 \le t \le ${T}$.`,
      answer: frac(T * T + 2 * T, 2),
      hint: md`$\mathbf{r}'(t) = \langle 1, \sqrt{2}\,t^{1/2}, t \rangle$. Then $1 + 2t + t^2$ is a perfect square.`,
      solution: [
        { math: `\\mathbf{r}'(t) = \\langle 1, \\sqrt{2}\\,t^{1/2}, t \\rangle`, note: md`$\frac{2\sqrt2}{3} \cdot \frac{3}{2} t^{1/2} = \sqrt{2}\,t^{1/2}$.` },
        { math: `|\\mathbf{r}'(t)| = \\sqrt{1 + 2t + t^2} = t + 1`, note: md`$(t + 1)^2 = t^2 + 2t + 1$, and $t + 1 > 0$.` },
        { math: `L = \\int_0^{${T}} (t + 1) \\, dt = \\left[\\tfrac{t^2}{2} + t\\right]_0^{${T}} = ${fracTex(T * T + 2 * T, 2)}`, note: "Integrate the speed." },
      ],
    };
  }
  if (kind === 4) {
    const T = r.pick([1, 2, 3, 4]);
    const L = root(2);
    const half = T % 2 === 0;
    const answerTex = half ? `${T * T / 2 === 1 ? "" : T * T / 2}\\sqrt{2}` : `\\frac{${T === 1 ? "" : T * T}\\sqrt{2}}{2}`;
    return {
      prompt: md`Find the length of the curve $\mathbf{r}(t) = ${vec("\\cos(t) + t\\sin(t)", "\\sin(t) - t\\cos(t)", "\\tfrac{1}{2}t^2")}$ for $0 \le t \le ${T}$. Give an exact answer, like 3sqrt(2) or 5sqrt(2)/2.`,
      answer: half ? `${T * T / 2 === 1 ? "" : T * T / 2}sqrt(2)` : `${T === 1 ? "" : T * T}sqrt(2)/2`,
      hint: md`Differentiate carefully: most of the terms cancel, leaving $\mathbf{r}'(t) = \langle t\cos t, t\sin t, t \rangle$.`,
      solution: [
        { math: `\\mathbf{r}'(t) = \\langle -\\sin t + \\sin t + t\\cos t, \\cos t - \\cos t + t\\sin t, t \\rangle = \\langle t\\cos t, t\\sin t, t \\rangle`, note: "Product rule, then cancel." },
        { math: `|\\mathbf{r}'(t)| = \\sqrt{t^2\\cos^2 t + t^2\\sin^2 t + t^2} = \\sqrt{2t^2} = ${L.tex}\\,t`, note: md`$t \ge 0$ on the interval, so $\sqrt{t^2} = t$.` },
        { math: `L = \\int_0^{${T}} ${L.tex}\\,t \\, dt = ${L.tex} \\cdot \\frac{${T * T}}{2} = ${answerTex}`, note: "Integrate the speed." },
      ],
    };
  }
  const [a, b] = r.pick(HELIX_PAIRS.slice(0, 7));
  const T = r.pick(T_CHOICES);
  const c = Math.sqrt(a * a + b * b);
  const answer = T.text === "pi/2" ? `${c}pi/2` : `${c * T.coef}pi`;
  const answerTex = T.text === "pi/2" ? `\\tfrac{${c}\\pi}{2}` : `${c * T.coef}\\pi`;
  return {
    prompt: md`Find the length of the curve $\mathbf{r}(t) = ${vec(`${cf(b)}t`, `${a}\\cos(t)`, `${a}\\sin(t)`)}$ for $0 \le t \le ${T.tex}$. Give an exact answer.`,
    answer,
    hint: md`Find $\mathbf{r}'(t)$ and its magnitude. $\sin^2 t + \cos^2 t = 1$ will make the speed constant.`,
    solution: [
      { math: `\\mathbf{r}'(t) = \\langle ${b}, -${a}\\sin t, ${a}\\cos t \\rangle`, note: "Differentiate each component." },
      { math: `|\\mathbf{r}'(t)| = \\sqrt{${b * b} + ${a * a}\\sin^2 t + ${a * a}\\cos^2 t} = \\sqrt{${a * a + b * b}} = ${c}`, note: "Constant speed." },
      { math: `L = ${c} \\cdot ${T.tex} = ${answerTex}`, note: "Speed times the length of the parameter interval." },
    ],
  };
};

const curvatureAtPoint: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    // Parabola y = a x^2 + b x + c at x0, with f'(x0) chosen so (1 + f'^2)^{3/2} is tidy.
    const a = r.coef(-3, 3);
    const x0 = r.int(-2, 2);
    const p = r.pick([0, 0, 1, -1, 2, -2]);
    const b = p - 2 * a * x0;
    const c = r.int(-4, 4);
    const fTex = poly([[a, "x^2"], [b, "x"], [c, ""]]);
    const A = Math.abs(a);
    const kappa = p === 0 ? { text: String(2 * A), tex: String(2 * A) } : p * p === 1 ? { text: `${A}sqrt(2)/2`, tex: `\\frac{${A}\\sqrt{2}}{2}` } : { text: `${2 * A}sqrt(5)/25`, tex: `\\frac{${2 * A}\\sqrt{5}}{25}` };
    const denomTex = p === 0 ? "1" : p * p === 1 ? "2^{3/2} = 2\\sqrt{2}" : "5^{3/2} = 5\\sqrt{5}";
    return {
      prompt: md`Find the curvature of the parabola $y = ${fTex}$ at the point where $x = ${x0}$. Give an exact answer.`,
      answer: kappa.text,
      verify: [`k * (1 + ${par(p)}^2)^(3/2) = ${2 * A}`],
      hint: md`For a graph $y = f(x)$, $\kappa = \dfrac{|f''(x)|}{(1 + f'(x)^2)^{3/2}}$. Here $f'(${x0}) = ${p}$.`,
      solution: [
        { math: `f'(x) = ${poly([[2 * a, "x"], [b, ""]])}, \\quad f''(x) = ${2 * a}`, note: "Two derivatives." },
        { math: `f'(${x0}) = ${2 * a}(${x0}) ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${p}`, note: md`Substitute $x = ${x0}$.` },
        { math: `\\kappa = \\frac{|${2 * a}|}{(1 + ${par(p)}^2)^{3/2}} = \\frac{${2 * A}}{${denomTex}} = ${kappa.tex}`, note: p === 0 ? md`At a point with horizontal tangent, the curvature is just $|f''|$.` : "Rationalize the denominator for the final form." },
      ],
    };
  }
  if (kind === 1) {
    // Helix: kappa = a / (a^2 + b^2), constant.
    const [a, b] = r.pick(HELIX_PAIRS);
    const s = a * a + b * b;
    return {
      prompt: md`Find the curvature of the helix $\mathbf{r}(t) = ${vec(`${a}\\cos(t)`, `${a}\\sin(t)`, `${cf(b)}t`)}$. (It is the same at every point.)`,
      answer: frac(a, s),
      // |r' x r''| / |r'|^3 at t = 0: r' = <0, a, b>, r'' = <-a, 0, 0>, r' x r'' = <0, -ab, a^2>.
      verify: [`k * (sqrt(0^2 + ${a}^2 + ${b}^2))^3 = sqrt(0^2 + (${-a * b})^2 + (${a * a})^2)`],
      hint: md`Use $\kappa = \dfrac{|\mathbf{r}' \times \mathbf{r}''|}{|\mathbf{r}'|^3}$. Both magnitudes simplify with $\sin^2 t + \cos^2 t = 1$.`,
      solution: [
        { math: `\\mathbf{r}'(t) = \\langle -${a}\\sin t, ${a}\\cos t, ${b} \\rangle, \\quad \\mathbf{r}''(t) = \\langle -${a}\\cos t, -${a}\\sin t, 0 \\rangle`, note: "Two derivatives." },
        { math: `\\mathbf{r}' \\times \\mathbf{r}'' = \\langle ${a * b}\\sin t, -${a * b}\\cos t, ${a * a} \\rangle`, note: md`Determinant: $x$-component $${a}\cos t \cdot 0 - ${b}(-${a}\sin t)$, $y$-component $${b}(-${a}\cos t) - (-${a}\sin t)(0)$, $z$-component $${a * a}\sin^2 t + ${a * a}\cos^2 t$.` },
        { math: `|\\mathbf{r}' \\times \\mathbf{r}''| = \\sqrt{${a * a * b * b} + ${a ** 4}} = ${a}\\sqrt{${s}}, \\quad |\\mathbf{r}'| = \\sqrt{${s}}`, note: md`$${a * a * b * b} + ${a ** 4} = ${a * a}(${b * b} + ${a * a})$.` },
        { math: `\\kappa = \\frac{${a}\\sqrt{${s}}}{(\\sqrt{${s}})^3} = \\frac{${a}}{${s}}${gcd(a, s) > 1 ? ` = ${fracTex(a, s)}` : ""}`, note: md`$(\sqrt{${s}})^3 = ${s}\sqrt{${s}}$; one root cancels.` },
      ],
    };
  }
  // A parabola in a tilted plane: r(t) = <p t, q t^2, m t> at t = 0.
  const [p, m] = r.pick([[3, 4], [4, 3], [1, 0], [0, 1], [2, 0], [0, 2], [1, 1], [5, 12], [2, 1], [1, 2]]);
  const q = r.coef(-4, 4);
  const s = p * p + m * m;
  const rtS = root(s);
  const Q = Math.abs(q);
  const kappa = frac(2 * Q, s);
  const comps = [p === 0 ? "0" : `${cf(p)}t`, mono(q, 2), m === 0 ? "0" : `${cf(m)}t`];
  return {
    prompt: md`Find the curvature of $\mathbf{r}(t) = ${vec(...comps)}$ at $t = 0$.`,
    answer: kappa,
    verify: [`k * (sqrt(${p}^2 + 0^2 + ${m}^2))^3 = sqrt((${-2 * q * m})^2 + 0^2 + (${2 * p * q})^2)`],
    hint: md`$\kappa = \dfrac{|\mathbf{r}'(0) \times \mathbf{r}''(0)|}{|\mathbf{r}'(0)|^3}$. Find the two derivative vectors at $t = 0$ first; the cross product of two constant vectors is quick.`,
    solution: [
      { math: `\\mathbf{r}'(t) = \\langle ${p}, ${cf(2 * q)}t, ${m} \\rangle, \\quad \\mathbf{r}''(t) = \\langle 0, ${2 * q}, 0 \\rangle`, note: "Two derivatives." },
      { math: `\\mathbf{r}'(0) = \\langle ${p}, 0, ${m} \\rangle, \\quad \\mathbf{r}''(0) = \\langle 0, ${2 * q}, 0 \\rangle`, note: md`Substitute $t = 0$.` },
      { math: `\\mathbf{r}'(0) \\times \\mathbf{r}''(0) = \\langle ${-2 * q * m}, 0, ${2 * p * q} \\rangle, \\quad |\\mathbf{r}'(0) \\times \\mathbf{r}''(0)| = ${2 * Q}${rtS.tex === "1" ? "" : `\\cdot ${rtS.tex}`}`, note: md`$|\langle ${-2 * q * m}, 0, ${2 * p * q} \rangle| = ${2 * Q}\sqrt{${m * m} + ${p * p}}$.` },
      { math: `\\kappa = \\frac{${2 * Q}${rtS.tex === "1" ? "" : `\\sqrt{${s}}`}}{(\\sqrt{${s}})^3} = ${fracTex(2 * Q, s)}`, note: md`$|\mathbf{r}'(0)| = \sqrt{${s}}$, so $|\mathbf{r}'(0)|^3 = ${s}\sqrt{${s}}$.` },
    ],
  };
};

// ── Lesson 4 generators: motion ─────────────────────────────────────────────

const G = 9.8;
const deg = (d: number) => (d * Math.PI) / 180;

const projectile: Generator = (r) => {
  const v0 = r.pick([10, 12, 15, 18, 20, 24, 25, 30]);
  const alpha = r.pick([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);
  const kind = r.int(0, 3);
  const vx = v0 * Math.cos(deg(alpha));
  const vy = v0 * Math.sin(deg(alpha));
  const T = (2 * vy) / G;
  const eqs: Step = {
    math: `x(t) = ${v0}\\cos(${alpha}^\\circ)\\, t, \\qquad y(t) = ${v0}\\sin(${alpha}^\\circ)\\, t - 4.9t^2`,
    note: md`Integrate $\mathbf{a} = \langle 0, -9.8 \rangle$ twice with $\mathbf{v}(0) = \langle ${v0}\cos ${alpha}^\circ, ${v0}\sin ${alpha}^\circ \rangle$ and $\mathbf{r}(0) = \mathbf{0}$.`,
  };
  const setup = md`A ball is thrown from ground level at $${v0}$ m/s, at $${alpha}^\circ$ above the horizontal. Take $g = 9.8$ m/s$^2$ and ignore air resistance.`;
  if (kind === 0) {
    return {
      prompt: md`${setup} How long is the ball in the air? Round to two decimal places.`,
      answer: T.toFixed(2),
      tolerance: 0.005,
      hint: md`The ball lands when $y(t) = 0$ again. Factor $t$ out of $y(t)$.`,
      solution: [
        eqs,
        { math: `t(${v0}\\sin(${alpha}^\\circ) - 4.9t) = 0 \\;\\Rightarrow\\; t = \\frac{${v0}\\sin(${alpha}^\\circ)}{4.9}`, note: md`$t = 0$ is the launch; the other root is the landing.` },
        { math: `t = \\frac{${vy.toFixed(3)}}{4.9} \\approx ${T.toFixed(2)} \\text{ s}`, note: md`$${v0}\sin ${alpha}^\circ \approx ${vy.toFixed(3)}$.` },
      ],
    };
  }
  if (kind === 1) {
    const R = vx * T;
    return {
      prompt: md`${setup} How far from the launch point does it land? Round to two decimal places.`,
      answer: R.toFixed(2),
      tolerance: 0.005,
      hint: md`Find the flight time from $y(t) = 0$, then put it into $x(t)$. Or use $R = \frac{v_0^2 \sin 2\alpha}{g}$.`,
      solution: [
        eqs,
        { math: `T = \\frac{2 \\cdot ${v0}\\sin(${alpha}^\\circ)}{9.8} \\approx ${T.toFixed(4)}`, note: md`Landing time, from $y(T) = 0$.` },
        { math: `R = x(T) = ${v0}\\cos(${alpha}^\\circ) \\cdot T \\approx ${vx.toFixed(3)} \\cdot ${T.toFixed(4)} \\approx ${R.toFixed(2)} \\text{ m}`, note: md`Check with $R = \frac{${v0}^2 \sin ${2 * alpha}^\circ}{9.8} \approx ${((v0 * v0 * Math.sin(deg(2 * alpha))) / G).toFixed(2)}$.` },
      ],
    };
  }
  if (kind === 2) {
    const H = (vy * vy) / (2 * G);
    return {
      prompt: md`${setup} What is the greatest height it reaches? Round to two decimal places.`,
      answer: H.toFixed(2),
      tolerance: 0.005,
      hint: md`At the top, the vertical velocity $y'(t)$ is zero. Find that $t$ and substitute into $y(t)$.`,
      solution: [
        eqs,
        { math: `y'(t) = ${v0}\\sin(${alpha}^\\circ) - 9.8t = 0 \\;\\Rightarrow\\; t = \\frac{${vy.toFixed(3)}}{9.8} \\approx ${(vy / G).toFixed(4)}`, note: "The top is where the ball stops rising." },
        { math: `H = y\\!\\left(\\tfrac{v_0 \\sin\\alpha}{g}\\right) = \\frac{(v_0\\sin\\alpha)^2}{2g} = \\frac{${vy.toFixed(3)}^2}{19.6} \\approx ${H.toFixed(2)} \\text{ m}`, note: "Half of the flight time, by symmetry of the parabola." },
      ],
    };
  }
  // Launched from a height: the landing time is the positive root of a quadratic.
  const h0 = r.pick([5, 10, 15, 20]);
  const tLand = (vy + Math.sqrt(vy * vy + 2 * G * h0)) / G;
  return {
    prompt: md`A ball is thrown from the top of a ${h0} m building at $${v0}$ m/s, at $${alpha}^\circ$ above the horizontal. Take $g = 9.8$ m/s$^2$ and ignore air resistance. When does it hit the ground? Round to two decimal places.`,
    answer: tLand.toFixed(2),
    tolerance: 0.005,
    hint: md`Now $y(0) = ${h0}$, so $y(t) = ${h0} + ${v0}\sin(${alpha}^\circ)\, t - 4.9t^2$. Set it to zero and use the quadratic formula; keep the positive root.`,
    solution: [
      { math: `y(t) = ${h0} + ${v0}\\sin(${alpha}^\\circ)\\, t - 4.9t^2`, note: md`Same acceleration, same initial velocity, but the starting height is $${h0}$.` },
      { math: `4.9t^2 - ${vy.toFixed(3)}\\,t - ${h0} = 0`, note: md`$${v0}\sin ${alpha}^\circ \approx ${vy.toFixed(3)}$. Set $y = 0$.` },
      { math: `t = \\frac{${vy.toFixed(3)} + \\sqrt{${vy.toFixed(3)}^2 + 4(4.9)(${h0})}}{9.8} \\approx ${tLand.toFixed(2)} \\text{ s}`, note: "Quadratic formula. The negative root is before the throw, so discard it." },
    ],
  };
};

const speedAtTime: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [a, b, c] = [r.coef(-3, 3), r.nonzero(-6, 6), r.coef(-2, 2)];
    const t0 = r.int(1, 2);
    const v = [2 * a * t0, b, 3 * c * t0 * t0];
    const s2 = v[0]! ** 2 + v[1]! ** 2 + v[2]! ** 2;
    const sp = root(s2);
    return {
      prompt: md`A particle moves along $\mathbf{r}(t) = ${vec(mono(a, 2), poly([[b, "t"]]), mono(c, 3))}$. Find its speed at $t = ${t0}$. Give an exact answer.`,
      answer: sp.text,
      verify: [`s^2 = (${v[0]})^2 + (${v[1]})^2 + (${v[2]})^2`],
      hint: md`Speed is $|\mathbf{v}(t)| = |\mathbf{r}'(t)|$. Differentiate, substitute $t = ${t0}$, then take the magnitude.`,
      solution: [
        { math: `\\mathbf{v}(t) = \\mathbf{r}'(t) = ${vec(mono(2 * a, 1), String(b), mono(3 * c, 2))}`, note: "Velocity is the derivative of position." },
        { math: `\\mathbf{v}(${t0}) = ${vec(...v)}`, note: md`Substitute $t = ${t0}$.` },
        { math: `|\\mathbf{v}(${t0})| = \\sqrt{${v.map((x) => `${par(x)}^2`).join(" + ")}} = \\sqrt{${s2}}${sp.tex === `\\sqrt{${s2}}` ? "" : ` = ${sp.tex}`}`, note: "Speed is the magnitude of velocity." },
      ],
    };
  }
  if (kind === 1) {
    const [a, b] = r.pick(HELIX_PAIRS.slice(0, 7));
    const c = Math.sqrt(a * a + b * b);
    const w = r.pick([1, 1, 2]);
    const speed = c * w;
    return {
      prompt: md`A particle moves along the helix $\mathbf{r}(t) = ${vec(`${a}\\cos(${w === 1 ? "" : w}t)`, `${a}\\sin(${w === 1 ? "" : w}t)`, `${cf(b * w)}t`)}$. Find its speed. (It is the same at every $t$.)`,
      answer: String(speed),
      // |v| at t = 0: v = <0, a w, b w>.
      verify: [`s^2 = 0^2 + (${a * w})^2 + (${b * w})^2`],
      hint: md`Differentiate, then use $\sin^2 + \cos^2 = 1$ inside the square root.`,
      solution: [
        { math: `\\mathbf{v}(t) = \\langle -${a * w}\\sin(${w === 1 ? "" : w}t), ${a * w}\\cos(${w === 1 ? "" : w}t), ${b * w} \\rangle`, note: "Chain rule in the first two components." },
        { math: `|\\mathbf{v}(t)| = \\sqrt{${a * a * w * w}(\\sin^2 + \\cos^2) + ${b * b * w * w}} = \\sqrt{${(a * a + b * b) * w * w}} = ${speed}`, note: "Constant speed: the particle climbs the helix steadily." },
      ],
    };
  }
  const t0 = r.int(1, 3);
  return {
    prompt: md`A particle moves along $\mathbf{r}(t) = ${vec("t", "t^2", "\\tfrac{2}{3}t^3")}$. Find its speed at $t = ${t0}$.`,
    answer: String(1 + 2 * t0 * t0),
    verify: [`s^2 = 1^2 + (${2 * t0})^2 + (${2 * t0 * t0})^2`],
    hint: md`$\mathbf{v}(t) = \langle 1, 2t, 2t^2 \rangle$, and $1 + 4t^2 + 4t^4$ is a perfect square.`,
    solution: [
      { math: `\\mathbf{v}(t) = \\langle 1, 2t, 2t^2 \\rangle`, note: "Differentiate each component." },
      { math: `|\\mathbf{v}(t)| = \\sqrt{1 + 4t^2 + 4t^4} = \\sqrt{(1 + 2t^2)^2} = 1 + 2t^2`, note: md`$(1 + 2t^2)^2 = 1 + 4t^2 + 4t^4$.` },
      { math: `|\\mathbf{v}(${t0})| = 1 + 2(${t0})^2 = ${1 + 2 * t0 * t0}`, note: md`Substitute $t = ${t0}$.` },
    ],
  };
};

const accelerationComponents: Generator = (r) => {
  // r(t) = <a t, b t^2, c t> with a^2 + c^2 + 4 b^2 t0^2 a perfect square.
  const choice = r.pick<[[number, number], number]>([
    [[3, 0], 2],
    [[0, 3], 2],
    [[3, 4], 6],
    [[4, 3], 6],
    [[5, 0], 6],
    [[0, 5], 6],
    [[6, 0], 4],
    [[0, 6], 4],
    [[8, 0], 3],
    [[0, 8], 3],
  ]);
  const [[a, c], bt] = choice;
  const pairs: [number, number][] = [];
  for (let b = 1; b <= bt; b++) if (bt % b === 0) pairs.push([b, bt / b]);
  const [bAbs, t0] = r.pick(pairs);
  const b = bAbs * r.sign();
  const v = [a, 2 * b * t0, c];
  const acc = [0, 2 * b, 0];
  const speed = Math.sqrt(v[0]! ** 2 + v[1]! ** 2 + v[2]! ** 2);
  const dot = v[0]! * acc[0]! + v[1]! * acc[1]! + v[2]! * acc[2]!;
  const cross = [v[1]! * acc[2]! - v[2]! * acc[1]!, v[2]! * acc[0]! - v[0]! * acc[2]!, v[0]! * acc[1]! - v[1]! * acc[0]!];
  const crossMag2 = cross[0]! ** 2 + cross[1]! ** 2 + cross[2]! ** 2;
  const crossMag = Math.sqrt(crossMag2);
  const aT = frac(dot, speed);
  const aN = frac(crossMag, speed);
  const comps = [a === 0 ? "0" : `${cf(a)}t`, mono(b, 2), c === 0 ? "0" : `${cf(c)}t`];
  return {
    prompt: md`A particle moves along $\mathbf{r}(t) = ${vec(...comps)}$. At $t = ${t0}$, find the tangential and normal components of its acceleration. Give them as $(a_T, a_N)$.`,
    answer: `(${aT}, ${aN})`,
    form: "tuple",
    // (p, q) = (a_T, a_N): a_T |v| = v . a, and a_T^2 + a_N^2 = |a|^2. Both equations must mention both letters.
    verify: [`p * sqrt(${v.map((x) => `${par(x)}^2`).join(" + ")}) + 0*q = ${v.map((x, i) => `${par(x)}*${par(acc[i]!)}`).join(" + ")}`, `p^2 + q^2 = ${acc.map((x) => `${par(x)}^2`).join(" + ")}`],
    hint: md`$a_T = \dfrac{\mathbf{v} \cdot \mathbf{a}}{|\mathbf{v}|}$ and $a_N = \dfrac{|\mathbf{v} \times \mathbf{a}|}{|\mathbf{v}|}$. Find $\mathbf{v}(${t0})$ and $\mathbf{a}(${t0})$ first.`,
    solution: [
      { math: `\\mathbf{v}(t) = ${vec(String(a), mono(2 * b, 1), String(c))}, \\quad \\mathbf{a}(t) = ${vec(0, 2 * b, 0)}`, note: "Velocity and acceleration are the first two derivatives." },
      { math: `\\mathbf{v}(${t0}) = ${vec(...v)}, \\quad |\\mathbf{v}(${t0})| = \\sqrt{${v.map((x) => `${par(x)}^2`).join(" + ")}} = ${speed}`, note: md`Substitute $t = ${t0}$. The speed comes out whole.` },
      { math: `a_T = \\frac{\\mathbf{v} \\cdot \\mathbf{a}}{|\\mathbf{v}|} = \\frac{${dot}}{${speed}} = ${fracTex(dot, speed)}`, note: md`$\mathbf{v} \cdot \mathbf{a} = ${v.map((x, i) => `(${x})(${acc[i]})`).join(" + ")} = ${dot}$. Positive: the particle is speeding up.` },
      { math: `\\mathbf{v} \\times \\mathbf{a} = ${vec(...cross)}, \\quad |\\mathbf{v} \\times \\mathbf{a}| = \\sqrt{${crossMag2}} = ${crossMag}`, note: "Cross product by the determinant." },
      { math: `a_N = \\frac{|\\mathbf{v} \\times \\mathbf{a}|}{|\\mathbf{v}|} = \\frac{${crossMag}}{${speed}} = ${fracTex(crossMag, speed)}`, note: md`Check: $a_T^2 + a_N^2 = ${fracTex(dot * dot + crossMag2, speed * speed)} = |\mathbf{a}|^2 = ${4 * b * b}$.` },
    ],
  };
};

// ── Figures ─────────────────────────────────────────────────────────────────

/** Chords on a quarter circle of radius 2: the polygon approximation to arc length. */
function chordPlot(): Block {
  const n = 4;
  const pts = Array.from({ length: n + 1 }, (_, i) => [2 * Math.cos((i * Math.PI) / (2 * n)), 2 * Math.sin((i * Math.PI) / (2 * n))] as [number, number]);
  const f = (v: number) => v.toFixed(4);
  return {
    kind: "plot",
    x: [-0.4, 2.6],
    y: [-0.4, 2.6],
    parametric: [
      { x: "2cos(t)", y: "2sin(t)", t: [0, Math.PI / 2], label: "\\text{arc}", color: 1 },
      ...pts.slice(0, -1).map(([x0, y0], i) => {
        const [x1, y1] = pts[i + 1]!;
        return { x: `${f(x0)} + t*(${f(x1 - x0)})`, y: `${f(y0)} + t*(${f(y1 - y0)})`, t: [0, 1] as [number, number], color: 2 as const, dashed: true };
      }),
    ],
    points: pts.map(([x, y], i) => ({ x, y, label: `\\mathbf{r}(t_{${i}})`, color: 2 as const })),
    caption: md`A quarter circle of radius 2 cut at four equally spaced parameter values. The four chords total about 3.12; the arc is $\pi \approx 3.14$. More chords, closer fit.`,
  };
}

// ── The unit ────────────────────────────────────────────────────────────────

export const unit2: Unit = {
  title: "Vector-Valued Functions",
  lessons: [
    {
      id: slug("Space curves"),
      title: "Space curves",
      summary: "A vector-valued function hands you a vector for each t; its tip traces a curve in space. Sketching by projections, parametrizing lines and circles, and limits taken component by component.",
      blocks: [
        {
          kind: "text",
          body: md`Unit 1 was about fixed vectors: one arrow, one direction. Now let the vector change with a number $t$. A **vector-valued function** is

$$\mathbf{r}(t) = \langle f(t), g(t), h(t) \rangle = f(t)\,\mathbf{i} + g(t)\,\mathbf{j} + h(t)\,\mathbf{k},$$

where $f$, $g$, $h$ are ordinary real functions, the **components**. Put the tail of $\mathbf{r}(t)$ at the origin. As $t$ runs through its domain, the tip moves, and the path it traces is a **space curve**. Writing $x = f(t)$, $y = g(t)$, $z = h(t)$ gives the same curve as **parametric equations**; the vector form just packages them.

It helps to think of $t$ as time. Then $\mathbf{r}(t)$ is where a moving point is at time $t$, and the function is both the path and the schedule for travelling it.

The **domain** of $\mathbf{r}$ is every $t$ for which all three components are defined. For $\mathbf{r}(t) = \langle \sqrt{t}, \ln(4 - t), \frac{1}{t - 2} \rangle$ that is $t \ge 0$, $t < 4$ and $t \ne 2$ all at once: $[0, 2) \cup (2, 4)$.`,
        },
        {
          kind: "key",
          title: "Vector-valued function",
          body: md`$\mathbf{r}(t) = \langle f(t), g(t), h(t) \rangle$ assigns a vector to each $t$ in its domain. The tip of $\mathbf{r}(t)$ traces the curve $x = f(t)$, $y = g(t)$, $z = h(t)$. Everything about $\mathbf{r}$ is read off one component at a time, and the domain is where all three components make sense.`,
        },
        {
          kind: "plot",
          x: [-2.6, 2.6],
          y: [-1.6, 1.6],
          parametric: [
            { x: "2cos(t)", y: "sin(t)", t: [0, 2 * Math.PI], label: "\\mathbf{r}(t) = \\langle 2\\cos t, \\sin t \\rangle", color: 1 },
            { x: "2t cos(a)", y: "t sin(a)", t: [0, 1], color: 2 },
          ],
          points: [{ x: "2cos(a)", y: "sin(a)", label: "\\mathbf{r}({a})", color: 2 }],
          params: [{ name: "a", tex: "t", min: 0, max: 6.3, step: 0.05, value: 1 }],
          caption: md`A plane curve first: $\mathbf{r}(t) = \langle 2\cos t, \sin t \rangle$. Drag $t$ and watch the position vector (orange) sweep out the ellipse. The curve is the set of tips; the function also says *when* each point is reached.`,
        },
        {
          kind: "text",
          body: md`The most important space curve is the **helix**

$$\mathbf{r}(t) = \langle \cos t, \sin t, ct \rangle, \qquad c > 0.$$

Its first two components satisfy $x^2 + y^2 = \cos^2 t + \sin^2 t = 1$, so every point of the curve lies on the cylinder of radius 1 around the $z$-axis. Meanwhile $z = ct$ rises steadily. The point circles the cylinder and climbs at the same time: a spiral staircase. Each full turn ($t$ increasing by $2\pi$) raises it by $2\pi c$.`,
        },
        {
          kind: "why",
          title: "Why projections tell you the shape",
          body: md`We can't draw in three dimensions, so we look at **shadows**. Dropping the $z$-component gives the curve's shadow on the $xy$-plane: the plane curve $x = f(t)$, $y = g(t)$. Dropping $y$ gives the shadow on the $xz$-plane, and so on.

Two shadows pin the curve down. A point of the curve sits directly above its $xy$-shadow, at a height given by the $xz$-shadow at the same $t$. For the helix, the $xy$-shadow is the unit circle traced over and over, and the $xz$-shadow is the wave $x = \cos t$, $z = ct$. Together: circle around, rise steadily, a helix.

Eliminating $t$ between two components does the same job algebraically. $x^2 + y^2 = 1$ is the $xy$-shadow of the helix with $t$ removed; it tells you the curve lives on that cylinder.`,
        },
        {
          kind: "plot",
          x: [-1.6, 1.6],
          y: [-1.6, 1.6],
          parametric: [{ x: "cos(t)", y: "sin(t)", t: [0, 4 * Math.PI], label: "xy\\text{-shadow}", color: 1 }],
          caption: md`The helix seen from above: its $xy$-shadow is the unit circle, traced twice as $t$ runs from $0$ to $4\pi$.`,
        },
        {
          kind: "plot",
          x: [-1.6, 1.6],
          y: [-0.3, 6.6],
          parametric: [{ x: "cos(t)", y: "c t", t: [0, 4 * Math.PI], label: "xz\\text{-shadow}", color: 2 }],
          params: [{ name: "c", tex: "c", min: 0.1, max: 0.5, step: 0.05, value: 0.25 }],
          caption: md`The same helix seen from the side: its $xz$-shadow is $x = \cos t$, $z = ct$, a wave climbing the page. One turn rises $2\pi c \approx$ {=2 pi c}. Combine the two shadows in your head: circle around while climbing.`,
        },
        {
          kind: "plot",
          x: [-1.6, 1.6],
          y: [-2.2, 2.6],
          curves: [
            { expr: "x^2", label: "xy\\text{-shadow: } y = x^2", color: 1 },
            { expr: "x^3", label: "xz\\text{-shadow: } z = x^3", color: 2, dashed: true },
          ],
          caption: md`The **twisted cubic** $\mathbf{r}(t) = \langle t, t^2, t^3 \rangle$. Since $x = t$, eliminating $t$ is easy: the $xy$-shadow is the parabola $y = x^2$ and the $xz$-shadow is $z = x^3$. The curve rises along the parabola's trough on one side and dives below it on the other.`,
        },
        {
          kind: "why",
          title: "Why one curve has many parametrizations",
          body: md`$\langle \cos t, \sin t \rangle$ and $\langle \cos 2t, \sin 2t \rangle$ for $0 \le t \le 2\pi$ trace the same unit circle. The second goes around twice as fast, and twice. $\langle \cos t, -\sin t \rangle$ traces it clockwise. $\langle \frac{1 - t^2}{1 + t^2}, \frac{2t}{1 + t^2} \rangle$ traces all of it but one point, with $t$ running over every real number.

So a parametrization is more than the curve: it is a curve plus a way of moving along it. The same set of points can be given many schedules. When we later measure speed, the schedule matters; when we measure length, only the curve does. Keep the two ideas separate and much of this unit becomes obvious.`,
        },
        {
          kind: "example",
          title: "Parametrizing a line and finding where it meets a plane",
          problem: md`Write the line through $P = (1, -2, 3)$ with direction $\mathbf{v} = \langle 2, 1, -1 \rangle$ as a vector function, and find where it meets the plane $z = -1$.`,
          steps: [
            { math: `\\mathbf{r}(t) = \\langle 1, -2, 3 \\rangle + t\\langle 2, 1, -1 \\rangle = \\langle 1 + 2t, -2 + t, 3 - t \\rangle`, note: md`Unit 1: start at $P$, add any multiple of $\mathbf{v}$. Here $t$ is not time but how many copies of $\mathbf{v}$ you walk.` },
            { math: `3 - t = -1 \\;\\Rightarrow\\; t = 4`, note: md`On the plane $z = -1$ exactly when the $z$-component is $-1$.` },
            { math: `\\mathbf{r}(4) = \\langle 9, 2, -1 \\rangle`, note: md`Substitute $t = 4$ into all three components. The meeting point is $(9, 2, -1)$.` },
          ],
        },
        {
          kind: "example",
          title: "The curve where two surfaces meet",
          problem: md`Parametrize the curve where the cylinder $x^2 + y^2 = 4$ meets the plane $z = 2 - y$.`,
          steps: [
            { math: `x = 2\\cos t, \\quad y = 2\\sin t`, note: md`Any point of the cylinder has $(x, y)$ on the circle of radius 2. That is the natural way to walk around a circle, with $0 \le t \le 2\pi$.` },
            { math: `z = 2 - y = 2 - 2\\sin t`, note: "The plane tells you the height once you know y." },
            { math: `\\mathbf{r}(t) = \\langle 2\\cos t, 2\\sin t, 2 - 2\\sin t \\rangle, \\quad 0 \\le t \\le 2\\pi`, note: "A tilted ellipse sitting on the cylinder. Its xy-shadow is the circle; its yz-shadow is the line z = 2 - y." },
          ],
        },
        {
          kind: "text",
          body: md`**Limits.** We want $\lim_{t \to a} \mathbf{r}(t) = \mathbf{L}$ to mean the usual thing: $\mathbf{r}(t)$ gets as close to $\mathbf{L}$ as we like once $t$ is close enough to $a$. "Close" for vectors is measured by length, so the definition is

$$\lim_{t \to a} \mathbf{r}(t) = \mathbf{L} \quad\text{means}\quad \lim_{t \to a} |\mathbf{r}(t) - \mathbf{L}| = 0.$$

That is a limit of ordinary numbers, so it is already defined. In practice we never use it directly, because of the next theorem.`,
        },
        {
          kind: "proof",
          title: "Limits are taken component by component",
          given: md`$\mathbf{r}(t) = \langle f(t), g(t), h(t) \rangle$ and $\mathbf{L} = \langle a_1, a_2, a_3 \rangle$`,
          prove: md`$\mathbf{r}(t) \to \mathbf{L}$ as $t \to a$ if and only if $f(t) \to a_1$, $g(t) \to a_2$ and $h(t) \to a_3$`,
          steps: [
            { statement: md`$|\mathbf{r}(t) - \mathbf{L}| = \sqrt{(f - a_1)^2 + (g - a_2)^2 + (h - a_3)^2}$`, reason: "Length of a vector (Unit 1), applied to the difference" },
            { statement: md`$|f(t) - a_1| \le |\mathbf{r}(t) - \mathbf{L}|$, and likewise for $g$ and $h$`, reason: md`A sum of squares is at least any one of them, so $\sqrt{(f - a_1)^2 + \dots} \ge \sqrt{(f - a_1)^2}$` },
            { statement: md`If $|\mathbf{r}(t) - \mathbf{L}| \to 0$ then $|f(t) - a_1| \to 0$, so $f(t) \to a_1$; same for $g$, $h$`, reason: "Squeeze: a quantity trapped between 0 and something going to 0 goes to 0" },
            { statement: md`$|\mathbf{r}(t) - \mathbf{L}| \le |f - a_1| + |g - a_2| + |h - a_3|$`, reason: md`Square both sides: the right side's square has the same three squares plus non-negative cross terms` },
            { statement: md`If $f \to a_1$, $g \to a_2$, $h \to a_3$ then the right side $\to 0$, so $|\mathbf{r}(t) - \mathbf{L}| \to 0$`, reason: "Sum of three limits, then squeeze" },
          ],
        },
        {
          kind: "key",
          title: "Limits and continuity of vector functions",
          body: md`$$\lim_{t \to a} \mathbf{r}(t) = \left\langle \lim_{t \to a} f(t), \lim_{t \to a} g(t), \lim_{t \to a} h(t) \right\rangle,$$

provided each component limit exists; if any one fails, the vector limit does not exist. $\mathbf{r}$ is **continuous** at $a$ when $\lim_{t \to a} \mathbf{r}(t) = \mathbf{r}(a)$, which happens exactly when all three components are continuous at $a$. A continuous $\mathbf{r}$ traces an unbroken curve.`,
        },
        {
          kind: "example",
          title: "A vector limit",
          problem: md`Find $\lim_{t \to 0} \left\langle \dfrac{\sin 3t}{t}, \dfrac{e^{2t} - 1}{t}, \cos t \right\rangle$.`,
          steps: [
            { math: `\\lim_{t \\to 0} \\frac{\\sin 3t}{t} = \\lim_{t \\to 0} 3 \\cdot \\frac{\\sin 3t}{3t} = 3`, note: md`The standard limit $\frac{\sin u}{u} \to 1$ with $u = 3t$.` },
            { math: `\\lim_{t \\to 0} \\frac{e^{2t} - 1}{t} = 2`, note: md`This is the definition of the derivative of $e^{2t}$ at $0$, which is $2e^0 = 2$. L'Hôpital gives the same.` },
            { math: `\\lim_{t \\to 0} \\cos t = 1`, note: "Cosine is continuous: substitute." },
            { math: `\\lim_{t \\to 0} \\mathbf{r}(t) = \\langle 3, 2, 1 \\rangle`, note: "Three component limits make one vector limit." },
          ],
        },
        {
          kind: "check",
          prompt: md`For $\mathbf{r}(t) = \langle t^2, 3t - 1, 2t \rangle$, find the point $\mathbf{r}(2)$. Type it as (x, y, z).`,
          answer: "(4, 5, 4)",
          form: "tuple",
          explain: md`Substitute $t = 2$ into each component: $2^2 = 4$, $3(2) - 1 = 5$, $2(2) = 4$.`,
        },
        {
          kind: "check",
          prompt: md`Find $\lim_{t \to 0} \left\langle \dfrac{\sin 2t}{t}, \cos t, t + 3 \right\rangle$. Type it as (x, y, z).`,
          answer: "(2, 1, 3)",
          form: "tuple",
          explain: md`Component by component: $\frac{\sin 2t}{t} = 2 \cdot \frac{\sin 2t}{2t} \to 2$; $\cos t \to 1$; $t + 3 \to 3$.`,
        },
      ],
      practice: [lineMeetsPlane, vectorLimit, vectorDomain],
    },
    {
      id: slug("Derivatives and integrals of curves"),
      title: "Derivatives and integrals of curves",
      summary: "The derivative of a curve is a tangent vector, found one component at a time. Product rules carry over, a curve of constant length is perpendicular to its derivative, and integrals are component-wise too.",
      blocks: [
        {
          kind: "text",
          body: md`Take two nearby points on a curve, $\mathbf{r}(t)$ and $\mathbf{r}(t + h)$. The vector from one to the other, $\mathbf{r}(t + h) - \mathbf{r}(t)$, is a chord of the curve. Divide by $h$ and let $h \to 0$:

$$\mathbf{r}'(t) = \lim_{h \to 0} \frac{\mathbf{r}(t + h) - \mathbf{r}(t)}{h}.$$

The chord swings into the tangent direction as $h$ shrinks, and dividing by $h$ keeps its length from collapsing to zero. The limit, when it exists, is the **derivative** of $\mathbf{r}$: a vector tangent to the curve at $\mathbf{r}(t)$, pointing the way $t$ increases. It is the exact same definition as in Calculus 1, with a vector on top of the fraction instead of a number.`,
        },
        {
          kind: "plot",
          x: [-3.6, 3.6],
          y: [-2.4, 2.4],
          parametric: [
            { x: "2cos(t)", y: "sin(t)", t: [0, 2 * Math.PI], color: 1 },
            { x: "2cos(a) + t (2cos(a + h) - 2cos(a))/h", y: "sin(a) + t (sin(a + h) - sin(a))/h", t: [0, 1], label: "\\frac{\\mathbf{r}(t+h) - \\mathbf{r}(t)}{h}", color: 2 },
            { x: "2cos(a) - 2t sin(a)", y: "sin(a) + t cos(a)", t: [0, 1], label: "\\mathbf{r}'(t)", color: 3, dashed: true },
          ],
          points: [
            { x: "2cos(a)", y: "sin(a)", label: "\\mathbf{r}(t)", color: 2 },
            { x: "2cos(a + h)", y: "sin(a + h)", label: "\\mathbf{r}(t + h)", color: 2, open: true },
          ],
          params: [
            { name: "a", tex: "t", min: 0, max: 6.3, step: 0.05, value: 0.8 },
            { name: "h", tex: "h", min: 0.05, max: 1.5, step: 0.05, value: 1 },
          ],
          caption: md`On $\mathbf{r}(t) = \langle 2\cos t, \sin t \rangle$: the orange arrow is the difference quotient $\frac{\mathbf{r}(t+h) - \mathbf{r}(t)}{h}$, the green dashed arrow is $\mathbf{r}'(t) = \langle -2\sin t, \cos t \rangle$. Slide $h$ toward $0$ and watch the orange arrow settle onto the green one.`,
        },
        {
          kind: "why",
          title: "Why the derivative is computed component by component",
          body: md`Subtracting vectors and dividing by a number both happen in each component separately:

$$\frac{\mathbf{r}(t + h) - \mathbf{r}(t)}{h} = \left\langle \frac{f(t+h) - f(t)}{h}, \frac{g(t+h) - g(t)}{h}, \frac{h(t+h) - h(t)}{h} \right\rangle.$$

Each component is an ordinary difference quotient. Last lesson we proved that a vector limit is the vector of component limits. So the limit of the left side exists exactly when all three component limits exist, and then

$$\mathbf{r}'(t) = \langle f'(t), g'(t), h'(t) \rangle.$$

Nothing new has to be learned to differentiate a curve. The new content is what the answer *means*: a tangent vector.`,
        },
        {
          kind: "key",
          title: "Derivative and tangent vector",
          body: md`$\mathbf{r}'(t) = \langle f'(t), g'(t), h'(t) \rangle$ is the **tangent vector** at $\mathbf{r}(t)$. When $\mathbf{r}'(t) \ne \mathbf{0}$ the **unit tangent** is

$$\mathbf{T}(t) = \frac{\mathbf{r}'(t)}{|\mathbf{r}'(t)|}.$$

The tangent line at $\mathbf{r}(t_0)$ is $\mathbf{r}(t_0) + s\,\mathbf{r}'(t_0)$. A curve is **smooth** on an interval when $\mathbf{r}'$ is continuous and never $\mathbf{0}$ there: at a point where $\mathbf{r}' = \mathbf{0}$ the moving point stops, and the curve may turn a sharp corner (try $\langle t^2, t^3 \rangle$ at $t = 0$).`,
        },
        {
          kind: "example",
          title: "Tangent vector and tangent line",
          problem: md`For $\mathbf{r}(t) = \langle t^2, \sin t, e^{2t} \rangle$, find $\mathbf{r}'(t)$, the unit tangent at $t = 0$, and the tangent line there.`,
          steps: [
            { math: `\\mathbf{r}'(t) = \\langle 2t, \\cos t, 2e^{2t} \\rangle`, note: "Differentiate each component with the usual rules." },
            { math: `\\mathbf{r}'(0) = \\langle 0, 1, 2 \\rangle, \\qquad |\\mathbf{r}'(0)| = \\sqrt{0 + 1 + 4} = \\sqrt{5}`, note: md`Substitute $t = 0$, then take the length.` },
            { math: `\\mathbf{T}(0) = \\left\\langle 0, \\tfrac{1}{\\sqrt5}, \\tfrac{2}{\\sqrt5} \\right\\rangle`, note: "Divide by the length to get a unit vector in the same direction." },
            { math: `\\mathbf{r}(0) + s\\,\\mathbf{r}'(0) = \\langle 0, s, 1 + 2s \\rangle`, note: md`The tangent line passes through $\mathbf{r}(0) = \langle 0, 0, 1 \rangle$ with direction $\mathbf{r}'(0)$. Any nonzero multiple of the direction gives the same line.` },
          ],
        },
        {
          kind: "why",
          title: "Why the product rules carry over",
          body: md`Write $\mathbf{u} = \langle u_1, u_2, u_3 \rangle$ and $\mathbf{v} = \langle v_1, v_2, v_3 \rangle$, both functions of $t$. The dot product is a sum of ordinary products:

$$\frac{d}{dt}(\mathbf{u} \cdot \mathbf{v}) = \frac{d}{dt}(u_1 v_1 + u_2 v_2 + u_3 v_3) = (u_1' v_1 + u_1 v_1') + (u_2' v_2 + u_2 v_2') + (u_3' v_3 + u_3 v_3').$$

Regroup the primed-$u$ terms and the primed-$v$ terms:

$$= (u_1' v_1 + u_2' v_2 + u_3' v_3) + (u_1 v_1' + u_2 v_2' + u_3 v_3') = \mathbf{u}' \cdot \mathbf{v} + \mathbf{u} \cdot \mathbf{v}'.$$

Exactly the one-variable product rule, with dots. The cross product rule $(\mathbf{u} \times \mathbf{v})' = \mathbf{u}' \times \mathbf{v} + \mathbf{u} \times \mathbf{v}'$ comes from the same calculation on each component of the cross product, which is also a sum of products. The order of the factors matters there, since $\mathbf{v} \times \mathbf{u} = -\mathbf{u} \times \mathbf{v}$.`,
        },
        {
          kind: "key",
          title: "Differentiation rules for curves",
          body: md`For differentiable curves $\mathbf{u}$, $\mathbf{v}$, a differentiable scalar function $f$ and a constant $c$:

- $(\mathbf{u} + \mathbf{v})' = \mathbf{u}' + \mathbf{v}'$ and $(c\mathbf{u})' = c\mathbf{u}'$
- $(f\mathbf{u})' = f'\mathbf{u} + f\mathbf{u}'$
- $(\mathbf{u} \cdot \mathbf{v})' = \mathbf{u}' \cdot \mathbf{v} + \mathbf{u} \cdot \mathbf{v}'$
- $(\mathbf{u} \times \mathbf{v})' = \mathbf{u}' \times \mathbf{v} + \mathbf{u} \times \mathbf{v}'$ (keep the order)
- $\dfrac{d}{dt}\mathbf{u}(f(t)) = f'(t)\,\mathbf{u}'(f(t))$ (chain rule)

Each one is proved by writing out components and using the Calculus 1 rule there.`,
        },
        {
          kind: "proof",
          title: "A curve of constant length is perpendicular to its derivative",
          given: md`$|\mathbf{r}(t)| = c$ for all $t$, with $\mathbf{r}$ differentiable`,
          prove: md`$\mathbf{r}(t) \cdot \mathbf{r}'(t) = 0$ for all $t$`,
          steps: [
            { statement: md`$\mathbf{r}(t) \cdot \mathbf{r}(t) = |\mathbf{r}(t)|^2 = c^2$`, reason: "A vector dotted with itself is its length squared (Unit 1)" },
            { statement: md`$\dfrac{d}{dt}\left[\mathbf{r}(t) \cdot \mathbf{r}(t)\right] = \dfrac{d}{dt}\left[c^2\right] = 0$`, reason: "Both sides are the same function of t, so their derivatives agree; a constant has derivative 0" },
            { statement: md`$\mathbf{r}' \cdot \mathbf{r} + \mathbf{r} \cdot \mathbf{r}' = 0$`, reason: "Dot product rule" },
            { statement: md`$2\,\mathbf{r}(t) \cdot \mathbf{r}'(t) = 0$, so $\mathbf{r}(t) \cdot \mathbf{r}'(t) = 0$`, reason: "The dot product is commutative; divide by 2" },
          ],
        },
        {
          kind: "plot",
          x: [-3.4, 3.4],
          y: [-3.4, 3.4],
          parametric: [
            { x: "2cos(t)", y: "2sin(t)", t: [0, 2 * Math.PI], color: 1 },
            { x: "2t cos(a)", y: "2t sin(a)", t: [0, 1], label: "\\mathbf{r}(t)", color: 2 },
            { x: "2cos(a) - 2t sin(a)", y: "2sin(a) + 2t cos(a)", t: [0, 1], label: "\\mathbf{r}'(t)", color: 3 },
          ],
          points: [{ x: "2cos(a)", y: "2sin(a)", color: 2 }],
          params: [{ name: "a", tex: "t", min: 0, max: 6.3, step: 0.05, value: 0.7 }],
          caption: md`$\mathbf{r}(t) = \langle 2\cos t, 2\sin t \rangle$ has constant length 2, and $\mathbf{r}'(t) = \langle -2\sin t, 2\cos t \rangle$ is always perpendicular to it: $\mathbf{r} \cdot \mathbf{r}' = -4\cos t\sin t + 4\sin t\cos t = 0$. The theorem says this happens on any sphere, in any dimension. In particular $\mathbf{T} \cdot \mathbf{T}' = 0$ always, since $|\mathbf{T}| = 1$. We use that next lesson.`,
        },
        {
          kind: "why",
          title: "Why integrals are component-wise too",
          body: md`A definite integral is a limit of Riemann sums. For a vector function the sum $\sum \mathbf{r}(t_i^*)\,\Delta t$ is a sum of vectors, and vectors add component by component. So

$$\sum_{i=1}^{n} \mathbf{r}(t_i^*)\,\Delta t = \left\langle \sum f(t_i^*)\,\Delta t, \sum g(t_i^*)\,\Delta t, \sum h(t_i^*)\,\Delta t \right\rangle,$$

and taking $n \to \infty$ (limits are component-wise) gives

$$\int_a^b \mathbf{r}(t)\,dt = \left\langle \int_a^b f(t)\,dt, \int_a^b g(t)\,dt, \int_a^b h(t)\,dt \right\rangle.$$

The Fundamental Theorem then applies in each component: if $\mathbf{R}' = \mathbf{r}$ then $\int_a^b \mathbf{r}\,dt = \mathbf{R}(b) - \mathbf{R}(a)$. An indefinite integral $\int \mathbf{r}\,dt = \mathbf{R}(t) + \mathbf{C}$ carries a constant *vector*, one constant per component.`,
        },
        {
          kind: "key",
          title: "Integrals of vector functions",
          body: md`Integrate each component. The result of a definite integral is a vector; an antiderivative has a constant vector $\mathbf{C}$, which an initial condition such as $\mathbf{r}(0) = \mathbf{r}_0$ determines. This is how velocity is turned back into position in Lesson 4.`,
        },
        {
          kind: "example",
          title: "Recovering a curve from its derivative",
          problem: md`Find $\mathbf{r}(t)$ if $\mathbf{r}'(t) = \langle 2t, 3t^2, \cos t \rangle$ and $\mathbf{r}(0) = \langle 1, 0, 2 \rangle$.`,
          steps: [
            { math: `\\mathbf{r}(t) = \\langle t^2, t^3, \\sin t \\rangle + \\mathbf{C}`, note: "Antidifferentiate each component; collect the three constants into one constant vector." },
            { math: `\\mathbf{r}(0) = \\langle 0, 0, 0 \\rangle + \\mathbf{C} = \\langle 1, 0, 2 \\rangle \\;\\Rightarrow\\; \\mathbf{C} = \\langle 1, 0, 2 \\rangle`, note: "The initial condition fixes the constant." },
            { math: `\\mathbf{r}(t) = \\langle t^2 + 1, t^3, \\sin t + 2 \\rangle`, note: md`Check: differentiate to get $\langle 2t, 3t^2, \cos t \rangle$, and $\mathbf{r}(0) = \langle 1, 0, 2 \rangle$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\mathbf{r}'(0)$ for $\mathbf{r}(t) = \langle t^3, \cos t, e^{2t} \rangle$. Type it as (x, y, z).`,
          answer: "(0, 0, 2)",
          form: "tuple",
          explain: md`$\mathbf{r}'(t) = \langle 3t^2, -\sin t, 2e^{2t} \rangle$. At $t = 0$: $\langle 0, 0, 2 \rangle$.`,
        },
        {
          kind: "check",
          prompt: md`Compute $\int_0^1 \langle 2t, 3t^2, 1 \rangle \, dt$. Type it as (x, y, z).`,
          answer: "(1, 1, 1)",
          form: "tuple",
          explain: md`Component by component: $[t^2]_0^1 = 1$, $[t^3]_0^1 = 1$, $[t]_0^1 = 1$.`,
        },
      ],
      practice: [differentiateComponent, derivativeAtPoint, integrateComponent],
    },
    {
      id: slug("Arc length and curvature"),
      title: "Arc length and curvature",
      summary: "Length of a curve is the integral of speed, derived from chords. Curvature measures how fast the unit tangent turns per unit of length; circles have curvature 1/r, and a cross-product formula computes it for any curve.",
      blocks: [
        {
          kind: "text",
          body: md`How long is a curve? Approximate it with chords. Cut the parameter interval $[a, b]$ into $n$ pieces of width $\Delta t$ and join the points $\mathbf{r}(t_0), \mathbf{r}(t_1), \dots, \mathbf{r}(t_n)$ by straight segments. The polygon is a little shorter than the curve, and the difference shrinks as the chords get shorter. The length of the curve is the limit of the polygon lengths.`,
        },
        chordPlot(),
        {
          kind: "why",
          title: "Why arc length is the integral of speed",
          body: md`One chord has length $|\mathbf{r}(t_{i}) - \mathbf{r}(t_{i-1})|$. By the definition of the derivative, for small $\Delta t$,

$$\mathbf{r}(t_i) - \mathbf{r}(t_{i-1}) \approx \mathbf{r}'(t_{i-1})\,\Delta t, \qquad\text{so}\qquad |\mathbf{r}(t_i) - \mathbf{r}(t_{i-1})| \approx |\mathbf{r}'(t_{i-1})|\,\Delta t.$$

Adding the chords gives $\sum |\mathbf{r}'(t_{i-1})|\,\Delta t$, a Riemann sum for the function $|\mathbf{r}'(t)|$. As $n \to \infty$ the approximations become exact and the sum becomes

$$L = \int_a^b |\mathbf{r}'(t)|\,dt = \int_a^b \sqrt{f'(t)^2 + g'(t)^2 + h'(t)^2}\,dt.$$

Read it as distance equals the integral of speed: $|\mathbf{r}'(t)|$ is how fast the point moves at time $t$, and adding up speed times tiny time gives the distance travelled. For a plane curve $y = F(x)$, take $\mathbf{r}(x) = \langle x, F(x), 0 \rangle$ and this becomes the Calculus 2 formula $\int \sqrt{1 + F'(x)^2}\,dx$.`,
        },
        {
          kind: "key",
          title: "Arc length and the arc length function",
          body: md`For a smooth curve traced once as $t$ runs from $a$ to $b$,

$$L = \int_a^b |\mathbf{r}'(t)|\,dt.$$

The **arc length function** $s(t) = \int_a^t |\mathbf{r}'(u)|\,du$ is the distance along the curve from $\mathbf{r}(a)$ to $\mathbf{r}(t)$. By the Fundamental Theorem, $\dfrac{ds}{dt} = |\mathbf{r}'(t)|$: the rate at which arc length accumulates is the speed. The length depends only on the curve, not on how fast it is traced.`,
        },
        {
          kind: "example",
          title: "Length of a helix",
          problem: md`Find the length of one turn of the helix $\mathbf{r}(t) = \langle 3\cos t, 3\sin t, 4t \rangle$, $0 \le t \le 2\pi$.`,
          steps: [
            { math: `\\mathbf{r}'(t) = \\langle -3\\sin t, 3\\cos t, 4 \\rangle`, note: "Differentiate each component." },
            { math: `|\\mathbf{r}'(t)| = \\sqrt{9\\sin^2 t + 9\\cos^2 t + 16} = \\sqrt{9 + 16} = 5`, note: md`$\sin^2 t + \cos^2 t = 1$. The speed is constant, which is what makes helices such friendly examples.` },
            { math: `L = \\int_0^{2\\pi} 5\\,dt = 10\\pi`, note: md`A constant integrand: speed times time. One turn of this helix is $10\pi \approx 31.4$ long, more than the $6\pi$ of the circle it sits over, because it also climbs $8\pi$.` },
          ],
        },
        {
          kind: "example",
          title: "Reparametrizing by arc length",
          problem: md`Rewrite the same helix so that the parameter is distance travelled from $\mathbf{r}(0)$.`,
          steps: [
            { math: `s(t) = \\int_0^t |\\mathbf{r}'(u)|\\,du = \\int_0^t 5\\,du = 5t`, note: "Arc length as a function of t." },
            { math: `t = \\frac{s}{5}`, note: "Solve for t, then substitute into the curve." },
            { math: `\\mathbf{r}(s) = \\left\\langle 3\\cos\\tfrac{s}{5}, 3\\sin\\tfrac{s}{5}, \\tfrac{4s}{5} \\right\\rangle`, note: md`Now $\mathbf{r}(s)$ is the point exactly $s$ units along the curve.` },
            { math: `|\\mathbf{r}'(s)| = \\sqrt{\\tfrac{9}{25}\\sin^2\\tfrac{s}{5} + \\tfrac{9}{25}\\cos^2\\tfrac{s}{5} + \\tfrac{16}{25}} = 1`, note: md`A curve parametrized by arc length always has speed 1, since $\frac{ds}{ds} = 1$. That is what makes $s$ the natural parameter: it belongs to the curve, not to any particular schedule.` },
          ],
        },
        {
          kind: "text",
          body: md`**Curvature** measures how sharply a curve bends. A straight line doesn't bend at all; a small circle bends more than a large one. What changes along a bending curve is the *direction* of the unit tangent $\mathbf{T}$. So we measure how fast $\mathbf{T}$ turns.

Fast with respect to what? Not time: a car can drive the same bend slowly or quickly, and the road's shape doesn't change. We measure the turning per unit of **distance along the curve**:

$$\kappa = \left| \frac{d\mathbf{T}}{ds} \right|.$$

Because $\mathbf{T}$ always has length 1, $|d\mathbf{T}/ds|$ is purely the rate of turning, with no stretching mixed in.`,
        },
        {
          kind: "why",
          title: "Why the formula has a speed in the denominator",
          body: md`We usually have $\mathbf{T}$ as a function of $t$, not $s$. The chain rule connects them:

$$\frac{d\mathbf{T}}{dt} = \frac{d\mathbf{T}}{ds}\,\frac{ds}{dt} = \frac{d\mathbf{T}}{ds}\,|\mathbf{r}'(t)|.$$

Divide through by the speed:

$$\kappa = \left|\frac{d\mathbf{T}}{ds}\right| = \frac{|\mathbf{T}'(t)|}{|\mathbf{r}'(t)|}.$$

Going twice as fast makes $\mathbf{T}$ turn twice as fast per second but doesn't change the road, and the denominator exactly cancels that. So $\kappa$ depends only on the curve, as it should.`,
        },
        {
          kind: "proof",
          title: "A circle of radius a has curvature 1/a",
          given: md`$\mathbf{r}(t) = \langle a\cos t, a\sin t \rangle$, $a > 0$`,
          prove: md`$\kappa = \dfrac{1}{a}$ at every point`,
          steps: [
            { statement: md`$\mathbf{r}'(t) = \langle -a\sin t, a\cos t \rangle$ and $|\mathbf{r}'(t)| = a$`, reason: md`Differentiate; $\sqrt{a^2\sin^2 t + a^2\cos^2 t} = a$` },
            { statement: md`$\mathbf{T}(t) = \langle -\sin t, \cos t \rangle$`, reason: md`$\mathbf{T} = \mathbf{r}'/|\mathbf{r}'|$` },
            { statement: md`$\mathbf{T}'(t) = \langle -\cos t, -\sin t \rangle$ and $|\mathbf{T}'(t)| = 1$`, reason: "Differentiate; length of a unit vector" },
            { statement: md`$\kappa = \dfrac{|\mathbf{T}'(t)|}{|\mathbf{r}'(t)|} = \dfrac{1}{a}$`, reason: "Curvature formula from the chain rule" },
          ],
        },
        {
          kind: "text",
          body: md`So a circle of radius 2 has curvature $\frac12$, a circle of radius 100 has curvature $\frac{1}{100}$, and a straight line (a circle of infinite radius) has curvature 0. Big circle, small curvature. For any curve, $\rho = \frac{1}{\kappa}$ is the **radius of curvature**: the radius of the circle that best fits the curve at that point, called the **osculating circle**. It sits on the concave side, touching the curve and sharing its tangent.

Computing $\mathbf{T}'$ directly is tedious because of the division by $|\mathbf{r}'|$. There is a formula that skips it.`,
        },
        {
          kind: "why",
          title: "Why κ = |r' × r''| / |r'|³",
          body: md`Write the speed as $v = |\mathbf{r}'|$, so $\mathbf{r}' = v\,\mathbf{T}$. Differentiate with the product rule:

$$\mathbf{r}'' = v'\,\mathbf{T} + v\,\mathbf{T}'.$$

Cross both sides with $\mathbf{r}' = v\mathbf{T}$. Since $\mathbf{T} \times \mathbf{T} = \mathbf{0}$, the first term drops out:

$$\mathbf{r}' \times \mathbf{r}'' = v\mathbf{T} \times (v'\mathbf{T} + v\mathbf{T}') = v^2\,(\mathbf{T} \times \mathbf{T}').$$

Now $|\mathbf{T}| = 1$, so last lesson's theorem says $\mathbf{T} \perp \mathbf{T}'$, and the magnitude of a cross product of perpendicular vectors is the product of their lengths: $|\mathbf{T} \times \mathbf{T}'| = |\mathbf{T}'|$. Hence

$$|\mathbf{r}' \times \mathbf{r}''| = v^2\,|\mathbf{T}'| \quad\Rightarrow\quad \kappa = \frac{|\mathbf{T}'|}{v} = \frac{|\mathbf{r}' \times \mathbf{r}''|}{|\mathbf{r}'|^3}.$$

For a graph $y = f(x)$, use $\mathbf{r}(x) = \langle x, f(x), 0 \rangle$: $\mathbf{r}' = \langle 1, f', 0 \rangle$, $\mathbf{r}'' = \langle 0, f'', 0 \rangle$, $\mathbf{r}' \times \mathbf{r}'' = \langle 0, 0, f'' \rangle$ and $|\mathbf{r}'| = \sqrt{1 + f'^2}$. That gives the plane-curve formula below.`,
        },
        {
          kind: "key",
          title: "Curvature formulas",
          body: md`$$\kappa = \left|\frac{d\mathbf{T}}{ds}\right| = \frac{|\mathbf{T}'(t)|}{|\mathbf{r}'(t)|} = \frac{|\mathbf{r}'(t) \times \mathbf{r}''(t)|}{|\mathbf{r}'(t)|^3}, \qquad \kappa = \frac{|f''(x)|}{\left(1 + f'(x)^2\right)^{3/2}} \text{ for } y = f(x).$$

A circle of radius $a$ has $\kappa = 1/a$; a line has $\kappa = 0$. The radius of curvature is $\rho = 1/\kappa$. The **principal unit normal** $\mathbf{N} = \mathbf{T}'/|\mathbf{T}'|$ points toward the centre of the osculating circle, into the bend.`,
        },
        {
          kind: "example",
          title: "Curvature of a parabola",
          problem: md`Find the curvature of $y = x^2$ at $(0, 0)$ and at $(1, 1)$.`,
          steps: [
            { math: `f'(x) = 2x, \\qquad f''(x) = 2`, note: "Two derivatives." },
            { math: `\\kappa(x) = \\frac{2}{(1 + 4x^2)^{3/2}}`, note: "Plane-curve formula." },
            { math: `\\kappa(0) = \\frac{2}{1} = 2`, note: md`At the vertex the tangent is horizontal, $f' = 0$, and the curvature is just $|f''|$. The osculating circle there has radius $\frac12$.` },
            { math: `\\kappa(1) = \\frac{2}{5^{3/2}} = \\frac{2}{5\\sqrt5} = \\frac{2\\sqrt5}{25} \\approx 0.18`, note: "Further out the parabola straightens: smaller curvature, larger osculating circle." },
          ],
        },
        {
          kind: "plot",
          x: [-5.5, 4.5],
          y: [-1, 7],
          curves: [{ expr: "x^2", label: "y = x^2", color: 1 }],
          parametric: [{ x: "-4a^3 + ((1 + 4a^2)^(3/2)/2) cos(t)", y: "3a^2 + 1/2 + ((1 + 4a^2)^(3/2)/2) sin(t)", t: [0, 2 * Math.PI], label: "\\text{osculating circle}", color: 2, dashed: true }],
          points: [
            { x: "a", y: "a^2", label: "(a, a^2)", color: 2 },
            { x: "-4a^3", y: "3a^2 + 1/2", label: "\\text{centre}", color: 2, open: true },
          ],
          params: [{ name: "a", tex: "a", min: -0.8, max: 0.8, step: 0.05, value: 0.4 }],
          caption: md`The osculating circle of $y = x^2$ at $x = a$, with radius $\rho = 1/\kappa = \frac{(1 + 4a^2)^{3/2}}{2}$. At $a = 0$ it is the tight circle of radius $\frac12$. Slide $a$ outward and the circle swells as the parabola straightens: $\kappa \approx$ {=2/(1 + 4a^2)^(3/2)}.`,
        },
        {
          kind: "example",
          title: "Curvature of a helix by the cross product",
          problem: md`Find the curvature of $\mathbf{r}(t) = \langle 3\cos t, 3\sin t, 4t \rangle$.`,
          steps: [
            { math: `\\mathbf{r}' = \\langle -3\\sin t, 3\\cos t, 4 \\rangle, \\qquad \\mathbf{r}'' = \\langle -3\\cos t, -3\\sin t, 0 \\rangle`, note: "Two derivatives." },
            { math: `\\mathbf{r}' \\times \\mathbf{r}'' = \\begin{vmatrix} \\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\ -3\\sin t & 3\\cos t & 4 \\\\ -3\\cos t & -3\\sin t & 0 \\end{vmatrix} = \\langle 12\\sin t, -12\\cos t, 9 \\rangle`, note: md`$x$: $0 - 4(-3\sin t)$. $y$: $4(-3\cos t) - 0$. $z$: $9\sin^2 t + 9\cos^2 t = 9$.` },
            { math: `|\\mathbf{r}' \\times \\mathbf{r}''| = \\sqrt{144 + 81} = 15, \\qquad |\\mathbf{r}'| = 5`, note: md`$144\sin^2 t + 144\cos^2 t = 144$.` },
            { math: `\\kappa = \\frac{15}{5^3} = \\frac{3}{25}`, note: md`Constant, as a helix should be: it bends the same way everywhere. Less than the $\frac13$ of the circle it winds around, because the climb straightens it out.` },
          ],
        },
        {
          kind: "check",
          prompt: md`What is the curvature of a circle of radius 5?`,
          answer: "1/5",
          explain: md`A circle of radius $a$ has curvature $1/a$ everywhere, so $\kappa = \frac15$.`,
        },
        {
          kind: "check",
          prompt: md`Find the length of $\mathbf{r}(t) = \langle 3\cos t, 3\sin t, 4t \rangle$ for $0 \le t \le \pi$. Type an exact answer, like 6pi.`,
          answer: "5pi",
          explain: md`The speed is $\sqrt{9\sin^2 t + 9\cos^2 t + 16} = 5$, so $L = \int_0^{\pi} 5\,dt = 5\pi$.`,
        },
      ],
      practice: [helixLengthSetup, niceSpeedLength, curvatureAtPoint],
    },
    {
      id: slug("Motion in space"),
      title: "Motion in space",
      summary: "Velocity, speed and acceleration of a moving point; projectile motion derived from constant gravity; circular motion; and the split of acceleration into a tangential part (speeding up) and a normal part (turning).",
      blocks: [
        {
          kind: "text",
          body: md`Now read $t$ as time and $\mathbf{r}(t)$ as the position of a moving object. Everything from the last two lessons gets a physical name.

The **velocity** is $\mathbf{v}(t) = \mathbf{r}'(t)$: the tangent vector, pointing the way the object is heading. Its length $|\mathbf{v}(t)| = \frac{ds}{dt}$ is the **speed**, the rate at which distance along the path accumulates. The **acceleration** is $\mathbf{a}(t) = \mathbf{v}'(t) = \mathbf{r}''(t)$, the rate at which velocity changes. Velocity can change by changing speed or by changing direction, and acceleration records both.

Newton's second law, $\mathbf{F} = m\mathbf{a}$, says the net force on the object is its mass times this vector. So if we know the forces we know $\mathbf{a}$, and integrating twice (Lesson 2) gives the path.`,
        },
        {
          kind: "key",
          title: "Velocity, speed, acceleration",
          body: md`$$\mathbf{v} = \mathbf{r}', \qquad \text{speed} = |\mathbf{v}| = \frac{ds}{dt}, \qquad \mathbf{a} = \mathbf{v}' = \mathbf{r}''.$$

Going the other way: $\mathbf{v}(t) = \mathbf{v}(t_0) + \int_{t_0}^{t} \mathbf{a}(u)\,du$ and $\mathbf{r}(t) = \mathbf{r}(t_0) + \int_{t_0}^{t} \mathbf{v}(u)\,du$. Distance travelled over $[a, b]$ is $\int_a^b |\mathbf{v}|\,dt$, the arc length.`,
        },
        {
          kind: "example",
          title: "Velocity, speed and acceleration at an instant",
          problem: md`A particle moves along $\mathbf{r}(t) = \langle t^2, 2t, \ln t \rangle$. Find its velocity, speed and acceleration at $t = 1$.`,
          steps: [
            { math: `\\mathbf{v}(t) = \\langle 2t, 2, \\tfrac{1}{t} \\rangle, \\qquad \\mathbf{v}(1) = \\langle 2, 2, 1 \\rangle`, note: "Differentiate, then substitute." },
            { math: `|\\mathbf{v}(1)| = \\sqrt{4 + 4 + 1} = 3`, note: "Speed is the magnitude of velocity." },
            { math: `\\mathbf{a}(t) = \\langle 2, 0, -\\tfrac{1}{t^2} \\rangle, \\qquad \\mathbf{a}(1) = \\langle 2, 0, -1 \\rangle`, note: md`Differentiate again. Note $\mathbf{a}(1) \cdot \mathbf{v}(1) = 4 - 1 = 3 > 0$: the particle is speeding up at that instant.` },
          ],
        },
        {
          kind: "why",
          title: "Why a thrown ball follows a parabola",
          body: md`Near the ground, gravity gives every object the same downward acceleration, $g \approx 9.8$ m/s$^2$. Ignoring air resistance, with $x$ horizontal and $y$ up,

$$\mathbf{a}(t) = \langle 0, -g \rangle.$$

Launch from the origin with speed $v_0$ at angle $\alpha$ above the horizontal, so $\mathbf{v}(0) = \langle v_0\cos\alpha, v_0\sin\alpha \rangle$. Integrate once, using $\mathbf{v}(0)$ to fix the constant:

$$\mathbf{v}(t) = \langle v_0\cos\alpha, \; v_0\sin\alpha - gt \rangle.$$

Integrate again, with $\mathbf{r}(0) = \mathbf{0}$:

$$\mathbf{r}(t) = \left\langle (v_0\cos\alpha)\,t, \; (v_0\sin\alpha)\,t - \tfrac12 g t^2 \right\rangle.$$

The horizontal motion is steady; the vertical motion is the Calculus 1 falling-body formula. Eliminating $t = x/(v_0\cos\alpha)$ makes $y$ a quadratic in $x$ with a negative leading coefficient: a downward-opening parabola.`,
        },
        {
          kind: "why",
          title: "Why the range is v₀² sin 2α / g",
          body: md`The ball lands when $y = 0$ again: $(v_0\sin\alpha)\,t - \frac12 gt^2 = t\left(v_0\sin\alpha - \frac12 gt\right) = 0$, so the flight time is

$$T = \frac{2v_0\sin\alpha}{g}.$$

The range is how far $x$ has got by then:

$$R = (v_0\cos\alpha)\,T = \frac{2v_0^2\sin\alpha\cos\alpha}{g} = \frac{v_0^2\sin 2\alpha}{g},$$

using the double-angle identity $2\sin\alpha\cos\alpha = \sin 2\alpha$. Since $\sin 2\alpha \le 1$ with equality at $2\alpha = 90^\circ$, the range is greatest at $\alpha = 45^\circ$, and angles $\alpha$ and $90^\circ - \alpha$ give the same range. The top of the flight is at $t = T/2$, by the symmetry of the parabola, where the height is $\frac{(v_0\sin\alpha)^2}{2g}$.`,
        },
        {
          kind: "key",
          title: "Projectile motion",
          body: md`Launched from the origin at speed $v_0$ and angle $\alpha$, with only gravity acting:

$$x = (v_0\cos\alpha)\,t, \qquad y = (v_0\sin\alpha)\,t - \tfrac12 gt^2,$$

$$T = \frac{2v_0\sin\alpha}{g}, \qquad R = \frac{v_0^2\sin 2\alpha}{g}, \qquad H = \frac{(v_0\sin\alpha)^2}{2g}.$$

If the launch point is at height $h_0$, add $h_0$ to $y$; the landing time then comes from the quadratic formula. Don't memorize $R$ and $H$ so much as be able to re-derive them from $\mathbf{a} = \langle 0, -g \rangle$ in a few lines.`,
        },
        {
          kind: "plot",
          x: [0, 95],
          y: [-5, 50],
          parametric: [{ x: "v cos(a pi/180) t", y: "v sin(a pi/180) t - 4.9t^2", t: [0, 6.2], label: "\\text{path}", color: 1 }],
          points: [
            { x: "v^2 sin(2a pi/180)/9.8", y: 0, label: "R", color: 2 },
            { x: "v^2 sin(2a pi/180)/19.6", y: "(v sin(a pi/180))^2/19.6", label: "H", color: 2 },
          ],
          params: [
            { name: "v", tex: "v_0", min: 10, max: 30, step: 1, value: 20 },
            { name: "a", tex: "\\alpha", min: 10, max: 80, step: 5, value: 45 },
          ],
          caption: md`A projectile with $g = 9.8$. Range $R \approx$ {=v^2 sin(2 a pi/180)/9.8} m, height $H \approx$ {=(v sin(a pi/180))^2/19.6} m, flight time $T \approx$ {=2 v sin(a pi/180)/9.8} s. Try $\alpha = 30^\circ$ and $60^\circ$: same range, different heights. Try $45^\circ$: the longest range for a given $v_0$.`,
        },
        {
          kind: "example",
          title: "A thrown ball",
          problem: md`A ball is thrown from the ground at 20 m/s, at $30^\circ$ above horizontal. Find the flight time, the range and the greatest height. Use $g = 9.8$.`,
          steps: [
            { math: `\\mathbf{v}(0) = \\langle 20\\cos 30^\\circ, 20\\sin 30^\\circ \\rangle = \\langle 10\\sqrt3, 10 \\rangle`, note: "Split the launch velocity into components." },
            { math: `x = 10\\sqrt3\\,t, \\qquad y = 10t - 4.9t^2`, note: md`Integrate $\mathbf{a} = \langle 0, -9.8 \rangle$ twice.` },
            { math: `T = \\frac{10}{4.9} \\approx 2.04 \\text{ s}`, note: md`Landing: $y = t(10 - 4.9t) = 0$.` },
            { math: `R = 10\\sqrt3 \\cdot \\frac{10}{4.9} \\approx 35.35 \\text{ m}`, note: md`Or $R = \frac{400\sin 60^\circ}{9.8}$, the same number.` },
            { math: `H = \\frac{10^2}{2(9.8)} \\approx 5.10 \\text{ m}`, note: md`$H = \frac{(v_0\sin\alpha)^2}{2g}$, or evaluate $y$ at $t = T/2 \approx 1.02$.` },
          ],
        },
        {
          kind: "text",
          body: md`**Circular motion.** A point going around a circle at constant speed has constant speed but is accelerating all the time, because its direction keeps changing. Where does the acceleration point, and how big is it?`,
        },
        {
          kind: "proof",
          title: "Uniform circular motion accelerates toward the centre",
          given: md`$\mathbf{r}(t) = \langle R\cos\omega t, R\sin\omega t \rangle$ with constants $R, \omega > 0$`,
          prove: md`$\mathbf{a} = -\omega^2\,\mathbf{r}$, so the acceleration points to the centre and has magnitude $R\omega^2 = \dfrac{|\mathbf{v}|^2}{R}$`,
          steps: [
            { statement: md`$\mathbf{v} = \langle -R\omega\sin\omega t, R\omega\cos\omega t \rangle$`, reason: "Differentiate each component with the chain rule" },
            { statement: md`$|\mathbf{v}| = R\omega$`, reason: md`$\sqrt{R^2\omega^2(\sin^2\omega t + \cos^2\omega t)}$; the speed is constant` },
            { statement: md`$\mathbf{a} = \langle -R\omega^2\cos\omega t, -R\omega^2\sin\omega t \rangle = -\omega^2\,\mathbf{r}$`, reason: "Differentiate again and factor" },
            { statement: md`$\mathbf{a}$ points opposite to $\mathbf{r}$, i.e. from the point toward the centre`, reason: md`A negative multiple of $\mathbf{r}$` },
            { statement: md`$|\mathbf{a}| = \omega^2 |\mathbf{r}| = R\omega^2 = \dfrac{(R\omega)^2}{R} = \dfrac{|\mathbf{v}|^2}{R}$`, reason: md`Substitute $\omega = |\mathbf{v}|/R$` },
          ],
        },
        {
          kind: "plot",
          x: [-3.6, 3.6],
          y: [-3.6, 3.6],
          parametric: [
            { x: "2cos(t)", y: "2sin(t)", t: [0, 2 * Math.PI], color: 1 },
            { x: "2t cos(a)", y: "2t sin(a)", t: [0, 1], label: "\\mathbf{r}", color: 1, dashed: true },
            { x: "2cos(a) - 2t sin(a)", y: "2sin(a) + 2t cos(a)", t: [0, 1], label: "\\mathbf{v}", color: 3 },
            { x: "2cos(a) - 2t cos(a)", y: "2sin(a) - 2t sin(a)", t: [0, 1], label: "\\mathbf{a}", color: 4 },
          ],
          points: [{ x: "2cos(a)", y: "2sin(a)", color: 2 }],
          params: [{ name: "a", tex: "t", min: 0, max: 6.3, step: 0.05, value: 0.6 }],
          caption: md`$\mathbf{r} = \langle 2\cos t, 2\sin t \rangle$ ($R = 2$, $\omega = 1$). Velocity (green) is tangent, length $R\omega = 2$. Acceleration (red) points straight at the centre, length $|\mathbf{v}|^2/R = 2$. Speed never changes; direction always does, and that is what the acceleration is doing.`,
        },
        {
          kind: "why",
          title: "Why acceleration splits into speeding up and turning",
          body: md`In general an object does both at once. Write $\mathbf{v} = v\,\mathbf{T}$ with $v = |\mathbf{v}|$ the speed and differentiate:

$$\mathbf{a} = v'\,\mathbf{T} + v\,\mathbf{T}'.$$

From last lesson, $\mathbf{T}' = |\mathbf{T}'|\,\mathbf{N}$ with $|\mathbf{T}'| = \kappa v$ (since $\kappa = |\mathbf{T}'|/|\mathbf{r}'|$). So

$$\mathbf{a} = v'\,\mathbf{T} + \kappa v^2\,\mathbf{N} = a_T\,\mathbf{T} + a_N\,\mathbf{N}.$$

The **tangential component** $a_T = v' = \frac{d}{dt}|\mathbf{v}|$ is the rate of change of speed: it is all that matters to the speedometer. The **normal component** $a_N = \kappa v^2$ is the turning: sharper bend or higher speed means more of it, and it is what you feel pushing you sideways in a cornering car. Circular motion is the case $v' = 0$, $\kappa = 1/R$, which gives back $a_N = v^2/R$.

To compute them without finding $\mathbf{T}$ and $\mathbf{N}$: dot $\mathbf{a}$ with $\mathbf{v} = v\mathbf{T}$, and cross it. Since $\mathbf{T} \cdot \mathbf{N} = 0$ and $|\mathbf{T} \times \mathbf{N}| = 1$,

$$\mathbf{v} \cdot \mathbf{a} = v\,a_T, \qquad |\mathbf{v} \times \mathbf{a}| = v\,a_N.$$`,
        },
        {
          kind: "key",
          title: "Tangential and normal components of acceleration",
          body: md`$$\mathbf{a} = a_T\,\mathbf{T} + a_N\,\mathbf{N}, \qquad a_T = \frac{d|\mathbf{v}|}{dt} = \frac{\mathbf{v} \cdot \mathbf{a}}{|\mathbf{v}|}, \qquad a_N = \kappa|\mathbf{v}|^2 = \frac{|\mathbf{v} \times \mathbf{a}|}{|\mathbf{v}|}.$$

$a_T > 0$ means speeding up, $a_T < 0$ slowing down. $a_N \ge 0$ always, and $a_N = 0$ exactly where the path is momentarily straight. Since $\mathbf{T} \perp \mathbf{N}$, $|\mathbf{a}|^2 = a_T^2 + a_N^2$, a handy check. There is never a component out of the plane of $\mathbf{T}$ and $\mathbf{N}$.`,
        },
        {
          kind: "example",
          title: "Splitting an acceleration",
          problem: md`A particle moves along $\mathbf{r}(t) = \langle 3t, t^2, 4t \rangle$. Find $a_T$ and $a_N$ at $t = 6$.`,
          steps: [
            { math: `\\mathbf{v}(t) = \\langle 3, 2t, 4 \\rangle, \\qquad \\mathbf{a}(t) = \\langle 0, 2, 0 \\rangle`, note: "Two derivatives. The acceleration is constant here." },
            { math: `\\mathbf{v}(6) = \\langle 3, 12, 4 \\rangle, \\qquad |\\mathbf{v}(6)| = \\sqrt{9 + 144 + 16} = 13`, note: md`Substitute $t = 6$.` },
            { math: `a_T = \\frac{\\mathbf{v} \\cdot \\mathbf{a}}{|\\mathbf{v}|} = \\frac{0 + 24 + 0}{13} = \\frac{24}{13}`, note: "Speeding up: most of the acceleration goes into speed." },
            { math: `\\mathbf{v} \\times \\mathbf{a} = \\langle 12 \\cdot 0 - 4 \\cdot 2, \\; 4 \\cdot 0 - 3 \\cdot 0, \\; 3 \\cdot 2 - 12 \\cdot 0 \\rangle = \\langle -8, 0, 6 \\rangle`, note: "Cross product." },
            { math: `a_N = \\frac{|\\langle -8, 0, 6 \\rangle|}{13} = \\frac{10}{13}`, note: md`Check: $a_T^2 + a_N^2 = \frac{576 + 100}{169} = 4 = |\mathbf{a}|^2$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`A particle moves along $\mathbf{r}(t) = \langle 3t, 4t, t^2 \rangle$. What is its speed at $t = 0$?`,
          answer: "5",
          explain: md`$\mathbf{v}(t) = \langle 3, 4, 2t \rangle$, so $\mathbf{v}(0) = \langle 3, 4, 0 \rangle$ and the speed is $\sqrt{9 + 16} = 5$.`,
        },
        {
          kind: "check",
          prompt: md`A ball is thrown from the ground at 20 m/s at $30^\circ$. Taking $g = 10$ m/s$^2$ for simplicity, how many seconds is it in the air?`,
          answer: "2",
          explain: md`$T = \frac{2v_0\sin\alpha}{g} = \frac{2 \cdot 20 \cdot \frac12}{10} = 2$ seconds.`,
        },
      ],
      practice: [projectile, speedAtTime, accelerationComponents],
    },
  ],
};
