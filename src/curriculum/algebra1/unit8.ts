import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import { md, type Generator, type Step, type Unit } from "../types";

const NO_REAL = ["no real solutions", "no real solution", "no solution", "no solutions", "none"];
const SOLS = "Give all solutions, separated by commas.";
const SOLS_NONE = md`Give all real solutions, separated by commas. If there are none, type **no real solutions**.`;
const SOLS_ROOT = md`Give all solutions, separated by commas, with square roots simplified (type $\sqrt{5}$ as sqrt(5)).`;
// Plain strings, not md: Bun's String.raw turns non-ASCII like ± into "\u00B1" text.
const FRAC_FORM = "Simplify square roots, and write a fraction as one fraction, like (1 ± sqrt(5))/2.";
const SOLS_FRAC = `Give all solutions, separated by commas. ${FRAC_FORM}`;

// ── Formatting helpers ──────────────────────────────────────────────────────

/** ax^2 + bx + c, written the way a person would. */
const quad = (a: number, b: number, c: number) => poly([[a, "x^2"], [b, "x"], [c, ""]]);

/** The factor (x - r), or just x when r = 0. */
const fac = (r: number) => (r === 0 ? "x" : `(${poly([[1, "x"], [-r, ""]])})`);

/** A leading coefficient: "" for 1, "-" for -1. */
const lead = (a: number) => (a === 1 ? "" : a === -1 ? "-" : String(a));

/** a(x - h)^2 + k */
function vertexForm(a: number, h: number, k: number): string {
  const sq = h === 0 ? "x^2" : `${fac(h)}^2`;
  return `${lead(a)}${sq}${k === 0 ? "" : ` ${signed(k)}`}`;
}

/** n = k^2 m with m square-free. */
function surd(n: number): [number, number] {
  let k = 1;
  for (let f = 2; f * f <= n; f++) {
    while (n % (f * f) === 0) {
      n /= f * f;
      k *= f;
    }
  }
  return [k, n];
}

const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));

/** k√m as answer text and LaTeX. */
function rootTerm(k: number, m: number): { text: string; tex: string } {
  return k === 1 ? { text: `sqrt(${m})`, tex: md`\sqrt{${m}}` } : { text: `${k}sqrt(${m})`, tex: md`${k}\sqrt{${m}}` };
}

/** √d simplified, as LaTeX. */
function sqrtTex(d: number): string {
  if (isSquare(d)) return String(Math.sqrt(d));
  const [k, m] = surd(d);
  return rootTerm(k, m).tex;
}

/** The solutions of x = h ± √d, as an answer key and a final LaTeX line. */
function plusMinus(h: number, d: number): { answer: string; tex: string } {
  if (isSquare(d)) {
    const s = Math.sqrt(d);
    if (s === 0) return { answer: String(h), tex: md`x = ${h}` };
    return { answer: `${h + s}, ${h - s}`, tex: md`x = ${h + s} \quad\text{or}\quad x = ${h - s}` };
  }
  const [k, m] = surd(d);
  const t = rootTerm(k, m);
  if (h === 0) return { answer: `${t.text}, -${t.text}`, tex: md`x = \pm ${t.tex}` };
  return { answer: `${h} + ${t.text}, ${h} - ${t.text}`, tex: md`x = ${h} \pm ${t.tex}` };
}

interface Roots {
  /** Undefined when there are no real solutions. */
  answer?: string;
  steps: Step[];
}

/** Solve ax^2 + bx + c = 0 (a > 0) with the quadratic formula, showing the work. */
function formula(a: number, b: number, c: number): Roots {
  const D = b * b - 4 * a * c;
  const steps: Step[] = [
    { math: md`a = ${a}, \quad b = ${b}, \quad c = ${c}`, note: "Read the coefficients off standard form, signs included." },
    { math: md`b^2 - 4ac = ${paren(b)}^2 - 4(${a})(${c}) = ${b * b} ${signed(-4 * a * c)} = ${D}`, note: "Work out the part under the square root first." },
  ];
  if (D < 0) {
    steps.push({ math: md`\sqrt{${D}} \text{ is not a real number}`, note: "No real number squares to a negative, so there are no real solutions." });
    return { steps };
  }
  const minusB = b < 0 ? md` Since $b = ${b}$, $-b = ${-b}$.` : "";
  steps.push({ math: md`x = \frac{${-b} \pm \sqrt{${D}}}{${2 * a}}`, note: md`Substitute into $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$.${minusB}` });
  if (isSquare(D)) {
    const s = Math.sqrt(D);
    if (s === 0) {
      steps.push({ math: md`x = \frac{${-b}}{${2 * a}} = ${fracTex(-b, 2 * a)}`, note: "Adding or subtracting 0 gives the same number, so there is one solution." });
      return { answer: frac(-b, 2 * a), steps };
    }
    steps.push({
      math: md`x = \frac{${-b + s}}{${2 * a}} = ${fracTex(-b + s, 2 * a)} \quad\text{or}\quad x = \frac{${-b - s}}{${2 * a}} = ${fracTex(-b - s, 2 * a)}`,
      note: md`$\sqrt{${D}} = ${s}$. Take the $+$ and the $-$ separately, then reduce.`,
    });
    return { answer: `${frac(-b + s, 2 * a)}, ${frac(-b - s, 2 * a)}`, steps };
  }
  let [k, m] = surd(D);
  if (k > 1) {
    steps.push({ math: md`x = \frac{${-b} \pm ${k}\sqrt{${m}}}{${2 * a}}`, note: md`Simplify the root: $\sqrt{${D}} = \sqrt{${k * k}} \cdot \sqrt{${m}} = ${k}\sqrt{${m}}$.` });
  }
  let p = -b;
  let q = 2 * a;
  const g = gcd(gcd(p, k), q);
  p /= g;
  k /= g;
  q /= g;
  const t = rootTerm(k, m);
  let answer: string;
  let tex: string;
  if (q === 1) {
    answer = p === 0 ? `${t.text}, -${t.text}` : `${p} + ${t.text}, ${p} - ${t.text}`;
    tex = p === 0 ? md`x = \pm ${t.tex}` : md`x = ${p} \pm ${t.tex}`;
  } else {
    answer = p === 0 ? `${t.text}/${q}, -${t.text}/${q}` : `(${p} + ${t.text})/${q}, (${p} - ${t.text})/${q}`;
    tex = p === 0 ? md`x = \pm\frac{${t.tex}}{${q}}` : md`x = \frac{${p} \pm ${t.tex}}{${q}}`;
  }
  if (g > 1) steps.push({ math: tex, note: md`All three numbers, both on top and the bottom, share the factor ${g}. Divide it out of each one.` });
  else steps[steps.length - 1]!.note += " Nothing divides all three numbers on top and bottom, so this is fully simplified.";
  return { answer, steps };
}

/** Random ax^2 + bx + c (a > 0, b ≠ 0) whose discriminant passes a test. */
function pickQuad(r: { int(lo: number, hi: number): number; nonzero(lo: number, hi: number): number; pick<T>(xs: readonly T[]): T }, ok: (D: number) => boolean): [number, number, number] {
  for (;;) {
    const a = r.pick([1, 1, 1, 2, 3]);
    const b = r.nonzero(-8, 8);
    const c = r.nonzero(-9, 9);
    if (gcd(gcd(a, b), c) !== 1) continue;
    if (ok(b * b - 4 * a * c)) return [a, b, c];
  }
}

// ── Lesson 1: Parabolas and their graphs ────────────────────────────────────

const evaluateQuadratic: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.pick([1, -1, 2, -2, 3]);
    const h = r.nonzero(-4, 4);
    const k = r.int(-6, 6);
    const d = r.nonzero(-3, 3);
    const x = h + d;
    const value = a * d * d + k;
    return {
      prompt: md`Evaluate $${vertexForm(a, h, k)}$ when $x = ${x}$.`,
      answer: String(value),
      hint: "Work inside the parentheses first, then square, then multiply by the number in front, then add.",
      solution: [
        { math: md`${lead(a)}(${x} ${signed(-h)})^2 ${k ? signed(k) : ""}`, note: "Substitute." },
        { math: md`${lead(a)}(${d})^2 ${k ? signed(k) : ""}`, note: "Parentheses first." },
        { math: md`${a === 1 ? "" : `${paren(a)} \\cdot `}${d * d} ${k ? signed(k) : ""}`, note: "Square: a square is never negative." },
        { math: String(value), note: "" },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([1, -1, 2, -3]);
    const b = r.nonzero(-6, 6);
    const c = r.int(-8, 8);
    const x = r.nonzero(-3, 3);
    const value = a * x * x + b * x + c;
    const bAbs = Math.abs(b) === 1 ? "" : String(Math.abs(b));
    return {
      prompt: md`Evaluate $${quad(a, b, c)}$ when $x = ${x}$.`,
      answer: String(value),
      hint: a < 0 ? md`Square before applying the sign: $-x^2$ means $-(x^2)$, which is never positive.` : md`Square first: $(${x})^2 = ${x * x}$.`,
      solution: [
        { math: md`${lead(a)}(${x})^2 ${b < 0 ? "-" : "+"} ${bAbs}(${x}) ${c ? signed(c) : ""}`, note: "Substitute, in parentheses." },
        { math: md`${a === 1 ? "" : `${paren(a)} \\cdot `}${x * x} ${signed(b * x)} ${c ? signed(c) : ""}`, note: "The exponent comes before the multiplication." },
        { math: String(value), note: "" },
      ],
    };
  }
  const a = r.pick([1, -1, 2]);
  const p = r.int(-5, 5);
  let q = r.int(-5, 5);
  while (q === p) q = r.int(-5, 5);
  const x = r.int(-4, 4);
  const value = a * (x - p) * (x - q);
  return {
    prompt: md`Evaluate $${lead(a)}${q === 0 ? fac(q) + fac(p) : fac(p) + fac(q)}$ when $x = ${x}$.`,
    answer: String(value),
    hint: "Work out each factor, then multiply.",
    solution: [
      { math: q === 0 ? md`${lead(a)}(${x - q})(${x - p})` : md`${lead(a)}(${x - p})(${x - q})`, note: "Substitute into each factor." },
      { math: String(value), note: "Multiply." },
    ],
  };
};

const readVertexForm: Generator = (r) => {
  const kind = r.int(0, 3);
  const a = r.pick([1, -1, 2, -2, 3, -3]);
  const h = r.nonzero(-6, 6);
  const k = r.nonzero(-9, 9);
  if (kind === 0 || kind === 1) {
    const [hh, kk] = kind === 0 ? [h, k] : r.next() < 0.5 ? [0, k] : [h, 0];
    const eq = vertexForm(a, hh, kk);
    return {
      prompt: md`Find the vertex of the parabola $y = ${eq}$. Write it as a point, like (2, -1).`,
      answer: `(${hh}, ${kk})`,
      form: "tuple",
      hint: md`Match it to $y = a(x - h)^2 + k$. A plus sign inside the parentheses means $h$ is negative.`,
      solution: [
        { math: md`y = ${lead(a)}(x - ${paren(hh)})^2 + ${paren(kk)}`, note: md`Rewrite it in exactly the shape $a(x - h)^2 + k$.` },
        { math: md`(h, k) = (${hh}, ${kk})`, note: md`The squared part is 0 at $x = ${hh}$, and there $y = ${kk}$.` },
      ],
    };
  }
  const eq = vertexForm(a, h, k);
  if (kind === 2) {
    const up = a > 0;
    return {
      prompt: md`Does the parabola $y = ${eq}$ open up or down? Type **up** or **down**.`,
      accept: up ? ["up", "upward", "upwards", "opens up"] : ["down", "downward", "downwards", "opens down"],
      hint: "Look at the sign of the number multiplying the square.",
      solution: [
        {
          math: md`a = ${a} ${up ? ">" : "<"} 0`,
          note: up
            ? "The squared part is never negative, and multiplying by a positive number keeps it that way. The graph rises on both sides: it opens **up**."
            : "The squared part is never negative, so multiplying by a negative makes it never positive. The graph falls on both sides: it opens **down**.",
        },
      ],
    };
  }
  return {
    prompt: md`What is the ${a > 0 ? "smallest" : "largest"} value that $y = ${eq}$ can take?`,
    answer: String(k),
    hint: md`The squared part is 0 at best. What is $y$ then?`,
    solution: [
      { math: md`${lead(a)}${fac(h)}^2 ${a > 0 ? "\\ge" : "\\le"} 0`, note: md`A square is at least 0, and $a = ${a}$ is ${a > 0 ? "positive" : "negative"}.` },
      { math: md`y ${a > 0 ? "\\ge" : "\\le"} ${k}`, note: md`Add ${k}. The value $${k}$ is reached at the vertex, $x = ${h}$.` },
    ],
  };
};

const vertexBySymmetry: Generator = (r) => {
  const p = r.int(-6, 4);
  const q = p + 2 * r.int(1, 5);
  const [s, t] = r.next() < 0.5 ? [p, q] : [q, p];
  const m = (s + t) / 2;
  if (r.next() < 0.4) {
    // Standard form that factors.
    const kv = (m - s) * (m - t);
    return {
      prompt: md`Find the vertex of $y = ${quad(1, -(s + t), s * t)}$ by factoring first. Write it as a point, like (2, -1).`,
      answer: `(${m}, ${kv})`,
      form: "tuple",
      hint: "Factor to find where y = 0. The vertex is halfway between those two x-values.",
      solution: [
        {
          math: s === 0 || t === 0 ? md`y = x${fac(s + t)}` : md`y = ${fac(s)}${fac(t)}`,
          note: s === 0 || t === 0 ? md`Factor out the common $x$.` : md`Two numbers that multiply to ${s * t} and add to ${-(s + t)}.`,
        },
        { math: md`y = 0 \text{ at } x = ${s} \text{ and } x = ${t}`, note: "A product is 0 when one of its factors is 0." },
        { math: md`h = \frac{${s} + ${paren(t)}}{2} = ${m}`, note: "The parabola is symmetric, so the vertex is halfway between." },
        { math: md`k = (${m - s})(${m - t}) = ${kv}`, note: md`Substitute $x = ${m}$.` },
        { math: md`(${m}, ${kv})`, note: "" },
      ],
    };
  }
  const a = r.pick([1, 1, -1, 2, -2]);
  const kv = a * (m - s) * (m - t);
  const [f1, f2] = t === 0 ? [fac(t), fac(s)] : [fac(s), fac(t)];
  return {
    prompt: md`Find the vertex of $y = ${lead(a)}${f1}${f2}$. Write it as a point, like (2, -1).`,
    answer: `(${m}, ${kv})`,
    form: "tuple",
    hint: "Where is y = 0? The vertex sits halfway between those two x-values.",
    solution: [
      { math: md`y = 0 \text{ at } x = ${s} \text{ and } x = ${t}`, note: "A product is 0 when one of its factors is 0, so these are the x-intercepts." },
      { math: md`h = \frac{${s} + ${paren(t)}}{2} = ${m}`, note: "The parabola is symmetric, so the vertex is halfway between them." },
      { math: md`k = ${a === 1 ? "" : `${lead(a)}`}(${m - s})(${m - t}) = ${kv}`, note: md`Substitute $x = ${m}$ to get the height there.` },
      { math: md`(${m}, ${kv})`, note: "" },
    ],
  };
};

// ── Lesson 2: Solving by factoring ──────────────────────────────────────────

/** "x - r = 0 or x - s = 0" */
const zeroFactors = (rs: number[]) => rs.map((v) => md`${v === 0 ? "x" : poly([[1, "x"], [-v, ""]])} = 0`).join(md` \quad\text{or}\quad `);
const orList = (vs: string[]) => vs.map((v) => md`x = ${v}`).join(md` \quad\text{or}\quad `);

const solveFactored: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const s = r.nonzero(-9, 9);
    let t = r.nonzero(-9, 9);
    while (t === s) t = r.nonzero(-9, 9);
    return {
      prompt: md`Solve $${fac(s)}${fac(t)} = 0$. ${SOLS}`,
      answer: `${s}, ${t}`,
      form: "set",
      simplified: true,
      hint: "A product is 0 only when one of the factors is 0. Set each factor equal to 0.",
      solution: [
        { math: zeroFactors([s, t]), note: "Zero product property." },
        { math: orList([String(s), String(t)]), note: "Solve each small equation." },
      ],
    };
  }
  if (kind === 1) {
    const k = r.pick([1, 2, 3, -1, -2]);
    const t = r.nonzero(-9, 9);
    return {
      prompt: md`Solve $${lead(k)}x${fac(t)} = 0$. ${SOLS}`,
      answer: `0, ${t}`,
      form: "set",
      simplified: true,
      hint: md`There are ${k === 1 ? "two factors" : "three factors"} here${k === 1 ? "" : ", but a nonzero number can never be 0"}. Don't forget the lone $x$.`,
      solution: [
        { math: zeroFactors([0, t]), note: k === 1 ? "Zero product property." : md`Zero product property. The factor ${k} can't be 0, so it gives no solution.` },
        { math: orList(["0", String(t)]), note: "" },
      ],
    };
  }
  const p = r.int(2, 5);
  let q = r.nonzero(-9, 9);
  while (gcd(p, q) !== 1) q = r.nonzero(-9, 9);
  const t = r.nonzero(-6, 6);
  return {
    prompt: md`Solve $(${poly([[p, "x"], [-q, ""]])})${fac(t)} = 0$. ${SOLS} Fractions are fine, like 3/2.`,
    answer: `${frac(q, p)}, ${t}`,
    form: "set",
    simplified: true,
    hint: "Set each factor equal to 0. The first one is a two-step equation.",
    solution: [
      { math: md`${poly([[p, "x"], [-q, ""]])} = 0 \quad\text{or}\quad ${poly([[1, "x"], [-t, ""]])} = 0`, note: "Zero product property." },
      { math: md`${p}x = ${q} \quad\text{or}\quad x = ${t}`, note: md`${q > 0 ? "Add" : "Subtract"} ${Math.abs(q)} in the first one.` },
      { math: orList([fracTex(q, p), String(t)]), note: md`Divide by ${p}.` },
    ],
  };
};

const solveMonic: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind <= 1) {
    const s = r.nonzero(-8, 8);
    let t = r.nonzero(-8, 8);
    while (t === s || t === -s) t = r.nonzero(-8, 8);
    const b = -(s + t);
    const c = s * t;
    const moved = kind === 1;
    const steps: Step[] = [];
    if (moved) steps.push({ math: md`${quad(1, b, c)} = 0`, note: md`${c < 0 ? "Subtract" : "Add"} ${Math.abs(c)} on both sides. The zero product property needs 0 on one side.` });
    steps.push(
      { math: md`${fac(s)}${fac(t)} = 0`, note: md`Two numbers that multiply to ${c} and add to ${b}: ${-s} and ${-t}.` },
      { math: zeroFactors([s, t]), note: "Zero product property." },
      { math: orList([String(s), String(t)]), note: "" },
    );
    return {
      prompt: moved ? md`Solve $${quad(1, b, 0)} = ${-c}$. ${SOLS}` : md`Solve $${quad(1, b, c)} = 0$. ${SOLS}`,
      answer: `${s}, ${t}`,
      form: "set",
      simplified: true,
      hint: moved ? "First get 0 on one side. Then factor." : md`Find two numbers that multiply to ${c} and add to ${b}.`,
      solution: steps,
    };
  }
  if (kind === 2) {
    const k = r.nonzero(-9, 9);
    const asEquation = r.next() < 0.5;
    return {
      prompt: asEquation ? md`Solve $x^2 = ${poly([[k, "x"]])}$. ${SOLS}` : md`Solve $${quad(1, -k, 0)} = 0$. ${SOLS}`,
      answer: `0, ${k}`,
      form: "set",
      simplified: true,
      hint: md`Don't divide by $x$: that loses a solution. Get 0 on one side and factor out $x$.`,
      solution: [
        ...(asEquation ? [{ math: md`${quad(1, -k, 0)} = 0`, note: md`Move everything to one side.` }] : []),
        { math: md`x${fac(k)} = 0`, note: md`Factor out the common $x$.` },
        { math: orList(["0", String(k)]), note: "Zero product property." },
      ],
    };
  }
  if (kind === 3) {
    const s = r.nonzero(-7, 7);
    return {
      prompt: md`Solve $${quad(1, -2 * s, s * s)} = 0$. ${SOLS}`,
      answer: String(s),
      form: "set",
      simplified: true,
      hint: md`Is it a perfect square, like $(x - a)^2$?`,
      solution: [
        { math: md`${fac(s)}^2 = 0`, note: md`A perfect square: ${-s} times itself is ${s * s}, and twice ${-s} is ${-2 * s}.` },
        { math: md`x = ${s}`, note: "Both factors are the same, so they give the same solution. There is just one." },
      ],
    };
  }
  const n = r.int(1, 12);
  return {
    prompt: md`Solve $x^2 - ${n * n} = 0$. ${SOLS}`,
    answer: `${n}, ${-n}`,
    form: "set",
    simplified: true,
    hint: md`A difference of squares: $x^2 - a^2 = (x - a)(x + a)$.`,
    solution: [
      { math: md`(x - ${n})(x + ${n}) = 0`, note: md`$${n * n} = ${n}^2$, so this is a difference of squares.` },
      { math: orList([String(n), String(-n)]), note: "Zero product property." },
    ],
  };
};

const solveNonMonic: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const p = r.pick([2, 3, 5]);
    let q = r.nonzero(-7, 7);
    while (gcd(p, q) !== 1) q = r.nonzero(-7, 7);
    const s = r.nonzero(-6, 6);
    // (px + q)(x + s)
    const [a, b, c] = [p, p * s + q, q * s];
    return {
      prompt: md`Solve $${quad(a, b, c)} = 0$. ${SOLS} Fractions are fine, like 3/2.`,
      answer: `${frac(-q, p)}, ${-s}`,
      form: "set",
      simplified: true,
      hint: md`Factor as $(${p}x + \square)(x + \square)$, then use the zero product property.`,
      solution: [
        { math: md`(${poly([[p, "x"], [q, ""]])})(${poly([[1, "x"], [s, ""]])}) = 0`, note: md`Factor. Check by expanding: the outer and inner products give $${b === 1 ? "" : b === -1 ? "-" : b}x$.` },
        { math: md`${poly([[p, "x"], [q, ""]])} = 0 \quad\text{or}\quad ${poly([[1, "x"], [s, ""]])} = 0`, note: "Zero product property." },
        { math: orList([fracTex(-q, p), String(-s)]), note: "Solve each." },
      ],
    };
  }
  const s = r.nonzero(-7, 7);
  let t = r.nonzero(-7, 7);
  while (t === s) t = r.nonzero(-7, 7);
  const k = kind === 1 ? r.int(2, 4) : -1;
  const [a, b, c] = [k, -k * (s + t), k * s * t];
  return {
    prompt: md`Solve $${quad(a, b, c)} = 0$. ${SOLS}`,
    answer: `${s}, ${t}`,
    form: "set",
    simplified: true,
    hint: k > 0 ? md`Every coefficient is a multiple of ${k}. Divide both sides by ${k} first.` : md`Multiply both sides by $-1$ first so the $x^2$ term is positive.`,
    solution: [
      { math: md`${quad(1, -(s + t), s * t)} = 0`, note: k > 0 ? md`Divide both sides by ${k}. That's allowed: ${k} is a number, not 0, and $0 \div ${k} = 0$.` : md`Multiply both sides by $-1$. Every sign flips, and $0$ stays $0$.` },
      { math: md`${fac(s)}${fac(t)} = 0`, note: "Factor." },
      { math: orList([String(s), String(t)]), note: "Zero product property." },
    ],
  };
};

// ── Lesson 3: Square roots and completing the square ────────────────────────

const RADICANDS = [2, 3, 5, 6, 7, 10, 11];

const squareRootProperty: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0) {
    const n = r.int(1, 12);
    const a = r.pick([1, 1, 2, 3, 5]);
    const c = a === 1 ? r.int(-10, 10) : 0;
    const eq = a === 1 ? md`x^2 ${c ? signed(c) : ""} = ${n * n + c}` : md`${a}x^2 = ${a * n * n}`;
    return {
      prompt: md`Solve $${eq}$. ${SOLS_NONE}`,
      answer: `${n}, ${-n}`,
      form: "set",
      simplified: true,
      hint: "Get the square alone, then take the square root of both sides. Remember both signs.",
      solution: [
        { math: md`x^2 = ${n * n}`, note: a === 1 ? (c ? md`${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)} on both sides.` : "The square is already alone.") : md`Divide both sides by ${a}.` },
        { math: md`x = \pm ${n}`, note: md`Both ${n} and $-${n}$ square to ${n * n}.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 5);
    const m = r.pick(RADICANDS);
    const d = k * k * m;
    const pm = plusMinus(0, d);
    return {
      prompt: md`Solve $x^2 = ${d}$. ${SOLS_NONE} Simplify any square roots (type $\sqrt{2}$ as sqrt(2)).`,
      answer: pm.answer,
      form: "set",
      simplified: true,
      hint: k > 1 ? md`Take the square root of both sides, then simplify: ${d} has the perfect-square factor ${k * k}.` : "Take the square root of both sides. Remember both signs.",
      solution: [
        { math: md`x = \pm\sqrt{${d}}`, note: "Square root property." },
        ...(k > 1
          ? [
              { math: md`\sqrt{${d}} = \sqrt{${k * k}}\cdot\sqrt{${m}} = ${k}\sqrt{${m}}`, note: "Pull out the largest perfect square." },
              { math: pm.tex, note: "" },
            ]
          : []),
      ],
    };
  }
  if (kind <= 3) {
    const h = r.nonzero(-8, 8);
    const d = kind === 2 ? r.int(1, 9) ** 2 : r.int(1, 3) ** 2 * r.pick(RADICANDS);
    const pm = plusMinus(h, d);
    return {
      prompt: md`Solve $${fac(h)}^2 = ${d}$. ${SOLS_NONE}${isSquare(d) ? "" : md` Simplify any square roots (type $\sqrt{2}$ as sqrt(2)).`}`,
      answer: pm.answer,
      form: "set",
      simplified: true,
      hint: md`Treat $${poly([[1, "x"], [-h, ""]])}$ as one thing. Its square is ${d}, so what can it be?`,
      solution: [
        { math: md`${poly([[1, "x"], [-h, ""]])} = \pm ${sqrtTex(d)}`, note: md`Square root property, applied to the whole $${poly([[1, "x"], [-h, ""]])}$.` },
        { math: pm.tex, note: md`${h > 0 ? "Add" : "Subtract"} ${Math.abs(h)} on both sides.` },
      ],
    };
  }
  const d = r.int(1, 20);
  const h = r.int(-6, 6);
  const shifted = h !== 0 && r.next() < 0.5;
  return {
    prompt: shifted ? md`Solve $${fac(h)}^2 = -${d}$. ${SOLS_NONE}` : md`Solve $x^2 + ${d} = 0$. ${SOLS_NONE}`,
    accept: NO_REAL,
    hint: "Get the square alone. Can a square be negative?",
    solution: [
      { math: shifted ? md`${fac(h)}^2 = -${d}` : md`x^2 = -${d}`, note: shifted ? "The square is already alone." : md`Subtract ${d} on both sides.` },
      { math: md`\text{no real solutions}`, note: "Any real number squared is 0 or positive, never negative. No real number works." },
    ],
  };
};

const completeTheSquareNumber: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const odd = r.next() < 0.3;
    const b = odd ? r.pick([1, 3, 5, 7, -1, -3, -5]) : 2 * r.nonzero(-8, 8);
    const missing = frac(b * b, 4);
    return {
      prompt: md`What number goes in the box to make a perfect square: $${poly([[1, "x^2"], [b, "x"]])} + \square$?${odd ? " Give a fraction if needed." : ""}`,
      answer: missing,
      simplified: true,
      hint: md`Take half of the $x$-coefficient, then square it.`,
      solution: [
        { math: md`\tfrac{1}{2} \cdot ${paren(b)} = ${fracTex(b, 2)}`, note: "Half the x-coefficient: the side of each rectangle in the square picture." },
        { math: md`\left(${fracTex(b, 2)}\right)^2 = ${fracTex(b * b, 4)}`, note: "Square it: that is the missing corner." },
        { math: md`${poly([[1, "x^2"], [b, "x"]])} + ${fracTex(b * b, 4)} = \left(x ${b < 0 ? "-" : "+"} ${fracTex(Math.abs(b), 2)}\right)^2`, note: "" },
      ],
    };
  }
  const p = r.nonzero(-9, 9);
  if (kind === 1) {
    return {
      prompt: md`Factor $${quad(1, 2 * p, p * p)}$ as a perfect square.`,
      answer: `${fac(-p)}^2`,
      factored: true,
      hint: md`Half of ${2 * p} is ${p}. Is the constant equal to $${paren(p)}^2$?`,
      solution: [
        { math: md`\tfrac{1}{2} \cdot ${paren(2 * p)} = ${p}, \quad ${paren(p)}^2 = ${p * p}`, note: "The constant is exactly the missing corner, so this is a perfect square." },
        { math: md`${fac(-p)}^2`, note: "" },
      ],
    };
  }
  const q = r.nonzero(-9, 9);
  return {
    prompt: md`Find the vertex of $y = ${quad(1, 2 * p, p * p + q)}$ by completing the square. Write it as a point, like (2, -1).`,
    answer: `(${-p}, ${q})`,
    form: "tuple",
    hint: md`Half of ${2 * p} is ${p}, so you want $${paren(p)}^2 = ${p * p}$. Add it and subtract it, so nothing changes.`,
    solution: [
      { math: md`y = (${quad(1, 2 * p, p * p)}) ${signed(q)}`, note: md`Split the constant: $${p * p + q} = ${p * p} ${signed(q)}$. The ${p * p} completes the square.` },
      { math: md`y = ${fac(-p)}^2 ${signed(q)}`, note: "Now it's in vertex form." },
      { math: md`(${-p}, ${q})`, note: "Read the vertex off: h, then k." },
    ],
  };
};

const completingTheSquare: Generator = (r) => {
  const p = r.nonzero(-6, 6);
  const b = 2 * p;
  let d = r.next() < 0.4 ? r.int(1, 7) ** 2 : r.int(1, 2) ** 2 * r.pick(RADICANDS);
  while (p * p - d === 0) d += 1;
  const c = p * p - d;
  const pm = plusMinus(-p, d);
  const moved = r.next() < 0.3;
  const steps: Step[] = [];
  if (!moved) steps.push({ math: md`x^2 ${signed(b)}x = ${-c}`, note: md`${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)}, so only the $x$-terms are on the left.` });
  steps.push(
    { math: md`x^2 ${signed(b)}x + ${p * p} = ${-c} + ${p * p}`, note: md`Half of ${b} is ${p}, and $${paren(p)}^2 = ${p * p}$. Add it to **both** sides.` },
    { math: md`${fac(-p)}^2 = ${d}`, note: "The left side is now a perfect square." },
    { math: md`x ${signed(p)} = \pm ${sqrtTex(d)}`, note: "Square root property, both signs." },
    { math: pm.tex, note: md`${p > 0 ? "Subtract" : "Add"} ${Math.abs(p)} on both sides.` },
  );
  return {
    prompt: moved
      ? md`Solve $x^2 ${signed(b)}x = ${-c}$ by completing the square. ${isSquare(d) ? SOLS : SOLS_ROOT}`
      : md`Solve $${quad(1, b, c)} = 0$ by completing the square. ${isSquare(d) ? SOLS : SOLS_ROOT}`,
    answer: pm.answer,
    form: "set",
    simplified: true,
    hint: md`Get the constant on the right. Then add $\left(\frac{${b}}{2}\right)^2 = ${p * p}$ to both sides.`,
    solution: steps,
  };
};

// ── Lesson 4: Deriving the quadratic formula ────────────────────────────────

const formulaRational: Generator = (r) => {
  for (;;) {
    const p = r.int(1, 4);
    const s = r.int(1, 3);
    if (p === 1 && s === 1) continue;
    const q = r.nonzero(-6, 6);
    const t = r.nonzero(-6, 6);
    // (px - q)(sx - t)
    const [a, b, c] = [p * s, -(p * t + q * s), q * t];
    if (b === 0 || q * s === t * p || gcd(gcd(a, b), c) !== 1) continue;
    const f = formula(a, b, c);
    return {
      prompt: md`Solve $${quad(a, b, c)} = 0$ using the quadratic formula. ${SOLS} Fractions are fine, like 3/2.`,
      answer: f.answer!,
      form: "set",
      simplified: true,
      hint: md`Here $a = ${a}$, $b = ${b}$, $c = ${c}$. Find $b^2 - 4ac$ first.`,
      solution: f.steps,
    };
  }
};

const formulaIrrational: Generator = (r) => {
  const [a, b, c] = pickQuad(r, (D) => D > 0 && !isSquare(D));
  const f = formula(a, b, c);
  return {
    prompt: md`Solve $${quad(a, b, c)} = 0$. ${SOLS_FRAC}`,
    answer: f.answer!,
    form: "set",
    simplified: true,
    hint: md`It doesn't factor, so use the formula with $a = ${a}$, $b = ${b}$, $c = ${c}$. Simplify the root, then cancel any common factor.`,
    solution: f.steps,
  };
};

const formulaRearranged: Generator = (r) => {
  const [a, b, c] = pickQuad(r, (D) => D > 0);
  const f = formula(a, b, c);
  const kind = r.int(0, 2);
  // Three ways to write ax^2 + bx + c = 0 out of standard form.
  const eq =
    kind === 0
      ? md`${quad(a, 0, 0)} = ${poly([[-b, "x"], [-c, ""]])}`
      : kind === 1
        ? md`${quad(a, b, 0)} = ${-c}`
        : md`x(${poly([[a, "x"], [b, ""]])}) = ${-c}`;
  const first =
    kind === 0
      ? md`Move every term to the left: ${b > 0 ? "add" : "subtract"} $${poly([[Math.abs(b), "x"]])}$ and ${c > 0 ? "add" : "subtract"} ${Math.abs(c)}.`
      : kind === 1
        ? md`${c > 0 ? "Add" : "Subtract"} ${Math.abs(c)} on both sides.`
        : md`Distribute, then ${c > 0 ? "add" : "subtract"} ${Math.abs(c)} on both sides.`;
  return {
    prompt: md`Solve $${eq}$. ${isSquare(b * b - 4 * a * c) ? SOLS + " Fractions are fine, like 3/2." : SOLS_FRAC}`,
    answer: f.answer!,
    form: "set",
    simplified: true,
    hint: "Get it into standard form, with 0 on one side, before reading off a, b and c.",
    solution: [{ math: md`${quad(a, b, c)} = 0`, note: first }, ...f.steps],
  };
};

// ── Lesson 5: The discriminant ──────────────────────────────────────────────

const WORDS = ["zero", "one", "two"];

const countSolutions: Generator = (r) => {
  const n = r.int(0, 2);
  let a: number, b: number, c: number;
  if (n === 1) {
    const p = r.int(1, 3);
    const q = r.nonzero(-6, 6);
    const k = r.pick([1, 1, -1]);
    [a, b, c] = [k * p * p, k * 2 * p * q, k * q * q];
  } else {
    for (;;) {
      a = r.pick([1, 2, 3, -1, -2]);
      b = r.int(-8, 8);
      c = r.nonzero(-9, 9);
      const D = b * b - 4 * a * c;
      if (n === 0 ? D < 0 : D > 0) break;
    }
  }
  const D = b * b - 4 * a * c;
  const askD = r.next() < 0.3;
  const work: Step = { math: md`b^2 - 4ac = ${paren(b)}^2 - 4(${a})(${c}) = ${b * b} ${signed(-4 * a * c)} = ${D}`, note: md`With $a = ${a}$, $b = ${b}$, $c = ${c}$.` };
  if (askD) {
    return {
      prompt: md`Compute the discriminant of $${quad(a, b, c)} = 0$.`,
      answer: String(D),
      hint: md`The discriminant is $b^2 - 4ac$. Here $a = ${a}$, $b = ${b}$, $c = ${c}$.`,
      solution: [work],
    };
  }
  const verdict = D > 0 ? "positive: two real solutions" : D === 0 ? "zero: exactly one real solution" : "negative: no real solutions";
  return {
    prompt: md`How many real solutions does $${quad(a, b, c)} = 0$ have? Answer with a number.`,
    answer: String(n),
    accept: [WORDS[n]!],
    hint: md`Find the discriminant $b^2 - 4ac$ and look at its sign.`,
    solution: [work, { math: md`b^2 - 4ac ${D > 0 ? ">" : D === 0 ? "=" : "<"} 0`, note: md`The discriminant is ${verdict}.` }, { math: String(n), note: "" }],
  };
};

const solveOrNone: Generator = (r) => {
  const roll = r.next();
  let a: number, b: number, c: number;
  if (roll < 0.2) {
    const p = r.int(1, 3);
    const q = r.nonzero(-6, 6);
    [a, b, c] = [p * p, 2 * p * q, q * q];
    if (gcd(p, q) !== 1) [a, b, c] = [1, 2 * q, q * q];
  } else {
    [a, b, c] = pickQuad(r, roll < 0.55 ? (D) => D < 0 : (D) => D > 0);
  }
  const f = formula(a, b, c);
  return {
    prompt: md`Solve $${quad(a, b, c)} = 0$. ${SOLS_NONE} ` + FRAC_FORM,
    ...(f.answer ? { answer: f.answer, form: "set" as const, simplified: true } : { accept: NO_REAL }),
    hint: "Check the discriminant first. If it's negative, you're done.",
    solution: f.steps,
  };
};

const oneSolution: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const p = r.nonzero(-8, 8);
    return {
      prompt: md`For which value of $c$ does $x^2 ${signed(2 * p)}x + c = 0$ have exactly one solution?`,
      answer: String(p * p),
      hint: "Exactly one solution means the discriminant is 0.",
      solution: [
        { math: md`${paren(2 * p)}^2 - 4(1)(c) = 0`, note: "Set the discriminant equal to 0." },
        { math: md`${4 * p * p} - 4c = 0`, note: "" },
        { math: md`c = ${p * p}`, note: md`Solve for $c$. Check: $${quad(1, 2 * p, p * p)} = ${fac(-p)}^2$, a perfect square.` },
      ],
    };
  }
  if (kind === 1) {
    const n = r.int(1, 9);
    return {
      prompt: md`For which positive value of $b$ does $x^2 + bx + ${n * n} = 0$ have exactly one solution?`,
      answer: String(2 * n),
      hint: "Set the discriminant equal to 0 and solve for b. Two values of b work; give the positive one.",
      solution: [
        { math: md`b^2 - 4(1)(${n * n}) = 0`, note: "Exactly one solution means the discriminant is 0." },
        { math: md`b^2 = ${4 * n * n}`, note: "" },
        { math: md`b = \pm ${2 * n}`, note: md`Square root property. The positive one is ${2 * n}.` },
      ],
    };
  }
  const m = r.int(1, 5);
  let n = r.int(1, 5);
  while (n === m) n = r.int(1, 5);
  const b = 2 * m * n * r.sign();
  return {
    prompt: md`For which value of $a$ does $ax^2 ${signed(b)}x + ${n * n} = 0$ have exactly one solution?`,
    answer: String(m * m),
    hint: "Set the discriminant equal to 0 and solve for a.",
    solution: [
      { math: md`${paren(b)}^2 - 4a(${n * n}) = 0`, note: "Exactly one solution means the discriminant is 0." },
      { math: md`${b * b} = ${4 * n * n}a`, note: "" },
      { math: md`a = ${m * m}`, note: md`Divide by ${4 * n * n}. Check: $${quad(m * m, b, n * n)} = (${poly([[m, "x"], [Math.sign(b) * n, ""]])})^2$.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit8: Unit = {
  title: "Quadratic Equations",
  lessons: [
    {
      id: "parabolas-and-their-graphs",
      title: "Parabolas and their graphs",
      summary: "The shape of y = x², and how three numbers move it, stretch it and flip it.",
      blocks: [
        {
          kind: "text",
          body: md`A **quadratic** is a polynomial whose highest power is 2: $ax^2 + bx + c$ with $a \ne 0$. This unit is about solving $ax^2 + bx + c = 0$. Before solving anything, it helps to see what these functions look like.

Start with the simplest one, $y = x^2$. A few values:

$$\begin{array}{c|ccccccc} x & -3 & -2 & -1 & 0 & 1 & 2 & 3 \\ \hline y & 9 & 4 & 1 & 0 & 1 & 4 & 9 \end{array}$$`,
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-1, 9],
          curves: [{ expr: "x^2", label: "y = x^2" }],
          points: [
            { x: -2, y: 4 },
            { x: 2, y: 4 },
            { x: 0, y: 0, label: md`\text{vertex } (0, 0)`, color: 2 },
          ],
          caption: md`The graph of $y = x^2$ is a U-shaped curve called a **parabola**. Matching heights on the left and right, like the two dots at $y = 4$, are mirror images.`,
        },
        {
          kind: "why",
          title: "Why is it a symmetric U, and not a V?",
          body: md`- **Symmetric:** $(-x)^2 = x^2$, because a negative times a negative is positive. So $x = -2$ and $x = 2$ always give the same height. The $y$-axis is a mirror.
- **Lowest point at 0:** a square is never negative, and it is 0 only when $x = 0$.
- **Curved:** the steps between heights grow. From the table, $0 \to 1 \to 4 \to 9 \to 16$ go up by $1, 3, 5, 7$. In general $(n + 1)^2 - n^2 = 2n + 1$, which gets bigger as $n$ grows. A V would go up by the same amount every step.`,
        },
        {
          kind: "text",
          body: md`The lowest (or highest) point of a parabola is its **vertex**. The vertical line through the vertex is the **axis of symmetry**. Every parabola is $y = x^2$ moved, stretched or flipped, and one form of the equation shows exactly how.`,
        },
        {
          kind: "key",
          title: "Vertex form",
          body: md`$$y = a(x - h)^2 + k$$

- The vertex is $(h, k)$, and the axis of symmetry is the line $x = h$.
- If $a > 0$ the parabola opens up and $k$ is its smallest $y$-value. If $a < 0$ it opens down and $k$ is its largest.
- The bigger $|a|$ is, the narrower the parabola.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 8],
          curves: [
            { expr: "x^2", label: "y = x^2", color: 3, dashed: true },
            { expr: "a(x - h)^2 + k", label: "y = a(x - h)^2 + k", color: 1 },
          ],
          points: [{ x: "h", y: "k", label: md`\text{vertex } (h, k)`, color: 2 }],
          params: [
            { name: "a", min: -3, max: 3, step: 0.5, value: 1 },
            { name: "h", min: -4, max: 4, step: 0.5, value: 2 },
            { name: "k", min: -5, max: 5, step: 0.5, value: -3 },
          ],
          caption: md`Move $h$ and $k$ and the whole curve slides with its vertex. Make $a$ negative and it flips. At $a = 0$ the curve flattens into a line, which is why a quadratic needs $a \ne 0$.`,
        },
        {
          kind: "why",
          title: "Why does (x − h) move the graph right, not left?",
          body: md`Take $y = (x - 3)^2$. The output $x^2$ gives at $x = 0$, this one gives at $x = 3$, because $3 - 3 = 0$. The output $x^2$ gives at $x = 1$, this one gives at $x = 4$. Every point arrives 3 steps later, so the whole graph sits 3 to the **right**.

The $+k$ is simpler: it adds $k$ to every output, so every point moves up by $k$.`,
        },
        {
          kind: "why",
          title: "Why is (h, k) the lowest point when a > 0?",
          body: md`$(x - h)^2$ is a square, so it is never negative, and it is 0 only at $x = h$. Multiplying by a positive $a$ keeps it at least 0. Adding $k$ gives

$$y = a(x - h)^2 + k \ge k,$$

with equality only at $x = h$. So the lowest point is $(h, k)$. When $a < 0$, the product $a(x - h)^2$ is never positive, so $y \le k$ and $(h, k)$ is the highest point instead.`,
        },
        {
          kind: "example",
          title: "Reading a vertex form",
          problem: md`Describe the parabola $y = -2(x + 1)^2 + 8$.`,
          steps: [
            { math: md`y = -2(x - (-1))^2 + 8`, note: md`Rewrite to match $a(x - h)^2 + k$. A plus inside means $h$ is negative.` },
            { math: md`a = -2, \quad h = -1, \quad k = 8`, note: "Read off the three numbers." },
            { math: md`\text{vertex } (-1, 8), \text{ opens down}`, note: md`$a < 0$, so 8 is the **largest** value $y$ ever takes.` },
            { math: md`x = 0: \; y = -2(1)^2 + 8 = 6`, note: "One more point, to see the shape." },
            { math: md`x = -2: \; y = -2(-1)^2 + 8 = 6`, note: md`Its mirror image across the axis $x = -1$ has the same height, as symmetry promises.` },
          ],
        },
        {
          kind: "text",
          body: md`Where a parabola crosses the $x$-axis, $y = 0$. Those $x$-values are the **roots**: the solutions of the equation $ax^2 + bx + c = 0$. So every equation in this unit is really a question about a picture: where does the parabola meet the $x$-axis?

A parabola can cross the axis twice, touch it once at the vertex, or miss it entirely. That is why a quadratic equation can have two solutions, one, or none.`,
        },
        {
          kind: "example",
          title: "Finding the vertex from the roots",
          problem: md`Find the vertex of $y = (x - 1)(x - 5)$.`,
          steps: [
            { math: md`x = 1: \; y = (0)(-4) = 0, \qquad x = 5: \; y = (4)(0) = 0`, note: "A factor of 0 makes the whole product 0, so the graph crosses the axis at x = 1 and x = 5." },
            { math: md`h = \frac{1 + 5}{2} = 3`, note: "The parabola is symmetric, so its axis is exactly halfway between the two roots." },
            { math: md`k = (3 - 1)(3 - 5) = (2)(-2) = -4`, note: md`Substitute $x = 3$ for the height.` },
            { math: md`(x - 3)^2 - 4 = x^2 - 6x + 5 = (x - 1)(x - 5) \;\checkmark`, note: md`Check by expanding: the vertex form $y = (x - 3)^2 - 4$ is the same function.` },
          ],
        },
        {
          kind: "plot",
          x: [-1, 7],
          y: [-5, 6],
          curves: [{ expr: "(x - 1)(x - 5)", label: "y = (x - 1)(x - 5)" }],
          points: [
            { x: 1, y: 0, label: md`\text{roots}`, color: 4 },
            { x: 5, y: 0, color: 4 },
            { x: 3, y: -4, label: md`\text{vertex } (3, -4)`, color: 2 },
          ],
          vlines: [{ x: 3, label: "x = 3" }],
          caption: "The roots are where y = 0. The axis of symmetry runs halfway between them, through the vertex.",
        },
        {
          kind: "check",
          prompt: md`Find the vertex of $y = 3(x - 4)^2 - 7$. Write it as a point, like (2, -1).`,
          answer: "(4, -7)",
          form: "tuple",
          explain: md`It's already in the shape $a(x - h)^2 + k$ with $h = 4$ and $k = -7$.`,
        },
        {
          kind: "check",
          prompt: md`What is the largest value that $y = -(x - 2)^2 + 5$ can take?`,
          answer: "5",
          explain: md`$-(x - 2)^2$ is never positive, so $y \le 5$. It equals 5 at the vertex, $x = 2$.`,
        },
      ],
      practice: [evaluateQuadratic, readVertexForm, vertexBySymmetry],
    },
    {
      id: "solving-by-factoring",
      title: "Solving by factoring",
      summary: "Why a product of zero forces a factor of zero, and how that solves quadratics.",
      blocks: [
        {
          kind: "text",
          body: md`Try to solve $x^2 - x - 6 = 0$ the Unit 2 way, by undoing operations. You can't: $x$ appears twice, once squared and once not, and there's no single operation to undo.

Factoring (Unit 7) gives a way in. The left side factors:

$$(x + 2)(x - 3) = 0.$$

Now the question is: when is a product of two numbers equal to 0?`,
        },
        {
          kind: "key",
          title: "Zero product property",
          body: md`If $ab = 0$, then $a = 0$ or $b = 0$ (or both).

The only way a product can be zero is for one of its factors to be zero.`,
        },
        {
          kind: "why",
          title: "Why must one factor be zero?",
          body: md`Suppose $ab = 0$. Either $a = 0$, and we're done, or $a \ne 0$. In that case $a$ has a reciprocal $\frac{1}{a}$ (the inverse property from Unit 1), so multiply both sides by it:

$$\frac{1}{a} \cdot ab = \frac{1}{a} \cdot 0 \quad\Rightarrow\quad 1 \cdot b = 0 \quad\Rightarrow\quad b = 0.$$

So if $a$ isn't zero, $b$ has to be. There is no third option.`,
        },
        {
          kind: "why",
          title: "Why does it only work with zero?",
          body: md`$(x - 1)(x - 2) = 6$ does **not** mean $x - 1 = 6$ or $x - 2 = 6$. The number 6 can be made from two factors in endless ways: $2 \cdot 3$, $1 \cdot 6$, $(-2)(-3)$, $12 \cdot \frac{1}{2}$, and so on. Knowing the product tells you nothing about either factor.

Try $x = 7$, from $x - 1 = 6$: you get $6 \cdot 5 = 30$, not 6. Zero is special because there is only one way to make it: one factor has to be 0. That's why the first step is always to get **0 on one side**.`,
        },
        {
          kind: "key",
          title: "Solving by factoring",
          body: md`- Move every term to one side, so the other side is 0.
- Factor.
- Set each factor equal to 0, and solve each small equation.
- Check in the original equation.`,
        },
        {
          kind: "example",
          title: "The basic case",
          problem: md`Solve $x^2 - x - 6 = 0$.`,
          steps: [
            { math: md`(x + 2)(x - 3) = 0`, note: md`Two numbers that multiply to $-6$ and add to $-1$: $2$ and $-3$.` },
            { math: md`x + 2 = 0 \quad\text{or}\quad x - 3 = 0`, note: "Zero product property." },
            { math: md`x = -2 \quad\text{or}\quad x = 3`, note: "Solve each one." },
            { math: md`(-2)^2 - (-2) - 6 = 0, \quad 3^2 - 3 - 6 = 0 \;\checkmark`, note: "Check both." },
          ],
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-8, 8],
          curves: [{ expr: "(x - r)(x - s)", label: "y = (x - r)(x - s)" }],
          points: [
            { x: "r", y: 0, label: md`x = r`, color: 4 },
            { x: "s", y: 0, label: md`x = s`, color: 2 },
          ],
          params: [
            { name: "r", min: -5, max: 5, step: 1, value: -2 },
            { name: "s", min: -5, max: 5, step: 1, value: 3 },
          ],
          caption: md`Each factor puts one root on the $x$-axis: $x - r$ is 0 at $x = r$. Set $r = s$ and the two roots merge into one, with the vertex sitting on the axis.`,
        },
        {
          kind: "example",
          title: "A common factor",
          problem: md`Solve $2x^2 = 8x$.`,
          steps: [
            { math: md`2x^2 - 8x = 0`, note: md`Subtract $8x$ from both sides, to get 0 on one side.` },
            { math: md`2x(x - 4) = 0`, note: md`Factor out the greatest common factor, $2x$.` },
            { math: md`2x = 0 \quad\text{or}\quad x - 4 = 0`, note: "Zero product property." },
            { math: md`x = 0 \quad\text{or}\quad x = 4`, note: "" },
          ],
        },
        {
          kind: "why",
          title: "Why not just divide both sides by x?",
          body: md`Dividing $2x^2 = 8x$ by $2x$ gives $x = 4$, and $x = 0$ disappears. Check it: $2(0)^2 = 0 = 8(0)$, so 0 really is a solution.

Dividing by $x$ secretly assumes $x \ne 0$. When $x$ *is* 0, you'd be dividing by zero, which Unit 2 showed is never allowed. Never divide by an expression that could be 0. Move everything to one side and factor instead.`,
        },
        {
          kind: "example",
          title: "A leading coefficient",
          problem: md`Solve $3x^2 + 5x - 2 = 0$.`,
          steps: [
            { math: md`(3x - 1)(x + 2) = 0`, note: md`Factor. Check: the outer and inner products are $6x - x = 5x$.` },
            { math: md`3x - 1 = 0 \quad\text{or}\quad x + 2 = 0`, note: "Zero product property." },
            { math: md`x = \frac{1}{3} \quad\text{or}\quad x = -2`, note: md`The first is a two-step equation: add 1, divide by 3.` },
          ],
        },
        {
          kind: "text",
          body: md`**A double root.** $x^2 - 6x + 9 = 0$ factors as $(x - 3)^2 = 0$, which is $(x - 3)(x - 3) = 0$. Both factors give $x = 3$, so there is only **one** solution. On the graph, the vertex sits right on the $x$-axis: the parabola touches it without crossing.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x^2 + 2x - 15 = 0$. Give all solutions, separated by commas.`,
          answer: "3, -5",
          form: "set",
          explain: md`$(x + 5)(x - 3) = 0$, so $x = -5$ or $x = 3$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x^2 = 7x$. Give all solutions, separated by commas.`,
          answer: "0, 7",
          form: "set",
          explain: md`$x^2 - 7x = 0$, so $x(x - 7) = 0$, and $x = 0$ or $x = 7$. Dividing by $x$ would have lost the 0.`,
        },
      ],
      practice: [solveFactored, solveMonic, solveNonMonic],
    },
    {
      id: "square-roots-and-completing-the-square",
      title: "Square roots and completing the square",
      summary: "Solving x² = d, simplifying roots, and turning any quadratic into a perfect square.",
      blocks: [
        {
          kind: "text",
          body: md`Some quadratics don't factor with whole numbers. $x^2 = 5$ is the simplest: no integer squares to 5. But there is a number whose square is 5. It's written $\sqrt{5}$, the **square root** of 5, and it's about $2.236$.

There is also a second solution: $(-\sqrt{5})^2 = 5$ too.`,
        },
        {
          kind: "key",
          title: "Square root property",
          body: md`If $x^2 = d$:

- when $d > 0$, $x = \sqrt{d}$ or $x = -\sqrt{d}$, written $x = \pm\sqrt{d}$;
- when $d = 0$, $x = 0$;
- when $d < 0$, there are **no real solutions**.

Here $\sqrt{d}$ always means the non-negative root.`,
        },
        {
          kind: "why",
          title: "Why exactly two solutions, and never more?",
          body: md`Both $\sqrt{d}$ and $-\sqrt{d}$ square to $d$: a negative times a negative is positive. To see there are no others, rewrite $x^2 = d$ as a difference of squares (Unit 7) and use the zero product property from the last lesson:

$$x^2 - (\sqrt{d})^2 = 0 \quad\Rightarrow\quad (x - \sqrt{d})(x + \sqrt{d}) = 0.$$

One factor must be 0, so $x = \sqrt{d}$ or $x = -\sqrt{d}$. Nothing else can work. And when $d < 0$, nothing works at all, since no real number has a negative square.`,
        },
        {
          kind: "why",
          title: "Why √12 = 2√3",
          body: md`For non-negative $a$ and $b$, $\sqrt{ab} = \sqrt{a}\,\sqrt{b}$. Check it: $(\sqrt{a}\sqrt{b})^2 = (\sqrt{a})^2(\sqrt{b})^2 = ab$, and $\sqrt{a}\sqrt{b}$ isn't negative, so it is *the* non-negative number whose square is $ab$.

That lets you pull perfect squares out of a root:

$$\sqrt{12} = \sqrt{4 \cdot 3} = \sqrt{4}\,\sqrt{3} = 2\sqrt{3}.$$

A root is **simplified** when no perfect square (other than 1) divides the number inside. Answers here should be simplified. Type $2\sqrt{3}$ as **2sqrt(3)**.`,
        },
        {
          kind: "example",
          title: "A squared group",
          problem: md`Solve $(x - 3)^2 = 8$.`,
          steps: [
            { math: md`x - 3 = \pm\sqrt{8}`, note: md`Treat $x - 3$ as one thing. Its square is 8, so it's $\sqrt{8}$ or $-\sqrt{8}$.` },
            { math: md`x - 3 = \pm 2\sqrt{2}`, note: md`$\sqrt{8} = \sqrt{4}\sqrt{2} = 2\sqrt{2}$.` },
            { math: md`x = 3 \pm 2\sqrt{2}`, note: md`Add 3 to both sides. That's two solutions: $3 + 2\sqrt{2}$ and $3 - 2\sqrt{2}$.` },
          ],
        },
        {
          kind: "text",
          body: md`That example was easy because the left side was already a perfect square. **Completing the square** is a way to make any quadratic look like that. It starts from a fact you met in Unit 6:

$$(x + 3)^2 = x^2 + 6x + 9.$$

So $x^2 + 6x$ is a perfect square with 9 missing. Here is a picture of why.`,
        },
        {
          kind: "why",
          title: "The square picture",
          body: md`Draw $x^2$ as a square with side $x$. Split $6x$ into two equal rectangles, each $x$ by $3$, and attach one to the right side and one to the bottom:

$$\begin{array}{c|c|c|} & x & 3 \\ \hline x & x^2 & 3x \\ \hline 3 & 3x & \;?\; \\ \hline \end{array}$$

The shape is almost a big square with side $x + 3$. Only the corner is missing, and it is $3$ by $3$, so it has area $9$. Add it and the square is complete: $x^2 + 6x + 9 = (x + 3)^2$.

The same works for any $x^2 + bx$: each rectangle is $x$ by $\frac{b}{2}$, and the missing corner is $\left(\frac{b}{2}\right)^2$.`,
        },
        {
          kind: "key",
          title: "Completing the square",
          body: md`$$x^2 + bx + \left(\frac{b}{2}\right)^2 = \left(x + \frac{b}{2}\right)^2$$

Take half the coefficient of $x$, square it, and add it. In an equation, add it to **both** sides.`,
        },
        {
          kind: "example",
          title: "Solving by completing the square",
          problem: md`Solve $x^2 + 6x + 5 = 0$.`,
          steps: [
            { math: md`x^2 + 6x = -5`, note: "Move the constant to the right, so the left is just the square and the rectangles." },
            { math: md`x^2 + 6x + 9 = -5 + 9`, note: md`Half of 6 is 3, and $3^2 = 9$. Add the corner to both sides.` },
            { math: md`(x + 3)^2 = 4`, note: "The left side is a perfect square now." },
            { math: md`x + 3 = \pm 2`, note: "Square root property." },
            { math: md`x = -1 \quad\text{or}\quad x = -5`, note: md`$-3 + 2$ and $-3 - 2$. Check: $(x + 1)(x + 5) = x^2 + 6x + 5$.` },
          ],
        },
        {
          kind: "plot",
          x: [-8, 2],
          y: [-5, 6],
          curves: [{ expr: "x^2 + 6x + 5", label: "y = x^2 + 6x + 5 = (x + 3)^2 - 4" }],
          points: [
            { x: -5, y: 0, label: md`\text{roots } -5, -1`, color: 4 },
            { x: -1, y: 0, color: 4 },
            { x: -3, y: -4, label: md`\text{vertex } (-3, -4)`, color: 2 },
          ],
          caption: md`Completing the square also gives vertex form. The roots sit 2 units either side of the axis $x = -3$, because $(x + 3)^2 = 4$.`,
        },
        {
          kind: "example",
          title: "When the roots aren't whole numbers",
          problem: md`Solve $x^2 - 4x - 1 = 0$.`,
          steps: [
            { math: md`x^2 - 4x = 1`, note: "Add 1 to both sides." },
            { math: md`x^2 - 4x + 4 = 1 + 4`, note: md`Half of $-4$ is $-2$, and $(-2)^2 = 4$.` },
            { math: md`(x - 2)^2 = 5`, note: "Perfect square." },
            { math: md`x - 2 = \pm\sqrt{5}`, note: "Square root property." },
            { math: md`x = 2 \pm \sqrt{5}`, note: "Add 2. Type the answer as 2 + sqrt(5), 2 - sqrt(5)." },
          ],
        },
        {
          kind: "text",
          body: md`When the $x^2$ term has a coefficient other than 1, divide every term by it first, so the picture starts with a plain $x^2$. The next lesson does exactly that, with letters instead of numbers.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x^2 = 18$. Give all solutions, separated by commas, with roots simplified.`,
          answer: "3sqrt(2), -3sqrt(2)",
          form: "set",
          simplified: true,
          explain: md`$x = \pm\sqrt{18}$, and $\sqrt{18} = \sqrt{9}\sqrt{2} = 3\sqrt{2}$.`,
        },
        {
          kind: "check",
          prompt: md`What number goes in the box to make a perfect square: $x^2 - 10x + \square$?`,
          answer: "25",
          explain: md`Half of $-10$ is $-5$, and $(-5)^2 = 25$. So $x^2 - 10x + 25 = (x - 5)^2$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x^2 + 2x - 2 = 0$ by completing the square. Give all solutions, separated by commas.`,
          answer: "-1 + sqrt(3), -1 - sqrt(3)",
          form: "set",
          simplified: true,
          explain: md`$x^2 + 2x = 2$. Add 1: $(x + 1)^2 = 3$. So $x + 1 = \pm\sqrt{3}$ and $x = -1 \pm \sqrt{3}$.`,
        },
      ],
      practice: [squareRootProperty, completeTheSquareNumber, completingTheSquare],
    },
    {
      id: "deriving-the-quadratic-formula",
      title: "Deriving the quadratic formula",
      summary: "Completing the square once, with letters, to solve every quadratic at once.",
      blocks: [
        {
          kind: "text",
          body: md`Completing the square works on every quadratic, but doing it each time is slow. In Unit 2 you solved $ax + b = c$ with letters and got $x = \frac{c - b}{a}$, one line that solves every linear equation. We'll do the same thing here: complete the square on

$$ax^2 + bx + c = 0, \qquad a \ne 0$$

with $a$, $b$ and $c$ left as letters. Every step is one you've already used with numbers.`,
        },
        {
          kind: "example",
          title: "The derivation",
          problem: md`Solve $ax^2 + bx + c = 0$ for $x$, where $a \ne 0$.`,
          steps: [
            { math: md`x^2 + \frac{b}{a}x + \frac{c}{a} = 0`, note: md`Divide every term by $a$, so the square picture starts with a plain $x^2$. This is allowed because $a \ne 0$, and $0 \div a = 0$.` },
            { math: md`x^2 + \frac{b}{a}x = -\frac{c}{a}`, note: md`Subtract $\frac{c}{a}$, leaving the square and the rectangles on the left.` },
            { math: md`x^2 + \frac{b}{a}x + \frac{b^2}{4a^2} = \frac{b^2}{4a^2} - \frac{c}{a}`, note: md`Half of $\frac{b}{a}$ is $\frac{b}{2a}$, and its square is $\frac{b^2}{4a^2}$. Add that corner to both sides.` },
            { math: md`\left(x + \frac{b}{2a}\right)^2 = \frac{b^2}{4a^2} - \frac{c}{a}`, note: "The left side is now a perfect square." },
            { math: md`\left(x + \frac{b}{2a}\right)^2 = \frac{b^2}{4a^2} - \frac{4ac}{4a^2}`, note: md`To subtract fractions they need a common denominator. Multiply the top and bottom of $\frac{c}{a}$ by $4a$.` },
            { math: md`\left(x + \frac{b}{2a}\right)^2 = \frac{b^2 - 4ac}{4a^2}`, note: "Combine the fractions." },
            { math: md`x + \frac{b}{2a} = \pm\frac{\sqrt{b^2 - 4ac}}{2a}`, note: md`Square root property. The root of the bottom is $\sqrt{4a^2} = 2a$ (see the next box for why the sign doesn't matter).` },
            { math: md`x = -\frac{b}{2a} \pm \frac{\sqrt{b^2 - 4ac}}{2a}`, note: md`Subtract $\frac{b}{2a}$ from both sides.` },
            { math: md`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`, note: "Same denominator, so write it as one fraction. Done." },
          ],
        },
        {
          kind: "key",
          title: "The quadratic formula",
          body: md`The solutions of $ax^2 + bx + c = 0$, with $a \ne 0$, are

$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}.$$

First put the equation in standard form, with 0 on one side. Then read off $a$, $b$ and $c$, signs included.`,
        },
        {
          kind: "why",
          title: "Why is √(4a²) allowed to be 2a, even if a is negative?",
          body: md`Strictly, $\sqrt{4a^2} = 2|a|$, since a square root is never negative. If $a > 0$ that's $2a$. If $a < 0$ it's $-2a$, which flips the sign of the fraction $\frac{\sqrt{b^2 - 4ac}}{2a}$.

But the fraction already has $\pm$ in front of it, so we take both signs anyway. Flipping it gives back the same two numbers. Writing $2a$ is safe.`,
        },
        {
          kind: "why",
          title: "What the formula says about the graph",
          body: md`Split the formula in two:

$$x = -\frac{b}{2a} \;\pm\; \frac{\sqrt{b^2 - 4ac}}{2a}.$$

The first part is the same for both roots: it's the middle, the axis of symmetry $x = -\frac{b}{2a}$. The second part is how far each root sits from the middle, once to the right and once to the left. That is the symmetry of the parabola from the first lesson, written as algebra.`,
        },
        {
          kind: "example",
          title: "Using the formula",
          problem: md`Solve $2x^2 + 3x - 2 = 0$.`,
          steps: [
            { math: md`a = 2, \quad b = 3, \quad c = -2`, note: "Read the coefficients. The minus belongs to c." },
            { math: md`b^2 - 4ac = 9 - 4(2)(-2) = 9 + 16 = 25`, note: "The part under the root first." },
            { math: md`x = \frac{-3 \pm 5}{4}`, note: md`$\sqrt{25} = 5$ and $2a = 4$.` },
            { math: md`x = \frac{2}{4} = \frac{1}{2} \quad\text{or}\quad x = \frac{-8}{4} = -2`, note: md`Take the $+$ and the $-$ separately.` },
            { math: md`(2x - 1)(x + 2) = 2x^2 + 3x - 2 \;\checkmark`, note: "This one factors too, which confirms the answer." },
          ],
        },
        {
          kind: "example",
          title: "Rearrange first, simplify last",
          problem: md`Solve $x^2 = 2x + 1$.`,
          steps: [
            { math: md`x^2 - 2x - 1 = 0`, note: md`Standard form: subtract $2x$ and 1 from both sides.` },
            { math: md`a = 1, \quad b = -2, \quad c = -1`, note: "" },
            { math: md`b^2 - 4ac = (-2)^2 - 4(1)(-1) = 4 + 4 = 8`, note: md`Square $-2$ in parentheses: $(-2)^2 = 4$.` },
            { math: md`x = \frac{2 \pm \sqrt{8}}{2}`, note: md`$-b = -(-2) = 2$.` },
            { math: md`x = \frac{2 \pm 2\sqrt{2}}{2}`, note: md`$\sqrt{8} = 2\sqrt{2}$.` },
            { math: md`x = 1 \pm \sqrt{2}`, note: "Both terms on top share the factor 2 with the bottom. Divide it out of every term, not just one." },
          ],
        },
        {
          kind: "plot",
          x: [-3, 5],
          y: [-3, 6],
          curves: [{ expr: "x^2 - 2x - 1", label: "y = x^2 - 2x - 1" }],
          points: [
            { x: "1 - sqrt(2)", y: 0, label: md`x = 1 \pm \sqrt{2}`, color: 4 },
            { x: "1 + sqrt(2)", y: 0, color: 4 },
            { x: 1, y: -2, label: md`\text{vertex } (1, -2)`, color: 2 },
          ],
          vlines: [{ x: 1, label: "x = 1" }],
          caption: md`The axis is $x = -\frac{b}{2a} = 1$. Each root sits $\sqrt{2} \approx 1.41$ away from it, one on each side.`,
        },
        {
          kind: "key",
          title: "Common slips",
          body: md`- Not in standard form yet: $a$, $b$, $c$ only mean something once one side is 0.
- Dropping a sign: if $b = -5$ then $-b = 5$, and $b^2 = 25$, not $-25$.
- The fraction bar covers the **whole** top, $-b \pm \sqrt{\dots}$, not just the root.
- Cancelling from only one term on top. To reduce, a factor must divide every term.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x^2 + 3x + 1 = 0$. ` + SOLS_FRAC,
          answer: "(-3 + sqrt(5))/2, (-3 - sqrt(5))/2",
          form: "set",
          simplified: true,
          explain: md`$a = 1$, $b = 3$, $c = 1$, so $b^2 - 4ac = 9 - 4 = 5$ and $x = \frac{-3 \pm \sqrt{5}}{2}$. ` + " You can type it as (-3 ± sqrt(5))/2 or (-3 +/- sqrt(5))/2.",
        },
        {
          kind: "check",
          prompt: md`Solve $3x^2 - 5x - 2 = 0$. Give all solutions, separated by commas.`,
          answer: "2, -1/3",
          form: "set",
          simplified: true,
          explain: md`$b^2 - 4ac = 25 + 24 = 49$, so $x = \frac{5 \pm 7}{6}$: that's $\frac{12}{6} = 2$ or $\frac{-2}{6} = -\frac{1}{3}$.`,
        },
      ],
      practice: [formulaRational, formulaIrrational, formulaRearranged],
    },
    {
      id: "the-discriminant",
      title: "The discriminant",
      summary: "How b² − 4ac tells you the number of solutions before you find them.",
      blocks: [
        {
          kind: "text",
          body: md`Look again at the quadratic formula:

$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}.$$

Everything outside the square root is an ordinary number. The part inside, $b^2 - 4ac$, decides how many solutions there are. It's called the **discriminant**, because it discriminates (tells apart) the three cases.`,
        },
        {
          kind: "key",
          title: "The discriminant",
          body: md`For $ax^2 + bx + c = 0$, the discriminant is $b^2 - 4ac$.

- $b^2 - 4ac > 0$: **two** real solutions. The parabola crosses the $x$-axis twice.
- $b^2 - 4ac = 0$: **one** real solution. The vertex sits on the $x$-axis.
- $b^2 - 4ac < 0$: **no** real solutions. The parabola misses the $x$-axis.`,
        },
        {
          kind: "why",
          title: "Why the sign decides it: from the formula",
          body: md`- If $b^2 - 4ac$ is positive, its root is a positive number. Adding it and subtracting it from $-b$ gives two different numbers.
- If it is 0, then $\pm\sqrt{0} = \pm 0$, and adding or subtracting 0 gives the same number twice: just $x = -\frac{b}{2a}$.
- If it is negative, there is no real square root at all, because every real number squared is 0 or positive.`,
        },
        {
          kind: "why",
          title: "Why the sign decides it: from completing the square",
          body: md`One line of the derivation was

$$\left(x + \frac{b}{2a}\right)^2 = \frac{b^2 - 4ac}{4a^2}.$$

The bottom, $4a^2$, is always positive, so the right side has the same sign as $b^2 - 4ac$. The left side is a square. A square can equal a positive number in two ways, equal 0 in one way, and equal a negative number in no way at all. That's the square root property again.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-8, 8],
          curves: [{ expr: "a x^2 + b x + c", label: "y = ax^2 + bx + c" }],
          params: [
            { name: "a", min: -3, max: 3, step: 0.5, value: 1 },
            { name: "b", min: -6, max: 6, step: 1, value: 2 },
            { name: "c", min: -6, max: 6, step: 1, value: -3 },
          ],
          caption: md`Start with $a = 1$ and $b = 2$, so the discriminant is $4 - 4c$. Slide $c$: below 1 the curve crosses twice, at exactly 1 it touches, above 1 it floats clear of the axis.`,
        },
        {
          kind: "plot",
          x: [-3, 5],
          y: [-5, 7],
          curves: [
            { expr: "x^2 - 2x - 3", label: "x^2 - 2x - 3: \\; b^2 - 4ac = 16", color: 1 },
            { expr: "x^2 - 2x + 1", label: "x^2 - 2x + 1: \\; b^2 - 4ac = 0", color: 2 },
            { expr: "x^2 - 2x + 3", label: "x^2 - 2x + 3: \\; b^2 - 4ac = -8", color: 3 },
          ],
          caption: "Three parabolas with the same axis, x = 1. Only c changes, and with it the discriminant: two crossings, one touch, none.",
        },
        {
          kind: "example",
          title: "No real solutions",
          problem: md`How many real solutions does $2x^2 - 3x + 5 = 0$ have?`,
          steps: [
            { math: md`a = 2, \quad b = -3, \quad c = 5`, note: "" },
            { math: md`b^2 - 4ac = 9 - 40 = -31`, note: md`$(-3)^2 = 9$ and $4(2)(5) = 40$.` },
            { math: md`-31 < 0 \;\Rightarrow\; 0 \text{ solutions}`, note: "Negative: the parabola never reaches the x-axis. No need to go further." },
          ],
        },
        {
          kind: "example",
          title: "Exactly one solution",
          problem: md`How many real solutions does $4x^2 - 12x + 9 = 0$ have? Find them.`,
          steps: [
            { math: md`b^2 - 4ac = 144 - 4(4)(9) = 144 - 144 = 0`, note: "Zero: one solution." },
            { math: md`x = \frac{12 \pm 0}{8} = \frac{3}{2}`, note: "The formula with nothing to add or subtract." },
            { math: md`4x^2 - 12x + 9 = (2x - 3)^2`, note: "A zero discriminant means a perfect square, the double root from the factoring lesson." },
          ],
        },
        {
          kind: "example",
          title: "Choosing a coefficient",
          problem: md`For which value of $c$ does $x^2 + 8x + c = 0$ have exactly one solution?`,
          steps: [
            { math: md`8^2 - 4(1)(c) = 0`, note: "One solution means the discriminant is 0." },
            { math: md`64 = 4c \;\Rightarrow\; c = 16`, note: "" },
            { math: md`x^2 + 8x + 16 = (x + 4)^2`, note: md`It's the completing-the-square corner again: $\left(\frac{8}{2}\right)^2 = 16$.` },
          ],
        },
        {
          kind: "text",
          body: md`One more use. When $a$, $b$ and $c$ are integers and the discriminant is a perfect square like 25 or 49, the square root comes out whole, the roots are fractions, and the quadratic factors. When it isn't a perfect square, the roots involve a root like $\sqrt{5}$, and there's no point hunting for factors: go straight to the formula.`,
        },
        {
          kind: "check",
          prompt: md`How many real solutions does $x^2 + 4x + 7 = 0$ have? Answer with a number.`,
          answer: "0",
          accept: ["zero"],
          explain: md`$b^2 - 4ac = 16 - 28 = -12 < 0$, so none. In vertex form it's $(x + 2)^2 + 3$, which is never below 3.`,
        },
        {
          kind: "check",
          prompt: md`Compute the discriminant of $3x^2 - 2x - 1 = 0$.`,
          answer: "16",
          explain: md`$(-2)^2 - 4(3)(-1) = 4 + 12 = 16$. It's positive and a perfect square, so there are two rational roots: $x = 1$ and $x = -\frac{1}{3}$.`,
        },
      ],
      practice: [countSolutions, solveOrNone, oneSolution],
    },
  ],
};
