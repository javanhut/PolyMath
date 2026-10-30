import { frac, fracTex, paren, poly, signed, type Rng } from "../../math/random";
import { md, slug, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

const DNE = ["does not exist", "DNE"];
const NUM_OR_DNE = "Type a number (a fraction like 3/4 is fine), or DNE if the limit does not exist.";
const NUM = "Type a number (a fraction like 3/4 is fine).";

/** \lim_{x \to a} body, with an optional side "^+" or "^-". */
const lim = (a: string, body: string, side = "") => md`\lim_{x \to ${a}${side}} ${body}`;

/** "x - a" (or just "x" when a = 0), and "x + b": the x-plus-constant factors. */
const xm = (a: number) => poly([[1, "x"], [-a, ""]]);
const xp = (b: number) => poly([[1, "x"], [b, ""]]);
/** x^k in LaTeX, with x^1 written as x. */
const xPow = (k: number) => (k === 1 ? "x" : `x^{${k}}`);

/** A decimal without float noise: 0.1 + 0.2 prints as 0.3. */
const dec = (v: number) => String(Number(v.toFixed(6)));

/** A two-piece function in LaTeX. */
const cases = (leftTex: string, leftCond: string, rightTex: string, rightCond: string) =>
  md`\begin{cases} ${leftTex} & \text{if } ${leftCond} \\ ${rightTex} & \text{if } ${rightCond} \end{cases}`;

/** Multiple-choice wording for infinite limits. The words differ after the checker strips symbols. */
const INF = {
  up: "increases without bound (+∞)",
  down: "decreases without bound (−∞)",
  zero: "approaches 0",
  num: "approaches a nonzero number",
};

const DISC = {
  cont: "continuous",
  removable: "removable discontinuity",
  jump: "jump discontinuity",
  infinite: "infinite discontinuity",
};
const DISC_CHOICES = [DISC.cont, DISC.removable, DISC.jump, DISC.infinite];

function shuffle<T>(r: Rng, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A line m x + b as LaTeX, as parser text, and as a function. */
function line(m: number, b: number) {
  return {
    tex: poly([[m, "x"], [b, ""]]),
    f: (x: number) => m * x + b,
    /** The line evaluated at x, written with numbers only (for verify equations). */
    at: (x: number) => `${m}*(${x}) ${signed(b)}`,
    atTex: (x: number) => md`${m === 1 ? "" : m === -1 ? "-" : m}(${x})${b === 0 ? "" : ` ${signed(b)}`}`,
  };
}

/** Plot of a two-piece function with the seam at x = c. */
function seamPlot(leftExpr: string, rightExpr: string, c: number, L: number, R: number, ys: number[]): Figure {
  const lo = Math.min(...ys, L, R) - 1;
  const hi = Math.max(...ys, L, R) + 1;
  return {
    kind: "plot",
    x: [c - 4, c + 4],
    y: [Math.floor(lo), Math.ceil(hi)],
    curves: [
      { expr: leftExpr, domain: [c - 4, c], color: 1 },
      { expr: rightExpr, domain: [c, c + 4], color: 1 },
    ],
    points: L === R ? [{ x: c, y: R }] : [{ x: c, y: L, open: true }, { x: c, y: R }],
    vlines: [{ x: c }],
  };
}

// ── Lesson 1: The idea of a limit ───────────────────────────────────────────

const limitFromTable: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.nonzero(-6, 6);
    const body = md`\frac{x^2 - ${a * a}}{${xm(a)}}`;
    const v = (x: number) => x + a;
    return {
      prompt: md`Find $${lim(String(a), body)}$. ${NUM_OR_DNE}`,
      answer: String(2 * a),
      hint: md`The fraction is undefined at $x = ${a}$, but a limit only asks about nearby inputs. Try $x = ${a} \pm 0.1$ and $x = ${a} \pm 0.01$.`,
      solution: [
        { math: md`x = ${dec(a - 0.1)}:\; ${dec(v(a - 0.1))} \qquad x = ${dec(a + 0.1)}:\; ${dec(v(a + 0.1))}`, note: "Inputs 0.1 away on each side." },
        { math: md`x = ${dec(a - 0.01)}:\; ${dec(v(a - 0.01))} \qquad x = ${dec(a + 0.01)}:\; ${dec(v(a + 0.01))}`, note: "Closer in, the outputs close in too." },
        {
          math: md`${lim(String(a), body)} = ${2 * a}`,
          note: md`Both sides head for ${2 * a}. The reason is algebra: for $x \ne ${a}$, $\frac{x^2 - ${a * a}}{${xm(a)}} = \frac{(${xm(a)})(${xp(a)})}{${xm(a)}} = ${xp(a)}$, and that is ${2 * a} when $x$ is near $${a}$. The next lesson turns this into a method.`,
        },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(-4, 4);
    let b = r.int(-5, 5);
    while (b === a) b = r.int(-5, 5);
    const num = poly([[1, "x^2"], [-(a + b), "x"], [a * b, ""]]);
    const body = md`\frac{${num}}{${xm(a)}}`;
    const v = (x: number) => x - b;
    return {
      prompt: md`Find $${lim(String(a), body)}$. ${NUM_OR_DNE}`,
      answer: String(a - b),
      hint: md`Substituting $x = ${a}$ gives $\frac{0}{0}$, which tells you nothing. Evaluate at inputs just below and just above ${a}.`,
      solution: [
        { math: md`x = ${dec(a - 0.1)}:\; ${dec(v(a - 0.1))} \qquad x = ${dec(a + 0.1)}:\; ${dec(v(a + 0.1))}`, note: "A table of nearby values." },
        { math: md`x = ${dec(a - 0.001)}:\; ${dec(v(a - 0.001))} \qquad x = ${dec(a + 0.001)}:\; ${dec(v(a + 0.001))}`, note: md`The outputs settle on ${a - b}.` },
        {
          math: md`${lim(String(a), body)} = ${a - b}`,
          note: md`Behind the table: $${num} = (${xm(a)})(${xm(b)})$, so for $x \ne ${a}$ the fraction equals $${xm(b)}$.`,
        },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(-4, 4);
    const body = md`\frac{${xm(a)}}{|${xm(a)}|}`;
    return {
      prompt: md`Find $${lim(String(a), body)}$. ${NUM_OR_DNE}`,
      accept: DNE,
      hint: md`Try an input a little less than ${a} and one a little more. Is the fraction heading for a single number?`,
      solution: [
        { math: md`x = ${dec(a - 0.1)}:\; \frac{-0.1}{0.1} = -1 \qquad x = ${dec(a - 0.001)}:\; -1`, note: md`Left of ${a}, the top is negative and the bottom is positive. The quotient is always $-1$.` },
        { math: md`x = ${dec(a + 0.1)}:\; \frac{0.1}{0.1} = 1 \qquad x = ${dec(a + 0.001)}:\; 1`, note: md`Right of ${a}, both are positive. The quotient is always $1$.` },
        { math: md`${lim(String(a), body)} \text{ does not exist}`, note: md`The two sides disagree ($-1$ and $1$), so there is no single number the outputs approach.` },
      ],
    };
  }
  const a = r.int(-3, 3);
  const c = r.int(-5, 5);
  const body = c === 0 ? md`x^2` : md`\left(x^2 ${signed(c)}\right)`;
  const v = (x: number) => x * x + c;
  return {
    prompt: md`Find $${lim(String(a), body)}$. ${NUM_OR_DNE}`,
    answer: String(a * a + c),
    hint: md`Nothing is undefined here. Check inputs near ${a} and see what the outputs approach.`,
    solution: [
      { math: md`x = ${dec(a - 0.1)}:\; ${dec(v(a - 0.1))} \qquad x = ${dec(a + 0.1)}:\; ${dec(v(a + 0.1))}`, note: "Nearby inputs on both sides." },
      { math: md`x = ${dec(a - 0.01)}:\; ${dec(v(a - 0.01))} \qquad x = ${dec(a + 0.01)}:\; ${dec(v(a + 0.01))}`, note: md`They approach ${a * a + c}, which is also the value at $x = ${a}$.` },
      { math: md`${lim(String(a), body)} = ${a * a + c}`, note: "When the formula has no gap at the point, the limit is simply the value there. Lesson 4 gives this a name: continuity." },
    ],
  };
};

const oneSidedPiecewise: Generator = (r) => {
  const c = r.int(-2, 3);
  const left = line(r.nonzero(-3, 3), r.int(-4, 4));
  const L = left.f(c);
  // The right piece: a line or a shifted parabola, meeting the left piece about a third of the time.
  const quad = r.next() < 0.5;
  const match = r.next() < 0.35;
  let right: { tex: string; expr: string; f: (x: number) => number; at: (x: number) => string; atTex: (x: number) => string };
  if (quad) {
    const k = match ? L - c * c : L - c * c + r.pick([-3, -2, -1, 1, 2, 3]);
    const tex = poly([[1, "x^2"], [k, ""]]);
    right = { tex, expr: tex, f: (x) => x * x + k, at: (x) => `(${x})^2 ${signed(k)}`, atTex: (x) => md`(${x})^2${k === 0 ? "" : ` ${signed(k)}`}` };
  } else {
    const m = r.nonzero(-3, 3);
    const b = match ? L - m * c : L - m * c + r.pick([-3, -2, -1, 1, 2, 3]);
    const ln = line(m, b);
    right = { tex: ln.tex, expr: ln.tex, f: ln.f, at: ln.at, atTex: ln.atTex };
  }
  const R = right.f(c);
  const tex = cases(left.tex, md`x < ${c}`, right.tex, md`x \ge ${c}`);
  const ys = [left.f(c - 4), right.f(c + 4), right.f(c + 2)];
  const figure = seamPlot(left.tex, right.expr, c, L, R, ys);
  const q = r.int(0, 3);
  const base = { figure, hint: md`Only one piece matters for each one-sided limit: the piece used by inputs on that side of ${c}. The value $f(${c})$ comes from the piece whose condition includes ${c}.` };
  const leftStep: Step = { math: md`${lim(String(c), "f(x)", "^-")} = ${lim(String(c), `(${left.tex})`, "^-")} = ${left.atTex(c)} = ${L}`, note: md`Inputs just below ${c} use the first piece, so the limit from the left is that piece's value at ${c}.` };
  const rightStep: Step = { math: md`${lim(String(c), "f(x)", "^+")} = ${lim(String(c), `(${right.tex})`, "^+")} = ${right.atTex(c)} = ${R}`, note: md`Inputs just above ${c} use the second piece.` };
  if (q === 0) {
    return {
      ...base,
      prompt: md`$$f(x) = ${tex}$$ Find $${lim(String(c), "f(x)", "^-")}$. ${NUM_OR_DNE}`,
      answer: String(L),
      verify: [`L = ${left.at(c)}`],
      solution: [leftStep],
    };
  }
  if (q === 1) {
    return {
      ...base,
      prompt: md`$$f(x) = ${tex}$$ Find $${lim(String(c), "f(x)", "^+")}$. ${NUM_OR_DNE}`,
      answer: String(R),
      verify: [`L = ${right.at(c)}`],
      solution: [rightStep],
    };
  }
  if (q === 2) {
    return {
      ...base,
      prompt: md`$$f(x) = ${tex}$$ Find $${lim(String(c), "f(x)")}$. ${NUM_OR_DNE}`,
      ...(L === R ? { answer: String(L), verify: [`L = ${left.at(c)}`, `L = ${right.at(c)}`] } : { accept: DNE }),
      solution: [
        leftStep,
        rightStep,
        L === R
          ? { math: md`${lim(String(c), "f(x)")} = ${L}`, note: "The one-sided limits agree, so the two-sided limit exists and equals their common value." }
          : { math: md`${lim(String(c), "f(x)")} \text{ does not exist}`, note: md`$${L} \ne ${R}$. The two sides approach different numbers, so there is no two-sided limit.` },
      ],
    };
  }
  return {
    ...base,
    prompt: md`$$f(x) = ${tex}$$ Find $f(${c})$. ${NUM}`,
    answer: String(R),
    verify: [`y = ${right.at(c)}`],
    solution: [{ math: md`f(${c}) = ${right.atTex(c)} = ${R}`, note: md`${c} satisfies $x \ge ${c}$, so the second piece defines the value. The first piece never applies at ${c} itself, whatever it approaches.` }],
  };
};

const limitFromGraph: Generator = (r) => {
  const p = r.int(0, 2);
  const q = p + r.int(2, 3);
  const l1 = line(r.pick([1, -1, 2]), r.int(-2, 3));
  let l2 = line(r.pick([1, -1, 2, -2]), r.int(-3, 3));
  while (l2.f(q) === l1.f(q)) l2 = line(r.pick([1, -1, 2, -2]), r.int(-3, 3));
  const hole = l1.f(p);
  const v = hole + r.pick([-3, -2, 2, 3]);
  const ys = [l1.f(p - 3), l1.f(q), l2.f(q), l2.f(q + 3), v];
  const figure: Figure = {
    kind: "plot",
    x: [p - 3, q + 3],
    y: [Math.min(...ys) - 1, Math.max(...ys) + 1],
    curves: [
      { expr: l1.tex, domain: [p - 3, q], color: 1 },
      { expr: l2.tex, domain: [q, q + 3], color: 1 },
    ],
    points: [
      { x: p, y: hole, open: true },
      { x: p, y: v },
      { x: q, y: l1.f(q), open: true },
      { x: q, y: l2.f(q) },
    ],
    vlines: [{ x: p }, { x: q }],
  };
  const intro = md`The graph of $f$ is shown.`;
  const kind = r.int(0, 5);
  if (kind === 0) {
    return {
      prompt: md`${intro} Find $${lim(String(p), "f(x)")}$. ${NUM_OR_DNE}`,
      answer: String(hole),
      figure,
      verify: [`L = ${l1.at(p)}`],
      hint: md`Follow the curve toward $x = ${p}$ from both sides. The limit is where the curve is heading, not where the solid dot is.`,
      solution: [
        { math: md`${lim(String(p), "f(x)", "^-")} = ${hole}, \qquad ${lim(String(p), "f(x)", "^+")} = ${hole}`, note: md`From either side the curve runs into the open circle at height ${hole}.` },
        { math: md`${lim(String(p), "f(x)")} = ${hole}`, note: md`The solid dot at height ${v} is $f(${p})$ itself. A limit ignores the value at the point.` },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`${intro} Find $f(${p})$. ${NUM}`,
      answer: String(v),
      figure,
      hint: md`The value of the function at $x = ${p}$ is marked by a solid dot. An open circle means the curve does not reach that point.`,
      solution: [{ math: md`f(${p}) = ${v}`, note: md`The solid dot above $x = ${p}$ is at height ${v}. The open circle at height ${hole} is where the limit is, not the value.` }],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`${intro} Find $${lim(String(q), "f(x)", "^-")}$. ${NUM_OR_DNE}`,
      answer: String(l1.f(q)),
      figure,
      verify: [`L = ${l1.at(q)}`],
      hint: md`Come in toward $x = ${q}$ from the left only, along the curve that lives on the left.`,
      solution: [{ math: md`${lim(String(q), "f(x)", "^-")} = ${l1.f(q)}`, note: md`Moving right along the left-hand branch, the curve approaches the open circle at height ${l1.f(q)}.` }],
    };
  }
  if (kind === 3) {
    return {
      prompt: md`${intro} Find $${lim(String(q), "f(x)", "^+")}$. ${NUM_OR_DNE}`,
      answer: String(l2.f(q)),
      figure,
      verify: [`L = ${l2.at(q)}`],
      hint: md`Come in toward $x = ${q}$ from the right only.`,
      solution: [{ math: md`${lim(String(q), "f(x)", "^+")} = ${l2.f(q)}`, note: md`Moving left along the right-hand branch, the curve arrives at the solid dot at height ${l2.f(q)}.` }],
    };
  }
  if (kind === 4) {
    return {
      prompt: md`${intro} Find $${lim(String(q), "f(x)")}$. ${NUM_OR_DNE}`,
      accept: DNE,
      figure,
      hint: md`Compare the limit from the left with the limit from the right at $x = ${q}$.`,
      solution: [
        { math: md`${lim(String(q), "f(x)", "^-")} = ${l1.f(q)}, \qquad ${lim(String(q), "f(x)", "^+")} = ${l2.f(q)}`, note: "Read each branch separately." },
        { math: md`${lim(String(q), "f(x)")} \text{ does not exist}`, note: "The graph jumps: the two one-sided limits differ, so no single number works." },
      ],
    };
  }
  return {
    prompt: md`${intro} Find $f(${q})$. ${NUM}`,
    answer: String(l2.f(q)),
    figure,
    verify: [`y = ${l2.at(q)}`],
    hint: md`Look for the solid dot above $x = ${q}$.`,
    solution: [{ math: md`f(${q}) = ${l2.f(q)}`, note: md`The solid dot is on the right-hand branch, at height ${l2.f(q)}. The open circle shows the left-hand branch stops short.` }],
  };
};

// ── Lesson 2: Limit laws ────────────────────────────────────────────────────

const factorAndCancel: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const a = r.nonzero(-7, 7);
    const body = md`\frac{x^2 - ${a * a}}{${xm(a)}}`;
    return {
      prompt: md`Find $${lim(String(a), body)}$. ${NUM_OR_DNE}`,
      answer: String(2 * a),
      hint: md`Substitution gives $\frac{0}{0}$. Factor the difference of squares and cancel; the new function agrees with the old one everywhere except $x = ${a}$.`,
      solution: [
        { math: md`\frac{x^2 - ${a * a}}{${xm(a)}} = \frac{(${xm(a)})(${xp(a)})}{${xm(a)}} = ${xp(a)} \quad (x \ne ${a})`, note: "Factor and cancel. The two expressions are equal for every input except the one the limit never looks at." },
        { math: md`${lim(String(a), body)} = ${lim(String(a), `(${xp(a)})`)} = ${2 * a}`, note: "Functions that agree near the point have the same limit; the second is found by substitution." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(-4, 4);
    let b = r.int(-5, 5);
    while (b === a) b = r.int(-5, 5);
    const num = poly([[1, "x^2"], [-(a + b), "x"], [a * b, ""]]);
    const body = md`\frac{${num}}{${xm(a)}}`;
    return {
      prompt: md`Find $${lim(String(a), body)}$. ${NUM_OR_DNE}`,
      answer: String(a - b),
      hint: md`The top is $0$ at $x = ${a}$, so $(${xm(a)})$ is a factor of it. Factor and cancel.`,
      solution: [
        { math: md`${num} = (${xm(a)})(${xm(b)})`, note: md`Two numbers with sum ${a + b} and product ${a * b}: ${a} and ${b}.` },
        { math: md`\frac{(${xm(a)})(${xm(b)})}{${xm(a)}} = ${xm(b)} \quad (x \ne ${a})`, note: "Cancel the common factor." },
        { math: md`${lim(String(a), body)} = ${a} ${signed(-b)} = ${a - b}`, note: "Substitute into the simplified form." },
      ],
    };
  }
  if (kind === 2) {
    const a = r.nonzero(-6, 6);
    const body = md`\frac{${xm(a)}}{x^2 - ${a * a}}`;
    return {
      prompt: md`Find $${lim(String(a), body)}$. ${NUM_OR_DNE}`,
      answer: frac(1, 2 * a),
      hint: md`Factor the bottom. After cancelling, the limit is a fraction.`,
      solution: [
        { math: md`\frac{${xm(a)}}{(${xm(a)})(${xp(a)})} = \frac{1}{${xp(a)}} \quad (x \ne ${a})`, note: "Factor the difference of squares and cancel." },
        { math: md`${lim(String(a), body)} = \frac{1}{${a} ${signed(a)}} = ${fracTex(1, 2 * a)}`, note: md`The bottom is now ${2 * a} at $x = ${a}$, not zero, so substitution is allowed.` },
      ],
    };
  }
  if (kind === 3) {
    const a = r.pick([-3, -2, -1, 1, 2, 3]);
    const body = md`\frac{${poly([[1, "x^3"], [-(a ** 3), ""]])}}{${xm(a)}}`;
    return {
      prompt: md`Find $${lim(String(a), body)}$. ${NUM_OR_DNE}`,
      answer: String(3 * a * a),
      hint: md`Difference of cubes: $u^3 - v^3 = (u - v)(u^2 + uv + v^2)$.`,
      solution: [
        { math: md`${poly([[1, "x^3"], [-(a ** 3), ""]])} = (${xm(a)})(${poly([[1, "x^2"], [a, "x"], [a * a, ""]])})`, note: md`Here $v = ${a}$, so $v^3 = ${a ** 3}$ and $v^2 = ${a * a}$.` },
        { math: md`${lim(String(a), body)} = ${lim(String(a), `(${poly([[1, "x^2"], [a, "x"], [a * a, ""]])})`)}`, note: "Cancel the common factor." },
        { math: md`= ${a * a} + ${a * a} + ${a * a} = ${3 * a * a}`, note: md`Substitute $x = ${a}$: each of the three terms is ${a * a}.` },
      ],
    };
  }
  const a = r.int(-3, 3);
  let b = r.int(-4, 4);
  while (b === a) b = r.int(-4, 4);
  let c = r.int(-4, 4);
  while (c === a || c === b) c = r.int(-4, 4);
  const num = poly([[1, "x^2"], [-(a + b), "x"], [a * b, ""]]);
  const den = poly([[1, "x^2"], [-(a + c), "x"], [a * c, ""]]);
  const body = md`\frac{${num}}{${den}}`;
  return {
    prompt: md`Find $${lim(String(a), body)}$. ${NUM_OR_DNE}`,
    answer: frac(a - b, a - c),
    hint: md`Both top and bottom are $0$ at $x = ${a}$, so both have the factor $(${xm(a)})$. Factor each and cancel it.`,
    solution: [
      { math: md`\frac{(${xm(a)})(${xm(b)})}{(${xm(a)})(${xm(c)})} = \frac{${xm(b)}}{${xm(c)}} \quad (x \ne ${a})`, note: "Factor both quadratics and cancel the shared factor." },
      { math: md`${lim(String(a), body)} = \frac{${a} ${signed(-b)}}{${a} ${signed(-c)}} = ${fracTex(a - b, a - c)}`, note: md`The bottom is now ${a - c} at $x = ${a}$, so substitute.` },
    ],
  };
};

const limitLawsAndSubstitution: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.int(-3, 3);
    const [p, q, s] = [r.nonzero(-3, 3), r.int(-5, 5), r.int(-6, 6)];
    const tex = poly([[p, "x^2"], [q, "x"], [s, ""]]);
    const value = p * a * a + q * a + s;
    return {
      prompt: md`Find $${lim(String(a), `(${tex})`)}$. ${NUM}`,
      answer: String(value),
      hint: "A polynomial has no gaps. By the limit laws, its limit is found by substitution.",
      solution: [
        { math: md`${lim(String(a), `(${tex})`)} = ${p}\left(${lim(String(a), "x")}\right)^2 + ${paren(q)}\left(${lim(String(a), "x")}\right) + ${paren(s)}`, note: "Sum, constant-multiple and power laws split the limit into limits of x and of constants." },
        { math: md`= ${p}(${a})^2 ${signed(q * a)} ${signed(s)} = ${value}`, note: md`$\lim_{x \to ${a}} x = ${a}$ and a constant's limit is itself. This is why substitution is legal for polynomials.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(-3, 3);
    let s = r.int(-6, 6);
    while (s === -a) s = r.int(-6, 6);
    const [p, q] = [r.nonzero(-4, 4), r.int(-6, 6)];
    const top = poly([[p, "x"], [q, ""]]);
    const bot = poly([[1, "x"], [s, ""]]);
    const body = md`\frac{${top}}{${bot}}`;
    return {
      prompt: md`Find $${lim(String(a), body)}$. ${NUM}`,
      answer: frac(p * a + q, a + s),
      hint: md`Check the bottom first: at $x = ${a}$ it is ${a + s}, not zero. So the quotient law applies and you can substitute.`,
      solution: [
        { math: md`${lim(String(a), `(${bot})`)} = ${a + s} \ne 0`, note: "The quotient law needs a nonzero limit downstairs. It has one." },
        { math: md`${lim(String(a), body)} = \frac{${lim(String(a), `(${top})`)}}{${lim(String(a), `(${bot})`)}} = \frac{${p * a + q}}{${a + s}} = ${fracTex(p * a + q, a + s)}`, note: "Quotient law, then substitution in each polynomial." },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(-3, 3);
    const L = r.nonzero(-4, 4);
    const M = r.nonzero(-4, 4);
    const c = r.coef(-5, 5);
    const which = r.int(0, 2);
    const given = md`Suppose $${lim(String(a), "f(x)")} = ${L}$ and $${lim(String(a), "g(x)")} = ${M}$.`;
    if (which === 0) {
      const value = c * L + M * M;
      return {
        prompt: md`${given} Find $${lim(String(a), `\\left[${c}f(x) + g(x)^2\\right]`)}$. ${NUM}`,
        answer: String(value),
        verify: [`v = ${c}*${paren(L)} + ${paren(M)}^2`],
        hint: "Split with the sum law, pull the constant out, and use the power law on the square.",
        solution: [
          { math: md`${lim(String(a), `\\left[${c}f(x) + g(x)^2\\right]`)} = ${c}\lim f(x) + \left(\lim g(x)\right)^2`, note: "Sum law, constant-multiple law, power law." },
          { math: md`= ${c}(${L}) + (${M})^2 = ${c * L} + ${M * M} = ${value}`, note: "Substitute the known limits." },
        ],
      };
    }
    if (which === 1) {
      const value = L * M - c;
      return {
        prompt: md`${given} Find $${lim(String(a), `\\left[f(x)\\,g(x) ${signed(-c)}\\right]`)}$. ${NUM}`,
        answer: String(value),
        verify: [`v = ${paren(L)}*${paren(M)} - ${paren(c)}`],
        hint: "Difference law first, then the product law.",
        solution: [
          { math: md`${lim(String(a), `\\left[f(x)\\,g(x) ${signed(-c)}\\right]`)} = \left(\lim f(x)\right)\left(\lim g(x)\right) ${signed(-c)}`, note: "Difference law, product law, and a constant's limit is itself." },
          { math: md`= (${L})(${M}) ${signed(-c)} = ${L * M} ${signed(-c)} = ${value}`, note: "" },
        ],
      };
    }
    return {
      prompt: md`${given} Find $${lim(String(a), `\\frac{f(x) ${signed(c)}}{g(x)}`)}$. ${NUM}`,
      answer: frac(L + c, M),
      verify: [`v*${paren(M)} = ${paren(L)} ${signed(c)}`],
      hint: md`The quotient law applies because the limit of the bottom is ${M}, not $0$.`,
      solution: [
        { math: md`${lim(String(a), `\\frac{f(x) ${signed(c)}}{g(x)}`)} = \frac{\lim f(x) ${signed(c)}}{\lim g(x)}`, note: md`Quotient law (the bottom's limit is $${M} \ne 0$), then the sum law on top.` },
        { math: md`= \frac{${L} ${signed(c)}}{${M}} = ${fracTex(L + c, M)}`, note: "" },
      ],
    };
  }
  const s = r.int(1, 6);
  const p = r.pick([1, 2, 3, 4]);
  const a = r.int(-3, 4);
  const q = s * s - p * a;
  const body = md`\sqrt{${poly([[p, "x"], [q, ""]])}}`;
  return {
    prompt: md`Find $${lim(String(a), body)}$. ${NUM}`,
    answer: String(s),
    hint: md`Root law: the limit of a root is the root of the limit, as long as the inside has a limit and it is not negative.`,
    solution: [
      { math: md`${lim(String(a), `(${poly([[p, "x"], [q, ""]])})`)} = ${p === 1 ? "" : p}(${a}) ${signed(q)} = ${s * s}`, note: "The inside is a polynomial, so substitute." },
      { math: md`${lim(String(a), body)} = \sqrt{${s * s}} = ${s}`, note: md`Root law, with $${s * s} > 0$.` },
    ],
  };
};

const squeezeAndTrig: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0) {
    const k = r.coef(2, 7);
    const body = md`\frac{\sin(${k}x)}{x}`;
    return {
      prompt: md`Find $${lim("0", body)}$. ${NUM}`,
      answer: String(k),
      hint: md`Make the inside of the sine match the bottom: multiply top and bottom by ${k} and set $u = ${k}x$.`,
      solution: [
        { math: md`\frac{\sin(${k}x)}{x} = ${k} \cdot \frac{\sin(${k}x)}{${k}x}`, note: md`Multiplying by $\frac{${k}}{${k}}$ changes nothing.` },
        { math: md`${lim("0", body)} = ${k} \cdot \lim_{u \to 0} \frac{\sin u}{u} = ${k} \cdot 1 = ${k}`, note: md`As $x \to 0$, $u = ${k}x \to 0$ too, and $\lim_{u \to 0} \frac{\sin u}{u} = 1$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.coef(2, 6);
    let b = r.int(1, 6);
    while (b === a) b = r.int(1, 6);
    const body = md`\frac{\sin(${a}x)}{\sin(${b}x)}`;
    return {
      prompt: md`Find $${lim("0", body)}$. ${NUM}`,
      answer: frac(a, b),
      hint: md`Divide top and bottom by $x$. Each piece becomes a $\frac{\sin(kx)}{x}$ limit.`,
      solution: [
        { math: md`\frac{\sin(${a}x)}{\sin(${b}x)} = \frac{\sin(${a}x)/x}{\sin(${b}x)/x}`, note: md`Divide top and bottom by $x$ ($x \ne 0$).` },
        { math: md`${lim("0", "\\frac{\\sin(" + a + "x)}{x}")} = ${a}, \qquad ${lim("0", "\\frac{\\sin(" + b + "x)}{x}")} = ${b}`, note: md`Each is $k \cdot \lim_{u \to 0}\frac{\sin u}{u} = k$.` },
        { math: md`${lim("0", body)} = \frac{${a}}{${b}}${a % b === 0 || frac(a, b) === `${a}/${b}` ? "" : ` = ${fracTex(a, b)}`}`, note: md`Quotient law: the bottom's limit is $${b} \ne 0$.` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.coef(2, 6);
    const m = r.coef(2, 5);
    const body = md`\frac{\sin(${k}x)}{${m}x}`;
    return {
      prompt: md`Find $${lim("0", body)}$. ${NUM}`,
      answer: frac(k, m),
      hint: md`Rewrite as $\frac{${k}}{${m}} \cdot \frac{\sin(${k}x)}{${k}x}$.`,
      solution: [
        { math: md`\frac{\sin(${k}x)}{${m}x} = \frac{${k}}{${m}} \cdot \frac{\sin(${k}x)}{${k}x}`, note: md`Check: $\frac{${k}}{${m}} \cdot \frac{1}{${k}x} = \frac{1}{${m}x}$.` },
        { math: md`${lim("0", body)} = \frac{${k}}{${m}} \cdot 1 = ${fracTex(k, m)}`, note: md`With $u = ${k}x \to 0$, the second factor is $\frac{\sin u}{u} \to 1$.` },
      ],
    };
  }
  if (kind === 3) {
    const c = r.int(1, 5);
    const body = md`\frac{\sqrt{x + ${c * c}} - ${c}}{x}`;
    return {
      prompt: md`Find $${lim("0", body)}$. ${NUM}`,
      answer: frac(1, 2 * c),
      hint: md`Multiply top and bottom by the conjugate $\sqrt{x + ${c * c}} + ${c}$.`,
      solution: [
        { math: md`\frac{\sqrt{x + ${c * c}} - ${c}}{x} \cdot \frac{\sqrt{x + ${c * c}} + ${c}}{\sqrt{x + ${c * c}} + ${c}} = \frac{(x + ${c * c}) - ${c * c}}{x\left(\sqrt{x + ${c * c}} + ${c}\right)}`, note: md`$(u - v)(u + v) = u^2 - v^2$ clears the root on top.` },
        { math: md`= \frac{x}{x\left(\sqrt{x + ${c * c}} + ${c}\right)} = \frac{1}{\sqrt{x + ${c * c}} + ${c}} \quad (x \ne 0)`, note: "Cancel x." },
        { math: md`${lim("0", body)} = \frac{1}{\sqrt{${c * c}} + ${c}} = \frac{1}{${2 * c}}`, note: "Now the bottom is not zero, so substitute (root and quotient laws)." },
      ],
    };
  }
  if (kind === 4) {
    const k = r.int(1, 5);
    const inner = k === 1 ? "1/x" : `${k}/x`;
    const body = md`x^2 \sin(${inner})`;
    return {
      prompt: md`Find $${lim("0", body)}$. ${NUM}`,
      answer: "0",
      hint: md`$\sin$ of anything lies between $-1$ and $1$. Multiply that by $x^2$ and squeeze.`,
      solution: [
        { math: md`-1 \le \sin(${inner}) \le 1 \quad (x \ne 0)`, note: md`Sine never leaves $[-1, 1]$, however wildly it oscillates.` },
        { math: md`-x^2 \le x^2 \sin(${inner}) \le x^2`, note: md`Multiply through by $x^2 \ge 0$, which keeps the inequalities pointing the same way.` },
        { math: md`${lim("0", "(-x^2)")} = 0 = ${lim("0", "x^2")} \;\Rightarrow\; ${lim("0", body)} = 0`, note: "Squeeze theorem: the function is trapped between two functions with the same limit." },
      ],
    };
  }
  const k = r.coef(2, 5);
  const body = md`\frac{1 - \cos(${k}x)}{x}`;
  return {
    prompt: md`Find $${lim("0", body)}$. ${NUM}`,
    answer: "0",
    hint: md`Multiply top and bottom by $1 + \cos(${k}x)$ and use $1 - \cos^2 u = \sin^2 u$.`,
    solution: [
      { math: md`\frac{1 - \cos(${k}x)}{x} \cdot \frac{1 + \cos(${k}x)}{1 + \cos(${k}x)} = \frac{\sin^2(${k}x)}{x\,(1 + \cos(${k}x))}`, note: md`$(1 - \cos u)(1 + \cos u) = 1 - \cos^2 u = \sin^2 u$.` },
      { math: md`= \frac{\sin(${k}x)}{x} \cdot \frac{\sin(${k}x)}{1 + \cos(${k}x)}`, note: "Split into two factors with known limits." },
      { math: md`${lim("0", body)} = ${k} \cdot \frac{0}{1 + 1} = 0`, note: md`The first factor tends to ${k}, the second to $\frac{\sin 0}{2} = 0$. Product law.` },
    ],
  };
};

// ── Lesson 3: The formal epsilon-delta definition ───────────────────────────

const largestDeltaLinear: Generator = (r) => {
  const m = r.pick([-10, -8, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 8, 10]);
  const b = r.int(-5, 5);
  const a = r.int(-3, 3);
  const L = m * a + b;
  const ln = line(m, b);
  const converse = r.next() < 0.3;
  const dk = r.pick([5, 10, 20, 25, 50, 100]);
  const delta = dec(dk / 1000);
  const eps = dec((dk * Math.abs(m)) / 1000);
  const Ltex = L < 0 ? `(${L})` : String(L);
  const absX = a === 0 ? "|x|" : `|x - ${paren(a)}|`;
  const setup = md`Let $f(x) = ${ln.tex}$, so $${lim(String(a), "f(x)")} = ${L}$.`;
  const key: Step = { math: md`|f(x) - ${Ltex}| = |${ln.tex} - ${Ltex}| = |${poly([[m, "x"], [-m * a, ""]])}| = ${Math.abs(m)}\,|${xm(a)}|`, note: md`Factor out ${m}. The distance from $f(x)$ to $L$ is always exactly ${Math.abs(m)} times the distance from $x$ to ${a}.` };
  if (converse) {
    return {
      prompt: md`${setup} If $0 < ${absX} < ${delta}$, how close to ${L} is $f(x)$ guaranteed to be? That is, find the smallest $\varepsilon$ with $|f(x) - ${Ltex}| < \varepsilon$ for all such $x$. Type a decimal.`,
      answer: eps,
      verify: [`p = ${Math.abs(m)}*${delta}`],
      hint: md`Write $|f(x) - ${Ltex}|$ in terms of $${absX}$. It is a constant multiple.`,
      solution: [
        key,
        { math: md`|${xm(a)}| < ${delta} \;\Rightarrow\; |f(x) - ${Ltex}| < ${Math.abs(m)} \cdot ${delta} = ${eps}`, note: "Multiply the input tolerance by the slope's size." },
        { math: md`\varepsilon = ${eps}`, note: md`Nothing smaller works: inputs just inside the window reach outputs just inside ${eps}.` },
      ],
    };
  }
  return {
    prompt: md`${setup} For $\varepsilon = ${eps}$, find the largest $\delta$ such that $0 < ${absX} < \delta$ guarantees $|f(x) - ${Ltex}| < \varepsilon$. Type a decimal.`,
    answer: delta,
    verify: [`d = ${eps}/${Math.abs(m)}`],
    hint: md`Rewrite $|f(x) - ${Ltex}| < ${eps}$ as a statement about $${absX}$.`,
    solution: [
      key,
      { math: md`${Math.abs(m)}\,|${xm(a)}| < ${eps} \iff |${xm(a)}| < \frac{${eps}}{${Math.abs(m)}} = ${delta}`, note: md`Divide by $${Math.abs(m)} > 0$.` },
      { math: md`\delta = ${delta}`, note: md`Any smaller $\delta$ also works, but this is the largest: an input with $|${xm(a)}| = ${delta}$ gives $|f(x) - ${Ltex}| = ${eps}$ exactly, which is not less than $\varepsilon$.` },
    ],
  };
};

const largestDeltaNonlinear: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.int(1, 5);
    const d = r.pick([1, 2, 3, 5]);
    const delta = dec(d / 10);
    const eps = dec((20 * a * d + d * d) / 100);
    const hi = dec(a * a + (20 * a * d + d * d) / 100);
    const lo = dec(a * a - (20 * a * d + d * d) / 100);
    return {
      prompt: md`For $${lim(String(a), "x^2")} = ${a * a}$ and $\varepsilon = ${eps}$, find the largest $\delta$ such that $0 < |x - ${a}| < \delta$ guarantees $|x^2 - ${a * a}| < \varepsilon$. Type a decimal.`,
      answer: delta,
      verify: [`(${a} + d)^2 - ${a * a} = ${eps}`],
      hint: md`Solve $${lo} < x^2 < ${hi}$ for $x > 0$. The window around ${a} is not symmetric, and $\delta$ must fit inside the shorter side.`,
      solution: [
        { math: md`|x^2 - ${a * a}| < ${eps} \iff ${lo} < x^2 < ${hi} \iff \sqrt{${lo}} < x < \sqrt{${hi}}`, note: md`For positive $x$, squaring and square-rooting preserve order.` },
        { math: md`\sqrt{${hi}} = ${dec(a + d / 10)}, \qquad \sqrt{${lo}} \approx ${dec(Math.sqrt(a * a - (20 * a * d + d * d) / 100))}`, note: md`$(${dec(a + d / 10)})^2 = ${hi}$ exactly.` },
        { math: md`\delta = \min\left(${dec(a + d / 10)} - ${a},\; ${a} - \sqrt{${lo}}\right) = ${delta}`, note: md`The right side of the window is shorter, because $x^2$ climbs faster to the right of ${a}. The symmetric window $|x - ${a}| < \delta$ has to fit inside it.` },
      ],
    };
  }
  if (kind === 1) {
    const s = r.int(2, 5);
    const a = s * s;
    const k = r.int(1, 3);
    const eps = dec(k / 10);
    const delta = dec((20 * s * k - k * k) / 100);
    const leftEnd = dec((s - k / 10) ** 2);
    const rightEnd = dec((s + k / 10) ** 2);
    return {
      prompt: md`For $${lim(String(a), "\\sqrt{x}")} = ${s}$ and $\varepsilon = ${eps}$, find the largest $\delta$ such that $0 < |x - ${a}| < \delta$ guarantees $|\sqrt{x} - ${s}| < \varepsilon$. Type a decimal.`,
      answer: delta,
      verify: [`sqrt(${a} - d) = ${s} - ${eps}`],
      hint: md`Solve $${dec(s - k / 10)} < \sqrt{x} < ${dec(s + k / 10)}$ by squaring. Then see which side of ${a} is closer.`,
      solution: [
        { math: md`|\sqrt{x} - ${s}| < ${eps} \iff ${dec(s - k / 10)} < \sqrt{x} < ${dec(s + k / 10)} \iff ${leftEnd} < x < ${rightEnd}`, note: "Square both ends (everything is positive, so order is kept)." },
        { math: md`${a} - ${leftEnd} = ${delta}, \qquad ${rightEnd} - ${a} = ${dec((s + k / 10) ** 2 - a)}`, note: md`The window around ${a} is lopsided.` },
        { math: md`\delta = ${delta}`, note: md`Take the shorter side. The square root rises more steeply to the left of ${a}, so that side hits the $\varepsilon$ bound first.` },
      ],
    };
  }
  const a = r.int(1, 3);
  const n = r.pick([2, 3, 4, 5, 10]);
  const delta = frac(a * a, n + a);
  const leftEnd = fracTex(a * n, n + a);
  return {
    prompt: md`For $${lim(String(a), "\\frac{1}{x}")} = ${fracTex(1, a)}$ and $\varepsilon = \frac{1}{${n}}$, find the largest $\delta$ such that $0 < |x - ${a}| < \delta$ guarantees $\left|\frac{1}{x} - ${fracTex(1, a)}\right| < \varepsilon$. ${NUM}`,
    answer: delta,
    verify: [`1/(${a} - d) - 1/${a} = 1/${n}`],
    hint: md`Solve $${fracTex(1, a)} - \frac{1}{${n}} < \frac{1}{x} < ${fracTex(1, a)} + \frac{1}{${n}}$ for positive $x$ by taking reciprocals, which reverse the inequalities.`,
    solution: [
      { math: md`${fracTex(n - a, a * n)} < \frac{1}{x} < ${fracTex(n + a, a * n)}`, note: md`$\frac{1}{${a}} \pm \frac{1}{${n}}$ with a common denominator.` },
      { math: md`${leftEnd} < x < ${n - a === 0 ? "\\infty" : fracTex(a * n, n - a)}`, note: md`Reciprocals of positive numbers flip the order.${n - a === 0 ? " The lower bound on $1/x$ is 0, so there is no upper bound on $x$." : ""}` },
      { math: md`\delta = ${a} - ${leftEnd} = ${fracTex(a * a, n + a)}`, note: md`The left side is the short one: $\frac{1}{x}$ changes fastest for small $x$. ${n - a === 0 ? "" : md`The right side allows $${fracTex(a * n, n - a)} - ${a} = ${fracTex(a * a, n - a)}$, which is more.`}` },
    ],
  };
};

const epsilonDeltaChoice: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const m = r.pick([-5, -4, -2, 2, 3, 4, 5]);
    const b = r.int(-4, 4);
    const a = r.int(-2, 3);
    const dk = r.pick([10, 20, 50]);
    const best = dk / 1000;
    const eps = dec(best * Math.abs(m));
    const good = dec(best / 2);
    const choices = shuffle(r, [good, dec(best * 2), dec(best * 5), dec(best * 10)]);
    return {
      prompt: md`Let $f(x) = ${poly([[m, "x"], [b, ""]])}$ and $L = f(${a}) = ${m * a + b}$. For $\varepsilon = ${eps}$, which of these values of $\delta$ guarantees that $0 < ${a === 0 ? "|x|" : `|x - ${paren(a)}|`} < \delta$ implies $|f(x) - L| < \varepsilon$?`,
      choices,
      accept: [good],
      hint: md`$|f(x) - L| = ${Math.abs(m)}${a === 0 ? "|x|" : `|x - ${paren(a)}|`}$. You need $${Math.abs(m)}\delta \le \varepsilon$.`,
      solution: [
        { math: md`|f(x) - L| = ${Math.abs(m)}\,|${xm(a)}|`, note: "A line scales distances by the size of its slope." },
        { math: md`${Math.abs(m)}\,\delta \le ${eps} \iff \delta \le ${dec(best)}`, note: md`So every $\delta$ up to ${dec(best)} works, and nothing larger does.` },
        { math: md`\delta = ${good}`, note: "The only option in that range. Smaller is always safe; the definition never asks for the largest." },
      ],
    };
  }
  if (kind === 1) {
    const right = "ε is chosen first, by the challenger; δ may depend on it";
    return {
      prompt: md`In the definition of $\lim_{x \to a} f(x) = L$, which comes first?`,
      choices: shuffle(r, [right, "δ is chosen first; ε may depend on it", "ε and δ are chosen together, once, for the whole function", "δ is fixed in advance by the function"]),
      accept: [right],
      hint: "Read the quantifiers in order: for every ε there exists δ.",
      solution: [
        { math: md`\forall\, \varepsilon > 0 \;\; \exists\, \delta > 0 : \; 0 < |x - a| < \delta \Rightarrow |f(x) - L| < \varepsilon`, note: "The challenger names a target closeness ε. Then we must produce a δ that achieves it. A different ε usually needs a different δ." },
      ],
    };
  }
  const right = "there is some ε > 0 for which no δ > 0 works";
  return {
    prompt: md`Which statement says exactly that $\lim_{x \to a} f(x) = L$ is **false**?`,
    choices: shuffle(r, [right, "for every ε > 0, no δ > 0 works", "there is some δ > 0 for which no ε > 0 works", "f(a) is not equal to L"]),
    accept: [right],
    hint: "Negate 'for every ε there is a δ': what is the opposite of 'for every'?",
    solution: [
      { math: md`\neg\left(\forall\, \varepsilon\; \exists\, \delta \ldots\right) = \exists\, \varepsilon \; \forall\, \delta \; \neg(\ldots)`, note: "To defeat the definition, the challenger needs only one ε that cannot be met. 'For every ε no δ works' is far stronger than needed, and f(a) is irrelevant: the limit never looks at a." },
    ],
  };
};

// ── Lesson 4: Continuity ────────────────────────────────────────────────────

const continuityK: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const c = r.int(-3, 3);
    const ln = line(r.nonzero(-3, 3), r.int(-5, 5));
    const k = ln.f(c) - c * c;
    const tex = cases(ln.tex, md`x < ${c}`, md`x^2 + k`, md`x \ge ${c}`);
    return {
      prompt: md`$$f(x) = ${tex}$$ Find the value of $k$ that makes $f$ continuous at $x = ${c}$. ${NUM}`,
      answer: String(k),
      verify: [`${ln.at(c)} = (${c})^2 + k`],
      hint: md`Continuity at ${c} needs the left limit, the right limit and $f(${c})$ all equal. Set the two pieces equal at $x = ${c}$.`,
      solution: [
        { math: md`${lim(String(c), "f(x)", "^-")} = ${ln.atTex(c)} = ${ln.f(c)}`, note: "The left piece's value as x approaches from below." },
        { math: md`${lim(String(c), "f(x)", "^+")} = f(${c}) = (${c})^2 + k = ${c * c} + k`, note: md`The right piece also gives $f(${c})$, since its condition includes ${c}.` },
        { math: md`${c * c} + k = ${ln.f(c)} \;\Rightarrow\; k = ${k}`, note: "Both sides must agree, and then the common value is f(c): all three conditions hold at once." },
      ],
    };
  }
  if (kind === 1) {
    const c = r.nonzero(-3, 3);
    const b = r.int(-5, 5);
    const right = line(r.nonzero(-3, 3), r.int(-5, 5));
    const target = right.f(c);
    const tex = cases(md`k${xp(b)}`, md`x \le ${c}`, right.tex, md`x > ${c}`);
    const k = frac(target - b, c);
    return {
      prompt: md`$$f(x) = ${tex}$$ Find the value of $k$ that makes $f$ continuous at $x = ${c}$. ${NUM}`,
      answer: k,
      verify: [`k*(${c}) ${signed(b)} = ${right.at(c)}`],
      hint: md`The right limit is ${target}. Make the left piece produce the same number at $x = ${c}$.`,
      solution: [
        { math: md`${lim(String(c), "f(x)", "^+")} = ${right.atTex(c)} = ${target}`, note: "Right piece at the seam." },
        { math: md`${lim(String(c), "f(x)", "^-")} = f(${c}) = k(${c}) ${signed(b)}`, note: "Left piece, which also defines f(c)." },
        { math: md`k(${c}) ${signed(b)} = ${target} \;\Rightarrow\; k = \frac{${target - b}}{${c}} = ${fracTex(target - b, c)}`, note: md`Solve for $k$.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.nonzero(-5, 5);
    const tex = cases(md`\dfrac{x^2 - ${a * a}}{${xm(a)}}`, md`x \ne ${a}`, md`k`, md`x = ${a}`);
    return {
      prompt: md`$$f(x) = ${tex}$$ Find the value of $k$ that makes $f$ continuous at $x = ${a}$. ${NUM}`,
      answer: String(2 * a),
      verify: [`k = ${a} + ${paren(a)}`],
      hint: md`$k$ must equal $\lim_{x \to ${a}} f(x)$. Find that limit by factoring; the value you assign fills the hole.`,
      solution: [
        { math: md`${lim(String(a), `\\frac{x^2 - ${a * a}}{${xm(a)}}`)} = ${lim(String(a), `(${xp(a)})`)} = ${2 * a}`, note: "Factor and cancel, as in lesson 2." },
        { math: md`k = f(${a}) = ${2 * a}`, note: md`Continuity means $f(${a})$ equals the limit. This is a removable discontinuity being removed.` },
      ],
    };
  }
  const c = r.nonzero(-3, 3);
  const ln = line(r.nonzero(-3, 3), r.int(-6, 6));
  const target = ln.f(c);
  const tex = cases(ln.tex, md`x < ${c}`, md`kx^2`, md`x \ge ${c}`);
  return {
    prompt: md`$$f(x) = ${tex}$$ Find the value of $k$ that makes $f$ continuous at $x = ${c}$. ${NUM}`,
    answer: frac(target, c * c),
    verify: [`k*(${c})^2 = ${ln.at(c)}`],
    hint: md`Set $k(${c})^2$ equal to the left piece's value at ${c}.`,
    solution: [
      { math: md`${lim(String(c), "f(x)", "^-")} = ${ln.atTex(c)} = ${target}`, note: "Left piece at the seam." },
      { math: md`f(${c}) = ${lim(String(c), "f(x)", "^+")} = k(${c})^2 = ${c * c === 1 ? "k" : `${c * c}k`}`, note: "Right piece." },
      { math: md`${c * c === 1 ? "k" : `${c * c}k`} = ${target}${c * c === 1 ? "" : ` \\;\\Rightarrow\\; k = ${fracTex(target, c * c)}`}`, note: "" },
    ],
  };
};

const classifyDiscontinuity: Generator = (r) => {
  const kind = r.int(0, 4);
  const ask = (fx: string, a: number) => md`Let $f(x) = ${fx}$. At $x = ${a}$, is $f$ continuous, or what kind of discontinuity does it have?`;
  if (kind === 0) {
    const a = r.int(-4, 4);
    let b = r.int(-5, 5);
    while (b === a) b = r.int(-5, 5);
    const num = poly([[1, "x^2"], [-(a + b), "x"], [a * b, ""]]);
    return {
      prompt: ask(md`\dfrac{${num}}{${xm(a)}}`, a),
      choices: DISC_CHOICES,
      accept: [DISC.removable],
      hint: md`Is $f(${a})$ defined? Does the limit exist? Factor the top.`,
      solution: [
        { math: md`f(x) = \frac{(${xm(a)})(${xm(b)})}{${xm(a)}} = ${xm(b)} \quad (x \ne ${a})`, note: md`$f(${a})$ is undefined ($\frac{0}{0}$), but the limit exists: $${lim(String(a), "f(x)")} = ${a - b}$.` },
        { math: md`\text{removable}`, note: md`A limit exists but the point is missing. Defining $f(${a}) = ${a - b}$ would make $f$ continuous: the hole can be filled.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(-4, 4);
    let b = r.int(-6, 6);
    while (b === -a) b = r.int(-6, 6);
    return {
      prompt: ask(md`\dfrac{${xp(b)}}{${xm(a)}}`, a),
      choices: DISC_CHOICES,
      accept: [DISC.infinite],
      hint: md`At $x = ${a}$ the bottom is $0$ but the top is ${a + b}, not $0$.`,
      solution: [
        { math: md`x \to ${a}: \quad \text{top} \to ${a + b} \ne 0, \quad \text{bottom} \to 0`, note: "A nonzero number divided by something shrinking to zero grows without bound." },
        { math: md`\text{infinite}`, note: md`$|f(x)| \to \infty$ on both sides of ${a}: a vertical asymptote. No value of $f(${a})$ could fix this.` },
      ],
    };
  }
  if (kind === 2) {
    const c = r.int(-3, 3);
    const left = line(r.nonzero(-3, 3), r.int(-4, 4));
    const m = r.nonzero(-3, 3);
    const b = left.f(c) - m * c + r.pick([-3, -2, -1, 1, 2, 3]);
    const right = line(m, b);
    return {
      prompt: md`$$f(x) = ${cases(left.tex, md`x < ${c}`, right.tex, md`x \ge ${c}`)}$$ At $x = ${c}$, is $f$ continuous, or what kind of discontinuity does it have?`,
      choices: DISC_CHOICES,
      accept: [DISC.jump],
      hint: "Compare the two one-sided limits.",
      solution: [
        { math: md`${lim(String(c), "f(x)", "^-")} = ${left.atTex(c)} = ${left.f(c)}, \qquad ${lim(String(c), "f(x)", "^+")} = ${right.atTex(c)} = ${right.f(c)}`, note: "Each piece at the seam." },
        { math: md`\text{jump}`, note: md`Both one-sided limits exist and are finite, but they differ (${left.f(c)} and ${right.f(c)}). The graph jumps by $${Math.abs(right.f(c) - left.f(c))}$.` },
      ],
    };
  }
  if (kind === 3) {
    const c = r.int(-3, 3);
    const left = line(r.nonzero(-3, 3), r.int(-4, 4));
    const m = r.nonzero(-3, 3);
    const right = line(m, left.f(c) - m * c);
    return {
      prompt: md`$$f(x) = ${cases(left.tex, md`x < ${c}`, right.tex, md`x \ge ${c}`)}$$ At $x = ${c}$, is $f$ continuous, or what kind of discontinuity does it have?`,
      choices: DISC_CHOICES,
      accept: [DISC.cont],
      hint: "Compare the two one-sided limits with each other and with f(c).",
      solution: [
        { math: md`${lim(String(c), "f(x)", "^-")} = ${left.atTex(c)} = ${left.f(c)}, \qquad ${lim(String(c), "f(x)", "^+")} = ${right.atTex(c)} = ${right.f(c)}`, note: "Each piece at the seam." },
        { math: md`f(${c}) = ${right.f(c)}`, note: md`The second piece's condition includes ${c}.` },
        { math: md`\text{continuous}`, note: "Limit from the left, limit from the right and the value all agree. The two pieces meet with no gap." },
      ],
    };
  }
  const a = r.int(-4, 4);
  return {
    prompt: ask(md`\dfrac{|${xm(a)}|}{${xm(a)}}`, a),
    choices: DISC_CHOICES,
    accept: [DISC.jump],
    hint: md`Work out $f$ separately for $x < ${a}$ and for $x > ${a}$.`,
    solution: [
      { math: md`x < ${a}: \; f(x) = \frac{-(${xm(a)})}{${xm(a)}} = -1, \qquad x > ${a}: \; f(x) = 1`, note: md`Absolute value flips the sign of a negative input.` },
      { math: md`\text{jump}`, note: md`One-sided limits $-1$ and $1$ both exist but differ. ($f(${a})$ is also undefined, but the jump is what matters: no single value could fix it.)` },
    ],
  };
};

const ivtInterval: Generator = (r) => {
  const kind = r.int(0, 1);
  if (kind === 0) {
    for (;;) {
      const p = r.int(0, 4);
      const q = r.int(-9, 9);
      const f = (x: number) => x ** 3 + p * x + q;
      const values = [-3, -2, -1, 0, 1, 2, 3].map(f);
      if (values.includes(0)) continue;
      const i = values.findIndex((v, k) => v < 0 && values[k + 1]! > 0);
      if (i < 0) continue;
      const n = i - 3;
      const tex = poly([[1, "x^3"], [p, "x"], [q, ""]]);
      const right = `[${n}, ${n + 1}]`;
      const others = [n - 2, n - 1, n + 1, n + 2].map((k) => `[${k}, ${k + 1}]`);
      const choices = shuffle(r, [right, ...shuffle(r, others).slice(0, 3)]);
      return {
        prompt: md`Let $f(x) = ${tex}$. By the Intermediate Value Theorem, which interval must contain a zero of $f$?`,
        choices,
        accept: [right],
        hint: "Evaluate f at the integer endpoints and look for a sign change. f is a polynomial, so it is continuous everywhere.",
        solution: [
          { math: md`f(${n}) = ${f(n)}, \qquad f(${n + 1}) = ${f(n + 1)}`, note: md`A negative value and a positive value.` },
          { math: md`f(${n}) < 0 < f(${n + 1})`, note: md`$0$ lies between $f(${n})$ and $f(${n + 1})$, and $f$ is continuous on $[${n}, ${n + 1}]$.` },
          { math: right, note: md`The IVT guarantees some $c$ in $(${n}, ${n + 1})$ with $f(c) = 0$. (Since $f$ is increasing here, that zero is the only one.)` },
        ],
      };
    }
  }
  const a = r.int(-2, 2);
  const b = a + r.int(2, 5);
  const u = r.int(-8, -1);
  const w = r.int(1, 8);
  const inside = r.int(u + 1, w - 1);
  const outside = shuffle(r, [u - r.int(1, 4), w + r.int(1, 4), u - r.int(5, 9), w + r.int(5, 9)]).slice(0, 3);
  const right = String(inside);
  return {
    prompt: md`A function $f$ is continuous on $[${a}, ${b}]$ with $f(${a}) = ${u}$ and $f(${b}) = ${w}$. Which of these values must $f$ take somewhere on $[${a}, ${b}]$?`,
    choices: shuffle(r, [right, ...outside.map(String)]),
    accept: [right],
    hint: "The IVT promises every value between f(a) and f(b). It promises nothing outside that range.",
    solution: [
      { math: md`${u} < ${inside} < ${w}`, note: md`${inside} lies between $f(${a})$ and $f(${b})$.` },
      { math: md`\exists\, c \in (${a}, ${b}): \; f(c) = ${inside}`, note: "Intermediate Value Theorem. The other options are outside the range between the two known values; f might reach them, but nothing forces it to." },
    ],
  };
};

// ── Lesson 5: Limits at infinity ────────────────────────────────────────────

/** Random polynomial of the given degree with a nonzero leading coefficient; returns [coefficients high to low]. */
function randomPoly(r: Rng, degree: number, lead?: number): number[] {
  const coeffs = [lead ?? r.nonzero(-5, 5)];
  for (let k = 1; k <= degree; k++) coeffs.push(r.int(-6, 6));
  return coeffs;
}

function polyTex(coeffs: number[]): string {
  const n = coeffs.length - 1;
  return poly(coeffs.map((c, i) => [c, n - i === 0 ? "" : n - i === 1 ? "x" : `x^${n - i}`] as [number, string]));
}

/** p(x) divided term by term by x^power, as LaTeX: (3x^2 + 5x - 1)/x^2 -> "3 + \\frac{5}{x} - \\frac{1}{x^{2}}". */
function dividedTex(coeffs: number[], power: number): string {
  const deg = coeffs.length - 1;
  let out = "";
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const e = deg - i - power;
    const mag = Math.abs(c);
    const term = e === 0 ? String(mag) : e > 0 ? `${mag === 1 ? "" : mag}${xPow(e)}` : `\\frac{${mag}}{${xPow(-e)}}`;
    out = out ? `${out} ${c < 0 ? "-" : "+"} ${term}` : (c < 0 ? "-" : "") + term;
  });
  return out || "0";
}

const rationalAtInfinity: Generator = (r) => {
  const n = r.int(1, 3);
  const m = r.int(1, 3);
  const num = randomPoly(r, n);
  const den = randomPoly(r, m, r.pick([1, 2, 3, 4, 5]) * (r.next() < 0.25 ? -1 : 1));
  const toNeg = r.next() < 0.3;
  const target = toNeg ? "-\\infty" : "\\infty";
  const body = md`\frac{${polyTex(num)}}{${polyTex(den)}}`;
  const a = num[0]!;
  const b = den[0]!;
  const topTex = dividedTex(num, Math.max(n, m));
  const botTex = dividedTex(den, Math.max(n, m));
  const tends = md`$\frac{c}{x^k} \to 0$ for every $k > 0$ as $x \to ${target}$`;
  if (n === m) {
    return {
      prompt: md`Find $${lim(target, body)}$. ${NUM}`,
      answer: frac(a, b),
      hint: md`Divide every term, top and bottom, by $${xPow(n)}$, the highest power present. Then let each $\frac{c}{x^k}$ go to $0$.`,
      solution: [
        { math: md`${body} = \frac{${topTex}}{${botTex}}`, note: md`Multiply top and bottom by $\frac{1}{${xPow(n)}}$. For $x \ne 0$ this changes nothing.` },
        { math: md`${lim(target, body)} = \frac{${a}}{${b}}${frac(a, b) === `${a}/${b}` ? "" : ` = ${fracTex(a, b)}`}`, note: md`${tends}, so the top tends to ${a} and the bottom to ${b}. The quotient law finishes it, since $${b} \ne 0$.` },
      ],
    };
  }
  if (n < m) {
    return {
      prompt: md`Find $${lim(target, body)}$. ${NUM}`,
      answer: "0",
      hint: md`Divide every term by $${xPow(m)}$, the highest power in the denominator. Every term on top then shrinks to $0$.`,
      solution: [
        { math: md`${body} = \frac{${topTex}}{${botTex}}`, note: md`Divide top and bottom by $${xPow(m)}$.` },
        { math: md`${lim(target, body)} = \frac{0}{${b}} = 0`, note: md`${tends}. The bottom keeps its constant ${b}; the top loses everything. The denominator grows faster than the numerator.` },
      ],
    };
  }
  // Numerator degree higher: the quotient is unbounded. Its sign comes from the leading coefficients and the parity of the degree gap.
  const topSign = Math.sign(a) * (toNeg ? (-1) ** (n - m) : 1);
  const sign = topSign * Math.sign(b);
  const right = sign > 0 ? INF.up : INF.down;
  const leadTex = poly([[a, xPow(n - m)]]);
  return {
    prompt: md`Find $${lim(target, body)}$.`,
    choices: [INF.up, INF.down, INF.zero, INF.num],
    accept: [right],
    hint: md`Divide every term by $${xPow(m)}$. The bottom settles to ${b}, but the top still has a power of $x$ in it.`,
    solution: [
      { math: md`${body} = \frac{${dividedTex(num, m)}}{${dividedTex(den, m)}}`, note: md`Divide top and bottom by $${xPow(m)}$, the highest power of the denominator.` },
      { math: md`\text{bottom} \to ${b}, \qquad \text{top} \sim ${leadTex} \to ${topSign > 0 ? "+" : "-"}\infty`, note: md`The leading term $${leadTex}$ dominates the top as $x \to ${target}$${toNeg && (n - m) % 2 === 1 ? ", and an odd power of a negative number is negative" : ""}.` },
      { math: md`${lim(target, body)} = ${sign > 0 ? "+" : "-"}\infty`, note: md`${b < 0 ? `Dividing by a bottom near ${b} < 0 flips the sign. ` : ""}The quotient ${sign > 0 ? "increases" : "decreases"} without bound. No horizontal asymptote in that direction.` },
    ],
  };
};

const verticalAsymptotes: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const p = r.int(-4, 4);
    let q = r.int(-4, 4);
    while (q === p) q = r.int(-4, 4);
    let b = r.int(-6, 6);
    while (b === -p || b === -q) b = r.int(-6, 6);
    const den = poly([[1, "x^2"], [-(p + q), "x"], [p * q, ""]]);
    return {
      prompt: md`Find every vertical asymptote of $f(x) = \dfrac{${xp(b)}}{${den}}$. Give the $x$-values as a comma-separated list, like 1, 2.`,
      answer: `${Math.min(p, q)}, ${Math.max(p, q)}`,
      form: "set",
      verify: [`${den.replace(/x\^2/, "x^2")} = 0`],
      hint: "Factor the denominator. A vertical asymptote is where the bottom is zero and the top is not.",
      solution: [
        { math: md`${den} = (${xm(p)})(${xm(q)})`, note: "Factor." },
        { math: md`x = ${Math.min(p, q)}, \; x = ${Math.max(p, q)}`, note: md`At each, the top is ${Math.min(p, q) + b} or ${Math.max(p, q) + b}, not zero, so $|f(x)| \to \infty$ there. Both are vertical asymptotes.` },
      ],
    };
  }
  if (kind === 1) {
    const p = r.int(-4, 4);
    let q = r.int(-4, 4);
    while (q === p) q = r.int(-4, 4);
    let b = r.int(-6, 6);
    while (b === -p || b === -q) b = r.int(-6, 6);
    const num = poly([[1, "x^2"], [b - p, "x"], [-p * b, ""]]);
    const den = poly([[1, "x^2"], [-(p + q), "x"], [p * q, ""]]);
    return {
      prompt: md`Find every vertical asymptote of $f(x) = \dfrac{${num}}{${den}}$. Give the $x$-values as a comma-separated list, or a single number.`,
      answer: String(q),
      verify: [`${den} = 0`],
      hint: "Factor top and bottom. A zero of the bottom that is also a zero of the top may be a hole, not an asymptote.",
      solution: [
        { math: md`f(x) = \frac{(${xm(p)})(${xp(b)})}{(${xm(p)})(${xm(q)})} = \frac{${xp(b)}}{${xm(q)}} \quad (x \ne ${p})`, note: "Factor and cancel." },
        { math: md`x = ${p}: \; ${lim(String(p), "f(x)")} = ${fracTex(p + b, p - q)}`, note: md`The limit exists, so $x = ${p}$ is a hole (removable discontinuity), not an asymptote.` },
        { math: md`x = ${q}`, note: md`There the simplified bottom is $0$ and the top is $${q + b} \ne 0$: a vertical asymptote.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(-4, 4);
    let b = r.int(-6, 6);
    while (b === -a) b = r.int(-6, 6);
    const fromRight = r.next() < 0.5;
    const side = fromRight ? "^+" : "^-";
    const body = md`\frac{${xp(b)}}{${xm(a)}}`;
    const topSign = Math.sign(a + b);
    const botSign = fromRight ? 1 : -1;
    const right = topSign * botSign > 0 ? INF.up : INF.down;
    return {
      prompt: md`Find $${lim(String(a), body, side)}$.`,
      choices: [INF.up, INF.down],
      accept: [right],
      hint: md`Near $x = ${a}$ the top is close to ${a + b}. Decide the sign of the bottom for $x$ ${fromRight ? "slightly more" : "slightly less"} than ${a}.`,
      solution: [
        { math: md`x \to ${a}${side}: \quad \text{top} \to ${a + b}\; (${topSign > 0 ? "positive" : "negative"}), \quad \text{bottom} \to 0${fromRight ? "^+" : "^-"}`, note: md`${fromRight ? `For $x$ just above $${a}$, $${xm(a)}$ is a small positive number.` : `For $x$ just below $${a}$, $${xm(a)}$ is a small negative number.`}` },
        { math: md`\frac{${topSign > 0 ? "+" : "-"}}{${fromRight ? "0^+" : "0^-"}} \to ${topSign * botSign > 0 ? "+" : "-"}\infty`, note: md`A number near ${a + b} divided by a tiny ${fromRight ? "positive" : "negative"} number is huge and ${topSign * botSign > 0 ? "positive" : "negative"}.` },
      ],
    };
  }
  const a = r.int(-4, 4);
  const c = r.nonzero(-5, 5);
  const fromRight = r.next() < 0.5;
  const side = fromRight ? "^+" : "^-";
  const body = md`\frac{${c}}{(${xm(a)})^2}`;
  return {
    prompt: md`Find $${lim(String(a), body, side)}$.`,
    choices: [INF.up, INF.down],
    accept: [c > 0 ? INF.up : INF.down],
    hint: "A square is never negative. Which sign does the quotient have on this side?",
    solution: [
      { math: md`(${xm(a)})^2 \to 0^+ \text{ from either side}`, note: "A square of a small nonzero number is small and positive." },
      { math: md`\frac{${c}}{0^+} \to ${c > 0 ? "+" : "-"}\infty`, note: md`The sign is the sign of ${c}. Here the two one-sided limits agree, so even $\lim_{x \to ${a}} f(x) = ${c > 0 ? "+" : "-"}\infty$.` },
    ],
  };
};

/** (n/d) pi in LaTeX, with coefficients 1 and -1 hidden. */
const piTex = (n: number, d: number) => (frac(n, d) === "1" ? "\\pi" : frac(n, d) === "-1" ? "-\\pi" : `${fracTex(n, d)}\\pi`);

const rootsAtInfinity: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const a = r.nonzero(-5, 5);
    const b = r.int(-6, 6);
    const s = r.pick([1, 2, 3, 4]);
    const d = r.int(1, 9);
    const toNeg = r.next() < 0.4;
    const target = toNeg ? "-\\infty" : "\\infty";
    const body = md`\frac{${poly([[a, "x"], [b, ""]])}}{\sqrt{${poly([[s * s, "x^2"], [d, ""]])}}}`;
    const ans = frac(toNeg ? -a : a, s);
    return {
      prompt: md`Find $${lim(target, body)}$. ${NUM}`,
      answer: ans,
      hint: md`Divide top and bottom by $x$. Under the root, $x = ${toNeg ? "-" : ""}\sqrt{x^2}$ for ${toNeg ? "negative" : "positive"} $x$, so dividing by $x$ inside means dividing by ${toNeg ? "$-\\sqrt{x^2}$" : "$\\sqrt{x^2}$"}.`,
      solution: [
        { math: md`\sqrt{x^2} = |x| = ${toNeg ? "-x" : "x"} \quad (x ${toNeg ? "<" : ">"} 0)`, note: md`Toward $${target}$, $x$ is ${toNeg ? "negative, and the root is positive, so $\\sqrt{x^2} = -x$" : "positive"}.` },
        { math: md`${body} = \frac{${a} + \frac{${b}}{x}}{${toNeg ? "-" : ""}\sqrt{${s * s} + \frac{${d}}{x^2}}}`, note: md`Divide top and bottom by $x$; under the root that is dividing by $x^2$${toNeg ? ", with a minus sign out front because $x = -\\sqrt{x^2}$" : ""}.` },
        { math: md`${lim(target, body)} = \frac{${a}}{${toNeg ? "-" : ""}\sqrt{${s * s}}} = ${fracTex(toNeg ? -a : a, s)}`, note: md`$\frac{${b}}{x} \to 0$ and $\frac{${d}}{x^2} \to 0$.` },
      ],
    };
  }
  if (kind === 1) {
    const b = r.pick([2, 4, 6, 8, 3, 5]);
    const body = md`\left(\sqrt{x^2 + ${b}x} - x\right)`;
    return {
      prompt: md`Find $${lim("\\infty", body)}$. ${NUM}`,
      answer: frac(b, 2),
      hint: md`This is $\infty - \infty$, which tells you nothing. Multiply by the conjugate $\frac{\sqrt{x^2 + ${b}x} + x}{\sqrt{x^2 + ${b}x} + x}$.`,
      solution: [
        { math: md`\sqrt{x^2 + ${b}x} - x = \frac{(x^2 + ${b}x) - x^2}{\sqrt{x^2 + ${b}x} + x} = \frac{${b}x}{\sqrt{x^2 + ${b}x} + x}`, note: md`$(u - v)(u + v) = u^2 - v^2$ removes the root from the top.` },
        { math: md`= \frac{${b}}{\sqrt{1 + \frac{${b}}{x}} + 1}`, note: md`Divide top and bottom by $x$ (positive, so $x = \sqrt{x^2}$).` },
        { math: md`${lim("\\infty", body)} = \frac{${b}}{\sqrt{1} + 1} = ${fracTex(b, 2)}`, note: md`$\frac{${b}}{x} \to 0$.` },
      ],
    };
  }
  if (kind === 2) {
    const c = r.int(1, 9);
    const d = r.int(-5, 5);
    const toNeg = r.next() < 0.5;
    const target = toNeg ? "-\\infty" : "\\infty";
    const body = md`\frac{\sqrt{x^2 + ${c}}}{${xp(d)}}`;
    return {
      prompt: md`Find $${lim(target, body)}$. ${NUM}`,
      answer: toNeg ? "-1" : "1",
      hint: md`Divide top and bottom by $x$, remembering that for ${toNeg ? "negative" : "positive"} $x$, $\sqrt{x^2} = ${toNeg ? "-x" : "x"}$.`,
      solution: [
        { math: md`\frac{\sqrt{x^2 + ${c}}}{${xp(d)}} = \frac{${toNeg ? "-" : ""}\sqrt{1 + \frac{${c}}{x^2}}}{1 ${d === 0 ? "" : `+ \\frac{${d}}{x}`}}`, note: md`Dividing the root by $x$ means dividing inside by $x^2$${toNeg ? " and attaching a minus sign, since $x = -\\sqrt{x^2}$ when $x < 0$" : ""}.` },
        { math: md`${lim(target, body)} = \frac{${toNeg ? "-" : ""}\sqrt{1 + 0}}{1 + 0} = ${toNeg ? "-1" : "1"}`, note: md`The graph has horizontal asymptotes $y = 1$ on the right and $y = -1$ on the left.` },
      ],
    };
  }
  if (kind === 3) {
    const p = r.coef(-6, 6);
    const q = r.nonzero(-6, 6);
    const body = md`\left(${p}e^{-x} ${signed(q)}\right)`;
    return {
      prompt: md`Find $${lim("\\infty", body)}$. ${NUM}`,
      answer: String(q),
      hint: md`$e^{-x} = \frac{1}{e^x}$, and $e^x$ grows without bound.`,
      solution: [
        { math: md`${lim("\\infty", "e^{-x}")} = ${lim("\\infty", "\\frac{1}{e^x}")} = 0`, note: md`$e^x \to \infty$, so its reciprocal shrinks to $0$.` },
        { math: md`${lim("\\infty", body)} = ${p} \cdot 0 ${signed(q)} = ${q}`, note: md`Constant-multiple and sum laws. The horizontal asymptote is $y = ${q}$.` },
      ],
    };
  }
  const k = r.coef(-4, 4);
  const toNeg = r.next() < 0.5;
  const target = toNeg ? "-\\infty" : "\\infty";
  const body = md`${k}\arctan(x)`;
  const ans = toNeg ? frac(-k, 2) : frac(k, 2);
  return {
    prompt: md`Find $${lim(target, body)}$. Give an exact answer; type pi for $\pi$.`,
    answer: `(${ans})*pi`,
    hint: md`$\arctan x$ is the angle in $\left(-\frac{\pi}{2}, \frac{\pi}{2}\right)$ whose tangent is $x$. What angle has a tangent that is enormous and ${toNeg ? "negative" : "positive"}?`,
    solution: [
      { math: md`${lim(target, "\\arctan(x)")} = ${toNeg ? "-" : ""}\frac{\pi}{2}`, note: md`$\tan \theta \to ${toNeg ? "-" : "+"}\infty$ as $\theta \to ${toNeg ? "-" : ""}\frac{\pi}{2}$ from inside the interval, so the inverse sends huge ${toNeg ? "negative" : "positive"} inputs toward $${toNeg ? "-" : ""}\frac{\pi}{2}$ without reaching it.` },
      { math: md`${lim(target, body)} = ${k} \cdot \left(${toNeg ? "-" : ""}\frac{\pi}{2}\right) = ${piTex(toNeg ? -k : k, 2)}`, note: "Constant-multiple law." },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit1: Unit = {
  title: "Limits",
  lessons: [
    {
      id: slug("The idea of a limit"),
      title: "The idea of a limit",
      summary: "What 'approaches' means, why the value at the point is irrelevant, and limits from each side.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 3 you built tables of secant slopes and watched them settle toward one number as the second point slid in. You never reached that number by substitution: at the point itself the slope formula gave $\frac{0}{0}$. Calculus begins by taking that experience seriously. The question is not "what is $f(a)$?" but "what is $f(x)$ heading toward as $x$ heads toward $a$?"

Take $f(x) = \dfrac{x^2 - 1}{x - 1}$. At $x = 1$ it is undefined. Everywhere else it is perfectly ordinary:

- $x = 0.9$: $f(x) = 1.9$
- $x = 0.99$: $f(x) = 1.99$
- $x = 1.01$: $f(x) = 2.01$
- $x = 1.1$: $f(x) = 2.1$

The outputs crowd in on $2$ from both sides. Nothing stops them except the single missing input.`,
        },
        {
          kind: "plot",
          x: [-2, 4],
          y: [-1, 5],
          curves: [{ expr: "(x^2 - 1)/(x - 1)", label: "y = \\frac{x^2 - 1}{x - 1}" }],
          points: [{ x: 1, y: 2, open: true, label: "\\text{hole at } (1, 2)" }],
          caption: md`The graph is the line $y = x + 1$ with one point removed. The open circle marks the input that has no output. The limit is the height the curve is heading for, and the hole does not change it.`,
        },
        {
          kind: "key",
          title: "Limit (informal)",
          body: md`We write

$$\lim_{x \to a} f(x) = L$$

and say "the limit of $f(x)$ as $x$ approaches $a$ is $L$" when $f(x)$ can be made as close to $L$ as we like by taking $x$ close enough to $a$, **without $x$ being equal to $a$**.

The limit describes the behaviour of $f$ near $a$. It says nothing about $f(a)$, which may be undefined, or defined and different.`,
        },
        {
          kind: "why",
          title: "Why the value at the point doesn't matter",
          body: md`The definition only ever looks at inputs $x \ne a$. Change $f(a)$ to anything you like, or delete it: every input the limit examines is untouched, so the limit is untouched.

Define $g(x) = x + 1$ for $x \ne 1$ and $g(1) = 5$. Then $\lim_{x \to 1} g(x) = 2$, exactly as before, while $g(1) = 5$. A limit and a value are two different questions about a function. Often they have the same answer (Lesson 4 is about when), but the definition keeps them separate on purpose: the whole point of a limit is to describe a trend at a place the function may not reach.`,
        },
        {
          kind: "plot",
          x: [-2, 4],
          y: [-1, 6],
          curves: [{ expr: "x + 1", label: "y = g(x)" }],
          points: [
            { x: 1, y: 2, open: true },
            { x: 1, y: 5, label: "g(1) = 5", color: 2 },
          ],
          caption: md`$\lim_{x \to 1} g(x) = 2$ even though $g(1) = 5$. Following the curve toward $x = 1$ from either side leads to height 2. The isolated dot is where the function actually is at 1.`,
        },
        {
          kind: "example",
          title: "Guessing a limit from a table",
          problem: md`Estimate $\lim_{x \to 0} \dfrac{\sin x}{x}$ (with $x$ in radians).`,
          steps: [
            { math: md`x = \pm 0.5:\; 0.9589, \qquad x = \pm 0.1:\; 0.9983`, note: md`$\frac{\sin x}{x}$ is even, so each pair of inputs gives the same output. We cannot substitute $x = 0$: that is $\frac{0}{0}$.` },
            { math: md`x = \pm 0.01:\; 0.99998, \qquad x = \pm 0.001:\; 0.9999998`, note: "Each step closer to 0 moves the output closer to 1." },
            { math: md`\lim_{x \to 0} \frac{\sin x}{x} = 1 \text{ (conjecture)}`, note: "A table can suggest but never prove. In the next lesson we prove this one with areas in the unit circle." },
          ],
        },
        {
          kind: "plot",
          x: [-10, 10],
          y: [-0.5, 1.5],
          curves: [{ expr: "sin(x)/x", label: "y = \\frac{\\sin x}{x}" }],
          points: [{ x: 0, y: 1, open: true }],
          caption: md`The curve has a hole at $x = 0$ and visibly heads for height 1 on both sides.`,
        },
        {
          kind: "text",
          body: md`Sometimes the two sides disagree. Take $f(x) = \dfrac{|x|}{x}$. For negative $x$, $|x| = -x$ and $f(x) = -1$. For positive $x$, $f(x) = 1$. Coming toward $0$ from the left, the outputs are all $-1$; from the right, all $1$. There is no single number the function approaches, so $\lim_{x \to 0} \frac{|x|}{x}$ does not exist. But each side on its own has a clear answer, and that deserves a notation.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-2, 2],
          curves: [
            { expr: "-1", domain: [-3, 0], label: "y = \\frac{|x|}{x}" },
            { expr: "1", domain: [0, 3], color: 1 },
          ],
          points: [
            { x: 0, y: -1, open: true },
            { x: 0, y: 1, open: true },
          ],
          caption: md`From the left the function approaches $-1$; from the right, $1$. The two-sided limit at 0 does not exist.`,
        },
        {
          kind: "key",
          title: "One-sided limits",
          body: md`$\lim_{x \to a^-} f(x) = L$ (the **left-hand limit**) means $f(x)$ approaches $L$ as $x$ approaches $a$ through values **less than** $a$.

$\lim_{x \to a^+} f(x) = L$ (the **right-hand limit**) means the same through values **greater than** $a$.

The two-sided limit exists exactly when both one-sided limits exist and are equal:

$$\lim_{x \to a} f(x) = L \iff \lim_{x \to a^-} f(x) = L \text{ and } \lim_{x \to a^+} f(x) = L.$$`,
        },
        {
          kind: "why",
          title: "Why both sides must agree",
          body: md`"Close enough to $a$" in the definition means close on either side. Inputs just below $a$ and inputs just above $a$ are both near $a$, so both must produce outputs near $L$. If the left side heads for $-1$ and the right side for $1$, then no matter how tightly you squeeze around $0$, you find outputs a full 2 units apart. No single $L$ can be close to both. That is the only way a two-sided limit can fail while both one-sided limits exist, and it is why piecewise functions are where one-sided limits matter most: at a seam, each side is governed by a different formula.`,
        },
        {
          kind: "example",
          title: "One-sided limits at a seam",
          problem: md`Let $f(x) = \begin{cases} x + 2 & \text{if } x < 1 \\ x^2 + 1 & \text{if } x \ge 1 \end{cases}$. Find $\lim_{x \to 1^-} f(x)$, $\lim_{x \to 1^+} f(x)$, $\lim_{x \to 1} f(x)$ and $f(1)$.`,
          steps: [
            { math: md`\lim_{x \to 1^-} f(x) = \lim_{x \to 1^-} (x + 2) = 3`, note: md`Inputs below 1 use the first formula, which has no gap, so the limit is its value at 1.` },
            { math: md`\lim_{x \to 1^+} f(x) = \lim_{x \to 1^+} (x^2 + 1) = 2`, note: "Inputs above 1 use the second formula." },
            { math: md`\lim_{x \to 1} f(x) \text{ does not exist}`, note: md`$3 \ne 2$. The graph jumps at $x = 1$.` },
            { math: md`f(1) = 1^2 + 1 = 2`, note: md`The value comes from whichever condition includes 1: here $x \ge 1$. The value exists even though the two-sided limit doesn't.` },
          ],
        },
        {
          kind: "plot",
          x: [-3, 4],
          y: [-2, 8],
          curves: [
            { expr: "x + 2", domain: [-3, 1], label: "y = f(x)" },
            { expr: "x^2 + 1", domain: [1, 4], color: 1 },
          ],
          points: [
            { x: 1, y: 3, open: true },
            { x: 1, y: 2 },
          ],
          vlines: [{ x: 1 }],
          caption: md`The seam at $x = 1$. The left branch stops at an open circle at height 3; the right branch starts with a solid dot at height 2, which is $f(1)$.`,
        },
        {
          kind: "text",
          body: md`Two other ways a limit can fail to be a number. The function may **grow without bound**: as $x \to 0$, $\frac{1}{x^2}$ passes $100$, then $10^6$, then every number you name. We write $\lim_{x \to 0} \frac{1}{x^2} = \infty$ as a description of that behaviour, remembering that $\infty$ is not a number and the limit does not exist as a number. (Lesson 5 returns to this.) Or the function may **oscillate**: $\sin\frac{1}{x}$ swings between $-1$ and $1$ infinitely often in any window around $0$, however small, so it approaches nothing at all.`,
        },
        {
          kind: "plot",
          x: [-0.3, 0.3],
          y: [-1.5, 1.5],
          curves: [{ expr: "sin(1/x)", label: "y = \\sin\\frac{1}{x}" }],
          caption: md`Near $x = 0$ the oscillations get faster without end. Zooming in never helps: the graph never settles, so there is no limit, not even a one-sided one.`,
        },
        {
          kind: "check",
          prompt: md`Find $\lim_{x \to 3} \dfrac{x^2 - 9}{x - 3}$ by trying inputs near 3. Type a number, or DNE if the limit does not exist.`,
          answer: "6",
          explain: md`At $x = 2.9$ the value is $5.9$; at $3.01$ it is $6.01$. The outputs approach 6. (For $x \ne 3$, the fraction equals $x + 3$.)`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = \begin{cases} 2x & \text{if } x < 2 \\ 7 - x & \text{if } x \ge 2 \end{cases}$. Find $\lim_{x \to 2^+} f(x)$. Type a number, or DNE if the limit does not exist.`,
          answer: "5",
          explain: md`From the right, inputs are above 2 and use $7 - x$, which approaches $7 - 2 = 5$. (From the left the limit is $4$, so the two-sided limit does not exist.)`,
        },
      ],
      practice: [limitFromTable, oneSidedPiecewise, limitFromGraph],
    },
    {
      id: slug("Limit laws"),
      title: "Limit laws",
      summary: "Rules for computing limits, why they hold, the factor-and-cancel method, the squeeze theorem, and sin x over x.",
      blocks: [
        {
          kind: "text",
          body: md`Tables are slow, and they can mislead: a function might look like it settles at $0.9999998$ and really be heading for $0.9999997$. We want rules that compute limits exactly. The rules come from one idea: if two quantities are each close to a target, then their sum, difference, product and quotient are close to the corresponding combination of the targets.`,
        },
        {
          kind: "key",
          title: "The limit laws",
          body: md`Suppose $\lim_{x \to a} f(x) = L$ and $\lim_{x \to a} g(x) = M$, and $c$ is a constant. Then

- **Sum and difference:** $\lim_{x \to a} [f(x) \pm g(x)] = L \pm M$
- **Constant multiple:** $\lim_{x \to a} c\,f(x) = cL$
- **Product:** $\lim_{x \to a} f(x)\,g(x) = LM$
- **Quotient:** $\lim_{x \to a} \dfrac{f(x)}{g(x)} = \dfrac{L}{M}$, provided $M \ne 0$
- **Power:** $\lim_{x \to a} [f(x)]^n = L^n$ for a positive integer $n$
- **Root:** $\lim_{x \to a} \sqrt[n]{f(x)} = \sqrt[n]{L}$, provided $L > 0$ when $n$ is even

And two starting points: $\lim_{x \to a} c = c$ and $\lim_{x \to a} x = a$.`,
        },
        {
          kind: "why",
          title: "Why the laws are believable",
          body: md`Write $f(x) = L + u$ and $g(x) = M + v$, where $u$ and $v$ are the errors. "Approaches" means the errors shrink to nothing as $x \to a$.

- **Sum:** $f + g = (L + M) + (u + v)$. Two tiny errors add to a tiny error.
- **Product:** $fg = LM + Lv + Mu + uv$. Each extra term has a factor that shrinks to 0, and a bounded number times a shrinking one shrinks. So the error $Lv + Mu + uv$ shrinks.
- **Quotient:** $\dfrac{f}{g} - \dfrac{L}{M} = \dfrac{Mu - Lv}{gM}$. The top shrinks. The bottom stays away from 0 because $g$ is near $M \ne 0$. A shrinking top over a bottom that doesn't shrink gives a shrinking fraction. If $M = 0$ the bottom collapses too, and the law says nothing.

The power law is the product law applied $n$ times. In Lesson 3 we make "shrinks" precise and turn the sum argument into a real proof.`,
        },
        {
          kind: "key",
          title: "Direct substitution",
          body: md`If $p$ is a polynomial, then $\lim_{x \to a} p(x) = p(a)$. If $r$ is a rational function and $a$ is in its domain, then $\lim_{x \to a} r(x) = r(a)$.`,
        },
        {
          kind: "why",
          title: "Why substitution is allowed for polynomials",
          body: md`A polynomial is built from constants and $x$ using sums, constant multiples and powers. We know $\lim_{x \to a} x = a$ and $\lim_{x \to a} c = c$. The laws let us push the limit through every operation used to build the polynomial, and what comes out is the polynomial evaluated at $a$:

$$\lim_{x \to a}(3x^2 - 5x + 1) = 3\left(\lim_{x \to a} x\right)^2 - 5\lim_{x \to a} x + 1 = 3a^2 - 5a + 1.$$

A rational function is a quotient of two polynomials; the quotient law applies as long as the denominator's limit, its value at $a$, is not zero. So substitution is not a separate rule. It is the laws, applied all at once.`,
        },
        {
          kind: "text",
          body: md`The interesting limits are the ones where substitution fails because it gives $\dfrac{0}{0}$. The quotient law is silent then: it needs $M \ne 0$. But $\frac{0}{0}$ is not an answer, it is a signal that the top and bottom share a factor that vanishes at $a$. Remove it and the laws apply again. This works because of one fact.`,
        },
        {
          kind: "key",
          title: "Functions that agree near a point",
          body: md`If $f(x) = g(x)$ for all $x \ne a$ in some interval around $a$, then

$$\lim_{x \to a} f(x) = \lim_{x \to a} g(x)$$

whenever either limit exists.`,
        },
        {
          kind: "why",
          title: "Why cancelling a factor is legal",
          body: md`$\dfrac{x^2 - 1}{x - 1}$ and $x + 1$ are different functions: the first is undefined at $1$, the second is not. But they agree at every other input. A limit as $x \to 1$ only ever samples inputs $x \ne 1$, and at every one of those the two functions return identical values. So the limit cannot tell them apart. Cancelling $(x - 1)$ does not change any value the limit looks at; it only tidies the formula so substitution can finish the job.`,
        },
        {
          kind: "example",
          title: "Factor and cancel",
          problem: md`Find $\lim_{x \to 2} \dfrac{x^2 - 5x + 6}{x - 2}$.`,
          steps: [
            { math: md`\frac{2^2 - 5 \cdot 2 + 6}{2 - 2} = \frac{0}{0}`, note: "Substitution fails. That tells us (x - 2) divides the numerator." },
            { math: md`\frac{x^2 - 5x + 6}{x - 2} = \frac{(x - 2)(x - 3)}{x - 2} = x - 3 \quad (x \ne 2)`, note: "Factor and cancel. The new expression agrees with the old one at every input except 2." },
            { math: md`\lim_{x \to 2} \frac{x^2 - 5x + 6}{x - 2} = \lim_{x \to 2}(x - 3) = -1`, note: "Same limit, and the second one is a polynomial: substitute." },
          ],
        },
        {
          kind: "example",
          title: "Rationalize",
          problem: md`Find $\lim_{x \to 0} \dfrac{\sqrt{x + 9} - 3}{x}$.`,
          steps: [
            { math: md`\frac{\sqrt{x + 9} - 3}{x} \cdot \frac{\sqrt{x + 9} + 3}{\sqrt{x + 9} + 3} = \frac{(x + 9) - 9}{x(\sqrt{x + 9} + 3)}`, note: md`Multiply by the conjugate: $(u - v)(u + v) = u^2 - v^2$ clears the root from the top.` },
            { math: md`= \frac{x}{x(\sqrt{x + 9} + 3)} = \frac{1}{\sqrt{x + 9} + 3} \quad (x \ne 0)`, note: "The hidden common factor was x. Cancel it." },
            { math: md`\lim_{x \to 0} \frac{\sqrt{x + 9} - 3}{x} = \frac{1}{\sqrt{9} + 3} = \frac{1}{6}`, note: "Root, sum and quotient laws: the bottom is now 6, not 0." },
          ],
        },
        {
          kind: "example",
          title: "Clear a complex fraction",
          problem: md`Find $\lim_{x \to 3} \dfrac{\frac{1}{x} - \frac{1}{3}}{x - 3}$.`,
          steps: [
            { math: md`\frac{1}{x} - \frac{1}{3} = \frac{3 - x}{3x}`, note: "Combine the top into one fraction." },
            { math: md`\frac{3 - x}{3x(x - 3)} = \frac{-(x - 3)}{3x(x - 3)} = -\frac{1}{3x} \quad (x \ne 3)`, note: md`$3 - x = -(x - 3)$. Cancel.` },
            { math: md`\lim_{x \to 3} \frac{\frac{1}{x} - \frac{1}{3}}{x - 3} = -\frac{1}{9}`, note: "Substitute into the simplified form." },
          ],
        },
        {
          kind: "text",
          body: md`Some functions cannot be simplified into something you can substitute into. $x^2 \sin\frac{1}{x}$ has no algebraic rewrite that removes the oscillation. For these there is a different tool: trap the function between two simpler ones.`,
        },
        {
          kind: "key",
          title: "The squeeze theorem",
          body: md`If $g(x) \le f(x) \le h(x)$ for all $x$ near $a$ (except possibly at $a$), and

$$\lim_{x \to a} g(x) = \lim_{x \to a} h(x) = L,$$

then $\lim_{x \to a} f(x) = L$.`,
        },
        {
          kind: "why",
          title: "Why squeezing works",
          body: md`Near $a$, $g$ and $h$ are both within any tolerance you choose of $L$: $g$ is above $L - \varepsilon$ and $h$ is below $L + \varepsilon$. Since $f$ sits between them, $L - \varepsilon < g(x) \le f(x) \le h(x) < L + \varepsilon$. So $f$ is within the same tolerance of $L$. That is exactly what "$f$ approaches $L$" means. The function $f$ has nowhere else to go.`,
        },
        {
          kind: "plot",
          x: [-0.5, 0.5],
          y: [-0.3, 0.3],
          curves: [
            { expr: "x^2 sin(1/x)", label: "y = x^2 \\sin\\frac{1}{x}" },
            { expr: "x^2", label: "y = x^2", color: 2, dashed: true },
            { expr: "-x^2", label: "y = -x^2", color: 2, dashed: true },
          ],
          caption: md`Because $-1 \le \sin\frac{1}{x} \le 1$, multiplying by $x^2 \ge 0$ gives $-x^2 \le x^2 \sin\frac{1}{x} \le x^2$. Both bounds go to 0 at $x = 0$, so the oscillating function is forced to 0 as well.`,
        },
        {
          kind: "text",
          body: md`The squeeze theorem's most important job is the limit from the last lesson's table: $\lim_{x \to 0} \frac{\sin x}{x} = 1$. Every trigonometric derivative in Unit 3 rests on it. The proof compares three areas in the unit circle. Drag the slider to watch them.`,
        },
        {
          kind: "diagram",
          view: [-0.3, 1.6, -0.3, 1.6],
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "A", x: 1, y: 0, dir: "se" },
            { name: "P", x: "cos(t)", y: "sin(t)", dir: "nw" },
            { name: "T", x: 1, y: "tan(t)", dir: "ne" },
            { name: "Q", x: "cos(t)", y: 0, dir: "s" },
          ],
          segments: [
            { from: "O", to: "A" },
            { from: "O", to: "T" },
            { from: "A", to: "T", label: "\\tan\\theta", color: 3 },
            { from: "P", to: "Q", dashed: true, label: "\\sin\\theta", color: 2 },
            { from: "A", to: "P", color: 2 },
          ],
          arcs: [{ center: "O", from: "A", to: "P", color: 1 }],
          angles: [{ at: "O", from: "A", to: "P", label: "\\theta" }],
          polygons: [{ points: ["O", "A", "P"], fill: 2 }],
          params: [{ name: "t", tex: "\\theta", min: 0.15, max: 1.3, step: 0.05, value: 0.7 }],
          readouts: [
            { label: "\\tfrac{1}{2}\\sin\\theta", value: "sin(t)/2" },
            { label: "\\tfrac{1}{2}\\theta", value: "t/2" },
            { label: "\\tfrac{1}{2}\\tan\\theta", value: "tan(t)/2" },
          ],
          caption: md`Unit circle, radius $OA = 1$. Triangle $OAP$ (shaded) sits inside the sector $OAP$ (bounded by the arc), which sits inside triangle $OAT$. Their areas are $\frac12 \sin\theta$, $\frac12 \theta$ and $\frac12 \tan\theta$. As $\theta$ shrinks, all three agree more and more closely.`,
        },
        {
          kind: "proof",
          title: "The limit of sin x over x",
          given: md`$0 < \theta < \frac{\pi}{2}$, with $O = (0, 0)$, $A = (1, 0)$, $P = (\cos\theta, \sin\theta)$ on the unit circle and $T = (1, \tan\theta)$.`,
          prove: md`$\lim_{\theta \to 0} \dfrac{\sin\theta}{\theta} = 1$`,
          steps: [
            { statement: md`$\text{Area}(\triangle OAP) = \frac12 \sin\theta$`, reason: md`Base $OA = 1$, height is the $y$-coordinate of $P$, which is $\sin\theta$.` },
            { statement: md`$\text{Area(sector } OAP) = \frac12 \theta$`, reason: md`A sector with angle $\theta$ is the fraction $\frac{\theta}{2\pi}$ of the unit disc, whose area is $\pi$ (Geometry, Unit 7).` },
            { statement: md`$\text{Area}(\triangle OAT) = \frac12 \tan\theta$`, reason: md`Base $OA = 1$, height $AT$. In right triangle $OAT$, $\frac{AT}{OA} = \tan\theta$.` },
            { statement: md`$\frac12 \sin\theta \le \frac12 \theta \le \frac12 \tan\theta$`, reason: "The triangle lies inside the sector, which lies inside the larger triangle. A region inside another has no more area." },
            { statement: md`$1 \le \dfrac{\theta}{\sin\theta} \le \dfrac{1}{\cos\theta}$`, reason: md`Divide through by $\frac12 \sin\theta > 0$, and $\frac{\tan\theta}{\sin\theta} = \frac{1}{\cos\theta}$.` },
            { statement: md`$\cos\theta \le \dfrac{\sin\theta}{\theta} \le 1$`, reason: "Take reciprocals of positive quantities, which reverses both inequalities." },
            { statement: md`The same inequalities hold for $-\frac{\pi}{2} < \theta < 0$`, reason: md`$\frac{\sin(-\theta)}{-\theta} = \frac{\sin\theta}{\theta}$ and $\cos(-\theta) = \cos\theta$: all three expressions are even functions.` },
            { statement: md`$\lim_{\theta \to 0} \cos\theta = 1$ and $\lim_{\theta \to 0} 1 = 1$`, reason: md`As $\theta \to 0$ the point $P$ slides to $A = (1, 0)$, so its $x$-coordinate $\cos\theta$ approaches 1.` },
            { statement: md`$\lim_{\theta \to 0} \dfrac{\sin\theta}{\theta} = 1$`, reason: "Squeeze theorem." },
          ],
        },
        {
          kind: "key",
          title: "Two trigonometric limits",
          body: md`$$\lim_{x \to 0} \frac{\sin x}{x} = 1, \qquad \lim_{x \to 0} \frac{1 - \cos x}{x} = 0.$$

The second follows from the first: multiply top and bottom by $1 + \cos x$ to get $\dfrac{\sin^2 x}{x(1 + \cos x)} = \dfrac{\sin x}{x} \cdot \dfrac{\sin x}{1 + \cos x} \to 1 \cdot \dfrac{0}{2} = 0$.

The variable may be anything that tends to 0: $\lim_{x \to 0} \frac{\sin 5x}{5x} = 1$, because $u = 5x \to 0$.`,
        },
        {
          kind: "example",
          title: "Using the sine limit",
          problem: md`Find $\lim_{x \to 0} \dfrac{\sin 4x}{x}$.`,
          steps: [
            { math: md`\frac{\sin 4x}{x} = 4 \cdot \frac{\sin 4x}{4x}`, note: "Make the inside of the sine match the denominator by multiplying top and bottom by 4." },
            { math: md`\lim_{x \to 0} 4 \cdot \frac{\sin 4x}{4x} = 4 \cdot \lim_{u \to 0} \frac{\sin u}{u} = 4`, note: md`With $u = 4x$, $u \to 0$ exactly when $x \to 0$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\lim_{x \to 4} \dfrac{x^2 - 16}{x - 4}$. Type a number.`,
          answer: "8",
          explain: md`$\frac{(x - 4)(x + 4)}{x - 4} = x + 4$ for $x \ne 4$, and $\lim_{x \to 4}(x + 4) = 8$.`,
        },
        {
          kind: "check",
          prompt: md`Find $\lim_{x \to 0} \dfrac{\sin 3x}{x}$. Type a number.`,
          answer: "3",
          explain: md`$\frac{\sin 3x}{x} = 3 \cdot \frac{\sin 3x}{3x} \to 3 \cdot 1 = 3$.`,
        },
      ],
      practice: [factorAndCancel, limitLawsAndSubstitution, squeezeAndTrig],
    },
    {
      id: slug("The formal epsilon-delta definition"),
      title: "The formal epsilon-delta definition",
      summary: "Turning 'as close as we like' into a precise statement, finding delta for lines and for a parabola, and proving the sum law.",
      blocks: [
        {
          kind: "text",
          body: md`"$f(x)$ can be made as close to $L$ as we like by taking $x$ close enough to $a$." Every word of that is doing work, and until we pin each one down we cannot prove anything about limits, only observe them. The way to pin it down is to treat it as a game.

A challenger names a tolerance: "get $f(x)$ within $0.01$ of $L$." We must answer with a window around $a$: "every $x$ within $0.003$ of $a$ (other than $a$ itself) does it." Then the challenger tightens the tolerance to $0.0001$, and we must answer again, with a smaller window if necessary. The limit is $L$ when we can always answer, whatever tolerance the challenger names. Tradition calls the tolerance $\varepsilon$ (epsilon) and the window $\delta$ (delta).`,
        },
        {
          kind: "key",
          title: "Definition of a limit",
          body: md`$\lim_{x \to a} f(x) = L$ means: for every $\varepsilon > 0$ there exists a $\delta > 0$ such that

$$0 < |x - a| < \delta \quad\Rightarrow\quad |f(x) - L| < \varepsilon.$$

In words: for every output tolerance $\varepsilon$, there is an input window $\delta$ that guarantees it.`,
        },
        {
          kind: "why",
          title: "Why each part of the definition is there",
          body: md`- **$|x - a| < \delta$** is "$x$ is within $\delta$ of $a$": the input window. **$|f(x) - L| < \varepsilon$** is "$f(x)$ is within $\varepsilon$ of $L$": the output tolerance.
- **$0 < |x - a|$** excludes $x = a$ itself. The limit must not depend on $f(a)$, which may not exist.
- **For every $\varepsilon$** is what "as close as we like" means. One tolerance is not closeness: a function that stays within $0.01$ of $L$ but never gets closer does not approach $L$. Every tolerance, however small, must be achievable.
- **There exists $\delta$** comes after $\varepsilon$ because $\delta$ is our reply to the challenger's $\varepsilon$. A smaller $\varepsilon$ usually needs a smaller $\delta$. If $\delta$ had to be chosen first, for all $\varepsilon$ at once, no window could work for every tolerance.`,
        },
        {
          kind: "plot",
          x: [0, 4],
          y: [1, 9],
          curves: [{ expr: "2x + 1", label: "y = 2x + 1" }],
          hlines: [{ y: "5 + p" }, { y: "5 - p" }],
          vlines: [{ x: "2 + p/2" }, { x: "2 - p/2" }],
          points: [{ x: 2, y: 5, label: "\\varepsilon = {p},\\; \\delta = {=p/2}", color: 2 }],
          params: [{ name: "p", tex: "\\varepsilon", min: 0.2, max: 2, step: 0.1, value: 1 }],
          caption: md`$\lim_{x \to 2}(2x + 1) = 5$. The horizontal band is $|y - 5| < \varepsilon$; the vertical band is $|x - 2| < \delta$. The game is won when the part of the graph inside the vertical band stays inside the horizontal band. For this line $\delta = \varepsilon / 2$ always works, because the line doubles every horizontal distance.`,
        },
        {
          kind: "example",
          title: "A linear limit, proved",
          problem: md`Prove that $\lim_{x \to 2}(2x + 1) = 5$.`,
          steps: [
            { math: md`|f(x) - L| = |(2x + 1) - 5| = |2x - 4| = 2|x - 2|`, note: "Start with the output distance and rewrite it in terms of the input distance. For a line this is always a constant multiple." },
            { math: md`2|x - 2| < \varepsilon \iff |x - 2| < \frac{\varepsilon}{2}`, note: "Work out what input window forces the output tolerance." },
            { math: md`\text{Given } \varepsilon > 0, \text{ take } \delta = \frac{\varepsilon}{2}.`, note: md`Then $0 < |x - 2| < \delta$ gives $|f(x) - 5| = 2|x - 2| < 2\delta = \varepsilon$. We can answer every challenge, so the limit is 5.` },
          ],
        },
        {
          kind: "key",
          title: "Delta for a line",
          body: md`For $f(x) = mx + b$ with $m \ne 0$ and $L = f(a)$, the output distance is $|f(x) - L| = |m|\,|x - a|$. So for a given $\varepsilon$, the largest $\delta$ that works is

$$\delta = \frac{\varepsilon}{|m|}.$$

Any smaller $\delta$ works too. The definition never asks for the largest; it only asks for one.`,
        },
        {
          kind: "why",
          title: "Why nothing larger than ε/|m| works",
          body: md`A line magnifies horizontal distances by exactly $|m|$. If $\delta > \frac{\varepsilon}{|m|}$, pick an $x$ with $|x - a|$ between $\frac{\varepsilon}{|m|}$ and $\delta$. It lies inside the window, yet $|f(x) - L| = |m|\,|x - a| > \varepsilon$: an output outside the tolerance. So the window is too wide. The boundary case $|x - a| = \frac{\varepsilon}{|m|}$ gives $|f(x) - L| = \varepsilon$ exactly, which is not **less than** $\varepsilon$; that is why the definition uses strict inequalities and why $\delta = \frac{\varepsilon}{|m|}$ itself is fine (the window $|x - a| < \delta$ is open).`,
        },
        {
          kind: "example",
          title: "A numeric delta",
          problem: md`Let $f(x) = 3x - 4$. For $\varepsilon = 0.06$, find the largest $\delta$ such that $0 < |x - 2| < \delta$ guarantees $|f(x) - 2| < 0.06$.`,
          steps: [
            { math: md`|f(x) - 2| = |3x - 6| = 3|x - 2|`, note: md`$L = f(2) = 2$. Factor out the slope.` },
            { math: md`3|x - 2| < 0.06 \iff |x - 2| < 0.02`, note: "Divide by 3." },
            { math: md`\delta = 0.02`, note: md`Check: if $|x - 2| < 0.02$ then $|f(x) - 2| < 0.06$. And $x = 2.02$ gives $f(x) - 2 = 0.06$, not less, so nothing bigger works.` },
          ],
        },
        {
          kind: "text",
          body: md`For a curve the magnification is not constant, so $\delta$ is harder to find. Two tactics help. First, the window around $a$ may be lopsided (the curve is steeper on one side), and $\delta$ must fit inside the shorter side. Second, for a proof you do not need the largest $\delta$, so you may first restrict $x$ to a convenient window like $|x - a| < 1$ to tame the awkward factor, then shrink further.`,
        },
        {
          kind: "plot",
          x: [1.5, 4.5],
          y: [4, 14],
          curves: [{ expr: "x^2", label: "y = x^2" }],
          hlines: [{ y: 10 }, { y: 8 }],
          vlines: [{ x: 3.1623 }, { x: 2.8284 }],
          points: [{ x: 3, y: 9, label: "(3, 9)", color: 2 }],
          caption: md`$\lim_{x \to 3} x^2 = 9$ with $\varepsilon = 1$. The band $8 < y < 10$ is hit when $\sqrt{8} < x < \sqrt{10}$, that is $2.828 < x < 3.162$. The right side ($0.162$) is shorter than the left ($0.172$) because the parabola climbs faster there. So $\delta = \sqrt{10} - 3 \approx 0.162$ is the largest that works: the symmetric window must fit inside the shorter side.`,
        },
        {
          kind: "proof",
          title: "A quadratic limit from the definition",
          given: md`$f(x) = x^2$ and $a = 3$.`,
          prove: md`$\lim_{x \to 3} x^2 = 9$`,
          steps: [
            { statement: md`$|x^2 - 9| = |x - 3|\,|x + 3|$`, reason: "Factor the difference of squares. The output distance is the input distance times an extra factor." },
            { statement: md`If $|x - 3| < 1$ then $2 < x < 4$, so $|x + 3| < 7$`, reason: md`Restrict to a window of radius 1 first. Inside it, the awkward factor $|x + 3|$ is bounded.` },
            { statement: md`If $|x - 3| < 1$ then $|x^2 - 9| < 7\,|x - 3|$`, reason: "Steps 1 and 2." },
            { statement: md`Given $\varepsilon > 0$, let $\delta = \min\left(1, \frac{\varepsilon}{7}\right)$`, reason: md`Two requirements on $\delta$: stay inside the radius-1 window, and make $7|x - 3|$ less than $\varepsilon$. The minimum satisfies both.` },
            { statement: md`If $0 < |x - 3| < \delta$ then $|x^2 - 9| < 7 \cdot \frac{\varepsilon}{7} = \varepsilon$`, reason: md`$|x - 3| < 1$ so step 3 applies, and $|x - 3| < \frac{\varepsilon}{7}$.` },
            { statement: md`$\lim_{x \to 3} x^2 = 9$`, reason: "For every ε we produced a δ: the definition is satisfied." },
          ],
        },
        {
          kind: "text",
          body: md`Now the payoff. In the last lesson the limit laws were plausible; with the definition they become theorems. Here is the sum law. The trick is to ask for half the tolerance from each function.`,
        },
        {
          kind: "proof",
          title: "The sum law",
          given: md`$\lim_{x \to a} f(x) = L$ and $\lim_{x \to a} g(x) = M$.`,
          prove: md`$\lim_{x \to a} [f(x) + g(x)] = L + M$`,
          steps: [
            { statement: md`Let $\varepsilon > 0$ be given.`, reason: md`We must find a $\delta$ for it.` },
            { statement: md`There is $\delta_1 > 0$ with $0 < |x - a| < \delta_1 \Rightarrow |f(x) - L| < \frac{\varepsilon}{2}$`, reason: md`Definition of $\lim f = L$, applied with the tolerance $\frac{\varepsilon}{2}$. The definition promises a $\delta$ for **every** positive tolerance, and $\frac{\varepsilon}{2}$ is one.` },
            { statement: md`There is $\delta_2 > 0$ with $0 < |x - a| < \delta_2 \Rightarrow |g(x) - M| < \frac{\varepsilon}{2}$`, reason: md`Definition of $\lim g = M$, same tolerance.` },
            { statement: md`Let $\delta = \min(\delta_1, \delta_2)$. If $0 < |x - a| < \delta$, both conclusions hold.`, reason: md`An $x$ within $\delta$ of $a$ is within $\delta_1$ and within $\delta_2$.` },
            { statement: md`$|(f(x) + g(x)) - (L + M)| = |(f(x) - L) + (g(x) - M)| \le |f(x) - L| + |g(x) - M|$`, reason: md`Regroup, then the triangle inequality $|u + v| \le |u| + |v|$.` },
            { statement: md`$< \frac{\varepsilon}{2} + \frac{\varepsilon}{2} = \varepsilon$`, reason: "Steps 2 and 3." },
            { statement: md`$\lim_{x \to a}[f(x) + g(x)] = L + M$`, reason: md`For every $\varepsilon$ we found a $\delta$.` },
          ],
        },
        {
          kind: "text",
          body: md`The definition also says precisely what it means for a limit **not** to be $L$: there is some $\varepsilon > 0$ for which no $\delta$ works. For $f(x) = \frac{|x|}{x}$ at $0$, take $\varepsilon = 1$. Any window around $0$ contains a negative $x$ with $f(x) = -1$ and a positive $x$ with $f(x) = 1$, two outputs 2 apart; no $L$ is within 1 of both. So no $L$ works, and the limit does not exist. One stubborn $\varepsilon$ is enough to lose the game.`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = 4x - 1$, so $\lim_{x \to 1} f(x) = 3$. For $\varepsilon = 0.2$, find the largest $\delta$ such that $0 < |x - 1| < \delta$ guarantees $|f(x) - 3| < 0.2$. Type a decimal.`,
          answer: "0.05",
          explain: md`$|f(x) - 3| = |4x - 4| = 4|x - 1|$, and $4|x - 1| < 0.2$ exactly when $|x - 1| < 0.05$.`,
        },
        {
          kind: "check",
          prompt: md`Someone proves $\lim_{x \to 2} f(x) = 7$ by finding a $\delta$ that works for $\varepsilon = 0.001$. Is the proof complete?`,
          choices: ["Yes: 0.001 is very small", "No: a δ is needed for every ε > 0, not one of them", "No: δ must be found before ε"],
          accept: ["No: a δ is needed for every ε > 0, not one of them"],
          explain: md`One tolerance, however small, is one round of the game. The limit is 7 only if every round can be won. A proof handles a general $\varepsilon$ in one argument, as the examples above do.`,
        },
      ],
      practice: [largestDeltaLinear, largestDeltaNonlinear, epsilonDeltaChoice],
    },
    {
      id: slug("Continuity"),
      title: "Continuity",
      summary: "When the limit equals the value, the ways that can fail, which functions are continuous and why, and the Intermediate Value Theorem.",
      blocks: [
        {
          kind: "text",
          body: md`Informally, a function is continuous when its graph has no breaks: you can draw it without lifting the pencil. Limits make this precise. A break at $x = a$ is exactly a place where what the function is heading toward differs from where it actually is, or where one of the two doesn't exist.`,
        },
        {
          kind: "key",
          title: "Continuity at a point",
          body: md`$f$ is **continuous at $a$** if

$$\lim_{x \to a} f(x) = f(a).$$

This packs three requirements into one line: $f(a)$ is defined, $\lim_{x \to a} f(x)$ exists, and the two are equal. If any fails, $f$ is **discontinuous at $a$**.

$f$ is **continuous on an interval** if it is continuous at every point of it. At a closed endpoint only the one-sided limit from inside the interval is required.`,
        },
        {
          kind: "why",
          title: "Why three conditions, and what each failure looks like",
          body: md`The equation $\lim_{x \to a} f(x) = f(a)$ compares two things, so both must exist before they can be equal.

- If the limit exists but $f(a)$ is missing or different, there is a **hole**: a single point out of place. The graph is otherwise fine, and redefining one value fixes it. This is a **removable** discontinuity.
- If the one-sided limits exist but differ, the graph **jumps**. No choice of $f(a)$ can fix a gap between two heights. This is a **jump** discontinuity.
- If $|f(x)|$ grows without bound near $a$, the graph runs off along a vertical asymptote. An **infinite** discontinuity.
- If $f$ oscillates without settling (like $\sin\frac{1}{x}$ at 0), the limit fails for yet another reason. These are rarer in practice.

Only the first kind is a defect in a single value. The other three are defects in the function's behaviour near $a$.`,
        },
        {
          kind: "plot",
          x: [-1, 5],
          y: [-1, 7],
          curves: [{ expr: "(x^2 - 4)/(x - 2)", label: "y = \\frac{x^2 - 4}{x - 2}" }],
          points: [{ x: 2, y: 4, open: true }],
          caption: md`**Removable.** $\lim_{x \to 2} \frac{x^2 - 4}{x - 2} = 4$ exists, but $f(2)$ is undefined. Defining $f(2) = 4$ would fill the hole and make the function continuous.`,
        },
        {
          kind: "plot",
          x: [-3, 5],
          y: [-3, 6],
          curves: [
            { expr: "x + 1", domain: [-3, 1], label: "y = f(x)" },
            { expr: "4 - x", domain: [1, 5], color: 1 },
          ],
          points: [
            { x: 1, y: 2, open: true },
            { x: 1, y: 3 },
          ],
          vlines: [{ x: 1 }],
          caption: md`**Jump.** The left limit at 1 is 2 and the right limit is 3. No value of $f(1)$ can close a gap between two different heights.`,
        },
        {
          kind: "plot",
          x: [-3, 5],
          y: [-6, 6],
          curves: [{ expr: "1/(x - 1)", label: "y = \\frac{1}{x - 1}" }],
          vlines: [{ x: 1 }],
          caption: md`**Infinite.** Near $x = 1$ the outputs run off to $\pm\infty$ along the dashed vertical asymptote.`,
        },
        {
          kind: "key",
          title: "Functions that are continuous",
          body: md`The following are continuous at every point of their domains:

- polynomials, and rational functions
- root functions $\sqrt[n]{x}$
- $\sin x$, $\cos x$, $\tan x$ and the other trig functions
- exponentials $b^x$ and logarithms $\log_b x$

And if $f$ and $g$ are continuous at $a$, so are $f + g$, $f - g$, $cf$, $fg$, and $\frac{f}{g}$ when $g(a) \ne 0$. If $g$ is continuous at $a$ and $f$ is continuous at $g(a)$, then the composition $f(g(x))$ is continuous at $a$.

In short: every function you can write down with these ingredients is continuous wherever it is defined. The places to check are seams of piecewise definitions and zeros of denominators.`,
        },
        {
          kind: "proof",
          title: "A sum of continuous functions is continuous",
          given: md`$f$ and $g$ are continuous at $a$.`,
          prove: md`$f + g$ is continuous at $a$.`,
          steps: [
            { statement: md`$\lim_{x \to a} f(x) = f(a)$ and $\lim_{x \to a} g(x) = g(a)$`, reason: "Definition of continuity, applied to each." },
            { statement: md`$\lim_{x \to a}[f(x) + g(x)] = \lim_{x \to a} f(x) + \lim_{x \to a} g(x)$`, reason: "Sum law (proved in Lesson 3). Both limits on the right exist, which is what the law requires." },
            { statement: md`$= f(a) + g(a) = (f + g)(a)$`, reason: md`Step 1, and the definition of the function $f + g$.` },
            { statement: md`$f + g$ is continuous at $a$`, reason: md`Its limit at $a$ equals its value at $a$.` },
          ],
        },
        {
          kind: "why",
          title: "Why polynomials and the rest are continuous",
          body: md`The two building blocks are continuous: $\lim_{x \to a} c = c$ and $\lim_{x \to a} x = a$ say exactly that the constant function and the identity function are continuous everywhere. The limit laws for products, constant multiples and sums then say the same for anything built from them, which is every polynomial. The quotient law adds rational functions wherever the denominator is nonzero. This is the direct substitution rule of Lesson 2 seen from the other side: substitution works **because** these functions are continuous.

For sine and cosine, continuity at 0 is the geometric fact that $P = (\cos\theta, \sin\theta)$ slides to $(1, 0)$ as $\theta \to 0$; the addition formulas then carry it to every point. For $\sqrt{x}$, $\lvert\sqrt{x} - \sqrt{a}\rvert = \frac{|x - a|}{\sqrt{x} + \sqrt{a}} \le \frac{|x - a|}{\sqrt{a}}$ for $a > 0$, so $\delta = \varepsilon\sqrt{a}$ works. Exponentials and logarithms rest on their definitions, and the details belong to Unit 3.

The composition rule holds because continuity passes limits through: if $x \to a$ then $g(x) \to g(a)$, and if the input to $f$ tends to $g(a)$ then $f$ of it tends to $f(g(a))$.`,
        },
        {
          kind: "example",
          title: "Making a piecewise function continuous",
          problem: md`Find $k$ so that $f(x) = \begin{cases} 2x + k & \text{if } x < 3 \\ x^2 - 1 & \text{if } x \ge 3 \end{cases}$ is continuous at $x = 3$.`,
          steps: [
            { math: md`\lim_{x \to 3^-} f(x) = 2(3) + k = 6 + k`, note: "The left piece is a polynomial, so its one-sided limit is its value at the seam." },
            { math: md`\lim_{x \to 3^+} f(x) = 3^2 - 1 = 8 = f(3)`, note: md`The right piece includes $x = 3$, so it also gives $f(3)$.` },
            { math: md`6 + k = 8 \;\Rightarrow\; k = 2`, note: "Both one-sided limits must equal f(3). Setting them equal pins down k. Away from the seam each piece is a polynomial, so f is then continuous everywhere." },
          ],
        },
        {
          kind: "text",
          body: md`Continuity is what lets a function's values in between be trusted. If a continuous function is below some height at one point and above it at another, it must have crossed that height somewhere between. This is obvious for a pencil line and surprisingly deep as a theorem: it depends on the real numbers having no gaps.`,
        },
        {
          kind: "key",
          title: "The Intermediate Value Theorem",
          body: md`Suppose $f$ is continuous on the closed interval $[a, b]$ and $N$ is any number strictly between $f(a)$ and $f(b)$. Then there is at least one $c$ in $(a, b)$ with

$$f(c) = N.$$

Most often it is used with $N = 0$: if $f(a)$ and $f(b)$ have opposite signs, $f$ has a zero between them.`,
        },
        {
          kind: "plot",
          x: [-1, 2.5],
          y: [-3, 6],
          curves: [{ expr: "x^3 - x - 1", label: "y = x^3 - x - 1" }],
          hlines: [{ y: 0 }],
          vlines: [{ x: 1.3247 }],
          points: [
            { x: 1, y: -1, label: "(1, -1)", color: 2 },
            { x: 2, y: 5, label: "(2, 5)", color: 2 },
            { x: 1.3247, y: 0, label: "(c, 0)", color: 3 },
          ],
          caption: md`$f(1) = -1 < 0 < 5 = f(2)$ and $f$ is continuous, so the graph must cross the $x$-axis somewhere in $(1, 2)$. The theorem promises the crossing exists; it does not say where. Here $c \approx 1.3247$.`,
        },
        {
          kind: "why",
          title: "Why continuity is essential, and why the theorem is believable",
          body: md`Drop continuity and the conclusion fails: $g(x) = \frac{|x|}{x}$ on $[-1, 1]$ has $g(-1) = -1$ and $g(1) = 1$ but never equals $0$. It jumps over zero. Continuity forbids jumping: near each point the outputs stay close to the value there, so the graph cannot skip a height.

To see why the theorem holds, suppose $f(a) < N < f(b)$ and look at the set of $x$ in $[a, b]$ where $f(x) < N$. It is not empty (it contains $a$) and it is bounded above by $b$, so it has a least upper bound $c$, a boundary point between "below $N$" and "not below $N$". If $f(c) < N$, continuity would keep $f$ below $N$ a little to the right of $c$, contradicting that $c$ is an upper bound. If $f(c) > N$, continuity would keep $f$ above $N$ a little to the left, so $c$ would not be the **least** upper bound. Only $f(c) = N$ survives. The step we leaned on, that every bounded set of reals has a least upper bound, is the completeness of the real numbers, the property that distinguishes them from the rationals (where $x^2 = 2$ has no solution even though $x^2 - 2$ changes sign). A full treatment belongs to real analysis.`,
        },
        {
          kind: "example",
          title: "Locating a root",
          problem: md`Show that $x^3 - x - 1 = 0$ has a solution, and find an interval of length $0.5$ containing one.`,
          steps: [
            { math: md`f(x) = x^3 - x - 1: \quad f(1) = -1, \quad f(2) = 5`, note: "A polynomial, so continuous everywhere. Opposite signs at 1 and 2." },
            { math: md`\exists\, c \in (1, 2): \; f(c) = 0`, note: md`IVT with $N = 0$.` },
            { math: md`f(1.5) = 3.375 - 1.5 - 1 = 0.875 > 0`, note: "Test the midpoint. The sign change is now between 1 and 1.5." },
            { math: md`c \in (1, 1.5)`, note: "Repeating this halving is the bisection method: each step halves the interval and the IVT guarantees the root stays inside." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $k$ so that $f(x) = \begin{cases} kx - 1 & \text{if } x < 2 \\ x^2 + 3 & \text{if } x \ge 2 \end{cases}$ is continuous at $x = 2$. Type a number.`,
          answer: "4",
          explain: md`The right piece gives $f(2) = 7$. The left limit is $2k - 1$, so $2k - 1 = 7$ and $k = 4$.`,
        },
        {
          kind: "check",
          prompt: md`At $x = 1$, what kind of discontinuity does $f(x) = \dfrac{x^2 - 1}{x - 1}$ have?`,
          choices: DISC_CHOICES,
          accept: [DISC.removable],
          explain: md`$f(1)$ is undefined, but $\lim_{x \to 1} f(x) = \lim_{x \to 1}(x + 1) = 2$ exists. One missing point: removable.`,
        },
      ],
      practice: [continuityK, classifyDiscontinuity, ivtInterval],
    },
    {
      id: slug("Limits at infinity"),
      title: "Limits at infinity",
      summary: "End behaviour as a limit, why dividing by the highest power works, horizontal and vertical asymptotes, and infinite limits.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 3 you described end behaviour: "as $x$ grows, $\frac{3x^2 + 1}{x^2 + 2}$ gets close to 3." That is a limit, with $x$ heading off to the right instead of toward a point. The same two questions arise: what does "approaches" mean here, and how do we compute it?`,
        },
        {
          kind: "key",
          title: "Limits at infinity",
          body: md`$\lim_{x \to \infty} f(x) = L$ means $f(x)$ can be made as close to $L$ as we like by taking $x$ large enough. Precisely: for every $\varepsilon > 0$ there is a number $N$ such that

$$x > N \quad\Rightarrow\quad |f(x) - L| < \varepsilon.$$

$\lim_{x \to -\infty} f(x) = L$ is the same with $x < N$. In either case the line $y = L$ is a **horizontal asymptote** of the graph.

$\infty$ is not a number and $x$ never "reaches" it. The symbol describes the direction $x$ travels.`,
        },
        {
          kind: "key",
          title: "The basic limit",
          body: md`For every $r > 0$,

$$\lim_{x \to \infty} \frac{1}{x^r} = 0, \qquad \lim_{x \to -\infty} \frac{1}{x^r} = 0 \text{ (when } x^r \text{ is defined for negative } x\text{)}.$$`,
        },
        {
          kind: "proof",
          title: "1/x tends to 0",
          given: md`$f(x) = \dfrac{1}{x}$.`,
          prove: md`$\lim_{x \to \infty} \dfrac{1}{x} = 0$`,
          steps: [
            { statement: md`Let $\varepsilon > 0$ be given. Set $N = \dfrac{1}{\varepsilon}$.`, reason: md`We need an $N$ beyond which $\frac{1}{x}$ is within $\varepsilon$ of 0.` },
            { statement: md`If $x > N$ then $x > \dfrac{1}{\varepsilon} > 0$.`, reason: "Hypothesis and the choice of N." },
            { statement: md`So $0 < \dfrac{1}{x} < \varepsilon$.`, reason: "Reciprocals of positive numbers reverse the inequality." },
            { statement: md`$\left|\dfrac{1}{x} - 0\right| < \varepsilon$`, reason: md`Step 3. For general $r$, take $N = \varepsilon^{-1/r}$ instead and the same steps go through.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 10],
          y: [0, 4],
          curves: [{ expr: "1/x^r", label: "y = \\frac{1}{x^{{r}}}" }],
          hlines: [{ y: 0 }],
          params: [{ name: "r", tex: "r", min: 0.25, max: 3, step: 0.25, value: 1 }],
          caption: md`Every positive power in the denominator sends the fraction to 0. Small $r$ gets there slowly; large $r$, quickly. Either way $y = 0$ is a horizontal asymptote.`,
        },
        {
          kind: "text",
          body: md`The limit laws of Lesson 2 hold unchanged with $x \to \pm\infty$ in place of $x \to a$; the "errors shrink" argument never used where $x$ was going. So the plan for a rational function is to rewrite it so that every piece is either a constant or a $\frac{c}{x^k}$, and then let the laws finish.`,
        },
        {
          kind: "why",
          title: "Why dividing by the highest power works",
          body: md`Take $\dfrac{3x^2 - x + 2}{5x^2 + 4}$. Multiply top and bottom by $\frac{1}{x^2}$. For $x \ne 0$ that multiplies the fraction by 1, so the function is unchanged at every input the limit examines:

$$\frac{3x^2 - x + 2}{5x^2 + 4} = \frac{3 - \frac{1}{x} + \frac{2}{x^2}}{5 + \frac{4}{x^2}}.$$

Now every term is a constant or a $\frac{c}{x^k}$ with $k > 0$. Each $\frac{c}{x^k} \to 0$, so by the sum law the top tends to $3$ and the bottom to $5$. The bottom's limit is not 0, so the quotient law gives $\frac{3}{5}$.

Why the **highest** power? Dividing by a smaller power leaves an $x$ somewhere, which has no limit; dividing by a larger one sends the bottom to 0 and disables the quotient law. The highest power present is exactly the one that leaves a nonzero constant downstairs.`,
        },
        {
          kind: "example",
          title: "Equal degrees",
          problem: md`Find $\lim_{x \to \infty} \dfrac{3x^2 - x + 2}{5x^2 + 4}$.`,
          steps: [
            { math: md`\frac{3x^2 - x + 2}{5x^2 + 4} = \frac{3 - \frac{1}{x} + \frac{2}{x^2}}{5 + \frac{4}{x^2}}`, note: md`Divide every term by $x^2$.` },
            { math: md`\lim_{x \to \infty} = \frac{3 - 0 + 0}{5 + 0} = \frac{3}{5}`, note: "Each c/x^k goes to 0, then sum and quotient laws. The horizontal asymptote is y = 3/5." },
          ],
        },
        {
          kind: "example",
          title: "Top degree lower, and top degree higher",
          problem: md`Find $\lim_{x \to \infty} \dfrac{2x + 1}{x^2 - 3}$ and describe $\lim_{x \to \infty} \dfrac{x^3 + 1}{x^2 + 1}$.`,
          steps: [
            { math: md`\frac{2x + 1}{x^2 - 3} = \frac{\frac{2}{x} + \frac{1}{x^2}}{1 - \frac{3}{x^2}} \to \frac{0}{1} = 0`, note: md`Divide by $x^2$. Every term on top vanishes; the bottom keeps its 1.` },
            { math: md`\frac{x^3 + 1}{x^2 + 1} = \frac{x + \frac{1}{x^2}}{1 + \frac{1}{x^2}}`, note: md`Divide by $x^2$, the highest power of the **denominator**. An $x$ survives on top.` },
            { math: md`\lim_{x \to \infty} \frac{x^3 + 1}{x^2 + 1} = \infty`, note: "The bottom tends to 1 and the top grows without bound, so the quotient grows without bound. No horizontal asymptote; the limit does not exist as a number." },
          ],
        },
        {
          kind: "key",
          title: "Rational functions at infinity",
          body: md`For $\dfrac{p(x)}{q(x)}$ with leading terms $ax^n$ on top and $bx^m$ on the bottom:

- $n < m$: the limit is $0$. Horizontal asymptote $y = 0$.
- $n = m$: the limit is $\dfrac{a}{b}$. Horizontal asymptote $y = \dfrac{a}{b}$.
- $n > m$: $|f(x)| \to \infty$. No horizontal asymptote. The sign is the sign of $\dfrac{a}{b}x^{n - m}$ for the direction of travel.

Only the leading terms matter, because after dividing by $x^m$ every lower term carries a positive power of $x$ in its denominator and vanishes.`,
        },
        {
          kind: "plot",
          x: [-8, 10],
          y: [-6, 10],
          curves: [{ expr: "(2x + 1)/(x - 1)", label: "y = \\frac{2x + 1}{x - 1}" }],
          hlines: [{ y: 2 }],
          vlines: [{ x: 1 }],
          caption: md`$\frac{2x + 1}{x - 1}$: equal degrees, so $y = 2$ is the horizontal asymptote in both directions. At $x = 1$ the bottom is 0 and the top is 3: a vertical asymptote.`,
        },
        {
          kind: "text",
          body: md`Square roots need one extra care. For large positive $x$, $\sqrt{x^2} = x$. For large negative $x$, $\sqrt{x^2} = |x| = -x$. So when you divide a root by $x$ heading toward $-\infty$, a minus sign appears.`,
        },
        {
          kind: "example",
          title: "A root at minus infinity",
          problem: md`Find $\lim_{x \to -\infty} \dfrac{\sqrt{x^2 + 1}}{x}$.`,
          steps: [
            { math: md`x < 0 \;\Rightarrow\; x = -\sqrt{x^2}`, note: md`The root is positive and $x$ is negative, so $x = -|x| = -\sqrt{x^2}$.` },
            { math: md`\frac{\sqrt{x^2 + 1}}{x} = \frac{\sqrt{x^2 + 1}}{-\sqrt{x^2}} = -\sqrt{\frac{x^2 + 1}{x^2}} = -\sqrt{1 + \frac{1}{x^2}}`, note: "Bring the division under the root." },
            { math: md`\lim_{x \to -\infty} \frac{\sqrt{x^2 + 1}}{x} = -\sqrt{1 + 0} = -1`, note: md`Toward $+\infty$ the same steps without the sign give $+1$. The graph has two horizontal asymptotes, $y = 1$ and $y = -1$.` },
          ],
        },
        {
          kind: "plot",
          x: [-10, 10],
          y: [-2, 2],
          curves: [{ expr: "sqrt(x^2 + 1)/x", label: "y = \\frac{\\sqrt{x^2 + 1}}{x}" }],
          hlines: [{ y: 1 }, { y: -1 }],
          caption: md`Two different horizontal asymptotes, one in each direction, and a vertical asymptote at $x = 0$.`,
        },
        {
          kind: "example",
          title: "Infinity minus infinity",
          problem: md`Find $\lim_{x \to \infty} \left(\sqrt{x^2 + 4x} - x\right)$.`,
          steps: [
            { math: md`\sqrt{x^2 + 4x} - x = \frac{(x^2 + 4x) - x^2}{\sqrt{x^2 + 4x} + x} = \frac{4x}{\sqrt{x^2 + 4x} + x}`, note: md`Both terms grow without bound, and $\infty - \infty$ says nothing. Multiply by the conjugate to turn the difference into a quotient.` },
            { math: md`= \frac{4}{\sqrt{1 + \frac{4}{x}} + 1}`, note: md`Divide top and bottom by $x$ (positive, so $x = \sqrt{x^2}$).` },
            { math: md`\lim_{x \to \infty} \left(\sqrt{x^2 + 4x} - x\right) = \frac{4}{1 + 1} = 2`, note: "The two huge quantities differ by an amount that settles to 2." },
          ],
        },
        {
          kind: "text",
          body: md`Two more limits at infinity you will use constantly. $\lim_{x \to \infty} e^{-x} = 0$, because $e^x$ grows without bound and its reciprocal shrinks; likewise $\lim_{x \to -\infty} e^x = 0$. And $\lim_{x \to \infty} \arctan x = \frac{\pi}{2}$: the arctangent returns the angle in $\left(-\frac{\pi}{2}, \frac{\pi}{2}\right)$ whose tangent is $x$, and only angles near $\frac{\pi}{2}$ have enormous tangents.`,
        },
        {
          kind: "key",
          title: "Infinite limits and vertical asymptotes",
          body: md`$\lim_{x \to a} f(x) = \infty$ means $f(x)$ can be made larger than any given number by taking $x$ close enough to $a$ (but not equal). Precisely: for every $M$ there is $\delta > 0$ with $0 < |x - a| < \delta \Rightarrow f(x) > M$. Similarly for $-\infty$ and for one-sided versions.

The line $x = a$ is a **vertical asymptote** of $f$ when at least one of the one-sided limits at $a$ is $\infty$ or $-\infty$.

For a quotient, a vertical asymptote appears where the denominator is 0 and the numerator is not. Near such a point the quotient is "a nonzero number over something tiny", which is enormous; its sign on each side comes from the signs of top and bottom there. If the numerator is **also** 0, factor and cancel first: the point may be a hole instead.`,
        },
        {
          kind: "example",
          title: "One-sided infinite limits",
          problem: md`Find $\lim_{x \to 2^+} \dfrac{x + 3}{x - 2}$ and $\lim_{x \to 2^-} \dfrac{x + 3}{x - 2}$.`,
          steps: [
            { math: md`x \to 2: \quad x + 3 \to 5 > 0`, note: "The numerator is safely positive near 2." },
            { math: md`x \to 2^+: \quad x - 2 \to 0^+, \quad \frac{5}{0^+} \to +\infty`, note: md`Just above 2 the bottom is a tiny positive number. Positive over tiny positive is huge and positive.` },
            { math: md`x \to 2^-: \quad x - 2 \to 0^-, \quad \frac{5}{0^-} \to -\infty`, note: md`Just below 2 the bottom is a tiny negative number. The quotient is huge and negative. Either way, $x = 2$ is a vertical asymptote.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\lim_{x \to \infty} \dfrac{4x^3 - 2}{2x^3 + x}$. Type a number.`,
          answer: "2",
          explain: md`Equal degrees: divide by $x^3$ to get $\frac{4 - 2/x^3}{2 + 1/x^2} \to \frac{4}{2} = 2$.`,
        },
        {
          kind: "check",
          prompt: md`Find every vertical asymptote of $f(x) = \dfrac{x + 1}{x^2 - 9}$. Give the $x$-values as a comma-separated list.`,
          answer: "-3, 3",
          form: "set",
          explain: md`$x^2 - 9 = (x - 3)(x + 3)$ is 0 at $\pm 3$, and the top is $4$ or $-2$ there, not 0. Both are vertical asymptotes.`,
        },
      ],
      practice: [rationalAtInfinity, verticalAsymptotes, rootsAtInfinity],
    },
  ],
};
